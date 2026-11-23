/**
 * secuencia.test.js — Pruebas del secuenciador (se ejecutan con `npm test`).
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { traducir } from "./traductor.js";
import { construirSecuencia, frameDeReposo, mezclarFrames, normalizarFrame } from "./secuencia.js";
import { LARGO_FRAME } from "./formato.js";

const diccionario = JSON.parse(fs.readFileSync(new URL("../../public/lsm-diccionario.json", import.meta.url)));

test("todos los frames tienen 108 valores", () => {
  const { frames } = construirSecuencia(traducir("Hola, mucho gusto.", diccionario), diccionario, {
    reposo: frameDeReposo(diccionario),
  });
  assert.ok(frames.length > 0);
  for (const x of frames) assert.equal(x.f.length, LARGO_FRAME);
});

test("hay transiciones entre señas y regreso al reposo", () => {
  const { frames } = construirSecuencia(traducir("Hola, gracias.", diccionario), diccionario, {
    reposo: frameDeReposo(diccionario),
  });
  const etiquetas = new Set(frames.map((x) => x.glosa));
  assert.ok(etiquetas.has("HOLA") && etiquetas.has("GRACIAS"));
  assert.ok(etiquetas.has("<trans>") && etiquetas.has("<reposo>"));
});

test("pregunta sí/no levanta las cejas", () => {
  const { frames } = construirSecuencia(traducir("¿Tienes tu documento?", diccionario), diccionario, {
    reposo: frameDeReposo(diccionario),
  });
  const maximoCejas = Math.max(...frames.map((x) => x.f[102]));
  assert.ok(maximoCejas >= 80);
});

test("mezclar e completar frames", () => {
  const a = new Array(LARGO_FRAME).fill(0);
  const b = new Array(LARGO_FRAME).fill(100);
  assert.equal(mezclarFrames(a, b, 0.5)[0], 50);
  assert.equal(normalizarFrame(new Array(103).fill(1)).length, LARGO_FRAME);
});
