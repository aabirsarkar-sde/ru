// Turns a Program definition + a candidate seed into a concrete paper.
// Same program + same seed ⇒ the exact same paper, so any attempt can be
// reproduced later from its stored seed.
import type { Item, Program, SectionEntry, StimulusGroup } from "@/content/schema";
import { rng, shuffle } from "./prng";

export interface Stimulus {
  id: string;
  title: string;
  eyebrow?: string;
  body: string;
  media: StimulusGroup["media"];
}

export interface PaperItem {
  item: Item;
  stimulusId?: string;
}

export interface PaperSection {
  id: string;
  items: PaperItem[];
}

export interface Paper {
  programId: string;
  seed: string;
  sections: PaperSection[];
  stimuli: Record<string, Stimulus>;
}

function isPoolDraw(e: SectionEntry): e is { draw: string; count: number } {
  return "draw" in e;
}

function isStimulus(e: SectionEntry): e is StimulusGroup {
  return "type" in e && e.type === "stimulus_passage";
}

export function buildPaper(program: Program, seed: string): Paper {
  const stimuli: Record<string, Stimulus> = {};
  const addGroup = (g: StimulusGroup, out: PaperItem[]) => {
    const { items, ...rest } = g;
    stimuli[g.id] = { ...rest };
    for (const item of items) out.push({ item, stimulusId: g.id });
  };

  const sections = program.sections.map((section) => {
    const items: PaperItem[] = [];
    for (const entry of section.items) {
      if (isPoolDraw(entry)) {
        const pool = program.pools[entry.draw];
        if (!pool) throw new Error(`Section ${section.id} draws from unknown pool "${entry.draw}"`);
        const picked = shuffle(pool, rng(seed, "pool", entry.draw)).slice(0, entry.count);
        for (const p of picked) {
          if (p.type === "stimulus_passage") addGroup(p, items);
          else items.push({ item: p });
        }
      } else if (isStimulus(entry)) {
        addGroup(entry, items);
      } else {
        items.push({ item: entry as Item });
      }
    }
    return { id: section.id, items };
  });

  return { programId: program.id, seed, sections, stimuli };
}

/** A fresh per-candidate seed. Stored with the attempt; never regenerated. */
export function newCandidateSeed(candidateKey: string, now = Date.now()): string {
  return `${candidateKey}:${now.toString(36)}`;
}
