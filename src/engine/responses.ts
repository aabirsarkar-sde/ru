// Shapes of what each item type stores. Kept framework-free so scoring,
// review and (later) the server can all share them.

export interface Photo {
  id: string;
  name: string;
  dataUrl: string;
  width: number;
  height: number;
  bytes: number;
  via: "device" | "phone";
  at: number;
}

export interface StrokePoint {
  x: number; // normalised 0..1 of canvas width
  y: number; // normalised 0..1 of canvas height
  p: number; // pressure 0..1 (0.5 when the device has none)
}

export interface Stroke {
  tool: "pen" | "pencil" | "marker" | "eraser";
  color: string;
  size: number; // stroke width relative to a 1000px-wide canvas
  points: StrokePoint[];
  pointer: string; // "mouse" | "pen" | "touch"
}

export interface Placement {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Pin {
  id: string;
  /** Position in % of the image (0–100). */
  x: number;
  y: number;
  note: string;
}

export interface TypingSummary {
  keystrokes: number;
  /** Characters that appeared without matching keystrokes (e.g. drag-drop, IME). */
  bulkInserts: number;
  pasteAttempts: number;
  activeMs: number;
}

export type Response =
  | { type: "mcq_single"; choice: string | null }
  | { type: "mcq_multi"; choices: string[] }
  | { type: "ranking"; order: string[]; touched: boolean }
  | { type: "short_text" | "long_text"; fields: Record<string, string>; typing?: TypingSummary }
  | {
      type: "drawing_canvas";
      mode: "draw" | "photo" | null;
      strokes: Stroke[];
      photos: Photo[];
      pngDataUrl?: string;
    }
  | { type: "photo_upload"; photos: Photo[] }
  | { type: "layout_drag"; placements: Record<string, Placement> }
  | { type: "hotspot"; pins: Pin[] }
  | { type: "allocation"; allocations: Record<string, number> }
  | { type: "interactive_task"; module: string; completed: boolean; data: unknown };

/** The response shape for an item type (handles members that cover several types). */
export type ResponseOf<T extends Response["type"]> = Response extends infer R
  ? R extends { type: infer U }
    ? T extends U
      ? R
      : never
    : never
  : never;

export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

export function isAnswered(r: Response | undefined): boolean {
  if (!r) return false;
  switch (r.type) {
    case "mcq_single":
      return r.choice != null;
    case "mcq_multi":
      return r.choices.length > 0;
    case "ranking":
      return r.touched;
    case "short_text":
    case "long_text":
      return Object.values(r.fields).some((v) => v.trim().length > 0);
    case "drawing_canvas":
      return r.strokes.length > 0 || r.photos.length > 0;
    case "photo_upload":
      return r.photos.length > 0;
    case "layout_drag":
      return Object.keys(r.placements).length > 0;
    case "hotspot":
      return r.pins.length > 0;
    case "allocation":
      return Object.values(r.allocations).some((v) => v > 0);
    case "interactive_task":
      return r.completed;
  }
}
