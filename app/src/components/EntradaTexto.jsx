/**
 * EntradaTexto.jsx
 * ---------------------------------------------------------------------------
 * Cuadro para escribir un texto en español y mandarlo a señar.
 * Enter envía; Shift + Enter hace salto de línea.
 *
 * Props:
 *   onEnviar(texto)  se llama con el texto escrito
 *   deshabilitado    mientras el diccionario no ha cargado
 */

import { useState } from "react";

export default function EntradaTexto({ onEnviar, deshabilitado }) {
  // Componente "controlado": React guarda lo que el usuario escribe
  const [texto, setTexto] = useState("");

  const enviar = () => {
    if (texto.trim()) onEnviar(texto);
  };

  const alPresionarTecla = (evento) => {
    if (evento.key === "Enter" && !evento.shiftKey) {
      evento.preventDefault();
      enviar();
    }
  };

  return (
    <div className="lsm-entrada">
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={alPresionarTecla}
        placeholder="O escribe un texto en español…"
        aria-label="Texto a traducir"
        disabled={deshabilitado}
      />
      <button type="button" onClick={enviar} disabled={deshabilitado}>
        Señar
      </button>
    </div>
  );
}
