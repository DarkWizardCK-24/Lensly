"use client";

import { ArrowLeft, FileClock, FlaskConical, GitCompareArrows, ScanLine, Send } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { OverviewPanel, ReconPanel, RecsPanel, type RecState } from "@/components/report-panels";
import { ReviewWorkspace } from "@/components/review-workspace";
import { Chip, Tabs } from "@/components/ui";
import { ReportActions } from "@/components/report-actions";
import { useLiveReport } from "@/lib/report-data";
import { useScoped } from "@/lib/scoped";
import { daysBetween, effective, reconcile, recommendations, sampleStatement, summarize, type Edits } from "@/lib/statement";
import { useReports } from "@/lib/reports";

type Tab = "overview" | "transactions" | "reconciliation" | "recommendations";
const RECON_TONE = { reconciled: "ok", warnings: "warn", not_reconciled: "bad", unknown: "muted" } as const;
const RECON_LABEL = { reconciled: "Reconciled", warnings: "Reconciled with warnings", not_reconciled: "Not reconciled", unknown: "Unable to reconcile" } as const;

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const { reports, books, live, loading: listLoading } = useReports();
  const report = reports.find((r) => r.id === id);
  const server = useLiveReport(id, live && !!report);
  const st = live ? server.statement : report ? sampleStatement(report.id) : null;
  const [tab, setTab] = useState<Tab>("overview");
  const [localEdits, setLocalEdits] = useScoped<Edits>(`review_${id}`, {});
  const [localRecState, setLocalRecState] = useScoped<Record<string, import("@/components/report-panels").RecState>>(`recs_${id}`, {});
  const edits = live ? server.edits : localEdits;
  const setEdits = live ? server.setEdits : setLocalEdits;
  const recState = live ? server.recState : localRecState;

  const txns = useMemo(() => (st ? effective(st.txns, edits) : []), [st, edits]);
  const days = st ? daysBetween(st.meta.start, st.meta.end) + 1 : 1;
  const summary = useMemo(() => summarize(txns, days), [txns, days]);
  const recon = useMemo(() => (st ? reconcile(st) : null), [st]);

  // The previous sample statement for the same account, for like-for-like comparison.
  const prev = useMemo(() => {
    if (live || !st || !report) return null;
    const cands = reports.filter((r) => r.id !== report.id && r.bookId === report.bookId).map((r) => ({ r, s: sampleStatement(r.id) })).filter((x) => x.s && x.s.meta.accountMask === st.meta.accountMask && x.s.meta.end < st.meta.start);
    const p = cands.sort((a, b) => (a.s!.meta.end < b.s!.meta.end ? 1 : -1))[0];
    if (!p) return null;
    const d = daysBetween(p.s!.meta.start, p.s!.meta.end) + 1;
    return { summary: summarize(effective(p.s!.txns, {}), d), days: d };
  }, [st, report, reports, live]);
  // Signed in: the server computes the suggestions (and remembers their status). Sample mode computes them here.
  const localRecs = useMemo(() => (st && !live ? recommendations(txns, st.meta, prev) : []), [txns, st, prev, live]);
  const recs = live ? server.recs : localRecs;

  if (live && (listLoading || (report && server.loading && !st)) && !(report && server.error)) return <div className="card p-10 text-center text-sm text-muted" role="status">Loading report…</div>;
  if (!report || server.error === "not_found") return <div className="card p-10 text-center"><p className="text-lg font-bold">Report not found</p><Link href="/reports" className="mt-2 inline-block font-bold text-brand hover:underline">← Back to Reports</Link></div>;

  const book = books.find((b) => b.id === report.bookId);
  const header = (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <Link href="/reports" className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-foreground"><ArrowLeft size={15} /> Reports</Link>
        <h1 className="truncate text-2xl font-extrabold tracking-tight">{report.name}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: book?.color }} />{book?.name}</span><span aria-hidden>·</span><span>{report.period}</span>
          {st && <><span aria-hidden>·</span><span>{st.meta.bank} {st.meta.accountMask}</span></>}
          {report.status === "sample" && <Chip tone="warn"><FlaskConical size={11} /> Sample data</Chip>}
          {recon && <Chip tone={RECON_TONE[recon.status]}>{RECON_LABEL[recon.status]}</Chip>}
        </p>
      </div>
      {st && (
        <div className="flex flex-wrap items-start justify-end gap-2">
          {live && <ReportActions reportId={id} reportName={report.name} flush={server.flush} />}
          <Link href={`/reports/compare?a=${id}`} className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-bold hover:bg-surface-muted"><GitCompareArrows size={16} /> Compare</Link>
          <Link href={`/reports/${id}/import`} className="grad-brand inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-rose-500/25"><Send size={16} /> Import to CashBook</Link>
        </div>
      )}
    </div>
  );

  if (!st || !recon) {
    return (
      <div className="space-y-6">
        {header}
        <div className="card grid place-items-center p-12 text-center">
          <span className="grad-ember grid size-16 place-items-center rounded-2xl text-white"><FileClock size={30} /></span>
          <p className="mt-4 text-xl font-extrabold">Awaiting parser</p>
          <p className="mt-1 max-w-md text-sm text-muted">“{report.source}” was added to <strong>{book?.name}</strong>. Transaction extraction, review and analysis arrive in Phase 5 — nothing has been read from this file yet, so no figures are shown.</p>
          <Link href="/upload" className="mt-5 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold hover:bg-surface-muted"><ScanLine size={16} /> Upload another statement</Link>
        </div>
      </div>
    );
  }

  const unreviewed = txns.filter((t) => !t.reviewed).length;
  return (
    <div className="space-y-6">
      {header}
      {live && server.error && server.error !== "not_found" && <div role="alert" className="rounded-2xl border border-expense/30 bg-expense/10 px-4 py-3 text-sm font-semibold text-expense">{server.error}</div>}
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        { id: "overview", label: "Overview" },
        { id: "transactions", label: "Review transactions", badge: unreviewed ? `${unreviewed} to review` : "done" },
        { id: "reconciliation", label: "Reconciliation", badge: recon.rowIssues.length || (recon.status === "not_reconciled" ? "!" : undefined) },
        { id: "recommendations", label: "Savings ideas", badge: recs.length || undefined },
      ]} />
      {tab === "overview" && <OverviewPanel st={st} txns={txns} s={summary} />}
      {tab === "transactions" && <ReviewWorkspace reportName={report.name} statement={st} edits={edits} setEdits={setEdits} />}
      {tab === "reconciliation" && <ReconPanel st={st} r={recon} />}
      {tab === "recommendations" && <RecsPanel recs={recs} tooLittle={live ? !server.enoughData : txns.length < 10} state={recState} setState={(k, s) => (live ? void server.setRecState(k, s) : setLocalRecState((cur) => ({ ...cur, [k]: { ...(cur[k] ?? { status: "new" }), ...s } as RecState })))} />}
    </div>
  );
}
