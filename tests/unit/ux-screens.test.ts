import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts/gen-ux-screens.py");
const COMMITTED_DIR = path.join(ROOT, "public/media/bdes/ux");

/** The generator writes to OUT = "public/media/bdes/ux/" relative to its cwd. */
const OUT_REL = path.join("public", "media", "bdes", "ux");

function pythonAvailable(): boolean {
  try {
    execFileSync("python3", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const hasPython = pythonAvailable();

/** Runs the generator in a throwaway cwd and returns the files it wrote. */
function generate(): Record<string, string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ux-screens-"));
  try {
    const out = path.join(dir, OUT_REL);
    fs.mkdirSync(out, { recursive: true });
    try {
      execFileSync("python3", [SCRIPT], { cwd: dir, stdio: "pipe" });
    } catch (err) {
      throw new Error(`scripts/gen-ux-screens.py failed to run: ${(err as Error).message}`);
    }
    const names = fs.readdirSync(out);
    expect(names.length, `generator wrote no files to ${OUT_REL}`).toBeGreaterThan(0);
    return Object.fromEntries(names.map((f) => [f, fs.readFileSync(path.join(out, f), "utf8")]));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** x-coordinates of the carousel dots under the festive banner (cy=252, r=3.5). */
function carouselDotXs(svg: string): number[] {
  return [...svg.matchAll(/<circle cx="([\d.]+)" cy="252" r="3\.5"/g)].map((m) => Number(m[1]));
}

/**
 * Replaces only the three carousel-dot x-coordinates, in document order, with a
 * placeholder. Any other difference (an extra/missing dot, a moved cy=252
 * circle, any other element) still shows up in the comparison.
 */
function maskCarouselDots(svg: string): string {
  let i = 0;
  return svg.replace(/<circle cx="[\d.]+" cy="252" r="3\.5"/g, () => {
    i += 1;
    return `<circle cx="DOT${i}" cy="252" r="3.5"`;
  });
}

describe("gen-ux-screens", () => {
  it.skipIf(!hasPython)("draws the jaldi-home carousel dots at x = 270, 300, 320", () => {
    const files = generate();
    expect(files["jaldi-home.svg"], "jaldi-home.svg was not generated").toBeDefined();
    const xs = carouselDotXs(files["jaldi-home.svg"]);
    expect(xs).toEqual([270, 300, 320]);
    for (const wrong of [250, 264, 278]) expect(xs).not.toContain(wrong);
  });

  it.skipIf(!hasPython)("keeps every other generated screen byte-identical to the committed output", () => {
    const files = generate();
    for (const [name, svg] of Object.entries(files)) {
      const committed = fs.readFileSync(path.join(COMMITTED_DIR, name), "utf8");
      if (name === "jaldi-home.svg") {
        // Only the three carousel-dot x-positions may differ from the committed file.
        expect(maskCarouselDots(svg), name).toBe(maskCarouselDots(committed));
      } else {
        expect(svg, name).toBe(committed);
      }
    }
  });
});
