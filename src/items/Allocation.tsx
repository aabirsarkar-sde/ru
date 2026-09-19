"use client";
import type { ItemProps } from "./types";

/**
 * Split a fixed budget across options (e.g. "five hours a week"). Stated
 * interest is cheap; making candidates spend a limited budget shows what they
 * would actually trade off. Sliders are native range inputs, so arrow keys,
 * Home/End and screen readers work without extra code.
 */
export function Allocation({ item, response, onChange }: ItemProps<"allocation">) {
  const values = response?.allocations ?? Object.fromEntries(item.options.map((o) => [o.id, 0]));
  const used = Object.values(values).reduce((a, b) => a + b, 0);
  const left = Math.round((item.total - used) * 100) / 100;
  const cap = item.max_per_option ?? item.total;

  const set = (id: string, v: number) => {
    const others = used - (values[id] ?? 0);
    const capped = Math.min(v, cap, Math.round((item.total - others) * 100) / 100);
    onChange({ type: "allocation", allocations: { ...values, [id]: Math.max(0, capped) } });
  };
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

  return (
    <div>
      <div
        className={`mb-5 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl px-4 py-3 font-semibold ${
          left === 0 ? "bg-[#E7F3EA] text-ok" : "bg-cream text-ink"
        }`}
        aria-live="polite"
      >
        <span className="text-lg tabular-nums">
          {fmt(left)} of {fmt(item.total)} {item.unit} left to spend
        </span>
        {left === 0 && <span className="text-sm">✓ all spent</span>}
        {left < 0 && <span className="text-sm text-red">Too many — take some back.</span>}
        <span className="ml-auto flex h-2.5 w-40 overflow-hidden rounded-full bg-white ring-1 ring-line" aria-hidden>
          <span className="h-full bg-[var(--accent)] transition-[width]" style={{ width: `${Math.min(100, (used / item.total) * 100)}%` }} />
        </span>
      </div>

      <ul className="grid gap-3">
        {item.options.map((o) => {
          const v = values[o.id] ?? 0;
          return (
            <li key={o.id} className={`bg-white p-4 ring-1 transition-shadow curve-br-sm ${v > 0 ? "ring-[var(--accent)]" : "ring-line"}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <label htmlFor={`${item.id}-${o.id}`} className="font-semibold">
                  {o.label}
                </label>
                <span className="text-sm font-bold tabular-nums text-[var(--accent)]">
                  {fmt(v)} {item.unit}
                </span>
              </div>
              {o.hint && <p className="mt-0.5 text-sm text-ink-soft">{o.hint}</p>}
              <div className="mt-2 flex items-center gap-3">
                <input
                  id={`${item.id}-${o.id}`}
                  type="range"
                  min={0}
                  max={cap}
                  step={item.step}
                  value={v}
                  onChange={(e) => set(o.id, Number(e.target.value))}
                  aria-valuetext={`${fmt(v)} ${item.unit}`}
                  className="h-2 flex-1 accent-[var(--accent)]"
                />
                <button
                  type="button"
                  onClick={() => set(o.id, v - item.step)}
                  disabled={v <= 0}
                  aria-label={`Less time on ${o.label}`}
                  className="grid size-8 place-items-center rounded-lg text-ink-soft ring-1 ring-line hover:bg-cream disabled:opacity-30"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() => set(o.id, v + item.step)}
                  disabled={left <= 0 || v >= cap}
                  aria-label={`More time on ${o.label}`}
                  className="grid size-8 place-items-center rounded-lg text-ink-soft ring-1 ring-line hover:bg-cream disabled:opacity-30"
                >
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm text-ink-mute">
        There is no right answer here — spend it the way you honestly would. It isn&apos;t scored; it tells us where you&apos;d like to get involved.
      </p>
    </div>
  );
}
