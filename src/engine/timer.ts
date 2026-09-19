// Section timing. The clock is derived from a stored start timestamp, never
// from a ticking counter, so a refresh, crash or dropped connection resumes
// with the right time left. (In production the start time is stamped by the
// server; here it is stamped on first entry and persisted with the attempt.)

export interface SectionClock {
  startedAt: number | null;
  closedAt: number | null;
  /** Accommodation / admin-granted extra time. */
  extraMs: number;
}

export const WARNING_THRESHOLDS_MS = [5 * 60_000, 60_000] as const;

export function durationMs(durationMin: number | null, extraMs = 0): number | null {
  return durationMin == null ? null : durationMin * 60_000 + extraMs;
}

/** Remaining ms (never negative), or null for untimed sections. */
export function remainingMs(
  clock: SectionClock,
  durationMin: number | null,
  now: number,
): number | null {
  const total = durationMs(durationMin, clock.extraMs);
  if (total == null) return null;
  if (clock.startedAt == null) return total;
  const end = clock.closedAt ?? now;
  return Math.max(0, total - (end - clock.startedAt));
}

export function isExpired(clock: SectionClock, durationMin: number | null, now: number): boolean {
  const r = remainingMs(clock, durationMin, now);
  return r != null && r <= 0;
}

/** Thresholds crossed while going from `before` to `after` remaining ms. */
export function crossedWarnings(
  before: number | null,
  after: number | null,
  thresholds: readonly number[] = WARNING_THRESHOLDS_MS,
): number[] {
  if (before == null || after == null) return [];
  return thresholds.filter((t) => before > t && after <= t);
}

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
