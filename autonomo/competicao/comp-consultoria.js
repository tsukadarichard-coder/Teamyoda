/* QuadraLab Competição — Consultoria com Richard Tsukada.

   Atleta, treinador e responsável: Meu plano · Jogos · Calendário · Evolução · Equipe. Richard (consultor): o painel com o que exige atenção e,
   em cada atleta, as mesmas seções com as ferramentas de trabalho (cadastro, partidas do diagnóstico, diagnóstico, plano, análises, relatórios,
   reuniões e anotações privadas). Tudo vem de consultoria-rt, que decide no servidor o que cada perfil vê; nada é simulado aqui.
   Jogos, torneios, compromissos e rotina são os mesmos do app (Partidas, Temporada, Meu planejamento): não há cadastro paralelo. */
(function () {
  var A = window.QL_APP, U = window.QL_COMP_UTIL;
  if (!A || !U) return;
  var esc = A.esc, api = A.api, tela = A.tela, toast = A.toast, ocupado = A.ocupado, ir = A.ir, botaoVoz = A.botaoVoz || function () { return ""; };
  var FN = "consultoria-rt", SERV = "Consultoria com Richard Tsukada";
  var OBJ = { universitario: "Tênis universitário nos EUA", profissional: "Transição para o profissional", ambos: "Universitário e profissional", indefinido: "Ainda em definição" };
  var ETAPA = { cadastro: "Cadastro", diagnostico: "Diagnóstico", plano: "Plano em preparo", acompanhamento: "Acompanhamento", revisao: "Revisão", encerrada: "Encerrada" };
  var ST_P = { aguardando_material: "Aguardando material", recebido: "Material recebido", em_analise: "Em análise", concluido: "Análise concluída" };
  var NAT = { observacao: "Observação", interpretacao: "Interpretação", recomendacao: "Recomendação", hipotese: "A verificar" };
  var SECOES_D = [["fortes", "Pontos fortes", "observacao"], ["padroes", "Padrões recorrentes", "observacao"], ["dificuldades", "Dificuldades observadas", "observacao"], ["prioridades", "Prioridades de desenvolvimento", "recomendacao"], ["questoes", "Questões a verificar", "hipotese"]];
  var RESP = { atleta: "Atleta", treinador: "Treinador", responsavel: "Responsável", consultor: "Richard" };
  var DEST = { atleta: "Atleta", treinador: "Treinador", responsavel: "Responsáveis", consultor: "Richard" };
  var EST_PL = { rascunho: "Rascunho", em_comentario: "Com o treinador para comentar", publicado: "Publicado", substituido: "Substituído" };
  var SUP = { saibro: "Saibro", rapida: "Quadra rápida", grama: "Grama", indoor: "Coberta" };
  var CAL = { torneio: "Torneio", reuniao: "Reunião", prazo: "Prazo", compromisso: "Compromisso", revisao: "Revisão" };
  var DIAS = [["seg", "Seg"], ["ter", "Ter"], ["qua", "Qua"], ["qui", "Qui"], ["sex", "Sex"], ["sab", "Sáb"], ["dom", "Dom"]];
  var MIN = [30, 45, 60, 90, 120];
  var estado = { lista: null, det: {}, filtroCal: "todos", filtros: { atleta: "", etapa: "", pend: "" } };

  /* ── utilidades ── */
  function dt(iso) { var s = String(iso || "").slice(0, 10).split("-"); return s.length === 3 ? s[2] + "/" + s[1] + "/" + s[0] : ""; }
  function curto(iso) { var s = String(iso || "").slice(0, 10).split("-"); return s.length === 3 ? s[2] + "/" + s[1] : ""; }
  function hojeLocal() { return A.hojeISOLocal ? A.hojeISOLocal() : new Date().toISOString().slice(0, 10); }
  function base(id) { return "#/consultoria/" + encodeURIComponent(id); }
  function bloco(titulo, corpo, extra) { return '<section class="cartao cr-bloco"' + (extra || "") + ">" + (titulo ? "<h2>" + titulo + "</h2>" : "") + corpo + "</section>"; }
  function vazio(t) { return '<p class="nota cr-vazio">' + esc(t) + "</p>"; }
  function quemVe(lista) { return '<p class="cr-quemve">Quem vê: ' + esc((lista || []).map(function (x) { return DEST[x] || x; }).join(", ")) + "</p>"; }
  function tag(nat) { return '<span class="cr-tag n-' + esc(nat) + '">' + esc(NAT[nat] || nat) + "</span>"; }
  function chipEtapa(e) { return '<span class="cr-etapa e-' + esc(e) + '">' + esc(ETAPA[e] || e) + "</span>"; }
  function erro(e, href) { tela(U.voltar(href || "#/consultoria", "Consultoria") + '<div class="aviso" role="alert">' + esc(e.message) + '</div><div class="acoes"><button type="button" class="btn btn-secundario" id="crTentar">Tentar de novo</button></div>'); var b = document.getElementById("crTentar"); if (b) b.onclick = function () { location.reload(); }; }
  function carregando(t) { tela('<p class="carregando">' + esc(t || "Carregando…") + "</p>", true); }
  function segundos(t) { var p = String(t || "").split(":").map(Number); if (p.some(isNaN)) return null; return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]; }
  function linkTempo(video, tempo) {
    if (!tempo) return "";
    var s = segundos(tempo); if (!video || s == null || !/youtu\.?be/.test(video)) return '<span class="cr-tempo">' + esc(tempo) + "</span>";
    return '<a class="cr-tempo" href="' + esc(video + (video.indexOf("?") >= 0 ? "&" : "?") + "t=" + s) + '" target="_blank" rel="noopener noreferrer">' + esc(tempo) + '<span class="sr"> (abre o vídeo neste momento)</span></a>';
  }
  /* rascunhos locais: o que está sendo digitado não se perde ao sair da tela ou recarregar */
  function chaveR(k) { return "ql-crt-" + k; }
  function lerR(k) { try { return JSON.parse(localStorage.getItem(chaveR(k)) || "null"); } catch (e) { return null; } }
  function gravarR(k, v) { try { localStorage.setItem(chaveR(k), JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } }
  function limparR(k) { try { localStorage.removeItem(chaveR(k)); } catch (e) { /* sem armazenamento */ } }
  function autoGuardar(form, k, coletar) { form.addEventListener("input", function () { gravarR(k, coletar()); }); form.addEventListener("change", function () { gravarR(k, coletar()); }); }
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }
  var VOZ = { crNota: 1, crSug: 1, jgAplic: 1, jgDif: 1, jgObs: 1, trTrab: 1, trResp: 1, trDif: 1, trAj: 1, dgIA: 1, enExpA: 1, enExpF: 1 }; // ditado só onde falar ajuda (relatos e anotações)
  function txtArea(id, rotulo, v, max, linhas, nota) { return '<div class="campo"><label for="' + id + '">' + rotulo + "</label>" + (nota ? '<p class="nota">' + nota + "</p>" : "") + '<textarea id="' + id + '" rows="' + (linhas || 3) + '" maxlength="' + (max || 600) + '">' + esc(v || "") + "</textarea>" + (VOZ[id] ? botaoVoz(id) : "") + "</div>"; }
  function sel(id, rotulo, opcoes, v, vazioRot) { return '<div class="campo"><label for="' + id + '">' + rotulo + '</label><select id="' + id + '">' + (vazioRot !== undefined ? '<option value="">' + esc(vazioRot) + "</option>" : "") + Object.keys(opcoes).map(function (k) { return '<option value="' + esc(k) + '"' + (k === v ? " selected" : "") + ">" + esc(opcoes[k]) + "</option>"; }).join("") + "</select></div>"; }
  function checks(nome, opcoes, marcados, legenda, desab) { return '<fieldset class="cr-checks"><legend>' + esc(legenda) + "</legend>" + Object.keys(opcoes).map(function (k) { return '<label><input type="checkbox" name="' + nome + '" value="' + esc(k) + '"' + ((marcados || []).indexOf(k) >= 0 ? " checked" : "") + ((desab || []).indexOf(k) >= 0 ? " disabled checked" : "") + "> " + esc(opcoes[k]) + "</label>"; }).join("") + "</fieldset>"; }
  function marcadosDe(form, nome) { return Array.prototype.map.call(form.querySelectorAll('input[name="' + nome + '"]:checked'), function (i) { return i.value; }); }
  function aviso(form, txt) { var a = form.querySelector(".aviso"); if (!a) return; a.textContent = txt || ""; a.hidden = !txt; if (txt) a.scrollIntoView({ block: "center" }); }
  async function enviar(bt, corpo, ok, falha) {
    ocupado(bt, true, "Salvando…");
    try { var r = await api(FN, { metodo: "POST", corpo: corpo }); ocupado(bt, false); if (ok) ok(r); return r; }
    catch (e) { ocupado(bt, false); if (falha) falha(e); else toast(e.message, null, true); return null; }
  }
  async function detalhe(id, forcar) {
    if (!forcar && estado.det[id] && Date.now() - estado.det[id].em < 5000) return estado.det[id].d;
    var d = await api(FN + "?id=" + encodeURIComponent(id)); estado.det[id] = { d: d, em: Date.now() }; return d;
  }
  function invalidar(id) { delete estado.det[id]; estado.lista = null; }
  function dataISO(iso) { return String(iso || "").slice(0, 10); }

  /* ── casca de cada atleta: cabeçalho e as cinco seções ── */
  var SECOES = [["plano", "Meu plano"], ["jogos", "Jogos"], ["calendario", "Calendário"], ["evolucao", "Evolução"], ["equipe", "Equipe"]];
  function casca(d, secao, corpo) {
    var cons = d.papel === "consultor", c = d.ciclo;
    var voltarHref = cons || (estado.lista && estado.lista.consultorias && estado.lista.consultorias.length > 1) ? "#/consultoria" : "#/inicio";
    var nav = '<nav class="cr-secoes" aria-label="Seções da consultoria">' + SECOES.map(function (s) {
      var rot = s[0] === "plano" && d.papel !== "atleta" ? "Plano" : s[1];
      return '<a href="' + base(d.id) + "/" + s[0] + '"' + (s[0] === secao ? ' aria-current="page"' : "") + ">" + rot + "</a>";
    }).join("") + "</nav>";
    return '<div class="cr">' + U.voltar(voltarHref, cons ? "Painel do consultor" : voltarHref === "#/inicio" ? "Início" : "Consultoria") +
      '<header class="cr-cab"><p class="olho">' + SERV + "</p><h1>" + esc(d.papel === "atleta" ? (secao === "plano" ? "Meu plano" : SECOES.filter(function (s) { return s[0] === secao; })[0][1]) : d.atleta.nome) + "</h1>" +
      '<p class="cr-linha">' + (d.papel !== "atleta" ? "<span>" + esc(cons ? "Atleta" : d.papel === "treinador" ? "Você é treinador na equipe" : "Você é responsável na equipe") + "</span>" : "") + chipEtapa(d.etapa) + (c ? "<span>Ciclo " + esc(curto(c.inicio)) + " a " + esc(dt(c.fim)) + "</span>" : "") + "</p>" +
      (d.estado !== "ativa" ? '<div class="pl-aviso info">' + (d.estado === "encerrada" ? "Acompanhamento encerrado. O histórico continua disponível para leitura." : "Acompanhamento pausado. Os registros novos ficam para quando ele for retomado.") + "</div>" : "") + "</header>" +
      nav + corpo + "</div>";
  }
  function ativa(d) { return d.estado === "ativa" || d.papel === "consultor"; }

  /* ── lista, painel do consultor e estado vazio ── */
  async function telaLista() {
    carregando();
    var r;
    try { r = estado.lista && Date.now() - estado.lista.em < 20000 ? estado.lista : await api(FN); r.em = Date.now(); estado.lista = r; } catch (e) { return erro(e, "#/inicio"); }
    if (r.souConsultor) return telaPainel();
    if (r.consultorias.length === 1) { location.replace(base(r.consultorias[0].id) + "/plano"); return; }
    if (!r.consultorias.length) {
      return tela(U.voltar("#/inicio", "Início") + '<div class="cr"><header class="cr-cab"><p class="olho">' + SERV + "</p><h1>Consultoria</h1></header>" +
        bloco("Como funciona", '<p>Acompanhamento de desenvolvimento para atletas a partir de 15 anos que jogam torneios CBT ou acima, com objetivo no tênis universitário nos EUA, na transição para o profissional ou nos dois.</p>' +
          '<ol class="cr-passos"><li>Cadastro e equipe (treinador e responsáveis)</li><li>Análise de três partidas completas</li><li>Diagnóstico e até três prioridades</li><li>Plano de 90 dias com o treinador</li><li>Registros de jogos e treinos, revisão e relatório</li></ol>' +
          '<p class="nota">Conduzida por Richard Tsukada. O QuadraLab organiza e dá continuidade. O serviço não promete bolsa, recrutamento, ranking ou carreira profissional.</p>') +
        bloco("Acesso", '<p class="nota">A consultoria é ativada pelo Richard depois da conversa inicial. Quando estiver ativa, ela aparece aqui. Treinador e responsável entram pelo convite do atleta e não precisam contratar outro plano.</p>') + "</div>");
    }
    tela(U.voltar("#/inicio", "Início") + '<div class="cr"><header class="cr-cab"><p class="olho">' + SERV + "</p><h1>Atletas que você acompanha</h1></header>" +
      r.consultorias.map(function (c) { return '<a class="cartao cr-item" href="' + base(c.id) + '/plano"><div><h2>' + esc(c.atleta) + '</h2><p class="cr-linha">' + chipEtapa(c.etapa) + (c.ciclo ? "<span>até " + esc(dt(c.ciclo.fim)) + "</span>" : "") + "</p></div><span aria-hidden=\"true\">›</span></a>"; }).join("") + "</div>");
  }
  var ROT_PEND = { material: "Material aguardado", analise: "Análises pendentes", revisao: "Revisões próximas", atraso: "Ações atrasadas", sugestao: "Sugestões do treinador", ciclo: "Fim de ciclo" };
  async function telaPainel() {
    carregando("Carregando o painel…");
    var r; try { r = await api(FN + "?painel=1"); } catch (e) { return erro(e, "#/inicio"); }
    var f = estado.filtros, todos = r.consultorias;
    var lista = todos.filter(function (c) { return (!f.atleta || c.id === f.atleta) && (!f.etapa || c.etapa === f.etapa) && (!f.pend || c.pendencias.some(function (p) { return p.tipo === f.pend; })); });
    var ativos = todos.filter(function (c) { return c.estado === "ativa"; }).length, comPend = todos.filter(function (c) { return c.pendencias.length; }).length;
    var opc = function (o, v) { return Object.keys(o).map(function (k) { return '<option value="' + esc(k) + '"' + (k === v ? " selected" : "") + ">" + esc(o[k]) + "</option>"; }).join(""); };
    var atl = {}; todos.forEach(function (c) { atl[c.id] = c.atleta; });
    tela(U.voltar("#/inicio", "Início") + '<div class="cr"><header class="cr-cab"><p class="olho">' + SERV + "</p><h1>Painel do consultor</h1>" +
      '<p class="cr-linha"><span><strong>' + ativos + "</strong> " + (ativos === 1 ? "atleta ativo" : "atletas ativos") + "</span><span><strong>" + comPend + "</strong> com algo para fazer</span></p></header>" +
      '<form class="cr-filtros" id="crFiltros"><label>Atleta<select name="atleta"><option value="">Todos</option>' + opc(atl, f.atleta) + '</select></label><label>Etapa<select name="etapa"><option value="">Todas</option>' + opc(ETAPA, f.etapa) + '</select></label><label>Pendência<select name="pend"><option value="">Todas</option>' + opc(ROT_PEND, f.pend) + "</select></label></form>" +
      (lista.length ? lista.map(function (c) {
        return '<a class="cartao cr-item cr-painel-item" href="' + base(c.id) + '/plano"><div style="min-width:0;flex:1"><h2>' + esc(c.atleta) + '</h2><p class="cr-linha">' + chipEtapa(c.etapa) + (c.estado !== "ativa" ? "<span>" + esc(c.rotuloEstado) + "</span>" : "") + (c.ciclo ? "<span>Ciclo até " + esc(dt(c.ciclo.fim)) + "</span>" : "") + "</p>" +
          (c.pendencias.length ? '<ul class="cr-pend">' + c.pendencias.slice(0, 4).map(function (p) { return '<li class="p-' + esc(p.tipo) + '">' + esc(p.texto) + "</li>"; }).join("") + "</ul>" : '<p class="nota">Nada pendente.</p>') +
          (c.proximos.length ? '<p class="nota">Próximos: ' + c.proximos.slice(0, 2).map(function (x) { return esc(curto(x.data) + " · " + x.titulo); }).join(" · ") + "</p>" : "") +
          '<p class="nota">Última atualização: ' + esc(dt(c.ultimaAtualizacao)) + "</p></div><span aria-hidden=\"true\">›</span></a>";
      }).join("") : vazio(todos.length ? "Nenhum atleta com esses filtros." : "Nenhuma consultoria ativada ainda. A ativação é feita no painel do administrador.")) + "</div>");
    var fm = document.getElementById("crFiltros");
    fm.addEventListener("change", function () { estado.filtros = { atleta: fm.atleta.value, etapa: fm.etapa.value, pend: fm.pend.value }; telaPainel(); });
  }

  /* ── MEU PLANO ── */
  function proximoCompromisso(d) { var h = d.hoje; return (d.calendario || []).filter(function (x) { return x.ate >= h && x.tipo !== "prazo"; })[0] || null; }
  function ultimaOrientacao(d) {
    var l = [];
    (d.analises || []).forEach(function (a) { l.push({ em: a.publicadoEm, tipo: "Análise de jogo", titulo: a.titulo || "Análise", texto: a.resumo, href: base(d.id) + "/jogos" }); });
    (d.relatorios || []).forEach(function (r) { l.push({ em: r.publicadoEm, tipo: r.tipo === "final" ? "Relatório final" : "Revisão", titulo: r.titulo, texto: r.proximasAcoes || r.objetivo, href: base(d.id) + "/relatorio/" + r.id }); });
    if (d.diagnostico) l.push({ em: d.diagnostico.publicadoEm, tipo: "Diagnóstico", titulo: "Diagnóstico inicial", texto: d.diagnostico.sintese, href: base(d.id) + "/evolucao" });
    l.sort(function (a, b) { return String(b.em).localeCompare(String(a.em)); });
    return l[0] || null;
  }
  function acaoHtml(d, a) {
    var podeMarcar = ativa(d) && (d.papel === "consultor" || d.papel === a.responsavel), atras = !a.feita && a.prazo && a.prazo < d.hoje;
    return '<li class="cr-acao' + (a.feita ? " feita" : "") + '">' + (podeMarcar ? '<label><input type="checkbox" data-acao="' + esc(a.id) + '"' + (a.feita ? " checked" : "") + '> <span class="sr">Marcar como feita: </span></label>' : '<span class="cr-acao-st" aria-hidden="true">' + (a.feita ? "✓" : "○") + "</span>") +
      '<div><p>' + esc(a.texto) + '</p><p class="nota">' + esc(RESP[a.responsavel] || a.responsavel) + (a.prazo ? " · até " + esc(dt(a.prazo)) : "") + (a.feita ? " · feita" : atras ? ' · <strong class="cr-atraso">atrasada</strong>' : "") + "</p></div></li>";
  }
  function prioridadesHtml(d, plano) {
    var acoes = d.acoes || [];
    return plano.conteudo.prioridades.map(function (p, i) {
      return '<article class="cr-prio"><p class="olho">Prioridade ' + (i + 1) + "</p><h3>" + esc(p.titulo) + "</h3>" +
        '<dl class="cr-dl"><dt>Situação inicial</dt><dd>' + esc(p.situacaoInicial) + "</dd><dt>Como vamos acompanhar</dt><dd>" + esc(p.indicador) + "</dd></dl>" +
        '<ul class="cr-acoes">' + acoes.filter(function (a) { return a.prioridadeId === p.id; }).map(function (a) { return acaoHtml(d, a); }).join("") + "</ul></article>";
    }).join("");
  }
  function telaPlano(d) {
    var cons = d.papel === "consultor", vig = d.planoVigente, h = "";
    if (cons) h += consultorTopo(d);
    if (!d.entradaPronta && d.estado === "ativa") h += bloco("Cadastro", '<p class="nota">' + (d.papel === "treinador" ? "O atleta ainda está completando o cadastro de entrada." : "Complete o cadastro de entrada: objetivo, histórico competitivo, rotina e o que mais for útil agora. Dá para salvar e continuar depois.") + "</p>" + (d.papel !== "treinador" ? '<div class="acoes"><a class="btn btn-laranja btn-grande" href="' + base(d.id) + '/cadastro">' + (d.entrada && d.entrada.salvoEm ? "Continuar o cadastro" : "Começar o cadastro") + "</a></div>" : ""), ' style="border-left:4px solid var(--saibro)"');
    if (d.etapa === "diagnostico" || (!d.diagnostico && d.entradaPronta)) {
      h += bloco("Diagnóstico: três partidas", '<p class="nota">' + (d.papel === "atleta" ? "Envie três partidas completas em vídeo (link do YouTube, Drive ou similar), com o contexto de cada uma." : "O diagnóstico começa com a análise de três partidas completas.") + "</p>" + partidasDiagLista(d) + '<p class="nota">O diagnóstico só é publicado quando as três estiverem analisadas.</p>');
    }
    h += bloco("Objetivo", d.entrada && d.entrada.objetivo ? "<p><strong>" + esc(OBJ[d.entrada.objetivo]) + "</strong></p>" + (d.entrada.objetivoObs ? '<p class="nota">' + esc(d.entrada.objetivoObs) + "</p>" : "") + (vig && vig.conteudo.objetivo ? '<p style="margin-top:8px">Objetivo do ciclo: ' + esc(vig.conteudo.objetivo) + "</p>" : "") : vazio("Objetivo ainda não informado no cadastro."));
    if (vig) {
      h += bloco("Ciclo atual", '<p class="cr-linha"><span>Plano versão ' + vig.versao + "</span><span>" + esc(curto(vig.conteudo.inicio)) + " a " + esc(dt(vig.conteudo.fim)) + "</span><span>Revisão em " + esc(dt(vig.conteudo.revisaoEm)) + "</span></p>");
      h += '<h2 class="secao">Prioridades</h2>' + prioridadesHtml(d, vig);
      if (vig.conteudo.calendario) h += bloco("Calendário competitivo sugerido", '<p style="white-space:pre-wrap">' + esc(vig.conteudo.calendario) + "</p>");
    } else h += bloco("Prioridades", vazio(d.diagnostico ? "O plano de 90 dias está sendo preparado a partir do diagnóstico." : "As prioridades aparecem depois do diagnóstico."));
    var prox = proximoCompromisso(d), ori = ultimaOrientacao(d);
    h += bloco("Próximo compromisso", prox ? "<p><strong>" + esc(dt(prox.data)) + "</strong> · " + esc(CAL[prox.tipo]) + ": " + esc(prox.titulo) + (prox.detalhe ? ' <span class="nota">' + esc(prox.detalhe) + "</span>" : "") + "</p>" + (prox.link ? '<p><a href="' + esc(prox.link) + '" target="_blank" rel="noopener noreferrer">Entrar na videochamada<span class="sr"> (abre em nova aba)</span></a></p>' : "") + '<p><a href="' + base(d.id) + '/calendario">Ver o calendário</a></p>' : vazio("Nenhum compromisso à frente."));
    h += bloco("Última orientação publicada", ori ? '<p class="olho">' + esc(ori.tipo) + " · " + esc(dt(ori.em)) + "</p><h3>" + esc(ori.titulo) + "</h3>" + (ori.texto ? '<p class="cr-resumo">' + esc(String(ori.texto).slice(0, 280)) + (String(ori.texto).length > 280 ? "…" : "") + "</p>" : "") + '<p><a href="' + esc(ori.href) + '">Abrir</a></p>' : vazio("Nada publicado ainda."));
    if (d.papel === "treinador") h += treinadorAcoes(d);
    if (cons) h += consultorNotas(d);
    tela(casca(d, "plano", h));
    ligarAcoes(d); ligarNotas(d); ligarSugestao(d);
  }
  function partidasDiagLista(d) {
    return '<ol class="cr-partidas">' + d.diagPartidas.map(function (p) {
      var pode = ativa(d) && (d.papel === "atleta" || d.papel === "consultor");
      return '<li><div><p><strong>Partida ' + p.n + "</strong>" + (p.adversario ? " · contra " + esc(p.adversario) : "") + (p.data ? " · " + esc(dt(p.data)) : "") + '</p><p class="nota"><span class="cr-st s-' + esc(p.status) + '">' + esc(ST_P[p.status]) + "</span>" + (p.torneio ? " · " + esc(p.torneio) : "") + "</p></div>" +
        (pode ? '<a class="btn btn-secundario" href="' + base(d.id) + "/partida/" + p.n + '">' + (d.papel === "consultor" ? "Abrir" : p.status === "aguardando_material" ? "Enviar" : "Editar") + "</a>" : "") + "</li>";
    }).join("") + "</ol>";
  }
  function ligarAcoes(d) {
    Array.prototype.forEach.call(document.querySelectorAll("[data-acao]"), function (cb) {
      cb.addEventListener("change", async function () {
        cb.disabled = true;
        try { await api(FN, { metodo: "POST", corpo: { acao: "marcarAcao", id: d.id, acaoId: cb.getAttribute("data-acao"), feita: cb.checked } }); toast(cb.checked ? "Ação marcada como feita." : "Ação reaberta."); invalidar(d.id); rota(d.id, "plano"); }
        catch (e) { cb.checked = !cb.checked; cb.disabled = false; toast(e.message, null, true); }
      });
    });
  }

  /* consultor: o que exige atenção neste atleta e os atalhos de trabalho */
  function consultorTopo(d) {
    var p = d.pendencias || [];
    return bloco("Para você", (p.length ? '<ul class="cr-pend">' + p.map(function (x) { return '<li class="p-' + esc(x.tipo) + '">' + esc(x.texto) + "</li>"; }).join("") + "</ul>" : '<p class="nota">Nada pendente neste atleta.</p>') +
      '<div class="cr-atalhos"><a class="btn btn-secundario" href="' + base(d.id) + '/cadastro">Cadastro</a><a class="btn btn-secundario" href="' + base(d.id) + '/diagnostico">Diagnóstico</a><a class="btn btn-secundario" href="' + base(d.id) + '/plano-editar">Plano de 90 dias</a><a class="btn btn-secundario" href="' + base(d.id) + '/relatorio-editar/novo">Novo relatório</a></div>', ' style="border-left:4px solid var(--saibro)"');
  }
  function consultorNotas(d) {
    return '<details class="cartao cr-bloco cr-privado"' + (estado.notasAbertas ? " open" : "") + '><summary><h2>Anotações privadas</h2><span class="nota">Só você vê</span></summary>' +
      '<form id="fNota" novalidate>' + txtArea("crNota", "Nova anotação", lerR("nota-" + d.id) || "", 3000, 3) + '<div class="aviso" role="alert" hidden></div><button class="btn btn-secundario" type="submit">Guardar anotação</button></form>' +
      ((d.notas || []).length ? '<ul class="cr-notas">' + d.notas.map(function (n) { return '<li><p class="nota">' + esc(dt(n.em)) + '</p><p style="white-space:pre-wrap">' + esc(n.texto) + '</p><button type="button" class="btn btn-texto" data-nota="' + esc(n.id) + '">Excluir</button></li>'; }).join("") + "</ul>" : "") +
      ((d.historico || []).length ? '<details class="cr-hist"><summary>Histórico do acompanhamento</summary><ul>' + d.historico.map(function (x) { return "<li>" + esc(dt(x.em)) + " · " + esc(x.acao) + "</li>"; }).join("") + "</ul></details>" : "") + "</details>";
  }
  function ligarNotas(d) {
    var f = document.getElementById("fNota"); if (!f) return;
    var det = f.closest("details"); det.addEventListener("toggle", function () { estado.notasAbertas = det.open; });
    var ta = document.getElementById("crNota"); ta.addEventListener("input", function () { gravarR("nota-" + d.id, ta.value); });
    f.addEventListener("submit", function (ev) { ev.preventDefault(); enviar(f.querySelector("button[type=submit]"), { acao: "salvarNota", id: d.id, texto: ta.value }, function () { limparR("nota-" + d.id); toast("Anotação guardada."); invalidar(d.id); rota(d.id, "plano"); }, function (e) { aviso(f, e.message); }); });
    Array.prototype.forEach.call(document.querySelectorAll("[data-nota]"), function (b) { b.onclick = function () { if (!confirm("Excluir esta anotação?")) return; enviar(b, { acao: "excluirNota", id: d.id, notaId: b.getAttribute("data-nota") }, function () { invalidar(d.id); rota(d.id, "plano"); }); }; });
  }
  /* treinador: comentar o plano aberto e registrar o trabalho */
  function treinadorAcoes(d) {
    var aberto = (d.planos || []).filter(function (v) { return v.estado === "em_comentario"; })[0], h = "";
    if (aberto) h += bloco("Plano para você comentar", '<p class="nota">Versão ' + aberto.versao + " preparada pelo Richard. Ele revisa as sugestões e publica a versão final.</p>" + prioridadesResumo(aberto) + formSugestao(aberto.id));
    else if (d.planoVigente) h += bloco("Sugerir um ajuste", formSugestao(d.planoVigente.id));
    if ((d.sugestoes || []).length) h += bloco("Suas sugestões", '<ul class="cr-notas">' + d.sugestoes.map(function (s) { return '<li><p class="nota">' + esc(dt(s.em)) + " · " + (s.estado === "respondida" ? "respondida" : "aguardando o Richard") + '</p><p style="white-space:pre-wrap">' + esc(s.texto) + "</p>" + (s.resposta ? '<p class="cr-resposta"><strong>Richard:</strong> ' + esc(s.resposta) + "</p>" : "") + "</li>"; }).join("") + "</ul>");
    return h;
  }
  function prioridadesResumo(v) { return '<ol class="cr-lista-num">' + v.conteudo.prioridades.map(function (p) { return "<li><strong>" + esc(p.titulo) + "</strong>" + (p.acoes.length ? '<span class="nota"> · ' + esc(p.acoes.map(function (a) { return a.texto + " (" + (RESP[a.responsavel] || "") + ")"; }).join("; ")) + "</span>" : "") + "</li>"; }).join("") + "</ol>"; }
  function formSugestao(planoId) { return '<form id="fSug" data-plano="' + esc(planoId) + '" novalidate>' + txtArea("crSug", "Sua sugestão", "", 1500, 3, "Vai só para o Richard.") + '<div class="aviso" role="alert" hidden></div><button class="btn btn-secundario" type="submit">Enviar sugestão</button></form>'; }
  function ligarSugestao(d) {
    var f = document.getElementById("fSug"); if (!f) return;
    f.addEventListener("submit", function (ev) { ev.preventDefault(); enviar(f.querySelector("button[type=submit]"), { acao: "sugerir", id: d.id, planoId: f.getAttribute("data-plano"), texto: val("crSug") }, function () { toast("Sugestão enviada ao Richard."); invalidar(d.id); rota(d.id, "plano"); }, function (e) { aviso(f, e.message); }); });
  }

  /* ── CADASTRO DE ENTRADA (salvar e continuar depois) ── */
  function telaCadastro(d) {
    var resp = d.papel === "responsavel", e = Object.assign({}, d.entrada || {}, lerR("entrada-" + d.id) || {}), rot = d.rotina || {};
    var soFamilia = function (html) { return resp ? "" : html; };
    var rk = (e.rankings && e.rankings.length ? e.rankings : [{}]);
    var h = '<form id="fEntrada" class="pl-form" novalidate><p class="nota">Preencha o que fizer sentido agora. Dá para salvar e continuar depois; nada aqui é obrigatório para salvar.</p>' +
      soFamilia(bloco("Objetivo", sel("enObj", "Objetivo principal", OBJ, e.objetivo || "", "Escolha") + '<p class="nota">Não é preciso decidir agora entre universidade e profissional: “Ainda em definição” ou “Universitário e profissional” são respostas válidas.</p>' + txtArea("enObjObs", "Comentário sobre o objetivo", e.objetivoObs, 400, 2))) +
      soFamilia(bloco("Treino", U.campo("enTreinador", "Treinador atual", e.treinadorNome) + U.campo("enLocal", "Local de treinamento", e.localTreino) +
        '<fieldset class="cr-checks"><legend>Rotina semanal de treino (a mesma do Meu planejamento)</legend>' + DIAS.map(function (x) { return '<label><input type="checkbox" name="enDias" value="' + x[0] + '"' + ((rot.dias || []).indexOf(x[0]) >= 0 ? " checked" : "") + "> " + x[1] + "</label>"; }).join("") + "</fieldset>" +
        '<div class="campo"><label for="enMin">Duração habitual</label><select id="enMin"><option value="">—</option>' + MIN.map(function (m) { return '<option value="' + m + '"' + (rot.minutos === m ? " selected" : "") + ">" + m + " min</option>"; }).join("") + "</select></div>")) +
      soFamilia(bloco("Competição", txtArea("enHist", "Histórico competitivo", e.historico, 1500, 4, "Categorias, torneios principais e resultados que você considera relevantes.") +
        '<fieldset class="cr-linhas" id="enRankings"><legend>Rankings e ratings informados</legend><p class="nota">Sempre com a fonte e a data: o QuadraLab não consulta rankings automaticamente.</p>' + rk.map(linhaRanking).join("") + '</fieldset><button type="button" class="btn btn-texto" id="enMaisRk">+ Outro ranking</button>')) +
      bloco("Escola e calendário", U.campo("enEsc", "Etapa escolar", e.etapaEscolar, "text", ' placeholder="Ex.: 2º ano do ensino médio"') + U.campo("enConc", "Previsão de conclusão", e.conclusaoPrevista, "text", ' placeholder="Ex.: dez/2027"') +
        txtArea("enViag", "Disponibilidade e condições para viagens", e.viagens, 600, 2) + txtArea("enRestr", "Restrições de calendário", e.restricoes, 600, 2)) +
      bloco("Expectativas", soFamilia(txtArea("enExpA", "Expectativas do atleta", e.expectativaAtleta, 800, 3)) + txtArea("enExpF", "Expectativas da família", e.expectativaFamilia, 800, 3)) +
      '<div class="aviso" role="alert" hidden></div><div class="acoes"><button class="btn btn-laranja btn-grande" type="submit">Salvar</button><a class="btn btn-texto" href="' + base(d.id) + '/plano">Continuar depois</a></div></form>';
    tela(casca(d, "plano", h));
    var f = document.getElementById("fEntrada");
    var mais = document.getElementById("enMaisRk"); if (mais) mais.onclick = function () { document.getElementById("enRankings").insertAdjacentHTML("beforeend", linhaRanking({})); };
    var coletar = function () {
      var o = { expectativaFamilia: val("enExpF"), etapaEscolar: val("enEsc"), conclusaoPrevista: val("enConc"), viagens: val("enViag"), restricoes: val("enRestr") };
      if (!resp) Object.assign(o, { objetivo: val("enObj"), objetivoObs: val("enObjObs"), treinadorNome: val("enTreinador"), localTreino: val("enLocal"), historico: val("enHist"), expectativaAtleta: val("enExpA"),
        rankings: Array.prototype.map.call(document.querySelectorAll(".cr-rk"), function (l) { return { nome: l.querySelector("[data-k=nome]").value.trim(), posicao: l.querySelector("[data-k=posicao]").value.trim(), fonte: l.querySelector("[data-k=fonte]").value.trim(), data: l.querySelector("[data-k=data]").value }; }).filter(function (r) { return r.nome || r.posicao; }) });
      return o;
    };
    autoGuardar(f, "entrada-" + d.id, coletar);
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var corpo = { acao: "salvarEntrada", id: d.id, entrada: Object.assign({}, d.entrada || {}, coletar()) };
      if (!resp) { var dias = marcadosDe(f, "enDias"), min = Number(val("enMin")) || null; if (dias.length || min) corpo.rotina = { dias: dias, minutos: min }; }
      enviar(f.querySelector("button[type=submit]"), corpo, function (r) { limparR("entrada-" + d.id); toast(r.pronta ? "Cadastro salvo." : "Salvo. Você pode continuar depois."); invalidar(d.id); ir(base(d.id) + "/plano"); }, function (e) { aviso(f, e.message); });
    });
  }
  function linhaRanking(r) { return '<div class="cr-rk cr-linha-form"><input data-k="nome" aria-label="Ranking ou rating" placeholder="Ranking (ex.: CBT 16M)" value="' + esc(r.nome || "") + '"><input data-k="posicao" aria-label="Posição ou valor" placeholder="Posição" value="' + esc(r.posicao || "") + '"><input data-k="fonte" aria-label="Fonte" placeholder="Fonte" value="' + esc(r.fonte || "") + '"><input data-k="data" type="date" aria-label="Data" value="' + esc(r.data || "") + '"></div>'; }

  /* ── PARTIDA DO DIAGNÓSTICO ── */
  function telaPartidaDiag(d, n) {
    n = Number(n); var p = d.diagPartidas[n - 1]; if (!p) return ir(base(d.id) + "/evolucao");
    var cons = d.papel === "consultor", r = lerR("diag-" + d.id + "-" + n) || {}, v = function (k) { return r[k] !== undefined ? r[k] : p[k]; };
    var livres = (d.partidas || []).filter(function (x) { return !d.diagPartidas.some(function (y) { return y.partidaId === x.id; }) || x.id === p.partidaId; });
    var h = '<form id="fDiag" class="pl-form" novalidate><h2 class="secao">Partida ' + n + ' de 3</h2><p class="cr-linha"><span class="cr-st s-' + esc(p.status) + '">' + esc(ST_P[p.status]) + "</span></p>" +
      (!p.partidaId && livres.length ? bloco("Já registrou esta partida no app?", '<div class="campo"><label for="dgExist">Usar uma partida de Partidas</label><select id="dgExist"><option value="">Não, vou preencher abaixo</option>' + livres.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(dt(x.data) + (x.adversario ? " · " + x.adversario : "") + (x.placar ? " · " + x.placar : "")) + "</option>"; }).join("") + '</select></div><p class="nota">Assim a partida não fica duplicada.</p>') : "") +
      bloco("Partida", U.campo("dgData", "Data", v("data"), "date") + U.campo("dgTorneio", "Torneio", v("torneio")) + U.campo("dgCat", "Categoria", v("categoria"), "text", ' placeholder="Ex.: 16M"') + sel("dgSup", "Superfície", SUP, v("superficie") || "", "—") +
        U.campo("dgAdv", "Adversário", v("adversario")) + U.campo("dgPlacar", "Placar", v("placar"), "text", ' placeholder="Ex.: 6/4 3/6 10/8"') +
        (!p.partidaId ? sel("dgRes", "Resultado (para registrar também em Partidas)", { vitoria: "Vitória", derrota: "Derrota" }, r.resultado || "", "—") : "")) +
      bloco("Material", U.campo("dgVideo", "Link do vídeo da partida completa", v("video"), "url", ' placeholder="https://"') + '<p class="nota">YouTube (não listado), Google Drive ou outro link com https://. Só o endereço é guardado.</p>' + txtArea("dgCtx", "Contexto relevante", v("contexto"), 800, 3, "Fase do torneio, condições, como você estava, o que vale saber antes de assistir.")) +
      (cons ? bloco("Análise (só você vê)", sel("dgSt", "Situação", ST_P, v("status")) + '<fieldset class="cr-linhas" id="dgMarc"><legend>Marcações de tempo</legend>' + ((v("marcacoes") || []).length ? v("marcacoes") : [{}]).map(linhaMarc).join("") + '</fieldset><button type="button" class="btn btn-texto" id="dgMaisM">+ Marcação</button>' + txtArea("dgObs", "Observações de trabalho", v("obs"), 3000, 5)) : "") +
      '<div class="aviso" role="alert" hidden></div><div class="acoes"><button class="btn btn-laranja btn-grande" type="submit">Salvar</button><a class="btn btn-texto" href="' + base(d.id) + '/evolucao">Voltar sem salvar</a></div></form>';
    tela(casca(d, "evolucao", h));
    var f = document.getElementById("fDiag");
    var mm = document.getElementById("dgMaisM"); if (mm) mm.onclick = function () { document.getElementById("dgMarc").insertAdjacentHTML("beforeend", linhaMarc({})); };
    var coletar = function () {
      var o = { data: val("dgData"), torneio: val("dgTorneio"), categoria: val("dgCat"), superficie: val("dgSup"), adversario: val("dgAdv"), placar: val("dgPlacar"), video: val("dgVideo"), contexto: val("dgCtx"), resultado: val("dgRes") };
      if (cons) { o.status = val("dgSt"); o.obs = val("dgObs"); o.marcacoes = Array.prototype.map.call(document.querySelectorAll(".cr-marc"), function (l) { return { tempo: l.querySelector("[data-k=tempo]").value.trim(), nota: l.querySelector("[data-k=nota]").value.trim() }; }).filter(function (m) { return m.nota; }); }
      return o;
    };
    autoGuardar(f, "diag-" + d.id + "-" + n, coletar);
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var o = coletar(), res = o.resultado; delete o.resultado;
      var corpo = { acao: "salvarPartidaDiag", id: d.id, n: n, dados: o }, ex = document.getElementById("dgExist");
      if (ex && ex.value) corpo.partidaExistenteId = ex.value; else if (res) corpo.resultado = res;
      enviar(f.querySelector("button[type=submit]"), corpo, function (r) { limparR("diag-" + d.id + "-" + n); toast("Partida " + n + ": " + (ST_P[r.partida.status] || "salva").toLowerCase() + "."); invalidar(d.id); ir(base(d.id) + "/evolucao"); }, function (e) { aviso(f, e.message); });
    });
  }
  function linhaMarc(m) { return '<div class="cr-marc cr-linha-form"><input data-k="tempo" aria-label="Tempo no vídeo" placeholder="mm:ss" inputmode="numeric" value="' + esc(m.tempo || "") + '"><input data-k="nota" aria-label="O que acontece" placeholder="O que acontece" value="' + esc(m.nota || m.texto || "") + '"></div>'; }

  /* ── JOGOS ── */
  function telaJogos(d) {
    var regs = d.registros || [], porPartida = {}, h = "";
    regs.forEach(function (r) { if (r.tipo === "posjogo") (porPartida[r.partidaId] = porPartida[r.partidaId] || []).push(r); });
    var anPor = {}; (d.analises || []).forEach(function (a) { (anPor[a.partidaId || "_"] = anPor[a.partidaId || "_"] || []).push(a); });
    if (d.papel === "atleta" && ativa(d)) h += '<div class="acoes"><a class="btn btn-laranja btn-grande" href="' + base(d.id) + '/jogo-novo">Registrar jogo</a></div>';
    if (d.papel === "treinador" && ativa(d)) h += '<div class="acoes"><a class="btn btn-laranja btn-grande" href="' + base(d.id) + '/treino-novo">Registrar treino</a></div>';
    var parts = d.partidas || [];
    h += '<h2 class="secao">Jogos</h2>' + (parts.length ? parts.slice(0, 40).map(function (p) {
      var rs = porPartida[p.id] || [], as = anPor[p.id] || [];
      return '<article class="cartao cr-jogo"><p class="olho">' + esc(dt(p.data)) + (p.tipo === "treino" ? " · jogo-treino" : "") + "</p><h3>" + (p.adversario ? "Contra " + esc(p.adversario) : "Partida") + (p.resultado ? ' <span class="cr-res r-' + esc(p.resultado) + '">' + (p.resultado === "vitoria" ? "Vitória" : "Derrota") + "</span>" : "") + "</h3>" +
        '<p class="nota">' + esc([p.placar, SUP[p.superficie] || "", p.rodada].filter(Boolean).join(" · ")) + "</p>" + (p.video ? '<p><a href="' + esc(p.video) + '" target="_blank" rel="noopener noreferrer">Vídeo<span class="sr"> (abre em nova aba)</span></a></p>' : "") +
        rs.map(function (r) { return '<div class="cr-relato"><p class="olho">Relato de ' + esc(r.souAutor ? "você" : r.autorNome) + "</p>" + (r.aplicou ? "<p><strong>Conseguiu aplicar:</strong> " + esc(r.aplicou) + "</p>" : "") + (r.dificuldade ? "<p><strong>Principal dificuldade:</strong> " + esc(r.dificuldade) + "</p>" : "") + (r.obs ? '<p style="white-space:pre-wrap">' + esc(r.obs) + "</p>" : "") + (r.souAutor || d.papel === "consultor" ? quemVe(r.visivelPara) : "") + "</div>"; }).join("") +
        as.map(function (a) { return analiseHtml(a, p.video); }).join("") +
        (d.papel === "consultor" ? '<div class="acoes"><a class="btn btn-secundario" href="' + base(d.id) + "/analise/" + esc(p.id) + '">' + (as.length ? "Nova análise" : "Analisar") + "</a></div>" : "") + "</article>";
    }).join("") : vazio(d.papel === "atleta" ? "Nenhum jogo registrado ainda. Os jogos de Partidas também aparecem aqui." : "Nenhum jogo compartilhado."));
    var avulsas = anPor._ || []; if (avulsas.length) h += '<h2 class="secao">Outras análises</h2>' + avulsas.map(function (a) { return '<div class="cartao">' + analiseHtml(a, "") + "</div>"; }).join("");
    var treinos = regs.filter(function (r) { return r.tipo === "treino"; });
    if (treinos.length || d.papel === "treinador") h += '<h2 class="secao">Trabalho com o treinador</h2>' + (treinos.length ? treinos.map(function (r) {
      return '<article class="cartao cr-jogo"><p class="olho">' + esc(dt(r.data)) + " · " + esc(r.souAutor ? "você" : r.autorNome) + "</p><p><strong>Trabalhado:</strong> " + esc(r.trabalhado) + "</p>" + (r.resposta ? "<p><strong>Resposta do atleta:</strong> " + esc(r.resposta) + "</p>" : "") + (r.dificuldades ? "<p><strong>Dificuldades de aplicação:</strong> " + esc(r.dificuldades) + "</p>" : "") + (r.ajustes ? "<p><strong>Ajustes sugeridos:</strong> " + esc(r.ajustes) + "</p>" : "") + (r.souAutor || d.papel === "consultor" ? quemVe(r.visivelPara) : "") + "</article>";
    }).join("") : vazio("Nenhum registro de treino ainda."));
    tela(casca(d, "jogos", h));
  }
  function analiseHtml(a, video) {
    return '<div class="cr-analise"><p class="olho">Análise do Richard · ' + esc(dt(a.publicadoEm || a.atualizadoEm)) + "</p>" + (a.titulo ? "<h4>" + esc(a.titulo) + "</h4>" : "") + (a.resumo ? '<p style="white-space:pre-wrap">' + esc(a.resumo) + "</p>" : "") +
      (a.marcacoes && a.marcacoes.length ? '<ul class="cr-marcas">' + a.marcacoes.map(function (m) { return "<li>" + linkTempo(video, m.tempo) + " " + esc(m.texto) + "</li>"; }).join("") + "</ul>" : "") + "</div>";
  }
  /* registrar jogo: vários em sequência, reaproveitando torneio, superfície e data */
  function telaJogoNovo(d) {
    var r = lerR("jogo-" + d.id) || {}, ult = lerR("jogo-ult-" + d.id) || {};
    var v = function (k, padrao) { return r[k] !== undefined ? r[k] : ult[k] !== undefined ? ult[k] : padrao || ""; };
    var tors = {}; (d.torneios || []).forEach(function (t) { tors[t.id] = t.nome + (t.inicio ? " · " + curto(t.inicio) : ""); });
    var h = '<form id="fJogo" class="pl-form" novalidate>' +
      bloco("Resultado", U.campo("jgData", "Data", v("data", d.hoje), "date") + (Object.keys(tors).length ? sel("jgTor", "Torneio", tors, v("torneioId"), "Sem torneio / jogo-treino") : "") + U.campo("jgRod", "Rodada", v("rodada"), "text", ' placeholder="Ex.: oitavas"') +
        U.campo("jgAdv", "Adversário", r.adversario || "") + '<fieldset class="cr-checks cr-radio"><legend>Resultado</legend><label><input type="radio" name="jgRes" value="vitoria"' + (r.resultado === "vitoria" ? " checked" : "") + '> Vitória</label><label><input type="radio" name="jgRes" value="derrota"' + (r.resultado === "derrota" ? " checked" : "") + "> Derrota</label></fieldset>" +
        U.campo("jgPlacar", "Placar", r.placar || "") + sel("jgSup", "Superfície", { saibro: "Saibro", rapida: "Quadra rápida", grama: "Grama", outra: "Outra" }, v("superficie"), "—") + U.campo("jgVideo", "Link do vídeo (opcional)", r.videoLink || "", "url", ' placeholder="https://"')) +
      bloco("Depois do jogo", txtArea("jgAplic", "O que conseguiu aplicar", r.aplicou, 600, 2) + txtArea("jgDif", "Principal dificuldade", r.dificuldade, 600, 2) + txtArea("jgObs", "Observação livre", r.obs, 1200, 3) +
        checks("jgVer", { treinador: "Treinador", responsavel: "Responsáveis" }, r.ver || [], "Quem vê este relato, além do Richard") + '<p class="nota">Por padrão, só o Richard lê o seu relato. O resultado do jogo segue as permissões de Partidas.</p>') +
      '<div class="aviso" role="alert" hidden></div><div class="acoes"><button class="btn btn-laranja btn-grande" type="submit" data-depois="sair">Salvar</button><button class="btn btn-secundario" type="submit" data-depois="outro">Salvar e registrar outro</button></div></form>';
    tela(casca(d, "jogos", h));
    var f = document.getElementById("fJogo"), depois = "sair";
    f.querySelectorAll("button[type=submit]").forEach(function (b) { b.addEventListener("click", function () { depois = b.getAttribute("data-depois"); }); });
    var coletar = function () { var res = f.querySelector('input[name="jgRes"]:checked'); return { data: val("jgData"), torneioId: val("jgTor"), rodada: val("jgRod"), adversario: val("jgAdv"), resultado: res ? res.value : "", placar: val("jgPlacar"), superficie: val("jgSup"), videoLink: val("jgVideo"), aplicou: val("jgAplic"), dificuldade: val("jgDif"), obs: val("jgObs"), ver: marcadosDe(f, "jgVer") }; };
    autoGuardar(f, "jogo-" + d.id, coletar);
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var o = coletar();
      if (!o.resultado) return aviso(f, "Marque se foi vitória ou derrota.");
      var bt = f.querySelector('button[data-depois="' + depois + '"]');
      enviar(bt, { acao: "registrarJogo", id: d.id, partida: { data: o.data, torneioId: o.torneioId || null, rodada: o.rodada, adversario: o.adversario, resultado: o.resultado, placar: o.placar, superficie: o.superficie || null, videoLink: o.videoLink, tipo: o.torneioId ? "competicao" : "treino" },
        posjogo: { aplicou: o.aplicou, dificuldade: o.dificuldade, obs: o.obs }, visivelPara: o.ver }, function () {
        limparR("jogo-" + d.id); gravarR("jogo-ult-" + d.id, { data: o.data, torneioId: o.torneioId, rodada: "", superficie: o.superficie });
        invalidar(d.id); toast("Jogo registrado.");
        if (depois === "outro") telaJogoNovo(Object.assign({}, d)); else ir(base(d.id) + "/jogos");
      }, function (e) { aviso(f, e.message); });
    });
  }
  function telaTreinoNovo(d) {
    var r = lerR("treino-" + d.id) || {}, vig = d.planoVigente, prios = {};
    if (vig) vig.conteudo.prioridades.forEach(function (p) { prios[p.id] = p.titulo; });
    var h = '<form id="fTreino" class="pl-form" novalidate>' + bloco("Trabalho realizado", U.campo("trData", "Data", r.data || d.hoje, "date") + (Object.keys(prios).length ? sel("trPrio", "Prioridade relacionada", prios, r.prioridadeId || "", "Nenhuma em especial") : "") +
      txtArea("trTrab", "O que foi trabalhado", r.trabalhado, 800, 3) + txtArea("trResp", "Resposta do atleta", r.resposta, 600, 2) + txtArea("trDif", "Dificuldades de aplicação", r.dificuldades, 600, 2) + txtArea("trAj", "Ajustes sugeridos", r.ajustes, 600, 2) +
      checks("trVer", { atleta: "Atleta", responsavel: "Responsáveis" }, r.ver || ["atleta"], "Quem vê este registro, além do Richard")) +
      '<div class="aviso" role="alert" hidden></div><div class="acoes"><button class="btn btn-laranja btn-grande" type="submit">Salvar</button><a class="btn btn-texto" href="' + base(d.id) + '/jogos">Voltar sem salvar</a></div></form>';
    tela(casca(d, "jogos", h));
    var f = document.getElementById("fTreino");
    var coletar = function () { return { data: val("trData"), prioridadeId: val("trPrio"), trabalhado: val("trTrab"), resposta: val("trResp"), dificuldades: val("trDif"), ajustes: val("trAj"), ver: marcadosDe(f, "trVer") }; };
    autoGuardar(f, "treino-" + d.id, coletar);
    f.addEventListener("submit", function (ev) { ev.preventDefault(); var o = coletar(); enviar(f.querySelector("button[type=submit]"), Object.assign({ acao: "registrarTreino", id: d.id, visivelPara: o.ver }, o), function () { limparR("treino-" + d.id); invalidar(d.id); toast("Registro salvo."); ir(base(d.id) + "/jogos"); }, function (e) { aviso(f, e.message); }); });
  }
  function telaAnaliseEditor(d, partidaId) {
    var p = (d.partidas || []).filter(function (x) { return x.id === partidaId; })[0] || null, k = "analise-" + d.id + "-" + (partidaId || "geral"), r = lerR(k) || { titulo: p ? "Contra " + (p.adversario || "") : "", destinatarios: ["atleta"] };
    var h = '<form id="fAn" class="pl-form" novalidate>' + bloco(p ? "Análise do jogo de " + esc(dt(p.data)) : "Análise", (p ? '<p class="nota">' + esc([p.adversario ? "Contra " + p.adversario : "", p.placar].filter(Boolean).join(" · ")) + (p.video ? ' · <a href="' + esc(p.video) + '" target="_blank" rel="noopener noreferrer">vídeo</a>' : " · sem vídeo") + "</p>" : "") +
      U.campo("anTit", "Título", r.titulo) + txtArea("anRes", "Análise", r.resumo, 3000, 6) + '<fieldset class="cr-linhas" id="anMarc"><legend>Pontos ou situações com marcação de tempo</legend>' + ((r.marcacoes || []).length ? r.marcacoes : [{}]).map(linhaMarc).join("") + '</fieldset><button type="button" class="btn btn-texto" id="anMais">+ Marcação</button>' +
      checks("anDest", { atleta: "Atleta", treinador: "Treinador", responsavel: "Responsáveis" }, r.destinatarios, "Publicar para")) +
      '<div class="aviso" role="alert" hidden></div><div class="acoes"><button class="btn btn-laranja btn-grande" type="submit" data-pub="1">Publicar</button><button class="btn btn-secundario" type="submit" data-pub="0">Salvar rascunho</button></div></form>';
    tela(casca(d, "jogos", h));
    var f = document.getElementById("fAn"), pub = false;
    document.getElementById("anMais").onclick = function () { document.getElementById("anMarc").insertAdjacentHTML("beforeend", linhaMarc({})); };
    f.querySelectorAll("button[type=submit]").forEach(function (b) { b.addEventListener("click", function () { pub = b.getAttribute("data-pub") === "1"; }); });
    var coletar = function () { return { partidaId: partidaId || null, titulo: val("anTit"), resumo: val("anRes"), destinatarios: marcadosDe(f, "anDest"), marcacoes: Array.prototype.map.call(f.querySelectorAll(".cr-marc"), function (l) { return { tempo: l.querySelector("[data-k=tempo]").value.trim(), texto: l.querySelector("[data-k=nota]").value.trim() }; }).filter(function (m) { return m.texto; }) }; };
    autoGuardar(f, k, coletar);
    f.addEventListener("submit", async function (ev) {
      ev.preventDefault(); var bt = f.querySelector('button[data-pub="' + (pub ? 1 : 0) + '"]');
      var s = await enviar(bt, { acao: "salvarAnalise", id: d.id, conteudo: coletar() }, null, function (e) { aviso(f, e.message); }); if (!s) return;
      if (pub) { var p2 = await enviar(bt, { acao: "publicarAnalise", id: d.id, itemId: s.itemId }, null, function (e) { aviso(f, e.message + " O rascunho ficou salvo."); }); if (!p2) return; }
      limparR(k); invalidar(d.id); toast(pub ? "Análise publicada." : "Rascunho salvo. Só você vê."); ir(base(d.id) + "/jogos");
    });
  }

  /* ── CALENDÁRIO (os mesmos torneios e compromissos do app, com filtros) ── */
  function telaCalendario(d) {
    var f = estado.filtroCal, hoje = d.hoje, itens = (d.calendario || []).filter(function (x) { return (f === "todos" || x.tipo === f) && x.ate >= R_addDias(hoje, -30); });
    var porMes = {}; itens.forEach(function (x) { var m = x.data.slice(0, 7); (porMes[m] = porMes[m] || []).push(x); });
    var MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    var h = '<div class="cr-filtro-cal" role="group" aria-label="Filtrar por tipo">' + [["todos", "Tudo"], ["torneio", "Torneios"], ["reuniao", "Reuniões"], ["prazo", "Prazos"], ["compromisso", "Compromissos"], ["revisao", "Revisões"]].map(function (x) { return '<button type="button" data-cal="' + x[0] + '" aria-pressed="' + (f === x[0]) + '">' + x[1] + "</button>"; }).join("") + "</div>" +
      (Object.keys(porMes).length ? Object.keys(porMes).sort().map(function (m) {
        return '<h2 class="secao">' + MES[+m.slice(5, 7) - 1] + " de " + m.slice(0, 4) + '</h2><ul class="cr-cal">' + porMes[m].map(function (x) {
          return '<li class="t-' + esc(x.tipo) + (x.ate < hoje ? " passado" : "") + '"><span class="cr-cal-data">' + esc(curto(x.data)) + (x.ate !== x.data ? "–" + esc(curto(x.ate)) : "") + '</span><div><p class="olho">' + esc(CAL[x.tipo]) + "</p><p><strong>" + esc(x.titulo) + "</strong></p>" + (x.detalhe ? '<p class="nota">' + esc(x.detalhe) + "</p>" : "") + (x.link ? '<p><a href="' + esc(x.link) + '" target="_blank" rel="noopener noreferrer">Videochamada<span class="sr"> (abre em nova aba)</span></a></p>' : "") + "</div></li>";
        }).join("") + "</ul>";
      }).join("") : vazio("Nada no calendário com este filtro."));
    if (d.papel === "atleta") h += bloco("Incluir no calendário", '<p class="nota">Torneios entram pela Temporada e compromissos (escola, viagens, períodos indisponíveis) pelo Meu planejamento. Eles aparecem aqui automaticamente.</p><div class="cr-atalhos"><a class="btn btn-secundario" href="#/temporada">Temporada</a><a class="btn btn-secundario" href="#/planejamento">Meu planejamento</a></div>');
    if (d.papel === "consultor") h += formReuniao(d);
    tela(casca(d, "calendario", h));
    Array.prototype.forEach.call(document.querySelectorAll("[data-cal]"), function (b) { b.onclick = function () { estado.filtroCal = b.getAttribute("data-cal"); telaCalendario(d); }; });
    ligarReuniao(d);
  }
  function R_addDias(iso, n) { var x = new Date(iso + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function formReuniao(d) {
    var r = lerR("reuniao-" + d.id) || { participantes: ["atleta", "responsavel"] };
    var lista = (d.reunioes || []).map(function (m) { return "<li>" + esc(dt(m.data)) + (m.hora ? " " + esc(m.hora) : "") + " · " + esc(m.titulo) + " · " + esc((m.participantes || []).map(function (x) { return DEST[x]; }).join(", ")) + ' <button type="button" class="btn btn-texto" data-reun="' + esc(m.id) + '">Excluir</button></li>'; }).join("");
    return bloco("Reuniões", (lista ? '<ul class="cr-notas">' + lista + "</ul>" : "") + '<form id="fReun" novalidate>' + U.campo("reData", "Data", r.data || "", "date") + U.campo("reHora", "Horário", r.hora || "", "time") + U.campo("reTit", "Título", r.titulo || "Reunião de acompanhamento") + U.campo("reLink", "Link da videochamada (opcional)", r.link || "", "url", ' placeholder="https://"') +
      txtArea("rePauta", "Pauta (opcional)", r.pauta, 600, 2) + checks("rePart", { atleta: "Atleta", treinador: "Treinador", responsavel: "Responsáveis" }, r.participantes, "Participantes (quem vê no calendário)") + '<div class="aviso" role="alert" hidden></div><button class="btn btn-secundario" type="submit">Agendar reunião</button></form>');
  }
  function ligarReuniao(d) {
    var f = document.getElementById("fReun"); if (!f) return;
    var coletar = function () { return { data: val("reData"), hora: val("reHora"), titulo: val("reTit"), link: val("reLink"), pauta: val("rePauta"), participantes: marcadosDe(f, "rePart") }; };
    autoGuardar(f, "reuniao-" + d.id, coletar);
    f.addEventListener("submit", function (ev) { ev.preventDefault(); enviar(f.querySelector("button[type=submit]"), Object.assign({ acao: "salvarReuniao", id: d.id }, coletar()), function () { limparR("reuniao-" + d.id); invalidar(d.id); toast("Reunião agendada."); rota(d.id, "calendario"); }, function (e) { aviso(f, e.message); }); });
    Array.prototype.forEach.call(document.querySelectorAll("[data-reun]"), function (b) { b.onclick = function () { if (confirm("Excluir esta reunião?")) enviar(b, { acao: "excluirReuniao", id: d.id, reuniaoId: b.getAttribute("data-reun") }, function () { invalidar(d.id); rota(d.id, "calendario"); }); }; });
  }

  /* ── EVOLUÇÃO ── */
  function diagHtml(dg) {
    return SECOES_D.map(function (s) {
      var l = (dg.secoes && dg.secoes[s[0]]) || []; if (!l.length) return "";
      return "<h3>" + s[1] + '</h3><ul class="cr-diag">' + l.map(function (it) { return "<li>" + tag(it.natureza) + " " + esc(it.texto) + (it.evidencias && it.evidencias.length ? '<p class="nota">Evidências: ' + it.evidencias.map(function (e) { return "partida " + e.partida + (e.tempo ? " · " + esc(e.tempo) : "") + (e.nota ? " · " + esc(e.nota) : ""); }).join("; ") + "</p>" : "") + "</li>"; }).join("") + "</ul>";
    }).join("") + (dg.sintese ? '<p class="cr-resumo" style="margin-top:10px">' + esc(dg.sintese) + "</p>" : "");
  }
  function telaEvolucao(d) {
    var cons = d.papel === "consultor", h = "";
    h += bloco("Diagnóstico inicial", (d.diagnostico ? '<p class="nota">Publicado em ' + esc(dt(d.diagnostico.publicadoEm)) + '. Cada item mostra se é observação, interpretação, recomendação ou algo ainda a verificar.</p>' + diagHtml(d.diagnostico) : '<p class="nota">' + (cons && d.diagRascunho ? "Há um rascunho salvo. Ele só aparece para a equipe depois de publicado." : "O diagnóstico aparece aqui depois da análise das três partidas.") + "</p>") +
      '<h3>As três partidas</h3>' + partidasDiagLista(d) + (cons ? '<div class="acoes"><a class="btn btn-secundario" href="' + base(d.id) + '/diagnostico">' + (d.diagnostico ? "Revisar o diagnóstico" : "Escrever o diagnóstico") + "</a></div>" : ""));
    var pubs = (d.planos || []).filter(function (v) { return v.estado === "publicado" || v.estado === "substituido"; });
    h += bloco("Histórico das prioridades", pubs.length ? '<ul class="cr-hist-prio">' + pubs.map(function (v) { return '<li><p class="olho">Versão ' + v.versao + " · " + esc(EST_PL[v.estado]) + " · publicada em " + esc(dt(v.publicadoEm)) + "</p>" + prioridadesResumo(v) + "</li>"; }).join("") + "</ul>" : vazio("Nenhum plano publicado ainda."));
    var ind = [];
    if (d.planoVigente) d.planoVigente.conteudo.prioridades.forEach(function (p) { ind.push({ nome: p.titulo, valor: p.indicador, fonte: "Plano versão " + d.planoVigente.versao }); });
    (d.relatorios || []).forEach(function (r) { (r.indicadores || []).forEach(function (i) { ind.push({ nome: i.nome, valor: i.valor, fonte: (i.fonte ? i.fonte + " · " : "") + r.titulo }); }); });
    h += bloco("Indicadores definidos", ind.length ? '<div class="cr-tabela"><table><thead><tr><th>Indicador</th><th>O que acompanhar / valor</th><th>Fonte</th></tr></thead><tbody>' + ind.map(function (i) { return "<tr><td>" + esc(i.nome) + "</td><td>" + esc(i.valor) + "</td><td>" + esc(i.fonte) + "</td></tr>"; }).join("") + "</tbody></table></div>" : vazio("Os indicadores são definidos no plano de cada atleta."));
    h += bloco("Revisões e relatórios", ((d.relatorios || []).length ? '<ul class="cr-notas">' + d.relatorios.map(function (r) { return '<li><a href="' + base(d.id) + "/relatorio/" + esc(r.id) + '"><strong>' + esc(r.titulo) + "</strong></a>" + '<p class="nota">' + (r.estado === "publicado" ? "Publicado em " + esc(dt(r.publicadoEm)) + " · para " + esc(r.destinatarios.map(function (x) { return DEST[x]; }).join(", ")) : "Rascunho · só você vê") + "</p></li>"; }).join("") + "</ul>" : vazio("Nenhum relatório publicado ainda.")) +
      (cons ? '<div class="acoes"><a class="btn btn-secundario" href="' + base(d.id) + '/relatorio-editar/novo">Novo relatório</a></div>' : ""));
    tela(casca(d, "evolucao", h));
  }

  /* editor do diagnóstico (consultor) */
  function telaDiagEditor(d) {
    var k = "diagedit-" + d.id, mod = lerR(k) || JSON.parse(JSON.stringify(d.diagRascunho || d.diagnostico || { secoes: {}, sintese: "" }));
    var conc = d.diagPartidas.filter(function (p) { return p.status === "concluido"; }).length;
    var itemHtml = function (s, it, i) {
      return '<div class="cr-item-diag" data-sec="' + s + '" data-i="' + i + '"><div class="campo"><label for="dg-' + s + i + '">Item</label><textarea id="dg-' + s + i + '" data-k="texto" rows="2" maxlength="600">' + esc(it.texto || "") + "</textarea></div>" +
        '<div class="cr-linha-form"><select data-k="natureza" aria-label="Natureza">' + Object.keys(NAT).map(function (n) { return '<option value="' + n + '"' + ((it.natureza || SECOES_D.filter(function (x) { return x[0] === s; })[0][2]) === n ? " selected" : "") + ">" + NAT[n] + "</option>"; }).join("") + "</select>" +
        '<input data-k="ev" aria-label="Evidências" placeholder="Evidências: 1 03:10, 3 41:05" value="' + esc((it.evidencias || []).map(function (e) { return e.partida + (e.tempo ? " " + e.tempo : "") + (e.nota ? " " + e.nota : ""); }).join(", ")) + '"><button type="button" class="btn btn-texto" data-rm="1">Remover</button></div></div>';
    };
    var h = '<form id="fDg" class="pl-form" novalidate><h2 class="secao">Diagnóstico</h2><p class="nota">' + conc + " de 3 partidas com análise concluída. " + (conc < 3 ? "Dá para escrever e salvar, mas a publicação só libera com as três." : "Pronto para publicar quando você revisar.") + "</p>" +
      '<p class="nota">Observação precisa citar a partida (número e, se quiser, o tempo: “1 03:10”). O que ainda não tem base suficiente vai como “a verificar”.</p>' +
      bloco("Organizar com IA (opcional)", txtArea("dgIA", "Anotações para organizar", "", 6000, 4, "A IA usa só o que você escreveu aqui e nas partidas. O resultado vem para este formulário como rascunho: nada é salvo nem publicado sem você.") + '<button type="button" class="btn btn-secundario" id="btIA">Gerar rascunho</button><p class="nota" id="iaMsg" role="status"></p>') +
      SECOES_D.map(function (s) { var l = (mod.secoes && mod.secoes[s[0]]) || []; return bloco(s[1], '<div data-lista="' + s[0] + '">' + l.map(function (it, i) { return itemHtml(s[0], it, i); }).join("") + '</div><button type="button" class="btn btn-texto" data-add="' + s[0] + '">+ Item</button>'); }).join("") +
      bloco("Síntese", txtArea("dgSint", "Síntese para a família e o atleta", mod.sintese, 1500, 3)) +
      checks("dgDest", { atleta: "Atleta", treinador: "Treinador", responsavel: "Responsáveis" }, (d.diagnostico && d.diagnostico.destinatarios) || ["atleta", "treinador", "responsavel"], "Publicar para") +
      '<div class="aviso" role="alert" hidden></div><div class="acoes"><button class="btn btn-laranja btn-grande" type="submit" data-pub="1"' + (conc < 3 ? " disabled" : "") + '>Publicar</button><button class="btn btn-secundario" type="submit" data-pub="0">Salvar rascunho</button></div></form>';
    tela(casca(d, "evolucao", h));
    var f = document.getElementById("fDg"), pub = false;
    var coletar = function () {
      var o = { secoes: {}, sintese: val("dgSint") };
      SECOES_D.forEach(function (s) { o.secoes[s[0]] = Array.prototype.map.call(f.querySelectorAll('[data-sec="' + s[0] + '"]'), function (el) {
        return { texto: el.querySelector("[data-k=texto]").value.trim(), natureza: el.querySelector("[data-k=natureza]").value, evidencias: el.querySelector("[data-k=ev]").value.split(/[,;]/).map(function (t) { var m = /^\s*([123])\s*((?:\d{1,2}:)?\d{1,2}:\d{2})?\s*(.*)$/.exec(t); return m ? { partida: +m[1], tempo: m[2] || "", nota: (m[3] || "").trim() } : null; }).filter(Boolean) };
      }).filter(function (x) { return x.texto; }); });
      return o;
    };
    autoGuardar(f, k, coletar);
    f.addEventListener("click", function (ev) {
      var add = ev.target.closest("[data-add]"), rm = ev.target.closest("[data-rm]");
      if (add) { var s = add.getAttribute("data-add"), l = f.querySelector('[data-lista="' + s + '"]'); l.insertAdjacentHTML("beforeend", itemHtml(s, {}, l.children.length)); }
      if (rm) { rm.closest(".cr-item-diag").remove(); gravarR(k, coletar()); }
    });
    f.querySelectorAll("button[type=submit]").forEach(function (b) { b.addEventListener("click", function () { pub = b.getAttribute("data-pub") === "1"; }); });
    document.getElementById("btIA").onclick = function () { pedirIA(d, "diagnostico", val("dgIA"), document.getElementById("btIA"), function (r) { var s = r.secoes || {}; gravarR(k, { secoes: s, sintese: r.sintese || "" }); telaDiagEditor(d); document.getElementById("iaMsg").textContent = "Rascunho da IA aplicado ao formulário. Revise item por item antes de salvar."; }); };
    f.addEventListener("submit", async function (ev) {
      ev.preventDefault(); var bt = f.querySelector('button[data-pub="' + (pub ? 1 : 0) + '"]'), conteudo = coletar();
      if (!pub) return enviar(bt, { acao: "salvarDiagnostico", id: d.id, conteudo: conteudo }, function () { limparR(k); invalidar(d.id); toast("Rascunho salvo. Só você vê."); ir(base(d.id) + "/evolucao"); }, function (e) { aviso(f, e.message); });
      enviar(bt, { acao: "publicarDiagnostico", id: d.id, conteudo: conteudo, destinatarios: marcadosDe(f, "dgDest") }, function () { limparR(k); invalidar(d.id); toast("Diagnóstico publicado."); ir(base(d.id) + "/evolucao"); }, function (e) { aviso(f, e.message); });
    });
  }
  async function pedirIA(d, tipo, texto, bt, aplicar) {
    ocupado(bt, true, "Organizando…");
    try { var r = await api(FN, { metodo: "POST", corpo: { acao: "ia", id: d.id, tipo: tipo, texto: texto } }); ocupado(bt, false); aplicar(r.rascunho); toast(r.aviso); }
    catch (e) { ocupado(bt, false); var m = document.getElementById("iaMsg"); if (m) m.textContent = e.message; else toast(e.message, null, true); }
  }

  /* editor do plano de 90 dias (consultor): rascunho → treinador comenta → publicar; versões anteriores ficam no histórico */
  function telaPlanoEditor(d) {
    var aberto = (d.planos || []).filter(function (v) { return v.estado === "rascunho" || v.estado === "em_comentario"; })[0] || null, k = "planoedit-" + d.id;
    var mod = lerR(k) || JSON.parse(JSON.stringify((aberto || d.planoVigente || { conteudo: { prioridades: [] } }).conteudo));
    if (!mod.inicio) { mod.inicio = (d.ciclo && d.ciclo.inicio) || d.hoje; mod.fim = (d.ciclo && d.ciclo.fim) || R_addDias(mod.inicio, 89); mod.revisaoEm = R_addDias(mod.inicio, 44); }
    var prios = mod.prioridades && mod.prioridades.length ? mod.prioridades : [{ acoes: [{}] }];
    var acaoHtml2 = function (a) { return '<div class="cr-acao-ed cr-linha-form"><input data-k="texto" aria-label="Ação" placeholder="Ação" value="' + esc(a.texto || "") + '"><select data-k="resp" aria-label="Responsável">' + Object.keys(RESP).map(function (r) { return '<option value="' + r + '"' + ((a.responsavel || "atleta") === r ? " selected" : "") + ">" + RESP[r] + "</option>"; }).join("") + '</select><input data-k="prazo" type="date" aria-label="Prazo" value="' + esc(a.prazo || "") + '"><input data-k="id" type="hidden" value="' + esc(a.id || "") + '"></div>'; };
    var prioHtml = function (p, i) { return '<div class="cartao cr-bloco cr-prio-ed" data-prio="' + i + '"><p class="olho">Prioridade ' + (i + 1) + '</p><input data-k="id" type="hidden" value="' + esc(p.id || "") + '">' + '<div class="campo"><label>Prioridade</label><input data-k="titulo" value="' + esc(p.titulo || "") + '" maxlength="120"></div><div class="campo"><label>Situação inicial</label><textarea data-k="sit" rows="2" maxlength="600">' + esc(p.situacaoInicial || "") + '</textarea></div><div class="campo"><label>Indicador ou evidência da mudança</label><textarea data-k="ind" rows="2" maxlength="300">' + esc(p.indicador || "") + '</textarea></div><p class="nota"><strong>Ações</strong> (responsável e prazo)</p><div data-acoes>' + (p.acoes && p.acoes.length ? p.acoes : [{}]).map(acaoHtml2).join("") + '</div><button type="button" class="btn btn-texto" data-mais-acao>+ Ação</button></div>'; };
    var sugs = (d.sugestoes || []).filter(function (s) { return s.estado === "aberta"; });
    var tors = (d.torneios || []).filter(function (t) { return t.inicio >= mod.inicio; });
    var h = '<form id="fPl" class="pl-form" novalidate><h2 class="secao">Plano de 90 dias</h2><p class="nota">' + (aberto ? "Versão " + aberto.versao + " · " + esc(EST_PL[aberto.estado]) : d.planoVigente ? "Uma nova versão será criada; a versão " + d.planoVigente.versao + " continua no histórico." : "Primeira versão.") + "</p>" +
      (sugs.length ? bloco("Sugestões do treinador", '<ul class="cr-notas">' + sugs.map(function (s) { return '<li><p class="nota">' + esc(s.autorNome) + " · " + esc(dt(s.em)) + '</p><p style="white-space:pre-wrap">' + esc(s.texto) + '</p><div class="cr-linha-form"><input aria-label="Resposta" placeholder="Resposta ao treinador" data-resp-sug="' + esc(s.id) + '"><button type="button" class="btn btn-secundario" data-sug="' + esc(s.id) + '">Responder</button></div></li>'; }).join("") + "</ul>") : "") +
      (d.diagnostico ? bloco("Sugerir estrutura com IA (opcional)", '<p class="nota">A partir do diagnóstico publicado. Vem como rascunho para este formulário; os prazos você define.</p><button type="button" class="btn btn-secundario" id="btIAp">Sugerir estrutura</button><p class="nota" id="iaMsg" role="status"></p>') : "") +
      bloco("Ciclo", txtArea("plObj", "Objetivo principal", mod.objetivo, 400, 2) + '<div class="cr-tres">' + U.campo("plIni", "Início", mod.inicio, "date") + U.campo("plFim", "Fim", mod.fim, "date") + U.campo("plRev", "Revisão", mod.revisaoEm, "date") + "</div>") +
      '<div id="plPrios">' + prios.map(prioHtml).join("") + "</div>" + '<button type="button" class="btn btn-texto" id="plMaisP"' + (prios.length >= 3 ? " hidden" : "") + ">+ Prioridade (até três)</button>" +
      bloco("Calendário competitivo sugerido", txtArea("plCal", "Comentário", mod.calendario, 1200, 3) + (tors.length ? '<fieldset class="cr-checks"><legend>Torneios da Temporada</legend>' + tors.map(function (t) { return '<label><input type="checkbox" name="plTor" value="' + esc(t.id) + '"' + ((mod.torneioIds || []).indexOf(t.id) >= 0 ? " checked" : "") + "> " + esc(t.nome + " · " + curto(t.inicio)) + "</label>"; }).join("") + "</fieldset>" : "")) +
      '<div class="aviso" role="alert" hidden></div><div class="acoes"><button class="btn btn-laranja btn-grande" type="submit" data-fim="publicar">Publicar</button><button class="btn btn-secundario" type="submit" data-fim="enviar">Salvar e enviar ao treinador</button><button class="btn btn-secundario" type="submit" data-fim="salvar">Salvar rascunho</button></div></form>';
    tela(casca(d, "plano", h));
    var f = document.getElementById("fPl"), fim = "salvar";
    var coletar = function () {
      return { objetivo: val("plObj"), inicio: val("plIni"), fim: val("plFim"), revisaoEm: val("plRev"), calendario: val("plCal"), torneioIds: marcadosDe(f, "plTor"),
        prioridades: Array.prototype.map.call(f.querySelectorAll("[data-prio]"), function (el) {
          return { id: el.querySelector("input[data-k=id]").value, titulo: el.querySelector("[data-k=titulo]").value.trim(), situacaoInicial: el.querySelector("[data-k=sit]").value.trim(), indicador: el.querySelector("[data-k=ind]").value.trim(),
            acoes: Array.prototype.map.call(el.querySelectorAll(".cr-acao-ed"), function (a) { return { id: a.querySelector("[data-k=id]").value, texto: a.querySelector("[data-k=texto]").value.trim(), responsavel: a.querySelector("[data-k=resp]").value, prazo: a.querySelector("[data-k=prazo]").value }; }).filter(function (a) { return a.texto; }) };
        }).filter(function (p) { return p.titulo; }) };
    };
    autoGuardar(f, k, coletar);
    f.addEventListener("click", function (ev) {
      var ma = ev.target.closest("[data-mais-acao]"); if (ma) ma.previousElementSibling.insertAdjacentHTML("beforeend", acaoHtml2({}));
      if (ev.target.id === "plMaisP") { var c = document.getElementById("plPrios"); c.insertAdjacentHTML("beforeend", prioHtml({ acoes: [{}] }, c.children.length)); if (c.children.length >= 3) ev.target.hidden = true; }
      var sg = ev.target.closest("[data-sug]"); if (sg) { var sid = sg.getAttribute("data-sug"); enviar(sg, { acao: "responderSugestao", id: d.id, sugestaoId: sid, resposta: (f.querySelector('[data-resp-sug="' + sid + '"]') || {}).value || "" }, function () { toast("Resposta enviada ao treinador."); invalidar(d.id); }); }
    });
    var bIA = document.getElementById("btIAp"); if (bIA) bIA.onclick = function () { pedirIA(d, "plano", "", bIA, function (r) { gravarR(k, Object.assign(coletar(), { objetivo: r.objetivo || val("plObj"), prioridades: (r.prioridades || []).slice(0, 3) })); telaPlanoEditor(d); var m = document.getElementById("iaMsg"); if (m) m.textContent = "Estrutura sugerida aplicada. Revise e defina os prazos."; }); };
    f.querySelectorAll("button[type=submit]").forEach(function (b) { b.addEventListener("click", function () { fim = b.getAttribute("data-fim"); }); });
    f.addEventListener("submit", async function (ev) {
      ev.preventDefault(); var bt = f.querySelector('button[data-fim="' + fim + '"]');
      var s = await enviar(bt, { acao: "salvarPlano", id: d.id, conteudo: coletar() }, null, function (e) { aviso(f, e.message); }); if (!s) return;
      if (fim === "enviar") { if (!(await enviar(bt, { acao: "enviarPlano", id: d.id, planoId: s.planoId }, null, function (e) { aviso(f, e.message); }))) return; }
      if (fim === "publicar") { if (!(await enviar(bt, { acao: "publicarPlano", id: d.id, planoId: s.planoId }, null, function (e) { aviso(f, e.message + " O rascunho ficou salvo."); }))) return; }
      limparR(k); invalidar(d.id); toast(fim === "publicar" ? "Plano publicado." : fim === "enviar" ? "Enviado ao treinador para comentar." : "Rascunho salvo. Só você vê."); ir(base(d.id) + "/plano");
    });
  }

  /* ── RELATÓRIO: leitura no celular, PDF pela impressão do navegador; editor para o consultor ── */
  function relatorioCorpo(d, r) {
    return '<article class="cr-relatorio"><header class="cr-rel-cab"><img src="../assets/logo-quadralab-competicao-v3-120.png" alt="QuadraLab Competição" width="150" height="36"><div><p class="olho">' + SERV + "</p><h1>" + esc(r.titulo) + "</h1><p>" + esc(d.atleta.nome) + (r.periodoDe ? " · " + esc(dt(r.periodoDe)) + " a " + esc(dt(r.periodoAte)) : "") + "</p></div></header>" +
      (r.objetivo ? "<section><h2>Objetivo do ciclo</h2><p>" + esc(r.objetivo) + "</p></section>" : "") +
      "<section><h2>Prioridades trabalhadas</h2>" + r.prioridades.map(function (p) { return '<div class="cr-rel-prio"><h3>' + esc(p.titulo) + "</h3><dl><dt>Evidências observadas</dt><dd>" + esc(p.evidencias || "—") + "</dd>" + (p.evolucao ? "<dt>Evolução</dt><dd>" + esc(p.evolucao) + "</dd>" : "") + (p.dificuldades ? "<dt>Dificuldades</dt><dd>" + esc(p.dificuldades) + "</dd>" : "") + "</dl></div>"; }).join("") + "</section>" +
      (r.indicadores && r.indicadores.length ? '<section><h2>Indicadores</h2><div class="cr-tabela"><table><thead><tr><th>Indicador</th><th>Valor</th><th>Fonte</th></tr></thead><tbody>' + r.indicadores.map(function (i) { return "<tr><td>" + esc(i.nome) + "</td><td>" + esc(i.valor) + "</td><td>" + esc(i.fonte || "") + "</td></tr>"; }).join("") + "</tbody></table></div></section>" : "") +
      (r.proximasAcoes ? '<section><h2>Próximas ações</h2><p style="white-space:pre-wrap">' + esc(r.proximasAcoes) + "</p></section>" : "") +
      (r.decisoes ? '<section><h2>Decisões a discutir com a família e o treinador</h2><p style="white-space:pre-wrap">' + esc(r.decisoes) + "</p></section>" : "") +
      '<footer class="cr-rel-rod"><p>A evolução é avaliada pelas prioridades e evidências do ciclo, não apenas por ranking ou resultados. Este acompanhamento não promete bolsa, recrutamento ou carreira profissional.</p><p>' + (r.estado === "publicado" ? "Publicado em " + esc(dt(r.publicadoEm)) : "Rascunho") + " · Tecnologia QuadraLab · Metodologia MTY</p></footer></article>";
  }
  function telaRelatorio(d, rid) {
    var r = (d.relatorios || []).filter(function (x) { return x.id === rid; })[0];
    if (!r) return tela(casca(d, "evolucao", vazio("Relatório não encontrado ou não publicado para você.")));
    tela(casca(d, "evolucao", '<div class="acoes cr-naoimprimir"><button type="button" class="btn btn-laranja" id="btPdf">Salvar em PDF</button>' + (d.papel === "consultor" && r.estado !== "publicado" ? '<a class="btn btn-secundario" href="' + base(d.id) + "/relatorio-editar/" + esc(r.id) + '">Editar</a>' : "") + "</div>" + relatorioCorpo(d, r)));
    document.getElementById("btPdf").onclick = function () { document.body.classList.add("cr-imprimindo"); setTimeout(function () { window.print(); document.body.classList.remove("cr-imprimindo"); }, 50); };
  }
  function telaRelatorioEditor(d, itemId) {
    var atual = itemId && itemId !== "novo" ? (d.relatorios || []).filter(function (x) { return x.id === itemId; })[0] : null, k = "reledit-" + d.id + "-" + (atual ? atual.id : "novo");
    var vig = d.planoVigente, mod = lerR(k) || (atual ? JSON.parse(JSON.stringify(atual)) : { tipo: "revisao", titulo: "Revisão do ciclo", objetivo: vig ? vig.conteudo.objetivo : "", periodoDe: d.ciclo ? d.ciclo.inicio : "", periodoAte: d.hoje, prioridades: vig ? vig.conteudo.prioridades.map(function (p) { return { titulo: p.titulo }; }) : [{}], indicadores: [], destinatarios: ["atleta", "responsavel", "treinador"] });
    var prioHtml = function (p) { return '<div class="cartao cr-bloco cr-relp"><div class="campo"><label>Prioridade</label><input data-k="titulo" value="' + esc(p.titulo || "") + '"></div><div class="campo"><label>Evidências observadas</label><textarea data-k="evidencias" rows="3" maxlength="1200">' + esc(p.evidencias || "") + '</textarea></div><div class="campo"><label>Evolução</label><textarea data-k="evolucao" rows="2" maxlength="1000">' + esc(p.evolucao || "") + '</textarea></div><div class="campo"><label>Dificuldades</label><textarea data-k="dificuldades" rows="2" maxlength="800">' + esc(p.dificuldades || "") + "</textarea></div></div>"; };
    var indHtml = function (i) { return '<div class="cr-ind cr-linha-form"><input data-k="nome" aria-label="Indicador" placeholder="Indicador" value="' + esc(i.nome || "") + '"><input data-k="valor" aria-label="Valor" placeholder="Valor observado" value="' + esc(i.valor || "") + '"><input data-k="fonte" aria-label="Fonte" placeholder="Fonte (ex.: vídeos de out.)" value="' + esc(i.fonte || "") + '"></div>'; };
    var h = '<form id="fRel" class="pl-form" novalidate><h2 class="secao">' + (atual ? "Editar relatório" : "Novo relatório") + "</h2>" +
      bloco("Rascunho com IA (opcional)", '<p class="nota">A partir do plano, dos registros e das análises publicadas. Não inventa dados: onde não houver registro, diz que não há. Vem para este formulário como rascunho.</p><button type="button" class="btn btn-secundario" id="btIAr">Preparar rascunho</button><p class="nota" id="iaMsg" role="status"></p>') +
      bloco("Relatório", sel("rlTipo", "Tipo", { revisao: "Revisão periódica", final: "Relatório final do ciclo" }, mod.tipo) + U.campo("rlTit", "Título", mod.titulo) + '<div class="cr-tres">' + U.campo("rlDe", "De", mod.periodoDe, "date") + U.campo("rlAte", "Até", mod.periodoAte, "date") + "</div>" + txtArea("rlObj", "Objetivo do ciclo", mod.objetivo, 400, 2)) +
      '<div id="rlPrios">' + (mod.prioridades && mod.prioridades.length ? mod.prioridades : [{}]).map(prioHtml).join("") + "</div>" +
      bloco("Indicadores (opcional)", '<p class="nota">Só o que foi medido ou observado de fato, com a fonte.</p><div id="rlInds">' + (mod.indicadores && mod.indicadores.length ? mod.indicadores : [{}]).map(indHtml).join("") + '</div><button type="button" class="btn btn-texto" id="rlMaisI">+ Indicador</button>') +
      bloco("Próximos passos", txtArea("rlProx", "Próximas ações", mod.proximasAcoes, 1200, 3) + txtArea("rlDec", "Decisões a discutir com a família e o treinador", mod.decisoes, 1200, 3)) +
      checks("rlDest", { atleta: "Atleta", treinador: "Treinador", responsavel: "Responsáveis" }, mod.destinatarios, "Publicar para") +
      '<div class="aviso" role="alert" hidden></div><div class="acoes"><button class="btn btn-laranja btn-grande" type="submit" data-pub="1">Publicar</button><button class="btn btn-secundario" type="submit" data-pub="0">Salvar rascunho</button></div></form>';
    tela(casca(d, "evolucao", h));
    var f = document.getElementById("fRel"), pub = false;
    var coletar = function () {
      return { tipo: val("rlTipo"), titulo: val("rlTit"), periodoDe: val("rlDe"), periodoAte: val("rlAte"), objetivo: val("rlObj"), proximasAcoes: val("rlProx"), decisoes: val("rlDec"), destinatarios: marcadosDe(f, "rlDest"),
        prioridades: Array.prototype.map.call(f.querySelectorAll(".cr-relp"), function (el) { var g = function (x) { return el.querySelector("[data-k=" + x + "]").value.trim(); }; return { titulo: g("titulo"), evidencias: g("evidencias"), evolucao: g("evolucao"), dificuldades: g("dificuldades") }; }).filter(function (p) { return p.titulo; }),
        indicadores: Array.prototype.map.call(f.querySelectorAll(".cr-ind"), function (el) { var g = function (x) { return el.querySelector("[data-k=" + x + "]").value.trim(); }; return { nome: g("nome"), valor: g("valor"), fonte: g("fonte") }; }).filter(function (i) { return i.nome && i.valor; }) };
    };
    autoGuardar(f, k, coletar);
    document.getElementById("rlMaisI").onclick = function () { document.getElementById("rlInds").insertAdjacentHTML("beforeend", indHtml({})); };
    document.getElementById("btIAr").onclick = function () { pedirIA(d, "relatorio", "", document.getElementById("btIAr"), function (r) { gravarR(k, Object.assign(coletar(), { titulo: r.titulo || val("rlTit"), objetivo: r.objetivo || val("rlObj"), prioridades: (r.prioridades || []).slice(0, 3), proximasAcoes: r.proximasAcoes || "", decisoes: r.decisoes || "" })); telaRelatorioEditor(d, itemId); var m = document.getElementById("iaMsg"); if (m) m.textContent = "Rascunho da IA aplicado. Confira cada evidência antes de publicar."; }); };
    f.querySelectorAll("button[type=submit]").forEach(function (b) { b.addEventListener("click", function () { pub = b.getAttribute("data-pub") === "1"; }); });
    f.addEventListener("submit", async function (ev) {
      ev.preventDefault(); var bt = f.querySelector('button[data-pub="' + (pub ? 1 : 0) + '"]');
      var s = await enviar(bt, { acao: "salvarRelatorio", id: d.id, itemId: atual ? atual.id : undefined, conteudo: coletar() }, null, function (e) { aviso(f, e.message); }); if (!s) return;
      if (pub && !(await enviar(bt, { acao: "publicarRelatorio", id: d.id, itemId: s.itemId }, null, function (e) { aviso(f, e.message + " O rascunho ficou salvo."); }))) return;
      limparR(k); invalidar(d.id); toast(pub ? "Relatório publicado." : "Rascunho salvo. Só você vê."); ir(base(d.id) + "/relatorio/" + s.itemId);
    });
  }

  /* ── EQUIPE ── */
  function telaEquipe(d) {
    var eq = d.equipe || {}, gere = ativa(d) && (d.papel === "consultor" || d.papel === "atleta");
    var acoes = d.acoes || [], porResp = {}; acoes.filter(function (a) { return !a.feita; }).forEach(function (a) { (porResp[a.responsavel] = porResp[a.responsavel] || []).push(a); });
    var pessoa = function (nome, papel, extra, resp) { return '<li class="cr-pessoa"><div><p><strong>' + esc(nome) + '</strong></p><p class="nota">' + esc(papel) + (extra ? " · " + esc(extra) : "") + "</p>" + ((porResp[resp] || []).length ? '<p class="nota">Ações em aberto: ' + porResp[resp].length + "</p>" : "") + "</div></li>"; };
    var h = bloco("Quem está no acompanhamento", '<ul class="cr-equipe">' + pessoa("Richard Tsukada", "Consultor", "conduz o diagnóstico, o plano e as revisões", "consultor") + pessoa(d.atleta.nome, "Atleta", "", "atleta") +
      (eq.membros || []).map(function (m) { return '<li class="cr-pessoa"><div><p><strong>' + esc(m.nome) + '</strong></p><p class="nota">' + esc(m.tipo === "treinador" ? "Treinador" : "Responsável") + (m.desde ? " · desde " + esc(dt(m.desde)) : "") + "</p>" + ((porResp[m.tipo] || []).length ? '<p class="nota">Ações em aberto do ' + (m.tipo === "treinador" ? "treinador" : "responsável") + ": " + porResp[m.tipo].length + "</p>" : "") + "</div>" + (gere || (d.papel === "responsavel" && m.tipo === "treinador") ? '<button type="button" class="btn btn-texto" data-tirar="' + esc(m.vinculoId) + '">Retirar</button>' : "") + "</li>"; }).join("") + "</ul>");
    if (gere) {
      h += bloco("Convidar", '<p class="nota">O convite usa o mesmo código do app: a pessoa entra em Início › “Tenho um código”. ' + (d.atleta.menor ? "Como o atleta é menor de idade, o treinador só entra depois da aprovação de um responsável." : "O atleta aprova cada pedido.") + " Treinador e responsável não precisam contratar outro plano.</p>" +
        '<div class="cr-atalhos"><button type="button" class="btn btn-secundario" data-conv="treinador">Convidar treinador</button><button type="button" class="btn btn-secundario" data-conv="responsavel">Convidar responsável</button></div>' +
        ((eq.convites || []).length ? '<ul class="cr-notas">' + eq.convites.map(function (c) { return "<li><p><strong>" + esc(c.tipo === "treinador" ? "Treinador" : "Responsável") + "</strong> · " + (c.status === "convite" ? 'código <span class="cr-codigo">' + esc(c.codigo) + "</span> · vale até " + esc(dt(c.expiraEm)) : "aguardando aprovação" + (c.pessoa ? " de " + esc(c.pessoa) : "")) + "</p></li>"; }).join("") + "</ul>" : ""));
      if ((eq.candidatos || []).length) h += bloco("Já vinculados ao atleta no app", '<p class="nota">Incluir na consultoria dá acesso às prioridades, aos registros marcados e às publicações para o papel da pessoa.</p><ul class="cr-equipe">' + eq.candidatos.map(function (c) { return '<li class="cr-pessoa"><div><p><strong>' + esc(c.nome) + '</strong></p><p class="nota">' + esc(c.tipo === "treinador" ? "Treinador" : "Responsável") + '</p></div><button type="button" class="btn btn-secundario" data-incluir="' + esc(c.vinculoId) + '">Incluir</button></li>'; }).join("") + "</ul>");
    }
    h += bloco("O que cada um vê", '<dl class="cr-dl"><dt>Atleta</dt><dd>Plano publicado, análises e relatórios publicados para ele, os próprios registros. Não altera o que o Richard publica.</dd><dt>Treinador</dt><dd>Prioridades e o que for publicado para ele, os registros que o atleta marcar; registra o trabalho e sugere ajustes.</dd><dt>Responsáveis</dt><dd>Planejamento, compromissos e relatórios publicados para eles. Os relatos do atleta só aparecem se ele marcar.</dd><dt>Richard</dt><dd>Tudo do acompanhamento, mais as anotações privadas, que ninguém mais vê.</dd></dl>' +
      '<p class="nota">Revogar o vínculo no app (Início) ou retirar a pessoa aqui encerra o acesso na hora.</p>');
    tela(casca(d, "equipe", h));
    Array.prototype.forEach.call(document.querySelectorAll("[data-tirar]"), function (b) { b.onclick = function () { if (confirm("Retirar esta pessoa da consultoria? O vínculo no app continua; só o acesso à consultoria é encerrado.")) enviar(b, { acao: "removerEquipe", id: d.id, vinculoId: b.getAttribute("data-tirar") }, function () { invalidar(d.id); toast("Acesso à consultoria encerrado."); rota(d.id, "equipe"); }); }; });
    Array.prototype.forEach.call(document.querySelectorAll("[data-incluir]"), function (b) { b.onclick = function () { enviar(b, { acao: "incluirEquipe", id: d.id, vinculoId: b.getAttribute("data-incluir") }, function () { invalidar(d.id); toast("Incluído na equipe."); rota(d.id, "equipe"); }); }; });
    Array.prototype.forEach.call(document.querySelectorAll("[data-conv]"), function (b) { b.onclick = function () { enviar(b, { acao: "convidarEquipe", id: d.id, tipo: b.getAttribute("data-conv") }, function (r) { invalidar(d.id); toast("Código " + r.codigo + " criado. Quem aprova: " + r.aprova + "."); rota(d.id, "equipe"); }); }; });
  }

  /* ── rotas: #/consultoria · #/consultoria/{id}/{secao}[/…] ── */
  async function rota(id, secao, x) {
    if (!id) return telaLista();
    var d; carregando();
    try { d = await detalhe(id); } catch (e) { return erro(e); }
    var cons = d.papel === "consultor";
    switch (secao) {
      case "jogos": return telaJogos(d);
      case "calendario": return telaCalendario(d);
      case "evolucao": return telaEvolucao(d);
      case "equipe": return telaEquipe(d);
      case "cadastro": return d.papel === "treinador" ? telaPlano(d) : telaCadastro(d);
      case "partida": return telaPartidaDiag(d, x);
      case "jogo-novo": return d.papel === "atleta" ? telaJogoNovo(d) : telaJogos(d);
      case "treino-novo": return d.papel === "treinador" ? telaTreinoNovo(d) : telaJogos(d);
      case "relatorio": return telaRelatorio(d, x);
      case "diagnostico": return cons ? telaDiagEditor(d) : telaEvolucao(d);
      case "plano-editar": return cons ? telaPlanoEditor(d) : telaPlano(d);
      case "analise": return cons ? telaAnaliseEditor(d, x) : telaJogos(d);
      case "relatorio-editar": return cons ? telaRelatorioEditor(d, x) : telaEvolucao(d);
      default: return telaPlano(d);
    }
  }
  A.registrar("consultoria", function (id, secao, x) { rota(id ? decodeURIComponent(id) : "", secao || "plano", x ? decodeURIComponent(x) : ""); });
  window.QL_CONSULTORIA = { rota: rota, invalidar: invalidar };

  /* ── menu lateral recolhível (computador) ── */
  (function () {
    var lat = document.getElementById("lateral"); if (!lat || document.getElementById("btRecolher")) return;
    var guardado = false; try { guardado = localStorage.getItem("ql-comp-lateral") === "recolhido"; } catch (e) { /* sem armazenamento */ }
    lat.insertAdjacentHTML("beforeend", '<button type="button" class="lateral-recolher" id="btRecolher" aria-controls="lateral" aria-expanded="true">Recolher menu</button>');
    document.body.insertAdjacentHTML("beforeend", '<button type="button" class="lateral-abrir" id="btAbrirLateral" aria-controls="lateral" aria-expanded="false" hidden>Menu</button>');
    var bR = document.getElementById("btRecolher"), bA = document.getElementById("btAbrirLateral");
    function aplicar(rec) { document.body.classList.toggle("lat-recolhida", rec); bR.setAttribute("aria-expanded", String(!rec)); bA.hidden = !rec; bA.setAttribute("aria-expanded", String(!rec)); try { localStorage.setItem("ql-comp-lateral", rec ? "recolhido" : "aberto"); } catch (e) { /* sem armazenamento */ } }
    bR.onclick = function () { aplicar(true); bA.focus(); }; bA.onclick = function () { aplicar(false); bR.focus(); };
    aplicar(guardado);
  })();
})();
