// Mela Market simulation core. Pure and deterministic:
//   simulate(config, windowSeed, decisions) → GameState
// Same seed + same decisions ⇒ identical outcomes, for every candidate in a
// test window. Random noise is keyed only by (seed, day, location), never by
// the order of a candidate's actions, so results depend only on decisions.
//
// DEMAND MODEL (documented for faculty; parameters in mela-market.yaml)
//   visitors   = base_footfall[day] × location.footfall_share
//                × event.footfall_mult × event.location_mult[location]
//   interest   = product.interest × location.affinity[product] × event.product_mult[product]
//   price      = clamp(1 + elasticity × (1 − price / ref_price), 0, demand_cap)
//   promotion  = 1 + promotion.lift
//   competitor = clamp((competitor_price / price) ^ cross_elasticity, min, max)
//   noise      = 1 ± noise   (seeded by window seed, day, location)
//   demand     = round(visitors × interest × price × promotion × competitor × noise)
//   sold       = min(stock, demand)
import { rng } from "../prng";
import type {
  BidReveal,
  DayDecision,
  DayResult,
  GameState,
  MelaConfig,
  MelaDecisions,
  MelaEvent,
  MelaLocation,
  MelaProduct,
  StallBid,
  StallOutcome,
} from "./types";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function product(cfg: MelaConfig, id: string): MelaProduct {
  const p = cfg.products.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown product ${id}`);
  return p;
}

export function location(cfg: MelaConfig, id: string): MelaLocation {
  const l = cfg.locations.find((x) => x.id === id);
  if (!l) throw new Error(`Unknown location ${id}`);
  return l;
}

export function eventsFor(cfg: MelaConfig, day: number): MelaEvent[] {
  return cfg.events.filter((e) => e.day === day);
}

/** Combined effect of all of a day's events. */
export interface DayEffects {
  footfall_mult: number;
  location_mult: Record<string, number>;
  product_mult: Record<string, number>;
  competitor_price_mult: number;
  supplier_offer?: MelaEvent["supplier_offer"];
}

export function effectsFor(events: MelaEvent[]): DayEffects {
  const fx: DayEffects = { footfall_mult: 1, location_mult: {}, product_mult: {}, competitor_price_mult: 1 };
  for (const e of events) {
    fx.footfall_mult *= e.footfall_mult ?? 1;
    fx.competitor_price_mult *= e.competitor_price_mult ?? 1;
    for (const [k, v] of Object.entries(e.location_mult ?? {})) fx.location_mult[k] = (fx.location_mult[k] ?? 1) * v;
    for (const [k, v] of Object.entries(e.product_mult ?? {})) fx.product_mult[k] = (fx.product_mult[k] ?? 1) * v;
    if (e.supplier_offer) fx.supplier_offer = e.supplier_offer;
  }
  return fx;
}

const NO_EFFECTS = effectsFor([]);

/** Footfall forecast shown before the stall auction (no events, no noise). */
export function footfallForecast(cfg: MelaConfig, locId: string): number[] {
  const loc = location(cfg, locId);
  return cfg.base_footfall.map((f) => Math.round(f * loc.footfall_share));
}

export function dayNoise(cfg: MelaConfig, seed: string, day: number, locId: string): number {
  const r = rng(seed, "demand", day, locId)();
  return 1 + cfg.noise * (2 * r - 1);
}

export function competitorPrice(cfg: MelaConfig, productId: string, fx: DayEffects = NO_EFFECTS): number {
  const p = product(cfg, productId);
  const bot = cfg.bots.find((b) => b.product === productId);
  const ratio = bot?.price_ratio ?? 1;
  return Math.round(p.ref_price * ratio * fx.competitor_price_mult);
}

export interface DemandInput {
  day: number;
  locationId: string;
  productId: string;
  price: number;
  promotionId: string;
  /** Include the seeded day noise (true for real play, false for forecasts). */
  withNoise: boolean;
  /** Include the day's event (false = what a candidate could forecast in advance). */
  withEvent: boolean;
}

export function demandFor(cfg: MelaConfig, seed: string, d: DemandInput) {
  const loc = location(cfg, d.locationId);
  const prod = product(cfg, d.productId);
  const ev = d.withEvent ? effectsFor(eventsFor(cfg, d.day)) : NO_EFFECTS;
  const promo = cfg.promotions.find((p) => p.id === d.promotionId) ?? { lift: 0 };

  const visitors = Math.round(
    cfg.base_footfall[d.day - 1] *
      loc.footfall_share *
      ev.footfall_mult *
      (ev.location_mult[loc.id] ?? 1),
  );
  const interest = prod.interest * (loc.affinity[prod.id] ?? 1) * (ev.product_mult[prod.id] ?? 1);
  const priceFactor = clamp(1 + prod.elasticity * (1 - d.price / prod.ref_price), 0, cfg.demand_cap);
  const compPrice = competitorPrice(cfg, prod.id, ev);
  const competition = clamp(
    Math.pow(compPrice / Math.max(1, d.price), cfg.competition.cross_elasticity),
    cfg.competition.min,
    cfg.competition.max,
  );
  const noise = d.withNoise ? dayNoise(cfg, seed, d.day, loc.id) : 1;
  const demand = Math.max(0, Math.round(visitors * interest * priceFactor * (1 + promo.lift) * competition * noise));
  return { visitors, demand, competitorPrice: compPrice };
}

/* ------------------------------------------------------------ stall auction -- */

export function resolveStallAuction(cfg: MelaConfig, bid: StallBid): StallOutcome {
  const bids: BidReveal[] = cfg.bots.map((b) => ({
    who: b.name,
    location: b.stall_bid.location,
    amount: b.stall_bid.amount,
    you: false,
  }));
  bids.push({ who: "You", location: bid.location, amount: bid.amount, you: true });

  const target = location(cfg, bid.location);
  const rival = cfg.bots.find((b) => b.stall_bid.location === bid.location);
  const beatsRival = !rival || bid.amount > rival.stall_bid.amount;
  const won = bid.amount >= target.reserve && beatsRival;

  if (won) return { location: bid.location, won: true, paid: bid.amount, bids };

  // Lost: allotted whichever spot no bot claimed (the back corner in the
  // default config), at its reserve price.
  const claimed = new Set(cfg.bots.map((b) => b.stall_bid.location));
  const leftover =
    cfg.locations.filter((l) => !claimed.has(l.id)).sort((a, b) => a.reserve - b.reserve)[0] ??
    cfg.locations.slice().sort((a, b) => a.reserve - b.reserve)[0];
  return { location: leftover.id, won: false, paid: leftover.reserve, bids };
}

/* --------------------------------------------------------------- validation -- */

export function validateDay(cfg: MelaConfig, state: GameState, dec: DayDecision): string[] {
  const errors: string[] = [];
  const day = state.days.length + 1;
  const prod = cfg.products.find((p) => p.id === dec.product);
  if (!prod) return ["Choose what to sell."];
  if (!Number.isInteger(dec.units) || dec.units < 0) errors.push("Stock must be a whole number.");
  if (dec.price < prod.min_price || dec.price > prod.max_price)
    errors.push(`Price must be between ₹${prod.min_price} and ₹${prod.max_price}.`);
  const prev = state.days.at(-1)?.product;
  if (prev && prev !== dec.product && state.switchesUsed >= cfg.switch_limit)
    errors.push("You have already used your one product switch.");
  const cost = spendFor(cfg, state, dec, day);
  if (cost.total > state.cash) errors.push(`That plan costs ₹${fmt(cost.total)} but you have ₹${fmt(state.cash)}.`);
  return errors;
}

/** What a day's plan costs, including any supplier discount. */
export function spendFor(cfg: MelaConfig, state: GameState, dec: DayDecision, day: number) {
  const prod = product(cfg, dec.product);
  const fx = effectsFor(eventsFor(cfg, day));
  const lastOrder = [...state.days].reverse().find((d) => d.product === dec.product);
  const lastUnits = lastOrder?.bought ?? 0;
  const offer = fx.supplier_offer;
  const threshold = offer ? Math.max(offer.min_units, Math.ceil(lastUnits * offer.min_multiple)) : Infinity;
  const discountApplied = !!offer && dec.units > 0 && dec.units >= threshold;
  const unitCost = Math.round(prod.unit_cost * (discountApplied ? 1 - offer!.discount : 1) * 100) / 100;
  const inventory = Math.round(unitCost * dec.units);
  const promo = cfg.promotions.find((p) => p.id === dec.promotion)?.cost ?? 0;
  const mid = day === cfg.mid_auction.day ? Math.max(0, dec.midBid ?? 0) : 0;
  // A mid-auction bid only costs money if it wins, but it must be affordable.
  return { unitCost, discountApplied, threshold, inventory, promo, mid, total: inventory + promo + mid };
}

/* --------------------------------------------------------------- simulation -- */

export function initialState(cfg: MelaConfig): GameState {
  return {
    stall: null,
    days: [],
    cash: cfg.capital,
    inventory: Object.fromEntries(cfg.products.map((p) => [p.id, 0])),
    switchesUsed: 0,
    midWon: false,
    salvage: 0,
    finalProfit: 0,
    finished: false,
  };
}

export function simulate(cfg: MelaConfig, seed: string, decisions: MelaDecisions): GameState {
  let state = initialState(cfg);
  if (!decisions.stall) return state;
  const stall = resolveStallAuction(cfg, decisions.stall);
  state = { ...state, stall, cash: state.cash - stall.paid };

  for (const dec of decisions.days.slice(0, cfg.days)) {
    state = playDay(cfg, seed, state, dec);
  }
  return finalise(cfg, state);
}

function playDay(cfg: MelaConfig, seed: string, state: GameState, dec: DayDecision): GameState {
  const day = state.days.length + 1;
  const events = eventsFor(cfg, day);
  const prod = product(cfg, dec.product);
  const spend = spendFor(cfg, state, dec, day);

  const prevProduct = state.days.at(-1)?.product;
  const switched = !!prevProduct && prevProduct !== dec.product;

  const inventory = { ...state.inventory };
  inventory[prod.id] += dec.units;
  const stockAvailable = inventory[prod.id];

  const { visitors, demand, competitorPrice: compPrice } = demandFor(cfg, seed, {
    day,
    locationId: state.stall!.location,
    productId: prod.id,
    price: dec.price,
    promotionId: dec.promotion,
    withNoise: true,
    withEvent: true,
  });

  const sold = Math.min(stockAvailable, demand);
  inventory[prod.id] -= sold;
  let wasted = 0;
  if (prod.perishable) {
    wasted = inventory[prod.id];
    inventory[prod.id] = 0;
  }

  // Mid-game auction (sealed bid, first price, against fixed bot bids).
  const mid = cfg.mid_auction;
  let midWon = state.midWon;
  let midCost = 0;
  let midBids: number[] | undefined;
  if (day === mid.day) {
    const bid = Math.max(0, dec.midBid ?? 0);
    midBids = mid.bot_bids;
    if (bid > Math.max(...mid.bot_bids)) {
      midWon = true;
      midCost = bid;
    }
  }
  const midBonus = midWon && mid.active_days.includes(day) ? mid.value_per_day : 0;

  const revenue = sold * dec.price;
  const profit = revenue + midBonus - spend.inventory - spend.promo - midCost;
  const cashEnd = state.cash + profit;

  let soldOutAt: string | null = null;
  if (demand > stockAvailable && demand > 0) {
    const hours = cfg.hours.close - cfg.hours.open;
    const t = cfg.hours.open + (stockAvailable / demand) * hours;
    soldOutAt = clockLabel(t);
  }

  const competitor = cfg.bots.find((b) => b.product === prod.id);
  const result: DayResult = {
    day,
    product: prod.id,
    events,
    visitors,
    demand,
    bought: dec.units,
    stockAvailable,
    sold,
    wasted,
    carried: prod.perishable ? 0 : inventory[prod.id],
    unitCost: spend.unitCost,
    discountApplied: spend.discountApplied,
    revenue,
    inventoryCost: spend.inventory,
    promoCost: spend.promo,
    midCost,
    midBonus,
    profit,
    cashEnd,
    soldOutAt,
    competitorPrice: compPrice,
    competitorName: competitor?.name ?? null,
    midWon: day === mid.day ? midWon : undefined,
    midBids,
  };

  return {
    ...state,
    days: [...state.days, result],
    cash: cashEnd,
    inventory,
    switchesUsed: state.switchesUsed + (switched ? 1 : 0),
    midWon,
  };
}

function finalise(cfg: MelaConfig, state: GameState): GameState {
  const salvage = Math.round(
    cfg.products
      .filter((p) => !p.perishable)
      .reduce((sum, p) => sum + state.inventory[p.id] * p.unit_cost * cfg.salvage_rate, 0),
  );
  return {
    ...state,
    salvage,
    finalProfit: Math.round(state.cash + salvage - cfg.capital),
    finished: state.days.length >= cfg.days,
  };
}

/* ---------------------------------------------------------- reference plan -- */

/** Profit-maximising price under the linear demand model, ignoring competition. */
export function sensiblePrice(prod: MelaProduct): number {
  const p = (prod.ref_price * (1 + prod.elasticity)) / prod.elasticity / 2 + prod.unit_cost / 2;
  return Math.round(clamp(p, prod.min_price, prod.max_price));
}

/**
 * What a location is worth to a careful stallholder, using only information
 * available at bid time (forecast footfall, no events, no noise). Used to judge
 * whether a stall bid exceeded its expected value.
 */
export function forecastProfit(cfg: MelaConfig, locId: string): number {
  let best = -Infinity;
  for (const prod of cfg.products) {
    const price = sensiblePrice(prod);
    let total = 0;
    for (let day = 1; day <= cfg.days; day++) {
      const { demand } = demandFor(cfg, "", {
        day,
        locationId: locId,
        productId: prod.id,
        price,
        promotionId: "none",
        withNoise: false,
        withEvent: false,
      });
      total += demand * (price - prod.unit_cost);
    }
    best = Math.max(best, total);
  }
  return Math.round(best);
}

/** Highest bid for a location that still makes sense vs taking the fallback spot. */
export function stallValue(cfg: MelaConfig, locId: string): number {
  const claimed = new Set(cfg.bots.map((b) => b.stall_bid.location));
  const fallback =
    cfg.locations.filter((l) => !claimed.has(l.id)).sort((a, b) => a.reserve - b.reserve)[0] ?? cfg.locations[0];
  if (locId === fallback.id) return fallback.reserve;
  return forecastProfit(cfg, locId) - forecastProfit(cfg, fallback.id) + fallback.reserve;
}

export function midAuctionValue(cfg: MelaConfig): number {
  return cfg.mid_auction.value_per_day * cfg.mid_auction.active_days.filter((d) => d >= cfg.mid_auction.day).length;
}

function clockLabel(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60 / 5) * 5;
  const hh = ((h + 11) % 12) + 1;
  const suffix = h >= 12 ? "pm" : "am";
  return `${hh}:${String(m % 60).padStart(2, "0")} ${suffix}`;
}

export function fmt(n: number): string {
  return Math.round(n).toLocaleString("en-IN");
}
