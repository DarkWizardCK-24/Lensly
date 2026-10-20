"use client";

import { BadgeCheck, CloudOff, FlaskConical, Globe, IndianRupee, LogOut, Pencil, RefreshCw, User } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { DataControls } from "@/components/data-controls";
import { Modal } from "@/components/modal";
import { Reveal } from "@/components/reveal";
import { SystemStatus } from "@/components/system-status";
import { useAuth } from "@/lib/auth";
import { fetchProfile, type Profile } from "@/lib/supabase-auth";

export default function SettingsPage() {
  const auth = useAuth();
  const demo = auth.status === "demo";
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmOut, setConfirmOut] = useState(false);

  const [tick, setTick] = useState(0);
  const userId = auth.session?.userId;
  const { getToken } = auth;

  useEffect(() => {
    let alive = true;
    (async () => {
      const t = demo ? null : await getToken();
      const p = t ? await fetchProfile(t) : null;
      if (alive) setProfile(p);
    })();
    return () => { alive = false; };
  }, [demo, userId, tick, getToken]);

  const load = useCallback(() => { setProfile(undefined); setTick((n) => n + 1); }, []);

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3500); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (n.length < 2 || n.length > 80) return setErr("Enter between 2 and 80 characters.");
    const res = await auth.updateName(n);
    setEditing(false);
    say(res ?? "Name updated and synced");
    load();
  };

  return (
    <div className="space-y-8">
      <Reveal>
        <h1 className="text-2xl font-extrabold tracking-tight">Settings</h1>
        <p className="text-sm text-muted">Your account, shared profile and system status.</p>
      </Reveal>

      <Reveal delay={0.05}>
        <section className="card p-6" aria-labelledby="acct-h">
          <h2 id="acct-h" className="sr-only">Account</h2>
          <div className="flex flex-wrap items-center gap-5">
            <Avatar name={auth.displayName} size={72} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xl font-extrabold">{auth.displayName}</p>
              <p className="truncate text-sm text-muted">{auth.email}</p>
              <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${demo ? "bg-warning/15" : "bg-income/15 text-income"}`}>
                {demo ? <FlaskConical size={13} /> : <BadgeCheck size={13} />} {demo ? "Sample mode · not linked to an account" : "Signed in"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {!demo && <button onClick={() => { setName(auth.displayName); setErr(null); setEditing(true); }} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold hover:bg-surface-muted"><Pencil size={15} /> Edit name</button>}
              <button onClick={() => setConfirmOut(true)} className="inline-flex items-center gap-2 rounded-xl border border-expense/40 px-4 py-2.5 text-sm font-bold text-expense hover:bg-expense/10"><LogOut size={15} /> {demo ? "Create an account" : "Sign out"}</button>
            </div>
          </div>

          {!demo && (
            <div className="mt-6 border-t border-border pt-5">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Shared profile</p>
              {profile === undefined ? (
                <div className="h-5 w-56 animate-pulse rounded-full bg-surface-muted" />
              ) : profile === null ? (
                <p className="flex items-center gap-2 text-sm font-medium text-warning"><CloudOff size={16} /> Profile service unreachable. Your sign-in still works; details will sync when it&apos;s back.
                  <button onClick={load} className="ml-2 inline-flex items-center gap-1 font-bold text-brand hover:underline"><RefreshCw size={13} /> Retry</button></p>
              ) : (
                <>
                  <dl className="grid gap-3 sm:grid-cols-3">
                    {[[User, "Display name", profile.display_name ?? auth.displayName], [IndianRupee, "Default currency", profile.default_currency], [Globe, "Time zone", profile.timezone]].map(([I, l, v]) => {
                      const Icon = I as typeof User;
                      return <div key={l as string} className="rounded-2xl bg-surface-muted p-3.5"><dt className="flex items-center gap-1.5 text-xs text-muted"><Icon size={14} /> {l as string}</dt><dd className="mt-1 font-bold">{v as string}</dd></div>;
                    })}
                  </dl>
                  <p className="mt-3 flex items-center gap-2 text-sm font-medium text-income"><RefreshCw size={14} /> Synced — CashBook shows the same profile.</p>
                </>
              )}
            </div>
          )}
        </section>
      </Reveal>

      <Reveal delay={0.1}><DataControls /></Reveal>

      <Reveal delay={0.15}><SystemStatus /></Reveal>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit your name">
        <form onSubmit={save} className="space-y-4">
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={80} aria-label="Display name" className="h-12 w-full rounded-2xl border border-border bg-surface px-4 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/40" />
          {err && <p role="alert" className="text-sm font-medium text-expense">{err}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface-muted">Cancel</button>
            <button type="submit" className="grad-brand rounded-xl px-5 py-2.5 text-sm font-bold text-white">Save</button>
          </div>
        </form>
      </Modal>

      <Modal open={confirmOut} onClose={() => setConfirmOut(false)} title={demo ? "Leave sample mode?" : "Sign out?"}>
        <p className="text-sm text-muted">{demo ? "Sample reports and books will be discarded." : "You'll need to sign in again to see your reports."}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setConfirmOut(false)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-surface-muted">Cancel</button>
          <button onClick={() => void auth.signOut()} className="rounded-xl bg-expense px-5 py-2.5 text-sm font-bold text-white">{demo ? "Leave" : "Sign out"}</button>
        </div>
      </Modal>

      {toast && <div role="status" className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-foreground px-5 py-3 text-sm font-semibold text-background shadow-2xl lg:bottom-8">{toast}</div>}
    </div>
  );
}
