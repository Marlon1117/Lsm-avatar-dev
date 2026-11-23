/**
 * useTextoDeLaPagina.js
 * ---------------------------------------------------------------------------
 * Hook que hace que CUALQUIER texto de la página se pueda traducir, como en
 * VLibras: con el widget activo, el usuario pasa el cursor (se resalta el
 * párrafo) y hace clic o toca; o selecciona texto con el mouse.
 *
 * La página "anfitriona" no es parte de React (puede ser cualquier sitio),
 * por eso aquí se usan escuchas de eventos del `document` y se cambia el
 * estilo de los elementos directamente. Al desactivarse, todo se limpia.
 *
 * Parámetros:
 *   activo    escuchar solo cuando el widget está abierto
 *   raizRef   ref al contenedor del widget (sus clics se ignoran)
 *   color     color del resaltado
 *   onTexto   función que recibe el texto a traducir
 */

import { useEffect, useRef } from "react";

/** Elementos de la página que contienen texto "traducible". */
const SELECTOR_TRADUCIBLE =
  "p,h1,h2,h3,h4,h5,h6,li,a,button,label,td,th,figcaption,blockquote,dt,dd,summary,.lsm-traducible";

/** Sube desde el elemento tocado hasta el bloque de texto que lo contiene. */
function bloqueDeTexto(elemento) {
  if (!elemento || !elemento.closest) return null;
  const bloque = elemento.closest(SELECTOR_TRADUCIBLE);
  return bloque && (bloque.innerText || "").trim() ? bloque : null;
}

export function useTextoDeLaPagina({ activo, raizRef, color, onTexto }) {
  // Guardamos onTexto en un ref para no volver a registrar los eventos cada
  // vez que el componente padre crea una función nueva.
  const onTextoRef = useRef(onTexto);
  onTextoRef.current = onTexto;

  useEffect(() => {
    if (!activo) return undefined;

    let resaltado = null; // elemento con el contorno puesto

    /** ¿El evento ocurrió dentro del propio widget? (funciona con Shadow DOM) */
    const dentroDelWidget = (evento) => raizRef.current && evento.composedPath().includes(raizRef.current);

    const quitarResaltado = () => {
      if (resaltado) {
        resaltado.style.outline = resaltado.dataset.lsmOutline || "";
        delete resaltado.dataset.lsmOutline;
        resaltado = null;
      }
    };

    // Pasar el cursor: resaltar el párrafo
    const alPasarCursor = (evento) => {
      if (dentroDelWidget(evento)) return;
      const bloque = bloqueDeTexto(evento.target);
      if (bloque === resaltado) return;
      quitarResaltado();
      if (bloque) {
        bloque.dataset.lsmOutline = bloque.style.outline;
        bloque.style.outline = `3px solid ${color}`;
        bloque.style.outlineOffset = "2px";
        resaltado = bloque;
      }
    };

    // Clic o toque: traducir el párrafo (si no hay texto seleccionado)
    const alHacerClic = (evento) => {
      if (dentroDelWidget(evento)) return;
      if (String(window.getSelection() || "").trim()) return; // lo maneja alSoltar
      const bloque = bloqueDeTexto(evento.target);
      if (!bloque) return;
      evento.preventDefault(); // que un enlace no navegue mientras traducimos
      evento.stopPropagation();
      onTextoRef.current(bloque.innerText || bloque.textContent);
    };

    // Soltar el mouse con texto seleccionado: traducir la selección
    const alSoltar = (evento) => {
      if (dentroDelWidget(evento)) return;
      const seleccion = String(window.getSelection() || "").trim();
      if (seleccion.length > 1) onTextoRef.current(seleccion);
    };

    // Accesibilidad con teclado: Alt + L traduce el elemento enfocado
    const alPresionarTecla = (evento) => {
      if (evento.altKey && evento.key.toLowerCase() === "l" && document.activeElement) {
        const bloque = bloqueDeTexto(document.activeElement) || document.activeElement;
        onTextoRef.current(bloque.innerText || bloque.textContent || "");
      }
    };

    // `true` = fase de captura: recibimos el evento antes que la página
    document.addEventListener("mouseover", alPasarCursor, true);
    document.addEventListener("click", alHacerClic, true);
    document.addEventListener("mouseup", alSoltar);
    document.addEventListener("keydown", alPresionarTecla);
    document.documentElement.style.cursor = "help";

    // Limpieza: se ejecuta al desactivar el widget o al desmontarlo
    return () => {
      document.removeEventListener("mouseover", alPasarCursor, true);
      document.removeEventListener("click", alHacerClic, true);
      document.removeEventListener("mouseup", alSoltar);
      document.removeEventListener("keydown", alPresionarTecla);
      document.documentElement.style.cursor = "";
      quitarResaltado();
    };
  }, [activo, color, raizRef]);
}
