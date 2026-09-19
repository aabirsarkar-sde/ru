"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CrestWatermark } from "@/components/brand";
import { TopBar } from "@/components/TopBar";
import { Button, Spinner } from "@/components/ui";
import type { Program } from "@/content/schema";
import { buildPaper } from "@/engine/paper";
import { isAnswered } from "@/engine/responses";
import { formatClock } from "@/engine/timer";
import { useAttempt } from "@/lib/attempt";
import { t } from "@/lib/i18n";

export function Done({ program }: { program: Program }) {
  const { attempt, loaded, update } = useAttempt(program.id);
  const paper = useMemo(() => (attempt ? buildPaper(program, attempt.seed) : null), [program, attempt]);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");

  if (!loaded)
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner />
      </div>
    );
  if (!attempt || !paper || !attempt.submittedAt)
    return (
      <div className="grid min-h-dvh place-items-center p-8 text-center">
        <div>
          <p className="font-serif text-3xl">Nothing submitted yet.</p>
          <Link href={`/${program.id}`} className="mt-3 inline-block font-semibold text-red underline">
            Go to the {program.name} start page
          </Link>
        </div>
      </div>
    );

  return (
    <div data-accent={program.accent} className="flex min-h-dvh flex-col">
      <TopBar>
        <p className="text-sm font-semibold text-ink-soft">{program.name} · Submitted</p>
      </TopBar>
      <main id="main" className="flex-1">
        <section className="pattern-lattice relative overflow-hidden bg-[var(--accent-fill)] text-white">
          <CrestWatermark className="absolute -right-16 -top-10 w-96" />
          <div className="relative mx-auto max-w-6xl px-5 py-16 sm:px-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/75">Submitted · {new Date(attempt.submittedAt).toLocaleString("en-IN")}</p>
            <h1 className="mt-3 font-serif text-5xl leading-tight sm:text-6xl">{t("done.title", { name: attempt.candidateName.split(" ")[0] })}</h1>
            <p className="mt-3 max-w-2xl text-lg text-white/85">{t("done.body", { program: program.name })} Take a breath — the hard part is done.</p>
          </div>
        </section>

        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1.2fr_1fr]">
          <section>
            <h2 className="font-serif text-3xl">What you completed</h2>
            <ul className="mt-5 grid gap-2">
              {program.sections.map((s, i) => {
                const st = attempt.sections[s.id];
                const items = paper.sections[i].items;
                const answered = items.filter(({ item }) => isAnswered(attempt.responses[item.id])).length;
                const used = st.startedAt && st.closedAt ? st.closedAt - st.startedAt : null;
                return (
                  <li key={s.id} className="flex items-center gap-4 bg-white p-4 ring-1 ring-line curve-br-sm">
                    <span className="w-8 font-serif text-2xl text-[var(--accent)]">{s.code}</span>
                    <span className="flex-1">
                      <span className="block font-semibold">{s.title}</span>
                      <span className="block text-sm text-ink-soft">
                        {st.skipped ? "Skipped (optional)" : `${answered} of ${items.length} answered`}
                        {used != null && !st.skipped ? ` · ${formatClock(used)} used` : ""}
                        {st.closedBy === "timer" ? " · closed when time ran out" : ""}
                      </span>
                    </span>
                    <span aria-hidden className="text-ok">✓</span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="grid content-start gap-6">
            <div className="bg-white p-6 ring-1 ring-line curve-br">
              <h2 className="font-serif text-3xl">What happens next</h2>
              <ol className="mt-4 grid gap-4">
                {[
                  ["Blind marking", "Two faculty members score each drawn or written answer without seeing your name, school or city."],
                  ["Shortlist", "Section scores are combined, weighted by programme. You'll hear from us by email."],
                  ["Stage 3 conversation", "If shortlisted, you'll talk faculty through your work — how you made it, and why you decided what you did."],
                ].map(([title, body], i) => (
                  <li key={title} className="flex gap-4">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] font-serif text-lg">{i + 1}</span>
                    <span>
                      <span className="block font-semibold">{title}</span>
                      <span className="block text-sm text-ink-soft">{body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="bg-cream p-6 curve-br">
              <h2 className="font-serif text-2xl">How was this test for you?</h2>
              {attempt.survey ? (
                <p className="mt-2 text-ink-soft">Thanks — your feedback helps us make the test fairer. ({attempt.survey.rating}/5)</p>
              ) : (
                <>
                  <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Rate the test from 1 to 5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        role="radio"
                        aria-checked={rating === n}
                        onClick={() => setRating(n)}
                        className={`size-11 rounded-xl font-serif text-xl ${rating === n ? "bg-[var(--accent)] text-white" : "bg-white ring-1 ring-line hover:ring-line-strong"}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                    placeholder="Anything we should know? (optional)"
                    className="mt-3 w-full rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-line outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                  <Button className="mt-3" size="sm" disabled={!rating} onClick={() => update((a) => ({ ...a, survey: { rating: rating!, comment, at: Date.now() } }))}>
                    Send feedback
                  </Button>
                </>
              )}
            </div>

            <div className="rounded-xl border border-dashed border-line-strong p-5 text-sm">
              <p className="font-semibold">For reviewers of this prototype</p>
              <p className="mt-1 text-ink-soft">See this submission the way a faculty evaluator would — blinded, with rubrics and auto-scores.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={`/${program.id}/review`} className="inline-flex h-10 items-center rounded-lg bg-ink px-4 font-semibold text-white hover:bg-black">
                  Open evaluator preview →
                </Link>
                <Link href="/" className="inline-flex h-10 items-center rounded-lg px-4 font-semibold text-ink-soft hover:bg-black/5">
                  All programmes
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
