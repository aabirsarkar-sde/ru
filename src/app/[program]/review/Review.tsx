"use client";
// Evaluator preview for a single submission. In production evaluators work
// item-wise across many candidates from a blinded queue (two raters per
// response, a third on disagreement). This page shows the same building
// blocks — blinded response, rubric panel, auto-scores, composite — for the
// one attempt stored on this device.
import Link from "next/link";
import { useMemo } from "react";
import { MediaView } from "@/components/media";
import { TopBar } from "@/components/TopBar";
import { Pill, Spinner } from "@/components/ui";
import type { Item, Program, Rubric } from "@/content/schema";
import { scoreMela, syntheticCohort } from "@/engine/mela/score";
import type { MelaConfig } from "@/engine/mela/types";
import { buildPaper } from "@/engine/paper";
import type { Response } from "@/engine/responses";
import { runHotspotChecks, runLayoutChecks, scorePaper, type ItemScore } from "@/engine/scoring";
import type { StroopSummary } from "@/engine/stroop";
import { BlockFace } from "@/items/LayoutDrag";
import { useAttempt, type Attempt } from "@/lib/attempt";
import { inr, type MelaData } from "@/modules/MelaMarket";
import { StroopResults, type StroopData } from "@/modules/Stroop";

export function Review({ program, games, rubrics }: { program: Program; games: Record<string, unknown>; rubrics: Record<string, Rubric> }) {
  const { attempt, loaded, update } = useAttempt(program.id);
  const paper = useMemo(() => (attempt ? buildPaper(program, attempt.seed) : null), [program, attempt]);
  const cohort = useMemo(() => {
    const cfg = games["mela-market.yaml"] as MelaConfig | undefined;
    return cfg ? syntheticCohort(cfg, program.window.seed) : [];
  }, [games, program.window.seed]);

  const scored = useMemo(() => {
    if (!attempt || !paper) return null;
    return scorePaper(program, paper, attempt.responses, {
      rubrics,
      ratings: attempt.ratings,
      moduleScorer: (item, data) => {
        if (item.module !== "mela_market") return null;
        const d = data as MelaData;
        return scoreMela(games[item.config] as MelaConfig, program.window.seed, d.decisions, cohort).total;
      },
    });
  }, [attempt, paper, program, rubrics, games, cohort]);

  if (!loaded)
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner />
      </div>
    );
  if (!attempt || !paper || !scored)
    return (
      <div className="grid min-h-dvh place-items-center p-8 text-center">
        <div>
          <p className="font-serif text-3xl">No submission on this device yet.</p>
          <Link href={`/${program.id}`} className="mt-3 inline-block font-semibold text-red underline">
            Take the {program.name} test first
          </Link>
        </div>
      </div>
    );

  const rate = (itemId: string, criterion: string, v: number) =>
    update((a) => ({ ...a, ratings: { ...a.ratings, [itemId]: { ...(a.ratings[itemId] ?? {}), [criterion]: v } } }));

  return (
    <div data-accent={program.accent} className="flex min-h-dvh flex-col bg-[#FBF6EE]">
      <TopBar>
        <p className="truncate text-sm">
          <span className="font-semibold">Evaluator preview</span>
          <span className="text-ink-mute"> · {program.name} · candidate </span>
          <span className="font-mono font-semibold">{attempt.candidateId}</span>
        </p>
      </TopBar>
      <div className="mx-auto grid w-full max-w-[92rem] gap-8 px-4 py-8 sm:px-6 xl:grid-cols-[1fr_22rem]">
        <main className="grid gap-10">
          <div className="rounded-xl bg-white p-5 text-sm text-ink-soft ring-1 ring-line">
            <strong className="text-ink">Blinded.</strong> No name, school, city, photo or integrity signals are shown here. In the live portal each
            subjective answer is scored by two evaluators working item-by-item across candidates; if they differ by more than 1 point on any criterion,
            a third evaluator scores it.
          </div>
          {program.sections.map((s, si) => {
            const items = paper.sections[si].items;
            const res = scored.sections.find((r) => r.sectionId === s.id)!;
            return (
              <section key={s.id} aria-labelledby={`sec-${s.id}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line-strong pb-2">
                  <h2 id={`sec-${s.id}`} className="font-serif text-3xl">
                    <span className="text-[var(--accent)]">{s.code}</span> {s.title}
                  </h2>
                  <p className="text-sm text-ink-soft">
                    weight {s.weight}% · {res.pct != null ? `${Math.round(res.pct * 100)}% so far` : "not yet scored"}
                    {res.pendingMax > 0 ? ` · ${res.pendingMax} marks awaiting rubric` : ""}
                  </p>
                </div>
                <div className="mt-4 grid gap-4">
                  {items.map(({ item }) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      response={attempt.responses[item.id]}
                      score={scored.perItem[item.id]}
                      rubric={item.rubric_id ? rubrics[item.rubric_id] : undefined}
                      ratings={attempt.ratings[item.id] ?? {}}
                      onRate={(c, v) => rate(item.id, c, v)}
                      flag={attempt.flags[item.id]}
                      onFlag={(txt) => update((a) => ({ ...a, flags: { ...a.flags, [item.id]: txt } }))}
                      games={games}
                      program={program}
                      cohort={cohort}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </main>

        <aside className="grid h-fit gap-5 xl:sticky xl:top-24">
          <div className="bg-white p-5 ring-1 ring-line curve-br">
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-mute">Weighted composite</p>
            <p className="mt-1 font-serif text-6xl tabular-nums">{scored.composite.score ?? "–"}</p>
            <p className="text-sm text-ink-soft">
              {scored.composite.complete ? "Final — all sections scored." : `Provisional — based on ${scored.composite.coveredWeight}% of the weight scored so far.`}
            </p>
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-ink-mute">
                  <th className="py-1 font-semibold">Section</th>
                  <th className="py-1 text-right font-semibold">Weight</th>
                  <th className="py-1 text-right font-semibold">Score</th>
                </tr>
              </thead>
              <tbody>
                {scored.sections.map((r) => {
                  const s = program.sections.find((x) => x.id === r.sectionId)!;
                  return (
                    <tr key={r.sectionId} className="border-t border-line">
                      <td className="py-1.5">
                        <span className="font-semibold text-[var(--accent)]">{s.code}</span> {s.title}
                      </td>
                      <td className="py-1.5 text-right tabular-nums text-ink-soft">{r.weight}%</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {r.pct != null ? `${Math.round(r.pct * 100)}%` : "–"}
                        {r.pendingMax > 0 && <span className="ml-1 text-narangi-ink" title="awaiting rubric">•</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <IntegrityPanel attempt={attempt} />
          <Link href={`/${program.id}/done`} className="text-center text-sm font-semibold text-ink-soft hover:underline">
            ← Back to the candidate&apos;s confirmation page
          </Link>
        </aside>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- item card -- */

function ItemCard(props: {
  item: Item;
  response: Response | undefined;
  score: ItemScore;
  rubric?: Rubric;
  ratings: Record<string, number>;
  onRate: (criterion: string, v: number) => void;
  flag?: string;
  onFlag: (txt: string) => void;
  games: Record<string, unknown>;
  program: Program;
  cohort: number[];
}) {
  const { item, response, score, rubric } = props;
  return (
    <article className="overflow-hidden bg-white ring-1 ring-line curve-br-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-paper/60 px-5 py-3">
        <div className="min-w-0">
          <p className="text-[0.68rem] font-semibold uppercase tracking-widest text-ink-mute">
            {item.type.replace("_", " ")} · {item.id}
          </p>
          <p className="mt-0.5 font-medium leading-snug">{item.prompt.replace(/\*/g, "")}</p>
        </div>
        <ScoreBadge score={score} />
      </header>
      <div className={`grid gap-5 p-5 ${rubric ? "lg:grid-cols-[1fr_22rem]" : ""}`}>
        <div className="min-w-0">
          <ResponseView {...props} />
        </div>
        {rubric && <RubricPanel rubric={rubric} ratings={props.ratings} onRate={props.onRate} flag={props.flag} onFlag={props.onFlag} />}
      </div>
    </article>
  );
}

function ScoreBadge({ score }: { score: ItemScore }) {
  if (score.status === "auto")
    return <Pill className="bg-[#E7F3EA] text-ok">Auto · {score.earned}/{score.max}</Pill>;
  if (score.status === "rated")
    return <Pill className="bg-[var(--accent-soft)] text-ink">Rated · {score.earned}/{score.max}</Pill>;
  if (score.status === "rubric") return <Pill className="bg-[#FBE6DA] text-narangi-ink">Awaiting rubric · /{score.max}</Pill>;
  return <Pill className="bg-line/60 text-ink-soft">Not scored</Pill>;
}

function ResponseView({ item, response, games, program, cohort }: Parameters<typeof ItemCard>[0]) {
  if (!response) return <p className="italic text-ink-mute">No response.</p>;
  switch (response.type) {
    case "mcq_single":
    case "mcq_multi": {
      if (item.type !== "mcq_single" && item.type !== "mcq_multi") return null;
      const picked = response.type === "mcq_single" ? (response.choice ? [response.choice] : []) : response.choices;
      const key = Array.isArray(item.answer) ? item.answer : [item.answer];
      return (
        <ul className="grid gap-1.5 text-sm">
          {item.options.map((o) => (
            <li key={o.id} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${picked.includes(o.id) ? "bg-cream font-medium" : "text-ink-mute"}`}>
              <span className="w-4">{picked.includes(o.id) ? (key.includes(o.id) ? "✓" : "✕") : key.includes(o.id) ? "○" : ""}</span>
              {o.media && o.media.kind === "palette" ? <span className="w-24"><MediaView media={o.media} compact /></span> : null}
              {o.label}
            </li>
          ))}
        </ul>
      );
    }
    case "ranking": {
      if (item.type !== "ranking") return null;
      const label = (id: string) => item.options.find((o) => o.id === id)?.label ?? id;
      return (
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-mute">Candidate</p>
            <ol className="grid list-decimal gap-1 pl-5">{response.order.map((id) => <li key={id}>{label(id)}</li>)}</ol>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-mute">Expert key</p>
            <ol className="grid list-decimal gap-1 pl-5 text-ink-soft">{item.answer.map((id) => <li key={id}>{label(id)}</li>)}</ol>
          </div>
        </div>
      );
    }
    case "short_text":
    case "long_text": {
      const fields = item.type === "short_text" && item.fields?.length ? item.fields : [{ id: "main", label: "" }];
      return (
        <div className="grid gap-3">
          {fields.map((f) => (
            <div key={f.id}>
              {f.label && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-mute">{f.label}</p>}
              <p className="whitespace-pre-wrap rounded-lg bg-paper px-4 py-3 font-serif text-lg leading-relaxed">{response.fields[f.id] || <span className="italic text-ink-mute">(blank)</span>}</p>
            </div>
          ))}
        </div>
      );
    }
    case "drawing_canvas":
      return (
        <div className="grid gap-3">
          {response.mode === "photo" || !response.pngDataUrl ? null : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={response.pngDataUrl} alt="Candidate's drawing" className="w-full rounded-lg ring-1 ring-line" />
          )}
          {response.mode === "photo" && <Photos photos={response.photos} />}
          <p className="text-xs text-ink-mute">
            {response.mode === "photo" ? "Drawn on paper, uploaded as a photo." : `${response.strokes.length} vector strokes stored · devices: ${[...new Set(response.strokes.map((s) => s.pointer))].join(", ") || "–"}`}
          </p>
        </div>
      );
    case "photo_upload":
      return <Photos photos={response.photos} />;
    case "layout_drag": {
      if (item.type !== "layout_drag") return null;
      const checks = runLayoutChecks(item, response.placements);
      const s = 0.6;
      return (
        <div className="flex flex-wrap gap-6">
          <div className="relative ring-1 ring-line-strong" style={{ width: item.artboard.width * s, height: item.artboard.height * s, background: item.artboard.background }}>
            {item.blocks.filter((b) => response.placements[b.id]).map((b) => {
              const p = response.placements[b.id];
              return (
                <div key={b.id} className="absolute" style={{ left: p.x * s, top: p.y * s, width: p.w * s, height: p.h * s }}>
                  <BlockFace block={b} w={p.w * s} h={p.h * s} />
                </div>
              );
            })}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-mute">Auto-checks (evidence, not the score)</p>
            <ul className="mt-2 grid gap-1 text-sm">
              {checks.map((c) => (
                <li key={c.id} className={c.pass ? "text-ok" : "text-narangi-ink"}>
                  {c.pass ? "✓" : "✕"} {c.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
    }
    case "portfolio": {
      const links = response.links.filter((l) => l.trim());
      if (!links.length && !response.files.length) return <p className="italic text-ink-mute">No portfolio submitted.</p>;
      return (
        <details className="rounded-xl bg-paper p-4 text-sm">
          <summary className="cursor-pointer font-semibold">
            Portfolio · {links.length} link{links.length === 1 ? "" : "s"}, {response.files.length} file
            {response.files.length === 1 ? "" : "s"} — click to open
          </summary>
          <p className="mt-2 text-xs text-ink-mute">
            Not scored, and hidden by default: a portfolio link usually shows the candidate&apos;s name. For the Stage 3
            conversation, not for blind rating.
          </p>
          <ul className="mt-3 grid gap-1.5">
            {links.map((l) => (
              <li key={l}>
                <a href={l.startsWith("http") ? l : `https://${l}`} target="_blank" rel="noreferrer noopener" className="text-blue underline">
                  🔗 {l}
                </a>
              </li>
            ))}
            {response.files.map((f) => (
              <li key={f.id}>
                <a href={f.dataUrl} download={f.name} className="text-blue underline">
                  {f.type === "application/pdf" ? "📄" : "🖼"} {f.name}
                </a>
              </li>
            ))}
          </ul>
        </details>
      );
    }
    case "allocation": {
      if (item.type !== "allocation") return null;
      const total = Object.values(response.allocations).reduce((a, b) => a + b, 0) || 1;
      return (
        <ul className="grid gap-1.5 text-sm">
          {item.options.map((o) => {
            const v = response.allocations[o.id] ?? 0;
            return (
              <li key={o.id} className="grid grid-cols-[11rem_1fr_4rem] items-center gap-3">
                <span className={v > 0 ? "font-medium" : "text-ink-mute"}>{o.label}</span>
                <span className="h-3 rounded-sm bg-paper">
                  <span className="block h-full rounded-sm bg-[var(--accent)]" style={{ width: `${(v / total) * 100}%` }} />
                </span>
                <span className="tabular-nums text-ink-soft">
                  {v} {item.unit}
                </span>
              </li>
            );
          })}
          <li className="mt-1 text-xs text-ink-mute">Not scored — a signal for clubs, clans and the Stage 3 conversation.</li>
        </ul>
      );
    }
    case "hotspot": {
      if (item.type !== "hotspot") return null;
      const checks = runHotspotChecks(item, response.pins);
      return (
        <div className="grid gap-5 md:grid-cols-[15rem_1fr]">
          <div className="relative overflow-hidden rounded-2xl ring-4 ring-ink">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.image.src} alt={item.image.alt} className="block w-full" />
            {item.zones.map((z) => (
              <span
                key={z.id}
                title={z.label}
                className="absolute rounded border border-dashed border-narangi-ink/70 bg-narangi/10"
                style={{ left: `${z.x}%`, top: `${z.y}%`, width: `${z.w}%`, height: `${z.h}%` }}
              />
            ))}
            {response.pins.map((p, i) => (
              <span
                key={p.id}
                className="absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[var(--accent)] text-xs font-bold text-white ring-2 ring-white"
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
              >
                {i + 1}
              </span>
            ))}
          </div>
          <div className="grid content-start gap-4">
            <ol className="grid gap-2">
              {response.pins.map((p, i) => (
                <li key={p.id} className="flex gap-3 rounded-lg bg-paper px-3 py-2">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--accent)] text-xs font-bold text-white">{i + 1}</span>
                  <span className="font-serif text-lg leading-snug">{p.note || <span className="italic text-ink-mute">(no note)</span>}</span>
                </li>
              ))}
            </ol>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-mute">
                Known problem areas found: {checks.filter((c) => c.found).length} of {checks.length} (evidence, not the score)
              </p>
              <ul className="mt-2 grid gap-1 text-sm">
                {checks.map((c) => (
                  <li key={c.id} className={c.found ? "text-ok" : "text-ink-mute"}>
                    {c.found ? `✓ pin ${c.pins.join(", ")}` : "·"} {c.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      );
    }
    case "interactive_task": {
      if (item.type !== "interactive_task") return null;
      if (item.module === "stroop") {
        const d = response.data as StroopData;
        return d?.summary ? (
          <div>
            <p className="mb-2 text-sm text-ink-soft">Raw log stored for reference ({d.responses.length} trials). Reaction times are never scored.</p>
            <StroopResults summary={d.summary as StroopSummary} />
          </div>
        ) : (
          <p className="text-ink-mute">Not completed.</p>
        );
      }
      const d = response.data as MelaData;
      const cfg = games[item.config] as MelaConfig;
      const s = scoreMela(cfg, program.window.seed, d.decisions, cohort);
      return (
        <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
          <div className="grid content-start gap-2 text-sm">
            <Stat k="Final profit" v={inr(s.profit)} />
            <Stat k="Outcome (percentile)" v={`${Math.round(s.percentile * 100)}th`} />
            <Stat k="Decision quality" v={`${Math.round(s.decision * 100)}%`} />
            <Stat k="Game score (50/50)" v={`${Math.round(s.total * 100)}%`} />
            <p className="text-xs text-ink-mute">Percentile vs a simulated cohort of {cohort.length} (demo). Live: the actual test window.</p>
          </div>
          <ul className="grid content-start gap-1.5 text-sm">
            {s.checks.map((c) => (
              <li key={c.id} className="flex gap-3 rounded-lg bg-paper px-3 py-2">
                <span className={c.pass ? "text-ok" : "text-red"}>{c.pass ? "✓" : "✕"}</span>
                <span>
                  <span className="font-semibold">{c.label}</span> <span className="text-xs text-ink-mute">×{c.weight}</span>
                  <span className="block text-ink-soft">{c.note}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
  }
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg bg-paper px-3 py-2">
      <p className="text-xs text-ink-mute">{k}</p>
      <p className="font-semibold tabular-nums">{v}</p>
    </div>
  );
}

function Photos({ photos }: { photos: { id: string; dataUrl: string; via: string }[] }) {
  if (!photos.length) return <p className="italic text-ink-mute">No photos.</p>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {photos.map((p) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={p.id} src={p.dataUrl} alt="Uploaded work" className="w-full rounded-lg object-cover ring-1 ring-line" />
      ))}
    </div>
  );
}

function RubricPanel({
  rubric,
  ratings,
  onRate,
  flag,
  onFlag,
}: {
  rubric: Rubric;
  ratings: Record<string, number>;
  onRate: (c: string, v: number) => void;
  flag?: string;
  onFlag: (t: string) => void;
}) {
  const levels = Array.from({ length: rubric.scale.max - rubric.scale.min + 1 }, (_, i) => rubric.scale.min + i);
  return (
    <div className="rounded-xl bg-paper p-4 ring-1 ring-line">
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">Rubric · {rubric.title}</p>
      {rubric.note && <p className="mt-1 text-xs text-ink-soft">{rubric.note}</p>}
      <div className="mt-3 grid gap-4">
        {rubric.criteria.map((c) => (
          <fieldset key={c.id}>
            <legend className="text-sm font-semibold">{c.name}</legend>
            <div className="mt-1.5 grid grid-cols-4 gap-1">
              {levels.map((l) => (
                <button
                  key={l}
                  type="button"
                  aria-pressed={ratings[c.id] === l}
                  title={c.descriptors[String(l)]}
                  onClick={() => onRate(c.id, l)}
                  className={`h-9 rounded-md text-sm font-bold ${ratings[c.id] === l ? "bg-[var(--accent)] text-white" : "bg-white ring-1 ring-line hover:ring-line-strong"}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <p className="mt-1 min-h-8 text-xs leading-snug text-ink-soft">
              {ratings[c.id] ? c.descriptors[String(ratings[c.id])] : <span className="text-ink-mute">Hover a score to see its descriptor.</span>}
            </p>
            {c.anchor && <p className="mt-1 rounded bg-white px-2 py-1 text-xs italic text-ink-soft">Anchor: {c.anchor}</p>}
          </fieldset>
        ))}
      </div>
      {rubric.ignore.length > 0 && <p className="mt-3 text-xs text-ink-mute">Do not score: {rubric.ignore.join(" · ")}</p>}
      <label className="mt-3 flex items-center gap-2 text-xs">
        <input type="checkbox" checked={!!flag} onChange={(e) => onFlag(e.target.checked ? "Suspected non-original work" : "")} className="accent-[var(--accent)]" />
        Flag suspected non-original work
      </label>
    </div>
  );
}

function IntegrityPanel({ attempt }: { attempt: Attempt }) {
  const count = (type: string) => attempt.events.filter((e) => e.type === type).length;
  const typing = Object.values(attempt.responses).flatMap((r) => (r.type === "short_text" || r.type === "long_text") && r.typing ? [r.typing] : []);
  const bulk = typing.reduce((a, t) => a + t.bulkInserts, 0);
  return (
    <details className="rounded-xl bg-ink p-5 text-sm text-white">
      <summary className="cursor-pointer font-semibold">Integrity signals · admissions &amp; Stage 3 only</summary>
      <p className="mt-2 text-xs text-white/60">Hidden from first-round evaluators. Signals prompt a human conversation — never an automatic penalty.</p>
      <dl className="mt-3 grid grid-cols-2 gap-2">
        {[
          ["Paste attempts", count("paste_blocked")],
          ["Tab switches", count("tab_hidden")],
          ["Resumes", attempt.resumes],
          ["Went offline", count("offline")],
          ["Bulk text inserts", bulk],
          ["Keystrokes (text)", typing.reduce((a, t) => a + t.keystrokes, 0)],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded-lg bg-white/10 px-3 py-2">
            <dt className="text-xs text-white/60">{k}</dt>
            <dd className="font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
