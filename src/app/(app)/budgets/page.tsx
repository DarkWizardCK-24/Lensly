"use client";

import { AlertTriangle, CheckCircle2, FlaskConical, PiggyBank, Plus, Target, Trash2, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import { Modal } from "@/components/modal";
import { Bar, Chip, Kpi, money, useToast } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { ApiError, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useLiveReport } from "@/lib/report-data";
import { EXPENSE_CATS, catOf } from "@/lib/categories";
import { useReports } from "@/lib/reports";
import { readScoped, useScoped } from "@/lib/scoped";
import { daysBetween, effective, pickDefault, recommendations, sampleStatement, summarize, type Edits } from "@/lib/statement";
import type { RecState } from "@/components/report-panels";

type Budget = { id: string; cat: string; limit: number };
type Goal = { id: string; name: string; target: number; saved: number };

/** Rupees text → integer paise, or null when invalid (max 2 decimals). */
const toMinor = (s: string) => {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s.replace(/,/g, "").trim());
  return m ? Number(m[1]) * 100 + Number((m[2] ?? "0").padEnd(2, "0")) : null;
};
const uid = () => Math.random().toString(36).slice(2, 9);

export default function BudgetsPage() {
  const { reports, live } = useReports();
  const { session, getToken } = useAuth();
  const say = useToast();
  const analyzable = live ? reports : reports.filter((r) => sampleStatement(r.id));
  const [localBudgets, setLocalBudgets] = useScoped<Budget[]>("budgets", []);
  const [localGoals, setLocalGoals] = useScoped<Goal[]>("goals", []);
  const [liveBudgets, setLiveBudgets] = useState<Budget[]>([]);
  const [liveGoals, setLiveGoals] = useState<Goal[]>([]);
  const budgets = live ? liveBudgets : localBudgets;
  const goals = live ? liveGoals : localGoals;
  const [rid, setRid] = useState<string>("");
  const [bModal, setBModal] = useState(false);
  const [gModal, setGModal] = useState(false);
  const [cat, setCat] = useState(EXPENSE_CATS[0].id);
  const [amt, setAmt] = useState("");
  const [gName, setGName] = useState("");
  const [gTarget, setGTarget] = useState("");
  const [gSaved, setGSaved] = useState("");
  const [err, setErr] = useState<string | null>(null);

  // Budgets and goals live on the server when signed in.
  type ApiBudget = { id: string; category: string; limit_minor: number };
  type ApiGoal = { id: string; name: string; target_minor: number; saved_minor: number };
  const api = useCallback(async <T,>(path: string, init?: { method?: string; json?: unknown }): Promise<T> => {
    const t = await getToken();
    if (!t) throw new ApiError("unauthorized", "Please sign in again.", 401);
    return apiFetch<T>(t, path, init);
  }, [getToken]);
  const reload = useCallback(async () => {
    const [b, g] = await Promise.all([api<ApiBudget[]>("/budgets"), api<ApiGoal[]>("/goals")]);
    setLiveBudgets(b.map((x) => ({ id: x.id, cat: x.category, limit: x.limit_minor })));
    setLiveGoals(g.map((x) => ({ id: x.id, name: x.name, target: x.target_minor, saved: x.saved_minor })));
  }, [api]);
  useEffect(() => {
    if (!live) return;
    const t = setTimeout(() => reload().catch((e) => setErr(e instanceof ApiError ? e.message : "Could not load your budgets.")), 0);
    return () => clearTimeout(t);
  }, [live, reload]);
  const fail = (e: unknown) => { setErr(e instanceof ApiError ? e.message : "Something went wrong."); };

  const current = analyzable.find((r) => r.id === rid) ?? pickDefault(analyzable);
  const server = useLiveReport(current?.id ?? "none", live && !!current);
  const data = (() => {
    const st = current ? (live ? server.statement : sampleStatement(current.id)) : null;
    if (!st || !current) return null;
    const days = daysBetween(st.meta.start, st.meta.end) + 1;
    const eff = effective(st.txns, live ? server.edits : readScoped<Edits>(session?.userId, `review_${current.id}`, {}));
    const s = summarize(eff, days);
    const recs = live ? server.recs : recommendations(eff, st.meta, null);
    const recState = live ? server.recState : readScoped<Record<string, RecState>>(session?.userId, `recs_${current.id}`, {});
    const potential = recs.reduce((a, r) => a + (r.savings?.minor ?? 0), 0);
    const realized = recs.filter((r) => recState[r.key]?.status === "completed").reduce((a, r) => a + (r.savings?.minor ?? 0), 0);
    return { days, s, potential, realized, scale: days > 35 ? 30 / days : 1 };
  })();

  const actualOf = (c: string) => Math.round(((data?.s.byCategory.find(([k]) => k === c)?.[1]) ?? 0) * (data?.scale ?? 1));
  const overs = budgets.filter((b) => actualOf(b.cat) > b.limit);

  const saveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const m = toMinor(amt);
    if (m === null || m <= 0) return setErr("Enter a monthly amount in rupees, e.g. 8000 or 8000.50.");
    if (budgets.some((b) => b.cat === cat)) return setErr(`You already have a budget for ${catOf(cat).name}.`);
    if (live) {
      try { await api("/budgets", { json: { category: cat, limit_minor: m } }); await reload(); } catch (x) { return fail(x); }
    } else setLocalBudgets([...localBudgets, { id: uid(), cat, limit: m }]);
    setBModal(false); setAmt(""); setErr(null); say("Budget created");
  };
  const removeBudget = async (id: string) => {
    if (live) {
      try { await api(`/budgets/${id}`, { method: "DELETE" }); await reload(); } catch (x) { return say(x instanceof ApiError ? x.message : "Could not delete the budget."); }
    } else setLocalBudgets(localBudgets.filter((x) => x.id !== id));
    say("Budget deleted");
  };
  const removeGoal = async (id: string) => {
    if (live) {
      try { await api(`/goals/${id}`, { method: "DELETE" }); await reload(); } catch (x) { return say(x instanceof ApiError ? x.message : "Could not delete the goal."); }
    } else setLocalGoals(localGoals.filter((x) => x.id !== id));
    say("Goal deleted");
  };
  const setSaved = async (g: Goal, saved: number) => {
    if (live) {
      try { await api(`/goals/${g.id}`, { method: "PATCH", json: { saved_minor: saved } }); await reload(); } catch (x) { say(x instanceof ApiError ? x.message : "Could not update the goal."); }
    } else setLocalGoals(localGoals.map((x) => (x.id === g.id ? { ...x, saved } : x)));
  };
  const saveGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = toMinor(gTarget); const s = toMinor(gSaved || "0");
    if (gName.trim().length < 2) return setErr("Give your goal a name.");
    if (t === null || t <= 0) return setErr("Enter a target amount in rupees.");
    if (s === null) return setErr("Saved amount must be a valid number.");
    if (live) {
      try { await api("/goals", { json: { name: gName.trim(), target_minor: t, saved_minor: s } }); await reload(); } catch (x) { return fail(x); }
    } else setLocalGoals([...localGoals, { id: uid(), name: gName.trim(), target: t, saved: s }]);
    setGModal(false); setGName(""); setGTarget(""); setGSaved(""); setErr(null); say("Goal created");
  };

  const input = "h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/40";

  return (
    <div className="space-y-8">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h1 className="text-2xl font-extrabold tracking-tight">Budgets &amp; savings</h1><p className="text-sm text-muted">Your own monthly limits and goals — compared with what your statements actually show. We never move money.</p></div>
          <div className="flex gap-2">
            <button onClick={() => { setErr(null); setBModal(true); }} className="grad-brand inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white"><Plus size={16} /> New budget</button>
            <button onClick={() => { setErr(null); setGModal(true); }} className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-bold hover:bg-surface-muted"><Target size={16} /> New goal</button>
          </div>
        </div>
      </Reveal>

      {analyzable.length > 0 && (
        <Reveal delay={0.04}>
          <label className="card flex flex-wrap items-center gap-3 p-4 text-sm"><span className="font-bold">Compare against</span>
            <select value={current?.id ?? ""} onChange={(e) => setRid(e.target.value)} className="h-10 rounded-xl border border-border bg-surface px-3 font-semibold outline-none focus:border-brand">{analyzable.map((r) => <option key={r.id} value={r.id}>{r.name} — {r.period}</option>)}</select>
            {!live && <Chip tone="warn"><FlaskConical size={11} /> Sample statement</Chip>}
            {data && data.scale !== 1 && <span className="text-xs text-muted">Scaled to a 30-day month ({data.days}-day statement).</span>}</label>
        </Reveal>
      )}

      {overs.length > 0 && <div role="alert" className="card flex items-start gap-3 border-expense/40 p-4 text-sm"><AlertTriangle className="mt-0.5 shrink-0 text-expense" size={18} /><p><strong>{overs.length} budget{overs.length === 1 ? " is" : "s are"} over the limit:</strong> {overs.map((b) => catOf(b.cat).name).join(", ")}.</p></div>}

      <section aria-labelledby="bud-h">
        <Reveal><h2 id="bud-h" className="mb-3 text-base font-bold">Budget vs actual</h2></Reveal>
        {budgets.length === 0 ? (
          <div className="card grid place-items-center p-10 text-center"><span className="grid size-14 place-items-center rounded-full bg-brand-soft text-brand"><PiggyBank size={26} /></span><p className="mt-3 text-lg font-bold">No budgets yet</p><p className="mt-1 max-w-sm text-sm text-muted">Set a monthly limit for a category you want to keep an eye on. We won&apos;t guess one for you.</p><button onClick={() => setBModal(true)} className="grad-brand mt-4 rounded-xl px-5 py-2.5 text-sm font-bold text-white">Create your first budget</button></div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {budgets.map((b, i) => {
              const a = actualOf(b.cat); const ratio = b.limit ? a / b.limit : 0;
              const tone = ratio > 1 ? "bad" : ratio >= 0.8 ? "warn" : "ok";
              return (
                <Reveal key={b.id} delay={i * 0.04}>
                  <div className="card card-lift p-5">
                    <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 font-bold"><span className="size-3 rounded-full" style={{ background: catOf(b.cat).color }} />{catOf(b.cat).name}</span>
                      <span className="flex items-center gap-2"><Chip tone={tone}>{ratio > 1 ? "Over budget" : ratio >= 0.8 ? "Nearing limit" : "On track"}</Chip>
                        <button aria-label={`Delete budget ${catOf(b.cat).name}`} onClick={() => void removeBudget(b.id)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-expense/10 hover:text-expense"><Trash2 size={15} /></button></span></div>
                    <p className="mt-3 text-2xl font-extrabold">{money(a)} <span className="text-sm font-semibold text-muted">of {money(b.limit)}</span></p>
                    <div className="mt-2"><Bar value={Math.min(ratio, 1)} color={tone === "bad" ? "#e11d48" : tone === "warn" ? "#f59e0b" : "#12b76a"} /></div>
                    <p className="mt-1.5 text-xs text-muted">{ratio > 1 ? `${money(a - b.limit)} over` : `${money(b.limit - a)} left`} · {Math.round(ratio * 100)}% used</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="sav-h">
        <Reveal><h2 id="sav-h" className="mb-3 text-base font-bold">Potential vs realized savings</h2></Reveal>
        <div className="grid gap-4 sm:grid-cols-2">
          <Kpi label="Potential (upper-bound estimate)" value={money(data?.potential ?? 0)} icon={TrendingUp} tone="grad-gold" sub="From this statement's savings ideas" />
          <Kpi label="Realized (ideas you marked done)" value={money(data?.realized ?? 0)} icon={CheckCircle2} tone="grad-income" sub="Only counts what you completed" />
        </div>
        {data && data.potential > 0 && <div className="card mt-4 p-5"><div className="mb-2 flex justify-between text-sm"><span className="font-semibold">Progress toward the estimate</span><span className="font-bold">{Math.round((data.realized / data.potential) * 100)}%</span></div><Bar value={data.realized / data.potential} gradient="grad-income" /><p className="mt-2 text-xs text-muted">Estimates are upper bounds based on explicit assumptions — real savings may be lower.</p></div>}
      </section>

      <section aria-labelledby="goal-h">
        <Reveal><h2 id="goal-h" className="mb-3 text-base font-bold">Savings goals</h2></Reveal>
        {goals.length === 0 ? <div className="card p-8 text-center text-sm text-muted">No goals yet. Add one you care about — an emergency fund, a trip, a gadget.</div> : (
          <div className="grid gap-4 md:grid-cols-2">{goals.map((g) => { const r = g.target ? g.saved / g.target : 0; return (
            <div key={g.id} className="card card-lift p-5">
              <div className="flex items-start justify-between gap-2"><span className="flex items-center gap-2 font-bold"><span className="grad-gold grid size-9 place-items-center rounded-xl text-white"><Target size={17} /></span>{g.name}</span>
                <button aria-label={`Delete goal ${g.name}`} onClick={() => void removeGoal(g.id)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-expense/10 hover:text-expense"><Trash2 size={15} /></button></div>
              <p className="mt-3 text-2xl font-extrabold">{money(g.saved)} <span className="text-sm font-semibold text-muted">of {money(g.target)}</span></p>
              <div className="mt-2"><Bar value={r} gradient="grad-gold" /></div>
              <div className="mt-3 flex items-center gap-2 text-xs"><span className="font-bold">{Math.round(r * 100)}%</span><span className="text-muted">· update saved amount:</span>
                <input aria-label={`Saved so far for ${g.name}`} defaultValue={(g.saved / 100).toFixed(2)} onBlur={(e) => { const m = toMinor(e.target.value); if (m !== null) void setSaved(g, m); else e.target.value = (g.saved / 100).toFixed(2); }} className={clsx("h-8 w-28 rounded-lg border border-border bg-surface px-2 outline-none focus:border-brand")} /></div>
            </div>); })}</div>
        )}
      </section>

      <Modal open={bModal} onClose={() => setBModal(false)} title="New monthly budget">
        <form onSubmit={saveBudget} className="space-y-4">
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">Category</span><select value={cat} onChange={(e) => setCat(e.target.value)} className={input}>{EXPENSE_CATS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">Monthly limit (₹)</span><input value={amt} onChange={(e) => setAmt(e.target.value)} inputMode="decimal" autoFocus className={input} placeholder="e.g. 8000" /></label>
          {err && <p role="alert" className="text-sm font-medium text-expense">{err}</p>}
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setBModal(false)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold">Cancel</button><button className="grad-brand rounded-xl px-5 py-2.5 text-sm font-bold text-white">Create budget</button></div>
        </form>
      </Modal>
      <Modal open={gModal} onClose={() => setGModal(false)} title="New savings goal">
        <form onSubmit={saveGoal} className="space-y-4">
          <label className="block"><span className="mb-1.5 block text-sm font-semibold">Goal name</span><input value={gName} onChange={(e) => setGName(e.target.value)} autoFocus maxLength={60} className={input} placeholder="Emergency fund" /></label>
          <div className="grid grid-cols-2 gap-3"><label className="block"><span className="mb-1.5 block text-sm font-semibold">Target (₹)</span><input value={gTarget} onChange={(e) => setGTarget(e.target.value)} inputMode="decimal" className={input} /></label>
            <label className="block"><span className="mb-1.5 block text-sm font-semibold">Saved so far (₹)</span><input value={gSaved} onChange={(e) => setGSaved(e.target.value)} inputMode="decimal" className={input} placeholder="0" /></label></div>
          {err && <p role="alert" className="text-sm font-medium text-expense">{err}</p>}
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setGModal(false)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold">Cancel</button><button className="grad-brand rounded-xl px-5 py-2.5 text-sm font-bold text-white">Create goal</button></div>
        </form>
      </Modal>
    </div>
  );
}
