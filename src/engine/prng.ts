// Deterministic randomness. Everything that must be reproducible (a candidate's
// paper, the Mela Market demand noise, Stroop trial order) derives from a
// string seed through these helpers — never from Math.random().

/** FNV-1a 32-bit hash of a string. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: tiny, fast, good-enough PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A PRNG derived from one or more string parts, e.g. rng(seed, "pool", poolId). */
export function rng(...parts: (string | number)[]): () => number {
  return mulberry32(hashString(parts.join("::")));
}

/** Fisher–Yates shuffle using the supplied PRNG. Returns a new array. */
export function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Uniform float in [min, max). */
export function between(rand: () => number, min: number, max: number): number {
  return min + (max - min) * rand();
}
