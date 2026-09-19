# PRD: Stage 2 Aptitude Test Platform (v1)
### Programs in scope: B.Design · B.Psych · BBA Entrepreneurship

---

## 0. Instructions for Claude Code (read first)

You are building v1 of an online, timed, program-specific aptitude test for undergraduate admissions at an Indian university. Read this entire document before writing code.

1. Start by proposing a short implementation plan and folder structure that follows the milestones in Section 11. Wait for approval before building.
2. Build milestone by milestone. At the end of each milestone, run the app, write/run tests, and summarise what works and what's stubbed.
3. **All test content (questions, cases, game parameters, rubrics) must live in config/seed files, not hard-coded in components.** Faculty will rewrite the content; engineers should never have to.
4. Where this PRD is ambiguous, pick the simplest option that keeps the P2 items possible, and list the assumption in `DECISIONS.md`.
5. Sample content in this PRD is placeholder quality. Seed it as-is so the flows can be tested end to end.

---

## 1. Problem statement

Board marks and national entrance exams don't measure what predicts success in design, psychology, or entrepreneurship programs: visual thinking, scientific reasoning about people, or commercial judgment. Take-home essays and portfolios are increasingly unreliable because of generative AI and paid help. The university needs its own proctored, engaging test that produces comparable, defensible scores for each program and feeds shortlisted candidates into the Stage 3 live evaluation.

## 2. Goals

1. A candidate can complete a full program test (90–120 min) in a browser on a laptop, with autosave and resume, and with a completion rate of at least 95% among those who start.
2. Every section produces either an automatic score or a rubric-ready submission that evaluators can score blind, with two independent raters per subjective item.
3. The test is meaningfully harder to outsource or AI-assist than an essay: timed, live, pastes blocked, activity logged.
4. Content for all three programs is editable through config files without code changes.
5. The experience feels like a well-designed product, not a government exam portal. Candidates should come away with a positive impression of the university.

## 3. Non-goals (v1)

- **Application form, payments, eligibility (Stage 1)** – separate system; v1 accepts candidates via CSV import or an invite link.
- **B.Tech CS & AI test** – next version; the engine must support adding it by config.
- **Full AI/webcam proctoring** – privacy, cost, and bandwidth concerns; v1 uses lightweight integrity signals only (Section 8).
- **Multiplayer live auction** – synchronisation and fairness are hard; v1 runs against scripted bots with identical conditions for every candidate.
- **Hindi and regional languages** – v1 is English only, but all strings go through an i18n layer.
- **Native mobile apps** – responsive web only; the test itself requires a laptop/desktop, except the phone upload handoff.

## 4. Users

- **Candidate** – 17–18 years old, mixed English fluency, variable internet (tier-2/3 towns), often on a shared or low-end laptop.
- **Evaluator** – faculty member scoring subjective responses with rubrics.
- **Admin** – admissions office staff managing candidates, test windows, content, and results.

## 5. User stories

**Candidate**
- As a candidate, I want to do a system check (browser, camera optional, connection speed) before the test so I don't fail midway.
- As a candidate, I want a short untimed practice screen for each question type, especially the drawing canvas and the game, so the interface itself isn't what's being tested.
- As a candidate, I want my answers to save automatically and my timer to resume correctly if my internet drops, so I don't lose work.
- As a candidate who draws better on paper than with a mouse, I want to draw on paper and upload a photo from my phone, so I'm not penalised for not owning a drawing tablet.
- As a candidate, I want clear section timers and warnings at 5 and 1 minute remaining.

**Evaluator**
- As an evaluator, I want to see responses without the candidate's name, school, city, or photo, so my scoring isn't biased.
- As an evaluator, I want the rubric and anchor examples next to the response, so I score consistently.
- As an evaluator, I want to score one item across many candidates in a row (item-wise, not candidate-wise), which is faster and more consistent.

**Admin**
- As an admin, I want to import candidates, assign them a program and test window, and send login links.
- As an admin, I want to see live progress (not started / in progress / submitted / flagged).
- As an admin, I want a results table with section scores, composite score, rater disagreement flags, and integrity flags, exportable to CSV.

---

## 6. Test engine (shared across programs)

### 6.1 Structure
`Program → Test → Sections → Items`. Each section has its own timer. Candidates cannot return to a closed section. Within a section, they can move freely between items unless the item is marked `locked_sequence` (e.g. the game).

### 6.2 Item types (build all as reusable components)

| Type key | Description | Scoring |
|---|---|---|
| `mcq_single` | Single correct answer, may include images | Auto |
| `mcq_multi` | Multiple correct, partial credit configurable | Auto |
| `ranking` | Drag to order options (used for situational judgment) | Auto, distance from expert key |
| `short_text` | Word-limited text, paste disabled | Rubric |
| `long_text` | Word-limited text (≤300 words), paste disabled | Rubric |
| `drawing_canvas` | In-browser canvas: pen, pencil, eraser, 6 colours, 3 stroke widths, undo/redo, clear | Rubric |
| `photo_upload` | Upload from device **or** scan a QR code to upload from phone within the section time | Rubric |
| `layout_drag` | Drag given shapes/text blocks onto an artboard | Rubric, with optional auto-checks |
| `stimulus_passage` | Passage, chart, or table shown alongside a group of items | – |
| `interactive_task` | Embeds a mini-app (Stroop demo, auction game) that emits a structured result log | Auto + rubric |

Every item has: `id`, `type`, `prompt`, `media[]`, `time_hint`, `max_score`, `scoring` (auto key or `rubric_id`), `pool_id` (for randomisation), `tags[]` (trait measured, difficulty).

### 6.3 Core behaviours (P0)
- Server-authoritative timers (server stores section start time; client only displays).
- Autosave every 10 seconds and on every item change; offline queue that syncs on reconnect.
- Resume after disconnect or browser crash, with remaining time intact. Admin can grant extra time.
- Items drawn randomly from pools per candidate, with a stored seed so the exact paper is reproducible.
- Drawing canvas saves vector strokes (JSON) and a PNG export. Must work with mouse, trackpad, touch, and stylus (pointer events, pressure if available).
- Accessibility: keyboard navigation for all non-drawing items, WCAG AA contrast, font-size toggle, admin-configurable extra time per candidate.
- Performance: usable on a 2 Mbps connection; initial load under 3 s on a mid-range laptop.

---

## 7. Program test content

Durations are starting points and should be config values. Sample content is placeholder.

### 7.1 B.Design (≈120 min)

**Traits measured:** observation, visual thinking, ideation, visual literacy, reflective thinking.

**Section D1 – Best Work (pre-test, untimed, submitted up to 48 h before the test)**
- `photo_upload`: 1–3 images of the candidate's best drawing, painting, or other visual work.
- `short_text` (80 words): "What were you trying to do in this piece, and what would you change?"
- One **work-in-progress photo or rough sketch** of the same piece is required.
- Scored lightly (see rubric). Its main purpose is to be discussed in the Stage 3 interview, where the candidate explains their process live. Evaluators flag suspected non-original work.

**Section D2 – Observation Drawing (25 min)**
- Candidate is shown a high-resolution photo of an everyday scene (e.g. a cluttered kitchen shelf with steel utensils, a pressure cooker, and a plant).
- Task: "Draw this scene. Focus on proportion, light, and texture, not neatness."
- Response via `drawing_canvas` **or** `photo_upload` of a paper drawing (candidate chooses at the start of the section; paper drawings must be photographed within the section time).
- Variant pool of at least 4 scenes.

**Section D3 – Visual Literacy & Gestalt (20 min, auto-scored)**
12–15 items, e.g.:
- Show 4 logos; "Which one relies on *closure* to be read?" (`mcq_single`)
- Show a dot pattern; "Which grouping principle makes you see three columns rather than rows?" → proximity / similarity / continuity / common region.
- Figure–ground: "What are the two images you can see in this composition?"
- Hierarchy: show two versions of the same event poster; "Which communicates the date faster, and why?" (`mcq_single` with reasoning options).
- `layout_drag`: given a headline, image, date, and venue block, arrange a poster for a college fest so the date is noticed within 3 seconds. (Rubric-scored.)
- Colour: "Which palette would be least legible for a person with red–green colour blindness?"

**Section D4 – Design a Solution for an Everyday Problem (35 min)**
- Prompt pool, e.g.:
  - "In a joint family, an elderly grandparent takes five medicines a day and often forgets whether they've taken them. Design something that helps."
  - "Street vendors lose customers when it rains. Design something that helps."
  - "Students waiting at a crowded bus stop can't tell when their bus will arrive. Design something that helps."
- Required output:
  1. `drawing_canvas` / `photo_upload`: at least 3 quick idea thumbnails.
  2. `drawing_canvas` / `photo_upload`: one idea developed with annotations.
  3. `short_text` (120 words): who it's for, how it works, one way it could fail.

**Section D5 – Future of Design (15 min)**
- `long_text` (200 words), prompt pool, e.g.:
  - "An AI tool can now generate a hundred logo options in ten seconds. What will a designer be paid for in 2035?"
  - "Pick one object in your home that should be redesigned for a world with more elderly people. What would you change?"
  - "Design is often judged by how things look. Describe a design you admire for a reason other than appearance."

**Rubrics (1–4 scale each)**
- D1 Best Work: technical skill, originality/voice, reflection quality.
- D2 Observation: proportion & perspective, light & tone, attention to detail. *Explicitly not neatness or medium.*
- D4 Problem solving: understanding of the user, number and range of ideas, feasibility, communication through sketches.
- D5: original thinking, specificity, awareness of people and consequences.

**Weighting (config):** D1 10% · D2 25% · D3 15% · D4 35% · D5 15%

---

### 7.2 B.Psych (≈100 min)

**Traits measured:** scientific reasoning, data literacy, observation vs inference, empathy and ethical judgment, curiosity.

**Section P1 – Reading Research (25 min, mostly auto-scored)**
- `stimulus_passage`: a plain-language summary (~350 words) of a study, e.g. "Teenagers who used their phones for more than 3 hours after 9 pm reported 40 minutes less sleep, in a survey of 600 students in two Delhi schools."
- 6–8 items: What was actually measured? Does this show phones *cause* less sleep? Name a possible confounding factor. Would the result likely hold for rural students? What would a better study look like?
- Mix of `mcq_single`, `mcq_multi`, and one `short_text` (60 words) on study design.

**Section P2 – Data Interpretation (15 min, auto-scored)**
- 8–10 items on bar charts, tables, and simple averages drawn from psychology-flavoured data (e.g. exam anxiety scores before and after a mindfulness workshop, with and without a control group).
- Includes at least one misleading chart (truncated y-axis) to spot.
- Only Class 10-level math required.

**Section P3 – Experience & Explain: Stroop Task (15 min)**
- `interactive_task`: candidate plays a 2-minute Stroop test (colour words shown in mismatched ink; respond to the ink colour). The app shows their own reaction times for matched vs mismatched trials.
- Then `short_text` (100 words): "What did you notice about your own responses? What might this suggest about how the mind processes information?"
- **The candidate's reaction time is never scored**, only the quality of the explanation. The raw log is stored for reference.

**Section P4 – Observation vs Inference (15 min)**
- Show a short illustrated comic strip (4–6 panels, no text) of a social scene, e.g. a student sitting alone in a canteen while a group laughs nearby, then leaving.
- `short_text` (120 words) in two labelled boxes: "What did you directly observe?" and "What might each person be thinking or feeling, and what in the image makes you think so?"
- Rubric rewards separating observation from interpretation and offering more than one possible explanation.

**Section P5 – Situational Judgment (20 min, auto-scored)**
- 6–8 scenarios, each with 4 responses to **rank** from most to least appropriate (`ranking`), scored against a key agreed by 3+ faculty. Examples:
  - A friend tells you they've felt low for several weeks and asks you to keep it a secret.
  - During a group project, one member's idea is repeatedly ignored because they speak less English.
  - You're volunteering on a survey and notice a teammate filling in forms without interviewing anyone.
  - A relative asks you, as "the psychology student", to diagnose a cousin's behaviour.
- Scenario wording must be reviewed for sensitivity; avoid graphic or distressing detail.

**Section P6 – Curiosity Question (10 min)**
- `long_text` (150 words), pool, e.g.:
  - "A viral reel claims that 'people who sleep late are more creative.' How would you find out if that's true?"
  - "Describe something about human behaviour you've noticed in your own life that you can't fully explain."

**Rubrics (1–4 scale each)**
- P1 short answer / P6: scientific reasoning, recognition of alternative explanations, clarity.
- P3: accurate description, plausible explanation, links to a broader idea.
- P4: separation of observation and inference, multiple perspectives, empathy without assumption.

**Weighting (config):** P1 20% · P2 15% · P3 15% · P4 15% · P5 20% · P6 15%

---

### 7.3 BBA Entrepreneurship (≈110 min)

**Traits measured:** commercial reasoning, numeracy, decision-making under uncertainty, initiative, communication.

**Section B1 – Business Numeracy (15 min, auto-scored)**
- 10 quick items: margins, break-even, percentage change, simple unit economics.
- Example: "A tiffin service charges ₹120 per meal. Ingredients cost ₹55, packaging ₹10, delivery ₹20. How many meals per month cover ₹42,000 of rent and salaries?"

**Section B2 – Business Case (30 min)**
- `stimulus_passage`: 1-page case with a small data table. Example: *"Rasoi Express"* – a cloud kitchen in a tier-2 city. Orders grew 60% in 6 months after heavy discounting on food apps, but monthly profit fell. The founder wants to open a second outlet.
- Items:
  - `mcq_single` ×4: interpret the data (which month was least profitable, effect of discounts on contribution margin, etc.).
  - `mcq_single` ×2: spot the flaw in the founder's reasoning.
  - `long_text` (150 words): "Should the founder open the second outlet now? What would you do in the next 90 days instead or first?"
- Case pool of at least 3 (e.g. cloud kitchen, a school stationery D2C brand, a two-wheeler repair app).

**Section B3 – "Mela Market" Auction Game (35 min, including 5 min tutorial)**

An `interactive_task` single-player simulation against scripted bot competitors.

*Setup:* The candidate runs a stall at a 4-day city festival mela with ₹1,00,000 virtual capital.

*Round 0 – Stall auction:* Sealed-bid auction for one of 4 stall locations (near entrance, near food court, near rides, back corner), each with different footfall forecasts. 3 bots bid using fixed strategies. Candidate sees footfall estimates but not bot bids.

*Rounds 1–4 (one per festival day):* each day the candidate:
1. Chooses a product mix from 3 options (e.g. chai & snacks, phone accessories, handmade decor) — can switch once.
2. Buys inventory (unsold perishable stock is lost; non-perishable carries over).
3. Sets a price.
4. Optionally spends on promotion (banner, loudspeaker announcement, influencer reel).
5. Sees results: units sold, revenue, cost, profit, competitor prices.

*Events* are revealed at the start of each day, e.g. "Rain forecast for evening", "A competitor next door cuts prices by 20%", "A local cricket star is visiting the rides section", "Supplier offers 15% off if you buy double stock". One day also offers a **mid-game auction** for a limited extra item (e.g. exclusive rights to sell water near the stage).

*Fairness requirements (P0):*
- Every candidate in a test window gets the **same seed**: identical events, demand curves, and bot behaviour. Results depend only on decisions.
- Demand model is a simple, documented function of footfall × location × price elasticity × promotion × event modifiers, defined in a config file so faculty can tune it.
- The game must be fully playable with keyboard and mouse, with no reflex or speed component.

*Scoring:*
- 50% **outcome**: final profit percentile within the test window.
- 50% **decision quality**, auto-computed from the decision log, e.g.: did the stall bid exceed its expected value? Did they adjust price or stock after the rain event? Did they avoid overbuying perishables? Did they react to the competitor's price cut sensibly?
- `short_text` (100 words) after the game: "What was your best and worst decision, and what would you do differently?" (rubric-scored, counted within B4 weighting below).

**Section B4 – Startup One-Liner (15 min)**
- `short_text`, strict limits:
  1. **One-liner (max 20 words):** "We help [who] do [what] by [how]."
  2. **Why this problem is real (60 words):** evidence from your own life or observation.
  3. **Biggest risk (40 words):** the main reason this could fail.
- Rubric: clarity, specificity of the customer, grounding in real observation, honesty about risk.

**Section B5 – Initiative Evidence (optional, 10 min)**
- `short_text` (100 words): "Describe something you've started, sold, organised, or fixed, however small. What happened?"
- Not scored in v1; passed to Stage 3 interviewers as a conversation starter.

**Weighting (config):** B1 15% · B2 25% · B3 35% · B4 (incl. game reflection) 25%

---

## 8. Integrity (v1, lightweight)

**P0**
- Unique single-use login links plus OTP to the registered email/phone; one active session per candidate.
- Fullscreen request at start; log every exit from fullscreen and every tab/window blur, with timestamps.
- Paste blocked in `short_text` / `long_text`; log paste attempts.
- Keystroke timing summary for text answers (e.g. long bursts of instant text), stored as a flag, **never** an automatic penalty.
- Randomised item pools per candidate.
- Integrity flags visible to admins and Stage 3 interviewers, not to first-round evaluators (to avoid biasing scores).

**P1**
- Optional webcam snapshots at random intervals with explicit consent, stored securely and auto-deleted after the admissions cycle.

**Principle:** flags trigger human review or extra questioning at Stage 3. The system never auto-rejects a candidate.

---

## 9. Evaluator and admin requirements

### Evaluator portal (P0)
- Item-wise scoring queue with blinded responses (no name, school, city, photo, integrity flags).
- Rubric panel with criteria, score descriptors, and anchor examples.
- Each subjective response is automatically assigned to 2 evaluators; if their scores differ by more than 1 point on any criterion, it goes to a third.
- Evaluators can flag "suspected non-original work" with a comment.
- Calibration mode: admin selects 10 sample responses that all evaluators score first; dashboard shows agreement.

### Admin portal (P0)
- CSV import of candidates (name, email, phone, program, test window, accommodations).
- Test window management (open/close times, seed for the game).
- Live monitoring dashboard.
- Results table: section scores, weighted composite, rater disagreement, integrity flags; filter by program; CSV export.
- Content management via editing JSON/YAML seed files and re-running a seed command is acceptable for v1. A UI editor is P2.

---

## 10. Technical requirements

**Suggested stack** (Claude Code may propose alternatives in `DECISIONS.md`):
- Next.js (App Router) + TypeScript + Tailwind CSS
- PostgreSQL with Prisma
- Auth: email/phone OTP (use a mock provider in development)
- Canvas: `perfect-freehand` or Konva for drawing; store strokes as JSON
- File storage: S3-compatible bucket (local MinIO or filesystem in development); client-side image compression before upload
- Game and Stroop as isolated React modules with a pure, unit-tested simulation core (no UI logic in the engine)
- Deployed in an India region for latency and data localisation

**Core data model (minimum)**
`Candidate`, `Program`, `Test`, `Section`, `Item`, `ItemPool`, `TestWindow`, `Attempt`, `SectionAttempt`, `Response` (JSON payload + files), `GameLog`, `IntegrityEvent`, `Rubric`, `RubricCriterion`, `Evaluator`, `ScoreAssignment`, `Score`, `Accommodation`.

**Security & compliance**
- Role-based access (candidate / evaluator / admin).
- Consent screen at start covering data collected, integrity logging, and retention, in line with India's DPDP Act, 2023.
- Candidates are likely minors (17): consent copy must be reviewed by legal; parental consent may be required.
- Configurable data retention; delete uploads and logs after the cycle ends.

**Testing**
- Unit tests for scoring functions, ranking-distance scoring, game simulation (same seed ⇒ identical outcomes), and timer logic.
- End-to-end test (Playwright) of one full attempt per program, including a simulated disconnect and resume.

---

## 11. Milestones

1. **M1 – Foundation:** project setup, data model, auth (mock OTP), admin CSV import, seed-file loader.
2. **M2 – Test engine:** sections, timers, autosave/resume, `mcq_single`, `mcq_multi`, `ranking`, `short_text`, `long_text`, `stimulus_passage`, system check, practice screens.
3. **M3 – Creative item types:** `drawing_canvas`, `photo_upload` with phone QR handoff, `layout_drag`. Build the full B.Design test.
4. **M4 – Interactive tasks:** Stroop module and full B.Psych test.
5. **M5 – Mela Market game:** simulation core with tests, UI, decision-quality scoring, full BBA-E test.
6. **M6 – Integrity + evaluator portal:** integrity logging, blinded scoring queue, double rating, calibration mode.
7. **M7 – Results + polish:** composite scoring, results export, accessibility pass, performance on slow connections, E2E tests.

## 12. Success metrics

**Leading (first test window)**
- ≥95% of starters submit a complete test.
- <2% of attempts need manual admin intervention for technical issues.
- Median evaluator time per subjective item under 3 minutes.
- Inter-rater agreement: ≥80% of double-scored responses within 1 point.
- Post-test survey: ≥70% of candidates rate the experience 4/5 or higher.

**Lagging (after first year)**
- Correlation between Stage 2 composite and first-year GPA / faculty ratings, reported per section. Sections with near-zero predictive value are redesigned or cut.
- No significant score gap by board type or city tier that isn't explained by the traits measured (checked by the data team).

## 13. Open questions

- **[Faculty – blocking before content lock]** Final prompts, SJT answer keys, and rubric anchors for each program.
- **[Admissions – blocking]** Should the Best Work upload (D1) be scored or used only for Stage 3 discussion?
- **[Legal – blocking]** Consent requirements for 17-year-old candidates, webcam use, and data retention period.
- **[Faculty/Data – non-blocking]** Tuning the Mela Market demand model so outcomes aren't dominated by the stall auction.
- **[Admissions – non-blocking]** Physical test centres for candidates without a laptop, and whether they use the same platform on centre machines.
- **[Engineering – non-blocking]** Hosting provider and budget.

## 14. Future considerations (P2 – design for, don't build)

- B.Tech CS & AI test (code-reasoning item type).
- Hindi and regional language versions.
- Common reasoning section shared across all programs.
- Multiplayer live auction for Stage 3 group evaluation.
- In-browser content editor for faculty.
- Integration with the Stage 1 application platform and Stage 3 interview scheduling.
