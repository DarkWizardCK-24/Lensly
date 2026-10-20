"use client";

import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CalendarClock, CheckCircle2, CircleHelp, Copy, Equal, Minus, Plus, ScanText, ThumbsDown, ThumbsUp, TrendingUp, Wallet } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { clsx } from "clsx";
import { catOf } from "@/lib/categories";
import { detectRecurring, spendingPatterns, type EffTxn, type Recon, type Rec, type Statement, type Summary } from "@/lib/statement";
import { Bar, Chip, Kpi, money } from "./ui";

const dshort = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

// ------------------------------------------------------------------ overview
export function OverviewPanel({ st, txns, s }: { st: Statement; txns: EffTxn[]; s: Summary }) {
  const recurring = detectRecurring(txns);
  const fees = txns.filter((t) => t.category === "fees" && t.debit);
  const dups = txns.filter((t) => t.dupOf);
  const low = txns.filter((t) => t.confidence < 0.8);
  const ocr = st.txns.some((t) => t.source === "ocr");
  const merchants = [...txns.filter((t) => t.debit).reduce((m, t) => m.set(t.merchantN, (m.get(t.merchantN) ?? 0) + t.debit), new Map<string, number>())].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const days = Math.max(1, Math.round((Date.parse(st.meta.end) - Date.parse(st.meta.start)) / 86_400_000) + 1);

  return (
    <div className="space-y-4">
      {ocr && (
        <div role="status" className="card flex items-start gap-3 border-warning/40 p-4 text-sm">
          <ScanText className="mt-0.5 shrink-0 text-warning" size={18} aria-hidden />
          <p><strong>Scanned statement — OCR was used.</strong> {low.length} row{low.length === 1 ? " has" : "s have"} lower confidence. Check the highlighted values in the Transactions tab before relying on the totals.</p>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Money in" value={money(s.credits)} icon={ArrowDownLeft} tone="grad-income" sub={`${txns.filter((t) => t.credit).length} credits`} />
        <Kpi label="Money out" value={money(s.debits)} icon={ArrowUpRight} tone="grad-expense" sub={`${txns.filter((t) => t.debit).length} debits`} />
        <Kpi label={s.net >= 0 ? "Net saved" : "Net overspent"} value={money(Math.abs(s.net))} icon={Wallet} tone="grad-gold" sub={`Avg ${money(s.avgDaily)}/day out`} />
        <Kpi label="Balance" value={`${st.meta.opening === null ? "—" : money(st.meta.opening)} → ${st.meta.closing === null ? "—" : money(st.meta.closing)}`} icon={TrendingUp} tone="grad-sky" sub="Opening → closing (as printed)" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="font-bold">Spending by category</h3>
          <p className="text-sm text-muted">{dshort(st.meta.start)} – {dshort(st.meta.end)} · {days} days</p>
          <div className="mt-4 grid items-center gap-4 sm:grid-cols-[170px_1fr]">
            <div className="relative mx-auto h-[170px] w-[170px]" role="img" aria-label="Donut chart of spending by category">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={s.byCategory.map(([id, v]) => ({ name: catOf(id).name, value: v, color: catOf(id).color }))} dataKey="value" innerRadius={58} outerRadius={82} paddingAngle={3} cornerRadius={6} stroke="none" animationDuration={800}>
                  {s.byCategory.map(([id]) => <Cell key={id} fill={catOf(id).color} />)}</Pie></PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center"><div><p className="text-xs text-muted">Total out</p><p className="text-sm font-extrabold">{money(s.debits)}</p></div></div>
            </div>
            <ul className="space-y-2.5">
              {s.byCategory.slice(0, 6).map(([id, v]) => (
                <li key={id}>
                  <div className="mb-1 flex justify-between gap-2 text-sm"><span className="flex items-center gap-2 font-semibold"><span className="size-2.5 rounded-full" style={{ background: catOf(id).color }} />{catOf(id).name}</span><span className="text-muted">{money(v)} · {Math.round((v / s.debits) * 100)}%</span></div>
                  <Bar value={v / s.debits} color={catOf(id).color} />
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-bold">Top merchants</h3>
          <p className="text-sm text-muted">Where most of the money went</p>
          <ul className="mt-4 space-y-3">
            {merchants.map(([m, v], i) => (
              <li key={m}><div className="mb-1 flex items-center justify-between gap-2 text-sm"><span className="flex items-center gap-2 font-semibold"><span className="grad-gold grid size-5 place-items-center rounded-md text-[10px] font-extrabold text-white">{i + 1}</span>{m}</span><span className="font-bold">{money(v)}</span></div>
                <Bar value={v / merchants[0][1]} gradient="grad-gold" /></li>
            ))}
          </ul>
        </div>
      </div>

      <PatternsPanel txns={txns} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-1">
          <h3 className="flex items-center gap-2 font-bold"><CalendarClock size={18} className="text-brand" /> Recurring payments</h3>
          {recurring.length ? (
            <ul className="mt-3 space-y-2.5 text-sm">{recurring.map((r) => (
              <li key={r.merchant} className="flex items-center justify-between gap-2"><span className="font-semibold">{r.merchant}<span className="block text-xs font-normal text-muted">{r.count}× {r.every}</span></span><span className="text-right"><span className="block font-bold">{money(r.amount)}</span><Chip tone="warn">Probable</Chip></span></li>))}</ul>
          ) : <p className="mt-3 text-sm text-muted">No repeating payments found. Recurring patterns need at least two statement periods — upload more history for this account.</p>}
        </div>
        <div className="card p-5 lg:col-span-2">
          <h3 className="flex items-center gap-2 font-bold"><AlertTriangle size={18} className="text-warning" /> Worth a look</h3>
          <p className="text-sm text-muted">Review suggestions — not accusations.</p>
          <ul className="mt-3 space-y-3 text-sm">
            <li className="flex gap-3"><Copy size={16} className="mt-0.5 shrink-0 text-expense" /><span>{dups.length ? <><strong>{dups.length} possible duplicate debit{dups.length === 1 ? "" : "s"}</strong> ({money(dups.reduce((a, t) => a + t.debit, 0), 2)}): same date, amount and merchant as an earlier charge.</> : "No duplicate-looking debits found."}</span></li>
            <li className="flex gap-3"><Minus size={16} className="mt-0.5 shrink-0 text-muted" /><span>{fees.length ? <><strong>{fees.length} bank fee{fees.length === 1 ? "" : "s"}</strong> totalling {money(fees.reduce((a, t) => a + t.debit, 0), 2)}.</> : "No bank fees on this statement."}</span></li>
            <li className="flex gap-3"><ScanText size={16} className="mt-0.5 shrink-0 text-warning" /><span>{low.length ? <><strong>{low.length} low-confidence row{low.length === 1 ? "" : "s"}</strong> need a manual check.</> : "All rows were extracted with high confidence."}</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ patterns
function CashflowLine({ points }: { points: { date: string; net: number }[] }) {
  const w = 320, h = 110, pad = 6;
  const nets = points.map((p) => p.net);
  const lo = Math.min(0, ...nets), hi = Math.max(0, ...nets), span = hi - lo || 1;
  const x = (i: number) => pad + (points.length === 1 ? (w - 2 * pad) / 2 : (i / (points.length - 1)) * (w - 2 * pad));
  const y = (v: number) => pad + (1 - (v - lo) / span) * (h - 2 * pad);
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-28 w-full" role="img" aria-label={`Cumulative cash flow across ${points.length} active days, ending at ${last.net < 0 ? "−" : ""}${money(Math.abs(last.net))}`}>
      <line x1={pad} x2={w - pad} y1={y(0)} y2={y(0)} stroke="currentColor" strokeOpacity={0.25} strokeDasharray="4 4" />
      <polyline fill="none" stroke={last.net >= 0 ? "var(--income, #0a7040)" : "var(--expense, #c0231a)"} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" points={points.map((p, i) => `${x(i)},${y(p.net)}`).join(" ")} />
      <circle cx={x(points.length - 1)} cy={y(last.net)} r={4} fill={last.net >= 0 ? "var(--income, #0a7040)" : "var(--expense, #c0231a)"} />
    </svg>
  );
}

export function PatternsPanel({ txns }: { txns: EffTxn[] }) {
  const p = spendingPatterns(txns);
  if (!p.cashflow.length) return null;
  const maxDay = Math.max(1, ...p.weekdays.map((d) => d.total));
  const busiest = p.weekdays.reduce((a, b) => (b.total > a.total ? b : a));
  const end = p.cashflow[p.cashflow.length - 1];
  return (
    <section aria-labelledby="patterns-h" className="space-y-4">
      <h3 id="patterns-h" className="text-lg font-extrabold">Spending patterns</h3>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <h4 className="font-bold">By day of week</h4>
          <p className="text-sm text-muted">{busiest.total ? <>{busiest.label} is your heaviest day ({money(busiest.total)})</> : "No debits to chart"}</p>
          <ul className="mt-3 space-y-2">
            {p.weekdays.map((d) => (
              <li key={d.label} className="grid grid-cols-[34px_1fr_auto] items-center gap-2 text-sm">
                <span className="font-semibold">{d.label}</span>
                <Bar value={d.total / maxDay} gradient={d.label === busiest.label && d.total ? "grad-brand" : "grad-gold"} />
                <span className="text-right text-muted">{money(d.total)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-5">
          <h4 className="font-bold">Largest payments</h4>
          <p className="text-sm text-muted">{p.peakDay ? <>Peak day {dshort(p.peakDay.date)}: {money(p.peakDay.total)}</> : "No debits"}</p>
          <ol className="mt-3 space-y-2.5 text-sm">
            {p.largest.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-2">
                <span className="min-w-0"><span className="block truncate font-semibold">{t.merchantN}</span><span className="text-xs text-muted">{dshort(t.date)} · {catOf(t.category).name}</span></span>
                <span className="shrink-0 font-bold">{money(t.debit)}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="card p-5">
          <h4 className="font-bold">Cash flow over time</h4>
          <p className="text-sm text-muted">Running net since the first transaction: <strong className={`whitespace-nowrap ${end.net >= 0 ? "text-income" : "text-expense"}`}>{end.net < 0 ? "−" : "+"}{money(Math.abs(end.net))}</strong></p>
          <div className="mt-3"><CashflowLine points={p.cashflow} /></div>
          <p className="mt-1 flex justify-between text-xs text-muted"><span>{dshort(p.cashflow[0].date)}</span><span>{dshort(end.date)}</span></p>
        </div>
      </div>
    </section>
  );
}

// ----------------------------------------------------------- reconciliation
const STATUS = {
  reconciled: { label: "Reconciled", tone: "ok" as const, text: "Opening balance + credits − debits equals the closing balance, and every running balance matches." },
  warnings: { label: "Reconciled with warnings", tone: "warn" as const, text: "The totals match, but some running balances on the statement don't follow from the previous row. The rows are listed below — likely an extraction or print error." },
  not_reconciled: { label: "Not reconciled", tone: "bad" as const, text: "The extracted transactions don't add up to the statement's closing balance. Something may be missing or misread — the difference is shown, not hidden." },
  unknown: { label: "Unable to reconcile", tone: "muted" as const, text: "This statement doesn't provide a closing balance, so it can't be checked." },
};

function Row({ label, value, sign: Sign, strong }: { label: string; value: string; sign?: typeof Plus; strong?: boolean }) {
  return (
    <div className={clsx("flex items-center justify-between gap-3 py-2.5", strong && "border-t border-border pt-4 font-extrabold")}>
      <span className="flex items-center gap-2 text-muted">{Sign && <Sign size={14} aria-hidden />}{label}</span>
      <span className={strong ? "text-lg" : "font-semibold"}>{value}</span>
    </div>
  );
}

export function ReconPanel({ st, r }: { st: Statement; r: Recon }) {
  const S = STATUS[r.status];
  const tone = { ok: "border-income/40", warn: "border-warning/50", bad: "border-expense/40", muted: "border-border" }[S.tone];
  return (
    <div className="space-y-4">
      <div className={clsx("card p-5", tone)}>
        <div className="flex flex-wrap items-center gap-3"><Chip tone={S.tone}>{r.status === "reconciled" ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />} {S.label}</Chip></div>
        <p className="mt-2 text-sm">{S.text}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-2 font-bold">Balance check</h3>
          <Row label={`Opening balance${st.meta.openingSource === "derived" ? " (derived from the first row)" : ""}`} value={st.meta.opening === null ? "Not provided" : money(st.meta.opening, 2)} />
          <Row label="Total credits" value={money(r.credits, 2)} sign={Plus} />
          <Row label="Total debits" value={money(r.debits, 2)} sign={Minus} />
          <Row label="Expected closing" value={st.meta.opening === null ? "—" : money(r.expectedClosing, 2)} sign={Equal} strong />
          <Row label="Closing on the statement" value={r.statementClosing === null ? "Not provided" : money(r.statementClosing, 2)} />
          <div className={clsx("mt-2 rounded-xl p-3 text-sm font-bold", r.difference === 0 && r.statementClosing !== null ? "bg-income/10 text-income" : r.statementClosing === null ? "bg-surface-muted text-muted" : "bg-expense/10 text-expense")}>
            {r.statementClosing === null ? "No closing balance to compare." : r.difference === 0 ? "Difference: ₹0.00 — balances agree." : `Difference: ${money(r.difference, 2)} (statement ${r.difference > 0 ? "higher" : "lower"} than the extracted total).`}
          </div>
        </div>
        <div className="card p-5">
          <h3 className="mb-2 font-bold">How we check</h3>
          <ul className="space-y-2 text-sm text-muted">
            <li><strong className="text-foreground">Sign convention:</strong> credits add to the balance and debits subtract, as printed on this statement.</li>
            <li><strong className="text-foreground">Transactions extracted:</strong> {st.txns.length}.</li>
            <li><strong className="text-foreground">Running balances:</strong> each row is compared with the previous printed balance ± its own amount.</li>
            {st.meta.openingSource === "derived" && <li><strong className="text-foreground">Weaker check:</strong> the opening balance was worked out from the first row, not printed, so only the chain of running balances is really being verified.</li>}
            <li>We never adjust or invent transactions to force a match.</li>
          </ul>
        </div>
      </div>
      {r.rowIssues.length > 0 && (
        <div className="card overflow-x-auto p-5">
          <h3 className="mb-3 font-bold">Rows whose running balance doesn&apos;t follow ({r.rowIssues.length})</h3>
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted"><th className="py-2">Row</th><th>Date</th><th>Description</th><th className="text-right">Expected</th><th className="text-right">Printed</th></tr></thead>
            <tbody>{r.rowIssues.map((i) => { const t = st.txns[i.index]; return (
              <tr key={i.id} className="border-b border-border/60"><td className="py-2.5">#{i.index + 1}</td><td>{dshort(t.date)}</td><td className="max-w-[220px] truncate">{t.raw}</td><td className="text-right">{money(i.expected, 2)}</td><td className="text-right font-bold text-expense">{money(i.printed, 2)}</td></tr>); })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------ recommendations
export type RecState = { status: "new" | "reviewed" | "dismissed" | "completed"; helpful?: boolean | null };
const PRI = { high: "bad", medium: "warn", low: "muted" } as const;
const CONF = { high: "ok", medium: "warn", low: "muted" } as const;

export function RecsPanel({ recs, state, setState, tooLittle }: { recs: Rec[]; state: Record<string, RecState>; setState: (k: string, s: Partial<RecState>) => void; tooLittle: boolean }) {
  const get = (k: string): RecState => state[k] ?? { status: "new" };
  const open = recs.filter((r) => get(r.key).status !== "dismissed");
  const potential = open.reduce((a, r) => a + (r.savings?.minor ?? 0), 0);
  const realized = recs.filter((r) => get(r.key).status === "completed").reduce((a, r) => a + (r.savings?.minor ?? 0), 0);

  if (tooLittle || recs.length === 0) {
    return <div className="card grid place-items-center p-10 text-center"><CircleHelp className="text-muted" size={28} /><p className="mt-2 text-lg font-bold">{tooLittle ? "Not enough data yet" : "Nothing stands out"}</p><p className="mt-1 max-w-md text-sm text-muted">{tooLittle ? "This statement has too few transactions to draw reliable conclusions. Add more history and we'll look again." : "We didn't find anything worth flagging in this period."}</p></div>;
  }
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label="Potential savings (upper bound)" value={money(potential)} icon={TrendingUp} tone="grad-gold" sub="Estimates, not promises" />
        <Kpi label="Marked as done" value={money(realized)} icon={CheckCircle2} tone="grad-income" sub="From completed ideas" />
        <Kpi label="Ideas" value={`${open.length} open`} icon={CircleHelp} tone="grad-sky" sub={`${recs.length - open.length} dismissed`} />
      </div>
      {recs.map((r) => {
        const st = get(r.key);
        return (
          <article key={r.key} className={clsx("card p-5", st.status === "dismissed" && "opacity-55")}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="text-lg font-extrabold">{r.title}</h3><p className="mt-1 text-sm text-muted">{r.explanation}</p></div>
              <div className="flex flex-wrap gap-1.5"><Chip tone={PRI[r.priority]}>{r.priority} priority</Chip><Chip tone={CONF[r.confidence]}>{r.confidence} confidence</Chip></div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div><p className="text-xs font-bold uppercase tracking-wide text-muted">Evidence · {r.range}</p>
                <ul className="mt-2 space-y-1 text-sm">{r.evidence.map((e) => <li key={e} className="flex gap-2"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />{e}</li>)}</ul></div>
              <div className="space-y-2 text-sm">
                <p><span className="text-muted">Observed spend:</span> <strong>{money(r.currentSpend, 2)}</strong></p>
                <p><span className="text-muted">Suggested action:</span> {r.action}</p>
                {r.savings && <p className="rounded-xl bg-warning/10 p-3"><span className="font-bold">Estimated saving: up to {money(r.savings.minor, 2)}</span><span className="mt-0.5 block text-xs text-muted">Assumption: {r.savings.assumption}</span></p>}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              {(["new", "reviewed", "completed", "dismissed"] as const).map((s) => (
                <button key={s} onClick={() => setState(r.key, { status: s })} aria-pressed={st.status === s} className={clsx("rounded-full border px-3.5 py-1.5 text-xs font-bold capitalize transition", st.status === s ? "border-brand bg-brand-soft text-brand" : "border-border hover:bg-surface-muted")}>{s}</button>
              ))}
              <span className="ml-auto flex items-center gap-1.5 text-xs text-muted">Helpful?
                <button onClick={() => setState(r.key, { helpful: st.helpful === true ? null : true })} aria-pressed={st.helpful === true} aria-label="Helpful" className={clsx("grid size-8 place-items-center rounded-lg border border-border hover:bg-surface-muted", st.helpful === true && "border-income bg-income/10 text-income")}><ThumbsUp size={14} /></button>
                <button onClick={() => setState(r.key, { helpful: st.helpful === false ? null : false })} aria-pressed={st.helpful === false} aria-label="Not helpful" className={clsx("grid size-8 place-items-center rounded-lg border border-border hover:bg-surface-muted", st.helpful === false && "border-expense bg-expense/10 text-expense")}><ThumbsDown size={14} /></button>
              </span>
            </div>
          </article>
        );
      })}
      <p className="text-xs text-muted">Suggestions are based only on this statement. They are not tax, investment, credit or legal advice, and nothing is changed in your accounts.</p>
    </div>
  );
}
