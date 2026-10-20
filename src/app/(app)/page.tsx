import {
  BadgeCheck,
  FileLock2,
  FileSearch,
  FileUp,
  GitCompareArrows,
  Layers,
  LineChart,
  ScanText,
  ShieldCheck,
  Sparkles,
  Tags,
  Unlock,
  Upload,
  Wand2,
} from "lucide-react";
import { Reveal } from "@/components/reveal";
import { DashboardReports } from "@/components/dashboard-reports";
import { SampleReport } from "@/components/sample-report";
import { SystemStatus } from "@/components/system-status";

const FEATURES = [
  { icon: FileLock2, title: "Protected PDFs", text: "Unlock password-protected statements. Passwords are never stored or logged.", tone: "grad-ember", glow: "rgb(232 56 79 / .5)" },
  { icon: LineChart, title: "Clear insights", text: "Cash flow, categories, merchants and recurring payments at a glance.", tone: "grad-sky", glow: "rgb(99 102 241 / .5)" },
  { icon: Sparkles, title: "Savings ideas", text: "Evidence-based suggestions to trim unnecessary spending.", tone: "grad-gold", glow: "rgb(255 138 31 / .5)" },
  { icon: ShieldCheck, title: "Private by design", text: "Statements live in private, user-scoped storage — never public.", tone: "grad-income", glow: "rgb(5 150 105 / .5)" },
];

const STEPS = [
  { icon: Upload, title: "Upload", text: "Drop a PDF, CSV or Excel statement." },
  { icon: Unlock, title: "Unlock", text: "Enter the password if the file is protected." },
  { icon: FileSearch, title: "Review", text: "Check and correct extracted transactions." },
  { icon: BadgeCheck, title: "Save", text: "Keep a report and track savings over time." },
];

const PIPELINE = [
  { icon: FileUp, title: "Validate the file", text: "Check type, size, page count and real file contents." },
  { icon: Unlock, title: "Detect and decrypt", text: "Ask for a password only when the document is encrypted." },
  { icon: ScanText, title: "Extract text or run OCR", text: "Use selectable text first; OCR for scanned pages, flagged as lower confidence." },
  { icon: Layers, title: "Normalize transactions", text: "Dates, debit/credit, amounts and descriptions in one clean shape (Decimal-safe)." },
  { icon: Tags, title: "Categorize and detect duplicates", text: "Explainable suggestions you can edit before anything is final." },
  { icon: GitCompareArrows, title: "Reconcile balances", text: "Opening + credits − debits vs closing, with discrepancies explained, not hidden." },
];

export default function Home() {
  return (
    <div className="space-y-12">
      <Reveal>
        <section className="grad-brand relative overflow-hidden rounded-[2rem] p-6 text-white shadow-[0_30px_60px_-30px_rgb(225_29_72/0.7)] sm:p-10">
          <div aria-hidden className="absolute -right-20 -top-24 size-72 rounded-full bg-white/15 blur-2xl" />
          <div aria-hidden className="absolute -bottom-28 right-24 size-64 rounded-full bg-[#ffb703]/30 blur-3xl" />
          <div className="relative grid items-center gap-8 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
                <Wand2 size={14} aria-hidden /> Lensly · Bank Statement Analyzer
              </span>
              <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
                Know where your <span className="text-[#ffd166]">money</span> goes.
              </h1>
              <p className="mt-4 max-w-lg text-base text-white/85 sm:text-lg">
                Upload a statement and get a clear, honest picture of your spending — real numbers, never guesses.
              </p>
            </div>

            {/* Illustrative preview — decorative only, not real data */}
            <div aria-hidden className="relative mx-auto hidden w-full max-w-xs lg:block">
              <div className="rounded-3xl bg-white/95 p-5 text-[#1c0f13] shadow-2xl">
                <div className="flex items-center gap-3">
                  <span className="grad-gold grid size-10 place-items-center rounded-xl text-white"><LineChart size={20} /></span>
                  <div className="space-y-1.5">
                    <div className="h-2.5 w-24 rounded-full bg-[#ffd9df]" />
                    <div className="h-2 w-16 rounded-full bg-[#f3e6e9]" />
                  </div>
                </div>
                <div className="mt-5 flex h-24 items-end gap-2">
                  {[40, 62, 48, 80, 58, 92].map((h, i) => (
                    <div key={i} className="grad-ember flex-1 rounded-t-lg" style={{ height: `${h}%`, opacity: 0.55 + i * 0.09 }} />
                  ))}
                </div>
                <div className="mt-4 h-2 w-3/4 rounded-full bg-[#f3e6e9]" />
              </div>
              <span className="grad-income absolute -left-6 top-10 grid size-12 -rotate-12 place-items-center rounded-2xl text-white shadow-xl"><BadgeCheck size={22} /></span>
              <span className="grad-sky absolute -right-5 bottom-6 grid size-12 rotate-12 place-items-center rounded-2xl text-white shadow-xl"><ShieldCheck size={22} /></span>
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <DashboardReports />
      </Reveal>

      <Reveal>
        <SystemStatus />
      </Reveal>

      <SampleReport />

      <section aria-labelledby="steps-h">
        <Reveal>
          <h2 id="steps-h" className="mb-4 text-base font-bold">How it works</h2>
        </Reveal>
        <ol className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <Reveal as="li" key={title} delay={i * 0.07} className="card card-lift relative h-full list-none p-5">
                <span className="absolute right-4 top-3 text-5xl font-extrabold text-brand/10" aria-hidden>{i + 1}</span>
                <span className="grad-brand tile-shadow grid size-11 place-items-center rounded-2xl text-white"><Icon size={20} aria-hidden /></span>
                <h3 className="mt-4 font-bold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{text}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      <section aria-labelledby="feat-h">
        <Reveal>
          <h2 id="feat-h" className="mb-4 text-base font-bold">What you&apos;ll be able to do</h2>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text, tone, glow }, i) => (
            <Reveal key={title} delay={i * 0.07}>
              <div className="card card-lift h-full p-5">
                <span className={`${tone} tile-shadow grid size-11 place-items-center rounded-2xl text-white`} style={{ ["--tile" as string]: glow }}>
                  <Icon size={20} aria-hidden />
                </span>
                <h3 className="mt-4 font-bold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section aria-labelledby="pipe-h">
        <Reveal>
          <h2 id="pipe-h" className="text-base font-bold">The analysis pipeline</h2>
          <p className="mb-5 mt-1 text-sm text-muted">Every statement moves through the same transparent stages. Nothing is imported until you review it.</p>
        </Reveal>
        <ol className="relative ml-4 border-l-2 border-border">
          {PIPELINE.map(({ icon: Icon, title, text }, i) => (
            <Reveal as="li" key={title} delay={i * 0.05} className="relative mb-5 list-none pl-8 last:mb-0">
              <>
                <span className="grad-brand absolute -left-[19px] top-1 grid size-9 place-items-center rounded-xl text-white ring-4 ring-background">
                  <Icon size={16} aria-hidden />
                </span>
                <div className="card p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-brand">Step {i + 1}</p>
                  <h3 className="font-bold">{title}</h3>
                  <p className="mt-0.5 text-sm text-muted">{text}</p>
                </div>
              </>
            </Reveal>
          ))}
        </ol>
      </section>
    </div>
  );
}
