/**
 * cuerpo.js — Fondo, torso, cuello y brazos del avatar.
 *
 * Todas las funciones reciben `g` (la "geometría" del frame actual, armada en
 * avatar/index.js) con:
 *   g.ctx    contexto 2D del canvas
 *   g.u      tamaño de 1 unidad normalizada en píxeles (multiplica por g.u)
 *   g.ropa   color de la ropa
 *   g.pose   puntos de la pose ya convertidos a píxeles
 *   g.cx/cy  centro de la cara
 */

import { PIEL, tono } from "./colores.js";

/** Fondo con degradado radial suave (se dibuja sin transformación). */
export function dibujarFondo(ctx, ancho, alto, colores) {
  const degradado = ctx.createRadialGradient(ancho * 0.5, alto * 0.35, 20, ancho * 0.5, alto * 0.45, ancho * 0.75);
  degradado.addColorStop(0, colores[0]);
  degradado.addColorStop(1, colores[1]);
  ctx.fillStyle = degradado;
  ctx.fillRect(0, 0, ancho, alto);
}

/** Torso: silueta de playera de hombro a cadera, con hombros redondeados. */
export function dibujarTorso(g) {
  const { ctx, u, ropa } = g;
  const { hombroD, hombroI, caderaD, caderaI } = g.pose;
  const cuelloY = (hombroD[1] + hombroI[1]) / 2;

  // Más claro arriba y más oscuro abajo, para dar volumen
  const degradado = ctx.createLinearGradient(0, cuelloY - 20, 0, caderaD[1]);
  degradado.addColorStop(0, tono(ropa, 0.12));
  degradado.addColorStop(1, tono(ropa, -0.25));
  ctx.fillStyle = degradado;

  ctx.beginPath();
  ctx.moveTo(hombroD[0] + 0.02 * u, cuelloY - 0.012 * u);
  // hombro derecho (curva)
  ctx.quadraticCurveTo(hombroD[0] - 0.035 * u, hombroD[1] - 0.012 * u, hombroD[0] - 0.042 * u, hombroD[1] + 0.04 * u);
  // costados hasta la cadera
  ctx.lineTo(caderaD[0] - 0.03 * u, caderaD[1] + 0.05 * u);
  ctx.lineTo(caderaI[0] + 0.03 * u, caderaI[1] + 0.05 * u);
  ctx.lineTo(hombroI[0] + 0.042 * u, hombroI[1] + 0.04 * u);
  // hombro izquierdo (curva)
  ctx.quadraticCurveTo(hombroI[0] + 0.035 * u, hombroI[1] - 0.012 * u, hombroI[0] - 0.02 * u, cuelloY - 0.012 * u);
  ctx.closePath();
  ctx.fill();
}

/** Cuello (con sombra bajo la barbilla) y el cuello redondo de la playera. */
export function dibujarCuello(g) {
  const { ctx, u, ropa, cx, cy } = g;
  const { hombroD, hombroI } = g.pose;
  const cuelloY = (hombroD[1] + hombroI[1]) / 2;

  const degradado = ctx.createLinearGradient(0, cy + 0.06 * u, 0, cuelloY);
  degradado.addColorStop(0, PIEL.sombra);
  degradado.addColorStop(0.45, PIEL.base);
  degradado.addColorStop(1, PIEL.base);
  ctx.fillStyle = degradado;

  ctx.beginPath();
  ctx.moveTo(cx - 0.036 * u, cy + 0.05 * u);
  ctx.lineTo(cx + 0.036 * u, cy + 0.05 * u);
  ctx.lineTo(cx + 0.042 * u, cuelloY + 0.005 * u);
  ctx.quadraticCurveTo(cx, cuelloY + 0.03 * u, cx - 0.042 * u, cuelloY + 0.005 * u);
  ctx.closePath();
  ctx.fill();

  // Cuello de la playera
  ctx.strokeStyle = tono(ropa, -0.35);
  ctx.lineWidth = 0.008 * u;
  ctx.beginPath();
  ctx.moveTo(cx - 0.05 * u, cuelloY - 0.005 * u);
  ctx.quadraticCurveTo(cx, cuelloY + 0.04 * u, cx + 0.05 * u, cuelloY - 0.005 * u);
  ctx.stroke();
}

/**
 * Brazo de manga larga: hombro → codo → muñeca.
 * Se dibuja primero un contorno oscuro y encima la tela, más un brillo.
 */
export function dibujarBrazo(g, hombro, codo, muneca) {
  if (!hombro || !codo || !muneca) return;
  const { ctx, u, ropa } = g;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Contorno oscuro (un poco más ancho que la tela)
  ctx.strokeStyle = tono(ropa, -0.35);
  trazarSegmento(ctx, hombro, codo, 0.064 * u); // brazo
  trazarSegmento(ctx, codo, muneca, 0.052 * u); // antebrazo

  // Tela
  ctx.strokeStyle = tono(ropa, 0.06);
  trazarSegmento(ctx, hombro, codo, 0.056 * u);
  trazarSegmento(ctx, codo, muneca, 0.044 * u);

  // Brillo de la tela en el brazo
  ctx.strokeStyle = "rgba(255,255,255,.07)";
  trazarSegmento(ctx, [hombro[0] - 0.008 * u, hombro[1]], [codo[0] - 0.008 * u, codo[1]], 0.014 * u);
}

/** Dibuja una línea gruesa entre dos puntos. */
function trazarSegmento(ctx, desde, hasta, grosor) {
  ctx.lineWidth = grosor;
  ctx.beginPath();
  ctx.moveTo(desde[0], desde[1]);
  ctx.lineTo(hasta[0], hasta[1]);
  ctx.stroke();
}
