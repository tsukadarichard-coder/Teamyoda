/* Consultoria com Richard Tsukada (teamyoda.com.br/richard), Etapa 1: enviar e responder.
   Cliente: entrar ou criar conta → cadastro (menor com autorização do responsável) → aguarda o Richard liberar → Início, Enviar
   (vídeo de até 3 min, envio retomável) e Devolutivas (o vídeo, a resposta e o que treinar; "Entendi" ou "Tenho uma dúvida").
   Richard (e-mail na lista do servidor): Fila (mais antigo primeiro, com prazo), Responder (texto, o que viu, o que treinar e
   gravação de áudio ou vídeo), Clientes (liberar, pausar, ficha com anotação privada) e Ajustes (preparar o armazenamento).
   Tudo pela function consultoria.js; avisos no celular por push-cliente.js (app "consultoria"). */
(function () {
  "use strict";
  var API = "/.netlify/functions/consultoria";
  var ERROS_AUTH = { "auth/invalid-credential": "E-mail ou senha não conferem.", "auth/wrong-password": "E-mail ou senha não conferem.", "auth/user-not-found": "E-mail ou senha não conferem.",
    "auth/invalid-email": "E-mail inválido.", "auth/too-many-requests": "Muitas tentativas. Espere um pouco e tente de novo." };
  var app = document.getElementById("app"), nav = document.getElementById("nav"), btSair = document.getElementById("btSair"), toastEl = document.getElementById("toast");
  var auth = null;
  try { if (!firebase.apps.length) firebase.initializeApp(MTY_CONFIG); auth = firebase.auth(); } catch (e) { console.error("consultoria: Firebase", e); }
  var st = { usuario: null, dados: null, modo: "entrar", carregado: false };
  var envioAtivo = null; // { controle, envioId } enquanto um vídeo sobe

  /* ── utilidades ── */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(s) { return document.querySelector(s); }
  function cada(s, fn) { Array.prototype.forEach.call(document.querySelectorAll(s), fn); }
  function msg(el, tipo, t) { if (el) { el.className = "msg msg-" + tipo; el.textContent = t; el.hidden = !t; } }
  function tela(html, manterRolagem) { app.innerHTML = html; if (!manterRolagem) window.scrollTo(0, 0); }
  var tmrToast = null;
  function toast(t) { toastEl.textContent = t; toastEl.hidden = false; clearTimeout(tmrToast); tmrToast = setTimeout(function () { toastEl.hidden = true; }, 3500); }
  function primeiro(n) { return String(n || "").split(" ")[0]; }
  function dataBR(iso) { if (!iso) return ""; var d = new Date(iso); return ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2); }
  function dataLonga(iso) { if (!iso) return ""; var d = new Date(iso); return dataBR(iso) + "/" + d.getFullYear(); }
  function ha(iso) {
    var s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
    if (s < 3600) return "há " + Math.max(1, Math.round(s / 60)) + " min";
    if (s < 86400) return "há " + Math.round(s / 3600) + " h";
    var d = Math.floor(s / 86400); return d === 1 ? "ontem" : "há " + d + " dias";
  }
  function mb(n) { return (n / 1048576).toFixed(n < 10485760 ? 1 : 0).replace(".", ",") + " MB"; }
  function minSeg(s) { if (s == null) return ""; s = Math.round(s); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
  function idadeDe(nasc) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nasc || "")) return null;
    var h = new Date(), p = nasc.split("-").map(Number), a = h.getFullYear() - p[0];
    if (h.getMonth() + 1 < p[1] || (h.getMonth() + 1 === p[1] && h.getDate() < p[2])) a--;
    return a;
  }
  function ocupado(bt, sim, texto) { if (!bt) return; if (sim) { bt.dataset.t = bt.textContent; bt.textContent = texto || "Aguarde…"; bt.disabled = true; } else { bt.textContent = bt.dataset.t || bt.textContent; bt.disabled = false; } }

  function api(metodo, corpo) {
    var tk = st.usuario ? st.usuario.getIdToken() : Promise.resolve("");
    return tk.then(function (t) {
      var h = { "content-type": "application/json" }; if (t) h.authorization = "Bearer " + t;
      return fetch(API, { method: metodo, headers: h, body: corpo ? JSON.stringify(corpo) : undefined });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.erro || "Não foi possível agora. Tente de novo."); e.status = r.status; throw e; } return j; });
    });
  }
  function carregar() { return api("GET").then(function (d) { st.dados = d; st.carregado = true; }); }
  function recarregar() { return carregar().then(rota).catch(function (e) { toast(e.message); }); }

  /* ── navegação ── */
  var ICONES = {
    inicio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    enviar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/></svg>',
    devolutivas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 5h16v11H8l-4 4z"/></svg>',
    fila: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    clientes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.6c1.8.8 3 2.6 3.5 5.4"/></svg>',
    ajustes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2 1.2L10 21h4l.5-2.6c.7-.3 1.4-.7 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z"/></svg>',
  };
  function barra(itens, atual) {
    nav.hidden = !itens.length;
    nav.innerHTML = itens.map(function (i) {
      return '<a href="' + i.href + '" data-aba="' + i.id + '"' + (i.id === atual ? ' aria-current="page"' : "") + ">" + ICONES[i.id] + "<span>" + i.rot + "</span>" + (i.n ? '<span class="n">' + i.n + "</span>" : "") + "</a>";
    }).join("");
  }
  function rota() {
    btSair.hidden = !st.usuario;
    if (!st.usuario) { barra([]); return telaEntrada(); }
    if (!st.carregado) { barra([]); return tela('<p class="carregando">Carregando…</p>'); }
    var h = location.hash.replace(/^#\/?/, "").split("/"), d = st.dados;
    if (d.papel === "richard") return rotaRichard(h);
    return rotaCliente(h);
  }
  /* listas (fila, clientes, início, devolutivas) se atualizam ao abrir a aba e ao voltar para o app; telas com formulário não são redesenhadas */
  function telaDeLista() { var h = (location.hash.replace(/^#\/?/, "").split("/")[0]) || ""; return ["", "fila", "clientes", "inicio", "devolutivas"].indexOf(h) >= 0; }
  var atualizando = false;
  function atualizarLista() {
    if (!st.usuario || !st.carregado || atualizando || envioAtivo || !telaDeLista()) return;
    atualizando = true;
    carregar().then(function () { atualizando = false; if (telaDeLista() && !envioAtivo) rota(); }).catch(function () { atualizando = false; });
  }
  window.addEventListener("hashchange", function () { rota(); atualizarLista(); });
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") atualizarLista(); });

  /* ══════════════ Entrada ══════════════ */
  function telaEntrada() {
    var criar = st.modo === "criar";
    tela('<span class="olho">Consultoria</span><h1>Seu tênis analisado pelo Richard Tsukada</h1>' +
      '<p class="lead">Envie o vídeo do golpe ou do jogo, conte a sua dúvida e receba a devolutiva com o que treinar.</p>' +
      '<div class="foto"><img src="/assets/richard-tsukada-240.jpg" alt="" width="64" height="64"><p class="det">Richard Tsukada, head trainer do Team Yoda. Cada vídeo é visto e respondido por ele.</p></div>' +
      '<div class="alternar" role="tablist"><button type="button" role="tab" id="mEntrar" aria-selected="' + !criar + '">Entrar</button><button type="button" role="tab" id="mCriar" aria-selected="' + criar + '">Criar conta</button></div>' +
      '<form id="fEntrar" novalidate>' +
      (criar ? '<label class="campo">Seu nome<input name="nome" autocomplete="name" maxlength="80"></label>' : "") +
      '<label class="campo">E-mail<input name="email" type="email" autocomplete="email" inputmode="email"></label>' +
      '<label class="campo">Senha' + (criar ? " (pelo menos 8 caracteres)" : "") + '<input name="senha" type="password" autocomplete="' + (criar ? "new-password" : "current-password") + '"></label>' +
      '<p id="mEnt" class="msg" role="status" hidden></p>' +
      '<div class="acoes"><button class="btn btn-verm" type="submit" id="btEnt">' + (criar ? "Criar conta e entrar" : "Entrar") + "</button>" +
      (!criar ? '<button class="link" type="button" id="btEsqueci">Esqueci a senha</button>' : "") + "</div></form>" +
      '<div class="cartao calmo" style="margin-top:28px"><h3>Como funciona</h3><ol class="passos"><li>Crie a conta e conte quem é o atleta.</li><li>O Richard combina a consultoria com você e libera o acesso.</li>' +
      "<li>Filme até 3 minutos, escreva a dúvida e envie.</li><li>A devolutiva chega aqui, com o que treinar.</li></ol>" +
      '<p class="det" style="margin-top:10px">Já tem conta no Team Yoda (Área do aluno ou Academia Digital)? Entre com ela.</p></div>');
    $("#mEntrar").onclick = function () { st.modo = "entrar"; telaEntrada(); };
    $("#mCriar").onclick = function () { st.modo = "criar"; telaEntrada(); };
    var f = $("#fEntrar"), m = $("#mEnt"), bt = $("#btEnt");
    f.onsubmit = function (ev) {
      ev.preventDefault();
      var nome = f.nome ? f.nome.value.trim() : "", email = f.email.value.trim(), senha = f.senha.value;
      if (criar && nome.length < 2) return msg(m, "erro", "Escreva o seu nome.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return msg(m, "erro", "Confira o e-mail.");
      if (criar && senha.length < 8) return msg(m, "erro", "A senha precisa ter pelo menos 8 caracteres.");
      if (!senha) return msg(m, "erro", "Escreva a senha.");
      if (!auth) return msg(m, "erro", "Não foi possível conectar agora. Recarregue a página.");
      bt.disabled = true; msg(m, "aviso", criar ? "Criando a sua conta…" : "Entrando…");
      var passo = criar ? api("POST", { acao: "criarConta", nome: nome, email: email, senha: senha }) : Promise.resolve();
      passo.then(function () { return auth.signInWithEmailAndPassword(email, senha); }).catch(function (e) {
        bt.disabled = false;
        if (e && e.status === 409) { st.modo = "entrar"; telaEntrada(); msg($("#mEnt"), "aviso", e.message); $("#fEntrar").email.value = email; return; }
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
  }

  /* ══════════════ Cliente ══════════════ */
  function novas(d) { return (d.envios || []).filter(function (e) { return e.estado === "respondido" && !e.entendidoEm; }); }
  function rotaCliente(h) {
    var d = st.dados;
    if (!d.cliente) { barra([]); return telaCadastro(); }
    if (d.cliente.estado === "pendente") { barra([]); return telaPendente(); }
    var aba = h[0] || "inicio";
    barra([{ id: "inicio", rot: "Início", href: "#/" }, { id: "enviar", rot: "Enviar", href: "#/enviar" }, { id: "devolutivas", rot: "Devolutivas", href: "#/devolutivas", n: novas(d).length }],
      aba === "envio" ? "devolutivas" : aba);
    if (aba === "enviar") return telaEnviar();
    if (aba === "devolutivas") return telaDevolutivas();
    if (aba === "envio" && h[1]) return telaEnvio(h[1]);
    return telaInicio();
  }

  function telaCadastro() {
    tela('<span class="olho">Primeiro acesso</span><h1>Quem é o atleta?</h1><p class="lead">O Richard usa isso para entender o seu momento. Você só precisa preencher uma vez.</p>' +
      '<form id="fCad" novalidate class="cartao">' +
      '<label class="campo">Nome do atleta<input name="nome" autocomplete="name" maxlength="80" value="' + esc(st.usuario && st.usuario.displayName || "") + '"></label>' +
      '<label class="campo">Data de nascimento do atleta<input name="nascimento" type="date"></label>' +
      '<label class="campo">O que você quer melhorar?<textarea name="objetivo" maxlength="600" placeholder="Ex.: ganhar consistência no segundo saque e decidir melhor quando subir à rede."></textarea></label>' +
      '<div id="blocoMenor" hidden><div class="msg msg-aviso">Atleta menor de 18 anos: o responsável autoriza o envio dos vídeos.</div>' +
      '<label class="campo">Nome do responsável<input name="rnome" autocomplete="off" maxlength="80"></label>' +
      '<label class="campo">E-mail do responsável<input name="remail" type="email" inputmode="email" autocomplete="off"></label>' +
      '<label class="check"><input type="checkbox" name="aceite"><span>Sou o responsável e autorizo o envio de vídeos do atleta para a análise do Richard Tsukada. Os vídeos ficam privados: só o atleta, eu e o Richard veem, e são apagados 90 dias depois da devolutiva.</span></label></div>' +
      '<p id="mCad" class="msg" role="status" hidden></p><div class="acoes"><button class="btn btn-verm" type="submit" id="btCad">Enviar cadastro</button></div></form>');
    var f = $("#fCad"), m = $("#mCad"), bt = $("#btCad");
    function menor() { var i = idadeDe(f.nascimento.value); $("#blocoMenor").hidden = !(i != null && i < 18); }
    f.nascimento.addEventListener("change", menor); f.nascimento.addEventListener("input", menor);
    f.onsubmit = function (ev) {
      ev.preventDefault();
      var i = idadeDe(f.nascimento.value), corpo = { acao: "cadastro", nome: f.nome.value, nascimento: f.nascimento.value, objetivo: f.objetivo.value };
      if (i != null && i < 18) corpo.responsavel = { nome: f.rnome.value, email: f.remail.value.trim(), aceite: f.aceite.checked };
      ocupado(bt, true, "Enviando…");
      api("POST", corpo).then(function () { return recarregar(); }).catch(function (e) { ocupado(bt, false); msg(m, "erro", e.message); });
    };
  }
  function telaPendente() {
    var c = st.dados.cliente;
    tela('<span class="olho">Cadastro recebido</span><h1>Quase lá, ' + esc(primeiro(c.nome)) + "</h1>" +
      '<p class="lead">O Richard combina a consultoria com você e libera o acesso. Assim que estiver liberado, você recebe um aviso e já pode mandar o primeiro vídeo.</p>' +
      '<div class="cartao calmo"><h3>Enquanto isso, prepare o vídeo</h3><ol class="passos"><li>Filme de lado ou de trás, com o corpo inteiro e a bola no quadro.</li><li>Até 3 minutos: escolha o trecho que mostra a sua dúvida.</li><li>Grave em 1080p (não em 4K): o envio fica mais rápido.</li></ol></div>' +
      avisosHtml() + '<div class="acoes"><button class="btn btn-linha" type="button" id="btAtualizar">Atualizar</button></div>');
    $("#btAtualizar").onclick = function () { recarregar(); };
    ligarAvisos();
  }

  function telaInicio() {
    var d = st.dados, c = d.cliente, nv = novas(d), esperando = (d.envios || []).filter(function (e) { return e.estado === "recebido"; });
    var h = '<span class="olho">Consultoria</span><h1>Olá, ' + esc(primeiro(c.nome)) + "</h1>";
    if (envioAtivo) h += '<a class="cartao destaque item" href="#/enviar"><div><p class="t">Enviando o seu vídeo…</p><p class="s">Toque para ver o andamento.</p></div><span class="ir">›</span></a>';
    nv.forEach(function (e) {
      h += '<a class="cartao destaque item" href="#/envio/' + esc(e.id) + '" data-nova><div><span class="selo novo">Devolutiva nova</span><p class="t" style="margin-top:8px">' + esc(e.rotuloTema) + (e.tipo === "pergunta" ? " · sua dúvida" : "") + '</p><p class="s">Chegou ' + esc(ha(e.devolutiva.respondidoEm)) + '</p></div><span class="ir">›</span></a>';
    });
    if ((d.interrompidos || []).length && !envioAtivo) h += '<a class="cartao item" href="#/enviar"><div><p class="t">Envio interrompido</p><p class="s">' + esc(d.interrompidos[0].rotuloTema) + " · escolha o mesmo vídeo para continuar.</p></div><span class=\"ir\">›</span></a>";
    h += '<section class="cartao"><p class="olho" style="margin-bottom:6px">Próximo passo</p>';
    if (!d.motivoSemEnvio) h += "<h3>" + (d.envios.length ? "Mande o próximo vídeo" : "Mande o seu primeiro vídeo") + '</h3><p class="det" style="margin-top:4px">Até ' + d.limites.duracaoSeg / 60 + " minutos. Escreva a dúvida para o Richard saber o que olhar.</p>" +
      '<div class="acoes"><a class="btn btn-verm" href="#/enviar">Enviar vídeo</a></div>';
    else h += '<p class="det">' + esc(d.motivoSemEnvio) + "</p>";
    h += "</section>";
    if (esperando.length) h += '<section class="secao"><h2>Com o Richard</h2><ul class="lista">' + esperando.map(function (e) {
      return '<li><a class="item" href="#/envio/' + esc(e.id) + '"><div><p class="t">' + esc(e.rotuloTema) + (e.tipo === "pergunta" ? " · dúvida" : "") + '</p><p class="s">Enviado ' + esc(ha(e.recebidoEm)) + ' · a devolutiva chega aqui</p></div><span class="selo">Aguardando</span></a></li>';
    }).join("") + "</ul></section>";
    h += avisosHtml();
    tela(h);
    ligarAvisos();
  }

  /* ── enviar vídeo ── */
  var form = { tema: "", duvida: "", arquivo: null, duracao: null, desconhecida: false, modo: "link", url: "" };
  /* link do YouTube (para testar sem o armazenamento de vídeo): o player do YouTube sem cookies */
  function idYoutube(url) {
    var m = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/|v\/))([A-Za-z0-9_-]{11})/.exec(String(url || ""));
    return m ? m[1] : null;
  }
  function ytHtml(id, titulo) { return '<div class="yt"><iframe src="https://www.youtube-nocookie.com/embed/' + esc(id) + '?rel=0&playsinline=1" title="' + esc(titulo || "Vídeo") + '" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe></div>'; }
  function lerDuracao(arquivo) {
    return new Promise(function (ok) {
      var v = document.createElement("video"), url = URL.createObjectURL(arquivo), feito = false;
      function fim(x) { if (feito) return; feito = true; URL.revokeObjectURL(url); ok(x); }
      v.preload = "metadata"; v.muted = true;
      v.onloadedmetadata = function () { fim(isFinite(v.duration) && v.duration > 0 ? v.duration : null); };
      v.onerror = function () { fim(null); };
      setTimeout(function () { fim(null); }, 8000);
      v.src = url;
    });
  }
  function telaEnviar() {
    var d = st.dados;
    if (envioAtivo) return telaProgresso();
    var inter = (d.interrompidos || [])[0];
    if (d.motivoSemEnvio && !inter) return tela('<span class="olho">Enviar</span><h1>Enviar vídeo</h1><div class="cartao calmo"><p>' + esc(d.motivoSemEnvio) + "</p></div>");
    var h = '<span class="olho">Enviar</span><h1>Enviar vídeo</h1>';
    if (inter) h += '<div class="cartao destaque" data-interrompido><h3>Continuar o envio de ' + esc(inter.rotuloTema) + '</h3><p class="det" style="margin-top:4px">O envio parou no meio. Escolha o mesmo vídeo (' + esc(mb(inter.tamanho)) + ") e ele continua de onde parou.</p>" +
      '<label class="btn btn-verm" style="margin-top:12px">Escolher o mesmo vídeo<input type="file" accept="video/*" id="arqRetomar" class="sr"></label>' +
      '<div class="acoes"><button class="link" type="button" id="btDescartar">Descartar este envio</button></div><p id="mRet" class="msg" role="status" hidden></p></div>';
    if (!d.motivoSemEnvio) {
      var link = form.modo === "link";
      h += '<form id="fEnv" novalidate class="cartao"><p class="campo" style="margin-top:0">Sobre o que é o vídeo?</p><div class="chips" role="group" aria-label="Tema">' +
        d.temas.map(function (t) { return '<button type="button" class="chip" data-tema="' + esc(t[0]) + '" aria-pressed="' + (form.tema === t[0]) + '">' + esc(t[1]) + "</button>"; }).join("") + "</div>" +
        '<label class="campo">Sua dúvida<textarea name="duvida" maxlength="1500" placeholder="Ex.: perco força no segundo saque quando estou cansado.">' + esc(form.duvida) + "</textarea></label>" +
        '<p class="campo">Vídeo</p><div class="chips" role="group" aria-label="Como mandar o vídeo"><button type="button" class="chip" data-modo="link" aria-pressed="' + link + '">Link do YouTube</button>' +
        '<button type="button" class="chip" data-modo="arquivo" aria-pressed="' + !link + '">Arquivo do celular</button></div>' +
        (link ? '<label class="campo">Link do vídeo no YouTube<input name="url" inputmode="url" autocomplete="off" placeholder="https://youtu.be/…" value="' + esc(form.url) + '">' +
          '<small>No YouTube, publique como <b>Não listado</b>: só quem tem o link vê. Até ' + d.limites.duracaoSeg / 60 + " minutos, ou diga na dúvida o trecho (ex.: de 1:20 a 2:40).</small></label>" :
          '<p class="det" style="margin-top:8px">Até ' + d.limites.duracaoSeg / 60 + " minutos e " + d.limites.videoMB + " MB. Só você e o Richard veem.</p>" +
          '<label class="btn btn-linha btn-largo" style="margin-top:8px">' + (form.arquivo ? "Trocar o vídeo" : "Escolher o vídeo") + '<input type="file" accept="video/*" id="arqVideo" class="sr"></label>' +
          (form.arquivo ? '<p class="arquivo" data-arquivo>' + esc(form.arquivo.name) + " · " + esc(mb(form.arquivo.size)) + (form.duracao ? " · " + minSeg(form.duracao) : "") + "</p>" : "")) +
        '<p id="mEnv" class="msg" role="status" hidden></p><div class="acoes"><button class="btn btn-verm btn-largo" type="submit" id="btEnviar">Enviar para o Richard</button></div></form>';
    }
    tela(h, true);
    cada("[data-tema]", function (b) { b.onclick = function () { form.tema = b.getAttribute("data-tema"); cada("[data-tema]", function (x) { x.setAttribute("aria-pressed", String(x === b)); }); }; });
    var f = $("#fEnv");
    if (f) {
      f.duvida.oninput = function () { form.duvida = f.duvida.value; };
      if (f.url) f.url.oninput = function () { form.url = f.url.value; msg($("#mEnv"), "erro", ""); };
      cada("[data-modo]", function (b) { b.onclick = function () { form.modo = b.getAttribute("data-modo"); telaEnviar(); }; });
      var av = $("#arqVideo"); if (av) av.onchange = function (ev) { escolher(ev.target.files[0]); };
      f.onsubmit = function (ev) { ev.preventDefault(); iniciarEnvio(); };
    }
    var ar = $("#arqRetomar");
    if (ar) ar.onchange = function (ev) { retomar(inter, ev.target.files[0]); };
    var ds = $("#btDescartar");
    if (ds) ds.onclick = function () { ocupado(ds, true, "Descartando…"); api("POST", { acao: "envioCancelar", envioId: inter.id }).then(function () { toast("Envio descartado."); return recarregar(); }).catch(function (e) { ocupado(ds, false); toast(e.message); }); };
  }
  function escolher(arq) {
    var m = $("#mEnv"), d = st.dados;
    if (!arq) return;
    if (!/^video\//.test(arq.type || "") && !/\.(mov|mp4|m4v|webm)$/i.test(arq.name)) return msg(m, "erro", "Escolha um arquivo de vídeo.");
    if (arq.size > d.limites.videoMB * 1048576) return msg(m, "erro", "O vídeo tem " + mb(arq.size) + ". O limite é " + d.limites.videoMB + " MB: grave em 1080p (não em 4K) ou corte um trecho menor.");
    msg(m, "aviso", "Lendo o vídeo…");
    lerDuracao(arq).then(function (dur) {
      if (dur && dur > d.limites.duracaoSeg + 5) { form.arquivo = null; telaEnviar(); return msg($("#mEnv"), "erro", "O vídeo tem " + minSeg(dur) + ". Corte o trecho que mostra a sua dúvida (até " + d.limites.duracaoSeg / 60 + " minutos) e escolha de novo."); }
      form.arquivo = arq; form.duracao = dur; form.desconhecida = !dur;
      telaEnviar();
    });
  }
  function tipoDoArquivo(arq) {
    if (arq.type) return arq.type;
    return /\.mov$/i.test(arq.name) ? "video/quicktime" : /\.webm$/i.test(arq.name) ? "video/webm" : /\.m4v$/i.test(arq.name) ? "video/x-m4v" : "video/mp4";
  }
  function iniciarEnvio() {
    var m = $("#mEnv"), bt = $("#btEnviar");
    if (!form.tema) return msg(m, "erro", "Escolha sobre o que é o vídeo.");
    if (form.duvida.trim().length < 3) return msg(m, "erro", "Escreva a sua dúvida: o que você quer que o Richard olhe.");
    if (form.modo === "link") {
      if (!idYoutube(form.url)) return msg(m, "erro", "Cole o link de um vídeo do YouTube (youtube.com/watch?v=… ou youtu.be/…).");
      ocupado(bt, true, "Enviando…");
      return api("POST", { acao: "envioLink", tema: form.tema, duvida: form.duvida, url: form.url.trim() }).then(function (r) {
        form = { tema: "", duvida: "", arquivo: null, duracao: null, desconhecida: false, modo: "link", url: "" };
        toast("Vídeo enviado. O Richard recebeu um aviso.");
        return carregar().then(function () { location.hash = "#/envio/" + r.envio.id; rota(); });
      }).catch(function (e) { ocupado(bt, false); msg(m, "erro", e.message); });
    }
    if (!form.arquivo) return msg(m, "erro", "Escolha o vídeo.");
    ocupado(bt, true, "Preparando…");
    var arq = form.arquivo;
    api("POST", { acao: "envioIniciar", tema: form.tema, duvida: form.duvida, contentType: tipoDoArquivo(arq), tamanho: arq.size, duracaoSeg: form.duracao, duracaoDesconhecida: form.desconhecida })
      .then(function (r) { subir(r.envioId, r.sessao, arq); })
      .catch(function (e) { ocupado(bt, false); msg(m, "erro", e.message); });
  }
  function retomar(inter, arq) {
    var m = $("#mRet");
    if (!arq) return;
    if (arq.size !== inter.tamanho) return msg(m, "erro", "Este não é o mesmo vídeo (" + mb(arq.size) + "). Escolha o vídeo de " + mb(inter.tamanho) + " ou descarte o envio.");
    msg(m, "aviso", "Retomando…");
    api("POST", { acao: "envioRetomar", envioId: inter.id }).then(function (r) { subir(inter.id, r.sessao, arq); }).catch(function (e) { msg(m, "erro", e.message); });
  }
  function subir(envioId, sessao, arq) {
    envioAtivo = { envioId: envioId, controle: {}, enviados: 0, total: arq.size, estado: "", nome: arq.name };
    telaProgresso();
    window.addEventListener("beforeunload", avisoSaida);
    QLEnvio.enviar(sessao, arq, {
      controle: envioAtivo.controle,
      aoProgresso: function (n, t) { if (!envioAtivo) return; envioAtivo.enviados = n; envioAtivo.total = t; pintarProgresso(); },
      aoEstado: function (t) { if (!envioAtivo) return; envioAtivo.estado = t; pintarProgresso(); },
    }).then(function () {
      if (envioAtivo) { envioAtivo.estado = "Conferindo o vídeo…"; pintarProgresso(); }
      return api("POST", { acao: "envioConcluir", envioId: envioId });
    }).then(function (r) {
      envioAtivo = null; window.removeEventListener("beforeunload", avisoSaida);
      form = { tema: "", duvida: "", arquivo: null, duracao: null, desconhecida: false, modo: "link", url: "" };
      toast("Vídeo enviado. O Richard recebeu um aviso.");
      return carregar().then(function () { location.hash = "#/envio/" + r.envio.id; rota(); });
    }).catch(function (e) {
      var cancelado = e && e.message === "cancelado";
      envioAtivo = null; window.removeEventListener("beforeunload", avisoSaida);
      if (cancelado) { toast("Envio pausado. Para continuar, escolha o mesmo vídeo em Enviar."); return recarregar(); }
      carregar().then(function () { if (location.hash.indexOf("enviar") >= 0) { rota(); msg($("#mRet") || $("#mEnv"), "erro", e.message); } else toast(e.message); });
    });
  }
  function avisoSaida(ev) { ev.preventDefault(); ev.returnValue = ""; }
  function telaProgresso() {
    tela('<span class="olho">Enviar</span><h1>Enviando o vídeo</h1><div class="cartao" data-progresso><p class="t" id="pgNome"></p><div class="prog" aria-hidden="true"><i id="pgBarra"></i></div>' +
      '<p class="det" id="pgTexto" style="margin-top:8px"></p><p class="det" id="pgEstado" role="status" style="margin-top:4px"></p>' +
      '<p class="det" style="margin-top:12px">Deixe esta tela aberta. Se a internet cair, o envio continua de onde parou quando o sinal voltar.</p>' +
      '<div class="acoes"><button class="btn btn-linha btn-pq" type="button" id="btPausar">Pausar o envio</button></div></div>', true);
    $("#btPausar").onclick = function () { if (envioAtivo) envioAtivo.controle.cancelar(); };
    pintarProgresso();
  }
  function pintarProgresso() {
    var a = envioAtivo, b = $("#pgBarra"); if (!a || !b) return;
    var pct = a.total ? Math.floor((a.enviados / a.total) * 100) : 0;
    b.style.width = pct + "%";
    $("#pgNome").textContent = a.nome;
    $("#pgTexto").textContent = pct + "% · " + mb(a.enviados) + " de " + mb(a.total);
    $("#pgEstado").textContent = a.estado || "";
  }

  /* ── devolutivas ── */
  function linhaEnvio(e) {
    var selo = e.estado === "respondido" ? (e.entendidoEm ? '<span class="selo ok">Respondido</span>' : '<span class="selo novo">Nova</span>') : '<span class="selo">Aguardando</span>';
    return '<li><a class="item" href="#/envio/' + esc(e.id) + '"><div><p class="t">' + esc(e.rotuloTema) + (e.tipo === "pergunta" ? " · dúvida" : "") + '</p><p class="s">' +
      (e.estado === "respondido" ? "Devolutiva em " + dataBR(e.devolutiva.respondidoEm) : "Enviado " + ha(e.recebidoEm)) + "</p></div>" + selo + "</a></li>";
  }
  function telaDevolutivas() {
    var l = st.dados.envios || [];
    tela('<span class="olho">Devolutivas</span><h1>Seus envios</h1>' + (l.length ? '<ul class="lista">' + l.map(linhaEnvio).join("") + "</ul>" :
      '<div class="cartao calmo"><p>Nenhum envio ainda. Quando você mandar um vídeo, ele e a devolutiva do Richard ficam aqui.</p><div class="acoes"><a class="btn btn-verm" href="#/enviar">Enviar vídeo</a></div></div>'));
  }
  function devolutivaHtml(e) {
    var d = e.devolutiva; if (!d) return "";
    return '<section class="cartao bloco-dev" data-devolutiva><p class="olho" style="margin-bottom:4px">Devolutiva do Richard · ' + dataBR(d.respondidoEm) + "</p>" +
      (d.youtube ? '<div data-yt-resp>' + ytHtml(d.youtube.id, "Devolutiva do Richard") + "</div>" : "") +
      (d.midia ? '<div data-midia-resp><button class="btn btn-verm btn-pq" type="button" id="btResp">' + (d.midia.tipo === "audio" ? "Ouvir a devolutiva" : "Assistir à devolutiva") + "</button></div>" : "") +
      (d.viu ? "<h3>O que eu vi</h3><p>" + esc(d.viu) + "</p>" : "") + (d.texto ? "<h3>" + (d.viu ? "Recado" : "Devolutiva") + "</h3><p>" + esc(d.texto) + "</p>" : "") +
      (d.treinar && d.treinar.length ? '<h3>O que treinar</h3><ol class="treinar">' + d.treinar.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ol>" : "") + "</section>";
  }
  function ligarMidias(e, alvoVideo) {
    var bv = $("#btVideo");
    if (bv) bv.onclick = function () {
      ocupado(bv, true, "Abrindo…");
      api("POST", { acao: "verVideo", envioId: e.id }).then(function (r) {
        var box = $("[data-video]"); box.innerHTML = '<video controls playsinline preload="metadata" src="' + esc(r.url) + '"></video><p class="det" style="margin-top:6px">Não tocou? <a href="' + esc(r.url) + '" target="_blank" rel="noopener">Abrir em outra aba</a>.</p>';
      }).catch(function (x) { ocupado(bv, false); toast(x.message); });
    };
    var br = $("#btResp");
    if (br) br.onclick = function () {
      ocupado(br, true, "Abrindo…");
      api("POST", { acao: "verResposta", envioId: e.id }).then(function (r) {
        var tag = r.tipo === "audio" ? "audio" : "video";
        $("[data-midia-resp]").innerHTML = "<" + tag + ' controls playsinline preload="metadata" src="' + esc(r.url) + '"></' + tag + '><p class="det" style="margin-top:6px">Não tocou? <a href="' + esc(r.url) + '" target="_blank" rel="noopener">Abrir em outra aba</a>.</p>';
      }).catch(function (x) { ocupado(br, false); toast(x.message); });
    };
  }
  function cabecalhoEnvio(e, voltar) {
    return '<p><a class="link" href="' + voltar + '">‹ Voltar</a></p><span class="olho" style="margin-top:16px">' + esc(e.rotuloTema) + (e.tipo === "pergunta" ? " · dúvida" : "") + "</span>" +
      "<h1>" + (e.estado === "respondido" ? "Devolutiva" : "Com o Richard") + "</h1>" + cartaoDuvida(e);
  }
  function cartaoDuvida(e) {
    return '<section class="cartao" data-duvida><p class="olho" style="margin-bottom:4px">' + (e.tipo === "pergunta" ? "Sua dúvida" : "Sua dúvida · enviado em " + dataBR(e.recebidoEm)) + '</p><p style="white-space:pre-wrap">' + esc(e.duvida) + "</p>" +
      (e.refEnvio ? '<p class="det" style="margin-top:8px"><a href="#/envio/' + esc(e.refEnvio) + '">Ver a devolutiva sobre a qual é a dúvida</a></p>' : "") +
      (e.youtube ? '<div data-video>' + ytHtml(e.youtube.id, "Vídeo enviado") + "</div>" : "") +
      (e.video ? (e.video.apagado ? '<p class="det" style="margin-top:10px">O vídeo foi apagado ' + st.dados.limites.guardarDias + " dias depois da devolutiva.</p>" :
        '<div data-video><button class="btn btn-linha btn-pq" type="button" id="btVideo" style="margin-top:12px">Ver o vídeo' + (e.video.duracaoSeg ? " (" + minSeg(e.video.duracaoSeg) + ")" : "") + "</button></div>") : "") + "</section>";
  }
  function telaEnvio(id) {
    var e = (st.dados.envios || []).filter(function (x) { return x.id === id; })[0];
    if (!e) return tela('<p><a class="link" href="#/devolutivas">‹ Devolutivas</a></p><div class="cartao calmo"><p>Envio não encontrado.</p></div>');
    var h = cabecalhoEnvio(e, "#/devolutivas");
    if (e.estado !== "respondido") h += '<div class="cartao calmo"><p>O Richard recebeu e vai responder por aqui. Você recebe um aviso quando a devolutiva chegar.</p></div>';
    else {
      h += devolutivaHtml(e);
      if (e.apagarVideoEm) h += '<p class="det" style="margin-top:10px">O seu vídeo fica guardado até ' + dataLonga(e.apagarVideoEm) + ". A devolutiva fica para sempre.</p>";
      h += '<div class="acoes">' + (e.entendidoEm ? '<span class="selo ok">Você marcou como entendido</span>' : '<button class="btn btn-verm" type="button" id="btEntendi">Entendi</button>') +
        '<button class="btn btn-linha" type="button" id="btDuvida">Tenho uma dúvida</button></div>' +
        '<form id="fDuv" class="cartao" hidden novalidate><label class="campo" style="margin-top:0">Sua dúvida sobre esta devolutiva<textarea name="texto" maxlength="1500"></textarea></label><p id="mDuv" class="msg" role="status" hidden></p>' +
        '<div class="acoes"><button class="btn btn-verm" type="submit" id="btMandarDuv">Mandar a dúvida</button></div></form>';
    }
    tela(h);
    ligarMidias(e);
    var be = $("#btEntendi");
    if (be) be.onclick = function () { ocupado(be, true); api("POST", { acao: "entendi", envioId: id }).then(function () { return recarregar(); }).catch(function (x) { ocupado(be, false); toast(x.message); }); };
    var bd = $("#btDuvida"), fd = $("#fDuv");
    if (bd) bd.onclick = function () { fd.hidden = false; fd.texto.focus(); };
    if (fd) fd.onsubmit = function (ev) {
      ev.preventDefault();
      var bt = $("#btMandarDuv"); ocupado(bt, true, "Mandando…");
      api("POST", { acao: "pergunta", envioId: id, texto: fd.texto.value }).then(function (r) { toast("Dúvida enviada ao Richard."); return carregar().then(function () { location.hash = "#/envio/" + r.envio.id; }); })
        .catch(function (x) { ocupado(bt, false); msg($("#mDuv"), "erro", x.message); });
    };
  }

  /* ── avisos no celular ── */
  var pushEstado = null;
  function avisosHtml() { return '<div id="boxAvisos"></div>'; }
  function ligarAvisos() {
    var box = $("#boxAvisos"); if (!box || !window.QLPush) return;
    if (pushEstado === null) { pushEstado = "carregando"; window.QLPush.estado().then(function (s) { pushEstado = s; ligarAvisos(); }); return; }
    if (pushEstado === "carregando" || pushEstado === "ativo") { box.innerHTML = pushEstado === "ativo" ? '<p class="det" style="margin-top:22px">Avisos no celular ligados.</p>' : ""; return; }
    var motivo = window.QLPush.motivo();
    box.innerHTML = '<section class="cartao"><h3>Avisos no celular</h3><p class="det" style="margin-top:4px">' + (st.dados && st.dados.papel === "richard" ? "Receba um aviso quando chegar um vídeo ou um cliente novo." : "Receba um aviso quando a devolutiva chegar.") + "</p>" +
      (motivo ? '<p class="det" style="margin-top:8px">' + esc(motivo) + "</p>" : '<div class="acoes"><button class="btn btn-linha btn-pq" type="button" id="btAvisos">Ativar avisos</button></div>') + "</section>";
    var b = $("#btAvisos");
    if (b) b.onclick = function () {
      ocupado(b, true, "Ativando…");
      st.usuario.getIdToken().then(function (t) { return window.QLPush.ativar({ app: "consultoria", token: t, url: "/richard/" }); })
        .then(function () { pushEstado = "ativo"; toast("Avisos ligados neste aparelho."); ligarAvisos(); })
        .catch(function (e) { ocupado(b, false); toast(e.message); });
    };
  }

  /* ══════════════ Richard ══════════════ */
  function rotaRichard(h) {
    var d = st.dados, aba = h[0] || "fila", pend = d.clientes.filter(function (c) { return c.estado === "pendente"; }).length;
    var mapa = { responder: "fila", ver: "clientes", cliente: "clientes" };
    barra([{ id: "fila", rot: "Fila", href: "#/fila", n: d.fila.length }, { id: "clientes", rot: "Clientes", href: "#/clientes", n: pend }, { id: "ajustes", rot: "Ajustes", href: "#/ajustes" }], mapa[aba] || aba);
    if (aba === "responder" && h[1]) return telaResponder(h[1]);
    if (aba === "clientes") return telaClientes();
    if (aba === "cliente" && h[1]) return telaFicha(h[1]);
    if (aba === "ver" && h[1] && h[2]) return telaVerEnvio(h[1], h[2]);
    if (aba === "ajustes") return telaAjustes();
    return telaFila();
  }
  function telaFila() {
    var f = st.dados.fila;
    var h = '<span class="olho">Fila</span><h1>' + (f.length ? f.length + (f.length === 1 ? " envio aguardando" : " envios aguardando") : "Fila em dia") + "</h1>" +
      '<p class="lead">Do mais antigo para o mais novo. Prazo de ' + st.dados.limites.prazoDias + " dias a partir do envio.</p>";
    h += f.length ? '<ul class="lista">' + f.map(function (e) {
      return '<li><a class="item" href="#/responder/' + esc(e.id) + '" data-fila="' + esc(e.id) + '"><div><p class="t">' + esc(e.cliente) + " · " + esc(e.rotuloTema) + (e.tipo === "pergunta" ? " · dúvida" : "") + '</p><p class="s">Enviado ' + esc(ha(e.recebidoEm)) +
        (e.duracaoSeg ? " · " + minSeg(e.duracaoSeg) : e.youtube ? " · YouTube" : "") + '</p></div><span class="selo ' + esc(e.prazo.estado) + '">' + esc(e.prazo.rotulo) + "</span></a></li>";
    }).join("") + "</ul>" : '<div class="cartao calmo"><p>Nenhum vídeo esperando resposta. Quando chegar um, ele aparece aqui e você recebe um aviso.</p></div>';
    h += '<div class="numeros"><div><b>' + f.length + '</b><span>na fila</span></div><div><b>' + st.dados.respondidos + '</b><span>respondidos</span></div><div><b>' + st.dados.clientes.filter(function (c) { return c.estado === "ativo"; }).length + "</b><span>clientes ativos</span></div></div>";
    tela(h);
  }

  /* gravação de áudio pelo navegador */
  var grav = { rec: null, partes: [], blob: null, arquivo: null, t0: 0, tmr: null };
  function tipoGravacao() {
    var op = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"];
    for (var i = 0; i < op.length; i++) if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(op[i])) return op[i];
    return "";
  }
  function telaResponder(id) {
    var item = st.dados.fila.filter(function (x) { return x.id === id; })[0];
    if (!item) return tela('<p><a class="link" href="#/fila">‹ Fila</a></p><div class="cartao calmo"><p>Este envio não está mais na fila.</p></div>');
    tela('<p class="carregando">Abrindo…</p>');
    api("POST", { acao: "cliente", uid: item.uid }).then(function (r) {
      var e = r.envios.filter(function (x) { return x.id === id; })[0], ref = e && e.refEnvio ? r.envios.filter(function (x) { return x.id === e.refEnvio; })[0] : null;
      grav = { rec: null, partes: [], blob: null, arquivo: null, t0: 0, tmr: null };
      var c = r.cliente, idade = idadeDe(c.nascimento);
      var h = '<p><a class="link" href="#/fila">‹ Fila</a></p><span class="olho" style="margin-top:16px">Responder</span><h1>' + esc(c.nome) + "</h1>" +
        '<p class="det" style="margin-top:4px">' + (idade != null ? idade + " anos · " : "") + esc(e.rotuloTema) + (e.tipo === "pergunta" ? " · dúvida sobre uma devolutiva" : "") + ' · <span class="selo ' + esc(item.prazo.estado) + '">' + esc(item.prazo.rotulo) + "</span></p>" +
        (c.objetivo ? '<p class="det" style="margin-top:6px">Objetivo: ' + esc(c.objetivo) + "</p>" : "") +
        cartaoDuvida(e) +
        (ref ? '<details class="cartao"><summary><b>A devolutiva anterior</b> (' + dataBR(ref.devolutiva.respondidoEm) + ")</summary>" + devolutivaHtml(ref).replace('id="btResp"', 'id="btRespRef"') + "</details>" : "") +
        '<form id="fResp" class="cartao" novalidate><h2>Sua devolutiva</h2>' +
        '<p class="campo">Gravação (opcional)<small>Áudio gravado aqui ou um áudio/vídeo do celular.</small></p>' +
        '<div class="gravador" id="gravador"></div>' +
        '<label class="campo">O que eu vi<textarea name="viu" maxlength="5000" placeholder="Ex.: o lançamento cai para trás e você perde a perna de apoio."></textarea></label>' +
        '<label class="campo">Recado<textarea name="texto" maxlength="5000" placeholder="O que você quer dizer para o atleta."></textarea></label>' +
        '<label class="campo">Ou um vídeo seu no YouTube (opcional)<input name="linkVideo" inputmode="url" autocomplete="off" placeholder="https://youtu.be/…"><small>Publique como Não listado.</small></label>' +
        '<p class="campo">O que treinar<small>Um exercício por linha.</small></p><div class="treinar-ed" id="treinar">' + [0, 1, 2].map(function () { return '<input maxlength="160" placeholder="Ex.: lançamento com alvo, 3 séries de 10">'; }).join("") + "</div>" +
        '<div class="acoes"><button class="link" type="button" id="btMaisTreino">+ outra linha</button></div>' +
        '<div id="pgResp" hidden><div class="prog"><i id="pgRespBarra"></i></div><p class="det" id="pgRespTexto" style="margin-top:6px"></p></div>' +
        '<p id="mResp" class="msg" role="status" hidden></p><div class="acoes"><button class="btn btn-verm btn-largo" type="submit" id="btResponder">Enviar devolutiva</button></div></form>';
      tela(h);
      ligarMidias(e);
      var brr = $("#btRespRef"); if (brr && ref) brr.onclick = function () { api("POST", { acao: "verResposta", envioId: ref.id }).then(function (x) { brr.outerHTML = (x.tipo === "audio" ? "<audio" : "<video") + ' controls src="' + esc(x.url) + '"></' + (x.tipo === "audio" ? "audio>" : "video>"); }).catch(function (x) { toast(x.message); }); };
      pintarGravador();
      $("#btMaisTreino").onclick = function () { var i = document.createElement("input"); i.maxLength = 160; $("#treinar").appendChild(i); i.focus(); };
      $("#fResp").onsubmit = function (ev) { ev.preventDefault(); enviarDevolutiva(e, item); };
    }).catch(function (x) { tela('<p><a class="link" href="#/fila">‹ Fila</a></p><div class="msg msg-erro">' + esc(x.message) + "</div>"); });
  }
  function pintarGravador() {
    var g = $("#gravador"); if (!g) return;
    var podeGravar = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && tipoGravacao());
    if (grav.rec) { g.innerHTML = '<span class="gravando" id="tGrav">● Gravando 0:00</span><button class="btn btn-verm btn-pq" type="button" id="btParar">Parar</button>'; $("#btParar").onclick = pararGravacao; return; }
    if (grav.arquivo) {
      var url = URL.createObjectURL(grav.arquivo), video = /^video\//.test(grav.arquivo.type);
      g.innerHTML = '<div style="width:100%">' + (video ? '<video controls playsinline src="' + url + '"></video>' : '<audio controls src="' + url + '"></audio>') + '<p class="det" data-gravacao>' + esc(grav.arquivo.name || "Gravação") + " · " + mb(grav.arquivo.size) + '</p><div class="acoes"><button class="link" type="button" id="btTirarGrav">Tirar a gravação</button></div></div>';
      $("#btTirarGrav").onclick = function () { grav.arquivo = null; pintarGravador(); };
      return;
    }
    g.innerHTML = (podeGravar ? '<button class="btn btn-linha btn-pq" type="button" id="btGravar">● Gravar áudio</button>' : "") +
      '<label class="btn btn-linha btn-pq">Escolher áudio ou vídeo<input type="file" accept="audio/*,video/*" id="arqResp" class="sr"></label>';
    var bg = $("#btGravar"); if (bg) bg.onclick = iniciarGravacao;
    $("#arqResp").onchange = function (ev) { var a = ev.target.files[0]; if (a) { grav.arquivo = a; pintarGravador(); } };
  }
  function iniciarGravacao() {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
      var tipo = tipoGravacao(), rec = new MediaRecorder(s, { mimeType: tipo });
      grav.partes = []; grav.rec = rec; grav.t0 = Date.now();
      rec.ondataavailable = function (ev) { if (ev.data && ev.data.size) grav.partes.push(ev.data); };
      rec.onstop = function () {
        s.getTracks().forEach(function (t) { t.stop(); });
        var base = tipo.split(";")[0], ext = base === "audio/mp4" ? "m4a" : base === "audio/ogg" ? "ogg" : "webm";
        var blob = new Blob(grav.partes, { type: base });
        try { grav.arquivo = new File([blob], "devolutiva." + ext, { type: base }); } catch (x) { blob.name = "devolutiva." + ext; grav.arquivo = blob; }
        grav.rec = null; clearInterval(grav.tmr); pintarGravador();
      };
      rec.start(1000);
      pintarGravador();
      grav.tmr = setInterval(function () { var t = $("#tGrav"); if (t) t.textContent = "● Gravando " + minSeg((Date.now() - grav.t0) / 1000); }, 500);
    }).catch(function () { toast("Não foi possível usar o microfone. Libere o acesso nas configurações do navegador."); });
  }
  function pararGravacao() { if (grav.rec && grav.rec.state !== "inactive") grav.rec.stop(); }
  function enviarDevolutiva(e, item) {
    var f = $("#fResp"), m = $("#mResp"), bt = $("#btResponder");
    var treinar = []; cada("#treinar input", function (i) { if (i.value.trim()) treinar.push(i.value.trim()); });
    if (grav.rec) return msg(m, "erro", "Pare a gravação antes de enviar.");
    var link = f.linkVideo.value.trim();
    if (link && !idYoutube(link)) return msg(m, "erro", "O link do vídeo não é um link do YouTube.");
    if (!grav.arquivo && !link && !f.viu.value.trim() && !f.texto.value.trim()) return msg(m, "erro", "Escreva a devolutiva, grave um áudio ou cole o link de um vídeo.");
    ocupado(bt, true, "Enviando…"); msg(m, "aviso", "");
    var corpo = { acao: "responder", envioId: e.id, viu: f.viu.value, texto: f.texto.value, treinar: treinar, linkVideo: link };
    var passo = Promise.resolve();
    if (grav.arquivo) {
      var arq = grav.arquivo, ct = (arq.type || "").split(";")[0] || "audio/webm";
      passo = api("POST", { acao: "respostaIniciar", envioId: e.id, contentType: ct, tamanho: arq.size }).then(function (r) {
        $("#pgResp").hidden = false;
        corpo.midia = { caminho: r.caminho };
        return QLEnvio.enviar(r.sessao, arq, {
          aoProgresso: function (n, t) { var p = Math.floor((n / t) * 100); $("#pgRespBarra").style.width = p + "%"; $("#pgRespTexto").textContent = "Enviando a gravação: " + p + "%"; },
          aoEstado: function (t) { if (t) $("#pgRespTexto").textContent = t; },
        });
      });
    }
    passo.then(function () { return api("POST", corpo); }).then(function () {
      toast("Devolutiva enviada para " + primeiro(item.cliente) + ".");
      return carregar().then(function () { location.hash = "#/fila"; rota(); });
    }).catch(function (x) { ocupado(bt, false); msg(m, "erro", x.message); });
  }

  function telaClientes() {
    var l = st.dados.clientes;
    var pend = l.filter(function (c) { return c.estado === "pendente"; }), outros = l.filter(function (c) { return c.estado !== "pendente"; });
    var h = '<span class="olho">Clientes</span><h1>Clientes</h1>';
    if (pend.length) h += '<section class="secao"><h2>Pedindo para entrar</h2><p class="det">Combine a consultoria e libere. O cliente recebe um aviso.</p>' + pend.map(function (c) {
      var i = idadeDe(c.nascimento);
      return '<div class="cartao" data-pendente="' + esc(c.uid) + '"><h3>' + esc(c.nome) + '</h3><p class="det" style="margin-top:4px">' + (i != null ? i + " anos · " : "") + esc(c.email) + " · pediu " + esc(ha(c.criadoEm)) + "</p>" +
        (c.objetivo ? '<p style="margin-top:8px">' + esc(c.objetivo) + "</p>" : "") +
        (c.menor && c.responsavel ? '<p class="det" style="margin-top:8px">Menor de idade · responsável: ' + esc(c.responsavel.nome) + " (" + esc(c.responsavel.email) + "), autorizou em " + dataLonga(c.responsavel.aceiteEm) + "</p>" : "") +
        '<div class="acoes"><button class="btn btn-verm btn-pq" type="button" data-liberar="' + esc(c.uid) + '">Liberar</button><a class="btn btn-linha btn-pq" href="#/cliente/' + esc(c.uid) + '">Ver ficha</a></div></div>';
    }).join("") + "</section>";
    h += '<section class="secao"><h2>Todos</h2>' + (outros.length ? '<ul class="lista">' + outros.map(function (c) {
      return '<li><a class="item" href="#/cliente/' + esc(c.uid) + '"><div><p class="t">' + esc(c.nome) + '</p><p class="s">' + c.respondidos + (c.respondidos === 1 ? " devolutiva" : " devolutivas") + (c.naFila ? " · " + c.naFila + " na fila" : "") + "</p></div>" +
        (c.estado === "pausado" ? '<span class="selo">Pausado</span>' : '<span class="selo ok">Ativo</span>') + "</a></li>";
    }).join("") + "</ul>" : '<p class="det" style="margin-top:8px">Ainda nenhum cliente liberado. Mande o endereço teamyoda.com.br/richard para quem vai começar.</p>') + "</section>";
    tela(h);
    cada("[data-liberar]", function (b) { b.onclick = function () { ocupado(b, true, "Liberando…"); api("POST", { acao: "liberar", uid: b.getAttribute("data-liberar") }).then(function () { toast("Cliente liberado e avisado."); return recarregar(); }).catch(function (x) { ocupado(b, false); toast(x.message); }); }; });
  }
  function telaFicha(uid) {
    tela('<p class="carregando">Abrindo…</p>');
    api("POST", { acao: "cliente", uid: uid }).then(function (r) {
      var c = r.cliente, i = idadeDe(c.nascimento), env = r.envios;
      var h = '<p><a class="link" href="#/clientes">‹ Clientes</a></p><span class="olho" style="margin-top:16px">Ficha do cliente</span><h1>' + esc(c.nome) + "</h1>" +
        '<p class="det" style="margin-top:4px">' + (i != null ? i + " anos · " : "") + esc(c.email) + (c.liberadoEm ? " · cliente desde " + dataLonga(c.liberadoEm) : "") + "</p>" +
        (c.objetivo ? '<p style="margin-top:10px">' + esc(c.objetivo) + "</p>" : "") +
        (c.menor && c.responsavel ? '<p class="det" style="margin-top:8px">Responsável: ' + esc(c.responsavel.nome) + " (" + esc(c.responsavel.email) + "), autorizou em " + dataLonga(c.responsavel.aceiteEm) + "</p>" : "") +
        '<div class="numeros"><div><b>' + env.filter(function (e) { return e.tipo === "video"; }).length + "</b><span>vídeos</span></div><div><b>" + env.filter(function (e) { return e.estado === "respondido"; }).length +
        "</b><span>devolutivas</span></div><div><b>" + env.filter(function (e) { return e.estado === "recebido"; }).length + "</b><span>na fila</span></div></div>" +
        '<div class="acoes">' + (c.estado === "ativo" ? '<button class="btn btn-linha btn-pq" type="button" id="btPausar">Pausar consultoria</button>' : '<button class="btn btn-verm btn-pq" type="button" id="btLiberar">' + (c.estado === "pendente" ? "Liberar" : "Retomar consultoria") + "</button>") + "</div>" +
        '<section class="secao"><h2>Histórico</h2>' + (env.length ? '<ul class="linha-tempo">' + env.map(function (e) {
          var alvo = e.estado === "recebido" ? "#/responder/" + e.id : "#/ver/" + uid + "/" + e.id;
          return '<li><time>' + dataBR(e.recebidoEm || e.criadoEm) + '</time><a href="' + alvo + '">' + (e.estado === "respondido" ? "Devolutiva: " : e.tipo === "pergunta" ? "Dúvida: " : "Vídeo: ") + esc(e.rotuloTema) +
            (e.estado === "recebido" ? " (na fila)" : "") + "</a></li>";
        }).join("") + "</ul>" : '<p class="det" style="margin-top:8px">Nenhum envio ainda.</p>') + "</section>" +
        '<section class="secao"><h2>Anotação privada</h2><p class="det">Só você vê.</p><label class="campo"><span class="sr">Anotação</span><textarea id="txNota" maxlength="8000">' + esc(r.nota) + '</textarea></label>' +
        '<div class="acoes"><button class="btn btn-linha btn-pq" type="button" id="btNota">Salvar anotação</button></div></section>';
      tela(h);
      var bp = $("#btPausar"), bl = $("#btLiberar"), bn = $("#btNota");
      if (bp) bp.onclick = function () { ocupado(bp, true); api("POST", { acao: "pausar", uid: uid }).then(function () { toast("Consultoria pausada."); return carregar(); }).then(function () { telaFicha(uid); }).catch(function (x) { ocupado(bp, false); toast(x.message); }); };
      if (bl) bl.onclick = function () { ocupado(bl, true); api("POST", { acao: "liberar", uid: uid }).then(function () { toast("Consultoria liberada."); return carregar(); }).then(function () { telaFicha(uid); }).catch(function (x) { ocupado(bl, false); toast(x.message); }); };
      bn.onclick = function () { ocupado(bn, true, "Salvando…"); api("POST", { acao: "nota", uid: uid, texto: $("#txNota").value }).then(function () { ocupado(bn, false); toast("Anotação salva."); }).catch(function (x) { ocupado(bn, false); toast(x.message); }); };
    }).catch(function (x) { tela('<p><a class="link" href="#/clientes">‹ Clientes</a></p><div class="msg msg-erro">' + esc(x.message) + "</div>"); });
  }
  function telaVerEnvio(uid, id) {
    tela('<p class="carregando">Abrindo…</p>');
    api("POST", { acao: "cliente", uid: uid }).then(function (r) {
      var e = r.envios.filter(function (x) { return x.id === id; })[0];
      if (!e) return tela('<p><a class="link" href="#/cliente/' + esc(uid) + '">‹ Ficha</a></p><div class="cartao calmo"><p>Envio não encontrado.</p></div>');
      tela(cabecalhoEnvio(e, "#/cliente/" + uid).replace("<h1>", '<p class="det">' + esc(r.cliente.nome) + "</p><h1>") + devolutivaHtml(e) +
        (e.entendidoEm ? '<p class="det" style="margin-top:10px">' + esc(primeiro(r.cliente.nome)) + " marcou como entendido em " + dataLonga(e.entendidoEm) + ".</p>" : ""));
      ligarMidias(e);
    }).catch(function (x) { tela('<div class="msg msg-erro">' + esc(x.message) + "</div>"); });
  }
  function telaAjustes() {
    tela('<span class="olho">Ajustes</span><h1>Ajustes</h1>' +
      '<section class="cartao"><h3>Armazenamento dos vídeos</h3><p class="det" style="margin-top:4px">Uma vez só: libera o envio dos vídeos direto do celular do cliente para o armazenamento privado do Team Yoda. Faça depois de ativar o Storage no Firebase do Team Yoda.</p>' +
      '<p id="mArm" class="msg" role="status" hidden></p><div class="acoes"><button class="btn btn-linha btn-pq" type="button" id="btArm">Preparar armazenamento</button></div></section>' +
      '<section class="cartao"><h3>Endereço para os clientes</h3><p style="margin-top:4px"><b>teamyoda.com.br/richard</b></p><p class="det" style="margin-top:4px">O cliente cria a conta, faz o cadastro e aparece em Clientes para você liberar. Vídeos com devolutiva são apagados depois de ' + st.dados.limites.guardarDias + " dias; a devolutiva fica.</p></section>" +
      avisosHtml());
    var b = $("#btArm");
    b.onclick = function () { ocupado(b, true, "Preparando…"); api("POST", { acao: "prepararArmazenamento" }).then(function (r) { ocupado(b, false); msg($("#mArm"), "ok", "Pronto: o armazenamento " + r.bucket + " aceita os envios do teamyoda.com.br."); }).catch(function (x) { ocupado(b, false); msg($("#mArm"), "erro", x.message); }); };
    ligarAvisos();
  }

  /* ── início ── */
  btSair.onclick = function () { if (auth) auth.signOut(); };
  if (!auth) { tela('<div class="msg msg-erro">Não foi possível conectar agora. Recarregue a página.</div>'); return; }
  auth.onAuthStateChanged(function (u) {
    st.usuario = u; st.dados = null; st.carregado = false; pushEstado = null;
    if (!u) return rota();
    rota();
    carregar().then(rota).catch(function (e) { tela('<div class="msg msg-erro">' + esc(e.message) + '</div><div class="acoes"><button class="btn btn-linha" type="button" onclick="location.reload()">Tentar de novo</button></div>'); });
  });
})();
