#!/usr/bin/env python3
"""
generar_senas_sinteticas.py
---------------------------------------------------------------
Genera clips de señas SINTÉTICOS (placeholders) en el MISMO formato
de keypoints que produce `extraer_poses_mediapipe.py` a partir de
videos reales de intérpretes de LSM.

¿Por qué? Para que el prototipo (widget tipo VLibras) funcione desde
el día 1 mientras se graban y validan las señas reales. Cada clip
sintético se reemplaza después por su versión capturada: basta con
guardar el JSON real con el mismo nombre de glosa en dataset/senas/.

IMPORTANTE: los movimientos de este archivo son APROXIMACIONES
ilustrativas. NO son señas validadas de LSM. Deben revisarse con
intérpretes certificados y personas de la comunidad Sorda.

Formato de salida (dataset/senas/<GLOSA>.json):
{
  "glosa": "GRACIAS",
  "fps": 15,
  "origen": "sintetico" | "mediapipe",
  "frames": [[x0,y0,x1,y1,..., cejas], ...]
}
Cada frame = 51 puntos (x,y) normalizados 0..1000 (enteros) + 6 canales
NO MANUALES (gesticulación facial y de cabeza):
  - 9 puntos de pose: nariz, hombro D, hombro I, codo D, codo I,
    muñeca D, muñeca I, cadera D, cadera I (subconjunto de MediaPipe Pose)
  - 21 puntos mano dominante (derecha)   (MediaPipe Hands)
  - 21 puntos mano no dominante (izquierda)
  - NM (6 valores): cejas_arriba 0..100, cejas_fruncidas 0..100,
    boca_abierta 0..100, sonrisa -100..100 (negativo = boca hacia abajo),
    giro_cabeza -100..100 (niega), asentir -100..100 (afirma)
Un punto ausente se codifica como (-1,-1).

Uso:
    python generar_senas_sinteticas.py --salida ../dataset/senas
"""
import argparse
import json
import math
import os

FPS = 15

# ------------------------------------------------------------------
# Esqueleto base (coordenadas de imagen normalizadas, y hacia abajo).
# La mano DERECHA del señante aparece a la IZQUIERDA del espectador.
# ------------------------------------------------------------------
NARIZ = (0.50, 0.25)
HOMBRO_D = (0.38, 0.42)
HOMBRO_I = (0.62, 0.42)
CADERA_D = (0.42, 0.88)
CADERA_I = (0.58, 0.88)
BRAZO = 0.17      # hombro -> codo
ANTEBRAZO = 0.16  # codo -> muñeca
PALMA = 0.075     # muñeca -> nudillo medio

# Ubicaciones del espacio de señado para la mano DERECHA.
# Para la mano izquierda se reflejan en x (1 - x).
UBIC = {
    "reposo": (0.43, 0.65),
    "neutral": (0.42, 0.60),
    "adelante": (0.43, 0.50),
    "pecho": (0.44, 0.53),
    "pecho_c": (0.49, 0.53),
    "estomago": (0.47, 0.66),
    "abajo": (0.42, 0.70),
    "barbilla": (0.48, 0.34),
    "boca": (0.485, 0.31),
    "mejilla": (0.44, 0.28),
    "oreja": (0.40, 0.24),
    "sien": (0.41, 0.19),
    "frente": (0.47, 0.18),
    "arriba": (0.40, 0.11),
    "lado": (0.28, 0.54),
    "lado_alto": (0.31, 0.25),
    "lejos": (0.25, 0.42),
    "hombro_op": (0.58, 0.46),
    "centro": (0.50, 0.58),
    "centro_alto": (0.50, 0.40),
    "techo": (0.50, 0.17),
}

# ------------------------------------------------------------------
# Configuraciones manuales (aproximadas).
# curl: flexión de [índice, medio, anular, meñique] 0=extendido 1=cerrado
# pulgar: 0=recogido sobre la palma, 1=abierto
# abre: separación entre dedos 0..1
# ------------------------------------------------------------------
CONF = {
    "5": dict(curl=[0, 0, 0, 0], pulgar=1.0, abre=1.0),
    "B": dict(curl=[0, 0, 0, 0], pulgar=0.15, abre=0.0),
    "A": dict(curl=[1, 1, 1, 1], pulgar=0.55, abre=0.0),
    "S": dict(curl=[1, 1, 1, 1], pulgar=0.0, abre=0.0),
    "1": dict(curl=[0, 1, 1, 1], pulgar=0.0, abre=0.0),
    "L": dict(curl=[0, 1, 1, 1], pulgar=1.0, abre=0.0),
    "V": dict(curl=[0, 0, 1, 1], pulgar=0.0, abre=0.9),
    "U": dict(curl=[0, 0, 1, 1], pulgar=0.0, abre=0.0),
    "W": dict(curl=[0, 0, 0, 1], pulgar=0.0, abre=0.8),
    "Y": dict(curl=[1, 1, 1, 0], pulgar=1.0, abre=0.6),
    "I": dict(curl=[1, 1, 1, 0], pulgar=0.0, abre=0.0),
    "C": dict(curl=[0.45, 0.45, 0.45, 0.45], pulgar=0.7, abre=0.0),
    "O": dict(curl=[0.7, 0.7, 0.7, 0.7], pulgar=0.45, abre=0.0),
    "E": dict(curl=[0.85, 0.85, 0.85, 0.85], pulgar=0.0, abre=0.0),
    "F": dict(curl=[0.75, 0, 0, 0], pulgar=0.4, abre=0.7),
    "X": dict(curl=[0.55, 1, 1, 1], pulgar=0.0, abre=0.0),
    "R": dict(curl=[0, 0.1, 1, 1], pulgar=0.0, abre=-0.3),
    "M": dict(curl=[0.8, 0.8, 0.8, 1], pulgar=0.0, abre=0.0),
    "N": dict(curl=[0.8, 0.8, 1, 1], pulgar=0.0, abre=0.0),
    "T": dict(curl=[0.8, 1, 1, 1], pulgar=0.3, abre=0.0),
    "K": dict(curl=[0, 0, 1, 1], pulgar=0.6, abre=0.6),
    "G": dict(curl=[0, 1, 1, 1], pulgar=0.7, abre=0.0),
    "3": dict(curl=[0, 0, 1, 1], pulgar=1.0, abre=0.8),
    "4": dict(curl=[0, 0, 0, 0], pulgar=0.0, abre=0.8),
    "GARRA": dict(curl=[0.5, 0.5, 0.5, 0.5], pulgar=0.8, abre=1.0),
}

# ------------------------------------------------------------------
# Especificación de señas (PLACEHOLDERS).
# Cada mano: lista de keyframes (ubicación | (x,y), configuración,
#            ángulo de dedos en grados [-90 = hacia arriba], frames)
# nm: rasgo no manual: "cejas" (pregunta), "niega", "afirma"
# ------------------------------------------------------------------
def kf(u, c, a, n=5):
    return (u, c, a, n)


SENAS = {
    # Saludos y cortesía
    "HOLA": dict(rh=[kf("sien", "B", -80, 6), kf("lado_alto", "B", -60, 5), kf("sien", "B", -80, 4), kf("lado_alto", "B", -60, 4)]),
    "GRACIAS": dict(rh=[kf("boca", "B", -95, 6), kf("adelante", "B", -55, 7)]),
    "POR-FAVOR": dict(rh=[kf("pecho", "B", -100, 6), kf((0.47, 0.57), "B", -100, 4), kf("pecho_c", "B", -100, 4), kf((0.45, 0.49), "B", -100, 4), kf("pecho", "B", -100, 4)]),
    "BIENVENIDO": dict(rh=[kf("lejos", "B", -150, 6), kf("pecho", "B", -170, 8)],
                       lh=[kf("lejos", "B", -30, 6), kf("pecho", "B", -10, 8)]),
    "BUENO": dict(rh=[kf("boca", "B", -95, 6), kf("neutral", "B", -60, 7)]),
    "BIEN": dict(rh=[kf("neutral", "A", -100, 6), kf("adelante", "A", -100, 5)]),
    "MAL": dict(rh=[kf("boca", "B", -95, 6), kf("abajo", "B", 120, 7)]),
    "DÍA": dict(rh=[kf("lado", "1", -60, 6), kf("lado_alto", "1", -90, 6)], lh=[kf("estomago", "B", 180, 6)]),
    "TARDE": dict(rh=[kf("lado_alto", "B", -60, 6), kf("lado", "B", -20, 7)], lh=[kf("estomago", "B", 180, 6)]),
    "NOCHE": dict(rh=[kf("centro_alto", "C", 120, 6), kf("centro", "C", 130, 7)], lh=[kf("estomago", "B", 180, 6)]),
    # Pronombres
    "YO": dict(rh=[kf("adelante", "1", -120, 6), kf("pecho_c", "1", -130, 5)]),
    "TÚ": dict(rh=[kf("neutral", "1", -100, 6), kf("adelante", "1", -95, 5)]),
    "ÉL": dict(rh=[kf("neutral", "1", 160, 6), kf("lado", "1", 175, 5)]),
    "NOSOTROS": dict(rh=[kf((0.42, 0.50), "1", -110, 6), kf((0.49, 0.56), "1", -110, 5), kf((0.56, 0.50), "1", -110, 5)]),
    "USTEDES": dict(rh=[kf((0.38, 0.52), "1", -95, 6), kf((0.48, 0.55), "1", -95, 5), kf((0.56, 0.52), "1", -95, 5)]),
    "PERSONA": dict(rh=[kf((0.44, 0.45), "B", -90, 6), kf((0.44, 0.65), "B", -90, 7)], lh=[kf((0.56, 0.45), "B", -90, 6), kf((0.56, 0.65), "B", -90, 7)]),
    "TODOS": dict(rh=[kf("lejos", "B", -170, 6), kf("neutral", "B", -170, 5), kf("hombro_op", "B", -170, 5)]),
    # Preguntas (con rasgo no manual: cejas)
    "QUÉ": dict(rh=[kf("neutral", "5", -40, 6), kf("lado", "5", -20, 4), kf("neutral", "5", -40, 4)],
                lh=[kf("neutral", "5", -140, 6), kf("lado", "5", -160, 4), kf("neutral", "5", -140, 4)], nm="qu"),
    "DÓNDE": dict(rh=[kf("adelante", "1", -90, 6), kf((0.38, 0.48), "1", -80, 3), kf((0.47, 0.48), "1", -100, 3), kf((0.38, 0.48), "1", -80, 3)], nm="qu"),
    "CÓMO": dict(rh=[kf("neutral", "C", -60, 6), kf("neutral", "C", -120, 5), kf("neutral", "C", -60, 5)],
                 lh=[kf("neutral", "C", -120, 6), kf("neutral", "C", -60, 5), kf("neutral", "C", -120, 5)], nm="qu"),
    "CUÁNDO": dict(rh=[kf("adelante", "1", -90, 6), kf((0.40, 0.46), "1", -90, 3), kf((0.43, 0.42), "1", -90, 3), kf((0.46, 0.46), "1", -90, 3), kf("adelante", "1", -90, 3)], nm="qu"),
    "QUIÉN": dict(rh=[kf("barbilla", "1", -100, 6), kf((0.45, 0.36), "1", -100, 3), kf("barbilla", "1", -100, 3)], nm="qu"),
    "CUÁNTO": dict(rh=[kf("neutral", "S", -100, 6), kf("neutral", "5", -100, 4)], lh=[kf("neutral", "S", -80, 6), kf("neutral", "5", -80, 4)], nm="qu"),
    "PORQUÉ": dict(rh=[kf("sien", "1", -100, 6), kf("neutral", "Y", -100, 6)], nm="qu"),
    # Negación / afirmación
    "NO": dict(rh=[kf("adelante", "1", -90, 6), kf((0.39, 0.48), "1", -80, 3), kf((0.46, 0.48), "1", -100, 3), kf((0.39, 0.48), "1", -80, 3)], nm="niega"),
    "SÍ": dict(rh=[kf("adelante", "S", -90, 6), kf("neutral", "S", -60, 4), kf("adelante", "S", -90, 4)], nm="afirma"),
    # Verbos
    "AYUDAR": dict(rh=[kf("neutral", "A", -90, 6), kf("adelante", "A", -90, 7)], lh=[kf((0.56, 0.62), "B", 0, 6), kf((0.56, 0.52), "B", 0, 7)]),
    "NECESITAR": dict(rh=[kf("adelante", "X", -60, 6), kf("neutral", "X", -60, 4), kf("adelante", "X", -60, 4), kf("neutral", "X", -60, 4)]),
    "QUERER": dict(rh=[kf("adelante", "GARRA", -90, 6), kf("pecho", "GARRA", -90, 6)]),
    "PODER": dict(rh=[kf("adelante", "S", -90, 6), kf("abajo", "S", -90, 5)], lh=[kf("adelante", "S", -90, 6), kf("abajo", "S", -90, 5)]),
    "IR": dict(rh=[kf("pecho", "1", -120, 6), kf("lejos", "1", 180, 7)]),
    "VENIR": dict(rh=[kf("lejos", "1", 180, 6), kf("pecho", "1", -120, 7)]),
    "TRABAJAR": dict(rh=[kf((0.45, 0.55), "S", -10, 6), kf((0.45, 0.60), "S", -10, 3), kf((0.45, 0.55), "S", -10, 3)], lh=[kf((0.55, 0.60), "S", 190, 6), kf((0.55, 0.55), "S", 190, 3), kf((0.55, 0.60), "S", 190, 3)]),
    "ESTUDIAR": dict(rh=[kf((0.48, 0.48), "5", 90, 6), kf((0.48, 0.52), "5", 95, 3), kf((0.48, 0.48), "5", 90, 3), kf((0.48, 0.52), "5", 95, 3)], lh=[kf((0.52, 0.60), "B", -10, 6)]),
    "PREGUNTAR": dict(rh=[kf("boca", "X", -100, 6), kf("adelante", "X", -60, 6)]),
    "ESPERAR": dict(rh=[kf("neutral", "5", -60, 6), kf("neutral", "4", -60, 3), kf("neutral", "5", -60, 3)], lh=[kf("neutral", "5", -120, 6), kf("neutral", "4", -120, 3), kf("neutral", "5", -120, 3)]),
    "COMER": dict(rh=[kf("adelante", "O", -110, 6), kf("boca", "O", -110, 3), kf((0.46, 0.38), "O", -110, 3), kf("boca", "O", -110, 3)]),
    "SABER": dict(rh=[kf("adelante", "B", -100, 6), kf("sien", "B", -100, 5)]),
    "ENTENDER": dict(rh=[kf("sien", "S", -90, 6), kf("sien", "1", -90, 5)]),
    "VIVIR": dict(rh=[kf("estomago", "A", -90, 6), kf("pecho", "A", -90, 6)], lh=[kf("estomago", "A", -90, 6), kf("pecho", "A", -90, 6)]),
    "LLAMAR": dict(rh=[kf("oreja", "Y", -90, 6), kf((0.38, 0.26), "Y", -90, 4)]),
    "HACER": dict(rh=[kf("neutral", "S", -90, 6), kf("adelante", "S", -60, 4), kf("neutral", "S", -90, 4)], lh=[kf("neutral", "S", -90, 6), kf("adelante", "S", -120, 4), kf("neutral", "S", -90, 4)]),
    "TENER": dict(rh=[kf("adelante", "5", -90, 6), kf("pecho", "S", -90, 6)]),
    # Tiempo
    "HOY": dict(rh=[kf("neutral", "B", -10, 6), kf("abajo", "B", -10, 5)], lh=[kf("neutral", "B", 190, 6), kf("abajo", "B", 190, 5)]),
    "MAÑANA": dict(rh=[kf("mejilla", "A", -90, 6), kf((0.40, 0.33), "A", -70, 6)]),
    "AYER": dict(rh=[kf("mejilla", "Y", -90, 6), kf("oreja", "Y", -110, 6)]),
    "HORA": dict(rh=[kf("adelante", "1", 60, 6), kf((0.53, 0.58), "1", 60, 4)], lh=[kf((0.55, 0.60), "S", 190, 6)]),
    # Sustantivos
    "NOMBRE": dict(rh=[kf((0.45, 0.50), "U", 0, 6), kf((0.49, 0.53), "U", 0, 3), kf((0.46, 0.50), "U", 0, 3), kf((0.49, 0.53), "U", 0, 3)], lh=[kf((0.55, 0.55), "U", 180, 6)]),
    "CASA": dict(rh=[kf((0.42, 0.40), "B", -40, 6), kf("techo", "B", -45, 6)], lh=[kf((0.58, 0.40), "B", -140, 6), kf("techo", "B", -135, 6)]),
    "ESCUELA": dict(rh=[kf((0.46, 0.50), "B", 0, 6), kf((0.49, 0.53), "B", 0, 3), kf((0.46, 0.50), "B", 0, 3), kf((0.49, 0.53), "B", 0, 3)], lh=[kf((0.53, 0.55), "B", 180, 6)]),
    "UNIVERSIDAD": dict(rh=[kf("sien", "U", -90, 6), kf((0.37, 0.15), "U", -90, 3), kf((0.44, 0.13), "U", -90, 3), kf("sien", "U", -90, 3)]),
    "DOCUMENTO": dict(rh=[kf("centro_alto", "L", -90, 6), kf((0.40, 0.45), "L", -90, 5), kf((0.40, 0.58), "L", -90, 5)], lh=[kf("centro_alto", "L", -90, 6), kf((0.60, 0.45), "L", -90, 5), kf((0.60, 0.58), "L", -90, 5)]),
    "TRÁMITE": dict(rh=[kf((0.46, 0.52), "B", 0, 6), kf((0.47, 0.50), "B", -150, 4), kf((0.46, 0.52), "B", 0, 4)], lh=[kf((0.54, 0.55), "B", 180, 6)]),
    "INFORMACIÓN": dict(rh=[kf("sien", "O", -90, 6), kf("adelante", "5", -60, 6)], lh=[kf("sien", "O", -90, 6), kf("adelante", "5", -120, 6)]),
    "GOBIERNO": dict(rh=[kf("sien", "1", -90, 6), kf((0.37, 0.16), "1", -90, 3), kf("sien", "1", -90, 3), kf("frente", "1", -90, 4)]),
    "SERVICIO": dict(rh=[kf("pecho", "B", 0, 6), kf("adelante", "B", 0, 5)], lh=[kf((0.56, 0.53), "B", 180, 6), kf((0.56, 0.48), "B", 180, 5)]),
    "CITA": dict(rh=[kf((0.44, 0.52), "1", -40, 6), kf((0.49, 0.54), "1", -40, 4)], lh=[kf((0.55, 0.55), "B", 180, 6)]),
    "TELÉFONO": dict(rh=[kf("adelante", "Y", -90, 6), kf("oreja", "Y", -90, 6)]),
    "AGUA": dict(rh=[kf("barbilla", "W", -90, 6), kf("boca", "W", -90, 3), kf("barbilla", "W", -90, 3)]),
    "AMIGO": dict(rh=[kf((0.46, 0.52), "X", 0, 6), kf((0.48, 0.50), "X", 0, 4)], lh=[kf((0.54, 0.52), "X", 180, 6), kf((0.52, 0.54), "X", 180, 4)]),
    "FAMILIA": dict(rh=[kf("centro_alto", "F", -90, 6), kf((0.42, 0.52), "F", -90, 5), kf("centro", "F", -90, 5)], lh=[kf("centro_alto", "F", -90, 6), kf((0.58, 0.52), "F", -90, 5), kf("centro", "F", -90, 5)]),
    "SORDO": dict(rh=[kf("oreja", "1", -90, 6), kf("boca", "1", -90, 6)]),
    "OYENTE": dict(rh=[kf("adelante", "1", -90, 6), kf("oreja", "1", -90, 6)]),
    "SEÑAS": dict(rh=[kf((0.44, 0.48), "5", -90, 6), kf((0.42, 0.55), "5", -90, 4), kf((0.44, 0.48), "5", -90, 4)], lh=[kf((0.56, 0.55), "5", -90, 6), kf((0.58, 0.48), "5", -90, 4), kf((0.56, 0.55), "5", -90, 4)]),
    "LENGUA": dict(rh=[kf("barbilla", "1", -100, 6), kf("boca", "1", -100, 4)]),
    "MÉXICO": dict(rh=[kf("sien", "M", -90, 6), kf((0.40, 0.15), "M", -90, 4), kf("sien", "M", -90, 4)]),
    "DERECHO": dict(rh=[kf("pecho", "L", -90, 6), kf("adelante", "L", -90, 5)], lh=[kf((0.55, 0.60), "B", 0, 6)]),
    "ATENCIÓN": dict(rh=[kf("mejilla", "B", -90, 6), kf("adelante", "B", -90, 6)], lh=[kf((0.56, 0.28), "B", -90, 6), kf((0.57, 0.50), "B", -90, 6)]),
    "SALUD": dict(rh=[kf("pecho", "5", -90, 6), kf("adelante", "S", -90, 6)], lh=[kf((0.56, 0.53), "5", -90, 6), kf((0.57, 0.50), "S", -90, 6)]),
    "PÁGINA": dict(rh=[kf((0.46, 0.53), "B", 0, 6), kf((0.48, 0.50), "B", -160, 5)], lh=[kf((0.54, 0.55), "B", 180, 6)]),
    "INTERNET": dict(rh=[kf("neutral", "5", -60, 6), kf("neutral", "5", -30, 4), kf("neutral", "5", -60, 4)], lh=[kf("neutral", "5", -120, 6), kf("neutral", "5", -150, 4), kf("neutral", "5", -120, 4)]),
    "INSCRIBIR": dict(rh=[kf((0.46, 0.50), "G", 0, 6), kf((0.49, 0.56), "G", 0, 5)], lh=[kf((0.54, 0.56), "B", 180, 6)]),
    "MUCHO-GUSTO": dict(rh=[kf("pecho", "B", -100, 6), kf((0.47, 0.57), "B", -100, 4), kf("pecho_c", "B", -100, 4), kf("adelante", "B", -60, 6)]),
    "HASTA-LUEGO": dict(rh=[kf("lado_alto", "5", -80, 6), kf("lado_alto", "B", -80, 3), kf("lado_alto", "5", -80, 3), kf("lado_alto", "B", -80, 3)]),
    "AQUÍ": dict(rh=[kf("neutral", "1", 90, 6), kf("abajo", "1", 90, 4)]),
}

# Dactilología (APROXIMADA). Letra -> (configuración, ángulo, movimiento)
ALFABETO = {
    "A": ("A", -90, None), "B": ("B", -90, None), "C": ("C", -60, None), "D": ("G", -90, None),
    "E": ("E", -90, None), "F": ("F", -90, None), "G": ("G", 180, None), "H": ("U", 180, None),
    "I": ("I", -90, None), "J": ("I", -90, "gancho"), "K": ("K", -90, "sube"), "L": ("L", -90, None),
    "M": ("M", 100, None), "N": ("N", 100, None), "Ñ": ("N", 100, "vaiven"), "O": ("O", -90, None),
    "P": ("K", 100, None), "Q": ("G", 100, "vaiven"), "R": ("R", -90, None), "S": ("S", -90, None),
    "T": ("T", -90, None), "U": ("U", -90, None), "V": ("V", -90, None), "W": ("W", -90, None),
    "X": ("X", -90, "baja"), "Y": ("Y", -90, None), "Z": ("1", -90, "zeta"),
    "0": ("O", -90, None), "1": ("1", -90, None), "2": ("V", -90, None), "3": ("3", -90, None),
    "4": ("4", -90, None), "5": ("5", -90, None), "6": ("Y", -90, None), "7": ("L", -45, None),
    "8": ("3", -45, None), "9": ("4", -45, None),
}
POS_DACT = (0.40, 0.42)  # junto al hombro derecho, a la altura de la barbilla


# ------------------------------------------------------------------
# Geometría
# ------------------------------------------------------------------
def lerp(a, b, t):
    return a + (b - a) * t


def ease(t):
    return 0.5 - 0.5 * math.cos(math.pi * t)


def ik(hombro, muneca, derecha=True):
    """Cinemática inversa de 2 segmentos: devuelve el codo."""
    sx, sy = hombro
    wx, wy = muneca
    dx, dy = wx - sx, wy - sy
    d = math.hypot(dx, dy)
    d = min(max(d, 1e-4), BRAZO + ANTEBRAZO - 1e-3)
    a = (BRAZO ** 2 - ANTEBRAZO ** 2 + d ** 2) / (2 * d)
    h = math.sqrt(max(BRAZO ** 2 - a ** 2, 0))
    mx, my = sx + a * dx / d, sy + a * dy / d
    c1 = (mx + h * dy / d, my - h * dx / d)
    c2 = (mx - h * dy / d, my + h * dx / d)
    # el codo cae hacia abajo y hacia afuera del cuerpo
    def score(c):
        afuera = (sx - c[0]) if derecha else (c[0] - sx)
        return c[1] + 0.6 * afuera
    return c1 if score(c1) > score(c2) else c2


def mano(muneca, ang_deg, conf, derecha=True):
    """21 landmarks tipo MediaPipe Hands a partir de una configuración."""
    wx, wy = muneca
    ang = math.radians(ang_deg)
    u = (math.cos(ang), math.sin(ang))           # hacia los dedos
    lado = -1 if derecha else 1                   # lado del pulgar (palma al frente)
    v = (-u[1] * lado, u[0] * lado)               # perpendicular hacia el pulgar
    s = PALMA

    def P(a, b):  # coordenadas locales -> imagen
        return (wx + (u[0] * a + v[0] * b) * s, wy + (u[1] * a + v[1] * b) * s)

    pts = [P(0, 0)]
    # Pulgar (1-4)
    po = conf["pulgar"]
    ang_p = lerp(-0.2, 1.0, po)  # radianes respecto a u, hacia v
    base = (0.25, 0.32)
    pts.append(P(*base))
    cx, cy = base
    for L, extra in ((0.42, 0.0), (0.32, 0.25 * (1 - po)), (0.26, 0.45 * (1 - po))):
        a = ang_p - extra * 2.2 - (1 - po) * 0.9
        cx += math.cos(a) * L
        cy += math.sin(a) * L * (1 if po > 0.3 else -0.6)
        pts.append(P(cx, cy))
    # Dedos (índice, medio, anular, meñique)
    bases = [(1.0, 0.33), (1.05, 0.10), (1.0, -0.12), (0.9, -0.32)]
    largos = [(0.42, 0.26, 0.20), (0.46, 0.29, 0.21), (0.43, 0.27, 0.20), (0.34, 0.21, 0.18)]
    abre = conf["abre"]
    for i, ((bx, by), segs) in enumerate(zip(bases, largos)):
        c = conf["curl"][i]
        desv = (1.5 - i) * 0.12 * abre  # abanico
        pts.append(P(bx, by))
        cx, cy = bx, by
        acum = 0.0
        for L in segs:
            acum += c * 1.55
            cx += math.cos(acum) * L * math.cos(desv)
            cy += math.sin(desv) * L - math.sin(acum) * 0.08
            pts.append(P(cx, cy))
    return pts


def resolver(u):
    return UBIC[u] if isinstance(u, str) else u


def espejo(p):
    return (1 - p[0], p[1])


def trayectoria(kfs, derecha, total):
    """Interpola keyframes -> lista de (muneca, ang, conf) por frame."""
    reposo = UBIC["reposo"] if derecha else espejo(UBIC["reposo"])
    seq = [(reposo, 95 if derecha else 85, CONF["B"])]  # dedos hacia abajo en reposo
    out = []
    for (u, c, a, n) in kfs:
        p = resolver(u)
        if not derecha:
            p = espejo(p)
            a = 180 - a
        destino = (p, a, CONF[c])
        o = seq[-1]
        for k in range(1, n + 1):
            t = ease(k / n)
            pos = (lerp(o[0][0], destino[0][0], t), lerp(o[0][1], destino[0][1], t))
            ang = lerp(o[1], destino[1], t)
            conf = {
                "curl": [lerp(x, y, t) for x, y in zip(o[2]["curl"], destino[2]["curl"])],
                "pulgar": lerp(o[2]["pulgar"], destino[2]["pulgar"], t),
                "abre": lerp(o[2]["abre"], destino[2]["abre"], t),
            }
            out.append((pos, ang, conf))
        seq.append(destino)
    # sostener la última postura
    while len(out) < total:
        out.append(out[-1] if out else seq[-1])
    return out


# Expresión facial base por glosa (gesticulación). Aproximación pendiente de validar.
CARA = {
    "HOLA": "sonrisa", "GRACIAS": "sonrisa", "BIENVENIDO": "sonrisa", "BUENO": "sonrisa",
    "BIEN": "sonrisa", "MUCHO-GUSTO": "sonrisa", "HASTA-LUEGO": "sonrisa", "AMIGO": "sonrisa",
    "FAMILIA": "sonrisa", "POR-FAVOR": "amable", "AYUDAR": "amable", "MAL": "disgusto",
    "NO": "serio", "ESPERAR": "amable", "QUERER": "amable", "NECESITAR": "serio",
    "ATENCIÓN": "serio", "DERECHO": "serio",
}
VOCAL = {"A": 0.70, "E": 0.45, "I": 0.30, "O": 0.55, "U": 0.32}


def boca_mouthing(palabra, largo, ini=3, fin=2):
    """Articulación labial (mouthing) del español que acompaña a muchas señas:
    un pulso de apertura por cada núcleo vocálico de la palabra."""
    import unicodedata
    w = unicodedata.normalize("NFD", palabra.upper())
    w = "".join(c for c in w if unicodedata.category(c) != "Mn" and c.isalpha())
    nucleos, prev = [], False
    for c in w:
        v = c in VOCAL
        if v and not prev:
            nucleos.append(VOCAL[c])
        prev = v
    out = [0.0] * largo
    a, b = ini, max(ini + 1, largo - fin)
    if not nucleos:
        return out
    seg = (b - a) / len(nucleos)
    for k, amp in enumerate(nucleos):
        for i in range(a, b):
            t = (i - a - k * seg) / seg
            if 0 <= t <= 1:
                out[i] = max(out[i], amp * math.sin(math.pi * t))
    return out


def frame(rh, lh, nariz, nm):
    pts = []
    pose_codo_d = ik(HOMBRO_D, rh[0], True) if rh else None
    pose_codo_i = ik(HOMBRO_I, lh[0], False) if lh else None
    pose = [nariz, HOMBRO_D, HOMBRO_I, pose_codo_d, pose_codo_i,
            rh[0] if rh else None, lh[0] if lh else None, CADERA_D, CADERA_I]
    pts += pose
    pts += mano(rh[0], rh[1], rh[2], True) if rh else [None] * 21
    pts += mano(lh[0], lh[1], lh[2], False) if lh else [None] * 21
    flat = []
    for p in pts:
        if p is None:
            flat += [-1, -1]
        else:
            flat += [int(round(p[0] * 1000)), int(round(p[1] * 1000))]
    flat += [int(round(max(-1, min(1, v)) * 100)) for v in nm]
    return flat


def generar_clip(spec, glosa=None):
    rh_k = spec.get("rh", [])
    lh_k = spec.get("lh", [])
    largo = max(sum(k[3] for k in rh_k), sum(k[3] for k in lh_k)) + 3  # +3 sostener
    rh = trayectoria(rh_k, True, largo)
    if lh_k:
        lh = trayectoria(lh_k, False, largo)
    else:
        lh = [(espejo(UBIC["reposo"]), 85, CONF["B"])] * largo
    nm_tipo = spec.get("nm")
    cara = spec.get("cara") or CARA.get(glosa)
    boca = boca_mouthing(glosa.split("-")[0] if glosa else "", largo) if spec.get("boca", True) and glosa else [0.0] * largo
    frames = []
    for i in range(largo):
        t = i / max(largo - 1, 1)
        rampa = min(1.0, i / 4) * min(1.0, (largo - 1 - i) / 3 + 0.4)
        arriba = frunce = sonr = giro = asen = 0.0
        if cara == "sonrisa":
            sonr, arriba = 0.75 * rampa, 0.25 * rampa
        elif cara == "amable":
            sonr, arriba = 0.40 * rampa, 0.35 * rampa
        elif cara == "serio":
            frunce, sonr = 0.35 * rampa, -0.15 * rampa
        elif cara == "disgusto":
            frunce, sonr = 0.7 * rampa, -0.7 * rampa
        if nm_tipo == "qu":          # interrogativas QU: ceño fruncido, cabeza adelante
            frunce, asen = max(frunce, 0.85 * rampa), -0.25 * rampa
        elif nm_tipo == "niega":     # negación: giro de cabeza + ceño
            giro = 0.8 * math.sin(t * math.pi * 6) * rampa
            frunce, sonr = max(frunce, 0.5 * rampa), min(sonr, -0.4 * rampa)
        elif nm_tipo == "afirma":    # afirmación: asentir
            asen = 0.8 * math.sin(t * math.pi * 4) * rampa
            arriba = max(arriba, 0.3 * rampa)
        nariz = (NARIZ[0] + 0.012 * giro, NARIZ[1] + 0.010 * asen)
        frames.append(frame(rh[i], lh[i], nariz, [arriba, frunce, boca[i], sonr, giro, asen]))
    return frames


def generar_letra(letra):
    c, a, mov = ALFABETO[letra]
    kfs = [kf(POS_DACT, c, a, 4)]
    x, y = POS_DACT
    if mov == "gancho":
        kfs += [kf((x + 0.01, y + 0.04), c, a + 60, 3), kf((x - 0.02, y + 0.03), c, a + 90, 2)]
    elif mov == "sube":
        kfs += [kf((x, y - 0.03), c, a, 3)]
    elif mov == "baja":
        kfs += [kf((x, y + 0.03), c, a, 3)]
    elif mov == "vaiven":
        kfs += [kf((x - 0.02, y), c, a, 2), kf((x + 0.02, y), c, a, 2), kf((x, y), c, a, 2)]
    elif mov == "zeta":
        kfs += [kf((x + 0.04, y - 0.02), c, a, 2), kf((x, y + 0.02), c, a, 2), kf((x + 0.04, y + 0.02), c, a, 2)]
    else:
        kfs += [kf(POS_DACT, c, a, 3)]
    return generar_clip({"rh": kfs})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--salida", default=os.path.join(os.path.dirname(__file__), "..", "dataset", "senas"))
    ap.add_argument("--sobrescribir-reales", action="store_true",
                    help="Sobrescribe también clips con origen 'mediapipe' (por defecto se respetan)")
    args = ap.parse_args()
    os.makedirs(args.salida, exist_ok=True)
    n = 0
    trabajos = [(g, lambda s=s, g=g: generar_clip(s, g)) for g, s in SENAS.items()]
    trabajos += [(f"DT-{l}", lambda l=l: generar_letra(l)) for l in ALFABETO]
    for glosa, fn in trabajos:
        ruta = os.path.join(args.salida, f"{glosa}.json")
        if os.path.exists(ruta) and not args.sobrescribir_reales:
            with open(ruta, encoding="utf-8") as f:
                if json.load(f).get("origen") == "mediapipe":
                    continue  # no pisar una captura real
        data = {"glosa": glosa, "fps": FPS, "origen": "sintetico", "frames": fn()}
        with open(ruta, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        n += 1
    print(f"{n} clips sintéticos escritos en {os.path.abspath(args.salida)}")


if __name__ == "__main__":
    main()
