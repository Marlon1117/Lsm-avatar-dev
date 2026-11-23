/**
 * Controles.jsx
 * ---------------------------------------------------------------------------
 * Pausar / reanudar, repetir y velocidad de la animación.
 *
 * Props:
 *   pausado, onPausar      estado de pausa y función para alternarlo
 *   onRepetir              vuelve al inicio de la secuencia
 *   velocidad, onVelocidad multiplicador 0.5 – 2 y función para cambiarlo
 */

export default function Controles({ pausado, onPausar, onRepetir, velocidad, onVelocidad }) {
  return (
    <div className="lsm-controles">
      <button type="button" onClick={onPausar} aria-label={pausado ? "Reanudar" : "Pausar"}>
        {pausado ? "▶" : "❚❚"}
      </button>

      <button type="button" onClick={onRepetir} aria-label="Repetir">
        ↻ Repetir
      </button>

      <label className="lsm-velocidad">
        Velocidad
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.25"
          value={velocidad}
          onChange={(e) => onVelocidad(Number(e.target.value))}
          aria-label="Velocidad"
        />
        <span>{velocidad.toFixed(2)}×</span>
      </label>
    </div>
  );
}
