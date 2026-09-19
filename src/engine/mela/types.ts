// Mela Market — types for config, decisions and simulated outcomes.
// Every number that shapes the game lives in content/games/mela-market.yaml.

export interface MelaLocation {
  id: string;
  name: string;
  blurb: string;
  /** Share of the day's mela visitors who walk past this stall. */
  footfall_share: number;
  /** Minimum accepted bid (also what you pay if you are allotted it by default). */
  reserve: number;
  /** Product-specific pull of this spot, 1 = neutral. */
  affinity: Record<string, number>;
  /** Position on the mela map, 0..100. */
  map: { x: number; y: number };
}

export interface MelaProduct {
  id: string;
  name: string;
  blurb: string;
  perishable: boolean;
  unit_cost: number;
  ref_price: number;
  min_price: number;
  max_price: number;
  /** Share of passing visitors who buy one unit at the reference price. */
  interest: number;
  /** Linear price sensitivity: demand × (1 + e·(1 − price/ref)). */
  elasticity: number;
}

export interface MelaPromotion {
  id: string;
  name: string;
  blurb: string;
  cost: number;
  lift: number;
}

export interface MelaBot {
  id: string;
  name: string;
  product: string;
  stall_bid: { location: string; amount: number };
  /** Bot's everyday price as a multiple of the product's reference price. */
  price_ratio: number;
}

export interface MelaEvent {
  day: number;
  id: string;
  title: string;
  body: string;
  tone: "neutral" | "good" | "bad" | "offer";
  footfall_mult?: number;
  location_mult?: Record<string, number>;
  product_mult?: Record<string, number>;
  /** Applies to the competitor selling the same product as you. */
  competitor_price_mult?: number;
  supplier_offer?: { discount: number; min_multiple: number; min_units: number };
}

export interface MelaMidAuction {
  day: number;
  id: string;
  title: string;
  body: string;
  value_per_day: number;
  active_days: number[];
  bot_bids: number[];
}

export interface DecisionCheckDef {
  id: string;
  label: string;
  weight: number;
  explain: string;
}

export interface MelaConfig {
  title: string;
  capital: number;
  days: number;
  base_footfall: number[];
  noise: number;
  demand_cap: number;
  salvage_rate: number;
  switch_limit: number;
  hours: { open: number; close: number };
  competition: { cross_elasticity: number; min: number; max: number };
  locations: MelaLocation[];
  products: MelaProduct[];
  promotions: MelaPromotion[];
  bots: MelaBot[];
  events: MelaEvent[];
  mid_auction: MelaMidAuction;
  scoring: {
    outcome_weight: number;
    decision_weight: number;
    cohort_size: number;
    bid_tolerance: number;
    waste_tolerance: number;
    adjust_threshold: number;
    checks: DecisionCheckDef[];
  };
  tutorial: { title: string; body: string }[];
}

/* -------------------------------------------------------------- decisions -- */

export interface StallBid {
  location: string;
  amount: number;
}

export interface DayDecision {
  product: string;
  units: number;
  price: number;
  promotion: string;
  /** Only read on the mid-auction day; 0 or undefined = no bid. */
  midBid?: number;
}

export interface MelaDecisions {
  stall: StallBid | null;
  days: DayDecision[];
}

/* --------------------------------------------------------------- outcomes -- */

export interface BidReveal {
  who: string;
  location: string;
  amount: number;
  you: boolean;
}

export interface StallOutcome {
  location: string;
  won: boolean;
  paid: number;
  bids: BidReveal[];
}

export interface DayResult {
  day: number;
  product: string;
  events: MelaEvent[];
  visitors: number;
  demand: number;
  bought: number;
  stockAvailable: number;
  sold: number;
  wasted: number;
  carried: number;
  unitCost: number;
  discountApplied: boolean;
  revenue: number;
  inventoryCost: number;
  promoCost: number;
  midCost: number;
  midBonus: number;
  profit: number;
  cashEnd: number;
  soldOutAt: string | null;
  competitorPrice: number;
  competitorName: string | null;
  midWon?: boolean;
  midBids?: number[];
}

export interface GameState {
  stall: StallOutcome | null;
  days: DayResult[];
  cash: number;
  inventory: Record<string, number>;
  switchesUsed: number;
  midWon: boolean;
  salvage: number;
  finalProfit: number;
  finished: boolean;
}
