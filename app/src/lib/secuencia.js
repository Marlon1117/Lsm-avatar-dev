/**
 * secuencia.js
 * ---------------------------------------------------------------------------
 * Convierte las glosas traducidas en una SECUENCIA CONTINUA de frames lista
 * para animar (o para guardar en el dataset).
 *
 *   [HOLA] [BUENO] [DÍA]   →   frames de HOLA + transición + frames de BUENO + ...
 *
 * Cada elemento de la secuencia es:
 *   { f: frame (108 números), tk: índice del token, glosa: "HOLA" | "<trans>"
 *     | "<pausa>" | "<reposo>" | "DT-A", letra: "A" | null, oracion: índice }
 *
 * Las etiquetas entre < > marcan frames que NO son seña (transiciones, pausas
 * y regreso al reposo). En el dataset sirven como "blank" para entrenar un
 * reconocedor continuo (por ejemplo con CTC).
 */

import { NUM_COORDENADAS, NUM_NO_MANUALES, LARGO_FRAME, NO_MANUAL } from "./formato.js";

/**
 * Asegura que un frame tenga 108 valores.
 * Clips antiguos guardaban solo 1 canal no manual: se completan con ceros.
 */
export function normalizarFrame(frame) {
  if (frame.length === LARGO_FRAME) return frame;
  const completo = frame.slice(0, NUM_COORDENADAS);
  for (let i = 0; i < NUM_NO_MANUALES; i++) completo.push(frame[NUM_COORDENADAS + i] || 0);
  return completo;
}

/**
 * Interpola linealmente entre dos frames.
 * @param {number} t  0 = frame a, 1 = frame b
 *
 * Si un punto no existe en alguno de los dos (-1), no se puede interpolar:
 * se toma el de a en la primera mitad y el de b en la segunda.
 */
export function mezclarFrames(a, b, t) {
  const resultado = new Array(LARGO_FRAME);
  for (let i = 0; i < LARGO_FRAME; i++) {
    const esCoordenada = i < NUM_COORDENADAS;
    if (esCoordenada && (a[i] < 0 || b[i] < 0)) {
      resultado[i] = t < 0.5 ? a[i] : b[i];
    } else {
      resultado[i] = a[i] + (b[i] - a[i]) * t;
    }
  }
  return resultado;
}

/**
 * Postura de reposo: primer frame de HOLA (manos abajo) con el rostro neutro.
 */
export function frameDeReposo(diccionario) {
  const hola = diccionario.glosas.HOLA;
  if (!hola) return null;
  const frame = normalizarFrame(hola.frames[0].slice());
  for (let i = NUM_COORDENADAS; i < LARGO_FRAME; i++) frame[i] = 0;
  return frame;
}

/**
 * Construye la secuencia completa.
 *
 * @param {Array}  oraciones    salida de traducir()
 * @param {object} diccionario  { glosas, alfabeto }
 * @param {object} opciones
 *   - reposo:        frame de reposo (para pausas y para terminar)
 *   - desde:         frame donde está el avatar ahora (para no "saltar")
 *   - transicion:    frames de transición entre señas (3)
 *   - pausa:         frames de pausa entre oraciones (6)
 *   - recorteLetra:  [inicio, fin] frames que se recortan de cada letra,
 *                    para deletrear más rápido ([2, 1])
 * @returns {{ frames: Array, tokens: Array }}
 */
export function construirSecuencia(oraciones, diccionario, opciones = {}) {
  const transicion = opciones.transicion ?? 3;
  const framesPausa = opciones.pausa || 6;
  const recorteLetra = opciones.recorteLetra || [2, 1];
  const reposo = opciones.reposo ? normalizarFrame(opciones.reposo) : null;

  const cola = []; //   la secuencia que se va armando
  const tokens = []; // todos los tokens, con el índice de su oración
  let anterior = opciones.desde ? normalizarFrame(opciones.desde) : reposo;

  /** Agrega un clip (con su transición de entrada) a la cola. */
  function agregarClip(framesClip, indiceToken, glosa, letra, recorte) {
    if (!framesClip || !framesClip.length) return;
    const recortados = recorte ? framesClip.slice(recorte[0], framesClip.length - recorte[1]) : framesClip;
    const clip = recortados.map(normalizarFrame);
    if (!clip.length) return;

    const oracion = tokens[indiceToken] ? tokens[indiceToken].oracion : -1;

    // Transición suave desde la postura anterior hasta el primer frame del clip
    if (anterior) {
      for (let k = 1; k <= transicion; k++) {
        cola.push({
          f: mezclarFrames(anterior, clip[0], k / (transicion + 1)),
          tk: indiceToken,
          glosa: "<trans>",
          letra,
          oracion,
        });
      }
    }
    for (const f of clip) cola.push({ f, tk: indiceToken, glosa, letra, oracion });
    anterior = clip[clip.length - 1];
  }

  oraciones.forEach((oracion, indiceOracion) => {
    const inicioOracion = cola.length;

    // --- Señas y deletreo de cada token -----------------------------------
    for (const token of oracion.tokens) {
      const indiceToken = tokens.length;
      tokens.push({ ...token, oracion: indiceOracion });

      if (token.tipo === "sena" && diccionario.glosas[token.glosa]) {
        agregarClip(diccionario.glosas[token.glosa].frames, indiceToken, token.glosa, null, null);
      } else if (token.tipo === "dactilologia" || token.tipo === "numero") {
        for (const letra of token.letras || []) {
          const clipLetra = diccionario.alfabeto[letra];
          if (clipLetra) agregarClip(clipLetra.frames, indiceToken, "DT-" + letra, letra, recorteLetra);
        }
      }
    }

    // --- Pregunta sí/no: cejas arriba durante TODA la oración --------------
    // (si la pregunta tiene un interrogativo QU, el clip ya trae el ceño)
    const esPreguntaSiNo =
      oracion.pregunta && !oracion.tokens.some((t) => t.cat === "interrogativo");
    if (esPreguntaSiNo) {
      for (let k = inicioOracion; k < cola.length; k++) {
        // rampa: sube al inicio y baja un poco al final
        const r = Math.min(1, (k - inicioOracion) / 4, (cola.length - 1 - k) / 3 + 0.3);
        const f = cola[k].f.slice();
        f[NO_MANUAL.CEJAS_ARRIBA] = Math.max(f[NO_MANUAL.CEJAS_ARRIBA], 90 * r);
        f[NO_MANUAL.CEJAS_FRUNCIDAS] = Math.min(f[NO_MANUAL.CEJAS_FRUNCIDAS], 10);
        f[NO_MANUAL.ASENTIR] += -15 * r; // cabeza ligeramente hacia adelante
        cola[k] = { ...cola[k], f };
      }
    }

    // --- Pausa entre oraciones: volver al reposo ---------------------------
    if (reposo && indiceOracion < oraciones.length - 1) {
      for (let p = 1; p <= framesPausa; p++) {
        cola.push({
          f: mezclarFrames(anterior, reposo, p / framesPausa),
          tk: -1,
          glosa: "<pausa>",
          oracion: indiceOracion,
        });
      }
      anterior = reposo;
    }
  });

  // --- Al terminar, regresar al reposo -------------------------------------
  if (reposo && anterior) {
    for (let q = 1; q <= 6; q++) {
      cola.push({ f: mezclarFrames(anterior, reposo, q / 6), tk: -1, glosa: "<reposo>", oracion: -1 });
    }
  }

  return { frames: cola, tokens };
}
