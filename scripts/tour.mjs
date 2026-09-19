// Dev helper: walk through a program in real Chrome and screenshot each screen.
//   node scripts/tour.mjs <program> <outDir>
import { chromium } from "@playwright/test";
const [, , program = "bdes", out = "tour"] = process.argv;
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
let n = 0;
const shot = async (name, full = false) => {
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${out}/${String(++n).padStart(2, "0")}-${name}.png`, fullPage: full });
};

await page.goto(`http://localhost:3000/${program}`, { waitUntil: "networkidle" });
await shot("lobby-welcome", true);
await page.getByPlaceholder("e.g. Ananya Sharma").fill("Ananya Sharma");
await page.getByRole("checkbox").nth(0).check();
await page.getByRole("checkbox").nth(1).check();
await page.getByRole("button", { name: /Check my system/ }).click();
await page.getByRole("button", { name: /Try the tools|^Continue/ }).waitFor({ timeout: 15000 });
await page.waitForTimeout(1200);
await shot("system-check");
await page.getByRole("button", { name: /Try the tools|^Continue/ }).click();
await page.getByRole("button", { name: /I'm ready|Start the test/ }).first().waitFor();
if (await page.getByRole("button", { name: /I'm ready/ }).isVisible()) {
  await shot("practice", true);
  await page.getByRole("button", { name: /I'm ready/ }).click();
}
await shot("ready");
await page.getByRole("button", { name: /Start the test/ }).click();
await page.waitForURL(`**/${program}/test`);
await shot("section-intro");

const IMG = process.env.TOUR_IMG ?? new URL("../tests/fixtures/artwork.png", import.meta.url).pathname;
const next = () => page.getByRole("button", { name: /^Next/ }).click();
const finish = async () => {
  await page.getByRole("button", { name: /Finish section/ }).first().click();
  await page.getByRole("button", { name: /Yes, finish section/ }).click();
  await page.waitForTimeout(400);
};
const begin = () => page.getByRole("button", { name: /Begin section/ }).click();
const draw = async (box) => {
  const c = page.locator("canvas[aria-label^='Drawing area']");
  await c.scrollIntoViewIfNeeded();
  const r = await c.boundingBox();
  const pts = box ?? [[0.2, 0.3], [0.35, 0.25], [0.5, 0.4], [0.62, 0.62], [0.4, 0.75], [0.25, 0.6], [0.2, 0.3]];
  await page.mouse.move(r.x + pts[0][0] * r.width, r.y + pts[0][1] * r.height);
  await page.mouse.down();
  for (const [x, y] of pts.slice(1)) await page.mouse.move(r.x + x * r.width, r.y + y * r.height, { steps: 8 });
  await page.mouse.up();
};

if (program === "bdes") {
  await begin();
  await page.locator("input[type=file]").first().setInputFiles(IMG);
  await page.waitForTimeout(1200);
  await shot("d1-upload");
  await next();
  await page.locator("input[type=file]").first().setInputFiles(IMG);
  await page.waitForTimeout(800);
  await next();
  await page.locator("textarea").fill("I wanted the steel to look cold next to the warm window light. I would redo the shadows.");
  await shot("d1-text");
  await finish();
  await begin();
  await page.waitForFunction(() => document.querySelector("[role=application] img")?.complete);
  const scr = await page.getByRole("application").boundingBox();
  await page.getByRole("application").click({ position: { x: scr.width * 0.5, y: scr.height * 0.25 } });
  await page.locator("textarea").first().fill("Where is my usual order? I only see this sale.");
  await shot("d2-pins");
  await page.getByRole("button", { name: "Question 5" }).click();
  await page.getByRole("button", { name: /Draw on screen/ }).click();
  await draw([[0.45, 0.3], [0.55, 0.3], [0.55, 0.6], [0.45, 0.6], [0.45, 0.3]]);
  await shot("d2-sketch");
  await finish();
  await begin();
  await page.locator("main input[type=radio]").nth(2).check({ force: true });
  await shot("d3-q1");
  for (let i = 0; i < 4; i++) await next();
  await shot("d3-hierarchy", true);
  for (let i = 0; i < 7; i++) await next();
  // poster layout: drag date to top
  const tray = page.getByRole("button", { name: /^Date\./ });
  const board = await page.getByRole("application").boundingBox();
  const tb = await tray.boundingBox();
  await page.mouse.move(tb.x + 20, tb.y + 15);
  await page.mouse.down();
  await page.mouse.move(board.x + board.width / 2, board.y + 70, { steps: 10 });
  await page.mouse.up();
  const hb = await page.getByRole("button", { name: /^Headline\./ }).boundingBox();
  await page.mouse.move(hb.x + 20, hb.y + 15);
  await page.mouse.down();
  await page.mouse.move(board.x + board.width / 2, board.y + 200, { steps: 10 });
  await page.mouse.up();
  await page.getByRole("button", { name: /^Image\./ }).focus();
  await page.keyboard.press("Enter");
  await shot("d3-layout");
  await finish();
  await begin();
  await shot("d4-brief");
  await page.getByRole("button", { name: /Draw on screen/ }).click();
  await draw([[0.05, 0.3], [0.2, 0.2], [0.25, 0.7]]);
  await draw([[0.4, 0.3], [0.55, 0.5], [0.45, 0.8]]);
  await draw([[0.75, 0.2], [0.9, 0.5], [0.72, 0.8]]);
  await shot("d4-thumbs");
  await next();
  await page.getByRole("button", { name: /Draw on paper/ }).click();
  await shot("d4-photo-qr");
  await next();
  await page.locator("textarea").fill("For my dadi. A pill box with a sliding lid for each dose; it fails if refills are forgotten.");
  await finish();
  await begin();
  await page.locator("textarea").fill("Taste and judgement: knowing which of the hundred options fits the people who will use it.");
  await shot("d5-text");
  await finish();
  await page.waitForURL("**/done");
  await shot("done", true);
  await page.goto(`http://localhost:3000/${program}/review`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "3" }).first().click();
  await shot("review", true);
}

if (program === "bpsych") {
  await begin();
  await shot("p1-passage");
  await page.locator("main input[type=checkbox]").nth(0).check({ force: true });
  await next();
  await page.locator("main input[type=radio]").nth(2).check({ force: true });
  await shot("p1-q2");
  for (let i = 0; i < 5; i++) await next();
  await page.locator("textarea").fill("Track sleep with a wrist tracker for 100 students for a month, and randomly ask half to put phones away at 9 pm.");
  await page.locator("textarea").dispatchEvent("paste");
  await shot("p1-design-paste-blocked");
  await finish();
  await begin();
  await shot("p2-chart");
  for (let i = 0; i < 3; i++) await next();
  await shot("p2-truncated");
  await finish();
  await begin();
  await page.getByRole("button", { name: /practice rounds/ }).click();
  const answerTrials = async (n) => {
    for (let k = 0; k < n; k++) {
      const key = await page.evaluate(() => {
        const el = [...document.querySelectorAll("span")].find((s) => /^(RED|GREEN|BLUE|YELLOW)$/.test(s.textContent ?? "") && s.style.color);
        if (!el) return null;
        const map = { "rgb(211, 47, 47)": "r", "rgb(46, 125, 50)": "g", "rgb(21, 101, 192)": "b", "rgb(224, 168, 0)": "y" };
        return map[el.style.color] ?? null;
      });
      if (!key) {
        await page.waitForTimeout(120);
        k--;
        if (await page.getByText(/Ready for the real run|Your results/).count()) return;
        continue;
      }
      await page.waitForTimeout(k % 2 ? 380 : 520);
      await page.keyboard.press(key);
    }
  };
  await answerTrials(6);
  await shot("p3-ready");
  await page.getByRole("button", { name: /minute run/ }).click();
  await page.waitForTimeout(600);
  await shot("p3-stroop-trial");
  await answerTrials(80);
  await page.getByText(/Your results/).waitFor({ timeout: 60000 });
  await shot("p3-results", true);
  await next();
  await page.locator("textarea").fill("I was slower when the word said a different colour. Reading seems automatic, so it fights with naming the ink.");
  await finish();
  await begin();
  await shot("p4-comic", true);
  await finish();
  await begin();
  await page.getByRole("button", { name: "Move down" }).first().click();
  await shot("p5-ranking");
  for (let i = 0; i < 5; i++) await next();
  await finish();
  await begin();
  await page.locator("textarea").fill("I would survey night owls and early birds and give both the same creativity task.");
  await finish();
  await page.waitForURL("**/done");
  await page.goto(`http://localhost:3000/${program}/review`, { waitUntil: "networkidle" });
  await shot("review", true);
}

if (program === "bbae") {
  await begin();
  await page.locator("main input[type=radio]").nth(2).check({ force: true });
  await shot("b1-q1");
  await finish();
  await begin();
  await shot("b2-case");
  await finish();
  await begin();
  await shot("b3-tutorial");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: /^Next$/ }).click();
  await page.getByRole("button", { name: /Go to the stall auction/ }).click();
  await page.getByRole("radio", { name: /Next to the food court/ }).click();
  await page.getByRole("textbox").fill("15000");
  await shot("b3-auction");
  await page.getByRole("button", { name: /Submit sealed bid/ }).click();
  await page.getByRole("button", { name: /Yes, submit/ }).click();
  await shot("b3-reveal");
  const plans = [
    ["chai", 560, 42, "none"],
    ["chai", 460, 46, "none"],
    ["chai", 540, 38, "banner"],
    ["chai", 700, 42, "loudspeaker"],
  ];
  for (let d = 0; d < 4; d++) {
    await page.getByRole("button", { name: /morning/ }).click();
    if (d === 1 || d === 2) await shot(`b3-day${d + 1}-news`);
    await page.getByRole("button", { name: /Plan today/ }).click();
    if (d === 0) await page.getByRole("radio", { name: /Chai & snacks/ }).click();
    const [, units, price, promo] = plans[d];
    await page.locator("input[inputmode=numeric]").nth(0).fill(String(units));
    await page.getByLabel("Price per unit").fill(String(price));
    await page.getByRole("radio", { name: new RegExp(promo === "none" ? "No promotion" : promo === "banner" ? "^Banner" : "Loudspeaker") }).click();
    if (d === 2) await page.getByLabel("Water rights bid").fill("8000");
    if (d === 2) await shot("b3-plan", true);
    await page.getByRole("button", { name: /Open the stall/ }).click();
    if (d === 0 || d === 3) await shot(`b3-day${d + 1}-results`);
  }
  await page.getByRole("button", { name: /See how the mela went/ }).click();
  await shot("b3-summary");
  await next();
  await page.locator("textarea").fill("Best: matching the neighbour's price cut with a banner. Worst: understocking on the last day.");
  await finish();
  await begin();
  const tas = page.locator("textarea");
  await tas.nth(0).fill("We help hostel students eat home-style food by pooling orders from local aunties.");
  await tas.nth(1).fill("My hostel mess serves the same dal every day and 30 of us order out nightly.");
  await tas.nth(2).fill("Aunties may not want to cook at scale.");
  await shot("b4-pitch");
  await finish();
  await page.getByRole("button", { name: /Skip this section/ }).click();
  await page.waitForURL("**/done");
  await page.goto(`http://localhost:3000/${program}/review`, { waitUntil: "networkidle" });
  await shot("review", true);
}

if (errors.length) console.log(errors.join("\n"));
await browser.close();
