/**
 * formato.js
 * ---------------------------------------------------------------------------
 * Describe CÓMO está guardado un "frame" (un instante de una seña).
 *
 * Todo el sistema (avatar, secuenciador, dataset, MediaPipe) comparte este
 * mismo formato. Si algún día cambia, este es el único lugar que hay que leer.
 *
 * Un frame es un arreglo plano de 108 números enteros:
 *
 *   posición  0 .. 101  →  51 puntos (x, y), cada uno en el rango 0..1000
 *                          (-1, -1) significa "punto no detectado"
 *       puntos  0 ..  8  →  pose superior (9 puntos)
 *       puntos  9 .. 29  →  mano DERECHA del señante (21 puntos, MediaPipe Hands)
 *       puntos 30 .. 50  →  mano IZQUIERDA del señante (21 puntos)
 *
 *   posición 102 .. 107  →  6 canales NO MANUALES (expresión de cara y cabeza)
 *
 * El eje y crece hacia ABAJO (igual que en una imagen). La mano derecha del
 * señante aparece a la IZQUIERDA del espectador (como en un video sin espejo).
 */

/** Número de puntos de cada bloque. */
export const PUNTOS_POSE = 9;
export const PUNTOS_MANO = 21;
export const TOTAL_PUNTOS = PUNTOS_POSE + 2 * PUNTOS_MANO; // 51

/** Número de valores de coordenadas (x e y de cada punto). */
export const NUM_COORDENADAS = TOTAL_PUNTOS * 2; // 102

/** Número de canales no manuales y largo total del frame. */
export const NUM_NO_MANUALES = 6;
export const LARGO_FRAME = NUM_COORDENADAS + NUM_NO_MANUALES; // 108

/** Índice (en puntos, no en posiciones) donde empieza cada bloque. */
export const INICIO_POSE = 0;
export const INICIO_MANO_DERECHA = PUNTOS_POSE; // 9
export const INICIO_MANO_IZQUIERDA = PUNTOS_POSE + PUNTOS_MANO; // 30

/**
 * Significado de cada punto de la pose superior.
 * Son un subconjunto de los 33 puntos de MediaPipe Pose.
 */
export const POSE = {
  NARIZ: 0,
  HOMBRO_DERECHO: 1,
  HOMBRO_IZQUIERDO: 2,
  CODO_DERECHO: 3,
  CODO_IZQUIERDO: 4,
  MUNECA_DERECHA: 5,
  MUNECA_IZQUIERDA: 6,
  CADERA_DERECHA: 7,
  CADERA_IZQUIERDA: 8,
};

/**
 * Los 21 puntos de cada mano siguen la numeración de MediaPipe Hands:
 *   0 = muñeca
 *   1-4 = pulgar, 5-8 = índice, 9-12 = medio, 13-16 = anular, 17-20 = meñique
 * (en cada dedo: base → punta)
 */
export const DEDOS = {
  PULGAR: [1, 2, 3, 4],
  INDICE: [5, 6, 7, 8],
  MEDIO: [9, 10, 11, 12],
  ANULAR: [13, 14, 15, 16],
  MENIQUE: [17, 18, 19, 20],
};

/**
 * Canales no manuales (posición dentro del frame y rango de valores).
 * Se dividen entre 100 para trabajar con valores de -1 a 1.
 */
export const NO_MANUAL = {
  CEJAS_ARRIBA: NUM_COORDENADAS + 0, //   0..100  preguntas sí/no, sorpresa
  CEJAS_FRUNCIDAS: NUM_COORDENADAS + 1, // 0..100  preguntas QU, negación
  BOCA_ABIERTA: NUM_COORDENADAS + 2, //   0..100  articulación de la palabra
  SONRISA: NUM_COORDENADAS + 3, //     -100..100  (negativo = boca hacia abajo)
  GIRO_CABEZA: NUM_COORDENADAS + 4, // -100..100  negación
  ASENTIR: NUM_COORDENADAS + 5, //     -100..100  afirmación
};

/**
 * Lee el punto número `indice` de un frame.
 * @returns {[number, number] | null}  [x, y] en 0..1000, o null si no se detectó.
 */
export function leerPunto(frame, indice) {
  const x = frame[indice * 2];
  const y = frame[indice * 2 + 1];
  return x < 0 ? null : [x, y];
}
