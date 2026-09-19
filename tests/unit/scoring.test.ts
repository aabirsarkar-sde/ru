import { describe, expect, it } from "vitest";
import type { Item, Rubric } from "@/content/schema";
import {
  composite,
  maxRankingDistance,
  rankingDistance,
  rubricFraction,
  runHotspotChecks,
  runLayoutChecks,
  scoreItem,
  scoreMcqMulti,
  scoreRanking,
  scoreSection,
} from "@/engine/scoring";

describe("mcq", () => {
  it("multi: proportional credit, wrong picks subtract, floored at zero", () => {
    expect(scoreMcqMulti(["a", "b"], ["a", "b"], 2, "proportional")).toBe(2);
    expect(scoreMcqMulti(["a", "b"], ["a"], 2, "proportional")).toBe(1);
    expect(scoreMcqMulti(["a", "b"], ["a", "c"], 2, "proportional")).toBe(0);
    expect(scoreMcqMulti(["a", "b"], ["a", "b", "c", "d"], 2, "proportional")).toBe(0);
    expect(scoreMcqMulti(["a", "b"], ["c"], 2, "proportional")).toBe(0);
  });

  it("multi: all-or-nothing", () => {
    expect(scoreMcqMulti(["a", "b"], ["b", "a"], 3, "all_or_nothing")).toBe(3);
    expect(scoreMcqMulti(["a", "b"], ["a"], 3, "all_or_nothing")).toBe(0);
  });
});

describe("ranking distance", () => {
  const key = ["a", "b", "c", "d"];
  it("identical order is full marks", () => {
    expect(rankingDistance(key, key)).toBe(0);
    expect(scoreRanking(key, key, 4)).toBe(4);
  });
  it("full reversal is zero", () => {
    expect(rankingDistance(key, [...key].reverse())).toBe(maxRankingDistance(4));
    expect(scoreRanking(key, [...key].reverse(), 4)).toBe(0);
  });
  it("one adjacent swap loses a little", () => {
    expect(rankingDistance(key, ["b", "a", "c", "d"])).toBe(2);
    expect(scoreRanking(key, ["b", "a", "c", "d"], 4)).toBe(3);
  });
  it("an untouched ranking scores zero rather than the default order", () => {
    const item = { id: "r", type: "ranking", prompt: "", options: [], answer: key, max_score: 4, scored: true } as unknown as Item;
    expect(scoreItem(item, { type: "ranking", order: key, touched: false })).toEqual({ status: "auto", max: 4, earned: 0 });
  });
});

describe("rubrics and composites", () => {
  const rubric: Rubric = {
    id: "x",
    title: "x",
    scale: { min: 1, max: 4 },
    criteria: [
      { id: "a", name: "A", descriptors: {} },
      { id: "b", name: "B", descriptors: {} },
    ],
    ignore: [],
  };

  it("maps the 1–4 scale onto 0..1", () => {
    expect(rubricFraction(rubric, { a: 1, b: 1 })).toBe(0);
    expect(rubricFraction(rubric, { a: 4, b: 4 })).toBe(1);
    expect(rubricFraction(rubric, { a: 2, b: 3 })).toBe(0.5);
  });

  it("section tracks pending rubric marks separately", () => {
    const s = scoreSection("S", 20, [
      { status: "auto", earned: 3, max: 4 },
      { status: "rubric", max: 5 },
    ]);
    expect(s).toMatchObject({ earned: 3, max: 4, pendingMax: 5, pct: 0.75 });
  });

  it("composite weights sections and reports completeness", () => {
    const c = composite([
      { sectionId: "A", weight: 25, earned: 1, max: 1, pendingMax: 0, pct: 1 },
      { sectionId: "B", weight: 75, earned: 0, max: 1, pendingMax: 0, pct: 0 },
      { sectionId: "C", weight: 10, earned: 0, max: 0, pendingMax: 4, pct: null },
    ]);
    expect(c.score).toBe(25);
    expect(c.complete).toBe(false);
  });
});

describe("layout auto-checks", () => {
  const item = {
    id: "poster",
    type: "layout_drag",
    artboard: { width: 300, height: 450 },
    blocks: [
      { id: "date", kind: "date", width: 100, height: 40 },
      { id: "headline", kind: "headline", width: 200, height: 60 },
    ],
    auto_checks: [
      { id: "top", label: "Date in top third", rule: "in_top_third", block: "date" },
      { id: "big", label: "Date is largest text", rule: "largest_text", block: "date" },
      { id: "ovl", label: "No overlaps", rule: "no_overlap" },
      { id: "in", label: "Inside", rule: "inside_artboard" },
    ],
  } as unknown as Extract<Item, { type: "layout_drag" }>;

  it("evaluates each rule", () => {
    const res = runLayoutChecks(item, {
      date: { x: 20, y: 20, w: 260, h: 90 },
      headline: { x: 20, y: 200, w: 200, h: 60 },
    });
    expect(res.map((r) => r.pass)).toEqual([true, true, true, true]);

    const bad = runLayoutChecks(item, {
      date: { x: 20, y: 380, w: 60, h: 20 },
      headline: { x: 10, y: 370, w: 400, h: 60 },
    });
    expect(bad.map((r) => r.pass)).toEqual([false, false, false, false]);
  });
});

describe("hotspot evidence", () => {
  const item = {
    id: "h",
    type: "hotspot",
    zones: [
      { id: "banner", label: "Banner", x: 5, y: 18, w: 90, h: 17 },
      { id: "nav", label: "Nav", x: 0, y: 91, w: 100, h: 9 },
    ],
  } as unknown as Extract<Item, { type: "hotspot" }>;

  it("reports which zones the pins landed in, with pin numbers", () => {
    const res = runHotspotChecks(item, [
      { id: "p1", x: 50, y: 25, note: "" },
      { id: "p2", x: 50, y: 60, note: "" },
      { id: "p3", x: 10, y: 95, note: "" },
    ]);
    expect(res).toEqual([
      { id: "banner", label: "Banner", found: true, pins: [1] },
      { id: "nav", label: "Nav", found: true, pins: [3] },
    ]);
  });

  it("allows a small tolerance at zone edges, but not beyond", () => {
    expect(runHotspotChecks(item, [{ id: "p1", x: 50, y: 16.5, note: "" }])[0].found).toBe(true);
    expect(runHotspotChecks(item, [{ id: "p1", x: 50, y: 14, note: "" }])[0].found).toBe(false);
  });

  it("hotspot items wait for a rubric rather than auto-scoring", () => {
    const h = { ...item, scored: true, max_score: 4, rubric_id: "r" } as unknown as Item;
    expect(scoreItem(h, { type: "hotspot", pins: [] })).toEqual({ status: "rubric", max: 4, rubricId: "r" });
  });
});
