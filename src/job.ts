export interface Job {
  source: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  publishedAt?: string;
}

export type LocationConfidence = "remote" | "local" | "unknown";

export interface MatchResult {
  ok: boolean;
  reason?: string;
  signals: string[];
  locationConfidence: LocationConfidence;
}
