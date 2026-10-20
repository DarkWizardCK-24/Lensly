"use client";

import { Download, FileSpreadsheet, FileText, History, Loader2, Save } from "lucide-react";
import { useState } from "react";
import { Modal } from "@/components/modal";
import { useToast } from "@/components/ui";
import { ApiError, apiFetch, downloadFile } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type Version = { version: number; analysis_version: string; created_at: string };
const btn = "inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm font-bold hover:bg-surface-muted disabled:opacity-60";

/** Save a snapshot, browse saved versions and export — server-side, live reports only. */
export function ReportActions({ reportId, reportName, flush }: { reportId: string; reportName: string; flush: () => Promise<void> }) {
  const { getToken } = useAuth();
  const say = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [open, setOpen] = useState(false);

  const run = async (what: string, fn: (t: string) => Promise<void>) => {
    if (busy) return;
    setBusy(what);
    try {
      await flush(); // make sure the latest corrections are saved before a snapshot/export reads them
      const t = await getToken();
      if (!t) throw new ApiError("unauthorized", "Please sign in again.", 401);
      await fn(t);
    } catch (e) {
      say(e instanceof ApiError ? e.message : "That didn't work. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const snapshot = () => run("snapshot", async (t) => {
    const v = await apiFetch<Version>(t, `/reports/${reportId}/versions`, { method: "POST", json: {} });
    setVersions((cur) => (cur ? [v, ...cur] : cur));
    say(`Saved version ${v.version}`);
  });
  const showVersions = () => run("versions", async (t) => {
    setVersions(await apiFetch<Version[]>(t, `/reports/${reportId}/versions`));
    setOpen(true);
  });
  const exp = (format: "csv" | "xlsx" | "pdf") => run(format, async (t) => {
    await downloadFile(t, `/reports/${reportId}/export?format=${format}`, `${reportName}.${format}`);
    say(`${format.toUpperCase()} downloaded`);
  });
  const spin = (k: string, icon: React.ReactNode) => (busy === k ? <Loader2 size={16} className="animate-spin" /> : icon);

  return (
    <>
      <div className="flex flex-wrap gap-2" aria-label="Report actions">
        <button onClick={snapshot} disabled={!!busy} className={btn}>{spin("snapshot", <Save size={16} />)} Save snapshot</button>
        <button onClick={showVersions} disabled={!!busy} className={btn}>{spin("versions", <History size={16} />)} Versions</button>
        <button onClick={() => exp("csv")} disabled={!!busy} className={btn}>{spin("csv", <Download size={16} />)} CSV</button>
        <button onClick={() => exp("xlsx")} disabled={!!busy} className={btn}>{spin("xlsx", <FileSpreadsheet size={16} />)} Excel</button>
        <button onClick={() => exp("pdf")} disabled={!!busy} className={btn}>{spin("pdf", <FileText size={16} />)} PDF</button>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Saved versions">
        {versions && versions.length === 0 ? (
          <p className="text-sm text-muted">No versions yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {(versions ?? []).map((v) => (
              <li key={v.version} className="flex items-center justify-between py-3 text-sm">
                <span className="font-bold">Version {v.version}</span>
                <span className="text-muted">{new Date(v.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-muted">Versions are immutable snapshots of the analysis at the time you saved them. Later edits never change them.</p>
      </Modal>
    </>
  );
}
