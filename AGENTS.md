# AGENTS.md

Guia para agentes que trabalham neste repositório. O ponto central: **a documentação
do projeto é a fonte da verdade das decisões**, e toda mudança de comportamento deve
deixá-la atualizada no mesmo trabalho.

## 1. Leia a documentação antes de decidir

Antes de alterar comportamento, filtros, fontes, notificação ou CI, leia:

- [`specs/PRD.md`](specs/PRD.md) — requisitos, regras de filtro (§5), arquitetura (§7),
  backlog (§12). Define **o quê** e **por quê**.
- [`specs/TASKS.md`](specs/TASKS.md) — divisão em tasks pequenas com critério de aceite.
  Define **como** e a ordem.
- [`specs/manual-sources.md`](specs/manual-sources.md) — avaliação de cada fonte
  (automatizar vs. manual) e o porquê.
- [`TASKS.md`](TASKS.md) — plano de implementação e status corrente (fases, verificação,
  limitações conhecidas).

Hierarquia em caso de conflito: **PRD > specs/TASKS.md > código**. Se o código contraria
o PRD, o código é o bug — não ajuste a regra sem antes atualizar o PRD e justificar.

## 2. Mapa da documentação e quando atualizar

| Documento | Conteúdo | Atualize quando… |
|---|---|---|
| `specs/PRD.md` | Requisitos, regras de filtro, arquitetura, backlog | Mudar comportamento/regra/escopo |
| `specs/TASKS.md` | Tasks com critério de aceite | Concluir task (`[ ]`→`[x]`) ou criar task nova |
| `TASKS.md` | Status por fase, verificação, limitações | Qualquer entrega: status, log, resumo |
| `README.md` | Como rodar, secrets, contribuir fonte | Mudar execução, env ou setup |
| `specs/manual-sources.md` | Decisão sobre fontes | Adicionar/avaliar uma fonte |
| `AGENTS.md` | Este guia | Mudar o fluxo de trabalho/documentação |

## 3. Checklist ao concluir uma mudança

1. Atualize o documento afetado (tabela acima) **no mesmo trabalho**, não depois.
2. Marque o checkbox da task em `specs/TASKS.md` quando o critério de aceite for atingido.
3. Em `TASKS.md`, atualize **Last Updated**, o status da fase, a tabela **Summary** e a
   seção **Known Existing Work** quando arquivos/módulos mudarem.
4. Adicione uma linha no **Verification Log** de `TASKS.md`:
   `- AAAA-MM-DD: <comando> — <resultado observado>`.
5. Registre riscos/limitações novas em **Known Limitations**.
6. Cite caminhos como `arquivo:linha` para dar rastreabilidade.

## 4. Convenções do projeto

- Regras de filtro ficam **só** em `src/config.ts`; nada hardcoded no matcher/sources.
- Fonte nova segue o contrato `Source` em `src/index.ts` e entra no array `SOURCES`.
- Dedup usa URL canônica (sem query/hash) — parâmetros de tracking não contam como vaga nova.
- Documentação em **português**, concisa e sem duplicar conteúdo entre arquivos (linke
  em vez de copiar).
- Não adicione comentários ao código sem necessidade.

## 5. Verificação obrigatória

Antes de considerar qualquer mudança pronta, rode no worktree:

```bash
npm ci
npm run typecheck
npm run test
npm run dev   # dry-run, sem token: apenas imprime as vagas filtradas
```

Resultados vão para o Verification Log de `TASKS.md`. Só marque algo como concluído após
os comandos passarem de fato.

## 6. Git

- Só commite, faça push ou abra PR quando explicitamente solicitado.
- Preserve o estilo de commit do repositório (`feat(...)`, `chore(radar): ...`, etc.).
