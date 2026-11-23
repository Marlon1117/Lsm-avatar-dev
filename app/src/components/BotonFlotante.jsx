/**
 * BotonFlotante.jsx
 * ---------------------------------------------------------------------------
 * El botón redondo "LSM" que flota en una esquina de la página (como el de
 * VLibras). Abre y cierra el panel del traductor.
 *
 * Props:
 *   activo    true si el panel está abierto (cambia el estilo y aria-pressed)
 *   onClick   función a llamar al pulsarlo
 */

export default function BotonFlotante({ activo, onClick }) {
  return (
    <button
      type="button"
      className={`lsm-boton ${activo ? "lsm-boton--activo" : ""}`}
      onClick={onClick}
      aria-pressed={activo}
      aria-label="Activar traductor a Lengua de Señas Mexicana"
      title="Traductor LSM"
    >
      <IconoMano />
      <span>LSM</span>
    </button>
  );
}

/** Ícono de una mano abierta (SVG en línea, sin dependencias). */
function IconoMano() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 11V5.5a1.5 1.5 0 0 1 3 0V10" />
      <path d="M10 9.5V4a1.5 1.5 0 0 1 3 0v6" />
      <path d="M13 9.5V5a1.5 1.5 0 0 1 3 0v6" />
      <path d="M16 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7l-2.6-4a1.5 1.5 0 0 1 2.5-1.7L9 14" />
    </svg>
  );
}
