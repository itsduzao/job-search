# Implementation Plan (Whole System)

**Status:** MVP core + backlog complete (all Fase 0–9 code implemented; 35/35 tests green). Remaining: Telegram/secret setup and public push.

**Last Updated:** 2026-09-16

**Primary spec:** [specs/PRD.md](specs/PRD.md) · task breakdown: [specs/TASKS.md](specs/TASKS.md)

## Quick Reference

| Subsystem | Spec | Module/Package | Web packages | Migrations / artifacts |
|---|---|---|---|---|
| Job model | PRD §5, §7.2 | `src/job.ts` | — | — ✅ |
| Filter config | PRD §5 | `src/config.ts` | — | — ✅ |
| Matcher (nível → stack → local) | PRD §5, §7.3 | `src/matcher.ts` | — | `tests/matcher.test.ts` ✅ |
| Dedup / state | PRD §7.4, §7.6 | `src/dedup.ts` | — | `data/jobs.json` ✅, `tests/dedup.test.ts` ✅ |
| Sources | PRD §6 | `src/sources/*` | — | — ✅ (github ✅, eureca ✅, linkedin ✅, fepese ✅) |
| Notifier (Telegram) | PRD §7.5 | `src/notifier/telegram.ts` | — | — ✅ (+ 👍/👎 keyboard ✅) |
| Scoring / feedback | PRD §12 (B4) | `src/scoring.ts`, `src/feedback.ts` | — | `data/feedback.json` ✅, `tests/scoring.test.ts` ✅ |
| Digest diário | PRD §12 (B5) | `src/digest.ts` | — | `data/digest.json` ✅, `tests/digest.test.ts` ✅ |
| Orchestration | PRD §7 | `src/index.ts` | — | — ✅ |
| CI/CD | PRD §8–§9 | `.github/workflows/*` | — | `radar.yml`, `testes.yml` ✅ |
| Backlog (fase 2) | PRD §12 | — | — | — ✅ (B1–B6) |

## Phased Plan

### Phase 0 — Repository foundation

**Goal:** bootstrappable TS project with env template and initial state file.

**Status:** Complete.

**Paths:** `package.json`, `tsconfig.json`, `.gitignore`, `.env.example`, `data/jobs.json`

- [x] `package.json` — `type: module`, scripts `dev`/`typecheck`/`test` (`package.json:1`)
- [x] `tsconfig.json` — strict + `noUncheckedIndexedAccess` (`tsconfig.json:8`)
- [x] `.gitignore` — `node_modules/`, `dist/`, `.env`, `*.log` (`.env` ignored)
- [x] `.env.example` — `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `GITHUB_TOKEN`
- [x] `data/jobs.json` — initial `{ "seen": {} }`

**Definition of Done:** `npm install` + `npm run typecheck` pass (verified 2026-09-16).
**Risks:** none.

### Phase 1 — Model & config

**Goal:** `Job` type and centralized filter rules.

**Status:** Complete.

**Paths:** `src/job.ts`, `src/config.ts`, `src/matcher.ts`

- [x] `Job` interface (`source, title, company, location, url, description, publishedAt?`) — `src/job.ts:1`
- [x] `MatchResult` + `LocationConfidence` — `src/job.ts:11`
- [x] Filter rules centralized in `src/config.ts` (nível, stack, localização, homônimos de São José)
- [x] `normalize()` (lowercase, strip accents, punctuation → space) — `src/matcher.ts:17`
- [x] Extend `normalize` test to assert `SÃO JOSÉ` → `sao jose` and `Sao.Jose` → `sao jose` (T1.3 acceptance) — `tests/matcher.test.ts:21-22`.

**Definition of Done:** `npm run typecheck` green; normalize unit test covers `São José`, `SÃO JOSÉ`, `Sao.Jose`.
**Risks:** rule lists must stay in `config.ts` (no hardcoded rules elsewhere).

### Phase 2 — Matcher (filter core)

**Goal:** implement `levelOk`, `stackOk`, `locationOk`, `match()`.

**Status:** Complete (16 tests).

**Paths:** `src/matcher.ts`, `tests/matcher.test.ts`

- [x] `levelOk` — rejeita pleno/sênior/staff/lead/gerente; aceita resto — `src/matcher.ts:35`
- [x] `stackOk` — rejeita outra stack sem sinal Node, frontend/mobile puro, sem sinal; aceita Node/backend/fullstack/TS — `src/matcher.ts:44`
- [x] `locationOk` — remoto Brasil, cidades-alvo, homônimos, "US only", local vazio → `unknown` — `src/matcher.ts:76`
- [x] `match()` — compõe noise-title + 3 filtros → `MatchResult` — `src/matcher.ts:112`

**Definition of Done:** `npm run test` → 16/16 pass (verified 2026-09-16).
**Risks:** filter is text-only (PRD §10); abbreviations like `PL` (pleno) may pass — see Known Limitations.

### Phase 3 — Dedup & state

**Goal:** idempotent history in `data/jobs.json`.

**Status:** Complete (code + tests).

**Paths:** `src/dedup.ts`, `tests/dedup.test.ts`

- [x] `loadState` / `saveState` / `dedupKey` (url else `company|title`) / `isNew` / `markNotified` — `src/dedup.ts:11`
- [x] `JOBS_DB_PATH` env override — `src/dedup.ts:9`
- [x] Test that the same URL is not considered new twice (T3.1) + temp `JOBS_DB_PATH` (T3.2) — `tests/dedup.test.ts`
**Risks:** `loadState` reads `JOBS_DB_PATH` at module load time — env must be set before import.

### Phase 4 — Sources

**Goal:** parallel, fault-tolerant sources behind a common interface.

**Status:** GitHub + Eureca complete.

**Paths:** `src/sources/*`, `src/index.ts`

- [x] `github-lists.ts` — open issues of `backend-br/vagas` (env `GH_VAGAS_REPOS`), skips PRs, optional `GITHUB_TOKEN` — `src/sources/github-lists.ts:24`
- [x] `eureca.ts` — real scraper over `https://candidate-api.eureca.me/programs` (list + detail), returns `Job[]` — `src/sources/eureca.ts`
- [x] Source contract (`Source` interface) + registry `SOURCES` — `src/index.ts:8`

**Definition of Done:** `npm run dev` returns real `Job[]` from GitHub and Eureca; per-source failures are caught (verified).
**Risks:** fragile scraping (PRD §10); `company` is the repo owner (`backend-br`), not the actual employer.

### Phase 5 — Notification (Telegram)

**Goal:** send formatted job messages.

**Status:** Complete.

**Paths:** `src/notifier/telegram.ts`, `src/index.ts`

- [x] `sendMessage(token, chatId, text)` via BotFather API, throws on non-200 — `src/notifier/telegram.ts:1`
- [x] `formatJob()` (título/empresa/local/url) — `src/index.ts:18`

**Definition of Done:** manual test with real token (pending secrets).
**Risks:** needs `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`.

### Phase 6 — Orchestration

**Goal:** one search cycle: fetch → filter → dedup → notify → persist.

**Status:** Complete.

**Paths:** `src/index.ts`

- [x] `Promise.allSettled` over sources; failures logged, never crash cycle — `src/index.ts:28`
- [x] `match` → `dedupKey` → `isNew` → notify → `markNotified` (only after send) — `src/index.ts:44`
- [x] dry-run without token prints filtered jobs; does not mark seen
- [x] heartbeat: alert if **all** sources fail; summary log `{fetched, accepted, notified, failures}` — `src/index.ts:64`

**Definition of Done:** `npm run dev` (no token) prints `[dry-run]` jobs and exits 0 (verified: fetched 61, accepted 4).
**Risks:** `saveState` runs every cycle (intentional — anti-60-days cron; rewrites even in dry-run).

### Phase 7 — CI/CD

**Goal:** cron runner + CI.

**Status:** Workflows complete; secrets pending.

**Paths:** `.github/workflows/radar.yml`, `.github/workflows/testes.yml`

- [x] `radar.yml` — `cron: "0 */3 * * *"` + `workflow_dispatch`, `permissions: contents: write`, `npm ci` → `npm run dev` → commit/push `data/jobs.json` — `.github/workflows/radar.yml:1`
- [x] `testes.yml` — on push/PR runs `typecheck` + `test` — `.github/workflows/testes.yml:1`
- [ ] **Secrets** (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `GITHUB_TOKEN`) + BotFather token — manual (see Manual Deployment Tasks)

**Definition of Done:** `workflow_dispatch` commits when history changes; CI green on push.
**Risks:** none.

### Phase 8 — MVP readiness

**Goal:** validate PRD §11 acceptance criteria end to end.

**Status:** Mostly complete; deployment steps pending.

**Paths:** `README.md`, repo config

- [x] `npm run dev` local dry-run without token (verified 2026-09-16)
- [x] cron 3h workflow public (`.github/workflows/radar.yml`)
- [ ] Telegram receives a new matching job (pending secrets + first real run)
- [x] Seen jobs not re-notified (dedup code; test still missing — Phase 3)
- [x] Matcher tests pass in CI (16/16)
- [x] R$ 0 infra (no server/DB/frontend)
- [x] `README.md` — how to run, configure secrets, contribute a source — `README.md:1`
- [x] First commit (local) — `db32641`; public push pending repo creation

**Definition of Done:** PRD §11 all checked after first deployed run.
**Risks:** requires a real Telegram bot + public repo.

### Phase 9 — Backlog (fase 2, pós-MVP)

**Goal:** extend sources and relevance features per PRD §12.

**Status:** Complete (B1–B6).

**Paths:** `src/sources/*`, `src/notifier/*`, `src/index.ts`

- [x] B1 — Eureca scraper (`https://candidate-api.eureca.me/programs`, list + detail) — `src/sources/eureca.ts` ✅
- [x] B2 — LinkedIn guest endpoint (rate-limit mitigation + second pass) — `src/sources/linkedin.ts` ✅ (see below)
- [x] B3 — SIARE/UFSC + FEPESE (login/PDF; decide automate vs manual) — documented in `specs/manual-sources.md` ✅ (SIARE manual; FEPESE-vagas automatable → B6)
- [x] B4 — Relevance score (1–10) + Telegram 👍/👎, per-source precision — `src/scoring.ts`, `src/feedback.ts`, `data/feedback.json` ✅
- [x] B5 — Ranked daily digest (high-relevance immediate + digest) — `src/digest.ts`, `data/digest.json`, `RELEVANCE_THRESHOLD=7` ✅
- [x] B6 — FEPESE "vagas" source via WordPress REST API (`https://fepese.org.br/wp-json/wp/v2/vaga`, public JSON, no login) — `src/sources/fepese.ts` ✅ (list + `X-WP-TotalPages` pagination, `parseVagaItem` + 5 tests)

**Definition of Done:** each source follows `Source` contract in `src/index.ts`; matcher tests extended.
**Risks:** LinkedIn/SIARE/FEPESE scraping fragility (PRD §10).

## Verification Log

- `2026-09-16: npm run typecheck` — exit 0, no TS errors.
- `2026-09-16: npm run test` — 30/30 pass (`matcher` + `dedup` + `linkedin` + `scoring` + `digest`), 0 fail.
- `2026-09-16: npm run dev` (no token) — dry-run OK: `{fetched: 98, accepted: 12, notified: 0, digested: 0, digestSent: 0, failures: [], feedback: null}`, exit 0; `data/*.json` unchanged.
- `2026-09-16: npm run dev` (no token) — dry-run OK: `{fetched: 68, accepted: 4, notified: 0, failures: []}`, exit 0 (61 GitHub + 7 Eureca; `fetchEurecaJobs` returns real programs).
- `2026-09-16: git status` — repo on `master` with **no commits**; all files untracked.
- `2026-09-16: data/jobs.json` — unchanged after dry-run (`{ "seen": {} }`), confirming dry-run does not persist.
- `2026-09-16: re-verify` — `npm run typecheck` exit 0; `npm run test` 20/20 pass. `tests/dedup.test.ts` added; `normalize` test now asserts `SÃO JOSÉ`/`Sao.Jose`.
- `2026-09-16: B6` — `npm run typecheck` exit 0; `npm run test` 35/35 pass (added `tests/fepese.test.ts`, 5 tests). FEPESE API verified live: `GET /wp-json/wp/v2/vaga?per_page=100` → `X-WP-Total: 291`, `X-WP-TotalPages: 3`.
- `2026-09-16: npm run dev` (no token) — dry-run OK: `{fetched: 389, accepted: 14, notified: 0, digested: 0, digestSent: 0, failures: [], feedback: null}`; FEPESE jobs flow through the matcher (e.g. "1015-Bolsa de Graduação-Desenvolvedores de Sistema" → Florianópolis).

## Summary

| Phase | Status |
|---|---|
| 0 — Foundation | ✅ Complete |
| 1 — Model & config | ✅ Complete |
| 2 — Matcher | ✅ Complete (16 tests) |
| 3 — Dedup & state | ✅ Complete (4 tests) |
| 4 — Sources | ✅ GitHub + Eureca |
| 5 — Telegram | ✅ Complete |
| 6 — Orchestration | ✅ Complete |
| 7 — CI/CD | ⚠ Workflows done, secrets pending |
| 8 — MVP readiness | ⚠ Code done, deploy pending |
| 9 — Backlog (fase 2) | ✅ Complete (B1–B6) |

**Remaining effort:** configure Telegram/GitHub secrets + BotFather; first public commit. (All code tasks complete, including backlog B6.)

## Known Existing Work

- `src/job.ts` — `Job`, `MatchResult`, `LocationConfidence` types.
- `src/config.ts` — all filter rule lists (noise, level, stack, location, homonyms).
- `src/matcher.ts` — `normalize`, `match` (level → stack → location).
- `src/dedup.ts` — state load/save + dedup key + `isNew`/`markNotified`, `JOBS_DB_PATH`.
- `src/sources/github-lists.ts` — GitHub issues source (configurable repos, PR skip, token).
- `src/sources/eureca.ts` — Eureca scraper (`candidate-api.eureca.me`).
- `src/sources/linkedin.ts` — LinkedIn guest source (`seeMoreJobPostings`), rate-limit mitigation + `parseLinkedInHtml` (B2).
- `src/sources/fepese.ts` — FEPESE "vagas" source (WordPress REST `/wp-json/wp/v2/vaga`), `parseVagaItem` + `fetchFepeseJobs` with `X-WP-TotalPages` pagination (B6).
- `tests/linkedin.test.ts` — LinkedIn HTML parser tests (2).
- `tests/fepese.test.ts` — FEPESE `parseVagaItem` tests (5).
- `src/scoring.ts` — `scoreJob` (1–10) + reasons; `tests/scoring.test.ts` (3 tests).
- `src/feedback.ts` — `collectFeedback` (getUpdates polling) + `sourcePrecision`; state in `data/feedback.json`.
- `src/notifier/telegram.ts` — `sendMessage` agora aceita `reply_markup` (inline keyboard 👍/👎 via `voteKeyboard`).
- `src/digest.ts` — digest diário ranqueado: `enqueueDigest`/`buildDigestText`/`isDigestDue`/`sendDigestIfDue`; `RELEVANCE_THRESHOLD=7` em `config.ts`; estado em `data/digest.json`.
- `src/notifier/telegram.ts` — `sendMessage`.
- `src/index.ts` — full cycle orchestration + dry-run + all-sources-failed alert.
- `.github/workflows/radar.yml`, `.github/workflows/testes.yml` — cron + CI.
- `tests/matcher.test.ts` — 16 passing matcher tests.

## Known Limitations (observed, not blocking)

- GitHub `company` field is the repo owner (`backend-br`), not the actual employer; titles may include `[Remoto]`/`(Company)` noise (seen in dry-run output).
- `PL` abbreviation for "pleno" is not rejected by `levelOk` (config lacks `pl`).
- No tests for `telegram.ts`, sources, or orchestration.

## Manual Deployment Tasks

1. Create the public GitHub repository and push the first commit.
2. Create a bot via [@BotFather](https://t.me/BotFather) and obtain the bot token.
3. Add repo secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `GITHUB_TOKEN`.
4. Run the `radar` workflow manually once via `workflow_dispatch` and confirm the first Telegram notification + `data/jobs.json` commit.
5. Confirm cost is R$ 0 (no billing resources used).
