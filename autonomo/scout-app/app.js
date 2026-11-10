/* QuadraLab Scout: telas do app (início, novo jogo, marcação, fim de jogo, atleta, cópia).
   Dados e contas em dados.js (QLScoutApp) sobre o motor do scout (QLScoutMotor); análise ao vivo em scout/ao-vivo.js (QLAoVivo);
   gráficos do resumo em scout/graficos.js (QLScoutGraficos), os mesmos da página da família.
   Tudo fica no aparelho (localStorage). Para o servidor vai só a contagem anônima de uso (scout-app-uso). */
(function () {
  "use strict";
  var M = window.QLScoutMotor, D = window.QLScoutApp, AV = window.QLAoVivo, G = window.QLScoutGraficos;
  var app = document.getElementById("app");
  if (!M || !D) { app.innerHTML = '<div class="aviso atencao">Não foi possível abrir o app. Confira a internet e recarregue a página.</div>'; return; }

  var st, salvoOk = true;
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function carregar() {
    var bruto = null;
    try { bruto = JSON.parse(localStorage.getItem(D.CHAVE) || "null"); } catch (e) { salvoOk = false; }
    st = D.normalizar(bruto);
    if (!bruto) salvar();
  }
  function salvar() {
    try { localStorage.setItem(D.CHAVE, JSON.stringify(st)); salvoOk = true; }
    catch (e) { if (salvoOk) toast("Não consegui salvar neste celular (memória cheia ou navegação privada). Os pontos podem se perder ao fechar."); salvoOk = false; }
  }
  var tmrToast = null;
  function toast(t) { var el = document.getElementById("toast"); el.textContent = t; el.hidden = false; clearTimeout(tmrToast); tmrToast = setTimeout(function () { el.hidden = true; }, 3800); }
  function dataBR(d) { var p = String(d || "").split("-"); return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : ""; }
  function dataCurta(d) { return d === D.hojeLocal() ? "hoje" : dataBR(d).slice(0, 5); }
  function primeiroNome(n) { return String(n || "Atleta").trim().split(/\s+/)[0]; }
  function q(sel) { return app.querySelector(sel); }
  function cada(sel, f) { Array.prototype.forEach.call(app.querySelectorAll(sel), f); }
  function tela(h, topo) { app.innerHTML = h; if (topo) { window.scrollTo(0, 0); try { app.focus({ preventScroll: true }); } catch (e) { /* sem foco */ } } }

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
    var h = '<h1>Seus jogos</h1><p class="sub">Marque o jogo de tênis ponto a ponto. Funciona sem conta e sem internet: tudo fica neste celular.</p>';
    if (atual) {
      var a = D.atleta(st, atual.atletaId), pl = D.placar(M, atual);
      h += '<a class="andamento" href="#/jogo/' + esc(atual.id) + '" data-andamento><p class="olho">Jogo em andamento</p><b>' + esc(primeiroNome(a && a.nome)) + " · " + esc(M.rotuloPontos(pl)) + "</b><span>" + (D.textoSets(pl) ? "Games " + esc(D.textoSets(pl)) + " · " : "") + "toque para continuar marcando</span></a>";
    }
    h += '<div class="acoes"><a class="bt bt-principal bt-grande" href="#/novo" data-novo>+ Marcar um jogo</a></div>';
    if (!jogos.length) {
      h += '<section class="cartao vazio"><b>Nenhum jogo marcado ainda</b>Leva menos de um minuto para começar.<ol class="passos" style="text-align:left"><li>Escolha o atleta e o formato do jogo.</li><li>A cada ponto, toque em como terminou e em que bola.</li><li>No fim, veja os números do jogo e compartilhe o resultado.</li></ol></section>';
    } else {
      h += '<section class="secao"><h2>Jogos</h2><ul class="lista">' + jogos.slice(0, 60).map(linhaHtml).join("") + "</ul>" + (jogos.length > 60 ? '<p class="nota">Mostrando os 60 mais recentes. Os outros estão na página de cada atleta.</p>' : "") + "</section>";
      h += '<section class="secao"><h2>Atletas</h2><p class="nota">Toque para ver a evolução jogo a jogo.</p><div class="atletas">' + st.atletas.map(function (x) {
        var n = st.jogos.filter(function (j) { return j.atletaId === x.id; }).length;
        return '<a href="#/atleta/' + esc(x.id) + '">' + esc(x.nome) + " <small>" + n + (n === 1 ? " jogo" : " jogos") + "</small></a>";
      }).join("") + "</div></section>";
    }
    h += '<section class="secao cartao"><h2>Cópia dos jogos</h2><p class="nota">Os jogos ficam só neste celular. Faça uma cópia de vez em quando: se trocar de celular ou limpar o navegador, é ela que traz os jogos de volta.</p>' +
      '<div class="acoes"><button type="button" class="bt bt-pq" id="btCopia"' + (jogos.length ? "" : " disabled") + '>Fazer cópia</button><label class="bt bt-pq" for="arqCopia">Carregar uma cópia</label><input type="file" id="arqCopia" accept=".json,application/json" hidden></div></section>' +
      (salvoOk ? "" : '<div class="aviso atencao">Este navegador não está deixando salvar (memória cheia ou navegação privada). Abra em uma janela normal.</div>') +
      '<p class="rodape">QuadraLab Scout · grátis · o nome do adversário e as anotações nunca saem deste celular.</p>';
    tela(h, true);
    var bt = document.getElementById("btCopia"); if (bt) bt.addEventListener("click", fazerCopia);
    document.getElementById("arqCopia").addEventListener("change", carregarCopia);
  }
  function fazerCopia() {
    var nome = "quadralab-scout-" + D.hojeLocal() + ".json";
    try {
      var url = URL.createObjectURL(new Blob([D.exportar(st)], { type: "application/json" }));
      var a = document.createElement("a"); a.href = url; a.download = nome; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      toast("Cópia salva: " + nome + ". Guarde o arquivo (por exemplo, mande para você no WhatsApp ou no e-mail).");
    } catch (e) { toast("Não consegui gerar a cópia neste navegador."); }
  }
  function carregarCopia(ev) {
    var f = ev.target.files && ev.target.files[0]; if (!f) return;
    if (f.size > 8 * 1024 * 1024) { toast("Arquivo grande demais para ser uma cópia do QuadraLab Scout."); return; }
    var r = new FileReader();
    r.onload = function () {
      var x = D.importar(st, String(r.result || ""));
      if (x.erro) { toast(x.erro); return; }
      salvar();
      toast(x.novos || x.atualizados ? (x.novos + (x.novos === 1 ? " jogo novo" : " jogos novos") + (x.atualizados ? " e " + x.atualizados + " atualizados" : "") + " no celular.") : "Nada novo: os jogos dessa cópia já estavam aqui.");
      telaInicio();
    };
    r.onerror = function () { toast("Não consegui ler o arquivo."); };
    r.readAsText(f);
  }

  /* ══ Novo jogo ══ */
  var novo = null;
  function telaNovo() {
    if (!novo) novo = { atletaId: st.atletas.length === 1 ? st.atletas[0].id : null, nome: "", outro: !st.atletas.length, torneio: "", adversario: "", cfg: Object.assign({}, D.CFG_PADRAO) };
    var c = novo.cfg, sel = novo.atletaId ? D.atleta(st, novo.atletaId) : null, nomeSaque = sel && !novo.outro ? primeiroNome(sel.nome) : (novo.nome ? primeiroNome(novo.nome) : "Atleta");
    function chip(attr, v, rot, on) { return '<button type="button" class="chip" ' + attr + '="' + esc(v) + '" aria-pressed="' + !!on + '">' + rot + "</button>"; }
    var h = '<p class="voltar"><a class="bt bt-texto" href="#/">‹ Seus jogos</a></p><h1>Marcar um jogo</h1><p class="sub">Só o atleta é obrigatório. O resto ajuda a comparar os jogos depois.</p>' +
      '<section class="cartao"><h2>Atleta</h2>' +
      (st.atletas.length ? '<div class="chips" role="group" aria-label="Atleta">' + st.atletas.map(function (a) { return chip("data-atleta", a.id, esc(a.nome), !novo.outro && novo.atletaId === a.id); }).join("") + chip("data-atleta", "+", "+ Outro atleta", novo.outro) + "</div>" : "") +
      (novo.outro ? '<div class="campo"><label for="nvNome">Nome do atleta</label><input id="nvNome" maxlength="60" autocomplete="off" autocapitalize="words" placeholder="Ex.: Lucas" value="' + esc(novo.nome) + '"></div>' : "") +
      '<div class="campo"><label for="nvTorneio">Torneio <span class="nota">(opcional)</span></label><input id="nvTorneio" maxlength="80" placeholder="Torneio ou jogo-treino" value="' + esc(novo.torneio) + '"></div>' +
      '<div class="campo"><label for="nvAdv">Adversário <span class="nota">(opcional, fica só neste celular)</span></label><input id="nvAdv" maxlength="80" autocomplete="off" value="' + esc(novo.adversario) + '"></div></section>' +
      '<section class="cartao"><h2>Formato</h2><div class="chips" role="group" aria-label="Formato">' + [["3sets", "Melhor de 3 sets"], ["1set", "Set único"], ["4games", "Set a 4 games"], ["tb10", "Match tie-break (10)"], ["tb7", "Só tie-break (7)"]].map(function (f) { return chip("data-formato", f[0], f[1], c.formato === f[0]); }).join("") + "</div>" +
      '<p class="olho" style="margin-top:16px">Quem saca primeiro</p><div class="chips" role="group" aria-label="Quem saca primeiro">' + chip("data-saca", "nos", esc(nomeSaque), c.saca === "nos") + chip("data-saca", "ele", "Adversário", c.saca === "ele") + "</div>" +
      (c.formato === "tb7" || c.formato === "tb10" ? '<p class="nota" style="margin-top:12px">Um único tie-break de ' + (c.formato === "tb10" ? "10" : "7") + " pontos, com 2 de diferença.</p>" :
        '<p class="olho" style="margin-top:16px">Pontuação</p><div class="chips">' + chip("data-tog", "semVantagem", "Sem vantagem (ponto decisivo no 40-40)", c.semVantagem) + (c.formato === "3sets" ? chip("data-tog", "superTiebreakDecisivo", "Super tie-break no 3º set", c.superTiebreakDecisivo) : "") + "</div>") +
      '</section><div class="aviso atencao" id="nvErro" role="alert" hidden></div><div class="acoes"><button type="button" class="bt bt-principal bt-grande" id="btComecar">Começar o jogo</button></div>';
    tela(h);
    function lerCampos() { var n = document.getElementById("nvNome"); if (n) novo.nome = n.value; novo.torneio = document.getElementById("nvTorneio").value; novo.adversario = document.getElementById("nvAdv").value; }
    cada("[data-atleta]", function (b) { b.addEventListener("click", function () { lerCampos(); var v = b.getAttribute("data-atleta"); if (v === "+") { novo.outro = true; novo.atletaId = null; } else { novo.outro = false; novo.atletaId = v; } telaNovo(); if (novo.outro) document.getElementById("nvNome").focus(); }); });
    cada("[data-formato]", function (b) { b.addEventListener("click", function () { lerCampos(); c.formato = b.getAttribute("data-formato"); novo.cfg = D.cfgLimpa(c); telaNovo(); }); });
    cada("[data-saca]", function (b) { b.addEventListener("click", function () { lerCampos(); c.saca = b.getAttribute("data-saca"); telaNovo(); }); });
    cada("[data-tog]", function (b) { b.addEventListener("click", function () { lerCampos(); var k = b.getAttribute("data-tog"); c[k] = !c[k]; novo.cfg = D.cfgLimpa(c); telaNovo(); }); });
    var nm = document.getElementById("nvNome"); if (nm) nm.addEventListener("input", function () { novo.nome = nm.value; });
    document.getElementById("btComecar").addEventListener("click", function () {
      lerCampos();
      var er = document.getElementById("nvErro"), atletaId = novo.atletaId;
      if (novo.outro || !atletaId) { var r = D.addAtleta(st, novo.nome); if (r.erro) { er.textContent = r.erro; er.hidden = false; return; } atletaId = r.atleta.id; }
      var x = D.novoJogo(st, { atletaId: atletaId, torneio: novo.torneio, adversario: novo.adversario, cfg: novo.cfg });
      if (x.erro) { er.textContent = x.erro; er.hidden = false; return; }
      salvar(); uso("jogo-iniciado"); novo = null;
      location.hash = "#/jogo/" + x.jogo.id;
    });
  }

  /* ══ Marcação ══ */
  var FIM_ROT = [["winner_nos", "Winner de ", true], ["erro_dele", "Erro do adversário", true], ["erro_nos", "Erro de ", false], ["winner_dele", "Winner do adversário", false]];
  var marc = { id: null, rasc: null, saquePre: null, detAberto: false, analiseAberta: false, confirmaFim: false };
  function telaJogo(id) {
    var j = D.jogo(st, id);
    if (!j) { tela('<p class="voltar"><a class="bt bt-texto" href="#/">‹ Seus jogos</a></p><div class="aviso atencao">Este jogo não está mais neste celular.</div>', true); return; }
    if (marc.id !== id) marc = { id: id, rasc: null, saquePre: null, detAberto: false, analiseAberta: false, confirmaFim: false, confirmaApagar: false };
    st.atual = D.encerrado(M, j) ? st.atual : id;
    if (D.encerrado(M, j)) { contarFim(j); telaFim(j); return; }
    desenharMarcacao(j, true);
  }
  function anterioresDe(j) { try { return D.anteriores(M, st, j); } catch (e) { return []; } }
  function desenharMarcacao(j, topo) {
    var a = D.atleta(st, j.atletaId), nome = primeiroNome(a && a.nome), pl = D.placar(M, j), sacador = M.quemSaca(pl), meu = sacador === "nos", n = j.pontos.length;
    var gan = j.pontos.filter(function (p) { return p.nos; }).length, ant = anterioresDe(j), r = marc.rasc;
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
    /* detalhes do último ponto, depois de marcado (opcional) */
    if (n && !r) h += detalhesHtml(j, nome);
    h += '<section class="cartao"><div class="contagem"><span><b>' + n + "</b> " + (n === 1 ? "ponto" : "pontos") + " · " + esc(nome) + " ganhou <b>" + gan + "</b>" + (n ? " (" + Math.round(gan * 100 / n) + "%)" : "") + "</span></div>" +
      (marc.confirmaFim ? '<div class="cartao confirma"><p style="margin:0"><b>Encerrar o jogo agora?</b> Use quando o jogo parou antes do fim (desistência, chuva, tempo).</p><div class="acoes"><button type="button" class="bt bt-principal bt-pq" id="btFimSim">Sim, encerrar</button><button type="button" class="bt bt-pq" id="btFimNao">Continuar marcando</button></div></div>' :
        '<div class="acoes"><button type="button" class="bt bt-pq" id="btDesfazer"' + (n || r ? "" : " disabled") + '>Desfazer</button><button type="button" class="bt bt-pq bt-perigo" id="btEncerrar">Encerrar jogo</button></div>') + "</section>";
    if (AV) h += '<details class="cartao" id="detAnalise"' + (marc.analiseAberta ? " open" : "") + '><summary><b>Análise ao vivo</b> · momento, alertas e game a game</summary>' + (marc.analiseAberta ? AV.painel(j.pontos, { atleta: nome, mental: j.mental, anteriores: ant }) : "") + "</details>";
    h += '<p class="rodape">Salvo neste celular a cada ponto. Pode fechar e voltar depois.</p>';
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
      '<p class="olho">Último golpe de ' + esc(nome) + '</p><div class="chips">' + opcoesHtml(M.GOLPES, "golpe", p.golpe) + "</div>" +
      '<p class="olho">Direção</p><div class="chips">' + opcoesHtml(M.DIRECOES, "direcao", p.direcao) + '<button type="button" class="chip" data-detb="corrida" aria-pressed="' + !!p.corrida + '">Na corrida</button></div>' +
      '<p class="olho">Onde foi o último golpe de ' + esc(nome) + '</p><div class="chips">' + opcoesHtml(M.ZONAS, "zona", p.zona) + "</div></details>";
  }
  function ligarMarcacao(j, nome) {
    function redesenhar() { desenharMarcacao(j, false); }
    function marcar(p) {
      var r = D.marcarPonto(M, j, p); if (r.erro) { toast(r.erro); return; }
      marc.rasc = null; marc.saquePre = null; salvar();
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
    cada("[data-bola]", function (b) { b.addEventListener("click", function () { var p = marc.rasc; p.bola = b.getAttribute("data-bola"); if (p.fim === "erro_nos" && !p.causa) p.causa = null; marcar(p); }); });
    cada("[data-det]", function (b) { b.addEventListener("click", function () { var p = j.pontos[j.pontos.length - 1], k = b.getAttribute("data-det"), v = b.getAttribute("data-v"); p[k] = p[k] === v ? null : v; D.tocar(j); salvar(); redesenhar(); }); });
    cada("[data-detb]", function (b) { b.addEventListener("click", function () { var p = j.pontos[j.pontos.length - 1], k = b.getAttribute("data-detb"); p[k] = !p[k]; D.tocar(j); salvar(); redesenhar(); }); });
    var dp = document.getElementById("detPonto"); if (dp) dp.addEventListener("toggle", function () { marc.detAberto = dp.open; });
    var da = document.getElementById("detAnalise"); if (da) da.addEventListener("toggle", function () { var antes = marc.analiseAberta; marc.analiseAberta = da.open; if (da.open && !antes) redesenhar(); });
    var bd = document.getElementById("btDesfazer"); if (bd) bd.addEventListener("click", function () { if (marc.rasc) { marc.rasc = null; redesenhar(); return; } if (D.desfazer(j)) { salvar(); toast("Último ponto desfeito."); redesenhar(); } });
    var be = document.getElementById("btEncerrar"); if (be) be.addEventListener("click", function () { marc.confirmaFim = true; redesenhar(); });
    var bn = document.getElementById("btFimNao"); if (bn) bn.addEventListener("click", function () { marc.confirmaFim = false; redesenhar(); });
    var bs = document.getElementById("btFimSim"); if (bs) bs.addEventListener("click", function () { j.fim = true; D.tocar(j); marc.confirmaFim = false; marc.rasc = null; if (st.atual === j.id) delete st.atual; salvar(); contarFim(j); telaFim(j, true); });
  }

  /* ══ Fim de jogo ══ */
  function telaFim(j, topo) {
    var a = D.atleta(st, j.atletaId), nome = primeiroNome(a && a.nome), pl = D.placar(M, j), r = D.resumo(M, st, j), n = j.pontos.length;
    if (st.atual === j.id) { delete st.atual; salvar(); }
    var titulo = pl.fim ? nome + (pl.vencedor === "nos" ? " venceu" : " perdeu") : "Jogo encerrado antes do fim";
    var cmp = D.comparacao(M, st, j.atletaId, 6);
    var h = '<p class="voltar"><a class="bt bt-texto" href="#/">‹ Seus jogos</a></p>' +
      '<section class="resultado" data-fim-jogo><p class="olho">Fim de jogo' + (j.torneio ? " · " + esc(j.torneio) : "") + " · " + esc(dataBR(j.data)) + "</p><h1>" + esc(titulo) + "</h1>" +
      (r.resultado ? '<p class="placar-f">' + esc(r.resultado) + "</p>" : "") + '<p class="nota">' + n + (n === 1 ? " ponto" : " pontos") + " · " + esc(nome) + " ganhou " + r.ganhos + " (" + r.pctGanhos + "%)" + (j.adversario ? " · contra " + esc(j.adversario) : "") + "</p>" +
      '<div class="acoes"><button type="button" class="bt bt-principal" id="btCompartilhar">Compartilhar o resultado</button><a class="bt" id="lkWhats" target="_blank" rel="noopener noreferrer" href="https://wa.me/?text=' + encodeURIComponent(D.textoCompartilhar(M, st, j)) + '">Mandar no WhatsApp</a></div></section>';
    if (n && G) h += '<div class="graficos">' + G.topo(r) + G.secoes(r) + "</div>";
    if (r.sinais && r.sinais.length) h += '<section class="cartao"><h2>O que este jogo aponta</h2><p class="nota">Leitura automática pelos números. É ponto de partida para conversar com o treinador, não conclusão.</p>' + r.sinais.map(function (t) { return '<div class="sinal">' + t + "</div>"; }).join("") + "</section>";
    if (cmp.jogos.length >= 2) h += '<section class="cartao"><h2>Comparação com os jogos anteriores</h2>' + tabelaComparacao(cmp) + '<div class="acoes"><a class="bt bt-pq" href="#/atleta/' + esc(j.atletaId) + '">Ver todos os jogos de ' + esc(nome) + "</a></div></section>";
    else h += '<div class="aviso">Marque mais jogos de ' + esc(nome) + " para ver a comparação jogo a jogo. Um jogo é uma amostra; três na mesma direção já são um sinal.</div>";
    h += '<section class="cartao"><h2>Depois do jogo <span class="nota">(opcional)</span></h2><div class="campo"><label for="fmNivel">Nível do adversário</label><select id="fmNivel"><option value="">Não informar</option>' +
      M.NIVEIS_ADVERSARIO.map(function (x) { return '<option value="' + esc(x[0]) + '"' + (j.nivelAdversario === x[0] ? " selected" : "") + ">" + esc(x[1]) + "</option>"; }).join("") + "</select></div>" +
      '<div class="campo"><label for="fmObs">Anotações <span class="nota">(ficam só neste celular)</span></label><textarea id="fmObs" maxlength="1200" placeholder="O que funcionou, o que treinar">' + esc(j.observacaoFinal) + "</textarea></div></section>" +
      '<section class="cartao" id="acoesJogo">' + (marc.confirmaApagar ? '<div class="confirma cartao" style="margin-top:0"><p style="margin:0"><b>Apagar este jogo?</b> Não dá para desfazer.</p><div class="acoes"><button type="button" class="bt bt-pq bt-perigo" id="btApagarSim">Sim, apagar</button><button type="button" class="bt bt-pq" id="btApagarNao">Manter o jogo</button></div></div>' :
        '<div class="acoes"><button type="button" class="bt bt-pq" id="btReabrir">' + (pl.fim ? "Desfazer o último ponto" : "Voltar a marcar") + '</button><a class="bt bt-pq" href="#/novo">+ Marcar outro jogo</a><button type="button" class="bt bt-pq bt-perigo" id="btApagar">Apagar jogo</button></div>') + "</section>" +
      '<p class="rodape">Os números usam as mesmas regras do scout do treinador no QuadraLab.</p>';
    tela(h, topo);
    document.getElementById("btCompartilhar").addEventListener("click", function () {
      var t = D.textoCompartilhar(M, st, j);
      if (navigator.share) { navigator.share({ title: "QuadraLab Scout", text: t }).catch(function () { /* cancelado */ }); return; }
      copiar(t);
    });
    document.getElementById("fmNivel").addEventListener("change", function (e) { j.nivelAdversario = e.target.value; D.tocar(j); salvar(); });
    document.getElementById("fmObs").addEventListener("input", function (e) { j.observacaoFinal = e.target.value.slice(0, 1200); D.tocar(j); salvar(); });
    var re = document.getElementById("btReabrir"); if (re) re.addEventListener("click", function () { if (pl.fim) D.desfazer(j); else { j.fim = false; D.tocar(j); } st.atual = j.id; salvar(); desenharMarcacao(j, true); });
    var ap = document.getElementById("btApagar"); if (ap) ap.addEventListener("click", function () { marc.confirmaApagar = true; telaFim(j); document.getElementById("acoesJogo").scrollIntoView({ block: "center" }); });
    var an = document.getElementById("btApagarNao"); if (an) an.addEventListener("click", function () { marc.confirmaApagar = false; telaFim(j); });
    var as = document.getElementById("btApagarSim"); if (as) as.addEventListener("click", function () { D.removerJogo(st, j.id); salvar(); toast("Jogo apagado."); location.hash = "#/"; });
  }
  function copiar(t) {
    var ok = function () { toast("Texto copiado. Cole no WhatsApp ou onde quiser."); };
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(t).then(ok).catch(function () { toast("Use o botão “Mandar no WhatsApp”."); }); return; }
    toast("Use o botão “Mandar no WhatsApp”.");
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
    if (!a) { tela('<p class="voltar"><a class="bt bt-texto" href="#/">‹ Seus jogos</a></p><div class="aviso atencao">Atleta não encontrado neste celular.</div>', true); return; }
    var jogos = D.historico(st, id), linhas = jogos.map(function (j) { return D.linhaJogo(M, st, j); }), fim = linhas.filter(function (l) { return l.fim && l.n; });
    var vit = fim.filter(function (l) { return l.venceu === true; }).length, der = fim.filter(function (l) { return l.venceu === false; }).length;
    var media = fim.length ? Math.round(fim.reduce(function (s, l) { return s + l.pct; }, 0) / fim.length) : null, cmp = D.comparacao(M, st, id, 8);
    var h = '<p class="voltar"><a class="bt bt-texto" href="#/">‹ Seus jogos</a></p><h1>' + esc(a.nome) + '</h1><p class="sub">' + jogos.length + (jogos.length === 1 ? " jogo" : " jogos") + (fim.length ? " · " + vit + (vit === 1 ? " vitória" : " vitórias") + " e " + der + (der === 1 ? " derrota" : " derrotas") + " · média de " + media + "% dos pontos" : "") + "</p>" +
      '<div class="acoes"><a class="bt bt-principal" href="#/novo" data-novo-atleta="' + esc(id) + '">+ Marcar um jogo de ' + esc(primeiroNome(a.nome)) + "</a></div>" +
      (cmp.jogos.length >= 2 ? '<section class="cartao"><h2>Evolução jogo a jogo</h2>' + tabelaComparacao(cmp) + "</section>" : '<div class="aviso">A comparação aparece a partir de 2 jogos terminados.</div>') +
      (jogos.length ? '<section class="secao"><h2>Jogos</h2><ul class="lista">' + jogos.map(linhaHtml).join("") + "</ul></section>" : "") +
      '<section class="cartao"><h2>Nome</h2><div class="campo" style="margin-top:6px"><label for="atNome">Nome do atleta</label><input id="atNome" maxlength="60" value="' + esc(a.nome) + '"></div><div class="acoes"><button type="button" class="bt bt-pq" id="btRenomear">Salvar nome</button>' +
      (confirmaAtleta === id ? '</div><div class="cartao confirma"><p style="margin:0"><b>Apagar ' + esc(a.nome) + " e " + (jogos.length === 1 ? "o jogo" : "os " + jogos.length + " jogos") + '?</b> Não dá para desfazer. Faça uma cópia antes, se quiser guardar.</p><div class="acoes"><button type="button" class="bt bt-pq bt-perigo" id="btAtApagarSim">Sim, apagar</button><button type="button" class="bt bt-pq" id="btAtApagarNao">Manter</button></div></div>' :
        '<button type="button" class="bt bt-pq bt-perigo" id="btAtApagar">Apagar atleta</button></div>') + "</section>";
    tela(h, true);
    var nv = q("[data-novo-atleta]"); if (nv) nv.addEventListener("click", function () { novo = { atletaId: id, nome: "", outro: false, torneio: "", adversario: "", cfg: Object.assign({}, D.CFG_PADRAO) }; });
    document.getElementById("btRenomear").addEventListener("click", function () { var r = D.renomearAtleta(st, id, document.getElementById("atNome").value); if (r.erro) { toast(r.erro); return; } salvar(); toast("Nome salvo."); telaAtleta(id); });
    var ap = document.getElementById("btAtApagar"); if (ap) ap.addEventListener("click", function () { confirmaAtleta = id; telaAtleta(id); });
    var an = document.getElementById("btAtApagarNao"); if (an) an.addEventListener("click", function () { confirmaAtleta = null; telaAtleta(id); });
    var as = document.getElementById("btAtApagarSim"); if (as) as.addEventListener("click", function () { var r = D.removerAtleta(st, id); confirmaAtleta = null; salvar(); toast("Atleta apagado" + (r.jogosApagados ? " com " + r.jogosApagados + (r.jogosApagados === 1 ? " jogo." : " jogos.") : ".")); location.hash = "#/"; });
  }

  /* ══ rotas ══ */
  function rota() {
    var partes = (location.hash || "#/").replace(/^#\/?/, "").split("/");
    if (partes[0] !== "jogo") { marc.id = null; }
    if (partes[0] === "novo") telaNovo();
    else if (partes[0] === "jogo" && partes[1]) telaJogo(partes[1]);
    else if (partes[0] === "atleta" && partes[1]) { if (confirmaAtleta !== partes[1]) confirmaAtleta = null; telaAtleta(partes[1]); }
    else { novo = null; telaInicio(); }
  }
  function conexao() { document.getElementById("seloOff").hidden = navigator.onLine !== false; if (navigator.onLine !== false) enviarUso(); }

  carregar();
  window.addEventListener("hashchange", rota);
  window.addEventListener("online", conexao); window.addEventListener("offline", conexao);
  /* outra aba do app mudou os dados: recarrega para não sobrescrever */
  window.addEventListener("storage", function (e) { if (e.key === D.CHAVE) { carregar(); rota(); } });
  rota(); conexao();
  uso("abriu");
  if ("serviceWorker" in navigator && !/[?&]sem-sw\b/.test(location.search)) navigator.serviceWorker.register("sw.js").catch(function () { /* sem modo offline */ });
})();
