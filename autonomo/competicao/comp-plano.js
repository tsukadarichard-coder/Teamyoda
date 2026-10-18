/* QuadraLab Competição — Meu planejamento (atleta) e revisão do planejamento (treinador, responsável).

   Usa as utilidades de player.js (window.QL_APP) e o servidor comp-planejamento. Nada aqui inventa dados: o que aparece vem do que o atleta
   cadastrou ou de uma versão com autoria. Uma versão aprovada só muda quando um treinador aprova outra. */
(function () {
  var A = window.QL_APP;
  if (!A) return;
  var esc = A.esc, api = A.api, tela = A.tela, toast = A.toast, ocupado = A.ocupado, ir = A.ir, dataCurta = A.dataCurta;

  var DIAS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];
  var ROT_DIA = { seg: "Segunda", ter: "Terça", qua: "Quarta", qui: "Quinta", sex: "Sexta", sab: "Sábado", dom: "Domingo" };
  var ROT_BLOCO = { preparacao: "Preparação", competicao: "Competição", recuperacao: "Recuperação" };
  var ROT_ORIGEM_FOCO = { foco: "Foco de treino", devolutiva: "Devolutiva do treinador", partida: "Partidas registradas", atleta: "Objetivo do atleta", treinador: "Observação do treinador" };
  var ROT_COMP = { viagem: "Viagem", escola: "Escola", indisponivel: "Período indisponível", outro: "Outro compromisso" };
  var ROT_TIPO_ATIV = { treino: "Treino", jogo_treino: "Jogo-treino", competicao: "Competição", recuperacao: "Recuperação", preparo: "Preparação", outro: "Outro" };
  var ESFORCO = ["Muito leve", "Leve", "Moderado", "Pesado", "Muito pesado"];
  var RECUP = ["Muito mal", "Mal", "Regular", "Bem", "Muito bem"];
  var ABAS = [["temporada", "Temporada"], ["semanas", "Próximas 4 semanas"], ["semana", "Esta semana"]];
  var abaAtual = "semana";

  function diaDe(iso) { return DIAS[(new Date(iso + "T12:00:00Z").getUTCDay() + 6) % 7]; }
  function curta(iso) { return iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) : ""; }
  function periodo(a, b) { return a === b ? curta(a) : curta(a) + " a " + curta(b); }
  function somar(iso, n) { var d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function voltar(href, rotulo) { return '<p style="margin-bottom:8px"><a class="btn btn-texto" href="' + href + '">‹ ' + esc(rotulo) + "</a></p>"; }
  function erroTela(e, href, rotulo) { tela(voltar(href, rotulo) + '<div class="aviso">' + esc(e.message) + "</div>"); }
  function quando(iso) { return iso ? dataCurta(String(iso).slice(0, 10)) : ""; }
  function chip(v) { return '<span class="pl-st ' + esc(v.status) + '">' + esc(v.rotulo) + "</span>"; }
  function lista(itens, cls) { return itens && itens.length ? '<ul class="' + (cls || "beneficios") + '">' + itens.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : ""; }
  function campo(id, rotulo, valor, tipo, extra) { return '<div class="campo"><label for="' + id + '">' + rotulo + '</label><input id="' + id + '" type="' + (tipo || "text") + '" value="' + esc(valor || "") + '"' + (extra || "") + "></div>"; }
  function escala(nome, rotulos, marcado) {
    return '<div class="escala">' + [1, 2, 3, 4, 5].map(function (n) {
      return '<label class="opcao"><input type="radio" name="' + nome + '" value="' + n + '"' + (marcado === n ? " checked" : "") + "><span>" + n + "<small>" + esc(rotulos[n - 1]) + "</small></span></label>";
    }).join("") + "</div>";
  }
  function marcado(form, nome) { var i = form.querySelector('input[name="' + nome + '"]:checked'); return i ? i.value : ""; }
  function ordemSemanas(v) { return ((v.conteudo || {}).semanas || []).slice().sort(function (a, b) { return a.inicio.localeCompare(b.inicio); }); }

  /* ── conteúdo de uma versão (leitura) ── */
  function focosHtml(focos) {
    if (!focos || !focos.length) return "";
    return '<ul class="beneficios">' + focos.map(function (f) { return "<li>" + esc(f.texto) + ' <span class="nota">(' + esc(ROT_ORIGEM_FOCO[f.origem] || f.origem) + ")</span></li>"; }).join("") + "</ul>";
  }
  function eventoHtml(e) { return "<li><strong>" + esc(e.tipo === "torneio" ? "Torneio" : ROT_COMP[e.tipo] || "Compromisso") + ":</strong> " + esc(e.titulo) + " · " + esc(periodo(e.inicio, e.fim)) + "</li>"; }
  function painelTemporada(v, d, ro) {
    var t = (v && v.conteudo && v.conteudo.temporada) || { blocos: [], objetivos: [], conflitos: [] };
    var blocos = (t.blocos || []).slice().sort(function (a, b) { return a.inicio.localeCompare(b.inicio); });
    var h = "";
    if (!ro) h += '<h2 class="secao">Torneios e prioridades</h2>';
    if (!ro) h += d && d.torneios && d.torneios.length ? d.torneios.map(function (x) {
      return '<a class="cartao comp-torneio" href="#/temporada/' + esc(x.id) + '" style="margin-top:8px"><p class="olho">' + esc(x.prioridade ? "Prioridade " + x.prioridade : "Prioridade a definir") + "</p><h2>" + esc(x.nome) + '</h2><p class="nota">' + esc(periodo(x.inicio, x.fim)) + (x.cidade ? " · " + esc(x.cidade) : "") + "</p></a>";
    }).join("") : '<div class="cartao" style="margin-top:8px"><p class="nota">Nenhum torneio à vista. <a href="#/temporada/novo">Adicione o próximo torneio</a> para ver os blocos de preparação, competição e recuperação.</p></div>';
    h += '<h2 class="secao">Blocos da temporada</h2>';
    h += blocos.length ? blocos.map(function (b) {
      return '<div class="pl-bloco ' + esc(b.tipo) + '"><i aria-hidden="true"></i><div><p class="olho">' + esc(ROT_BLOCO[b.tipo] || b.tipo) + " · " + esc(periodo(b.inicio, b.fim)) + "</p><h3>" + esc(b.rotulo) + "</h3></div></div>";
    }).join("") : '<p class="nota" style="margin-top:8px">' + (v ? "Sem torneios no período para formar blocos." : "Os blocos aparecem quando existe uma versão do planejamento.") + "</p>";
    if (t.conflitos && t.conflitos.length) h += '<h2 class="secao">Conflitos entre eventos e rotina</h2>' + t.conflitos.map(function (c) { return '<div class="pl-aviso">' + esc(c.texto) + "</div>"; }).join("");
    else if (v) h += '<p class="nota" style="margin-top:12px">Nenhum conflito encontrado entre os eventos, a rotina e os períodos indisponíveis informados.</p>';
    h += '<h2 class="secao">Objetivos de desenvolvimento</h2>' + (t.objetivos && t.objetivos.length ? lista(t.objetivos) : '<p class="nota" style="margin-top:8px">Nenhum objetivo informado. Inclua em <a href="#/planejamento/rotina">Rotina e compromissos</a>.</p>');
    var comps = (d && d.compromissos) || [];
    if (!ro) h += '<h2 class="secao">Viagens, escola e períodos indisponíveis</h2>' + (comps.length ? '<ul class="beneficios">' + comps.map(function (c) { return "<li><strong>" + esc(ROT_COMP[c.tipo] || "Compromisso") + ":</strong> " + esc(c.titulo) + " · " + esc(periodo(c.inicio, c.fim)) + "</li>"; }).join("") + "</ul>" : '<p class="nota" style="margin-top:8px">Nada informado. <a href="#/planejamento/rotina">Informe viagens, provas e períodos indisponíveis</a> para a sugestão considerar.</p>');
    return h;
  }
  function painelSemanas(v) {
    if (!v) return '<div class="cartao" style="margin-top:14px"><p class="nota">As próximas semanas aparecem quando existe uma versão do planejamento.</p></div>';
    return ordemSemanas(v).map(function (s) {
      return '<section class="cartao" style="margin-top:12px" aria-label="Semana de ' + esc(periodo(s.inicio, s.fim)) + '"><p class="olho">Semana ' + s.n + " · " + esc(periodo(s.inicio, s.fim)) + (s.revisao ? ' · <span class="pl-st em_revisao">Revisão do planejamento</span>' : "") + "</p><h2>" + esc(s.objetivo || "Objetivo a definir") + "</h2>" +
        (s.focos && s.focos.length ? '<p class="olho" style="margin-top:10px">Focos técnicos e táticos</p>' + focosHtml(s.focos) : '<p class="nota" style="margin-top:8px">Nenhum foco definido para esta semana.</p>') +
        (s.eventos && s.eventos.length ? '<p class="olho" style="margin-top:10px">Torneios, deslocamentos e compromissos</p><ul class="beneficios">' + s.eventos.map(eventoHtml).join("") + "</ul>" : "") +
        '<p class="olho" style="margin-top:10px">Atividades previstas</p>' + (s.atividades && s.atividades.length ? '<ul class="beneficios">' + s.atividades.map(function (a) {
          return "<li><strong>" + esc(ROT_DIA[diaDe(a.data)].slice(0, 3)) + " " + esc(curta(a.data)) + ":</strong> " + esc(a.titulo) + (a.minutos ? " · " + a.minutos + " min" : "") + "</li>";
        }).join("") + "</ul>" : '<p class="nota" style="margin-top:6px">Nenhuma atividade prevista. Informe os dias de treino em <a href="#/planejamento/rotina">Rotina e compromissos</a>.</p>') + "</section>";
    }).join("");
  }
  function registroDe(d, v, a) { return (d && d.execucoes || []).filter(function (x) { return x.atividadeId === a.id && x.versaoId === v.id; })[0] || null; }
  function formRegistro(idc, dataIso, r, titulo, pedirTitulo) {
    r = r || {};
    return '<form class="pl-reg pl-form" data-id="' + esc(idc) + '" data-data="' + esc(dataIso) + '" novalidate>' +
      (pedirTitulo ? campo("rt-" + idc, "O que você fez?", titulo, "text", ' maxlength="100"') : "") +
      '<fieldset><legend>Você fez a atividade?</legend><div class="opcoes duas">' + [["sim", "Sim"], ["parcial", "Em parte"], ["nao", "Não"]].map(function (o) {
        return '<label class="opcao"><input type="radio" name="feito-' + esc(idc) + '" value="' + o[0] + '"' + (r.feito === o[0] ? " checked" : "") + "><span>" + o[1] + "</span></label>";
      }).join("") + "</div></fieldset>" +
      '<fieldset><legend>Sua avaliação: esforço percebido <span class="nota">(opcional)</span></legend>' + escala("esf-" + idc, ESFORCO, r.esforco) + "</fieldset>" +
      '<fieldset><legend>Sua avaliação: recuperação <span class="nota">(opcional)</span></legend>' + escala("rec-" + idc, RECUP, r.recuperacao) + "</fieldset>" +
      '<div class="campo"><label for="ob-' + esc(idc) + '">Observações <span class="nota">(opcional)</span></label><textarea id="ob-' + esc(idc) + '" rows="3" maxlength="400">' + esc(r.obs || "") + "</textarea>" + A.botaoVoz("ob-" + idc) + "</div>" +
      '<div class="aviso" role="alert" hidden></div><button class="btn btn-primario" type="submit">Salvar registro</button></form>';
  }
  function painelSemana(v, d, ro) {
    if (!v) return '<div class="cartao" style="margin-top:14px"><h2>Sem planejamento para esta semana</h2><p class="nota" style="margin-top:6px">Gere uma sugestão inicial para ver as atividades de cada dia e registrar o que você fez.</p></div>';
    var s = ordemSemanas(v).filter(function (x) { return x.inicio <= d.hoje && d.hoje <= x.fim; })[0];
    if (!s) return '<div class="cartao" style="margin-top:14px"><h2>Esta semana fora da versão atual</h2><p class="nota" style="margin-top:6px">A versão atual cobre de ' + esc(curta(ordemSemanas(v)[0].inicio)) + " a " + esc(curta(ordemSemanas(v).slice(-1)[0].fim)) + '. Gere uma sugestão nova para atualizar as semanas.</p></div>';
    var h = '<section class="cartao" style="margin-top:12px"><p class="olho">Objetivo da semana · ' + esc(periodo(s.inicio, s.fim)) + "</p><h2>" + esc(s.objetivo || "Objetivo a definir") + "</h2>" + (s.focos && s.focos.length ? focosHtml(s.focos) : "") +
      (s.revisao ? '<p class="nota" style="margin-top:8px"><span class="pl-st em_revisao">Revisão do planejamento</span> Reserve um momento nesta semana para rever o plano.</p>' : "") + "</section>";
    if (v.conteudo.orientacoes) h += '<section class="cartao" style="margin-top:12px"><p class="olho">Orientações do treinador' + '<span class="comp-origem o-treinador">Observação do treinador</span></p><p style="margin-top:6px;white-space:pre-wrap">' + esc(v.conteudo.orientacoes) + "</p></section>";
    for (var i = 0; i < 7; i++) {
      var dt = somar(s.inicio, i), ats = (s.atividades || []).filter(function (a) { return a.data === dt; }), evs = (s.eventos || []).filter(function (e) { return e.inicio <= dt && dt <= e.fim && e.tipo !== "torneio"; });
      h += '<div class="pl-dia' + (dt === d.hoje ? " hoje" : "") + '"><h3>' + esc(ROT_DIA[diaDe(dt)]) + " · " + esc(curta(dt)) + (dt === d.hoje ? " · hoje" : "") + "</h3>";
      if (!ats.length && !evs.length) h += '<p class="nota">Sem atividade prevista.</p>';
      evs.forEach(function (e) { h += '<p class="nota"><strong>' + esc(ROT_COMP[e.tipo] || "Compromisso") + ":</strong> " + esc(e.titulo) + "</p>"; });
      ats.forEach(function (a) {
        var r = registroDe(d, v, a), podeRegistrar = !ro && dt <= d.hoje && a.tipo !== "competicao";
        h += '<div class="pl-ativ"><p><strong>' + esc(a.titulo) + "</strong>" + (a.minutos ? " · " + a.minutos + " min" : "") + "</p>" + (a.foco ? '<p class="nota">Foco: ' + esc(a.foco) + "</p>" : "") + (a.obs ? '<p class="nota">' + esc(a.obs) + "</p>" : "");
        if (r) h += '<p class="nota"><span class="comp-estado ok">Registrado: ' + esc({ sim: "feito", parcial: "feito em parte", nao: "não feito" }[r.feito] || r.feito) + "</span>" + (r.esforco ? " · esforço " + r.esforco + "/5" : "") + (r.recuperacao ? " · recuperação " + r.recuperacao + "/5" : "") + "</p>" + (r.obs ? '<p class="nota">Sua observação: ' + esc(r.obs) + "</p>" : "");
        if (ro) h += "";
        else if (a.tipo === "competicao") h += '<div class="acoes"><a class="btn btn-secundario btn-pequeno" href="#/partidas/nova">Registrar partida</a></div>';
        else if (podeRegistrar) h += '<details class="det"><summary>' + (r ? "Alterar o registro" : "Registrar") + "</summary>" + formRegistro(v.id + ":" + a.id, dt, r, a.titulo, false) + "</details>";
        else h += '<p class="nota">O registro abre no dia da atividade.</p>';
        h += "</div>";
      });
      h += "</div>";
    }
    if (!ro) h += '<details class="det" style="margin-top:14px"><summary>Registrar outra atividade</summary>' + formRegistro("livre", d.hoje, null, "", true) + "</details>";
    return h;
  }

  /* ── cabeçalho, ações e comparação de uma versão ── */
  function mudancasHtml(v) {
    var h = "";
    if (v.mudancas && v.mudancas.length) h += '<p class="olho" style="margin-top:10px">O que mudou no calendário</p>' + lista(v.mudancas);
    if (v.comparacao && v.comparacao.length) h += '<p class="olho" style="margin-top:10px">Comparação com a versão aprovada</p><ul class="pl-mud">' + v.comparacao.map(function (c) { return '<li class="' + esc(c.tipo) + '"><strong>' + esc({ adicionado: "Novo", removido: "Removido", alterado: "Alterado" }[c.tipo] || c.tipo) + ":</strong> " + esc(c.texto) + "</li>"; }).join("") + "</ul>";
    else if (v.substituiId) h += '<p class="nota" style="margin-top:8px">Sem diferenças nos blocos e nas semanas em comum com a versão aprovada.</p>';
    return h;
  }
  function fatoresHtml(v) {
    var f = v && v.conteudo && v.conteudo.fatores;
    if (!f) return "";
    return '<details class="det" style="margin-top:14px"><summary>O que esta versão considerou</summary><div style="margin-top:8px">' + (f.usado && f.usado.length ? '<p class="olho">Considerado</p>' + lista(f.usado) : "") +
      (f.faltando && f.faltando.length ? '<p class="olho" style="margin-top:8px">Não informado ou insuficiente</p>' + lista(f.faltando) : "") +
      (f.observacoes && f.observacoes.length ? f.observacoes.map(function (o) { return '<div class="pl-aviso">' + esc(o) + "</div>"; }).join("") : "") +
      '<p class="nota" style="margin-top:8px">O calendário sozinho não define a carga. Esta organização não é prescrição física nem orientação clínica: planejamento físico, restrições de saúde e retorno de lesão dependem dos profissionais habilitados que acompanham o atleta.</p></div></details>';
  }
  function historicoHtml(lista2, atualId) {
    if (!lista2 || !lista2.length) return "";
    return '<details class="det" style="margin-top:14px"><summary>Histórico de versões (' + lista2.length + ')</summary><ul class="pl-hist">' + lista2.map(function (x) {
      return "<li><strong>Versão " + x.versao + "</strong> " + chip(x) + '<br><span class="nota">' + esc(x.autorNome || "") + " · " + esc(quando(x.criadoEm)) + (x.aprovadoPorNome ? " · aprovada por " + esc(x.aprovadoPorNome) + " em " + esc(quando(x.aprovadoEm)) : "") + (x.id === atualId ? " · em exibição" : "") + "</span></li>";
    }).join("") + "</ul></details>";
  }
  function abasHtml(v, d, painelT, painelS, painelA) {
    var ini = v && d.semana ? "semana" : "temporada";
    abaAtual = abaAtual || ini;
    return '<div class="comp-abas" role="tablist" aria-label="Níveis do planejamento">' + ABAS.map(function (a) {
      return '<button type="button" role="tab" id="aba-' + a[0] + '" data-aba="' + a[0] + '" aria-selected="' + (a[0] === abaAtual) + '" aria-controls="pn-' + a[0] + '">' + a[1] + "</button>";
    }).join("") + "</div>" +
      [["temporada", painelT], ["semanas", painelS], ["semana", painelA]].map(function (p) { return '<div role="tabpanel" id="pn-' + p[0] + '" aria-labelledby="aba-' + p[0] + '"' + (p[0] === abaAtual ? "" : " hidden") + ">" + p[1] + "</div>"; }).join("");
  }
  function ligarAbas() {
    var abas = document.querySelectorAll("[data-aba]");
    Array.prototype.forEach.call(abas, function (b) {
      b.addEventListener("click", function () {
        abaAtual = b.getAttribute("data-aba");
        Array.prototype.forEach.call(abas, function (x) { x.setAttribute("aria-selected", String(x === b)); });
        ["temporada", "semanas", "semana"].forEach(function (k) { var p = document.getElementById("pn-" + k); if (p) p.hidden = k !== abaAtual; });
      });
    });
  }
  function ligarRegistros(d) {
    Array.prototype.forEach.call(document.querySelectorAll("form.pl-reg"), function (f) {
      f.addEventListener("submit", async function (ev) {
        ev.preventDefault();
        var av = f.querySelector(".aviso"); av.hidden = true;
        var idc = f.getAttribute("data-id"), partes = idc.split(":"), livre = idc === "livre";
        var corpo = { acao: "registrar", data: f.getAttribute("data-data"), feito: marcado(f, "feito-" + idc), esforco: marcado(f, "esf-" + idc) ? parseInt(marcado(f, "esf-" + idc), 10) : null, recuperacao: marcado(f, "rec-" + idc) ? parseInt(marcado(f, "rec-" + idc), 10) : null, obs: f.querySelector("textarea").value };
        if (livre) corpo.titulo = document.getElementById("rt-livre").value; else { corpo.versaoId = partes[0]; corpo.atividadeId = partes[1]; }
        if (!corpo.feito) { av.textContent = "Diga se você fez a atividade: sim, em parte ou não."; av.hidden = false; return; }
        var bt = f.querySelector("button[type=submit]"); ocupado(bt, true, "Salvando…");
        try { await api("comp-planejamento", { metodo: "POST", corpo: corpo }); toast("Registro salvo."); telaPrincipal(d._versaoId || null); }
        catch (e) { av.textContent = e.message; av.hidden = false; ocupado(bt, false); }
      });
    });
  }

  /* ── tela principal do atleta ── */
  function irPrincipal() { if (location.hash === "#/planejamento") telaPrincipal(null); else ir("#/planejamento"); }
  async function acao(corpo, btn, ok, depois) {
    if (btn) ocupado(btn, true);
    try { var r = await api("comp-planejamento", { metodo: "POST", corpo: corpo }); if (ok) toast(ok); if (depois) depois(r); else telaPrincipal(null); }
    catch (e) { toast(e.message, null, true); if (btn) ocupado(btn, false); }
  }
  async function telaPrincipal(versaoId) {
    tela('<p class="carregando">Carregando…</p>', true);
    var d;
    try { d = await api("comp-planejamento"); } catch (e) { erroTela(e, "#/inicio", "Início"); return; }
    d._versaoId = versaoId;
    if (!d.vigente) abaAtual = "temporada";
    var todas = (d.vigente ? [d.vigente] : []).concat(d.propostas || []);
    var v = versaoId ? todas.filter(function (x) { return x.id === versaoId; })[0] : d.vigente;
    if (versaoId && !v) { ir("#/planejamento"); return; }
    var h = (versaoId ? voltar("#/planejamento", "Meu planejamento") : "") + "<h1>Meu planejamento</h1>" + '<p class="sub">Organize sua preparação de acordo com seus objetivos, sua rotina e seus próximos torneios.</p>';
    h += '<div class="acoes"><a class="btn btn-secundario" href="#/planejamento/rotina">Rotina e compromissos</a></div>';
    var semResp = d.menor && !d.responsaveis;
    if (!v) {
      h += '<section class="cartao" style="margin-top:14px"><h2>Ainda sem planejamento</h2><p class="nota" style="margin-top:6px">Informe a sua rotina e os seus compromissos e gere uma sugestão inicial. Ela fica como sugestão para revisão até um treinador aprovar: não é um planejamento profissional.</p>' +
        '<div class="acoes"><button type="button" class="btn btn-laranja btn-grande" data-pl="gerar">Gerar sugestão inicial</button></div></section>';
    } else {
      var d0 = v;
      h += '<section class="cartao" style="margin-top:14px" aria-label="Situação do planejamento"><p class="olho">Versão ' + v.versao + (v.id === (d.vigente && d.vigente.id) ? " · vigente" : "") + "</p><h2>" + chip(v) + '</h2><p class="nota" style="margin-top:6px">' + esc(v.autorNome || "") + " · " + esc(quando(v.criadoEm)) + "</p>";
      if (v.status === "sugestao" && v.origem === "plataforma") h += '<div class="pl-aviso info">Sugestão da plataforma, montada por regras a partir dos seus dados. Precisa de revisão e <strong>não é um planejamento profissional aprovado</strong>.' + (d.temTreinador ? "" : " Você ainda não tem treinador vinculado com acesso ao planejamento.") + "</div>";
      else if (v.status === "sugestao") h += '<div class="pl-aviso info">Ajuste feito por você, sem revisão profissional.</div>';
      else if (v.status === "em_revisao") h += '<div class="pl-aviso">' + (v.origem === "treinador" ? "Rascunho do treinador ainda não aprovado." : "Enviado ao treinador para revisão. Aguarde a aprovação; você pode retirar o envio.") + "</div>";
      else if (v.status === "aprovado") h += '<div class="pl-aviso ok">Aprovado por ' + esc(v.aprovadoPorNome || "um treinador") + " em " + esc(quando(v.aprovadoEm)) + ". Este é o planejamento vigente.</div>";
      else h += '<div class="pl-aviso">Versão substituída: somente leitura.</div>';
      if (v.substituiId && v.status !== "aprovado") h += '<div class="pl-aviso info">Esta versão é uma <strong>proposta de ajuste</strong>. O plano aprovado continua valendo até um treinador aprovar esta.</div>' + mudancasHtml(v);
      var bt = "";
      if (v.status === "sugestao") {
        if (d.temTreinador) bt += '<button type="button" class="btn btn-primario" data-pl="enviar" data-id="' + esc(v.id) + '">Enviar para revisão do treinador</button>';
        else if (semResp) bt += '<a class="btn btn-primario" href="#/inicio">Vincular responsável</a><p class="nota">Como você é menor de idade, o responsável vem primeiro; depois ele aprova o treinador.</p>';
        else bt += '<a class="btn btn-secundario" href="#/inicio">Convidar um treinador</a><p class="nota">Compartilhe a área “Meu planejamento” no convite para ele poder revisar e aprovar.</p>';
        bt += '<a class="btn btn-secundario" href="#/planejamento/editar/' + esc(v.id) + '">Ajustar esta versão</a><button type="button" class="btn btn-texto" data-pl="descartar" data-id="' + esc(v.id) + '">Descartar esta sugestão</button>';
      } else if (v.status === "em_revisao" && v.origem !== "treinador") bt += '<button type="button" class="btn btn-secundario" data-pl="retirar" data-id="' + esc(v.id) + '">Retirar o envio</button>';
      else if (v.status === "aprovado") bt += '<a class="btn btn-secundario" href="#/planejamento/editar/' + esc(v.id) + '">Propor um ajuste</a><button type="button" class="btn btn-texto" data-pl="gerar">Gerar nova sugestão a partir do calendário atual</button>';
      if (d.treinadoresSemArea && d.treinadoresSemArea.length && !d.temTreinador) bt += '<p class="nota">Você tem treinador vinculado, mas sem acesso a esta área. Em Início, marque “Meu planejamento” no vínculo para ele poder revisar.</p>';
      h += (bt ? '<div class="acoes">' + bt + "</div>" : "") + "</section>";
      if (!versaoId && d.vigente && d.vigente.status === "aprovado" && (d.propostas || []).length) {
        h += '<section class="cartao comp-alerta" aria-labelledby="t-pa"><p class="olho">Proposta de ajuste</p><h2 id="t-pa">O seu calendário ou a sua rotina mudou</h2><p class="nota" style="margin-top:6px">O plano aprovado continua valendo. As propostas abaixo só passam a valer quando um treinador aprovar.</p>' +
          d.propostas.map(function (p) { return '<div class="comp-vinc" style="margin-top:10px"><p>' + chip(p) + ' <span class="nota">Versão ' + p.versao + " · " + esc(p.autorNome || "") + "</span></p>" + mudancasHtml(p) + '<div class="acoes"><a class="btn btn-secundario" href="#/planejamento/versao/' + esc(p.id) + '">Abrir a proposta</a></div></div>'; }).join("") + "</section>";
      } else if (!versaoId && d.mudou) {
        h += '<section class="cartao comp-alerta"><p class="olho">Proposta de ajuste</p><h2>O seu calendário mudou</h2>' + lista(d.motivosMudanca) + '<div class="acoes"><button type="button" class="btn btn-primario" data-pl="gerar">Gerar proposta de ajuste</button></div></section>';
      } else if (!versaoId && (d.propostas || []).length) {
        h += '<section class="cartao" style="margin-top:14px"><p class="olho">Outras versões em andamento</p>' + d.propostas.map(function (p) { return '<p style="margin-top:6px">' + chip(p) + ' <a href="#/planejamento/versao/' + esc(p.id) + '">Versão ' + p.versao + "</a></p>"; }).join("") + "</section>";
      }
    }
    h += abasHtml(v, d, painelTemporada(v, d), painelSemanas(v), painelSemana(v, d));
    h += fatoresHtml(v) + historicoHtml(d.historico, v && v.id);
    h += '<p class="nota" style="margin-top:14px">As datas dos torneios são as que você cadastrou. Confirme sempre no site oficial. Esta organização do treino não substitui orientação profissional.</p>';
    tela(h);
    ligarAbas(); ligarRegistros(d);
    Array.prototype.forEach.call(document.querySelectorAll("[data-pl]"), function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-pl"), id = b.getAttribute("data-id");
        if (k === "gerar") acao({ acao: "gerar" }, b, "Sugestão gerada.", irPrincipal);
        else if (k === "enviar") acao({ acao: "enviar", id: id }, b, "Enviado ao treinador para revisão.", irPrincipal);
        else if (k === "retirar") acao({ acao: "retirar", id: id }, b, "Envio retirado.", irPrincipal);
        else if (k === "descartar") { if (window.confirm("Descartar esta sugestão? Ela continua no histórico como substituída.")) acao({ acao: "descartar", id: id }, b, "Sugestão descartada.", irPrincipal); }
      });
    });
  }

  /* ── rotina e compromissos ── */
  async function telaRotina() {
    tela('<p class="carregando">Carregando…</p>', true);
    var d;
    try { d = await api("comp-planejamento"); } catch (e) { erroTela(e, "#/planejamento", "Meu planejamento"); return; }
    var r = d.rotina || { dias: [], objetivos: [] }, hoje = d.hoje;
    var h = voltar("#/planejamento", "Meu planejamento") + "<h1>Rotina e compromissos</h1>" + '<p class="sub">O que você informa aqui alimenta a sugestão. Se você já tem um plano aprovado, mudanças geram uma proposta de ajuste e o plano aprovado continua valendo.</p>';
    h += '<form id="fRotina" class="cartao pl-form" style="margin-top:14px" novalidate><h2>Rotina de treino</h2>' +
      '<fieldset><legend>Dias em que você costuma treinar</legend><div class="opcoes dias">' + DIAS.map(function (x) { return '<label class="opcao"><input type="checkbox" name="rdia" value="' + x + '"' + ((r.dias || []).indexOf(x) >= 0 ? " checked" : "") + "><span>" + ROT_DIA[x].slice(0, 3) + "</span></label>"; }).join("") + "</div></fieldset>" +
      '<div class="campo"><label for="rMin">Duração habitual do treino</label><select id="rMin"><option value="">Escolher</option>' + [30, 45, 60, 90, 120].map(function (m) { return '<option value="' + m + '"' + (r.minutos === m ? " selected" : "") + ">" + m + " minutos</option>"; }).join("") + "</select></div>" +
      '<div class="campo"><label for="rQuadra">Quadra</label><select id="rQuadra"><option value="">Não informar</option>' + Object.keys(d.rotulos.quadras).map(function (k) { return '<option value="' + k + '"' + (r.quadra === k ? " selected" : "") + ">" + esc(d.rotulos.quadras[k]) + "</option>"; }).join("") + "</select></div>" +
      '<div class="campo"><label for="rParc">Parceiros de treino</label><select id="rParc"><option value="">Não informar</option>' + Object.keys(d.rotulos.parceiros).map(function (k) { return '<option value="' + k + '"' + (r.parceiros === k ? " selected" : "") + ">" + esc(d.rotulos.parceiros[k]) + "</option>"; }).join("") + "</select></div>" +
      '<fieldset><legend>Objetivos de desenvolvimento <span class="nota">(até 5)</span></legend>' + [0, 1, 2, 3, 4].map(function (i) { return campo("rObj" + i, '<span class="sr">Objetivo ' + (i + 1) + "</span>", (r.objetivos || [])[i], "text", ' maxlength="120" placeholder="' + (i === 0 ? "Ex.: primeiro saque mais consistente" : "") + '"'); }).join("") + "</fieldset>" +
      '<div class="aviso" id="avisoRot" role="alert" hidden></div><button class="btn btn-primario" type="submit">Salvar rotina</button></form>';
    var comps = d.compromissos || [];
    h += '<section class="cartao" style="margin-top:14px"><h2>Viagens, escola e períodos indisponíveis</h2><p class="nota" style="margin-top:6px">A sugestão evita treinos nesses dias e avisa quando um torneio coincide com um compromisso.</p>' +
      (comps.length ? '<ul class="comp-lista">' + comps.map(function (c) { return '<li class="comp-vinc"><p><strong>' + esc(ROT_COMP[c.tipo] || "Compromisso") + ":</strong> " + esc(c.titulo) + '</p><p class="nota">' + esc(periodo(c.inicio, c.fim)) + (c.obs ? " · " + esc(c.obs) : "") + '</p><div class="acoes"><button type="button" class="btn btn-texto" data-excomp="' + esc(c.id) + '">Excluir</button></div></li>'; }).join("") + "</ul>" : '<p class="nota" style="margin-top:8px">Nenhum compromisso informado.</p>') +
      '<form id="fComp" class="pl-form" style="margin-top:12px" novalidate><div class="campo"><label for="cTipo">Tipo</label><select id="cTipo">' + Object.keys(d.rotulos.compromisso).map(function (k) { return '<option value="' + k + '">' + esc(d.rotulos.compromisso[k]) + "</option>"; }).join("") + "</select></div>" +
      campo("cTitulo", "Título", "", "text", ' maxlength="80" placeholder="Ex.: Provas do bimestre"') + '<div class="comp-duas">' + campo("cIni", "Início", hoje, "date") + campo("cFim", "Término (opcional)", "", "date") + "</div>" +
      '<div class="aviso" id="avisoComp" role="alert" hidden></div><button class="btn btn-secundario" type="submit">Adicionar compromisso</button></form></section>';
    tela(h);
    document.getElementById("fRotina").addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var av = document.getElementById("avisoRot"); av.hidden = true;
      var dias = Array.prototype.map.call(document.querySelectorAll('input[name="rdia"]:checked'), function (i) { return i.value; });
      var objs = [0, 1, 2, 3, 4].map(function (i) { return document.getElementById("rObj" + i).value.trim(); }).filter(Boolean);
      var bt = this.querySelector("button[type=submit]"); ocupado(bt, true, "Salvando…");
      try { await api("comp-planejamento", { metodo: "POST", corpo: { acao: "salvarRotina", dias: dias, minutos: parseInt(document.getElementById("rMin").value, 10) || null, quadra: document.getElementById("rQuadra").value, parceiros: document.getElementById("rParc").value, objetivos: objs } }); toast("Rotina salva."); telaRotina(); }
      catch (e) { av.textContent = e.message; av.hidden = false; ocupado(bt, false); }
    });
    document.getElementById("fComp").addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var av = document.getElementById("avisoComp"); av.hidden = true;
      var bt = this.querySelector("button[type=submit]"); ocupado(bt, true, "Salvando…");
      try { await api("comp-planejamento", { metodo: "POST", corpo: { acao: "salvarCompromisso", tipo: document.getElementById("cTipo").value, titulo: document.getElementById("cTitulo").value, inicio: document.getElementById("cIni").value, fim: document.getElementById("cFim").value } }); toast("Compromisso adicionado."); telaRotina(); }
      catch (e) { av.textContent = e.message; av.hidden = false; ocupado(bt, false); }
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-excomp]"), function (b) {
      b.addEventListener("click", async function () {
        if (!window.confirm("Excluir este compromisso?")) return;
        try { await api("comp-planejamento", { metodo: "POST", corpo: { acao: "excluirCompromisso", id: b.getAttribute("data-excomp") } }); telaRotina(); } catch (e) { toast(e.message, null, true); }
      });
    });
  }

  /* ── editor de versão (atleta e treinador) ── */
  function linhaAtiv(a, semana, i) {
    var dias = []; for (var k = 0; k < 7; k++) dias.push(somar(semana.inicio, k));
    return '<div class="pl-linha-ativ" data-ativ><div class="campo"><label>Dia</label><select data-f="data">' + dias.map(function (dt) { return '<option value="' + dt + '"' + (a.data === dt ? " selected" : "") + ">" + ROT_DIA[diaDe(dt)].slice(0, 3) + " " + curta(dt) + "</option>"; }).join("") + "</select></div>" +
      '<div class="campo"><label>Atividade</label><input data-f="titulo" maxlength="100" value="' + esc(a.titulo || "") + '"></div><div class="campo"><label>Minutos</label><input data-f="minutos" type="number" min="5" max="300" inputmode="numeric" value="' + esc(a.minutos || "") + '"></div>' +
      '<div class="campo"><label>Tipo</label><select data-f="tipo">' + Object.keys(ROT_TIPO_ATIV).map(function (t) { return '<option value="' + t + '"' + ((a.tipo || "treino") === t ? " selected" : "") + ">" + ROT_TIPO_ATIV[t] + "</option>"; }).join("") + "</select></div>" +
      '<input type="hidden" data-f="id" value="' + esc(a.id || "") + '"><input type="hidden" data-f="foco" value="' + esc(a.foco || "") + '"><button type="button" class="btn btn-texto" data-rmativ>Remover</button></div>';
  }
  function linhaFoco(f) {
    return '<div class="pl-linha-foco" data-foco style="display:flex;gap:8px;align-items:flex-end;margin-top:6px"><div class="campo" style="flex:1"><label class="sr">Foco</label><input data-f="texto" maxlength="120" value="' + esc(f.texto || "") + '"></div>' +
      '<input type="hidden" data-f="origem" value="' + esc(f.origem || "atleta") + '"><input type="hidden" data-f="refId" value="' + esc(f.refId || "") + '"><span class="nota" style="align-self:center">' + esc(ROT_ORIGEM_FOCO[f.origem] || "") + '</span><button type="button" class="btn btn-texto" data-rmfoco>Remover</button></div>';
  }
  function editorHtml(v, opcoes) {
    var c = v.conteudo, t = c.temporada || {}, h = '<form id="fEditor" class="pl-form" novalidate>';
    h += '<section class="cartao" style="margin-top:14px"><h2>Objetivos de desenvolvimento</h2>' + [0, 1, 2, 3, 4].map(function (i) { return campo("eObj" + i, '<span class="sr">Objetivo ' + (i + 1) + "</span>", (t.objetivos || [])[i], "text", ' maxlength="120"'); }).join("") + "</section>";
    h += '<section class="cartao" style="margin-top:14px"><h2>Blocos da temporada</h2><p class="nota" style="margin-top:6px">Ajuste as datas de cada bloco ou remova o que não se aplica.</p>' + (t.blocos || []).map(function (b, i) {
      return '<div class="pl-bloco ' + esc(b.tipo) + '" data-bloco="' + i + '"><i aria-hidden="true"></i><div><p class="olho">' + esc(ROT_BLOCO[b.tipo]) + "</p><h3>" + esc(b.rotulo) + '</h3><div class="comp-duas">' + campo("bIni" + i, "Início", b.inicio, "date") + campo("bFim" + i, "Término", b.fim, "date") + '</div><label class="comp-area"><input type="checkbox" id="bRm' + i + '"> Remover este bloco</label></div></div>';
    }).join("") + ((t.blocos || []).length ? "" : '<p class="nota" style="margin-top:8px">Sem blocos nesta versão.</p>') + "</section>";
    ordemSemanas(v).forEach(function (s, i) {
      h += '<section class="cartao" style="margin-top:14px" data-semana="' + i + '" data-inicio="' + esc(s.inicio) + '"><h2>Semana ' + s.n + " · " + esc(periodo(s.inicio, s.fim)) + "</h2>" + campo("sObj" + i, "Objetivo da semana", s.objetivo, "text", ' maxlength="200"') +
        '<label class="comp-area"><input type="checkbox" id="sRev' + i + '"' + (s.revisao ? " checked" : "") + "> Momento de revisão do planejamento</label>" +
        '<p class="olho" style="margin-top:10px">Focos técnicos e táticos</p><div data-focos>' + (s.focos || []).map(linhaFoco).join("") + '</div><button type="button" class="btn btn-secundario btn-pequeno" data-addfoco style="margin-top:8px">Adicionar foco</button>' +
        ((opcoes.focosAtleta || []).length ? '<div class="campo" style="margin-top:8px"><label for="sFA' + i + '">Foco a partir dos registros do atleta</label><select id="sFA' + i + '" data-focoatleta><option value="">Escolher um foco de treino</option>' + opcoes.focosAtleta.map(function (f) { return '<option value="' + esc(f.id) + '" data-texto="' + esc(f.texto) + '">' + esc(f.texto + (f.origemRotulo ? " · " + f.origemRotulo : "")) + "</option>"; }).join("") + '</select><p class="nota">A origem do registro fica guardada e o mesmo foco não entra duas vezes na semana.</p></div>' : "") +
        '<p class="olho" style="margin-top:10px">Atividades</p><div data-ativs>' + (s.atividades || []).map(function (a, j) { return linhaAtiv(a, s, j); }).join("") + '</div><button type="button" class="btn btn-secundario btn-pequeno" data-addativ style="margin-top:8px">Adicionar atividade</button></section>';
    });
    if (opcoes.papel === "treinador") h += '<section class="cartao" style="margin-top:14px"><h2>Orientações para o atleta</h2><div class="campo"><label for="eOrient" class="sr">Orientações</label><textarea id="eOrient" rows="5" maxlength="1200">' + esc(c.orientacoes || "") + "</textarea>" + A.botaoVoz("eOrient") + '<p class="nota">Aparece para o atleta como observação do treinador.</p></div></section>';
    h += '<div class="aviso" id="avisoEd" role="alert" hidden></div><div class="acoes">' + (opcoes.papel === "treinador"
      ? '<button class="btn btn-primario btn-grande" type="submit" data-fim="rascunho">Salvar como versão em revisão</button><button class="btn btn-laranja" type="submit" data-fim="aprovar">Salvar e aprovar</button>'
      : '<button class="btn btn-primario btn-grande" type="submit" data-fim="salvar">Salvar como nova versão</button>') + "</div></form>";
    return h;
  }
  function lerEditor(v) {
    var c = JSON.parse(JSON.stringify(v.conteudo)), t = c.temporada = c.temporada || {};
    t.objetivos = [0, 1, 2, 3, 4].map(function (i) { return document.getElementById("eObj" + i).value.trim(); }).filter(Boolean);
    t.blocos = [];
    (v.conteudo.temporada.blocos || []).forEach(function (b, i) {
      if (document.getElementById("bRm" + i).checked) return;
      var nb = JSON.parse(JSON.stringify(b)); nb.inicio = document.getElementById("bIni" + i).value; nb.fim = document.getElementById("bFim" + i).value; t.blocos.push(nb);
    });
    var sem = ordemSemanas(v);
    c.semanas = sem.map(function (s, i) {
      var box = document.querySelector('[data-semana="' + i + '"]');
      s.objetivo = document.getElementById("sObj" + i).value.trim(); s.revisao = document.getElementById("sRev" + i).checked;
      s.focos = Array.prototype.map.call(box.querySelectorAll("[data-foco]"), function (r) { return { texto: r.querySelector('[data-f="texto"]').value.trim(), origem: r.querySelector('[data-f="origem"]').value, refId: r.querySelector('[data-f="refId"]').value || null }; }).filter(function (f) { return f.texto; });
      s.atividades = Array.prototype.map.call(box.querySelectorAll("[data-ativ]"), function (r) {
        function g(k) { return r.querySelector('[data-f="' + k + '"]').value; }
        return { id: g("id") || undefined, data: g("data"), titulo: g("titulo").trim(), minutos: parseInt(g("minutos"), 10) || null, tipo: g("tipo"), foco: g("foco") };
      }).filter(function (a) { return a.titulo; });
      return s;
    });
    var o = document.getElementById("eOrient"); if (o) c.orientacoes = o.value;
    return c;
  }
  function ligarEditor(v, opcoes, enviar) {
    var f = document.getElementById("fEditor");
    f.addEventListener("click", function (ev) {
      var b = ev.target;
      if (b.hasAttribute("data-rmativ")) b.closest("[data-ativ]").remove();
      else if (b.hasAttribute("data-rmfoco")) b.closest("[data-foco]").remove();
      else if (b.hasAttribute("data-addativ")) { var box = b.closest("[data-semana]"), s = ordemSemanas(v)[parseInt(box.getAttribute("data-semana"), 10)]; box.querySelector("[data-ativs]").insertAdjacentHTML("beforeend", linhaAtiv({ data: s.inicio, tipo: "treino" }, s, 0)); }
      else if (b.hasAttribute("data-addfoco")) b.closest("[data-semana]").querySelector("[data-focos]").insertAdjacentHTML("beforeend", linhaFoco({ texto: "", origem: opcoes.papel === "treinador" ? "treinador" : "atleta" }));
    });
    f.addEventListener("change", function (ev) {
      var sl = ev.target;
      if (!sl.hasAttribute("data-focoatleta") || !sl.value) return;
      var box = sl.closest("[data-semana]"), op = sl.options[sl.selectedIndex], texto = op.getAttribute("data-texto"), ja = false;
      Array.prototype.forEach.call(box.querySelectorAll("[data-foco]"), function (r) { if (r.querySelector('[data-f="refId"]').value === sl.value || r.querySelector('[data-f="texto"]').value.trim().toLowerCase() === texto.toLowerCase()) ja = true; });
      if (ja) toast("Esse foco já está nesta semana."); else box.querySelector("[data-focos]").insertAdjacentHTML("beforeend", linhaFoco({ texto: texto, origem: "foco", refId: sl.value }));
      sl.value = "";
    });
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var fim = (ev.submitter && ev.submitter.getAttribute("data-fim")) || "salvar", av = document.getElementById("avisoEd"); av.hidden = true;
      var bt = ev.submitter || f.querySelector("button[type=submit]");
      ocupado(bt, true, "Salvando…");
      enviar(lerEditor(v), fim).catch(function (e) { av.textContent = e.message; av.hidden = false; ocupado(bt, false); });
    });
  }
  async function telaEditorAtleta(id) {
    tela('<p class="carregando">Carregando…</p>', true);
    var d;
    try { d = await api("comp-planejamento"); } catch (e) { erroTela(e, "#/planejamento", "Meu planejamento"); return; }
    var v = (d.vigente ? [d.vigente] : []).concat(d.propostas || []).filter(function (x) { return x.id === id; })[0];
    if (!v || v.status === "substituido") { ir("#/planejamento"); return; }
    tela(voltar("#/planejamento", "Meu planejamento") + "<h1>Ajustar o planejamento</h1>" + '<p class="sub">O ajuste vira uma nova versão sua, sem revisão profissional. ' + (v.status === "aprovado" ? "O plano aprovado continua valendo até um treinador aprovar o seu ajuste." : "") + "</p>" + editorHtml(v, { papel: "atleta", focosAtleta: d.focos || [] }));
    ligarEditor(v, { papel: "atleta" }, async function (conteudo) {
      await api("comp-planejamento", { metodo: "POST", corpo: { acao: "editar", baseId: v.id, conteudo: conteudo } });
      toast("Nova versão salva."); ir("#/planejamento");
    });
  }

  /* ── treinador e responsável: o planejamento do atleta ── */
  async function telaPlanoAtleta(vinculoId, sub, versaoId) {
    tela('<p class="carregando">Carregando…</p>', true);
    var r;
    try { r = await api("comp-planejamento?ver=" + encodeURIComponent(vinculoId)); } catch (e) { erroTela(e, "#/competicao/vinculo/" + vinculoId, "o atleta"); return; }
    var versoes = r.versoes || [], ativas = versoes.filter(function (x) { return x.status !== "substituido"; });
    var emRev = ativas.filter(function (x) { return x.status === "em_revisao"; });
    var sel = sub === "versao" || sub === "editar" ? versoes.filter(function (x) { return x.id === versaoId; })[0] : null;
    sel = sel || emRev[0] || r.vigente || ativas[0] || null;
    if (sub === "editar") {
      if (!r.podeEditar || !sel) { ir("#/planejamento/atleta/" + vinculoId); return; }
      tela(voltar("#/planejamento/atleta/" + vinculoId, "o planejamento de " + r.atleta.nome) + "<h1>Revisar o planejamento</h1>" + '<p class="sub">Você cria uma versão em revisão assinada por você. Ela só vale depois de aprovada, e a versão do atleta fica no histórico.</p>' + editorHtml(sel, { papel: "treinador", focosAtleta: r.focos || [] }));
      ligarEditor(sel, { papel: "treinador" }, async function (conteudo, fim) {
        var s1 = await api("comp-planejamento", { metodo: "POST", corpo: { acao: "treinadorSalvar", vinculoId: vinculoId, baseId: sel.id, conteudo: conteudo } });
        if (fim === "aprovar") { await api("comp-planejamento", { metodo: "POST", corpo: { acao: "aprovar", vinculoId: vinculoId, id: s1.id } }); toast("Versão aprovada."); } else toast("Versão em revisão salva.");
        ir("#/planejamento/atleta/" + vinculoId);
      });
      return;
    }
    var h = voltar("#/competicao/vinculo/" + vinculoId, r.atleta.nome) + "<h1>Planejamento de " + esc(r.atleta.nome) + "</h1>" + '<p class="sub">' + (r.podeEditar ? "Revise, ajuste e aprove. " : "Somente leitura. ") + 'Você vê o que o atleta compartilhou.</p>';
    if (!versoes.length) h += '<div class="cartao" style="margin-top:14px"><h2>Nenhum planejamento ainda</h2><p class="nota" style="margin-top:6px">O atleta ainda não gerou uma sugestão. Ela aparece aqui quando existir.</p></div>';
    else {
      h += '<h2 class="secao">Versões</h2>' + ativas.map(function (x) {
        var botoes = "";
        if (r.podeEditar) {
          if (x.status === "em_revisao") botoes += '<button type="button" class="btn btn-primario btn-pequeno" data-aprovar="' + esc(x.id) + '">Aprovar como está</button>';
          if (x.status !== "aprovado" || true) botoes += '<a class="btn btn-secundario btn-pequeno" href="#/planejamento/atleta/' + esc(vinculoId) + "/editar/" + esc(x.id) + '">' + (x.status === "aprovado" ? "Propor ajuste" : "Revisar e editar") + "</a>";
        }
        return '<article class="cartao" style="margin-top:10px"><p>' + chip(x) + ' <span class="nota">Versão ' + x.versao + " · " + esc(x.autorNome || "") + " · " + esc(quando(x.criadoEm)) + "</span></p>" +
          (x.status === "sugestao" ? '<p class="nota" style="margin-top:6px">Ainda não enviada para revisão pelo atleta.</p>' : "") + (x.substituiId ? mudancasHtml(x) : "") +
          '<div class="acoes"><a class="btn btn-secundario btn-pequeno" href="#/planejamento/atleta/' + esc(vinculoId) + "/versao/" + esc(x.id) + '">' + (sel && sel.id === x.id ? "Em exibição" : "Abrir") + "</a>" + botoes + "</div></article>";
      }).join("");
      if (sel) {
        h += '<h2 class="secao">Versão ' + sel.versao + " em exibição</h2>";
        var dd = { hoje: r.hoje, execucoes: r.execucoes, semana: r.semana, torneios: [], compromissos: [] };
        h += abasHtml(sel, dd, painelTemporada(sel, dd, true), painelSemanas(sel), painelSemana(sel, dd, true));
        h += fatoresHtml(sel);
      }
      h += '<h2 class="secao">Registros do atleta <span class="comp-origem o-relato">Relato do atleta</span></h2>' + (r.execucoes && r.execucoes.length ? '<ul class="comp-lista">' + r.execucoes.slice(0, 15).map(function (x) {
        return '<li class="comp-vinc"><p class="olho">' + esc(dataCurta(x.data)) + "</p><p><strong>" + esc(x.titulo || "Atividade do plano") + "</strong> · " + esc({ sim: "feito", parcial: "em parte", nao: "não feito" }[x.feito] || x.feito) + '</p><p class="nota">' + (x.esforco ? "Esforço percebido " + x.esforco + "/5" : "") + (x.recuperacao ? " · recuperação " + x.recuperacao + "/5" : "") + (x.obs ? " · " + esc(x.obs) : "") + "</p></li>";
      }).join("") + "</ul>" : '<p class="nota" style="margin-top:8px">Nenhum registro de atividade ainda.</p>');
      h += historicoHtml(versoes.map(function (x) { return { id: x.id, versao: x.versao, status: x.status, rotulo: x.rotulo, autorNome: x.autorNome, criadoEm: x.criadoEm, aprovadoPorNome: x.aprovadoPorNome, aprovadoEm: x.aprovadoEm }; }), sel && sel.id);
    }
    tela(h);
    ligarAbas();
    Array.prototype.forEach.call(document.querySelectorAll("[data-aprovar]"), function (b) {
      b.addEventListener("click", async function () {
        if (!window.confirm("Aprovar esta versão? Ela passa a ser o planejamento vigente e a aprovada anterior fica como substituída.")) return;
        ocupado(b, true, "Aprovando…");
        try { await api("comp-planejamento", { metodo: "POST", corpo: { acao: "aprovar", vinculoId: vinculoId, id: b.getAttribute("data-aprovar") } }); toast("Versão aprovada."); telaPlanoAtleta(vinculoId); }
        catch (e) { toast(e.message, null, true); ocupado(b, false); }
      });
    });
  }

  A.registrar("planejamento", function (a, b, c, d2) {
    if (a === "atleta" && b) return telaPlanoAtleta(b, c, d2);
    if (a === "rotina") return telaRotina();
    if (a === "editar" && b) return telaEditorAtleta(b);
    if (a === "versao" && b) return telaPrincipal(b);
    return telaPrincipal(null);
  });

  window.QL_COMP_UTIL = { esc: esc, chip: chip, curta: curta, periodo: periodo, quando: quando, voltar: voltar, erroTela: erroTela, lista: lista, campo: campo, ROT_DIA: ROT_DIA, diaDe: diaDe, somar: somar };
})();
