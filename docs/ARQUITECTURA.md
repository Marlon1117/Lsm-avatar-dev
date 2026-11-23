# Arquitectura del sistema

## Diagrama general

```mermaid
flowchart LR
  subgraph DATOS["1 · Construcción del dataset (offline)"]
    V["Videos de intérpretes<br/>GLOSA__S01__r1.mp4"] --> MP["extraer_poses_mediapipe.py<br/>pose + manos + cara"]
    SS["generar_senas_sinteticas.py<br/>(placeholders)"] --> CL
    MP --> CL["dataset/senas/GLOSA.json<br/>clips de keypoints"]
    GL["dataset/glosario.csv<br/>glosa ↔ palabras"] --> CD
    CL --> CD["construir_diccionario.py"]
    CD --> DIC["app/public/<br/>lsm-diccionario.json"]
  end

  subgraph APP["2 · App React (navegador, en tiempo real)"]
    T["Texto de la página<br/>o escrito"] --> TR["lib/traductor.js<br/>español → glosas"]
    DIC --> TR
    TR --> SQ["lib/secuencia.js<br/>glosas → frames"]
    DIC --> SQ
    SQ --> RP["useReproductor<br/>requestAnimationFrame"]
    RP --> AV["lib/avatar/<br/>dibujo en canvas"]
  end

  subgraph EVAL["3 · Evaluación y reconocimiento (offline)"]
    OR["oraciones_es.csv"] --> GC["generar_corpus.mjs<br/>WER, cobertura"]
    TR -. mismo código .-> GC
    SQ -. mismo código .-> DP["generar_dataset_prueba.mjs<br/>5 señantes simulados"]
    DP --> NPZ["prueba.npz<br/>X: T×108, y: etiqueta/frame"]
    NPZ --> REC["reconocedor<br/>(DTW base → modelo de la tesis)"]
    CL --> REC
  end
```

La idea central: **la lógica (`app/src/lib/`) no depende de React**. La app la usa para
animar el avatar y los scripts de Node la usan para generar el dataset. Así lo que ves en
pantalla y lo que se guarda en el dataset salen del mismo código.

## Flujo dentro de la app React

```mermaid
sequenceDiagram
  participant U as Usuario
  participant H as useTextoDeLaPagina
  participant W as LSMWidget (estado)
  participant L as lib (traductor + secuencia)
  participant R as useReproductor
  participant C as canvas (avatar)

  U->>H: clic en un párrafo
  H->>W: onTexto("¿Cómo estás?")
  W->>L: traducir() → oraciones
  W->>L: construirSecuencia() → frames
  W->>W: setSecuencia(frames)
  loop ~60 veces por segundo
    R->>R: avanza el índice según fps × velocidad
    R->>C: dibujarAvatar(frame)
    R-->>W: glosa activa (solo si cambió)
  end
```

## Qué hace cada archivo

| Archivo | Tipo | Responsabilidad |
|---|---|---|
| `lib/formato.js` | lógica | Qué significa cada uno de los 108 números de un frame |
| `lib/recursosLinguisticos.js` | datos | Listas de palabras: multipalabra, palabras vacías, verbos irregulares… |
| `lib/traductor.js` | lógica | Español → tokens con glosas (7 pasos documentados en el archivo) |
| `lib/secuencia.js` | lógica | Une los clips, agrega transiciones, pausas y cejas de pregunta |
| `lib/avatar/*.js` | dibujo | Pinta un frame: cuerpo, cabeza, rostro (6 canales no manuales), manos |
| `hooks/useDiccionario.js` | hook | Descarga el JSON del diccionario |
| `hooks/useReproductor.js` | hook | Bucle de animación; dibuja sin re-renderizar React en cada frame |
| `hooks/useTextoDeLaPagina.js` | hook | Resalta y traduce texto de la página al tocarlo |
| `components/LSMWidget.jsx` | componente | Estado principal y composición del widget |
| `components/PanelLSM.jsx` | componente | Ventana: canvas, glosas, controles, entrada, aviso |
| `embed.jsx` | entrada | Monta el widget en un Shadow DOM para usarlo en cualquier sitio |

## Formato de un frame (108 números)

| Posiciones | Contenido |
|---|---|
| 0–17 | Pose superior: nariz, hombros, codos, muñecas, caderas (9 puntos × x,y) |
| 18–59 | Mano derecha del señante (21 puntos MediaPipe Hands) |
| 60–101 | Mano izquierda (21 puntos) |
| 102 | Cejas arriba (0–100) |
| 103 | Cejas fruncidas (0–100) |
| 104 | Boca abierta (0–100) |
| 105 | Sonrisa (−100 a 100) |
| 106 | Giro de cabeza (−100 a 100) |
| 107 | Asentir (−100 a 100) |

Coordenadas en 0–1000, eje *y* hacia abajo, `-1` = punto no detectado.
