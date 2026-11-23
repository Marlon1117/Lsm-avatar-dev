/**
 * rostro.js — Gesticulación facial: ojos, cejas, arrugas, nariz y boca.
 *
 * Aquí se "ven" los 6 canales no manuales del frame (g.nm, valores -1..1):
 *   nm.arriba  → cejas suben, ojos más abiertos, arrugas en la frente
 *   nm.frunce  → extremos internos de las cejas bajan y se juntan
 *   nm.boca    → apertura de los labios (articulación de la palabra)
 *   nm.sonr    → comisuras arriba (+) o abajo (−)
 *   nm.giro / nm.asen → ya vienen aplicados en g.dxF / g.dyF
 *
 * Además, sin estar en los datos:
 *   - parpadeo automático cada ~3.9 s (depende de g.tiempo)
 *   - la mirada sigue a la mano dominante
 */

import { ROSTRO } from "./colores.js";

/**
 * Qué tan abiertos están los ojos (0 = cerrados, ~1 = normal).
 * Combina el parpadeo con la expresión.
 */
function aperturaOjos(g) {
  const { nm, tiempo } = g;
  const fase = (tiempo * 1000) % 3900; // ms dentro del ciclo de parpadeo
  const parpadeo = fase < 160 ? Math.abs(fase - 80) / 80 : 1; // 160 ms cerrar-abrir
  return parpadeo * (1 - 0.25 * nm.frunce - 0.22 * Math.max(nm.sonr, 0) + 0.18 * nm.arriba);
}

/** Ojos: blanco, iris, pupila, brillo, párpado y pestañas. */
export function dibujarOjos(g) {
  const { ctx, u, hcx, hcy, dxF, dyF, cx, cy } = g;
  const abre = aperturaOjos(g);
  // La mirada va hacia la mano dominante (o al frente si no se ve)
  const objetivo = g.pose.munecaD || [cx, cy + 0.2 * u];

  for (const lado of [-1, 1]) {
    const ex = hcx + lado * 0.033 * u + dxF; // centro del ojo
    const ey = hcy - 0.014 * u + dyF;

    // Dirección de la mirada (vector unitario, desplazamiento pequeño)
    const vx = objetivo[0] - ex;
    const vy = objetivo[1] - ey;
    const distancia = Math.hypot(vx, vy) || 1;
    const mx = (vx / distancia) * 0.0045 * u;
    const my = Math.min(vy / distancia, 0.6) * 0.003 * u;

    // Todo lo de adentro del ojo se recorta con la forma del ojo
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(ex, ey, 0.017 * u, Math.max(0.0008 * u, 0.0095 * u * abre), 0, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = ROSTRO.esclerotica;
    ctx.fillRect(ex - 0.02 * u, ey - 0.012 * u, 0.04 * u, 0.024 * u);

    ctx.fillStyle = ROSTRO.iris;
    ctx.beginPath();
    ctx.arc(ex + mx, ey + my, 0.0078 * u, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = ROSTRO.pupila;
    ctx.beginPath();
    ctx.arc(ex + mx, ey + my, 0.0036 * u, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,.85)"; // brillo
    ctx.beginPath();
    ctx.arc(ex + mx - 0.0025 * u, ey + my - 0.0025 * u, 0.0016 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Párpado superior (línea de pestañas)
    ctx.strokeStyle = ROSTRO.parpado;
    ctx.lineWidth = 0.0035 * u;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.ellipse(ex, ey, 0.0175 * u, Math.max(0.001 * u, 0.0098 * u * abre), 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();

    // Pliegue del párpado
    ctx.strokeStyle = "rgba(150,95,70,.5)";
    ctx.lineWidth = 0.002 * u;
    ctx.beginPath();
    ctx.ellipse(ex, ey - 0.004 * u, 0.018 * u, 0.012 * u * Math.max(abre, 0.3), 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
}

/** Cejas: forma de ceja rellena que sube (arriba) o se junta (frunce). */
export function dibujarCejas(g) {
  const { ctx, u, hcx, hcy, dxF, dyF, nm } = g;
  ctx.fillStyle = ROSTRO.cejas;

  for (const lado of [-1, 1]) {
    const base = hcy - 0.04 * u - nm.arriba * 0.016 * u + dyF;
    // extremo interno (cerca de la nariz): baja y se acerca al fruncir
    const ix = hcx + lado * (0.013 * u - nm.frunce * 0.004 * u) + dxF;
    const iy = base + nm.frunce * 0.011 * u - nm.arriba * 0.004 * u;
    // extremo externo
    const ox = hcx + lado * 0.054 * u + dxF;
    const oy = base + 0.004 * u - nm.frunce * 0.002 * u;
    // punto de control del arco
    const mxC = (ix + ox) / 2;
    const myC = Math.min(iy, oy) - 0.008 * u - nm.arriba * 0.004 * u;

    ctx.beginPath();
    ctx.moveTo(ix, iy - 0.004 * u);
    ctx.quadraticCurveTo(mxC, myC - 0.003 * u, ox, oy - 0.001 * u); // borde superior
    ctx.quadraticCurveTo(mxC, myC + 0.004 * u, ix, iy + 0.0035 * u); // borde inferior
    ctx.closePath();
    ctx.fill();
  }
}

/** Arrugas de expresión: entrecejo (al fruncir) y frente (al subir cejas). */
export function dibujarArrugas(g) {
  const { ctx, u, hcx, hcy, dxF, nm } = g;

  if (nm.frunce > 0.3) {
    ctx.strokeStyle = `rgba(140,85,60,${0.5 * nm.frunce})`;
    ctx.lineWidth = 0.0022 * u;
    for (const lado of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(hcx + lado * 0.006 * u + dxF, hcy - 0.042 * u);
      ctx.lineTo(hcx + lado * 0.004 * u + dxF, hcy - 0.026 * u);
      ctx.stroke();
    }
  }

  if (nm.arriba > 0.45) {
    ctx.strokeStyle = `rgba(140,85,60,${0.4 * nm.arriba})`;
    ctx.lineWidth = 0.002 * u;
    for (const k of [0, 1]) {
      const y = hcy - 0.072 * u - k * 0.008 * u;
      ctx.beginPath();
      ctx.moveTo(hcx - 0.035 * u + dxF, y);
      ctx.quadraticCurveTo(hcx + dxF, y - 0.006 * u, hcx + 0.035 * u + dxF, y);
      ctx.stroke();
    }
  }
}

/** Nariz: una línea de sombra y dos fosas nasales. */
export function dibujarNariz(g) {
  const { ctx, u, hcx, hcy, dxF, dyF } = g;
  ctx.strokeStyle = "rgba(150,90,62,.55)";
  ctx.lineWidth = 0.003 * u;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(hcx - 0.004 * u + dxF * 1.2, hcy - 0.005 * u + dyF);
  ctx.quadraticCurveTo(hcx - 0.011 * u + dxF * 1.3, hcy + 0.02 * u + dyF, hcx - 0.004 * u + dxF * 1.3, hcy + 0.026 * u + dyF);
  ctx.stroke();

  ctx.fillStyle = "rgba(120,70,50,.45)";
  for (const lado of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(hcx + lado * 0.008 * u + dxF * 1.3, hcy + 0.026 * u + dyF, 0.004 * u, 0.0022 * u, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Boca: abierta (con dientes y lengua) o cerrada, con sonrisa o comisuras
 * hacia abajo, y hoyuelos cuando sonríe mucho.
 */
export function dibujarBoca(g) {
  const { ctx, u, hcx, hcy, dxF, dyF, nm } = g;
  const bx = hcx + dxF * 1.1; // centro de la boca
  const by = hcy + 0.059 * u + dyF;
  const ancho = 0.024 * u * (1 + 0.22 * Math.max(nm.sonr, 0) - 0.15 * nm.boca); // medio ancho
  const comisuras = -nm.sonr * 0.009 * u; // negativo = arriba (sonrisa)
  const apertura = nm.boca * 0.024 * u;

  if (apertura > 0.0025 * u) {
    // --- Boca abierta ---
    ctx.fillStyle = ROSTRO.interiorBoca;
    ctx.beginPath();
    ctx.moveTo(bx - ancho, by + comisuras);
    ctx.quadraticCurveTo(bx, by - 0.004 * u, bx + ancho, by + comisuras);
    ctx.quadraticCurveTo(bx, by + apertura * 1.6 + comisuras * 0.3, bx - ancho, by + comisuras);
    ctx.fill();

    // Dientes y lengua, recortados por la forma de la boca
    ctx.save();
    ctx.clip();
    ctx.fillStyle = ROSTRO.dientes;
    ctx.fillRect(bx - ancho, by - 0.006 * u, ancho * 2, 0.0075 * u);
    ctx.fillStyle = ROSTRO.lengua;
    ctx.beginPath();
    ctx.ellipse(bx, by + apertura * 1.25, ancho * 0.6, apertura * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Labios
    ctx.strokeStyle = ROSTRO.labios;
    ctx.lineWidth = 0.0045 * u;
    ctx.beginPath();
    ctx.moveTo(bx - ancho, by + comisuras);
    ctx.quadraticCurveTo(bx, by - 0.005 * u, bx + ancho, by + comisuras);
    ctx.stroke();
    ctx.lineWidth = 0.006 * u;
    ctx.beginPath();
    ctx.moveTo(bx - ancho * 0.9, by + comisuras + 0.002 * u);
    ctx.quadraticCurveTo(bx, by + apertura * 1.7 + comisuras * 0.3, bx + ancho * 0.9, by + comisuras + 0.002 * u);
    ctx.stroke();
  } else {
    // --- Boca cerrada ---
    ctx.strokeStyle = ROSTRO.labiosCerrados;
    ctx.lineWidth = 0.004 * u;
    ctx.beginPath();
    ctx.moveTo(bx - ancho, by + comisuras);
    ctx.quadraticCurveTo(bx, by + 0.004 * u * (1 + nm.sonr), bx + ancho, by + comisuras);
    ctx.stroke();

    // Labio inferior
    ctx.strokeStyle = "rgba(180,88,75,.55)";
    ctx.lineWidth = 0.006 * u;
    ctx.beginPath();
    ctx.moveTo(bx - ancho * 0.6, by + 0.008 * u);
    ctx.quadraticCurveTo(bx, by + 0.013 * u, bx + ancho * 0.6, by + 0.008 * u);
    ctx.stroke();
  }

  // Hoyuelos de sonrisa
  if (nm.sonr > 0.4) {
    ctx.strokeStyle = `rgba(150,90,62,${0.5 * nm.sonr})`;
    ctx.lineWidth = 0.0025 * u;
    for (const lado of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(
        bx + lado * (ancho + 0.004 * u),
        by + comisuras,
        0.006 * u,
        lado > 0 ? -0.9 : Math.PI - 0.6,
        lado > 0 ? 0.6 : Math.PI + 0.9
      );
      ctx.stroke();
    }
  }
}
