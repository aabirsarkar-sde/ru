"use client";
import { useLayoutEffect, useRef, useState } from "react";
import type { Item } from "@/content/schema";
import type { Placement } from "@/engine/responses";
import type { ItemProps } from "./types";

type Block = Extract<Item, { type: "layout_drag" }>["blocks"][number];
const MIN = 24;

export function LayoutDrag({ item, response, onChange }: ItemProps<"layout_drag">) {
  const placements = response?.placements ?? {};
  const { width: AW, height: AH } = item.artboard;
  const board = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ block: Block; x: number; y: number } | null>(null);
  const drag = useRef<{ id: string; mode: "move" | "resize"; sx: number; sy: number; start: Placement } | null>(null);

  useLayoutEffect(() => {
    const el = board.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(Math.min(1.25, e.contentRect.width / AW)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [AW]);

  const clamp = (p: Placement): Placement => {
    const w = Math.max(MIN, Math.min(AW, p.w));
    const h = Math.max(MIN, Math.min(AH, p.h));
    return { w, h, x: Math.max(0, Math.min(AW - w, p.x)), y: Math.max(0, Math.min(AH - h, p.y)) };
  };
  const put = (id: string, p: Placement | null) => {
    const next = { ...placements };
    if (p) next[id] = clamp(p);
    else delete next[id];
    onChange({ type: "layout_drag", placements: next });
  };

  // Drag from the tray onto the artboard.
  const startTrayDrag = (e: React.PointerEvent, block: Block) => {
    e.preventDefault();
    setGhost({ block, x: e.clientX, y: e.clientY });
    const move = (ev: PointerEvent) => setGhost({ block, x: ev.clientX, y: ev.clientY });
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setGhost(null);
      const r = board.current!.getBoundingClientRect();
      if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
        const x = (ev.clientX - r.left) / scale - block.width / 2;
        const y = (ev.clientY - r.top) / scale - block.height / 2;
        put(block.id, { x, y, w: block.width, h: block.height });
        setSelected(block.id);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  // Move / resize blocks already on the artboard.
  const startBoardDrag = (e: React.PointerEvent, id: string, mode: "move" | "resize") => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id, mode, sx: e.clientX, sy: e.clientY, start: placements[id] };
    setSelected(id);
  };
  const onBoardMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) / scale;
    const dy = (e.clientY - d.sy) / scale;
    put(
      d.id,
      d.mode === "move"
        ? { ...d.start, x: d.start.x + dx, y: d.start.y + dy }
        : { ...d.start, w: d.start.w + dx, h: d.start.h + dy },
    );
  };

  const onKey = (e: React.KeyboardEvent, id: string) => {
    const p = placements[id];
    if (!p) return;
    const step = e.shiftKey ? 20 : 4;
    const k = e.key;
    if (k === "Delete" || k === "Backspace") {
      e.preventDefault();
      put(id, null);
      setSelected(null);
      return;
    }
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[k];
    if (!d) return;
    e.preventDefault();
    put(id, e.altKey ? { ...p, w: p.w + d[0], h: p.h + d[1] } : { ...p, x: p.x + d[0], y: p.y + d[1] });
  };

  const tray = item.blocks.filter((b) => !placements[b.id]);

  return (
    <div className="grid gap-5 md:grid-cols-[13rem_1fr]">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-ink-mute">Blocks</p>
        <ul className="grid gap-2">
          {tray.map((b) => (
            <li key={b.id}>
              <button
                type="button"
                onPointerDown={(e) => startTrayDrag(e, b)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    put(b.id, { x: (AW - b.width) / 2, y: (AH - b.height) / 2, w: b.width, h: b.height });
                    setSelected(b.id);
                  }
                }}
                aria-label={`${b.label}. Drag onto the poster, or press Enter to place it in the centre.`}
                className="flex w-full cursor-grab touch-none items-center gap-3 rounded-lg bg-white px-3 py-2.5 text-left ring-1 ring-line hover:ring-[var(--accent)] active:cursor-grabbing"
              >
                <span aria-hidden className="text-ink-mute">⋮⋮</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{b.label}</span>
                  {b.text && <span className="block truncate text-xs text-ink-mute">{b.text}</span>}
                </span>
              </button>
            </li>
          ))}
          {!tray.length && <li className="rounded-lg bg-cream px-3 py-2.5 text-sm text-ink-soft">All blocks are on the poster.</li>}
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-ink-mute">
          Selected block: arrow keys move it (Shift = bigger steps), Alt/Option + arrows resize, Delete returns it to this list.
        </p>
      </div>

      <div className="flex min-w-0 flex-col items-center">
        <div
          ref={board}
          role="application"
          aria-label={`${item.artboard.label ?? "Artboard"}: ${Object.keys(placements).length} blocks placed`}
          onPointerMove={onBoardMove}
          onPointerUp={() => (drag.current = null)}
          onPointerDown={() => setSelected(null)}
          className="relative touch-none overflow-hidden shadow-[0_18px_40px_-18px_rgb(51_58_61/0.45)] ring-1 ring-line-strong"
          style={{ width: AW * scale, height: AH * scale, background: item.artboard.background }}
        >
          {item.blocks
            .filter((b) => placements[b.id])
            .map((b) => {
              const p = placements[b.id];
              const sel = selected === b.id;
              return (
                <div
                  key={b.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`${b.label} at ${Math.round(p.x)}, ${Math.round(p.y)}, size ${Math.round(p.w)} by ${Math.round(p.h)}`}
                  onFocus={() => setSelected(b.id)}
                  onKeyDown={(e) => onKey(e, b.id)}
                  onPointerDown={(e) => startBoardDrag(e, b.id, "move")}
                  className={`absolute cursor-move select-none outline-none ${sel ? "ring-2 ring-[var(--accent)]" : "hover:ring-1 hover:ring-ink/30"}`}
                  style={{ left: p.x * scale, top: p.y * scale, width: p.w * scale, height: p.h * scale }}
                >
                  <BlockFace block={b} w={p.w * scale} h={p.h * scale} />
                  {sel && b.resizable && (
                    <span
                      onPointerDown={(e) => startBoardDrag(e, b.id, "resize")}
                      aria-hidden
                      className="absolute -bottom-1.5 -right-1.5 size-4 cursor-nwse-resize rounded-sm border-2 border-white bg-[var(--accent)]"
                    />
                  )}
                </div>
              );
            })}
          {!Object.keys(placements).length && (
            <p className="pointer-events-none absolute inset-0 grid place-items-center p-6 text-center text-sm text-ink-mute">
              Drag blocks here to build your poster
            </p>
          )}
        </div>
        <p className="mt-2 text-xs text-ink-mute">{item.artboard.label ?? "Artboard"}</p>
      </div>

      {ghost && (
        <div
          className="pointer-events-none fixed z-50 opacity-80"
          style={{ left: ghost.x - (ghost.block.width * scale) / 2, top: ghost.y - (ghost.block.height * scale) / 2, width: ghost.block.width * scale, height: ghost.block.height * scale }}
        >
          <BlockFace block={ghost.block} w={ghost.block.width * scale} h={ghost.block.height * scale} />
        </div>
      )}
    </div>
  );
}

export function BlockFace({ block, w, h }: { block: Block; w: number; h: number }) {
  if (block.kind === "image" || block.kind === "shape") {
    return (
      <div className="relative size-full overflow-hidden" style={{ background: "linear-gradient(160deg,#F2D5A0,#CC5C2F)" }}>
        <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 size-full">
          <circle cx="72" cy="18" r="8" fill="#FFE5CD" />
          <path d="M0 60 L28 26 L46 44 L62 30 L100 60 Z" fill="#81204D" opacity="0.85" />
          <path d="M0 60 L20 42 L40 60 Z" fill="#561842" opacity="0.8" />
        </svg>
      </div>
    );
  }
  const text = block.text ?? block.label;
  const lines = block.kind === "text" ? 2 : 1;
  const size = Math.max(8, Math.min(h / (lines * 1.25), (w / Math.max(4, text.length / lines)) * 1.7));
  const style =
    block.kind === "headline"
      ? "font-serif font-semibold text-ink"
      : block.kind === "date"
        ? "font-sans font-extrabold tracking-tight text-red"
        : "font-sans font-medium text-ink-soft";
  return (
    <div className={`flex size-full items-center overflow-hidden leading-[1.15] ${style}`} style={{ fontSize: size }}>
      {text}
    </div>
  );
}
