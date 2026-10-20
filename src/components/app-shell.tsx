"use client";

import {
  BarChart3,
  FileUp,
  Lightbulb,
  PiggyBank,
  Settings,
  LayoutDashboard,
  Search,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { Avatar } from "./avatar";
import { useAuth } from "@/lib/auth";
import { useRef } from "react";
import { CommandPalette } from "./command-palette";

type Item = { href: string; label: string; icon: LucideIcon };

export const NAV: Item[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/upload", label: "Upload", icon: FileUp },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/recommendations", label: "Savings", icon: Lightbulb },
  { href: "/budgets", label: "Budgets", icon: PiggyBank },
  { href: "/settings", label: "Settings", icon: Settings },
];

function useActive() {
  const path = usePathname();
  return (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
}

/** Desktop: fixed sidebar · Tablet/Phone: top bar + bottom tab bar. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const isActive = useActive();
  const auth = useAuth();
  const openPalette = useRef<(() => void) | null>(null);
  const searchBtn = "inline-flex items-center gap-2 rounded-xl border border-border bg-surface-muted px-3 py-2 text-sm font-semibold text-muted transition hover:text-foreground";

  return (
    <div className="min-h-dvh lg:flex">
      <a href="#main" className="sr-only z-50 rounded-xl bg-foreground px-4 py-2 text-sm font-bold text-background focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Skip to content</a>
      <CommandPalette openRef={openPalette} />
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-8 border-r border-border bg-surface p-5 lg:flex">
        <Link href="/" className="flex items-center gap-3">
          <Image src="/brand/logo.svg" alt="" width={40} height={40} priority />
          <span className="text-lg font-extrabold tracking-tight">Lensly</span>
        </Link>
        <button type="button" onClick={() => openPalette.current?.()} className={`${searchBtn} w-full`} aria-keyshortcuts="Control+K Meta+K">
          <Search size={16} aria-hidden /> Search <kbd className="ml-auto rounded-md border border-border px-1.5 py-0.5 text-[10px] font-bold">Ctrl K</kbd>
        </button>
        <nav aria-label="Primary" className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={clsx(
                "flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-medium transition-colors",
                isActive(href) ? "grad-brand font-bold text-white shadow-lg shadow-rose-500/30" : "text-muted hover:bg-surface-muted hover:text-foreground",
              )}
            >
              <Icon size={20} aria-hidden /> {label}
            </Link>
          ))}
        </nav>
        <Link href="/settings" className="mt-auto flex items-center gap-3 rounded-2xl bg-surface-muted p-3 transition hover:bg-brand-soft">
          <Avatar name={auth.displayName} size={38} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{auth.displayName}</span>
            <span className="block truncate text-xs text-muted">{auth.status === "demo" ? "Sample mode" : auth.email}</span>
          </span>
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
          <Image src="/brand/logo.svg" alt="" width={32} height={32} priority />
          <span className="font-extrabold tracking-tight">Lensly</span>
          <button type="button" onClick={() => openPalette.current?.()} aria-label="Search pages and reports" className={`${searchBtn} ml-auto !px-2.5`}><Search size={17} aria-hidden /></button>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-10 lg:pt-10">{children}</main>

        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-6 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        >
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={isActive(href) ? "page" : undefined}
              className={clsx(
                "flex flex-col items-center gap-1 py-2 text-[10px] font-semibold",
                isActive(href) ? "text-brand" : "text-muted",
              )}
            >
              <span className={clsx("grid h-7 w-12 place-items-center rounded-full transition-colors", isActive(href) && "bg-brand-soft")}>
                <Icon size={20} aria-hidden />
              </span>
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
