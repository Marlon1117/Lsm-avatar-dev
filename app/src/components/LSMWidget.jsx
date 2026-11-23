/**
 * LSMWidget.jsx
 * ---------------------------------------------------------------------------
 * Componente principal del traductor (equivalente al widget de VLibras).
 *
 *   <LSMWidget urlDiccionario="/lsm-diccionario.json" color="#0b6e4f" />
 *
 * Responsabilidades:
 *   1. Cargar el diccionario                      → useDiccionario
 *   2. Traducir texto → glosas → secuencia        → lib/traductor + lib/secuencia
 *   3. Animar la secuencia en el canvas           → useReproductor
 *   4. Escuchar clics/selección en la página      → useTextoDeLaPagina
 *   5. Mostrar botón flotante y panel             → BotonFlotante + PanelLSM
 *
 * Flujo de datos:
 *   texto ──traducir()──► oraciones ──construirSecuencia()──► secuencia (estado)
 *   secuencia ──useReproductor──► dibuja frames + avisa la glosa activa
 *
 * También escucha el evento global "lsm:traducir", para que cualquier código
 * de la página pueda pedir una traducción:
 *   document.dispatchEvent(new CustomEvent("lsm:traducir", { detail: "Hola" }))
 *
 * Props:
 *   urlDiccionario  dónde está lsm-diccionario.json
 *   color           color principal (botón, resaltado, glosa activa)
 *   posicion        "derecha" | "izquierda"
 *   ropa            color de la ropa del avatar
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDiccionario } from "../hooks/useDiccionario.js";
import { useReproductor } from "../hooks/useReproductor.js";
import { useTextoDeLaPagina } from "../hooks/useTextoDeLaPagina.js";
import { traducir } from "../lib/traductor.js";
import { construirSecuencia, frameDeReposo } from "../lib/secuencia.js";
import BotonFlotante from "./BotonFlotante.jsx";
import PanelLSM from "./PanelLSM.jsx";

/** Máximo de caracteres por traducción (evita animaciones de minutos). */
const LIMITE_CARACTERES = 600;

export default function LSMWidget({ urlDiccionario, color = "#0b6e4f", posicion = "derecha", ropa }) {
  // ---------------- Estado ----------------
  const { diccionario, cargando, error } = useDiccionario(urlDiccionario);
  const [abierto, setAbierto] = useState(false);
  const [secuencia, setSecuencia] = useState(null); // { frames, tokens }
  const [pausado, setPausado] = useState(false);
  const [velocidad, setVelocidad] = useState(1);

  // ---------------- Refs ----------------
  const canvasRef = useRef(null); // <canvas> del avatar
  const raizRef = useRef(null); //   contenedor del widget

  // La postura de reposo solo se calcula cuando cambia el diccionario
  const reposo = useMemo(() => (diccionario ? frameDeReposo(diccionario) : null), [diccionario]);

  // ---------------- Animación ----------------
  const { tokenActivo, letraActiva, reiniciar, ultimoFrameRef } = useReproductor({
    canvasRef,
    secuencia,
    reposo,
    fps: diccionario?.fps || 15,
    velocidad,
    pausado,
    ropa,
  });

  // ---------------- Traducir un texto ----------------
  const traducirTexto = useCallback(
    (texto) => {
      if (!diccionario) return;
      setAbierto(true);
      const oraciones = traducir(String(texto).slice(0, LIMITE_CARACTERES), diccionario);
      const nueva = construirSecuencia(oraciones, diccionario, {
        reposo,
        desde: ultimoFrameRef.current, // empezar desde donde está el avatar
      });
      setSecuencia(nueva);
      setPausado(false);
    },
    [diccionario, reposo, ultimoFrameRef]
  );

  // Clics / selección sobre la página mientras el panel está abierto
  useTextoDeLaPagina({ activo: abierto, raizRef, color, onTexto: traducirTexto });

  // API global por evento: "lsm:traducir"
  useEffect(() => {
    const alPedirTraduccion = (evento) => traducirTexto(evento.detail || "");
    document.addEventListener("lsm:traducir", alPedirTraduccion);
    return () => document.removeEventListener("lsm:traducir", alPedirTraduccion);
  }, [traducirTexto]);

  // ---------------- Render ----------------
  return (
    <div ref={raizRef} className={`lsm-widget lsm-widget--${posicion}`} style={{ "--lsm-color": color }}>
      {abierto && (
        <PanelLSM
          canvasRef={canvasRef}
          tokens={secuencia?.tokens}
          tokenActivo={tokenActivo}
          letraActiva={letraActiva}
          cargando={cargando}
          error={error}
          pausado={pausado}
          onPausar={() => setPausado((p) => !p)}
          onRepetir={() => {
            reiniciar();
            setPausado(false);
          }}
          velocidad={velocidad}
          onVelocidad={setVelocidad}
          onTexto={traducirTexto}
          onCerrar={() => setAbierto(false)}
        />
      )}
      <BotonFlotante activo={abierto} onClick={() => setAbierto((a) => !a)} />
    </div>
  );
}
