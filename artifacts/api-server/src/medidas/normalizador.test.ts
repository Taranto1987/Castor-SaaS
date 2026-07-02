import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarMedida } from "./normalizador";

test("88x188 → 88x188", () => {
  assert.deepEqual(normalizarMedida("88x188"), { medida: "88x188", largura: 88, comprimento: 188 });
});

test("0,88x1,88 (metros com vírgula) → 88x188", () => {
  assert.deepEqual(normalizarMedida("0,88x1,88"), { medida: "88x188", largura: 88, comprimento: 188 });
});

test("0.88x1.88 (metros com ponto) → 88x188", () => {
  assert.deepEqual(normalizarMedida("0.88x1.88"), { medida: "88x188", largura: 88, comprimento: 188 });
});

test("88X188 (X maiúsculo) → 88x188", () => {
  assert.deepEqual(normalizarMedida("88X188"), { medida: "88x188", largura: 88, comprimento: 188 });
});

test("88x188x30 (altura descartada) → 88x188", () => {
  assert.deepEqual(normalizarMedida("88x188x30"), { medida: "88x188", largura: 88, comprimento: 188 });
});

test("188x88 (invertido) → 88x188", () => {
  assert.deepEqual(normalizarMedida("188x88"), { medida: "88x188", largura: 88, comprimento: 188 });
});

test("96cm x 203cm (unidade + espaços) → 96x203", () => {
  assert.deepEqual(normalizarMedida("96cm x 203cm"), { medida: "96x203", largura: 96, comprimento: 203 });
});

test("100x200 (medida válida sob encomenda) → 100x200", () => {
  assert.deepEqual(normalizarMedida("100x200"), { medida: "100x200", largura: 100, comprimento: 200 });
});

test("088188 (dígitos colados, sem separador) → null", () => {
  assert.equal(normalizarMedida("088188"), null);
});

test("entrada não-string → null", () => {
  assert.equal(normalizarMedida(undefined), null);
  assert.equal(normalizarMedida(null), null);
  assert.equal(normalizarMedida(88188), null);
});

test("dimensão fora da faixa de sanidade (60–250cm) → null", () => {
  assert.equal(normalizarMedida("30x40"), null); // pequeno demais
  assert.equal(normalizarMedida("300x400"), null); // grande demais
});
