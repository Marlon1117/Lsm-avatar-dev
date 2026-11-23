#!/usr/bin/env node
/**
 * generar_corpus.mjs
 * ---------------------------------------------------------------------------
 * Genera el CORPUS PARALELO español → glosa LSM y sus métricas.
 *
 * Usa exactamente el mismo traductor que la app de React
 * (app/src/lib/traductor.js), así el dataset y la demo nunca se contradicen.
 *
 * Entrada:  dataset/oraciones_es.csv
 *           columnas: id, dominio, oracion_es, glosa_referencia, fuente_referencia
 *           (glosa_referencia la escribe un intérprete; puede ir vacía)
 *
 * Salida:   dataset/corpus_paralelo.csv   una fila por oración con:
 *             glosa_auto       traducción automática
 *             wer              error contra la referencia (si existe)
 *             cobertura        % de palabras que sí tienen seña
 *             palabras_sin_sena  las que se deletrearon
 *           dataset/palabras_sin_sena.csv  ranking de palabras a grabar primero
 *
 * Uso:      node scripts/generar_corpus.mjs
 */

import path from "node:path";
import { traducir, wer } from "../app/src/lib/traductor.js";
import { RUTAS, cargarDiccionario, leerCSV, escribirCSV } from "./utilidades.mjs";

const diccionario = cargarDiccionario();
const oraciones = leerCSV(path.join(RUTAS.dataset, "oraciones_es.csv"));

const filasCorpus = [];
const conteoSinSena = new Map(); // palabra → veces que se deletreó
let palabrasDeContenido = 0;
let palabrasConSena = 0;
let sumaWer = 0;
let oracionesConReferencia = 0;

for (const fila of oraciones) {
  // 1) Traducir (puede salir más de una oración si el texto tiene varios puntos)
  const resultado = traducir(fila.oracion_es, diccionario);
  const tokens = resultado.flatMap((o) => o.tokens);
  const glosaAuto = resultado.map((o) => o.glosa).join(" // ");

  // 2) Cobertura: no contamos los pronombres que el traductor agregó solo
  const deContenido = tokens.filter((t) => t.regla !== "sujeto-implicito");
  const conSena = deContenido.filter((t) => t.tipo === "sena");
  const deletreadas = deContenido.filter((t) => t.tipo === "dactilologia");

  for (const t of deletreadas) {
    const palabra = t.original.toLowerCase();
    conteoSinSena.set(palabra, (conteoSinSena.get(palabra) || 0) + 1);
  }
  palabrasDeContenido += deContenido.length;
  palabrasConSena += conSena.length;

  // 3) WER contra la glosa del intérprete (si ya la escribió)
  let valorWer = "";
  if (fila.glosa_referencia) {
    const error = wer(glosaAuto.replace(/ \/\/ /g, " "), fila.glosa_referencia);
    sumaWer += error;
    oracionesConReferencia += 1;
    valorWer = error.toFixed(3);
  }

  // 4) Estado de la oración
  let estado = "pendiente-interprete";
  if (fila.glosa_referencia) {
    estado = fila.fuente_referencia === "interprete" ? "validada" : "referencia-propuesta";
  }

  filasCorpus.push({
    id: fila.id,
    dominio: fila.dominio,
    oracion_es: fila.oracion_es,
    glosa_auto: glosaAuto,
    glosa_referencia: fila.glosa_referencia,
    fuente_referencia: fila.fuente_referencia || "",
    wer: valorWer,
    n_tokens: deContenido.length,
    n_senas: conSena.length,
    n_dactilologia: deletreadas.length,
    cobertura: deContenido.length ? (conSena.length / deContenido.length).toFixed(3) : "1.000",
    palabras_sin_sena: deletreadas.map((t) => t.original).join("|"),
    reglas: tokens.map((t) => `${t.glosa}:${t.regla}`).join(" "),
    estado,
  });
}

// --- Guardar archivos --------------------------------------------------------
escribirCSV(
  path.join(RUTAS.dataset, "corpus_paralelo.csv"),
  Object.keys(filasCorpus[0]),
  filasCorpus
);

const ranking = [...conteoSinSena.entries()]
  .sort((a, b) => b[1] - a[1])
  .map(([palabra, frecuencia]) => ({ palabra, frecuencia }));
escribirCSV(path.join(RUTAS.dataset, "palabras_sin_sena.csv"), ["palabra", "frecuencia"], ranking);

// --- Resumen ------------------------------------------------------------------
const cobertura = (100 * palabrasConSena) / palabrasDeContenido;
console.log(`Oraciones: ${filasCorpus.length}`);
console.log(`Cobertura léxica: ${cobertura.toFixed(1)} % (${palabrasConSena}/${palabrasDeContenido} palabras con seña)`);
console.log(
  `WER medio vs referencia (${oracionesConReferencia} oraciones): ` +
    (oracionesConReferencia ? (sumaWer / oracionesConReferencia).toFixed(3) : "n/a")
);
console.log(
  "Palabras sin seña (prioridad de grabación): " +
    ranking.slice(0, 12).map((r) => `${r.palabra}(${r.frecuencia})`).join(", ")
);
