// Screenshots every Ledgerly onboarding slide from the built Flutter web app (served on :8090).
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const [name, viewport] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 800 }]]) {
    const p = await (await b.newContext({ viewport })).newPage();
    await p.goto('http://localhost:8090/');
    await p.waitForTimeout(6000);
    for (let i = 1; i <= 5; i++) {
      await p.waitForTimeout(1800);
      await p.screenshot({ path: `${process.argv[2]}/onb-${name}-${i}.png` });
      await p.keyboard.press('ArrowRight');
    }
    await p.close();
  }
  await b.close();
})();
