import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLinkedInHtml } from "../src/sources/linkedin.js";

const HTML = `
<div class="jobs-search__results-list">
  <li>
    <div class="base-card">
      <a class="base-card__full-link absolute top-0" href="https://br.linkedin.com/jobs/view/123?position=1&amp;pageNum=0"></a>
      <div class="base-search-card__info">
        <h3 class="base-search-card__title">
          Desenvolvedor Back-end Node.js J&uacute;nior
        </h3>
        <h4 class="base-search-card__subtitle">
          <a class="hidden-nested-link" href="https://br.linkedin.com/company/acme">Acme Corp</a>
        </h4>
        <span class="job-search-card__location">S&atilde;o Paulo, Brasil</span>
      </div>
    </div>
  </li>
  <li>
    <div class="base-card">
      <a class="base-card__full-link" href="https://br.linkedin.com/jobs/view/456"></a>
      <div class="base-search-card__info">
        <h3 class="base-search-card__title">Desenvolvedor Java S&ecirc;nior</h3>
        <h4 class="base-search-card__subtitle">Beta Ltda</h4>
        <span class="job-search-card__location">Remoto</span>
      </div>
    </div>
  </li>
  <li>
    <div class="base-card">
      <a class="base-card__full-link" href="https://br.linkedin.com/jobs/view/789"></a>
    </div>
  </li>
</div>
`;

test("parseLinkedInHtml extrai campos e ignora cartao malformado", () => {
  const jobs = parseLinkedInHtml(HTML);
  assert.equal(jobs.length, 2);

  const [first, second] = jobs;
  assert.equal(first?.source, "linkedin");
  assert.equal(first?.title, "Desenvolvedor Back-end Node.js Júnior");
  assert.equal(first?.company, "Acme Corp");
  assert.equal(first?.location, "São Paulo, Brasil");
  assert.equal(first?.url, "https://br.linkedin.com/jobs/view/123?position=1&pageNum=0");
  assert.equal(first?.description, "");
  assert.equal(first?.publishedAt, undefined);

  assert.equal(second?.title, "Desenvolvedor Java Sênior");
  assert.equal(second?.company, "Beta Ltda");
  assert.equal(second?.location, "Remoto");
  assert.equal(second?.url, "https://br.linkedin.com/jobs/view/456");
});

test("parseLinkedInHtml retorna lista vazia para html sem cartoes", () => {
  assert.deepEqual(parseLinkedInHtml("<div>sem vagas</div>"), []);
});
