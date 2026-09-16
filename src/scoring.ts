import { match, normalize } from "./matcher.js";
import type { Job } from "./job.js";
import { JUNIOR_LEVEL, NODE_CORE, TYPESCRIPT, BACKEND_TERMS } from "./config.js";

export interface ScoreResult {
  score: number;
  reasons: string[];
}

const BASE_SCORE = 4;
const JUNIOR_WEIGHT = 2;
const NODE_WEIGHT = 2;
const TYPESCRIPT_WEIGHT = 1;
const BACKEND_WEIGHT = 1;
const LOCATION_WEIGHT = 1;
const UNKNOWN_LOCATION_PENALTY = 1;
const MIN_SCORE = 1;
const MAX_SCORE = 10;

function pad(text: string): string {
  return ` ${text.split(/\s+/).join(" ")} `;
}

function contains(text: string, phrases: string[]): string[] {
  const haystack = pad(normalize(text));
  return phrases.filter((phrase) => haystack.includes(pad(phrase)));
}

function hasSignal(signals: string[], phrases: string[]): boolean {
  return signals.some((signal) => phrases.includes(signal));
}

export function scoreJob(job: Job): ScoreResult {
  const verdict = match(job);
  const reasons: string[] = [];
  let score = BASE_SCORE;

  const junior = contains(`${job.title} ${job.description}`, JUNIOR_LEVEL);
  if (junior.length > 0) {
    score += JUNIOR_WEIGHT;
    reasons.push("junior");
  }

  if (hasSignal(verdict.signals, NODE_CORE)) {
    score += NODE_WEIGHT;
    reasons.push("node");
  }

  if (hasSignal(verdict.signals, TYPESCRIPT)) {
    score += TYPESCRIPT_WEIGHT;
    reasons.push("typescript");
  }

  if (hasSignal(verdict.signals, BACKEND_TERMS)) {
    score += BACKEND_WEIGHT;
    reasons.push("backend");
  }

  if (verdict.locationConfidence === "remote") {
    score += LOCATION_WEIGHT;
    reasons.push("remoto");
  } else if (verdict.locationConfidence === "local") {
    score += LOCATION_WEIGHT;
    reasons.push("local");
  } else {
    score -= UNKNOWN_LOCATION_PENALTY;
  }

  score = Math.min(MAX_SCORE, Math.max(MIN_SCORE, score));
  return { score, reasons };
}
