/* Gráficos do resumo do scout: a página da família (scout/index.html) e o app Competição usam este mesmo arquivo, então os dois mostram igual.
   Recebe o resumo público (o mesmo que a família recebe, já limpo no servidor) e devolve HTML pronto, sem dependências.
   Todo texto vindo do resumo passa por esc(). Estilo em graficos.css.

   Cores: duas famílias, validadas com o validador de paleta do dataviz (azul #0F5E8C e laranja #C65825: diferença de 17,8 para protanopia e 28,5 para visão normal):
   · azul  = ponto do atleta (winner e erro do adversário, em dois tons)
   · laranja = ponto do adversário (erro e winner do adversário, em dois tons)
   Os valores são sempre escritos ao lado das barras (nunca só a cor) e cada gráfico tem a versão em tabela. */
(function (raiz) {
  "use strict";
  var GANHO = "#0F5E8C", GANHO_CLARO = "#6FA8CB", PERDA = "#C65825", PERDA_CLARO = "#E3A27E", NEUTRO = "#B9C3BE";

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function n0(v) { v = Number(v); return isFinite(v) ? v : 0; }
  function pct(a, b) { return n0(b) > 0 ? Math.round(n0(a) * 100 / n0(b)) : 0; }
  function plural(n, um, varios) { return n + " " + (n === 1 ? um : varios); }

  function secao(id, titulo, nota, corpo, tab) {
    return '<section class="qg-sec" id="qg-' + id + '"><h2>' + esc(titulo) + "</h2>" + (nota ? '<p class="qg-nota">' + esc(nota) + "</p>" : "") + corpo + (tab || "") + "</section>";
  }
  function tabela(cab, linhas) {
    return '<details class="qg-tab"><summary>Ver como tabela</summary><div class="qg-tab-rolar"><table><thead><tr>' + cab.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      linhas.map(function (l) { return "<tr>" + l.map(function (c) { return "<td>" + esc(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div></details>";
  }
  function legenda(itens) { return '<p class="qg-leg">' + itens.map(function (i) { return '<span><i style="background:' + i[1] + '"></i>' + esc(i[0]) + "</span>"; }).join("") + "</p>"; }

  /* uma linha: rótulo, barra e valor escrito */
  function linha(rot, detalhe, larguraPct, cor, valor, aria) {
    var w = larguraPct > 0 ? Math.max(larguraPct, 2) : 0;
    return '<div class="qg-lin"><div class="qg-rot">' + esc(rot) + (detalhe ? "<small>" + esc(detalhe) + "</small>" : "") + '</div><div class="qg-trilho" role="img" aria-label="' + esc(aria || rot + ": " + valor) + '">' +
      '<div class="qg-barra" style="width:' + w + "%;background:" + cor + '"></div></div><div class="qg-val">' + esc(valor) + "</div></div>";
  }
  function linhaPct(rot, detalhe, p, cor) { return linha(rot, detalhe, p, cor, p + "%"); }
  /* barra empilhada: o comprimento total é proporcional ao volume (n); os pedaços mostram como esse volume se dividiu */
  function linhaEmpilhada(rot, detalhe, partes, total, maxTotal, valor, aria) {
    var larg = maxTotal > 0 ? Math.max((total / maxTotal) * 100, 3) : 0;
    return '<div class="qg-lin"><div class="qg-rot">' + esc(rot) + (detalhe ? "<small>" + esc(detalhe) + "</small>" : "") + '</div><div class="qg-trilho" role="img" aria-label="' + esc(aria) + '">' +
      '<div class="qg-pilha" style="width:' + larg.toFixed(1) + '%">' + partes.filter(function (x) { return x.v > 0; }).map(function (x) { return '<b style="flex:' + x.v + ";background:" + x.cor + '"></b>'; }).join("") + '</div></div><div class="qg-val">' + esc(valor) + "</div></div>";
  }
  function donut(p, cor) {
    var r = 42, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, p)), d = (c * v / 100).toFixed(1);
    return '<svg class="qg-donut" viewBox="0 0 110 110" role="img" aria-label="' + esc(v + "% dos pontos ganhos") + '"><circle cx="55" cy="55" r="' + r + '" fill="none" stroke="#E6ECE9" stroke-width="13"/>' +
      '<circle cx="55" cy="55" r="' + r + '" fill="none" stroke="' + cor + '" stroke-width="13" stroke-linecap="round" stroke-dasharray="' + d + " " + c.toFixed(1) + '" transform="rotate(-90 55 55)"/>' +
      '<text x="55" y="61" text-anchor="middle" font-size="24" font-weight="800" fill="#17251F">' + v + "%</text></svg>";
  }
  function tile(num, rot, detalhe) { return '<div class="qg-tile"><b>' + esc(num) + "</b><span>" + esc(rot) + "</span>" + (detalhe ? "<small>" + esc(detalhe) + "</small>" : "") + "</div>"; }

  /* painel do topo: donut dos pontos ganhos e os números que mais importam */
  function painelGeral(p) {
    var nm = p.numeros || {}, det = p.detalhe || {}, f = det.fins || {}, tiles = [];
    if (f.winner_nos != null && (f.winner_nos || f.erro_nos)) { tiles.push(tile(n0(f.winner_nos), "Winners de " + p.atleta)); tiles.push(tile(n0(f.erro_nos), "Erros de " + p.atleta, n0(nm.errosDecisao) + " decisão · " + n0(nm.errosExec) + " execução")); }
    if (n0(nm.pctPrimeiro)) tiles.push(tile(n0(nm.pctPrimeiro) + "%", "1º saque dentro"));
    if (n0(nm.aces) || n0(nm.acesAdv)) tiles.push(tile(n0(nm.aces), "Aces de " + p.atleta, "adversário: " + n0(nm.acesAdv)));
    return '<section class="qg-sec qg-topo" id="qg-geral"><div class="qg-geral"><div class="qg-geral-d">' + donut(n0(p.pctGanhos), GANHO) + '<p><strong>' + n0(p.ganhos) + " de " + n0(p.n) + "</strong> pontos ganhos por " + esc(p.atleta) + "</p></div>" +
      (tiles.length ? '<div class="qg-tiles">' + tiles.join("") + "</div>" : "") + "</div></section>";
  }

  var ROT_NIVEL = { iniciante: "Iniciante", intermediario: "Intermediário", avancado: "Avançado", competitivo: "Competitivo", elite: "Elite / profissional" };
  /* ficha do jogo: torneio e nível do adversário (preenchido no fim da partida) */
  function ficha(p) {
    var it = [];
    if (p.torneio) it.push(["Torneio", p.torneio]);
    if (ROT_NIVEL[p.nivelAdversario]) it.push(["Nível do adversário", ROT_NIVEL[p.nivelAdversario]]);
    if (!it.length) return "";
    return '<section class="qg-sec qg-ficha" id="qg-ficha">' + it.map(function (x) { return "<div><small>" + esc(x[0]) + "</small><b>" + esc(x[1]) + "</b></div>"; }).join("") + "</section>";
  }
  function observacao(p) {
    var t = String(p.observacaoFinal || "").trim();
    if (!t) return "";
    return '<section class="qg-sec qg-obs" id="qg-obs"><h2>Observação do treinador</h2><blockquote>' + esc(t) + "</blockquote></section>";
  }

  /* como os pontos terminaram */
  function comoTerminaram(p) {
    var f = (p.detalhe || {}).fins; if (!f) return "";
    var total = n0(f.winner_nos) + n0(f.erro_dele) + n0(f.erro_nos) + n0(f.winner_dele); if (!total) return "";
    var itens = [["Winner de " + p.atleta, n0(f.winner_nos), GANHO], ["Erro do adversário", n0(f.erro_dele), GANHO_CLARO], ["Erro de " + p.atleta, n0(f.erro_nos), PERDA], ["Winner do adversário", n0(f.winner_dele), PERDA_CLARO]];
    var max = Math.max.apply(null, itens.map(function (i) { return i[1]; }));
    return secao("fins", "Como os pontos terminaram", "Cada ponto marcado, pela forma como acabou.",
      '<div class="qg-grupo">' + itens.map(function (i) { return linha(i[0], "", max ? (i[1] / max) * 100 : 0, i[2], i[1] + " · " + pct(i[1], total) + "%", i[0] + ": " + plural(i[1], "ponto", "pontos") + ", " + pct(i[1], total) + "%"); }).join("") + "</div>" +
      legenda([["Ponto de " + p.atleta, GANHO], ["Ponto do adversário", PERDA]]),
      tabela(["Forma", "Pontos", "%"], itens.map(function (i) { return [i[0], i[1], pct(i[1], total) + "%"]; })));
  }

  /* saque dos dois lados */
  var ROT_DIR_SAQUE = { aberto: "Aberto", fechado: "Fechado", corpo: "Corpo" };
  function saque(p) {
    var nm = p.numeros || {}, det = p.detalhe || {}, sq = det.saqueDir || {}, cols = [], tab = [];
    [["nos", "Saque de " + p.atleta, GANHO, nm.pctPrimeiro, nm.aces, nm.df], ["ele", "Saque do adversário", PERDA, nm.pctPrimeiroAdv, nm.acesAdv, nm.dfAdv]].forEach(function (c) {
      var dirs = ["aberto", "fechado", "corpo"].filter(function (k) { return sq[c[0]] && n0(sq[c[0]][k].n); });
      if (!n0(c[3]) && !n0(c[4]) && !n0(c[5]) && !dirs.length) return;
      var h = '<div class="qg-col"><h3>' + esc(c[1]) + "</h3>";
      if (n0(c[3])) h += linhaPct("1º saque dentro", "", n0(c[3]), c[2]);
      h += '<div class="qg-mini"><span><b>' + n0(c[4]) + "</b> aces</span><span><b>" + n0(c[5]) + "</b> duplas faltas</span></div>";
      if (dirs.length) {
        h += '<p class="qg-sub">Pontos ganhos por quem sacou, por direção</p>' + dirs.map(function (k) {
          var d = sq[c[0]][k], g = pct(d.g, d.n);
          tab.push([c[1], ROT_DIR_SAQUE[k], d.n, d.a, g + "%"]);
          return linhaPct(ROT_DIR_SAQUE[k], plural(n0(d.n), "saque", "saques") + (n0(d.a) ? " · " + plural(n0(d.a), "ace", "aces") : ""), g, c[2]);
        }).join("");
      }
      cols.push(h + "</div>");
    });
    if (!cols.length) return "";
    return secao("saque", "Saque", "O saque dos dois lados: aproveitamento do primeiro saque, aces, duplas faltas e direção.", '<div class="qg-duas">' + cols.join("") + "</div>",
      tab.length ? tabela(["Sacador", "Direção", "Saques", "Aces", "Ganhos"], tab) : "");
  }

  /* lado da quadra: igualdade (direita) e vantagem (esquerda) */
  function lado(p) {
    var nm = p.numeros || {};
    var linhas = [["No saque de " + p.atleta + " · lado da igualdade", n0(nm.nSacD), n0(nm.pctSacD)], ["No saque de " + p.atleta + " · lado da vantagem", n0(nm.nSacE), n0(nm.pctSacE)],
      ["No saque do adversário · lado da igualdade", n0(nm.nDevD), n0(nm.pctDevD)], ["No saque do adversário · lado da vantagem", n0(nm.nDevE), n0(nm.pctDevE)]].filter(function (l) { return l[1] > 0; });
    if (!linhas.length) return "";
    return secao("lado", "Lado da quadra", "Pontos ganhos por " + p.atleta + " em cada lado, sacando e devolvendo. Igualdade é o lado direito; vantagem, o esquerdo.",
      '<div class="qg-grupo">' + linhas.map(function (l) { return linhaPct(l[0], plural(l[1], "ponto", "pontos"), l[2], GANHO); }).join("") + "</div>",
      tabela(["Situação", "Pontos", "Ganhos"], linhas.map(function (l) { return [l[0], l[1], l[2] + "%"]; })));
  }

  var ROT_SIT = { ataque: "Ataque", contra: "Contra-ataque", defesa: "Defesa", neutra: "Neutra", construcao: "Construção" };
  function situacoes(p) {
    var s = (p.detalhe || {}).situacoes; if (!s) return "";
    var ks = ["ataque", "contra", "defesa", "neutra", "construcao"].filter(function (k) { return s[k] && n0(s[k].n); });
    if (!ks.length) return "";
    return secao("situacoes", "Situação do ponto", "Como o ponto estava quando foi decidido e quanto " + p.atleta + " ganhou em cada situação.",
      '<div class="qg-grupo">' + ks.map(function (k) { return linhaPct(ROT_SIT[k], plural(n0(s[k].n), "ponto", "pontos"), pct(s[k].g, s[k].n), GANHO); }).join("") + "</div>",
      tabela(["Situação", "Pontos", "Ganhos"], ks.map(function (k) { return [ROT_SIT[k], s[k].n, pct(s[k].g, s[k].n) + "%"]; })));
  }

  var ROT_GOLPE = { forehand: "Forehand", backhand: "Backhand", voleio: "Voleio", smash: "Smash", drop: "Drop shot", lob: "Lob", devolucao: "Devolução" };
  function golpes(p) {
    var g = (p.detalhe || {}).golpes; if (!g) return "";
    var ks = ["forehand", "backhand", "voleio", "smash", "drop", "lob", "devolucao"].filter(function (k) { return g[k] && n0(g[k].n); });
    if (!ks.length) return "";
    var max = Math.max.apply(null, ks.map(function (k) { return n0(g[k].n); }));
    return secao("golpes", "Último golpe do ponto", "O golpe com que " + p.atleta + " terminou, ou errou, cada ponto. O comprimento da barra mostra o volume.",
      '<div class="qg-grupo">' + ks.map(function (k) {
        var d = g[k], outros = Math.max(0, n0(d.n) - n0(d.w) - n0(d.e));
        return linhaEmpilhada(ROT_GOLPE[k], n0(d.c) ? plural(n0(d.c), "bola na corrida", "bolas na corrida") : "", [{ v: n0(d.w), cor: GANHO }, { v: outros, cor: NEUTRO }, { v: n0(d.e), cor: PERDA }], n0(d.n), max, plural(n0(d.n), "ponto", "pontos"),
          ROT_GOLPE[k] + ": " + plural(n0(d.n), "ponto", "pontos") + ", " + plural(n0(d.w), "winner", "winners") + ", " + plural(n0(d.e), "erro", "erros") + ", " + plural(outros, "outro", "outros"));
      }).join("") + "</div>" + legenda([["Winners", GANHO], ["Outros", NEUTRO], ["Erros", PERDA]]),
      tabela(["Golpe", "Pontos", "Winners", "Erros", "Na corrida"], ks.map(function (k) { return [ROT_GOLPE[k], g[k].n, g[k].w, g[k].e, g[k].c]; })));
  }

  function direcao(p) {
    var d = (p.detalhe || {}).direcao || {}, cor = (p.detalhe || {}).corrida || {};
    var linhas = [["Cruzado", d.cruzado], ["Paralelo", d.paralelo]].filter(function (l) { return l[1] && n0(l[1].n); });
    if (!linhas.length && !n0(cor.n)) return "";
    var h = linhas.map(function (l) { return linhaPct(l[0], plural(n0(l[1].n), "ponto", "pontos") + (n0(l[1].c) ? " · " + n0(l[1].c) + " na corrida" : ""), pct(l[1].g, l[1].n), GANHO); }).join("");
    if (n0(cor.n)) h += linhaPct("Bolas na corrida", plural(n0(cor.n), "ponto", "pontos"), pct(cor.g, cor.n), GANHO);
    var tab = linhas.map(function (l) { return [l[0], l[1].n, pct(l[1].g, l[1].n) + "%"]; }); if (n0(cor.n)) tab.push(["Bolas na corrida", cor.n, pct(cor.g, cor.n) + "%"]);
    return secao("direcao", "Direção e bolas na corrida", "Pontos ganhos por " + p.atleta + " conforme a direção do último golpe e as bolas jogadas em deslocamento.", '<div class="qg-grupo">' + h + "</div>", tabela(["", "Pontos", "Ganhos"], tab));
  }

  var ROT_QUAL = { boa: "Boa", regular: "Regular", fraca: "Fraca" };
  function devolucao(p) {
    var d = (p.detalhe || {}).devolucao; if (!d || (!n0(d.nos.n) && !n0(d.ele.n))) return "";
    var a = n0(d.nos.e), b = n0(d.ele.e), q = d.nos.q || {};
    var ks = ["boa", "regular", "fraca"].filter(function (k) { return q[k] && n0(q[k].n); });
    var tot = ks.reduce(function (t, k) { return t + n0(q[k].n); }, 0);
    var corpo = '<div class="qg-tiles qg-tiles2">' + tile(a + " de " + n0(d.nos.n), "Erros de devolução de " + p.atleta, n0(d.nos.n) ? pct(a, d.nos.n) + "% dos pontos no saque do adversário" : "") +
      tile(b + " de " + n0(d.ele.n), "Erros de devolução do adversário", n0(d.ele.n) ? pct(b, d.ele.n) + "% dos pontos no saque de " + p.atleta : "") + "</div>";
    var tab = "";
    if (ks.length) {
      corpo += '<p class="qg-sub">Qualidade da devolução de ' + esc(p.atleta) + " e pontos ganhos em cada tipo (" + plural(tot, "devolução marcada", "devoluções marcadas") + ")</p>" +
        '<div class="qg-grupo">' + ks.map(function (k) { return linhaPct(ROT_QUAL[k], plural(n0(q[k].n), "ponto", "pontos") + " · " + pct(q[k].n, tot) + "% das devoluções", pct(q[k].g, q[k].n), GANHO); }).join("") + "</div>";
      tab = tabela(["Qualidade", "Pontos", "Ganhos"], ks.map(function (k) { return [ROT_QUAL[k], q[k].n, pct(q[k].g, q[k].n) + "%"]; }));
    }
    return secao("devolucao", "Devolução de saque", "Erros na primeira bola depois do saque do outro lado e a qualidade das devoluções que entraram.", corpo, tab);
  }

  /* o conjunto: cada função devolve "" quando não há dado marcado */
  function secoes(p) { return [comoTerminaram(p), saque(p), lado(p), situacoes(p), golpes(p), direcao(p), devolucao(p)].join(""); }
  function topo(p) { return ficha(p) + painelGeral(p) + observacao(p); }

  var api = { topo: topo, secoes: secoes, painelGeral: painelGeral, observacao: observacao, comoTerminaram: comoTerminaram, saque: saque, lado: lado, situacoes: situacoes, golpes: golpes, direcao: direcao, devolucao: devolucao, CORES: { ganho: GANHO, ganhoClaro: GANHO_CLARO, perda: PERDA, perdaClaro: PERDA_CLARO, neutro: NEUTRO } };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else raiz.QLScoutGraficos = api;
})(typeof window !== "undefined" ? window : this);
