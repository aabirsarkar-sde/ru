// Validates everything under /content — the v1 "seed" step (PRD §9: editing
// YAML and re-running a command is acceptable). Run after any content edit:
//   npm run content:check
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { loadProgramGames, loadPrograms, loadRubrics } from "../src/content/load";
import type { Media } from "../src/content/schema";
import { buildPaper } from "../src/engine/paper";

let problems = 0;
const warn = (msg: string) => {
  problems++;
  console.log(`  ✗ ${msg}`);
};

const mediaSrcs = (m: Media): string[] =>
  m.kind === "image" ? [m.src] : m.kind === "strip" ? m.panels.map((p) => p.src) : [];

// An unquoted comma inside a YAML flow mapping ({ label: a, b }) silently
// creates a stray key ("b") and truncates the text. Catch keys with spaces.
function strayKeys(node: unknown, at: string, out: string[]) {
  if (Array.isArray(node)) node.forEach((n, i) => strayKeys(n, `${at}[${i}]`, out));
  else if (node && typeof node === "object")
    for (const [k, v] of Object.entries(node)) {
      if (/\s/.test(k) && !/^\d+$/.test(k)) out.push(`${at}: stray key "${k}" — quote the value that contains a comma`);
      strayKeys(v, `${at}.${k}`, out);
    }
}
for (const dir of ["programs", "games", "common", "."]) {
  for (const f of fs.readdirSync(path.join("content", dir)).filter((x) => x.endsWith(".yaml"))) {
    const found: string[] = [];
    strayKeys(YAML.parse(fs.readFileSync(path.join("content", dir, f), "utf8")), f, found);
    found.forEach(warn);
  }
}

try {
  const rubrics = loadRubrics();
  console.log(`✓ rubrics.yaml — ${Object.keys(rubrics).length} rubrics`);

  for (const program of loadPrograms()) {
    const games = loadProgramGames(program);
    const paper = buildPaper(program, "content-check");
    const allItems = [
      ...Object.values(program.pools).flatMap((p) => p.flatMap((e) => (e.type === "stimulus_passage" ? e.items : [e]))),
      ...paper.sections.flatMap((s) => s.items.map((i) => i.item)),
    ];
    const media = [
      ...allItems.flatMap((i) => [
        ...i.media,
        ...("options" in i ? i.options.flatMap((o) => ("media" in o && o.media ? [o.media] : [])) : []),
      ]),
      ...Object.values(paper.stimuli).flatMap((s) => s.media),
      ...Object.values(program.pools).flatMap((p) => p.flatMap((e) => (e.type === "stimulus_passage" ? e.media : []))),
    ];
    const hotspotImages = allItems.flatMap((i) => (i.type === "hotspot" ? [i.image.src] : []));
    for (const src of new Set([...media.flatMap(mediaSrcs), ...hotspotImages])) {
      if (!fs.existsSync(path.join(process.cwd(), "public", src))) warn(`${program.id}: missing media ${src}`);
    }
    for (const item of allItems) {
      if (item.rubric_id && !rubrics[item.rubric_id]) warn(`${program.id}/${item.id}: unknown rubric ${item.rubric_id}`);
    }
    const weights = program.sections.reduce((a, s) => a + s.weight, 0);
    if (weights !== 100) warn(`${program.id}: section weights add to ${weights}, not 100`);

    const counts = paper.sections.map((s) => `${s.id}:${s.items.length}`).join(" ");
    console.log(
      `✓ ${program.id}.yaml — ${program.sections.length} sections (${counts}), ` +
        `${Object.keys(program.pools).length} pools, games: ${Object.keys(games).join(", ") || "none"}`,
    );
  }
} catch (err) {
  console.error(`\n${(err as Error).message}\n`);
  process.exit(1);
}

if (problems) {
  console.log(`\n${problems} problem(s) found.`);
  process.exit(1);
}
console.log("\nAll content is valid.");
