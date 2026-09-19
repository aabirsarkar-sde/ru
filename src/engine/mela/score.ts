// Mela Market scoring (PRD §7.3, B3):
//   50% outcome  — final profit percentile within the test window
//   50% decision — auto-computed checks over the decision log
// Weights, tolerances and check list are in mela-market.yaml.
import { between, rng } from "../prng";
import {
  demandFor,
  eventsFor,
  midAuctionValue,
  product,
  sensiblePrice,
  simulate,
  stallValue,
} from "./sim";
import type { DayDecision, GameState, MelaConfig, MelaDecisions } from "./types";

export interface CheckResult {
  id: string;
  label: string;
  weight: number;
  pass: boolean;
  /** Plain-language evidence shown to evaluators / Stage 3 panels. */
  note: string;
}

export function decisionChecks(cfg: MelaConfig, decisions: MelaDecisions, state: GameState): CheckResult[] {
  const s = cfg.scoring;
  const out: Record<string, { pass: boolean; note: string }> = {};
  const dayOf = (id: string) => cfg.events.find((e) => e.id === id)?.day;

  // 1. Stall bid within expected value.
  if (decisions.stall) {
    const ev = stallValue(cfg, decisions.stall.location);
    const pass = decisions.stall.amount <= ev * (1 + s.bid_tolerance);
    out.stall_bid = {
      pass,
      note: `Bid ₹${inr(decisions.stall.amount)} for a spot worth about ₹${inr(ev)} on forecast.`,
    };
  }

  // 2. Adjusted price or stock after the rain event.
  const rainDay = dayOf("rain");
  if (rainDay && state.days[rainDay - 1] && state.days[rainDay - 2]) {
    const today = decisions.days[rainDay - 1];
    const prev = decisions.days[rainDay - 2];
    const changed = (a: number, b: number) => Math.abs(a - b) / Math.max(1, b) >= s.adjust_threshold;
    const pass = today.product !== prev.product || changed(today.price, prev.price) || changed(today.units, prev.units);
    out.rain_adjust = {
      pass,
      note: pass
        ? `Changed plan on the rain day (stock ${prev.units}→${today.units}, price ₹${prev.price}→₹${today.price}).`
        : "Kept the same stock and price despite the rain forecast.",
    };
  }

  // 3. Avoided overbuying perishables.
  const perishDays = state.days.filter((d) => product(cfg, d.product).perishable);
  if (perishDays.length) {
    const bought = perishDays.reduce((a, d) => a + d.bought, 0);
    const wasted = perishDays.reduce((a, d) => a + d.wasted, 0);
    const rate = bought ? wasted / bought : 0;
    out.perishable_waste = {
      pass: rate <= s.waste_tolerance,
      note: `Threw away ${wasted} of ${bought} perishable units (${Math.round(rate * 100)}%).`,
    };
  } else {
    out.perishable_waste = { pass: true, note: "Sold only non-perishable goods." };
  }

  // 4. Sensible response to the competitor's price cut.
  const cutDay = cfg.events.find((e) => e.competitor_price_mult && e.competitor_price_mult < 1)?.day;
  if (cutDay && decisions.days[cutDay - 1] && decisions.days[cutDay - 2]) {
    const today = decisions.days[cutDay - 1];
    const prev = decisions.days[cutDay - 2];
    const prod = product(cfg, today.product);
    const switched = today.product !== prev.product;
    const raised = !switched && today.price > prev.price;
    const belowCost = today.price < prod.unit_cost;
    const pass = !raised && !belowCost;
    out.competitor_response = {
      pass,
      note: switched
        ? "Switched product when the neighbour cut prices."
        : belowCost
          ? `Cut price to ₹${today.price}, below the ₹${prod.unit_cost} unit cost.`
          : raised
            ? `Raised price ₹${prev.price}→₹${today.price} into a price war.`
            : `Responded with ₹${today.price} (was ₹${prev.price})${today.promotion !== "none" ? " plus a promotion" : ""}.`,
    };
  }

  // 5. Never sold below unit cost.
  const below = decisions.days.filter((d) => d.price < product(cfg, d.product).unit_cost);
  out.margin_discipline = {
    pass: below.length === 0,
    note: below.length ? `Priced below cost on ${below.length} day(s).` : "Always priced above unit cost.",
  };

  // 6. Mid-game auction bid within value.
  const midDay = cfg.mid_auction.day;
  const midDec = decisions.days[midDay - 1];
  if (midDec) {
    const value = midAuctionValue(cfg);
    const bid = midDec.midBid ?? 0;
    out.mid_bid = {
      pass: bid <= value * (1 + s.bid_tolerance),
      note: bid ? `Bid ₹${inr(bid)} for rights worth about ₹${inr(value)}.` : "Chose not to bid.",
    };
  }

  // 7. Supplier offer: did a perishable seller take a bulk deal they couldn't sell?
  const offerDay = cfg.events.find((e) => e.supplier_offer)?.day;
  const offerResult = offerDay ? state.days[offerDay - 1] : undefined;
  if (offerResult) {
    const perishable = product(cfg, offerResult.product).perishable;
    const pass = !(offerResult.discountApplied && perishable && offerResult.wasted > offerResult.bought * s.waste_tolerance);
    out.supplier_offer = {
      pass,
      note: offerResult.discountApplied
        ? `Took the bulk discount; ${offerResult.wasted} units went unsold${perishable ? " and spoiled" : ""}.`
        : "Declined the bulk discount.",
    };
  }

  return cfg.scoring.checks
    .filter((c) => out[c.id])
    .map((c) => ({ id: c.id, label: c.label, weight: c.weight, ...out[c.id] }));
}

export function decisionQuality(checks: CheckResult[]): number {
  const total = checks.reduce((a, c) => a + c.weight, 0);
  return total ? checks.filter((c) => c.pass).reduce((a, c) => a + c.weight, 0) / total : 0;
}

/* ------------------------------------------------------------ cohort / pct -- */

/**
 * Stand-in for "everyone else in this test window". In production the
 * percentile is computed across real submitted attempts; for the demo we
 * simulate a deterministic cohort of varied-but-plausible players.
 */
export function syntheticCohort(cfg: MelaConfig, seed: string, n = cfg.scoring.cohort_size): number[] {
  const profits: number[] = [];
  for (let i = 0; i < n; i++) {
    const r = rng(seed, "cohort", i);
    const loc = cfg.locations[Math.floor(r() * cfg.locations.length)];
    const bid = Math.round(between(r, 0.4, 1.5) * Math.max(loc.reserve, stallValue(cfg, loc.id)));
    let prod = cfg.products[Math.floor(r() * cfg.products.length)];
    const switchDay = r() < 0.3 ? 2 + Math.floor(r() * (cfg.days - 1)) : -1;
    const days: DayDecision[] = [];
    for (let day = 1; day <= cfg.days; day++) {
      if (day === switchDay) prod = cfg.products[Math.floor(r() * cfg.products.length)];
      const price = Math.round(sensiblePrice(prod) * between(r, 0.8, 1.25));
      const hasNews = eventsFor(cfg, day).length > 0;
      const expected = demandFor(cfg, seed, {
        day,
        locationId: loc.id,
        productId: prod.id,
        price,
        promotionId: "none",
        withNoise: false,
        withEvent: r() < 0.5 && hasNews, // half of players react to the day's news
      }).demand;
      const promo = r() < 0.55 ? cfg.promotions[0] : cfg.promotions[Math.floor(r() * cfg.promotions.length)];
      days.push({
        product: prod.id,
        price: Math.min(prod.max_price, Math.max(prod.min_price, price)),
        units: Math.max(0, Math.round(expected * between(r, 0.6, 1.4))),
        promotion: promo.id,
        midBid: day === cfg.mid_auction.day && r() < 0.5 ? Math.round(between(r, 0.3, 1.4) * midAuctionValue(cfg)) : 0,
      });
    }
    profits.push(simulate(cfg, seed, { stall: { location: loc.id, amount: bid }, days }).finalProfit);
  }
  return profits.sort((a, b) => a - b);
}

export function percentile(sortedCohort: number[], value: number): number {
  if (!sortedCohort.length) return 0.5;
  let below = 0;
  let equal = 0;
  for (const v of sortedCohort) {
    if (v < value) below++;
    else if (v === value) equal++;
  }
  return (below + equal / 2) / sortedCohort.length;
}

export interface MelaScore {
  profit: number;
  percentile: number;
  outcome: number;
  decision: number;
  checks: CheckResult[];
  /** 0..1 */
  total: number;
}

export function scoreMela(cfg: MelaConfig, seed: string, decisions: MelaDecisions, cohort?: number[]): MelaScore {
  const state = simulate(cfg, seed, decisions);
  const checks = decisionChecks(cfg, decisions, state);
  const decision = decisionQuality(checks);
  const pct = percentile(cohort ?? syntheticCohort(cfg, seed), state.finalProfit);
  const { outcome_weight: ow, decision_weight: dw } = cfg.scoring;
  return {
    profit: state.finalProfit,
    percentile: pct,
    outcome: pct,
    decision,
    checks,
    total: (ow * pct + dw * decision) / (ow + dw),
  };
}

const inr = (n: number) => Math.round(n).toLocaleString("en-IN");
