import { describe, expect, it } from "vitest";
import { loadGameConfig } from "@/content/load";
import {
  demandFor,
  resolveStallAuction,
  sensiblePrice,
  simulate,
  spendFor,
  initialState,
  stallValue,
  validateDay,
} from "@/engine/mela/sim";
import { decisionChecks, percentile, scoreMela, syntheticCohort } from "@/engine/mela/score";
import type { MelaConfig, MelaDecisions } from "@/engine/mela/types";

const cfg = loadGameConfig<MelaConfig>("mela-market.yaml");
const SEED = "window-2026-A";

const thoughtful: MelaDecisions = {
  stall: { location: "food_court", amount: 15000 },
  days: [
    { product: "chai", units: 560, price: 42, promotion: "none" },
    { product: "chai", units: 520, price: 45, promotion: "none" }, // rain: hot chai sells, fewer people
    { product: "chai", units: 560, price: 38, promotion: "banner", midBid: 8000 }, // price cut: match-ish
    { product: "chai", units: 650, price: 42, promotion: "loudspeaker" },
  ],
};

const careless: MelaDecisions = {
  stall: { location: "entrance", amount: 45000 },
  days: [
    { product: "chai", units: 1500, price: 40, promotion: "reel" },
    { product: "chai", units: 1500, price: 40, promotion: "reel" },
    { product: "chai", units: 1500, price: 55, promotion: "reel", midBid: 15000 },
    { product: "chai", units: 3000, price: 15, promotion: "reel" },
  ],
};

describe("Mela Market fairness", () => {
  it("same seed + same decisions ⇒ identical outcomes", () => {
    const a = simulate(cfg, SEED, thoughtful);
    const b = simulate(cfg, SEED, structuredClone(thoughtful));
    expect(a).toEqual(b);
  });

  it("the demand noise does not depend on the candidate's other decisions", () => {
    // Day-3 demand must be the same whatever happened on days 1–2.
    const other: MelaDecisions = {
      ...thoughtful,
      days: [
        { product: "chai", units: 10, price: 90, promotion: "reel" },
        { product: "chai", units: 999, price: 20, promotion: "none" },
        thoughtful.days[2],
      ],
    };
    const a = simulate(cfg, SEED, thoughtful).days[2];
    const b = simulate(cfg, SEED, other).days[2];
    expect(b.demand).toBe(a.demand);
    expect(b.visitors).toBe(a.visitors);
  });

  it("different window seeds produce different noise", () => {
    const a = simulate(cfg, "window-A", thoughtful).days.map((d) => d.demand);
    const b = simulate(cfg, "window-B", thoughtful).days.map((d) => d.demand);
    expect(a).not.toEqual(b);
  });
});

describe("Mela Market mechanics", () => {
  it("resolves the sealed-bid stall auction against fixed bot bids", () => {
    const win = resolveStallAuction(cfg, { location: "food_court", amount: 15000 });
    expect(win).toMatchObject({ location: "food_court", won: true, paid: 15000 });

    const lose = resolveStallAuction(cfg, { location: "food_court", amount: 13000 });
    expect(lose.won).toBe(false);
    expect(lose.location).toBe("back_corner");
    expect(lose.paid).toBe(1500);
    expect(lose.bids.find((b) => b.you)?.amount).toBe(13000);
  });

  it("rejects bids below the reserve price", () => {
    const r = resolveStallAuction(cfg, { location: "back_corner", amount: 100 });
    expect(r.won).toBe(false);
    expect(r.paid).toBe(1500);
  });

  it("perishable stock is lost overnight; non-perishable carries over", () => {
    const s = simulate(cfg, SEED, {
      stall: { location: "back_corner", amount: 1500 },
      days: [
        { product: "chai", units: 5000, price: 40, promotion: "none" },
        { product: "decor", units: 200, price: 400, promotion: "none" },
        { product: "decor", units: 0, price: 400, promotion: "none" },
      ],
    });
    expect(s.days[0].wasted).toBe(5000 - s.days[0].sold);
    expect(s.days[1].carried).toBe(200 - s.days[1].sold);
    expect(s.days[2].stockAvailable).toBe(s.days[1].carried);
  });

  it("higher price lowers demand; promotion raises it", () => {
    const base = { day: 1, locationId: "entrance", productId: "chai", withNoise: false, withEvent: false };
    const cheap = demandFor(cfg, SEED, { ...base, price: 30, promotionId: "none" }).demand;
    const dear = demandFor(cfg, SEED, { ...base, price: 60, promotionId: "none" }).demand;
    const promoted = demandFor(cfg, SEED, { ...base, price: 30, promotionId: "reel" }).demand;
    expect(cheap).toBeGreaterThan(dear);
    expect(promoted).toBeGreaterThan(cheap);
  });

  it("events change demand (rain reduces visitors; the star boosts the rides)", () => {
    const at = (day: number, loc: string, withEvent: boolean) =>
      demandFor(cfg, SEED, { day, locationId: loc, productId: "accessories", price: 199, promotionId: "none", withNoise: false, withEvent });
    expect(at(2, "entrance", true).visitors).toBeLessThan(at(2, "entrance", false).visitors);
    expect(at(4, "rides", true).visitors).toBeGreaterThan(at(4, "rides", false).visitors * 1.8);
  });

  it("applies the supplier discount only when the order is at least double", () => {
    const state = simulate(cfg, SEED, { ...thoughtful, days: thoughtful.days.slice(0, 3) });
    const small = spendFor(cfg, state, { product: "chai", units: 600, price: 40, promotion: "none" }, 4);
    const big = spendFor(cfg, state, { product: "chai", units: 1120, price: 40, promotion: "none" }, 4);
    expect(small.discountApplied).toBe(false);
    expect(big.discountApplied).toBe(true);
    expect(big.unitCost).toBeCloseTo(18 * 0.85);
  });

  it("validates cash, price range and the one-switch limit", () => {
    const s0 = { ...initialState(cfg), cash: 1000 };
    expect(validateDay(cfg, s0, { product: "decor", units: 100, price: 400, promotion: "none" })[0]).toMatch(/costs/);
    expect(validateDay(cfg, initialState(cfg), { product: "chai", units: 10, price: 5, promotion: "none" })[0]).toMatch(/between/);
    const switched = simulate(cfg, SEED, {
      stall: { location: "back_corner", amount: 1500 },
      days: [
        { product: "chai", units: 100, price: 40, promotion: "none" },
        { product: "decor", units: 10, price: 400, promotion: "none" },
      ],
    });
    expect(validateDay(cfg, switched, { product: "chai", units: 10, price: 40, promotion: "none" })).toContain(
      "You have already used your one product switch.",
    );
  });

  it("wins the water-rights auction only by beating the top bot bid", () => {
    const won = simulate(cfg, SEED, thoughtful);
    expect(won.days[2].midWon).toBe(true);
    expect(won.days[2].midBonus + won.days[3].midBonus).toBe(9000);
    const lost = simulate(cfg, SEED, {
      ...thoughtful,
      days: thoughtful.days.map((d, i) => (i === 2 ? { ...d, midBid: 7000 } : d)),
    });
    expect(lost.midWon).toBe(false);
  });
});

describe("Mela Market scoring", () => {
  const cohort = syntheticCohort(cfg, SEED);

  it("the synthetic cohort is deterministic", () => {
    expect(syntheticCohort(cfg, SEED)).toEqual(cohort);
  });

  it("stall value is positive for contested spots and the reserve for the fallback", () => {
    expect(stallValue(cfg, "food_court")).toBeGreaterThan(14000);
    expect(stallValue(cfg, "back_corner")).toBe(1500);
  });

  it("a thoughtful player beats a careless one on both halves of the score", () => {
    const good = scoreMela(cfg, SEED, thoughtful, cohort);
    const bad = scoreMela(cfg, SEED, careless, cohort);
    expect(good.profit).toBeGreaterThan(bad.profit);
    expect(good.decision).toBeGreaterThan(bad.decision);
    expect(good.total).toBeGreaterThan(0.6);
    expect(bad.total).toBeLessThan(0.3);
  });

  it("flags the specific poor decisions", () => {
    const state = simulate(cfg, SEED, careless);
    const failed = decisionChecks(cfg, careless, state)
      .filter((c) => !c.pass)
      .map((c) => c.id);
    expect(failed).toEqual(
      expect.arrayContaining(["stall_bid", "rain_adjust", "perishable_waste", "competitor_response", "margin_discipline", "mid_bid"]),
    );
  });

  it("percentile handles ties and bounds", () => {
    expect(percentile([1, 2, 3, 4], 0)).toBe(0);
    expect(percentile([1, 2, 3, 4], 10)).toBe(1);
    expect(percentile([1, 2, 2, 4], 2)).toBe(0.5);
  });

  it("sensible price sits above unit cost", () => {
    for (const p of cfg.products) expect(sensiblePrice(p)).toBeGreaterThan(p.unit_cost);
  });
});
