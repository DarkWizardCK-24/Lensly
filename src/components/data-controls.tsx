"use client";

import { Download, Eraser, ShieldCheck, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/ui";
import { ApiError, apiFetch, downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useReports } from "@/lib/reports";

type Summary = { cashbooks: number; transactions: number; custom_categories: number; reports: number; report_books: number; statement_transactions: number; budgets: number; goals: number };
type Scope = "all" | "analyzer" | "cashbook";
const SCOPES: { id: Scope; label: string; detail: string }[] = [
  { id: "analyzer", label: "Lensly data", detail: "Report Books, reports, extracted transactions, your corrections, versions, budgets, goals and import history." },
  { id: "cashbook", label: "CashBook data", detail: "CashBooks, their transactions (including imported ones) and your custom categories." },
  { id: "all", label: "Everything", detail: "Both of the above. Your sign-in account stays." },
];

/** Export, retention and deletion. Deletion is never one click: it needs the word DELETE typed. */
export function DataControls() {
  const auth = useAuth();
  const say = useToast();
  const { refresh } = useReports();
  const demo = auth.status === "demo";
  const { getToken } = auth;
  const [summary, setSummary] = useState<Summary | null>(null);
  const [scope, setScope] = useState<Scope>("analyzer");
  const [dialog, setDialog] = useState<"data" | "account" | "sample" | null>(null);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const api = useCallback(async <T,>(path: string, method?: string) => {
    const t = await getToken();
    if (!t) throw new ApiError("unauthorized", "Please sign in again.", 401);
    return apiFetch<T>(t, path, { method });
  }, [getToken]);

  const loadSummary = useCallback(async () => { try { setSummary(await api<Summary>("/me/data-summary")); } catch { setSummary(null); } }, [api]);
  useEffect(() => {
    if (demo) return;
    const t = setTimeout(() => void loadSummary(), 0);
    return () => clearTimeout(t);
  }, [demo, loadSummary]);

  const open = (d: typeof dialog) => { setTyped(""); setErr(null); setDialog(d); };

  const exportAll = async () => {
    try {
      const t = await getToken();
      if (!t) return;
      await downloadFile(t, "/me/export", "my-finance-data.json");
      say("Your data was downloaded");
    } catch (e) {
      say(e instanceof ApiError ? e.message : "The export failed.");
    }
  };

  const confirm = async () => {
    if (typed !== "DELETE" || busy) return;
    setBusy(true);
    setErr(null);
    try {
      if (dialog === "data") {
        await api(`/me/data?scope=${scope}&confirm=DELETE`, "DELETE");
        await Promise.all([refresh(), loadSummary()]);
        say("Deleted. This can't be undone.");
      } else if (dialog === "account") {
        await api("/me/account?confirm=DELETE", "DELETE");
        await auth.signOut();
        return;
      }
      setDialog(null);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "That didn't work. Nothing was deleted.");
    } finally {
      setBusy(false);
    }
  };

  const resetSample = () => {
    try {
      for (const k of Object.keys(localStorage)) if (k !== "fp_demo" && (k.startsWith("fp_demo_") || k === "fp_reports_demo")) localStorage.removeItem(k); // keep the sample-mode flag itself
    } catch { /* storage unavailable */ }
    window.location.reload();
  };

  const facts: [string, number][] = summary
    ? [["Report Books", summary.report_books], ["Reports", summary.reports], ["Statement transactions", summary.statement_transactions], ["Budgets", summary.budgets], ["Goals", summary.goals], ["CashBooks", summary.cashbooks], ["CashBook transactions", summary.transactions]]
    : [];
  const danger = "inline-flex items-center gap-2 rounded-xl border border-expense/40 px-4 py-2.5 text-sm font-bold text-expense hover:bg-expense/10";

  return (
    <section className="card p-6" aria-labelledby="data-h">
      <h2 id="data-h" className="flex items-center gap-2 font-bold"><ShieldCheck size={18} className="text-brand" /> Data &amp; privacy</h2>
      <ul className="mt-3 space-y-2 text-sm text-muted">
        <li>Your original statement files are <strong>never stored</strong> — only the transactions read from them, your corrections and the reports you saved.</li>
        <li>Document passwords are used once, kept in memory only, and never saved, logged or shown again.</li>
        <li>Sign-in tokens are kept in this browser; passwords are never stored.</li>
      </ul>

      {demo ? (
        <div className="mt-5 border-t border-border pt-5">
          <p className="text-sm text-muted">You&apos;re in sample mode: everything is illustrative and lives only in this browser.</p>
          <button onClick={() => open("sample")} className={`${danger} mt-3`}><Eraser size={15} /> Reset sample data</button>
        </div>
      ) : (
        <div className="mt-5 space-y-5 border-t border-border pt-5">
          {summary && (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {facts.map(([l, v]) => <div key={l} className="rounded-2xl bg-surface-muted p-3"><dt className="text-xs text-muted">{l}</dt><dd className="mt-0.5 text-lg font-extrabold">{v}</dd></div>)}
            </dl>
          )}
          <div className="flex flex-wrap gap-2">
            <button onClick={exportAll} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold hover:bg-surface-muted"><Download size={15} /> Download all my data (JSON)</button>
            <button onClick={() => open("data")} className={danger}><Trash2 size={15} /> Delete my data…</button>
            <button onClick={() => open("account")} className={danger}><Trash2 size={15} /> Delete my account…</button>
          </div>
        </div>
      )}

      <Modal open={dialog === "sample"} onClose={() => setDialog(null)} title="Reset sample data?">
        <p className="text-sm text-muted">The illustrative books and reports in this browser go back to their starting state.</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setDialog(null)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface-muted">Cancel</button>
          <button onClick={resetSample} className="rounded-xl bg-expense px-5 py-2.5 text-sm font-bold text-white">Reset</button>
        </div>
      </Modal>

      <Modal open={dialog === "data" || dialog === "account"} onClose={() => setDialog(null)} title={dialog === "account" ? "Delete your account?" : "Delete your data?"}>
        <div className="space-y-4">
          {dialog === "data" ? (
            <fieldset className="space-y-2">
              <legend className="sr-only">What to delete</legend>
              {SCOPES.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border p-3 text-sm has-[:checked]:border-expense has-[:checked]:bg-expense/5">
                  <input type="radio" name="scope" checked={scope === s.id} onChange={() => setScope(s.id)} className="mt-1 accent-[#e11d48]" />
                  <span><span className="block font-bold">{s.label}</span><span className="text-muted">{s.detail}</span></span>
                </label>
              ))}
            </fieldset>
          ) : (
            <p className="text-sm text-muted">This permanently deletes your sign-in account <strong>and all of your data</strong> in both apps. It can&apos;t be undone.</p>
          )}
          <p className="text-sm font-semibold text-expense">This can&apos;t be undone. Consider downloading your data first.</p>
          <label className="block text-sm"><span className="mb-1.5 block font-semibold">Type DELETE to confirm</span>
            <input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus autoComplete="off" spellCheck={false} className="h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm outline-none focus:border-expense focus:ring-2 focus:ring-expense/30" /></label>
          {err && <p role="alert" className="text-sm font-medium text-expense">{err}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setDialog(null)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface-muted">Cancel</button>
            <button onClick={confirm} disabled={typed !== "DELETE" || busy} className="rounded-xl bg-expense px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? "Deleting…" : dialog === "account" ? "Delete account" : "Delete data"}</button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
