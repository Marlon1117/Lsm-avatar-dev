#!/usr/bin/env python3
"""
construir_diccionario.py
---------------------------------------------------------------
Une el glosario (dataset/glosario.csv) con los clips de señas
(dataset/senas/*.json, sintéticos o capturados con MediaPipe) y
genera web/lsm-diccionario.js, que carga el widget en el navegador.

El archivo resultante define:
  window.LSM_DICCIONARIO = {
     version, fps, generado,
     glosas:   { GLOSA: {cat, nm, origen, frames:[...]}, ... },
     alfabeto: { "A": {frames}, ..., "0": {frames}, ... },
     lexico:   { "palabra_normalizada": "GLOSA", ... }
  }

Uso:
    python construir_diccionario.py
"""
import csv
import glob
import json
import os
import unicodedata
from datetime import date

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
GLOSARIO = os.path.join(BASE, "dataset", "glosario.csv")
SENAS = os.path.join(BASE, "dataset", "senas")
SALIDA = os.path.join(BASE, "web", "lsm-diccionario.js")


def clave(s):
    s = unicodedata.normalize("NFD", s.lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


def cargar_clip(glosa):
    ruta = os.path.join(SENAS, f"{glosa}.json")
    if not os.path.exists(ruta):
        return None
    with open(ruta, encoding="utf-8") as f:
        return json.load(f)


def main():
    glosas, lexico, faltantes, fps = {}, {}, [], 15
    with open(GLOSARIO, encoding="utf-8") as f:
        for fila in csv.DictReader(f):
            g = fila["glosa"].strip()
            clip = cargar_clip(g)
            if clip is None:
                faltantes.append(g)
                continue
            fps = clip.get("fps", fps)
            glosas[g] = {
                "cat": fila["categoria"],
                "nm": fila["no_manual"] or None,
                "origen": clip.get("origen", "desconocido"),
                "frames": clip["frames"],
            }
            for palabra in fila["palabras_es"].split("|"):
                palabra = palabra.strip()
                if palabra:
                    lexico.setdefault(clave(palabra), g)

    alfabeto = {}
    for ruta in sorted(glob.glob(os.path.join(SENAS, "DT-*.json"))):
        with open(ruta, encoding="utf-8") as f:
            clip = json.load(f)
        letra = clip["glosa"][3:]
        alfabeto[letra] = {"origen": clip.get("origen"), "frames": clip["frames"]}

    dic = {"version": "0.1", "fps": fps, "generado": date.today().isoformat(),
           "glosas": glosas, "alfabeto": alfabeto, "lexico": lexico}
    with open(SALIDA, "w", encoding="utf-8") as f:
        f.write("/* Generado por scripts/construir_diccionario.py — no editar a mano */\n")
        f.write("window.LSM_DICCIONARIO = ")
        json.dump(dic, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")
    kb = os.path.getsize(SALIDA) / 1024
    reales = sum(1 for g in glosas.values() if g["origen"] == "mediapipe")
    print(f"Glosas: {len(glosas)} (capturadas: {reales}, sintéticas: {len(glosas) - reales})")
    print(f"Letras/dígitos: {len(alfabeto)} | Entradas de léxico: {len(lexico)} | {kb:.0f} KB")
    if faltantes:
        print("Sin clip (se deletrearán):", ", ".join(faltantes))


if __name__ == "__main__":
    main()
