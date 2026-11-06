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
  var CATEG = { tecnica: "Técnica", tatica: "Tática", mental: "Mental", geral: "Geral" };
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
  function tela(html, aba, cine) {
    document.body.classList.add("modo-cine"); /* a Academia inteira no tema escuro (estilo streaming) */
    if (st.quadra) { try { st.quadra.parar(); } catch (e) { /* ok */ } st.quadra = null; }
    if (st.cronometro) { clearInterval(st.cronometro); st.cronometro = null; }
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
    if (r[0] === "sessao" && r[1]) return telaSessao(r[1]);
    if (r[0] === "simulador") return telaSimulador(r.slice(1).join("/"));
    if (r[0] === "analise") return telaAnalise();
    if (r[0] === "conta") return telaConta();
    if (r[0] === "trilhas") return telaTrilhas();
    if (r[0] === "certificado" && r[1]) return telaCertificado(r[1]);
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
      '<section class="heroi"><figure class="heroi-img"><img src="../assets/foto-saque.jpg" alt="Atleta do Team Yoda no movimento do saque" width="900" height="1200"></figure><h1>Treine com a Metodologia MTY de onde estiver</h1>' +
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
      '<h1>Olá, ' + esc(primeiroNome(d.conta.nome)) + "</h1>" +
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
  /* arte das aulas e dos cursos: a 1ª ilustração/foto da aula, ou a miniatura do vídeo */
  var IMG_OK = /^(assets\/(cursos\/[a-z0-9-]+\.svg|cursos\/fases\/[a-z0-9-]+\.jpg|foto-[a-z0-9-]+\.jpg)|img:[a-z0-9]{24})$/;
  /* "img:{id}" = sequência das fases enviada pela coordenação (servida pela function); o resto é arquivo do site */
  function urlImg(x) { return x.indexOf("img:") === 0 ? "/.netlify/functions/digital?img=" + x.slice(4) : "../" + x; }
  function capaCat(cat) { return "../assets/cursos/capa-" + ({ tecnica: 1, tatica: 1, mental: 1 }[cat] ? cat : "geral") + ".svg"; }
  /* miniatura: foto ou diagrama de quadra; cartões cheios de texto (mental, apoios, empunhaduras) ficam com a capa da categoria */
  var SO_TEXTO = /\/(men-|apoios|empunhaduras)/;
  function arteAula(a, cat) {
    var im = (a.imagens || []).filter(function (x) { return IMG_OK.test(x) && !(cat && SO_TEXTO.test(x)); })[0];
    return im ? urlImg(im) : a.youtube ? "https://i.ytimg.com/vi/" + a.youtube + "/hqdefault.jpg" : cat ? capaCat(cat) : "";
  }
  function enquadre(url, i) { return /\/capa-/.test(url) ? ' style="object-position:' + [50, 18, 82, 34, 66][i % 5] + '% 55%"' : ""; }
  /* capa do curso (sem texto por cima): a foto de uma aula, senão a miniatura de um vídeo, senão a capa da categoria */
  /* foto "limpa" (sem texto por cima) serve de capa; as montagens de sequência têm título e legendas, então não */
  var FOTO_LIMPA = /^assets\/foto-(?!sequencia|smash)[a-z0-9-]+\.jpg$/;
  function arteHeroi(a, t) {
    var f = (a.imagens || []).filter(function (x) { return FOTO_LIMPA.test(x); })[0];
    return f ? "../" + f : a.youtube ? "https://i.ytimg.com/vi/" + a.youtube + "/hqdefault.jpg" : arteCurso(t);
  }
  function arteCurso(t) {
    var fotos = [], yt = "";
    t.aulas.forEach(function (a) { (a.imagens || []).forEach(function (x) { if (FOTO_LIMPA.test(x)) fotos.push("../" + x); }); if (!yt && a.youtube) yt = "https://i.ytimg.com/vi/" + a.youtube + "/hqdefault.jpg"; });
    return fotos[0] || yt || capaCat(t.categoria);
  }
  function minutosAula(a) { var s = String(a.duracao || "").toLowerCase(), h = /(\d+)\s*h/.exec(s), mi = /(\d+)\s*min/.exec(s); return (h ? +h[1] * 60 : 0) + (mi ? +mi[1] : 0); }
  function minutosCurso(t) { return t.aulas.reduce(function (n, a) { return n + minutosAula(a); }, 0); }
  function videoDaTrilha(t) { return (t.aulas.filter(function (a) { return a.youtube; })[0] || {}).youtube || ""; }
  function capa(yt, extra, cat, arte) {
    var fundo = yt ? "https://i.ytimg.com/vi/" + yt + "/mqdefault.jpg" : arte || "";
    return '<div class="capa' + (cat ? " cat-" + cat : "") + (fundo && !yt ? " com-arte" : "") + '"' + (fundo ? ' style="background-image:url(' + esc(fundo) + '),linear-gradient(150deg,#2A5E43 0%,#3A7B56 60%,#69B32A 140%)"' : "") + ">" + (fundo ? "" : QUADRA_DECOR) + (extra || "") + "</div>";
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
    return '<a class="cartao trilha com-capa" href="#trilha/' + encodeURIComponent(t.id) + '">' + capa(videoDaTrilha(t), '<span class="capa-nivel">' + esc(rotuloCurso(t)) + "</span>" + (concluido(t) ? '<span class="capa-ok">✓ Concluído</span>' : ""), t.categoria, arteCurso(t)) +
      '<div class="trilha-corpo"><div class="trilha-tit"><h3>' + esc(t.titulo) + '</h3><p class="det" style="margin:0">' + t.aulas.length + (t.aulas.length === 1 ? " aula" : " aulas") + " · " + n + (n === 1 ? " feita" : " feitas") + "</p></div>" + anel(n, t.aulas.length) + "</div>" +
      (t.descricao ? '<p class="det" style="margin:8px 0 0">' + esc(resumo(t.descricao, 120)) + "</p>" : "") + "</a>";
  }
  function rotuloCurso(t) { return [CATEG[t.categoria] && t.categoria !== "geral" ? CATEG[t.categoria] : "", NIVEL[t.nivel] || ""].filter(Boolean).join(" · "); }
  function quizOk(a) { var q = (st.dados.quiz || {})[a.id]; return !(a.quiz || []).length || !!(q && q.acertos === q.total && q.total > 0); }
  function concluido(t) { var p = st.dados.progresso || {}; return t.aulas.length > 0 && t.aulas.every(function (a) { return p[a.id] && quizOk(a); }); }
  function proximaAula() {
    var ts = (st.dados.conteudo || {}).trilhas || [], p = st.dados.progresso || {};
    for (var i = 0; i < ts.length; i++) for (var j = 0; j < ts[i].aulas.length; j++) if (!p[ts[i].aulas[j].id]) return { t: ts[i], a: ts[i].aulas[j], i: j };
    return null;
  }
  /* dias seguidos com aula feita (termina hoje ou ontem) e minutos das aulas feitas nos últimos 7 dias (pela duração da aula) */
  function diaISO(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function diasComAula() { var p = st.dados.progresso || {}, m = {}; Object.keys(p).forEach(function (k) { if (p[k]) m[diaISO(new Date(p[k]))] = 1; }); (st.dados.sessoes || []).forEach(function (x) { m[diaISO(new Date(x.em))] = 1; }); return m; }
  function sequencia() {
    var m = diasComAula(), d = new Date(), n = 0;
    if (!m[diaISO(d)]) d.setDate(d.getDate() - 1);
    while (m[diaISO(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function minutosSemana() {
    var p = st.dados.progresso || {}, lim = Date.now() - 7 * 864e5, tot = 0;
    ((st.dados.conteudo || {}).trilhas || []).forEach(function (t) { t.aulas.forEach(function (a) {
      if (!p[a.id] || new Date(p[a.id]).getTime() < lim) return;
      var s = String(a.duracao || "").toLowerCase(), h = /(\d+)\s*h/.exec(s), mi = /(\d+)\s*min/.exec(s);
      tot += (h ? +h[1] * 60 : 0) + (mi ? +mi[1] : 0);
    }); });
    (st.dados.sessoes || []).forEach(function (x) { if (new Date(x.em).getTime() >= lim) tot += x.minutos || 0; });
    return tot;
  }
  var SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  function quandoAula(iso) { var d = new Date(iso); if (isNaN(d)) return ""; return SEMANA[d.getDay()] + " " + String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + " às " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
  function cartaoPresencial() {
    var pr = st.dados.presencial; if (!pr) return "";
    if (!pr.temPlano) return '<section class="cartao presencial" aria-labelledby="tPres"><h2 id="tPres" class="secao" style="margin:0 0 4px">Suas aulas na quadra</h2><p class="det" style="margin:0">' + (pr.proximaAula ? "Próxima aula: <b>" + esc(quandoAula(pr.proximaAula)) + "</b>. " : "") + "Quando o seu professor aprovar o plano do ciclo, o avanço aparece aqui.</p></section>";
    return '<section class="cartao presencial" aria-labelledby="tPres"><div class="pres-cab"><div><span class="ph-sobre" style="color:var(--saibro-esc)">' + esc(st.dados.acesso.unidade || "Na quadra") + '</span><h2 id="tPres" style="margin:2px 0 0">Suas aulas na quadra</h2><p class="det" style="margin:2px 0 0">' + esc(pr.tipoPlano || "Plano do ciclo") + (pr.turma ? " · turma " + esc(pr.turma) : "") + "</p></div>" + anel(pr.aulasFeitas, pr.totalAulas) + "</div>" +
      '<div class="pres-linhas"><div><span class="det">Aulas do ciclo</span><b>' + pr.aulasFeitas + " de " + pr.totalAulas + "</b></div>" + (pr.proximaAula ? "<div><span class=\"det\">Próxima aula</span><b>" + esc(quandoAula(pr.proximaAula)) + "</b></div>" : "") + (pr.agora ? "<div><span class=\"det\">Agora no plano</span><b>" + esc(pr.agora) + "</b></div>" : "") + "</div></section>";
  }
  function diasAtivos() {
    var h = new Date(), lim = diaISO(new Date(h.getFullYear(), h.getMonth(), h.getDate() - 6));
    return Object.keys(diasComAula()).filter(function (d) { return d >= lim; }).length;
  }

  /* "Ana Souza" → "Ana"; conta sem nome (só o e-mail, ex.: "joao.silva") → "Joao" */
  function primeiroNome(n) {
    var s = String(n || "").trim(), p = /\s/.test(s) ? s.split(/\s+/)[0] : s.split(/[._\-@\d]+/).filter(Boolean)[0] || "";
    return p ? p.charAt(0).toUpperCase() + p.slice(1) : "atleta";
  }
  function telaInicio() {
    var d = st.dados, ts = (d.conteudo || {}).trilhas || [], p = d.progresso || {};
    var total = 0, feitasTot = 0;
    ts.forEach(function (t) { total += t.aulas.length; feitasTot += feitas(t); });
    var nome = primeiroNome(d.conta.nome);
    var sub = d.acesso.tipo === "unidade" ? "Incluída na sua matrícula · " + d.acesso.unidade : d.acesso.tipo === "equipe" ? "Equipe · " + d.acesso.unidade : d.acesso.tipo === "assinante" ? "Assinatura ativa" : "Acesso de cortesia";
    var px = proximaAula(), dias = diasAtivos();
    var tsCom = ts.filter(function (t) { return t.aulas.length; });
    var continuar = tsCom.filter(function (t) { return feitas(t) && proximaDoCurso(t) >= 0; }).map(function (t) { var i = proximaDoCurso(t); return episodio(t, t.aulas[i], i, true); });
    var arteH = px ? arteHeroi(px.a, px.t) : tsCom[0] ? arteCurso(tsCom[0]) : capaCat("geral");
    var pcTot = total ? Math.round(feitasTot / total * 100) : 0;
    tela(
      '<div class="cine">' + (st.avisoLigado ? '<p class="msg msg-ok">' + esc(st.avisoLigado) + "</p>" : "") +
      /* destaque: a próxima aula em tela cheia, com a saudação e o avanço */
      '<section class="cine-heroi inicio-heroi" aria-label="Seu avanço">' + arteImg(arteH, "cine-fundo") + '<div class="cine-veu"></div>' +
        '<div class="cine-info"><span class="cine-marca"><b>MTY</b> Olá, ' + esc(nome) + "</span>" +
        '<p class="inicio-sub">' + esc(sub) + "</p>" +
        (px ? "<h2>" + esc(px.a.titulo) + "</h2>" +
            '<p class="cine-meta"><b class="cine-tag' + (feitas(px.t) ? "" : " novo") + '">' + (feitas(px.t) ? "Continuar" : "Comece aqui") + "</b><span>" + esc(px.t.titulo) + " · aula " + (px.i + 1) + " de " + px.t.aulas.length + (px.a.duracao ? " · " + esc(px.a.duracao) : "") + "</span></p>" +
            '<div class="cine-acoes"><a class="cine-btn primario" href="' + hrefAula(px.t, px.a) + '">▶ ' + (feitas(px.t) ? "Continuar" : "Começar") + '</a><a class="cine-btn" href="#trilhas">Cursos</a></div>'
          : ts.length ? "<h2>Você fez todas as aulas publicadas</h2><p class=\"cine-desc\">Novas aulas aparecem aqui assim que forem lançadas.</p><div class=\"cine-acoes\"><a class=\"cine-btn primario\" href=\"#trilhas\">Rever os cursos</a></div>"
          : "<h2>Os primeiros cursos estão chegando</h2><div class=\"cine-acoes\"><a class=\"cine-btn primario\" href=\"#treinos\">Ver os treinos</a></div>") +
        '<div class="cine-anel">' + anel(feitasTot, total, true) + "<span>" + pcTot + "% do conteúdo · " + feitasTot + " de " + total + " aulas</span></div>" +
      "</div></section>" +
      '<div class="numeros" role="list">' +
        '<div class="numero" role="listitem"><b>' + feitasTot + '<small>/' + total + "</small></b><span>aulas feitas</span></div>" +
        '<div class="numero" role="listitem"><b>' + minutosSemana() + '<small> min</small></b><span>na semana</span></div>' +
        '<div class="numero" role="listitem"><b>' + sequencia() + '<small>' + (sequencia() === 1 ? " dia" : " dias") + "</small></b><span>seguidos</span></div>" +
        '<div class="numero" role="listitem"><b>' + dias + '<small>/7</small></b><span>dias ativos</span></div></div>' +
      cartaoPresencial() +
      fileira("Continue de onde parou", continuar, "eps") +
      (ultimaAnaliseComCorrecao() ? '<section class="cine-linha"><div class="cine-linha-cab"><h2>Seu treino de correção</h2></div>' + cartaoCorrecao(ultimaAnaliseComCorrecao()) + "</section>" : "") +
      (tsCom.length ? fileira("Cursos", tsCom.map(poster), "posters", "#trilhas")
        : '<div class="cine-vazio">Os primeiros cursos de técnica, tática e mental estão sendo preparados. Enquanto isso, explore os treinos e o simulador.</div>') +
      '<section class="cine-linha"><div class="cine-linha-cab"><h2>Para treinar hoje</h2></div><div class="duas-col hoje-grade">' +
      '<section aria-labelledby="tDia"><h3 class="hoje-tit" id="tDia">Treino do dia</h3><div id="treinoDia" class="cartao treino-dia"><p class="det">Escolhendo o treino de hoje…</p></div></section>' +
      '<section aria-labelledby="tMov"><h3 class="hoje-tit" id="tMov">Análise de movimento</h3><a class="cartao sim-card" href="#analise"><div class="sim-arte mov-arte" aria-hidden="true"><img src="../assets/foto-sequencia-backhand2-ty.jpg" alt="" loading="lazy"></div><div><h3>Filme um golpe</h3><p class="det" style="margin:0">Checklist por fase, vídeo e boneco lado a lado e o que treinar.</p></div></a></section>' +
      '<section aria-labelledby="tSim"><h3 class="hoje-tit" id="tSim">Simulador de decisões</h3><a class="cartao sim-card" href="#simulador"><div class="sim-arte" aria-hidden="true"><img src="../assets/cursos/capa-tatica.svg" alt="" loading="lazy"></div><div><h3>Escolha a jogada</h3><p class="det" style="margin:0">Situações de ponto: alvo, altura e intensidade, e a resposta possível do adversário.</p></div></a></section></div></section></div>',
      "inicio", true
    );
    ligarSetas();
    st.avisoLigado = null;
    catalogo().then(function (c) {
      var el = $("#treinoDia"); if (!el) return;
      var com = c.lista.filter(function (e) { return temQuadra(e.c); });
      if (!com.length) { el.innerHTML = '<p class="det">Abra os <a href="#treinos">Treinos</a>.</p>'; return; }
      var h = new Date(), dia = Math.floor((h - new Date(h.getFullYear(), 0, 0)) / 864e5), e = com[(dia * 7) % com.length];
      el.outerHTML = '<a id="treinoDia" class="cartao treino-dia" href="#treino/' + encodeURIComponent(e.c) + '"><div class="ex-thumb">' + quadraMini(e.c) + '</div><span class="cod">' + esc(e.c) + " · " + esc(FAM[e.f] || e.f) + "</span><h3>" + esc(e.n) + '</h3><p class="det" style="margin:0">' + esc(resumo(e.o || e.m, 110)) + "</p></a>";
    }).catch(function () { var el = $("#treinoDia"); if (el) el.innerHTML = '<p class="det">Abra os <a href="#treinos">Treinos</a>.</p>'; });
  }

  /* ── Cursos no estilo streaming: destaque no topo, fileiras que rolam na horizontal, pôsteres e episódios ── */
  function proximaDoCurso(t) { var p = st.dados.progresso || {}; for (var i = 0; i < t.aulas.length; i++) if (!p[t.aulas[i].id]) return i; return -1; }
  function hrefAula(t, a) { return "#aula/" + encodeURIComponent(t.id) + "/" + encodeURIComponent(a.id); }
  function metaCurso(t) {
    var m = minutosCurso(t);
    return [t.aulas.length + (t.aulas.length === 1 ? " aula" : " aulas"), m ? (m >= 60 ? Math.floor(m / 60) + " h " + (m % 60 ? m % 60 + " min" : "") : m + " min").trim() : "", NIVEL[t.nivel] || ""].filter(Boolean).join(" · ");
  }
  function arteImg(url, cls, i) { return url ? '<img class="' + cls + '" src="' + esc(url) + '" alt="" loading="lazy" decoding="async"' + (i != null ? enquadre(url, i) : "") + ">" : '<span class="' + cls + ' sem-arte">' + QUADRA_DECOR + "</span>"; }
  function heroiCine(t, opc) {
    opc = opc || {};
    var n = feitas(t), i = proximaDoCurso(t), a = t.aulas[i >= 0 ? i : 0], pc = t.aulas.length ? Math.round(n / t.aulas.length * 100) : 0;
    var rotBtn = !t.aulas.length ? "" : i < 0 ? "▶ Rever do começo" : n ? "▶ Continuar · aula " + (i + 1) : "▶ Começar";
    var H = opc.h1 ? "h1" : "h2";
    return '<section class="cine-heroi' + (opc.classe ? " " + opc.classe : "") + ' cat-' + esc(t.categoria || "geral") + '">' + arteImg(arteCurso(t), "cine-fundo") + '<div class="cine-veu"></div>' +
      '<div class="cine-info"><span class="cine-marca"><b>MTY</b> ' + esc(CATEG[t.categoria] && t.categoria !== "geral" ? "Curso de " + CATEG[t.categoria] : "Curso") + "</span>" +
      "<" + H + ">" + esc(t.titulo) + "</" + H + ">" +
      '<p class="cine-meta">' + (concluido(t) ? '<b class="cine-tag ok">Concluído</b>' : n ? '<b class="cine-tag">' + pc + "% feito</b>" : '<b class="cine-tag novo">Novo</b>') + "<span>" + esc(metaCurso(t)) + "</span></p>" +
      (t.descricao ? '<p class="cine-desc">' + esc(resumo(t.descricao, opc.h1 ? 260 : 170)) + "</p>" : "") +
      '<div class="cine-acoes">' + (a ? '<a class="cine-btn primario" href="' + hrefAula(t, a) + '">' + rotBtn + "</a>" : "") +
      (opc.h1 ? (concluido(t) ? '<a class="cine-btn" href="#certificado/' + encodeURIComponent(t.id) + '">🏅 Certificado</a>' : "") : '<a class="cine-btn" href="#trilha/' + encodeURIComponent(t.id) + '">ⓘ Detalhes</a>') + "</div>" +
      (opc.anel ? '<div class="cine-anel">' + anel(n, t.aulas.length, true) + "<span>" + n + " de " + t.aulas.length + " aulas feitas</span></div>" : "") +
      (n ? '<div class="cine-prog" aria-hidden="true"><i style="width:' + pc + '%"></i></div>' : "") + "</div></section>";
  }
  function episodio(t, a, i, comCurso) {
    var p = st.dados.progresso || {}, ok = p[a.id] && quizOk(a);
    return '<a class="ep' + (ok ? " feita" : "") + '" href="' + hrefAula(t, a) + '"><div class="ep-arte">' + arteImg(arteAula(a, t.categoria || "geral"), "ep-img", i) +
      '<span class="ep-n">' + (i + 1) + "</span>" + (a.duracao ? '<span class="ep-dur">' + esc(a.duracao) + "</span>" : "") +
      (ok ? '<span class="ep-ok" aria-label="feita">✓</span>' : "") + '<span class="ep-play" aria-hidden="true">▶</span>' + (p[a.id] ? '<span class="ep-barra"><i></i></span>' : "") +
      '</div><b class="ep-tit">' + esc(a.titulo) + "</b>" + (comCurso ? '<small class="ep-sub">' + esc(t.titulo) + "</small>" : "") + "</a>";
  }
  function poster(t) {
    var n = feitas(t), pc = t.aulas.length ? Math.round(n / t.aulas.length * 100) : 0;
    return '<a class="poster trilha cat-' + esc(t.categoria || "geral") + '" href="#trilha/' + encodeURIComponent(t.id) + '">' + arteImg(arteCurso(t), "poster-img") + '<span class="poster-veu"></span>' +
      '<span class="poster-cat">' + esc(CATEG[t.categoria] || "Curso") + "</span>" + (concluido(t) ? '<span class="poster-ok">✓</span>' : "") +
      '<span class="poster-txt"><b>' + esc(t.titulo) + "</b><small>" + esc(metaCurso(t)) + "</small></span>" + (n ? '<span class="poster-prog"><i style="width:' + pc + '%"></i></span>' : "") + "</a>";
  }
  function fileira(titulo, itens, classe, link) {
    if (!itens.length) return "";
    return '<section class="cine-linha"><div class="cine-linha-cab"><h2>' + (link ? '<a href="' + link + '">' + esc(titulo) + ' <span aria-hidden="true">›</span></a>' : esc(titulo)) + "</h2>" +
      '<div class="cine-setas"><button type="button" class="cine-seta" data-dir="-1" aria-label="Voltar">‹</button><button type="button" class="cine-seta" data-dir="1" aria-label="Avançar">›</button></div></div>' +
      '<div class="cine-trilho ' + (classe || "") + '">' + itens.join("") + "</div></section>";
  }
  function ligarSetas() {
    $$(".cine-linha").forEach(function (l) {
      var tr = l.querySelector(".cine-trilho");
      $$(".cine-seta", l).forEach(function (b) { b.onclick = function () { tr.scrollBy({ left: +b.getAttribute("data-dir") * tr.clientWidth * 0.85, behavior: "smooth" }); }; });
    });
  }
  function telaTrilhas() {
    var d = st.dados, ts = (d.conteudo || {}).trilhas || [], f = st.filtroCurso || "";
    var cats = ["tecnica", "tatica", "mental", "geral"].filter(function (c) { return ts.some(function (t) { return (t.categoria || "geral") === c; }); });
    var lista = ts.filter(function (t) { return !f || (t.categoria || "geral") === f; });
    /* destaque: o curso em andamento; senão o primeiro ainda não começado */
    var dest = lista.filter(function (t) { return feitas(t) && !concluido(t); })[0] || lista.filter(function (t) { return !feitas(t); })[0] || lista[0];
    var continuar = lista.filter(function (t) { return feitas(t) && proximaDoCurso(t) >= 0; }).map(function (t) { var i = proximaDoCurso(t); return episodio(t, t.aulas[i], i, true); });
    tela(
      '<div class="cine">' + (st.avisoLigado ? '<p class="msg msg-ok">' + esc(st.avisoLigado) + "</p>" : "") +
      '<div class="cine-topo"><h1 class="cine-pagina">Cursos</h1>' +
      (cats.length > 1 ? '<div class="chips cine-chips" role="group" aria-label="Filtrar cursos"><button type="button" data-cat="" class="chip' + (!f ? " ativo" : "") + '" aria-pressed="' + !f + '">Todos</button>' + cats.map(function (c) { return '<button type="button" data-cat="' + c + '" class="chip' + (f === c ? " ativo" : "") + '" aria-pressed="' + (f === c) + '">' + esc(CATEG[c]) + "</button>"; }).join("") + "</div>" : "") + "</div>" +
      (lista.length ? heroiCine(dest) +
        fileira("Continue de onde parou", continuar, "eps") +
        fileira(f ? "Cursos de " + CATEG[f] : "Todos os cursos", lista.map(poster), "posters") +
        lista.map(function (t) { return fileira(t.titulo, t.aulas.map(function (a, i) { return episodio(t, a, i); }), "eps", "#trilha/" + encodeURIComponent(t.id)); }).join("")
        : '<div class="cine-vazio">Os primeiros cursos estão sendo preparados. Enquanto isso, explore os <a href="#treinos">Treinos</a> e o <a href="#simulador">Simulador</a>.</div>') + "</div>",
      "trilhas", true
    );
    $$("[data-cat]").forEach(function (b) { b.onclick = function () { st.filtroCurso = b.getAttribute("data-cat"); telaTrilhas(); }; });
    ligarSetas();
  }
  function telaTrilha(id) {
    var t = trilhaPorId(decodeURIComponent(id));
    if (!t) return telaNaoAchou("Esta trilha não está mais disponível.", "#trilhas", "trilhas");
    var p = st.dados.progresso || {};
    tela(
      '<div class="cine"><a class="cine-voltar voltar" href="#trilhas">← Cursos</a>' + heroiCine(t, { h1: true, anel: true, classe: "trilha-heroi" }) +
      (concluido(t) ? '<div class="cine-concluido concluido"><div><b>Curso concluído</b><p>Todas as aulas feitas e todos os quizzes certos.</p></div><a class="cine-btn primario" href="#certificado/' + encodeURIComponent(t.id) + '">Ver certificado</a></div>' : "") +
      '<section class="cine-eps" aria-labelledby="tEps"><h2 id="tEps">Aulas</h2>' + t.aulas.map(function (a, i) {
        var ok = p[a.id] && quizOk(a);
        return '<a class="aula-item ep-linha' + (ok ? " feita" : "") + '" href="' + hrefAula(t, a) + '"><span class="ep-linha-n" aria-hidden="true">' + (i + 1) + '</span><span class="ep-arte">' + arteImg(arteAula(a, t.categoria || "geral"), "ep-img", i) + '<span class="ep-play" aria-hidden="true">▶</span>' + (ok ? '<span class="ep-ok">✓</span>' : "") + "</span>" +
          '<span class="t"><b>' + esc(a.titulo) + "</b><small>" + [a.duracao, a.youtube ? "vídeo" : "", a.exercicios.length ? a.exercicios.length + (a.exercicios.length === 1 ? " treino" : " treinos") : "", (a.quiz || []).length ? (quizOk(a) ? "quiz certo" : "quiz") : "", p[a.id] ? "feita" : ""].filter(Boolean).map(esc).join(" · ") + "</small>" +
          (a.descricao ? '<span class="ep-desc">' + esc(resumo(a.descricao, 140)) + "</span>" : "") + "</span></a>";
      }).join("") + "</section>" +
      (t.descricao && t.descricao.length > 260 ? '<details class="cine-sobre"><summary>Sobre o curso</summary><p class="texto-aula">' + esc(t.descricao) + "</p></details>" : "") + "</div>",
      "trilhas", true
    );
  }
  /* ilustrações da aula (mty/assets/cursos e fotos), acima do texto; tocar abre a imagem inteira */
  function ilustracoes(a) {
    var im = (a.imagens || []).filter(function (x) { return IMG_OK.test(x); });
    if (!im.length) return "";
    return '<div class="ilustracoes' + (im.length > 1 ? " duas" : "") + '">' + im.map(function (x, k) {
      return '<a class="ilustracao" href="' + esc(urlImg(x)) + '" target="_blank" rel="noopener"><img src="' + esc(urlImg(x)) + '" alt="Ilustração ' + (k + 1) + " da aula " + esc(a.titulo) + '" loading="lazy" decoding="async"></a>';
    }).join("") + "</div>";
  }
  /* ── aula passo a passo: uma etapa por tela (imagem, explicação, o que conferir, erro comum) e um resumo no fim ── */
  function etapasDe(a) { return (a.etapas || []).filter(function (e) { return e && e.titulo; }); }
  function n2(k) { return (k < 9 ? "0" : "") + (k + 1); }
  function figuraEtapa(e, k, a) {
    if (e.img && IMG_OK.test(e.img)) {
      var u = esc(urlImg(e.img)), retrato = /\/fases\/|foto-sequencia/.test(e.img);
      return '<figure class="etapa-fig' + (retrato ? " retrato" : " diagrama") + '"><a href="' + u + '" target="_blank" rel="noopener" aria-label="Abrir a imagem inteira"><img src="' + u + '" alt="' + esc(e.titulo) + " — " + esc(a.titulo) + '"' + (k ? ' loading="lazy"' : "") + ' decoding="async"></a>' +
        (e.credito ? "<figcaption>" + esc(e.credito) + "</figcaption>" : "") + "</figure>";
    }
    return '<figure class="etapa-fig sem-img" aria-hidden="true">' + QUADRA_DECOR + '<span class="etapa-num-grande">' + n2(k) + '</span><span class="etapa-fig-t">' + esc(e.titulo) + "</span></figure>";
  }
  function htmlEtapa(e, k, n, a) {
    var prox = k + 1 < n ? "Próxima: " + esc(resumo(etapasDe(a)[k + 1].titulo, 34)) + " →" : "Ver o resumo →";
    return '<section class="etapa" id="etapa' + k + '" data-k="' + k + '"' + (k ? " hidden" : "") + ' aria-labelledby="tEt' + k + '">' + figuraEtapa(e, k, a) +
      '<div class="etapa-corpo"><span class="etapa-kicker"><i></i>Etapa ' + (k + 1) + '</span><h2 id="tEt' + k + '">' + esc(e.titulo) + "</h2>" +
      (e.texto ? '<p class="etapa-texto">' + esc(e.texto) + "</p>" : "") +
      ((e.pontos || []).length ? '<div class="etapa-bloco"><h3>O que conferir</h3><ul class="etapa-pontos">' + e.pontos.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul></div>" : "") +
      (e.erro && e.erro.sinal ? '<div class="etapa-erro"><div><span class="etapa-erro-r">Erro comum</span><p>' + esc(e.erro.sinal) + "</p></div>" + (e.erro.correcao ? '<div class="etapa-corr"><span class="etapa-erro-r">Como corrigir</span><p>' + esc(e.erro.correcao) + "</p></div>" : "") + "</div>" : "") +
      ((e.erros || []).length ? '<div class="etapa-bloco"><h3>Sintoma → causa</h3><ul class="etapa-erros">' + e.erros.map(function (x) { return "<li><b>" + esc(x.sinal) + "</b><span>" + esc(x.correcao) + "</span></li>"; }).join("") + "</ul></div>" : "") +
      '<div class="etapa-nav">' + (k ? '<button type="button" class="cine-btn" data-ir="' + (k - 1) + '">← Anterior</button>' : "<span></span>") + '<button type="button" class="cine-btn primario" data-ir="' + (k + 1) + '">' + prox + "</button></div></div></section>";
  }
  function htmlResumoEtapas(a, et) {
    return '<section class="etapa etapa-resumo" id="etapa' + et.length + '" data-k="' + et.length + '" hidden aria-labelledby="tRes"><div class="etapa-corpo largo"><span class="etapa-kicker"><i></i>Resumo da aula</span><h2 id="tRes">A sequência completa</h2>' +
      '<p class="det">Toque numa etapa para rever.</p><div class="resumo-etapas">' + et.map(function (e, k) {
        var im = e.img && IMG_OK.test(e.img) ? '<img src="' + esc(urlImg(e.img)) + '" alt="" loading="lazy" decoding="async">' : '<span class="resumo-sem">' + n2(k) + "</span>";
        return '<button type="button" class="resumo-etapa" data-ir="' + k + '"><span class="resumo-arte">' + im + '</span><span class="resumo-n">' + (k + 1) + "</span><b>" + esc(e.titulo) + "</b></button>";
      }).join("") + "</div>" +
      (a.descricao ? '<details class="cine-sobre"><summary>Ler a aula em texto corrido</summary><p class="texto-aula">' + esc(a.descricao) + "</p></details>" : "") + "</div></section>";
  }
  function ligarEtapas(a, n) {
    var atual = 0, raiz = $("#passos"); if (!raiz) return;
    function ir(k, rolar) {
      k = Math.max(0, Math.min(n, k)); atual = k;
      $$(".etapa", raiz).forEach(function (el) { el.hidden = +el.getAttribute("data-k") !== k; });
      $$(".passo-seg", raiz).forEach(function (el, j) { el.classList.toggle("feito", j < k); el.classList.toggle("atual", j === k); if (j === k) el.setAttribute("aria-current", "step"); else el.removeAttribute("aria-current"); });
      var rot = $("#passoRot"); if (rot) rot.textContent = k < n ? "Etapa " + (k + 1) + " de " + n : "Resumo";
      var fim = $("#fimAula"); if (fim) fim.hidden = k < n;
      if (rolar) {
        var topo = raiz.getBoundingClientRect().top + window.scrollY - 70;
        if (window.scrollY > topo) window.scrollTo({ top: Math.max(0, topo), behavior: "smooth" });
        var h = $("#etapa" + k + " h2"); if (h) { h.setAttribute("tabindex", "-1"); h.focus({ preventScroll: true }); }
      }
    }
    raiz.addEventListener("click", function (ev) { var b = ev.target.closest("[data-ir]"); if (b) ir(+b.getAttribute("data-ir"), true); });
    raiz.addEventListener("keydown", function (ev) {
      if (/INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) return;
      if (ev.key === "ArrowRight") { ir(atual + 1, true); ev.preventDefault(); } else if (ev.key === "ArrowLeft") { ir(atual - 1, true); ev.preventDefault(); }
    });
    /* deslizar o dedo na imagem troca de etapa */
    var x0 = null;
    raiz.addEventListener("touchstart", function (ev) { x0 = ev.target.closest(".etapa-fig") ? ev.touches[0].clientX : null; }, { passive: true });
    raiz.addEventListener("touchend", function (ev) { if (x0 == null) return; var dx = ev.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 60) ir(atual + (dx < 0 ? 1 : -1), true); }, { passive: true });
    ir(0, false);
  }
  function telaAula(tid, aid) {
    var t = trilhaPorId(decodeURIComponent(tid)); aid = decodeURIComponent(aid);
    var i = t ? t.aulas.map(function (a) { return a.id; }).indexOf(aid) : -1;
    if (i < 0) return telaNaoAchou("Esta aula não está mais disponível.", "#trilhas", "trilhas");
    var a = t.aulas[i], prox = t.aulas[i + 1], feita = !!(st.dados.progresso || {})[a.id], et = etapasDe(a), n = et.length;
    var intro = String(a.descricao || "").split("\n")[0];
    if (/^[^:]{2,30}:/.test(intro)) intro = ""; /* "O que é: …" já é a 1ª etapa */
    tela(n ? (
      '<a class="btn btn-texto voltar" href="#trilha/' + encodeURIComponent(t.id) + '">← ' + esc(t.titulo) + "</a>" +
      '<header class="aula-topo"><p class="det" style="margin:0">Aula ' + (i + 1) + " de " + t.aulas.length + (a.duracao ? " · " + esc(a.duracao) : "") + " · " + n + " etapas</p><h1>" + esc(a.titulo) + "</h1>" +
      (intro ? '<p class="aula-intro">' + esc(intro) + "</p>" : "") + "</header>" +
      (a.youtube ? '<div class="video" id="video"><button type="button" id="btVideo" style="background-image:url(https://i.ytimg.com/vi/' + esc(a.youtube) + '/hqdefault.jpg)" aria-label="Assistir ao vídeo: ' + esc(a.titulo) + '"><span>▶ Assistir</span></button></div>' : "") +
      '<div class="passos" id="passos"><div class="passos-barra"><span id="passoRot" class="passo-rot" aria-live="polite">Etapa 1 de ' + n + '</span><ol class="passo-segs">' +
      et.map(function (e, k) { return '<li><button type="button" class="passo-seg" data-ir="' + k + '" aria-label="Etapa ' + (k + 1) + ": " + esc(e.titulo) + '"></button></li>'; }).join("") +
      '<li><button type="button" class="passo-seg fim" data-ir="' + n + '" aria-label="Resumo"></button></li></ol></div>' +
      et.map(function (e, k) { return htmlEtapa(e, k, n, a); }).join("") + htmlResumoEtapas(a, et) + "</div>" +
      '<div id="fimAula" hidden>' +
      (a.exercicios.length ? '<section aria-labelledby="tEx" style="margin-top:14px"><h2 id="tEx">Treinos desta aula</h2><div id="exAula" class="grade"><p class="det">Carregando os treinos…</p></div></section>' : "") +
      ((a.quiz || []).length ? quizHtml(a) : "") +
      '<div class="acoes"><button class="btn' + (feita ? " btn-claro" : "") + '" type="button" id="btFeita" aria-pressed="' + feita + '">' + (feita ? "✓ Feita · desmarcar" : "Marcar como feita") + "</button>" +
      (prox ? '<a class="btn btn-claro" href="#aula/' + encodeURIComponent(t.id) + "/" + encodeURIComponent(prox.id) + '">Próxima aula →</a>' : "") + "</div></div>"
    ) : (
      '<a class="btn btn-texto voltar" href="#trilha/' + encodeURIComponent(t.id) + '">← ' + esc(t.titulo) + "</a>" +
      '<p class="det" style="margin:0">Aula ' + (i + 1) + " de " + t.aulas.length + (a.duracao ? " · " + esc(a.duracao) : "") + "</p><h1>" + esc(a.titulo) + "</h1>" +
      (a.youtube ? '<div class="video" id="video"><button type="button" id="btVideo" style="background-image:url(https://i.ytimg.com/vi/' + esc(a.youtube) + '/hqdefault.jpg)" aria-label="Assistir ao vídeo: ' + esc(a.titulo) + '"><span>▶ Assistir</span></button></div>' : "") +
      ilustracoes(a) +
      (a.descricao ? '<div class="cartao" style="margin-top:14px"><p class="texto-aula" style="margin:0">' + esc(a.descricao) + "</p></div>" : "") +
      (a.exercicios.length ? '<section aria-labelledby="tEx" style="margin-top:14px"><h2 id="tEx">Treinos desta aula</h2><div id="exAula" class="grade"><p class="det">Carregando os treinos…</p></div></section>' : "") +
      ((a.quiz || []).length ? quizHtml(a) : "") +
      '<div class="acoes"><button class="btn' + (feita ? " btn-claro" : "") + '" type="button" id="btFeita" aria-pressed="' + feita + '">' + (feita ? "✓ Feita · desmarcar" : "Marcar como feita") + "</button>" +
      (prox ? '<a class="btn btn-claro" href="#aula/' + encodeURIComponent(t.id) + "/" + encodeURIComponent(prox.id) + '">Próxima aula →</a>' : "") + "</div>"),
      "trilhas"
    );
    if (n) ligarEtapas(a, n);
    ligarQuiz(a, function () { telaAula(tid, aid); });
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
  function quizHtml(a) {
    var r = (st.dados.quiz || {})[a.id];
    return '<section class="cartao quiz" aria-labelledby="tQuiz"><h2 id="tQuiz" style="margin-bottom:2px">Quiz da aula</h2><p class="det" style="margin:0 0 10px">' + (r ? "Seu melhor resultado: " + r.acertos + " de " + r.total + (r.acertos === r.total ? " ✓" : " · acerte todas para concluir a aula") : "Responda para fixar. Acertando todas, a aula conta para o certificado.") + "</p>" +
      '<form id="fQuiz">' + a.quiz.map(function (q, i) {
        return '<fieldset class="pergunta" data-q="' + i + '"><legend>' + (i + 1) + ". " + esc(q.p) + "</legend>" + q.op.map(function (o, j) { return '<label class="opcao"><input type="radio" name="q' + i + '" value="' + j + '"> <span>' + esc(o) + "</span></label>"; }).join("") + "</fieldset>";
      }).join("") + '<p id="mQuiz" class="msg" hidden></p><div class="acoes"><button class="btn" type="submit">Conferir respostas</button></div></form></section>';
  }
  function ligarQuiz(a, depois) {
    var f = $("#fQuiz"); if (!f) return;
    f.onsubmit = function (ev) {
      ev.preventDefault();
      var resp = a.quiz.map(function (q, i) { var m = f.querySelector('input[name="q' + i + '"]:checked'); return m ? +m.value : -1; });
      if (resp.indexOf(-1) >= 0) return msg($("#mQuiz"), "erro", "Responda todas as perguntas.");
      var bt = f.querySelector("button"); bt.disabled = true;
      api("POST", { acao: "quiz", aulaId: a.id, respostas: resp }).then(function (r) {
        st.dados.quiz = r.quiz || st.dados.quiz;
        $$(".pergunta", f).forEach(function (fs, i) { fs.classList.remove("certa", "errada"); fs.classList.add(r.certas[i] ? "certa" : "errada"); });
        bt.disabled = false;
        msg($("#mQuiz"), r.acertos === r.total ? "ok" : "aviso", r.acertos === r.total ? "Tudo certo: " + r.acertos + " de " + r.total + "." : r.acertos + " de " + r.total + " certas. As marcadas em vermelho valem revisar; tente de novo.");
        falar(r.acertos + " de " + r.total + " certas.");
      }).catch(function (e) { bt.disabled = false; msg($("#mQuiz"), "erro", e.message); });
    };
  }
  function telaCertificado(id) {
    var t = trilhaPorId(decodeURIComponent(id));
    if (!t || !concluido(t)) return telaNaoAchou("O certificado aparece quando todas as aulas do curso estão feitas e os quizzes certos.", "#trilhas", "trilhas");
    var p = st.dados.progresso || {}, fim = t.aulas.map(function (a) { return String(p[a.id] || ""); }).sort().pop();
    tela('<a class="btn btn-texto voltar nao-imprimir" href="#trilha/' + encodeURIComponent(t.id) + '">← ' + esc(t.titulo) + "</a>" +
      '<section class="certificado" aria-label="Certificado"><img src="../assets/logo-team-yoda-transparente.png" alt="Team Yoda" width="122" height="48"><span class="cert-sobre">Academia Digital · Metodologia MTY</span>' +
      "<p>Certificamos que</p><h1>" + esc(String(st.dados.conta.nome || "").trim() || "Atleta") + "</h1><p>concluiu o curso</p><h2>" + esc(t.titulo) + "</h2>" +
      '<p class="det">' + esc(rotuloCurso(t)) + " · " + t.aulas.length + (t.aulas.length === 1 ? " aula" : " aulas") + (fim ? " · concluído em " + dataBR(fim.slice(0, 10)) : "") + "</p></section>" +
      '<div class="acoes nao-imprimir"><button class="btn" type="button" id="btImprimir">Imprimir ou salvar em PDF</button></div>', "trilhas");
    $("#btImprimir").onclick = function () { window.print(); };
  }
  function temQuadra(c) { return !!(window.QLQuadraExercicio && window.QLQuadraExercicio.tem(c)); }
  function cartaoExercicio(e) {
    return '<a class="cartao ex" href="#treino/' + encodeURIComponent(e.c) + '">' + (temQuadra(e.c) ? '<div class="ex-thumb">' + quadraMini(e.c) + "</div>" : "") + '<span class="cod">' + esc(e.c) + " · " + esc(FAM[e.f] || e.f) + "</span><h3>" + esc(e.n) + '</h3><p class="det" style="margin:0">' + esc(resumo(e.o || e.m, 140)) + "</p>" +
      (temQuadra(e.c) ? '<span class="tag tag-quadra">▶ Quadra animada</span>' : "") + (e.e || []).map(function (s) { return '<span class="tag">' + esc(ESTAGIO[s] || s) + "</span>"; }).join("") + "</a>";
  }

  /* ── treinos guiados: sessões prontas montadas do catálogo (aquecimento, 3 exercícios e um desafio) ── */
  var SESSOES = [
    { id: "fundo", titulo: "Fundo de quadra: consistência", objetivo: "Profundidade e margem na troca de fundo.", aq: ["MV", 0], pr: ["FB", 0], de: ["DC", 0] },
    { id: "saque", titulo: "Saque e devolução", objetivo: "Direção do saque e a primeira bola depois dele.", aq: ["MV", 1], pr: ["PDS", 0], de: ["IP", 0] },
    { id: "movimento", titulo: "Movimentação e base", objetivo: "Chegar equilibrado e recuperar antes da próxima bola.", aq: ["CO", 0], pr: ["MV", 2], de: ["CF", 0] },
    { id: "decisao", titulo: "Decisão tática", objetivo: "Reconhecer a bola e escolher a jogada certa.", aq: ["FB", 3], pr: ["TR", 0], de: ["JA", 0] },
    { id: "ataque", titulo: "Ataque e finalização", objetivo: "Entrar na quadra e converter a bola que armou.", aq: ["MV", 3], pr: ["AT", 0], de: ["PT", 0] },
    { id: "mental", titulo: "Mental de jogo", objetivo: "Rotina entre pontos, respiração e pressão.", fixos: ["DM014", "DM001", "DM006", "DM017", "DM005"] },
  ];
  function minutosDe(g) { var m = /(\d+)\s*(?:[-–a]\s*\d+\s*)?min/i.exec(String(g || "")); return m ? Math.min(15, Math.max(3, +m[1])) : 8; }
  function montarSessao(def, c) {
    function pegar(f, n, pulo) { return c.lista.filter(function (e) { return e.f === f && temQuadra(e.c); }).slice(pulo || 0, (pulo || 0) + n); }
    var et = [];
    if (def.fixos) def.fixos.forEach(function (cod, i) { var e = c.porCodigo[cod]; if (e) et.push({ tipo: i === 0 ? "Aquecimento" : i === def.fixos.length - 1 ? "Desafio" : "Exercício", e: e, min: i === 0 ? 5 : minutosDe(e.g) }); });
    else {
      var aq = pegar(def.aq[0], 1, def.aq[1])[0], de = pegar(def.de[0], 1, def.de[1])[0];
      if (aq) et.push({ tipo: "Aquecimento", e: aq, min: 5 });
      pegar(def.pr[0], 3, def.pr[1]).forEach(function (e) { et.push({ tipo: "Exercício", e: e, min: minutosDe(e.g) }); });
      if (de) et.push({ tipo: "Desafio", e: de, min: 8 });
    }
    return { def: def, etapas: et, total: et.reduce(function (s, x) { return s + x.min; }, 0) };
  }
  /* ── treino de correção: montado da análise de movimento (itens em atenção, na ordem de prioridade do motor) ── */
  var GOLPE_NOME = { forehand: "forehand", backhand: "backhand", saque: "saque" };
  function analisePorId(id) { return (st.dados.movimentos || []).filter(function (m) { return m.id === id; })[0]; }
  function emAtencao(m) { var nomes = (m.prio || []).slice(); (m.itens || []).forEach(function (i) { if (i.s === "atencao" && nomes.indexOf(i.n) < 0) nomes.push(i.n); }); return nomes; }
  function ultimaAnaliseComCorrecao() { var l = (st.dados.movimentos || []).slice().sort(function (a, b) { return String(a.criadoEm) < String(b.criadoEm) ? 1 : -1; }); for (var i = 0; i < l.length; i++) if (emAtencao(l[i]).length) return l[i]; return null; }
  function tituloCorrecao(m) { return "Correção do " + (GOLPE_NOME[m.golpe] || "golpe") + (m.criadoEm ? " · análise de " + dataBR(String(m.criadoEm).slice(0, 10)) : ""); }
  function montarCorrecao(m, c) {
    var I = (window.QLBiomec && window.QLBiomec.INTERV) || {}, nomes = emAtencao(m).slice(0, 3), g = GOLPE_NOME[m.golpe] || "golpe";
    var et = [{ tipo: "Aquecimento", titulo: "Shadow swing do " + g, min: 5, porque: "Sem bola, devagar: 10 repetições pensando primeiro em “" + (nomes[0] || "") + "”, depois em velocidade normal.", lista: ["Filme-se de lado se puder, para comparar com a análise."] }];
    nomes.forEach(function (n) {
      var d = I[n] || {}, item = (m.itens || []).filter(function (i) { return i.n === n; })[0] || {}, pq = "";
      try { pq = typeof d.porque === "function" ? d.porque({ valor: item.v, nome: n }) : d.porque || ""; } catch (x) { pq = ""; }
      et.push({ tipo: "Correção", titulo: n, min: 6, porque: (item.v != null ? "Medido: " + String(item.v).replace(".", ",") + (item.u || "") + (item.r ? " (referência " + item.r + "). " : ". ") : "") + pq, lista: (d.ex || []).slice(0, 3) });
    });
    var re = m.golpe === "saque" ? null : m.golpe === "backhand" ? /^BH|Backhand/i : /^FH|Forehand/i;
    var bola = c.lista.filter(function (e) { return temQuadra(e.c) && (m.golpe === "saque" ? e.f === "PDS" : e.f === "FB" && re.test(e.n)); })[0];
    if (bola) et.push({ tipo: "Aplicar na bola", e: bola, min: 10 });
    et.push({ tipo: "Reteste", titulo: "Filme de novo e compare", min: 3, porque: "Grave o mesmo golpe, do mesmo ângulo, e analise de novo: a comparação com esta análise aparece no relatório.", lista: [], link: "#analise" });
    return { def: { id: "correcao-" + m.id, titulo: tituloCorrecao(m), objetivo: "Corrigir: " + nomes.join(", ") + ".", analiseId: m.id }, etapas: et, total: et.reduce(function (s, x) { return s + x.min; }, 0) };
  }
  function cartaoCorrecao(m) {
    var nomes = emAtencao(m);
    return '<a class="cartao correcao-card" href="#sessao/correcao-' + encodeURIComponent(m.id) + '"><span class="cod">Treino de correção · da sua análise</span><h3>' + esc(tituloCorrecao(m)) + '</h3><p class="det" style="margin:0">' + esc(nomes.slice(0, 3).join(" · ")) + (nomes.length > 3 ? " e mais " + (nomes.length - 3) : "") + "</p>" +
      (vezesFeita("correcao-" + m.id) ? '<span class="tag tag-quadra">feito ' + vezesFeita("correcao-" + m.id) + "×</span>" : '<span class="tag tag-quadra">▶ Fazer o treino</span>') + "</a>";
  }
  function vezesFeita(id) { return (st.dados.sessoes || []).filter(function (x) { return x.id === id; }).length; }
  function sessoesHtml(c) {
    var mc = ultimaAnaliseComCorrecao();
    return (mc ? '<h2 class="secao">Seu treino de correção</h2><div class="grade" style="margin-bottom:4px">' + cartaoCorrecao(mc) + "</div>" : "") +
      '<h2 class="secao">Treinos guiados</h2><p class="det" style="margin:-4px 0 10px">Sessões prontas da Metodologia MTY: siga as etapas com o cronômetro e registre os acertos.</p><div class="cine-trilho eps sessoes-trilho" id="sessoes">' + SESSOES.map(function (def) {
      var se = montarSessao(def, c), pri = se.etapas.filter(function (x) { return x.tipo === "Exercício"; })[0], n = vezesFeita(def.id);
      return '<a class="cartao ex sessao-card" href="#sessao/' + def.id + '">' + (pri && temQuadra(pri.e.c) ? '<div class="ex-thumb">' + quadraMini(pri.e.c) + "</div>" : '<div class="ex-thumb sessao-mental" aria-hidden="true">' + QUADRA_DECOR + "</div>") +
        '<span class="cod">' + se.etapas.length + " etapas · ~" + se.total + " min" + (n ? " · feita " + n + (n === 1 ? " vez" : " vezes") : "") + "</span><h3>" + esc(def.titulo) + '</h3><p class="det" style="margin:0">' + esc(def.objetivo) + "</p></a>";
    }).join("") + "</div>";
  }
  function mmss(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
  function telaSessao(id) {
    id = decodeURIComponent(id);
    var mov = /^correcao-/.test(id) ? analisePorId(id.slice(9)) : null;
    var def = SESSOES.filter(function (x) { return x.id === id; })[0];
    if (!def && !mov) return telaNaoAchou(/^correcao-/.test(id) ? "Esta análise não está mais no seu histórico." : "Esta sessão não existe.", "#treinos", "treinos");
    tela('<p class="carregando">Montando a sessão…</p>', "treinos");
    Promise.all([catalogo(), mov ? carregarMovimento() : null]).then(function (rs) {
      var c = rs[0], se = mov ? montarCorrecao(mov, c) : montarSessao(def, c);
      if (!st.sess || st.sess.id !== id) st.sess = { id: id, i: 0, t0: Date.now(), itens: se.etapas.map(function (x) { return x.e ? { c: x.e.c, feito: false, acertos: "", tentativas: "" } : { t: x.titulo, feito: false, acertos: "", tentativas: "" }; }) };
      desenharEtapa(se);
    }).catch(function (e) { tela('<p class="msg msg-erro">' + esc(e.message) + "</p>", "treinos"); });
  }
  function desenharEtapa(se) {
    var S = st.sess, n = se.etapas.length;
    if (S.i >= n) return desenharResumo(se);
    var et = se.etapas[S.i], e = et.e, it = S.itens[S.i], restante = et.min * 60, rodando = false, nomeEt = e ? e.n : et.titulo;
    tela('<a class="btn btn-texto voltar" href="#treinos">← Treinos</a><p class="det" style="margin:0">' + esc(se.def.titulo) + "</p>" +
      '<div class="passos-sessao" aria-hidden="true">' + se.etapas.map(function (x, k) { return '<i class="' + (k < S.i ? "ok" : k === S.i ? "agora" : "") + '"></i>'; }).join("") + "</div>" +
      '<span class="cod" style="display:block;margin-top:8px">Etapa ' + (S.i + 1) + " de " + n + " · " + esc(et.tipo) + " · " + et.min + " min</span><h1>" + esc(nomeEt) + "</h1>" +
      (e && temQuadra(e.c) ? '<div class="cartao" style="margin-top:8px"><div id="quadra" style="max-width:640px"></div></div>' : "") +
      '<section class="cartao cronometro" aria-label="Cronômetro"><div id="tempo" class="tempo" aria-live="off">' + mmss(restante) + '</div><div class="acoes" style="justify-content:center;margin-top:6px"><button class="btn" type="button" id="btTempo">▶ Iniciar</button><button class="btn btn-claro" type="button" id="btMais1">+1 min</button></div></section>' +
      '<div class="cartao"><dl class="ficha">' + (e ? (e.o ? "<dt>Objetivo</dt><dd>" + esc(e.o) + "</dd>" : "") + (e.m ? '<dt>Como fazer</dt><dd class="texto-aula">' + esc(e.m) + "</dd>" : "") + (e.x ? "<dt>Preste atenção</dt><dd>" + esc(e.x) + "</dd>" : "")
        : (et.porque ? "<dt>" + (et.tipo === "Correção" ? "Por que corrigir" : "Como fazer") + "</dt><dd>" + esc(et.porque) + "</dd>" : "") + (et.lista && et.lista.length ? "<dt>Como treinar</dt><dd><ul class=\"lista-correcao\">" + et.lista.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></dd>" : "") + (et.link ? '<dd style="margin-top:10px"><a class="btn btn-claro" href="' + et.link + '">Abrir a análise de movimento</a></dd>' : "")) + "</dl>" +
      '<div class="registro"><span class="det">Registrar (opcional):</span> <label>Acertos <input id="rAc" type="number" inputmode="numeric" min="0" max="200" value="' + esc(it.acertos) + '"></label> <label>de <input id="rTe" type="number" inputmode="numeric" min="1" max="200" value="' + esc(it.tentativas) + '"></label></div></div>' +
      '<div class="acoes"><button class="btn btn-saibro" type="button" id="btConcluir">' + (S.i === n - 1 ? "Concluir e ver resumo" : "Concluir etapa →") + '</button><button class="btn btn-texto" type="button" id="btPular">Pular</button>' + (S.i > 0 ? '<button class="btn btn-texto" type="button" id="btVoltarEt">← Etapa anterior</button>' : "") + "</div>", "treinos");
    var q = $("#quadra"); if (q && e) st.quadra = window.QLQuadraExercicio.montar(q, e.c, { resumo: e.o });
    var elT = $("#tempo"), bt = $("#btTempo");
    function tique() { restante -= 1; elT.textContent = mmss(restante); if (restante <= 0) { clearInterval(st.cronometro); st.cronometro = null; rodando = false; bt.textContent = "▶ Iniciar"; elT.classList.add("fim"); falar("Tempo da etapa encerrado."); try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (x) { /* ok */ } } }
    bt.onclick = function () {
      if (rodando) { clearInterval(st.cronometro); st.cronometro = null; rodando = false; bt.textContent = "▶ Continuar"; return; }
      if (restante <= 0) { restante = et.min * 60; elT.classList.remove("fim"); }
      rodando = true; bt.textContent = "⏸ Pausar"; st.cronometro = setInterval(tique, 1000);
    };
    $("#btMais1").onclick = function () { restante += 60; elT.classList.remove("fim"); elT.textContent = mmss(restante); };
    function guardar() { it.acertos = $("#rAc").value; it.tentativas = $("#rTe").value; }
    $("#btConcluir").onclick = function () { guardar(); it.feito = true; S.i++; desenharEtapa(se); };
    $("#btPular").onclick = function () { guardar(); S.i++; desenharEtapa(se); };
    var bv = $("#btVoltarEt"); if (bv) bv.onclick = function () { guardar(); S.i--; desenharEtapa(se); };
  }
  function desenharResumo(se) {
    var S = st.sess, min = Math.max(1, Math.round((Date.now() - S.t0) / 60000)), feitos = S.itens.filter(function (x) { return x.feito; }).length;
    tela('<a class="btn btn-texto voltar" href="#treinos">← Treinos</a><h1>Sessão concluída</h1><p class="lead">' + esc(se.def.titulo) + " · " + feitos + " de " + S.itens.length + " etapas feitas</p>" +
      '<div class="cartao">' + se.etapas.map(function (x, k) { var it = S.itens[k], ac = +it.acertos, te = +it.tentativas; return '<div class="aula-item' + (it.feito ? " feita" : "") + '"><span class="n" aria-hidden="true">' + (it.feito ? "✓" : k + 1) + '</span><span class="t"><b>' + esc(x.e ? x.e.n : x.titulo) + "</b><small>" + esc(x.tipo) + (te >= 1 && ac >= 0 && ac <= te ? " · " + ac + " de " + te + " (" + Math.round(ac / te * 100) + "%)" : "") + (it.feito ? "" : " · pulada") + "</small></span></div>"; }).join("") + "</div>" +
      '<label class="campo" style="max-width:220px">Minutos treinados<input id="rMin" type="number" inputmode="numeric" min="1" max="240" value="' + Math.max(min, Math.round(se.total * feitos / Math.max(1, S.itens.length))) + '"></label>' +
      '<p id="mSes" class="msg" hidden></p><div class="acoes"><button class="btn btn-saibro" type="button" id="btSalvarSes">Salvar no meu painel</button><button class="btn btn-texto" type="button" id="btDescartar">Descartar</button></div>', "treinos");
    $("#btDescartar").onclick = function () { st.sess = null; location.hash = "#treinos"; };
    $("#btSalvarSes").onclick = function () {
      var b = this; b.disabled = true;
      var itens = S.itens.map(function (x) { var o = x.c ? { c: x.c, feito: x.feito } : { t: x.t, feito: x.feito }; if (+x.tentativas >= 1) { o.acertos = +x.acertos || 0; o.tentativas = +x.tentativas; } return o; });
      api("POST", { acao: "sessao", sessaoId: S.id, titulo: se.def.titulo, analiseId: se.def.analiseId, minutos: +$("#rMin").value || min, itens: itens }).then(function (r) {
        st.dados.sessoes = r.sessoes || st.dados.sessoes; st.sess = null;
        msg($("#mSes"), "ok", "Salvo. Os minutos e o dia já contam no seu painel.");
        b.textContent = "Ir para o Início"; b.disabled = false; b.onclick = function () { location.hash = "#inicio"; };
      }).catch(function (e) { b.disabled = false; msg($("#mSes"), "erro", e.message); });
    };
  }
  function telaTreinos() {
    tela('<h1>Treinos</h1><div id="sessoesWrap"></div><h2 class="secao">Catálogo de exercícios</h2><p class="det" style="margin:-4px 0 10px">Todos os exercícios da Metodologia MTY. Nos que têm quadra animada, toque em Reproduzir para ver cada bola.</p><div id="treinos"><p class="carregando">Carregando o catálogo…</p></div>', "treinos");
    catalogo().then(function (c) {
      var el = $("#treinos"); if (!el) return;
      var sw = $("#sessoesWrap"); if (sw) sw.innerHTML = sessoesHtml(c);
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

  /* ── análise de movimento (a mesma tecnologia do QuadraLab Player): o módulo só carrega quando o aluno abre a aba ── */
  var carregandoMov = null;
  function carregarMovimento() {
    if (window.QLMovimento && window.QLBiomec) return Promise.resolve();
    if (carregandoMov) return carregandoMov;
    carregandoMov = new Promise(function (ok, falha) {
      if (!document.getElementById("css-mov")) { var l = document.createElement("link"); l.id = "css-mov"; l.rel = "stylesheet"; l.href = "../scout/movimento.css"; document.head.appendChild(l); }
      var fila = ["../scout/movimento-motor.js", "../scout/movimento.js"];
      (function proximo() {
        if (!fila.length) return ok();
        var sc = document.createElement("script"); sc.src = fila.shift(); sc.onload = proximo;
        sc.onerror = function () { carregandoMov = null; falha(new Error("Não foi possível abrir a análise agora. Confira a internet e tente de novo.")); };
        document.head.appendChild(sc);
      })();
    });
    return carregandoMov;
  }
  /* relatório grande demais (fotos em alta resolução): guarda sem as fotos em vez de não guardar nada */
  function caberRelatorio(arq) { var t = JSON.stringify(arq); if (t.length <= 890000) return t; var sem = {}; for (var k in arq) sem[k] = arq[k]; sem.fotos = []; sem.semFotos = true; return JSON.stringify(sem); }
  function telaAnalise() {
    var d = st.dados;
    tela('<h1>Análise de movimento</h1><p class="lead">Filme um golpe (forehand, backhand ou saque) e veja o checklist por fase, o vídeo lado a lado com o boneco, os pontos fortes e o que treinar. A análise roda no seu celular: o vídeo não é enviado.</p>' +
      (d.acesso.tipo === "equipe" ? '<p class="msg msg-aviso">Conta da equipe: dá para testar, mas as análises não ficam salvas aqui. Para analisar um aluno, use a ficha dele no app do treinador.</p>' : "") +
      '<div id="correcaoCta"></div><div id="movArea"><p class="carregando">Abrindo a análise…</p></div>', "analise");
    function mostrarCta(m, nova) {
      var el = $("#correcaoCta"); if (!el || !m) return;
      var nomes = emAtencao(m);
      el.innerHTML = nomes.length
        ? '<section class="cartao correcao-cta" aria-live="polite"><span class="cod">' + (nova ? "Treino criado com esta análise" : "Da sua última análise") + '</span><h2 style="margin:2px 0 4px">' + esc(tituloCorrecao(m)) + '</h2><p class="det" style="margin:0 0 10px">Corrigir: ' + esc(nomes.slice(0, 3).join(", ")) + '.</p><a class="btn btn-saibro" href="#sessao/correcao-' + encodeURIComponent(m.id) + '">Fazer o treino de correção</a></section>'
        : (nova ? '<p class="msg msg-ok">Todos os itens medidos ficaram dentro da referência. Siga com os treinos guiados para manter.</p>' : "");
    }
    mostrarCta(ultimaAnaliseComCorrecao(), false);
    carregarMovimento().then(function () {
      var el = $("#movArea"); if (!el) return;
      el.innerHTML = "";
      var salvando = Promise.resolve();
      var arquivo = {
        salvar: function (aluno, arq) { return salvando.then(function () { return api("POST", { acao: "movRelatorio", id: arq.id, relatorio: caberRelatorio(arq) }); }); },
        ler: function (id) { return api("GET", null, "movRel=" + encodeURIComponent(id)).then(function (r) { return r.relatorio; }); },
        salvarClip: function (id, clip) { return salvando.then(function () { var t = JSON.stringify(clip); return t.length > 890000 ? null : api("POST", { acao: "movClip", id: id, clip: t }); }); },
        lerClip: function (id) { return api("GET", null, "movClip=" + encodeURIComponent(id)).then(function (r) { return r.clip; }); },
        indice: function () { return Promise.resolve({ itens: st.dados.movimentos || [], removidos: [] }); },
        registrar: function () { return Promise.resolve(); },
        remover: function () { return Promise.resolve(); },
      };
      var logo = new URL("../assets/logo-quadralab.png", location.href).href;
      st.mov = window.QLMovimento.montar(el, {
        atleta: d.conta.nome || "", alunoId: "eu", historico: d.movimentos || [], logo: "../assets/logo-quadralab.png", logoAbsoluto: logo, arquivo: arquivo,
        modelos: false, publico: "atleta",
        aoSalvar: function (reg) { salvando = api("POST", { acao: "movSalvar", resumo: reg }).then(function (r) { st.dados.movimentos = r.movimentos || st.dados.movimentos; mostrarCta(analisePorId(reg.id) || reg, true); try { $("#correcaoCta").scrollIntoView({ behavior: "smooth", block: "start" }); } catch (x) { /* ok */ } }); return salvando; },
        aoRemover: function (id) { return api("POST", { acao: "movRemover", id: id }).then(function (r) { st.dados.movimentos = r.movimentos || st.dados.movimentos; }); },
      });
    }).catch(function (e) { var el = $("#movArea"); if (el) el.innerHTML = '<p class="msg msg-erro">' + esc(e.message) + "</p>"; });
  }

  /* simulador de decisões (o mesmo do QuadraLab Player e do Competição), dentro de um quadro; guarda a tela no endereço */
  var simAtual = "";
  function telaSimulador(sub) {
    if ($("#simQuadro") && sub === simAtual) return;
    simAtual = sub;
    tela('<h1 class="sr">Simulador de decisões</h1><div class="sim"><iframe id="simQuadro" title="Simulador de decisões" src="../decisoes/?embed=1&tema=cine' + (sub ? "#" + esc(sub) : "") + '"></iframe></div>', "simulador");
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
