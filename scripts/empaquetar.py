#!/usr/bin/env python3
"""
empaquetar.py — Une diccionario + traductor + secuenciador + avatar + widget en
web/lsm-todo-en-uno.js, para integrar el traductor con UNA sola etiqueta:

    <script src="lsm-todo-en-uno.js" data-auto="true"></script>

Ejecutar después de construir_diccionario.py.
"""
import os
BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "web"))
PARTES = ["lsm-diccionario.js", "traductor-lsm.js", "secuencia-lsm.js", "avatar-lsm.js", "lsm-widget.js"]
with open(os.path.join(BASE, "lsm-todo-en-uno.js"), "w", encoding="utf-8") as out:
    out.write("/* lsm-todo-en-uno.js — generado por scripts/empaquetar.py */\n")
    for p in PARTES:
        with open(os.path.join(BASE, p), encoding="utf-8") as f:
            out.write(f"\n/* ===== {p} ===== */\n" + f.read() + "\n")
print("web/lsm-todo-en-uno.js:", round(os.path.getsize(os.path.join(BASE, "lsm-todo-en-uno.js")) / 1024), "KB")
