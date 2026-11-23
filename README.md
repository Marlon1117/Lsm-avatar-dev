# lsm-avatar-dev — Traductor Español → LSM con avatar (prototipo tipo VLibras)

Un widget que se agrega a cualquier página web con una sola etiqueta <script>. Muestra un botón
flotante **LSM**; la persona hace clic sobre un texto y un avatar 2D lo interpreta en Lengua
de Señas Mexicana (glosas + animación por keypoints). Las palabras sin seña se deletrean con
dactilología.

> ⚠ Las señas incluidas son **sintéticas (placeholders)** y **no están validadas** por la
> comunidad Sorda. El flujo del proyecto las reemplaza por capturas reales de intérpretes con
> MediaPipe (ver "Generar el dataset").

## Estructura

```
lsm-traductor/
├── web/
│   ├── index.html            Página de demostración (portal ficticio)
│   ├── lsm-widget.js         Widget: botón, panel, reproductor
│   ├── avatar-lsm.js         Avatar 2D expresivo (rostro, cejas, boca, mirada, cabeza)
│   ├── secuencia-lsm.js      Glosas → secuencia continua de frames (widget y dataset)
│   ├── lsm-todo-en-uno.js    Paquete para integrar con una sola etiqueta
│   ├── traductor-lsm.js      Traductor por reglas Español → glosas (navegador y Node)
│   └── lsm-diccionario.js    Diccionario generado: glosas + keypoints + léxico
├── dataset/
│   ├── glosario.csv          Glosa ↔ palabras en español ↔ rasgos fonológicos
│   ├── oraciones_es.csv      Oraciones fuente (y glosa de referencia del intérprete)
│   ├── corpus_paralelo.csv   Salida: español ↔ glosa automática ↔ referencia ↔ WER
│   ├── palabras_sin_sena.csv Prioridad de grabación
│   ├── senas/<GLOSA>.json    Un clip de keypoints por seña (sintético o MediaPipe)
│   ├── prueba/               Dataset de prueba: 3 frases × 5 señantes simulados,
│   │                         etiquetas por frame, segmentos, .npz y videos MP4
│   └── capturas/             (se crea) todas las repeticiones capturadas, para la tesis
├── scripts/
│   ├── generar_senas_sinteticas.py   Placeholders con el mismo formato que MediaPipe
│   ├── extraer_poses_mediapipe.py    Videos de intérpretes → clips de keypoints
│   ├── construir_diccionario.py      glosario + clips → web/lsm-diccionario.js
│   ├── generar_corpus.mjs            Corpus paralelo + métricas (usa el mismo traductor)
│   ├── generar_dataset_prueba.mjs    Frases → keypoints etiquetados con 5 señantes simulados
│   ├── cargar_dataset_prueba.py      Carga el dataset de prueba en NumPy / .npz
│   ├── renderizar_video.py           Videos MP4 del avatar a partir de las muestras
│   └── empaquetar.py                 Genera web/lsm-todo-en-uno.js
└── (documentos de la propuesta: fuera del repositorio)
```

## Probar la demo

- **En línea (GitHub Pages):** `https://<usuario>.github.io/lsm-avatar-dev/` — funciona en iPad, celular y PC.
- **Local:** abre `web/index.html` en el navegador (no requiere servidor).

Pulsa **LSM** y toca o haz clic en cualquier párrafo, o escribe una frase en el panel.

## Ejecutar los scripts desde el iPad (GitHub Codespaces)

En el repositorio: **Code → Codespaces → Create codespace**. Se abre VS Code en Safari con
Python, Node, MediaPipe, ffmpeg y Playwright ya instalados (`.devcontainer/`). Ahí corre
los comandos de la sección "Generar el dataset". Para ver la demo dentro del Codespace:
`python -m http.server 8000` y abre el puerto 8000.

## Integrarlo en otro sitio

```html
<script src="lsm-todo-en-uno.js" data-auto="true" data-color="#0b6e4f"></script>
```
API: `LSMWidget.init({color, posicion:"derecha"|"izquierda"})`, `LSMWidget.traducir("texto")`.

## Generar el dataset

```bash
# 1) Placeholders (para que la demo funcione desde el día 1)
python scripts/generar_senas_sinteticas.py

# 2) Señas reales: grabar videos  videos/GLOSA__S01__r1.mp4  (1 seña por video)
pip install mediapipe opencv-python numpy
python scripts/extraer_poses_mediapipe.py --videos videos/
#    (no sobrescribe; cada clip real reemplaza al sintético de la misma glosa)

# 3) Reconstruir el diccionario del widget
python scripts/construir_diccionario.py

# 4) Corpus paralelo y métricas (cobertura léxica, WER contra referencia del intérprete)
node scripts/generar_corpus.mjs

# 5) Paquete del widget, dataset de prueba y videos
python scripts/empaquetar.py
node scripts/generar_dataset_prueba.mjs
python scripts/cargar_dataset_prueba.py --npz
python scripts/renderizar_video.py --ids F01_S01 F02_S01 F03_S01
```

Formato de cada frame: 9 puntos de pose + 21 mano derecha + 21 mano izquierda (x,y en
0–1000, `-1` = no detectado) + 6 canales no manuales: cejas arriba, cejas fruncidas,
boca abierta, sonrisa (−100..100), giro de cabeza y asentimiento (−100..100). Es el mismo vector de keypoints
que usa el reconocedor de bajo costo de la tesis, de modo que **un solo dataset sirve para
síntesis (avatar) y para reconocimiento**.
