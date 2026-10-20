"use client";

import { CheckCircle2, X } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";
import { clsx } from "clsx";

// ---------------------------------------------------------------- toast
const ToastCtx = createContext<(m: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const say = useCallback((m: string) => {
    setMsg(m);
    setTimeout(() => setMsg((cur) => (cur === m ? null : cur)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={say}>
      {children}
      {msg && (
        <div role="status" className="fixed bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-foreground px-5 py-3 text-sm font-semibold text-background shadow-2xl lg:bottom-8">
          <CheckCircle2 size={16} aria-hidden /> {msg}
          <button onClick={() => setMsg(null)} aria-label="Dismiss" className="ml-2 opacity-70 hover:opacity-100"><X size={14} /></button>
        </div>
      )}
    </ToastCtx.Provider>
  );
}

// ----------------------------------------------------------------- tabs
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; badge?: string | number }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-surface p-1.5">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={clsx("flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition", value === t.id ? "grad-brand text-white shadow-md shadow-rose-500/30" : "text-muted hover:bg-surface-muted hover:text-foreground")}>
          {t.label}
          {t.badge !== undefined && <span className={clsx("rounded-full px-2 py-0.5 text-[11px]", value === t.id ? "bg-white/25" : "bg-surface-muted")}>{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- bits
export function Chip({ tone = "muted", children, title }: { tone?: "muted" | "ok" | "warn" | "bad" | "brand"; children: React.ReactNode; title?: string }) {
  const c = { muted: "bg-surface-muted text-muted", ok: "bg-income/10 text-income", warn: "bg-warning/20 text-foreground", bad: "bg-expense/10 text-expense", brand: "bg-brand-soft text-brand" }[tone];
  return <span title={title} className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold", c)}>{children}</span>;
}

export function Kpi({ label, value, icon: Icon, tone, sub }: { label: string; value: string; icon: typeof X; tone: string; sub?: string }) {
  return (
    <div className="card card-lift flex items-center gap-4 p-5">
      <span className={clsx("tile-shadow grid size-12 shrink-0 place-items-center rounded-2xl text-white", tone)}><Icon size={22} aria-hidden /></span>
      <div className="min-w-0">
        <p className="text-sm text-muted">{label}</p>
        <p className="truncate text-xl font-extrabold tracking-tight">{value}</p>
        {sub && <p className="text-xs text-muted">{sub}</p>}
      </div>
    </div>
  );
}

export function Bar({ value, color, gradient }: { value: number; color?: string; gradient?: string }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
      <div className={clsx("h-full rounded-full transition-all duration-700", gradient)} style={{ width: `${Math.max(0, Math.min(100, value * 100))}%`, background: color }} />
    </div>
  );
}

export const money = (minor: number, digits = 0) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(minor / 100);
