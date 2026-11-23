/*!
 * avatar-lsm.js — Render 2D "humanista" del avatar señante
 * ----------------------------------------------------------------------
 * Dibuja un frame de keypoints (formato secuencia-lsm.js) en un canvas:
 *  - Ropa lisa oscura de manga larga (convención de intérpretes de LSM:
 *    máximo contraste entre manos/rostro y fondo).
 *  - Rostro expresivo: cejas (arriba / fruncidas), párpados con parpadeo,
 *    mirada que acompaña a la mano dominante, boca que articula (mouthing),
 *    sonrisa / boca hacia abajo, giro y asentimiento de cabeza.
 *  - Respiración y micro-movimiento en reposo para que no se vea rígido.
 *
 * Uso:  AvatarLSM.dibujar(ctx, frame, { t: performance.now(), ropa: "#25303b" })
 * El canvas de referencia es 640 x 600 (se escala a cualquier tamaño).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.AvatarLSM = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var NC = 102, OFF_RH = 18, OFF_LH = 60;
  var PIEL = { base: "#d9a07e", luz: "#efc3a2", sombra: "#b47a5a", linea: "#9a6347" };

  function tono(hex, k) { // k>0 aclara, k<0 oscurece
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    function c(v) { return Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k)))); }
    return "rgb(" + c(r) + "," + c(g) + "," + c(b) + ")";
  }

  function dibujar(ctx, f, o) {
    o = o || {};
    var W = ctx.canvas.width, H = ctx.canvas.height;
    var t = (o.t || 0) / 1000;
    var ropa = o.ropa || "#26313d";
    var fondo = o.fondo || ["#f3f6f4", "#dfe8e3"];
    var s = Math.min(W / 640, H / 600);
    var esc = 640 / 700, x0 = 150, y0 = 20;
    var u = esc * 1000; // 1 unidad normalizada en px de referencia

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    var g0 = ctx.createRadialGradient(W * 0.5, H * 0.35, 20, W * 0.5, H * 0.45, W * 0.75);
    g0.addColorStop(0, fondo[0]); g0.addColorStop(1, fondo[1]);
    ctx.fillStyle = g0; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(0.78 * s, 0, 0, 0.78 * s, (W - 640 * s) / 2 + 70 * s, 4 * s);

    function P(off, i) {
      var x = f[off + i * 2], y = f[off + i * 2 + 1];
      return x < 0 ? null : [(x - x0) * esc, (y - y0) * esc];
    }
    var nm = {
      arriba: (f[NC] || 0) / 100, frunce: (f[NC + 1] || 0) / 100, boca: (f[NC + 2] || 0) / 100,
      sonr: (f[NC + 3] || 0) / 100, giro: (f[NC + 4] || 0) / 100, asen: (f[NC + 5] || 0) / 100,
    };
    // respiración y micro-movimiento
    var resp = Math.sin(t * 2 * Math.PI / 4.2) * 0.0025 * u;
    var nariz = P(0, 0), hd = P(0, 1), hi = P(0, 2), cd = P(0, 3), ci = P(0, 4), md = P(0, 5), mi = P(0, 6), kd = P(0, 7), ki = P(0, 8);
    hd = [hd[0], hd[1] + resp]; hi = [hi[0], hi[1] + resp];
    var mx = Math.sin(t * 0.9) * 0.002 * u, my = Math.sin(t * 0.7 + 1) * 0.0015 * u;

    // ---------- Torso ----------
    var cuelloY = (hd[1] + hi[1]) / 2;
    var gT = ctx.createLinearGradient(0, cuelloY - 20, 0, kd[1]);
    gT.addColorStop(0, tono(ropa, 0.12)); gT.addColorStop(1, tono(ropa, -0.25));
    ctx.fillStyle = gT;
    ctx.beginPath();
    ctx.moveTo(hd[0] + 0.02 * u, cuelloY - 0.012 * u);
    ctx.quadraticCurveTo(hd[0] - 0.035 * u, hd[1] - 0.012 * u, hd[0] - 0.042 * u, hd[1] + 0.04 * u);
    ctx.lineTo(kd[0] - 0.03 * u, kd[1] + 0.05 * u);
    ctx.lineTo(ki[0] + 0.03 * u, ki[1] + 0.05 * u);
    ctx.lineTo(hi[0] + 0.042 * u, hi[1] + 0.04 * u);
    ctx.quadraticCurveTo(hi[0] + 0.035 * u, hi[1] - 0.012 * u, hi[0] - 0.02 * u, cuelloY - 0.012 * u);
    ctx.closePath(); ctx.fill();

    // ---------- Cuello ----------
    var cx = nariz[0] + mx, cy = nariz[1] + my;
    var dxF = nm.giro * 0.018 * u, dyF = nm.asen * 0.01 * u; // desplazamiento de rasgos
    var gN = ctx.createLinearGradient(0, cy + 0.06 * u, 0, cuelloY);
    gN.addColorStop(0, PIEL.sombra); gN.addColorStop(0.45, PIEL.base); gN.addColorStop(1, PIEL.base);
    ctx.fillStyle = gN;
    ctx.beginPath();
    ctx.moveTo(cx - 0.036 * u, cy + 0.05 * u); ctx.lineTo(cx + 0.036 * u, cy + 0.05 * u);
    ctx.lineTo(cx + 0.042 * u, cuelloY + 0.005 * u); ctx.quadraticCurveTo(cx, cuelloY + 0.03 * u, cx - 0.042 * u, cuelloY + 0.005 * u);
    ctx.closePath(); ctx.fill();
    // cuello de la playera
    ctx.strokeStyle = tono(ropa, -0.35); ctx.lineWidth = 0.008 * u;
    ctx.beginPath(); ctx.moveTo(cx - 0.05 * u, cuelloY - 0.005 * u); ctx.quadraticCurveTo(cx, cuelloY + 0.04 * u, cx + 0.05 * u, cuelloY - 0.005 * u); ctx.stroke();

    // ---------- Cabeza ----------
    var hcx = cx + nm.giro * 0.006 * u, hcy = cy + dyF * 0.4;
    // orejas
    [-1, 1].forEach(function (sg) {
      ctx.fillStyle = PIEL.sombra;
      ctx.beginPath(); ctx.ellipse(hcx + sg * (0.086 * u - nm.giro * sg * 0.006 * u), hcy + 0.004 * u, 0.014 * u, 0.026 * u, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PIEL.base;
      ctx.beginPath(); ctx.ellipse(hcx + sg * (0.084 * u - nm.giro * sg * 0.006 * u), hcy + 0.004 * u, 0.009 * u, 0.019 * u, 0, 0, Math.PI * 2); ctx.fill();
    });
    function rutaCabeza() {
      ctx.beginPath();
      ctx.moveTo(hcx, hcy - 0.118 * u);
      ctx.bezierCurveTo(hcx + 0.07 * u, hcy - 0.118 * u, hcx + 0.088 * u, hcy - 0.07 * u, hcx + 0.086 * u, hcy - 0.01 * u);
      ctx.bezierCurveTo(hcx + 0.085 * u, hcy + 0.05 * u, hcx + 0.058 * u, hcy + 0.096 * u, hcx + dxF * 0.5, hcy + 0.106 * u + dyF * 0.3);
      ctx.bezierCurveTo(hcx - 0.058 * u, hcy + 0.096 * u, hcx - 0.085 * u, hcy + 0.05 * u, hcx - 0.086 * u, hcy - 0.01 * u);
      ctx.bezierCurveTo(hcx - 0.088 * u, hcy - 0.07 * u, hcx - 0.07 * u, hcy - 0.118 * u, hcx, hcy - 0.118 * u);
      ctx.closePath();
    }
    var gH = ctx.createRadialGradient(hcx - 0.02 * u + dxF, hcy - 0.03 * u, 0.01 * u, hcx, hcy, 0.12 * u);
    gH.addColorStop(0, PIEL.luz); gH.addColorStop(0.6, PIEL.base); gH.addColorStop(1, PIEL.sombra);
    ctx.fillStyle = gH; rutaCabeza(); ctx.fill();

    // cabello
    var gP = ctx.createLinearGradient(0, hcy - 0.13 * u, 0, hcy - 0.03 * u);
    gP.addColorStop(0, "#2a1d16"); gP.addColorStop(1, "#3d2a1f");
    ctx.fillStyle = gP;
    ctx.beginPath();
    ctx.moveTo(hcx - 0.09 * u, hcy - 0.005 * u);
    ctx.bezierCurveTo(hcx - 0.1 * u, hcy - 0.1 * u, hcx - 0.05 * u, hcy - 0.14 * u, hcx + 0.005 * u, hcy - 0.135 * u);
    ctx.bezierCurveTo(hcx + 0.07 * u, hcy - 0.135 * u, hcx + 0.1 * u, hcy - 0.09 * u, hcx + 0.09 * u, hcy - 0.005 * u);
    ctx.bezierCurveTo(hcx + 0.083 * u, hcy - 0.05 * u, hcx + 0.075 * u, hcy - 0.065 * u, hcx + 0.06 * u, hcy - 0.075 * u);
    ctx.bezierCurveTo(hcx + 0.02 * u, hcy - 0.06 * u + dxF * 0.2, hcx - 0.03 * u, hcy - 0.085 * u, hcx - 0.07 * u, hcy - 0.065 * u);
    ctx.bezierCurveTo(hcx - 0.08 * u, hcy - 0.05 * u, hcx - 0.085 * u, hcy - 0.03 * u, hcx - 0.09 * u, hcy - 0.005 * u);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.10)"; ctx.lineWidth = 0.006 * u;
    ctx.beginPath(); ctx.moveTo(hcx - 0.05 * u, hcy - 0.115 * u); ctx.quadraticCurveTo(hcx, hcy - 0.13 * u, hcx + 0.05 * u, hcy - 0.11 * u); ctx.stroke();

    // mejillas (rubor al sonreír)
    [-1, 1].forEach(function (sg) {
      var gm = ctx.createRadialGradient(hcx + sg * 0.05 * u + dxF, hcy + 0.03 * u, 0, hcx + sg * 0.05 * u + dxF, hcy + 0.03 * u, 0.026 * u);
      gm.addColorStop(0, "rgba(214,110,100," + (0.10 + 0.22 * Math.max(nm.sonr, 0)) + ")"); gm.addColorStop(1, "rgba(214,110,100,0)");
      ctx.fillStyle = gm; ctx.fillRect(hcx + sg * 0.05 * u + dxF - 0.03 * u, hcy, 0.06 * u, 0.06 * u);
    });

    // ---------- Ojos ----------
    var fase = (t * 1000) % 3900, parp = fase < 160 ? Math.abs(fase - 80) / 80 : 1;
    var abre = parp * (1 - 0.25 * nm.frunce - 0.22 * Math.max(nm.sonr, 0) + 0.18 * nm.arriba);
    var objetivo = md || [cx, cy + 0.2 * u];
    [-1, 1].forEach(function (sg) {
      var ex = hcx + sg * 0.033 * u + dxF, ey = hcy - 0.014 * u + dyF;
      var vx = objetivo[0] - ex, vy = objetivo[1] - ey, d = Math.hypot(vx, vy) || 1;
      var gx = vx / d * 0.0045 * u, gy = Math.min(vy / d, 0.6) * 0.003 * u;
      ctx.save();
      ctx.beginPath(); ctx.ellipse(ex, ey, 0.017 * u, Math.max(0.0008 * u, 0.0095 * u * abre), 0, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = "#fbfaf7"; ctx.fillRect(ex - 0.02 * u, ey - 0.012 * u, 0.04 * u, 0.024 * u);
      ctx.fillStyle = "#5a3b25"; ctx.beginPath(); ctx.arc(ex + gx, ey + gy, 0.0078 * u, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#1b120c"; ctx.beginPath(); ctx.arc(ex + gx, ey + gy, 0.0036 * u, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,.85)"; ctx.beginPath(); ctx.arc(ex + gx - 0.0025 * u, ey + gy - 0.0025 * u, 0.0016 * u, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // párpado superior y pestañas
      ctx.strokeStyle = "#3a2418"; ctx.lineWidth = 0.0035 * u; ctx.lineCap = "round";
      ctx.beginPath(); ctx.ellipse(ex, ey, 0.0175 * u, Math.max(0.001 * u, 0.0098 * u * abre), 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
      ctx.strokeStyle = "rgba(150,95,70,.5)"; ctx.lineWidth = 0.002 * u;
      ctx.beginPath(); ctx.ellipse(ex, ey - 0.004 * u, 0.018 * u, 0.012 * u * Math.max(abre, 0.3), 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    });

    // ---------- Cejas ----------
    [-1, 1].forEach(function (sg) {
      var base = hcy - 0.04 * u - nm.arriba * 0.016 * u + dyF;
      var ix = hcx + sg * (0.013 * u - nm.frunce * 0.004 * u) + dxF, iy = base + nm.frunce * 0.011 * u - nm.arriba * 0.004 * u;
      var ox = hcx + sg * 0.054 * u + dxF, oy = base + 0.004 * u - nm.frunce * 0.002 * u;
      var mxC = (ix + ox) / 2, myC = Math.min(iy, oy) - 0.008 * u - nm.arriba * 0.004 * u;
      ctx.fillStyle = "#2f2017";
      ctx.beginPath();
      ctx.moveTo(ix, iy - 0.004 * u); ctx.quadraticCurveTo(mxC, myC - 0.003 * u, ox, oy - 0.001 * u);
      ctx.quadraticCurveTo(mxC, myC + 0.004 * u, ix, iy + 0.0035 * u); ctx.closePath(); ctx.fill();
    });
    // arrugas de expresión
    if (nm.frunce > 0.3) {
      ctx.strokeStyle = "rgba(140,85,60," + (0.5 * nm.frunce) + ")"; ctx.lineWidth = 0.0022 * u;
      [-1, 1].forEach(function (sg) { ctx.beginPath(); ctx.moveTo(hcx + sg * 0.006 * u + dxF, hcy - 0.042 * u); ctx.lineTo(hcx + sg * 0.004 * u + dxF, hcy - 0.026 * u); ctx.stroke(); });
    }
    if (nm.arriba > 0.45) {
      ctx.strokeStyle = "rgba(140,85,60," + (0.4 * nm.arriba) + ")"; ctx.lineWidth = 0.002 * u;
      [0, 1].forEach(function (k) { ctx.beginPath(); ctx.moveTo(hcx - 0.035 * u + dxF, hcy - 0.072 * u - k * 0.008 * u); ctx.quadraticCurveTo(hcx + dxF, hcy - 0.078 * u - k * 0.008 * u, hcx + 0.035 * u + dxF, hcy - 0.072 * u - k * 0.008 * u); ctx.stroke(); });
    }

    // ---------- Nariz ----------
    ctx.strokeStyle = "rgba(150,90,62,.55)"; ctx.lineWidth = 0.003 * u; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(hcx - 0.004 * u + dxF * 1.2, hcy - 0.005 * u + dyF);
    ctx.quadraticCurveTo(hcx - 0.011 * u + dxF * 1.3, hcy + 0.02 * u + dyF, hcx - 0.004 * u + dxF * 1.3, hcy + 0.026 * u + dyF); ctx.stroke();
    ctx.fillStyle = "rgba(120,70,50,.45)";
    [-1, 1].forEach(function (sg) { ctx.beginPath(); ctx.ellipse(hcx + sg * 0.008 * u + dxF * 1.3, hcy + 0.026 * u + dyF, 0.004 * u, 0.0022 * u, 0, 0, Math.PI * 2); ctx.fill(); });

    // ---------- Boca ----------
    var bx = hcx + dxF * 1.1, by = hcy + 0.059 * u + dyF;
    var ancho = 0.024 * u * (1 + 0.22 * Math.max(nm.sonr, 0) - 0.15 * nm.boca);
    var comis = -nm.sonr * 0.009 * u;          // comisuras: arriba al sonreír
    var ab = nm.boca * 0.024 * u;              // apertura
    var labio = "#b4584b";
    if (ab > 0.0025 * u) {
      ctx.fillStyle = "#4a1c1a";
      ctx.beginPath();
      ctx.moveTo(bx - ancho, by + comis);
      ctx.quadraticCurveTo(bx, by - 0.004 * u, bx + ancho, by + comis);
      ctx.quadraticCurveTo(bx, by + ab * 1.6 + comis * 0.3, bx - ancho, by + comis);
      ctx.fill();
      ctx.save(); ctx.clip();
      ctx.fillStyle = "#f4f1ea"; ctx.fillRect(bx - ancho, by - 0.006 * u, ancho * 2, 0.0075 * u);
      ctx.fillStyle = "#c0605a"; ctx.beginPath(); ctx.ellipse(bx, by + ab * 1.25, ancho * 0.6, ab * 0.45, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = labio; ctx.lineWidth = 0.0045 * u;
      ctx.beginPath(); ctx.moveTo(bx - ancho, by + comis); ctx.quadraticCurveTo(bx, by - 0.005 * u, bx + ancho, by + comis); ctx.stroke();
      ctx.lineWidth = 0.006 * u;
      ctx.beginPath(); ctx.moveTo(bx - ancho * 0.9, by + comis + 0.002 * u); ctx.quadraticCurveTo(bx, by + ab * 1.7 + comis * 0.3, bx + ancho * 0.9, by + comis + 0.002 * u); ctx.stroke();
    } else {
      ctx.strokeStyle = "#8e3f36"; ctx.lineWidth = 0.004 * u;
      ctx.beginPath(); ctx.moveTo(bx - ancho, by + comis); ctx.quadraticCurveTo(bx, by + 0.004 * u * (1 + nm.sonr), bx + ancho, by + comis); ctx.stroke();
      ctx.strokeStyle = "rgba(180,88,75,.55)"; ctx.lineWidth = 0.006 * u;
      ctx.beginPath(); ctx.moveTo(bx - ancho * 0.6, by + 0.008 * u); ctx.quadraticCurveTo(bx, by + 0.013 * u, bx + ancho * 0.6, by + 0.008 * u); ctx.stroke();
    }
    // hoyuelos de sonrisa
    if (nm.sonr > 0.4) {
      ctx.strokeStyle = "rgba(150,90,62," + (0.5 * nm.sonr) + ")"; ctx.lineWidth = 0.0025 * u;
      [-1, 1].forEach(function (sg) { ctx.beginPath(); ctx.arc(bx + sg * (ancho + 0.004 * u), by + comis, 0.006 * u, sg > 0 ? -0.9 : Math.PI - 0.6, sg > 0 ? 0.6 : Math.PI + 0.9); ctx.stroke(); });
    }

    // ---------- Brazos y manos ----------
    function brazo(h, c, m) {
      if (!h || !c || !m) return;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      var osc = tono(ropa, -0.35);
      ctx.strokeStyle = osc; ctx.lineWidth = 0.064 * u;
      ctx.beginPath(); ctx.moveTo(h[0], h[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
      ctx.lineWidth = 0.052 * u; ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(m[0], m[1]); ctx.stroke();
      ctx.strokeStyle = tono(ropa, 0.06); ctx.lineWidth = 0.056 * u;
      ctx.beginPath(); ctx.moveTo(h[0], h[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
      ctx.lineWidth = 0.044 * u; ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(m[0], m[1]); ctx.stroke();
      // brillo de la tela
      ctx.strokeStyle = "rgba(255,255,255,.07)"; ctx.lineWidth = 0.014 * u;
      ctx.beginPath(); ctx.moveTo(h[0] - 0.008 * u, h[1]); ctx.lineTo(c[0] - 0.008 * u, c[1]); ctx.stroke();
    }
    function mano(off) {
      var p = [];
      for (var i = 0; i < 21; i++) p.push(P(off, i));
      if (!p[0]) return;
      var muneca = p[0];
      // muñeca (piel) que sale del puño de la manga
      ctx.strokeStyle = PIEL.base; ctx.lineWidth = 0.03 * u; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(muneca[0], muneca[1]); ctx.lineTo((muneca[0] + p[9][0]) / 2, (muneca[1] + p[9][1]) / 2); ctx.stroke();
      // palma
      var gp = ctx.createLinearGradient(muneca[0], muneca[1], p[9][0], p[9][1]);
      gp.addColorStop(0, PIEL.sombra); gp.addColorStop(0.5, PIEL.base); gp.addColorStop(1, PIEL.luz);
      ctx.fillStyle = gp; ctx.strokeStyle = PIEL.linea; ctx.lineWidth = 0.0025 * u; ctx.lineJoin = "round";
      ctx.beginPath();
      [0, 1, 2, 5, 9, 13, 17].forEach(function (i, k) { if (p[i]) (k ? ctx.lineTo : ctx.moveTo).call(ctx, p[i][0], p[i][1]); });
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // dedos (meñique → índice, luego pulgar encima)
      var dedos = [[17, 18, 19, 20], [13, 14, 15, 16], [9, 10, 11, 12], [5, 6, 7, 8], [1, 2, 3, 4]];
      dedos.forEach(function (d, k) {
        var w0 = (k === 4 ? 0.019 : k === 0 ? 0.0135 : 0.0158) * u;
        for (var j = 0; j < 3; j++) {
          var a = p[d[j]], b = p[d[j + 1]];
          if (!a || !b) continue;
          var w = w0 * (1 - j * 0.12);
          ctx.strokeStyle = PIEL.linea; ctx.lineWidth = w + 0.003 * u;
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
          ctx.strokeStyle = j === 2 ? PIEL.luz : PIEL.base; ctx.lineWidth = w;
          ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        }
        var tip = p[d[3]], pre = p[d[2]];
        if (tip && pre) { // uña
          var ang = Math.atan2(tip[1] - pre[1], tip[0] - pre[0]);
          ctx.fillStyle = "rgba(255,226,210,.85)";
          ctx.beginPath(); ctx.ellipse(tip[0] - Math.cos(ang) * 0.003 * u, tip[1] - Math.sin(ang) * 0.003 * u, 0.0042 * u, 0.0032 * u, ang, 0, Math.PI * 2); ctx.fill();
        }
      });
      // puño de la manga
      var c = P(0, off === OFF_RH ? 3 : 4);
      if (c) {
        var ang2 = Math.atan2(muneca[1] - c[1], muneca[0] - c[0]);
        ctx.strokeStyle = tono(ropa, -0.2); ctx.lineWidth = 0.05 * u; ctx.lineCap = "butt";
        ctx.beginPath(); ctx.moveTo(muneca[0] - Math.cos(ang2) * 0.028 * u, muneca[1] - Math.sin(ang2) * 0.028 * u);
        ctx.lineTo(muneca[0] - Math.cos(ang2) * 0.012 * u, muneca[1] - Math.sin(ang2) * 0.012 * u); ctx.stroke();
        ctx.lineCap = "round";
      }
    }
    brazo(hi, ci, mi); mano(OFF_LH);
    brazo(hd, cd, md); mano(OFF_RH);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  return { dibujar: dibujar };
});
