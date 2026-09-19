import { describe, expect, it } from "vitest";
import { loadGameConfig, loadPrograms, loadRubrics } from "@/content/load";
import { buildPaper } from "@/engine/paper";
import { rng, shuffle } from "@/engine/prng";
import { generateTrials, summarise, type StroopConfig } from "@/engine/stroop";
import { crossedWarnings, formatClock, isExpired, remainingMs } from "@/engine/timer";

describe("content", () => {
  it("every program file validates and references known rubrics", () => {
    const programs = loadPrograms();
    const rubrics = loadRubrics();
    expect(programs.map((p) => p.id)).toEqual(["bdes", "bpsych", "bbae"]);
    for (const p of programs) {
      const paper = buildPaper(p, "check");
      for (const s of paper.sections)
        for (const { item } of s.items)
          if (item.rubric_id) expect(rubrics[item.rubric_id], `${item.id} → ${item.rubric_id}`).toBeDefined();
    }
  });

  it("section weights add up to 100 for each program", () => {
    for (const p of loadPrograms()) {
      expect(p.sections.reduce((a, s) => a + s.weight, 0), p.id).toBe(100);
    }
  });
});

describe("paper randomisation", () => {
  const [bdes] = loadPrograms();
  it("same seed ⇒ same paper", () => {
    expect(buildPaper(bdes, "cand-1")).toEqual(buildPaper(bdes, "cand-1"));
  });
  it("different seeds draw different pool items across a cohort", () => {
    const d2 = new Set(
      Array.from({ length: 30 }, (_, i) => buildPaper(bdes, `cand-${i}`).sections.find((s) => s.id === "D2")!.items[0].item.id),
    );
    expect(d2.size).toBeGreaterThan(1);
  });
  it("shuffle is deterministic and a permutation", () => {
    const a = shuffle([1, 2, 3, 4, 5], rng("x"));
    expect(shuffle([1, 2, 3, 4, 5], rng("x"))).toEqual(a);
    expect([...a].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("section timer", () => {
  const t0 = 1_000_000;
  it("counts down from the stored start time and survives reloads", () => {
    const clock = { startedAt: t0, closedAt: null, extraMs: 0 };
    expect(remainingMs(clock, 25, t0 + 60_000)).toBe(24 * 60_000);
    // A "reload" is just recomputing from the same stored clock.
    expect(remainingMs({ ...clock }, 25, t0 + 60_000)).toBe(24 * 60_000);
  });
  it("adds accommodation time and never goes negative", () => {
    const clock = { startedAt: t0, closedAt: null, extraMs: 5 * 60_000 };
    expect(remainingMs(clock, 10, t0 + 12 * 60_000)).toBe(3 * 60_000);
    expect(remainingMs(clock, 10, t0 + 99 * 60_000)).toBe(0);
    expect(isExpired(clock, 10, t0 + 15 * 60_000)).toBe(true);
  });
  it("freezes once the section is closed", () => {
    const clock = { startedAt: t0, closedAt: t0 + 60_000, extraMs: 0 };
    expect(remainingMs(clock, 5, t0 + 10 * 60_000)).toBe(4 * 60_000);
  });
  it("untimed sections have no clock", () => {
    expect(remainingMs({ startedAt: t0, closedAt: null, extraMs: 0 }, null, t0)).toBeNull();
  });
  it("fires the 5- and 1-minute warnings once each", () => {
    expect(crossedWarnings(301_000, 299_000)).toEqual([300_000]);
    expect(crossedWarnings(299_000, 298_000)).toEqual([]);
    expect(crossedWarnings(61_000, 59_000)).toEqual([60_000]);
    expect(crossedWarnings(400_000, 30_000)).toEqual([300_000, 60_000]);
  });
  it("formats clocks", () => {
    expect(formatClock(25 * 60_000)).toBe("25:00");
    expect(formatClock(59_001)).toBe("1:00");
    expect(formatClock(3_725_000)).toBe("1:02:05");
  });
});

describe("stroop", () => {
  const cfg = loadGameConfig<StroopConfig>("stroop.yaml");
  it("generates reproducible trials with the configured congruent ratio", () => {
    const a = generateTrials(cfg, "s1", 60);
    expect(generateTrials(cfg, "s1", 60)).toEqual(a);
    const congruent = a.filter((t) => t.congruent).length;
    expect(congruent).toBe(Math.round(60 * cfg.congruent_ratio));
    for (const t of a) expect(t.congruent).toBe(t.word === t.ink);
    for (let i = 1; i < a.length; i++) expect(a[i].word + a[i].ink).not.toBe(a[i - 1].word + a[i - 1].ink);
  });
  it("summarises matched vs mismatched reaction times from correct trials", () => {
    const trials = generateTrials(cfg, "s2", 4).map((t, i) => ({ ...t, congruent: i < 2 }));
    const s = summarise(trials, [
      { index: 0, answer: "x", correct: true, rtMs: 500 },
      { index: 1, answer: "x", correct: true, rtMs: 600 },
      { index: 2, answer: "x", correct: true, rtMs: 800 },
      { index: 3, answer: "x", correct: false, rtMs: 300 },
    ]);
    expect(s.congruent.meanRt).toBe(550);
    expect(s.incongruent.meanRt).toBe(800);
    expect(s.incongruent.accuracy).toBe(0.5);
    expect(s.interferenceMs).toBe(250);
  });
});
