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
    app.innerHTML = html;
    document.body.classList.remove("teclado"); // o campo que estava em foco pode ter sumido com a tela anterior
    var y = 0;
    if (!provisoria && voltando) { y = posicoes[location.hash] || 0; voltando = false; }
    window.scrollTo(0, y);
    app.focus({ preventScroll: true });
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
  function telaEntrar(modo) {
    modo = modo || "criar";
    var criar = modo === "criar";
    tela(
      '<div class="pilha">' +
        '<div><p class="olho">Estratégia de jogo para o tênis</p>' +
        "<h1>Descubra como jogar melhor com o jogo que você já tem.</h1>" +
        '<p class="sub">Responda um perfil rápido sobre o seu jogo e receba uma estratégia com a Metodologia MTY e a tecnologia QuadraLab. <strong>A primeira estratégia é grátis.</strong></p></div>' +
        '<div class="cartao">' +
          '<div class="abas" role="tablist" aria-label="Acesso">' +
            '<button type="button" role="tab" aria-selected="' + criar + '" data-modo="criar">Criar conta</button>' +
            '<button type="button" role="tab" aria-selected="' + !criar + '" data-modo="entrar">Entrar</button>' +
          "</div>" +
          '<form id="fAcesso" novalidate>' +
            '<div class="aviso" id="aviso" role="alert" hidden></div>' +
            (criar ? '<div class="campo"><label for="nome">Nome</label><input id="nome" autocomplete="name" maxlength="80" required></div>' : "") +
            '<div class="campo"><label for="email">E-mail</label><input id="email" type="email" inputmode="email" autocomplete="email" required></div>' +
            '<div class="campo"><label for="senha">Senha</label><input id="senha" type="password" autocomplete="' + (criar ? "new-password" : "current-password") + '" minlength="8" required>' +
              (criar ? '<p class="nota" style="margin-top:6px">Pelo menos 8 caracteres.</p>' : "") + "</div>" +
            '<button class="btn btn-primario largo" id="btAcesso" type="submit">' + (criar ? "Criar conta e começar" : "Entrar") + "</button>" +
            (criar ? "" : '<p style="text-align:center;margin-top:8px"><button type="button" class="btn btn-texto" id="btEsqueci">Esqueci minha senha</button></p>') +
          "</form>" +
        "</div>" +
      "</div>"
    );
    app.querySelectorAll("[data-modo]").forEach(function (b) {
      b.addEventListener("click", function () { telaEntrar(b.dataset.modo); });
    });
    var aviso = document.getElementById("aviso");
    function avisar(t, info) { aviso.textContent = t; aviso.className = info ? "aviso-info" : "aviso"; aviso.hidden = false; }
    var btEsq = document.getElementById("btEsqueci");
    if (btEsq) btEsq.addEventListener("click", async function () {
      var email = document.getElementById("email").value.trim();
      if (!email) { avisar("Digite seu e-mail acima e toque de novo em \"Esqueci minha senha\"."); return; }
      try { await auth.sendPasswordResetEmail(email); } catch (e) { /* não revela se o e-mail existe */ }
      avisar("Se houver uma conta com esse e-mail, você vai receber um link para criar uma nova senha.", true);
    });
    document.getElementById("fAcesso").addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var bt = document.getElementById("btAcesso");
      if (bt.disabled) return;
      aviso.hidden = true;
      var email = document.getElementById("email").value.trim();
      var senha = document.getElementById("senha").value;
      var nome = criar ? document.getElementById("nome").value.trim() : "";
      if ((criar && !nome) || !email || senha.length < (criar ? 8 : 1)) {
        avisar(criar ? "Preencha nome, e-mail e uma senha com pelo menos 8 caracteres." : "Preencha e-mail e senha.");
        return;
      }
      ocupado(bt, true, criar ? "Criando sua conta…" : "Entrando…");
      try {
        if (criar) await api("player-conta", { metodo: "POST", corpo: { nome: nome, email: email, senha: senha } });
        await auth.signInWithEmailAndPassword(email, senha);
        /* onAuthStateChanged segue daqui */
      } catch (e) {
        var cod = e && e.code || "";
        avisar(/invalid-credential|wrong-password|user-not-found|invalid-login/.test(cod)
          ? "E-mail ou senha incorretos."
          : /too-many-requests/.test(cod) ? "Muitas tentativas. Aguarde alguns minutos e tente de novo."
          : (e.message || "Não foi possível continuar agora."));
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
    html += (sub ? '<p class="sub">' + esc(sub) + "</p>" : "") + '<div style="margin-top:14px">' + destaque + "</div>";
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
      '<div style="margin-top:14px">' + cartaoPersonalizarHtml(p) + "</div>" +
      '<div style="margin-top:14px">' + treinos + "</div>" +
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
        '<div class="campo"><label for="detalhe">' + (l.opcoes.length ? "Quer explicar melhor? <span class=\"nota\">(opcional)</span>" : "Sua resposta") + '</label><textarea id="detalhe" maxlength="400" rows="2">' + esc(detalhe) + "</textarea></div>" +
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
        '<textarea id="obs" maxlength="500" placeholder="Ex.: erro muito a esquerda em bola alta">' + esc(f.observacoes) + "</textarea></div>";
    } else {
      corpo = '<p class="nota" style="margin-bottom:14px">Se você tem um adversário que enfrenta com frequência, descreva-o e a estratégia será montada para esse confronto. Sem adversário, a estratégia é geral para o seu jogo.</p>' +
        '<label class="alternar"><input type="checkbox" id="advAtivo"' + (a.ativo ? " checked" : "") + "><span>Quero uma estratégia contra um adversário específico</span></label>" +
        '<div id="advCampos" style="margin-top:18px"' + (a.ativo ? "" : " hidden") + ">" +
          '<div class="campo"><label for="advNome">Nome ou apelido do adversário</label><input id="advNome" maxlength="60" value="' + esc(a.nome) + '"></div>' +
          grupo("advEstilo", "Estilo dele", OP.advEstilo) + grupo("advMao", "Mão dele", OP.advMao) +
          grupo("advFortes", "Pontos fortes dele", AREAS, "Marque quantos quiser.", "checkbox") +
          grupo("advFracos", "Pontos fracos dele", AREAS, "Marque quantos quiser.", "checkbox") +
          '<div class="campo"><label for="advObs">O que mais você já percebeu no jogo dele? <span class="nota">(opcional)</span></label>' +
          '<textarea id="advObs" maxlength="500">' + esc(a.observacoes) + "</textarea></div>" +
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
      if (n === 3) f.observacoes = document.getElementById("obs").value.trim();
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
    var html = "<h1>Treinos</h1><p class=\"sub\">Organize e registre a prática das suas jogadas.</p>";
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
    ficha: "jogador", jogador: "jogador", conta: "conta", assinatura: "assinatura", assinaturas: "assinatura", consultorias: "consultorias", ajuda: "ajuda",
    estrategia: "estrategia", plano: "estrategia", planos: "estrategia", completar: "estrategia", gerando: "estrategia",
    jogadas: "jogadas", planejar: "treinos", treinos: "treinos", treino: "treinos", programa: "treinos", planejamento: "treinos", gerandoPlanej: "treinos",
  };
  var NAV_MAIS = { conta: 1, jogador: 1, ficha: 1, assinatura: 1, consultorias: 1, ajuda: 1 };
  function atualizarCasca(logado, rota) {
    document.body.classList.toggle("logado", logado);
    lateral.hidden = !logado;
    navInf.hidden = !logado;
    document.querySelectorAll(".js-abrir-conta").forEach(function (b) { b.hidden = !logado; });
    var ativo = NAV_DA_ROTA[rota] || "inicio";
    document.querySelectorAll("[data-nav]").forEach(function (el) {
      var vale = el.id === "btMais" ? !!NAV_MAIS[rota] : el.getAttribute("data-nav") === ativo;
      if (vale && logado) el.setAttribute("aria-current", "page"); else el.removeAttribute("aria-current");
    });
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
    document.querySelectorAll("[data-conta-ass]").forEach(function (el) { el.textContent = rotuloAss; });
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
    var alvo = el.querySelector(".painel-fechar") || el.querySelector("a, button");
    if (alvo) alvo.focus();
  }
  function fecharPainel(devolverFoco) {
    if (!painelAberto) return;
    painelAberto.hidden = true; painelFundo.hidden = true;
    document.documentElement.classList.remove("sem-rolagem");
    document.querySelectorAll(".js-abrir-conta, #btMais").forEach(function (b) { b.setAttribute("aria-expanded", "false"); });
    var g = gatilhoPainel; painelAberto = null; gatilhoPainel = null;
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
    );
    atualizarConta();
    var aviso = document.getElementById("avisoConta");
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
    if (a.estado === "gratuito") return "Sem cobrança. Você tem a primeira estratégia grátis.";
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
      '<h2 class="secao" id="t-uso">Consumo</h2><div class="cartao" aria-labelledby="t-uso" style="margin-top:8px">' + usoHtml(a) + "</div>" +
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
  async function rotear() {
    var logado = auth && auth.currentUser;
    var h = location.hash.replace(/^#\/?/, "");
    var partes = h.split("?")[0].split("/"); // o que vier depois de "?" (ex.: retorno do pagamento) nunca muda nada: só o servidor libera acesso
    atualizarCasca(!!logado, partes[0]);
    document.body.classList.remove("teclado");
    var t = document.getElementById("toast"); if (t && Date.now() - toastEm > 1200) t.hidden = true; // um aviso criado junto com a navegação (ex.: "perfil salvo") continua visível
    /* visitante sem rota: página pública de apresentação; #/entrar e #/criar (e qualquer link direto) seguem para o cadastro/entrada */
    var visitanteNaHome = !logado && !partes[0] && window.QL_LANDING;
    document.body.classList.toggle("landing", !!visitanteNaHome);
    if (visitanteNaHome) { tela(window.QL_LANDING.html()); window.QL_LANDING.ligar(app); return; }
    if (!logado) { telaEntrar(partes[0] === "entrar" ? "entrar" : "criar"); return; }
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
    if (u && (!h || h === "#/entrar" || h === "#/")) { location.hash = "#/inicio"; return; }
    pilha = [location.hash];
    rotear();
  });
})();
