"use client";
import { MediaView, inline } from "@/components/media";
import type { Option } from "@/content/schema";
import type { ItemProps } from "./types";

function OptionCard({
  option,
  checked,
  kind,
  name,
  grid,
  onToggle,
  index,
}: {
  option: Option;
  checked: boolean;
  kind: "radio" | "checkbox";
  name: string;
  grid: boolean;
  onToggle: () => void;
  index: number;
}) {
  const letter = String.fromCharCode(65 + index);
  return (
    <label
      className={`group relative flex cursor-pointer gap-3 bg-white p-4 ring-1 transition-[box-shadow,background] duration-150 ${
        grid ? "flex-col curve-br-sm" : "items-start rounded-xl"
      } ${checked ? "bg-[var(--accent-soft)] ring-2 ring-[var(--accent)]" : "ring-line hover:ring-line-strong"}`}
    >
      <input type={kind} name={name} checked={checked} onChange={onToggle} className="peer sr-only" />
      <span
        aria-hidden
        className={`grid size-7 shrink-0 place-items-center text-sm font-bold transition-colors peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--accent)] ${
          kind === "radio" ? "rounded-full" : "rounded-md"
        } ${checked ? "bg-[var(--accent)] text-white" : "bg-cream text-ink-soft group-hover:bg-sand"}`}
      >
        {checked && kind === "checkbox" ? "✓" : letter}
      </span>
      {option.media && (
        <div className={grid ? "w-full" : "w-40"}>
          <MediaView media={option.media} compact />
        </div>
      )}
      {/* In image grids the letter badge already names single-letter options. */}
      {!(grid && option.label.trim() === letter) && (
        <span className={`leading-snug ${grid ? "text-sm font-semibold" : "pt-0.5"}`}>{inline(option.label)}</span>
      )}
    </label>
  );
}

export function McqSingle({ item, response, onChange }: ItemProps<"mcq_single">) {
  const grid = item.layout === "grid";
  const choice = response?.choice ?? null;
  return (
    <fieldset>
      <legend className="sr-only">{item.prompt}</legend>
      <div className={grid ? "grid grid-cols-2 gap-3 md:grid-cols-4" : "grid gap-2.5"}>
        {item.options.map((o, i) => (
          <OptionCard
            key={o.id}
            option={o}
            index={i}
            kind="radio"
            name={item.id}
            grid={grid}
            checked={choice === o.id}
            onToggle={() => onChange({ type: "mcq_single", choice: o.id })}
          />
        ))}
      </div>
      {choice && (
        <button type="button" className="mt-3 text-sm text-ink-mute underline-offset-2 hover:underline" onClick={() => onChange({ type: "mcq_single", choice: null })}>
          Clear my answer
        </button>
      )}
    </fieldset>
  );
}

export function McqMulti({ item, response, onChange }: ItemProps<"mcq_multi">) {
  const grid = item.layout === "grid";
  const choices = response?.choices ?? [];
  const toggle = (id: string) =>
    onChange({ type: "mcq_multi", choices: choices.includes(id) ? choices.filter((c) => c !== id) : [...choices, id] });
  return (
    <fieldset>
      <legend className="sr-only">{item.prompt}</legend>
      <p className="mb-3 text-sm font-medium text-ink-soft">Select all that apply. Wrong picks cancel out right ones.</p>
      <div className={grid ? "grid grid-cols-2 gap-3 md:grid-cols-4" : "grid gap-2.5"}>
        {item.options.map((o, i) => (
          <OptionCard
            key={o.id}
            option={o}
            index={i}
            kind="checkbox"
            name={item.id}
            grid={grid}
            checked={choices.includes(o.id)}
            onToggle={() => toggle(o.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}
