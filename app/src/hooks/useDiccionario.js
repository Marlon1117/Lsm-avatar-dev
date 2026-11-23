/**
 * useDiccionario.js
 * ---------------------------------------------------------------------------
 * Hook que descarga el diccionario de señas (lsm-diccionario.json) una sola vez.
 *
 * El JSON lo genera scripts/construir_diccionario.py a partir de
 * dataset/glosario.csv + dataset/senas/*.json, y contiene:
 *   { fps, glosas: {GLOSA: {cat, nm, origen, frames}}, alfabeto: {...}, lexico: {...} }
 *
 * Uso:
 *   const { diccionario, cargando, error } = useDiccionario(url);
 */

import { useEffect, useState } from "react";

export function useDiccionario(url) {
  const [diccionario, setDiccionario] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Si el componente se desmonta antes de que llegue la respuesta,
    // no intentamos actualizar el estado.
    let cancelado = false;

    fetch(url)
      .then((respuesta) => {
        if (!respuesta.ok) throw new Error(`No se pudo cargar ${url} (${respuesta.status})`);
        return respuesta.json();
      })
      .then((datos) => {
        if (!cancelado) setDiccionario(datos);
      })
      .catch((e) => {
        if (!cancelado) setError(e.message);
      });

    return () => {
      cancelado = true;
    };
  }, [url]);

  return { diccionario, cargando: !diccionario && !error, error };
}
