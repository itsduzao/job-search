import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { sendMessage } from "./notifier/telegram.js";

export interface DigestItem {
  key: string;
  title: string;
  company: string;
  location: string;
  url: string;
  score: number;
  source: string;
  queuedAt: string;
}

export interface DigestState {
  lastSentAt: string | null;
  queue: DigestItem[];
}

const DB_PATH = process.env.DIGEST_DB_PATH ?? "data/digest.json";

export function loadDigest(): DigestState {
  if (existsSync(DB_PATH)) {
    return JSON.parse(readFileSync(DB_PATH, "utf-8")) as DigestState;
  }
  return { lastSentAt: null, queue: [] };
}

export function saveDigest(state: DigestState): void {
  writeFileSync(DB_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

export function enqueueDigest(state: DigestState, item: DigestItem): void {
  if (state.queue.some((existing) => existing.key === item.key)) return;
  state.queue.push(item);
}

export function isDigestDue(state: DigestState, now: Date = new Date()): boolean {
  if (state.lastSentAt === null) return true;
  const last = new Date(state.lastSentAt);
  return (
    last.getFullYear() !== now.getFullYear() ||
    last.getMonth() !== now.getMonth() ||
    last.getDate() !== now.getDate()
  );
}

function formatDigestItem(item: DigestItem): string {
  const location = item.location || "local nao informado";
  return `\n\n[relevância ${item.score}/10]\n${item.title}\n${item.company} · ${location}\n${item.url}`;
}

export function buildDigestText(state: DigestState): string {
  const sorted = [...state.queue].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.queuedAt.localeCompare(a.queuedAt);
  });

  const MAX_ITEMS = 20;
  const MAX_CHARS = 4096;
  const SUFFIX_RESERVE = 32;
  const header = "📬 Resumo diário de vagas";

  let text = header;
  let included = 0;

  for (const item of sorted) {
    if (included >= MAX_ITEMS) break;
    const block = formatDigestItem(item);
    if (text.length + block.length + SUFFIX_RESERVE > MAX_CHARS) break;
    text += block;
    included++;
  }

  const remaining = sorted.length - included;
  if (remaining > 0) {
    text += `\n+ ${remaining} outras…`;
  }

  return text.slice(0, MAX_CHARS);
}

export async function sendDigestIfDue(
  token: string | undefined,
  chatId: string | undefined,
  now: Date = new Date(),
): Promise<{ sent: number }> {
  const state = loadDigest();
  if (state.queue.length === 0) return { sent: 0 };
  if (!token || !chatId) return { sent: 0 };
  if (!isDigestDue(state, now)) return { sent: 0 };

  const queueLength = state.queue.length;
  await sendMessage(token, chatId, buildDigestText(state));
  state.lastSentAt = now.toISOString();
  state.queue = [];
  saveDigest(state);

  return { sent: queueLength };
}
