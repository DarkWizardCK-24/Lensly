"use client";

import { ArrowRight, FileClock, FileText, FlaskConical, Lightbulb, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useReports } from "@/lib/reports";
import { readScoped } from "@/lib/scoped";
import { effective, reconcile, recommendations, sampleStatement, type Edits } from "@/lib/statement";
import { Chip, money } from "./ui";

const TONE = { reconciled: "ok", warnings: "warn", not_reconciled: "bad", unknown: "muted" } as const;
const LABEL = { reconciled: "Reconciled", warnings: "With warnings", not_reconciled: "Not reconciled", unknown: "Can't reconcile" } as const;

/** Recent reports + potential savings, computed from the user's own (or sample) statements. */
export function DashboardReports() {
  const { reports, books, live } = useReports();
  const { session, getToken } = useAuth();
  const recent = [...reports].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4);
  const analyzed = live ? recent.map((r) => ({ r, st: null })) : recent.map((r) => ({ r, st: sampleStatement(r.id) })).filter((x) => x.st);

  const latest = analyzed[0];
  // Signed in: the server's own estimate for the latest report (it also reflects the user's corrections).
  const latestId = live ? latest?.r.id : undefined;
  const [served, setServed] = useState<{ id: string; minor: number } | null>(null);
  useEffect(() => {
    if (!latestId) return;
    let alive = true;
    const t = setTimeout(async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const r = await apiFetch<{ potential_minor: number }>(token, `/reports/${latestId}/recommendations`);
        if (alive) setServed({ id: latestId, minor: r.potential_minor });
      } catch { /* the card simply shows no estimate */ }
    }, 0);
    return () => { alive = false; clearTimeout(t); };
  }, [latestId, getToken]);
  const potential = live
    ? (served && served.id === latestId ? served.minor : 0)
    : latest?.st
    ? recommendations(effective(latest.st.txns, readScoped<Edits>(session?.userId, `review_${latest.r.id}`, {})), latest.st.meta, null).reduce((a, r) => a + (r.savings?.minor ?? 0), 0)
    : 0;

  return (
    <section aria-labelledby="recent-h" className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between"><h2 id="recent-h" className="font-bold">Recent reports</h2><Link href="/reports" className="inline-flex items-center gap-1 text-sm font-bold text-brand hover:underline">All reports <ArrowRight size={14} /></Link></div>
        {recent.length === 0 ? (
          <div className="grid place-items-center py-8 text-center"><FileClock className="text-muted" size={26} /><p className="mt-2 font-bold">No reports yet</p><Link href="/upload" className="grad-brand mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white"><UploadCloud size={15} /> Upload a statement</Link></div>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((r) => {
              const st = live ? null : sampleStatement(r.id);
              const rc = live ? (r.reconStatus ? { status: r.reconStatus } : null) : st ? reconcile(st) : null;
              const b = books.find((x) => x.id === r.bookId);
              return (
                <li key={r.id}><Link href={`/reports/${r.id}`} className="flex items-center gap-3 py-3 transition hover:opacity-80">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: b?.color ?? "#94a3b8" }}><FileText size={18} /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-bold">{r.name}</span><span className="text-xs text-muted">{b?.name} · {r.period}</span></span>
                  {rc ? <Chip tone={TONE[rc.status]}>{LABEL[rc.status]}</Chip> : <Chip tone="brand">Awaiting parser</Chip>}
                </Link></li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="card relative overflow-hidden p-5">
        <div aria-hidden className="grad-gold absolute -right-8 -top-8 size-32 rounded-full opacity-25 blur-xl" />
        <h2 className="flex items-center gap-2 font-bold"><Lightbulb size={18} className="text-warning" /> Potential savings</h2>
        {latest ? (
          <>
            <p className="mt-3 text-3xl font-extrabold tracking-tight">up to {money(potential)}</p>
            <p className="mt-1 text-sm text-muted">An upper-bound estimate from <strong>{latest.r.name}</strong>, based on stated assumptions — not a promise.</p>
            {latest.r.status === "sample" && <p className="mt-2"><Chip tone="warn"><FlaskConical size={11} /> Sample data</Chip></p>}
            <Link href="/recommendations" className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-brand hover:underline">See the ideas <ArrowRight size={14} /></Link>
          </>
        ) : <p className="mt-3 text-sm text-muted">Savings ideas appear once a statement has been analyzed.</p>}
      </div>
    </section>
  );
}
