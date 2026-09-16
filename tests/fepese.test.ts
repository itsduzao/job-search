import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVagaItem } from "../src/sources/fepese.js";

test("parseVagaItem mapeia um item bem-formado para Job", () => {
  const job = parseVagaItem({
    date: "2026-09-02T14:54:56",
    link: "https://fepese.org.br/vaga/1673-z71-estagio-em-design/",
    title: { rendered: "Z71-Est&aacute;gio em Design" },
    content: {
      rendered:
        "<p><b>Bolsa aux&iacute;lio:</b> R$ 1.200</p><p>Atuar em design.</p>",
    },
    acf: { cidade: "Florianópolis", img_url: null },
  });

  assert.equal(job?.source, "fepese");
  assert.equal(job?.title, "Z71-Estágio em Design");
  assert.equal(job?.company, "FEPESE");
  assert.equal(job?.location, "Florianópolis");
  assert.equal(
    job?.url,
    "https://fepese.org.br/vaga/1673-z71-estagio-em-design/",
  );
  assert.equal(job?.description, "Bolsa auxílio: R$ 1.200 Atuar em design.");
  assert.equal(job?.publishedAt, "2026-09-02T14:54:56");
});

test("parseVagaItem retorna null quando nao ha title.rendered", () => {
  const job = parseVagaItem({
    date: "2026-09-02T14:54:56",
    link: "https://fepese.org.br/vaga/1673/",
    title: {},
    content: { rendered: "<p>Sem titulo</p>" },
    acf: { cidade: "Florianópolis", img_url: null },
  });

  assert.equal(job, null);
});

test("parseVagaItem retorna null quando nao ha link", () => {
  const job = parseVagaItem({
    date: "2026-09-02T14:54:56",
    title: { rendered: "Z71-Estágio em Design" },
    content: { rendered: "<p>Sem link</p>" },
    acf: { cidade: "Florianópolis", img_url: null },
  });

  assert.equal(job, null);
});

test("parseVagaItem usa location vazia quando acf.cidade esta ausente", () => {
  const job = parseVagaItem({
    date: "2026-09-02T14:54:56",
    link: "https://fepese.org.br/vaga/1673/",
    title: { rendered: "Z71-Estágio em Design" },
    content: { rendered: "<p>Sem cidade</p>" },
  });

  assert.equal(job?.location, "");
});

test("parseVagaItem usa location vazia quando acf.cidade e null", () => {
  const job = parseVagaItem({
    date: "2026-09-02T14:54:56",
    link: "https://fepese.org.br/vaga/1673/",
    title: { rendered: "Z71-Estágio em Design" },
    content: { rendered: "<p>Sem cidade</p>" },
    acf: { cidade: null, img_url: null },
  });

  assert.equal(job?.location, "");
});
