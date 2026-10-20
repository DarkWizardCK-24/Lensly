"use client";

import { ArrowDownLeft, ArrowUpRight, FlaskConical, Repeat, ShoppingBag, Utensils, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { motion, useReducedMotion } from "motion/react";
import { clsx } from "clsx";

/** ILLUSTRATIVE numbers only — shown so the report design can be reviewed before statement parsing exists (Phase 5). */
const inr = (v: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

const CATEGORIES = [
  { name: "Housing", value: 22000, color: "#e11d48" },
  { name: "Food & dining", value: 18400, color: "#ff7a2f" },
  { name: "Shopping", value: 9600, color: "#ffb703" },
  { name: "Transport", value: 5200, color: "#fb7185" },
  { name: "Subscriptions", value: 2300, color: "#881337" },
];
const MONTHS = [
  { m: "May", credit: 72000, debit: 48000 },
  { m: "Jun", credit: 76000, debit: 52000 },
  { m: "Jul", credit: 74000, debit: 61000 },
  { m: "Aug", credit: 81000, debit: 55000 },
  { m: "Sep", credit: 79000, debit: 49000 },
  { m: "Oct", credit: 85000, debit: 57500 },
];
const RECENT = [
  { icon: Wallet, title: "Salary credit", meta: "01 Oct · NEFT", amount: 85000, credit: true },
  { icon: ShoppingBag, title: "Online order", meta: "04 Oct · Card", amount: 3499, credit: false },
  { icon: Repeat, title: "Streaming plan", meta: "05 Oct · Auto-debit · recurring?", amount: 499, credit: false },
  { icon: Utensils, title: "Restaurant", meta: "07 Oct · UPI", amount: 1280, credit: false },
];

function Progress({ value, className, color }: { value: number; className?: string; color?: string }) {
  const reduce = useReducedMotion();
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
      <motion.div
        className={clsx("h-full rounded-full", className)}
        style={color ? { background: color } : undefined}
        initial={reduce ? false : { width: 0 }}
        whileInView={{ width: `${value}%` }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />
    </div>
  );
}

export function SampleReport() {
  const total = CATEGORIES.reduce((s, c) => s + c.value, 0);
  const credit = 85000;
  const debit = 57500;
  return (
    <section aria-labelledby="sample-h">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 id="sample-h" className="text-base font-bold">What a report will look like</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-xs font-semibold">
          <FlaskConical size={13} aria-hidden /> Sample data — illustrative only
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Money in", value: credit, icon: ArrowDownLeft, tone: "grad-income", glow: "rgb(5 150 105 / .5)" },
          { label: "Money out", value: debit, icon: ArrowUpRight, tone: "grad-expense", glow: "rgb(225 29 72 / .5)" },
          { label: "Net cash flow", value: credit - debit, icon: Wallet, tone: "grad-gold", glow: "rgb(255 138 31 / .5)" },
        ].map(({ label, value, icon: Icon, tone, glow }) => (
          <div key={label} className="card card-lift flex items-center gap-4 p-5">
            <span className={`${tone} tile-shadow grid size-12 place-items-center rounded-2xl text-white`} style={{ ["--tile" as string]: glow }}>
              <Icon size={22} aria-hidden />
            </span>
            <div>
              <p className="text-sm text-muted">{label}</p>
              <p className="text-xl font-extrabold tracking-tight">{inr(value)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="font-bold">Spending by category</h3>
          <p className="text-sm text-muted">October</p>
          <div className="mt-4 grid items-center gap-4 sm:grid-cols-[170px_1fr]">
            <div className="relative mx-auto h-[170px] w-[170px]" role="img" aria-label="Donut chart of spending by category">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={CATEGORIES} dataKey="value" innerRadius={58} outerRadius={82} paddingAngle={3} cornerRadius={6} stroke="none" animationDuration={900}>
                    {CATEGORIES.map((c) => <Cell key={c.name} fill={c.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                <div>
                  <p className="text-xs text-muted">Total</p>
                  <p className="text-sm font-extrabold">{inr(total)}</p>
                </div>
              </div>
            </div>
            <ul className="space-y-3">
              {CATEGORIES.map((c) => (
                <li key={c.name}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 font-semibold"><span className="size-2.5 rounded-full" style={{ background: c.color }} />{c.name}</span>
                    <span className="text-muted">{inr(c.value)} · {Math.round((c.value / total) * 100)}%</span>
                  </div>
                  <Progress value={(c.value / total) * 100} color={c.color} />
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-bold">Credits vs debits</h3>
          <p className="text-sm text-muted">Last 6 months</p>
          <div className="mt-4 h-[230px]" role="img" aria-label="Bar chart of monthly credits and debits">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={MONTHS} barGap={4}>
                <defs>
                  <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#34d399" /><stop offset="1" stopColor="#059669" /></linearGradient>
                  <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fb7185" /><stop offset="1" stopColor="#e11d48" /></linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="m" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} width={44} tick={{ fill: "var(--muted)", fontSize: 12 }} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip cursor={{ fill: "rgb(225 29 72 / 0.06)" }} formatter={(v) => inr(Number(v))} contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--foreground)" }} />
                <Bar dataKey="credit" name="Credits" fill="url(#gIn)" radius={[6, 6, 0, 0]} animationDuration={900} />
                <Bar dataKey="debit" name="Debits" fill="url(#gOut)" radius={[6, 6, 0, 0]} animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="card p-5">
          <h3 className="font-bold">Reconciliation</h3>
          <p className="text-sm text-muted">Opening + credits − debits = closing</p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted">Opening balance</span><span className="font-semibold">{inr(42000)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Total credits</span><span className="font-semibold text-income">+{inr(credit)}</span></div>
            <div className="flex justify-between"><span className="text-muted">Total debits</span><span className="font-semibold text-expense">−{inr(debit)}</span></div>
            <div className="flex justify-between border-t border-border pt-3 font-bold"><span>Closing balance</span><span>{inr(42000 + credit - debit)}</span></div>
          </div>
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs font-semibold"><span>Transactions matched</span><span className="text-income">100%</span></div>
            <Progress value={100} className="grad-income" />
          </div>
        </div>

        <div className="card p-5">
          <h3 className="font-bold">Recent transactions</h3>
          <ol className="relative mt-4 ml-3 border-l-2 border-border">
            {RECENT.map(({ icon: Icon, title, meta, amount, credit: isCredit }) => (
              <li key={title} className="relative mb-4 list-none pl-7 last:mb-0">
                <span className={clsx("absolute -left-[15px] top-0.5 grid size-7 place-items-center rounded-lg text-white ring-4 ring-surface", isCredit ? "grad-income" : "grad-expense")}>
                  <Icon size={14} aria-hidden />
                </span>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{title}</p>
                    <p className="truncate text-xs text-muted">{meta}</p>
                  </div>
                  <span className={clsx("shrink-0 rounded-lg px-2.5 py-1 text-sm font-extrabold", isCredit ? "bg-income/10 text-income" : "bg-expense/10 text-expense")}>
                    {isCredit ? "+" : "−"}{inr(amount)}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
