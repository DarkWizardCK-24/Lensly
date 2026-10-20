/** Client for the statement-processing API. Passwords go in the multipart body over HTTPS and nowhere else. */
import { API_BASE_URL } from "./supabase-auth";
import type { Statement } from "./statement";

export class ProcessError extends Error {
  constructor(public code: string, message: string, public details?: Record<string, unknown>) {
    super(message);
  }
}

export type Inspection = { name: string; kind: string; size: number; sha256: string; encrypted: boolean; pages: number | null };

type ApiTxn = { id: string; date: string; raw: string; ref: string; debit: number; credit: number; balance: number | null; source: "text" | "ocr"; confidence: number; merchant: string; suggested: string; method: string };
export type ApiResult = {
  name: string; kind: string; size: number; sha256: string; pages: number | null; encrypted: boolean; ocr_used: boolean; parser: string;
  meta: { bank: string | null; account_mask: string | null; opening: number | null; opening_source: string | null; closing: number | null; closing_source: string | null; start: string; end: string };
  transactions: ApiTxn[];
  reconciliation: { status: string; credits: number; debits: number; difference: number; basis: string };
  warnings: string[];
  rows_skipped: number;
  report_id?: string | null; // set when the server saved the report (signed-in users)
};

async function call<T>(path: string, token: string, file: File, extra: Record<string, string> = {}): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  for (const [k, v] of Object.entries(extra)) form.append(k, v);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/v1/statement-processing/${path}`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form, signal: AbortSignal.timeout(60_000) });
  } catch {
    throw new ProcessError("unreachable", "Can't reach the processing service. Check your connection and try again.");
  }
  if (!res.ok) {
    let code = "error", message = "Something went wrong while processing this file.";
    let details: Record<string, unknown> | undefined;
    try {
      const j = await res.json();
      code = j?.error?.code ?? code;
      message = j?.error?.message ?? message;
      details = j?.error?.details ?? undefined;
    } catch { /* non-JSON error */ }
    throw new ProcessError(code, message, details);
  }
  return (await res.json()) as T;
}

export const inspectStatement = (token: string, file: File) => call<Inspection>("inspect", token, file);

export const processStatement = (token: string, file: File, o: { password?: string; ocr?: boolean; bookId?: string; reportName?: string }) =>
  call<ApiResult>("process", token, file, {
    ...(o.password ? { password: o.password } : {}),
    ...(o.ocr ? { ocr: "true" } : {}),
    ...(o.bookId ? { report_book_id: o.bookId } : {}),
    ...(o.reportName ? { report_name: o.reportName } : {}),
  });

/** Shape the server result for the review / reconcile / analysis screens. Ids are scoped to the report. */
export function toStatement(r: ApiResult, reportId: string): Statement {
  return {
    meta: {
      bank: r.meta.bank ?? "Statement", accountMask: r.meta.account_mask ?? "", opening: r.meta.opening, closing: r.meta.closing,
      start: r.meta.start, end: r.meta.end, openingSource: r.meta.opening_source, closingSource: r.meta.closing_source,
    },
    txns: r.transactions.map((t, i) => ({
      id: `${reportId}-${i + 1}`, date: t.date, raw: t.raw, ref: t.ref, debit: t.debit, credit: t.credit, balance: t.balance,
      source: t.source, confidence: t.confidence, merchant: t.merchant, suggested: t.suggested, method: t.method,
    })),
  };
}
