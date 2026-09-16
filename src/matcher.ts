import {
  NOISE_TITLES,
  SENIOR_REJECT,
  NODE_CORE,
  BACKEND_TERMS,
  TYPESCRIPT,
  FRONTEND_SIGNALS,
  OTHER_STACK,
  REMOTE,
  ONSITE,
  US_ONLY,
  LOCAL_CITIES,
  OTHER_SAO_JOSE,
} from "./config.js";
import type { Job, MatchResult, LocationConfidence } from "./job.js";

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function pad(text: string): string {
  return ` ${text.split(/\s+/).join(" ")} `;
}

function contains(text: string, phrases: string[]): string[] {
  const haystack = pad(normalize(text));
  return phrases.filter((phrase) => haystack.includes(pad(phrase)));
}

function levelOk(job: Job): { ok: boolean; reason?: string } {
  const text = `${job.title} ${job.description}`;
  const senior = contains(text, SENIOR_REJECT);
  if (senior.length > 0) {
    return { ok: false, reason: `nivel: ${senior.join(", ")}` };
  }
  return { ok: true };
}

function stackOk(job: Job): {
  ok: boolean;
  reason?: string;
  signals: string[];
} {
  const text = `${job.title} ${job.description}`;
  const node = contains(text, NODE_CORE);
  const backend = contains(text, BACKEND_TERMS);
  const typescript = contains(text, TYPESCRIPT);
  const frontend = contains(text, FRONTEND_SIGNALS);
  const other = contains(text, OTHER_STACK);

  if (other.length > 0 && node.length === 0) {
    return { ok: false, reason: `stack: ${other.join(", ")}`, signals: [] };
  }

  const hasBackendSignal = node.length > 0 || backend.length > 0;
  if (frontend.length > 0 && !hasBackendSignal) {
    return {
      ok: false,
      reason: `frontend puro: ${frontend.join(", ")}`,
      signals: [],
    };
  }

  if (!hasBackendSignal && typescript.length === 0) {
    return { ok: false, reason: "sem sinal de stack node/backend/typescript", signals: [] };
  }

  return { ok: true, signals: [...node, ...backend, ...typescript] };
}

function locationOk(job: Job): {
  ok: boolean;
  reason?: string;
  confidence: LocationConfidence;
} {
  const text = `${job.location} ${job.title} ${job.description}`;
  const remote = contains(text, REMOTE);

  if (remote.length > 0) {
    if (contains(text, US_ONLY).length > 0) {
      return { ok: false, reason: "remoto fora do Brasil", confidence: "remote" };
    }
    return { ok: true, confidence: "remote" };
  }

  for (const [city, phrases] of Object.entries(LOCAL_CITIES)) {
    const hit = contains(text, phrases);
    if (hit.length === 0) continue;
    if (city === "sao jose" && contains(text, OTHER_SAO_JOSE).length > 0) {
      return { ok: false, reason: "cidade homonima fora de SC", confidence: "unknown" };
    }
    return { ok: true, confidence: "local" };
  }

  const onsite = contains(text, ONSITE);
  if (onsite.length > 0) {
    return {
      ok: false,
      reason: "presencial/hibrido fora das cidades-alvo",
      confidence: "unknown",
    };
  }

  return { ok: true, confidence: "unknown" };
}

export function match(job: Job): MatchResult {
  const noise = contains(job.title, NOISE_TITLES);
  if (noise.length > 0) {
    return { ok: false, reason: `nao e vaga: ${noise.join(", ")}`, signals: [], locationConfidence: "unknown" };
  }

  const level = levelOk(job);
  if (!level.ok) {
    return { ok: false, reason: level.reason, signals: [], locationConfidence: "unknown" };
  }

  const stack = stackOk(job);
  if (!stack.ok) {
    return { ok: false, reason: stack.reason, signals: [], locationConfidence: "unknown" };
  }

  const location = locationOk(job);
  return {
    ok: location.ok,
    reason: location.reason,
    signals: stack.signals,
    locationConfidence: location.confidence,
  };
}
