/**
 * Statement model + pure analysis functions for the Analyzer UI (Phase 4).
 * All money is integer minor units (paise). The sample statements below are GENERATED, clearly
 * illustrative data; the real parser/API replaces `sampleStatement` in Phase 5.
 */
import { catOf } from "./categories";

export type RawTxn = {
  id: string;
  date: string; // YYYY-MM-DD as printed on the statement
  raw: string; // original extracted description (kept for audit)
  ref: string;
  debit: number;
  credit: number;
  balance: number | null; // running balance as printed (null when the statement has no balance column)
  source: "text" | "ocr";
  confidence: number; // 0..1
  merchant: string; // normalized
  suggested: string; // suggested category id
  method: string;
};
export type Meta = { bank: string; accountMask: string; opening: number | null; closing: number | null; start: string; end: string; openingSource?: string | null; closingSource?: string | null };
export type Statement = { meta: Meta; txns: RawTxn[] };
export type Edit = { category?: string; merchant?: string; reviewed?: boolean };
export type Edits = Record<string, Edit>;
export type EffTxn = RawTxn & { category: string; merchantN: string; edited: boolean; reviewed: boolean; dupOf?: string };

// ------------------------------------------------------------------ helpers
export const DAY = 86_400_000;
export const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
export const addDays = (d: string, n: number) => new Date(toMs(d) + n * DAY).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / DAY);

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashSeed = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

// ----------------------------------------------------------- sample statements
type Tpl = { m: string; raw: (n: number) => string; cat: string; lo: number; hi: number; method: string; w: number };
const PERSONAL: Tpl[] = [
  { m: "Swiggy", raw: (n) => `UPI-SWIGGY-ORDER ${n}`, cat: "food", lo: 25000, hi: 65000, method: "UPI", w: 4 },
  { m: "FreshMart", raw: (n) => `POS ${n} FRESHMART`, cat: "food", lo: 80000, hi: 280000, method: "Debit card", w: 2 },
  { m: "RideNow", raw: (n) => `UPI-RIDENOW-${n}`, cat: "transport", lo: 12000, hi: 50000, method: "UPI", w: 3 },
  { m: "Indian Oil", raw: (n) => `POS ${n} INDIAN OIL`, cat: "transport", lo: 150000, hi: 300000, method: "Debit card", w: 1 },
  { m: "ShopKart", raw: (n) => `ECOM ${n} SHOPKART`, cat: "shopping", lo: 40000, hi: 350000, method: "Debit card", w: 2 },
  { m: "CineMax", raw: (n) => `UPI-CINEMAX-${n}`, cat: "fun", lo: 30000, hi: 90000, method: "UPI", w: 1 },
  { m: "CareChem", raw: (n) => `POS ${n} CARECHEM`, cat: "health", lo: 20000, hi: 90000, method: "Debit card", w: 1 },
];
type Monthly = { m: string; raw: string; cat: string; amt: number; day: number; credit?: boolean; method: string };

type Cfg = {
  id: string;
  bank: string;
  mask: string;
  start: string;
  days: number;
  opening?: number;
  monthly: Monthly[];
  daily: Tpl[];
  boost?: number; // extra delivery orders
  ocr?: boolean;
  closingDelta?: number; // statement prints a closing balance this far from the extracted total
  typoAt?: number; // index of a row whose printed balance is wrong
  duplicate?: boolean;
};

const PERSONAL_MONTHLY: Monthly[] = [
  { m: "Acme Corp", raw: "NEFT-ACME CORP-SALARY", cat: "salary", amt: 8500000, day: 0, credit: true, method: "Bank transfer" },
  { m: "Landlord", raw: "NEFT-RENT-LANDLORD", cat: "housing", amt: 2200000, day: 1, method: "Bank transfer" },
  { m: "Netflix", raw: "ACH D- NETFLIX.COM", cat: "subs", amt: 49900, day: 4, method: "Other" },
  { m: "TuneBox", raw: "ACH D- TUNEBOX PREMIUM", cat: "subs", amt: 19900, day: 6, method: "Other" },
  { m: "City Power", raw: "BBPS-CITY POWER BILL", cat: "utilities", amt: 168000, day: 11, method: "UPI" },
];
const BUSINESS_MONTHLY: Monthly[] = [
  { m: "Northwind Studio", raw: "NEFT-NORTHWIND STUDIO-INV", cat: "income", amt: 4200000, day: 8, credit: true, method: "Bank transfer" },
  { m: "WorkSpace Co", raw: "NEFT-WORKSPACE CO RENT", cat: "housing", amt: 1800000, day: 1, method: "Bank transfer" },
  { m: "Cloudhost", raw: "ACH D- CLOUDHOST", cat: "subs", amt: 129900, day: 5, method: "Other" },
  { m: "Pixelcraft", raw: "ACH D- PIXELCRAFT SOFTWARE", cat: "subs", amt: 35000, day: 5, method: "Other" },
];

const CFG: Record<string, Cfg> = {
  r1: { id: "r1", bank: "Sample Bank", mask: "••4821", start: "2026-09-01", days: 30, opening: 4200000, monthly: PERSONAL_MONTHLY, daily: PERSONAL, duplicate: true },
  r2: { id: "r2", bank: "Sample Bank", mask: "••4821", start: "2026-10-01", days: 31, monthly: PERSONAL_MONTHLY, daily: PERSONAL, boost: 0.45, typoAt: 22 },
  r3: { id: "r3", bank: "Sample Bank", mask: "••7710", start: "2026-07-01", days: 92, opening: 1500000, monthly: BUSINESS_MONTHLY, daily: PERSONAL.slice(0, 3), closingDelta: 125000 },
  r4: { id: "r4", bank: "Sample Bank", mask: "••0932", start: "2026-10-01", days: 31, opening: 800000, monthly: [{ ...PERSONAL_MONTHLY[0], amt: 4200000, raw: "NEFT-JOINT CONTRIBUTION" }], daily: PERSONAL.slice(0, 4), ocr: true },
};

const memo = new Map<string, Statement>();
/** Statements parsed by the server for the signed-in user (hydrated from storage by the reports provider). */
const registry = new Map<string, Statement>();
export const registerStatement = (id: string, st: Statement) => void registry.set(id, st);
export const unregisterStatement = (id: string) => void registry.delete(id);
export const clearRegistry = () => registry.clear();

/** Deterministic illustrative statement for a sample report id (null for anything else). */
export function sampleStatement(reportId: string): Statement | null {
  if (registry.has(reportId)) return registry.get(reportId)!;
  if (memo.has(reportId)) return memo.get(reportId)!;
  const c = CFG[reportId];
  if (!c) return null;
  const rnd = mulberry32(hashSeed(reportId));
  const opening = c.opening ?? (c.id === "r2" ? sampleStatement("r1")!.txns.at(-1)!.balance! : 0);
  type Ev = { date: string; m: string; raw: string; cat: string; amt: number; credit: boolean; method: string };
  const events: Ev[] = [];

  const months = Math.max(1, Math.round(c.days / 30));
  for (let k = 0; k < months; k++) {
    const mStart = addDays(c.start, k * 30);
    for (const mo of c.monthly) events.push({ date: addDays(mStart, mo.day), m: mo.m, raw: mo.raw, cat: mo.cat, amt: mo.amt, credit: !!mo.credit, method: mo.method });
  }
  const total = c.daily.reduce((s, t) => s + t.w, 0);
  for (let d = 0; d < c.days; d++) {
    const n = Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      let pick = rnd() * total;
      const tpl = c.daily.find((t) => (pick -= t.w) < 0) ?? c.daily[0];
      const amt = Math.round((tpl.lo + rnd() * (tpl.hi - tpl.lo)) / 100) * 100;
      events.push({ date: addDays(c.start, d), m: tpl.m, raw: tpl.raw(1000 + Math.floor(rnd() * 8999)), cat: tpl.cat, amt, credit: false, method: tpl.method });
    }
    if (c.boost && rnd() < c.boost) events.push({ date: addDays(c.start, d), m: "Swiggy", raw: `UPI-SWIGGY-ORDER ${1000 + Math.floor(rnd() * 8999)}`, cat: "food", amt: Math.round((30000 + rnd() * 40000) / 100) * 100, credit: false, method: "UPI" });
    if (d % 9 === 3) events.push({ date: addDays(c.start, d), m: "Bank", raw: "SMS ALERT CHARGES", cat: "fees", amt: 1770, credit: false, method: "Other" });
  }
  events.push({ date: addDays(c.start, 17), m: "Bank", raw: "LATE PAYMENT FEE", cat: "fees", amt: 59000, credit: false, method: "Other" });
  if (c.duplicate) for (let i = 0; i < 2; i++) events.push({ date: addDays(c.start, 12), m: "ShopKart", raw: "ECOM 4471 SHOPKART", cat: "shopping", amt: 149900, credit: false, method: "Debit card" });

  events.sort((a, b) => (a.date === b.date ? Number(b.credit) - Number(a.credit) : a.date < b.date ? -1 : 1));
  let bal = opening;
  const txns: RawTxn[] = events.map((e, i) => {
    bal += e.credit ? e.amt : -e.amt;
    const low = c.ocr && (i % 7 === 3 || i === 5);
    return {
      id: `${reportId}-${i + 1}`,
      date: e.date,
      raw: e.raw,
      ref: `REF${String(40000 + i * 37).padStart(6, "0")}`,
      debit: e.credit ? 0 : e.amt,
      credit: e.credit ? e.amt : 0,
      balance: c.typoAt === i ? bal + 50000 : bal,
      source: c.ocr ? "ocr" : "text",
      confidence: c.ocr ? (low ? (i === 5 ? 0.46 : 0.68) : 0.9) : 0.98,
      merchant: e.m,
      suggested: e.cat,
      method: e.method,
    };
  });
  const st: Statement = { meta: { bank: c.bank, accountMask: c.mask, opening, closing: bal + (c.closingDelta ?? 0), start: c.start, end: addDays(c.start, c.days - 1) }, txns };
  memo.set(reportId, st);
  return st;
}

// ---------------------------------------------------------------- effective view
export const effective = (txns: RawTxn[], edits: Edits): EffTxn[] => {
  const base = txns.map((t) => {
    const e = edits[t.id] ?? {};
    return { ...t, category: e.category ?? t.suggested, merchantN: e.merchant ?? t.merchant, edited: !!(e.category || e.merchant), reviewed: !!e.reviewed } as EffTxn;
  });
  const dups = detectDuplicates(base);
  return base.map((t) => ({ ...t, dupOf: dups.get(t.id) }));
};

/** Same date, amount and merchant on two or more debits → later ones are flagged (explainable, never auto-removed). */
export function detectDuplicates(txns: Pick<RawTxn, "id" | "date" | "debit" | "merchant">[] & Partial<EffTxn>[]): Map<string, string> {
  const seen = new Map<string, string>();
  const out = new Map<string, string>();
  for (const t of txns as EffTxn[]) {
    if (!t.debit) continue;
    const key = `${t.date}|${t.debit}|${(t.merchantN ?? t.merchant).toLowerCase()}`;
    const first = seen.get(key);
    if (first) out.set(t.id, first);
    else seen.set(key, t.id);
  }
  return out;
}

// ------------------------------------------------------------- reconciliation
export type Recon = {
  status: "reconciled" | "warnings" | "not_reconciled" | "unknown";
  credits: number;
  debits: number;
  expectedClosing: number;
  statementClosing: number | null;
  difference: number;
  rowIssues: { id: string; index: number; expected: number; printed: number }[];
};

/** Opening + credits − debits = closing, plus a row-by-row running-balance check. Never forces numbers to match. */
export function reconcile(st: Statement): Recon {
  const credits = st.txns.reduce((sum, t) => sum + t.credit, 0);
  const debits = st.txns.reduce((sum, t) => sum + t.debit, 0);
  const opening = st.meta.opening;
  const closing = st.meta.closing;
  const expectedClosing = (opening ?? 0) + credits - debits;
  const rowIssues: Recon["rowIssues"] = [];
  let prev: number | null = opening;
  st.txns.forEach((t, index) => {
    if (t.balance !== null && prev !== null) {
      const expected = prev + t.credit - t.debit;
      if (expected !== t.balance) rowIssues.push({ id: t.id, index, expected, printed: t.balance });
    }
    if (t.balance !== null) prev = t.balance;
  });
  if (opening === null || closing === null) return { status: "unknown", credits, debits, expectedClosing, statementClosing: closing, difference: 0, rowIssues };
  const difference = closing - expectedClosing;
  const status: Recon["status"] = difference !== 0 ? "not_reconciled" : rowIssues.length ? "warnings" : "reconciled";
  return { status, credits, debits, expectedClosing, statementClosing: closing, difference, rowIssues };
}

// ---------------------------------------------------------------- analysis
export type Summary = { credits: number; debits: number; net: number; count: number; avgDaily: number; byCategory: [string, number][] };

export function summarize(txns: EffTxn[], days: number): Summary {
  const credits = txns.reduce((s, t) => s + t.credit, 0);
  const debits = txns.reduce((s, t) => s + t.debit, 0);
  const m = new Map<string, number>();
  for (const t of txns) if (t.debit) m.set(t.category, (m.get(t.category) ?? 0) + t.debit);
  return { credits, debits, net: credits - debits, count: txns.length, avgDaily: days > 0 ? Math.round(debits / days) : 0, byCategory: [...m.entries()].sort((a, b) => b[1] - a[1]) };
}

export type Recurring = { merchant: string; count: number; amount: number; every: string; confidence: "probable" };

/** Probable monthly payments: ≥2 debits to one merchant, amounts within 5% of the median, 25–35 days apart. */
export function detectRecurring(txns: EffTxn[]): Recurring[] {
  const by = new Map<string, EffTxn[]>();
  for (const t of txns) if (t.debit) by.set(t.merchantN.toLowerCase(), [...(by.get(t.merchantN.toLowerCase()) ?? []), t]);
  const out: Recurring[] = [];
  for (const list of by.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => (a.date < b.date ? -1 : 1));
    const amts = list.map((t) => t.debit).sort((a, b) => a - b);
    const med = amts[Math.floor(amts.length / 2)];
    const similar = amts.every((a) => Math.abs(a - med) <= med * 0.05);
    const gaps = list.slice(1).map((t, i) => daysBetween(list[i].date, t.date));
    if (similar && gaps.every((g) => g >= 25 && g <= 35)) out.push({ merchant: list[0].merchantN, count: list.length, amount: med, every: "monthly", confidence: "probable" });
  }
  return out.sort((a, b) => b.amount - a.amount);
}

export type Patterns = {
  /** Mon..Sun debit totals (minor units) and counts. */
  weekdays: { label: string; total: number; count: number }[];
  /** Largest debits, biggest first. */
  largest: EffTxn[];
  /** Highest-spending calendar day, if there are any debits. */
  peakDay: { date: string; total: number } | null;
  /** Cumulative net (credits − debits) at the end of each day that has activity, oldest first. */
  cashflow: { date: string; net: number }[];
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** When and how the money moved. Pure and based on the statement's printed dates (no timezone shifts). */
export function spendingPatterns(txns: EffTxn[], top = 5): Patterns {
  const weekdays = WEEKDAYS.map((label) => ({ label, total: 0, count: 0 }));
  const perDay = new Map<string, { debit: number; net: number }>();
  for (const t of txns) {
    const d = perDay.get(t.date) ?? { debit: 0, net: 0 };
    d.debit += t.debit;
    d.net += t.credit - t.debit;
    perDay.set(t.date, d);
    if (t.debit) {
      const w = weekdays[(new Date(toMs(t.date)).getUTCDay() + 6) % 7];
      w.total += t.debit;
      w.count += 1;
    }
  }
  const dates = [...perDay.keys()].sort();
  let run = 0;
  const cashflow = dates.map((date) => ({ date, net: (run += perDay.get(date)!.net) }));
  let peak: Patterns["peakDay"] = null;
  for (const date of dates) {
    const debit = perDay.get(date)!.debit;
    if (debit > (peak?.total ?? 0)) peak = { date, total: debit };
  }
  const largest = txns.filter((t) => t.debit).sort((a, b) => b.debit - a.debit || (a.date < b.date ? -1 : 1)).slice(0, top);
  return { weekdays, largest, peakDay: peak, cashflow };
}

export type Rec = {
  key: string;
  title: string;
  explanation: string;
  evidence: string[];
  range: string;
  currentSpend: number;
  action: string;
  savings?: { minor: number; assumption: string };
  confidence: "high" | "medium" | "low";
  priority: "high" | "medium" | "low";
};

const fmt = (m: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(m / 100);
const short = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * Explainable, evidence-based suggestions. Savings are labelled estimates with their assumption — never promises.
 * Returns [] when there is too little data, instead of inventing conclusions.
 */
export function recommendations(txns: EffTxn[], meta: Meta, prev?: { summary: Summary; days: number } | null): Rec[] {
  if (txns.length < 10) return [];
  const range = `${short(meta.start)} – ${short(meta.end)}`;
  const days = daysBetween(meta.start, meta.end) + 1;
  const s = summarize(txns, days);
  const recs: Rec[] = [];
  const debits = txns.filter((t) => t.debit);
  const of = (cat: string) => debits.filter((t) => t.category === cat);
  const sum = (l: EffTxn[]) => l.reduce((a, t) => a + t.debit, 0);
  const line = (t: EffTxn) => `${t.merchantN} ${fmt(t.debit)} · ${short(t.date)}`;

  const subs = of("subs");
  if (subs.length) recs.push({ key: "subs", title: "Review your subscriptions", explanation: "Recurring subscription charges add up quietly. Check whether you still use each one.", evidence: subs.slice(0, 6).map(line), range, currentSpend: sum(subs), action: "Cancel or downgrade any you no longer use.", savings: { minor: sum(subs), assumption: "Upper bound if you cancel every listed subscription; the real saving depends on which you keep." }, confidence: "medium", priority: "medium" });

  const fees = of("fees");
  if (fees.length) recs.push({ key: "fees", title: "Bank fees and charges", explanation: "These charges appeared on your statement and some may be avoidable.", evidence: [...new Set(fees.map((t) => t.raw))].slice(0, 5).map((r) => `${r} × ${fees.filter((t) => t.raw === r).length} = ${fmt(sum(fees.filter((t) => t.raw === r)))}`), range, currentSpend: sum(fees), action: "Ask your bank to waive late fees and switch off paid SMS alerts if you don't need them.", savings: { minor: sum(fees), assumption: "Only if the bank waives these or you avoid them next period." }, confidence: "high", priority: sum(fees) >= 50000 ? "high" : "medium" });

  const dups = txns.filter((t) => t.dupOf);
  if (dups.length) recs.push({ key: "dups", title: "Possible duplicate debits", explanation: "Two debits share the same date, amount and merchant. This can be legitimate, so please verify.", evidence: dups.map((t) => `${line(t)} (matches an earlier charge)`), range, currentSpend: sum(dups), action: "Check with the merchant or your bank; dispute only if it was charged twice.", savings: { minor: sum(dups), assumption: "Only if confirmed as a duplicate and refunded." }, confidence: "medium", priority: "high" });

  const food = of("food");
  if (sum(food) > 0 && sum(food) / Math.max(1, s.debits) >= 0.25) recs.push({ key: "food", title: "Food is a large share of spending", explanation: `Food and groceries are ${Math.round((sum(food) / s.debits) * 100)}% of everything you spent in this period.`, evidence: [`${food.length} food transactions totalling ${fmt(sum(food))}`], range, currentSpend: sum(food), action: "Consider a monthly limit for food delivery and dining out.", savings: { minor: Math.round(sum(food) * 0.15), assumption: "Illustrative: a 15% reduction. Pick your own target; this is not a promise." }, confidence: "low", priority: "medium" });

  const small = debits.filter((t) => t.debit < 10000);
  const smallGroups = [...new Set(small.map((t) => t.merchantN))].map((m) => small.filter((t) => t.merchantN === m)).filter((g) => g.length >= 3);
  for (const g of smallGroups) recs.push({ key: `small-${g[0].merchantN}`, title: `Repeated small charges: ${g[0].merchantN}`, explanation: "Small charges seem harmless but their total can be notable.", evidence: [`${g.length} charges of about ${fmt(g[0].debit)}`], range, currentSpend: sum(g), action: "See whether these can be switched off.", savings: { minor: sum(g), assumption: "Upper bound if every one is avoided." }, confidence: "medium", priority: "low" });

  const pDays = prev ? prev.days : 0;
  if (prev && Math.abs(pDays - days) <= Math.max(3, days * 0.2)) {
    const before = new Map(prev.summary.byCategory);
    for (const [cat, cur] of s.byCategory) {
      const was = before.get(cat) ?? 0;
      if (was > 0 && cur > was * 1.2 && cur - was >= 50000) recs.push({ key: `growth-${cat}`, title: `${catOf(cat).name} spending rose`, explanation: "Compared with your previous statement of similar length.", evidence: [`${fmt(was)} → ${fmt(cur)} (+${Math.round(((cur - was) / was) * 100)}%)`], range, currentSpend: cur, action: "Look at what changed and decide whether it's intentional.", confidence: "medium", priority: "medium" });
    }
  }
  const order = { high: 0, medium: 1, low: 2 };
  return recs.sort((a, b) => order[a.priority] - order[b.priority]);
}

// -------------------------------------------------------------------- import
const fnv = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261).toString(16).padStart(8, "0");
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Stable per-transaction fingerprint: the same statement row always hashes the same, so re-imports are detectable. */
export const fingerprint = (reportId: string, t: RawTxn) => `${reportId}:${fnv(`${reportId}|${t.date}|${t.debit}|${t.credit}|${norm(t.raw)}|${t.ref}`)}`;

export function planImport<T extends RawTxn>(reportId: string, selected: T[], alreadyImported: Set<string>) {
  const toImport: { txn: T; fp: string }[] = [];
  const skipped: { txn: T; fp: string; reason: string }[] = [];
  const seen = new Set<string>();
  for (const txn of selected) {
    const fp = fingerprint(reportId, txn);
    if (alreadyImported.has(fp) || seen.has(fp)) skipped.push({ txn, fp, reason: "Already imported" });
    else toImport.push({ txn, fp });
    seen.add(fp);
  }
  return { toImport, skipped };
}

export const balanceEffect = (items: { txn: RawTxn }[]) => items.reduce((s, i) => s + i.txn.credit - i.txn.debit, 0);

/** Map an extracted payment hint to a CashBook payment method. */
export const METHODS = ["Cash", "UPI", "Bank transfer", "Debit card", "Credit card", "Other"];

/** Default statement for pickers: the most recent text-extracted one (scanned statements are less complete). */
export function pickDefault<T extends { id: string }>(reports: T[]): T | null {
  const withSt = reports.map((r) => ({ r, st: sampleStatement(r.id) })).filter((x) => x.st);
  const text = withSt.filter((x) => x.st!.txns[0]?.source === "text");
  const pool = text.length ? text : withSt;
  return pool.sort((a, b) => (a.st!.meta.end < b.st!.meta.end ? 1 : -1))[0]?.r ?? null;
}
