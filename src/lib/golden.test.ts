/**
 * Writes backend/tests/golden/analysis_golden.json: inputs + the results the TypeScript analysis produces.
 * The Python server-side analysis is tested against this file so the two implementations can't drift apart.
 * Re-generate with:  npx vitest run src/lib/golden.test.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { daysBetween, detectRecurring, effective, reconcile, recommendations, sampleStatement, summarize, type Edits } from "./statement";

const OUT = resolve(__dirname, "../../../../backend/tests/golden/analysis_golden.json");

function caseFor(id: string, edits: Edits, prevId?: string) {
  const st = sampleStatement(id)!;
  const days = daysBetween(st.meta.start, st.meta.end) + 1;
  const eff = effective(st.txns, edits);
  const s = summarize(eff, days);
  let prev: { summary: ReturnType<typeof summarize>; days: number } | null = null;
  if (prevId) {
    const p = sampleStatement(prevId)!;
    const pd = daysBetween(p.meta.start, p.meta.end) + 1;
    prev = { summary: summarize(effective(p.txns, {}), pd), days: pd };
  }
  const rc = reconcile(st);
  return {
    id, prevId: prevId ?? null, edits,
    meta: st.meta, txns: st.txns,
    expected: {
      days,
      summary: { credits: s.credits, debits: s.debits, net: s.net, count: s.count, avgDaily: s.avgDaily, byCategory: s.byCategory },
      recon: { status: rc.status, credits: rc.credits, debits: rc.debits, expectedClosing: rc.expectedClosing, statementClosing: rc.statementClosing, difference: rc.difference, rowIssues: rc.rowIssues.map((i) => ({ index: i.index, expected: i.expected, printed: i.printed })) },
      dupOf: Object.fromEntries(eff.filter((t) => t.dupOf).map((t) => [t.id, t.dupOf])),
      categories: Object.fromEntries(eff.map((t) => [t.id, t.category])),
      recurring: detectRecurring(eff).map((r) => ({ merchant: r.merchant, count: r.count, amount: r.amount })),
      recs: recommendations(eff, st.meta, prev).map((r) => ({ key: r.key, priority: r.priority, confidence: r.confidence, currentSpend: r.currentSpend, savings: r.savings?.minor ?? null, evidence: r.evidence.length })),
    },
  };
}

describe("golden export for the Python analysis", () => {
  it("writes the file", () => {
    const first = sampleStatement("r1")!.txns.filter((t) => t.debit).slice(0, 3);
    const cases = [
      caseFor("r1", {}),
      caseFor("r1", Object.fromEntries(first.map((t, i) => [t.id, { category: i === 0 ? "other" : "shopping", merchant: i === 1 ? "Renamed Shop" : undefined, reviewed: true }])), undefined),
      caseFor("r2", {}, "r1"), // growth recommendations vs the previous statement
      caseFor("r3", {}),
      caseFor("r4", {}),
    ];
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify(cases, null, 1));
    expect(cases).toHaveLength(5);
    expect(cases[2].expected.recs.some((r) => r.key.startsWith("growth-"))).toBe(true);
  });
});
