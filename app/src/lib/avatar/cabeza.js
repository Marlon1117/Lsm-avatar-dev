/**
 * cabeza.js — Forma de la cabeza, orejas, cabello y rubor de las mejillas.
 *
 * Usa de `g`:
 *   g.hcx, g.hcy  centro de la cabeza (ya incluye giro y asentimiento)
 *   g.dxF, g.dyF  cuánto se desplazan los rasgos al girar / asentir
 *   g.nm          canales no manuales en -1..1 (giro, sonr...)
 */

import { PIEL, ROSTRO } from "./colores.js";

/** Orejas: una elipse en sombra y otra más clara adentro. */
export function dibujarOrejas(g) {
  const { ctx, u, hcx, hcy, nm } = g;
  for (const lado of [-1, 1]) {
    // al girar la cabeza, una oreja se acerca y la otra se aleja
    const desplazamiento = nm.giro * lado * 0.006 * u;

    ctx.fillStyle = PIEL.sombra;
    ctx.beginPath();
    ctx.ellipse(hcx + lado * (0.086 * u - desplazamiento), hcy + 0.004 * u, 0.014 * u, 0.026 * u, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = PIEL.base;
    ctx.beginPath();
    ctx.ellipse(hcx + lado * (0.084 * u - desplazamiento), hcy + 0.004 * u, 0.009 * u, 0.019 * u, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Contorno de la cabeza: cráneo redondo y mandíbula más angosta. */
export function dibujarCara(g) {
  const { ctx, u, hcx, hcy, dxF, dyF } = g;

  // Luz desde arriba a la izquierda (se mueve un poco al girar)
  const degradado = ctx.createRadialGradient(hcx - 0.02 * u + dxF, hcy - 0.03 * u, 0.01 * u, hcx, hcy, 0.12 * u);
  degradado.addColorStop(0, PIEL.luz);
  degradado.addColorStop(0.6, PIEL.base);
  degradado.addColorStop(1, PIEL.sombra);
  ctx.fillStyle = degradado;

  ctx.beginPath();
  ctx.moveTo(hcx, hcy - 0.118 * u); //                                   coronilla
  ctx.bezierCurveTo(hcx + 0.07 * u, hcy - 0.118 * u, hcx + 0.088 * u, hcy - 0.07 * u, hcx + 0.086 * u, hcy - 0.01 * u); // sien
  ctx.bezierCurveTo(hcx + 0.085 * u, hcy + 0.05 * u, hcx + 0.058 * u, hcy + 0.096 * u, hcx + dxF * 0.5, hcy + 0.106 * u + dyF * 0.3); // barbilla
  ctx.bezierCurveTo(hcx - 0.058 * u, hcy + 0.096 * u, hcx - 0.085 * u, hcy + 0.05 * u, hcx - 0.086 * u, hcy - 0.01 * u); // otra sien
  ctx.bezierCurveTo(hcx - 0.088 * u, hcy - 0.07 * u, hcx - 0.07 * u, hcy - 0.118 * u, hcx, hcy - 0.118 * u); // de vuelta
  ctx.closePath();
  ctx.fill();
}

/** Cabello corto con fleco y un brillo. */
export function dibujarCabello(g) {
  const { ctx, u, hcx, hcy, dxF } = g;

  const degradado = ctx.createLinearGradient(0, hcy - 0.13 * u, 0, hcy - 0.03 * u);
  degradado.addColorStop(0, ROSTRO.cabelloOscuro);
  degradado.addColorStop(1, ROSTRO.cabelloClaro);
  ctx.fillStyle = degradado;

  ctx.beginPath();
  ctx.moveTo(hcx - 0.09 * u, hcy - 0.005 * u);
  ctx.bezierCurveTo(hcx - 0.1 * u, hcy - 0.1 * u, hcx - 0.05 * u, hcy - 0.14 * u, hcx + 0.005 * u, hcy - 0.135 * u);
  ctx.bezierCurveTo(hcx + 0.07 * u, hcy - 0.135 * u, hcx + 0.1 * u, hcy - 0.09 * u, hcx + 0.09 * u, hcy - 0.005 * u);
  // línea del fleco (de derecha a izquierda)
  ctx.bezierCurveTo(hcx + 0.083 * u, hcy - 0.05 * u, hcx + 0.075 * u, hcy - 0.065 * u, hcx + 0.06 * u, hcy - 0.075 * u);
  ctx.bezierCurveTo(hcx + 0.02 * u, hcy - 0.06 * u + dxF * 0.2, hcx - 0.03 * u, hcy - 0.085 * u, hcx - 0.07 * u, hcy - 0.065 * u);
  ctx.bezierCurveTo(hcx - 0.08 * u, hcy - 0.05 * u, hcx - 0.085 * u, hcy - 0.03 * u, hcx - 0.09 * u, hcy - 0.005 * u);
  ctx.closePath();
  ctx.fill();

  // Brillo
  ctx.strokeStyle = "rgba(255,255,255,.10)";
  ctx.lineWidth = 0.006 * u;
  ctx.beginPath();
  ctx.moveTo(hcx - 0.05 * u, hcy - 0.115 * u);
  ctx.quadraticCurveTo(hcx, hcy - 0.13 * u, hcx + 0.05 * u, hcy - 0.11 * u);
  ctx.stroke();
}

/** Rubor en las mejillas: más intenso cuanto más sonríe. */
export function dibujarMejillas(g) {
  const { ctx, u, hcx, hcy, dxF, nm } = g;
  const intensidad = 0.1 + 0.22 * Math.max(nm.sonr, 0);
  for (const lado of [-1, 1]) {
    const x = hcx + lado * 0.05 * u + dxF;
    const y = hcy + 0.03 * u;
    const degradado = ctx.createRadialGradient(x, y, 0, x, y, 0.026 * u);
    degradado.addColorStop(0, `rgba(214,110,100,${intensidad})`);
    degradado.addColorStop(1, "rgba(214,110,100,0)");
    ctx.fillStyle = degradado;
    ctx.fillRect(x - 0.03 * u, hcy, 0.06 * u, 0.06 * u);
  }
}
