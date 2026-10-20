// Phase 6 + 7 end-to-end: REAL backend on REAL Postgres (start it with `python backend/scripts/dev_server.py --port 8010
// --seed-user 11111111-1111-4111-8111-111111111111 --seed-user 22222222-2222-4222-8222-222222222222`) + built web app + real files.
// Covers: server-side persistence of reviews, versions, exports, comparison, and the Analyzer → CashBook import. Only sign-in is mocked.
const { chromium } = require('playwright');
const crypto = require('crypto');
const path = require('path');

const BASE = 'http://localhost:3000';
const API = 'http://localhost:8010/api/v1';
const SECRET = process.env.JWT_SECRET || 'e2e-secret-e2e-secret-e2e-secret-1234';
const FX = path.join(__dirname, 'fixtures');
const ALICE = '11111111-1111-4111-8111-111111111111', BOB = '22222222-2222-4222-8222-222222222222';

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt(sub) {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ sub, aud: 'authenticated', email: 'bob@example.com', exp: Math.floor(Date.now() / 1000) + 3600 });
  return `${head}.${body}.${crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')}`;
}
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m); } };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const TOKEN = jwt(BOB);
  const call = async (method, p, token = TOKEN, data) => {
    const r = await ctx.request.fetch(`${API}${p}`, { method, headers: { authorization: `Bearer ${token}` }, data });
    return { status: r.status(), body: r.status() === 204 ? null : await r.json().catch(() => null) };
  };
  const session = { access_token: TOKEN, refresh_token: 'RT', expires_in: 3600, user: { id: BOB, email: 'bob@example.com', user_metadata: { display_name: 'Bob Rao' } } };
  await ctx.route('https://mock.supabase.test/**', (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    return r.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(session) });
  });
  const p = await ctx.newPage();

  console.log('\n[sign in → Report Book → two uploads, saved on the server]');
  await p.goto(BASE + '/login');
  await p.fill('input[type=email]', 'bob@example.com'); await p.fill('input[autocomplete=current-password]', 'Correct#Pass1');
  await p.click('button[type=submit]'); await p.waitForURL(BASE + '/');
  await p.goto(BASE + '/upload'); await p.waitForSelector('text=Processed securely on the server');
  await p.click('button:has-text("New Report Book")'); await p.fill('dialog input >> nth=0', 'Household'); await p.click('dialog button:has-text("Create book")');
  await p.waitForSelector('dialog[open]', { state: 'detached' });
  ok((await call('GET', '/report-books')).body.some((x) => x.name === 'Household'), 'the Report Book exists on the server');
  for (const f of ['statement.csv', 'statement.xlsx']) {
    await p.goto(BASE + '/upload');
    await p.setInputFiles('input[type=file]', path.join(FX, f));
    await p.waitForSelector(`text=${f}`); await p.click('button:has-text("Analyze statements")');
    await p.waitForSelector('text=Open report →', { timeout: 30000 });
  }
  const reports = (await call('GET', '/reports')).body;
  ok(reports.length === 2, 'both statements were saved as reports');
  const csv = reports.find((r) => r.source === 'statement.csv');
  ok(csv.transaction_count === 7 && csv.current_version === 1, 'transactions were stored and a first version snapshot exists');

  console.log('\n[corrections persist across reloads]');
  await p.goto(`${BASE}/reports/${csv.id}`); await p.waitForSelector('text=Money in');
  await p.getByRole('tab', { name: /Review transactions/ }).click(); await p.waitForSelector('text=Swiggy');
  for (let i = 0; i < 3; i++) await p.locator('tbody button:has-text("Mark reviewed")').first().click();
  await p.selectOption('select[aria-label="Category for Swiggy"]', 'fun');
  await p.waitForTimeout(1500); // debounced save
  let txns = (await call('GET', `/reports/${csv.id}/transactions`)).body;
  ok(txns.filter((t) => t.reviewed).length === 3, 'three rows are marked reviewed on the server');
  ok(txns.find((t) => t.merchant === 'Swiggy').category === 'fun' && txns.find((t) => t.merchant === 'Swiggy').suggested !== 'fun', 'the category correction is stored, the extracted value is untouched');
  await p.reload(); await p.getByRole('tab', { name: /Review transactions/ }).click();
  await p.waitForSelector('text=3 of 7 reviewed');
  ok(true, 'after a reload the review progress is restored from the server');

  console.log('\n[versions + exports]');
  await p.click('button:has-text("Save snapshot")'); await p.waitForSelector('text=Saved version 2');
  await p.click('button:has-text("Versions")'); await p.waitForSelector('dialog >> text=Version 2');
  ok(await p.locator('dialog >> text=Version 1').count() === 1, 'the version list shows both snapshots');
  await p.keyboard.press('Escape');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('button:has-text("CSV")')]);
  const text = await (async () => { const s = await dl.createReadStream(); let t = ''; for await (const c of s) t += c; return t; })();
  ok(dl.suggestedFilename().endsWith('.csv') && text.includes('Swiggy'), 'the CSV export downloads with the corrected data');
  const [dx] = await Promise.all([p.waitForEvent('download'), p.click('button:has-text("Excel")')]);
  ok(dx.suggestedFilename().endsWith('.xlsx'), 'the Excel export downloads');
  const [dp] = await Promise.all([p.waitForEvent('download'), p.click('button:has-text("PDF")')]);
  ok(dp.suggestedFilename().endsWith('.pdf'), 'the PDF export downloads');

  console.log('\n[comparison from the server]');
  const other = reports.find((r) => r.id !== csv.id);
  await p.goto(`${BASE}/reports/compare?a=${csv.id}&b=${other.id}`);
  await p.waitForSelector('text=Money in', { timeout: 15000 });
  ok(await p.locator('text=Average spend per day').count() === 1, 'the compare page renders the server comparison');

  console.log('\n[import into CashBook]');
  const book = (await call('POST', '/cashbooks', TOKEN, { name: 'Main', currency: 'INR' })).body;
  await p.goto(`${BASE}/reports/${csv.id}/import`);
  await p.waitForSelector('text=3 eligible');
  ok(true, 'only the 3 reviewed rows are offered (unreviewed and duplicate rows are excluded)');
  const runImport = async () => {
    await p.click('button:has-text("Continue")');
    await p.click('button:has-text("Preview")'); await p.waitForSelector('text=Will be created');
  };
  await runImport();
  await p.locator('label:has-text("reviewed these transactions") input').check();
  await p.click('button:has-text("Confirm import")'); await p.waitForSelector('text=Import complete', { timeout: 15000 });
  let tx = (await call('GET', `/transactions?book_id=${book.id}`)).body;
  ok(tx.total === 3 && tx.items.every((t) => t.created_source === 'import'), 'exactly the 3 reviewed rows were created in the CashBook');
  ok((await call('GET', '/imports')).body.length === 1, 'the import is in the audit history');

  await p.goto(`${BASE}/reports/${csv.id}/import`); await p.waitForSelector('text=3 eligible');
  await runImport();
  ok(await p.locator('text=/already imported/i').count() >= 1, 'importing again shows the rows as already imported');
  ok(await p.locator('button:has-text("Confirm import")').isDisabled(), 'there is nothing left to confirm, so a second import cannot create duplicates');
  tx = (await call('GET', `/transactions?book_id=${book.id}`)).body;
  ok(tx.total === 3, 'the CashBook still has exactly 3 transactions');

  console.log('\n[ownership]');
  ok((await call('GET', `/reports/${csv.id}`, jwt(ALICE))).status === 404, "another user cannot open this user's report");
  ok((await call('GET', `/reports/${csv.id}/transactions`, jwt(ALICE))).status === 404, "...or its transactions");
  ok((await call('POST', '/imports/preview', jwt(ALICE), { report_id: csv.id, cashbook_id: book.id })).status === 404, "...or import it into someone else's CashBook");
  ok((await call('GET', '/reports', jwt(ALICE))).body.length === 0, 'their report list is empty');

  console.log('\n[cleanup]');
  await p.goto(BASE + '/reports');
  await p.click(`button[aria-label^="Delete "][aria-label$="statement"] >> nth=0`); await p.click('dialog button:has-text("Confirm")');
  await p.waitForTimeout(600);
  ok((await call('GET', '/reports')).body.length === 1, 'deleting a report removes it from the server');
  tx = (await call('GET', `/transactions?book_id=${book.id}`)).body;
  ok(tx.total === 3, 'imported CashBook entries survive deleting the report');

  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('E2E crashed:', e.message.split('\n').slice(0, 8).join('\n')); process.exit(2); });
