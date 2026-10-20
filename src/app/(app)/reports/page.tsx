"use client";

import { ArrowRightLeft, BookPlus, Clock, ExternalLink, FileText, FlaskConical, FolderOpen, GitCompareArrows, Pencil, Plus, Trash2, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { clsx } from "clsx";
import { BookFormModal, iconOf } from "@/components/book-form";
import { Modal } from "@/components/modal";
import { Reveal } from "@/components/reveal";
import { formatBytes } from "@/lib/file-checks";
import { inr, useReports, type Report, type ReportBook } from "@/lib/reports";

const STATUS: Record<Report["status"], { label: string; cls: string }> = {
  sample: { label: "Sample", cls: "bg-warning/15 text-foreground" },
  uploaded: { label: "Awaiting parser", cls: "bg-brand-soft text-brand" },
  analyzed: { label: "Analyzed", cls: "bg-income/15 text-income" },
};

export default function ReportsPage() {
  const { books, reports, deleteBook, deleteReport, moveReport, renameReport } = useReports();
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [bookModal, setBookModal] = useState<{ open: boolean; edit?: ReportBook }>({ open: false });
  const [moving, setMoving] = useState<Report | null>(null);
  const [renaming, setRenaming] = useState<Report | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; onYes: () => void } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500); };
  const bookName = (id: string) => books.find((b) => b.id === id)?.name ?? "—";

  const shown = useMemo(() => reports
    .filter((r) => (filter === "all" || r.bookId === filter) && (!q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => b.createdAt - a.createdAt), [reports, filter, q]);

  return (
    <div className="space-y-8">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Reports</h1>
            <p className="text-sm text-muted">Group statements and reports into Report Books so they&apos;re easy to find.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setBookModal({ open: true })} className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-bold transition hover:bg-surface-muted active:scale-95"><BookPlus size={16} /> New Report Book</button>
            <Link href="/reports/compare" className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-bold transition hover:bg-surface-muted active:scale-95"><GitCompareArrows size={16} /> Compare</Link>
            <Link href="/upload" className="grad-brand inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-rose-500/25 transition active:scale-95"><UploadCloud size={16} /> Upload statement</Link>
          </div>
        </div>
      </Reveal>

      <section aria-labelledby="books-h">
        <Reveal><h2 id="books-h" className="mb-3 text-base font-bold">Report Books</h2></Reveal>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {books.map((b, i) => {
            const Icon = iconOf(b.icon);
            const list = reports.filter((r) => r.bookId === b.id);
            const last = list.reduce((m, r) => Math.max(m, r.createdAt), 0);
            const active = filter === b.id;
            return (
              <Reveal key={b.id} delay={i * 0.05}>
                <div className={clsx("card card-lift group h-full overflow-hidden", active && "ring-2 ring-brand")}>
                  <button onClick={() => setFilter(active ? "all" : b.id)} aria-pressed={active} className="block w-full text-left">
                    <div className="relative p-5 text-white" style={{ background: `linear-gradient(135deg, ${b.color}, color-mix(in srgb, ${b.color} 55%, black))` }}>
                      <Icon aria-hidden size={96} className="absolute -bottom-5 -right-3 opacity-15" />
                      <span className="grid size-11 place-items-center rounded-2xl bg-white/20"><Icon size={22} /></span>
                      <h3 className="mt-4 truncate text-lg font-extrabold">{b.name}</h3>
                      <p className="truncate text-sm text-white/75">{b.description || "No description"}</p>
                    </div>
                  </button>
                  <div className="flex items-center justify-between gap-2 p-4 text-sm">
                    <span className="flex items-center gap-1.5 font-semibold"><FileText size={15} style={{ color: b.color }} /> {list.length} report{list.length === 1 ? "" : "s"}</span>
                    <span className="flex items-center gap-1.5 text-xs text-muted"><Clock size={13} /> {last ? new Date(last).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Empty"}</span>
                    <span className="flex gap-1">
                      <button onClick={() => setBookModal({ open: true, edit: b })} aria-label={`Edit ${b.name}`} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"><Pencil size={15} /></button>
                      <button
                        aria-label={`Delete ${b.name}`}
                        onClick={() => setConfirm({
                          title: `Delete “${b.name}”?`,
                          message: list.length ? `This book holds ${list.length} report${list.length === 1 ? "" : "s"}. Move or delete them first.` : "This empty Report Book will be permanently deleted.",
                          onYes: async () => { const e = await deleteBook(b.id); say(e ?? "Report Book deleted"); if (!e && filter === b.id) setFilter("all"); },
                        })}
                        className="grid size-8 place-items-center rounded-lg text-muted hover:bg-expense/10 hover:text-expense"
                      ><Trash2 size={15} /></button>
                    </span>
                  </div>
                </div>
              </Reveal>
            );
          })}
          <Reveal delay={books.length * 0.05}>
            <button onClick={() => setBookModal({ open: true })} className="group grid h-full min-h-[210px] w-full place-items-center rounded-[1.25rem] border-2 border-dashed border-brand/40 bg-brand/5 p-6 text-center transition hover:-translate-y-0.5 hover:border-brand hover:bg-brand/10">
              <span>
                <span className="grad-brand mx-auto grid size-14 place-items-center rounded-full text-white shadow-lg shadow-rose-500/30 transition group-hover:scale-110"><Plus size={28} /></span>
                <span className="mt-3 block text-lg font-extrabold">New Report Book</span>
                <span className="mt-1 block text-sm text-muted">Personal, Business, Joint account…</span>
              </span>
            </button>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="rep-h">
        <Reveal>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 id="rep-h" className="text-base font-bold">{filter === "all" ? "All reports" : bookName(filter)} <span className="font-normal text-muted">({shown.length})</span></h2>
            <div className="flex flex-wrap items-center gap-2">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search reports…" aria-label="Search reports" className="h-10 w-56 rounded-xl border border-border bg-surface px-3.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/40" />
              {filter !== "all" && <button onClick={() => setFilter("all")} className="rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-surface-muted">Show all</button>}
            </div>
          </div>
        </Reveal>

        {shown.length === 0 ? (
          <div className="card grid place-items-center p-10 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-brand-soft text-brand"><FolderOpen size={26} /></span>
            <p className="mt-3 text-lg font-bold">{reports.length === 0 ? "No reports yet" : "No matching reports"}</p>
            <p className="mt-1 max-w-sm text-sm text-muted">{reports.length === 0 ? "Upload a statement into a Report Book to start building your library." : "Try another book or search."}</p>
            {reports.length === 0 && <Link href="/upload" className="grad-brand mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white"><UploadCloud size={16} /> Upload statement</Link>}
          </div>
        ) : (
          <ul className="space-y-3">
            {shown.map((r, i) => {
              const b = books.find((x) => x.id === r.bookId);
              const net = (r.creditsMinor ?? 0) - (r.debitsMinor ?? 0);
              const pct = r.creditsMinor ? Math.max(0, Math.min(100, ((r.creditsMinor - (r.debitsMinor ?? 0)) / r.creditsMinor) * 100)) : 0;
              return (
                <Reveal as="li" key={r.id} delay={Math.min(i, 6) * 0.04} className="card card-lift flex flex-wrap items-center gap-4 p-4">
                  <>
                    <span className="grid size-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: b?.color ?? "#94a3b8" }}><FileText size={22} /></span>
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="truncate font-bold">{r.name}</p>
                      <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        <span>{bookName(r.bookId)}</span><span aria-hidden>·</span><span>{r.period}</span><span aria-hidden>·</span><span>{formatBytes(r.sizeBytes)}</span>
                      </p>
                      <span className={clsx("mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold", STATUS[r.status].cls)}>{r.status === "sample" && <FlaskConical size={11} />}{STATUS[r.status].label}</span>
                    </div>
                    {r.creditsMinor !== undefined ? (
                      <div className="basis-44 text-sm">
                        <div className="flex justify-between"><span className="text-muted">In</span><span className="font-semibold text-income">{inr(r.creditsMinor)}</span></div>
                        <div className="flex justify-between"><span className="text-muted">Out</span><span className="font-semibold text-expense">{inr(r.debitsMinor ?? 0)}</span></div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-muted"><div className="grad-income h-full rounded-full" style={{ width: `${pct}%` }} /></div>
                        <p className="mt-1 text-right text-xs font-bold">{net >= 0 ? "Saved" : "Overspent"} {inr(Math.abs(net))}</p>
                      </div>
                    ) : <p className="basis-44 text-xs text-muted">Figures appear after analysis (Phase 5).</p>}
                    <div className="flex gap-1">
                      <Link href={`/reports/${r.id}`} aria-label={`Open ${r.name}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-soft px-3 text-sm font-bold text-brand hover:opacity-80"><ExternalLink size={14} /> Open</Link>
                      <button onClick={() => setRenaming(r)} aria-label={`Rename ${r.name}`} className="grid size-9 place-items-center rounded-xl text-muted hover:bg-surface-muted hover:text-foreground"><Pencil size={16} /></button>
                      <button onClick={() => setMoving(r)} aria-label={`Move ${r.name}`} className="grid size-9 place-items-center rounded-xl text-muted hover:bg-surface-muted hover:text-foreground"><ArrowRightLeft size={16} /></button>
                      <button onClick={() => setConfirm({ title: "Delete report?", message: `“${r.name}” will be removed from ${bookName(r.bookId)}.`, onYes: async () => { const e = await deleteReport(r.id); say(e ?? "Report deleted"); } })} aria-label={`Delete ${r.name}`} className="grid size-9 place-items-center rounded-xl text-muted hover:bg-expense/10 hover:text-expense"><Trash2 size={16} /></button>
                    </div>
                  </>
                </Reveal>
              );
            })}
          </ul>
        )}
      </section>

      <BookFormModal open={bookModal.open} edit={bookModal.edit} onClose={() => setBookModal({ open: false })} onSaved={() => say(bookModal.edit ? "Report Book updated" : "Report Book created")} />

      <Modal open={moving !== null} onClose={() => setMoving(null)} title="Move to another Report Book">
        <div className="space-y-2">
          {books.map((b) => (
            <button key={b.id} disabled={b.id === moving?.bookId} onClick={async () => { const m = moving; setMoving(null); if (m) { const e = await moveReport(m.id, b.id); say(e ?? `Moved to ${b.name}`); } }} className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left text-sm font-semibold transition hover:bg-surface-muted disabled:opacity-50">
              <span className="size-3 rounded-full" style={{ background: b.color }} /> {b.name} {b.id === moving?.bookId && <span className="ml-auto text-xs text-muted">current</span>}
            </button>
          ))}
        </div>
      </Modal>

      <RenameModal report={renaming} onClose={() => setRenaming(null)} onSave={async (n) => { const r = renaming; setRenaming(null); if (r) { const e = await renameReport(r.id, n); say(e ?? "Report renamed"); } }} />

      <Modal open={confirm !== null} onClose={() => setConfirm(null)} title={confirm?.title ?? ""}>
        <p className="text-sm text-muted">{confirm?.message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setConfirm(null)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface-muted">Cancel</button>
          <button onClick={() => { confirm?.onYes(); setConfirm(null); }} className="rounded-xl bg-expense px-5 py-2.5 text-sm font-bold text-white">Confirm</button>
        </div>
      </Modal>

      {toast && <div role="status" className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-foreground px-5 py-3 text-sm font-semibold text-background shadow-2xl lg:bottom-8">{toast}</div>}
    </div>
  );
}

function RenameModal({ report, onClose, onSave }: { report: Report | null; onClose: () => void; onSave: (n: string) => void }) {
  const [v, setV] = useState("");
  const [seen, setSeen] = useState<string | null>(null);
  if (report && seen !== report.id) { setSeen(report.id); setV(report.name); }
  return (
    <Modal open={report !== null} onClose={onClose} title="Rename report">
      <form onSubmit={(e) => { e.preventDefault(); if (v.trim().length >= 2) onSave(v.trim()); }} className="space-y-4">
        <input value={v} onChange={(e) => setV(e.target.value)} autoFocus maxLength={80} aria-label="Report name" className="h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/40" />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface-muted">Cancel</button>
          <button type="submit" className="grad-brand rounded-xl px-5 py-2.5 text-sm font-bold text-white">Save</button>
        </div>
      </form>
    </Modal>
  );
}
