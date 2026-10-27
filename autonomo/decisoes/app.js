/* QuadraLab Player · Simulador de Decisões — TELAS.
   Conteúdo em cenarios.js (window.QLD_CONTEUDO) e regras em motor.js (window.QLD_MOTOR). Navegação por âncoras simples
   (#inicio, #cenarios, #jogar-<id>, #resumo-<id>, #progresso, #modulo, #consultoria, #pedido). O progresso fica só neste
   navegador (localStorage); nada é enviado a nenhum servidor. */
(function () {
  "use strict";
  var K = window.QLD_CONTEUDO, M = window.QLD_MOTOR;
  var app = document.getElementById("conteudo"), anuncio = document.getElementById("anuncio");
  var reduzir = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  var SVGNS = "http://www.w3.org/2000/svg";
  var POR_ID = {}; K.CENARIOS.forEach(function (c) { POR_ID[c.id] = c; });
  var ROT_CURTO = { coerente: "Coerente", inicio: "Possível para começar", controle: "Exige mais controle", iniciativa: "Devolve a iniciativa" };
  var GRATIS = K.CENARIOS.filter(function (c) { return c.gratis; }), PREVIA = K.CENARIOS.filter(function (c) { return !c.gratis; });
  var TOTAL = K.CENARIOS.length, NIVEIS = K.NIVEIS || [{ n: 1, nome: "Base", variante: {} }], NN = NIVEIS.length;
  var V = K.VARIANTES || { superficies: {}, adversarios: {}, descricoes: {}, notas: {} };
  /* situação = padrão num nível. Rotas: #jogar-<id> (nível 1) ou #jogar-<id>.<n>; idem #resumo- */
  function sitDe(txt) { var m = /^([a-z0-9]+)(?:\.(\d))?$/.exec(txt || ""); if (!m || !POR_ID[m[1]]) return null; var n = m[2] ? +m[2] : 1; return n >= 1 && n <= NN ? { cen: POR_ID[m[1]], n: n, chave: m[1] + "." + n } : null; }
  function rotaSit(id, n) { return id + (n > 1 ? "." + n : ""); }
  function nivelDe(n) { return NIVEIS.filter(function (x) { return x.n === n; })[0] || NIVEIS[0]; }
  function estrelasHTML(n, total) { var s = ""; for (var i = 0; i < (total || 3); i++) s += i < n ? "★" : "☆"; return '<span class="estrelas" aria-label="' + Math.max(0, n) + " de " + (total || 3) + ' estrelas">' + s + "</span>"; }
  function hojeISO() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function marcarDia() { var h = hojeISO(); if (prog.dias.indexOf(h) < 0) { prog.dias.push(h); prog.dias = prog.dias.slice(-120); } }
  function totais() {
    var est = 0, leit = 0;
    K.CENARIOS.forEach(function (c) { NIVEIS.forEach(function (nv) { var b = M.melhorEstrelas(prog, M.chaveSituacao(c.id, nv.n)); if (b > 0) est += b; var r = prog.cenarios[M.chaveSituacao(c.id, nv.n)]; if (r) r.historico.forEach(function (h) { leit += h.leitura || 0; }); }); });
    return { estrelas: est, max: TOTAL * NN * 3, leitura: leit, dias: M.sequenciaDias(prog.dias, hojeISO()), revisoes: M.revisoes(K, prog).length };
  }
  function hudHTML() {
    var t = totais();
    return '<div class="hud" role="group" aria-label="Seu jogo"><div><strong>' + t.estrelas + '</strong><span>de ' + t.max + ' estrelas</span></div><div><strong>' + t.leitura + '</strong><span>pontos de leitura</span></div><div><strong>' + t.dias + '</strong><span>' + (t.dias === 1 ? "dia seguido" : "dias seguidos") + '</span></div><div><strong>' + t.revisoes + '</strong><span>' + (t.revisoes === 1 ? "revisão hoje" : "revisões hoje") + "</span></div></div>";
  }

  /* ── utilidades ── */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function $(sel, el) { return (el || document).querySelector(sel); }
  function $$(sel, el) { return [].slice.call((el || document).querySelectorAll(sel)); }
  function dataBR(iso) { if (!iso) return ""; var d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("pt-BR"); }
  function anunciar(t) { anuncio.textContent = ""; setTimeout(function () { anuncio.textContent = t; }, 60); }
  function opcaoDe(cen, etapaId, id) { var e = cen.etapas[etapaId]; return e ? e.opcoes.filter(function (o) { return o.id === id; })[0] : null; }
  function ir(h) { if (location.hash === "#" + h) rotear(); else location.hash = h; }

  /* ── progresso (localStorage, à prova de dados inválidos) ── */
  var prog = carregar();
  function carregar() {
    var bruto = null;
    try { bruto = JSON.parse(localStorage.getItem(M.CHAVE) || "null"); } catch (e) { bruto = null; }
    return M.normalizar(bruto, K);
  }
  function salvar() {
    try { localStorage.setItem(M.CHAVE, JSON.stringify(prog)); } catch (e) { return false; }
    try { localStorage.setItem(M.CHAVE_RESUMO, JSON.stringify(M.resumoParaPlayer(K, prog))); } catch (e) { /* o resumo do Player é opcional */ }
    return true;
  }
  /* quem jogou antes do resumo existir também aparece no Início do Player */
  if (Object.keys(prog.cenarios).length) { try { localStorage.setItem(M.CHAVE_RESUMO, JSON.stringify(M.resumoParaPlayer(K, prog))); } catch (e) { /* opcional */ } }
  function registro(id) {
    var c = prog.cenarios[id];
    if (!c) c = prog.cenarios[id] = { iniciadoEm: null, atualizadoEm: null, concluidoEm: null, execucao: { caminho: [], pendente: null, tentativas: [], fim: false }, historico: [] };
    return c;
  }
  function situacao(id) {
    if (POR_ID[id]) id = id + ".1";
    var c = prog.cenarios[id];
    if (!c || (!c.iniciadoEm && !c.historico.length)) return { estado: "novo", rotulo: "Não iniciado" };
    var ex = c.execucao, emAndamento = ex.caminho.length || ex.pendente || ex.tentativas.length;
    if (emAndamento && !ex.fim) return { estado: "andamento", rotulo: "Em andamento · decisão " + Math.min(3, ex.caminho.length + 1) + " de 3" + (c.historico.length ? " (já concluído antes)" : ""), etapa: ex.caminho.length + 1 };
    if (c.historico.length) return { estado: "concluido", rotulo: "Concluído" + (c.concluidoEm ? " em " + dataBR(c.concluidoEm) : ""), vezes: c.historico.length };
    return { estado: "novo", rotulo: "Não iniciado" };
  }

  /* ══ quadra (SVG) ══ */
  var VB = { x: -6.6, y: -15.2, w: 13.2, h: 30.4 };
  function el(nome, attrs, pai) {
    var e = document.createElementNS(SVGNS, nome);
    for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (pai) pai.appendChild(e);
    return e;
  }
  function Y(y) { return -y; }
  function pts(lista) { return lista.map(function (p) { return p[0].toFixed(2) + "," + Y(p[1]).toFixed(2); }).join(" "); }

  /* desenha a quadra num contêiner; devolve o controle (camadas e funções de atualização) */
  function Quadra(host, o) {
    o = o || {};
    var svg = el("svg", { viewBox: VB.x + " " + VB.y + " " + VB.w + " " + VB.h, class: "quadra-svg", role: "group", "aria-label": o.rotulo || "Quadra de simples vista de cima. Você está embaixo, o adversário em cima." });
    var defs = el("defs", {}, svg);
    var mk = function (id, cor) { var m = el("marker", { id: id, viewBox: "0 0 10 10", refX: "8", refY: "5", markerWidth: "4", markerHeight: "4", orient: "auto-start-reverse" }, defs); el("path", { d: "M0,0 L10,5 L0,10 z", fill: cor }, m); };
    var uid = "q" + Math.random().toString(36).slice(2, 7);
    mk(uid + "j", "#F38A3F"); mk(uid + "a", "#0B2A21");
    el("rect", { x: VB.x, y: VB.y, width: VB.w, height: VB.h, fill: "var(--quadra-fora)" }, svg);
    var W = M.W, L = M.L, S = M.S;
    el("rect", { x: -W - 0.9, y: -L - 0.6, width: 2 * W + 1.8, height: 2 * L + 1.2, fill: "var(--quadra)", rx: 0.2 }, svg);
    var linhas = el("g", { stroke: "#FFFFFF", "stroke-width": 0.09, fill: "none", "stroke-linecap": "square" }, svg);
    el("rect", { x: -W, y: -L, width: 2 * W, height: 2 * L }, linhas);
    el("line", { x1: -W, y1: -S, x2: W, y2: -S }, linhas); el("line", { x1: -W, y1: S, x2: W, y2: S }, linhas);
    el("line", { x1: 0, y1: -S, x2: 0, y2: S }, linhas);
    el("line", { x1: 0, y1: -L, x2: 0, y2: -L + 0.3 }, linhas); el("line", { x1: 0, y1: L, x2: 0, y2: L - 0.3 }, linhas);
    el("line", { x1: -W - 0.9, y1: 0, x2: W + 0.9, y2: 0, stroke: "#0B2A21", "stroke-width": 0.16 }, svg);
    el("line", { x1: -W - 0.9, y1: 0, x2: W + 0.9, y2: 0, stroke: "#FFFFFF", "stroke-width": 0.05, "stroke-dasharray": "0.12 0.12" }, svg);
    el("circle", { cx: -W - 0.9, cy: 0, r: 0.14, fill: "#0B2A21" }, svg); el("circle", { cx: W + 0.9, cy: 0, r: 0.14, fill: "#0B2A21" }, svg);
    var camadas = {};
    ["contexto", "intencao", "rastros", "marcas", "jogadores", "alvos", "bola"].forEach(function (n) { camadas[n] = el("g", { class: "c-" + n }, svg); });
    var jog = el("g", { class: "jogador", "aria-hidden": "true" }, camadas.jogadores);
    el("circle", { r: 0.62, fill: "#E8691F", stroke: "#FFFFFF", "stroke-width": 0.12 }, jog);
    var adv = el("g", { class: "adversario", "aria-hidden": "true" }, camadas.jogadores);
    el("circle", { r: 0.62, fill: "#0D3328", stroke: "#FFFFFF", "stroke-width": 0.12 }, adv);
    var sombra = el("ellipse", { rx: 0.28, ry: 0.18, fill: "rgba(0,0,0,.38)", "aria-hidden": "true" }, camadas.bola);
    var bola = el("circle", { r: 0.25, fill: "#E4F542", stroke: "#2A3410", "stroke-width": 0.05, "aria-hidden": "true" }, camadas.bola);
    host.innerHTML = ""; host.appendChild(svg);

    function poe(g, p) { if (p) g.setAttribute("transform", "translate(" + p[0].toFixed(3) + "," + Y(p[1]).toFixed(3) + ")"); }
    function poeBola(b) {
      if (!b) { bola.setAttribute("visibility", "hidden"); sombra.setAttribute("visibility", "hidden"); return; }
      bola.setAttribute("visibility", "visible"); sombra.setAttribute("visibility", "visible");
      var h = Math.max(0, b.h || 0);
      /* altura: a bola cresce e a sombra se afasta e enfraquece (luz vinda de cima, à esquerda) */
      bola.setAttribute("cx", b.x.toFixed(3)); bola.setAttribute("cy", Y(b.y).toFixed(3)); bola.setAttribute("r", (0.25 * (1 + h / 3.2)).toFixed(3));
      sombra.setAttribute("cx", (b.x + h * 0.16).toFixed(3)); sombra.setAttribute("cy", (Y(b.y) + h * 0.16).toFixed(3));
      sombra.setAttribute("opacity", Math.max(0.25, 1 - h / 7).toFixed(2));
    }
    function limpar(nome) { camadas[nome].innerHTML = ""; }
    function linha(nome, lista, attrs) { if (lista.length < 2) return null; return el("polyline", Object.assign({ points: pts(lista), fill: "none" }, attrs), camadas[nome]); }
    function quique(nome, p) { if (!p) return; el("circle", { cx: p[0], cy: Y(p[1]), r: 0.32, fill: "none", stroke: "#F4FF8A", "stroke-width": 0.08 }, camadas[nome]); el("line", { x1: p[0] - 0.18, y1: Y(p[1]) - 0.18, x2: p[0] + 0.18, y2: Y(p[1]) + 0.18, stroke: "#F4FF8A", "stroke-width": 0.07 }, camadas[nome]); el("line", { x1: p[0] - 0.18, y1: Y(p[1]) + 0.18, x2: p[0] + 0.18, y2: Y(p[1]) - 0.18, stroke: "#F4FF8A", "stroke-width": 0.07 }, camadas[nome]); }
    var estilo = {
      bola: { stroke: "#F4FF8A", "stroke-width": 0.1, "stroke-dasharray": "0.02 0.26", "stroke-linecap": "round" },
      jog: { stroke: "#F38A3F", "stroke-width": 0.13, "stroke-dasharray": "0.5 0.3", "marker-end": "url(#" + uid + "j)" },
      adv: { stroke: "#0B2A21", "stroke-width": 0.13, "stroke-dasharray": "0.5 0.3", "marker-end": "url(#" + uid + "a)" },
    };
    return {
      svg: svg, camadas: camadas, estilo: estilo, poeJog: function (p) { poe(jog, p); }, poeAdv: function (p) { poe(adv, p); }, poeBola: poeBola,
      limpar: limpar, linha: linha, quique: quique,
    };
  }

  /* alvos numerados (golpe) ou posições (recuperação), clicáveis e operáveis pelo teclado */
  function desenharAlvos(q, itens, sel, aoEscolher, bloqueado) {
    q.limpar("alvos");
    itens.forEach(function (it, i) {
      var g = el("g", { class: "alvo" + (it.id === sel ? " sel" : "") + (it.recuperacao ? " rec" : ""), role: "button", tabindex: bloqueado ? "-1" : "0", "aria-pressed": it.id === sel ? "true" : "false",
        "aria-label": (it.recuperacao ? "Posição " : "Alvo ") + (i + 1) + ": " + it.rotulo, "aria-disabled": bloqueado ? "true" : "false", transform: "translate(" + it.p[0] + "," + Y(it.p[1]) + ")" }, q.camadas.alvos);
      el("circle", { r: 1.55, fill: "transparent", class: "alvo-toque" }, g);
      el("circle", { r: 0.95, class: "alvo-fundo" }, g);
      var t = el("text", { class: "alvo-num", "text-anchor": "middle", "dominant-baseline": "central", y: 0.04 }, g); t.textContent = String(i + 1);
      function go(ev) { if (bloqueado) return; ev.preventDefault(); aoEscolher(it.id); }
      g.addEventListener("click", go);
      g.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") go(ev); });
    });
  }

  /* ══ animação ══ */
  var animAtual = null;
  function pararAnimacao() { if (animAtual) { animAtual.parar(); animAtual = null; } }
  function trechoAte(lista, t, comH) {
    var out = [];
    for (var i = 0; i < lista.length; i++) { if (lista[i].t > t) break; out.push([lista[i].x, lista[i].y]); }
    var p = comH ? M.bolaEm(lista, t) : M.posEm(lista, t);
    if (p) out.push(comH ? [p.x, p.y] : p);
    return out;
  }
  function amostrar(trilha, dur) { var out = []; for (var t = 0; t <= dur + 0.001; t += 1 / 15) { var p = M.posEm(trilha, t); out.push({ t: t, x: p[0], y: p[1] }); } return out; }
  /* desenha um instante t da animação (quadros-chave do motor) */
  function quadroEm(q, anim, t, final) {
    var j = anim.jog.length ? M.posEm(anim.jog, t) : null, a = anim.adv.length ? M.posEm(anim.adv, t) : null, b = M.bolaEm(anim.bola, t);
    if (j) q.poeJog(j); if (a) q.poeAdv(a); q.poeBola(b);
    q.limpar("rastros"); q.limpar("marcas");
    var aj = amostrar(anim.jog, anim.dur), aa = amostrar(anim.adv, anim.dur);
    q.linha("rastros", trechoAte(anim.bola, t, true), q.estilo.bola);
    if (anim.jog.length) { var tj = trechoAte(aj, t); if (tj.length > 1 && distTotal(tj) > 0.6) q.linha("rastros", tj, q.estilo.jog); }
    if (anim.adv.length) { var ta = trechoAte(aa, t); if (ta.length > 1 && distTotal(ta) > 0.6) q.linha("rastros", ta, q.estilo.adv); }
    (anim.quiques || []).forEach(function (p) {
      var tq = null; anim.bola.forEach(function (x) { if (x.quique && Math.abs(x.x - p[0]) < 0.01 && Math.abs(x.y - p[1]) < 0.01) tq = x.t; });
      if (final || (tq != null && t >= tq)) q.quique("marcas", p);
    });
    if (anim.recuperacao && (final || t > 0.3)) el("circle", { cx: anim.recuperacao[0], cy: Y(anim.recuperacao[1]), r: 0.5, fill: "none", stroke: "#F38A3F", "stroke-width": 0.08, "stroke-dasharray": "0.15 0.12" }, q.camadas.marcas);
  }
  function distTotal(l) { var d = 0; for (var i = 1; i < l.length; i++) d += Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]); return d; }
  function animar(q, anim, aoFim) {
    pararAnimacao();
    var parado = false, raf = 0, ini = null;
    var ctl = { parar: function () { parado = true; if (raf) cancelAnimationFrame(raf); } };
    animAtual = ctl;
    if (reduzir.matches) { quadroEm(q, anim, anim.dur, true); setTimeout(function () { if (!parado) { animAtual = null; aoFim(); } }, 50); return ctl; }
    function passo(agora) {
      if (parado) return;
      if (ini == null) ini = agora;
      var t = (agora - ini) / 1000;
      if (t >= anim.dur) { quadroEm(q, anim, anim.dur, true); animAtual = null; aoFim(); return; }
      quadroEm(q, anim, t, false);
      raf = requestAnimationFrame(passo);
    }
    raf = requestAnimationFrame(passo);
    return ctl;
  }

  /* contexto da etapa: posições, bola, trajetória anterior (o saque ou a bola que chegou) e a bola em voo */
  function cenaInicial(q, cen, est) {
    q.limpar("contexto"); q.limpar("rastros"); q.limpar("marcas"); q.limpar("intencao");
    q.poeJog(est.jog); q.poeAdv(est.adv);
    if (est.voo) {
      var va = M.vooAtual(cen, est);
      q.linha("contexto", [va.P, va.T, va.C], { stroke: "#F4FF8A", "stroke-width": 0.08, "stroke-dasharray": "0.3 0.3", opacity: 0.55 });
      q.quique("contexto", va.T);
      q.poeBola({ x: est.bola[0], y: est.bola[1], h: est.hBola || 1 });
    } else {
      q.poeBola({ x: est.bola[0], y: est.bola[1], h: est.hContato || 1 });
      var pv = cen.inicio.previa;
      if (est.etapa === "d1" && pv) { q.linha("contexto", [pv.de, pv.quique, est.jog], { stroke: "#F4FF8A", "stroke-width": 0.08, "stroke-dasharray": "0.3 0.3", opacity: 0.5 }); q.quique("contexto", pv.quique); }
    }
  }

  /* vista lateral ilustrativa da trajetória (altura sobre a rede) */
  function perfilSVG(pf) {
    if (!pf) return "";
    var w = 300, h = 74, mx = 8, base = 62, kx = (w - 2 * mx) / pf.total, ky = 11;
    var p = pf.pontos.map(function (q) { return (mx + q[0] * kx).toFixed(1) + "," + (base - q[1] * ky).toFixed(1); }).join(" ");
    var xr = pf.dRede != null ? mx + pf.dRede * kx : null;
    return '<svg class="perfil-svg" viewBox="0 0 ' + w + " " + h + '" aria-hidden="true"><line x1="' + mx + '" y1="' + base + '" x2="' + (w - mx) + '" y2="' + base + '" class="pf-chao"/>' +
      (xr != null ? '<line x1="' + xr.toFixed(1) + '" y1="' + base + '" x2="' + xr.toFixed(1) + '" y2="' + (base - pf.hRede * ky).toFixed(1) + '" class="pf-rede"/>' : "") +
      '<polyline points="' + p + '" class="pf-bola"/><circle cx="' + mx + '" cy="' + (base - pf.pontos[0][1] * ky).toFixed(1) + '" r="4" class="pf-voce"/></svg>';
  }

  /* ══ telas ══ */
  function tela(html, titulo) {
    pararAnimacao();
    app.innerHTML = html;
    document.title = (titulo ? titulo + " · " : "") + "Simulador de Decisões · QuadraLab Player";
    var h1 = $("h1", app);
    window.scrollTo(0, 0);
    if (h1) { h1.setAttribute("tabindex", "-1"); h1.focus({ preventScroll: true }); }
    $$(".nav a").forEach(function (a) { a.classList.toggle("ativo", a.getAttribute("data-rota") === rotaAtual()); a.setAttribute("aria-current", a.getAttribute("data-rota") === rotaAtual() ? "page" : "false"); });
  }
  function rotaAtual() { var h = location.hash.replace(/^#/, ""); return /^jogar-|^resumo-/.test(h) || h === "cenarios" ? "cenarios" : h === "pedido" ? "consultoria" : h === "relampago" ? "desafios" : h; }
  var AVISO_HTML = '<p class="aviso-sim">' + esc(K.AVISO) + "</p>";

  /* A. apresentação */
  function telaInicio() {
    var c1 = K.CENARIOS[0];
    tela('<section class="hero"><div class="hero-txt"><p class="sobre">QuadraLab Player · Simulador de Decisões</p><h1>O próximo ponto começa na sua decisão.</h1>' +
      '<p class="lead">Escolha alvos na quadra, acompanhe uma possível resposta do adversário e entenda como construir a próxima jogada.</p>' +
      '<div class="acoes"><a class="btn btn-primario" href="#cenarios">Experimentar grátis</a><a class="btn btn-secundario" href="#consultoria">Conhecer a consultoria</a></div>' +
      '<ul class="fatos"><li><strong>3</strong> cenários gratuitos</li><li><strong>9</strong> decisões em sequência</li><li><strong>Sem cadastro</strong> para experimentar</li><li><strong>Explicações</strong> e missão de treino</li></ul></div>' +
      '<div class="previa cartao" aria-labelledby="t-previa"><h2 id="t-previa" class="h-previa">Experimente aqui</h2><p class="previa-ctx">' + esc(c1.placar + " · " + c1.contexto) + '</p><div class="quadra-host previa-quadra" id="previaQuadra"></div>' +
      '<p class="previa-instr" id="previaInstr">Toque num alvo para ver a bola e uma resposta possível.</p><div class="previa-lista" id="previaLista"></div><p class="previa-res" id="previaRes" aria-live="polite"></p>' + AVISO_HTML + "</div></section>" +
      '<section class="bloco" aria-labelledby="t-cen"><h2 id="t-cen">Três cenários para começar</h2><div class="grade-cen">' + GRATIS.map(cartaoCenario).join("") + "</div>" +
        (PREVIA.length ? '<div class="cartao faixa"><p><strong>Mais ' + PREVIA.length + " cenários em prévia</strong>, organizados pelas situações táticas da Metodologia MTY: início do ponto, construção, ataque e transição, defesa e contra-ataque.</p><a class=\"btn btn-texto\" href=\"#cenarios\">Ver todos os cenários</a></div>" : "") + "</section>" +
      '<section class="bloco duas"><div class="cartao"><h2>Como funciona</h2><ol class="passos"><li>Leia a situação e o placar.</li><li>Escolha o alvo na quadra ou na lista.</li><li>Ajuste a altura sobre a rede e a intensidade.</li><li>Veja a bola, o deslocamento dos jogadores e uma resposta possível.</li><li>Leia a explicação e compare outra alternativa.</li><li>Leve uma missão para treinar em quadra.</li><li>Ganhe estrelas pelas primeiras escolhas coerentes, libere níveis com outra quadra, outro adversário e o ponto decisivo, e treine a leitura no modo relâmpago.</li></ol></div>' +
      '<div class="cartao"><h2>Quer olhar para as suas partidas?</h2><p>O simulador ajuda você a explorar decisões. A consultoria analisa como essas situações aparecem nas suas partidas.</p><div class="acoes"><a class="btn btn-secundario" href="#consultoria">Conhecer a consultoria</a></div></div></section>', "");
    previa();
  }
  function cartaoCenario(c) {
    /* próximo nível a jogar: o primeiro em andamento, senão o primeiro liberado ainda sem estrelas, senão o 1 */
    var alvoN = 1, niveisHTML = NIVEIS.map(function (nv) {
      var chave = M.chaveSituacao(c.id, nv.n), lib = M.nivelLiberado(prog, c.id, nv.n), best = M.melhorEstrelas(prog, chave), st = situacao(chave);
      var rot = "Nível " + nv.n + ": " + nv.nome + (lib ? "" : ". Bloqueado: faça 2 estrelas no nível " + (nv.n - 1));
      return lib ? '<a class="nivel' + (st.estado === "andamento" ? " andamento" : "") + '" href="#jogar-' + rotaSit(c.id, nv.n) + '" title="' + esc(nv.nome) + '" aria-label="' + esc(rot) + (best >= 0 ? ", " + best + " de 3 estrelas" : "") + '"><b>' + nv.n + "</b>" + (best >= 0 ? estrelasHTML(best) : '<span class="estrelas vazio">novo</span>') + "</a>"
        : '<span class="nivel bloq" aria-label="' + esc(rot) + '" title="' + esc(rot) + '"><b>' + nv.n + '</b><span class="estrelas vazio">bloqueado</span></span>';
    }).join("");
    NIVEIS.some(function (nv) { var st = situacao(M.chaveSituacao(c.id, nv.n)); if (st.estado === "andamento") { alvoN = nv.n; return true; } return false; }) ||
      NIVEIS.some(function (nv) { if (M.nivelLiberado(prog, c.id, nv.n) && M.melhorEstrelas(prog, M.chaveSituacao(c.id, nv.n)) < 0) { alvoN = nv.n; return true; } return false; });
    var s = situacao(M.chaveSituacao(c.id, alvoN)), botao = s.estado === "andamento" ? "Continuar" : s.estado === "concluido" ? "Jogar de novo" : alvoN > 1 ? "Jogar o nível " + alvoN : "Começar";
    var temResumo = M.melhorEstrelas(prog, M.chaveSituacao(c.id, 1)) >= 0;
    return '<article class="cartao cen"><p class="cen-num">Cenário ' + c.numero + (c.gratis ? ' <span class="tag tag-gratis">Gratuito</span>' : ' <span class="tag tag-previa">Prévia</span>') + '</p><h3>' + esc(c.titulo) + '</h3><p class="cen-placar">' + esc(c.placar + " · " + c.sacador) + "</p><p>" + esc(c.chamada) + '</p><div class="niveis" aria-label="Níveis">' + niveisHTML + '</div><p class="cen-estado e-' + s.estado + '">' + esc((alvoN > 1 ? "Nível " + alvoN + " · " : "") + s.rotulo) + "</p>" +
      '<div class="acoes"><a class="btn btn-primario" href="#jogar-' + rotaSit(c.id, alvoN) + '">' + botao + "</a>" + (temResumo ? '<a class="btn btn-texto" href="#resumo-' + c.id + '">Ver resumo</a>' : "") + "</div></article>";
  }
  /* prévia interativa: decisão 1 do cenário 1, altura média e intensidade controlada */
  function previa() {
    var cen = K.CENARIOS[0], est = M.estadoInicial(cen), etapa = cen.etapas.d1, q = Quadra($("#previaQuadra"), { rotulo: "Prévia: quadra do cenário 1. Você está fora da quadra, embaixo à direita." }), ocupado = false, sel = null;
    cenaInicial(q, cen, est);
    function desenhar() {
      desenharAlvos(q, etapa.opcoes.map(function (o) { return { id: o.id, p: o.alvo, rotulo: o.rotulo }; }), sel, escolher, ocupado);
      $("#previaLista").innerHTML = etapa.opcoes.map(function (o, i) { return '<button type="button" class="chip-op' + (o.id === sel ? " sel" : "") + '" data-op="' + o.id + '"' + (ocupado ? " disabled" : "") + '><span class="num">' + (i + 1) + "</span>" + esc(o.rotulo) + "</button>"; }).join("");
    }
    function escolher(id) {
      if (ocupado) return;
      sel = id; ocupado = true; desenhar();
      var r = M.simular(K, cen, est, "d1", { opcao: id, altura: "media", intensidade: "controlada" });
      cenaInicial(q, cen, est); q.limpar("contexto");
      $("#previaRes").textContent = "";
      animar(q, r.anim, function () {
        ocupado = false; desenhar();
        $("#previaRes").innerHTML = "<strong>" + esc(r.avaliacao.rotulo) + "</strong> " + esc(r.avaliacao.resumo) + ' <a href="#jogar-' + cen.id + '">Continuar no simulador</a>';
      });
    }
    $("#previaLista").addEventListener("click", function (e) { var b = e.target.closest("[data-op]"); if (b) escolher(b.getAttribute("data-op")); });
    desenhar();
  }

  /* B. biblioteca */
  function telaCenarios() {
    var trilhas = (K.TRILHAS || []).map(function (t) {
      var l = PREVIA.filter(function (c) { return c.trilha === t.id; });
      return l.length ? '<section class="bloco trilha" aria-labelledby="t-' + t.id + '"><h2 id="t-' + t.id + '">' + esc(t.titulo) + '</h2><p class="det">' + esc(t.texto) + '</p><div class="grade-cen">' + l.map(cartaoCenario).join("") + "</div></section>" : "";
    }).join("");
    tela('<h1>Cenários</h1><p class="lead">Situações de ponto com três decisões cada, em ' + NN + ' níveis: a mesma situação em outra quadra, contra outro adversário e no ponto decisivo. Cada primeira escolha coerente vale uma estrela; duas estrelas liberam o nível seguinte.</p>' + hudHTML() +
      '<div class="acoes"><a class="btn btn-secundario" href="#desafios">Desafios: relâmpago e revisão do dia</a></div>' +
      '<section class="bloco" aria-labelledby="t-gratis"><h2 id="t-gratis">Para começar · gratuitos</h2><div class="grade-cen">' + GRATIS.map(cartaoCenario).join("") + "</div></section>" +
      (PREVIA.length ? '<div class="cartao faixa aviso-previa"><p><strong>Prévia do conteúdo planejado.</strong> Os ' + PREVIA.length + " cenários abaixo seguem a Metodologia MTY, por situação tática. Estão abertos nesta versão de teste para avaliação e ainda passam pela revisão de Richard Tsukada.</p><a class=\"btn btn-texto\" href=\"#modulo\">Conhecer o módulo</a></div>" + trilhas : ""), "Cenários");
  }

  /* C. simulador */
  var sim = null;
  function telaSimulador(rota) {
    var st = sitDe(rota); if (!st) return ir("cenarios");
    var cen = st.cen, n = st.n, nv = nivelDe(n), variante = nv.variante;
    if (!M.nivelLiberado(prog, cen.id, n) && !revisaoLivre[st.chave]) {
      tela('<a class="btn btn-texto voltar" href="#cenarios">Cenários</a><h1>' + esc(cen.titulo) + '</h1><div class="cartao"><p><strong>Nível ' + n + " bloqueado.</strong> Faça 2 estrelas no nível " + (n - 1) + ' para liberar.</p><div class="acoes"><a class="btn btn-primario" href="#jogar-' + rotaSit(cen.id, n - 1) + '">Jogar o nível ' + (n - 1) + "</a></div></div>", cen.titulo);
      return;
    }
    var id = st.chave, reg = registro(id), ex = reg.execucao;
    if (ex.fim) { ex.caminho = []; ex.pendente = null; ex.tentativas = []; ex.fim = false; }
    var rf = M.refazer(K, cen, ex.caminho, variante);
    if (!rf) { ex.caminho = []; ex.pendente = null; rf = M.refazer(K, cen, [], variante); }
    if (!reg.iniciadoEm) reg.iniciadoEm = new Date().toISOString();
    salvar();
    sim = { cen: cen, n: n, chave: id, variante: variante, reg: reg, est: rf.estado, sel: { opcao: null, altura: "media", intensidade: "firme", previsao: null }, fase: "escolha", res: null };
    if (ex.pendente && ex.pendente.etapa === sim.est.etapa) {
      sim.sel = { opcao: ex.pendente.opcao, altura: ex.pendente.altura || "media", intensidade: ex.pendente.intensidade || "firme", previsao: ex.pendente.previsao || null };
      sim.res = M.simular(K, cen, sim.est, sim.est.etapa, ex.pendente); sim.fase = "resultado";
    }
    tela('<div class="sim"><a class="btn btn-texto voltar" href="#cenarios">Cenários</a>' +
      '<header class="sim-topo"><p class="cen-num">Cenário ' + cen.numero + " · Nível " + n + (NN > 1 ? " de " + NN : "") + '</p><h1>' + esc(cen.titulo) + '</h1><p class="placar"><span class="chip-placar">' + esc(nv.placar || cen.placar) + "</span> " + esc(cen.sacador + " · " + cen.lado) + "</p>" + variantesHTML(variante) + "</header>" +
      '<div class="sim-grade"><div class="sim-quadra"><div class="quadra-host" id="quadra"></div><ul class="legenda" aria-label="Legenda"><li><span class="lg lg-voce"></span>Você</li><li><span class="lg lg-adv"></span>Adversário</li><li><span class="lg lg-bola"></span>Bola</li><li><span class="lg lg-alvo">1</span>Alvos</li><li><span class="lg lg-traj"></span>Trajetória da bola</li><li><span class="lg lg-desl"></span>Deslocamento</li></ul>' + AVISO_HTML + "</div>" +
      '<div class="sim-painel" id="painel"></div></div></div>', cen.titulo);
    sim.q = Quadra($("#quadra"), { rotulo: "Quadra de simples vista de cima. Você, em laranja, embaixo; o adversário, em verde-escuro, em cima." });
    renderSim();
    if (sim.fase === "resultado") quadroEm(sim.q, sim.res.anim, sim.res.anim.dur, true);
  }
  function variantesHTML(v) {
    v = v || {}; var chips = [], desc = [];
    if (v.superficie) { chips.push(V.superficies[v.superficie]); desc.push(V.descricoes[v.superficie]); }
    if (v.adversario && v.adversario !== "equilibrado") { chips.push(V.adversarios[v.adversario]); desc.push(V.descricoes[v.adversario]); }
    if (v.decisivo) { chips.push("Ponto decisivo"); desc.push(V.descricoes.decisivo); }
    if (!chips.length) return "";
    return '<div class="variantes"><p class="chips">' + chips.map(function (c) { return '<span class="chip-var">' + esc(c) + "</span>"; }).join("") + '</p><details><summary>O que muda neste nível</summary><ul class="lista">' + desc.filter(Boolean).map(function (d) { return "<li>" + esc(d) + "</li>"; }).join("") + "</ul></details></div>";
  }
  function etapaAtual() { return sim.cen.etapas[sim.est.etapa]; }
  function itensAlvo() {
    var etapa = etapaAtual();
    if (etapa.tipo === "recuperacao") {
      var pos = M.posicoesRecuperacao(sim.cen, sim.est, sim.est.etapa);
      return etapa.opcoes.map(function (o) { return { id: o.id, p: pos.filter(function (x) { return x.id === o.id; })[0].R, rotulo: o.rotulo, recuperacao: true }; });
    }
    return etapa.opcoes.map(function (o) { return { id: o.id, p: o.alvo, rotulo: o.rotulo }; });
  }
  function tentativasDaEtapa() { var e = sim.est.etapa; return sim.reg.execucao.tentativas.filter(function (t) { return t.etapa === e; }); }
  function renderSim() {
    var etapa = etapaAtual(), cen = sim.cen, fase = sim.fase, bloqueado = fase !== "escolha";
    if (fase !== "resultado" || !sim.res) cenaInicial(sim.q, cen, sim.est);
    if (fase !== "escolha") sim.q.limpar("alvos"); else desenharAlvos(sim.q, itensAlvo(), sim.sel.opcao, function (id) { sim.sel.opcao = id; sim.sel.previsao = null; renderSim(); anunciar("Escolhido: " + opcaoDe(cen, sim.est.etapa, id).rotulo); }, bloqueado);
    if (fase === "escolha" && sim.sel.opcao && etapa.tipo === "golpe") {
      var o = opcaoDe(cen, sim.est.etapa, sim.sel.opcao);
      sim.q.limpar("intencao"); sim.q.linha("intencao", [sim.est.jog, o.alvo], { stroke: "#FFFFFF", "stroke-width": 0.07, "stroke-dasharray": "0.25 0.25", opacity: 0.7 });
    }
    var cab = '<p class="etapa-num">Decisão ' + etapa.numero + " de 3" + (etapa.golpe ? " · " + esc(etapa.golpe) : "") + "</p>" +
      (etapa.tatica && K.TATICAS ? '<p class="tatica">Situação tática: <strong>' + esc(K.TATICAS[etapa.tatica]) + "</strong></p>" : "") +
      (etapa.numero === 1 ? '<p class="ctx">' + esc(cen.contexto) + "</p>" : "") + '<p class="situacao">' + esc(etapa.situacao) + "</p>";
    var corpo = fase === "resultado" ? painelResultado() : painelEscolha(bloqueado);
    $("#painel").innerHTML = cab + corpo;
    ligarPainel();
  }
  function painelEscolha(bloqueado) {
    var etapa = etapaAtual(), golpe = etapa.tipo === "golpe", d = bloqueado ? " disabled" : "";
    var lista = '<fieldset class="campo"' + d + '><legend>' + esc(etapa.pergunta) + (golpe ? " Escolha o alvo" : " Escolha a posição") + "</legend><div class=\"opcoes\">" +
      etapa.opcoes.map(function (o, i) {
        return '<label class="op' + (sim.sel.opcao === o.id ? " sel" : "") + '"><input type="radio" name="op" value="' + o.id + '"' + (sim.sel.opcao === o.id ? " checked" : "") + '><span class="num" aria-hidden="true">' + (i + 1) + '</span><span class="op-txt">' + esc(o.rotulo) + "</span></label>";
      }).join("") + "</div></fieldset>";
    var ajustes = "";
    if (golpe) {
      var seg = function (nome, legenda, valores, nomes) {
        return '<fieldset class="campo seg"' + d + "><legend>" + legenda + '</legend><div class="segmentos">' + valores.map(function (v) {
          return '<label class="' + (sim.sel[nome] === v ? "sel" : "") + '"><input type="radio" name="' + nome + '" value="' + v + '"' + (sim.sel[nome] === v ? " checked" : "") + "><span>" + nomes[v] + "</span></label>";
        }).join("") + "</div></fieldset>";
      };
      var pf = sim.sel.opcao ? M.perfil(sim.cen, sim.est, sim.est.etapa, opcaoDe(sim.cen, sim.est.etapa, sim.sel.opcao), sim.sel.altura, sim.sel.intensidade) : null;
      ajustes = seg("altura", "Altura sobre a rede", M.ALTURAS, M.NOME_ALTURA) +
        (pf ? '<figure class="perfil">' + perfilSVG(pf) + "<figcaption>Vista lateral ilustrativa: da sua raquete até o adversário, passando pela rede.</figcaption></figure>" : "") +
        seg("intensidade", "Intensidade", M.INTENSIDADES, M.NOME_INTENSIDADE);
    }
    var prev = "";
    if (sim.sel.opcao && M.temResposta(sim.cen, sim.est.etapa, sim.sel.opcao)) {
      prev = '<fieldset class="campo prever"' + d + '><legend>Antes de ver: que resposta você espera do adversário? <span class="det">(opcional, vale ponto de leitura)</span></legend><div class="chips-prev">' +
        Object.keys(M.CATEGORIAS).map(function (k) { return '<label class="' + (sim.sel.previsao === k ? "sel" : "") + '"><input type="radio" name="previsao" value="' + k + '"' + (sim.sel.previsao === k ? " checked" : "") + "><span>" + M.CATEGORIAS[k] + "</span></label>"; }).join("") + "</div></fieldset>";
    }
    var pronto = !!sim.sel.opcao && !bloqueado;
    return lista + ajustes + prev + '<div class="acoes"><button type="button" class="btn btn-primario largo" id="btJogar"' + (pronto ? "" : " disabled") + ">" + (sim.fase === "animando" ? "Animação em andamento…" : golpe ? "Jogar e ver a resposta" : "Ir para a posição e ver a resposta") + "</button></div>" +
      (sim.sel.opcao ? "" : '<p class="dica">Toque num número na quadra ou escolha na lista.</p>') + historicoEtapa();
  }
  function historicoEtapa() {
    var t = tentativasDaEtapa(); if (!t.length) return "";
    return '<div class="tentativas"><h3>Nesta decisão</h3><ul>' + t.map(function (x) {
      var o = opcaoDe(sim.cen, x.etapa, x.opcao), r = M.simular(K, sim.cen, sim.est, x.etapa, x).avaliacao;
      return "<li><span class=\"tag " + (x.primeira ? "tag-primeira" : "tag-explorada") + '">' + (x.primeira ? "Primeira escolha" : "Explorada") + "</span> " + esc(o.rotulo) + (x.altura ? ' <span class="det">· ' + M.NOME_ALTURA[x.altura] + " · " + M.NOME_INTENSIDADE[x.intensidade] + "</span>" : "") + ' <span class="det">· ' + esc(ROT_CURTO[r.nivel]) + "</span></li>";
    }).join("") + "</ul></div>";
  }
  function painelResultado() {
    var r = sim.res, av = r.avaliacao, etapa = etapaAtual(), o = opcaoDe(sim.cen, sim.est.etapa, sim.sel.opcao), ultima = !r.estadoFinal.etapa;
    var det = etapa.tipo === "golpe" ? '<p class="escolha">Sua escolha: <strong>' + esc(o.rotulo) + "</strong> · altura " + M.NOME_ALTURA[sim.sel.altura].toLowerCase() + " · intensidade " + M.NOME_INTENSIDADE[sim.sel.intensidade].toLowerCase() + "</p>"
      : '<p class="escolha">Sua escolha: <strong>' + esc(o.rotulo) + "</strong></p>";
    var txt = etapa.tipo === "golpe"
      ? "<p>" + esc(av.texto) + "</p><p>" + esc(av.notaAltura) + " " + esc(av.notaIntensidade) + "</p><p>" + esc(av.efeito) + "</p>" + (r.anim.pausa ? '<p class="nota">A animação para com a bola cruzando a rede: a próxima decisão é para onde você vai enquanto ela viaja.</p>' : '<p class="nota">Na quadra aparece uma resposta possível do adversário, coerente com o seu alvo. Ela não é uma previsão.</p>')
      : "<p>" + esc(av.texto) + "</p><p>" + esc(av.resposta) + " " + esc(av.textoCobertura) + "</p>";
    var notasV = (av.notasVariante || []).length ? '<div class="nota-var"><p class="sobre">Neste nível</p>' + av.notasVariante.map(function (x) { return "<p>" + esc(x) + "</p>"; }).join("") + "</div>" : "";
    var pv = r.previsao ? '<p class="previsao ' + (r.previsao.certa ? "ok" : "") + '">Você previu: <strong>' + esc(M.CATEGORIAS[r.previsao.escolhida]) + "</strong>. A resposta mostrada foi: <strong>" + esc(M.CATEGORIAS[r.respostaCategoria]) + "</strong>" + (r.previsao.certa ? " · +1 ponto de leitura" : ". Observe o que levou a ela.") + "</p>" : "";
    var obj = av.objetivo && K.OBJETIVOS ? '<p class="objetivo">Objetivo do método nesta escolha: <strong>' + esc(K.OBJETIVOS[av.objetivo]) + "</strong></p>" : "";
    return '<section class="feedback n-' + av.nivel + '" aria-labelledby="t-fb"><h2 id="t-fb" class="fb-rotulo">' + esc(av.rotulo) + "</h2>" + det + obj + txt + notasV + pv + "</section>" +
      '<div class="acoes empilhar"><button type="button" class="btn btn-primario largo" id="btSeguir">' + (ultima ? "Ver o resumo do cenário" : "Continuar o ponto") + '</button>' +
      '<button type="button" class="btn btn-secundario" id="btComparar">Comparar outra alternativa</button><button type="button" class="btn btn-texto" id="btRepetir">Repetir a animação</button></div>' + historicoEtapa();
  }
  function ligarPainel() {
    var p = $("#painel");
    $$('input[name="op"]', p).forEach(function (i) { i.addEventListener("change", function () { sim.sel.opcao = i.value; sim.sel.previsao = null; renderSim(); focarRadio("op", i.value); }); });
    $$('input[name="altura"], input[name="intensidade"], input[name="previsao"]', p).forEach(function (i) { i.addEventListener("change", function () { sim.sel[i.name] = i.value; renderSim(); focarRadio(i.name, i.value); }); });
    var j = $("#btJogar"); if (j) j.addEventListener("click", jogar);
    var s = $("#btSeguir"); if (s) s.addEventListener("click", seguir);
    var c = $("#btComparar"); if (c) c.addEventListener("click", function () { sim.fase = "escolha"; sim.res = null; renderSim(); var f = $('input[name="op"]:checked') || $('input[name="op"]'); if (f) f.focus(); });
    var rp = $("#btRepetir"); if (rp) rp.addEventListener("click", repetir);
  }
  function focarRadio(nome, v) { var i = $('input[name="' + nome + '"][value="' + v + '"]'); if (i) i.focus(); }
  function jogar() {
    if (sim.fase !== "escolha" || !sim.sel.opcao) return;
    var etapa = etapaAtual(), esc_ = { etapa: sim.est.etapa, opcao: sim.sel.opcao };
    if (etapa.tipo === "golpe") { esc_.altura = sim.sel.altura; esc_.intensidade = sim.sel.intensidade; }
    if (sim.sel.previsao && M.temResposta(sim.cen, sim.est.etapa, sim.sel.opcao)) esc_.previsao = sim.sel.previsao;
    var r = M.simular(K, sim.cen, sim.est, sim.est.etapa, esc_);
    var ex = sim.reg.execucao;
    ex.tentativas.push(Object.assign({ primeira: !tentativasDaEtapa().length, em: new Date().toISOString(), previsaoCerta: !!(r.previsao && r.previsao.certa) }, esc_));
    ex.pendente = esc_; sim.reg.atualizadoEm = new Date().toISOString(); salvar();
    sim.res = r; sim.fase = "animando"; renderSim();
    var quadra = $("#quadra"); if (quadra && quadra.getBoundingClientRect().top < 0) quadra.scrollIntoView({ behavior: reduzir.matches ? "auto" : "smooth", block: "start" });
    anunciar("Jogada em andamento.");
    sim.q.limpar("intencao"); sim.q.limpar("contexto");
    cenaInicial(sim.q, sim.cen, sim.est); sim.q.limpar("alvos"); sim.q.limpar("intencao");
    animar(sim.q, r.anim, function () {
      if (!sim || sim.res !== r) return;
      sim.fase = "resultado"; renderSim(); quadroEm(sim.q, r.anim, r.anim.dur, true);
      anunciar(r.avaliacao.rotulo + " " + (r.avaliacao.resumo || ""));
      var fb = $(".feedback"); if (fb && window.innerWidth < 900) fb.scrollIntoView({ behavior: reduzir.matches ? "auto" : "smooth", block: "nearest" });
      var b = $("#btSeguir"); if (b) b.focus({ preventScroll: true });
    });
  }
  function repetir() {
    if (sim.fase !== "resultado" || !sim.res) return;
    var r = sim.res; sim.fase = "animando"; renderSim();
    cenaInicial(sim.q, sim.cen, sim.est); sim.q.limpar("alvos"); sim.q.limpar("intencao"); sim.q.limpar("contexto");
    animar(sim.q, r.anim, function () { if (!sim || sim.res !== r) return; sim.fase = "resultado"; renderSim(); quadroEm(sim.q, r.anim, r.anim.dur, true); var b = $("#btRepetir"); if (b) b.focus(); });
  }
  function seguir() {
    if (sim.fase !== "resultado") return;
    var ex = sim.reg.execucao, r = sim.res;
    ex.caminho.push(ex.pendente); ex.pendente = null; sim.reg.atualizadoEm = new Date().toISOString();
    if (!r.estadoFinal.etapa) {
      ex.fim = true; sim.reg.concluidoEm = new Date().toISOString();
      var exploradas = ex.tentativas.length - ex.caminho.length, ganho = M.estrelas(K, sim.cen, ex.caminho, ex.tentativas, sim.variante);
      sim.reg.historico.push({ concluidoEm: sim.reg.concluidoEm, caminho: ex.caminho.slice(), exploradas: Math.max(0, exploradas), tentativas: ex.tentativas.slice(), estrelas: ganho.estrelas, leitura: ganho.leitura });
      sim.reg.historico = sim.reg.historico.slice(-20);
      marcarDia(); delete revisaoLivre[sim.chave];
      salvar(); ir("resumo-" + rotaSit(sim.cen.id, sim.n)); return;
    }
    salvar();
    sim.est = r.estadoFinal; sim.res = null; sim.fase = "escolha"; sim.sel = { opcao: null, altura: "media", intensidade: "firme", previsao: null };
    renderSim();
    var t = $(".etapa-num"); if (t) { t.setAttribute("tabindex", "-1"); t.focus(); }
    anunciar("Decisão " + etapaAtual().numero + " de 3. " + etapaAtual().situacao);
  }

  /* D. resumo e missão */
  function telaResumo(rota) {
    var st = sitDe(rota); if (!st) return ir("cenarios");
    var cen = st.cen, n = st.n, nv = nivelDe(n), id = st.chave;
    var reg = prog.cenarios[id], ultimo = reg && reg.historico.length ? reg.historico[reg.historico.length - 1] : null;
    if (!ultimo) return ir("jogar-" + rotaSit(cen.id, n));
    var rf = M.refazer(K, cen, ultimo.caminho, nv.variante);
    var proxN = n < NN ? n + 1 : null, liberou = proxN && M.nivelLiberado(prog, cen.id, proxN);
    var placarEstrelas = '<section class="cartao placar-final" aria-labelledby="t-est"><h2 id="t-est">' + estrelasHTML(ultimo.estrelas || 0) + ' <span class="sr">estrelas</span></h2><p>' + (ultimo.estrelas || 0) + " de 3 primeiras escolhas coerentes com o contexto" + (ultimo.leitura ? " · " + ultimo.leitura + (ultimo.leitura === 1 ? " ponto" : " pontos") + " de leitura" : "") + ".</p>" +
      (proxN ? (liberou ? '<p class="libera">Nível ' + proxN + " liberado: " + esc(nivelDe(proxN).nome) + '.</p><div class="acoes"><a class="btn btn-primario" href="#jogar-' + rotaSit(cen.id, proxN) + '">Jogar o nível ' + proxN + "</a></div>" : '<p class="det">Faça 2 estrelas para liberar o nível ' + proxN + " (" + esc(nivelDe(proxN).nome) + ").</p>") : '<p class="libera">Você completou todos os níveis deste padrão. Ele volta na revisão do dia, em outro contexto.</p>') + "</section>";
    var tent = ultimo.tentativas || [];
    var linhas = rf.passos.map(function (p) {
      var et = cen.etapas[p.escolha.etapa], o = opcaoDe(cen, p.escolha.etapa, p.escolha.opcao), av = p.resultado.avaliacao;
      var daEtapa = tent.filter(function (t) { return t.etapa === p.escolha.etapa; }), primeira = daEtapa.filter(function (t) { return t.primeira; })[0];
      var outras = daEtapa.filter(function (t) { return !(t.opcao === p.escolha.opcao && t.altura === p.escolha.altura && t.intensidade === p.escolha.intensidade); });
      var marca = primeira && primeira.opcao === p.escolha.opcao && primeira.altura === p.escolha.altura && primeira.intensidade === p.escolha.intensidade ? "Primeira escolha" : primeira ? "Escolhida depois de comparar" : "";
      return '<li class="cartao dec"><p class="etapa-num">Decisão ' + et.numero + " · " + esc(et.pergunta) + '</p><p class="dec-esc"><strong>' + esc(o.rotulo) + "</strong>" + (p.escolha.altura ? " · altura " + M.NOME_ALTURA[p.escolha.altura].toLowerCase() + " · intensidade " + M.NOME_INTENSIDADE[p.escolha.intensidade].toLowerCase() : "") + "</p>" +
        '<p><span class="tag n-' + av.nivel + '">' + esc(av.rotulo) + "</span>" + (marca ? ' <span class="tag tag-primeira">' + marca + "</span>" : "") + "</p><p>" + esc(av.resumo) + "</p>" +
        (outras.length ? '<p class="det">Também explorado: ' + outras.map(function (t) { var oo = opcaoDe(cen, t.etapa, t.opcao); return esc(oo.rotulo) + (t.altura ? " (" + M.NOME_ALTURA[t.altura].toLowerCase() + ", " + M.NOME_INTENSIDADE[t.intensidade].toLowerCase() + ")" : ""); }).join("; ") + ".</p>" : "") + "</li>";
    }).join("");
    var prox = K.CENARIOS[(cen.numero) % K.CENARIOS.length];
    tela('<a class="btn btn-texto voltar" href="#cenarios">Cenários</a><p class="cen-num">Resumo · Cenário ' + cen.numero + " · Nível " + n + "</p><h1>" + esc(cen.titulo) + '</h1><p class="placar"><span class="chip-placar">' + esc(nv.placar || cen.placar) + "</span> " + esc(cen.sacador) + "</p>" + variantesHTML(nv.variante) +
      placarEstrelas + '<ol class="decisoes">' + linhas + "</ol>" +
      '<section class="cartao missao" aria-labelledby="t-missao"><p class="sobre">Missão de treino</p><h2 id="t-missao">' + esc(cen.missao.titulo) + "</h2><p>" + esc(cen.missao.texto) + '</p><ol class="passos">' + cen.missao.passos.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol>" +
      '<div class="pergunta"><p class="sobre">Para observar em quadra</p><p class="pq">' + esc(K.PERGUNTA) + "</p>" + (cen.perguntaMetodo ? '<p class="pq2">' + esc(cen.perguntaMetodo) + "</p>" : "") + "</div></section>" +
      '<div class="acoes"><a class="btn btn-' + (proxN && liberou ? "secundario" : "primario") + '" href="#jogar-' + rotaSit(cen.id, n) + '" id="btOutro">Comparar outro caminho</a><a class="btn btn-secundario" href="#jogar-' + prox.id + '">Explorar próximo cenário</a></div>' +
      '<section class="cartao convite"><p>Você explorou essas situações no simulador. Quer entender como elas aparecem nas suas partidas?</p><div class="acoes"><a class="btn btn-secundario" href="#consultoria">Conhecer a consultoria</a></div><p class="det">O simulador continua disponível, sem contratar nada.</p></section>', "Resumo · " + cen.titulo);
  }

  /* ══ desafios ══ */
  var revisaoLivre = {}; /* níveis abertos pela revisão do dia, mesmo ainda bloqueados na campanha */
  function telaDesafios() {
    var rev = M.revisoes(K, prog), best = prog.relampago.melhor;
    var lista = rev.length ? '<ul class="revisoes">' + rev.slice(0, 5).map(function (r) {
      var c = POR_ID[r.cenario], nv = nivelDe(r.nivel);
      return '<li class="cartao"><p class="cen-num">Cenário ' + c.numero + " · nível " + r.nivel + "</p><h3>" + esc(c.titulo) + '</h3><p class="det">' + esc(nv.nome) + " · da última vez: " + estrelasHTML(r.estrelas) + '</p><div class="acoes"><button type="button" class="btn btn-secundario" data-rev="' + rotaSit(c.id, r.nivel) + '">Revisar</button></div></li>';
    }).join("") + "</ul>" : '<p class="det">Nenhuma revisão para hoje. Cada cenário que você conclui volta depois de 1, 3 ou 7 dias, conforme as estrelas, num contexto diferente.</p>';
    tela('<h1>Desafios</h1><p class="lead">Treine a leitura rápida e volte às situações no momento certo para fixar o que aprendeu.</p>' + hudHTML() +
      '<div class="duas"><section class="cartao relampago-c" aria-labelledby="t-rel"><p class="sobre">Modo relâmpago</p><h2 id="t-rel">10 decisões, 8 segundos cada</h2><p>Só o alvo, sem animação: a primeira leitura da situação. Como na Matriz três caminhos do método, a resposta precisa estar pronta antes da bola chegar.</p>' +
      '<p class="det">Sua melhor marca: <strong>' + best + "</strong> de 40 pontos.</p><div class=\"acoes\"><a class=\"btn btn-primario\" href=\"#relampago\">Jogar o relâmpago</a></div></section>" +
      '<section class="cartao" aria-labelledby="t-rev"><p class="sobre">Revisão do dia</p><h2 id="t-rev">Situações para rever</h2><p class="det">O mesmo princípio, em outro contexto: é assim que se vê se ele foi aprendido.</p>' + lista + "</section></div>", "Desafios");
    $$("[data-rev]").forEach(function (b) { b.addEventListener("click", function () { var st = sitDe(b.getAttribute("data-rev")); if (!st) return; revisaoLivre[st.chave] = true; ir("jogar-" + b.getAttribute("data-rev")); }); });
  }

  /* modo relâmpago: 10 decisões de golpe sorteadas, 6 s para escolher o alvo, sem animação */
  var rel = null, RELAMPAGO_S = 8;
  function telaRelampago() {
    pararRelogio();
    var pool = M.poolRelampago(K).filter(function (x) { return M.nivelLiberado(prog, x.cenario, x.nivel) || x.nivel === 1; });
    var sorteio = [], usados = {};
    while (sorteio.length < 10 && sorteio.length < pool.length) { var i = Math.floor(Math.random() * pool.length), k = pool[i].cenario + pool[i].etapa; if (usados[k] && Object.keys(usados).length < pool.length) continue; usados[k] = 1; sorteio.push(pool[i]); }
    rel = { itens: sorteio, i: 0, pontos: 0, respostas: [], t0: 0, bloqueado: false };
    tela('<a class="btn btn-texto voltar" href="#desafios">Desafios</a><h1>Relâmpago</h1><p class="lead">Escolha o alvo antes de o tempo acabar. A altura e a intensidade ficam na faixa natural de cada alvo.</p>' +
      '<div class="rel-topo"><p id="relConta" class="rel-conta"></p><p id="relPontos" class="rel-pontos"></p></div><div class="rel-barra" aria-hidden="true"><i id="relBarra"></i></div>' +
      '<div class="sim-grade rel"><div class="sim-quadra"><div class="quadra-host" id="quadra"></div></div><div class="sim-painel" id="painel"></div></div>', "Relâmpago");
    rel.q = Quadra($("#quadra"), { rotulo: "Quadra do modo relâmpago." });
    rodadaRelampago();
  }
  var relogio = 0;
  function pararRelogio() { if (relogio) { clearInterval(relogio); relogio = 0; } }
  function rodadaRelampago() {
    pararRelogio();
    if (!rel) return;
    if (rel.i >= rel.itens.length) return fimRelampago();
    var it = rel.itens[rel.i], cen = POR_ID[it.cenario], etapa = cen.etapas[it.etapa], nv = nivelDe(it.nivel);
    cenaInicial(rel.q, cen, it.estado);
    rel.bloqueado = false;
    function escolher(id) {
      if (rel.bloqueado) return;
      rel.bloqueado = true; pararRelogio();
      var o = opcaoDe(cen, it.etapa, id), e = M.escolhaPadrao(o); e.opcao = id;
      var av = M.simular(K, cen, it.estado, it.etapa, e).avaliacao, seg = (Date.now() - rel.t0) / 1000;
      var pts = M.PONTOS_NIVEL[av.nivel] + (seg < 3 && av.nivel === "coerente" ? 1 : 0);
      rel.pontos += pts; rel.respostas.push({ cen: cen, etapa: etapa, o: o, av: av, pts: pts, seg: seg });
      mostrarRetornoRel(av, pts);
    }
    desenharAlvos(rel.q, etapa.opcoes.map(function (o) { return { id: o.id, p: o.alvo, rotulo: o.rotulo }; }), null, escolher, false);
    $("#relConta").textContent = "Decisão " + (rel.i + 1) + " de " + rel.itens.length;
    $("#relPontos").textContent = rel.pontos + " pontos";
    $("#painel").innerHTML = '<p class="etapa-num">' + esc(cen.titulo) + " · nível " + it.nivel + '</p><p class="placar"><span class="chip-placar">' + esc(nv.placar || cen.placar) + "</span> " + esc(cen.lado) + "</p>" + variantesHTML(nv.variante) +
      '<p class="situacao">' + esc(etapa.situacao) + '</p><div class="opcoes" role="group" aria-label="' + esc(etapa.pergunta) + '">' + etapa.opcoes.map(function (o, i) { return '<button type="button" class="op" data-rel="' + o.id + '"><span class="num" aria-hidden="true">' + (i + 1) + '</span><span class="op-txt">' + esc(o.rotulo) + "</span></button>"; }).join("") + '</div><p id="relRet" class="rel-ret" aria-live="polite"></p>';
    $$("[data-rel]").forEach(function (b) { b.addEventListener("click", function () { escolher(b.getAttribute("data-rel")); }); });
    var topo = $(".rel-topo"); if (topo && rel.i > 0) topo.scrollIntoView({ block: "start", behavior: reduzir.matches ? "auto" : "smooth" });
    rel.t0 = Date.now();
    var barra = $("#relBarra");
    relogio = setInterval(function () {
      var f = Math.max(0, 1 - (Date.now() - rel.t0) / (RELAMPAGO_S * 1000));
      if (barra) barra.style.width = (f * 100).toFixed(1) + "%";
      if (f <= 0) {
        pararRelogio(); if (rel.bloqueado) return; rel.bloqueado = true;
        rel.respostas.push({ cen: cen, etapa: etapa, o: null, av: null, pts: 0, seg: RELAMPAGO_S });
        mostrarRetornoRel(null, 0);
      }
    }, 100);
    var f1 = $("[data-rel]"); if (f1) f1.focus({ preventScroll: true });
  }
  function mostrarRetornoRel(av, pts) {
    $$("[data-rel]").forEach(function (b) { b.disabled = true; });
    $("#relRet").innerHTML = av ? '<span class="tag n-' + av.nivel + '">' + esc(av.rotulo) + "</span> +" + pts + " · " + esc(av.resumo) : "<strong>Tempo esgotado.</strong> No jogo, a bola não espera: a decisão vem antes de ela chegar.";
    $("#relPontos").textContent = rel.pontos + " pontos";
    var proximo = function () { if (!rel) return; rel.i++; rodadaRelampago(); };
    var b = document.createElement("button"); b.type = "button"; b.className = "btn btn-primario largo"; b.textContent = rel.i + 1 >= rel.itens.length ? "Ver resultado" : "Próxima decisão";
    b.addEventListener("click", proximo); $("#painel").appendChild(b); b.focus({ preventScroll: true });
  }
  function fimRelampago() {
    var r = rel, recorde = r.pontos > prog.relampago.melhor;
    prog.relampago.melhor = Math.max(prog.relampago.melhor, r.pontos);
    prog.relampago.partidas = prog.relampago.partidas.concat([{ em: new Date().toISOString(), pontos: r.pontos }]).slice(-20);
    marcarDia(); salvar();
    tela('<a class="btn btn-texto voltar" href="#desafios">Desafios</a><h1>Relâmpago: ' + r.pontos + ' pontos</h1><p class="lead">' + (recorde ? "Nova melhor marca. " : "") + "Coerente vale 3, possível para começar vale 2, exige mais controle ou devolve a iniciativa vale 1. Coerente em menos de 3 segundos ganha +1.</p>" +
      '<ol class="decisoes">' + r.respostas.map(function (x, i) {
        return '<li class="cartao dec"><p class="etapa-num">' + (i + 1) + ". " + esc(x.cen.titulo) + "</p><p>" + esc(x.etapa.situacao) + "</p>" + (x.av ? '<p class="dec-esc"><strong>' + esc(x.o.rotulo) + '</strong> · ' + x.seg.toFixed(1) + ' s</p><p><span class="tag n-' + x.av.nivel + '">' + esc(x.av.rotulo) + "</span> +" + x.pts + "</p><p>" + esc(x.av.texto) + "</p>" : '<p class="dec-esc"><strong>Tempo esgotado</strong></p>') + "</li>";
      }).join("") + '</ol><div class="acoes"><a class="btn btn-primario" href="#relampago" id="btRelNovo">Jogar de novo</a><a class="btn btn-secundario" href="#desafios">Voltar aos desafios</a></div>', "Relâmpago");
    var b = $("#btRelNovo"); if (b) b.addEventListener("click", function (e) { e.preventDefault(); telaRelampago(); });
    rel = null;
  }

  /* E. progresso */
  function telaProgresso(confirmar) {
    var cards = K.CENARIOS.map(function (c) {
      var linhas = [], acao = "", andamento = null, algum = false;
      NIVEIS.forEach(function (nv) {
        var chave = M.chaveSituacao(c.id, nv.n), st = situacao(chave), reg = prog.cenarios[chave], best = M.melhorEstrelas(prog, chave);
        if (st.estado === "novo") return;
        algum = true;
        if (st.estado === "andamento" && !andamento) andamento = { n: nv.n, etapa: st.etapa };
        var hist = reg && reg.historico.length ? '<details><summary>Histórico (' + reg.historico.length + (reg.historico.length === 1 ? " vez" : " vezes") + ')</summary><ul class="hist">' + reg.historico.slice().reverse().map(function (h) {
          return "<li><strong>" + dataBR(h.concluidoEm) + "</strong> " + estrelasHTML(h.estrelas || 0) + " · " + h.caminho.map(function (e) { return esc(opcaoDe(c, e.etapa, e.opcao).rotulo); }).join(" → ") + (h.exploradas ? ' <span class="det">(' + h.exploradas + (h.exploradas === 1 ? " alternativa explorada" : " alternativas exploradas") + ")</span>" : "") + "</li>";
        }).join("") + "</ul></details>" : "";
        linhas.push('<li><p><strong>Nível ' + nv.n + "</strong> " + (best >= 0 ? estrelasHTML(best) : "") + ' <span class="cen-estado e-' + st.estado + '">' + esc(st.rotulo) + "</span></p>" + (reg && reg.execucao.tentativas.length && !reg.execucao.fim ? '<p class="det">Tentativas no caminho atual: ' + reg.execucao.tentativas.length + "</p>" : "") + hist + "</li>");
      });
      if (andamento) acao = '<a class="btn btn-primario" href="#jogar-' + rotaSit(c.id, andamento.n) + '">Retomar na decisão ' + andamento.etapa + (andamento.n > 1 ? " (nível " + andamento.n + ")" : "") + "</a>";
      else if (algum) acao = '<a class="btn btn-secundario" href="#jogar-' + c.id + '">Jogar de novo</a><a class="btn btn-texto" href="#resumo-' + c.id + '">Ver resumo</a>';
      else acao = '<a class="btn btn-secundario" href="#jogar-' + c.id + '">Começar</a>';
      return '<article class="cartao prog"><p class="cen-num">Cenário ' + c.numero + "</p><h2>" + esc(c.titulo) + "</h2>" + (linhas.length ? '<ul class="niveis-prog">' + linhas.join("") + "</ul>" : '<p class="cen-estado e-novo">Não iniciado</p>') + '<div class="acoes">' + acao + "</div></article>";
    }).join("");
    function algumNivel(c, f) { return NIVEIS.some(function (nv) { return f(M.chaveSituacao(c.id, nv.n)); }); }
    var concluidos = K.CENARIOS.filter(function (c) { return algumNivel(c, function (k) { var r = prog.cenarios[k]; return r && r.historico.length; }); });
    var iniciados = K.CENARIOS.filter(function (c) { return algumNivel(c, function (k) { return situacao(k).estado !== "novo"; }); }).length;
    var missoes = concluidos.length ? '<ul class="missoes">' + concluidos.map(function (c) { return '<li class="cartao"><p class="sobre">Cenário ' + c.numero + "</p><h3>" + esc(c.missao.titulo) + "</h3><p>" + esc(c.missao.texto) + "</p></li>"; }).join("") + "</ul>" : '<p class="det">As missões aparecem aqui quando você conclui um cenário.</p>';
    tela('<h1>Meu progresso</h1><p class="lead">' + iniciados + " de " + TOTAL + " cenários iniciados · " + concluidos.length + " de " + TOTAL + " concluídos.</p>" + hudHTML() +
      '<p class="aviso-local">Seu progresso fica salvo só neste navegador, neste aparelho. Ele não aparece em outro aparelho e some se os dados do navegador forem apagados.</p>' +
      '<div class="grade-cen">' + cards + "</div><section class=\"bloco\" aria-labelledby=\"t-mis\"><h2 id=\"t-mis\">Missões de treino</h2>" + missoes + "</section>" +
      '<section class="bloco limpar" id="limpar">' + (confirmar ? '<div class="cartao confirma" role="alertdialog" aria-labelledby="t-conf" aria-describedby="d-conf"><h2 id="t-conf">Limpar todo o progresso?</h2><p id="d-conf">Os cenários voltam para o início e o histórico de tentativas é apagado deste navegador. Não dá para desfazer.</p><div class="acoes"><button type="button" class="btn btn-perigo" id="btLimparSim">Limpar progresso</button><button type="button" class="btn btn-secundario" id="btLimparNao">Cancelar</button></div></div>'
        : '<button type="button" class="btn btn-texto" id="btLimpar">Limpar progresso</button>') + "</section>", "Meu progresso");
    var b = $("#btLimpar"); if (b) b.addEventListener("click", function () { telaProgresso(true); var s = $("#btLimparNao"); if (s) { s.focus(); $("#limpar").scrollIntoView({ block: "center" }); } });
    var sN = $("#btLimparNao"); if (sN) sN.addEventListener("click", function () { telaProgresso(false); var x = $("#btLimpar"); if (x) x.focus(); });
    var sS = $("#btLimparSim"); if (sS) sS.addEventListener("click", function () { prog = M.progressoVazio(); try { localStorage.removeItem(M.CHAVE); localStorage.removeItem(M.CHAVE_RESUMO); } catch (e) { /* sem armazenamento */ } telaProgresso(false); anunciar("Progresso apagado."); });
  }

  /* F. módulo completo (planejado) */
  function telaModulo() {
    var m = K.MODULO;
    tela('<p class="sobre">Módulo planejado</p><h1>' + esc(m.titulo) + '</h1><p class="lead">Um produto digital para treinar as decisões que abrem o ponto: do saque e da devolução até a primeira bola e a recuperação.</p>' +
      '<div class="duas"><section class="cartao"><h2>O que está planejado</h2><ul class="lista">' + m.itens.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + '</ul><p class="preco">' + esc(m.preco) + ' <span class="tag">' + esc(m.precoNota) + "</span></p><p class=\"det\">Valor de teste, ainda não validado.</p></section>" +
      '<section class="cartao"><h2>O que existe hoje</h2><ul class="lista"><li>Os três cenários iniciais são gratuitos.</li>' + (PREVIA.length ? "<li>Outros " + PREVIA.length + " cenários estão abertos nesta versão de teste como prévia do conteúdo planejado, ainda em revisão. Na versão real, fariam parte de módulos como este.</li>" : "") + '<li>Os demais cenários do módulo ainda não existem.</li><li>O módulo completo não inclui análise individual das suas partidas.</li><li>Não há compra nesta versão: nenhum pagamento é feito por aqui.</li></ul><div class="acoes"><a class="btn btn-primario" href="#cenarios">Experimentar os cenários gratuitos</a><a class="btn btn-texto" href="#consultoria">Conhecer a consultoria</a></div></section></div>', m.titulo);
  }

  /* G. consultoria */
  function telaConsultoria() {
    tela('<p class="sobre">Consultoria individual · Richard Tsukada</p><h1>Clareza sobre o que trabalhar. Direção para aplicar.</h1>' +
      '<p class="lead">O simulador ajuda você a explorar decisões. A consultoria analisa como essas situações aparecem nas suas partidas.</p>' +
      '<div class="duas"><section class="cartao"><h2>O que a consultoria entrega</h2><ul class="lista"><li>Análise de 3 partidas completas.</li><li>Até 6 horas de gravação no total.</li><li>Devolutiva gravada por Richard Tsukada.</li><li>Documento com prioridades e plano de ação.</li><li>Uma rodada de esclarecimentos.</li><li>Orientações para aplicação pelo seu professor atual ou pelo profissional que você escolher.</li></ul>' +
      '<p class="det">A análise é feita sobre as três partidas completas; ela não é substituída por poucos minutos de vídeo.</p></section>' +
      '<section class="cartao"><h2>O que não está incluído</h2><ul class="lista"><li>Aulas presenciais: você combina diretamente com o professor responsável pela aplicação.</li><li>Reavaliação futura, que é contratada separadamente.</li></ul>' +
      '<p class="preco">R$ 2.000 <span class="tag">valor em avaliação</span></p><p class="det">Preço ilustrativo deste protótipo, por projeto. Escopo, qualidade do material, prazo e preço são confirmados antes de qualquer contratação real.</p></section></div>' +
      '<section class="cartao"><h2>Como seria o processo</h2><ol class="fluxo"><li>Solicitação</li><li>Validação do material e do escopo</li><li>Confirmação comercial</li><li>Pagamento</li><li>Análise</li><li>Entrega</li><li>Esclarecimentos</li></ol>' +
      '<div class="acoes"><a class="btn btn-primario" href="#pedido">Simular uma solicitação</a><a class="btn btn-texto" href="#cenarios">Voltar ao simulador</a></div><p class="det">Nesta versão a solicitação é uma demonstração: nada é enviado e nada é cobrado.</p></section>', "Consultoria individual");
  }

  /* H. solicitação (demonstração): preencher → revisar → concluir */
  var pedido = { nome: "", perfil: "", objetivo: "", aplicacao: "", partidas: "", descricao: "" }, passoPedido = "form";
  var OPC = {
    perfil: [["jogador", "Jogador adulto"], ["responsavel", "Responsável por um jogador"], ["professor", "Professor"]],
    objetivo: [["construcao", "Construir melhor os pontos"], ["saque", "Saque e devolução"], ["decisoes", "Decisões em pontos importantes"], ["defesa", "Sair da defesa"], ["outro", "Outro objetivo"]],
    aplicacao: [["professor_atual", "O professor atual do jogador"], ["outro_prof", "Outro profissional que vou escolher"], ["nao_sei", "Ainda não sei"]],
    partidas: [["tenho", "Já tenho as três partidas gravadas"], ["parte", "Tenho parte das gravações"], ["vou", "Ainda vou gravar"]],
  };
  function nomeOpc(campo, v) { var x = OPC[campo].filter(function (o) { return o[0] === v; })[0]; return x ? x[1] : ""; }
  function errosPedido() {
    var e = {};
    if (pedido.nome.trim().length < 2) e.nome = "Escreva um nome (pode ser fictício).";
    ["perfil", "objetivo", "aplicacao", "partidas"].forEach(function (k) { if (!pedido[k]) e[k] = "Escolha uma opção."; });
    var n = pedido.descricao.trim().length;
    if (n < 15) e.descricao = "Escreva pelo menos 15 caracteres."; else if (n > 1000) e.descricao = "Use no máximo 1.000 caracteres.";
    return e;
  }
  function telaPedido() {
    var aviso = '<p class="aviso-demo" role="note"><strong>Simulação.</strong> Use informações fictícias. Nada é enviado, nenhum vídeo ou link é recebido e nada é cobrado.</p>';
    if (passoPedido === "revisar") {
      var linha = function (r, v) { return "<div><dt>" + r + "</dt><dd>" + esc(v) + "</dd></div>"; };
      tela('<a class="btn btn-texto voltar" href="#consultoria">Consultoria</a><h1>Revise a solicitação</h1>' + aviso + '<dl class="revisao cartao">' + linha("Nome", pedido.nome) + linha("Solicitação como", nomeOpc("perfil", pedido.perfil)) + linha("Principal objetivo", nomeOpc("objetivo", pedido.objetivo)) +
        linha("Quem aplicaria as orientações", nomeOpc("aplicacao", pedido.aplicacao)) + linha("As três partidas", nomeOpc("partidas", pedido.partidas)) + linha("O que você quer entender", pedido.descricao) + "</dl>" +
        '<div class="acoes"><button type="button" class="btn btn-primario" id="btConcluir">Concluir demonstração</button><button type="button" class="btn btn-secundario" id="btEditar">Editar</button></div>', "Revisar solicitação");
      $("#btEditar").addEventListener("click", function () { passoPedido = "form"; telaPedido(); });
      $("#btConcluir").addEventListener("click", function () { passoPedido = "fim"; telaPedido(); });
      return;
    }
    if (passoPedido === "fim") {
      tela('<h1>Demonstração concluída</h1><div class="cartao"><p>Esta foi uma simulação: <strong>nenhum dado foi enviado</strong>, nenhum vídeo ou link foi recebido e nada foi cobrado.</p><p>Na versão real, o caminho seria:</p><ol class="fluxo"><li>Solicitação</li><li>Validação do material e do escopo</li><li>Confirmação comercial</li><li>Pagamento</li><li>Análise</li><li>Entrega</li><li>Esclarecimentos</li></ol></div>' +
        '<div class="acoes"><a class="btn btn-primario" href="#cenarios">Voltar ao simulador</a><button type="button" class="btn btn-texto" id="btNovo">Fazer outra simulação</button></div>', "Demonstração concluída");
      $("#btNovo").addEventListener("click", function () { pedido = { nome: "", perfil: "", objetivo: "", aplicacao: "", partidas: "", descricao: "" }; passoPedido = "form"; telaPedido(); });
      return;
    }
    var radios = function (campo, legenda) {
      return '<fieldset class="campo" id="f-' + campo + '"><legend>' + legenda + '</legend><div class="radios">' + OPC[campo].map(function (o) {
        return '<label><input type="radio" name="' + campo + '" value="' + o[0] + '"' + (pedido[campo] === o[0] ? " checked" : "") + "> " + esc(o[1]) + "</label>";
      }).join("") + '</div><p class="erro" id="e-' + campo + '" hidden></p></fieldset>';
    };
    tela('<a class="btn btn-texto voltar" href="#consultoria">Consultoria</a><h1>Solicitar a consultoria</h1>' + aviso +
      '<form id="formPedido" class="form cartao" novalidate><div class="campo"><label for="nome">Nome</label><input id="nome" name="nome" type="text" autocomplete="off" maxlength="80" value="' + esc(pedido.nome) + '" aria-describedby="e-nome"><p class="erro" id="e-nome" hidden></p></div>' +
      radios("perfil", "Você está solicitando como") +
      '<div class="campo"><label for="objetivo">Principal objetivo da análise</label><select id="objetivo" name="objetivo" aria-describedby="e-objetivo"><option value="">Escolha</option>' + OPC.objetivo.map(function (o) { return '<option value="' + o[0] + '"' + (pedido.objetivo === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + '</select><p class="erro" id="e-objetivo" hidden></p></div>' +
      radios("aplicacao", "Quem aplicaria as orientações") + radios("partidas", "Disponibilidade das três partidas gravadas") +
      '<div class="campo"><label for="descricao">O que você quer entender</label><textarea id="descricao" name="descricao" rows="5" maxlength="1000" placeholder="Quero entender como construir melhor o ponto depois do meu saque." aria-describedby="contador e-descricao">' + esc(pedido.descricao) + '</textarea>' +
      '<p class="contador" id="contador" aria-live="polite"></p><p class="erro" id="e-descricao" hidden></p></div>' +
      '<div class="acoes"><button type="submit" class="btn btn-primario">Revisar</button></div></form>', "Solicitar a consultoria");
    var f = $("#formPedido"), ta = $("#descricao");
    function contar() { var n = ta.value.trim().length; $("#contador").textContent = n + " de 1.000 caracteres" + (n < 15 ? " (mínimo 15)" : ""); }
    contar(); ta.addEventListener("input", contar);
    f.addEventListener("input", function (e) { var t = e.target; if (t.name && t.name in pedido) pedido[t.name] = t.value; });
    f.addEventListener("change", function (e) { var t = e.target; if (t.name && t.name in pedido) pedido[t.name] = t.value; });
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var er = errosPedido(), primeiro = null;
      ["nome", "perfil", "objetivo", "aplicacao", "partidas", "descricao"].forEach(function (k) {
        var p = $("#e-" + k); p.hidden = !er[k]; p.textContent = er[k] || "";
        var alvo = k === "perfil" || k === "aplicacao" || k === "partidas" ? $('input[name="' + k + '"]') : $("#" + k);
        if (alvo) { if (er[k]) alvo.setAttribute("aria-invalid", "true"); else alvo.removeAttribute("aria-invalid"); }
        if (er[k] && !primeiro) primeiro = alvo;
      });
      if (primeiro) { primeiro.focus(); anunciar("Confira os campos destacados."); return; }
      passoPedido = "revisar"; telaPedido();
    });
  }

  /* ── rotas ── */
  function rotear() {
    var h = location.hash.replace(/^#/, "") || "inicio";
    if (h === "conteudo") return;
    if (h !== "relampago") { pararRelogio(); rel = null; }
    if (h.indexOf("jogar-") === 0) return telaSimulador(h.slice(6));
    if (h.indexOf("resumo-") === 0) return telaResumo(h.slice(7));
    if (h === "cenarios") return telaCenarios();
    if (h === "desafios") return telaDesafios();
    if (h === "relampago") return telaRelampago();
    if (h === "progresso") return telaProgresso(false);
    if (h === "modulo") return telaModulo();
    if (h === "consultoria") return telaConsultoria();
    if (h === "pedido") { if (passoPedido === "fim") passoPedido = "form"; return telaPedido(); }
    telaInicio();
  }
  window.addEventListener("hashchange", function () { if (location.hash !== "#conteudo") rotear(); });
  var pular = $(".pular"); if (pular) pular.addEventListener("click", function (e) { e.preventDefault(); app.focus(); });
  window.addEventListener("storage", function (e) { if (e.key === M.CHAVE) prog = carregar(); });
  rotear();
  window.QLD_APP = { estado: function () { return { sim: sim, prog: prog }; } };
})();
