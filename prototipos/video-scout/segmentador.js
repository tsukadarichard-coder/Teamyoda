/* Segmentação de jogo filmado em pontos, por áudio (batidas na bola). Funções puras. */
(function (raiz, fab) {
  if (typeof module === "object" && module.exports) module.exports = fab();
  else raiz.QLSegmentador = fab();
})(this, function () {
  /* amostras: Float32Array mono; devolve energia por janela */
  function energia(amostras, taxa, janelaMs) {
    var w = Math.max(1, Math.round(taxa * (janelaMs || 10) / 1000)), out = [], i, j, s;
    for (i = 0; i + w <= amostras.length; i += w) { s = 0; for (j = 0; j < w; j++) s += amostras[i + j] * amostras[i + j]; out.push(Math.sqrt(s / w)); }
    return { e: out, dt: w / taxa };
  }
  function mediana(a) { if (!a.length) return 0; var b = a.slice().sort(function (x, y) { return x - y; }); return b[Math.floor(b.length / 2)]; }
  /* Batidas: picos de subida brusca acima do piso local. sens 1 (rígido) .. 10 (sensível). */
  function batidas(en, sens, minGap) {
    sens = sens || 5; minGap = minGap || 0.3;
    var e = en.e, dt = en.dt, hits = [], jan = Math.round(0.6 / dt), i, loc, piso, flux, mad, lim, ult = -1e9;
    var k = 14 - sens; // 13..4
    var med = mediana(e), dev = mediana(e.map(function (x) { return Math.abs(x - med); })) || 1e-6;
    for (i = 2; i < e.length - 1; i++) {
      loc = e.slice(Math.max(0, i - jan), i - 1); piso = mediana(loc);
      flux = e[i] - piso;
      lim = k * dev * 1.4826;
      if (flux > lim && e[i] >= e[i - 1] && e[i] >= e[i + 1] && e[i] > med + lim) {
        var t = i * dt;
        if (t - ult >= minGap) { hits.push({ t: t, f: flux }); ult = t; }
        else if (hits.length && flux > hits[hits.length - 1].f) { hits[hits.length - 1] = { t: t, f: flux }; ult = t; }
      }
    }
    return hits;
  }
  /* Agrupa batidas em pontos. gap: segundos de silêncio que separam pontos. */
  function pontos(hits, o) {
    o = o || {}; var gap = o.gap || 6, pre = o.pre == null ? 2 : o.pre, pos = o.pos == null ? 2.5 : o.pos, dur = o.dur, out = [], cur = null;
    hits.forEach(function (h) {
      if (cur && h.t - cur.hits[cur.hits.length - 1].t <= gap) cur.hits.push(h);
      else { cur = { hits: [h] }; out.push(cur); }
    });
    return out.map(function (p, i) {
      var a = p.hits[0].t, b = p.hits[p.hits.length - 1].t, ini = Math.max(0, a - pre), fim = b + pos;
      if (dur) fim = Math.min(dur, fim);
      return { n: i + 1, ini: ini, fim: fim, saque: a, golpes: p.hits.length, duracao: b - a,
        suspeito: p.hits.length < 2 ? "só 1 batida (falta de saque ou ace?)" : (b - a > 40 ? "ponto muito longo — pode ser 2 pontos juntos" : "") };
    });
  }
  /* Placar tênis a partir de pontos já com vencedor "A" (atleta) ou "B". Retorna estado após cada ponto. */
  function placar(vencedores, sets) {
    var g = [0, 0], pt = [0, 0], tb = false, out = [], setsAc = [], jogoSet = [0, 0], i, w, o, ordem = { A: 0, B: 1 };
    var lbl = ["0", "15", "30", "40"];
    function txt() {
      if (tb) return pt[0] + "-" + pt[1];
      if (pt[0] >= 3 && pt[1] >= 3) return pt[0] === pt[1] ? "40-40" : (pt[0] > pt[1] ? "Vant. A" : "Vant. B");
      return lbl[pt[0]] + "-" + lbl[pt[1]];
    }
    for (i = 0; i < vencedores.length; i++) {
      w = ordem[vencedores[i]]; if (w === undefined) { out.push(null); continue; } o = 1 - w;
      pt[w]++;
      var fimGame = tb ? (pt[w] >= 7 && pt[w] - pt[o] >= 2) : (pt[w] >= 4 && pt[w] - pt[o] >= 2);
      if (fimGame) { g[w]++; pt = [0, 0]; tb = false;
        if ((g[w] >= 6 && g[w] - g[o] >= 2) || g[w] === 7) { setsAc.push(g.slice()); g = [0, 0]; }
        else if (g[0] === 6 && g[1] === 6) tb = true; }
      out.push({ sets: setsAc.slice(), games: g.slice(), pontos: txt() });
    }
    return out;
  }
  return { energia: energia, batidas: batidas, pontos: pontos, placar: placar };
});
