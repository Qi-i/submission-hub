#!/usr/bin/env python3
"""Read-only multi-account IMAP archive and Submission Hub ingestion (Python 3.11+; stdlib only).

No deletion or move commands are sent to mail servers. Credentials are read only from
environment variables. Originals are stored permanently as .eml files before upload.
"""
from __future__ import annotations

import argparse
import email
import hashlib
import html
import imaplib
import json
import os
import re
import sqlite3
import ssl
import subprocess
import sys
from datetime import timezone
from email.headerregistry import Address
from email.policy import default
from email.utils import parseaddr, parsedate_to_datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import Request, urlopen

INVITE = re.compile(r'(invitation to review|invite(?:d|s)? you to review|reviewer invitation|'
                    r'willing to review|审稿邀请|邀请.{0,8}审稿|邀请.{0,8}评审)', re.I)
UPDATE = re.compile(r'(manuscript (?:decision|accepted|rejected)|'
                    r'major revision|minor revision|revision requested|'
                    r'稿件.{0,8}(录用|拒稿|退修|返修|修改)|录用通知|审稿意见|投稿成功)', re.I)
EDITORIAL = re.compile(r'(editorial manager|scholarone|editor-in-chief|'
                       r'editorial office|期刊编辑部|编辑来信)', re.I)
FAKE = re.compile(r'(gift card|bitcoin payment|wire transfer|'
                  r'pay a processing fee before review)', re.I)
ID_PATTERN = re.compile(r'(?:manuscript\s*(?:id|number|no\.?|#)|稿件编号|稿号)\s*[:：#]?\s*([\w.\-/]{5,70})', re.I)


class PlainHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.fragments = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.skip += 1
        if tag in ('br', 'p', 'div', 'li'):
            self.fragments.append('\n')

    def handle_endtag(self, tag):
        if tag in ('script', 'style') and self.skip:
            self.skip -= 1

    def handle_data(self, data):
        if not self.skip:
            self.fragments.append(data)


def body_from(message):
    plain, html_body = [], []
    parts = message.walk() if message.is_multipart() else (message,)
    for part in parts:
        if part.get_content_disposition() == 'attachment':
            continue
        kind = part.get_content_type()
        if kind not in ('text/plain', 'text/html'):
            continue
        try:
            value = part.get_content()
            if not isinstance(value, str):
                value = value.decode('utf-8', errors='replace')
        except Exception:
            continue
        (plain if kind == 'text/plain' else html_body).append(value)
    if plain:
        return '\n'.join(plain).strip()
    stripped = PlainHTML()
    for content in html_body:
        stripped.feed(content)
    return html.unescape(''.join(stripped.fragments)).strip()


def classify(subject, body):
    content = subject + '\n' + body[:4000]
    if INVITE.search(content):
        kind, priority = 'review_invite', 3
    elif UPDATE.search(content):
        kind, priority = 'submission_update', 3
    elif EDITORIAL.search(content):
        kind, priority = 'editorial', 2
    else:
        kind, priority = 'other', 0
    # Suspicion flags are heuristic: do not automatically dismiss an invitation.
    if FAKE.search(content) and kind == 'other':
        kind, priority = 'suspicious', 1
    manuscript = ID_PATTERN.search(content)
    return kind, priority, {'manuscript_no': manuscript.group(1) if manuscript else ''}


def convert_message(raw, folder, archived, account_address):
    m = email.message_from_bytes(raw, policy=default)
    body = body_from(m)[:60000]
    subject = str(m.get('Subject', ''))
    sender_name, sender_address = parseaddr(str(m.get('From', '')))
    received = None
    try:
        moment = parsedate_to_datetime(str(m.get('Date', '')))
        if moment.tzinfo is None:
            moment = moment.replace(tzinfo=timezone.utc)
        received = moment.isoformat()
    except (TypeError, ValueError, IndexError, OverflowError):
        pass
    msg_id = str(m.get('Message-ID', '')).strip()
    remote_key = hashlib.sha256((msg_id.lower() if msg_id else hashlib.sha256(raw).hexdigest()).encode()).hexdigest()
    category, importance, extraction = classify(subject, body)
    return {
        'remote_key': remote_key, 'internet_message_id': msg_id,
        'first_folder': folder, 'last_folder': folder,
        'received_at': received, 'sender_name': sender_name,
        'sender_address': sender_address, 'recipient_address': account_address,
        'subject': subject, 'snippet': ' '.join(body.split())[:700],
        'body_text': body, 'category': category, 'importance': importance,
        'extraction': extraction, 'archived_locally': archived,
    }


def mailbox_names(imap):
    status, rows = imap.list()
    if status != 'OK':
        raise RuntimeError('IMAP LIST failed')
    names = []
    for row in rows or []:
        if not isinstance(row, bytes):
            continue
        text = row.decode('ascii', errors='replace')
        if '\\Noselect' in text or '\\NoSelect' in text:
            continue
        match = re.search(r' (?:"([^"]+)"|([^ ]+))$', text)
        if match:
            names.append(match.group(1) or match.group(2))
    return names


def fetch_token(account):
    if account.get('auth', 'password') == 'xoauth2':
        command = account.get('oauth_token_command')
        if command:
            if not isinstance(command, list) or not all(isinstance(x, str) for x in command):
                raise ValueError('oauth_token_command must be an argv list')
            return subprocess.check_output(command, text=True, timeout=30).strip()
        return os.environ[account['token_env']]
    return os.environ[account['password_env']]


def connect(account):
    server = account['host']
    if not server or server == 'REPLACE_WITH_IMAP_HOST':
        raise ValueError('Set the official IMAP server host before running')
    port = int(account.get('port', 993))
    imap = imaplib.IMAP4_SSL(server, port, ssl_context=ssl.create_default_context())
    user = account['username']
    secret = fetch_token(account)
    if account.get('auth', 'password') == 'xoauth2':
        imap.authenticate('XOAUTH2', lambda _: f'user={user}\x01auth=Bearer {secret}\x01\x01'.encode())
    else:
        imap.login(user, secret)
    return imap


def database(path):
    db = sqlite3.connect(path)
    db.execute('''create table if not exists messages (
      account_id text not null, folder text not null, uidvalidity text not null,
      uid text not null, path text not null, uploaded integer not null default 0,
      primary key(account_id, folder, uidvalidity, uid)
    )''')
    db.commit()
    return db


def upload(endpoint, token, account_id, batch):
    if not endpoint.startswith('https://'):
        raise ValueError('Ingestion endpoint must use HTTPS')
    payload = json.dumps({'account_id': account_id, 'messages': batch}, ensure_ascii=False).encode()
    req = Request(endpoint, data=payload, method='POST', headers={
        'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'
    })
    with urlopen(req, timeout=45) as response:
        data = json.load(response)
    if data.get('accepted') != len(batch):
        raise RuntimeError('Server did not acknowledge all messages')


def ingest_one(config, account, db, root, dry_run):
    account_id = account['account_id']
    if not re.fullmatch(r'[a-fA-F0-9-]{36}', account_id):
        raise ValueError('Invalid account_id')
    archive = root / account_id
    archive.mkdir(parents=True, exist_ok=True)
    imap = connect(account)
    total = 0
    pending = []
    keys = []
    endpoint = os.environ.get('MAIL_INGEST_URL', config.get('ingest_url', ''))
    token = os.environ.get('MAIL_INGEST_TOKEN', '')
    if not dry_run and (not endpoint or not token):
        raise ValueError('MAIL_INGEST_URL and MAIL_INGEST_TOKEN required')
    try:
        for folder in mailbox_names(imap):
            status, _ = imap.select('"' + folder.replace('"', '\\"') + '"', readonly=True)
            if status != 'OK':
                print(f'  skip inaccessible folder: {folder}')
                continue
            uidv = imap.response('UIDVALIDITY')[1]
            uidvalidity = (uidv[0] or b'unknown').decode('ascii', errors='replace')
            status, data = imap.uid('SEARCH', None, 'ALL')
            if status != 'OK' or not data or not data[0]:
                continue
            folder_dir = archive / hashlib.sha256(folder.encode()).hexdigest()[:12]
            folder_dir.mkdir(parents=True, exist_ok=True)
            for uid in data[0].split():
                uid_text = uid.decode()
                existing = db.execute('''select uploaded from messages where
                  account_id=? and folder=? and uidvalidity=? and uid=?''',
                  (account_id, folder, uidvalidity, uid_text)).fetchone()
                if existing and existing[0]:
                    continue
                result, payload = imap.uid('FETCH', uid, '(BODY.PEEK[])')
                if result != 'OK':
                    continue
                raw = next((entry[1] for entry in payload if isinstance(entry, tuple) and isinstance(entry[1], bytes)), None)
                if raw is None:
                    continue
                original = folder_dir / (hashlib.sha256(raw).hexdigest() + '.eml')
                if not original.exists():
                    original.write_bytes(raw)
                db.execute('''insert into messages(account_id,folder,uidvalidity,uid,path,uploaded)
                  values(?,?,?,?,?,0) on conflict(account_id,folder,uidvalidity,uid)
                  do update set path=excluded.path''',
                  (account_id, folder, uidvalidity, uid_text, str(original)))
                db.commit()
                pending.append(convert_message(raw, folder, True, account['username']))
                keys.append((account_id, folder, uidvalidity, uid_text))
                if len(pending) >= 25:
                    if not dry_run:
                        upload(endpoint, token, account_id, pending)
                        db.executemany('''update messages set uploaded=1 where
                          account_id=? and folder=? and uidvalidity=? and uid=?''', keys)
                        db.commit()
                    total += len(pending)
                    pending.clear()
                    keys.clear()
        if pending:
            if not dry_run:
                upload(endpoint, token, account_id, pending)
                db.executemany('''update messages set uploaded=1 where
                  account_id=? and folder=? and uidvalidity=? and uid=?''', keys)
                db.commit()
            total += len(pending)
        return total
    finally:
        try:
            imap.logout()
        except Exception:
            pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', default='mail_collector.json')
    parser.add_argument('--dry-run', action='store_true', help='Archive only, no Supabase upload')
    args = parser.parse_args()
    config = json.loads(Path(args.config).read_text(encoding='utf-8'))
    root = Path(config.get('archive_dir', './mail-archive')).expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    db = database(root / 'mail_index.sqlite3')
    failures = 0
    for account in config.get('accounts', []):
        print('Checking account:', account.get('username', 'unknown'))
        try:
            print('Archived / indexed:', ingest_one(config, account, db, root, args.dry_run))
        except Exception as exc:
            failures += 1
            print(f'ERROR: {type(exc).__name__}: {exc}', file=sys.stderr)
    db.close()
    return 1 if failures else 0


if __name__ == '__main__':
    raise SystemExit(main())
