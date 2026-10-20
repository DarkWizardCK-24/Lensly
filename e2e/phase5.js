// Phase 5 end-to-end: REAL backend (verifies real JWTs) + built web app + REAL files. Only Supabase sign-in is mocked.
// Env: JWT_SECRET must match the backend's SUPABASE_JWT_SECRET. Backend on :8010, web on :3000.
const { chromium } = require('playwright');
const crypto = require('crypto');
const path = require('path');

const BASE = 'http://localhost:3000';
const SECRET = process.env.JWT_SECRET || 'e2e-secret-e2e-secret-e2e-secret-1234';
const FX = path.join(__dirname, 'fixtures');
const PW_OK = 'Unlock#2026', PW_BAD = 'Wrong#Guess-1';

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
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const apiBodies = [];
  const TOKEN = jwt('11111111-1111-4111-8111-111111111111');
  const API = 'http://localhost:8010/api/v1';
  const listReports = async () => (await ctx.request.get(`${API}/reports`, { headers: { authorization: `Bearer ${TOKEN}` } })).json();
  const session = { access_token: TOKEN, refresh_token: 'RT', expires_in: 3600, user: { id: '11111111-1111-4111-8111-111111111111', email: 'asha@example.com', user_metadata: { display_name: 'Asha Patel' } } };
  await ctx.route('https://mock.supabase.test/**', (r) => {
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS });
    return r.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(session) });
  });
  const p = await ctx.newPage();
  p.on('request', (r) => { if (r.url().includes('/statement-processing/')) apiBodies.push(`${r.url()}\n${r.postData() ?? ''}`); });

  console.log('\n[sign in → create a Report Book]');
  await p.goto(BASE + '/login');
  await p.fill('input[type=email]', 'asha@example.com'); await p.fill('input[autocomplete=current-password]', 'Correct#Pass1');
  await p.click('button[type=submit]'); await p.waitForURL(BASE + '/');
  await p.goto(BASE + '/upload');
  await p.waitForSelector('text=Processed securely on the server');
  ok(true, 'signed-in users see real server processing (not the preview flow)');
  await p.click('button:has-text("New Report Book")'); await p.fill('dialog input >> nth=0', 'Personal accounts'); await p.click('dialog button:has-text("Create book")');

  console.log('\n[CSV: real parse through the real API]');
  await p.setInputFiles('input[type=file]', path.join(FX, 'statement.csv'));
  await p.waitForSelector('text=statement.csv'); await p.click('button:has-text("Analyze statements")');
  await p.waitForSelector('text=7 transactions found', { timeout: 30000 });
  ok(await p.locator('main >> text="Reconciled"').count() >= 1, 'statement reconciles (opening + credits − debits = closing)');
  await p.click('text=Open report →');
  await p.waitForSelector('text=Money in');
  ok(await p.locator('text=₹85,000').count() >= 1, 'report overview shows the real parsed totals');
  await p.getByRole('tab', { name: /Review transactions/ }).click();
  await p.waitForSelector('text=Swiggy');
  ok((await p.locator('tbody tr').count()) === 7, 'review workspace lists all 7 parsed transactions');
  await p.selectOption('select[aria-label="Status filter"]', 'attention');
  await p.waitForSelector('text=Possible duplicate');
  ok(true, 'the repeated Freshmart debit is flagged as a possible duplicate');
  await p.getByRole('tab', { name: /Reconciliation/ }).click();
  await p.waitForSelector('text=Balance check');
  ok(await p.locator('text=/₹69,460\\.30/').count() >= 1, 'reconciliation shows the exact printed closing balance');
  const stored = await p.evaluate(() => Object.keys(localStorage).filter((k) => k.includes('_statement_')));
  ok(stored.length === 0 && (await listReports()).length === 1, 'the parsed statement is saved on the server, not in the browser');

  console.log('\n[duplicate upload detection]');
  await p.goto(BASE + '/upload');
  await p.setInputFiles('input[type=file]', path.join(FX, 'statement.csv'));
  await p.waitForSelector("text=You've already uploaded this exact file");
  ok(true, 'the same file cannot be added twice');

  console.log('\n[encrypted PDF: wrong password, then the right one]');
  await p.goto(BASE + '/upload');
  await p.setInputFiles('input[type=file]', path.join(FX, 'locked.pdf'));
  await p.waitForSelector('text=Password-protected');
  ok(await p.locator('button:has-text("Analyze statements")').isDisabled(), 'analysis is blocked until a password is supplied');
  await p.click('button:has-text("Enter password")'); await p.fill('dialog input[type=password]', PW_BAD); await p.click('dialog button:has-text("Unlock")');
  await p.click('button:has-text("Analyze statements")');
  await p.waitForSelector("text=That password didn't work", { timeout: 30000 });
  ok(true, 'a wrong password is rejected by the server and the prompt reopens');
  await p.fill('dialog input[type=password]', PW_OK); await p.click('dialog button:has-text("Unlock")');
  await p.waitForSelector('text=7 transactions found', { timeout: 30000 });
  ok(true, 'retrying with the corrected password succeeds');
  ok((await listReports()).length === 2, 'the failed attempt created no extra report (no duplicates)');

  console.log('\n[password hygiene]');
  const store = await p.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  ok(!store.includes(PW_OK) && !store.includes(PW_BAD), 'passwords are not in browser storage');
  ok(!(await p.content()).includes(PW_OK) && !(await p.content()).includes(PW_BAD), 'passwords are not rendered in the page');
  const pwRequests = apiBodies.filter((x) => x.includes(PW_OK) || x.includes(PW_BAD));
  ok(pwRequests.length === 2 && pwRequests.every((x) => x.includes('/statement-processing/process')), 'passwords were sent only to the process endpoint, once per attempt');

  console.log('\n[scanned PDF → OCR]');
  await p.goto(BASE + '/upload');
  await p.setInputFiles('input[type=file]', path.join(FX, 'scanned.pdf'));
  await p.waitForSelector('text=scanned.pdf'); await p.click('button:has-text("Analyze statements")');
  await p.waitForSelector('text=looks like a scanned document', { timeout: 30000 });
  ok(true, 'a scan is detected and the user is offered OCR');
  await p.click('button:has-text("Read it with OCR")');
  await p.waitForSelector("text=OCR isn't available on this server", { timeout: 30000 });
  ok(true, 'when OCR is unavailable the user is told honestly (nothing is faked)');

  console.log('\n[bad files]');
  await p.goto(BASE + '/upload');
  await p.setInputFiles('input[type=file]', path.join(FX, 'fake.pdf'));
  await p.waitForSelector("text=doesn't look like a real PDF");
  ok(true, 'a fake PDF is rejected before upload');

  console.log('\n[persistence + cleanup]');
  await p.goto(BASE + '/reports'); await p.reload();
  await p.waitForSelector('text=statement');
  const rid = (await listReports()).find((r) => r.name === 'statement').id;
  await p.goto(`${BASE}/reports/${rid}`);
  await p.waitForSelector('text=Money in');
  ok(true, 'after a reload the parsed report still opens');
  await p.goto(BASE + '/reports');
  await p.click('button[aria-label^="Delete "][aria-label$="statement"]'); await p.click('dialog button:has-text("Confirm")');
  await p.waitForTimeout(500);
  const left = await listReports();
  ok(left.length === 1 && left[0].name !== 'statement', 'deleting a report removes it (and its transactions) on the server');

  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('E2E crashed:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(2); });
