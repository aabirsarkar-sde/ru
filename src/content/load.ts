// Reads and validates everything under /content. Server-side only.
// In development files are re-read on every request, so faculty can edit a
// YAML file and simply refresh the page.
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import type { MelaConfig } from "@/engine/mela/types";
import type { StroopConfig } from "@/engine/stroop";
import { Program, RubricFile, Section, type Rubric } from "./schema";

const ROOT = path.join(process.cwd(), "content");

function readYaml(rel: string): unknown {
  const file = path.join(ROOT, rel);
  try {
    return YAML.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    throw new Error(`Could not read content/${rel}: ${(err as Error).message}`);
  }
}

function fail(rel: string, issues: { path: PropertyKey[]; message: string }[]): never {
  const lines = issues.slice(0, 8).map((i) => `  • ${i.path.join(".") || "(root)"}: ${i.message}`);
  throw new Error(`content/${rel} is invalid:\n${lines.join("\n")}`);
}

export const PROGRAM_IDS = ["bdes", "bpsych", "bbae"] as const;
export type ProgramId = (typeof PROGRAM_IDS)[number];

/** Sections shared by every programme (content/common/<name>.yaml). */
function loadCommonSection(name: string): Section {
  const rel = `common/${name}.yaml`;
  const parsed = Section.safeParse(readYaml(rel));
  if (!parsed.success) fail(rel, parsed.error.issues);
  return parsed.data;
}

export function loadProgram(id: string): Program {
  const rel = `programs/${id}.yaml`;
  const parsed = Program.safeParse(readYaml(rel));
  if (!parsed.success) fail(rel, parsed.error.issues);
  const program: Program = {
    ...parsed.data,
    sections: parsed.data.sections.map((s) =>
      "include" in s ? { ...loadCommonSection(s.include), ...(s.weight != null ? { weight: s.weight } : {}) } : s,
    ),
  };
  checkProgramIntegrity(program, rel);
  return program;
}

export function loadPrograms(): Program[] {
  return PROGRAM_IDS.map(loadProgram);
}

export function loadRubrics(): Record<string, Rubric> {
  const rel = "rubrics.yaml";
  const parsed = RubricFile.safeParse(readYaml(rel));
  if (!parsed.success) fail(rel, parsed.error.issues);
  return Object.fromEntries(parsed.data.rubrics.map((r) => [r.id, r]));
}

export function loadGameConfig<T = MelaConfig | StroopConfig>(file: string): T {
  const rel = `games/${file}`;
  const data = readYaml(rel) as Record<string, unknown>;
  if (!data || typeof data !== "object") throw new Error(`content/${rel} is empty`);
  return data as T;
}

/** Game configs referenced by a program's interactive items, keyed by file name. */
export function loadProgramGames(program: Program): Record<string, unknown> {
  const files = new Set<string>();
  const visit = (items: { type: string; config?: string; items?: unknown[] }[]) => {
    for (const it of items) {
      if (it.type === "interactive_task" && it.config) files.add(it.config);
      if (Array.isArray(it.items)) visit(it.items as never);
    }
  };
  for (const s of program.sections) visit(s.items as never);
  for (const pool of Object.values(program.pools)) visit(pool as never);
  visit(program.practice as never);
  return Object.fromEntries([...files].map((f) => [f, loadGameConfig(f)]));
}

/** Cross-reference checks the schema alone can't express. */
function checkProgramIntegrity(program: Program, rel: string) {
  const ids = new Set<string>();
  const problems: string[] = [];
  const seen = (id: string) => {
    if (ids.has(id)) problems.push(`duplicate item id "${id}"`);
    ids.add(id);
  };
  const checkItem = (it: { id: string; type: string; options?: { id: string }[]; answer?: unknown }) => {
    seen(it.id);
    if (it.options && it.answer != null) {
      const optionIds = new Set(it.options.map((o) => o.id));
      const answers = Array.isArray(it.answer) ? it.answer : [it.answer];
      for (const a of answers) if (!optionIds.has(a as string)) problems.push(`${it.id}: answer "${a}" is not an option`);
      if (it.type === "ranking" && answers.length !== optionIds.size)
        problems.push(`${it.id}: ranking key must list every option exactly once`);
    }
  };
  const walk = (entries: unknown[]) => {
    for (const e of entries as Record<string, unknown>[]) {
      if ("draw" in e) {
        if (!program.pools[e.draw as string]) problems.push(`unknown pool "${e.draw}"`);
      } else if (e.type === "stimulus_passage") {
        (e.items as never[]).forEach(checkItem);
      } else checkItem(e as never);
    }
  };
  program.sections.forEach((s) => walk(s.items));
  Object.values(program.pools).forEach((p) => walk(p));
  if (problems.length) throw new Error(`content/${rel} has problems:\n  • ${problems.join("\n  • ")}`);
}
