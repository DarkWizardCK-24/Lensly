const { chromium } = require('playwright');
const fs = require('fs');

const BASE = 'http://localhost:3000';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m); } };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

async function demo(b) {
  const ctx = await b.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
  await ctx.route('http://localhost:8010/**', (r) => r.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: '{"status":"ok","database":"ok"}' }));
  const p = await ctx.newPage();
  await p.goto(BASE + '/login'); await p.click('text=Explore with sample data'); await p.waitForURL(BASE + '/');
  return { ctx, p };
}
const tab = (p, name) => p.getByRole('tab', { name: new RegExp(name) }).click();

(async () => {
  const b = await chromium.launch();

  console.log('\n[dashboard + reconciliation outcomes]');
  {
    const { ctx, p } = await demo(b);
    await p.waitForSelector('text=Recent reports'); await p.waitForSelector('text=Potential savings');
    ok(true, 'dashboard shows recent reports and potential savings');
    const expect = { r1: 'Reconciled', r2: 'Reconciled with warnings', r3: 'Not reconciled', r4: 'Reconciled' };
    for (const id of ['r1', 'r2', 'r3', 'r4']) {
      await p.goto(`${BASE}/reports/${id}`); await p.waitForSelector('text=Money in'); await tab(p, 'Reconciliation');
      await p.waitForSelector(`main >> text="${expect[id]}"`);
      ok(true, `${id}: shows "${expect[id]}"`);
      if (id === 'r2') ok(await p.locator('text=running balance doesn').count() > 0, 'r2: lists the rows whose running balance does not follow');
      if (id === 'r3') ok(await p.locator('text=/Difference: .*1,250\\.00/').count() === 1, 'r3: shows the exact ₹1,250.00 difference instead of forcing a match');
    }
    await p.goto(`${BASE}/reports/r4`); await p.waitForSelector('text=Scanned statement');
    ok(true, 'r4: scanned statement shows the OCR notice');
    await ctx.close();
  }

  console.log('\n[review workspace]');
  {
    const { ctx, p } = await demo(b);
    await p.goto(`${BASE}/reports/r1`); await tab(p, 'Review transactions');
    await p.waitForSelector('text=need attention');
    await p.selectOption('select[aria-label="Status filter"]', 'attention');
    await p.waitForSelector('text=Possible duplicate');
    ok(true, 'duplicate debit is flagged with an explanation');
    await p.selectOption('select[aria-label="Status filter"]', 'all');

    const before = await p.locator('p:has-text("Original:")').first().innerText();
    const rowBoxes = p.locator('table input[aria-label^="Select "]:not([aria-label^="Select all"])');
    await rowBoxes.nth(0).check(); await rowBoxes.nth(1).check(); await rowBoxes.nth(2).check();
    await p.selectOption('select[aria-label="Bulk category"]', 'other');
    await p.waitForSelector('text=Category set for 3');
    ok(true, 'bulk categorize applies to the selected rows');
    await p.click('button:has-text("Mark reviewed") >> nth=0');
    await p.waitForSelector('text=Marked 3 reviewed');
    const store = await p.evaluate(() => JSON.parse(localStorage.getItem('fp_demo_review_r1') || '{}'));
    const vals = Object.values(store);
    ok(vals.length === 3 && vals.every((e) => e.category === 'other' && e.reviewed === true), 'edits and review status persist per report');
    ok((await p.locator('p:has-text("Original:")').first().innerText()) === before, 'original extracted text is preserved next to the corrected values');
    ok(await p.locator('text=Corrected').count() >= 3, 'corrected rows are marked as such');

    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('button:has-text("Export 3 selected")')]);
    const text = fs.readFileSync(await dl.path(), 'utf8');
    ok(text.includes('Original description') && text.split('\n').length === 4, 'CSV export contains exactly the selected rows plus a header');
    await ctx.close();
  }

  console.log('\n[recommendations]');
  {
    const { ctx, p } = await demo(b);
    await p.goto(`${BASE}/reports/r1`); await tab(p, 'Savings ideas');
    await p.waitForSelector('text=Possible duplicate debits'); await p.waitForSelector('text=Bank fees and charges');
    ok(await p.locator('text=Assumption:').count() >= 2, 'every estimate states its assumption');
    ok(await p.locator('text=/not tax, investment, credit or legal advice/').count() === 1, 'disclaimer shown');
    await p.locator('article:has-text("Bank fees and charges") button:has-text("completed")').click();
    await p.locator('article:has-text("Bank fees and charges") button[aria-label="Helpful"]').click();
    const rs = await p.evaluate(() => JSON.parse(localStorage.getItem('fp_demo_recs_r1') || '{}'));
    ok(rs.fees && rs.fees.status === 'completed' && rs.fees.helpful === true, 'status and feedback persist');
    await p.waitForSelector('text=Marked as done');
    await ctx.close();
  }

  console.log('\n[comparison]');
  {
    const { ctx, p } = await demo(b);
    await p.goto(`${BASE}/reports/compare?a=r1&b=r3`);
    await p.waitForSelector('text=These periods differ in length');
    ok(true, 'differing period lengths trigger a coverage warning');
    await p.goto(`${BASE}/reports/compare?a=r1&b=r2`);
    await p.waitForSelector('text=Average spend per day');
    ok(await p.locator('text=These periods differ in length').count() === 0, 'similar-length periods compare without a warning');
    ok(await p.locator('text=Spending by category').count() === 1, 'category comparison is shown');
    await ctx.close();
  }

  console.log('\n[import to CashBook]');
  {
    const { ctx, p } = await demo(b);
    await p.goto(`${BASE}/reports/r1/import`);
    await p.waitForSelector('text=No reviewed transactions yet');
    ok(true, 'unreviewed transactions cannot be imported');
    // review every row (including the flagged duplicate) via stored edits
    await p.evaluate(() => { const e = {}; for (let i = 1; i <= 400; i++) e[`r1-${i}`] = { reviewed: true }; localStorage.setItem('fp_demo_review_r1', JSON.stringify(e)); });
    await p.reload(); await p.waitForSelector('text=eligible');
    const dupNote = await p.locator('text=/flagged as possible duplicates/').innerText();
    ok(/1 flagged/.test(dupNote), 'the flagged duplicate is excluded from eligibility');
    const eligible = Number((await p.locator('text=/\\d+ eligible/').first().innerText()).match(/(\d+) eligible/)[1]);
    await p.click('button:has-text("Continue")'); await p.click('button:has-text("Preview")');
    await p.waitForSelector('text=Will be created');
    ok(await p.locator('button:has-text("Confirm import")').isDisabled(), 'confirm is blocked until the user acknowledges');
    await p.check('text=I\'ve reviewed these'); await p.click('button:has-text("Confirm import")');
    await p.waitForSelector('text=Import recorded');
    ok((await p.locator('text=/new · .* skipped/').innerText()).includes(`${eligible} new`), `all ${eligible} eligible rows imported`);

    await p.click('button:has-text("Import again")'); await p.click('button:has-text("Continue")'); await p.click('button:has-text("Preview")');
    await p.waitForSelector('text=already imported into Personal');
    await p.check('text=I\'ve reviewed these'); await p.click('button:has-text("Confirm import")');
    await p.waitForSelector('text=Import recorded');
    const second = await p.locator('text=/new · .* skipped/').innerText();
    ok(second.includes('0 new') && second.includes(`${eligible} skipped`), 'a retried import creates nothing new (idempotent)');
    ok(await p.locator('text=Import history').count() === 1, 'audit trail is recorded');
    await ctx.close();
  }

  console.log('\n[budgets]');
  {
    const { ctx, p } = await demo(b);
    await p.goto(`${BASE}/budgets`); await p.waitForSelector('text=No budgets yet');
    ok(true, 'starts with no invented budgets');
    await p.click('button:has-text("Create your first budget")');
    await p.fill('dialog input', 'abc'); await p.click('dialog button:has-text("Create budget")');
    await p.waitForSelector('text=Enter a monthly amount');
    ok(true, 'invalid amount is rejected');
    await p.fill('dialog input', '800'); await p.click('dialog button:has-text("Create budget")');
    await p.waitForSelector('text=Over budget');
    ok(true, 'budget vs actual flags an exceeded limit from real statement figures');
    await p.waitForSelector('[role=alert]:has-text("over the limit")');
    await p.click('button:has-text("New budget")'); await p.fill('dialog input', '5000'); await p.click('dialog button:has-text("Create budget")');
    await p.waitForSelector('text=already have a budget');
    ok(true, 'duplicate category budget is blocked');
    await p.keyboard.press('Escape');
    await p.click('button:has-text("New goal")'); await p.fill('dialog input >> nth=0', 'Emergency fund'); await p.fill('dialog input >> nth=1', '100000'); await p.fill('dialog input >> nth=2', '25000'); await p.click('dialog button:has-text("Create goal")');
    await p.waitForSelector('text=Emergency fund'); await p.waitForSelector('text=25%');
    ok(true, 'goal created with correct progress');
    await ctx.close();
  }

  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('E2E crashed:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(2); });
