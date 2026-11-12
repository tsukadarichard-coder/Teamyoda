/* QuadraLab Scout: telas do app (entrar, início, novo jogo, marcação, fim de jogo, atleta, minha conta).
   Dados e contas do jogo em dados.js (QLScoutApp) sobre o motor do scout (QLScoutMotor); conta e nuvem em nuvem.js (QLScoutNuvem);
   análise ao vivo em scout/ao-vivo.js (QLAoVivo); gráficos do resumo em scout/graficos.js (QLScoutGraficos), os mesmos da página da família.
   Relatório dos jogos em PDF em relatorio.js (QLScoutRelatorio, sobre scout/relatorio-jogos.js); tempo de partida em dados.js (do primeiro ponto ao fim, com ajuste à mão).
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
  /* Plano (11/11/2026): grátis com até 3 atletas e todas as funções; a venda do Scout Plus está parada (sem link de compra
     no app) até o preço ser definido. Conta que já tem Plus continua com atletas sem limite: o servidor manda o limite. */
  var LIMITE_PADRAO = 3;
  function ehPlus() { return !!(conta && conta.plano === "plus"); }
  function limiteAtletas() { return (conta && conta.limites && conta.limites.atletas) || LIMITE_PADRAO; }
  function textoLimite() { var n = limiteAtletas(); return "São até " + n + " atletas por conta."; }
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
  function tela(h, topo) { app.innerHTML = h; if (topo) { window.scrollTo(0, 0); try { app.focus({ preventScroll: true }); } catch (e) { /* sem foco */ } } if (window.QLScoutGuia) window.QLScoutGuia.atualizar(); }
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
  function telaEntrar(modo) {
    var criar = modo === "criar", recuperar = modo === "recuperar";
    var h = '<section class="entrar"><h1>' + (criar ? "Criar a sua conta" : recuperar ? "Nova senha" : "Entrar no QuadraLab Scout") + "</h1>" +
      '<p class="sub">' + (criar ? "Grátis. Os seus jogos ficam guardados na conta e aparecem em qualquer celular." : recuperar ? "Digite o e-mail da conta. Mandamos um link para criar a nova senha." : "Marque o jogo ponto a ponto, mande o placar ao vivo para a família e acompanhe a evolução.") + "</p>" +
      '<form class="cartao" id="fAcesso" novalidate>' +
      (criar ? '<div class="campo" style="margin-top:0"><label for="acNome">Seu nome</label><input id="acNome" autocomplete="name" maxlength="60"></div>' : "") +
      '<div class="campo"' + (criar ? "" : ' style="margin-top:0"') + '><label for="acEmail">E-mail</label><input id="acEmail" type="email" inputmode="email" autocomplete="email" maxlength="120"></div>' +
      (recuperar ? "" : '<div class="campo"><label for="acSenha">Senha' + (criar ? ' <span class="nota">(pelo menos 8 caracteres)</span>' : "") + '</label><input id="acSenha" type="password" autocomplete="' + (criar ? "new-password" : "current-password") + '" maxlength="100"></div>') +
      '<div class="aviso atencao" id="acErro" role="alert" hidden></div><div class="aviso" id="acOk" role="status" hidden></div>' +
      '<div class="acoes"><button type="submit" class="bt bt-principal bt-grande" id="btAcesso">' + (criar ? "Criar conta" : recuperar ? "Mandar o link" : "Entrar") + "</button></div></form>" +
      '<div class="acoes" style="justify-content:center">' + (criar || recuperar ? '<a class="bt bt-texto" href="#/entrar">Já tenho conta: entrar</a>' : '<a class="bt bt-texto" href="#/criar">Criar conta grátis</a><a class="bt bt-texto" href="#/recuperar">Esqueci a senha</a>') + "</div>" +
      '<p class="rodape">Quem já tem conta no QuadraLab (Player, Competição ou Treinador) entra com o mesmo e-mail e senha.<br><a href="conheca.html">Conheça o QuadraLab Scout e os planos</a></p></section>';
    tela(h, true);
    document.getElementById("fAcesso").addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var bt = document.getElementById("btAcesso"), er = document.getElementById("acErro"), ok = document.getElementById("acOk");
      if (bt.disabled) return;
      er.hidden = true; ok.hidden = true;
      var email = document.getElementById("acEmail").value.trim(), senha = recuperar ? "" : document.getElementById("acSenha").value, nome = criar ? document.getElementById("acNome").value.trim() : "";
      var falha = criar && !nome ? "Digite o seu nome." : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "Digite um e-mail válido." : !recuperar && !senha ? "Digite a senha." : criar && senha.length < 8 ? "A senha precisa ter pelo menos 8 caracteres." : "";
      if (falha) { er.textContent = falha; er.hidden = false; return; }
      if (navigator.onLine === false) { er.textContent = "Sem internet. Conecte-se para " + (criar ? "criar a conta." : recuperar ? "pedir a nova senha." : "entrar.") + " Depois disso o app funciona sem sinal."; er.hidden = false; return; }
      ocupado(bt, true, criar ? "Criando a conta…" : recuperar ? "Mandando…" : "Entrando…");
      try {
        if (recuperar) { await N.recuperar(email); ok.textContent = "Se houver uma conta com esse e-mail, chega um link para criar a nova senha."; ok.hidden = false; ocupado(bt, false); return; }
        if (criar) await N.criar({ nome: nome, email: email, senha: senha });
        else await N.entrar(email, senha);
        /* onAuthStateChanged segue daqui */
      } catch (e) { er.textContent = e.message; er.hidden = false; ocupado(bt, false); }
    });
  }

  /* ══ Nome da conta e Minha conta ══ */
  function telaPerfil() {
    var h = '<p class="voltar"><a class="bt bt-texto" href="#/conta">‹ Minha conta</a></p><h1>Seu nome</h1><p class="sub">É o nome que aparece no app. O link da família mostra só o nome do atleta.</p><section class="cartao">' +
      '<div class="campo" style="margin-top:0"><label for="pfNome">Seu nome</label><input id="pfNome" maxlength="60" value="' + esc((conta && conta.nome) || eu.nome || "") + '"></div>' +
      '<div class="aviso atencao" id="pfErro" role="alert" hidden></div><div class="acoes"><button type="button" class="bt bt-principal bt-grande" id="btPerfil">Salvar</button></div></section>';
    tela(h, true);
    document.getElementById("btPerfil").addEventListener("click", async function () {
      var bt = this, er = document.getElementById("pfErro"); er.hidden = true;
      ocupado(bt, true, "Salvando…");
      try { conta = await N.perfil(document.getElementById("pfNome").value); guardarConta(); botaoConta(); toast("Nome salvo."); location.hash = "#/conta"; }
      catch (e) { er.textContent = e.message; er.hidden = false; ocupado(bt, false); }
    });
  }
  function telaConta() {
    var c = conta || {}, meta = N.lerMeta(eu.uid);
    var h = '<p class="voltar"><a class="bt bt-texto" href="#/">‹ Seus jogos</a></p><h1>Minha conta</h1>' +
      '<section class="cartao"><p class="olho">Conta</p><p style="margin:0"><b>' + esc(c.nome || eu.nome || "Sem nome") + '</b></p><p class="nota">' + esc(eu.email) + "</p>" +
      '<p class="nota">Plano: <b>' + (c.plano === "plus" ? "Scout Plus" : "Grátis") + "</b>" + (c.plano === "plus" && c.plusAte ? " até " + esc(dataBR(c.plusAte)) : "") + ' · ' + (c.plano === "plus" ? "atletas sem limite" : "até " + limiteAtletas() + " atletas") + ', com todas as funções</p>' +
      '<p class="nota" data-estado-nuvem>' + (navigator.onLine === false ? "Sem internet agora: os jogos vão para a nuvem quando o sinal voltar." : meta.ultima ? "Jogos guardados na nuvem. Última sincronização: " + new Date(meta.ultima).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) + "." : "Sincronizando os jogos com a nuvem…") + "</p>" +
      '<div class="acoes"><button type="button" class="bt bt-pq" id="btSync">Sincronizar agora</button><a class="bt bt-pq" href="#/perfil">Mudar o nome</a><button type="button" class="bt bt-pq" id="btGuia">Ver o guia de novo</button><button type="button" class="bt bt-pq bt-perigo" id="btSair">Sair da conta</button></div></section>' +
      '<section class="cartao"><h2>Cópia dos jogos</h2><p class="nota">Os jogos já ficam na sua conta. Se quiser guardar um arquivo seu também (ou levar para outra conta), faça uma cópia.</p>' +
      '<div class="acoes"><button type="button" class="bt bt-pq" id="btCopia"' + (st.jogos.length ? "" : " disabled") + '>Fazer cópia</button><label class="bt bt-pq" for="arqCopia">Carregar uma cópia</label><input type="file" id="arqCopia" accept=".json,application/json" hidden></div></section>' +
      '<p class="rodape">O nome do adversário e as anotações ficam só na sua conta. O link ao vivo da família mostra só o primeiro nome do atleta e os números.</p>';
    tela(h, true);
    document.getElementById("btSync").addEventListener("click", async function () { var bt = this; ocupado(bt, true, "Sincronizando…"); await sincronizarAgora(); toast(estadoNuvem ? "Não deu agora: " + estadoNuvem + "." : "Tudo sincronizado."); telaConta(); });
    document.getElementById("btSair").addEventListener("click", function () { N.sair(); });
    document.getElementById("btGuia").addEventListener("click", function () { try { localStorage.removeItem("qls:modo"); } catch (e) { /* segue */ } location.hash = "#/"; setTimeout(iniciarGuia, 100); });
    var bt = document.getElementById("btCopia"); if (bt) bt.addEventListener("click", fazerCopia);
    document.getElementById("arqCopia").addEventListener("change", carregarCopia);
  }

  /* ══ Início ══ */
  function linhaHtml(j) {
    var l = D.linhaJogo(M, st, j);
    var tag = !l.fim ? '<span class="tag a">em andamento</span>' : l.venceu === true ? '<span class="tag v">venceu</span>' : l.venceu === false ? '<span class="tag p">perdeu</span>' : '<span class="tag a">encerrado</span>';
    return '<li><a class="jogo-l" href="#/jogo/' + esc(l.id) + '"><strong>' + esc(primeiroNome(l.atleta)) + (l.torneio ? " · " + esc(l.torneio) : "") + " " + tag + '</strong><span class="pct" aria-label="' + l.pct + ' por cento dos pontos ganhos">' + (l.n ? l.pct + "%" : "—") + '</span>' +
      '<span class="q">' + esc(l.resultado || "sem games ainda") + '</span><span class="d">' + esc(dataCurta(l.data)) + " · " + l.n + (l.n === 1 ? " ponto" : " pontos") + (l.duracao ? " · " + esc(l.duracao) : "") + "</span></a></li>";
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
      (st.atletas.length ? '<div class="chips" role="group" aria-label="Atleta" data-tour="atletas">' + st.atletas.map(function (a) { return chip("data-atleta", a.id, esc(a.nome), !novo.outro && novo.atletaId === a.id); }).join("") + chip("data-atleta", "+", "+ Outro atleta", novo.outro) + "</div>" : "") +
      (novo.outro && st.atletas.length >= limiteAtletas() ? '<div class="aviso" data-limite-atletas style="margin-top:12px">' + textoLimite() + ' Escolha um dos atletas acima ou apague um atleta que não acompanha mais.</div>' :
        novo.outro ? '<div class="campo"><label for="nvNome">Nome do atleta</label><input id="nvNome" maxlength="60" autocomplete="off" autocapitalize="words" placeholder="Ex.: Lucas" value="' + esc(novo.nome) + '"></div>' : "") +
      '<div class="campo"><label for="nvTorneio">Torneio <span class="nota">(opcional)</span></label><input id="nvTorneio" maxlength="80" placeholder="Torneio ou jogo-treino" value="' + esc(novo.torneio) + '"></div>' +
      '<div class="campo"><label for="nvAdv">Adversário <span class="nota">(opcional, nunca vai para o link da família)</span></label><input id="nvAdv" maxlength="80" autocomplete="off" value="' + esc(novo.adversario) + '"></div></section>' +
      '<section class="cartao"><h2>Formato</h2><div class="chips" role="group" aria-label="Formato" data-tour="formato">' + [["3sets", "Melhor de 3 sets"], ["1set", "Set único"], ["4games", "Set a 4 games"], ["tb10", "Match tie-break (10)"], ["tb7", "Só tie-break (7)"]].map(function (f) { return chip("data-formato", f[0], f[1], c.formato === f[0]); }).join("") + "</div>" +
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
      if ((novo.outro || !atletaId) && st.atletas.length >= limiteAtletas()) { er.textContent = textoLimite() + " Escolha um atleta que já está na conta."; er.hidden = false; return; }
      if (novo.outro || !atletaId) { var antes = st.atletas.length, r = D.addAtleta(st, novo.nome); if (r.erro) { er.textContent = r.erro; er.hidden = false; return; } atletaId = r.atleta.id; if (st.atletas.length > antes) atletasMudaram(); }
      var x = D.novoJogo(st, { atletaId: atletaId, torneio: novo.torneio, adversario: novo.adversario, cfg: novo.cfg });
      if (x.erro) { er.textContent = x.erro; er.hidden = false; return; }
      x.jogo.mental.antes = novo.mental.antes || {};
      salvar(); uso("jogo-iniciado"); novo = null;
      location.hash = "#/jogo/" + x.jogo.id;
    });
  }

  /* ══ Marcação ══ */
  /* modo completo (padrão, como o "modo detalhado" do scout do treinador): direção do saque antes do ponto e os detalhes antes da bola.
     Modo rápido: só como terminou e a bola; os detalhes ficam para depois, no último ponto. */
  function modoCompleto() { try { return localStorage.getItem("qls:modo") !== "rapido"; } catch (e) { return true; } }
  function trocarModo() { try { localStorage.setItem("qls:modo", modoCompleto() ? "rapido" : "completo"); } catch (e) { /* sem armazenamento */ } }
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
  /* relógio da partida: começa no primeiro ponto; o texto se atualiza sozinho enquanto a tela de marcação está aberta */
  function textoTempo(j) { var s = D.duracaoSeg(j); return s == null ? "Tempo de jogo: começa no primeiro ponto" : "Tempo de jogo: " + D.textoDuracao(s); }
  setInterval(function () {
    var el = app && app.querySelector("[data-tempo]"); if (!el || !st) return;
    var j = D.jogo(st, el.getAttribute("data-tempo")); if (j) el.textContent = textoTempo(j);
  }, 15000);
  function desenharMarcacao(j, topo) {
    var a = D.atleta(st, j.atletaId), nome = primeiroNome(a && a.nome), pl = D.placar(M, j), sacador = M.quemSaca(pl), meu = sacador === "nos", n = j.pontos.length;
    var gan = j.pontos.filter(function (p) { return p.nos; }).length, ant = anterioresDe(j), r = marc.rasc, gameAtual = M.numeroDoGame(pl), completo = modoCompleto();
    var soTb = j.cfg.formato === "tb7" || j.cfg.formato === "tb10", sets = soTb ? "tie-break" : pl.sets.map(function (x) { return x[0] + "-" + x[1]; }).concat([pl.g[0] + "-" + pl.g[1]]).join("  ");
    var h = '<p class="voltar"><a class="bt bt-texto" href="#/">‹ Seus jogos</a></p>' +
      '<section class="placar" aria-label="Placar"><div><p class="l">' + esc((meu ? "Saque de " + nome : "Saque do adversário") + " · " + M.ROTULO_LADO[M.ladoDoSaque(pl)]) + '</p><p class="pts" data-pontos>' + esc(M.rotuloPontos(pl)) + '</p></div><div><p class="l">Games</p><p class="sets" data-sets>' + esc(sets) + "</p></div>" +
      '<p class="quem">' + esc(nome) + " × " + esc(j.adversario || "adversário") + (j.torneio ? " · " + esc(j.torneio) : "") + '</p><p class="tempo" data-tempo="' + esc(j.id) + '">' + esc(textoTempo(j)) + "</p></section>" +
      (M.ehAdverso(pl) ? '<p class="adverso">PLACAR ADVERSO · este ponto entra na comparação</p>' : "") +
      (AV && n ? AV.faixaAlerta(j.pontos, nome, ant) : "");
    if (!r) {
      h += '<section class="cartao" data-tour="saque"><p class="olho">' + (meu ? "Saque de " + esc(nome) : "Saque do adversário") + ' (opcional)</p>' +
        (completo ? '<div class="chips" role="group" aria-label="Direção do saque" style="margin-bottom:8px">' + M.DIRECOES_SAQUE.map(function (x) { return '<button type="button" class="chip" data-dsq="' + esc(x[0]) + '" aria-pressed="' + (marc.dirS === x[0]) + '">' + esc(x[1]) + "</button>"; }).join("") + '<span class="nota" style="align-self:center;margin:0">direção do saque</span></div>' : "") +
        '<div class="grade4">' +
        [["1", "1º dentro"], ["2", "2º dentro"], ["ace", meu ? "Ace" : "Ace dele"], ["df", meu ? "Dupla falta" : "Dupla falta dele"]].map(function (x) {
          return '<button type="button" class="bt-saque" data-saq="' + x[0] + '"' + (x[0] === "1" || x[0] === "2" ? ' aria-pressed="' + (marc.saquePre === x[0]) + '"' : "") + ">" + x[1] + "</button>";
        }).join("") + "</div></section>" +
        '<section class="cartao" data-tour="fim"><p class="olho">Como o ponto terminou</p><div class="grade2">' + FIM_ROT.map(function (o) {
          return '<button type="button" class="bt-fim ' + (o[2] ? "nos" : "ele") + '" data-fim="' + o[0] + '">' + esc(o[1] + (/ $/.test(o[1]) ? nome : "")) + "<small>" + (o[2] ? "ponto de " + esc(nome) : "ponto do adversário") + "</small></button>";
        }).join("") + "</div></section>";
    } else {
      var rot = FIM_ROT.filter(function (o) { return o[0] === r.fim; })[0];
      h += '<section class="cartao rasc' + (r.nos ? "" : " ele") + '"><div class="contagem"><p class="olho" style="margin:0">' + esc(rot[1] + (/ $/.test(rot[1]) ? nome : "")) + '</p><button type="button" class="bt bt-texto bt-pq" id="btTrocar">Trocar</button></div>' +
        (completo ? detalhesRascHtml(r, nome) : "") +
        '<p class="olho" style="margin-top:14px" data-tour="bola-titulo">Em que bola o ponto terminou</p><div class="grade3" data-tour="bola">' + [["1-4", "curto"], ["5-9", "médio"], ["10+", "longo"]].map(function (b) { return '<button type="button" class="bt-bola" data-bola="' + b[0] + '">' + b[0] + "<small>" + b[1] + "</small></button>"; }).join("") + "</div>" +
        '<p class="nota">Contando o saque como a 1ª bola. Na dúvida, escolha o mais perto.</p></section>';
    }
    if (n && !r) h += registradoHtml(j);
    if (n && !r && !completo) h += detalhesHtml(j, nome);
    h += '<section class="cartao" data-tour="contagem"><div class="contagem"><span><b>' + n + "</b> " + (n === 1 ? "ponto" : "pontos") + " · " + esc(nome) + " ganhou <b>" + gan + "</b>" + (n ? " (" + Math.round(gan * 100 / n) + "%)" : "") + "</span></div>" +
      (marc.confirmaFim ? '<div class="cartao confirma"><p style="margin:0"><b>Encerrar o jogo agora?</b> Use quando o jogo parou antes do fim (desistência, chuva, tempo).</p><div class="acoes"><button type="button" class="bt bt-principal bt-pq" id="btFimSim">Sim, encerrar</button><button type="button" class="bt bt-pq" id="btFimNao">Continuar marcando</button></div></div>' :
        '<div class="acoes"><button type="button" class="bt bt-pq" id="btDesfazer"' + (n || r ? "" : " disabled") + '>Desfazer</button><button type="button" class="bt bt-pq" id="btModo" aria-pressed="' + completo + '">' + (completo ? "Modo completo ✓" : "Modo rápido ✓") + '</button><button type="button" class="bt bt-pq bt-perigo" id="btEncerrar">Encerrar jogo</button></div>' +
        '<p class="nota">' + (completo ? "Modo completo: direção do saque e detalhes de cada ponto antes da bola. Toque para trocar pelo rápido." : "Modo rápido: só como terminou e a bola; os detalhes ficam no último ponto. Toque para trocar pelo completo.") + "</p>") + "</section>";
    h += aoVivoHtml(j, nome);
    var mg = (j.mental.jogo || {})[gameAtual] || 0;
    h += '<details class="cartao det" id="detMental"' + (marc.mentalAberto ? " open" : "") + '><summary>Mental no game ' + gameAtual + ' (opcional)</summary><p class="nota">Como o atleta está neste game, de 1 a 5.</p><div class="chips">' +
      [1, 2, 3, 4, 5].map(function (v) { return '<button type="button" class="chip chip-n" data-mjogo="' + v + '" aria-pressed="' + (mg === v) + '">' + v + "</button>"; }).join("") + "</div></details>";
    if (AV) h += '<details class="cartao" id="detAnalise"' + (marc.analiseAberta ? " open" : "") + '><summary><b>Análise ao vivo</b> · momento, alertas e game a game</summary>' + (marc.analiseAberta ? AV.painel(j.pontos, { atleta: nome, mental: j.mental, anteriores: ant }) : "") + "</details>";
    h += '<p class="rodape">Salvo no celular a cada ponto e na sua conta quando há internet. Pode fechar e voltar depois.</p>';
    tela(h, topo);
    ligarMarcacao(j, nome);
  }
  /* detalhes do ponto em andamento (modo completo): tudo opcional, gravado junto quando tocar na bola */
  function opRasc(lista, campo, atual) { return lista.map(function (x) { return '<button type="button" class="chip" data-rd="' + campo + '" data-v="' + esc(x[0]) + '" aria-pressed="' + (atual === x[0]) + '">' + esc(x[1]) + "</button>"; }).join(""); }
  function togRasc(campo, rot, on) { return '<button type="button" class="chip" data-rdb="' + campo + '" aria-pressed="' + !!on + '">' + esc(rot) + "</button>"; }
  function detalhesRascHtml(r, nome) {
    return '<div class="det-rasc" data-tour="detalhes"><p class="nota" style="margin-top:8px">Detalhes do ponto (opcionais). Depois toque na bola.</p>' +
      (r.fim === "erro_nos" ? '<p class="olho">O erro foi de</p><div class="chips">' + opRasc([["decisao", "Decisão"], ["execucao", "Execução"]], "causa", r.causa) + "</div>" : "") +
      '<p class="olho">Como foi o ponto</p><div class="chips">' + opRasc(M.SITUACOES, "situacao", r.situacao) + togRasc("rede", "Subiu à rede", r.rede) + "</div>" +
      '<p class="olho">Decisão de ' + esc(nome) + '</p><div class="chips">' + opRasc(M.DECISOES, "dec", r.dec) + "</div>" +
      (r.sacador === "ele" && r.saque !== "df" && r.saque !== "ace" ? '<p class="olho">Devolução de ' + esc(nome) + '</p><div class="chips">' + opRasc(M.QUALIDADES_DEVOLUCAO, "qualDev", r.qualDev) + "</div>" : "") +
      (r.sacador === "nos" && r.fim === "erro_dele" && r.saque !== "df" && r.saque !== "ace" ? '<div class="chips" style="margin-top:10px">' + togRasc("devAdv", "Erro de devolução do adversário", r.devAdv) + "</div>" : "") +
      '<p class="olho">Último golpe de ' + esc(nome) + ' (vale também quando o ponto foi do adversário)</p><div class="chips">' + opRasc(M.GOLPES, "golpe", r.golpe) + "</div>" +
      '<div class="chips" style="margin-top:8px">' + togRasc("corrida", "Na corrida", r.corrida) + opRasc(M.DIRECOES, "direcao", r.direcao) + "</div>" +
      '<p class="olho">Onde foi o último golpe de ' + esc(nome) + '</p><div class="grade3 zonas">' + opRasc(M.ZONAS, "zona", r.zona) + "</div></div>";
  }
  function registradoHtml(j) {
    var u = j.pontos[j.pontos.length - 1], f = FIM_ROT.filter(function (o) { return o[0] === u.fim; })[0], nome = primeiroNome((D.atleta(st, j.atletaId) || {}).nome);
    var rot = u.saque === "ace" ? (u.nos ? "Ace" : "Ace do adversário") : u.saque === "df" ? (u.nos ? "Dupla falta do adversário" : "Dupla falta") : f ? f[1] + (/ $/.test(f[1]) ? nome : "") : "Ponto";
    return '<div class="registrado" role="status" data-registrado><div><p class="olho" style="margin:0">Ponto ' + u.n + " registrado</p><b>✓ " + esc(rot) + (u.bola ? " · bola " + esc(u.bola) : "") + '</b></div><button type="button" class="bt bt-pq" id="btCorrigir">Corrigir</button></div>';
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
      marc.rasc = null; marc.saquePre = null; marc.dirS = null; salvar();
      agendarAoVivo(j, r.fim);
      if (r.fim) { contarFim(j); telaFim(j, true); return; }
      redesenhar();
    }
    function base(nos, fim) { var pl = D.placar(M, j); return { fim: fim, nos: nos, saque: marc.saquePre, bola: null, causa: null, rede: false, situacao: null, golpe: null, corrida: false, direcao: null, zona: null, dirSaque: marc.dirS || null, qualDev: null, dec: null, devAdv: false, adverso: M.ehAdverso(pl), sacador: M.quemSaca(pl), lado: M.ladoDoSaque(pl) }; }
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
    cada("[data-dsq]", function (b) { b.addEventListener("click", function () { var v = b.getAttribute("data-dsq"); marc.dirS = marc.dirS === v ? null : v; redesenhar(); }); });
    cada("[data-rd]", function (b) { b.addEventListener("click", function () { var k = b.getAttribute("data-rd"), v = b.getAttribute("data-v"); marc.rasc[k] = marc.rasc[k] === v ? null : v; redesenhar(); }); });
    cada("[data-rdb]", function (b) { b.addEventListener("click", function () { var k = b.getAttribute("data-rdb"); marc.rasc[k] = !marc.rasc[k]; redesenhar(); }); });
    var bm = document.getElementById("btModo"); if (bm) bm.addEventListener("click", function () { trocarModo(); toast(modoCompleto() ? "Modo completo: detalhes antes da bola." : "Modo rápido: só como terminou e a bola."); redesenhar(); });
    var bc = document.getElementById("btCorrigir"); if (bc) bc.addEventListener("click", function () { if (D.desfazer(j)) { salvar(); agendarAoVivo(j); toast("Ponto desfeito. Marque de novo."); redesenhar(); } });
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
    var bs = document.getElementById("btFimSim"); if (bs) bs.addEventListener("click", function () { D.encerrar(j); marc.confirmaFim = false; marc.rasc = null; if (st.atual === j.id) delete st.atual; salvar(); agendarAoVivo(j, true); contarFim(j); telaFim(j, true); });
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
    var cmp = D.comparacao(M, st, j.atletaId, 6), link = linkDe(j);
    var h = '<p class="voltar"><a class="bt bt-texto" href="#/">‹ Seus jogos</a></p>' +
      '<section class="resultado" data-fim-jogo><p class="olho">Fim de jogo' + (j.torneio ? " · " + esc(j.torneio) : "") + " · " + esc(dataBR(j.data)) + "</p><h1>" + esc(titulo) + "</h1>" +
      (r.resultado ? '<p class="placar-f">' + esc(r.resultado) + "</p>" : "") + '<p class="nota">' + n + (n === 1 ? " ponto" : " pontos") + " · " + esc(nome) + " ganhou " + r.ganhos + " (" + r.pctGanhos + "%)" + (j.adversario ? " · contra " + esc(j.adversario) : "") + "</p>" +
      (D.duracaoSeg(j) != null ? '<p class="nota" data-duracao><b>Tempo de jogo: ' + esc(D.textoDuracao(D.duracaoSeg(j))) + "</b></p>" : "") +
      (link ? '<p class="nota">O link ao vivo mostra o resultado final por mais 2 horas.</p>' : "") +
      '<div class="acoes"><button type="button" class="bt bt-principal" id="btCompartilhar">Compartilhar o resultado</button><a class="bt" id="lkWhats" target="_blank" rel="noopener noreferrer" href="https://wa.me/?text=' + encodeURIComponent(D.textoCompartilhar(M, st, j)) + '">Mandar no WhatsApp</a></div></section>';
    if (n && G) h += '<div class="graficos">' + G.topo(r) + G.secoes(r) + "</div>";
    if (r.sinais && r.sinais.length) h += '<section class="cartao"><h2>O que este jogo aponta</h2><p class="nota">Leitura automática pelos números. É ponto de partida para conversar com o treinador, não conclusão.</p>' + r.sinais.map(function (t) { return '<div class="sinal">' + t + "</div>"; }).join("") + "</section>";
    if (cmp.jogos.length >= 2) h += '<section class="cartao"><h2>Comparação com os jogos anteriores</h2>' + tabelaComparacao(cmp) + '<div class="acoes"><a class="bt bt-pq" href="#/atleta/' + esc(j.atletaId) + '">Ver todos os jogos de ' + esc(nome) + '</a>' + '<button type="button" class="bt bt-pq" id="btRelatorioFim">Relatório dos jogos (PDF)</button>' + "</div></section>";
    else h += '<div class="aviso">Marque mais jogos de ' + esc(nome) + " para ver a comparação jogo a jogo. Um jogo é uma amostra; três na mesma direção já são um sinal.</div>";
    h += '<section class="cartao"><h2>Depois do jogo <span class="nota">(opcional)</span></h2><div class="campo"><label for="fmNivel">Nível do adversário</label><select id="fmNivel"><option value="">Não informar</option>' +
      M.NIVEIS_ADVERSARIO.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (j.nivelAdversario === x[0] ? " selected" : "") + ">" + esc(x[1]) + "</option>"; }).join("") + "</select></div>" +
      '<div class="campo"><label for="fmDuracao">Tempo de jogo, em minutos <span class="nota">(o app conta do primeiro ponto ao fim; ajuste se houve pausa ou se começou a marcar depois)</span></label><input id="fmDuracao" type="number" inputmode="numeric" min="1" max="720" style="max-width:140px" value="' + (D.duracaoMin(j) || "") + '"></div>' +
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
    document.getElementById("fmDuracao").addEventListener("change", function (e) {
      D.definirDuracao(j, e.target.value); salvar();
      var d = q("[data-duracao]"), s2 = D.duracaoSeg(j);
      if (d && s2 != null) d.innerHTML = "<b>Tempo de jogo: " + esc(D.textoDuracao(s2)) + "</b>";
      if (!e.target.value) e.target.value = D.duracaoMin(j) || "";
      toast(s2 != null ? "Tempo de jogo: " + D.textoDuracao(s2) + "." : "Tempo de jogo apagado.");
    });
    document.getElementById("fmObs").addEventListener("input", function (e) { j.observacaoFinal = e.target.value.slice(0, 1200); D.tocar(j); salvar(); });
    var dd = document.getElementById("detMentalDepois"); dd.addEventListener("toggle", function () { marc.mentalDepois = dd.open; });
    ligarEscalas(j.mental, function () { D.tocar(j); salvar(); var y = window.scrollY; telaFim(j); window.scrollTo(0, y); });
    var re = document.getElementById("btReabrir"); if (re) re.addEventListener("click", function () { if (pl.fim) D.desfazer(j); else D.reabrir(j); st.atual = j.id; salvar(); agendarAoVivo(j); desenharMarcacao(j, true); });
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
    var media = fim.length ? Math.round(fim.reduce(function (s, l) { return s + l.pct; }, 0) / fim.length) : null, cmp = D.comparacao(M, st, id, 8);
    var h = '<p class="voltar"><a class="bt bt-texto" href="#/">‹ Seus jogos</a></p><h1>' + esc(a.nome) + '</h1><p class="sub">' + jogos.length + (jogos.length === 1 ? " jogo" : " jogos") + (fim.length ? " · " + vit + (vit === 1 ? " vitória" : " vitórias") + " e " + der + (der === 1 ? " derrota" : " derrotas") + " · média de " + media + "% dos pontos" : "") + "</p>" +
      '<div class="acoes"><a class="bt bt-principal" href="#/novo" data-novo-atleta="' + esc(id) + '">+ Marcar um jogo de ' + esc(primeiroNome(a.nome)) + "</a></div>" +
      '<section class="cartao"><h2>Relatório dos jogos</h2><p class="nota" style="margin-top:0">Reúne os jogos terminados em um PDF com gráficos de evolução.</p><div class="acoes">' +
        (window.QLScoutRelatorio && window.QLScoutRelatorio.jogosDoRelatorio(M, D, st, id).length ? '<button type="button" class="bt bt-pq" id="btRelatorio">Relatório dos jogos (PDF)</button>' : '<span class="nota">O relatório aparece com 1 jogo terminado de pelo menos 10 pontos.</span>') + "</div></section>" +
      (cmp.jogos.length >= 2 ? '<section class="cartao"><h2>Evolução jogo a jogo</h2>' + tabelaComparacao(cmp) + "</section>" : '<div class="aviso">A comparação aparece a partir de 2 jogos terminados.</div>') +
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

  /* ══ Plano (a venda do Scout Plus está parada: nada de preço nem link de compra aqui) ══ */
  function telaPlus() {
    var c = conta || {}, plus = ehPlus();
    var h = '<p class="voltar"><a class="bt bt-texto" href="#/conta">‹ Minha conta</a></p><h1>Seu plano</h1>' +
      (plus ? '<div class="aviso" data-plus-ativo>Você tem o Scout Plus' + (c.acessoCompleto ? " (acesso completo)." : c.plusAte ? " até " + esc(dataBR(c.plusAte)) + "." : ".") + " Atletas sem limite.</div>" : "") +
      '<section class="cartao" data-plano-gratis><p class="olho">Grátis</p><ul style="margin:6px 0 0;padding-left:18px"><li>Até ' + LIMITE_PADRAO + ' atletas na conta</li><li>Jogos sem limite, com o tempo de cada partida</li><li>Link ao vivo para a família</li>' +
      "<li>Comparação e evolução jogo a jogo, completas</li><li>Relatório dos jogos em PDF</li><li>Jogos na nuvem, em vários celulares</li></ul></section>" +
      '<p class="rodape">Dúvidas: fale com a gente pelo WhatsApp (11) 94177-3228.</p>';
    tela(h, true);
  }

  /* ══ Relatório dos jogos (PDF) ══ */
  function abrirRelatorio(atletaId) {
    if (!window.QLRelatorioJogos || !window.QLScoutRelatorio) { toast("Não foi possível carregar o relatório. Confira a internet e recarregue a página."); return; }
    var o = window.QLScoutRelatorio.opcoes(M, D, st, atletaId);
    if (!o.jogos.length) { toast("O relatório precisa de pelo menos 1 jogo terminado com 10 pontos."); return; }
    var w = window.open("", "_blank");
    if (!w) { toast("O navegador bloqueou a janela do relatório. Permita janelas novas para este site."); return; }
    var html;
    try { html = window.QLRelatorioJogos.gerar(o); } catch (e) { w.close(); toast("Não foi possível montar o relatório: " + e.message); return; }
    w.document.write(html); w.document.close();
  }

  /* ══ rotas ══ */
  function navBaixo() {
    var nav = document.getElementById("navBaixo"); if (!nav) return;
    var aba = /^#\/(conta|plus|perfil)/.test(location.hash) ? "conta" : "jogos";
    nav.hidden = !eu; document.body.classList.toggle("com-nav", !!eu);
    Array.prototype.forEach.call(nav.querySelectorAll("a"), function (x) { if (x.getAttribute("data-aba") === aba) x.setAttribute("aria-current", "page"); else x.removeAttribute("aria-current"); });
  }
  function rota() {
    navBaixo();
    var partes = (location.hash || "#/").replace(/^#\/?/, "").split("/");
    if (!eu) { telaEntrar(partes[0] === "criar" || partes[0] === "recuperar" ? partes[0] : "entrar"); return; }
    if (partes[0] !== "jogo") { marc.id = null; }
    if (partes[0] === "novo") telaNovo();
    else if (partes[0] === "jogo" && partes[1]) telaJogo(partes[1]);
    else if (partes[0] === "atleta" && partes[1]) { if (confirmaAtleta !== partes[1]) confirmaAtleta = null; telaAtleta(partes[1]); }
    else if (partes[0] === "movimento") { location.hash = "#/"; return; } // a análise de movimento saiu do app: link antigo cai nos jogos
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

  /* ══ Guia do primeiro acesso ══ */
  var GUIA = "qls:guia:";
  function passosDoGuia() {
    var NOVO = /^#\/novo/, JOGO = /^#\/jogo\//;
    return [
      { rota: /^#\/?$/, alvo: "[data-novo]", acao: "toque", titulo: "Bem-vindo ao QuadraLab Scout!", texto: "Vamos marcar o primeiro ponto juntos. Comece tocando em Marcar um jogo." },
      { rota: NOVO, alvo: "#nvNome", acao: "digitar", opcional: true, texto: "Digite o nome do atleta que você vai acompanhar.", botao: "Pronto", erro: "Digite o nome do atleta.",
        validar: function () { var c = document.getElementById("nvNome"); return !!(c && c.value.trim().length >= 2); } },
      { rota: NOVO, alvo: "[data-tour=\"atletas\"]", acao: "ok", opcional: true, texto: "Aqui você escolhe o atleta. Já deixamos marcado o que está na sua conta." },
      { rota: NOVO, alvo: "[data-tour=\"formato\"]", acao: "toque", texto: "Escolha o formato do jogo. Melhor de 3 sets é o mais comum em torneio." },
      { rota: NOVO, alvo: "#btComecar", acao: "toque", texto: "Tudo pronto. Toque em Começar o jogo." },
      { rota: JOGO, alvo: ".placar", acao: "ok", texto: "Este é o placar. Pontos, games, sets, quem saca e de que lado: o app conta tudo sozinho." },
      { rota: JOGO, alvo: "[data-tour=\"saque\"]", acao: "ok", texto: "Antes do ponto, se quiser, marque o saque: a direção, 1º ou 2º dentro, ace ou dupla falta. É opcional." },
      { rota: JOGO, alvo: "[data-tour=\"fim\"]", acao: "toque", texto: "O ponto acabou? Toque em como ele terminou. Azul é ponto do atleta; laranja, do adversário. Experimente agora." },
      { rota: JOGO, alvo: "[data-tour=\"detalhes\"]", acao: "ok", opcional: true, texto: "Estes são os detalhes do ponto: tipo de jogada, decisão, golpe, direção e onde na quadra. Tudo opcional. Quanto mais você marca, mais completo fica o relatório." },
      { rota: JOGO, alvo: "[data-tour=\"bola\"]", acao: "toque", texto: "Por último: em que bola o ponto terminou? Contando o saque como a 1ª bola." },
      { rota: JOGO, alvo: "[data-registrado]", acao: "ok", texto: "Ponto registrado! Marcou errado? Toque em Corrigir e o ponto volta." },
      { rota: JOGO, alvo: "#btModo", acao: "ok", texto: "Você está no modo completo. Com pressa? Troque aqui pelo modo rápido: só como terminou e a bola." },
      { rota: JOGO, alvo: "#cartaoAoVivo", acao: "ok", texto: "Quer que a família acompanhe de longe? Abra o link ao vivo e mande no WhatsApp. Eles veem cada ponto." },
      { rota: JOGO, alvo: "#navBaixo [data-aba=\"jogos\"]", acao: "ok", texto: "Em Jogos ficam todos os jogos e a evolução de cada atleta. Agora é com você: continue marcando. Bom jogo!", botao: "Concluir" },
    ];
  }
  function iniciarGuia() {
    if (!window.QLScoutGuia || !eu) return;
    var uid = eu.uid;
    window.QLScoutGuia.iniciar({ passos: passosDoGuia(), aoFim: function (concluiu) {
      try { localStorage.setItem(GUIA + uid, concluiu ? "feito" : "pulado"); } catch (e) { /* sem armazenamento */ }
      toast(concluiu ? "Guia concluído. Para ver de novo: Conta › Ver o guia de novo." : "Guia fechado. Para ver de novo: Conta › Ver o guia de novo.");
    } });
  }
  function guiaPendente() { try { return !localStorage.getItem(GUIA + eu.uid); } catch (e) { return false; } }

  var contouAbertura = false;
  function aoMudarConta(u) {
    /* a entrada do app (index.html) usa esta marca: com conta entrada abre os jogos; sem conta, a página de apresentação */
    try { localStorage.setItem("qls:sessao", u ? "1" : "0"); } catch (e) { /* sem armazenamento */ }
    eu = u; conta = null; marc = { id: null }; novo = null;
    if (!u) { if (window.QLScoutGuia && window.QLScoutGuia.ativo()) window.QLScoutGuia.terminar(false); st = null; botaoConta(); if (!/^#\/(criar|recuperar|entrar)/.test(location.hash)) location.hash = "#/entrar"; else rota(); return; }
    conta = lerContaGuardada(); carregar(); botaoConta();
    if (!contouAbertura) { contouAbertura = true; uso("abriu"); }
    if (/^#\/(criar|recuperar|entrar)/.test(location.hash) || !location.hash) location.hash = "#/"; else rota();
    sincronizarAgora().then(function () { botaoConta(); if (eu && guiaPendente() && !st.jogos.length && (!location.hash || location.hash === "#/")) iniciarGuia(); });
  }
  window.addEventListener("hashchange", rota);
  window.addEventListener("hashchange", function () { if (window.QLScoutGuia) window.QLScoutGuia.atualizar(); });
  window.addEventListener("online", conexao); window.addEventListener("offline", conexao);
  /* outra aba do app mudou os dados: recarrega para não sobrescrever */
  window.addEventListener("storage", function (e) { if (eu && e.key === chave()) { carregar(); rota(); } });
  if (!N.iniciar(aoMudarConta)) app.innerHTML = '<div class="aviso atencao">Não foi possível carregar a parte da conta. Na primeira vez o app precisa de internet; depois funciona sem sinal.</div>';
  selo();
  if ("serviceWorker" in navigator && !/[?&]sem-sw\b/.test(location.search)) navigator.serviceWorker.register("sw.js").catch(function () { /* sem modo offline */ });
})();
