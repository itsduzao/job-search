import { loadState, saveState, isNew, markNotified, dedupKey } from "./dedup.js";
import { match } from "./matcher.js";
import { fetchGithubJobs } from "./sources/github-lists.js";
import { fetchEurecaJobs } from "./sources/eureca.js";
import { sendMessage } from "./notifier/telegram.js";
import type { Job } from "./job.js";

interface Source {
  name: string;
  fetch: () => Promise<Job[]>;
}

const SOURCES: Source[] = [
  { name: "github", fetch: fetchGithubJobs },
  { name: "eureca", fetch: fetchEurecaJobs },
];

function formatJob(job: Job): string {
  const location = job.location || "local nao informado";
  return `${job.title}\n${job.company} · ${location}\n${job.url}`;
}

async function main(): Promise<void> {
  const state = loadState();
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const results = await Promise.allSettled(SOURCES.map((source) => source.fetch()));

  const failures: string[] = [];
  const allJobs: Job[] = [];

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      failures.push(`${SOURCES[index]!.name}: ${String(result.reason)}`);
    } else {
      allJobs.push(...result.value);
    }
  });

  let accepted = 0;
  let notified = 0;

  for (const job of allJobs) {
    const verdict = match(job);
    if (!verdict.ok) continue;

    accepted++;
    const key = dedupKey(job);
    if (!isNew(state, key)) continue;

    if (!token || !chatId) {
      console.log("[dry-run]", formatJob(job));
      continue;
    }

    await sendMessage(token, chatId, formatJob(job));
    markNotified(state, key);
    notified++;
  }

  saveState(state);

  if (failures.length === SOURCES.length && SOURCES.length > 0 && token && chatId) {
    await sendMessage(
      token,
      chatId,
      `⚠️ Radar: todas as fontes falharam\n${failures.join("\n")}`,
    );
  }

  console.log(
    JSON.stringify({
      fetched: allJobs.length,
      accepted,
      notified,
      failures,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
