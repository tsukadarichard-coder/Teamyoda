/* Scout automático a partir do vídeo da partida · Tecnologia QuadraLab. Funções puras (sem DOM), testáveis no Node.
   Entrada por trecho (cada "ponto" achado pelo som das batidas): batidas do áudio + quadros com os jogadores (pés, pose MediaPipe,
   cor da roupa) e candidatos a bola. A quadra é calibrada pelos 4 cantos (homografia imagem → metros).
   Saída: o mesmo formato de ponto do scout do app (fim, nos, saque, bola, golpe, direcao, corrida, rede, dirSaque, sacador, lado,
   placarAntes, jogo, set) + efeito e a lista de batidas, com a confiança de cada campo automático ("alta" | "media" | "baixa").
   O placar é reconstruído pelas regras do tênis (beam search): quem saca e de que lado confirma ou corrige quem ganhou cada ponto.

   Convenções: imagem em coordenadas normalizadas (0..1); quadra em metros, x lateral (+x = direita da imagem, visto da câmera),
   y longitudinal: 0 na rede, negativo do lado da câmera ("perto"), positivo do outro lado ("longe").
   QLVideoScout.{ calibrar, analisarPonto, decodificar, montarScout, Placar, homografia, aplicarH } */
(function (raiz, fab) {
  if (typeof module === "object" && module.exports) module.exports = fab();
  else raiz.QLVideoScout = fab();
})(this, function () {
  var COMP = 23.77, LARG_D = 10.97, LARG_S = 8.23, SERV = 6.40, MEIO_C = COMP / 2, MEIA_S = LARG_S / 2;
  var LM = { nariz: 0, ombroE: 11, ombroD: 12, punhoE: 15, punhoD: 16, quadrilE: 23, quadrilD: 24, tornE: 27, tornD: 28 };

  /* ── homografia (4 pontos, DLT) ── */
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
    for (var i = 0; i < 4; i++) {
      var x = de[i][0], y = de[i][1], u = para[i][0], v = para[i][1];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    var h = resolver(A, b); return h ? [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1] : null;
  }
  function aplicarH(H, p) { var w = H[6] * p[0] + H[7] * p[1] + H[8]; return [(H[0] * p[0] + H[1] * p[1] + H[2]) / w, (H[3] * p[0] + H[4] * p[1] + H[5]) / w]; }
  function cantosQuadra(simples) { var w = (simples ? LARG_S : LARG_D) / 2; return [[-w, -MEIO_C], [w, -MEIO_C], [w, MEIO_C], [-w, MEIO_C]]; }
  /* cantos tocados na imagem (perto-esquerda, perto-direita, longe-direita, longe-esquerda) → contexto da análise */
  function calibrar(cantosImg, o) {
    o = o || {};
    var q = cantosQuadra(o.simples), H = homografia(cantosImg, q), Hi = homografia(q, cantosImg);
    if (!H || !Hi) return null;
    var asp = o.aspecto || 16 / 9;
    /* pixels (normalizados × aspecto) por metro, perto e longe: escala da altura de uma pessoa na imagem */
    function escala(y) { var a = aplicarH(Hi, [-1, y]), b = aplicarH(Hi, [1, y]); return Math.hypot((b[0] - a[0]) * asp, b[1] - a[1]) / 2; }
    return { H: H, Hi: Hi, asp: asp, simples: !!o.simples, escala: escala, cam: camera(Hi, asp), mao: { A: o.maoA || "D", B: o.maoB || "D" }, corA: o.corA || null, corB: o.corB || null, atletaComecaPerto: o.atletaComecaPerto };
  }
  /* ── câmera em 3D a partir da quadra (homografia do chão), supondo pixels quadrados e o centro óptico no meio da imagem:
     dá a altura da bola em cada quadro (o raio da câmera cruzado com a posição da bola sobre a quadra) ── */
  function camera(Hi, asp) {
    var cx = asp / 2, cy = 0.5, M = [Hi[0] * asp, Hi[1] * asp, Hi[2] * asp, Hi[3], Hi[4], Hi[5], Hi[6], Hi[7], Hi[8]];
    var A = [M[0] - cx * M[6], M[1] - cx * M[7], M[2] - cx * M[8], M[3] - cy * M[6], M[4] - cy * M[7], M[5] - cy * M[8], M[6], M[7], M[8]];
    var f2 = -(A[0] * A[1] + A[3] * A[4]) / (A[6] * A[7]), f2b = ((A[0] * A[0] + A[3] * A[3]) - (A[1] * A[1] + A[4] * A[4])) / (A[7] * A[7] - A[6] * A[6]);
    var f2v = [f2, f2b].filter(function (v) { return isFinite(v) && v > 0; });
    if (!f2v.length) return null;
    var f = Math.sqrt(f2v[0]);
    var k1 = [A[0] / f, A[3] / f, A[6]], k2 = [A[1] / f, A[4] / f, A[7]], k3 = [A[2] / f, A[5] / f, A[8]];
    var n1 = Math.hypot(k1[0], k1[1], k1[2]), n2 = Math.hypot(k2[0], k2[1], k2[2]), l = (n1 + n2) / 2;
    var r1 = k1.map(function (v) { return v / n1; }), r2 = k2.map(function (v) { return v / n2; }), d = r1[0] * r2[0] + r1[1] * r2[1] + r1[2] * r2[2];
    r2 = [r2[0] - d * r1[0], r2[1] - d * r1[1], r2[2] - d * r1[2]]; var nn = Math.hypot(r2[0], r2[1], r2[2]); r2 = r2.map(function (v) { return v / nn; });
    var t = k3.map(function (v) { return v / l; });
    if (t[2] < 0) { r1 = r1.map(function (v) { return -v; }); r2 = r2.map(function (v) { return -v; }); t = t.map(function (v) { return -v; }); }
    var r3 = [r1[1] * r2[2] - r1[2] * r2[1], r1[2] * r2[0] - r1[0] * r2[2], r1[0] * r2[1] - r1[1] * r2[0]];
    var C = [0, 1, 2].map(function (i) { return -([r1, r2, r3][i][0] * t[0] + [r1, r2, r3][i][1] * t[1] + [r1, r2, r3][i][2] * t[2]); });
    if (C[2] < 0) { r3 = r3.map(function (v) { return -v; }); C[2] = -C[2]; } // eixo z para cima
    return { f: f, cx: cx, cy: cy, asp: asp, r1: r1, r2: r2, r3: r3, t: t, C: C };
  }
  function projetar3(cam, X, Y, Z) {
    var p = [0, 1, 2].map(function (i) { return cam.r1[i] * X + cam.r2[i] * Y + cam.r3[i] * Z + cam.t[i]; });
    return [(cam.f * p[0] / p[2] + cam.cx) / cam.asp, cam.f * p[1] / p[2] + cam.cy];
  }
  /* altura (m) do ponto da imagem (u,v) se ele estiver na vertical de (X,Y) da quadra */
  function alturaNoRaio(cam, u, v, X, Y) {
    var x = (u * cam.asp - cam.cx) / cam.f, y = (v - cam.cy) / cam.f;
    var m = [0, 1, 2].map(function (i) { return cam.r1[i] * X + cam.r2[i] * Y + cam.t[i]; }), d = cam.r3;
    var a = [m[0] - x * m[2], m[1] - y * m[2]], b = [d[0] - x * d[2], d[1] - y * d[2]];
    return -(a[0] * b[0] + a[1] * b[1]) / (b[0] * b[0] + b[1] * b[1]);
  }
  /* voo da bola da batida ao quique, em 3D: a posição sobre a quadra anda em linha reta de quem bateu até o quique; a altura vem
     de cada quadro. z(τ) = z0 + vz·τ − a·τ²/2: a velocidade sai da distância e do tempo; a aceleração vertical efetiva separa o
     efeito (top spin cai mais rápido que a gravidade, o slice "flutua") */
  var G = 9.81;
  function voo3D(cam, t0, Ph, q, trilha, saque) {
    if (!cam || !Ph || !q || !trilha) return null;
    var tb = q.t, T = tb - t0; if (T < 0.25 || T > 2.5) return null;
    var pts = [];
    trilha.forEach(function (p) {
      if (p.t <= t0 + 0.04 || p.t >= tb - 0.02) return;
      var s = (p.t - t0) / T, X = Ph[0] + s * (q.P[0] - Ph[0]), Y = Ph[1] + s * (q.P[1] - Ph[1]);
      var Z = alturaNoRaio(cam, p.x, p.y, X, Y); if (isFinite(Z) && Z > -0.5 && Z < 9) pts.push([p.t - t0, Z, 1]);
    });
    if (pts.length < 5) return null;
    pts.push([T, 0, 6]); // o quique está no chão
    pts.push([0, saque ? 2.6 : 1.0, saque ? 3 : 0.5]); // altura típica do contato
    /* mínimos quadrados ponderados em (z0, vz, a) */
    var S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], r = [0, 0, 0];
    pts.forEach(function (p) { var f = [1, p[0], -p[0] * p[0] / 2], w = p[2]; for (var i = 0; i < 3; i++) { r[i] += w * f[i] * p[1]; for (var j = 0; j < 3; j++) S[i][j] += w * f[i] * f[j]; } });
    var c = resolver(S, r); if (!c) return null;
    var res = 0, n = 0; pts.forEach(function (p) { if (p[2] === 1) { res += Math.pow(c[0] + c[1] * p[0] - c[2] * p[0] * p[0] / 2 - p[1], 2); n++; } });
    var rms = Math.sqrt(res / n), dist = Math.hypot(q.P[0] - Ph[0], q.P[1] - Ph[1]), vh = dist / T, v0 = Math.hypot(vh, c[1]);
    var redeS = (0 - Ph[1]) / (q.P[1] - Ph[1]), alturaRede = redeS > 0 && redeS < 1 ? c[0] + c[1] * redeS * T - c[2] * Math.pow(redeS * T, 2) / 2 : null;
    return { vel: Math.round(v0 * 3.6), velMedia: Math.round(Math.hypot(dist, 0) / T * 3.6), acel: Math.round(c[2] * 10) / 10, z0: Math.round(c[0] * 100) / 100,
      alturaRede: alturaRede == null ? null : Math.round(alturaRede * 100) / 100, rms: Math.round(rms * 100) / 100, n: n,
      efeito: saque ? null : c[2] > G + 2.2 ? "top" : c[2] < G - 2 ? "slice" : "flat", conf: n >= 8 && rms < 0.35 ? "media" : "baixa" };
  }
  /* depois de um quique de verdade a bola sobe: reconstrói a altura nos quadros seguintes (seguindo na mesma direção, um pouco
     mais devagar) e devolve a velocidade vertical média (m/s); num "quique" falso no meio do voo ela continua caindo */
  function subidaDepois(cam, t0, Ph, q, trilha) {
    if (!cam || !Ph || !q || !trilha) return null;
    var T = q.t - t0, dx = q.P[0] - Ph[0], dy = q.P[1] - Ph[1], dist = Math.hypot(dx, dy); if (T <= 0 || !dist) return null;
    var vh = dist / T * 0.75, ux = dx / dist, uy = dy / dist, pts = [];
    trilha.forEach(function (p) {
      var u = p.t - q.t; if (u <= 0.02 || u > 0.4) return;
      var Z = alturaNoRaio(cam, p.x, p.y, q.P[0] + ux * vh * u, q.P[1] + uy * vh * u); if (isFinite(Z)) pts.push([u, Z]);
    });
    if (pts.length < 3) return null;
    var mt = pts.reduce(function (s, p) { return s + p[0]; }, 0) / pts.length, mz = pts.reduce(function (s, p) { return s + p[1]; }, 0) / pts.length, num = 0, den = 0;
    pts.forEach(function (p) { num += (p[0] - mt) * (p[1] - mz); den += (p[0] - mt) * (p[0] - mt); });
    return den ? num / den : null;
  }
  function linhasQuadra() { /* segmentos das linhas (em metros) para desenhar a sobreposição da calibração */
    var w = LARG_D / 2, s = MEIA_S, L = MEIO_C;
    return [[[-w, -L], [w, -L]], [[-w, L], [w, L]], [[-w, -L], [-w, L]], [[w, -L], [w, L]], [[-s, -L], [-s, L]], [[s, -L], [s, L]],
      [[-s, -SERV], [s, -SERV]], [[-s, SERV], [s, SERV]], [[0, -SERV], [0, SERV]], [[-w - 0.9, 0], [w + 0.9, 0]]];
  }

  /* ── placar (mesmas regras do scout do app: aplicaPonto, quemSaca, ladoDoSaque) ── */
  var PT = ["0", "15", "30", "40"];
  var TB_UNICO = { tb7: 7, tb10: 10 }; // partida inteira num tie-break só (7) ou num match tie-break (10)
  var Placar = {
    inicial: function (cfg, saca) { return { formato: cfg.formato || "3sets", p: [0, 0], g: [0, 0], sets: [], saque: saca || "nos", tiebreak: !!TB_UNICO[cfg.formato], fim: false, vencedor: null, semVantagem: !!cfg.semVantagem, superTiebreakDecisivo: !!cfg.superTiebreakDecisivo }; },
    aplicar: function (e0, nos) {
      var e = { formato: e0.formato, p: e0.p.slice(), g: e0.g.slice(), sets: e0.sets.slice(), saque: e0.saque, tiebreak: e0.tiebreak, fim: e0.fim, vencedor: e0.vencedor, semVantagem: e0.semVantagem, superTiebreakDecisivo: e0.superTiebreakDecisivo };
      if (e.fim) return e;
      var i = nos ? 0 : 1, j = 1 - i, alvoG = e.formato === "4games" ? 4 : 6;
      e.p[i]++;
      var unico = TB_UNICO[e.formato] || 0, stb = !!unico || (e.formato === "3sets" && e.superTiebreakDecisivo && e.sets.length === 2); if (stb) e.tiebreak = true;
      var alvoTB = unico || (stb ? 10 : 7);
      function fechaSet(q, ptsTB) {
        e.sets.push(stb ? ptsTB : [e.g[0], e.g[1]]); e.g = [0, 0]; e.tiebreak = false;
        var m = e.sets.filter(function (s) { return s[0] > s[1]; }).length, d = e.sets.filter(function (s) { return s[1] > s[0]; }).length, prec = e.formato === "3sets" ? 2 : 1;
        if (m >= prec || d >= prec) { e.fim = true; e.vencedor = m > d ? "nos" : "ele"; }
      }
      if (e.tiebreak) {
        if (e.p[i] >= alvoTB && e.p[i] - e.p[j] >= 2) { var f = [e.p[0], e.p[1]]; e.saque = e.saque === "nos" ? "ele" : "nos"; e.g[i]++; e.p = [0, 0]; fechaSet(i, f); }
      } else if (e.semVantagem ? (e.p[i] >= 4 && e.p[i] > e.p[j]) : (e.p[i] >= 4 && e.p[i] - e.p[j] >= 2)) {
        e.g[i]++; e.p = [0, 0]; e.saque = e.saque === "nos" ? "ele" : "nos";
        if (e.g[i] >= alvoG && e.g[i] - e.g[j] >= 2) fechaSet(i); else if (e.g[0] === alvoG && e.g[1] === alvoG) e.tiebreak = true;
      }
      return e;
    },
    quemSaca: function (e) { if (!e.tiebreak && !TB_UNICO[e.formato] && !(e.formato === "3sets" && e.superTiebreakDecisivo && e.sets.length === 2)) return e.saque; var n = e.p[0] + e.p[1]; return Math.floor((n + 1) / 2) % 2 === 0 ? e.saque : (e.saque === "nos" ? "ele" : "nos"); },
    lado: function (e) { return (e.p[0] + e.p[1]) % 2 === 0 ? "D" : "E"; },
    rotulo: function (e) { if (e.tiebreak) return e.p[0] + "-" + e.p[1]; var a = e.p[0], b = e.p[1]; if (a >= 3 && b >= 3) return a === b || e.semVantagem ? "40-40" : (a > b ? "AD-40" : "40-AD"); return PT[a] + "-" + PT[b]; },
    jogo: function (e) { return e.sets.reduce(function (t, x) { return t + x[0] + x[1]; }, 0) + e.g[0] + e.g[1] + 1; },
    set: function (e) { return e.sets.length + 1; },
    adverso: function (e) { return e.p[1] > e.p[0] || e.g[1] > e.g[0]; },
    /* troca de lado: depois de game ímpar no set, a cada 6 pontos do tie-break e no fim do set com total ímpar de games */
    trocaLado: function (e0, e1) {
      if (e1.sets.length > e0.sets.length) { var s = e1.sets[e1.sets.length - 1]; return e0.tiebreak && (TB_UNICO[e0.formato] || (e0.formato === "3sets" && e0.superTiebreakDecisivo && e0.sets.length === 2)) ? false : (s[0] + s[1]) % 2 === 1; }
      if (e1.g[0] + e1.g[1] > e0.g[0] + e0.g[1]) return (e1.g[0] + e1.g[1]) % 2 === 1;
      if (e1.tiebreak || (e0.tiebreak && e1.p[0] + e1.p[1] > 0)) return (e1.p[0] + e1.p[1]) % 6 === 0;
      return false;
    },
    chave: function (e) { return e.p.join(",") + "|" + e.g.join(",") + "|" + e.sets.map(function (s) { return s.join("-"); }).join(" ") + "|" + e.saque + (e.tiebreak ? "|tb" : "") + (e.fim ? "|fim" : ""); },
    texto: function (e) { return e.sets.map(function (s) { return s[0] + "-" + s[1]; }).concat(e.fim || e.g[0] + e.g[1] === 0 ? [] : [e.g[0] + "-" + e.g[1]]).join(" "); },
  };

  /* ── jogadores: trilhas perto/longe com posição em metros, pose e cor ── */
  function media(l) { return l.length ? l.reduce(function (s, v) { return s + v; }, 0) / l.length : NaN; }
  function trilhas(quadros, ctx) {
    var perto = [], longe = [], ult = { perto: null, longe: null };
    quadros.forEach(function (q) {
      var cand = { perto: [], longe: [] };
      (q.jog || []).forEach(function (j) {
        if (!j.pe) return;
        var P = aplicarH(ctx.H, j.pe);
        if (Math.abs(P[0]) > 9 || Math.abs(P[1]) > MEIO_C + 8) return; // fora da área de jogo (outra quadra, público)
        cand[P[1] < 0 ? "perto" : "longe"].push({ t: q.t, P: P, pe: j.pe, lm: j.lm || null, cor: j.cor || null });
      });
      ["perto", "longe"].forEach(function (k) {
        var l = cand[k]; if (!l.length) return;
        var u = ult[k], m = l.slice().sort(function (a, b) { return (u ? Math.hypot(a.P[0] - u.P[0], a.P[1] - u.P[1]) : Math.abs(a.P[0])) - (u ? Math.hypot(b.P[0] - u.P[0], b.P[1] - u.P[1]) : Math.abs(b.P[0])); })[0];
        (k === "perto" ? perto : longe).push(m); ult[k] = m;
      });
    });
    return { perto: perto, longe: longe };
  }
  function noTempo(tr, t, tol) {
    var m = null, d = tol == null ? 0.2 : tol;
    for (var i = 0; i < tr.length; i++) { var x = Math.abs(tr[i].t - t); if (x <= d) { d = x; m = tr[i]; } }
    return m;
  }
  function comPose(tr, t, tol) { return noTempo(tr.filter(function (f) { return f.lm; }), t, tol == null ? 0.12 : tol); }

  /* ── geometria da pose (coordenadas da imagem, x corrigido pelo aspecto) ── */
  function pt(lm, i, asp) { var p = lm[i]; return p ? [p.x * asp, p.y, p.v == null ? 1 : p.v] : null; }
  function corpo(lm, asp) {
    var oE = pt(lm, LM.ombroE, asp), oD = pt(lm, LM.ombroD, asp), qE = pt(lm, LM.quadrilE, asp), qD = pt(lm, LM.quadrilD, asp);
    if (!oE || !oD || !qE || !qD) return null;
    var cO = [(oE[0] + oD[0]) / 2, (oE[1] + oD[1]) / 2], cQ = [(qE[0] + qD[0]) / 2, (qE[1] + qD[1]) / 2], tronco = Math.hypot(cO[0] - cQ[0], cO[1] - cQ[1]) || 1e-3;
    var ax = [oD[0] - oE[0], oD[1] - oE[1]], na = Math.hypot(ax[0], ax[1]);
    var axQ = [qD[0] - qE[0], qD[1] - qE[1]], nq = Math.hypot(axQ[0], axQ[1]);
    var eixo = na > 0.35 * tronco ? [ax[0] / na, ax[1] / na] : nq > 0.25 * tronco ? [axQ[0] / nq, axQ[1] / nq] : null; // de lado para a câmera, o eixo some
    return { cO: cO, cQ: cQ, tronco: tronco, eixo: eixo };
  }
  function punho(lm, mao, asp) { return pt(lm, mao === "E" ? LM.punhoE : LM.punhoD, asp); }

  /* ── bola: trajetória entre duas batidas e o quique (ajuste em dois arcos, robusto a detecções falsas) ── */
  function ajustaQuad(pts, eixo) { // mínimos quadrados v(t) = a + b t + c t²
    var n = pts.length, S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], r = [0, 0, 0];
    pts.forEach(function (p) { var t = p.t, f = [1, t, t * t], v = p[eixo]; for (var i = 0; i < 3; i++) { r[i] += f[i] * v; for (var j = 0; j < 3; j++) S[i][j] += f[i] * f[j]; } });
    if (n < 3) return null;
    return resolver(S, r);
  }
  function aval(c, t) { return c[0] + c[1] * t + c[2] * t * t; }
  function deriv(c, t) { return c[1] + 2 * c[2] * t; }
  /* trilha da bola: liga os candidatos quadro a quadro pela posição prevista (posição + velocidade); fica a trilha mais longa */
  function trilhaBola(pts, asp, dica) {
    var porT = {}, ts = [];
    pts.forEach(function (p) { if (!porT[p.t]) { porT[p.t] = []; ts.push(p.t); } porT[p.t].push(p); });
    ts.sort(function (a, b) { return a - b; });
    var abertas = [], todas = [];
    ts.forEach(function (t) {
      var livres = porT[t].slice(), usadas = [];
      abertas = abertas.filter(function (tl) { return t - tl.u.t <= 0.22; });
      var pares = [];
      abertas.forEach(function (tl, i) {
        var dt = t - tl.u.t, px = tl.u.x + tl.v[0] * dt, py = tl.u.y + tl.v[1] * dt, gate = tl.pts.length < 2 ? 0.1 : 0.035 + 0.6 * Math.hypot(tl.v[0] * asp, tl.v[1]) * dt;
        livres.forEach(function (c, j) { var d = Math.hypot((c.x - px) * asp, c.y - py); if (d < gate) pares.push([d, i, j]); });
      });
      pares.sort(function (a, b) { return a[0] - b[0]; });
      var tlUsada = {}, cUsado = {};
      pares.forEach(function (pr) {
        if (tlUsada[pr[1]] || cUsado[pr[2]]) return; tlUsada[pr[1]] = cUsado[pr[2]] = 1;
        var tl = abertas[pr[1]], c = livres[pr[2]], dt = t - tl.u.t;
        var nv = [(c.x - tl.u.x) / dt, (c.y - tl.u.y) / dt]; tl.v = tl.pts.length > 1 ? [0.5 * nv[0] + 0.5 * tl.v[0], 0.5 * nv[1] + 0.5 * tl.v[1]] : nv;
        tl.pts.push(c); tl.u = c; usadas.push(tl);
      });
      livres.forEach(function (c, j) { if (!cUsado[j]) { var tl = { pts: [c], u: c, v: [0, 0] }; abertas.push(tl); todas.push(tl); } });
    });
    /* no vídeo real a bola some um ou dois quadros perto do quique (linha, sombra) e a trilha se parte em duas: liga pedaços
       em sequência (o seguinte começa até 0,25 s depois, perto de onde o anterior ia). Pedaço quase parado é ruído (corpo do
       jogador, gente atrás do alambrado) e vale pouco */
    var peca = todas.filter(function (tl) { return tl.pts.length >= 3; }).sort(function (a, b) { return a.pts[0].t - b.pts[0].t; });
    function rapidez(tl) { var a = tl.pts[0], z = tl.pts[tl.pts.length - 1], dt = z.t - a.t; return dt > 0 ? Math.hypot((z.x - a.x) * asp, z.y - a.y) / dt : 0; }
    function peso(tl) { return tl.pts.length * (rapidez(tl) < 0.12 ? 0.3 : 1); }
    var best = peca.map(function (tl) { return { v: peso(tl), ant: -1 }; });
    for (var i = 0; i < peca.length; i++) for (var j = 0; j < i; j++) {
      var A = peca[j], B = peca[i], fa = A.pts[A.pts.length - 1], ib = B.pts[0], gap = ib.t - fa.t;
      if (gap <= 0 || gap > 0.25) continue;
      var vel = Math.max(rapidez(A), rapidez(B)), d = Math.hypot((ib.x - fa.x) * asp, ib.y - fa.y);
      if (d > 0.03 + 1.3 * vel * gap) continue;
      if (best[j].v + peso(B) > best[i].v) best[i] = { v: best[j].v + peso(B), ant: j };
    }
    /* dica de quem bateu: a bola sai de perto dele (origem) e vai para o outro lado (sentido na imagem: -1 sobe, +1 desce).
       Corrente ao contrário ou começando longe de quem bateu é quase sempre ruído (alambrado, corpo, outra quadra) */
    function cadeiaDe(i) { var c = []; for (var k = i; k >= 0; k = best[k].ant) c.unshift(peca[k]); return c; }
    var fim = -1, notaFim = 0;
    best.forEach(function (b, i) {
      var nota = b.v;
      if (dica) {
        var c = cadeiaDe(i), a = c[0].pts[0], zl = c[c.length - 1].pts, z = zl[zl.length - 1], dy = z.y - a.y;
        if (dica.sentido && dy * dica.sentido < -0.03) nota *= 0.4;
        if (dica.origem && a.t - dica.t0 < 0.35 && Math.hypot((a.x - dica.origem[0]) * asp, a.y - dica.origem[1]) > 0.3) nota *= 0.6;
      }
      if (fim < 0 || nota > notaFim) { fim = i; notaFim = nota; }
    });
    if (fim < 0) return null;
    var cadeia = cadeiaDe(fim);
    var pts2 = [].concat.apply([], cadeia.map(function (tl) { return tl.pts; }));
    return pts2.length >= 5 ? pts2 : null;
  }
  function residuo(P, eixoX, eixoY, asp) {
    var cx = ajustaQuad(P, "x"), cy = ajustaQuad(P, "y"); if (!cx || !cy) return null;
    var r = 0; P.forEach(function (p) { r += Math.pow((aval(cx, p.t) - p.x) * asp, 2) + Math.pow(aval(cy, p.t) - p.y, 2); });
    return { r: r, cx: cx, cy: cy };
  }
  /* quique: a trilha é explicada por dois arcos que se encontram num ponto, com a bola passando a subir na imagem */
  function quique(bolas, t0, t1, ctx, excluir, ladoAlvo, final, valida, dica) {
    var pts = [];
    bolas.forEach(function (q) { if (q.t < t0 || q.t > t1) return; q.b.forEach(function (b) { if (!excluir || !excluir(q.t, b)) pts.push({ t: q.t, x: b[0], y: b[1] }); }); });
    if (pts.length < 8) return null;
    var tr = trilhaBola(pts, ctx.asp, dica ? Object.assign({ t0: t0 }, dica) : null); if (!tr || tr.length < 8) return null;
    var base = tr[0].t, P = tr.map(function (p) { return { t: p.t - base, x: p.x, y: p.y }; });
    /* ajuste local (±0,32 s em volta da quebra): a perspectiva deixa a trajetória longa longe de uma parábola na imagem */
    function melhorQuebra(P) {
      var n = P.length, m = null, todos = [];
      for (var j = 3; j <= n - 4; j++) {
        var tb = P[j].t, L = P.filter(function (p) { return p.t >= tb - 0.32 && p.t <= tb; }), R = P.filter(function (p) { return p.t >= tb && p.t <= tb + 0.32; });
        if (L.length < 4 || R.length < 4 || tb - L[0].t < 0.12 || R[R.length - 1].t - tb < 0.12) continue;
        var A = residuo(L, "x", "y", ctx.asp), B = residuo(R, "x", "y", ctx.asp), U = residuo(L.concat(R.slice(1)), "x", "y", ctx.asp); if (!A || !B || !U) continue;
        var pa = [aval(A.cx, tb), aval(A.cy, tb)], pb = [aval(B.cx, tb), aval(B.cy, tb)];
        var salto = Math.hypot((pa[0] - pb[0]) * ctx.asp, pa[1] - pb[1]), kink = deriv(B.cy, tb) - deriv(A.cy, tb);
        if (salto > 0.03 || kink > -Math.max(0.08, 0.35 * Math.abs(deriv(A.cy, tb)))) continue; // o quique inverte a velocidade vertical (passa a subir na imagem)
        var img = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2], Pq = aplicarH(ctx.H, img);
        if (Math.abs(Pq[0]) > 8 || Math.abs(Pq[1]) > MEIO_C + 4 || tb + base - t0 < 0.14) continue; // fora do plausível
        if (ladoAlvo && Pq[1] * ladoAlvo < 0 && !(final && Math.abs(Pq[1]) < 3.5)) continue; // a bola quica do lado de lá (ou na rede, se foi a última)
        if (valida && !valida({ t: tb + base, P: Pq }, tr)) continue; // a trajetória até esse quique tem de fazer sentido em 3D
        var r = A.r + B.r, ganho = U.r / Math.max(r, 1e-7);
        if (ganho < 3) continue; // dois arcos têm de explicar bem melhor que um
        var c = { r: r, ganho: ganho, j: j, img: img, P: Pq, A: A, B: B, L: L, R: R }; todos.push(c);
        if (!m || ganho > m.ganho) m = c;
      }
      /* a bola pode quicar duas vezes na janela (depois de um winner ou ace): vale o primeiro quique nítido */
      if (m) m = todos.filter(function (c) { return c.ganho >= Math.max(3, 0.4 * m.ganho) && P[c.j].t < P[m.j].t - 0.2; })[0] || m;
      return m;
    }
    var m = melhorQuebra(P);
    if (m) { /* descarta os pontos que fogem dos dois arcos (detecções falsas que entraram na trilha) e ajusta de novo */
      var viz = P.filter(function (p) { return Math.abs(p.t - P[m.j].t) <= 0.32; });
      var res = viz.map(function (p) { var c = p.t <= P[m.j].t ? m.A : m.B; return Math.hypot((aval(c.cx, p.t) - p.x) * ctx.asp, aval(c.cy, p.t) - p.y); });
      var med = res.slice().sort(function (a, b) { return a - b; })[Math.floor(res.length / 2)], lim = Math.max(0.006, med * 3);
      var fora = viz.filter(function (p, i) { return res[i] > lim; });
      var P2 = P.filter(function (p) { return fora.indexOf(p) < 0; });
      if (P2.length < P.length && P2.length >= 8) { var m2 = melhorQuebra(P2); if (m2) { m = m2; P = P2; } }
    }
    if (!m) return { semQuique: true, trilha: tr };
    var rms = Math.sqrt(m.r / (m.L.length + m.R.length));
    return { t: P[m.j].t + base, img: m.img, P: m.P, conf: Math.max(0, Math.min(1, ((m.L.length + m.R.length) / 14) * (1 - rms / 0.015) * Math.min(1, m.ganho / 6))), trilha: tr };
  }

  /* ── análise de um trecho (ponto) ── */
  function analisarPonto(d, ctx, opc) {
    opc = opc || {};
    var asp = ctx.asp, tr = trilhas(d.quadros || [], ctx), bolas = (d.quadros || []).filter(function (q) { return q.bolas && q.bolas.length; }).map(function (q) { return { t: q.t, b: q.bolas }; });
    var hits = d.hits.slice(), nH = hits.length;
    /* quem é quem: cor da roupa (tocada na calibração) */
    var pAP = 0.5;
    if (ctx.corA && ctx.corB) {
      var dc = function (a, b) { return a && b ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) : NaN; };
      var s1 = [], s2 = [];
      tr.perto.forEach(function (f) { if (f.cor) { s1.push(dc(f.cor, ctx.corA) - dc(f.cor, ctx.corB)); } });
      tr.longe.forEach(function (f) { if (f.cor) { s2.push(dc(f.cor, ctx.corB) - dc(f.cor, ctx.corA)); } });
      var m = media(s1.concat(s2).filter(isFinite));
      if (isFinite(m)) pAP = 1 / (1 + Math.exp(m / 18)); // diferença de cor (0–255) → probabilidade
    }
    /* evidência de quem bateu cada bola: punho rápido na hora da batida, bola perto do corpo, braço acima da cabeça no saque */
    function evid(t, k) {
      var trk = tr[k], f = comPose(trk, t), sc = 0, w = 0;
      if (f) {
        var c = corpo(f.lm, asp), a = comPose(trk, t - 0.12), b = comPose(trk, t + 0.12);
        if (c && a && b && a !== b) {
          var vel = Math.max(veloPunho(a.lm, b.lm, "D", asp), veloPunho(a.lm, b.lm, "E", asp)) / c.tronco;
          sc += Math.min(1, vel / 1.6); w += 1;
        }
      }
      var q = noTempo(bolas, t, 0.07), base = noTempo(trk, t, 0.25);
      if (q && base) {
        var esc = ctx.escala(base.P[1]), centro = [base.pe[0] * asp, base.pe[1] - esc * 1.1];
        var dmin = Math.min.apply(null, q.b.map(function (bb) { return Math.hypot(bb[0] * asp - centro[0], bb[1] - centro[1]); }));
        sc += Math.exp(-dmin / (esc * 1.5)); w += 1;
      }
      return w ? sc / w : 0.5;
    }
    function veloPunho(a, b, mao, asp) { var p = punho(a, mao, asp), q = punho(b, mao, asp); return p && q ? Math.hypot(q[0] - p[0], q[1] - p[1]) : 0; }
    function bracoAcima(k, t) { var f = comPose(tr[k], t, 0.1); if (!f) return 0.5; var n = pt(f.lm, LM.nariz, asp), pD = pt(f.lm, LM.punhoD, asp), pE = pt(f.lm, LM.punhoE, asp); if (!n) return 0.5; var top = Math.min(pD ? pD[1] : 9, pE ? pE[1] : 9); return top < n[1] ? 0.85 : 0.25; }
    var ev = hits.map(function (t) { var a = evid(t, "perto"), b = evid(t, "longe"); return (a + 0.05) / (a + b + 0.1); }); // P(perto bateu)
    /* saque: quem está atrás da linha de base, com o braço acima da cabeça */
    var sp = 0.5;
    if (nH) {
      var fp = noTempo(tr.perto, hits[0], 0.3), fl = noTempo(tr.longe, hits[0], 0.3), e0 = ev[0];
      var atrasP = fp ? (fp.P[1] < -MEIO_C + 0.6 ? 0.75 : 0.35) : 0.5, atrasL = fl ? (fl.P[1] > MEIO_C - 0.6 ? 0.75 : 0.35) : 0.5;
      var cimaP = bracoAcima("perto", hits[0]), cimaL = bracoAcima("longe", hits[0]);
      var lP = Math.log(e0) + Math.log(atrasP) + Math.log(cimaP) + Math.log(1 - cimaL), lL = Math.log(1 - e0) + Math.log(atrasL) + Math.log(cimaL) + Math.log(1 - cimaP);
      sp = 1 / (1 + Math.exp(lL - lP));
    }
    var servPerto = opc.servidorPerto != null ? opc.servidorPerto : sp >= 0.5;
    var atletaPerto = opc.atletaPerto != null ? opc.atletaPerto : pAP >= 0.5;
    var maoDe = function (k) { return (k === "perto") === atletaPerto ? ctx.mao.A : ctx.mao.B; };
    /* sequência de quem bateu (Viterbi): em simples as batidas se alternam; um som que não foi batida (quique, grito, outra quadra)
       vira "nada" quando nenhum dos dois jogadores mostra golpe naquela hora, e sai da lista */
    var quem = [], falsas = [];
    if (nH) {
      var forca = hits.map(function (t) { return [evid(t, "perto"), evid(t, "longe")]; });
      // estados: 0 = perto bateu, 1 = longe bateu, 2 = não foi batida (o último a bater continua sendo quem era: guardamos no rastro)
      var V2 = [{ 0: Math.log(servPerto ? 0.97 : 0.03), 1: Math.log(servPerto ? 0.03 : 0.97) }], R2 = [{}];
      for (var i = 1; i < nH; i++) {
        var f2 = forca[i], v2 = {}, r2 = {};
        var emiss = { 0: Math.log(0.1 + 0.9 * f2[0]), 1: Math.log(0.1 + 0.9 * f2[1]), 2: Math.log(0.05 + 0.9 * (1 - f2[0]) * (1 - f2[1])) };
        Object.keys(V2[i - 1]).forEach(function (ch) {
          var ultimo = +ch.split(":")[0], lp = V2[i - 1][ch];
          [[1 - ultimo, 0.9], [ultimo, 0.03], [2, 0.07]].forEach(function (o) {
            var novoUlt = o[0] === 2 ? ultimo : o[0], chave = novoUlt + ":" + o[0], val = lp + Math.log(o[1]) + emiss[o[0]];
            if (v2[chave] == null || val > v2[chave]) { v2[chave] = val; r2[chave] = ch; }
          });
        });
        V2.push(v2); R2.push(r2);
      }
      var fim2 = Object.keys(V2[nH - 1]).sort(function (x, y) { return V2[nH - 1][y] - V2[nH - 1][x]; })[0], estados = [];
      for (i = nH - 1; i >= 0; i--) { estados[i] = i === 0 ? +fim2 : +fim2.split(":")[1]; fim2 = R2[i][fim2]; }
      var hits2 = [];
      estados.forEach(function (e, i) { if (e === 2) falsas.push(hits[i]); else { hits2.push(hits[i]); quem.push(e === 0 ? "perto" : "longe"); } });
      hits = hits2; nH = hits.length;
    }
    /* batidas: posição, tipo de golpe, efeito, corrida, destino */
    var batidas = hits.map(function (t, i) {
      var k = quem[i], f = noTempo(tr[k], t, 0.25), b = { t: t, quem: k, P: f ? f.P : null };
      var Pb = noTempo(tr[k], t, 0.25);
      /* quique só vale se a bola, saindo de quem bateu, chega nele com altura de contato, gravidade e altura plausíveis */
      var valida = ctx.cam && Pb ? function (q, trilha) {
        var sobe = subidaDepois(ctx.cam, t, Pb.P, q, trilha); if (sobe != null && sobe < -1) return false;
        var v = voo3D(ctx.cam, t, Pb.P, q, trilha, i === 0); if (!v) return true;
        return v.acel > 2 && v.acel < 32 && v.z0 > -0.4 && v.z0 < (i === 0 ? 3.8 : 3.2) && v.rms < 0.8 && v.vel < 260;
      } : null;
      /* onde estava quem bateu, na imagem (tronco, ~1 m acima dos pés) */
      var origem = Pb && Pb.pe ? [Pb.pe[0], Pb.pe[1] - (ctx.escala ? ctx.escala(Pb.P[1]) : 0.05)] : null;
      /* janela desde logo depois da batida (o corpo de quem bateu já é excluído): no vídeo real a batida pelo som pode vir
         atrasada e cortar a descida antes do quique */
      var qq = quique(bolas, t + 0.05, (i + 1 < nH ? hits[i + 1] - 0.03 : t + 2.2), ctx, function (tq, bb) { return dentroDeJogador(tr, tq, bb, ctx, hits, quem); }, k === "perto" ? 1 : -1, i === nH - 1, valida, { sentido: k === "perto" ? -1 : 1, origem: origem });
      b.quique = qq && !qq.semQuique ? qq : null; b.trilha = qq ? qq.trilha : null;
      return b;
    });
    var ladoObs = null, servico = null;
    batidas.forEach(function (b, i) {
      var k = b.quem, maoQuem = maoDe(k);
      if (i === 0) {
        b.golpe = "saque"; b.gConf = "alta";
        if (b.P) {
          var dir = k === "perto" ? b.P[0] : -b.P[0]; // direita de quem saca
          ladoObs = { v: dir > 0 ? "D" : "E", c: Math.min(1, Math.abs(b.P[0]) / 1.2) * (Math.abs(b.P[1]) > MEIO_C - 1.5 ? 1 : 0.5) };
        }
        servico = analisaSaque(b, batidas[1], k, tr);
        return;
      }
      var g = golpe(tr[k], b.t, maoQuem, asp, bolas);
      b.golpe = g.v; b.gConf = g.c; b.efeito = g.efeito; b.efeitoPunho = g.efeito; b.eConf = g.eConf;
      if (b.P && Math.abs(b.P[1]) < 5.2 && b.golpe !== "smash") { b.golpe = "voleio"; b.gConf = g.c === "baixa" ? "baixa" : "media"; b.efeito = null; }
      if (i === 1) b.devolucao = true;
      var a = noTempo(tr[k], b.t - 0.55, 0.2), z = noTempo(tr[k], b.t - 0.05, 0.15);
      if (a && z && z.t > a.t) { var vel = Math.hypot(z.P[0] - a.P[0], z.P[1] - a.P[1]) / (z.t - a.t); b.corrida = vel > 2.3; b.velocidade = Math.round(vel * 10) / 10; }
      b.rede = !!(b.P && Math.abs(b.P[1]) < SERV + 0.5);
    });
    /* voo em 3D (velocidade, altura na rede, efeito pela trajetória) de cada batida que tem quique do lado de lá */
    batidas.forEach(function (b, i) {
      var lado = b.quem === "perto" ? 1 : -1;
      if (!b.quique || !b.P || b.quique.P[1] * lado <= 0) return;
      var v = voo3D(ctx.cam, b.t, b.P, b.quique, b.trilha, i === 0);
      if (!v) return;
      b.voo = v; b.vel = v.vel;
      if (i > 0 && v.efeito && v.conf === "media" && b.golpe !== "voleio") { // a física da bola vale mais que o punho quando o voo é bem visto
        if (!b.efeito || b.eConf !== "media" || b.efeito === v.efeito) { b.efeito = v.efeito; b.eConf = b.efeito === (b.efeitoPunho || v.efeito) ? "alta" : "media"; }
      }
    });
    /* direção de cada batida: pelo quique do lado de lá ou pela posição de quem rebateu */
    batidas.forEach(function (b, i) {
      if (i === 0 || !b.P) return;
      var dest = null, c = "media", lado = b.quem === "perto" ? 1 : -1;
      if (b.quique && b.quique.P[1] * lado > 0) {
        dest = b.quique.P[0]; c = "alta";
        b.distFundo = Math.round((MEIO_C - Math.abs(b.quique.P[1])) * 10) / 10; // metros antes da linha de base (negativo = fora)
        b.profundidade = b.distFundo < 3 ? "funda" : Math.abs(b.quique.P[1]) < SERV ? "curta" : "media";
      }
      else if (batidas[i + 1] && batidas[i + 1].P) dest = batidas[i + 1].P[0];
      if (dest == null) return;
      var xh = b.P[0];
      if (Math.abs(dest) < 1.1) { b.direcao = "centro"; b.dConf = c; }
      else if (Math.abs(xh) < 0.8) { b.direcao = null; }
      else { b.direcao = xh * dest < 0 ? "cruzado" : "paralelo"; b.dConf = Math.abs(dest - xh) > 1.5 || xh * dest > 0 ? c : "baixa"; }
    });
    /* como terminou: o último a bater ganhou se a bola dele caiu dentro */
    var ult = batidas[nH - 1], pUlt = 0.38, fimConf = "baixa", saida = null;
    /* bola de quem está longe que passa da linha de base de cá ainda no ar: a projeção no chão de uma bola no ar fica mais longe
       da câmera do que a bola de verdade, então se a projeção já passou da linha, a bola cai fora (longa) */
    var passouFundo = function (b) {
      if (!b || b.quem !== "longe" || !b.trilha) return false;
      var lim = b.quique ? b.quique.t : Infinity;
      return b.trilha.some(function (p) { return p.t < lim && aplicarH(ctx.H, [p.x, p.y])[1] < -MEIO_C - 0.4; });
    };
    if (ult && passouFundo(ult)) { pUlt = 0.1; saida = "fora"; fimConf = "media"; }
    else if (ult && ult.quique) {
      var Q = ult.quique.P, lado2 = ult.quem === "perto" ? 1 : -1; // jogo de simples: vale a linha lateral de simples
      if (nH === 1) { /* só o saque: dentro da área de saque? */
        var dentroS = Q[1] * lado2 > 0 && Math.abs(Q[1]) <= SERV + 0.25 && Math.abs(Q[0]) <= MEIA_S + 0.25 && servico && servico.dentro !== false;
        pUlt = dentroS ? 0.8 : 0.12; saida = dentroS ? "dentro" : "fora";
      } else if (Q[1] * lado2 < 0) { pUlt = 0.07; saida = "rede"; }
      else {
        var margem = Math.min(MEIA_S - Math.abs(Q[0]), MEIO_C - Math.abs(Q[1]));
        pUlt = margem > 0.35 ? 0.86 : margem < -0.35 ? 0.1 : 0.5; saida = margem > 0 ? "dentro" : "fora";
      }
      fimConf = Math.abs(pUlt - 0.5) > 0.3 && ult.quique.conf > 0.5 ? "alta" : "media";
    } else if (ult && nH > 1 && ult.trilha && ult.trilha.length >= 5) {
      /* sem quique: a bola que para na rede some logo depois da batida, com a última posição (projetada no chão) junto da rede */
      var fimT = ult.trilha[ult.trilha.length - 1], chao = aplicarH(ctx.H, [fimT.x, fimT.y]);
      if (Math.abs(chao[1]) < 2.2 && fimT.t - ult.t < 1.3) { pUlt = 0.12; saida = "rede"; fimConf = "media"; }
    }
    return {
      ini: d.ini, fim: d.fim, nHits: nH, quem: quem, batidas: batidas, falsas: falsas, sp: sp, ladoObs: ladoObs, pAtletaPerto: pAP, servico: servico,
      pUltimoGanhou: pUlt, fimConf: fimConf, saida: saida, ultimoEhSacador: nH ? quem[nH - 1] === quem[0] : true,
      pFalta: nH === 1 ? (servico && servico.dentro != null ? (servico.dentro ? 0.15 : 0.92) : 0.8) : nH === 2 ? (servico && servico.dentro === false ? 0.75 : 0.12) : 0.02,
    };
  }
  /* candidato a bola que na verdade é o corpo de um jogador: perto dos membros (pose) ou, sem pose, numa faixa estreita do corpo;
     perto da batida, também a região da raquete. O corpo de quem está perto da câmera cobre parte da quadra na imagem,
     então não dá para descartar a caixa inteira do jogador (o quique do saque cai ali). */
  var MEMBROS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 31, 32];
  function dentroDeJogador(tr, t, b, ctx, hits, quem) {
    return ["perto", "longe"].some(function (k) {
      var f = noTempo(tr[k], t, 0.08); if (!f) return false;
      var esc = ctx.escala(f.P[1]), bx = b[0] * ctx.asp, by = b[1];
      var batendo = hits && hits.some(function (h, i) { return quem[i] === k && Math.abs(h - t) < 0.12; });
      if (f.lm) {
        for (var i = 0; i < MEMBROS.length; i++) { var m = f.lm[MEMBROS[i]]; if (m && Math.hypot(m.x * ctx.asp - bx, m.y - by) < esc * (batendo && (MEMBROS[i] === 15 || MEMBROS[i] === 16) ? 0.6 : 0.3)) return true; }
        return false;
      }
      var dx = bx - f.pe[0] * ctx.asp, dy = f.pe[1] - by;
      return Math.abs(dx) < esc * (batendo ? 0.8 : 0.35) && dy > -esc * 0.15 && dy < esc * 1.95;
    });
  }
  function analisaSaque(b, dev, k, tr) {
    var r = { dentro: null, dir: null, dConf: null };
    var lado = k === "perto" ? 1 : -1;
    if (b.quique && b.quique.P[1] * lado > 0) {
      var Q = b.quique.P, alvoX = b.P ? -Math.sign(b.P[0]) : 0;
      r.dentro = Math.abs(Q[1]) <= SERV + 0.2 && Math.abs(Q[0]) <= MEIA_S + 0.2 && (alvoX === 0 || Q[0] * alvoX >= -0.2);
      var u = Math.min(1, Math.abs(Q[0]) / MEIA_S);
      r.dir = u > 0.62 ? "aberto" : u < 0.3 ? "fechado" : "corpo"; r.dConf = b.quique.conf > 0.5 ? "alta" : "media"; r.quique = Q;
    } else if (dev && dev.P) {
      var outro = k === "perto" ? "longe" : "perto", ini = noTempo(tr[outro], b.t, 0.3);
      if (ini) {
        var dx = Math.abs(dev.P[0]) - Math.abs(ini.P[0]);
        r.dir = dx > 0.9 ? "aberto" : dx < -0.9 ? "fechado" : "corpo"; r.dConf = "baixa";
      }
    }
    return r;
  }
  /* forehand/backhand pelo lado do corpo em que o punho da mão dominante (ou a bola) está no contato; smash com o braço acima da cabeça;
     efeito pela trajetória do punho: de baixo para cima = top spin, de cima para baixo = slice */
  function golpe(trk, t, mao, asp, bolas) {
    var f = comPose(trk, t, 0.09), r = { v: null, c: "baixa", efeito: null, eConf: null };
    if (!f) return r;
    var c = corpo(f.lm, asp), w = punho(f.lm, mao, asp), n = pt(f.lm, LM.nariz, asp);
    if (!c || !w) return r;
    if (n && w[1] < n[1] - 0.15 * c.tronco) { r.v = "smash"; r.c = "media"; return r; }
    var lado = null;
    if (c.eixo) {
      var s = ((w[0] - c.cQ[0]) * c.eixo[0] + (w[1] - c.cQ[1]) * c.eixo[1]) / c.tronco;
      var q = noTempo(bolas, t, 0.05), sb = null;
      if (q) { var bb = q.b.slice().sort(function (a, b2) { return Math.hypot(a[0] * asp - w[0], a[1] - w[1]) - Math.hypot(b2[0] * asp - w[0], b2[1] - w[1]); })[0]; if (Math.hypot(bb[0] * asp - w[0], bb[1] - w[1]) < c.tronco) sb = ((bb[0] * asp - c.cQ[0]) * c.eixo[0] + (bb[1] - c.cQ[1]) * c.eixo[1]) / c.tronco; }
      var v = (mao === "E" ? -1 : 1) * (sb != null ? 0.4 * s + 0.6 * sb : s);
      if (Math.abs(v) > 0.18) { lado = v > 0 ? "forehand" : "backhand"; r.c = Math.abs(v) > 0.45 ? "alta" : "media"; }
    }
    r.v = lado;
    var a = comPose(trk, t - 0.16, 0.08), b = comPose(trk, t + 0.16, 0.08);
    if (a && b) {
      var pa = punho(a.lm, mao, asp), pb = punho(b.lm, mao, asp);
      if (pa && pb) {
        var sobe = (pa[1] - pb[1]) / c.tronco;
        r.efeito = sobe > 0.55 ? "top" : sobe < -0.2 ? "slice" : "flat"; r.eConf = Math.abs(sobe - 0.17) > 0.6 ? "media" : "baixa";
      }
    }
    return r;
  }

  /* ── decodificação da partida inteira: papel de cada trecho (falta de 1º saque, ponto ou não é ponto) e quem ganhou ── */
  var LN = Math.log;
  function clamp(p) { return Math.max(0.04, Math.min(0.96, p)); }
  function decodificar(an, cfg) {
    cfg = cfg || {};
    var largura = cfg.largura || 400, ini = [];
    (cfg.saca ? [cfg.saca] : ["nos", "ele"]).forEach(function (s) {
      (cfg.atletaComecaPerto != null ? [!!cfg.atletaComecaPerto] : [true, false]).forEach(function (ap) {
        ini.push({ e: Placar.inicial(cfg, s), ap: ap, falta: false, lp: 0, pai: null, dec: null });
      });
    });
    var feixe = ini, hist = [];
    an.forEach(function (a, k) {
      var prox = {};
      function add(st, dec, e, ap, falta, l) {
        var no = { e: e, ap: ap, falta: falta, lp: st.lp + l, pai: st, dec: dec };
        var ch = Placar.chave(e) + "|" + ap + "|" + falta;
        if (!prox[ch] || prox[ch].lp < no.lp) prox[ch] = no;
      }
      feixe.forEach(function (st) {
        if (st.e.fim) { add(st, { papel: "fora" }, st.e, st.ap, st.falta, LN(0.3)); return; }
        add(st, { papel: "fora" }, st.e, st.ap, st.falta, LN(a.nHits >= 3 ? 0.004 : 0.02)); // aquecimento, ruído, ponto repetido
        var sac = Placar.quemSaca(st.e), sacPerto = sac === "nos" ? st.ap : !st.ap;
        var em = LN(clamp(sacPerto ? a.sp : 1 - a.sp)) + LN(clamp(st.ap ? a.pAtletaPerto : 1 - a.pAtletaPerto));
        if (a.ladoObs) { var bate = a.ladoObs.v === Placar.lado(st.e), c = a.ladoObs.c; em += LN(bate ? 0.5 * (1 - c) + 0.94 * c : 0.5 * (1 - c) + 0.06 * c); }
        if (a.nHits <= 2) { // pode ser falta de saque (o recebedor às vezes devolve a bola fora)
          var pf = a.pFalta;
          if (!st.falta) add(st, { papel: "falta" }, st.e, st.ap, true, em + LN(clamp(pf)));
          else if (a.nHits === 1) { var e1 = Placar.aplicar(st.e, sac !== "nos"); add(st, { papel: "ponto", saque: "df", nos: sac !== "nos" }, e1, Placar.trocaLado(st.e, e1) ? !st.ap : st.ap, false, em + LN(clamp(pf))); }
          else { var e2 = Placar.aplicar(st.e, sac !== "nos"); add(st, { papel: "ponto", saque: "df", nos: sac !== "nos" }, e2, Placar.trocaLado(st.e, e2) ? !st.ap : st.ap, false, em + LN(clamp(pf * 0.8))); }
          if (a.nHits === 1) { var e3 = Placar.aplicar(st.e, sac === "nos"); add(st, { papel: "ponto", saque: "ace", nos: sac === "nos" }, e3, Placar.trocaLado(st.e, e3) ? !st.ap : st.ap, false, em + LN(clamp(1 - pf))); return; }
        }
        /* ponto jogado: o último a bater ganhou com probabilidade pUltimoGanhou */
        var ultSac = a.ultimoEhSacador, ultNos = ultSac ? sac === "nos" : sac !== "nos";
        [true, false].forEach(function (nos) {
          var p = nos === ultNos ? a.pUltimoGanhou : 1 - a.pUltimoGanhou, e4 = Placar.aplicar(st.e, nos);
          add(st, { papel: "ponto", saque: st.falta ? "2" : "1", nos: nos }, e4, Placar.trocaLado(st.e, e4) ? !st.ap : st.ap, false, em + LN(clamp(p)) + (a.nHits <= 2 ? LN(clamp(1 - a.pFalta)) : 0));
        });
      });
      feixe = Object.keys(prox).map(function (c) { return prox[c]; }).sort(function (x, y) { return y.lp - x.lp; }).slice(0, largura);
    });
    var alvo = cfg.placarFinal ? lerPlacar(cfg.placarFinal) : null;
    var fim = feixe.slice().sort(function (x, y) { return (y.lp + bonusFinal(y.e, alvo)) - (x.lp + bonusFinal(x.e, alvo)); })[0];
    var decs = [], estados = [];
    for (var n = fim; n && n.pai; n = n.pai) { decs.unshift(n.dec); estados.unshift({ e: n.pai.e, ap: n.pai.ap, falta: n.pai.falta }); }
    return { decisoes: decs, antes: estados, final: fim.e, atletaTerminouPerto: fim.ap, confere: alvo ? bonusFinal(fim.e, alvo) === 0 : null, lp: fim.lp + bonusFinal(fim.e, alvo), cfg: cfg };
  }
  /* formato descoberto: decodifica com cada formato comum e fica o que melhor explica a sequência de saques e lados
     (pequena preferência pelo mais comum: melhor de 3 sets com vantagem) */
  var FORMATOS = [[{ formato: "3sets" }, 0], [{ formato: "3sets", superTiebreakDecisivo: true }, -1.5], [{ formato: "1set" }, -1.5], [{ formato: "4games" }, -3],
    [{ formato: "3sets", semVantagem: true }, -2.5], [{ formato: "3sets", semVantagem: true, superTiebreakDecisivo: true }, -3], [{ formato: "1set", semVantagem: true }, -3], [{ formato: "4games", semVantagem: true }, -3.5],
    [{ formato: "tb10" }, -4], [{ formato: "tb7" }, -4.5]];
  function decodificarAuto(an, base) {
    base = base || {};
    if (base.formato) return decodificar(an, base);
    var melhor = null;
    FORMATOS.forEach(function (f) {
      var d = decodificar(an, Object.assign({}, base, f[0])), nota = d.lp + f[1];
      if (d.final.fim && d.decisoes.length && d.decisoes[d.decisoes.length - 1].papel !== "fora") nota += 5; // a partida termina exatamente no último ponto do vídeo
      if (!melhor || nota > melhor.nota) { melhor = d; melhor.nota = nota; melhor.formatoAuto = f[0]; }
    });
    return melhor;
  }
  /* mão de cada jogador: no contato do saque, o punho mais alto é o da mão dominante (voto em todos os saques de cada um) */
  function maosAuto(dados, an, dec, ctx) {
    var votos = { nos: { D: 0, E: 0 }, ele: { D: 0, E: 0 } };
    dec.decisoes.forEach(function (d, k) {
      if (d.papel === "fora" || !an[k] || !an[k].nHits) return;
      var est = dec.antes[k], sac = Placar.quemSaca(est.e), lado = (sac === "nos") === est.ap ? "perto" : "longe";
      var tr = trilhas(dados[k].quadros || [], ctx), f = comPose(tr[lado], an[k].batidas[0].t, 0.08);
      if (!f || !f.lm[15] || !f.lm[16]) return;
      var dif = f.lm[16].y - f.lm[15].y; // y cresce para baixo: punho direito mais alto → dif negativo
      if (Math.abs(dif) > 0.004) votos[sac][dif < 0 ? "D" : "E"]++;
    });
    var esc = function (v) { return v.E > v.D * 1.5 && v.E >= 2 ? "E" : "D"; };
    return { A: esc(votos.nos), B: esc(votos.ele), votos: votos };
  }
  function lerPlacar(txt) {
    var sets = String(txt || "").match(/\d+\s*[-x×/]\s*\d+/g); if (!sets) return null;
    return sets.map(function (s) { var m = s.match(/(\d+)\s*[-x×/]\s*(\d+)/); return [+m[1], +m[2]]; });
  }
  function bonusFinal(e, alvo) {
    if (!alvo) return 0;
    var feitos = e.sets.concat(e.fim ? [] : [[e.g[0], e.g[1]]]), erro = Math.abs(feitos.length - alvo.length) * 3;
    for (var i = 0; i < Math.min(feitos.length, alvo.length); i++) erro += Math.abs(feitos[i][0] - alvo[i][0]) + Math.abs(feitos[i][1] - alvo[i][1]);
    return erro ? -40 - 8 * erro : 0;
  }

  /* ── pontos no formato do scout do app ── */
  var GOLPE_SCOUT = { forehand: "forehand", backhand: "backhand", voleio: "voleio", smash: "smash" };
  function confDe(p) { return p >= 0.8 ? "alta" : p >= 0.62 ? "media" : "baixa"; }
  function montarScout(an, dec, reanalisar) {
    var pontos = [], faltaPend = null;
    dec.decisoes.forEach(function (d, k) {
      var est = dec.antes[k], a = an[k];
      if (d.papel === "fora") return;
      var sac = Placar.quemSaca(est.e), sacPerto = sac === "nos" ? est.ap : !est.ap;
      if (reanalisar) a = an[k] = reanalisar(k, { servidorPerto: sacPerto, atletaPerto: est.ap }); // refaz as batidas com o sacador e o lado decididos pelo placar
      if (d.papel === "falta") { faltaPend = { k: k, pFalta: a.pFalta }; return; }
      var atletaPerto = est.ap, quemA = atletaPerto ? "perto" : "longe";
      var bats = a.batidas.map(function (b) { return { t: Math.round(b.t * 100) / 100, quem: b.quem === quemA ? "nos" : "ele", golpe: b.devolucao && b.golpe !== "voleio" ? (b.golpe || "devolucao") : b.golpe, efeito: b.efeito || null, direcao: b.direcao || null, corrida: !!b.corrida, rede: !!b.rede, profundidade: b.profundidade || null,
        vel: b.vel || null, distFundo: b.distFundo == null ? null : b.distFundo, alturaRede: b.voo ? b.voo.alturaRede : null }; });
      var meus = a.batidas.filter(function (b) { return b.quem === quemA; }), u = meus[meus.length - 1] || null, nH = a.nHits;
      var ultimo = a.batidas[nH - 1], ultNos = ultimo ? ultimo.quem === quemA : sac === "nos";
      var saque = d.saque, nos = d.nos, fim;
      if (saque === "ace") fim = nos ? "winner_nos" : "winner_dele";
      else if (saque === "df") fim = nos ? "erro_dele" : "erro_nos";
      else fim = ultNos ? (nos ? "winner_nos" : "erro_nos") : (nos ? "erro_dele" : "winner_dele");
      var pLocal = saque === "df" ? a.pFalta : saque === "ace" ? 1 - a.pFalta : (nos === ultNos ? a.pUltimoGanhou : 1 - a.pUltimoGanhou);
      var golpeU = u ? (u.devolucao && u.golpe !== "voleio" && u.golpe !== "smash" ? "devolucao" : GOLPE_SCOUT[u.golpe] || null) : null;
      var dirS = a.servico && a.servico.dir;
      var p = {
        fim: fim, nos: nos, saque: saque, bola: nH <= 4 ? "1-4" : nH <= 9 ? "5-9" : "10+", causa: saque === "df" && sac === "nos" ? "execucao" : null,
        rede: a.batidas.some(function (b) { return b.quem === quemA && b.rede; }), situacao: null,
        golpe: golpeU, corrida: !!(u && u.corrida), direcao: u && (u.direcao === "cruzado" || u.direcao === "paralelo") ? u.direcao : null,
        efeito: u && u.efeito ? u.efeito : null, qualDev: null, dec: null, dirSaque: saque !== "df" ? dirS || null : null,
        adverso: Placar.adverso(est.e), sacador: sac, lado: Placar.lado(est.e),
        n: pontos.length + 1, placarAntes: Placar.rotulo(est.e), jogo: Placar.jogo(est.e), set: Placar.set(est.e),
        video: { ini: Math.round(a.ini * 10) / 10, fim: Math.round(a.fim * 10) / 10, falta: faltaPend ? Math.round(an[faltaPend.k].ini * 10) / 10 : null },
        k: k, atletaPerto: atletaPerto, // só na tela (rastreamento); compactar() não grava
        batidas: bats,
        auto: {
          nos: confDe(clamp(pLocal) + (dec.confere ? 0.15 : 0)), fim: a.fimConf === "alta" && pLocal > 0.75 ? "alta" : confDe(pLocal),
          saque: saque === "2" ? confDe(faltaPend ? faltaPend.pFalta : 0.6) : saque === "1" ? "media" : confDe(pLocal), bola: "alta",
          golpe: u ? u.gConf || "baixa" : null, direcao: u && u.direcao ? u.dConf || "baixa" : null, efeito: u && u.efeito ? u.eConf : null,
          corrida: u && u.velocidade != null ? "media" : null, rede: "media", dirSaque: a.servico && a.servico.dir ? a.servico.dConf : null,
          sacador: Math.abs(a.sp - 0.5) > 0.3 ? "alta" : "media",
        },
      };
      faltaPend = null; pontos.push(p);
    });
    return pontos;
  }

  return { calibrar: calibrar, camera: camera, projetar3: projetar3, alturaNoRaio: alturaNoRaio, voo3D: voo3D, homografia: homografia, aplicarH: aplicarH, cantosQuadra: cantosQuadra, linhasQuadra: linhasQuadra, Placar: Placar,
    analisarPonto: analisarPonto, decodificar: decodificar, decodificarAuto: decodificarAuto, maosAuto: maosAuto, montarScout: montarScout, lerPlacar: lerPlacar, quique: quique, golpe: golpe, trilhas: trilhas, dentroDeJogador: dentroDeJogador,
    QUADRA: { comprimento: COMP, larguraDuplas: LARG_D, larguraSimples: LARG_S, linhaSaque: SERV } };
});
