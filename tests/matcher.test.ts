import { test } from "node:test";
import assert from "node:assert/strict";
import { match, normalize } from "../src/matcher.js";
import type { Job } from "../src/job.js";

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

test("normalize remove acento e pontuacao", () => {
  assert.equal(normalize("São José"), "sao jose");
  assert.equal(normalize("Node.js"), "node js");
  assert.equal(normalize("SÃO JOSÉ"), "sao jose");
  assert.equal(normalize("Sao.Jose"), "sao jose");
});

test("aceita backend node junior", () => {
  const r = match(
    job({
      title: "Desenvolvedor Back-end Node.js Júnior",
      location: "Florianópolis, SC",
      description: "Node, Express, PostgreSQL, Docker",
    }),
  );
  assert.equal(r.ok, true);
});

test("aceita vaga sem nivel", () => {
  const r = match(
    job({
      title: "Desenvolvedor Backend",
      location: "Remoto",
      description: "API em TypeScript com NestJS",
    }),
  );
  assert.equal(r.ok, true);
});

test("rejeita senior", () => {
  const r = match(job({ title: "Desenvolvedor Node.js Sênior", location: "Remoto" }));
  assert.equal(r.ok, false);
  assert.match(r.reason ?? "", /nivel/);
});

test("rejeita pleno", () => {
  const r = match(job({ title: "Dev Backend Pleno", location: "Remoto" }));
  assert.equal(r.ok, false);
});

test("rejeita stack java", () => {
  const r = match(
    job({ title: "Desenvolvedor Java Júnior", location: "Remoto", description: "Spring Boot" }),
  );
  assert.equal(r.ok, false);
});

test("rejeita frontend puro", () => {
  const r = match(
    job({ title: "Desenvolvedor Front-end React", location: "Remoto", description: "React" }),
  );
  assert.equal(r.ok, false);
});

test("aceita fullstack node", () => {
  const r = match(
    job({
      title: "Fullstack React + Node",
      location: "Remoto",
      description: "React e Express",
    }),
  );
  assert.equal(r.ok, true);
});

test("rejeita cidade homonima de Sao Jose", () => {
  const r = match(
    job({ title: "Desenvolvedor Backend Júnior", location: "São José dos Campos, SP" }),
  );
  assert.equal(r.ok, false);
});

test("aceita Sao Jose SC presencial", () => {
  const r = match(
    job({ title: "Dev Node Júnior", location: "São José, SC (presencial)" }),
  );
  assert.equal(r.ok, true);
});

test("rejeita presencial em outra cidade", () => {
  const r = match(
    job({ title: "Dev Node Júnior", location: "Curitiba, PR (presencial)" }),
  );
  assert.equal(r.ok, false);
});

test("rejeita remoto us only", () => {
  const r = match(
    job({ title: "Node Developer", location: "Remote — US only", description: "Node" }),
  );
  assert.equal(r.ok, false);
});

test("aceita remoto brasil", () => {
  const r = match(
    job({ title: "Desenvolvedor Node", location: "Remoto", description: "Node e Postgres" }),
  );
  assert.equal(r.ok, true);
  assert.equal(r.locationConfidence, "remote");
});

test("rejeita sem sinal de stack", () => {
  const r = match(job({ title: "Solidity Engineer", location: "Remoto" }));
  assert.equal(r.ok, false);
});

test("rejeita issue de regras do repo", () => {
  const r = match(
    job({ title: "Regras para divulgação de vagas", location: "", description: "" }),
  );
  assert.equal(r.ok, false);
});

test("aceita typescript", () => {
  const r = match(job({ title: "Desenvolvedor TypeScript", location: "Remoto" }));
  assert.equal(r.ok, true);
});
