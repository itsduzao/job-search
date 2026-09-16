import { existsSync, readFileSync, writeFileSync } from "node:fs";

export interface Vote {
  source: string;
  vote: "like" | "dislike";
  at: string;
}

export interface FeedbackState {
  offset: number;
  votes: Vote[];
}

export interface PrecisionResult {
  like: number;
  dislike: number;
  total: number;
  precision: number;
}

const DB_PATH = process.env.FEEDBACK_DB_PATH ?? "data/feedback.json";

interface CallbackQuery {
  data?: string;
}

interface Update {
  update_id: number;
  callback_query?: CallbackQuery;
}

interface GetUpdatesResponse {
  result?: Update[];
}

export function loadFeedback(): FeedbackState {
  if (existsSync(DB_PATH)) {
    return JSON.parse(readFileSync(DB_PATH, "utf-8")) as FeedbackState;
  }
  return { offset: 0, votes: [] };
}

export function saveFeedback(state: FeedbackState): void {
  writeFileSync(DB_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

export function sourcePrecision(votes: Vote[], source?: string): PrecisionResult {
  const filtered = source ? votes.filter((vote) => vote.source === source) : votes;
  const like = filtered.filter((vote) => vote.vote === "like").length;
  const dislike = filtered.filter((vote) => vote.vote === "dislike").length;
  const total = like + dislike;
  const precision = total === 0 ? 0 : like / total;
  return { like, dislike, total, precision };
}

export async function collectFeedback(token: string): Promise<{ collected: number }> {
  const state = loadFeedback();
  const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${state.offset + 1}&timeout=0`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Telegram getUpdates ${response.status}: ${await response.text()}`);
  }

  const payload = (await response.json()) as GetUpdatesResponse;
  let collected = 0;
  let maxOffset = state.offset;

  for (const update of payload.result ?? []) {
    if (update.update_id > maxOffset) {
      maxOffset = update.update_id;
    }

    const callback = update.callback_query;
    if (!callback?.data) continue;

    const [vote, source] = callback.data.split("|");
    if ((vote === "like" || vote === "dislike") && source) {
      state.votes.push({ source, vote, at: new Date().toISOString() });
      collected++;
    }
  }

  state.offset = maxOffset;
  saveFeedback(state);

  return { collected };
}
