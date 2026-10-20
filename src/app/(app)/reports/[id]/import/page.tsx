"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, FlaskConical, History, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { LiveImport } from "@/components/live-import";
import { Chip, money, useToast } from "@/components/ui";
import { catOf } from "@/lib/categories";
import { useReports } from "@/lib/reports";
import { useScoped } from "@/lib/scoped";
import { balanceEffect, effective, METHODS, planImport, sampleStatement, type Edits } from "@/lib/statement";

/** Sample workspace only: illustrative destinations. Signed-in users import through the API (see LiveImport). */
const CASHBOOKS = [
  { id: "cb1", name: "Personal", balance: 48_523_900 },
  { id: "cb2", name: "Household", balance: 6_785_300 },
  { id: "cb3", name: "Freelance", balance: 27_040_700 },
];
const CB_CATEGORIES = ["Food & groceries", "Transportation", "Housing", "Utilities", "Shopping", "Healthcare", "Entertainment", "Education", "Subscriptions", "Travel", "Personal care", "Fees & charges", "Other", "Salary", "Freelance income", "Investments", "Other income"];
type Audit = { at: number; reportId: string; reportName: string; cashbook: string; imported: number; skipped: number; effect: number };
const STEPS = ["Select", "Map", "Preview", "Result"];

function SampleImport() {
  const { id } = useParams<{ id: string }>();
  const { reports } = useReports();
  const say = useToast();
  const report = reports.find((r) => r.id === id);
  const st = report ? sampleStatement(report.id) : null;
  const [edits] = useScoped<Edits>(`review_${id}`, {});
  const [audit, setAudit] = useScoped<Audit[]>("import_audit", []);
  const [step, setStep] = useState(0);
  const [cbId, setCbId] = useState(CASHBOOKS[0].id);
  const [imported, setImported] = useScoped<string[]>(`imported_${cbId}`, []);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const [catMap, setCatMap] = useState<Record<string, string>>({});
  const [methodMap, setMethodMap] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number; effect: number } | null>(null);

  const all = useMemo(() => (st ? effective(st.txns, edits) : []), [st, edits]);
  const eligible = all.filter((t) => t.reviewed && !t.dupOf);
  const notReviewed = all.filter((t) => !t.reviewed).length;
  const dups = all.filter((t) => t.dupOf).length;
  const sel = picked ?? new Set(eligible.map((t) => t.id)); // default: everything eligible
  const chosen = eligible.filter((t) => sel.has(t.id));
  const cb = CASHBOOKS.find((c) => c.id === cbId)!;

  const plan = useMemo(() => (report ? planImport(report.id, chosen, new Set(imported)) : { toImport: [], skipped: [] }), [report, chosen, imported]);
  const effect = balanceEffect(plan.toImport);
  const catIds = [...new Set(chosen.map((t) => t.category))];
  const methods = [...new Set(chosen.map((t) => t.method))];
  const catTarget = (c: string) => catMap[c] ?? catOf(c).name;
  const methodTarget = (m: string) => methodMap[m] ?? (METHODS.includes(m) ? m : "Other");

  if (!report || !st) return <div className="card p-10 text-center"><p className="text-lg font-bold">Nothing to import</p><p className="mt-1 text-sm text-muted">Only analyzed reports can be imported.</p><Link href="/reports" className="mt-3 inline-block font-bold text-brand hover:underline">← Back to Reports</Link></div>;

  const toggle = (tid: string) => { const n = new Set(sel); if (n.has(tid)) n.delete(tid); else n.add(tid); setPicked(n); };

  const confirm = () => {
    // Idempotent: fingerprints already imported into this CashBook are skipped, so a retry never duplicates.
    const done = new Set(imported);
    plan.toImport.forEach((i) => done.add(i.fp));
    setImported([...done]);
    const res = { imported: plan.toImport.length, skipped: plan.skipped.length, effect };
    setResult(res);
    setAudit((a) => [{ at: Date.now(), reportId: report.id, reportName: report.name, cashbook: cb.name, ...res }, ...a].slice(0, 50));
    setStep(3);
    say(`Import recorded: ${res.imported} new, ${res.skipped} skipped`);
  };

  const sel_ = "h-10 rounded-xl border border-border bg-surface px-3 text-sm font-semibold outline-none focus:border-brand";
  const history = audit.filter((a) => a.reportId === report.id);

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/reports/${id}`} className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-foreground"><ArrowLeft size={15} /> {report.name}</Link>
        <h1 className="text-2xl font-extrabold tracking-tight">Import reviewed transactions into CashBook</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted"><Chip tone="warn"><FlaskConical size={11} /> Sample workspace — nothing is sent to CashBook</Chip> Sign in to import into your real CashBooks; here it only records a local audit entry.</p>
      </div>

      <ol className="grid grid-cols-4 gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined} className={clsx("flex items-center gap-2 rounded-2xl border p-3 text-sm font-bold", i === step ? "border-brand bg-brand-soft text-brand" : i < step ? "border-income/40 text-income" : "border-border text-muted")}>
            <span className={clsx("grid size-6 shrink-0 place-items-center rounded-full text-xs", i < step ? "bg-income text-white" : i === step ? "grad-brand text-white" : "bg-surface-muted")}>{i < step ? <Check size={13} /> : i + 1}</span><span className="hidden sm:inline">{s}</span>
          </li>
        ))}
      </ol>

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
              <div className="flex items-center justify-between border-b border-border p-3 text-sm"><label className="flex items-center gap-2 font-semibold"><input type="checkbox" className="size-4 accent-[#e11d48]" checked={chosen.length === eligible.length} onChange={(e) => setPicked(e.target.checked ? new Set(eligible.map((t) => t.id)) : new Set())} /> Select all</label><span className="text-muted">{chosen.length} selected</span></div>
              <ul className="max-h-[420px] divide-y divide-border overflow-y-auto">
                {eligible.map((t) => (
                  <li key={t.id}><label className="flex cursor-pointer items-center gap-3 p-3 hover:bg-surface-muted/60">
                    <input type="checkbox" className="size-4 accent-[#e11d48]" checked={sel.has(t.id)} onChange={() => toggle(t.id)} />
                    <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{t.merchantN}</span><span className="text-xs text-muted">{t.date} · {catOf(t.category).name}</span></span>
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
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Destination CashBook">{CASHBOOKS.map((c) => <button key={c.id} role="radio" aria-checked={cbId === c.id} onClick={() => setCbId(c.id)} className={clsx("rounded-full border px-4 py-2 text-sm font-semibold", cbId === c.id ? "border-brand bg-brand-soft text-brand" : "border-border hover:bg-surface-muted")}>{c.name}</button>)}</div>
            <p className="mt-2 text-xs text-muted">Sample list — sign in to see your real CashBooks.</p></div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card p-5"><h2 className="mb-3 font-bold">Map categories</h2><ul className="space-y-2.5">{catIds.map((c) => <li key={c} className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2 font-semibold"><span className="size-2.5 rounded-full" style={{ background: catOf(c).color }} />{catOf(c).name}</span><select aria-label={`CashBook category for ${catOf(c).name}`} value={catTarget(c)} onChange={(e) => setCatMap({ ...catMap, [c]: e.target.value })} className={sel_}>{CB_CATEGORIES.map((n) => <option key={n}>{n}</option>)}</select></li>)}</ul></div>
            <div className="card p-5"><h2 className="mb-3 font-bold">Map payment methods</h2><ul className="space-y-2.5">{methods.map((m) => <li key={m} className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold">{m}</span><select aria-label={`CashBook method for ${m}`} value={methodTarget(m)} onChange={(e) => setMethodMap({ ...methodMap, [m]: e.target.value })} className={sel_}>{METHODS.map((n) => <option key={n}>{n}</option>)}</select></li>)}</ul></div>
          </div>
          <div className="flex justify-between"><button onClick={() => setStep(0)} className="rounded-2xl border border-border px-5 py-3 text-sm font-bold hover:bg-surface-muted">Back</button><button onClick={() => setStep(2)} className="grad-brand inline-flex h-12 items-center gap-2 rounded-2xl px-6 text-sm font-bold text-white">Preview <ArrowRight size={16} /></button></div>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="card p-5"><p className="text-sm text-muted">Will be created</p><p className="text-2xl font-extrabold text-income">{plan.toImport.length}</p></div>
            <div className="card p-5"><p className="text-sm text-muted">Skipped (already imported)</p><p className="text-2xl font-extrabold">{plan.skipped.length}</p></div>
            <div className="card p-5"><p className="text-sm text-muted">Net effect on {cb.name}</p><p className={clsx("text-2xl font-extrabold", effect >= 0 ? "text-income" : "text-expense")}>{effect >= 0 ? "+" : "−"}{money(Math.abs(effect), 2)}</p></div>
          </div>
          <div className="card p-5">
            <h2 className="mb-3 font-bold">Balance preview · {cb.name}</h2>
            <div className="flex flex-wrap items-center gap-3 text-lg font-extrabold"><span>{money(cb.balance, 2)}</span><ArrowRight className="text-muted" size={18} /><span className={effect >= 0 ? "text-income" : "text-expense"}>{money(cb.balance + effect, 2)}</span></div>
            <p className="mt-1 text-xs text-muted">Existing CashBook transactions are never changed or overwritten; imported rows are added as new entries linked to this statement.</p>
          </div>
          {plan.skipped.length > 0 && <div role="status" className="card flex gap-3 border-warning/40 p-4 text-sm"><History className="shrink-0 text-warning" size={18} /><p><strong>{plan.skipped.length} transaction{plan.skipped.length === 1 ? "" : "s"}</strong> from this statement were already imported into {cb.name} and will be skipped — importing twice never creates duplicates.</p></div>}
          <label className="card flex cursor-pointer items-start gap-3 p-4 text-sm"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-4 accent-[#e11d48]" /><span>I&apos;ve reviewed these transactions and want to import them into <strong>{cb.name}</strong>.</span></label>
          <div className="flex justify-between"><button onClick={() => setStep(1)} className="rounded-2xl border border-border px-5 py-3 text-sm font-bold hover:bg-surface-muted">Back</button><button disabled={!confirmed} onClick={confirm} className="grad-brand inline-flex h-12 items-center gap-2 rounded-2xl px-6 text-sm font-bold text-white disabled:opacity-50"><ShieldCheck size={16} /> Confirm import</button></div>
        </section>
      )}

      {step === 3 && result && (
        <section className="space-y-4">
          <div className="card border-income/40 p-8 text-center">
            <span className="grad-income mx-auto grid size-16 place-items-center rounded-2xl text-white"><CheckCircle2 size={32} /></span>
            <h2 className="mt-4 text-2xl font-extrabold">Import recorded</h2>
            <p className="mt-1 text-muted"><strong className="text-income">{result.imported}</strong> new · <strong>{result.skipped}</strong> skipped · <strong>0</strong> errors · net {result.effect >= 0 ? "+" : "−"}{money(Math.abs(result.effect), 2)} to {cb.name}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button onClick={() => { setStep(0); setConfirmed(false); setResult(null); setPicked(null); }} className="rounded-xl border border-border px-4 py-2.5 text-sm font-bold hover:bg-surface-muted">Import again (retry-safe)</button>
              <Link href={`/reports/${id}`} className="grad-brand rounded-xl px-5 py-2.5 text-sm font-bold text-white">Back to report</Link>
            </div>
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section className="card p-5" aria-labelledby="aud-h">
          <h2 id="aud-h" className="mb-3 flex items-center gap-2 font-bold"><History size={17} className="text-brand" /> Import history (audit)</h2>
          <ul className="divide-y divide-border text-sm">{history.map((a) => <li key={a.at} className="flex flex-wrap items-center justify-between gap-2 py-2.5"><span>{new Date(a.at).toLocaleString("en-IN")} → <strong>{a.cashbook}</strong></span><span className="text-muted">{a.imported} imported · {a.skipped} skipped</span></li>)}</ul>
        </section>
      )}
    </div>
  );
}

export default function ImportPage() {
  const { id } = useParams<{ id: string }>();
  const { reports, live, loading } = useReports();
  const report = reports.find((r) => r.id === id);
  if (!live) return <SampleImport />;
  if (loading && !report) return <div role="status" className="card p-10 text-center text-sm text-muted">Loading…</div>;
  if (!report) return <div className="card p-10 text-center"><p className="text-lg font-bold">Nothing to import</p><p className="mt-1 text-sm text-muted">Only analyzed reports can be imported.</p><Link href="/reports" className="mt-3 inline-block font-bold text-brand hover:underline">← Back to Reports</Link></div>;
  return <LiveImport report={report} />;
}
