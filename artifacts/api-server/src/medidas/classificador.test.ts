import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classificarPorMedida,
  classificarDeTextoLivre,
  resolverTermoBusca,
} from "./classificador";

test("88x188 → SOLTEIRO, padrão", () => {
  const r = classificarPorMedida("88x188");
  assert.equal(r.ok, true);
  assert.equal(r.categoria, "SOLTEIRO");
  assert.equal(r.status, "padrao");
  assert.equal(r.slug, "solteiro");
});

test("100x200 → ESPECIAL, sob_encomenda (nunca SOLTEIRO)", () => {
  const r = classificarPorMedida("100x200");
  assert.equal(r.ok, true);
  assert.equal(r.categoria, "ESPECIAL");
  assert.equal(r.status, "sob_encomenda");
  assert.notEqual(r.categoria, "SOLTEIRO");
});

test("120x203 → ESPECIAL, sob_encomenda (nunca SOLTEIRO)", () => {
  const r = classificarPorMedida("120x203");
  assert.equal(r.categoria, "ESPECIAL");
  assert.equal(r.status, "sob_encomenda");
});

test('busca "96x203", "solteirão" e "Solteiro King" → mesma categoria SOLTEIRAO', () => {
  const porMedida = resolverTermoBusca("96x203");
  const porAcento = resolverTermoBusca("solteirão");
  const porSinonimo = resolverTermoBusca("Solteiro King");
  assert.equal(porMedida, "SOLTEIRAO");
  assert.equal(porAcento, "SOLTEIRAO");
  assert.equal(porSinonimo, "SOLTEIRAO");
});

test("texto livre com medida ignora a palavra de tamanho no título", () => {
  // Título diz "Solteiro" mas a medida real 88x188 manda — classifica por medida.
  const r = classificarDeTextoLivre("Colchão Castor Gold Star Solteiro 88x188x30 Molas");
  assert.equal(r.ok, true);
  assert.equal(r.categoria, "SOLTEIRO");
});

test('Talib: "quero colchão 100x200" → ESPECIAL sob_encomenda (sem link de produto)', () => {
  const r = classificarDeTextoLivre("quero colchão 100x200");
  assert.equal(r.ok, true);
  assert.equal(r.status, "sob_encomenda");
  assert.equal(r.categoria, "ESPECIAL");
});

test("medida válida mas fora da tabela → NAO_MAPEADA (medida_nao_mapeada)", () => {
  const r = classificarPorMedida("70x140");
  assert.equal(r.ok, false);
  assert.equal(r.categoria, "NAO_MAPEADA");
  assert.equal(r.motivo, "medida_nao_mapeada");
  assert.equal(r.medida, "70x140"); // medida preservada para diagnóstico
});

test("entrada inválida → NAO_MAPEADA (medida_invalida), nunca chute", () => {
  const r = classificarPorMedida("088188");
  assert.equal(r.ok, false);
  assert.equal(r.categoria, "NAO_MAPEADA");
  assert.equal(r.motivo, "medida_invalida");
  assert.equal(r.medida, null);
});

test("texto livre sem nenhuma medida → NAO_MAPEADA (medida_invalida)", () => {
  const r = classificarDeTextoLivre("colchão bom e macio");
  assert.equal(r.ok, false);
  assert.equal(r.categoria, "NAO_MAPEADA");
});

test("termo de busca desconhecido → null (sem chute)", () => {
  assert.equal(resolverTermoBusca("berço"), null);
  assert.equal(resolverTermoBusca(""), null);
});
