#!/usr/bin/env node
/**
 * generar_dataset_prueba.mjs
 * ---------------------------------------------------------------------------
 * Genera un DATASET DE PRUEBA de LSM continua a partir de frases en español:
 *
 *   frase ──traducir()──► glosas ──construirSecuencia()──► frames (keypoints)
 *         ──aumentar()──► 5 "señantes" simulados ──► muestras etiquetadas
 *
 * Cada muestra incluye:
 *   - frames:          [T x 108] keypoints + rasgos no manuales (formato.js)
 *   - etiquetas_frame: la glosa de cada frame ("HOLA", "<trans>", "DT-M"...)
 *   - segmentos:       [{glosa, inicio, fin}] tramos continuos de una etiqueta
 *
 * Sirve para PROBAR el pipeline de un reconocedor (formato, cargadores,
 * métricas). Es SINTÉTICO: no mide la precisión real del reconocimiento.
 *
 * Salida (dataset/prueba/):
 *   muestras/<F##_S##>.json   frases.csv   indice.csv   segmentos.csv
 *
 * Uso:  node scripts/generar_dataset_prueba.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { traducir } from "../app/src/lib/traductor.js";
import { construirSecuencia, frameDeReposo, mezclarFrames } from "../app/src/lib/secuencia.js";
import { NUM_COORDENADAS, NUM_NO_MANUALES, TOTAL_PUNTOS } from "../app/src/lib/formato.js";
import { RUTAS, cargarDiccionario, escribirCSV } from "./utilidades.mjs";

/* ------------------------------------------------------------------------- */
/* Configuración                                                             */
/* ------------------------------------------------------------------------- */

/** Frases de prueba. Agrega aquí las que quieras. */
const FRASES = [
  { id: "F01", texto: "Hola, buenos días. ¿Cómo estás?" },
  { id: "F02", texto: "Me llamo Marlon, mucho gusto." },
  { id: "F03", texto: "¿Dónde puedo hacer mi trámite? Gracias, hasta luego." },
];

/**
 * "Señantes" simulados (aumento de datos). Cada uno cambia:
 *   velocidad     ritmo (1.2 = 20 % más rápido → menos frames)
 *   escala        tamaño del cuerpo en el encuadre
 *   dx, dy        desplazamiento en el encuadre (unidades 0..1000)
 *   amplitud      qué tan amplios son los movimientos de los brazos
 *   ruido         temblor aleatorio (desviación estándar, unidades 0..1000)
 *   expresividad  intensidad de la cara (cejas, boca, cabeza)
 */
const SENANTES = [
  { id: "S01", velocidad: 1.0, escala: 1.0, dx: 0, dy: 0, amplitud: 1.0, ruido: 0.0, expresividad: 1.0 },
  { id: "S02", velocidad: 0.85, escala: 1.05, dx: -12, dy: 6, amplitud: 1.08, ruido: 2.0, expresividad: 1.2 },
  { id: "S03", velocidad: 1.2, escala: 0.95, dx: 10, dy: -4, amplitud: 0.92, ruido: 2.5, expresividad: 0.8 },
  { id: "S04", velocidad: 1.1, escala: 1.02, dx: 5, dy: 10, amplitud: 1.0, ruido: 3.0, expresividad: 1.0 },
  { id: "S05", velocidad: 0.92, escala: 0.98, dx: -6, dy: -8, amplitud: 1.05, ruido: 1.5, expresividad: 0.9 },
];

/** Posición de los hombros (centro de la amplitud de cada brazo). */
const HOMBRO_DERECHO = [380, 420];
const HOMBRO_IZQUIERDO = [620, 420];

/* ------------------------------------------------------------------------- */
/* Números aleatorios reproducibles                                          */
/* ------------------------------------------------------------------------- */

/**
 * Generador pseudoaleatorio con semilla (congruencial lineal): con la misma
 * semilla siempre da la misma secuencia, así el dataset es reproducible.
 */
function crearAleatorio(semilla) {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado * 1664525 + 1013904223) >>> 0;
    return estado / 4294967296; // número entre 0 y 1
  };
}

/** Número con distribución normal (media 0, desviación 1) — Box-Muller. */
function gaussiano(aleatorio) {
  const u = Math.max(aleatorio(), 1e-9);
  const v = aleatorio();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* ------------------------------------------------------------------------- */
/* Aumento de datos                                                          */
/* ------------------------------------------------------------------------- */

/** ¿El punto j pertenece a un brazo o a una mano (y no a nariz/hombros/caderas)? */
function esBrazoOMano(j) {
  return j >= 3 && j !== 7 && j !== 8;
}

/** ¿El punto j es del lado derecho del señante (codo/muñeca D o mano D)? */
function esLadoDerecho(j) {
  return j === 3 || j === 5 || (j >= 9 && j < 30);
}

/**
 * Aplica las variaciones de un señante a una secuencia.
 * @param frames  [{ f, glosa }]
 * @param p       parámetros del señante (ver SENANTES)
 * @param semilla para el ruido
 */
function aumentar(frames, p, semilla) {
  const aleatorio = crearAleatorio(semilla);

  // 1) RITMO: remuestreo temporal con interpolación lineal
  const total = Math.max(2, Math.round(frames.length / p.velocidad));
  const remuestreados = [];
  for (let k = 0; k < total; k++) {
    const posicion = (k * (frames.length - 1)) / (total - 1);
    const i = Math.floor(posicion);
    const t = posicion - i;
    const a = frames[i];
    const b = frames[Math.min(i + 1, frames.length - 1)];
    remuestreados.push({
      f: mezclarFrames(a.f, b.f, t),
      glosa: t < 0.5 ? a.glosa : b.glosa, // etiqueta del frame más cercano
    });
  }

  // 2) ESPACIO y CARA
  return remuestreados.map(({ f, glosa }) => {
    const nuevo = f.slice();

    for (let j = 0; j < TOTAL_PUNTOS; j++) {
      const ix = 2 * j;
      const iy = ix + 1;
      if (nuevo[ix] < 0) continue; // punto no detectado
      let x = nuevo[ix];
      let y = nuevo[iy];

      // amplitud: alejar/acercar brazos y manos respecto a su hombro
      if (esBrazoOMano(j)) {
        const hombro = esLadoDerecho(j) ? HOMBRO_DERECHO : HOMBRO_IZQUIERDO;
        x = hombro[0] + (x - hombro[0]) * p.amplitud;
        y = hombro[1] + (y - hombro[1]) * p.amplitud;
      }

      // escala + desplazamiento + temblor
      x = 500 + (x - 500) * p.escala + p.dx + gaussiano(aleatorio) * p.ruido;
      y = 420 + (y - 420) * p.escala + p.dy + gaussiano(aleatorio) * p.ruido;
      nuevo[ix] = Math.round(x);
      nuevo[iy] = Math.round(y);
    }

    // expresividad facial (respetando el rango de cada canal)
    for (let k = 0; k < NUM_NO_MANUALES; k++) {
      const minimo = k <= 2 ? 0 : -100; // cejas y boca: 0..100; resto: -100..100
      const valor = nuevo[NUM_COORDENADAS + k] * p.expresividad;
      nuevo[NUM_COORDENADAS + k] = Math.round(Math.max(minimo, Math.min(100, valor)));
    }

    return { f: nuevo, glosa };
  });
}

/** Agrupa las etiquetas por frame en tramos continuos [inicio, fin]. */
function calcularSegmentos(etiquetas) {
  const segmentos = [];
  etiquetas.forEach((glosa, i) => {
    const ultimo = segmentos[segmentos.length - 1];
    if (ultimo && ultimo.glosa === glosa) ultimo.fin = i;
    else segmentos.push({ glosa, inicio: i, fin: i });
  });
  return segmentos;
}

/** Tipo de segmento para el CSV. */
function tipoDeEtiqueta(glosa) {
  if (glosa.startsWith("<")) return "no-seña";
  if (glosa.startsWith("DT-")) return "dactilologia";
  return "seña";
}

/* ------------------------------------------------------------------------- */
/* Programa principal                                                        */
/* ------------------------------------------------------------------------- */

const diccionario = cargarDiccionario();
const fps = diccionario.fps || 15;
const reposo = frameDeReposo(diccionario);
fs.mkdirSync(path.join(RUTAS.prueba, "muestras"), { recursive: true });

const filasFrases = [];
const filasIndice = [];
const filasSegmentos = [];

FRASES.forEach((frase, indiceFrase) => {
  // Traducir y construir la secuencia "limpia" (sin aumento)
  const oraciones = traducir(frase.texto, diccionario);
  const glosa = oraciones.map((o) => o.glosa).join(" // ");
  const secuenciaBase = construirSecuencia(oraciones, diccionario, { reposo }).frames.map((x) => ({
    f: x.f,
    glosa: x.glosa,
  }));

  // ¿Las señas usadas son sintéticas o capturadas?
  const origenes = new Set(
    oraciones
      .flatMap((o) => o.tokens)
      .filter((t) => t.tipo === "sena")
      .map((t) => diccionario.glosas[t.glosa].origen)
  );
  filasFrases.push({ frase_id: frase.id, texto_es: frase.texto, glosa, origen_senas: [...origenes].join("|") });

  // Una muestra por señante simulado
  SENANTES.forEach((senante, indiceSenante) => {
    const semilla = 1000 * (indiceFrase + 1) + indiceSenante;
    const frames = aumentar(secuenciaBase, senante, semilla);
    const etiquetas = frames.map((x) => x.glosa);
    const segmentos = calcularSegmentos(etiquetas);
    const id = `${frase.id}_${senante.id}`;

    const muestra = {
      id,
      frase_id: frase.id,
      frase: frase.texto,
      glosa,
      senante: senante.id,
      parametros: senante,
      fps,
      formato:
        "frame = 51 puntos (x,y) 0..1000 [9 pose, 21 mano D, 21 mano I] + 6 NM " +
        "[cejas_arriba, cejas_fruncidas, boca_abierta, sonrisa, giro, asentir]",
      sintetico: true,
      n_frames: frames.length,
      frames: frames.map((x) => x.f),
      etiquetas_frame: etiquetas,
      segmentos,
    };
    fs.writeFileSync(path.join(RUTAS.prueba, "muestras", `${id}.json`), JSON.stringify(muestra));

    const numeroSenas = segmentos.filter((s) => !s.glosa.startsWith("<")).length;
    filasIndice.push({
      id,
      frase_id: frase.id,
      texto_es: frase.texto,
      glosa,
      senante: senante.id,
      velocidad: senante.velocidad,
      n_frames: frames.length,
      duracion_s: (frames.length / fps).toFixed(2),
      n_senas: numeroSenas,
    });
    for (const s of segmentos) {
      filasSegmentos.push({
        id,
        etiqueta: s.glosa,
        inicio: s.inicio,
        fin: s.fin,
        n_frames: s.fin - s.inicio + 1,
        tipo: tipoDeEtiqueta(s.glosa),
      });
    }
  });
});

escribirCSV(path.join(RUTAS.prueba, "frases.csv"), ["frase_id", "texto_es", "glosa", "origen_senas"], filasFrases);
escribirCSV(
  path.join(RUTAS.prueba, "indice.csv"),
  ["id", "frase_id", "texto_es", "glosa", "senante", "velocidad", "n_frames", "duracion_s", "n_senas"],
  filasIndice
);
escribirCSV(
  path.join(RUTAS.prueba, "segmentos.csv"),
  ["id", "etiqueta", "inicio", "fin", "n_frames", "tipo"],
  filasSegmentos
);

console.log(`Frases: ${FRASES.length} · Señantes simulados: ${SENANTES.length} · Muestras: ${filasIndice.length}`);
for (const f of filasFrases) console.log(`  ${f.frase_id}  ${f.texto_es}\n        → ${f.glosa}`);
console.log(`Frames totales: ${filasIndice.reduce((suma, r) => suma + r.n_frames, 0)} · Salida: dataset/prueba/`);
