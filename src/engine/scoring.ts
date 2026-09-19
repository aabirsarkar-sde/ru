// Scoring. Pure functions only: given content + responses, produce numbers.
import type { Item, Program, Rubric } from "@/content/schema";
import type { Paper } from "./paper";
import type { Pin, Placement, Response } from "./responses";

export type ItemScore =
  | { status: "auto"; earned: number; max: number; detail?: string }
  | { status: "rubric"; max: number; rubricId?: string } // awaiting evaluators
  | { status: "rated"; earned: number; max: number }
  | { status: "unscored" };

/* ------------------------------------------------------------ primitives -- */

export function scoreMcqSingle(answer: string, choice: string | null, max: number): number {
  return choice === answer ? max : 0;
}

/**
 * Proportional: (correct picks − wrong picks) / number of correct options,
 * floored at zero, so ticking everything never beats thinking.
 */
export function scoreMcqMulti(
  answer: readonly string[],
  choices: readonly string[],
  max: number,
  mode: "proportional" | "all_or_nothing",
): number {
  const key = new Set(answer);
  const picked = new Set(choices);
  if (mode === "all_or_nothing") {
    const exact = key.size === picked.size && [...key].every((k) => picked.has(k));
    return exact ? max : 0;
  }
  let hits = 0;
  let misses = 0;
  for (const c of picked) (key.has(c) ? hits++ : misses++);
  return Math.max(0, (hits - misses) / key.size) * max;
}

/**
 * Ranking distance (Spearman footrule): sum of |position difference| per
 * option, normalised by the worst possible distance (a full reversal).
 * Identical order ⇒ full marks; reversed order ⇒ zero.
 */
export function rankingDistance(key: readonly string[], order: readonly string[]): number {
  const pos = new Map(order.map((id, i) => [id, i]));
  return key.reduce((sum, id, i) => sum + Math.abs(i - (pos.get(id) ?? i)), 0);
}

export function maxRankingDistance(n: number): number {
  return Math.floor((n * n) / 2);
}

export function scoreRanking(key: readonly string[], order: readonly string[], max: number): number {
  const worst = maxRankingDistance(key.length);
  if (worst === 0) return max;
  return round2(max * (1 - rankingDistance(key, order) / worst));
}

/* ---------------------------------------------------------- layout checks -- */

export interface LayoutCheckResult {
  id: string;
  label: string;
  pass: boolean;
}

export function runLayoutChecks(
  item: Extract<Item, { type: "layout_drag" }>,
  placements: Record<string, Placement>,
): LayoutCheckResult[] {
  const { width, height } = item.artboard;
  const overlap = (a: Placement, b: Placement) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const textKinds = new Set(["headline", "text", "date"]);

  return item.auto_checks.map((check) => {
    const p = check.block ? placements[check.block] : undefined;
    let pass = false;
    switch (check.rule) {
      case "placed":
        pass = !!p;
        break;
      case "in_top_third":
        pass = !!p && p.y + p.h / 2 <= height / 3;
        break;
      case "inside_artboard":
        pass = Object.values(placements).every(
          (q) => q.x >= 0 && q.y >= 0 && q.x + q.w <= width && q.y + q.h <= height,
        );
        break;
      case "no_overlap": {
        const ids = Object.keys(placements);
        pass = ids.every((a, i) => ids.slice(i + 1).every((b) => !overlap(placements[a], placements[b])));
        break;
      }
      case "largest_text": {
        if (!p) break;
        const area = (q: Placement) => q.w * q.h;
        const others = item.blocks
          .filter((b) => textKinds.has(b.kind) && b.id !== check.block && placements[b.id])
          .map((b) => area(placements[b.id]));
        pass = others.every((a) => area(p) >= a);
        break;
      }
    }
    return { id: check.id, label: check.label, pass };
  });
}

/* --------------------------------------------------------- hotspot checks -- */

/**
 * Which known problem zones the candidate's pins landed in (with a small
 * tolerance, since a pin marks a point). Evidence for evaluators, not a score.
 */
export function runHotspotChecks(
  item: Extract<Item, { type: "hotspot" }>,
  pins: readonly Pin[],
  tolerance = 2,
): { id: string; label: string; found: boolean; pins: number[] }[] {
  return item.zones.map((z) => {
    const hits = pins
      .map((p, i) => ({ p, i }))
      .filter(
        ({ p }) =>
          p.x >= z.x - tolerance && p.x <= z.x + z.w + tolerance && p.y >= z.y - tolerance && p.y <= z.y + z.h + tolerance,
      )
      .map(({ i }) => i + 1);
    return { id: z.id, label: z.label, found: hits.length > 0, pins: hits };
  });
}

/* ------------------------------------------------------------ item level -- */

export type ModuleScorer = (item: Extract<Item, { type: "interactive_task" }>, data: unknown) => number | null;

export function scoreItem(
  item: Item,
  response: Response | undefined,
  opts: { rubricScores?: Record<string, number>; rubric?: Rubric; moduleScorer?: ModuleScorer } = {},
): ItemScore {
  if (!item.scored) return { status: "unscored" };
  const max = item.max_score;

  switch (item.type) {
    case "mcq_single":
      return {
        status: "auto",
        max,
        earned: scoreMcqSingle(item.answer, response?.type === "mcq_single" ? response.choice : null, max),
      };
    case "mcq_multi":
      return {
        status: "auto",
        max,
        earned: round2(
          scoreMcqMulti(item.answer, response?.type === "mcq_multi" ? response.choices : [], max, item.partial),
        ),
      };
    case "ranking":
      // An untouched list is treated as "no answer", not as the default order.
      if (response?.type !== "ranking" || !response.touched) return { status: "auto", max, earned: 0 };
      return { status: "auto", max, earned: scoreRanking(item.answer, response.order, max) };
    case "interactive_task": {
      if (!opts.moduleScorer) return { status: "rubric", max };
      const data = response?.type === "interactive_task" ? response.data : null;
      const s = data ? opts.moduleScorer(item, data) : 0;
      return s == null ? { status: "unscored" } : { status: "auto", max, earned: round2(s * max) };
    }
    default: {
      if (opts.rubricScores && opts.rubric) {
        return { status: "rated", max, earned: round2(rubricFraction(opts.rubric, opts.rubricScores) * max) };
      }
      return { status: "rubric", max, rubricId: item.rubric_id };
    }
  }
}

/** Mean criterion score mapped onto 0..1 using the rubric's own scale. */
export function rubricFraction(rubric: Rubric, scores: Record<string, number>): number {
  const vals = rubric.criteria.map((c) => scores[c.id]).filter((v): v is number => typeof v === "number");
  if (!vals.length) return 0;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  return (mean - rubric.scale.min) / (rubric.scale.max - rubric.scale.min);
}

/* ------------------------------------------------------- section / total -- */

export interface SectionResult {
  sectionId: string;
  weight: number;
  earned: number;
  max: number;
  /** Max marks still waiting on evaluators. */
  pendingMax: number;
  pct: number | null;
}

export function scoreSection(sectionId: string, weight: number, itemScores: ItemScore[]): SectionResult {
  let earned = 0;
  let max = 0;
  let pendingMax = 0;
  for (const s of itemScores) {
    if (s.status === "auto" || s.status === "rated") {
      earned += s.earned;
      max += s.max;
    } else if (s.status === "rubric") {
      pendingMax += s.max;
    }
  }
  return { sectionId, weight, earned: round2(earned), max, pendingMax, pct: max > 0 ? earned / max : null };
}

/**
 * Weighted composite across sections that have at least some scored marks.
 * `complete` is false while any rubric marks are outstanding.
 */
export function composite(results: SectionResult[]): { score: number | null; complete: boolean; coveredWeight: number } {
  let num = 0;
  let den = 0;
  for (const r of results) {
    if (r.weight <= 0 || r.pct == null) continue;
    num += r.weight * r.pct;
    den += r.weight;
  }
  return {
    score: den > 0 ? round2((num / den) * 100) : null,
    complete: results.every((r) => r.pendingMax === 0),
    coveredWeight: den,
  };
}

export function scorePaper(
  program: Program,
  paper: Paper,
  responses: Record<string, Response>,
  opts: {
    rubrics?: Record<string, Rubric>;
    ratings?: Record<string, Record<string, number>>;
    moduleScorer?: ModuleScorer;
  } = {},
) {
  const perItem: Record<string, ItemScore> = {};
  const bySection = new Map<string, ItemScore[]>(program.sections.map((s) => [s.id, []]));
  for (const ps of paper.sections) {
    for (const { item } of ps.items) {
      const rubric = item.rubric_id ? opts.rubrics?.[item.rubric_id] : undefined;
      const ratings = opts.ratings?.[item.id];
      const s = scoreItem(item, responses[item.id], {
        rubric,
        rubricScores: ratings && Object.keys(ratings).length ? ratings : undefined,
        moduleScorer: opts.moduleScorer,
      });
      perItem[item.id] = s;
      bySection.get(item.counts_toward ?? ps.id)?.push(s);
    }
  }
  const sections = program.sections.map((def) => scoreSection(def.id, def.weight, bySection.get(def.id) ?? []));
  return { perItem, sections, composite: composite(sections) };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
