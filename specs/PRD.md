# PRD — Radar de Vagas (estágio/jr em desenvolvimento de software)

## 1. Visão geral

Ferramenta pessoal que monitora vagas de **estágio e júnior** em desenvolvimento de software, filtra pelo **meu perfil** (backend/fullstack Node + TypeScript) e pela **minha localização** (São José/SC, Palhoça/SC e Florianópolis/SC em presencial/híbrido; remoto em todo o Brasil), e notifica via **Telegram**.

Infraestrutura: **R$ 0** — GitHub Actions como motor de cron, histórico versionado no próprio git, sem servidor, sem banco externo, sem frontend.

## 2. Problema

Vaga de estágio/jr em Santa Catarina aparece pouco e some rápido. Checar vários boards manualmente, várias vezes ao dia, é ineficiente e faz perder vaga para quem checou primeiro.

## 3. Objetivos

- Notificar automaticamente, no Telegram, toda vaga nova que encaixe no perfil.
- Rodar 24/7 sem servidor próprio e sem custo.
- Ser resiliente: fonte quebrada não derruba o ciclo; nunca re-notifica vaga já vista.
- Ser um case de portfólio (repo público), como a inspiração.

## 4. Não-objetivos (fora do MVP)

- Interface web.
- Cadastro/login/multi-usuário.
- LinkedIn, SIARE/UFSC e FEPESE automatizados (ficam para a fase 2).
- Modelo de ML / IA para o filtro (filtro é por regras explicáveis).

## 5. Perfil alvo — regras de filtro

O filtro lê **título + descrição** (o stack quase nunca está no título).

### 5.1 Nível

| Situação | Decisão |
|---|---|
| Título/descrição com pleno, sênior/senior/sr, especialista, staff, tech lead, gerente, coordenador | **Rejeita** |
| Estágio, júnior/jr, trainee, aprendiz | Aceita |
| Vaga de dev sem nível explícito | **Aceita** (cobertura maior; risco aceito de pegar pleno) |

### 5.2 Stack

| Situação | Decisão |
|---|---|
| Backend Node/TS (node, express, nestjs, fastify, typescript) | Aceita |
| Fullstack com Node no backend | Aceita |
| Sinais de backend/API/Postgres/Docker/GCP | Aceita (sinal de fit) |
| Outra stack sem sinal Node (java, spring, php, laravel, c#/.net, python, ruby, go, kotlin, swift…) | **Rejeita** |
| Frontend puro ou mobile sem sinal de backend | **Rejeita** |
| Sem nenhum sinal de stack (ex.: "Solidity Engineer", issue de regras do repo) | **Rejeita** (filtro exige sinal positivo de Node/backend/API/TypeScript) |
| Título que não é vaga (ex.: "Regras para divulgação", "Readme") | **Rejeita** (filtro de ruído de título) |

### 5.3 Localização

| Situação | Decisão |
|---|---|
| Remoto / home office / qualquer lugar (Brasil) | Aceita |
| Presencial/híbrido em São José/SC, Palhoça/SC, Florianópolis/SC | Aceita |
| Presencial/híbrido em outra cidade | **Rejeita** |
| Remoto restrito a outro país (ex.: "US only") | **Rejeita** |
| Local não informado | Aceita com confiança baixa (registrada no log) |

Homônimos tratados: `São José dos Campos`, `São José do Rio Preto`, `São José de Ribamar` etc. **não** contam como São José/SC.

## 6. Fontes

| Fonte | Fase | Status |
|---|---|---|
| GitHub (backend-br/vagas e similares) | 1 (MVP) | Implementada |
| Eureca | 1 (MVP) | Stub — task de implementação |
| SIARE/UFSC | 2 | Manual (login/portal) |
| FEPESE | 2 | Manual (editais/PDF) |
| LinkedIn | 2 | Endpoint não-oficial (risco documentado) |

**Regra de fallback:** fonte quebrada é registrada no log e não derruba o ciclo; só alerta no Telegram se **todas** as fontes falharem.

## 7. Pipeline (um ciclo de busca)

1. Busca as fontes em paralelo.
2. Normaliza cada vaga em um `Job` (fonte, título, empresa, local, url, descrição, data).
3. Filtra: nível → stack → localização.
4. Deduplica por `url` ou por `empresa + título`.
5. Notifica no Telegram — só marca como vista **após** confirmação de envio.
6. Persiste `data/jobs.json` (o workflow commita; o commit é o histórico).

## 8. Requisitos não-funcionais

- **Custo:** R$ 0.
- **Frequência:** cron a cada 3 horas.
- **Resiliência:** idempotente (não re-notifica); alerta se todas as fontes falharem.
- **Repo público:** cota ilimitada do Actions + visibilidade de portfólio.
- **Anti-armadilha do cron:** o GitHub Actions desliga workflows agendados após 60 dias sem commit — mitigado de graça porque **cada ciclo commita** o histórico.

## 9. Arquitetura

```
GitHub Actions (cron 3h)
   └─ Node/TS (tsx)
        ├─ sources/ (github-lists, eureca…)
        ├─ matcher.ts  (filtro: nível → stack → localização)
        ├─ dedup.ts    (histórico em data/jobs.json)
        ├─ notifier/telegram.ts
        └─ index.ts    (orquestração do ciclo)
   └─ git commit data/jobs.json  ← estado, dedup e anti-60-dias
```

Sem banco, sem API, sem frontend, sem Workers. `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` e `GITHUB_TOKEN` ficam em secrets do repositório.

## 10. Riscos e limites conhecidos

- **Scraping frágil:** fontes mudam HTML/API sem aviso; mitigado pelo fallback de fonte quebrada.
- **SIARE/FEPESE:** possivelmente login-walled ou PDF — deixadas para a fase 2.
- **Volume sem LinkedIn:** fase 1 cobre menos vagas; aceito conscientemente.
- **Filtro lê só texto:** vaga com título comercial (ex.: "Analista Comercial" que usa Node na descrição) pode escapar se a descrição não estiver acessível.
- **Local não informado é aceito:** pode gerar notificação de vaga fora do alvo; prioridade é não perder vaga (over-notify) na fase de baixo volume.

## 11. Critérios de aceite (MVP)

- [ ] `npm run dev` roda localmente sem token e imprime as vagas filtradas (dry-run).
- [ ] Workflow de cron a cada 3h no GitHub Actions (público).
- [ ] Telegram recebe vaga nova que passa no filtro.
- [ ] Vaga já vista **não** é re-notificada.
- [ ] Testes do matcher passam em CI.
- [ ] Custo total de infraestrutura: R$ 0.

## 12. Roadmap (fase 2)

1. LinkedIn (endpoint não-oficial, com mitigação de rate-limit).
2. SIARE/UFSC e FEPESE (login/PDF).
3. Score de relevância (1–10) + botão 👍/👎 no Telegram.
4. Resumo diário ranqueado (alta relevância imediata + digest).
