import { expect, type Page } from "@playwright/test";
import path from "node:path";

export const ARTWORK = path.join(__dirname, "../fixtures/artwork.png");

/** Lobby → system check → practice → start. */
export async function startTest(page: Page, program: string, name = "Test Candidate") {
  await page.goto(`/${program}`);
  await page.getByPlaceholder("e.g. Ananya Sharma").fill(name);
  await page.getByRole("checkbox").nth(0).check();
  await page.getByRole("checkbox").nth(1).check();
  await page.getByRole("button", { name: /Check my system/ }).click();
  // Programmes with practice items show "Try the tools"; others go straight on.
  await page.getByRole("button", { name: /Try the tools|^Continue/ }).click({ timeout: 20_000 });
  await page.getByRole("button", { name: /I'm ready|Start the test/ }).first().waitFor();
  const ready = page.getByRole("button", { name: /I'm ready/ });
  if (await ready.isVisible()) await ready.click();
  await page.getByRole("button", { name: /Start the test/ }).click();
  await page.waitForURL(`**/${program}/test`);
}

export const begin = (page: Page) => page.getByRole("button", { name: /Begin section/ }).click();
export const next = (page: Page) => page.getByRole("button", { name: /^Next/ }).click();

export async function finishSection(page: Page) {
  await page.getByRole("button", { name: /Finish section/ }).first().click();
  await page.getByRole("button", { name: /Yes, finish section/ }).click();
}

export async function pickOption(page: Page, index: number) {
  await page.locator("main input[type=radio]").nth(index).check({ force: true });
}

/** Seconds shown on the section timer. */
export async function timerSeconds(page: Page): Promise<number> {
  const label = await page.getByRole("timer").getAttribute("aria-label");
  const m = label?.match(/(\d+):(\d{2})$/);
  if (!m) throw new Error(`No timer in "${label}"`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Simulated disconnect + crash: go offline, keep working, then reload the tab.
 * Returns once the page is back and the resume toast has appeared.
 */
export async function disconnectAndResume(page: Page, work: () => Promise<void>) {
  const before = await timerSeconds(page);
  await page.context().setOffline(true);
  await expect(page.getByText(/You're offline/)).toBeVisible();
  await work();
  await page.waitForTimeout(1500); // let autosave flush to IndexedDB
  await page.context().setOffline(false);
  await page.reload();
  await expect(page.getByText(/Welcome back/)).toBeVisible();
  const after = await timerSeconds(page);
  // Time kept running (server-authoritative in production; start-stamp here) but was not reset.
  expect(after).toBeLessThanOrEqual(before);
  expect(before - after).toBeLessThan(30);
}

export async function drawStroke(page: Page, pts: [number, number][]) {
  const canvas = page.locator("canvas[aria-label^='Drawing area']");
  await canvas.scrollIntoViewIfNeeded();
  const r = (await canvas.boundingBox())!;
  await page.mouse.move(r.x + pts[0][0] * r.width, r.y + pts[0][1] * r.height);
  await page.mouse.down();
  for (const [x, y] of pts.slice(1)) await page.mouse.move(r.x + x * r.width, r.y + y * r.height, { steps: 6 });
  await page.mouse.up();
}

export async function expectSubmitted(page: Page) {
  await page.waitForURL("**/done");
  await expect(page.getByRole("heading", { name: /Thank you/ })).toBeVisible();
}

/** The shared C1 "Contribution" section (identical in every programme). */
export async function doContributionSection(page: Page) {
  await begin(page);
  await page.locator("textarea").first().fill("The government school near my house has one working tap for 400 children.");
  await next(page);
  await page.locator("textarea").first().fill("I fixed the tap handle with my cousin one Sunday; it broke again in a month.");
  await next(page);
  await next(page);
  // five-hour allocation must add up before it counts as answered
  const sliders = page.getByRole("slider");
  await sliders.nth(0).fill("2.5");
  await sliders.nth(3).fill("2.5");
  await expect(page.getByText(/0 of 5 hours left/)).toBeVisible();
  await next(page);
  await page.locator("textarea").first().fill("Run a Thursday open mic and find three first-years who play.");
  await next(page);
  await page.getByRole("button", { name: "Move down" }).first().click();
  await next(page);
  await page.getByRole("button", { name: "Move down" }).first().click();
  await finishSection(page);
}
