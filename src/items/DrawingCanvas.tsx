"use client";
import { getStroke } from "perfect-freehand";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Stroke, StrokePoint } from "@/engine/responses";
import { PhotoPicker } from "./PhotoUpload";
import type { ItemProps } from "./types";

/* ------------------------------------------------------------- rendering -- */

const COLOURS = [
  { id: "ink", hex: "#1F2224", name: "Charcoal" },
  { id: "red", hex: "#B20E38", name: "Rishihood red" },
  { id: "narangi", hex: "#CC5C2F", name: "Narangi" },
  { id: "blue", hex: "#1D5A9A", name: "Blue" },
  { id: "green", hex: "#2E7D4F", name: "Green" },
  { id: "ochre", hex: "#D9A400", name: "Ochre" },
] as const;
const SIZES = [
  { id: "s", px: 3, label: "Fine" },
  { id: "m", px: 7, label: "Medium" },
  { id: "l", px: 16, label: "Bold" },
] as const;
type Tool = Stroke["tool"];

/** Width (in px) of the reference canvas that stroke sizes are relative to. */
const REF_W = 1000;

function outline(stroke: Stroke, w: number, h: number, last: boolean) {
  const k = w / REF_W;
  const base = stroke.size * k;
  const opts =
    stroke.tool === "pencil"
      ? { size: base * 0.75, thinning: 0.15, smoothing: 0.4, streamline: 0.35 }
      : stroke.tool === "eraser"
        ? { size: base * 3, thinning: 0, smoothing: 0.5, streamline: 0.4 }
        : { size: base * 1.1, thinning: 0.55, smoothing: 0.55, streamline: 0.45 };
  const pts = stroke.points.map((p) => [p.x * w, p.y * h, p.p]);
  return getStroke(pts, { ...opts, simulatePressure: stroke.pointer !== "pen", last });
}

function toPath(points: number[][]): Path2D {
  const path = new Path2D();
  if (!points.length) return path;
  path.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    path.quadraticCurveTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  path.closePath();
  return path;
}

function paintStroke(ctx: CanvasRenderingContext2D, s: Stroke, w: number, h: number, last = true) {
  const path = toPath(outline(s, w, h, last));
  ctx.save();
  if (s.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "#000";
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = s.color;
    ctx.globalAlpha = s.tool === "pencil" ? 0.62 : 1;
  }
  ctx.fill(path);
  ctx.restore();
}

function paintGuides(ctx: CanvasRenderingContext2D, guides: string, w: number, h: number) {
  ctx.save();
  ctx.strokeStyle = "rgba(51,58,61,0.28)";
  ctx.lineWidth = Math.max(1, w / 700);
  ctx.setLineDash([w / 120, w / 160]);
  if (guides === "thumbnails3") {
    const pad = w * 0.02;
    const bw = (w - pad * 4) / 3;
    for (let i = 0; i < 3; i++) {
      ctx.strokeRect(pad + i * (bw + pad), pad, bw, h - pad * 2);
      ctx.fillStyle = "rgba(51,58,61,0.35)";
      ctx.font = `600 ${Math.round(w / 55)}px Montserrat, sans-serif`;
      ctx.fillText(`Idea ${i + 1}`, pad + i * (bw + pad) + w * 0.012, pad + w * 0.03);
    }
  } else if (guides === "phone") {
    // A phone outline in the middle, with room either side for notes.
    const ph = h * 0.9;
    const pw = ph * 0.5;
    const x = (w - pw) / 2;
    const y = (h - ph) / 2;
    const r = pw * 0.12;
    ctx.beginPath();
    ctx.roundRect(x, y, pw, ph, r);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.roundRect(x + pw * 0.38, y + ph * 0.025, pw * 0.24, ph * 0.012, 4);
    ctx.stroke();
    ctx.fillStyle = "rgba(51,58,61,0.35)";
    ctx.font = `600 ${Math.round(w / 60)}px Montserrat, sans-serif`;
    ctx.fillText("Notes", w * 0.03, h * 0.08);
    ctx.fillText("Notes", x + pw + w * 0.03, h * 0.08);
  } else if (guides === "thirds") {
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo((w * i) / 3, 0);
      ctx.lineTo((w * i) / 3, h);
      ctx.moveTo(0, (h * i) / 3);
      ctx.lineTo(w, (h * i) / 3);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Flatten strokes to a PNG (white background, guides included). */
export function renderPng(strokes: Stroke[], aspect: number, guides: string, width = 1200): string {
  const w = width;
  const h = Math.round(width / aspect);
  const ink = document.createElement("canvas");
  ink.width = w;
  ink.height = h;
  const ictx = ink.getContext("2d")!;
  for (const s of strokes) paintStroke(ictx, s, w, h);
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const o = out.getContext("2d")!;
  o.fillStyle = "#fff";
  o.fillRect(0, 0, w, h);
  paintGuides(o, guides, w, h);
  o.drawImage(ink, 0, 0);
  return out.toDataURL("image/png");
}

/* ------------------------------------------------------------- component -- */

export function DrawingCanvas({ item, response, onChange, ctx }: ItemProps<"drawing_canvas">) {
  const mode = response?.mode ?? (item.allow_photo ? null : "draw");
  const strokes = response?.strokes ?? [];
  const photos = response?.photos ?? [];
  const set = (patch: Partial<NonNullable<typeof response>>) =>
    onChange({ type: "drawing_canvas", mode, strokes, photos, pngDataUrl: response?.pngDataUrl, ...patch });

  if (!mode) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <ModeCard
          icon="✎"
          title="Draw on screen"
          body="Use a mouse, trackpad, touchscreen or stylus. Pen, pencil, eraser and undo included."
          onClick={() => set({ mode: "draw" })}
        />
        <ModeCard
          icon="📷"
          title="Draw on paper, then upload a photo"
          body="Draw with a pencil on any paper. Photograph it before the section ends — from this computer or your phone."
          onClick={() => set({ mode: "photo" })}
        />
        <p className="text-sm text-ink-mute sm:col-span-2">Both are scored exactly the same way. You can switch later.</p>
      </div>
    );
  }

  return (
    <div>
      {item.allow_photo && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm" role="tablist" aria-label="How you'll respond">
          <span className="text-ink-mute">Responding by:</span>
          {(["draw", "photo"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => set({ mode: m })}
              className={`rounded-full px-3 py-1 font-semibold ${mode === m ? "bg-ink text-white" : "bg-white text-ink-soft ring-1 ring-line hover:ring-line-strong"}`}
            >
              {m === "draw" ? "✎ Drawing on screen" : "📷 Paper + photo"}
            </button>
          ))}
          {mode === "photo" && strokes.length > 0 && <span className="text-xs text-ink-mute">(your on-screen drawing is kept too)</span>}
        </div>
      )}
      {mode === "draw" ? (
        <Sketchpad
          strokes={strokes}
          aspect={item.aspect}
          guides={item.guides}
          onChange={(next, png) => set({ strokes: next, pngDataUrl: png })}
        />
      ) : (
        <PhotoPicker
          photos={photos}
          min={1}
          max={3}
          handoffKey={`${ctx.candidateId}-${item.id}`}
          onChange={(p) => set({ photos: p })}
          hint="Photograph the whole sheet from directly above, in good light."
        />
      )}
    </div>
  );
}

function ModeCard({ icon, title, body, onClick }: { icon: string; title: string; body: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-start gap-2 bg-white p-6 text-left ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-[var(--accent)] curve-br"
    >
      <span className="grid size-12 place-items-center rounded-full bg-[var(--accent-soft)] text-2xl">{icon}</span>
      <span className="font-serif text-2xl">{title}</span>
      <span className="text-sm text-ink-soft">{body}</span>
      <span className="mt-2 text-sm font-semibold text-[var(--accent)] group-hover:underline">Choose →</span>
    </button>
  );
}

export function Sketchpad({
  strokes,
  aspect,
  guides,
  onChange,
}: {
  strokes: Stroke[];
  aspect: number;
  guides: string;
  onChange: (strokes: Stroke[], png: string | undefined) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLCanvasElement>(null);
  const live = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [tool, setTool] = useState<Tool>("pen");
  const [colour, setColour] = useState<string>(COLOURS[0].hex);
  const [width, setWidth] = useState<number>(SIZES[1].px);
  const [undo, setUndo] = useState<Stroke[][]>([]);
  const [redo, setRedo] = useState<Stroke[][]>([]);
  const current = useRef<Stroke | null>(null);
  const penActive = useRef(false);
  const pngTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const strokesRef = useRef(strokes);
  useLayoutEffect(() => {
    strokesRef.current = strokes;
  }, [strokes]);

  // Size the canvases to the container (crisp on HiDPI).
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      setSize({ w, h: Math.round(w / aspect) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect]);

  const redraw = useCallback(() => {
    const c = base.current;
    if (!c || !size.w) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    for (const s of strokesRef.current) paintStroke(ctx, s, size.w, size.h);
  }, [size]);

  useEffect(() => {
    const dpr = window.devicePixelRatio || 1;
    for (const c of [base.current, live.current]) {
      if (!c || !size.w) continue;
      c.width = size.w * dpr;
      c.height = size.h * dpr;
    }
    redraw();
  }, [size, redraw]);

  useEffect(redraw, [strokes, redraw]);

  const commit = useCallback(
    (next: Stroke[]) => {
      setUndo((u) => [...u.slice(-60), strokesRef.current]);
      setRedo([]);
      onChange(next, undefined);
      clearTimeout(pngTimer.current);
      pngTimer.current = setTimeout(() => onChange(next, next.length ? renderPng(next, aspect, guides) : undefined), 900);
    },
    [onChange, aspect, guides],
  );

  const doUndo = useCallback(() => {
    setUndo((u) => {
      if (!u.length) return u;
      const prev = u[u.length - 1];
      setRedo((r) => [...r, strokesRef.current]);
      onChange(prev, prev.length ? renderPng(prev, aspect, guides) : undefined);
      return u.slice(0, -1);
    });
  }, [onChange, aspect, guides]);

  const doRedo = useCallback(() => {
    setRedo((r) => {
      if (!r.length) return r;
      const next = r[r.length - 1];
      setUndo((u) => [...u, strokesRef.current]);
      onChange(next, next.length ? renderPng(next, aspect, guides) : undefined);
      return r.slice(0, -1);
    });
  }, [onChange, aspect, guides]);

  // Keyboard shortcuts while the canvas area has focus.
  const onKeyDown = (e: React.KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      (e.shiftKey ? doRedo : doUndo)();
    } else if (mod && e.key.toLowerCase() === "y") {
      e.preventDefault();
      doRedo();
    } else if (!mod && e.key === "p") setTool("pen");
    else if (!mod && e.key === "b") setTool("pencil");
    else if (!mod && e.key === "e") setTool("eraser");
  };

  const point = (e: React.PointerEvent): StrokePoint => {
    const r = live.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
      p: e.pointerType === "pen" ? e.pressure || 0.5 : 0.5,
    };
  };

  const paintLive = () => {
    const c = live.current;
    const s = current.current;
    if (!c || !s) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    if (s.tool === "eraser") {
      // Preview erasing by redrawing the base with this stroke applied.
      const b = base.current!.getContext("2d")!;
      b.setTransform(dpr, 0, 0, dpr, 0, 0);
      b.clearRect(0, 0, size.w, size.h);
      for (const st of strokesRef.current) paintStroke(b, st, size.w, size.h);
      paintStroke(b, s, size.w, size.h, false);
    } else {
      paintStroke(ctx, s, size.w, size.h, false);
    }
  };

  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType === "touch" && penActive.current) return; // palm rejection
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (e.pointerType === "pen") penActive.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    current.current = { tool, color: colour, size: width, points: [point(e)], pointer: e.pointerType };
    paintLive();
  };
  const onMove = (e: React.PointerEvent) => {
    const s = current.current;
    if (!s) return;
    const events = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of events) s.points.push(point(ev as unknown as React.PointerEvent));
    requestAnimationFrame(paintLive);
  };
  const onUp = () => {
    const s = current.current;
    current.current = null;
    const c = live.current;
    if (c) c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    if (s && s.points.length) commit([...strokesRef.current, s]);
    setTimeout(() => (penActive.current = false), 300);
  };

  const toolBtn = (id: Tool, label: string, icon: string, key: string) => (
    <button
      type="button"
      onClick={() => setTool(id)}
      aria-pressed={tool === id}
      title={`${label} (${key.toUpperCase()})`}
      className={`flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold ${tool === id ? "bg-ink text-white" : "text-ink-soft hover:bg-black/5"}`}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </button>
  );

  return (
    <div onKeyDown={onKeyDown} className="outline-none">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-white p-1.5 ring-1 ring-line" role="toolbar" aria-label="Drawing tools">
        <div className="flex gap-0.5">
          {toolBtn("pen", "Pen", "✒︎", "p")}
          {toolBtn("pencil", "Pencil", "✏︎", "b")}
          {toolBtn("eraser", "Eraser", "⌫", "e")}
        </div>
        <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Colour">
          {COLOURS.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={colour === c.hex}
              aria-label={c.name}
              title={c.name}
              onClick={() => {
                setColour(c.hex);
                if (tool === "eraser") setTool("pen");
              }}
              className={`size-7 rounded-full ring-offset-2 transition ${colour === c.hex && tool !== "eraser" ? "ring-2 ring-ink" : "hover:scale-110"}`}
              style={{ background: c.hex }}
            />
          ))}
        </div>
        <div className="flex items-center gap-0.5" role="radiogroup" aria-label="Stroke width">
          {SIZES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={width === s.px}
              aria-label={s.label}
              title={s.label}
              onClick={() => setWidth(s.px)}
              className={`grid size-10 place-items-center rounded-lg ${width === s.px ? "bg-cream ring-1 ring-line-strong" : "hover:bg-black/5"}`}
            >
              <span className="rounded-full bg-ink" style={{ width: s.px + 2, height: s.px + 2 }} />
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          <button type="button" onClick={doUndo} disabled={!undo.length} title="Undo (Ctrl/⌘ Z)" className="h-10 rounded-lg px-3 text-sm font-semibold text-ink-soft hover:bg-black/5 disabled:opacity-30">
            ↶ Undo
          </button>
          <button type="button" onClick={doRedo} disabled={!redo.length} title="Redo (Ctrl/⌘ Shift Z)" className="h-10 rounded-lg px-3 text-sm font-semibold text-ink-soft hover:bg-black/5 disabled:opacity-30">
            ↷ Redo
          </button>
          <button
            type="button"
            onClick={() => strokes.length && commit([])}
            disabled={!strokes.length}
            className="h-10 rounded-lg px-3 text-sm font-semibold text-red hover:bg-red/5 disabled:opacity-30"
          >
            Clear
          </button>
        </div>
      </div>
      <div
        ref={wrap}
        className="relative w-full overflow-hidden rounded-xl bg-white shadow-[inset_0_0_0_1px_var(--color-line-strong)]"
        style={{ aspectRatio: String(aspect) }}
      >
        {size.w > 0 && guides !== "none" && <GuideLayer guides={guides} w={size.w} h={size.h} />}
        <canvas ref={base} className="absolute inset-0 size-full" />
        <canvas
          ref={live}
          tabIndex={0}
          aria-label="Drawing area. Use a mouse, trackpad, touch or stylus to draw."
          className={`touch-none-strict absolute inset-0 size-full ${tool === "eraser" ? "cursor-cell" : "cursor-crosshair"}`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
      <p className="mt-2 flex justify-between text-xs text-ink-mute">
        <span>
          {strokes.length} stroke{strokes.length === 1 ? "" : "s"} · saved as you draw
        </span>
        <span className="hidden sm:inline">Shortcuts: P pen · B pencil · E eraser · ⌘/Ctrl Z undo</span>
      </p>
    </div>
  );
}

function GuideLayer({ guides, w, h }: { guides: string; w: number; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = w * dpr;
    c.height = h * dpr;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintGuides(ctx, guides, w, h);
  }, [guides, w, h]);
  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 size-full" />;
}
