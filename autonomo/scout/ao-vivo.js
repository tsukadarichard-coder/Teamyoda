/* Análise em tempo real durante a marcação do scout: alertas para o treinador decidir na hora, a evolução ponto a ponto e game a game.
   Recebe só a lista de pontos já marcados (o mesmo formato do scout: nos, fim, saque, sacador, bola, causa, adverso, dec, jogo...) e devolve HTML.
   Usado pelos apps do treinador (QuadraLab autônomo e Team Yoda) e pelo scout do responsável/treinador no Competição.
   Cores: azul = ponto do atleta, laranja = ponto do adversário. Todo texto vindo dos dados passa por esc(). Estilo em ao-vivo.css. */
(function (raiz) {
  "use strict";
  var AZUL = "#0F5E8C", LARANJA = "#C65825", GRAFITE = "#5B6B63", LINHA = "#E2E8E5";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function pct(a, b) { return b > 0 ? Math.round(a * 100 / b) : 0; }
  function ganhos(l) { return l.filter(function (p) { return p.nos; }).length; }

  /* sequência atual: quantos pontos seguidos o mesmo lado ganhou, contando do último */
  function sequencia(pontos) {
    var n = 0, lado = null;
    for (var i = pontos.length - 1; i >= 0; i--) { if (lado === null) lado = !!pontos[i].nos; if (!!pontos[i].nos !== lado) break; n++; }
    return { n: n, nos: lado };
  }

  /* alertas, do mais urgente ao menos: { nivel: "atencao" | "ok", texto } */
  function alertas(pontos, atleta) {
    var A = esc(atleta || "o jogador"), out = [], n = pontos.length;
    if (n < 4) return out;
    var seq = sequencia(pontos), ult10 = pontos.slice(-10), g10 = ganhos(ult10);
    if (seq.nos === false && seq.n >= 4) out.push({ p: 1, nivel: "atencao", texto: "Perdeu os últimos " + seq.n + " pontos seguidos. Momento de respirar, resetar e simplificar o próximo ponto." });
    else if (seq.nos === true && seq.n >= 4) out.push({ p: 6, nivel: "ok", texto: "Ganhou os últimos " + seq.n + " pontos seguidos. Mantenha o padrão que está funcionando." });
    if (n >= 10 && g10 <= 3 && !(seq.nos === false && seq.n >= 4)) out.push({ p: 2, nivel: "atencao", texto: "Só " + g10 + " dos últimos 10 pontos. O adversário está ditando o jogo." });
    else if (n >= 10 && g10 >= 7 && !(seq.nos === true && seq.n >= 4)) out.push({ p: 7, nivel: "ok", texto: g10 + " dos últimos 10 pontos ganhos: bom momento." });
    var meus = pontos.filter(function (p) { return p.sacador === "nos"; }), com1 = meus.filter(function (p) { return p.saque === "1" || p.saque === "2" || p.saque === "df" || p.saque === "ace"; });
    var primeiros = com1.filter(function (p) { return p.saque === "1" || p.saque === "ace"; }).length;
    if (com1.length >= 8 && pct(primeiros, com1.length) < 50) out.push({ p: 3, nivel: "atencao", texto: "1º saque dentro em " + pct(primeiros, com1.length) + "% (" + primeiros + " de " + com1.length + "). Vale pedir mais margem e direção no primeiro saque." });
    var df = pontos.filter(function (p) { return p.saque === "df" && p.sacador === "nos"; }).length;
    if (df >= 3) out.push({ p: 3, nivel: "atencao", texto: df + " duplas faltas até agora. O segundo saque está custando pontos." });
    var erros = pontos.filter(function (p) { return p.fim === "erro_nos"; }), curtos = erros.filter(function (p) { return p.bola === "1-2"; });
    if (erros.length >= 4 && pct(curtos.length, erros.length) >= 50) out.push({ p: 4, nivel: "atencao", texto: pct(curtos.length, erros.length) + "% dos erros de " + A + " estão nas duas primeiras bolas: o ponto se perde na entrada." });
    var dec = erros.filter(function (p) { return p.causa === "decisao"; }).length, ex = erros.filter(function (p) { return p.causa === "execucao"; }).length;
    if (dec + ex >= 4) { if (dec >= ex * 1.5) out.push({ p: 4, nivel: "atencao", texto: "A maioria dos erros é de decisão (" + dec + " de " + (dec + ex) + "). Peça para simplificar a escolha de jogada." }); else if (ex >= dec * 1.5) out.push({ p: 5, nivel: "atencao", texto: "A maioria dos erros é de execução (" + ex + " de " + (dec + ex) + "). Peça mais margem, bola mais alta e profunda." }); }
    var adv = pontos.filter(function (p) { return p.adverso; });
    if (adv.length >= 5 && pct(ganhos(adv), adv.length) < 35) out.push({ p: 3, nivel: "atencao", texto: "Cai sob pressão: só " + ganhos(adv) + " de " + adv.length + " pontos em placar adverso." });
    var sd = pontos.filter(function (p) { return p.sacador === "ele"; });
    if (sd.length >= 8 && pct(ganhos(sd), sd.length) < 30) out.push({ p: 4, nivel: "atencao", texto: "Devolução rende pouco: ganhou " + pct(ganhos(sd), sd.length) + "% dos pontos no saque do adversário." });
    var sacD = meus.filter(function (p) { return p.lado === "D"; }), sacE = meus.filter(function (p) { return p.lado === "E"; });
    if (sacD.length >= 6 && sacE.length >= 6 && Math.abs(pct(ganhos(sacD), sacD.length) - pct(ganhos(sacE), sacE.length)) >= 25) {
      var pior = pct(ganhos(sacD), sacD.length) < pct(ganhos(sacE), sacE.length) ? "igualdade" : "vantagem";
      out.push({ p: 5, nivel: "atencao", texto: "No saque de " + A + ", o lado da " + pior + " rende bem menos (" + pct(ganhos(sacD), sacD.length) + "% na igualdade, " + pct(ganhos(sacE), sacE.length) + "% na vantagem)." });
    }
    var decs = pontos.filter(function (p) { return p.dec; }).slice(-8), ruins = decs.filter(function (p) { return p.dec === "ruim"; }).length;
    if (decs.length >= 5 && ruins >= 3) out.push({ p: 2, nivel: "atencao", texto: ruins + " das últimas " + decs.length + " decisões avaliadas foram ruins. Converse sobre a escolha de jogada." });
    var aten = out.filter(function (a) { return a.nivel === "atencao"; }).sort(function (a, b) { return a.p - b.p; }), ok = out.filter(function (a) { return a.nivel === "ok"; });
    return aten.concat(ok);
  }

  /* gráfico: saldo de pontos (ganhos menos perdidos) a cada ponto, com a divisão dos games */
  function saldo(pontos) {
    var n = pontos.length; if (n < 2) return "";
    var W = 340, H = 150, L = 28, Rr = 10, T = 10, B = 22, s = 0, v = [0];
    pontos.forEach(function (p) { s += p.nos ? 1 : -1; v.push(s); });
    var mx = Math.max(3, Math.max.apply(null, v.map(Math.abs))), x = function (i) { return L + (W - L - Rr) * i / n; }, y = function (val) { return T + (H - T - B) * (1 - (val + mx) / (2 * mx)); };
    var g = '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + y(0) + '" y2="' + y(0) + '" stroke="' + GRAFITE + '" stroke-dasharray="4 3"/>' +
      '<text x="' + (L - 4) + '" y="' + (y(mx) + 3) + '" text-anchor="end" font-size="9" fill="' + GRAFITE + '">+' + mx + '</text><text x="' + (L - 4) + '" y="' + (y(-mx) + 3) + '" text-anchor="end" font-size="9" fill="' + GRAFITE + '">−' + mx + "</text>";
    var ant = null;
    pontos.forEach(function (p, i) { if (p.jogo && p.jogo !== ant) { if (ant !== null) g += '<line x1="' + x(i).toFixed(1) + '" x2="' + x(i).toFixed(1) + '" y1="' + T + '" y2="' + (H - B) + '" stroke="' + LINHA + '"/>'; g += '<text x="' + (x(i) + 2).toFixed(1) + '" y="' + (H - 8) + '" font-size="8.5" fill="' + GRAFITE + '">G' + p.jogo + "</text>"; ant = p.jogo; } });
    /* área acima de zero em azul, abaixo em laranja, por segmentos */
    for (var i = 0; i < n; i++) { g += '<line x1="' + x(i).toFixed(1) + '" y1="' + y(v[i]).toFixed(1) + '" x2="' + x(i + 1).toFixed(1) + '" y2="' + y(v[i + 1]).toFixed(1) + '" stroke="' + (v[i + 1] >= 0 ? AZUL : LARANJA) + '" stroke-width="2.4" stroke-linecap="round"/>'; }
    g += '<circle cx="' + x(n).toFixed(1) + '" cy="' + y(v[n]).toFixed(1) + '" r="4" fill="' + (v[n] >= 0 ? AZUL : LARANJA) + '" stroke="#fff" stroke-width="1.5"/><text x="' + (x(n) - 6).toFixed(1) + '" y="' + (y(v[n]) - 7).toFixed(1) + '" text-anchor="end" font-size="10" font-weight="700" fill="#17251F">' + (v[n] > 0 ? "+" : v[n] < 0 ? "−" : "") + Math.abs(v[n]) + "</text>";
    return '<svg viewBox="0 0 ' + W + " " + H + '" class="qa-svg" role="img" aria-label="Saldo de pontos ao longo da partida: ' + (v[n] > 0 ? "+" : v[n] < 0 ? "−" : "") + Math.abs(v[n]) + '">' + g + "</svg>";
  }
  /* faixa dos últimos 24 pontos: azul ganhou, laranja perdeu; borda marca erro do atleta */
  function faixa(pontos) {
    var ult = pontos.slice(-24); if (!ult.length) return "";
    return '<div class="qa-faixa" role="img" aria-label="Últimos ' + ult.length + ' pontos: ' + ganhos(ult) + ' ganhos">' + ult.map(function (p) { return '<i style="background:' + (p.nos ? AZUL : LARANJA) + '" title="' + esc((p.nos ? "Ganhou" : "Perdeu") + " · ponto " + (p.n || "")) + '">' + (p.fim === "erro_nos" ? "×" : p.fim === "winner_nos" ? "★" : "") + "</i>"; }).join("") + "</div>";
  }
  /* game a game: ganhos x perdidos, decisões e mental */
  function games(pontos, mental) {
    var mapa = {}, ordem = [];
    pontos.forEach(function (p) { if (!p.jogo) return; if (!mapa[p.jogo]) { mapa[p.jogo] = []; ordem.push(p.jogo); } mapa[p.jogo].push(p); });
    if (ordem.length < 1) return "";
    var max = Math.max.apply(null, ordem.map(function (j) { return mapa[j].length; })), mj = (mental && mental.jogo) || {};
    return '<div class="qa-games">' + ordem.map(function (j, k) {
      var l = mapa[j], g = ganhos(l), pd = l.length - g, atual = k === ordem.length - 1;
      var dec = ["boa", "disc", "ruim"].map(function (t) { return l.filter(function (p) { return p.dec === t; }).length; });
      var det = [dec[0] ? dec[0] + " boa" + (dec[0] > 1 ? "s" : "") : "", dec[1] ? dec[1] + " discutível" : "", dec[2] ? dec[2] + " ruim" : "", mj[j] ? "mental " + mj[j] + "/5" : ""].filter(Boolean).join(" · ");
      return '<div class="qa-game' + (atual ? " atual" : "") + '"><span class="qa-g">G' + j + (atual ? " ·" : "") + '</span><div class="qa-barra" style="width:' + Math.max(l.length / max * 100, 12).toFixed(0) + '%"><b style="flex:' + (g || 0.0001) + ";background:" + AZUL + '">' + (g ? g : "") + '</b><b style="flex:' + (pd || 0.0001) + ";background:" + LARANJA + '">' + (pd ? pd : "") + "</b></div><span class=\"qa-v\">" + pct(g, l.length) + "%</span>" + (det ? '<small>' + esc(det) + "</small>" : "") + "</div>";
    }).join("") + "</div>";
  }
  function numeros(pontos) {
    var n = pontos.length, g = ganhos(pontos), meus = pontos.filter(function (p) { return p.sacador === "nos"; }), p1 = meus.filter(function (p) { return p.saque === "1" || p.saque === "ace"; }).length, c1 = meus.filter(function (p) { return p.saque === "1" || p.saque === "2" || p.saque === "df" || p.saque === "ace"; }).length;
    var er = pontos.filter(function (p) { return p.fim === "erro_nos"; }), dec = er.filter(function (p) { return p.causa === "decisao"; }).length, df = meus.filter(function (p) { return p.saque === "df"; }).length, w = pontos.filter(function (p) { return p.fim === "winner_nos"; }).length;
    function t(v, r) { return '<div class="qa-n"><b>' + v + "</b><span>" + r + "</span></div>"; }
    return '<div class="qa-nums">' + t(pct(g, n) + "%", "pontos ganhos") + t(c1 ? pct(p1, c1) + "%" : "—", "1º saque dentro") + t(w, "winners") + t(er.length, "erros (" + dec + " de decisão)") + t(df, "duplas faltas") + "</div>";
  }

  function painel(pontos, o) {
    o = o || {}; pontos = pontos || [];
    if (!pontos.length) return '<div class="qa"><p class="qa-vazio">A análise aparece a partir do primeiro ponto marcado.</p></div>';
    var al = alertas(pontos, o.atleta), seq = sequencia(pontos), h = '<div class="qa">';
    h += '<h3>Agora</h3>' + numeros(pontos);
    h += '<h3>O que a partida pede</h3>' + (al.length ? '<ul class="qa-al">' + al.map(function (a) { return '<li class="' + a.nivel + '">' + a.texto + "</li>"; }).join("") + "</ul>" : '<p class="qa-vazio">' + (pontos.length < 4 ? "Poucos pontos ainda. Os alertas começam a aparecer a partir do 4º ponto." : "Nada fora do esperado até aqui.") + "</p>");
    h += '<h3>Ponto a ponto</h3><p class="qa-sub">Saldo de pontos (ganhos menos perdidos)' + (seq.n >= 3 ? " · sequência atual: " + seq.n + (seq.nos ? " ganhos" : " perdidos") : "") + "</p>" + saldo(pontos) + faixa(pontos) + '<p class="qa-leg"><span><i style="background:' + AZUL + '"></i>ponto do atleta</span><span><i style="background:' + LARANJA + '"></i>ponto do adversário</span><span>★ winner · × erro</span></p>';
    var gm = games(pontos, o.mental); if (gm) h += '<h3>Game a game</h3><p class="qa-sub">Pontos ganhos e perdidos em cada game</p>' + gm;
    return h + "</div>";
  }
  /* uma linha com o alerta mais urgente, para ficar sempre visível sob o placar */
  function faixaAlerta(pontos, atleta) {
    var al = alertas(pontos || [], atleta); if (!al.length) return "";
    return '<div class="qa-topo ' + al[0].nivel + '" role="status"><b>' + (al[0].nivel === "atencao" ? "Atenção" : "Bom sinal") + "</b> " + al[0].texto + "</div>";
  }
  var api = { alertas: alertas, painel: painel, faixaAlerta: faixaAlerta, sequencia: sequencia };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else raiz.QLAoVivo = api;
})(typeof window !== "undefined" ? window : this);
