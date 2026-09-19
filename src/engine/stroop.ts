// Stroop task core: trial generation + summary. No UI, no timers.
// Reaction times are stored for reference and shown back to the candidate;
// they are NEVER scored (PRD §7.2, P3).
import { rng, shuffle } from "./prng";

export interface StroopColour {
  id: string;
  word: string;
  hex: string;
  key: string; // keyboard shortcut
}

export interface StroopConfig {
  colours: StroopColour[];
  duration_s: number;
  max_trials: number;
  congruent_ratio: number;
  practice_trials: number;
  fixation_ms: number;
}

export interface StroopTrial {
  index: number;
  word: string; // colour id used as the printed word
  ink: string; // colour id used for the ink
  congruent: boolean;
}

export interface StroopResponse {
  index: number;
  answer: string;
  correct: boolean;
  rtMs: number;
}

export function generateTrials(cfg: StroopConfig, seed: string, count = cfg.max_trials): StroopTrial[] {
  const rand = rng(seed, "stroop");
  const ids = cfg.colours.map((c) => c.id);
  const nCongruent = Math.round(count * cfg.congruent_ratio);
  const kinds = shuffle(
    Array.from({ length: count }, (_, i) => i < nCongruent),
    rand,
  );

  const trials: StroopTrial[] = [];
  let prev: StroopTrial | undefined;
  for (let i = 0; i < count; i++) {
    const congruent = kinds[i];
    let ink: string;
    let word: string;
    // Avoid repeating the exact same stimulus back to back.
    do {
      ink = ids[Math.floor(rand() * ids.length)];
      if (congruent) word = ink;
      else {
        const others = ids.filter((id) => id !== ink);
        word = others[Math.floor(rand() * others.length)];
      }
    } while (prev && prev.ink === ink && prev.word === word);
    prev = { index: i, word, ink, congruent };
    trials.push(prev);
  }
  return trials;
}

export interface ConditionSummary {
  n: number;
  correct: number;
  accuracy: number;
  meanRt: number | null;
  medianRt: number | null;
}

export interface StroopSummary {
  congruent: ConditionSummary;
  incongruent: ConditionSummary;
  /** Mean incongruent RT − mean congruent RT (correct trials only). */
  interferenceMs: number | null;
}

export function summarise(trials: StroopTrial[], responses: StroopResponse[]): StroopSummary {
  const byIndex = new Map(trials.map((t) => [t.index, t]));
  const bucket = (congruent: boolean): ConditionSummary => {
    const rs = responses.filter((r) => byIndex.get(r.index)?.congruent === congruent);
    const correct = rs.filter((r) => r.correct);
    const rts = correct.map((r) => r.rtMs).sort((a, b) => a - b);
    return {
      n: rs.length,
      correct: correct.length,
      accuracy: rs.length ? correct.length / rs.length : 0,
      meanRt: rts.length ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length) : null,
      medianRt: rts.length ? rts[Math.floor(rts.length / 2)] : null,
    };
  };
  const congruent = bucket(true);
  const incongruent = bucket(false);
  return {
    congruent,
    incongruent,
    interferenceMs:
      congruent.meanRt != null && incongruent.meanRt != null ? incongruent.meanRt - congruent.meanRt : null,
  };
}
