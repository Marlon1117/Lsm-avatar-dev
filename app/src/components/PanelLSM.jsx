/**
 * PanelLSM.jsx
 * ---------------------------------------------------------------------------
 * Ventana del traductor: encabezado, avatar (canvas), glosas, controles,
 * cuadro de texto y aviso. Solo "pinta": el estado vive en LSMWidget.
 *
 * Props:
 *   canvasRef     ref que el hook useReproductor usa para dibujar
 *   tokens        tokens de la traducción actual
 *   tokenActivo   índice del token que se está señando
 *   letraActiva   letra que se está deletreando (se muestra grande)
 *   cargando, error  estado del diccionario
 *   ...controles  pausado, velocidad y sus funciones
 *   onTexto       traducir un texto escrito
 *   onCerrar      cerrar el panel
 */

import ListaGlosas from "./ListaGlosas.jsx";
import Controles from "./Controles.jsx";
import EntradaTexto from "./EntradaTexto.jsx";

export default function PanelLSM({
  canvasRef,
  tokens,
  tokenActivo,
  letraActiva,
  cargando,
  error,
  pausado,
  onPausar,
  onRepetir,
  velocidad,
  onVelocidad,
  onTexto,
  onCerrar,
}) {
  return (
    <section className="lsm-panel" role="dialog" aria-label="Traductor a Lengua de Señas Mexicana">
      <header className="lsm-cabecera">
        <b>Traductor LSM · prototipo</b>
        <button type="button" onClick={onCerrar} aria-label="Cerrar">
          ×
        </button>
      </header>

      {/* El canvas tiene el doble de resolución que su tamaño en pantalla
          para que se vea nítido en pantallas retina (iPad, celulares). */}
      <div className="lsm-escenario">
        <canvas ref={canvasRef} width={640} height={600} aria-label="Avatar señante" />
        {letraActiva && (
          <div className="lsm-letra" aria-hidden="true">
            {letraActiva}
          </div>
        )}
        {cargando && <div className="lsm-estado">Cargando diccionario…</div>}
        {error && <div className="lsm-estado lsm-estado--error">{error}</div>}
      </div>

      <ListaGlosas tokens={tokens} tokenActivo={tokenActivo} />

      <Controles
        pausado={pausado}
        onPausar={onPausar}
        onRepetir={onRepetir}
        velocidad={velocidad}
        onVelocidad={onVelocidad}
      />

      <EntradaTexto onEnviar={onTexto} deshabilitado={cargando || Boolean(error)} />

      <p className="lsm-aviso">
        ⚠ Señas sintéticas de demostración, <b>no validadas</b> por la comunidad Sorda; se reemplazarán por
        capturas reales de intérpretes.
      </p>
    </section>
  );
}
