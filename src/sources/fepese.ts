import type { Job } from "../job.js";

const API_BASE = "https://fepese.org.br/wp-json/wp/v2/vaga";
const PER_PAGE = 100;

interface VagaTitle {
  rendered?: string;
}

interface VagaContent {
  rendered?: string;
}

interface VagaAcf {
  cidade?: string | null;
  img_url?: string | null;
}

interface VagaItem {
  date?: string;
  link?: string;
  title?: VagaTitle;
  content?: VagaContent;
  acf?: VagaAcf;
}

function headers(): Record<string, string> {
  return {
    accept: "application/json",
    "user-agent": "job-search",
  };
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  aacute: "á",
  agrave: "à",
  acirc: "â",
  atilde: "ã",
  auml: "ä",
  aring: "å",
  eacute: "é",
  egrave: "è",
  ecirc: "ê",
  euml: "ë",
  iacute: "í",
  igrave: "ì",
  icirc: "î",
  iuml: "ï",
  oacute: "ó",
  ograve: "ò",
  ocirc: "ô",
  otilde: "õ",
  ouml: "ö",
  uacute: "ú",
  ugrave: "ù",
  ucirc: "û",
  uuml: "ü",
  ccedil: "ç",
  ntilde: "ñ",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&[a-z]+;/gi, (match) => NAMED_ENTITIES[match.slice(1, -1).toLowerCase()] ?? match);
}

function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export function parseVagaItem(item: VagaItem): Job | null {
  const title = stripHtml(item.title?.rendered ?? "");
  const link = item.link?.trim();

  if (!title || !link) return null;

  return {
    source: "fepese",
    title,
    company: "FEPESE",
    location: (item.acf?.cidade ?? "").trim(),
    url: link,
    description: stripHtml(item.content?.rendered ?? ""),
    publishedAt: item.date,
  };
}

function buildUrl(page: number): string {
  return `${API_BASE}?per_page=${PER_PAGE}&page=${page}&orderby=date&order=desc`;
}

async function fetchPage(page: number): Promise<VagaItem[]> {
  const response = await fetch(buildUrl(page), { headers: headers() });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return (await response.json()) as VagaItem[];
}

export async function fetchFepeseJobs(): Promise<Job[]> {
  const jobs: Job[] = [];
  const failures: string[] = [];

  let totalPages = 1;
  try {
    const response = await fetch(buildUrl(1), { headers: headers() });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const totalHeader = response.headers.get("x-wp-totalpages");
    const parsed = Number.parseInt(totalHeader ?? "", 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      totalPages = parsed;
    }
    const items = (await response.json()) as VagaItem[];
    for (const item of items) {
      const job = parseVagaItem(item);
      if (job) jobs.push(job);
    }
  } catch (error) {
    throw new Error(`listagem de vagas: ${String(error)}`);
  }

  for (let page = 2; page <= totalPages; page++) {
    try {
      const items = await fetchPage(page);
      for (const item of items) {
        const job = parseVagaItem(item);
        if (job) jobs.push(job);
      }
    } catch (error) {
      failures.push(`página ${page}: ${String(error)}`);
    }
  }

  for (const failure of failures) {
    console.warn(`[fepese] página com falha: ${failure}`);
  }

  return jobs;
}
