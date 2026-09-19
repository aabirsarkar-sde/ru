"use client";
// Candidate attempt state, persisted in IndexedDB on every change and on a
// 10-second heartbeat (PRD §6.3). Because section clocks are stored as start
// timestamps, closing the tab, a crash or a dropped connection all resume
// with the correct time left.
//
// v1 demo: persistence is local to the device. The production swap is to
// replay the same `update` calls to a server-authoritative API, with this
// store acting as the offline queue.
import { del, get, set } from "idb-keyval";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Program } from "@/content/schema";
import { newCandidateSeed } from "@/engine/paper";
import type { Response } from "@/engine/responses";
import type { SectionClock } from "@/engine/timer";

export interface SectionState extends SectionClock {
  status: "pending" | "active" | "closed";
  skipped?: boolean;
  closedBy?: "candidate" | "timer";
}

export interface ActivityEvent {
  t: number;
  type: "paste_blocked" | "tab_hidden" | "tab_visible" | "offline" | "online" | "resume" | "fullscreen_exit";
  itemId?: string;
}

export interface Attempt {
  v: 1;
  programId: string;
  candidateName: string;
  candidateId: string;
  seed: string;
  createdAt: number;
  consentAt: number;
  /** Accommodation: extra time as a fraction of each timed section (0.25 = +25%). */
  extraPct: number;
  sectionIndex: number;
  sections: Record<string, SectionState>;
  itemIndex: Record<string, number>;
  responses: Record<string, Response>;
  events: ActivityEvent[];
  resumes: number;
  submittedAt: number | null;
  /** Evaluator-preview ratings: itemId → criterionId → score. */
  ratings: Record<string, Record<string, number>>;
  flags: Record<string, string>;
  /** Rough work per section — never marked. */
  scratch?: Record<string, string>;
  /** Post-test experience survey (PRD §12: ≥70% rate 4/5 or higher). */
  survey?: { rating: number; comment: string; at: number };
}

const key = (programId: string) => `ru:attempt:${programId}`;

export function createAttempt(program: Program, name: string, extraPct: number): Attempt {
  const candidateId = `C-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const now = Date.now();
  return {
    v: 1,
    programId: program.id,
    candidateName: name.trim(),
    candidateId,
    seed: newCandidateSeed(candidateId, now),
    createdAt: now,
    consentAt: now,
    extraPct,
    sectionIndex: 0,
    sections: Object.fromEntries(
      program.sections.map((s) => [
        s.id,
        {
          status: "pending",
          startedAt: null,
          closedAt: null,
          extraMs: s.duration_min ? Math.round(s.duration_min * 60_000 * extraPct) : 0,
        } satisfies SectionState,
      ]),
    ),
    itemIndex: {},
    responses: {},
    events: [],
    resumes: 0,
    submittedAt: null,
    ratings: {},
    flags: {},
  };
}

export async function saveAttempt(a: Attempt) {
  await set(key(a.programId), a);
}

export async function loadAttempt(programId: string): Promise<Attempt | null> {
  try {
    return ((await get(key(programId))) as Attempt | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function clearAttempt(programId: string) {
  await del(key(programId));
}

export type SaveStatus = { state: "idle" | "saving" | "saved" | "offline" | "error"; at: number | null };

export function useAttempt(programId: string) {
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [save, setSave] = useState<SaveStatus>({ state: "idle", at: null });
  const latest = useRef<Attempt | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    let alive = true;
    loadAttempt(programId).then((a) => {
      if (!alive) return;
      latest.current = a;
      setAttempt(a);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [programId]);

  const flush = useCallback(async () => {
    const a = latest.current;
    if (!a) return;
    setSave((s) => ({ ...s, state: "saving" }));
    try {
      await saveAttempt(a);
      dirty.current = false;
      setSave({ state: navigator.onLine ? "saved" : "offline", at: Date.now() });
    } catch {
      setSave((s) => ({ ...s, state: "error" }));
    }
  }, []);

  const update = useCallback(
    (fn: (a: Attempt) => Attempt) => {
      const cur = latest.current;
      if (!cur) return;
      const next = fn(cur);
      latest.current = next;
      dirty.current = true;
      setAttempt(next);
    },
    [],
  );

  // Save shortly after every change…
  useEffect(() => {
    if (!attempt || !dirty.current) return;
    const id = setTimeout(flush, 350);
    return () => clearTimeout(id);
  }, [attempt, flush]);

  // …and on a 10-second heartbeat, and when the page is hidden or closed.
  useEffect(() => {
    const id = setInterval(flush, 10_000);
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(id);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [flush]);

  return { attempt, loaded, update, save, flush, setAttempt: (a: Attempt | null) => ((latest.current = a), setAttempt(a)) };
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function useOnline() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("online", cb);
      window.addEventListener("offline", cb);
      return () => {
        window.removeEventListener("online", cb);
        window.removeEventListener("offline", cb);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

export function logEvent(a: Attempt, e: Omit<ActivityEvent, "t">): Attempt {
  return { ...a, events: [...a.events, { ...e, t: Date.now() }].slice(-500) };
}
