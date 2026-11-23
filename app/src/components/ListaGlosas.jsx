/**
 * ListaGlosas.jsx
 * ---------------------------------------------------------------------------
 * Muestra la traducción como "chips" de glosas y resalta la que el avatar
 * está señando en ese momento. Las oraciones se separan con " / ".
 *
 * Props:
 *   tokens       secuencia.tokens (cada uno trae su índice de oración)
 *   tokenActivo  índice del token que se está señando (-1 = ninguno)
 */

import { useEffect, useRef } from "react";

export default function ListaGlosas({ tokens, tokenActivo }) {
  const activoRef = useRef(null);

  // Mantener visible la glosa activa si la lista es larga
  useEffect(() => {
    activoRef.current?.scrollIntoView({ block: "nearest" });
  }, [tokenActivo]);

  if (!tokens || tokens.length === 0) {
    return (
      <div className="lsm-glosas" aria-live="polite">
        <p className="lsm-ayuda">
          Toca o haz clic en cualquier texto de la página (o selecciónalo) y el avatar lo traducirá a LSM.
        </p>
      </div>
    );
  }

  return (
    <div className="lsm-glosas" aria-live="polite">
      {tokens.map((token, i) => {
        const esActivo = i === tokenActivo;
        const cambiaDeOracion = i > 0 && token.oracion !== tokens[i - 1].oracion;
        const clases = [
          "lsm-glosa",
          token.tipo !== "sena" ? "lsm-glosa--deletreo" : "",
          esActivo ? "lsm-glosa--activa" : "",
        ].join(" ");

        return (
          <span key={i}>
            {cambiaDeOracion && <span className="lsm-separador"> / </span>}
            <span
              ref={esActivo ? activoRef : null}
              className={clases}
              title={`${token.original || ""} · ${token.regla || ""}`}
            >
              {token.glosa}
              {token.pregunta ? " ?" : ""}
            </span>
          </span>
        );
      })}
    </div>
  );
}
