"use client";
// Mela Market — UI shell over the pure simulation in @/engine/mela.
// Every decision is appended to a timestamped log; the game state is always
// recomputed from (config, window seed, decisions), so a reload or crash
// resumes exactly where the candidate was.
import { useMemo, useState } from "react";
import { Button } from "@/components/ui";
import {
  effectsFor,
  eventsFor,
  footfallForecast,
  simulate,
  spendFor,
  validateDay,
} from "@/engine/mela/sim";
import type { DayDecision, DayResult, GameState, MelaConfig, MelaDecisions, MelaEvent } from "@/engine/mela/types";

export interface MelaData {
  decisions: MelaDecisions;
  phase: "tutorial" | "auction" | "reveal" | "morning" | "plan" | "results" | "summary";
  tutorialStep: number;
  draft: Partial<DayDecision> | null;
  auctionDraft: { location: string | null; amount: string };
  log: { t: number; action: string; detail?: unknown }[];
  startedAt: number;
  finishedAt: number | null;
}

export const inr = (n: number) => `${n < 0 ? "−" : ""}₹${Math.abs(Math.round(n)).toLocaleString("en-IN")}`;

export function initialMelaData(): MelaData {
  return {
    decisions: { stall: null, days: [] },
    phase: "tutorial",
    tutorialStep: 0,
    draft: null,
    auctionDraft: { location: null, amount: "" },
    log: [],
    startedAt: Date.now(),
    finishedAt: null,
  };
}

export function MelaMarket({
  config: baseConfig,
  seed,
  data: stored,
  practice,
  onData,
}: {
  config: MelaConfig;
  seed: string;
  data: MelaData | null;
  practice: boolean;
  onData: (d: MelaData, completed: boolean) => void;
}) {
  const config = useMemo(() => (practice ? { ...baseConfig, days: 1 } : baseConfig), [baseConfig, practice]);
  const data = stored ?? initialMelaData();
  const state = useMemo(() => simulate(config, seed, data.decisions), [config, seed, data.decisions]);
  const day = state.days.length + (data.phase === "results" ? 0 : 1);

  const save = (patch: Partial<MelaData>, action?: string, detail?: unknown) => {
    const next: MelaData = {
      ...data,
      ...patch,
      log: action ? [...data.log, { t: Date.now(), action, detail }] : data.log,
    };
    onData(next, next.phase === "summary");
  };

  return (
    <div className="overflow-hidden bg-[#FFF3E0] ring-1 ring-line-strong curve-br" data-accent="navy">
      <Header config={config} state={state} phase={data.phase} day={Math.min(day, config.days)} practice={practice} />
      <div className="p-5 sm:p-7">
        {data.phase === "tutorial" && (
          <Tutorial
            steps={config.tutorial}
            step={data.tutorialStep}
            onStep={(s) => save({ tutorialStep: s })}
            onDone={() => save({ phase: "auction" }, "tutorial_done")}
            practice={practice}
          />
        )}
        {data.phase === "auction" && (
          <StallAuction
            config={config}
            draft={data.auctionDraft}
            onDraft={(d) => save({ auctionDraft: d })}
            onSubmit={(location, amount) =>
              save({ phase: "reveal", decisions: { ...data.decisions, stall: { location, amount } } }, "stall_bid", { location, amount })
            }
          />
        )}
        {data.phase === "reveal" && state.stall && (
          <AuctionReveal config={config} state={state} onNext={() => save({ phase: "morning" }, "reveal_seen")} />
        )}
        {data.phase === "morning" && (
          <Morning config={config} state={state} day={day} onNext={() => save({ phase: "plan" }, "news_seen", { day })} />
        )}
        {data.phase === "plan" && (
          <Plan
            config={config}
            seed={seed}
            state={state}
            day={day}
            draft={data.draft}
            onDraft={(d) => save({ draft: d })}
            onSubmit={(dec) =>
              save(
                { phase: "results", draft: null, decisions: { ...data.decisions, days: [...data.decisions.days, dec] } },
                "day_plan",
                { day, ...dec },
              )
            }
          />
        )}
        {data.phase === "results" && state.days.at(-1) && (
          <DayResults
            config={config}
            result={state.days.at(-1)!}
            last={state.days.length >= config.days}
            onNext={() =>
              state.days.length >= config.days
                ? save({ phase: "summary", finishedAt: Date.now() }, "finished")
                : save({ phase: "morning" }, "next_day")
            }
          />
        )}
        {data.phase === "summary" && <Summary config={config} state={state} practice={practice} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ header -- */

function Header({ config, state, phase, day, practice }: { config: MelaConfig; state: GameState; phase: MelaData["phase"]; day: number; practice: boolean }) {
  const loc = state.stall ? config.locations.find((l) => l.id === state.stall!.location) : null;
  const stage =
    phase === "tutorial" ? "How to play" : phase === "auction" || phase === "reveal" ? "Stall auction" : phase === "summary" ? "Mela over" : `Day ${day} of ${config.days}`;
  return (
    <div className="relative flex flex-wrap items-center gap-x-6 gap-y-2 bg-navy px-5 py-3.5 text-white sm:px-7">
      <div className="pattern-lattice absolute inset-0 opacity-60" aria-hidden />
      <div className="relative flex items-baseline gap-3">
        <span className="font-serif text-2xl italic">Mela Market</span>
        {practice && <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">Practice</span>}
      </div>
      <div className="relative text-sm font-semibold uppercase tracking-[0.14em] text-sand">{stage}</div>
      <dl className="relative ml-auto flex gap-5 text-sm">
        {loc && (
          <div>
            <dt className="text-[0.65rem] uppercase tracking-widest text-white/60">Stall</dt>
            <dd className="font-semibold">{loc.name}</dd>
          </div>
        )}
        <div>
          <dt className="text-[0.65rem] uppercase tracking-widest text-white/60">Cash</dt>
          <dd className="font-semibold tabular-nums">{inr(state.cash)}</dd>
        </div>
      </dl>
      <DayDots total={config.days} done={state.days.length} />
    </div>
  );
}

function DayDots({ total, done }: { total: number; done: number }) {
  return (
    <div className="relative flex gap-1.5" aria-label={`${done} of ${total} days played`}>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`h-1.5 w-6 rounded-full ${i < done ? "bg-narangi" : "bg-white/25"}`} />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- tutorial -- */

function Tutorial({ steps, step, onStep, onDone, practice }: { steps: MelaConfig["tutorial"]; step: number; onStep: (s: number) => void; onDone: () => void; practice: boolean }) {
  const s = steps[step];
  const icons = ["🎪", "🗺", "🌅", "📰"];
  return (
    <div className="grid items-center gap-8 md:grid-cols-[1fr_1.1fr]">
      <MelaMap config={null} />
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-navy">
          {practice ? "Practice · one day" : "Tutorial"} · {step + 1} of {steps.length}
        </p>
        <h3 className="mt-2 font-serif text-4xl leading-tight">
          <span aria-hidden className="mr-2">{icons[step % icons.length]}</span>
          {s.title}
        </h3>
        <p className="mt-3 text-lg leading-relaxed text-ink-soft">{s.body}</p>
        <div className="mt-6 flex gap-3">
          {step > 0 && (
            <Button variant="secondary" onClick={() => onStep(step - 1)}>
              Back
            </Button>
          )}
          {step < steps.length - 1 ? (
            <Button onClick={() => onStep(step + 1)}>Next</Button>
          ) : (
            <Button onClick={onDone}>Go to the stall auction →</Button>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- map -- */

function MelaMap({
  config,
  selected,
  onSelect,
  highlight,
}: {
  config: MelaConfig | null;
  selected?: string | null;
  onSelect?: (id: string) => void;
  highlight?: string | null;
}) {
  return (
    <svg viewBox="0 0 100 100" className="w-full rounded-2xl bg-[#F6E3C0] shadow-inner" role="img" aria-label="Map of the mela grounds">
      <defs>
        <pattern id="grass" width="4" height="4" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.35" fill="#D9BE8E" />
        </pattern>
      </defs>
      <rect width="100" height="100" fill="url(#grass)" />
      {/* paths */}
      <path d="M50 100 L50 62 M50 62 C 40 55, 30 50, 22 46 M50 62 C 60 55, 68 46, 76 40 M50 62 L50 26 M76 40 C 80 30, 83 20, 84 12" stroke="#E9CFA0" strokeWidth="6" fill="none" strokeLinecap="round" />
      {/* stage */}
      <rect x="36" y="8" width="28" height="12" rx="2" fill="#81204D" />
      <path d="M36 8 Q50 1 64 8" fill="#561842" />
      <text x="50" y="16.5" fontSize="3.4" fill="#FFE5CD" textAnchor="middle" fontWeight="700">STAGE</text>
      {/* food court */}
      <g transform="translate(9 36)">
        <rect width="18" height="16" rx="2" fill="#E9A15D" opacity="0.5" />
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={4 + i * 5} cy="11" r="1.6" fill="#8E5C31" />
        ))}
        <path d="M0 4 L18 4" stroke="#CC5C2F" strokeWidth="2" />
      </g>
      {/* ferris wheel */}
      <g transform="translate(80 38)">
        <circle r="9" fill="none" stroke="#104477" strokeWidth="0.9" />
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i * Math.PI) / 4;
          return (
            <g key={i}>
              <line x1="0" y1="0" x2={9 * Math.cos(a)} y2={9 * Math.sin(a)} stroke="#104477" strokeWidth="0.5" />
              <circle cx={9 * Math.cos(a)} cy={9 * Math.sin(a)} r="1.3" fill={i % 2 ? "#CC5C2F" : "#B20E38"} />
            </g>
          );
        })}
        <path d="M-4 12 L0 0 L4 12" stroke="#104477" strokeWidth="0.9" fill="none" />
      </g>
      {/* entrance arch */}
      <g transform="translate(50 93)">
        <path d="M-9 6 L-9 -2 Q0 -10 9 -2 L9 6" stroke="#B20E38" strokeWidth="2" fill="none" />
        <text y="-3.5" fontSize="2.6" fill="#B20E38" textAnchor="middle" fontWeight="700">ENTRY</text>
      </g>
      {/* bunting */}
      <path d="M2 30 Q25 36 48 30 T98 30" stroke="#8E5C31" strokeWidth="0.3" fill="none" />
      {Array.from({ length: 16 }).map((_, i) => (
        <path key={i} d={`M${4 + i * 6} ${31 + Math.sin(i) * 1.2} l1.6 3 l1.6 -3 z`} fill={["#B20E38", "#CC5C2F", "#104477", "#F2D5A0"][i % 4]} />
      ))}
      {config?.locations.map((l) => {
        const sel = selected === l.id;
        const hi = highlight === l.id;
        return (
          <g
            key={l.id}
            transform={`translate(${l.map.x} ${l.map.y})`}
            className={onSelect ? "cursor-pointer" : undefined}
            onClick={() => onSelect?.(l.id)}
            role={onSelect ? "button" : undefined}
            aria-label={onSelect ? `Select ${l.name}` : undefined}
          >
            <circle r={sel || hi ? 5.2 : 4} fill={sel || hi ? "#B20E38" : "#333A3D"} stroke="#fff" strokeWidth="1" className="transition-all" />
            <text y="1.3" fontSize="3.4" fill="#fff" textAnchor="middle" fontWeight="700">
              {config.locations.indexOf(l) + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------ stall auction -- */

function StallAuction({
  config,
  draft,
  onDraft,
  onSubmit,
}: {
  config: MelaConfig;
  draft: MelaData["auctionDraft"];
  onDraft: (d: MelaData["auctionDraft"]) => void;
  onSubmit: (location: string, amount: number) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const sel = config.locations.find((l) => l.id === draft.location) ?? null;
  const amount = Number(draft.amount.replace(/[^\d]/g, "")) || 0;
  const max = Math.max(...config.locations.map((l) => Math.max(...footfallForecast(config, l.id))));
  const tooLow = sel && amount < sel.reserve;

  return (
    <div className="grid gap-7 lg:grid-cols-[1fr_1.15fr]">
      <div>
        <MelaMap config={config} selected={draft.location} onSelect={(id) => onDraft({ ...draft, location: id })} />
        <p className="mt-3 text-sm text-ink-soft">
          Three other stallholders are bidding too. It&apos;s a <strong>sealed-bid</strong> auction: you won&apos;t see their bids until it closes. The highest bid for each spot wins and pays what they bid. If you&apos;re outbid, you get whichever spot is left, at its reserve price.
        </p>
      </div>
      <div>
        <h3 className="font-serif text-3xl">Choose a spot and place your bid</h3>
        <ul className="mt-4 grid gap-2" role="radiogroup" aria-label="Stall locations">
          {config.locations.map((l, i) => {
            const f = footfallForecast(config, l.id);
            const selected = draft.location === l.id;
            return (
              <li key={l.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onDraft({ ...draft, location: l.id })}
                  className={`flex w-full items-start gap-3 rounded-xl p-3.5 text-left ring-1 transition ${selected ? "bg-white ring-2 ring-navy" : "bg-white/60 ring-line hover:bg-white"}`}
                >
                  <span className={`grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold text-white ${selected ? "bg-red" : "bg-ink"}`}>{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-semibold">{l.name}</span>
                      <span className="text-xs text-ink-mute">reserve {inr(l.reserve)}</span>
                    </span>
                    <span className="mt-0.5 block text-sm text-ink-soft">{l.blurb}</span>
                    <span className="mt-2 flex items-end gap-1" aria-label={`Forecast visitors per day: ${f.join(", ")}`}>
                      {f.map((v, d) => (
                        <span key={d} className="flex flex-col items-center gap-0.5">
                          <span className="w-8 rounded-t-sm bg-series-1/80" style={{ height: 4 + (v / max) * 34 }} />
                          <span className="text-[0.62rem] tabular-nums text-ink-mute">{v.toLocaleString("en-IN")}</span>
                        </span>
                      ))}
                      <span className="mb-3.5 ml-2 text-[0.65rem] uppercase tracking-wider text-ink-mute">visitors / day (forecast)</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="grid gap-1">
            <span className="text-sm font-semibold">Your sealed bid {sel ? `for ${sel.name.toLowerCase()}` : ""}</span>
            <span className="flex h-12 items-center rounded-xl bg-white px-3 ring-1 ring-line-strong focus-within:ring-2 focus-within:ring-navy">
              <span className="text-ink-mute">₹</span>
              <input
                inputMode="numeric"
                value={draft.amount}
                onChange={(e) => onDraft({ ...draft, amount: e.target.value.replace(/[^\d]/g, "") })}
                placeholder="0"
                className="w-40 bg-transparent px-2 text-lg font-semibold tabular-nums outline-none"
                aria-describedby="bid-help"
              />
            </span>
          </label>
          <Button disabled={!sel || !amount || !!tooLow} onClick={() => setConfirming(true)}>
            Submit sealed bid
          </Button>
        </div>
        <p id="bid-help" className={`mt-2 text-sm ${tooLow ? "font-medium text-red" : "text-ink-mute"}`}>
          {tooLow ? `Bids below the ${inr(sel!.reserve)} reserve are not accepted.` : "Think about what the spot is worth to you over four days — not just who wins."}
        </p>
        {confirming && sel && (
          <div role="alertdialog" aria-label="Confirm bid" className="mt-4 animate-rise rounded-xl bg-navy p-4 text-white">
            <p>
              Bid <strong>{inr(amount)}</strong> for <strong>{sel.name.toLowerCase()}</strong>? Once submitted it can&apos;t be changed.
            </p>
            <div className="mt-3 flex gap-2">
              <button className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-navy" onClick={() => onSubmit(sel.id, amount)}>
                Yes, submit
              </button>
              <button className="rounded-lg px-4 py-2 text-sm font-semibold text-white/80 hover:text-white" onClick={() => setConfirming(false)}>
                Change it
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AuctionReveal({ config, state, onNext }: { config: MelaConfig; state: GameState; onNext: () => void }) {
  const s = state.stall!;
  const loc = config.locations.find((l) => l.id === s.location)!;
  const yours = s.bids.find((b) => b.you)!;
  return (
    <div className="grid gap-7 lg:grid-cols-[1fr_1.15fr]">
      <MelaMap config={config} highlight={s.location} />
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-navy">The auction has closed</p>
        <h3 className="mt-1 font-serif text-4xl leading-tight">
          {s.won ? `You won the spot ${loc.name.toLowerCase()}.` : `Outbid — you've been given ${loc.name.toLowerCase()}.`}
        </h3>
        <p className="mt-2 text-ink-soft">
          You pay <strong>{inr(s.paid)}</strong>. {s.won ? "" : `Your ${inr(yours.amount)} bid wasn't enough, so you pay the reserve price for the spot that was left.`}
        </p>
        <table className="mt-5 w-full overflow-hidden rounded-xl bg-white text-sm ring-1 ring-line">
          <thead>
            <tr className="bg-cream/70 text-left">
              <th className="px-4 py-2 font-semibold">Bidder</th>
              <th className="px-4 py-2 font-semibold">Spot</th>
              <th className="px-4 py-2 text-right font-semibold">Sealed bid</th>
            </tr>
          </thead>
          <tbody>
            {s.bids.map((b, i) => (
              <tr key={b.who} className={`animate-rise border-t border-line ${b.you ? "bg-[#E2ECF6] font-semibold" : ""}`} style={{ animationDelay: `${i * 180}ms` }}>
                <td className="px-4 py-2.5">{b.who}</td>
                <td className="px-4 py-2.5">{config.locations.find((l) => l.id === b.location)?.name}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{inr(b.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button className="mt-6" onClick={onNext}>
          Day 1 morning →
        </Button>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- morning -- */

function EventCard({ e }: { e: MelaEvent }) {
  const tone = {
    neutral: "bg-white ring-line",
    good: "bg-[#E7F3EA] ring-[#B6D8BF]",
    bad: "bg-[#FBE6DA] ring-[#EDBFA5]",
    offer: "bg-[#E2ECF6] ring-[#B8CDE3]",
  }[e.tone];
  const icon = { neutral: "📣", good: "🏏", bad: e.id === "rain" ? "🌧" : "🏷", offer: "📦" }[e.tone];
  return (
    <article className={`animate-rise p-5 ring-1 curve-br-sm ${tone}`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-mute">
        <span aria-hidden>{icon}</span> Morning news
      </p>
      <h4 className="mt-1 font-serif text-2xl leading-snug">{e.title}</h4>
      <p className="mt-2 leading-relaxed text-ink-soft">{e.body}</p>
    </article>
  );
}

function Morning({ config, state, day, onNext }: { config: MelaConfig; state: GameState; day: number; onNext: () => void }) {
  const events = eventsFor(config, day);
  const forecast = footfallForecast(config, state.stall!.location)[day - 1];
  const mid = config.mid_auction.day === day ? config.mid_auction : null;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="grid content-start gap-3">
        <h3 className="font-serif text-4xl">Good morning — day {day}.</h3>
        {events.length ? events.map((e) => <EventCard key={e.id} e={e} />) : <p className="text-ink-soft">A quiet morning. No news today.</p>}
        {mid && (
          <article className="animate-rise bg-plum p-5 text-white curve-br-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-sand">
              <span aria-hidden>💧</span> Auction today
            </p>
            <h4 className="mt-1 font-serif text-2xl">{mid.title}</h4>
            <p className="mt-2 leading-relaxed text-white/85">{mid.body}</p>
          </article>
        )}
      </div>
      <aside className="grid content-start gap-3">
        <div className="bg-white p-5 ring-1 ring-line curve-br-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-mute">Before today&apos;s news, the forecast was</p>
          <p className="mt-1 font-serif text-4xl tabular-nums">{forecast.toLocaleString("en-IN")}</p>
          <p className="text-sm text-ink-soft">people walking past your stall</p>
        </div>
        {state.days.at(-1) && <Yesterday r={state.days.at(-1)!} config={config} />}
        <Button onClick={onNext} className="mt-2">
          Plan today →
        </Button>
      </aside>
    </div>
  );
}

function Yesterday({ r, config }: { r: DayResult; config: MelaConfig }) {
  const p = config.products.find((x) => x.id === r.product)!;
  return (
    <div className="rounded-xl bg-white/60 p-4 text-sm ring-1 ring-line">
      <p className="font-semibold">Yesterday</p>
      <p className="mt-1 text-ink-soft">
        Sold {r.sold} of {r.stockAvailable} {p.name.toLowerCase()} {r.soldOutAt ? `— sold out at ${r.soldOutAt}` : ""}. Profit {inr(r.profit)}. Neighbour&apos;s price {inr(r.competitorPrice)}.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------- plan -- */

function Plan({
  config,
  state,
  day,
  draft,
  onDraft,
  onSubmit,
}: {
  config: MelaConfig;
  seed: string;
  state: GameState;
  day: number;
  draft: Partial<DayDecision> | null;
  onDraft: (d: Partial<DayDecision>) => void;
  onSubmit: (d: DayDecision) => void;
}) {
  const prev = state.days.at(-1);
  const prevDec = prev ? { product: prev.product, units: prev.bought, price: 0 } : null;
  const productId = draft?.product ?? prev?.product ?? "";
  const product = config.products.find((p) => p.id === productId);
  const events = eventsFor(config, day);
  const fx = effectsFor(events);
  const mid = config.mid_auction.day === day ? config.mid_auction : null;
  const switchesLeft = config.switch_limit - state.switchesUsed;

  const dec: DayDecision = {
    product: productId,
    units: draft?.units ?? 0,
    price: draft?.price ?? product?.ref_price ?? 0,
    promotion: draft?.promotion ?? "none",
    midBid: mid ? (draft?.midBid ?? 0) : undefined,
  };
  const spend = product ? spendFor(config, state, dec, day) : null;
  const errors = product ? validateDay(config, state, dec) : [];
  const carried = product ? state.inventory[product.id] : 0;
  const set = (patch: Partial<DayDecision>) => onDraft({ ...dec, ...patch });

  return (
    <div className="grid gap-7 xl:grid-cols-[1fr_20rem]">
      <div className="grid gap-7">
        {/* product */}
        <section>
          <StepTitle n={1} title="What will you sell today?" note={prev ? (switchesLeft > 0 ? "You can switch product once in the mela." : "You've used your one switch.") : "You can switch once later."} />
          <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Product">
            {config.products.map((p) => {
              const locked = !!prev && prev.product !== p.id && switchesLeft <= 0;
              const sel = productId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={sel}
                  disabled={locked}
                  onClick={() => set({ product: p.id, price: draft?.product === p.id ? dec.price : p.ref_price, units: draft?.product === p.id ? dec.units : 0 })}
                  className={`flex flex-col gap-1.5 rounded-xl p-4 text-left ring-1 transition disabled:opacity-40 ${sel ? "bg-white ring-2 ring-navy" : "bg-white/60 ring-line hover:bg-white"}`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{p.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider ${p.perishable ? "bg-[#FBE6DA] text-narangi-ink" : "bg-[#E2ECF6] text-blue"}`}>
                      {p.perishable ? "Spoils" : "Keeps"}
                    </span>
                  </span>
                  <span className="text-xs leading-relaxed text-ink-soft">{p.blurb}</span>
                  <span className="mt-1 text-xs text-ink-mute">
                    Costs you {inr(p.unit_cost)} each{state.inventory[p.id] ? ` · ${state.inventory[p.id]} in stock` : ""}
                  </span>
                  {prev && prev.product !== p.id && !locked && <span className="text-xs font-semibold text-narangi-ink">Uses your one switch</span>}
                </button>
              );
            })}
          </div>
        </section>

        {product && (
          <>
            {/* stock */}
            <section>
              <StepTitle
                n={2}
                title="How much stock will you buy?"
                note={carried ? `You already have ${carried} carried over from yesterday.` : product.perishable ? "Anything unsold tonight is thrown away." : "Unsold stock carries over to tomorrow."}
              />
              <div className="flex flex-wrap items-center gap-2">
                {[-100, -10].map((d) => (
                  <Step key={d} label={`${d}`} onClick={() => set({ units: Math.max(0, dec.units + d) })} />
                ))}
                <label className="flex h-12 items-center rounded-xl bg-white px-3 ring-1 ring-line-strong focus-within:ring-2 focus-within:ring-navy">
                  <span className="sr-only">Units to buy</span>
                  <input
                    inputMode="numeric"
                    value={dec.units}
                    onChange={(e) => set({ units: Number(e.target.value.replace(/[^\d]/g, "")) || 0 })}
                    className="w-24 bg-transparent text-center text-lg font-semibold tabular-nums outline-none"
                  />
                  <span className="text-sm text-ink-mute">units</span>
                </label>
                {[10, 100].map((d) => (
                  <Step key={d} label={`+${d}`} onClick={() => set({ units: dec.units + d })} />
                ))}
                <span className="ml-2 text-sm text-ink-soft">
                  = <strong className="tabular-nums">{inr(spend!.inventory)}</strong>
                  {spend!.discountApplied && <span className="ml-1 font-semibold text-ok">(15% supplier discount applied)</span>}
                </span>
              </div>
              {fx.supplier_offer && !spend!.discountApplied && (
                <p className="mt-2 text-sm text-blue">Supplier offer: order at least {spend!.threshold} units for 15% off every unit.</p>
              )}
            </section>

            {/* price */}
            <section>
              <StepTitle n={3} title="What price will you charge?" note={prev ? `Your neighbour charged ${inr(prev.competitorPrice)} yesterday.` : `A typical price is around ${inr(product.ref_price)}.`} />
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex h-12 items-center rounded-xl bg-white px-3 ring-1 ring-line-strong focus-within:ring-2 focus-within:ring-navy">
                  <span className="text-ink-mute">₹</span>
                  <input
                    inputMode="numeric"
                    aria-label="Price per unit"
                    value={dec.price}
                    onChange={(e) => set({ price: Number(e.target.value.replace(/[^\d]/g, "")) || 0 })}
                    className="w-20 bg-transparent px-1 text-lg font-semibold tabular-nums outline-none"
                  />
                  <span className="text-sm text-ink-mute">per unit</span>
                </label>
                <input
                  type="range"
                  min={product.min_price}
                  max={Math.min(product.max_price, product.ref_price * 3)}
                  value={dec.price}
                  onChange={(e) => set({ price: Number(e.target.value) })}
                  aria-label="Price slider"
                  className="min-w-40 flex-1 accent-navy"
                />
                <span className={`text-sm font-semibold ${dec.price < product.unit_cost ? "text-red" : "text-ink-soft"}`}>
                  Margin {inr(dec.price - product.unit_cost)} / unit
                </span>
              </div>
            </section>

            {/* promotion */}
            <section>
              <StepTitle n={4} title="Any promotion today?" note="Promotions last for today only." />
              <div className="grid gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Promotion">
                {config.promotions.map((pr) => (
                  <button
                    key={pr.id}
                    type="button"
                    role="radio"
                    aria-checked={dec.promotion === pr.id}
                    onClick={() => set({ promotion: pr.id })}
                    className={`rounded-xl p-3 text-left ring-1 ${dec.promotion === pr.id ? "bg-white ring-2 ring-navy" : "bg-white/60 ring-line hover:bg-white"}`}
                  >
                    <span className="block text-sm font-semibold">{pr.name}</span>
                    <span className="block text-xs text-ink-mute">{pr.cost ? inr(pr.cost) : "Free"}</span>
                    <span className="mt-1 block text-xs leading-snug text-ink-soft">{pr.blurb}</span>
                  </button>
                ))}
              </div>
            </section>

            {mid && (
              <section className="bg-plum p-5 text-white curve-br-sm">
                <StepTitle n={5} title={`Sealed bid: ${mid.title.toLowerCase()}`} note="Enter 0 if you don't want to bid. You only pay if you win." light />
                <label className="flex h-12 w-fit items-center rounded-xl bg-white px-3 text-ink">
                  <span className="text-ink-mute">₹</span>
                  <input
                    inputMode="numeric"
                    aria-label="Water rights bid"
                    value={dec.midBid ?? 0}
                    onChange={(e) => set({ midBid: Number(e.target.value.replace(/[^\d]/g, "")) || 0 })}
                    className="w-32 bg-transparent px-2 text-lg font-semibold tabular-nums outline-none"
                  />
                </label>
              </section>
            )}
          </>
        )}
      </div>

      {/* running total */}
      <aside className="h-fit bg-white p-5 ring-1 ring-line xl:sticky xl:top-28 curve-br">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-mute">Today&apos;s plan</p>
        <dl className="mt-3 grid gap-2 text-sm">
          <Row k="Cash now" v={inr(state.cash)} />
          <Row k="Stock" v={`− ${inr(spend?.inventory ?? 0)}`} />
          <Row k="Promotion" v={`− ${inr(spend?.promo ?? 0)}`} />
          {mid && <Row k="Water bid (if you win)" v={`− ${inr(spend?.mid ?? 0)}`} />}
          <div className="my-1 border-t border-line" />
          <Row k="Cash left to open" v={inr(state.cash - (spend?.total ?? 0))} strong />
        </dl>
        {product && (
          <p className="mt-3 text-xs text-ink-mute">
            To break even on stock and promotion you&apos;d need to sell about{" "}
            {dec.price > 0 ? Math.ceil(((spend?.inventory ?? 0) + (spend?.promo ?? 0)) / dec.price).toLocaleString("en-IN") : "–"} units.
          </p>
        )}
        {errors.length > 0 && productId && (
          <ul className="mt-3 grid gap-1 text-sm font-medium text-red">
            {errors.map((e) => (
              <li key={e}>• {e}</li>
            ))}
          </ul>
        )}
        <Button className="mt-4 w-full" disabled={!product || errors.length > 0 || dec.units + carried === 0} onClick={() => onSubmit(dec)}>
          Open the stall →
        </Button>
        {prevDec && <p className="mt-2 text-center text-xs text-ink-mute">Once the stall opens, today&apos;s plan is final.</p>}
      </aside>
    </div>
  );
}

function StepTitle({ n, title, note, light = false }: { n: number; title: string; note?: string; light?: boolean }) {
  return (
    <div className="mb-3">
      <h4 className="flex items-center gap-2.5 text-lg font-semibold">
        <span className={`grid size-7 place-items-center rounded-full text-sm ${light ? "bg-white text-plum" : "bg-navy text-white"}`}>{n}</span>
        {title}
      </h4>
      {note && <p className={`ml-9.5 text-sm ${light ? "text-white/75" : "text-ink-soft"}`}>{note}</p>}
    </div>
  );
}

function Step({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="h-12 min-w-12 rounded-xl bg-white px-3 text-sm font-semibold text-ink-soft ring-1 ring-line hover:bg-cream">
      {label}
    </button>
  );
}

function Row({ k, v, strong = false }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-soft">{k}</dt>
      <dd className={`tabular-nums ${strong ? "text-base font-bold text-ink" : "font-medium"}`}>{v}</dd>
    </div>
  );
}

/* ----------------------------------------------------------------- results -- */

function DayResults({ config, result: r, last, onNext }: { config: MelaConfig; result: DayResult; last: boolean; onNext: () => void }) {
  const p = config.products.find((x) => x.id === r.product)!;
  const costs = r.inventoryCost + r.promoCost + r.midCost;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-navy">End of day {r.day}</p>
      <h3 className="mt-1 font-serif text-4xl leading-tight">
        {r.profit >= 0 ? "You made " : "You lost "}
        <span className={r.profit >= 0 ? "text-ok" : "text-red"}>{inr(Math.abs(r.profit))}</span> today.
      </h3>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Sold" value={`${r.sold.toLocaleString("en-IN")}`} sub={`of ${r.stockAvailable.toLocaleString("en-IN")} ${p.name.toLowerCase()}`} />
        <Tile label="Revenue" value={inr(r.revenue + r.midBonus)} sub={r.midBonus ? `incl. ${inr(r.midBonus)} water sales` : `${r.sold} × ${inr(r.revenue / Math.max(1, r.sold))}`} />
        <Tile label="Costs" value={inr(costs)} sub={`stock ${inr(r.inventoryCost)} · promo ${inr(r.promoCost)}${r.midCost ? ` · water ${inr(r.midCost)}` : ""}`} />
        <Tile label="Neighbour's price" value={inr(r.competitorPrice)} sub={r.competitorName ?? "—"} />
      </div>
      <ul className="mt-5 grid gap-2 text-[0.95rem]">
        {r.soldOutAt && <Note icon="⏰">You sold out at {r.soldOutAt}. Customers kept coming after that.</Note>}
        {r.wasted > 0 && <Note icon="🗑">{r.wasted} unsold {p.name.toLowerCase()} spoiled overnight and were thrown away.</Note>}
        {r.carried > 0 && <Note icon="📦">{r.carried} unsold units carry over to tomorrow.</Note>}
        {r.discountApplied && <Note icon="🏷">You took the supplier&apos;s bulk discount.</Note>}
        {r.midWon === true && <Note icon="💧">You won the water rights. They earn for the rest of the mela.</Note>}
        {r.midWon === false && r.midBids && <Note icon="💧">The water rights went to another bidder for {inr(Math.max(...r.midBids))}.</Note>}
      </ul>
      <Button className="mt-6" onClick={onNext}>
        {last ? "See how the mela went →" : `Day ${r.day + 1} morning →`}
      </Button>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="animate-rise bg-white p-4 ring-1 ring-line curve-br-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-ink-mute">{label}</p>
      <p className="mt-1 font-serif text-3xl tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-soft">{sub}</p>}
    </div>
  );
}

function Note({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 rounded-xl bg-white/70 px-4 py-2.5 ring-1 ring-line">
      <span aria-hidden>{icon}</span>
      <span>{children}</span>
    </li>
  );
}

/* ----------------------------------------------------------------- summary -- */

function Summary({ config, state, practice }: { config: MelaConfig; state: GameState; practice: boolean }) {
  const max = Math.max(1, ...state.days.map((d) => Math.abs(d.profit)));
  return (
    <div className="grid gap-7 lg:grid-cols-[1fr_1.2fr]">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-navy">{practice ? "Practice complete" : "The mela is over"}</p>
        <h3 className="mt-1 font-serif text-4xl leading-tight">
          You finished with a {state.finalProfit >= 0 ? "profit" : "loss"} of{" "}
          <span className={state.finalProfit >= 0 ? "text-ok" : "text-red"}>{inr(Math.abs(state.finalProfit))}</span>.
        </h3>
        <p className="mt-3 text-ink-soft">
          That includes the {inr(state.stall?.paid ?? 0)} you paid for your stall
          {state.salvage ? `, and ${inr(state.salvage)} for leftover stock you can sell later` : ""}.{" "}
          {practice ? "The real game runs for four days." : "Next, you'll reflect on your decisions."}
        </p>
      </div>
      <div className="bg-white p-5 ring-1 ring-line curve-br-sm">
        <p className="text-sm font-semibold">Profit by day</p>
        <div className="mt-4 grid gap-2.5">
          {state.days.map((d) => {
            const p = config.products.find((x) => x.id === d.product)!;
            return (
              <div key={d.day} className="grid grid-cols-[3.5rem_1fr_5.5rem] items-center gap-3 text-sm">
                <span className="text-ink-soft">Day {d.day}</span>
                <span className="relative h-6">
                  <span
                    className="absolute top-0 h-full rounded-[3px]"
                    style={{
                      left: d.profit >= 0 ? "50%" : `${50 - (Math.abs(d.profit) / max) * 50}%`,
                      width: `${(Math.abs(d.profit) / max) * 50}%`,
                      background: d.profit >= 0 ? "var(--color-series-1)" : "var(--color-series-2)",
                    }}
                    title={`${p.name}: ${inr(d.profit)}`}
                  />
                  <span className="absolute left-1/2 top-0 h-full w-px bg-ink-mute" />
                </span>
                <span className="text-right font-semibold tabular-nums">{inr(d.profit)}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-ink-mute">Stall: {inr(-(state.stall?.paid ?? 0))} · leftover stock value: {inr(state.salvage)}</p>
      </div>
    </div>
  );
}
