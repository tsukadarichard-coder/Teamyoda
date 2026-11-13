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
  var app = document.getElementById("app"), nav = document.getElementById("nav"), btSair = document.getElementById("btSair"), lkEntrar = document.getElementById("lkEntrar"), toastEl = document.getElementById("toast");
  var auth = null;
  try { if (!firebase.apps.length) firebase.initializeApp(MTY_CONFIG); auth = firebase.auth(); } catch (e) { console.error("consultoria: Firebase", e); }
  /* sem conta entrada: #/ é a home de vendas; #/entrar, #/convite (primeiro acesso de quem foi convidado) e #/comecar abrem cada caminho */
  function modoDoHash() { var h = location.hash || ""; return /^#\/entrar/.test(h) ? "entrar" : /^#\/convite/.test(h) ? "primeiro" : /^#\/comecar/.test(h) ? "criar" : "home"; }
  var HASH_DO_MODO = { home: "#/", entrar: "#/entrar", primeiro: "#/convite", criar: "#/comecar" };
  var st = { usuario: null, dados: null, modo: modoDoHash(), carregado: false };
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
    semana: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5L7.5 11"/><circle cx="5" cy="18" r="1.4"/></svg>',
    encontros: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    videos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/></svg>',
    plano: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3"/></svg>',
    rendimento: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
    hoje: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
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
    btSair.hidden = !st.usuario; if (lkEntrar) lkEntrar.hidden = !!st.usuario || st.modo !== "home";
    if (!st.usuario) { barra([]); return telaEntrada(); }
    if (!st.carregado) { barra([]); return tela('<p class="carregando">Carregando…</p>'); }
    var h = location.hash.replace(/^#\/?/, "").split("/"), d = st.dados;
    if (d.papel === "richard") return rotaRichard(h);
    return rotaCliente(h);
  }
  /* listas (fila, clientes, início, devolutivas) se atualizam ao abrir a aba e ao voltar para o app; telas com formulário não são redesenhadas */
  function telaDeLista() { var h = (location.hash.replace(/^#\/?/, "").split("/")[0]) || ""; return ["", "hoje", "fila", "clientes", "inicio", "devolutivas", "semana", "encontros", "plano", "rendimento"].indexOf(h) >= 0; }
  /* não redesenha por cima do que a pessoa está escrevendo */
  function digitando() { return Array.prototype.some.call(app.querySelectorAll("input, textarea"), function (el) { return el.type !== "hidden" && el.type !== "date" && el.type !== "number" && el.value !== el.defaultValue; }); }
  var atualizando = false;
  function atualizarLista() {
    if (!st.usuario || !st.carregado || atualizando || envioAtivo || !telaDeLista()) return;
    atualizando = true;
    carregar().then(function () { atualizando = false; if (telaDeLista() && !envioAtivo && !digitando()) rota(); }).catch(function () { atualizando = false; });
  }
  window.addEventListener("hashchange", function () { if (!st.usuario) st.modo = modoDoHash(); rota(); atualizarLista(); });
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") atualizarLista(); });

  /* ══════════════ Entrada ══════════════ */
  /* ══════════════ Home de vendas (quem chega sem conta entrada) ══════════════
     Sem preço nem compra no app: o Richard combina o valor por fora; os botões levam a "Quero começar" (conta + cadastro, fica
     pendente até ele liberar) ou ao WhatsApp. Nada de depoimento inventado. */
  function telaHome() {
    var zap = typeof MTY_WHATSAPP !== "undefined" && MTY_WHATSAPP ? "https://wa.me/" + MTY_WHATSAPP + "?text=" + encodeURIComponent("Oi, Richard! Quero saber da consultoria de tênis por vídeo.") : "";
    var btZap = function (cls) { return zap ? '<a class="btn ' + cls + '" href="' + zap + '" target="_blank" rel="noopener" data-cta="whatsapp">Falar com o Richard</a>' : ""; };
    tela('<section class="h-heroi" data-home><img src="/assets/foto-forehand.jpg" alt="" width="1179" height="804"><div class="in">' +
      '<span class="olho">Consultoria de tênis por vídeo</span><h1>Mande o vídeo. Receba o que treinar.</h1>' +
      '<p class="lead">Você filma o golpe ou o jogo e conta a sua dúvida. O Richard Tsukada assiste, responde com o que viu e monta os exercícios da semana.</p>' +
      '<div class="acoes"><button class="btn btn-verm" type="button" data-modo-ent="criar" data-cta="comecar-topo">Quero começar</button>' + btZap("btn-linha") + "</div>" +
      '<p class="entrar">Já é cliente? <button class="link" type="button" data-modo-ent="entrar">Entrar</button> · Recebeu o convite? <button class="link" type="button" data-modo-ent="primeiro">Primeiro acesso</button></p></div></section>' +

      '<section class="h-sec"><span class="olho">Como funciona</span><h2>Quatro passos, tudo pelo celular.</h2><ol class="h-passos">' +
      "<li><b>Filme</b><span>Até 3 minutos do golpe ou do jogo. O celular basta; de lado ou de trás, com o corpo inteiro no quadro.</span></li>" +
      "<li><b>Conte a dúvida</b><span>Escreva o que você quer que o Richard olhe. Pode mandar o link do YouTube ou o arquivo do celular.</span></li>" +
      "<li><b>Receba a devolutiva</b><span>Em até 3 dias: o que ele viu, um recado em texto, áudio ou vídeo, e o que treinar.</span></li>" +
      "<li><b>Treine e mande o próximo</b><span>Ficou dúvida? Pergunte sobre a devolutiva. Tudo fica guardado para ver a evolução.</span></li></ol></section>" +

      '<section class="h-sec"><span class="olho">O que chega para você</span><h2>Uma devolutiva que vira treino.</h2>' +
      '<div class="h-mock" aria-label="Exemplo de devolutiva"><div class="topo-m"><span>Devolutiva do Richard</span><span class="selo novo">Nova</span></div>' +
      '<div class="audio"><i aria-hidden="true"></i><s aria-hidden="true"></s><span>3:40</span></div>' +
      "<h3>O que eu vi</h3><p>No segundo saque o lançamento cai para trás e você perde a perna de apoio.</p>" +
      '<h3>O que treinar</h3><ol class="treinar"><li>Lançamento com alvo, 3 séries de 10</li><li>Saque com pés juntos, 20 bolas</li></ol>' +
      '<p class="det" style="margin-top:10px">Exemplo de como a devolutiva aparece no app.</p></div>' +
      '<ul class="h-lista"><li>Resposta do próprio Richard, não de um robô.</li><li>Aviso no celular quando a devolutiva chega.</li><li>"Entendi" ou "Tenho uma dúvida", direto na devolutiva.</li><li>Histórico com todos os vídeos e respostas.</li></ul></section>' +

      '<section class="h-sec"><span class="olho">Para quem é</span><h2>Para quem joga e quer evoluir com direção.</h2><div class="h-pub">' +
      "<div><b>Juvenil que compete</b><span>Ajustes de golpe e de jogo entre um torneio e outro, sem depender de estar perto.</span></div>" +
      "<div><b>Adulto que joga torneios</b><span>Um olhar de fora sobre o que está travando o seu jogo, no seu tempo.</span></div>" +
      "<div><b>Pai e mãe</b><span>Você filma, manda e acompanha as respostas junto com o atleta. Para menores, o responsável autoriza o envio.</span></div>" +
      "<div><b>Treinador do atleta</b><span>Use a devolutiva como apoio no treino do dia a dia.</span></div></div></section>" +

      '<section class="h-sec"><span class="olho">Quem responde</span><h2>Richard Tsukada</h2><div class="h-sobre"><img src="/assets/richard-tsukada.jpg" alt="Richard Tsukada" width="900" height="900" loading="lazy">' +
      '<div><p class="lead" style="margin-top:0">Head trainer do Team Yoda. Cada vídeo é assistido e respondido por ele, com o método de treino que usa com os atletas da academia.</p>' +
      '<p class="det" style="margin-top:10px">Os vídeos são privados: só você e o Richard veem. Pelo YouTube, publique como "Não listado". Arquivos enviados pelo app são apagados 90 dias depois da devolutiva; a devolutiva fica.</p></div></div></section>' +

      '<section class="h-sec h-faq"><span class="olho">Perguntas</span><h2>Dúvidas comuns</h2>' +
      "<details><summary>Quanto custa?</summary><p>O formato e o valor são combinados direto com o Richard, de acordo com o seu objetivo. Fale com ele pelo WhatsApp.</p></details>" +
      "<details><summary>Preciso de câmera profissional?</summary><p>Não. O celular basta. Filme de lado ou de trás, com o corpo inteiro e a bola no quadro, em 1080p.</p></details>" +
      "<details><summary>Em quanto tempo chega a resposta?</summary><p>Até 3 dias depois do envio. Você recebe um aviso no celular quando ela chega.</p></details>" +
      "<details><summary>Posso mandar um jogo inteiro?</summary><p>Mande até 3 minutos, ou o link do YouTube dizendo o trecho que importa (ex.: de 1:20 a 2:40).</p></details>" +
      "<details><summary>E se o atleta for menor de idade?</summary><p>O pai, a mãe ou o responsável autoriza o envio dos vídeos no cadastro e pode usar a conta junto.</p></details>" +
      "<details><summary>Já tenho conta no Team Yoda. Preciso de outra?</summary><p>Não. Use o mesmo e-mail e senha da Área do aluno ou da Academia Digital.</p></details></section>" +

      '<section class="h-final"><h2>O próximo vídeo pode ser o que muda o seu jogo.</h2><p>Crie a conta, conte quem é o atleta e o Richard combina com você como começar.</p>' +
      '<div class="acoes"><button class="btn btn-verm" type="button" data-modo-ent="criar" data-cta="comecar-final">Quero começar</button>' + btZap("btn-linha") + "</div></section>");
    cada("[data-modo-ent]", function (b) { b.onclick = function () { var m = b.getAttribute("data-modo-ent"); location.hash = HASH_DO_MODO[m]; }; });
  }

  /* entrada: três caminhos claros — entrar; primeiro acesso de quem o Richard convidou (cria a senha pelo e-mail); quero começar */
  function telaEntrada() {
    var modo = st.modo;
    if (modo === "home") return telaHome();
    var topo = '<span class="olho">Consultoria</span><h1>Seu tênis analisado pelo Richard Tsukada</h1>' +
      '<p class="lead">Envie o vídeo do golpe ou do jogo, conte a sua dúvida e receba a devolutiva com o que treinar.</p>' +
      '<div class="foto"><img src="/assets/richard-tsukada-240.jpg" alt="" width="64" height="64"><p class="det">Richard Tsukada, head trainer do Team Yoda. Cada vídeo é visto e respondido por ele.</p></div>';
    var voltar = '<p style="margin-top:22px"><button class="link" type="button" data-modo-ent="entrar">‹ Voltar para entrar</button></p>';
    var h;
    if (modo === "primeiro") {
      h = topo + voltar + '<section class="cartao" data-primeiro><h2>Primeiro acesso</h2><p class="det" style="margin-top:4px">Para quem recebeu o convite do Richard. Digite o e-mail que você passou para ele: chega um e-mail para você criar a sua senha.</p>' +
        '<form id="fPrim" novalidate><label class="campo">E-mail<input name="email" type="email" autocomplete="email" inputmode="email"></label><p id="mPrim" class="msg" role="status" hidden></p>' +
        '<div class="acoes"><button class="btn btn-verm" type="submit" id="btPrim">Receber o e-mail para criar a senha</button></div></form>' +
        '<p class="det" style="margin-top:12px">Depois de criar a senha, volte aqui e toque em Entrar. Não chegou? Olhe a caixa de spam.</p></section>';
    } else if (modo === "criar") {
      h = topo + voltar + '<section class="cartao"><h2>Quero começar</h2><p class="det" style="margin-top:4px">Crie a sua conta e conte quem é o atleta. O Richard combina a consultoria com você e libera o acesso.</p>' +
        '<form id="fEntrar" novalidate><label class="campo">Seu nome<input name="nome" autocomplete="name" maxlength="80"></label>' +
        '<label class="campo">E-mail<input name="email" type="email" autocomplete="email" inputmode="email"></label>' +
        '<label class="campo">Crie uma senha (pelo menos 8 caracteres)<input name="senha" type="password" autocomplete="new-password"></label>' +
        '<p id="mEnt" class="msg" role="status" hidden></p><div class="acoes"><button class="btn btn-verm" type="submit" id="btEnt">Criar conta</button></div></form></section>';
    } else {
      h = '<p><button class="link" type="button" data-modo-ent="home">‹ Conhecer a consultoria</button></p>' + topo + '<section class="cartao" style="margin-top:22px"><h2>Entrar</h2>' +
        '<form id="fEntrar" novalidate><label class="campo">E-mail<input name="email" type="email" autocomplete="email" inputmode="email"></label>' +
        '<label class="campo">Senha<input name="senha" type="password" autocomplete="current-password"></label>' +
        '<p id="mEnt" class="msg" role="status" hidden></p><div class="acoes"><button class="btn btn-verm" type="submit" id="btEnt">Entrar</button><button class="link" type="button" id="btEsqueci">Esqueci a senha</button></div></form>' +
        '<p class="det" style="margin-top:12px">Já tem conta no Team Yoda (Área do aluno ou Academia Digital)? Use o mesmo e-mail e senha.</p></section>' +
        '<button type="button" class="cartao item" data-modo-ent="primeiro" style="width:100%;text-align:left;font:inherit;color:inherit;cursor:pointer"><div><p class="t">Recebi o convite do Richard</p><p class="s">Primeiro acesso: crie a sua senha</p></div><span class="ir">›</span></button>' +
        '<button type="button" class="cartao item" data-modo-ent="criar" style="width:100%;text-align:left;font:inherit;color:inherit;cursor:pointer"><div><p class="t">Ainda não sou cliente</p><p class="s">Quero começar a consultoria</p></div><span class="ir">›</span></button>';
    }
    tela(h);
    cada("[data-modo-ent]", function (b) { b.onclick = function () { var m = b.getAttribute("data-modo-ent"); if (location.hash === HASH_DO_MODO[m]) { st.modo = m; telaEntrada(); } else location.hash = HASH_DO_MODO[m]; }; });
    var fp = $("#fPrim");
    if (fp) fp.onsubmit = function (ev) {
      ev.preventDefault();
      var email = fp.email.value.trim(), m = $("#mPrim");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return msg(m, "erro", "Confira o e-mail.");
      if (!auth) return msg(m, "erro", "Não foi possível conectar agora. Recarregue a página.");
      var bt = $("#btPrim"); ocupado(bt, true, "Enviando…");
      auth.sendPasswordResetEmail(email).then(function () { ocupado(bt, false); msg(m, "ok", "Pronto. Se o Richard cadastrou este e-mail, chega nele um link para criar a sua senha. Depois volte aqui e entre."); })
        .catch(function (e) { ocupado(bt, false); msg(m, "erro", ERROS_AUTH[e.code] || "Não foi possível enviar agora."); });
    };
    var f = $("#fEntrar"); if (!f) return;
    var criar = modo === "criar", m = $("#mEnt"), bt = $("#btEnt");
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
        if (e && e.status === 409) { st.modo = "entrar"; try { history.replaceState(null, "", HASH_DO_MODO.entrar); } catch (x) { /* ok */ } telaEntrada(); msg($("#mEnt"), "aviso", e.message); $("#fEntrar").email.value = email; return; }
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
    if (!d.cliente || d.cliente.cadastroPendente) { barra([]); return telaCadastro(); }
    if (d.cliente.estado === "pendente") { barra([]); return telaPendente(); }
    var aba = h[0] || "inicio", ac = d.acomp || {};
    var abertas = (ac.tarefas || []).filter(function (t) { return t.estado !== "feita" && t.semana <= ac.semana; }).length + (ac.ciclo && !ac.checkinDaSemana ? 1 : 0);
    var itens = [{ id: "inicio", rot: "Início", href: "#/" }, { id: "semana", rot: "Semana", href: "#/semana", n: abertas }, { id: "encontros", rot: "Encontros", href: "#/encontros" },
      { id: "videos", rot: "Vídeos", href: "#/devolutivas", n: novas(d).length }, { id: "plano", rot: "Plano", href: "#/plano" }];
    if (ac.ar) itens.push({ id: "rendimento", rot: "Rendimento", href: "#/rendimento" });
    barra(itens, { envio: "videos", enviar: "videos", devolutivas: "videos" }[aba] || aba);
    if (aba === "enviar") return telaEnviar();
    if (aba === "devolutivas") return telaDevolutivas();
    if (aba === "envio" && h[1]) return telaEnvio(h[1]);
    if (aba === "semana") return telaSemana(h[1] === "checkin");
    if (aba === "encontros") return telaEncontros();
    if (aba === "plano") return telaPlano();
    if (aba === "rendimento" && ac.ar) return telaRendimento();
    return telaInicio();
  }

  /* com qual conta a pessoa entrou (ajuda quem tem mais de um e-mail) */
  function contaHtml() {
    var e = st.dados && st.dados.eu && st.dados.eu.email; if (!e) return "";
    return '<p class="det" data-conta style="margin-top:24px">Você entrou com <b>' + esc(e) + '</b>. Não é este e-mail? <button class="link" type="button" data-sair>Sair e entrar com outro</button></p>';
  }
  function ligarConta() { cada("[data-sair]", function (b) { b.onclick = function () { if (auth) auth.signOut(); }; }); }
  function telaCadastro() {
    var conv = st.dados.cliente && st.dados.cliente.cadastroPendente;
    tela('<span class="olho">Primeiro acesso</span><h1>' + (conv ? "Bem-vindo à consultoria" : "Quem é o atleta?") + '</h1><p class="lead">' + (conv ? "O Richard já liberou o seu acesso. Falta só contar quem é o atleta; você preenche uma vez." : "O Richard usa isso para entender o seu momento. Você só precisa preencher uma vez.") + "</p>" +
      '<form id="fCad" novalidate class="cartao">' +
      '<label class="campo">Nome do atleta<input name="nome" autocomplete="name" maxlength="80" value="' + esc((st.dados.cliente && st.dados.cliente.nome) || (st.usuario && st.usuario.displayName) || "") + '"></label>' +
      '<label class="campo">Data de nascimento do atleta<input name="nascimento" type="date"></label>' +
      '<label class="campo">O que você quer melhorar?<textarea name="objetivo" maxlength="600" placeholder="Ex.: ganhar consistência no segundo saque e decidir melhor quando subir à rede."></textarea></label>' +
      '<div id="blocoMenor" hidden><div class="msg msg-aviso">Atleta menor de 18 anos: o responsável autoriza o envio dos vídeos.</div>' +
      '<label class="campo">Nome do responsável<input name="rnome" autocomplete="off" maxlength="80"></label>' +
      '<label class="campo">E-mail do responsável<input name="remail" type="email" inputmode="email" autocomplete="off"></label>' +
      '<label class="check"><input type="checkbox" name="aceite"><span>Sou o responsável e autorizo o envio de vídeos do atleta para a análise do Richard Tsukada. Os vídeos ficam privados: só o atleta, eu e o Richard veem, e são apagados 90 dias depois da devolutiva.</span></label></div>' +
      '<p id="mCad" class="msg" role="status" hidden></p><div class="acoes"><button class="btn btn-verm" type="submit" id="btCad">Enviar cadastro</button></div></form>' +
      contaHtml() + '<p class="det" style="margin-top:6px">É o Richard e caiu aqui? O e-mail desta conta não é o cadastrado como consultor: saia e entre com o e-mail certo.</p>');
    ligarConta();
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
      avisosHtml() + '<div class="acoes"><button class="btn btn-linha" type="button" id="btAtualizar">Atualizar</button></div>' + contaHtml());
    ligarConta();
    $("#btAtualizar").onclick = function () { recarregar(); };
    ligarAvisos();
  }

  function telaInicio() {
    var d = st.dados, c = d.cliente, nv = novas(d), esperando = (d.envios || []).filter(function (e) { return e.estado === "recebido"; });
    var ac = d.acomp || {}, h = '<span class="olho">Consultoria</span><h1>Olá, ' + esc(primeiro(c.nome)) + "</h1>";
    if (ac.ciclo) h += '<p class="lead">Ciclo ' + ac.ciclo.numero + " · semana " + ac.ciclo.semanaAtual + " de " + ac.ciclo.semanas + (ac.ciclo.objetivo ? " · " + esc(ac.ciclo.objetivo) : "") + "</p>";
    var prox = proximoEncontro(ac);
    if (prox) h += '<a class="cartao destaque item" href="#/encontros" data-prox-encontro><div><span class="selo novo">Próximo encontro</span><p class="t" style="margin-top:8px">' + esc(dataHora(prox.quando)) + '</p><p class="s">' + esc(prox.pauta || "Encontro online com o Richard") + '</p></div><span class="ir">›</span></a>';
    if (ac.ciclo || (ac.tarefas || []).length) {
      var daSemana = (ac.tarefas || []).filter(function (t) { return t.semana === ac.semana; }), feitas = daSemana.filter(function (t) { return t.estado === "feita"; }).length;
      h += '<a class="cartao item" href="#/semana" data-resumo-semana><div><p class="t">Tarefas da semana</p><p class="s">' + (daSemana.length ? feitas + " de " + daSemana.length + " feitas" : "Nenhuma tarefa nesta semana ainda") + '</p></div><span class="ir">›</span></a>';
      if (ac.ciclo && !ac.checkinDaSemana) h += '<a class="cartao item" href="#/semana/checkin" data-pede-checkin><div><p class="t">Check-in da semana</p><p class="s">Como foi a sua semana de treino? Leva um minuto.</p></div><span class="ir">›</span></a>';
    }
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
    h += avisosHtml() + contaHtml();
    tela(h);
    ligarAvisos(); ligarConta();
  }

  /* ══════════════ Acompanhamento do cliente (Etapas 2 a 5) ══════════════ */
  function dataHora(iso) { try { return new Date(iso).toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(",", ""); } catch (e) { return iso; } }
  function dataCurta(d) { return d ? d.slice(8, 10) + "/" + d.slice(5, 7) : ""; }
  function proximoEncontro(ac) { var agora = Date.now(); return (ac.encontros || []).filter(function (e) { return e.estado === "marcado" && Date.parse(e.quando) > agora - 3600000; })[0] || null; }
  var NOTAS_SEMANA = ["", "Difícil", "Abaixo", "Ok", "Boa", "Ótima"];
  function linhaTarefa(t, podeMarcar) {
    var feita = t.estado === "feita";
    return '<li class="tarefa' + (feita ? " feita" : "") + '" data-tarefa="' + esc(t.id) + '"><div class="tarefa-l">' +
      (podeMarcar ? '<button type="button" class="marca" data-marcar="' + esc(t.id) + '" aria-pressed="' + feita + '" aria-label="' + (feita ? "Desmarcar" : "Marcar como feita") + '">' + (feita ? "✓" : "") + "</button>" : '<span class="marca" aria-hidden="true">' + (feita ? "✓" : "") + "</span>") +
      '<div><p class="t">' + esc(t.titulo) + '</p><p class="s">' + esc(t.rotuloTipo) + (t.semana ? " · semana de " + dataCurta(t.semana) : "") + "</p>" +
      (t.detalhe ? '<p class="det" style="margin-top:4px;white-space:pre-wrap">' + esc(t.detalhe) + "</p>" : "") + (t.comentario ? '<p class="det" style="margin-top:4px">Comentário: ' + esc(t.comentario) + "</p>" : "") + "</div></div></li>";
  }
  function telaSemana(irParaCheckin) {
    var ac = st.dados.acomp || {}, sem = ac.semana, tarefas = ac.tarefas || [];
    var desta = tarefas.filter(function (t) { return t.semana === sem; }), atrasadas = tarefas.filter(function (t) { return t.semana < sem && t.estado !== "feita"; });
    var proxima = tarefas.filter(function (t) { return t.semana > sem; });
    var h = '<span class="olho">Semana de ' + dataCurta(sem) + '</span><h1>Sua semana</h1>' + (ac.adesao != null ? '<p class="lead">Você fez ' + ac.adesao + "% das tarefas até aqui.</p>" : "");
    h += '<section class="secao"><h2>Tarefas</h2>' + (desta.length || atrasadas.length ? '<ul class="lista tarefas">' + atrasadas.concat(desta).map(function (t) { return linhaTarefa(t, true); }).join("") + "</ul>" :
      '<p class="det" style="margin-top:6px">O Richard ainda não deixou tarefas para esta semana.</p>') + "</section>";
    if (proxima.length) h += '<section class="secao"><h2>Próxima semana</h2><ul class="lista tarefas">' + proxima.map(function (t) { return linhaTarefa(t, false); }).join("") + "</ul></section>";
    var ck = ac.checkinDaSemana || {};
    h += '<section class="cartao" id="checkin" data-checkin><h2>Check-in da semana</h2><p class="det" style="margin-top:4px">Um minuto para o Richard saber como foi.</p>' +
      '<p class="campo">Como foi a semana?</p><div class="chips" role="group" aria-label="Nota da semana">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" class="chip" data-nota="' + n + '" aria-pressed="' + (ck.nota === n) + '">' + n + " · " + NOTAS_SEMANA[n] + "</button>"; }).join("") + "</div>" +
      '<label class="campo">O que aconteceu<textarea name="texto" maxlength="4000" placeholder="Treinos, jogos, como o corpo respondeu…">' + esc(ck.texto || "") + "</textarea></label>" +
      '<label class="campo">Dúvida para o Richard (opcional)<textarea name="duvida" maxlength="4000">' + esc(ck.duvida || "") + "</textarea></label>" +
      '<p id="mCk" class="msg" role="status" hidden></p><div class="acoes"><button class="btn btn-verm" type="button" id="btCheckin">' + (ck.nota ? "Atualizar check-in" : "Enviar check-in") + "</button></div>" +
      (ck.resposta ? '<div class="msg msg-ok" data-resposta-checkin><b>Richard:</b> ' + esc(ck.resposta.texto) + "</div>" : "") + "</section>";
    var antigos = (ac.checkins || []).filter(function (c) { return c.semana !== sem; }).slice(0, 4);
    if (antigos.length) h += '<section class="secao"><h2>Check-ins anteriores</h2><ul class="linha-tempo">' + antigos.map(function (c) {
      return "<li><time>" + dataCurta(c.semana) + "</time><div>Nota " + c.nota + (c.texto ? " · " + esc(c.texto) : "") + (c.resposta ? '<p class="det" style="margin-top:4px"><b>Richard:</b> ' + esc(c.resposta.texto) + "</p>" : "") + "</div></li>";
    }).join("") + "</ul></section>";
    tela(h);
    if (irParaCheckin) { var a = $("#checkin"); if (a) a.scrollIntoView(); }
    var nota = ck.nota || 0;
    cada("[data-nota]", function (b) { b.onclick = function () { nota = +b.getAttribute("data-nota"); cada("[data-nota]", function (x) { x.setAttribute("aria-pressed", String(x === b)); }); }; });
    $("#btCheckin").onclick = function () {
      var bt = $("#btCheckin"), box = $("[data-checkin]");
      if (!nota) return msg($("#mCk"), "erro", "Escolha uma nota de 1 a 5.");
      ocupado(bt, true, "Enviando…");
      api("POST", { acao: "checkin", nota: nota, texto: box.querySelector('[name="texto"]').value, duvida: box.querySelector('[name="duvida"]').value })
        .then(function () { toast("Check-in enviado. Obrigado!"); return carregar().then(function () { telaSemana(); }); })
        .catch(function (e) { ocupado(bt, false); msg($("#mCk"), "erro", e.message); });
    };
    cada("[data-marcar]", function (b) { b.onclick = function () {
      var id = b.getAttribute("data-marcar"), t = tarefas.filter(function (x) { return x.id === id; })[0], feita = t.estado !== "feita";
      b.disabled = true;
      api("POST", { acao: "tarefaFeita", id: id, feita: feita }).then(function () { if (feita) toast("Tarefa feita. Quer contar como foi? Toque em Comentar."); return carregar().then(function () { telaSemana(); }); })
        .catch(function (e) { b.disabled = false; toast(e.message); });
    }; });
    /* comentário numa tarefa feita (em vez de uma janela do navegador) */
    cada("li.tarefa.feita", function (li) {
      var id = li.getAttribute("data-tarefa"), t = tarefas.filter(function (x) { return x.id === id; })[0]; if (!t) return;
      var bt = document.createElement("button"); bt.type = "button"; bt.className = "link"; bt.textContent = t.comentario ? "Editar comentário" : "Comentar"; bt.style.marginTop = "6px"; bt.setAttribute("data-comentar", id);
      li.querySelector(".tarefa-l > div").appendChild(bt);
      bt.onclick = function () {
        var f = document.createElement("div"); f.innerHTML = '<label class="campo">Como foi?<textarea maxlength="4000">' + esc(t.comentario || "") + '</textarea></label><div class="acoes"><button class="btn btn-pq" type="button">Salvar comentário</button></div>';
        bt.replaceWith(f);
        f.querySelector("button").onclick = function () {
          var b2 = f.querySelector("button"); ocupado(b2, true, "Salvando…");
          api("POST", { acao: "tarefaFeita", id: id, feita: true, comentario: f.querySelector("textarea").value }).then(function () { toast("Comentário salvo. O Richard vê."); return carregar().then(function () { telaSemana(); }); })
            .catch(function (e) { ocupado(b2, false); toast(e.message); });
        };
      };
    });
  }
  function telaEncontros() {
    var ac = st.dados.acomp || {}, agora = Date.now(), lista = ac.encontros || [];
    var prox = lista.filter(function (e) { return e.estado === "marcado" && Date.parse(e.quando) > agora - 3 * 3600000; });
    var passados = lista.filter(function (e) { return prox.indexOf(e) < 0 && e.estado !== "cancelado"; }).reverse();
    var h = '<span class="olho">Encontros</span><h1>Encontros online</h1><p class="lead">O Richard marca os encontros. Você recebe um aviso na véspera e 1 hora antes.</p>';
    h += prox.length ? prox.map(function (e) {
      return '<section class="cartao destaque" data-encontro><p class="olho" style="margin-bottom:4px">' + esc(dataHora(e.quando)) + " · " + e.duracaoMin + " min</p>" + (e.pauta ? '<p style="white-space:pre-wrap">' + esc(e.pauta) + "</p>" : "") +
        (e.link ? '<div class="acoes"><a class="btn btn-verm" href="' + esc(e.link) + '" target="_blank" rel="noopener" data-entrar-encontro>Entrar no encontro</a></div>' : '<p class="det" style="margin-top:8px">O link aparece aqui antes do encontro.</p>') + "</section>";
    }).join("") : '<div class="cartao calmo"><p>Nenhum encontro marcado agora.</p></div>';
    if (passados.length) h += '<section class="secao"><h2>Encontros anteriores</h2>' + passados.map(function (e) {
      return '<details class="cartao" data-encontro-passado><summary><b>' + esc(dataHora(e.quando)) + "</b>" + (e.estado === "feito" ? "" : " · " + esc(e.estado)) + "</summary>" +
        (e.notas ? '<h3 style="margin-top:12px">Anotações</h3><p style="white-space:pre-wrap;margin-top:4px">' + esc(e.notas) + "</p>" : "") +
        (e.combinados.length ? '<h3 style="margin-top:12px">Combinados</h3><ol class="treinar">' + e.combinados.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ol>" : "") + "</details>";
    }).join("") + "</section>";
    tela(h);
  }
  function barraProgresso(p) { return '<div class="prog" aria-hidden="true"><i style="width:' + Math.max(0, Math.min(100, p || 0)) + '%"></i></div>'; }
  function progressoMeta(m) { if (m.inicial == null || m.alvo == null || m.atual == null || m.alvo === m.inicial) return null; return Math.max(0, Math.min(100, Math.round(((m.atual - m.inicial) / (m.alvo - m.inicial)) * 100))); }
  function metaHtml(m) {
    var v = function (x) { return x == null ? "—" : String(x).replace(".", ",") + (m.unidade ? " " + esc(m.unidade) : ""); }, p = progressoMeta(m);
    return '<li class="meta"><p class="t">' + esc(m.texto) + '</p><p class="s">Início ' + v(m.inicial) + " · agora " + v(m.atual) + " · meta " + v(m.alvo) + (p != null ? " · " + p + "%" : "") + "</p>" + (p != null ? barraProgresso(p) : "") + "</li>";
  }
  function analiseHtml(a, botoes) {
    return '<section class="cartao" data-analise><p class="olho" style="margin-bottom:4px">' + esc(a.rotuloTipo) + " · " + dataCurta(a.data) + "</p><h3>" + esc(a.titulo) + "</h3>" +
      (a.numeros.length ? '<div class="numeros">' + a.numeros.map(function (n) { return "<div><b>" + esc(n.valor) + "</b><span>" + esc(n.rotulo) + "</span></div>"; }).join("") + "</div>" : "") +
      (a.resumo ? '<p style="white-space:pre-wrap;margin-top:10px">' + esc(a.resumo) + "</p>" : "") + (a.link ? '<p style="margin-top:8px"><a href="' + esc(a.link) + '" target="_blank" rel="noopener">Abrir o material</a></p>' : "") + (botoes || "") + "</section>";
  }
  function telaPlano() {
    var ac = st.dados.acomp || {}, c = ac.ciclo;
    var h = '<span class="olho">Plano</span><h1>' + (c ? "Ciclo " + c.numero : "Seu plano") + "</h1>";
    if (!c) h += '<div class="cartao calmo"><p>O Richard vai montar o plano do seu ciclo: objetivo, prioridades e metas. Você recebe um aviso quando estiver pronto.</p></div>';
    else {
      h += '<p class="lead">Semana ' + c.semanaAtual + " de " + c.semanas + " · " + dataCurta(c.inicio) + " a " + dataCurta(c.fim) + "</p>" + barraProgresso(Math.round((c.semanaAtual / c.semanas) * 100));
      if (c.objetivo) h += '<section class="cartao"><p class="olho" style="margin-bottom:4px">Objetivo</p><p style="white-space:pre-wrap">' + esc(c.objetivo) + "</p></section>";
      if (c.prioridades.length) h += '<section class="cartao"><p class="olho" style="margin-bottom:4px">Prioridades</p><ol class="treinar">' + c.prioridades.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol></section>";
      if (c.metas.length) h += '<section class="cartao" data-metas><p class="olho" style="margin-bottom:4px">Metas</p><ul class="lista metas">' + c.metas.map(metaHtml).join("") + "</ul></section>";
      if (ac.uso) h += '<p class="det" style="margin-top:12px" data-uso>' + esc(c.formato ? c.formato.nome + ": " : "") + "encontros " + ac.uso.encontros.feitos + " de " + ac.uso.encontros.total + " · análises " + ac.uso.analises.feitas + " de " + ac.uso.analises.total + "</p>";
      if (c.diagnostico) h += '<details class="cartao"><summary><b>Diagnóstico do Richard</b></summary><p style="white-space:pre-wrap;margin-top:8px">' + esc(c.diagnostico) + "</p></details>";
    }
    if ((ac.analises || []).length) h += '<section class="secao"><h2>Análises</h2>' + ac.analises.map(function (a) { return analiseHtml(a); }).join("") + "</section>";
    if ((ac.ciclosAnteriores || []).length) h += '<section class="secao"><h2>Relatórios dos ciclos</h2>' + ac.ciclosAnteriores.map(function (x) {
      return '<details class="cartao" data-relatorio-ciclo><summary><b>Ciclo ' + x.numero + "</b> · " + dataCurta(x.inicio) + " a " + dataCurta(x.fim) + '</summary><p style="white-space:pre-wrap;margin-top:8px">' + esc(x.relatorio ? x.relatorio.texto : "") + "</p></details>";
    }).join("") + "</section>";
    tela(h);
  }
  function cargaHtml(carga) {
    var max = Math.max.apply(null, carga.map(function (c) { return c.carga; }).concat([1]));
    return '<div class="carga" role="img" aria-label="Carga das últimas semanas">' + carga.map(function (c) {
      return '<div><i style="height:' + Math.round((c.carga / max) * 100) + '%"></i><b>' + c.carga + "</b><span>" + dataCurta(c.semana) + "</span></div>";
    }).join("") + "</div>";
  }
  function faseHtml(f) {
    return '<section class="cartao destaque" data-fase><p class="olho" style="margin-bottom:4px">Fase do momento</p><h2>' + esc(f.rotulo) + "</h2>" +
      (f.torneio ? '<p class="det" style="margin-top:4px">' + (f.fase === "competicao" ? "Em torneio: " : f.fase === "transicao" ? "Depois de " : "Próximo torneio: ") + esc(f.torneio.nome) + " · " + dataCurta(f.torneio.inicio) + (f.dias ? " · faltam " + f.dias + " dias" : "") + "</p>" : "") + "</section>";
  }
  function torneiosHtml(torneios, comApagar) {
    return torneios.length ? '<ul class="lista">' + torneios.map(function (t) {
      return '<li><div class="item"><div><p class="t">' + esc(t.nome) + ' <span class="selo">' + esc(t.prioridade) + '</span></p><p class="s">' + dataCurta(t.inicio) + (t.fim !== t.inicio ? " a " + dataCurta(t.fim) : "") + (t.resultado ? " · " + esc(t.resultado) : "") + "</p></div>" +
        (comApagar ? '<button class="link" type="button" data-apagar-torneio="' + esc(t.id) + '">Apagar</button>' : "") + "</div></li>";
    }).join("") + "</ul>" : '<p class="det" style="margin-top:6px">Nenhum torneio no calendário.</p>';
  }
  function telaRendimento() {
    var ar = st.dados.acomp.ar, hoje = st.dados.acomp.hoje;
    var h = '<span class="olho">Alto rendimento</span><h1>Rendimento</h1>' + faseHtml(ar.fase);
    h += '<section class="secao"><h2>Carga por semana</h2><p class="det">Minutos × esforço (1 a 10) de treinos e jogos.</p>' + cargaHtml(ar.carga) + "</section>";
    h += '<section class="cartao" data-registrar><h2>Registrar treino ou jogo</h2><div class="chips" role="group" aria-label="Tipo"><button type="button" class="chip" data-rtipo="treino" aria-pressed="true">Treino</button><button type="button" class="chip" data-rtipo="jogo" aria-pressed="false">Jogo</button></div>' +
      '<label class="campo">Data<input type="date" name="data" value="' + esc(hoje) + '"></label><label class="campo">Minutos<input type="number" name="minutos" inputmode="numeric" min="5" max="600" value="90"></label>' +
      '<p class="campo">Esforço (1 leve a 10 máximo)</p><div class="chips" role="group" aria-label="Esforço">' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) { return '<button type="button" class="chip" data-pse="' + n + '" aria-pressed="' + (n === 6) + '">' + n + "</button>"; }).join("") + "</div>" +
      '<label class="campo">Nota (opcional)<input name="nota" maxlength="200" placeholder="Ex.: 2ª rodada, venci 6-4 6-3"></label><p id="mReg" class="msg" role="status" hidden></p><div class="acoes"><button class="btn btn-verm" type="button" id="btRegistrar">Registrar</button></div></section>';
    h += '<section class="secao"><h2>Torneios</h2>' + torneiosHtml(ar.torneios, false) + "</section>";
    if (ar.registros.length) h += '<section class="secao"><h2>Últimos registros</h2><ul class="lista">' + ar.registros.slice(0, 10).map(function (r) {
      return '<li><div class="item"><div><p class="t">' + (r.tipo === "jogo" ? "Jogo" : "Treino") + " · " + dataCurta(r.data) + '</p><p class="s">' + r.minutos + " min · esforço " + r.pse + " · carga " + r.carga + (r.nota ? " · " + esc(r.nota) : "") + '</p></div><button class="link" type="button" data-apagar-reg="' + esc(r.id) + '">Apagar</button></div></li>';
    }).join("") + "</ul></section>";
    tela(h);
    var tipo = "treino", pse = 6;
    cada("[data-rtipo]", function (b) { b.onclick = function () { tipo = b.getAttribute("data-rtipo"); cada("[data-rtipo]", function (x) { x.setAttribute("aria-pressed", String(x === b)); }); }; });
    cada("[data-pse]", function (b) { b.onclick = function () { pse = +b.getAttribute("data-pse"); cada("[data-pse]", function (x) { x.setAttribute("aria-pressed", String(x === b)); }); }; });
    $("#btRegistrar").onclick = function () {
      var box = $("[data-registrar]"), bt = $("#btRegistrar"); ocupado(bt, true, "Registrando…");
      api("POST", { acao: "arRegistro", tipo: tipo, pse: pse, data: box.querySelector('[name="data"]').value, minutos: box.querySelector('[name="minutos"]').value, nota: box.querySelector('[name="nota"]').value })
        .then(function () { toast("Registrado."); return carregar().then(telaRendimento); }).catch(function (e) { ocupado(bt, false); msg($("#mReg"), "erro", e.message); });
    };
    cada("[data-apagar-reg]", function (b) { b.onclick = function () { b.disabled = true; api("POST", { acao: "arRegistroApagar", id: b.getAttribute("data-apagar-reg") }).then(function () { return carregar().then(telaRendimento); }).catch(function (e) { b.disabled = false; toast(e.message); }); }; });
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
    tela('<span class="olho">Vídeos</span><h1>Vídeos e devolutivas</h1>' + (l.length ? '<div class="acoes"><a class="btn btn-verm" href="#/enviar" data-enviar-video>Enviar vídeo</a></div><ul class="lista">' + l.map(linhaEnvio).join("") + "</ul>" :
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
  /* ══════════════ Richard: Hoje e a ficha com o acompanhamento ══════════════ */
  var TIPOS_TAREFA = [["treino", "Treino"], ["mental", "Mental"], ["video", "Mandar vídeo"], ["jogo", "Marcar jogo no Scout"], ["conteudo", "Assistir ou ler"], ["outro", "Outro"]];
  var TIPOS_ANALISE = [["scout", "Scout de jogo"], ["video", "Análise de vídeo"], ["movimento", "Análise de movimento"], ["torneio", "Torneio"], ["outro", "Outra"]];
  function opcoes(lista, atual) { return lista.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (x[0] === atual ? " selected" : "") + ">" + esc(x[1]) + "</option>"; }).join(""); }
  function segundaDe(d) { var x = new Date(d + "T12:00:00Z"), dow = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - dow); return x.toISOString().slice(0, 10); }
  function somaDias(d, n) { var x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function hojeLocal() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  /* data e hora digitadas no aparelho do Richard → ISO com o fuso do aparelho */
  function isoLocal(data, hora) { var d = new Date(data + "T" + hora + ":00"); return isNaN(d) ? "" : d.toISOString(); }
  function partesLocal(iso) { var d = new Date(iso); return { data: d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2), hora: ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2) }; }
  function linhas(txt) { return String(txt || "").split("\n").map(function (x) { return x.trim(); }).filter(Boolean); }

  function telaHoje() {
    var d = st.dados, hj = d.hoje || { encontros: [], checkinsParaLer: [], semCheckin: [], adesaoBaixa: [] }, pend = d.clientes.filter(function (c) { return c.estado === "pendente"; });
    var h = '<p class="msg msg-aviso" data-visao-richard style="margin:0 0 16px">Você está na <b>visão do Richard</b> (' + esc(d.eu ? d.eu.email : "") + '): o que os clientes veem é outra tela.</p>' +
      '<span class="olho">Hoje</span><h1>Seu dia na consultoria</h1>' +
      '<div class="numeros"><div><b>' + d.fila.length + '</b><span>vídeos na fila</span></div><div><b>' + hj.checkinsParaLer.length + '</b><span>check-ins para ler</span></div><div><b>' + (hj.ciclosAtivos || 0) + "</b><span>ciclos ativos</span></div></div>";
    h += '<section class="secao"><h2>Encontros dos próximos dias</h2>' + (hj.encontros.length ? '<ul class="lista">' + hj.encontros.map(function (e) {
      return '<li><a class="item" href="#/cliente/' + esc(e.uid) + '/encontros" data-hoje-encontro><div><p class="t">' + esc(dataHora(e.quando)) + " · " + esc(e.cliente) + '</p><p class="s">' + esc(e.pauta || "Sem pauta") + "</p></div>" +
        (e.link ? '<span class="selo">Meet</span>' : "") + "</a></li>";
    }).join("") + "</ul>" : '<p class="det" style="margin-top:6px">Nenhum encontro marcado nos próximos 7 dias.</p>') + "</section>";
    if (hj.checkinsParaLer.length) h += '<section class="secao"><h2>Check-ins para ler</h2>' + hj.checkinsParaLer.map(function (c) {
      return '<div class="cartao" data-checkin-ler="' + esc(c.id) + '"><p class="t"><b>' + esc(c.cliente) + "</b> · nota " + c.nota + " (" + NOTAS_SEMANA[c.nota] + ")</p>" + (c.texto ? '<p style="margin-top:6px;white-space:pre-wrap">' + esc(c.texto) + "</p>" : "") +
        (c.duvida ? '<p class="msg msg-aviso"><b>Dúvida:</b> ' + esc(c.duvida) + "</p>" : "") +
        '<label class="campo">Sua resposta<textarea maxlength="4000"></textarea></label><div class="acoes"><button class="btn btn-verm btn-pq" type="button" data-responder-checkin="' + esc(c.id) + '">Responder</button><a class="link" href="#/cliente/' + esc(c.uid) + '/semana">Ver a semana</a></div></div>';
    }).join("") + "</section>";
    if (hj.semCheckin.length) h += '<section class="secao"><h2>Ainda sem check-in nesta semana</h2><p class="det">' + hj.semCheckin.map(function (x) { return '<a href="#/cliente/' + esc(x.uid) + '/semana">' + esc(x.cliente) + "</a>"; }).join(" · ") + "</p></section>";
    if (hj.adesaoBaixa.length) h += '<section class="secao"><h2>Fizeram menos da metade das tarefas</h2><ul class="lista">' + hj.adesaoBaixa.map(function (x) {
      return '<li><a class="item" href="#/cliente/' + esc(x.uid) + '/semana"><div><p class="t">' + esc(x.cliente) + '</p><p class="s">Semana passada: ' + x.adesao + "% de " + x.tarefas + " tarefas</p></div><span class=\"ir\">›</span></a></li>";
    }).join("") + "</ul></section>";
    if (pend.length) h += '<a class="cartao item" href="#/clientes"><div><p class="t">' + pend.length + (pend.length === 1 ? " pedido para entrar" : " pedidos para entrar") + '</p><p class="s">Libere em Clientes.</p></div><span class="ir">›</span></a>';
    if (d.fila.length) h += '<a class="cartao item" href="#/fila"><div><p class="t">' + d.fila.length + (d.fila.length === 1 ? " vídeo esperando devolutiva" : " vídeos esperando devolutiva") + '</p><p class="s">Abrir a fila</p></div><span class="ir">›</span></a>';
    tela(h);
    cada("[data-responder-checkin]", function (b) { b.onclick = function () {
      var box = b.closest("[data-checkin-ler]"), texto = box.querySelector("textarea").value; if (texto.trim().length < 2) return toast("Escreva a resposta.");
      ocupado(b, true, "Enviando…");
      api("POST", { acao: "checkinResponder", id: b.getAttribute("data-responder-checkin"), texto: texto }).then(function () { toast("Resposta enviada."); return carregar().then(telaHoje); }).catch(function (x) { ocupado(b, false); toast(x.message); });
    }; });
  }

  var SECOES = [["ciclo", "Ciclo"], ["semana", "Semana"], ["encontros", "Encontros"], ["feedback", "Feedback"], ["analises", "Análises"], ["rendimento", "Rendimento"], ["historico", "Histórico"]];
  function telaFicha(uid, secao) {
    secao = SECOES.some(function (x) { return x[0] === secao; }) ? secao : "ciclo";
    tela('<p class="carregando">Abrindo…</p>');
    api("POST", { acao: "cliente", uid: uid }).then(function (r) {
      var c = r.cliente, i = idadeDe(c.nascimento), ac = r.acomp || {};
      var h = '<p><a class="link" href="#/clientes">‹ Clientes</a></p><span class="olho" style="margin-top:16px">Ficha do cliente</span><h1>' + esc(c.nome) + "</h1>" +
        '<p class="det" style="margin-top:4px">' + (i != null ? i + " anos · " : "") + esc(c.email) + (c.liberadoEm ? " · cliente desde " + dataLonga(c.liberadoEm) : "") + "</p>" +
        (c.menor && c.responsavel ? '<p class="det" style="margin-top:4px">Responsável: ' + esc(c.responsavel.nome) + " (" + esc(c.responsavel.email) + "), autorizou em " + dataLonga(c.responsavel.aceiteEm) + "</p>" : "") +
        (ac.ciclo ? '<p class="det" style="margin-top:4px">Ciclo ' + ac.ciclo.numero + " · semana " + ac.ciclo.semanaAtual + " de " + ac.ciclo.semanas + (ac.adesao != null ? " · tarefas " + ac.adesao + "%" : "") + "</p>" : "") +
        '<nav class="subabas" aria-label="Seções da ficha">' + SECOES.map(function (x) { return '<a href="#/cliente/' + esc(uid) + "/" + x[0] + '"' + (x[0] === secao ? ' aria-current="page"' : "") + ">" + x[1] + "</a>"; }).join("") + "</nav>" +
        '<div id="secaoFicha"></div>';
      tela(h);
      var alvo = $("#secaoFicha"), recarregarFicha = function () { return carregar().then(function () { telaFicha(uid, secao); }); };
      ({ ciclo: secaoCiclo, semana: secaoSemana, encontros: secaoEncontros, feedback: secaoFeedback, analises: secaoAnalises, rendimento: secaoRendimento, historico: secaoHistorico })[secao](alvo, uid, r, recarregarFicha);
    }).catch(function (x) { tela('<p><a class="link" href="#/clientes">‹ Clientes</a></p><div class="msg msg-erro">' + esc(x.message) + "</div>"); });
  }
  function enviarForm(bt, corpo, okMsg, depois, caixaMsg) {
    ocupado(bt, true, "Salvando…");
    return api("POST", corpo).then(function (r) { toast(okMsg); return depois(r); }).catch(function (x) { ocupado(bt, false); if (caixaMsg) msg(caixaMsg, "erro", x.message); else toast(x.message); });
  }

  /* ciclo: objetivo, prioridades, metas, diagnóstico, formato; relatório e encerramento */
  function secaoCiclo(alvo, uid, r, recarregar) {
    var ac = r.acomp || {}, c = ac.ciclo, formatos = (st.dados.config && st.dados.config.formatos) || [];
    var metas = c ? c.metas.slice() : [];
    function metaEd(m, k) {
      m = m || {};
      return '<div class="meta-ed" data-meta="' + k + '"><label class="campo" style="margin-top:0">Meta<input name="texto" maxlength="300" value="' + esc(m.texto || "") + '" placeholder="Ex.: 1º saque dentro"></label>' +
        '<div class="linha-campos"><label class="campo">Início<input name="inicial" inputmode="decimal" value="' + esc(m.inicial == null ? "" : m.inicial) + '"></label><label class="campo">Agora<input name="atual" inputmode="decimal" value="' + esc(m.atual == null ? "" : m.atual) + '"></label>' +
        '<label class="campo">Alvo<input name="alvo" inputmode="decimal" value="' + esc(m.alvo == null ? "" : m.alvo) + '"></label><label class="campo">Unidade<input name="unidade" maxlength="12" value="' + esc(m.unidade || "") + '" placeholder="%"></label></div>' +
        (m.id ? '<input type="hidden" name="id" value="' + esc(m.id) + '">' : "") + "</div>";
    }
    var h = (c ? "" : '<div class="msg msg-aviso">Este cliente ainda não tem ciclo. Preencha o diagnóstico e o plano e salve: o ciclo começa e o cliente recebe um aviso.</div>') +
      '<form id="fCiclo" class="cartao" novalidate><h2>' + (c ? "Ciclo " + c.numero : "Novo ciclo") + "</h2>" +
      '<div class="linha-campos"><label class="campo">Começa na semana de<input type="date" name="inicio" value="' + esc(c ? c.inicio : segundaDe(hojeLocal())) + '"></label><label class="campo">Semanas<input type="number" name="semanas" min="4" max="52" value="' + (c ? c.semanas : 12) + '"></label></div>' +
      (formatos.length ? '<label class="campo">Formato<select name="formato"><option value="">Sem formato</option>' + formatos.map(function (f) { return '<option value="' + esc(f.id) + '"' + (c && c.formato && c.formato.id === f.id ? " selected" : "") + ">" + esc(f.nome) + " · " + f.encontros + " encontros · " + f.analises + " análises</option>"; }).join("") + "</select></label>" : "") +
      '<label class="campo">Diagnóstico<textarea name="diagnostico" maxlength="4000" placeholder="Onde o atleta está hoje: golpes, jogo, físico, mental.">' + esc(c ? c.diagnostico : "") + "</textarea></label>" +
      '<label class="campo">Objetivo do ciclo<textarea name="objetivo" maxlength="4000">' + esc(c ? c.objetivo : "") + "</textarea></label>" +
      '<p class="campo">Prioridades (até 3)</p>' + [0, 1, 2].map(function (k) { return '<input class="campo-p" name="p' + k + '" maxlength="300" value="' + esc(c && c.prioridades[k] ? c.prioridades[k] : "") + '" style="display:block;width:100%;min-height:44px;margin-top:6px;padding:8px 12px;border:1.5px solid #BDBAB4;border-radius:6px;font:16px var(--texto)">'; }).join("") +
      '<p class="campo">Metas medidas</p><div id="metasEd">' + (metas.length ? metas : [{}]).map(metaEd).join("") + "</div>" +
      '<div class="acoes"><button class="link" type="button" id="btMaisMeta">+ outra meta</button></div>' +
      '<p id="mCiclo" class="msg" role="status" hidden></p><div class="acoes"><button class="btn btn-verm" type="submit" id="btCiclo">' + (c ? "Salvar o ciclo" : "Começar o ciclo") + "</button></div></form>";
    if (c) h += '<section class="cartao" data-relatorio><h2>Relatório do ciclo</h2><p class="det" style="margin-top:4px">Monte o rascunho com os números do ciclo, ajuste o texto e publique. Publicar encerra o ciclo; depois é só começar o próximo.</p>' +
      '<div class="acoes"><button class="btn btn-linha btn-pq" type="button" id="btRascunho">Montar o rascunho</button></div><label class="campo"><span class="sr">Relatório</span><textarea id="txRelatorio" rows="12" style="min-height:240px" maxlength="12000"></textarea></label>' +
      '<p id="mRel" class="msg" role="status" hidden></p><div class="acoes"><button class="btn btn-verm" type="button" id="btEncerrar">Publicar e encerrar o ciclo</button></div></section>';
    if ((ac.ciclosAnteriores || []).length) h += '<section class="secao"><h2>Ciclos anteriores</h2>' + ac.ciclosAnteriores.map(function (x) { return '<details class="cartao"><summary><b>Ciclo ' + x.numero + "</b> · " + dataCurta(x.inicio) + " a " + dataCurta(x.fim) + '</summary><p style="white-space:pre-wrap;margin-top:8px">' + esc(x.relatorio ? x.relatorio.texto : "") + "</p></details>"; }).join("") + "</section>";
    alvo.innerHTML = h;
    $("#btMaisMeta").onclick = function () { var k = document.querySelectorAll("[data-meta]").length; var div = document.createElement("div"); div.innerHTML = metaEd({}, k); $("#metasEd").appendChild(div.firstChild); };
    $("#fCiclo").onsubmit = function (ev) {
      ev.preventDefault();
      var f = $("#fCiclo"), fid = f.formato ? f.formato.value : "", formato = formatos.filter(function (x) { return x.id === fid; })[0] || null;
      var ms = []; cada("[data-meta]", function (m) { var g = function (n) { var e = m.querySelector('[name="' + n + '"]'); return e ? e.value.trim() : ""; }; if (g("texto")) ms.push({ id: g("id"), texto: g("texto"), inicial: g("inicial").replace(",", "."), atual: g("atual").replace(",", "."), alvo: g("alvo").replace(",", "."), unidade: g("unidade") }); });
      enviarForm($("#btCiclo"), { acao: "cicloSalvar", uid: uid, inicio: f.inicio.value, semanas: f.semanas.value, diagnostico: f.diagnostico.value, objetivo: f.objetivo.value, prioridades: [f.p0.value, f.p1.value, f.p2.value], metas: ms, formato: formato },
        c ? "Ciclo salvo." : "Ciclo começou. O cliente recebeu um aviso.", recarregar, $("#mCiclo"));
    };
    var br = $("#btRascunho");
    if (br) br.onclick = function () { ocupado(br, true, "Montando…"); api("POST", { acao: "relatorioRascunho", uid: uid }).then(function (x) { ocupado(br, false); $("#txRelatorio").value = x.texto; }).catch(function (x) { ocupado(br, false); toast(x.message); }); };
    var be = $("#btEncerrar");
    if (be) be.onclick = function () { enviarForm(be, { acao: "cicloEncerrar", uid: uid, texto: $("#txRelatorio").value }, "Relatório publicado. Ciclo encerrado.", recarregar, $("#mRel")); };
  }

  /* semana: tarefas (com modelos), check-ins e respostas */
  function secaoSemana(alvo, uid, r, recarregar) {
    var ac = r.acomp || {}, sem = ac.semana, modelos = (st.dados.config && st.dados.config.modelos) || [];
    var semanas = [[sem, "Esta semana (" + dataCurta(sem) + ")"], [somaDias(sem, 7), "Próxima semana (" + dataCurta(somaDias(sem, 7)) + ")"]];
    var porSemana = function (s) { return (ac.tarefas || []).filter(function (t) { return t.semana === s; }); };
    var h = semanas.map(function (s) {
      var l = porSemana(s[0]);
      return '<section class="secao"><h2>' + esc(s[1]) + "</h2>" + (l.length ? '<ul class="lista tarefas">' + l.map(function (t) {
        return linhaTarefa(t, false).replace("</div></div></li>", '<button class="link" type="button" data-apagar-tarefa="' + esc(t.id) + '" style="margin-top:6px">Apagar</button></div></div></li>');
      }).join("") + "</ul>" : '<p class="det" style="margin-top:6px">Sem tarefas.</p>') + "</section>";
    }).join("");
    var atrasadas = (ac.tarefas || []).filter(function (t) { return t.semana < sem && t.estado !== "feita"; });
    if (atrasadas.length) h += '<section class="secao"><h2>Ainda abertas de semanas anteriores</h2><ul class="lista tarefas">' + atrasadas.map(function (t) { return linhaTarefa(t, false); }).join("") + "</ul></section>";
    h += '<form id="fTarefa" class="cartao" novalidate><h2>Nova tarefa</h2>' +
      (modelos.length ? '<label class="campo">Usar um modelo<select id="selModelo"><option value="">Escrever do zero</option>' + modelos.map(function (m, k) { return '<option value="' + k + '">' + esc(m.titulo) + "</option>"; }).join("") + "</select></label>" : "") +
      '<label class="campo">Semana<select name="semana">' + semanas.map(function (s) { return '<option value="' + s[0] + '">' + esc(s[1]) + "</option>"; }).join("") + "</select></label>" +
      '<label class="campo">Tarefa<input name="titulo" maxlength="120" placeholder="Ex.: Voleio na parede, 3 séries de 50"></label>' +
      '<label class="campo">Tipo<select name="tipo">' + opcoes(TIPOS_TAREFA, "treino") + "</select></label>" +
      '<label class="campo">Como fazer (opcional)<textarea name="detalhe" maxlength="4000"></textarea></label>' +
      '<p id="mTarefa" class="msg" role="status" hidden></p><div class="acoes"><button class="btn btn-verm" type="submit" id="btTarefa">Adicionar tarefa</button></div></form>';
    h += '<section class="secao"><h2>Check-ins</h2>' + ((ac.checkins || []).length ? ac.checkins.map(function (c) {
      return '<div class="cartao" data-checkin-ficha><p class="t"><b>Semana de ' + dataCurta(c.semana) + "</b> · nota " + c.nota + " (" + NOTAS_SEMANA[c.nota] + ")</p>" + (c.texto ? '<p style="margin-top:6px;white-space:pre-wrap">' + esc(c.texto) + "</p>" : "") +
        (c.duvida ? '<p class="msg msg-aviso"><b>Dúvida:</b> ' + esc(c.duvida) + "</p>" : "") +
        (c.resposta ? '<p class="msg msg-ok"><b>Sua resposta:</b> ' + esc(c.resposta.texto) + "</p>" : '<label class="campo">Sua resposta<textarea maxlength="4000"></textarea></label><div class="acoes"><button class="btn btn-verm btn-pq" type="button" data-responder-checkin="' + esc(c.id) + '">Responder</button></div>') + "</div>";
    }).join("") : '<p class="det" style="margin-top:6px">Nenhum check-in ainda.</p>') + "</section>";
    alvo.innerHTML = h;
    var f = $("#fTarefa"), sm = $("#selModelo");
    if (sm) sm.onchange = function () { var m = modelos[+sm.value]; if (!m) return; f.titulo.value = m.titulo; f.tipo.value = m.tipo; f.detalhe.value = m.detalhe || ""; };
    f.onsubmit = function (ev) { ev.preventDefault(); enviarForm($("#btTarefa"), { acao: "tarefaSalvar", uid: uid, semana: f.semana.value, titulo: f.titulo.value, tipo: f.tipo.value, detalhe: f.detalhe.value }, "Tarefa adicionada.", recarregar, $("#mTarefa")); };
    cada("[data-apagar-tarefa]", function (b) { b.onclick = function () { b.disabled = true; api("POST", { acao: "tarefaApagar", id: b.getAttribute("data-apagar-tarefa") }).then(recarregar).catch(function (x) { b.disabled = false; toast(x.message); }); }; });
    cada("[data-responder-checkin]", function (b) { b.onclick = function () {
      var texto = b.closest("[data-checkin-ficha]").querySelector("textarea").value; if (texto.trim().length < 2) return toast("Escreva a resposta.");
      enviarForm(b, { acao: "checkinResponder", id: b.getAttribute("data-responder-checkin"), texto: texto }, "Resposta enviada.", recarregar);
    }; });
  }

  /* encontros: marcar, registrar (anotações, combinados, nota privada) e transformar combinados em tarefas */
  function secaoEncontros(alvo, uid, r, recarregar) {
    var ac = r.acomp || {}, lista = (ac.encontros || []).slice().reverse(), cfg = st.dados.config || {};
    var amanha = somaDias(hojeLocal(), 1);
    var h = '<form id="fEncontro" class="cartao" novalidate><h2>Marcar encontro</h2><div class="linha-campos"><label class="campo">Data<input type="date" name="data" value="' + amanha + '"></label><label class="campo">Hora<input type="time" name="hora" value="19:00"></label></div>' +
      '<label class="campo">Duração<select name="duracaoMin"><option value="30">30 min</option><option value="45" selected>45 min</option><option value="60">1 hora</option><option value="90">1h30</option></select></label>' +
      '<label class="campo">Link<input name="link" inputmode="url" placeholder="' + esc(cfg.linkEncontro || "https://meet.google.com/…") + '"><small>' + (cfg.linkEncontro ? "Em branco, vale o seu link fixo (Ajustes)." : "Dica: salve o seu link fixo do Meet em Ajustes.") + "</small></label>" +
      '<label class="campo">Pauta (o cliente vê)<textarea name="pauta" maxlength="4000" placeholder="Ex.: rever o voleio e planejar o torneio."></textarea></label>' +
      '<p id="mEnc" class="msg" role="status" hidden></p><div class="acoes"><button class="btn btn-verm" type="submit" id="btEnc">Marcar e avisar o cliente</button></div></form>';
    h += '<section class="secao"><h2>Encontros</h2>' + (lista.length ? lista.map(function (e) {
      var p = partesLocal(e.quando);
      return '<details class="cartao" data-encontro-ficha="' + esc(e.id) + '"' + (e.estado === "marcado" || (e.combinados.length && !e.combinadosViraramTarefas) ? " open" : "") + '><summary><b>' + esc(dataHora(e.quando)) + "</b> · " + esc(e.estado) + "</summary>" +
        (e.link ? '<p style="margin-top:8px"><a href="' + esc(e.link) + '" target="_blank" rel="noopener">Abrir o link do encontro</a></p>' : "") +
        '<div class="linha-campos"><label class="campo">Data<input type="date" name="data" value="' + p.data + '"></label><label class="campo">Hora<input type="time" name="hora" value="' + p.hora + '"></label></div>' +
        '<label class="campo">Situação<select name="estado">' + opcoes([["marcado", "Marcado"], ["feito", "Feito"], ["cancelado", "Cancelado"]], e.estado) + "</select></label>" +
        '<label class="campo">Pauta<textarea name="pauta" maxlength="4000">' + esc(e.pauta) + "</textarea></label>" +
        '<label class="campo">Anotações (o cliente vê)<textarea name="notas" maxlength="4000">' + esc(e.notas) + "</textarea></label>" +
        '<label class="campo">Combinados (um por linha; viram tarefas)<textarea name="combinados" maxlength="4000">' + esc((e.combinados || []).join("\n")) + "</textarea></label>" +
        '<label class="campo">Anotação privada (só você)<textarea name="notaPrivada" maxlength="4000">' + esc(e.notaPrivada || "") + "</textarea></label>" +
        '<div class="acoes"><button class="btn btn-verm btn-pq" type="button" data-salvar-encontro="' + esc(e.id) + '">Salvar</button>' +
        (e.combinados.length && !e.combinadosViraramTarefas ? '<button class="btn btn-linha btn-pq" type="button" data-combinados="' + esc(e.id) + '">Combinados → tarefas da semana</button>' : e.combinadosViraramTarefas ? '<span class="selo ok">Combinados viraram tarefas</span>' : "") +
        '<button class="link" type="button" data-apagar-encontro="' + esc(e.id) + '">Apagar</button></div></details>';
    }).join("") : '<p class="det" style="margin-top:6px">Nenhum encontro ainda.</p>') + "</section>";
    alvo.innerHTML = h;
    var f = $("#fEncontro");
    f.onsubmit = function (ev) { ev.preventDefault(); var q = isoLocal(f.data.value, f.hora.value); if (!q) return msg($("#mEnc"), "erro", "Escolha a data e a hora.");
      enviarForm($("#btEnc"), { acao: "encontroSalvar", uid: uid, quando: q, duracaoMin: f.duracaoMin.value, link: f.link.value.trim(), pauta: f.pauta.value }, "Encontro marcado. O cliente recebeu um aviso.", recarregar, $("#mEnc")); };
    cada("[data-salvar-encontro]", function (b) { b.onclick = function () {
      var box = b.closest("[data-encontro-ficha]"), g = function (n) { return box.querySelector('[name="' + n + '"]').value; }, e = lista.filter(function (x) { return x.id === b.getAttribute("data-salvar-encontro"); })[0];
      enviarForm(b, { acao: "encontroSalvar", uid: uid, id: e.id, quando: isoLocal(g("data"), g("hora")), duracaoMin: e.duracaoMin, link: e.link, estado: g("estado"), pauta: g("pauta"), notas: g("notas"), combinados: linhas(g("combinados")), notaPrivada: g("notaPrivada") }, "Encontro salvo.", recarregar);
    }; });
    cada("[data-combinados]", function (b) { b.onclick = function () { enviarForm(b, { acao: "combinadosParaTarefas", id: b.getAttribute("data-combinados") }, "Combinados viraram tarefas da semana.", recarregar); }; });
    cada("[data-apagar-encontro]", function (b) { b.onclick = function () { b.disabled = true; api("POST", { acao: "encontroApagar", id: b.getAttribute("data-apagar-encontro") }).then(recarregar).catch(function (x) { b.disabled = false; toast(x.message); }); }; });
  }

  /* feedback: recado sem vídeo do cliente (sobre torneio, check-in, encontro) */
  function secaoFeedback(alvo, uid, r, recarregar) {
    var recados = r.envios.filter(function (e) { return e.tipo === "recado"; });
    var h = '<form id="fRecado" class="cartao" novalidate><h2>Mandar um feedback</h2><p class="det" style="margin-top:4px">Sobre um torneio, um check-in, um encontro ou o que quiser. Chega como devolutiva, com aviso no celular.</p>' +
      '<label class="campo">Assunto<input name="titulo" maxlength="120" placeholder="Ex.: Sobre o torneio de sábado"></label><label class="campo">Mensagem<textarea name="texto" maxlength="5000"></textarea></label>' +
      '<label class="campo">O que treinar (um por linha, opcional)<textarea name="treinar" maxlength="2000"></textarea></label><label class="campo">Vídeo seu no YouTube (opcional)<input name="linkVideo" inputmode="url" placeholder="https://youtu.be/…"></label>' +
      '<p id="mRec" class="msg" role="status" hidden></p><div class="acoes"><button class="btn btn-verm" type="submit" id="btRec">Mandar feedback</button></div></form>';
    if (recados.length) h += '<section class="secao"><h2>Feedbacks mandados</h2><ul class="linha-tempo">' + recados.map(function (e) { return "<li><time>" + dataBR(e.criadoEm) + '</time><a href="#/ver/' + esc(uid) + "/" + esc(e.id) + '">' + esc(e.duvida || "Recado") + "</a></li>"; }).join("") + "</ul></section>";
    alvo.innerHTML = h;
    var f = $("#fRecado");
    f.onsubmit = function (ev) { ev.preventDefault(); enviarForm($("#btRec"), { acao: "recado", uid: uid, titulo: f.titulo.value, texto: f.texto.value, treinar: linhas(f.treinar.value), linkVideo: f.linkVideo.value.trim() }, "Feedback mandado.", recarregar, $("#mRec")); };
  }

  /* análises: scout, vídeo, movimento, torneio — com números e link */
  function secaoAnalises(alvo, uid, r, recarregar) {
    var ac = r.acomp || {};
    var h = '<form id="fAnalise" class="cartao" novalidate><h2>Nova análise</h2><label class="campo">Tipo<select name="tipo">' + opcoes(TIPOS_ANALISE, "scout") + "</select></label>" +
      '<label class="campo">Título<input name="titulo" maxlength="120" placeholder="Ex.: Scout · Copa Sul, 2ª rodada"></label><label class="campo">Data<input type="date" name="data" value="' + hojeLocal() + '"></label>' +
      '<label class="campo">O que a análise mostra<textarea name="resumo" maxlength="4000"></textarea></label>' +
      '<p class="campo">Números (opcional)</p>' + [0, 1, 2, 3].map(function (k) { return '<div class="linha-campos"><label class="campo">Medida<input name="nr' + k + '" maxlength="60" placeholder="Ex.: 1º saque dentro"></label><label class="campo">Valor<input name="nv' + k + '" maxlength="30" placeholder="62%"></label></div>'; }).join("") +
      '<label class="campo">Link (relatório, vídeo, PDF)<input name="link" inputmode="url" placeholder="https://…"></label>' +
      '<p id="mAn" class="msg" role="status" hidden></p><div class="acoes"><button class="btn btn-verm" type="submit" id="btAn">Publicar análise</button></div></form>';
    h += '<section class="secao"><h2>Análises publicadas</h2>' + ((ac.analises || []).length ? ac.analises.map(function (a) { return analiseHtml(a, '<div class="acoes"><button class="link" type="button" data-apagar-analise="' + esc(a.id) + '">Apagar</button></div>'); }).join("") : '<p class="det" style="margin-top:6px">Nenhuma ainda.</p>') + "</section>";
    alvo.innerHTML = h;
    var f = $("#fAnalise");
    f.onsubmit = function (ev) { ev.preventDefault(); var ns = [0, 1, 2, 3].map(function (k) { return { rotulo: f["nr" + k].value, valor: f["nv" + k].value }; });
      enviarForm($("#btAn"), { acao: "analiseSalvar", uid: uid, tipo: f.tipo.value, titulo: f.titulo.value, data: f.data.value, resumo: f.resumo.value, numeros: ns, link: f.link.value.trim() }, "Análise publicada. O cliente recebeu um aviso.", recarregar, $("#mAn")); };
    cada("[data-apagar-analise]", function (b) { b.onclick = function () { b.disabled = true; api("POST", { acao: "analiseApagar", id: b.getAttribute("data-apagar-analise") }).then(recarregar).catch(function (x) { b.disabled = false; toast(x.message); }); }; });
  }

  /* alto rendimento: ligar a aba, calendário de torneios, fase e carga */
  function secaoRendimento(alvo, uid, r, recarregar) {
    var ar = (r.acomp || {}).ar || { ligado: false, torneios: [] };
    var h = '<section class="cartao"><h2>Alto rendimento</h2><p class="det" style="margin-top:4px">Para o atleta que compete: o cliente ganha a aba Rendimento, com a fase do momento, o calendário de torneios e o registro de treinos e jogos (carga = minutos × esforço).</p>' +
      '<div class="acoes"><button class="btn ' + (ar.ligado ? "btn-linha" : "btn-verm") + ' btn-pq" type="button" id="btAR">' + (ar.ligado ? "Desligar a aba Rendimento" : "Ligar a aba Rendimento") + "</button></div></section>";
    if (ar.ligado) {
      h += faseHtml(ar.fase) + '<section class="secao"><h2>Carga por semana</h2>' + cargaHtml(ar.carga) + "</section>";
      h += '<form id="fTorneio" class="cartao" novalidate><h2>Torneio no calendário</h2><label class="campo">Nome<input name="nome" maxlength="100"></label><div class="linha-campos"><label class="campo">Início<input type="date" name="inicio"></label><label class="campo">Término<input type="date" name="fim"></label></div>' +
        '<label class="campo">Prioridade<select name="prioridade">' + opcoes([["A", "A · principal"], ["B", "B · importante"], ["C", "C · preparação"]], "B") + "</select></label><label class=\"campo\">Resultado (depois do torneio)<input name=\"resultado\" maxlength=\"120\"></label>" +
        '<p id="mTor" class="msg" role="status" hidden></p><div class="acoes"><button class="btn btn-verm" type="submit" id="btTor">Salvar torneio</button></div></form>';
      h += '<section class="secao"><h2>Calendário</h2>' + torneiosHtml(ar.torneios, true) + "</section>";
      if ((ar.registros || []).length) h += '<section class="secao"><h2>Registros do atleta</h2><ul class="lista">' + ar.registros.slice(0, 15).map(function (x) { return '<li><div class="item"><div><p class="t">' + (x.tipo === "jogo" ? "Jogo" : "Treino") + " · " + dataCurta(x.data) + '</p><p class="s">' + x.minutos + " min · esforço " + x.pse + " · carga " + x.carga + (x.nota ? " · " + esc(x.nota) : "") + "</p></div></div></li>"; }).join("") + "</ul></section>";
    }
    alvo.innerHTML = h;
    var b = $("#btAR"); b.onclick = function () { enviarForm(b, { acao: "arLigar", uid: uid, ligado: !ar.ligado }, ar.ligado ? "Aba Rendimento desligada." : "Aba Rendimento ligada.", recarregar); };
    var f = $("#fTorneio");
    if (f) f.onsubmit = function (ev) { ev.preventDefault(); enviarForm($("#btTor"), { acao: "arTorneioSalvar", uid: uid, torneio: { nome: f.nome.value, inicio: f.inicio.value, fim: f.fim.value, prioridade: f.prioridade.value, resultado: f.resultado.value } }, "Torneio salvo.", recarregar, $("#mTor")); };
    cada("[data-apagar-torneio]", function (x) { x.onclick = function () { x.disabled = true; api("POST", { acao: "arTorneioApagar", uid: uid, id: x.getAttribute("data-apagar-torneio") }).then(recarregar).catch(function (e) { x.disabled = false; toast(e.message); }); }; });
  }

  /* histórico de vídeos e devolutivas + pausar/liberar + anotação privada (o que já existia) */
  function secaoHistorico(alvo, uid, r, recarregar) {
    var c = r.cliente, env = r.envios;
    alvo.innerHTML = '<div class="numeros"><div><b>' + env.filter(function (e) { return e.tipo === "video"; }).length + "</b><span>vídeos</span></div><div><b>" + env.filter(function (e) { return e.estado === "respondido"; }).length +
        "</b><span>devolutivas</span></div><div><b>" + env.filter(function (e) { return e.estado === "recebido"; }).length + "</b><span>na fila</span></div></div>" +
      '<div class="acoes">' + (c.estado === "ativo" ? '<button class="btn btn-linha btn-pq" type="button" id="btPausar">Pausar consultoria</button>' : '<button class="btn btn-verm btn-pq" type="button" id="btLiberar">' + (c.estado === "pendente" ? "Liberar" : "Retomar consultoria") + "</button>") + "</div>" +
      '<section class="secao"><h2>Vídeos, dúvidas e feedbacks</h2>' + (env.length ? '<ul class="linha-tempo">' + env.map(function (e) {
        var alvoE = e.estado === "recebido" ? "#/responder/" + e.id : "#/ver/" + uid + "/" + e.id;
        return '<li><time>' + dataBR(e.recebidoEm || e.criadoEm) + '</time><a href="' + alvoE + '">' + (e.tipo === "recado" ? "Feedback: " + esc(e.duvida) : (e.estado === "respondido" ? "Devolutiva: " : e.tipo === "pergunta" ? "Dúvida: " : "Vídeo: ") + esc(e.rotuloTema)) + (e.estado === "recebido" ? " (na fila)" : "") + "</a></li>";
      }).join("") + "</ul>" : '<p class="det" style="margin-top:8px">Nenhum envio ainda.</p>') + "</section>" +
      '<section class="secao"><h2>Anotação privada</h2><p class="det">Só você vê.</p><label class="campo"><span class="sr">Anotação</span><textarea id="txNota" maxlength="8000">' + esc(r.nota) + '</textarea></label>' +
      '<div class="acoes"><button class="btn btn-linha btn-pq" type="button" id="btNota">Salvar anotação</button></div></section>';
    var bp = $("#btPausar"), bl = $("#btLiberar"), bn = $("#btNota");
    if (bp) bp.onclick = function () { enviarForm(bp, { acao: "pausar", uid: uid }, "Consultoria pausada.", recarregar); };
    if (bl) bl.onclick = function () { enviarForm(bl, { acao: "liberar", uid: uid }, "Consultoria liberada.", recarregar); };
    bn.onclick = function () { ocupado(bn, true, "Salvando…"); api("POST", { acao: "nota", uid: uid, texto: $("#txNota").value }).then(function () { ocupado(bn, false); toast("Anotação salva."); }).catch(function (x) { ocupado(bn, false); toast(x.message); }); };
  }

  /* Ajustes: link fixo, modelos de tarefa e formatos */
  function ajustesAcompHtml() {
    var cfg = st.dados.config || { linkEncontro: "", modelos: [], formatos: [] };
    var modelo = function (m) { m = m || {}; return '<div class="meta-ed" data-modelo><label class="campo" style="margin-top:0">Tarefa<input name="titulo" maxlength="120" value="' + esc(m.titulo || "") + '"></label><label class="campo">Tipo<select name="tipo">' + opcoes(TIPOS_TAREFA, m.tipo || "treino") + '</select></label><label class="campo">Como fazer<textarea name="detalhe" maxlength="4000">' + esc(m.detalhe || "") + "</textarea></label></div>"; };
    var formato = function (f) { f = f || {}; return '<div class="meta-ed" data-formato-ed>' + (f.id ? '<input type="hidden" name="id" value="' + esc(f.id) + '">' : "") + '<label class="campo" style="margin-top:0">Nome<input name="nome" maxlength="60" value="' + esc(f.nome || "") + '" placeholder="Ex.: Trimestral"></label>' +
      '<div class="linha-campos"><label class="campo">Semanas<input type="number" name="semanas" value="' + (f.semanas || 12) + '"></label><label class="campo">Encontros<input type="number" name="encontros" value="' + (f.encontros || 0) + '"></label><label class="campo">Análises<input type="number" name="analises" value="' + (f.analises || 0) + '"></label><label class="campo">Vídeos por mês<input type="number" name="videosMes" value="' + (f.videosMes || 0) + '"></label></div></div>'; };
    return '<form id="fConfig" class="cartao" novalidate><h2>Consultoria</h2>' +
      '<label class="campo">Seu link fixo de encontro<input name="linkEncontro" inputmode="url" value="' + esc(cfg.linkEncontro || "") + '" placeholder="https://meet.google.com/…"><small>Usado quando você marca um encontro sem link.</small></label>' +
      '<p class="campo">Modelos de tarefa<small>Para montar a semana sem escrever do zero.</small></p><div id="modelosEd">' + (cfg.modelos.length ? cfg.modelos : [{}]).map(modelo).join("") + '</div><div class="acoes"><button class="link" type="button" id="btMaisModelo">+ outro modelo</button></div>' +
      '<p class="campo">Formatos<small>O que você combina com cada cliente. Sem preço e sem cobrança no app.</small></p><div id="formatosEd">' + (cfg.formatos.length ? cfg.formatos : [{}]).map(formato).join("") + '</div><div class="acoes"><button class="link" type="button" id="btMaisFormato">+ outro formato</button></div>' +
      '<p id="mCfg" class="msg" role="status" hidden></p><div class="acoes"><button class="btn btn-verm" type="submit" id="btCfg">Salvar ajustes</button></div></form>';
  }
  function ligarAjustesAcomp() {
    var f = $("#fConfig"); if (!f) return;
    $("#btMaisModelo").onclick = function () { var d = document.createElement("div"); d.innerHTML = '<div class="meta-ed" data-modelo><label class="campo" style="margin-top:0">Tarefa<input name="titulo" maxlength="120"></label><label class="campo">Tipo<select name="tipo">' + opcoes(TIPOS_TAREFA, "treino") + '</select></label><label class="campo">Como fazer<textarea name="detalhe" maxlength="4000"></textarea></label></div>'; $("#modelosEd").appendChild(d.firstChild); };
    $("#btMaisFormato").onclick = function () { var d = document.createElement("div"); d.innerHTML = '<div class="meta-ed" data-formato-ed><label class="campo" style="margin-top:0">Nome<input name="nome" maxlength="60"></label><div class="linha-campos"><label class="campo">Semanas<input type="number" name="semanas" value="12"></label><label class="campo">Encontros<input type="number" name="encontros" value="0"></label><label class="campo">Análises<input type="number" name="analises" value="0"></label><label class="campo">Vídeos por mês<input type="number" name="videosMes" value="0"></label></div></div>'; $("#formatosEd").appendChild(d.firstChild); };
    f.onsubmit = function (ev) {
      ev.preventDefault();
      var g = function (box, n) { var e = box.querySelector('[name="' + n + '"]'); return e ? e.value : ""; };
      var modelos = [], formatos = [];
      cada("[data-modelo]", function (m) { if (g(m, "titulo").trim()) modelos.push({ titulo: g(m, "titulo"), tipo: g(m, "tipo"), detalhe: g(m, "detalhe") }); });
      cada("[data-formato-ed]", function (m) { if (g(m, "nome").trim()) formatos.push({ id: g(m, "id"), nome: g(m, "nome"), semanas: g(m, "semanas"), encontros: g(m, "encontros"), analises: g(m, "analises"), videosMes: g(m, "videosMes") }); });
      enviarForm($("#btCfg"), { acao: "configSalvar", linkEncontro: f.linkEncontro.value.trim(), modelos: modelos, formatos: formatos }, "Ajustes salvos.", function () { return carregar().then(telaAjustes); }, $("#mCfg"));
    };
  }

  function rotaRichard(h) {
    var d = st.dados, aba = h[0] || "hoje", pend = d.clientes.filter(function (c) { return c.estado === "pendente"; }).length;
    var mapa = { responder: "fila", ver: "clientes", cliente: "clientes" }, hj = d.hoje || {};
    barra([{ id: "hoje", rot: "Hoje", href: "#/hoje", n: (hj.checkinsParaLer || []).length }, { id: "fila", rot: "Fila", href: "#/fila", n: d.fila.length }, { id: "clientes", rot: "Clientes", href: "#/clientes", n: pend }, { id: "ajustes", rot: "Ajustes", href: "#/ajustes" }], mapa[aba] || aba);
    if (aba === "responder" && h[1]) return telaResponder(h[1]);
    if (aba === "clientes") return telaClientes();
    if (aba === "cliente" && h[1]) return telaFicha(h[1], h[2]);
    if (aba === "ver" && h[1] && h[2]) return telaVerEnvio(h[1], h[2]);
    if (aba === "ajustes") return telaAjustes();
    if (aba === "fila") return telaFila();
    return telaHoje();
  }
  function telaFila() {
    var f = st.dados.fila;
    var h = '<p class="msg msg-aviso" data-visao-richard style="margin:0 0 16px">Você está na <b>visão do Richard</b> (' + esc(st.dados.eu ? st.dados.eu.email : "") + '): fila, clientes e respostas. Os clientes veem outra tela.</p><span class="olho">Fila</span><h1>' + (f.length ? f.length + (f.length === 1 ? " envio aguardando" : " envios aguardando") : "Fila em dia") + "</h1>" +
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
    var h = '<span class="olho">Clientes</span><h1>Clientes</h1>' +
      '<section class="cartao destaque" data-convidar><h2>Convidar cliente</h2><p class="det" style="margin-top:4px">Para quem você já combinou a consultoria. Entra liberado: no primeiro acesso cria a senha e conta quem é o atleta.</p>' +
      '<form id="fConv" novalidate><label class="campo">Nome do atleta<input name="nome" maxlength="80" autocomplete="off"></label><label class="campo">E-mail de quem vai usar<small>O atleta, ou o pai ou a mãe se for menor.</small><input name="email" type="email" inputmode="email" autocomplete="off"></label>' +
      '<p id="mConv" class="msg" role="status" hidden></p><div class="acoes"><button class="btn btn-verm" type="submit" id="btConv">Convidar</button></div></form><div id="convPronto"></div></section>';
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
    var fc = $("#fConv");
    fc.onsubmit = function (ev) {
      ev.preventDefault();
      var bt = $("#btConv"), nome = fc.nome.value.trim(), email = fc.email.value.trim();
      ocupado(bt, true, "Convidando…");
      api("POST", { acao: "convidar", nome: nome, email: email }).then(function (r) {
        ocupado(bt, false); fc.reset(); msg($("#mConv"), "", "");
        var site = location.origin + "/richard/#/convite", txt = "Oi! A sua consultoria com o Richard Tsukada está liberada.\n\n1. Abra " + site + "\n" +
          (r.contaNova ? "2. Digite este e-mail para receber o link de criar a senha: " + email + "\n3. Crie a sua senha pelo e-mail que chegar e entre." : "2. Entre com o e-mail " + email + " e a senha que você já usa no Team Yoda.");
        $("#convPronto").innerHTML = '<div class="msg msg-ok" data-convite-ok><b>' + esc(nome) + " está liberado(a).</b> Mande o convite:</div>" +
          '<div class="acoes"><a class="btn btn-verm btn-pq" target="_blank" rel="noopener" href="https://wa.me/?text=' + encodeURIComponent(txt) + '">Mandar no WhatsApp</a><button class="btn btn-linha btn-pq" type="button" id="btCopiarConv">Copiar o convite</button></div>';
        $("#btCopiarConv").onclick = function () { try { navigator.clipboard.writeText(txt).then(function () { toast("Convite copiado."); }); } catch (e) { toast("Não deu para copiar aqui."); } };
        return carregar().then(function () { var box = $("#convPronto").innerHTML; telaClientes(); $("#convPronto").innerHTML = box; $("#btCopiarConv").onclick = function () { try { navigator.clipboard.writeText(txt).then(function () { toast("Convite copiado."); }); } catch (e) { toast("Não deu para copiar aqui."); } }; });
      }).catch(function (x) { ocupado(bt, false); msg($("#mConv"), "erro", x.message); });
    };
    cada("[data-liberar]", function (b) { b.onclick = function () { ocupado(b, true, "Liberando…"); api("POST", { acao: "liberar", uid: b.getAttribute("data-liberar") }).then(function () { toast("Cliente liberado e avisado."); return recarregar(); }).catch(function (x) { ocupado(b, false); toast(x.message); }); }; });
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
      ajustesAcompHtml() + avisosHtml() + contaHtml());
    ligarConta(); ligarAjustesAcomp();
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
