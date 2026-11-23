/**
 * colores.js — Paleta del avatar y una utilidad para aclarar/oscurecer.
 */

/** Tonos de piel: base, iluminado, sombra y contorno. */
export const PIEL = {
  base: "#d9a07e",
  luz: "#efc3a2",
  sombra: "#b47a5a",
  linea: "#9a6347",
};

/** Ropa por defecto: lisa y oscura, como la de los intérpretes de LSM. */
export const ROPA_POR_DEFECTO = "#26313d";

/** Degradado del fondo (centro → orilla). */
export const FONDO_POR_DEFECTO = ["#f3f6f4", "#dfe8e3"];

/** Colores del rostro. */
export const ROSTRO = {
  cabelloOscuro: "#2a1d16",
  cabelloClaro: "#3d2a1f",
  cejas: "#2f2017",
  iris: "#5a3b25",
  pupila: "#1b120c",
  esclerotica: "#fbfaf7",
  parpado: "#3a2418",
  labios: "#b4584b",
  labiosCerrados: "#8e3f36",
  interiorBoca: "#4a1c1a",
  dientes: "#f4f1ea",
  lengua: "#c0605a",
};

/**
 * Aclara u oscurece un color hexadecimal.
 * @param {string} hex     "#26313d"
 * @param {number} factor  > 0 aclara (hacia blanco), < 0 oscurece (hacia negro)
 * @returns {string}       "rgb(r,g,b)"
 */
export function tono(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const canales = [n >> 16, (n >> 8) & 255, n & 255];
  const ajustar = (v) => {
    const nuevo = factor > 0 ? v + (255 - v) * factor : v * (1 + factor);
    return Math.max(0, Math.min(255, Math.round(nuevo)));
  };
  return `rgb(${canales.map(ajustar).join(",")})`;
}
