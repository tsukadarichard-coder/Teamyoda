/* Academia Digital Team Yoda (/digital/) — área restrita online.
   Conta própria (e-mail e senha no Firebase do Team Yoda); quem pode ver o conteúdo é decidido no servidor
   (netlify/functions/digital.js): equipe das unidades, aluno do Team Yoda · Cooper Tênis ou do 39 Ranch (grátis, ligado pelo link do
   aluno), assinante ou cortesia. Telas por âncora: #trilhas, #trilha/<id>, #aula/<trilha>/<aula>, #treinos, #treino/<código>,
   #simulador[/<tela>], #conta. Os vídeos são do YouTube (não listados), abertos só depois do toque, no modo de privacidade aprimorada.
   O link do aluno (?org=&id=&t=) chega pelo cartão do "Meu plano": fica guardado nesta aba até a conta entrar e é ligado sozinho. */
(function () {
  "use strict";
  var API = "/.netlify/functions/digital";
  var ORG_NOME = { "team-yoda": "Team Yoda · Cooper Tênis", "39-ranch": "39 Ranch Tennis Club" };
  var NIVEL = { iniciante: "Iniciante", intermediario: "Intermediário", avancado: "Avançado", todos: "Todos os níveis" };
  var FAM = {
    IP: "Início do ponto", RT: "Redução de tempo", CO: "Coordenação e base motora", AT: "Ataque e finalização", JA: "Jogo aplicado com regra",
    FB: "Fundamentos básicos", MV: "Movimentação", DT: "Drills táticos", PDB: "Power drills · base", PDR: "Power drills · rede", PDS: "Power drills · saque",
    DC: "Drills de consistência", CF: "Condicionamento físico", DM: "Drills mentais", ADV: "Drills avançados MTY", PT: "Padrões táticos",
    BR: "Brincadeiras", DP: "Duplas", TR: "Trilhos de decisão",
  };
  var ESTAGIO = { V: "Bola vermelha", L: "Bola laranja", G: "Bola verde", A: "Adulto", C: "Competição" };
  var CAMPOS = [["o", "Objetivo"], ["m", "Montagem"], ["g", "Carga"], ["r", "− Regressão"], ["p", "+ Progressão"], ["x", "Corrigir"], ["i", "Ignorar"]];
  var ACESSO = { equipe: "Equipe", unidade: "Aluno da unidade", assinante: "Assinante", cortesia: "Cortesia" };
  var CHAVE_LINK = "ty-digital-link";

  var app = document.getElementById("app"), abas = document.getElementById("abas"), selo = document.getElementById("selo"), anuncio = document.getElementById("anuncio");
  var auth = null;
  try { if (!firebase.apps.length) firebase.initializeApp(MTY_CONFIG); auth = firebase.auth(); } catch (e) { console.error("digital: Firebase", e); }

  var st = { usuario: null, dados: null, catalogo: null, carregandoCatalogo: null, modo: "criar", vitrinePublica: null, filtro: { q: "", f: "", quadra: false, n: 24 }, quadra: null };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function falar(t) { anuncio.textContent = ""; setTimeout(function () { anuncio.textContent = t; }, 30); }
  function msg(el, tipo, texto) { if (el) { el.className = "msg msg-" + tipo; el.textContent = texto; el.hidden = !texto; } }

  /* ── link do aluno: da URL (cartão do Meu plano) ou colado ── */
  function lerLink(txt) {
    var s = String(txt || "").trim(); if (!s) return null;
    var q = s.indexOf("?") >= 0 ? s.slice(s.indexOf("?") + 1).split("#")[0] : s;
    var p = new URLSearchParams(q), org = p.get("org"), id = p.get("id"), t = p.get("t");
    return org && id && t && ORG_NOME[org] ? { org: org, id: id, t: t } : null;
  }
  function guardarLink(l) { try { if (l) sessionStorage.setItem(CHAVE_LINK, JSON.stringify(l)); else sessionStorage.removeItem(CHAVE_LINK); } catch (e) { /* sem armazenamento */ } }
  function linkGuardado() { try { return JSON.parse(sessionStorage.getItem(CHAVE_LINK) || "null"); } catch (e) { return null; } }
  (function () {
    var l = lerLink(location.search);
    if (l) { guardarLink(l); try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) { /* ok */ } }
  })();

  /* ── servidor ── */
  function api(metodo, corpo, qs) {
    var tk = st.usuario ? st.usuario.getIdToken() : Promise.resolve("");
    return tk.then(function (t) {
      var h = { "content-type": "application/json" }; if (t) h.authorization = "Bearer " + t;
      return fetch(API + (qs ? "?" + qs : ""), { method: metodo, headers: h, body: corpo ? JSON.stringify(corpo) : undefined });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.erro || "Não foi possível agora. Tente de novo."); e.status = r.status; throw e; }
        return j;
      });
    });
  }
  function carregar() {
    return api("GET").then(function (d) {
      st.dados = d;
      var l = linkGuardado();
      if (l && d.acesso.tipo !== "equipe" && !(d.unidades || []).some(function (u) { return u.org === l.org && u.alunoId === l.id; })) {
        return api("POST", { acao: "vincular", link: { org: l.org, id: l.id, t: l.t } }).then(function () {
          guardarLink(null); st.avisoLigado = "Pronto: a sua conta foi ligada ao aluno de " + ORG_NOME[l.org] + ". O acesso é incluído na sua matrícula.";
          return api("GET").then(function (d2) { st.dados = d2; });
        }).catch(function (e) { guardarLink(null); st.avisoLigado = null; st.erroLigar = e.message; });
      }
      guardarLink(null);
    });
  }
  function catalogo() {
    if (st.catalogo) return Promise.resolve(st.catalogo);
    if (!st.carregandoCatalogo) st.carregandoCatalogo = api("GET", null, "catalogo=1").then(function (r) {
      st.catalogo = { lista: r.exercicios || [], porCodigo: {} };
      st.catalogo.lista.forEach(function (e) { st.catalogo.porCodigo[e.c] = e; });
      return st.catalogo;
    }).catch(function (e) { st.carregandoCatalogo = null; throw e; });
    return st.carregandoCatalogo;
  }

  /* ── telas ── */
  function tela(html, aba) {
    if (st.quadra) { try { st.quadra.parar(); } catch (e) { /* ok */ } st.quadra = null; }
    app.innerHTML = html;
    $$(".abas a").forEach(function (a) { var at = a.getAttribute("data-aba") === aba; a.classList.toggle("ativo", at); if (at) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    window.scrollTo(0, 0);
  }
  function rota() { return location.hash.replace(/^#\/?/, "").split("/"); }
  function render() {
    if (!st.usuario) return telaEntrada();
    var d = st.dados;
    if (!d) return;
    var liberado = d.acesso.tipo !== "nenhum";
    abas.hidden = !liberado;
    selo.hidden = !liberado; selo.textContent = liberado ? (ACESSO[d.acesso.tipo] || "") : "";
    if (!liberado) return telaSemAcesso();
    var r = rota();
    if (r[0] && r[0] !== "trilhas" && r[0] !== "inicio") st.avisoLigado = null;
    if (r[0] === "trilha" && r[1]) return telaTrilha(r[1]);
    if (r[0] === "aula" && r[1] && r[2]) return telaAula(r[1], r[2]);
    if (r[0] === "treinos") return telaTreinos();
    if (r[0] === "treino" && r[1]) return telaTreino(r[1]);
    if (r[0] === "simulador") return telaSimulador(r.slice(1).join("/"));
    if (r[0] === "conta") return telaConta();
    if (r[0] === "trilhas") return telaTrilhas();
    return telaInicio();
  }

  /* entrar / criar conta */
  var ERROS_AUTH = { "auth/invalid-credential": "E-mail ou senha não conferem.", "auth/wrong-password": "E-mail ou senha não conferem.", "auth/user-not-found": "E-mail ou senha não conferem.", "auth/invalid-email": "E-mail inválido.", "auth/too-many-requests": "Muitas tentativas. Espere alguns minutos e tente de novo.", "auth/network-request-failed": "Sem conexão. Confira a internet." };
  function telaEntrada() {
    abas.hidden = true; selo.hidden = true;
    var l = linkGuardado(), criar = st.modo === "criar";
    var vit = st.vitrinePublica, trilhasVit = vit && vit.trilhas && vit.trilhas.length ? vit.trilhas : null;
    tela(
      '<div class="entrada">' +
      '<section class="heroi"><h1>Treine com a Metodologia MTY de onde estiver</h1>' +
      '<p>A Academia Digital do Team Yoda reúne trilhas de aulas em vídeo, os treinos do nosso catálogo com a quadra animada e o simulador de decisões.</p>' +
      "<ul><li>Trilhas de aulas por nível, no seu ritmo</li><li>Treinos da Metodologia MTY com a quadra animada mostrando cada bola</li><li>Simulador de decisões: escolha a jogada e veja a resposta</li><li>Aluno do Team Yoda · Cooper Tênis ou do 39 Ranch não paga</li></ul>" +
      (trilhasVit ? '<p style="margin-top:14px"><b style="color:#fff">Trilhas disponíveis:</b> ' + trilhasVit.map(function (t) { return esc(t.titulo); }).join(" · ") + "</p>" : "") +
      "</section>" +
      '<section class="cartao" aria-labelledby="tEntrar">' +
      (l ? '<div class="faixa-unidade"><b>Aluno de ' + esc(ORG_NOME[l.org]) + ":</b> o acesso já está incluído na sua matrícula. " + (criar ? "Crie a sua conta" : "Entre") + " e ele é liberado na hora.</div>" : "") +
      '<div class="alternar" role="tablist"><button type="button" role="tab" id="mCriar" aria-selected="' + criar + '" class="' + (criar ? "ativo" : "") + '">Criar conta</button><button type="button" role="tab" id="mEntrar" aria-selected="' + !criar + '" class="' + (!criar ? "ativo" : "") + '">Já tenho conta</button></div>' +
      '<h2 id="tEntrar" class="sr">' + (criar ? "Criar conta" : "Entrar") + "</h2>" +
      '<form id="fEntrar" novalidate>' +
      (criar ? '<label class="campo">Seu nome<input name="nome" autocomplete="name" required maxlength="80"></label>' : "") +
      '<label class="campo">E-mail<input name="email" type="email" autocomplete="email" inputmode="email" required></label>' +
      '<label class="campo">Senha' + (criar ? " (pelo menos 8 caracteres)" : "") + '<input name="senha" type="password" autocomplete="' + (criar ? "new-password" : "current-password") + '" required minlength="' + (criar ? 8 : 1) + '"></label>' +
      '<p id="mEnt" class="msg" hidden></p>' +
      '<div class="acoes"><button class="btn" type="submit" id="btEnt">' + (criar ? "Criar conta e entrar" : "Entrar") + "</button>" + (!criar ? '<button class="btn btn-texto" type="button" id="btEsqueci">Esqueci a senha</button>' : "") + "</div>" +
      "</form>" +
      '<p class="det" style="margin-top:14px">Professor do Team Yoda ou do 39 Ranch? Entre com o mesmo e-mail e senha do app do treinador.</p>' +
      "</section></div>"
    );
    $("#mCriar").onclick = function () { st.modo = "criar"; telaEntrada(); };
    $("#mEntrar").onclick = function () { st.modo = "entrar"; telaEntrada(); };
    var f = $("#fEntrar"), m = $("#mEnt"), bt = $("#btEnt");
    f.onsubmit = function (ev) {
      ev.preventDefault();
      var nome = f.nome ? f.nome.value.trim() : "", email = f.email.value.trim(), senha = f.senha.value;
      if (criar && nome.length < 2) return msg(m, "erro", "Escreva o seu nome.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return msg(m, "erro", "Confira o e-mail.");
      if (criar && senha.length < 8) return msg(m, "erro", "A senha precisa ter pelo menos 8 caracteres.");
      if (!auth) return msg(m, "erro", "Não foi possível conectar agora. Recarregue a página.");
      bt.disabled = true; msg(m, "aviso", criar ? "Criando a sua conta…" : "Entrando…");
      var passo = criar ? api("POST", { acao: "criar", nome: nome, email: email, senha: senha }) : Promise.resolve();
      passo.then(function () { return auth.signInWithEmailAndPassword(email, senha); })
        .catch(function (e) {
          bt.disabled = false;
          if (e && e.status === 409) { st.modo = "entrar"; telaEntrada(); msg($("#mEnt"), "aviso", e.message); var c = $("#fEntrar").email; if (c) c.value = email; return; }
          msg(m, "erro", (e && ERROS_AUTH[e.code]) || (e && e.message) || "Não foi possível entrar.");
        });
    };
    var esq = $("#btEsqueci");
    if (esq) esq.onclick = function () {
      var email = f.email.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return msg(m, "erro", "Escreva o seu e-mail acima e toque de novo em Esqueci a senha.");
      auth.sendPasswordResetEmail(email).then(function () { msg(m, "ok", "Se houver uma conta com este e-mail, chega nele um link para criar uma nova senha."); })
        .catch(function (e) { msg(m, "erro", ERROS_AUTH[e.code] || "Não foi possível enviar agora."); });
    };
    if (!st.vitrinePublica) api("GET", null, "vitrine=1").then(function (v) { st.vitrinePublica = v; if (!st.usuario && v.trilhas && v.trilhas.length) telaEntrada(); }).catch(function () { st.vitrinePublica = {}; });
  }

  /* cartão para ligar o link do aluno (Conta e tela sem acesso) */
  function cartaoLigar() {
    return '<section class="cartao" aria-labelledby="tLigar"><h2 id="tLigar">Treina no Team Yoda · Cooper Tênis ou no 39 Ranch?</h2>' +
      '<p class="det" style="margin-top:0">Para você a Academia Digital é incluída na matrícula. Abra o link do aluno que o seu professor mandou (a página “Meu plano”) e toque em <b>Academia Digital</b>, ou cole o link aqui.</p>' +
      '<form id="fLigar" novalidate><label class="campo">Link do aluno<input name="link" inputmode="url" placeholder="https://…/aluno.html?org=…&id=…&t=…"></label>' +
      '<p id="mLigar" class="msg" hidden></p><div class="acoes"><button class="btn" type="submit">Ligar à minha conta</button></div></form></section>';
  }
  function ligarCartaoLigar() {
    var f = $("#fLigar"); if (!f) return;
    f.onsubmit = function (ev) {
      ev.preventDefault();
      var m = $("#mLigar"), l = lerLink(f.link.value);
      if (!l) return msg(m, "erro", "Este não parece um link do aluno do Team Yoda ou do 39 Ranch. Copie o link inteiro que o professor mandou.");
      msg(m, "aviso", "Conferindo o link…");
      api("POST", { acao: "vincular", link: { org: l.org, id: l.id, t: l.t } }).then(function () {
        st.avisoLigado = "Pronto: a sua conta foi ligada ao aluno de " + ORG_NOME[l.org] + ". O acesso é incluído na sua matrícula.";
        return carregar();
      }).then(function () { if (location.hash === "#inicio") render(); else location.hash = "#inicio"; }).catch(function (e) { msg(m, "erro", e.message); });
    };
  }

  function telaSemAcesso() {
    var d = st.dados, v = d.venda || {}, vit = (d.vitrine && d.vitrine.trilhas) || [];
    tela(
      '<h1>Olá, ' + esc(String(d.conta.nome || "").split(/\s+/)[0]) + "</h1>" +
      '<p class="lead">A sua conta está criada. Falta liberar o acesso ao conteúdo.</p>' +
      (st.erroLigar ? '<p class="msg msg-erro">' + esc(st.erroLigar) + "</p>" : "") +
      cartaoLigar() +
      '<section class="cartao" aria-labelledby="tAss"><h2 id="tAss">Não é aluno das unidades? Assine a Academia Digital</h2>' +
      (v.preco ? '<p class="preco">' + esc(v.preco) + "</p>" : "") +
      (v.observacao ? '<p class="texto-aula">' + esc(v.observacao) + "</p>" : "") +
      (v.checkoutUrl
        ? '<div class="acoes"><a class="btn btn-saibro" href="' + esc(v.checkoutUrl) + '" target="_blank" rel="noopener">Assinar</a></div><p class="det">Use no pagamento o mesmo e-mail desta conta (' + esc(d.conta.email) + "). Assim que o pagamento é confirmado, o acesso é liberado aqui.</p>"
        : '<p class="det">As assinaturas abrem em breve. Deixe o seu nome na lista e avisamos você primeiro.</p><div class="acoes"><button class="btn btn-claro" type="button" id="btAvise">Quero ser avisado</button></div><p id="mAvise" class="msg" hidden></p>') +
      "</section>" +
      (vit.length ? '<section aria-labelledby="tVit"><h2 id="tVit">O que você vai encontrar</h2><div class="grade">' + vit.map(function (t) {
        return '<div class="cartao trilha"><span class="nivel">' + esc(NIVEL[t.nivel] || "") + "</span><h3>" + esc(t.titulo) + '</h3><p class="det" style="margin:0">' + esc(resumo(t.descricao, 160)) + '</p><p class="det" style="margin:8px 0 0">' + t.aulas + (t.aulas === 1 ? " aula" : " aulas") + "</p></div>";
      }).join("") + "</div></section>" : "") +
      '<div class="acoes"><button class="btn btn-texto" type="button" id="btSair">Sair da conta (' + esc(d.conta.email) + ")</button></div>"
    );
    st.erroLigar = null;
    ligarCartaoLigar();
    var av = $("#btAvise");
    if (av) av.onclick = function () {
      av.disabled = true;
      api("POST", { acao: "interesse", email: d.conta.email, nome: d.conta.nome }).then(function () { msg($("#mAvise"), "ok", "Combinado: avisamos você em " + d.conta.email + " quando abrir."); })
        .catch(function (e) { av.disabled = false; msg($("#mAvise"), "erro", e.message); });
    };
    $("#btSair").onclick = sair;
  }

  function resumo(t, n) { t = String(t || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s\S*$/, "") + "…" : t; }
  function trilhaPorId(id) { return ((st.dados.conteudo || {}).trilhas || []).filter(function (t) { return t.id === id; })[0]; }
  function feitas(t) { var p = st.dados.progresso || {}; return t.aulas.filter(function (a) { return p[a.id]; }).length; }

  /* ── visual: capa da trilha (imagem do primeiro vídeo, ou a quadra desenhada), anel de progresso e a quadra do treino ── */
  var QUADRA_DECOR = '<svg class="capa-quadra" viewBox="0 0 160 90" aria-hidden="true" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.2"><rect x="18" y="14" width="124" height="62"/><line x1="18" y1="22" x2="142" y2="22"/><line x1="18" y1="68" x2="142" y2="68"/><line x1="49" y1="22" x2="49" y2="68"/><line x1="111" y1="22" x2="111" y2="68"/><line x1="49" y1="45" x2="111" y2="45"/><line x1="80" y1="10" x2="80" y2="80" stroke-dasharray="2 2"/></g><circle cx="118" cy="32" r="4" fill="#E4F542"/><path d="M40 60 Q80 18 118 32" fill="none" stroke="#F4FF8A" stroke-width="1.2" stroke-dasharray="3 3"/></svg>';
  function videoDaTrilha(t) { return (t.aulas.filter(function (a) { return a.youtube; })[0] || {}).youtube || ""; }
  function capa(yt, extra) {
    return '<div class="capa"' + (yt ? ' style="background-image:url(https://i.ytimg.com/vi/' + esc(yt) + '/mqdefault.jpg),linear-gradient(150deg,#2A5E43 0%,#3A7B56 60%,#69B32A 140%)"' : "") + ">" + (yt ? "" : QUADRA_DECOR) + (extra || "") + "</div>";
  }
  function anel(n, total, escuro) {
    var pc = total ? Math.round(n / total * 100) : 0, c = 2 * Math.PI * 18;
    return '<svg class="anel" viewBox="0 0 44 44" role="img" aria-label="' + n + " de " + total + ' aulas feitas"><circle cx="22" cy="22" r="18" fill="none" stroke="' + (escuro ? "rgba(255,255,255,.18)" : "#E6ECE9") + '" stroke-width="5"/>' +
      (n ? '<circle cx="22" cy="22" r="18" fill="none" stroke="#69B32A" stroke-width="5" stroke-linecap="round" stroke-dasharray="' + (c * pc / 100).toFixed(1) + " " + c.toFixed(1) + '" transform="rotate(-90 22 22)"/>' : "") +
      '<text x="22" y="26" text-anchor="middle" font-size="11" font-weight="800" fill="currentColor">' + pc + "%</text></svg>";
  }
  function quadraMini(c) { try { return window.QLQuadraExercicio.svgEstatico(c, "mini" + c.toLowerCase()); } catch (e) { return ""; } }
  function cartaoTrilha(t) {
    var n = feitas(t);
    return '<a class="cartao trilha com-capa" href="#trilha/' + encodeURIComponent(t.id) + '">' + capa(videoDaTrilha(t), '<span class="capa-nivel">' + esc(NIVEL[t.nivel] || "") + "</span>") +
      '<div class="trilha-corpo"><div class="trilha-tit"><h3>' + esc(t.titulo) + '</h3><p class="det" style="margin:0">' + t.aulas.length + (t.aulas.length === 1 ? " aula" : " aulas") + " · " + n + (n === 1 ? " feita" : " feitas") + "</p></div>" + anel(n, t.aulas.length) + "</div>" +
      (t.descricao ? '<p class="det" style="margin:8px 0 0">' + esc(resumo(t.descricao, 120)) + "</p>" : "") + "</a>";
  }
  function proximaAula() {
    var ts = (st.dados.conteudo || {}).trilhas || [], p = st.dados.progresso || {};
    for (var i = 0; i < ts.length; i++) for (var j = 0; j < ts[i].aulas.length; j++) if (!p[ts[i].aulas[j].id]) return { t: ts[i], a: ts[i].aulas[j], i: j };
    return null;
  }
  function diasAtivos() {
    var p = st.dados.progresso || {}, h = new Date(), lim = new Date(h.getFullYear(), h.getMonth(), h.getDate() - 6).toISOString().slice(0, 10), dias = {};
    Object.keys(p).forEach(function (k) { var d = String(p[k] || "").slice(0, 10); if (d && d >= lim) dias[d] = 1; });
    return Object.keys(dias).length;
  }

  function telaInicio() {
    var d = st.dados, ts = (d.conteudo || {}).trilhas || [], p = d.progresso || {};
    var total = 0, feitasTot = 0, emAndamento = 0;
    ts.forEach(function (t) { var n = feitas(t); total += t.aulas.length; feitasTot += n; if (n && n < t.aulas.length) emAndamento++; });
    var nome = String(d.conta.nome || "").split(/\s+/)[0] || "atleta";
    var sub = d.acesso.tipo === "unidade" ? "Incluída na sua matrícula · " + d.acesso.unidade : d.acesso.tipo === "equipe" ? "Equipe · " + d.acesso.unidade : d.acesso.tipo === "assinante" ? "Assinatura ativa" : "Acesso de cortesia";
    var px = proximaAula(), dias = diasAtivos();
    tela(
      (st.avisoLigado ? '<p class="msg msg-ok">' + esc(st.avisoLigado) + "</p>" : "") +
      '<section class="painel-heroi" aria-label="Seu avanço"><div class="ph-txt"><span class="ph-sobre">Academia Digital</span><h1>Olá, ' + esc(nome) + '</h1><p>' + esc(sub) + "</p></div>" +
        '<div class="ph-anel">' + anel(feitasTot, total, true) + "<span>do conteúdo</span></div></section>" +
      '<div class="numeros" role="list">' +
        '<div class="numero" role="listitem"><b>' + feitasTot + '<small>/' + total + "</small></b><span>aulas feitas</span></div>" +
        '<div class="numero" role="listitem"><b>' + dias + '<small>/7</small></b><span>dias ativos na semana</span></div>' +
        '<div class="numero" role="listitem"><b>' + emAndamento + '<small>/' + ts.length + "</small></b><span>trilhas em andamento</span></div></div>" +
      (px ? '<h2 class="secao">Continuar de onde parou</h2><a class="cartao continuar" href="#aula/' + encodeURIComponent(px.t.id) + "/" + encodeURIComponent(px.a.id) + '">' + capa(px.a.youtube || videoDaTrilha(px.t), '<span class="play" aria-hidden="true">▶</span>') +
          '<div class="cont-txt"><span class="det">' + esc(px.t.titulo) + " · aula " + (px.i + 1) + " de " + px.t.aulas.length + (px.a.duracao ? " · " + esc(px.a.duracao) : "") + "</span><h3>" + esc(px.a.titulo) + "</h3></div></a>"
        : ts.length ? '<div class="cartao vazio">Você fez todas as aulas publicadas. Novas aulas aparecem aqui assim que forem lançadas.</div>' : "") +
      '<h2 class="secao">Trilhas</h2>' +
      (ts.length ? '<div class="carrossel">' + ts.map(cartaoTrilha).join("") + "</div>"
        : '<div class="cartao vazio">As primeiras trilhas estão sendo gravadas. Enquanto isso, explore os treinos e o simulador.</div>') +
      '<div class="duas-col"><section aria-labelledby="tDia"><h2 class="secao" id="tDia">Treino do dia</h2><div id="treinoDia" class="cartao treino-dia"><p class="det">Escolhendo o treino de hoje…</p></div></section>' +
      '<section aria-labelledby="tSim"><h2 class="secao" id="tSim">Simulador de decisões</h2><a class="cartao sim-card" href="#simulador"><div class="sim-arte">' + QUADRA_DECOR + '</div><div><h3>Escolha a jogada</h3><p class="det" style="margin:0">Situações de ponto: alvo, altura e intensidade, e a resposta possível do adversário.</p></div></a></section></div>',
      "inicio"
    );
    st.avisoLigado = null;
    catalogo().then(function (c) {
      var el = $("#treinoDia"); if (!el) return;
      var com = c.lista.filter(function (e) { return temQuadra(e.c); });
      if (!com.length) { el.innerHTML = '<p class="det">Abra os <a href="#treinos">Treinos</a>.</p>'; return; }
      var h = new Date(), dia = Math.floor((h - new Date(h.getFullYear(), 0, 0)) / 864e5), e = com[(dia * 7) % com.length];
      el.outerHTML = '<a id="treinoDia" class="cartao treino-dia" href="#treino/' + encodeURIComponent(e.c) + '"><div class="ex-thumb">' + quadraMini(e.c) + '</div><span class="cod">' + esc(e.c) + " · " + esc(FAM[e.f] || e.f) + "</span><h3>" + esc(e.n) + '</h3><p class="det" style="margin:0">' + esc(resumo(e.o || e.m, 110)) + "</p></a>";
    }).catch(function () { var el = $("#treinoDia"); if (el) el.innerHTML = '<p class="det">Abra os <a href="#treinos">Treinos</a>.</p>'; });
  }

  function telaTrilhas() {
    var d = st.dados, ts = (d.conteudo || {}).trilhas || [];
    var boasVindas = d.acesso.tipo === "unidade" ? "Acesso incluído na sua matrícula · " + esc(d.acesso.unidade) : d.acesso.tipo === "equipe" ? "Acesso da equipe · " + esc(d.acesso.unidade) : d.acesso.tipo === "assinante" ? "Assinatura ativa" : "Acesso de cortesia";
    tela(
      (st.avisoLigado ? '<p class="msg msg-ok">' + esc(st.avisoLigado) + "</p>" : "") +
      "<h1>Trilhas</h1><p class=\"lead\">" + boasVindas + "</p>" +
      (ts.length ? '<div class="grade">' + ts.map(cartaoTrilha).join("") + "</div>"
        : '<div class="cartao vazio">As primeiras trilhas estão sendo gravadas. Enquanto isso, explore os <a href="#treinos">Treinos</a> e o <a href="#simulador">Simulador</a>.</div>'),
      "trilhas"
    );
  }
  function telaTrilha(id) {
    var t = trilhaPorId(decodeURIComponent(id));
    if (!t) return telaNaoAchou("Esta trilha não está mais disponível.", "#trilhas", "trilhas");
    var p = st.dados.progresso || {}, n = feitas(t);
    tela(
      '<a class="btn btn-texto voltar" href="#trilhas">← Trilhas</a>' +
      '<section class="trilha-heroi">' + capa(videoDaTrilha(t), '<span class="capa-nivel">' + esc(NIVEL[t.nivel] || "") + "</span>") +
        '<div class="th-txt"><div><h1>' + esc(t.titulo) + '</h1><p class="det" style="margin:0">' + n + " de " + t.aulas.length + " aulas feitas</p></div>" + anel(n, t.aulas.length) + "</div></section>" +
      (t.descricao ? '<p class="lead texto-aula">' + esc(t.descricao) + "</p>" : "") +
      '<div style="margin-top:14px">' + t.aulas.map(function (a, i) {
        return '<a class="aula-item' + (p[a.id] ? " feita" : "") + '" href="#aula/' + encodeURIComponent(t.id) + "/" + encodeURIComponent(a.id) + '"><span class="n" aria-hidden="true">' + (p[a.id] ? "✓" : i + 1) + '</span><span class="t"><b>' + esc(a.titulo) + "</b><small>" +
          [a.duracao, a.youtube ? "vídeo" : "", a.exercicios.length ? a.exercicios.length + (a.exercicios.length === 1 ? " treino" : " treinos") : "", p[a.id] ? "feita" : ""].filter(Boolean).map(esc).join(" · ") + "</small></span><span aria-hidden=\"true\">›</span></a>";
      }).join("") + "</div>",
      "trilhas"
    );
  }
  function telaAula(tid, aid) {
    var t = trilhaPorId(decodeURIComponent(tid)); aid = decodeURIComponent(aid);
    var i = t ? t.aulas.map(function (a) { return a.id; }).indexOf(aid) : -1;
    if (i < 0) return telaNaoAchou("Esta aula não está mais disponível.", "#trilhas", "trilhas");
    var a = t.aulas[i], prox = t.aulas[i + 1], feita = !!(st.dados.progresso || {})[a.id];
    tela(
      '<a class="btn btn-texto voltar" href="#trilha/' + encodeURIComponent(t.id) + '">← ' + esc(t.titulo) + "</a>" +
      '<p class="det" style="margin:0">Aula ' + (i + 1) + " de " + t.aulas.length + (a.duracao ? " · " + esc(a.duracao) : "") + "</p><h1>" + esc(a.titulo) + "</h1>" +
      (a.youtube ? '<div class="video" id="video"><button type="button" id="btVideo" style="background-image:url(https://i.ytimg.com/vi/' + esc(a.youtube) + '/hqdefault.jpg)" aria-label="Assistir ao vídeo: ' + esc(a.titulo) + '"><span>▶ Assistir</span></button></div>' : "") +
      (a.descricao ? '<div class="cartao" style="margin-top:14px"><p class="texto-aula" style="margin:0">' + esc(a.descricao) + "</p></div>" : "") +
      (a.exercicios.length ? '<section aria-labelledby="tEx" style="margin-top:14px"><h2 id="tEx">Treinos desta aula</h2><div id="exAula" class="grade"><p class="det">Carregando os treinos…</p></div></section>' : "") +
      '<div class="acoes"><button class="btn' + (feita ? " btn-claro" : "") + '" type="button" id="btFeita" aria-pressed="' + feita + '">' + (feita ? "✓ Feita · desmarcar" : "Marcar como feita") + "</button>" +
      (prox ? '<a class="btn btn-claro" href="#aula/' + encodeURIComponent(t.id) + "/" + encodeURIComponent(prox.id) + '">Próxima aula →</a>' : "") + "</div>",
      "trilhas"
    );
    var bv = $("#btVideo");
    if (bv) bv.onclick = function () {
      $("#video").innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(a.youtube) + '?autoplay=1&rel=0&playsinline=1&modestbranding=1" title="' + esc(a.titulo) + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
    };
    $("#btFeita").onclick = function () {
      var b = this; b.disabled = true;
      api("POST", { acao: "progresso", aulaId: a.id, feito: !feita }).then(function (r) {
        st.dados.progresso = r.progresso || {}; falar(!feita ? "Aula marcada como feita." : "Aula desmarcada.");
        if (!feita && prox) location.hash = "#aula/" + encodeURIComponent(t.id) + "/" + encodeURIComponent(prox.id); else telaAula(tid, aid);
      }).catch(function (e) { b.disabled = false; alert(e.message); });
    };
    if (a.exercicios.length) catalogo().then(function (c) {
      var el = $("#exAula"); if (!el) return;
      el.innerHTML = a.exercicios.map(function (cod) { var e = c.porCodigo[cod]; return e ? cartaoExercicio(e) : ""; }).join("") || '<p class="det">Os treinos desta aula não estão no catálogo.</p>';
    }).catch(function (e) { var el = $("#exAula"); if (el) el.innerHTML = '<p class="msg msg-erro">' + esc(e.message) + "</p>"; });
  }
  function temQuadra(c) { return !!(window.QLQuadraExercicio && window.QLQuadraExercicio.tem(c)); }
  function cartaoExercicio(e) {
    return '<a class="cartao ex" href="#treino/' + encodeURIComponent(e.c) + '">' + (temQuadra(e.c) ? '<div class="ex-thumb">' + quadraMini(e.c) + "</div>" : "") + '<span class="cod">' + esc(e.c) + " · " + esc(FAM[e.f] || e.f) + "</span><h3>" + esc(e.n) + '</h3><p class="det" style="margin:0">' + esc(resumo(e.o || e.m, 140)) + "</p>" +
      (temQuadra(e.c) ? '<span class="tag tag-quadra">▶ Quadra animada</span>' : "") + (e.e || []).map(function (s) { return '<span class="tag">' + esc(ESTAGIO[s] || s) + "</span>"; }).join("") + "</a>";
  }

  function telaTreinos() {
    tela('<h1>Treinos</h1><p class="lead">O catálogo da Metodologia MTY. Nos treinos com quadra animada, toque em Reproduzir para ver cada bola.</p><div id="treinos"><p class="carregando">Carregando o catálogo…</p></div>', "treinos");
    catalogo().then(function (c) {
      var el = $("#treinos"); if (!el) return;
      var fams = {}; c.lista.forEach(function (e) { fams[e.f] = 1; });
      el.innerHTML = '<div class="filtros"><label class="sr" for="fq">Buscar treino</label><input id="fq" type="search" placeholder="Buscar por nome, código ou objetivo" value="' + esc(st.filtro.q) + '">' +
        '<label class="sr" for="ff">Família</label><select id="ff"><option value="">Todas as famílias</option>' + Object.keys(fams).sort(function (a, b) { return (FAM[a] || a).localeCompare(FAM[b] || b); }).map(function (f) { return '<option value="' + esc(f) + '"' + (st.filtro.f === f ? " selected" : "") + ">" + esc(FAM[f] || f) + "</option>"; }).join("") + "</select>" +
        '<label class="chk"><input id="fqd" type="checkbox"' + (st.filtro.quadra ? " checked" : "") + "> Só com quadra animada</label></div><p id=\"fcont\" class=\"det\" aria-live=\"polite\"></p><div id=\"lista\" class=\"grade\"></div><div class=\"acoes\" id=\"mais\"></div>";
      function filtrar() {
        var q = st.filtro.q.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
        var res = c.lista.filter(function (e) {
          if (st.filtro.f && e.f !== st.filtro.f) return false;
          if (st.filtro.quadra && !temQuadra(e.c)) return false;
          return !q || (e.c + " " + e.n + " " + (e.o || "") + " " + (e.m || "")).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").indexOf(q) >= 0;
        });
        $("#fcont").textContent = res.length + (res.length === 1 ? " treino" : " treinos");
        $("#lista").innerHTML = res.slice(0, st.filtro.n).map(cartaoExercicio).join("") || '<p class="vazio">Nenhum treino com esse filtro.</p>';
        $("#mais").innerHTML = res.length > st.filtro.n ? '<button class="btn btn-claro" type="button" id="btMais">Mostrar mais</button>' : "";
        var bm = $("#btMais"); if (bm) bm.onclick = function () { st.filtro.n += 24; filtrar(); };
      }
      $("#fq").oninput = function () { st.filtro.q = this.value; st.filtro.n = 24; filtrar(); };
      $("#ff").onchange = function () { st.filtro.f = this.value; st.filtro.n = 24; filtrar(); };
      $("#fqd").onchange = function () { st.filtro.quadra = this.checked; st.filtro.n = 24; filtrar(); };
      filtrar();
    }).catch(function (e) { var el = $("#treinos"); if (el) el.innerHTML = '<p class="msg msg-erro">' + esc(e.message) + "</p>"; });
  }
  function telaTreino(cod) {
    cod = decodeURIComponent(cod);
    tela('<p class="carregando">Carregando…</p>', "treinos");
    catalogo().then(function (c) {
      var e = c.porCodigo[cod];
      if (!e) return telaNaoAchou("Este treino não está no catálogo.", "#treinos", "treinos");
      tela(
        '<button class="btn btn-texto voltar" type="button" id="btVoltar">← Voltar</button><span class="det" style="display:block;font-weight:700">' + esc(e.c) + " · " + esc(FAM[e.f] || e.f) + "</span><h1>" + esc(e.n) + "</h1>" +
        '<div>' + (e.e || []).map(function (s) { return '<span class="tag">' + esc(ESTAGIO[s] || s) + "</span>"; }).join("") + "</div>" +
        (temQuadra(e.c) ? '<div class="cartao" style="margin-top:12px"><div id="quadra" style="max-width:640px"></div></div>' : "") +
        '<div class="cartao" style="margin-top:12px"><dl class="ficha">' + CAMPOS.filter(function (k) { return e[k[0]]; }).map(function (k) { return "<dt>" + esc(k[1]) + '</dt><dd class="texto-aula">' + esc(e[k[0]]) + "</dd>"; }).join("") + "</dl></div>",
        "treinos"
      );
      $("#btVoltar").onclick = function () { if (history.length > 1) history.back(); else location.hash = "#treinos"; };
      var q = $("#quadra"); if (q) st.quadra = window.QLQuadraExercicio.montar(q, e.c, { resumo: e.o });
    }).catch(function (err) { tela('<p class="msg msg-erro">' + esc(err.message) + "</p>", "treinos"); });
  }

  /* simulador de decisões (o mesmo do QuadraLab Player e do Competição), dentro de um quadro; guarda a tela no endereço */
  var simAtual = "";
  function telaSimulador(sub) {
    if ($("#simQuadro") && sub === simAtual) return;
    simAtual = sub;
    tela('<h1 class="sr">Simulador de decisões</h1><div class="sim"><iframe id="simQuadro" title="Simulador de decisões" src="../decisoes/?embed=1' + (sub ? "#" + esc(sub) : "") + '"></iframe></div>', "simulador");
  }
  window.addEventListener("message", function (e) {
    var f = $("#simQuadro"), d = e.data;
    if (!f || e.source !== f.contentWindow || e.origin !== location.origin || !d || d.tipo !== "ql-sim-rota") return;
    simAtual = String(d.rota || "").replace(/^#/, "");
    var alvo = "#simulador" + (simAtual ? "/" + simAtual : "");
    if (location.hash !== alvo) try { history.replaceState(null, "", alvo); } catch (x) { /* ok */ }
  });

  function telaConta() {
    var d = st.dados, ac = d.acesso;
    var txtAcesso = ac.tipo === "equipe" ? "Equipe · " + ac.unidade : ac.tipo === "unidade" ? "Aluno de " + ac.unidade + " · incluído na matrícula" : ac.tipo === "assinante" ? "Assinatura ativa" + (ac.ate ? " até " + dataBR(ac.ate) : "") : "Cortesia" + (ac.ate ? " até " + dataBR(ac.ate) : "");
    tela(
      "<h1>Conta</h1>" +
      '<section class="cartao"><dl class="ficha"><dt>Nome</dt><dd>' + esc(d.conta.nome) + "</dd><dt>E-mail</dt><dd>" + esc(d.conta.email) + "</dd><dt>Acesso</dt><dd>" + esc(txtAcesso) + "</dd></dl>" +
      ((d.unidades || []).length ? '<h2 style="margin-top:16px">Alunos ligados</h2>' + d.unidades.map(function (u) { return '<div class="aula-item"><span class="t"><b>' + esc(u.unidade) + '</b><small>Acesso incluído na matrícula</small></span><button class="btn btn-texto" type="button" data-desv="' + esc(u.org) + "|" + esc(u.alunoId) + '">Desligar</button></div>'; }).join("") : "") +
      "</section>" +
      (ac.tipo !== "equipe" && ac.tipo !== "unidade" ? cartaoLigar() : "") +
      (d.coordenacao ? '<section class="cartao"><h2>Coordenação</h2><p class="det" style="margin-top:0">As trilhas, os vídeos, os treinos de cada aula, os membros e as cortesias ficam no app do treinador, em <b>Mais › Academia Digital</b>.</p><div class="acoes"><a class="btn btn-claro" href="/treinador">Abrir o app do treinador</a></div></section>' : "") +
      '<div class="acoes"><button class="btn btn-claro" type="button" id="btSair">Sair da conta</button></div>',
      "conta"
    );
    ligarCartaoLigar();
    $$("[data-desv]").forEach(function (b) {
      b.onclick = function () {
        var p = b.getAttribute("data-desv").split("|");
        if (!confirm("Desligar esta conta do aluno? O acesso incluído na matrícula deixa de valer para esta conta.")) return;
        api("POST", { acao: "desvincular", org: p[0], alunoId: p[1] }).then(carregar).then(render).catch(function (e) { alert(e.message); });
      };
    });
    $("#btSair").onclick = sair;
  }
  function dataBR(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ""); return m ? m[3] + "/" + m[2] + "/" + m[1] : iso; }
  function telaNaoAchou(t, href, aba) { tela('<div class="cartao vazio"><p>' + esc(t) + '</p><a class="btn btn-claro" href="' + href + '">Voltar</a></div>', aba); }
  function sair() { st.dados = null; st.catalogo = null; st.carregandoCatalogo = null; if (auth) auth.signOut(); }

  window.addEventListener("hashchange", function () { if (st.usuario && st.dados) render(); });
  if (!auth) { tela('<div class="cartao"><p class="msg msg-erro">Não foi possível conectar agora. Confira a internet e recarregue a página.</p></div>'); return; }
  auth.onAuthStateChanged(function (u) {
    st.usuario = u; st.dados = null;
    if (!u) return render();
    tela('<p class="carregando">Abrindo a Academia Digital…</p>');
    carregar().then(render).catch(function (e) {
      tela('<div class="cartao"><p class="msg msg-erro">' + esc(e.message) + '</p><div class="acoes"><button class="btn" type="button" id="btTentar">Tentar de novo</button><button class="btn btn-texto" type="button" id="btSair">Sair</button></div></div>');
      $("#btTentar").onclick = function () { location.reload(); }; $("#btSair").onclick = sair;
    });
  });
})();
