// Brand primitives. The logo files in /public/brand are extracted, unmodified,
// from the official Brand Guidelines 2023 PDF — the logo is never retyped or
// redrawn (guidelines ch. 2). Min on-screen width is 200px.
import Link from "next/link";
import type { ReactNode } from "react";

export function Logo({ width = 200, href = "/", reverse = false }: { width?: number; href?: string | null; reverse?: boolean }) {
  const w = Math.max(200, width);
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={reverse ? "/brand/logo-color-reverse.svg" : "/brand/logo-color.svg"}
      alt="Rishihood University"
      width={w}
      height={Math.round(w * 0.3716)}
      style={{ width: w, height: "auto" }}
    />
  );
  return href ? (
    <Link href={href} className="inline-block shrink-0" aria-label="Rishihood University — home">
      {img}
    </Link>
  ) : (
    <span className="inline-block shrink-0">{img}</span>
  );
}

/** The crest used as an imagery frame (guidelines: "Crest — Imagery"). */
export function CrestFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={className}
      style={{
        WebkitMaskImage: "url(/brand/crest-shape.svg)",
        maskImage: "url(/brand/crest-shape.svg)",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    >
      {children}
    </div>
  );
}

/** Crest watermark: white at 20% (guidelines: "Crest — Watermark"). */
export function CrestWatermark({ className = "" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/crest-white.svg" alt="" aria-hidden className={`pointer-events-none select-none opacity-20 ${className}`} />;
}

/** "School of …" curve band, as in the design templates. */
export function SchoolBand({ school, className = "" }: { school: string; className?: string }) {
  const [first, ...rest] = school.split(" ");
  const tail = rest.slice(1).join(" ");
  return (
    <div className={`inline-flex flex-col bg-[var(--accent)] px-4 py-2 text-white curve-tr-sm ${className}`}>
      <span className="text-[0.7rem] font-light uppercase tracking-[0.16em]">
        {first} {rest[0]}
      </span>
      <span className="text-sm font-semibold uppercase tracking-[0.12em]">{tail}</span>
    </div>
  );
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--accent)] ${className}`}>{children}</p>;
}
