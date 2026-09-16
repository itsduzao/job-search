import type { Job } from "../job.js";

const API_BASE = "https://candidate-api.eureca.me";
const PAGE_SIZE = 50;

interface ProgramListItem {
  id?: string;
  name?: string;
  companyName?: string;
  publishedAt?: string | null;
}

interface ProgramListResponse {
  items?: ProgramListItem[];
  total?: number;
}

interface ProgramJob {
  name?: string;
  cityName?: string | null;
  stateAcronym?: string | null;
}

interface ProgramDetail {
  id?: string;
  name?: string;
  description?: string | null;
  publishedAt?: string | null;
  company?: { name?: string } | null;
  workCondition?: { workFormat?: { name?: string } | null } | null;
  jobs?: ProgramJob[] | null;
}

function headers(): Record<string, string> {
  return {
    accept: "application/json",
    "user-agent": "job-search",
  };
}

function decodeEntities(text: string): string {
  const named: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
    "&nbsp;": " ",
  };
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&[a-z]+;/gi, (match) => named[match.toLowerCase()] ?? match);
}

function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function buildLocation(program: ProgramDetail): string {
  const workFormat = program.workCondition?.workFormat?.name;
  const cities = new Set<string>();
  for (const job of program.jobs ?? []) {
    const city = job.cityName?.trim();
    if (!city) continue;
    cities.add(job.stateAcronym ? `${city}, ${job.stateAcronym}` : city);
  }
  const parts: string[] = [];
  if (workFormat) parts.push(workFormat);
  if (cities.size > 0) parts.push([...cities].join(" / "));
  return parts.join(" — ");
}

function toJob(program: ProgramDetail, item?: ProgramListItem): Job | null {
  if (!program.id || !program.name) return null;
  return {
    source: "eureca",
    title: program.name,
    company: program.company?.name ?? item?.companyName ?? "",
    location: buildLocation(program),
    url: `https://app.eureca.me/programas/${program.id}`,
    description: stripHtml(program.description ?? ""),
    publishedAt: program.publishedAt ?? item?.publishedAt ?? undefined,
  };
}

async function fetchList(page: number): Promise<ProgramListResponse> {
  const url = `${API_BASE}/programs?page=${page}&pageSize=${PAGE_SIZE}`;
  const response = await fetch(url, { headers: headers() });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as ProgramListResponse;
}

async function fetchDetail(id: string): Promise<ProgramDetail> {
  const url = `${API_BASE}/programs/${id}`;
  const response = await fetch(url, { headers: headers() });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as ProgramDetail;
}

export async function fetchEurecaJobs(): Promise<Job[]> {
  const jobs: Job[] = [];
  const failures: string[] = [];

  const items: ProgramListItem[] = [];
  let total = 0;
  try {
    const first = await fetchList(1);
    items.push(...(first.items ?? []));
    total = typeof first.total === "number" ? first.total : items.length;
    let page = 2;
    while (items.length < total) {
      const next = await fetchList(page);
      if (!next.items || next.items.length === 0) break;
      items.push(...next.items);
      page += 1;
    }
  } catch (error) {
    throw new Error(`listagem de programas: ${String(error)}`);
  }

  for (const item of items) {
    const id = item.id;
    if (!id) {
      failures.push("programa sem id");
      continue;
    }
    try {
      const detail = await fetchDetail(id);
      const job = toJob(detail, item);
      if (job) {
        jobs.push(job);
      } else {
        failures.push(`${id}: programa sem nome`);
      }
    } catch (error) {
      failures.push(`${id}: ${String(error)}`);
    }
  }

  if (items.length > 0 && failures.length === items.length) {
    throw new Error(failures.join(" | "));
  }

  for (const failure of failures) {
    console.warn(`[eureca] programa com falha: ${failure}`);
  }

  return jobs;
}
