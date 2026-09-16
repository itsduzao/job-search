# TASKS — divisão de implementação

Cada task é pequena, tem critério de aceite e pode ser feita em um commit. Ordem sugerida: fase 0 → 1 → 2 … → MVP → fase 2.

---

## Fase 0 — Fundação do repositório

- [ ] **T0.1** Criar `package.json` (type module, scripts `dev`, `typecheck`, `test`), `tsconfig.json` (strict) e `.gitignore`.
  - *Aceite:* `npm install` e `npm run typecheck` passam.
- [ ] **T0.2** Criar `.env.example` (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `GITHUB_TOKEN`) e `data/jobs.json` inicial `{ "seen": {} }`.
  - *Aceite:* arquivos existem; `.env` está no `.gitignore`.

## Fase 1 — Modelo e configuração

- [ ] **T1.1** Definir o tipo `Job` (`src/job.ts`) com `source`, `title`, `company`, `location`, `url`, `description`, `publishedAt?`.
  - *Aceite:* typecheck passa.
- [ ] **T1.2** Extrair as regras de filtro para `src/config.ts` (termos de nível, stack, localização, homônimos).
  - *Aceite:* nenhuma regra "hardcoded" fora do config; typecheck passa.
- [x] **T1.3** Implementar `normalize` (lowercase, sem acento, pontuação vira espaço) em `src/matcher.ts`.
  - *Aceite:* teste unitário com "São José", "SÃO JOSÉ", "Sao.Jose".

## Fase 2 — Matcher (coração do filtro)

- [ ] **T2.1** Filtro de nível (`levelOk`): rejeita sênior/pleno/especialista/staff/lead/gerente; aceita o resto.
  - *Aceite:* testes `matcher.test.ts` para aceitar "júnior" e "sem nível", rejeitar "sênior", "pleno", "Dev Sr".
- [ ] **T2.2** Filtro de stack (`stackOk`): rejeita outra stack sem sinal Node e frontend/mobile puro; aceita backend/fullstack Node.
  - *Aceite:* testes para Node/Express/NestJS (aceita), Java/PHP/Python (rejeita), "Front-end React" (rejeita), "Fullstack React+Node" (aceita).
- [ ] **T2.3** Filtro de localização (`locationOk`): remoto Brasil aceita; cidades-alvo aceitas; presencial fora rejeita; homônimo de São José rejeita; "US only" rejeita; local vazio aceita com confiança "unknown".
  - *Aceite:* testes para cada caso acima.
- [ ] **T2.4** Função `match(job)` que compõe os três filtros e devolve `MatchResult { ok, reason?, signals, locationConfidence }`.
  - *Aceite:* todos os testes da fase 2 verdes.

## Fase 3 — Deduplicação e estado

- [x] **T3.1** Implementar `src/dedup.ts`: `loadState`, `saveState`, `dedupKey` (url, senão empresa+título), `isNew`, `markNotified`.
  - *Aceite:* teste de que a mesma vaga (mesma url) não é considerada nova duas vezes.
- [x] **T3.2** Suportar `JOBS_DB_PATH` (para testar sem tocar no histórico real).
  - *Aceite:* rodar com banco temporário não altera `data/jobs.json`.

## Fase 4 — Fontes

- [ ] **T4.1** Implementar `src/sources/github-lists.ts`: busca issues abertas de `backend-br/vagas` (e lista configurável via env), ignora PRs, usa `GITHUB_TOKEN` se presente.
  - *Aceite:* rodar localmente retorna `Job[]` reais; erro vira exceção tratável.
- [ ] **T4.2** Criar `src/sources/eureca.ts` como stub que lança erro "não implementado" (para ser tratado como fonte quebrada).
  - *Aceite:* typecheck passa; erro é capturado no ciclo.
- [ ] **T4.3** Definir a interface de fonte (contrato) e o registro de fontes usado pelo orquestrador.
  - *Aceite:* adicionar uma fonte nova é só registrar no array.

## Fase 5 — Notificação (Telegram)

- [ ] **T5.1** Implementar `src/notifier/telegram.ts`: `sendMessage` via API do BotFather, com erro lançado em status != 200.
  - *Aceite:* função assina `(token, chatId, text)` e falha visível em erro de rede.
- [ ] **T5.2** Formatar mensagem de vaga (título, empresa, local, url) em `src/index.ts`.
  - *Aceite:* mensagem legível no Telegram (teste manual com token).

## Fase 6 — Orquestração do ciclo

- [ ] **T6.1** Implementar `src/index.ts`: busca fontes em paralelo (`Promise.allSettled`), filtra, deduplica, notifica e persiste — marcando como vista **só após** envio confirmado.
  - *Aceite:* dry-run sem token imprime vagas filtradas; com token, notifica e persiste.
- [ ] **T6.2** Heartbeat/alertas: se todas as fontes falharem, enviar alerta no Telegram; logar resumo (`fetched/accepted/notified/failures`).
  - *Aceite:* simular fonte quebrada dispara alerta quando todas falham.

## Fase 7 — CI/CD

- [ ] **T7.1** Criar `.github/workflows/radar.yml` (cron `0 */3 * * *`, `workflow_dispatch`, permissão `contents: write`, roda `npm ci` + `npm run dev` + commit/push de `data/jobs.json`).
  - *Aceite:* execução manual via `workflow_dispatch` roda e commita se houver mudança.
- [ ] **T7.2** Criar `.github/workflows/testes.yml` (roda `npm run test` e `npm run typecheck` a cada push).
  - *Aceite:* CI verde no push.
- [ ] **T7.3** Configurar secrets (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `GITHUB_TOKEN`) e o token do bot no BotFather.
  - *Aceite:* primeira notificação real chega no Telegram.

## Fase 8 — MVP "pronto"

- [ ] **T8.1** Validar os critérios de aceite do PRD (seção 11) de ponta a ponta.
- [ ] **T8.2** Escrever/ajustar README (como rodar, configurar secrets, contribuir fonte).
- [ ] **T8.3** Primeiro commit público e confirmação de custo R$ 0.

---

## Fase 2 (pós-MVP) — backlog

- [x] **B1** Implementar scraper do Eureca (`https://candidate-api.eureca.me/programs`, listagem + detalhe).
- [x] **B2** LinkedIn (endpoint guest, com mitigação de rate-limit e segunda passada no fim do ciclo).
- [x] **B3** SIARE/UFSC e FEPESE (avaliar login/PDF; decidir automatizar vs manual). → `specs/manual-sources.md` (SIARE manual; FEPESE-vagas automatizável via WP REST).
- [x] **B4** Score de relevância (1–10) e botão 👍/👎 no Telegram, medindo precisão por fonte.
- [ ] **B5** Resumo diário ranqueado (alta relevância imediata + digest).
- [ ] **B6** Fonte FEPESE "vagas" via API REST do WordPress (`/wp-json/wp/v2/vaga`, pública, sem login).
