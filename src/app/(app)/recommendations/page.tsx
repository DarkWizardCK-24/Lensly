"use client";

import { FlaskConical, Lightbulb } from "lucide-react";
import { useMemo, useState } from "react";
import { RecsPanel, type RecState } from "@/components/report-panels";
import { Chip } from "@/components/ui";
import { Reveal } from "@/components/reveal";
import { useReports } from "@/lib/reports";
import { useLiveReport } from "@/lib/report-data";
import { useScoped } from "@/lib/scoped";
import { daysBetween, effective, pickDefault, recommendations, sampleStatement, summarize, type Edits } from "@/lib/statement";

export default function SavingsPage() {
  const { reports, live } = useReports();
  const analyzable = live ? reports : reports.filter((r) => sampleStatement(r.id));
  const [rid, setRid] = useState("");
  const current = analyzable.find((r) => r.id === rid) ?? pickDefault(analyzable);
  const id = current?.id ?? "none";
  const [edits] = useScoped<Edits>(`review_${id}`, {});
  const [localState, setLocalState] = useScoped<Record<string, RecState>>(`recs_${id}`, {});
  const server = useLiveReport(id, live && !!current); // signed in: the server computes the ideas and remembers their status

  const { recs, txCount } = useMemo(() => {
    if (live) return { recs: [], txCount: 0 };
    const st = current ? sampleStatement(current.id) : null;
    if (!st || !current) return { recs: [], txCount: 0 };
    const eff = effective(st.txns, edits);
    const prevR = analyzable.map((r) => ({ r, s: sampleStatement(r.id)! })).filter((x) => x.s.meta.accountMask === st.meta.accountMask && x.s.meta.end < st.meta.start).sort((a, b) => (a.s.meta.end < b.s.meta.end ? 1 : -1))[0];
    const prev = prevR ? { summary: summarize(effective(prevR.s.txns, {}), daysBetween(prevR.s.meta.start, prevR.s.meta.end) + 1), days: daysBetween(prevR.s.meta.start, prevR.s.meta.end) + 1 } : null;
    return { recs: recommendations(eff, st.meta, prev), txCount: eff.length };
  }, [current, edits, analyzable, live]);
  const shownRecs = live ? server.recs : recs;
  const state = live ? server.recState : localState;

  return (
    <div className="space-y-6">
      <Reveal>
        <h1 className="flex items-center gap-3 text-2xl font-extrabold tracking-tight"><Lightbulb className="text-warning" /> Savings ideas</h1>
        <p className="text-sm text-muted">Evidence-based suggestions from your statements. Estimates only — never promises, and nothing changes in your accounts.</p>
      </Reveal>
      {analyzable.length === 0 ? (
        <div className="card p-10 text-center text-sm text-muted">No analyzed statements yet. Ideas appear here once a statement has been analyzed — upload one to get started.</div>
      ) : (
        <>
          <label className="card flex flex-wrap items-center gap-3 p-4 text-sm"><span className="font-bold">Statement</span>
            <select value={current?.id ?? ""} onChange={(e) => setRid(e.target.value)} className="h-10 rounded-xl border border-border bg-surface px-3 font-semibold outline-none focus:border-brand">{analyzable.map((r) => <option key={r.id} value={r.id}>{r.name} — {r.period}</option>)}</select>
            {!live && <Chip tone="warn"><FlaskConical size={11} /> Sample statement</Chip>}</label>
          {live && server.error && <div role="alert" className="rounded-2xl border border-expense/30 bg-expense/10 px-4 py-3 text-sm font-semibold text-expense">{server.error}</div>}
          <RecsPanel recs={shownRecs} tooLittle={live ? !server.enoughData : txCount < 10} state={state} setState={(k, s) => (live ? void server.setRecState(k, s) : setLocalState((cur) => ({ ...cur, [k]: { ...(cur[k] ?? { status: "new" }), ...s } as RecState })))} />
        </>
      )}
    </div>
  );
}
