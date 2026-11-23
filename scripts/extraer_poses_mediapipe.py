#!/usr/bin/env python3
"""
extraer_poses_mediapipe.py
---------------------------------------------------------------
Convierte videos de señas grabados por intérpretes de LSM en clips de
keypoints que el avatar del widget reproduce directamente.

    video  ──MediaPipe Holistic──►  pose(33) + manos(21+21) + cara(468)
           ──selección/normalización/suavizado/remuestreo──►
           dataset/senas/<GLOSA>.json   (mismo formato que los sintéticos)

Convención de archivos de entrada (una seña por video):
    videos/<GLOSA>__<ID_SEÑANTE>__<REPETICION>.mp4
    p. ej.  videos/GRACIAS__S01__r1.mp4

Si existen varias repeticiones/señantes de la misma glosa se elige la de
mejor calidad (más frames con ambas manos detectadas) y se guardan TODAS
en dataset/capturas/ para entrenamiento/evaluación del reconocedor de la
tesis (el mismo dato sirve para reconocimiento y para síntesis).

Requisitos:
    pip install mediapipe opencv-python numpy
    - mediapipe <= 0.10.21 trae la API clásica "solutions.holistic" (se usa si existe).
    - mediapipe >= 0.10.30 solo trae la API "Tasks": el script descarga
      automáticamente los modelos .task (pose, mano, cara) a scripts/modelos/.

Uso:
    python extraer_poses_mediapipe.py --videos ../videos --salida ../dataset/senas
    python construir_diccionario.py      # regenera app/public/lsm-diccionario.json
"""
import argparse
import glob
import json
import os
import re

import cv2
import numpy as np

try:
    import mediapipe as mp
except ImportError:  # pragma: no cover
    mp = None

FPS_SALIDA = 15
POSE_IDX = [0, 12, 11, 14, 13, 16, 15, 24, 23]
# Orden del formato: nariz, hombro D, hombro I, codo D, codo I, muñeca D, muñeca I, cadera D, cadera I
# (MediaPipe numera desde el punto de vista de la persona: 12 = hombro derecho)
HOMBRO_D_OBJ = np.array([0.38, 0.42])
HOMBRO_I_OBJ = np.array([0.62, 0.42])
ANCHO_HOMBROS_OBJ = np.linalg.norm(HOMBRO_I_OBJ - HOMBRO_D_OBJ)

# Landmarks de cara (FaceMesh, 468 puntos) para los 6 canales no manuales
CEJA_D, OJO_D, CEJA_I, OJO_I = 105, 159, 334, 386     # ceja / párpado superior
CEJA_INT_D, CEJA_INT_I = 55, 285                       # extremos internos de las cejas
OJO_EXT_D, OJO_EXT_I = 33, 263                         # comisuras externas de los ojos
LABIO_SUP, LABIO_INF, COMIS_D, COMIS_I, NARIZ_F = 13, 14, 61, 291, 1


# ------------------------------------------------------------------
# Detectores: API clásica (Holistic) o API Tasks (Pose + Hand + Face)
# Ambos devuelven listas de (x, y) normalizadas 0..1 o None.
# ------------------------------------------------------------------
MODELOS = {
    "pose": "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task",
    "hand": "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
    "face": "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
}


def _xy(lms):
    return None if not lms else [(p.x, p.y) for p in lms]


class DetectorHolistic:
    def __init__(self):
        self.h = mp.solutions.holistic.Holistic(model_complexity=1, refine_face_landmarks=False)

    def __call__(self, rgb, ts_ms):
        r = self.h.process(rgb)
        g = lambda x: _xy(x.landmark) if x is not None else None
        # En Holistic, right_hand_landmarks es la mano derecha del señante
        return {"pose": g(r.pose_landmarks), "rh": g(r.right_hand_landmarks),
                "lh": g(r.left_hand_landmarks), "face": g(r.face_landmarks)}

    def close(self):
        self.h.close()


class DetectorTasks:
    def __init__(self, dir_modelos):
        import urllib.request
        from mediapipe.tasks.python import BaseOptions
        from mediapipe.tasks.python import vision as V
        os.makedirs(dir_modelos, exist_ok=True)
        rutas = {}
        for k, url in MODELOS.items():
            rutas[k] = os.path.join(dir_modelos, os.path.basename(url))
            if not os.path.exists(rutas[k]):
                print(f"  descargando modelo {k}…")
                urllib.request.urlretrieve(url, rutas[k])
        vid = V.RunningMode.VIDEO
        self.V = V
        self.pose = V.PoseLandmarker.create_from_options(V.PoseLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=rutas["pose"]), running_mode=vid, num_poses=1))
        self.hand = V.HandLandmarker.create_from_options(V.HandLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=rutas["hand"]), running_mode=vid, num_hands=2))
        self.face = V.FaceLandmarker.create_from_options(V.FaceLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=rutas["face"]), running_mode=vid, num_faces=1))

    def __call__(self, rgb, ts_ms):
        img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        rp = self.pose.detect_for_video(img, ts_ms)
        rh = self.hand.detect_for_video(img, ts_ms)
        rf = self.face.detect_for_video(img, ts_ms)
        pose = _xy(rp.pose_landmarks[0]) if rp.pose_landmarks else None
        manos = [_xy(h) for h in rh.hand_landmarks]
        der, izq = asignar_manos(pose, manos)
        return {"pose": pose, "rh": der, "lh": izq,
                "face": _xy(rf.face_landmarks[0]) if rf.face_landmarks else None}

    def close(self):
        for d in (self.pose, self.hand, self.face):
            d.close()


def asignar_manos(pose, manos):
    """Asigna cada mano detectada a la muñeca de Pose más cercana
    (más robusto que la etiqueta 'Left/Right', que asume imagen en espejo)."""
    if not manos:
        return None, None
    if pose is None:
        return (manos[0], manos[1] if len(manos) > 1 else None)
    md, mi = np.array(pose[16]), np.array(pose[15])  # muñeca derecha / izquierda del señante
    der = izq = None
    for m in manos:
        w = np.array(m[0])
        if np.linalg.norm(w - md) <= np.linalg.norm(w - mi):
            if der is None:
                der = m
            else:
                izq = izq or m
        else:
            if izq is None:
                izq = m
            else:
                der = der or m
    return der, izq


def crear_detector(dir_modelos):
    if mp is None:
        raise SystemExit("Instala mediapipe:  pip install mediapipe opencv-python numpy")
    if hasattr(mp, "solutions") and hasattr(mp.solutions, "holistic"):
        return DetectorHolistic()
    return DetectorTasks(dir_modelos)


def extraer_video(ruta, detector):
    cap = cv2.VideoCapture(ruta)
    fps_in = cap.get(cv2.CAP_PROP_FPS) or 30.0
    w = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
    h = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
    asp = w / h if h else 1.0
    frames, i = [], 0
    while True:
        ok, img = cap.read()
        if not ok:
            break
        det = detector(cv2.cvtColor(img, cv2.COLOR_BGR2RGB), int(i * 1000 / fps_in))
        frames.append(convertir(det, asp))
        i += 1
    cap.release()
    return frames, fps_in


def pts(lista, idx=None, asp=1.0):
    if lista is None:
        return None
    sel = lista if idx is None else [lista[i] for i in idx]
    # corregir relación de aspecto para que x e y estén en la misma escala
    return np.array([[x * asp, y] for x, y in sel], dtype=np.float32)


INVERTIR_MANOS = False  # se activa con --invertir-manos


def convertir(det, asp):
    pose = pts(det["pose"], POSE_IDX, asp)
    rh = pts(det["rh"], asp=asp)
    lh = pts(det["lh"], asp=asp)
    # Mano dominante = derecha del señante. Si el señante es zurdo, usa --invertir-manos.
    if INVERTIR_MANOS:
        rh, lh = lh, rh
    rasgos = None
    f = det.get("face")
    if f is not None:
        F = np.array(f)
        d = np.linalg.norm(F[OJO_EXT_D] - F[OJO_EXT_I]) or 1e-6   # distancia interocular
        ojo_y = (F[OJO_EXT_D][1] + F[OJO_EXT_I][1]) / 2
        ojo_x = (F[OJO_EXT_D][0] + F[OJO_EXT_I][0]) / 2
        boca_y = (F[LABIO_SUP][1] + F[LABIO_INF][1]) / 2
        rasgos = np.array([
            ((F[OJO_D][1] - F[CEJA_D][1]) + (F[OJO_I][1] - F[CEJA_I][1])) / 2 / d,  # cejas arriba
            np.linalg.norm(F[CEJA_INT_D] - F[CEJA_INT_I]) / d,                     # separación cejas
            np.linalg.norm(F[LABIO_SUP] - F[LABIO_INF]) / d,                        # apertura de boca
            (boca_y - (F[COMIS_D][1] + F[COMIS_I][1]) / 2) / d,                     # comisuras
            (F[NARIZ_F][0] - ojo_x) / d,                                            # giro
            (F[NARIZ_F][1] - ojo_y) / d,                                            # asentir
        ])
    return {"pose": pose, "rh": rh, "lh": lh, "rasgos": rasgos}


def normalizar(frames):
    """Traslada y escala para que los hombros caigan en la posición del avatar."""
    hombros = [f["pose"][1:3] for f in frames if f["pose"] is not None]
    if not hombros:
        return None
    hd = np.median([h[0] for h in hombros], axis=0)
    hi = np.median([h[1] for h in hombros], axis=0)
    escala = ANCHO_HOMBROS_OBJ / max(np.linalg.norm(hi - hd), 1e-6)
    centro_src = (hd + hi) / 2
    centro_obj = (HOMBRO_D_OBJ + HOMBRO_I_OBJ) / 2
    # Nota: en el video sin espejo, el hombro derecho del señante aparece a la izquierda
    # del espectador, igual que en el avatar; no se refleja.
    def T(a):
        return None if a is None else (a - centro_src) * escala + centro_obj
    # Rostro neutro = promedio de los primeros frames (el protocolo inicia en reposo)
    ras = [f["rasgos"] for f in frames if f["rasgos"] is not None]
    neutro = np.mean(ras[:6], axis=0) if ras else None
    out = []
    for f in frames:
        nm = [0.0] * 6
        r = f["rasgos"]
        if r is not None and neutro is not None:
            nm = [
                float(np.clip((r[0] / neutro[0] - 1.0) / 0.25, 0, 1)),   # +25 % ≈ cejas arriba
                float(np.clip((1.0 - r[1] / neutro[1]) / 0.12, 0, 1)),   # -12 % ≈ ceño fruncido
                float(np.clip(r[2] / 0.35, 0, 1)),                       # apertura de boca
                float(np.clip((r[3] - neutro[3]) / 0.05, -1, 1)),        # sonrisa / boca abajo
                float(np.clip((r[4] - neutro[4]) / 0.15, -1, 1)),        # giro de cabeza
                float(np.clip((r[5] - neutro[5]) / 0.10, -1, 1)),        # asentir
            ]
        out.append({"pose": T(f["pose"]), "rh": T(f["rh"]), "lh": T(f["lh"]), "nm": nm})
    return out


def rellenar(frames, clave, n):
    """Interpola huecos cortos (manos no detectadas por desenfoque) y mantiene el resto."""
    vals = [f[clave] for f in frames]
    idx = [i for i, v in enumerate(vals) if v is not None]
    if not idx:
        return [None] * len(vals)
    out = list(vals)
    for a, b in zip(idx, idx[1:]):
        if 1 < b - a <= 8:  # hueco de hasta ~0.25 s a 30 fps
            for k in range(a + 1, b):
                t = (k - a) / (b - a)
                out[k] = vals[a] * (1 - t) + vals[b] * t
    return out


def suavizar(serie, ventana=3):
    res = []
    for i in range(len(serie)):
        vec = [serie[j] for j in range(max(0, i - ventana // 2), min(len(serie), i + ventana // 2 + 1)) if serie[j] is not None]
        res.append(None if serie[i] is None or not vec else np.mean(vec, axis=0))
    return res


def recortar_actividad(frames, umbral=0.02):
    """Quita los tramos inicial/final en reposo (manos abajo y quietas)."""
    def activo(f):
        m = [x for x in (f["rh"], f["lh"]) if x is not None]
        return any(x[0][1] < 0.70 for x in m)  # muñeca por encima de la cintura
    act = [i for i, f in enumerate(frames) if activo(f)]
    if not act:
        return frames
    a, b = max(act[0] - 3, 0), min(act[-1] + 4, len(frames))
    return frames[a:b]


def remuestrear(frames, fps_in, fps_out=FPS_SALIDA):
    n_out = max(2, int(round(len(frames) * fps_out / fps_in)))
    pos = np.linspace(0, len(frames) - 1, n_out)
    return [frames[int(round(p))] for p in pos]


def codificar(f):
    flat = []
    for clave, n in (("pose", 9), ("rh", 21), ("lh", 21)):
        a = f[clave]
        if a is None:
            flat += [-1, -1] * n
        else:
            for x, y in a:
                flat += [int(round(float(x) * 1000)), int(round(float(y) * 1000))]
    flat += [int(round(v * 100)) for v in f["nm"]]
    return flat


def procesar(ruta, detector):
    crudos, fps_in = extraer_video(ruta, detector)
    return postprocesar(crudos, fps_in)


def postprocesar(crudos, fps_in):
    fr = normalizar(crudos)
    if fr is None:
        return None, 0.0
    for clave in ("pose", "rh", "lh"):
        serie = suavizar(rellenar(fr, clave, len(fr)))
        for f, v in zip(fr, serie):
            f[clave] = v
    fr = recortar_actividad(fr)
    fr = remuestrear(fr, fps_in)
    calidad = np.mean([(f["rh"] is not None) + 0.5 * (f["lh"] is not None) for f in fr]) / 1.5
    return [codificar(f) for f in fr], float(calidad)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--videos", required=True)
    ap.add_argument("--salida", default=os.path.join(os.path.dirname(__file__), "..", "dataset", "senas"))
    ap.add_argument("--capturas", default=os.path.join(os.path.dirname(__file__), "..", "dataset", "capturas"))
    ap.add_argument("--invertir-manos", action="store_true", help="Intercambia mano dominante/no dominante")
    args = ap.parse_args()
    global INVERTIR_MANOS
    INVERTIR_MANOS = args.invertir_manos
    os.makedirs(args.salida, exist_ok=True)
    os.makedirs(args.capturas, exist_ok=True)

    patron = re.compile(r"^(?P<glosa>[^_]+(?:-[^_]+)*)__(?P<senante>[^_]+)__(?P<rep>[^.]+)\.(mp4|mov|avi|webm)$", re.I)
    por_glosa = {}
    for ruta in sorted(glob.glob(os.path.join(args.videos, "*"))):
        m = patron.match(os.path.basename(ruta))
        if not m:
            print("  (omitido, nombre no válido)", os.path.basename(ruta))
            continue
        por_glosa.setdefault(m["glosa"].upper(), []).append((ruta, m["senante"], m["rep"]))

    det = crear_detector(os.path.join(os.path.dirname(os.path.abspath(__file__)), "modelos"))
    try:
        for glosa, lista in por_glosa.items():
            mejor = None
            for ruta, senante, rep in lista:
                frames, q = procesar(ruta, det)
                if frames is None:
                    print(f"  ✗ {os.path.basename(ruta)}: no se detectó a la persona")
                    continue
                with open(os.path.join(args.capturas, f"{glosa}__{senante}__{rep}.json"), "w", encoding="utf-8") as f:
                    json.dump({"glosa": glosa, "senante": senante, "rep": rep, "fps": FPS_SALIDA,
                               "calidad": round(q, 3), "frames": frames}, f, separators=(",", ":"))
                if mejor is None or q > mejor[1]:
                    mejor = (frames, q, senante, rep)
                print(f"  ✓ {glosa:<14} {senante}/{rep}  frames={len(frames):3d}  calidad={q:.2f}")
            if mejor:
                with open(os.path.join(args.salida, f"{glosa}.json"), "w", encoding="utf-8") as f:
                    json.dump({"glosa": glosa, "fps": FPS_SALIDA, "origen": "mediapipe",
                               "senante": mejor[2], "rep": mejor[3], "frames": mejor[0]},
                              f, ensure_ascii=False, separators=(",", ":"))
    finally:
        det.close()
    print("Listo. Ejecuta ahora: python construir_diccionario.py")


if __name__ == "__main__":
    main()
