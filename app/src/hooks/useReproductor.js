/**
 * useReproductor.js
 * ---------------------------------------------------------------------------
 * Hook que ANIMA el avatar: avanza por los frames de la secuencia al ritmo
 * correcto y dibuja cada frame en el canvas.
 *
 * ¿Por qué no guardamos el frame actual en un useState?
 *   Porque cambiaría ~60 veces por segundo y React volvería a renderizar todo
 *   el panel en cada cambio. En su lugar:
 *     - el índice del frame vive en un useRef (cambiarlo NO re-renderiza)
 *     - el canvas se dibuja directamente (es "imperativo", como un pizarrón)
 *     - solo se actualiza el estado de React cuando cambia la GLOSA activa,
 *       que es lo único que la interfaz necesita mostrar (unas pocas veces/s)
 *
 * Parámetros:
 *   canvasRef   ref al <canvas> donde se dibuja
 *   secuencia   resultado de construirSecuencia() (o null)
 *   reposo      frame de reposo (se muestra cuando no hay secuencia)
 *   fps         frames por segundo de los clips (15)
 *   velocidad   multiplicador (0.5 = lento, 2 = rápido)
 *   pausado     true para detener el avance
 *   ropa        color de la ropa del avatar
 *
 * Devuelve:
 *   tokenActivo     índice del token que se está señando (-1 = ninguno)
 *   letraActiva     letra que se está deletreando (o null)
 *   reiniciar()     vuelve al primer frame
 *   ultimoFrameRef  ref con el último frame dibujado (para que la siguiente
 *                   traducción empiece desde ahí y no "salte")
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { dibujarAvatar } from "../lib/avatar/index.js";

export function useReproductor({ canvasRef, secuencia, reposo, fps = 15, velocidad = 1, pausado = false, ropa }) {
  const indiceRef = useRef(0);
  const ultimoFrameRef = useRef(null);
  const [activo, setActivo] = useState({ token: -1, letra: null });

  // Guardamos velocidad y pausa en refs para que el bucle siempre lea el valor
  // actual sin tener que reiniciarse cuando cambian.
  const velocidadRef = useRef(velocidad);
  const pausadoRef = useRef(pausado);
  velocidadRef.current = velocidad;
  pausadoRef.current = pausado;

  // Cada vez que llega una secuencia nueva, empezar desde el principio.
  useEffect(() => {
    indiceRef.current = 0;
  }, [secuencia]);

  // --- Bucle de animación con requestAnimationFrame --------------------------
  useEffect(() => {
    let idAnimacion;
    let instanteAnterior = performance.now();
    let acumulado = 0; // milisegundos acumulados desde el último avance de frame

    const paso = (ahora) => {
      const frames = secuencia ? secuencia.frames : [];
      const delta = ahora - instanteAnterior;
      instanteAnterior = ahora;

      // 1) Avanzar el índice según el tiempo transcurrido.
      //    A 15 fps y velocidad 1, se avanza un frame cada 66.7 ms aunque la
      //    pantalla se refresque a 60 o 120 Hz.
      const hayMasFrames = indiceRef.current < frames.length - 1;
      if (!pausadoRef.current && hayMasFrames) {
        acumulado += delta;
        const msPorFrame = 1000 / (fps * velocidadRef.current);
        while (acumulado >= msPorFrame && indiceRef.current < frames.length - 1) {
          acumulado -= msPorFrame;
          indiceRef.current += 1;
        }
      } else {
        acumulado = 0;
      }

      // 2) Dibujar el frame actual (o el reposo si no hay secuencia).
      const elemento = frames[indiceRef.current];
      const frame = elemento ? elemento.f : reposo;
      const canvas = canvasRef.current;
      if (frame && canvas) {
        dibujarAvatar(canvas.getContext("2d"), frame, { tiempo: ahora, ropa });
        ultimoFrameRef.current = frame;
      }

      // 3) Avisar a React SOLO si cambió la glosa o la letra activa.
      const token = elemento ? elemento.tk : -1;
      const letra = elemento ? elemento.letra || null : null;
      setActivo((previo) => (previo.token === token && previo.letra === letra ? previo : { token, letra }));

      idAnimacion = requestAnimationFrame(paso);
    };

    idAnimacion = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(idAnimacion); // limpiar al desmontar
  }, [secuencia, reposo, fps, ropa, canvasRef]);

  const reiniciar = useCallback(() => {
    indiceRef.current = 0;
  }, []);

  return { tokenActivo: activo.token, letraActiva: activo.letra, reiniciar, ultimoFrameRef };
}
