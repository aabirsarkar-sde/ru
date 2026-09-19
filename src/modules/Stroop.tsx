"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chart } from "@/components/media";
import { Button } from "@/components/ui";
import { generateTrials, summarise, type StroopConfig, type StroopResponse, type StroopSummary, type StroopTrial } from "@/engine/stroop";

export interface StroopData {
  trials: StroopTrial[];
  responses: StroopResponse[];
  summary: StroopSummary | null;
  startedAt: number | null;
  finishedAt: number | null;
  restarts: number;
}

type Phase = "intro" | "practice" | "ready" | "run" | "results";

export function StroopTask({
  config,
  seed,
  data,
  practiceOnly,
  onData,
}: {
  config: StroopConfig;
  seed: string;
  data: StroopData | null;
  practiceOnly: boolean;
  onData: (d: StroopData, completed: boolean) => void;
}) {
  const [phase, setPhase] = useState<Phase>(data?.finishedAt ? "results" : data?.startedAt ? "ready" : "intro");
  const practiceTrials = useMemo(() => generateTrials(config, `${seed}:practice`, config.practice_trials), [config, seed]);
  const runTrials = useMemo(() => generateTrials(config, seed, config.max_trials), [config, seed]);

  const finishRun = useCallback(
    (responses: StroopResponse[], startedAt: number) => {
      const used = runTrials.slice(0, responses.length);
      const d: StroopData = {
        trials: used,
        responses,
        summary: summarise(used, responses),
        startedAt,
        finishedAt: Date.now(),
        restarts: data?.restarts ?? 0,
      };
      onData(d, true);
      setPhase("results");
    },
    [runTrials, onData, data?.restarts],
  );

  if (phase === "intro")
    return (
      <Panel>
        <h3 className="font-serif text-3xl">Name the ink colour — not the word.</h3>
        <p className="mt-3 max-w-xl text-ink-soft">
          Colour words will appear one at a time. Press the key for the <strong>colour of the ink</strong>, ignoring what the word says. Try to be quick and accurate — but relax: your speed is never scored.
        </p>
        <Example config={config} />
        <KeyLegend config={config} />
        <div className="mt-6 flex gap-3">
          <Button onClick={() => setPhase("practice")}>Start {config.practice_trials} practice rounds</Button>
        </div>
      </Panel>
    );

  if (phase === "practice")
    return (
      <Panel>
        <Runner
          config={config}
          trials={practiceTrials}
          durationMs={null}
          feedback
          label="Practice"
          onDone={() => {
            if (practiceOnly) {
              onData({ trials: [], responses: [], summary: null, startedAt: null, finishedAt: Date.now(), restarts: 0 }, true);
              setPhase("results");
            } else setPhase("ready");
          }}
        />
      </Panel>
    );

  if (phase === "ready")
    return (
      <Panel>
        <h3 className="font-serif text-3xl">{data?.startedAt && !data.finishedAt ? "Your run was interrupted" : "Ready for the real run?"}</h3>
        <p className="mt-3 max-w-xl text-ink-soft">
          {data?.startedAt && !data.finishedAt
            ? "No problem — you can start the two-minute run again from the beginning."
            : `It lasts ${Math.round(config.duration_s / 60)} minutes. There's no feedback this time. Keep your fingers on the keys.`}
        </p>
        <KeyLegend config={config} />
        <div className="mt-6">
          <Button
            onClick={() => {
              onData(
                { trials: [], responses: [], summary: null, startedAt: Date.now(), finishedAt: null, restarts: (data?.restarts ?? 0) + (data?.startedAt ? 1 : 0) },
                false,
              );
              setPhase("run");
            }}
          >
            Start the {Math.round(config.duration_s / 60)}-minute run
          </Button>
        </div>
      </Panel>
    );

  if (phase === "run")
    return (
      <Panel>
        <Runner
          config={config}
          trials={runTrials}
          durationMs={config.duration_s * 1000}
          feedback={false}
          label="Run"
          onDone={(responses, startedAt) => finishRun(responses, startedAt)}
        />
      </Panel>
    );

  // results
  if (practiceOnly || !data?.summary)
    return (
      <Panel>
        <h3 className="font-serif text-3xl">Practice done ✓</h3>
        <p className="mt-2 text-ink-soft">In the real test you&apos;ll do a two-minute run and then see your own results.</p>
        <Button className="mt-5" variant="secondary" onClick={() => setPhase("practice")}>
          Practise again
        </Button>
      </Panel>
    );
  return <StroopResults summary={data.summary} />;
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="bg-white p-6 ring-1 ring-line sm:p-8 curve-br">{children}</div>;
}

function Example({ config }: { config: StroopConfig }) {
  const [a, b] = config.colours;
  return (
    <div className="mt-5 flex flex-wrap gap-6 text-sm">
      <div className="rounded-xl bg-paper px-5 py-3 text-center">
        <p className="font-sans text-3xl font-bold" style={{ color: a.hex }}>
          {a.word}
        </p>
        <p className="mt-1 text-ink-soft">
          Press <Kbd>{a.key.toUpperCase()}</Kbd> ({a.id})
        </p>
      </div>
      <div className="rounded-xl bg-paper px-5 py-3 text-center">
        <p className="font-sans text-3xl font-bold" style={{ color: a.hex }}>
          {b.word}
        </p>
        <p className="mt-1 text-ink-soft">
          Press <Kbd>{a.key.toUpperCase()}</Kbd> ({a.id}) — the ink, not the word
        </p>
      </div>
    </div>
  );
}

function KeyLegend({ config }: { config: StroopConfig }) {
  return (
    <p className="mt-5 flex flex-wrap gap-4 text-sm text-ink-soft">
      {config.colours.map((c) => (
        <span key={c.id}>
          <Kbd>{c.key.toUpperCase()}</Kbd> {c.id}
        </span>
      ))}
    </p>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded-md bg-cream px-2 py-0.5 font-mono text-sm font-bold text-ink ring-1 ring-line-strong">{children}</kbd>;
}

function Runner({
  config,
  trials,
  durationMs,
  feedback,
  label,
  onDone,
}: {
  config: StroopConfig;
  trials: StroopTrial[];
  durationMs: number | null;
  feedback: boolean;
  label: string;
  onDone: (responses: StroopResponse[], startedAt: number) => void;
}) {
  const [i, setI] = useState(0);
  const [showing, setShowing] = useState(false);
  const [flash, setFlash] = useState<"ok" | "no" | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const shownAt = useRef(0);
  const startedAt = useRef(0);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);
  const responses = useRef<StroopResponse[]>([]);
  const done = useRef(false);
  const byId = useMemo(() => new Map(config.colours.map((c) => [c.id, c])), [config]);

  const finish = useCallback(() => {
    if (done.current) return;
    done.current = true;
    onDone(responses.current, startedAt.current);
  }, [onDone]);

  // Fixation → stimulus.
  useEffect(() => {
    const id = setTimeout(() => {
      shownAt.current = performance.now();
      setShowing(true);
    }, config.fixation_ms);
    return () => clearTimeout(id);
  }, [i, config.fixation_ms]);

  useEffect(() => {
    if (!durationMs) return;
    const id = setInterval(() => {
      const e = Date.now() - startedAt.current;
      setElapsed(e);
      if (e >= durationMs) finish();
    }, 200);
    return () => clearInterval(id);
  }, [durationMs, finish]);

  const answer = useCallback(
    (colourId: string) => {
      if (!showing || done.current) return;
      const trial = trials[i];
      const correct = colourId === trial.ink;
      responses.current.push({ index: trial.index, answer: colourId, correct, rtMs: Math.round(performance.now() - shownAt.current) });
      if (feedback) {
        setFlash(correct ? "ok" : "no");
        setTimeout(() => setFlash(null), 350);
      }
      if (i + 1 >= trials.length) finish();
      else {
        setShowing(false);
        setI(i + 1);
      }
    },
    [showing, trials, i, feedback, finish],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const c = config.colours.find((x) => x.key === e.key.toLowerCase());
      if (c) {
        e.preventDefault();
        answer(c.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [config, answer]);

  const trial = trials[i];
  const progress = durationMs ? elapsed / durationMs : i / trials.length;

  return (
    <div>
      <div className="mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-ink-mute">
        <span>{label}</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
          <div className="h-full bg-[var(--accent)] transition-[width] duration-200" style={{ width: `${Math.min(1, progress) * 100}%` }} />
        </div>
        <span className="tabular-nums">{durationMs ? `${Math.max(0, Math.ceil((durationMs - elapsed) / 1000))}s` : `${i + 1}/${trials.length}`}</span>
      </div>
      <div
        className={`grid h-56 place-items-center rounded-2xl transition-colors duration-150 ${flash === "ok" ? "bg-ok/10" : flash === "no" ? "bg-red/10" : "bg-paper"}`}
        aria-live="off"
      >
        {showing ? (
          <span className="select-none font-sans text-6xl font-extrabold tracking-wide sm:text-7xl" style={{ color: byId.get(trial.ink)!.hex }}>
            {byId.get(trial.word)!.word}
          </span>
        ) : (
          <span className="text-4xl text-ink-mute">+</span>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {config.colours.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => answer(c.id)}
            className="flex h-14 items-center justify-center gap-2 rounded-xl bg-white text-base font-semibold capitalize text-ink ring-1 ring-line-strong hover:bg-cream active:translate-y-px"
          >
            <Kbd>{c.key.toUpperCase()}</Kbd> {c.id}
          </button>
        ))}
      </div>
      {feedback && <p className="mt-3 text-center text-sm text-ink-mute">Practice gives feedback: green for correct, red for a slip.</p>}
    </div>
  );
}

export function StroopResults({ summary }: { summary: StroopSummary }) {
  const { congruent: c, incongruent: n, interferenceMs } = summary;
  return (
    <div className="bg-white p-6 ring-1 ring-line sm:p-8 curve-br">
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">Your results — for you to think about, not scored</p>
      <h3 className="mt-1 font-serif text-3xl leading-tight">
        {interferenceMs != null && interferenceMs > 0
          ? `You were about ${interferenceMs} ms slower when the word and ink didn't match.`
          : "Here's how your matched and mismatched trials compared."}
      </h3>
      <div className="mt-5 grid gap-5 md:grid-cols-[1.4fr_1fr]">
        <Chart
          spec={{
            kind: "bar",
            title: "Average reaction time on correct answers (ms)",
            categories: ["Word matches ink", "Word ≠ ink"],
            series: [{ name: "Reaction time (ms)", values: [c.meanRt ?? 0, n.meanRt ?? 0] }],
            y_min: 0,
          }}
        />
        <dl className="grid content-start gap-3 text-sm">
          <Stat label="Matched trials" value={`${c.n} · ${Math.round(c.accuracy * 100)}% correct`} />
          <Stat label="Mismatched trials" value={`${n.n} · ${Math.round(n.accuracy * 100)}% correct`} />
          <Stat label="Median (matched / mismatched)" value={`${c.medianRt ?? "–"} / ${n.medianRt ?? "–"} ms`} />
        </dl>
      </div>
      <p className="mt-5 text-ink-soft">Next, you&apos;ll explain in your own words what you noticed — and why it might happen.</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-paper px-4 py-3">
      <dt className="text-xs font-semibold uppercase tracking-wider text-ink-mute">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}
