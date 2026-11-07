<div align="center">

<img src="docs/branding/logo.png" width="140" alt="Lensly logo" />

# Lensly

**Know where your money goes.**

Lensly turns bank statements into clear spending insights and evidence-based savings ideas. Upload a statement, see exactly where the money went, and import the reviewed rows into a CashBook in Ledgerly.

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs)
![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Installable](https://img.shields.io/badge/Installable-PWA-E11D48)

</div>

---

Part of the **Finance Platform**, alongside **Ledgerly** (multi-ledger CashBook) and **Ledgerline** (double-entry accounting). One account signs in to all three.

## Screenshots

**Sign in & register**

| Sign in | Register (with password strength) | Mobile |
|:--:|:--:|:--:|
| <img src="docs/screenshots/login-desktop.png" width="300" /> | <img src="docs/screenshots/register-desktop.png" width="300" /> | <img src="docs/screenshots/login-mobile.png" width="130" /> |

**Dashboard, reports and settings**

| Dashboard | Report Books (grouped reports) |
|:--:|:--:|
| <img src="docs/screenshots/dashboard-desktop.png" width="440" /> | <img src="docs/screenshots/report-books-desktop.png" width="440" /> |
| **Report overview** | **Analysis pipeline** |
| <img src="docs/screenshots/report-overview-desktop.png" width="440" /> | <img src="docs/screenshots/pipeline-desktop.png" width="440" /> |
| **Full report** | **Account & settings** |
| <img src="docs/screenshots/live-report-desktop.png" width="440" /> | <img src="docs/screenshots/settings-desktop.png" width="440" /> |

**Upload and processing**

| Upload queue: CSV, encrypted PDF and a scan | Wrong password, try again |
|:--:|:--:|
| <img src="docs/screenshots/live-upload-queue-desktop.png" width="440" /> | <img src="docs/screenshots/live-password-retry-desktop.png" width="440" /> |
| **Results: parsed and reconciled** | **Parsed transactions in the review workspace** |
| <img src="docs/screenshots/live-upload-results-desktop.png" width="440" /> | <img src="docs/screenshots/live-parsed-review-desktop.png" width="440" /> |

**Review and reconcile**

| Review workspace | Reconciliation: not reconciled |
|:--:|:--:|
| <img src="docs/screenshots/review-desktop.png" width="440" /> | <img src="docs/screenshots/reconciliation-failed-desktop.png" width="440" /> |
| **Reconciled with warnings** | **Savings ideas, with evidence and assumptions** |
| <img src="docs/screenshots/reconciliation-warnings-desktop.png" width="440" /> | <img src="docs/screenshots/recommendations-desktop.png" width="440" /> |

**Compare, budget and import**

| Compare reports | Budgets & savings |
|:--:|:--:|
| <img src="docs/screenshots/compare-desktop.png" width="440" /> | <img src="docs/screenshots/budgets-desktop.png" width="440" /> |
| **Import into Ledgerly (preview)** | **Import confirmed** |
| <img src="docs/screenshots/import-preview-desktop.png" width="440" /> | <img src="docs/screenshots/live-import-desktop.png" width="440" /> |

**Quick actions and your data**

| Command palette (`Ctrl/⌘ K`) | Your data |
|:--:|:--:|
| <img src="docs/screenshots/command-palette-desktop.png" width="440" /> | <img src="docs/screenshots/data-controls-desktop.png" width="440" /> |

**Mobile**

| Dashboard | Report Books | Password | Settings | Register |
|:--:|:--:|:--:|:--:|:--:|
| <img src="docs/screenshots/dashboard-mobile.png" width="130" /> | <img src="docs/screenshots/report-books-mobile.png" width="130" /> | <img src="docs/screenshots/password-mobile.png" width="130" /> | <img src="docs/screenshots/settings-mobile.png" width="130" /> | <img src="docs/screenshots/register-mobile.png" width="130" /> |

| Report overview | Review | Reconciliation | Savings ideas | Compare | Import | Budgets |
|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| <img src="docs/screenshots/report-overview-mobile.png" width="110" /> | <img src="docs/screenshots/review-mobile.png" width="110" /> | <img src="docs/screenshots/reconciliation-failed-mobile.png" width="110" /> | <img src="docs/screenshots/recommendations-mobile.png" width="110" /> | <img src="docs/screenshots/compare-mobile.png" width="110" /> | <img src="docs/screenshots/import-preview-mobile.png" width="110" /> | <img src="docs/screenshots/budgets-mobile.png" width="110" /> |

| Full report | Review | Import | Your data |
|:--:|:--:|:--:|:--:|
| <img src="docs/screenshots/live-report-mobile.png" width="130" /> | <img src="docs/screenshots/live-review-mobile.png" width="130" /> | <img src="docs/screenshots/live-import-mobile.png" width="130" /> | <img src="docs/screenshots/data-controls-mobile.png" width="130" /> |

Responsive by design: a **fixed sidebar** on desktop, a **top bar and bottom tab bar** on tablets and phones. Example reports are clearly labelled *Sample data, illustrative only* (₹ INR).

## Logo & icons

The mark is a tilted statement sheet with a trend line, gold-tipped bars and a magnifier, on a *Ruby & Gold* gradient.

| Logo | PWA 512 | PWA 192 | Apple touch icon |
|:--:|:--:|:--:|:--:|
| <img src="docs/branding/logo.png" width="96" /> | <img src="docs/branding/pwa-icon-512.png" width="96" /> | <img src="docs/branding/pwa-icon-192.png" width="96" /> | <img src="docs/branding/apple-touch-icon.png" width="96" /> |

Vector original: [`logo.svg`](docs/branding/logo.svg).

## Design

- **Palette, Ruby & Gold:** ruby `#E11D48`, gold `#FFB703`, income green `#12B76A`, expense red `#F04438`, on warm neutral surfaces
- **Font:** Plus Jakarta Sans
- **Light and dark** themes that follow your device setting
- **Accessible:** landmarks and labels for screen readers, a skip link, visible keyboard focus, reduced-motion support, and an automated accessibility scan that passes on every page

## Features

### Your account
- Sign in, register (with a password-strength meter), reset a forgotten password and sign out; your session is restored and refreshed automatically
- The **same account as Ledgerly and Ledgerline**, with a shared profile: change your name once and it updates everywhere
- Only a sign-in token is kept in your browser; your password never is

### Upload center
- Upload **PDF, CSV, XLSX and XLS** statements, including **password-protected PDFs**: Lensly asks for the password and lets you retry without creating duplicate reports
- Scanned statements can be read with **OCR** (offered when you upload one)
- Files are checked by their content, and uploading the same statement twice is detected
- Results show the transactions found, the reconciliation status and any warnings, then flow straight into review and analysis

### Transaction review
- A table on desktop and cards on mobile, with search and filters for debit / credit, category, date and status
- Fix categories and merchants in place, or categorise and mark many rows at once
- Your original extracted text is kept beside your corrections; duplicates and low-confidence rows are flagged
- Export the selection or the filtered rows as CSV

### Reconciliation
- Checks the statement's opening balance, credits, debits and closing balance, and every running balance along the way
- Result is *Reconciled*, *Reconciled with warnings*, *Not reconciled* (with the exact difference) or *Unable to reconcile*; a difference is shown, never hidden

### Reports and insights
- **Report overview:** key figures, a spending-by-category donut with progress bars, top merchants, probable recurring payments and a "worth a look" list (duplicates, fees, low-confidence rows)
- **Savings ideas:** evidence-backed suggestions with the observed spend, a proposed action and an **estimated saving with its stated assumption**, plus confidence and priority; mark ideas new, reviewed, completed or dismissed. When there isn't enough data it says so instead of guessing
- **Compare reports** side by side, with a warning when the periods differ in length
- **Report Books** to group statements and reports
- Download reports as **CSV, Excel or PDF**

### Budgets & savings
- Set your own monthly budget per category and see it against what you actually spent, with alerts as you near or pass a limit
- Track savings goals and potential vs realized savings
- Starts empty: nothing is invented for you

### Import into Ledgerly
- Import only reviewed, non-duplicate rows into a CashBook, with a preview of the result
- Map the destination, categories and payment methods, then confirm
- Safe to retry: rows that were already imported are skipped, and every import is kept in an audit history

### Quick to use
- `Ctrl/⌘ K` quick actions, `G` then a letter to jump between pages, and `?` for the shortcut list

### Your data
- Download everything as JSON
- Delete your Lensly data, your CashBook data, everything, or your account, each behind a typed `DELETE` confirmation

## Good to know

- In sample mode, statements are generated and labelled as such. Signed in, everything you do is saved to your account and private to you.
- Savings estimates always show the assumption behind them.
- Imports into Ledgerly only add rows; they never change or delete what is already there.
