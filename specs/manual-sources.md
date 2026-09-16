# Manual & semi-automatic sources (task B3)

Investigação das fontes da fase 2: **SIARE/UFSC** e **FEPESE**.
Decisão por fonte: automatizar vs. checagem manual documentada.

## Resumo

| Fonte | URL(s) | Acesso | Decisão | Justificativa |
|---|---|---|---|---|
| SIARE / UFSC | `https://siare.ufsc.br` (→ `https://siare.sistemas.ufsc.br/login`) | **Login (SSO IdUFSC)**; sem API/feed público; página pública atrás de anti-bot | **Manual** | 401/"Acesso Negado" sem sessão; autenticação via `sistemas.ufsc.br`; scraping frágil + bot-protection (PRD §10). |
| FEPESE — Vagas (estágio/CLT/bolsa) | `https://fepese.org.br/vagas/` · API `https://fepese.org.br/wp-json/wp/v2/vaga` | **Público, sem login, JSON** (WordPress REST) | **Automatizar** | API REST pública e estável (291 vagas), conteúdo completo em HTML; não é PDF-only; sem rate-limit evidente. |
| FEPESE — Concursos (editais) | `https://fepese.org.br/concursos/` · API `https://fepese.org.br/wp-json/wp/v2/concurso` (subdomínios com PDF) | Público (lista), editais em **PDF** | **Manual / fora de escopo** | Concursos públicos (concursos/cargos), geralmente não são vagas de dev estágio/jr; editais em PDF em subdomínios. |

---

## 1. SIARE / UFSC — MANUAL

### O que é
**SIARE** = "Sistema de Informação para Acompanhamento e Registro de Estágios" da UFSC.
Portal de estágios da universidade. As vagas ficam dentro do portal, acessível só com login.

### Evidência de login-wall (verificado 2026-09-16)
- `https://siare.ufsc.br/` → redireciona para `https://siare.sistemas.ufsc.br/login` → **HTTP 401**, página "Acesso Negado" ("O acesso ao recurso ou operação escolhida não está disponível para seu perfil de acesso").
- Autenticação via SSO da UFSC: link "autenticar novamente" aponta para `https://sistemas.ufsc.br/login?service=https://siare.sistemas.ufsc.br/login` (IdUFSC).
- A página pública `https://estagios.ufsc.br` é protegida pelo "Sistema de Prevenção de Ataques da RedeUFSC" (desafio anti-bot) quando acessada de fora da RedeUFSC/VPN.
- **Não há** API pública, JSON, RSS ou feed de vagas.

### Procedimento de checagem manual
Frequência sugerida: 1x por dia útil (manhã).

1. Acesse `https://siare.ufsc.br` (ou `https://estagios.ufsc.br`).
2. Faça login com a conta UFSC (IdUFSC / gov.br, se aplicável).
3. No menu do portal, abra a listagem de **vagas de estágio** (seção de oportunidades/vagas abertas).
4. Filtre por **curso/área**: Computação, Sistemas de Informação, Engenharia de Software ou correlatas.
5. Para cada vaga nova: leia título + requisitos (linguagens, nível) e o **local** (campus/remoto).
6. Se encaixar no perfil (backend/fullstack Node+TS, estágio/jr, Florianópolis/São José/Palhoça/remoto), copie a vaga para o radar manualmente (via checklist interno ou adicionando ao `data/jobs.json` à mão, se for o caso).

> Nota: como é login-walled, a fonte não entra no ciclo automatizado; fica registrada aqui como checagem manual.

---

## 2. FEPESE — Vagas: AUTOMATIZAR

### O que é
A FEPESE tem um board de **vagas** (Fepese Estágios + processos seletivos CLT/bolsa) num WordPress.
Ao contrário do que se supunha (PDF-only), as vagas são expostas por uma **API REST pública e estruturada**.

### Endpoints (verificados 2026-09-16)
- Lista: `GET https://fepese.org.br/wp-json/wp/v2/vaga?per_page=100&page=N&orderby=date&order=desc`
  - **HTTP 200**, JSON, sem autenticação.
  - Paginação por cabeçalhos: `X-WP-Total: 291`, `X-WP-TotalPages` (com `per_page=100` → ~3 páginas), `Link: rel="next"`.
- Detalhe (single): `GET https://fepese.org.br/wp-json/wp/v2/vaga/{id}`
- Taxonomias úteis (para mapear nível/tipo):
  - `tax_tipo_contrato`: `54 Bolsa`, `57 CLT`, `78 Estágio`, `100003 jovem_aprendiz`, `275 Prestação de Serviços`, …
  - `tax_carga_horaria`: `40 4h`, `42 6h`, `43 8h`, `174 A combinar`, …

### Shape de cada item (mapeamento p/ `Job`)
```json
{
  "id": 25365,
  "date": "2026-09-02T14:54:56",
  "slug": "1673-z71-estagio-em-design",
  "link": "https://fepese.org.br/vaga/1673-z71-estagio-em-design/",
  "title": { "rendered": "Z71-Estágio em Design" },
  "content": { "rendered": "<p><b>Bolsa auxílio:</b> …</p> …" },
  "tax_tipo_contrato": [78],
  "tax_carga_horaria": [42],
  "acf": { "cidade": "Florianópolis", "img_url": null }
}
```

### Sketch do fetch (NÃO implementar agora)
```
source = "fepese"
for page in 1..totalPages:
    GET /wp-json/wp/v2/vaga?per_page=100&page={page}&orderby=date&order=desc
for each item:
    Job {
      source: "fepese",
      title: item.title.rendered          (strip HTML)
      company: item.acf.cidade (ou "FEPESE")  // conteúdo HTML não traz empresa explícita; ver campo "Atividade da empresa" no content
      location: item.acf.cidade            ("Florianópolis", "Brasília", …)
      url: item.link,
      description: stripHtml(item.content.rendered),  // contém descrição + requisitos + bolsa
      publishedAt: item.date
    }
```
Observações:
- `content.rendered` é HTML com blocos `Descrição da atividade` / `Requisitos obrigatórios` / `Bolsa auxílio` / `Formato de trabalho`; o matcher já lê título+descrição, então a extração de texto puro basta.
- A cidade (`acf.cidade`) é a fonte de localização; onde estiver vazio, o filtro trata como local desconhecido (confiança baixa, PRD §5.3).
- Algumas vagas têm PDFs anexos (ex.: editais de bolsistas) — `content.rendered` traz os links, mas o texto do corpo costuma bastar; PDF parsing fica opcional.

---

## 3. FEPESE — Concursos (editais em PDF): MANUAL / fora de escopo

- Lista pública: `https://fepese.org.br/concursos/` e `GET /wp-json/wp/v2/concurso` (títulos + links).
- Cada concurso aponta para um **subdomínio próprio** (ex.: `https://2025pciperito.fepese.org.br`) onde os **editais são PDFs**.
- São concursos públicos / processos seletivos de cargos (ex.: Prefeitura de São José, Polícia Científica, CIDASC) — **não são vagas de dev estágio/jr**, então ficam fora do alvo do radar.
- Se algum dia for relevante, tratar como **manual** (abrir o concurso, baixar o edital em PDF e ler o quadro de vagas), dado o custo de download+parse de PDFs (PRD §10).

### Procedimento de checagem manual (só se necessário)
1. Abrir `https://fepese.org.br/concursos/`.
2. Para cada concurso em andamento, abrir o subdomínio correspondente.
3. Baixar o edital (PDF) e buscar por cargos da área de tecnologia.
4. Anotar cargo, requisitos, local e período de inscrição.
