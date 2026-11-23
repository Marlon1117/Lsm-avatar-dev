/**
 * utilidades.mjs
 * ---------------------------------------------------------------------------
 * Funciones compartidas por los scripts de Node del dataset:
 *   - rutas del proyecto
 *   - cargar el diccionario (app/public/lsm-diccionario.json)
 *   - leer y escribir archivos CSV sin dependencias externas
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Carpeta raíz del repositorio (un nivel arriba de /scripts). */
export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Rutas usadas por varios scripts. */
export const RUTAS = {
  diccionario: path.join(RAIZ, "app", "public", "lsm-diccionario.json"),
  dataset: path.join(RAIZ, "dataset"),
  prueba: path.join(RAIZ, "dataset", "prueba"),
};

/** Lee el diccionario generado por scripts/construir_diccionario.py. */
export function cargarDiccionario() {
  if (!fs.existsSync(RUTAS.diccionario)) {
    throw new Error("No existe el diccionario. Ejecuta antes: python scripts/construir_diccionario.py");
  }
  return JSON.parse(fs.readFileSync(RUTAS.diccionario, "utf8"));
}

/**
 * Convierte el texto de un CSV en una lista de objetos { columna: valor }.
 * Soporta campos entre comillas con comas y comillas dobles ("").
 */
export function leerCSV(rutaArchivo) {
  const texto = fs.readFileSync(rutaArchivo, "utf8");
  const filas = [];
  let fila = [];
  let campo = "";
  let entreComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (entreComillas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"'; // comilla escapada
        i++;
      } else if (c === '"') {
        entreComillas = false;
      } else {
        campo += c;
      }
    } else if (c === '"') {
      entreComillas = true;
    } else if (c === ",") {
      fila.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texto[i + 1] === "\n") i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else {
      campo += c;
    }
  }
  if (campo || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }

  const [encabezados, ...datos] = filas.filter((f) => f.some((v) => v !== ""));
  return datos.map((f) => Object.fromEntries(encabezados.map((h, i) => [h, f[i] ?? ""])));
}

/** Pone comillas a un valor si contiene comas, comillas o saltos de línea. */
function escaparCSV(valor) {
  const texto = String(valor ?? "");
  return /[",\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

/**
 * Escribe una lista de objetos como CSV.
 * @param {string}   rutaArchivo
 * @param {string[]} columnas  orden de las columnas
 * @param {object[]} filas
 */
export function escribirCSV(rutaArchivo, columnas, filas) {
  const lineas = [columnas.join(",")];
  for (const fila of filas) lineas.push(columnas.map((c) => escaparCSV(fila[c])).join(","));
  fs.writeFileSync(rutaArchivo, lineas.join("\n") + "\n");
}
