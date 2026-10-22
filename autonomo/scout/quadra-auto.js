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

  /* máscara de linhas: pixel bem mais claro que os vizinhos a poucos pixels (linha fina) e não mais colorido que eles.
     No saibro a linha fica alaranjada e só ~40 níveis acima do piso: não dá para exigir "branco"; vale o contraste local */
  function mascara(rgba, w, h) {
    var n = w * h, lum = new Float32Array(n), cro = new Float32Array(n), m = new Uint8Array(n), d = Math.max(2, Math.round(w / 220));
    var bin = new Uint16Array(n), cima = new Float32Array(512), baixo = new Float32Array(512), y0 = Math.floor(h * 0.2), y1 = Math.floor(h * 0.62);
    for (var i = 0, j = 0; i < n; i++, j += 4) {
      var r = rgba[j], g = rgba[j + 1], b = rgba[j + 2]; lum[i] = (r + g + b) / 3; cro[i] = Math.max(r, g, b) - Math.min(r, g, b);
      bin[i] = (r >> 5) * 64 + (g >> 5) * 8 + (b >> 5);
      var yy = (i / w) | 0; if (yy < y0) cima[bin[i]]++; else if (yy >= y1) baixo[bin[i]]++;
    }
    /* "piso": cores comuns na parte de baixo do quadro e não muito mais comuns no alto (alambrado, banners, céu).
       Linha de quadra tem piso dos dois lados; alambrado, letreiro e rede não */
    var nc = y0 * w || 1, nb = (h - y1) * w || 1, piso = new Uint8Array(512);
    for (var k = 0; k < 512; k++) piso[k] = baixo[k] >= 3 && (baixo[k] / nb) * 4 >= cima[k] / nc ? 1 : 0;
    for (var y = d; y < h - d; y++) for (var x = d; x < w - d; x++) {
      i = y * w + x; var v = lum[i]; if (v < 90) continue;
      var a1 = lum[i - d], a2 = lum[i + d], b1 = lum[i - d * w], b2 = lum[i + d * w];
      var hor = v - Math.max(a1, a2), ver = v - Math.max(b1, b2), lim = Math.max(18, v * 0.11);
      if ((hor > lim && piso[bin[i - d]] && piso[bin[i + d]] && cro[i] <= Math.max(cro[i - d], cro[i + d]) + 12) ||
          (ver > lim && piso[bin[i - d * w]] && piso[bin[i + d * w]] && cro[i] <= Math.max(cro[i - d * w], cro[i + d * w]) + 12)) m[i] = 1;
    }
    /* textura do piso (marcas no saibro, grama) dá pontinhos soltos: fica só o que forma um traço comprido */
    var rot = new Int32Array(n), pilha = new Int32Array(n), min = Math.max(6, Math.round(w / 45));
    for (i = 0; i < n; i++) {
      if (!m[i] || rot[i]) continue;
      var topo = 0, comp = [], x0 = w, x1 = 0, ya = h, yb = 0; pilha[topo++] = i; rot[i] = 1;
      while (topo) {
        var p = pilha[--topo], px = p % w, py = (p / w) | 0; comp.push(p);
        if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < ya) ya = py; if (py > yb) yb = py;
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
          var qx = px + dx, qy = py + dy; if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue;
          var q = qy * w + qx; if (m[q] && !rot[q]) { rot[q] = 1; pilha[topo++] = q; }
        }
      }
      if (Math.max(x1 - x0, yb - ya) < min) for (k = 0; k < comp.length; k++) m[comp[k]] = 0;
    }
    return m;
  }
  /* Hough: (θ, ρ) com x cos θ + y sin θ = ρ */
  /* a cada reta aceita, os pixels dela (faixa de ±esp) saem da votação: uma linha grossa não vira um leque de retas quase iguais */
  function hough(m, w, h) {
    var nT = 360, diag = Math.ceil(Math.hypot(w, h)), nR = 2 * diag + 1, acc = new Int32Array(nT * nR), cs = [], sn = [], pts = [];
    for (var t = 0; t < nT; t++) { cs.push(Math.cos(t * Math.PI / nT)); sn.push(Math.sin(t * Math.PI / nT)); }
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) if (m[y * w + x]) pts.push(x, y);
    function vota(x, y, s) { for (var t = 0; t < nT; t++) acc[t * nR + Math.round(x * cs[t] + y * sn[t]) + diag] += s; }
    for (var i = 0; i < pts.length; i += 2) vota(pts[i], pts[i + 1], 1);
    var vivo = new Uint8Array(pts.length / 2).fill(1), linhas = [], minimo = Math.max(12, w / 55), esp = Math.max(2.5, w / 200);
    while (linhas.length < 30) {
      var mx = 0, at = 0, ar = 0;
      for (var k = 0; k < acc.length; k++) if (acc[k] > mx) { mx = acc[k]; at = (k / nR) | 0; ar = k % nR - diag; }
      if (mx < minimo) break;
      linhas.push({ v: mx, t: at, r: ar, th: at * Math.PI / nT });
      for (i = 0; i < vivo.length; i++) if (vivo[i] && Math.abs(pts[2 * i] * cs[at] + pts[2 * i + 1] * sn[at] - ar) <= esp) { vivo[i] = 0; vota(pts[2 * i], pts[2 * i + 1], -1); }
    }
    return linhas;
  }
  function cruza(a, b) {
    var c1 = Math.cos(a.th), s1 = Math.sin(a.th), c2 = Math.cos(b.th), s2 = Math.sin(b.th), det = c1 * s2 - s1 * c2;
    if (Math.abs(det) < 1e-6) return null;
    return [(a.r * s2 - s1 * b.r) / det, (c1 * b.r - a.r * c2) / det];
  }
  /* duas famílias de retas pelos pontos de fuga: as paralelas à rede convergem para um ponto, as laterais para outro */
  function familias(linhas, w, h) {
    if (linhas.length < 4) return null;
    var dirs = linhas.map(function (l) { return [-Math.sin(l.th), Math.cos(l.th)]; });
    function apoio(v, usadas) { // retas que passam (em direção) pelo ponto de fuga v (homogêneo)
      var l = [];
      linhas.forEach(function (ln, k) {
        if (usadas && usadas[k]) return;
        var c = Math.cos(ln.th), s2 = Math.sin(ln.th), p0 = [ln.r * c, ln.r * s2]; // ponto da reta mais perto da origem
        var dx, dy; if (Math.abs(v[2]) < 1e-9) { dx = v[0]; dy = v[1]; } else { dx = v[0] / v[2] - p0[0]; dy = v[1] / v[2] - p0[1]; }
        var n = Math.hypot(dx, dy); if (!n) return;
        var cosA = Math.abs((dx * dirs[k][0] + dy * dirs[k][1]) / n);
        if (cosA > Math.cos(1.5 * Math.PI / 180) || (Math.abs(v[2]) > 1e-9 && Math.abs(c * v[0] / v[2] + s2 * v[1] / v[2] - ln.r) < 2)) l.push(k);
      });
      return l;
    }
    function melhorPF(usadas) {
      var top = null;
      for (var i = 0; i < linhas.length; i++) for (var j = i + 1; j < linhas.length; j++) {
        if ((usadas && (usadas[i] || usadas[j]))) continue;
        var a = linhas[i], b = linhas[j], v = [a.r * Math.sin(b.th) - Math.sin(a.th) * b.r, Math.cos(a.th) * b.r - a.r * Math.cos(b.th), Math.cos(a.th) * Math.sin(b.th) - Math.sin(a.th) * Math.cos(b.th)];
        var ap = apoio(v, usadas), peso = ap.reduce(function (s, k) { return s + linhas[k].v; }, 0);
        if (ap.length >= 2 && (!top || peso > top.peso)) top = { v: v, ap: ap, peso: peso };
      }
      return top;
    }
    var p1 = melhorPF(null); if (!p1) return null;
    var usadas = {}; p1.ap.forEach(function (k) { usadas[k] = 1; });
    /* a segunda família: as que convergem juntas primeiro e depois as demais (a linha de saque às vezes sai com poucos
       pixels, encoberta pelo jogador, e o ponto de fuga das paralelas à rede fica longe e mal definido) */
    var p2 = melhorPF(usadas), ord = p2 ? p2.ap.slice() : [];
    linhas.forEach(function (_, k) { if (!usadas[k] && ord.indexOf(k) < 0) ord.push(k); });
    if (ord.length < 2) return null;
    return [p1.ap.map(function (k) { return linhas[k]; }), ord.map(function (k) { return linhas[k]; })];
  }
  /* pontos de amostra das linhas da quadra (em metros) */
  var TRECHOS = (function () { var l = []; LINHAS.forEach(function (sg) { var partes = sg[0][1] < 0 && sg[1][1] > 0 ? [[sg[0], [sg[0][0], 0]], [[sg[0][0], 0], sg[1]]] : [sg]; partes.forEach(function (q) { var n = Math.max(6, Math.round(Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]) / 0.3)), t = []; for (var i = 0; i <= n; i++) t.push([q[0][0] + (q[1][0] - q[0][0]) * i / n, q[0][1] + (q[1][1] - q[0][1]) * i / n]); l.push(t); }); }); return l; })();
  var AMOSTRAS = (function () { var l = []; LINHAS.forEach(function (sg) { var n = Math.max(4, Math.round(Math.hypot(sg[1][0] - sg[0][0], sg[1][1] - sg[0][1]) / 0.3)); for (var i = 0; i <= n; i++) l.push([sg[0][0] + (sg[1][0] - sg[0][0]) * i / n, sg[0][1] + (sg[1][1] - sg[0][1]) * i / n]); }); return l; })();

  function detectar(rgba, w, h) {
    var m = mascara(rgba, w, h), dil = new Uint8Array(w * h);
    for (var y = 1; y < h - 1; y++) for (var x = 1; x < w - 1; x++) { var i = y * w + x; if (m[i] || m[i - 1] || m[i + 1] || m[i - w] || m[i + w]) dil[i] = 1; }
    var linhas = hough(m, w, h).slice(0, 26);
    var fam = familias(linhas, w, h) || [linhas, []];
    if (!fam) return null;
    function nota(H) { return notaH(H, true); }
    /* nota: pixels de linha DISTINTOS cobertos pelas linhas da quadra projetadas (uma quadra "achatada" sobre uma reta só
       acertaria todas as amostras, mas cobre poucos pixels), menos as amostras que caem fora de linha */
    var marca = new Uint32Array(Math.ceil(w / 2) * Math.ceil(h / 2)), rodada = 0, w2 = Math.ceil(w / 2);
    function notaH(H) {
      var dentro = 0, unicos = 0, erros = 0; rodada++;
      for (var k = 0; k < AMOSTRAS.length; k++) {
        var p = aplicar(H, AMOSTRAS[k]); if (p[2] <= 0) return -1;
        var px = Math.round(p[0]), py = Math.round(p[1]);
        if (px < 1 || py < 1 || px >= w - 1 || py >= h - 1) continue;
        dentro++;
        if (dil[py * w + px]) { var c = (py >> 1) * w2 + (px >> 1); if (marca[c] !== rodada) { marca[c] = rodada; unicos++; } } else erros++;
      }
      return dentro < AMOSTRAS.length * 0.3 ? -1 : unicos - 0.35 * erros;
    }
    /* câmera de verdade: com pixels quadrados e o centro óptico no meio do quadro, a homografia do chão dá duas estimativas
       independentes da distância focal, que têm de ser positivas e parecidas. Um encaixe "torcido" (lateral tomada por linha
       de fundo) cobre bem as linhas mas pede uma câmera impossível */
    function coerente(H) {
      var cx = w / 2, cy = h / 2, a0 = H[0] - cx * H[6], a1 = H[1] - cx * H[7], a3 = H[3] - cy * H[6], a4 = H[4] - cy * H[7], a6 = H[6], a7 = H[7];
      var n = Math.hypot(a0, a1, a3, a4) || 1, est = [];
      if (Math.abs(a6 * a7) * h * h > 1e-4 * n * n / 4) est.push(-(a0 * a1 + a3 * a4) / (a6 * a7));
      if (Math.abs(a7 * a7 - a6 * a6) * h * h > 1e-4 * n * n / 4) est.push((a0 * a0 + a3 * a3 - a1 * a1 - a4 * a4) / (a7 * a7 - a6 * a6));
      for (var i = 0; i < est.length; i++) if (!(est[i] > 0) || Math.sqrt(est[i]) < 0.35 * h || Math.sqrt(est[i]) > 12 * h) return false;
      return est.length < 2 || Math.max(est[0], est[1]) / Math.min(est[0], est[1]) < 2.5;
    }
    /* hipóteses: dois pares de retas (as famílias dos pontos de fuga só ordenam: com retas quase paralelas o agrupamento
       erra, então vale qualquer par contra qualquer par). Os 4 cruzamentos têm de formar um quadrilátero convexo; cada par
       pode ser o das paralelas à rede ou o das laterais, e cada reta qualquer linha do modelo */
    var cand = fam[0].concat(fam[1]).filter(function (l, k, arr) { return arr.indexOf(l) === k; }), resto = linhas.filter(function (l) { return cand.indexOf(l) < 0; });
    var R = cand.concat(resto).slice(0, 12), pares = [], melhor = null;
    for (var a = 0; a < R.length; a++) for (var b = a + 1; b < R.length; b++) pares.push([R[a], R[b]]);
    function convexo(q) { var s = 0; for (var i = 0; i < 4; i++) { var p0 = q[i], p1 = q[(i + 1) % 4], p2 = q[(i + 2) % 4], z = (p1[0] - p0[0]) * (p2[1] - p1[1]) - (p1[1] - p0[1]) * (p2[0] - p1[0]); if (Math.abs(z) < 1e-6) return false; if (!s) s = Math.sign(z); else if (Math.sign(z) !== s) return false; } return true; }
    for (var pa = 0; pa < pares.length; pa++) for (var pb = pa + 1; pb < pares.length; pb++) {
      var P = pares[pa], Qp = pares[pb]; if (P[0] === Qp[0] || P[0] === Qp[1] || P[1] === Qp[0] || P[1] === Qp[1]) continue;
      for (var lado = 0; lado < 2; lado++) {
        var FH = lado ? Qp : P, FV = lado ? P : Qp;
        var q = [cruza(FH[1], FV[0]), cruza(FH[1], FV[1]), cruza(FH[0], FV[1]), cruza(FH[0], FV[0])];
        if (q.some(function (p) { return !p || p[0] < -2 * w || p[0] > 3 * w || p[1] < -2 * h || p[1] > 3 * h; }) || !convexo(q)) continue;
        for (var i1 = 0; i1 < 4; i1++) for (var i2 = 0; i2 < 4; i2++) { if (i1 === i2) continue;
          for (var j1 = 0; j1 < 4; j1++) for (var j2 = j1 + 1; j2 < 4; j2++) {
            var yS = MODELO_H[i1], yI = MODELO_H[i2], xE = MODELO_V[j1], xD = MODELO_V[j2];
            var H = homografia([[xE, yI], [xD, yI], [xD, yS], [xE, yS]], q); if (!H) continue;
            if (!coerente(H)) continue;
            var sc = nota(H); if (sc > (melhor ? melhor.nota : 0)) melhor = { nota: sc, H: H };
          } }
      }
    }
    if (!melhor) return null;
    /* refinamento: ajusta cada canto da quadra de duplas em ±2 px enquanto a nota sobe */
    var cantosM = [[-D, -L], [D, -L], [D, L], [-D, L]], cs = cantosM.map(function (c) { var p = aplicar(melhor.H, c); return [p[0], p[1]]; }), base = melhor.nota;
    for (var it = 0; it < 3; it++) for (var k = 0; k < 4; k++) for (var dx = -2; dx <= 2; dx += 2) for (var dy = -2; dy <= 2; dy += 2) {
      if (!dx && !dy) continue; var t = cs.map(function (c) { return c.slice(); }); t[k][0] += dx; t[k][1] += dy;
      var H2 = homografia(cantosM, t); if (!H2 || !coerente(H2)) continue; var s2 = nota(H2); if (s2 > base) { base = s2; cs = t; melhor.H = H2; }
    }
    /* orientação: o lado "de cá" (y < 0) é o mais perto da câmera (aparece maior) e +x fica à direita de quem olha de cá */
    var area = function (y0, y1) { var c = [[-D, y0], [D, y0], [D, y1], [-D, y1]].map(function (p) { return aplicar(melhor.H, p); }), A = 0; for (var i = 0; i < 4; i++) { var u = c[i], v = c[(i + 1) % 4]; A += u[0] * v[1] - v[0] * u[1]; } return Math.abs(A) / 2; };
    if (area(-L, 0) < area(0, L)) cs = [cs[2], cs[3], cs[0], cs[1]];
    var Ho = homografia(cantosM, cs), o = aplicar(Ho, [0, -L]), ex = aplicar(Ho, [1, -L]), ey = aplicar(Ho, [0, -L + 1]);
    if ((ex[0] - o[0]) * (ey[1] - o[1]) - (ex[1] - o[1]) * (ey[0] - o[0]) > 0) cs = [cs[1], cs[0], cs[3], cs[2]];
    melhor.H = homografia(cantosM, cs);
    var dentro = 0, acerto = 0, confirmadas = 0;
    AMOSTRAS.forEach(function (pp) { var p = aplicar(melhor.H, pp), px = Math.round(p[0]), py = Math.round(p[1]); if (px < 1 || py < 1 || px >= w - 1 || py >= h - 1) return; dentro++; if (dil[py * w + px]) acerto++; });
    /* linhas confirmadas: trechos da quadra (cada lateral em duas metades) com metade ou mais dos pontos sobre linha.
       No vídeo real a outra metade da quadra é fina e o jogador tapa pedaços: a nota geral fica baixa mesmo com o encaixe
       certo; várias linhas inteiras confirmadas é o que separa o encaixe certo de um acaso */
    TRECHOS.forEach(function (tr) {
      var den = 0, ac = 0;
      tr.forEach(function (pp) { var p = aplicar(melhor.H, pp), px = Math.round(p[0]), py = Math.round(p[1]); if (px < 1 || py < 1 || px >= w - 1 || py >= h - 1) return; den++; if (dil[py * w + px]) ac++; });
      if (den >= 6 && ac >= den * 0.5) confirmadas++;
    });
    return { cantos: cs.map(function (c) { return [c[0] / w, c[1] / h]; }), nota: dentro ? acerto / dentro : 0, visiveis: dentro / AMOSTRAS.length, confirmadas: confirmadas, linhas: linhas.length, depura: { linhas: linhas, familias: fam } };
  }
  return { detectar: detectar, mascara: mascara, _hough: hough, _familias: familias };
});
