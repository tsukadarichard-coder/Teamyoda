/* Padrões de jogo · Tecnologia QuadraLab. Funções puras (Node e navegador).
   A partir dos pontos do scout com as batidas do rali (scout montado do vídeo: p.batidas, ou a forma compacta p.seq),
   mapeia como os pontos são ganhos e perdidos: a sequência exata que levou ao fim do ponto (as últimas bolas, com golpe,
   direção, profundidade e efeito), as jogadas que provocam o erro do adversário, onde o jogador erra, saque + 1 e devolução + 1,
   eficácia de cada jogada do jogador, velocidade e profundidade por golpe. Vale para uma partida ou para várias juntas.
   QLPadroes.analisar(pontos) → resultado · QLPadroes.html(resultado, { A, B }) → HTML · QLPadroes.batidas(p) → lista normalizada */
(function (raiz, fab) {
  var api = fab();
  if (typeof module === "object" && module.exports) module.exports = api; else raiz.QLPadroes = api;
})(typeof window !== "undefined" ? window : this, function () {
  var GOLPE = { S: "saque", FH: "forehand", BH: "backhand", V: "voleio", SM: "smash", D: "devolucao" };
  var CURTO = { saque: "Saque", forehand: "FH", backhand: "BH", voleio: "Voleio", smash: "Smash", devolucao: "Devolução" };
  var DIR = { c: "cruzado", p: "paralelo", m: "centro" }, EF = { t: "top", s: "slice", f: "flat" }, PROF = { F: "funda", M: "media", C: "curta" };
  var DIR_TXT = { cruzado: "cruzado", paralelo: "paralelo", centro: "no meio" }, PROF_TXT = { funda: "fundo", media: "meia quadra", curta: "curto" }, EF_TXT = { top: "top", slice: "slice", flat: "chapado" };

  /* batidas de um ponto, de qualquer origem: lista detalhada (tela) ou a forma compacta gravada ("nFHctF:112 eBHps") */
  function batidas(p) {
    if (p.batidas && p.batidas.length) return p.batidas.map(function (b) { return { quem: b.quem, golpe: b.golpe, direcao: b.direcao || null, efeito: b.efeito || null, profundidade: b.profundidade || null, vel: b.vel || null }; });
    if (!p.seq) return [];
    return String(p.seq).split(" ").map(function (tk) {
      var m = /^([ne])(S|FH|BH|SM|V|D|\?)([cpm]?)([tsf]?)([FMC]?)(?::(\d+))?$/.exec(tk); if (!m) return null;
      return { quem: m[1] === "n" ? "nos" : "ele", golpe: GOLPE[m[2]] || null, direcao: DIR[m[3]] || null, efeito: EF[m[4]] || null, profundidade: PROF[m[5]] || null, vel: m[6] ? +m[6] : null };
    }).filter(Boolean);
  }
  /* rótulo da jogada em dois níveis: geral (golpe + direção) e exato (+ profundidade e efeito) */
  function rotulo(b, exato) {
    var g = b.golpe === "saque" ? "Saque" : CURTO[b.golpe] || "Bola";
    var partes = [g + (b.errou ? " (erro)" : "")];
    if (b.direcao && b.golpe !== "saque") partes.push(DIR_TXT[b.direcao]);
    if (exato) { if (b.profundidade) partes.push(PROF_TXT[b.profundidade]); if (b.efeito) partes.push("(" + EF_TXT[b.efeito] + ")"); }
    return partes.join(" ");
  }
  function quemTxt(q) { return q === "nos" ? "A" : "B"; }
  function chave(seq, exato) { return seq.map(function (b) { return quemTxt(b.quem) + ":" + rotulo(b, exato); }).join(" → "); }
  function conta(mapa, k, info) { var x = mapa[k] || (mapa[k] = { k: k, n: 0, g: 0, pontos: [] }); x.n++; if (info.g) x.g++; if (x.pontos.length < 12) x.pontos.push(info.ponto); }
  function top(mapa, min, ord) { return Object.keys(mapa).map(function (k) { return mapa[k]; }).filter(function (x) { return x.n >= (min || 2); }).sort(ord || function (a, b) { return b.n - a.n || b.g - a.g; }); }
  /* sequências que se repetem: para cada ponto, as últimas 1, 2 e 3 bolas (ou as primeiras, no saque + 1), no nível geral e no exato.
     Fica a sequência mais longa/exata que ainda se repete; uma mais curta só entra se junta pontos que a longa não explica */
  function minerar(itens, lim) {
    var c = {};
    itens.forEach(function (it) {
      it.seqs.forEach(function (seq) {
        [false, true].forEach(function (exato) {
          var k = chave(seq, exato), x = c[k] || (c[k] = { k: k, n: 0, g: 0, fins: {}, pontos: [], ids: [], tam: seq.length, exato: exato });
          if (x.ids.indexOf(it.id) >= 0) return; x.ids.push(it.id); x.n++; if (it.g) x.g++; x.fins[it.fim] = (x.fins[it.fim] || 0) + 1; if (x.pontos.length < 12) x.pontos.push(it.ponto);
        });
      });
    });
    var l = Object.keys(c).map(function (k) { return c[k]; }).filter(function (x) { return x.n >= 2; });
    l.sort(function (a, b) { return b.n - a.n || b.tam - a.tam || (b.exato ? 1 : 0) - (a.exato ? 1 : 0); });
    var out = [];
    l.forEach(function (x) {
      var mesmo = out.some(function (o) { return o.ids.length === x.ids.length && o.ids.every(function (i) { return x.ids.indexOf(i) >= 0; }); });
      if (!mesmo) out.push(x);
    });
    return out.slice(0, lim || 8).map(function (x) { delete x.ids; return x; });
  }
  function media(l) { return l.length ? Math.round(l.reduce(function (s, v) { return s + v; }, 0) / l.length) : null; }

  function analisar(pontos) {
    pontos = (pontos || []).filter(function (p) { return p && typeof p.nos === "boolean"; });
    var r = { total: pontos.length, comBatidas: 0, fins: { winner_nos: 0, erro_dele: 0, erro_nos: 0, winner_dele: 0 }, comprimento: [], ganhos: [], perdidos: [], provocam: [], erros: [], saqueMais1: [], devolucaoMais1: [], jogadas: [], golpes: [], leituras: [] };
    var I = { ganho: [], perdido: [], provoca: [], erro: [], s1: [], d1: [] }, jog = [{}, {}], faixas = { "1-4": [0, 0], "5-9": [0, 0], "10+": [0, 0] }, golpes = {};
    pontos.forEach(function (p, i) {
      r.fins[p.fim] = (r.fins[p.fim] || 0) + 1;
      var bs = batidas(p), n = bs.length, base = { id: i, g: p.nos, fim: p.fim, ponto: p.n || i + 1 };
      var fx = n <= 4 ? "1-4" : n <= 9 ? "5-9" : "10+"; faixas[fx][0]++; if (p.nos) faixas[fx][1]++;
      if (!n) return; r.comBatidas++;
      /* golpes do jogador: velocidade e profundidade */
      bs.forEach(function (b) {
        if (b.quem !== "nos" || !b.golpe) return;
        var k = b.golpe === "saque" ? "saque" : b.golpe, x = golpes[k] || (golpes[k] = { golpe: k, n: 0, vel: [], fundas: 0, comProf: 0, efeitos: { top: 0, slice: 0, flat: 0 } });
        x.n++; if (b.vel) x.vel.push(b.vel); if (b.profundidade) { x.comProf++; if (b.profundidade === "funda") x.fundas++; } if (b.efeito) x.efeitos[b.efeito]++;
      });
      /* a bola errada vale pelo golpe (a direção de uma bola que foi na rede ou fora não é jogada) */
      if (/^erro/.test(p.fim)) bs[n - 1] = { quem: bs[n - 1].quem, golpe: bs[n - 1].golpe, errou: true };
      var fins = [1, 2, 3].filter(function (t) { return t <= n; }).map(function (t) { return bs.slice(n - t); });
      /* como o ponto terminou (últimas bolas) */
      I[p.nos ? "ganho" : "perdido"].push(Object.assign({ seqs: fins }, base));
      /* a jogada do jogador que provocou o erro do adversário, e onde o jogador erra (a bola do adversário + o golpe errado) */
      if (p.fim === "erro_dele" && n >= 2) I.provoca.push(Object.assign({ seqs: fins.filter(function (f) { return f.length >= 2; }) }, base));
      if (p.fim === "erro_nos" && n >= 2) I.erro.push(Object.assign({ seqs: fins.filter(function (f) { return f.length >= 2; }) }, base));
      /* saque + 1 e devolução + 1: as primeiras bolas */
      var ini = [2, 3].filter(function (t) { return t <= n; }).map(function (t) { return bs.slice(0, t); });
      if (bs[0].quem === "nos" && ini.length) I.s1.push(Object.assign({ seqs: ini }, base));
      if (bs[0].quem === "ele" && ini.length) I.d1.push(Object.assign({ seqs: ini }, base));
      /* eficácia de cada jogada do jogador: o que acontece até a bola seguinte dele (ganha, perde ou segue) */
      bs.forEach(function (b, j) {
        if (b.quem !== "nos" || !b.golpe || b.golpe === "saque") return;
        var desfecho = n - 1 - j <= 1 ? (p.nos ? "g" : "p") : "s";
        [0, 1].forEach(function (lv) {
          var k = rotulo(b, !!lv), x = jog[lv][k] || (jog[lv][k] = { k: k, n: 0, g: 0, p: 0, s: 0, pontos: [] });
          x.n++; x[desfecho]++; if (x.pontos.length < 12) x.pontos.push(base.ponto);
        });
      });
    });
    r.ganhos = minerar(I.ganho); r.perdidos = minerar(I.perdido); r.provocam = minerar(I.provoca, 6); r.erros = minerar(I.erro, 6);
    var porTaxa = function (a, b) { return b.g / b.n - a.g / a.n || b.n - a.n; };
    r.saqueMais1 = minerar(I.s1, 6).sort(porTaxa); r.devolucaoMais1 = minerar(I.d1, 6).sort(porTaxa);
    r.jogadas = top(jog[1], 3).concat(top(jog[0], 3).filter(function (x) { return !jog[1][x.k]; })).map(function (x) { x.decide = x.g + x.p; x.saldo = x.g - x.p; return x; })
      .filter(function (x) { return x.decide >= 2; }).sort(function (a, b) { return b.saldo - a.saldo || b.n - a.n; });
    r.comprimento = Object.keys(faixas).map(function (k) { return { faixa: k, n: faixas[k][0], g: faixas[k][1] }; }).filter(function (x) { return x.n; });
    r.golpes = Object.keys(golpes).map(function (k) { var x = golpes[k]; return { golpe: k, n: x.n, vel: media(x.vel), velMax: x.vel.length ? Math.max.apply(null, x.vel) : null, pctFundas: x.comProf ? Math.round(x.fundas / x.comProf * 100) : null, efeitos: x.efeitos }; });
    /* leituras em frases */
    var L = r.leituras, pct = function (a, b) { return b ? Math.round(a / b * 100) : 0; };
    if (r.ganhos[0]) L.push({ tipo: "ganho", txt: "O jeito que mais deu ponto: " + legivel(r.ganhos[0].k) + " (" + r.ganhos[0].n + " vezes)." });
    if (r.provocam[0]) L.push({ tipo: "ganho", txt: "A jogada que mais provocou erro do adversário: " + legivel(r.provocam[0].k) + " (" + r.provocam[0].n + " erros dele)." });
    if (r.erros[0]) L.push({ tipo: "erro", txt: "Onde mais errou: " + legivel(r.erros[0].k) + " (" + r.erros[0].n + " vezes)." });
    var melhorJ = r.jogadas[0], piorJ = r.jogadas.slice().sort(function (a, b) { return a.saldo - b.saldo; })[0];
    if (melhorJ && melhorJ.saldo > 0) L.push({ tipo: "ganho", txt: "Jogada mais eficaz: " + melhorJ.k + " — decidiu " + melhorJ.decide + " pontos, ganhou " + melhorJ.g + "." });
    if (piorJ && piorJ.saldo < 0 && piorJ !== melhorJ) L.push({ tipo: "erro", txt: "Jogada que mais custou pontos: " + piorJ.k + " — decidiu " + piorJ.decide + " pontos, perdeu " + piorJ.p + "." });
    var s1 = r.saqueMais1.filter(function (x) { return x.n >= 3; })[0];
    if (s1) L.push({ tipo: "ganho", txt: "Saque + 1 que mais funcionou: " + legivel(s1.k) + " — " + pct(s1.g, s1.n) + "% dos " + s1.n + " pontos." });
    var longo = r.comprimento.filter(function (x) { return x.faixa === "5-9" || x.faixa === "10+"; }).reduce(function (a, x) { return [a[0] + x.n, a[1] + x.g]; }, [0, 0]);
    var curto = r.comprimento.filter(function (x) { return x.faixa === "1-4"; }).reduce(function (a, x) { return [a[0] + x.n, a[1] + x.g]; }, [0, 0]);
    if (longo[0] >= 4 && curto[0] >= 4) L.push({ tipo: "info", txt: "Pontos curtos (até 4 bolas): " + pct(curto[1], curto[0]) + "% ganhos · ralis longos (5+): " + pct(longo[1], longo[0]) + "% ganhos." });
    return r;
  }
  function legivel(k) { return k.replace(/\bA:/g, "jogador ").replace(/\bB:/g, "adversário "); }

  /* ── HTML (usado na revisão do scout em vídeo e no caderno) ── */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function html(r, nomes) {
    nomes = nomes || {}; var A = nomes.A || "Jogador", B = nomes.B || "Adversário";
    if (!r || !r.comBatidas) return '<p class="qp-msg">Os padrões aparecem quando o scout tem as batidas do rali (scout montado a partir do vídeo).</p>';
    var nm = function (k) { return esc(k).replace(/\bA:/g, "<b>" + esc(A) + "</b> ").replace(/\bB:/g, "<b>" + esc(B) + "</b> "); };
    var pct = function (a, b) { return b ? Math.round(a / b * 100) + "%" : "—"; };
    var tabela = function (titulo, nota, lista, colunas) {
      if (!lista.length) return "";
      return '<div class="qp-bloco"><h4>' + esc(titulo) + "</h4>" + (nota ? '<p class="qp-msg">' + esc(nota) + "</p>" : "") + '<table class="qp-t"><thead><tr><th>Sequência</th>' + colunas.map(function (c) { return "<th>" + esc(c[0]) + "</th>"; }).join("") + "</tr></thead><tbody>" +
        lista.map(function (x) { return "<tr><td>" + nm(x.k) + (x.pontos && x.pontos.length ? '<span class="qp-pts">pontos ' + x.pontos.slice(0, 6).join(", ") + (x.pontos.length > 6 ? "…" : "") + "</span>" : "") + "</td>" + colunas.map(function (c) { return "<td>" + c[1](x) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>";
    };
    var vezes = ["Vezes", function (x) { return x.n; }], ganhosC = ["Ganhos", function (x) { return pct(x.g, x.n); }];
    var css = '<style>.qp{font-size:13.5px}.qp h4{margin:14px 0 4px;font-size:14px}.qp .qp-msg{font-size:12.5px;color:#5C6B78;margin:2px 0 6px}.qp-t{width:100%;border-collapse:collapse;font-size:13px}.qp-t td,.qp-t th{text-align:left;padding:6px 5px;border-top:1px solid #E2DED5;vertical-align:top}.qp-t th{font-size:11.5px;color:#5C6B78;border-top:0}.qp-pts{display:block;font-size:11.5px;color:#8A96A0}.qp-l{margin:6px 0 0;padding-left:18px}.qp-l li{margin:3px 0}.qp-l li.ganho::marker{color:#2E8B57}.qp-l li.erro::marker{color:#C65825}</style>';
    return css + '<div class="qp">' +
      (r.leituras.length ? '<ul class="qp-l">' + r.leituras.map(function (l) { return '<li class="' + l.tipo + '">' + esc(l.txt).replace(/jogador /g, esc(A) + " ").replace(/adversário /g, esc(B) + " ") + "</li>"; }).join("") + "</ul>" : "") +
      tabela("Como os pontos foram ganhos", "As últimas bolas dos pontos ganhos por " + A + ", da mais antiga para a que fechou o ponto.", r.ganhos, [vezes, ["Winners / erros de " + B, function (x) { return (x.fins.winner_nos || 0) + " / " + (x.fins.erro_dele || 0); }]]) +
      tabela("Como os pontos foram perdidos", "As últimas bolas dos pontos perdidos.", r.perdidos, [vezes, ["Erros de " + A + " / winners de " + B, function (x) { return (x.fins.erro_nos || 0) + " / " + (x.fins.winner_dele || 0); }]]) +
      tabela("Jogadas que provocaram erro de " + B, "A bola de " + A + " e o golpe em que " + B + " errou.", r.provocam, [vezes]) +
      tabela("Onde " + A + " erra", "A bola de " + B + " e o golpe em que " + A + " errou.", r.erros, [vezes]) +
      tabela("Saque + 1", "Os pontos em que " + A + " sacou: saque, devolução e a 3ª bola.", r.saqueMais1, [vezes, ganhosC]) +
      tabela("Devolução + 1", "Os pontos em que " + B + " sacou: saque, devolução de " + A + " e a bola seguinte.", r.devolucaoMais1, [vezes, ganhosC]) +
      (r.jogadas.length ? '<div class="qp-bloco"><h4>Eficácia de cada jogada de ' + esc(A) + '</h4><p class="qp-msg">Depois de cada jogada: o ponto termina a favor, contra, ou segue.</p><table class="qp-t"><thead><tr><th>Jogada</th><th>Vezes</th><th>Ganhou</th><th>Perdeu</th><th>Seguiu</th></tr></thead><tbody>' +
        r.jogadas.slice(0, 10).map(function (x) { return "<tr><td>" + esc(x.k) + "</td><td>" + x.n + "</td><td>" + x.g + "</td><td>" + x.p + "</td><td>" + x.s + "</td></tr>"; }).join("") + "</tbody></table></div>" : "") +
      (r.golpes.length ? '<div class="qp-bloco"><h4>Velocidade e profundidade de ' + esc(A) + '</h4><table class="qp-t"><thead><tr><th>Golpe</th><th>Bolas</th><th>Velocidade média</th><th>Máxima</th><th>Fundas</th><th>Top / slice / chapado</th></tr></thead><tbody>' +
        r.golpes.sort(function (a, b) { return b.n - a.n; }).map(function (g) { return "<tr><td>" + esc(CURTO[g.golpe] || g.golpe) + "</td><td>" + g.n + "</td><td>" + (g.vel ? g.vel + " km/h" : "—") + "</td><td>" + (g.velMax ? g.velMax + " km/h" : "—") + "</td><td>" + (g.pctFundas == null ? "—" : g.pctFundas + "%") + "</td><td>" + (g.golpe === "saque" ? "—" : g.efeitos.top + " / " + g.efeitos.slice + " / " + g.efeitos.flat) + "</td></tr>"; }).join("") + "</tbody></table></div>" : "") +
      (r.comprimento.length ? '<div class="qp-bloco"><h4>Duração do rali</h4><table class="qp-t"><thead><tr><th>Bolas no ponto</th><th>Pontos</th><th>Ganhos</th></tr></thead><tbody>' + r.comprimento.map(function (x) { return "<tr><td>" + x.faixa + "</td><td>" + x.n + "</td><td>" + pct(x.g, x.n) + "</td></tr>"; }).join("") + "</tbody></table></div>" : "") +
      "</div>";
  }
  return { analisar: analisar, html: html, batidas: batidas, rotulo: rotulo };
});
