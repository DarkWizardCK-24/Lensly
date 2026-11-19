"""Compose the 1920x1080 promo thumbnails in docs/thumbnails/.

    python tool/make_thumbnails.py

Uses docs/screenshots/*.png, docs/branding/logo.svg and Plus Jakarta Sans in
docs/fonts/ (the app's own typeface via next/font, from github.com/google/fonts).
Pages are plain HTML rendered with Playwright, with every image and font
embedded, so the output is reproducible. Writes lensly-thumb-1-hero.png,
-2-devices.png, -3-gallery.png.
"""
import base64
import glob
import io
import os

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, 'docs', 'screenshots')
OUT = os.path.join(ROOT, 'docs', 'thumbnails')

# Copy from README.md
TAGLINE = 'Know where your money goes.'
BLURB = ('Upload a bank statement and see exactly where the money went: reconciled, '
         'categorised, with evidence-based savings ideas.')
PILLS = ['PDF, CSV &amp; Excel', 'Balance reconciliation', 'Duplicate detection', 'Savings ideas']


def data_uri(path, max_w=1000, fmt='JPEG'):
    """Downscale + embed an image (keeps the HTML small)."""
    with Image.open(path) as im:
        im = im.convert('RGB')
        if im.width > max_w:
            im = im.resize((max_w, round(im.height * max_w / im.width)), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, fmt, quality=95, subsampling=0)
    mime = 'image/jpeg' if fmt == 'JPEG' else 'image/png'
    return f'data:{mime};base64,' + base64.b64encode(buf.getvalue()).decode()


def logo_uri():
    with open(os.path.join(ROOT, 'docs', 'branding', 'logo.svg'), 'rb') as f:
        return 'data:image/svg+xml;base64,' + base64.b64encode(f.read()).decode()


def font_face(family, rel, weight='200 800'):
    with open(os.path.join(ROOT, rel), 'rb') as f:
        b64 = base64.b64encode(f.read()).decode()
    return (f"@font-face{{font-family:'{family}';font-weight:{weight};"
            f"src:url(data:font/ttf;base64,{b64}) format('truetype');}}")


def shot_path(name):
    return os.path.join(SHOTS, name + '.png')


def shot(name, **kw):
    return data_uri(shot_path(name), **kw)


def ratio(name):
    """height / width of a screenshot, read from the file itself."""
    with Image.open(shot_path(name)) as im:
        return im.height / im.width


# Palette "Ruby & Gold" from src/app/globals.css (dark theme) + docs/branding/logo.svg
BG = '#12080b'
ROSE, RUBY, WINE, GOLD, AMBER = '#ff7a9a', '#e11d48', '#881337', '#ffb703', '#ff8a1f'
INCOME = '#12b76a'
GRAD = f'linear-gradient(135deg,{ROSE} 0%,{RUBY} 55%,{WINE} 100%)'   # .grad-brand
GRAD_GOLD = f'linear-gradient(135deg,#ffd166 0%,{AMBER} 100%)'        # .grad-gold
GRAD_TEXT = 'linear-gradient(135deg,#ffd166,#ff9a2f 40%,#fb7185 100%)'

CSS = f'''
* {{ box-sizing: border-box; margin: 0; }}
html, body {{ width: 1920px; height: 1080px; overflow: hidden; }}
body {{
  font-family: "Plus Jakarta Sans", "Segoe UI", Arial, sans-serif; color: #fbeff1; position: relative;
  background:
    radial-gradient(1100px 760px at 10% -12%, rgba(225,29,72,.28), transparent 60%),
    radial-gradient(900px 640px at 98% 2%, rgba(255,138,31,.16), transparent 60%),
    radial-gradient(900px 700px at 55% 118%, rgba(225,29,72,.18), transparent 60%),
    {BG};
}}
/* faint dot texture */
body::before {{
  content: ""; position: absolute; inset: 0; opacity: .6;
  background-image: radial-gradient(rgba(255,255,255,.07) 1.5px, transparent 1.5px);
  background-size: 40px 40px;
  -webkit-mask-image: radial-gradient(ellipse at 60% 40%, #000 15%, transparent 75%);
  mask-image: radial-gradient(ellipse at 60% 40%, #000 15%, transparent 75%);
}}
.abs {{ position: absolute; }}
.glow {{ position: absolute; border-radius: 50%; filter: blur(30px); pointer-events: none; }}
.vig {{ position: absolute; inset: 0; background: radial-gradient(1400px 900px at 60% 50%, transparent 55%, rgba(0,0,0,.4) 100%); pointer-events: none; z-index: 8; }}
.spark {{ position: absolute; width: 56px; height: 56px; z-index: 6; }}
.logo {{ border-radius: 23%; box-shadow: 0 18px 50px rgba(0,0,0,.6), 0 0 70px rgba(225,29,72,.35); }}
h1 {{ font-weight: 800; letter-spacing: -5px; line-height: 1.05; white-space: nowrap; }}
h1 b {{ font-weight: 800; background: {GRAD_TEXT}; padding-right: 6px;
  -webkit-background-clip: text; background-clip: text; color: transparent; }}
.tag {{ font-weight: 700; letter-spacing: -.5px; white-space: nowrap;
  background: linear-gradient(90deg,{ROSE},#ff9a2f 60%,{GOLD}); -webkit-background-clip: text; background-clip: text; color: transparent; }}
.blurb {{ color: rgba(251,239,241,.74); line-height: 1.42; }}
.pills {{ display: flex; flex-wrap: wrap; gap: 14px; width: 800px; }}
.pill {{
  display: inline-flex; align-items: center; gap: 12px; padding: 10px 22px;
  border-radius: 999px; border: 2px solid rgba(255,255,255,.12);
  background: linear-gradient(180deg, rgba(255,255,255,.07), rgba(255,255,255,.03)); font-size: 26px; font-weight: 600;
}}
.pill i {{ width: 12px; height: 12px; border-radius: 50%; background: {GRAD_GOLD}; display: block; box-shadow: 0 0 10px rgba(255,183,3,.6); }}
.chip {{ display: inline-flex; align-items: center; gap: 12px; padding: 12px 26px;
  border-radius: 999px; background: {GRAD}; color: #fff; font-weight: 800; font-size: 26px; white-space: nowrap;
  box-shadow: 0 10px 30px -8px rgba(225,29,72,.65); }}
.chip i {{ width: 12px; height: 12px; border-radius: 50%; background: {GOLD}; display: block; }}
.plat {{ white-space: nowrap; font-size: 25px; font-weight: 600; color: rgba(251,239,241,.68); letter-spacing: .3px; }}
.phone {{
  position: absolute; background: #0c0608; border-radius: 64px; padding: 14px;
  box-shadow: 0 0 0 3px #3a2a2f, 0 40px 90px rgba(0,0,0,.7), 0 0 0 1px #000 inset;
}}
.phone .scr {{ position: relative; border-radius: 50px; overflow: hidden; background: #fdf6f7; width: 100%; height: 100%; }}
.phone .bar {{ height: 44px; background: #fdf6f7; }}
.phone img {{ width: 100%; height: auto; display: block; }}
.phone .notch {{ position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
  width: 30%; height: 24px; background: #000; border-radius: 99px; z-index: 2; }}
.laptop-screen {{
  position: absolute; background: #0c0608; border-radius: 24px; padding: 14px;
  box-shadow: 0 0 0 3px #3a2a2f, 0 40px 90px rgba(0,0,0,.65);
}}
.laptop-screen img {{ width: 100%; height: auto; display: block; border-radius: 10px; }}
.laptop-base {{ position: absolute; height: 22px; border-radius: 0 0 26px 26px;
  background: linear-gradient(#4a3c41, #1e1518); box-shadow: 0 30px 50px rgba(0,0,0,.5); }}
.laptop-base::after {{ content: ""; position: absolute; left: 50%; top: 0; transform: translateX(-50%);
  width: 160px; height: 8px; border-radius: 0 0 10px 10px; background: #170f12; }}
.card {{
  position: absolute; display: flex; align-items: center; gap: 22px; padding: 22px 34px 22px 22px;
  border-radius: 28px; background: rgba(28,16,19,.95); border: 2px solid rgba(255,255,255,.11);
  box-shadow: 0 24px 60px rgba(0,0,0,.6), 0 1px 0 rgba(255,255,255,.06) inset; z-index: 7; white-space: nowrap;
}}
.card .ic {{ width: 78px; height: 78px; border-radius: 20px; display: grid; place-items: center; }}
.card small {{ display: block; font-size: 26px; color: rgba(251,239,241,.62); letter-spacing: .3px; }}
.card strong {{ display: block; font-size: 38px; font-weight: 800; letter-spacing: -.5px; }}
'''

SPARK = ('<svg class="spark" style="{s}" viewBox="0 0 100 100"><defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="1">'
         '<stop offset="0" stop-color="#fff0b3"/><stop offset="1" stop-color="#ffb703"/></linearGradient></defs>'
         '<path d="M50 2 C54 38 62 46 98 50 C62 54 54 62 50 98 C46 62 38 54 2 50 C38 46 46 38 50 2 Z" fill="url(#sg)" opacity=".92"/></svg>')


def icon(path, stroke='#ffffff', size=44):
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{stroke}" stroke-width="2.4" '
            f'stroke-linecap="round" stroke-linejoin="round">{path}</svg>')


DARK = '#2a0a12'
ICON_FILE = icon('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>'
                 '<path d="M12 18v-6M9 15l3-3 3 3"/>')
ICON_SCALE = icon('<path d="M12 3v18M7 21h10M5 7h14"/><path d="M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>', stroke=DARK)
ICON_BULB = icon('<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>',
                 stroke=DARK)
ICON_DOWNLOAD = icon('<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>')


def card(style, ic, bg, small, strong):
    return (f'<div class="card" style="{style}"><div class="ic" style="background:{bg}">{ic}</div>'
            f'<div><small>{small}</small><strong>{strong}</strong></div></div>')


def phone(name, left, top, w, rot=0, z=1):
    """Phone frame sized from the screenshot's real aspect ratio (no cropping)."""
    inner_w = w - 28
    h = phone_h(name, w)
    return (f'<div class="phone" style="left:{left}px;top:{top}px;width:{w}px;height:{h}px;'
            f'transform:rotate({rot}deg);z-index:{z}"><div class="scr"><div class="notch"></div><div class="bar"></div>'
            f'<img src="{shot(name)}" style="width:{inner_w}px"></div></div>')


def phone_h(name, w):
    return round((w - 28) * ratio(name)) + 44 + 28


def laptop(name, left, top, w):
    inner_w = w - 28
    h = round(inner_w * ratio(name)) + 28
    return (f'<div class="laptop-screen" style="left:{left}px;top:{top}px;width:{w}px;height:{h}px">'
            f'<img src="{shot(name, max_w=1600)}"></div>'
            f'<div class="laptop-base" style="left:{left - 50}px;top:{top + h}px;width:{w + 100}px"></div>')


def title():
    return 'Lens<b>ly</b>'


def left_block(t):
    pills = ''.join(f'<span class="pill"><i></i>{p}</span>' for p in PILLS)
    return f'''
  <img class="logo abs" src="{logo_uri()}" style="left:110px;top:{t}px;width:160px;height:160px">
  <h1 class="abs" style="left:102px;top:{t + 185}px;font-size:156px">{title()}</h1>
  <div class="tag abs" style="left:110px;top:{t + 370}px;font-size:50px">{TAGLINE}</div>
  <div class="blurb abs" style="left:110px;top:{t + 452}px;width:840px;font-size:30px">{BLURB}</div>
  <div class="pills abs" style="left:110px;top:{t + 620}px">{pills}</div>
  <div class="abs" style="left:110px;top:{t + 790}px;display:flex;align-items:center;gap:24px">
    <span class="chip"><i></i>Built with Next.js</span>
    <span class="plat">Web &nbsp;&middot;&nbsp; Installable PWA &nbsp;&middot;&nbsp; Mobile &amp; desktop</span>
  </div>'''


def hero():
    return (
        '<div class="glow" style="left:1060px;top:120px;width:820px;height:820px;background:radial-gradient(circle,rgba(225,29,72,.26),rgba(255,138,31,.08) 45%,transparent 68%)"></div>'
        + left_block(50)
        + SPARK.format(s='left:905px;top:110px;width:44px;height:44px')
        + SPARK.format(s='left:960px;top:975px;width:38px;height:38px')
        + SPARK.format(s='left:1850px;top:420px;width:44px;height:44px')
        + phone('live-upload-results-mobile', 1010, 270, 350, rot=-9, z=1)
        + phone('recommendations-mobile', 1525, 260, 350, rot=8, z=1)
        + phone('report-mobile', 1245, 130, 420, rot=0, z=3)
        + card('left:1000px;top:40px', ICON_FILE, GRAD, 'Upload statements', 'PDF · CSV · XLSX · XLS')
        + card('left:1330px;top:905px', ICON_SCALE, GRAD_GOLD, 'Reconciliation', 'Every running balance')
        + '<div class="vig"></div>'
    )


def devices():
    return (
        '<div class="glow" style="left:1000px;top:160px;width:860px;height:760px;background:radial-gradient(circle,rgba(225,29,72,.22),transparent 66%)"></div>'
        + left_block(50)
        + SPARK.format(s='left:905px;top:110px;width:44px;height:44px')
        + SPARK.format(s='left:1835px;top:150px;')
        + laptop('live-report-desktop', 990, 230, 800)
        + phone('reconciliation-warnings-mobile', 1585, 330, 290, rot=0, z=3)
        + card('left:1010px;top:60px', ICON_BULB, GRAD_GOLD, 'Savings ideas', 'With the assumption shown')
        + card('left:1000px;top:870px', ICON_DOWNLOAD, GRAD, 'Export reports', 'CSV · Excel · PDF')
        + '<div class="vig"></div>'
    )


def gallery():
    specs = [  # name, width, top
        ('live-upload-queue-mobile', 280, 410),
        ('reconciliation-warnings-mobile', 300, 370),
        ('report-mobile', 330, 310),
        ('recommendations-mobile', 300, 370),
        ('compare-mobile', 280, 410),
    ]
    gap = 44
    total = sum(w for _, w, _ in specs) + gap * (len(specs) - 1)
    x = (1920 - total) // 2
    phones = ''
    for i, (n, w, y) in enumerate(specs):
        phones += phone(n, x, y, w, z=3 if i == 2 else 1)
        x += w + gap
    return f'''
  <div class="glow" style="left:560px;top:260px;width:800px;height:800px;background:radial-gradient(circle,rgba(225,29,72,.24),transparent 66%)"></div>
  <div class="abs" style="left:0;top:50px;width:1920px;display:flex;justify-content:center;align-items:center;gap:34px">
    <img class="logo" src="{logo_uri()}" style="width:130px;height:130px">
    <h1 style="font-size:140px">{title()}</h1>
  </div>
  <div class="tag abs" style="left:0;top:214px;width:1920px;text-align:center;font-size:52px">{TAGLINE}</div>
  {SPARK.format(s='left:160px;top:110px;')}
  {SPARK.format(s='left:1720px;top:200px;width:44px;height:44px')}
  {phones}
  <div class="vig"></div>'''


PAGES = {
    'lensly-thumb-1-hero.png': hero,
    'lensly-thumb-2-devices.png': devices,
    'lensly-thumb-3-gallery.png': gallery,
}


def main():
    os.makedirs(OUT, exist_ok=True)
    css = font_face('Plus Jakarta Sans', 'docs/fonts/PlusJakartaSans.ttf') + CSS
    with sync_playwright() as p:
        try:
            browser = p.chromium.launch()
        except Exception:
            exe = sorted(glob.glob(os.path.join(os.environ.get('LOCALAPPDATA', ''), 'ms-playwright',
                                                'chromium-*', 'chrome-win*', 'chrome.exe')))[-1]
            browser = p.chromium.launch(executable_path=exe)
        page = browser.new_page(viewport={'width': 1920, 'height': 1080})
        for name, build in PAGES.items():
            page.set_content(f'<html><head><meta charset="utf-8"><style>{css}</style></head><body>{build()}</body></html>')
            page.wait_for_timeout(700)
            path = os.path.join(OUT, name)
            page.screenshot(path=path)
            with Image.open(path) as im:
                assert im.size == (1920, 1080), im.size
            print('saved', path)
        browser.close()


if __name__ == '__main__':
    main()
