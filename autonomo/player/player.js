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
  var btSair = document.getElementById("btSair");
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

  function telaInicio() {
    var d = estado.dados;
    var primeiroNome = (d.perfil.nome || "").split(" ")[0];
    var planos = d.planos.filter(function (p) { return p.status === "pronto" || p.status === "gerando"; });
    var html = '<div class="pilha"><div><h1>Olá' + (primeiroNome ? ", " + esc(primeiroNome) : "") + ".</h1>";
    if (!d.fichaCompleta) {
      html += '<p class="sub">Comece pela sua ficha tática: são 4 etapas rápidas, quase tudo de tocar e escolher.</p></div>' +
        '<div class="cartao"><h2>Sua ficha tática</h2><p class="nota" style="margin-top:6px">Nível, golpe forte, ponto fraco, como você constrói os pontos e, se quiser, um adversário específico.</p>' +
        '<div class="acoes"><a class="btn btn-primario" href="#/ficha/1">' + (d.ficha ? "Continuar ficha" : "Preencher minha ficha") + "</a></div></div>";
    } else {
      html += '<p class="sub">' + (planos.length ? "Seus planos táticos ficam guardados aqui." : "Sua ficha está pronta. Gere o seu plano tático.") + "</p></div>";
      if (planos.length) {
        html += '<div class="cartao"><h2 style="margin-bottom:6px">Seus planos</h2>' + planos.map(function (p) {
          var nome = p.status === "gerando" ? "Plano em preparação…" : esc(p.plano.titulo);
          return '<a class="item-plano" href="#/' + (p.status === "gerando" ? "gerando/" : "plano/") + esc(p.id) + '"><span><strong>' + nome + "</strong><br>" +
            '<span class="data">' + dataBR(p.criadoEm) + (p.adversarioNome ? " · contra " + esc(p.adversarioNome) : "") + "</span></span>" +
            '<span class="seta" aria-hidden="true">›</span></a>';
        }).join("") + "</div>";
      }
      html += '<div class="cartao">';
      if (d.podeGerar) {
        html += "<h2>" + (planos.length ? "Gerar novo plano" : "Gerar meu plano tático") + "</h2>" +
          '<p class="nota" style="margin-top:6px">' + (d.gratisRestantes ? "Seu primeiro plano é grátis." : "Você tem " + d.creditos + " crédito(s) para novos planos.") +
          " Antes, confira se a ficha continua igual ao seu jogo de hoje.</p>" +
          '<div class="acoes"><button class="btn btn-primario" id="btGerar" type="button">Gerar plano com a ficha atual</button>' +
          '<a class="btn btn-secundario" href="#/ficha/1">Revisar ficha</a></div>';
      } else {
        html += "<h2>Novos planos</h2>" +
          '<p class="nota" style="margin-top:6px">Você já usou o seu plano grátis. A compra de novos planos, por exemplo contra outro adversário, chega em breve aqui no app.</p>' +
          '<div class="acoes"><a class="btn btn-secundario" href="#/ficha/1">Atualizar minha ficha</a></div>';
      }
      html += "</div>";
    }
    html += "</div>";
    tela(html);
    var btGerar = document.getElementById("btGerar");
    if (btGerar) btGerar.addEventListener("click", function () { gerarPlano(btGerar); });
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

  function telaPlano(id) {
    var p = (estado.dados.planos || []).filter(function (x) { return x.id === id; })[0];
    if (!p || p.status !== "pronto") { ir("#/inicio"); return; }
    var pl = p.plano;
    var msgWpp = "Olá, Richard! Gerei meu plano tático no QuadraLab Player e quero saber sobre a consultoria.";
    tela(
      '<p style="margin-bottom:12px"><a class="btn btn-texto" href="#/inicio">‹ Meus planos</a></p>' +
      '<p class="olho">Plano tático · ' + dataBR(p.criadoEm) + "</p>" +
      "<h1>" + esc(pl.titulo) + "</h1>" +
      (p.adversarioNome ? '<p style="margin-top:10px"><span class="tag">Contra ' + esc(p.adversarioNome) + "</span></p>" : "") +
      '<p class="sub" style="color:var(--tinta)">' + esc(pl.resumo) + "</p>" +
      '<ol class="diretrizes">' + pl.diretrizes.map(function (d) {
        return "<li><h3>" + esc(d.titulo) + '</h3><p class="acao">' + esc(d.acao) + '</p><p class="porque"><b>Por quê:</b> ' + esc(d.porque) + "</p></li>";
      }).join("") + "</ol>" +
      (pl.lacunas && pl.lacunas.length ? '<div class="cartao" style="margin-top:16px"><h3>Para um plano mais preciso</h3><ul class="lista-simples">' +
        pl.lacunas.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("") + "</ul></div>" : "") +
      '<p class="nota" style="margin-top:16px">Plano gerado por inteligência artificial a partir da sua autoavaliação, seguindo a Metodologia MTY. Ele não substitui a avaliação de um treinador vendo você jogar.</p>' +
      '<div class="consultoria"><p class="olho">Consultoria</p><h2>Quer um plano validado por um treinador?</h2>' +
        "<p>O Richard Tsukada pode revisar o seu plano, analisar um vídeo do seu jogo ou conversar com você ao vivo.</p>" +
        '<a class="btn largo" href="https://wa.me/' + WHATSAPP_CONSULTORIA + "?text=" + encodeURIComponent(msgWpp) + '" target="_blank" rel="noopener">Falar sobre a consultoria<span class="sr"> (abre o WhatsApp)</span></a></div>'
    );
  }

  /* ── rotas ── */
  async function rotear() {
    var logado = auth && auth.currentUser;
    btSair.hidden = !logado;
    var h = location.hash.replace(/^#\/?/, "");
    var partes = h.split("/");
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
  btSair.addEventListener("click", async function () {
    await auth.signOut();
    estado.dados = null;
    ir("#/entrar");
  });
  window.addEventListener("hashchange", rotear);
  auth.onAuthStateChanged(function (u) {
    if (!u) estado.dados = null;
    var h = location.hash;
    if (u && (!h || h === "#/entrar" || h === "#/")) { location.hash = "#/inicio"; return; }
    rotear();
  });
})();
