// Prints what the Mela Market model implies, so faculty can sanity-check a
// tuning change before it reaches candidates:  npm run mela:report
import { loadGameConfig } from "../src/content/load";
import { footfallForecast, forecastProfit, midAuctionValue, sensiblePrice, stallValue } from "../src/engine/mela/sim";
import { syntheticCohort } from "../src/engine/mela/score";
import type { MelaConfig } from "../src/engine/mela/types";

const cfg = loadGameConfig<MelaConfig>("mela-market.yaml");
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

console.log(`\n${cfg.title} — model report\n`);
console.log("Sensible prices:", cfg.products.map((p) => `${p.name} ${inr(sensiblePrice(p))}`).join(" · "));
console.log("\nLocation            forecast visitors/day        best 4-day profit   value of winning   top bot bid");
for (const l of cfg.locations) {
  const bot = cfg.bots.find((b) => b.stall_bid.location === l.id);
  console.log(
    l.name.padEnd(24),
    footfallForecast(cfg, l.id).join(", ").padEnd(24),
    inr(forecastProfit(cfg, l.id)).padStart(12),
    inr(stallValue(cfg, l.id)).padStart(18),
    (bot ? inr(bot.stall_bid.amount) : "—").padStart(12),
  );
}
console.log(`\nWater-rights value: ${inr(midAuctionValue(cfg))} (bot bids ${cfg.mid_auction.bot_bids.map(inr).join(", ")})`);
const cohort = syntheticCohort(cfg, "report");
const q = (p: number) => inr(cohort[Math.floor(p * (cohort.length - 1))]);
console.log(`Simulated cohort profit — p10 ${q(0.1)} · median ${q(0.5)} · p90 ${q(0.9)}\n`);
