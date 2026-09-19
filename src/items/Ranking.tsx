"use client";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo } from "react";
import { rng, shuffle } from "@/engine/prng";
import type { Option } from "@/content/schema";
import type { ItemProps } from "./types";

export function Ranking({ item, response, onChange, ctx }: ItemProps<"ranking">) {
  // Start in a per-candidate shuffled order so the content file's order (often
  // the key) is never a hint.
  const initial = useMemo(
    () => shuffle(item.options.map((o) => o.id), rng(ctx.candidateId, item.id)),
    [ctx.candidateId, item.id, item.options],
  );
  const order = response?.order ?? initial;
  const byId = new Map(item.options.map((o) => [o.id, o]));
  const set = (next: string[]) => onChange({ type: "ranking", order: next, touched: true });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    set(arrayMove(order, order.indexOf(String(e.active.id)), order.indexOf(String(e.over.id))));
  };

  return (
    <div>
      <p className="mb-3 text-sm text-ink-soft">
        Drag the cards, or use the arrows. With a keyboard: focus a card&apos;s handle, press <kbd className="rounded bg-cream px-1">Space</kbd>, move with{" "}
        <kbd className="rounded bg-cream px-1">↑</kbd>
        <kbd className="rounded bg-cream px-1">↓</kbd>, press <kbd className="rounded bg-cream px-1">Space</kbd> again.
      </p>
      <div className="flex gap-3">
        <div aria-hidden className="flex w-6 flex-col items-center justify-between py-2 text-[0.65rem] font-semibold uppercase tracking-widest text-ink-mute">
          <span className="[writing-mode:vertical-rl] rotate-180">{item.top_label}</span>
          <span className="my-2 w-px flex-1 bg-gradient-to-b from-[var(--accent)] to-line-strong" />
          <span className="[writing-mode:vertical-rl] rotate-180">{item.bottom_label}</span>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <ol className="grid flex-1 gap-2.5" aria-label={`${item.top_label} to ${item.bottom_label}`}>
              {order.map((id, i) => (
                <SortableCard
                  key={id}
                  option={byId.get(id)!}
                  rank={i + 1}
                  count={order.length}
                  onMove={(dir) => set(arrayMove(order, i, i + dir))}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      </div>
      {!response?.touched && (
        <p className="mt-3 text-sm font-medium text-narangi-ink">Not answered yet — move at least one card to record your ranking.</p>
      )}
      {response?.touched && (
        <button type="button" className="mt-3 text-sm text-ink-mute hover:underline" onClick={() => set(order)}>
          I&apos;m happy with this order ✓
        </button>
      )}
    </div>
  );
}

function SortableCard({ option, rank, count, onMove }: { option: Option; rank: number; count: number; onMove: (dir: -1 | 1) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: option.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-stretch gap-0 overflow-hidden rounded-xl bg-white ring-1 ring-line ${isDragging ? "z-10 shadow-xl ring-2 ring-[var(--accent)]" : ""}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Rank ${rank} of ${count}: ${option.label}. Press space to pick up.`}
        className="flex w-14 shrink-0 cursor-grab touch-none flex-col items-center justify-center gap-1 bg-cream text-ink active:cursor-grabbing"
      >
        <span className="font-serif text-2xl leading-none">{rank}</span>
        <span aria-hidden className="text-xs text-ink-mute">⋮⋮</span>
      </button>
      <p className="flex-1 px-4 py-3 leading-snug">{option.label}</p>
      <div className="flex flex-col border-l border-line">
        <button type="button" onClick={() => onMove(-1)} disabled={rank === 1} aria-label="Move up" className="flex-1 px-3 text-ink-soft hover:bg-cream disabled:opacity-25">
          ▲
        </button>
        <button type="button" onClick={() => onMove(1)} disabled={rank === count} aria-label="Move down" className="flex-1 border-t border-line px-3 text-ink-soft hover:bg-cream disabled:opacity-25">
          ▼
        </button>
      </div>
    </li>
  );
}
