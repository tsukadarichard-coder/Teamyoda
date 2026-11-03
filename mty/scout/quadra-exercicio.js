/* Quadra animada dos exercícios · Tecnologia QuadraLab.
   O mesmo desenho do Simulador de Decisões (decisoes/app.js): quadra de simples vista de cima em metros, bola com sombra que cresce
   com a altura, rastro pontilhado, marca no quique e o deslocamento dos jogadores em tracejado com seta. Aqui a quadra fica deitada
   (o atleta à esquerda, quem alimenta à direita) para caber no cartão do exercício.
   Cada exercício tem um roteiro (scout/exercicios-quadra.js): onde cada um começa, alvos, cones e cesto, e a sequência de bolas:
     { atores: { A: [x, y], T: [x, y], P: [x, y] }, alvos: [{ x1, y1, x2, y2, rot }], cones: [[x, y]], cesto: [x, y],
       lances: [{ de: "T", quique: [x, y], txt, mover: { A: [x, y] }, fim, direto, v, apice, h0, hK, para }], ciclo: true, resumo }
   Coordenadas como no Simulador: x de -4,115 a 4,115 (o forehand de quem está embaixo, destro, fica em x > 0), y de -11,885 (linha de
   base do atleta) a 11,885; rede em y = 0. A = atleta (laranja), T = treinador, P = parceiro (verde-escuro).
   QLQuadraExercicio.registrar({ codigo: roteiro }) · tem(codigo) · roteiro(codigo) · montar(el, codigo, opts) → { parar() }
   QLQuadraExercicio.svgEstatico(codigo) → SVG (texto) com todas as bolas numeradas, para PDF e impressão.
   Este arquivo é igual em autonomo/scout e mty/scout. */
(function (raiz, fab) {
  if (typeof module === "object" && module.exports) module.exports = fab();
  else raiz.QLQuadraExercicio = fab();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var L = 11.885, W = 4.115, S = 6.4, LENTO = 1.8, QUADRO = 1 / 30;
  var COR = { quadra: "#3A7B56", fora: "#2A5E43", atleta: "#E8691F", outro: "#0D3328", bola: "#E4F542", rastro: "#F4FF8A", jog: "#F38A3F", adv: "#0B2A21" };
  var NOME = { A: "Atleta", T: "Treinador", P: "Parceiro", D: "Parceiro de dupla", O: "Adversário", Q: "Adversário" };
  var W2 = 5.485; /* quadra de duplas */
  function corDe(k) { return k === "A" ? COR.atleta : k === "D" ? "#C2561E" : COR.outro; }
  var ROTEIROS = {};
  var SVGNS = "http://www.w3.org/2000/svg";

  function registrar(obj) { for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) ROTEIROS[k] = obj[k]; }
  function tem(c) { return !!ROTEIROS[c]; }
  function roteiro(c) { return ROTEIROS[c] || null; }

  /* ── geometria e trajetórias (as mesmas contas do motor do Simulador) ── */
  function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }
  function lerp(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; }
  function arco(h0, h1, apice) {
    apice = Math.max(apice, h0 + 0.05, h1 + 0.05);
    var lo = 0, hi = 20, A = 0;
    for (var i = 0; i < 40; i++) {
      A = (lo + hi) / 2;
      var mx = 0; for (var s = 0; s <= 1.0001; s += 0.02) mx = Math.max(mx, h0 * (1 - s) + h1 * s + 4 * A * s * (1 - s));
      if (mx > apice) hi = A; else lo = A;
    }
    return function (s) { return h0 * (1 - s) + h1 * s + 4 * A * s * (1 - s); };
  }
  function voo(P, h0, Q, K, hK, apice, v, t0) {
    var d1 = dist(P, Q), d2 = dist(Q, K), t1 = d1 / v * LENTO, t2 = d2 / (v * 0.72) * LENTO;
    var a1 = arco(h0, 0, apice), a2 = arco(0, hK, Math.max(hK + 0.3, apice * 0.45)), q = [], t, s, p;
    for (t = 0; t < t1; t += QUADRO) { s = t / t1; p = lerp(P, Q, s); q.push({ t: t0 + t, x: p[0], y: p[1], h: a1(s) }); }
    q.push({ t: t0 + t1, x: Q[0], y: Q[1], h: 0, quique: true });
    for (t = QUADRO; t < t2; t += QUADRO) { s = t / t2; p = lerp(Q, K, s); q.push({ t: t0 + t1 + t, x: p[0], y: p[1], h: a2(s) }); }
    q.push({ t: t0 + t1 + t2, x: K[0], y: K[1], h: hK });
    return { quadros: q, tQuique: t0 + t1, tFim: t0 + t1 + t2 };
  }
  /* sem quique do lado de quem recebe (voleio, smash): de P direto até K */
  function direto(P, h0, K, hK, apice, v, t0) {
    var d = dist(P, K), t1 = d / v * LENTO, a = arco(h0, hK, apice), q = [];
    for (var t = 0; t < t1; t += QUADRO) { var s = t / t1, p = lerp(P, K, s); q.push({ t: t0 + t, x: p[0], y: p[1], h: a(s) }); }
    q.push({ t: t0 + t1, x: K[0], y: K[1], h: hK });
    return { quadros: q, tQuique: null, tFim: t0 + t1 };
  }
  function posEm(lista, t) {
    if (!lista.length) return null;
    if (t <= lista[0].t) return [lista[0].x, lista[0].y];
    for (var i = 1; i < lista.length; i++) { var a = lista[i - 1], b = lista[i]; if (t <= b.t) { var k = (t - a.t) / ((b.t - a.t) || 1); return [a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k]; } }
    var u = lista[lista.length - 1]; return [u.x, u.y];
  }
  function bolaEm(q, t) {
    if (!q.length || t < q[0].t) return null;
    for (var i = 1; i < q.length; i++) if (t <= q[i].t) { var a = q[i - 1], b = q[i], k = (t - a.t) / ((b.t - a.t) || 1); return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, h: a.h + (b.h - a.h) * k }; }
    return null;
  }

  /* roteiro → linha do tempo: a bola de cada lance, o deslocamento de cada um e a marca de cada quique */
  function construir(d) {
    var pos = {}, trilhas = {}, lances = [], t = 0, k;
    for (k in d.atores) { pos[k] = d.atores[k].slice(); trilhas[k] = [{ t: 0, x: pos[k][0], y: pos[k][1] }]; }
    (d.lances || []).forEach(function (l, i) {
      var P = pos[l.de] ? pos[l.de].slice() : [0, 0], novo = {};
      for (k in pos) novo[k] = pos[k].slice();
      for (k in (l.mover || {})) if (novo[k]) novo[k] = l.mover[k].slice();
      if (l.semBola) { /* só deslocamento (spider, triângulo, circuito): a 5 m/s, no ritmo lento da animação */
        var maior = 0; for (k in (l.mover || {})) if (pos[k]) maior = Math.max(maior, dist(pos[k], novo[k]));
        var tf = t + Math.max(0.6, maior / 5 * LENTO * 0.6);
        for (k in (l.mover || {})) if (trilhas[k]) { trilhas[k].push({ t: t + 0.05, x: pos[k][0], y: pos[k][1] }); trilhas[k].push({ t: tf, x: novo[k][0], y: novo[k][1] }); }
        lances.push({ n: i + 1, txt: l.txt || "", de: l.de || "A", t0: t, t1: tf, quadros: [], tQuique: null, quique: null, fim: true, semBola: true });
        pos = novo; t = tf + (l.pausa != null ? l.pausa : 0.25);
        return;
      }
      var prox = d.lances[i + 1] || (d.ciclo ? d.lances[0] : null);
      var receptor = l.para !== undefined ? l.para : (prox && prox.de !== l.de ? prox.de : null);
      var tipo = l.tipo || "";
      var v = l.v || (l.de === "T" && !tipo ? 9 : tipo === "saque" ? 22 : tipo === "smash" ? 20 : 13);
      var h0 = l.h0 != null ? l.h0 : tipo === "saque" ? 2.7 : tipo === "smash" ? 2.8 : 1;
      var hK = l.hK != null ? l.hK : 1, apice = l.apice != null ? l.apice : tipo === "saque" || tipo === "smash" ? 2.9 : 2.2;
      var K, b;
      if (l.direto) { K = receptor && !l.fim ? novo[receptor] : l.quique; b = direto(P, h0, K, hK, apice, v, t); }
      else {
        var Q = l.quique;
        if (receptor && !l.fim) K = novo[receptor];
        else { var dx = Q[0] - P[0], dy = Q[1] - P[1], n = Math.hypot(dx, dy) || 1; K = [Q[0] + dx / n * 3, Q[1] + dy / n * 3]; hK = 0.5; }
        b = voo(P, h0, Q, K, hK, apice, v, t);
      }
      for (k in (l.mover || {})) if (trilhas[k]) { trilhas[k].push({ t: t + 0.05, x: pos[k][0], y: pos[k][1] }); trilhas[k].push({ t: b.tFim, x: novo[k][0], y: novo[k][1] }); }
      lances.push({ n: i + 1, txt: l.txt || "", de: l.de, t0: t, t1: b.tFim, quadros: b.quadros, tQuique: b.tQuique, quique: l.direto ? null : l.quique, fim: !receptor || !!l.fim });
      pos = novo; t = b.tFim + (l.pausa != null ? l.pausa : 0.25);
    });
    return { dur: t, lances: lances, trilhas: trilhas, inicio: d.atores };
  }

  /* ── desenho (quadra deitada: X da tela = y da quadra, Y da tela = x da quadra) ── */
  var VB = { x: -15.4, y: -6.4, w: 30.8, h: 12.8 };
  function T(p) { return [p[1], p[0]]; }
  function el(nome, attrs, pai) { var e = document.createElementNS(SVGNS, nome); for (var a in attrs) if (attrs[a] != null) e.setAttribute(a, attrs[a]); if (pai) pai.appendChild(e); return e; }
  function pts(lista) { return lista.map(function (p) { var q = T(p); return q[0].toFixed(2) + "," + q[1].toFixed(2); }).join(" "); }

  /* SVG da quadra com as camadas (em texto, para servir também ao PDF) */
  function quadraTexto(d, uid) {
    var WQ = d.duplas ? W2 : W;
    var s = '<svg xmlns="' + SVGNS + '" viewBox="' + VB.x + " " + VB.y + " " + VB.w + " " + VB.h + '" class="qe-svg" role="img" aria-label="' + esc(d.resumo || "Quadra do exercício vista de cima") + '">' +
      '<defs><marker id="' + uid + 'j" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="' + COR.jog + '"/></marker>' +
      '<marker id="' + uid + 'a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#FFFFFF"/></marker></defs>' +
      '<rect x="' + VB.x + '" y="' + VB.y + '" width="' + VB.w + '" height="' + VB.h + '" fill="' + COR.fora + '"/>' +
      '<rect x="' + (-L - 0.6) + '" y="' + (-WQ - 0.75) + '" width="' + (2 * L + 1.2) + '" height="' + (2 * WQ + 1.5) + '" fill="' + COR.quadra + '" rx="0.2"/>' +
      '<g stroke="#FFFFFF" stroke-width="0.09" fill="none" stroke-linecap="square"><rect x="' + -L + '" y="' + -W + '" width="' + 2 * L + '" height="' + 2 * W + '"/>' +
      (d.duplas ? '<rect x="' + -L + '" y="' + -W2 + '" width="' + 2 * L + '" height="' + 2 * W2 + '"/>' : "") +
      '<line x1="' + -S + '" y1="' + -W + '" x2="' + -S + '" y2="' + W + '"/><line x1="' + S + '" y1="' + -W + '" x2="' + S + '" y2="' + W + '"/><line x1="' + -S + '" y1="0" x2="' + S + '" y2="0"/>' +
      '<line x1="' + -L + '" y1="0" x2="' + (-L + 0.3) + '" y2="0"/><line x1="' + L + '" y1="0" x2="' + (L - 0.3) + '" y2="0"/></g>' +
      '<line x1="0" y1="' + (-WQ - 0.75) + '" x2="0" y2="' + (WQ + 0.75) + '" stroke="' + COR.adv + '" stroke-width="0.16"/><line x1="0" y1="' + (-WQ - 0.75) + '" x2="0" y2="' + (WQ + 0.75) + '" stroke="#FFFFFF" stroke-width="0.05" stroke-dasharray="0.12 0.12"/>' +
      '<circle cx="0" cy="' + (-WQ - 0.75) + '" r="0.14" fill="' + COR.adv + '"/><circle cx="0" cy="' + (WQ + 0.75) + '" r="0.14" fill="' + COR.adv + '"/>';
    /* alvos, cones e cesto */
    (d.alvos || []).forEach(function (a) {
      var p1 = T([Math.min(a.x1, a.x2), Math.min(a.y1, a.y2)]), p2 = T([Math.max(a.x1, a.x2), Math.max(a.y1, a.y2)]);
      s += '<g class="qe-alvo"><rect x="' + p1[0] + '" y="' + p1[1] + '" width="' + (p2[0] - p1[0]) + '" height="' + (p2[1] - p1[1]) + '" fill="rgba(244,255,138,.2)" stroke="' + COR.rastro + '" stroke-width="0.07" stroke-dasharray="0.25 0.18"/>' +
        (a.rot ? '<text x="' + ((p1[0] + p2[0]) / 2) + '" y="' + ((p1[1] + p2[1]) / 2 + 0.22) + '" text-anchor="middle" font-size="0.72" font-weight="700" fill="#FFFFFF" font-family="system-ui,sans-serif">' + esc(a.rot) + "</text>" : "") + "</g>";
    });
    (d.cones || []).forEach(function (c) { var p = T(c); s += '<path d="M' + (p[0] - 0.32) + "," + (p[1] + 0.28) + " L" + p[0] + "," + (p[1] - 0.36) + " L" + (p[0] + 0.32) + "," + (p[1] + 0.28) + ' z" fill="#FF8A1F" stroke="#FFFFFF" stroke-width="0.05"/>'; });
    if (d.cesto) { var c = T(d.cesto); s += '<rect x="' + (c[0] - 0.4) + '" y="' + (c[1] - 0.4) + '" width="0.8" height="0.8" rx="0.12" fill="#B8864B" stroke="#FFFFFF" stroke-width="0.06"/><circle cx="' + c[0] + '" cy="' + c[1] + '" r="0.18" fill="' + COR.bola + '"/>'; }
    s += '<g class="qe-rastros"></g><g class="qe-marcas"></g><g class="qe-jogadores"></g><g class="qe-bola"></g></svg>';
    return s;
  }
  function esc(x) { return String(x == null ? "" : x).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function jogadorTexto(k, p) {
    var q = T(p), cor = corDe(k);
    return '<g class="qe-j" data-ator="' + k + '" transform="translate(' + q[0].toFixed(3) + "," + q[1].toFixed(3) + ')"><circle r="0.78" fill="' + cor + '" stroke="#FFFFFF" stroke-width="0.13"/>' +
      '<text y="0.3" text-anchor="middle" font-size="0.86" font-weight="800" fill="#FFFFFF" font-family="system-ui,sans-serif">' + k + "</text></g>";
  }
  function marcaTexto(p, n) {
    var q = T(p);
    return '<g><circle cx="' + q[0] + '" cy="' + q[1] + '" r="0.32" fill="none" stroke="' + COR.rastro + '" stroke-width="0.08"/>' +
      '<line x1="' + (q[0] - 0.18) + '" y1="' + (q[1] - 0.18) + '" x2="' + (q[0] + 0.18) + '" y2="' + (q[1] + 0.18) + '" stroke="' + COR.rastro + '" stroke-width="0.07"/>' +
      '<line x1="' + (q[0] - 0.18) + '" y1="' + (q[1] + 0.18) + '" x2="' + (q[0] + 0.18) + '" y2="' + (q[1] - 0.18) + '" stroke="' + COR.rastro + '" stroke-width="0.07"/>' +
      (n ? '<circle cx="' + (q[0] + 0.7) + '" cy="' + (q[1] - 0.7) + '" r="0.5" fill="#0B2A21" stroke="' + COR.rastro + '" stroke-width="0.06"/><text x="' + (q[0] + 0.7) + '" y="' + (q[1] - 0.5) + '" text-anchor="middle" font-size="0.6" font-weight="800" fill="' + COR.rastro + '" font-family="system-ui,sans-serif">' + n + "</text>" : "") + "</g>";
  }
  function rastroTexto(lista, estilo, uid) {
    if (lista.length < 2) return "";
    if (estilo === "bola") return '<polyline points="' + pts(lista) + '" fill="none" stroke="' + COR.rastro + '" stroke-width="0.1" stroke-dasharray="0.02 0.26" stroke-linecap="round"/>';
    var cor = estilo === "A" ? COR.jog : "#FFFFFF";
    return '<polyline points="' + pts(lista) + '" fill="none" stroke="' + cor + '" stroke-width="0.13" stroke-dasharray="0.5 0.3" opacity="' + (estilo === "A" ? 1 : 0.8) + '" marker-end="url(#' + uid + (estilo === "A" ? "j" : "a") + ')"/>';
  }
  function trechoAte(q, t) { var out = []; for (var i = 0; i < q.length; i++) { if (q[i].t > t) break; out.push([q[i].x, q[i].y]); } return out; }
  function amostraTrilha(lista, t) {
    var out = [], ultimo = null;
    for (var u = 0; u <= t + 0.0001; u += 0.1) { var p = posEm(lista, u); if (!ultimo || dist(p, ultimo) > 0.02) { out.push(p); ultimo = p; } }
    return out;
  }

  /* desenho completo, parado: todas as bolas com número, os deslocamentos e todos na posição inicial */
  function svgEstatico(codigo, uid, dd) {
    var d = dd || roteiro(codigo); if (!d) return "";
    uid = uid || "qe" + Math.random().toString(36).slice(2, 7);
    var tl = construir(d), s = quadraTexto(d, uid), extra = "", k;
    tl.lances.forEach(function (l) {
      /* bolas do atleta em amarelo; as de quem alimenta ou devolve, em branco mais claro */
      if (l.semBola) return;
      var doAtleta = l.de === "A" || l.de === "D";
      extra += '<polyline points="' + pts(l.quadros.map(function (q) { return [q.x, q.y]; })) + '" fill="none" stroke="' + (doAtleta ? COR.rastro : "#FFFFFF") + '" stroke-width="' + (doAtleta ? 0.11 : 0.08) + '" stroke-dasharray="0.3 0.22" opacity="' + (doAtleta ? 0.95 : 0.55) + '"/>';
      if (l.quique) extra += marcaTexto(l.quique, l.n);
    });
    for (k in tl.trilhas) { var tr = tl.trilhas[k]; if (tr.length > 1) { var lista = []; tr.forEach(function (p) { lista.push([p.x, p.y]); }); var dd = 0; for (var i = 1; i < lista.length; i++) dd += dist(lista[i], lista[i - 1]); if (dd > 0.6) extra += rastroTexto(lista, k === "A" ? "A" : "o", uid); } }
    for (k in d.atores) extra += jogadorTexto(k, d.atores[k]);
    return s.replace('<g class="qe-rastros"></g>', '<g class="qe-rastros">' + extra + "</g>");
  }

  /* ── tela: quadra + Reproduzir/Pausar + Do início + velocidade + o que está acontecendo ── */
  var reduzir = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  function montar(host, codigo, opts) {
    opts = opts || {};
    var d = roteiro(codigo);
    if (!d || !host) return { parar: function () {} };
    if (!d.resumo && opts.resumo) d = Object.assign({}, d, { resumo: opts.resumo });
    var uid = "qe" + Math.random().toString(36).slice(2, 7), tl = construir(d);
    var atores = Object.keys(d.atores);
    host.classList.add("qe");
    host.innerHTML = '<div class="qe-quadra">' + svgEstatico(codigo, uid, d) + "</div>" +
      '<div class="qe-ctl"><button type="button" class="qe-play" aria-label="Reproduzir">▶ Reproduzir</button><button type="button" class="qe-reini" aria-label="Voltar ao início">↺</button>' +
      '<label class="qe-vel">Velocidade <select aria-label="Velocidade"><option value="0.5">0,5×</option><option value="1" selected>1×</option><option value="1.6">1,6×</option></select></label></div>' +
      '<p class="qe-txt" aria-live="polite">' + esc(d.resumo || "") + "</p>" +
      '<div class="qe-leg">' + atores.filter(function (k, i) { return atores.indexOf(k) === i && !(k === "Q" && atores.indexOf("O") >= 0); }).map(function (k) { return '<span><i style="background:' + corDe(k) + '"></i>' + (k === "A" ? "Atleta" : NOME[k] || k) + "</span>"; }).join("") +
      '<span><i style="background:' + COR.bola + ';border-radius:50%"></i>Bola (o número marca o quique)</span>' + ((d.alvos || []).length ? '<span><i style="background:rgba(244,255,138,.5);border:1px dashed #9AA62A"></i>Alvo</span>' : "") + "</div>";
    var svg = host.querySelector("svg"), gR = svg.querySelector(".qe-rastros"), gM = svg.querySelector(".qe-marcas"), gJ = svg.querySelector(".qe-jogadores"), gB = svg.querySelector(".qe-bola");
    var bt = host.querySelector(".qe-play"), txt = host.querySelector(".qe-txt"), sel = host.querySelector("select");
    var raf = 0, rodando = false, t = 0, ultimoQuadro = null, vel = 1, lanceAtual = -1;
    var sombra, bola;
    function prepararAnimacao() {
      gR.innerHTML = ""; gM.innerHTML = ""; gJ.innerHTML = ""; gB.innerHTML = "";
      atores.forEach(function (k) { gJ.insertAdjacentHTML("beforeend", jogadorTexto(k, d.atores[k])); });
      sombra = el("ellipse", { rx: 0.34, ry: 0.22, fill: "rgba(0,0,0,.38)" }, gB);
      bola = el("circle", { r: 0.32, fill: COR.bola, stroke: "#2A3410", "stroke-width": 0.06 }, gB);
    }
    function quadroEm(tt) {
      var k, j;
      atores.forEach(function (k2) { var p = posEm(tl.trilhas[k2], tt), q = T(p), g = gJ.querySelector('[data-ator="' + k2 + '"]'); if (g) g.setAttribute("transform", "translate(" + q[0].toFixed(3) + "," + q[1].toFixed(3) + ")"); });
      var html = "", marcas = "", b = null, atual = -1;
      tl.lances.forEach(function (l, i) {
        if (tt < l.t0) return;
        if (tt <= l.t1) { atual = i; b = bolaEm(l.quadros, tt); html += rastroTexto(trechoAte(l.quadros, tt), "bola", uid); }
        if (l.quique && l.tQuique != null && tt >= l.tQuique) marcas += marcaTexto(l.quique, l.n);
      });
      for (k in tl.trilhas) { var tr = amostraTrilha(tl.trilhas[k], tt), dd = 0; for (j = 1; j < tr.length; j++) dd += dist(tr[j], tr[j - 1]); if (dd > 0.6) html += rastroTexto(tr, k === "A" ? "A" : "o", uid); }
      gR.innerHTML = html; gM.innerHTML = marcas;
      if (b && bola) {
        var h = Math.max(0, b.h || 0), q = T([b.x, b.y]);
        bola.setAttribute("visibility", "visible"); sombra.setAttribute("visibility", "visible");
        bola.setAttribute("cx", q[0].toFixed(3)); bola.setAttribute("cy", q[1].toFixed(3)); bola.setAttribute("r", (0.32 * (1 + h / 3.2)).toFixed(3));
        sombra.setAttribute("cx", (q[0] + h * 0.16).toFixed(3)); sombra.setAttribute("cy", (q[1] + h * 0.16).toFixed(3)); sombra.setAttribute("opacity", Math.max(0.25, 1 - h / 7).toFixed(2));
      } else { bola.setAttribute("visibility", "hidden"); sombra.setAttribute("visibility", "hidden"); }
      if (atual < 0) tl.lances.forEach(function (l, i) { if (l.semBola && tt >= l.t0 && tt <= l.t1) atual = i; });
      if (atual !== lanceAtual && atual >= 0) { lanceAtual = atual; var l = tl.lances[atual]; txt.textContent = l.n + " de " + tl.lances.length + " · " + (NOME[l.de] || l.de) + ": " + l.txt; }
    }
    function passo(agora) {
      if (!rodando) return;
      if (ultimoQuadro == null) ultimoQuadro = agora;
      t += (agora - ultimoQuadro) / 1000 * vel; ultimoQuadro = agora;
      if (t >= tl.dur) {
        if (d.ciclo !== false) { t = 0; lanceAtual = -1; prepararAnimacao(); }
        else { parar(); return; }
      }
      quadroEm(t);
      raf = requestAnimationFrame(passo);
    }
    function tocar() {
      if (reduzir.matches) { /* sem movimento: mostra o desenho completo e descreve a sequência */
        txt.textContent = tl.lances.map(function (l) { return l.n + ". " + (NOME[l.de] || l.de) + ": " + l.txt; }).join(" · ");
        return;
      }
      if (!gJ.childNodes.length || t === 0) prepararAnimacao();
      rodando = true; ultimoQuadro = null; bt.textContent = "⏸ Pausar"; bt.setAttribute("aria-label", "Pausar");
      raf = requestAnimationFrame(passo);
    }
    function parar() { rodando = false; if (raf) cancelAnimationFrame(raf); raf = 0; bt.textContent = "▶ Reproduzir"; bt.setAttribute("aria-label", "Reproduzir"); }
    function doInicio() {
      parar(); t = 0; lanceAtual = -1;
      host.querySelector(".qe-quadra").innerHTML = svgEstatico(codigo, uid, d);
      svg = host.querySelector("svg"); gR = svg.querySelector(".qe-rastros"); gM = svg.querySelector(".qe-marcas"); gJ = svg.querySelector(".qe-jogadores"); gB = svg.querySelector(".qe-bola");
      txt.textContent = d.resumo || "";
    }
    bt.addEventListener("click", function () { if (rodando) parar(); else tocar(); });
    host.querySelector(".qe-reini").addEventListener("click", doInicio);
    sel.addEventListener("change", function () { vel = +sel.value || 1; });
    if (opts.tocar) tocar();
    return { parar: parar, tocar: tocar, linhaDoTempo: tl };
  }

  /* estilo da tela (uma vez por página) */
  var CSS = ".qe{font-family:system-ui,-apple-system,'Segoe UI',sans-serif}.qe-quadra{background:" + COR.fora + ";border-radius:10px;overflow:hidden;line-height:0}.qe-svg{display:block;width:100%;height:auto}" +
    ".qe-ctl{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:8px}.qe-ctl button{font:inherit;font-size:13px;font-weight:700;min-height:40px;padding:8px 14px;border-radius:10px;border:1px solid #1E4D3F;background:#1E4D3F;color:#fff;cursor:pointer}" +
    ".qe-ctl .qe-reini{background:#fff;color:#1E4D3F;min-width:44px}.qe-vel{font-size:12.5px;color:#5A5A5A;display:flex;align-items:center;gap:6px}.qe-vel select{font:inherit;font-size:13px;min-height:36px;border-radius:8px;border:1px solid #C9D3CE;padding:4px 6px}" +
    ".qe-txt{font-size:13.5px;line-height:1.45;margin:8px 0 4px;color:#14202B;min-height:1.45em}.qe-leg{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12px;color:#5A5A5A}.qe-leg i{display:inline-block;width:11px;height:11px;border-radius:3px;margin-right:5px;vertical-align:-1px}";
  if (typeof document !== "undefined" && !document.getElementById("qe-estilo")) {
    var st = document.createElement("style"); st.id = "qe-estilo"; st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  return { registrar: registrar, tem: tem, roteiro: roteiro, montar: montar, svgEstatico: svgEstatico, construir: construir, LIMITES: { L: L, W: W, S: S } };
});
