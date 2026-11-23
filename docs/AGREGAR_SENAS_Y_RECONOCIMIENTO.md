# Cómo agregar señas, palabras y reconocimiento

## A. Agregar una palabra que ya tiene seña (sinónimo)

Ejemplo: que "vivienda" muestre la seña CASA.

1. En `dataset/glosario.csv`, fila `CASA`, agrega `|vivienda` a `palabras_es`.
2. `python scripts/construir_diccionario.py`
3. `cd app && npm run build`

## B. Agregar una seña nueva

### Opción 1 — Seña capturada (recomendada)
1. Graba 3 señantes × 3 repeticiones: `videos/ESCUELA__S01__r1.mp4`, … (fondo liso,
   cámara fija, cabeza a cintura, empezar y terminar en reposo).
2. `python scripts/extraer_poses_mediapipe.py --videos videos/`
3. Si la glosa es nueva, agrega su fila a `dataset/glosario.csv`.
4. `python scripts/construir_diccionario.py` y `cd app && npm run build`.

### Opción 2 — Seña sintética (para probar rápido)
1. En `scripts/generar_senas_sinteticas.py`, agrega una entrada a `SENAS`:
   ```python
   "COMPUTADORA": dict(rh=[kf("neutral", "5", -60, 6), kf("adelante", "5", -60, 4)],
                       lh=[kf("neutral", "B", 190, 6)]),
   ```
   `kf(ubicación, configuración, ángulo, frames)`. Ubicaciones en `UBIC`, configuraciones en
   `CONF`. Opcional: `nm="qu" | "niega" | "afirma"` y expresión en `CARA`.
2. Agrega la fila al glosario, `generar_senas_sinteticas.py` → `construir_diccionario.py`.

## C. Agregar o cambiar reglas del traductor

- Expresiones fijas, palabras vacías, verbos irregulares → `app/src/lib/recursosLinguisticos.js`.
- Cambiar el algoritmo (orden de pasos) → `app/src/lib/traductor.js`.
- Después: `npm test` (las pruebas documentan las reglas) y `node scripts/generar_corpus.mjs`
  para ver si el WER mejoró.

## D. Agregar reconocimiento (seña → texto), el camino de la tesis

El mismo formato de 108 valores por frame sirve para reconocer. La ruta sugerida:

| Paso | Qué hacer | Archivo |
|---|---|---|
| 1 | Grabar señantes reales (≥ 3 personas, varias repeticiones) | `extraer_poses_mediapipe.py` → `dataset/capturas/` |
| 2 | Base aislada sin entrenamiento: k-NN + DTW | `scripts/reconocedor_base_dtw.py` |
| 3 | Modelo ligero aislado: GRU / CNN-1D sobre las 88 características de manos | nuevo script de entrenamiento |
| 4 | Continuo: el mismo modelo con salida CTC sobre frases completas | usar `seq[i]` y `<...>` como blank |
| 5 | En tiempo real en el navegador: MediaPipe Tasks para web + modelo exportado (TensorFlow.js / ONNX Runtime Web) | un hook nuevo `useReconocimiento` |

**Regla de oro de evaluación**: separa por **persona** (señantes de prueba que el modelo nunca
vio). Si mezclas repeticiones de la misma persona en entrenamiento y prueba, la exactitud se
infla.

### Cómo se conectaría en React (paso 5)

```
cámara (getUserMedia) → MediaPipe Tasks (web) → frame de 108 valores
   → ventana de N frames → modelo → glosa → texto en pantalla
```

Se reutiliza `lib/formato.js` para armar el frame igual que en `extraer_poses_mediapipe.py`,
y el avatar puede repetir la seña reconocida como retroalimentación.
