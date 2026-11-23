#!/usr/bin/env node
/**
 * generar_corpus.mjs
 * ---------------------------------------------------------------
 * Genera el corpus paralelo español -> glosa LSM usando EXACTAMENTE el
 * mismo traductor que el widget (web/traductor-lsm.js), para que el
 * dataset y el prototipo nunca diverjan.
 *
 * Entrada : dataset/oraciones_es.csv  (id, dominio, oracion_es, glosa_referencia, fuente_referencia)
 * Salida  : dataset/corpus_paralelo.csv  +  resumen en consola
 *   - glosa_auto        traducción automática
 *   - wer               Word Error Rate a nivel glosa vs referencia (si existe)
 *   - cobertura         % de palabras de contenido con seña en el diccionario
 *   - palabras_sin_sena candidatas a grabar (alimentan el plan de captura)
 *
 * Uso:  node scripts/generar_corpus.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
globalThis.window = {};
require(path.join(BASE, "web", "lsm-diccionario.js"));
const Traductor = require(path.join(BASE, "web", "traductor-lsm.js"));
const tr = new Traductor(globalThis.window.LSM_DICCIONARIO);

function parseCSV(txt) {
  const filas = []; let fila = [], campo = "", q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"' && txt[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') q = false; else campo += c; }
    else if (c === '"') q = true;
    else if (c === ",") { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && txt[i + 1] === "\n") i++; fila.push(campo); filas.push(fila); fila = []; campo = ""; }
    else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  const [cab, ...resto] = filas.filter(f => f.some(x => x !== ""));
  return resto.map(f => Object.fromEntries(cab.map((h, i) => [h, f[i] ?? ""])));
}
const esc = v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);

const filas = parseCSV(fs.readFileSync(path.join(BASE, "dataset", "oraciones_es.csv"), "utf8"));
const salida = [];
const sinSena = new Map();
let totCont = 0, totSena = 0, sumWer = 0, nWer = 0;

for (const f of filas) {
  const res = tr.traducir(f.oracion_es);
  const tokens = res.flatMap(o => o.tokens);
  const glosa = res.map(o => o.glosa).join(" // ");
  const cont = tokens.filter(t => t.regla !== "sujeto-implicito");
  const conSena = cont.filter(t => t.tipo === "sena").length;
  const dts = cont.filter(t => t.tipo === "dactilologia");
  dts.forEach(t => sinSena.set(t.original.toLowerCase(), (sinSena.get(t.original.toLowerCase()) || 0) + 1));
  totCont += cont.length; totSena += conSena;
  let wer = "";
  if (f.glosa_referencia) {
    wer = Traductor.wer(glosa.replace(/ \/\/ /g, " "), f.glosa_referencia);
    sumWer += wer; nWer++;
    wer = wer.toFixed(3);
  }
  salida.push({
    id: f.id, dominio: f.dominio, oracion_es: f.oracion_es, glosa_auto: glosa,
    glosa_referencia: f.glosa_referencia, fuente_referencia: f.fuente_referencia || "",
    wer, n_tokens: cont.length, n_senas: conSena, n_dactilologia: dts.length,
    cobertura: cont.length ? (conSena / cont.length).toFixed(3) : "1.000",
    palabras_sin_sena: dts.map(t => t.original).join("|"),
    reglas: tokens.map(t => `${t.glosa}:${t.regla}`).join(" "),
    estado: f.glosa_referencia ? (f.fuente_referencia === "interprete" ? "validada" : "referencia-propuesta") : "pendiente-interprete",
  });
}

const cols = Object.keys(salida[0]);
fs.writeFileSync(path.join(BASE, "dataset", "corpus_paralelo.csv"),
  [cols.join(","), ...salida.map(r => cols.map(c => esc(r[c])).join(","))].join("\n") + "\n");
const top = [...sinSena.entries()].sort((a, b) => b[1] - a[1]);
fs.writeFileSync(path.join(BASE, "dataset", "palabras_sin_sena.csv"),
  "palabra,frecuencia\n" + top.map(([p, n]) => `${esc(p)},${n}`).join("\n") + "\n");

console.log(`Oraciones: ${salida.length}`);
console.log(`Cobertura léxica: ${(100 * totSena / totCont).toFixed(1)} % (${totSena}/${totCont} palabras de contenido con seña)`);
console.log(`WER medio vs referencia (${nWer} oraciones): ${nWer ? (sumWer / nWer).toFixed(3) : "n/a"}`);
console.log(`Palabras sin seña (prioridad de grabación): ${top.slice(0, 12).map(([p, n]) => `${p}(${n})`).join(", ")}`);
