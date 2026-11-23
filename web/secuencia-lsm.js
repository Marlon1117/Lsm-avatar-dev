/*!
 * secuencia-lsm.js — Convierte glosas en una secuencia continua de frames
 * ----------------------------------------------------------------------
 * Compartido por el widget (navegador) y por el generador del dataset de
 * prueba (Node), para que lo que se ve y lo que se guarda sea idéntico.
 *
 * Frame: 102 coordenadas (51 puntos x,y en 0..1000, -1 = ausente)
 *        + 6 canales no manuales:
 *          [0] cejas_arriba  [1] cejas_fruncidas  [2] boca_abierta
 *          [3] sonrisa (-100..100)  [4] giro_cabeza  [5] asentir
 * Clips antiguos con 1 solo canal (cejas) se completan con ceros.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SecuenciaLSM = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var NC = 102, NNM = 6, LARGO = NC + NNM;

  function normalizar(f) {
    if (f.length === LARGO) return f;
    var r = f.slice(0, NC);
    for (var i = 0; i < NNM; i++) r.push(f[NC + i] || 0);
    return r;
  }

  function mezcla(a, b, t) {
    var r = new Array(LARGO);
    for (var i = 0; i < LARGO; i++) {
      if (i < NC && (a[i] < 0 || b[i] < 0)) r[i] = t < 0.5 ? a[i] : b[i];
      else r[i] = a[i] + (b[i] - a[i]) * t;
    }
    return r;
  }

  /**
   * @param oraciones  salida de TraductorLSM.traducir()
   * @param dic        LSM_DICCIONARIO
   * @param opts       {reposo:frame, transicion:3, pausa:6, recorteLetra:[2,1]}
   * @returns {frames:[{f, tk, glosa, letra}], tokens:[...]}
   */
  function construir(oraciones, dic, opts) {
    opts = opts || {};
    var trans = opts.transicion == null ? 3 : opts.transicion;
    var reposo = opts.reposo ? normalizar(opts.reposo) : null;
    var cola = [], tokens = [];
    var prev = opts.desde ? normalizar(opts.desde) : reposo;

    function agregar(frames, tk, glosa, letra, rec) {
      if (!frames || !frames.length) return;
      var fs = (rec ? frames.slice(rec[0], frames.length - rec[1]) : frames).map(normalizar);
      if (!fs.length) return;
      if (prev) for (var k = 1; k <= trans; k++) cola.push({ f: mezcla(prev, fs[0], k / (trans + 1)), tk: tk, glosa: "<trans>", letra: letra, oracion: tokens[tk] ? tokens[tk].oracion : -1 });
      fs.forEach(function (f) { cola.push({ f: f, tk: tk, glosa: glosa, letra: letra, oracion: tokens[tk] ? tokens[tk].oracion : -1 }); });
      prev = fs[fs.length - 1];
    }

    oraciones.forEach(function (o, oi) {
      var ini = cola.length;
      // pregunta sí/no (sin interrogativo QU): cejas arriba durante toda la oración
      var siNo = o.pregunta && !o.tokens.some(function (t) { return t.cat === "interrogativo"; });
      o.tokens.forEach(function (t) {
        var i = tokens.length;
        tokens.push(Object.assign({}, t, { oracion: oi }));
        if (t.tipo === "sena" && dic.glosas[t.glosa]) {
          agregar(dic.glosas[t.glosa].frames, i, t.glosa, null, null);
        } else if (t.tipo === "dactilologia" || t.tipo === "numero") {
          (t.letras || []).forEach(function (l) {
            var c = dic.alfabeto[l];
            if (c) agregar(c.frames, i, "DT-" + l, l, opts.recorteLetra || [2, 1]);
          });
        }
      });
      if (siNo) {
        var n = cola.length - ini;
        for (var k = ini; k < cola.length; k++) {
          var r = Math.min(1, (k - ini) / 4, (cola.length - 1 - k) / 3 + 0.3);
          var f = cola[k].f.slice();
          f[NC] = Math.max(f[NC], 90 * r);      // cejas arriba
          f[NC + 1] = Math.min(f[NC + 1], 10);  // sin ceño
          f[NC + 5] += -15 * r;                 // cabeza ligeramente adelante
          cola[k] = Object.assign({}, cola[k], { f: f });
        }
      }
      // pausa entre oraciones: volver cerca del reposo
      if (reposo && oi < oraciones.length - 1) {
        for (var p = 1; p <= (opts.pausa || 6); p++) cola.push({ f: mezcla(prev, reposo, p / (opts.pausa || 6)), tk: -1, glosa: "<pausa>", oracion: oi });
        prev = reposo;
      }
    });
    if (reposo && prev) for (var q = 1; q <= 6; q++) cola.push({ f: mezcla(prev, reposo, q / 6), tk: -1, glosa: "<reposo>", oracion: -1 });
    return { frames: cola, tokens: tokens };
  }

  return { construir: construir, mezcla: mezcla, normalizar: normalizar, NC: NC, NNM: NNM, LARGO: LARGO };
});
