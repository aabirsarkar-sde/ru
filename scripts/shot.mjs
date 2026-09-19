// Dev helper: screenshot pages with the locally installed Chrome.
//   node scripts/shot.mjs <path> <out.png> [width] [height] [fullPage]
import { chromium } from "@playwright/test";
const [, , path = "/", out = "shot.png", w = "1440", h = "900", full = "1"] = process.argv;
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(`http://localhost:3000${path}`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.screenshot({ path: out, fullPage: full === "1" });
if (errors.length) console.log("ERRORS:\n" + errors.join("\n"));
await browser.close();
