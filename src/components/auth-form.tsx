"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleAlert, Eye, EyeOff, FlaskConical, Loader2, Lock, Mail, ShieldCheck, User } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { clsx } from "clsx";
import { useAuth } from "@/lib/auth";
import { passwordStrength } from "@/lib/supabase-auth";

type Mode = "login" | "register" | "forgot";

const email = z.string().trim().min(1, "Enter your email").email("Enter a valid email address");
const schemas = {
  login: z.object({ email, password: z.string().min(1, "Enter your password") }),
  register: z
    .object({ name: z.string().trim().min(2, "Enter your name").max(80), email, password: z.string().min(8, "Use at least 8 characters"), confirm: z.string() })
    .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" }),
  forgot: z.object({ email }),
};
type Values = { name?: string; email: string; password?: string; confirm?: string };

const STRENGTH = [
  { label: "Enter a password", color: "bg-warning" },
  { label: "Too weak", color: "bg-expense" },
  { label: "Fair", color: "bg-warning" },
  { label: "Good", color: "bg-lime-500" },
  { label: "Strong", color: "bg-income" },
];

function Banner({ tone, children }: { tone: "error" | "info" | "warn"; children: React.ReactNode }) {
  const Icon = tone === "error" ? CircleAlert : tone === "info" ? CheckCircle2 : AlertTriangle;
  const c = tone === "error" ? "border-expense/30 bg-expense/10 text-expense" : tone === "info" ? "border-income/30 bg-income/10 text-income" : "border-warning/40 bg-warning/10 text-foreground";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={clsx("mb-4 flex items-start gap-3 rounded-2xl border p-3 text-sm", c)}>
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden />
      <p className="leading-relaxed text-foreground">{children}</p>
    </div>
  );
}

function Field({ label, error, icon: Icon, children }: { label: string; error?: string; icon: typeof Mail; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      <span className={clsx("flex items-center gap-2 rounded-2xl border bg-surface px-3.5 transition focus-within:ring-2 focus-within:ring-brand/40", error ? "border-expense" : "border-border focus-within:border-brand")}>
        <Icon size={18} className="text-muted" aria-hidden />
        {children}
      </span>
      {error && <span className="mt-1 block text-xs font-medium text-expense">{error}</span>}
    </label>
  );
}

const input = "h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted/70";

export function AuthForm({ initialMode = "login" }: { initialMode?: Mode }) {
  const auth = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [show, setShow] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schemas[mode]) as never, mode: "onSubmit" });
  const { register, handleSubmit, formState: { errors }, watch, reset } = form;
  const password = watch("password") ?? "";

  useEffect(() => {
    if (auth.status === "signedIn" || auth.status === "demo") router.replace("/");
  }, [auth.status, router]);

  const switchMode = (m: Mode) => {
    auth.clearMessages();
    reset({ email: form.getValues("email") });
    setMode(m);
  };

  const onSubmit = handleSubmit(async (v) => {
    if (mode === "login") await auth.signIn(v.email, v.password ?? "");
    else if (mode === "register") {
      const ok = await auth.signUp(v.name ?? "", v.email, v.password ?? "");
      if (ok) setMode("login");
    } else await auth.sendReset(v.email);
    reset({ email: v.email });
  });

  const title = { login: "Welcome back", register: "Create your account", forgot: "Reset your password" }[mode];
  const sub = {
    login: "Sign in to your statements and reports.",
    register: "One account works in Lensly and Ledgerly.",
    forgot: "Enter your email and we'll send a reset link.",
  }[mode];
  const cta = { login: "Sign in", register: "Create account", forgot: "Send reset link" }[mode];
  const strength = passwordStrength(password);

  return (
    <div className="card w-full max-w-md p-7 sm:p-8">
      {mode !== "login" && (
        <button type="button" onClick={() => switchMode("login")} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
          <ArrowLeft size={16} aria-hidden /> Back to sign in
        </button>
      )}
      <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
      <p className="mb-5 mt-1 text-sm text-muted">{sub}</p>

      {!auth.configured && <Banner tone="warn">Sign-in isn&apos;t configured in this build. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see the setup guide). You can still explore with sample data.</Banner>}
      {auth.error && <Banner tone="error">{auth.error}</Banner>}
      {auth.info && <Banner tone="info">{auth.info}</Banner>}

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {mode === "register" && (
          <Field label="Full name" icon={User} error={errors.name?.message}>
            <input {...register("name")} autoComplete="name" placeholder="Asha Patel" className={input} />
          </Field>
        )}
        <Field label="Email" icon={Mail} error={errors.email?.message}>
          <input {...register("email")} type="email" autoComplete="email" placeholder="you@example.com" className={input} />
        </Field>
        {mode !== "forgot" && (
          <Field label="Password" icon={Lock} error={errors.password?.message}>
            <input {...register("password")} type={show ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} className={input} />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="text-muted hover:text-foreground">
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </Field>
        )}
        {mode === "register" && (
          <>
            <div aria-live="polite">
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
                <div className={clsx("h-full rounded-full transition-all duration-500", STRENGTH[strength].color)} style={{ width: `${(strength / 4) * 100}%` }} />
              </div>
              <p className="mt-1.5 text-xs font-semibold text-muted">{STRENGTH[strength].label}</p>
            </div>
            <Field label="Confirm password" icon={ShieldCheck} error={errors.confirm?.message}>
              <input {...register("confirm")} type={show ? "text" : "password"} autoComplete="new-password" className={input} />
            </Field>
          </>
        )}
        {mode === "login" && (
          <div className="text-right">
            <button type="button" onClick={() => switchMode("forgot")} className="text-sm font-semibold text-brand hover:underline">Forgot password?</button>
          </div>
        )}
        <button
          type="submit"
          disabled={!auth.configured || auth.busy}
          className="grad-brand inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold text-white shadow-lg shadow-rose-500/30 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {auth.busy && <Loader2 size={18} className="animate-spin" aria-hidden />} {cta}
        </button>
      </form>

      {mode !== "forgot" && (
        <>
          <p className="mt-5 text-center text-sm text-muted">
            {mode === "login" ? "New here?" : "Already have an account?"}{" "}
            <button type="button" onClick={() => switchMode(mode === "login" ? "register" : "login")} className="font-bold text-brand hover:underline">
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
          <div className="my-5 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" /></div>
          <button type="button" onClick={auth.enterDemo} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface text-sm font-bold transition hover:bg-surface-muted active:scale-[0.98]">
            <FlaskConical size={16} aria-hidden /> Explore with sample data
          </button>
          <p className="mt-2 text-center text-xs text-muted">Sample mode stays in this browser and isn&apos;t linked to an account.</p>
        </>
      )}
    </div>
  );
}

export function AuthBrandPanel() {
  const points = [
    { t: "Protected PDFs", d: "Unlock password-protected statements. Passwords are never stored." },
    { t: "Report Books", d: "Group statements and reports into books you can find again." },
    { t: "One account, two apps", d: "The same sign-in and profile power CashBook." },
  ];
  return (
    <div className="grad-brand relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-center">
      <div aria-hidden className="absolute -right-24 -top-24 size-96 rounded-full bg-white/10" />
      <div aria-hidden className="absolute -bottom-32 -left-20 size-80 rounded-full bg-[#ffb703]/25 blur-2xl" />
      <div className="relative max-w-md">
        <Image src="/brand/logo.svg" alt="" width={64} height={64} priority />
        <h2 className="mt-7 text-4xl font-extrabold leading-tight tracking-tight">Know where your <span className="text-[#ffd166]">money</span> goes.</h2>
        <ul className="mt-9 space-y-5">
          {points.map((p) => (
            <li key={p.t} className="flex gap-3.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white/20"><ShieldCheck size={18} aria-hidden /></span>
              <div><p className="font-bold">{p.t}</p><p className="text-sm text-white/80">{p.d}</p></div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
