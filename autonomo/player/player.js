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
  function tela(html, provisoria) {
    pararVoz();
    app.innerHTML = html;
    ligarVoz();
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
      '<p class="nota voz-aviso">Ditado pelo reconhecimento de voz do seu navegador (Apple ou Google, conforme o aparelho). O QuadraLab não guarda o áudio. Revise o texto antes de salvar.</p>';
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
     O foco é o próximo treino. Nada de oferta de assinatura aqui: o acesso fica no avatar e em Minha assinatura. */
  function esteiraHtml() {
    return '<section class="cartao compacto como-funciona" aria-labelledby="t-como"><h2 id="t-como">Como funciona</h2><ol>' +
      "<li><strong>Estratégia</strong><span>Como jogar com as suas características e contra cada adversário.</span></li>" +
      "<li><strong>Jogadas</strong><span>Sequências práticas para aplicar a estratégia.</span></li>" +
      "<li><strong>Treinos</strong><span>A prática das jogadas, organizada em semanas e registrada por você.</span></li></ol>" +
      '<p class="nota" style="margin-top:8px">Seu acesso: <strong>' + esc(assinaturaDoJogador().nome) + '</strong> · <a href="#/assinatura">Minha assinatura</a></p></section>';
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
    html += (sub ? '<p class="sub">' + esc(sub) + "</p>" : "") + '<div style="margin-top:14px">' + destaque + "</div>" + preparacaoInicioHtml();
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
    tela(html);
    ligarGerar();
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
      '<div class="consultoria"><p class="olho">Consultoria</p><h2>Quer a estratégia validada por um treinador?</h2>' +
        "<p>O Richard Tsukada pode revisar a sua estratégia, analisar um vídeo do seu jogo ou conversar com você ao vivo. São serviços contratados à parte da assinatura.</p>" +
        '<a class="btn largo" href="#/consultorias">Ver consultorias</a></div>'
    );
    ligarGerar();
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
        '<div class="acoes"><a class="btn btn-primario" href="#/assinaturas">Ampliar o plano</a><a class="btn btn-secundario" href="#/assinatura">Minha assinatura</a></div></div><div class="acoes"><a class="btn btn-texto" href="#/inicio">Voltar ao início</a></div>');
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
        '<div class="acoes"><a class="btn btn-primario" href="#/assinaturas">Conhecer assinaturas</a><a class="btn btn-secundario" href="#/assinatura">Minha assinatura</a></div></div>';
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
          '<div class="acoes"><a class="btn btn-primario" href="#/assinaturas">Conhecer assinaturas</a></div></div>')
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
    aquecimento: "aquecimento", desafio: "desafios", desafios: "desafios", partidas: "partidas",
    preparo: "temporada", diario: "competicao", temporada: "temporada", competicao: "competicao", ficha: "jogador", jogador: "jogador", conta: "conta", assinatura: "assinatura", assinaturas: "assinatura", consultorias: "consultorias", ajuda: "ajuda",
    estrategia: "estrategia", plano: "estrategia", planos: "estrategia", completar: "estrategia", gerando: "estrategia",
    jogadas: "jogadas", planejar: "treinos", treinos: "treinos", treino: "treinos", programa: "treinos", planejamento: "treinos", gerandoPlanej: "treinos",
  };
  var NAV_MAIS = { preparo: 1, diario: 1, temporada: 1, competicao: 1, partidas: 1, conta: 1, jogador: 1, ficha: 1, assinatura: 1, consultorias: 1, ajuda: 1 };
  var BARRA_SECAO = { aquecimento: "treinos", desafio: "treinos", desafios: "treinos" }; // páginas que pertencem à seção Treinos
  /* Competição é um app à parte (quadralab.com.br/competicao/), com as mesmas contas e o mesmo servidor. O mesmo código atende os dois:
     window.QL_MODO = "competicao" liga a navegação e a tela inicial próprias; no Player, as rotas da Competição apontam para lá. */
  var MODO_COMP = window.QL_MODO === "competicao";
  var ROTAS_COMP = { competicao: 1, temporada: 1, preparo: 1, diario: 1, devolutivas: 1, focos: 1 };
  var ROTAS_APP_COMP = { "": 1, inicio: 1, competicao: 1, temporada: 1, preparo: 1, diario: 1, devolutivas: 1, focos: 1, partidas: 1, aquecimento: 1, desafios: 1, desafio: 1, conta: 1, ajuda: 1 };
  var PLAYER_BASE = MODO_COMP ? "/player/" : "";
  if (MODO_COMP) {
    NAV_DA_ROTA = { "": "inicio", inicio: "inicio", competicao: "inicio", temporada: "temporada", preparo: "temporada", aquecimento: "aquecimento", desafios: "desafios", desafio: "desafios", partidas: "partidas", diario: "diario", devolutivas: "inicio", focos: "inicio", conta: "conta", ajuda: "ajuda" };
    NAV_MAIS = { conta: 1, ajuda: 1 }; BARRA_SECAO = { aquecimento: "temporada", desafio: "temporada", desafios: "temporada" };
  }
  var ultimaCasca = { logado: false, rota: "" };
  function atualizarCasca(logado, rota) {
    ultimaCasca = { logado: logado, rota: rota };
    document.body.classList.toggle("logado", logado);
    lateral.hidden = !logado;
    navInf.hidden = !logado;
    document.querySelectorAll(".js-abrir-conta").forEach(function (b) { b.hidden = !logado; });
    var pagina = NAV_DA_ROTA[rota] || "inicio";                                   // item específico (barra lateral)
    var secao = NAV_MAIS[rota] ? "mais" : (BARRA_SECAO[rota] || NAV_DA_ROTA[rota] || "inicio"); // um só item da barra inferior
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
    estado.dados = null; estado.fluxo = null; estado.assin = null; estado.editandoPerfil = false;
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
      amp.textContent = a.estado === "ativa" ? "Ampliar acesso" : "Conhecer assinaturas";
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
      '<div class="acoes"><a class="btn btn-primario" href="#/assinaturas">Comparar assinaturas</a><a class="btn btn-secundario" href="#/assinatura">Minha assinatura</a></div></div>';
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
      '<h1>Meu perfil</h1><p class="sub">Seus dados de acesso. As informações esportivas ficam em <a href="#/jogador">Meu perfil de jogador</a>.</p>' +
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
      if (!window.confirm("Excluir a conta e todos os dados do QuadraLab Player? Isso não pode ser desfeito.")) return;
      ocupado(bt, true, "Excluindo…");
      try {
        var r = await api("player-privacidade", { metodo: "POST", corpo: { acao: "excluirConta", confirmar: conf } });
        estado.dados = null; estado.assin = null;
        try { await auth.signOut(); } catch (e) { /* a conta pode já não existir */ }
        location.hash = ""; rotear();
        toast(r.contaRemovida ? "Sua conta foi excluída." : "Seus dados do Player foram excluídos.");
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

  /* ── Minha assinatura ── */
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
    h += '<a class="btn btn-primario" href="#/assinaturas">' + (a.estado === "gratuito" || a.estado === "encerrada" ? "Conhecer assinaturas" : "Comparar assinaturas") + "</a>";
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
      tela('<h1>Minha assinatura</h1><div class="aviso" role="alert" style="margin-top:14px">' + esc(e.message) + '</div><div class="acoes"><button class="btn btn-primario" id="btTentarAss" type="button">Tentar de novo</button></div>');
      document.getElementById("btTentarAss").addEventListener("click", telaAssinatura);
      return;
    }
    var a = assin.assinatura, marc = marcadorCheckout();
    if (marc && a.estado === "ativa" && a.origem === "eduzz") limparCheckout();
    var aguardando = marc && Date.now() - marc.em < 3 * 3600 * 1000 && !(a.estado === "ativa" && a.origem === "eduzz");
    tela(
      "<h1>Minha assinatura</h1>" +
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
    var topo = '<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/assinatura">‹ Minha assinatura</a></p><h1>Assinaturas</h1>' +
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
      '<dl class="consul-fatos"><div><dt>Preço de lançamento</dt><dd>' + precoConsulHtml(c) + "</dd></div>" +
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
      "<li>Todos os preços são por contratação, sem renovação automática. Os valores são os de lançamento.</li>" +
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
    var lista = consulLista(), tres = lista.filter(function (c) { return c.tipo !== "completa"; }), completa = lista.filter(function (c) { return c.tipo === "completa"; })[0];
    function porTipo(t) { return lista.filter(function (c) { return c.tipo === t; })[0]; }
    var escolha = [
      ["Já tenho uma estratégia e quero ajustá-la.", porTipo("revisao")],
      ["Quero entender os padrões que se repetem nas minhas partidas.", porTipo("analise")],
      ["Quero conversar sobre dúvidas e definir próximos passos.", porTipo("ao-vivo")],
      ["Quero a análise das partidas e uma conversa para aplicar as orientações.", completa],
    ];
    tela(
      '<h1 class="consul-titulo">Um olhar profissional sobre o seu jogo</h1>' +
      '<p class="sub">Escolha o atendimento com Richard Tsukada mais adequado ao seu momento no tênis</p>' +
      '<p class="consul-aviso" role="note"><strong>Serviços individuais contratados à parte.</strong> Não estão incluídos na assinatura do QuadraLab Player.</p>' +
      '<div class="consul-lista">' + tres.map(cartaoConsulHtml).join("") + "</div>" +
      (completa ? '<div class="consul-lista consul-lista-destaque">' + cartaoConsulHtml(completa) + "</div>" : "") +
      '<section class="cartao consul-escolha" aria-labelledby="t-esc"><h2 id="t-esc">Qual atendimento faz sentido para você?</h2><ul>' +
        escolha.filter(function (e) { return e[1]; }).map(function (e) {
          return '<li><a href="#/consultorias/' + esc(e[1].id) + '"><span>' + esc(e[0]) + '</span><strong>' + esc(e[1].nome) + ' ›</strong></a></li>';
        }).join("") + "</ul></section>" +
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
      '<div class="cartao consul-resumo"><dl class="consul-fatos"><div><dt>Preço de lançamento</dt><dd>' + precoConsulHtml(c) + "</dd></div><div><dt>Prazo ou duração</dt><dd>" + esc(c.prazo) + "</dd></div></dl>" +
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
    L.push("Olá, Richard! Quero solicitar: " + c.nome + " (preço de lançamento " + reaisInteiro(c.precoCentavos) + ", " + c.unidadePreco + ", pagamento único).");
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
      '<section class="cartao consul-resumo" aria-labelledby="t-res"><h2 id="t-res">Resumo da oferta</h2><dl class="consul-fatos"><div><dt>Preço de lançamento</dt><dd>' + precoConsulHtml(c) + "</dd></div><div><dt>Prazo ou duração</dt><dd>" + esc(c.prazo) + "</dd></div></dl>" +
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
  function telaAjuda() {
    var links = (estado.assin && estado.assin.links) || {};
    tela(
      '<h1>Ajuda e suporte</h1><p class="sub">Fale com a gente por aqui.</p>' +
      '<div class="cartao" style="margin-top:16px"><h2>Falar com o suporte</h2><p class="nota" style="margin-top:6px">Dúvidas sobre o app, a sua conta, pagamentos ou a sua assinatura. Respondemos pelo WhatsApp.</p>' +
        '<a class="btn btn-primario btn-grande" href="' + esc(suporteUrl()) + '" target="_blank" rel="noopener">Abrir o WhatsApp<span class="sr"> (abre em nova aba)</span></a></div>' +
      '<div class="cartao" style="margin-top:14px"><h2>Pagamentos e assinatura</h2><ul class="lista-links"><li><a href="#/assinatura">Minha assinatura</a></li><li><a href="#/assinaturas">Comparar assinaturas</a></li><li><a href="' + esc(links.gerenciarPagamento || suporteUrl("Olá, Richard! Preciso gerenciar o pagamento da minha assinatura do QuadraLab Player.")) + '" target="_blank" rel="noopener">Gerenciar pagamento<span class="sr"> (abre em nova aba)</span></a></li></ul></div>' +
      (links.termos || links.privacidade ? '<div class="cartao" style="margin-top:14px"><h2>Documentos</h2><ul class="lista-links">' +
        (links.termos ? '<li><a href="' + esc(links.termos) + '" target="_blank" rel="noopener">Termos de uso<span class="sr"> (abre em nova aba)</span></a></li>' : "") +
        (links.privacidade ? '<li><a href="' + esc(links.privacidade) + '" target="_blank" rel="noopener">Política de privacidade<span class="sr"> (abre em nova aba)</span></a></li>' : "") + "</ul></div>" : "")
    );
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
  function linhaEstat(e) { return e.n + (e.n === 1 ? " partida" : " partidas") + " · " + e.v + "V " + e.d + "D · execução " + fmtExec(e.exec); }
  function relatoriosHtml(lista, nivel, dias) {
    if (!lista.length || nivel === "basico") return "";
    var html = '<h2 class="secao" id="t-rel">Evolução</h2><div class="cartao" aria-labelledby="t-rel" style="margin-top:8px"><p class="nota">Contagens do que você registrou; não indicam, sozinhas, a causa de uma melhora ou piora.</p>';
    if (nivel === "mensal") {
      var meses = {};
      lista.forEach(function (p) { var m = String(p.data).slice(0, 7); (meses[m] = meses[m] || []).push(p); });
      html += Object.keys(meses).sort().reverse().slice(0, 6).map(function (m) {
        var e = estatPartidas(meses[m]), dif = topAspectos(meses[m], "dificuldades", 2);
        return '<div class="rel-linha"><strong>' + esc(m.slice(5) + "/" + m.slice(0, 4)) + "</strong><span>" + esc(linhaEstat(e)) + (dif.length ? "<br>Dificuldades mais citadas: " + esc(dif.join(", ").toLowerCase()) : "") + "</span></div>";
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
        if (dif.length) html += '<h3 style="margin-top:14px">Dificuldades recorrentes</h3><p class="nota">' + esc(dif.join(", ")) + ".</p>";
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
        (r.execucaoMedia != null ? '<p class="nota" style="margin-top:6px">Execução média da estratégia: ' + String(r.execucaoMedia).replace(".", ",") + " de 5.</p>" : "") +
        ((r.dificuldadesFrequentes || []).length ? '<p class="nota" style="margin-top:6px">Dificuldades que mais aparecem: ' + esc(r.dificuldadesFrequentes.map(function (x) { return x.nome.toLowerCase(); }).join(", ")) + ".</p>" : "") + "</div>" +
        '<div id="relatorios">' + relatoriosHtml(lista, estado.dados.relatorios, relDias) + "</div>" +
        '<div class="cartao lista-estrategias" style="margin-top:14px">' + lista.map(function (p) {
          return '<a class="item-estrategia" href="#/partidas/' + esc(p.id) + '"><span class="tag' + (p.resultado === "vitoria" ? "" : " tag-adv") + '">' + esc(op.resultados[p.resultado] || "") + "</span> <strong>" + esc(p.adversario || "Sem adversário informado") + "</strong>" +
            '<span class="nota" style="display:block">' + esc(dataCurta(p.data)) + " · " + esc(op.tipos[p.tipo] || "") + (p.placar ? " · " + esc(p.placar) : "") + (p.planoTitulo ? " · " + esc(tituloCurto(p.planoTitulo)) : "") + "</span></a>";
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
    var planos = planosProntos();
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
        '<fieldset><legend>Quanto você conseguiu executar a estratégia? <span class="nota">(opcional)</span></legend>' + escala + "</fieldset>" : "") +
      '<details class="det" style="margin-bottom:16px"' + (ed && (ed.funcionou.length || ed.naoFuncionou.length || ed.dificuldades.length || ed.positivos.length || ed.obs) ? " open" : "") + '><summary>Avaliação detalhada (opcional)</summary><div style="margin-top:12px">' +
        grupo("funcionou", "O que funcionou") + grupo("naoFuncionou", "O que não funcionou") + grupo("dificuldades", "Principais dificuldades") + grupo("positivos", "Pontos positivos") +
        '<div class="campo"><label for="pObs">Observações adicionais</label><textarea id="pObs" maxlength="500">' + esc(p.obs || "") + "</textarea>" + botaoVoz("pObs") + "</div></div></details>" +
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
      box.innerHTML = '<div class="campo"><label for="pTorneio">Torneio <span class="nota">(opcional)</span></label><select id="pTorneio"><option value="">Nenhum</option>' + rt.torneios.map(function (t) { return '<option value="' + t.id + '"' + (t.id === torneioSel ? " selected" : "") + ">" + esc(t.nome) + "</option>"; }).join("") + "</select></div>" +
        '<div class="campo"><label for="pRodadaP">Rodada <span class="nota">(opcional)</span></label><input id="pRodadaP" maxlength="30" placeholder="Ex.: Oitavas" value="' + esc(rodadaSel) + '"></div>';
    }).catch(function () { estado.semTemporada = true; });
    function marcados(nome) { return Array.prototype.map.call(form.querySelectorAll('input[name="' + nome + '"]:checked'), function (i) { return i.value; }); }
    function unico(nome) { var m = marcados(nome); return m.length ? m[0] : ""; }
    form.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var erro = document.getElementById("pErro"), bt = document.getElementById("btSalvarPartida");
      var corpo = { acao: "salvarPartida", id: ed ? ed.id : novoId(), data: document.getElementById("pData").value, resultado: unico("resultado"), tipo: unico("tipo") || "treino", superficie: unico("superficie") || null,
        placar: document.getElementById("pPlacar").value, adversario: document.getElementById("pAdv").value, planoId: document.getElementById("pPlano") ? document.getElementById("pPlano").value || null : null,
        execucao: unico("execucao") ? parseInt(unico("execucao"), 10) : null, obs: document.getElementById("pObs").value,
        torneioId: (document.getElementById("pTorneio") ? document.getElementById("pTorneio").value : torneioSel) || null, rodada: document.getElementById("pRodadaP") ? document.getElementById("pRodadaP").value : rodadaSel };
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
  var CHAVE_PRESENCA = "presenca7dias.v1";
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
    return [tat, men];
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
      : '<h3>Desafios</h3><p class="prep-desc">Pratique com um objetivo.</p><p class="prep-info">Tático e mental</p><a class="btn btn-laranja" href="#/desafios">Ver desafios</a>';
    return '<div class="prep-grid"><section class="prep-card" aria-label="Aquecimento"><h3>Aquecimento</h3><p class="prep-desc">18 min para preparar o corpo.</p>' +
      '<p class="prep-info">Sem bola · Orientação por voz</p><a class="btn btn-laranja" href="' + hrefAquecimento(ctx) + '">Abrir aquecimento</a></section>' +
      '<section class="prep-card" aria-label="Desafios">' + cDes + "</section></div>";
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
  var AREAS_COMP = [["perfil", "Perfil de jogador"], ["temporada", "Temporada e torneios"], ["estrategias", "Estratégia por partida"], ["partidas", "Partidas"], ["treinos", "Treinos"], ["diario", "Diário pessoal (privado, só se você marcar)"]];
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
  function vinculoMeuHtml(v, comp) {
    var quem = v.pessoa ? esc(v.pessoa.nome) + (v.pessoa.email ? ' <span class="nota">(' + esc(v.pessoa.email) + ")</span>" : "") : "Ainda sem ninguém";
    var h = '<li class="comp-vinc"><p><strong>' + (v.tipo === "treinador" ? "Treinador" : "Responsável") + "</strong> · " + quem + '</p><p class="nota">' + esc(ROTULO_VINC[v.status] || v.status) + " · Compartilha: " + esc(rotuloAreas(v.areas)) + "</p>";
    if (v.status === "convite") {
      h += '<p class="comp-codigo" aria-label="Código do convite">' + esc(v.codigo) + '</p><p class="nota">Passe este código para a pessoa. Vale até ' + esc(dataISO(v.expiraEm)) + ".</p>" +
        '<div class="acoes"><button type="button" class="btn btn-secundario btn-pequeno" data-copiar="' + esc(v.codigo) + '">Copiar código</button><button type="button" class="btn btn-texto" data-rev="' + v.id + '">Cancelar convite</button></div>';
    } else if (v.status === "aguardando") {
      var soResp = v.tipo === "treinador" && comp.menor;
      h += soResp ? '<p class="nota">Como você é menor de idade, quem aprova o treinador é o seu responsável.</p>'
        : '<div class="acoes"><button type="button" class="btn btn-primario btn-pequeno" data-dec="' + v.id + '" data-ap="1">Aprovar</button><button type="button" class="btn btn-secundario btn-pequeno" data-dec="' + v.id + '" data-ap="0">Recusar</button></div>';
      h += '<div class="acoes"><button type="button" class="btn btn-texto" data-rev="' + v.id + '">Cancelar pedido</button></div>';
    } else if (v.status === "ativo") {
      h += '<details class="det"><summary>O que é compartilhado</summary><div style="margin-top:8px">' + areasMarcadas(v.areas, "ar-" + v.id) + '<button type="button" class="btn btn-secundario btn-pequeno" data-areas="' + v.id + '">Salvar</button></div></details>' +
        '<div class="acoes"><button type="button" class="btn btn-texto" data-rev="' + v.id + '">Encerrar vínculo</button></div>';
    }
    return h + "</li>";
  }
  function vinculoComigoHtml(v) {
    var h = '<li class="comp-vinc"><p><strong>' + esc(v.atleta.nome) + "</strong> · " + (v.tipo === "treinador" ? "como treinador" : "como responsável") + '</p><p class="nota">' + esc(ROTULO_VINC[v.status] || v.status) + (v.status === "ativo" ? " · Você vê: " + esc(rotuloAreas(v.areas)) : "") + "</p>";
    if (v.status === "ativo") h += '<div class="acoes"><a class="btn btn-primario btn-pequeno" href="#/competicao/vinculo/' + v.id + '">Ver atleta</a><button type="button" class="btn btn-texto" data-rev="' + v.id + '">Encerrar vínculo</button></div>';
    else if (v.status === "aguardando") h += '<p class="nota">O atleta' + (v.tipo === "treinador" ? " (ou o responsável dele, se for menor)" : "") + " precisa aprovar.</p>" + '<div class="acoes"><button type="button" class="btn btn-texto" data-rev="' + v.id + '">Cancelar pedido</button></div>';
    return h + "</li>";
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
        '<form id="fPapel" class="cartao" style="margin-top:16px" novalidate><h2>Qual é o seu papel?</h2>' +
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
      html += '<div id="hubProximo"></div><div class="cartao" style="margin-top:14px"><h2>Temporada</h2><p class="nota" style="margin-top:6px">Seus torneios, datas e prazos num só lugar.</p><div class="acoes"><a class="btn btn-laranja" href="#/temporada">Abrir a temporada</a><a class="btn btn-secundario" href="#/diario">Diário</a></div></div>' +
        '<div class="cartao" style="margin-top:14px"><h2>Evolução</h2><p class="nota" style="margin-top:6px">Devolutivas do treinador e o que levar do jogo para o treino.</p><div class="acoes"><a class="btn btn-secundario" href="#/devolutivas">Devolutivas</a><a class="btn btn-secundario" href="#/focos">Foco de treino</a></div></div>' +
        '<div class="cartao" style="margin-top:14px"><h2>Consultoria de competição</h2><p class="nota" style="margin-top:6px">Análise da sua temporada e de partidas com um treinador da Metodologia MTY.</p><div class="acoes"><a class="btn btn-secundario" href="/player/#/consultorias">Ver consultorias</a></div></div>';
      html += '<div class="cartao" style="margin-top:14px"><h2>Quem acompanha você</h2>' +
        (comp.menor && !ativosResp ? '<p class="nota" style="margin-top:6px">Como você é menor de idade, comece convidando o seu responsável. Só depois dele vinculado é possível convidar um treinador.</p>' : '<p class="nota" style="margin-top:6px">Você decide quem vê o quê, e pode encerrar qualquer vínculo quando quiser. O diário pessoal só é compartilhado se você marcar.</p>') +
        (s.meus.length ? '<ul class="comp-lista">' + s.meus.map(function (v) { return vinculoMeuHtml(v, comp); }).join("") + "</ul>" : '<p class="nota" style="margin-top:8px">Ninguém vinculado ainda.</p>') +
        '<details class="det" style="margin-top:10px"' + (s.meus.length ? "" : " open") + '><summary>Convidar alguém</summary><form id="fConvite" style="margin-top:10px" novalidate>' +
        '<div class="campo"><label for="tipoConv">Quem você quer convidar?</label><select id="tipoConv"><option value="responsavel">Responsável</option><option value="treinador">Treinador</option></select></div>' +
        '<p class="olho" style="margin-top:6px">O que essa pessoa pode ver</p>' + areasMarcadas(null, "ar-novo") +
        '<div class="aviso" id="avisoConv" role="alert" hidden></div><button class="btn btn-primario" type="submit">Gerar código de convite</button></form></details></div>';
    } else {
      var ativos = s.comigo.filter(function (v) { return v.status === "ativo"; });
      html += '<div class="cartao" style="margin-top:14px"><h2>Atletas que você acompanha</h2>' +
        (s.comigo.length ? '<ul class="comp-lista">' + s.comigo.map(vinculoComigoHtml).join("") + "</ul>" : '<p class="nota" style="margin-top:6px">Nenhum atleta ainda. O atleta gera um código de convite na conta dele e passa para você.</p>') +
        '<form id="fCodigo" style="margin-top:12px" novalidate><div class="campo"><label for="codigo">Código de convite</label><input id="codigo" maxlength="12" autocomplete="off" autocapitalize="characters" placeholder="Ex.: K7MQ4XD2"></div>' +
        '<div class="aviso" id="avisoCod" role="alert" hidden></div><button class="btn btn-primario" type="submit">Usar código</button></form></div>';
      if (s.paraDecidir && s.paraDecidir.length) {
        html += '<div class="cartao" style="margin-top:14px"><h2>Treinadores aguardando a sua aprovação</h2><ul class="comp-lista">' + s.paraDecidir.map(function (v) {
          return '<li class="comp-vinc"><p><strong>' + esc(v.pessoa ? v.pessoa.nome : "Treinador") + "</strong> quer acompanhar <strong>" + esc(v.atleta.nome) + '</strong></p><p class="nota">Compartilharia: ' + esc(rotuloAreas(v.areas)) + '</p>' +
            '<div class="acoes"><button type="button" class="btn btn-primario btn-pequeno" data-dec="' + v.id + '" data-ap="1">Aprovar</button><button type="button" class="btn btn-secundario btn-pequeno" data-dec="' + v.id + '" data-ap="0">Recusar</button></div></li>';
        }).join("") + "</ul></div>";
      }
    }
    html += '<p class="nota" style="margin-top:14px">Próximas etapas da Competição: devolutiva do treinador, “levar para o treino” e consultorias.</p>';
    tela(html);
    if (comp.papel === "atleta") {
      lembretesTemporada();
      api("player-torneios").then(function (rt) {
        var prox = rt.torneios.filter(function (t) { return t.fase !== "passado" && t.estado !== "desistiu"; })[0], box = document.getElementById("hubProximo");
        if (prox && box) box.innerHTML = heroTorneioHtml(prox);
      }).catch(function () { /* o resto da tela funciona sem a lista */ });
    }
    app.querySelectorAll("[data-copiar]").forEach(function (b) {
      b.addEventListener("click", function () { var c = b.getAttribute("data-copiar"); (navigator.clipboard ? navigator.clipboard.writeText(c) : Promise.reject()).then(function () { toast("Código copiado."); }, function () { toast("Copie manualmente: " + c); }); });
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
    if (fc) fc.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var av = document.getElementById("avisoConv"); av.hidden = true;
      var bt = fc.querySelector("button[type=submit]"); ocupado(bt, true, "Gerando…");
      try { await api("player-competicao", { metodo: "POST", corpo: { acao: "convidar", tipo: document.getElementById("tipoConv").value, areas: lerAreas("ar-novo") } }); await telaCompeticao(); }
      catch (e) { av.textContent = e.message; av.hidden = false; ocupado(bt, false); }
    });
    var fk = document.getElementById("fCodigo");
    if (fk) fk.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var av = document.getElementById("avisoCod"); av.hidden = true;
      var bt = fk.querySelector("button[type=submit]"); ocupado(bt, true, "Verificando…");
      try { var r = await api("player-competicao", { metodo: "POST", corpo: { acao: "aceitarCodigo", codigo: document.getElementById("codigo").value } }); toast("Pedido enviado a " + r.atleta + ". Falta a aprovação."); await telaCompeticao(); }
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
      '<p class="nota">' + esc(periodoTorneio(t)) + (t.cidade ? " · " + esc(t.cidade) : "") + (t.categoria ? " · " + esc(t.categoria) : "") + "</p>" + prazoTorneioHtml(t) + "</div></a>";
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
        categoria: v("tCategoria"), circuito: v("tCircuito"), superficie: v("tPiso"), estado: v("tEstado"), urlOrigem: v("tUrl"), observacao: v("tObs"),
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
          (p.prioridades && p.prioridades.length ? '<ol class="comp-prior">' + p.prioridades.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol>" : "") + "</a>";
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
    var planos = planosProntos();
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
      }).join("") + "</select></div>" : '<p class="nota" style="margin-bottom:10px">Crie uma <a href="#/estrategia">estratégia</a> para poder usá-la como apoio na partida.</p>') +
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
    try { r = await api("player-torneios"); }
    catch (e) { tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/competicao">‹ Início</a></p><div class="aviso">' + esc(e.message) + "</div>"); return; }
    var q = (location.hash.split("?")[1] || "").match(/(?:^|&)torneio=([^&]+)/), sel = q ? decodeURIComponent(q[1]) : "", nomes = {};
    r.torneios.forEach(function (t) { nomes[t.id] = t.nome; });
    var HUMOR = ["", "Muito mal", "Mal", "Neutro", "Bem", "Muito bem"];
    tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/competicao">‹ Início</a></p><h1>Diário de competição</h1><p class="sub">Registre como você se sentiu e o que aprendeu. É privado: treinador e responsável só leem se você marcar o diário no vínculo.</p>' +
      '<form id="fDiario" class="cartao" style="margin-top:14px" novalidate><h2 id="tDiario">Novo registro</h2>' +
      '<div class="comp-duas">' + campoTorneio("dData", "Data", hojeISOLocal(), "date", ' max="' + hojeISOLocal() + '"') +
      '<div class="campo"><label for="dTorneio">Torneio</label><select id="dTorneio"><option value="">Nenhum</option>' + r.torneios.map(function (t) { return '<option value="' + t.id + '"' + (t.id === sel ? " selected" : "") + ">" + esc(t.nome) + "</option>"; }).join("") + "</select></div></div>" +
      '<div class="campo"><label for="dTexto">O que você quer registrar?</label><textarea id="dTexto" rows="4" maxlength="1000"></textarea>' + botaoVoz("dTexto") + "</div>" +
      '<fieldset><legend>Como você se sentiu? <span class="nota">(opcional)</span></legend><div class="escala">' + [1, 2, 3, 4, 5].map(function (n) { return '<label class="opcao"><input type="radio" name="humor" value="' + n + '"><span>' + n + "<small>" + HUMOR[n] + "</small></span></label>"; }).join("") + "</div></fieldset>" +
      '<div class="aviso" id="avisoD" role="alert" hidden></div><button class="btn btn-primario" type="submit" id="btSalvarD">Salvar registro</button><button class="btn btn-texto" type="button" id="btCancelarD" hidden>Cancelar edição</button></form>' +
      (r.diario.length ? '<h2 class="secao">Registros</h2><div class="comp-torneios">' + r.diario.map(function (d) {
        return '<div class="comp-vinc"><p class="olho">' + dataCurta(d.data) + (d.torneioId && nomes[d.torneioId] ? " · " + esc(nomes[d.torneioId]) : "") + (d.humor ? " · " + HUMOR[d.humor] : "") + "</p><p>" + esc(d.texto) + '</p><div class="acoes"><button type="button" class="btn btn-secundario btn-pequeno" data-ed="' + d.id + '">Editar</button><button type="button" class="btn btn-texto" data-ex="' + d.id + '">Excluir</button></div></div>';
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
            '<div class="acoes"><a class="btn btn-secundario btn-pequeno" href="/player/#/jogadas">Jogadas e exercícios</a><a class="btn btn-secundario btn-pequeno" href="#/desafios">Desafios</a><button type="button" class="btn btn-texto" data-excluir-foco="' + f.id + '">Excluir</button></div></div>';
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
  async function telaVinculo(id) {
    tela('<p class="carregando">Carregando…</p>', true);
    var r;
    try { r = await api("player-competicao?ver=" + encodeURIComponent(id)); }
    catch (e) { tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/competicao">‹ Início</a></p><div class="aviso">' + esc(e.message) + "</div>"); return; }
    var perfil = r.dados.perfil;
    tela('<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/competicao">‹ Início</a></p><h1>' + esc(r.atleta.nome) + '</h1><p class="sub">Você vê só o que o atleta compartilhou: ' + esc(rotuloAreas(r.areas)) + ".</p>" +
      (perfil ? '<div class="cartao" style="margin-top:14px"><h2>Perfil de jogador</h2>' + (perfil.length ? '<dl class="comp-perfil">' + perfil.map(function (p) { return "<dt>" + esc(p.rotulo) + "</dt><dd>" + esc(p.valor) + "</dd>"; }).join("") + "</dl>" : '<p class="nota" style="margin-top:6px">O atleta ainda não preencheu o perfil.</p>') + "</div>" : "") +
      (r.dados.torneios ? '<div class="cartao" style="margin-top:14px"><h2>Temporada e torneios</h2>' + (r.dados.torneios.length ? '<div class="comp-torneios">' + r.dados.torneios.map(function (t) { return '<div class="comp-vinc"><p class="olho">' + esc(rotuloEstadoTorneio(t.estado)) + " · " + esc(quandoTorneio(t)) + "</p><p><strong>" + esc(t.nome) + '</strong></p><p class="nota">' + esc(periodoTorneio(t)) + (t.cidade ? " · " + esc(t.cidade) : "") + (t.categoria ? " · " + esc(t.categoria) : "") + "</p>" + prazoTorneioHtml(t) + "</div>"; }).join("") + "</div>" : '<p class="nota" style="margin-top:6px">Nenhum torneio cadastrado ainda.</p>') + "</div>" : "") +
      (r.dados.preparos ? '<div class="cartao" style="margin-top:14px"><h2>Estratégia por partida</h2>' + (r.dados.preparos.length ? '<div class="comp-torneios">' + r.dados.preparos.map(function (p) { return '<div class="comp-vinc"><p class="olho">' + esc(p.rodada || "Partida") + (p.data ? " · " + dataCurta(p.data) : "") + "</p><p><strong>" + (p.adversario ? "Contra " + esc(p.adversario) : "Preparação") + "</strong></p>" + (p.prioridades && p.prioridades.length ? '<ol class="comp-prior">' + p.prioridades.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol>" : "") + (p.padrao ? '<p class="nota">Padrão: ' + esc(p.padrao) + "</p>" : "") + (p.hipoteses ? '<p class="nota">Expectativa: ' + esc(p.hipoteses) + "</p>" : "") + "</div>"; }).join("") + "</div>" : '<p class="nota" style="margin-top:6px">Nenhuma preparação ainda.</p>') + "</div>" : "") +
      (r.dados.partidas ? '<div class="cartao" style="margin-top:14px"><h2>Partidas</h2>' + (r.dados.partidas.length ? '<div class="comp-torneios">' + r.dados.partidas.map(function (p) { return '<div class="comp-vinc"><p class="olho">' + (p.resultado === "vitoria" ? "Vitória" : "Derrota") + (p.rodada ? " · " + esc(p.rodada) : "") + " · " + dataCurta(p.data) + "</p><p><strong>" + (p.adversario ? "Contra " + esc(p.adversario) : "Partida") + '</strong></p><p class="nota">' + esc(p.placar) + "</p></div>"; }).join("") + "</div>" : '<p class="nota" style="margin-top:6px">Nenhuma partida registrada.</p>') + "</div>" : "") +
      (r.dados.diario ? '<div class="cartao" style="margin-top:14px"><h2>Diário</h2>' + (r.dados.diario.length ? '<div class="comp-torneios">' + r.dados.diario.map(function (d) { return '<div class="comp-vinc"><p class="olho">' + dataCurta(d.data) + "</p><p>" + esc(d.texto) + "</p></div>"; }).join("") + "</div>" : '<p class="nota" style="margin-top:6px">Sem registros.</p>') + "</div>" : "") +
      (r.dados.focos ? '<div class="cartao" style="margin-top:14px"><h2>Foco de treino</h2>' + (r.dados.focos.length ? '<ul class="comp-lista">' + r.dados.focos.map(function (f) { return '<li class="comp-vinc"><p><strong>' + esc(f.texto) + '</strong></p><p class="nota">' + esc(STATUS_FOCO_ROT[f.status] || f.status) + " · " + esc(f.origemRotulo || "") + "</p></li>"; }).join("") + "</ul>" : '<p class="nota" style="margin-top:6px">Nenhum foco ainda.</p>') + "</div>" : "") +
      (r.referencias ? '<div class="cartao" style="margin-top:14px"><h2>Escrever devolutiva</h2><form id="fDev" novalidate style="margin-top:8px"><div class="campo"><label for="devRef">Sobre</label><select id="devRef"><option value="geral:">Geral</option>' +
        r.referencias.torneios.map(function (t) { return '<option value="torneio:' + t.id + '">Torneio: ' + esc(t.rotulo) + "</option>"; }).join("") + r.referencias.partidas.map(function (p) { return '<option value="partida:' + p.id + '">Partida: ' + esc(p.rotulo) + "</option>"; }).join("") + "</select></div>" +
        '<div class="campo"><label for="devBem">O que foi bem</label><textarea id="devBem" rows="3" maxlength="600"></textarea></div><div class="campo"><label for="devMelhor">O que melhorar</label><textarea id="devMelhor" rows="3" maxlength="600"></textarea></div>' +
        '<div class="campo"><label for="devFoco">Foco de treino sugerido (opcional)</label><input id="devFoco" maxlength="200" placeholder="Ex.: primeiro saque em 65%"></div><div class="aviso" id="avisoDev" role="alert" hidden></div><button class="btn btn-primario" type="submit">Enviar devolutiva</button></form></div>' : "") +
      (r.devolutivas && r.devolutivas.length ? '<h2 class="secao">' + (r.referencias ? "Suas devolutivas" : "Devolutivas do treinador") + "</h2>" + r.devolutivas.map(function (d) { return devolutivaHtml(d, r.referencias ? '<div class="acoes"><button type="button" class="btn btn-texto" data-exdev="' + d.id + '">Excluir</button></div>' : ""); }).join("") : "") +
      (r.emBreve && r.emBreve.length ? '<p class="nota" style="margin-top:14px">Compartilhado e ainda sem conteúdo nesta etapa: ' + esc(rotuloAreas(r.emBreve)) + ". Essas áreas aparecem aqui quando chegarem as próximas etapas.</p>" : ""));
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
  async function rotear() {
    var logado = auth && auth.currentUser;
    var h = location.hash.replace(/^#\/?/, "");
    var partes = h.split("?")[0].split("/"); // o que vier depois de "?" (ex.: retorno do pagamento) nunca muda nada: só o servidor libera acesso
    atualizarCasca(!!logado, partes[0]);
    document.body.classList.remove("teclado", "acesso");
    var t = document.getElementById("toast"); if (t && Date.now() - toastEm > 1200) t.hidden = true; // um aviso criado junto com a navegação (ex.: "perfil salvo") continua visível
    /* visitante sem rota: página pública de apresentação; #/entrar e #/criar (e qualquer link direto) seguem para o cadastro/entrada */
    if (!MODO_COMP && ROTAS_COMP[partes[0]]) { location.replace("/competicao/" + location.hash); return; }
    if (MODO_COMP && logado && !ROTAS_APP_COMP[partes[0]]) { location.replace("/player/" + location.hash); return; }
    var LAND = MODO_COMP ? window.QL_COMP_LANDING : window.QL_LANDING;
    var visitanteNaHome = !logado && !partes[0] && LAND;
    document.body.classList.toggle("landing", !!visitanteNaHome);
    if (visitanteNaHome) { tela(LAND.html()); LAND.ligar(app); return; }
    if (!logado) { telaEntrar(ROTAS_ACESSO[partes[0]] ? partes[0] : "criar"); return; }
    if (!estado.dados) {
      tela('<p class="carregando">Carregando seus dados…</p>', true);
      try { await carregarDados(); aplicarRascunho(); carregarAssinatura(false).catch(function () { /* o resto do app funciona sem a área comercial */ }); }
      catch (e) {
        tela('<div class="pilha"><div class="aviso">' + esc(e.message) + '</div><div class="acoes"><button class="btn btn-primario" id="btTentar" type="button">Tentar de novo</button></div></div>');
        document.getElementById("btTentar").addEventListener("click", rotear);
        return;
      }
    }
    var r = partes[0];
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
    else if (r === "aquecimento") telaAquecimento();
    else if (r === "desafios") telaDesafios();
    else if (r === "desafio") { if (partes[1]) telaDesafioDia(partes[1]); else telaDesafio(); }
    else if (r === "partidas") { if (partes[1] === "nova") telaPartidaForm(null); else if (partes[1]) telaPartidaForm(partes[1]); else telaPartidas(); }
    else if (r === "temporada") { if (partes[1] === "novo" || partes[2] === "editar") telaTorneioForm(partes[1]); else if (partes[1]) telaTorneio(partes[1]); else telaTemporada(); }
    else if (r === "preparo" && partes[1] && partes[2]) telaPreparo(partes[1], partes[2]);
    else if (r === "diario") telaDiario();
    else if (r === "devolutivas") telaDevolutivas();
    else if (r === "focos") telaFocos();
    else if (r === "competicao" || (MODO_COMP && (r === "inicio" || r === ""))) { if (partes[1] === "vinculo" && partes[2]) telaVinculo(partes[2]); else telaCompeticao(); }
    else if (r === "conta") telaConta();
    else if (r === "jogador") telaJogador();
    else if (r === "assinatura") telaAssinatura();
    else if (r === "assinaturas") telaAssinaturas();
    else if (r === "consultorias") { if (partes[1] && partes[2] === "solicitar") telaSolicitacao(partes[1]); else if (partes[1]) telaConsultoriaDetalhe(partes[1]); else telaConsultorias(); }
    else if (r === "ajuda") telaAjuda();
    else telaInicio();
  }

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
