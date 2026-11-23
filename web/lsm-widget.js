/*!
 * lsm-widget.js — Widget de accesibilidad tipo VLibras para Lengua de Señas Mexicana
 * ------------------------------------------------------------------------------
 * Prototipo. Requiere:
 *   - lsm-diccionario.js, traductor-lsm.js, secuencia-lsm.js, avatar-lsm.js
 *
 * Integración en cualquier sitio (igual que VLibras: un botón flotante):
 *   <script src="lsm-todo-en-uno.js" data-auto="true"></script>
 * (paquete generado por scripts/empaquetar.py con diccionario, traductor,
 *  secuenciador, avatar y widget)
 *
 * o manualmente:  LSMWidget.init({ color: "#0b6e4f", posicion: "derecha" });
 *
 * Uso: activar el botón "LSM", pasar el cursor sobre un texto y hacer clic
 * (o seleccionar texto). El avatar reproduce la secuencia de glosas.
 */
(function () {
  "use strict";

  var N_POSE = 9, N_MANO = 21;
  var OFF_RH = N_POSE * 2, OFF_LH = (N_POSE + N_MANO) * 2, OFF_CEJAS = (N_POSE + 2 * N_MANO) * 2;
  var SELECTOR = "p,h1,h2,h3,h4,h5,h6,li,a,button,label,td,th,figcaption,blockquote,dt,dd,summary,.lsm-traducible";

  var CSS = [
    ":host{all:initial}",
    "*{box-sizing:border-box;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif}",
    ".btn{position:fixed;bottom:24px;z-index:2147483646;width:64px;height:64px;border-radius:50%;border:none;cursor:pointer;",
    "color:#fff;box-shadow:0 6px 18px rgba(0,0,0,.25);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;transition:transform .15s}",
    ".btn:hover{transform:scale(1.07)}.btn:focus-visible{outline:3px solid #ffbf47;outline-offset:3px}",
    ".btn svg{width:28px;height:28px}.btn span{font-size:11px;font-weight:700;letter-spacing:.5px}",
    ".btn.activo{box-shadow:0 0 0 4px rgba(255,191,71,.9),0 6px 18px rgba(0,0,0,.25)}",
    ".panel{position:fixed;bottom:100px;z-index:2147483647;width:320px;background:#fff;border-radius:14px;overflow:hidden;",
    "box-shadow:0 12px 40px rgba(0,0,0,.3);display:none;flex-direction:column;color:#1d1d1f}",
    ".panel.abierto{display:flex}",
    ".cab{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;color:#fff}",
    ".cab b{font-size:14px}.cab button{background:transparent;border:none;color:#fff;font-size:20px;cursor:pointer;line-height:1}",
    "canvas{width:320px;height:300px;display:block}",
    ".glosas{min-height:54px;padding:8px 12px;font-size:13px;line-height:1.7;border-top:1px solid #e4e4e4;max-height:96px;overflow:auto}",
    ".g{display:inline-block;padding:0 6px;margin:1px 2px;border-radius:4px;background:#f1f1f1;font-weight:600;font-size:12px}",
    ".g.dt{background:#fff4d6}.g.act{color:#fff}",
    ".letra{position:absolute;top:56px;right:14px;font-size:42px;font-weight:800;color:#0b6e4f;text-shadow:0 2px 0 #fff}",
    ".ctr{display:flex;gap:6px;align-items:center;padding:8px 12px;border-top:1px solid #e4e4e4}",
    ".ctr button{border:1px solid #ccc;background:#fafafa;border-radius:8px;padding:6px 10px;cursor:pointer;font-size:13px}",
    ".ctr button:focus-visible,.ctr input:focus-visible,textarea:focus-visible{outline:2px solid #ffbf47}",
    ".ctr label{font-size:12px;margin-left:auto;display:flex;align-items:center;gap:4px}",
    ".ent{display:flex;gap:6px;padding:0 12px 10px}",
    "textarea{flex:1;resize:none;height:40px;border:1px solid #ccc;border-radius:8px;padding:6px;font-size:13px}",
    ".ent button{border:none;border-radius:8px;color:#fff;padding:0 12px;cursor:pointer;font-weight:600}",
    ".aviso{font-size:10.5px;color:#666;padding:6px 12px 10px;line-height:1.35;background:#fafafa;border-top:1px solid #eee}",
    ".ayuda{font-size:12px;color:#444;padding:8px 12px 0}",
  ].join("");

  var ICONO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M7 11V5.5a1.5 1.5 0 0 1 3 0V10"/><path d="M10 9.5V4a1.5 1.5 0 0 1 3 0v6"/><path d="M13 9.5V5a1.5 1.5 0 0 1 3 0v6"/>' +
    '<path d="M16 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7l-2.6-4a1.5 1.5 0 0 1 2.5-1.7L9 14"/></svg>';

  function Widget(opts) {
    this.o = { color: "#0b6e4f", posicion: "derecha", velocidad: 1, ropa: "#26313d" };
    for (var k in (opts || {})) if (opts[k] !== undefined && opts[k] !== null) this.o[k] = opts[k];
    this.dic = this.o.diccionario || window.LSM_DICCIONARIO;
    if (!this.dic || !window.TraductorLSM || !window.SecuenciaLSM || !window.AvatarLSM) {
      console.error("[LSMWidget] Faltan scripts: lsm-diccionario.js, traductor-lsm.js, secuencia-lsm.js, avatar-lsm.js");
      return;
    }
    this.tr = new window.TraductorLSM(this.dic);
    this.fps = this.dic.fps || 15;
    this.vel = this.o.velocidad;
    this.cola = [];      // frames a reproducir: {f:[...], tk:index, letra:"A"}
    this.idx = 0;
    this.tokens = [];
    this.activo = false;
    this.pausa = false;
    this.ultimo = null;
    this.reposo = this._frameReposo();
    this._montar();
    this._bucle();
  }

  Widget.prototype._frameReposo = function () {
    var f = this.dic.glosas.HOLA ? this.dic.glosas.HOLA.frames[0] : null;
    if (!f) return null;
    f = window.SecuenciaLSM.normalizar(f.slice());
    for (var i = 102; i < 108; i++) f[i] = 0; // rostro neutro en reposo
    return f;
  };

  // ---------------- DOM ----------------
  Widget.prototype._montar = function () {
    var self = this, c = this.o.color, lado = this.o.posicion === "izquierda" ? "left" : "right";
    var host = document.createElement("div");
    host.id = "lsm-widget-host";
    document.body.appendChild(host);
    var sh = host.attachShadow({ mode: "open" });
    sh.innerHTML =
      "<style>" + CSS + ".btn,.ent button,.cab,.g.act{background:" + c + "}.btn,.panel{" + lado + ":24px}</style>" +
      '<button class="btn" aria-pressed="false" aria-label="Activar traductor a Lengua de Señas Mexicana" title="Traductor LSM">' + ICONO + "<span>LSM</span></button>" +
      '<section class="panel" role="dialog" aria-label="Traductor a Lengua de Señas Mexicana">' +
      '<div class="cab"><b>Traductor LSM · prototipo</b><button class="cerrar" aria-label="Cerrar">×</button></div>' +
      '<div style="position:relative"><canvas width="640" height="600" aria-label="Avatar señante"></canvas><div class="letra" aria-hidden="true"></div></div>' +
      '<div class="glosas" aria-live="polite"><div class="ayuda">Haz clic en cualquier texto de la página (o selecciónalo) y el avatar lo traducirá a LSM.</div></div>' +
      '<div class="ctr"><button class="pp" aria-label="Pausar">⏸</button><button class="rep" aria-label="Repetir">↻ Repetir</button>' +
      '<label>Velocidad <input class="vel" type="range" min="0.5" max="2" step="0.25" value="' + this.vel + '" aria-label="Velocidad"></label></div>' +
      '<div class="ent"><textarea placeholder="O escribe un texto en español…" aria-label="Texto a traducir"></textarea><button class="tr">Señar</button></div>' +
      '<div class="aviso">⚠ Señas sintéticas de demostración, <b>no validadas</b> por la comunidad Sorda; se reemplazarán por capturas reales de intérpretes.</div>' +
      "</section>";
    this.sh = sh;
    this.btn = sh.querySelector(".btn");
    this.panel = sh.querySelector(".panel");
    this.cv = sh.querySelector("canvas");
    this.ctx = this.cv.getContext("2d");
    this.elGlosas = sh.querySelector(".glosas");
    this.elLetra = sh.querySelector(".letra");

    this.btn.addEventListener("click", function () { self.alternar(); });
    sh.querySelector(".cerrar").addEventListener("click", function () { self.alternar(false); });
    sh.querySelector(".pp").addEventListener("click", function (e) {
      self.pausa = !self.pausa;
      e.currentTarget.textContent = self.pausa ? "▶" : "⏸";
      e.currentTarget.setAttribute("aria-label", self.pausa ? "Reanudar" : "Pausar");
    });
    sh.querySelector(".rep").addEventListener("click", function () { self.idx = 0; self.pausa = false; });
    sh.querySelector(".vel").addEventListener("input", function (e) { self.vel = parseFloat(e.target.value); });
    var ta = sh.querySelector("textarea");
    sh.querySelector(".tr").addEventListener("click", function () { if (ta.value.trim()) self.traducir(ta.value); });
    ta.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (ta.value.trim()) self.traducir(ta.value); } });

    // Interacción con la página
    this._hover = null;
    document.addEventListener("mouseover", function (e) {
      if (!self.activo) return;
      var el = self._objetivo(e.target);
      if (self._hover && self._hover !== el) self._hover.style.outline = self._hover._lsmOutline || "";
      if (el) { el._lsmOutline = el.style.outline; el.style.outline = "3px solid " + self.o.color; el.style.outlineOffset = "2px"; }
      self._hover = el;
    }, true);
    document.addEventListener("click", function (e) {
      if (!self.activo || e.composedPath().indexOf(host) >= 0) return;
      var sel = String(window.getSelection() || "").trim();
      if (sel) return; // la selección se maneja en mouseup
      var el = self._objetivo(e.target);
      if (!el) return;
      e.preventDefault(); e.stopPropagation();
      self.traducir(el.innerText || el.textContent);
    }, true);
    document.addEventListener("mouseup", function (e) {
      if (!self.activo || e.composedPath().indexOf(host) >= 0) return;
      var sel = String(window.getSelection() || "").trim();
      if (sel.length > 1) self.traducir(sel);
    });
    document.addEventListener("keydown", function (e) {
      // Accesible por teclado: con el widget activo, Alt+L traduce el elemento enfocado
      if (self.activo && e.altKey && (e.key === "l" || e.key === "L") && document.activeElement) {
        var el = self._objetivo(document.activeElement) || document.activeElement;
        self.traducir(el.innerText || el.textContent || "");
      }
    });
  };

  Widget.prototype._objetivo = function (el) {
    if (!el || !el.closest) return null;
    var t = el.closest(SELECTOR);
    if (!t || !(t.innerText || "").trim()) return null;
    return t;
  };

  Widget.prototype.alternar = function (forzar) {
    this.activo = typeof forzar === "boolean" ? forzar : !this.activo;
    this.btn.classList.toggle("activo", this.activo);
    this.btn.setAttribute("aria-pressed", String(this.activo));
    this.panel.classList.toggle("abierto", this.activo);
    document.documentElement.style.cursor = this.activo ? "help" : "";
    if (!this.activo && this._hover) { this._hover.style.outline = this._hover._lsmOutline || ""; this._hover = null; }
  };

  // ---------------- Traducción -> cola de frames ----------------
  Widget.prototype.traducir = function (texto) {
    if (!this.activo) this.alternar(true);
    var oraciones = this.tr.traducir(String(texto).slice(0, 600));
    var sec = window.SecuenciaLSM.construir(oraciones, this.dic, { reposo: this.reposo, desde: this.ultimo });
    // tokens con separador visual entre oraciones
    var tokens = [], mapa = {};
    sec.tokens.forEach(function (t, i) {
      if (i > 0 && t.oracion !== sec.tokens[i - 1].oracion) tokens.push({ tipo: "pausa", glosa: "//" });
      mapa[i] = tokens.length; tokens.push(t);
    });
    this.tokens = tokens;
    this.cola = sec.frames.map(function (x) { return { f: x.f, tk: x.tk >= 0 ? mapa[x.tk] : -1, letra: x.letra }; });
    this.idx = 0;
    this.pausa = false;
    this._act = null;
    this._pintarGlosas(-1);
    return oraciones;
  };

  Widget.prototype._pintarGlosas = function (act) {
    if (this._act === act) return;
    this._act = act;
    var html = this.tokens.map(function (t, i) {
      if (t.tipo === "pausa") return " / ";
      var cls = "g" + (t.tipo !== "sena" ? " dt" : "") + (i === act ? " act" : "");
      return '<span class="' + cls + '" title="' + (t.original || "") + " · " + (t.regla || "") + '">' + t.glosa + (t.pregunta ? " ?" : "") + "</span>";
    }).join("");
    this.elGlosas.innerHTML = html || '<div class="ayuda">Sin texto para traducir.</div>';
    var a = this.elGlosas.querySelector(".act");
    if (a && a.scrollIntoView) a.scrollIntoView({ block: "nearest" });
  };

  // ---------------- Render del avatar ----------------
  Widget.prototype._bucle = function () {
    var self = this, acum = 0, t0 = performance.now();
    function paso(t) {
      var dt = t - t0; t0 = t;
      if (!self.pausa && self.cola.length && self.idx < self.cola.length) {
        acum += dt;
        var ms = 1000 / (self.fps * self.vel);
        while (acum >= ms && self.idx < self.cola.length - 1) { acum -= ms; self.idx++; }
        if (self.idx >= self.cola.length - 1) acum = 0;
      }
      var item = self.cola[self.idx];
      var f = item ? item.f : self.reposo;
      if (f && self.panel.classList.contains("abierto")) {
        self.ultimo = f;
        window.AvatarLSM.dibujar(self.ctx, f, { t: t, ropa: self.o.ropa });
      }
      if (item) {
        self._pintarGlosas(item.tk);
        self.elLetra.textContent = item.letra || "";
      }
      requestAnimationFrame(paso);
    }
    requestAnimationFrame(paso);
  };

  // ---------------- API pública ----------------
  window.LSMWidget = {
    instancia: null,
    init: function (opts) {
      if (this.instancia) return this.instancia;
      var self = this;
      function crear() { self.instancia = new Widget(opts); }
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", crear); else crear();
      return this;
    },
    traducir: function (texto) { return this.instancia && this.instancia.traducir(texto); },
  };

  var s = document.currentScript;
  if (s && s.getAttribute("data-auto") === "true") {
    window.LSMWidget.init({ color: s.getAttribute("data-color") || undefined, posicion: s.getAttribute("data-posicion") || undefined });
  }
})();
