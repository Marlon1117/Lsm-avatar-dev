/**
 * vite.config.js — Compilación de la app de demostración.
 *
 *   npm run dev    → servidor local con recarga automática (http://localhost:5173)
 *   npm run build  → genera ../demo/ (lo que publica GitHub Pages)
 *
 * base: "./" hace que todas las rutas sean relativas, así la app funciona
 * igual en GitHub Pages (/Lsm-avatar-dev/demo/) que en cualquier carpeta.
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  // Escapar acentos y ñ en el JS generado (\u00f1...) para que funcione
  // aunque el servidor no declare la codificación UTF-8.
  esbuild: { charset: "ascii" },
  build: {
    outDir: "../demo",
    emptyOutDir: true,
  },
});
