import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalize } from "../src/matcher.js";
import type { Job } from "../src/job.js";

const tmpDir = mkdtempSync(join(tmpdir(), "dedup-test-"));
process.env.JOBS_DB_PATH = join(tmpDir, "jobs.json");

const dedup = await import("../src/dedup.js");

function job(partial: Partial<Job>): Job {
  return {
    source: "test",
    title: "",
    company: "",
    location: "",
    url: "",
    description: "",
    ...partial,
  };
}

test("dedupKey usa url normalizada quando presente", () => {
  const url = "https://github.com/backend-br/vagas/issues/123";
  assert.equal(dedup.dedupKey(job({ url })), normalize(url));
});

test("dedupKey cai para company|title quando url vazia", () => {
  const j = job({ company: "Acme", title: "Dev Node Júnior", url: "" });
  assert.equal(dedup.dedupKey(j), normalize(`${j.company}|${j.title}`));
});

test("mesma url nao e nova duas vezes", () => {
  const state = dedup.loadState();
  const key = dedup.dedupKey(job({ url: "https://example.com/vaga/1" }));
  assert.equal(dedup.isNew(state, key), true);
  dedup.markNotified(state, key);
  assert.equal(dedup.isNew(state, key), false);
});

test("saveState/loadState persistem chaves no JOBS_DB_PATH temporario", () => {
  const state = dedup.loadState();
  const key = dedup.dedupKey(job({ url: "https://example.com/vaga/2" }));
  dedup.markNotified(state, key);
  dedup.saveState(state);

  assert.equal(existsSync(process.env.JOBS_DB_PATH as string), true);
  assert.match(readFileSync(process.env.JOBS_DB_PATH as string, "utf-8"), new RegExp(key));

  const reloaded = dedup.loadState();
  assert.equal(reloaded.seen[key] !== undefined, true);
});
