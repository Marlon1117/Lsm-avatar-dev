# El dataset: cómo se genera y cómo se usa

El dataset tiene **cuatro capas**. Cada una sale de un script y alimenta a la siguiente.

| Capa | Archivo(s) | Script que lo genera | Para qué sirve |
|---|---|---|---|
| 1. Glosario | `dataset/glosario.csv` | lo editas tú | Qué palabras activan cada seña |
| 2. Clips de señas | `dataset/senas/<GLOSA>.json` | `generar_senas_sinteticas.py` o `extraer_poses_mediapipe.py` | El movimiento de cada seña |
| 3. Corpus paralelo | `dataset/corpus_paralelo.csv` | `generar_corpus.mjs` | Medir la traducción (WER, cobertura) |
| 4. Dataset de prueba | `dataset/prueba/` | `generar_dataset_prueba.mjs` | Probar un reconocedor de LSM continua |

---

## 1. Glosario (`glosario.csv`)

Una fila por seña:

```
glosa,palabras_es,categoria,configuracion,ubicacion,movimiento,manos,no_manual,estado
CASA,casa|hogar|domicilio,sustantivo,B,frente,techo,2,,sintetico
```

- `palabras_es`: todas las formas en español que deben mostrar esa seña, separadas por `|`.
  Se escriben **sin acentos** (el traductor busca sin acentos).
- `categoria`: `pronombre`, `interrogativo`, `verbo`, `tiempo`… (el traductor la usa para
  reordenar: interrogativos al final, tiempo al inicio).
- `no_manual`: `qu` (ceño de pregunta QU), `niega`, `afirma`.

## 2. Clips de señas (`senas/<GLOSA>.json`)

```json
{ "glosa": "GRACIAS", "fps": 15, "origen": "sintetico", "frames": [[...108 números...], ...] }
```

Hay dos formas de producirlos, **con el mismo formato**:

### a) Sintéticos (`generar_senas_sinteticas.py`)
Cada seña se describe con *keyframes*: ubicación de la mano, configuración (forma de la mano)
y ángulo. El script interpola entre keyframes, calcula el codo con cinemática inversa, genera
los 21 puntos de la mano y agrega la expresión facial (sonrisa, ceño, articulación de la boca).
Son **aproximaciones**: sirven para que la demo funcione desde el primer día.

### b) Capturados (`extraer_poses_mediapipe.py`)
1. Grabas videos: `videos/GLOSA__S01__r1.mp4` (1 seña por video, inicia y termina en reposo).
2. MediaPipe detecta pose, manos y cara en cada frame.
3. Se normaliza (hombros siempre en la misma posición y tamaño), se rellenan huecos cortos,
   se suaviza, se recorta el reposo y se remuestrea a 15 fps.
4. Los 6 canales no manuales se calculan de la malla facial comparando con los primeros frames
   (rostro neutro).
5. La mejor repetición reemplaza al clip sintético; **todas** se guardan en `dataset/capturas/`.

Después de cualquiera de los dos: `python scripts/construir_diccionario.py` une glosario + clips
en `app/public/lsm-diccionario.json`.

## 3. Corpus paralelo

`dataset/oraciones_es.csv` tiene oraciones reales por dominio. Un intérprete escribe la
`glosa_referencia`. `generar_corpus.mjs` traduce cada oración con el **mismo traductor de la app**
y calcula:

- **WER**: errores (sustituir, insertar, borrar glosas) / largo de la referencia. 0 = perfecto.
- **Cobertura**: palabras con seña / palabras de contenido.
- **Palabras sin seña**: ranking de lo que conviene grabar primero (`palabras_sin_sena.csv`).

## 4. Dataset de prueba (LSM continua)

```
frase ──traducir──► glosas ──construirSecuencia──► frames ──aumentar ×5──► muestras
```

`generar_dataset_prueba.mjs` toma 3 frases y crea 5 "señantes" simulados que cambian:
velocidad, escala, posición, amplitud de los brazos, temblor y expresividad facial.
Resultado: 15 muestras (1,953 frames).

Cada `dataset/prueba/muestras/F01_S01.json` trae:

| Campo | Contenido |
|---|---|
| `frames` | T × 108 keypoints |
| `etiquetas_frame` | la etiqueta de cada frame: `HOLA`, `DT-M`, `<trans>`, `<pausa>`, `<reposo>` |
| `segmentos` | `[{glosa, inicio, fin}]` tramos continuos |
| `parametros` | cómo se simuló al señante |

`segmentos.csv` e `indice.csv` resumen todo en tablas.

### Cómo se usa

```python
from cargar_dataset_prueba import cargar
X, y, seq, ids, vocab = cargar()
# X[i]: (T, 108) float  — coordenadas 0..1 y canales no manuales -1..1
# y[i]: (T,)     int    — etiqueta por frame (índice en vocab) → segmentación / CTC
# seq[i]: ["HOLA", "BUENO", "DÍA", "TÚ", "CÓMO"] — objetivo de secuencia (CTC)
```

- **Reconocimiento aislado**: cortar `X[i]` con los `segmentos` y clasificar cada tramo
  (ver `scripts/reconocedor_base_dtw.py`).
- **Reconocimiento continuo**: entrenar con `X[i]` completo y `seq[i]` como objetivo (CTC),
  usando las etiquetas `<...>` como *blank*.
- **Videos**: `renderizar_video.py` dibuja cualquier muestra con el avatar.

> Este dataset es sintético y generado con las mismas plantillas: sirve para validar formato,
> cargadores y métricas, **no** para medir la precisión real. Para eso hacen falta grabaciones
> de señantes reales (separando personas en entrenamiento y prueba).
