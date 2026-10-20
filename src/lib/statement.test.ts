import { describe, expect, it } from "vitest";
import { balanceEffect, daysBetween, detectRecurring, effective, fingerprint, planImport, reconcile, recommendations, sampleStatement, spendingPatterns, summarize } from "./statement";

const st = (id: string) => sampleStatement(id)!;
const eff = (id: string) => effective(st(id).txns, {});
const days = (id: string) => daysBetween(st(id).meta.start, st(id).meta.end) + 1;

describe("sample statements", () => {
  it("are deterministic and use integer minor units", () => {
    const a = JSON.stringify(st("r1"));
    expect(JSON.stringify(sampleStatement("r1"))).toBe(a);
    for (const t of st("r2").txns) {
      expect(Number.isInteger(t.debit) && Number.isInteger(t.credit) && Number.isInteger(t.balance)).toBe(true);
      expect(t.debit === 0 || t.credit === 0).toBe(true);
    }
    expect(sampleStatement("nope")).toBeNull();
  });

  it("chain: a month's opening balance is the previous month's closing balance", () => {
    expect(st("r2").meta.opening).toBe(st("r1").txns.at(-1)!.balance);
  });
});

describe("spending patterns", () => {
  it("weekday totals add up to total debits and the cash flow ends at net", () => {
    const t = eff("r1");
    const p = spendingPatterns(t);
    const s = summarize(t, days("r1"));
    expect(p.weekdays).toHaveLength(7);
    expect(p.weekdays.reduce((a, d) => a + d.total, 0)).toBe(s.debits);
    expect(p.weekdays.reduce((a, d) => a + d.count, 0)).toBe(t.filter((x) => x.debit).length);
    expect(p.cashflow.at(-1)!.net).toBe(s.net);
    expect(p.cashflow.map((c) => c.date)).toEqual([...p.cashflow.map((c) => c.date)].sort());
  });

  it("orders the largest debits and finds the peak day", () => {
    const t = eff("r1");
    const p = spendingPatterns(t, 3);
    expect(p.largest).toHaveLength(3);
    expect(p.largest[0].debit).toBeGreaterThanOrEqual(p.largest[1].debit);
    expect(p.largest[0].debit).toBe(Math.max(...t.map((x) => x.debit)));
    expect(p.peakDay!.total).toBeGreaterThanOrEqual(p.largest[0].debit);
  });

  it("uses the printed date's weekday (2026-03-02 is a Monday) and handles an empty statement", () => {
    const row = { ...eff("r1")[0], date: "2026-03-02", debit: 1000, credit: 0 };
    const p = spendingPatterns([row]);
    expect(p.weekdays[0]).toEqual({ label: "Mon", total: 1000, count: 1 });
    expect(spendingPatterns([])).toEqual({ weekdays: expect.any(Array), largest: [], peakDay: null, cashflow: [] });
  });
});

describe("reconciliation", () => {
  it("r1 reconciles exactly", () => {
    const r = reconcile(st("r1"));
    expect(r.status).toBe("reconciled");
    expect(r.difference).toBe(0);
    expect(r.expectedClosing).toBe(st("r1").meta.opening! + r.credits - r.debits);
    expect(r.rowIssues).toHaveLength(0);
  });

  it("r2 has matching totals but a printed running-balance error → warnings, with the rows identified", () => {
    const r = reconcile(st("r2"));
    expect(r.status).toBe("warnings");
    expect(r.difference).toBe(0);
    expect(r.rowIssues.length).toBeGreaterThan(0);
    expect(r.rowIssues[0].printed - r.rowIssues[0].expected).toBe(50000);
  });

  it("r3 is NOT reconciled and reports the exact difference instead of forcing a match", () => {
    const r = reconcile(st("r3"));
    expect(r.status).toBe("not_reconciled");
    expect(r.difference).toBe(125000);
    expect(r.statementClosing! - r.expectedClosing).toBe(125000);
  });

  it("is 'unknown' when the statement doesn't print a closing balance", () => {
    const s = structuredClone(st("r1"));
    s.meta.closing = null;
    expect(reconcile(s).status).toBe("unknown");
  });
});

describe("duplicates, recurring payments, summary", () => {
  it("flags the injected duplicate debit and nothing else in r1", () => {
    const flagged = eff("r1").filter((t) => t.dupOf);
    expect(flagged).toHaveLength(1);
    expect(flagged[0].merchantN).toBe("ShopKart");
    expect(flagged[0].dupOf).toBeTruthy();
  });

  it("does not call a one-month statement 'recurring', but finds monthly payments across a quarter", () => {
    expect(detectRecurring(eff("r1")).map((r) => r.merchant)).toEqual([]);
    const names = detectRecurring(eff("r3")).map((r) => r.merchant);
    expect(names).toEqual(expect.arrayContaining(["WorkSpace Co", "Cloudhost", "Pixelcraft"]));
    expect(detectRecurring(eff("r3")).every((r) => r.confidence === "probable")).toBe(true);
  });

  it("summary totals equal the sums of the rows and categories add up to total debits", () => {
    const s = summarize(eff("r1"), days("r1"));
    expect(s.credits).toBe(reconcile(st("r1")).credits);
    expect(s.byCategory.reduce((a, [, v]) => a + v, 0)).toBe(s.debits);
    expect(s.net).toBe(s.credits - s.debits);
  });

  it("user corrections change the effective category without touching the original", () => {
    const first = st("r1").txns.find((t) => t.debit)!;
    const e = effective(st("r1").txns, { [first.id]: { category: "other", reviewed: true } }).find((t) => t.id === first.id)!;
    expect(e.category).toBe("other");
    expect(e.edited && e.reviewed).toBe(true);
    expect(st("r1").txns.find((t) => t.id === first.id)!.suggested).toBe(first.suggested);
  });
});

describe("recommendations", () => {
  it("are evidence-based and every savings figure carries its assumption", () => {
    const recs = recommendations(eff("r1"), st("r1").meta);
    const keys = recs.map((r) => r.key);
    expect(keys).toEqual(expect.arrayContaining(["subs", "fees", "dups"]));
    for (const r of recs) {
      expect(r.evidence.length).toBeGreaterThan(0);
      if (r.savings) {
        expect(r.savings.assumption.length).toBeGreaterThan(10);
        expect(r.savings.minor).toBeLessThanOrEqual(r.currentSpend);
      }
    }
    expect(recs[0].priority).toBe("high");
  });

  it("compares with the previous statement only when the periods are comparable", () => {
    const prev = { summary: summarize(eff("r1"), days("r1")), days: days("r1") };
    const withPrev = recommendations(eff("r2"), st("r2").meta, prev).map((r) => r.key);
    expect(withPrev.some((k) => k.startsWith("growth-"))).toBe(true);
    const quarter = { summary: summarize(eff("r3"), days("r3")), days: days("r3") }; // 92 days vs 31
    expect(recommendations(eff("r2"), st("r2").meta, quarter).some((r) => r.key.startsWith("growth-"))).toBe(false);
  });

  it("says nothing when there is too little data", () => {
    const few = eff("r1").slice(0, 5);
    expect(recommendations(few, st("r1").meta)).toEqual([]);
  });
});

describe("import planning (idempotency)", () => {
  it("fingerprints are stable and unique per row", () => {
    const rows = st("r1").txns;
    expect(fingerprint("r1", rows[0])).toBe(fingerprint("r1", { ...rows[0] }));
    expect(new Set(rows.map((t) => fingerprint("r1", t))).size).toBe(rows.length);
    expect(fingerprint("r1", rows[0])).not.toBe(fingerprint("r2", rows[0]));
  });

  it("a retried import creates nothing new, and a row selected twice is imported once", () => {
    const rows = st("r1").txns.slice(0, 6);
    const first = planImport("r1", rows, new Set());
    expect(first.toImport).toHaveLength(6);
    const done = new Set(first.toImport.map((i) => i.fp));
    const retry = planImport("r1", rows, done);
    expect(retry.toImport).toHaveLength(0);
    expect(retry.skipped).toHaveLength(6);
    const twice = planImport("r1", [rows[0], rows[0]], new Set());
    expect(twice.toImport).toHaveLength(1);
    expect(twice.skipped).toHaveLength(1);
  });

  it("balance effect is credits minus debits of exactly the imported rows", () => {
    const rows = st("r1").txns.slice(0, 6);
    const plan = planImport("r1", rows, new Set());
    expect(balanceEffect(plan.toImport)).toBe(rows.reduce((s, t) => s + t.credit - t.debit, 0));
  });
});
