import type { Job } from "../job.js";

const REPOS = (process.env.GH_VAGAS_REPOS ?? "backend-br/vagas").split(",");

interface Issue {
  title: string;
  html_url: string;
  body: string | null;
  created_at: string;
  pull_request?: unknown;
}

function githubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "job-search",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

export async function fetchGithubJobs(): Promise<Job[]> {
  const jobs: Job[] = [];
  const failures: string[] = [];

  for (const repo of REPOS) {
    const url = `https://api.github.com/repos/${repo}/issues?state=open&per_page=100`;
    try {
      const response = await fetch(url, { headers: githubHeaders() });
      if (!response.ok) {
        failures.push(`${repo}: ${response.status}`);
        continue;
      }
      const issues = (await response.json()) as Issue[];

      for (const issue of issues) {
        if (issue.pull_request) continue;
        jobs.push({
          source: "github",
          title: issue.title,
          company: repo.split("/")[0] ?? repo,
          location: "",
          url: issue.html_url,
          description: issue.body ?? "",
          publishedAt: issue.created_at,
        });
      }
    } catch (error) {
      failures.push(`${repo}: ${String(error)}`);
    }
  }

  if (failures.length === REPOS.length) {
    throw new Error(failures.join(" | "));
  }

  for (const failure of failures) {
    console.warn(`[github] repo com falha: ${failure}`);
  }

  return jobs;
}
