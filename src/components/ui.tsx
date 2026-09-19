"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";

/* ---------------------------------------------------------------- button -- */

type Variant = "primary" | "secondary" | "ghost" | "danger";
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" }) {
  const base =
    "inline-flex items-center justify-center gap-2 font-semibold transition-[background,color,box-shadow,transform] duration-150 disabled:cursor-not-allowed disabled:opacity-45 active:translate-y-px";
  const sizes = { sm: "h-9 px-3.5 text-sm rounded-lg", md: "h-11 px-5 text-[0.95rem] rounded-xl", lg: "h-13 px-7 text-base rounded-xl" };
  const variants: Record<Variant, string> = {
    primary: "bg-[var(--accent)] text-white hover:brightness-110 shadow-[0_1px_0_rgb(0_0_0/0.15)]",
    secondary: "bg-white text-ink ring-1 ring-line-strong hover:ring-[var(--accent)] hover:text-[var(--accent)]",
    ghost: "text-ink-soft hover:bg-black/5 hover:text-ink",
    danger: "bg-red text-white hover:bg-red-deep",
  };
  return <button type="button" className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />;
}

/* ----------------------------------------------------------------- modal -- */

export function Modal({
  open,
  title,
  children,
  onClose,
  actions,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  onClose: () => void;
  actions: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(92vw,30rem)] bg-paper p-0 text-ink shadow-2xl backdrop:bg-ink/50 backdrop:backdrop-blur-[2px] curve-br"
    >
      <div className="p-7">
        <h2 className="font-serif text-3xl leading-tight">{title}</h2>
        <div className="mt-3 text-ink-soft">{children}</div>
        <div className="mt-7 flex flex-wrap justify-end gap-3">{actions}</div>
      </div>
    </dialog>
  );
}

/* ---------------------------------------------------------------- toasts -- */

interface Toast {
  id: number;
  text: string;
  tone: "info" | "warn" | "alert";
}
const ToastCtx = createContext<(text: string, tone?: Toast["tone"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "alert" ? 7000 : 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="assertive" className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex max-w-lg animate-rise items-center gap-3 px-5 py-3 text-[0.95rem] font-medium shadow-xl curve-br-sm ${
              t.tone === "alert" ? "bg-red text-white" : t.tone === "warn" ? "bg-narangi-ink text-white" : "bg-ink text-white"
            }`}
          >
            <span aria-hidden className="text-lg">
              {t.tone === "info" ? "✓" : "⏱"}
            </span>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ------------------------------------------------------------------ misc -- */

export function Pill({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>{children}</span>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />;
}
