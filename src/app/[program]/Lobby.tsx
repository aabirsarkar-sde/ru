"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SchoolBand } from "@/components/brand";
import { TopBar } from "@/components/TopBar";
import { Button, Spinner, ToastProvider } from "@/components/ui";
import type { Program } from "@/content/schema";
import type { Response } from "@/engine/responses";
import { ItemView } from "@/items/ItemRenderer";
import { clearAttempt, createAttempt, loadAttempt, saveAttempt, type Attempt } from "@/lib/attempt";


export function Lobby({ program, games }: { program: Program; games: Record<string, unknown> }) {
  const router = useRouter();
  // Programmes without practice items skip that step entirely.
  const steps = program.practice.length ? (["Welcome", "System check", "Practice", "Start"] as const) : (["Welcome", "System check", "Start"] as const);
  const [stepIdx, setStepIdx] = useState(0);
  const step = steps[stepIdx];
  const go = (name: (typeof steps)[number]) => setStepIdx(steps.indexOf(name as never));
  const [existing, setExisting] = useState<Attempt | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [extra, setExtra] = useState(0);
  const [consent, setConsent] = useState(false);
  const [guardian, setGuardian] = useState(false);

  useEffect(() => {
    loadAttempt(program.id).then(setExisting);
  }, [program.id]);

  const start = async () => {
    const a = createAttempt(program, name || "Candidate", extra);
    await saveAttempt(a);
    router.push(`/${program.id}/test`);
  };

  return (
    <ToastProvider>
      <div data-accent={program.accent} className="flex min-h-dvh flex-col">
        <TopBar>
          <p className="truncate text-sm font-semibold text-ink-soft">
            {program.name} · <span className="font-normal">Stage 2 aptitude test</span>
          </p>
        </TopBar>

        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 sm:py-10">
          <ol className="mb-8 flex flex-wrap items-center gap-2 text-sm" aria-label="Steps">
            {steps.map((s, i) => (
              <li key={s} className="flex items-center gap-2">
                <span
                  aria-current={i === stepIdx ? "step" : undefined}
                  className={`flex items-center gap-2 rounded-full px-3 py-1 font-semibold ${
                    i === stepIdx ? "bg-[var(--accent)] text-white" : i < stepIdx ? "bg-[var(--accent-soft)] text-ink" : "text-ink-mute"
                  }`}
                >
                  <span className="tabular-nums">{i < stepIdx ? "✓" : i + 1}</span> {s}
                </span>
                {i < steps.length - 1 && <span aria-hidden className="h-px w-6 bg-line-strong" />}
              </li>
            ))}
          </ol>

          {existing && (
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4 bg-[var(--accent-soft)] p-5 curve-br-sm">
              <div>
                <p className="font-semibold">
                  {existing.submittedAt ? "You've already submitted this test." : `Welcome back, ${existing.candidateName}. Your test is in progress.`}
                </p>
                <p className="text-sm text-ink-soft">
                  {existing.submittedAt ? "You can view your submission summary." : "Your answers and remaining time are saved. Pick up where you left off."}
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => router.push(`/${program.id}/${existing.submittedAt ? "done" : "test"}`)}>
                  {existing.submittedAt ? "View summary" : "Resume test →"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={async () => {
                    await clearAttempt(program.id);
                    setExisting(null);
                  }}
                >
                  Start over (demo)
                </Button>
              </div>
            </div>
          )}

          {step === "Welcome" && (
            <Welcome
              program={program}
              name={name}
              setName={setName}
              extra={extra}
              setExtra={setExtra}
              consent={consent}
              setConsent={setConsent}
              guardian={guardian}
              setGuardian={setGuardian}
              onNext={() => go("System check")}
            />
          )}
          {step === "System check" && (
            <SystemCheck
              onBack={() => go("Welcome")}
              onNext={() => go(program.practice.length ? "Practice" : "Start")}
              nextLabel={program.practice.length ? "Try the tools →" : "Continue →"}
            />
          )}
          {step === "Practice" && <Practice program={program} games={games} onBack={() => go("System check")} onNext={() => go("Start")} />}
          {step === "Start" && (
            <Ready program={program} extra={extra} onBack={() => go(program.practice.length ? "Practice" : "System check")} onStart={start} />
          )}
        </main>
      </div>
    </ToastProvider>
  );
}

/* ---------------------------------------------------------------- welcome -- */

function Welcome(props: {
  program: Program;
  name: string;
  setName: (s: string) => void;
  extra: number;
  setExtra: (n: number) => void;
  consent: boolean;
  setConsent: (b: boolean) => void;
  guardian: boolean;
  setGuardian: (b: boolean) => void;
  onNext: () => void;
}) {
  const { program: p } = props;
  const ok = props.name.trim().length > 1 && props.consent && props.guardian;
  return (
    <div className="grid gap-10 lg:grid-cols-[1.15fr_1fr]">
      <section className="animate-rise">
        {p.school && <SchoolBand school={p.school} />}
        <h1 className="mt-4 font-serif text-5xl leading-[1.05] sm:text-6xl">{p.full_name}</h1>
        <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-soft">{p.pitch}</p>
        <h2 className="mt-9 text-xs font-semibold uppercase tracking-[0.18em] text-ink-mute">Your test · about {p.duration_min} minutes</h2>
        <ol className="mt-3 grid gap-2">
          {p.sections.map((s) => (
            <li key={s.id} className="flex gap-4 bg-white p-4 ring-1 ring-line curve-br-sm">
              <span className="w-8 shrink-0 font-serif text-2xl leading-none text-[var(--accent)]">{s.code}</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-semibold">{s.title}</span>
                  <span className="text-xs font-medium text-ink-mute">
                    {s.duration_min ? `${s.duration_min} min` : "untimed"}
                    {s.kind === "pretest" ? " · before test day" : ""}
                    {s.kind === "optional" ? " · optional" : ""}
                  </span>
                </span>
                <span className="mt-0.5 block text-sm text-ink-soft">{s.summary}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="h-fit animate-rise bg-white p-6 shadow-sm ring-1 ring-line [animation-delay:100ms] sm:p-8 curve-br">
        <h2 className="font-serif text-3xl">Before you begin</h2>
        <p className="mt-1 text-sm text-ink-soft">
          In the live test you arrive through a single-use link and a one-time code sent to your phone. For this demo, just enter a name.
        </p>
        <label className="mt-5 grid gap-1.5">
          <span className="text-sm font-semibold">Your name</span>
          <input
            value={props.name}
            onChange={(e) => props.setName(e.target.value)}
            autoComplete="name"
            className="h-12 rounded-xl bg-paper px-4 ring-1 ring-line-strong outline-none focus:ring-2 focus:ring-[var(--accent)]"
            placeholder="e.g. Ananya Sharma"
          />
          <span className="text-xs text-ink-mute">Evaluators never see your name — only a candidate code.</span>
        </label>
        <label className="mt-4 grid gap-1.5">
          <span className="text-sm font-semibold">Accommodation: extra time</span>
          <select
            value={props.extra}
            onChange={(e) => props.setExtra(Number(e.target.value))}
            className="h-12 rounded-xl bg-paper px-3 ring-1 ring-line-strong outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <option value={0}>None</option>
            <option value={0.25}>+25% on every timed section</option>
            <option value={0.5}>+50% on every timed section</option>
          </select>
          <span className="text-xs text-ink-mute">Normally set by the admissions office from your application. Shown here for the demo.</span>
        </label>

        <details className="mt-6 rounded-xl bg-paper p-4 text-sm ring-1 ring-line">
          <summary className="cursor-pointer font-semibold">What we collect, and why</summary>
          <ul className="mt-3 grid list-disc gap-1.5 pl-5 text-ink-soft">
            <li>Your answers, drawings and photos — to score your test.</li>
            <li>Timing and activity signals: leaving full screen, switching tabs, attempts to paste. These never lower your score on their own; they may lead to a follow-up question at Stage 3.</li>
            <li>No webcam recording. Camera access is optional and only used to check your device.</li>
            <li>Evaluators see your work without your name, school, city or photo.</li>
            <li>Everything is deleted after this admissions cycle ends.</li>
          </ul>
          <p className="mt-3 text-xs text-ink-mute">Placeholder text pending legal review under India&apos;s DPDP Act, 2023.</p>
        </details>
        <label className="mt-4 flex items-start gap-3 text-sm">
          <input type="checkbox" checked={props.consent} onChange={(e) => props.setConsent(e.target.checked)} className="mt-0.5 size-5 accent-[var(--accent)]" />
          <span>I understand what is collected and agree to take the test on these terms.</span>
        </label>
        <label className="mt-3 flex items-start gap-3 text-sm">
          <input type="checkbox" checked={props.guardian} onChange={(e) => props.setGuardian(e.target.checked)} className="mt-0.5 size-5 accent-[var(--accent)]" />
          <span>I am 18 or older, or a parent or guardian has agreed to these terms with me.</span>
        </label>
        <Button className="mt-6 w-full" size="lg" disabled={!ok} onClick={props.onNext}>
          Check my system →
        </Button>
      </section>
    </div>
  );
}

/* ----------------------------------------------------------- system check -- */

type CheckState = "pending" | "running" | "pass" | "warn" | "fail";
interface Check {
  id: string;
  label: string;
  state: CheckState;
  detail: string;
  required: boolean;
}

function SystemCheck({ onBack, onNext, nextLabel }: { onBack: () => void; onNext: () => void; nextLabel: string }) {
  const [checks, setChecks] = useState<Check[]>([
    { id: "browser", label: "Browser features", state: "pending", detail: "", required: true },
    { id: "screen", label: "Screen size", state: "pending", detail: "", required: false },
    { id: "storage", label: "Saving on this device", state: "pending", detail: "", required: true },
    { id: "network", label: "Connection speed", state: "pending", detail: "", required: false },
    { id: "input", label: "Drawing input", state: "pending", detail: "", required: false },
    { id: "camera", label: "Camera (optional)", state: "pending", detail: "Only if you want to upload photos from this computer's camera.", required: false },
  ]);
  const set = (id: string, patch: Partial<Check>) => setChecks((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  useEffect(() => {
    const run = async () => {
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
      set("browser", { state: "running" });
      await wait(350);
      const feats = [
        ["PointerEvent" in window, "pointer events"],
        [!!document.createElement("canvas").getContext("2d"), "canvas"],
        ["indexedDB" in window, "IndexedDB"],
        [typeof fetch === "function", "fetch"],
      ] as const;
      const missing = feats.filter(([ok]) => !ok).map(([, n]) => n);
      set("browser", missing.length ? { state: "fail", detail: `Missing: ${missing.join(", ")}. Please use a recent Chrome, Edge or Firefox.` } : { state: "pass", detail: "Everything the test needs is supported." });

      set("screen", { state: "running" });
      await wait(250);
      const w = window.innerWidth;
      set("screen", w >= 1024 ? { state: "pass", detail: `${w} px wide — good for drawing and the game.` } : { state: "warn", detail: `${w} px wide. A laptop or desktop screen (1024 px+) is recommended.` });

      set("storage", { state: "running" });
      try {
        const { set: idbSet, get, del } = await import("idb-keyval");
        await idbSet("ru:probe", 1);
        const ok = (await get("ru:probe")) === 1;
        await del("ru:probe");
        set("storage", ok ? { state: "pass", detail: "Your answers can be saved even if the internet drops." } : { state: "fail", detail: "Storage is blocked. Turn off private browsing and try again." });
      } catch {
        set("storage", { state: "fail", detail: "Storage is blocked. Turn off private browsing and try again." });
      }

      set("network", { state: "running" });
      try {
        const t0 = performance.now();
        const r = await fetch(`/media/bdes/scene-chai.svg?probe=${Date.now()}`, { cache: "no-store" });
        const bytes = (await r.arrayBuffer()).byteLength;
        const secs = (performance.now() - t0) / 1000;
        const mbps = (bytes * 8) / secs / 1_000_000;
        set(
          "network",
          mbps >= 2 || secs < 0.4
            ? { state: "pass", detail: `About ${mbps >= 100 ? "100+" : mbps.toFixed(1)} Mbps. The test works on 2 Mbps.` }
            : { state: "warn", detail: `About ${mbps.toFixed(1)} Mbps. The test will still work — photos upload a little slower.` },
        );
      } catch {
        set("network", { state: "warn", detail: "Couldn't measure. You can still take the test; answers save offline." });
      }

      set("input", { state: "running" });
      await wait(200);
      const touch = navigator.maxTouchPoints > 0;
      set("input", { state: "pass", detail: `Mouse/trackpad${touch ? ", touch" : ""}${touch ? " and stylus (if you have one)" : ""} supported. Prefer paper? You can upload a photo instead.` });
    };
    run();
  }, []);

  const testCamera = async () => {
    set("camera", { state: "running" });
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      s.getTracks().forEach((t) => t.stop());
      set("camera", { state: "pass", detail: "Camera works. It was switched off straight away." });
    } catch {
      set("camera", { state: "warn", detail: "No camera access — that's fine. You can upload photos from your phone instead." });
    }
  };

  const blocking = checks.some((c) => c.required && c.state === "fail");
  const done = checks.filter((c) => c.id !== "camera").every((c) => c.state !== "pending" && c.state !== "running");

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <section>
        <h1 className="font-serif text-4xl">Checking your system</h1>
        <p className="mt-2 text-ink-soft">This takes a few seconds, so nothing surprises you halfway through the test.</p>
        <ul className="mt-6 grid gap-2.5">
          {checks.map((c) => (
            <li key={c.id} className="flex items-start gap-4 bg-white p-4 ring-1 ring-line curve-br-sm">
              <StatusIcon state={c.state} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{c.label}</p>
                <p className="text-sm text-ink-soft">{c.detail || (c.state === "running" ? "Checking…" : "Waiting…")}</p>
              </div>
              {c.id === "camera" && c.state === "pending" && (
                <Button variant="secondary" size="sm" onClick={testCamera}>
                  Test camera
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>
      <aside className="h-fit bg-cream p-6 curve-br">
        <h2 className="font-serif text-2xl">Good to know</h2>
        <ul className="mt-3 grid gap-2 text-sm text-ink-soft">
          <li>• Plug in your charger if you can.</li>
          <li>• If your internet drops, keep going — answers save on this device and your timer is kept.</li>
          <li>• Closed the tab by accident? Open the same link: you&apos;ll resume with your time intact.</li>
        </ul>
        <div className="mt-6 flex gap-2">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button className="flex-1" disabled={!done || blocking} onClick={onNext}>
            {done ? nextLabel : <Spinner />}
          </Button>
        </div>
      </aside>
    </div>
  );
}

function StatusIcon({ state }: { state: CheckState }) {
  const map: Record<CheckState, [string, string]> = {
    pending: ["bg-line text-ink-mute", "·"],
    running: ["bg-cream text-ink", ""],
    pass: ["bg-ok text-white", "✓"],
    warn: ["bg-warn text-white", "!"],
    fail: ["bg-red text-white", "✕"],
  };
  const [cls, icon] = map[state];
  return (
    <span className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${cls}`} aria-label={state}>
      {state === "running" ? <Spinner /> : icon}
    </span>
  );
}

/* --------------------------------------------------------------- practice -- */

function Practice({ program, games, onBack, onNext }: { program: Program; games: Record<string, unknown>; onBack: () => void; onNext: () => void }) {
  const [tab, setTab] = useState(0);
  const [responses, setResponses] = useState<Record<string, Response>>({});
  const items = program.practice;
  const item = items[tab];
  const labels: Record<string, string> = {
    drawing_canvas: "Drawing canvas",
    photo_upload: "Photo upload",
    layout_drag: "Layout board",
    ranking: "Ranking",
    short_text: "Written answers",
    mcq_single: "Multiple choice",
    interactive_task: "Game",
  };
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl">Try the tools — untimed</h1>
          <p className="mt-2 max-w-2xl text-ink-soft">Nothing here is saved or scored. The point is that the interface is never what&apos;s being tested.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onNext}>I&apos;m ready →</Button>
        </div>
      </div>
      <div role="tablist" aria-label="Practice tools" className="mt-6 flex flex-wrap gap-2">
        {items.map((it, i) => (
          <button
            key={it.id}
            role="tab"
            aria-selected={i === tab}
            onClick={() => setTab(i)}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${i === tab ? "bg-ink text-white" : "bg-white text-ink-soft ring-1 ring-line hover:ring-line-strong"}`}
          >
            {it.type === "interactive_task" ? (it.module === "stroop" ? "Colour task" : "Mela Market") : labels[it.type]}
          </button>
        ))}
      </div>
      <div className="mt-5 bg-white/70 p-5 ring-1 ring-line sm:p-8 curve-br" role="tabpanel">
        <ItemView
          key={item.id}
          item={item}
          response={responses[item.id]}
          onChange={(r) => setResponses((s) => ({ ...s, [item.id]: r }))}
          ctx={{ programId: program.id, candidateId: "practice", windowSeed: program.window.seed, games, practice: true }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ ready -- */

function Ready({ program, extra, onBack, onStart }: { program: Program; extra: number; onBack: () => void; onStart: () => Promise<void> }) {
  const hasPractice = program.practice.length > 0;
  const [busy, setBusy] = useState(false);
  const timed = program.sections.filter((s) => s.duration_min);
  const minutes = timed.reduce((a, s) => a + (s.duration_min ?? 0), 0);
  return (
    <div className="mx-auto max-w-3xl text-center">
      <h1 className="font-serif text-5xl sm:text-6xl">You&apos;re ready.</h1>
      <p className="mt-3 text-lg text-ink-soft">
        {timed.length} timed sections · {Math.round(minutes * (1 + extra))} minutes in total{extra ? ` (including +${extra * 100}% extra time)` : ""}.
      </p>
      <ul className="mx-auto mt-8 grid max-w-2xl gap-3 text-left sm:grid-cols-2">
        {[
          ["⏱", "Each section has its own timer", "You'll get a warning at 5 minutes and at 1 minute."],
          ["↺", "Move freely within a section", "But once you finish a section, you can't go back to it."],
          ["💾", "Everything saves as you go", "If the internet drops or the tab closes, you'll resume with the same time left."],
          ["✍", "Your own words", "Pasting is turned off in written answers. Rough spelling is fine."],
        ].map(([icon, title, body]) => (
          <li key={title} className="flex gap-3 bg-white p-4 ring-1 ring-line curve-br-sm">
            <span aria-hidden className="text-xl">
              {icon}
            </span>
            <span>
              <span className="block font-semibold">{title}</span>
              <span className="block text-sm text-ink-soft">{body}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-10 flex justify-center gap-3">
        <Button variant="ghost" onClick={onBack}>
          {hasPractice ? "Back to practice" : "Back"}
        </Button>
        <Button
          size="lg"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onStart();
          }}
        >
          {busy ? <Spinner /> : null} Start the test
        </Button>
      </div>
      <p className="mt-4 text-sm text-ink-mute">
        <Link href="/" className="underline-offset-2 hover:underline">
          Not now — back to programmes
        </Link>
      </p>
    </div>
  );
}
