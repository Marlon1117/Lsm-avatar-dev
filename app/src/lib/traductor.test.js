/**
 * traductor.test.js — Pruebas del traductor (se ejecutan con `npm test`).
 *
 * Cada prueba documenta una regla con un ejemplo. Si cambias una regla y
 * una prueba falla, revisa si el cambio fue intencional.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { traducir, lematizar, deletrear, wer } from "./traductor.js";

const diccionario = JSON.parse(fs.readFileSync(new URL("../../public/lsm-diccionario.json", import.meta.url)));
const glosas = (texto) => traducir(texto, diccionario).map((o) => o.glosa);

test("expresiones multipalabra y dactilología", () => {
  assert.deepEqual(glosas("Hola, me llamo Marlon."), ["HOLA YO NOMBRE DT(M-A-R-L-O-N)"]);
});

test("varias oraciones y pregunta con interrogativo al final", () => {
  assert.deepEqual(glosas("Hola, buenos días. ¿Cómo estás?"), ["HOLA BUENO DÍA", "TÚ CÓMO ?"]);
});

test("palabras vacías se eliminan", () => {
  assert.deepEqual(glosas("Bienvenidos al portal de trámites del gobierno."), [
    "BIENVENIDO PÁGINA TRÁMITE GOBIERNO",
  ]);
});

test("sujeto implícito y negación al final", () => {
  assert.deepEqual(glosas("No tengo el documento."), ["YO TENER DOCUMENTO NO"]);
});

test("tiempo al inicio", () => {
  assert.deepEqual(glosas("Yo sé que él trabaja aquí hoy."), ["HOY YO SABER ÉL TRABAJAR AQUÍ"]);
});

test("lematización de verbos y plurales", () => {
  assert.equal(lematizar("necesitas", diccionario.lexico).glosa, "NECESITAR");
  assert.equal(lematizar("documentos", diccionario.lexico).glosa, "DOCUMENTO");
  assert.equal(lematizar("ayudarte", diccionario.lexico).glosa, "AYUDAR");
  assert.equal(lematizar("xyzabc", diccionario.lexico), null);
});

test("deletrear conserva la Ñ y quita acentos", () => {
  assert.deepEqual(deletrear("Año"), ["A", "Ñ", "O"]);
  assert.deepEqual(deletrear("Xalapa"), ["X", "A", "L", "A", "P", "A"]);
});

test("WER", () => {
  assert.equal(wer("HOLA YO", "HOLA YO"), 0);
  assert.equal(wer("HOLA", "HOLA YO"), 0.5);
});
