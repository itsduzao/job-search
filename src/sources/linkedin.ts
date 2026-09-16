import type { Job } from "../job.js";

const GUEST_ENDPOINT =
  "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search";
const PAGE_SIZE = 25;

const KEYWORDS = (process.env.LINKEDIN_KEYWORDS ?? "desenvolvedor")
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);
const LOCATION = process.env.LINKEDIN_LOCATION ?? "Brasil";
const MAX_PAGES = Math.max(
  1,
  Number.parseInt(process.env.LINKEDIN_MAX_PAGES ?? "3", 10) || 3,
);
const TIMEOUT_MS = Number(process.env.LINKEDIN_TIMEOUT_MS ?? "10000") || 10000;

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const DELAY_MS = 2000;
const MAX_RETRIES = 3;
const DEFAULT_RETRY_AFTER_MS = 30_000;

const TITLE_RE = /<h3[^>]*class="[^"]*base-search-card__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i;
const TITLE_FALLBACK_RE = /<h3[^>]*>([\s\S]*?)<\/h3>/i;
const SUBTITLE_RE = /<h4[^>]*class="[^"]*base-search-card__subtitle[^"]*"[^>]*>([\s\S]*?)<\/h4>/i;
const NESTED_LINK_RE = /<a[^>]*class="[^"]*hidden-nested-link[^"]*"[^>]*>([\s\S]*?)<\/a>/i;
const LOCATION_RE = /<span[^>]*class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\/span>/i;
const FULL_LINK_RE = /<a\b[^>]*class="[^"]*base-card__full-link[^"]*"[^>]*>/i;
const HREF_RE = /href="([^"]*)"/i;

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

function extractText(html: string, re: RegExp): string | undefined {
  const match = re.exec(html);
  if (!match || match[1] == null) return undefined;
  const text = stripHtml(match[1]);
  return text.length > 0 ? text : undefined;
}

function extractFullLink(html: string): string | undefined {
  const tag = FULL_LINK_RE.exec(html);
  if (!tag) return undefined;
  const href = HREF_RE.exec(tag[0]);
  if (!href) return undefined;
  const url = decodeEntities(href[1]?.trim() ?? "");
  return url.length > 0 ? url : undefined;
}

function parseCard(html: string): Job | null {
  const url = extractFullLink(html);
  const title = extractText(html, TITLE_RE) ?? extractText(html, TITLE_FALLBACK_RE);
  const company = extractText(html, SUBTITLE_RE) ?? extractText(html, NESTED_LINK_RE);
  const location = extractText(html, LOCATION_RE);

  if (!url || !title) return null;

  return {
    source: "linkedin",
    title,
    company: company ?? "",
    location: location ?? "",
    url,
    description: "",
    publishedAt: undefined,
  };
}

export function parseLinkedInHtml(html: string): Job[] {
  const jobs: Job[] = [];
  const cards = html.split(/<li\b/i).slice(1);
  for (const card of cards) {
    const job = parseCard(card);
    if (job) jobs.push(job);
  }
  return jobs;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  return null;
}

async function fetchHtml(url: string): Promise<string> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": USER_AGENT,
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
        },
        signal: controller.signal,
      });

      if (response.status === 429) {
        const retryAfter = parseRetryAfter(response.headers.get("retry-after"));
        lastError = new Error(`HTTP 429 (retry-after ${response.headers.get("retry-after") ?? "n/a"})`);
        await sleep(retryAfter ?? DEFAULT_RETRY_AFTER_MS);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        await sleep(1000 * 2 ** attempt);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error(String(lastError));
}

export async function fetchLinkedinJobs(): Promise<Job[]> {
  const jobs: Job[] = [];
  const failures: string[] = [];

  for (const keyword of KEYWORDS) {
    let keywordJobs = 0;

    for (let page = 0; page < MAX_PAGES; page++) {
      const start = page * PAGE_SIZE;
      const url = `${GUEST_ENDPOINT}?keywords=${encodeURIComponent(keyword)}&location=${encodeURIComponent(LOCATION)}&start=${start}`;

      try {
        const html = await fetchHtml(url);
        const parsed = parseLinkedInHtml(html);
        keywordJobs += parsed.length;
        jobs.push(...parsed);
        if (parsed.length === 0) break;
      } catch (error) {
        failures.push(`${keyword} (start=${start}): ${String(error)}`);
        break;
      }

      await sleep(DELAY_MS);
    }

    if (keywordJobs === 0) {
      failures.push(`${keyword}: nenhum resultado`);
    }
  }

  if (jobs.length === 0) {
    throw new Error(failures.join(" | "));
  }

  for (const failure of failures) {
    console.warn(`[linkedin] consulta com falha: ${failure}`);
  }

  return jobs;
}
