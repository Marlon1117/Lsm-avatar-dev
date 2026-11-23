/**
 * manos.js — Dibuja una mano a partir de sus 21 puntos (formato MediaPipe).
 *
 *   0 = muñeca · 1-4 pulgar · 5-8 índice · 9-12 medio · 13-16 anular · 17-20 meñique
 */

import { PIEL, tono } from "./colores.js";

/** Orden de dibujo: del meñique al índice, y el pulgar al final (queda encima). */
const DEDOS_EN_ORDEN = [
  { puntos: [17, 18, 19, 20], grosor: 0.0135 }, // meñique
  { puntos: [13, 14, 15, 16], grosor: 0.0158 }, // anular
  { puntos: [9, 10, 11, 12], grosor: 0.0158 }, //  medio
  { puntos: [5, 6, 7, 8], grosor: 0.0158 }, //     índice
  { puntos: [1, 2, 3, 4], grosor: 0.019 }, //      pulgar
];

/**
 * @param g       geometría del frame (ver avatar/index.js)
 * @param puntos  arreglo de 21 puntos [x, y] en píxeles (o null si no se ve)
 * @param codo    punto del codo de ese brazo (para orientar el puño de la manga)
 */
export function dibujarMano(g, puntos, codo) {
  const { ctx, u, ropa } = g;
  const muneca = puntos[0];
  if (!muneca) return; // mano no detectada

  // 1) Muñeca: piel que sale de la manga hasta la mitad de la palma
  ctx.strokeStyle = PIEL.base;
  ctx.lineWidth = 0.03 * u;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(muneca[0], muneca[1]);
  ctx.lineTo((muneca[0] + puntos[9][0]) / 2, (muneca[1] + puntos[9][1]) / 2);
  ctx.stroke();

  // 2) Palma: polígono muñeca → base del pulgar → nudillos
  const degradado = ctx.createLinearGradient(muneca[0], muneca[1], puntos[9][0], puntos[9][1]);
  degradado.addColorStop(0, PIEL.sombra);
  degradado.addColorStop(0.5, PIEL.base);
  degradado.addColorStop(1, PIEL.luz);
  ctx.fillStyle = degradado;
  ctx.strokeStyle = PIEL.linea;
  ctx.lineWidth = 0.0025 * u;
  ctx.lineJoin = "round";
  ctx.beginPath();
  [0, 1, 2, 5, 9, 13, 17].forEach((indice, k) => {
    const p = puntos[indice];
    if (!p) return;
    if (k === 0) ctx.moveTo(p[0], p[1]);
    else ctx.lineTo(p[0], p[1]);
  });
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 3) Dedos: 3 falanges cada uno, cada vez más delgadas, con contorno
  for (const dedo of DEDOS_EN_ORDEN) {
    const grosorBase = dedo.grosor * u;
    for (let falange = 0; falange < 3; falange++) {
      const a = puntos[dedo.puntos[falange]];
      const b = puntos[dedo.puntos[falange + 1]];
      if (!a || !b) continue;
      const grosor = grosorBase * (1 - falange * 0.12);

      ctx.strokeStyle = PIEL.linea; // contorno
      ctx.lineWidth = grosor + 0.003 * u;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();

      ctx.strokeStyle = falange === 2 ? PIEL.luz : PIEL.base; // relleno
      ctx.lineWidth = grosor;
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }

    // Uña: pequeña elipse clara orientada como la última falange
    const punta = puntos[dedo.puntos[3]];
    const previa = puntos[dedo.puntos[2]];
    if (punta && previa) {
      const angulo = Math.atan2(punta[1] - previa[1], punta[0] - previa[0]);
      ctx.fillStyle = "rgba(255,226,210,.85)";
      ctx.beginPath();
      ctx.ellipse(
        punta[0] - Math.cos(angulo) * 0.003 * u,
        punta[1] - Math.sin(angulo) * 0.003 * u,
        0.0042 * u,
        0.0032 * u,
        angulo,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  }

  // 4) Puño de la manga, orientado en la dirección codo → muñeca
  if (codo) {
    const angulo = Math.atan2(muneca[1] - codo[1], muneca[0] - codo[0]);
    ctx.strokeStyle = tono(ropa, -0.2);
    ctx.lineWidth = 0.05 * u;
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.moveTo(muneca[0] - Math.cos(angulo) * 0.028 * u, muneca[1] - Math.sin(angulo) * 0.028 * u);
    ctx.lineTo(muneca[0] - Math.cos(angulo) * 0.012 * u, muneca[1] - Math.sin(angulo) * 0.012 * u);
    ctx.stroke();
    ctx.lineCap = "round";
  }
}
