/**
 * avatar/index.js
 * ---------------------------------------------------------------------------
 * Punto de entrada del dibujo del avatar: `dibujarAvatar(ctx, frame, opciones)`.
 *
 * Recibe UN frame (108 números, ver formato.js) y lo pinta en un canvas 2D.
 * No guarda estado: llamarlo 15-60 veces por segundo con frames distintos es
 * lo que produce la animación (de eso se encarga el hook useReproductor).
 *
 * Proceso:
 *   1. Pintar el fondo.
 *   2. Escalar el canvas: el diseño de referencia mide 640 x 600 px.
 *   3. Convertir los puntos del frame (0..1000) a píxeles.
 *   4. Armar la "geometría" `g` que comparten todas las partes.
 *   5. Dibujar de atrás hacia adelante: torso → cuello → cabeza → rostro
 *      → brazo/mano izquierda → brazo/mano derecha (la dominante, encima).
 */

import { NUM_COORDENADAS, INICIO_MANO_DERECHA, INICIO_MANO_IZQUIERDA, POSE, PUNTOS_MANO } from "../formato.js";
import { ROPA_POR_DEFECTO, FONDO_POR_DEFECTO } from "./colores.js";
import { dibujarFondo, dibujarTorso, dibujarCuello, dibujarBrazo } from "./cuerpo.js";
import { dibujarOrejas, dibujarCara, dibujarCabello, dibujarMejillas } from "./cabeza.js";
import { dibujarOjos, dibujarCejas, dibujarArrugas, dibujarNariz, dibujarBoca } from "./rostro.js";
import { dibujarMano } from "./manos.js";

/* Constantes de encuadre: qué parte del espacio 0..1000 se ve y a qué tamaño */
const ANCHO_REFERENCIA = 640;
const ALTO_REFERENCIA = 600;
const ESCALA = 640 / 700; //   700 unidades del espacio normalizado caben en 640 px
const ORIGEN_X = 150; //       el encuadre empieza en x = 150 (de 0..1000)
const ORIGEN_Y = 20;
const ZOOM = 0.78; //          aleja un poco la "cámara" para que quepan los brazos

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number[]} frame   108 valores (formato.js)
 * @param {object}   opciones
 *   - tiempo: milisegundos (para parpadeo y respiración). Ej. performance.now()
 *   - ropa:   color de la ropa
 *   - fondo:  [colorCentro, colorOrilla]
 */
export function dibujarAvatar(ctx, frame, opciones = {}) {
  const ancho = ctx.canvas.width;
  const alto = ctx.canvas.height;
  const tiempo = (opciones.tiempo || 0) / 1000; // en segundos

  // --- 1. Fondo (sin transformación) ---------------------------------------
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  dibujarFondo(ctx, ancho, alto, opciones.fondo || FONDO_POR_DEFECTO);

  // --- 2. Escalar al tamaño real del canvas --------------------------------
  const s = Math.min(ancho / ANCHO_REFERENCIA, alto / ALTO_REFERENCIA);
  ctx.setTransform(ZOOM * s, 0, 0, ZOOM * s, (ancho - ANCHO_REFERENCIA * s) / 2 + 70 * s, 4 * s);

  // --- 3. Conversión de puntos: espacio 0..1000 → píxeles de referencia ----
  const u = ESCALA * 1000; // 1 unidad normalizada (0..1) en píxeles
  const punto = (indice) => {
    const x = frame[indice * 2];
    const y = frame[indice * 2 + 1];
    return x < 0 ? null : [(x - ORIGEN_X) * ESCALA, (y - ORIGEN_Y) * ESCALA];
  };
  const puntosMano = (inicio) => Array.from({ length: PUNTOS_MANO }, (_, i) => punto(inicio + i));

  // Canales no manuales en -1..1
  const nm = {
    arriba: (frame[NUM_COORDENADAS] || 0) / 100,
    frunce: (frame[NUM_COORDENADAS + 1] || 0) / 100,
    boca: (frame[NUM_COORDENADAS + 2] || 0) / 100,
    sonr: (frame[NUM_COORDENADAS + 3] || 0) / 100,
    giro: (frame[NUM_COORDENADAS + 4] || 0) / 100,
    asen: (frame[NUM_COORDENADAS + 5] || 0) / 100,
  };

  // --- 4. Geometría compartida ---------------------------------------------
  // Respiración: los hombros suben y bajan cada ~4.2 s
  const respiracion = Math.sin((tiempo * 2 * Math.PI) / 4.2) * 0.0025 * u;
  // Micro-movimiento de la cabeza para que no se vea congelada
  const microX = Math.sin(tiempo * 0.9) * 0.002 * u;
  const microY = Math.sin(tiempo * 0.7 + 1) * 0.0015 * u;

  const hombroD = punto(POSE.HOMBRO_DERECHO);
  const hombroI = punto(POSE.HOMBRO_IZQUIERDO);
  const nariz = punto(POSE.NARIZ);

  const pose = {
    hombroD: [hombroD[0], hombroD[1] + respiracion],
    hombroI: [hombroI[0], hombroI[1] + respiracion],
    codoD: punto(POSE.CODO_DERECHO),
    codoI: punto(POSE.CODO_IZQUIERDO),
    munecaD: punto(POSE.MUNECA_DERECHA),
    munecaI: punto(POSE.MUNECA_IZQUIERDA),
    caderaD: punto(POSE.CADERA_DERECHA),
    caderaI: punto(POSE.CADERA_IZQUIERDA),
  };

  const cx = nariz[0] + microX; // centro de la cara
  const cy = nariz[1] + microY;
  const dxF = nm.giro * 0.018 * u; // desplazamiento de los rasgos al girar
  const dyF = nm.asen * 0.01 * u; //  ... y al asentir

  const g = {
    ctx,
    u,
    nm,
    tiempo,
    pose,
    ropa: opciones.ropa || ROPA_POR_DEFECTO,
    cx,
    cy,
    dxF,
    dyF,
    hcx: cx + nm.giro * 0.006 * u, // centro de la cabeza
    hcy: cy + dyF * 0.4,
  };

  // --- 5. Dibujar, de atrás hacia adelante ---------------------------------
  dibujarTorso(g);
  dibujarCuello(g);

  dibujarOrejas(g);
  dibujarCara(g);
  dibujarCabello(g);
  dibujarMejillas(g);

  dibujarOjos(g);
  dibujarCejas(g);
  dibujarArrugas(g);
  dibujarNariz(g);
  dibujarBoca(g);

  // Mano izquierda primero; la derecha (dominante) queda encima
  dibujarBrazo(g, pose.hombroI, pose.codoI, pose.munecaI);
  dibujarMano(g, puntosMano(INICIO_MANO_IZQUIERDA), pose.codoI);
  dibujarBrazo(g, pose.hombroD, pose.codoD, pose.munecaD);
  dibujarMano(g, puntosMano(INICIO_MANO_DERECHA), pose.codoD);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
