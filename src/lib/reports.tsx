"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, apiFetch } from "./api";
import { useAuth } from "./auth";
import { deleteStatement, hydrateStatements } from "./statement-store";

/**
 * Report Books + reports.
 *  - Signed in   → the API is the source of truth (Phase 6): everything is persisted server-side.
 *  - Sample mode → illustrative data kept in this browser only.
 */
export type ReportBook = { id: string; name: string; description: string; color: string; icon: string; createdAt: number; reportCount?: number };
export type ReportStatus = "sample" | "uploaded" | "analyzed";
export type Report = {
  id: string;
  bookId: string;
  name: string;
  source: string; // original file name — display only, never used as a path
  sizeBytes: number;
  period: string;
  status: ReportStatus;
  createdAt: number;
  sha256?: string; // content hash from the server, used to detect duplicate uploads
  creditsMinor?: number;
  debitsMinor?: number;
  // live (server) reports only
  reconStatus?: "reconciled" | "warnings" | "not_reconciled" | "unknown";
  txnCount?: number;
  reviewedCount?: number;
  currentVersion?: number;
};

export const BOOK_COLORS = ["#e11d48", "#ff7a2f", "#f59e0b", "#0ea5e9", "#8b5cf6", "#14b8a6"];
export const BOOK_ICONS = ["folder", "wallet", "briefcase", "users", "house", "landmark"] as const;

type State = { books: ReportBook[]; reports: Report[] };
type BookInput = Omit<ReportBook, "id" | "createdAt" | "reportCount">;

const day = 86_400_000;
const seed = (): State => {
  const now = Date.now();
  return {
    books: [
      { id: "rb1", name: "Personal accounts", description: "Savings and salary account statements", color: BOOK_COLORS[0], icon: "wallet", createdAt: now - 90 * day },
      { id: "rb2", name: "Business", description: "Current account and card statements", color: BOOK_COLORS[1], icon: "briefcase", createdAt: now - 60 * day },
      { id: "rb3", name: "Joint account", description: "Shared household account", color: BOOK_COLORS[3], icon: "users", createdAt: now - 30 * day },
    ],
    reports: [
      { id: "r1", bookId: "rb1", name: "HDFC Savings — September", source: "sample-sept.pdf", sizeBytes: 482_000, period: "Sep 2026", status: "sample", createdAt: now - 20 * day, creditsMinor: 8_500_000, debitsMinor: 5_150_000 },
      { id: "r2", bookId: "rb1", name: "HDFC Savings — October", source: "sample-oct.pdf", sizeBytes: 455_000, period: "Oct 2026", status: "sample", createdAt: now - 3 * day, creditsMinor: 8_500_000, debitsMinor: 5_750_000 },
      { id: "r3", bookId: "rb2", name: "Current account — Q3", source: "sample-q3.xlsx", sizeBytes: 211_000, period: "Jul–Sep 2026", status: "sample", createdAt: now - 12 * day, creditsMinor: 21_400_000, debitsMinor: 16_900_000 },
      { id: "r4", bookId: "rb3", name: "Joint account — October", source: "sample-joint.csv", sizeBytes: 38_000, period: "Oct 2026", status: "sample", createdAt: now - 2 * day, creditsMinor: 4_200_000, debitsMinor: 3_650_000 },
    ],
  };
};

// ------------------------------------------------------------------ server shapes
type ApiBook = { id: string; name: string; description: string; color: string; icon_key: string; created_at: string; report_count: number };
type ApiReport = {
  id: string; name: string; period_label: string; report_book_id: string; source: string; size_bytes: number; sha256: string; credits_minor: number; debits_minor: number;
  transaction_count: number; reviewed_count: number; reconciliation_status: Report["reconStatus"]; current_version: number; created_at: string;
};
const toBook = (b: ApiBook): ReportBook => ({ id: b.id, name: b.name, description: b.description, color: b.color, icon: b.icon_key, createdAt: Date.parse(b.created_at), reportCount: b.report_count });
const toReport = (r: ApiReport): Report => ({
  id: r.id, bookId: r.report_book_id, name: r.name, source: r.source, sizeBytes: r.size_bytes, period: r.period_label, status: "analyzed", createdAt: Date.parse(r.created_at),
  sha256: r.sha256, creditsMinor: r.credits_minor, debitsMinor: r.debits_minor, reconStatus: r.reconciliation_status, txnCount: r.transaction_count,
  reviewedCount: r.reviewed_count, currentVersion: r.current_version,
});
const msg = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong. Please try again.");

type Value = State & {
  live: boolean;
  loading: boolean;
  loadError: string | null;
  /** Re-reads from the server; resolves to the fresh report list (null in sample mode or on failure). */
  refresh: () => Promise<Report[] | null>;
  addBook: (b: BookInput) => Promise<{ book?: ReportBook; error?: string }>;
  updateBook: (id: string, b: Partial<BookInput>) => Promise<string | null>;
  /** Resolves to an error message when the book still holds reports. */
  deleteBook: (id: string) => Promise<string | null>;
  /** Sample mode only: in live mode the server creates the report when a statement is processed. */
  addReport: (r: Omit<Report, "id" | "createdAt">) => Report;
  moveReport: (id: string, bookId: string) => Promise<string | null>;
  renameReport: (id: string, name: string) => Promise<string | null>;
  deleteReport: (id: string) => Promise<string | null>;
};

const Ctx = createContext<Value | null>(null);
const uid = () => Math.random().toString(36).slice(2, 10);
const bookBody = (b: Partial<BookInput>) => ({
  ...(b.name !== undefined && { name: b.name }),
  ...(b.description !== undefined && { description: b.description }),
  ...(b.color !== undefined && { color: b.color }),
  ...(b.icon !== undefined && { icon_key: b.icon }),
});

export function ReportsProvider({ children }: { children: React.ReactNode }) {
  const { session, status, getToken } = useAuth();
  const live = status === "signedIn";
  const key = `fp_reports_${session?.userId ?? "demo"}`;
  const [sampleState, setState] = useState<State>({ books: [], reports: [] });
  const [liveState, setLiveState] = useState<(State & { user: string }) | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const liveRef = useRef(live);
  useEffect(() => { liveRef.current = live; }, [live]);

  // Sample mode: load this browser's data (derived state during render, persisted in an effect).
  const sample = status === "demo";
  if (sample && loadedKey !== key) {
    let next: State | null = null;
    try {
      const raw = localStorage.getItem(key);
      next = raw ? (JSON.parse(raw) as State) : null;
    } catch {
      next = null;
    }
    setLoadedKey(key);
    hydrateStatements(undefined);
    setState(next ?? seed());
  }
  useEffect(() => {
    if (!sample || loadedKey !== key) return;
    try { localStorage.setItem(key, JSON.stringify(sampleState)); } catch { /* storage unavailable */ }
  }, [sampleState, key, loadedKey, sample]);

  // Live mode: the API is the source of truth.
  const refresh = useCallback(async (): Promise<Report[] | null> => {
    if (!liveRef.current) return null;
    const token = await getToken();
    if (!token) return null;
    const user = session?.userId ?? "";
    try {
      const [books, reports] = await Promise.all([apiFetch<ApiBook[]>(token, "/report-books"), apiFetch<ApiReport[]>(token, "/reports")]);
      const mapped = reports.map(toReport);
      setLiveState({ user, books: books.map(toBook), reports: mapped });
      setLoadError(null);
      return mapped;
    } catch (e) {
      setLoadError(msg(e));
      return null;
    }
  }, [getToken, session?.userId]);

  const userId = session?.userId;
  useEffect(() => {
    if (!live) return;
    const t = setTimeout(() => void refresh(), 0); // after render, cancelled if the user/mode changes first
    return () => clearTimeout(t);
  }, [live, userId, refresh]);

  // Never show a previous user's data: live data only counts while it belongs to the current user.
  const mine = live && liveState?.user === (userId ?? "") ? liveState : null;
  const state = useMemo<State>(() => (live ? (mine ?? { books: [], reports: [] }) : sampleState), [live, mine, sampleState]);
  const loading = live && !mine && !loadError;

  const withToken = useCallback(async <T,>(fn: (t: string) => Promise<T>): Promise<T> => {
    const t = await getToken();
    if (!t) throw new ApiError("unauthorized", "Please sign in again.", 401);
    return fn(t);
  }, [getToken]);

  const addBook: Value["addBook"] = useCallback(async (b) => {
    if (liveRef.current) {
      try {
        const created = await withToken((t) => apiFetch<ApiBook>(t, "/report-books", { json: { name: b.name, description: b.description, color: b.color, icon_key: b.icon } }));
        await refresh();
        return { book: toBook(created) };
      } catch (e) {
        return { error: msg(e) };
      }
    }
    if (state.books.some((x) => x.name.toLowerCase() === b.name.toLowerCase())) return { error: "You already have a Report Book with this name." };
    const book = { ...b, id: uid(), createdAt: Date.now() };
    setState((s) => ({ ...s, books: [...s.books, book] }));
    return { book };
  }, [refresh, state.books, withToken]);

  const updateBook: Value["updateBook"] = useCallback(async (id, b) => {
    if (liveRef.current) {
      try {
        await withToken((t) => apiFetch(t, `/report-books/${id}`, { method: "PATCH", json: bookBody(b) }));
        await refresh();
        return null;
      } catch (e) {
        return msg(e);
      }
    }
    if (b.name && state.books.some((x) => x.id !== id && x.name.toLowerCase() === b.name!.toLowerCase())) return "You already have a Report Book with this name.";
    setState((s) => ({ ...s, books: s.books.map((x) => (x.id === id ? { ...x, ...b } : x)) }));
    return null;
  }, [refresh, state.books, withToken]);

  const deleteBook: Value["deleteBook"] = useCallback(async (id) => {
    if (liveRef.current) {
      try {
        await withToken((t) => apiFetch(t, `/report-books/${id}`, { method: "DELETE" }));
        await refresh();
        return null;
      } catch (e) {
        return msg(e);
      }
    }
    const n = state.reports.filter((r) => r.bookId === id).length;
    if (n > 0) return `This book holds ${n} report${n === 1 ? "" : "s"}. Move or delete them first.`;
    setState((s) => ({ ...s, books: s.books.filter((x) => x.id !== id) }));
    return null;
  }, [refresh, state.reports, withToken]);

  const addReport: Value["addReport"] = useCallback((r) => {
    const report = { ...r, id: uid(), createdAt: Date.now() };
    setState((s) => ({ ...s, reports: [report, ...s.reports] }));
    return report;
  }, []);

  const patchReport = useCallback(async (id: string, json: Record<string, unknown>, local: Partial<Report>) => {
    if (liveRef.current) {
      try {
        await withToken((t) => apiFetch(t, `/reports/${id}`, { method: "PATCH", json }));
        await refresh();
        return null;
      } catch (e) {
        return msg(e);
      }
    }
    setState((s) => ({ ...s, reports: s.reports.map((r) => (r.id === id ? { ...r, ...local } : r)) }));
    return null;
  }, [refresh, withToken]);

  const moveReport: Value["moveReport"] = useCallback((id, bookId) => patchReport(id, { report_book_id: bookId }, { bookId }), [patchReport]);
  const renameReport: Value["renameReport"] = useCallback((id, name) => patchReport(id, { name }, { name }), [patchReport]);

  const deleteReport: Value["deleteReport"] = useCallback(async (id) => {
    if (liveRef.current) {
      try {
        await withToken((t) => apiFetch(t, `/reports/${id}`, { method: "DELETE" }));
        await refresh();
        return null;
      } catch (e) {
        return msg(e);
      }
    }
    deleteStatement(undefined, id); // also forget the parsed transactions kept for this report
    setState((s) => ({ ...s, reports: s.reports.filter((r) => r.id !== id) }));
    return null;
  }, [refresh, withToken]);

  const value = useMemo(
    () => ({ ...state, live, loading, loadError, refresh, addBook, updateBook, deleteBook, addReport, moveReport, renameReport, deleteReport }),
    [state, live, loading, loadError, refresh, addBook, updateBook, deleteBook, addReport, moveReport, renameReport, deleteReport],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useReports(): Value {
  const v = useContext(Ctx);
  if (!v) throw new Error("useReports must be used inside <ReportsProvider>");
  return v;
}

export const inr = (minor: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(minor / 100);
