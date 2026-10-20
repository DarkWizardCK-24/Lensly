// Phase 8 end-to-end: keyboard shortcuts, command palette, accessibility scan (axe-core), data export and deletion.
// Needs a FRESH dev API (see phase6.js) and `npm i --no-save playwright @axe-core/playwright`.
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3000';
const API = 'http://localhost:8010/api/v1';
const SECRET = process.env.JWT_SECRET || 'e2e-secret-e2e-secret-e2e-secret-1234';
const FX = path.join(__dirname, 'fixtures');
const USER = '11111111-1111-4111-8111-111111111111';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt(sub) {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ sub, aud: 'authenticated', email: 'asha@example.com', exp: Math.floor(Date.now() / 1000) + 3600 });
  return `${head}.${body}.${crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')}`;
}
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m); } };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const TOKEN = jwt(USER);
  const H = { authorization: `Bearer ${TOKEN}` };
  const get = async (p) => (await ctx.request.get(`${API}${p}`, { headers: H })).json();
  const session = { access_token: TOKEN, refresh_token: 'RT', expires_in: 3600, user: { id: USER, email: 'asha@example.com', user_metadata: { display_name: 'Asha Patel' } } };
  await ctx.route('https://mock.supabase.test/**', (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    return r.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(session) });
  });

  // seed through the real API: one Report Book, one saved report, one CashBook with a transaction
  const rb = await (await ctx.request.post(`${API}/report-books`, { headers: H, data: { name: 'Savings' } })).json();
  await ctx.request.post(`${API}/statement-processing/process`, { headers: H, multipart: { file: { name: 'statement.csv', mimeType: 'text/csv', buffer: fs.readFileSync(path.join(FX, 'statement.csv')) }, report_book_id: rb.id, report_name: 'September account' } });
  const cb = await (await ctx.request.post(`${API}/cashbooks`, { headers: H, data: { name: 'Main', currency: 'INR' } })).json();
  await ctx.request.post(`${API}/transactions`, { headers: H, data: { book_id: cb.id, type: 'expense', amount_minor: 500, title: 'Tea', occurred_at: '2026-09-01T10:00:00Z' } });

  const p = await ctx.newPage();
  await p.goto(BASE + '/login');
  await p.fill('input[type=email]', 'asha@example.com'); await p.fill('input[autocomplete=current-password]', 'Correct#Pass1');
  await p.click('button[type=submit]'); await p.waitForURL(BASE + '/');
  await p.waitForSelector('text=September account');

  console.log('\n[keyboard: shortcuts + command palette]');
  await p.keyboard.press('g'); await p.keyboard.press('b'); await p.waitForURL(BASE + '/budgets');
  ok(true, '"G then B" goes to Budgets');
  await p.keyboard.press('g'); await p.keyboard.press('u'); await p.waitForURL(BASE + '/upload');
  ok(true, '"G then U" goes to Upload');
  await p.keyboard.press('?'); await p.waitForSelector('dialog[open] >> text=Keyboard shortcuts');
  ok(true, '"?" opens the shortcut help');
  await p.keyboard.press('Escape'); await p.waitForSelector('dialog[open]', { state: 'detached' });
  await p.keyboard.press('Control+k'); await p.waitForSelector('dialog[open] input[role=combobox]');
  await p.waitForFunction(() => document.activeElement?.getAttribute('role') === 'combobox', null, { timeout: 5000 }).then(() => ok(true, 'Ctrl+K opens quick actions with focus in the search box'), () => ok(false, 'Ctrl+K opens quick actions with focus in the search box'));
  await p.keyboard.type('september');
  await p.waitForSelector('dialog[open] [role=option]:has-text("September account")');
  await p.keyboard.press('Enter'); await p.waitForURL(/\/reports\/[0-9a-f-]{36}$/);
  ok(true, 'searching for a report by name and pressing Enter opens it');
  await p.keyboard.press('Control+k'); await p.waitForFunction(() => document.activeElement?.getAttribute('role') === 'combobox'); await p.keyboard.type('zzzz-nothing');
  ok(await p.locator('dialog[open] >> text=Nothing matches').count() === 1, 'an empty search says so');
  await p.keyboard.press('Escape');
  await p.goto(BASE + '/reports'); await p.waitForLoadState('networkidle');
  await p.keyboard.press('Tab');
  ok(await p.evaluate(() => document.activeElement?.textContent?.includes('Skip to content')), 'the first Tab stop is a "Skip to content" link');

  console.log('\n[accessibility scan (axe-core, WCAG 2.1 A/AA)]');
  const rep = (await get('/reports'))[0];
  for (const [name, url] of [['dashboard', '/'], ['upload', '/upload'], ['reports', '/reports'], ['report', `/reports/${rep.id}`], ['import', `/reports/${rep.id}/import`], ['budgets', '/budgets'], ['settings', '/settings'], ['compare', '/reports/compare']]) {
    await p.goto(BASE + url); await p.waitForLoadState('networkidle'); await p.waitForTimeout(700);
    const res = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const bad = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    if (bad.length) console.log(bad.map((v) => `       ${v.id}: ${v.help} (${v.nodes.length}) e.g. ${v.nodes[0].target}`).join('\n'));
    ok(bad.length === 0, `${name}: no serious or critical violations`);
  }
  await p.goto(`${BASE}/reports/${rep.id}`); await p.waitForSelector('text=Money in');
  await p.getByRole('tab', { name: /Review transactions/ }).click(); await p.waitForSelector('text=Swiggy');
  const rv = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const rbad = rv.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  for (const v of rbad) console.log(`       ${v.id}: ${v.help} (${v.nodes.length}) e.g. ${v.nodes[0].html.slice(0, 160).replace(/\s+/g, ' ')}`);
  ok(rbad.length === 0, 'review workspace: no serious or critical violations');

  console.log('\n[your data: export]');
  await p.goto(BASE + '/settings'); await p.waitForSelector('text=Download all my data');
  await p.waitForSelector('dt:has-text("CashBook transactions")');
  ok(await p.locator('dt:has-text("Reports") + dd').first().innerText() === '1', 'the summary shows what is stored');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('button:has-text("Download all my data")')]);
  const dump = JSON.parse(fs.readFileSync(await dl.path(), 'utf-8'));
  ok(dl.suggestedFilename() === 'my-finance-data.json' && dump.cashbook.transactions.length === 1 && dump.analyzer.statement_transactions.length === 7, 'the JSON export contains the CashBook and Analyzer data');

  console.log('\n[your data: deletion needs confirmation]');
  await p.click('button:has-text("Delete my data")');
  const del = p.locator('dialog[open] button:has-text("Delete data")');
  ok(await del.isDisabled(), 'the delete button is disabled until DELETE is typed');
  await p.fill('dialog[open] input[autocomplete=off]', 'delete');
  ok(await del.isDisabled(), 'a wrong word does not unlock it');
  await p.fill('dialog[open] input[autocomplete=off]', 'DELETE');
  await del.click(); await p.waitForSelector("text=Deleted. This can't be undone.");
  ok((await get('/reports')).length === 0 && (await get('/report-books')).length === 0, 'Analyzer data is gone');
  ok((await get('/transactions')).total === 1, 'CashBook data is untouched when only Analyzer data is deleted');
  await p.click('button:has-text("Delete my data")'); await p.locator('dialog[open] label:has-text("Everything") input').check();
  await p.fill('dialog[open] input[autocomplete=off]', 'DELETE'); await p.click('dialog[open] button:has-text("Delete data")');
  await p.waitForSelector('dialog[open]', { state: 'detached' });
  ok((await get('/transactions')).total === 0 && (await get('/cashbooks')).length === 0, 'deleting everything removes the CashBook data too');

  console.log('\n[account deletion is honest when the server cannot do it]');
  await p.click('button:has-text("Delete my account")'); await p.fill('dialog[open] input[autocomplete=off]', 'DELETE');
  await p.click('dialog[open] button:has-text("Delete account")');
  await p.waitForSelector("dialog[open] >> text=isn't configured");
  ok(true, 'without service-role configuration the user is told, and stays signed in');

  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('E2E crashed:', e.message.split('\n').slice(0, 8).join('\n')); process.exit(2); });
