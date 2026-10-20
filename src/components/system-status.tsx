"use client";

import { useQuery } from "@tanstack/react-query";
import { Database, RefreshCw, Server, type LucideIcon } from "lucide-react";
import { clsx } from "clsx";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type Status = { apiUp: boolean; dbReady: boolean; detail?: string };

async function fetchStatus(): Promise<Status> {
  try {
    const h = await fetch(`${API}/api/v1/health`);
    if (!h.ok) return { apiUp: false, dbReady: false };
    const r = await fetch(`${API}/api/v1/ready`);
    const body = await r.json();
    return { apiUp: true, dbReady: r.ok, detail: body.database };
  } catch {
    return { apiUp: false, dbReady: false, detail: "Backend unreachable" };
  }
}

function Tile({ icon: Icon, title, loading, ok, okText, badText }: {
  icon: LucideIcon; title: string; loading: boolean; ok: boolean; okText: string; badText: string;
}) {
  const tone = loading ? "bg-surface-muted text-muted" : ok ? "grad-income text-white tile-shadow" : "grad-expense text-white tile-shadow";
  return (
    <div className="card card-lift flex items-center gap-4 p-5">
      <span className={clsx("grid size-12 place-items-center rounded-2xl", tone)}><Icon size={22} aria-hidden /></span>
      <div className="min-w-0">
        <p className="text-sm font-bold">{title}</p>
        <p className={clsx("truncate text-sm font-semibold", loading ? "text-muted" : ok ? "text-income" : "text-expense")}>
          {loading ? "Checking…" : ok ? okText : badText}
        </p>
      </div>
    </div>
  );
}

export function SystemStatus() {
  const q = useQuery({ queryKey: ["status"], queryFn: fetchStatus });
  const s = q.data;
  const loading = q.isFetching;
  return (
    <section aria-labelledby="status-h">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="status-h" className="text-base font-bold">System status</h2>
        <button
          onClick={() => q.refetch()}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-semibold transition hover:bg-surface-muted active:scale-95"
        >
          <RefreshCw size={16} className={clsx(loading && "animate-spin")} aria-hidden /> Re-check
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Tile icon={Server} title="FastAPI backend" loading={loading} ok={!!s?.apiUp} okText="Online" badText="Unreachable" />
        <Tile icon={Database} title="Supabase database" loading={loading} ok={!!s?.dbReady} okText="Connected" badText={s?.detail ?? "Not connected"} />
      </div>
    </section>
  );
}
