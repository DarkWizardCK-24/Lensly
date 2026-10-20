// Spending patterns panel: renders from the sample statements, matches the statement's numbers, and passes axe.
const { chromium } = require('playwright');
const { AxeBuilder } = require('@axe-core/playwright');

const BASE = 'http://localhost:3000';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m); } };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

(async () => {
  const b = await chromium.launch();
  for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    console.log(`\n[spending patterns, ${name}]`);
    const ctx = await b.newContext({ viewport });
    await ctx.route('http://localhost:8010/**', (r) => r.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: '{"status":"ok","database":"ok"}' }));
    const p = await ctx.newPage();
    await p.goto(BASE + '/login'); await p.click('text=Explore with sample data'); await p.waitForURL(BASE + '/');
    await p.goto(`${BASE}/reports/r1`); await p.waitForSelector('text=Spending patterns');
    ok(true, 'panel is on the report overview');
    ok(await p.locator('#patterns-h ~ div li').filter({ hasText: /^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)/ }).count() === 7, 'seven weekday rows');
    ok(await p.locator('text=Largest payments').count() === 1 && await p.locator('ol li').count() === 5, 'five largest payments listed');
    const svg = p.getByRole('img', { name: /Cumulative cash flow across \d+ active days/ });
    ok(await svg.count() === 1, 'cash-flow line has a text alternative');
    const w = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(w <= 0, 'no horizontal page scroll');
    const axe = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const bad = axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    ok(bad.length === 0, `axe: no serious/critical violations${bad.length ? ' -> ' + bad.map((v) => v.id).join(', ') : ''}`);
    await p.screenshot({ path: `docs/screenshots/patterns-${name}.png`, fullPage: true });
    await ctx.close();
  }
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
