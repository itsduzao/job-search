import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreJob } from "../src/scoring.js";
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

test("score sempre dentro de 1..10", () => {
  const cases: Job[] = [
    job({
      title: "Desenvolvedor Backend Node.js Júnior",
      location: "Remoto",
      description: "Node, Express, TypeScript",
    }),
    job({ title: "Desenvolvedor Node.js Sênior", location: "Remoto" }),
    job({ title: "Analista de dados", location: "", description: "Excel" }),
  ];

  for (const j of cases) {
    const { score } = scoreJob(j);
    assert.ok(score >= 1 && score <= 10, `score ${score} fora do intervalo 1..10`);
  }
});

test("junior + node + local pontua mais que sem sinal/local desconhecido", () => {
  const strong = scoreJob(
    job({
      title: "Desenvolvedor Backend Node.js Júnior",
      location: "Florianópolis, SC",
      description: "Node, Express, TypeScript",
    }),
  );
  const weak = scoreJob(
    job({ title: "Analista de dados", location: "Remoto", description: "Excel" }),
  );

  assert.ok(strong.score > weak.score, `${strong.score} deveria ser maior que ${weak.score}`);
});

test("reasons nao vazio para job forte", () => {
  const result = scoreJob(
    job({
      title: "Desenvolvedor Backend Node.js Júnior",
      location: "Remoto",
      description: "Node e TypeScript",
    }),
  );

  assert.ok(result.reasons.length > 0);
});
