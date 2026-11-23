#!/usr/bin/env python3
"""
cargar_dataset_prueba.py — Carga dataset/prueba/ como arreglos NumPy para el
reconocedor de la tesis (y lo exporta a .npz).

    X[i]  : (T_i, 108) float32  -> 102 coordenadas normalizadas 0..1 (-1 ausente) + 6 NM en -1..1
    y[i]  : (T_i,)     int      -> índice de etiqueta por frame (vocabulario en 'vocab')
    seq[i]: lista de glosas sin transiciones (objetivo para CTC)

Uso:
    python cargar_dataset_prueba.py            # resumen
    python cargar_dataset_prueba.py --npz      # además guarda dataset/prueba/prueba.npz
"""
import argparse
import glob
import json
import os

import numpy as np

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dataset", "prueba"))


def cargar(base=BASE):
    muestras = [json.load(open(p, encoding="utf-8")) for p in sorted(glob.glob(os.path.join(base, "muestras", "*.json")))]
    vocab = sorted({e for m in muestras for e in m["etiquetas_frame"]}, key=lambda g: (not g.startswith("<"), g))
    idx = {g: i for i, g in enumerate(vocab)}
    X, y, seq, ids = [], [], [], []
    for m in muestras:
        a = np.array(m["frames"], dtype=np.float32)
        coords = a[:, :102]
        coords = np.where(coords < 0, -1.0, coords / 1000.0)
        nm = a[:, 102:108] / 100.0
        X.append(np.concatenate([coords, nm], axis=1))
        y.append(np.array([idx[e] for e in m["etiquetas_frame"]], dtype=np.int64))
        seq.append([s["glosa"] for s in m["segmentos"] if not s["glosa"].startswith("<")])
        ids.append(m["id"])
    return X, y, seq, ids, vocab


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--npz", action="store_true")
    a = ap.parse_args()
    X, y, seq, ids, vocab = cargar()
    print(f"Muestras: {len(X)}  ·  vocabulario: {len(vocab)} etiquetas  ·  dim: {X[0].shape[1]}")
    for i in range(0, len(X), 5):
        print(f"  {ids[i]}: T={X[i].shape[0]:3d}  secuencia={' '.join(seq[i])}")
    if a.npz:
        ruta = os.path.join(BASE, "prueba.npz")
        np.savez_compressed(ruta, X=np.array(X, dtype=object), y=np.array(y, dtype=object),
                            ids=np.array(ids), vocab=np.array(vocab), seq=np.array([" ".join(s) for s in seq]))
        print("Guardado:", ruta)


if __name__ == "__main__":
    main()
