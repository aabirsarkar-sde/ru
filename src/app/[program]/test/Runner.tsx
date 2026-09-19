"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CrestWatermark } from "@/components/brand";
import { MediaView, RichText } from "@/components/media";
import { TopBar } from "@/components/TopBar";
import { Button, Modal, Spinner, ToastProvider, useToast } from "@/components/ui";
import type { Program, Section } from "@/content/schema";
import { buildPaper, type Stimulus } from "@/engine/paper";
import { isAnswered, type Response } from "@/engine/responses";
import { crossedWarnings, durationMs, formatClock, remainingMs } from "@/engine/timer";
import { ItemView } from "@/items/ItemRenderer";
import { logEvent, useAttempt, useNow, useOnline, type Attempt, type SaveStatus } from "@/lib/attempt";
import { t } from "@/lib/i18n";

export function Runner(props: { program: Program; games: Record<string, unknown> }) {
  return (
    <ToastProvider>
      <RunnerInner {...props} />
    </ToastProvider>
  );
}

function RunnerInner({ program, games }: { program: Program; games: Record<string, unknown> }) {
  const router = useRouter();
  const toast = useToast();
  const { attempt, loaded, update, save, flush } = useAttempt(program.id);
  const now = useNow(500);
  const online = useOnline();
  const paper = useMemo(() => (attempt ? buildPaper(program, attempt.seed) : null), [program, attempt?.seed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resume bookkeeping + light activity logging (tab switches, connectivity).
  const resumed = useRef(false);
  useEffect(() => {
    if (!attempt || resumed.current) return;
    resumed.current = true;
    const active = Object.values(attempt.sections).some((s) => s.status === "active");
    if (active) {
      update((a) => logEvent({ ...a, resumes: a.resumes + 1 }, { type: "resume" }));
      toast("Welcome back — your answers and remaining time were restored.");
    }
  }, [attempt, update, toast]);

  useEffect(() => {
    const vis = () => update((a) => logEvent(a, { type: document.visibilityState === "hidden" ? "tab_hidden" : "tab_visible" }));
    const on = () => update((a) => logEvent(a, { type: "online" }));
    const off = () => {
      update((a) => logEvent(a, { type: "offline" }));
      toast("You're offline. Keep going — everything is saved on this device.", "warn");
    };
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [update, toast]);

  const def: Section | undefined = attempt ? program.sections[attempt.sectionIndex] : undefined;
  const clock = attempt && def ? attempt.sections[def.id] : undefined;
  const remaining = clock && def ? remainingMs(clock, def.duration_min, now) : null;

  const closeSection = useCallback(
    (sectionId: string, by: "candidate" | "timer", skipped = false) => {
      update((a) => {
        const d = program.sections[a.sectionIndex];
        // Idempotent: a repeated call (e.g. the expiry effect firing twice)
        // must never close the *next* section.
        if (!d || d.id !== sectionId || a.sections[d.id].status === "closed") return a;
        const c = a.sections[d.id];
        const total = durationMs(d.duration_min, c.extraMs);
        const closedAt = by === "timer" && c.startedAt && total ? c.startedAt + total : Date.now();
        const nextIndex = a.sectionIndex + 1;
        const done = nextIndex >= program.sections.length;
        return {
          ...a,
          sections: { ...a.sections, [d.id]: { ...c, status: "closed", closedAt, closedBy: by, skipped, startedAt: c.startedAt ?? Date.now() } },
          sectionIndex: nextIndex,
          submittedAt: done ? Date.now() : a.submittedAt,
        };
      });
    },
    [program.sections, update],
  );

  // Timer warnings and expiry.
  const prevRemaining = useRef<number | null>(null);
  const warnedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!def || !clock || clock.status !== "active" || remaining == null) {
      prevRemaining.current = null;
      return;
    }
    if (warnedFor.current !== def.id) {
      warnedFor.current = def.id;
      prevRemaining.current = remaining;
    }
    for (const th of crossedWarnings(prevRemaining.current, remaining)) {
      toast(th >= 300_000 ? t("timer.warn5") : t("timer.warn1"), th >= 300_000 ? "warn" : "alert");
    }
    prevRemaining.current = remaining;
    if (remaining <= 0) {
      toast(t("timer.expired", { section: `${def.code} ${def.title}` }), "alert");
      closeSection(def.id, "timer");
    }
  }, [remaining, def, clock, toast, closeSection]);

  // Persist the submission before leaving, so the confirmation page never
  // reads a stale attempt from storage.
  useEffect(() => {
    if (!attempt?.submittedAt) return;
    flush().then(() => router.replace(`/${program.id}/done`));
  }, [attempt?.submittedAt, program.id, router, flush]);

  if (!loaded) return <Loading />;
  if (!attempt)
    return (
      <div className="grid min-h-dvh place-items-center p-8 text-center">
        <div>
          <p className="font-serif text-3xl">No test in progress.</p>
          <Link className="mt-4 inline-block font-semibold text-red underline" href={`/${program.id}`}>
            Go to the {program.name} start page
          </Link>
        </div>
      </div>
    );
  if (attempt.submittedAt || !def || !clock || !paper) return <Loading />;

  const ps = paper.sections[attempt.sectionIndex];
  const setResponse = (id: string, r: Response) => update((a) => ({ ...a, responses: { ...a.responses, [id]: r } }));

  return (
    <div data-accent={program.accent} className="flex min-h-dvh flex-col">
      <TopBar right={<><SaveIndicator save={save} online={online} /><TimerPill remaining={remaining} active={clock.status === "active"} /></>}>
        <div className="flex items-center gap-4">
          <p className="truncate text-sm">
            <span className="font-semibold text-[var(--accent)]">{program.name}</span>
            <span className="text-ink-mute"> · </span>
            <span className="font-semibold">
              {def.code} {def.title}
            </span>
          </p>
          <SectionRail program={program} attempt={attempt} />
        </div>
      </TopBar>

      {clock.status === "pending" ? (
        <SectionIntro
          program={program}
          section={def}
          index={attempt.sectionIndex}
          count={ps.items.length}
          extraMs={clock.extraMs}
          onBegin={() =>
            update((a) => ({ ...a, sections: { ...a.sections, [def.id]: { ...a.sections[def.id], status: "active", startedAt: Date.now() } } }))
          }
          onSkip={() => closeSection(def.id, "candidate", true)}
        />
      ) : (
        <SectionBody
          key={def.id}
          program={program}
          section={def}
          items={ps.items}
          stimuli={paper.stimuli}
          attempt={attempt}
          games={games}
          onIndex={(i) => update((a) => ({ ...a, itemIndex: { ...a.itemIndex, [def.id]: i } }))}
          onResponse={setResponse}
          onPasteBlocked={(itemId) => update((a) => logEvent(a, { type: "paste_blocked", itemId }))}
          onFinish={() => closeSection(def.id, "candidate")}
          onScratch={(text) => update((a) => ({ ...a, scratch: { ...a.scratch, [def.id]: text } }))}
        />
      )}
      <DemoTools
        active={clock.status === "active" && def.duration_min != null}
        onAdvance={(ms) =>
          update((a) => {
            const c = a.sections[def.id];
            return { ...a, sections: { ...a.sections, [def.id]: { ...c, startedAt: (c.startedAt ?? Date.now()) - ms } } };
          })
        }
        onJumpTo={(leftMs) =>
          update((a) => {
            const c = a.sections[def.id];
            const total = durationMs(def.duration_min, c.extraMs) ?? 0;
            return { ...a, sections: { ...a.sections, [def.id]: { ...c, startedAt: Date.now() - (total - leftMs) } } };
          })
        }
      />
    </div>
  );
}

function Loading() {
  return (
    <div className="grid min-h-dvh place-items-center text-ink-mute">
      <Spinner className="size-6" />
    </div>
  );
}

/* ------------------------------------------------------------- top chrome -- */

function TimerPill({ remaining, active }: { remaining: number | null; active: boolean }) {
  if (remaining == null)
    return <span className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-ink-soft ring-1 ring-line">{t("common.untimed")}</span>;
  const low = remaining <= 60_000;
  const warn = remaining <= 300_000;
  return (
    <div
      role="timer"
      aria-label={`${t("timer.remaining")}: ${formatClock(remaining)}`}
      className={`flex h-10 min-w-[6.5rem] items-center justify-center gap-2 rounded-lg px-3 font-semibold tabular-nums transition-colors ${
        !active ? "bg-white text-ink-soft ring-1 ring-line" : low ? "animate-pulse-soft bg-red text-white" : warn ? "bg-narangi-ink text-white" : "bg-ink text-white"
      }`}
    >
      <span aria-hidden>⏱</span>
      <span className="text-lg">{formatClock(remaining)}</span>
    </div>
  );
}

function SaveIndicator({ save, online }: { save: SaveStatus; online: boolean }) {
  const now = useNow(5000);
  let text = t("save.saved");
  if (!online) text = t("save.offline");
  else if (save.state === "saving") text = t("save.saving");
  else if (save.at) {
    const s = Math.round((now - save.at) / 1000);
    text = t("save.savedAgo", { ago: s < 10 ? t("save.justNow") : `${s}s ago` });
  }
  return (
    <span className="hidden items-center gap-1.5 text-xs font-medium text-ink-soft lg:flex" aria-live="polite">
      <span className={`size-2 rounded-full ${!online ? "bg-narangi" : save.state === "saving" ? "animate-pulse-soft bg-ink-mute" : "bg-ok"}`} />
      {text}
    </span>
  );
}

function SectionRail({ program, attempt }: { program: Program; attempt: Attempt }) {
  return (
    <ol className="hidden items-center gap-1 xl:flex" aria-label="Sections">
      {program.sections.map((s, i) => {
        const st = attempt.sections[s.id];
        const cur = i === attempt.sectionIndex;
        return (
          <li
            key={s.id}
            title={`${s.code} ${s.title}`}
            className={`rounded px-1.5 py-0.5 text-[0.68rem] font-bold tracking-wide ${
              cur ? "bg-[var(--accent)] text-white" : st.status === "closed" ? "bg-[var(--accent-soft)] text-ink-soft line-through decoration-1" : "text-ink-mute ring-1 ring-line"
            }`}
          >
            {s.code}
          </li>
        );
      })}
    </ol>
  );
}

/* ----------------------------------------------------------- section intro -- */

function SectionIntro({
  program,
  section: s,
  index,
  count,
  extraMs,
  onBegin,
  onSkip,
}: {
  program: Program;
  section: Section;
  index: number;
  count: number;
  extraMs: number;
  onBegin: () => void;
  onSkip: () => void;
}) {
  const minutes = s.duration_min ? Math.round((s.duration_min * 60_000 + extraMs) / 60_000) : null;
  return (
    <main id="main" className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[1.2fr_1fr]">
      <section className="animate-rise">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-mute">
          Section {index + 1} of {program.sections.length}
        </p>
        <h1 className="mt-3 font-serif text-5xl leading-[1.04] sm:text-6xl">
          <span className="text-[var(--accent)]">{s.code}</span> {s.title}
        </h1>
        <RichText text={s.intro} className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft" />
        {s.kind === "pretest" && <p className="mt-4 rounded-lg bg-cream px-4 py-3 text-sm text-ink-soft">{t("runner.pretestNote")}</p>}
        <dl className="mt-7 flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-widest text-ink-mute">Time</dt>
            <dd className="mt-0.5 text-lg font-semibold">{minutes ? `${minutes} minutes` : "Untimed"}{extraMs ? " (incl. extra time)" : ""}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-widest text-ink-mute">Tasks</dt>
            <dd className="mt-0.5 text-lg font-semibold">{count}</dd>
          </div>
          {s.traits.length > 0 && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-widest text-ink-mute">Looks for</dt>
              <dd className="mt-0.5 text-lg font-semibold">{s.traits.join(", ")}</dd>
            </div>
          )}
        </dl>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={onBegin}>
            {t("runner.begin")} {minutes ? `· timer starts` : ""} →
          </Button>
          {s.kind === "optional" && (
            <Button variant="ghost" onClick={onSkip}>
              {t("runner.skipOptional")}
            </Button>
          )}
        </div>
      </section>
      <div className="pattern-lattice relative hidden aspect-square overflow-hidden bg-[var(--accent-fill)] lg:block curve-br" aria-hidden>
        <CrestWatermark className="absolute -bottom-10 -right-10 w-[80%]" />
        <span className="absolute left-8 top-6 font-serif text-[9rem] leading-none text-white/90">{s.code}</span>
        <span className="absolute bottom-8 left-8 max-w-[70%] font-serif text-3xl italic leading-tight text-white">{s.summary}</span>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------ section body -- */

function SectionBody({
  program,
  section,
  items,
  stimuli,
  attempt,
  games,
  onIndex,
  onResponse,
  onPasteBlocked,
  onFinish,
  onScratch,
}: {
  program: Program;
  section: Section;
  items: { item: import("@/content/schema").Item; stimulusId?: string }[];
  stimuli: Record<string, Stimulus>;
  attempt: Attempt;
  games: Record<string, unknown>;
  onIndex: (i: number) => void;
  onResponse: (id: string, r: Response) => void;
  onPasteBlocked: (itemId: string) => void;
  onFinish: () => void;
  onScratch: (text: string) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const index = Math.min(attempt.itemIndex[section.id] ?? 0, items.length - 1);
  const { item, stimulusId } = items[index];
  const stimulus = stimulusId ? stimuli[stimulusId] : null;
  const locked = section.locked_sequence || item.locked_sequence;
  const answered = items.map(({ item: it }) => isAnswered(attempt.responses[it.id]));
  const unanswered = answered.filter((a) => !a).length;
  const currentDone = answered[index];
  const last = index === items.length - 1;
  const wide = ["drawing_canvas", "layout_drag", "interactive_task", "photo_upload", "hotspot"].includes(item.type) || item.media.some((m) => m.kind === "strip");
  const ctx = { programId: program.id, candidateId: attempt.candidateId, windowSeed: program.window.seed, games, practice: false };
  const go = (i: number) => {
    onIndex(i);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main id="main" className="flex w-full flex-1 flex-col">
      {!locked && items.length > 1 && (
        <nav aria-label={t("runner.questions")} className="border-b border-line bg-white/50">
          <ol className="mx-auto flex max-w-[92rem] flex-wrap items-center gap-1.5 px-4 py-2.5 sm:px-6">
            <li className="mr-2 text-xs font-semibold uppercase tracking-widest text-ink-mute">{t("runner.questions")}</li>
            {items.map(({ item: it }, i) => (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={i === index ? "step" : undefined}
                  aria-label={`Question ${i + 1}${answered[i] ? ", answered" : ""}`}
                  className={`grid size-8 place-items-center rounded-lg text-sm font-semibold tabular-nums transition ${
                    i === index
                      ? "bg-ink text-white"
                      : answered[i]
                        ? "bg-[var(--accent-soft)] text-ink ring-1 ring-[var(--accent)]/30"
                        : "bg-white text-ink-soft ring-1 ring-line hover:ring-line-strong"
                  }`}
                >
                  {i + 1}
                </button>
              </li>
            ))}
            <li className="ml-auto text-xs text-ink-mute">
              {items.length - unanswered}/{items.length} {t("runner.answered").toLowerCase()}
            </li>
          </ol>
        </nav>
      )}

      <div className={`mx-auto w-full flex-1 px-4 py-8 sm:px-6 ${stimulus ? "max-w-[92rem]" : wide ? "max-w-6xl" : "max-w-3xl"}`}>
        {stimulus ? (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            <StimulusPane stimulus={stimulus} />
            <div>
              <ItemView
                key={item.id}
                item={item}
                number={index + 1}
                total={items.length}
                response={attempt.responses[item.id]}
                onChange={(r) => onResponse(item.id, r)}
                onActivity={() => onPasteBlocked(item.id)}
                ctx={ctx}
              />
            </div>
          </div>
        ) : (
          <ItemView
            key={item.id}
            item={item}
            number={items.length > 1 ? index + 1 : undefined}
            total={items.length}
            response={attempt.responses[item.id]}
            onChange={(r) => onResponse(item.id, r)}
            onActivity={() => onPasteBlocked(item.id)}
            ctx={ctx}
          />
        )}
      </div>

      {section.scratchpad && <Scratchpad value={attempt.scratch?.[section.id] ?? ""} onChange={onScratch} />}

      <footer className="sticky bottom-0 z-20 border-t border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-[92rem] items-center gap-3 px-4 py-3 sm:px-6">
          {!locked && (
            <Button variant="secondary" disabled={index === 0} onClick={() => go(index - 1)}>
              ← {t("common.previous")}
            </Button>
          )}
          <p className="flex-1 text-center text-sm text-ink-mute">
            {locked ? t("runner.lockedHint") : t("runner.question", { n: index + 1, total: items.length })}
          </p>
          {!last && !locked && (
            <Button variant="ghost" onClick={() => setConfirm(true)}>
              {t("runner.finish")}
            </Button>
          )}
          {!last ? (
            <Button disabled={locked && !currentDone} onClick={() => go(index + 1)}>
              {t("common.next")} →
            </Button>
          ) : (
            <Button onClick={() => setConfirm(true)}>{t("runner.finish")} ✓</Button>
          )}
        </div>
      </footer>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t("runner.finishTitle", { section: `${section.code} ${section.title}` })}
        actions={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              {t("runner.keepWorking")}
            </Button>
            <Button
              onClick={() => {
                setConfirm(false);
                onFinish();
              }}
            >
              {t("runner.finishConfirm")}
            </Button>
          </>
        }
      >
        <p>{t("runner.finishBody")}</p>
        {unanswered > 0 && <p className="mt-2 font-semibold text-narangi-ink">{t("runner.finishUnanswered", { n: unanswered })}</p>}
      </Modal>
    </main>
  );
}

function StimulusPane({ stimulus: s }: { stimulus: Stimulus }) {
  return (
    <aside className="h-fit bg-white p-6 shadow-sm ring-1 ring-line lg:sticky lg:top-40 lg:max-h-[calc(100dvh-13rem)] lg:overflow-y-auto sm:p-8 curve-br" aria-label={s.title}>
      {s.eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">{s.eyebrow}</p>}
      <h2 className="mt-1 font-serif text-3xl leading-tight">{s.title}</h2>
      {s.body && <RichText text={s.body} className="mt-4 text-[1.02rem] leading-relaxed text-ink-soft" />}
      {s.media.length > 0 && (
        <div className="mt-6 grid gap-4">
          {s.media.map((m, i) => (
            <MediaView key={i} media={m} />
          ))}
        </div>
      )}
    </aside>
  );
}

/** Unmarked rough-work pad, docked bottom-right. */
function Scratchpad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-20 right-4 z-30 flex flex-col items-end gap-2">
      {open && (
        <div className="w-80 animate-rise overflow-hidden bg-white shadow-2xl ring-1 ring-line-strong curve-br-sm">
          <p className="border-b border-line bg-cream px-4 py-2 text-xs font-semibold uppercase tracking-widest text-ink-soft">Rough work · not marked</p>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={10}
            placeholder="Working out goes here…"
            aria-label="Rough work (not marked)"
            className="block w-full resize-none bg-[repeating-linear-gradient(transparent,transparent_27px,#EFE4D2_28px)] px-4 py-2 font-mono text-sm leading-7 outline-none"
          />
        </div>
      )}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink shadow-lg ring-1 ring-line-strong hover:bg-cream">
        ✎ {open ? "Hide rough work" : "Rough work"}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------- demo tools -- */

/** Lets reviewers see timer warnings and expiry without waiting 25 minutes. */
function DemoTools({ active, onAdvance, onJumpTo }: { active: boolean; onAdvance: (ms: number) => void; onJumpTo: (leftMs: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed bottom-20 left-4 z-40">
      {open && (
        <div className="mb-2 w-64 animate-rise rounded-xl bg-ink p-4 text-sm text-white shadow-2xl">
          <p className="font-semibold">Demo tools</p>
          <p className="mt-0.5 text-xs text-white/60">Not part of the candidate experience.</p>
          <div className="mt-3 grid gap-1.5">
            <DemoBtn disabled={!active} onClick={() => onAdvance(5 * 60_000)}>Skip ahead 5 minutes</DemoBtn>
            <DemoBtn disabled={!active} onClick={() => onJumpTo(5 * 60_000 + 4000)}>Jump to 5:04 left</DemoBtn>
            <DemoBtn disabled={!active} onClick={() => onJumpTo(64_000)}>Jump to 1:04 left</DemoBtn>
            <DemoBtn disabled={!active} onClick={() => onJumpTo(4000)}>Jump to 0:04 left</DemoBtn>
            <DemoBtn onClick={() => location.reload()}>Reload page (test resume)</DemoBtn>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-full bg-ink/85 px-3 py-1.5 text-xs font-semibold text-white shadow-lg hover:bg-ink"
        aria-expanded={open}
      >
        {open ? "Close demo tools" : "Demo tools"}
      </button>
    </div>
  );
}

function DemoBtn(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className="rounded-lg bg-white/10 px-3 py-2 text-left hover:bg-white/20 disabled:opacity-35" />;
}
