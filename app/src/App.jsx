/**
 * App.jsx — La aplicación de demostración: la página de ejemplo + el widget.
 *
 * import.meta.env.BASE_URL es la ruta base donde Vite publica la app
 * (en GitHub Pages: /Lsm-avatar-dev/demo/). El diccionario está en /public,
 * así que queda junto al index.html publicado.
 */

import PortalEjemplo from "./pages/PortalEjemplo.jsx";
import LSMWidget from "./components/LSMWidget.jsx";

export default function App() {
  return (
    <>
      <PortalEjemplo />
      <LSMWidget urlDiccionario={`${import.meta.env.BASE_URL}lsm-diccionario.json`} color="#0b6e4f" />
    </>
  );
}
