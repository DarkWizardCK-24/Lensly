"use client";

import { AlertCircle, BookPlus, CheckCircle2, ChevronRight, FileSpreadsheet, FileText, FileUp, FlaskConical, KeyRound, Loader2, Lock, ScanText, Server, ShieldCheck, Trash2, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { clsx } from "clsx";
import { BookFormModal } from "@/components/book-form";
import { Modal } from "@/components/modal";
import { Reveal } from "@/components/reveal";
import { Chip } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { checkFile, formatBytes, safeName, type FileKind } from "@/lib/file-checks";
import { ProcessError, inspectStatement, processStatement } from "@/lib/processing";
import { useReports } from "@/lib/reports";

type Result = { n: number; recon: string; warnings: string[]; ocrUsed: boolean; reportId: string };
type Item = {
  id: string;
  file: File;
  kind?: FileKind;
  encrypted: boolean;
  error?: string;
  unlocked: boolean; // a password was supplied (the password itself is NOT kept in React state)
  stage: number; // -1 idle, 0..n-1 running (preview) / 0 = server working (live), n done
  sha?: string;
  needOcr?: boolean;
  triedOnce?: boolean;
  existing?: string; // id of a report that already holds this exact file
  result?: Result;
};

const STAGES = ["Validate file", "Detect & unlock", "Extract", "Normalize transactions", "Categorize", "Reconcile balances"];
const KIND_ICON: Record<FileKind, typeof FileText> = { pdf: FileText, csv: FileSpreadsheet, xlsx: FileSpreadsheet, xls: FileSpreadsheet };
const RECON = { reconciled: ["Reconciled", "ok"], warnings: ["Reconciled with warnings", "warn"], not_reconciled: ["Not reconciled", "bad"], unknown: ["Couldn't reconcile", "muted"] } as const;

export default function UploadPage() {
  const auth = useAuth();
  const live = auth.status === "signedIn";
  const { books, reports, addReport, refresh } = useReports();
  const [bookId, setBookId] = useState<string>("");
  const [items, setItems] = useState<Item[]>([]);
  const [drag, setDrag] = useState(false);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState<string[]>([]);
  const [newBook, setNewBook] = useState(false);
  const [pwFor, setPwFor] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Passwords live only in this ref, only until processing finishes, and are never persisted or logged.
  const secrets = useRef(new Map<string, string>());
  const selected = bookId || books[0]?.id || "";
  const book = books.find((b) => b.id === selected);
  const patch = (id: string, p: Partial<Item>) => setItems((cur) => cur.map((i) => (i.id === id ? { ...i, ...p } : i)));

  const addFiles = useCallback(async (list: FileList | File[]) => {
    // Snapshot first: the input's FileList is live and is emptied as soon as the input is reset.
    const files = Array.from(list);
    const next: Item[] = [];
    const token = live ? await auth.getToken() : null;
    // The list may not have loaded yet (e.g. straight after navigating here): ask the server so duplicates are always caught.
    const known = (live ? await refresh() : null) ?? reports;
    for (const file of files) {
      const c = await checkFile(file);
      const it: Item = { id: Math.random().toString(36).slice(2), file, kind: c.ok ? c.kind : undefined, encrypted: c.ok && c.encrypted, error: c.ok ? undefined : c.error, unlocked: false, stage: -1 };
      if (c.ok && token) {
        try {
          const info = await inspectStatement(token, file); // the server is the authority on encryption and file health
          it.encrypted = info.encrypted;
          it.sha = info.sha256;
          const dup = known.find((r) => r.sha256 === info.sha256);
          if (dup) {
            it.existing = dup.id;
            it.error = "You've already uploaded this exact file.";
          }
        } catch (e) {
          if (e instanceof ProcessError && e.code !== "unreachable") it.error = e.message;
        }
      }
      next.push(it);
    }
    setItems((cur) => [...cur, ...next]);
  }, [live, auth, reports, refresh]);

  const remove = (id: string) => {
    secrets.current.delete(id);
    setItems((cur) => cur.filter((i) => i.id !== id));
  };

  // ---------------------------------------------------------------- live (server) processing
  const processLive = async (it: Item, ocr = false) => {
    if (!selected) return;
    patch(it.id, { stage: 0, error: undefined, needOcr: false, triedOnce: true });
    const token = await auth.getToken();
    if (!token) return patch(it.id, { stage: -1, error: "Please sign in again." });
    try {
      // The server saves the report (statement, transactions, first version) atomically when it is given a Report Book.
      const res = await processStatement(token, it.file, { password: secrets.current.get(it.id), ocr, bookId: selected, reportName: safeName(it.file.name).replace(/\.[^.]+$/, "").slice(0, 80) });
      const reportId = res.report_id ?? "";
      await refresh();
      patch(it.id, { stage: STAGES.length, unlocked: false, result: { n: res.transactions.length, recon: res.reconciliation.status, warnings: res.warnings, ocrUsed: res.ocr_used, reportId } });
      setDone((d) => [...d, it.id]);
    } catch (e) {
      const err = e instanceof ProcessError ? e : new ProcessError("error", "Something went wrong while processing this file.");
      if (err.code === "duplicate_statement") {
        const existing = typeof err.details?.report_id === "string" ? err.details.report_id : undefined;
        patch(it.id, { stage: -1, existing, error: "You've already uploaded this exact file." });
      } else if (err.code === "password_required" || err.code === "password_incorrect") {
        patch(it.id, { stage: -1, encrypted: true, unlocked: false });
        setPwError(err.code === "password_incorrect" ? err.message : null);
        setPwFor(it.id); // let the user retry with a corrected password — nothing was saved, so no duplicates
      } else if (err.code === "ocr_required") {
        patch(it.id, { stage: -1, needOcr: true });
      } else {
        patch(it.id, { stage: -1, error: err.message });
      }
    } finally {
      secrets.current.delete(it.id); // cleared after every attempt, success or failure
    }
  };

  const submitPassword = (pw: string) => {
    const id = pwFor;
    if (!id) return;
    if (pw.length === 0) return setPwError("Enter the document password.");
    secrets.current.set(id, pw);
    const it = items.find((i) => i.id === id);
    patch(id, { unlocked: true });
    setPwFor(null);
    setPwError(null);
    if (live && it?.triedOnce) void processLive({ ...it, unlocked: true }); // retry straight away with the corrected password
  };

  const ready = items.filter((i) => !i.error && !i.needOcr && (!i.encrypted || i.unlocked) && i.stage === -1);
  const blocked = items.some((i) => !i.error && i.encrypted && !i.unlocked);

  // ---------------------------------------------------------------- preview (sample mode)
  const runPreview = async (it: Item) => {
    for (let s = 0; s < STAGES.length; s++) {
      patch(it.id, { stage: s });
      await new Promise((r) => setTimeout(r, 450));
    }
    secrets.current.delete(it.id);
    addReport({ bookId: selected, name: safeName(it.file.name).replace(/\.[^.]+$/, ""), source: safeName(it.file.name), sizeBytes: it.file.size, period: "—", status: "uploaded" });
    patch(it.id, { stage: STAGES.length, unlocked: false });
    setDone((d) => [...d, it.id]);
  };

  const run = async () => {
    if (!selected || ready.length === 0) return;
    setRunning(true);
    for (const it of ready) await (live ? processLive(it) : runPreview(it));
    setRunning(false);
  };

  return (
    <div className="space-y-8">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Upload center</h1>
            <p className="text-sm text-muted">Add statements to a Report Book. PDF, CSV, XLSX and XLS up to 25 MB.</p>
          </div>
          {live ? (
            <Chip tone="ok"><Server size={12} /> Processed securely on the server</Chip>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-xs font-semibold"><FlaskConical size={13} aria-hidden /> Preview flow — sign in for real processing</span>
          )}
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        <section className="card p-5" aria-labelledby="dest-h">
          <h2 id="dest-h" className="mb-3 font-bold">1 · Choose a Report Book</h2>
          {books.length === 0 ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted">You don&apos;t have a Report Book yet — create one to group your statements.</p>
              <button onClick={() => setNewBook(true)} className="grad-brand inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white"><BookPlus size={16} /> New Report Book</button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Report Book">
              {books.map((b) => (
                <button key={b.id} role="radio" aria-checked={selected === b.id} onClick={() => setBookId(b.id)}
                  className={clsx("inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition", selected === b.id ? "border-brand bg-brand-soft text-brand" : "border-border bg-surface hover:bg-surface-muted")}>
                  <span className="size-2.5 rounded-full" style={{ background: b.color }} /> {b.name}
                </button>
              ))}
              <button onClick={() => setNewBook(true)} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-brand/50 px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-soft"><BookPlus size={15} /> New book</button>
            </div>
          )}
        </section>
      </Reveal>

      <Reveal delay={0.1}>
        <section aria-labelledby="drop-h">
          <h2 id="drop-h" className="mb-3 font-bold">2 · Add statements</h2>
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); void addFiles(e.dataTransfer.files); }}
            className={clsx("relative grid place-items-center rounded-3xl border-2 border-dashed p-10 text-center transition", drag ? "border-brand bg-brand-soft" : "border-border bg-surface hover:border-brand/50")}
          >
            <div>
              <span className="grad-brand tile-shadow mx-auto grid size-16 place-items-center rounded-2xl text-white"><UploadCloud size={30} aria-hidden /></span>
              <p className="mt-4 text-lg font-bold">Drag &amp; drop statements here</p>
              <p className="mt-1 text-sm text-muted">or</p>
              <button onClick={() => inputRef.current?.click()} className="mt-2 inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-bold transition hover:bg-surface-muted active:scale-95"><FileUp size={16} aria-hidden /> Browse files</button>
              <input ref={inputRef} type="file" multiple accept=".pdf,.csv,.xlsx,.xls" className="sr-only" aria-label="Choose statement files" onChange={(e) => { if (e.target.files) void addFiles(e.target.files); e.target.value = ""; }} />
              <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted"><ShieldCheck size={14} aria-hidden /> {live ? "Files are processed in memory on the server and are not stored." : "In sample mode files stay in this browser."}</p>
            </div>
          </div>
        </section>
      </Reveal>

      {items.length > 0 && (
        <section aria-labelledby="queue-h" className="space-y-3">
          <h2 id="queue-h" className="font-bold">3 · Review &amp; analyze</h2>
          {items.map((it) => {
            const Icon = it.kind ? KIND_ICON[it.kind] : AlertCircle;
            const finished = it.stage === STAGES.length;
            const working = live && it.stage === 0;
            const [reconLabel, reconTone] = it.result ? RECON[it.result.recon as keyof typeof RECON] ?? RECON.unknown : RECON.unknown;
            return (
              <div key={it.id} className="card p-4">
                <div className="flex items-center gap-4">
                  <span className={clsx("grid size-11 shrink-0 place-items-center rounded-xl text-white", it.error ? "grad-expense" : finished ? "grad-income" : "grad-ember")}>
                    {finished ? <CheckCircle2 size={20} /> : <Icon size={20} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{safeName(it.file.name)}</p>
                    <p className="text-xs text-muted">{formatBytes(it.file.size)} · {it.kind?.toUpperCase() ?? "unknown"}</p>
                    {it.error && <p role="alert" className="mt-1 text-sm font-medium text-expense">{it.error} {it.existing && <Link href={`/reports/${it.existing}`} className="font-bold underline">Open it</Link>}</p>}
                    {!it.error && it.encrypted && !it.unlocked && it.stage === -1 && <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-warning"><Lock size={14} /> Password-protected — enter the password to continue.</p>}
                    {!it.error && it.unlocked && it.stage === -1 && <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-income"><KeyRound size={14} /> Password ready (kept in memory only).</p>}
                    {it.needOcr && (
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium text-warning"><ScanText size={14} /> This looks like a scanned document.
                        <button onClick={() => void processLive(it, true)} className="rounded-lg bg-warning/20 px-3 py-1 font-bold text-foreground hover:bg-warning/30">Read it with OCR</button></p>
                    )}
                  </div>
                  {!it.error && it.encrypted && !it.unlocked && it.stage === -1 && (
                    <button onClick={() => { setPwError(null); setPwFor(it.id); }} className="grad-brand inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white"><KeyRound size={15} /> Enter password</button>
                  )}
                  {!running && !working && it.stage < STAGES.length && (
                    <button onClick={() => remove(it.id)} aria-label={`Remove ${it.file.name}`} className="grid size-9 place-items-center rounded-xl text-muted hover:bg-surface-muted hover:text-expense"><Trash2 size={17} /></button>
                  )}
                </div>

                {working && (
                  <div className="mt-4" role="status">
                    <div className="h-2 overflow-hidden rounded-full bg-surface-muted"><div className="grad-brand h-full w-1/3 animate-pulse rounded-full" /></div>
                    <p className="mt-2 flex items-center gap-2 text-xs text-muted"><Loader2 size={13} className="animate-spin" /> Processing on the server — unlocking, reading, normalizing and reconciling…</p>
                  </div>
                )}

                {!live && it.stage >= 0 && (
                  <div className="mt-4">
                    <div className="h-2 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-valuemin={0} aria-valuemax={STAGES.length} aria-valuenow={it.stage}>
                      <div className="grad-brand h-full rounded-full transition-all duration-500" style={{ width: `${(Math.min(it.stage + (finished ? 0 : 1), STAGES.length) / STAGES.length) * 100}%` }} />
                    </div>
                    <ol className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
                      {STAGES.map((s, i) => (
                        <li key={s} className={clsx("flex items-center gap-1.5", i < it.stage || finished ? "text-income" : i === it.stage ? "font-bold text-brand" : "text-muted")}>
                          {i < it.stage || finished ? <CheckCircle2 size={13} /> : i === it.stage ? <Loader2 size={13} className="animate-spin" /> : <span className="size-3 rounded-full border border-border" />} {s}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {finished && it.result && (
                  <div className="mt-4 space-y-2 rounded-2xl bg-surface-muted p-4 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>{it.result.n} transactions found</strong><Chip tone={reconTone}>{reconLabel}</Chip>
                      {it.result.ocrUsed && <Chip tone="warn"><ScanText size={11} /> OCR used — check flagged rows</Chip>}
                      <Link href={`/reports/${it.result.reportId}`} className="ml-auto font-bold text-brand hover:underline">Open report →</Link>
                    </div>
                    {it.result.warnings.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted">{it.result.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-sm text-muted">
              {blocked ? "Enter the password for protected files, or remove them." : ready.length ? `${ready.length} file${ready.length === 1 ? "" : "s"} ready for “${book?.name ?? "—"}”.` : "Nothing waiting."}
            </p>
            <button onClick={run} disabled={running || ready.length === 0 || blocked || !selected} className="grad-brand inline-flex h-12 items-center gap-2 rounded-2xl px-6 text-sm font-bold text-white shadow-lg shadow-rose-500/30 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">
              {running ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={18} />} {running ? "Processing…" : "Analyze statements"}
            </button>
          </div>
        </section>
      )}

      {done.length > 0 && (
        <div role="status" className="card flex flex-wrap items-center gap-3 border-income/40 p-4">
          <CheckCircle2 className="text-income" aria-hidden />
          <p className="flex-1 text-sm">
            <strong>{done.length}</strong> statement{done.length === 1 ? "" : "s"} added to <strong>{book?.name}</strong>
            {live ? " and analyzed — review the transactions in the report." : " with status Awaiting parser — sign in to process real statements."}
          </p>
          <Link href="/reports" className="text-sm font-bold text-brand hover:underline">Open Reports →</Link>
        </div>
      )}

      <PasswordModal open={pwFor !== null} error={pwError} onClose={() => { setPwFor(null); setPwError(null); }} onSubmit={submitPassword} fileName={items.find((i) => i.id === pwFor)?.file.name ?? ""} />
      <BookFormModal open={newBook} onClose={() => setNewBook(false)} onSaved={(b) => setBookId(b.id)} />
    </div>
  );
}

function PasswordModal({ open, error, onClose, onSubmit, fileName }: { open: boolean; error: string | null; onClose: () => void; onSubmit: (pw: string) => void; fileName: string }) {
  const [pw, setPw] = useState("");
  const close = () => { setPw(""); onClose(); };
  return (
    <Modal open={open} onClose={close} title="This file is password-protected">
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(pw); setPw(""); }} className="space-y-4">
        <p className="text-sm text-muted"><strong className="text-foreground">{safeName(fileName)}</strong> is encrypted. Enter its password to unlock it for analysis.</p>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Document password</span>
          <input autoFocus type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="off" className="h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/40" />
        </label>
        {error && <p role="alert" className="text-sm font-medium text-expense">{error}</p>}
        <p className="flex items-start gap-2 rounded-xl bg-surface-muted p-3 text-xs text-muted"><ShieldCheck size={15} className="mt-0.5 shrink-0" aria-hidden /> Your password is used once, kept only in memory, and never saved, logged or sent anywhere except over HTTPS to unlock this file.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={close} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface-muted">Cancel</button>
          <button type="submit" className="grad-brand rounded-xl px-5 py-2.5 text-sm font-bold text-white">Unlock</button>
        </div>
      </form>
    </Modal>
  );
}
