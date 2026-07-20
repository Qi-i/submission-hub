# Document storage and online preview

Submission Hub stores paper binaries in a private Cloudflare R2 bucket. Supabase remains responsible for authentication, paper records, attachment references and authorization decisions.

## Security model

- The browser never receives R2 access keys.
- Every object key begins with the authenticated Supabase user ID.
- The `r2-upload` Edge Function verifies the Supabase JWT and rejects keys outside the current user's prefix.
- Paper records store an opaque `r2-storage://bucket/key` reference rather than a public URL.
- Read links are signed for approximately ten minutes.
- R2 public access and `R2_PUBLIC_URL` are not required.
- Removed, replaced, abandoned and paper-deleted attachments are deleted from R2 by the existing paper-form lifecycle.

## Upload and read paths

The preferred path is a short-lived presigned R2 URL. When browser CORS is unavailable, the client automatically uses the authenticated Supabase Edge Function proxy. This makes deployment functional before optional R2 CORS optimization is applied.

Required Edge Function secrets:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME` (optional; defaults to `submission-hub`)

## Preview support

- PDF: native browser PDF viewer.
- JPG, PNG, WebP, GIF, BMP, SVG, TIFF: image viewer where browser decoding is available.
- DOCX: Mammoth, parsed locally in the browser and sanitized before rendering.
- XLSX, XLS, CSV: SheetJS, rendered as sheet tabs and HTML tables locally.
- PPTX: `pptx-preview`, rendered locally.
- TXT, Markdown, JSON, XML and logs: text viewer.
- Legacy DOC/PPT and archives: secure open/download fallback.

No Office file is sent to Google Docs, Microsoft Office Online or another third-party preview service.

## Optional R2 CORS optimization

Apply `cloudflare/r2-cors.json` to the private bucket to enable direct presigned PUT/GET from GitHub Pages and local development. The proxy fallback remains available if CORS is absent or temporarily fails.
