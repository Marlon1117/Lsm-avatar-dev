#!/usr/bin/env python3
"""
reconocedor_base_dtw.py
---------------------------------------------------------------------------
RECONOCEDOR BASE de señas aisladas, de bajo costo computacional:
k-vecino más cercano con DTW (Dynamic Time Warping) sobre keypoints.

Sirve como punto de partida y como ejemplo de CÓMO SE USA EL DATASET para
reconocimiento (seña → glosa), el camino inverso al del avatar.

    plantillas  = un clip por glosa       (dataset/senas/<GLOSA>.json)
    pruebas     = segmentos etiquetados   (dataset/prueba/muestras/*.json)

Para cada segmento de prueba que sea una seña, se compara contra TODAS las
plantillas con DTW y se elige la más parecida. Se reporta la exactitud.

Por qué DTW: dos personas hacen la misma seña a distinta velocidad. DTW
"estira" el tiempo para alinear las dos secuencias antes de compararlas,
sin necesidad de entrenar una red neuronal ni usar GPU.

Características por frame (invariantes a posición y tamaño de la persona):
    puntos de ambas manos y muñecas, con origen en el centro de los hombros
    y divididos entre el ancho de hombros → vector de 2 x (21 + 21 + 2) = 88

IMPORTANTE: con el dataset de prueba actual (sintético, hecho con las mismas
plantillas) la exactitud será casi perfecta. Eso solo prueba que el pipeline
funciona. La evaluación real requiere videos de señantes reales.

Uso:
    python reconocedor_base_dtw.py
    python reconocedor_base_dtw.py --banda 0.2 --submuestreo 2
"""
import argparse
import glob
import json
import os
import time
from collections import Counter

import numpy as np

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SENAS = os.path.join(RAIZ, "dataset", "senas")
PRUEBA = os.path.join(RAIZ, "dataset", "prueba", "muestras")

# Índices (en valores, no en puntos) dentro de un frame de 108 números
HOMBRO_D = (2, 3)       # punto 1
HOMBRO_I = (4, 5)       # punto 2
MUNECAS = [10, 11, 12, 13]  # puntos 5 y 6 (muñeca D e I)
MANOS = slice(18, 102)  # puntos 9..50 (mano D + mano I)


# ---------------------------------------------------------------------------
# 1. Características
# ---------------------------------------------------------------------------
def caracteristicas(frames, submuestreo=1):
    """
    Convierte una lista de frames (T x 108) en una matriz (T' x 88)
    normalizada respecto a los hombros.
    """
    a = np.asarray(frames, dtype=np.float32)[::submuestreo]
    hd = a[:, HOMBRO_D]
    hi = a[:, HOMBRO_I]
    centro = (hd + hi) / 2                                   # (T, 2)
    ancho = np.linalg.norm(hi - hd, axis=1, keepdims=True)   # (T, 1)
    ancho[ancho < 1] = 1

    puntos = np.concatenate([a[:, MUNECAS], a[:, MANOS]], axis=1)  # (T, 88)
    xy = puntos.reshape(len(a), -1, 2)
    faltantes = xy[..., 0] < 0
    xy = (xy - centro[:, None, :]) / ancho[:, None, :]
    xy[faltantes] = 0.0                                      # punto no detectado
    return xy.reshape(len(a), -1)


# ---------------------------------------------------------------------------
# 2. DTW con banda de Sakoe-Chiba
# ---------------------------------------------------------------------------
def dtw(a, b, banda=0.25):
    """
    Distancia DTW entre dos secuencias (Ta x D) y (Tb x D).
    banda: fracción del largo que se permite "desfasar" (acelera y evita
    alineaciones absurdas). Devuelve la distancia normalizada por el camino.
    """
    n, m = len(a), len(b)
    w = max(int(banda * max(n, m)), abs(n - m)) + 1
    # costo local: distancia euclidiana entre frames
    costo = np.sqrt(((a[:, None, :] - b[None, :, :]) ** 2).sum(-1))
    acum = np.full((n + 1, m + 1), np.inf, dtype=np.float32)
    acum[0, 0] = 0.0
    for i in range(1, n + 1):
        j0, j1 = max(1, i - w), min(m, i + w)
        for j in range(j0, j1 + 1):
            acum[i, j] = costo[i - 1, j - 1] + min(acum[i - 1, j], acum[i, j - 1], acum[i - 1, j - 1])
    return float(acum[n, m] / (n + m))


# ---------------------------------------------------------------------------
# 3. Cargar plantillas y pruebas
# ---------------------------------------------------------------------------
def cargar_plantillas(submuestreo):
    plantillas = {}
    for ruta in sorted(glob.glob(os.path.join(SENAS, "*.json"))):
        clip = json.load(open(ruta, encoding="utf-8"))
        if clip["glosa"].startswith("DT-"):
            continue  # este ejemplo reconoce señas, no letras
        plantillas[clip["glosa"]] = caracteristicas(clip["frames"], submuestreo)
    return plantillas


def cargar_segmentos_de_prueba(submuestreo):
    """Corta cada muestra continua en sus segmentos de seña (usa las etiquetas)."""
    segmentos = []
    for ruta in sorted(glob.glob(os.path.join(PRUEBA, "*.json"))):
        m = json.load(open(ruta, encoding="utf-8"))
        for s in m["segmentos"]:
            g = s["glosa"]
            if g.startswith("<") or g.startswith("DT-"):
                continue
            frames = m["frames"][s["inicio"]: s["fin"] + 1]
            if len(frames) >= 3:
                segmentos.append((m["id"], g, caracteristicas(frames, submuestreo)))
    return segmentos


# ---------------------------------------------------------------------------
# 4. Evaluación
# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--banda", type=float, default=0.25)
    ap.add_argument("--submuestreo", type=int, default=1, help="usar 1 de cada N frames (más rápido)")
    args = ap.parse_args()

    plantillas = cargar_plantillas(args.submuestreo)
    pruebas = cargar_segmentos_de_prueba(args.submuestreo)
    print(f"Plantillas: {len(plantillas)} glosas · Segmentos de prueba: {len(pruebas)}")

    aciertos, errores = 0, Counter()
    inicio = time.perf_counter()
    for muestra, verdadera, x in pruebas:
        distancias = {g: dtw(x, p, args.banda) for g, p in plantillas.items()}
        predicha = min(distancias, key=distancias.get)
        if predicha == verdadera:
            aciertos += 1
        else:
            errores[(verdadera, predicha)] += 1
    duracion = time.perf_counter() - inicio

    print(f"Exactitud: {aciertos}/{len(pruebas)} = {100 * aciertos / max(1, len(pruebas)):.1f} %")
    print(f"Tiempo: {1000 * duracion / max(1, len(pruebas)):.1f} ms por segmento (CPU, sin GPU)")
    if errores:
        print("Confusiones más frecuentes (verdadera → predicha):")
        for (v, p), n in errores.most_common(8):
            print(f"  {v} → {p}: {n}")
    print("Nota: datos sintéticos; la exactitud real se mide con señantes reales.")


if __name__ == "__main__":
    main()
