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
      lim = k * dev * 1.4826;
      if (!(e[i] >= e[i - 1] && e[i] >= e[i + 1] && e[i] > med + lim)) continue; // só calcula o piso local nos candidatos (partidas de horas)
      loc = e.slice(Math.max(0, i - jan), i - 1); piso = mediana(loc);
      flux = e[i] - piso;
      if (flux > lim) {
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
  
  /* Estatísticas do jogo a partir dos pontos já classificados (venc "A" = atleta, "B" = adversário). Só entra o que foi classificado. */
  function resumirJogo(pts) {
    var cl = pts.filter(function (p) { return p.venc === "A" || p.venc === "B"; });
    var c = function (f) { return cl.filter(f).length; };
    var ga = c(function (p) { return p.venc === "A"; });
    var noSaqueA = cl.filter(function (p) { return p.sacador === "A"; }), noSaqueB = cl.filter(function (p) { return p.sacador === "B"; });
    var erro = function (p) { return p.tipo === "Erro forçado" || p.tipo === "Erro não forçado"; };
    var bat = pts.filter(function (p) { return p.golpes > 0; });
    var r = {
      total: pts.length, classificados: cl.length, ganhos: ga, pctGanhos: cl.length ? Math.round(ga / cl.length * 100) : null,
      acesA: c(function (p) { return p.tipo === "Ace" && p.venc === "A"; }), acesB: c(function (p) { return p.tipo === "Ace" && p.venc === "B"; }),
      dfA: c(function (p) { return p.tipo === "Dupla falta" && p.venc === "B"; }), dfB: c(function (p) { return p.tipo === "Dupla falta" && p.venc === "A"; }),
      winnersA: c(function (p) { return p.tipo === "Winner" && p.venc === "A"; }), winnersB: c(function (p) { return p.tipo === "Winner" && p.venc === "B"; }),
      errosA: c(function (p) { return erro(p) && p.venc === "B"; }), errosB: c(function (p) { return erro(p) && p.venc === "A"; }),
      forcadosA: c(function (p) { return p.tipo === "Erro forçado" && p.venc === "B"; }), naoForcadosA: c(function (p) { return p.tipo === "Erro não forçado" && p.venc === "B"; }),
      pctSaqueA: noSaqueA.length ? Math.round(noSaqueA.filter(function (p) { return p.venc === "A"; }).length / noSaqueA.length * 100) : null,
      pctSaqueB: noSaqueB.length ? Math.round(noSaqueB.filter(function (p) { return p.venc === "A"; }).length / noSaqueB.length * 100) : null,
      batidasMedia: bat.length ? Math.round(bat.reduce(function (s, p) { return s + p.golpes; }, 0) / bat.length * 10) / 10 : null,
      pctCurtos: bat.length ? Math.round(bat.filter(function (p) { return p.golpes <= 4; }).length / bat.length * 100) : null,
      duracaoMedia: pts.length ? Math.round(pts.reduce(function (s, p) { return s + (p.duracao || 0); }, 0) / pts.length * 10) / 10 : null
    };
    return r;
  }
  var METRICAS_VIDEO = [
    { k: "pctGanhos", rot: "Pontos ganhos", suf: "%", melhor: true },
    { k: "pctSaqueA", rot: "Ganhos no meu saque", suf: "%", melhor: true },
    { k: "pctSaqueB", rot: "Ganhos no saque dele", suf: "%", melhor: true },
    { k: "acesA", rot: "Aces do meu jogador", melhor: true }, { k: "dfA", rot: "Duplas faltas do meu jogador", melhor: false },
    { k: "winnersA", rot: "Winners do meu jogador", melhor: true }, { k: "errosA", rot: "Erros do meu jogador", melhor: false },
    { k: "naoForcadosA", rot: "Erros não forçados do meu jogador", melhor: false },
    { k: "pctCurtos", rot: "Pontos até 4 batidas", suf: "%", melhor: null }, { k: "batidasMedia", rot: "Batidas por ponto", melhor: null }
  ];
  /* Compara um jogo em vídeo com os anteriores (média e último). Mesma lógica de limiar do scout completo. */
  function compararVideo(atual, anteriores) {
    var linhas = [], mel = 0, pio = 0;
    METRICAS_VIDEO.forEach(function (m) {
      var va = atual[m.k];
      var prev = (anteriores || []).map(function (h) { return h.res[m.k]; }).filter(function (v) { return typeof v === "number" && isFinite(v); });
      if (typeof va !== "number" || !prev.length) return;
      var media = prev.reduce(function (s, v) { return s + v; }, 0) / prev.length, ultimo = prev[prev.length - 1], delta = va - media;
      var lim = m.suf === "%" ? 2 : 0.5, sent = (m.melhor === null || Math.abs(delta) < lim) ? 0 : ((delta > 0) === m.melhor ? 1 : -1);
      if (sent > 0) mel++; else if (sent < 0) pio++;
      var ar = function (v) { return Math.round(v * 10) / 10; };
      linhas.push({ rot: m.rot, atual: ar(va) + (m.suf || ""), media: ar(media) + (m.suf || ""), ultimo: ar(ultimo) + (m.suf || ""), sentido: sent, neutro: m.melhor === null });
    });
    return { n: (anteriores || []).length, linhas: linhas, melhoraram: mel, pioraram: pio };
  }
  return { energia: energia, batidas: batidas, pontos: pontos, placar: placar, resumirJogo: resumirJogo, compararVideo: compararVideo, METRICAS_VIDEO: METRICAS_VIDEO };
});
