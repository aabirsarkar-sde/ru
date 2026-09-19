"use client";
import { useRef, useState } from "react";
import type { TextField } from "@/content/schema";
import { wordCount, type TypingSummary } from "@/engine/responses";
import { t } from "@/lib/i18n";
import type { ItemProps } from "./types";

type TextItemProps = ItemProps<"short_text"> | ItemProps<"long_text">;

/**
 * Word-limited answers. Paste and drop are blocked and logged; a keystroke
 * summary is kept as an integrity *signal* (never an automatic penalty).
 */
export function TextResponse({ item, response, onChange, onActivity }: TextItemProps) {
  const fields: TextField[] =
    item.type === "short_text" && item.fields?.length
      ? item.fields
      : [
          {
            id: "main",
            label: "",
            word_limit: item.word_limit ?? 100,
            placeholder: item.placeholder,
            rows: item.type === "long_text" ? 12 : Math.max(4, Math.round((item.word_limit ?? 60) / 14)),
          },
        ];
  const values = response?.fields ?? {};
  const typing = useRef<TypingSummary>(response && "typing" in response && response.typing ? response.typing : { keystrokes: 0, bulkInserts: 0, pasteAttempts: 0, activeMs: 0 });
  const lastKey = useRef(0);
  const [warned, setWarned] = useState(false);

  const emit = (fieldId: string, value: string) => {
    onChange({ type: item.type, fields: { ...values, [fieldId]: value }, typing: { ...typing.current } });
  };

  const blocked = (e: React.ClipboardEvent | React.DragEvent) => {
    e.preventDefault();
    typing.current.pasteAttempts++;
    onActivity?.("paste_blocked");
    setWarned(true);
    setTimeout(() => setWarned(false), 4000);
  };

  return (
    <div className="grid gap-5">
      {fields.map((f) => {
        const value = values[f.id] ?? "";
        const words = wordCount(value);
        const over = words - f.word_limit;
        const pct = Math.min(1, words / f.word_limit);
        const inputId = `${item.id}-${f.id}`;
        return (
          <div key={f.id}>
            {f.label && (
              <label htmlFor={inputId} className="mb-2 block font-semibold leading-snug text-ink">
                {f.label}
              </label>
            )}
            <div className={`overflow-hidden rounded-xl bg-white ring-1 transition-shadow focus-within:ring-2 ${over > 0 ? "ring-red focus-within:ring-red" : "ring-line-strong focus-within:ring-[var(--accent)]"}`}>
              <textarea
                id={inputId}
                aria-label={f.label || item.prompt}
                value={value}
                rows={f.rows ?? 5}
                placeholder={f.placeholder ?? "Type your answer here…"}
                spellCheck
                className="block w-full resize-y bg-transparent px-4 py-3 leading-relaxed text-ink outline-none placeholder:text-ink-mute/70"
                onPaste={blocked}
                onDrop={blocked}
                onKeyDown={(e) => {
                  if (e.key.length === 1 || e.key === "Backspace" || e.key === "Enter" || e.key === "Delete") {
                    typing.current.keystrokes++;
                    const now = performance.now();
                    if (now - lastKey.current < 5000) typing.current.activeMs += now - lastKey.current;
                    lastKey.current = now;
                  }
                }}
                onChange={(e) => {
                  const grew = e.target.value.length - value.length;
                  if (grew > 3 && performance.now() - lastKey.current > 150) typing.current.bulkInserts++;
                  emit(f.id, e.target.value);
                }}
              />
              <div className="flex items-center gap-3 border-t border-line/70 bg-paper/60 px-4 py-2 text-xs">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
                  <div
                    className={`h-full rounded-full transition-[width] ${over > 0 ? "bg-red" : pct > 0.9 ? "bg-narangi" : "bg-[var(--accent)]"}`}
                    style={{ width: `${pct * 100}%` }}
                  />
                </div>
                <span className={`tabular-nums font-semibold ${over > 0 ? "text-red" : "text-ink-soft"}`} aria-live="polite">
                  {t("text.words", { n: words, limit: f.word_limit })}
                </span>
              </div>
            </div>
            {over > 0 && <p className="mt-1.5 text-sm font-medium text-red">{t("text.over", { n: over })}</p>}
          </div>
        );
      })}
      {warned && (
        <p role="alert" className="animate-rise rounded-lg bg-cream px-4 py-2.5 text-sm font-medium text-ink">
          ✋ {t("text.pasteBlocked")}
        </p>
      )}
    </div>
  );
}
