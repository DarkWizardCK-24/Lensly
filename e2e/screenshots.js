// Regenerates the README screenshots for the Phase 6-8 screens from a REAL backend with seeded data.
// Needs a FRESH dev API (see phase6.js) and `npm i --no-save playwright`. Output: docs/screenshots/*.png
const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3000';
const API = 'http://localhost:8010/api/v1';
const SECRET = process.env.JWT_SECRET || 'e2e-secret-e2e-secret-e2e-secret-1234';
const FX = path.join(__dirname, 'fixtures');
const OUT = path.join(__dirname, '..', 'docs', 'screenshots');
const USER = '11111111-1111-4111-8111-111111111111';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt(sub) {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ sub, aud: 'authenticated', email: 'asha@example.com', exp: Math.floor(Date.now() / 1000) + 3600 });
  return `${head}.${body}.${crypto.createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')}`;
}
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const TOKEN = jwt(USER);
  const H = { authorization: `Bearer ${TOKEN}` };
  const session = { access_token: TOKEN, refresh_token: 'RT', expires_in: 3600, user: { id: USER, email: 'asha@example.com', user_metadata: { display_name: 'Asha Patel' } } };

  const seedCtx = await b.newContext();
  const post = async (p, o) => (await seedCtx.request.post(`${API}${p}`, { headers: H, ...o })).json();
  const rb = await post('/report-books', { data: { name: 'Household', description: 'Joint account', color: '#e11d48', icon_key: 'users' } });
  let reportId;
  for (const [file, name] of [['statement.csv', 'September account'], ['statement.xlsx', 'September (Excel copy)']]) {
    const r = await post('/statement-processing/process', { multipart: { file: { name: file, mimeType: 'application/octet-stream', buffer: fs.readFileSync(path.join(FX, file)) }, report_book_id: rb.id, report_name: name } });
    reportId ||= r.report_id;
  }
  const rows = await (await seedCtx.request.get(`${API}/reports/${reportId}/transactions`, { headers: H })).json();
  await seedCtx.request.put(`${API}/reports/${reportId}/reviews`, { headers: H, data: { items: rows.slice(0, 4).map((t) => ({ transaction_id: t.id, reviewed: true })) } });
  await seedCtx.request.post(`${API}/reports/${reportId}/versions`, { headers: H });
  await seedCtx.request.patch(`${API}/profiles/me`, { headers: H, data: { display_name: 'Asha Patel' } });
  await post('/cashbooks', { data: { name: 'Main account', currency: 'INR', opening_minor: 1000000 } });
  await seedCtx.close();

  for (const [tag, viewport] of [['desktop', { width: 1280, height: 800 }], ['mobile', { width: 390, height: 844 }]]) {
    const ctx = await b.newContext({ viewport, deviceScaleFactor: 2 });
    await ctx.route('https://mock.supabase.test/**', (r) => (r.request().method() === 'OPTIONS' ? r.fulfill({ status: 204, headers: CORS }) : r.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(session) })));
    const p = await ctx.newPage();
    await p.goto(BASE + '/login');
    await p.fill('input[type=email]', 'asha@example.com'); await p.fill('input[autocomplete=current-password]', 'Correct#Pass1');
    await p.click('button[type=submit]'); await p.waitForURL(BASE + '/');
    await p.waitForSelector('text=September account');
    const shot = async (name, full = false) => { await p.waitForTimeout(900); await p.screenshot({ path: path.join(OUT, `${name}-${tag}.png`), fullPage: full }); };

    await p.goto(`${BASE}/reports/${reportId}`); await p.waitForSelector('text=Money in');
    await shot('live-report');
    await p.getByRole('tab', { name: /Review transactions/ }).click(); await p.waitForSelector('text=Swiggy', { state: 'attached' });
    await shot('live-review');

    await p.goto(`${BASE}/reports/${reportId}/import`); await p.waitForSelector('text=eligible');
    await p.click('button:has-text("Continue")'); await p.click('button:has-text("Preview")'); await p.waitForSelector('text=Will be created');
    await shot('live-import');

    await p.goto(BASE + '/settings'); await p.waitForSelector('text=Download all my data');
    await p.locator('#data-h').scrollIntoViewIfNeeded();
    await shot('data-controls', true);

    if (tag === 'desktop') {
      await p.goto(BASE + '/'); await p.waitForSelector('text=September account');
      await p.keyboard.press('Control+k'); await p.waitForSelector('dialog[open] input[role=combobox]');
      await p.waitForFunction(() => document.activeElement?.getAttribute('role') === 'combobox');
      await p.keyboard.type('sept'); await shot('command-palette');
      await p.keyboard.press('Escape'); await p.waitForSelector('dialog[open]', { state: 'detached' });
      await p.waitForTimeout(400);
      await p.keyboard.press('?'); await p.waitForSelector('dialog[open] >> text=Keyboard shortcuts'); await shot('shortcuts');
    }
    await ctx.close();
  }
  await b.close();
  console.log('screenshots written to', OUT);
})().catch((e) => { console.error('failed:', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });
