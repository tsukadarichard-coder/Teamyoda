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
    var y = 0;
    if (!provisoria && voltando) { y = posicoes[location.hash] || 0; voltando = false; }
    window.scrollTo(0, y);
    app.focus({ preventScroll: true });
  }
  /* aviso rápido sobre a última ação; só é mostrado depois de o servidor confirmar (ou para dizer que falhou) */
  var toastTempo = null;
  function toast(texto, desfazer, erro) {
    var t = document.getElementById("toast");
    clearTimeout(toastTempo);
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
    return '<a class="item-estrategia" href="#/estrategia/' + esc(p.id) + '" title="' + esc(p.plano.titulo) + '"><span class="ie-corpo"><strong class="ie-titulo">' + esc(tituloCurto(p.plano.titulo)) + "</strong>" +
      '<span class="ie-meta"><span class="tag' + (p.adversarioNome ? " tag-adv" : "") + '">' + tipoEstrategia(p) + "</span>" +
      (p.adversarioNome ? " <strong>" + esc(p.adversarioNome) + "</strong> ·" : "") + " " + esc(dataBR(p.criadoEm)) + '</span></span><span class="seta" aria-hidden="true">›</span></a>';
  }
  function textoCota() {
    var d = estado.dados;
    if (d.full) return "Acesso completo de teste: sem limite de estratégias.";
    if (d.gratisRestantes) return "Sua primeira estratégia é grátis.";
    if (d.creditos) return "Você tem " + d.creditos + (d.creditos === 1 ? " crédito" : " créditos") + " para novas estratégias.";
    return "Você já usou a sua estratégia grátis. A compra de novas estratégias chega em breve aqui no app.";
  }
  function ligarGerar() {
    app.querySelectorAll("[data-gerar]").forEach(function (b) { b.addEventListener("click", function () { gerarPlano(b); }); });
  }

  /* ══ Início ════════════════════════════════════════════════════════ */
  function telaInicio() {
    var d = estado.dados;
    var primeiroNome = (d.perfil.nome || "").split(" ")[0];
    var prontos = planosProntos(), estrategia = prontos[0];
    var gerando = (d.planos || []).filter(function (p) { return p.status === "gerando"; })[0];
    var programas = planejamentosProntos();
    var sel = escolherProximoTreino();
    var html = "<h1>Olá" + (primeiroNome ? ", " + esc(primeiroNome) : "") + "</h1>", destaque = "", sub = "";

    if (!d.fichaCompleta) {
      sub = "Vamos começar pelo seu perfil.";
      destaque = '<div class="cartao destaque"><p class="olho">Primeiro passo</p><h2>Conte como você joga</h2><p class="nota" style="margin-top:6px">São 4 etapas rápidas, quase tudo de tocar e escolher. Seu progresso fica salvo.</p>' +
        '<a class="btn btn-primario btn-grande" href="#/ficha/1">' + (d.ficha && Object.keys(d.ficha).some(function (k) { return d.ficha[k] && k !== "adversario"; }) ? "Continuar meu perfil" : "Completar meu perfil") + "</a></div>";
    } else if (!estrategia) {
      sub = "Seu perfil está completo.";
      destaque = '<div class="cartao destaque"><p class="olho">Próximo passo</p><h2>Crie a sua estratégia</h2><p class="nota" style="margin-top:6px">Com o seu perfil, montamos como jogar: as prioridades e as jogadas para aplicar.</p>' +
        (gerando ? '<a class="btn btn-primario btn-grande" href="#/gerando/' + esc(gerando.id) + '">Acompanhar minha estratégia</a>'
          : d.podeGerar ? '<button class="btn btn-primario btn-grande" data-gerar type="button">Criar minha estratégia</button>'
          : '<a class="btn btn-primario btn-grande" href="#/estrategia">Ver estratégias</a><p class="nota" style="margin-top:10px">' + esc(textoCota()) + "</p>") + "</div>";
    } else if (!programas.length) {
      sub = "Sua estratégia está pronta. Falta organizar a prática.";
      destaque = '<div class="cartao destaque"><p class="olho">Próximo passo</p><h2>Organize seus treinos</h2><p class="nota" style="margin-top:6px">Escolha as jogadas que quer praticar e monte um programa de treino nos dias que cabem na sua rotina.</p>' +
        '<a class="btn btn-primario btn-grande" href="' + (recursos().planejamento ? "#/planejar/" + esc(estrategia.id) : "#/treinos") + '">Organizar meus treinos</a></div>';
    } else if (sel) {
      sub = sel.tipo === "andamento" ? "Você começou um treino. Falta terminar." : sel.tipo === "hoje" ? "Hoje tem treino." : "Seu programa de treino está em dia.";
      destaque = cartaoTreinoHtml(sel);
    } else {
      sub = "Você concluiu o seu programa de treino.";
      destaque = '<div class="cartao destaque"><p class="olho">Programa concluído</p><h2>Hora de organizar os próximos treinos</h2><p class="nota" style="margin-top:6px">Veja como foi em Treinos ou monte um novo programa.</p>' +
        '<a class="btn btn-primario btn-grande" href="#/planejar/' + esc(estrategia.id) + '">Organizar novos treinos</a><p style="margin-top:8px"><a class="btn btn-texto" href="#/treinos">Ver histórico</a></p></div>';
    }
    html += (sub ? '<p class="sub">' + esc(sub) + "</p>" : "") + '<div style="margin-top:16px">' + destaque + "</div>";

    /* "Qual é minha estratégia, quais jogadas vou praticar e qual é meu próximo treino?" */
    if (estrategia) {
      var marcadas = (estrategia.escolhidas || []).length;
      var pjAtivo = programaAtivo() || programas[0];
      var prog = pjAtivo ? andamentoPrograma(pjAtivo) : null;
      html += '<div class="indicadores">' +
        '<a class="indicador" href="#/estrategia/' + esc(estrategia.id) + '"><span class="ind-rotulo">Sua estratégia</span><strong>' + esc(nomeEstrategia(estrategia)) + '</strong><span class="ind-nota">' + tipoEstrategia(estrategia) + (estrategia.adversarioNome ? " · " + esc(estrategia.adversarioNome) : "") + "</span></a>" +
        '<a class="indicador" href="#/jogadas/' + esc(estrategia.id) + '"><span class="ind-rotulo">Jogadas para praticar</span><strong>' + (marcadas ? marcadas + (marcadas === 1 ? " selecionada" : " selecionadas") : "Nenhuma selecionada") + '</strong><span class="ind-nota">' + ((estrategia.plano.jogadas || []).length) + " disponíveis</span></a>" +
        '<a class="indicador" href="#/treinos"><span class="ind-rotulo">Treinos</span><strong>' + (prog ? prog.concluidos + " de " + prog.total + " feitos" : "Sem programa") + '</strong><span class="ind-nota">' + (prog ? esc(tituloCurto(pjAtivo.titulo, 34)) : "Organize seus treinos") + "</span></a></div>";
    }
    html += '<p class="nota rodape-inicio">Conectado como ' + esc(d.perfil.email) + (d.full ? " · acesso completo de teste" : "") + "</p>";
    tela(html);
    ligarGerar();
  }

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
        html += '<p class="nota" style="margin-top:14px">' + esc(textoCota()) + ' <a href="#/ficha/1">Atualizar perfil</a></p>';
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
        "<p>O Richard Tsukada pode revisar a sua estratégia, analisar um vídeo do seu jogo ou conversar com você ao vivo.</p>" +
        '<a class="btn largo" href="https://wa.me/' + WHATSAPP_CONSULTORIA + "?text=" + encodeURIComponent(msgWpp) + '" target="_blank" rel="noopener">Falar sobre a consultoria<span class="sr"> (abre o WhatsApp)</span></a></div>'
    );
    ligarGerar();
  }
  function blocoOutraEstrategia() {
    var d = estado.dados;
    if (d.podeGerar) {
      return '<p class="nota" style="margin:8px 0 0">' + esc(textoCota()) + " A nova estratégia usa o seu perfil atual e as informações que você respondeu; a atual continua salva. Se o seu jogo mudou, ou é contra outro adversário, revise o perfil antes.</p>" +
        '<div class="acoes"><button class="btn btn-primario" data-gerar type="button">Criar nova estratégia com o perfil atual</button><a class="btn btn-secundario" href="#/ficha/1">Revisar perfil e criar</a></div>';
    }
    return '<p class="nota" style="margin:8px 0 0">' + esc(textoCota()) + "</p>";
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
    var podeGerar = estado.dados.podeGerar;
    tela(
      '<div class="progresso"><div class="barra" role="progressbar" aria-valuemin="1" aria-valuemax="' + ETAPAS.length + '" aria-valuenow="' + n + '" aria-label="Etapa ' + n + " de " + ETAPAS.length + '"><i style="width:' + (n / ETAPAS.length * 100) + '%"></i></div><span>Etapa ' + n + " de " + ETAPAS.length + "</span></div>" +
      '<p class="olho">Meu perfil</p><h1 style="margin-bottom:18px">' + esc(ETAPAS[n - 1].titulo) + "</h1>" +
      '<form id="fFicha" novalidate>' + corpo +
        '<div class="aviso" id="aviso" role="alert" hidden></div>' +
        '<p class="nota rascunho-nota" id="rascunhoNota">Suas respostas ficam salvas neste aparelho enquanto você preenche.</p>' +
        '<div class="acoes lado">' +
          '<button class="btn btn-primario" id="btAvancar" type="submit">' + (ultima ? (podeGerar ? "Salvar e criar minha estratégia" : "Salvar perfil") : "Continuar") + "</button>" +
          '<button class="btn btn-secundario" id="btVoltar" type="button">' + (n === 1 ? "Voltar ao início" : "Voltar") + "</button>" +
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
        if (p.status === "erro") { await carregarDados(); telaErroPlano(p.erro); return; }
      } catch (e) { /* ainda não existe ou rede oscilou: tenta de novo */ }
      if (Date.now() - inicio > 4 * 60 * 1000) {
        telaErroPlano("A estratégia está demorando mais que o normal. Volte ao início em alguns minutos: ela aparece na sua lista quando ficar pronta.");
        return;
      }
      consulta = setTimeout(verificar, 3000);
    }
    consulta = setTimeout(verificar, 2500);
  }
  function telaErroPlano(msg) {
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
      '<strong class="ip-titulo">' + esc(tituloCurto(pj.titulo, 44)) + "</strong>" +
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
      var msg = "Olá, Richard! Quero saber sobre o Plano 1 (programa de treino) do QuadraLab Player.";
      html += '<div class="cartao bloqueado" style="margin-top:18px"><p class="olho">Plano 1</p><h2>Programa de treino</h2>' +
        '<p class="nota" style="margin-top:6px">Semanas de treino com os dias e a duração que cabem na sua rotina, e os exercícios de cada treino.</p>' +
        '<div class="acoes"><a class="btn btn-secundario" href="https://wa.me/' + WHATSAPP_CONSULTORIA + "?text=" + encodeURIComponent(msg) + '" target="_blank" rel="noopener">Quero o Plano 1<span class="sr"> (abre o WhatsApp)</span></a></div></div>';
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

  function telaPlanejar(planoId) {
    var plano = planoPorId(planoId);
    if (!plano || plano.status !== "pronto" || !recursos().planejamento) { ir("#/treinos"); return; }
    var marcadas = (plano.escolhidas || []).map(function (n) { return plano.plano.jogadas[n] ? tituloCurto(plano.plano.jogadas[n].titulo, 38) : null; }).filter(Boolean);
    var f = estado.formPlanej = estado.formPlanej || { semanas: "4", dias: ["ter", "qui", "sab"], minutos: "60", apoio: "", inicio: proximaSegunda() };
    tela(
      '<p style="margin-bottom:8px"><a class="btn btn-texto" href="#/estrategia/' + esc(planoId) + '">‹ Voltar à estratégia</a></p>' +
      "<h1>Programa de treino</h1>" +
      '<p class="sub">Conte como é a sua rotina e o programa se encaixa nela.</p>' +
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
        if (pj.status === "erro") { await carregarDados(); telaErroPlano(pj.erro); return; }
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
        : '<div class="cartao bloqueado" style="margin-top:18px"><p class="olho">Plano 2</p><h2>Registre o que você treinou</h2><p class="nota" style="margin-top:6px">Marcar blocos, anotar observações e acompanhar o progresso fazem parte do Plano 2.</p>' +
          '<div class="acoes"><a class="btn btn-secundario" href="https://wa.me/' + WHATSAPP_CONSULTORIA + "?text=" + encodeURIComponent("Olá, Richard! Quero saber sobre o Plano 2 (registro de treinos) do QuadraLab Player.") + '" target="_blank" rel="noopener">Quero o Plano 2<span class="sr"> (abre o WhatsApp)</span></a></div></div>')
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

  /* ══ casca do app: menu lateral (computador) e menu inferior (celular) ══ */
  var NAV_DA_ROTA = {
    ficha: "mais", estrategia: "estrategia", plano: "estrategia", planos: "estrategia", completar: "estrategia", gerando: "estrategia",
    jogadas: "jogadas", planejar: "treinos", treinos: "treinos", treino: "treinos", programa: "treinos", planejamento: "treinos", gerandoPlanej: "treinos",
  };
  function atualizarCasca(logado, rota) {
    document.body.classList.toggle("logado", logado);
    lateral.hidden = !logado;
    navInf.hidden = !logado;
    var ativo = NAV_DA_ROTA[rota] || "inicio";
    document.querySelectorAll("[data-nav]").forEach(function (el) {
      if (el.getAttribute("data-nav") === ativo && logado) el.setAttribute("aria-current", "page"); else el.removeAttribute("aria-current");
    });
    if (!logado) fecharMais(false);
    var conta = document.getElementById("painelConta");
    if (conta && estado.dados) conta.textContent = "Conectado como " + estado.dados.perfil.email + (estado.dados.full ? " · acesso completo de teste" : "");
    var msg = "Olá, Richard! Preciso de ajuda com o QuadraLab Player.";
    document.querySelectorAll("[data-wpp]").forEach(function (a) { a.href = "https://wa.me/" + WHATSAPP_CONSULTORIA + "?text=" + encodeURIComponent(msg); });
  }
  function abrirMais() {
    painelMais.hidden = false; painelFundo.hidden = false;
    btMais.setAttribute("aria-expanded", "true");
    document.getElementById("btFecharMais").focus();
  }
  function fecharMais(devolverFoco) {
    if (painelMais.hidden) return;
    painelMais.hidden = true; painelFundo.hidden = true;
    btMais.setAttribute("aria-expanded", "false");
    if (devolverFoco) btMais.focus();
  }
  btMais.addEventListener("click", function () { painelMais.hidden ? abrirMais() : fecharMais(true); });
  document.getElementById("btFecharMais").addEventListener("click", function () { fecharMais(true); });
  painelFundo.addEventListener("click", function () { fecharMais(true); });
  painelMais.addEventListener("click", function (ev) { if (ev.target.closest("a")) fecharMais(false); });
  document.addEventListener("keydown", function (ev) {
    if (painelMais.hidden) return;
    if (ev.key === "Escape") { fecharMais(true); return; }
    if (ev.key === "Tab") {
      var itens = [].slice.call(painelMais.querySelectorAll("button, a")).filter(function (x) { return !x.hidden; });
      var i = itens.indexOf(document.activeElement);
      if (ev.shiftKey && i <= 0) { ev.preventDefault(); itens[itens.length - 1].focus(); }
      else if (!ev.shiftKey && i === itens.length - 1) { ev.preventDefault(); itens[0].focus(); }
    }
  });
  document.addEventListener("click", async function (ev) {
    var b = ev.target.closest("[data-acao='sair']");
    if (!b) return;
    fecharMais(false);
    await auth.signOut();
    estado.dados = null; estado.fluxo = null;
    ir("#/entrar");
  });

  /* ── teclado aberto (celular): o menu inferior sai da frente e o campo fica visível ── */
  document.addEventListener("focusin", function (ev) {
    if (!/^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName) || /^(radio|checkbox)$/.test(ev.target.type)) return;
    document.body.classList.add("teclado");
    setTimeout(function () { try { ev.target.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) { /* navegador antigo */ } }, 250);
  });
  document.addEventListener("focusout", function () {
    setTimeout(function () {
      var a = document.activeElement;
      if (!a || !/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || /^(radio|checkbox)$/.test(a.type)) document.body.classList.remove("teclado");
    }, 50);
  });

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
    var partes = h.split("/");
    atualizarCasca(!!logado, partes[0]);
    var t = document.getElementById("toast"); if (t) t.hidden = true;
    if (!logado) { telaEntrar(partes[0] === "entrar" ? "entrar" : "criar"); return; }
    if (!estado.dados) {
      tela('<p class="carregando">Carregando seus dados…</p>', true);
      try { await carregarDados(); aplicarRascunho(); }
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
