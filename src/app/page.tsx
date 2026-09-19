import Link from "next/link";
import { CrestFrame, CrestWatermark, Eyebrow, Logo } from "@/components/brand";
import { loadPrograms } from "@/content/load";
import type { Program } from "@/content/schema";
import { t } from "@/lib/i18n";

export default function Home() {
  const programs = loadPrograms();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-5 py-4 sm:px-8">
          <Logo />
          <p className="hidden text-sm font-semibold uppercase tracking-[0.18em] text-ink-soft sm:block">{t("brand.stage")}</p>
        </div>
      </header>

      <main id="main" className="flex-1">
        {/* hero */}
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-12 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:pt-20">
          <div className="animate-rise">
            <Eyebrow className="!text-red">Admissions 2026 · Stage 2</Eyebrow>
            <h1 className="mt-4 font-serif text-5xl leading-[1.02] text-ink sm:text-7xl">Show us how you think.</h1>
            <p className="mt-3 font-serif text-2xl italic text-narangi sm:text-3xl">Not what you&apos;ve memorised.</p>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
              The Rishihood University aptitude test is a set of real tasks: see an app through someone else&apos;s eyes,
              read a study sceptically, run a stall at a city mela. There are no trick questions, and no marks for neatness.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a href="#programmes" className="inline-flex h-12 items-center rounded-xl bg-red px-6 font-semibold text-white shadow-sm hover:bg-red-deep">
                Choose your programme ↓
              </a>
              <span className="text-sm text-ink-mute">90–120 minutes · on a laptop · saves as you go</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md animate-rise [animation-delay:120ms] lg:max-w-none">
            <div className="pattern-lattice relative aspect-[5/4] overflow-hidden bg-red curve-br">
              <CrestWatermark className="absolute -right-10 -top-8 w-72 rotate-6" />
              <CrestFrame className="absolute bottom-0 left-[8%] h-[92%] w-[58%]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/media/bdes/ux/persona-kamla-art.svg" alt="" className="h-full w-full object-cover object-[80%_50%]" />
              </CrestFrame>
            </div>
            <HeroTag className="-left-3 top-8 sm:-left-8" accent="bg-narangi" label="Empathise" sub="with a real person" />
            <HeroTag className="-right-2 top-[42%] sm:-right-6" accent="bg-wine" label="Explain" sub="your own mind" />
            <HeroTag className="bottom-6 left-[40%]" accent="bg-navy" label="Decide" sub="at a four-day mela" />
          </div>
        </section>

        {/* programmes */}
        <section id="programmes" className="scroll-mt-8 border-y border-line bg-cream/50">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
            <Eyebrow className="!text-red">Pick your programme</Eyebrow>
            <h2 className="mt-2 font-serif text-4xl sm:text-5xl">Three tests, each built around the work itself.</h2>
            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              {programs.map((p, i) => (
                <ProgramCard key={p.id} program={p} delay={i * 90} />
              ))}
            </div>
          </div>
        </section>

        {/* how it works */}
        <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
          <h2 className="font-serif text-4xl">How it works</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Check your laptop", "A 30-second system check: browser, connection and storage. Camera is optional."],
              ["Practise every tool", "Try the drawing canvas, uploads and games untimed, so the interface is never what's being tested."],
              ["Take the test", "Each section has its own timer, with warnings at 5 and 1 minute. Everything saves automatically, even if your internet drops."],
              ["Talk to us at Stage 3", "Shortlisted candidates discuss their work and decisions with faculty in a live conversation."],
            ].map(([title, body], i) => (
              <li key={title} className="relative bg-white p-6 ring-1 ring-line curve-br">
                <span className="font-serif text-5xl text-red/85">{i + 1}</span>
                <h3 className="mt-2 text-lg font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* fairness */}
        <section className="bg-ink text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <Eyebrow className="!text-sand">Fair by design</Eyebrow>
              <h2 className="mt-2 font-serif text-4xl leading-tight">Built so the only thing that counts is how you think.</h2>
            </div>
            <ul className="grid gap-5 sm:grid-cols-2">
              {[
                ["Paper is welcome", "Prefer pencil? Draw on paper and upload a photo from your phone. It's scored exactly the same way."],
                ["Same mela for everyone", "Every candidate in a test window faces identical events, prices and rivals. No reflexes, no luck."],
                ["Marked blind, twice", "Faculty never see your name, school, city or photo. Two people score every written or drawn answer."],
                ["Extra time, built in", "Accommodations, larger text and full keyboard access are part of the test, not an afterthought."],
              ].map(([title, body]) => (
                <li key={title} className="border-l-2 border-narangi pl-4">
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-white/75">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="pattern-lattice relative overflow-hidden bg-red text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-6 px-5 py-10 sm:px-8">
          <div>
            <p className="font-serif text-3xl italic leading-tight">
              The desire to know, the will to act,
              <br />
              and the joy in being.
            </p>
            <p className="mt-3 text-sm tracking-wide text-white/75">Jigyasa · Chikirsha · Ananda — #ApproachingRishihood</p>
          </div>
          <div className="text-right text-sm text-white/80">
            <p>Rishihood University · Sonipat</p>
            <p className="mt-1 text-xs text-white/60">v1 prototype — content is placeholder pending faculty review.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function HeroTag({ className, accent, label, sub }: { className: string; accent: string; label: string; sub: string }) {
  return (
    <div className={`absolute flex items-center gap-3 bg-paper py-2.5 pl-2.5 pr-5 shadow-xl ring-1 ring-line curve-br-sm ${className}`}>
      <span className={`h-9 w-1.5 rounded-full ${accent}`} />
      <span>
        <span className="block font-serif text-2xl leading-none">{label}</span>
        <span className="block text-xs text-ink-soft">{sub}</span>
      </span>
    </div>
  );
}

function ProgramCard({ program: p, delay }: { program: Program; delay: number }) {
  const timed = p.sections.filter((s) => s.duration_min);
  return (
    <article data-accent={p.accent} className="flex animate-rise flex-col overflow-hidden bg-white shadow-sm ring-1 ring-line curve-br" style={{ animationDelay: `${delay}ms` }}>
      <div className="pattern-lattice relative bg-[var(--accent-fill)] px-7 pb-7 pt-6 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">{p.school ?? p.full_name}</p>
        <h3 className="mt-2 font-serif text-4xl">{p.name}</h3>
        <p className="mt-1 text-sm text-white/85">
          ≈ {p.duration_min} min · {timed.length} timed sections
        </p>
      </div>
      <div className="flex flex-1 flex-col px-7 py-6">
        <p className="leading-relaxed text-ink-soft">{p.pitch}</p>
        <ol className="mt-5 grid gap-2">
          {p.sections.map((s) => (
            <li key={s.id} className="flex items-baseline gap-3 text-sm">
              <span className="w-7 shrink-0 font-semibold text-[var(--accent)]">{s.code}</span>
              <span className="flex-1 font-medium">{s.title}</span>
              <span className="text-xs text-ink-mute">
                {s.duration_min ? `${s.duration_min} min` : s.kind === "pretest" ? "before test day" : "untimed"}
                {s.kind === "optional" ? " · optional" : ""}
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap gap-1.5">
          {p.traits.map((tr) => (
            <span key={tr} className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-medium text-ink">
              {tr}
            </span>
          ))}
        </div>
        <Link
          href={`/${p.id}`}
          className="mt-7 inline-flex h-12 items-center justify-between rounded-xl bg-[var(--accent)] px-5 font-semibold text-white transition hover:brightness-110"
        >
          {p.id === "bbae" ? "Start the BBA-E test" : `Start the ${p.name} test`} <span aria-hidden>→</span>
        </Link>
      </div>
    </article>
  );
}
