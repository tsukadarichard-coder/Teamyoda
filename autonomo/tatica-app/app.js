/* QuadraLab Tática · protótipo (pedido do Richard em 14/11/2026: "Faça o app separado... só um protótipo", sem publicar).
   Junta o que já existe: as 96 situações do manual tático do Richard (mty/situacoes-jogo.js, sem mudar o arquivo),
   o Simulador de Decisões (autonomo/decisoes, aberto dentro do app) e um plano de jogo montado a partir do método.
   Sem conta, sem servidor, sem IA e sem cobrança: tudo fica neste aparelho (localStorage "qlt:v1"). */
(function () {
  "use strict";
  var S = window.MTYSituacoes, app = document.getElementById("app");
  if (!S) { app.innerHTML = '<p class="cartao">Não foi possível carregar o manual tático.</p>'; return; }

  /* ── utilidades ── */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(sel) { return app.querySelector(sel); }
  function cada(sel, f) { Array.prototype.forEach.call(app.querySelectorAll(sel), f); }
  function frases(t) { return String(t || "").split(/(?<=[.!?])\s+/).filter(Boolean); }
  var tmrToast = null;
  function toast(t) { var el = document.getElementById("toast"); el.textContent = t; el.hidden = false; clearTimeout(tmrToast); tmrToast = setTimeout(function () { el.hidden = true; }, 2600); }
  function tela(h) { app.innerHTML = h; window.scrollTo(0, 0); try { app.focus({ preventScroll: true }); } catch (e) { /* sem foco */ } }

  /* ── estado do aparelho ── */
  var CHAVE = "qlt:v1", est;
  function carregar() {
    try { est = JSON.parse(localStorage.getItem(CHAVE) || "null"); } catch (e) { est = null; }
    if (!est || typeof est !== "object") est = {};
    est.vistas = est.vistas || {}; est.treinadas = est.treinadas || {}; est.planos = Array.isArray(est.planos) ? est.planos : [];
  }
  function salvar() { try { localStorage.setItem(CHAVE, JSON.stringify(est)); } catch (e) { /* sem armazenamento: segue na memória */ } }
  carregar();

  /* ── conteúdo ── */
  var FICHAS = S.FICHAS.map(function (f) { return { cod: f[0], nome: f[1], faixa: f[2], prio: f[3], ler: f[4], decidir: f[5], exercicio: f[6], variar: f[7], medir: f[8], m: f[0].charAt(0) }; });
  var POR_COD = {}; FICHAS.forEach(function (f) { POR_COD[f.cod] = f; });
  var MOMENTOS = S.MOMENTOS;
  var NOME_MOMENTO = {}; MOMENTOS.forEach(function (m) { NOME_MOMENTO[m.l] = m.n; });
  var NIVEIS = S.NIVEIS; // [N0, Y1, nome, consegue, foco]
  var PRIO = { P1: "Base", P2: "Desenvolvimento", P3: "Avançado" };
  var CTX = {}; S.CONTEXTOS.forEach(function (c) { CTX[c[0]] = { cod: c[0], nome: c[1], dica: c[2], grupo: c[3] }; });
  var CTX_ADV = ["X09", "X10", "X11", "X12", "X13", "X14", "X15", "X16", "X17", "X18", "X19", "X20", "X21", "X22", "X23", "X24"];
  var CTX_COND = ["X25", "X26", "X27", "X28", "X29", "X30", "X31", "X32"];
  var CTX_PLACAR = ["X02", "X05", "X06"];
  /* que momentos do jogo treinar contra cada tipo de adversário (proposta do protótipo; o Richard ajusta) */
  var MOMENTO_DO_ADV = { X09: ["C", "T"], X10: ["D", "C"], X11: ["T", "N"], X12: ["C", "D"], X13: ["R", "D"], X14: ["R"], X15: ["R", "D"], X16: ["C"],
    X17: ["S", "R"], X18: ["C"], X19: ["C", "T"], X20: ["F"], X21: ["F", "S"], X22: ["C"], X23: ["C", "T"], X24: ["F"] };

  function nivelNum(n) { return +String(n || "N2").slice(1); }
  function servePara(f, nivel) {
    var m = String(f.faixa).match(/N(\d)(?:\s*a\s*N(\d))?/); if (!m) return true;
    var a = +m[1], b = m[2] != null ? +m[2] : a, n = nivelNum(nivel);
    return n >= a && n <= b;
  }
  function meuNivel() { return est.nivel || "N2"; }
  function nomeNivel(n) { var x = NIVEIS.filter(function (v) { return v[0] === n; })[0]; return x ? x[2] : n; }

  /* ══ Início ══ */
  function semanaDoAno(d) { var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); var dia = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dia); var a = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - a) / 864e5 + 1) / 7); }
  function situacaoDaSemana() {
    var cand = FICHAS.filter(function (f) { return servePara(f, meuNivel()); });
    if (!cand.length) cand = FICHAS;
    return cand[semanaDoAno(new Date()) % cand.length];
  }
  function estrelasSimulador() {
    try { var r = JSON.parse(localStorage.getItem("qlDecisoes:resumo") || "null"); if (r && typeof r.estrelas === "number") return r; } catch (e) { /* sem resumo */ }
    return null;
  }
  function telaInicio() {
    var sem = situacaoDaSemana(), vistas = Object.keys(est.vistas).length, sim = estrelasSimulador();
    var h = '<section class="hero"><p class="olho">Tênis · tática por situação de jogo</p><h1>Decida melhor em cada ponto.</h1>' +
      "<p>O manual tático do Richard Tsukada, o simulador de decisões e o seu plano de jogo, num app só.</p>" +
      '<svg class="quadra" viewBox="0 0 100 120" aria-hidden="true"><rect x="5" y="5" width="90" height="110" fill="none" stroke="#fff" stroke-width="3"/><path d="M5 60h90M50 5v110M20 5v110M80 5v110" stroke="#fff" stroke-width="2"/></svg></section>';
    if (!est.nivel) {
      h += '<section class="cartao" data-escolher-nivel><h2>Em que fase você está?</h2><p class="nota" style="margin-top:0">O app mostra primeiro as situações do seu momento. Dá para trocar depois.</p><div class="chips">' +
        NIVEIS.map(function (n) { return '<button type="button" class="chip" data-nivel="' + n[0] + '">' + esc(n[2]) + "</button>"; }).join("") + "</div></section>";
    }
    h += '<section class="cartao semana" data-semana><p class="olho">Situação da semana · ' + esc(NOME_MOMENTO[sem.m]) + "</p><h2>" + esc(sem.nome) + '</h2><p><b>O que ler:</b> ' + esc(sem.ler) + '</p><div class="acoes"><a class="bt bt-principal bt-pq" href="#/ficha/' + sem.cod + '">Ver a situação</a><a class="bt bt-pq" href="#/simulador">Treinar no simulador</a></div></section>';
    h += '<div class="trio"><div class="num"><b>' + vistas + '</b><span>de 96 situações vistas</span></div><div class="num"><b>' + est.planos.length + '</b><span>planos de jogo</span></div><div class="num"><b>' + (sim ? sim.estrelas : 0) + "</b><span>estrelas no simulador</span></div></div>";
    h += '<div class="atalhos">' +
      atalho("#/manual", "M", "Manual tático", "96 situações em 8 momentos do jogo") +
      atalho("#/simulador", "▶", "Simulador", "Escolha a jogada e veja a resposta") +
      atalho("#/plano/novo", "↗", "Plano de jogo", "Hipótese, sinais e alternativa") +
      atalho("#/metodo", "?", "Como decidir", "Os 6 elementos e os 4 estados do ponto") + "</div>";
    h += '<section class="cartao"><h2>Como o app ajuda</h2><ol style="margin:0;padding-left:20px"><li><b>Entender</b> a situação: o que ler, como decidir e qual a alternativa.</li><li><b>Treinar a decisão</b> no simulador, sem quadra e sem pressão.</li><li><b>Levar para o jogo</b> com um plano simples: hipótese, sinais, quando não insistir e o que ajustar na troca de lado.</li></ol></section>';
    h += '<section class="cartao"><p class="olho">Proposta comercial (protótipo)</p><h2>Grátis e Completo</h2><p class="nota" style="margin:0">Como o app poderia ser vendido. Nada é cobrado aqui.</p><div class="acoes"><a class="bt bt-pq" href="#/planos">Ver a proposta</a>' +
      (est.nivel ? '<button type="button" class="bt bt-pq bt-texto" id="btTrocarNivel">Fase: ' + esc(nomeNivel(est.nivel)) + " · trocar</button>" : "") + "</div></section>";
    tela(h);
    cada("[data-nivel]", function (b) { b.addEventListener("click", function () { est.nivel = b.getAttribute("data-nivel"); salvar(); toast("Fase escolhida: " + nomeNivel(est.nivel) + "."); telaInicio(); }); });
    var tn = document.getElementById("btTrocarNivel"); if (tn) tn.addEventListener("click", function () { delete est.nivel; salvar(); telaInicio(); });
  }
  function atalho(href, ic, t, s) { return '<a class="atalho" href="' + href + '"><span class="ic">' + ic + "</span><b>" + esc(t) + "</b><span>" + esc(s) + "</span></a>"; }

  /* ══ Manual ══ */
  var busca = "";
  function itemFicha(f) {
    return '<li><a class="ficha-l" href="#/ficha/' + f.cod + '"><span class="cod">' + f.cod + " · " + esc(NOME_MOMENTO[f.m]) + '</span><b>' + esc(f.nome) + '</b><span class="tag ' + f.prio.toLowerCase() + '">' + esc(PRIO[f.prio]) + '</span> <span class="tag">' + esc(f.faixa.replace(/N(\d)/g, function (m, d) { return nomeNivel("N" + d); })) + "</span>" +
      (est.vistas[f.cod] ? ' <span class="vista">✓ vista</span>' : "") + "</a></li>";
  }
  function telaManual() {
    var h = "<h1>Manual tático</h1><p class=\"sub\">96 situações de jogo em 8 momentos. Cada uma diz o que ler, como decidir, a alternativa e como treinar.</p>" +
      '<div class="campo" style="margin:0 0 12px"><input type="search" id="busca" placeholder="Buscar: devolução, bola curta, vento…" value="' + esc(busca) + '" aria-label="Buscar no manual"></div><div id="resBusca"></div>' +
      '<div id="semBusca"><div class="momentos">' + MOMENTOS.map(function (m) {
        var fs = FICHAS.filter(function (f) { return f.m === m.l; }), v = fs.filter(function (f) { return est.vistas[f.cod]; }).length;
        return '<a class="momento" href="#/manual/' + m.l + '"><span class="letra">' + m.l + "</span><span><b>" + esc(m.n) + "</b><span>" + fs.length + " situações" + (v ? " · " + v + " vistas" : "") + '</span></span><span class="seta">›</span></a>';
      }).join("") + "</div>" +
      '<section class="cartao" style="margin-top:12px"><h2>Antes de começar</h2><p>' + esc(S.PRINCIPIOS[0]) + '</p><div class="acoes"><a class="bt bt-pq" href="#/metodo">Como decidir: o método</a></div></section></div>';
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
  var soMeuNivel = true;
  function telaMomento(l) {
    var nome = NOME_MOMENTO[l]; if (!nome) { location.hash = "#/manual"; return; }
    var todas = FICHAS.filter(function (f) { return f.m === l; }), fs = soMeuNivel && est.nivel ? todas.filter(function (f) { return servePara(f, est.nivel); }) : todas;
    var h = '<p class="voltar"><a href="#/manual">‹ Manual</a></p><h1>' + esc(nome) + '</h1><p class="sub">' + todas.length + " situações. Comece pelas de base (verde) e avance quando a decisão aparecer sem lembrete.</p>" +
      (est.nivel ? '<div class="chips" style="margin:0 0 12px"><button type="button" class="chip" data-filtro="meu" aria-pressed="' + soMeuNivel + '">Da minha fase (' + esc(nomeNivel(est.nivel)) + ")</button>" +
        '<button type="button" class="chip" data-filtro="todas" aria-pressed="' + !soMeuNivel + '">Todas</button></div>' : "") +
      (fs.length ? '<ul class="lista-fichas">' + fs.map(itemFicha).join("") + "</ul>" : '<div class="cartao">Nenhuma situação deste momento é da sua fase. Veja todas.</div>');
    tela(h);
    cada("[data-filtro]", function (b) { b.addEventListener("click", function () { soMeuNivel = b.getAttribute("data-filtro") === "meu"; telaMomento(l); }); });
  }
  function telaFicha(cod) {
    var f = POR_COD[cod]; if (!f) { location.hash = "#/manual"; return; }
    if (!est.vistas[cod]) { est.vistas[cod] = Date.now(); salvar(); }
    var lista = FICHAS.filter(function (x) { return x.m === f.m; }), i = lista.indexOf(f), ant = lista[i - 1], prox = lista[i + 1];
    var bloco = function (ic, t, txt) { return '<div class="bloco"><h3><i>' + ic + "</i>" + esc(t) + "</h3><p>" + esc(txt) + "</p></div>"; };
    var h = '<p class="voltar"><a href="#/manual/' + f.m + '">‹ ' + esc(NOME_MOMENTO[f.m]) + "</a></p>" +
      '<p class="olho">' + f.cod + " · " + esc(NOME_MOMENTO[f.m]) + "</p><h1>" + esc(f.nome) + '</h1><p><span class="tag ' + f.prio.toLowerCase() + '">' + esc(PRIO[f.prio]) + '</span> <span class="tag">' + esc(f.faixa.replace(/N(\d)/g, function (m, d) { return nomeNivel("N" + d); })) + "</span></p>" +
      '<p class="nota" style="margin:8px 0 10px">Nas situações, <b>A</b> é você e <b>B</b> é o adversário.</p>' +
      '<section class="cartao" data-ficha>' + bloco("1", "O que ler", f.ler) + bloco("2", "Como decidir", f.decidir) + bloco("3", "Exercício", f.exercicio) + bloco("4", "Variar", f.variar) + bloco("5", "Como saber se está funcionando", f.medir) + "</section>" +
      '<section class="cartao"><p class="nota" style="margin-top:0">' + esc(S.MONTAGEM_COMUM) + '</p><p class="nota" style="margin:0"><b>Se ficar difícil:</b> ' + esc(S.SIMPLIFICACAO) + "</p></section>" +
      '<div class="acoes"><button type="button" class="bt ' + (est.treinadas[cod] ? "" : "bt-principal") + '" id="btTreinei">' + (est.treinadas[cod] ? "✓ Treinei esta situação" : "Marcar como treinada") + '</button><a class="bt" href="#/simulador">Treinar no simulador</a></div>' +
      '<div class="acoes" style="justify-content:space-between">' + (ant ? '<a class="bt bt-texto" href="#/ficha/' + ant.cod + '">‹ ' + esc(ant.nome) + "</a>" : "<span></span>") + (prox ? '<a class="bt bt-texto" href="#/ficha/' + prox.cod + '">' + esc(prox.nome) + " ›</a>" : "") + "</div>";
    tela(h);
    document.getElementById("btTreinei").addEventListener("click", function () {
      if (est.treinadas[cod]) delete est.treinadas[cod]; else est.treinadas[cod] = Date.now();
      salvar(); toast(est.treinadas[cod] ? "Marcada como treinada." : "Marcação tirada."); telaFicha(cod);
    });
  }
  function telaMetodo() {
    var h = '<p class="voltar"><a href="#/manual">‹ Manual</a></p><h1>Como decidir</h1><p class="sub">O método por trás das situações: o que olhar antes de escolher a jogada.</p>' +
      '<section class="cartao"><h2>Os 6 elementos de uma decisão</h2>' + S.ELEMENTOS.map(function (e, i) { return '<div class="bloco"><h3><i>' + (i + 1) + "</i>" + esc(e[0]) + "</h3><p>" + esc(e[1]) + "</p></div>"; }).join("") + "</section>" +
      '<section class="cartao"><h2>Os 4 estados do ponto</h2><div class="estados">' + S.ESTADOS.map(function (e) { return '<div class="estado"><b>' + esc(e[0]) + "</b><span>" + esc(e[1]) + "</span><p class=\"nota\" style=\"margin:6px 0 0\"><b>O que buscar:</b> " + esc(e[2]) + "</p></div>"; }).join("") + '</div><p class="nota" style="margin:10px 0 0">' + esc(frases(S.ESTADOS_NOTA).slice(0, 2).join(" ")) + "</p></section>" +
      '<section class="cartao"><h2>Estratégia e tática</h2><p style="margin:0">' + esc(S.ESTRATEGIA_TATICA) + "</p></section>" +
      '<section class="cartao"><h2>As fases do jogador</h2>' + NIVEIS.map(function (n) { return '<div class="bloco"><h3><i>' + n[0].slice(1) + "</i>" + esc(n[2]) + "</h3><p><b>Consegue:</b> " + esc(n[3]) + ". <b>Foco:</b> " + esc(n[4]) + ".</p></div>"; }).join("") + '<p class="nota" style="margin:10px 0 0">' + esc(frases(S.NIVEIS_NOTA)[0]) + "</p></section>" +
      '<section class="cartao"><h2>Princípios</h2>' + S.PRINCIPIOS.map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") + "</section>";
    tela(h);
  }

  /* ══ Simulador (o mesmo Simulador de Decisões, aberto dentro do app sem o cabeçalho e sem os convites da consultoria, que está parada) ══ */
  var SIM_URL = window.QLT_SIM_URL || "../decisoes/index.html";
  var simAba = "cenarios";
  var CSS_SIM = '.topo,.rodape,.convite,a[href="#consultoria"],a[href="#modulo"],a[href*="player"],.pular{display:none!important}body{padding-top:0!important;background:#fff!important}';
  function telaSimulador(aba) {
    if (aba) simAba = aba;
    var h = '<h1>Simulador de decisões</h1><p class="sub">Escolha a jogada, veja uma resposta possível do adversário e entenda como uma decisão leva à próxima.</p>' +
      '<div class="chips sim-nav" role="group" aria-label="Simulador">' + [["cenarios", "Cenários"], ["desafios", "Desafios"], ["progresso", "Progresso"]].map(function (x) { return '<button type="button" class="chip" data-sim="' + x[0] + '" aria-pressed="' + (simAba === x[0]) + '">' + x[1] + "</button>"; }).join("") + "</div>" +
      '<div class="sim-moldura"><iframe id="simFrame" title="Simulador de decisões" src="' + esc(SIM_URL) + "#" + simAba + '"></iframe></div>';
    tela(h);
    var fr = document.getElementById("simFrame");
    fr.addEventListener("load", function () {
      try { var d = fr.contentDocument; if (d && !d.getElementById("qltEstilo")) { var s = d.createElement("style"); s.id = "qltEstilo"; s.textContent = CSS_SIM; d.head.appendChild(s); } } catch (e) { /* outro endereço: fica como está */ }
    });
    cada("[data-sim]", function (b) { b.addEventListener("click", function () { simAba = b.getAttribute("data-sim"); cada("[data-sim]", function (x) { x.setAttribute("aria-pressed", String(x === b)); }); try { fr.contentWindow.location.hash = simAba; } catch (e) { fr.src = SIM_URL + "#" + simAba; } }); });
  }

  /* ══ Plano de jogo ══
     Segue o modelo do manual (PLANO_JOGO): solução principal, o que observei, hipótese A, sinais, quando não insistir, alternativa B,
     troca de lado e depois do jogo. No protótipo o texto sai do próprio manual; no app de verdade a IA pode escrever com os jogos do Scout. */
  var rascunho = null;
  function novoRascunho(tipo) { return { tipo: tipo || "adversario", titulo: "", adv: [], cond: [], minha: "", minhaTexto: "", observei: "", seFizer: "", espero: "", altB: "" }; }
  function telaPlanos() {
    var h = '<h1>Plano de jogo</h1><p class="sub">Antes do jogo, um plano curto: o que testar, os sinais para executar, quando não insistir e a alternativa.</p>' +
      '<div class="acoes" style="margin:0 0 14px"><a class="bt bt-principal" href="#/plano/novo" data-tipo="adversario">Contra um adversário</a><a class="bt" href="#/plano/novo" data-tipo="meu">Meu jogo</a></div>';
    if (!est.planos.length) h += '<section class="cartao"><b>Nenhum plano ainda.</b><p class="nota" style="margin:6px 0 0">' + esc(frases(S.ESTRATEGIA_TATICA).slice(-1)[0]) + "</p></section>";
    else h += '<ul class="lista-fichas">' + est.planos.slice().reverse().map(function (p) {
      return '<li><a class="ficha-l" href="#/plano/' + p.id + '"><span class="cod">' + (p.tipo === "meu" ? "Meu jogo" : "Contra adversário") + " · " + new Date(p.criadoEm).toLocaleDateString("pt-BR") + "</span><b>" + esc(p.titulo || (p.tipo === "meu" ? "Plano do meu jogo" : "Plano de jogo")) + '</b><span class="nota">' + esc(p.hipotese) + "</span></a></li>";
    }).join("") + "</ul>";
    tela(h);
    cada("[data-tipo]", function (a) { a.addEventListener("click", function () { rascunho = novoRascunho(a.getAttribute("data-tipo")); }); });
  }
  function chipsCtx(lista, sel, attr) { return '<div class="chips">' + lista.map(function (c) { return '<button type="button" class="chip" ' + attr + '="' + c + '" aria-pressed="' + (sel.indexOf(c) >= 0) + '">' + esc(CTX[c].nome) + "</button>"; }).join("") + "</div>"; }
  function sugestaoHipotese(r) {
    if (r.tipo === "adversario" && r.adv.length) return frases(CTX[r.adv[0]].dica)[0];
    if (r.minha) return "Usar " + NOME_MOMENTO[r.minha].toLowerCase() + " com margem e procurar a vantagem antes de acelerar.";
    return "";
  }
  function telaNovoPlano() {
    if (!rascunho) rascunho = novoRascunho("adversario");
    var r = rascunho, adv = r.tipo === "adversario", n = 0, sug = sugestaoHipotese(r);
    var passo = function (t) { n++; return '<h2><span class="passo-n">' + n + "</span>" + esc(t) + "</h2>"; };
    var h = '<p class="voltar"><a href="#/plano">‹ Planos de jogo</a></p><h1>' + (adv ? "Plano contra um adversário" : "Plano do meu jogo") + '</h1><div class="chips" style="margin:0 0 12px"><button type="button" class="chip" data-tipo-plano="adversario" aria-pressed="' + adv + '">Contra adversário</button><button type="button" class="chip" data-tipo-plano="meu" aria-pressed="' + !adv + '">Meu jogo</button></div>' +
      '<section class="cartao">' + passo(adv ? "Jogo e adversário" : "Para qual jogo ou treino") + '<input type="text" id="plTitulo" maxlength="80" placeholder="' + (adv ? "Ex.: Copa Sul · contra Marcos" : "Ex.: Torneio de dezembro") + '" value="' + esc(r.titulo) + '"></section>' +
      '<section class="cartao">' + passo("Minha principal solução") + '<p class="nota" style="margin-top:0">Onde você ganha mais pontos hoje?</p><div class="chips">' + MOMENTOS.filter(function (m) { return m.l !== "U"; }).map(function (m) { return '<button type="button" class="chip" data-minha="' + m.l + '" aria-pressed="' + (r.minha === m.l) + '">' + esc(m.n) + "</button>"; }).join("") + "</div>" +
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
    function ler() {
      r.titulo = $("#plTitulo").value; r.minhaTexto = $("#plMinhaTxt").value; r.seFizer = $("#plSeFizer").value; r.espero = $("#plEspero").value; r.altB = $("#plAltB").value;
      var ob = $("#plObservei"); if (ob) r.observei = ob.value;
    }
    function rede() { ler(); var y = window.scrollY; telaNovoPlano(); window.scrollTo(0, y); }
    cada("[data-tipo-plano]", function (b) { b.addEventListener("click", function () { ler(); r.tipo = b.getAttribute("data-tipo-plano"); telaNovoPlano(); }); });
    cada("[data-minha]", function (b) { b.addEventListener("click", function () { var v = b.getAttribute("data-minha"); r.minha = r.minha === v ? "" : v; rede(); }); });
    cada("[data-adv]", function (b) { b.addEventListener("click", function () {
      var v = b.getAttribute("data-adv"), i = r.adv.indexOf(v);
      if (i >= 0) r.adv.splice(i, 1); else if (r.adv.length >= 3) { toast("No máximo 3: escolha o que mais aparece."); return; } else r.adv.push(v);
      rede();
    }); });
    cada("[data-cond]", function (b) { b.addEventListener("click", function () { var v = b.getAttribute("data-cond"), i = r.cond.indexOf(v); if (i >= 0) r.cond.splice(i, 1); else r.cond.push(v); rede(); }); });
    document.getElementById("btGerar").addEventListener("click", function () {
      ler();
      if (!r.minha) { toast("Escolha a sua principal solução."); return; }
      if (adv && !r.adv.length && !r.observei.trim()) { toast("Conte o que você observou no adversário."); return; }
      var p = montarPlano(r); est.planos.push(p); salvar(); rascunho = null;
      location.hash = "#/plano/" + p.id;
    });
  }
  /* situações para treinar antes do jogo: dos momentos ligados ao adversário (ou à solução principal), da fase do jogador, base primeiro */
  function fichasParaTreinar(r) {
    var ms = [];
    if (r.tipo === "adversario") r.adv.forEach(function (c) { (MOMENTO_DO_ADV[c] || []).forEach(function (m) { if (ms.indexOf(m) < 0) ms.push(m); }); });
    if (r.minha && ms.indexOf(r.minha) < 0) ms.push(r.minha);
    if (!ms.length) ms = ["F"];
    var out = [];
    ms.forEach(function (m) {
      FICHAS.filter(function (f) { return f.m === m && servePara(f, meuNivel()); }).sort(function (a, b) { return a.prio.localeCompare(b.prio); })
        .slice(0, 2).forEach(function (f) { if (out.length < 4 && out.indexOf(f.cod) < 0) out.push(f.cod); });
    });
    return out;
  }
  function montarPlano(r) {
    var treinar = fichasParaTreinar(r), f0 = POR_COD[treinar[0]], c0 = r.adv.length ? CTX[r.adv[0]] : null;
    var hipotese = r.seFizer.trim() && r.espero.trim() ? "Se eu fizer " + r.seFizer.trim().replace(/\.$/, "") + ", espero provocar " + r.espero.trim().replace(/\.$/, "") + "." : (sugestaoHipotese(r) || "Testar a minha solução principal nos primeiros games e observar a resposta.");
    var decidirSe = f0 ? frases(f0.decidir).filter(function (x) { return /^Se\b/.test(x); })[0] : "";
    var naoInsistir = c0 && frases(c0.dica)[1] ? frases(c0.dica)[1] : S.ESTADOS[0][1] + ": " + S.ESTADOS[0][2].toLowerCase() + ".";
    return {
      id: "p" + Date.now().toString(36), criadoEm: new Date().toISOString(), tipo: r.tipo, titulo: r.titulo.trim(), nivel: meuNivel(),
      minha: (NOME_MOMENTO[r.minha] || "") + (r.minhaTexto.trim() ? ": " + r.minhaTexto.trim() : ""),
      observei: r.adv.map(function (c) { return CTX[c].nome; }).concat(r.observei.trim() ? [r.observei.trim()] : []),
      hipotese: hipotese,
      sinais: [S.ESTADOS[2][0] + ": " + S.ESTADOS[2][1].toLowerCase() + "."].concat(f0 ? [f0.ler] : []),
      naoInsistir: naoInsistir,
      altB: r.altB.trim() || decidirSe || "Voltar à minha solução principal com mais margem e testar outra direção.",
      condicoes: r.cond.map(function (c) { return { nome: CTX[c].nome, dica: CTX[c].dica }; }),
      placar: CTX_PLACAR.map(function (c) { return { nome: CTX[c].nome, dica: frases(CTX[c].dica)[0] }; }),
      treinar: treinar, depois: { boa: "", discutivel: "", treinar: "", proximo: "" },
    };
  }
  function telaPlano(id) {
    var p = est.planos.filter(function (x) { return x.id === id; })[0]; if (!p) { location.hash = "#/plano"; return; }
    var item = function (t, corpo) { return '<div class="item"><p class="olho">' + esc(t) + "</p>" + corpo + "</div>"; };
    var ul = function (l) { return "<ul>" + l.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>"; };
    var h = '<p class="voltar"><a href="#/plano">‹ Planos de jogo</a></p><p class="olho">' + (p.tipo === "meu" ? "Plano do meu jogo" : "Plano contra um adversário") + "</p><h1>" + esc(p.titulo || "Plano de jogo") + "</h1>" +
      '<section class="cartao plano-doc" data-plano>' +
      item("Minha principal solução", "<p>" + esc(p.minha) + "</p>") +
      (p.observei.length ? item("O que observei no adversário", ul(p.observei)) : "") +
      item("Hipótese A", "<p><b>" + esc(p.hipotese) + "</b></p>") +
      item("Sinais que permitem executar", ul(p.sinais)) +
      item("Quando não insistir", "<p>" + esc(p.naoInsistir) + "</p>") +
      item("Alternativa B", "<p>" + esc(p.altB) + "</p>") +
      (p.condicoes.length ? item("Condições", ul(p.condicoes.map(function (c) { return c.nome + ": " + c.dica; }))) : "") +
      item("Momentos do placar", ul(p.placar.map(function (c) { return c.nome + ": " + c.dica; }))) +
      item("Na troca de lado", ul(["O que aconteceu?", "O que o adversário mudou?", "O que eu mantenho?", "O que eu ajusto?"])) +
      "</section>" +
      '<section class="cartao"><h2>Para treinar antes do jogo</h2><ul class="lista-fichas">' + p.treinar.map(function (c) { return itemFicha(POR_COD[c]); }).join("") + "</ul></section>" +
      '<section class="cartao nao-imprimir" data-depois><h2>Depois do jogo</h2>' +
      [["boa", "Uma boa decisão, mesmo com erro"], ["discutivel", "Um ponto ganho com escolha discutível"], ["treinar", "Uma situação que preciso treinar"], ["proximo", "O próximo teste em quadra"]].map(function (x) {
        return '<div class="campo"><label for="dp_' + x[0] + '">' + x[1] + '</label><textarea id="dp_' + x[0] + '" data-depois-campo="' + x[0] + '" maxlength="300">' + esc(p.depois[x[0]]) + "</textarea></div>";
      }).join("") + "</section>" +
      '<div class="acoes"><a class="bt bt-principal" id="lkWhats" target="_blank" rel="noopener noreferrer" href="https://wa.me/?text=' + encodeURIComponent(textoPlano(p)) + '">Mandar no WhatsApp</a><button type="button" class="bt" id="btImprimir">Imprimir ou salvar PDF</button><button type="button" class="bt bt-texto" id="btApagarPlano">Apagar plano</button></div>';
    tela(h);
    cada("[data-depois-campo]", function (t) { t.addEventListener("input", function () { p.depois[t.getAttribute("data-depois-campo")] = t.value.slice(0, 300); salvar(); }); });
    document.getElementById("btImprimir").addEventListener("click", function () { window.print(); });
    document.getElementById("btApagarPlano").addEventListener("click", function () {
      if (!confirm("Apagar este plano de jogo?")) return;
      est.planos = est.planos.filter(function (x) { return x.id !== id; }); salvar(); toast("Plano apagado."); location.hash = "#/plano";
    });
  }
  function textoPlano(p) {
    return ["Plano de jogo" + (p.titulo ? " · " + p.titulo : ""), "", "Minha solução: " + p.minha, "Hipótese A: " + p.hipotese, "Sinais: " + p.sinais.join(" "), "Quando não insistir: " + p.naoInsistir, "Alternativa B: " + p.altB, "", "QuadraLab Tática"].join("\n");
  }

  /* ══ Proposta comercial (só para ver como ficaria; nada é vendido aqui) ══ */
  function telaPlanosPreco() {
    var h = '<p class="voltar"><a href="#/">‹ Início</a></p><h1>Proposta de planos</h1><p class="sub">Protótipo: como o app poderia ser vendido. Sem preço e sem compra.</p><div class="planos-preco">' +
      '<section class="cartao"><p class="olho">Grátis</p><ul><li>Manual: Fundamentos e Saque (24 situações)</li><li>Como decidir: o método completo</li><li>Simulador: os cenários iniciais</li><li>1 plano de jogo salvo</li></ul></section>' +
      '<section class="cartao destaque"><p class="olho">Completo · plano anual</p><ul><li>As 96 situações nos 8 momentos do jogo</li><li>Simulador completo, com desafios e revisão</li><li>Planos de jogo sem limite, com o "depois do jogo"</li><li>Plano escrito pela IA com os jogos do QuadraLab Scout</li><li>Situação da semana e trilha pela sua fase</li></ul><p class="nota" style="margin:8px 0 0"><b>Preço a definir.</b></p></section>' +
      '</div><section class="cartao"><h2>Para treinadores (ideia)</h2><p style="margin:0">Mesmo conteúdo, com a parte do professor do manual: formatos de treino, observação por bloco, perguntas de feedback e ciclo de 8 aulas.</p></section>';
    tela(h);
  }

  /* ══ rotas ══ */
  function marcarAba(aba) { Array.prototype.forEach.call(document.querySelectorAll("#abas a"), function (a) { if (a.getAttribute("data-aba") === aba) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); }); }
  function rota() {
    var p = (location.hash || "#/").replace(/^#\/?/, "").split("/");
    if (p[0] === "manual" && p[1]) { marcarAba("manual"); telaMomento(p[1]); }
    else if (p[0] === "manual") { marcarAba("manual"); telaManual(); }
    else if (p[0] === "ficha" && p[1]) { marcarAba("manual"); telaFicha(p[1]); }
    else if (p[0] === "metodo") { marcarAba("manual"); telaMetodo(); }
    else if (p[0] === "simulador") { marcarAba("simulador"); telaSimulador(p[1]); }
    else if (p[0] === "plano" && p[1] === "novo") { marcarAba("plano"); telaNovoPlano(); }
    else if (p[0] === "plano" && p[1]) { marcarAba("plano"); telaPlano(p[1]); }
    else if (p[0] === "plano") { marcarAba("plano"); telaPlanos(); }
    else if (p[0] === "planos") { marcarAba(""); telaPlanosPreco(); }
    else { marcarAba("inicio"); telaInicio(); }
  }
  window.addEventListener("hashchange", rota);
  rota();
})();
