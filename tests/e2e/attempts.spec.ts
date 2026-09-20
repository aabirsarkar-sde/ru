import { expect, test } from "@playwright/test";
import {
  ARTWORK,
  begin,
  doContributionSection,
  disconnectAndResume,
  drawStroke,
  expectSubmitted,
  finishSection,
  next,
  pickOption,
  startTest,
  timerSeconds,
} from "./helpers";

test("B.Design: full attempt with drawing, upload, layout, disconnect and resume", async ({ page }) => {
  await startTest(page, "bdes");

  // D1 — untimed pre-test: work photos, reflection, optional portfolio
  await begin(page);
  await page.locator("input[type=file]").first().setInputFiles(ARTWORK);
  await expect(page.getByText("1/3 uploaded ✓")).toBeVisible();
  await next(page);
  await page.locator("textarea").fill("I wanted the steel to feel cold against warm light.");
  await next(page);
  await page.getByRole("textbox", { name: "Portfolio link 1" }).fill("behance.net/ananya");
  await page.locator("input[type=file]").setInputFiles(ARTWORK);
  await expect(page.getByText("artwork.png")).toBeVisible();
  await finishSection(page);

  // D2 — Design for People: pin problems on an app screen, then drop the
  // connection and crash mid-section; pins and notes must survive.
  await begin(page);
  const tapScreen = async (fx: number, fy: number) => {
    await expect(page.locator("[role=application] img")).toHaveJSProperty("complete", true);
    const box = (await page.getByRole("application").boundingBox())!;
    await page.getByRole("application").click({ position: { x: box.width * fx, y: box.height * fy } });
  };
  await tapScreen(0.5, 0.25);
  await page.locator("textarea").first().fill("Where do I tap for my usual milk? This sale is all I see.");
  await disconnectAndResume(page, async () => {
    await tapScreen(0.5, 0.92);
    await page.locator("textarea").nth(1).fill("These little pictures have no names.");
  });
  await expect(page.getByRole("button", { name: /^Pin 2/ })).toBeVisible();
  await expect(page.locator("textarea").nth(1)).toHaveValue(/no names/);
  // dark patterns (multi-select), then ranking, then the sketch
  await page.getByRole("button", { name: "Question 2" }).click();
  await page.locator("main input[type=checkbox]").first().check({ force: true });
  await page.getByRole("button", { name: "Question 5" }).click();
  await page.getByRole("button", { name: /Draw on screen/ }).click();
  await drawStroke(page, [[0.4, 0.3], [0.5, 0.5], [0.6, 0.3]]);
  await finishSection(page);

  // D3 — an MCQ and the poster layout via keyboard
  await begin(page);
  await pickOption(page, 2);
  await page.getByRole("button", { name: "Question 14" }).click(); // the poster layout, last in D3
  await page.getByRole("button", { name: /^Date\./ }).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Shift+ArrowUp");
  await expect(page.getByRole("button", { name: /^Date at/ })).toBeVisible();
  await finishSection(page);

  // D4 + D5
  await begin(page);
  await page.getByRole("button", { name: /Draw on screen/ }).click();
  await drawStroke(page, [[0.1, 0.3], [0.2, 0.6]]);
  await page.getByRole("button", { name: "Question 3" }).click();
  await page.locator("textarea").fill("For grandparents; a dial per dose; fails if not refilled.");
  await finishSection(page);
  await begin(page);
  await page.locator("textarea").fill("Judgement about which option fits real people.");
  await finishSection(page);

  // C1 — the shared Contribution section
  await doContributionSection(page);

  await expectSubmitted(page);
  await page.getByRole("link", { name: /evaluator preview/ }).click();
  await expect(page.getByText("Weighted composite")).toBeVisible();
  await expect(page.getByText(/Known problem areas found/)).toBeVisible();
});

test("B.Psych: full attempt with Stroop, ranking, paste blocking, disconnect and resume", async ({ page }) => {
  await startTest(page, "bpsych");

  // P1 — passage items; paste is blocked in written answers
  await begin(page);
  await page.locator("main input[type=checkbox]").first().check({ force: true });
  await page.getByRole("button", { name: "Question 7" }).click();
  const box = page.locator("textarea");
  await box.fill("Track sleep with devices and randomise a 9 pm phone cut-off.");
  await box.dispatchEvent("paste");
  await expect(page.getByText(/Pasting is turned off/)).toBeVisible();
  await disconnectAndResume(page, async () => {
    await box.fill("Track sleep with devices and randomise a 9 pm phone cut-off, over a month.");
  });
  await expect(page.locator("textarea")).toHaveValue(/over a month/);
  await finishSection(page);

  // P2
  await begin(page);
  await pickOption(page, 1);
  await finishSection(page);

  // P3 — Stroop: practice, then the run (answered by reading the ink colour)
  await begin(page);
  await page.getByRole("button", { name: /practice rounds/ }).click();
  const answer = async () => {
    const key = await page.evaluate(() => {
      const el = [...document.querySelectorAll("span")].find((s) => /^(RED|GREEN|BLUE|YELLOW)$/.test(s.textContent ?? "") && s.style.color);
      const map: Record<string, string> = { "rgb(211, 47, 47)": "r", "rgb(46, 125, 50)": "g", "rgb(21, 101, 192)": "b", "rgb(224, 168, 0)": "y" };
      return el ? map[el.style.color] : null;
    });
    if (key) await page.keyboard.press(key);
    await page.waitForTimeout(460);
  };
  while (!(await page.getByRole("button", { name: /minute run/ }).isVisible())) await answer();
  await page.getByRole("button", { name: /minute run/ }).click();
  while (!(await page.getByText(/Your results/).isVisible())) await answer();
  await expect(page.getByText(/not scored/)).toBeVisible();
  await next(page);
  await page.locator("textarea").fill("Slower when the word and ink clashed: reading is automatic.");
  await finishSection(page);

  // P4 — two labelled boxes
  await begin(page);
  await page.locator("textarea").nth(0).fill("A student sits alone; a group laughs nearby.");
  await page.locator("textarea").nth(1).fill("They might feel left out, or just be tired.");
  await finishSection(page);

  // P5 — ranking via the arrow buttons
  await begin(page);
  await page.getByRole("button", { name: "Move down" }).first().click();
  await expect(page.getByText(/happy with this order/)).toBeVisible();
  await finishSection(page);

  // P6
  await begin(page);
  await page.locator("textarea").fill("Compare night owls and early risers on the same creative task.");
  await finishSection(page);
  await doContributionSection(page);
  await expectSubmitted(page);
});

test("BBA-E: full attempt including all four days of Mela Market, disconnect and resume", async ({ page }) => {
  await startTest(page, "bbae");

  await begin(page);
  await pickOption(page, 2);
  await finishSection(page);

  await begin(page);
  await pickOption(page, 3);
  await finishSection(page);

  // B3 — the game
  await begin(page);
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: /^Next$/ }).click();
  await page.getByRole("button", { name: /Go to the stall auction/ }).click();
  await page.getByRole("radio", { name: /Next to the food court/ }).click();
  await page.getByRole("textbox").fill("15000");
  await page.getByRole("button", { name: /Submit sealed bid/ }).click();
  await page.getByRole("button", { name: /Yes, submit/ }).click();
  await expect(page.getByText(/You won the spot next to the food court/)).toBeVisible();

  const plans: [number, number][] = [[560, 42], [460, 46], [540, 38], [700, 42]];
  for (let d = 0; d < 4; d++) {
    await page.getByRole("button", { name: /morning/ }).click();
    await page.getByRole("button", { name: /Plan today/ }).click();
    if (d === 0) await page.getByRole("radio", { name: /Chai & snacks/ }).click();
    await page.locator("input[inputmode=numeric]").nth(0).fill(String(plans[d][0]));
    await page.getByLabel("Price per unit").fill(String(plans[d][1]));
    if (d === 1) {
      // Crash mid-game: the decision log is restored exactly.
      await disconnectAndResume(page, async () => {});
      await expect(page.getByText(/Day 2 of 4/)).toBeVisible();
      await page.locator("input[inputmode=numeric]").nth(0).fill(String(plans[d][0]));
      await page.getByLabel("Price per unit").fill(String(plans[d][1]));
    }
    await page.getByRole("button", { name: /Open the stall/ }).click();
    await expect(page.getByText(`End of day ${d + 1}`)).toBeVisible();
  }
  await page.getByRole("button", { name: /See how the mela went/ }).click();
  await expect(page.getByText(/The mela is over/)).toBeVisible();
  await next(page);
  await page.locator("textarea").fill("Best: matching the price cut. Worst: under-stocking on day four.");
  await finishSection(page);

  await begin(page);
  const t = page.locator("textarea");
  await t.nth(0).fill("We help hostel students eat home food by pooling orders from local cooks.");
  await t.nth(1).fill("Thirty of us order out every night from my hostel.");
  await t.nth(2).fill("Cooks may not want to scale up.");
  await finishSection(page);

  await doContributionSection(page);
  await page.getByRole("button", { name: /Skip this section/ }).click();
  await expectSubmitted(page);

  await page.goto("/bbae/review");
  await expect(page.getByText("Stall bid within its expected value")).toBeVisible();
  await expect(page.getByText(/Decision quality/)).toBeVisible();
});

test("Timer: warnings fire and an expired section closes itself", async ({ page }) => {
  await startTest(page, "bbae");
  await begin(page);
  expect(await timerSeconds(page)).toBeGreaterThan(14 * 60);
  await page.getByRole("button", { name: "Demo tools" }).click();
  await page.getByRole("button", { name: "Jump to 1:04 left" }).click();
  await expect(page.getByText("1 minute left", { exact: false })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Jump to 0:04 left" }).click();
  await expect(page.getByText(/Time's up for B1/)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("heading", { name: /B2 Business Case/ })).toBeVisible();
});

test("Phone handoff: a photo taken on a phone appears in the desktop test", async ({ page, browser }) => {
  await startTest(page, "bdes");
  await begin(page);
  const link = page.getByRole("link", { name: /\/m\/h/ });
  await expect(link).toBeVisible();
  const phoneUrl = new URL((await link.getAttribute("href"))!);

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await phone.goto(phoneUrl.pathname); // same server; baseURL keeps it on localhost in CI
  await phone.locator("input[type=file]").setInputFiles(ARTWORK);
  await expect(phone.getByText(/Sent ·/)).toBeVisible();
  await phone.close();

  await expect(page.getByText("1 received from phone")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("1/3 uploaded ✓")).toBeVisible();
});
