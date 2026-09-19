"use client";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { t } from "@/lib/i18n";
import { Logo } from "./brand";

const SCALES = [
  { id: "", label: "A", title: "Normal text" },
  { id: "lg", label: "A+", title: "Larger text" },
  { id: "xl", label: "A++", title: "Largest text" },
];

// The chosen scale lives on <html data-fontscale> (so CSS rem sizes follow)
// and in localStorage; components read it as an external store.
const listeners = new Set<() => void>();
function applyScale(s: string, persist: boolean) {
  document.documentElement.dataset.fontscale = s;
  if (persist) {
    try {
      localStorage.setItem("ru:fontscale", s);
    } catch {}
  }
  listeners.forEach((l) => l());
}
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

export function FontSizeToggle() {
  const scale = useSyncExternalStore(subscribe, () => document.documentElement.dataset.fontscale ?? "", () => "");
  useEffect(() => {
    try {
      applyScale(localStorage.getItem("ru:fontscale") ?? "", false);
    } catch {}
  }, []);
  const pick = (s: string) => applyScale(s, true);
  return (
    <div role="radiogroup" aria-label={t("font.label")} className="flex items-center rounded-lg bg-white p-0.5 ring-1 ring-line">
      {SCALES.map((s, i) => (
        <button
          key={s.id}
          type="button"
          role="radio"
          aria-checked={scale === s.id}
          title={s.title}
          onClick={() => pick(s.id)}
          className={`h-8 rounded-md px-2 font-serif leading-none ${scale === s.id ? "bg-ink text-white" : "text-ink-soft hover:bg-black/5"}`}
          style={{ fontSize: 13 + i * 3 }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

export function TopBar({ children, right }: { children?: ReactNode; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/92 backdrop-blur supports-[backdrop-filter]:bg-paper/80">
      <div className="mx-auto flex max-w-[92rem] items-center gap-5 px-4 py-2.5 sm:px-6">
        <Logo />
        <div className="hidden h-9 w-px bg-line-strong md:block" />
        <div className="min-w-0 flex-1">{children}</div>
        <div className="flex shrink-0 items-center gap-3">
          {right}
          <FontSizeToggle />
        </div>
      </div>
    </header>
  );
}
