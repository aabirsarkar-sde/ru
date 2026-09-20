# Stage 2 Aptitude Test — Rishihood University (v1 prototype)

A browser-based, timed, programme-specific aptitude test for **B.Design**, **B.Psych** and
**BBA Entrepreneurship**, built from `PRD_Stage2_Aptitude_Platform_v1.md` and styled to the
*Rishihood University Brand Guidelines 2023*.

This prototype focuses on the **candidate experience and the creative item types**. Auth,
database and proctoring are intentionally lightweight or stubbed — see [`DECISIONS.md`](DECISIONS.md).

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
```

Then pick a programme on the home page. Useful while reviewing:

- **Demo tools** (bottom-left button during a section): jump the timer to 5:04 / 1:04 / 0:04
  to see the warnings and auto-close, or reload to see resume.
- **Evaluator preview**: after submitting, open `/<programme>/review` (linked from the
  confirmation page) to score the blinded submission with rubrics and watch the composite update.
- **Phone upload**: on any upload/drawing item, scan the QR code with a phone on the same Wi-Fi.
- **Real app screenshots for D2**: put the image in `public/media/bdes/ux/`, point `image.src` at it
  in `content/programs/bdes.yaml`, and adjust the problem `zones` (percentages of the image).
- **Start over**: the programme start page offers "Start over (demo)" once an attempt exists.

## What's in it

| Programme | Sections | Highlights |
|---|---|---|
| B.Design | D1–D5 | **D1 Best Work** — photos of their strongest piece, a short reflection, then an optional **portfolio** (links and/or PDF/image uploads). **D2 Design for People** — a persona (Kamla-ji, 68, on a grocery app; or Farida, one-handed with a toddler, on a food app): pin-and-annotate where they get stuck, spot designs that work against them, rank fixes for *them*, a says/thinks/feels/does map (including the delivery rider's side), a phone-frame redesign sketch, and the app message they should see. Plus a pressure-sensitive drawing canvas with a draw-on-paper + phone photo alternative, gestalt/visual-literacy items, a poster layout board, and a design brief with 3-thumbnail guides. **D3 How People See & Choose** covers gestalt *and* choice/attention/memory effects (Hick, Fitts, Jakob, Miller, Von Restorff, peak–end) — always as "which version works better for this person, and why", never by name |
| B.Psych | P1–P6 | Split-screen research passage; accessible SVG charts incl. a deliberately truncated axis; Stroop task with the candidate's own results (never scored); wordless comic strip; drag-to-rank situational judgement |
| **All three** | **C1 Contribution** (shared) | One common section, defined once in `content/common/contribution.yaml`: Part 1 — a specific problem in India they care about, what they've actually done about it, and one working day a month ten years from now; Part 2 — how they'd spend five free hours a week (allocation sliders), what they'd do in a club/fest/clan in their first 90 days, and two situational-judgement rankings on following through and including people |
| BBA-E | B1–B5 | Numeracy with rough-work pad; 3 business cases (pooled); **Mela Market** — sealed-bid stall auction on an illustrated mela map, 4 festival days with news events, product/stock/price/promotion decisions, a mid-game water-rights auction, and decision-quality scoring |

Shared engine: section timers derived from stored start times (resume after crash/offline),
autosave on every change + every 10 s to IndexedDB, seeded item pools per candidate, paste
blocking in written answers, keyboard access for every non-drawing item, text-size toggle,
per-candidate extra time, system check, and untimed practice of the tools (B.Psych, BBA-E).

## Editing content (no code changes)

All questions, cases, game parameters and rubrics live in `/content`:

```
content/programs/bdes.yaml | bpsych.yaml | bbae.yaml   sections, items, pools, weights
content/common/contribution.yaml                       the shared C1 section (all programmes)
content/rubrics.yaml                                  criteria, 1–4 descriptors, anchors
content/games/mela-market.yaml                         demand model, events, bots, scoring
content/games/stroop.yaml                              colours, trials, timing
public/media/**                                        images referenced by the YAML
scripts/gen-ux-screens.py                              regenerates the made-up D2 app screens
scripts/gen-d3-figures.py                              regenerates the D3 A/B comparison figures
```

After editing, run the validator (the v1 "seed" step) — it checks the schema, answer keys,
rubric references, section weights, media files and common YAML slips:

```bash
npm run content:check
npm run mela:report    # what each stall spot is worth under the current demand model
```

In development, pages re-read the YAML on every request, so a refresh shows your change.

## Tests

```bash
npm test               # unit: scoring, ranking distance, timers, paper seeding, Stroop, Mela fairness
npm run test:e2e       # Playwright: a full attempt per programme incl. offline + reload/resume,
                       # timer expiry, and phone → desktop photo handoff (uses local Chrome)
```

## Layout

```
src/engine/        pure, framework-free logic (unit-tested)
  prng.ts paper.ts timer.ts scoring.ts stroop.ts mela/{sim,score,types}.ts
src/content/       zod schema + YAML loader
src/items/         one component per item type + registry (ItemRenderer.tsx)
src/modules/       interactive tasks: Stroop.tsx, MelaMarket.tsx
src/app/           pages: landing, [program] lobby, test runner, done, evaluator review, phone upload, APIs
public/brand/      official logo/crest extracted unmodified from the brand-guidelines PDF
```
