import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DigestItem, DigestState } from "../src/digest.js";

const tmpDir = mkdtempSync(join(tmpdir(), "digest-test-"));
process.env.DIGEST_DB_PATH = join(tmpDir, "digest.json");

const digest = await import("../src/digest.js");

function item(partial: Partial<DigestItem>): DigestItem {
  return {
    key: "k",
    title: "",
    company: "",
    location: "",
    url: "",
    score: 1,
    source: "test",
    queuedAt: "2024-01-01T00:00:00.000Z",
    ...partial,
  };
}

test("enqueueDigest dedup por key", () => {
  const state: DigestState = { lastSentAt: null, queue: [] };
  digest.enqueueDigest(state, item({ key: "a", title: "Vaga A" }));
  digest.enqueueDigest(state, item({ key: "a", title: "Vaga A duplicada" }));
  assert.equal(state.queue.length, 1);
});

test("buildDigestText ordena por score desc e inclui dados", () => {
  const state: DigestState = {
    lastSentAt: null,
    queue: [
      item({
        key: "1",
        title: "Vaga Baixa",
        company: "Empresa B",
        url: "https://b.example.com/vaga",
        score: 3,
        queuedAt: "2024-01-01T10:00:00.000Z",
      }),
      item({
        key: "2",
        title: "Vaga Alta",
        company: "Empresa A",
        url: "https://a.example.com/vaga",
        score: 8,
        queuedAt: "2024-01-01T09:00:00.000Z",
      }),
    ],
  };

  const text = digest.buildDigestText(state);
  assert.ok(text.indexOf("Vaga Alta") < text.indexOf("Vaga Baixa"));
  assert.ok(text.includes("Empresa A"));
  assert.ok(text.includes("https://a.example.com/vaga"));
});

test("isDigestDue true quando lastSentAt null", () => {
  const state: DigestState = { lastSentAt: null, queue: [] };
  assert.equal(digest.isDigestDue(state, new Date(2024, 0, 1, 10, 0, 0)), true);
});

test("isDigestDue false no mesmo dia", () => {
  const now = new Date(2024, 0, 2, 14, 0, 0);
  const state: DigestState = {
    lastSentAt: new Date(2024, 0, 2, 8, 0, 0).toISOString(),
    queue: [],
  };
  assert.equal(digest.isDigestDue(state, now), false);
});

test("isDigestDue true em dia anterior", () => {
  const now = new Date(2024, 0, 3, 0, 30, 0);
  const state: DigestState = {
    lastSentAt: new Date(2024, 0, 2, 23, 59, 0).toISOString(),
    queue: [],
  };
  assert.equal(digest.isDigestDue(state, now), true);
});
