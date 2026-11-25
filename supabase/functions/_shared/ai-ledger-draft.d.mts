export type LedgerDraftBatch={format:'qi-ledger-import';version:1;batchId:string;operations:Record<string,unknown>[]};
export function ledgerEvidenceId(text:string,images:{data:string}[]):Promise<string>;
export function buildLedgerDraft(batchId:string,transactions:unknown[]):Promise<LedgerDraftBatch>;
