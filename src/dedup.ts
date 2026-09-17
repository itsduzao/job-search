import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { normalize } from "./matcher.js";
import type { Job } from "./job.js";

export interface State {
  seen: Record<string, { firstSeen: string; notifiedAt: string }>;
}

const DB_PATH = process.env.JOBS_DB_PATH ?? "data/jobs.json";

export function loadState(): State {
  if (existsSync(DB_PATH)) {
    return JSON.parse(readFileSync(DB_PATH, "utf-8")) as State;
  }
  return { seen: {} };
}

export function saveState(state: State): void {
  writeFileSync(DB_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

function canonicalUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

export function dedupKey(job: Job): string {
  const base = job.url ? canonicalUrl(job.url) : `${job.company}|${job.title}`;
  return normalize(base);
}

export function isNew(state: State, key: string): boolean {
  return !(key in state.seen);
}

export function markNotified(state: State, key: string): void {
  const now = new Date().toISOString();
  state.seen[key] = { firstSeen: now, notifiedAt: now };
}
