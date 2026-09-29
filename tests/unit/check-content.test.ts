// Regression: the content checker must not crash with an unhandled ENOENT
// when a fixed content subdirectory (e.g. content/common) is absent — it
// should report the missing directory, print the normal problem summary, and
// exit non-zero.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..", "..");
const SCRIPT = path.join(ROOT, "scripts", "check-content.ts");
const TSX = path.join(ROOT, "node_modules", ".bin", "tsx");

/** A throwaway checkout containing only a copy of content/ (minus `omit`). */
function checkout(omit: string[] = []): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "content-check-"));
  fs.cpSync(path.join(ROOT, "content"), path.join(dir, "content"), { recursive: true });
  fs.cpSync(path.join(ROOT, "public"), path.join(dir, "public"), { recursive: true });
  for (const rel of omit) fs.rmSync(path.join(dir, "content", rel), { recursive: true, force: true });
  return dir;
}

function runChecker(cwd: string) {
  const res = spawnSync(TSX, [SCRIPT], { cwd, encoding: "utf8" });
  return { status: res.status, out: `${res.stdout}${res.stderr}` };
}

describe("scripts/check-content.ts", () => {
  it("reports a missing content subdirectory instead of crashing with ENOENT", () => {
    const { status, out } = runChecker(checkout(["common"]));
    // No unhandled crash from readdirSync (the ENOENT stack trace).
    expect(out).not.toMatch(/scandir/);
    expect(out).not.toMatch(/at Object\.readdirSync/);
    // A clear problem message naming the missing directory...
    expect(out).toMatch(/content\/common is missing/);
    // ...followed by the normal problem summary, and a non-zero exit.
    expect(out).toMatch(/\d+ problem\(s\) found\./);
    expect(status).not.toBe(0);
  });

  it("exits zero with no problems when every content subdirectory exists", () => {
    const { status, out } = runChecker(checkout());
    expect(out).not.toMatch(/scandir/);
    expect(out).not.toMatch(/at Object\.readdirSync/);
    expect(out).toMatch(/All content is valid\./);
    expect(status).toBe(0);
  });
});
