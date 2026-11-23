/**
 * PortalEjemplo.jsx
 * ---------------------------------------------------------------------------
 * Página FICTICIA que simula un portal de trámites, solo para probar el
 * widget sobre texto real. No es un portal oficial.
 *
 * Los textos están en arreglos y se pintan con .map(): para agregar una
 * frase de prueba basta con agregarla al arreglo FRASES_DE_PRUEBA.
 */

const SERVICIOS = [
  { titulo: "Solicitar una cita", texto: "Agenda tu cita en línea para hacer tu trámite." },
  { titulo: "Documentos necesarios", texto: "Necesitas 3 documentos para registrarte." },
  {
    titulo: "Atención a personas sordas",
    texto: "Las personas sordas tienen derecho a la información en Lengua de Señas Mexicana.",
  },
  { titulo: "Ayuda", texto: "¿Dónde puedo preguntar? Llama por teléfono o escribe en la página." },
];

const PREGUNTAS_FRECUENTES = [
  "¿Qué necesito para el trámite?",
  "¿Cuándo puedo ir a la cita?",
  "No tengo el documento, ¿qué hago?",
  "Mañana voy a la universidad a estudiar.",
];

const FRASES_DE_PRUEBA = [
  "Hola, me llamo Marlon. Gracias por esperar.",
  "Hoy mi familia y yo queremos información sobre el servicio de salud.",
  "Hola, buenos días. ¿Cómo estás?",
  "Me llamo Marlon, mucho gusto.",
  "¿Dónde puedo hacer mi trámite? Gracias, hasta luego.",
  "¿Tienes tu documento?",
];

export default function PortalEjemplo() {
  return (
    <>
      <header className="portal-cabecera">
        <b style={{ fontSize: 20 }}>Portal Ciudadano de Ejemplo</b>
        <br />
        <small>Página ficticia para demostrar un traductor automático español → Lengua de Señas Mexicana</small>
      </header>
      <div className="portal-aviso">Página de ejemplo. Este sitio no es un portal oficial.</div>

      <main className="portal-contenido">
        <h1>Bienvenidos al portal de trámites del gobierno</h1>
        <p>Aquí puedes solicitar una cita en línea, consultar información y registrarte en los servicios.</p>
        <p>
          <b>Cómo usarlo:</b> pulsa el botón verde <b>LSM</b> (abajo a la derecha) y toca o haz clic en cualquier
          texto. También puedes seleccionar texto o escribirlo en el panel.
        </p>

        <h2>Servicios</h2>
        <div className="portal-tarjetas">
          {SERVICIOS.map((servicio) => (
            <div className="portal-tarjeta" key={servicio.titulo}>
              <h3>{servicio.titulo}</h3>
              <p>{servicio.texto}</p>
            </div>
          ))}
        </div>

        <h2>Preguntas frecuentes</h2>
        <ul>
          {PREGUNTAS_FRECUENTES.map((pregunta) => (
            <li key={pregunta}>{pregunta}</li>
          ))}
        </ul>

        <h2>Frases de prueba</h2>
        {FRASES_DE_PRUEBA.map((frase) => (
          <p className="portal-ejemplo" key={frase}>
            {frase}
          </p>
        ))}

        <h2>Integración en cualquier sitio</h2>
        <p>
          Igual que VLibras, basta con agregar una etiqueta antes de cerrar <code>&lt;/body&gt;</code>:
        </p>
        <pre className="portal-ejemplo portal-codigo">
          {'<script charset="utf-8" src="widget/lsm-widget.js" data-auto="true"></script>'}
        </pre>
      </main>

      <footer className="portal-pie">Señas sintéticas de demostración, no validadas · Inspirado en VLibras (Brasil)</footer>
    </>
  );
}
