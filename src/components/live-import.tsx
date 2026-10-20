"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, History, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { Chip, money, useToast } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { catOf } from "@/lib/categories";
import type { Report } from "@/lib/reports";
import { METHODS } from "@/lib/statement";

/** Phase 7: the real Analyzer → CashBook import. Every rule is enforced by the API; this screen only drives it. */
type Txn = { id: string; date: string; debit: number; credit: number; category: string; effective_merchant: string; method: string; reviewed: boolean; duplicate_of: string | null };
type Cashbook = { id: string; name: string; currency: string; archived: boolean; balance_minor: number };
type Cat = { id: string; name: string; kind: "income" | "expense"; archived: boolean };
type Preview = { to_import: number; skipped: { transaction_id: string; reason: string }[]; skipped_count: number; balance_effect_minor: number; cashbook: { name: string; balance_minor: number; balance_after_minor: number } };
type Result = { batch_id: string; imported_count: number; skipped_count: number; balance_effect_minor: number; replayed: boolean };
type Batch = { batch_id: string; cashbook_name: string; imported_count: number; skipped_count: number; balance_effect_minor: number; created_at: string };

const STEPS = ["Select", "Map", "Preview", "Result"];
const AUTO = "";
const sel_ = "h-10 rounded-xl border border-border bg-surface px-3 text-sm font-semibold outline-none focus:border-brand";
const msg = (e: unknown) => (e instanceof ApiError ? e.message : "Something went wrong. Please try again.");

export function LiveImport({ report }: { report: Report }) {
  const { getToken } = useAuth();
  const say = useToast();
  const id = report.id;
  const [txns, setTxns] = useState<Txn[] | null>(null);
  const [books, setBooks] = useState<Cashbook[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [history, setHistory] = useState<Batch[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [cbId, setCbId] = useState("");
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [catMap, setCatMap] = useState<Record<string, string>>({});
  const [methodMap, setMethodMap] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const key = useRef<string>("");

  const token = useCallback(async () => {
    const t = await getToken();
    if (!t) throw new ApiError("unauthorized", "Please sign in again.", 401);
    return t;
  }, [getToken]);

  const loadHistory = useCallback(async () => {
    const t = await token();
    setHistory(await apiFetch<Batch[]>(t, "/imports", { query: { report_id: id } }));
  }, [id, token]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const t = await token();
        const [x, b, c] = await Promise.all([apiFetch<Txn[]>(t, `/reports/${id}/transactions`), apiFetch<Cashbook[]>(t, "/cashbooks"), apiFetch<Cat[]>(t, "/categories")]);
        if (!alive) return;
        setTxns(x);
        const ok = b.filter((k) => k.currency === "INR" && !k.archived);
        setBooks(ok);
        setCbId((cur) => cur || ok[0]?.id || "");
        setCats(c.filter((k) => !k.archived));
        await loadHistory();
      } catch (e) {
        if (alive) setLoadError(msg(e));
      }
    })();
    return () => { alive = false; };
  }, [id, token, loadHistory]);

  const all = useMemo(() => txns ?? [], [txns]);
  const eligible = useMemo(() => all.filter((t) => t.reviewed && !t.duplicate_of), [all]);
  const notReviewed = all.filter((t) => !t.reviewed).length;
  const dups = all.filter((t) => t.duplicate_of).length;
  const sel = useMemo(() => picked ?? new Set(eligible.map((t) => t.id)), [picked, eligible]);
  const chosen = useMemo(() => eligible.filter((t) => sel.has(t.id)), [eligible, sel]);
  const cb = books.find((c) => c.id === cbId);

  const catIds = [...new Set(chosen.map((t) => t.category))];
  const kindsOf = (c: string) => new Set(chosen.filter((t) => t.category === c).map((t) => (t.credit > 0 ? "income" : "expense")));
  const methods = [...new Set(chosen.map((t) => t.method))];

  // Any change to the plan invalidates the preview and the confirmation (and starts a fresh idempotency key).
  const invalidate = () => { setPreview(null); setConfirmed(false); key.current = ""; };

  const body = () => ({
    report_id: id,
    cashbook_id: cbId,
    transaction_ids: chosen.map((t) => t.id),
    category_map: Object.fromEntries(Object.entries(catMap).filter(([, v]) => v !== AUTO)),
    method_map: Object.fromEntries(Object.entries(methodMap).filter(([k, v]) => v && v !== k)),
  });

  const runPreview = async () => {
    setBusy(true);
    setError(null);
    try {
      setPreview(await apiFetch<Preview>(await token(), "/imports/preview", { json: body() }));
      setStep(2);
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (busy || !preview) return;
    setBusy(true);
    setError(null);
    key.current ||= `imp-${crypto.randomUUID()}`; // reused on retry, so a double-click or a timeout never imports twice
    try {
      const r = await apiFetch<Result>(await token(), "/imports/confirm", { json: { ...body(), idempotency_key: key.current } });
      setResult(r);
      setStep(3);
      say(`Import recorded: ${r.imported_count} new, ${r.skipped_count} skipped`);
      await loadHistory();
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (tid: string) => { const n = new Set(sel); if (n.has(tid)) n.delete(tid); else n.add(tid); setPicked(n); invalidate(); };

  if (loadError) return <div role="alert" className="card p-10 text-center text-sm font-semibold text-expense">{loadError}</div>;
  if (!txns) return <div role="status" className="card p-10 text-center text-sm text-muted">Loading…</div>;

  const effect = preview?.balance_effect_minor ?? 0;
  return (
    <div className="space-y-6">
      <div>
        <Link href={`/reports/${id}`} className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-foreground"><ArrowLeft size={15} /> {report.name}</Link>
        <h1 className="text-2xl font-extrabold tracking-tight">Import reviewed transactions into CashBook</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted"><Chip tone="ok"><ShieldCheck size={11} /> Live</Chip> Only transactions you have reviewed are imported, once each. Existing CashBook entries are never changed.</p>
      </div>

      <ol className="grid grid-cols-4 gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className={clsx("flex items-center gap-2 rounded-2xl border p-3 text-sm font-bold", i === step ? "border-brand bg-brand-soft text-brand" : i < step ? "border-income/40 text-income" : "border-border text-muted")}>
            <span className={clsx("grid size-6 shrink-0 place-items-center rounded-full text-xs", i < step ? "bg-income text-white" : i === step ? "grad-brand text-white" : "bg-surface-muted")}>{i < step ? <Check size={13} /> : i + 1}</span><span className="hidden sm:inline">{s}</span>
          </li>
        ))}
      </ol>

      {error && <div role="alert" className="rounded-2xl border border-expense/30 bg-expense/10 px-4 py-3 text-sm font-semibold text-expense">{error}</div>}

      {step === 0 && (
        <section className="space-y-4">
          <div className="card flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
            <span><strong>{eligible.length}</strong> eligible</span>
            <span className="text-muted">{notReviewed} not reviewed yet</span>
            <span className="text-muted">{dups} flagged as possible duplicates (excluded)</span>
            <Link href={`/reports/${id}`} className="ml-auto font-bold text-brand hover:underline">Review more transactions →</Link>
          </div>
          {eligible.length === 0 ? (
            <div className="card grid place-items-center p-10 text-center"><AlertTriangle className="text-warning" /><p className="mt-2 text-lg font-bold">No reviewed transactions yet</p><p className="mt-1 max-w-md text-sm text-muted">Unreviewed transactions are never imported. Open the report, review the rows you trust, then come back.</p></div>
          ) : (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-border p-3 text-sm"><label className="flex items-center gap-2 font-semibold"><input type="checkbox" className="size-4 accent-[#e11d48]" checked={chosen.length === eligible.length} onChange={(e) => { setPicked(e.target.checked ? new Set(eligible.map((t) => t.id)) : new Set()); invalidate(); }} /> Select all</label><span className="text-muted">{chosen.length} selected</span></div>
              <ul className="max-h-[420px] divide-y divide-border overflow-y-auto">
                {eligible.map((t) => (
                  <li key={t.id}><label className="flex cursor-pointer items-center gap-3 p-3 hover:bg-surface-muted/60">
                    <input type="checkbox" className="size-4 accent-[#e11d48]" checked={sel.has(t.id)} onChange={() => toggle(t.id)} />
                    <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{t.effective_merchant}</span><span className="text-xs text-muted">{t.date} · {catOf(t.category).name}</span></span>
                    <span className={clsx("font-bold", t.credit ? "text-income" : "text-expense")}>{t.credit ? "+" : "−"}{money(t.credit || t.debit, 2)}</span></label></li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex justify-end"><button disabled={chosen.length === 0} onClick={() => setStep(1)} className="grad-brand inline-flex h-12 items-center gap-2 rounded-2xl px-6 text-sm font-bold text-white disabled:opacity-50">Continue <ArrowRight size={16} /></button></div>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-4">
          <div className="card p-5"><h2 className="mb-3 font-bold">Destination CashBook</h2>
            {books.length === 0 ? (
              <p className="text-sm text-muted">You need an active ₹ (INR) CashBook to import into. Create one in CashBook, then come back.</p>
            ) : (
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Destination CashBook">{books.map((c) => <button key={c.id} role="radio" aria-checked={cbId === c.id} onClick={() => { setCbId(c.id); invalidate(); }} className={clsx("rounded-full border px-4 py-2 text-sm font-semibold", cbId === c.id ? "border-brand bg-brand-soft text-brand" : "border-border hover:bg-surface-muted")}>{c.name}</button>)}</div>
            )}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card p-5"><h2 className="mb-3 font-bold">Map categories</h2><ul className="space-y-2.5">{catIds.map((c) => {
              const kinds = kindsOf(c);
              const options = kinds.size === 1 ? cats.filter((k) => k.kind === [...kinds][0]) : [];
              return <li key={c} className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2 font-semibold"><span className="size-2.5 rounded-full" style={{ background: catOf(c).color }} />{catOf(c).name}</span>
                <select aria-label={`CashBook category for ${catOf(c).name}`} value={catMap[c] ?? AUTO} onChange={(e) => { setCatMap({ ...catMap, [c]: e.target.value }); invalidate(); }} className={sel_}>
                  <option value={AUTO}>Automatic (match by name)</option>
                  {options.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
                </select></li>;
            })}</ul></div>
            <div className="card p-5"><h2 className="mb-3 font-bold">Map payment methods</h2><ul className="space-y-2.5">{methods.map((m) => <li key={m} className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold">{m}</span>
              <select aria-label={`CashBook method for ${m}`} value={methodMap[m] ?? m} onChange={(e) => { setMethodMap({ ...methodMap, [m]: e.target.value }); invalidate(); }} className={sel_}>{[...new Set([m, ...METHODS])].map((n) => <option key={n}>{n}</option>)}</select></li>)}</ul></div>
          </div>
          <div className="flex justify-between"><button onClick={() => setStep(0)} className="rounded-2xl border border-border px-5 py-3 text-sm font-bold hover:bg-surface-muted">Back</button><button disabled={!cb || busy} onClick={runPreview} className="grad-brand inline-flex h-12 items-center gap-2 rounded-2xl px-6 text-sm font-bold text-white disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin" /> : null} Preview <ArrowRight size={16} /></button></div>
        </section>
      )}

      {step === 2 && preview && (
        <section className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="card p-5"><p className="text-sm text-muted">Will be created</p><p className="text-2xl font-extrabold text-income">{preview.to_import}</p></div>
            <div className="card p-5"><p className="text-sm text-muted">Skipped</p><p className="text-2xl font-extrabold">{preview.skipped_count}</p></div>
            <div className="card p-5"><p className="text-sm text-muted">Net effect on {preview.cashbook.name}</p><p className={clsx("text-2xl font-extrabold", effect >= 0 ? "text-income" : "text-expense")}>{effect >= 0 ? "+" : "−"}{money(Math.abs(effect), 2)}</p></div>
          </div>
          <div className="card p-5">
            <h2 className="mb-3 font-bold">Balance preview · {preview.cashbook.name}</h2>
            <div className="flex flex-wrap items-center gap-3 text-lg font-extrabold"><span>{money(preview.cashbook.balance_minor, 2)}</span><ArrowRight className="text-muted" size={18} /><span className={effect >= 0 ? "text-income" : "text-expense"}>{money(preview.cashbook.balance_after_minor, 2)}</span></div>
            <p className="mt-1 text-xs text-muted">Imported rows are added as new entries linked to this statement. Nothing existing is changed or overwritten.</p>
          </div>
          {preview.skipped_count > 0 && <div role="status" className="card flex gap-3 border-warning/40 p-4 text-sm"><History className="shrink-0 text-warning" size={18} /><p><strong>{preview.skipped_count} transaction{preview.skipped_count === 1 ? "" : "s"}</strong> will be skipped ({[...new Set(preview.skipped.map((s) => s.reason.toLowerCase()))].join(", ")}). Importing twice never creates duplicates.</p></div>}
          <label className="card flex cursor-pointer items-start gap-3 p-4 text-sm"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-4 accent-[#e11d48]" /><span>I&apos;ve reviewed these transactions and want to import them into <strong>{preview.cashbook.name}</strong>.</span></label>
          <div className="flex justify-between"><button onClick={() => setStep(1)} className="rounded-2xl border border-border px-5 py-3 text-sm font-bold hover:bg-surface-muted">Back</button><button disabled={!confirmed || busy || preview.to_import === 0} onClick={confirm} className="grad-brand inline-flex h-12 items-center gap-2 rounded-2xl px-6 text-sm font-bold text-white disabled:opacity-50">{busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />} Confirm import</button></div>
        </section>
      )}

      {step === 3 && result && (
        <section className="space-y-4">
          <div className="card border-income/40 p-8 text-center">
            <span className="grad-income mx-auto grid size-16 place-items-center rounded-2xl text-white"><CheckCircle2 size={32} /></span>
            <h2 className="mt-4 text-2xl font-extrabold">{result.replayed ? "Already imported" : "Import complete"}</h2>
            <p className="mt-1 text-muted"><strong className="text-income">{result.imported_count}</strong> new · <strong>{result.skipped_count}</strong> skipped · net {result.balance_effect_minor >= 0 ? "+" : "−"}{money(Math.abs(result.balance_effect_minor), 2)} to {cb?.name}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button onClick={() => { setStep(0); setConfirmed(false); setResult(null); setPreview(null); setPicked(null); key.current = ""; }} className="rounded-xl border border-border px-4 py-2.5 text-sm font-bold hover:bg-surface-muted">Import more</button>
              <Link href={`/reports/${id}`} className="grad-brand rounded-xl px-5 py-2.5 text-sm font-bold text-white">Back to report</Link>
            </div>
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section className="card p-5" aria-labelledby="aud-h">
          <h2 id="aud-h" className="mb-3 flex items-center gap-2 font-bold"><History size={17} className="text-brand" /> Import history (audit)</h2>
          <ul className="divide-y divide-border text-sm">{history.map((a) => <li key={a.batch_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5"><span>{new Date(a.created_at).toLocaleString("en-IN")} → <strong>{a.cashbook_name}</strong></span><span className="text-muted">{a.imported_count} imported · {a.skipped_count} skipped</span></li>)}</ul>
        </section>
      )}
    </div>
  );
}
