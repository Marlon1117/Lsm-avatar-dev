/**
 * main.jsx — Punto de entrada de la app de demostración.
 * Monta <App /> dentro de <div id="root"> (ver index.html).
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles/portal.css";
import "./styles/widget.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
