"use client";
import { useRef, useState } from "react";
import { wordCount, type Pin } from "@/engine/responses";
import { t } from "@/lib/i18n";
import type { ItemProps } from "./types";

/**
 * Pin-and-annotate on an image. Built for UX empathy tasks: "mark where this
 * person gets stuck, and say what they're thinking". Pins are stored in % of
 * the image so any screenshot size works.
 */
export function Hotspot({ item, response, onChange, onActivity }: ItemProps<"hotspot">) {
  const pins = response?.pins ?? [];
  const frame = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [warned, setWarned] = useState(false);
  const drag = useRef<{ id: string; moved: boolean } | null>(null);
  const full = pins.length >= item.max_pins;

  const set = (next: Pin[]) => onChange({ type: "hotspot", pins: next });
  const clamp = (v: number) => Math.min(100, Math.max(0, Math.round(v * 10) / 10));
  const at = (clientX: number, clientY: number) => {
    const r = frame.current!.getBoundingClientRect();
    return { x: clamp(((clientX - r.left) / r.width) * 100), y: clamp(((clientY - r.top) / r.height) * 100) };
  };
  const add = (x: number, y: number) => {
    if (full) return;
    const n = pins.reduce((m, p) => Math.max(m, Number(p.id.slice(1)) || 0), 0) + 1;
    const pin: Pin = { id: `p${n}`, x, y, note: "" };
    set([...pins, pin]);
    setSelected(pin.id);
    // Put the cursor straight into the new pin's note.
    setTimeout(() => document.getElementById(`${item.id}-${pin.id}`)?.focus({ preventScroll: true }), 30);
  };
  const move = (id: string, x: number, y: number) => set(pins.map((p) => (p.id === id ? { ...p, x: clamp(x), y: clamp(y) } : p)));
  const remove = (id: string) => {
    set(pins.filter((p) => p.id !== id));
    setSelected(null);
  };

  return (
    <div className="grid items-start gap-6 md:grid-cols-[auto_minmax(0,1fr)]">
      <div className="mx-auto w-full" style={{ maxWidth: item.image.width }}>
        <div
          ref={frame}
          role="application"
          aria-label={`${item.image.alt}. Click to place a pin (${pins.length} of ${item.max_pins} placed).`}
          className={`relative select-none overflow-hidden rounded-[1.6rem] bg-white shadow-[0_24px_50px_-24px_rgb(51_58_61/0.55)] ring-8 ring-ink ${full ? "cursor-default" : "cursor-crosshair"}`}
          onClick={(e) => {
            // Any pin interaction (click or drag) must not also drop a new pin.
            if (drag.current) return;
            const p = at(e.clientX, e.clientY);
            add(p.x, p.y);
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            d.moved = true;
            const p = at(e.clientX, e.clientY);
            move(d.id, p.x, p.y);
          }}
          onPointerUp={() => setTimeout(() => (drag.current = null), 0)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.image.src} alt="" draggable={false} className="block w-full" style={{ aspectRatio: String(item.image.aspect) }} />
          {pins.map((p, i) => (
            <button
              key={p.id}
              type="button"
              aria-label={`Pin ${i + 1}. Arrow keys move it; Delete removes it.`}
              onClick={(e) => {
                e.stopPropagation();
                setSelected(p.id);
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                (e.currentTarget.parentElement as HTMLElement).setPointerCapture(e.pointerId);
                drag.current = { id: p.id, moved: false };
                setSelected(p.id);
              }}
              onKeyDown={(e) => {
                const step = e.shiftKey ? 5 : 1;
                const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
                if (d) {
                  e.preventDefault();
                  move(p.id, p.x + d[0], p.y + d[1]);
                } else if (e.key === "Delete" || e.key === "Backspace") {
                  e.preventDefault();
                  remove(p.id);
                }
              }}
              className={`absolute grid size-8 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none place-items-center rounded-full text-sm font-bold text-white shadow-lg ring-[3px] ring-white transition-transform active:cursor-grabbing ${
                selected === p.id ? "scale-110 bg-red" : "bg-[var(--accent)]"
              }`}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-ink-mute">
          {full ? `All ${item.max_pins} pins placed — drag a pin to move it.` : `Click the screen to place a pin · ${pins.length}/${item.max_pins}`}
        </p>
      </div>

      <div className="grid content-start gap-3">
        {pins.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-line-strong p-5 text-sm text-ink-soft">
            Click anywhere on the screen where this person would hesitate, get confused or feel let down. A numbered pin
            appears, and you can write what they&apos;re thinking.
          </div>
        )}
        {pins.map((p, i) => {
          const words = wordCount(p.note);
          const over = words > item.note_word_limit;
          return (
            <div
              key={p.id}
              className={`bg-white p-4 ring-1 transition-shadow curve-br-sm ${selected === p.id ? "ring-2 ring-[var(--accent)]" : "ring-line"}`}
              onFocus={() => setSelected(p.id)}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <label htmlFor={`${item.id}-${p.id}`} className="flex items-center gap-2 text-sm font-semibold">
                  <span className="grid size-6 place-items-center rounded-full bg-[var(--accent)] text-xs text-white">{i + 1}</span>
                  {item.note_label}
                </label>
                <button type="button" onClick={() => remove(p.id)} className="text-xs font-semibold text-red hover:underline">
                  Remove
                </button>
              </div>
              <textarea
                id={`${item.id}-${p.id}`}
                value={p.note}
                rows={2}
                placeholder="In their words, what's going on here?"
                onChange={(e) => set(pins.map((q) => (q.id === p.id ? { ...q, note: e.target.value } : q)))}
                onPaste={(e) => {
                  e.preventDefault();
                  onActivity?.("paste_blocked");
                  setWarned(true);
                  setTimeout(() => setWarned(false), 4000);
                }}
                onDrop={(e) => e.preventDefault()}
                className={`block w-full resize-y rounded-lg bg-paper px-3 py-2 text-[0.95rem] leading-relaxed outline-none ring-1 focus:ring-2 ${over ? "ring-red" : "ring-line focus:ring-[var(--accent)]"}`}
              />
              <p className={`mt-1 text-right text-xs tabular-nums ${over ? "font-semibold text-red" : "text-ink-mute"}`}>
                {t("text.words", { n: words, limit: item.note_word_limit })}
              </p>
            </div>
          );
        })}
        {!full && (
          <button
            type="button"
            onClick={() => add(50, 50)}
            className="w-fit rounded-lg px-3 py-2 text-sm font-semibold text-ink-soft ring-1 ring-line hover:bg-white hover:ring-line-strong"
          >
            + Add a pin with the keyboard (then move it with the arrow keys)
          </button>
        )}
        {warned && <p role="alert" className="rounded-lg bg-cream px-4 py-2.5 text-sm font-medium">✋ {t("text.pasteBlocked")}</p>}
        {pins.length > 0 && pins.length < item.min_pins && (
          <p className="text-sm font-medium text-narangi-ink">Place at least {item.min_pins} pins.</p>
        )}
      </div>
    </div>
  );
}
