/**
 * vite.widget.config.js — Compila el widget como UN solo archivo JavaScript
 * (../demo/widget/lsm-widget.js) que incluye React, para insertarlo en
 * cualquier página con una etiqueta <script>. Ver src/embed.jsx.
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  esbuild: { charset: "ascii" }, // ver vite.config.js
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  publicDir: false, // el diccionario ya lo copia la compilación principal
  build: {
    outDir: "../demo/widget",
    emptyOutDir: true,
    lib: {
      entry: "src/embed.jsx",
      name: "LSMWidgetBundle",
      formats: ["iife"],
      fileName: () => "lsm-widget.js",
    },
  },
});
