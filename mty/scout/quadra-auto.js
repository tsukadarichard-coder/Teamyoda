/* Quadra achada sozinha num quadro do vídeo · Tecnologia QuadraLab. Função pura (Node e navegador).
   1) Pixels de linha: claros, sem cor e mais claros que os vizinhos a poucos pixels (linha fina, não uma área branca).
   2) Retas pela transformada de Hough; separa as "horizontais" (fundo, saque) das "longitudinais" (laterais).
   3) Para cada par de horizontais e par de longitudinais, testa quais linhas da quadra elas são (fundo/saque, duplas/simples),
      calcula a homografia e mede quantos pontos de todas as linhas da quadra caem sobre pixels de linha. Fica a melhor.
   QLQuadraAuto.detectar(rgba, largura, altura) → { cantos: [perto-esq, perto-dir, longe-dir, longe-esq] (quadra de duplas, 0..1), nota, ... } | null */
(function (raiz, fab) {
  var api = fab();
  if (typeof module === "object" && module.exports) module.exports = api; else raiz.QLQuadraAuto = api;
})(typeof window !== "undefined" ? window : this, function () {
  var L = 11.885, S = 6.40, D = 5.485, SI = 4.115;
  var MODELO_H = [L, S, -S, -L], MODELO_V = [-D, -SI, SI, D];
  var LINHAS = [[[-D, -L], [D, -L]], [[-D, L], [D, L]], [[-D, -L], [-D, L]], [[D, -L], [D, L]], [[-SI, -L], [-SI, L]], [[SI, -L], [SI, L]], [[-SI, -S], [SI, -S]], [[-SI, S], [SI, S]], [[0, -S], [0, S]]];
  function resolver(A, b) {
    var n = b.length, M = A.map(function (l, i) { return l.concat([b[i]]); });
    for (var c = 0; c < n; c++) {
      var p = c; for (var r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      var t = M[c]; M[c] = M[p]; M[p] = t; if (Math.abs(M[c][c]) < 1e-12) return null;
      for (r = 0; r < n; r++) if (r !== c) { var f = M[r][c] / M[c][c]; for (var k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map(function (l, i) { return l[n] / l[i]; });
  }
  function homografia(de, para) {
    var A = [], b = [];
    for (var i = 0; i < 4; i++) { var x = de[i][0], y = de[i][1], u = para[i][0], v = para[i][1]; A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v); }
    var h = resolver(A, b); return h ? h.concat([1]) : null;
  }
  function aplicar(H, p) { var w = H[6] * p[0] + H[7] * p[1] + H[8]; return [(H[0] * p[0] + H[1] * p[1] + H[2]) / w, (H[3] * p[0] + H[4] * p[1] + H[5]) / w, w]; }

  /* máscara de linhas */
  function mascara(rgba, w, h) {
    var n = w * h, lum = new Float32Array(n), cor = new Uint8Array(n), m = new Uint8Array(n), d = Math.max(2, Math.round(w / 220));
    for (var i = 0, j = 0; i < n; i++, j += 4) { var r = rgba[j], g = rgba[j + 1], b = rgba[j + 2]; lum[i] = (r + g + b) / 3; cor[i] = Math.max(r, g, b) - Math.min(r, g, b) < 55 ? 1 : 0; }
    var hist = new Uint32Array(256); for (i = 0; i < n; i++) hist[Math.min(255, lum[i] | 0)]++;
    var acc = 0, p85 = 255; for (var k = 255; k >= 0; k--) { acc += hist[k]; if (acc > n * 0.15) { p85 = k; break; } }
    var limiar = Math.max(110, Math.min(200, p85));
    for (var y = d; y < h - d; y++) for (var x = d; x < w - d; x++) {
      i = y * w + x; var v = lum[i]; if (v < limiar || !cor[i]) continue;
      var hor = v - Math.max(lum[i - d], lum[i + d]), ver = v - Math.max(lum[i - d * w], lum[i + d * w]);
      if (hor > 22 || ver > 22) m[i] = 1;
    }
    return m;
  }
  /* Hough: (θ, ρ) com x cos θ + y sin θ = ρ */
  function hough(m, w, h) {
    var nT = 180, diag = Math.ceil(Math.hypot(w, h)), nR = 2 * diag + 1, acc = new Uint32Array(nT * nR), cs = [], sn = [];
    for (var t = 0; t < nT; t++) { cs.push(Math.cos(t * Math.PI / nT)); sn.push(Math.sin(t * Math.PI / nT)); }
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) if (m[y * w + x]) for (t = 0; t < nT; t++) acc[t * nR + Math.round(x * cs[t] + y * sn[t]) + diag]++;
    var picos = [];
    for (t = 0; t < nT; t++) for (var r = 0; r < nR; r++) { var v = acc[t * nR + r]; if (v >= Math.max(18, w / 25)) picos.push([v, t, r - diag]); }
    picos.sort(function (a, b) { return b[0] - a[0]; });
    var linhas = [];
    for (var i = 0; i < picos.length && linhas.length < 36; i++) {
      var p = picos[i], perto = linhas.some(function (l) { var dt = Math.min(Math.abs(l.t - p[1]), nT - Math.abs(l.t - p[1])); return dt <= 4 && Math.abs(l.r - (dt === Math.abs(l.t - p[1]) ? p[2] : -p[2])) <= Math.max(6, w / 90); });
      if (!perto) linhas.push({ v: p[0], t: p[1], r: p[2], th: p[1] * Math.PI / nT });
    }
    return linhas;
  }
  function cruza(a, b) {
    var c1 = Math.cos(a.th), s1 = Math.sin(a.th), c2 = Math.cos(b.th), s2 = Math.sin(b.th), det = c1 * s2 - s1 * c2;
    if (Math.abs(det) < 1e-6) return null;
    return [(a.r * s2 - s1 * b.r) / det, (c1 * b.r - a.r * c2) / det];
  }
  /* pontos de amostra das linhas da quadra (em metros) */
  var AMOSTRAS = (function () { var l = []; LINHAS.forEach(function (sg) { var n = Math.max(4, Math.round(Math.hypot(sg[1][0] - sg[0][0], sg[1][1] - sg[0][1]) / 0.3)); for (var i = 0; i <= n; i++) l.push([sg[0][0] + (sg[1][0] - sg[0][0]) * i / n, sg[0][1] + (sg[1][1] - sg[0][1]) * i / n]); }); return l; })();

  function detectar(rgba, w, h) {
    var m = mascara(rgba, w, h), dil = new Uint8Array(w * h);
    for (var y = 1; y < h - 1; y++) for (var x = 1; x < w - 1; x++) { var i = y * w + x; if (m[i] || m[i - 1] || m[i + 1] || m[i - w] || m[i + w]) dil[i] = 1; }
    var linhas = hough(m, w, h);
    /* horizontais: normal perto da vertical (θ ~ 90°) */
    var hz = linhas.filter(function (l) { return Math.abs(l.t - 90) <= 22; }), lg = linhas.filter(function (l) { return Math.abs(l.t - 90) > 22; });
    if (hz.length < 2 || lg.length < 2) return null;
    hz = hz.slice(0, 12); lg = lg.slice(0, 12);
    var yC = function (l) { return (l.r - (w / 2) * Math.cos(l.th)) / Math.sin(l.th); }, xB = function (l) { return (l.r - h * Math.sin(l.th)) / Math.cos(l.th); };
    hz.sort(function (a, b) { return yC(a) - yC(b); }); lg.sort(function (a, b) { return xB(a) - xB(b); });
    /* nota: pixels de linha DISTINTOS cobertos pelas linhas da quadra projetadas (uma quadra "achatada" sobre uma reta só
       acertaria todas as amostras, mas cobre poucos pixels), menos as amostras que caem fora de linha */
    var marca = new Uint32Array(Math.ceil(w / 2) * Math.ceil(h / 2)), rodada = 0, w2 = Math.ceil(w / 2);
    function nota(H) {
      var dentro = 0, unicos = 0, erros = 0; rodada++;
      for (var k = 0; k < AMOSTRAS.length; k++) {
        var p = aplicar(H, AMOSTRAS[k]); if (p[2] <= 0) return -1;
        var px = Math.round(p[0]), py = Math.round(p[1]);
        if (px < 1 || py < 1 || px >= w - 1 || py >= h - 1) continue;
        dentro++;
        if (dil[py * w + px]) { var c = (py >> 1) * w2 + (px >> 1); if (marca[c] !== rodada) { marca[c] = rodada; unicos++; } } else erros++;
      }
      return dentro < AMOSTRAS.length * 0.5 ? -1 : unicos - 0.35 * erros;
    }
    var melhor = null;
    for (var a = 0; a < hz.length; a++) for (var b = a + 1; b < hz.length; b++) for (var c = 0; c < lg.length; c++) for (var d = c + 1; d < lg.length; d++) {
      var q = [cruza(hz[b], lg[c]), cruza(hz[b], lg[d]), cruza(hz[a], lg[d]), cruza(hz[a], lg[c])]; // baixo-esq, baixo-dir, cima-dir, cima-esq
      if (q.some(function (p) { return !p || p[0] < -w || p[0] > 2 * w || p[1] < -h || p[1] > 2 * h; })) continue;
      for (var i1 = 0; i1 < 4; i1++) for (var i2 = i1 + 1; i2 < 4; i2++) for (var j1 = 0; j1 < 4; j1++) for (var j2 = j1 + 1; j2 < 4; j2++) {
        var yS = MODELO_H[i1], yI = MODELO_H[i2], xE = MODELO_V[j1], xD = MODELO_V[j2];
        var H = homografia([[xE, yI], [xD, yI], [xD, yS], [xE, yS]], q); if (!H) continue;
        var s = nota(H); if (s > (melhor ? melhor.nota : 0)) melhor = { nota: s, H: H };
      }
    }
    if (!melhor) return null;
    /* refinamento: ajusta cada canto da quadra de duplas em ±2 px enquanto a nota sobe */
    var cantosM = [[-D, -L], [D, -L], [D, L], [-D, L]], cs = cantosM.map(function (c) { var p = aplicar(melhor.H, c); return [p[0], p[1]]; }), base = melhor.nota;
    for (var it = 0; it < 3; it++) for (var k = 0; k < 4; k++) for (var dx = -2; dx <= 2; dx += 2) for (var dy = -2; dy <= 2; dy += 2) {
      if (!dx && !dy) continue; var t = cs.map(function (c) { return c.slice(); }); t[k][0] += dx; t[k][1] += dy;
      var H2 = homografia(cantosM, t); if (!H2) continue; var s2 = nota(H2); if (s2 > base) { base = s2; cs = t; melhor.H = H2; }
    }
    var dentro = 0, acerto = 0;
    AMOSTRAS.forEach(function (pp) { var p = aplicar(melhor.H, pp), px = Math.round(p[0]), py = Math.round(p[1]); if (px < 1 || py < 1 || px >= w - 1 || py >= h - 1) return; dentro++; if (dil[py * w + px]) acerto++; });
    return { cantos: cs.map(function (c) { return [c[0] / w, c[1] / h]; }), nota: dentro ? acerto / dentro : 0, visiveis: dentro / AMOSTRAS.length, linhas: linhas.length };
  }
  return { detectar: detectar, mascara: mascara };
});
