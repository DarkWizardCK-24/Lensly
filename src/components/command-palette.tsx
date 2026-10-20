"use client";

import { BarChart3, FileUp, GitCompareArrows, Keyboard, Lightbulb, PiggyBank, Search, Settings, LayoutDashboard, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { Modal } from "./modal";
import { useReports } from "@/lib/reports";

type Cmd = { id: string; label: string; hint?: string; keys?: string; icon: LucideIcon; href: string };

const NAV_CMDS: Cmd[] = [
  { id: "dash", label: "Go to Dashboard", keys: "G D", icon: LayoutDashboard, href: "/" },
  { id: "upload", label: "Upload a statement", keys: "G U", icon: FileUp, href: "/upload" },
  { id: "reports", label: "Go to Reports", keys: "G R", icon: BarChart3, href: "/reports" },
  { id: "compare", label: "Compare two reports", keys: "G C", icon: GitCompareArrows, href: "/reports/compare" },
  { id: "savings", label: "Go to Savings ideas", keys: "G S", icon: Lightbulb, href: "/recommendations" },
  { id: "budgets", label: "Go to Budgets & goals", keys: "G B", icon: PiggyBank, href: "/budgets" },
  { id: "settings", label: "Settings, export and delete my data", keys: "G ,", icon: Settings, href: "/settings" },
];

const SEQUENCE: Record<string, string> = { d: "/", u: "/upload", r: "/reports", c: "/reports/compare", s: "/recommendations", b: "/budgets", ",": "/settings" };

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
};

/** Ctrl/⌘+K command palette, "G then …" navigation and "?" shortcut help. Everything is reachable without a mouse. */
export function CommandPalette({ openRef }: { openRef?: React.MutableRefObject<(() => void) | null> }) {
  const router = useRouter();
  const { reports } = useReports();
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const awaiting = useRef<number | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const show = useCallback(() => { setQ(""); setActive(0); setOpen(true); }, []);
  useEffect(() => {
    if (openRef) openRef.current = show;
    return () => { if (openRef) openRef.current = null; };
  }, [openRef, show]);

  // The dialog is only shown (showModal) after it mounts, so autoFocus alone fires too early.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => input.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [open]);

  const items = useMemo<Cmd[]>(() => {
    const rep: Cmd[] = reports.map((r) => ({ id: `r-${r.id}`, label: r.name, hint: `Report · ${r.period}`, icon: BarChart3, href: `/reports/${r.id}` }));
    const needle = q.trim().toLowerCase();
    const all = [...NAV_CMDS, ...rep];
    return needle ? all.filter((c) => `${c.label} ${c.hint ?? ""}`.toLowerCase().includes(needle)) : [...NAV_CMDS, ...rep.slice(0, 5)];
  }, [reports, q]);

  const run = useCallback((c: Cmd | undefined) => {
    if (!c) return;
    setOpen(false);
    router.push(c.href);
  }, [router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        show();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      if (document.querySelector("dialog[open]")) return; // a dialog owns the keyboard
      if (e.key === "?") { e.preventDefault(); setHelp(true); return; }
      if (awaiting.current) {
        const dest = SEQUENCE[e.key.toLowerCase()];
        window.clearTimeout(awaiting.current);
        awaiting.current = null;
        if (dest) { e.preventDefault(); router.push(dest); }
        return;
      }
      if (e.key.toLowerCase() === "g") awaiting.current = window.setTimeout(() => { awaiting.current = null; }, 1200);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, show]);

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); run(items[active]); }
  };

  return (
    <>
      <Modal open={open} onClose={() => setOpen(false)} title="Quick actions" wide>
        <label className="relative block">
          <span className="sr-only">Search pages and reports</span>
          <Search size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            ref={input}
            role="combobox"
            aria-expanded="true"
            aria-controls="cmd-list"
            aria-activedescendant={items[active] ? `cmd-${items[active].id}` : undefined}
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={onInputKey}
            placeholder="Search pages and reports…"
            className="h-12 w-full rounded-2xl border border-border bg-surface pl-10 pr-4 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/40"
          />
        </label>
        <ul id="cmd-list" role="listbox" aria-label="Results" className="mt-3 max-h-[320px] space-y-1 overflow-y-auto">
          {items.length === 0 && <li className="p-4 text-center text-sm text-muted">Nothing matches “{q}”.</li>}
          {items.map((c, i) => (
            <li key={c.id} id={`cmd-${c.id}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                tabIndex={-1}
                onMouseMove={() => setActive(i)}
                onClick={() => run(c)}
                className={clsx("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm", i === active ? "bg-brand-soft font-bold text-brand" : "hover:bg-surface-muted")}
              >
                <c.icon size={17} aria-hidden />
                <span className="min-w-0 flex-1 truncate">{c.label}{c.hint && <span className="ml-2 text-xs font-medium text-muted">{c.hint}</span>}</span>
                {c.keys && <kbd className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-bold text-muted">{c.keys}</kbd>}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">↑↓ to move · Enter to open · Esc to close · <button type="button" onClick={() => { setOpen(false); setHelp(true); }} className="font-bold text-brand hover:underline">all shortcuts</button></p>
      </Modal>

      <Modal open={help} onClose={() => setHelp(false)} title="Keyboard shortcuts">
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5 text-sm">
          <dt><kbd className="rounded-md border border-border px-1.5 py-0.5 text-xs font-bold">Ctrl</kbd> + <kbd className="rounded-md border border-border px-1.5 py-0.5 text-xs font-bold">K</kbd></dt><dd>Open quick actions (⌘ K on Mac)</dd>
          <dt><kbd className="rounded-md border border-border px-1.5 py-0.5 text-xs font-bold">?</kbd></dt><dd>Show this help</dd>
          {NAV_CMDS.map((c) => <><dt key={`k-${c.id}`}>{c.keys?.split(" ").map((k, i) => <span key={i}>{i > 0 && " then "}<kbd className="rounded-md border border-border px-1.5 py-0.5 text-xs font-bold">{k}</kbd></span>)}</dt><dd key={`d-${c.id}`}>{c.label}</dd></>)}
        </dl>
        <p className="mt-4 flex items-center gap-2 text-xs text-muted"><Keyboard size={14} aria-hidden /> Shortcuts are ignored while you are typing in a field.</p>
      </Modal>
    </>
  );
}
