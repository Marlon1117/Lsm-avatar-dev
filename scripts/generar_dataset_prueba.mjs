#!/usr/bin/env node
/**
 * generar_dataset_prueba.mjs
 * ---------------------------------------------------------------
 * Dataset de PRUEBA de LSM continua generado a partir de frases:
 *
 *   frase en español ──traductor──► glosas ──secuenciador──► keypoints
 *   ──aumento de datos (5 "señantes" simulados)──► muestras etiquetadas
 *
 * Cada muestra trae los frames (102 coordenadas + 6 canales no manuales),
 * la etiqueta de glosa POR FRAME y los segmentos [inicio, fin] de cada seña,
 * listos para probar un reconocedor continuo (p. ej. CTC o segmentación).
 *
 * Salida en dataset/prueba/:
 *   muestras/<F##_S##>.json   indice.csv   segmentos.csv   frases.csv
 *
 * IMPORTANTE: es un dataset SINTÉTICO para probar el pipeline (formato,
 * cargadores, métricas). No sustituye grabaciones reales de señantes.
 *
 * Uso:  node scripts/generar_dataset_prueba.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
globalThis.window = {};
require(path.join(BASE, "web", "lsm-diccionario.js"));
const DIC = globalThis.window.LSM_DICCIONARIO;
const Traductor = require(path.join(BASE, "web", "traductor-lsm.js"));
const Sec = require(path.join(BASE, "web", "secuencia-lsm.js"));
const tr = new Traductor(DIC);

// ---------------- Frases de prueba ----------------
const FRASES = [
  { id: "F01", texto: "Hola, buenos días. ¿Cómo estás?" },
  { id: "F02", texto: "Me llamo Marlon, mucho gusto." },
  { id: "F03", texto: "¿Dónde puedo hacer mi trámite? Gracias, hasta luego." },
];

// ---------------- Señantes simulados ----------------
// Variación de ritmo, tamaño/encuadre, amplitud, temblor y expresividad facial.
const SENANTES = [
  { id: "S01", velocidad: 1.00, escala: 1.00, dx: 0, dy: 0, amplitud: 1.00, ruido: 0.0, expresividad: 1.00 },
  { id: "S02", velocidad: 0.85, escala: 1.05, dx: -12, dy: 6, amplitud: 1.08, ruido: 2.0, expresividad: 1.20 },
  { id: "S03", velocidad: 1.20, escala: 0.95, dx: 10, dy: -4, amplitud: 0.92, ruido: 2.5, expresividad: 0.80 },
  { id: "S04", velocidad: 1.10, escala: 1.02, dx: 5, dy: 10, amplitud: 1.00, ruido: 3.0, expresividad: 1.00 },
  { id: "S05", velocidad: 0.92, escala: 0.98, dx: -6, dy: -8, amplitud: 1.05, ruido: 1.5, expresividad: 0.90 },
];

// PRNG determinista (reproducible)
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function gauss(r) { const u = Math.max(r(), 1e-9), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

function reposo() {
  const f = Sec.normalizar(DIC.glosas.HOLA.frames[0].slice());
  for (let i = Sec.NC; i < Sec.LARGO; i++) f[i] = 0;
  return f;
}

function aumentar(frames, p, seed) {
  const r = rng(seed);
  // 1) ritmo: remuestreo temporal
  const n = Math.max(2, Math.round(frames.length / p.velocidad));
  const out = [];
  for (let k = 0; k < n; k++) {
    const x = (k * (frames.length - 1)) / (n - 1), i = Math.floor(x), t = x - i;
    const a = frames[i], b = frames[Math.min(i + 1, frames.length - 1)];
    out.push({ f: Sec.mezcla(a.f, b.f, t), glosa: t < 0.5 ? a.glosa : b.glosa });
  }
  // 2) espacio: amplitud alrededor del hombro, escala/encuadre y temblor
  const HD = [380, 420], HI = [620, 420];
  return out.map(({ f, glosa }) => {
    const g = f.slice();
    for (let j = 0; j < 51; j++) {
      const ix = 2 * j, iy = ix + 1;
      if (g[ix] < 0) continue;
      let x = g[ix], y = g[iy];
      if (j >= 3 && j !== 7 && j !== 8) { // brazos y manos: amplitud del gesto
        const h = (j === 3 || j === 5 || (j >= 9 && j < 30)) ? HD : HI;
        x = h[0] + (x - h[0]) * p.amplitud; y = h[1] + (y - h[1]) * p.amplitud;
      }
      x = 500 + (x - 500) * p.escala + p.dx + gauss(r) * p.ruido;
      y = 420 + (y - 420) * p.escala + p.dy + gauss(r) * p.ruido;
      g[ix] = Math.round(x); g[iy] = Math.round(y);
    }
    for (let k = 0; k < 6; k++) {
      const lim = k === 0 || k === 1 || k === 2 ? [0, 100] : [-100, 100];
      g[Sec.NC + k] = Math.round(Math.max(lim[0], Math.min(lim[1], g[Sec.NC + k] * p.expresividad)));
    }
    return { f: g, glosa };
  });
}

function segmentos(etiquetas) {
  const seg = [];
  etiquetas.forEach((g, i) => {
    const ult = seg[seg.length - 1];
    if (ult && ult.glosa === g) ult.fin = i; else seg.push({ glosa: g, inicio: i, fin: i });
  });
  return seg;
}

const SAL = path.join(BASE, "dataset", "prueba");
fs.mkdirSync(path.join(SAL, "muestras"), { recursive: true });
const esc = v => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
const indice = [], segs = [], frasesCsv = [];
const fps = DIC.fps || 15;

FRASES.forEach((fr, fi) => {
  const oraciones = tr.traducir(fr.texto);
  const glosa = oraciones.map(o => o.glosa).join(" // ");
  const base = Sec.construir(oraciones, DIC, { reposo: reposo() }).frames.map(x => ({ f: x.f, glosa: x.glosa }));
  const origenes = [...new Set(oraciones.flatMap(o => o.tokens).filter(t => t.tipo === "sena").map(t => DIC.glosas[t.glosa].origen))];
  frasesCsv.push([fr.id, fr.texto, glosa, origenes.join("|")]);
  SENANTES.forEach((p, si) => {
    const fs_ = aumentar(base, p, 1000 * (fi + 1) + si);
    const etiquetas = fs_.map(x => x.glosa);
    const sg = segmentos(etiquetas);
    const id = `${fr.id}_${p.id}`;
    const muestra = {
      id, frase_id: fr.id, frase: fr.texto, glosa, senante: p.id, parametros: p, fps,
      formato: "frame = 51 puntos (x,y) 0..1000 [9 pose, 21 mano D, 21 mano I] + 6 NM [cejas_arriba, cejas_fruncidas, boca_abierta, sonrisa, giro, asentir]",
      sintetico: true,
      n_frames: fs_.length, frames: fs_.map(x => x.f), etiquetas_frame: etiquetas, segmentos: sg,
    };
    fs.writeFileSync(path.join(SAL, "muestras", id + ".json"), JSON.stringify(muestra));
    const nGl = sg.filter(s => !s.glosa.startsWith("<")).length;
    indice.push([id, fr.id, fr.texto, glosa, p.id, p.velocidad, fs_.length, (fs_.length / fps).toFixed(2), nGl]);
    sg.forEach(s => segs.push([id, s.glosa, s.inicio, s.fin, s.fin - s.inicio + 1, s.glosa.startsWith("<") ? "no-seña" : s.glosa.startsWith("DT-") ? "dactilologia" : "seña"]));
  });
});

const csv = (cab, filas) => [cab.join(","), ...filas.map(r => r.map(esc).join(","))].join("\n") + "\n";
fs.writeFileSync(path.join(SAL, "frases.csv"), csv(["frase_id", "texto_es", "glosa", "origen_senas"], frasesCsv));
fs.writeFileSync(path.join(SAL, "indice.csv"), csv(["id", "frase_id", "texto_es", "glosa", "senante", "velocidad", "n_frames", "duracion_s", "n_senas"], indice));
fs.writeFileSync(path.join(SAL, "segmentos.csv"), csv(["id", "etiqueta", "inicio", "fin", "n_frames", "tipo"], segs));

console.log(`Frases: ${FRASES.length} · Señantes simulados: ${SENANTES.length} · Muestras: ${indice.length}`);
frasesCsv.forEach(([id, t, g]) => console.log(`  ${id}  ${t}\n        → ${g}`));
console.log(`Frames totales: ${indice.reduce((a, r) => a + r[6], 0)} · Salida: ${path.relative(BASE, SAL)}/`);
