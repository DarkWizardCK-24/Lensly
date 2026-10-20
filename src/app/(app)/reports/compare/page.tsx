"use client";

import { AlertTriangle, ArrowLeft, GitCompareArrows, Minus, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Bar as RBar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Chip, money } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { catOf } from "@/lib/categories";
import { useReports } from "@/lib/reports";
import { readScoped } from "@/lib/scoped";
import { daysBetween, effective, sampleStatement, summarize, type Edits } from "@/lib/statement";

function Compare() {
  const { reports, live } = useReports();
  const { session, getToken } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const analyzable = live ? reports : reports.filter((r) => sampleStatement(r.id));
  const a = analyzable.find((r) => r.id === params.get("a")) ?? null;
  const b = analyzable.find((r) => r.id === params.get("b")) ?? null;

  const load = (id: string | undefined) => {
    const st = id ? sampleStatement(id) : null;
    if (!st) return null;
    const days = daysBetween(st.meta.start, st.meta.end) + 1;
    return { st, days, s: summarize(effective(st.txns, readScoped<Edits>(session?.userId, `review_${id}`, {})), days) };
  };
  const localA = useMemo(() => (live ? null : load(a?.id)), [a?.id, live]); // eslint-disable-line react-hooks/exhaustive-deps
  const localB = useMemo(() => (live ? null : load(b?.id)), [b?.id, live]); // eslint-disable-line react-hooks/exhaustive-deps

  // Signed in: the server does the comparison from the corrected data.
  type Side = { days: number; s: { credits: number; debits: number; net: number; count: number; avgDaily: number; byCategory: [string, number][] } };
  type Served = { a: Side; b: Side; categories: { category: string; name: string; a: number; b: number }[]; comparable: boolean };
  const [served, setServed] = useState<{ key: string; data?: Served; error?: string } | null>(null);
  const pairKey = a && b ? `${a.id}|${b.id}` : "";
  useEffect(() => {
    if (!live || !a || !b) return;
    let alive = true;
    (async () => {
      try {
        const t = await getToken();
        if (!t) return;
        type Raw = { days: number; credits: number; debits: number; net: number; avg_daily: number; count: number; by_category: Record<string, number> };
        const r = await apiFetch<{ a: Raw; b: Raw; categories: Served["categories"]; comparable: boolean }>(t, "/reports/compare", { query: { a: a.id, b: b.id } });
        const side = (x: Raw): Side => ({ days: x.days, s: { credits: x.credits, debits: x.debits, net: x.net, count: x.count, avgDaily: x.avg_daily, byCategory: Object.entries(x.by_category) } });
        if (alive) setServed({ key: pairKey, data: { a: side(r.a), b: side(r.b), categories: r.categories, comparable: r.comparable } });
      } catch (e) {
        if (alive) setServed({ key: pairKey, error: e instanceof ApiError ? e.message : "Could not compare these reports." });
      }
    })();
    return () => { alive = false; };
  }, [live, a, b, pairKey, getToken]);
  const cur = served?.key === pairKey ? served : null;
  const A = live ? cur?.data?.a ?? null : localA;
  const B = live ? cur?.data?.b ?? null : localB;

  const set = (k: "a" | "b", v: string) => { const p = new URLSearchParams(params.toString()); if (v) p.set(k, v); else p.delete(k); router.replace(`/reports/compare?${p}`); };
  const sel = "h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm font-semibold outline-none focus:border-brand";

  const lengthGap = A && B ? Math.abs(A.days - B.days) / Math.max(A.days, B.days) : 0;
  const comparable = live && cur?.data ? cur.data.comparable : lengthGap <= 0.2;

  const delta = (x: number, y: number, goodUp: boolean) => {
    if (x === 0) return <span className="text-muted">—</span>;
    const pct = ((y - x) / Math.abs(x)) * 100;
    const up = pct >= 0;
    const Icon = Math.abs(pct) < 0.5 ? Minus : up ? TrendingUp : TrendingDown;
    return <span className={`inline-flex items-center gap-1 font-bold ${Math.abs(pct) < 0.5 ? "text-muted" : up === goodUp ? "text-income" : "text-expense"}`}><Icon size={14} />{Math.abs(pct).toFixed(0)}%</span>;
  };

  const cats = live && cur?.data ? cur.data.categories.map((c) => ({ id: c.category, name: c.name, a: c.a, b: c.b })) : A && B ? [...new Set([...A.s.byCategory.map(([c]) => c), ...B.s.byCategory.map(([c]) => c)])].map((c) => ({ id: c, name: catOf(c).name, a: A.s.byCategory.find(([k]) => k === c)?.[1] ?? 0, b: B.s.byCategory.find(([k]) => k === c)?.[1] ?? 0 })).sort((x, y) => y.a + y.b - (x.a + x.b)) : [];

  return (
    <div className="space-y-6">
      <Reveal>
        <Link href="/reports" className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-foreground"><ArrowLeft size={15} /> Reports</Link>
        <h1 className="flex items-center gap-3 text-2xl font-extrabold tracking-tight"><GitCompareArrows className="text-brand" /> Compare reports</h1>
        <p className="text-sm text-muted">Pick two analyzed statements. We only compare like with like and tell you when coverage differs.</p>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="card grid gap-4 p-5 sm:grid-cols-2">
          {([["a", "Report A (baseline)", a], ["b", "Report B", b]] as const).map(([k, label, cur]) => (
            <label key={k} className="block"><span className="mb-1.5 block text-sm font-bold">{label}</span>
              <select value={cur?.id ?? ""} onChange={(e) => set(k, e.target.value)} className={sel}>
                <option value="">Choose a report…</option>
                {analyzable.map((r) => <option key={r.id} value={r.id} disabled={r.id === (k === "a" ? b?.id : a?.id)}>{r.name} — {r.period}</option>)}
              </select></label>
          ))}
        </div>
      </Reveal>

      {analyzable.length < 2 && <div className="card p-8 text-center text-sm text-muted">You need at least two analyzed reports to compare. Upload a statement to create one.</div>}

      {live && cur?.error && <div role="alert" className="card border-expense/30 p-4 text-sm font-semibold text-expense">{cur.error}</div>}
      {live && a && b && !cur && <div role="status" className="card p-6 text-center text-sm text-muted">Comparing…</div>}

      {A && B && (
        <>
          {!comparable && (
            <div role="status" className="card flex items-start gap-3 border-warning/50 p-4 text-sm">
              <AlertTriangle className="mt-0.5 shrink-0 text-warning" size={18} />
              <p><strong>These periods differ in length</strong> ({A.days} days vs {B.days} days), so raw totals are not directly comparable. Compare the <strong>per-day average</strong> row instead.</p>
            </div>
          )}
          <Reveal>
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted"><th className="p-4">Metric</th><th className="p-4 text-right">{a!.period}</th><th className="p-4 text-right">{b!.period}</th><th className="p-4 text-right">Change</th></tr></thead>
                <tbody>
                  {[
                    ["Days covered", `${A.days}`, `${B.days}`, null],
                    ["Money in", money(A.s.credits), money(B.s.credits), delta(A.s.credits, B.s.credits, true)],
                    ["Money out", money(A.s.debits), money(B.s.debits), delta(A.s.debits, B.s.debits, false)],
                    ["Net", money(A.s.net), money(B.s.net), delta(A.s.net, B.s.net, true)],
                    ["Average spend per day", money(A.s.avgDaily), money(B.s.avgDaily), delta(A.s.avgDaily, B.s.avgDaily, false)],
                    ["Transactions", `${A.s.count}`, `${B.s.count}`, delta(A.s.count, B.s.count, true)],
                  ].map(([l, x, y, d]) => (
                    <tr key={l as string} className={`border-b border-border/60 ${l === "Average spend per day" && !comparable ? "bg-brand-soft/50" : ""}`}><td className="p-4 font-semibold">{l as string}</td><td className="p-4 text-right">{x as string}</td><td className="p-4 text-right">{y as string}</td><td className="p-4 text-right">{(d as React.ReactNode) ?? ""}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
          <Reveal>
            <div className="card p-5">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">Spending by category</h2><span className="flex gap-2"><Chip tone="brand">A · {a!.period}</Chip><Chip tone="warn">B · {b!.period}</Chip></span></div>
              <div className="mt-3 h-[300px]" role="img" aria-label="Grouped bar chart comparing spending by category">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cats.slice(0, 7).map((c) => ({ name: c.name.split(" ")[0], A: c.a / 100, B: c.b / 100 }))} barGap={3}>
                    <CartesianGrid vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
                    <YAxis tickLine={false} axisLine={false} width={48} tick={{ fill: "var(--muted)", fontSize: 12 }} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
                    <Tooltip formatter={(v) => money(Number(v) * 100)} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)" }} />
                    <RBar dataKey="A" fill="#e11d48" radius={[6, 6, 0, 0]} animationDuration={800} />
                    <RBar dataKey="B" fill="#ffb703" radius={[6, 6, 0, 0]} animationDuration={800} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-4 divide-y divide-border text-sm">
                {cats.map((c) => <li key={c.id} className="flex items-center justify-between gap-3 py-2.5"><span className="flex items-center gap-2 font-semibold"><span className="size-2.5 rounded-full" style={{ background: catOf(c.id).color }} />{c.name}</span><span className="flex items-center gap-4"><span className="text-muted">{money(c.a)} → {money(c.b)}</span>{delta(c.a, c.b, false)}</span></li>)}
              </ul>
            </div>
          </Reveal>
        </>
      )}
    </div>
  );
}

export default function ComparePage() {
  return <Suspense fallback={<div className="h-40 animate-pulse rounded-3xl bg-surface-muted" />}><Compare /></Suspense>;
}
