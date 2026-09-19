"use client";
import { Fragment, useState, type ReactNode } from "react";
import type { ChartSpec, Media, TableSpec } from "@/content/schema";

/* -------------------------------------------------------------- richtext -- */

/** Paragraphs + **bold** + *italic*. Content authors write plain YAML text. */
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const paras = text.trim().split(/\n\s*\n/);
  return (
    <div className={`prose-ru ${className}`}>
      {paras.map((p, i) => (
        <p key={i}>{inline(p.replace(/\n/g, " "))}</p>
      ))}
    </div>
  );
}

export function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    out.push(tok.startsWith("**") ? <strong key={k++}>{tok.slice(2, -2)}</strong> : <em key={k++}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/* ----------------------------------------------------------------- media -- */

export function MediaView({ media, compact = false }: { media: Media; compact?: boolean }) {
  switch (media.kind) {
    case "image":
      if (media.frame === "phone")
        return (
          <figure className="mx-auto w-full" style={{ maxWidth: media.width ?? 320 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={media.src} alt={media.alt} className="block w-full overflow-hidden rounded-[1.6rem] bg-white shadow-[0_24px_50px_-24px_rgb(51_58_61/0.55)] ring-8 ring-ink" />
            {media.caption && <figcaption className="mt-3 text-center text-sm font-medium text-ink-soft">{media.caption}</figcaption>}
          </figure>
        );
      return <ZoomImage src={media.src} alt={media.alt} caption={media.caption} zoomable={media.zoomable} compact={compact} />;
    case "strip":
      return (
        <figure>
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {media.panels.map((p, i) => (
              <li key={p.src} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src} alt={p.alt} className="w-full rounded-md bg-white" loading="lazy" />
                <span className="absolute left-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-ink text-xs font-bold text-white">
                  {i + 1}
                </span>
              </li>
            ))}
          </ol>
          {media.caption && <figcaption className="mt-2 text-sm text-ink-mute">{media.caption}</figcaption>}
        </figure>
      );
    case "palette":
      return <Palette colors={media.colors} label={media.label} />;
    case "chart":
      return <Chart spec={media.chart} />;
    case "table":
      return <DataTable spec={media.table} />;
  }
}

function ZoomImage({
  src,
  alt,
  caption,
  zoomable,
  compact,
}: {
  src: string;
  alt: string;
  caption?: string;
  zoomable?: boolean;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={`w-full rounded-lg bg-white ${compact ? "" : "shadow-sm ring-1 ring-line"}`} loading="lazy" />
  );
  return (
    <figure>
      {zoomable ? (
        <button type="button" onClick={() => setOpen(true)} className="group relative block w-full cursor-zoom-in" aria-label={`Enlarge image: ${alt}`}>
          {img}
          <span className="absolute bottom-3 right-3 rounded-full bg-ink/80 px-3 py-1 text-xs font-semibold text-white opacity-90 group-hover:opacity-100">
            ⤢ Enlarge
          </span>
        </button>
      ) : (
        img
      )}
      {caption && <figcaption className="mt-1.5 text-center text-sm font-medium text-ink-soft">{caption}</figcaption>}
      {open && (
        <div
          role="dialog"
          aria-modal
          aria-label={alt}
          className="fixed inset-0 z-50 grid animate-fade place-items-center bg-ink/85 p-4"
          onClick={() => setOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="max-h-[90vh] max-w-[95vw] rounded-lg bg-white" />
          <button autoFocus className="absolute right-5 top-5 rounded-full bg-white px-4 py-2 text-sm font-semibold" onClick={() => setOpen(false)}>
            Close ✕
          </button>
        </div>
      )}
    </figure>
  );
}

function Palette({ colors, label }: { colors: string[]; label?: string }) {
  // A two-colour palette with a label renders as a text-on-background sample.
  if (label && colors.length === 2) {
    return (
      <div className="grid h-24 place-items-center rounded-lg ring-1 ring-line" style={{ background: colors[0] }}>
        <span className="font-serif text-4xl font-semibold" style={{ color: colors[1] }}>
          Chai ₹20
        </span>
      </div>
    );
  }
  return (
    <div className="flex h-24 overflow-hidden rounded-lg ring-1 ring-line">
      {colors.map((c) => (
        <span key={c} className="flex-1" style={{ background: c }} title={c} />
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- chart -- */

const SERIES = ["var(--color-series-1)", "var(--color-series-2)", "var(--color-series-3)"];

function niceTicks(min: number, max: number, count = 5): number[] {
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

/**
 * Small SVG charts for test stimuli. Deliberately no hover tooltips: reading
 * values off the axis is part of what P2 assesses. Axes honour y_min exactly,
 * including truncated axes that some items ask candidates to spot.
 */
export function Chart({ spec }: { spec: ChartSpec }) {
  const W = 560;
  const H = 300;
  const m = { t: 20, r: 16, b: 40, l: 52 };
  const iw = W - m.l - m.r;
  const ih = H - m.t - m.b;
  const all = spec.series.flatMap((s) => s.values);
  const yMin = spec.y_min ?? Math.min(0, ...all);
  const yMax = spec.y_max ?? Math.max(...all) * 1.1;
  const y = (v: number) => m.t + ih - ((v - yMin) / (yMax - yMin)) * ih;
  const ticks = niceTicks(yMin, yMax);
  const band = iw / spec.categories.length;
  const multi = spec.series.length > 1;

  return (
    <figure className="rounded-lg bg-white p-4 ring-1 ring-line">
      {spec.title && <figcaption className="mb-2 text-sm font-semibold text-ink">{spec.title}</figcaption>}
      {multi && (
        <div className="mb-2 flex flex-wrap gap-4 text-xs text-ink-soft" aria-hidden>
          {spec.series.map((s, i) => (
            <span key={s.name} className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: SERIES[i] }} />
              {s.name}
            </span>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={chartSummary(spec)}>
        {ticks.map((tv) => (
          <g key={tv}>
            <line x1={m.l} x2={W - m.r} y1={y(tv)} y2={y(tv)} stroke="#ECE3D3" strokeWidth={1} />
            <text x={m.l - 8} y={y(tv) + 4} textAnchor="end" fontSize={12} fill="#5B6366">
              {tv}
            </text>
          </g>
        ))}
        <line x1={m.l} x2={W - m.r} y1={m.t + ih} y2={m.t + ih} stroke="#80878A" strokeWidth={1} />
        {spec.y_label && (
          <text x={14} y={m.t + ih / 2} fontSize={12} fill="#5B6366" transform={`rotate(-90 14 ${m.t + ih / 2})`} textAnchor="middle">
            {spec.y_label}
          </text>
        )}
        {spec.categories.map((c, ci) => (
          <text key={c} x={m.l + band * ci + band / 2} y={H - m.b + 20} fontSize={12} fill="#333A3D" textAnchor="middle">
            {c}
          </text>
        ))}

        {spec.kind === "line"
          ? spec.series.map((s, si) => {
              const pts = s.values.map((v, i) => [m.l + band * i + band / 2, y(v)] as const);
              return (
                <g key={s.name}>
                  <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={SERIES[si]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  {pts.map(([px, py], i) => (
                    <circle key={i} cx={px} cy={py} r={4.5} fill={SERIES[si]} stroke="#fff" strokeWidth={2} />
                  ))}
                </g>
              );
            })
          : spec.categories.map((c, ci) => {
              const n = spec.series.length;
              const barW = Math.min(24 * (n === 1 ? 2 : 1.4), (band * 0.7) / n);
              const groupW = barW * n + 2 * (n - 1);
              const x0 = m.l + band * ci + (band - groupW) / 2;
              return (
                <g key={c}>
                  {spec.series.map((s, si) => {
                    const v = s.values[ci];
                    const top = y(Math.max(v, yMin));
                    const h = m.t + ih - top;
                    const x = x0 + si * (barW + 2);
                    const r = Math.min(4, h);
                    return (
                      <Fragment key={s.name}>
                        <path
                          d={`M${x} ${m.t + ih} V${top + r} Q${x} ${top} ${x + r} ${top} H${x + barW - r} Q${x + barW} ${top} ${x + barW} ${top + r} V${m.t + ih} Z`}
                          fill={SERIES[si]}
                        />
                      </Fragment>
                    );
                  })}
                </g>
              );
            })}
      </svg>
      <details className="mt-2 text-xs text-ink-soft">
        <summary className="cursor-pointer select-none">Show as table</summary>
        <DataTable
          spec={{
            columns: ["", ...spec.series.map((s) => s.name)],
            rows: spec.categories.map((c, i) => [c, ...spec.series.map((s) => s.values[i])]),
          }}
          bare
        />
      </details>
    </figure>
  );
}

function chartSummary(spec: ChartSpec): string {
  const parts = spec.series.map((s) => `${s.name}: ${spec.categories.map((c, i) => `${c} ${s.values[i]}`).join(", ")}`);
  return `${spec.title ?? "Chart"}. Axis from ${spec.y_min ?? 0} to ${spec.y_max ?? "auto"}. ${parts.join(". ")}`;
}

export function DataTable({ spec, bare = false }: { spec: TableSpec; bare?: boolean }) {
  return (
    <figure className={bare ? "mt-2" : "overflow-hidden rounded-lg bg-white ring-1 ring-line"}>
      {spec.title && !bare && <figcaption className="border-b border-line px-4 py-2.5 text-sm font-semibold">{spec.title}</figcaption>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="bg-cream/60 text-left">
              {spec.columns.map((c) => (
                <th key={c} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold text-ink">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {spec.rows.map((r, i) => (
              <tr key={i} className="border-t border-line/70">
                {r.map((cell, j) => (
                  <td key={j} className={`whitespace-nowrap px-3 py-2 ${j === 0 ? "font-medium" : "text-ink-soft"}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {spec.note && !bare && <p className="border-t border-line px-4 py-2 text-xs text-ink-mute">{spec.note}</p>}
    </figure>
  );
}
