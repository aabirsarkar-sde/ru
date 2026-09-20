// Schema for everything faculty edit under /content. The seed loader validates
// every YAML file against these, so a typo in a question file fails loudly at
// load time instead of silently breaking a candidate's test.
import { z } from "zod";

/* ----------------------------------------------------------------- media -- */

export const ChartSpec = z.object({
  kind: z.enum(["bar", "grouped_bar", "line"]),
  title: z.string().optional(),
  categories: z.array(z.string()),
  series: z.array(z.object({ name: z.string(), values: z.array(z.number()) })),
  y_label: z.string().optional(),
  /** Deliberately truncated axes are allowed — some items test for them. */
  y_min: z.number().optional(),
  y_max: z.number().optional(),
  unit: z.string().optional(),
  source: z.string().optional(),
});
export type ChartSpec = z.infer<typeof ChartSpec>;

export const TableSpec = z.object({
  title: z.string().optional(),
  columns: z.array(z.string()),
  rows: z.array(z.array(z.union([z.string(), z.number()]))),
  note: z.string().optional(),
});
export type TableSpec = z.infer<typeof TableSpec>;

export const Media = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("image"),
    src: z.string(),
    alt: z.string(),
    caption: z.string().optional(),
    /** Large, zoomable presentation (e.g. observation-drawing scenes). */
    zoomable: z.boolean().optional(),
    /** "phone": show at phone size in a device frame, beside the answer options. */
    frame: z.enum(["none", "phone"]).default("none"),
    /** Maximum display width in px. */
    width: z.number().optional(),
  }),
  z.object({
    kind: z.literal("strip"),
    panels: z.array(z.object({ src: z.string(), alt: z.string() })),
    caption: z.string().optional(),
  }),
  z.object({ kind: z.literal("palette"), label: z.string().optional(), colors: z.array(z.string()) }),
  z.object({ kind: z.literal("chart"), chart: ChartSpec }),
  z.object({ kind: z.literal("table"), table: TableSpec }),
]);
export type Media = z.infer<typeof Media>;

/* ----------------------------------------------------------------- items -- */

const Option = z.object({
  id: z.string(),
  label: z.string(),
  media: Media.optional(),
});
export type Option = z.infer<typeof Option>;

const ItemBase = z.object({
  id: z.string(),
  prompt: z.string(),
  /** Extra guidance shown under the prompt. */
  help: z.string().optional(),
  media: z.array(Media).default([]),
  time_hint: z.string().optional(),
  max_score: z.number().default(1),
  rubric_id: z.string().optional(),
  tags: z.array(z.string()).default([]),
  /** Unscored items are collected (e.g. for Stage 3) but excluded from composites. */
  scored: z.boolean().default(true),
  required: z.boolean().default(false),
  locked_sequence: z.boolean().default(false),
  /** Score this item under another section's weight (e.g. B3 reflection → B4). */
  counts_toward: z.string().optional(),
});

const TextField = z.object({
  id: z.string(),
  label: z.string(),
  word_limit: z.number(),
  placeholder: z.string().optional(),
  rows: z.number().optional(),
});
export type TextField = z.infer<typeof TextField>;

export const Item = z.discriminatedUnion("type", [
  ItemBase.extend({
    type: z.literal("mcq_single"),
    options: z.array(Option),
    answer: z.string(),
    /** Show options as a grid of image tiles instead of a list. */
    layout: z.enum(["list", "grid"]).default("list"),
  }),
  ItemBase.extend({
    type: z.literal("mcq_multi"),
    options: z.array(Option),
    answer: z.array(z.string()),
    partial: z.enum(["proportional", "all_or_nothing"]).default("proportional"),
    layout: z.enum(["list", "grid"]).default("list"),
  }),
  ItemBase.extend({
    type: z.literal("ranking"),
    options: z.array(Option),
    /** Expert key: option ids from most to least appropriate. */
    answer: z.array(z.string()),
    top_label: z.string().default("Most appropriate"),
    bottom_label: z.string().default("Least appropriate"),
  }),
  ItemBase.extend({
    type: z.literal("short_text"),
    word_limit: z.number().optional(),
    fields: z.array(TextField).optional(),
    placeholder: z.string().optional(),
  }),
  ItemBase.extend({
    type: z.literal("long_text"),
    word_limit: z.number().max(300),
    placeholder: z.string().optional(),
  }),
  ItemBase.extend({
    type: z.literal("drawing_canvas"),
    /** Let the candidate choose "draw on paper, upload a photo" instead. */
    allow_photo: z.boolean().default(true),
    guides: z.enum(["none", "thumbnails3", "thirds", "phone"]).default("none"),
    aspect: z.number().default(4 / 3),
  }),
  ItemBase.extend({
    type: z.literal("photo_upload"),
    min_files: z.number().default(1),
    max_files: z.number().default(1),
    phone_handoff: z.boolean().default(true),
  }),
  ItemBase.extend({
    type: z.literal("layout_drag"),
    artboard: z.object({
      width: z.number(),
      height: z.number(),
      background: z.string().default("#FFFFFF"),
      label: z.string().optional(),
    }),
    blocks: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        kind: z.enum(["headline", "text", "image", "date", "shape"]),
        text: z.string().optional(),
        width: z.number(),
        height: z.number(),
        resizable: z.boolean().default(true),
      }),
    ),
    auto_checks: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          rule: z.enum(["placed", "in_top_third", "largest_text", "no_overlap", "inside_artboard"]),
          block: z.string().optional(),
        }),
      )
      .default([]),
  }),
  ItemBase.extend({
    /** Optional portfolio: links and/or uploaded PDFs & images. */
    type: z.literal("portfolio"),
    max_links: z.number().default(3),
    max_files: z.number().default(3),
    max_file_mb: z.number().default(10),
    link_placeholder: z.string().default("https://…"),
    /** Suggestions shown under the link box (Behance, Drive, Instagram…). */
    examples: z.array(z.string()).default([]),
  }),
  ItemBase.extend({
    /** Split a fixed budget (hours, rupees, points) across options. */
    type: z.literal("allocation"),
    total: z.number(),
    unit: z.string().default("hours"),
    step: z.number().default(0.5),
    max_per_option: z.number().optional(),
    options: z.array(z.object({ id: z.string(), label: z.string(), hint: z.string().optional() })),
  }),
  ItemBase.extend({
    /** Drop numbered pins on an image (e.g. an app screen) and annotate each. */
    type: z.literal("hotspot"),
    image: z.object({
      src: z.string(),
      alt: z.string(),
      width: z.number().default(360),
      /** width ÷ height, reserved before the image loads (phones ≈ 0.47). */
      aspect: z.number().default(360 / 760),
    }),
    max_pins: z.number().default(3),
    min_pins: z.number().default(1),
    note_label: z.string().default("What is this person thinking or feeling here?"),
    note_word_limit: z.number().default(30),
    /**
     * Known problem areas, in % of the image (0–100). Shown to evaluators as
     * evidence ("found 3 of 6"), never to candidates, and never the score.
     */
    zones: z
      .array(z.object({ id: z.string(), label: z.string(), x: z.number(), y: z.number(), w: z.number(), h: z.number() }))
      .default([]),
  }),
  ItemBase.extend({
    type: z.literal("interactive_task"),
    module: z.enum(["stroop", "mela_market"]),
    /** File under content/games/ holding the module's parameters. */
    config: z.string(),
  }),
]);
export type Item = z.infer<typeof Item>;
export type ItemType = Item["type"];

/** A passage / case / brief shown alongside a group of items. */
export const StimulusGroup = z.object({
  type: z.literal("stimulus_passage"),
  id: z.string(),
  title: z.string(),
  eyebrow: z.string().optional(),
  body: z.string().default(""),
  media: z.array(Media).default([]),
  items: z.array(Item),
});
export type StimulusGroup = z.infer<typeof StimulusGroup>;

export const PoolDraw = z.object({
  draw: z.string(),
  count: z.number().default(1),
});

const SectionEntry = z.union([StimulusGroup, Item, PoolDraw]);
export type SectionEntry = z.infer<typeof SectionEntry>;

/* ------------------------------------------------------------- structure -- */

export const Section = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  kind: z.enum(["timed", "pretest", "optional"]).default("timed"),
  duration_min: z.number().nullable().default(null),
  weight: z.number().default(0),
  traits: z.array(z.string()).default([]),
  intro: z.string(),
  /** Short line shown on the section card. */
  summary: z.string(),
  /** Item-level navigation is off for game-like sections. */
  locked_sequence: z.boolean().default(false),
  /** Show an unmarked rough-work pad beside the questions. */
  scratchpad: z.boolean().default(false),
  items: z.array(SectionEntry),
});
export type Section = z.infer<typeof Section>;

/** A section defined in content/common/<name>.yaml, shared by every programme. */
export const SectionInclude = z.object({
  include: z.string(),
  /** Programme-specific weight for the shared section. */
  weight: z.number().optional(),
});

export const Program = z.object({
  id: z.string(),
  name: z.string(),
  full_name: z.string(),
  school: z.string().optional(),
  accent: z.enum(["narangi", "wine", "navy", "red", "plum"]),
  duration_min: z.number(),
  traits: z.array(z.string()),
  pitch: z.string(),
  window: z.object({ id: z.string(), name: z.string(), seed: z.string() }),
  sections: z.array(z.union([Section, SectionInclude])),
  pools: z.record(z.string(), z.array(z.union([StimulusGroup, Item]))).default({}),
  /** Item ids (from anywhere in the program) offered on the practice screen. */
  practice: z.array(Item).default([]),
});
type ProgramFile = z.infer<typeof Program>;
/** A programme with its shared-section includes resolved. */
export type Program = Omit<ProgramFile, "sections"> & { sections: Section[] };

/* --------------------------------------------------------------- rubrics -- */

export const Rubric = z.object({
  id: z.string(),
  title: z.string(),
  note: z.string().optional(),
  scale: z.object({ min: z.number(), max: z.number() }).default({ min: 1, max: 4 }),
  criteria: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      descriptors: z.record(z.string(), z.string()),
      anchor: z.string().optional(),
    }),
  ),
  /** Things evaluators must ignore. */
  ignore: z.array(z.string()).default([]),
});
export type Rubric = z.infer<typeof Rubric>;
export const RubricFile = z.object({ rubrics: z.array(Rubric) });
