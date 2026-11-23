/**
 * embed.jsx — Versión "un solo script" del widget, para pegar en CUALQUIER
 * página (aunque no use React), igual que VLibras:
 *
 *   <script charset="utf-8"
 *           src="https://marlon1117.github.io/Lsm-avatar-dev/demo/widget/lsm-widget.js"
 *           data-auto="true" data-color="#0b6e4f"></script>
 *
 * charset="utf-8" es importante: el código incluye acentos y la ñ.
 *
 * Atributos opcionales del <script>:
 *   data-diccionario  URL de lsm-diccionario.json (por defecto, junto al script: ../)
 *   data-color        color principal
 *   data-posicion     "derecha" | "izquierda"
 *
 * El widget se monta dentro de un Shadow DOM para que los estilos de la
 * página no lo afecten (y viceversa).
 */

import { createRoot } from "react-dom/client";
import LSMWidget from "./components/LSMWidget.jsx";
import estilos from "./styles/widget.css?inline"; // el CSS como texto

const script = document.currentScript;

function montar(opciones = {}) {
  // URL del diccionario: atributo, opción, o la carpeta superior al script
  const base = script ? new URL("../", script.src).href : "./";
  const urlDiccionario =
    opciones.diccionario || script?.getAttribute("data-diccionario") || `${base}lsm-diccionario.json`;

  const anfitrion = document.createElement("div");
  anfitrion.id = "lsm-widget-anfitrion";
  document.body.appendChild(anfitrion);
  const sombra = anfitrion.attachShadow({ mode: "open" });

  const estilo = document.createElement("style");
  estilo.textContent = estilos;
  sombra.appendChild(estilo);

  const contenedor = document.createElement("div");
  sombra.appendChild(contenedor);

  createRoot(contenedor).render(
    <LSMWidget
      urlDiccionario={urlDiccionario}
      color={opciones.color || script?.getAttribute("data-color") || undefined}
      posicion={opciones.posicion || script?.getAttribute("data-posicion") || undefined}
    />
  );
}

// API pública: window.LSMWidget.montar() y window.LSMWidget.traducir("texto")
window.LSMWidget = {
  montar,
  traducir: (texto) => document.dispatchEvent(new CustomEvent("lsm:traducir", { detail: texto })),
};

if (script && script.getAttribute("data-auto") === "true") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => montar());
  else montar();
}
