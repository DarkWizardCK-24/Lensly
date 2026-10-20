"use client";

import { AlertTriangle, CheckCheck, Copy, Download, Pencil, ScanText, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { CATEGORIES, EXPENSE_CATS, INCOME_CATS, catOf } from "@/lib/categories";
import { downloadCsv, minorToDecimal } from "@/lib/csv";
import { effective, type EffTxn, type Edits, type Statement } from "@/lib/statement";
import { Bar, Chip, money, useToast } from "./ui";

const PAGE = 25;
const fmtDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" });

const isLow = (t: EffTxn) => t.confidence < 0.8;
const needsAttention = (t: EffTxn) => !!t.dupOf || isLow(t);

function Flags({ t }: { t: EffTxn }) {
  return (
    <span className="flex flex-wrap gap-1">
      {t.dupOf && <Chip tone="bad" title="Same date, amount and merchant as an earlier debit"><Copy size={11} /> Possible duplicate</Chip>}
      {isLow(t) && <Chip tone={t.confidence < 0.6 ? "bad" : "warn"} title="Extracted with OCR — please check the values"><ScanText size={11} /> {Math.round(t.confidence * 100)}% sure</Chip>}
      {t.edited && <Chip tone="brand"><Pencil size={11} /> Corrected</Chip>}
      {t.reviewed && <Chip tone="ok"><CheckCheck size={11} /> Reviewed</Chip>}
    </span>
  );
}

function EditableMerchant({ t, onSave }: { t: EffTxn; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(t.merchantN);
  if (!editing) {
    return (
      <button onClick={() => { setV(t.merchantN); setEditing(true); }} className="group inline-flex items-center gap-1.5 text-left font-bold hover:text-brand" aria-label={`Edit merchant ${t.merchantN}`}>
        {t.merchantN}<Pencil size={12} className="opacity-0 transition group-hover:opacity-70" />
      </button>
    );
  }
  const done = () => { setEditing(false); if (v.trim() && v.trim() !== t.merchantN) onSave(v.trim()); };
  return <input autoFocus value={v} maxLength={60} onChange={(e) => setV(e.target.value)} onBlur={done} onKeyDown={(e) => { if (e.key === "Enter") done(); if (e.key === "Escape") setEditing(false); }} aria-label="Merchant" className="h-8 w-40 rounded-lg border border-brand bg-surface px-2 text-sm outline-none" />;
}

function CategorySelect({ t, onChange }: { t: EffTxn; onChange: (c: string) => void }) {
  const list = t.credit ? INCOME_CATS : EXPENSE_CATS;
  const suggested = t.category === t.suggested && !t.edited;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="size-2.5 shrink-0 rounded-full" style={{ background: catOf(t.category).color }} />
      <select value={t.category} onChange={(e) => onChange(e.target.value)} aria-label={`Category for ${t.merchantN}`} className={clsx("h-8 rounded-lg border border-border bg-surface px-1.5 text-xs font-semibold", suggested && "italic")} title={suggested ? "System-suggested category" : "Your category"}>
        {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </span>
  );
}

export function ReviewWorkspace({ reportName, statement, edits, setEdits }: { reportName: string; statement: Statement; edits: Edits; setEdits: (u: Edits | ((p: Edits) => Edits)) => void }) {
  const say = useToast();
  const all = useMemo(() => effective(statement.txns, edits), [statement, edits]);
  const [q, setQ] = useState("");
  const [type, setType] = useState<"all" | "debit" | "credit">("all");
  const [cat, setCat] = useState("all");
  const [only, setOnly] = useState<"all" | "attention" | "unreviewed">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState<Set<string>>(new Set());

  const rows = useMemo(() => all.filter((t) => {
    if (type === "debit" && !t.debit) return false;
    if (type === "credit" && !t.credit) return false;
    if (cat !== "all" && t.category !== cat) return false;
    if (only === "attention" && !needsAttention(t)) return false;
    if (only === "unreviewed" && t.reviewed) return false;
    if (from && t.date < from) return false;
    if (to && t.date > to) return false;
    const s = q.trim().toLowerCase();
    return !s || t.raw.toLowerCase().includes(s) || t.merchantN.toLowerCase().includes(s) || t.ref.toLowerCase().includes(s);
  }), [all, q, type, cat, only, from, to]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const p = Math.min(page, pages - 1);
  const shown = rows.slice(p * PAGE, p * PAGE + PAGE);
  const reviewed = all.filter((t) => t.reviewed).length;
  const attention = all.filter(needsAttention).length;
  const allShownSelected = shown.length > 0 && shown.every((t) => sel.has(t.id));

  const patch = (ids: string[], f: (e: Edits[string]) => Edits[string]) => setEdits((cur) => { const n = { ...cur }; for (const id of ids) n[id] = f(n[id] ?? {}); return n; });
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleAll = () => setSel((s) => { const n = new Set(s); if (allShownSelected) shown.forEach((t) => n.delete(t.id)); else shown.forEach((t) => n.add(t.id)); return n; });
  const ids = [...sel];

  const exportCsv = () => {
    const src = sel.size ? all.filter((t) => sel.has(t.id)) : rows;
    downloadCsv(`${reportName}-transactions.csv`, [
      ["Date", "Original description", "Merchant", "Category", "Debit", "Credit", "Balance", "Confidence", "Reviewed", "Edited"],
      ...src.map((t) => [t.date, t.raw, t.merchantN, catOf(t.category).name, minorToDecimal(t.debit), minorToDecimal(t.credit), t.balance === null ? "" : minorToDecimal(t.balance), t.confidence.toFixed(2), t.reviewed ? "yes" : "no", t.edited ? "yes" : "no"]),
    ]);
    say(`Exported ${src.length} transaction${src.length === 1 ? "" : "s"}`);
  };

  const sel_ = "h-10 rounded-xl border border-border bg-surface px-3 text-sm outline-none focus:border-brand";
  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm"><strong>{reviewed}</strong> of {all.length} reviewed · <strong className={attention ? "text-warning" : ""}>{attention}</strong> need attention</p>
          <div className="w-48"><Bar value={all.length ? reviewed / all.length : 0} gradient="grad-income" /></div>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="relative"><Search size={15} className="pointer-events-none absolute left-3 top-3 text-muted" aria-hidden />
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search description, merchant, ref…" aria-label="Search transactions" className={clsx(sel_, "w-64 pl-9")} /></label>
          <select value={type} onChange={(e) => { setType(e.target.value as typeof type); setPage(0); }} aria-label="Type" className={sel_}><option value="all">Debits & credits</option><option value="debit">Debits only</option><option value="credit">Credits only</option></select>
          <select value={cat} onChange={(e) => { setCat(e.target.value); setPage(0); }} aria-label="Category filter" className={sel_}><option value="all">All categories</option>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select value={only} onChange={(e) => { setOnly(e.target.value as typeof only); setPage(0); }} aria-label="Status filter" className={sel_}><option value="all">All statuses</option><option value="attention">Needs attention</option><option value="unreviewed">Not reviewed</option></select>
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(0); }} aria-label="From date" className={sel_} />
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(0); }} aria-label="To date" className={sel_} />
          <button onClick={exportCsv} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-bold hover:bg-surface-muted"><Download size={15} /> Export {sel.size ? `${sel.size} selected` : "filtered"}</button>
        </div>
      </div>

      {sel.size > 0 && (
        <div role="region" aria-label="Bulk actions" className="card sticky top-16 z-10 flex flex-wrap items-center gap-3 border-brand/40 p-3 lg:top-3">
          <strong className="text-sm">{sel.size} selected</strong>
          <select defaultValue="" onChange={(e) => { if (e.target.value) { patch(ids, (x) => ({ ...x, category: e.target.value })); say(`Category set for ${ids.length}`); e.target.value = ""; } }} aria-label="Bulk category" className={sel_}>
            <option value="" disabled>Set category…</option>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={() => { patch(ids, (x) => ({ ...x, reviewed: true })); say(`Marked ${ids.length} reviewed`); }} className="inline-flex h-10 items-center gap-2 rounded-xl bg-income px-4 text-sm font-bold text-white"><CheckCheck size={15} /> Mark reviewed</button>
          <button onClick={() => setSel(new Set())} className="ml-auto inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-surface-muted"><X size={15} /> Clear</button>
        </div>
      )}

      {/* Desktop / tablet table */}
      <div className="card hidden overflow-x-auto md:block">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="w-10 p-3"><input type="checkbox" checked={allShownSelected} onChange={toggleAll} aria-label="Select all on this page" className="size-4 accent-[#e11d48]" /></th>
              <th className="p-3">Date</th><th className="p-3">Merchant / original</th><th className="p-3">Category</th>
              <th className="p-3 text-right">Debit</th><th className="p-3 text-right">Credit</th><th className="p-3 text-right">Balance</th><th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((t) => (
              <tr key={t.id} className={clsx("border-b border-border/60 align-top transition hover:bg-surface-muted/60", sel.has(t.id) && "bg-brand-soft/60", t.dupOf && "bg-expense/5")}>
                <td className="p-3"><input type="checkbox" checked={sel.has(t.id)} onChange={() => toggle(t.id)} aria-label={`Select ${t.merchantN} ${fmtDate(t.date)}`} className="size-4 accent-[#e11d48]" /></td>
                <td className="whitespace-nowrap p-3 text-muted">{fmtDate(t.date)}</td>
                <td className="p-3"><EditableMerchant t={t} onSave={(v) => patch([t.id], (x) => ({ ...x, merchant: v }))} />
                  <p className="mt-0.5 max-w-[260px] truncate font-mono text-[11px] text-muted" title={`Original: ${t.raw}`}>Original: {t.raw}</p></td>
                <td className="p-3"><CategorySelect t={t} onChange={(c) => patch([t.id], (x) => ({ ...x, category: c }))} /></td>
                <td className="p-3 text-right font-semibold text-expense">{t.debit ? money(t.debit, 2) : ""}</td>
                <td className="p-3 text-right font-semibold text-income">{t.credit ? money(t.credit, 2) : ""}</td>
                <td className="p-3 text-right text-muted">{t.balance === null ? "—" : money(t.balance, 2)}</td>
                <td className="p-3"><div className="flex flex-col items-start gap-1.5"><Flags t={t} />
                  {!t.reviewed && <button onClick={() => patch([t.id], (x) => ({ ...x, reviewed: true }))} className="text-xs font-bold text-brand hover:underline">Mark reviewed</button>}</div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {shown.map((t) => (
          <div key={t.id} className={clsx("card p-4", sel.has(t.id) && "ring-2 ring-brand", t.dupOf && "border-expense/40")}>
            <div className="flex items-start gap-3">
              <input type="checkbox" checked={sel.has(t.id)} onChange={() => toggle(t.id)} aria-label={`Select ${t.merchantN}`} className="mt-1 size-5 accent-[#e11d48]" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <EditableMerchant t={t} onSave={(v) => patch([t.id], (x) => ({ ...x, merchant: v }))} />
                  <span className={clsx("shrink-0 font-extrabold", t.credit ? "text-income" : "text-expense")}>{t.credit ? "+" : "−"}{money(t.credit || t.debit, 2)}</span>
                </div>
                <p className="text-xs text-muted">{fmtDate(t.date)}{t.balance === null ? "" : ` · Balance ${money(t.balance, 2)}`}</p>
                <p className="mt-0.5 truncate font-mono text-[11px] text-muted">Original: {t.raw}</p>
                <div className="mt-2"><CategorySelect t={t} onChange={(c) => patch([t.id], (x) => ({ ...x, category: c }))} /></div>
                <div className="mt-2 flex flex-wrap items-center gap-2"><Flags t={t} />
                  {!t.reviewed && <button onClick={() => patch([t.id], (x) => ({ ...x, reviewed: true }))} className="text-xs font-bold text-brand">Mark reviewed</button>}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {rows.length === 0 && (
        <div className="card grid place-items-center p-10 text-center"><AlertTriangle className="text-muted" /><p className="mt-2 font-bold">No transactions match</p><p className="text-sm text-muted">Clear a filter or search term.</p></div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-muted">{rows.length ? `${p * PAGE + 1}–${Math.min(rows.length, p * PAGE + PAGE)} of ${rows.length}` : "0 results"}</span>
        <div className="flex gap-2">
          <button disabled={p === 0} onClick={() => setPage(p - 1)} className="rounded-xl border border-border px-4 py-2 font-semibold hover:bg-surface-muted disabled:opacity-40">Previous</button>
          <button disabled={p >= pages - 1} onClick={() => setPage(p + 1)} className="rounded-xl border border-border px-4 py-2 font-semibold hover:bg-surface-muted disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}
