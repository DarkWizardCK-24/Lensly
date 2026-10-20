<div align="center">

<img src="docs/branding/logo.png" width="140" alt="Lensly logo" />

# Lensly

**Know where your money goes.** Lensly is the statement-analysis companion to **Ledgerly**, the multi-ledger CashBook app: upload a statement, see the spending, and import the reviewed rows into a CashBook. Same account, one backend.

A responsive web app that turns bank statements into clear spending insights and evidence-based savings ideas.

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs)
![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Status](https://img.shields.io/badge/Phase-8%20Complete-E11D48)

</div>

---

## Screenshots

**Sign in & register**

| Sign in | Register (with password strength) | Mobile |
|:--:|:--:|:--:|
| <img src="docs/screenshots/login-desktop.png" width="300" /> | <img src="docs/screenshots/register-desktop.png" width="300" /> | <img src="docs/screenshots/login-mobile.png" width="130" /> |

**Desktop**

| Dashboard | Report Books (grouped reports) |
|:--:|:--:|
| <img src="docs/screenshots/dashboard-desktop.png" width="440" /> | <img src="docs/screenshots/report-books-desktop.png" width="440" /> |
| **Upload center** | **Password prompt** |
| <img src="docs/screenshots/upload-desktop.png" width="440" /> | <img src="docs/screenshots/password-desktop.png" width="440" /> |
| **Sample report (donut, bars, progress, timeline)** | **Account & settings** |
| <img src="docs/screenshots/report-desktop.png" width="440" /> | <img src="docs/screenshots/settings-desktop.png" width="440" /> |
| **Analysis pipeline timeline** | |
| <img src="docs/screenshots/pipeline-desktop.png" width="440" /> | |

**Phase 5 — real processing** (signed in, real backend)

| Queue: CSV + encrypted PDF + scan | Wrong password → retry |
|:--:|:--:|
| <img src="docs/screenshots/live-upload-queue-desktop.png" width="440" /> | <img src="docs/screenshots/live-password-retry-desktop.png" width="440" /> |
| **Results: parsed and reconciled** | **Parsed transactions in the review workspace** |
| <img src="docs/screenshots/live-upload-results-desktop.png" width="440" /> | <img src="docs/screenshots/live-parsed-review-desktop.png" width="440" /> |

**Phase 4 — review, reconcile, analyze** (sample statements, clearly labelled)

| Review workspace | Reconciliation: not reconciled |
|:--:|:--:|
| <img src="docs/screenshots/review-desktop.png" width="440" /> | <img src="docs/screenshots/reconciliation-failed-desktop.png" width="440" /> |
| **Report overview** | **Savings ideas (evidence + assumptions)** |
| <img src="docs/screenshots/report-overview-desktop.png" width="440" /> | <img src="docs/screenshots/recommendations-desktop.png" width="440" /> |
| **Compare reports** | **Import into CashBook (preview)** |
| <img src="docs/screenshots/compare-desktop.png" width="440" /> | <img src="docs/screenshots/import-preview-desktop.png" width="440" /> |
| **Budgets & savings** | **Reconciled with warnings** |
| <img src="docs/screenshots/budgets-desktop.png" width="440" /> | <img src="docs/screenshots/reconciliation-warnings-desktop.png" width="440" /> |

**Mobile**

| Dashboard | Report Books | Upload | Password | Settings | Register |
|:--:|:--:|:--:|:--:|:--:|:--:|
| <img src="docs/screenshots/dashboard-mobile.png" width="130" /> | <img src="docs/screenshots/report-books-mobile.png" width="130" /> | <img src="docs/screenshots/upload-mobile.png" width="130" /> | <img src="docs/screenshots/password-mobile.png" width="130" /> | <img src="docs/screenshots/settings-mobile.png" width="130" /> | <img src="docs/screenshots/register-mobile.png" width="130" /> |

| Report overview | Review | Reconciliation | Savings ideas | Compare | Import | Budgets |
|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| <img src="docs/screenshots/report-overview-mobile.png" width="110" /> | <img src="docs/screenshots/review-mobile.png" width="110" /> | <img src="docs/screenshots/reconciliation-failed-mobile.png" width="110" /> | <img src="docs/screenshots/recommendations-mobile.png" width="110" /> | <img src="docs/screenshots/compare-mobile.png" width="110" /> | <img src="docs/screenshots/import-preview-mobile.png" width="110" /> | <img src="docs/screenshots/budgets-mobile.png" width="110" /> |

Responsive by design: **fixed sidebar** on desktop, **top bar + bottom tab bar** on tablet and phone. The report preview is labelled *Sample data — illustrative only* (₹ INR).

## Logo & launcher icons

The mark is a tilted statement sheet with a trend line, gold-tipped bars and a magnifier, on a *Ruby & Gold* gradient.

| Logo | PWA 512 | PWA 192 | Apple touch icon |
|:--:|:--:|:--:|:--:|
| <img src="docs/branding/logo.png" width="96" /> | <img src="docs/branding/pwa-icon-512.png" width="96" /> | <img src="docs/branding/pwa-icon-192.png" width="96" /> | <img src="docs/branding/apple-touch-icon.png" width="96" /> |

Source art: [`docs/branding/logo.svg`](docs/branding/logo.svg). Wired up through `src/app/icon.svg`, `src/app/apple-icon.png` and `public/manifest.webmanifest`.

## Design system

- **Font:** Plus Jakarta Sans via `next/font/google`
- **Palette — Ruby & Gold:** brand `#E11D48`, gold `#FFB703`, income `#12B76A`, expense `#F04438`, warm neutral surfaces
- **Themes:** light and dark via `prefers-color-scheme`, defined as CSS tokens in `src/app/globals.css`
- **Accessibility:** semantic landmarks, `aria-current` navigation, reduced-motion support
- **Libraries:** Tailwind CSS 4, Lucide icons, TanStack Query, React Hook Form + Zod, Recharts, Motion (installed, used as features land)

## Features

### Built today
- **Accounts:** sign in, register (React Hook Form + Zod, password strength meter), forgot password, sign out, session restore/refresh, route guard. Uses **Supabase Auth** — the same accounts as Ledgerly (the CashBook app). Only tokens are stored in the browser; passwords never are
- **Settings / profile:** name editing writes to Supabase Auth and to the **shared profile** endpoint, so Ledgerly shows the same name
- **Report Books:** group statements and reports (create, edit, delete-with-guard), move / rename / delete reports, search, status chips
- **Upload center — real processing for signed-in users:** content-based validation, the **server** decides if a file is encrypted, accessible **password prompt** with retry on a wrong password (no duplicate reports), **OCR offer** for scans, duplicate-upload detection by content hash, and results (transactions found, reconciliation status, warnings) that flow straight into the review / reconcile / analysis screens. Sample mode keeps a labelled preview flow
- **Transaction review workspace** — table on desktop, cards on mobile: search, debit/credit/category/date/status filters, inline category and merchant edits, bulk categorize and mark-reviewed, paging, CSV export of the selection or filtered rows (formula-injection safe). Original extracted text is kept beside corrected values; suggested vs corrected categories are distinguished; duplicate and low-confidence (OCR) rows are flagged
- **Reconciliation:** opening + credits − debits vs the statement's closing balance, plus a row-by-row running-balance check → *Reconciled*, *with warnings*, *Not reconciled* (exact difference shown, never forced) or *Unable to reconcile*
- **Report overview:** KPIs, category donut with progress bars, top merchants, probable recurring payments, "worth a look" list (duplicates, fees, OCR)
- **Savings ideas:** evidence-backed suggestions with date range, observed spend, proposed action, **estimated saving with its stated assumption**, confidence and priority; status (new / reviewed / completed / dismissed) and helpful feedback; says "not enough data" instead of guessing
- **Compare reports:** side-by-side metrics and category bars with a **coverage warning** when period lengths differ
- **Import into CashBook:** only reviewed, non-duplicate rows; destination, category and payment-method mapping; balance preview; explicit confirmation; **idempotent** (retries skip already-imported rows via stable fingerprints); audit history. **Signed in, it really writes to your CashBook** through the API (insert-only, atomic, retry-safe); sample mode only records a local audit entry
- **Budgets & savings:** your own monthly category budgets vs actuals (alerts when nearing or over the limit), savings goals, potential-vs-realized savings. Starts empty — no invented budgets
- Animated dashboard with recent reports and potential savings, sample report preview, analysis pipeline timeline
- **Server-side persistence (signed in):** reports, corrections, versions, budgets and goals live in the database; snapshots, CSV / Excel / PDF export, comparison and savings-idea status all go through the API
- **Keyboard & accessibility:** `Ctrl/⌘ K` quick actions (pages and reports), `G` then `D/U/R/C/S/B/,` navigation, `?` shortcut help, skip link, visible focus; **axe-core WCAG 2.1 A/AA scan passes with no serious/critical issues on every page**
- **Your data:** download everything as JSON, delete Analyzer / CashBook / all data (typed `DELETE` confirmation), delete the account
- **Tests:** 17 unit tests + **133 Playwright end-to-end checks** in `e2e/` — 66 with mocked Supabase/API and **67 against the real backend on a real PostgreSQL with real files** (`phase5.js` upload/parse, `phase6.js` persistence/versions/exports/compare/import/ownership, `phase8.js` keyboard/accessibility/data controls)

> Sample-mode statements are **generated** and labelled as such. Everything you do while signed in is stored on the server and scoped to you.

### Phases 6-8 in pictures
| | |
|---|---|
| <img src="docs/screenshots/live-report-desktop.png" width="440" /> | <img src="docs/screenshots/live-import-desktop.png" width="440" /> |
| <img src="docs/screenshots/command-palette-desktop.png" width="440" /> | <img src="docs/screenshots/data-controls-desktop.png" width="440" /> |

| <img src="docs/screenshots/live-report-mobile.png" width="130" /> | <img src="docs/screenshots/live-review-mobile.png" width="130" /> | <img src="docs/screenshots/live-import-mobile.png" width="130" /> | <img src="docs/screenshots/data-controls-mobile.png" width="130" /> |
|---|---|---|---|

Charts and sample reports are labelled as sample data.

## Getting started

```bash
cp .env.example .env.local      # API URL + public Supabase URL / anon key
npm install
npm run dev                     # http://localhost:3000
npm run build && npm run lint
npm test                        # unit tests for the analysis logic (vitest)
```

End-to-end checks (Playwright, with Supabase/API responses mocked): build with `NEXT_PUBLIC_SUPABASE_URL=https://mock.supabase.test NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-test-key`, run `npm start`, then `node e2e/auth-upload.js` and `node e2e/phase4.js` (needs `npm i --no-save playwright @axe-core/playwright`). For the real-backend checks, start a **fresh** dev API (`python backend/scripts/dev_server.py --port 8010 --seed-user 11111111-1111-4111-8111-111111111111 --seed-user 22222222-2222-4222-8222-222222222222`; see docs/setup-guide.md), build the web app with `NEXT_PUBLIC_API_BASE_URL=http://localhost:8010`, run `backend/.venv/Scripts/python e2e/make_fixtures.py`, then `node e2e/phase5.js` (and, each against another **fresh** API, `node e2e/phase6.js`, `node e2e/phase8.js` and `node e2e/screenshots.js`).

Backend setup is in [`../../docs/setup-guide.md`](../../docs/setup-guide.md).

## Project structure

```
src/
├─ app/
│  ├─ (app)/            shell layout, dashboard, section pages
│  ├─ globals.css       design tokens
│  ├─ layout.tsx        font, metadata, providers
│  └─ icon.svg · apple-icon.png
└─ components/          app-shell, system-status
```
