"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, apiFetch } from "./api";
import { useAuth } from "./auth";
import type { RecState } from "@/components/report-panels";
import type { Edit, Edits, Rec, Statement } from "./statement";

/**
 * Server-backed data for one report (Phase 6). The statement and the user's corrections come from the API;
 * corrections are saved in small debounced batches (`PUT /reviews`) and the suggestions are re-read afterwards
 * because they depend on the categories.
 */
type ApiTxn = {
  id: string; date: string; raw: string; ref: string; debit: number; credit: number; balance: number | null; source: "text" | "ocr"; confidence: number;
  method: string; merchant: string; suggested: string; category: string; effective_merchant: string; reviewed: boolean;
};
type ApiReportMeta = {
  bank: string | null; account_mask: string | null; opening_minor: number | null; closing_minor: number | null;
  opening_source: string | null; closing_source: string | null; period_start: string; period_end: string;
};
type ApiRec = { key: string; title: string; explanation: string; evidence: string[]; range: string; current_spend: number; action: string; savings: { minor: number; assumption: string } | null; confidence: Rec["confidence"]; priority: Rec["priority"]; status: RecState["status"]; helpful: boolean | null };
type ApiRecs = { items: ApiRec[]; potential_minor: number; realized_minor: number; enough_data: boolean };

const FIELDS = ["category", "merchant", "reviewed"] as const;
const SAVE_DELAY_MS = 400;

const toEdits = (txns: ApiTxn[]): Edits => {
  const out: Edits = {};
  for (const t of txns) {
    const e: Edit = {};
    if (t.category !== t.suggested) e.category = t.category;
    if (t.effective_merchant !== t.merchant) e.merchant = t.effective_merchant;
    if (t.reviewed) e.reviewed = true;
    if (Object.keys(e).length) out[t.id] = e;
  }
  return out;
};

export function useLiveReport(id: string, enabled: boolean) {
  const { getToken, session } = useAuth();
  const [loaded, setLoaded] = useState<{ id: string; statement: Statement } | null>(null);
  const [edits, setEditsState] = useState<Edits>({});
  const [recs, setRecs] = useState<Rec[]>([]);
  const [recState, setRecStateMap] = useState<Record<string, RecState>>({});
  const [recSummary, setRecSummary] = useState({ enough: true });
  const [error, setError] = useState<string | null>(null);
  const editsRef = useRef<Edits>({});
  const saved = useRef<Edits>({}); // what the server already has
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushing = useRef<Promise<void>>(Promise.resolve());

  const token = useCallback(async () => {
    const t = await getToken();
    if (!t) throw new ApiError("unauthorized", "Please sign in again.", 401);
    return t;
  }, [getToken]);

  const loadRecs = useCallback(async () => {
    const t = await token();
    const r = await apiFetch<ApiRecs>(t, `/reports/${id}/recommendations`);
    setRecs(r.items.map((x) => ({ key: x.key, title: x.title, explanation: x.explanation, evidence: x.evidence, range: x.range, currentSpend: x.current_spend, action: x.action, savings: x.savings ?? undefined, confidence: x.confidence, priority: x.priority })));
    setRecStateMap(Object.fromEntries(r.items.map((x) => [x.key, { status: x.status, helpful: x.helpful }])));
    setRecSummary({ enough: r.enough_data });
  }, [id, token]);

  const load = useCallback(async () => {
    const t = await token();
    const [meta, txns] = await Promise.all([apiFetch<ApiReportMeta>(t, `/reports/${id}`), apiFetch<ApiTxn[]>(t, `/reports/${id}/transactions`)]);
    const statement: Statement = {
      meta: {
        bank: meta.bank ?? "Statement", accountMask: meta.account_mask ?? "", opening: meta.opening_minor, closing: meta.closing_minor,
        start: meta.period_start, end: meta.period_end, openingSource: meta.opening_source, closingSource: meta.closing_source,
      },
      txns: txns.map((x) => ({ id: x.id, date: x.date, raw: x.raw, ref: x.ref, debit: x.debit, credit: x.credit, balance: x.balance, source: x.source, confidence: x.confidence, merchant: x.merchant, suggested: x.suggested, method: x.method })),
    };
    setLoaded({ id, statement });
    const e = toEdits(txns);
    editsRef.current = e;
    saved.current = e;
    setEditsState(e);
    await loadRecs();
  }, [id, token, loadRecs]);

  useEffect(() => {
    if (!enabled || !session) return;
    let alive = true;
    const t = setTimeout(() => {
      load()
        .then(() => alive && setError(null))
        .catch((e) => alive && setError(e instanceof ApiError ? (e.status === 404 ? "not_found" : e.message) : "Could not load this report."));
    }, 0);
    return () => { alive = false; clearTimeout(t); };
  }, [enabled, session, load]);

  const flush = useCallback(() => {
    flushing.current = flushing.current.then(async () => {
      const next = editsRef.current;
      const prev = saved.current;
      const items: { transaction_id: string; category?: string | null; merchant?: string | null; reviewed?: boolean }[] = [];
      for (const txId of new Set([...Object.keys(next), ...Object.keys(prev)])) {
        const a = next[txId] ?? {}, b = prev[txId] ?? {};
        const item: (typeof items)[number] = { transaction_id: txId };
        let changed = false;
        for (const f of FIELDS) {
          if (a[f] === b[f]) continue;
          changed = true;
          if (f === "reviewed") item.reviewed = !!a.reviewed;
          else item[f] = a[f] ?? null; // null clears the correction and falls back to the extracted value
        }
        if (changed) items.push(item);
      }
      if (items.length === 0) return;
      try {
        const t = await token();
        for (let i = 0; i < items.length; i += 2000) await apiFetch(t, `/reports/${id}/reviews`, { method: "PUT", json: { items: items.slice(i, i + 2000) } });
        saved.current = next;
        setError(null);
        await loadRecs();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Your last change could not be saved.");
        await load().catch(() => {}); // fall back to what the server actually has
      }
    });
    return flushing.current;
  }, [id, token, load, loadRecs]);

  const setEdits = useCallback((u: Edits | ((p: Edits) => Edits)) => {
    const next = typeof u === "function" ? u(editsRef.current) : u;
    editsRef.current = next;
    setEditsState(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
  }, [flush]);

  // Don't lose a pending change when leaving the page.
  useEffect(() => () => { if (timer.current) { clearTimeout(timer.current); void flush(); } }, [flush]);

  const setRecState = useCallback(async (key: string, s: Partial<RecState>) => {
    const prev = recState;
    setRecStateMap((cur) => ({ ...cur, [key]: { ...(cur[key] ?? { status: "new" }), ...s } as RecState }));
    try {
      const t = await token();
      await apiFetch(t, `/reports/${id}/recommendations/${encodeURIComponent(key)}`, { method: "PUT", json: s });
    } catch (e) {
      setRecStateMap(prev);
      setError(e instanceof ApiError ? e.message : "Could not save that change.");
    }
  }, [id, token, recState]);

  // Only expose data that belongs to the report being shown (never a previous report's rows while the next one loads).
  const statement = loaded?.id === id ? loaded.statement : null;
  const loading = enabled && !statement && !error;
  return { statement, edits, setEdits, recs, recState, setRecState, enoughData: recSummary.enough, loading, error, reload: load, flush };
}
