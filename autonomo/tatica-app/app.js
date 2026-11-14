/* QuadraLab Tática · protótipo (pedidos do Richard em 14/11/2026: "Faça o app separado... só um protótipo" e "pense em um app que seja
   uma solução para o jogador de tênis que não sabe o que fazer em quadra e possa aprender com a plataforma"). Sem publicar.
   O jogador conta onde trava (diagnóstico) → o app monta uma trilha de situações do manual do Richard → cada situação é um ciclo:
   entender → decidir no app (Pausa e decide) → simulador → treinar em quadra → usar no jogo (plano + registro) → revisar em outro dia.
   Conteúdo: as 96 situações (mty/situacoes-jogo.js, sem mudar o arquivo), o manual completo (manual-completo.js), o Simulador de Decisões
   (autonomo/decisoes) e vídeos do YouTube com pausa na decisão. Sem conta, sem servidor, sem IA e sem cobrança: tudo no aparelho ("qlt:v1"). */
(function () {
  "use strict";
  var S = window.MTYSituacoes, MAN = window.QLTManual || [], app = document.getElementById("app");
  if (!S) { app.innerHTML = '<p class="cartao">Não foi possível carregar o manual tático.</p>'; return; }

  /* ── utilidades ── */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(sel) { return app.querySelector(sel); }
  function cada(sel, f) { Array.prototype.forEach.call(app.querySelectorAll(sel), f); }
  function frases(t) { return String(t || "").split(/(?<=[.!?])\s+/).filter(Boolean); }
  var tmrToast = null;
  function toast(t) { var el = document.getElementById("toast"); el.textContent = t; el.hidden = false; clearTimeout(tmrToast); tmrToast = setTimeout(function () { el.hidden = true; }, 2800); }
  function tela(h) { pararVideo(); app.innerHTML = h; window.scrollTo(0, 0); try { app.focus({ preventScroll: true }); } catch (e) { /* sem foco */ } }
  function hoje() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function dataBR(iso) { var p = String(iso || "").slice(0, 10).split("-"); return p.length === 3 ? p[2] + "/" + p[1] : ""; }
  function dias(isoA, isoB) { return Math.floor((Date.parse(String(isoB).slice(0, 10)) - Date.parse(String(isoA).slice(0, 10))) / 864e5); }
  function maisDias(iso, n) { var d = new Date(String(iso).slice(0, 10) + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
  function novoId(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function chip(attr, v, rot, on) { return '<button type="button" class="chip" ' + attr + '="' + esc(v) + '" aria-pressed="' + !!on + '">' + rot + "</button>"; }
  function params() { var q = (location.hash.split("?")[1] || ""), o = {}; q.split("&").forEach(function (kv) { var p = kv.split("="); if (p[0]) o[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ""); }); return o; }

  /* ── estado do aparelho ── */
  var CHAVE = "qlt:v1", est;
  function carregar() {
    try { est = JSON.parse(localStorage.getItem(CHAVE) || "null"); } catch (e) { est = null; }
    if (!est || typeof est !== "object") est = {};
    est.vistas = est.vistas || {}; est.prog = est.prog || {};
    est.planos = Array.isArray(est.planos) ? est.planos : []; est.jogos = Array.isArray(est.jogos) ? est.jogos : []; est.videos = Array.isArray(est.videos) ? est.videos : [];
    est.trilha = Array.isArray(est.trilha) ? est.trilha : [];
    if (est.treinadas) { Object.keys(est.treinadas).forEach(function (c) { prog(c).quadra = est.treinadas[c]; }); delete est.treinadas; } // versão anterior do protótipo
  }
  function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(est)); } catch (e) { /* sem armazenamento: segue na memória */ } }
  function prog(cod) { return est.prog[cod] || (est.prog[cod] = { quiz: [] }); }
  carregar();

  /* ── conteúdo ── */
  var FICHAS = S.FICHAS.map(function (f) { return { cod: f[0], nome: f[1], faixa: f[2], prio: f[3], ler: f[4], decidir: f[5], exercicio: f[6], variar: f[7], medir: f[8], m: f[0].charAt(0) }; });
  var POR_COD = {}; FICHAS.forEach(function (f) { POR_COD[f.cod] = f; });
  var MOMENTOS = S.MOMENTOS, NOME_MOMENTO = {}; MOMENTOS.forEach(function (m) { NOME_MOMENTO[m.l] = m.n; });
  var NIVEIS = S.NIVEIS, PRIO = { P1: "Base", P2: "Desenvolvimento", P3: "Avançado" };
  var CTX = {}; S.CONTEXTOS.forEach(function (c) { CTX[c[0]] = { cod: c[0], nome: c[1], dica: c[2], grupo: c[3] }; });
  var CTX_ADV = ["X09", "X10", "X11", "X12", "X13", "X14", "X15", "X16", "X17", "X18", "X19", "X20", "X21", "X22", "X23", "X24"];
  var CTX_COND = ["X25", "X26", "X27", "X28", "X29", "X30", "X31", "X32"];
  var CTX_PLACAR = ["X02", "X05", "X06"];
  /* que momentos do jogo treinar contra cada tipo de adversário (proposta do protótipo; o Richard ajusta) */
  var MOMENTO_DO_ADV = { X09: ["C", "T"], X10: ["D", "C"], X11: ["T", "N"], X12: ["C", "D"], X13: ["R", "D"], X14: ["R"], X15: ["R", "D"], X16: ["C"],
    X17: ["S", "R"], X18: ["C"], X19: ["C", "T"], X20: ["F"], X21: ["F", "S"], X22: ["C"], X23: ["C", "T"], X24: ["F"] };
  /* diagnóstico na língua do jogador → situações do manual, na ordem de aprender (proposta do protótipo; o Richard ajusta) */
  var PROBLEMAS = [
    { id: "atacar", t: "Não sei quando atacar e quando esperar", f: ["F05", "F10", "T01", "T06"] },
    { id: "erro", t: "Erro demais tentando ganhar o ponto", f: ["F11", "F05", "F07", "C02"] },
    { id: "passando", t: "Fico só passando a bola e o outro manda no ponto", f: ["C01", "F08", "C02", "C05"] },
    { id: "saque", t: "Meu saque não me ajuda no ponto", f: ["S01", "S05", "S07", "S10"] },
    { id: "devolucao", t: "Sofro na devolução", f: ["R01", "R07", "R11", "R03"] },
    { id: "pressao", t: "Quando o outro me pressiona, não sei sair", f: ["F03", "D01", "D02", "C12"] },
    { id: "rede", t: "Subo à rede e não sei o que fazer lá", f: ["T06", "N01", "N12", "N07"] },
    { id: "placar", t: "Travo no placar apertado", f: ["F12", "S05", "R07", "F11"] },
    { id: "duplas", t: "Jogo duplas e não sei me posicionar", f: ["U01", "U02", "U08", "U09"] },
  ];
  var POR_PROBLEMA = {}; PROBLEMAS.forEach(function (p) { POR_PROBLEMA[p.id] = p; });

  function nivelNum(n) { return +String(n || "N2").slice(1); }
  function servePara(f, nivel) { var m = String(f.faixa).match(/N(\d)(?:\s*a\s*N(\d))?/); if (!m) return true; var a = +m[1], b = m[2] != null ? +m[2] : a, n = nivelNum(nivel); return n >= a && n <= b; }
  function meuNivel() { return est.nivel || "N2"; }
  function nomeNivel(n) { var x = NIVEIS.filter(function (v) { return v[0] === n; })[0]; return x ? x[2] : n; }
  function faixaTxt(f) { return f.faixa.replace(/N(\d)/g, function (m, d) { return nomeNivel("N" + d); }); }

  /* ══ Aprendizagem de uma situação: seis passos ══ */
  var PASSOS = [
    { k: "leu", t: "Entender", s: "O que ler e como decidir" },
    { k: "decide", t: "Decidir no app", s: "Pausa e decide: leitura e decisão" },
    { k: "sim", t: "Simulador", s: "Escolher a jogada e ver a resposta" },
    { k: "quadra", t: "Treinar em quadra", s: "O exercício, com um parceiro" },
    { k: "jogo", t: "Usar no jogo", s: "Plano antes, registro depois" },
    { k: "retida", t: "Revisar em outro dia", s: "Sem olhar a ficha, pelo menos 2 dias depois" },
  ];
  function passoFeito(cod, k) {
    var p = est.prog[cod]; if (!p) return false;
    if (k === "decide") return p.quiz.some(function (q) { return q.ok; });
    if (k === "jogo") return est.jogos.some(function (j) { return j.cod === cod && j.apareceu === "sim"; });
    return !!p[k];
  }
  function feitos(cod) { return PASSOS.filter(function (x) { return passoFeito(cod, x.k); }).length; }
  function estado(cod) {
    if (passoFeito(cod, "retida")) return ["Aprendida", "ok"];
    if (passoFeito(cod, "jogo")) return ["Usada no jogo", "ok"];
    if (passoFeito(cod, "quadra")) return ["Treinada", "azul"];
    if (passoFeito(cod, "decide")) return ["Decide no app", "azul"];
    if (passoFeito(cod, "leu")) return ["Entendida", "azul"];
    return ["Nova", ""];
  }
  function proximoPasso(cod) { return PASSOS.filter(function (x) { return !passoFeito(cod, x.k); })[0] || null; }
  function linkPasso(cod, k) { return k === "decide" ? "#/quiz/" + cod : k === "sim" ? "#/simulador" : k === "jogo" ? "#/jogo?cod=" + cod : k === "retida" ? "#/quiz/" + cod + "?revisao=1" : "#/situacao/" + cod; }
  function situacaoAtual() { return est.trilha.filter(function (c) { return !(passoFeito(c, "quadra") && passoFeito(c, "jogo")); })[0] || null; }
  function ultimoAcerto(cod) { var q = (est.prog[cod] || { quiz: [] }).quiz.filter(function (x) { return x.ok; }); return q.length ? q[q.length - 1].em : null; }
  function revisoesDeHoje() {
    return Object.keys(est.prog).filter(function (c) { var u = ultimoAcerto(c); return u && !passoFeito(c, "retida") && dias(u, hoje()) >= 2; });
  }

  /* ══ Início e diagnóstico ══ */
  var diag = null;
  function montarTrilha(probs) {
    var listas = probs.map(function (id) { return POR_PROBLEMA[id].f; }), out = [];
    for (var i = 0; i < 4; i++) listas.forEach(function (l) { if (l[i] && out.indexOf(l[i]) < 0) out.push(l[i]); });
    return out.slice(0, 6);
  }
  function telaDiagnostico() {
    if (!diag) diag = { nivel: est.nivel || "", probs: (est.diag && est.diag.probs) ? est.diag.probs.slice() : [] };
    var h = '<section class="hero"><p class="olho">Tênis · tática por situação de jogo</p><h1>Saiba o que fazer em cada bola.</h1>' +
      "<p>Conte onde você trava em quadra. O app monta uma trilha com as situações do manual do Richard Tsukada e te acompanha do entendimento até o jogo.</p>" + svgQuadra() + "</section>" +
      '<section class="cartao" data-diag-nivel><h2><span class="passo-n">1</span>Em que fase você está?</h2><div class="chips">' +
      NIVEIS.map(function (n) { return chip("data-nivel", n[0], esc(n[2]), diag.nivel === n[0]); }).join("") + "</div>" +
      (diag.nivel ? '<p class="nota" style="margin:8px 0 0">' + esc(NIVEIS.filter(function (n) { return n[0] === diag.nivel; })[0][3]) + ".</p>" : "") + "</section>" +
      '<section class="cartao" data-diag-probs><h2><span class="passo-n">2</span>Onde você trava em quadra?</h2><p class="nota" style="margin-top:0">Escolha até 2. Dá para refazer depois.</p><div class="probs">' +
      PROBLEMAS.map(function (p) { return '<button type="button" class="prob" data-prob="' + p.id + '" aria-pressed="' + (diag.probs.indexOf(p.id) >= 0) + '">' + esc(p.t) + "</button>"; }).join("") + "</div></section>" +
      '<div class="acoes"><button type="button" class="bt bt-ambar bt-grande" id="btTrilha">Montar minha trilha</button></div>';
    tela(h);
    cada("[data-nivel]", function (b) { b.addEventListener("click", function () { diag.nivel = b.getAttribute("data-nivel"); var y = window.scrollY; telaDiagnostico(); window.scrollTo(0, y); }); });
    cada("[data-prob]", function (b) { b.addEventListener("click", function () {
      var v = b.getAttribute("data-prob"), i = diag.probs.indexOf(v);
      if (i >= 0) diag.probs.splice(i, 1); else if (diag.probs.length >= 2) { toast("Escolha até 2: comece pelo que mais acontece."); return; } else diag.probs.push(v);
      var y = window.scrollY; telaDiagnostico(); window.scrollTo(0, y);
    }); });
    document.getElementById("btTrilha").addEventListener("click", function () {
      if (!diag.nivel) { toast("Escolha a sua fase."); return; }
      if (!diag.probs.length) { toast("Escolha onde você trava em quadra."); return; }
      est.nivel = diag.nivel; est.diag = { probs: diag.probs.slice(), em: new Date().toISOString() }; est.trilha = montarTrilha(diag.probs); diag = null; salvar();
      toast("Trilha pronta: " + est.trilha.length + " situações."); if (location.hash === "#/" || !location.hash) telaInicio(); else location.hash = "#/";
    });
  }
  function svgQuadra() { return '<svg class="quadra" viewBox="0 0 100 120" aria-hidden="true"><rect x="5" y="5" width="90" height="110" fill="none" stroke="#fff" stroke-width="3"/><path d="M5 60h90M50 5v110M20 5v110M80 5v110" stroke="#fff" stroke-width="2"/></svg>'; }
  function barraPassos(cod) { return '<span class="barra" aria-label="' + feitos(cod) + ' de 6 passos">' + PASSOS.map(function (x) { return '<i class="' + (passoFeito(cod, x.k) ? "on" : "") + '"></i>'; }).join("") + "</span>"; }
  function telaInicio() {
    if (!est.diag || !est.trilha.length) { telaDiagnostico(); return; }
    var atual = situacaoAtual(), rev = revisoesDeHoje(), aprendidas = est.trilha.filter(function (c) { return passoFeito(c, "retida"); }).length;
    var opT = 0, opA = 0; est.jogos.forEach(function (j) { opT += j.oport || 0; opA += j.aprov || 0; });
    var h = '<section class="hero hero-pq"><p class="olho">Sua trilha · ' + esc(nomeNivel(meuNivel())) + "</p><h1>" + (atual ? "Situação da vez" : "Trilha completa!") + "</h1>" +
      "<p>" + esc(est.diag.probs.map(function (id) { return POR_PROBLEMA[id].t; }).join(" · ")) + "</p></section>";
    if (atual) {
      var f = POR_COD[atual], prox = proximoPasso(atual);
      h += '<section class="cartao semana" data-atual="' + atual + '"><p class="olho">' + esc(NOME_MOMENTO[f.m]) + "</p><h2>" + esc(f.nome) + "</h2>" + barraPassos(atual) +
        '<p style="margin-top:8px"><b>O que ler:</b> ' + esc(f.ler) + "</p>" +
        '<div class="acoes"><a class="bt bt-principal" href="' + linkPasso(atual, prox ? prox.k : "leu") + '" data-proximo>' + (prox ? "Próximo passo: " + esc(prox.t) : "Ver a situação") + '</a><a class="bt bt-pq" href="#/situacao/' + atual + '">Ver os 6 passos</a></div></section>';
    } else h += '<section class="cartao semana"><h2>Você passou por todas as situações da trilha.</h2><p>Revise em outro dia para fixar e refaça o diagnóstico para uma trilha nova.</p></section>';
    if (rev.length) h += '<section class="cartao" data-revisoes><h2>Revisão de hoje</h2><p class="nota" style="margin-top:0">Responda sem olhar a ficha. É assim que a decisão fica de verdade.</p><ul class="lista-fichas">' + rev.map(function (c) { return '<li><a class="ficha-l" href="#/quiz/' + c + '?revisao=1"><b>' + esc(POR_COD[c].nome) + '</b><span class="nota">Acertou em ' + dataBR(ultimoAcerto(c)) + " · revisar agora</span></a></li>"; }).join("") + "</ul></section>";
    h += '<div class="trio"><div class="num"><b>' + aprendidas + "/" + est.trilha.length + '</b><span>situações aprendidas</span></div><div class="num"><b>' + est.jogos.length + '</b><span>jogos registrados</span></div><div class="num"><b>' + (opT ? opA + "/" + opT : "—") + "</b><span>oportunidades aproveitadas</span></div></div>";
    h += '<section class="cartao" data-trilha><h2>Minha trilha</h2><ol class="trilha">' + est.trilha.map(function (c) {
      var e = estado(c);
      return '<li><a href="#/situacao/' + c + '"><span><b>' + esc(POR_COD[c].nome) + "</b>" + barraPassos(c) + '</span><span class="tag ' + e[1] + '">' + e[0] + "</span></a></li>";
    }).join("") + '</ol><div class="acoes"><button type="button" class="bt bt-pq bt-texto" id="btRefazer">Refazer o diagnóstico</button></div></section>';
    h += '<div class="atalhos">' + atalho("#/treinar", "▶", "Treinar", "Pausa e decide, vídeos e simulador") + atalho("#/jogo", "↗", "Jogo", "Plano antes, registro depois") +
      atalho("#/aprender", "M", "Aprender", "As 96 situações e o manual completo") + atalho("#/planos", "$", "Proposta", "Grátis e Completo (protótipo)") + "</div>";
    tela(h);
    document.getElementById("btRefazer").addEventListener("click", function () { diag = null; est.diag = null; salvar(); telaDiagnostico(); });
  }
  function atalho(href, ic, t, s) { return '<a class="atalho" href="' + href + '"><span class="ic">' + ic + "</span><b>" + esc(t) + "</b><span>" + esc(s) + "</span></a>"; }

  /* ══ Aprender: manual por situações, como decidir, manual completo ══ */
  var busca = "", soMeuNivel = true;
  function itemFicha(f) {
    var e = estado(f.cod);
    return '<li><a class="ficha-l" href="#/situacao/' + f.cod + '"><span class="cod">' + f.cod + " · " + esc(NOME_MOMENTO[f.m]) + "</span><b>" + esc(f.nome) + '</b><span class="tag ' + f.prio.toLowerCase() + '">' + esc(PRIO[f.prio]) + '</span> <span class="tag">' + esc(faixaTxt(f)) + "</span>" +
      (e[0] !== "Nova" ? ' <span class="tag ' + e[1] + '">' + e[0] + "</span>" : "") + "</a></li>";
  }
  function telaAprender() {
    var h = "<h1>Aprender</h1><p class=\"sub\">96 situações de jogo em 8 momentos. Cada uma diz o que ler, como decidir, a alternativa e como treinar.</p>" +
      '<div class="atalhos atalhos-2"><a class="atalho" href="#/metodo"><span class="ic">?</span><b>Como decidir</b><span>O método em 5 minutos</span></a><a class="atalho" href="#/ler"><span class="ic">≡</span><b>Manual completo</b><span>' + MAN.length + " seções, para ir a fundo</span></a></div>" +
      '<div class="campo" style="margin:0 0 12px"><input type="search" id="busca" placeholder="Buscar: devolução, bola curta, vento…" value="' + esc(busca) + '" aria-label="Buscar situações"></div><div id="resBusca"></div>' +
      '<div id="semBusca"><div class="momentos">' + MOMENTOS.map(function (m) {
        var fs = FICHAS.filter(function (f) { return f.m === m.l; }), v = fs.filter(function (f) { return est.vistas[f.cod]; }).length;
        return '<a class="momento" href="#/manual/' + m.l + '"><span class="letra">' + m.l + "</span><span><b>" + esc(m.n) + "</b><span>" + fs.length + " situações" + (v ? " · " + v + " vistas" : "") + '</span></span><span class="seta">›</span></a>';
      }).join("") + "</div></div>";
    tela(h);
    var b = document.getElementById("busca");
    function filtrar() {
      busca = b.value; var t = busca.trim().toLowerCase(), res = document.getElementById("resBusca"), sem = document.getElementById("semBusca");
      if (t.length < 2) { res.innerHTML = ""; sem.hidden = false; return; }
      var achou = FICHAS.filter(function (f) { return (f.nome + " " + f.ler + " " + f.decidir + " " + f.exercicio + " " + NOME_MOMENTO[f.m]).toLowerCase().indexOf(t) >= 0; });
      sem.hidden = true;
      res.innerHTML = '<p class="nota">' + achou.length + (achou.length === 1 ? " situação" : " situações") + "</p>" + (achou.length ? '<ul class="lista-fichas">' + achou.slice(0, 40).map(itemFicha).join("") + "</ul>" : "");
    }
    b.addEventListener("input", filtrar); if (busca) filtrar();
  }
  function telaMomento(l) {
    var nome = NOME_MOMENTO[l]; if (!nome) { location.hash = "#/aprender"; return; }
    var todas = FICHAS.filter(function (f) { return f.m === l; }), fs = soMeuNivel && est.nivel ? todas.filter(function (f) { return servePara(f, est.nivel); }) : todas;
    var h = '<p class="voltar"><a href="#/aprender">‹ Aprender</a></p><h1>' + esc(nome) + '</h1><p class="sub">' + todas.length + " situações. Comece pelas de base (verde).</p>" +
      (est.nivel ? '<div class="chips" style="margin:0 0 12px">' + chip("data-filtro", "meu", "Da minha fase (" + esc(nomeNivel(est.nivel)) + ")", soMeuNivel) + chip("data-filtro", "todas", "Todas", !soMeuNivel) + "</div>" : "") +
      (fs.length ? '<ul class="lista-fichas">' + fs.map(itemFicha).join("") + "</ul>" : '<div class="cartao">Nenhuma situação deste momento é da sua fase. Veja todas.</div>');
    tela(h);
    cada("[data-filtro]", function (b) { b.addEventListener("click", function () { soMeuNivel = b.getAttribute("data-filtro") === "meu"; telaMomento(l); }); });
  }
  function telaSituacao(cod) {
    var f = POR_COD[cod]; if (!f) { location.hash = "#/aprender"; return; }
    if (!est.vistas[cod]) est.vistas[cod] = Date.now();
    if (!prog(cod).leu) prog(cod).leu = new Date().toISOString();
    salvar();
    var lista = FICHAS.filter(function (x) { return x.m === f.m; }), i = lista.indexOf(f), ant = lista[i - 1], prox = lista[i + 1], e = estado(cod), naTrilha = est.trilha.indexOf(cod) >= 0;
    var bloco = function (ic, t, txt, id) { return '<div class="bloco"' + (id ? ' id="' + id + '"' : "") + "><h3><i>" + ic + "</i>" + esc(t) + "</h3><p>" + esc(txt) + "</p></div>"; };
    var u = ultimoAcerto(cod), libera = u ? maisDias(u, 2) : null;
    var acaoPasso = function (k) {
      if (k === "leu") return '<span class="nota">feito ao abrir</span>';
      if (k === "decide") return '<a class="bt bt-pq" href="#/quiz/' + cod + '">' + (passoFeito(cod, k) ? "De novo" : "Fazer") + "</a>";
      if (k === "sim") return '<button type="button" class="bt bt-pq" data-marcar="sim">' + (passoFeito(cod, k) ? "✓ Feito" : "Já fiz") + '</button> <a class="bt bt-pq bt-texto" href="#/simulador">Abrir</a>';
      if (k === "quadra") return '<button type="button" class="bt bt-pq" data-marcar="quadra">' + (passoFeito(cod, k) ? "✓ Treinei" : "Treinei") + "</button>";
      if (k === "jogo") return '<a class="bt bt-pq" href="#/jogo?cod=' + cod + '">' + (passoFeito(cod, k) ? "Registrar outro" : "Ir") + "</a>";
      if (k === "retida") return passoFeito(cod, k) ? '<span class="tag ok">✓ fixada</span>' : u && dias(u, hoje()) >= 2 ? '<a class="bt bt-pq bt-ambar" href="#/quiz/' + cod + '?revisao=1">Revisar</a>' : '<span class="nota">' + (libera ? "a partir de " + dataBR(libera) : "depois do passo 2") + "</span>";
      return "";
    };
    var h = '<p class="voltar"><a href="' + (naTrilha ? "#/" : "#/manual/" + f.m) + '">‹ ' + (naTrilha ? "Minha trilha" : esc(NOME_MOMENTO[f.m])) + "</a></p>" +
      '<p class="olho">' + f.cod + " · " + esc(NOME_MOMENTO[f.m]) + "</p><h1>" + esc(f.nome) + '</h1><p><span class="tag ' + e[1] + '">' + e[0] + '</span> <span class="tag ' + f.prio.toLowerCase() + '">' + esc(PRIO[f.prio]) + '</span> <span class="tag">' + esc(faixaTxt(f)) + "</span></p>" +
      '<section class="cartao" data-passos><h2>Seus 6 passos</h2><ol class="passos-sit">' + PASSOS.map(function (x, n) {
        var ok = passoFeito(cod, x.k);
        return '<li class="' + (ok ? "ok" : "") + '" data-passo="' + x.k + '"><span class="bola">' + (ok ? "✓" : n + 1) + "</span><span class=\"txt\"><b>" + esc(x.t) + "</b><span>" + esc(x.s) + '</span></span><span class="acao">' + acaoPasso(x.k) + "</span></li>";
      }).join("") + "</ol></section>" +
      '<p class="nota" style="margin:8px 0 10px">Nas situações, <b>A</b> é você e <b>B</b> é o adversário.</p>' +
      '<section class="cartao" data-ficha>' + bloco("1", "O que ler", f.ler) + bloco("2", "Como decidir", f.decidir) + bloco("3", "Exercício em quadra", f.exercicio, "exercicio") + bloco("4", "Variar", f.variar) + bloco("5", "Como saber se está funcionando", f.medir) + "</section>" +
      '<section class="cartao"><p class="nota" style="margin-top:0">' + esc(S.MONTAGEM_COMUM) + '</p><p class="nota" style="margin:0"><b>Se ficar difícil:</b> ' + esc(S.SIMPLIFICACAO) + "</p></section>" +
      (naTrilha ? "" : '<div class="acoes"><button type="button" class="bt" id="btPorNaTrilha">Pôr na minha trilha</button></div>') +
      '<div class="acoes" style="justify-content:space-between">' + (ant ? '<a class="bt bt-texto" href="#/situacao/' + ant.cod + '">‹ ' + esc(ant.nome) + "</a>" : "<span></span>") + (prox ? '<a class="bt bt-texto" href="#/situacao/' + prox.cod + '">' + esc(prox.nome) + " ›</a>" : "") + "</div>";
    tela(h);
    cada("[data-marcar]", function (b) { b.addEventListener("click", function () {
      var k = b.getAttribute("data-marcar"), p = prog(cod);
      if (p[k]) delete p[k]; else p[k] = new Date().toISOString();
      salvar(); toast(p[k] ? "Passo marcado." : "Marcação tirada."); var y = window.scrollY; telaSituacao(cod); window.scrollTo(0, y);
    }); });
    var pt = document.getElementById("btPorNaTrilha"); if (pt) pt.addEventListener("click", function () { est.trilha.push(cod); if (!est.diag) est.diag = { probs: [], em: new Date().toISOString() }; salvar(); toast("Está na sua trilha."); telaSituacao(cod); });
  }
  function telaMetodo() {
    var h = '<p class="voltar"><a href="#/aprender">‹ Aprender</a></p><h1>Como decidir</h1><p class="sub">O que olhar antes de escolher a jogada.</p>' +
      '<section class="cartao"><h2>Os 6 elementos de uma decisão</h2>' + S.ELEMENTOS.map(function (e, i) { return '<div class="bloco"><h3><i>' + (i + 1) + "</i>" + esc(e[0]) + "</h3><p>" + esc(e[1]) + "</p></div>"; }).join("") + "</section>" +
      '<section class="cartao"><h2>Os 4 estados do ponto</h2><div class="estados">' + S.ESTADOS.map(function (e) { return '<div class="estado"><b>' + esc(e[0]) + "</b><span>" + esc(e[1]) + '</span><p class="nota" style="margin:6px 0 0"><b>O que buscar:</b> ' + esc(e[2]) + "</p></div>"; }).join("") + '</div><p class="nota" style="margin:10px 0 0">Começando? Use só dois: <b>tenho tempo</b> e <b>preciso de tempo</b>.</p></section>' +
      '<section class="cartao"><h2>Estratégia e tática</h2><p style="margin:0">' + esc(S.ESTRATEGIA_TATICA) + "</p></section>" +
      '<section class="cartao"><h2>Boa decisão também erra</h2><p style="margin:0">Separe a <b>decisão</b> (era a hora certa e o lugar certo?) da <b>execução</b> (a bola saiu como você queria?). Uma boa decisão com erro de execução é progresso: o que falta é treino do golpe com mais margem. Um ponto ganho com escolha ruim não é motivo para repetir.</p></section>' +
      '<section class="cartao"><h2>As fases do jogador</h2>' + NIVEIS.map(function (n) { return '<div class="bloco"><h3><i>' + n[0].slice(1) + "</i>" + esc(n[2]) + "</h3><p><b>Consegue:</b> " + esc(n[3]) + ". <b>Foco:</b> " + esc(n[4]) + ".</p></div>"; }).join("") + "</section>";
    tela(h);
  }
  function telaLer(i) {
    if (!MAN.length) { tela('<p class="voltar"><a href="#/aprender">‹ Aprender</a></p><div class="cartao">O manual completo não foi carregado.</div>'); return; }
    if (i == null || i === "") {
      tela('<p class="voltar"><a href="#/aprender">‹ Aprender</a></p><h1>Manual completo</h1><p class="sub">O manual tático e estratégico do Richard Tsukada, inteiro. Escrito para quem ensina: leia com calma ou mostre ao seu treinador.</p>' +
        '<ol class="indice">' + MAN.map(function (s, n) { return '<li><a href="#/ler/' + n + '">' + esc(s.titulo) + "</a></li>"; }).join("") + "</ol>");
      return;
    }
    var n = +i, s = MAN[n]; if (!s) { location.hash = "#/ler"; return; }
    var corpo = s.blocos.map(function (b, k) {
      if (b.t === "h") return k === 0 && b.x === s.titulo ? "" : "<h3>" + esc(b.x) + "</h3>";
      if (b.t === "tab") return '<div class="tab-wrap"><table>' + b.r.map(function (r, ri) { return "<tr>" + r.map(function (c) { return ri === 0 ? "<th>" + esc(c) + "</th>" : "<td>" + esc(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</table></div>";
      return "<p>" + esc(b.x) + "</p>";
    }).join("");
    tela('<p class="voltar"><a href="#/ler">‹ Manual completo</a></p><p class="olho">Seção ' + (n + 1) + " de " + MAN.length + "</p><h1>" + esc(s.titulo) + '</h1><article class="cartao leitura">' + corpo + "</article>" +
      '<div class="acoes" style="justify-content:space-between">' + (n > 0 ? '<a class="bt bt-texto" href="#/ler/' + (n - 1) + '">‹ ' + esc(MAN[n - 1].titulo) + "</a>" : "<span></span>") + (n < MAN.length - 1 ? '<a class="bt bt-texto" href="#/ler/' + (n + 1) + '">' + esc(MAN[n + 1].titulo) + " ›</a>" : "") + "</div>");
  }

  /* ══ Treinar: Pausa e decide (leitura e decisão), vídeos com pausa, simulador ══ */
  function telaTreinar() {
    var atual = situacaoAtual(), rev = revisoesDeHoje();
    var h = "<h1>Treinar</h1><p class=\"sub\">Decidir bem é treino: ler a bola, escolher, conferir o que aconteceu.</p>" +
      '<section class="cartao"><p class="olho">Pausa e decide</p><h2>' + (atual ? esc(POR_COD[atual].nome) : "Escolha uma situação") + '</h2><p class="nota" style="margin-top:0">Duas perguntas: o que você precisa perceber e o que fazer. Sem pressa e sem placar.</p><div class="acoes">' +
      (atual ? '<a class="bt bt-principal" href="#/quiz/' + atual + '">Começar</a>' : '<a class="bt" href="#/aprender">Ver as situações</a>') +
      (rev.length ? '<a class="bt bt-ambar" href="#/quiz/' + rev[0] + '?revisao=1">Revisão de hoje (' + rev.length + ")</a>" : "") + "</div></section>" +
      '<section class="cartao"><p class="olho">Vídeo com pausa</p><h2>Assista, pare na decisão e responda</h2><p class="nota" style="margin-top:0">Use um jogo seu gravado ou um jogo de profissionais no YouTube. O vídeo para no momento da escolha: você diz o que faria antes de ver o que aconteceu.</p><div class="acoes"><a class="bt bt-principal" href="#/videos">Meus vídeos (' + est.videos.length + ')</a><a class="bt" href="#/video/novo">+ Vídeo</a></div></section>' +
      '<section class="cartao"><p class="olho">Simulador de decisões</p><h2>Escolha a jogada e veja a resposta</h2><p class="nota" style="margin-top:0">Cenários de ponto com três decisões cada, em 4 níveis, desafios relâmpago e revisão do dia.</p><div class="acoes"><a class="bt bt-principal" href="#/simulador">Abrir o simulador</a></div></section>';
    tela(h);
  }
  /* perguntas montadas a partir do próprio manual: a resposta certa é a da situação; as outras vêm de situações do mesmo momento do jogo */
  function opcoesQuiz(f, campo, salto) {
    var irmas = FICHAS.filter(function (x) { return x.m === f.m && x.cod !== f.cod; }), i = FICHAS.indexOf(f);
    var d1 = irmas[(i + salto) % irmas.length], d2 = irmas[(i + salto + 5) % irmas.length];
    var txt = function (x) { return campo === "ler" ? x.ler : frases(x.decidir)[0]; };
    var ops = [{ t: txt(f), ok: true }, { t: txt(d1), ok: false }, { t: txt(d2), ok: false }];
    var giro = (f.cod.charCodeAt(1) + f.cod.charCodeAt(2) + prog(f.cod).quiz.length + salto) % 3;
    return ops.slice(giro).concat(ops.slice(0, giro));
  }
  var quiz = null;
  function telaQuiz(cod) {
    var f = POR_COD[cod]; if (!f) { location.hash = "#/treinar"; return; }
    var revisao = params().revisao === "1";
    if (!quiz || quiz.cod !== cod || quiz.revisao !== revisao) quiz = { cod: cod, revisao: revisao, etapa: 0, resp: [null, null], ops: [opcoesQuiz(f, "ler", 3), opcoesQuiz(f, "decidir", 6)] };
    var Q = [{ t: "Em “" + f.nome + "”, o que você precisa perceber antes de escolher?", campo: "ler" }, { t: "Você percebeu isso. O que fazer?", campo: "decidir" }];
    var h = '<p class="voltar"><a href="#/situacao/' + cod + '">‹ ' + esc(f.nome) + "</a></p><p class=\"olho\">" + (revisao ? "Revisão · sem olhar a ficha" : "Pausa e decide") + " · " + (quiz.etapa < 2 ? "pergunta " + (quiz.etapa + 1) + " de 2" : "resultado") + "</p>";
    if (quiz.etapa < 2) {
      var q = Q[quiz.etapa], r = quiz.resp[quiz.etapa];
      h += '<h1 class="pergunta">' + esc(q.t) + '</h1><p class="nota" style="margin:0">A é você; B é o adversário.</p><div class="opcoes" role="group">' + quiz.ops[quiz.etapa].map(function (o, n) {
        var cls = r == null ? "" : o.ok ? " certa" : r === n ? " errada" : "";
        return '<button type="button" class="opcao' + cls + '" data-op="' + n + '"' + (r != null ? " disabled" : "") + ">" + esc(o.t) + "</button>";
      }).join("") + "</div>";
      if (r != null) {
        var acertou = quiz.ops[quiz.etapa][r].ok;
        h += '<section class="cartao retorno ' + (acertou ? "ok" : "") + '" data-retorno><b>' + (acertou ? "Isso!" : "Não é bem isso.") + "</b><p style=\"margin:6px 0 0\">" + esc(quiz.etapa === 0 ? f.ler : f.decidir) + '</p></section><div class="acoes"><button type="button" class="bt bt-principal" id="btSeguir">' + (quiz.etapa === 0 ? "Próxima pergunta" : "Ver o resultado") + "</button></div>";
      }
    } else {
      var ok = quiz.ops[0][quiz.resp[0]].ok && quiz.ops[1][quiz.resp[1]].ok;
      h += "<h1>" + (ok ? "Leitura e decisão certas." : "Quase lá.") + "</h1>" +
        '<section class="cartao"><p style="margin:0">' + (ok ? (quiz.revisao ? "Você lembrou sem ajuda depois de alguns dias: esta situação está fixada." : "Agora leve para a quadra: faça o exercício com um parceiro e use no próximo jogo. Daqui a 2 dias o app pede uma revisão sem olhar a ficha.") :
          "Releia o que ler e como decidir, e tente de novo. Errar aqui é barato: é para isso que o treino serve.") + "</p></section>" +
        '<div class="acoes"><a class="bt bt-principal" href="#/situacao/' + cod + '">Voltar aos 6 passos</a>' + (ok ? "" : '<button type="button" class="bt" id="btDeNovo">Tentar de novo</button>') + "</div>";
    }
    tela(h);
    cada("[data-op]", function (b) { b.addEventListener("click", function () { quiz.resp[quiz.etapa] = +b.getAttribute("data-op"); telaQuiz(cod); }); });
    var sg = document.getElementById("btSeguir"); if (sg) sg.addEventListener("click", function () {
      quiz.etapa++;
      if (quiz.etapa === 2) {
        var okk = quiz.ops[0][quiz.resp[0]].ok && quiz.ops[1][quiz.resp[1]].ok, p = prog(cod);
        p.quiz.push({ em: new Date().toISOString(), ok: okk, revisao: quiz.revisao });
        if (okk && quiz.revisao) { var u = p.quiz.filter(function (x) { return x.ok && !x.revisao; })[0]; if (u && dias(u.em, hoje()) >= 2) p.retida = new Date().toISOString(); }
        p.quiz = p.quiz.slice(-30); salvar();
      }
      telaQuiz(cod);
    });
    var dn = document.getElementById("btDeNovo"); if (dn) dn.addEventListener("click", function () { quiz = null; telaQuiz(cod); });
  }

  /* ── vídeos do YouTube com pausa na decisão (só o código do vídeo fica guardado; o player é o oficial, sem cookies) ── */
  var yt = null, ytTimer = null, filaYT = [];
  function pararVideo() { clearInterval(ytTimer); ytTimer = null; if (yt && yt.destroy) { try { yt.destroy(); } catch (e) { /* já foi */ } } yt = null; }
  function carregarYT(cb) {
    if (window.YT && window.YT.Player) { cb(); return; }
    filaYT.push(cb);
    if (document.getElementById("ytapi")) return;
    window.onYouTubeIframeAPIReady = function () { var f = filaYT; filaYT = []; f.forEach(function (x) { x(); }); };
    var s = document.createElement("script"); s.id = "ytapi"; s.src = "https://www.youtube.com/iframe_api"; document.head.appendChild(s);
  }
  function idYouTube(u) { var m = String(u || "").trim().match(/(?:youtu\.be\/|v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/) || String(u || "").trim().match(/^([A-Za-z0-9_-]{11})$/); return m ? m[1] : ""; }
  function seg(t) { var p = String(t || "").trim().split(":").map(Number); if (p.some(isNaN)) return NaN; return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : p[0]; }
  function mmss(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
  function telaVideos() {
    var h = '<p class="voltar"><a href="#/treinar">‹ Treinar</a></p><h1>Vídeo com pausa</h1><p class="sub">Escolha um trecho, marque onde parar na hora da decisão e responda antes de ver o que aconteceu.</p>' +
      '<div class="acoes" style="margin:0 0 12px"><a class="bt bt-principal" href="#/video/novo">+ Vídeo</a></div>' +
      (est.videos.length ? '<ul class="lista-fichas">' + est.videos.slice().reverse().map(function (v) {
        return '<li><a class="ficha-l" href="#/video/' + v.id + '"><span class="cod">' + (v.cod ? esc(POR_COD[v.cod].nome) : "Sem situação") + " · " + mmss(v.ini) + "–" + mmss(v.fim) + "</span><b>" + esc(v.titulo || "Trecho") + '</b><span class="nota">' + (v.respostas.length ? v.respostas.length + (v.respostas.length === 1 ? " resposta" : " respostas") : "ainda sem resposta") + "</span></a></li>";
      }).join("") + "</ul>" : '<section class="cartao"><b>Nenhum vídeo ainda.</b><p class="nota" style="margin:6px 0 0">Pode ser um jogo seu no YouTube (como "Não listado") ou um jogo de profissionais. No app de verdade, o Richard deixaria trechos prontos para cada situação.</p></section>');
    tela(h);
  }
  function telaVideoNovo() {
    var atual = situacaoAtual() || "";
    var h = '<p class="voltar"><a href="#/videos">‹ Vídeos</a></p><h1>Novo vídeo com pausa</h1>' +
      '<section class="cartao"><div class="campo" style="margin-top:0"><label for="vLink">Link do YouTube</label><input type="text" id="vLink" inputmode="url" placeholder="https://youtu.be/…"></div>' +
      '<div class="campo"><label for="vTitulo">Nome do trecho</label><input type="text" id="vTitulo" maxlength="80" placeholder="Ex.: 2º set, 3-3, devolução no saque aberto"></div>' +
      '<div class="campo"><label for="vCod">Situação que este trecho treina</label><select id="vCod"><option value="">Nenhuma</option>' +
      MOMENTOS.map(function (m) { return '<optgroup label="' + esc(m.n) + '">' + FICHAS.filter(function (f) { return f.m === m.l; }).map(function (f) { return '<option value="' + f.cod + '"' + (f.cod === atual ? " selected" : "") + ">" + esc(f.nome) + "</option>"; }).join("") + "</optgroup>"; }).join("") + "</select></div>" +
      '<div class="grade3"><div class="campo"><label for="vIni">Começa</label><input type="text" id="vIni" inputmode="numeric" placeholder="1:20"></div><div class="campo"><label for="vPausa">Pausa</label><input type="text" id="vPausa" inputmode="numeric" placeholder="1:26"></div><div class="campo"><label for="vFim">Termina</label><input type="text" id="vFim" inputmode="numeric" placeholder="1:34"></div></div>' +
      '<p class="nota" style="margin:8px 0 0">A pausa é o instante antes da escolha: a bola chegando, antes do golpe.</p><p class="nota erro" id="vErro" hidden></p></section>' +
      '<div class="acoes"><button type="button" class="bt bt-principal" id="btSalvarVideo">Salvar</button></div>';
    tela(h);
    document.getElementById("btSalvarVideo").addEventListener("click", function () {
      var er = document.getElementById("vErro"), id = idYouTube($("#vLink").value), a = seg($("#vIni").value), p = seg($("#vPausa").value), z = seg($("#vFim").value);
      var falha = !id ? "Cole um link do YouTube válido." : (isNaN(a) || isNaN(p) || isNaN(z)) ? "Use minutos:segundos, por exemplo 1:26." : !(a < p && p < z) ? "O começo vem antes da pausa, e a pausa antes do fim." : z - a > 600 ? "Use um trecho de até 10 minutos." : "";
      if (falha) { er.textContent = falha; er.hidden = false; return; }
      var v = { id: novoId("v"), yt: id, titulo: $("#vTitulo").value.trim(), cod: $("#vCod").value, ini: a, pausa: p, fim: z, respostas: [], criadoEm: new Date().toISOString() };
      est.videos.push(v); salvar(); location.hash = "#/video/" + v.id;
    });
  }
  var vid = null;
  function telaVideo(id) {
    var v = est.videos.filter(function (x) { return x.id === id; })[0]; if (!v) { location.hash = "#/videos"; return; }
    if (!vid || vid.id !== id) vid = { id: id, fase: "assistir", vi: "", faria: "", para: "", depois: "", comparou: "" };
    var f = v.cod ? POR_COD[v.cod] : null, FAZ = ["Ganhar tempo", "Construir", "Pressionar", "Finalizar"];
    var h = '<p class="voltar"><a href="#/videos">‹ Vídeos</a></p><p class="olho">' + (f ? esc(f.nome) : "Vídeo com pausa") + "</p><h1>" + esc(v.titulo || "Trecho") + "</h1>" +
      '<div class="video-box"><div id="ytPlayer"></div></div><p class="nota" id="vStatus" style="margin:6px 0 10px">' + (vid.fase === "assistir" ? "O vídeo para sozinho em " + mmss(v.pausa) + "." : vid.fase === "ver" ? "Veja o que aconteceu até " + mmss(v.fim) + "." : "") + "</p>";
    if (vid.fase === "assistir") h += '<div class="acoes"><button type="button" class="bt bt-principal" id="btPlay">▶ Assistir até a pausa</button><button type="button" class="bt bt-texto" id="btJaVi">Já vi até a pausa</button></div>';
    if (vid.fase === "responder") h += '<section class="cartao" data-responder><h2>Pausa. E agora?</h2>' +
      (f ? '<p class="nota" style="margin-top:0"><b>Lembre:</b> ' + esc(f.ler) + "</p>" : "") +
      '<div class="campo"><label for="rVi">O que você vê? (tempo, posição, a bola que vem)</label><textarea id="rVi" maxlength="400">' + esc(vid.vi) + "</textarea></div>" +
      '<p class="rot" style="margin-top:12px">O que você faria?</p><div class="chips">' + FAZ.map(function (x) { return chip("data-faria", x, x, vid.faria === x); }).join("") + "</div>" +
      '<div class="campo"><label for="rPara">Para onde?</label><input type="text" id="rPara" maxlength="100" placeholder="Ex.: cruzado fundo, no backhand" value="' + esc(vid.para) + '"></div>' +
      '<div class="acoes"><button type="button" class="bt bt-principal" id="btVerResto">Ver o que aconteceu</button></div></section>';
    if (vid.fase === "ver") h += '<div class="acoes"><button type="button" class="bt bt-principal" id="btPlay2">▶ Continuar</button><button type="button" class="bt bt-texto" id="btJaVi2">Já vi</button></div>';
    if (vid.fase === "comparar") h += '<section class="cartao" data-comparar><h2>Compare</h2><p style="margin-top:0">Você disse: <b>' + esc(vid.faria || "—") + "</b>" + (vid.para ? " · " + esc(vid.para) : "") + "</p>" +
      '<p class="rot">A sua escolha e a que aconteceu foram…</p><div class="chips">' + ["Parecidas", "Diferentes", "Não sei"].map(function (x) { return chip("data-comp", x, x, vid.comparou === x); }).join("") + "</div>" +
      '<div class="campo"><label for="rDepois">O que você aprendeu com este trecho?</label><textarea id="rDepois" maxlength="400">' + esc(vid.depois) + "</textarea></div>" +
      (f ? '<p class="sugestao"><b>Como decidir:</b> ' + esc(f.decidir) + "</p>" : "") +
      '<div class="acoes"><button type="button" class="bt bt-principal" id="btGuardarResp">Guardar resposta</button></div></section>';
    if (v.respostas.length) h += '<section class="cartao"><h2>Respostas anteriores</h2><ul class="lista-simples">' + v.respostas.slice().reverse().map(function (r) { return "<li><b>" + dataBR(r.em) + "</b> · " + esc(r.faria || "—") + (r.para ? " · " + esc(r.para) : "") + " · " + esc(r.comparou || "") + (r.depois ? '<br><span class="nota">' + esc(r.depois) + "</span>" : "") + "</li>"; }).join("") + "</ul></section>";
    h += '<div class="acoes"><button type="button" class="bt bt-texto" id="btApagarVideo">Apagar este vídeo</button></div>';
    tela(h);
    function tocar(de, ate, fim) {
      carregarYT(function () {
        if (!document.getElementById("ytPlayer")) return;
        var comecar = function () { yt.seekTo(de, true); yt.playVideo(); clearInterval(ytTimer); ytTimer = setInterval(function () { try { if (yt.getCurrentTime() >= ate) { yt.pauseVideo(); clearInterval(ytTimer); fim(); } } catch (e) { /* player saiu */ } }, 200); };
        if (yt) { comecar(); return; }
        yt = new window.YT.Player("ytPlayer", { host: "https://www.youtube-nocookie.com", videoId: v.yt, playerVars: { start: Math.floor(de), playsinline: 1, rel: 0, modestbranding: 1 }, events: { onReady: comecar } });
      });
    }
    function para(fase) { vid.fase = fase; telaVideo(id); }
    var bp = document.getElementById("btPlay"); if (bp) bp.addEventListener("click", function () { tocar(v.ini, v.pausa, function () { para("responder"); }); });
    var jv = document.getElementById("btJaVi"); if (jv) jv.addEventListener("click", function () { vid.fase = "responder"; telaVideo(id); });
    cada("[data-faria]", function (b) { b.addEventListener("click", function () { lerResp(); vid.faria = b.getAttribute("data-faria"); var y = window.scrollY; telaVideo(id); window.scrollTo(0, y); }); });
    function lerResp() { var a = $("#rVi"), b = $("#rPara"), c = $("#rDepois"); if (a) vid.vi = a.value; if (b) vid.para = b.value; if (c) vid.depois = c.value; }
    var vr = document.getElementById("btVerResto"); if (vr) vr.addEventListener("click", function () { lerResp(); if (!vid.faria) { toast("Escolha o que você faria."); return; } vid.fase = "ver"; telaVideo(id); });
    var p2 = document.getElementById("btPlay2"); if (p2) p2.addEventListener("click", function () { tocar(v.pausa, v.fim, function () { para("comparar"); }); });
    var j2 = document.getElementById("btJaVi2"); if (j2) j2.addEventListener("click", function () { vid.fase = "comparar"; telaVideo(id); });
    cada("[data-comp]", function (b) { b.addEventListener("click", function () { lerResp(); vid.comparou = b.getAttribute("data-comp"); var y = window.scrollY; telaVideo(id); window.scrollTo(0, y); }); });
    var gr = document.getElementById("btGuardarResp"); if (gr) gr.addEventListener("click", function () {
      lerResp(); v.respostas.push({ em: new Date().toISOString(), vi: vid.vi.trim(), faria: vid.faria, para: vid.para.trim(), comparou: vid.comparou, depois: vid.depois.trim() });
      if (v.cod && !prog(v.cod).leu) prog(v.cod).leu = new Date().toISOString();
      salvar(); vid = null; toast("Resposta guardada."); telaVideo(id);
    });
    document.getElementById("btApagarVideo").addEventListener("click", function () { if (!confirm("Apagar este vídeo e as respostas?")) return; est.videos = est.videos.filter(function (x) { return x.id !== id; }); salvar(); location.hash = "#/videos"; });
  }

  /* ══ Simulador (o mesmo Simulador de Decisões, dentro do app, sem o cabeçalho e sem os convites da consultoria, que está parada) ══ */
  var SIM_URL = window.QLT_SIM_URL || "../decisoes/index.html", simAba = "cenarios";
  var CSS_SIM = '.topo,.rodape,.convite,a[href="#consultoria"],a[href="#modulo"],a[href*="player"],.pular{display:none!important}body{padding-top:0!important;background:#fff!important}';
  function telaSimulador(aba) {
    if (aba) simAba = aba;
    var h = '<p class="voltar"><a href="#/treinar">‹ Treinar</a></p><h1>Simulador de decisões</h1><p class="sub">Escolha a jogada, veja uma resposta possível do adversário e entenda como uma decisão leva à próxima.</p>' +
      '<div class="chips sim-nav" role="group" aria-label="Simulador">' + [["cenarios", "Cenários"], ["desafios", "Desafios"], ["progresso", "Progresso"]].map(function (x) { return chip("data-sim", x[0], x[1], simAba === x[0]); }).join("") + "</div>" +
      '<div class="sim-moldura"><iframe id="simFrame" title="Simulador de decisões" src="' + esc(SIM_URL) + "#" + simAba + '"></iframe></div>';
    tela(h);
    var fr = document.getElementById("simFrame");
    fr.addEventListener("load", function () { try { var d = fr.contentDocument; if (d && !d.getElementById("qltEstilo")) { var s = d.createElement("style"); s.id = "qltEstilo"; s.textContent = CSS_SIM; d.head.appendChild(s); } } catch (e) { /* outro endereço */ } });
    cada("[data-sim]", function (b) { b.addEventListener("click", function () { simAba = b.getAttribute("data-sim"); cada("[data-sim]", function (x) { x.setAttribute("aria-pressed", String(x === b)); }); try { fr.contentWindow.location.hash = simAba; } catch (e) { fr.src = SIM_URL + "#" + simAba; } }); });
  }

  /* ══ Jogo: plano antes, registro depois (decisão separada da execução; oportunidade aproveitada ou recusada) ══ */
  function telaJogo() {
    var cod = params().cod || situacaoAtual() || "", f = POR_COD[cod];
    var opT = 0, opA = 0, opR = 0, boaErro = 0, decB = 0, decN = 0;
    est.jogos.forEach(function (j) { opT += j.oport || 0; opA += j.aprov || 0; opR += j.recus || 0; if (j.decisao === "boa" && j.execucao === "nao") boaErro++; if (j.decisao !== "naosei" && j.decisao) { decN++; if (j.decisao === "boa") decB++; } });
    var h = "<h1>Jogo</h1><p class=\"sub\">Antes: um plano curto. Depois: o que a situação mostrou no jogo de verdade.</p>" +
      (f ? '<section class="cartao semana"><p class="olho">Situação que você está levando para o jogo</p><h2>' + esc(f.nome) + '</h2><p class="nota" style="margin:0">' + esc(frases(f.decidir)[0]) + "</p></section>" : "") +
      '<div class="acoes" style="margin:0 0 14px"><a class="bt bt-principal" href="#/plano/novo' + (cod ? "?cod=" + cod : "") + '" data-novo-plano>Plano para o próximo jogo</a><a class="bt bt-ambar" href="#/registro/novo' + (cod ? "?cod=" + cod : "") + '">Registrar como foi</a></div>';
    if (est.jogos.length) h += '<section class="cartao" data-resumo-jogos><h2>O que os jogos mostram</h2>' +
      '<div class="contagem"><span>Oportunidades aproveitadas</span><b>' + (opT ? opA + " de " + opT : "—") + "</b></div>" +
      '<div class="contagem"><span>Oportunidades que você deixou passar</span><b>' + opR + "</b></div>" +
      '<div class="contagem"><span>Decisões boas</span><b>' + (decN ? decB + " de " + decN : "—") + "</b></div>" +
      '<div class="contagem"><span>Boa decisão com erro de execução</span><b>' + boaErro + "</b></div>" +
      '<p class="nota" style="margin:8px 0 0">Boa decisão com erro é progresso: o que falta é o golpe, com mais margem. Sempre a contagem junto: 6 de 10 diz mais que 60%.</p></section>';
    var itens = est.jogos.map(function (j) { return { em: j.data, h: '<li><a class="ficha-l" href="#/registro/' + j.id + '"><span class="cod">Registro · ' + dataBR(j.data) + "</span><b>" + esc(j.contra ? "Contra " + j.contra : "Jogo") + '</b><span class="nota">' + esc(j.cod ? POR_COD[j.cod].nome : "") + (j.oport ? " · " + j.aprov + " de " + j.oport + " aproveitadas" : "") + "</span></a></li>" }; })
      .concat(est.planos.map(function (p) { return { em: p.criadoEm, h: '<li><a class="ficha-l" href="#/plano/' + p.id + '"><span class="cod">Plano · ' + dataBR(p.criadoEm) + "</span><b>" + esc(p.titulo || "Plano de jogo") + '</b><span class="nota">' + esc(p.hipotese) + "</span></a></li>" }; }))
      .sort(function (a, b) { return String(b.em).localeCompare(String(a.em)); });
    h += itens.length ? '<h2 class="secao">Histórico</h2><ul class="lista-fichas">' + itens.map(function (x) { return x.h; }).join("") + "</ul>" : '<section class="cartao"><b>Nenhum jogo ainda.</b><p class="nota" style="margin:6px 0 0">' + esc(frases(S.ESTRATEGIA_TATICA).slice(-1)[0]) + "</p></section>";
    tela(h);
    var np = $("[data-novo-plano]"); if (np) np.addEventListener("click", function () { rascunho = null; });
  }
  var reg = null;
  function telaRegistroNovo() {
    var pr = params();
    if (!reg) reg = { cod: pr.cod || situacaoAtual() || "", plano: pr.plano || "", data: hoje(), contra: "", apareceu: "", oport: 0, aprov: 0, recus: 0, decisao: "", execucao: "", boa: "", discutivel: "", treinar: "", proximo: "" };
    var r = reg, cods = est.trilha.length ? est.trilha : FICHAS.slice(0, 12).map(function (f) { return f.cod; });
    if (r.cod && cods.indexOf(r.cod) < 0) cods = [r.cod].concat(cods);
    var stepper = function (k, rot) { return '<div class="stepper"><span>' + rot + '</span><span class="st"><button type="button" class="bt bt-pq" data-menos="' + k + '" aria-label="Menos">−</button><b data-val="' + k + '">' + r[k] + '</b><button type="button" class="bt bt-pq" data-mais="' + k + '" aria-label="Mais">+</button></span></div>'; };
    var h = '<p class="voltar"><a href="#/jogo">‹ Jogo</a></p><h1>Como foi o jogo</h1><p class="sub">Dois minutos depois do jogo. Julgue a decisão antes de pensar no resultado.</p>' +
      '<section class="cartao"><div class="grade2"><div class="campo" style="margin-top:0"><label for="gData">Data</label><input type="text" id="gData" value="' + esc(r.data) + '"></div><div class="campo" style="margin-top:0"><label for="gContra">Contra <span class="nota">(opcional)</span></label><input type="text" id="gContra" maxlength="60" value="' + esc(r.contra) + '"></div></div>' +
      '<div class="campo"><label for="gCod">Situação que você levou para o jogo</label><select id="gCod">' + cods.map(function (c) { return '<option value="' + c + '"' + (c === r.cod ? " selected" : "") + ">" + esc(POR_COD[c].nome) + "</option>"; }).join("") + "</select></div></section>" +
      '<section class="cartao"><h2>A situação apareceu?</h2><div class="chips">' + chip("data-ap", "sim", "Apareceu", r.apareceu === "sim") + chip("data-ap", "nao", "Não apareceu", r.apareceu === "nao") + chip("data-ap", "naosei", "Não sei", r.apareceu === "naosei") + "</div>" +
      (r.apareceu === "sim" ? stepper("oport", "Quantas vezes teve a oportunidade") + stepper("aprov", "Aproveitou") + stepper("recus", "Deixou passar") +
        '<p class="rot" style="margin-top:12px">A decisão, em geral, foi…</p><div class="chips">' + chip("data-dec", "boa", "Boa", r.decisao === "boa") + chip("data-dec", "discutivel", "Discutível", r.decisao === "discutivel") + chip("data-dec", "naosei", "Não sei", r.decisao === "naosei") + "</div>" +
        '<p class="rot" style="margin-top:12px">E a execução (a bola saiu como você queria)?</p><div class="chips">' + chip("data-exe", "saiu", "Saiu", r.execucao === "saiu") + chip("data-exe", "nao", "Não saiu", r.execucao === "nao") + chip("data-exe", "naosei", "Não sei", r.execucao === "naosei") + "</div>" : "") + "</section>" +
      '<section class="cartao"><h2>Depois do jogo</h2>' + [["boa", "Uma boa decisão, mesmo com erro"], ["discutivel", "Um ponto ganho com escolha discutível"], ["treinar", "Uma situação que preciso treinar"], ["proximo", "O próximo teste em quadra"]].map(function (x) {
        return '<div class="campo"><label for="g_' + x[0] + '">' + x[1] + '</label><textarea id="g_' + x[0] + '" maxlength="300">' + esc(r[x[0]]) + "</textarea></div>";
      }).join("") + "</section>" +
      '<div class="acoes"><button type="button" class="bt bt-principal" id="btSalvarReg">Salvar</button></div>';
    tela(h);
    function ler() { r.data = $("#gData").value.trim() || hoje(); r.contra = $("#gContra").value.trim(); r.cod = $("#gCod").value; ["boa", "discutivel", "treinar", "proximo"].forEach(function (k) { r[k] = $("#g_" + k).value.trim(); }); }
    function rede() { ler(); var y = window.scrollY; telaRegistroNovo(); window.scrollTo(0, y); }
    cada("[data-ap]", function (b) { b.addEventListener("click", function () { r.apareceu = b.getAttribute("data-ap"); rede(); }); });
    cada("[data-dec]", function (b) { b.addEventListener("click", function () { r.decisao = b.getAttribute("data-dec"); rede(); }); });
    cada("[data-exe]", function (b) { b.addEventListener("click", function () { r.execucao = b.getAttribute("data-exe"); rede(); }); });
    cada("[data-mais]", function (b) { b.addEventListener("click", function () { var k = b.getAttribute("data-mais"); r[k] = Math.min(30, r[k] + 1); if (k !== "oport" && r.aprov + r.recus > r.oport) r.oport = r.aprov + r.recus; rede(); }); });
    cada("[data-menos]", function (b) { b.addEventListener("click", function () { var k = b.getAttribute("data-menos"); r[k] = Math.max(0, r[k] - 1); if (k === "oport" && r.aprov + r.recus > r.oport) { r.recus = Math.max(0, r.oport - r.aprov); r.aprov = Math.min(r.aprov, r.oport); } rede(); }); });
    document.getElementById("btSalvarReg").addEventListener("click", function () {
      ler(); if (!r.apareceu) { toast("Conte se a situação apareceu."); return; }
      var j = Object.assign({ id: novoId("j"), criadoEm: new Date().toISOString() }, r); j.leitura = leituraDoJogo(j);
      est.jogos.push(j); reg = null; salvar(); location.hash = "#/registro/" + j.id;
    });
  }
  /* uma frase para o jogador sobre o que o registro mostra (regras simples do método: decisão separada da execução, contagem antes da porcentagem) */
  function leituraDoJogo(j) {
    if (j.apareceu === "nao") return "A situação não apareceu: tudo bem. Um jogo é uma amostra. Mantenha o foco no próximo.";
    if (j.apareceu !== "sim") return "Na próxima, observe nos primeiros games se a situação aparece. Antes de julgar a jogada, veja se havia tempo e equilíbrio.";
    if (j.decisao === "boa" && j.execucao === "nao") return "Você escolheu bem e a bola não saiu: o próximo passo é o golpe. Treine o exercício com mais margem (bola mais lenta, alvo maior) e mantenha a mesma escolha.";
    if (j.recus > j.aprov) return "Você viu a oportunidade e deixou passar mais vezes do que aproveitou. Volte ao Pausa e decide e, no treino, diga em voz alta \"agora\" quando a bola permitir.";
    if (j.decisao === "discutivel") return "A decisão é o que treinar agora: reveja o que ler e faça o Pausa e decide de novo antes do próximo jogo.";
    if (j.decisao === "boa" && j.execucao === "saiu") return "Decisão e execução juntas. Para fixar: faça a revisão em outro dia e teste contra outro adversário.";
    return "Registro guardado. Compare com os próximos jogos: três na mesma direção já são um sinal.";
  }
  function telaRegistro(id) {
    var j = est.jogos.filter(function (x) { return x.id === id; })[0]; if (!j) { location.hash = "#/jogo"; return; }
    var nomes = { boa: "Boa", discutivel: "Discutível", naosei: "Não sei", saiu: "Saiu", nao: "Não saiu" };
    var h = '<p class="voltar"><a href="#/jogo">‹ Jogo</a></p><p class="olho">Registro · ' + dataBR(j.data) + "</p><h1>" + esc(j.contra ? "Contra " + j.contra : "Como foi o jogo") + "</h1>" +
      '<section class="cartao retorno ok" data-leitura><b>O que isso mostra</b><p style="margin:6px 0 0">' + esc(j.leitura) + "</p></section>" +
      '<section class="cartao"><p class="olho">' + esc(j.cod ? POR_COD[j.cod].nome : "") + "</p>" +
      (j.apareceu === "sim" ? '<div class="contagem"><span>Oportunidades</span><b>' + j.oport + '</b></div><div class="contagem"><span>Aproveitou</span><b>' + j.aprov + '</b></div><div class="contagem"><span>Deixou passar</span><b>' + j.recus + '</b></div><div class="contagem"><span>Decisão</span><b>' + (nomes[j.decisao] || "—") + '</b></div><div class="contagem"><span>Execução</span><b>' + (nomes[j.execucao] || "—") + "</b></div>"
        : "<p style=\"margin:0\">" + (j.apareceu === "nao" ? "A situação não apareceu neste jogo." : "Não deu para saber se a situação apareceu.") + "</p>") + "</section>" +
      ([["boa", "Boa decisão, mesmo com erro"], ["discutivel", "Ponto ganho com escolha discutível"], ["treinar", "Preciso treinar"], ["proximo", "Próximo teste"]].filter(function (x) { return j[x[0]]; }).length ?
        '<section class="cartao">' + [["boa", "Boa decisão, mesmo com erro"], ["discutivel", "Ponto ganho com escolha discutível"], ["treinar", "Preciso treinar"], ["proximo", "Próximo teste"]].filter(function (x) { return j[x[0]]; }).map(function (x) { return '<p><b>' + x[1] + ":</b> " + esc(j[x[0]]) + "</p>"; }).join("") + "</section>" : "") +
      '<div class="acoes">' + (j.cod ? '<a class="bt bt-principal" href="#/situacao/' + j.cod + '">Voltar à situação</a>' : "") + '<button type="button" class="bt bt-texto" id="btApagarReg">Apagar registro</button></div>';
    tela(h);
    document.getElementById("btApagarReg").addEventListener("click", function () { if (!confirm("Apagar este registro?")) return; est.jogos = est.jogos.filter(function (x) { return x.id !== id; }); salvar(); location.hash = "#/jogo"; });
  }

  /* ── plano de jogo (modelo PLANO_JOGO do manual), agora com a situação que o jogador está aprendendo ── */
  var rascunho = null;
  function novoRascunho(tipo, cod) { return { tipo: tipo || "adversario", cod: cod || "", titulo: "", adv: [], cond: [], minha: cod ? POR_COD[cod].m : "", minhaTexto: "", observei: "", seFizer: "", espero: "", altB: "" }; }
  function chipsCtx(lista, sel, attr) { return '<div class="chips">' + lista.map(function (c) { return chip(attr, c, esc(CTX[c].nome), sel.indexOf(c) >= 0); }).join("") + "</div>"; }
  function sugestaoHipotese(r) {
    if (r.cod) return frases(POR_COD[r.cod].decidir)[0];
    if (r.tipo === "adversario" && r.adv.length) return frases(CTX[r.adv[0]].dica)[0];
    if (r.minha) return "Usar " + NOME_MOMENTO[r.minha].toLowerCase() + " com margem e procurar a vantagem antes de acelerar.";
    return "";
  }
  function telaNovoPlano() {
    var pc = params().cod;
    if (!rascunho) rascunho = novoRascunho("adversario", pc && POR_COD[pc] ? pc : "");
    var r = rascunho, adv = r.tipo === "adversario", n = 0, sug = sugestaoHipotese(r);
    var passo = function (t) { n++; return '<h2><span class="passo-n">' + n + "</span>" + esc(t) + "</h2>"; };
    var h = '<p class="voltar"><a href="#/jogo">‹ Jogo</a></p><h1>Plano para o próximo jogo</h1>' +
      '<div class="chips" style="margin:0 0 12px">' + chip("data-tipo-plano", "adversario", "Contra um adversário", adv) + chip("data-tipo-plano", "meu", "Meu jogo", !adv) + "</div>" +
      (r.cod ? '<section class="cartao semana"><p class="olho">Situação que você está aprendendo</p><h2 style="margin:0">' + esc(POR_COD[r.cod].nome) + "</h2></section>" : "") +
      '<section class="cartao">' + passo(adv ? "Jogo e adversário" : "Para qual jogo") + '<input type="text" id="plTitulo" maxlength="80" placeholder="' + (adv ? "Ex.: Copa Sul · contra Marcos" : "Ex.: Torneio de dezembro") + '" value="' + esc(r.titulo) + '"></section>' +
      '<section class="cartao">' + passo("Minha principal solução") + '<p class="nota" style="margin-top:0">Onde você ganha mais pontos hoje?</p><div class="chips">' + MOMENTOS.filter(function (m) { return m.l !== "U"; }).map(function (m) { return chip("data-minha", m.l, esc(m.n), r.minha === m.l); }).join("") + "</div>" +
        '<div class="campo"><label for="plMinhaTxt">Em uma frase <span class="nota">(opcional)</span></label><input type="text" id="plMinhaTxt" maxlength="140" placeholder="Ex.: forehand cruzado profundo para abrir a quadra" value="' + esc(r.minhaTexto) + '"></div></section>' +
      (adv ? '<section class="cartao">' + passo("O que observei no adversário") + '<p class="nota" style="margin-top:0">Escolha até 3. É hipótese, não rótulo: os primeiros games confirmam ou não.</p>' + chipsCtx(CTX_ADV, r.adv, "data-adv") +
        '<div class="campo"><label for="plObservei">Anotação <span class="nota">(opcional)</span></label><input type="text" id="plObservei" maxlength="160" placeholder="Ex.: erra mais quando a bola vem alta no backhand" value="' + esc(r.observei) + '"></div></section>' : "") +
      '<section class="cartao">' + passo("Condições do jogo") + '<p class="nota" style="margin-top:0">Opcional.</p>' + chipsCtx(CTX_COND, r.cond, "data-cond") + "</section>" +
      '<section class="cartao">' + passo("Hipótese A") + '<div class="campo" style="margin-top:0"><label for="plSeFizer">Se eu fizer…</label><input type="text" id="plSeFizer" maxlength="140" placeholder="Ex.: bolas profundas e altas no backhand" value="' + esc(r.seFizer) + '"></div>' +
        '<div class="campo"><label for="plEspero">…espero provocar</label><input type="text" id="plEspero" maxlength="140" placeholder="Ex.: respostas curtas para eu atacar" value="' + esc(r.espero) + '"></div>' +
        (sug ? '<p class="sugestao" data-sugestao><b>Sugestão do manual:</b> ' + esc(sug) + "</p>" : "") + "</section>" +
      '<section class="cartao">' + passo("Alternativa B") + '<input type="text" id="plAltB" maxlength="140" placeholder="O que fazer se a hipótese A não funcionar" value="' + esc(r.altB) + '"><p class="nota" style="margin:6px 0 0">Deixe em branco e o app sugere uma a partir do manual.</p></section>' +
      '<div class="ia"><span aria-hidden="true">✦</span><span><b>No app de verdade:</b> a IA pode escrever o plano com os números dos jogos marcados no QuadraLab Scout. Neste protótipo, o texto vem do próprio manual.</span></div>' +
      '<div class="acoes"><button type="button" class="bt bt-ambar" id="btGerar">Montar o plano</button></div>';
    tela(h);
    function ler() { r.titulo = $("#plTitulo").value; r.minhaTexto = $("#plMinhaTxt").value; r.seFizer = $("#plSeFizer").value; r.espero = $("#plEspero").value; r.altB = $("#plAltB").value; var ob = $("#plObservei"); if (ob) r.observei = ob.value; }
    function rede() { ler(); var y = window.scrollY; telaNovoPlano(); window.scrollTo(0, y); }
    cada("[data-tipo-plano]", function (b) { b.addEventListener("click", function () { ler(); r.tipo = b.getAttribute("data-tipo-plano"); telaNovoPlano(); }); });
    cada("[data-minha]", function (b) { b.addEventListener("click", function () { var v = b.getAttribute("data-minha"); r.minha = r.minha === v ? "" : v; rede(); }); });
    cada("[data-adv]", function (b) { b.addEventListener("click", function () { var v = b.getAttribute("data-adv"), i = r.adv.indexOf(v); if (i >= 0) r.adv.splice(i, 1); else if (r.adv.length >= 3) { toast("No máximo 3: escolha o que mais aparece."); return; } else r.adv.push(v); rede(); }); });
    cada("[data-cond]", function (b) { b.addEventListener("click", function () { var v = b.getAttribute("data-cond"), i = r.cond.indexOf(v); if (i >= 0) r.cond.splice(i, 1); else r.cond.push(v); rede(); }); });
    document.getElementById("btGerar").addEventListener("click", function () {
      ler();
      if (!r.minha) { toast("Escolha a sua principal solução."); return; }
      if (adv && !r.adv.length && !r.observei.trim() && !r.cod) { toast("Conte o que você observou no adversário."); return; }
      var p = montarPlano(r); est.planos.push(p); salvar(); rascunho = null; location.hash = "#/plano/" + p.id;
    });
  }
  function fichasParaTreinar(r) {
    var ms = [], out = r.cod ? [r.cod] : [];
    if (r.tipo === "adversario") r.adv.forEach(function (c) { (MOMENTO_DO_ADV[c] || []).forEach(function (m) { if (ms.indexOf(m) < 0) ms.push(m); }); });
    if (r.minha && ms.indexOf(r.minha) < 0) ms.push(r.minha);
    if (!ms.length) ms = ["F"];
    ms.forEach(function (m) { FICHAS.filter(function (f) { return f.m === m && servePara(f, meuNivel()); }).sort(function (a, b) { return a.prio.localeCompare(b.prio); }).slice(0, 2).forEach(function (f) { if (out.length < 4 && out.indexOf(f.cod) < 0) out.push(f.cod); }); });
    return out;
  }
  function montarPlano(r) {
    var treinar = fichasParaTreinar(r), f0 = POR_COD[treinar[0]], c0 = r.adv.length ? CTX[r.adv[0]] : null;
    var hipotese = r.seFizer.trim() && r.espero.trim() ? "Se eu fizer " + r.seFizer.trim().replace(/\.$/, "") + ", espero provocar " + r.espero.trim().replace(/\.$/, "") + "." : (sugestaoHipotese(r) || "Testar a minha solução principal nos primeiros games e observar a resposta.");
    var decidirSe = f0 ? frases(f0.decidir).filter(function (x) { return /^Se\b/.test(x); })[0] : "";
    var naoInsistir = c0 && frases(c0.dica)[1] ? frases(c0.dica)[1] : decidirSe || (S.ESTADOS[0][1] + ": " + S.ESTADOS[0][2].toLowerCase() + ".");
    return {
      id: novoId("p"), criadoEm: new Date().toISOString(), tipo: r.tipo, cod: r.cod, titulo: r.titulo.trim(), nivel: meuNivel(),
      minha: (NOME_MOMENTO[r.minha] || "") + (r.minhaTexto.trim() ? ": " + r.minhaTexto.trim() : ""),
      observei: r.adv.map(function (c) { return CTX[c].nome; }).concat(r.observei.trim() ? [r.observei.trim()] : []),
      hipotese: hipotese, sinais: [S.ESTADOS[2][0] + ": " + S.ESTADOS[2][1].toLowerCase() + "."].concat(f0 ? [f0.ler] : []),
      naoInsistir: naoInsistir, altB: r.altB.trim() || (decidirSe && decidirSe !== naoInsistir ? decidirSe : "") || "Voltar à minha solução principal com mais margem e testar outra direção.",
      condicoes: r.cond.map(function (c) { return { nome: CTX[c].nome, dica: CTX[c].dica }; }),
      placar: CTX_PLACAR.map(function (c) { return { nome: CTX[c].nome, dica: frases(CTX[c].dica)[0] }; }), treinar: treinar,
    };
  }
  function telaPlano(id) {
    var p = est.planos.filter(function (x) { return x.id === id; })[0]; if (!p) { location.hash = "#/jogo"; return; }
    var item = function (t, corpo) { return '<div class="item"><p class="olho">' + esc(t) + "</p>" + corpo + "</div>"; };
    var ul = function (l) { return "<ul>" + l.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>"; };
    var h = '<p class="voltar"><a href="#/jogo">‹ Jogo</a></p><p class="olho">' + (p.tipo === "meu" ? "Plano do meu jogo" : "Plano contra um adversário") + "</p><h1>" + esc(p.titulo || "Plano de jogo") + "</h1>" +
      '<section class="cartao plano-doc" data-plano>' +
      (p.cod ? item("Situação que estou aprendendo", "<p><b>" + esc(POR_COD[p.cod].nome) + "</b></p>") : "") +
      item("Minha principal solução", "<p>" + esc(p.minha) + "</p>") + (p.observei.length ? item("O que observei no adversário", ul(p.observei)) : "") +
      item("Hipótese A", "<p><b>" + esc(p.hipotese) + "</b></p>") + item("Sinais que permitem executar", ul(p.sinais)) +
      item("Quando não insistir", "<p>" + esc(p.naoInsistir) + "</p>") + item("Alternativa B", "<p>" + esc(p.altB) + "</p>") +
      (p.condicoes.length ? item("Condições", ul(p.condicoes.map(function (c) { return c.nome + ": " + c.dica; }))) : "") +
      item("Momentos do placar", ul(p.placar.map(function (c) { return c.nome + ": " + c.dica; }))) +
      item("Na troca de lado", ul(["O que aconteceu?", "O que o adversário mudou?", "O que eu mantenho?", "O que eu ajusto?"])) + "</section>" +
      '<section class="cartao"><h2>Para treinar antes do jogo</h2><ul class="lista-fichas">' + p.treinar.map(function (c) { return itemFicha(POR_COD[c]); }).join("") + "</ul></section>" +
      '<div class="acoes"><a class="bt bt-ambar" href="#/registro/novo?' + (p.cod ? "cod=" + p.cod + "&" : "") + "plano=" + p.id + '">Depois do jogo: registrar como foi</a><a class="bt" target="_blank" rel="noopener noreferrer" href="https://wa.me/?text=' + encodeURIComponent(textoPlano(p)) + '">Mandar no WhatsApp</a><button type="button" class="bt" id="btImprimir">Imprimir ou PDF</button><button type="button" class="bt bt-texto" id="btApagarPlano">Apagar plano</button></div>';
    tela(h);
    document.getElementById("btImprimir").addEventListener("click", function () { window.print(); });
    document.getElementById("btApagarPlano").addEventListener("click", function () { if (!confirm("Apagar este plano de jogo?")) return; est.planos = est.planos.filter(function (x) { return x.id !== id; }); salvar(); toast("Plano apagado."); location.hash = "#/jogo"; });
  }
  function textoPlano(p) { return ["Plano de jogo" + (p.titulo ? " · " + p.titulo : ""), "", (p.cod ? "Situação: " + POR_COD[p.cod].nome + "\n" : "") + "Minha solução: " + p.minha, "Hipótese A: " + p.hipotese, "Sinais: " + p.sinais.join(" "), "Quando não insistir: " + p.naoInsistir, "Alternativa B: " + p.altB, "", "QuadraLab Tática"].join("\n"); }

  /* ══ Proposta comercial (só para ver; nada é vendido aqui) ══ */
  function telaProposta() {
    tela('<p class="voltar"><a href="#/">‹ Início</a></p><h1>Proposta de planos</h1><p class="sub">Protótipo: como o app poderia ser vendido. Sem preço e sem compra.</p><div class="planos-preco">' +
      '<section class="cartao"><p class="olho">Grátis</p><ul><li>Diagnóstico e a trilha montada</li><li>A primeira situação da trilha, com os 6 passos</li><li>Como decidir: o método</li><li>Simulador: os cenários iniciais</li><li>1 registro de jogo</li></ul></section>' +
      '<section class="cartao destaque"><p class="olho">Completo · plano anual</p><ul><li>Trilhas sem limite e as 96 situações</li><li>Pausa e decide com revisão em outro dia</li><li>Vídeo com pausa (seus jogos e trechos escolhidos pelo Richard)</li><li>Simulador completo</li><li>Plano de jogo e registro de jogos com evolução</li><li>O manual completo</li><li>Depois: plano escrito pela IA com os jogos do QuadraLab Scout</li></ul><p class="nota" style="margin:8px 0 0"><b>Preço a definir.</b></p></section></div>' +
      '<section class="cartao"><h2>Para treinadores (ideia)</h2><p style="margin:0">O treinador acompanha a trilha dos alunos, manda trechos de vídeo com pausa e vê os registros de jogo: decisão separada da execução, oportunidades aproveitadas e recusadas, retenção e transferência.</p></section>');
  }

  /* ══ rotas ══ */
  function marcarAba(aba) { Array.prototype.forEach.call(document.querySelectorAll("#abas a"), function (a) { if (a.getAttribute("data-aba") === aba) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); }); }
  function rota() {
    var p = (location.hash || "#/").replace(/^#\/?/, "").split("?")[0].split("/");
    var r = p[0];
    if (r === "aprender" || r === "manual" && !p[1]) { marcarAba("aprender"); telaAprender(); }
    else if (r === "manual") { marcarAba("aprender"); telaMomento(p[1]); }
    else if (r === "situacao" || r === "ficha") { marcarAba("aprender"); telaSituacao(p[1]); }
    else if (r === "metodo") { marcarAba("aprender"); telaMetodo(); }
    else if (r === "ler") { marcarAba("aprender"); telaLer(p[1]); }
    else if (r === "treinar") { marcarAba("treinar"); telaTreinar(); }
    else if (r === "quiz") { marcarAba("treinar"); telaQuiz(p[1]); }
    else if (r === "videos") { marcarAba("treinar"); telaVideos(); }
    else if (r === "video" && p[1] === "novo") { marcarAba("treinar"); telaVideoNovo(); }
    else if (r === "video") { marcarAba("treinar"); telaVideo(p[1]); }
    else if (r === "simulador") { marcarAba("treinar"); telaSimulador(p[1]); }
    else if (r === "jogo" || r === "plano" && !p[1]) { marcarAba("jogo"); telaJogo(); }
    else if (r === "plano" && p[1] === "novo") { marcarAba("jogo"); telaNovoPlano(); }
    else if (r === "plano") { marcarAba("jogo"); telaPlano(p[1]); }
    else if (r === "registro" && p[1] === "novo") { marcarAba("jogo"); telaRegistroNovo(); }
    else if (r === "registro") { marcarAba("jogo"); reg = null; telaRegistro(p[1]); }
    else if (r === "planos") { marcarAba(""); telaProposta(); }
    else { marcarAba("inicio"); telaInicio(); }
  }
  window.addEventListener("hashchange", function () { if (!/^#\/registro\/novo/.test(location.hash)) reg = null; if (!/^#\/video\//.test(location.hash)) vid = null; rota(); });
  rota();
})();
