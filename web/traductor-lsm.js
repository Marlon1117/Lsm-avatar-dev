/*!
 * traductor-lsm.js — Traductor basado en reglas: Español -> glosas de LSM
 * ----------------------------------------------------------------------
 * Prototipo. Funciona en el
 * navegador (window.TraductorLSM) y en Node.js (require / import).
 *
 * Pipeline:
 *   1. Segmentación en oraciones y detección de pregunta (¿ ?).
 *   2. Expresiones multipalabra ("por favor", "me llamo", "por qué"...).
 *   3. Desambiguación por acento (él / sí / qué / cómo / cuándo).
 *   4. Normalización (minúsculas, sin acentos, ñ -> n para la búsqueda).
 *   5. Eliminación de palabras funcionales que LSM no lexicaliza
 *      (artículos, cópulas ser/estar, preposiciones, clíticos).
 *   6. Lematización: léxico exacto -> plural -> irregulares -> sufijos verbales.
 *   7. Reordenamiento sintáctico (heurísticas a validar con intérpretes):
 *        - marcadores temporales al inicio (HOY, AYER, MAÑANA)
 *        - negación NO al final de la cláusula
 *        - interrogativos (QUÉ, DÓNDE, ...) al final + cejas
 *   8. Palabras sin seña en el diccionario -> dactilología DT(L-E-T-R-A-S).
 *
 * Las reglas son HEURÍSTICAS para un prototipo; la gramática de la LSM
 * debe validarse con la comunidad Sorda e intérpretes certificados.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.TraductorLSM = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ---------------- Recursos lingüísticos ----------------
  var MULTIPALABRA = [
    ["lengua de señas mexicana", "lengua señas mexico"],
    ["lengua de senas mexicana", "lengua señas mexico"],
    ["cómo te llamas", "tu nombre que_preg"],
    ["como te llamas", "tu nombre que_preg"],
    ["cómo se llama", "nombre que_preg"],
    ["como se llama", "nombre que_preg"],
    ["cómo estás", "tu como_preg"],
    ["como estas", "tu como_preg"],
    ["mucho gusto", "gusto"],
    ["hasta luego", "adios"],
    ["nos vemos", "adios"],
    ["por favor", "favor"],
    ["por qué", "porque_preg"],
    ["me llamo", "yo nombre"],
    ["te llamas", "tu nombre"],
    ["se llama", "nombre"],
    ["en línea", "internet"],
    ["en linea", "internet"],
    ["sin embargo", ""],
    ["de acuerdo", "si_afirm"],
    ["buenos días", "bueno dia"],
    ["buenas tardes", "bueno tarde"],
    ["buenas noches", "bueno noche"],
  ];

  // Palabras con tilde diacrítica que cambian de función
  var DIACRITICOS = {
    "él": "el_pron", "sí": "si_afirm", "sé": "se_v", "qué": "que_preg", "cómo": "como_preg",
    "cuándo": "cuando_preg", "dónde": "donde", "quién": "quien", "cuál": "cual",
    "cuánto": "cuanto", "cuánta": "cuanta", "cuántos": "cuantos", "cuántas": "cuantas",
  };
  // Si la oración es pregunta y empieza con estas palabras sin tilde
  var INTERROGATIVO_SIN_TILDE = { que: "que_preg", como: "como_preg", cuando: "cuando_preg" };

  var STOPWORDS = new Set((
    "el la los las un una unos unas lo al del de a en y e o u ni que para por con " +
    "se le les es son ser estar esta estan está están soy eres somos fue fueron era " +
    "eran sera será estoy estas estamos estado sido siendo muy mas más pero sin sobre " +
    "este esto estos estas ese esa esos esas aquel cual_rel cuyo cuya si como cuando " +
    "ha han he has hemos haber hay también tambien ya solo sólo entre hasta desde según " +
    "segun mediante durante tras ante bajo cada otro otra otros otras mismo misma"
  ).split(/\s+/));

  var IRREGULARES = {
    voy: "ir", vas: "ir", va: "ir", vamos: "ir", van: "ir", fui: "ir", iba: "ir",
    tengo: "tener", tienes: "tener", tiene: "tener", tenemos: "tener", tienen: "tener", tuve: "tener",
    puedo: "poder", puedes: "poder", puede: "poder", podemos: "poder", pueden: "poder", pude: "poder",
    quiero: "querer", quieres: "querer", quiere: "querer", queremos: "querer", quieren: "querer",
    vengo: "venir", vienes: "venir", viene: "venir", venimos: "venir", vienen: "venir", vine: "venir",
    hago: "hacer", haces: "hacer", hace: "hacer", hacemos: "hacer", hacen: "hacer", hice: "hacer", hizo: "hacer",
    se_v: "saber", sabe: "saber", sabes: "saber", sabemos: "saber", saben: "saber",
    entiendo: "entender", entiendes: "entender", entiende: "entender", entienden: "entender",
    pido: "solicitar", pide: "solicitar", piden: "solicitar",
    oigo: "oir", oye: "oir", oyen: "oir",
    llego: "llegar", llega: "llegar", llegan: "llegar",
  };

  var SUFIJOS_VERBALES = [
    "aremos", "eremos", "iremos", "abamos", "ieron", "aron", "iendo", "ando", "amos", "emos", "imos",
    "aste", "iste", "aban", "aba", "ado", "ada", "ido", "ida", "ian", "ia", "an", "en", "as", "es",
    "ar", "er", "ir", "o", "a", "e",
  ];
  var CLITICOS = ["selo", "sela", "nos", "se", "te", "me", "lo", "la", "le"];

  var TEMPORALES = new Set(["HOY", "AYER", "MAÑANA"]);

  // Sujeto implícito (español es pro-drop; en LSM se suele señalar el referente)
  var PERSONA_SUFIJO = { o: "YO", as: "TÚ", es: "TÚ", amos: "NOSOTROS", emos: "NOSOTROS", imos: "NOSOTROS" };
  var PERSONA_IRREG = {
    voy: "YO", tengo: "YO", puedo: "YO", quiero: "YO", vengo: "YO", hago: "YO", se_v: "YO",
    entiendo: "YO", pido: "YO", oigo: "YO", llego: "YO",
    vas: "TÚ", tienes: "TÚ", puedes: "TÚ", quieres: "TÚ", vienes: "TÚ", haces: "TÚ", sabes: "TÚ", entiendes: "TÚ",
    vamos: "NOSOTROS", tenemos: "NOSOTROS", podemos: "NOSOTROS", queremos: "NOSOTROS", venimos: "NOSOTROS",
    hacemos: "NOSOTROS", sabemos: "NOSOTROS",
  };

  // ---------------- Utilidades ----------------
  function quitarAcentos(s) {
    return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  }
  function claveBusqueda(s) {
    // ñ -> n también para la búsqueda (señas -> senas)
    return quitarAcentos(s.toLowerCase());
  }
  function deletrear(palabra) {
    var p = palabra.toUpperCase().replace(/[^A-ZÑÁÉÍÓÚÜ0-9]/g, "");
    p = p.replace(/[ÁÉÍÓÚÜ]/g, function (c) { return quitarAcentos(c); });
    // dígrafos LL y RR se conservan como letras simples en este prototipo
    return p.split("");
  }

  // ---------------- Clase principal ----------------
  function Traductor(diccionario) {
    this.dic = diccionario || { glosas: {}, lexico: {} };
    this.lexico = this.dic.lexico || {};
    this.glosas = this.dic.glosas || {};
  }

  Traductor.prototype.lematizar = function (clave) {
    var lx = this.lexico;
    if (lx[clave]) return { glosa: lx[clave], regla: "lexico" };
    if (IRREGULARES[clave] && lx[IRREGULARES[clave]]) return { glosa: lx[IRREGULARES[clave]], regla: "irregular", persona: PERSONA_IRREG[clave] };
    // plural
    if (clave.length > 3 && clave.endsWith("es") && lx[clave.slice(0, -2)]) return { glosa: lx[clave.slice(0, -2)], regla: "plural" };
    if (clave.length > 2 && clave.endsWith("s") && lx[clave.slice(0, -1)]) return { glosa: lx[clave.slice(0, -1)], regla: "plural" };
    // clíticos en infinitivo/gerundio: ayudarte, registrarse, llamarle
    for (var c = 0; c < CLITICOS.length; c++) {
      var cl = CLITICOS[c];
      if (clave.length > cl.length + 3 && clave.endsWith(cl)) {
        var base = clave.slice(0, -cl.length);
        if (/(ar|er|ir|ando|iendo)$/.test(base)) {
          var r = this.lematizar(base);
          if (r) return { glosa: r.glosa, regla: "clitico+" + r.regla };
        }
      }
    }
    // sufijos verbales -> infinitivo
    for (var i = 0; i < SUFIJOS_VERBALES.length; i++) {
      var suf = SUFIJOS_VERBALES[i];
      if (clave.length > suf.length + 2 && clave.endsWith(suf)) {
        var raiz = clave.slice(0, -suf.length);
        var cands = [raiz + "ar", raiz + "er", raiz + "ir"];
        for (var k = 0; k < cands.length; k++) {
          if (lx[cands[k]]) return { glosa: lx[cands[k]], regla: "verbo:" + suf, persona: PERSONA_SUFIJO[suf] };
        }
      }
    }
    return null;
  };

  Traductor.prototype.categoria = function (glosa) {
    var g = this.glosas[glosa];
    return g ? g.cat : null;
  };

  Traductor.prototype.traducirOracion = function (oracion) {
    var esPregunta = /[¿?]/.test(oracion);
    // separar signos de puntuación para que las expresiones multipalabra coincidan
    var t = " " + oracion.toLowerCase().replace(/([¿?¡!.,;:()"])/g, " $1 ").replace(/\s+/g, " ") + " ";
    MULTIPALABRA.forEach(function (mp) {
      t = t.split(" " + mp[0] + " ").join(" " + mp[1] + " ");
    });
    var crudos = t.match(/[a-záéíóúüñ_]+|\d+/gi) || [];
    var tokens = [];
    var self = this;

    crudos.forEach(function (w, idx) {
      var original = w;
      if (DIACRITICOS[w]) w = DIACRITICOS[w];
      else if (esPregunta && idx === 0 && INTERROGATIVO_SIN_TILDE[w]) w = INTERROGATIVO_SIN_TILDE[w];
      if (w === "porque_preg" || w.indexOf("_") > 0) {
        // token especial generado por las reglas
      } else if (/^\d+$/.test(w)) {
        tokens.push({ tipo: "numero", glosa: "#" + w, letras: w.split(""), original: original, regla: "numero" });
        return;
      }
      var clave = w.indexOf("_") > 0 ? w : claveBusqueda(w);
      if (STOPWORDS.has(w) || STOPWORDS.has(clave)) return;
      var lem = self.lematizar(clave);
      if (lem) {
        tokens.push({ tipo: "sena", glosa: lem.glosa, original: original, regla: lem.regla, persona: lem.persona,
                      cat: self.categoria(lem.glosa), nm: (self.glosas[lem.glosa] || {}).nm || null });
      } else {
        var letras = deletrear(original.replace(/_.*/, ""));
        if (letras.length) {
          tokens.push({ tipo: "dactilologia", glosa: "DT(" + letras.join("-") + ")", letras: letras,
                        original: original, regla: "sin-seña" });
        }
      }
    });

    // --- Sujeto implícito: si no hay pronombre, se inserta antes del primer verbo conjugado ---
    var hayPronombre = tokens.some(function (tk) { return tk.cat === "pronombre"; });
    if (!hayPronombre) {
      for (var p = 0; p < tokens.length; p++) {
        var pr = tokens[p].persona;
        if (pr && self.glosas[pr]) {
          tokens.splice(p, 0, { tipo: "sena", glosa: pr, original: "(" + tokens[p].original + ")",
                                regla: "sujeto-implicito", cat: "pronombre", nm: null });
          break;
        }
      }
    }

    // --- Reordenamiento ---
    var tiempo = [], negacion = [], interrog = [], resto = [];
    tokens.forEach(function (tk) {
      if (tk.tipo === "sena" && TEMPORALES.has(tk.glosa)) tiempo.push(tk);
      else if (tk.tipo === "sena" && tk.glosa === "NO") negacion.push(tk);
      else if (tk.tipo === "sena" && tk.cat === "interrogativo") interrog.push(tk);
      else resto.push(tk);
    });
    var orden = tiempo.concat(resto, negacion, interrog);
    // eliminar repeticiones consecutivas (p. ej. "trámites y gestiones")
    var final = [];
    orden.forEach(function (tk) {
      if (!final.length || final[final.length - 1].glosa !== tk.glosa) final.push(tk);
    });
    if (esPregunta && final.length) final[final.length - 1].pregunta = true;
    return {
      oracion: oracion.trim(),
      pregunta: esPregunta,
      tokens: final,
      glosa: final.map(function (x) { return x.glosa; }).join(" ") + (esPregunta && final.length ? " ?" : ""),
    };
  };

  Traductor.prototype.traducir = function (texto) {
    var self = this;
    var oraciones = (texto || "")
      .replace(/\s+/g, " ")
      .match(/[^.!?\n;]+[.!?;]*/g) || [];
    return oraciones
      .map(function (o) { return o.trim(); })
      .filter(function (o) { return o.replace(/[¿?¡!.,;:\s]/g, "").length > 0; })
      .map(function (o) { return self.traducirOracion(o); });
  };

  // Métrica para evaluar contra glosas de referencia (WER a nivel glosa)
  Traductor.wer = function (hip, ref) {
    var h = hip.trim().split(/\s+/).filter(Boolean);
    var r = ref.trim().split(/\s+/).filter(Boolean);
    var d = [];
    for (var i = 0; i <= r.length; i++) { d.push([i]); }
    for (var j = 1; j <= h.length; j++) d[0][j] = j;
    for (i = 1; i <= r.length; i++)
      for (j = 1; j <= h.length; j++)
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
    return r.length ? d[r.length][h.length] / r.length : 0;
  };

  return Traductor;
});
