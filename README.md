# Job Search — Radar de Vagas (estágio/jr)

Monitora vagas de estágio/júnior em desenvolvimento (backend/fullstack Node + TypeScript), filtra por perfil e localização (Grande Florianópolis presencial/híbrido + remoto Brasil) e notifica no **Telegram**. Custo de infraestrutura: **R$ 0**.

## Como funciona

GitHub Actions roda um cron a cada 3h, busca vagas nas fontes, filtra (nível → stack → localização), deduplica e notifica no Telegram. O histórico fica versionado em `data/jobs.json` (cada ciclo commita, o que também mantém o cron vivo).

## Como rodar localmente

```bash
npm install
npm run dev          # dry-run: imprime as vagas filtradas, sem notificar
```

Para notificar de verdade, crie um bot no [@BotFather](https://t.me/BotFather) e um `.env`:

```
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
GITHUB_TOKEN=...
```

## Testes e typecheck

```bash
npm run typecheck
npm run test
```

## Configuração no GitHub

1. Crie o repositório público.
2. Adicione os secrets `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` e `GITHUB_TOKEN`.
3. O workflow `radar.yml` roda a cada 3h (e manualmente via `workflow_dispatch`).

## Documentação

- [Specs](specs/README.md)
  - [PRD](specs/PRD.md)
  - [Tasks de implementação](specs/TASKS.md)
