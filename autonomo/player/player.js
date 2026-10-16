/* QuadraLab Player — app do jogador (Fase 1: conta, ficha tática e
   primeiro plano grátis).

   Só o login usa o Firebase direto do navegador. Ficha, planos e cota
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
  var estado = { dados: null, ficha: null };

  /* ── utilidades ── */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function ir(rota) { if (location.hash === rota) rotear(); else location.hash = rota; }
  function tela(html) {
    app.innerHTML = html;
    window.scrollTo(0, 0);
    app.focus({ preventScroll: true });
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
        '<div><p class="olho">Plano tático de tênis</p>' +
        "<h1>Descubra como jogar melhor com o jogo que você já tem.</h1>" +
        '<p class="sub">Responda uma ficha rápida sobre o seu jogo e receba um plano tático com a Metodologia MTY e a tecnologia QuadraLab. <strong>O primeiro plano é grátis.</strong></p></div>' +
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

  function planosProntos() { return (estado.dados.planos || []).filter(function (p) { return p.status === "pronto"; }); }
  function planejamentosProntos() { return (estado.dados.planejamentos || []).filter(function (x) { return x.status === "pronto"; }); }

  function listaPlanosHtml() {
    var d = estado.dados;
    var planos = d.planos.filter(function (p) { return p.status === "pronto" || p.status === "gerando"; });
    if (!planos.length) return "";
    return '<div class="cartao"><h2 style="margin-bottom:6px">Seus planos táticos</h2>' + planos.map(function (p) {
      var nome = p.status === "gerando" ? "Plano em preparação…" : esc(p.plano.titulo);
      return '<a class="item-plano" href="#/' + (p.status === "gerando" ? "gerando/" : "plano/") + esc(p.id) + '"><span><strong>' + nome + "</strong><br>" +
        '<span class="data">' + dataBR(p.criadoEm) + (p.adversarioNome ? " · contra " + esc(p.adversarioNome) : "") + "</span></span>" +
        '<span class="seta" aria-hidden="true">›</span></a>';
    }).join("") + "</div>";
  }
  function cartaoGerarHtml() {
    var d = estado.dados, planos = planosProntos();
    if (!d.fichaCompleta) return "";
    if (d.podeGerar) {
      return '<div class="cartao"><h2>' + (planos.length ? "Gerar novo plano" : "Gerar meu plano tático") + "</h2>" +
        '<p class="nota" style="margin-top:6px">' + (d.full ? "Acesso completo de teste: você pode gerar quantos planos quiser." : d.gratisRestantes ? "Seu primeiro plano é grátis." : "Você tem " + d.creditos + " crédito(s) para novos planos.") +
        " Antes, confira se a ficha continua igual ao seu jogo de hoje.</p>" +
        '<div class="acoes"><button class="btn btn-primario" id="btGerar" type="button">Gerar plano com a ficha atual</button>' +
        '<a class="btn btn-secundario" href="#/ficha/1">Revisar ficha</a></div></div>';
    }
    return '<div class="cartao"><h2>Novos planos</h2>' +
      '<p class="nota" style="margin-top:6px">Você já usou o seu plano grátis. A compra de novos planos, por exemplo contra outro adversário, chega em breve aqui no app.</p>' +
      '<div class="acoes"><a class="btn btn-secundario" href="#/ficha/1">Atualizar minha ficha</a></div></div>';
  }
  function ligarGerar() {
    var btGerar = document.getElementById("btGerar");
    if (btGerar) btGerar.addEventListener("click", function () { gerarPlano(btGerar); });
  }

  /* Início — mesmo desenho do app do treinador: saudação, "Primeiros passos",
     botão principal grande, próximo treino e quatro números. */
  function telaInicio() {
    var d = estado.dados;
    var primeiroNome = (d.perfil.nome || "").split(" ")[0];
    var prontos = planosProntos();
    var ultimo = prontos[0];
    var escolheu = prontos.some(function (p) { return (p.escolhidas || []).length > 0; });
    var passos = [
      { t: "Preencher a ficha tática", feito: d.fichaCompleta, href: "#/ficha/1" },
      { t: "Gerar o plano tático", feito: prontos.length > 0, href: "#/planos" },
      { t: "Escolher as jogadas que quer treinar", feito: escolheu, href: ultimo ? "#/plano/" + esc(ultimo.id) : "#/planos" },
    ];
    var atual = passos.findIndex(function (x) { return !x.feito; });
    var html = "<h1>Olá" + (primeiroNome ? ", " + esc(primeiroNome) : "") + "</h1>" +
      '<p class="sub">' + (atual === -1 ? "Seu plano está pronto. Hora de treinar." : "Vamos montar o seu plano de jogo?") + "</p>";
    if (atual !== -1) {
      html += '<div class="cartao" style="margin-top:18px"><p class="olho">Primeiros passos</p><h2>Vamos montar o seu plano tático?</h2>' +
        '<ol class="passos">' + passos.map(function (x, n) {
          var cls = x.feito ? "feito" : n === atual ? "atual" : "";
          return '<li class="' + cls + '"><span class="num" aria-hidden="true">' + (x.feito ? "✓" : n + 1) + "</span>" +
            (n === atual ? '<a href="' + x.href + '">' + esc(x.t) + "</a>" : "<span>" + esc(x.t) + "</span>") + "</li>";
        }).join("") + "</ol></div>";
      var acaoGrande = atual === 0 ? '<a class="btn btn-primario btn-grande" href="#/ficha/1">' + (d.ficha ? "Continuar ficha" : "Preencher minha ficha") + "</a>"
        : atual === 1 ? (d.podeGerar ? '<button class="btn btn-primario btn-grande" id="btGerar" type="button">Gerar meu plano tático</button>' : '<a class="btn btn-primario btn-grande" href="#/planos">Ver planos</a>')
        : '<a class="btn btn-primario btn-grande" href="#/plano/' + esc(ultimo.id) + '">Escolher jogadas</a>';
      html += acaoGrande;
    } else if (estado.dados.recursos && estado.dados.recursos.planejamento) {
      html += (ultimo ? '<a class="btn btn-primario btn-grande" href="#/planejar/' + esc(ultimo.id) + '">Montar planejamento</a>' : "");
    }
    html += '<div id="proximoTreino"></div>';
    var marcadas = prontos.reduce(function (n, p) { return n + (p.escolhidas || []).length; }, 0);
    html += '<div class="grade-numeros">' +
      '<div class="numero"><strong>' + prontos.length + '</strong><span>Planos táticos</span><small>já gerados</small></div>' +
      '<div class="numero"><strong>' + marcadas + '</strong><span>Jogadas</span><small>marcadas para treinar</small></div>' +
      '<div class="numero"><strong>' + planejamentosProntos().length + '</strong><span>Planejamentos</span><small>por semanas</small></div>' +
      '<div class="numero"><strong>' + (d.full ? "∞" : (d.gratisRestantes + d.creditos)) + '</strong><span>Planos para gerar</span><small>' + (d.full ? "acesso completo de teste" : d.gratisRestantes ? "plano grátis disponível" : "créditos") + "</small></div></div>" +
      '<p class="nota" style="text-align:center;margin-top:18px">Conectado como ' + esc(d.perfil.email) + (d.full ? " · acesso completo de teste" : "") + "</p>";
    tela(html);
    ligarGerar();
    carregarProximoTreino();
  }

  /* "Próximo treino": a primeira sessão de hoje em diante do planejamento mais recente. */
  async function carregarProximoTreino() {
    var ultimo = planejamentosProntos()[0];
    var alvo = document.getElementById("proximoTreino");
    if (!ultimo || !alvo) return;
    try {
      var pj = (await api("player-dados?planejamento=" + encodeURIComponent(ultimo.id))).planejamento;
      if (!pj.planejamento || !document.getElementById("proximoTreino")) return;
      var hoje = hojeISO(), proxima = null, ultima = null;
      pj.planejamento.semanas.forEach(function (w) { w.sessoes.forEach(function (x) { ultima = x; if (!proxima && x.data >= hoje) proxima = x; }); });
      var x = proxima || ultima;
      if (!x) return;
      document.getElementById("proximoTreino").innerHTML = '<div class="cartao proximo-treino" style="margin-top:14px"><p class="olho">' + (proxima ? "Próximo treino" : "Último treino do ciclo") + "</p>" +
        "<h3>" + esc(x.titulo) + '</h3><p class="quando">' + esc(x.diaNome) + ", " + esc(dataCurta(x.data)) + " · " + esc((pj.params || {}).minutos) + ' min</p>' +
        '<div class="acoes"><a class="btn btn-secundario" href="#/planejamento/' + esc(ultimo.id) + '">Abrir planejamento</a></div></div>';
    } catch (e) { /* sem rede: o cartão simplesmente não aparece */ }
  }

  function telaPlanos() {
    var d = estado.dados;
    var html = "<h1>Planos táticos</h1>" +
      '<p class="sub">' + (planosProntos().length ? "Seus planos ficam guardados aqui." : d.fichaCompleta ? "Gere o seu primeiro plano tático." : "Comece pela ficha tática.") + "</p>";
    if (!d.fichaCompleta) {
      html += '<div class="cartao" style="margin-top:18px"><h2>Sua ficha tática</h2><p class="nota" style="margin-top:6px">São 4 etapas rápidas, quase tudo de tocar e escolher.</p>' +
        '<div class="acoes"><a class="btn btn-primario" href="#/ficha/1">' + (d.ficha ? "Continuar ficha" : "Preencher minha ficha") + "</a></div></div>";
    } else {
      html += '<div class="pilha" style="margin-top:18px">' + listaPlanosHtml() + cartaoGerarHtml() + "</div>";
    }
    tela(html);
    ligarGerar();
  }

  function telaTreino() {
    var d = estado.dados, r = d.recursos || {}, ultimo = planosProntos()[0];
    var html = "<h1>Treino</h1>";
    if (!r.planejamento) {
      var msg = "Olá, Richard! Quero saber sobre o Plano 1 (planejamento por semanas) do QuadraLab Player.";
      html += '<p class="sub">Transforme as jogadas do seu plano em treinos.</p>' +
        '<div class="cartao bloqueado" style="margin-top:18px"><p class="olho">Plano 1</p><h2>Planejamento por semanas</h2>' +
        '<p class="nota" style="margin-top:6px">Semanas de trabalho com os dias e a duração que cabem na sua rotina, e os drills de cada sessão.</p>' +
        '<div class="acoes"><a class="btn btn-secundario" href="https://wa.me/' + WHATSAPP_CONSULTORIA + "?text=" + encodeURIComponent(msg) + '" target="_blank" rel="noopener">Quero o Plano 1<span class="sr"> (abre o WhatsApp)</span></a></div></div>';
    } else {
      var lista = planejamentosProntos();
      html += '<p class="sub">' + (lista.length ? "Seus planejamentos por semanas." : "Monte as semanas de treino a partir do seu plano tático.") + "</p>";
      if (lista.length) {
        html += '<div class="cartao" style="margin-top:18px"><h2 style="margin-bottom:6px">Seus planejamentos</h2>' + lista.map(function (x) {
          return '<a class="item-plano" href="#/planejamento/' + esc(x.id) + '"><span><strong>' + esc(x.titulo || "Planejamento") + '</strong><br><span class="data">' +
            dataBR(x.criadoEm) + (x.params ? " · " + x.params.semanas + " semanas · " + x.params.dias.length + "x por semana" : "") + '</span></span><span class="seta" aria-hidden="true">›</span></a>';
        }).join("") + "</div>";
      }
      html += ultimo ? '<a class="btn btn-primario btn-grande" href="#/planejar/' + esc(ultimo.id) + '">Montar ' + (lista.length ? "outro " : "") + "planejamento</a>"
        : '<div class="cartao" style="margin-top:18px"><p class="nota">Gere um plano tático antes de montar o planejamento.</p><div class="acoes"><a class="btn btn-primario" href="#/planos">Ir para os planos</a></div></div>';
    }
    tela(html);
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
      alert("Não foi possível pedir o plano agora. Verifique sua conexão e tente de novo.");
    }
  }

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
      corpo = '<p class="nota" style="margin-bottom:14px">Se você tem um adversário que enfrenta com frequência, descreva-o e o plano será montado para esse confronto. Sem adversário, o plano é geral para o seu jogo.</p>' +
        '<label class="alternar"><input type="checkbox" id="advAtivo"' + (a.ativo ? " checked" : "") + "><span>Quero um plano contra um adversário específico</span></label>" +
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
      '<h1 style="margin-bottom:18px">' + esc(ETAPAS[n - 1].titulo) + "</h1>" +
      '<form id="fFicha" novalidate>' + corpo +
        '<div class="aviso" id="aviso" role="alert" hidden></div>' +
        '<div class="acoes lado">' +
          '<button class="btn btn-primario" id="btAvancar" type="submit">' + (ultima ? (podeGerar ? "Salvar e gerar meu plano" : "Salvar ficha") : "Continuar") + "</button>" +
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
      fs.addEventListener("change", function () { fs.querySelector(".erro-campo").hidden = true; });
    });

    document.getElementById("btVoltar").addEventListener("click", function () {
      lerEtapa();
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
        av.textContent = e.message || "Não foi possível salvar agora. Suas respostas continuam aqui — tente de novo.";
        av.hidden = false;
        ocupado(bt, false);
      }
    });
  }

  var consulta = null;
  function telaGerando(id) {
    tela('<div class="gerando"><div class="bola" aria-hidden="true"></div><h1>Montando seu plano tático…</h1>' +
      '<p class="sub" id="status">Costuma levar menos de um minuto. Pode deixar esta tela aberta.</p></div>');
    var inicio = Date.now();
    clearTimeout(consulta);
    async function verificar() {
      if (location.hash !== "#/gerando/" + id) return;
      try {
        var r = await api("player-dados?plano=" + encodeURIComponent(id));
        var p = r.plano;
        if (p.status === "pronto") { await carregarDados(); ir("#/plano/" + id); return; }
        if (p.status === "erro") { await carregarDados(); telaErroPlano(p.erro); return; }
      } catch (e) { /* ainda não existe ou rede oscilou: tenta de novo */ }
      if (Date.now() - inicio > 4 * 60 * 1000) {
        telaErroPlano("O plano está demorando mais que o normal. Volte ao início em alguns minutos: ele aparece na sua lista quando ficar pronto.");
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

  function linhaDrill(rotulo, texto) {
    return texto ? "<dt>" + rotulo + "</dt><dd>" + esc(texto) + "</dd>" : "";
  }
  function drillHtml(d, usadoEm) {
    return '<details class="drill"><summary><span class="drill-nome">' + esc(d.nome) + "</span>" +
      '<span class="drill-meta">' + esc(d.tipo) + " · " + esc(d.codigo) + "</span>" +
      (usadoEm ? '<span class="drill-uso">Treina: ' + esc(usadoEm) + "</span>" : "") +
      (d.motivo ? '<span class="drill-motivo">' + esc(d.motivo) + "</span>" : "") + "</summary>" +
      '<dl class="drill-det">' + linhaDrill("Objetivo", d.objetivo) + linhaDrill("Montagem", d.montagem) + linhaDrill("Carga", d.carga) +
      linhaDrill("Para facilitar", d.regressao) + linhaDrill("Para evoluir", d.progressao) + linhaDrill("Corrigir", d.corrigir) +
      linhaDrill("Ignorar", d.ignorar) + "</dl></details>";
  }
  function jogadasHtml(jogadas, escolhidas) {
    if (!jogadas || !jogadas.length) return "";
    return '<section class="jogadas" aria-labelledby="t-jogadas"><h2 id="t-jogadas">Jogadas para colocar o plano em prática</h2>' +
      '<p class="nota" style="margin-top:6px">Sequências de bolas que você pode usar em quadra. <strong>Marque as que quer treinar: pode escolher mais de uma.</strong></p>' +
      jogadas.map(function (j, n) {
        var marcada = escolhidas.indexOf(n) >= 0;
        return '<article class="jogada' + (marcada ? " escolhida" : "") + '" data-jogada="' + n + '"><p class="olho">Jogada ' + (n + 1) + "</p><h3>" + esc(j.titulo) + "</h3>" +
          '<label class="escolher"><input type="checkbox" value="' + n + '"' + (marcada ? " checked" : "") + "><span>Quero treinar esta jogada</span></label>" +
          '<p class="quando"><b>Quando usar:</b> ' + esc(j.quando) + "</p>" +
          '<ol class="sequencia" aria-label="Sequência de bolas">' + (j.sequencia || []).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ol>" +
          '<p class="porque"><b>Por quê:</b> ' + esc(j.porque) + "</p>" +
          '<div class="drills"><h4>Drills para treinar esta jogada</h4>' +
          ((j.drills || []).length ? j.drills.map(function (d) { return drillHtml(d); }).join("") : '<p class="nota">Nenhum drill do catálogo cobre esta jogada com precisão. Um treinador pode indicar um na consultoria.</p>') +
          "</div></article>";
      }).join("") +
      '<div id="treino" class="treino" aria-live="polite">' + treinoHtml(jogadas, escolhidas) + "</div>" +
      '<p class="nota" style="margin-top:12px">Drills do catálogo da Metodologia MTY, escritos para treinar com parceiro ou treinador. Ajuste a carga ao seu nível.</p></section>';
  }

  /* "Seu treino": os drills das jogadas marcadas, juntos e sem repetir —
     um drill que serve a duas jogadas aparece uma vez, dizendo quais. */
  function treinoHtml(jogadas, escolhidas) {
    if (!escolhidas.length) {
      return '<p class="nota treino-vazio">Marque as jogadas que quer treinar e o seu treino aparece aqui, com os drills reunidos e sem repetição.</p>';
    }
    var porCodigo = {}, ordem = [];
    escolhidas.forEach(function (n) {
      ((jogadas[n] || {}).drills || []).forEach(function (d) {
        if (!porCodigo[d.codigo]) { porCodigo[d.codigo] = { d: d, usos: [] }; ordem.push(d.codigo); }
        porCodigo[d.codigo].usos.push("Jogada " + (n + 1));
      });
    });
    return "<h3>Seu treino</h3>" +
      '<p class="nota" style="margin:4px 0 10px">' + escolhidas.length + (escolhidas.length === 1 ? " jogada escolhida: " : " jogadas escolhidas: ") +
      escolhidas.map(function (n) { return esc(jogadas[n].titulo); }).join(" · ") + "</p>" +
      (ordem.length
        ? '<div class="drills" style="border:none;margin:0;padding:0">' + ordem.map(function (c) { return drillHtml(porCodigo[c].d, porCodigo[c].usos.join(", ")); }).join("") + "</div>"
        : '<p class="nota">As jogadas escolhidas não têm drills do catálogo. Um treinador pode indicar na consultoria.</p>');
  }

  function blocoOutroPlano() {
    var d = estado.dados;
    if (d.podeGerar) {
      return '<div class="cartao" style="margin-top:20px"><h2>Gerar outro plano</h2>' +
        '<p class="nota" style="margin-top:6px">' + (d.full ? "Acesso completo de teste: sem limite de planos. " : d.gratisRestantes ? "Seu primeiro plano é grátis. " : "Você tem " + d.creditos + " crédito(s). ") +
        "O novo plano usa a sua ficha atual. Se o seu jogo mudou, ou você quer um plano contra outro adversário, revise a ficha antes.</p>" +
        '<div class="acoes"><button class="btn btn-primario" id="btGerar2" type="button">Gerar outro plano com a ficha atual</button>' +
        '<a class="btn btn-secundario" href="#/ficha/1">Revisar ficha e gerar</a></div></div>';
    }
    return '<div class="cartao" style="margin-top:20px"><h2>Novos planos</h2><p class="nota" style="margin-top:6px">Você já usou o seu plano grátis. A compra de novos planos chega em breve aqui no app.</p></div>';
  }

  /* ── planejamento por semanas (Plano 1) ── */
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

  function blocoPlanejamento(planoId) {
    var r = estado.dados.recursos || {};
    if (!r.planejamento) {
      var msg = "Olá, Richard! Quero saber sobre o Plano 1 (planejamento por semanas) do QuadraLab Player.";
      return '<div class="cartao bloqueado" style="margin-top:20px"><p class="olho">Plano 1</p><h2>Planejamento por semanas</h2>' +
        '<p class="nota" style="margin-top:6px">Transforme as jogadas em treinos: semanas de trabalho, com os dias e a duração que cabem na sua rotina, e os drills de cada sessão.</p>' +
        '<div class="acoes"><a class="btn btn-secundario" href="https://wa.me/' + WHATSAPP_CONSULTORIA + "?text=" + encodeURIComponent(msg) + '" target="_blank" rel="noopener">Quero o Plano 1<span class="sr"> (abre o WhatsApp)</span></a></div></div>';
    }
    var existente = (estado.dados.planejamentos || []).filter(function (x) { return x.baseadoEm === planoId && x.status === "pronto"; })[0];
    return '<div class="cartao" style="margin-top:20px"><p class="olho">Plano 1</p><h2>Planejamento por semanas</h2>' +
      '<p class="nota" style="margin-top:6px">Monte as semanas de treino a partir deste plano, com os seus dias e a sua duração.</p>' +
      '<div class="acoes">' + (existente ? '<a class="btn btn-primario" href="#/planejamento/' + esc(existente.id) + '">Ver meu planejamento</a>' : "") +
      '<a class="btn ' + (existente ? "btn-secundario" : "btn-primario") + '" href="#/planejar/' + esc(planoId) + '">' + (existente ? "Montar outro planejamento" : "Montar meu planejamento") + "</a></div></div>";
  }

  function telaPlanejar(planoId) {
    var plano = (estado.dados.planos || []).filter(function (x) { return x.id === planoId && x.status === "pronto"; })[0];
    if (!plano || !(estado.dados.recursos || {}).planejamento) { ir("#/treino"); return; }
    var marcadas = (plano.escolhidas || []).length;
    var f = estado.formPlanej = estado.formPlanej || { semanas: "4", dias: ["ter", "qui", "sab"], minutos: "60", apoio: "", inicio: proximaSegunda() };
    tela(
      '<p style="margin-bottom:12px"><a class="btn btn-texto" href="#/plano/' + esc(planoId) + '">‹ Voltar ao plano</a></p>' +
      "<h1>Montar planejamento</h1>" +
      '<p class="sub">Conte como é a sua rotina e o planejamento se encaixa nela. ' +
      (marcadas ? "Ele vai treinar as " + marcadas + (marcadas === 1 ? " jogada que você marcou" : " jogadas que você marcou") + " no plano."
                : "Você não marcou jogadas neste plano, então o planejamento distribui todas elas.") + "</p>" +
      '<form id="fPlanej" novalidate style="margin-top:20px">' +
        '<fieldset id="g-semanas"><legend>Quantas semanas?</legend>' + opcoesPlanej("semanas", [["4", "4 semanas"], ["8", "8 semanas"]], f.semanas, "radio") + "</fieldset>" +
        '<fieldset id="g-dias"><legend>Em quais dias você treina?</legend><p class="nota">Escolha de 1 a 5 dias. O planejamento terá uma sessão em cada um.</p>' +
          opcoesPlanej("dias", DIAS_SEMANA, f.dias, "checkbox", true) + '<p class="erro-campo" hidden></p></fieldset>' +
        '<fieldset id="g-minutos"><legend>Quanto tempo tem por sessão?</legend>' + opcoesPlanej("minutos", [["45", "45 min"], ["60", "60 min"], ["90", "90 min"]], f.minutos, "radio") + "</fieldset>" +
        '<fieldset id="g-apoio"><legend>Com quem você treina?</legend>' + opcoesPlanej("apoio", [["parceiro", "Com um parceiro de jogo"], ["treinador", "Com treinador ou alimentador de bolas"]], f.apoio, "radio") + '<p class="erro-campo" hidden>Escolha uma opção.</p></fieldset>' +
        '<div class="campo"><label for="inicio">Quando começa?</label><input id="inicio" type="date" min="' + hojeISO() + '" value="' + esc(f.inicio) + '"></div>' +
        '<div class="aviso" id="aviso" role="alert" hidden></div>' +
        '<div class="acoes"><button class="btn btn-primario" id="btPlanej" type="submit">Gerar planejamento</button></div>' +
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
        av.textContent = "Não foi possível pedir o planejamento agora. Suas escolhas continuam aqui: verifique a conexão e tente de novo.";
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
    tela('<div class="gerando"><div class="bola" aria-hidden="true"></div><h1>Montando seu planejamento…</h1>' +
      '<p class="sub">Costuma levar de 1 a 2 minutos. Pode deixar esta tela aberta.</p></div>');
    var inicio = Date.now();
    clearTimeout(consulta);
    async function verificar() {
      if (location.hash !== "#/gerandoPlanej/" + id) return;
      try {
        var r = await api("player-dados?planejamento=" + encodeURIComponent(id));
        var pj = r.planejamento;
        if (pj.status === "pronto") { await carregarDados(); estado.formPlanej = null; ir("#/planejamento/" + id); return; }
        if (pj.status === "erro") { await carregarDados(); telaErroPlano(pj.erro); return; }
      } catch (e) { /* ainda não existe ou a rede oscilou */ }
      if (Date.now() - inicio > 5 * 60 * 1000) {
        telaErroPlano("O planejamento está demorando mais que o normal. Volte ao início em alguns minutos: ele aparece na sua lista quando ficar pronto.");
        return;
      }
      consulta = setTimeout(verificar, 3000);
    }
    consulta = setTimeout(verificar, 3000);
  }

  function itemSessaoHtml(it) {
    if (it.tipo === "livre") {
      return '<li class="item-livre"><span class="min">' + esc(it.minutos) + ' min</span><span><strong>' + esc(it.titulo) + "</strong>" + (it.nota ? '<br><span class="nota">' + esc(it.nota) + "</span>" : "") + "</span></li>";
    }
    return '<li class="item-drill"><details class="drill"><summary><span class="drill-nome">' + esc(it.nome) + "</span>" +
      '<span class="drill-meta">' + esc(it.minutos) + " min · " + esc(it.tipoDrill) + " · " + esc(it.codigo) + "</span>" +
      (it.nota ? '<span class="drill-motivo">' + esc(it.nota) + "</span>" : "") + "</summary>" +
      '<dl class="drill-det">' + linhaDrill("Objetivo", it.objetivo) + linhaDrill("Montagem", it.montagem) + linhaDrill("Carga", it.carga) +
      linhaDrill("Para facilitar", it.regressao) + linhaDrill("Para evoluir", it.progressao) + linhaDrill("Corrigir", it.corrigir) + linhaDrill("Ignorar", it.ignorar) + "</dl></details></li>";
  }

  async function telaPlanejamento(id) {
    tela('<p class="carregando">Carregando…</p>');
    var pj;
    try { pj = (await api("player-dados?planejamento=" + encodeURIComponent(id))).planejamento; }
    catch (e) { telaErroPlano(e.message); return; }
    if (pj.status !== "pronto" || !pj.planejamento) { ir("#/treino"); return; }
    var pl = pj.planejamento, pa = pj.params || {};
    var plano = (estado.dados.planos || []).filter(function (x) { return x.id === pj.baseadoEm; })[0];
    var jogadas = plano && plano.plano ? plano.plano.jogadas || [] : [];
    tela(
      '<p style="margin-bottom:12px"><a class="btn btn-texto" href="#/treino">‹ Treino</a></p>' +
      '<p class="olho">Planejamento · ' + (pa.semanas || "") + " semanas</p><h1>" + esc(pl.titulo) + "</h1>" +
      '<p style="margin-top:10px"><span class="tag">' + (pa.dias || []).map(function (d) { return ABREV_DIA[d]; }).join(", ") + " · " + esc(pa.minutos) + " min · começa em " + esc(dataExtensa(pa.inicio)) + "</span></p>" +
      '<p class="sub" style="color:var(--tinta)">' + esc(pl.resumo) + "</p>" +
      pl.semanas.map(function (w, wi) {
        return '<details class="semana"' + (wi === 0 ? " open" : "") + '><summary><span class="semana-n">Semana ' + w.n + '</span><span class="semana-foco">' + esc(w.foco) + '</span><span class="semana-carga">Carga: ' + esc(w.carga) + "</span></summary>" +
          w.sessoes.map(function (x) {
            return '<article class="sessao" id="' + esc(x.id) + '"><p class="sessao-dia">' + esc(x.diaNome) + ", " + esc(dataCurta(x.data)) + "</p><h3>" + esc(x.titulo) + "</h3>" +
              '<p class="nota" style="margin-top:2px">' + esc(x.objetivo) + "</p>" +
              ((x.jogadas || []).length ? '<p class="sessao-jogadas"><b>Jogadas:</b> ' + x.jogadas.map(function (n) { return esc(jogadas[n] ? jogadas[n].titulo : "Jogada " + (n + 1)); }).join(" · ") + "</p>" : "") +
              '<ul class="itens-sessao">' + x.itens.map(itemSessaoHtml).join("") + "</ul></article>";
          }).join("") + "</details>";
      }).join("") +
      '<p class="nota" style="margin-top:16px">Drills do catálogo da Metodologia MTY, escritos para treinar com parceiro ou treinador. Ajuste a carga ao seu nível.</p>'
    );
  }

  function telaPlano(id) {
    var p = (estado.dados.planos || []).filter(function (x) { return x.id === id; })[0];
    if (!p || p.status !== "pronto") { ir("#/planos"); return; }
    var pl = p.plano;
    var msgWpp = "Olá, Richard! Gerei meu plano tático no QuadraLab Player e quero saber sobre a consultoria.";
    tela(
      '<p style="margin-bottom:12px"><a class="btn btn-texto" href="#/planos">‹ Meus planos</a></p>' +
      '<p class="olho">Plano tático · ' + dataBR(p.criadoEm) + "</p>" +
      "<h1>" + esc(pl.titulo) + "</h1>" +
      (p.adversarioNome ? '<p style="margin-top:10px"><span class="tag">Contra ' + esc(p.adversarioNome) + "</span></p>" : "") +
      '<p class="sub" style="color:var(--tinta)">' + esc(pl.resumo) + "</p>" +
      '<h2 class="secao" id="t-estrategia">Estratégia</h2>' +
      '<ol class="diretrizes" aria-labelledby="t-estrategia">' + pl.diretrizes.map(function (d) {
        return "<li><h3>" + esc(d.titulo) + '</h3><p class="acao">' + esc(d.acao) + '</p><p class="porque"><b>Por quê:</b> ' + esc(d.porque) + "</p></li>";
      }).join("") + "</ol>" +
      jogadasHtml(pl.jogadas, p.escolhidas || []) +
      (pl.lacunas && pl.lacunas.length ? '<div class="cartao" style="margin-top:16px"><h3>Para um plano mais preciso</h3><ul class="lista-simples">' +
        pl.lacunas.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul></div>" : "") +
      blocoPlanejamento(id) +
      blocoOutroPlano() +
      '<p class="nota" style="margin-top:16px">Plano gerado por inteligência artificial a partir da sua autoavaliação, seguindo a Metodologia MTY. Ele não substitui a avaliação de um treinador vendo você jogar.</p>' +
      '<div class="consultoria"><p class="olho">Consultoria</p><h2>Quer um plano validado por um treinador?</h2>' +
        "<p>O Richard Tsukada pode revisar o seu plano, analisar um vídeo do seu jogo ou conversar com você ao vivo.</p>" +
        '<a class="btn largo" href="https://wa.me/' + WHATSAPP_CONSULTORIA + "?text=" + encodeURIComponent(msgWpp) + '" target="_blank" rel="noopener">Falar sobre a consultoria<span class="sr"> (abre o WhatsApp)</span></a></div>'
    );

    var bt2 = document.getElementById("btGerar2");
    if (bt2) bt2.addEventListener("click", function () { gerarPlano(bt2); });

    /* escolha de jogadas: atualiza a tela na hora e grava em segundo plano */
    var caixas = app.querySelectorAll(".escolher input");
    caixas.forEach(function (cx) {
      cx.addEventListener("change", async function () {
        var escolhidas = [].filter.call(caixas, function (c) { return c.checked; }).map(function (c) { return parseInt(c.value, 10); });
        p.escolhidas = escolhidas;
        cx.closest(".jogada").classList.toggle("escolhida", cx.checked);
        document.getElementById("treino").innerHTML = treinoHtml(pl.jogadas, escolhidas);
        try { await api("player-dados", { metodo: "POST", corpo: { acao: "escolherJogadas", planoId: id, escolhidas: escolhidas } }); }
        catch (e) {
          document.getElementById("treino").insertAdjacentHTML("beforeend", '<p class="aviso" role="alert" style="margin-top:10px">Não foi possível salvar sua escolha agora. Ela vale nesta tela, mas pode não estar salva.</p>');
        }
      });
    });
  }

  /* ── casca do app: menu lateral (computador) e menu inferior (celular) ── */
  var NAV_DA_ROTA = { ficha: "mais", plano: "planos", planos: "planos", planejar: "planos", gerando: "planos", treino: "treino", planejamento: "treino", gerandoPlanej: "treino" };
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
    estado.dados = null;
    ir("#/entrar");
  });

  /* ── rotas ── */
  async function rotear() {
    var logado = auth && auth.currentUser;
    var h = location.hash.replace(/^#\/?/, "");
    var partes = h.split("/");
    atualizarCasca(!!logado, partes[0]);
    if (!logado) { telaEntrar(partes[0] === "entrar" ? "entrar" : "criar"); return; }
    if (!estado.dados) {
      tela('<p class="carregando">Carregando seus dados…</p>');
      try { await carregarDados(); }
      catch (e) {
        tela('<div class="pilha"><div class="aviso">' + esc(e.message) + '</div><div class="acoes"><button class="btn btn-primario" id="btTentar" type="button">Tentar de novo</button></div></div>');
        document.getElementById("btTentar").addEventListener("click", rotear);
        return;
      }
    }
    if (partes[0] === "ficha") telaFicha(partes[1]);
    else if (partes[0] === "gerando" && partes[1]) telaGerando(partes[1]);
    else if (partes[0] === "plano" && partes[1]) telaPlano(partes[1]);
    else if (partes[0] === "planejar" && partes[1]) telaPlanejar(partes[1]);
    else if (partes[0] === "gerandoPlanej" && partes[1]) telaGerandoPlanej(partes[1]);
    else if (partes[0] === "planejamento" && partes[1]) telaPlanejamento(partes[1]);
    else if (partes[0] === "planos") telaPlanos();
    else if (partes[0] === "treino") telaTreino();
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
  window.addEventListener("hashchange", rotear);
  auth.onAuthStateChanged(function (u) {
    if (!u) estado.dados = null;
    var h = location.hash;
    if (u && (!h || h === "#/entrar" || h === "#/")) { location.hash = "#/inicio"; return; }
    rotear();
  });
})();
