import { loadState, saveState, isNew, markNotified, dedupKey } from "./dedup.js";
import { match } from "./matcher.js";
import { scoreJob } from "./scoring.js";
import { fetchGithubJobs } from "./sources/github-lists.js";
import { fetchEurecaJobs } from "./sources/eureca.js";
import { fetchLinkedinJobs } from "./sources/linkedin.js";
import { sendMessage, voteKeyboard } from "./notifier/telegram.js";
import { collectFeedback, loadFeedback, sourcePrecision } from "./feedback.js";
import type { Job } from "./job.js";

interface Source {
  name: string;
  fetch: () => Promise<Job[]>;
}

const SOURCES: Source[] = [
  { name: "github", fetch: fetchGithubJobs },
  { name: "eureca", fetch: fetchEurecaJobs },
  { name: "linkedin", fetch: fetchLinkedinJobs },
];

function formatJob(job: Job): string {
  const { score } = scoreJob(job);
  const location = job.location || "local nao informado";
  return `[relevância ${score}/10]\n${job.title}\n${job.company} · ${location}\n${job.url}`;
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

    await sendMessage(token, chatId, formatJob(job), voteKeyboard(job.source));
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

  let feedback: unknown = null;
  if (token) {
    try {
      const { collected } = await collectFeedback(token);
      const feedbackState = loadFeedback();
      const precision: Record<string, unknown> = {};
      for (const source of SOURCES) {
        const p = sourcePrecision(feedbackState.votes, source.name);
        precision[source.name] = p;
        console.log(
          `[precision] ${source.name}: ${p.like}/${p.total} (${(p.precision * 100).toFixed(0)}%)`,
        );
      }
      feedback = { collected, precision };
    } catch (error) {
      console.warn(`[feedback] falha ao coletar: ${String(error)}`);
    }
  }

  console.log(
    JSON.stringify({
      fetched: allJobs.length,
      accepted,
      notified,
      failures,
      feedback,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
