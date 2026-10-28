/* QuadraLab Player — app do jogador: perfil, estratégia, jogadas e treinos.

   Só o login usa o Firebase direto do navegador. Perfil, estratégias, programas de treino e cota
   passam sempre pelas functions player-* (Admin SDK), que validam tudo
   — ver netlify/functions/_player.js. */
(function () {
  "use strict";

  /* Mesmo projeto Firebase do QuadraLab (ver ../mty-nuvem.js). */
  var FIREBASE = {
    apiKey: "AIzaSyBEHp7uzFqH1D_9pnHcZFm21ITXP3bpFFo",
    authDomain: "mty-coach.firebaseapp.com",
    projectId: "mty-coach",
    storageBucket: "mty-coach.firebasestorage.app",
    messagingSenderId: "108398981681",
    appId: "1:108398981681:web:1c8b377f3effb96c399b10",
  };
  /* Contato para a consultoria enquanto a compra pelo app (Fase 2) não
     existe: o mesmo WhatsApp que recebe as fichas no QuadraLab (MTY_WHATSAPP). */
  var WHATSAPP_CONSULTORIA = "5511941773228";

  /* Opções da ficha — os mesmos valores que o servidor aceita (_player.js). */
  var AREAS = [
    ["saque", "Saque"], ["devolucao", "Devolução"], ["direita", "Direita (forehand)"],
    ["esquerda", "Esquerda (backhand)"], ["rede", "Rede (voleio e smash)"],
  ];
  var OP = {
    nivel: [
      ["iniciante", "Iniciante", "Joga há pouco tempo"],
      ["intermediario", "Intermediário", "Sustenta trocas e joga partidas"],
      ["avancado", "Avançado", "Golpes consistentes e variados"],
      ["competidor", "Competidor", "Joga torneios com frequência"],
    ],
    mao: [["destro", "Destro"], ["canhoto", "Canhoto"]],
    backhand: [["uma", "Uma mão"], ["duas", "Duas mãos"]],
    piso: [["saibro", "Saibro"], ["rapida", "Quadra rápida"], ["ambos", "Os dois"]],
    padraoPonto: [
      ["ofensivo", "Ofensivo", "Busca abreviar o ponto e ataca assim que tem ângulo"],
      ["construtor", "Construtor", "Sustenta a troca até abrir espaço, sem forçar cedo"],
      ["defensivo", "Defensivo", "Prioriza não errar e devolve a decisão ao adversário"],
    ],
    rede: [
      ["sempre", "Subo sempre que posso"],
      ["convidado", "Só quando a bola vem curta"],
      ["evita", "Evito a rede"],
    ],
    devolucao: [
      ["agressiva", "Agressiva", "Ataco o segundo saque"],
      ["segura", "Segura", "Priorizo colocar a bola em jogo"],
    ],
    pressao: [
      ["mantem", "Mantenho meu jogo"],
      ["acelera", "Acelero e arrisco mais"],
      ["trava", "Travo e fico mais conservador"],
    ],
    advEstilo: [
      ["ofensivo", "Ofensivo", "Ataca cedo"],
      ["construtor", "Construtor", "Sustenta a troca"],
      ["defensivo", "Defensivo", "Devolve tudo"],
      ["naoSei", "Não sei"],
    ],
    advMao: [["destro", "Destro"], ["canhoto", "Canhoto"], ["naoSei", "Não sei"]],
  };

  var ETAPAS = [
    { titulo: "Sobre você", campos: ["nivel", "mao", "backhand", "piso"] },
    { titulo: "Seu jogo", campos: ["armaPrincipal", "pontoFraco", "padraoPonto"] },
    { titulo: "Em quadra", campos: ["rede", "devolucao", "pressao"] },
    { titulo: "Adversário (opcional)", campos: [] },
  ];

  var app = document.getElementById("app");
  var lateral = document.getElementById("lateral");
  var navInf = document.getElementById("navInf");
  var painelMais = document.getElementById("painelMais");
  var painelFundo = document.getElementById("painelFundo");
  var btMais = document.getElementById("btMais");
  var auth = null;
  var estado = { dados: null, ficha: null, fluxo: null };
  var posicoes = {}, pilha = [], voltando = false, menuTocado = false;

  /* ── utilidades ── */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function ir(rota) { if (location.hash === rota) rotear(); else location.hash = rota; }
  /* Troca o conteúdo. Ao voltar de um detalhe a posição de rolagem anterior é restaurada;
     em qualquer outra navegação a tela começa no topo. `provisoria` = "Carregando…" (não consome a restauração). */
  /* ── vídeo da partida: abre o player do próprio YouTube, Vimeo ou Google Drive dentro da página, só quando a pessoa toca em "Assistir aqui".
     O aplicativo guarda apenas o endereço; o vídeo continua na plataforma de origem. Outros endereços abrem em nova aba. ── */
  function embedDeVideo(url) {
    var u; try { u = new URL(String(url || "")); } catch (e) { return null; }
    if (u.protocol !== "https:") return null;
    var h = u.hostname.replace(/^www\./, "").replace(/^m\./, ""), id = "", m;
    function segundos(t) { if (!t) return 0; var r = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(t); return r ? (+r[1] || 0) * 3600 + (+r[2] || 0) * 60 + (+r[3] || 0) : 0; }
    if (h === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (h === "youtube.com" || h === "music.youtube.com") { id = u.searchParams.get("v") || ((m = /^\/(?:embed|shorts|live|v)\/([^/?]+)/.exec(u.pathname)) ? m[1] : ""); }
    if (id) {
      if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
      var ini = segundos(u.searchParams.get("t") || u.searchParams.get("start") || "");
      return { provedor: "YouTube", src: "https://www.youtube-nocookie.com/embed/" + id + "?rel=0&playsinline=1" + (ini ? "&start=" + ini : "") };
    }
    if (h === "vimeo.com" || h === "player.vimeo.com") {
      m = /^\/(?:video\/)?(\d{6,12})(?:\/([0-9a-f]{6,20}))?/.exec(u.pathname);
      if (m) return { provedor: "Vimeo", src: "https://player.vimeo.com/video/" + m[1] + (m[2] || u.searchParams.get("h") ? "?h=" + (m[2] || u.searchParams.get("h")) : "") };
    }
    if (h === "drive.google.com") {
      m = /^\/file\/d\/([A-Za-z0-9_-]{10,80})/.exec(u.pathname);
      if (m) return { provedor: "Google Drive", src: "https://drive.google.com/file/d/" + m[1] + "/preview" };
    }
    return null;
  }
  function videoHtml(url, rotulo) {
    if (!url) return "";
    var e = embedDeVideo(url), seguro = esc(url);
    return '<div class="video-bloco"' + (e ? ' data-video-src="' + esc(e.src) + '" data-video-titulo="' + esc(rotulo || "Vídeo da partida") + '"' : "") + '><div class="acoes">' +
      (e ? '<button type="button" class="btn btn-primario btn-pequeno" data-video-abrir>Assistir aqui</button>' : "") +
      '<a class="btn btn-secundario btn-pequeno" href="' + seguro + '" target="_blank" rel="noopener noreferrer nofollow">Abrir em nova aba<span class="sr"> (abre em nova aba)</span></a></div>' +
      (e ? '<p class="nota" style="margin-top:6px">O vídeo é reproduzido pelo ' + esc(e.provedor) + ', que pode registrar a visualização. Nada é carregado antes de você tocar em “Assistir aqui”.</p>' : '<p class="nota" style="margin-top:6px">Este endereço abre no site de origem.</p>') + '<div class="video-quadro" hidden></div></div>';
  }
  function ligarVideos() {
    Array.prototype.forEach.call(app.querySelectorAll("[data-video-src]"), function (bloco) {
      var bt = bloco.querySelector("[data-video-abrir]"), quadro = bloco.querySelector(".video-quadro");
      if (!bt || !quadro || bt.getAttribute("data-ligado")) return;
      bt.setAttribute("data-ligado", "1");
      bt.addEventListener("click", function () {
        if (!quadro.hidden) { quadro.textContent = ""; quadro.hidden = true; bt.textContent = "Assistir aqui"; return; }
        var f = document.createElement("iframe");
        f.src = bloco.getAttribute("data-video-src"); f.title = bloco.getAttribute("data-video-titulo");
        f.setAttribute("allow", "fullscreen; picture-in-picture; encrypted-media"); f.setAttribute("allowfullscreen", ""); f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
        f.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"); f.loading = "lazy";
        quadro.textContent = ""; quadro.appendChild(f); quadro.hidden = false; bt.textContent = "Fechar vídeo";
      });
    });
  }

  function tela(html, provisoria) {
    pararVoz();
    pararAoVivo();
    /* Competição: botões sem setas — o "‹" do link de voltar vira texto */
    if (MODO_COMP) html = html.replace(/>‹ Voltar([^<]*)</g, ">Voltar$1<").replace(/>‹ ([^<]+)</g, ">Voltar para $1<");
    app.innerHTML = html;
    ligarVoz();
    ligarVideos();
    document.body.classList.remove("teclado"); // o campo que estava em foco pode ter sumido com a tela anterior
    var y = 0;
    if (!provisoria && voltando) { y = posicoes[location.hash] || 0; voltando = false; }
    window.scrollTo(0, y);
    app.focus({ preventScroll: true });
  }

  /* ── ditado por voz ──
     Botão de microfone ao lado de campos de texto, com o reconhecimento de voz do próprio navegador (Safari no iPhone,
     Chrome no Android): o áudio não passa pelo QuadraLab nem é guardado; o que entra no campo é só texto, que o jogador
     revisa e salva. Sem suporte no navegador, o botão não aparece. */
  var vozAtiva = null;
  function ditadoDisponivel() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }
  function botaoVoz(idCampo) {
    if (!ditadoDisponivel()) return "";
    return '<div class="voz"><button type="button" class="btn btn-secundario voz-bt" data-voz="' + idCampo + '" aria-pressed="false">Falar</button>' +
      '<span class="nota voz-estado" id="voz-estado-' + idCampo + '" role="status" aria-live="polite"></span></div>' +
      '<div class="voz-aviso"><p class="nota">Ditado pelo navegador. O áudio não é guardado.</p><details class="voz-det"><summary>Como funciona</summary><p class="nota">O texto vem do reconhecimento de voz do seu navegador (Apple ou Google, conforme o aparelho). O QuadraLab não guarda o áudio: só o texto, que você revisa antes de salvar.</p></details></div>';
  }
  function pararVoz() { if (vozAtiva) { try { vozAtiva.rec.stop(); } catch (e) { /* já parado */ } vozAtiva = null; } }
  function ligarVoz() {
    app.querySelectorAll("[data-voz]").forEach(function (bt) {
      bt.addEventListener("click", function () {
        var idc = bt.getAttribute("data-voz"), campo = document.getElementById(idc), estadoEl = document.getElementById("voz-estado-" + idc);
        if (!campo) return;
        if (vozAtiva && vozAtiva.bt === bt) { pararVoz(); return; }
        pararVoz();
        var SR = window.SpeechRecognition || window.webkitSpeechRecognition, rec = new SR();
        rec.lang = "pt-BR"; rec.continuous = true; rec.interimResults = true;
        var base = campo.value, finais = "", max = campo.maxLength > 0 ? campo.maxLength : 1500;
        function pintar(interino) {
          var junto = base + (base && !/\s$/.test(base) ? " " : "") + finais + (interino ? interino : "");
          campo.value = junto.slice(0, max);
          campo.dispatchEvent(new Event("input", { bubbles: true }));
        }
        rec.onstart = function () { bt.textContent = "Parar"; bt.setAttribute("aria-pressed", "true"); bt.classList.add("voz-ativo"); estadoEl.textContent = "Ouvindo…"; };
        rec.onresult = function (ev) {
          var interino = "";
          for (var i = ev.resultIndex; i < ev.results.length; i++) {
            var t = ev.results[i][0].transcript;
            if (ev.results[i].isFinal) finais += t.replace(/^\s+/, "") + " "; else interino += t;
          }
          pintar(interino);
        };
        rec.onerror = function (ev) {
          var c = ev && ev.error;
          estadoEl.textContent = c === "not-allowed" || c === "service-not-allowed" ? "Permita o uso do microfone nas configurações do navegador."
            : c === "no-speech" ? "Não ouvi nada. Tente de novo."
            : c === "audio-capture" ? "Não encontrei um microfone."
            : c === "network" ? "Sem conexão para o reconhecimento de voz."
            : c === "aborted" ? "" : "Não foi possível ouvir agora.";
        };
        rec.onend = function () {
          if (vozAtiva && vozAtiva.rec === rec) vozAtiva = null;
          bt.textContent = "Falar"; bt.setAttribute("aria-pressed", "false"); bt.classList.remove("voz-ativo");
          if (estadoEl.textContent === "Ouvindo…") estadoEl.textContent = campo.value !== base ? "Revise o texto antes de salvar." : "";
        };
        vozAtiva = { rec: rec, bt: bt };
        try { rec.start(); } catch (e) { vozAtiva = null; estadoEl.textContent = "Não foi possível iniciar agora."; }
      });
    });
  }
  /* aviso rápido sobre a última ação; só é mostrado depois de o servidor confirmar (ou para dizer que falhou) */
  var toastTempo = null, toastEm = 0;
  function toast(texto, desfazer, erro) {
    var t = document.getElementById("toast");
    clearTimeout(toastTempo); toastEm = Date.now();
    t.className = "toast" + (erro ? " erro" : "");
    t.innerHTML = "<span></span>" + (desfazer ? '<button type="button" class="toast-desfazer">Desfazer</button>' : "");
    t.firstChild.textContent = texto;
    t.hidden = false;
    if (desfazer) t.querySelector("button").onclick = function () { t.hidden = true; desfazer(); };
    toastTempo = setTimeout(function () { t.hidden = true; }, 7000);
  }
  function novoId() {
    var b = new Uint8Array(12); crypto.getRandomValues(b);
    return "p" + Array.prototype.map.call(b, function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
  }
  function dataBR(iso) {
    try { return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }); }
    catch (e) { return ""; }
  }
  function ocupado(bt, sim, texto) {
    bt.disabled = sim;
    if (sim) { bt.dataset.txt = bt.textContent; bt.textContent = texto || "Aguarde…"; }
    else if (bt.dataset.txt) bt.textContent = bt.dataset.txt;
  }

  async function api(caminho, opcoes) {
    opcoes = opcoes || {};
    var headers = { "content-type": "application/json" };
    if (auth && auth.currentUser) headers.authorization = "Bearer " + (await auth.currentUser.getIdToken());
    var r;
    try {
      r = await fetch("/.netlify/functions/" + caminho, { method: opcoes.metodo || "GET", headers: headers, body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined });
    } catch (e) {
      throw new Error("Sem conexão. Verifique sua internet e tente de novo.");
    }
    var corpo = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(corpo.erro || "Algo deu errado. Tente de novo em instantes.");
    return corpo;
  }
  async function carregarDados() {
    estado.dados = await api("player-dados");
    estado.ficha = estado.dados.ficha ? JSON.parse(JSON.stringify(estado.dados.ficha)) : { adversario: {} };
    estado.ficha.adversario = estado.ficha.adversario || {};
    return estado.dados;
  }

  /* ── telas ── */
  /* ── cadastro, entrada e recuperação de senha ──
     Um formulário por vez (#/criar, #/entrar, #/recuperar). A conta continua sendo criada por player-conta e a entrada
     por Firebase Auth: nada de sucesso simulado. Os benefícios do plano gratuito vêm da mesma fonte da página de planos
     (player-publico); se não carregarem, o bloco simplesmente não aparece. Quando o visitante chegou por um link para uma
     área específica (a rota não é de acesso), a troca entre cadastro e entrada não mexe no endereço: o destino é preservado. */
  var gratisPublico = null; // { itens, links } depois de carregado
  function carregarGratisPublico() {
    if (gratisPublico) return Promise.resolve(gratisPublico);
    return fetch("/.netlify/functions/player-publico").then(function (r) { if (!r.ok) throw new Error(); return r.json(); }).then(function (d) {
      var free = (d.planos || []).filter(function (p) { return p.id === "free"; })[0];
      gratisPublico = { itens: free ? free.itens : [], links: d.links || {} };
      return gratisPublico;
    });
  }
  var ROTAS_ACESSO = { entrar: 1, criar: 1, recuperar: 1 };
  function irAcesso(modo) {
    var atual = location.hash.replace(/^#\/?/, "").split("?")[0].split("/")[0];
    if (ROTAS_ACESSO[atual]) ir("#/" + modo); else telaEntrar(modo);
  }
  var emailAcesso = "";
  function telaEntrar(modo) {
    modo = ROTAS_ACESSO[modo] ? modo : "criar";
    var criar = modo === "criar", recuperar = modo === "recuperar";
    document.body.classList.add("acesso");
    var titulo = criar ? "Crie sua conta grátis" : recuperar ? "Recuperar senha" : "Bem-vindo de volta";
    var sub = criar ? "Comece com seu plano de jogo inicial e evolua no seu ritmo." : recuperar ? "Informe seu e-mail para receber as instruções de recuperação." : "Entre para continuar seu planejamento.";
    function campo(id, rotulo, extra) {
      return '<div class="ac-campo"><label for="' + id + '">' + rotulo + "</label>" + extra + '<p class="ac-erro" id="erro-' + id + '" role="alert" hidden></p></div>';
    }
    tela(
      '<div class="ac-pagina">' +
        "<h1>" + titulo + "</h1>" +
        '<p class="ac-sub">' + sub + "</p>" +
        (/^#\/olhar/.test(location.hash) && !recuperar ? '<div class="ac-gratis"><p><strong>Você está a um passo do Olhar do treinador.</strong> <span>Entre ou crie a conta grátis: depois você escolhe a estratégia e envia a dúvida. Nada é cobrado antes de você revisar o pedido.</span></p></div>' : "") +
        (criar ? '<div class="ac-gratis"><p><strong>Acesso gratuito</strong> <span>Sem cartão de crédito.</span></p><ul id="acBeneficios" hidden></ul></div>' : "") +
        '<form id="fAcesso" class="ac-form" novalidate>' +
          '<p class="ac-aviso" id="aviso" role="alert" hidden></p>' +
          (criar ? campo("nome", "Nome", '<input id="nome" name="name" autocomplete="name" maxlength="80" aria-describedby="erro-nome" required>') : "") +
          campo("email", "E-mail", '<input id="email" name="email" type="email" inputmode="email" autocomplete="' + (criar ? "email" : "username") + '" autocapitalize="none" spellcheck="false" aria-describedby="erro-email" required>') +
          (recuperar ? "" : campo("senha", "Senha",
            '<div class="ac-senha"><input id="senha" name="password" type="password" autocomplete="' + (criar ? "new-password" : "current-password") + '" aria-describedby="' + (criar ? "dica-senha " : "") + 'erro-senha" required>' +
            '<button type="button" class="ac-ver" id="btVer" aria-pressed="false" aria-controls="senha">Mostrar<span class="sr"> senha</span></button></div>' +
            (criar ? '<p class="ac-dica" id="dica-senha">Mínimo de 8 caracteres.</p>' : ""))) +
          '<button class="ac-botao" id="btAcesso" type="submit">' + (criar ? "Criar minha conta grátis" : recuperar ? "Enviar instruções" : "Entrar") + "</button>" +
          (modo === "entrar" ? '<p class="ac-links"><a href="#/recuperar" data-ir="recuperar">Esqueci minha senha</a></p>' : "") +
        "</form>" +
        '<p class="ac-troca">' + (criar ? 'Já tem conta? <a href="#/entrar" data-ir="entrar">Entrar</a>' : recuperar ? '<a href="#/entrar" data-ir="entrar">Voltar para entrar</a>' : 'Ainda não tem conta? <a href="#/criar" data-ir="criar">Criar conta grátis</a>') + "</p>" +
        (criar ? '<p class="ac-nota">Você pode ampliar seu plano dentro da plataforma quando precisar.</p><p class="ac-nota" id="acLegal" hidden></p>' : "") +
      "</div>"
    );
    var emailEl = document.getElementById("email"); emailEl.value = emailAcesso;
    emailEl.addEventListener("input", function () { emailAcesso = emailEl.value; });
    app.querySelectorAll("[data-ir]").forEach(function (a) {
      a.addEventListener("click", function (ev) { ev.preventDefault(); irAcesso(a.getAttribute("data-ir")); });
    });
    var ver = document.getElementById("btVer");
    if (ver) ver.addEventListener("click", function () {
      var s = document.getElementById("senha"), mostrar = s.type === "password";
      s.type = mostrar ? "text" : "password";
      ver.setAttribute("aria-pressed", String(mostrar));
      ver.firstChild.textContent = mostrar ? "Ocultar" : "Mostrar";
    });
    if (criar) carregarGratisPublico().then(function (g) {
      var ul = document.getElementById("acBeneficios"), legal = document.getElementById("acLegal");
      if (ul && g.itens.length) { ul.innerHTML = g.itens.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join(""); ul.hidden = false; }
      if (legal && (g.links.termos || g.links.privacidade)) {
        legal.innerHTML = "Ao criar a conta, você concorda com " + (g.links.termos ? '<a href="' + esc(g.links.termos) + '" target="_blank" rel="noopener">os Termos de Uso</a>' : "") + (g.links.termos && g.links.privacidade ? " e " : "") + (g.links.privacidade ? '<a href="' + esc(g.links.privacidade) + '" target="_blank" rel="noopener">a Política de Privacidade</a>' : "") + ".";
        legal.hidden = false;
      }
    }).catch(function () { /* sem a lista, o bloco mostra só o essencial: nada é inventado */ });

    var aviso = document.getElementById("aviso");
    function limpar() {
      aviso.hidden = true;
      app.querySelectorAll(".ac-erro").forEach(function (p) { p.hidden = true; p.textContent = ""; });
      app.querySelectorAll("[aria-invalid]").forEach(function (i) { i.removeAttribute("aria-invalid"); });
    }
    function erroCampo(id, texto) {
      var p = document.getElementById("erro-" + id), i = document.getElementById(id);
      p.textContent = texto; p.hidden = false; if (i) i.setAttribute("aria-invalid", "true");
    }
    function mensagemFirebase(e) {
      var cod = e && e.code || "";
      return /invalid-credential|wrong-password|user-not-found|invalid-login/.test(cod) ? "E-mail ou senha incorretos."
        : /too-many-requests/.test(cod) ? "Muitas tentativas. Aguarde alguns minutos e tente de novo."
        : /network/.test(cod) ? "Sem conexão. Verifique sua internet e tente de novo."
        : (e && e.message) || "Não foi possível continuar agora.";
    }
    document.getElementById("fAcesso").addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var bt = document.getElementById("btAcesso");
      if (bt.disabled) return; // bloqueia envio duplicado
      limpar();
      var email = document.getElementById("email").value.trim();
      var senha = recuperar ? "" : document.getElementById("senha").value;
      var nome = criar ? document.getElementById("nome").value.trim() : "";
      var primeiro = null;
      function inv(id, t) { erroCampo(id, t); if (!primeiro) primeiro = id; }
      if (criar && !nome) inv("nome", "Informe seu nome.");
      if (!email) inv("email", "Informe seu e-mail."); else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) inv("email", "Informe um e-mail válido.");
      if (!recuperar) { if (!senha) inv("senha", "Informe sua senha."); else if (criar && senha.length < 8) inv("senha", "A senha precisa ter pelo menos 8 caracteres."); }
      if (primeiro) { document.getElementById(primeiro).focus(); return; }
      ocupado(bt, true, criar ? "Criando sua conta..." : recuperar ? "Enviando..." : "Entrando...");
      try {
        if (recuperar) {
          try { await auth.sendPasswordResetEmail(email); } catch (e) { if (/network/.test((e && e.code) || "")) throw e; /* não revela se o e-mail existe */ }
          aviso.textContent = "Se houver uma conta com esse e-mail, você vai receber as instruções para criar uma nova senha.";
          aviso.className = "ac-aviso ac-aviso-info"; aviso.hidden = false;
          ocupado(bt, false);
          return;
        }
        if (criar) await api("player-conta", { metodo: "POST", corpo: { nome: nome, email: email, senha: senha } });
        await auth.signInWithEmailAndPassword(email, senha);
        /* onAuthStateChanged segue daqui: perfil do jogador e área adequada */
      } catch (e) {
        var msg = mensagemFirebase(e);
        if (criar && /e-mail já tem uma conta|já tem uma conta/i.test(msg)) erroCampo("email", msg);
        else if (criar && /e-mail válido/i.test(msg)) erroCampo("email", msg);
        else if (criar && /pelo menos 8/.test(msg)) erroCampo("senha", msg);
        else if (criar && /seu nome/i.test(msg)) erroCampo("nome", msg);
        else if (modo === "entrar" && msg === "E-mail ou senha incorretos.") erroCampo("senha", msg);
        else { aviso.textContent = msg; aviso.className = "ac-aviso"; aviso.hidden = false; }
        ocupado(bt, false);
      }
    });
  }


  /* ══ dados derivados ═══════════════════════════════════════════════
     Vocabulário da interface (os dados continuam com os nomes antigos):
     "estratégia" = plano (planos/{id}) · "programa de treino" = planejamento
     (planejamentos/{id}) · "treino" = sessão do programa (id s{semana}-{n}). */
  function planosProntos() { return (estado.dados.planos || []).filter(function (p) { return p.status === "pronto"; }); }
  function planejamentosProntos() { return (estado.dados.planejamentos || []).filter(function (x) { return x.status === "pronto"; }); }
  function planoPorId(id) { return (estado.dados.planos || []).filter(function (p) { return p.id === id; })[0]; }
  function recursos() { return estado.dados.recursos || {}; }
  function podeRegistrar() { return !!recursos().treinoDia; }

  function tituloCurto(t, max) {
    t = String(t || "").replace(/\s+/g, " ").trim();
    max = max || 46;
    if (t.length <= max) return t;
    var corte = t.slice(0, max), i = corte.lastIndexOf(" ");
    return corte.slice(0, i > 24 ? i : max).replace(/[\s,;:.\-–—]+$/, "") + "…";
  }
  function primeiraFrase(t, max) {
    t = String(t || "").replace(/\s+/g, " ").trim();
    var m = t.match(/^.*?[.!?](\s|$)/);
    var f = m ? m[0].trim() : t;
    return tituloCurto(f, max || 120);
  }
  function tipoEstrategia(p) { return p.adversarioNome ? "Contra adversário" : "Meu jogo"; }
  function nomeEstrategia(p) { return p && p.plano ? tituloCurto(p.plano.titulo) : "Estratégia"; }
  function diaDaSemana(iso) {
    try { return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long" }).replace(/-feira$/, "").replace(/^./, function (c) { return c.toUpperCase(); }); }
    catch (e) { return ""; }
  }
  function dataTreino(iso) { return diaDaSemana(iso) + ", " + dataCurta(iso); }

  /* ── próximo treino: UMA regra, usada pelo Início e por Treinos ──
     Considera o programa mais recente que ainda tem treino em aberto.
     Ordem: em andamento → de hoje → o próximo agendado → pendente (atrasado).
     Sem o registro de treinos (Plano 2) não há "pendente": só hoje e os futuros. */
  var ROTULO_TREINO = { andamento: "Treino em andamento", hoje: "Treino de hoje", proximo: "Próximo treino", pendente: "Treino pendente" };
  /* aberto = ainda a fazer. Sem o registro (Plano 2) ninguém marca como feito, então treinos de datas passadas não contam como abertos. */
  function treinoAberto(s) { return (s.status === "pendente" || s.status === "em_andamento") && (podeRegistrar() || s.data >= hojeISO()); }
  function programaAtivo() {
    var lista = planejamentosProntos();
    for (var i = 0; i < lista.length; i++) if ((lista[i].sessoes || []).some(treinoAberto)) return lista[i];
    return null;
  }
  function escolherProximoTreino() {
    var pj = programaAtivo();
    if (!pj) return null;
    var hoje = hojeISO(), reg = podeRegistrar();
    var abertos = pj.sessoes.filter(treinoAberto).sort(function (a, b) { return a.data < b.data ? -1 : a.data > b.data ? 1 : 0; });
    var andamento = abertos.filter(function (s) { return s.status === "em_andamento"; })[0];
    var deHoje = abertos.filter(function (s) { return s.status === "pendente" && s.data === hoje; })[0];
    var futuro = abertos.filter(function (s) { return s.status === "pendente" && s.data > hoje; })[0];
    var atrasados = reg ? abertos.filter(function (s) { return s.status === "pendente" && s.data < hoje; }) : [];
    var tipo, s;
    if (andamento) { s = andamento; tipo = "andamento"; }
    else if (deHoje) { s = deHoje; tipo = "hoje"; }
    else if (futuro) { s = futuro; tipo = "proximo"; }
    else if (atrasados.length) { s = atrasados[atrasados.length - 1]; tipo = "pendente"; }
    else return null;
    return { sessao: s, programa: pj, tipo: tipo, atrasados: atrasados.length - (tipo === "pendente" ? 1 : 0) };
  }
  function situacaoTreino(s) {
    if (s.status === "em_andamento") return "Em andamento";
    if (s.status === "feito") return "Feito";
    if (s.status === "parcial") return "Parcial";
    if (s.status === "nao_feito") return "Não feito";
    var hoje = hojeISO();
    return s.data === hoje ? "Hoje" : s.data < hoje ? (podeRegistrar() ? "Pendente" : "Anterior") : "Agendado";
  }
  function classeSituacao(s) {
    return { em_andamento: "andamento", feito: "feito", parcial: "parcial", nao_feito: "naofeito" }[s.status] || (s.data === hojeISO() ? "hoje" : "agendado");
  }
  function chipSituacao(s) {
    var simbolo = { feito: "✓ ", parcial: "◐ ", nao_feito: "✕ ", em_andamento: "● " }[s.status] || "";
    return '<span class="situacao s-' + classeSituacao(s) + '">' + simbolo + esc(situacaoTreino(s)) + "</span>";
  }
  function andamentoPrograma(pj) {
    var total = (pj.sessoes || []).length, feitos = 0, parciais = 0;
    (pj.sessoes || []).forEach(function (s) { if (s.status === "feito") feitos++; else if (s.status === "parcial") parciais++; });
    return { total: total, feitos: feitos, parciais: parciais, concluidos: feitos + parciais };
  }
  function atualizarTreinoLocal(pjId, sessaoId, status) {
    (estado.dados.planejamentos || []).forEach(function (pj) {
      if (pj.id === pjId) (pj.sessoes || []).forEach(function (s) { if (s.id === sessaoId) s.status = status; });
    });
  }
  function botaoTreino(sel) {
    var t = { andamento: "Continuar treino", hoje: "Ver treino de hoje", proximo: "Ver próximo treino", pendente: "Ver treino pendente" }[sel.tipo];
    return '<a class="btn btn-primario btn-grande" href="#/treino/' + esc(sel.programa.id) + "/" + esc(sel.sessao.id) + '">' + t + "</a>";
  }
  function cartaoTreinoHtml(sel) {
    var s = sel.sessao, pj = sel.programa, min = pj.params && pj.params.minutos;
    return '<div class="cartao treino-destaque t-' + sel.tipo + '"><p class="olho">' + ROTULO_TREINO[sel.tipo] + "</p><h2>" + esc(s.titulo) + "</h2>" +
      '<p class="treino-meta">' + esc(dataTreino(s.data)) + (min ? " · " + esc(min) + " min" : "") + " " + chipSituacao(s) + "</p>" +
      '<p class="nota" style="margin-top:6px">Programa: ' + esc(tituloCurto(pj.titulo, 40)) + "</p>" +
      botaoTreino(sel) +
      '<a class="btn btn-secundario largo" style="margin-top:8px" href="' + hrefAquecimento("treino/" + sel.programa.id + "/" + sel.sessao.id) + '">Abrir aquecimento</a>' +
      (sel.atrasados > 0 ? '<p class="nota" style="margin-top:10px">Você tem mais ' + sel.atrasados + (sel.atrasados === 1 ? " treino pendente" : " treinos pendentes") + ' · <a href="#/treinos">ver em Treinos</a></p>' : "") +
      "</div>";
  }

  /* ── perguntas do plano (lacunas) ── */
  var GRUPO_ROTULO = { jogador: "Sobre você", adversario: "Sobre o adversário", partida: "Condições desta partida" };
  function lacunasDoPlano(p) {
    return ((p.plano && p.plano.lacunas) || []).map(function (l) {
      if (typeof l === "string") return { pergunta: l, grupo: "jogador", opcoes: [], porque: "" };
      return { pergunta: l.pergunta, grupo: l.grupo || "jogador", opcoes: l.opcoes || [], porque: l.porque || "" };
    }).filter(function (l) { return l.pergunta; });
  }
  function contextoDaPergunta(p, l) { return l.grupo === "jogador" ? "" : (p.adversarioNome || ""); }
  function respostaSalva(p, l) {
    var ctx = contextoDaPergunta(p, l);
    return (estado.dados.complementos || []).filter(function (c) {
      return c.pergunta === l.pergunta && (c.contexto || "") === ctx;
    })[0] || null;
  }
  function perguntasPendentes(p) { return lacunasDoPlano(p).filter(function (l) { return !respostaSalva(p, l); }); }

  /* ── lista de estratégias ── */
  function itemEstrategiaHtml(p) {
    if (p.status === "gerando") {
      return '<a class="item-estrategia" href="#/gerando/' + esc(p.id) + '"><span class="ie-corpo"><strong class="ie-titulo">Estratégia em preparação…</strong>' +
        '<span class="ie-meta">' + esc(dataBR(p.criadoEm)) + '</span></span><span class="seta" aria-hidden="true">›</span></a>';
    }
    return '<a class="item-estrategia" href="#/estrategia/' + esc(p.id) + '" title="' + esc(p.plano.titulo) + '"><span class="ie-corpo"><strong class="ie-titulo">' + esc(p.plano.titulo) + "</strong>" +
      '<span class="ie-meta"><span class="tag' + (p.adversarioNome ? " tag-adv" : "") + '">' + tipoEstrategia(p) + "</span>" +
      (p.adversarioNome ? " <strong>" + esc(p.adversarioNome) + "</strong> ·" : "") + " " + esc(dataBR(p.criadoEm)) + '</span></span><span class="seta" aria-hidden="true">›</span></a>';
  }
  function textoCota() { return avisoCota(); }
  function ligarGerar() {
    app.querySelectorAll("[data-gerar]").forEach(function (b) { b.addEventListener("click", function () { gerarPlano(b); }); });
  }

  /* ══ Início ════════════════════════════════════════════════════════
     O foco é o próximo treino. Nada de oferta de assinatura aqui: o acesso fica no avatar e em Plano e assinatura. */
  function esteiraHtml() {
    return '<section class="cartao compacto como-funciona" aria-labelledby="t-como"><h2 id="t-como">Como funciona</h2><ol>' +
      "<li><strong>Estratégia</strong><span>Como jogar com as suas características e contra cada adversário.</span></li>" +
      "<li><strong>Jogadas</strong><span>Sequências práticas para aplicar a estratégia.</span></li>" +
      "<li><strong>Treinos</strong><span>A prática das jogadas, organizada em semanas e registrada por você.</span></li></ol>" +
      '<p class="nota" style="margin-top:8px">Seu acesso: <strong>' + esc(assinaturaDoJogador().nome) + '</strong> · <a href="#/assinatura">Plano e assinatura</a></p></section>';
  }
  function telaInicio() {
    var d = estado.dados;
    var primeiroNome = (d.perfil.nome || "").split(" ")[0];
    var prontos = planosProntos(), estrategia = prontos[0];
    var gerando = (d.planos || []).filter(function (p) { return p.status === "gerando"; })[0];
    var programas = planejamentosProntos();
    var sel = escolherProximoTreino();
    var html = '<h1 class="saudacao">Olá' + (primeiroNome ? ", " + esc(primeiroNome) : "") + "</h1>", destaque = "", sub = "", explicar = false;

    if (!d.fichaCompleta) {
      explicar = true;
      sub = "Vamos começar pelo seu perfil.";
      destaque = '<div class="cartao destaque"><p class="olho">Primeiro passo</p><h2>Conte como você joga</h2><p class="nota" style="margin-top:6px">São 4 etapas rápidas, quase tudo de tocar e escolher. Seu progresso fica salvo.</p>' +
        '<a class="btn btn-primario btn-grande" href="#/ficha/1">' + (d.ficha && Object.keys(d.ficha).some(function (k) { return d.ficha[k] && k !== "adversario"; }) || perfilRascunhado() ? "Continuar meu perfil" : "Completar meu perfil") + "</a></div>";
    } else if (!estrategia) {
      explicar = true;
      sub = "Seu perfil está completo.";
      destaque = '<div class="cartao destaque"><p class="olho">Próximo passo</p><h2>Crie a sua estratégia</h2><p class="nota" style="margin-top:6px">Com o seu perfil, montamos como jogar: as prioridades e as jogadas para aplicar.</p>' +
        (gerando ? '<a class="btn btn-primario btn-grande" href="#/gerando/' + esc(gerando.id) + '">Acompanhar minha estratégia</a>'
          : d.podeGerar ? '<button class="btn btn-primario btn-grande" data-gerar type="button">Criar minha estratégia</button><p class="nota" style="margin-top:8px">' + esc(avisoCota()) + "</p>"
          : '<a class="btn btn-primario btn-grande" href="#/estrategia">Ver estratégias</a><p class="nota" style="margin-top:10px">' + esc(avisoCota()) + "</p>") + "</div>";
    } else if (!programas.length) {
      explicar = true;
      sub = "Sua estratégia está pronta. Falta organizar a prática.";
      destaque = '<div class="cartao destaque"><p class="olho">Próximo passo</p><h2>Organize seus treinos</h2><p class="nota" style="margin-top:6px">Escolha as jogadas que quer praticar e monte um programa de treino nos dias que cabem na sua rotina.</p>' +
        '<a class="btn btn-primario btn-grande" href="' + (recursos().planejamento ? "#/planejar/" + esc(estrategia.id) : "#/treinos") + '">Organizar meus treinos</a></div>';
    } else if (sel) {
      sub = sel.tipo === "andamento" ? "Você começou um treino. Falta terminar."
        : sel.tipo === "hoje" ? "Hoje tem treino."
        : sel.tipo === "pendente" ? "Há treinos pendentes no seu programa."
        : sel.atrasados > 0 ? "Você tem " + sel.atrasados + (sel.atrasados === 1 ? " treino pendente." : " treinos pendentes.") : "Seu próximo treino está agendado.";
      destaque = cartaoTreinoHtml(sel);
    } else {
      sub = "Você concluiu os treinos agendados.";
      destaque = '<div class="cartao destaque"><p class="olho">Programa concluído</p><h2>Hora de organizar os próximos treinos</h2><p class="nota" style="margin-top:6px">Veja como foi em Treinos ou monte um novo programa.</p>' +
        '<a class="btn btn-primario btn-grande" href="#/planejar/' + esc(estrategia.id) + '">Organizar novos treinos</a><p style="margin-top:8px"><a class="btn btn-texto" href="#/treinos">Ver histórico</a></p></div>';
    }
    html += (sub ? '<p class="sub">' + esc(sub) + "</p>" : "") + '<div style="margin-top:14px">' + destaque + "</div>" + cartaoSimuladorHtml() + (estrategia ? '<div id="olharInicio" style="margin-top:14px"></div>' : "") + preparacaoInicioHtml();
    if (explicar) html += '<div style="margin-top:14px">' + esteiraHtml() + "</div>";

    /* "Qual é minha estratégia, quais jogadas vou praticar e qual é meu próximo treino?" */
    if (estrategia) {
      var marcadas = (estrategia.escolhidas || []).length;
      var pjAtivo = programaAtivo() || programas[0];
      var prog = pjAtivo ? andamentoPrograma(pjAtivo) : null;
      var tituloEst = estrategia.plano.titulo, tituloProg = pjAtivo ? pjAtivo.titulo : "";
      html += '<div class="indicadores">' +
        '<a class="indicador" href="#/estrategia/' + esc(estrategia.id) + '" title="' + esc(tituloEst) + '"><span class="ind-rotulo">Sua estratégia</span><strong class="clamp2">' + esc(tituloEst) + '</strong><span class="ind-nota">' + tipoEstrategia(estrategia) + (estrategia.adversarioNome ? " · " + esc(estrategia.adversarioNome) : "") + "</span></a>" +
        '<a class="indicador" href="#/jogadas/' + esc(estrategia.id) + '"><span class="ind-rotulo">Jogadas para praticar</span><strong>' + (marcadas ? marcadas + (marcadas === 1 ? " selecionada" : " selecionadas") : "Escolher jogadas") + '</strong><span class="ind-nota">' + ((estrategia.plano.jogadas || []).length) + " disponíveis</span></a>" +
        '<a class="indicador" href="' + (prog ? "#/treinos" : recursos().planejamento ? "#/planejar/" + esc(estrategia.id) : "#/treinos") + '"' + (tituloProg ? ' title="' + esc(tituloProg) + '"' : "") + '><span class="ind-rotulo">Treinos</span><strong>' + (prog ? (podeRegistrar() ? prog.concluidos + " de " + prog.total + " treinos concluídos" : prog.total + " treinos previstos") : "Sem programa") + '</strong><span class="ind-nota clamp2">' + (prog ? esc(tituloProg) : "Organizar meus treinos") + "</span></a></div>";
    }
    if (estrategia) html += cartaoPartidasInicio();
    if (window.QL_HUB) html += window.QL_HUB.cartaoInicio();
    html += '<section class="cartao compacto" style="margin-top:14px" aria-labelledby="t-plano-ini"><h2 id="t-plano-ini">Seu plano</h2><p class="nota" style="margin-top:6px"><strong>' + esc(assinaturaDoJogador().nome) + '</strong> · veja o que o seu plano inclui, compare os planos ou contrate um atendimento com o Richard.</p>' +
      '<div class="acoes"><a class="btn btn-secundario" href="#/assinatura">Plano e assinatura</a><a class="btn btn-secundario" href="#/consultorias">Consultorias</a></div></section>';
    tela(html);
    ligarGerar();
    if (estrategia) preencherOlharInicio();
    anexarCartaoInstalar();
  }
  /* Simulador de decisões: abre dentro do app (#/simulador), com o menu do Player/Competição em volta. O simulador continua sendo a página
     ../decisoes/, carregada num quadro no modo embutido (?embed=1): sem a marca e o rodapé dela, e cada tela que ela abre vira o endereço
     daqui (#/simulador/<tela>), para recarregar e voltar no mesmo lugar. Mesmo domínio: o progresso e o resumo ficam no mesmo navegador. */
  function telaSimulador(sub) {
    var alvo = /^[a-z0-9.-]{1,60}$/.test(sub || "") ? sub : "inicio";
    document.body.classList.add("rota-sim");
    tela('<section class="sim-embutido" aria-label="Simulador de decisões"><iframe id="simQuadro" class="sim-quadro" title="Simulador de decisões" src="../decisoes/?embed=1#' + alvo + '"></iframe></section>');
    ajustarSimulador();
  }
  function ajustarSimulador() {
    var f = document.getElementById("simQuadro"); if (!f) return;
    var nav = document.getElementById("navInf"), baixo = nav && !nav.hidden && getComputedStyle(nav).display !== "none" ? nav.offsetHeight : 0;
    f.style.height = Math.max(420, window.innerHeight - f.getBoundingClientRect().top - baixo) + "px";
  }
  window.addEventListener("resize", ajustarSimulador);
  window.addEventListener("message", function (e) {
    var f = document.getElementById("simQuadro"), d = e.data;
    if (!f || e.source !== f.contentWindow || e.origin !== location.origin || !d || d.tipo !== "ql-sim-rota") return;
    var h = String(d.rota || "inicio");
    if (/^[a-z0-9.-]{1,60}$/.test(h) && location.hash !== "#/simulador/" + h) history.replaceState(history.state, "", "#/simulador/" + h);
  });
  /* Cartão do simulador em destaque no Início. O simulador grava um resumo só com números
     no navegador (mesmo domínio); aqui só lemos. Sem resumo, o cartão convida a começar. */
  function resumoSimulador() {
    var r = null;
    try { r = JSON.parse(localStorage.getItem("qlDecisoes:resumo") || "null"); } catch (e) { r = null; }
    if (!r || typeof r !== "object" || r.v !== 1) return null;
    var hoje = hojeISOLocal(), dias = {}, n = 0, agora = Date.now();
    (Array.isArray(r.dias) ? r.dias : []).forEach(function (x) { if (typeof x === "string") dias[x] = 1; });
    var d = new Date(hoje + "T12:00:00Z");
    if (!dias[hoje]) d = new Date(d.getTime() - 86400000);
    while (dias[d.toISOString().slice(0, 10)] && n < 999) { n++; d = new Date(d.getTime() - 86400000); }
    var num = function (x) { return Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0; };
    return { estrelas: num(r.estrelas), max: num(r.max), cenarios: num(r.cenarios), iniciados: num(r.iniciados), seguidos: n, recorde: num(r.recorde),
      revisoes: (Array.isArray(r.vencimentos) ? r.vencimentos : []).filter(function (v) { return Number.isFinite(v) && v <= agora; }).length };
  }
  function cartaoSimuladorHtml() {
    var r = resumoSimulador(), url = "#/simulador", titulo, texto, acao, alvo, nums = "";
    if (!r || !r.iniciados) {
      titulo = "Treine a sua leitura de jogo";
      texto = "Situações de ponto da Metodologia MTY: escolha a jogada, veja a resposta do adversário e entenda por que ela funciona. Ganhe estrelas e libere níveis.";
      acao = "Começar o simulador"; alvo = url;
    } else {
      nums = '<ul class="sim-nums"><li><span aria-hidden="true">★</span> ' + r.estrelas + (r.max ? " de " + r.max : "") + " estrelas</li>" +
        (r.seguidos ? "<li>" + r.seguidos + (r.seguidos === 1 ? " dia seguido" : " dias seguidos") + "</li>" : "") +
        (r.cenarios ? "<li>" + r.iniciados + " de " + r.cenarios + " padrões</li>" : "") + "</ul>";
      if (r.revisoes) { titulo = r.revisoes === 1 ? "1 padrão para revisar hoje" : r.revisoes + " padrões para revisar hoje"; texto = "Revisar no dia certo é o que fixa a decisão. Cada revisão volta no nível seguinte."; acao = "Fazer as revisões"; alvo = url + "/desafios"; }
      else if (r.iniciados < r.cenarios) { titulo = "Continue treinando a sua leitura"; texto = "Cada padrão tem quatro níveis: quadra rápida, saibro, adversários diferentes e o ponto decisivo."; acao = "Continuar"; alvo = url + "/cenarios"; }
      else { titulo = "Você já jogou todos os padrões"; texto = "Agora é velocidade: 10 decisões, 8 segundos cada, no modo relâmpago."; acao = "Jogar o relâmpago"; alvo = url + "/relampago"; }
    }
    return '<section class="simulador-ini" aria-labelledby="t-sim-ini"><p class="olho">' + (r && r.iniciados ? "Simulador de decisões" : '<span class="tag-novo">Novo</span> Simulador de decisões') + "</p>" +
      '<h2 id="t-sim-ini">' + esc(titulo) + "</h2><p>" + esc(texto) + "</p>" + nums +
      '<div class="acoes"><a class="btn btn-grande btn-sim" href="' + alvo + '">' + esc(acao) + "</a>" +
      (r && r.iniciados && alvo.indexOf("/relampago") < 0 ? '<a class="btn btn-texto btn-sim-sec" href="' + url + '/relampago">Modo relâmpago' + (r.recorde ? " · recorde " + r.recorde : "") + "</a>" : "") + "</div></section>";
  }
  function perfilRascunhado() { try { return !!localStorage.getItem(chaveRascunho()); } catch (e) { return false; } }

  /* ══ Estratégia ════════════════════════════════════════════════════ */
  function telaEstrategias() {
    var d = estado.dados;
    var html = "<h1>Suas estratégias</h1>" +
      '<p class="sub">Defina como jogar com suas características e contra cada adversário.</p>';
    if (!d.fichaCompleta) {
      html += '<div class="cartao" style="margin-top:18px"><h2>Complete o seu perfil</h2><p class="nota" style="margin-top:6px">São 4 etapas rápidas, quase tudo de tocar e escolher.</p>' +
        '<a class="btn btn-primario btn-grande" href="#/ficha/1">' + (d.ficha ? "Continuar meu perfil" : "Completar meu perfil") + "</a></div>";
    } else {
      var lista = (d.planos || []).filter(function (p) { return p.status === "pronto" || p.status === "gerando"; });
      if (lista.length) html += '<div class="cartao lista-estrategias" style="margin-top:18px">' + lista.map(itemEstrategiaHtml).join("") + "</div>";
      if (d.podeGerar) {
        html += '<button class="btn ' + (lista.length ? "btn-secundario" : "btn-primario btn-grande") + ' largo" data-gerar type="button" style="margin-top:14px">' + (lista.length ? "Criar nova estratégia" : "Criar minha estratégia") + "</button>" +
          '<p class="nota" style="margin-top:8px">' + esc(textoCota()) + " A nova estratégia usa o seu perfil atual, " + (lista.length ? "e a anterior continua salva. " : "") + '<a href="#/ficha/1">Revisar perfil</a></p>';
      } else {
        html += '<div style="margin-top:14px">' + limiteAtingidoHtml(d.semCotaMotivo, d.renovaEm) + "</div>";
      }
    }
    tela(html);
    ligarGerar();
  }

  function cartaoPersonalizarHtml(p) {
    var pend = perguntasPendentes(p), total = lacunasDoPlano(p).length;
    if (!total) return "";
    if (!pend.length) {
      return '<div class="cartao compacto"><p class="olho">Personalize melhor sua estratégia</p><p class="nota">✓ Você respondeu as ' + total + (total === 1 ? " pergunta" : " perguntas") + " sobre o seu jogo. " +
        '<a href="#/completar/' + esc(p.id) + '">Revisar respostas</a></p></div>';
    }
    return '<div class="cartao compacto personalizar"><p class="olho">Personalize melhor sua estratégia</p><h3>Complete ' + pend.length + (pend.length === 1 ? " informação" : " informações") + " sobre seu jogo</h3>" +
      '<p class="nota" style="margin-top:4px">Perguntas rápidas, com opções. Você pode responder “Não sei” ou deixar para depois.</p>' +
      '<a class="btn btn-secundario" href="#/completar/' + esc(p.id) + '" style="margin-top:12px">Completar informações</a></div>';
  }

  function telaEstrategia(id) {
    var p = planoPorId(id);
    if (!p || p.status !== "pronto") { ir("#/estrategia"); return; }
    var pl = p.plano, programa = planejamentosProntos().filter(function (x) { return x.baseadoEm === id; })[0];
    var prioridades = (pl.diretrizes || []).slice(0, 3);
    var msgWpp = "Olá, Richard! Criei uma estratégia no QuadraLab Player e quero saber sobre a consultoria.";
    var treinos;
    if (!recursos().planejamento) {
      treinos = '<a class="btn btn-secundario largo" href="#/treinos">Organizar meus treinos</a>';
    } else if (programa) {
      treinos = '<a class="btn btn-secundario largo" href="#/programa/' + esc(programa.id) + '">Ver programa de treino</a>';
    } else {
      treinos = '<a class="btn btn-secundario largo" href="#/planejar/' + esc(id) + '">Organizar meus treinos</a>';
    }
    tela(
      '<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/estrategia">‹ Suas estratégias</a></p>' +
      '<p><span class="tag' + (p.adversarioNome ? " tag-adv" : "") + '">' + tipoEstrategia(p) + "</span>" + (p.adversarioNome ? " <strong>" + esc(p.adversarioNome) + "</strong>" : "") +
        ' <span class="nota">· ' + esc(dataBR(p.criadoEm)) + "</span></p>" +
      '<h1 style="margin-top:10px">' + esc(pl.titulo) + "</h1>" +
      '<div class="cartao objetivo"><p class="olho">Objetivo principal</p><p>' + esc(pl.resumo) + "</p></div>" +
      (prioridades.length ? '<h2 class="secao" id="t-prio">Prioridades</h2><ol class="prioridades" aria-labelledby="t-prio">' + prioridades.map(function (x) {
        return "<li><strong>" + esc(x.titulo) + '</strong><span class="clamp2">' + esc(x.acao) + "</span></li>";
      }).join("") + "</ol>" : "") +
      '<a class="btn btn-primario btn-grande" href="#/jogadas/' + esc(id) + '">Ver jogadas</a>' +
      evolucaoHtml(p) +
      '<div style="margin-top:14px">' + cartaoPersonalizarHtml(p) + "</div>" +
      '<div style="margin-top:14px">' + treinos + "</div>" +
      '<p style="margin-top:6px"><a class="btn btn-texto" href="#/partidas/nova?plano=' + esc(id) + '">Registrar uma partida com esta estratégia</a></p>' +
      '<div class="detalhes-grupo">' +
        '<details class="det"><summary>Todas as diretrizes (' + (pl.diretrizes || []).length + ')</summary><ol class="diretrizes">' + (pl.diretrizes || []).map(function (x) {
          return "<li><h3>" + esc(x.titulo) + '</h3><p class="acao">' + esc(x.acao) + '</p><p class="porque"><b>Por quê:</b> ' + esc(x.porque) + "</p></li>";
        }).join("") + "</ol></details>" +
        '<details class="det"><summary>Sobre esta estratégia</summary><p class="nota" style="margin-top:8px">Gerada em ' + esc(dataBR(p.criadoEm)) + " com inteligência artificial, a partir da sua autoavaliação e seguindo a Metodologia MTY. Ela não substitui a avaliação de um treinador vendo você jogar.</p></details>" +
        '<details class="det"><summary>Criar outra estratégia</summary>' + blocoOutraEstrategia() + "</details>" +
      "</div>" +
      cartaoOlharEstrategiaHtml(id) +
      '<div class="consultoria"><p class="olho">Consultoria</p><h2>Quer a estratégia validada por um treinador?</h2>' +
        "<p>O Richard Tsukada pode revisar a sua estratégia, analisar um vídeo do seu jogo ou conversar com você ao vivo. São serviços contratados à parte da assinatura.</p>" +
        '<a class="btn largo" href="#/consultorias">Ver consultorias</a></div>'
    );
    ligarGerar();
    preencherPrecoOlhar("olharEstPreco");
    app.querySelectorAll("[data-sug]").forEach(function (bt) {
      bt.addEventListener("click", async function () {
        var y = window.scrollY, partes = bt.getAttribute("data-sug").split(":");
        ocupado(bt, true, "Salvando…");
        try {
          await api("player-dados", { metodo: "POST", corpo: { acao: "decidirSugestao", planoId: id, sugestaoId: partes[0], decisao: partes[1] } });
          p.decisoes = p.decisoes || {}; p.decisoes[partes[0]] = partes[1];
          telaEstrategia(id); window.scrollTo(0, y);
        } catch (e) { ocupado(bt, false); toast(e.message, null, true); }
      });
    });
  }
  /* Evolução Inteligente: o que os registros do jogador sugerem. São hipóteses com os motivos; o jogador aceita ou rejeita
     e a estratégia nunca muda sozinha. */
  function evolucaoHtml(p) {
    var ev = p.plano && p.plano.evolucao;
    if (!ev || (!(ev.hipoteses || []).length && !(ev.sugestoes || []).length)) return "";
    var f = p.fundamentacao || {}, dec = p.decisoes || {};
    var base = f.consideradas ? "Considerou " + f.consideradas + (f.consideradas === 1 ? " partida registrada" : " partidas registradas") + (f.totalRegistradas > f.consideradas ? " de " + f.totalRegistradas + " (as mais recentes, no volume do seu plano)" : "") + "." : "";
    return '<div class="cartao evolucao" style="margin-top:14px"><p class="olho">Evolução Inteligente</p><h2>O que os seus registros sugerem</h2>' +
      '<p class="nota" style="margin-top:6px">' + esc(base) + " São hipóteses baseadas no que você informou, não um diagnóstico. Sua estratégia não é alterada automaticamente.</p>" +
      ((ev.usou || []).length ? '<details class="det"><summary>Informações usadas</summary><ul class="beneficios">' + ev.usou.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></details>" : "") +
      ((ev.hipoteses || []).length ? '<ul class="beneficios" style="margin-top:10px">' + ev.hipoteses.map(function (h) { return "<li>" + esc(h.texto) + (h.base ? ' <span class="nota">(' + esc(h.base) + ")</span>" : "") + "</li>"; }).join("") + "</ul>" : "") +
      (ev.sugestoes || []).map(function (sg) {
        var d = dec[sg.id];
        return '<div class="sugestao" style="margin-top:12px;padding-top:12px;border-top:1px solid #DDE6E1"><strong>' + esc(sg.titulo) + "</strong><p>" + esc(sg.ajuste) + '</p><p class="nota">Por quê: ' + esc(sg.motivo) + "</p>" +
          (d === "aceita" || d === "rejeitada"
            ? '<p class="nota" style="margin-top:6px"><strong>' + (d === "aceita" ? "Você aceitou esta sugestão." : "Você rejeitou esta sugestão.") + '</strong> <button type="button" class="btn btn-texto" data-sug="' + esc(sg.id) + ':pendente">Desfazer</button></p>'
            : '<div class="acoes"><button type="button" class="btn btn-secundario" data-sug="' + esc(sg.id) + ':aceita">Aceitar</button><button type="button" class="btn btn-texto" data-sug="' + esc(sg.id) + ':rejeitada">Rejeitar</button></div>') + "</div>";
      }).join("") + "</div>";
  }
  function blocoOutraEstrategia() {
    var d = estado.dados;
    if (d.podeGerar) {
      return '<p class="nota" style="margin:8px 0 0">' + esc(textoCota()) + " A nova estratégia usa o seu perfil atual e as informações que você respondeu; a atual continua salva. Se o seu jogo mudou, ou é contra outro adversário, revise o perfil antes.</p>" +
        '<div class="acoes"><button class="btn btn-primario" data-gerar type="button">Criar nova estratégia com o perfil atual</button><a class="btn btn-secundario" href="#/ficha/1">Revisar perfil e criar</a></div>';
    }
    return '<div style="margin-top:8px">' + limiteAtingidoHtml(d.semCotaMotivo, d.renovaEm) + "</div>";
  }

  /* ── completar informações: uma pergunta por etapa ── */
  function telaCompletar(id, passo) {
    var p = planoPorId(id);
    if (!p || p.status !== "pronto") { ir("#/estrategia"); return; }
    var todas = lacunasDoPlano(p);
    if (!todas.length) { ir("#/estrategia/" + id); return; }
    var fl = estado.fluxo;
    if (!fl || fl.planoId !== id) fl = estado.fluxo = { planoId: id, itens: null, respondidas: 0, adiadas: 0, rascunho: {} };
    if (!fl.itens) fl.itens = (perguntasPendentes(p).length ? perguntasPendentes(p) : todas).slice(); // sem pendentes: revisão das respostas
    var itens = fl.itens;
    if (passo === "fim") { telaCompletarFim(p, fl); return; }
    var n = Math.min(Math.max(parseInt(passo, 10) || 1, 1), itens.length);
    var l = itens[n - 1], salva = respostaSalva(p, l), rasc = fl.rascunho[n] || {};
    var ctx = contextoDaPergunta(p, l);
    var rotuloGrupo = GRUPO_ROTULO[l.grupo] + (ctx && l.grupo === "adversario" ? ": " + ctx : "");
    var escolha = rasc.escolha != null ? rasc.escolha : (salva ? (l.opcoes.indexOf(salva.resposta) >= 0 || salva.resposta === "Não sei" ? salva.resposta : (l.opcoes.length ? "" : "")) : "");
    var detalhe = rasc.detalhe != null ? rasc.detalhe : (salva && l.opcoes.indexOf(salva.resposta) < 0 && salva.resposta !== "Não sei" ? salva.resposta : "");
    var opcoes = l.opcoes.concat(["Não sei"]);
    tela(
      '<div class="progresso"><div class="barra" role="progressbar" aria-valuemin="1" aria-valuemax="' + itens.length + '" aria-valuenow="' + n + '" aria-label="Pergunta ' + n + " de " + itens.length + '"><i style="width:' + (n / itens.length * 100) + '%"></i></div><span>Pergunta ' + n + " de " + itens.length + "</span></div>" +
      '<p style="margin-bottom:6px"><span class="tag tag-grupo">' + esc(rotuloGrupo) + "</span></p>" +
      '<form id="fPergunta" novalidate><fieldset><legend class="pergunta">' + esc(l.pergunta) + "</legend>" +
        (l.porque ? '<p class="nota por-que-perguntamos">Por que perguntamos: ' + esc(l.porque) + "</p>" : '<p class="nota por-que-perguntamos">Perguntamos para deixar a estratégia mais ajustada ao seu jogo. Responda só o que souber.</p>') +
        '<div class="opcoes">' + opcoes.map(function (o) {
          return '<label class="opcao"><input type="radio" name="resp" value="' + esc(o) + '"' + (escolha === o ? " checked" : "") + "><span>" + esc(o) + "</span></label>";
        }).join("") + "</div></fieldset>" +
        '<div class="campo"><label for="detalhe">' + (l.opcoes.length ? "Quer explicar melhor? <span class=\"nota\">(opcional)</span>" : "Sua resposta") + '</label><textarea id="detalhe" maxlength="400" rows="2">' + esc(detalhe) + "</textarea>" + botaoVoz("detalhe") + "</div>" +
        '<div class="aviso" id="aviso" role="alert" hidden></div>' +
        '<div class="acoes lado"><button class="btn btn-primario" id="btContinuar" type="submit">' + (n === itens.length ? "Salvar e terminar" : "Salvar e continuar") + "</button>" +
        '<button class="btn btn-secundario" id="btVoltarP" type="button">' + (n === 1 ? "Voltar à estratégia" : "Voltar") + "</button></div>" +
        '<p style="text-align:center;margin-top:6px"><button class="btn btn-texto" id="btDepois" type="button">Responder depois</button></p>' +
      "</form>"
    );
    var form = document.getElementById("fPergunta"), aviso = document.getElementById("aviso");
    function lerP() {
      var m = form.querySelector('input[name="resp"]:checked');
      fl.rascunho[n] = { escolha: m ? m.value : "", detalhe: document.getElementById("detalhe").value };
    }
    form.addEventListener("change", lerP); form.addEventListener("input", lerP);
    function seguir() { ir("#/completar/" + id + "/" + (n === itens.length ? "fim" : n + 1)); }
    document.getElementById("btVoltarP").addEventListener("click", function () { lerP(); ir(n === 1 ? "#/estrategia/" + id : "#/completar/" + id + "/" + (n - 1)); });
    document.getElementById("btDepois").addEventListener("click", function () { lerP(); if (!respostaSalva(p, l)) fl.adiadas++; seguir(); });
    form.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var bt = document.getElementById("btContinuar");
      if (bt.disabled) return;
      lerP();
      var r = fl.rascunho[n], det = r.detalhe.trim(), resp;
      if (r.escolha === "Não sei") resp = "Não sei";
      else if (r.escolha) resp = r.escolha + (det ? " — " + det : "");
      else resp = det;
      if (!resp) { aviso.textContent = "Escolha uma opção, toque em “Não sei” ou use “Responder depois”."; aviso.hidden = false; return; }
      aviso.hidden = true;
      ocupado(bt, true, "Salvando…");
      try {
        var res = await api("player-dados", { metodo: "POST", corpo: { acao: "salvarComplementos", complementos: [{ pergunta: l.pergunta, resposta: resp, grupo: l.grupo, contexto: ctx }] } });
        estado.dados.complementos = res.complementos;
        fl.respondidas++;
        seguir();
      } catch (e) {
        aviso.textContent = (e.message || "Não foi possível salvar agora.") + " Sua resposta continua aqui: tente de novo.";
        aviso.hidden = false; ocupado(bt, false);
      }
    });
  }
  function telaCompletarFim(p, fl) {
    var d = estado.dados, ainda = perguntasPendentes(p).length;
    tela(
      '<h1>Informações salvas</h1>' +
      '<div class="aviso-info" role="status" style="margin-top:14px">' + (fl.respondidas ? "✓ " + fl.respondidas + (fl.respondidas === 1 ? " resposta salva." : " respostas salvas.") : "Nenhuma resposta nova desta vez.") +
        (ainda ? " " + ainda + (ainda === 1 ? " pergunta ficou" : " perguntas ficaram") + " para depois." : "") + "</div>" +
      '<p class="sub">O seu perfil não mudou: estas respostas entram nas próximas estratégias e programas de treino.</p>' +
      (fl.respondidas && d.podeGerar ? '<div class="cartao" style="margin-top:18px"><h2>Quer usar já?</h2><p class="nota" style="margin-top:6px">Criamos uma nova estratégia com estas respostas. A atual e os seus programas e registros de treino continuam como estão.</p>' +
        '<button class="btn btn-primario btn-grande" data-gerar type="button">Atualizar estratégia com estas respostas</button><p class="nota" style="margin-top:8px">' + esc(textoCota()) + "</p></div>" : "") +
      '<div class="acoes"><a class="btn btn-secundario" href="#/estrategia/' + esc(p.id) + '">Voltar à estratégia</a>' + (ainda ? '<a class="btn btn-texto" href="#/completar/' + esc(p.id) + '" id="lnkRetomar">Responder as que faltam</a>' : "") + "</div>"
    );
    estado.fluxo = null;
    ligarGerar();
    var rt = document.getElementById("lnkRetomar");
    if (rt) rt.addEventListener("click", function () { estado.fluxo = null; });
  }

  async function gerarPlano(bt) {
    if (bt.disabled) return;
    ocupado(bt, true, "Enviando…");
    var id = novoId();
    try {
      var r = await fetch("/.netlify/functions/player-gerar-plano-background", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + (await auth.currentUser.getIdToken()) },
        body: JSON.stringify({ planoId: id }),
      });
      if (r.status !== 202 && !r.ok) throw new Error();
      ir("#/gerando/" + id);
    } catch (e) {
      ocupado(bt, false);
      toast("Não foi possível pedir a estratégia agora. Verifique sua conexão e tente de novo.", null, true);
    }
  }

  /* ══ Perfil (ficha) em etapas, com rascunho ═══════════════════════ */
  function opcoesHtml(nome, lista, valor, tipo, desabilitado) {
    tipo = tipo || "radio";
    var duas = lista.every(function (o) { return !o[2]; }) && lista.length <= 4;
    return '<div class="opcoes' + (duas ? " duas" : "") + '">' + lista.map(function (o) {
      var marcado = tipo === "radio" ? valor === o[0] : (valor || []).indexOf(o[0]) >= 0;
      var off = desabilitado && desabilitado === o[0];
      return '<label class="opcao"><input type="' + tipo + '" name="' + nome + '" value="' + o[0] + '"' + (marcado ? " checked" : "") + (off ? " disabled" : "") + ">" +
        "<span>" + esc(o[1]) + (o[2] ? "<small>" + esc(o[2]) + "</small>" : "") + "</span></label>";
    }).join("") + "</div>";
  }
  function grupo(nome, titulo, lista, nota, tipo, desabilitado) {
    var f = nome.indexOf("adv") === 0 ? estado.ficha.adversario : estado.ficha;
    var chave = { advEstilo: "estilo", advMao: "mao", advFortes: "pontosFortes", advFracos: "pontosFracos" }[nome] || nome;
    return '<fieldset id="g-' + nome + '"><legend>' + esc(titulo) + "</legend>" + (nota ? '<p class="nota">' + esc(nota) + "</p>" : "") +
      opcoesHtml(nome, lista, f[chave], tipo, desabilitado) + '<p class="erro-campo" hidden>Escolha uma opção.</p></fieldset>';
  }
  function chaveRascunho() { return "ql-player-rascunho:" + (auth && auth.currentUser ? auth.currentUser.uid : ""); }
  function guardarRascunho() { try { localStorage.setItem(chaveRascunho(), JSON.stringify(estado.ficha)); } catch (e) { /* sem armazenamento: segue sem rascunho */ } }
  function limparRascunho() { try { localStorage.removeItem(chaveRascunho()); } catch (e) { /* idem */ } }
  function aplicarRascunho() {
    if (estado.dados.fichaCompleta) { limparRascunho(); return; }
    try {
      var r = JSON.parse(localStorage.getItem(chaveRascunho()) || "null");
      if (!r || typeof r !== "object") return;
      Object.keys(r).forEach(function (k) { if (k !== "adversario" && r[k]) estado.ficha[k] = r[k]; });
      if (r.adversario && typeof r.adversario === "object") Object.keys(r.adversario).forEach(function (k) { if (r.adversario[k] && r.adversario[k].length !== 0) estado.ficha.adversario[k] = r.adversario[k]; });
    } catch (e) { /* rascunho ilegível: ignora */ }
  }

  function telaFicha(n) {
    n = Math.min(Math.max(parseInt(n, 10) || 1, 1), ETAPAS.length);
    var f = estado.ficha, a = f.adversario;
    var corpo = "";
    if (n === 1) {
      corpo = grupo("nivel", "Qual é o seu nível?", OP.nivel) + grupo("mao", "Você joga com qual mão?", OP.mao) +
        grupo("backhand", "Sua esquerda (backhand) é com…", OP.backhand) + grupo("piso", "Em que piso você mais joga?", OP.piso);
    } else if (n === 2) {
      corpo = grupo("armaPrincipal", "Seu golpe mais forte", AREAS, "O golpe em que você mais confia para ganhar pontos.") +
        grupo("pontoFraco", "Seu ponto mais vulnerável", AREAS, "Onde o adversário costuma te atacar ou onde você mais erra.", "radio", f.armaPrincipal) +
        grupo("padraoPonto", "Como você costuma construir os pontos?", OP.padraoPonto);
    } else if (n === 3) {
      corpo = grupo("rede", "E a rede?", OP.rede) + grupo("devolucao", "Sua devolução de saque é…", OP.devolucao) +
        grupo("pressao", "Em momentos de pressão (placar apertado), você…", OP.pressao) +
        '<div class="campo"><label for="obs">Algo mais sobre o seu jogo? <span class="nota">(opcional)</span></label>' +
        '<textarea id="obs" maxlength="500" placeholder="Ex.: erro muito a esquerda em bola alta">' + esc(f.observacoes) + "</textarea>" + botaoVoz("obs") + "</div>" +
        '<div class="campo"><label for="relato">Conte, do seu jeito, como você joga <span class="nota">(opcional)</span></label>' +
        '<p class="nota" style="margin-bottom:6px">Pode escrever ou falar: seus pontos fortes, o que te incomoda, como costuma jogar os pontos. Quanto mais específico, mais a estratégia conversa com o seu jogo.</p>' +
        '<textarea id="relato" maxlength="1500" placeholder="Ex.: costumo atacar com a direita, mas erro quando a bola vem alta no meu backhand…">' + esc(f.relato) + "</textarea>" + botaoVoz("relato") + "</div>";
    } else {
      corpo = '<p class="nota" style="margin-bottom:14px">Se você tem um adversário que enfrenta com frequência, descreva-o e a estratégia será montada para esse confronto. Sem adversário, a estratégia é geral para o seu jogo.</p>' +
        '<label class="alternar"><input type="checkbox" id="advAtivo"' + (a.ativo ? " checked" : "") + "><span>Quero uma estratégia contra um adversário específico</span></label>" +
        '<div id="advCampos" style="margin-top:18px"' + (a.ativo ? "" : " hidden") + ">" +
          '<div class="campo"><label for="advNome">Nome ou apelido do adversário</label><input id="advNome" maxlength="60" value="' + esc(a.nome) + '"></div>' +
          grupo("advEstilo", "Estilo dele", OP.advEstilo) + grupo("advMao", "Mão dele", OP.advMao) +
          grupo("advFortes", "Pontos fortes dele", AREAS, "Marque quantos quiser.", "checkbox") +
          grupo("advFracos", "Pontos fracos dele", AREAS, "Marque quantos quiser.", "checkbox") +
          '<div class="campo"><label for="advObs">O que mais você já percebeu no jogo dele? <span class="nota">(opcional)</span></label>' +
          '<textarea id="advObs" maxlength="500">' + esc(a.observacoes) + "</textarea>" + botaoVoz("advObs") + "</div>" +
        "</div>";
    }
    var ultima = n === ETAPAS.length;
    var editando = !!estado.editandoPerfil && estado.dados.fichaCompleta;
    var podeGerar = estado.dados.podeGerar && !editando;
    tela(
      '<div class="progresso"><div class="barra" role="progressbar" aria-valuemin="1" aria-valuemax="' + ETAPAS.length + '" aria-valuenow="' + n + '" aria-label="Etapa ' + n + " de " + ETAPAS.length + '"><i style="width:' + (n / ETAPAS.length * 100) + '%"></i></div><span>Etapa ' + n + " de " + ETAPAS.length + "</span></div>" +
      '<p class="olho">' + (editando ? "Editando o meu perfil de jogador" : "Meu perfil") + '</p><h1 style="margin-bottom:18px">' + esc(ETAPAS[n - 1].titulo) + "</h1>" +
      '<form id="fFicha" novalidate>' + corpo +
        '<div class="aviso" id="aviso" role="alert" hidden></div>' +
        '<p class="nota rascunho-nota" id="rascunhoNota">Suas respostas ficam salvas neste aparelho enquanto você preenche.</p>' +
        '<div class="acoes lado">' +
          '<button class="btn btn-primario" id="btAvancar" type="submit">' + (ultima ? (editando ? "Salvar perfil" : podeGerar ? "Salvar e criar minha estratégia" : "Salvar perfil") : "Continuar") + "</button>" +
          '<button class="btn btn-secundario" id="btVoltar" type="button">' + (n === 1 ? (editando ? "Cancelar edição" : "Voltar ao início") : "Voltar") + "</button>" +
        "</div>" +
      "</form>"
    );

    var form = document.getElementById("fFicha");
    function lerEtapa() {
      ETAPAS[n - 1].campos.forEach(function (c) {
        var m = form.querySelector('input[name="' + c + '"]:checked');
        f[c] = m ? m.value : "";
      });
      if (n === 2 && f.pontoFraco && f.pontoFraco === f.armaPrincipal) f.pontoFraco = "";
      if (n === 3) { f.observacoes = document.getElementById("obs").value.trim(); f.relato = document.getElementById("relato").value.trim(); }
      if (n === 4) {
        a.ativo = document.getElementById("advAtivo").checked;
        a.nome = document.getElementById("advNome").value.trim();
        var m1 = form.querySelector('input[name="advEstilo"]:checked'); a.estilo = m1 ? m1.value : "";
        var m2 = form.querySelector('input[name="advMao"]:checked'); a.mao = m2 ? m2.value : "";
        a.pontosFortes = [].map.call(form.querySelectorAll('input[name="advFortes"]:checked'), function (x) { return x.value; });
        a.pontosFracos = [].map.call(form.querySelectorAll('input[name="advFracos"]:checked'), function (x) { return x.value; });
        a.observacoes = document.getElementById("advObs").value.trim();
      }
    }
    if (n === 2) {
      /* o golpe forte não pode ser também o ponto vulnerável */
      form.querySelectorAll('input[name="armaPrincipal"]').forEach(function (r) {
        r.addEventListener("change", function () {
          form.querySelectorAll('input[name="pontoFraco"]').forEach(function (p) {
            p.disabled = p.value === r.value;
            if (p.disabled) p.checked = false;
          });
        });
      });
    }
    if (n === 4) {
      document.getElementById("advAtivo").addEventListener("change", function (e) {
        document.getElementById("advCampos").hidden = !e.target.checked;
      });
    }
    form.querySelectorAll("fieldset").forEach(function (fs) {
      fs.addEventListener("change", function () { var e = fs.querySelector(".erro-campo"); if (e) e.hidden = true; });
    });
    /* rascunho: a cada mudança, as respostas vão para a memória e para o aparelho — sair da tela não perde nada */
    function rascunhar() { lerEtapa(); guardarRascunho(); }
    form.addEventListener("change", rascunhar); form.addEventListener("input", rascunhar);

    document.getElementById("btVoltar").addEventListener("click", function () {
      rascunhar();
      if (n === 1 && editando) { estado.editandoPerfil = false; estado.ficha = JSON.parse(JSON.stringify(estado.dados.ficha)); estado.ficha.adversario = estado.ficha.adversario || {}; ir("#/jogador"); return; }
      ir(n === 1 ? "#/inicio" : "#/ficha/" + (n - 1));
    });
    form.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var bt = document.getElementById("btAvancar");
      if (bt.disabled) return;
      lerEtapa();
      var faltando = ETAPAS[n - 1].campos.filter(function (c) { return !f[c]; });
      faltando.forEach(function (c) { document.querySelector("#g-" + c + " .erro-campo").hidden = false; });
      if (faltando.length) {
        document.getElementById("g-" + faltando[0]).scrollIntoView({ block: "center" });
        var primeiro = form.querySelector('input[name="' + faltando[0] + '"]:not(:disabled)');
        if (primeiro) primeiro.focus({ preventScroll: true });
        return;
      }
      ocupado(bt, true, "Salvando…");
      try {
        var r = await api("player-dados", { metodo: "POST", corpo: { acao: "salvarFicha", ficha: f } });
        estado.dados.ficha = r.ficha; estado.dados.fichaCompleta = r.fichaCompleta;
        if (r.fichaCompleta) limparRascunho();
        if (!ultima) { ir("#/ficha/" + (n + 1)); return; }
        if (!r.fichaCompleta) {
          var etapa = ETAPAS.findIndex(function (e) { return e.campos.some(function (c) { return !r.ficha[c]; }); });
          ir("#/ficha/" + (etapa + 1));
          return;
        }
        if (editando) { estado.editandoPerfil = false; estado.dados.fichaAtualizadaEm = new Date().toISOString(); ir("#/jogador"); toast("Perfil de jogador salvo. Suas estratégias e programas continuam como estão."); return; }
        if (estado.dados.podeGerar) { ocupado(bt, false); await gerarPlano(bt); }
        else ir("#/inicio");
      } catch (e) {
        var av = document.getElementById("aviso");
        av.textContent = (e.message || "Não foi possível salvar agora.") + " Suas respostas continuam aqui: tente de novo.";
        av.hidden = false;
        ocupado(bt, false);
      }
    });
  }

  var consulta = null;
  function telaGerando(id) {
    tela('<div class="gerando"><div class="bola" aria-hidden="true"></div><h1>Montando sua estratégia…</h1>' +
      '<p class="sub" id="status">Costuma levar menos de um minuto. Pode deixar esta tela aberta.</p></div>');
    var inicio = Date.now();
    clearTimeout(consulta);
    async function verificar() {
      if (location.hash !== "#/gerando/" + id) return;
      try {
        var r = await api("player-dados?plano=" + encodeURIComponent(id));
        var p = r.plano;
        if (p.status === "pronto") { await carregarDados(); aplicarRascunho(); ir("#/estrategia/" + id); return; }
        if (p.status === "erro") { await carregarDados(); telaErroPlano(p.erro, p); return; }
      } catch (e) { /* ainda não existe ou rede oscilou: tenta de novo */ }
      if (Date.now() - inicio > 4 * 60 * 1000) {
        telaErroPlano("A estratégia está demorando mais que o normal. Volte ao início em alguns minutos: ela aparece na sua lista quando ficar pronta.");
        return;
      }
      consulta = setTimeout(verificar, 3000);
    }
    consulta = setTimeout(verificar, 2500);
  }
  function telaErroPlano(msg, extra) {
    if (extra && extra.semCota && /^(limite_modelo|plano_sem_recurso|limite_adversarios|limite_programas_ativos)$/.test(extra.motivoCota || "")) {
      tela('<h1>Limite do seu plano</h1><div class="cartao limite-atingido" role="status" style="margin-top:14px"><p>' + esc(msg) + "</p>" +
        '<p class="nota" style="margin-top:6px">Seu perfil, suas estratégias, seus programas e seus registros continuam salvos e disponíveis para consulta.</p>' +
        '<div class="acoes"><a class="btn btn-primario" href="#/assinaturas">Ampliar o plano</a><a class="btn btn-secundario" href="#/assinatura">Plano e assinatura</a></div></div><div class="acoes"><a class="btn btn-texto" href="#/inicio">Voltar ao início</a></div>');
      return;
    }
    if (extra && extra.semCota) {
      tela('<h1>Limite atingido</h1><div style="margin-top:14px">' + limiteAtingidoHtml(extra.motivoCota, extra.renovaEm, { recurso: /programa/i.test(msg) ? "programas de treino" : "estratégias" }) + '</div><div class="acoes"><a class="btn btn-texto" href="#/inicio">Voltar ao início</a></div>');
      return;
    }
    tela('<div class="pilha"><h1>Não deu certo desta vez</h1><div class="aviso">' + esc(msg) + "</div>" +
      '<div class="acoes"><a class="btn btn-primario" href="#/inicio">Voltar ao início</a></div></div>');
  }

  /* ══ Jogadas ═══════════════════════════════════════════════════════ */
  function linhaDrill(rotulo, texto) {
    return texto ? "<dt>" + rotulo + "</dt><dd>" + esc(texto) + "</dd>" : "";
  }
  /* o código interno (ex.: IP009) só aparece dentro dos detalhes, explicado pela família do catálogo */
  function drillHtml(d, usadoEm) {
    return '<details class="drill"><summary><span class="drill-nome">' + esc(d.nome) + "</span>" +
      '<span class="drill-meta">' + esc(d.tipo) + "</span>" +
      (usadoEm ? '<span class="drill-uso">Treina: ' + esc(usadoEm) + "</span>" : "") +
      (d.motivo ? '<span class="drill-motivo">' + esc(d.motivo) + "</span>" : "") + "</summary>" +
      '<dl class="drill-det">' + linhaDrill("Código no catálogo", d.codigo + " · " + d.tipo) + linhaDrill("Objetivo", d.objetivo) + linhaDrill("Montagem", d.montagem) + linhaDrill("Carga", d.carga) +
      linhaDrill("Para facilitar", d.regressao) + linhaDrill("Para evoluir", d.progressao) + linhaDrill("Corrigir", d.corrigir) +
      linhaDrill("Ignorar", d.ignorar) + "</dl></details>";
  }
  function fundamentosHtml(j) {
    var f = j.fundamentos || [];
    if (!f.length) return '<p class="nota" style="margin-top:10px">Esta estratégia foi criada antes dos fundamentos. Crie uma nova para ver o que trabalhar em cada jogada.</p>';
    return '<div class="fundamentos"><h4>O que trabalhar nesta jogada</h4><ul>' + f.map(function (x) {
      return '<li><span class="cat">' + esc(x.categoria) + "</span><span><strong>" + esc(x.nome) + '</strong><br><span class="nota">' + esc(x.foco) + "</span></span></li>";
    }).join("") + "</ul></div>";
  }
  function sequenciaResumo(seq) {
    seq = seq || [];
    var vis = seq.slice(0, 3);
    return '<ol class="seq-resumo" aria-label="Sequência resumida">' + vis.map(function (x) { return "<li>" + esc(tituloCurto(x, 42)) + "</li>"; }).join("") +
      (seq.length > 3 ? '<li class="mais">+' + (seq.length - 3) + " em “Como executar”</li>" : "") + "</ol>";
  }
  function jogadaHtml(j, n, marcada) {
    var nd = (j.drills || []).length;
    return '<article class="jogada' + (marcada ? " escolhida" : "") + '" data-jogada="' + n + '"><h3>' + esc(j.titulo) + "</h3>" +
      '<p class="quando"><b>Quando usar:</b> ' + esc(primeiraFrase(j.quando, 130)) + "</p>" +
      sequenciaResumo(j.sequencia) +
      '<button type="button" class="btn-add" data-add="' + n + '" aria-pressed="' + marcada + '"><span class="add-icone" aria-hidden="true">' + (marcada ? "✓" : "+") + '</span><span class="add-texto">' + (marcada ? "Adicionada ao treino" : "Adicionar ao treino") + "</span></button>" +
      '<details class="det"><summary>Como executar</summary><ol class="sequencia" aria-label="Sequência de bolas">' + (j.sequencia || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol>" + fundamentosHtml(j) + "</details>" +
      '<details class="det"><summary>Por que usar</summary><p class="porque">' + esc(j.porque) + "</p></details>" +
      '<details class="det"><summary>Exercícios relacionados' + (nd ? " (" + nd + ")" : "") + "</summary>" +
        (nd ? '<div class="drills">' + j.drills.map(function (d) { return drillHtml(d); }).join("") + "</div>" : '<p class="nota" style="margin-top:8px">Nenhum exercício do catálogo cobre esta jogada com precisão. Um treinador pode indicar um na consultoria.</p>') +
      "</details></article>";
  }

  /* "Seu treino": os drills das jogadas adicionadas, juntos e sem repetir */
  function treinoHtml(jogadas, escolhidas) {
    if (!escolhidas.length) return "";
    var porCodigo = {}, ordem = [];
    escolhidas.forEach(function (n) {
      ((jogadas[n] || {}).drills || []).forEach(function (d) {
        if (!porCodigo[d.codigo]) { porCodigo[d.codigo] = { d: d, usos: [] }; ordem.push(d.codigo); }
        porCodigo[d.codigo].usos.push("Jogada " + (n + 1));
      });
    });
    return '<details class="det treino-juntos"><summary>Exercícios das jogadas adicionadas (' + ordem.length + ")</summary>" +
      (ordem.length
        ? '<div class="drills" style="border:none;margin:0;padding:0">' + ordem.map(function (c) { return drillHtml(porCodigo[c].d, porCodigo[c].usos.join(", ")); }).join("") + "</div>"
        : '<p class="nota" style="margin-top:8px">As jogadas adicionadas não têm exercícios do catálogo. Um treinador pode indicar na consultoria.</p>') + "</details>";
  }

  function rodapeJogadasHtml(p) {
    var n = (p.escolhidas || []).length, pjs = planejamentosProntos().filter(function (x) { return x.baseadoEm === p.id; });
    if (!n) {
      return '<div class="cartao compacto" id="rodapeJogadas"><p class="nota">Adicione ao treino as jogadas que quer praticar. Elas entram no programa de treino que você montar.</p></div>';
    }
    var corpo = '<p><strong>' + n + (n === 1 ? " jogada adicionada" : " jogadas adicionadas") + "</strong> para montar o treino.</p>";
    if (!recursos().planejamento) {
      corpo += '<div class="acoes"><a class="btn btn-secundario" href="#/treinos">Organizar meus treinos</a></div>';
    } else if (pjs.length) {
      corpo += '<p class="nota" style="margin-top:4px">O programa «' + esc(tituloCurto(pjs[0].titulo, 36)) + "» já foi montado antes desta seleção. Para usá-la, crie um novo programa.</p>" +
        '<div class="acoes"><a class="btn btn-primario" href="#/planejar/' + esc(p.id) + '">Criar programa com esta seleção</a><a class="btn btn-secundario" href="#/programa/' + esc(pjs[0].id) + '">Ver programa atual</a></div>';
    } else {
      corpo += '<div class="acoes"><a class="btn btn-primario" href="#/planejar/' + esc(p.id) + '">Organizar meus treinos</a></div>';
    }
    return '<div class="cartao compacto" id="rodapeJogadas">' + corpo + "</div>";
  }

  /* adicionar/remover jogada: só confirma depois que o servidor gravou */
  async function alternarJogada(p, n, bt, desfazendo) {
    if (bt.disabled) return;
    /* toque duplo sem querer: ignora o segundo toque em menos de 0,7 s (o "Desfazer" é uma ação deliberada) */
    var agora = Date.now();
    if (!desfazendo && agora - (parseInt(bt.dataset.ultimo, 10) || 0) < 700) return;
    var antes = (p.escolhidas || []).slice(), tinha = antes.indexOf(n) >= 0;
    var nova = (tinha ? antes.filter(function (x) { return x !== n; }) : antes.concat([n])).sort(function (a, b) { return a - b; });
    bt.disabled = true;
    try {
      var r = await api("player-dados", { metodo: "POST", corpo: { acao: "escolherJogadas", planoId: p.id, escolhidas: nova } });
      p.escolhidas = r.escolhidas;
      bt.dataset.ultimo = String(Date.now());
      renderJogadasEstado(p);
      toast(tinha ? "Jogada removida do treino." : "Jogada adicionada. Ela entra no programa de treino que você montar.", function () { alternarJogada(p, n, document.querySelector('[data-add="' + n + '"]'), true); });
    } catch (e) {
      toast("Não foi possível salvar. A jogada não foi " + (tinha ? "removida." : "adicionada."), null, true);
    }
    bt.disabled = false;
  }
  function renderJogadasEstado(p) {
    var esc_ = p.escolhidas || [];
    app.querySelectorAll(".btn-add").forEach(function (b) {
      var n = parseInt(b.getAttribute("data-add"), 10), m = esc_.indexOf(n) >= 0;
      b.setAttribute("aria-pressed", String(m));
      b.querySelector(".add-icone").textContent = m ? "✓" : "+";
      b.querySelector(".add-texto").textContent = m ? "Adicionada ao treino" : "Adicionar ao treino";
      b.closest(".jogada").classList.toggle("escolhida", m);
    });
    document.getElementById("rodapeJogadas").outerHTML = rodapeJogadasHtml(p);
    document.getElementById("treinoJuntos").innerHTML = treinoHtml(p.plano.jogadas || [], esc_);
  }

  function telaJogadas(id) {
    var lista = planosProntos();
    var html = "<h1>Jogadas</h1><p class=\"sub\">Veja sequências práticas para aplicar sua estratégia.</p>";
    if (!lista.length) {
      tela(html + '<div class="cartao" style="margin-top:18px"><h2>As jogadas vêm da sua estratégia</h2><p class="nota" style="margin-top:6px">Crie a sua estratégia para ver as jogadas que você pode usar no jogo.</p>' +
        '<a class="btn btn-primario btn-grande" href="#/estrategia">Ir para estratégias</a></div>');
      return;
    }
    var p = lista.filter(function (x) { return x.id === id; })[0] || lista[0];
    var pl = p.plano;
    var seletor = lista.length > 1
      ? '<label class="campo-plano">Estratégia<select id="selPlanoJog" aria-describedby="seletorInfo">' + lista.map(function (x) {
          return '<option value="' + esc(x.id) + '"' + (x.id === p.id ? " selected" : "") + ">" + esc(tituloCurto(x.plano.titulo, 34)) + (x.adversarioNome ? " · " + esc(x.adversarioNome) : "") + " · " + esc(dataCurta(x.criadoEm.slice(0, 10))) + "</option>";
        }).join("") + "</select></label>" : "";
    tela(
      html + seletor +
      '<p class="nota sel-info" id="seletorInfo">' + (lista.length > 1 ? "Selecionada: " : "Estratégia: ") + '<a href="#/estrategia/' + esc(p.id) + '"><strong>' + esc(tituloCurto(pl.titulo, 40)) + "</strong></a> · " + tipoEstrategia(p) + (p.adversarioNome ? " " + esc(p.adversarioNome) : "") +
        ' <details class="titulo-completo"><summary>Ver título completo</summary><p>' + esc(pl.titulo) + "</p></details></p>" +
      '<section class="jogadas" aria-label="Jogadas">' + (pl.jogadas || []).map(function (j, n) { return jogadaHtml(j, n, (p.escolhidas || []).indexOf(n) >= 0); }).join("") + "</section>" +
      rodapeJogadasHtml(p) +
      '<div id="treinoJuntos">' + treinoHtml(pl.jogadas || [], p.escolhidas || []) + "</div>" +
      '<p class="nota" style="margin-top:12px">Exercícios do catálogo da Metodologia MTY, escritos para treinar com parceiro ou treinador. Ajuste a carga ao seu nível.</p>'
    );
    app.querySelectorAll(".btn-add").forEach(function (b) {
      b.addEventListener("click", function () { alternarJogada(p, parseInt(b.getAttribute("data-add"), 10), b); });
    });
    var sel = document.getElementById("selPlanoJog");
    if (sel) sel.addEventListener("change", function () { location.hash = "#/jogadas/" + sel.value; });
  }

  /* ══ Treinos ═══════════════════════════════════════════════════════ */
  function periodoPrograma(pj) {
    var s = pj.sessoes || [];
    if (!s.length) return "";
    return dataCurta(s[0].data) + " a " + dataCurta(s[s.length - 1].data);
  }
  function estrategiaDeOrigem(pj) {
    var p = planoPorId(pj.baseadoEm);
    return p && p.plano ? tituloCurto(p.plano.titulo, 40) : "";
  }
  function programaHtml(pj, ativo) {
    var a = andamentoPrograma(pj), pa = pj.params || {}, origem = estrategiaDeOrigem(pj);
    var pct = a.total ? Math.round(a.concluidos / a.total * 100) : 0;
    return '<a class="item-programa' + (ativo ? " ativo" : "") + '" href="#/programa/' + esc(pj.id) + '" title="' + esc(pj.titulo) + '"><span class="ip-corpo">' +
      '<strong class="ip-titulo">' + esc(pj.titulo) + "</strong>" +
      '<span class="ip-linha">' + esc(periodoPrograma(pj)) + (pa.semanas ? " · " + pa.semanas + " semanas" : "") + (pa.dias ? " · " + pa.dias.length + "x por semana" : "") + "</span>" +
      (podeRegistrar() ? '<span class="prog" role="img" aria-label="' + a.concluidos + " de " + a.total + ' treinos concluídos"><span class="prog-barra"><i style="width:' + pct + '%"></i></span><span class="prog-txt">' + a.concluidos + " de " + a.total + " concluídos</span></span>"
        : '<span class="ip-linha">' + a.total + " treinos previstos</span>") +
      (origem ? '<span class="ip-linha">Estratégia: ' + esc(origem) + "</span>" : "") +
      '</span><span class="seta" aria-hidden="true">›</span></a>';
  }
  function historicoHtml() {
    var feitos = [];
    planejamentosProntos().forEach(function (pj) {
      (pj.sessoes || []).forEach(function (s) { if (s.status === "feito" || s.status === "parcial" || s.status === "nao_feito") feitos.push({ s: s, pj: pj }); });
    });
    feitos.sort(function (a, b) { return a.s.data < b.s.data ? 1 : a.s.data > b.s.data ? -1 : 0; });
    if (!feitos.length) return "";
    return '<details class="det historico"><summary>Histórico (' + feitos.length + ')</summary><ul class="lista-historico">' + feitos.map(function (x) {
      return '<li><a href="#/treino/' + esc(x.pj.id) + "/" + esc(x.s.id) + '"><span><strong>' + esc(x.s.titulo) + '</strong><br><span class="nota">' + esc(dataTreino(x.s.data)) + " · " + esc(tituloCurto(x.pj.titulo, 30)) + "</span></span>" + chipSituacao(x.s) + "</a></li>";
    }).join("") + "</ul></details>";
  }

  function telaTreinos() {
    var d = estado.dados, r = recursos(), ultimo = planosProntos()[0];
    var html = "<h1>Treinos</h1><p class=\"sub\">Organize e registre a prática das suas jogadas.</p>" + cartoesPreparacaoHtml("treinos", false);
    if (!r.planejamento) {
      html += '<div class="cartao bloqueado" style="margin-top:18px"><p class="olho">Incluído em assinaturas</p><h2>Programa de treino</h2>' +
        '<p class="nota" style="margin-top:6px">Semanas de treino com os dias e a duração que cabem na sua rotina, e os exercícios de cada treino. Faz parte de uma assinatura.</p>' +
        '<div class="acoes"><a class="btn btn-primario" href="#/assinaturas">Comparar planos</a><a class="btn btn-secundario" href="#/assinatura">Plano e assinatura</a></div></div>';
      tela(html); return;
    }
    var programas = planejamentosProntos(), sel = escolherProximoTreino(), ativo = programaAtivo();
    if (sel) html += '<div style="margin-top:16px">' + cartaoTreinoHtml(sel) + "</div>";
    if (!programas.length) {
      html += '<div class="cartao" style="margin-top:18px"><h2>Você ainda não tem um programa de treino</h2><p class="nota" style="margin-top:6px">Transforme as jogadas da sua estratégia em treinos nos dias que cabem na sua rotina.</p>' +
        (ultimo ? '<a class="btn btn-primario btn-grande" href="#/planejar/' + esc(ultimo.id) + '">Criar programa de treino</a>'
          : '<p class="nota" style="margin-top:8px">Crie uma estratégia primeiro.</p><a class="btn btn-primario btn-grande" href="#/estrategia">Ir para estratégias</a>') + "</div>";
    } else {
      if (!sel) html += '<div class="cartao" style="margin-top:16px"><p class="olho">Programa concluído</p><p class="nota">Você não tem treinos em aberto. Veja o histórico ou monte um novo programa.</p></div>';
      html += '<h2 class="secao" id="t-prog">Programas de treino</h2><div class="cartao lista-estrategias" aria-labelledby="t-prog" style="margin-top:10px">' + programas.map(function (pj) { return programaHtml(pj, ativo && pj.id === ativo.id); }).join("") + "</div>" +
        (ultimo ? '<a class="btn ' + (ativo ? "btn-secundario" : "btn-primario") + ' largo" href="#/planejar/' + esc(ultimo.id) + '" style="margin-top:12px">Criar programa de treino</a>' : "") +
        historicoHtml();
    }
    tela(html);
  }

  /* ── montar programa de treino ── */
  var DIAS_SEMANA = [["seg", "Seg"], ["ter", "Ter"], ["qua", "Qua"], ["qui", "Qui"], ["sex", "Sex"], ["sab", "Sáb"], ["dom", "Dom"]];
  var NOME_DIA = { seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta", sex: "Sexta", sab: "Sábado", dom: "Domingo" };
  var ABREV_DIA = { seg: "Seg", ter: "Ter", qua: "Qua", qui: "Qui", sex: "Sex", sab: "Sáb", dom: "Dom" };

  function hojeISO() {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function proximaSegunda() {
    var d = new Date(); d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function dataCurta(iso) {
    var p = String(iso).split("-");
    return p[2] + "/" + p[1];
  }
  function dataExtensa(iso) {
    var p = String(iso).split("-");
    return p[2] + "/" + p[1] + "/" + p[0];
  }

  /* aviso perto da ação: quantos programas já foram usados no período, se a assinatura tiver limite configurado */
  function notaUsoPrograma() {
    var a = assinaturaDoJogador(), p = (a.uso || {}).programas || {};
    if (a.origem !== "eduzz" || p.limite == null) return "";
    return '<p class="nota nota-uso" style="margin-top:6px">' + esc(p.usadas + " de " + p.limite + (p.limite === 1 ? " programa de treino utilizado" : " programas de treino utilizados") + " neste período.") + "</p>";
  }
  function telaPlanejar(planoId) {
    var plano = planoPorId(planoId);
    if (!plano || plano.status !== "pronto" || !recursos().planejamento) { ir("#/treinos"); return; }
    var marcadas = (plano.escolhidas || []).map(function (n) { return plano.plano.jogadas[n] ? tituloCurto(plano.plano.jogadas[n].titulo, 38) : null; }).filter(Boolean);
    var f = estado.formPlanej = estado.formPlanej || { semanas: "4", dias: ["ter", "qui", "sab"], minutos: "60", apoio: "", inicio: proximaSegunda() };
    tela(
      '<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/estrategia/' + esc(planoId) + '">‹ Voltar à estratégia</a></p>' +
      "<h1>Programa de treino</h1>" +
      '<p class="sub">Conte como é a sua rotina e o programa se encaixa nela.</p>' + notaUsoPrograma() +
      '<div class="cartao compacto jogadas-do-programa" style="margin-top:14px"><p class="olho">Jogadas deste programa</p>' +
        (marcadas.length ? "<p>" + marcadas.map(esc).join(" · ") + '</p><p class="nota" style="margin-top:4px"><a href="#/jogadas/' + esc(planoId) + '">Alterar jogadas</a></p>'
          : '<p class="nota">Você não adicionou jogadas: o programa distribui todas as da estratégia. <a href="#/jogadas/' + esc(planoId) + '">Escolher jogadas</a></p>') + "</div>" +
      '<form id="fPlanej" novalidate style="margin-top:20px">' +
        '<fieldset id="g-semanas"><legend>Quantas semanas?</legend>' + opcoesPlanej("semanas", [["4", "4 semanas"], ["8", "8 semanas"]], f.semanas, "radio") + "</fieldset>" +
        '<fieldset id="g-dias"><legend>Em quais dias você treina?</legend><p class="nota">Escolha de 1 a 5 dias. O programa terá um treino em cada um.</p>' +
          opcoesPlanej("dias", DIAS_SEMANA, f.dias, "checkbox", true) + '<p class="erro-campo" hidden></p></fieldset>' +
        '<fieldset id="g-minutos"><legend>Quanto tempo tem por treino?</legend>' + opcoesPlanej("minutos", [["45", "45 min"], ["60", "60 min"], ["90", "90 min"]], f.minutos, "radio") + "</fieldset>" +
        '<fieldset id="g-apoio"><legend>Com quem você treina?</legend>' + opcoesPlanej("apoio", [["parceiro", "Com um parceiro de jogo"], ["treinador", "Com treinador ou alimentador de bolas"]], f.apoio, "radio") + '<p class="erro-campo" hidden>Escolha uma opção.</p></fieldset>' +
        '<div class="campo"><label for="inicio">Quando começa?</label><input id="inicio" type="date" min="' + hojeISO() + '" value="' + esc(f.inicio) + '"></div>' +
        '<div class="aviso" id="aviso" role="alert" hidden></div>' +
        '<div class="acoes"><button class="btn btn-primario" id="btPlanej" type="submit">Criar programa de treino</button></div>' +
      "</form>"
    );
    var form = document.getElementById("fPlanej");
    function ler() {
      f.semanas = (form.querySelector('input[name="semanas"]:checked') || {}).value || "";
      f.dias = [].map.call(form.querySelectorAll('input[name="dias"]:checked'), function (x) { return x.value; });
      f.minutos = (form.querySelector('input[name="minutos"]:checked') || {}).value || "";
      f.apoio = (form.querySelector('input[name="apoio"]:checked') || {}).value || "";
      f.inicio = document.getElementById("inicio").value;
    }
    form.addEventListener("change", function () {
      ler();
      /* no máximo 5 dias: os demais ficam desabilitados enquanto houver 5 marcados */
      form.querySelectorAll('input[name="dias"]').forEach(function (x) { x.disabled = !x.checked && f.dias.length >= 5; });
      form.querySelectorAll(".erro-campo").forEach(function (e) { e.hidden = true; });
    });
    form.dispatchEvent(new Event("change"));
    form.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var bt = document.getElementById("btPlanej");
      if (bt.disabled) return;
      ler();
      var av = document.getElementById("aviso");
      var erroDias = form.querySelector("#g-dias .erro-campo"), erroApoio = form.querySelector("#g-apoio .erro-campo");
      if (!f.dias.length) { erroDias.textContent = "Escolha pelo menos um dia."; erroDias.hidden = false; erroDias.scrollIntoView({ block: "center" }); return; }
      if (!f.apoio) { erroApoio.hidden = false; erroApoio.scrollIntoView({ block: "center" }); return; }
      if (!f.inicio) { av.textContent = "Escolha a data de início."; av.hidden = false; return; }
      ocupado(bt, true, "Enviando…");
      var id = novoId();
      try {
        var r = await fetch("/.netlify/functions/player-gerar-planejamento-background", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: "Bearer " + (await auth.currentUser.getIdToken()) },
          body: JSON.stringify({ planejamentoId: id, planoId: planoId, params: { semanas: Number(f.semanas), dias: f.dias, minutos: Number(f.minutos), apoio: f.apoio, inicio: f.inicio } }),
        });
        if (r.status !== 202 && !r.ok) throw new Error();
        ir("#/gerandoPlanej/" + id);
      } catch (e) {
        av.textContent = "Não foi possível pedir o programa de treino agora. Suas escolhas continuam aqui: verifique a conexão e tente de novo.";
        av.hidden = false; ocupado(bt, false);
      }
    });
  }
  function opcoesPlanej(nome, lista, valor, tipo, compacto) {
    return '<div class="opcoes' + (compacto ? " dias" : lista.length <= 3 && lista.every(function (o) { return o[1].length < 16; }) ? " duas" : "") + '">' + lista.map(function (o) {
      var marcado = tipo === "radio" ? valor === o[0] : (valor || []).indexOf(o[0]) >= 0;
      return '<label class="opcao"><input type="' + tipo + '" name="' + nome + '" value="' + o[0] + '"' + (marcado ? " checked" : "") + "><span>" + esc(o[1]) + "</span></label>";
    }).join("") + "</div>";
  }

  function telaGerandoPlanej(id) {
    tela('<div class="gerando"><div class="bola" aria-hidden="true"></div><h1>Montando seu programa de treino…</h1>' +
      '<p class="sub">Costuma levar de 1 a 2 minutos. Pode deixar esta tela aberta.</p></div>');
    var inicio = Date.now();
    clearTimeout(consulta);
    async function verificar() {
      if (location.hash !== "#/gerandoPlanej/" + id) return;
      try {
        var r = await api("player-dados?planejamento=" + encodeURIComponent(id));
        var pj = r.planejamento;
        if (pj.status === "pronto") { await carregarDados(); aplicarRascunho(); estado.formPlanej = null; ir("#/programa/" + id); return; }
        if (pj.status === "erro") { await carregarDados(); telaErroPlano(pj.erro, pj); return; }
      } catch (e) { /* ainda não existe ou a rede oscilou */ }
      if (Date.now() - inicio > 5 * 60 * 1000) {
        telaErroPlano("O programa de treino está demorando mais que o normal. Volte ao início em alguns minutos: ele aparece na sua lista quando ficar pronto.");
        return;
      }
      consulta = setTimeout(verificar, 3000);
    }
    consulta = setTimeout(verificar, 3000);
  }

  /* ── programa de treino: semanas e treinos, sem os blocos (esses ficam em cada treino) ── */
  async function telaPrograma(id) {
    tela('<p class="carregando">Carregando…</p>', true);
    var pj;
    try { pj = (await api("player-dados?planejamento=" + encodeURIComponent(id))).planejamento; }
    catch (e) { telaErroPlano(e.message); return; }
    if (pj.status !== "pronto" || !pj.planejamento) { ir("#/treinos"); return; }
    var pl = pj.planejamento, pa = pj.params || {}, regs = pj.registros || {};
    var lista = (estado.dados.planejamentos || []).filter(function (x) { return x.id === id; })[0];
    var and = lista ? andamentoPrograma(lista) : null;
    var origem = estrategiaDeOrigem({ baseadoEm: pj.baseadoEm });
    var prox = escolherProximoTreino();
    var abre = prox && prox.programa.id === id ? prox.sessao.semana : 1;
    tela(
      '<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/treinos">‹ Treinos</a></p>' +
      '<p class="olho">Programa de treino · ' + (pa.semanas || "") + " semanas</p><h1>" + esc(pl.titulo) + "</h1>" +
      '<p style="margin-top:10px"><span class="tag">' + (pa.dias || []).map(function (d) { return ABREV_DIA[d]; }).join(", ") + " · " + esc(pa.minutos) + " min · começa em " + esc(dataExtensa(pa.inicio)) + "</span></p>" +
      (origem ? '<p class="nota" style="margin-top:8px">Estratégia de origem: <a href="#/estrategia/' + esc(pj.baseadoEm) + '">' + esc(origem) + "</a></p>" : "") +
      (and && podeRegistrar() ? '<div class="prog prog-grande" role="img" aria-label="' + and.concluidos + " de " + and.total + ' treinos concluídos"><span class="prog-barra"><i style="width:' + Math.round(and.concluidos / and.total * 100) + '%"></i></span><span class="prog-txt">' + and.concluidos + " de " + and.total + " treinos concluídos</span></div>" : "") +
      '<details class="det" style="margin-top:14px"><summary>Resumo do programa</summary><p style="margin-top:8px">' + esc(pl.resumo) + "</p></details>" +
      pl.semanas.map(function (w) {
        return '<details class="semana"' + (w.n === abre ? " open" : "") + '><summary><span class="semana-n">Semana ' + w.n + '</span><span class="semana-foco">' + esc(w.foco) + '</span><span class="semana-carga">Carga: ' + esc(w.carga) + "</span></summary>" +
          '<ul class="lista-treinos">' + w.sessoes.map(function (x) {
            var s = { id: x.id, data: x.data, status: regs[x.id] ? regs[x.id].status : "pendente" };
            return '<li><a href="#/treino/' + esc(id) + "/" + esc(x.id) + '"><span><span class="sessao-dia">' + esc(dataTreino(x.data)) + "</span><strong>" + esc(x.titulo) + "</strong></span>" + chipSituacao(s) + "</a></li>";
          }).join("") + "</ul></details>";
      }).join("")
    );
  }

  /* ── um treino: blocos em ordem, registro do que foi feito ── */
  function blocoTreinoHtml(it, i, feito, podeMarcar) {
    var ctl = podeMarcar ? '<label class="bloco-feito"><input type="checkbox" data-bloco="' + i + '"' + (feito ? " checked" : "") + '><span class="sr">Marcar bloco como feito</span><span class="caixa" aria-hidden="true"></span></label>' : "";
    if (it.tipo === "livre") {
      return '<li class="bloco' + (feito ? " feito" : "") + '">' + ctl + '<div class="bloco-corpo"><p class="bloco-t"><span class="min">' + esc(it.minutos) + " min</span> " + esc(it.titulo) + "</p>" + (it.nota ? '<p class="nota">' + esc(it.nota) + "</p>" : "") + "</div></li>";
    }
    return '<li class="bloco' + (feito ? " feito" : "") + '">' + ctl + '<div class="bloco-corpo"><details class="drill"><summary><span class="drill-nome">' + esc(it.nome) + "</span>" +
      '<span class="drill-meta">' + esc(it.minutos) + " min · " + esc(it.tipoDrill) + "</span>" + (it.nota ? '<span class="drill-motivo">' + esc(it.nota) + "</span>" : "") + "</summary>" +
      '<dl class="drill-det">' + linhaDrill("Código no catálogo", it.codigo + " · " + it.tipoDrill) + linhaDrill("Objetivo", it.objetivo) + linhaDrill("Montagem", it.montagem) + linhaDrill("Carga", it.carga) +
      linhaDrill("Para facilitar", it.regressao) + linhaDrill("Para evoluir", it.progressao) + linhaDrill("Corrigir", it.corrigir) + linhaDrill("Ignorar", it.ignorar) + "</dl></details></div></li>";
  }

  async function telaTreino(pjId, sessaoId) {
    tela('<p class="carregando">Carregando…</p>', true);
    var pj;
    try { pj = (await api("player-dados?planejamento=" + encodeURIComponent(pjId))).planejamento; }
    catch (e) { telaErroPlano(e.message); return; }
    if (pj.status !== "pronto" || !pj.planejamento) { ir("#/treinos"); return; }
    var x = null, semana = null;
    pj.planejamento.semanas.forEach(function (w) { w.sessoes.forEach(function (s) { if (s.id === sessaoId) { x = s; semana = w; } }); });
    if (!x) { ir("#/programa/" + pjId); return; }
    var plano = planoPorId(pj.baseadoEm), jogadas = plano && plano.plano ? plano.plano.jogadas || [] : [];
    var registrar = podeRegistrar(), reg = (pj.registros || {})[sessaoId] || {};
    var feitos = (reg.blocos || []).slice();
    var rascunhoObs = ""; try { rascunhoObs = sessionStorage.getItem("ql-obs:" + pjId + ":" + sessaoId) || ""; } catch (e) { /* sem armazenamento */ }
    var obs = rascunhoObs || reg.obs || "";
    var statusAtual = reg.status || "pendente";
    var sit = { id: sessaoId, data: x.data, status: statusAtual };
    var min = (pj.params || {}).minutos;
    var final = statusAtual === "feito" || statusAtual === "parcial" || statusAtual === "nao_feito";
    var sel = escolherProximoTreino();
    var rotulo = sel && sel.programa.id === pjId && sel.sessao.id === sessaoId ? ROTULO_TREINO[sel.tipo] : "Treino";

    tela(
      '<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/programa/' + esc(pjId) + '">‹ Programa de treino</a></p>' +
      '<p class="olho">' + rotulo + " · semana " + semana.n + "</p><h1>" + esc(x.titulo) + "</h1>" +
      '<p class="treino-meta" id="metaTreino">' + esc(dataTreino(x.data)) + (min ? " · " + esc(min) + " min" : "") + ' <span id="chipTreino">' + chipSituacao(sit) + "</span></p>" +
      '<p style="margin-top:10px">' + esc(x.objetivo) + "</p>" +
      ((x.jogadas || []).length ? '<p class="sessao-jogadas"><b>Jogadas:</b> ' + x.jogadas.map(function (n) { return esc(jogadas[n] ? jogadas[n].titulo : "Jogada " + (n + 1)); }).join(" · ") + "</p>" : "") +
      ((x.fundamentos || []).length ? '<p class="sessao-fund"><b>Fundamentos:</b> ' + x.fundamentos.map(esc).join(" · ") + "</p>" : "") +
      (registrar && statusAtual === "pendente" ? '<button class="btn btn-primario btn-grande" id="btIniciar" type="button">Começar treino</button>' : "") +
      '<a class="btn btn-secundario largo" style="margin-top:8px" href="' + hrefAquecimento("treino/" + pjId + "/" + sessaoId) + '">Abrir aquecimento</a>' +
      '<h2 class="secao" id="t-blocos">Blocos do treino</h2>' +
      '<ol class="blocos" aria-labelledby="t-blocos">' + x.itens.map(function (it, i) { return blocoTreinoHtml(it, i, feitos.indexOf(i) >= 0, registrar); }).join("") + "</ol>" +
      (registrar
        ? '<div class="cartao registro-treino" id="registroTreino"><h2>Como foi o treino?</h2>' +
          '<div class="reg-opcoes" role="group" aria-label="Como foi o treino">' + ["feito", "parcial", "nao_feito"].map(function (st) {
            return '<button type="button" class="reg-op reg-' + st + '" data-st="' + st + '" aria-pressed="' + (statusAtual === st) + '">' + ROTULO_STATUS[st] + "</button>";
          }).join("") + "</div>" +
          '<label class="reg-obs">Observações<textarea id="obsTreino" maxlength="600" rows="3" placeholder="O que funcionou, o que errou, dor, cansaço…">' + esc(obs) + "</textarea></label>" +
          '<div class="acoes"><button type="button" class="btn btn-primario" id="btConcluir">' + (final ? "Atualizar registro" : "Salvar treino") + '</button><span class="nota reg-msg" id="msgTreino" role="status">' + (reg.em && final ? "Salvo em " + dataBR(reg.em) : "") + "</span></div>" +
          '<div id="aposTreino"></div></div>'
        : '<div class="cartao bloqueado" style="margin-top:18px"><p class="olho">Incluído em assinaturas</p><h2>Registre o que você treinou</h2><p class="nota" style="margin-top:6px">Marcar blocos, anotar observações e acompanhar o progresso fazem parte de uma assinatura.</p>' +
          '<div class="acoes"><a class="btn btn-primario" href="#/assinaturas">Comparar planos</a></div></div>')
    );
    if (!registrar) return;

    var msg = document.getElementById("msgTreino"), atual = final ? statusAtual : null, ocupadoSalvando = false;
    function lerObs() { return document.getElementById("obsTreino").value; }
    function chipAtualiza(st) {
      statusAtual = st; sit.status = st;
      document.getElementById("chipTreino").innerHTML = chipSituacao(sit);
      atualizarTreinoLocal(pjId, sessaoId, st);
    }
    /* grava o progresso: sempre confirma só depois de o servidor aceitar */
    async function gravar(status, silencioso) {
      var r = await api("player-dados", { metodo: "POST", corpo: { acao: "registrarSessao", planejamentoId: pjId, sessaoId: sessaoId, status: status, blocos: feitos, obs: lerObs() } });
      reg = r.registro; chipAtualiza(r.registro.status);
      try { sessionStorage.removeItem("ql-obs:" + pjId + ":" + sessaoId); } catch (e) { /* idem */ }
      if (!silencioso) msg.textContent = "Salvo.";
      return r.registro;
    }
    var btIni = document.getElementById("btIniciar");
    if (btIni) btIni.addEventListener("click", async function () {
      ocupado(btIni, true, "Iniciando…");
      try { await gravar("em_andamento", true); btIni.remove(); toast("Treino em andamento. Marque os blocos conforme avançar."); }
      catch (e) { ocupado(btIni, false); toast("Não foi possível iniciar o treino. " + e.message, null, true); }
    });
    app.querySelectorAll("[data-bloco]").forEach(function (cx) {
      cx.addEventListener("change", async function () {
        var i = parseInt(cx.getAttribute("data-bloco"), 10), antes = feitos.slice();
        feitos = cx.checked ? feitos.concat([i]) : feitos.filter(function (k) { return k !== i; });
        try {
          await gravar(final || atual ? statusAtual : "em_andamento", true);
          if (btIni && btIni.isConnected) btIni.remove();
          cx.closest(".bloco").classList.toggle("feito", cx.checked);
        } catch (e) {
          feitos = antes; cx.checked = !cx.checked;
          toast("Não foi possível salvar o bloco. " + e.message, null, true);
        }
      });
    });
    var ta = document.getElementById("obsTreino");
    ta.addEventListener("input", function () { try { sessionStorage.setItem("ql-obs:" + pjId + ":" + sessaoId, ta.value); } catch (e) { /* sem armazenamento */ } });
    ta.addEventListener("blur", async function () {
      if (!ta.value.trim() || ta.value === (reg.obs || "") || ocupadoSalvando) return;
      if (statusAtual === "pendente") return; // ainda não começou: fica no rascunho do aparelho
      try { await gravar(statusAtual, true); msg.textContent = "Observação salva."; } catch (e) { msg.textContent = "Observação não salva: " + e.message; }
    });
    document.querySelectorAll("#registroTreino .reg-op").forEach(function (bt) {
      bt.addEventListener("click", function () {
        atual = bt.getAttribute("data-st");
        document.querySelectorAll("#registroTreino .reg-op").forEach(function (o) { o.setAttribute("aria-pressed", String(o === bt)); });
        msg.textContent = "";
      });
    });
    var concluir = document.getElementById("btConcluir");
    concluir.addEventListener("click", async function () {
      if (!atual) { msg.textContent = "Escolha Feito, Parcial ou Não feito."; return; }
      ocupado(concluir, true, "Salvando…"); ocupadoSalvando = true;
      try {
        await gravar(atual, true);
        msg.textContent = "Treino salvo.";
        var prox = escolherProximoTreino();
        document.getElementById("aposTreino").innerHTML = '<div class="aviso-info" role="status" style="margin-top:14px">✓ Treino registrado como ' + ROTULO_STATUS[atual].toLowerCase() + ". O histórico e o próximo treino foram atualizados.</div>" +
          '<div class="acoes">' + (prox ? botaoTreino(prox).replace("btn-grande", "") : "") + '<a class="btn btn-secundario" href="#/treinos">Voltar aos treinos</a></div>';
      } catch (e) { msg.textContent = e.message + " Suas anotações continuam aqui: tente de novo."; }
      ocupado(concluir, false); ocupadoSalvando = false;
    });
  }
  var ROTULO_STATUS = { feito: "Feito", parcial: "Parcial", nao_feito: "Não feito" };

  /* ══ casca do app: menu lateral (computador), menu inferior (celular) e conta ══ */
  var NAV_DA_ROTA = {
    simulador: "simulador", aquecimento: "aquecimento", movimento: "movimento", "ao-vivo": "ao-vivo", pedidos: "pedidos", acompanhamento: "acompanhamento", desafio: "desafios", desafios: "desafios", partidas: "partidas",
    preparo: "temporada", diario: "competicao", temporada: "temporada", competicao: "competicao", ficha: "jogador", jogador: "jogador", conta: "conta", assinatura: "assinatura", assinaturas: "assinatura", consultorias: "consultorias", olhar: "consultorias", atendimentos: "atendimentos", atendimento: "atendimentos", treinadores: "treinadores", treinador: "treinadores", ajuda: "ajuda",
    estrategia: "estrategia", plano: "estrategia", planos: "estrategia", completar: "estrategia", gerando: "estrategia",
    jogadas: "jogadas", planejar: "treinos", treinos: "treinos", treino: "treinos", programa: "treinos", planejamento: "treinos", gerandoPlanej: "treinos",
  };
  var NAV_MAIS = { movimento: 1, preparo: 1, diario: 1, temporada: 1, competicao: 1, partidas: 1, conta: 1, jogador: 1, ficha: 1, assinatura: 1, consultorias: 1, olhar: 1, atendimentos: 1, atendimento: 1, treinadores: 1, treinador: 1, ajuda: 1 };
  var BARRA_SECAO = { aquecimento: "treinos", desafio: "treinos", desafios: "treinos" }; // páginas que pertencem à seção Treinos
  /* Competição é um app à parte (quadralab.com.br/competicao/), com as mesmas contas e o mesmo servidor. O mesmo código atende os dois:
     window.QL_MODO = "competicao" liga a navegação e a tela inicial próprias; no Player, as rotas da Competição apontam para lá. */
  var MODO_COMP = window.QL_MODO === "competicao";
  var ROTAS_COMP = { competicao: 1, temporada: 1, preparo: 1, diario: 1, devolutivas: 1, focos: 1, scouts: 1, "ao-vivo": 1, pedidos: 1, acompanhamento: 1, recomendacoes: 1, treinos: 1 };
  var ROTAS_APP_COMP = { "": 1, simulador: 1, inicio: 1, competicao: 1, temporada: 1, planejamento: 1, acompanhamento: 1, preparo: 1, diario: 1, devolutivas: 1, focos: 1, scouts: 1, "ao-vivo": 1, pedidos: 1, recomendacoes: 1, treinos: 1, consultorias: 1, partidas: 1, aquecimento: 1, desafios: 1, pensamentos: 1, ritual: 1, conta: 1, ajuda: 1, treinadores: 1, treinador: 1, atendimentos: 1, atendimento: 1 };
  var PLAYER_BASE = "";
  var MARCA_APP = MODO_COMP ? "QuadraLab Competição" : "QuadraLab Player";
  if (MODO_COMP) {
    NAV_DA_ROTA = { "": "inicio", simulador: "simulador", inicio: "inicio", competicao: "inicio", temporada: "temporada", planejamento: "planejamento", acompanhamento: "acompanhamento", preparo: "temporada", aquecimento: "aquecimento", desafios: "desafios", desafio: "desafios", pensamentos: "pensamentos", ritual: "ritual", partidas: "partidas", diario: "diario", devolutivas: "inicio", focos: "inicio", scouts: "inicio", pedidos: "pedidos", recomendacoes: "recomendacoes", treinos: "treinos", consultorias: "consultorias", conta: "conta", ajuda: "ajuda", treinadores: "treinadores", treinador: "treinadores", atendimentos: "atendimentos", atendimento: "atendimentos" };
    NAV_MAIS = { conta: 1, ajuda: 1, consultorias: 1, pensamentos: 1, ritual: 1, treinadores: 1, treinador: 1, atendimentos: 1, atendimento: 1 }; BARRA_SECAO = { aquecimento: "temporada", desafio: "temporada", desafios: "temporada", planejamento: "temporada" };
  }
  var ultimaCasca = { logado: false, rota: "" };
  function atualizarCasca(logado, rota) {
    ultimaCasca = { logado: logado, rota: rota };
    if (MODO_COMP && logado) aplicarPapel(papelGuardado());
    document.body.classList.toggle("logado", logado);
    lateral.hidden = !logado;
    navInf.hidden = !logado;
    document.querySelectorAll(".js-abrir-conta").forEach(function (b) { b.hidden = !logado; });
    var pagina = NAV_DA_ROTA[rota] || "inicio";                                   // item específico (barra lateral)
    var secao = NAV_MAIS[rota] ? "mais" : (BARRA_SECAO[rota] || NAV_DA_ROTA[rota] || "inicio"); // um só item da barra inferior
    if (MODO_COMP && papelGuardado() === "atleta" && (rota === "pedidos" || rota === "acompanhamento" || rota === "ao-vivo")) secao = "mais";
    var maisAberto = painelAberto === painelMais;
    document.querySelectorAll("[data-nav]").forEach(function (el) {
      var naBarra = !!el.closest(".navinf");
      var vale = naBarra ? el.getAttribute("data-nav") === secao : el.getAttribute("data-nav") === pagina;
      if (naBarra && maisAberto) vale = false; // com o painel Mais aberto, nenhuma página fica como atual
      if (vale && logado) el.setAttribute("aria-current", "page"); else el.removeAttribute("aria-current");
    });
    btMais.classList.toggle("aberto", maisAberto && logado);
    if (!logado) fecharPainel(false);
    atualizarConta();
  }
  document.addEventListener("click", async function (ev) {
    var b = ev.target.closest("[data-acao='sair']");
    if (!b) return;
    fecharPainel(false);
    await auth.signOut();
    estado.dados = null; estado.fluxo = null; estado.assin = null; estado.olhar = null; estado.editandoPerfil = false;
    try { localStorage.removeItem("ql-comp-papel"); } catch (e) { /* sem armazenamento */ }
    vigia.sig = ""; vigia.ultimo = null; marcarBadge(0);
    ir("#/entrar");
  });


  /* ══ conta, assinatura e suporte ═══════════════════════════════════
     Tudo o que é comercial vem do servidor (player-assinatura): produtos, preços, limites e a situação da
     assinatura. O app só mostra — nenhuma liberação nasce de botão, endereço de retorno ou estado do navegador. */
  var PERIODO_TXT = { mensal: "mês", trimestral: "trimestre", semestral: "semestre", anual: "ano" };
  var NIVEL_ORDEM = { gratis: 0, p1: 1, p2: 2, p3: 3 };

  function reais(centavos) { return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
  function dataISO(iso) { return iso ? dataExtensa(String(iso).slice(0, 10)) : ""; }
  function cobrancaTexto(p) {
    if (!p || !p.precoCentavos) return "";
    if (p.periodicidade === "mensal") return reais(p.precoCentavos) + " por mês";
    return "Cobrança de " + reais(p.precoCentavos) + " a cada " + (PERIODO_TXT[p.periodicidade] || "período");
  }
  function suporteUrl(mensagem) {
    return "https://wa.me/" + WHATSAPP_CONSULTORIA + "?text=" + encodeURIComponent(mensagem || "Olá, Richard! Preciso de ajuda com o QuadraLab Player.");
  }
  function assinaturaDoJogador() { return (estado.dados && estado.dados.assinatura) || { estado: "gratuito", rotulo: "Gratuito", nome: "Gratuito", recursos: {}, uso: {} }; }

  var SIMBOLO_ESTADO = { gratuito: "", teste: "◇ ", ativa: "✓ ", pagamento_pendente: "◔ ", problema_pagamento: "! ", cancelamento_programado: "◐ ", encerrada: "– " };
  function selloAssinatura(a) {
    return '<span class="sello-ass s-ass-' + esc(a.estado) + '">' + (SIMBOLO_ESTADO[a.estado] || "") + esc(a.rotulo) + "</span>";
  }

  /* cache da área comercial; a consulta falha de forma clara quando a conexão cai */
  async function carregarAssinatura(forcar) {
    if (!forcar && estado.assin && Date.now() - estado.assin.carregadoEm < 60000) return estado.assin;
    var r = await api("player-assinatura");
    r.carregadoEm = Date.now();
    estado.assin = r;
    if (estado.dados) estado.dados.assinatura = r.assinatura;
    aplicarLinks();
    atualizarConta();
    return r;
  }
  function aplicarLinks() {
    var links = (estado.assin && estado.assin.links) || {};
    document.querySelectorAll("[data-link]").forEach(function (a) {
      var u = links[a.getAttribute("data-link")];
      a.hidden = !u; if (u) a.href = u;
    });
  }
  function marcadorCheckout() {
    try { return JSON.parse(localStorage.getItem("ql-checkout:" + auth.currentUser.uid) || "null"); } catch (e) { return null; }
  }
  function marcarCheckout(produtoId) {
    try { localStorage.setItem("ql-checkout:" + auth.currentUser.uid, JSON.stringify({ em: Date.now(), produtoId: produtoId })); } catch (e) { /* sem armazenamento */ }
  }
  function limparCheckout() { try { localStorage.removeItem("ql-checkout:" + auth.currentUser.uid); } catch (e) { /* idem */ } }

  /* ── avatar e painel de conta ── */
  function iniciais(nome) {
    var p = String(nome || "").trim().split(/\s+/).filter(Boolean);
    if (!p.length) return "?";
    return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
  }
  function avatarConteudo() {
    var perfil = (estado.dados && estado.dados.perfil) || {};
    return perfil.foto ? '<img src="' + esc(perfil.foto) + '" alt="">' : esc(iniciais(perfil.nome || perfil.email));
  }
  function atualizarConta() {
    if (!estado.dados) return;
    var perfil = estado.dados.perfil, a = assinaturaDoJogador();
    document.querySelectorAll("[data-avatar]").forEach(function (el) { el.innerHTML = avatarConteudo(); });
    document.querySelectorAll("[data-conta-nome]").forEach(function (el) { el.textContent = perfil.nome || "Minha conta"; el.title = perfil.nome || ""; });
    var rotuloAss = a.nome === a.rotulo ? a.rotulo : a.nome + " · " + a.rotulo;
    document.querySelectorAll("[data-conta-ass]").forEach(function (el) { el.textContent = MODO_COMP ? "Atleta, responsável ou treinador" : rotuloAss; });
    var em = document.getElementById("perfilEmail"); if (em) { em.textContent = perfil.email; em.title = perfil.email; }
    var as = document.getElementById("perfilAss"); if (as) as.innerHTML = (a.nome === a.rotulo ? "" : '<span class="pc-ass-nome">' + esc(a.nome) + "</span> ") + selloAssinatura(a);
    var amp = document.getElementById("lnkAmpliar");
    if (amp) {
      var maior = estado.assin && (estado.assin.catalogo || []).some(function (p) { return (NIVEL_ORDEM[p.nivel] || 0) > (NIVEL_ORDEM[a.nivel] || 0); });
      var mostrar = a.estado === "gratuito" || a.estado === "encerrada" || (a.estado === "ativa" && a.origem === "eduzz" && maior);
      amp.hidden = !mostrar || a.estado === "teste";
      amp.textContent = a.estado === "ativa" ? "Ampliar acesso" : "Comparar planos";
    }
  }

  var painelAberto = null, gatilhoPainel = null;
  function abrirPainel(el, gatilho) {
    fecharPainel(false);
    painelAberto = el; gatilhoPainel = gatilho || null;
    el.hidden = false; painelFundo.hidden = false;
    document.documentElement.classList.add("sem-rolagem");
    document.querySelectorAll(".js-abrir-conta, #btMais").forEach(function (b) { b.setAttribute("aria-expanded", String(b === gatilho)); });
    atualizarCasca(ultimaCasca.logado, ultimaCasca.rota);
    var alvo = el.querySelector(".painel-fechar") || el.querySelector("a, button");
    if (alvo) alvo.focus();
  }
  function fecharPainel(devolverFoco) {
    if (!painelAberto) return;
    painelAberto.hidden = true; painelFundo.hidden = true;
    document.documentElement.classList.remove("sem-rolagem");
    document.querySelectorAll(".js-abrir-conta, #btMais").forEach(function (b) { b.setAttribute("aria-expanded", "false"); });
    var g = gatilhoPainel; painelAberto = null; gatilhoPainel = null;
    if (ultimaCasca.logado) atualizarCasca(ultimaCasca.logado, ultimaCasca.rota);
    if (devolverFoco && g && !g.hidden) g.focus();
  }
  var painelPerfil = document.getElementById("painelPerfil");
  document.querySelectorAll(".js-abrir-conta").forEach(function (b) {
    b.addEventListener("click", function () {
      if (painelAberto === painelPerfil) { fecharPainel(true); return; }
      atualizarConta();
      abrirPainel(painelPerfil, b);
      carregarAssinatura().catch(function () { /* o painel continua com o que já tem */ });
    });
  });
  document.getElementById("btFecharConta").addEventListener("click", function () { fecharPainel(true); });
  btMais.addEventListener("click", function () { painelAberto === painelMais ? fecharPainel(true) : abrirPainel(painelMais, btMais); });
  document.getElementById("btFecharMais").addEventListener("click", function () { fecharPainel(true); });
  painelFundo.addEventListener("click", function () { fecharPainel(true); });
  [painelPerfil, painelMais].forEach(function (p) { p.addEventListener("click", function (ev) { if (ev.target.closest("a")) fecharPainel(false); }); });
  document.addEventListener("keydown", function (ev) {
    if (!painelAberto) return;
    if (ev.key === "Escape") { ev.preventDefault(); fecharPainel(true); return; }
    if (ev.key === "Tab") {
      var itens = [].slice.call(painelAberto.querySelectorAll("button, a[href]")).filter(function (x) { return !x.hidden && x.offsetParent !== null; });
      var i = itens.indexOf(document.activeElement);
      if (!itens.length) return;
      if (ev.shiftKey && i <= 0) { ev.preventDefault(); itens[itens.length - 1].focus(); }
      else if (!ev.shiftKey && i === itens.length - 1) { ev.preventDefault(); itens[0].focus(); }
    }
  });

  /* ── avisos de consumo, perto da ação ── */
  function dataCurtaISO(iso) { return iso ? dataCurta(String(iso).slice(0, 10)) : ""; }
  function linhaUso(rotuloPlural, rotuloSingular, u, periodo) {
    if (!u || u.usadas == null) return "";
    if (u.limite != null) return u.usadas + " de " + u.limite + " " + (u.limite === 1 ? rotuloSingular : rotuloPlural) + (periodo ? " utilizadas neste período" : " utilizada");
    return u.usadas + " " + (u.usadas === 1 ? rotuloSingular : rotuloPlural) + " neste período · sem limite definido";
  }
  /* mensagem curta sobre estratégias para os botões de criar */
  function avisoCota() {
    var d = estado.dados, a = assinaturaDoJogador(), e = (a.uso || {}).estrategias || {};
    if (d.full || a.estado === "teste") return "Acesso de teste: sem limite definido.";
    if (a.origem === "eduzz" && (a.estado === "ativa" || a.estado === "cancelamento_programado")) {
      return e.limite != null ? e.usadas + " de " + e.limite + " estratégias utilizadas neste período." : "Sem limite de estratégias definido para a sua assinatura.";
    }
    if (d.gratisRestantes) return "Sua primeira estratégia é grátis (0 de 1 utilizada).";
    if (d.creditos) return "Você tem " + d.creditos + (d.creditos === 1 ? " crédito" : " créditos") + " para novas estratégias.";
    return "Estratégia grátis: 1 de 1 utilizada.";
  }
  /* quando a cota acabou: o que aconteceu, quando renova e o caminho para ampliar — sem apagar nada */
  function limiteAtingidoHtml(motivo, renovaEm, o) {
    o = o || {};
    var periodo = motivo === "limite_periodo";
    return '<div class="cartao limite-atingido" role="status"><p class="olho">' + (periodo ? "Limite do período atingido" : "Estratégia grátis utilizada") + "</p>" +
      "<p>" + (periodo ? "Você usou todas as " + (o.recurso || "estratégias") + " previstas no período da sua assinatura." + (renovaEm ? " Os limites voltam a partir do próximo pagamento confirmado; o acesso atual vai até " + esc(dataISO(renovaEm)) + "." : "")
        : "Você já usou a estratégia grátis. Para criar outra, é preciso uma assinatura.") + "</p>" +
      '<p class="nota" style="margin-top:6px">Seu perfil, suas estratégias e o que você já preencheu continuam salvos.</p>' +
      '<div class="acoes"><a class="btn btn-primario" href="#/assinaturas">Comparar assinaturas</a><a class="btn btn-secundario" href="#/assinatura">Plano e assinatura</a></div></div>';
  }

  /* ── Meu perfil (conta) ── */
  function lerFoto(arquivo) {
    return new Promise(function (resolve, reject) {
      if (!arquivo || !/^image\//.test(arquivo.type)) { reject(new Error("Escolha uma imagem.")); return; }
      var leitor = new FileReader();
      leitor.onerror = function () { reject(new Error("Não foi possível ler a imagem.")); };
      leitor.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error("Não foi possível abrir essa imagem.")); };
        img.onload = function () {
          var t = 192, c = document.createElement("canvas"); c.width = t; c.height = t;
          var lado = Math.min(img.width, img.height), sx = (img.width - lado) / 2, sy = (img.height - lado) / 2;
          c.getContext("2d").drawImage(img, sx, sy, lado, lado, 0, 0, t, t);
          var url = c.toDataURL("image/jpeg", 0.82);
          if (url.length > 55000) { reject(new Error("A foto ficou grande demais. Tente outra.")); return; }
          resolve(url);
        };
        img.src = leitor.result;
      };
      leitor.readAsDataURL(arquivo);
    });
  }
  function telaConta() {
    var d = estado.dados, perfil = d.perfil;
    tela(
      '<h1>Meu perfil</h1><p class="sub">Seus dados de acesso.' + (MODO_COMP ? "" : ' As informações esportivas ficam em <a href="#/jogador">Meu perfil de jogador</a>.') + '</p>' +
      '<div class="cartao conta-cartao" style="margin-top:16px"><div class="conta-foto"><span class="avatar avatar-grande" data-avatar id="avatarConta"></span>' +
        '<div class="conta-foto-acoes"><label class="btn btn-secundario btn-pequeno" for="arqFoto">' + (perfil.foto ? "Trocar foto" : "Adicionar foto") + '</label><input type="file" id="arqFoto" accept="image/*" class="sr">' +
        (perfil.foto ? '<button type="button" class="btn btn-texto" id="btRemoverFoto">Remover foto</button>' : "") +
        '<p class="nota">Opcional. Sem foto, usamos as suas iniciais.</p></div></div>' +
      '<form id="fConta" novalidate style="margin-top:14px">' +
        '<div class="campo"><label for="contaNome">Nome</label><input id="contaNome" maxlength="80" autocomplete="name" value="' + esc(perfil.nome) + '"></div>' +
        '<div class="campo"><label for="contaEmail">E-mail</label><input id="contaEmail" type="email" value="' + esc(perfil.email) + '" readonly aria-describedby="notaEmail"><p class="nota" id="notaEmail" style="margin-top:6px">É o e-mail do seu acesso. Para trocá-lo, <a href="' + suporteUrl("Olá, Richard! Quero trocar o e-mail da minha conta no QuadraLab Player.") + '" target="_blank" rel="noopener">fale com o suporte<span class="sr"> (abre o WhatsApp)</span></a>.</p></div>' +
        '<div class="aviso" id="avisoConta" role="alert" hidden></div>' +
        '<button class="btn btn-primario" id="btSalvarConta" type="submit">Salvar alterações</button></form></div>' +
      '<div class="cartao" style="margin-top:14px"><h2>Segurança</h2><p class="nota" style="margin-top:6px">O acesso é por e-mail e senha. Para criar uma nova senha, enviamos um link para o seu e-mail.</p>' +
        '<div class="acoes"><button type="button" class="btn btn-secundario" id="btSenha">Enviar link para alterar a senha</button></div><p class="nota" id="msgSenha" role="status" style="margin-top:8px"></p></div>'
      + '<div class="cartao" style="margin-top:14px"><h2>Privacidade e dados</h2><p class="nota" style="margin-top:6px">Você pode baixar uma cópia dos seus dados (perfil, estratégias, programas e partidas) ou excluir a sua conta. Você também corrige e exclui cada partida na própria tela de Partidas.</p>' +
        '<div class="acoes"><button type="button" class="btn btn-secundario" id="btBaixarDados">Baixar meus dados</button></div>' +
        '<details class="det" style="margin-top:10px"><summary>Excluir minha conta</summary><div style="margin-top:10px"><p class="nota">Isso apaga o seu perfil, as estratégias, os programas e as partidas e não pode ser desfeito. Registros de pagamento ficam guardados pela Eduzz. Se houver assinatura vigente, cancele-a antes.</p>' +
        '<div class="campo" style="margin-top:10px"><label for="excConfirma">Digite o e-mail da conta para confirmar</label><input id="excConfirma" type="email" autocomplete="off" inputmode="email"></div>' +
        '<div class="aviso" id="avisoExcluir" role="alert" hidden></div><div class="acoes"><button type="button" class="btn btn-secundario" id="btExcluirConta">Excluir minha conta definitivamente</button></div></div></details></div>'
    );
    atualizarConta();
    var aviso = document.getElementById("avisoConta");
    document.getElementById("btBaixarDados").addEventListener("click", async function () {
      var bt = this; ocupado(bt, true, "Preparando…");
      try {
        var r = await fetch("/.netlify/functions/player-privacidade", { headers: { authorization: "Bearer " + (await auth.currentUser.getIdToken()) } });
        if (!r.ok) throw new Error((await r.json().catch(function () { return {}; })).erro || "Não foi possível baixar agora.");
        var blob = await r.blob(), a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = "meus-dados-quadralab-player.json"; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
        toast("Seus dados foram baixados.");
      } catch (e) { toast(e.message, null, true); }
      finally { ocupado(bt, false); }
    });
    document.getElementById("btExcluirConta").addEventListener("click", async function () {
      var bt = this, av = document.getElementById("avisoExcluir"); av.hidden = true;
      var conf = document.getElementById("excConfirma").value.trim();
      if (!conf) { av.textContent = "Digite o e-mail da conta para confirmar."; av.hidden = false; return; }
      if (!window.confirm("Excluir a conta e todos os dados do " + MARCA_APP + "? Isso não pode ser desfeito.")) return;
      ocupado(bt, true, "Excluindo…");
      try {
        var r = await api("player-privacidade", { metodo: "POST", corpo: { acao: "excluirConta", confirmar: conf } });
        estado.dados = null; estado.assin = null;
        try { await auth.signOut(); } catch (e) { /* a conta pode já não existir */ }
        location.hash = ""; rotear();
        toast(r.contaRemovida ? "Sua conta foi excluída." : "Seus dados do " + (MODO_COMP ? "Competição" : "Player") + " foram excluídos.");
      } catch (e) { av.textContent = e.message; av.hidden = false; ocupado(bt, false); }
    });
    async function salvar(extras, bt, textoOcupado) {
      var nome = document.getElementById("contaNome").value.trim();
      if (!nome) { aviso.textContent = "Informe seu nome."; aviso.hidden = false; return false; }
      aviso.hidden = true;
      if (bt) ocupado(bt, true, textoOcupado || "Salvando…");
      try {
        var corpo = { acao: "salvarConta", nome: nome };
        if (extras && extras.foto !== undefined) corpo.foto = extras.foto;
        var r = await api("player-dados", { metodo: "POST", corpo: corpo });
        estado.dados.perfil = Object.assign({}, estado.dados.perfil, r.perfil);
        atualizarConta();
        return true;
      } catch (e) {
        aviso.textContent = e.message + " Suas alterações continuam na tela: tente de novo."; aviso.hidden = false; return false;
      } finally { if (bt) ocupado(bt, false); }
    }
    document.getElementById("fConta").addEventListener("submit", async function (ev) {
      ev.preventDefault();
      if (await salvar(null, document.getElementById("btSalvarConta"))) toast("Dados da conta salvos.");
    });
    document.getElementById("arqFoto").addEventListener("change", async function (ev) {
      var arq = ev.target.files[0]; if (!arq) return;
      try {
        var url = await lerFoto(arq);
        if (await salvar({ foto: url })) { toast("Foto atualizada."); telaConta(); }
      } catch (e) { aviso.textContent = e.message; aviso.hidden = false; }
    });
    var rem = document.getElementById("btRemoverFoto");
    if (rem) rem.addEventListener("click", async function () { if (await salvar({ foto: "" }, rem)) { toast("Foto removida."); telaConta(); } });
    document.getElementById("btSenha").addEventListener("click", async function () {
      var bt = this, msg = document.getElementById("msgSenha");
      ocupado(bt, true, "Enviando…");
      try { await auth.sendPasswordResetEmail(estado.dados.perfil.email); msg.textContent = "Enviamos um link para " + estado.dados.perfil.email + ". Abra o e-mail para criar a nova senha."; }
      catch (e) { msg.textContent = /network/.test((e && e.code) || "") ? "Sem conexão. Tente de novo." : "Não foi possível enviar agora. Tente de novo em instantes."; }
      ocupado(bt, false);
    });
  }

  /* ── Meu perfil de jogador (a mesma ficha que alimenta estratégias e treinos) ── */
  function rotuloOp(lista, valor) {
    var m = (lista || []).filter(function (o) { return o[0] === valor; })[0];
    return m ? m[1] : "";
  }
  function linhaPerfil(rotulo, valor) { return '<div class="rp-linha"><dt>' + esc(rotulo) + "</dt><dd>" + (valor ? esc(valor) : '<span class="nota">Não informado</span>') + "</dd></div>"; }
  function secaoPerfil(titulo, etapa, linhas) {
    return '<section class="cartao rp-secao"><div class="rp-topo"><h2>' + esc(titulo) + '</h2><a class="btn btn-texto btn-editar" href="#/ficha/' + etapa + '" data-editar>Editar<span class="sr"> ' + esc(titulo) + "</span></a></div><dl>" + linhas + "</dl></section>";
  }
  function telaJogador() {
    var d = estado.dados, f = d.ficha || {}, a = f.adversario || {};
    estado.editandoPerfil = false;
    if (d.ficha) { estado.ficha = JSON.parse(JSON.stringify(d.ficha)); estado.ficha.adversario = estado.ficha.adversario || {}; }
    var html = "<h1>Meu perfil de jogador</h1><p class=\"sub\">O seu jogo, como alimenta as estratégias e os treinos.</p>";
    if (!d.fichaCompleta) {
      tela(html + '<div class="cartao destaque" style="margin-top:16px"><h2>Complete o seu perfil</h2><p class="nota" style="margin-top:6px">São 4 etapas rápidas. Suas respostas ficam salvas.</p><a class="btn btn-primario btn-grande" href="#/ficha/1">Continuar meu perfil</a></div>');
      return;
    }
    var primeiraEstrategia = planosProntos()[0];
    var mudou = d.fichaAtualizadaEm && primeiraEstrategia && String(d.fichaAtualizadaEm) > String(primeiraEstrategia.criadoEm);
    var funcoes = (f.armaPrincipal ? rotuloOp(AREAS, f.armaPrincipal) : "");
    html += '<p class="nota" style="margin-top:8px">Ao editar, as suas estratégias e programas de treino continuam como estão.</p>' +
      secaoPerfil("Sobre você", 1, linhaPerfil("Nível", rotuloOp(OP.nivel, f.nivel)) + linhaPerfil("Mão dominante", rotuloOp(OP.mao, f.mao)) + linhaPerfil("Backhand", rotuloOp(OP.backhand, f.backhand)) + linhaPerfil("Piso", rotuloOp(OP.piso, f.piso))) +
      secaoPerfil("Seu jogo", 2, linhaPerfil("Golpe mais forte", funcoes) + linhaPerfil("Ponto mais vulnerável", rotuloOp(AREAS, f.pontoFraco)) + linhaPerfil("Como constrói o ponto", rotuloOp(OP.padraoPonto, f.padraoPonto))) +
      secaoPerfil("Em quadra", 3, linhaPerfil("Rede", rotuloOp(OP.rede, f.rede)) + linhaPerfil("Devolução", rotuloOp(OP.devolucao, f.devolucao)) + linhaPerfil("Sob pressão", rotuloOp(OP.pressao, f.pressao)) + linhaPerfil("Observações", f.observacoes)) +
      secaoPerfil("Adversário", 4, a.ativo
        ? linhaPerfil("Nome", a.nome) + linhaPerfil("Estilo", rotuloOp(OP.advEstilo, a.estilo)) + linhaPerfil("Mão", rotuloOp(OP.advMao, a.mao)) + linhaPerfil("Pontos fortes", (a.pontosFortes || []).map(function (k) { return rotuloOp(AREAS, k); }).join(", ")) + linhaPerfil("Pontos fracos", (a.pontosFracos || []).map(function (k) { return rotuloOp(AREAS, k); }).join(", ")) + linhaPerfil("Observações", a.observacoes)
        : '<div class="rp-linha"><dd class="nota">Sem adversário específico. A estratégia é geral para o seu jogo.</dd></div>');
    var comps = d.complementos || [];
    if (comps.length) {
      html += '<details class="det"><summary>Respostas às perguntas das estratégias (' + comps.length + ')</summary><dl class="rp-comps">' + comps.map(function (c) {
        return "<div><dt>" + esc(c.pergunta) + (c.contexto ? ' <span class="nota">(' + esc(c.contexto) + ")</span>" : "") + "</dt><dd>" + esc(c.resposta) + "</dd></div>";
      }).join("") + "</dl></details>";
    }
    if (mudou) {
      html += '<div class="cartao compacto atualizar-estrategia" style="margin-top:14px"><p class="olho">Seu perfil mudou</p><p>Você atualizou o perfil depois da sua última estratégia. Nada foi alterado nas estratégias nem nos programas existentes.</p>' +
        (d.podeGerar ? '<button class="btn btn-secundario" data-gerar type="button" style="margin-top:10px">Criar nova estratégia com o perfil atualizado</button><p class="nota" style="margin-top:6px">' + esc(avisoCota()) + "</p>"
          : '<p class="nota" style="margin-top:6px">' + esc(avisoCota()) + ' <a href="#/assinaturas">Comparar assinaturas</a></p>') + "</div>";
    }
    tela(html);
    ligarGerar();
    app.querySelectorAll("[data-editar]").forEach(function (a) { a.addEventListener("click", function () { estado.editandoPerfil = true; }); });
  }

  /* ── Planos e serviços: as quatro páginas ligadas por uma barra de abas, para ninguém se perder entre elas ── */
  function abasPlanosHtml(atual) {
    var abas = [["assinatura", "Meu plano", "#/assinatura"], ["assinaturas", "Comparar planos", "#/assinaturas"], ["consultorias", "Consultorias e olhar do treinador", "#/consultorias"], ["atendimentos", "Meus atendimentos", "#/atendimentos"]];
    return '<nav aria-label="Planos e serviços"><ul class="abas-planos">' + abas.map(function (a) { return '<li><a href="' + a[2] + '"' + (a[0] === atual ? ' aria-current="page"' : "") + ">" + a[1] + "</a></li>"; }).join("") + "</ul></nav>";
  }

  /* ── Plano e assinatura ── */
  function recursosIncluidosHtml(a) {
    var r = a.recursos || {};
    if (estado.assin && estado.assin.usoPlanos && estado.assin.usoPlanos.ativo) r = { planejamento: true, treinoDia: true }; // modelo novo: todos os planos têm programa e registro de treinos
    var itens = [
      ["Criar estratégias e ver as jogadas", true],
      ["Programa de treino", !!r.planejamento],
      ["Registro de treinos (marcar blocos e anotar observações)", !!r.treinoDia],
    ];
    return '<ul class="recursos">' + itens.map(function (i) {
      return '<li class="' + (i[1] ? "incluido" : "nao-incluido") + '"><span class="rec-marca" aria-hidden="true">' + (i[1] ? "✓" : "–") + "</span><span>" + esc(i[0]) + '<span class="sr">' + (i[1] ? " — incluído" : " — não incluído") + "</span></span></li>";
    }).join("") + "</ul>";
  }
  function barraUso(u) {
    if (!u || u.limite == null || u.usadas == null) return "";
    var pct = Math.min(100, Math.round(u.usadas / u.limite * 100));
    return '<span class="prog-barra uso-barra" aria-hidden="true"><i style="width:' + pct + '%"></i></span>';
  }
  /* modelo novo de planos (só quando o servidor está com os limites em vigor): ciclo, gerações, adversários e programas ativos */
  function usoPlanosHtml(u) {
    function lim(x, unid) { return x.limite == null ? x.usadas + " " + unid + " · sem limite" : x.usadas + " de " + x.limite + " " + unid; }
    function linha(rot, x, unid) { return "<li><strong>" + rot + "</strong><span>" + esc(lim(x, unid)) + "</span>" + barraUso(x) + "</li>"; }
    var per = u.periodo === "vitalicio" ? "uso total do plano gratuito" : "neste ciclo" + (u.renovaEm ? ", renova em " + dataISO(u.renovaEm) : "");
    return '<p class="nota">' + esc(u.plano.nome) + " — " + esc(per) + '.</p><ul class="uso-lista">' +
      linha("Planos de jogo", u.planosJogo, "utilizados") + linha("Estratégias contra adversários", u.estrategiasAdversario, "utilizadas") +
      linha("Adversários cadastrados", u.adversarios, "cadastrados") + linha("Programas de treinamento ativos", u.programasAtivos, "ativos") + "</ul>" +
      (u.creditos ? '<p class="nota">Você também tem ' + u.creditos + (u.creditos === 1 ? " geração avulsa disponível." : " gerações avulsas disponíveis.") + "</p>" : "") +
      '<p class="nota">As jogadas e as sessões de treino não têm limite. Seus registros anteriores ficam sempre disponíveis para consulta.</p>' +
      '<div class="acoes"><a class="btn btn-primario" href="#/assinaturas">Ampliar o plano</a></div>';
  }
  function usoHtml(a) {
    var e = (a.uso || {}).estrategias || {}, p = (a.uso || {}).programas || {}, r = a.recursos || {};
    var criadas = planosProntos().length, programas = planejamentosProntos().length, linhas = "";
    if (a.origem === "eduzz") {
      linhas += '<li><strong>Estratégias</strong><span>' + esc(linhaUso("estratégias", "estratégia", e, true)) + "</span>" + barraUso(e) + "</li>" +
        '<li><strong>Programas de treino</strong><span>' + esc(r.planejamento ? linhaUso("programas", "programa", p, true) : "Não incluído nesta assinatura") + "</span>" + (r.planejamento ? barraUso(p) : "") + "</li>";
    } else if (a.origem === "gratuito") {
      linhas += '<li><strong>Estratégias</strong><span>' + esc(e.usadas + " de " + e.limite + " estratégia grátis utilizada") + (a.creditos ? " · " + a.creditos + (a.creditos === 1 ? " crédito disponível" : " créditos disponíveis") : "") + "</span>" + barraUso(e) + "</li>" +
        '<li><strong>Programas de treino</strong><span>Não incluído no acesso gratuito</span></li>';
    } else {
      linhas += '<li><strong>Estratégias</strong><span>' + criadas + (criadas === 1 ? " criada" : " criadas") + ' · sem limite definido neste acesso</span></li>' +
        '<li><strong>Programas de treino</strong><span>' + programas + (programas === 1 ? " criado" : " criados") + (r.planejamento ? ' · sem limite definido neste acesso' : " · não incluído") + "</span></li>";
    }
    var renova = a.origem === "eduzz" && (e.limite != null || p.limite != null) && a.acessoAte
      ? '<p class="nota" style="margin-top:8px">Período atual: ' + esc(dataISO(a.periodoInicio)) + " a " + esc(dataISO(a.acessoAte)) + ". Os limites voltam ao início quando o próximo pagamento for confirmado.</p>" : "";
    return '<ul class="uso-lista">' + linhas + "</ul>" + renova;
  }
  function textoAcesso(a) {
    if (a.estado === "teste") return "Acesso de teste, sem cobrança e sem data de término definida.";
    if (a.estado === "gratuito") return estado.assin && estado.assin.usoPlanos && estado.assin.usoPlanos.ativo ? "Sem cobrança, para sempre. Seus registros ficam salvos mesmo quando você atinge um limite." : "Sem cobrança. Você tem a primeira estratégia grátis.";
    if (a.origem === "manual") return "Acesso liberado pela equipe, sem cobrança automática nem data de término definida.";
    if (a.estado === "encerrada") return a.acessoAte ? "Seu acesso terminou em " + dataISO(a.acessoAte) + ". Suas estratégias e treinos continuam salvos." : "Seu acesso foi encerrado. Suas estratégias e treinos continuam salvos.";
    if (a.estado === "cancelamento_programado") return "Seu acesso continua até " + dataISO(a.acessoAte) + " e não será renovado.";
    if (a.estado === "pagamento_pendente") return "Estamos aguardando a confirmação do pagamento. O acesso atual vai até " + dataISO(a.acessoAte) + ".";
    if (a.estado === "problema_pagamento") return "Houve um problema no pagamento. O acesso atual vai até " + dataISO(a.acessoAte) + ": regularize para não perder o acesso.";
    return a.cobrancaAutomatica ? "Acesso confirmado até " + dataISO(a.acessoAte) + ". A renovação é automática: a próxima cobrança segue o seu meio de pagamento." : "Acesso confirmado até " + dataISO(a.acessoAte) + ".";
  }
  function acoesAssinaturaHtml(a, assin) {
    var links = assin.links || {}, mais = (assin.catalogo || []).some(function (p) { return (NIVEL_ORDEM[p.nivel] || 0) > (NIVEL_ORDEM[a.nivel] || 0); });
    var h = '<div class="acoes">';
    h += '<a class="btn btn-primario" href="#/assinaturas">' + (a.estado === "gratuito" || a.estado === "encerrada" ? "Comparar planos" : "Comparar assinaturas") + "</a>";
    if (a.estado === "ativa" && a.origem === "eduzz" && mais) h += '<a class="btn btn-secundario" href="#/assinaturas">Ampliar acesso</a>';
    if (a.origem === "eduzz" && a.estado !== "encerrada" && a.cobrancaAutomatica === false && a.produtoId) {
      var prod = (assin.catalogo || []).filter(function (p) { return p.id === a.produtoId; })[0];
      if (prod) h += '<a class="btn btn-secundario" href="' + esc(prod.checkoutUrl) + '" target="_blank" rel="noopener" data-checkout="' + esc(prod.id) + '">Renovar acesso<span class="sr"> (abre o pagamento em nova aba)</span></a>';
    }
    if (a.origem === "eduzz") {
      h += '<a class="btn btn-secundario" href="' + esc(links.gerenciarPagamento || suporteUrl("Olá, Richard! Preciso gerenciar o pagamento da minha assinatura do QuadraLab Player.")) + '" target="_blank" rel="noopener">Gerenciar pagamento<span class="sr"> (abre em nova aba)</span></a>';
      if (links.historicoPagamentos) h += '<a class="btn btn-secundario" href="' + esc(links.historicoPagamentos) + '" target="_blank" rel="noopener">Histórico de pagamentos<span class="sr"> (abre em nova aba)</span></a>';
      if (a.estado === "ativa" || a.estado === "problema_pagamento" || a.estado === "pagamento_pendente") h += '<a class="btn btn-texto" href="' + esc(links.gerenciarPagamento || suporteUrl("Olá, Richard! Quero cancelar a minha assinatura do QuadraLab Player.")) + '" target="_blank" rel="noopener">Gerenciar cancelamento<span class="sr"> (abre em nova aba)</span></a>';
    }
    return h + "</div>";
  }
  async function telaAssinatura() {
    tela('<p class="carregando">Carregando sua assinatura…</p>', true);
    var assin;
    try { assin = await carregarAssinatura(true); }
    catch (e) {
      tela('<h1>Plano e assinatura</h1><div class="aviso" role="alert" style="margin-top:14px">' + esc(e.message) + '</div><div class="acoes"><button class="btn btn-primario" id="btTentarAss" type="button">Tentar de novo</button></div>');
      document.getElementById("btTentarAss").addEventListener("click", telaAssinatura);
      return;
    }
    var a = assin.assinatura, marc = marcadorCheckout();
    if (marc && a.estado === "ativa" && a.origem === "eduzz") limparCheckout();
    var aguardando = marc && Date.now() - marc.em < 3 * 3600 * 1000 && !(a.estado === "ativa" && a.origem === "eduzz");
    tela(
      abasPlanosHtml("assinatura") + "<h1>Plano e assinatura</h1>" +
      (aguardando ? '<div class="aviso-info aguardando" role="status" style="margin-top:14px"><strong>Aguardando a confirmação do pagamento.</strong> Pode levar alguns minutos depois de pagar. Seu acesso muda aqui quando a confirmação chegar — você não precisa fazer nada.' +
        '<div class="acoes" style="margin-top:8px"><button type="button" class="btn btn-secundario" id="btVerificar">Verificar agora</button><button type="button" class="btn btn-texto" id="btNaoPaguei">Não concluí o pagamento</button></div></div>' : "") +
      '<div class="cartao ass-cartao" style="margin-top:14px"><p class="olho">Sua assinatura</p><div class="ass-topo"><h2>' + esc(a.nome) + "</h2>" + selloAssinatura(a) + "</div>" +
        (a.estado === "ativa" || a.estado === "cancelamento_programado" || a.estado === "pagamento_pendente" || a.estado === "problema_pagamento"
          ? '<dl class="ass-dados">' + (a.periodicidade ? "<div><dt>Periodicidade</dt><dd>" + esc({ mensal: "Mensal", trimestral: "Trimestral", semestral: "Semestral", anual: "Anual" }[a.periodicidade] || a.periodicidade) + "</dd></div>" : "") +
            (a.valorCentavos ? "<div><dt>Valor</dt><dd>" + esc(cobrancaTexto({ precoCentavos: a.valorCentavos, periodicidade: a.periodicidade })) + "</dd></div>" : "") + "</dl>" : "") +
        '<p class="ass-texto">' + esc(textoAcesso(a)) + "</p></div>" +
      '<h2 class="secao" id="t-rec">Recursos incluídos</h2><div class="cartao" aria-labelledby="t-rec" style="margin-top:8px">' + recursosIncluidosHtml(a) + "</div>" +
      '<h2 class="secao" id="t-uso">Consumo</h2><div class="cartao" aria-labelledby="t-uso" style="margin-top:8px">' + (assin.usoPlanos && assin.usoPlanos.ativo ? usoPlanosHtml(assin.usoPlanos) : usoHtml(a)) + "</div>" +
      acoesAssinaturaHtml(a, assin) +
      '<p class="nota" style="margin-top:14px">As <a href="#/consultorias">consultorias</a> são serviços separados e não fazem parte da assinatura.</p>'
    );
    var ver = document.getElementById("btVerificar");
    if (ver) {
      ver.addEventListener("click", function () { telaAssinatura(); });
      document.getElementById("btNaoPaguei").addEventListener("click", function () { limparCheckout(); telaAssinatura(); });
      clearTimeout(estado.pollAss);
      estado.pollAss = setTimeout(function () { if (location.hash === "#/assinatura") telaAssinatura(); }, 20000);
    }
    app.querySelectorAll("[data-checkout]").forEach(function (l) { l.addEventListener("click", function () { marcarCheckout(l.getAttribute("data-checkout")); }); });
  }

  /* ── comparar assinaturas ── */
  function recursosDoProduto(p) {
    var n = NIVEL_ORDEM[p.nivel] || 0;
    return [["Criar estratégias e ver as jogadas", true], ["Programa de treino", n >= 1], ["Registro de treinos", n >= 2]];
  }
  function limitesTexto(p) {
    var l = p.limites || {}, t = [];
    if (Number.isInteger(l.estrategiasPorPeriodo)) t.push(l.estrategiasPorPeriodo + (l.estrategiasPorPeriodo === 1 ? " estratégia" : " estratégias") + " por período");
    if (Number.isInteger(l.programasPorPeriodo)) t.push(l.programasPorPeriodo + (l.programasPorPeriodo === 1 ? " programa de treino" : " programas de treino") + " por período");
    return t;
  }
  async function telaAssinaturas() {
    tela('<p class="carregando">Carregando as assinaturas…</p>', true);
    var assin;
    try { assin = await carregarAssinatura(true); }
    catch (e) {
      tela('<h1>Assinaturas</h1><div class="aviso" role="alert" style="margin-top:14px">' + esc(e.message) + '</div><div class="acoes"><button class="btn btn-primario" id="btTentarAss" type="button">Tentar de novo</button></div>');
      document.getElementById("btTentarAss").addEventListener("click", telaAssinaturas);
      return;
    }
    var a = assin.assinatura, cat = assin.catalogo || [];
    var topo = abasPlanosHtml("assinaturas") + '<h1>Comparar planos</h1>' +
      '<p class="sub">Você está com: ' + (a.nome === a.rotulo ? "" : "<strong>" + esc(a.nome) + "</strong> ") + selloAssinatura(a) + "</p>";
    var planosQL = assin.planos || [];
    function planosHtml() {
      return '<div class="comparar" style="margin-top:16px">' + planosQL.map(function (p) {
        var gratis = p.precoCentavos === 0, atual = gratis && a.estado === "gratuito";
        return '<article class="cartao produto' + (p.destaque ? " destaque-produto" : "") + (atual ? " atual" : "") + '"><div class="prod-topo"><h2>' + esc(p.nome) + "</h2>" + (atual ? '<span class="sello-assinatura">Seu plano</span>' : p.destaque ? '<span class="sello-assinatura">Recomendado</span>' : "") + "</div>" +
          '<p class="nota">' + esc(p.para) + '</p><p class="prod-preco"><strong>' + (gratis ? "R$ 0" : esc(reais(p.precoCentavos))) + "</strong> <span>" + (gratis ? "para sempre" : "por mês") + "</span></p>" +
          '<ul class="beneficios">' + p.itens.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" +
          (gratis ? '<button class="btn btn-secundario largo" type="button" disabled aria-disabled="true">' + (atual ? "Seu plano atual" : "Plano gratuito") + "</button>"
            : '<button class="btn btn-secundario largo" type="button" disabled aria-disabled="true">Assinatura em breve</button>') + "</article>";
      }).join("") + '</div><p class="nota" style="margin-top:12px">Jogadas e sessões de treino não têm limite em nenhum plano. Quando você mudar de plano, seus registros continuam com você.</p>';
    }
    if (!cat.length) {
      tela(topo + (planosQL.length ? planosHtml() : "") + '<div class="cartao" style="margin-top:16px"><h2>As assinaturas ainda não estão disponíveis aqui</h2><p class="nota" style="margin-top:6px">Ainda não há assinaturas abertas para contratação pelo app. Se quiser saber como ampliar o seu acesso, fale com a gente.</p>' +
        '<a class="btn btn-primario btn-grande" href="' + esc(suporteUrl("Olá, Richard! Quero saber como ampliar o meu acesso ao QuadraLab Player.")) + '" target="_blank" rel="noopener">Falar com a gente<span class="sr"> (abre o WhatsApp)</span></a></div>' +
        '<p class="nota" style="margin-top:14px">As <a href="#/consultorias">consultorias</a> (revisão de estratégia, análise de vídeo e consultoria ao vivo) são serviços separados.</p>');
      return;
    }
    tela(topo + '<div class="comparar">' + cat.map(function (p) {
      var atual = a.origem === "eduzz" && a.produtoId === p.id && a.estado !== "encerrada";
      var lim = limitesTexto(p);
      return '<article class="cartao produto' + (p.destaque ? " destaque-produto" : "") + (atual ? " atual" : "") + '"><div class="prod-topo"><h2>' + esc(p.nome) + "</h2>" + (atual ? '<span class="sello-ass s-ass-ativa">✓ Sua assinatura atual</span>' : "") + "</div>" +
        (p.paraQuem ? '<p class="nota">' + esc(p.paraQuem) + "</p>" : "") +
        '<p class="prod-preco"><strong>' + esc(reais(p.precoCentavos)) + '</strong> <span>' + (p.periodicidade === "mensal" ? "por mês" : "a cada " + esc(PERIODO_TXT[p.periodicidade])) + "</span></p>" +
        '<p class="nota">' + (p.periodicidade === "mensal" ? "" : esc(cobrancaTexto(p)) + " — esse é o valor total de cada cobrança. ") + (p.cobrancaAutomatica ? "Renovação automática." : "Sem renovação automática.") + "</p>" +
        '<ul class="recursos">' + recursosDoProduto(p).map(function (i) { return '<li class="' + (i[1] ? "incluido" : "nao-incluido") + '"><span class="rec-marca" aria-hidden="true">' + (i[1] ? "✓" : "–") + "</span><span>" + esc(i[0]) + '<span class="sr">' + (i[1] ? " — incluído" : " — não incluído") + "</span></span></li>"; }).join("") + "</ul>" +
        (lim.length ? '<p class="nota"><strong>Limites:</strong> ' + esc(lim.join(" · ")) + "</p>" : "") +
        (p.beneficios.length ? '<ul class="beneficios">' + p.beneficios.map(function (b) { return "<li>" + esc(b) + "</li>"; }).join("") + "</ul>" : "") +
        (atual ? '<button class="btn btn-secundario largo" type="button" disabled aria-disabled="true">Sua assinatura atual</button>'
          : '<a class="btn btn-primario largo" href="' + esc(p.checkoutUrl) + '" target="_blank" rel="noopener" data-checkout="' + esc(p.id) + '">' + (a.origem === "eduzz" && a.estado !== "encerrada" ? "Contratar esta assinatura" : "Assinar") + '<span class="sr"> ' + esc(p.nome) + " (abre o pagamento em nova aba)</span></a>") +
        "</article>";
    }).join("") + "</div>" +
      '<p class="nota" style="margin-top:14px">O pagamento é feito na Eduzz. O seu acesso só muda aqui depois que o pagamento for confirmado' + (a.origem === "eduzz" && a.estado !== "encerrada" ? "; a troca de assinatura também é confirmada pela Eduzz" : "") + '. As <a href="#/consultorias">consultorias</a> são serviços separados.</p>');
    app.querySelectorAll("[data-checkout]").forEach(function (l) { l.addEventListener("click", function () { marcarCheckout(l.getAttribute("data-checkout")); }); });
  }

  /* ── consultorias: serviços individuais do Richard, contratados à parte da assinatura ──
     Textos, preços, prazos e limites vêm do servidor (_player-assinaturas.js): cartão, detalhes, solicitação
     e mensagem usam sempre a mesma fonte. Não há checkout nem agenda integrados: a solicitação sai montada
     para o contato real e pagamento e horário são confirmados lá. Nada aqui finge pedido registrado. */
  function reaisInteiro(centavos) {
    return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: centavos % 100 ? 2 : 0, maximumFractionDigits: 2 }).replace(/\u00a0/g, " ");
  }
  function consulLista() { return (estado.assin && estado.assin.consultorias) || []; }
  function consulPorId(id) { return consulLista().filter(function (c) { return c.id === id; })[0] || null; }
  function precoConsulHtml(c) {
    return '<strong class="consul-preco">' + esc(reaisInteiro(c.precoCentavos)) + '</strong> <span class="consul-unidade">' + esc(c.unidadePreco) + " · pagamento único</span>";
  }
  function cartaoConsulHtml(c) {
    return '<article class="consul-card' + (c.selo ? " consul-destaque" : "") + '" aria-labelledby="cn-' + esc(c.id) + '">' +
      (c.selo ? '<p class="consul-selo">' + esc(c.selo) + "</p>" : "") +
      '<h2 id="cn-' + esc(c.id) + '">' + esc(c.nome) + "</h2>" +
      '<p class="consul-desc">' + esc(c.descricao) + "</p>" +
      '<p class="consul-para"><strong>Indicado para:</strong> ' + esc(c.indicadoPara) + "</p>" +
      (c.regra ? '<p class="consul-regra">' + esc(c.regra) + "</p>" : "") +
      (c.escopoPreco ? '<p class="nota">' + esc(c.escopoPreco) + "</p>" : "") +
      '<ul class="consul-entregas" aria-label="Principais entregas">' + c.principais.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" +
      '<dl class="consul-fatos"><div><dt>Valor</dt><dd>' + precoConsulHtml(c) + "</dd></div>" +
        "<div><dt>Prazo ou duração</dt><dd>" + esc(c.prazoCurto) + "</dd></div></dl>" +
      '<a class="btn btn-primario largo" href="#/consultorias/' + esc(c.id) + '/solicitar">' + esc(c.botao) + '</a>' +
      '<p style="text-align:center"><a class="btn btn-texto" href="#/consultorias/' + esc(c.id) + '">Ver detalhes<span class="sr"> de ' + esc(c.nome) + "</span></a></p></article>";
  }
  function condicoesConsulHtml() {
    var pol = (estado.assin && estado.assin.politicas) || {}, itens = [];
    if (pol.pagamento) itens.push("<li><strong>Pagamento:</strong> " + esc(pol.pagamento) + "</li>");
    if (pol.remarcacao) itens.push("<li><strong>Remarcação:</strong> " + esc(pol.remarcacao) + "</li>");
    if (pol.cancelamento) itens.push("<li><strong>Cancelamento:</strong> " + esc(pol.cancelamento) + "</li>");
    return '<section class="cartao consul-condicoes" aria-labelledby="t-cond"><h2 id="t-cond">Condições</h2><ul class="lista-simples">' +
      "<li>Todos os valores são por contratação, sem renovação automática.</li>" +
      (itens.length ? itens.join("") : "<li>Pagamento, remarcação e cancelamento: as condições são informadas no atendimento, antes de qualquer cobrança.</li>") +
      "<li>Serviços individuais, sem suporte contínuo além do que está descrito em cada um. Não prometem resultado esportivo.</li></ul></section>";
  }
  async function carregarConsultorias(voltarPara) {
    tela('<p class="carregando">Carregando…</p>', true);
    try { await carregarAssinatura(false); return true; }
    catch (e) {
      tela('<h1>Consultorias</h1><div class="aviso" role="alert" style="margin-top:14px">' + esc(e.message) + '</div><div class="acoes"><button class="btn btn-primario" id="btTentarAss" type="button">Tentar de novo</button></div>');
      document.getElementById("btTentarAss").addEventListener("click", function () { voltarPara(); });
      return false;
    }
  }

  async function telaConsultorias() {
    if (!(await carregarConsultorias(telaConsultorias))) return;
    var olhar = null; try { olhar = await carregarOlhar(false); } catch (e) { olhar = null; }
    var lista = consulLista(), tres = lista.filter(function (c) { return c.tipo !== "completa"; }), completa = lista.filter(function (c) { return c.tipo === "completa"; })[0];
    function porTipo(t) { return lista.filter(function (c) { return c.tipo === t; })[0]; }
    var escolha = [
      ["Já tenho uma estratégia e quero ajustá-la.", porTipo("revisao")],
      ["Quero entender os padrões que se repetem nas minhas partidas.", porTipo("analise")],
      ["Quero conversar sobre dúvidas e definir próximos passos.", porTipo("ao-vivo")],
      ["Quero a análise das partidas e uma conversa para aplicar as orientações.", completa],
    ];
    tela(
      abasPlanosHtml("consultorias") + '<h1 class="consul-titulo">Um olhar profissional sobre o seu jogo</h1>' +
      '<p class="sub">Escolha o atendimento com Richard Tsukada mais adequado ao seu momento no tênis</p>' +
      '<p class="consul-aviso" role="note"><strong>Serviços individuais contratados à parte.</strong> Não estão incluídos na assinatura do QuadraLab Player.</p>' +
      '<div class="consul-lista">' + (olhar ? cartaoOlharConsulHtml(olhar) : "") + tres.map(cartaoConsulHtml).join("") + "</div>" +
      (completa ? '<div class="consul-lista consul-lista-destaque">' + cartaoConsulHtml(completa) + "</div>" : "") +
      '<section class="cartao consul-escolha" aria-labelledby="t-esc"><h2 id="t-esc">Qual atendimento faz sentido para você?</h2><ul>' +
        (olhar ? '<li><a href="#/olhar"><span>Tenho uma dúvida específica sobre a minha estratégia.</span><strong>Olhar do treinador</strong></a></li>' : "") +
        escolha.filter(function (e) { return e[1]; }).map(function (e) {
          return '<li><a href="#/consultorias/' + esc(e[1].id) + '"><span>' + esc(e[0]) + '</span><strong>' + esc(e[1].nome) + ' ›</strong></a></li>';
        }).join("") + "</ul></section>" + (olhar ? diferencasServicosHtml(olhar) : "") +
      condicoesConsulHtml()
    );
  }

  /* ── detalhes de um serviço ── */
  async function telaConsultoriaDetalhe(id) {
    if (!(await carregarConsultorias(function () { telaConsultoriaDetalhe(id); }))) return;
    var c = consulPorId(id);
    if (!c) { ir("#/consultorias"); return; }
    function lista(titulo, itens, classe) {
      return itens && itens.length ? '<section class="consul-bloco ' + (classe || "") + '"><h2>' + esc(titulo) + '</h2><ul class="consul-lista-itens">' + itens.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></section>" : "";
    }
    var analise = c.tipo === "analise" || c.tipo === "completa";
    tela(
      '<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/consultorias">‹ Consultorias</a></p>' +
      (c.selo ? '<p class="consul-selo">' + esc(c.selo) + "</p>" : "") +
      '<h1 class="consul-titulo">' + esc(c.nome) + "</h1>" +
      '<p class="sub">' + esc(c.descricao) + "</p>" +
      '<p class="consul-aviso" role="note"><strong>Serviço individual contratado à parte.</strong> Não está incluído na assinatura do QuadraLab Player.</p>' +
      '<div class="cartao consul-resumo"><dl class="consul-fatos"><div><dt>Valor</dt><dd>' + precoConsulHtml(c) + "</dd></div><div><dt>Prazo ou duração</dt><dd>" + esc(c.prazo) + "</dd></div></dl>" +
        '<a class="btn btn-primario largo" href="#/consultorias/' + esc(c.id) + '/solicitar">' + esc(c.botao) + "</a></div>" +
      '<section class="consul-bloco"><h2>Indicado para</h2><p>' + esc(c.indicadoPara) + "</p></section>" +
      (c.regra ? '<p class="consul-regra">' + esc(c.regra) + "</p>" : "") +
      lista("O que está incluído", c.inclui, "inclui") +
      lista("O que não está incluído", c.naoInclui, "nao-inclui") +
      (c.aviso ? '<p class="consul-regra">' + esc(c.aviso) + "</p>" : "") +
      (analise ? lista("Material necessário", c.material || (consulPorId("analise-completa") || {}).material, "material") +
        '<section class="consul-bloco"><h2>Limite do preço publicado</h2><p>' + esc((consulPorId("analise-completa") || c).escopoPreco) + "</p><p>" + esc((consulPorId("analise-completa") || c).acimaDoLimite) + "</p></section>" : "") +
      '<section class="consul-bloco"><h2>Como funciona a contratação</h2><ol class="consul-passos">' +
        "<li>Você preenche a solicitação, com os seus dados e o que o serviço precisa.</li>" +
        "<li>A mensagem sai montada para o WhatsApp do Richard, e você a envia.</li>" +
        (analise ? "<li>Richard confirma se as gravações estão completas e utilizáveis. O prazo só começa depois dessa confirmação.</li>" : "<li>Richard confirma o escopo" + (c.tipo === "ao-vivo" ? " e o horário da videochamada" : "") + ".</li>") +
        "<li>Pagamento e condições são combinados no atendimento, antes de qualquer cobrança.</li></ol></section>" +
      condicoesConsulHtml() +
      '<a class="btn btn-primario btn-grande" href="#/consultorias/' + esc(c.id) + '/solicitar">' + esc(c.botao) + "</a>"
    );
  }

  /* ── solicitação: dados necessários, resumo e mensagem para o contato ── */
  var SUPERFICIES = [["saibro", "Saibro"], ["rapida", "Quadra rápida"], ["grama", "Grama"], ["outra", "Outra"]];
  function chavePedido(id) { return "ql-pedido:" + (auth.currentUser ? auth.currentUser.uid : "") + ":" + id; }
  function lerPedido(id) { try { return JSON.parse(localStorage.getItem(chavePedido(id)) || "null") || {}; } catch (e) { return {}; } }
  function salvarPedido(id, p) { try { localStorage.setItem(chavePedido(id), JSON.stringify(p)); } catch (e) { /* sem armazenamento: segue sem rascunho */ } }
  function minutosDe(h, m) { return Math.max(0, (parseInt(h, 10) || 0) * 60 + (parseInt(m, 10) || 0)); }
  function duracaoTxt(min) { var h = Math.floor(min / 60), m = min % 60; return h + " h" + (m ? " " + (m < 10 ? "0" : "") + m + " min" : ""); }
  function resumoPerfilTxt() {
    var f = estado.dados.ficha || {};
    if (!estado.dados.fichaCompleta) return "";
    return [rotuloOp(OP.nivel, f.nivel), rotuloOp(OP.mao, f.mao), rotuloOp(OP.backhand, f.backhand), "piso: " + rotuloOp(OP.piso, f.piso),
      "golpe mais forte: " + rotuloOp(AREAS, f.armaPrincipal), "ponto mais vulnerável: " + rotuloOp(AREAS, f.pontoFraco), rotuloOp(OP.padraoPonto, f.padraoPonto)].join(" · ");
  }
  function avaliarMaterial(c, ped) {
    var partes = (ped.partidas || []), n = c.partidas || 3, faltas = [], total = 0;
    for (var i = 0; i < n; i++) {
      var x = partes[i] || {}, min = minutosDe(x.h, x.m); total += min;
      var ok = /^https:\/\/\S+$/.test(String(x.link || "").trim()) && min > 0 && x.data && x.superficie && String(x.placar || "").trim() && String(x.jogador || "").trim() && x.completa;
      if (!ok) faltas.push("partida " + (i + 1));
    }
    var limite = (c.limiteHoras || 6) * 60;
    return { total: total, faltas: faltas, acima: total > limite, limite: limite, completo: !faltas.length };
  }
  function modoSolicitacao(c, ped) {
    if (c.tipo !== "analise" && c.tipo !== "completa") return { rotulo: c.botao, tipo: "pronto" };
    var m = avaliarMaterial(c, ped);
    if (m.acima) return { rotulo: "Solicitar avaliação e orçamento", tipo: "orcamento", m: m };
    if (!m.completo) return { rotulo: "Solicitar avaliação do material", tipo: "avaliacao", m: m };
    return { rotulo: c.botao, tipo: "pronto", m: m };
  }
  function mensagemPedido(c, ped) {
    var perfil = estado.dados.perfil, L = [];
    L.push("Olá, Richard! Quero solicitar: " + c.nome + " (valor " + reaisInteiro(c.precoCentavos) + ", " + c.unidadePreco + ", pagamento único).");
    L.push("Nome: " + perfil.nome); L.push("E-mail da conta: " + perfil.email);
    var rp = resumoPerfilTxt(); if (rp) L.push("Perfil de jogador: " + rp);
    if (c.tipo === "revisao") {
      var est = planoPorId(ped.estrategiaId);
      L.push("Estratégia para revisar: " + (est && est.plano ? est.plano.titulo + (est.adversarioNome ? " (contra " + est.adversarioNome + ")" : "") : "outra estratégia, que envio no atendimento"));
      if (String(ped.ajustes || "").trim()) L.push("O que quero ajustar: " + String(ped.ajustes).trim());
    }
    if (String(ped.objetivos || "").trim()) L.push("Objetivos e dificuldades: " + String(ped.objetivos).trim());
    if (String(ped.duvidas || "").trim()) L.push("Perguntas para a conversa: " + String(ped.duvidas).trim());
    if (c.tipo === "analise" || c.tipo === "completa") {
      var modo = modoSolicitacao(c, ped), m = modo.m;
      L.push("Partidas (" + (c.partidas || 3) + " completas):");
      for (var i = 0; i < (c.partidas || 3); i++) {
        var x = (ped.partidas || [])[i] || {};
        L.push((i + 1) + ") " + (String(x.link || "").trim() || "[link não informado]") + " | duração: " + duracaoTxt(minutosDe(x.h, x.m)) + " | data: " + (x.data ? dataExtensa(x.data) : "—") +
          " | superfície: " + (rotuloOp(SUPERFICIES, x.superficie) || "—") + " | placar: " + (String(x.placar || "").trim() || "—") + " | jogador analisado: " + (String(x.jogador || "").trim() || "—") +
          " | " + (x.completa ? "partida completa" : "não confirmada como completa"));
      }
      L.push("Soma das gravações: " + duracaoTxt(m.total) + " (o preço cobre até " + (c.limiteHoras || 6) + " h).");
      L.push(modo.tipo === "orcamento" ? "SITUAÇÃO: acima de " + (c.limiteHoras || 6) + " h — peço a avaliação do volume e o orçamento antes de qualquer pagamento. Entendo que as três partidas continuam sendo analisadas por inteiro."
        : modo.tipo === "avaliacao" ? "SITUAÇÃO: material incompleto (" + m.faltas.join(", ") + ") — peço a avaliação do material."
        : "SITUAÇÃO: material informado como completo, dentro do limite.");
      L.push("Confirmo que os vídeos são meus ou que tenho autorização para compartilhá-los. Os links permitem a visualização e não incluem senhas.");
    }
    if (c.tipo === "ao-vivo" || c.tipo === "completa") L.push("Disponibilidade para a videochamada: " + (String(ped.disponibilidade || "").trim() || "[a combinar]") + " (horário a confirmar no contato).");
    L.push("Entendi o que está incluído, os limites e o prazo, e que pagamento e confirmação serão concluídos no atendimento.");
    return L.join("\n");
  }
  function campoTexto(id, rotulo, valor, o) {
    o = o || {};
    return '<div class="campo"><label for="' + id + '">' + esc(rotulo) + (o.opcional ? ' <span class="nota">(opcional)</span>' : "") + "</label>" +
      '<textarea id="' + id + '" rows="' + (o.linhas || 3) + '" maxlength="800"' + (o.ajuda ? ' aria-describedby="' + id + 'A"' : "") + ">" + esc(valor || "") + "</textarea>" +
      (o.ajuda ? '<p class="nota" id="' + id + 'A" style="margin-top:4px">' + esc(o.ajuda) + "</p>" : "") + '<p class="erro-campo" id="' + id + 'E" hidden></p></div>';
  }
  function partidaHtml(i, x) {
    x = x || {};
    return '<fieldset class="partida" id="part' + i + '"><legend>Partida ' + (i + 1) + "</legend>" +
      '<div class="campo"><label for="pl' + i + '">Link da gravação</label><input id="pl' + i + '" type="url" inputmode="url" autocomplete="off" placeholder="https://…" value="' + esc(x.link || "") + '"></div>' +
      '<div class="duracao"><div class="campo"><label for="ph' + i + '">Duração (horas)</label><input id="ph' + i + '" type="number" inputmode="numeric" min="0" max="12" value="' + esc(x.h == null ? "" : x.h) + '"></div>' +
        '<div class="campo"><label for="pm' + i + '">e minutos</label><input id="pm' + i + '" type="number" inputmode="numeric" min="0" max="59" value="' + esc(x.m == null ? "" : x.m) + '"></div></div>' +
      '<div class="campo"><label for="pd' + i + '">Data da partida</label><input id="pd' + i + '" type="date" value="' + esc(x.data || "") + '"></div>' +
      '<div class="campo"><label for="ps' + i + '">Superfície</label><select id="ps' + i + '"><option value="">Escolha</option>' + SUPERFICIES.map(function (o) { return '<option value="' + o[0] + '"' + (x.superficie === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select></div>" +
      '<div class="campo"><label for="pp' + i + '">Placar</label><input id="pp' + i + '" maxlength="60" placeholder="Ex.: 6/4 3/6 7/5" value="' + esc(x.placar || "") + '"></div>' +
      '<div class="campo"><label for="pj' + i + '">Quem é o jogador analisado</label><input id="pj' + i + '" maxlength="80" placeholder="Ex.: camisa azul, lado mais próximo da câmera" value="' + esc(x.jogador || "") + '"></div>' +
      '<label class="alternar"><input type="checkbox" id="pc' + i + '"' + (x.completa ? " checked" : "") + "><span>Esta é a partida completa, do primeiro ao último ponto.</span></label></fieldset>";
  }

  async function telaSolicitacao(id) {
    if (!(await carregarConsultorias(function () { telaSolicitacao(id); }))) return;
    var c = consulPorId(id);
    if (!c) { ir("#/consultorias"); return; }
    var d = estado.dados, perfil = d.perfil, ped = lerPedido(id), analise = c.tipo === "analise" || c.tipo === "completa";
    ped.partidas = ped.partidas || [];
    var estrategias = planosProntos();
    var html =
      '<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/consultorias/' + esc(id) + '">‹ ' + esc(c.nome) + "</a></p>" +
      '<h1 class="consul-titulo">Solicitar: ' + esc(c.nome) + "</h1>" +
      '<p class="consul-aviso" role="note"><strong>Serviço individual contratado à parte.</strong> Não está incluído na assinatura do QuadraLab Player.</p>' +
      '<section class="cartao consul-resumo" aria-labelledby="t-res"><h2 id="t-res">Resumo da oferta</h2><dl class="consul-fatos"><div><dt>Valor</dt><dd>' + precoConsulHtml(c) + "</dd></div><div><dt>Prazo ou duração</dt><dd>" + esc(c.prazo) + "</dd></div></dl>" +
        '<details class="det"><summary>Entregas e limites</summary><ul class="consul-lista-itens">' + c.inclui.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" +
        '<p class="nota" style="margin-top:8px"><strong>Não inclui:</strong> ' + esc(c.naoInclui.join(" ")) + "</p>" + (c.aviso ? '<p class="nota" style="margin-top:6px">' + esc(c.aviso) + "</p>" : "") +
        (analise ? '<p class="nota" style="margin-top:6px">' + esc(c.regra || (consulPorId("analise-completa") || {}).regra) + " " + esc((consulPorId("analise-completa") || c).escopoPreco) + "</p>" : "") + "</details></section>" +
      '<section class="cartao consul-proximo" aria-labelledby="t-prox"><h2 id="t-prox">Próxima etapa</h2><p>Você revisa os dados abaixo e a mensagem sai montada para o WhatsApp do Richard. ' +
        (analise ? "Ele confirma se as gravações estão completas e utilizáveis; o prazo só começa depois dessa confirmação. " : "") +
        (c.tipo === "ao-vivo" || c.tipo === "completa" ? "O horário da videochamada é confirmado no contato. " : "") +
        '<strong>O pagamento e a confirmação são concluídos no atendimento, antes de qualquer cobrança.</strong> A solicitação só é considerada recebida quando você enviar a mensagem.</p></section>' +
      '<section class="cartao" aria-labelledby="t-meus"><h2 id="t-meus">Seus dados</h2><dl class="rp-lista"><div class="rp-linha"><dt>Nome</dt><dd>' + esc(perfil.nome) + '</dd></div><div class="rp-linha"><dt>E-mail da conta</dt><dd>' + esc(perfil.email) + "</dd></div>" +
        '<div class="rp-linha"><dt>Perfil de jogador</dt><dd>' + (resumoPerfilTxt() ? esc(resumoPerfilTxt()) : '<span class="nota">Perfil ainda incompleto</span>') + "</dd></div></dl>" +
        '<p class="nota" style="margin-top:8px">Revise antes de enviar: <a href="#/conta">Meu perfil</a> · <a href="#/jogador">Meu perfil de jogador</a>. O que você preencheu aqui fica salvo neste aparelho.</p></section>' +
      '<form id="fPedido" class="consul-form" novalidate><div id="blocoRevisao"></div><div id="blocoForm">';
    if (c.tipo === "revisao") {
      html += '<fieldset id="g-tem"><legend>Você já possui uma estratégia para revisar?</legend><div class="opcoes duas"><label class="opcao"><input type="radio" name="tem" value="sim"' + (ped.tem === "sim" ? " checked" : "") + "><span>Sim</span></label>" +
        '<label class="opcao"><input type="radio" name="tem" value="nao"' + (ped.tem === "nao" ? " checked" : "") + "><span>Não</span></label></div></fieldset>";
    }
    html += '<div id="blocoCampos">';
    if (c.tipo === "revisao") {
      html += '<div class="campo"><label for="estrat">Qual estratégia será revisada?</label><select id="estrat">' +
        estrategias.map(function (e) { return '<option value="' + esc(e.id) + '"' + (ped.estrategiaId === e.id ? " selected" : "") + ">" + esc(tituloCurto(e.plano.titulo, 50)) + " · " + esc(dataBR(e.criadoEm)) + "</option>"; }).join("") +
        '<option value="fora"' + (ped.estrategiaId === "fora" ? " selected" : "") + ">Outra estratégia (envio no atendimento)</option></select></div>" +
        campoTexto("ajustes", "O que você gostaria de ajustar?", ped.ajustes, { opcional: true });
    }
    if (c.tipo !== "ao-vivo") html += campoTexto("objetivos", "Seus objetivos e dificuldades percebidas", ped.objetivos, { ajuda: "O que você quer melhorar no seu jogo e o que mais atrapalha hoje." });
    if (c.tipo === "ao-vivo") html += campoTexto("duvidas", "Perguntas e dúvidas para a conversa", ped.duvidas, { ajuda: "Richard lê antes da videochamada." }) + campoTexto("objetivos", "Seus objetivos e dificuldades", ped.objetivos, { opcional: true });
    if (c.tipo === "completa") html += campoTexto("duvidas", "Perguntas para a conversa", ped.duvidas, { opcional: true });
    if (analise) {
      html += '<section class="consul-material" aria-labelledby="t-mat"><h2 id="t-mat">As três partidas completas</h2>' +
        '<p class="consul-regra">A análise exige três partidas completas. Não aceitamos melhores momentos nem pequenos recortes. Preferencialmente contra adversários diferentes.</p>' +
        '<ul class="lista-simples nota"><li>Envie vídeos seus ou que você tenha autorização para compartilhar.</li><li>Deixe o link com acesso de visualização para quem tem o link. <strong>Nunca envie senhas</strong> de contas de armazenamento.</li><li>A gravação precisa permitir acompanhar o jogador e a dinâmica dos pontos.</li></ul>' +
        [0, 1, 2].map(function (i) { return partidaHtml(i, ped.partidas[i]); }).join("") +
        '<div class="consul-total" id="totalMaterial" role="status" aria-live="polite"></div>' +
        '<label class="alternar"><input type="checkbox" id="autoriza"' + (ped.autoriza ? " checked" : "") + "><span>Confirmo que os vídeos são meus ou que tenho autorização para compartilhá-los.</span></label><p class=\"erro-campo\" id=\"autorizaE\" hidden></p></section>";
    }
    if (c.tipo === "ao-vivo" || c.tipo === "completa") html += campoTexto("disponibilidade", "Dias e horários que costumam funcionar para você", ped.disponibilidade, { opcional: true, ajuda: "Não há agenda online: o horário é confirmado no contato." });
    html += '<label class="alternar" style="margin-top:12px"><input type="checkbox" id="aceite"' + (ped.aceite ? " checked" : "") + "><span>Entendi o que está incluído, os limites e o prazo, e que pagamento e confirmação serão concluídos no atendimento.</span></label><p class=\"erro-campo\" id=\"aceiteE\" hidden></p>" +
      '<div class="aviso" id="avisoPedido" role="alert" hidden></div>' +
      '<div class="acoes"><button class="btn btn-primario btn-grande" id="btPedido" type="submit">' + esc(c.botao) + "</button></div>" +
      '<p class="nota" style="margin-top:8px">Ao tocar, o WhatsApp abre com a mensagem pronta. Nada é enviado ou cobrado até você enviar a mensagem.</p></div></div></form>' +
      '<div id="aposPedido"></div>';
    tela(html);

    var form = document.getElementById("fPedido"), alvoRev = document.getElementById("blocoRevisao");
    function ler() {
      var q = function (i) { var e = document.getElementById(i); return e ? e.value : ""; };
      var n = function (i) { var e = document.getElementById(i); return e ? !!e.checked : false; };
      ped.objetivos = q("objetivos"); ped.duvidas = q("duvidas"); ped.disponibilidade = q("disponibilidade"); ped.ajustes = q("ajustes"); ped.aceite = n("aceite");
      if (c.tipo === "revisao") { var m = form.querySelector('input[name="tem"]:checked'); ped.tem = m ? m.value : ""; ped.estrategiaId = q("estrat"); }
      if (analise) {
        ped.autoriza = n("autoriza"); ped.partidas = [0, 1, 2].map(function (i) { return { link: q("pl" + i), h: q("ph" + i), m: q("pm" + i), data: q("pd" + i), superficie: q("ps" + i), placar: q("pp" + i), jogador: q("pj" + i), completa: n("pc" + i) }; });
      }
    }
    function atualizar() {
      ler(); salvarPedido(id, ped);
      var bt = document.getElementById("btPedido");
      if (c.tipo === "revisao") {
        var sem = ped.tem === "nao";
        document.getElementById("blocoCampos").hidden = ped.tem !== "sim";
        alvoRev.innerHTML = sem ? '<div class="cartao consul-alternativas" role="status"><h2>Esta revisão parte de uma estratégia que você já tem</h2><p>A revisão ajusta uma estratégia existente: lê a sua ficha e os seus objetivos, revisa essa estratégia, define três prioridades e explica em áudio. Ela não faz diagnóstico completo, avaliação de partidas em vídeo nem videochamada. Sem uma estratégia para revisar, estes atendimentos fazem mais sentido:</p>' +
          '<ul><li><a href="#/consultorias/consultoria-ao-vivo">Consultoria ao vivo</a> — conversar sobre dúvidas e definir próximos passos.</li><li><a href="#/consultorias/analise-completa">Análise completa do jogador</a> — entender os padrões a partir de três partidas completas.</li>' +
          (estrategias.length ? "" : '<li><a href="#/estrategia">Criar a minha estratégia</a> no app e depois voltar para a revisão.</li>') + "</ul></div>" : "";
        if (ped.tem === "sim" && !estrategias.length && ped.estrategiaId !== "fora") { var sel = document.getElementById("estrat"); sel.value = "fora"; ped.estrategiaId = "fora"; }
        bt.disabled = ped.tem !== "sim";
      }
      if (analise) {
        var modo = modoSolicitacao(c, ped), m = modo.m, alvo = document.getElementById("totalMaterial");
        alvo.className = "consul-total t-" + modo.tipo;
        alvo.innerHTML = "<strong>Soma das gravações: " + esc(duracaoTxt(m.total)) + "</strong> · o preço cobre até " + (c.limiteHoras || 6) + " h." +
          (modo.tipo === "orcamento" ? " <span>Acima do limite: o pedido vai para avaliação do volume e orçamento <b>antes do pagamento</b>. As três partidas continuam sendo analisadas por inteiro, sem corte automático, e nada é cobrado a mais sem que você veja o valor e aceite.</span>"
            : modo.tipo === "avaliacao" ? " <span>Faltam informações em: " + esc(m.faltas.join(", ")) + ". Você pode enviar assim: o material será encaminhado para avaliação e o prazo só começa depois que Richard confirmar que está completo e utilizável.</span>"
            : " <span>Material informado como completo. Richard ainda confirma a qualidade das gravações antes de o prazo começar.</span>");
        bt.textContent = modo.rotulo;
      }
    }
    function erro(idCampo, msg) { var e = document.getElementById(idCampo + "E"); if (e) { e.textContent = msg; e.hidden = false; } }
    function limparErros() { form.querySelectorAll(".erro-campo").forEach(function (e) { if (e.id.slice(-1) === "E") e.hidden = true; }); document.getElementById("avisoPedido").hidden = true; }
    form.addEventListener("input", atualizar); form.addEventListener("change", atualizar);
    atualizar();
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      ler(); limparErros();
      var primeiro = null;
      function exigir(cond, idc, msg) { if (!cond) { erro(idc, msg); if (!primeiro) primeiro = idc; } }
      if (c.tipo === "revisao" && ped.tem !== "sim") { var av = document.getElementById("avisoPedido"); av.textContent = "Responda se você já possui uma estratégia para revisar."; av.hidden = false; return; }
      if (c.tipo !== "ao-vivo") exigir(String(ped.objetivos || "").trim().length >= 10, "objetivos", "Conte em poucas palavras os seus objetivos e dificuldades.");
      if (c.tipo === "ao-vivo") exigir(String(ped.duvidas || "").trim().length >= 10, "duvidas", "Escreva ao menos uma pergunta ou dúvida para a conversa.");
      if (analise) exigir(ped.autoriza, "autoriza", "Confirme que os vídeos são seus ou que você tem autorização para compartilhá-los.");
      exigir(ped.aceite, "aceite", "Confirme que entendeu o que está incluído e como a contratação é concluída.");
      if (primeiro) { var el = document.getElementById(primeiro + "E"); if (el) el.scrollIntoView({ block: "center" }); var campo = document.getElementById(primeiro); if (campo) campo.focus({ preventScroll: true }); return; }
      var msg = mensagemPedido(c, ped), url = "https://wa.me/" + (estado.assin.contatoWhatsapp || WHATSAPP_CONSULTORIA) + "?text=" + encodeURIComponent(msg);
      window.open(url, "_blank", "noopener");
      document.getElementById("aposPedido").innerHTML = '<section class="cartao consul-enviada" role="status" aria-live="polite"><h2>Mensagem pronta para enviar</h2><p>Abrimos o WhatsApp com a sua solicitação. <strong>Ela só é considerada recebida quando você enviar a mensagem.</strong> Depois, Richard responde' +
        (analise ? ", confirma se o material está completo e utilizável" : "") + " e combina pagamento e condições" + (c.tipo === "ao-vivo" || c.tipo === "completa" ? " e o horário" : "") + '.</p>' +
        '<div class="acoes"><a class="btn btn-primario" href="' + esc(url) + '" target="_blank" rel="noopener" id="lnkWpp">Abrir o WhatsApp de novo<span class="sr"> (abre em nova aba)</span></a><button type="button" class="btn btn-secundario" id="btCopiar">Copiar a mensagem</button></div><p class="nota" id="msgCopia" role="status" style="margin-top:6px"></p></section>';
      document.getElementById("btCopiar").addEventListener("click", async function () {
        var m = document.getElementById("msgCopia");
        try { await navigator.clipboard.writeText(msg); m.textContent = "Mensagem copiada."; }
        catch (e) { var t = document.createElement("textarea"); t.value = msg; t.className = "sr"; document.body.appendChild(t); t.select(); try { document.execCommand("copy"); m.textContent = "Mensagem copiada."; } catch (e2) { m.textContent = "Não foi possível copiar. Use o botão do WhatsApp."; } t.remove(); }
      });
      document.getElementById("aposPedido").scrollIntoView({ block: "center" });
    });
  }

  /* ── ajuda e suporte ── */
  /* ══ Atalho na tela de início (celular) ou na área de trabalho (computador) ══
     O app é instalável (manifest). Aqui só se ensina o caminho de cada aparelho; no Chrome do Android e no computador, quando o navegador
     oferece a instalação, o botão "Instalar agora" faz isso direto. Nada aparece para quem já abriu o app pelo atalho. */
  var eventoInstalar = null;
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); eventoInstalar = e; Array.prototype.forEach.call(document.querySelectorAll("[data-instalar-agora]"), function (b) { b.hidden = false; }); });
  window.addEventListener("appinstalled", function () { eventoInstalar = null; try { localStorage.setItem("ql-instalar-dispensado", "1"); } catch (e) { /* sem armazenamento */ } });
  function jaInstalado() { return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true; }
  function plataformaDoAparelho() {
    var ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
    return /Android/.test(ua) ? "android" : "computador";
  }
  function instalarAppHtml() {
    var p = plataformaDoAparelho();
    function passos(l) { return '<ol class="consul-passos" style="margin-top:8px">' + l.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ol>"; }
    function bloco(id, titulo, l) { return '<details class="det"' + (p === id ? " open" : "") + "><summary>" + titulo + "</summary>" + passos(l) + "</details>"; }
    return '<div class="cartao" id="instalarApp" style="margin-top:16px"><h2>Atalho na tela de início</h2><p class="nota" style="margin-top:6px">Instale o ' + esc(MARCA_APP) + ' como um app: ele ganha um ícone, abre em tela cheia e fica a um toque, sem digitar o endereço.</p>' +
      '<div class="acoes"><button type="button" class="btn btn-primario" data-instalar-agora hidden>Instalar agora</button></div>' +
      '<div class="detalhes-grupo">' +
        bloco("ios", "iPhone e iPad (Safari)", ["Abra esta página no <strong>Safari</strong>. Dentro do Instagram, do WhatsApp ou de outro navegador interno não aparece a opção: use “Abrir no Safari”.", "Toque no botão <strong>Compartilhar</strong> (um quadrado com uma seta para cima), na barra de baixo. No iPad, ele fica no alto.", "Role as opções e toque em <strong>Adicionar à Tela de Início</strong>.", "Confira o nome e toque em <strong>Adicionar</strong>. O ícone aparece na tela de início: abra o app por ele."]) +
        bloco("android", "Android (Chrome)", ["Abra esta página no <strong>Chrome</strong>.", "Toque no menu com <strong>três pontinhos</strong>, no canto de cima.", "Toque em <strong>Instalar app</strong> (em alguns aparelhos, <strong>Adicionar à tela inicial</strong>).", "Confirme em <strong>Instalar</strong>. O ícone aparece na tela inicial e na lista de apps."]) +
        bloco("computador", "Computador (Chrome ou Edge)", ["Abra esta página no <strong>Chrome</strong> ou no <strong>Edge</strong>.", "Na barra de endereços, à direita, clique no ícone de <strong>instalar</strong> (um monitor com uma seta). Se ele não aparecer, abra o menu dos três pontinhos e procure <strong>Instalar</strong> ou <strong>Salvar e compartilhar</strong>, depois <strong>Instalar página como app</strong> (no Edge: <strong>Aplicativos</strong>, depois <strong>Instalar este site como um aplicativo</strong>).", "Confirme em <strong>Instalar</strong>. O atalho aparece na área de trabalho ou no menu de aplicativos. No Mac com Safari: menu <strong>Arquivo</strong>, <strong>Adicionar ao Dock</strong>."]) +
      '</div><p class="nota" style="margin-top:10px">Os nomes dos menus mudam um pouco conforme a versão do navegador. Se não achar, <a href="' + esc(suporteUrl("Olá! Preciso de ajuda para colocar o " + MARCA_APP + " na tela de início.")) + '" target="_blank" rel="noopener">fale com o suporte<span class="sr"> (abre em nova aba)</span></a>.</p></div>';
  }
  function ligarInstalar() {
    Array.prototype.forEach.call(app.querySelectorAll("[data-instalar-agora]"), function (b) {
      b.hidden = !eventoInstalar;
      b.addEventListener("click", async function () { if (!eventoInstalar) return; try { eventoInstalar.prompt(); await eventoInstalar.userChoice; } catch (e) { /* o navegador recusou: as instruções continuam valendo */ } eventoInstalar = null; b.hidden = true; });
    });
  }
  /* aviso discreto no fim do Início, uma vez: some com "Agora não" e nunca aparece dentro do app já instalado */
  function anexarCartaoInstalar() {
    var dispensado = false; try { dispensado = localStorage.getItem("ql-instalar-dispensado") === "1"; } catch (e) { dispensado = false; }
    if (jaInstalado() || dispensado || document.getElementById("cartaoInstalar")) return;
    var d = document.createElement("section"); d.id = "cartaoInstalar"; d.className = "cartao"; d.style.marginTop = "14px";
    d.innerHTML = '<h2>Deixe o app na sua tela de início</h2><p class="nota" style="margin-top:6px">Um ícone para abrir o ' + esc(MARCA_APP) + ' com um toque, em tela cheia.</p><div class="acoes"><a class="btn btn-secundario" href="#/ajuda">Ver como fazer</a><button type="button" class="btn btn-texto" id="btInstalarDepois">Agora não</button></div>';
    app.appendChild(d);
    document.getElementById("btInstalarDepois").addEventListener("click", function () { try { localStorage.setItem("ql-instalar-dispensado", "1"); } catch (e) { /* sem armazenamento */ } d.remove(); });
  }

  function telaAjuda() {
    var links = (estado.assin && estado.assin.links) || {};
    tela(
      '<h1>Ajuda e suporte</h1><p class="sub">Fale com a gente por aqui.</p>' + instalarAppHtml() +
      '<div class="cartao" style="margin-top:16px"><h2>Falar com o suporte</h2><p class="nota" style="margin-top:6px">Dúvidas sobre o app, a sua conta, pagamentos ou a sua assinatura. Respondemos pelo WhatsApp.</p>' +
        '<a class="btn btn-primario btn-grande" href="' + esc(suporteUrl()) + '" target="_blank" rel="noopener">Abrir o WhatsApp<span class="sr"> (abre em nova aba)</span></a></div>' +
      '<div class="cartao" style="margin-top:14px"><h2>Pagamentos e assinatura</h2><ul class="lista-links"><li><a href="#/assinatura">Plano e assinatura</a></li><li><a href="#/assinaturas">Comparar assinaturas</a></li><li><a href="' + esc(links.gerenciarPagamento || suporteUrl("Olá, Richard! Preciso gerenciar o pagamento da minha assinatura do QuadraLab Player.")) + '" target="_blank" rel="noopener">Gerenciar pagamento<span class="sr"> (abre em nova aba)</span></a></li></ul></div>' +
      (links.termos || links.privacidade ? '<div class="cartao" style="margin-top:14px"><h2>Documentos</h2><ul class="lista-links">' +
        (links.termos ? '<li><a href="' + esc(links.termos) + '" target="_blank" rel="noopener">Termos de uso<span class="sr"> (abre em nova aba)</span></a></li>' : "") +
        (links.privacidade ? '<li><a href="' + esc(links.privacidade) + '" target="_blank" rel="noopener">Política de privacidade<span class="sr"> (abre em nova aba)</span></a></li>' : "") + "</ul></div>" : "")
    );
    ligarInstalar();
    if (!estado.assin) carregarAssinatura(false).then(function () { if (location.hash === "#/ajuda") telaAjuda(); }).catch(function () { /* sem os links opcionais */ });
  }

  /* ── teclado aberto (celular): o menu inferior sai da frente do campo ──
     Só vale se há campo de TEXTO em foco E a área visível encolheu de verdade (visualViewport): foco preso em campo de arquivo,
     data ou seleção — ou um campo que sumiu da tela ao redesenhar — nunca deixa o menu escondido. */
  function campoDeTexto(el) {
    return !!el && /^(INPUT|TEXTAREA)$/.test(el.tagName) && !/^(radio|checkbox|file|button|submit|reset|range|color|date|time|datetime-local|month|week)$/.test(el.type || "");
  }
  function recalcularTeclado() {
    var vv = window.visualViewport, aberto = campoDeTexto(document.activeElement) && document.body.contains(document.activeElement) &&
      !!vv && vv.height < window.screen.height * 0.75;
    document.body.classList.toggle("teclado", aberto);
  }
  document.addEventListener("focusin", function (ev) {
    recalcularTeclado();
    if (!campoDeTexto(ev.target) && ev.target.tagName !== "SELECT") return;
    setTimeout(function () { recalcularTeclado(); try { ev.target.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) { /* navegador antigo */ } }, 300);
  });
  document.addEventListener("focusout", function () { setTimeout(recalcularTeclado, 80); });
  ["touchstart", "click", "pageshow", "visibilitychange", "orientationchange"].forEach(function (nome) { window.addEventListener(nome, function () { setTimeout(recalcularTeclado, 120); }, { passive: true }); });
  if (window.visualViewport) window.visualViewport.addEventListener("resize", recalcularTeclado);

  /* ── navegação: início da seção ao trocar pelo menu; posição restaurada ao voltar ── */
  var posAtual = 0;
  window.addEventListener("scroll", function () { posAtual = window.scrollY; }, { passive: true });
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest("a[data-nav]");
    if (!a) return;
    menuTocado = true;
    if (a.getAttribute("href") === location.hash) { menuTocado = false; window.scrollTo(0, 0); }
  });

  /* ══ rotas ═════════════════════════════════════════════════════════ */

  /* ══ Partidas ══════════════════════════════════════════════════════
     Avaliação pós-jogo, preenchida pelo jogador no celular: o essencial vem primeiro (data, resultado, placar,
     estratégia, execução) e o detalhe é opcional. O app nunca diz que "viu" a partida: são as informações que
     o jogador registrou. Corrigir e excluir sempre disponíveis. */
  function dataCurta(iso) { var p = String(iso || "").split("-"); return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : ""; }
  function hojeISOLocal() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function partidasLista() { return estado.dados.partidas || []; }
  function opPartida() { return estado.dados.opcoesPartida || { tipos: {}, superficies: {}, resultados: {}, execucao: {}, aspectos: {} }; }
  function cartaoPartidasInicio() {
    var n = partidasLista().length, r = estado.dados.resumoPartidas || {};
    return '<div class="cartao" style="margin-top:14px"><p class="olho">Partidas</p><h2>' + (n ? "Suas partidas" : "Como foi o seu último jogo?") + "</h2>" +
      '<p class="nota" style="margin-top:6px">' + (n ? n + (n === 1 ? " partida registrada" : " partidas registradas") + " · " + r.vitorias + (r.vitorias === 1 ? " vitória" : " vitórias") + "." : "Registre o resultado e como a estratégia funcionou. Leva um minuto e ajuda nos próximos planos.") + "</p>" +
      '<div class="acoes"><a class="btn btn-secundario" href="#/partidas/nova">Registrar partida</a>' + (n ? '<a class="btn btn-texto" href="#/partidas">Ver partidas</a>' : "") + "</div></div>";
  }

  /* ── relatórios de evolução (calculados no aparelho só com o que o jogador registrou) ──
     Nível por plano (servidor): basico = resumo; mensal = por mês; periodo = escolha do período e comparação com o
     período anterior; avancado = + por estratégia, superfície, tipo e dificuldades recorrentes. São contagens dos
     registros, sem conclusão sobre causa. */
  function estatPartidas(lista) {
    var n = lista.length, v = lista.filter(function (p) { return p.resultado === "vitoria"; }).length;
    var ex = lista.filter(function (p) { return p.execucao; });
    return { n: n, v: v, d: n - v, exec: ex.length ? ex.reduce(function (s, p) { return s + p.execucao; }, 0) / ex.length : null };
  }
  function topAspectos(lista, campo, max) {
    var m = {}, asp = opPartida().aspectos;
    lista.forEach(function (p) { (p[campo] || []).forEach(function (k) { m[k] = (m[k] || 0) + 1; }); });
    return Object.keys(m).sort(function (a, b) { return m[b] - m[a]; }).slice(0, max).map(function (k) { return (asp[k] || k) + " (" + m[k] + "x)"; });
  }
  function fmtExec(x) { return x == null ? "—" : String(Math.round(x * 10) / 10).replace(".", ",") + "/5"; }
  function linhaEstat(e) { return e.n + (e.n === 1 ? " partida" : " partidas") + " · " + e.v + "V " + e.d + "D" + (e.exec == null ? "" : " · sua avaliação da execução " + fmtExec(e.exec)); }
  function relatoriosHtml(lista, nivel, dias) {
    if (!lista.length || nivel === "basico") return "";
    var html = '<h2 class="secao" id="t-rel">Evolução</h2><div class="cartao" aria-labelledby="t-rel" style="margin-top:8px"><p class="nota">Contagens do que você registrou; não indicam, sozinhas, a causa de uma melhora ou piora.</p>';
    if (nivel === "mensal") {
      var meses = {};
      lista.forEach(function (p) { var m = String(p.data).slice(0, 7); (meses[m] = meses[m] || []).push(p); });
      html += Object.keys(meses).sort().reverse().slice(0, 6).map(function (m) {
        var e = estatPartidas(meses[m]), dif = topAspectos(meses[m], "dificuldades", 2);
        return '<div class="rel-linha"><strong>' + esc(m.slice(5) + "/" + m.slice(0, 4)) + "</strong><span>" + esc(linhaEstat(e)) + (dif.length ? "<br>" + (meses[m].length === 1 ? "Dificuldades relatadas nesta partida: " : "Dificuldades mais citadas: ") + esc(dif.join(", ").toLowerCase()) : "") + "</span></div>";
      }).join("");
    } else {
      var hoje = hojeISOLocal(), corte = function (n) { var d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); };
      var atual = dias ? lista.filter(function (p) { return p.data > corte(dias); }) : lista;
      var ant = dias ? lista.filter(function (p) { return p.data <= corte(dias) && p.data > corte(dias * 2); }) : [];
      var ea = estatPartidas(atual), eb = estatPartidas(ant);
      html += '<div class="rel-periodos" role="group" aria-label="Período">' + [[30, "30 dias"], [90, "90 dias"], [180, "6 meses"], [0, "Tudo"]].map(function (x) {
        return '<button type="button" class="btn ' + ((dias || 0) === x[0] ? "btn-primario" : "btn-secundario") + '" data-rel="' + x[0] + '">' + x[1] + "</button>";
      }).join("") + "</div>" +
        '<div class="rel-linha"><strong>Período</strong><span>' + esc(linhaEstat(ea)) + "</span></div>" +
        (dias ? '<div class="rel-linha"><strong>Anterior</strong><span>' + esc(eb.n ? linhaEstat(eb) : "Sem partidas registradas no período anterior.") + "</span></div>" : "");
      if (nivel === "avancado") {
        var porPlano = {}; atual.forEach(function (p) { if (p.planoId) (porPlano[p.planoId] = porPlano[p.planoId] || { t: p.planoTitulo || "Estratégia", l: [] }).l.push(p); });
        var ks = Object.keys(porPlano);
        if (ks.length) html += '<h3 style="margin-top:14px">Por estratégia utilizada</h3>' + ks.map(function (k) { return '<div class="rel-linha"><strong>' + esc(tituloCurto(porPlano[k].t)) + "</strong><span>" + esc(linhaEstat(estatPartidas(porPlano[k].l))) + "</span></div>"; }).join("");
        var op = opPartida();
        [["superficie", "Por superfície", op.superficies], ["tipo", "Por tipo de partida", op.tipos]].forEach(function (g) {
          var m = {}; atual.forEach(function (p) { if (p[g[0]]) (m[p[g[0]]] = m[p[g[0]]] || []).push(p); });
          var kk = Object.keys(m); if (kk.length > 1 || (kk.length === 1 && g[0] === "superficie")) html += '<h3 style="margin-top:14px">' + g[1] + "</h3>" + kk.map(function (k) { return '<div class="rel-linha"><strong>' + esc(g[2][k] || k) + "</strong><span>" + esc(linhaEstat(estatPartidas(m[k]))) + "</span></div>"; }).join("");
        });
        var dif = topAspectos(atual, "dificuldades", 5);
        if (dif.length) html += '<h3 style="margin-top:14px">' + (atual.length === 1 ? "Dificuldades relatadas nesta partida" : "Dificuldades recorrentes") + '</h3><p class="nota">' + esc(dif.join(", ")) + ".</p>";
      }
    }
    return html + "</div>";
  }
  function telaPartidas() {
    var lista = partidasLista(), r = estado.dados.resumoPartidas || {}, op = opPartida();
    var html = "<h1>Partidas</h1><p class=\"sub\">Registre como foram os seus jogos. São informações preenchidas por você.</p>" +
      '<a class="btn btn-primario btn-grande" href="#/partidas/nova">Registrar partida</a>' +
      '<p class="nota" style="margin-top:10px">Ao criar um novo plano, o QuadraLab considera ' + (estado.dados.janelaIA == null || estado.dados.janelaIA >= 100 ? "o seu histórico completo disponível" : "as " + estado.dados.janelaIA + " partidas mais recentes do seu plano") + ". Você decide o que aceitar.</p>";
    if (!lista.length) {
      html += '<div class="cartao" style="margin-top:18px"><h2>Nenhuma partida registrada ainda</h2><p class="nota" style="margin-top:6px">Depois de jogar, registre o resultado, se a estratégia funcionou e o que foi mais difícil. Com o tempo, isso mostra a sua evolução.</p></div>';
    } else {
      html += '<div class="cartao" style="margin-top:18px"><p class="olho">Resumo do que você registrou</p><p><strong>' + r.total + (r.total === 1 ? " partida" : " partidas") + "</strong> · " + r.vitorias + (r.vitorias === 1 ? " vitória" : " vitórias") + " · " + r.derrotas + (r.derrotas === 1 ? " derrota" : " derrotas") + "</p>" +
        (r.execucaoMedia != null ? '<p class="nota" style="margin-top:6px">Sua avaliação da execução da estratégia' + (r.total === 1 ? "" : " (média)") + ": " + String(r.execucaoMedia).replace(".", ",") + " de 5.</p>" : "") +
        ((r.dificuldadesFrequentes || []).length ? '<p class="nota" style="margin-top:6px">' + (r.total === 1 ? "Dificuldades relatadas nesta partida: " : "Dificuldades que mais aparecem: ") + esc(r.dificuldadesFrequentes.map(function (x) { return x.nome.toLowerCase(); }).join(", ")) + ".</p>" : "") + "</div>" +
        '<div id="relatorios">' + relatoriosHtml(lista, estado.dados.relatorios, relDias) + "</div>" +
        '<div class="cartao lista-estrategias" style="margin-top:14px">' + lista.map(function (p) {
          return '<a class="item-estrategia" href="#/partidas/' + esc(p.id) + '"><span class="tag' + (p.resultado === "vitoria" ? "" : " tag-adv") + '">' + esc(op.resultados[p.resultado] || "") + "</span> <strong>" + esc(p.adversario || "Sem adversário informado") + "</strong>" +
            '<span class="nota" style="display:block">' + esc(dataCurta(p.data)) + " · " + esc(op.tipos[p.tipo] || "") + (p.placar ? " · " + esc(p.placar) : "") + (MODO_COMP && p.videoLink ? " · com vídeo" : "") + (p.planoTitulo ? " · " + esc(tituloCurto(p.planoTitulo)) : "") + "</span></a>";
        }).join("") + "</div>";
    }
    tela(html);
    app.addEventListener("click", ligarRel);
  }
  var relDias = 90;
  function ligarRel(ev) {
    var b = ev.target.closest("[data-rel]"); if (!b) return;
    relDias = parseInt(b.getAttribute("data-rel"), 10) || 0;
    var alvo = document.getElementById("relatorios"); if (alvo) alvo.innerHTML = relatoriosHtml(partidasLista(), estado.dados.relatorios, relDias);
  }
  function opcoesChips(nome, tipo, mapa, marcados, duas) {
    return '<div class="opcoes' + (duas === false ? "" : " duas") + '">' + Object.keys(mapa).map(function (k) {
      return '<label class="opcao"><input type="' + tipo + '" name="' + nome + '" value="' + esc(k) + '"' + (marcados.indexOf(k) >= 0 ? " checked" : "") + "><span>" + esc(mapa[k]) + "</span></label>";
    }).join("") + "</div>";
  }
  function telaPartidaForm(id) {
    var op = opPartida(), ed = id ? partidasLista().filter(function (x) { return x.id === id; })[0] : null;
    if (id && !ed) { ir("#/partidas"); return; }
    var q = (location.hash.split("?")[1] || "").match(/(?:^|&)plano=([^&]+)/);
    var planoSel = ed ? ed.planoId : q ? decodeURIComponent(q[1]) : "";
    var p = ed || { data: hojeISOLocal(), tipo: "treino", funcionou: [], naoFuncionou: [], dificuldades: [], positivos: [] };
    var planos = MODO_COMP ? [] : planosProntos();
    var conhecidos = (estado.dados.adversariosCadastrados || []).concat((estado.ficha && estado.ficha.adversario && estado.ficha.adversario.nome) ? [estado.ficha.adversario.nome] : []);
    var vistos = {}; conhecidos = conhecidos.filter(function (n) { var k = String(n).toLowerCase(); if (!n || vistos[k]) return false; vistos[k] = 1; return true; });
    var escala = '<div class="escala">' + [1, 2, 3, 4, 5].map(function (n) {
      return '<label class="opcao"><input type="radio" name="execucao" value="' + n + '"' + (p.execucao === n ? " checked" : "") + "><span>" + n + "<small>" + esc(op.execucao[n] || "") + "</small></span></label>";
    }).join("") + "</div>";
    function grupo(campo, titulo) { return '<fieldset class="chips-aspecto"><legend>' + titulo + "</legend>" + opcoesChips(campo, "checkbox", op.aspectos, p[campo] || []) + "</fieldset>"; }
    tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/partidas">‹ Partidas</a></p><h1>' + (ed ? "Corrigir partida" : "Registrar partida") + "</h1>" +
      '<p class="sub">Responda o que lembrar. Só a data e o resultado são necessários.</p>' +
      '<form id="formPartida" novalidate>' +
      '<div class="campo"><label for="pData">Data da partida</label><input id="pData" type="date" max="' + hojeISOLocal() + '" value="' + esc(p.data) + '" required></div>' +
      '<fieldset><legend>Resultado</legend>' + opcoesChips("resultado", "radio", op.resultados, p.resultado ? [p.resultado] : []) + "</fieldset>" +
      '<div class="campo"><label for="pPlacar">Placar <span class="nota">(opcional)</span></label><input id="pPlacar" maxlength="40" placeholder="Ex.: 6-4 3-6 7-5" value="' + esc(p.placar || "") + '"></div>' +
      '<div class="campo"><label for="pAdv">Adversário <span class="nota">(opcional)</span></label><input id="pAdv" maxlength="60" list="listaAdv" autocomplete="off" value="' + esc(p.adversario || "") + '"><datalist id="listaAdv">' + conhecidos.map(function (n) { return '<option value="' + esc(n) + '">'; }).join("") + "</datalist></div>" +
      '<fieldset><legend>Tipo de partida</legend>' + opcoesChips("tipo", "radio", op.tipos, [p.tipo]) + "</fieldset>" +
      '<div id="pTorneioBox"></div>' +
      '<fieldset><legend>Superfície <span class="nota">(opcional)</span></legend>' + opcoesChips("superficie", "radio", op.superficies, p.superficie ? [p.superficie] : []) + "</fieldset>" +
      (planos.length ? '<div class="campo"><label for="pPlano">Estratégia utilizada <span class="nota">(opcional)</span></label><select id="pPlano"><option value="">Nenhuma em especial</option>' + planos.map(function (x) {
        return '<option value="' + esc(x.id) + '"' + (x.id === planoSel ? " selected" : "") + ">" + esc(tipoEstrategia(x) + (x.adversarioNome ? " — " + x.adversarioNome : "") + " · " + tituloCurto(x.plano.titulo)) + "</option>";
      }).join("") + "</select></div>" +
        '<fieldset><legend>Sua avaliação: quanto você conseguiu executar a estratégia? <span class="nota">(opcional)</span></legend>' + escala + "</fieldset>" : "") +
      '<details class="det" style="margin-bottom:16px"' + (ed && (ed.funcionou.length || ed.naoFuncionou.length || ed.dificuldades.length || ed.positivos.length || ed.obs) ? " open" : "") + '><summary>Avaliação detalhada (opcional)</summary><div style="margin-top:12px">' +
        grupo("funcionou", "O que funcionou") + grupo("naoFuncionou", "O que não funcionou") + grupo("dificuldades", "Principais dificuldades") + grupo("positivos", "Pontos positivos") +
        '<div class="campo"><label for="pObs">Observações adicionais</label><textarea id="pObs" maxlength="500">' + esc(p.obs || "") + "</textarea>" + botaoVoz("pObs") + "</div></div></details>" +
        (MODO_COMP ? '<div class="campo"><label for="pVideo">Link do vídeo <span class="nota">(opcional)</span></label><input id="pVideo" type="url" inputmode="url" maxlength="300" autocomplete="off" placeholder="https://" value="' + esc(p.videoLink || "") + '"><p class="nota" style="margin-top:6px">Cole o link de um vídeo da partida (por exemplo, YouTube “não listado” ou Google Drive com acesso liberado). O aplicativo guarda só o endereço, não o vídeo. Treinadores e responsáveis que você autorizou a ver suas partidas verão o link. Prefira um link que só quem o recebe consegue abrir.</p>' + videoHtml(p.videoLink, "Vídeo desta partida") + '</div>' : "") +
      '<div id="pErro" class="aviso" role="alert" hidden></div>' +
      '<button class="btn btn-primario btn-grande" type="submit" id="btSalvarPartida">' + (ed ? "Salvar correção" : "Salvar partida") + "</button>" +
      (ed && MODO_COMP && (ed.dificuldades || []).length ? '<button class="btn btn-laranja largo" type="button" id="btLevarTreino" style="margin-top:12px">Levar as dificuldades para o treino</button>' : "") +
      (ed ? '<button class="btn btn-texto largo" type="button" id="btExcluirPartida" style="margin-top:10px">Excluir este registro</button>' : "") + "</form>");
    var blv = document.getElementById("btLevarTreino");
    if (blv) blv.addEventListener("click", async function () {
      ocupado(blv, true, "Levando…");
      try { var x = await api("player-torneios", { metodo: "POST", corpo: { acao: "levarParaTreino", partidaId: ed.id } }); toast(x.novos ? "Foco adicionado ao seu treino." : "Esses focos já estão no seu treino."); ir("#/focos"); }
      catch (e) { toast(e.message, null, true); ocupado(blv, false); }
    });
    var form = document.getElementById("formPartida");
    var qt = (location.hash.split("?")[1] || "").match(/(?:^|&)torneio=([^&]+)/), torneioSel = ed ? ed.torneioId || "" : qt ? decodeURIComponent(qt[1]) : "", rodadaSel = ed ? ed.rodada || "" : "";
    if (MODO_COMP && !estado.semTemporada) api("player-torneios").then(function (rt) {
      var box = document.getElementById("pTorneioBox"); if (!box || !rt.torneios.length) return;
      box.innerHTML = '<div class="campo"><label for="pTorneio">Torneio <span class="nota">(opcional)</span></label><select id="pTorneio"><option value="">Sem torneio vinculado</option>' + rt.torneios.map(function (t) { return '<option value="' + t.id + '"' + (t.id === torneioSel ? " selected" : "") + ">" + esc(t.nome) + "</option>"; }).join("") + "</select></div>" +
        '<div class="campo"><label for="pRodadaP">Rodada <span class="nota">(opcional)</span></label><input id="pRodadaP" maxlength="30" placeholder="Ex.: Oitavas" value="' + esc(rodadaSel) + '"></div>' +
        '<div class="campo"><label for="pPrepSel">Estratégia usada nesta partida <span class="nota">(opcional)</span></label><select id="pPrepSel"></select><p class="nota">Cada preparação fica ligada a uma única partida. Um torneio pode ter várias.</p></div>';
      function preencherPreps() {
        var tid = document.getElementById("pTorneio").value, sl = document.getElementById("pPrepSel");
        var lista = rt.preparos.filter(function (x) { return x.torneioId === tid && (!x.partidaId || (ed && x.partidaId === ed.id)); });
        sl.innerHTML = '<option value="">Sem estratégia vinculada</option>' + lista.map(function (x) { return '<option value="' + x.id + '"' + (ed && ed.preparoId === x.id ? " selected" : "") + ">" + esc((x.rodada || "Partida") + (x.adversario ? " · contra " + x.adversario : "") + (x.data ? " · " + dataCurta(x.data) : "")) + "</option>"; }).join("");
        sl.disabled = !tid;
      }
      document.getElementById("pTorneio").addEventListener("change", preencherPreps); preencherPreps();
    }).catch(function () { estado.semTemporada = true; });
    function marcados(nome) { return Array.prototype.map.call(form.querySelectorAll('input[name="' + nome + '"]:checked'), function (i) { return i.value; }); }
    function unico(nome) { var m = marcados(nome); return m.length ? m[0] : ""; }
    form.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var erro = document.getElementById("pErro"), bt = document.getElementById("btSalvarPartida");
      var corpo = { acao: "salvarPartida", id: ed ? ed.id : novoId(), data: document.getElementById("pData").value, resultado: unico("resultado"), tipo: unico("tipo") || "treino", superficie: unico("superficie") || null,
        placar: document.getElementById("pPlacar").value, adversario: document.getElementById("pAdv").value, planoId: document.getElementById("pPlano") ? document.getElementById("pPlano").value || null : null,
        execucao: unico("execucao") ? parseInt(unico("execucao"), 10) : null, obs: document.getElementById("pObs").value, videoLink: document.getElementById("pVideo") ? document.getElementById("pVideo").value : (ed ? ed.videoLink || "" : ""),
        torneioId: (document.getElementById("pTorneio") ? document.getElementById("pTorneio").value : torneioSel) || null, rodada: document.getElementById("pRodadaP") ? document.getElementById("pRodadaP").value : rodadaSel,
        preparoId: document.getElementById("pPrepSel") ? document.getElementById("pPrepSel").value || null : (ed ? ed.preparoId || null : null) };
      ["funcionou", "naoFuncionou", "dificuldades", "positivos"].forEach(function (c) { corpo[c] = marcados(c); });
      if (!corpo.data) { erro.textContent = "Informe a data da partida."; erro.hidden = false; return; }
      if (!corpo.resultado) { erro.textContent = "Informe se foi vitória ou derrota."; erro.hidden = false; return; }
      erro.hidden = true; ocupado(bt, true, "Salvando…");
      try { await api("player-dados", { metodo: "POST", corpo: corpo }); await carregarDados(); toast(ed ? "Registro corrigido" : "Partida registrada"); ir("#/partidas"); }
      catch (e) { ocupado(bt, false); erro.textContent = e.message; erro.hidden = false; }
    });
    var ex = document.getElementById("btExcluirPartida");
    if (ex) ex.addEventListener("click", async function () {
      if (!window.confirm("Excluir este registro de partida? Isso não pode ser desfeito.")) return;
      ocupado(ex, true, "Excluindo…");
      try { await api("player-dados", { metodo: "POST", corpo: { acao: "excluirPartida", id: ed.id } }); await carregarDados(); toast("Registro excluído"); ir("#/partidas"); }
      catch (e) { ocupado(ex, false); toast(e.message, null, true); }
    });
  }


  /* ══ Desafio de 7 dias ═════════════════════════════════════════════
     Sete práticas curtas montadas, no aparelho, a partir da estratégia do próprio jogador (diretrizes, jogadas,
     fundamentos e drills que a estratégia já traz): nada é gerado por IA nem gasta cota, e nada é inventado.
     O servidor só guarda o andamento (que dia foi feito e a anotação opcional). Vale para todos os planos. */
  function listaUl(itens) { return '<ul class="beneficios">' + itens.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>"; }
  function blocoDc(rotulo, html) { return '<div class="dc-bloco"><p class="olho">' + esc(rotulo) + "</p>" + html + "</div>"; }
  function drillHtml(dr) {
    var l = [["Objetivo", dr.objetivo], ["Como montar", dr.montagem], ["Carga", dr.carga], ["Se estiver difícil", dr.regressao], ["Quando estiver fácil", dr.progressao], ["Corrigir", dr.corrigir]].filter(function (x) { return x[1]; });
    return "<p><strong>" + esc(dr.nome) + "</strong></p>" + (l.length ? '<dl class="dc-drill">' + l.map(function (x) { return "<dt>" + x[0] + "</dt><dd>" + esc(x[1]) + "</dd>"; }).join("") + "</dl>" : "");
  }
  function diasDesafio(plano, planoId) {
    var dir = plano.diretrizes || [], jog = plano.jogadas || [];
    var vazia = { titulo: "Sua jogada", quando: "", porque: "", sequencia: [], fundamentos: [], drills: [] };
    if (!jog.length) jog = [vazia];
    var j1 = jog[0], j2 = jog[1] || jog[0], doisJ = !!jog[1];
    function seq(j) { return '<ol class="dc-seq">' + (j.sequencia || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol>"; }
    function fundam(j, n) { var f = (j.fundamentos || []).slice(0, n); return f.length ? listaUl(f.map(function (x) { return x.nome + " — " + x.foco; })) : ""; }
    function naCabeca(j, pergunta) {
      return { blocos: [blocoDc("A sequência", seq(j)), blocoDc("Quando usar", "<p>" + esc(j.quando) + "</p>"), blocoDc("Por que esta jogada", "<p>" + esc(j.porque) + "</p>")],
        tarefa: "Repasse a sequência três vezes, em voz baixa, imaginando cada bola e onde você estará depois dela.", pergunta: pergunta };
    }
    function naQuadra(j, idx) {
      var dr = (j.drills || [])[idx] || (j.drills || [])[0];
      return { blocos: dr ? [blocoDc("Exercício da sua estratégia", drillHtml(dr)), blocoDc("Fundamentos desta jogada", fundam(j, 3) || "<p>—</p>")]
        : [blocoDc("O que treinar", fundam(j, 4) || "<p>Treine a sequência em ritmo tranquilo, sem pressão.</p>")],
        tarefa: dr ? "Faça o exercício com a carga indicada e mantenha a atenção nos fundamentos listados." : "Treine a sequência cerca de 10 vezes, em ritmo tranquilo, com atenção ao primeiro fundamento.",
        pergunta: "Qual bola da sequência foi mais difícil de executar? O que você ajustou?" };
    }
    var d1 = { titulo: "Seu plano em poucas palavras", tempo: "cerca de 5 min",
      blocos: [blocoDc("Suas prioridades", '<ol class="dc-seq">' + dir.slice(0, 3).map(function (x) { return "<li><strong>" + esc(x.titulo) + "</strong><br>" + esc(x.acao) + '<br><span class="nota">Por quê: ' + esc(x.porque) + "</span></li>"; }).join("") + "</ol>")],
      tarefa: "Escolha a prioridade que mais importa para o seu próximo jogo e diga-a com as suas palavras.", pergunta: "Qual é a sua prioridade número 1 e por quê?" };
    var d2 = naCabeca(j1, "Em que momento de um jogo você usaria esta jogada?"); d2.titulo = "A jogada na cabeça: " + j1.titulo; d2.tempo = "cerca de 5 min";
    var d3 = naQuadra(j1, 0); d3.titulo = "A jogada na quadra: " + j1.titulo; d3.tempo = "10 a 15 min";
    var d4 = naCabeca(j2, "Que sinal na quadra diz que é hora de usar esta jogada?"); d4.titulo = (doisJ ? "A segunda jogada na cabeça: " : "A mesma jogada, em outra situação: ") + j2.titulo; d4.tempo = "cerca de 5 min";
    var d5 = naQuadra(j2, doisJ ? 0 : 1); d5.titulo = (doisJ ? "A segunda jogada na quadra: " : "Mais uma prática: ") + j2.titulo; d5.tempo = "10 a 15 min";
    var d6 = { titulo: "Decidir na hora", tempo: "cerca de 5 min",
      blocos: [blocoDc("Quando usar cada jogada", listaUl(jog.slice(0, 4).map(function (x) { return x.titulo + ": " + x.quando; })))],
      tarefa: "Em um treino ou jogo hoje — ou lembrando de uma partida —, identifique três momentos em que cada jogada seria a escolha certa.", pergunta: "O que você percebe na quadra que indica a hora de usar cada jogada?" };
    var d7 = { titulo: "Jogo com plano", tempo: "um treino-jogo", partida: planoId,
      blocos: [blocoDc("Para levar à quadra", listaUl(dir.slice(0, 2).map(function (x) { return x.titulo + ": " + x.acao; }).concat(jog.slice(0, 2).map(function (x) { return "Jogada: " + x.titulo; }))))],
      tarefa: "Jogue um set ou um treino-jogo com a intenção de usar as suas jogadas. Depois, registre a partida.", pergunta: "O que funcionou e o que você levaria para a próxima semana?" };
    return [d1, d2, d3, d4, d5, d6, d7];
  }
  function desafioAtual() {
    var dz = estado.dados.desafio;
    if (!dz) return null;
    var p = planoPorId(dz.planoId);
    return p && p.status === "pronto" ? { dz: dz, plano: p } : null;
  }
  function diasFeitos(dz) { return [1, 2, 3, 4, 5, 6, 7].map(function (n) { return !!((dz.dias || {})[n] || {}).feito; }); }
  function telaDesafio() {
    var prontos = planosProntos(), a = desafioAtual();
    var html = '<h1>Desafio de 7 dias</h1><p class="sub">Sete práticas curtas, montadas a partir da sua estratégia: entender o plano, ensaiar as jogadas, treiná-las e levá-las a um jogo.</p>';
    if (!prontos.length) { tela(html + '<div class="cartao" style="margin-top:18px"><h2>O desafio usa a sua estratégia</h2><p class="nota" style="margin-top:6px">Crie a sua estratégia primeiro. As práticas dos sete dias saem das prioridades e das jogadas dela.</p><a class="btn btn-primario btn-grande" href="#/estrategia">Ir para estratégias</a></div>'); return; }
    if (!a) {
      var p = prontos[0];
      tela(html + '<div class="cartao" style="margin-top:18px"><p class="olho">Sua estratégia</p><h2>' + esc(p.plano.titulo) + '</h2><p class="nota" style="margin-top:6px">O desafio é gratuito, não usa inteligência artificial e não gasta suas gerações. Você faz um dia por vez, em ordem, no seu ritmo, e anota o que perceber.</p>' +
        '<button class="btn btn-primario btn-grande" id="btIniciarDesafio" type="button">Começar o desafio</button></div>');
      document.getElementById("btIniciarDesafio").addEventListener("click", async function () {
        var bt = this; ocupado(bt, true, "Preparando…");
        try { await api("player-dados", { metodo: "POST", corpo: { acao: "desafioIniciar", planoId: p.id } }); await carregarDados(); ir("#/desafio/1"); }
        catch (e) { ocupado(bt, false); toast(e.message, null, true); }
      });
      return;
    }
    var dias = diasDesafio(a.plano.plano, a.plano.id), feitos = diasFeitos(a.dz), qtd = feitos.filter(Boolean).length, prox = feitos.indexOf(false);
    html += '<div class="cartao" style="margin-top:18px"><p class="olho">Sua estratégia</p><p><strong>' + esc(a.plano.plano.titulo) + '</strong></p><p class="nota">' + qtd + " de 7 dias feitos.</p>" +
      '<span class="prog-barra uso-barra" aria-hidden="true"><i style="width:' + Math.round(qtd / 7 * 100) + '%"></i></span></div>' +
      '<div class="cartao lista-estrategias" style="margin-top:14px">' + dias.map(function (d, i) {
        var liberado = i === 0 || feitos[i - 1] || feitos[i];
        return (liberado ? '<a class="item-estrategia" href="#/desafio/' + (i + 1) + '">' : '<div class="item-estrategia dc-travado" aria-disabled="true">') +
          '<strong>' + (feitos[i] ? "✓ " : "") + "Dia " + (i + 1) + " · " + esc(d.titulo) + '</strong><span class="nota" style="display:block">' + (feitos[i] ? "concluído" : liberado ? esc(d.tempo) + (i === prox ? " · próximo" : "") : "disponível depois do dia " + i) + "</span>" + (liberado ? "</a>" : "</div>");
      }).join("") + "</div>";
    if (qtd === 7) {
      var notas = [1, 2, 3, 4, 5, 6, 7].filter(function (n) { return ((a.dz.dias || {})[n] || {}).nota; });
      html += '<div class="cartao" style="margin-top:14px"><h2>Desafio concluído</h2><p class="nota" style="margin-top:6px">Você praticou a sua estratégia por sete dias. Registre como foi nas suas partidas para os próximos planos considerarem.</p>' +
        (notas.length ? '<details class="det"><summary>O que você anotou</summary>' + notas.map(function (n) { return '<p style="margin-top:8px"><strong>Dia ' + n + ":</strong> " + esc(a.dz.dias[n].nota) + "</p>"; }).join("") + "</details>" : "") +
        '<div class="acoes"><a class="btn btn-primario" href="#/partidas/nova?plano=' + esc(a.plano.id) + '">Registrar partida</a><button class="btn btn-texto" id="btRefazer" type="button">Refazer o desafio</button></div></div>';
    }
    tela(html);
    var rf = document.getElementById("btRefazer");
    if (rf) rf.addEventListener("click", async function () {
      if (!window.confirm("Refazer o desafio apaga o andamento e as anotações atuais. Continuar?")) return;
      ocupado(rf, true, "Reiniciando…");
      try { await api("player-dados", { metodo: "POST", corpo: { acao: "desafioIniciar", planoId: (planosProntos()[0] || a.plano).id, reiniciar: true } }); await carregarDados(); ir("#/desafio/1"); }
      catch (e) { ocupado(rf, false); toast(e.message, null, true); }
    });
  }
  function telaDesafioDia(n) {
    var a = desafioAtual(); n = parseInt(n, 10);
    if (!a || !(n >= 1 && n <= 7)) { ir("#/desafio"); return; }
    var feitos = diasFeitos(a.dz);
    if (n > 1 && !feitos[n - 2] && !feitos[n - 1]) { ir("#/desafio"); return; }
    var d = diasDesafio(a.plano.plano, a.plano.id)[n - 1], reg = (a.dz.dias || {})[n] || {};
    tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/desafio">‹ Desafio de 7 dias</a></p>' +
      '<p class="olho">Dia ' + n + " de 7 · " + esc(d.tempo) + "</p><h1>" + esc(d.titulo) + "</h1>" + d.blocos.join("") +
      '<div class="cartao objetivo" style="margin-top:14px"><p class="olho">A prática de hoje</p><p>' + esc(d.tarefa) + "</p></div>" +
      (d.partida ? '<a class="btn btn-secundario largo" style="margin-top:10px" href="#/partidas/nova?plano=' + esc(d.partida) + '">Registrar partida</a>' : "") +
      '<div class="campo" style="margin-top:16px"><label for="dcNota">' + esc(d.pergunta) + ' <span class="nota">(opcional)</span></label><textarea id="dcNota" maxlength="500">' + esc(reg.nota || "") + "</textarea>" + botaoVoz("dcNota") + "</div>" +
      '<div class="aviso" id="dcErro" role="alert" hidden></div><button class="btn btn-primario btn-grande" id="btDiaFeito" type="button">' + (reg.feito ? "Salvar anotação" : "Marcar dia como feito") + "</button>");
    document.getElementById("btDiaFeito").addEventListener("click", async function () {
      var bt = this; ocupado(bt, true, "Salvando…");
      try {
        await api("player-dados", { metodo: "POST", corpo: { acao: "desafioDia", dia: n, nota: document.getElementById("dcNota").value } });
        await carregarDados(); toast(n === 7 ? "Desafio concluído" : "Dia " + n + " feito"); ir("#/desafio");
      } catch (e) { ocupado(bt, false); var er = document.getElementById("dcErro"); er.textContent = e.message; er.hidden = false; }
    });
  }


  /* ══ Preparação: Aquecimento e Desafios ════════════════════════════
     Aquecimento (físico) e Desafios (tático e mental) fazem parte da seção Treinos. Todos os atalhos (Treinos, Início,
     próximo treino e menu Mais) levam às MESMAS telas e usam o MESMO progresso: o do desafio tático vem da conta
     (estado.dados.desafio) e o do 7 Dias de Presença é o que a própria página grava neste aparelho
     (localStorage, mesma chave dela). Nada de progresso inventado. */
  var CHAVE_PRESENCA = MODO_COMP ? "comp-presenca7dias.v1" : "presenca7dias.v1";
  function presencaEstado() {
    var r = { feitos: 0, total: 7, prox: 1, concluido: false };
    try {
      var o = JSON.parse(localStorage.getItem(CHAVE_PRESENCA) || "null");
      if (o && Array.isArray(o.feitos) && o.feitos.length === 7) {
        r.feitos = o.feitos.filter(Boolean).length; r.concluido = r.feitos === 7;
        var i = o.feitos.indexOf(false); r.prox = i < 0 ? 7 : i + 1;
      }
    } catch (e) { /* sem armazenamento: aparece como não iniciado */ }
    return r;
  }
  function desafiosLista() {
    var a = desafioAtual(), tat;
    if (!planosProntos().length) tat = { estado: "semEstrategia" };
    else if (!a) tat = { estado: "naoIniciado" };
    else {
      var f = diasFeitos(a.dz), n = f.filter(Boolean).length, i = f.indexOf(false);
      tat = { estado: n === 7 ? "concluido" : n > 0 ? "andamento" : "naoIniciado", feitos: n, prox: i < 0 ? 7 : i + 1, proxTitulo: i < 0 ? "" : diasDesafio(a.plano.plano, a.plano.id)[i].titulo };
    }
    tat.id = "tatico"; tat.nome = "Desafio de 7 dias"; tat.categoria = "Tático"; tat.total = 7;
    tat.desc = "Práticas baseadas na sua estratégia, com prioridades, jogadas e exercícios."; tat.href = "#/desafio";
    var p = presencaEstado();
    var men = { id: "mental", nome: "7 Dias de Presença", categoria: "Mental", total: 7, feitos: p.feitos, prox: p.prox, href: PLAYER_BASE + "presenca/", local: true,
      desc: "Práticas curtas para desenvolver presença e atenção.", estado: p.concluido ? "concluido" : p.feitos > 0 ? "andamento" : "naoIniciado" };
    return MODO_COMP ? [men] : [tat, men];
  }
  function barraPrep(feitos, total) {
    return '<span class="prep-barra" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + feitos + '" aria-label="' + feitos + " de " + total + ' etapas concluídas"><i style="width:' + Math.round(feitos / total * 100) + '%"></i></span>';
  }
  function origemValida(de) { return /^[A-Za-z0-9_\-\/]{1,120}$/.test(de || "") ? de : ""; }
  function origemDaUrl() { var m = (location.hash.split("?")[1] || "").match(/(?:^|&)de=([^&]+)/); return m ? origemValida(decodeURIComponent(m[1])) : ""; }
  function hrefAquecimento(de) { return "#/aquecimento" + (de ? "?de=" + encodeURIComponent(de) : ""); }
  /* dois cartões compactos lado a lado (ou empilhados quando falta espaço); ctx = de onde o jogador veio */
  function cartoesPreparacaoHtml(ctx, dinamico) {
    var lista = dinamico ? desafiosLista().filter(function (x) { return x.estado === "andamento"; }) : [], d = lista[0];
    var cDes = d
      ? '<h3>' + esc(d.nome) + '</h3><p class="prep-desc">' + d.feitos + " de " + d.total + " etapas concluídas</p>" + barraPrep(d.feitos, d.total) +
        '<p class="prep-info">' + esc(d.categoria) + (lista.length > 1 ? " · mais 1 em andamento" : "") + '</p><a class="btn btn-laranja" href="' + d.href + '">Continuar</a>'
      : '<h3>Desafios</h3><p class="prep-desc">Pratique com um objetivo.</p><p class="prep-info">' + (MODO_COMP ? "Mental" : "Tático e mental") + '</p><a class="btn btn-laranja" href="#/desafios">Ver desafios</a>';
    return '<div class="prep-grid"><section class="prep-card" aria-label="Aquecimento"><h3>Aquecimento</h3><p class="prep-desc">18 min para preparar o corpo.</p>' +
      '<p class="prep-info">Sem bola · Orientação por voz</p><a class="btn btn-laranja" href="' + hrefAquecimento(ctx) + '">Abrir aquecimento</a></section>' +
      '<section class="prep-card" aria-label="Desafios">' + cDes + "</section></div>";
  }
  /* Pensamentos antes do jogo: o atleta escreve o que o atrapalharia e, antes de entrar em quadra, solta tudo.
     Nada é salvo em lugar nenhum (nem no aparelho, nem no servidor): os pensamentos só existem nesta tela e somem ao soltar ou ao sair. */
  function telaPensamentos() {
    var itens = [], soltando = false;
    var SUGESTOES = ["E se eu errar?", "O resultado", "O adversário", "O que vão pensar", "Dor ou cansaço", "O ranking"];
    function sair() { itens = []; window.removeEventListener("hashchange", sair); }
    window.addEventListener("hashchange", sair);
    function papeis() { return itens.map(function (t, i) { return '<li class="pens-papel" style="--i:' + i + '"><span>' + esc(t) + '</span><button type="button" class="pens-x" data-rm="' + i + '" aria-label="Tirar este pensamento do papel">×</button></li>'; }).join(""); }
    function desenhar() {
      tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/inicio">‹ Início</a></p><h1>Pensamentos antes do jogo</h1>' +
        '<p class="sub">Escreva o que está na sua cabeça e atrapalharia. Antes de entrar em quadra, você solta tudo. Nada fica guardado: nem aqui, nem com o seu treinador.</p>' +
        '<section class="cartao pens-bloco" aria-labelledby="pensT"><h2 id="pensT">O que está pesando?</h2>' +
        '<div class="pens-sug" role="group" aria-label="Ideias para começar">' + SUGESTOES.map(function (t) { return '<button type="button" class="btn btn-secundario btn-pequeno" data-sug="' + esc(t) + '">' + esc(t) + "</button>"; }).join("") + "</div>" +
        '<div class="campo"><label for="pensTxt">Um pensamento por vez</label><textarea id="pensTxt" rows="2" maxlength="200" autocomplete="off" spellcheck="false" placeholder="Escreva e coloque no papel"></textarea></div>' +
        '<div class="acoes"><button type="button" class="btn btn-secundario" id="pensAdd">Colocar no papel</button></div>' +
        (itens.length ? '<ul class="pens-lista" aria-label="Pensamentos no papel">' + papeis() + "</ul>" : '<p class="nota" style="margin-top:12px">Nenhum pensamento no papel ainda.</p>') + "</section>" +
        '<div class="acoes"><button type="button" class="btn btn-laranja btn-grande" id="pensSoltar"' + (itens.length ? "" : " disabled") + ">Soltar tudo e entrar em quadra</button></div>" +
        '<p class="nota" style="margin-top:12px">Saindo desta tela, os pensamentos também se vão. Não existe cópia.</p>' +
        '<div class="cartao" style="margin-top:14px"><h2>Quer o ritual completo?</h2><p class="nota" style="margin-top:6px">Dez minutos guiados com respiração, intenção e ativação, antes de entrar em quadra.</p><div class="acoes"><a class="btn btn-secundario" href="#/ritual">Fazer o ritual pré-jogo</a></div></div>');
      var txt = document.getElementById("pensTxt");
      function adicionar() { var t = txt.value.trim(); if (!t) return; itens.push(t.slice(0, 200)); desenhar(); document.getElementById("pensTxt").focus(); }
      document.getElementById("pensAdd").addEventListener("click", adicionar);
      txt.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); adicionar(); } });
      app.querySelectorAll("[data-sug]").forEach(function (b) { b.addEventListener("click", function () { txt.value = b.getAttribute("data-sug") + ": "; txt.focus(); }); });
      app.querySelectorAll("[data-rm]").forEach(function (b) { b.addEventListener("click", function () { itens.splice(+b.getAttribute("data-rm"), 1); desenhar(); }); });
      document.getElementById("pensSoltar").addEventListener("click", soltar);
    }
    function soltar() {
      if (soltando || !itens.length) return;
      soltando = true;
      var lista = app.querySelector(".pens-lista"), txt = document.getElementById("pensTxt");
      if (txt) { txt.value = ""; txt.disabled = true; }
      if (lista) lista.classList.add("pens-soltando");
      var curto = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setTimeout(function () {
        itens = [];
        window.removeEventListener("hashchange", sair);
        tela('<div class="pens-limpo" role="status"><div class="pens-respira" aria-hidden="true"></div><h1>Cabeça limpa</h1><p class="sub">Tudo o que pesava foi solto e apagado. Não ficou nada guardado.</p>' +
          '<p class="pens-frase">Respire fundo. Agora é só o próximo ponto.</p><div class="acoes" style="justify-content:center"><a class="btn btn-laranja btn-grande" href="#/inicio">Entrar em quadra</a></div></div>');
      }, curto ? 200 : 2600);
    }
    desenhar();
  }
  /* Ritual pré-jogo: cinco passos guiados (corpo, respiração 4-6, soltar, intenção, ativar), com som, vibração e tela acesa.
     Nada é salvo: a intenção só existe na memória desta tela. */
  function telaRitual() {
    var P = [
      { id: 1, curto: "Chegar", nome: "Chegar ao corpo", min: 2, seg: 120, tipo: "timer", por: "Antes da cabeça, o corpo. Você está tirando a mente do modo pensamento e trazendo para o modo corpo, que é onde o tênis acontece.", como: "Sente-se com os dois pés apoiados no chão. Percorra o corpo com a atenção: pés, pernas, quadril, tronco, ombros, mãos, rosto. Onde encontrar tensão desnecessária, como ombros subidos ou mandíbula travada, solte na expiração." },
      { id: 2, curto: "Acalmar", nome: "Acalmar o sistema", min: 3, seg: 180, tipo: "resp46", por: "A ansiedade pré-jogo é normal. A ideia não é eliminá-la, é não deixá-la conduzir. A respiração é o controle mais direto que você tem.", como: "Inspire em 4 tempos, expire em 6, mais longo. Se a cabeça for para o resultado, para o adversário ou para o ranking, volte para a contagem. A expiração longa é o freio natural do corpo." },
      { id: 3, curto: "Soltar", nome: "Soltar o que não é deste jogo", min: 2, seg: 120, tipo: "timer", link: true, por: "O jogo passado, a expectativa dos outros, o que aconteceu na semana. Nada disso entra em quadra com você.", como: "Traga à mente o que está pesando: uma derrota recente, uma cobrança, um medo. Reconheça: “isso está aqui”. A cada expiração, imagine deixando cada uma dessas coisas do lado de fora. Tudo passa, inclusive o que passou." },
      { id: 4, curto: "Definir", nome: "Definir a intenção", min: 2, seg: 120, tipo: "intencao", por: "Não uma meta de resultado, mas uma intenção de processo: algo que depende só de você e que você controla por inteiro.", como: "Uma só. Se você tem três intenções, não tem nenhuma. Esta partida acontece uma vez só, e você escolhe como quer jogá-la." },
      { id: 5, curto: "Ativar", nome: "Ativar e entrar", min: 1, seg: 60, tipo: "ativar", por: "Sair do estado calmo para o estado de jogo: desperto, solto, pronto. Calma não é lentidão.", como: "Três respirações ativas, em tempos iguais. Sacuda os braços e as pernas, role os ombros. Sinta o corpo acordar. Ao levantar, lembre da sua intenção, só dela. Entre solto, confiando no treino, sem forçar." }
    ];
    var SUG = ["jogar cada ponto até o fim", "respirar entre os pontos", "manter os pés se movendo", "soltar o braço no saque", "olhar a bola até o contato", "rotina completa antes de cada saque"], CURTO = [2, 4, 5];
    var seq = [], idx = 0, intencao = "", tint = null, rodando = false, tmos = [], wl = null, AC = null, somLigado = true, audioOk = false;
    try { somLigado = localStorage.getItem("ql_ritual_som") !== "off"; } catch (e) { /* sem armazenamento: som ligado */ }
    function $(id) { return document.getElementById(id); }
    function fmt(n) { return Math.floor(n / 60) + ":" + ("0" + (n % 60)).slice(-2); }
    function atual() { return P.filter(function (x) { return x.id === seq[idx]; })[0]; }
    function limpar() { if (tint) { clearInterval(tint); tint = null; } tmos.forEach(clearTimeout); tmos = []; rodando = false; if (wl) { try { wl.release(); } catch (e) { /* já liberado */ } wl = null; } }
    function agendar(fn, ms) { tmos.push(setTimeout(fn, ms)); }
    function sair() { limpar(); window.removeEventListener("hashchange", sair); document.removeEventListener("visibilitychange", voltou); if (AC) { try { AC.close(); } catch (e) { /* ok */ } AC = null; } }
    function voltou() { if (!document.hidden) { destravar(); if (rodando) acordar(); } }
    window.addEventListener("hashchange", sair); document.addEventListener("visibilitychange", voltou);
    function criarAC() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; } } return AC; }
    function destravar() {
      var c = criarAC(); if (!c) return;
      if (c.state === "suspended") c.resume().catch(function () { /* sem gesto ainda */ });
      if (!audioOk) { try { var b = c.createBuffer(1, 1, 22050), src = c.createBufferSource(); src.buffer = b; src.connect(c.destination); src.start(0); audioOk = true; } catch (e) { /* ok */ } }
    }
    function tom(f, d, v) {
      if (!somLigado) return; var c = criarAC(); if (!c) return;
      if (c.state === "suspended") c.resume().catch(function () { /* ok */ });
      try { var o = c.createOscillator(), g = c.createGain(), t = c.currentTime; o.type = "sine"; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v || 0.2, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + (d || 0.6)); o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + (d || 0.6) + 0.05); } catch (e) { /* ok */ }
    }
    function vib(pad) { if (!somLigado) return; try { if (navigator.vibrate) navigator.vibrate(pad); } catch (e) { /* ok */ } }
    var S = {
      inspira: function () { tom(528, 0.45, 0.2); vib(40); }, expira: function () { tom(396, 0.55, 0.17); vib(28); }, metade: function () { tom(440, 0.5, 0.16); vib(60); }, passo: function () { tom(660, 0.35, 0.18); vib(35); },
      fim: function () { tom(528, 0.7, 0.22); agendar(function () { tom(660, 0.7, 0.2); }, 420); agendar(function () { tom(792, 1, 0.18); }, 840); vib([90, 110, 90, 110, 200]); }
    };
    function acordar() { try { if ("wakeLock" in navigator && !wl) navigator.wakeLock.request("screen").then(function (l) { wl = l; l.addEventListener("release", function () { wl = null; }); }).catch(function () { wl = null; }); } catch (e) { wl = null; } }
    function botaoSom() { return '<button type="button" class="btn btn-texto btn-pequeno rit-som" id="ritSom" aria-pressed="' + somLigado + '">' + (somLigado ? "Som ligado" : "Som desligado") + "</button>"; }
    function ligarSom() { var b = $("ritSom"); if (b) b.addEventListener("click", function () { somLigado = !somLigado; try { localStorage.setItem("ql_ritual_som", somLigado ? "on" : "off"); } catch (e) { /* ok */ } b.textContent = somLigado ? "Som ligado" : "Som desligado"; b.setAttribute("aria-pressed", String(somLigado)); if (somLigado) { destravar(); agendar(S.passo, 80); } }); }

    function intro() {
      limpar();
      tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/pensamentos">‹ Pensamentos antes do jogo</a></p><h1>Ritual pré-jogo</h1>' +
        '<p class="sub">Dez minutos para entrar em quadra presente, solto e com uma intenção clara. A partida não começa no primeiro saque: começa em como você chega até ele.</p>' +
        '<div class="cartao rit-dados"><div><b>10 min</b><span>no total</span></div><div><b>5</b><span>passos</span></div><div><b>1</b><span>intenção</span></div></div>' +
        '<div class="acoes"><button type="button" class="btn btn-laranja btn-grande" id="ritCompleto">Ritual completo · 10 min</button><button type="button" class="btn btn-secundario btn-grande" id="ritCurto">Versão curta · 3 min</button></div>' +
        '<div class="acoes">' + botaoSom() + '<button type="button" class="btn btn-texto btn-pequeno" id="ritTestar">Testar o som</button></div>' +
        '<p class="nota" id="ritNota" style="margin-top:12px">Faça depois do aquecimento físico, o mais perto possível da entrada em quadra. Os cronômetros avisam por som e vibração, então dá para fechar os olhos. A tela fica acesa durante os exercícios. Nada do que você escreve aqui é guardado.</p>');
      ligarSom();
      $("ritCompleto").addEventListener("click", function () { comecar([1, 2, 3, 4, 5]); });
      $("ritCurto").addEventListener("click", function () { comecar(CURTO); });
      $("ritTestar").addEventListener("click", function () {
        destravar(); if (!somLigado) { $("ritNota").textContent = "O som está desligado. Toque em “Som desligado” para ativar."; return; }
        S.fim(); var ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
        agendar(function () { $("ritNota").textContent = ios ? "Ouviu três tons? Se não, verifique a chavinha lateral do iPhone: no modo silencioso o navegador não emite som. O iPhone também não vibra pelo navegador." : "Ouviu três tons? Se não, verifique o volume do aparelho e se a aba não está silenciada."; }, 1400);
      });
    }
    function comecar(lista) { seq = lista; idx = 0; intencao = ""; destravar(); passo(); }
    function passo() {
      limpar(); var p = atual();
      var mapa = seq.map(function (id, i) { var q = P.filter(function (x) { return x.id === id; })[0]; return '<div class="rit-mp' + (i < idx ? " ok" : i === idx ? " atual" : "") + '"><i></i><span>' + esc(q.curto) + "</span></div>"; }).join("");
      var miolo = "";
      if (p.tipo === "timer") miolo = '<div class="rit-timer"><div class="rit-num" id="ritNum">' + fmt(p.seg) + '</div><div class="rit-lbl" id="ritLbl">toque em começar</div></div>';
      else if (p.tipo === "resp46" || p.tipo === "ativar") miolo = '<div class="rit-resp"><div class="rit-anel"><div class="rit-circ" id="ritCirc"></div></div><div class="rit-txt" id="ritTxt" aria-live="polite">pronto?</div><div class="rit-lbl" id="ritCont"></div></div>';
      else miolo = '<div id="ritInt"><div class="campo"><label for="ritIn">A sua intenção</label><input id="ritIn" maxlength="80" autocomplete="off" value="' + esc(intencao) + '" placeholder="Escreva uma intenção de processo"></div>' +
        '<p class="olho" style="margin-top:6px">Ou escolha uma</p><div class="sf-chips">' + SUG.map(function (t) { return '<button type="button" class="btn btn-secundario btn-pequeno" data-sug="' + esc(t) + '">' + esc(t) + "</button>"; }).join("") + "</div></div>" +
        '<div class="rit-repita" id="ritRep" hidden><div class="rit-frase" id="ritFrase"></div><div class="rit-lbl" id="ritCnt" aria-live="polite"></div></div>';
      var rot = { timer: "Começar", resp46: "Guiar a respiração", intencao: "Repetir três vezes", ativar: "Ativar" }[p.tipo];
      tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/ritual" id="ritVoltar">‹ Ritual pré-jogo</a></p><div class="rit-mapa">' + mapa + "</div>" +
        '<p class="olho">Passo ' + (idx + 1) + " de " + seq.length + " · " + p.min + ' min</p><h1 style="margin-top:4px">' + esc(p.nome) + '</h1><p class="sub">' + esc(p.por) + "</p>" +
        '<div class="cartao rit-como"><p>' + esc(p.como) + "</p>" + (p.link ? '<p style="margin-top:10px"><a href="#/pensamentos" target="_blank" rel="noopener">Escrever e soltar os pensamentos</a></p>' : "") + "</div>" + miolo +
        '<div class="acoes"><button type="button" class="btn btn-laranja btn-grande" id="ritAcao">' + rot + '</button><button type="button" class="btn btn-texto" id="ritPula">' + (idx === seq.length - 1 ? "Pular e entrar" : "Pular este passo") + "</button></div>" + '<div class="acoes">' + botaoSom() + "</div>");
      ligarSom();
      $("ritVoltar").addEventListener("click", function (e) { e.preventDefault(); intro(); });
      $("ritAcao").addEventListener("click", function () { destravar(); if (p.tipo === "timer") rodarTimer(p.seg); else if (p.tipo === "resp46") resp46(p.seg); else if (p.tipo === "intencao") repetir(); else ativar(); });
      $("ritPula").addEventListener("click", function () { if (p.tipo === "intencao") { var v = $("ritIn").value.trim(); if (v) intencao = v; } avancar(); });
      app.querySelectorAll("[data-sug]").forEach(function (b) { b.addEventListener("click", function () { $("ritIn").value = b.getAttribute("data-sug"); }); });
    }
    function travar() { var b = $("ritAcao"); b.disabled = true; b.style.opacity = ".45"; }
    function avancar() {
      limpar();
      if (idx < seq.length - 1) { idx++; passo(); return; }
      tela('<div class="rit-fim" role="status"><h1>Entre.</h1><p class="sub">Você já fez o trabalho. Agora é jogar.</p><div class="cartao rit-int"><p class="olho">Sua intenção</p><p class="rit-frase">' + esc(intencao || "—") + "</p></div>" +
        '<div class="cartao"><p class="olho">Durante o jogo</p><ul class="rit-sanshin"><li><b>Respirar</b> uma respiração funda. Sai do automático.</li><li><b>Resetar</b> o ponto que passou já era. Deixe ir.</li><li><b>Decidir</b> uma intenção simples para o próximo ponto.</li></ul></div>' +
        '<p class="nota">Este ritual não garante vitória. Garante que você entre inteiro, e isso é o que você controla.</p><div class="acoes" style="justify-content:center"><a class="btn btn-laranja btn-grande" href="#/inicio">Voltar ao app</a><button type="button" class="btn btn-secundario" id="ritRefazer">Refazer</button></div></div>');
      $("ritRefazer").addEventListener("click", function () { intencao = ""; intro(); });
    }
    function rodarTimer(seg) {
      if (rodando) return; rodando = true; acordar(); travar();
      var fim = Date.now() + seg * 1000, metade = Math.floor(seg / 2), ult = seg, jaM = false, ja10 = false;
      $("ritLbl").textContent = "em andamento"; S.passo();
      function tick() {
        var rest = Math.max(0, Math.round((fim - Date.now()) / 1000));
        if (rest !== ult) { ult = rest; $("ritNum").textContent = fmt(rest); }
        if (!jaM && rest <= metade && rest > 0) { jaM = true; S.metade(); $("ritLbl").textContent = "metade"; }
        if (!ja10 && rest <= 10 && rest > 0) { ja10 = true; $("ritLbl").textContent = "últimos 10 segundos"; }
        if (rest <= 0) { clearInterval(tint); tint = null; $("ritNum").textContent = "0:00"; $("ritLbl").textContent = "concluído"; S.fim(); agendar(avancar, 1600); }
      }
      tint = setInterval(tick, 250); tick();
    }
    function resp46(total) {
      if (rodando) return; rodando = true; acordar(); travar();
      var c = $("ritCirc"), t = $("ritTxt"), k = $("ritCont"), CICLO = 10000, INSP = 4000, inicio = Date.now() + 900, fim = inicio + total * 1000, fase = null, cic = 0;
      t.textContent = "vamos";
      tint = setInterval(function () {
        var agora = Date.now(); if (agora < inicio) return;
        if (agora >= fim) { clearInterval(tint); tint = null; t.textContent = "pronto"; k.textContent = ""; c.style.transition = "transform 1s ease"; c.style.transform = "scale(1)"; S.fim(); agendar(avancar, 1500); return; }
        var dec = agora - inicio, ciclo = Math.floor(dec / CICLO) + 1, f = dec % CICLO < INSP ? "in" : "out";
        if (f !== fase || ciclo !== cic) {
          fase = f; cic = ciclo;
          if (f === "in") { t.textContent = "inspire"; k.textContent = "4 tempos · ciclo " + ciclo; S.inspira(); c.style.transition = "transform 4s cubic-bezier(.4,0,.5,1)"; c.style.transform = "scale(2.3)"; }
          else { t.textContent = "expire devagar"; k.textContent = "6 tempos"; S.expira(); c.style.transition = "transform 6s cubic-bezier(.4,0,.5,1)"; c.style.transform = "scale(1)"; }
        }
      }, 200);
    }
    function ativar() {
      if (rodando) return; rodando = true; acordar(); travar();
      var c = $("ritCirc"), t = $("ritTxt"), k = $("ritCont"), i = 0;
      function um() {
        if (i >= 3) { t.textContent = "agora é jogar"; k.textContent = ""; c.style.transition = "transform .8s ease"; c.style.transform = "scale(1)"; S.fim(); agendar(avancar, 1700); return; }
        i++; t.textContent = "inspire"; k.textContent = i + " de 3"; S.inspira(); c.style.transition = "transform 3s ease-in-out"; c.style.transform = "scale(2.1)";
        agendar(function () { t.textContent = "expire"; S.expira(); c.style.transition = "transform 3s ease-in-out"; c.style.transform = "scale(1)"; agendar(um, 3000); }, 3000);
      }
      t.textContent = "mais ativo agora"; agendar(um, 800);
    }
    function repetir() {
      var v = $("ritIn").value.trim(); if (!v) { $("ritIn").focus(); return; }
      intencao = v; $("ritInt").hidden = true; $("ritRep").hidden = false; $("ritFrase").textContent = "“" + v + "”"; travar();
      var i = 0;
      function um() { if (i >= 3) { $("ritCnt").textContent = "definida"; S.fim(); agendar(avancar, 1500); return; } i++; $("ritCnt").textContent = i + " de 3"; S.passo(); agendar(um, 2200); }
      $("ritCnt").textContent = "repita mentalmente"; agendar(um, 900);
    }
    intro();
  }
  function telaAquecimento() {
    var de = origemDaUrl();
    var voltar = de ? '<a class="btn btn-texto" href="#/' + esc(de) + '">‹ Voltar</a>' : MODO_COMP ? '<a class="btn btn-texto" href="#/inicio">‹ Início</a>' : '<a class="btn btn-texto" href="#/treinos">‹ Treinos</a>';
    tela('<p style="margin-bottom:8px">' + voltar + '</p><h1>Aquecimento</h1><p class="sub">Prepare o corpo antes de jogar. É opcional: você escolhe quando usar.</p>' +
      '<div class="cartao" style="margin-top:14px"><p class="olho">Físico · Ativação pré-jogo</p><h2>18 minutos, sem bola</h2>' +
      '<ul class="beneficios" style="margin-top:8px"><li>22 exercícios em 5 etapas, da corrida progressiva à respiração final.</li><li>Cronômetro, avisos sonoros e orientação por voz, que você liga ou desliga antes de começar.</li><li>Duração total de cerca de 28 minutos com as instruções, ou 20 se você pular a instrução dos exercícios que já conhece.</li></ul>' +
      '<a class="btn btn-laranja btn-grande" href="' + PLAYER_BASE + 'ativacao/' + (de ? "?de=" + encodeURIComponent(de) : "") + '">Abrir aquecimento</a>' +
      '<p class="nota" style="margin-top:8px">O cronômetro, o som e a voz só começam quando você tocar em Começar. Abrir o aquecimento não marca nenhum treino como iniciado.</p></div>');
  }
  function resumoDesafioHtml(d, completo) {
    var estadoTxt, botao;
    if (d.estado === "semEstrategia") {
      return '<article class="cartao des-card" aria-label="' + esc(d.nome) + '"><p class="olho">' + esc(d.categoria) + "</p><h2>" + esc(d.nome) + '</h2><p class="nota" style="margin-top:6px">' + esc(d.desc) + "</p>" +
        '<p class="nota" style="margin-top:8px">Este desafio parte da sua estratégia. Crie a sua para poder começar.</p><a class="btn btn-laranja" href="#/estrategia">Criar minha estratégia</a></article>';
    }
    if (d.estado === "concluido") { estadoTxt = "Concluído"; botao = "Rever atividades"; }
    else if (d.estado === "andamento") { estadoTxt = d.feitos + " de " + d.total + " etapas concluídas" + (d.prox ? " · próxima: etapa " + d.prox + (d.proxTitulo ? " (" + d.proxTitulo + ")" : "") : ""); botao = "Continuar"; }
    else { estadoTxt = d.total + " etapas"; botao = "Começar"; }
    return '<article class="cartao des-card" aria-label="' + esc(d.nome) + '"><p class="olho">' + esc(d.categoria) + "</p><h2>" + esc(d.nome) + '</h2><p class="nota" style="margin-top:6px">' + esc(d.desc) + "</p>" +
      '<p class="des-estado"><strong>' + esc(estadoTxt) + "</strong></p>" + (d.estado !== "naoIniciado" ? barraPrep(d.feitos, d.total) : "") +
      (d.local ? '<p class="nota" style="margin-top:6px">Seu progresso fica salvo neste aparelho.</p>' : "") +
      '<a class="btn btn-laranja" href="' + d.href + '">' + botao + "</a></article>";
  }
  function telaDesafios() {
    tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="' + (MODO_COMP ? '#/inicio">‹ Início' : '#/treinos">‹ Treinos') + '</a></p><h1>Desafios</h1><p class="sub">Pratique com um objetivo. Você faz no seu ritmo.</p>' +
      desafiosLista().map(function (d) { return resumoDesafioHtml(d); }).join(""));
  }
  /* seção da página Início */
  function preparacaoInicioHtml() {
    return '<h2 class="secao" id="t-prep">Prepare-se para jogar</h2>' + cartoesPreparacaoHtml("inicio", true);
  }
  /* ══ Competição: papel (atleta, responsável, treinador) e vínculos ══
     Tudo vem de player-competicao. O papel e cada permissão são conferidos no servidor; aqui só se mostra e se pede. */
  var ROTULO_PAPEL = { atleta: "Atleta", responsavel: "Responsável", treinador: "Treinador" };
  var ROTULO_VINC = { convite: "Convite aberto", aguardando: "Aguardando aprovação", ativo: "Ativo", revogado: "Encerrado", recusado: "Recusado", cancelado: "Cancelado", expirado: "Convite vencido" };
  var AREAS_COMP = [["perfil", "Perfil de jogador"], ["temporada", "Temporada e torneios"], ["planejamento", "Meu planejamento (compromissos, rotina e registros de treino)"], ["estrategias", "Estratégia por partida"], ["partidas", "Partidas"], ["treinos", "Treinos"], ["diario", "Diário pessoal (privado, só se você marcar)"]];
  function areasMarcadas(sel, id) {
    return AREAS_COMP.map(function (a) {
      var marcado = sel ? sel.indexOf(a[0]) >= 0 : a[0] !== "diario";
      return '<label class="comp-area"><input type="checkbox" name="' + id + '" value="' + a[0] + '"' + (marcado ? " checked" : "") + "> " + esc(a[1]) + "</label>";
    }).join("");
  }
  function lerAreas(id) { return Array.prototype.map.call(document.querySelectorAll('input[name="' + id + '"]:checked'), function (i) { return i.value; }); }
  function rotuloAreas(lista) { return (lista || []).map(function (a) { return (AREAS_COMP.filter(function (x) { return x[0] === a; })[0] || [a, a])[1].replace(/ \(.*\)$/, ""); }).join(", "); }
  async function acaoComp(corpo, btn, ok) {
    if (btn) ocupado(btn, true);
    try { await api("player-competicao", { metodo: "POST", corpo: corpo }); if (ok) toast(ok); await telaCompeticao(); }
    catch (e) { toast(e.message, null, true); if (btn) ocupado(btn, false); }
  }
  var ROTULO_PARENT = { pai: "Pai", mae: "Mãe", outro: "Outro responsável" };
  function rotuloVinc(v) { return v.tipo === "treinador" ? "Treinador" : "Responsável" + (v.parentesco && v.parentesco !== "outro" ? " (" + ROTULO_PARENT[v.parentesco] + ")" : ""); }
  function statusVinc(v, comp) {
    if (v.status === "convite") return "Convite aberto: aguardando a pessoa usar o código";
    if (v.status === "aguardando") return v.origem === "academia" ? "Pedido do treinador da academia: aguardando a sua aprovação" : "A pessoa usou o código: aguardando aprovação";
    return ROTULO_VINC[v.status] || v.status;
  }
  /* convite completo para mandar pelo WhatsApp (ou copiar): onde abrir, como criar a conta, qual papel escolher, como colocar o app
     na tela inicial do celular, onde digitar o código e o que acontece depois. Quem já usa o QuadraLab Player entra com a mesma conta. */
  var LINK_COMP = "https://quadralab.com.br/competicao/";
  function passosInstalarTexto() {
    return "Para deixar o app na tela do celular (fica como um aplicativo, sem baixar nada da loja):\n" +
      "- iPhone: abra o link no Safari, toque em Compartilhar (quadrado com seta para cima) e depois em \u201cAdicionar à Tela de Início\u201d.\n" +
      "- Android: abra o link no Chrome, toque nos três pontinhos (canto de cima) e depois em \u201cInstalar app\u201d ou \u201cAdicionar à tela inicial\u201d.";
  }
  function mensagemConvite(v) {
    var papel = v.tipo === "treinador" ? "Treinador" : "Responsável";
    var nome = ((estado.dados && estado.dados.perfil && estado.dados.perfil.nome) || "").split(" ")[0];
    return "Oi! " + (nome ? "Aqui é " + nome + ". " : "") + "Convidei você para acompanhar a minha preparação no QuadraLab Competição, como " + papel.toLowerCase() + ". É grátis.\n\n" +
      "Passo a passo:\n" +
      "1) No celular, abra: " + LINK_COMP + "#/criar\n   (no iPhone use o Safari; no Android, o Chrome. Se abrir dentro do WhatsApp, toque nos três pontinhos e em \u201cAbrir no navegador\u201d.)\n" +
      "2) Toque em \u201cCriar minha conta grátis\u201d e preencha nome, e-mail e uma senha. Se você já usa o QuadraLab Player, toque em \u201cEntrar\u201d e use o mesmo e-mail e senha.\n" +
      "3) Em \u201cQual é o seu papel?\u201d, escolha \u201c" + papel + "\u201d e toque em \u201cContinuar\u201d.\n" +
      "4) Na tela Início, abra \u201cEntrar na equipe de um atleta\u201d, digite o código " + v.codigo + " e toque em \u201cUsar código\u201d.\n" +
      "5) Pronto: eu recebo o pedido e aprovo por aqui" + (v.tipo === "treinador" ? " (se eu for menor de idade, quem aprova é o meu responsável)" : "") + ". Depois disso você já me vê no seu Início.\n\n" +
      passosInstalarTexto() + "\n\n" +
      "O código vale até " + dataISO(v.expiraEm) + " e só pode ser usado uma vez.";
  }
  function vinculoMeuHtml(v, comp) {
    var quem = v.pessoa ? esc(v.pessoa.nome) + (v.pessoa.email ? ' <span class="nota">(' + esc(v.pessoa.email) + ")</span>" : "") : "";
    var h = '<li class="comp-vinc' + (v.status === "convite" ? " convite-aberto" : "") + '"><p><strong>' + (v.status === "convite" ? "Convite para " : "") + esc(rotuloVinc(v)) + "</strong>" + (quem ? " · " + quem : "") + '</p><p class="nota">' + esc(statusVinc(v, comp)) + " · Compartilha: " + esc(rotuloAreas(v.areas)) + "</p>";
    if (v.status === "convite") {
      var papel = v.tipo === "treinador" ? "treinador" : "responsável";
      h += '<p class="olho" style="margin-top:8px">Código de convite</p><p class="comp-codigo" aria-label="Código do convite">' + esc(v.codigo) + '</p><p class="nota">Vale até ' + esc(dataISO(v.expiraEm)) + ". Só pode ser usado uma vez, por uma pessoa.</p>" +
        '<div class="acoes"><a class="btn btn-primario" href="https://wa.me/?text=' + encodeURIComponent(mensagemConvite(v)) + '" target="_blank" rel="noopener noreferrer">Enviar pelo WhatsApp<span class="sr"> (abre em nova aba)</span></a><button type="button" class="btn btn-secundario" data-copiar="' + esc(mensagemConvite(v)) + '" data-copiado="Mensagem com as instruções copiada. Cole no SMS, e-mail ou outro app.">Copiar mensagem com as instruções</button><button type="button" class="btn btn-texto" data-copiar="' + esc(v.codigo) + '">Copiar só o código</button><button type="button" class="btn btn-texto" data-rev="' + v.id + '">Cancelar convite</button></div>' +
        '<details class="det" style="margin-top:8px"><summary>O que a pessoa precisa fazer</summary><ol class="beneficios" style="margin-top:8px"><li>Abrir <strong>quadralab.com.br/competicao</strong> no celular (Safari no iPhone, Chrome no Android).</li><li>Tocar em “Criar minha conta grátis” (ou em “Entrar”, se já usa o QuadraLab Player, com o mesmo e-mail e senha).</li><li>Em “Qual é o seu papel?”, escolher <strong>' + papel + '</strong>.</li><li>Em Início, abrir “Entrar na equipe de um atleta”, digitar o código <strong>' + esc(v.codigo) + '</strong> e tocar em “Usar código”.</li><li>Esperar a sua aprovação. Você a vê aqui, em “Quem acompanha você”.</li><li>Para ter o app na tela do celular: no iPhone, Compartilhar e “Adicionar à Tela de Início”; no Android, três pontinhos e “Instalar app”.</li></ol><p class="nota" style="margin-top:6px">Tudo isso já vai escrito na mensagem do WhatsApp.</p></details>';
    } else if (v.status === "aguardando") {
      var soResp = (v.tipo === "treinador" && comp.menor && v.origem !== "academia") || (v.tipo === "responsavel" && comp.menor && comp.ativosResp > 0);
      h += soResp ? '<p class="nota"><strong>Falta a aprovação:</strong> como você é menor de idade, ' + (v.tipo === "treinador" ? "quem aprova o treinador" : "quem aprova mais um responsável") + " é um responsável que já está vinculado. Avise-o para abrir o app dele.</p>"
        : '<p class="nota"><strong>Confira se é a pessoa certa</strong> e toque em Aprovar. Só depois disso ela passa a ver o que você marcou.</p><div class="acoes"><button type="button" class="btn btn-primario btn-pequeno" data-dec="' + v.id + '" data-ap="1">Aprovar</button><button type="button" class="btn btn-secundario btn-pequeno" data-dec="' + v.id + '" data-ap="0">Recusar</button></div>';
      h += '<div class="acoes"><button type="button" class="btn btn-texto" data-rev="' + v.id + '">Cancelar pedido</button></div>';
    } else if (v.status === "ativo") {
      h += '<details class="det"><summary>O que é compartilhado</summary><div style="margin-top:8px">' + areasMarcadas(v.areas, "ar-" + v.id) + '<button type="button" class="btn btn-secundario btn-pequeno" data-areas="' + v.id + '">Salvar</button></div></details>' +
        '<div class="acoes"><button type="button" class="btn btn-texto" data-rev="' + v.id + '">Encerrar vínculo</button></div>';
    }
    return h + "</li>";
  }
  function vinculoComigoHtml(v) {
    var h = '<li class="comp-vinc"><p><strong>' + esc(v.atleta.nome) + "</strong> · " + (v.tipo === "treinador" ? "como treinador" : "como " + (v.parentesco && v.parentesco !== "outro" ? ROTULO_PARENT[v.parentesco].toLowerCase() + " (responsável)" : "responsável")) + '</p><p class="nota">' + esc(ROTULO_VINC[v.status] || v.status) + (v.status === "ativo" ? " · Você vê: " + esc(rotuloAreas(v.areas)) : "") + "</p>";
    if (v.status === "ativo") h += '<div class="acoes"><a class="btn btn-primario btn-pequeno" href="#/competicao/vinculo/' + v.id + '">Ver atleta</a><button type="button" class="btn btn-texto" data-rev="' + v.id + '">Encerrar vínculo</button></div>';
    else if (v.status === "aguardando") h += '<p class="nota">O atleta' + (v.tipo === "treinador" ? " (ou o responsável dele, se for menor)" : " (ou um responsável já vinculado, se ele for menor)") + " precisa aprovar.</p>" + '<div class="acoes"><button type="button" class="btn btn-texto" data-rev="' + v.id + '">Cancelar pedido</button></div>';
    return h + "</li>";
  }
  /* ── atualização automática dos vínculos ──
     Pedidos, aprovações e convites aparecem sozinhos: a cada 15 s (com o app aberto e visível) e assim que a pessoa volta para o app.
     Ninguém precisa sair e entrar. A tela de Início só é redesenhada quando não há campo sendo digitado; o resto vira aviso. */
  var vigia = { timer: null, sig: "", ocupado: false, ultimo: null, rapido: false, ligado: false };
  function haEspera(s) { return !!((s.paraDecidir || []).length || (s.meus || []).concat(s.comigo || []).some(function (v) { return v.status === "aguardando" || v.status === "convite"; })); }
  function papelGuardado() { try { return localStorage.getItem("ql-comp-papel") || "atleta"; } catch (e) { return "atleta"; } }
  function aplicarPapel(papel) {
    if (!MODO_COMP) return;
    document.body.setAttribute("data-papel", papel);
    Array.prototype.forEach.call(document.querySelectorAll("[data-papeis]"), function (el) { el.hidden = (" " + el.getAttribute("data-papeis") + " ").indexOf(" " + papel + " ") < 0; });
  }
  function definirPapel(papel) { if (!papel) return; try { localStorage.setItem("ql-comp-papel", papel); } catch (e) { /* sem armazenamento */ } aplicarPapel(papel); }
  function sigEstado(s) {
    var f = function (l) { return (l || []).map(function (v) { return v.id + ":" + v.status; }).sort().join(","); };
    return [f(s.meus), f(s.comigo), (s.paraDecidir || []).map(function (v) { return v.id; }).sort().join(",")].join("|");
  }
  function contarPendencias(s, comp) {
    if (comp.papel !== "atleta") return (s.paraDecidir || []).length;
    return (s.meus || []).filter(function (v) { return v.status === "aguardando" && !((v.tipo === "treinador" && comp.menor) || (v.tipo === "responsavel" && comp.menor && (s.meus || []).some(function (x) { return x.tipo === "responsavel" && x.status === "ativo"; }))); }).length;
  }
  function marcarBadge(n) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-nav="inicio"]'), function (el) {
      if (n) { el.setAttribute("data-badge", String(n)); el.setAttribute("aria-label", "Início, " + n + (n === 1 ? " pedido aguardando" : " pedidos aguardando")); }
      else { el.removeAttribute("data-badge"); el.removeAttribute("aria-label"); }
    });
  }
  function naTelaInicio() { return /^#?\/?(inicio|competicao)?\/?$/.test(location.hash || ""); }
  function digitando() { var a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && app.contains(a) && a.type !== "checkbox" && a.type !== "radio" && a.type !== "hidden" && a.type !== "button" && a.type !== "submit"); }
  async function vigiarVinculos(forcado) {
    if (vigia.ocupado || !MODO_COMP || !auth.currentUser || (document.hidden && !forcado)) return;
    vigia.ocupado = true;
    try {
      var s = await api("player-competicao"), comp = s.competicao; if (!comp || !comp.ativo) return;
      var nova = sigEstado(s); marcarBadge(contarPendencias(s, comp)); vigia.rapido = haEspera(s);
      if (nova === vigia.sig) return;
      /* o que mudou, em linguagem simples */
      var antes = vigia.ultimo || { meus: [], comigo: [], paraDecidir: [] }, st = function (l) { var m = {}; (l || []).forEach(function (v) { m[v.id] = v.status; }); return m; };
      var aMeus = st(antes.meus), aCom = st(antes.comigo), aDec = {}; (antes.paraDecidir || []).forEach(function (v) { aDec[v.id] = 1; });
      var msg = "";
      (s.paraDecidir || []).forEach(function (v) { if (!aDec[v.id]) msg = "Novo pedido aguardando a sua aprovação."; });
      (s.meus || []).forEach(function (v) { if (v.status === "aguardando" && aMeus[v.id] && aMeus[v.id] !== "aguardando") msg = (v.pessoa ? v.pessoa.nome : "Alguém") + " usou o código e aguarda a sua aprovação."; if (v.status === "ativo" && aMeus[v.id] === "aguardando") msg = (v.pessoa ? v.pessoa.nome : "A pessoa") + " foi aprovada."; });
      (s.comigo || []).forEach(function (v) { if (v.status === "ativo" && aCom[v.id] && aCom[v.id] !== "ativo") msg = "Aprovado! Você já acompanha " + v.atleta.nome + "."; if ((v.status === "revogado" || v.status === "recusado") && aCom[v.id] && aCom[v.id] !== v.status) msg = "O vínculo com " + v.atleta.nome + " foi " + (v.status === "recusado" ? "recusado" : "encerrado") + "."; });
      if (!vigia.ultimo) msg = ""; // primeira leitura: só guarda
      vigia.ultimo = s;
      if (msg) toast(msg);
      if (naTelaInicio() && !digitando()) { vigia.sig = nova; telaCompeticao(); }
      else if (!naTelaInicio()) vigia.sig = nova; // fora do Início: a tela busca tudo de novo quando a pessoa voltar
    } catch (e) { /* sem conexão: tenta de novo no próximo ciclo */ }
    finally { vigia.ocupado = false; }
  }
  function agendarVigia() {
    clearTimeout(vigia.timer);
    vigia.timer = setTimeout(async function () {
      if (!auth.currentUser) { vigia.timer = null; return; }
      await vigiarVinculos(false); agendarVigia();
    }, vigia.rapido ? 6000 : 20000); // com convite ou pedido em aberto, olha a cada 6 s; senão, a cada 20 s
  }
  function iniciarVigia() {
    if (!MODO_COMP) return;
    if (!vigia.ligado) {
      vigia.ligado = true;
      document.addEventListener("visibilitychange", function () { if (!document.hidden) vigiarVinculos(true); });
      window.addEventListener("focus", function () { vigiarVinculos(true); });
      window.addEventListener("online", function () { vigiarVinculos(true); });
    }
    agendarVigia();
  }
  /* cartão do atleta no Início do responsável/treinador: semana, próximo torneio, última partida e scout */
  async function preencherCartoesAtleta(s) {
    Array.prototype.forEach.call(app.querySelectorAll(".atleta-card[data-vinc]"), async function (cx) {
      var id = cx.getAttribute("data-vinc"), corpo = cx.querySelector(".atleta-card-corpo"), r, pl = null;
      try { r = await api("player-competicao?ver=" + encodeURIComponent(id)); } catch (e) { corpo.innerHTML = '<p class="nota">Não foi possível carregar agora: ' + esc(e.message) + "</p>"; corpo.removeAttribute("aria-busy"); return; }
      if (r.areas.indexOf("planejamento") >= 0) { try { pl = await api("comp-planejamento?ver=" + encodeURIComponent(id)); } catch (e) { pl = null; } }
      var h = "", d = r.dados || {};
      if (pl && pl.semana) {
        var sem = pl.semana, hoje = pl.hoje, ats = (sem.atividades || []).filter(function (a) { return a.data >= hoje; }).slice(0, 3);
        h += '<div class="ac-bloco"><p class="olho">Atividades da semana</p><p><strong>' + esc(sem.objetivo || "Objetivo a definir") + "</strong></p>" + (ats.length ? '<ul class="beneficios">' + ats.map(function (a) { return "<li><strong>" + esc(dataCurta(a.data)) + ":</strong> " + esc(a.titulo) + (a.minutos ? " · " + a.minutos + " min" : "") + "</li>"; }).join("") + "</ul>" : '<p class="nota">Sem atividade prevista nos próximos dias.</p>') + '<div class="acoes"><a class="btn btn-secundario btn-pequeno" href="#/planejamento/atleta/' + esc(id) + '">Ver o planejamento</a></div></div>';
      } else if (r.areas.indexOf("planejamento") >= 0) { h += '<div class="ac-bloco"><p class="olho">Atividades da semana</p><p class="nota">O planejamento ainda não foi criado.</p></div>'; }
      if (d.torneios) {
        var prox = d.torneios.filter(function (t) { return t.fase !== "passado" && t.estado !== "desistiu"; })[0];
        h += '<div class="ac-bloco"><p class="olho">Próximo torneio</p>' + (prox ? "<p><strong>" + esc(prox.nome) + '</strong></p><p class="nota">' + esc(quandoTorneio(prox)) + (prox.cidade ? " · " + esc(prox.cidade) : "") + "</p>" : '<p class="nota">Nenhum torneio cadastrado.</p>') + "</div>";
      }
      if (d.scouts) {
        var sc = d.scouts[0];
        h += '<div class="ac-bloco"><p class="olho">Scout do treinador</p>' + (sc ? "<p><strong>" + esc(sc.rotulo) + '</strong></p><p class="nota">' + sc.resumo.pctGanhos + "% dos pontos ganhos · " + esc(dataCurta(sc.data)) + '</p><div class="acoes"><a class="btn btn-secundario btn-pequeno" href="#/competicao/vinculo/' + esc(id) + "/scout/" + esc(sc.id) + '">Ver o jogo completo</a></div>' : '<p class="nota">Nenhum scout compartilhado ainda. Para ver um jogo ao vivo, toque em “Jogo ao vivo”.</p>') + "</div>";
      }
      if (d.partidas && d.partidas.length) { var p0 = d.partidas[0]; h += '<div class="ac-bloco"><p class="olho">Última partida</p><p><strong>' + (p0.resultado === "vitoria" ? "Vitória" : "Derrota") + (p0.adversario ? " contra " + esc(p0.adversario) : "") + '</strong></p><p class="nota">' + esc(dataCurta(p0.data)) + (p0.placar ? " · " + esc(p0.placar) : "") + "</p></div>"; }
      corpo.innerHTML = h || '<p class="nota">O atleta ainda não compartilhou nada com você.</p>'; corpo.removeAttribute("aria-busy");
    });
  }

  /* ══ Competição: jogos ao vivo ligados ao atleta (automático pelo vínculo) e abas do treinador ══ */
  var aoVivoVisto = {};
  function jogosAoVivoHtml(jogos, titulo) {
    return '<section class="cartao comp-alerta" id="aoVivoAgora" style="margin-top:14px"><p class="olho"><span class="ponto-vivo" aria-hidden="true"></span> ' + (titulo || "Ao vivo agora") + '</p><ul class="comp-lista">' + jogos.map(function (j) {
      return '<li class="comp-vinc"><p><strong>' + esc(j.atleta) + "</strong>" + (j.resultado ? " · " + esc(j.resultado) : "") + (j.torneio ? '</p><p class="nota">' + esc(j.torneio) : "") + '</p><div class="acoes"><a class="btn btn-primario btn-pequeno" href="#/ao-vivo/' + esc(j.token) + '">Acompanhar agora</a></div></li>';
    }).join("") + "</ul></section>";
  }
  async function carregarJogosAoVivo(destino, avisar) {
    var r;
    try { r = await api("player-competicao?aoVivo=1"); } catch (e) { return; }
    if (!destino || !document.body.contains(destino)) return;
    var jogos = (r.jogos || []).filter(function (j) { return j.aoVivo; });
    if (!jogos.length) { destino.innerHTML = avisar ? "" : '<p class="nota" style="margin-top:12px">Nenhum jogo ao vivo ligado a você agora.</p>'; return; }
    destino.innerHTML = jogosAoVivoHtml(jogos);
    if (avisar) { var novos = jogos.filter(function (j) { return !aoVivoVisto[j.token]; }); jogos.forEach(function (j) { aoVivoVisto[j.token] = 1; }); if (novos.length) toast("Jogo ao vivo agora: " + novos[0].atleta + "."); }
  }
  /* faixa "Ao vivo agora" no topo do Início (atleta, responsável e treinador) */
  function mostrarAoVivoAgora() {
    if (!/^#?\/?(inicio|competicao)?\/?$/.test(location.hash)) return;
    var ja = document.getElementById("aoVivoFaixa"); if (ja) return;
    var d = document.createElement("div"); d.id = "aoVivoFaixa"; app.insertBefore(d, app.firstChild);
    carregarJogosAoVivo(d, true);
  }
  async function vinculosAtivosTreinador() {
    var s = await api("player-competicao");
    return s.comigo.filter(function (v) { return v.tipo === "treinador" && v.status === "ativo"; });
  }
  var VOLTAR_INICIO = '<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/inicio">‹ Início</a></p>';
  async function telaRecomendacoes() {
    tela('<p class="carregando">Carregando…</p>', true);
    var vs, rs;
    try { vs = await vinculosAtivosTreinador(); rs = await Promise.all(vs.map(function (v) { return api("player-competicao?ver=" + encodeURIComponent(v.id)).catch(function () { return null; }); })); }
    catch (e) { tela(VOLTAR_INICIO + '<div class="aviso">' + esc(e.message) + "</div>"); return; }
    function antigas(r) { return (r.devolutivas || []).filter(function (d) { return d.tipo === "recomendacao"; }).slice(0, 3); }
    tela(VOLTAR_INICIO + '<h1>Recomendações</h1><p class="sub">Recomende o que quiser ao seu atleta: um treino, uma leitura, um vídeo, um hábito, um ajuste. Só o atleta (e o responsável, se for menor) lê.</p>' +
      (vs.length ? vs.map(function (v, i) {
        var r = rs[i]; if (!r) return '<section class="cartao"><h2>' + esc(v.atleta.nome) + '</h2><p class="nota">Não foi possível carregar agora.</p></section>';
        var ant = antigas(r);
        return '<section class="cartao rec-card" data-rec="' + esc(v.id) + '"><h2>' + esc(r.atleta.nome) + "</h2>" +
          '<form class="rec-form" novalidate><div class="campo"><label for="recAss-' + esc(v.id) + '">Assunto <span class="nota">(opcional)</span></label><input id="recAss-' + esc(v.id) + '" maxlength="80" placeholder="Ex.: Rotina antes do saque"></div>' +
          '<div class="campo"><label for="recTxt-' + esc(v.id) + '">Recomendação</label><textarea id="recTxt-' + esc(v.id) + '" rows="5" maxlength="2000" placeholder="Escreva livremente o que você recomenda."></textarea><p class="nota rec-cont" style="margin-top:4px">0 de 2000 caracteres</p></div>' +
          '<div class="campo"><label for="recFoco-' + esc(v.id) + '">Foco de treino sugerido <span class="nota">(opcional)</span></label><input id="recFoco-' + esc(v.id) + '" maxlength="200" placeholder="Ex.: primeiro saque em 65%"></div>' +
          '<div class="aviso rec-aviso" role="alert" hidden></div><div class="acoes"><button class="btn btn-primario" type="submit">Enviar recomendação</button></div></form>' +
          (ant.length ? '<p class="olho" style="margin-top:14px">Enviadas por você</p>' + ant.map(function (d) {
            return '<div class="comp-dev-bloco"><span class="nota">' + esc(dataCurta(String(d.criadoEm).slice(0, 10))) + (d.assunto ? " · " + esc(d.assunto) : "") + '</span><span style="display:block;white-space:pre-wrap">' + esc(olharResumo(d.recomendacao || d.melhorar || d.destaques || d.foco, 220)) + '</span><button type="button" class="btn btn-texto" data-exrec="' + esc(d.id) + '">Excluir</button></div>';
          }).join("") : "") +
          (r.referencias ? '<p class="nota" style="margin-top:12px">Quer comentar um torneio ou uma partida específica? <a href="#/competicao/vinculo/' + esc(v.id) + '">Escrever devolutiva do jogo</a>.</p>' : "") + "</section>";
      }).join("") : '<div class="cartao" style="margin-top:14px"><h2>Nenhum atleta vinculado</h2><p class="nota" style="margin-top:6px">Use o código de convite do atleta em <a href="#/inicio">Início</a>. Quando ele aprovar, você recomenda daqui.</p></div>'));
    Array.prototype.forEach.call(app.querySelectorAll(".rec-card"), function (cx) {
      var id = cx.getAttribute("data-rec"), f = cx.querySelector(".rec-form"), txt = f.querySelector("textarea"), cont = f.querySelector(".rec-cont"), av = f.querySelector(".rec-aviso"), bt = f.querySelector("button[type=submit]");
      txt.addEventListener("input", function () { cont.textContent = txt.value.length + " de 2000 caracteres"; av.hidden = true; });
      f.addEventListener("submit", async function (ev) {
        ev.preventDefault(); av.hidden = true;
        if (txt.value.trim().length < 5) { av.textContent = "Escreva a recomendação."; av.hidden = false; txt.focus(); return; }
        ocupado(bt, true, "Enviando…");
        try { await api("player-competicao", { metodo: "POST", corpo: { acao: "devolutiva", id: id, tipo: "recomendacao", assunto: f.querySelector("input").value, recomendacao: txt.value, foco: f.querySelectorAll("input")[1].value } }); toast("Recomendação enviada."); telaRecomendacoes(); }
        catch (e) { ocupado(bt, false); av.textContent = e.message; av.hidden = false; }
      });
      Array.prototype.forEach.call(cx.querySelectorAll("[data-exrec]"), function (b) { b.addEventListener("click", async function () {
        if (!window.confirm("Excluir esta recomendação?")) return;
        try { await api("player-competicao", { metodo: "POST", corpo: { acao: "excluirDevolutiva", id: id, devolutivaId: b.getAttribute("data-exrec") } }); telaRecomendacoes(); } catch (e) { toast(e.message, null, true); }
      }); });
    });
  }
  async function telaTreinosSugeridos() {
    tela('<p class="carregando">Carregando…</p>', true);
    var vs, rs;
    try { vs = await vinculosAtivosTreinador(); rs = await Promise.all(vs.map(function (v) { return api("player-competicao?ver=" + encodeURIComponent(v.id)).catch(function () { return null; }); })); }
    catch (e) { tela(VOLTAR_INICIO + '<div class="aviso">' + esc(e.message) + "</div>"); return; }
    tela(VOLTAR_INICIO + '<h1>Treinos sugeridos</h1><p class="sub">Os focos que você sugeriu, o que o atleta já está treinando e o planejamento da semana de cada um.</p>' +
      (vs.length ? vs.map(function (v, i) {
        var r = rs[i]; if (!r) return '<section class="cartao"><h2>' + esc(v.atleta.nome) + '</h2><p class="nota">Não foi possível carregar agora.</p></section>';
        var meus = (r.devolutivas || []).filter(function (d) { return d.foco; }).slice(0, 3), focos = (r.dados.focos || []).filter(function (f) { return f.status !== "resolvido"; }).slice(0, 4), plan = r.areas.indexOf("planejamento") >= 0;
        return '<section class="cartao"><h2>' + esc(r.atleta.nome) + "</h2>" +
          '<div class="ac-bloco"><p class="olho">Focos que você sugeriu</p>' + (meus.length ? '<ul class="beneficios">' + meus.map(function (d) { return "<li>" + esc(d.foco) + ' <span class="nota">(' + esc(dataCurta(String(d.criadoEm).slice(0, 10))) + ")</span></li>"; }).join("") + "</ul>" : '<p class="nota">Nenhum foco sugerido ainda. Escreva uma recomendação com “Foco de treino sugerido”.</p>') + "</div>" +
          (r.dados.focos ? '<div class="ac-bloco"><p class="olho">O atleta está trabalhando</p>' + (focos.length ? '<ul class="beneficios">' + focos.map(function (f) { return "<li>" + esc(f.texto) + ' <span class="nota">· ' + esc(STATUS_FOCO_ROT[f.status] || "") + "</span></li>"; }).join("") + "</ul>" : '<p class="nota">Nenhum foco em andamento.</p>') + "</div>" : "") +
          '<div class="acoes">' + (plan ? '<a class="btn btn-primario" href="#/planejamento/atleta/' + esc(v.id) + '">Planejar a semana</a>' : "") + '<a class="btn btn-secundario" href="#/competicao/vinculo/' + esc(v.id) + '">Abrir o atleta</a></div>' + (plan ? "" : '<p class="nota">O atleta não liberou “Meu planejamento” para você.</p>') + "</section>";
      }).join("") : '<div class="cartao" style="margin-top:14px"><h2>Nenhum atleta vinculado</h2><p class="nota" style="margin-top:6px">Use o código de convite do atleta em <a href="#/inicio">Início</a>.</p></div>'));
  }

  /* ══ Competição: o responsável marca o jogo (mesmo scout do treinador) quando o treinador não vai ══
     Usa player/scout-motor.js, gerado do scout do treinador: mesmo placar, mesmo saque/lado/ace, mesmos números. */
  async function telaScoutFamilia(vid) {
    pararAoVivo();
    var M = window.QLScoutMotor, chave = "ql-scout-fam2:" + vid, st, r;
    var voltar = '<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/competicao/vinculo/' + esc(vid) + '">‹ Atleta</a></p>';
    if (!M) { tela(voltar + '<div class="aviso">Não foi possível carregar o scout. Recarregue a página.</div>'); return; }
    tela('<p class="carregando">Carregando…</p>', true);
    try { r = await api("player-competicao?ver=" + encodeURIComponent(vid)); } catch (e) { tela(voltar + '<div class="aviso">' + esc(e.message) + "</div>"); return; }
    if (r.areas.indexOf("partidas") < 0) { tela(voltar + '<div class="aviso">Marcar o jogo está disponível com a área “Partidas” liberada pelo atleta.</div>'); return; }
    var souTreinador = !!r.referencias;
    var anteriores = ((r.dados && r.dados.scouts) || []).filter(function (x) { return x.resumo; }).map(function (x) { return Object.assign({}, x.resumo, x.resumo.numeros, x.resumo.bolas); });
    try { st = JSON.parse(localStorage.getItem(chave) || "null"); } catch (e) { st = null; }
    var CFG0 = { torneio: "", formato: "3sets", saca: "nos", semVantagem: false, superTiebreakDecisivo: false };
    if (!st || typeof st !== "object" || !Array.isArray(st.pontos) || !st.cfg) st = { cfg: CFG0, pontos: [], token: null, fim: false, iniciado: false };
    if (!st.mental) st.mental = { antes: {}, jogo: {}, depois: {} };
    var atleta = r.atleta.nome || "Atleta", primeiro = String(atleta).split(" ")[0], rasc = null, tmr = null, enviando = false, erro = false, dirS = null;
    function salvar() { try { localStorage.setItem(chave, JSON.stringify(st)); } catch (e) { /* sem armazenamento */ } }
    function placarAtual() { var c = st.cfg, e = M.placarInicial(c.formato, c.saca, c.semVantagem, c.superTiebreakDecisivo); st.pontos.forEach(function (p) { e = M.aplicaPonto(e, p.nos); }); return e; }
    function resumo(placar) {
      var c = st.cfg, rr = M.resume(st.pontos), sets = placar.sets.map(function (x) { return x[0] + "-" + x[1]; });
      if (!placar.fim && (placar.g[0] || placar.g[1])) sets.push(placar.g[0] + "-" + placar.g[1]);
      return M.montarResumoPublico({ data: new Date().toISOString().slice(0, 10), torneio: c.torneio || "", resultado: sets.join(" "), concluida: !!(placar.fim || st.fim), observacaoFinal: st.observacaoFinal || "", nivelAdversario: st.nivelAdversario || "", mental: st.mental,
        scout: Object.assign({}, rr, { pontos: st.pontos, cfg: { formato: c.formato, saca: c.saca, semVantagem: !!c.semVantagem, superTiebreakDecisivo: !!c.superTiebreakDecisivo } }) }, { nome: atleta });
    }
    async function enviar() {
      if (enviando) { tmr = setTimeout(enviar, 700); return; }
      enviando = true;
      try {
        var pl = placarAtual(), fim = !!(pl.fim || st.fim);
        if (!st.token) { var c = await api("scout-ao-vivo", { metodo: "POST", corpo: { acao: "iniciar", vinculoId: vid, resumo: resumo(pl) } }); st.token = c.token; if (fim) await api("scout-ao-vivo", { metodo: "POST", corpo: { acao: "atualizar", token: st.token, resumo: resumo(pl), fim: true } }); }
        else await api("scout-ao-vivo", { metodo: "POST", corpo: { acao: "atualizar", token: st.token, resumo: resumo(pl), fim: fim } });
        erro = false; salvar();
      } catch (e) { erro = e.message || true; }
      enviando = false; estadoEnvio();
    }
    function agendar() { clearTimeout(tmr); salvar(); estadoEnvio(); tmr = setTimeout(enviar, 600); }
    function estadoEnvio() {
      var el = document.getElementById("sfEnvio"); if (!el) return;
      var fim = st.fim || (st.iniciado && placarAtual().fim);
      el.className = "nota" + (erro ? " sf-erro" : ""); el.textContent = erro ? "Não foi possível enviar agora (" + (typeof erro === "string" ? erro : "sem conexão") + "). Os pontos estão salvos neste aparelho; toque em “Enviar agora”." : fim ? "Partida encerrada. O resultado fica visível por mais 2 horas." : st.token ? "Ao vivo: o atleta, os responsáveis e o treinador veem cada ponto." : "Marque o primeiro ponto para abrir o jogo ao vivo.";
    }
    function botao(rot, cls, attrs) { return '<button type="button" class="btn ' + cls + '" ' + attrs + ">" + rot + "</button>"; }
    function seg(nome, valor, ops) { return '<div class="comp-seg" role="group">' + ops.map(function (o) { return '<button type="button" class="comp-seg-bt" data-cfg="' + nome + '" data-v="' + o[0] + '" aria-pressed="' + (String(valor) === String(o[0])) + '">' + o[1] + "</button>"; }).join("") + "</div>"; }
    var FIM_ROT = [["winner_nos", "Winner de " + primeiro, true], ["erro_dele", "Erro do adversário", true], ["erro_nos", "Erro de " + primeiro, false], ["winner_dele", "Winner do adversário", false]];

    function escalaHtml(grupo, chave, rotulo, valor) {
      return '<p class="olho" style="margin-top:10px">' + esc(rotulo) + '</p><div class="sf-chips" role="group" aria-label="' + esc(rotulo) + '">' + [1, 2, 3, 4, 5].map(function (v) { return botao((valor === v ? "✓ " : "") + v, "btn-secundario btn-pequeno", 'data-ment="' + grupo + '" data-mk="' + chave + '" data-mv="' + v + '" aria-pressed="' + (valor === v) + '"'); }).join("") + "</div>";
    }
    function mentalCartaoHtml(grupo, titulo, nota) {
      var vals = st.mental[grupo] || {};
      return '<section class="cartao" style="margin-top:12px"><p class="olho">' + esc(titulo) + '</p><p class="nota">' + esc(nota) + "</p>" + M.ESCALAS_MENTAIS.map(function (e) { return escalaHtml(grupo, e[0], e[1], vals[e[0]] || 0); }).join("") + "</section>";
    }
    function telaConfig() {
      var c = st.cfg;
      tela(voltar + "<h1>Marcar o jogo de " + esc(primeiro) + '</h1><p class="sub">' + (souTreinador ? "Marque os pontos do jogo. Aparece ao vivo no app do atleta e dos responsáveis." : "O mesmo scout do treinador, para quando ele não pôde ir. Aparece ao vivo no app do atleta, dos responsáveis e do treinador vinculado.") + '</p>' +
        '<section class="cartao"><div class="campo"><label for="sfTorneio">Torneio (opcional)</label><input id="sfTorneio" maxlength="80" value="' + esc(c.torneio) + '" placeholder="Torneio ou jogo-treino"></div>' +
        '<p class="olho">Formato</p>' + seg("formato", c.formato, [["3sets", "Melhor de 3 sets"], ["1set", "Set único"], ["4games", "Set a 4 games"], ["tb7", "Só tie-break (7)"], ["tb10", "Match tie-break (10)"]]) +
        '<p class="olho" style="margin-top:12px">Quem saca primeiro</p>' + seg("saca", c.saca, [["nos", esc(primeiro)], ["ele", "Adversário"]]) +
        (c.formato === "tb7" || c.formato === "tb10" ? '<p class="nota" style="margin-top:12px">' + (c.formato === "tb10" ? "A partida é um único match tie-break de 10 pontos" : "A partida é um único tie-break de 7 pontos") + ", com 2 de diferença. O saque troca a cada 2 pontos.</p>" :
        '<p class="olho" style="margin-top:12px">Pontuação</p><div class="acoes">' + botao((c.semVantagem ? "✓ " : "") + "Ponto decisivo em 40-40 (sem vantagem)", "btn-secundario btn-pequeno", 'data-tog="semVantagem" aria-pressed="' + !!c.semVantagem + '"') +
        (c.formato === "3sets" ? botao((c.superTiebreakDecisivo ? "✓ " : "") + "Super tie-break (10 pontos) no set decisivo", "btn-secundario btn-pequeno", 'data-tog="superTiebreakDecisivo" aria-pressed="' + !!c.superTiebreakDecisivo + '"') : "") + "</div>") +
        mentalCartaoHtml("antes", "Avaliação mental antes do jogo", "Como o atleta chega, de 1 (muito baixo) a 5 (muito alto). Opcional.") +
        '<div class="acoes" style="margin-top:14px"><button type="button" class="btn btn-primario btn-grande" id="sfIniciar">Iniciar acompanhamento</button></div></section>' +
        '<p class="nota" style="margin-top:12px">O nome do adversário e anotações nunca são enviados. Só o primeiro nome do atleta, o placar e os números.</p>');
      document.getElementById("sfTorneio").addEventListener("input", function (e) { st.cfg.torneio = e.target.value.slice(0, 80); salvar(); });
      Array.prototype.forEach.call(app.querySelectorAll("[data-cfg]"), function (b) { b.addEventListener("click", function () { st.cfg[b.getAttribute("data-cfg")] = b.getAttribute("data-v"); if (st.cfg.formato !== "3sets") st.cfg.superTiebreakDecisivo = false; if (st.cfg.formato === "tb7" || st.cfg.formato === "tb10") st.cfg.semVantagem = false; salvar(); telaConfig(); }); });
      Array.prototype.forEach.call(app.querySelectorAll("[data-ment]"), function (b) { b.addEventListener("click", function () { var g = b.getAttribute("data-ment"), k = b.getAttribute("data-mk"), v = +b.getAttribute("data-mv"); st.mental[g][k] = st.mental[g][k] === v ? 0 : v; salvar(); telaConfig(); }); });
      Array.prototype.forEach.call(app.querySelectorAll("[data-tog]"), function (b) { b.addEventListener("click", function () { var k = b.getAttribute("data-tog"); st.cfg[k] = !st.cfg[k]; salvar(); telaConfig(); }); });
      document.getElementById("sfIniciar").addEventListener("click", function () { st.iniciado = true; st.pontos = []; st.token = null; st.fim = false; salvar(); rasc = null; desenhar(); });
    }

    function adicionar(p) {
      var pl = placarAtual(); p.n = st.pontos.length + 1; p.placarAntes = M.rotuloPontos(pl); p.jogo = M.numeroDoGame(pl); p.set = M.numeroDoSet(pl); st.pontos.push(p); rasc = null; dirS = null; desenhar(); agendar();
    }
    function saqueDireto(tipo) {
      var pl = placarAtual(), sacador = M.quemSaca(pl), meu = sacador === "nos", nos = tipo === "ace" ? meu : !meu;
      adicionar({ fim: tipo === "ace" ? (meu ? "winner_nos" : "winner_dele") : (meu ? "erro_nos" : "erro_dele"), nos: nos, saque: tipo, bola: "1-2", causa: tipo === "df" && meu ? "execucao" : null, rede: false, situacao: null, dirSaque: tipo === "ace" ? dirS : null, adverso: M.ehAdverso(pl), sacador: sacador, lado: M.ladoDoSaque(pl) });
    }

    function desenhar() {
      var pl = placarAtual(), fimJogo = !!(pl.fim || st.fim), sacador = M.quemSaca(pl), meu = sacador === "nos", adv = M.ehAdverso(pl), n = st.pontos.length;
      var sets = pl.sets.map(function (x) { return x[0] + "-" + x[1]; }).concat([pl.g[0] + "-" + pl.g[1]]).join("  ");
      var h = voltar + '<section class="sf-cab"><div><p class="sf-cab-l">' + esc((meu ? "SAQUE DE " + primeiro : "SAQUE DO ADVERSÁRIO").toUpperCase()) + " · " + esc(M.ROTULO_LADO[M.ladoDoSaque(pl)].toUpperCase()) + '</p><p class="sf-cab-n">' + esc(M.rotuloPontos(pl)) + '</p></div><div class="sf-cab-d"><p class="sf-cab-l">SETS</p><p class="sf-cab-s">' + esc(sets) + "</p></div></section>" +
        (adv && !fimJogo ? '<p class="sf-adverso">PLACAR ADVERSO — este ponto entra na comparação</p>' : "") + (pl.fim ? '<div class="aviso">Partida encerrada: ' + esc(primeiro) + (pl.vencedor === "nos" ? " venceu" : " perdeu") + ".</div>" : "");
      if (!fimJogo && window.QLAoVivo && st.pontos.length) h += window.QLAoVivo.momento(st.pontos, { jogoAtual: M.numeroDoGame(placarAtual()), setAtual: M.numeroDoSet(placarAtual()) }) + (st.pontos.length >= 2 ? window.QLAoVivo.macro(st.pontos, { jogoAtual: M.numeroDoGame(placarAtual()) }) : "");
      if (!fimJogo && window.QLAoVivo) h += window.QLAoVivo.faixaAlerta(st.pontos, primeiro, anteriores);
      if (!fimJogo) {
        if (!rasc) {
          h += '<section class="cartao"><p class="olho">Mental no game ' + M.numeroDoGame(pl) + ' (opcional)</p><div class="sf-chips" role="group" aria-label="Mental no game">' + [1, 2, 3, 4, 5].map(function (v) { var at = (st.mental.jogo || {})[M.numeroDoGame(pl)] || 0; return botao((at === v ? "✓ " : "") + v, "btn-secundario btn-pequeno", 'data-mjogo="' + v + '" aria-pressed="' + (at === v) + '"'); }).join("") + "</div></section>";
          h += '<section class="cartao"><p class="olho">' + (meu ? "Saque (opcional)" : "Saque do adversário (opcional)") + '</p><div class="sf-chips" role="group" aria-label="Direção do saque">' + M.DIRECOES_SAQUE.map(function (x) { return botao((dirS === x[0] ? "✓ " : "") + x[1], "btn-secundario btn-pequeno", 'data-dsq="' + x[0] + '" aria-pressed="' + (dirS === x[0]) + '"'); }).join("") + '<span class="nota">direção do saque</span></div><div class="sf-grade4" style="margin-top:8px">' + [["1", "1º dentro"], ["2", "2º dentro"], ["ace", meu ? "Ace" : "Ace dele"], ["df", meu ? "Dupla falta" : "Dupla falta dele"]].map(function (x) { return botao(x[1], "btn-secundario sf-pq", 'data-saq="' + x[0] + '"'); }).join("") + "</div></section>";
        }
        if (!rasc || !rasc.fim) {
          h += '<section class="cartao" style="margin-top:12px"><p class="olho">Como o ponto terminou</p><div class="sf-grade">' + FIM_ROT.map(function (o) { return botao(esc(o[1]), o[2] ? "btn-primario sf-bt" : "btn-secundario sf-bt", 'data-fim="' + o[0] + '"'); }).join("") + "</div></section>";
        } else {
          h += '<section class="cartao sf-rasc"><p class="olho">' + esc(FIM_ROT.filter(function (o) { return o[0] === rasc.fim; })[0][1]) + "</p>" +
            (rasc.fim === "erro_nos" ? '<p class="olho" style="margin-top:8px">A causa</p>' + seg("causa", rasc.causa || "", [["decisao", "Decisão"], ["execucao", "Execução"]]) : "") +
            '<p class="olho" style="margin-top:10px">Como foi o ponto (opcional)</p><div class="sf-chips">' + M.SITUACOES.map(function (x) { return botao((rasc.situacao === x[0] ? "✓ " : "") + x[1], "btn-secundario btn-pequeno", 'data-sit="' + x[0] + '" aria-pressed="' + (rasc.situacao === x[0]) + '"'); }).join("") + botao((rasc.rede ? "✓ " : "") + "Subiu à rede", "btn-secundario btn-pequeno", 'data-rede="1" aria-pressed="' + !!rasc.rede + '"') + "</div>" +
            '<p class="olho" style="margin-top:10px">Decisão de ' + esc(primeiro) + ' neste ponto (opcional)</p><div class="sf-chips">' + M.DECISOES.map(function (x) { return botao((rasc.dec === x[0] ? "✓ " : "") + x[1], "btn-secundario btn-pequeno", 'data-dec="' + x[0] + '" aria-pressed="' + (rasc.dec === x[0]) + '"'); }).join("") + "</div>" +
            (rasc.sacador === "ele" && rasc.saque !== "df" && rasc.saque !== "ace" ? '<p class="olho" style="margin-top:10px">Qualidade da devolução de ' + esc(primeiro) + ' (opcional)</p><div class="sf-chips">' + M.QUALIDADES_DEVOLUCAO.map(function (x) { return botao((rasc.qualDev === x[0] ? "✓ " : "") + x[1], "btn-secundario btn-pequeno", 'data-qdev="' + x[0] + '" aria-pressed="' + (rasc.qualDev === x[0]) + '"'); }).join("") + "</div>" : "") +
            '<p class="olho" style="margin-top:10px">Qual foi o último golpe de ' + esc(primeiro) + ' (opcional)</p><div class="sf-chips">' + M.GOLPES.map(function (x) { return botao((rasc.golpe === x[0] ? "✓ " : "") + x[1], "btn-secundario btn-pequeno", 'data-golpe="' + x[0] + '" aria-pressed="' + (rasc.golpe === x[0]) + '"'); }).join("") + "</div>" +
            '<div class="sf-chips" style="margin-top:8px">' + botao((rasc.corrida ? "✓ " : "") + "Na corrida", "btn-secundario btn-pequeno", 'data-corrida="1" aria-pressed="' + !!rasc.corrida + '"') + M.DIRECOES.map(function (x) { return botao((rasc.direcao === x[0] ? "✓ " : "") + x[1], "btn-secundario btn-pequeno", 'data-direcao="' + x[0] + '" aria-pressed="' + (rasc.direcao === x[0]) + '"'); }).join("") + "</div>" +
            '<p class="olho" style="margin-top:10px">Onde foi o último golpe de ' + esc(primeiro) + ' (opcional)</p><div class="sf-grade3">' + M.ZONAS.map(function (z) { return botao((rasc.zona === z[0] ? "✓ " : "") + z[1], "btn-secundario btn-pequeno", 'data-zona="' + z[0] + '" aria-pressed="' + (rasc.zona === z[0]) + '"'); }).join("") + "</div>" +
            '<p class="olho" style="margin-top:10px">Em que bola o ponto terminou</p><div class="sf-grade3">' + ["1-2", "3-4", "5+"].map(function (b) { return botao(b, "btn-primario sf-bt", 'data-bola="' + b + '"'); }).join("") + "</div></section>";
        }
      }
      var gan = st.pontos.filter(function (p) { return p.nos; }).length;
      if (window.QLAoVivo) h += '<details class="cartao sf-analise" style="margin-top:12px"' + (st.analiseAberta ? " open" : "") + '><summary><strong>Análise ao vivo</strong> · ' + n + (n === 1 ? " ponto" : " pontos") + "</summary>" + window.QLAoVivo.painel(st.pontos, { atleta: primeiro, mental: st.mental, semGraficosFixos: true, anteriores: anteriores }) + "</details>";
      h += '<section class="cartao" style="margin-top:12px"><p class="sf-n"><strong>' + n + "</strong> pontos · " + esc(primeiro) + " ganhou <strong>" + gan + "</strong>" + (n ? " (" + Math.round(gan * 100 / n) + "%)" : "") + '</p>' + mentalCartaoHtml("depois", "Avaliação mental depois do jogo", "Como o atleta termina, de 1 a 5. Opcional.") + '<div class="campo" style="margin-top:12px"><label for="sfNivel">Nível do adversário <span class="nota">(opcional, no fim da partida)</span></label><select id="sfNivel"><option value="">Não informar</option>' + M.NIVEIS_ADVERSARIO.map(function (x) { return '<option value="' + x[0] + '"' + (st.nivelAdversario === x[0] ? " selected" : "") + ">" + esc(x[1]) + "</option>"; }).join("") + '</select></div><div class="campo" style="margin-top:12px"><label for="sfObs">Observação final <span class="nota">(opcional)</span></label><textarea id="sfObs" rows="3" maxlength="1200" placeholder="Um recado sobre o jogo. Aparece na página de quem acompanha.">' + esc(st.observacaoFinal || "") + '</textarea></div><p id="sfEnvio" class="nota"></p>' +
        '<div class="acoes"><button type="button" class="btn btn-texto" id="sfDesfazer"' + (n || rasc ? "" : " disabled") + '>Desfazer</button><button type="button" class="btn btn-secundario" id="sfEnviar">Enviar agora</button>' +
        (fimJogo ? '<button type="button" class="btn btn-secundario" id="sfNovo">Novo jogo</button>' : '<button type="button" class="btn btn-laranja" id="sfFim">Encerrar partida</button>') + "</div></section>" +
        '<p class="nota" style="margin-top:12px">O nome do adversário e anotações nunca são enviados. A análise completa continua sendo a do treinador.</p>';
      tela(h);
      var q = function (sel, f) { Array.prototype.forEach.call(app.querySelectorAll(sel), f); };
      q("[data-dsq]", function (b) { b.addEventListener("click", function () { var v = b.getAttribute("data-dsq"); dirS = dirS === v ? null : v; desenhar(); }); });
      q("[data-saq]", function (b) { b.addEventListener("click", function () { var v = b.getAttribute("data-saq"); if (v === "df" || v === "ace") saqueDireto(v); else { rasc = { saquePre: v }; desenhar(); } }); });
      q("[data-fim]", function (b) { b.addEventListener("click", function () { var f = FIM_ROT.filter(function (o) { return o[0] === b.getAttribute("data-fim"); })[0], p = placarAtual(); rasc = Object.assign({}, rasc || {}, { fim: f[0], nos: f[2], saque: (rasc && rasc.saquePre) || null, bola: null, causa: null, rede: false, situacao: null, golpe: null, corrida: false, direcao: null, qualDev: null, dec: null, dirSaque: dirS, adverso: M.ehAdverso(p), sacador: M.quemSaca(p), lado: M.ladoDoSaque(p) }); desenhar(); }); });
      q("[data-cfg=causa]", function (b) { b.addEventListener("click", function () { rasc.causa = b.getAttribute("data-v"); desenhar(); }); });
      q("[data-sit]", function (b) { b.addEventListener("click", function () { var v = b.getAttribute("data-sit"); rasc.situacao = rasc.situacao === v ? null : v; desenhar(); }); });
      q("[data-golpe]", function (b) { b.addEventListener("click", function () { var v = b.getAttribute("data-golpe"); rasc.golpe = rasc.golpe === v ? null : v; desenhar(); }); });
      q("[data-corrida]", function (b) { b.addEventListener("click", function () { rasc.corrida = !rasc.corrida; desenhar(); }); });
      q(".sf-analise", function (d) { d.addEventListener("toggle", function () { st.analiseAberta = d.open; }); });
      q("[data-dec]", function (b) { b.addEventListener("click", function () { var v = b.getAttribute("data-dec"); rasc.dec = rasc.dec === v ? null : v; desenhar(); }); });
      q("[data-ment]", function (b) { b.addEventListener("click", function () { var g = b.getAttribute("data-ment"), k = b.getAttribute("data-mk"), v = +b.getAttribute("data-mv"); st.mental[g][k] = st.mental[g][k] === v ? 0 : v; desenhar(); agendar(); }); });
      q("[data-mjogo]", function (b) { b.addEventListener("click", function () { var g = M.numeroDoGame(placarAtual()), v = +b.getAttribute("data-mjogo"); st.mental.jogo[g] = st.mental.jogo[g] === v ? 0 : v; desenhar(); agendar(); }); });
      q("[data-qdev]", function (b) { b.addEventListener("click", function () { var v = b.getAttribute("data-qdev"); rasc.qualDev = rasc.qualDev === v ? null : v; desenhar(); }); });
      q("[data-direcao]", function (b) { b.addEventListener("click", function () { var v = b.getAttribute("data-direcao"); rasc.direcao = rasc.direcao === v ? null : v; desenhar(); }); });
      q("[data-rede]", function (b) { b.addEventListener("click", function () { rasc.rede = !rasc.rede; desenhar(); }); });
      q("[data-zona]", function (b) { b.addEventListener("click", function () { var v = b.getAttribute("data-zona"); rasc.zona = rasc.zona === v ? null : v; desenhar(); }); });
      q("[data-bola]", function (b) { b.addEventListener("click", function () { var p = Object.assign({}, rasc); delete p.saquePre; p.bola = b.getAttribute("data-bola"); adicionar(p); }); });
      document.getElementById("sfNivel").addEventListener("change", function (e) { st.nivelAdversario = e.target.value; agendar(); });
      document.getElementById("sfObs").addEventListener("input", function (e) { st.observacaoFinal = e.target.value.slice(0, 1200); agendar(); });
      document.getElementById("sfDesfazer").addEventListener("click", function () { if (rasc) { rasc = null; desenhar(); return; } if (st.pontos.length) { st.pontos.pop(); st.fim = false; desenhar(); agendar(); } });
      document.getElementById("sfEnviar").addEventListener("click", function () { clearTimeout(tmr); enviar(); });
      var fim = document.getElementById("sfFim"); if (fim) fim.addEventListener("click", function () { if (!window.confirm("Encerrar a partida? O resultado final fica visível por mais 2 horas.")) return; st.fim = true; rasc = null; desenhar(); clearTimeout(tmr); enviar(); });
      var novo = document.getElementById("sfNovo"); if (novo) novo.addEventListener("click", function () { st = { cfg: Object.assign({}, st.cfg), pontos: [], token: null, fim: false, iniciado: false, mental: { antes: {}, jogo: {}, depois: {} } }; salvar(); telaConfig(); });
      estadoEnvio();
    }
    if (st.iniciado) desenhar(); else telaConfig();
  }

  async function telaCompeticao() {
    tela('<p class="carregando">Carregando…</p>', true);
    var s;
    try { s = await api("player-competicao"); }
    catch (e) { tela('<div class="aviso">' + esc(e.message) + '</div><div class="acoes"><a class="btn btn-secundario" href="#/inicio">Voltar</a></div>'); return; }
    var comp = s.competicao, topo = "", html;
    var primeiro = ((estado.dados && estado.dados.perfil && estado.dados.perfil.nome) || "").split(" ")[0];
    if (!comp.ativo) {
      tela(topo + '<h1>Competição</h1><p class="sub">Para quem joga torneios: o atleta, quem o acompanha de perto e o treinador no mesmo lugar, com cada pessoa vendo só o que o atleta permitir.</p>' +
        '<form id="fPapel" class="cartao" style="margin-top:16px" novalidate><h2>Qual é o seu papel?</h2><p class="nota" style="margin:6px 0 10px">Atleta menor de 18 anos: <strong>primeiro vincule o responsável, depois o treinador</strong>. O treinador só pode ser aprovado pelo responsável.</p>' +
        ["atleta", "responsavel", "treinador"].map(function (p) {
          return '<label class="comp-papel"><input type="radio" name="papel" value="' + p + '"><span><strong>' + ROTULO_PAPEL[p] + "</strong><br><span class=\"nota\">" +
            { atleta: "Jogo torneios e quero organizar a minha preparação.", responsavel: "Acompanho um atleta menor de idade.", treinador: "Acompanho atletas na preparação e nos torneios." }[p] + "</span></span></label>";
        }).join("") +
        '<div class="campo" id="campoNasc" hidden><label for="nasc">Data de nascimento do atleta</label><input id="nasc" type="date" autocomplete="bday"><p class="nota" style="margin-top:6px">Usamos só para saber se o atleta é menor de idade: nesse caso o responsável participa das aprovações.</p></div>' +
        '<div class="aviso" id="avisoPapel" role="alert" hidden></div><button class="btn btn-primario btn-grande" type="submit">Continuar</button></form>');
      var f = document.getElementById("fPapel");
      f.addEventListener("change", function () { var p = f.querySelector('input[name="papel"]:checked'); document.getElementById("campoNasc").hidden = !(p && p.value === "atleta"); });
      f.addEventListener("submit", async function (ev) {
        ev.preventDefault();
        var p = f.querySelector('input[name="papel"]:checked'), av = document.getElementById("avisoPapel"); av.hidden = true;
        if (!p) { av.textContent = "Escolha o seu papel."; av.hidden = false; return; }
        var nasc = document.getElementById("nasc").value;
        if (p.value === "atleta" && !nasc) { av.textContent = "Informe a data de nascimento."; av.hidden = false; return; }
        var bt = f.querySelector("button[type=submit]"); ocupado(bt, true, "Salvando…");
        try { await api("player-competicao", { metodo: "POST", corpo: { acao: "ativar", papel: p.value, nascimento: p.value === "atleta" ? nasc : undefined } }); await telaCompeticao(); }
        catch (e) { av.textContent = e.message; av.hidden = false; ocupado(bt, false); }
      });
      return;
    }
    html = topo + "<h1>" + (MODO_COMP && primeiro ? "Olá, " + esc(primeiro) : "Competição") + "</h1>" + '<p class="sub">Seu papel: <strong>' + ROTULO_PAPEL[comp.papel] + "</strong>" + (comp.papel === "atleta" && comp.menor ? " · atleta menor de idade" : "") + ".</p>";
    if (comp.papel === "atleta") {
      var ativosResp = s.meus.filter(function (v) { return v.tipo === "responsavel" && v.status === "ativo"; }).length;
      comp.ativosResp = ativosResp; var semResp = !!comp.menor && !ativosResp, respPendente = s.meus.some(function (v) { return v.tipo === "responsavel" && (v.status === "convite" || v.status === "aguardando"); });
      var temTreinador = s.meus.some(function (v) { return v.tipo === "treinador" && v.status === "ativo"; }), trPendente = s.meus.some(function (v) { return v.tipo === "treinador" && (v.status === "convite" || v.status === "aguardando"); });
      html += '<section class="cartao" aria-labelledby="t-acad"><p class="olho">Atleta da academia</p><h2 id="t-acad">Tenho o código do meu treinador</h2><p class="nota">Se você treina em uma academia parceira, digite o código que o seu treinador passou. O vínculo é feito na hora, sem precisar de responsável (o termo assinado na matrícula já cobre). Você pode encerrar quando quiser.</p>' +
        '<form id="fAcademia" novalidate style="margin-top:8px"><label for="codAcademia">Código do treinador</label><input id="codAcademia" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" maxlength="12" placeholder="8 letras e números"><div class="aviso" id="avisoAcademia" role="alert" hidden></div><div class="acoes"><button class="btn btn-primario" type="submit">Vincular ao treinador</button></div></form></section>';
      if (comp.menor && !(ativosResp && temTreinador)) {
        html += '<section class="cartao equipe-passos" aria-labelledby="t-eq"><p class="olho">Monte a sua equipe</p><h2 id="t-eq">Primeiro o responsável, depois o treinador</h2><ol class="convite-passos">' +
          '<li' + (ativosResp ? ' class="feito"' : "") + '><span>' + (ativosResp ? "✓" : "1") + '</span><div><strong>Responsável (pai, mãe ou outro)</strong>: ' + (ativosResp ? "vinculado." : respPendente ? "convite em aberto, falta ele usar o código e você aprovar." : "convide agora. É obrigatório para menores de 18 anos.") + '</div></li>' +
          '<li' + (temTreinador ? ' class="feito"' : !ativosResp ? ' class="travado"' : "") + '><span>' + (temTreinador ? "✓" : "2") + '</span><div><strong>Treinador</strong>: ' + (temTreinador ? "vinculado." : trPendente ? "pedido em andamento; um responsável aprova." : ativosResp ? "já pode convidar. Quem aprova é o responsável." : "só fica liberado depois que o responsável estiver vinculado.") + '</div></li></ol></section>';
      }
      html += (semResp ? '<section class="cartao comp-alerta" aria-labelledby="t-vr"><p class="olho">Primeiro passo</p><h2 id="t-vr">Vincular responsável</h2><p class="nota" style="margin-top:6px">' +
          (respPendente ? "Seu convite ao responsável está em aberto: veja o código em “Quem acompanha você”, mais abaixo. " : "") +
          'Como você é menor de idade, um responsável (pai, mãe ou outro) precisa estar vinculado antes de convidar o treinador ou contratar qualquer serviço. Depois você pode vincular também o outro responsável.</p>' +
          (respPendente ? '<div class="acoes"><a class="btn btn-primario btn-grande" href="#quemAcompanha" id="lkVincResp">Ver o código do convite</a></div>' : '<div class="acoes"><button type="button" class="btn btn-primario btn-grande" id="btVincResp">Gerar código para o pai ou a mãe</button></div>') + "</section>" : "") +
        cartaoSimuladorHtml() + '<div id="hubProximo"></div><section class="cartao comp-plano-hub" id="hubPlano" aria-labelledby="t-mp"><p class="olho">Temporada, semanas e rotina</p><h2 id="t-mp">Meu planejamento</h2><p class="nota" style="margin-top:6px">Organize sua preparação de acordo com seus objetivos, sua rotina e seus próximos torneios.</p>' +
        '<div id="hubPlanoDados"></div><div class="acoes"><a class="btn btn-laranja btn-grande" href="#/planejamento">Abrir meu planejamento</a></div></section>' +
        '<div id="hubPre"></div><div id="hubDes"></div><div id="hubDev"></div><div id="hubAcomp"></div>' +
        '<div class="cartao" style="margin-top:14px"><h2>Temporada</h2><p class="nota" style="margin-top:6px">Seus torneios, datas e prazos num só lugar.</p><div class="acoes"><a class="btn btn-secundario" href="#/temporada">Abrir a temporada</a><a class="btn btn-secundario" href="#/diario">Diário</a></div></div>' +
        '<div class="cartao" style="margin-top:14px"><h2>Evolução</h2><p class="nota" style="margin-top:6px">Devolutivas do treinador e o que levar do jogo para o treino.</p><div class="acoes"><a class="btn btn-secundario" href="#/devolutivas">Devolutivas</a><a class="btn btn-secundario" href="#/focos">Foco de treino</a><a class="btn btn-secundario" href="#/scouts">Scouts do treinador</a><a class="btn btn-secundario" href="#/ao-vivo">Jogo ao vivo</a></div></div>' +
        '<div class="cartao" style="margin-top:14px"><h2>Consultorias avulsas</h2><p class="nota" style="margin-top:6px">Orientação pontual da Metodologia MTY, contratada por serviço e separada do Acompanhamento MTY.</p><div class="acoes"><a class="btn btn-secundario" href="#/consultorias">Ver consultorias</a><a class="btn btn-secundario" href="#/pedidos">Meus pedidos</a></div></div>';
      html += '<div class="cartao" id="quemAcompanha" style="margin-top:14px"><h2>Quem acompanha você</h2>' +
        (semResp ? '<p class="nota" style="margin-top:6px"><strong>Primeiro passo:</strong> convide o pai, a mãe ou outro responsável. Depois que ele estiver vinculado, você poderá convidar o treinador.</p>' : '<p class="nota" style="margin-top:6px">Você decide quem vê o quê e pode encerrar qualquer vínculo quando quiser. O diário pessoal só é compartilhado se você marcar, registro por registro.' + (ativosResp === 1 && comp.menor ? " Para vincular o outro responsável (pai ou mãe), convide-o abaixo." : "") + "</p>") +
        '<h3 style="margin-top:14px">Como convidar alguém</h3><ol class="convite-passos"><li><span>1</span><div>Escolha <strong>quem convidar</strong> e marque o que a pessoa poderá ver.</div></li><li><span>2</span><div>Toque em <strong>Gerar código</strong>. O código tem 8 letras e números e vale 7 dias.</div></li><li><span>3</span><div><strong>Envie o código</strong> pelo WhatsApp. A pessoa cria a conta grátis no papel certo e digita o código em Início.</div></li><li><span>4</span><div><strong>Aprove o pedido</strong> aqui' + (comp.menor ? " (o treinador de um menor de idade é aprovado por um responsável)" : "") + ".</div></li></ol>" +
        '<h3 style="margin-top:14px">Pessoas e convites</h3>' + (s.meus.length ? '<ul class="comp-lista">' + s.meus.map(function (v) { return vinculoMeuHtml(v, comp); }).join("") + "</ul>" : '<p class="nota" style="margin-top:6px">Ninguém vinculado ainda.</p>') +
        '<h3 id="tituloConvidar" style="margin-top:16px">Convidar alguém</h3><p class="nota" style="margin-top:4px">Quem você quer convidar?</p>' +
        '<div class="convite-botoes" role="group" aria-label="Quem você quer convidar"><button type="button" class="btn btn-secundario btn-conv" data-conv="mae">Mãe</button><button type="button" class="btn btn-secundario btn-conv" data-conv="pai">Pai</button><button type="button" class="btn btn-secundario btn-conv" data-conv="outro">Outro responsável</button>' +
        '<button type="button" class="btn btn-secundario btn-conv" data-conv="treinador"' + (semResp ? " disabled" : "") + ">Treinador</button></div>" +
        (semResp ? '<p class="nota" style="margin-top:8px"><strong>Treinador:</strong> fica liberado depois que o responsável usar o código dele (em outra conta) e você aprovar o pedido. O código de responsável não serve para o treinador.</p>' : '<p class="nota" style="margin-top:8px">Pai e mãe podem ser vinculados, cada um com o seu código e a sua conta. Para o Acompanhamento MTY, o convite do treinador deve ter “Meu planejamento” marcado.</p>') +
        '<form id="fConvite" style="margin-top:12px" hidden novalidate><input type="hidden" id="tipoConv" value="responsavel"><input type="hidden" id="parentConv" value="mae">' +
        '<p class="olho" id="convPara">Convite</p><p class="nota" style="margin:4px 0 8px">Marque o que essa pessoa poderá ver. Você pode mudar isso depois.</p>' + areasMarcadas(null, "ar-novo") +
        '<div class="aviso" id="avisoConv" role="alert" hidden></div><div class="acoes"><button class="btn btn-primario" type="submit" id="btGerarConvite">Gerar código</button><button class="btn btn-texto" type="button" id="btCancelarConvite">Cancelar</button></div></form></div>';
    } else {
      var ativos = s.comigo.filter(function (v) { return v.status === "ativo"; }), emEspera = s.comigo.filter(function (v) { return v.status !== "ativo"; });
      /* 1) o que depende de você, no topo */
      if (s.paraDecidir && s.paraDecidir.length) {
        html += '<div class="cartao comp-alerta" style="margin-top:14px" id="pedidosAprovar"><p class="olho">Precisa de você</p><h2>Pedidos aguardando a sua aprovação</h2><ul class="comp-lista">' + s.paraDecidir.map(function (v) {
          return '<li class="comp-vinc"><p><strong>' + esc(v.pessoa ? v.pessoa.nome : "Pessoa") + (v.pessoa && v.pessoa.email ? ' <span class="nota">(' + esc(v.pessoa.email) + ")</span>" : "") + "</strong> quer acompanhar <strong>" + esc(v.atleta.nome) + "</strong> como " + (v.tipo === "treinador" ? "treinador" : "responsável" + (v.parentesco && v.parentesco !== "outro" ? " (" + ROTULO_PARENT[v.parentesco].toLowerCase() + ")" : "")) + '</p><p class="nota">Compartilharia: ' + esc(rotuloAreas(v.areas)) + '</p>' +
            '<div class="acoes"><button type="button" class="btn btn-primario" data-dec="' + v.id + '" data-ap="1">Aprovar</button><button type="button" class="btn btn-secundario" data-dec="' + v.id + '" data-ap="0">Recusar</button></div></li>';
        }).join("") + "</ul></div>";
      }
      /* 2) um cartão por atleta, preenchido logo abaixo com semana, torneio, partidas e scouts */
      if (ativos.length) {
        html += '<h2 class="secao">' + (ativos.length === 1 ? "Seu atleta" : "Seus atletas") + "</h2>" + ativos.map(function (v) {
          return '<section class="cartao atleta-card" data-vinc="' + esc(v.id) + '" aria-labelledby="ac-' + esc(v.id) + '"><p class="olho">' + (v.tipo === "treinador" ? "Você é o treinador" : "Você é " + (v.parentesco === "mae" ? "a mãe" : v.parentesco === "pai" ? "o pai" : "responsável")) + '</p><h2 id="ac-' + esc(v.id) + '">' + esc(v.atleta.nome) + '</h2>' +
            '<div class="atleta-card-corpo" aria-busy="true"><p class="nota">Carregando o resumo…</p></div>' +
            '<div class="acoes"><a class="btn btn-primario" href="#/competicao/vinculo/' + esc(v.id) + '">Abrir o atleta</a><a class="btn btn-secundario" href="#/ao-vivo">Jogo ao vivo</a>' + ((v.tipo === "responsavel" || v.tipo === "treinador") && v.areas.indexOf("partidas") >= 0 ? '<a class="btn btn-laranja" href="#/competicao/vinculo/' + esc(v.id) + '/marcar">Marcar o jogo</a>' : "") + '</div></section>';
        }).join("");
      } else if (!emEspera.length) {
        html += '<div class="cartao" style="margin-top:14px"><h2>Você ainda não acompanha nenhum atleta</h2><p class="nota" style="margin-top:6px">Peça o código de convite ao atleta e digite abaixo. Assim que ele aprovar, o atleta aparece aqui, com a semana de treino, os torneios, as partidas e os scouts.</p></div>';
      }
      if (emEspera.length) {
        html += '<div class="cartao" style="margin-top:14px"><h2>Aguardando aprovação</h2><ul class="comp-lista">' + emEspera.map(vinculoComigoHtml).join("") + '</ul><p class="nota">Esta tela se atualiza sozinha: quando for aprovado, o atleta aparece aqui, sem precisar sair e entrar.</p></div>';
      }
      /* 3) entrar na equipe de um atleta (código) */
      html += '<details class="cartao" id="detCodigo" style="margin-top:14px"' + (ativos.length ? "" : " open") + '><summary><strong>Entrar na equipe de um atleta</strong> <span class="nota">(código de convite)</span></summary>' +
        '<ol class="convite-passos" style="margin-top:10px"><li><span>1</span><div>Peça ao <strong>atleta</strong> (ou ao responsável dele) o <strong>código de convite</strong>. Ele o gera em Início, em “Quem acompanha você”.</div></li><li><span>2</span><div><strong>Digite o código</strong> abaixo e toque em “Usar código”.</div></li><li><span>3</span><div>O atleta' + (comp.papel === "treinador" ? " (ou um responsável dele, se for menor)" : "") + " <strong>aprova o pedido</strong>. O atleta aparece aqui sozinho.</div></li></ol>" +
        '<form id="fCodigo" style="margin-top:12px" novalidate><div class="campo"><label for="codigo">Código de convite (8 letras e números)</label><input id="codigo" maxlength="12" autocomplete="off" autocapitalize="characters" placeholder="Ex.: K7MQ4XD2"><p class="nota" style="margin-top:6px">Cada código vale para o papel em que ele foi gerado: o seu papel nesta conta é <strong>' + ROTULO_PAPEL[comp.papel].toLowerCase() + "</strong>.</p></div>" +
        '<div class="aviso" id="avisoCod" role="alert" hidden></div><button class="btn btn-primario" type="submit">Usar código</button></form></details>';
    }
    if (comp.papel !== "treinador" && window.QL_HUB) html += window.QL_HUB.cartaoInicio();
    tela(html);
    definirPapel(comp.papel); vigia.sig = sigEstado(s); vigia.ultimo = s; vigia.rapido = haEspera(s); marcarBadge(contarPendencias(s, comp)); iniciarVigia(); mostrarAoVivoAgora();
    if (comp.papel !== "atleta") preencherCartoesAtleta(s);
    if (comp.papel === "atleta") {
      lembretesTemporada();
      var bvr = document.getElementById("btVincResp");
      if (bvr) bvr.addEventListener("click", function () { acaoComp({ acao: "convidar", tipo: "responsavel", parentesco: "outro" }, bvr, "Código gerado. Passe-o para o seu responsável."); });
      var lvr = document.getElementById("lkVincResp");
      if (lvr) lvr.addEventListener("click", function (ev) { ev.preventDefault(); var q = document.getElementById("quemAcompanha"); if (q) q.scrollIntoView({ behavior: "smooth", block: "start" }); });
      api("player-torneios").then(function (rt) {
        var prox = rt.torneios.filter(function (t) { return t.fase !== "passado" && t.estado !== "desistiu"; })[0], box = document.getElementById("hubProximo");
        if (prox && box) box.innerHTML = heroTorneioHtml(prox);
        /* preparação pré-jogo: aparece quando o próximo torneio está perto ou em andamento */
        var pre = document.getElementById("hubPre");
        if (pre && prox && (prox.fase === "andamento" || prox.diasParaInicio <= 10)) {
          var preps = rt.preparos.filter(function (x) { return x.torneioId === prox.id; }), pp = preps.filter(function (x) { return !x.partidaId; })[0] || preps[0];
          pre.innerHTML = '<section class="cartao" style="margin-top:14px" aria-labelledby="t-pre"><p class="olho">Preparação pré-jogo</p><h2 id="t-pre">' + esc(prox.nome) + "</h2>" +
            (pp ? (pp.adversario || pp.rodada ? '<p class="nota" style="margin-top:4px">' + esc([pp.rodada, pp.adversario ? "contra " + pp.adversario : ""].filter(Boolean).join(" · ")) + "</p>" : "") + (pp.prioridades && pp.prioridades.length ? '<ol class="comp-prior">' + pp.prioridades.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol>" : "") +
              '<div class="acoes"><a class="btn btn-secundario" href="#/preparo/' + prox.id + "/" + pp.id + '">Abrir a preparação</a><a class="btn btn-secundario" href="#/aquecimento?de=inicio">Aquecimento</a></div>'
              : '<p class="nota" style="margin-top:4px">Ainda sem estratégia para as partidas deste torneio. Defina até 3 prioridades antes de entrar em quadra.</p><div class="acoes"><a class="btn btn-laranja" href="#/preparo/' + prox.id + '/novo">Preparar partida</a></div>') + "</section>";
        }
        var des = document.getElementById("hubDes"), dl = desafiosLista().filter(function (x) { return x.estado === "andamento"; })[0];
        if (des && dl) des.innerHTML = '<section class="cartao" style="margin-top:14px" aria-labelledby="t-des"><p class="olho">Desafio em andamento</p><h2 id="t-des">' + esc(dl.nome) + '</h2><p class="nota" style="margin-top:4px">' + dl.feitos + " de " + dl.total + " etapas concluídas</p>" + barraPrep(dl.feitos, dl.total) + '<div class="acoes"><a class="btn btn-secundario" href="' + dl.href + '">Continuar</a></div></section>';
        var dv = document.getElementById("hubDev"), d0 = (rt.devolutivas || [])[0];
        if (dv && d0) dv.innerHTML = '<section class="cartao" style="margin-top:14px" aria-labelledby="t-dev"><p class="olho">Devolutiva do treinador · ' + esc(dataCurta(String(d0.criadoEm).slice(0, 10))) + '</p><h2 id="t-dev">' + esc(d0.autorNome || "Treinador") + "</h2>" +
          '<p class="nota" style="margin-top:4px">' + esc(d0.refRotulo || "Geral") + "</p>" + (d0.recomendacao ? '<p class="comp-dev-bloco comp-dev-texto">' + esc(olharResumo(d0.recomendacao, 260)) + "</p>" + (d0.foco ? '<p class="comp-dev-bloco comp-dev-foco"><strong>Foco de treino</strong>' + esc(d0.foco) + "</p>" : "") : d0.foco ? '<p class="comp-dev-bloco comp-dev-foco"><strong>Foco de treino</strong>' + esc(d0.foco) + "</p>" : d0.melhorar ? '<p class="comp-dev-bloco"><strong>O que melhorar</strong>' + esc(d0.melhorar) + "</p>" : "") +
          '<div class="acoes"><a class="btn btn-secundario" href="#/devolutivas">Ver devolutivas' + (rt.devolutivas.length > 1 ? " (" + rt.devolutivas.length + ")" : "") + "</a></div></section>";
      }).catch(function () { /* o resto da tela funciona sem a lista */ });
    }
    if (window.QL_COMP_HUB) window.QL_COMP_HUB(comp, s);
    anexarCartaoInstalar();
    app.querySelectorAll("[data-copiar]").forEach(function (b) {
      b.addEventListener("click", function () { var c = b.getAttribute("data-copiar"); (navigator.clipboard ? navigator.clipboard.writeText(c) : Promise.reject()).then(function () { toast(b.getAttribute("data-copiado") || "Código copiado."); }, function () { toast("Copie manualmente: " + c); }); });
    });
    app.querySelectorAll("[data-rev]").forEach(function (b) {
      b.addEventListener("click", function () { if (window.confirm("Encerrar este vínculo? A pessoa deixa de ver os seus dados na hora.")) acaoComp({ acao: "revogar", id: b.getAttribute("data-rev") }, b, "Vínculo encerrado."); });
    });
    app.querySelectorAll("[data-dec]").forEach(function (b) {
      b.addEventListener("click", function () { var ap = b.getAttribute("data-ap") === "1"; acaoComp({ acao: "decidir", id: b.getAttribute("data-dec"), aprovar: ap }, b, ap ? "Vínculo aprovado." : "Pedido recusado."); });
    });
    app.querySelectorAll("[data-areas]").forEach(function (b) {
      var id = b.getAttribute("data-areas");
      b.addEventListener("click", function () { acaoComp({ acao: "areas", id: id, areas: lerAreas("ar-" + id) }, b, "Áreas atualizadas."); });
    });
    var fc = document.getElementById("fConvite");
    var ROT_CONV = { mae: "a mãe (responsável)", pai: "o pai (responsável)", outro: "outro responsável", treinador: "o treinador" };
    app.querySelectorAll("[data-conv]").forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-conv");
        app.querySelectorAll("[data-conv]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        document.getElementById("tipoConv").value = k === "treinador" ? "treinador" : "responsavel"; document.getElementById("parentConv").value = k === "treinador" ? "outro" : k;
        document.getElementById("convPara").textContent = "Convite para " + ROT_CONV[k];
        document.getElementById("btGerarConvite").textContent = "Gerar código para " + ROT_CONV[k].replace(" (responsável)", "");
        fc.hidden = false; fc.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    });
    var bcc = document.getElementById("btCancelarConvite"); if (bcc) bcc.addEventListener("click", function () { fc.hidden = true; app.querySelectorAll("[data-conv]").forEach(function (x) { x.setAttribute("aria-pressed", "false"); }); });
    if (fc) fc.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var av = document.getElementById("avisoConv"); av.hidden = true;
      var bt = fc.querySelector("button[type=submit]"); ocupado(bt, true, "Gerando…");
      try { await api("player-competicao", { metodo: "POST", corpo: { acao: "convidar", tipo: document.getElementById("tipoConv").value, parentesco: document.getElementById("parentConv").value, areas: lerAreas("ar-novo") } }); await telaCompeticao(); toast("Código gerado. Envie-o para a pessoa pelo WhatsApp."); var novo = app.querySelector(".convite-aberto"); if (novo) novo.scrollIntoView({ behavior: "smooth", block: "center" }); }
      catch (e) { av.textContent = e.message; av.hidden = false; ocupado(bt, false); }
    });
    var fa = document.getElementById("fAcademia");
    if (fa) fa.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var av = document.getElementById("avisoAcademia"); av.hidden = true;
      var bt = fa.querySelector("button[type=submit]"); ocupado(bt, true, "Vinculando…");
      try { var r = await api("player-competicao", { metodo: "POST", corpo: { acao: "vincularAcademia", codigo: document.getElementById("codAcademia").value } }); toast("Pronto! Você está vinculado a " + r.treinador + "."); await telaCompeticao(); }
      catch (e) { av.textContent = e.message; av.hidden = false; ocupado(bt, false); }
    });
    var fk = document.getElementById("fCodigo");
    if (fk) fk.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var av = document.getElementById("avisoCod"); av.hidden = true;
      var bt = fk.querySelector("button[type=submit]"); ocupado(bt, true, "Verificando…");
      try { var r = await api("player-competicao", { metodo: "POST", corpo: { acao: "aceitarCodigo", codigo: document.getElementById("codigo").value } }); toast("Pedido enviado a " + r.atleta + ". Assim que ele aprovar, o atleta aparece aqui."); await telaCompeticao(); }
      catch (e) { av.textContent = e.message; av.hidden = false; ocupado(bt, false); }
    });
  }
  /* ══ Competição: temporada e Meu torneio ══
     O atleta cadastra os torneios (à mão, com o link ou colando a confirmação de inscrição). Nada é lido de sites de federação:
     a origem fica registrada e a tela pede para confirmar no site oficial. */
  var PISOS = [["", "Não sei"], ["saibro", "Saibro"], ["rapida", "Quadra rápida"], ["grama", "Grama"], ["indoor", "Indoor"]];
  var ESTADOS_TORNEIO = [["planejado", "Planejado"], ["inscrito", "Inscrito"], ["jogando", "Em andamento"], ["encerrado", "Encerrado"], ["desistiu", "Desistiu"]];
  function dataCurta(iso) { var p = String(iso || "").split("-"); return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : ""; }
  function periodoTorneio(t) { return t.fim && t.fim !== t.inicio ? dataCurta(t.inicio) + " a " + dataCurta(t.fim) : dataCurta(t.inicio); }
  function quandoTorneio(t) {
    if (t.fase === "andamento") return "Acontecendo agora";
    if (t.fase === "passado") return "Já aconteceu";
    return t.diasParaInicio === 0 ? "Começa hoje" : t.diasParaInicio === 1 ? "Começa amanhã" : "Começa em " + t.diasParaInicio + " dias";
  }
  function rotuloEstadoTorneio(e) { return (ESTADOS_TORNEIO.filter(function (x) { return x[0] === e; })[0] || [e, e])[1]; }
  function prazoTorneioHtml(t) {
    if (!t.prazoInscricao || t.fase !== "proximo" || t.estado !== "planejado") return "";
    var d = t.diasParaPrazo;
    if (d < 0) return '<p class="nota"><strong>Prazo de inscrição passou</strong> (' + dataCurta(t.prazoInscricao) + "). Confira no site oficial.</p>";
    return '<p class="nota"><strong>Inscrição até ' + dataCurta(t.prazoInscricao) + "</strong> · " + (d === 0 ? "termina hoje" : d === 1 ? "falta 1 dia" : "faltam " + d + " dias") + ".</p>";
  }
  var MESES_CURTOS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];
  function cartaoTorneioHtml(t) {
    var dia = String(t.inicio || "").slice(8, 10), mes = MESES_CURTOS[parseInt(String(t.inicio || "").slice(5, 7), 10) - 1] || "";
    return '<a class="cartao comp-torneio fase-' + t.fase + '" href="#/temporada/' + t.id + '"><div class="comp-data" aria-hidden="true"><b>' + esc(dia) + "</b><span>" + esc(mes) + '</span></div><div class="comp-info"><p class="olho">' + esc(rotuloEstadoTorneio(t.estado)) + " · " + esc(quandoTorneio(t)) + "</p><h2>" + esc(t.nome) + "</h2>" +
      '<p class="nota">' + esc(periodoTorneio(t)) + (t.cidade ? " · " + esc(t.cidade) : "") + (t.categoria ? " · " + esc(t.categoria) : "") + (t.prioridade ? " · Prioridade " + esc(t.prioridade) : "") + "</p>" + prazoTorneioHtml(t) + "</div></a>";
  }
  /* o cartão de destaque do início: a contagem regressiva é o protagonista */
  function heroTorneioHtml(t) {
    var andamento = t.fase === "andamento", n = t.diasParaInicio, num = andamento ? "Agora" : n === 0 ? "Hoje" : String(n), un = andamento || n === 0 ? "" : n === 1 ? "dia" : "dias";
    return '<section class="comp-hero" aria-label="Próximo torneio"><span class="comp-kicker">' + (andamento ? "Torneio em andamento" : "Próximo torneio") + '</span><div class="comp-count"><span class="comp-num">' + esc(num) + "</span>" + (un ? '<span class="comp-un">' + un + "</span>" : "") + "</div>" +
      "<h2>" + esc(t.nome) + "</h2><p>" + esc(periodoTorneio(t)) + (t.cidade ? " · " + esc(t.cidade) : "") + (t.categoria ? " · " + esc(t.categoria) : "") + '</p><div class="comp-chips"><span class="comp-chip lima">' + esc(rotuloEstadoTorneio(t.estado)) + "</span>" +
      (t.superficie ? '<span class="comp-chip">' + esc((PISOS.filter(function (p) { return p[0] === t.superficie; })[0] || ["", t.superficie])[1]) + "</span>" : "") + "</div>" +
      '<a class="btn btn-laranja" href="#/preparo/' + t.id + '/novo">Preparar partida</a><a class="btn comp-ghost" href="#/temporada/' + t.id + '">Abrir torneio</a></section>';
  }
  async function telaTemporada() {
    tela('<p class="carregando">Carregando…</p>', true);
    var r;
    try { r = await api("player-torneios"); }
    catch (e) {
      tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/competicao">‹ Início</a></p><div class="aviso">' + esc(e.message) + '</div><div class="acoes"><a class="btn btn-primario" href="#/competicao">Ativar a Competição</a></div>'); return;
    }
    var lista = r.torneios, prox = lista.filter(function (t) { return t.fase !== "passado"; }), pass = lista.filter(function (t) { return t.fase === "passado"; });
    tela('<h1>Temporada</h1><p class="sub">Os torneios que você vai jogar, com datas e prazos.</p>' +
      '<div class="acoes"><a class="btn btn-laranja btn-grande" href="#/temporada/novo">Adicionar torneio</a></div>' +
      (prox.length ? '<div class="acoes"><button type="button" class="btn btn-secundario" id="btIcs">Exportar para o calendário do celular</button></div>' : "") +
      (prox.length ? '<h2 class="secao">Próximos</h2><div class="comp-torneios">' + prox.map(cartaoTorneioHtml).join("") + "</div>"
        : '<div class="cartao" style="margin-top:14px"><h2>Nenhum torneio à vista</h2><p class="nota" style="margin-top:6px">Adicione o próximo torneio: cole a confirmação de inscrição, informe o link oficial ou preencha à mão.</p></div>') +
      (pass.length ? '<h2 class="secao">Anteriores</h2><div class="comp-torneios">' + pass.map(cartaoTorneioHtml).join("") + "</div>" : "") +
      '<p class="nota" style="margin-top:14px">Os dados são os que você cadastra. Sempre confirme datas, categorias e prazos no site oficial do torneio.</p>');
    var bi = document.getElementById("btIcs");
    if (bi) bi.addEventListener("click", function () { baixarIcs(lista); toast("Arquivo gerado. Abra-o para adicionar ao seu calendário."); });
  }
  function campoTorneio(id, rotulo, valor, tipo, extra) {
    return '<div class="campo"><label for="' + id + '">' + rotulo + '</label><input id="' + id + '" type="' + (tipo || "text") + '" value="' + esc(valor || "") + '"' + (extra || "") + "></div>";
  }
  async function telaTorneioForm(id) {
    var t = null, novo = id === "novo", copia = novo ? ((location.hash.split("?")[1] || "").match(/(?:^|&)copia=([^&]+)/) || [])[1] : "";
    if (novo && copia) {
      try { var base = (await api("player-torneios")).torneios.filter(function (x) { return x.id === decodeURIComponent(copia); })[0]; }
      catch (e) { base = null; }
      /* copia o que se repete entre etapas do mesmo circuito; datas, link e anotações ficam em branco */
      t = base ? { estado: "planejado", origem: "manual", nome: base.nome, categoria: base.categoria, circuito: base.circuito, cidade: base.cidade, local: base.local, superficie: base.superficie } : null;
    }
    if (!novo) {
      tela('<p class="carregando">Carregando…</p>', true);
      try { t = (await api("player-torneios")).torneios.filter(function (x) { return x.id === id; })[0]; }
      catch (e) { tela('<div class="aviso">' + esc(e.message) + '</div><div class="acoes"><a class="btn btn-secundario" href="#/temporada">Voltar</a></div>'); return; }
      if (!t) { tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/temporada">‹ Temporada</a></p><div class="aviso">Torneio não encontrado.</div>'); return; }
    } else if (!t) t = { estado: "planejado", origem: "manual" };
    tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="' + (novo ? "#/temporada" : "#/temporada/" + id) + '">‹ ' + (novo ? "Temporada" : "Meu torneio") + '</a></p><h1>' + (novo ? (copia ? "Nova etapa" : "Novo torneio") : "Editar " + esc(t.nome)) + "</h1>" + (copia && novo ? '<p class="sub">Copiei circuito, categoria, local e piso. Informe o nome e as datas desta etapa.</p>' : "") +
      (novo && !copia ? '<div class="cartao" style="margin-top:14px"><h2>Colar a confirmação de inscrição</h2><p class="nota" style="margin-top:6px">Cole o texto do e-mail de confirmação ou da página do torneio. Eu preencho os campos abaixo e você confere antes de salvar. Não copio nomes de atletas nem dados pessoais.</p>' +
        '<div class="campo"><label for="tcTexto" class="sr">Texto da inscrição</label><textarea id="tcTexto" rows="4" maxlength="6000" placeholder="Cole aqui o texto"></textarea></div><div class="aviso" id="avisoLer" role="alert" hidden></div>' +
        '<button type="button" class="btn btn-secundario" id="btLer">Preencher com o texto</button></div>' : "") +
      '<form id="fTorneio" class="cartao" style="margin-top:14px" novalidate><h2>Dados do torneio</h2>' +
      campoTorneio("tNome", "Nome do torneio", t.nome, "text", ' maxlength="100" required') +
      '<div class="comp-duas">' + campoTorneio("tInicio", "Início", t.inicio, "date", " required") + campoTorneio("tFim", "Término", t.fim, "date") + "</div>" +
      campoTorneio("tPrazo", "Prazo de inscrição (opcional)", t.prazoInscricao, "date") +
      '<div class="comp-duas">' + campoTorneio("tCidade", "Cidade", t.cidade, "text", ' maxlength="80"') + campoTorneio("tLocal", "Clube ou local", t.local, "text", ' maxlength="100"') + "</div>" +
      '<div class="comp-duas">' + campoTorneio("tCategoria", "Categoria", t.categoria, "text", ' maxlength="40" placeholder="Ex.: Sub-16"') + campoTorneio("tCircuito", "Circuito", t.circuito, "text", ' maxlength="60" placeholder="Ex.: COSAT"') + "</div>" +
      '<div class="campo"><label for="tPiso">Piso</label><select id="tPiso">' + PISOS.map(function (p) { return '<option value="' + p[0] + '"' + (p[0] === (t.superficie || "") ? " selected" : "") + ">" + p[1] + "</option>"; }).join("") + "</select></div>" +
      '<div class="campo"><label for="tPrior">Prioridade na temporada</label><select id="tPrior"><option value="">Definir depois</option>' + [["A", "A · Principal"], ["B", "B · Importante"], ["C", "C · Preparatório"]].map(function (p) { return '<option value="' + p[0] + '"' + (p[0] === (t.prioridade || "") ? " selected" : "") + ">" + p[1] + "</option>"; }).join("") + '</select><p class="nota">Ajuda a organizar preparação e recuperação no Meu planejamento. A prioridade sozinha não define a carga de treino.</p></div>' +
      '<div class="campo"><label for="tEstado">Minha situação</label><select id="tEstado">' + ESTADOS_TORNEIO.map(function (p) { return '<option value="' + p[0] + '"' + (p[0] === t.estado ? " selected" : "") + ">" + p[1] + "</option>"; }).join("") + "</select></div>" +
      campoTorneio("tUrl", "Link oficial do torneio (opcional)", t.urlOrigem, "url", ' maxlength="300" placeholder="https://" inputmode="url"') +
      '<p class="nota" style="margin:-4px 0 10px">Guardamos o link para você voltar à fonte. Confirme sempre as datas e o prazo no site oficial.' + (t.coletadoEm ? " Cadastrado a partir de " + (t.origem === "colado" ? "texto colado" : "link") + " em " + dataCurta(String(t.coletadoEm).slice(0, 10)) + "." : "") + "</p>" +
      '<div class="campo"><label for="tObs">Anotações pessoais (só você vê)</label><textarea id="tObs" rows="3" maxlength="500">' + esc(t.observacao || "") + "</textarea></div>" +
      '<div class="aviso" id="avisoT" role="alert" hidden></div><button class="btn btn-primario btn-grande" type="submit">' + (novo ? "Salvar torneio" : "Salvar alterações") + "</button></form>" +
      (novo ? "" : '<div class="acoes"><button type="button" class="btn btn-texto" id="btExcluirT">Excluir este torneio</button></div>'));
    var origem = t.origem || "manual";
    function v(i) { return document.getElementById(i).value.trim(); }
    var bl = document.getElementById("btLer");
    if (bl) bl.addEventListener("click", async function () {
      var av = document.getElementById("avisoLer"); av.hidden = true;
      var texto = document.getElementById("tcTexto").value;
      if (texto.trim().length < 20) { av.textContent = "Cole o texto da inscrição ou da página do torneio."; av.hidden = false; return; }
      ocupado(bl, true, "Lendo…");
      try {
        var r = (await api("player-torneios", { metodo: "POST", corpo: { acao: "extrair", texto: texto } })).proposta;
        [["tNome", "nome"], ["tInicio", "inicio"], ["tFim", "fim"], ["tPrazo", "prazoInscricao"], ["tCidade", "cidade"], ["tLocal", "local"], ["tCategoria", "categoria"], ["tCircuito", "circuito"], ["tPiso", "superficie"]].forEach(function (m) { if (r[m[1]]) document.getElementById(m[0]).value = r[m[1]]; });
        origem = "colado"; toast("Confira os campos abaixo antes de salvar.");
        document.getElementById("fTorneio").scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (e) { av.textContent = e.message; av.hidden = false; }
      ocupado(bl, false);
    });
    document.getElementById("fTorneio").addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var av = document.getElementById("avisoT"); av.hidden = true;
      var bt = this.querySelector("button[type=submit]"); ocupado(bt, true, "Salvando…");
      var corpo = { acao: "salvar", id: novo ? undefined : id, nome: v("tNome"), inicio: v("tInicio"), fim: v("tFim"), prazoInscricao: v("tPrazo"), cidade: v("tCidade"), local: v("tLocal"),
        categoria: v("tCategoria"), circuito: v("tCircuito"), superficie: v("tPiso"), prioridade: v("tPrior"), estado: v("tEstado"), urlOrigem: v("tUrl"), observacao: v("tObs"),
        origem: origem === "manual" && v("tUrl") ? "link" : origem };
      try { var rs = await api("player-torneios", { metodo: "POST", corpo: corpo }); toast(novo ? "Torneio salvo." : "Alterações salvas."); ir("#/temporada/" + (rs.id || id)); }
      catch (e) { av.textContent = e.message; av.hidden = false; ocupado(bt, false); }
    });
    var be = document.getElementById("btExcluirT");
    if (be) be.addEventListener("click", async function () {
      if (!window.confirm("Excluir este torneio da sua temporada?")) return;
      ocupado(be, true, "Excluindo…");
      try { await api("player-torneios", { metodo: "POST", corpo: { acao: "excluir", id: id } }); toast("Torneio excluído."); ir("#/temporada"); }
      catch (e) { toast(e.message, null, true); ocupado(be, false); }
    });
  }

  /* calendário do celular: um arquivo .ics com cada torneio (e o prazo de inscrição, quando houver), com aviso na véspera */
  function icsTexto(v) { return String(v == null ? "" : v).replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
  function icsDobra(l) { var out = []; while (l.length > 72) { out.push(l.slice(0, 72)); l = " " + l.slice(72); } out.push(l); return out.join("\r\n"); }
  function icsData(iso, mais) { var d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + (mais || 0)); return d.toISOString().slice(0, 10).replace(/-/g, ""); }
  function icsTemporada(torneios) {
    var agora = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, ""), L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//QuadraLab//Player Competicao//PT-BR", "CALSCALE:GREGORIAN"];
    function evento(uid, ini, fim, titulo, local, desc) {
      L.push("BEGIN:VEVENT", "UID:" + uid + "@quadralab.com.br", "DTSTAMP:" + agora, "DTSTART;VALUE=DATE:" + icsData(ini), "DTEND;VALUE=DATE:" + icsData(fim, 1), icsDobra("SUMMARY:" + icsTexto(titulo)));
      if (local) L.push(icsDobra("LOCATION:" + icsTexto(local)));
      L.push(icsDobra("DESCRIPTION:" + icsTexto(desc)), "BEGIN:VALARM", "ACTION:DISPLAY", "TRIGGER:-PT15H", "DESCRIPTION:" + icsTexto(titulo), "END:VALARM", "END:VEVENT");
    }
    torneios.forEach(function (t) {
      if (t.estado === "desistiu" || t.fase === "passado") return;
      var desc = [t.categoria, t.circuito].filter(Boolean).join(" · ") + (t.urlOrigem ? "\nConfirme no site oficial: " + t.urlOrigem : "\nConfirme as datas no site oficial do torneio.");
      evento(t.id, t.inicio, t.fim || t.inicio, t.nome, [t.local, t.cidade].filter(Boolean).join(", "), desc);
      if (t.prazoInscricao && t.estado === "planejado") evento(t.id + "-prazo", t.prazoInscricao, t.prazoInscricao, "Prazo de inscrição: " + t.nome, "", "Confirme o prazo no site oficial." + (t.urlOrigem ? "\n" + t.urlOrigem : ""));
    });
    L.push("END:VCALENDAR");
    return L.join("\r\n") + "\r\n";
  }
  function baixarIcs(torneios) {
    var blob = new Blob([icsTemporada(torneios)], { type: "text/calendar;charset=utf-8" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "temporada-quadralab.ics"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function lembretesTemporada() {
    if (estado.semTemporada) return;
    api("player-torneios").then(function (r) {
      var h = document.querySelector("#app h1"); if (!h || document.getElementById("lembretesComp")) return;
      var itens = [];
      r.torneios.forEach(function (t) {
        if (t.estado === "desistiu" || t.estado === "encerrado") return;
        if (t.fase === "andamento") itens.push("<strong>" + esc(t.nome) + "</strong> está acontecendo agora.");
        else if (t.fase === "proximo" && t.diasParaInicio <= 7) itens.push("<strong>" + esc(t.nome) + "</strong>: " + esc(quandoTorneio(t).toLowerCase()) + ".");
        if (t.estado === "planejado" && t.fase === "proximo" && t.prazoInscricao && t.diasParaPrazo >= 0 && t.diasParaPrazo <= 5) itens.push("Inscrição em <strong>" + esc(t.nome) + "</strong> até " + dataCurta(t.prazoInscricao) + (t.diasParaPrazo === 0 ? " (hoje)." : "."));
      });
      if (!itens.length) return;
      var box = document.createElement("section"); box.id = "lembretesComp"; box.className = "cartao comp-lembrete"; box.setAttribute("aria-label", "Lembretes da temporada");
      box.innerHTML = '<p class="olho">Temporada</p><ul>' + itens.slice(0, 3).map(function (x) { return "<li>" + x + "</li>"; }).join("") + '</ul><a class="btn btn-laranja btn-pequeno" href="#/temporada">Ver temporada</a>';
      h.insertAdjacentElement("afterend", box);
    }).catch(function () { estado.semTemporada = true; /* conta sem a Competição ativa como atleta: não insiste */ });
  }
  async function telaTorneio(id) {
    tela('<p class="carregando">Carregando…</p>', true);
    var r;
    try { r = await api("player-torneios"); await carregarDados(); }
    catch (e) { tela('<div class="aviso">' + esc(e.message) + '</div><div class="acoes"><a class="btn btn-secundario" href="#/temporada">Voltar</a></div>'); return; }
    var t = r.torneios.filter(function (x) { return x.id === id; })[0];
    if (!t) { tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/temporada">‹ Temporada</a></p><div class="aviso">Torneio não encontrado.</div>'); return; }
    var preps = r.preparos.filter(function (x) { return x.torneioId === id; }), diar = r.diario.filter(function (x) { return x.torneioId === id; });
    var jogos = partidasLista().filter(function (x) { return x.torneioId === id; });
    tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/temporada">‹ Temporada</a></p><h1>' + esc(t.nome) + '</h1><p class="sub">' + esc(rotuloEstadoTorneio(t.estado)) + " · " + esc(quandoTorneio(t)) + " · " + esc(periodoTorneio(t)) + (t.cidade ? " · " + esc(t.cidade) : "") + "</p>" + prazoTorneioHtml(t) +
      '<div class="acoes"><a class="btn btn-laranja btn-grande" href="#/preparo/' + id + '/novo">Preparar partida</a></div>' +
      '<div class="acoes"><a class="btn btn-secundario" href="#/partidas/nova?torneio=' + id + '">Registrar partida</a><a class="btn btn-secundario" href="#/diario?torneio=' + id + '">Anotar no diário</a></div>' +
      '<h2 class="secao">Preparação</h2>' + cartoesPreparacaoHtml("temporada/" + id, false) +
      (preps.length ? '<div class="comp-torneios">' + preps.map(function (p) {
        return '<a class="cartao comp-torneio" href="#/preparo/' + id + "/" + p.id + '"><p class="olho">' + esc(p.rodada || "Partida") + (p.data ? " · " + dataCurta(p.data) : "") + "</p><h2>" + (p.adversario ? "Contra " + esc(p.adversario) : "Preparação") + "</h2>" +
          (p.prioridades && p.prioridades.length ? '<ol class="comp-prior">' + p.prioridades.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol>" : "") + '<p class="nota">' + (p.partidaId ? "Ligada a uma partida registrada" : "Ainda sem partida registrada") + "</p></a>";
      }).join("") + "</div>" : '<p class="nota" style="margin-top:10px">Ainda sem preparação para este torneio. Antes de cada partida, defina até 3 prioridades.</p>') +
      '<h2 class="secao">Partidas</h2>' + (jogos.length ? '<div class="comp-torneios">' + jogos.map(function (p) {
        return '<a class="cartao comp-torneio" href="#/partidas/' + p.id + '"><p class="olho">' + (p.resultado === "vitoria" ? "Vitória" : "Derrota") + (p.rodada ? " · " + esc(p.rodada) : "") + " · " + dataCurta(p.data) + "</p><h2>" + (p.adversario ? "Contra " + esc(p.adversario) : "Partida") + '</h2><p class="nota">' + esc(p.placar || "") + "</p></a>";
      }).join("") + "</div>" : '<p class="nota" style="margin-top:10px">Nenhuma partida registrada neste torneio.</p>') +
      '<h2 class="secao">Diário</h2>' + (diar.length ? '<div class="comp-torneios">' + diar.slice(0, 3).map(function (d) { return '<div class="comp-vinc"><p class="olho">' + dataCurta(d.data) + "</p><p>" + esc(d.texto) + "</p></div>"; }).join("") + '</div><p style="margin-top:8px"><a href="#/diario">Ver todo o diário</a></p>' : '<p class="nota" style="margin-top:10px">O diário é só seu, a menos que você marque para compartilhar.</p>') +
      '<div class="acoes" style="margin-top:18px"><a class="btn btn-secundario btn-pequeno" href="#/temporada/' + id + '/editar">Editar dados</a><a class="btn btn-secundario btn-pequeno" href="#/temporada/novo?copia=' + id + '">Duplicar</a>' +
      (t.urlOrigem ? '<a class="btn btn-secundario btn-pequeno" href="' + esc(t.urlOrigem) + '" target="_blank" rel="noopener noreferrer">Site oficial<span class="sr"> (abre em nova aba)</span></a>' : "") + "</div>" +
      '<p class="nota" style="margin-top:10px">Confirme datas, categoria e prazos no site oficial do torneio.</p>');
  }
  async function telaPreparo(torneioId, id) {
    tela('<p class="carregando">Carregando…</p>', true);
    var r;
    try { r = await api("player-torneios"); }
    catch (e) { tela('<div class="aviso">' + esc(e.message) + '</div>'); return; }
    var t = r.torneios.filter(function (x) { return x.id === torneioId; })[0];
    if (!t) { tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/temporada">‹ Temporada</a></p><div class="aviso">Torneio não encontrado.</div>'); return; }
    var novo = id === "novo", p = novo ? { prioridades: [], data: t.inicio } : r.preparos.filter(function (x) { return x.id === id; })[0];
    if (!p) { ir("#/temporada/" + torneioId); return; }
    var planos = MODO_COMP ? [] : planosProntos();
    tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/temporada/' + torneioId + '">‹ ' + esc(t.nome) + "</a></p><h1>Preparar partida</h1>" +
      '<p class="sub">Defina o que importa nesta partida. Poucas prioridades valem mais que muitas.</p>' +
      '<form id="fPrep" class="cartao" style="margin-top:14px" novalidate>' +
      '<div class="comp-duas">' + campoTorneio("pRodada", "Rodada", p.rodada, "text", ' maxlength="30" placeholder="Ex.: Oitavas"') + campoTorneio("pData", "Data", p.data, "date") + "</div>" +
      campoTorneio("pAdv", "Adversário (opcional)", p.adversario, "text", ' maxlength="60" autocomplete="off"') +
      '<fieldset><legend>Até 3 prioridades para esta partida</legend>' + [0, 1, 2].map(function (i) { return campoTorneio("pPri" + i, "Prioridade " + (i + 1), (p.prioridades || [])[i], "text", ' maxlength="120"' + (i === 0 ? ' placeholder="Ex.: Servir no T do deuce"' : "")); }).join("") + "</fieldset>" +
      campoTorneio("pPadrao", "Padrão de jogo principal", p.padrao, "text", ' maxlength="200" placeholder="Ex.: Direita inside-out e subir na bola curta"') +
      '<div class="campo"><label for="pHip">O que eu espero do adversário</label><textarea id="pHip" rows="3" maxlength="400">' + esc(p.hipoteses || "") + "</textarea>" + botaoVoz("pHip") + '<p class="nota">São hipóteses suas, não fatos: ajuste depois da partida.</p></div>' +
      (planos.length ? '<div class="campo"><label for="pPlano">Estratégia de apoio (opcional)</label><select id="pPlano"><option value="">Nenhuma em especial</option>' + planos.map(function (x) {
        return '<option value="' + esc(x.id) + '"' + (x.id === p.planoId ? " selected" : "") + ">" + esc(tipoEstrategia(x) + (x.adversarioNome ? " — " + x.adversarioNome : "") + " · " + tituloCurto(x.plano.titulo)) + "</option>";
      }).join("") + "</select></div>" : '') +
      '<div class="aviso" id="avisoP" role="alert" hidden></div><button class="btn btn-primario btn-grande" type="submit">' + (novo ? "Salvar preparação" : "Salvar alterações") + "</button></form>" +
      '<h2 class="secao">Antes de entrar na quadra</h2>' + cartoesPreparacaoHtml("preparo/" + torneioId + "/" + id, false) +
      (novo ? "" : '<div class="acoes"><a class="btn btn-secundario" href="#/partidas/nova?torneio=' + torneioId + '">Registrar a partida</a><button type="button" class="btn btn-texto" id="btExcluirPrep">Excluir esta preparação</button></div>'));
    function v(i) { return document.getElementById(i).value.trim(); }
    document.getElementById("fPrep").addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var av = document.getElementById("avisoP"); av.hidden = true;
      var bt = this.querySelector("button[type=submit]"); ocupado(bt, true, "Salvando…");
      try {
        await api("player-torneios", { metodo: "POST", corpo: { acao: "salvarPreparo", id: novo ? undefined : id, torneioId: torneioId, rodada: v("pRodada"), data: v("pData"), adversario: v("pAdv"),
          prioridades: [v("pPri0"), v("pPri1"), v("pPri2")], padrao: v("pPadrao"), hipoteses: v("pHip"), planoId: document.getElementById("pPlano") ? document.getElementById("pPlano").value || null : null } });
        toast("Preparação salva."); ir("#/temporada/" + torneioId);
      } catch (e) { av.textContent = e.message; av.hidden = false; ocupado(bt, false); }
    });
    var be = document.getElementById("btExcluirPrep");
    if (be) be.addEventListener("click", async function () {
      if (!window.confirm("Excluir esta preparação?")) return;
      ocupado(be, true, "Excluindo…");
      try { await api("player-torneios", { metodo: "POST", corpo: { acao: "excluirPreparo", id: id } }); toast("Preparação excluída."); ir("#/temporada/" + torneioId); }
      catch (e) { toast(e.message, null, true); ocupado(be, false); }
    });
  }
  async function telaDiario() {
    tela('<p class="carregando">Carregando…</p>', true);
    var r;
    var vincs = [];
    try { r = await api("player-torneios"); vincs = (await api("player-competicao").catch(function () { return { meus: [] }; })).meus.filter(function (v) { return v.status === "ativo"; }); }
    catch (e) { tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/competicao">‹ Início</a></p><div class="aviso">' + esc(e.message) + "</div>"); return; }
    var q = (location.hash.split("?")[1] || "").match(/(?:^|&)torneio=([^&]+)/), sel = q ? decodeURIComponent(q[1]) : "", nomes = {};
    r.torneios.forEach(function (t) { nomes[t.id] = t.nome; });
    var HUMOR = ["", "Muito mal", "Mal", "Neutro", "Bem", "Muito bem"];
    tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/competicao">‹ Início</a></p><h1>Diário de competição</h1><p class="sub">Registre como você se sentiu e o que aprendeu. É privado por padrão: você escolhe, registro por registro, quem pode ler.</p>' +
      '<form id="fDiario" class="cartao" style="margin-top:14px" novalidate><h2 id="tDiario">Novo registro</h2>' +
      '<div class="comp-duas">' + campoTorneio("dData", "Data", hojeISOLocal(), "date", ' max="' + hojeISOLocal() + '"') +
      '<div class="campo"><label for="dTorneio">Torneio</label><select id="dTorneio"><option value="">Sem torneio vinculado</option>' + r.torneios.map(function (t) { return '<option value="' + t.id + '"' + (t.id === sel ? " selected" : "") + ">" + esc(t.nome) + "</option>"; }).join("") + "</select></div></div>" +
      '<div class="campo"><label for="dTexto">O que você quer registrar?</label><textarea id="dTexto" rows="4" maxlength="1000"></textarea>' + botaoVoz("dTexto") + "</div>" +
      '<fieldset><legend>Sua avaliação: como você se sentiu? <span class="nota">(opcional)</span></legend><div class="escala">' + [1, 2, 3, 4, 5].map(function (n) { return '<label class="opcao"><input type="radio" name="humor" value="' + n + '"><span>' + n + "<small>" + HUMOR[n] + "</small></span></label>"; }).join("") + "</div></fieldset>" +
      '<div class="aviso" id="avisoD" role="alert" hidden></div><button class="btn btn-primario" type="submit" id="btSalvarD">Salvar registro</button><button class="btn btn-texto" type="button" id="btCancelarD" hidden>Cancelar edição</button></form>' +
      (r.diario.length ? '<h2 class="secao">Registros</h2><div class="comp-torneios">' + r.diario.map(function (d) {
        var com = d.compartilhadoCom || [], todos = vincs.filter(function (v) { return (v.areas || []).indexOf("diario") >= 0; });
        var quem = vincs.filter(function (v) { return com.indexOf(v.id) >= 0 || (v.areas || []).indexOf("diario") >= 0; }).map(function (v) { return v.pessoa ? v.pessoa.nome : (v.tipo === "treinador" ? "treinador" : "responsável"); });
        return '<div class="comp-vinc"><p class="olho">' + dataCurta(d.data) + (d.torneioId && nomes[d.torneioId] ? " · " + esc(nomes[d.torneioId]) : "") + (d.humor ? " · " + HUMOR[d.humor] : "") + "</p><p>" + esc(d.texto) + "</p>" +
          '<p class="nota"><span class="comp-estado ' + (quem.length ? "ok" : "") + '">' + (quem.length ? "Compartilhado com " + esc(quem.join(", ")) : "Privado") + "</span></p>" +
          '<details class="det"><summary>Quem pode ler este registro</summary><div style="margin-top:8px">' + (vincs.length ? vincs.map(function (v) {
            var porArea = (v.areas || []).indexOf("diario") >= 0;
            return '<label class="comp-area"><input type="checkbox" name="sh-' + d.id + '" value="' + v.id + '"' + (com.indexOf(v.id) >= 0 || porArea ? " checked" : "") + (porArea ? " disabled" : "") + "> " + esc((v.tipo === "treinador" ? "Treinador" : "Responsável") + ": " + (v.pessoa ? v.pessoa.nome : "")) + (porArea ? " (todo o diário, pelo vínculo)" : "") + "</label>";
          }).join("") + '<button type="button" class="btn btn-secundario btn-pequeno" data-shdiario="' + d.id + '">Salvar</button>' + (todos.length ? '<p class="nota">Para parar de compartilhar todo o diário, desmarque “Diário pessoal” no vínculo, em <a href="#/inicio">Início</a>.</p>' : "") : '<p class="nota">Nenhuma pessoa vinculada ainda. O registro continua privado.</p>') + "</div></details>" +
          '<div class="acoes"><button type="button" class="btn btn-secundario btn-pequeno" data-ed="' + d.id + '">Editar</button><button type="button" class="btn btn-texto" data-ex="' + d.id + '">Excluir</button></div></div>';
      }).join("") + "</div>" : '<p class="nota" style="margin-top:14px">Nenhum registro ainda.</p>'));
    var editando = null, f = document.getElementById("fDiario");
    function marcarHumor(n) { Array.prototype.forEach.call(f.querySelectorAll('input[name="humor"]'), function (i) { i.checked = String(n) === i.value; }); }
    app.querySelectorAll("[data-ed]").forEach(function (b) {
      b.addEventListener("click", function () {
        var d = r.diario.filter(function (x) { return x.id === b.getAttribute("data-ed"); })[0]; if (!d) return;
        editando = d.id; document.getElementById("dData").value = d.data; document.getElementById("dTorneio").value = d.torneioId || ""; document.getElementById("dTexto").value = d.texto; marcarHumor(d.humor || "");
        document.getElementById("tDiario").textContent = "Editar registro"; document.getElementById("btSalvarD").textContent = "Salvar alterações"; document.getElementById("btCancelarD").hidden = false; f.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
    document.getElementById("btCancelarD").addEventListener("click", function () { telaDiario(); });
    app.querySelectorAll("[data-shdiario]").forEach(function (b) {
      b.addEventListener("click", async function () {
        var id = b.getAttribute("data-shdiario"), ids = Array.prototype.map.call(app.querySelectorAll('input[name="sh-' + id + '"]:checked:not(:disabled)'), function (i) { return i.value; });
        ocupado(b, true, "Salvando…");
        try { await api("player-torneios", { metodo: "POST", corpo: { acao: "compartilharDiario", id: id, vinculoIds: ids } }); toast(ids.length ? "Registro compartilhado." : "Registro privado."); telaDiario(); }
        catch (e) { toast(e.message, null, true); ocupado(b, false); }
      });
    });
    app.querySelectorAll("[data-ex]").forEach(function (b) {
      b.addEventListener("click", async function () {
        if (!window.confirm("Excluir este registro do diário?")) return;
        try { await api("player-torneios", { metodo: "POST", corpo: { acao: "excluirDiario", id: b.getAttribute("data-ex") } }); toast("Registro excluído."); telaDiario(); } catch (e) { toast(e.message, null, true); }
      });
    });
    f.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var av = document.getElementById("avisoD"); av.hidden = true;
      var h = f.querySelector('input[name="humor"]:checked'), bt = document.getElementById("btSalvarD"); ocupado(bt, true, "Salvando…");
      try {
        await api("player-torneios", { metodo: "POST", corpo: { acao: "salvarDiario", id: editando || undefined, data: document.getElementById("dData").value, torneioId: document.getElementById("dTorneio").value || null, texto: document.getElementById("dTexto").value, humor: h ? parseInt(h.value, 10) : null } });
        toast("Registro salvo."); telaDiario();
      } catch (e) { av.textContent = e.message; av.hidden = false; ocupado(bt, false); }
    });
  }

  /* ══ Competição: devolutivas do treinador e focos de treino ══ */
  var STATUS_FOCO_ROT = { aberto: "A trabalhar", treinando: "Em treino", resolvido: "Resolvido" };
  function devolutivaHtml(d, acoes) {
    return '<article class="cartao comp-dev"><p class="olho">' + esc(d.refRotulo || "Geral") + " · " + dataCurta(String(d.criadoEm).slice(0, 10)) + "</p><h2>" + esc(d.autorNome || "Treinador") + "</h2>" +
      (d.destaques ? '<p class="comp-dev-bloco"><strong>O que foi bem</strong>' + esc(d.destaques) + "</p>" : "") +
      (d.melhorar ? '<p class="comp-dev-bloco"><strong>O que melhorar</strong>' + esc(d.melhorar) + "</p>" : "") +
      (d.recomendacao ? '<p class="comp-dev-bloco comp-dev-texto">' + esc(d.recomendacao) + "</p>" : "") +
      (d.foco ? '<p class="comp-dev-bloco comp-dev-foco"><strong>Foco de treino</strong>' + esc(d.foco) + "</p>" : "") + (acoes || "") + "</article>";
  }
  async function telaDevolutivas() {
    tela('<p class="carregando">Carregando…</p>', true);
    var r;
    try { r = await api("player-torneios"); }
    catch (e) { tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/inicio">‹ Início</a></p><div class="aviso">' + esc(e.message) + "</div>"); return; }
    tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/inicio">‹ Início</a></p><h1>Devolutivas</h1><p class="sub">O que o seu treinador observou nos seus torneios e partidas.</p>' +
      (r.devolutivas.length ? r.devolutivas.map(function (d) {
        return devolutivaHtml(d, d.foco ? '<div class="acoes"><button type="button" class="btn btn-laranja btn-pequeno" data-levar="' + d.id + '">Levar para o treino</button></div>' : "");
      }).join("") : '<div class="cartao" style="margin-top:14px"><h2>Nenhuma devolutiva ainda</h2><p class="nota" style="margin-top:6px">Quando um treinador vinculado a você escrever uma devolutiva, ela aparece aqui. Convide o seu treinador em <a href="#/inicio">Início</a>.</p></div>'));
    app.querySelectorAll("[data-levar]").forEach(function (b) {
      b.addEventListener("click", async function () {
        ocupado(b, true, "Levando…");
        try { var x = await api("player-torneios", { metodo: "POST", corpo: { acao: "levarParaTreino", devolutivaId: b.getAttribute("data-levar") } }); toast(x.novos ? "Foco adicionado ao seu treino." : "Esse foco já está no seu treino."); ir("#/focos"); }
        catch (e) { toast(e.message, null, true); ocupado(b, false); }
      });
    });
  }
  async function telaFocos() {
    tela('<p class="carregando">Carregando…</p>', true);
    var r;
    try { r = await api("player-torneios"); }
    catch (e) { tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/inicio">‹ Início</a></p><div class="aviso">' + esc(e.message) + "</div>"); return; }
    var ordem = ["aberto", "treinando", "resolvido"];
    tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/inicio">‹ Início</a></p><h1>Foco de treino</h1><p class="sub">O que levar do jogo para a quadra de treino.</p>' +
      (r.focos.length ? ordem.map(function (st) {
        var itens = r.focos.filter(function (f) { return f.status === st; });
        if (!itens.length) return "";
        return '<h2 class="secao">' + STATUS_FOCO_ROT[st] + " · " + itens.length + '</h2><div class="comp-torneios">' + itens.map(function (f) {
          return '<div class="cartao comp-foco"><p class="olho">' + esc(f.origemRotulo || "") + "</p><h2>" + esc(f.texto) + "</h2>" +
            '<div class="comp-seg" role="group" aria-label="Situação do foco">' + ordem.map(function (s2) { return '<button type="button" class="comp-seg-bt" data-foco="' + f.id + '" data-st="' + s2 + '" aria-pressed="' + (s2 === f.status) + '">' + STATUS_FOCO_ROT[s2] + "</button>"; }).join("") + "</div>" +
            '<div class="acoes"><a class="btn btn-secundario btn-pequeno" href="#/desafios">Desafios</a><button type="button" class="btn btn-texto" data-excluir-foco="' + f.id + '">Excluir</button></div></div>';
        }).join("") + "</div>";
      }).join("") : '<div class="cartao" style="margin-top:14px"><h2>Nenhum foco ainda</h2><p class="nota" style="margin-top:6px">Depois de uma partida, abra o registro e toque em “Levar para o treino”, ou use o foco sugerido numa <a href="#/devolutivas">devolutiva</a>.</p></div>') +
      '<p class="nota" style="margin-top:14px">Seu treinador vê estes focos se você compartilhar “Treinos” no vínculo.</p>');
    app.querySelectorAll("[data-foco]").forEach(function (b) {
      b.addEventListener("click", async function () {
        try { await api("player-torneios", { metodo: "POST", corpo: { acao: "atualizarFoco", id: b.getAttribute("data-foco"), status: b.getAttribute("data-st") } }); telaFocos(); } catch (e) { toast(e.message, null, true); }
      });
    });
    app.querySelectorAll("[data-excluir-foco]").forEach(function (b) {
      b.addEventListener("click", async function () {
        if (!window.confirm("Excluir este foco?")) return;
        try { await api("player-torneios", { metodo: "POST", corpo: { acao: "excluirFoco", id: b.getAttribute("data-excluir-foco") } }); telaFocos(); } catch (e) { toast(e.message, null, true); }
      });
    });
  }

  /* ══ Competição: scouts do treinador ══
     O atleta cola o link de família que o treinador gerou. O servidor confere o link, guarda uma cópia na conta do atleta e a reconfere a
     cada abertura: se o treinador desativar o link, o conteúdo some desta tela. O token do link nunca volta para o navegador. */
  var SC_ZONAS = { "D-REDE": "Direita · rede", "D-APR": "Direita · aproximação", "D-FUNDO": "Direita · fundo", "E-REDE": "Esquerda · rede", "E-APR": "Esquerda · aproximação", "E-FUNDO": "Esquerda · fundo" };
  var SC_JANELA = 6;
  function scSerie(serie) {
    var saldo = 0;
    return (serie || []).map(function (x, i) {
      var nos = !!x[0], mom = 0, ini = Math.max(0, i - SC_JANELA + 1);
      saldo += nos ? 1 : -1;
      for (var k = ini; k <= i; k++) mom += serie[k][0] ? 1 : -1;
      return { n: i + 1, nos: nos, mom: mom, set: x[1] };
    });
  }
  function scSequencias(lista) {
    var melhor = { tam: 0, ini: 0, fim: 0 }, pior = { tam: 0, ini: 0, fim: 0 }, at = null;
    lista.forEach(function (x) {
      if (at && at.nos === x.nos) at.tam++; else at = { nos: x.nos, tam: 1, ini: x.n };
      at.fim = x.n;
      var alvo = x.nos ? melhor : pior;
      if (at.tam > alvo.tam) { alvo.tam = at.tam; alvo.ini = at.ini; alvo.fim = at.fim; }
    });
    return { melhor: melhor, pior: pior };
  }
  /* ── gráfico do momento do jogo ──
     Curva suave do saldo dos últimos 6 pontos, com preenchimento em degradê acima (a favor) e abaixo (contra) da linha de zero,
     faixas nas maiores sequências, divisões por set e um cursor que acompanha o dedo ou o mouse. Só usa os pontos coletados. */
  var MOM_J = 6, momUid = 0;
  function momSuave(pts) {
    var d = "M" + pts[0][0].toFixed(1) + " " + pts[0][1].toFixed(1);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += " C" + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + " " + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + " " + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + " " + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + " " + p2[0].toFixed(1) + " " + p2[1].toFixed(1);
    }
    return d;
  }
  function momentoGrafico(alvo, lista, inicios, opt) {
    opt = opt || {};
    var W = 600, H = 250, pl = 30, pr = 14, pt = 28, pb = 26, J = MOM_J, n = lista.length, id = "mg" + (++momUid);
    var POS = opt.pos || "#0F7A4A", NEG = opt.neg || "#D23B3B", nome = String(opt.nome || "o atleta").replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; });
    function x(i) { return pl + (n <= 1 ? 0 : (i / (n - 1)) * (W - pl - pr)); }
    function y(m) { return pt + (J - m) / (2 * J) * (H - pt - pb); }
    var y0 = y(0), pts = lista.map(function (p, i) { return [x(i), y(p.mom)]; }), linha = momSuave(pts);
    var area = linha + " L" + x(n - 1).toFixed(1) + " " + y0.toFixed(1) + " L" + x(0).toFixed(1) + " " + y0.toFixed(1) + " Z";
    var larg = W - pl - pr, ultimo = lista[n - 1], corUlt = ultimo.mom >= 0 ? POS : NEG;
    var o = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Gráfico do momento do jogo, ponto a ponto" style="display:block;width:100%;height:auto;touch-action:pan-y">' +
      "<defs>" +
      '<linearGradient id="' + id + 'p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + POS + '" stop-opacity=".45"/><stop offset="1" stop-color="' + POS + '" stop-opacity=".03"/></linearGradient>' +
      '<linearGradient id="' + id + 'n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + NEG + '" stop-opacity=".03"/><stop offset="1" stop-color="' + NEG + '" stop-opacity=".42"/></linearGradient>' +
      '<clipPath id="' + id + 'c"><rect x="' + pl + '" y="' + pt + '" width="' + larg + '" height="' + (y0 - pt) + '"/></clipPath>' +
      '<clipPath id="' + id + 'b"><rect x="' + pl + '" y="' + y0 + '" width="' + larg + '" height="' + (H - pb - y0) + '"/></clipPath></defs>';
    [-J / 2, J / 2].forEach(function (v) { o += '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#E3E8E5" stroke-dasharray="2 4"/>'; });
    /* faixas das maiores sequências */
    var bandas = [], at = null, mel = { tam: 0 }, pio = { tam: 0 };
    lista.forEach(function (p, i) {
      if (at && at.nos === p.nos) at.tam++; else at = { nos: p.nos, tam: 1, ini: i };
      at.fim = i;
      var alvoSeq = p.nos ? mel : pio;
      if (at.tam > alvoSeq.tam) { alvoSeq.tam = at.tam; alvoSeq.ini = at.ini; alvoSeq.fim = at.fim; }
    });
    [[mel, POS, "a favor"], [pio, NEG, "contra"]].forEach(function (b) {
      var s = b[0]; if (s.tam < 4) return;
      var xa = x(s.ini), xb = x(s.fim), cx = (xa + xb) / 2, rot = s.tam + " seguidos", lw = rot.length * 5.6 + 14;
      o += '<rect x="' + xa.toFixed(1) + '" y="' + pt + '" width="' + Math.max(xb - xa, 3).toFixed(1) + '" height="' + (H - pt - pb) + '" fill="' + b[1] + '" fill-opacity=".07"/>' +
        '<rect x="' + (cx - lw / 2).toFixed(1) + '" y="' + (pt - 22) + '" width="' + lw.toFixed(1) + '" height="17" rx="8.5" fill="#fff" stroke="' + b[1] + '" stroke-opacity=".5"/>' +
        '<text x="' + cx.toFixed(1) + '" y="' + (pt - 10) + '" text-anchor="middle" font-size="10" font-weight="700" fill="' + b[1] + '">' + rot + "</text>";
    });
    o += '<path d="' + area + '" fill="url(#' + id + 'p)" clip-path="url(#' + id + 'c)"/><path d="' + area + '" fill="url(#' + id + 'n)" clip-path="url(#' + id + 'b)"/>' +
      '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y0 + '" y2="' + y0 + '" stroke="#5B6B63" stroke-opacity=".55" stroke-width="1.2"/>' +
      '<path d="' + linha + '" fill="none" stroke="' + POS + '" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" clip-path="url(#' + id + 'c)"/>' +
      '<path d="' + linha + '" fill="none" stroke="' + NEG + '" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" clip-path="url(#' + id + 'b)"/>';
    [[J, "+" + J], [0, "0"], [-J, "−" + J]].forEach(function (v) { o += '<text x="' + (pl - 7) + '" y="' + (y(v[0]) + 3.5) + '" text-anchor="end" font-size="10" fill="#7A8580">' + v[1] + "</text>"; });
    (inicios || []).forEach(function (it) {
      if (it.i <= 0 || it.i >= n) return;
      o += '<line x1="' + x(it.i).toFixed(1) + '" x2="' + x(it.i).toFixed(1) + '" y1="' + pt + '" y2="' + (H - pb) + '" stroke="#9AA6A0" stroke-dasharray="3 3"/><text x="' + (x(it.i) + 5).toFixed(1) + '" y="' + (H - pb - 6) + '" font-size="9.5" font-weight="700" letter-spacing=".08em" fill="#7A8580">SET ' + (it.set + 1) + "</text>";
    });
    var passo = Math.max(1, Math.ceil(n / 6));
    for (var k = 0; k < n; k += passo) o += '<text x="' + x(k).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="10" fill="#7A8580">' + lista[k].n + "</text>";
    o += (opt.aoVivo ? '<circle cx="' + x(n - 1).toFixed(1) + '" cy="' + y(ultimo.mom).toFixed(1) + '" r="5" fill="' + corUlt + '" fill-opacity=".35"><animate attributeName="r" values="5;11;5" dur="1.6s" repeatCount="indefinite"/><animate attributeName="fill-opacity" values=".4;0;.4" dur="1.6s" repeatCount="indefinite"/></circle>' : "") +
      '<circle cx="' + x(n - 1).toFixed(1) + '" cy="' + y(ultimo.mom).toFixed(1) + '" r="4.2" fill="#fff" stroke="' + corUlt + '" stroke-width="2.4"/>' +
      '<line class="mg-cur" y1="' + pt + '" y2="' + (H - pb) + '" stroke="#17251F" stroke-opacity=".5" style="display:none"/><circle class="mg-dot" r="4.8" fill="#fff" stroke="#17251F" stroke-width="2" style="display:none"/></svg>';
    alvo.innerHTML = '<div style="position:relative">' + o + '<div class="mg-tip" hidden style="position:absolute;top:0;pointer-events:none;background:#fff;border:1px solid #DDE5E0;border-radius:10px;padding:6px 10px;font:12px/1.35 system-ui,sans-serif;color:#17251F;box-shadow:0 8px 22px rgba(0,0,0,.14);white-space:nowrap;z-index:2"></div></div>';
    var svg = alvo.querySelector("svg"), tip = alvo.querySelector(".mg-tip"), cur = svg.querySelector(".mg-cur"), dot = svg.querySelector(".mg-dot");
    function mover(ev) {
      var r = svg.getBoundingClientRect(), vx = (ev.clientX - r.left) / r.width * W;
      var i = Math.max(0, Math.min(n - 1, Math.round((vx - pl) / larg * (n - 1)))), p = lista[i];
      cur.setAttribute("x1", x(i)); cur.setAttribute("x2", x(i)); cur.style.display = "";
      dot.setAttribute("cx", x(i)); dot.setAttribute("cy", y(p.mom)); dot.style.display = "";
      tip.innerHTML = "<b>Ponto " + p.n + (inicios && inicios.length ? " · Set " + (p.set + 1) : "") + "</b><br>" + (p.nos ? "Ponto de " + nome : "Ponto do adversário") + "<br>Momento: " + (p.mom > 0 ? "+" : p.mom < 0 ? "−" : "") + Math.abs(p.mom);
      tip.hidden = false;
      var px = x(i) / W * r.width, tw = tip.offsetWidth;
      tip.style.left = Math.max(0, Math.min(r.width - tw, px - tw / 2)) + "px";
    }
    function sair() { cur.style.display = "none"; dot.style.display = "none"; tip.hidden = true; }
    svg.addEventListener("pointermove", mover); svg.addEventListener("pointerdown", mover); svg.addEventListener("pointerleave", sair); svg.addEventListener("pointercancel", sair);
  }
  function scMapaHtml(z, atleta) {
    var total = 0; Object.keys(z || {}).forEach(function (k) { total += z[k].n; });
    if (total < 5) return "";
    var h = '<h2 class="secao">Mapa da quadra</h2><div class="cartao"><p class="nota">Onde foi o último golpe de ' + esc(atleta) + " em cada ponto marcado (" + total + "). O saldo é pontos ganhos menos perdidos naquela zona.</p>" +
      '<div class="sc-mapa"><span></span><b>Rede</b><b>Aproximação</b><b>Fundo</b>';
    [["D", "Direita"], ["E", "Esquerda"]].forEach(function (l) {
      h += "<b>" + l[1] + "</b>";
      ["REDE", "APR", "FUNDO"].forEach(function (p) {
        var d = z[l[0] + "-" + p];
        if (!d || !d.n) { h += '<span class="sc-cel">—</span>'; return; }
        var saldo = d.ganhos - (d.n - d.ganhos);
        h += '<span class="sc-cel ' + (saldo > 0 ? "pos" : saldo < 0 ? "neg" : "") + '"><strong>' + (saldo > 0 ? "+" : "") + saldo + "</strong>" + d.n + (d.n === 1 ? " ponto" : " pontos") + "</span>";
      });
    });
    return h + "</div></div>";
  }
  function scBolasHtml(r) {
    var b = r.bolas, cores = ["#1242CC", "#002418", "#5A6373"];
    return '<h2 class="secao">Onde o ponto se decidiu</h2><div class="cartao"><div class="sc-barra" role="img" aria-label="Pontos por duração: ' + b.pctCurtos + "% em 1–2 bolas, " + b.pctMedios + "% em 3–4, " + b.pctLongos + '% em 5 ou mais">' +
      [["1–2 bolas", b.pctCurtos], ["3–4 bolas", b.pctMedios], ["5+ bolas", b.pctLongos]].map(function (x, i) { return '<span style="width:' + Math.max(x[1], 4) + "%;background:" + cores[i] + '">' + x[1] + "%</span>"; }).join("") +
      '</div><p class="nota">' + b.pctAte4 + "% dos pontos terminaram em até quatro bolas. Cerca de 70% dos pontos do circuito terminam em até quatro bolas.</p></div>";
  }
  function scNumerosHtml(r) {
    var nm = r.numeros, l = [["Pontos coletados", r.n], ["Pontos ganhos", r.ganhos + " · " + r.pctGanhos + "%"], ["Erros de " + r.atleta, nm.errosNos + " (" + nm.errosDecisao + " por decisão, " + nm.errosExec + " por execução)"], ["Duplas faltas", nm.df]];
    if (nm.aces || nm.acesAdv || nm.dfAdv || nm.pctPrimeiroAdv) l.push(["Aces", r.atleta + " " + (nm.aces || 0) + " · adversário " + (nm.acesAdv || 0)], ["Saque do adversário", (nm.pctPrimeiroAdv ? nm.pctPrimeiroAdv + "% de 1º saque dentro · " : "") + (nm.dfAdv || 0) + " duplas faltas"]);
    if (nm.nSacD || nm.nSacE) l.push(["Pontos ganhos no saque de " + r.atleta, "igualdade " + (nm.nSacD ? nm.pctSacD + "% (" + nm.nSacD + ")" : "—") + " · vantagem " + (nm.nSacE ? nm.pctSacE + "% (" + nm.nSacE + ")" : "—")]);
    if (nm.nDevD || nm.nDevE) l.push(["Pontos ganhos no saque do adversário", "igualdade " + (nm.nDevD ? nm.pctDevD + "% (" + nm.nDevD + ")" : "—") + " · vantagem " + (nm.nDevE ? nm.pctDevE + "% (" + nm.nDevE + ")" : "—")]);
    if (nm.nAtaque || nm.nContra || nm.nDefesa) l.push(["Ataque", nm.nAtaque + (nm.nAtaque ? " · " + nm.pctAtaque + "% ganhos" : "")], ["Contra-ataque", nm.nContra + (nm.nContra ? " · " + nm.pctContra + "% ganhos" : "")], ["Defesa", nm.nDefesa + (nm.nDefesa ? " · " + nm.pctDefesa + "% ganhos" : "")]);
    if (nm.pctProtocolo) l.push(["Protocolo entre pontos", nm.pctProtocolo + "%"]);
    l.push(["Subidas à rede", nm.rede + " · " + nm.redeGanha + " convertidas"]);
    if (nm.ataquePerdido) l.push(["Demandas de ataque perdidas", nm.ataquePerdido]);
    return '<h2 class="secao">O jogo em números</h2><div class="cartao"><dl class="comp-perfil">' + l.map(function (x) { return "<dt>" + esc(x[0]) + "</dt><dd>" + esc(x[1]) + "</dd>"; }).join("") + "</dl></div>";
  }
  function scMetricas() {
    function seq(r, t) { var s = scSerie(r.serie); return s.length >= SC_JANELA ? scSequencias(s)[t].tam : null; }
    var m = [
      ["O jogo", "Pontos coletados", function (r) { return r.n; }, null, ""], ["", "Pontos ganhos", function (r) { return r.pctGanhos; }, true, "%"],
      ["Onde o ponto se decidiu", "Em 1–2 bolas", function (r) { return r.bolas.pctCurtos; }, null, "%"], ["", "Em 3–4 bolas", function (r) { return r.bolas.pctMedios; }, null, "%"], ["", "Em 5 bolas ou mais", function (r) { return r.bolas.pctLongos; }, null, "%"],
      ["Erros e hábitos", "Erros", function (r) { return r.numeros.errosNos; }, false, ""], ["", "— por decisão", function (r) { return r.numeros.errosDecisao; }, false, ""], ["", "— por execução", function (r) { return r.numeros.errosExec; }, false, ""],
      ["", "Duplas faltas", function (r) { return r.numeros.df; }, false, ""], ["", "Aces", function (r) { return r.numeros.aces != null ? r.numeros.aces : null; }, true, ""], ["", "1º saque do adversário dentro", function (r) { return r.numeros.pctPrimeiroAdv || null; }, null, "%"],
      ["", "Ganhos no saque · igualdade", function (r) { return r.numeros.nSacD ? r.numeros.pctSacD : null; }, true, "%"], ["", "Ganhos no saque · vantagem", function (r) { return r.numeros.nSacE ? r.numeros.pctSacE : null; }, true, "%"],
      ["", "Ganhos em ataque", function (r) { return r.numeros.nAtaque ? r.numeros.pctAtaque : null; }, true, "%"], ["", "Ganhos em contra-ataque", function (r) { return r.numeros.nContra ? r.numeros.pctContra : null; }, true, "%"], ["", "Ganhos em defesa", function (r) { return r.numeros.nDefesa ? r.numeros.pctDefesa : null; }, true, "%"],
      ["", "Protocolo entre pontos (jogos antigos)", function (r) { return r.numeros.pctProtocolo || null; }, true, "%"],
      ["", "Subidas convertidas", function (r) { return r.numeros.rede ? Math.round(r.numeros.redeGanha / r.numeros.rede * 100) : null; }, true, "%"], ["", "Demandas de ataque perdidas", function (r) { return r.numeros.ataquePerdido || null; }, false, ""],
      ["", "Ganhos em placar adverso", function (r) { return r.numeros.pctAdversos || null; }, true, "%"],
      ["Momento do jogo", "Maior sequência a favor", function (r) { return seq(r, "melhor"); }, true, ""], ["", "Maior sequência contra", function (r) { return seq(r, "pior"); }, false, ""]
    ];
    Object.keys(SC_ZONAS).forEach(function (cod, i) {
      m.push([i === 0 ? "Mapa da quadra (saldo por zona)" : "", SC_ZONAS[cod], function (r) { var z = r.zonas[cod]; return z ? z.ganhos - (z.n - z.ganhos) : null; }, true, ""]);
    });
    return m;
  }
  /* Relatório dos jogos (scout/relatorio-jogos.js): os scouts do treinador que o atleta importou, com gráficos de evolução e comparações.
     No Competição só existe o resumo público de cada jogo (sem os pontos), então o relatório usa os números desse resumo e, quando vierem,
     decisões, game a game e mental. */
  function scTendenciaRel(v, maior) {
    var n = v.length, sx = (n - 1) * n / 2, sx2 = (n - 1) * n * (2 * n - 1) / 6, sy = v.reduce(function (a, b) { return a + b; }, 0), sxy = v.reduce(function (a, b, i) { return a + i * b; }, 0), den = n * sx2 - sx * sx, inc = den ? (n * sxy - sx * sy) / den : 0, tot = inc * (n - 1), est = Math.abs(tot) < 1, mel = maior ? inc > 0 : inc < 0;
    return { media: sy / n, variacaoTotal: tot, estavel: est, melhorou: !est && mel, cor: est ? "#5B6B63" : (mel ? "#1F6B4A" : "#A6432F"), seta: est ? "→" : (inc > 0 ? "▲" : "▼") };
  }
  function scMetricasRel() {
    function seq(s, t) { var se = scSerie(s.serie); return se.length >= SC_JANELA ? scSequencias(se)[t].tam : null; }
    function m1(grupo, k, rot, suf, melhor, get) { return { grupo: grupo || undefined, k: k, rot: rot, suf: suf, melhor: melhor, get: get }; }
    var m = [
      m1("O jogo", "n", "Pontos coletados", "", null, function (s) { return s.n; }),
      m1("", "pctGanhos", "Pontos ganhos", "%", true, function (s) { return s.pctGanhos; }),
      m1("Onde o ponto se decidiu", "pctCurtos", "Em 1–2 bolas", "%", null, function (s) { return s.pctCurtos; }),
      m1("", "pctMedios", "Em 3–4 bolas", "%", null, function (s) { return s.pctMedios; }),
      m1("", "pctLongos", "Em 5 bolas ou mais", "%", null, function (s) { return s.pctLongos; }),
      m1("Erros do atleta", "errosNos", "Erros", "", false, function (s) { return s.errosNos; }),
      m1("", "errosDecisao", "— por decisão", "", false, function (s) { return s.errosDecisao; }),
      m1("", "errosExec", "— por execução", "", false, function (s) { return s.errosExec; }),
      m1("Saque", "pctPrimeiro", "1º saque dentro", "%", true, function (s) { return s.pctPrimeiro || null; }),
      m1("", "df", "Duplas faltas", "", false, function (s) { return s.df; }),
      m1("", "aces", "Aces do atleta", "", true, function (s) { return s.aces != null ? s.aces : null; }),
      m1("", "acesAdv", "Aces do adversário", "", false, function (s) { return s.acesAdv != null ? s.acesAdv : null; }),
      m1("", "dfAdv", "Duplas faltas do adversário", "", null, function (s) { return s.dfAdv != null ? s.dfAdv : null; }),
      m1("", "pctPrimeiroAdv", "1º saque do adversário dentro", "%", null, function (s) { return s.pctPrimeiroAdv || null; }),
      m1("Lado da quadra", "pctSacD", "Ganhos no saque do atleta · igualdade", "%", true, function (s) { return s.nSacD ? s.pctSacD : null; }),
      m1("", "pctSacE", "Ganhos no saque do atleta · vantagem", "%", true, function (s) { return s.nSacE ? s.pctSacE : null; }),
      m1("", "pctDevD", "Ganhos no saque dele · igualdade", "%", true, function (s) { return s.nDevD ? s.pctDevD : null; }),
      m1("", "pctDevE", "Ganhos no saque dele · vantagem", "%", true, function (s) { return s.nDevE ? s.pctDevE : null; }),
      m1("Tipo de ponto", "pctAtaque", "Ganhos em ataque", "%", true, function (s) { return s.nAtaque ? s.pctAtaque : null; }),
      m1("", "pctContra", "Ganhos em contra-ataque", "%", true, function (s) { return s.nContra ? s.pctContra : null; }),
      m1("", "pctDefesa", "Ganhos em defesa", "%", true, function (s) { return s.nDefesa ? s.pctDefesa : null; }),
      m1("Hábitos e decisões", "redeConv", "Subidas à rede convertidas", "%", true, function (s) { return s.rede ? Math.round(s.redeGanha / s.rede * 100) : null; }),
      m1("", "ataquePerdido", "Demandas de ataque perdidas", "", false, function (s) { return s.ataquePerdido || null; }),
      m1("Sob pressão", "pctAdversos", "Ganhos em placar adverso", "%", true, function (s) { return s.pctAdversos || null; }),
      m1("Momento do jogo", "seqFavor", "Maior sequência a favor (pontos)", "", true, function (s) { return seq(s, "melhor"); }),
      m1("", "seqContra", "Maior sequência contra (pontos)", "", false, function (s) { return seq(s, "pior"); })
    ];
    Object.keys(SC_ZONAS).forEach(function (cod, i) { m.push(m1(i === 0 ? "Mapa da quadra (saldo por zona)" : "", "zona-" + cod, SC_ZONAS[cod], "", true, function (s) { var z = (s.zonas || {})[cod]; return z ? z.ganhos - (z.n - z.ganhos) : null; })); });
    return m;
  }
  function abrirRelatorioScouts(ativos) {
    var lista = ativos.filter(function (x) { return x.resumo; });
    if (!lista.length) { toast("Sem scouts ativos para o relatório.", null, true); return; }
    if (!window.QLRelatorioJogos) { toast("Não foi possível carregar o relatório. Recarregue a página.", null, true); return; }
    var w = window.open("", "_blank");
    if (!w) { toast("O navegador bloqueou a janela do relatório. Permita pop-ups para este site.", null, true); return; }
    var jogos = lista.slice().sort(function (a, b) { return String(a.data).localeCompare(String(b.data)); }).map(function (x) {
      var rs = x.resumo, flat = Object.assign({}, rs, rs.numeros, rs.bolas);
      return { id: x.id, data: rs.data || x.data, torneio: rs.torneio || "", adversario: "", resultado: rs.resultado || "", concluida: rs.concluida !== false, nivelAdversario: rs.nivelAdversario || "", observacaoFinal: rs.observacaoFinal || "", mental: rs.mental || null, scout: flat };
    });
    var html;
    try {
      html = window.QLRelatorioJogos.gerar({
        atleta: jogos[0].scout.atleta || "Atleta", jogos: jogos, metricas: scMetricasRel(), tendencia: scTendenciaRel,
        leitura: function (s) { return (s.sinais || []).map(function (t) { return ["", t]; }); },
        detalheDe: function (r) { return r.scout.detalhe || null; }, zonasDe: function (_p, s) { return s.zonas || {}; },
        cabecalhoHtml: '<div style="border-bottom:3px solid #103B32;padding-bottom:10px;margin-bottom:16px"><div style="font-weight:800;font-size:13px;letter-spacing:.04em;color:#103B32">QUADRALAB · COMPETIÇÃO</div></div>',
        geradoEm: new Date().toLocaleDateString("pt-BR")
      });
    } catch (e) { w.close(); toast("Não foi possível montar o relatório: " + e.message, null, true); return; }
    w.document.write(html); w.document.close();
  }
  function relBotaoHtml(id, n) {
    return '<div class="cartao" style="margin-top:14px"><h2>Relatório dos jogos</h2><p class="nota" style="margin-top:6px">Reúne ' + (n === 1 ? "o scout ativo" : "os " + n + " scouts ativos") + ' em um documento com gráficos de evolução, comparação de todos os dados, pontos fortes e de atenção e o resumo de cada jogo. Abre pronto para salvar como PDF.</p><div class="acoes"><button type="button" class="btn btn-laranja" id="' + id + '">Exportar relatório dos jogos</button></div></div>';
  }
  function scComparacaoHtml(ativos) {
    if (ativos.length < 2) return "";
    var jogos = ativos.slice().sort(function (a, b) { return String(a.data).localeCompare(String(b.data)); }), M = scMetricas();
    var h = '<h2 class="secao">Comparar jogos · ' + jogos.length + '</h2><p class="nota">Cada coluna é um scout do treinador (J1 é o mais antigo). Em verde o melhor jogo da linha, em vermelho o pior, quando “melhor” tem sentido. “—” é o que aquele jogo não registrou.</p>' +
      '<div class="sc-tabela" tabindex="0" role="region" aria-label="Comparação dos scouts jogo a jogo"><table><thead><tr><th>Medida</th>' + jogos.map(function (j, i) { return "<th>J" + (i + 1) + "<small>" + esc(dataCurta(j.data).slice(0, 5)) + "</small></th>"; }).join("") + "<th>Média</th></tr></thead><tbody>";
    M.forEach(function (m) {
      var v = jogos.map(function (j) { var x = m[2](j.resumo); return typeof x === "number" && isFinite(x) ? x : null; }), ok = v.filter(function (x) { return x !== null; });
      if (!ok.length) return;
      var mx = Math.max.apply(null, ok), mn = Math.min.apply(null, ok), dif = ok.length >= 2 && mx !== mn, media = ok.reduce(function (a, b) { return a + b; }, 0) / ok.length;
      if (m[0]) h += '<tr><td class="sc-grupo" colspan="' + (jogos.length + 2) + '">' + esc(m[0]) + "</td></tr>";
      h += "<tr><th scope=\"row\">" + esc(m[1]) + "</th>" + v.map(function (x) {
        var bom = dif && x !== null && m[3] !== null && x === (m[3] ? mx : mn), ruim = dif && x !== null && m[3] !== null && x === (m[3] ? mn : mx);
        return '<td class="' + (bom ? "pos" : ruim ? "neg" : "") + '">' + (x === null ? "—" : x + m[4]) + "</td>";
      }).join("") + "<td>" + (Math.round(media * 10) / 10) + m[4] + "</td></tr>";
    });
    return h + "</tbody></table></div>";
  }
  var SC_ASPECTOS_ROT = {};
  function scAtletaVsTreinadorHtml(sc, partida) {
    var op = (estado.dados && estado.dados.opcoesPartida && estado.dados.opcoesPartida.aspectos) || {}, r = sc.resumo, nm = r.numeros;
    var dif = (partida.dificuldades || []).map(function (a) { return op[a] || a; });
    return '<h2 class="secao">Sua leitura × o scout do treinador</h2><div class="cartao"><p class="nota">Lado a lado, sem conclusão automática: o que você registrou na partida e o que o treinador mediu.</p>' +
      '<div class="comp-duas" style="margin-top:10px"><div><p class="olho">Você registrou</p><p>' + (partida.resultado === "vitoria" ? "Vitória" : "Derrota") + (partida.placar ? " · " + esc(partida.placar) : "") + "</p>" +
      (partida.execucao ? "<p>Execução da estratégia: " + partida.execucao + " de 5</p>" : "") + (dif.length ? "<p>Dificuldades: " + esc(dif.join(", ")) + "</p>" : "<p class=\"nota\">Sem dificuldades marcadas.</p>") + "</div>" +
      '<div><p class="olho">Scout do treinador</p><p>' + esc(r.resultado || "") + " · " + r.pctGanhos + "% dos pontos</p><p>Erros: " + nm.errosNos + " (" + nm.errosDecisao + " por decisão, " + nm.errosExec + " por execução)</p>" + (nm.aces || nm.acesAdv ? "<p>Aces: " + (nm.aces || 0) + " · adversário " + (nm.acesAdv || 0) + "</p>" : "") + "</div></div></div>";
  }
  /* partes do scout reaproveitadas pela tela do atleta, pela do responsável/treinador e pelo jogo ao vivo */
  function scSets(serie) { var sets = []; serie.forEach(function (x) { if (sets.indexOf(x.set) < 0) sets.push(x.set); }); return sets; }
  function scMomentoHtml(rs) {
    var serie = scSerie(rs.serie), sets = scSets(serie);
    return serie.length >= SC_JANELA ? '<h2 class="secao">Momento do jogo</h2><div class="cartao"><p class="nota">A linha é o saldo dos últimos ' + SC_JANELA + " pontos. Acima de zero, o jogo estava a favor de " + esc(rs.atleta) + "; abaixo, a favor do adversário.</p>" +
          (sets.length > 1 ? '<div class="comp-seg" role="group" aria-label="Escolher a parte do jogo" id="scAbas"><button type="button" class="comp-seg-bt" data-v="todo" aria-pressed="true">Jogo todo</button>' + sets.map(function (st) { return '<button type="button" class="comp-seg-bt" data-v="' + st + '" aria-pressed="false">Set ' + (st + 1) + "</button>"; }).join("") + "</div>" : "") +
          '<div id="scGrafico"></div><p class="nota" id="scResumo"></p></div>' : "";
  }
  function scMomentoLigar(rs) {
    var serie = scSerie(rs.serie), sets = scSets(serie);
    var abas = document.getElementById("scAbas"), area = document.getElementById("scGrafico"), resumoEl = document.getElementById("scResumo");
      function mostrar(v) {
        if (!area) return;
        if (abas) Array.prototype.forEach.call(abas.children, function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-v") === v)); });
        var lista = v === "todo" ? serie : serie.filter(function (x) { return String(x.set) === v; }), inicios = [];
        if (v === "todo") sets.slice(1).forEach(function (st) { for (var i = 0; i < serie.length; i++) if (serie[i].set === st) { inicios.push({ i: i, set: st }); break; } });
        momentoGrafico(area, lista, inicios, { pos: "#1242CC", neg: "#D23B3B", nome: rs.atleta });
        var sq = scSequencias(lista);
        resumoEl.textContent = "Do ponto " + lista[0].n + " ao " + lista[lista.length - 1].n + ": " + (sq.melhor.tam >= 3 ? "maior sequência a favor, " + sq.melhor.tam + " pontos seguidos (" + sq.melhor.ini + " a " + sq.melhor.fim + "). " : "sem sequência a favor de 3 pontos ou mais. ") +
          (sq.pior.tam >= 3 ? "Maior sequência contra, " + sq.pior.tam + " pontos seguidos (" + sq.pior.ini + " a " + sq.pior.fim + ")." : "Sem sequência contra de 3 pontos ou mais.");
      }
      if (area) { mostrar("todo"); if (abas) Array.prototype.forEach.call(abas.children, function (b) { b.addEventListener("click", function () { mostrar(b.getAttribute("data-v")); }); }); }
  }
  /* contagem ponto a ponto dentro de uma caixa com rolagem (o mais recente em cima): a página não cresce a cada ponto */
  var FIM_ROT_SC = { winner_nos: "Winner do atleta", erro_dele: "Erro do adversário", erro_nos: "Erro do atleta", winner_dele: "Winner do adversário" };
  function scContagemHtml(rs) {
    var serie = rs.serie || [];
    if (!serie.length) return '<h2 class="secao">Contagem ponto a ponto</h2><div class="cartao"><p class="nota">Aguardando o primeiro ponto…</p></div>';
    var ult = serie[serie.length - 1], tem = ult.length > 2 && ult[2], atual = tem ? (/^(Game|Set)/.test(ult[2]) ? "0-0" : ult[2]) : "";
    var dots = serie.slice(-12).map(function (x) { return '<i class="' + (x[0] ? "v" : "") + '"></i>'; }).join("");
    var itens = ""; for (var i = serie.length - 1; i >= 0; i--) { var x = serie[i], marco = /^(Game|Set)/.test(x[2] || ""); itens += '<li class="' + (marco ? "marco" : "") + '"><span class="n">#' + (i + 1) + "</span><span>" + (x[0] ? "Ponto de " + esc(rs.atleta) : "Ponto do adversário") + (FIM_ROT_SC[x[3]] ? "<small>" + esc(FIM_ROT_SC[x[3]]) + "</small>" : "") + '</span><span class="q ' + (x[0] ? "v" : "c") + '">' + esc(x[2] || "") + "</span></li>"; }
    return '<h2 class="secao">Contagem ponto a ponto</h2><div class="cartao">' + (tem ? '<div class="sc-agora"><div><div class="gl">' + (rs.concluida ? "Último ponto" : "Pontos do game") + '</div><div class="gr">' + esc(rs.concluida ? ult[2] : atual) + '</div></div><div class="gl" style="text-align:right">Games e sets: ' + esc(rs.resultado && rs.resultado !== "—" ? rs.resultado : "—") + "</div></div>" : "") +
      '<div class="sc-pts" role="img" aria-label="Últimos pontos: verde ganhos por ' + esc(rs.atleta) + ', vermelho do adversário">' + dots + '</div><p class="nota">Do mais recente para o mais antigo. A pontuação é a de depois do ponto. Role dentro da caixa para ver os anteriores (' + serie.length + ' no total).</p>' +
      '<div class="sc-logbox" tabindex="0" role="region" aria-label="Lista dos pontos"><ol class="sc-log">' + itens + "</ol></div></div>";
  }
  function scSinaisHtml(rs) {
    return '<h2 class="secao">O que este jogo aponta</h2><div class="cartao">' + (rs.sinais && rs.sinais.length ? rs.sinais.map(function (x) { return '<p class="comp-dev-bloco">' + esc(x) + "</p>"; }).join("") : "<p>Nada fora do esperado nos indicadores coletados.</p>") + '<p class="nota" style="margin-top:8px">Leitura automática pelas regras do método: ponto de partida para a conversa com o treinador, não conclusão. Um jogo é uma amostra.</p></div>';
  }
  /* ── jogo ao vivo e scout completo, sempre dentro do app ──
     O responsável (e o treinador vinculado, e o próprio atleta) cola o link que o treinador compartilhou e acompanha aqui, sem abrir outra página.
     Os dados são os mesmos da página pública (já sem adversário, anotações e caderno); o token é o do link e nunca é guardado. */
  var aoVivoTimer = null, aoVivoId = 0;
  function pararAoVivo() { clearTimeout(aoVivoTimer); aoVivoTimer = null; aoVivoId++; }
  function tokenDoLink(txt) { var t = String(txt || "").trim(), m = /[?&]l=([0-9a-f]{32})(?![0-9a-f])/i.exec(t) || /^([0-9a-f]{32})$/i.exec(t); return m ? m[1].toLowerCase() : null; }
  function scCabecalhoHtml(rs, ao) {
    return '<p class="sub">' + esc([rs.data ? dataCurta(rs.data) : "", rs.torneio].filter(Boolean).join(" · ")) + "</p>" + (rs.resultado && rs.resultado !== "—" ? '<p class="sc-placar">' + esc(rs.resultado) + "</p>" : "");
  }
  function scGraficosHtml(rs) { return rs.n > 0 && window.QLScoutGraficos ? '<div class="qg-app">' + QLScoutGraficos.topo(rs) + QLScoutGraficos.secoes(rs) + "</div>" : ""; }
  function scVistaCompletaHtml(rs) {
    var tem = rs.serie && rs.serie.length && rs.serie.some(function (x) { return x.length > 2 && x[2]; });
    return (tem || (rs.serie && rs.serie.length) ? scContagemHtml(rs) : "") + scGraficosHtml(rs) + scMomentoHtml(rs) + (rs.n > 0 ? scNumerosHtml(rs) + scBolasHtml(rs) : "") + scMapaHtml(rs.zonas, rs.atleta) + (rs.n > 0 ? scSinaisHtml(rs) : "");
  }
  async function telaAoVivo(token) {
    pararAoVivo();
    var voltar = '<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/inicio">‹ Início</a></p>';
    if (!token) {
      tela(voltar + '<h1>Jogo ao vivo</h1><p class="sub">Acompanhe a partida aqui no app, enquanto o treinador marca os pontos. Se o treinador ligou o jogo ao atleta, ele aparece aqui sozinho.</p>' +
        '<div id="aoVivoMarcar"></div><div id="aoVivoLista" aria-live="polite"></div>' +
        '<form id="fAoVivo" class="cartao" style="margin-top:14px" novalidate><h2>Ou cole o link do jogo</h2><ol class="convite-passos"><li><span>1</span><div>Peça ao <strong>treinador</strong> o “link para a família” do jogo ao vivo.</div></li><li><span>2</span><div><strong>Cole o link abaixo</strong> e toque em “Acompanhar”.</div></li><li><span>3</span><div>O jogo abre <strong>aqui dentro</strong> e se atualiza sozinho.</div></li></ol>' +
        '<div class="campo" style="margin-top:12px"><label for="avLink">Link do jogo ao vivo</label><input id="avLink" type="url" inputmode="url" autocomplete="off" placeholder="https://quadralab.com.br/scout/?l=…"></div><div class="aviso" id="avisoAv" role="alert" hidden></div><button class="btn btn-primario" type="submit">Acompanhar</button></form>' +
        '<p class="nota" style="margin-top:12px">Para um jogo que já terminou e foi compartilhado como scout, o atleta importa o link em “Scouts”, e o responsável vê em “Ver atleta”.</p>');
      carregarJogosAoVivo(document.getElementById("aoVivoLista"), false);
      /* treinador e responsável com a área "Partidas": marcar o jogo do atleta aqui mesmo */
      if (MODO_COMP && papelGuardado() !== "atleta") api("player-competicao").then(function (st) {
        var alvo = document.getElementById("aoVivoMarcar"); if (!alvo) return;
        var meus = (st.comigo || []).filter(function (v) { return v.status === "ativo" && (v.tipo === "treinador" || v.tipo === "responsavel") && v.areas.indexOf("partidas") >= 0; });
        if (!meus.length) { alvo.innerHTML = '<section class="cartao comp-alerta" style="margin-top:14px"><h2>Marcar o jogo (scout)</h2><p class="nota" style="margin-top:6px">Para marcar os pontos de um jogo, o atleta precisa estar vinculado a você com a área “Partidas” liberada. Peça a ele para marcar essa área no vínculo.</p></section>'; return; }
        alvo.innerHTML = '<section class="cartao comp-alerta" style="margin-top:14px"><p class="olho">Scout</p><h2>Marcar o jogo</h2><p class="nota" style="margin-top:6px">Marque os pontos, o saque, o lado da quadra e como cada ponto terminou. Aparece ao vivo para o atleta e para quem o acompanha.</p><div class="acoes">' +
          meus.map(function (v) { return '<a class="btn btn-primario" href="#/competicao/vinculo/' + esc(v.id) + '/marcar">Marcar o jogo de ' + esc(v.atleta.nome) + "</a>"; }).join("") + "</div></section>";
      }).catch(function () { /* a página segue com o acompanhamento */ });
      document.getElementById("fAoVivo").addEventListener("submit", function (ev) {
        ev.preventDefault(); var t = tokenDoLink(document.getElementById("avLink").value), av = document.getElementById("avisoAv");
        if (!t) { av.textContent = "Este não parece um link de jogo ao vivo. Cole o link completo que o treinador enviou (termina com ?l= e um código)."; av.hidden = false; return; }
        ir("#/ao-vivo/" + t);
      });
      return;
    }
    if (!/^[0-9a-f]{32}$/.test(token)) { tela(voltar + '<div class="aviso">Link incompleto. Peça um novo ao treinador.</div><div class="acoes"><a class="btn btn-secundario" href="#/ao-vivo">Colar outro link</a></div>'); return; }
    var versao = 0, aoVivo = false, falhas = 0;
    tela(voltar + '<h1 id="avTitulo">Jogo ao vivo</h1><div id="avSelo" class="sc-selo" role="status">Conectando…</div><div id="avCorpo" aria-live="off"><p class="carregando">Abrindo o jogo…</p></div>', true);
    var meu = ++aoVivoId;
    function selo(txt, vivo) { var e = document.getElementById("avSelo"); if (e) { e.className = "sc-selo" + (vivo ? " vivo" : ""); e.textContent = ""; if (vivo) e.appendChild(document.createElement("i")); e.appendChild(document.createTextNode(txt)); } }
    function hora() { var d = new Date(), z = function (v) { return (v < 10 ? "0" : "") + v; }; return z(d.getHours()) + ":" + z(d.getMinutes()) + ":" + z(d.getSeconds()); }
    function desenhar(rs) {
      var corpo = document.getElementById("avCorpo"); if (!corpo) return;
      var y = window.scrollY, lb = corpo.querySelector(".sc-logbox"), rolagem = lb ? lb.scrollTop : 0;
      document.getElementById("avTitulo").textContent = "Partida de " + (rs.atleta || "atleta");
      corpo.innerHTML = scCabecalhoHtml(rs) + scVistaCompletaHtml(rs);
      scMomentoLigar(rs);
      var nlb = corpo.querySelector(".sc-logbox"); if (nlb) nlb.scrollTop = rolagem;
      window.scrollTo(0, y);
    }
    function buscar() {
      if (meu !== aoVivoId) return;
      clearTimeout(aoVivoTimer);
      if (document.hidden) { aoVivoTimer = setTimeout(buscar, 4000); return; }
      fetch("/.netlify/functions/scout-ao-vivo?t=" + token + "&v=" + versao, { cache: "no-store", referrerPolicy: "no-referrer" }).then(function (r) { return r.json().then(function (c) { if (!r.ok) { var e = new Error(c.erro || "Link inválido."); e.status = r.status; throw e; } return c; }); }).then(function (c) {
        if (meu !== aoVivoId) return;
        falhas = 0;
        if (!c.semMudanca) { versao = c.versao; aoVivo = !!c.publico.aoVivo; desenhar(c.publico); }
        else if (aoVivo !== !!c.aoVivo) { aoVivo = !!c.aoVivo; versao = 0; return buscar(); }
        selo(aoVivo ? "AO VIVO · atualizado às " + hora() : "Partida encerrada · resultado final", aoVivo);
        aoVivoTimer = setTimeout(buscar, aoVivo ? 5000 : 30000);
      }).catch(function (e) {
        if (meu !== aoVivoId) return;
        if (e.status === 404 || e.status === 410) { tela(voltar + '<div class="aviso">Este acompanhamento foi encerrado pelo treinador ou venceu. Peça um novo link a ele.</div><div class="acoes"><a class="btn btn-secundario" href="#/ao-vivo">Colar outro link</a></div>'); return; }
        falhas++; selo("Reconectando… (verifique a internet)", false);
        aoVivoTimer = setTimeout(buscar, Math.min(30000, 4000 * falhas));
      });
    }
    buscar();
  }
  async function telaScoutVinculo(vid, sid) {
    tela('<p class="carregando">Carregando…</p>', true);
    var voltar = '<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/competicao/vinculo/' + esc(vid) + '">‹ Voltar ao atleta</a></p>', r;
    try { r = await api("player-competicao?ver=" + encodeURIComponent(vid)); }
    catch (e) { tela(voltar + '<div class="aviso">' + esc(e.message) + "</div>"); return; }
    var sc = ((r.dados && r.dados.scouts) || []).filter(function (x) { return x.id === sid; })[0];
    if (!sc) { tela(voltar + '<div class="aviso">Este scout não está mais disponível. O treinador pode ter desativado o link.</div>'); return; }
    var rs = sc.resumo;
    tela(voltar + "<h1>" + esc(sc.rotulo) + "</h1>" + scCabecalhoHtml(rs) + scVistaCompletaHtml(rs) + '<p class="nota" style="margin-top:14px">Scout compartilhado pelo treinador e importado pelo atleta. Só aparece enquanto o link do treinador estiver ativo.</p>');
    scMomentoLigar(rs);
  }

  async function telaScouts(id) {
    if (id) return telaScoutDetalhe(id);
    tela('<p class="carregando">Carregando…</p>', true);
    var r;
    try { r = await api("player-scouts"); }
    catch (e) { tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/inicio">‹ Início</a></p><div class="aviso">' + esc(e.message) + "</div>"); return; }
    var ativos = r.scouts.filter(function (x) { return x.estado === "ativo"; });
    tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/inicio">‹ Início</a></p><h1>Scouts do treinador</h1><p class="sub">Os scouts de partida que o seu treinador compartilhou com você.</p>' +
      '<form id="fScout" class="cartao" style="margin-top:14px" novalidate><h2>Importar um scout</h2><p class="nota" style="margin-top:6px">Cole o link que o seu treinador gerou (“Link para a família”). O scout fica na sua conta enquanto o link estiver ativo: se o treinador desativar, o conteúdo deixa de aparecer aqui.</p>' +
      '<div class="campo" style="margin-top:10px"><label for="scLink">Link do scout</label><input id="scLink" type="url" inputmode="url" placeholder="https://…/scout/?…" autocomplete="off"></div><div class="aviso" id="avisoSc" role="alert" hidden></div><button class="btn btn-primario" type="submit">Importar</button></form>' +
      (ativos.length ? relBotaoHtml("btRelScouts", ativos.length) : "") + (r.scouts.length ? '<h2 class="secao">Seus scouts</h2><div class="comp-torneios">' + r.scouts.map(function (x) {
        return '<a class="cartao comp-torneio" href="#/scouts/' + x.id + '"><p class="olho">' + (x.estado === "ativo" ? (x.ate ? "Ativo até " + esc(dataCurta(x.ate)) : x.origem === "ao-vivo" ? "Jogo marcado ao vivo" : "Enviado pelo treinador") : "Acesso encerrado") + "</p><h2>" + esc(x.rotulo) + '</h2><p class="nota">' + esc(dataCurta(x.data)) + "</p></a>";
      }).join("") + "</div>" : '<p class="nota" style="margin-top:14px">Nenhum scout importado ainda.</p>') + scComparacaoHtml(ativos));
    var btRel = document.getElementById("btRelScouts"); if (btRel) btRel.addEventListener("click", function () { abrirRelatorioScouts(ativos); });
    document.getElementById("fScout").addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var av = document.getElementById("avisoSc"); av.hidden = true;
      var bt = this.querySelector("button[type=submit]"); ocupado(bt, true, "Importando…");
      var tk = tokenDoLink(document.getElementById("scLink").value); if (tk && /[?&]l=/.test(document.getElementById("scLink").value)) { toast("Este é um link de jogo ao vivo: abrindo aqui no app."); ocupado(bt, false); ir("#/ao-vivo/" + tk); return; } try { var x = await api("player-scouts", { metodo: "POST", corpo: { acao: "importar", link: document.getElementById("scLink").value } }); toast(x.atualizado ? "Scout atualizado." : "Scout importado."); ir("#/scouts/" + x.id); }
      catch (e) { av.textContent = e.message; av.hidden = false; ocupado(bt, false); }
    });
  }
  async function telaScoutDetalhe(id) {
    tela('<p class="carregando">Carregando…</p>', true);
    var r, t;
    try { r = await api("player-scouts"); t = await api("player-torneios"); await carregarDados(); }
    catch (e) { tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/scouts">‹ Scouts</a></p><div class="aviso">' + esc(e.message) + "</div>"); return; }
    var sc = r.scouts.filter(function (x) { return x.id === id; })[0];
    if (!sc) { tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/scouts">‹ Scouts</a></p><div class="aviso">Scout não encontrado.</div>'); return; }
    var voltar = '<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/scouts">‹ Scouts</a></p>';
    if (sc.estado !== "ativo") {
      tela(voltar + "<h1>" + esc(sc.rotulo) + '</h1><div class="aviso" style="margin-top:14px">O treinador desativou este link (ou ele venceu), então o conteúdo não aparece mais aqui. Peça um novo link ao treinador e importe de novo: o mesmo jogo é atualizado, sem duplicar.</div>' +
        '<div class="acoes"><button type="button" class="btn btn-texto" id="btExcluirSc">Excluir este scout da minha conta</button></div>');
    } else {
      var rs = sc.resumo, serie = scSerie(rs.serie), sets = [], partida = sc.partidaId ? partidasLista().filter(function (x) { return x.id === sc.partidaId; })[0] : null;
      serie.forEach(function (x) { if (sets.indexOf(x.set) < 0) sets.push(x.set); });
      tela(voltar + "<h1>" + esc(sc.rotulo) + '</h1><p class="sub">' + esc(dataCurta(rs.data)) + " · " + (sc.ate ? "link ativo até " + esc(dataCurta(sc.ate)) : "cópia guardada na sua conta") + "</p>" +
        scGraficosHtml(rs) + scMomentoHtml(rs) +
        scMapaHtml(rs.zonas, rs.atleta) + scBolasHtml(rs) + scNumerosHtml(rs) +
        '<h2 class="secao">O que este jogo aponta</h2><div class="cartao">' + (rs.sinais.length ? rs.sinais.map(function (x) { return '<p class="comp-dev-bloco">' + esc(x) + "</p>"; }).join("") : "<p>Nada fora do esperado nos indicadores coletados.</p>") + '<p class="nota" style="margin-top:8px">Leitura automática pelas regras do método: ponto de partida para a conversa com o treinador, não conclusão.</p></div>' +
        (partida ? scAtletaVsTreinadorHtml(sc, partida) : "") +
        '<h2 class="secao">Ligar a um torneio e a uma partida</h2><div class="cartao"><div class="campo"><label for="scTorneio">Torneio</label><select id="scTorneio"><option value="">Sem torneio vinculado</option>' + t.torneios.map(function (x) { return '<option value="' + x.id + '"' + (x.id === sc.torneioId ? " selected" : "") + ">" + esc(x.nome) + "</option>"; }).join("") + "</select></div>" +
        '<div class="campo"><label for="scPartida">Partida registrada por você</label><select id="scPartida"><option value="">Nenhuma</option>' + partidasLista().map(function (x) { return '<option value="' + x.id + '"' + (x.id === sc.partidaId ? " selected" : "") + ">" + esc(dataCurta(x.data) + (x.adversario ? " · contra " + x.adversario : "")) + "</option>"; }).join("") + '</select></div><button type="button" class="btn btn-secundario" id="btLigarSc">Salvar ligação</button></div>' +
        '<div class="acoes"><button type="button" class="btn btn-texto" id="btExcluirSc">Excluir este scout da minha conta</button></div>');
      scMomentoLigar(rs);
      document.getElementById("btLigarSc").addEventListener("click", async function () {
        var bt = this; ocupado(bt, true, "Salvando…");
        try { await api("player-scouts", { metodo: "POST", corpo: { acao: "vincular", id: id, torneioId: document.getElementById("scTorneio").value || null, partidaId: document.getElementById("scPartida").value || null } }); toast("Ligação salva."); telaScoutDetalhe(id); }
        catch (e) { toast(e.message, null, true); ocupado(bt, false); }
      });
    }
    document.getElementById("btExcluirSc").addEventListener("click", async function () {
      if (!window.confirm("Excluir este scout da sua conta? Para ver de novo, será preciso importar o link outra vez.")) return;
      try { await api("player-scouts", { metodo: "POST", corpo: { acao: "excluir", id: id } }); toast("Scout excluído."); ir("#/scouts"); } catch (e) { toast(e.message, null, true); }
    });
  }

  /* ══ Competição: consultorias contratadas dentro do app ══
     O atleta escolhe a consultoria e o que compartilhar; atleta menor de idade tem o pedido confirmado e pago pelo responsável vinculado.
     O pagamento nunca é marcado aqui: vem da Eduzz ou da confirmação do consultor. Sem checkout configurado, o pagamento é combinado no WhatsApp. */
  var ROT_ESTADO_PEDIDO_CLASSE = { aguardando_responsavel: "espera", aguardando_pagamento: "espera", pago: "ok", em_andamento: "ok", entregue: "ok", cancelado: "fim", reembolsado: "fim" };
  function listaHtml(itens) { return itens && itens.length ? '<ul class="beneficios">' + itens.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : ""; }
  function pedidoHtml(p) {
    var h = '<article class="cartao comp-pedido"><p class="olho"><span class="comp-estado ' + (ROT_ESTADO_PEDIDO_CLASSE[p.estado] || "") + '">' + esc(p.rotulo) + "</span> · " + esc(dataCurta(String(p.criadoEm).slice(0, 10))) + "</p><h2>" + esc(p.nome) + '</h2><p class="nota">' + reais(p.precoCentavos) + (p.euSouAtleta ? "" : " · atleta: " + esc(p.atletaNome)) + "</p>";
    if (p.contexto) {
      var c = p.contexto, partes = [];
      if (c.torneio) partes.push("torneio " + c.torneio); if (c.partidas) partes.push(c.partidas + (c.partidas === 1 ? " partida" : " partidas")); if (c.scouts) partes.push(c.scouts + (c.scouts === 1 ? " scout" : " scouts"));
      if (c.devolutivas) partes.push(c.devolutivas + (c.devolutivas === 1 ? " devolutiva" : " devolutivas")); if (c.perfil) partes.push("perfil");
      h += '<p class="nota">Compartilhado com o consultor: ' + (partes.length ? esc(partes.join(", ")) : "nada além do seu pedido") + ".</p>" + (c.observacao ? '<p class="nota">Sua mensagem: ' + esc(c.observacao) + "</p>" : "");
    }
    if (p.estado === "aguardando_responsavel") {
      h += p.euSouAtleta ? '<p class="nota">O seu responsável precisa confirmar este pedido no app dele. Quem confirma também faz o pagamento.</p>' : '<div class="acoes"><button type="button" class="btn btn-laranja" data-confirmar="' + p.id + '">Confirmar o pedido e autorizar o compartilhamento</button></div>';
    }
    if (p.estado === "aguardando_pagamento") {
      h += p.pagadorEhVoce ? '<div class="acoes"><button type="button" class="btn btn-laranja" data-pagar="' + p.id + '">' + (p.checkout ? "Pagar" : "Combinar o pagamento") + "</button></div>" +
        (p.checkout ? '<p class="nota">Use na compra o mesmo e-mail da sua conta, para o pagamento ser reconhecido sozinho.</p>' : '<p class="nota">O pagamento é combinado direto com o consultor. Depois que ele confirmar, o pedido passa para “Pago”.</p>') : '<p class="nota">Quem confirmou o pedido faz o pagamento.</p>';
    }
    if (p.estado === "pago" || p.estado === "em_andamento") h += '<p class="nota">O consultor já está com o seu pedido. A entrega aparece aqui.</p>';
    if (p.entrega) h += '<div class="comp-dev-bloco comp-dev-foco"><strong>Entrega do consultor</strong>' + esc(p.entrega.texto) + (p.entrega.link ? '<br><a href="' + esc(p.entrega.link) + '" target="_blank" rel="noopener noreferrer">Abrir material<span class="sr"> (abre em nova aba)</span></a>' : "") + "</div>";
    if (p.estado === "aguardando_responsavel" || p.estado === "aguardando_pagamento") h += '<div class="acoes"><button type="button" class="btn btn-texto" data-cancelar-ped="' + p.id + '">Cancelar pedido</button></div>';
    return h + "</article>";
  }
  async function telaPedidos() {
    tela('<p class="carregando">Carregando…</p>', true);
    var r;
    try { r = await api("player-consultorias"); }
    catch (e) { tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/consultorias">‹ Consultorias</a></p><div class="aviso">' + esc(e.message) + "</div>"); return; }
    tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/consultorias">‹ Consultorias</a></p><h1>Meus pedidos</h1><p class="sub">Acompanhe cada consultoria: pedido, pagamento e entrega.</p>' +
      (r.pedidos.length ? r.pedidos.map(pedidoHtml).join("") : '<div class="cartao" style="margin-top:14px"><h2>Nenhum pedido ainda</h2><p class="nota" style="margin-top:6px">Veja as <a href="#/consultorias">consultorias</a> e peça a que fizer sentido para a sua temporada.</p></div>'));
    function agir(corpo, ok, btn) {
      ocupado(btn, true);
      return api("player-consultorias", { metodo: "POST", corpo: corpo }).then(function (x) { if (ok) ok(x); }).catch(function (e) { toast(e.message, null, true); ocupado(btn, false); });
    }
    app.querySelectorAll("[data-confirmar]").forEach(function (b) { b.addEventListener("click", function () {
      if (!window.confirm("Confirmar este pedido? Você autoriza o compartilhamento dos dados escolhidos pelo atleta com o consultor e passa a ser quem paga.")) return;
      agir({ acao: "confirmar", id: b.getAttribute("data-confirmar") }, function () { toast("Pedido confirmado."); telaPedidos(); }, b); }); });
    app.querySelectorAll("[data-cancelar-ped]").forEach(function (b) { b.addEventListener("click", function () {
      if (!window.confirm("Cancelar este pedido?")) return;
      agir({ acao: "cancelar", id: b.getAttribute("data-cancelar-ped") }, function () { toast("Pedido cancelado."); telaPedidos(); }, b); }); });
    app.querySelectorAll("[data-pagar]").forEach(function (b) { b.addEventListener("click", function () {
      agir({ acao: "pagar", id: b.getAttribute("data-pagar") }, function (x) {
        if (x.checkoutUrl) { toast(x.aviso || "Abrindo o pagamento."); window.location.href = x.checkoutUrl; }
        else if (x.contato) { window.open(x.contato, "_blank", "noopener"); toast("Combine o pagamento no WhatsApp. Depois da confirmação, o pedido passa para Pago."); ocupado(b, false); }
      }, b); }); });
  }
  async function telaConsultoriasComp(id, acao) {
    tela('<p class="carregando">Carregando…</p>', true);
    var r;
    try { r = await api("player-consultorias"); }
    catch (e) { tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/inicio">‹ Início</a></p><div class="aviso">' + esc(e.message) + '</div><div class="acoes"><a class="btn btn-secundario" href="#/inicio">Voltar</a></div>'); return; }
    var abertos = r.pedidos.filter(function (p) { return ["aguardando_responsavel", "aguardando_pagamento"].indexOf(p.estado) >= 0; }).length;
    var pol = r.politicas || {};
    var politicasHtml = '<p class="nota" style="margin-top:12px">' + (pol.pagamento || pol.remarcacao || pol.cancelamento ? [pol.pagamento, pol.remarcacao, pol.cancelamento].filter(Boolean).map(esc).join(" ") : "Pagamento, remarcação e cancelamento são informados antes de qualquer cobrança.") + "</p>";
    if (!id) {
      tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/inicio">‹ Início</a></p><h1>Consultorias avulsas</h1><p class="sub">Orientação individual para a sua preparação de competição, com o consultor da Metodologia MTY. Cada serviço é contratado uma vez, sem recorrência, e é separado do <a href="#/acompanhamento">Acompanhamento MTY</a>, o programa remoto de 3 meses.</p>' +
        '<div class="acoes"><a class="btn btn-secundario" href="#/pedidos">Meus pedidos' + (abertos ? " · " + abertos + " em aberto" : "") + "</a></div>" +
        r.catalogo.map(function (c) {
          return '<article class="cartao" style="margin-top:14px"><p class="olho">' + esc(c.unidadePreco) + "</p><h2>" + esc(c.nome) + '</h2><p class="nota" style="margin-top:6px">' + esc(c.descricao) + '</p><p style="margin-top:10px"><strong>' + reais(c.precoCentavos) + "</strong> · " + esc(c.prazoCurto) + "</p>" + listaHtml(c.principais) +
            '<div class="acoes"><a class="btn btn-laranja" href="#/consultorias/' + c.id + '">Ver detalhes</a></div></article>';
        }).join("") + politicasHtml);
      return;
    }
    var c = r.catalogo.filter(function (x) { return x.id === id; })[0];
    if (!c) { ir("#/consultorias"); return; }
    if (acao !== "contratar") {
      tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/consultorias">‹ Consultorias</a></p><h1>' + esc(c.nome) + '</h1><p class="sub">' + esc(c.descricao) + "</p>" +
        '<div class="cartao" style="margin-top:14px"><p style="font-size:22px;font-weight:700">' + reais(c.precoCentavos) + '</p><p class="nota">' + esc(c.unidadePreco) + " · " + esc(c.prazo) + "</p>" +
        (c.indicadoPara ? '<p class="olho" style="margin-top:12px">Indicado para</p><p>' + esc(c.indicadoPara) + "</p>" : "") + (c.regra ? '<p class="aviso-info" style="margin-top:10px">' + esc(c.regra) + "</p>" : "") +
        '<p class="olho" style="margin-top:12px">O que inclui</p>' + listaHtml(c.inclui) + (c.naoInclui && c.naoInclui.length ? '<p class="olho" style="margin-top:12px">O que não inclui</p>' + listaHtml(c.naoInclui) : "") +
        (c.material ? '<p class="olho" style="margin-top:12px">Material necessário</p>' + listaHtml(c.material) : "") + (c.escopoPreco ? '<p class="nota" style="margin-top:8px">' + esc(c.escopoPreco) + "</p>" : "") + (c.acimaDoLimite ? '<p class="nota">' + esc(c.acimaDoLimite) + "</p>" : "") + (c.aviso ? '<p class="nota">' + esc(c.aviso) + "</p>" : "") + politicasHtml +
        (r.papel === "atleta" && r.menor && !r.responsaveis ? '<div class="comp-alerta cartao"><p class="olho">Primeiro passo</p><p class="nota">Como você é menor de idade, o responsável precisa estar vinculado antes de contratar. Ele confirma e paga o pedido.</p><div class="acoes"><a class="btn btn-primario btn-grande" href="#/inicio">Vincular responsável</a></div></div>' : r.papel === "atleta" ? '<div class="acoes"><a class="btn btn-laranja btn-grande" href="#/consultorias/' + c.id + '/contratar">' + esc(c.botao || "Contratar") + "</a></div>" : '<p class="nota" style="margin-top:12px">O pedido é montado pelo atleta. Você confirma e paga em “Meus pedidos”.</p>') + "</div>");
      return;
    }
    if (r.papel !== "atleta" || (r.menor && !r.responsaveis)) { ir("#/consultorias/" + id); return; }
    var o = r.opcoes;
    function caixas(nome, lista, rot) {
      return lista.length ? lista.map(function (x) { return '<label class="comp-area"><input type="checkbox" name="' + nome + '" value="' + x.id + '"> ' + esc(rot(x)) + "</label>"; }).join("") : '<p class="nota">Nada cadastrado ainda.</p>';
    }
    tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/consultorias/' + c.id + '">‹ ' + esc(c.nome) + "</a></p><h1>Pedir " + esc(c.nome.toLowerCase()) + "</h1>" +
      '<p class="sub">Escolha o que o consultor pode ver. Só o que você marcar é enviado, e vale apenas para este pedido.</p>' +
      (r.menor ? '<div class="aviso-info" style="margin-top:12px">Como você é menor de idade, o seu responsável vinculado precisa confirmar o pedido e faz o pagamento.</div>' : "") +
      '<form id="fPedido" class="cartao" style="margin-top:14px" novalidate>' +
      '<div class="campo"><label for="pdTorneio">Torneio de referência (opcional)</label><select id="pdTorneio"><option value="">Sem torneio vinculado</option>' + o.torneios.map(function (t) { return '<option value="' + t.id + '">' + esc(t.nome) + "</option>"; }).join("") + "</select></div>" +
      '<fieldset><legend>Partidas que o consultor pode ver (até 6)</legend>' + caixas("pdPartida", o.partidas, function (p) { return dataCurta(p.data) + (p.adversario ? " · contra " + p.adversario : "") + " · " + (p.resultado === "vitoria" ? "vitória" : "derrota") + (p.placar ? " " + p.placar : ""); }) + "</fieldset>" +
      '<fieldset><legend>Scouts do treinador (até 3)</legend>' + caixas("pdScout", o.scouts, function (x) { return x.rotulo + " · " + dataCurta(x.data); }) + "</fieldset>" +
      '<fieldset><legend>Devolutivas (até 5)</legend>' + caixas("pdDev", o.devolutivas, function (d) { return (d.refRotulo || "Geral") + " · " + (d.autorNome || "treinador"); }) + "</fieldset>" +
      '<label class="comp-area"><input type="checkbox" id="pdPerfil"> Incluir o meu perfil de jogador (só as respostas de escolha, sem textos livres)</label>' +
      '<div class="campo" style="margin-top:12px"><label for="pdObs">O que você quer resolver? (opcional)</label><textarea id="pdObs" rows="4" maxlength="800" placeholder="Ex.: chego nas oitavas e travo no segundo set"></textarea></div>' +
      (c.id !== "revisao-estrategia" && c.id !== "consultoria-ao-vivo" ? '<p class="olho">Links dos vídeos (https://, até 3)</p>' + [0, 1, 2].map(function (i) { return '<div class="campo"><label for="pdLink' + i + '" class="sr">Link do vídeo ' + (i + 1) + '</label><input id="pdLink' + i + '" type="url" inputmode="url" placeholder="https://" maxlength="300"></div>'; }).join("") : "") +
      '<div class="cartao" style="background:var(--papel)"><p><strong>' + esc(c.nome) + "</strong> · " + reais(c.precoCentavos) + '</p><p class="nota">' + esc(c.unidadePreco) + "</p></div>" +
      '<label class="comp-area" style="margin-top:12px"><input type="checkbox" id="pdAutorizo"> Autorizo compartilhar com o consultor os dados marcados acima, apenas para esta consultoria.' + (r.menor ? " (O responsável confirma depois.)" : "") + "</label>" +
      politicasHtml + '<div class="aviso" id="avisoPd" role="alert" hidden></div><button class="btn btn-laranja btn-grande" type="submit">Enviar pedido</button></form>');
    document.getElementById("fPedido").addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var av = document.getElementById("avisoPd"); av.hidden = true;
      function marcados(n) { return Array.prototype.map.call(app.querySelectorAll('input[name="' + n + '"]:checked'), function (i) { return i.value; }); }
      if (!document.getElementById("pdAutorizo").checked) { av.textContent = "Marque a autorização para enviar o pedido."; av.hidden = false; return; }
      var links = [0, 1, 2].map(function (i) { var e = document.getElementById("pdLink" + i); return e ? e.value.trim() : ""; }).filter(Boolean);
      var bt = this.querySelector("button[type=submit]"); ocupado(bt, true, "Enviando…");
      try {
        var x = await api("player-consultorias", { metodo: "POST", corpo: { acao: "criar", consultoriaId: c.id, torneioId: document.getElementById("pdTorneio").value || null, partidaIds: marcados("pdPartida"), scoutIds: marcados("pdScout"), devolutivaIds: marcados("pdDev"), incluirPerfil: document.getElementById("pdPerfil").checked, observacao: document.getElementById("pdObs").value, links: links, autorizo: true } });
        toast(x.estado === "aguardando_responsavel" ? "Pedido enviado. Falta o seu responsável confirmar." : "Pedido enviado. Agora é só combinar o pagamento."); ir("#/pedidos");
      } catch (e) { av.textContent = e.message; av.hidden = false; ocupado(bt, false); }
    });
  }
  function telaAjudaComp() {
    tela('<h1>Ajuda e suporte</h1><p class="sub">Fale com a gente por aqui.</p>' + instalarAppHtml() +
      '<div class="cartao" style="margin-top:16px"><h2>Falar com o suporte</h2><p class="nota" style="margin-top:6px">Dúvidas sobre o app, a sua conta, a temporada ou os seus pedidos de consultoria. Respondemos pelo WhatsApp.</p>' +
      '<a class="btn btn-primario btn-grande" href="' + esc(suporteUrl("Olá, Richard! Preciso de ajuda com o QuadraLab Competição.")) + '" target="_blank" rel="noopener">Abrir o WhatsApp<span class="sr"> (abre em nova aba)</span></a></div>' +
      '<div class="cartao" style="margin-top:14px"><h2>Quem vê os seus dados</h2><p class="nota" style="margin-top:6px">Treinador e responsável só veem o que você marcar em cada vínculo, e qualquer lado pode encerrar o vínculo quando quiser. Para atletas menores de idade, o responsável aprova o treinador e confirma as consultorias. O diário é privado, a menos que você o compartilhe.</p></div>' +
      '<div class="cartao" style="margin-top:14px"><h2>Seus dados</h2><p class="nota" style="margin-top:6px">Em <a href="#/conta">Meu perfil</a> você baixa uma cópia dos seus dados ou exclui a conta.</p></div>');
    ligarInstalar();
  }
  /* quem diz o quê: relato do atleta, observação do treinador, estatística registrada e sugestão automática nunca se misturam */
  var ORIGENS = { relato: ["Relato do atleta", "o-relato"], treinador: ["Observação do treinador", "o-treinador"], estatistica: ["Estatística registrada", "o-estat"], sugestao: ["Sugestão automática", "o-sug"] };
  function origemTag(k) { return ' <span class="comp-origem ' + ORIGENS[k][1] + '">' + ORIGENS[k][0] + "</span>"; }
  async function telaVinculo(id) {
    tela('<p class="carregando">Carregando…</p>', true);
    var r;
    try { r = await api("player-competicao?ver=" + encodeURIComponent(id)); }
    catch (e) { tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/competicao">‹ Início</a></p><div class="aviso">' + esc(e.message) + "</div>"); return; }
    var perfil = r.dados.perfil;
    tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/competicao">‹ Início</a></p><h1>' + esc(r.atleta.nome) + '</h1><p class="sub">Você vê só o que o atleta compartilhou: ' + esc(rotuloAreas(r.areas)) + ".</p>" +
      '<nav class="chips-atalho" aria-label="Ir para"><a href="#/ao-vivo">Jogo ao vivo</a>' + (r.areas.indexOf("partidas") >= 0 ? '<a href="#/competicao/vinculo/' + esc(id) + '/marcar">Marcar o jogo (scout)</a>' : "") + (r.referencias ? '<a href="#v-devolutiva" data-rolar="v-devolutiva">Escrever recomendação</a>' : "") + (r.dados.scouts ? '<a href="#v-scouts" data-rolar="v-scouts">Scouts</a>' : "") + (r.dados.partidas ? '<a href="#v-partidas" data-rolar="v-partidas">Partidas</a>' : "") + (r.dados.torneios ? '<a href="#v-torneios" data-rolar="v-torneios">Torneios</a>' : "") + (r.areas.indexOf("planejamento") >= 0 ? '<a href="#/planejamento/atleta/' + esc(id) + '">Atividades da semana</a>' : "") + "</nav>" +
      ((r.areas.indexOf("planejamento") >= 0 || r.referencias) ? '<div class="acoes">' + (r.areas.indexOf("planejamento") >= 0 ? '<a class="btn btn-laranja" href="#/planejamento/atleta/' + id + '">' + (r.referencias ? "Planejamento e registros do atleta" : "Ver o planejamento do atleta") + "</a>" : (r.referencias ? '<p class="nota">O atleta ainda não compartilhou “Meu planejamento” com você. Peça para ele marcar essa área no vínculo.</p>' : "")) + (r.referencias ? '<a class="btn btn-secundario" href="#/acompanhamento">Acompanhamento MTY</a>' : "") + "</div>" : "") +
      (perfil ? '<div class="cartao" style="margin-top:14px"><h2>Perfil de jogador</h2>' + (perfil.length ? '<dl class="comp-perfil">' + perfil.map(function (p) { return "<dt>" + esc(p.rotulo) + "</dt><dd>" + esc(p.valor) + "</dd>"; }).join("") + "</dl>" : '<p class="nota" style="margin-top:6px">O atleta ainda não preencheu o perfil.</p>') + "</div>" : "") +
      (r.dados.torneios ? '<div class="cartao" id="v-torneios" style="margin-top:14px"><h2>Temporada e torneios</h2>' + (r.dados.torneios.length ? '<div class="comp-torneios">' + r.dados.torneios.map(function (t) { return '<div class="comp-vinc"><p class="olho">' + esc(rotuloEstadoTorneio(t.estado)) + " · " + esc(quandoTorneio(t)) + "</p><p><strong>" + esc(t.nome) + '</strong></p><p class="nota">' + esc(periodoTorneio(t)) + (t.cidade ? " · " + esc(t.cidade) : "") + (t.categoria ? " · " + esc(t.categoria) : "") + "</p>" + prazoTorneioHtml(t) + "</div>"; }).join("") + "</div>" : '<p class="nota" style="margin-top:6px">Nenhum torneio cadastrado ainda.</p>') + "</div>" : "") +
      (r.dados.preparos ? '<div class="cartao" style="margin-top:14px"><h2>Estratégia por partida' + origemTag("relato") + '</h2>' + (r.dados.preparos.length ? '<div class="comp-torneios">' + r.dados.preparos.map(function (p) { return '<div class="comp-vinc"><p class="olho">' + esc(p.rodada || "Partida") + (p.data ? " · " + dataCurta(p.data) : "") + "</p><p><strong>" + (p.adversario ? "Contra " + esc(p.adversario) : "Preparação") + "</strong></p>" + (p.prioridades && p.prioridades.length ? '<ol class="comp-prior">' + p.prioridades.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol>" : "") + (p.padrao ? '<p class="nota">Padrão: ' + esc(p.padrao) + "</p>" : "") + (p.hipoteses ? '<p class="nota">Expectativa: ' + esc(p.hipoteses) + "</p>" : "") + "</div>"; }).join("") + "</div>" : '<p class="nota" style="margin-top:6px">Nenhuma preparação ainda.</p>') + "</div>" : "") +
      (r.dados.partidas ? '<div class="cartao" id="v-partidas" style="margin-top:14px"><h2>Partidas' + origemTag("relato") + '</h2><p class="nota" style="margin-top:4px">Resultado e avaliação como o atleta registrou. Não é análise de vídeo.</p>' + (r.dados.partidas.length ? '<div class="comp-torneios">' + r.dados.partidas.map(function (p) { return '<div class="comp-vinc"><p class="olho">' + (p.resultado === "vitoria" ? "Vitória" : "Derrota") + (p.rodada ? " · " + esc(p.rodada) : "") + " · " + dataCurta(p.data) + "</p><p><strong>" + (p.adversario ? "Contra " + esc(p.adversario) : "Partida") + '</strong></p><p class="nota">' + esc(p.placar) + "</p>" + videoHtml(p.video, "Vídeo da partida" + (p.adversario ? " contra " + p.adversario : "")) + "</div>"; }).join("") + "</div>" : '<p class="nota" style="margin-top:6px">Nenhuma partida registrada.</p>') + "</div>" : "") +
      (r.dados.scouts ? '<div class="cartao" id="v-scouts" style="margin-top:14px"><h2>Scouts do treinador' + origemTag("estatistica") + '</h2>' + (r.dados.scouts.length ? '<div class="acoes"><button type="button" class="btn btn-laranja btn-pequeno" id="btRelVinc">Exportar relatório dos jogos</button></div>' : "") + (r.dados.scouts.length ? '<div class="comp-torneios">' + r.dados.scouts.map(function (x) { return '<div class="comp-vinc"><p class="olho">' + esc(dataCurta(x.data)) + "</p><p><strong>" + esc(x.rotulo) + '</strong></p><p class="nota">' + x.resumo.pctGanhos + "% dos pontos ganhos · erros " + x.resumo.numeros.errosNos + " · protocolo " + x.resumo.numeros.pctProtocolo + '%</p><div class="acoes"><a class="btn btn-secundario btn-pequeno" href="#/competicao/vinculo/' + esc(id) + "/scout/" + esc(x.id) + '">Ver o jogo completo</a></div></div>'; }).join("") + "</div>" : '<p class="nota" style="margin-top:6px">Nenhum scout importado.</p>') + "</div>" : "") +
      (r.dados.diario ? '<div class="cartao" style="margin-top:14px"><h2>Diário' + origemTag("relato") + '</h2>' + (r.diarioPorRegistro ? '<p class="nota" style="margin-top:4px">O atleta compartilhou só estes registros, um a um.</p>' : "") + (r.dados.diario.length ? '<div class="comp-torneios">' + r.dados.diario.map(function (d) { return '<div class="comp-vinc"><p class="olho">' + dataCurta(d.data) + "</p><p>" + esc(d.texto) + "</p></div>"; }).join("") + "</div>" : '<p class="nota" style="margin-top:6px">Sem registros.</p>') + "</div>" : "") +
      (r.dados.focos ? '<div class="cartao" style="margin-top:14px"><h2>Foco de treino' + origemTag("relato") + '</h2>' + (r.dados.focos.length ? '<ul class="comp-lista">' + r.dados.focos.map(function (f) { return '<li class="comp-vinc"><p><strong>' + esc(f.texto) + '</strong></p><p class="nota">' + esc(STATUS_FOCO_ROT[f.status] || f.status) + " · " + esc(f.origemRotulo || "") + "</p></li>"; }).join("") + "</ul>" : '<p class="nota" style="margin-top:6px">Nenhum foco ainda.</p>') + "</div>" : "") +
      (r.referencias ? '<div class="cartao" id="v-devolutiva" style="margin-top:14px"><h2>Escrever devolutiva</h2><form id="fDev" novalidate style="margin-top:8px"><div class="campo"><label for="devRef">Sobre</label><select id="devRef"><option value="geral:">Geral</option>' +
        r.referencias.torneios.map(function (t) { return '<option value="torneio:' + t.id + '">Torneio: ' + esc(t.rotulo) + "</option>"; }).join("") + r.referencias.partidas.map(function (p) { return '<option value="partida:' + p.id + '">Partida: ' + esc(p.rotulo) + "</option>"; }).join("") + "</select></div>" +
        '<div class="campo"><label for="devBem">O que foi bem</label><textarea id="devBem" rows="3" maxlength="600"></textarea></div><div class="campo"><label for="devMelhor">O que melhorar</label><textarea id="devMelhor" rows="3" maxlength="600"></textarea></div>' +
        '<div class="campo"><label for="devFoco">Foco de treino sugerido (opcional)</label><input id="devFoco" maxlength="200" placeholder="Ex.: primeiro saque em 65%"></div><div class="aviso" id="avisoDev" role="alert" hidden></div><button class="btn btn-primario" type="submit">Enviar devolutiva</button></form></div>' : "") +
      (r.devolutivas && r.devolutivas.length ? '<h2 class="secao">' + (r.referencias ? "Suas devolutivas" : "Devolutivas do treinador") + origemTag("treinador") + "</h2>" + r.devolutivas.map(function (d) { return devolutivaHtml(d, r.referencias ? '<div class="acoes"><button type="button" class="btn btn-texto" data-exdev="' + d.id + '">Excluir</button></div>' : ""); }).join("") : "") +
      (r.emBreve && r.emBreve.length ? '<p class="nota" style="margin-top:14px">Compartilhado e ainda sem conteúdo nesta etapa: ' + esc(rotuloAreas(r.emBreve)) + ". Essas áreas aparecem aqui quando chegarem as próximas etapas.</p>" : ""));
    Array.prototype.forEach.call(app.querySelectorAll("[data-rolar]"), function (a) { a.addEventListener("click", function (ev) { ev.preventDefault(); var alvo = document.getElementById(a.getAttribute("data-rolar")); if (alvo) alvo.scrollIntoView({ behavior: "smooth", block: "start" }); }); });
    var btRelV = document.getElementById("btRelVinc"); if (btRelV) btRelV.addEventListener("click", function () { abrirRelatorioScouts(r.dados.scouts); });
    var fd = document.getElementById("fDev");
    if (fd) fd.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var av = document.getElementById("avisoDev"); av.hidden = true;
      var ref = document.getElementById("devRef").value.split(":"), bt = fd.querySelector("button[type=submit]"); ocupado(bt, true, "Enviando…");
      try { await api("player-competicao", { metodo: "POST", corpo: { acao: "devolutiva", id: id, tipo: ref[0], refId: ref[1] || null, destaques: document.getElementById("devBem").value, melhorar: document.getElementById("devMelhor").value, foco: document.getElementById("devFoco").value } }); toast("Devolutiva enviada."); telaVinculo(id); }
      catch (e) { av.textContent = e.message; av.hidden = false; ocupado(bt, false); }
    });
    app.querySelectorAll("[data-exdev]").forEach(function (b) {
      b.addEventListener("click", async function () {
        if (!window.confirm("Excluir esta devolutiva?")) return;
        try { await api("player-competicao", { metodo: "POST", corpo: { acao: "excluirDevolutiva", id: id, devolutivaId: b.getAttribute("data-exdev") } }); telaVinculo(id); } catch (e) { toast(e.message, null, true); }
      });
    });
  }
  /* ══ Olhar do treinador: uma dúvida sobre a estratégia, respondida por Richard em áudio ou vídeo ══
     Preço, prazo e limites vêm do servidor (player-olhar): cartões, formulário, revisão e checkout leem da mesma fonte, e o valor
     nunca é enviado pelo navegador. Aqui só se desenha, se guarda o rascunho (neste aparelho) e se leva ao pagamento; "pago" só o servidor sabe. */
  var OLHAR_NAO_INCLUI = "Contempla uma dúvida sobre uma estratégia. Não inclui análise de partidas em vídeo, revisão completa do plano ou encontro ao vivo.";
  var OLHAR_FAQ = [
    ["Preciso assinar um plano pago?", "Não. Você precisa de uma conta e de uma estratégia cadastrada. O atendimento é comprado separadamente."],
    ["Posso enviar qualquer dúvida?", "Envie uma dúvida principal relacionada à estratégia selecionada. O atendimento é focado nesse ponto."],
    ["Posso enviar uma gravação da minha partida?", "Este produto não inclui análise de partidas em vídeo. Para isso, consulte a Análise completa do jogador."],
    ["Vou conversar ao vivo com Richard?", "Não. Você recebe uma devolutiva individual gravada. Para conversar por videochamada, escolha a Consultoria ao vivo."],
    ["Recebo áudio ou vídeo?", "Richard escolhe o formato mais adequado para explicar sua orientação. A entrega tem de 3 a 5 minutos."],
    ["Quando recebo?", "Em até 3 dias úteis após a confirmação do pagamento e o envio completo da solicitação. A data prevista aparece no pedido."],
    ["O atendimento revisa toda a estratégia?", "Ele aprofunda a dúvida enviada. Para revisar o plano completo, escolha a Revisão de estratégia."],
    ["Onde encontro a resposta?", "Na área Meus atendimentos, dentro da sua conta."],
    ["Posso comprar novamente?", "Sim. Cada contratação corresponde a uma dúvida e uma devolutiva."],
  ];
  function olharFaqHtml() {
    return '<section class="cartao" aria-labelledby="t-faq-olhar"><h2 id="t-faq-olhar">Perguntas frequentes</h2><div class="detalhes-grupo">' + OLHAR_FAQ.map(function (q) {
      return '<details class="det"><summary>' + esc(q[0]) + "</summary><p class=\"nota\" style=\"margin-top:8px\">" + esc(q[1]) + "</p></details>";
    }).join("") + "</div></section>";
  }
  function olharChave() { return "ql-olhar-rasc:" + (auth.currentUser ? auth.currentUser.uid : ""); }
  function lerOlharRasc() { try { return JSON.parse(localStorage.getItem(olharChave()) || "null") || {}; } catch (e) { return {}; } }
  function salvarOlharRasc(r) { try { localStorage.setItem(olharChave(), JSON.stringify({ estrategiaId: r.estrategiaId || "", duvida: r.duvida || "", contexto: r.contexto || "", pedidoId: r.pedidoId || "" })); } catch (e) { /* sem armazenamento: segue sem rascunho */ } }
  function limparOlharRasc() { try { localStorage.removeItem(olharChave()); } catch (e) { /* nada */ } }
  async function carregarOlhar(forcar) {
    if (!forcar && estado.olhar && Date.now() - estado.olhar.em < 5000) return estado.olhar;
    var r = await api("player-olhar");
    r.em = Date.now(); estado.olhar = r;
    return r;
  }
  function olharPreco(o) { return reaisInteiro(o.produto.precoCentavos); }
  function olharDataLonga(iso) { var p = String(iso || "").slice(0, 10).split("-"); return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : ""; }
  function olharVoltar(rota, rotulo) { return '<p style="margin-bottom:8px"><a class="btn btn-texto" href="' + rota + '">' + esc(rotulo) + "</a></p>"; }
  function olharResumo(texto, max) { texto = String(texto || "").replace(/\s+/g, " ").trim(); return texto.length > max ? texto.slice(0, max - 1) + "…" : texto; }
  function olharPedidoAtivo(o) { return (o.pedidos || []).filter(function (p) { return p.estado === "aguardando_pagamento" || p.estado === "recebido" || p.estado === "em_analise"; })[0] || null; }
  function olharPedidoNovo(o) { return (o.pedidos || []).filter(function (p) { return p.nova; })[0] || null; }
  function olharFalha(e, destino) {
    tela('<div class="aviso" role="alert">' + esc(e.message) + '</div><div class="acoes"><button class="btn btn-primario" id="btOlharTentar" type="button">Tentar de novo</button><a class="btn btn-texto" href="#/consultorias">Voltar às consultorias</a></div>');
    document.getElementById("btOlharTentar").addEventListener("click", function () { destino(); });
  }

  /* cartão curto, dentro da tela da estratégia: o preço entra assim que o servidor responde */
  function cartaoOlharEstrategiaHtml(planoId) {
    return '<section class="cartao olhar-chamada" id="olharEstrategia" aria-labelledby="t-olhar-est"><p class="olho">Orientação individual</p><h2 id="t-olhar-est">Quer meu olhar sobre esta estratégia?</h2>' +
      '<p class="nota" style="margin-top:6px">Envie uma dúvida e receba uma orientação individual gravada.</p><p class="olhar-preco-linha" id="olharEstPreco" hidden></p>' +
      '<div class="acoes"><a class="btn btn-primario" href="#/olhar/pedir/' + esc(planoId) + '">Enviar minha dúvida</a><a class="btn btn-texto" href="#/olhar">Como funciona</a></div></section>';
  }
  function preencherPrecoOlhar(idEl) {
    carregarOlhar(false).then(function (o) {
      var el = document.getElementById(idEl); if (!el) return;
      el.textContent = olharPreco(o) + " · Pagamento único"; el.hidden = false;
    }).catch(function () { /* sem o preço, o cartão continua levando à página do produto */ });
  }

  /* chamada compacta na página inicial: pedido em andamento e devolutiva nova passam na frente */
  function preencherOlharInicio() {
    carregarOlhar(false).then(function (o) {
      var el = document.getElementById("olharInicio"); if (!el) return;
      var nova = olharPedidoNovo(o), ativo = olharPedidoAtivo(o);
      if (nova) {
        el.innerHTML = '<section class="cartao olhar-chamada olhar-nova" aria-labelledby="t-olhar-ini"><p class="olho">Olhar do treinador</p><h2 id="t-olhar-ini">Sua orientação chegou</h2><p class="nota" style="margin-top:6px">Richard respondeu a sua dúvida sobre “' + esc(olharResumo(nova.estrategia && nova.estrategia.titulo, 60)) + '”.</p><div class="acoes"><a class="btn btn-primario" href="#/olhar/pedido/' + esc(nova.id) + '">Ouvir minha devolutiva</a></div></section>';
      } else if (ativo) {
        el.innerHTML = '<section class="cartao olhar-chamada" aria-labelledby="t-olhar-ini"><p class="olho">Olhar do treinador</p><h2 id="t-olhar-ini">' + (ativo.estado === "aguardando_pagamento" ? "Seu pedido espera o pagamento" : "Seu pedido está com o Richard") + '</h2><p class="nota" style="margin-top:6px">' + esc(ativo.rotulo) + (ativo.prazoTexto ? " · devolutiva prevista até " + esc(ativo.prazoTexto) : "") + '.</p><div class="acoes"><a class="btn btn-primario" href="#/olhar/pedido/' + esc(ativo.id) + '">Acompanhar meu pedido</a></div></section>';
      } else if ((o.estrategias || []).length) {
        el.innerHTML = '<section class="cartao olhar-chamada" aria-labelledby="t-olhar-ini"><p class="olho">Orientação individual</p><h2 id="t-olhar-ini">Uma dúvida sobre sua estratégia?</h2><p class="nota" style="margin-top:6px">Receba uma orientação individual de Richard Tsukada por ' + esc(olharPreco(o)) + '. Pagamento único, sem assinatura.</p><div class="acoes"><a class="btn btn-secundario" href="#/olhar">Conhecer o olhar do treinador</a></div></section>';
      }
    }).catch(function () { /* a página inicial funciona sem a chamada */ });
  }

  /* cartão do produto na área de consultorias (primeiro da lista) */
  function cartaoOlharConsulHtml(o) {
    var p = o.produto;
    return '<article class="consul-card" aria-labelledby="cn-olhar"><p class="olho">Orientação individual · entrada</p><h2 id="cn-olhar">' + esc(p.nome) + "</h2>" +
      '<p class="consul-desc">' + esc(p.descricaoCurta) + "</p>" +
      '<ul class="consul-entregas" aria-label="Principais entregas"><li>Devolutiva individual em áudio ou vídeo</li><li>Duração de 3 a 5 minutos</li><li>Um ajuste prioritário para aplicar</li><li>Entrega em até ' + p.prazoDiasUteis + " dias úteis</li></ul>" +
      '<dl class="consul-fatos"><div><dt>Valor</dt><dd><strong class="consul-preco">' + esc(olharPreco(o)) + '</strong> <span class="consul-unidade">' + esc(p.condicao) + "</span></dd></div><div><dt>Prazo</dt><dd>Até " + p.prazoDiasUteis + " dias úteis</dd></div></dl>" +
      '<a class="btn btn-primario largo" href="#/olhar/pedir">Quero o olhar do treinador</a><p style="text-align:center"><a class="btn btn-texto" href="#/olhar">Ver detalhes<span class="sr"> do Olhar do treinador</span></a></p></article>';
  }
  /* como escolher entre os serviços: o escopo de cada um, lado a lado */
  function diferencasServicosHtml(o) {
    var cat = {}; consulLista().forEach(function (c) { cat[c.id] = c; });
    function preco(id) { return cat[id] ? reaisInteiro(cat[id].precoCentavos) : ""; }
    var itens = [
      ["Olhar do treinador", olharPreco(o), "Uma dúvida específica, com devolutiva gravada de 3 a 5 minutos."],
      ["Revisão de estratégia", preco("revisao-estrategia"), "Revisão de um plano existente, ajustes e três prioridades. Entrega em até 3 dias úteis. Não inclui análise de partidas."],
      ["Consultoria ao vivo", preco("consultoria-ao-vivo"), "Videochamada individual de 50 minutos, leitura prévia da ficha e resumo com plano de ação. Não inclui análise prévia de partidas."],
      ["Análise completa do jogador", preco("analise-completa"), "Análise de três partidas completas, totalizando até seis horas de gravação. Devolutiva em vídeo, relatório e plano de ação. Prazo de 7 a 10 dias úteis após validação do material. Acima de seis horas: orçamento personalizado."],
      ["Análise completa + consultoria", preco("analise-mais-consultoria"), "Todas as entregas da análise completa e uma videochamada de 50 minutos."],
    ];
    return '<section class="cartao consul-escolha" aria-labelledby="t-dif"><h2 id="t-dif">Qual atendimento faz sentido para você?</h2><dl class="olhar-dif">' + itens.map(function (i) {
      return "<div><dt>" + esc(i[0]) + (i[1] ? " — " + esc(i[1]) : "") + "</dt><dd>" + esc(i[2]) + "</dd></div>";
    }).join("") + '</dl><p class="nota" style="margin-top:10px">Serviços avulsos, com pagamento por contratação, separados da assinatura da plataforma.</p></section>';
  }

  /* página do produto */
  async function telaOlhar() {
    tela('<p class="carregando">Carregando…</p>', true);
    var o; try { o = await carregarOlhar(true); } catch (e) { olharFalha(e, telaOlhar); return; }
    var p = o.produto, ativo = olharPedidoAtivo(o), nova = olharPedidoNovo(o);
    tela(olharVoltar("#/consultorias", "Voltar para consultorias") +
      '<p class="olho">Orientação individual</p><h1 class="consul-titulo">' + esc(p.nome) + '</h1><p class="sub">' + esc(p.descricaoCurta) + "</p>" +
      (nova ? '<div class="aviso" role="status"><strong>Sua orientação chegou.</strong> <a href="#/olhar/pedido/' + esc(nova.id) + '">Ouvir minha devolutiva</a></div>' : ativo ? '<div class="aviso" role="status">Você tem um pedido em andamento. <a href="#/olhar/pedido/' + esc(ativo.id) + '">Acompanhar meu pedido</a></div>' : "") +
      '<div class="cartao consul-resumo"><dl class="consul-fatos"><div><dt>Valor</dt><dd><strong class="consul-preco">' + esc(olharPreco(o)) + '</strong> <span class="consul-unidade">Pagamento único. Sem assinatura.</span></dd></div><div><dt>Prazo</dt><dd>Até ' + p.prazoDiasUteis + " dias úteis após a confirmação do pagamento e o envio completo da solicitação</dd></div></dl>" +
        '<a class="btn btn-primario largo" href="#/olhar/pedir">Quero o olhar do treinador</a></div>' +
      '<section class="consul-bloco inclui"><h2>O que você recebe</h2><ul class="consul-lista-itens"><li>Uma devolutiva pessoal de Richard Tsukada, em áudio ou vídeo de 3 a 5 minutos, sobre a sua dúvida principal.</li><li>Leitura da ficha e da estratégia vinculadas ao pedido.</li><li>Comentário sobre a dúvida apresentada.</li><li>Um ajuste prioritário.</li><li>Uma orientação prática para testar no próximo treino ou jogo.</li></ul><p class="nota" style="margin-top:8px">Richard escolhe o formato, áudio ou vídeo, conforme a necessidade da explicação. A resposta é gravada por ele pessoalmente.</p></section>' +
      '<section class="consul-bloco nao-inclui"><h2>O que não está incluído</h2><ul class="consul-lista-itens"><li>Revisão completa da estratégia.</li><li>Análise de gravações de partidas.</li><li>Videochamada.</li><li>Conversa contínua ou atendimento ilimitado.</li><li>Planejamento completo de treinamento.</li><li>Garantia de resultados esportivos.</li></ul></section>' +
      '<section class="consul-bloco"><h2>Como funciona</h2><ol class="consul-passos"><li><strong>Escolha sua estratégia.</strong> Selecione o plano que você quer comentar.</li><li><strong>Envie sua dúvida.</strong> Conte o que acontece no seu jogo e o que gostaria de entender.</li><li><strong>Receba minha orientação.</strong> Acesse sua devolutiva gravada na plataforma em até ' + p.prazoDiasUteis + " dias úteis após a confirmação do pedido.</li></ol>" +
        '<p class="nota" style="margin-top:8px">A compra não exige assinatura paga da plataforma. Você precisa de uma conta e de uma estratégia cadastrada. No plano gratuito você cria ' + p.estrategiasGratis + (p.estrategiasGratis === 1 ? " estratégia" : " estratégias") + ', e ela já permite pedir o olhar do treinador. Novas estratégias seguem os limites do seu plano e não estão incluídas neste valor.</p></section>' +
      '<p class="consul-regra">' + esc(OLHAR_NAO_INCLUI) + "</p>" +
      olharFaqHtml() +
      '<a class="btn btn-primario btn-grande" href="#/olhar/pedir">Quero o olhar do treinador</a>' +
      '<p class="nota" style="margin-top:10px">Quer revisar o plano completo? <a href="#/consultorias/revisao-estrategia">Conheça a Revisão de estratégia</a>.</p>');
  }

  /* solicitação: estratégia, dúvida e detalhe, com rascunho neste aparelho */
  async function telaOlharForm(planoIdUrl) {
    tela('<p class="carregando">Carregando…</p>', true);
    var o; try { o = await carregarOlhar(true); } catch (e) { olharFalha(e, function () { telaOlharForm(planoIdUrl); }); return; }
    var p = o.produto, rasc = lerOlharRasc(), ests = o.estrategias || [];
    if (planoIdUrl && ests.some(function (e) { return e.id === planoIdUrl; })) { rasc.estrategiaId = planoIdUrl; }
    if (!ests.some(function (e) { return e.id === rasc.estrategiaId; })) rasc.estrategiaId = ests[0] ? ests[0].id : "";
    if (!ests.length) {
      tela(olharVoltar("#/olhar", "Voltar para o olhar do treinador") + '<h1 class="consul-titulo">Receba o olhar do treinador</h1>' +
        '<div class="cartao"><h2>Primeiro, uma estratégia</h2><p class="nota" style="margin-top:6px">O olhar do treinador comenta uma estratégia sua. Você ainda não tem uma pronta. ' + esc(avisoCota()) + '</p>' +
        '<div class="acoes"><a class="btn btn-primario" href="#/estrategia">' + (estado.dados && estado.dados.fichaCompleta ? "Ir para as estratégias" : "Completar meu perfil e criar a estratégia") + '</a></div></div>' +
        '<p class="nota" style="margin-top:12px">Nada é cobrado antes de você preencher e revisar a solicitação.</p>');
      return;
    }
    var ativoMesmo = (o.pedidos || []).filter(function (x) { return x.estado === "aguardando_pagamento" && x.estrategia && x.estrategia.id === rasc.estrategiaId; })[0];
    tela(olharVoltar("#/olhar", "Voltar para o olhar do treinador") +
      '<h1 class="consul-titulo">Receba o olhar do treinador</h1>' +
      '<p class="sub">Escolha uma estratégia e envie uma dúvida principal. Richard vai comentar esse ponto e indicar um ajuste para você testar.</p>' +
      '<p class="olhar-resumo-topo"><strong>' + esc(olharPreco(o)) + "</strong> · Áudio ou vídeo de 3 a 5 minutos</p>" +
      (ativoMesmo ? '<div class="aviso" role="status">Você já tem um pedido aguardando pagamento para esta estratégia. Se continuar, ele será atualizado, sem criar outro.</div>' : "") +
      '<form id="fOlhar" class="consul-form" novalidate>' +
        '<div class="campo"><label for="olEst">Qual estratégia você quer comentar?</label><select id="olEst">' + ests.map(function (e) { return '<option value="' + esc(e.id) + '"' + (e.id === rasc.estrategiaId ? " selected" : "") + ">" + esc(olharResumo(e.titulo, 60)) + "</option>"; }).join("") + '</select><div class="olhar-previa" id="olPrevia" aria-live="polite"></div><p class="erro-campo" id="olEstE" hidden></p></div>' +
        '<div class="campo"><label for="olDuvida">Qual é sua principal dúvida?</label><textarea id="olDuvida" rows="6" maxlength="' + p.duvida.max + '" aria-describedby="olDuvidaA olDuvidaC" placeholder="Ex.: Minha estratégia sugere atacar a segunda bola, mas tenho medo de errar e acabo apenas devolvendo. Como posso começar a aplicar essa orientação?">' + esc(rasc.duvida || "") + '</textarea>' +
          '<p class="nota" id="olDuvidaA" style="margin-top:4px">Escolha um ponto para aprofundar. Conte o que acontece e o que você gostaria de entender.</p><p class="olhar-contador" id="olDuvidaC" aria-live="polite"></p><p class="erro-campo" id="olDuvidaE" hidden></p></div>' +
        '<div class="campo"><label for="olCtx">Tem algum detalhe importante? <span class="nota">(opcional)</span></label><textarea id="olCtx" rows="3" maxlength="' + p.contexto.max + '" aria-describedby="olCtxA olCtxC">' + esc(rasc.contexto || "") + "</textarea>" +
          '<p class="nota" id="olCtxA" style="margin-top:4px">Conte quando essa dificuldade aparece ou o que você já tentou fazer.</p><p class="olhar-contador" id="olCtxC" aria-live="polite"></p><p class="erro-campo" id="olCtxE" hidden></p></div>' +
        '<section class="cartao olhar-delimita" aria-label="Delimitação do atendimento"><p class="olho">Você recebe</p><p>Uma orientação individual gravada sobre a dúvida enviada, com um ajuste prioritário e uma sugestão para aplicar.</p>' +
          '<p class="olho" style="margin-top:10px">Este atendimento não inclui</p><p>Revisão completa do plano, análise de partidas em vídeo, encontro ao vivo ou acompanhamento contínuo.</p>' +
          '<p style="margin-top:8px"><a href="#/consultorias/revisao-estrategia">Quero revisar meu plano completo</a></p></section>' +
        '<div class="acoes"><button class="btn btn-primario btn-grande" type="submit">Revisar pedido</button></div>' +
        '<p class="nota" style="margin-top:8px">Nada é cobrado agora. Você revisa tudo antes de seguir para o pagamento. O que você escreve fica salvo neste aparelho.</p></form>' +
      olharFaqHtml());
    var f = document.getElementById("fOlhar");
    function ler() { rasc.estrategiaId = document.getElementById("olEst").value; rasc.duvida = document.getElementById("olDuvida").value; rasc.contexto = document.getElementById("olCtx").value; }
    function atualizar() {
      ler(); salvarOlharRasc(rasc);
      var e = ests.filter(function (x) { return x.id === rasc.estrategiaId; })[0];
      document.getElementById("olPrevia").innerHTML = e ? "<strong>" + esc(e.titulo) + '</strong><span class="nota"> · criada em ' + esc(dataBR(e.criadoEm)) + "</span>" + (e.objetivo ? '<p class="nota">Objetivo: ' + esc(olharResumo(e.objetivo, 160)) + "</p>" : "") : "";
      var nd = rasc.duvida.trim().length, nc = rasc.contexto.trim().length;
      var cd = document.getElementById("olDuvidaC"); cd.textContent = nd + " de " + p.duvida.max + " caracteres" + (nd < p.duvida.min ? " (mínimo " + p.duvida.min + ")" : ""); cd.className = "olhar-contador" + (nd > 0 && nd < p.duvida.min ? " falta" : "");
      document.getElementById("olCtxC").textContent = nc + " de " + p.contexto.max + " caracteres";
    }
    f.addEventListener("input", atualizar); f.addEventListener("change", atualizar); atualizar();
    f.addEventListener("submit", function (ev) {
      ev.preventDefault(); ler(); salvarOlharRasc(rasc);
      f.querySelectorAll(".erro-campo").forEach(function (x) { x.hidden = true; });
      var n = rasc.duvida.trim().length, primeiro = null;
      function erro(id, msg) { var el = document.getElementById(id); el.textContent = msg; el.hidden = false; if (!primeiro) primeiro = id; }
      if (!rasc.estrategiaId) erro("olEstE", "Escolha a estratégia que você quer comentar.");
      if (n < p.duvida.min) erro("olDuvidaE", "Descreva sua dúvida com pelo menos " + p.duvida.min + " caracteres. Hoje são " + n + ".");
      if (n > p.duvida.max) erro("olDuvidaE", "A dúvida pode ter até " + p.duvida.max + " caracteres.");
      if (rasc.contexto.trim().length > p.contexto.max) erro("olCtxE", "O detalhe pode ter até " + p.contexto.max + " caracteres.");
      if (primeiro) { var el2 = document.getElementById(primeiro); el2.scrollIntoView({ block: "center" }); return; }
      ir("#/olhar/revisar");
    });
  }

  /* revisão antes do pagamento */
  async function telaOlharRevisar() {
    tela('<p class="carregando">Carregando…</p>', true);
    var o; try { o = await carregarOlhar(true); } catch (e) { olharFalha(e, telaOlharRevisar); return; }
    var p = o.produto, rasc = lerOlharRasc(), est = (o.estrategias || []).filter(function (x) { return x.id === rasc.estrategiaId; })[0];
    if (!est || String(rasc.duvida || "").trim().length < p.duvida.min) { ir("#/olhar/pedir"); return; }
    tela(olharVoltar("#/olhar/pedir", "Voltar e editar") +
      '<h1 class="consul-titulo">Revise seu pedido</h1><p class="sub">Confira antes de seguir para o pagamento.</p>' +
      '<section class="cartao" aria-labelledby="t-rev"><h2 id="t-rev">Seu pedido</h2><dl class="rp-lista">' +
        '<div class="rp-linha"><dt>Estratégia</dt><dd>' + esc(est.titulo) + ' <span class="nota">· ' + esc(dataBR(est.criadoEm)) + "</span></dd></div>" +
        '<div class="rp-linha"><dt>Dúvida principal</dt><dd class="olhar-texto">' + esc(rasc.duvida.trim()) + "</dd></div>" +
        (String(rasc.contexto || "").trim() ? '<div class="rp-linha"><dt>Detalhe adicional</dt><dd class="olhar-texto">' + esc(rasc.contexto.trim()) + "</dd></div>" : "") +
        '<div class="rp-linha"><dt>Entrega</dt><dd>Devolutiva em áudio ou vídeo de 3 a 5 minutos</dd></div>' +
        '<div class="rp-linha"><dt>Prazo</dt><dd>Até ' + p.prazoDiasUteis + " dias úteis após a confirmação do pagamento</dd></div>" +
        '<div class="rp-linha"><dt>Valor total</dt><dd><strong>' + esc(olharPreco(o)) + "</strong></dd></div>" +
        '<div class="rp-linha"><dt>Pagamento</dt><dd>Único, sem recorrência</dd></div></dl>' +
        '<p class="acoes"><a class="btn btn-secundario" href="#/olhar/pedir">Editar</a></p></section>' +
      '<form id="fRevisao" novalidate><label class="alternar" style="margin-top:12px"><input type="checkbox" id="olAceite"><span>Entendi que este atendimento contempla uma dúvida e uma devolutiva gravada, sem encontro ao vivo ou análise de partidas em vídeo.</span></label>' +
        '<p class="erro-campo" id="olAceiteE" hidden>Confirme que entendeu o que o atendimento contempla para continuar.</p><div class="aviso" id="olAviso" role="alert" hidden></div>' +
        '<div class="acoes"><button class="btn btn-primario btn-grande" id="btOlharPagar" type="submit">Continuar para pagamento · ' + esc(olharPreco(o)) + '</button></div>' +
        '<p class="nota" style="margin-top:8px">Você segue para a página de pagamento da Eduzz. Use o mesmo e-mail da sua conta (' + esc(o.email) + ") para o pagamento ser reconhecido sozinho.</p></form>");
    var f = document.getElementById("fRevisao"), bt = document.getElementById("btOlharPagar"), enviando = false;
    f.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      if (enviando) return;
      var aviso = document.getElementById("olAviso"); aviso.hidden = true;
      document.getElementById("olAceiteE").hidden = document.getElementById("olAceite").checked;
      if (!document.getElementById("olAceite").checked) return;
      enviando = true; ocupado(bt, true, "Preparando o pagamento…");
      var id = null;
      try {
        var c = await api("player-olhar", { metodo: "POST", corpo: { acao: "criar", estrategiaId: rasc.estrategiaId, duvida: rasc.duvida, contexto: rasc.contexto, aceite: true } });
        id = c.id; rasc.pedidoId = id; salvarOlharRasc(rasc); estado.olhar = null;
        var pg = await api("player-olhar", { metodo: "POST", corpo: { acao: "pagar", id: id } });
        window.location.assign(pg.checkoutUrl);
      } catch (e) {
        enviando = false; ocupado(bt, false);
        aviso.innerHTML = esc(e.message) + (id ? ' Seu pedido ficou salvo em <a href="#/atendimentos">Meus atendimentos</a>.' : ""); aviso.hidden = false; aviso.scrollIntoView({ block: "center" });
      }
    });
  }

  /* um pedido: pagamento, acompanhamento e entrega */
  var olharTimer = null;
  function pararOlharTimer() { clearTimeout(olharTimer); olharTimer = null; }
  async function telaOlharPedido(id) {
    pararOlharTimer();
    tela('<p class="carregando">Carregando…</p>', true);
    var r, o;
    try { r = await api("player-olhar?id=" + encodeURIComponent(id)); o = await carregarOlhar(false); }
    catch (e) { tela(olharVoltar("#/atendimentos", "Voltar para meus atendimentos") + '<div class="aviso" role="alert">' + esc(e.message) + "</div>"); return; }
    var p = r.pedido, preco = olharPreco(o), h = olharVoltar("#/atendimentos", "Voltar para meus atendimentos");
    var fatos = '<dl class="rp-lista"><div class="rp-linha"><dt>Pedido</dt><dd>' + esc(p.numero || "") + '</dd></div><div class="rp-linha"><dt>Estratégia</dt><dd>' + esc(p.estrategia ? p.estrategia.titulo : "") + "</dd></div>" +
      '<div class="rp-linha"><dt>Dúvida</dt><dd class="olhar-texto">' + esc(p.duvida) + "</dd></div>" +
      (p.confirmadoEm ? '<div class="rp-linha"><dt>Confirmado em</dt><dd>' + esc(olharDataLonga(p.confirmadoEm)) + "</dd></div>" : "") +
      (p.pagamento.estado === "aprovado" ? '<div class="rp-linha"><dt>Valor pago</dt><dd>' + esc(reaisInteiro(p.precoCentavos)) + "</dd></div>" : "") +
      (p.prazoTexto && (p.estado === "recebido" || p.estado === "em_analise") ? '<div class="rp-linha"><dt>Devolutiva prevista até</dt><dd><strong>' + esc(p.prazoTexto) + "</strong></dd></div>" : "") + "</dl>";
    if (p.estado === "aguardando_pagamento") {
      var falhou = p.pagamento.estado === "falhou", iniciou = p.pagamento.iniciado;
      tela(h + '<h1 class="consul-titulo">' + (falhou ? "O pagamento não foi concluído" : iniciou ? "Aguardando a confirmação do pagamento" : "Falta o pagamento") + "</h1>" +
        '<p class="sub">' + (falhou ? "Seu pedido continua salvo. Você pode tentar o pagamento de novo, sem preencher nada outra vez." : iniciou ? "Assim que o pagamento for confirmado, o pedido vai para o Richard e esta tela se atualiza. Pix e cartão costumam confirmar em poucos minutos; boleto pode levar mais." : "Seu pedido está salvo. Falta concluir o pagamento para ele seguir para o Richard.") + "</p>" +
        '<div class="cartao">' + fatos + '<div class="aviso" id="olAviso" role="alert" hidden></div><div class="acoes"><button class="btn btn-primario" id="btOlharPagar" type="button">' + (falhou ? "Tentar o pagamento de novo" : "Ir para o pagamento") + " · " + esc(preco) + '</button><button class="btn btn-secundario" id="btOlharAtualizar" type="button">Atualizar situação</button></div>' +
        '<p class="acoes"><a class="btn btn-texto" href="#/olhar/pedir" id="lkOlharEditar">Editar o pedido</a><button class="btn btn-texto" id="btOlharCancelar" type="button">Cancelar pedido</button></p></div>' +
        '<p class="nota" style="margin-top:10px">Use o mesmo e-mail da sua conta (' + esc(o.email) + ") no pagamento. Se pagou e o pedido não avançar, fale com o <a href=\"" + esc(suporteUrl("Olá! Paguei o Olhar do treinador (pedido " + (p.numero || "") + ") e o pedido não avançou.")) + '" target="_blank" rel="noopener">suporte</a>.</p>');
      document.getElementById("lkOlharEditar").addEventListener("click", function () { salvarOlharRasc({ estrategiaId: p.estrategia ? p.estrategia.id : "", duvida: p.duvida, contexto: p.contexto, pedidoId: p.id }); });
      document.getElementById("btOlharAtualizar").addEventListener("click", function () { estado.olhar = null; telaOlharPedido(id); });
      var bt = document.getElementById("btOlharPagar"), cx = false;
      bt.addEventListener("click", async function () {
        if (cx) return; cx = true; ocupado(bt, true, "Abrindo o pagamento…");
        try { var pg = await api("player-olhar", { metodo: "POST", corpo: { acao: "pagar", id: id } }); window.location.assign(pg.checkoutUrl); }
        catch (e) { cx = false; ocupado(bt, false); var av = document.getElementById("olAviso"); av.textContent = e.message; av.hidden = false; }
      });
      document.getElementById("btOlharCancelar").addEventListener("click", async function () {
        if (!window.confirm("Cancelar este pedido? Nada foi cobrado.")) return;
        try { await api("player-olhar", { metodo: "POST", corpo: { acao: "cancelar", id: id } }); estado.olhar = null; limparOlharRasc(); toast("Pedido cancelado."); ir("#/atendimentos"); } catch (e) { toast(e.message, null, true); }
      });
      if (iniciou && !falhou) { var tent = 0; (function sondar() { olharTimer = setTimeout(async function () {
        if (location.hash.indexOf("#/olhar/pedido/" + id) !== 0 || ++tent > 40) return;
        try { var x = await api("player-olhar?id=" + encodeURIComponent(id)); if (x.pedido.estado !== "aguardando_pagamento" || x.pedido.pagamento.estado === "falhou") { estado.olhar = null; telaOlharPedido(id); return; } } catch (e) { /* tenta de novo */ }
        sondar();
      }, 8000); })(); }
      return;
    }
    if (p.estado === "recebido" || p.estado === "em_analise") {
      limparOlharRasc();
      tela(h + '<h1 class="consul-titulo">' + (p.estado === "recebido" ? "Pedido recebido" : "Seu pedido está em análise") + '</h1><p class="sub">Sua dúvida foi enviada para Richard. Você poderá acompanhar a entrega por aqui.</p>' +
        '<div class="cartao"><p><span class="tag">' + esc(p.rotulo) + "</span></p>" + fatos + '<div class="acoes"><a class="btn btn-primario" href="#/atendimentos">Acompanhar meu pedido</a></div></div>' +
        '<p class="nota" style="margin-top:10px">A devolutiva aparece nesta tela e em Meus atendimentos. Você não precisa de assinatura ativa para consultá-la.</p>');
      return;
    }
    if (p.estado === "devolutiva_disponivel" && p.devolutiva) {
      var d = p.devolutiva;
      tela(h + '<p class="olho">' + esc(d.autor) + " · " + esc(olharDataLonga(d.publicadaEm)) + '</p><h1 class="consul-titulo">Seu olhar do treinador chegou</h1>' +
        '<section class="cartao olhar-player" aria-labelledby="t-play"><h2 id="t-play">' + (d.tipo === "video" ? "Vídeo de " : "Áudio de ") + esc(d.autor) + '</h2><div id="olMidia"><button class="btn btn-primario" id="btOlharAbrir" type="button">' + (d.tipo === "video" ? "Abrir o vídeo" : "Abrir o áudio") + '</button></div><p class="nota" id="olMidiaNota" style="margin-top:8px">Toque para carregar. Nada toca sozinho.' + (d.duracaoSeg ? " Duração: " + Math.floor(d.duracaoSeg / 60) + " min " + (d.duracaoSeg % 60) + " s." : "") + "</p></section>" +
        (d.resumo ? '<section class="cartao"><h2>Resumo de Richard</h2><p class="olhar-texto">' + esc(d.resumo) + "</p></section>" : "") +
        '<section class="cartao"><h2>Sua dúvida</h2><p class="olhar-texto">' + esc(p.duvida) + '</p><p class="nota" style="margin-top:6px">Estratégia: ' + (p.estrategia ? '<a href="#/estrategia/' + esc(p.estrategia.id) + '">' + esc(p.estrategia.titulo) + "</a>" : "") + " · pedido " + esc(p.numero || "") + "</p></section>" +
        '<p class="nota" style="margin-top:10px">Problema para abrir o arquivo? <a href="' + esc(suporteUrl("Olá! Não consegui abrir a devolutiva do Olhar do treinador (pedido " + (p.numero || "") + ").")) + '" target="_blank" rel="noopener">Fale com o suporte</a>. Esta orientação fica guardada em Meus atendimentos.</p>');
      var bAbrir = document.getElementById("btOlharAbrir");
      async function abrirMidia() {
        ocupado(bAbrir, true, "Carregando…");
        try {
          var a = await api("player-olhar?id=" + encodeURIComponent(id) + "&arquivo=1"), el = document.createElement(a.tipo === "video" ? "video" : "audio");
          el.controls = true; el.preload = "metadata"; el.setAttribute("playsinline", ""); el.src = a.url; el.className = "olhar-midia";
          el.addEventListener("error", function () { document.getElementById("olMidiaNota").innerHTML = 'Não foi possível tocar o arquivo. <button type="button" class="btn btn-texto" id="btOlharRecarregar">Carregar de novo</button>'; document.getElementById("btOlharRecarregar").addEventListener("click", abrirMidia); });
          var alvo = document.getElementById("olMidia"); alvo.textContent = ""; alvo.appendChild(el);
          estado.olhar = null;
        } catch (e) { ocupado(bAbrir, false); document.getElementById("olMidiaNota").textContent = e.message; }
      }
      bAbrir.addEventListener("click", abrirMidia);
      return;
    }
    tela(h + '<h1 class="consul-titulo">' + esc(p.rotulo) + '</h1><div class="cartao">' + fatos + "</div>" +
      (p.estado === "reembolsado" ? '<p class="nota" style="margin-top:10px">O pagamento deste pedido foi estornado pela Eduzz. Em caso de dúvida, fale com o <a href="' + esc(suporteUrl("Olá! Dúvida sobre o reembolso do pedido " + (p.numero || "") + ".")) + '" target="_blank" rel="noopener">suporte</a>.</p>' : ""));
  }

  /* Meus atendimentos: pedidos e devolutivas */
  async function telaAtendimentos() {
    pararOlharTimer();
    tela('<p class="carregando">Carregando…</p>', true);
    var o; try { o = await carregarOlhar(true); } catch (e) { olharFalha(e, telaAtendimentos); return; }
    var rasc = lerOlharRasc(), temRasc = String(rasc.duvida || "").trim().length > 0 && !rasc.pedidoId;
    var botao = function (p) {
      if (p.estado === "devolutiva_disponivel") return '<a class="btn btn-primario btn-pequeno" href="#/olhar/pedido/' + esc(p.id) + '">' + (p.nova ? "Ouvir minha devolutiva" : "Ver devolutiva") + "</a>";
      if (p.estado === "aguardando_pagamento") return '<a class="btn btn-primario btn-pequeno" href="#/olhar/pedido/' + esc(p.id) + '">' + (p.pagamento.estado === "falhou" ? "Tentar o pagamento de novo" : "Continuar o pagamento") + "</a>";
      return '<a class="btn btn-secundario btn-pequeno" href="#/olhar/pedido/' + esc(p.id) + '">Acompanhar</a>';
    };
    var itens = [];
    if (temRasc) itens.push('<li class="olhar-item"><p class="olho">' + esc(o.produto.nome) + '</p><p class="olhar-texto">' + esc(olharResumo(rasc.duvida, 110)) + '</p><p><span class="tag">Rascunho</span></p><div class="acoes"><a class="btn btn-secundario btn-pequeno" href="#/olhar/pedir">Continuar o rascunho</a></div></li>');
    (o.pedidos || []).forEach(function (p) {
      itens.push('<li class="olhar-item"><p class="olho">' + esc(p.produto) + " · " + esc(olharDataLonga(p.criadoEm)) + (p.numero ? " · " + esc(p.numero) : "") + '</p><p class="olhar-texto">' + esc(olharResumo(p.duvida, 110)) + '</p><p><span class="tag' + (p.nova ? " tag-adv" : "") + '">' + esc(p.nova ? "Orientação disponível" : p.rotulo) + "</span>" +
        (p.estado === "aguardando_pagamento" && p.pagamento.estado === "falhou" ? ' <span class="nota">' + esc(p.pagamento.rotulo) + "</span>" : "") + (p.prazoTexto && (p.estado === "recebido" || p.estado === "em_analise") ? ' <span class="nota">· até ' + esc(p.prazoTexto) + "</span>" : "") + "</p>" +
        '<div class="acoes">' + botao(p) + "</div></li>");
    });
    tela(abasPlanosHtml("atendimentos") + '<h1>Meus atendimentos</h1><p class="sub">Os pedidos do Olhar do treinador e as orientações que você recebeu.</p>' +
      '<div id="hubAtend"></div><h2 class="secao">Olhar do treinador</h2>' +
      (itens.length ? '<ul class="olhar-lista">' + itens.join("") + "</ul>" : '<div class="cartao" style="margin-top:14px"><h2>Você ainda não tem atendimentos</h2><p class="nota" style="margin-top:6px">Quando você pedir um olhar do treinador, o acompanhamento e a devolutiva ficam aqui.</p><div class="acoes"><a class="btn btn-primario" href="#/olhar">Conhecer o olhar do treinador</a></div></div>') +
      '<p class="nota" style="margin-top:12px">Outros serviços, como a revisão de estratégia e a análise completa, são combinados pelo WhatsApp. Veja em <a href="#/consultorias">Consultorias</a>.</p>');
    if (window.QL_HUB) window.QL_HUB.preencherAtendimentos(document.getElementById("hubAtend"));
  }

  async function rotear() {
    var logado = auth && auth.currentUser;
    var h = location.hash.replace(/^#\/?/, "");
    var partes = h.split("?")[0].split("/"); // o que vier depois de "?" (ex.: retorno do pagamento) nunca muda nada: só o servidor libera acesso
    atualizarCasca(!!logado, partes[0]);
    document.body.classList.remove("teclado", "acesso", "rota-sim");
    var t = document.getElementById("toast"); if (t && Date.now() - toastEm > 1200) t.hidden = true; // um aviso criado junto com a navegação (ex.: "perfil salvo") continua visível
    /* visitante sem rota: página pública de apresentação; #/entrar e #/criar (e qualquer link direto) seguem para o cadastro/entrada */
    /* produtos distintos: cada app só conhece as próprias rotas; uma rota do outro cai na tela inicial, sem redirecionar para lá */
    if (!MODO_COMP && ROTAS_COMP[partes[0]]) partes = [""];
    if (MODO_COMP && logado && !ROTAS_APP_COMP[partes[0]]) partes = [""];
    var LAND = MODO_COMP ? window.QL_COMP_LANDING : window.QL_LANDING;
    var visitanteNaHome = !logado && !partes[0] && LAND;
    document.body.classList.toggle("landing", !!visitanteNaHome);
    if (visitanteNaHome) { tela(LAND.html()); LAND.ligar(app); return; }
    if (!logado) { telaEntrar(ROTAS_ACESSO[partes[0]] ? partes[0] : "criar"); return; }
    if (!estado.dados) {
      tela('<p class="carregando">Carregando seus dados…</p>', true);
      try { await carregarDados(); aplicarRascunho(); atualizarConta(); (MODO_COMP ? Promise.resolve() : carregarAssinatura(false)).catch(function () { /* o resto do app funciona sem a área comercial */ }); }
      catch (e) {
        tela('<div class="pilha"><div class="aviso">' + esc(e.message) + '</div><div class="acoes"><button class="btn btn-primario" id="btTentar" type="button">Tentar de novo</button></div></div>');
        document.getElementById("btTentar").addEventListener("click", rotear);
        return;
      }
    }
    var r = partes[0];
    if (r === "simulador") { telaSimulador(partes[1]); return; }
    if (HUB_TELAS[r]) { HUB_TELAS[r].apply(null, partes.slice(1)); return; }
    if (MODO_COMP && COMP_TELAS[r]) { COMP_TELAS[r].apply(null, partes.slice(1)); return; }
    if (r === "ficha") telaFicha(partes[1]);
    else if (r === "gerando" && partes[1]) telaGerando(partes[1]);
    else if ((r === "estrategia" || r === "plano") && partes[1]) telaEstrategia(partes[1]);
    else if (r === "estrategia" || r === "planos") telaEstrategias();
    else if (r === "completar" && partes[1]) telaCompletar(partes[1], partes[2]);
    else if (r === "jogadas") telaJogadas(partes[1]);
    else if (r === "planejar" && partes[1]) telaPlanejar(partes[1]);
    else if (r === "gerandoPlanej" && partes[1]) telaGerandoPlanej(partes[1]);
    else if (r === "programa" && partes[1]) telaPrograma(partes[1]);
    else if (r === "planejamento" && partes[1]) { if (partes[2]) telaTreino(partes[1], partes[2]); else telaPrograma(partes[1]); }
    else if (r === "treino" && partes[1] && partes[2]) telaTreino(partes[1], partes[2]);
    else if (r === "treinos" || r === "treino") telaTreinos();
    else if (MODO_COMP && r === "pensamentos") telaPensamentos();
    else if (MODO_COMP && r === "ritual") telaRitual();
    else if (r === "aquecimento") telaAquecimento();
    else if (r === "desafios") telaDesafios();
    else if (r === "desafio") { if (partes[1]) telaDesafioDia(partes[1]); else telaDesafio(); }
    else if (r === "partidas") { if (partes[1] === "nova") telaPartidaForm(null); else if (partes[1]) telaPartidaForm(partes[1]); else telaPartidas(); }
    else if (MODO_COMP && r === "consultorias") telaConsultoriasComp(partes[1], partes[2]);
    else if (MODO_COMP && r === "ajuda") telaAjudaComp();
    else if (r === "pedidos") telaPedidos();
    else if (r === "temporada") { if (partes[1] === "novo" || partes[2] === "editar") telaTorneioForm(partes[1]); else if (partes[1]) telaTorneio(partes[1]); else telaTemporada(); }
    else if (r === "preparo" && partes[1] && partes[2]) telaPreparo(partes[1], partes[2]);
    else if (r === "diario") telaDiario();
    else if (r === "devolutivas") telaDevolutivas();
    else if (r === "focos") telaFocos();
    else if (r === "scouts") telaScouts(partes[1]);
    else if (r === "ao-vivo") telaAoVivo(partes[1]);
    else if (!MODO_COMP && r === "olhar") { if (partes[1] === "pedir") telaOlharForm(partes[2]); else if (partes[1] === "revisar") telaOlharRevisar(); else if (partes[1] === "pedido" && partes[2]) telaOlharPedido(partes[2]); else telaOlhar(); }
    else if (!MODO_COMP && r === "atendimentos") telaAtendimentos();
    else if (MODO_COMP && r === "recomendacoes") telaRecomendacoes();
    else if (MODO_COMP && r === "treinos") telaTreinosSugeridos();
    else if (r === "competicao" || (MODO_COMP && (r === "inicio" || r === ""))) { if (partes[1] === "vinculo" && partes[2]) { if (partes[3] === "scout" && partes[4]) telaScoutVinculo(partes[2], partes[4]); else if (partes[3] === "marcar") telaScoutFamilia(partes[2]); else telaVinculo(partes[2]); } else telaCompeticao(); }
    else if (r === "conta") telaConta();
    else if (r === "jogador") telaJogador();
    else if (r === "assinatura") telaAssinatura();
    else if (r === "assinaturas") telaAssinaturas();
    else if (r === "consultorias") { if (partes[1] && partes[2] === "solicitar") telaSolicitacao(partes[1]); else if (partes[1]) telaConsultoriaDetalhe(partes[1]); else telaConsultorias(); }
    else if (r === "ajuda") telaAjuda();
    else telaInicio();
  }

  /* Competição: as telas de planejamento e acompanhamento moram em competicao/comp-plano.js e usam estas utilidades */
  var COMP_TELAS = {}, HUB_TELAS = {}; // QuadraLab Hub (player/hub.js): encontrar um treinador e Meus atendimentos, nos dois apps
  window.QL_APP = {
    tela: tela, api: api, esc: esc, ir: ir, dados: function () { return estado.dados; }, toast: toast, ocupado: ocupado, reais: reais, dataCurta: dataCurta, dataISO: dataISO, hojeISOLocal: hojeISOLocal, botaoVoz: botaoVoz,
    periodoTorneio: periodoTorneio, quandoTorneio: quandoTorneio, rotuloEstadoTorneio: rotuloEstadoTorneio, rotuloAreas: rotuloAreas, areasComp: function () { return AREAS_COMP; },
    registrar: function (rota, fn) { COMP_TELAS[rota] = fn; }, registrarHub: function (rotas) { Object.keys(rotas).forEach(function (k) { HUB_TELAS[k] = rotas[k]; }); }, atualizarHome: function () { return telaCompeticao(); },
  };

  /* ── início ── */
  if (typeof firebase === "undefined") {
    tela('<div class="aviso">Não foi possível carregar o app. Verifique sua conexão e recarregue a página.</div>');
    return;
  }
  firebase.initializeApp(FIREBASE);
  auth = firebase.auth();
  auth.languageCode = "pt";
  window.addEventListener("hashchange", function (ev) {
    var antiga = (ev.oldURL || "").split("#")[1]; antiga = antiga ? "#" + antiga : "";
    posicoes[antiga] = posAtual;
    var nova = location.hash;
    if (menuTocado) { menuTocado = false; pilha = [nova]; voltando = false; }
    else if (pilha.length >= 2 && pilha[pilha.length - 2] === nova) { pilha.pop(); voltando = true; }
    else if (pilha[pilha.length - 1] !== nova) { pilha.push(nova); if (pilha.length > 40) pilha.shift(); }
    rotear();
  });
  auth.onAuthStateChanged(function (u) {
    if (!u) estado.dados = null;
    var h = location.hash;
    if (u && (!h || h === "#/entrar" || h === "#/criar" || h === "#/recuperar" || h === "#/")) { location.hash = "#/inicio"; return; }
    pilha = [location.hash];
    rotear();
  });
})();
