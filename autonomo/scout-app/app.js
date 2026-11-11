/* QuadraLab Scout: telas do app (entrar, início, novo jogo, marcação, fim de jogo, atleta, minha conta).
   Dados e contas do jogo em dados.js (QLScoutApp) sobre o motor do scout (QLScoutMotor); conta e nuvem em nuvem.js (QLScoutNuvem);
   análise ao vivo em scout/ao-vivo.js (QLAoVivo); gráficos do resumo em scout/graficos.js (QLScoutGraficos), os mesmos da página da família.
   Relatório dos jogos em PDF em relatorio.js (QLScoutRelatorio, sobre scout/relatorio-jogos.js); análise de movimento com scout/movimento.js (carregado só ao abrir).
   A conta é obrigatória. Tudo é gravado primeiro no aparelho (funciona sem internet) e vai para a nuvem da conta quando há conexão.
   Para o servidor de contagem vai só o número sorteado do aparelho e o evento (scout-app-uso). */
(function () {
  "use strict";
  var M = window.QLScoutMotor, D = window.QLScoutApp, AV = window.QLAoVivo, G = window.QLScoutGraficos, N = window.QLScoutNuvem;
  var app = document.getElementById("app");
  if (!M || !D || !N) { app.innerHTML = '<div class="aviso atencao">Não foi possível abrir o app. Confira a internet e recarregue a página.</div>'; return; }

  var st = null, eu = null, conta = null, salvoOk = true;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function chave() { return D.CHAVE + ":" + eu.uid; }
  /* Scout Plus: link do Essencial na Eduzz; o webhook libera na conta do Scout com o mesmo e-mail */
  var CHECKOUT_PLUS = "https://chk.eduzz.com/6W4GYZEO0Z", PRECO_PLUS = "R$ 29,90 por mês";
  function ehPlus() { return !!(conta && conta.plano === "plus"); }
  function limiteAtletas() { return (conta && conta.limites && conta.limites.atletas) || 1; }
  function guardarConta() { try { localStorage.setItem("qls:conta:" + eu.uid, JSON.stringify(conta)); } catch (e) { /* sem espaço */ } }
  function lerContaGuardada() { try { return JSON.parse(localStorage.getItem("qls:conta:" + eu.uid) || "null"); } catch (e) { return null; } }
  function carregar() {
    var bruto = null;
    try { bruto = JSON.parse(localStorage.getItem(chave()) || "null"); } catch (e) { salvoOk = false; }
    st = D.normalizar(bruto);
    /* jogos marcados antes de existir conta (primeira versão do app): passam para a primeira conta que entrar neste celular */
    try {
      var antigo = localStorage.getItem(D.CHAVE);
      if (antigo) {
        var x = D.importar(st, D.exportar(D.normalizar(JSON.parse(antigo))));
        localStorage.setItem(D.CHAVE + ":antigo", antigo); localStorage.removeItem(D.CHAVE);
        if (x.novos || x.atletas) { atletasMudaram(); setTimeout(function () { toast(x.novos + (x.novos === 1 ? " jogo deste celular foi para a sua conta." : " jogos deste celular foram para a sua conta.")); }, 600); }
      }
    } catch (e) { /* cópia antiga ilegível: fica onde está */ }
    salvar(true);
  }
  function salvar(semNuvem) {
    try { localStorage.setItem(chave(), JSON.stringify(st)); salvoOk = true; }
    catch (e) { if (salvoOk) toast("Não consegui salvar neste celular (memória cheia ou navegação privada). Os pontos podem se perder ao fechar."); salvoOk = false; }
    if (!semNuvem) agendarNuvem();
  }
  var tmrToast = null;
  function toast(t) { var el = document.getElementById("toast"); el.textContent = t; el.hidden = false; clearTimeout(tmrToast); tmrToast = setTimeout(function () { el.hidden = true; }, 3800); }
  function dataBR(d) { var p = String(d || "").split("-"); return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : ""; }
  function dataCurta(d) { return d === D.hojeLocal() ? "hoje" : dataBR(d).slice(0, 5); }
  function primeiroNome(n) { return String(n || "Atleta").trim().split(/\s+/)[0]; }
  function q(sel) { return app.querySelector(sel); }
  function cada(sel, f) { Array.prototype.forEach.call(app.querySelectorAll(sel), f); }
  function tela(h, topo) { app.innerHTML = h; if (topo) { window.scrollTo(0, 0); try { app.focus({ preventScroll: true }); } catch (e) { /* sem foco */ } } }
  function ocupado(bt, sim, rot) { if (!bt) return; if (sim) { bt.dataset.rot = bt.textContent; bt.textContent = rot || "Aguarde…"; bt.disabled = true; } else { bt.textContent = bt.dataset.rot || bt.textContent; bt.disabled = false; } }

  /* ── contagem anônima de uso: fila no aparelho, enviada quando há internet ── */
  var FILA = "qls:fila", enviandoUso = false;
  function lerFila() { try { var f = JSON.parse(localStorage.getItem(FILA) || "[]"); return Array.isArray(f) ? f : []; } catch (e) { return []; } }
  function gravarFila(f) { try { localStorage.setItem(FILA, JSON.stringify(f.slice(-50))); } catch (e) { /* sem espaço: a contagem se perde, o app segue */ } }
  function uso(tipo, j) { var f = lerFila(); f.push(D.eventoUso(st, tipo, j)); gravarFila(f); enviarUso(); }
  function enviarUso() {
    if (enviandoUso || (navigator.onLine === false)) return;
    var f = lerFila(); if (!f.length) return;
    enviandoUso = true;
    fetch("/.netlify/functions/scout-app-uso", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f[0]), keepalive: true, cache: "no-store" })
      .then(function (r) {
        enviandoUso = false;
        /* 400 e 429 também saem da fila: reenviar não adiantaria */
        if (r.ok || r.status === 400 || r.status === 429) { var g = lerFila(); g.shift(); gravarFila(g); enviarUso(); }
      })
      .catch(function () { enviandoUso = false; });
  }
  /* jogo terminado conta uma vez só */
  function contarFim(j) { if (j.usoFim || !D.encerrado(M, j) || !j.pontos.length) return; j.usoFim = true; salvar(); uso("jogo-encerrado", j); }

  /* ── nuvem: sincronização com a conta ── */
  var tmrNuvem = null, estadoNuvem = "", APAGAR = "qls:apagar:";
  function atletasMudaram() { if (eu) N.marcarAtletasSujos(eu.uid); }
  function lerApagar() { try { var l = JSON.parse(localStorage.getItem(APAGAR + eu.uid) || "[]"); return Array.isArray(l) ? l : []; } catch (e) { return []; } }
  function gravarApagar(l) { try { localStorage.setItem(APAGAR + eu.uid, JSON.stringify(l.slice(-300))); } catch (e) { /* sem espaço */ } }
  function apagarNaNuvem(ids) { if (!eu || !ids.length) return; gravarApagar(lerApagar().concat(ids)); agendarNuvem(300); }
  function agendarNuvem(ms) { if (!eu) return; clearTimeout(tmrNuvem); tmrNuvem = setTimeout(sincronizarAgora, ms == null ? 2500 : ms); }
  async function sincronizarAgora() {
    if (!eu || navigator.onLine === false) { selo(); return; }
    var uid = eu.uid;
    try {
      var pend = lerApagar();
      while (pend.length) { await N.apagarJogo(pend[0]); pend.shift(); gravarApagar(pend); }
      var r = await N.sincronizar(D, uid, function () { return st; }, function (n) { st = n; salvar(true); });
      if (!eu || eu.uid !== uid) return;
      if (r.conta) { conta = r.conta; guardarConta(); }
      estadoNuvem = "";
      if (r.baixados && !/^#\/(jogo|novo)/.test(location.hash)) rota();
      if (conta && !conta.papel && !/^#\/(jogo|novo|perfil)/.test(location.hash)) location.hash = "#/perfil";
    } catch (e) {
      estadoNuvem = e.semRede ? "sem internet" : e.message;
      if (e.status === 401) toast("Sua sessão venceu. Entre de novo para salvar na nuvem.");
    }
    selo();
  }
  function selo() {
    var el = document.getElementById("seloOff"); if (!el) return;
    var off = navigator.onLine === false;
    el.hidden = !(off || estadoNuvem);
    el.textContent = off ? "sem internet · tudo salvo no celular" : estadoNuvem ? "nuvem: " + estadoNuvem : "";
  }

  /* ── link ao vivo para a família ── */
  var tmrAoVivo = null, aoVivoEstado = {};
  function linkDe(j) { return eu ? N.linkAoVivo(eu.uid, j.id) : null; }
  function agendarAoVivo(j, fim) {
    if (!linkDe(j)) return;
    clearTimeout(tmrAoVivo);
    tmrAoVivo = setTimeout(function () {
      if (navigator.onLine === false) { aoVivoEstado[j.id] = "Sem internet: os pontos vão para o link quando o sinal voltar."; mostrarEstadoAoVivo(j); return; }
      N.aoVivo(eu.uid, j, D.resumo(M, st, j), fim || D.encerrado(M, j)).then(function () { aoVivoEstado[j.id] = "Ao vivo: a família vê cada ponto."; mostrarEstadoAoVivo(j); })
        .catch(function (e) { aoVivoEstado[j.id] = "Não foi para o link agora (" + e.message + "). Tento de novo no próximo ponto."; mostrarEstadoAoVivo(j); });
    }, fim ? 50 : 1200);
  }
  function mostrarEstadoAoVivo(j) { var el = q("[data-estado-aovivo]"); if (el && marc.id === j.id) el.textContent = aoVivoEstado[j.id] || ""; }

  /* ══ Entrar ══ */
  var PAPEIS = [["responsavel", "Pai, mãe ou responsável"], ["atleta", "Atleta"], ["treinador", "Treinador"], ["outro", "Outro"]];
  var acesso = { papel: "" };
  function telaEntrar(modo) {
    var criar = modo === "criar", recuperar = modo === "recuperar";
    var h = '<section class="entrar"><h1>' + (criar ? "Criar a sua conta" : recuperar ? "Nova senha" : "Entrar no QuadraLab Scout") + "</h1>" +
      '<p class="sub">' + (criar ? "Grátis. Os seus jogos ficam guardados na conta e aparecem em qualquer celular." : recuperar ? "Digite o e-mail da conta. Mandamos um link para criar a nova senha." : "Marque o jogo ponto a ponto, mande o placar ao vivo para a família e acompanhe a evolução.") + "</p>" +
      '<form class="cartao" id="fAcesso" novalidate>' +
      (criar ? '<div class="campo" style="margin-top:0"><label for="acNome">Seu nome</label><input id="acNome" autocomplete="name" maxlength="60"></div>' +
        '<p class="olho" style="margin-top:14px">Quem é você</p><div class="chips" role="group" aria-label="Quem é você">' + PAPEIS.map(function (p) { return '<button type="button" class="chip" data-papel="' + p[0] + '" aria-pressed="' + (acesso.papel === p[0]) + '">' + p[1] + "</button>"; }).join("") + "</div>" : "") +
      '<div class="campo"' + (criar ? "" : ' style="margin-top:0"') + '><label for="acEmail">E-mail</label><input id="acEmail" type="email" inputmode="email" autocomplete="email" maxlength="120"></div>' +
      (recuperar ? "" : '<div class="campo"><label for="acSenha">Senha' + (criar ? ' <span class="nota">(pelo menos 8 caracteres)</span>' : "") + '</label><input id="acSenha" type="password" autocomplete="' + (criar ? "new-password" : "current-password") + '" maxlength="100"></div>') +
      '<div class="aviso atencao" id="acErro" role="alert" hidden></div><div class="aviso" id="acOk" role="status" hidden></div>' +
      '<div class="acoes"><button type="submit" class="bt bt-principal bt-grande" id="btAcesso">' + (criar ? "Criar conta" : recuperar ? "Mandar o link" : "Entrar") + "</button></div></form>" +
      '<div class="acoes" style="justify-content:center">' + (criar || recuperar ? '<a class="bt bt-texto" href="#/entrar">Já tenho conta: entrar</a>' : '<a class="bt bt-texto" href="#/criar">Criar conta grátis</a><a class="bt bt-texto" href="#/recuperar">Esqueci a senha</a>') + "</div>" +
      '<p class="rodape">Quem já tem conta no QuadraLab (Player, Competição ou Treinador) entra com o mesmo e-mail e senha.<br><a href="conheca.html">Conheça o QuadraLab Scout e os planos</a></p></section>';
    tela(h, true);
    cada("[data-papel]", function (b) { b.addEventListener("click", function () { acesso.papel = b.getAttribute("data-papel"); cada("[data-papel]", function (x) { x.setAttribute("aria-pressed", String(x === b)); }); }); });
    document.getElementById("fAcesso").addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var bt = document.getElementById("btAcesso"), er = document.getElementById("acErro"), ok = document.getElementById("acOk");
      if (bt.disabled) return;
      er.hidden = true; ok.hidden = true;
      var email = document.getElementById("acEmail").value.trim(), senha = recuperar ? "" : document.getElementById("acSenha").value, nome = criar ? document.getElementById("acNome").value.trim() : "";
      var falha = criar && !nome ? "Digite o seu nome." : criar && !acesso.papel ? "Escolha quem você é." : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "Digite um e-mail válido." : !recuperar && !senha ? "Digite a senha." : criar && senha.length < 8 ? "A senha precisa ter pelo menos 8 caracteres." : "";
      if (falha) { er.textContent = falha; er.hidden = false; return; }
      if (navigator.onLine === false) { er.textContent = "Sem internet. Conecte-se para " + (criar ? "criar a conta." : recuperar ? "pedir a nova senha." : "entrar.") + " Depois disso o app funciona sem sinal."; er.hidden = false; return; }
      ocupado(bt, true, criar ? "Criando a conta…" : recuperar ? "Mandando…" : "Entrando…");
      try {
        if (recuperar) { await N.recuperar(email); ok.textContent = "Se houver uma conta com esse e-mail, chega um link para criar a nova senha."; ok.hidden = false; ocupado(bt, false); return; }
        if (criar) await N.criar({ nome: nome, email: email, senha: senha, papel: acesso.papel });
        else await N.entrar(email, senha);
        /* onAuthStateChanged segue daqui */
      } catch (e) { er.textContent = e.message; er.hidden = false; ocupado(bt, false); }
    });
  }

  /* ══ Perfil (primeiro acesso de quem já tinha conta no QuadraLab) e Minha conta ══ */
  function telaPerfil() {
    var h = '<h1>Só mais um passo</h1><p class="sub">Conte quem você é. Assim o app mostra o que faz sentido para você.</p><section class="cartao">' +
      '<div class="campo" style="margin-top:0"><label for="pfNome">Seu nome</label><input id="pfNome" maxlength="60" value="' + esc((conta && conta.nome) || eu.nome || "") + '"></div>' +
      '<p class="olho" style="margin-top:14px">Quem é você</p><div class="chips">' + PAPEIS.map(function (p) { return '<button type="button" class="chip" data-papel="' + p[0] + '" aria-pressed="' + (acesso.papel === p[0]) + '">' + p[1] + "</button>"; }).join("") + "</div>" +
      '<div class="aviso atencao" id="pfErro" role="alert" hidden></div><div class="acoes"><button type="button" class="bt bt-principal bt-grande" id="btPerfil">Continuar</button></div></section>';
    tela(h, true);
    cada("[data-papel]", function (b) { b.addEventListener("click", function () { acesso.papel = b.getAttribute("data-papel"); cada("[data-papel]", function (x) { x.setAttribute("aria-pressed", String(x === b)); }); }); });
    document.getElementById("btPerfil").addEventListener("click", async function () {
      var bt = this, er = document.getElementById("pfErro"); er.hidden = true;
      ocupado(bt, true, "Salvando…");
      try { conta = await N.perfil(document.getElementById("pfNome").value, acesso.papel); guardarConta(); botaoConta(); location.hash = "#/"; }
      catch (e) { er.textContent = e.message; er.hidden = false; ocupado(bt, false); }
    });
  }
  function telaConta() {
    var c = conta || {}, papel = (PAPEIS.filter(function (p) { return p[0] === c.papel; })[0] || [null, "—"])[1], meta = N.lerMeta(eu.uid);
    var h = '<p class="voltar"><a class="bt bt-texto" href="#/">‹ Seus jogos</a></p><h1>Minha conta</h1>' +
      '<section class="cartao"><p class="olho">Conta</p><p style="margin:0"><b>' + esc(c.nome || eu.nome || "Sem nome") + "</b> · " + esc(papel) + '</p><p class="nota">' + esc(eu.email) + "</p>" +
      '<p class="nota">Plano: <b>' + (c.plano === "plus" ? "Scout Plus" : "Grátis") + "</b>" + (c.plano === "plus" && c.plusAte ? " até " + esc(dataBR(c.plusAte)) : "") + ' · <a href="#/plus">' + (c.plano === "plus" ? "ver o plano" : "conhecer o Scout Plus") + "</a></p>" +
      '<p class="nota" data-estado-nuvem>' + (navigator.onLine === false ? "Sem internet agora: os jogos vão para a nuvem quando o sinal voltar." : meta.ultima ? "Jogos guardados na nuvem. Última sincronização: " + new Date(meta.ultima).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) + "." : "Sincronizando os jogos com a nuvem…") + "</p>" +
      '<div class="acoes"><button type="button" class="bt bt-pq" id="btSync">Sincronizar agora</button><a class="bt bt-pq" href="#/perfil">Mudar nome ou papel</a><button type="button" class="bt bt-pq bt-perigo" id="btSair">Sair da conta</button></div></section>' +
      '<section class="cartao"><h2>Cópia dos jogos</h2><p class="nota">Os jogos já ficam na sua conta. Se quiser guardar um arquivo seu também (ou levar para outra conta), faça uma cópia.</p>' +
      '<div class="acoes"><button type="button" class="bt bt-pq" id="btCopia"' + (st.jogos.length ? "" : " disabled") + '>Fazer cópia</button><label class="bt bt-pq" for="arqCopia">Carregar uma cópia</label><input type="file" id="arqCopia" accept=".json,application/json" hidden></div></section>' +
      '<p class="rodape">O nome do adversário e as anotações ficam só na sua conta. O link ao vivo da família mostra só o primeiro nome do atleta e os números.</p>';
    tela(h, true);
    document.getElementById("btSync").addEventListener("click", async function () { var bt = this; ocupado(bt, true, "Sincronizando…"); await sincronizarAgora(); toast(estadoNuvem ? "Não deu agora: " + estadoNuvem + "." : "Tudo sincronizado."); telaConta(); });
    document.getElementById("btSair").addEventListener("click", function () { N.sair(); });
    var bt = document.getElementById("btCopia"); if (bt) bt.addEventListener("click", fazerCopia);
    document.getElementById("arqCopia").addEventListener("change", carregarCopia);
  }

  /* ══ Início ══ */
  function linhaHtml(j) {
    var l = D.linhaJogo(M, st, j);
    var tag = !l.fim ? '<span class="tag a">em andamento</span>' : l.venceu === true ? '<span class="tag v">venceu</span>' : l.venceu === false ? '<span class="tag p">perdeu</span>' : '<span class="tag a">encerrado</span>';
    return '<li><a class="jogo-l" href="#/jogo/' + esc(l.id) + '"><strong>' + esc(primeiroNome(l.atleta)) + (l.torneio ? " · " + esc(l.torneio) : "") + " " + tag + '</strong><span class="pct" aria-label="' + l.pct + ' por cento dos pontos ganhos">' + (l.n ? l.pct + "%" : "—") + '</span>' +
      '<span class="q">' + esc(l.resultado || "sem games ainda") + '</span><span class="d">' + esc(dataCurta(l.data)) + " · " + l.n + (l.n === 1 ? " ponto" : " pontos") + "</span></a></li>";
  }
  function telaInicio() {
    var jogos = D.historico(st), andamento = jogos.filter(function (j) { return !D.encerrado(M, j); });
    var atual = (st.atual && D.jogo(st, st.atual) && !D.encerrado(M, D.jogo(st, st.atual))) ? D.jogo(st, st.atual) : andamento[0];
    var nome = primeiroNome((conta && conta.nome) || eu.nome || "");
    var h = "<h1>" + (nome && nome !== "Atleta" ? "Olá, " + esc(nome) : "Seus jogos") + '</h1><p class="sub">Marque o jogo ponto a ponto. Funciona sem internet e fica guardado na sua conta.</p>';
    if (atual) {
      var a = D.atleta(st, atual.atletaId), pl = D.placar(M, atual);
      h += '<a class="andamento" href="#/jogo/' + esc(atual.id) + '" data-andamento><p class="olho">Jogo em andamento</p><b>' + esc(primeiroNome(a && a.nome)) + " · " + esc(M.rotuloPontos(pl)) + "</b><span>" + (D.textoSets(pl) ? "Games " + esc(D.textoSets(pl)) + " · " : "") + "toque para continuar marcando</span></a>";
    }
    h += '<div class="acoes"><a class="bt bt-principal bt-grande" href="#/novo" data-novo>+ Marcar um jogo</a></div>';
    if (!jogos.length) {
      h += '<section class="cartao vazio"><b>Nenhum jogo marcado ainda</b>Leva menos de um minuto para começar.<ol class="passos" style="text-align:left"><li>Escolha o atleta e o formato do jogo.</li><li>A cada ponto, toque em como terminou e em que bola.</li><li>Abra o link ao vivo para a família acompanhar de onde estiver.</li><li>No fim, veja os números do jogo e compare com os anteriores.</li></ol></section>';
    } else {
      h += '<section class="secao"><h2>Jogos</h2><ul class="lista">' + jogos.slice(0, 60).map(linhaHtml).join("") + "</ul>" + (jogos.length > 60 ? '<p class="nota">Mostrando os 60 mais recentes. Os outros estão na página de cada atleta.</p>' : "") + "</section>";
      h += '<section class="secao"><h2>Atletas</h2><p class="nota">Toque para ver a evolução jogo a jogo.</p><div class="atletas">' + st.atletas.map(function (x) {
        var n = st.jogos.filter(function (j) { return j.atletaId === x.id; }).length;
        return '<a href="#/atleta/' + esc(x.id) + '">' + esc(x.nome) + " <small>" + n + (n === 1 ? " jogo" : " jogos") + "</small></a>";
      }).join("") + "</div></section>";
    }
    h += (salvoOk ? "" : '<div class="aviso atencao">Este navegador não está deixando salvar no celular (memória cheia ou navegação privada). Abra em uma janela normal.</div>') +
      '<p class="rodape">QuadraLab Scout · o nome do adversário e as anotações ficam só na sua conta.</p>';
    tela(h, true);
  }
  function fazerCopia() {
    var nome = "quadralab-scout-" + D.hojeLocal() + ".json";
    try {
      var url = URL.createObjectURL(new Blob([D.exportar(st)], { type: "application/json" }));
      var a = document.createElement("a"); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      toast("Cópia salva: " + nome + ".");
    } catch (e) { toast("Não consegui gerar a cópia neste navegador."); }
  }
  function carregarCopia(ev) {
    var f = ev.target.files && ev.target.files[0]; if (!f) return;
    if (f.size > 8 * 1024 * 1024) { toast("Arquivo grande demais para ser uma cópia do QuadraLab Scout."); return; }
    var r = new FileReader();
    r.onload = function () {
      var x = D.importar(st, String(r.result || ""));
      if (x.erro) { toast(x.erro); return; }
      if (x.atletas) atletasMudaram();
      salvar();
      toast(x.novos || x.atualizados ? (x.novos + (x.novos === 1 ? " jogo novo" : " jogos novos") + (x.atualizados ? " e " + x.atualizados + " atualizados" : "") + " na conta.") : "Nada novo: os jogos dessa cópia já estavam aqui.");
      telaConta();
    };
    r.onerror = function () { toast("Não consegui ler o arquivo."); };
    r.readAsText(f);
  }

  /* ── escalas mentais (1 a 5), como no scout do treinador ── */
  function escalasHtml(grupo, vals) {
    vals = vals || {};
    return M.ESCALAS_MENTAIS.map(function (e) {
      return '<p class="olho" style="margin-top:12px">' + esc(e[1]) + '</p><div class="chips" role="group" aria-label="' + esc(e[1]) + '">' + [1, 2, 3, 4, 5].map(function (v) {
        return '<button type="button" class="chip chip-n" data-ment="' + grupo + '" data-mk="' + e[0] + '" data-mv="' + v + '" aria-pressed="' + (vals[e[0]] === v) + '">' + v + "</button>";
      }).join("") + "</div>";
    }).join("");
  }
  function ligarEscalas(alvo, depois) {
    cada("[data-ment]", function (b) { b.addEventListener("click", function () { var k = b.getAttribute("data-mk"), v = +b.getAttribute("data-mv"), g = b.getAttribute("data-ment"); alvo[g] = alvo[g] || {}; alvo[g][k] = alvo[g][k] === v ? 0 : v; depois(); }); });
  }

  /* ══ Novo jogo ══ */
  var novo = null;
  function telaNovo() {
    if (!novo) novo = { atletaId: st.atletas.length >= 1 && st.atletas.length >= limiteAtletas() ? st.atletas[0].id : st.atletas.length === 1 ? st.atletas[0].id : null, nome: "", outro: !st.atletas.length, torneio: "", adversario: "", cfg: Object.assign({}, D.CFG_PADRAO), mental: { antes: {} }, mentalAberto: false };
    var c = novo.cfg, sel = novo.atletaId ? D.atleta(st, novo.atletaId) : null, nomeSaque = sel && !novo.outro ? primeiroNome(sel.nome) : (novo.nome ? primeiroNome(novo.nome) : "Atleta");
    function chip(attr, v, rot, on) { return '<button type="button" class="chip" ' + attr + '="' + esc(v) + '" aria-pressed="' + !!on + '">' + rot + "</button>"; }
    var h = '<p class="voltar"><a class="bt bt-texto" href="#/">‹ Seus jogos</a></p><h1>Marcar um jogo</h1><p class="sub">Só o atleta é obrigatório. O resto ajuda a comparar os jogos depois.</p>' +
      '<section class="cartao"><h2>Atleta</h2>' +
      (st.atletas.length ? '<div class="chips" role="group" aria-label="Atleta">' + st.atletas.map(function (a) { return chip("data-atleta", a.id, esc(a.nome), !novo.outro && novo.atletaId === a.id); }).join("") + chip("data-atleta", "+", "+ Outro atleta", novo.outro) + "</div>" : "") +
      (novo.outro && st.atletas.length >= limiteAtletas() ? '<div class="aviso" data-limite-atletas style="margin-top:12px">No plano grátis é 1 atleta por conta. Com o Scout Plus, atletas sem limite (irmãos, alunos, a equipe toda). <a href="#/plus">Conhecer o Scout Plus</a></div>' :
        novo.outro ? '<div class="campo"><label for="nvNome">Nome do atleta</label><input id="nvNome" maxlength="60" autocomplete="off" autocapitalize="words" placeholder="Ex.: Lucas" value="' + esc(novo.nome) + '"></div>' : "") +
      '<div class="campo"><label for="nvTorneio">Torneio <span class="nota">(opcional)</span></label><input id="nvTorneio" maxlength="80" placeholder="Torneio ou jogo-treino" value="' + esc(novo.torneio) + '"></div>' +
      '<div class="campo"><label for="nvAdv">Adversário <span class="nota">(opcional, nunca vai para o link da família)</span></label><input id="nvAdv" maxlength="80" autocomplete="off" value="' + esc(novo.adversario) + '"></div></section>' +
      '<section class="cartao"><h2>Formato</h2><div class="chips" role="group" aria-label="Formato">' + [["3sets", "Melhor de 3 sets"], ["1set", "Set único"], ["4games", "Set a 4 games"], ["tb10", "Match tie-break (10)"], ["tb7", "Só tie-break (7)"]].map(function (f) { return chip("data-formato", f[0], f[1], c.formato === f[0]); }).join("") + "</div>" +
      '<p class="olho" style="margin-top:16px">Quem saca primeiro</p><div class="chips" role="group" aria-label="Quem saca primeiro">' + chip("data-saca", "nos", esc(nomeSaque), c.saca === "nos") + chip("data-saca", "ele", "Adversário", c.saca === "ele") + "</div>" +
      (c.formato === "tb7" || c.formato === "tb10" ? '<p class="nota" style="margin-top:12px">Um único tie-break de ' + (c.formato === "tb10" ? "10" : "7") + " pontos, com 2 de diferença.</p>" :
        '<p class="olho" style="margin-top:16px">Pontuação</p><div class="chips">' + chip("data-tog", "semVantagem", "Sem vantagem (ponto decisivo no 40-40)", c.semVantagem) + (c.formato === "3sets" ? chip("data-tog", "superTiebreakDecisivo", "Super tie-break no 3º set", c.superTiebreakDecisivo) : "") + "</div>") +
      '</section><details class="cartao det" id="detMentalAntes"' + (novo.mentalAberto ? " open" : "") + '><summary>Como o atleta chega (opcional)</summary><p class="nota">De 1 (muito baixo) a 5 (muito alto). Depois do jogo dá para comparar com como ele terminou.</p>' + escalasHtml("antes", novo.mental.antes) + "</details>" +
      '<div class="aviso atencao" id="nvErro" role="alert" hidden></div><div class="acoes"><button type="button" class="bt bt-principal bt-grande" id="btComecar">Começar o jogo</button></div>';
    tela(h);
    function lerCampos() { var n = document.getElementById("nvNome"); if (n) novo.nome = n.value; novo.torneio = document.getElementById("nvTorneio").value; novo.adversario = document.getElementById("nvAdv").value; }
    cada("[data-atleta]", function (b) { b.addEventListener("click", function () { lerCampos(); var v = b.getAttribute("data-atleta"); if (v === "+") { novo.outro = true; novo.atletaId = null; } else { novo.outro = false; novo.atletaId = v; } telaNovo(); var cn = document.getElementById("nvNome"); if (novo.outro && cn) cn.focus(); }); });
    cada("[data-formato]", function (b) { b.addEventListener("click", function () { lerCampos(); c.formato = b.getAttribute("data-formato"); novo.cfg = D.cfgLimpa(c); telaNovo(); }); });
    cada("[data-saca]", function (b) { b.addEventListener("click", function () { lerCampos(); c.saca = b.getAttribute("data-saca"); telaNovo(); }); });
    cada("[data-tog]", function (b) { b.addEventListener("click", function () { lerCampos(); var k = b.getAttribute("data-tog"); c[k] = !c[k]; novo.cfg = D.cfgLimpa(c); telaNovo(); }); });
    var dm = document.getElementById("detMentalAntes"); dm.addEventListener("toggle", function () { novo.mentalAberto = dm.open; });
    ligarEscalas(novo.mental, function () { lerCampos(); telaNovo(); });
    var nm = document.getElementById("nvNome"); if (nm) nm.addEventListener("input", function () { novo.nome = nm.value; });
    document.getElementById("btComecar").addEventListener("click", function () {
      lerCampos();
      var er = document.getElementById("nvErro"), atletaId = novo.atletaId;
      if ((novo.outro || !atletaId) && st.atletas.length >= limiteAtletas()) { er.textContent = "No plano grátis é 1 atleta por conta. Escolha o atleta que já está na conta ou assine o Scout Plus."; er.hidden = false; return; }
      if (novo.outro || !atletaId) { var antes = st.atletas.length, r = D.addAtleta(st, novo.nome); if (r.erro) { er.textContent = r.erro; er.hidden = false; return; } atletaId = r.atleta.id; if (st.atletas.length > antes) atletasMudaram(); }
      var x = D.novoJogo(st, { atletaId: atletaId, torneio: novo.torneio, adversario: novo.adversario, cfg: novo.cfg });
      if (x.erro) { er.textContent = x.erro; er.hidden = false; return; }
      x.jogo.mental.antes = novo.mental.antes || {};
      salvar(); uso("jogo-iniciado"); novo = null;
      location.hash = "#/jogo/" + x.jogo.id;
    });
  }

  /* ══ Marcação ══ */
  var FIM_ROT = [["winner_nos", "Winner de ", true], ["erro_dele", "Erro do adversário", true], ["erro_nos", "Erro de ", false], ["winner_dele", "Winner do adversário", false]];
  var marc = { id: null };
  function telaJogo(id) {
    var j = D.jogo(st, id);
    if (!j) { tela('<p class="voltar"><a class="bt bt-texto" href="#/">‹ Seus jogos</a></p><div class="aviso atencao">Este jogo não está na sua conta. Ele pode ter sido apagado em outro aparelho.</div>', true); return; }
    if (marc.id !== id) marc = { id: id, rasc: null, saquePre: null, detAberto: false, analiseAberta: false, mentalAberto: false, mentalDepois: false, confirmaFim: false, confirmaApagar: false };
    st.atual = D.encerrado(M, j) ? st.atual : id;
    if (D.encerrado(M, j)) { contarFim(j); telaFim(j); return; }
    desenharMarcacao(j, true);
  }
  function anterioresDe(j) { try { return D.anteriores(M, st, j); } catch (e) { return []; } }
  function aoVivoHtml(j, nome) {
    var link = linkDe(j);
    if (!link) return '<section class="cartao" id="cartaoAoVivo"><p class="olho">Link ao vivo para a família</p><p class="nota" style="margin-top:0">Quem abrir o link vê o placar e os números a cada ponto, de qualquer lugar.</p><div class="acoes"><button type="button" class="bt bt-principal bt-pq" id="btAbrirLink">Abrir link ao vivo</button></div></section>';
    var msg = "Acompanhe o jogo de " + nome + " ao vivo no QuadraLab Scout: " + link.url;
    return '<section class="cartao" id="cartaoAoVivo"><p class="olho"><span class="ponto-vivo" aria-hidden="true"></span>Link ao vivo aberto</p><p class="nota" style="margin-top:0">Só o primeiro nome do atleta, o placar e os números. Nunca o adversário nem as anotações.</p>' +
      '<div class="acoes"><a class="bt bt-principal bt-pq" target="_blank" rel="noopener noreferrer" id="lkAoVivoWhats" href="https://wa.me/?text=' + encodeURIComponent(msg) + '">Mandar no WhatsApp</a><button type="button" class="bt bt-pq" id="btCopiarLink" data-url="' + esc(link.url) + '">Copiar link</button><button type="button" class="bt bt-pq bt-perigo" id="btEncerrarLink">Encerrar link</button></div>' +
      '<p class="nota" data-estado-aovivo>' + esc(aoVivoEstado[j.id] || "") + "</p></section>";
  }
  function desenharMarcacao(j, topo) {
    var a = D.atleta(st, j.atletaId), nome = primeiroNome(a && a.nome), pl = D.placar(M, j), sacador = M.quemSaca(pl), meu = sacador === "nos", n = j.pontos.length;
    var gan = j.pontos.filter(function (p) { return p.nos; }).length, ant = anterioresDe(j), r = marc.rasc, gameAtual = M.numeroDoGame(pl);
    var soTb = j.cfg.formato === "tb7" || j.cfg.formato === "tb10", sets = soTb ? "tie-break" : pl.sets.map(function (x) { return x[0] + "-" + x[1]; }).concat([pl.g[0] + "-" + pl.g[1]]).join("  ");
    var h = '<p class="voltar"><a class="bt bt-texto" href="#/">‹ Seus jogos</a></p>' +
      '<section class="placar" aria-label="Placar"><div><p class="l">' + esc((meu ? "Saque de " + nome : "Saque do adversário") + " · " + M.ROTULO_LADO[M.ladoDoSaque(pl)]) + '</p><p class="pts" data-pontos>' + esc(M.rotuloPontos(pl)) + '</p></div><div><p class="l">Games</p><p class="sets" data-sets>' + esc(sets) + "</p></div>" +
      '<p class="quem">' + esc(nome) + " × " + esc(j.adversario || "adversário") + (j.torneio ? " · " + esc(j.torneio) : "") + "</p></section>" +
      (M.ehAdverso(pl) ? '<p class="adverso">PLACAR ADVERSO · este ponto entra na comparação</p>' : "") +
      (AV && n ? AV.faixaAlerta(j.pontos, nome, ant) : "");
    if (!r) {
      h += '<section class="cartao"><p class="olho">' + (meu ? "Saque de " + esc(nome) : "Saque do adversário") + ' (opcional)</p><div class="grade4">' +
        [["1", "1º dentro"], ["2", "2º dentro"], ["ace", meu ? "Ace" : "Ace dele"], ["df", meu ? "Dupla falta" : "Dupla falta dele"]].map(function (x) {
          return '<button type="button" class="bt-saque" data-saq="' + x[0] + '"' + (x[0] === "1" || x[0] === "2" ? ' aria-pressed="' + (marc.saquePre === x[0]) + '"' : "") + ">" + x[1] + "</button>";
        }).join("") + "</div></section>" +
        '<section class="cartao"><p class="olho">Como o ponto terminou</p><div class="grade2">' + FIM_ROT.map(function (o) {
          return '<button type="button" class="bt-fim ' + (o[2] ? "nos" : "ele") + '" data-fim="' + o[0] + '">' + esc(o[1] + (/ $/.test(o[1]) ? nome : "")) + "<small>" + (o[2] ? "ponto de " + esc(nome) : "ponto do adversário") + "</small></button>";
        }).join("") + "</div></section>";
    } else {
      var rot = FIM_ROT.filter(function (o) { return o[0] === r.fim; })[0];
      h += '<section class="cartao rasc' + (r.nos ? "" : " ele") + '"><div class="contagem"><p class="olho" style="margin:0">' + esc(rot[1] + (/ $/.test(rot[1]) ? nome : "")) + '</p><button type="button" class="bt bt-texto bt-pq" id="btTrocar">Trocar</button></div>' +
        '<p class="olho" style="margin-top:10px">Em que bola o ponto terminou</p><div class="grade3">' + [["1-4", "curto"], ["5-9", "médio"], ["10+", "longo"]].map(function (b) { return '<button type="button" class="bt-bola" data-bola="' + b[0] + '">' + b[0] + "<small>" + b[1] + "</small></button>"; }).join("") + "</div>" +
        '<p class="nota">Contando o saque como a 1ª bola. Na dúvida, escolha o mais perto.</p></section>';
    }
    if (n && !r) h += detalhesHtml(j, nome);
    h += '<section class="cartao"><div class="contagem"><span><b>' + n + "</b> " + (n === 1 ? "ponto" : "pontos") + " · " + esc(nome) + " ganhou <b>" + gan + "</b>" + (n ? " (" + Math.round(gan * 100 / n) + "%)" : "") + "</span></div>" +
      (marc.confirmaFim ? '<div class="cartao confirma"><p style="margin:0"><b>Encerrar o jogo agora?</b> Use quando o jogo parou antes do fim (desistência, chuva, tempo).</p><div class="acoes"><button type="button" class="bt bt-principal bt-pq" id="btFimSim">Sim, encerrar</button><button type="button" class="bt bt-pq" id="btFimNao">Continuar marcando</button></div></div>' :
        '<div class="acoes"><button type="button" class="bt bt-pq" id="btDesfazer"' + (n || r ? "" : " disabled") + '>Desfazer</button><button type="button" class="bt bt-pq bt-perigo" id="btEncerrar">Encerrar jogo</button></div>') + "</section>";
    h += aoVivoHtml(j, nome);
    var mg = (j.mental.jogo || {})[gameAtual] || 0;
    h += '<details class="cartao det" id="detMental"' + (marc.mentalAberto ? " open" : "") + '><summary>Mental no game ' + gameAtual + ' (opcional)</summary><p class="nota">Como o atleta está neste game, de 1 a 5.</p><div class="chips">' +
      [1, 2, 3, 4, 5].map(function (v) { return '<button type="button" class="chip chip-n" data-mjogo="' + v + '" aria-pressed="' + (mg === v) + '">' + v + "</button>"; }).join("") + "</div></details>";
    if (AV) h += '<details class="cartao" id="detAnalise"' + (marc.analiseAberta ? " open" : "") + '><summary><b>Análise ao vivo</b> · momento, alertas e game a game</summary>' + (marc.analiseAberta ? AV.painel(j.pontos, { atleta: nome, mental: j.mental, anteriores: ant }) : "") + "</details>";
    h += '<p class="rodape">Salvo no celular a cada ponto e na sua conta quando há internet. Pode fechar e voltar depois.</p>';
    tela(h, topo);
    ligarMarcacao(j, nome);
  }
  function opcoesHtml(lista, campo, atual) { return lista.map(function (x) { return '<button type="button" class="chip" data-det="' + campo + '" data-v="' + esc(x[0]) + '" aria-pressed="' + (atual === x[0]) + '">' + esc(x[1]) + "</button>"; }).join(""); }
  function detalhesHtml(j, nome) {
    var p = j.pontos[j.pontos.length - 1];
    return '<details class="cartao det" id="detPonto"' + (marc.detAberto ? " open" : "") + '><summary>Detalhes do ponto ' + p.n + " (opcional)</summary>" +
      '<p class="nota">Vale para o último ponto marcado. Pule à vontade: o placar e os números principais não dependem disso.</p>' +
      (p.fim === "erro_nos" ? '<p class="olho">O erro foi de</p><div class="chips">' + opcoesHtml([["decisao", "Decisão"], ["execucao", "Execução"]], "causa", p.causa) + "</div>" : "") +
      '<p class="olho">Como foi o ponto</p><div class="chips">' + opcoesHtml(M.SITUACOES, "situacao", p.situacao) + '<button type="button" class="chip" data-detb="rede" aria-pressed="' + !!p.rede + '">Subiu à rede</button></div>' +
      '<p class="olho">Decisão de ' + esc(nome) + '</p><div class="chips">' + opcoesHtml(M.DECISOES, "dec", p.dec) + "</div>" +
      '<p class="olho">Último golpe de ' + esc(nome) + '</p><div class="chips">' + opcoesHtml(M.GOLPES, "golpe", p.golpe) + "</div>" +
      '<p class="olho">Direção</p><div class="chips">' + opcoesHtml(M.DIRECOES, "direcao", p.direcao) + '<button type="button" class="chip" data-detb="corrida" aria-pressed="' + !!p.corrida + '">Na corrida</button></div>' +
      '<p class="olho">Onde foi o último golpe de ' + esc(nome) + '</p><div class="chips">' + opcoesHtml(M.ZONAS, "zona", p.zona) + "</div>" +
      '<p class="olho">Direção do saque</p><div class="chips">' + opcoesHtml(M.DIRECOES_SAQUE, "dirSaque", p.dirSaque) + "</div>" +
      (p.sacador === "ele" && p.saque !== "df" && p.saque !== "ace" ? '<p class="olho">Devolução de ' + esc(nome) + '</p><div class="chips">' + opcoesHtml(M.QUALIDADES_DEVOLUCAO, "qualDev", p.qualDev) + "</div>" : "") +
      "</details>";
  }
  function ligarMarcacao(j, nome) {
    function redesenhar() { desenharMarcacao(j, false); }
    function marcar(p) {
      var r = D.marcarPonto(M, j, p); if (r.erro) { toast(r.erro); return; }
      marc.rasc = null; marc.saquePre = null; salvar();
      agendarAoVivo(j, r.fim);
      if (r.fim) { contarFim(j); telaFim(j, true); return; }
      redesenhar();
    }
    function base(nos, fim) { var pl = D.placar(M, j); return { fim: fim, nos: nos, saque: marc.saquePre, bola: null, causa: null, rede: false, situacao: null, golpe: null, corrida: false, direcao: null, zona: null, dirSaque: null, adverso: M.ehAdverso(pl), sacador: M.quemSaca(pl), lado: M.ladoDoSaque(pl) }; }
    cada("[data-saq]", function (b) {
      b.addEventListener("click", function () {
        var v = b.getAttribute("data-saq");
        if (v === "1" || v === "2") { marc.saquePre = marc.saquePre === v ? null : v; redesenhar(); return; }
        var meu = M.quemSaca(D.placar(M, j)) === "nos", nos = v === "ace" ? meu : !meu;
        var p = base(nos, v === "ace" ? (meu ? "winner_nos" : "winner_dele") : (meu ? "erro_nos" : "erro_dele"));
        p.saque = v; p.bola = "1-4"; p.causa = v === "df" && meu ? "execucao" : null;
        marcar(p);
      });
    });
    cada("[data-fim]", function (b) { b.addEventListener("click", function () { var f = FIM_ROT.filter(function (o) { return o[0] === b.getAttribute("data-fim"); })[0]; marc.rasc = base(f[2], f[0]); redesenhar(); }); });
    var tr = document.getElementById("btTrocar"); if (tr) tr.addEventListener("click", function () { marc.rasc = null; redesenhar(); });
    cada("[data-bola]", function (b) { b.addEventListener("click", function () { var p = marc.rasc; p.bola = b.getAttribute("data-bola"); marcar(p); }); });
    cada("[data-det]", function (b) { b.addEventListener("click", function () { var p = j.pontos[j.pontos.length - 1], k = b.getAttribute("data-det"), v = b.getAttribute("data-v"); p[k] = p[k] === v ? null : v; D.tocar(j); salvar(); agendarAoVivo(j); redesenhar(); }); });
    cada("[data-detb]", function (b) { b.addEventListener("click", function () { var p = j.pontos[j.pontos.length - 1], k = b.getAttribute("data-detb"); p[k] = !p[k]; D.tocar(j); salvar(); agendarAoVivo(j); redesenhar(); }); });
    cada("[data-mjogo]", function (b) { b.addEventListener("click", function () { var g = M.numeroDoGame(D.placar(M, j)), v = +b.getAttribute("data-mjogo"); j.mental.jogo[g] = j.mental.jogo[g] === v ? 0 : v; D.tocar(j); salvar(); agendarAoVivo(j); redesenhar(); }); });
    var dp = document.getElementById("detPonto"); if (dp) dp.addEventListener("toggle", function () { marc.detAberto = dp.open; });
    var dm = document.getElementById("detMental"); if (dm) dm.addEventListener("toggle", function () { marc.mentalAberto = dm.open; });
    var da = document.getElementById("detAnalise"); if (da) da.addEventListener("toggle", function () { var antes = marc.analiseAberta; marc.analiseAberta = da.open; if (da.open && !antes) redesenhar(); });
    var bd = document.getElementById("btDesfazer"); if (bd) bd.addEventListener("click", function () { if (marc.rasc) { marc.rasc = null; redesenhar(); return; } if (D.desfazer(j)) { salvar(); agendarAoVivo(j); toast("Último ponto desfeito."); redesenhar(); } });
    var be = document.getElementById("btEncerrar"); if (be) be.addEventListener("click", function () { marc.confirmaFim = true; redesenhar(); });
    var bn = document.getElementById("btFimNao"); if (bn) bn.addEventListener("click", function () { marc.confirmaFim = false; redesenhar(); });
    var bs = document.getElementById("btFimSim"); if (bs) bs.addEventListener("click", function () { j.fim = true; D.tocar(j); marc.confirmaFim = false; marc.rasc = null; if (st.atual === j.id) delete st.atual; salvar(); agendarAoVivo(j, true); contarFim(j); telaFim(j, true); });
    var ab = document.getElementById("btAbrirLink"); if (ab) ab.addEventListener("click", async function () {
      if (navigator.onLine === false) { toast("Sem internet agora. O link ao vivo precisa de sinal para abrir."); return; }
      ocupado(ab, true, "Abrindo…");
      try { await N.aoVivo(eu.uid, j, D.resumo(M, st, j), false); aoVivoEstado[j.id] = "Ao vivo: a família vê cada ponto."; redesenhar(); toast("Link ao vivo aberto. Mande para a família."); }
      catch (e) { toast(e.message); ocupado(ab, false); }
    });
    var cp = document.getElementById("btCopiarLink"); if (cp) cp.addEventListener("click", function () { copiar(cp.getAttribute("data-url"), "Link copiado. Cole no grupo da família."); });
    var en = document.getElementById("btEncerrarLink"); if (en) en.addEventListener("click", async function () {
      ocupado(en, true, "Encerrando…");
      try { await N.encerrarAoVivo(eu.uid, j.id); delete aoVivoEstado[j.id]; toast("Link encerrado. Quem tinha o link não vê mais o jogo."); redesenhar(); }
      catch (e) { toast(e.message); ocupado(en, false); }
    });
  }

  /* ══ Fim de jogo ══ */
  function telaFim(j, topo) {
    var a = D.atleta(st, j.atletaId), nome = primeiroNome(a && a.nome), pl = D.placar(M, j), r = D.resumo(M, st, j), n = j.pontos.length;
    if (st.atual === j.id) { delete st.atual; salvar(); }
    var titulo = pl.fim ? nome + (pl.vencedor === "nos" ? " venceu" : " perdeu") : "Jogo encerrado antes do fim";
    var cmp = D.comparacao(M, st, j.atletaId, ehPlus() ? 6 : 3), link = linkDe(j);
    var h = '<p class="voltar"><a class="bt bt-texto" href="#/">‹ Seus jogos</a></p>' +
      '<section class="resultado" data-fim-jogo><p class="olho">Fim de jogo' + (j.torneio ? " · " + esc(j.torneio) : "") + " · " + esc(dataBR(j.data)) + "</p><h1>" + esc(titulo) + "</h1>" +
      (r.resultado ? '<p class="placar-f">' + esc(r.resultado) + "</p>" : "") + '<p class="nota">' + n + (n === 1 ? " ponto" : " pontos") + " · " + esc(nome) + " ganhou " + r.ganhos + " (" + r.pctGanhos + "%)" + (j.adversario ? " · contra " + esc(j.adversario) : "") + "</p>" +
      (link ? '<p class="nota">O link ao vivo mostra o resultado final por mais 2 horas.</p>' : "") +
      '<div class="acoes"><button type="button" class="bt bt-principal" id="btCompartilhar">Compartilhar o resultado</button><a class="bt" id="lkWhats" target="_blank" rel="noopener noreferrer" href="https://wa.me/?text=' + encodeURIComponent(D.textoCompartilhar(M, st, j)) + '">Mandar no WhatsApp</a></div></section>';
    if (n && G) h += '<div class="graficos">' + G.topo(r) + G.secoes(r) + "</div>";
    if (r.sinais && r.sinais.length) h += '<section class="cartao"><h2>O que este jogo aponta</h2><p class="nota">Leitura automática pelos números. É ponto de partida para conversar com o treinador, não conclusão.</p>' + r.sinais.map(function (t) { return '<div class="sinal">' + t + "</div>"; }).join("") + "</section>";
    if (cmp.jogos.length >= 2) h += '<section class="cartao"><h2>Comparação com os jogos anteriores</h2>' + tabelaComparacao(cmp) + '<div class="acoes"><a class="bt bt-pq" href="#/atleta/' + esc(j.atletaId) + '">Ver todos os jogos de ' + esc(nome) + '</a>' + (ehPlus() ? '<button type="button" class="bt bt-pq" id="btRelatorioFim">Relatório dos jogos (PDF)</button>' : '<a class="bt bt-pq" href="#/plus">Relatório em PDF · Scout Plus</a>') + "</div></section>";
    else h += '<div class="aviso">Marque mais jogos de ' + esc(nome) + " para ver a comparação jogo a jogo. Um jogo é uma amostra; três na mesma direção já são um sinal.</div>";
    h += '<section class="cartao"><h2>Depois do jogo <span class="nota">(opcional)</span></h2><div class="campo"><label for="fmNivel">Nível do adversário</label><select id="fmNivel"><option value="">Não informar</option>' +
      M.NIVEIS_ADVERSARIO.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (j.nivelAdversario === x[0] ? " selected" : "") + ">" + esc(x[1]) + "</option>"; }).join("") + "</select></div>" +
      '<details class="det" id="detMentalDepois"' + (marc.mentalDepois ? " open" : "") + '><summary>Como o atleta termina (mental, de 1 a 5)</summary>' + escalasHtml("depois", j.mental.depois) + "</details>" +
      '<div class="campo"><label for="fmObs">Anotações <span class="nota">(ficam só na sua conta)</span></label><textarea id="fmObs" maxlength="1200" placeholder="O que funcionou, o que treinar">' + esc(j.observacaoFinal) + "</textarea></div></section>" +
      '<section class="cartao" id="acoesJogo">' + (marc.confirmaApagar ? '<div class="confirma cartao" style="margin-top:0"><p style="margin:0"><b>Apagar este jogo?</b> Ele sai da conta e de todos os aparelhos. Não dá para desfazer.</p><div class="acoes"><button type="button" class="bt bt-pq bt-perigo" id="btApagarSim">Sim, apagar</button><button type="button" class="bt bt-pq" id="btApagarNao">Manter o jogo</button></div></div>' :
        '<div class="acoes"><button type="button" class="bt bt-pq" id="btReabrir">' + (pl.fim ? "Desfazer o último ponto" : "Voltar a marcar") + '</button><a class="bt bt-pq" href="#/novo">+ Marcar outro jogo</a><button type="button" class="bt bt-pq bt-perigo" id="btApagar">Apagar jogo</button></div>') + "</section>" +
      '<p class="rodape">Os números usam as mesmas regras do scout do treinador no QuadraLab.</p>';
    tela(h, topo);
    document.getElementById("btCompartilhar").addEventListener("click", function () {
      var t = D.textoCompartilhar(M, st, j);
      if (navigator.share) { navigator.share({ title: "QuadraLab Scout", text: t }).catch(function () { /* cancelado */ }); return; }
      copiar(t, "Texto copiado. Cole no WhatsApp ou onde quiser.");
    });
    var rf = document.getElementById("btRelatorioFim"); if (rf) rf.addEventListener("click", function () { abrirRelatorio(j.atletaId); });
    document.getElementById("fmNivel").addEventListener("change", function (e) { j.nivelAdversario = e.target.value; D.tocar(j); salvar(); });
    document.getElementById("fmObs").addEventListener("input", function (e) { j.observacaoFinal = e.target.value.slice(0, 1200); D.tocar(j); salvar(); });
    var dd = document.getElementById("detMentalDepois"); dd.addEventListener("toggle", function () { marc.mentalDepois = dd.open; });
    ligarEscalas(j.mental, function () { D.tocar(j); salvar(); var y = window.scrollY; telaFim(j); window.scrollTo(0, y); });
    var re = document.getElementById("btReabrir"); if (re) re.addEventListener("click", function () { if (pl.fim) D.desfazer(j); else { j.fim = false; D.tocar(j); } st.atual = j.id; salvar(); agendarAoVivo(j); desenharMarcacao(j, true); });
    var ap = document.getElementById("btApagar"); if (ap) ap.addEventListener("click", function () { marc.confirmaApagar = true; telaFim(j); document.getElementById("acoesJogo").scrollIntoView({ block: "center" }); });
    var an = document.getElementById("btApagarNao"); if (an) an.addEventListener("click", function () { marc.confirmaApagar = false; telaFim(j); });
    var as = document.getElementById("btApagarSim"); if (as) as.addEventListener("click", function () { D.removerJogo(st, j.id); salvar(true); apagarNaNuvem([j.id]); toast("Jogo apagado."); location.hash = "#/"; });
  }
  function copiar(t, ok) {
    var feito = function () { toast(ok); };
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t).then(feito).catch(function () { toast("Não consegui copiar. Use o botão do WhatsApp."); }); return; }
    toast("Não consegui copiar. Use o botão do WhatsApp.");
  }
  function tabelaComparacao(cmp) {
    var h = '<div class="tab" tabindex="0" role="region" aria-label="Comparação jogo a jogo"><table><thead><tr><th>Medida</th>' + cmp.jogos.map(function (x, i) { return "<th>J" + (i + 1) + "<small>" + esc(dataBR(x.data).slice(0, 5)) + "</small></th>"; }).join("") + "</tr></thead><tbody>";
    cmp.linhas.forEach(function (l) {
      var vs = l.valores.filter(function (v) { return v != null; }), max = Math.max.apply(null, vs), min = Math.min.apply(null, vs), varia = vs.length >= 2 && max !== min;
      h += "<tr><td>" + esc(l.rotulo) + "</td>" + l.valores.map(function (v) {
        var cls = varia && l.maiorMelhor != null && v != null ? ((l.maiorMelhor ? v === max : v === min) ? "melhor" : (l.maiorMelhor ? v === min : v === max) ? "pior" : "") : "";
        return '<td class="' + cls + '">' + (v == null ? "—" : v + l.unidade) + "</td>";
      }).join("") + "</tr>";
    });
    return h + '</tbody></table></div><p class="nota">J1 é o mais antigo. Verde: o melhor jogo da linha; vermelho: o pior.</p>';
  }

  /* ══ Atleta ══ */
  var confirmaAtleta = null;
  function telaAtleta(id) {
    var a = D.atleta(st, id);
    if (!a) { tela('<p class="voltar"><a class="bt bt-texto" href="#/">‹ Seus jogos</a></p><div class="aviso atencao">Atleta não encontrado na sua conta.</div>', true); return; }
    var jogos = D.historico(st, id), linhas = jogos.map(function (j) { return D.linhaJogo(M, st, j); }), fim = linhas.filter(function (l) { return l.fim && l.n; });
    var vit = fim.filter(function (l) { return l.venceu === true; }).length, der = fim.filter(function (l) { return l.venceu === false; }).length;
    var media = fim.length ? Math.round(fim.reduce(function (s, l) { return s + l.pct; }, 0) / fim.length) : null, cmp = D.comparacao(M, st, id, ehPlus() ? 8 : 3);
    var h = '<p class="voltar"><a class="bt bt-texto" href="#/">‹ Seus jogos</a></p><h1>' + esc(a.nome) + '</h1><p class="sub">' + jogos.length + (jogos.length === 1 ? " jogo" : " jogos") + (fim.length ? " · " + vit + (vit === 1 ? " vitória" : " vitórias") + " e " + der + (der === 1 ? " derrota" : " derrotas") + " · média de " + media + "% dos pontos" : "") + "</p>" +
      '<div class="acoes"><a class="bt bt-principal" href="#/novo" data-novo-atleta="' + esc(id) + '">+ Marcar um jogo de ' + esc(primeiroNome(a.nome)) + "</a></div>" +
      '<section class="cartao"><h2>Relatório e análise</h2><p class="nota" style="margin-top:0">O relatório reúne os jogos terminados em um PDF com gráficos de evolução. A análise de movimento filma um golpe e mostra o que ajustar.</p><div class="acoes">' +
        (!ehPlus() ? '<a class="bt bt-pq" href="#/plus" data-relatorio-plus>Relatório em PDF · Scout Plus</a>' : window.QLScoutRelatorio && window.QLScoutRelatorio.jogosDoRelatorio(M, D, st, id).length ? '<button type="button" class="bt bt-pq" id="btRelatorio">Relatório dos jogos (PDF)</button>' : '<span class="nota">O relatório aparece com 1 jogo terminado de pelo menos 10 pontos.</span>') +
        '<a class="bt bt-pq" href="#/movimento/' + esc(id) + '" data-movimento>Análise de movimento</a></div></section>' +
      (cmp.jogos.length >= 2 ? '<section class="cartao"><h2>Evolução jogo a jogo</h2>' + tabelaComparacao(cmp) + (ehPlus() ? "" : '<p class="nota">No grátis, os últimos 3 jogos. <a href="#/plus">Com o Scout Plus, a evolução completa</a>.</p>') + "</section>" : '<div class="aviso">A comparação aparece a partir de 2 jogos terminados.</div>') +
      (jogos.length ? '<section class="secao"><h2>Jogos</h2><ul class="lista">' + jogos.map(linhaHtml).join("") + "</ul></section>" : "") +
      '<section class="cartao"><h2>Nome</h2><div class="campo" style="margin-top:6px"><label for="atNome">Nome do atleta</label><input id="atNome" maxlength="60" value="' + esc(a.nome) + '"></div><div class="acoes"><button type="button" class="bt bt-pq" id="btRenomear">Salvar nome</button>' +
      (confirmaAtleta === id ? '</div><div class="cartao confirma"><p style="margin:0"><b>Apagar ' + esc(a.nome) + " e " + (jogos.length === 1 ? "o jogo" : "os " + jogos.length + " jogos") + '?</b> Sai da conta e de todos os aparelhos. Não dá para desfazer.</p><div class="acoes"><button type="button" class="bt bt-pq bt-perigo" id="btAtApagarSim">Sim, apagar</button><button type="button" class="bt bt-pq" id="btAtApagarNao">Manter</button></div></div>' :
        '<button type="button" class="bt bt-pq bt-perigo" id="btAtApagar">Apagar atleta</button></div>') + "</section>";
    tela(h, true);
    var brl = document.getElementById("btRelatorio"); if (brl) brl.addEventListener("click", function () { abrirRelatorio(id); });
    var nv = q("[data-novo-atleta]"); if (nv) nv.addEventListener("click", function () { novo = { atletaId: id, nome: "", outro: false, torneio: "", adversario: "", cfg: Object.assign({}, D.CFG_PADRAO), mental: { antes: {} }, mentalAberto: false }; });
    document.getElementById("btRenomear").addEventListener("click", function () { var r = D.renomearAtleta(st, id, document.getElementById("atNome").value); if (r.erro) { toast(r.erro); return; } atletasMudaram(); salvar(); toast("Nome salvo."); telaAtleta(id); });
    var ap = document.getElementById("btAtApagar"); if (ap) ap.addEventListener("click", function () { confirmaAtleta = id; telaAtleta(id); });
    var an = document.getElementById("btAtApagarNao"); if (an) an.addEventListener("click", function () { confirmaAtleta = null; telaAtleta(id); });
    var as = document.getElementById("btAtApagarSim"); if (as) as.addEventListener("click", function () {
      var ids = st.jogos.filter(function (j) { return j.atletaId === id; }).map(function (j) { return j.id; }), r = D.removerAtleta(st, id);
      confirmaAtleta = null; atletasMudaram(); salvar(true); apagarNaNuvem(ids);
      toast("Atleta apagado" + (r.jogosApagados ? " com " + r.jogosApagados + (r.jogosApagados === 1 ? " jogo." : " jogos.") : ".")); location.hash = "#/";
    });
  }

  /* ══ Scout Plus ══ */
  function telaPlus() {
    var c = conta || {}, plus = ehPlus();
    var linhas = [["Marcar jogos", "sem limite", "sem limite"], ["Link ao vivo para a família", "✓", "✓"], ["Jogos na nuvem, em vários celulares", "✓", "✓"],
      ["Atletas na conta", "1", "sem limite"], ["Comparação jogo a jogo", "últimos 3 jogos", "evolução completa"], ["Relatório dos jogos em PDF", "—", "✓"],
      ["Análise de movimento", "1 de cada golpe", "sem limite"]];
    var h = '<p class="voltar"><a class="bt bt-texto" href="#/conta">‹ Minha conta</a></p><h1>Scout Plus</h1>' +
      (plus ? '<div class="aviso" data-plus-ativo>Você tem o Scout Plus' + (c.acessoCompleto ? " (acesso completo)." : c.plusAte ? " até " + esc(dataBR(c.plusAte)) + "." : ".") + "</div>" :
        '<p class="sub">Para quem acompanha mais de um atleta e quer a evolução completa, o relatório em PDF e a análise de movimento sem limite.</p>') +
      '<div class="tab" role="region" aria-label="Grátis e Scout Plus" tabindex="0"><table class="planos"><thead><tr><th></th><th>Grátis</th><th>Plus</th></tr></thead><tbody>' +
      linhas.map(function (l) { return "<tr><td>" + esc(l[0]) + "</td><td>" + esc(l[1]) + "</td><td><b>" + esc(l[2]) + "</b></td></tr>"; }).join("") + "</tbody></table></div>" +
      (plus ? "" : '<section class="cartao plus-oferta"><p class="preco"><b>' + PRECO_PLUS + '</b></p><p class="nota" style="margin-top:0">Pagamento pela Eduzz (cartão, Pix ou boleto, conforme o checkout).</p>' +
        '<div class="aviso atencao">Na compra, use o <b>mesmo e-mail da sua conta</b>: ' + esc(eu.email) + ". É por ele que o Plus entra na conta.</div>" +
        '<div class="acoes"><a class="bt bt-principal bt-grande" id="lkAssinar" href="' + CHECKOUT_PLUS + '" target="_blank" rel="noopener noreferrer">Assinar o Scout Plus</a></div>' +
        '<div class="acoes" style="justify-content:center"><button type="button" class="bt bt-texto" id="btJaAssinei">Já assinei: atualizar a conta</button></div>' +
        '<p class="nota">Depois que a Eduzz confirma o pagamento, o Plus entra na conta em alguns minutos. Pix e cartão costumam confirmar na hora; boleto, em até 3 dias úteis.</p></section>') +
      '<p class="rodape">Dúvidas ou cancelamento: fale com a gente pelo WhatsApp (11) 94177-3228.</p>';
    tela(h, true);
    var ja = document.getElementById("btJaAssinei");
    if (ja) ja.addEventListener("click", async function () {
      ocupado(ja, true, "Conferindo…"); await sincronizarAgora();
      if (ehPlus()) { toast("Scout Plus ativo. Obrigado!"); telaPlus(); }
      else { ocupado(ja, false); toast(estadoNuvem ? "Não deu para conferir agora: " + estadoNuvem + "." : "O pagamento ainda não chegou. Tente de novo em alguns minutos."); }
    });
  }

  /* ══ Relatório dos jogos (PDF) ══ */
  function abrirRelatorio(atletaId) {
    if (!ehPlus()) { location.hash = "#/plus"; return; }
    if (!window.QLRelatorioJogos || !window.QLScoutRelatorio) { toast("Não foi possível carregar o relatório. Confira a internet e recarregue a página."); return; }
    var o = window.QLScoutRelatorio.opcoes(M, D, st, atletaId);
    if (!o.jogos.length) { toast("O relatório precisa de pelo menos 1 jogo terminado com 10 pontos."); return; }
    var w = window.open("", "_blank");
    if (!w) { toast("O navegador bloqueou a janela do relatório. Permita janelas novas para este site."); return; }
    var html;
    try { html = window.QLRelatorioJogos.gerar(o); } catch (e) { w.close(); toast("Não foi possível montar o relatório: " + e.message); return; }
    w.document.write(html); w.document.close();
  }

  /* ══ Análise de movimento (o mesmo módulo do app do treinador e do Player; a análise roda no celular e o vídeo não é enviado) ══ */
  var movCarregado = null;
  function carregarMovimento() {
    if (movCarregado) return movCarregado;
    function script(src) { return new Promise(function (ok, falha) { var x = document.createElement("script"); x.src = src; x.onload = ok; x.onerror = function () { falha(new Error("Não foi possível carregar a análise. Confira a internet.")); }; document.head.appendChild(x); }); }
    if (!document.querySelector('link[href="../scout/movimento.css"]')) { var l = document.createElement("link"); l.rel = "stylesheet"; l.href = "../scout/movimento.css"; document.head.appendChild(l); }
    movCarregado = (window.QLBiomec ? Promise.resolve() : script("../scout/movimento-motor.js")).then(function () { return window.QLMovimento ? null : script("../scout/movimento.js"); })
      .catch(function (e) { movCarregado = null; throw e; });
    return movCarregado;
  }
  var NOME_GOLPE = { forehand: "forehand", backhand: "backhand", saque: "saque" };
  function textoCota(c, g) {
    if (!c || c.limite == null) return null;
    return { limite: c.limite, usados: c.usadas, restantes: Math.max(0, c.limite - c.usadas), liberado: c.liberado,
      texto: c.liberado ? "Plano grátis: 1 análise de " + NOME_GOLPE[g] + " por conta. Ela fica salva com o relatório." : "Você já usou a análise grátis de " + NOME_GOLPE[g] + ". Os relatórios continuam aqui; para analisar este golpe de novo, assine o Scout Plus." };
  }
  async function telaMovimento(atletaId) {
    var a = D.atleta(st, atletaId), voltar = '<p class="voltar"><a class="bt bt-texto" href="#/atleta/' + esc(atletaId) + '">‹ ' + esc(a ? primeiroNome(a.nome) : "Atleta") + "</a></p>";
    if (!a) { tela(voltar + '<div class="aviso atencao">Atleta não encontrado na sua conta.</div>', true); return; }
    if (navigator.onLine === false) { tela(voltar + '<div class="aviso atencao">A análise de movimento precisa de internet para abrir e guardar o relatório.</div>', true); return; }
    tela(voltar + '<p class="carregando">Carregando a análise de movimento…</p>', true);
    var d;
    try {
      await sincronizarAgora(); /* o atleta precisa estar na conta antes de guardar a análise */
      var r = await Promise.all([N.api("scout-app-movimento?atleta=" + encodeURIComponent(atletaId)), carregarMovimento()]); d = r[0];
    } catch (e) {
      tela(voltar + '<div class="aviso atencao">' + esc(e.message) + '</div><div class="acoes"><button type="button" class="bt bt-pq" id="btMovDeNovo">Tentar de novo</button></div>', true);
      document.getElementById("btMovDeNovo").addEventListener("click", function () { telaMovimento(atletaId); });
      return;
    }
    if (location.hash !== "#/movimento/" + atletaId) return;
    var cota = d.cota || { plano: "pago", porGolpe: {} }, gratis = cota.plano === "free";
    tela(voltar + "<h1>Análise de movimento</h1>" +
      '<p class="sub">' + esc(a.nome) + ": filme um golpe (forehand, backhand ou saque) e veja o checklist por fase, os pontos fortes e o que treinar. A análise roda no celular: o vídeo não é enviado.</p>" +
      (gratis ? '<div class="aviso" data-mov-gratis>Plano grátis: 1 análise de cada golpe por conta (forehand, backhand e saque). No Scout Plus, sem limite.</div>' : "") +
      '<div id="movArea" style="margin-top:14px"></div>', true);
    var salvando = Promise.resolve(), api = function (corpo) { return N.api("scout-app-movimento", corpo); };
    var arquivo = {
      salvar: function (_al, arq) { return salvando.then(function () { return api({ acao: "relatorio", id: arq.id, relatorio: JSON.stringify(arq) }); }); },
      ler: function (id) { return N.api("scout-app-movimento?id=" + encodeURIComponent(id)).then(function (x) { return x.relatorio; }); },
      salvarClip: function (id, clip) { return salvando.then(function () { return api({ acao: "clip", id: id, clip: JSON.stringify(clip) }); }); },
      lerClip: function (id) { return N.api("scout-app-movimento?clip=" + encodeURIComponent(id)).then(function (x) { return x.clip; }); },
      indice: function () { return Promise.resolve({ itens: d.analises || [], removidos: [] }); },
      registrar: function () { return Promise.resolve(); },
      remover: function () { return Promise.resolve(); },
    };
    var logo = new URL("img/logo-scout-192.png", location.href).href;
    window.QL_MOVIMENTO = window.QLMovimento.montar(document.getElementById("movArea"), {
      atleta: a.nome, alunoId: atletaId, historico: d.analises || [], logo: "img/logo-scout-192.png", logoAbsoluto: logo, arquivo: arquivo,
      modelos: false, publico: "atleta",
      cotaGolpe: function (g) { return textoCota(cota.porGolpe[g], g); },
      aoSalvar: function (reg) {
        salvando = api({ acao: "salvar", atletaId: atletaId, resumo: reg }).then(function (x) { if (x.cota) cota = x.cota; }).catch(function (e) { e.publico = true; throw e; });
        return salvando;
      },
      aoRemover: function (id) { return api({ acao: "remover", id: id }); },
    });
  }

  /* ══ rotas ══ */
  function rota() {
    var partes = (location.hash || "#/").replace(/^#\/?/, "").split("/");
    if (!eu) { telaEntrar(partes[0] === "criar" || partes[0] === "recuperar" ? partes[0] : "entrar"); return; }
    if (partes[0] !== "jogo") { marc.id = null; }
    if (partes[0] === "novo") telaNovo();
    else if (partes[0] === "jogo" && partes[1]) telaJogo(partes[1]);
    else if (partes[0] === "atleta" && partes[1]) { if (confirmaAtleta !== partes[1]) confirmaAtleta = null; telaAtleta(partes[1]); }
    else if (partes[0] === "movimento" && partes[1]) telaMovimento(partes[1]);
    else if (partes[0] === "conta") telaConta();
    else if (partes[0] === "plus") telaPlus();
    else if (partes[0] === "perfil") telaPerfil();
    else { novo = null; telaInicio(); }
  }
  function conexao() { selo(); if (navigator.onLine !== false) { enviarUso(); agendarNuvem(500); } }
  function botaoConta() {
    var b = document.getElementById("btConta"); if (!b) return;
    b.hidden = !eu; if (eu) b.textContent = (primeiroNome((conta && conta.nome) || eu.nome || eu.email).charAt(0) || "?").toUpperCase();
  }

  var contouAbertura = false;
  function aoMudarConta(u) {
    eu = u; conta = null; marc = { id: null }; novo = null;
    if (!u) { st = null; botaoConta(); if (!/^#\/(criar|recuperar|entrar)/.test(location.hash)) location.hash = "#/entrar"; else rota(); return; }
    conta = lerContaGuardada(); carregar(); botaoConta();
    if (!contouAbertura) { contouAbertura = true; uso("abriu"); }
    if (/^#\/(criar|recuperar|entrar)/.test(location.hash) || !location.hash) location.hash = "#/"; else rota();
    sincronizarAgora().then(botaoConta);
  }
  window.addEventListener("hashchange", rota);
  window.addEventListener("online", conexao); window.addEventListener("offline", conexao);
  /* outra aba do app mudou os dados: recarrega para não sobrescrever */
  window.addEventListener("storage", function (e) { if (eu && e.key === chave()) { carregar(); rota(); } });
  if (!N.iniciar(aoMudarConta)) app.innerHTML = '<div class="aviso atencao">Não foi possível carregar a parte da conta. Na primeira vez o app precisa de internet; depois funciona sem sinal.</div>';
  selo();
  if ("serviceWorker" in navigator && !/[?&]sem-sw\b/.test(location.search)) navigator.serviceWorker.register("sw.js").catch(function () { /* sem modo offline */ });
})();
