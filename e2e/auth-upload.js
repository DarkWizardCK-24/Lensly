const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3000';
const FX = path.join(__dirname, 'fixtures', 'mocked'); // separate from the real files that phase5.js uploads
fs.mkdirSync(FX, { recursive: true });
fs.writeFileSync(path.join(FX, 'locked.pdf'), '%PDF-1.7\n1 0 obj<<>>endobj\ntrailer<</Root 1 0 R/Encrypt 5 0 R>>\n%%EOF');
fs.writeFileSync(path.join(FX, 'open.csv'), 'Date,Description,Debit,Credit\n01/10/2026,Salary,,85000\n');
fs.writeFileSync(path.join(FX, 'fake.pdf'), 'this is not a pdf at all');
fs.writeFileSync(path.join(FX, 'malware.exe'), 'MZ');

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const session = { access_token: 'AT-1', refresh_token: 'RT-1', expires_in: 3600, user: { id: 'u-1', email: 'asha@example.com', user_metadata: { display_name: 'Asha Patel' } } };

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ', m); } else { fail++; console.log('  FAIL', m); } };

async function mockNet(ctx, log) {
  await ctx.route('https://mock.supabase.test/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const url = new URL(req.url());
    const body = req.postData() ? JSON.parse(req.postData()) : {};
    log.push({ path: url.pathname + url.search, method: req.method(), headers: req.headers(), body });
    const json = (status, data) => route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(data) });
    if (url.pathname.endsWith('/token') && url.searchParams.get('grant_type') === 'password') {
      return body.password === 'Correct#Pass1' ? json(200, session) : json(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
    }
    if (url.pathname.endsWith('/signup')) return json(200, { id: 'u-2', email: body.email });
    if (url.pathname.endsWith('/user')) return json(200, { id: 'u-1' });
    if (url.pathname.endsWith('/logout')) return route.fulfill({ status: 204, headers: CORS });
    if (url.pathname.endsWith('/recover')) return json(200, {});
    return json(404, {});
  });
  await ctx.route('http://localhost:8010/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    log.push({ path: new URL(req.url()).pathname, method: req.method(), headers: req.headers(), body: req.postData() ? JSON.parse(req.postData()) : {} });
    if (req.url().includes('/profiles/me')) return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ id: 'u-1', email: 'asha@example.com', display_name: 'Asha Patel', default_currency: 'INR', timezone: 'Asia/Kolkata' }) });
    return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: '{"status":"ok","database":"ok"}' });
  });
}

(async () => {
  const b = await chromium.launch();

  console.log('\n[auth] guard, login errors, success, storage');
  {
    const ctx = await b.newContext(); const log = []; await mockNet(ctx, log); const p = await ctx.newPage();
    await p.goto(BASE + '/'); await p.waitForURL('**/login');
    ok(true, 'unauthenticated visit to / redirects to /login');

    await p.fill('input[type=email]', 'asha@example.com');
    await p.fill('input[autocomplete=current-password]', 'WrongPass!1');
    await p.click('button[type=submit]');
    await p.waitForSelector('text=Incorrect email or password.');
    ok(true, 'wrong password shows a friendly error');
    ok(!(await p.content()).includes('WrongPass'), 'wrong password is never echoed in the page');

    await p.fill('input[autocomplete=current-password]', 'Correct#Pass1');
    await p.click('button[type=submit]');
    await p.waitForURL(BASE + '/');
    const stored = await p.evaluate(() => JSON.stringify({ ...localStorage }));
    ok(stored.includes('AT-1') && stored.includes('fp_session'), 'session tokens are stored');
    ok(!stored.includes('Correct#Pass1') && !stored.includes('WrongPass'), 'passwords are never stored');
    const tokenReq = log.find((l) => l.path.includes('grant_type=password') && l.body.password === 'Correct#Pass1');
    ok(tokenReq && tokenReq.headers.apikey === 'anon-test-key', 'sign-in request carries the apikey header');
    await p.waitForSelector('aside >> text=Asha Patel');
    ok(true, 'sidebar shows the signed-in user');

    await p.goto(BASE + '/settings');
    await p.waitForSelector('text=Synced');
    ok(true, 'settings shows the shared profile as synced');
    await p.click('text=Edit name'); await p.fill('input[aria-label="Display name"]', 'Asha P.'); await p.click('button:has-text("Save")');
    await p.waitForSelector('text=Name updated and synced');
    const put = log.find((l) => l.method === 'PUT' && l.path.endsWith('/auth/v1/user'));
    const patch = log.find((l) => l.method === 'PATCH' && l.path.endsWith('/profiles/me'));
    ok(put && put.headers.authorization === 'Bearer AT-1' && put.body.data.display_name === 'Asha P.', 'name saved to Supabase Auth metadata');
    ok(patch && patch.body.display_name === 'Asha P.', 'name synced to the shared profile endpoint (same row CashBook reads)');

    await p.click('text=Sign out >> nth=0'); await p.click('dialog button:has-text("Sign out")');
    await p.waitForURL('**/login');
    ok(await p.evaluate(() => !localStorage.getItem('fp_session')), 'sign out clears the stored session');
    ok(log.some((l) => l.path.endsWith('/logout')), 'sign out revokes the session remotely');
    await ctx.close();
  }

  console.log('\n[auth] register + validation');
  {
    const ctx = await b.newContext(); const log = []; await mockNet(ctx, log); const p = await ctx.newPage();
    await p.goto(BASE + '/register');
    await p.click('button[type=submit]');
    await p.waitForSelector('text=Enter your name');
    ok(true, 'empty register form shows validation errors');
    await p.fill('input[autocomplete=name]', 'Ravi Kumar'); await p.fill('input[type=email]', 'ravi@example.com');
    const pw = p.locator('input[autocomplete=new-password]');
    await pw.nth(0).fill('Abcdefgh1!'); await pw.nth(1).fill('Different1!');
    await p.waitForSelector('text=Strong');
    ok(true, 'strength meter reports Strong');
    await p.click('button[type=submit]');
    await p.waitForSelector("text=Passwords don't match");
    ok(true, 'mismatched confirmation is rejected');
    await pw.nth(1).fill('Abcdefgh1!'); await p.click('button[type=submit]');
    await p.waitForSelector('text=confirmation link');
    ok(log.some((l) => l.path.endsWith('/signup') && l.body.data.display_name === 'Ravi Kumar'), 'sign-up sends the display name in metadata');
    ok(true, 'email-confirmation message shown (no session created)');
    ok(await p.evaluate(() => !localStorage.getItem('fp_session')), 'no session stored before confirmation');
    await ctx.close();
  }

  console.log('\n[reports] Report Books CRUD (sample mode)');
  {
    const ctx = await b.newContext(); const log = []; await mockNet(ctx, log); const p = await ctx.newPage();
    await p.goto(BASE + '/login'); await p.click('text=Explore with sample data'); await p.waitForURL(BASE + '/');
    await p.goto(BASE + '/reports');
    await p.waitForSelector('text=Personal accounts');
    ok(await p.locator('text=New Report Book').count() >= 2, 'dashed add card + header button for new Report Book');
    await p.click('main >> text=New Report Book >> nth=-1');
    await p.fill('dialog input >> nth=0', 'Personal accounts'); await p.click('dialog button:has-text("Create book")');
    await p.waitForSelector('text=already have a Report Book with this name');
    ok(true, 'duplicate book names are rejected');
    await p.fill('dialog input >> nth=0', 'Travel cards'); await p.click('dialog button:has-text("Create book")');
    await p.waitForSelector('h3:has-text("Travel cards")');
    ok(true, 'new Report Book created');
    await p.click('button[aria-label="Delete Personal accounts"]'); await p.click('dialog button:has-text("Confirm")');
    await p.waitForSelector('text=Move or delete them first');
    ok(await p.locator('h3:has-text("Personal accounts")').count() === 1, 'a book that holds reports cannot be deleted');
    await p.click('button[aria-label="Delete Travel cards"]'); await p.click('dialog button:has-text("Confirm")');
    await p.waitForTimeout(300);
    ok(await p.locator('h3:has-text("Travel cards")').count() === 0, 'an empty book can be deleted');
    await p.click('button[aria-label^="Move HDFC Savings — September"]'); await p.click('dialog button:has-text("Business")');
    await p.waitForSelector('text=Moved to Business');
    ok(true, 'a report can be moved between books');
    await ctx.close();
  }

  console.log('\n[upload] validation, encrypted PDF, password handling');
  {
    const ctx = await b.newContext(); const log = []; await mockNet(ctx, log); const p = await ctx.newPage();
    await p.goto(BASE + '/login'); await p.click('text=Explore with sample data'); await p.waitForURL(BASE + '/');
    await p.goto(BASE + '/upload');
    await p.setInputFiles('input[type=file]', [path.join(FX, 'locked.pdf'), path.join(FX, 'open.csv'), path.join(FX, 'fake.pdf'), path.join(FX, 'malware.exe')]);
    await p.waitForSelector('text=Password-protected');
    ok(true, 'encrypted PDF is detected from its contents');
    ok(await p.locator("text=doesn't look like a real PDF").count() === 1, 'a text file renamed to .pdf is rejected by content check');
    ok(await p.locator('text=Unsupported file type').count() === 1, '.exe is rejected');
    ok(await p.locator('button:has-text("Analyze statements")').isDisabled(), 'Analyze is blocked until the password is supplied');

    await p.click('button:has-text("Enter password")');
    await p.click('dialog button:has-text("Unlock")');
    await p.waitForSelector('text=Enter the document password');
    ok(true, 'empty password is rejected with guidance');
    await p.fill('dialog input[type=password]', 'Pdf#Secret77'); await p.click('dialog button:has-text("Unlock")');
    await p.waitForSelector('text=Password ready');
    const store1 = await p.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
    ok(!store1.includes('Pdf#Secret77'), 'password is not in localStorage/sessionStorage');
    ok(!(await p.content()).includes('Pdf#Secret77'), 'password is not rendered into the page');

    await p.click('button:has-text("Analyze statements")');
    await p.waitForSelector('text=Awaiting parser', { timeout: 20000 });
    ok(true, 'processing completes with an honest "Awaiting parser" status');
    const store2 = await p.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
    ok(!store2.includes('Pdf#Secret77'), 'password absent from storage after processing');
    const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('fp_reports_demo') || '{}'));
    const rep = (saved.reports || []).find((r) => r.source === 'locked.pdf');
    ok(rep && rep.status === 'uploaded' && saved.books.some((bk) => bk.id === rep.bookId) && !('password' in rep), 'report metadata saved to the chosen Report Book (no password field)');
    ok(!log.some((l) => JSON.stringify(l).includes('Pdf#Secret77')), 'password never sent over the network in this phase');
    await ctx.close();
  }

  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('E2E crashed:', e.message); process.exit(2); });
