/* QuadraLab Competição — Acompanhamento MTY (oferta, painel do atleta e do responsável, condução pelo profissional) e os destaques da página inicial.

   Tudo vem de comp-acompanhamento / comp-planejamento. "Agendado", "Realizado" e "Revisado" só aparecem quando existe a ação correspondente
   registrada pelo profissional; nada de chamada, mensagem ou pagamento é simulado. O pagamento hoje é combinado no WhatsApp e confirmado pelo consultor. */
(function () {
  var A = window.QL_APP, U = window.QL_COMP_UTIL;
  if (!A || !U) return;
  var esc = A.esc, api = A.api, tela = A.tela, toast = A.toast, ocupado = A.ocupado, ir = A.ir, dataCurta = A.dataCurta;
  function reais(c) { return (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: c % 100 ? 2 : 0 }); }
  var chipAc = { aguardando_responsavel: "em_revisao", aguardando_pagamento: "em_revisao", aguardando_inicio: "em_revisao", ativo: "aprovado", encerrado: "substituido", cancelado: "substituido" };
  var ROT_ENC = { a_agendar: "A agendar", agendado: "Agendado", realizado: "Realizado", cancelado: "Cancelado" };
  function chipEstado(a) { return '<span class="pl-st ' + (chipAc[a.estado] || "sugestao") + '">' + esc(a.rotulo) + "</span>"; }
  function dt(iso) { return iso ? dataCurta(String(iso).slice(0, 10)) : ""; }
  function hora(e) { return dt(e.data) + (e.hora ? " às " + e.hora : ""); }
  function secao(titulo, corpo, extra) { return '<section class="cartao" style="margin-top:14px"' + (extra || "") + "><h2>" + titulo + "</h2>" + corpo + "</section>"; }

  /* ── oferta ── */
  function ofertaHtml(p) {
    var h = '<section class="cartao" style="margin-top:14px"><p class="olho">Programa inicial de ' + p.meses + ' meses</p><p class="ac-preco">' + p.parcelas + " × " + esc(reais(p.parcelaCentavos)) + "<small>3 pagamentos</small></p>" +
      '<p style="margin-top:8px"><strong>Investimento total: ' + esc(reais(p.totalCentavos)) + "</strong> em " + p.meses + " meses.</p><p class=\"nota\" style=\"margin-top:6px\">" + esc(p.formato) + '</p><p class="nota" style="margin-top:6px">' + esc(p.pagamentoNota) + "</p></section>";
    p.inclui.forEach(function (g) { h += secao(esc(g.titulo), U.lista(g.itens)); });
    h += secao("Não inclui", U.lista(p.naoInclui));
    h += '<section class="cartao" style="margin-top:14px"><p>' + esc(p.remoto) + '</p><p class="nota" style="margin-top:8px">' + esc(p.plataforma) + '</p><p class="nota" style="margin-top:8px">' + esc(p.analise) + ' <a href="#/consultorias">Ver as consultorias avulsas</a>.</p><p class="nota" style="margin-top:8px">' + esc(p.continuidade) + "</p></section>";
    return h;
  }
  function formSolicitar(r) {
    if (r.papel !== "atleta") return '<div class="pl-aviso info">O pedido é feito pelo atleta. O responsável confirma e responde pelo pagamento quando o atleta é menor de idade.</div>';
    if (r.menor && !r.responsaveis) return '<section class="cartao comp-alerta" style="margin-top:14px"><p class="olho">Primeiro passo</p><h2>Vincular responsável</h2><p class="nota" style="margin-top:6px">Como você é menor de idade, o responsável precisa estar vinculado: ele confirma o pedido e responde pelo pagamento.</p><div class="acoes"><a class="btn btn-primario btn-grande" href="#/inicio">Vincular responsável</a></div></section>';
    return '<form id="fSolicitar" class="cartao pl-form" style="margin-top:14px" novalidate><h2>Solicitar</h2>' +
      '<label class="comp-area"><input type="checkbox" id="acAceito"> Li as condições: programa de 3 meses, 3 pagamentos de R$ 790 (R$ 2.370 no total), encontros e acompanhamento remotos e sem renovação automática.</label>' +
      '<label class="comp-area"><input type="checkbox" id="acArtic"> Autorizo o profissional a conversar com o meu treinador presencial, quando houver. <span class="nota">(opcional)</span></label>' +
      (r.menor ? '<p class="nota">O responsável vinculado confirma o pedido e faz o pagamento.</p>' : "") +
      '<div class="aviso" id="avisoSol" role="alert" hidden></div><button class="btn btn-laranja btn-grande" type="submit">Solicitar o Acompanhamento MTY</button></form>';
  }
  function telaOferta(r) {
    tela(U.voltar("#/inicio", "Início") + "<h1>Acompanhamento MTY</h1>" + '<p class="sub">' + esc(r.produto.subtitulo) + "</p>" + ofertaHtml(r.produto) + formSolicitar(r));
    var f = document.getElementById("fSolicitar");
    if (f) f.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var av = document.getElementById("avisoSol"); av.hidden = true;
      if (!document.getElementById("acAceito").checked) { av.textContent = "Marque que leu as condições para solicitar."; av.hidden = false; return; }
      var bt = f.querySelector("button[type=submit]"); ocupado(bt, true, "Enviando…");
      try { var x = await api("comp-acompanhamento", { metodo: "POST", corpo: { acao: "solicitar", aceito: true, articulacao: document.getElementById("acArtic").checked } }); toast(x.estado === "aguardando_responsavel" ? "Pedido enviado. Falta o responsável confirmar." : "Pedido enviado. Agora é só combinar o pagamento."); ir("#/acompanhamento"); }
      catch (e) { av.textContent = e.message; av.hidden = false; ocupado(bt, false); }
    });
  }

  /* ── painel do atleta e do responsável ── */
  function parcelasHtml(a) {
    return '<ul class="ac-lista">' + a.parcelas.map(function (p) { return "<li><strong>Pagamento " + p.n + "</strong> · " + esc(reais(p.valorCentavos)) + " · " + (p.estado === "pago" ? '<span class="comp-estado ok">Pago, confirmado pelo consultor' + (p.pagoEm ? " em " + esc(dt(p.pagoEm)) : "") + "</span>" : '<span class="comp-estado espera">Pendente</span>') + "</li>"; }).join("") + "</ul>";
  }
  function encontrosHtml(a) {
    return '<ul class="ac-lista">' + a.encontros.map(function (e) {
      return "<li><p><strong>" + esc(e.rotulo) + "</strong> · " + e.duracaoMin + " min · " + '<span class="comp-estado ' + (e.estado === "realizado" ? "ok" : e.estado === "agendado" ? "espera" : "") + '">' + esc(ROT_ENC[e.estado] || e.estado) + "</span></p>" +
        '<p class="nota">' + (e.estado === "agendado" ? esc(hora(e)) + (e.link ? ' · <a href="' + esc(e.link) + '" target="_blank" rel="noopener noreferrer">Entrar na videochamada<span class="sr"> (abre em nova aba)</span></a>' : " · o link será informado pelo profissional") : e.estado === "realizado" ? "" : "Janela do encontro: " + esc(dt(e.janelaDe)) + " a " + esc(dt(e.janelaAte)) + ". O profissional agenda e você vê aqui.") + (e.participantes ? " · " + esc(e.participantes) : "") + "</p>" +
        (e.registro ? '<div class="comp-dev-bloco"><strong>Resumo do encontro <span class="comp-origem o-treinador">Observação do profissional</span></strong>' + esc(e.registro.resumo) + '</div><div class="comp-dev-bloco comp-dev-foco"><strong>Plano de ação</strong>' + esc(e.registro.planoDeAcao) + "</div>" : "") + "</li>";
    }).join("") + "</ul>";
  }
  function duvidasHtml(a, podePerguntar) {
    var h = a.duvidas.length ? '<ul class="ac-lista">' + a.duvidas.map(function (d) {
      if (d.autorPapel === "profissional") return '<li><p class="nota">Resposta de ' + esc(d.autorNome) + " · " + esc(dt(d.em)) + '</p><p style="white-space:pre-wrap">' + esc(d.texto) + "</p></li>";
      return '<li><p class="nota">Pergunta de ' + esc(d.autorNome || "você") + " · " + esc(dt(d.em)) + '</p><p style="white-space:pre-wrap">' + esc(d.texto) + "</p>" + (d.respondida ? "" : '<p class="nota"><span class="comp-estado espera">Aguardando resposta</span> prevista até ' + esc(dt(d.prazo)) + " (dois dias úteis)</p>") + "</li>";
    }).join("") + "</ul>" : '<p class="nota" style="margin-top:8px">Nenhuma pergunta ainda.</p>';
    if (podePerguntar) h += '<form id="fDuvida" style="margin-top:10px" novalidate><div class="campo"><label for="duTexto">Sua dúvida</label><textarea id="duTexto" rows="3" maxlength="1000"></textarea>' + A.botaoVoz("duTexto") + '</div><p class="nota">Resposta em até dois dias úteis. Para urgências, o canal não oferece atendimento imediato.</p><div class="aviso" id="avisoDu" role="alert" hidden></div><button class="btn btn-secundario" type="submit">Enviar dúvida</button></form>';
    return h;
  }
  function painelHtml(a, papel) {
    var h = '<section class="cartao" style="margin-top:14px"><p class="olho">Acompanhamento MTY</p><h2>' + esc(a.atletaNome) + "</h2><p>" + chipEstado(a) + "</p>" +
      '<p class="nota" style="margin-top:8px">' + (a.profissional ? "Profissional responsável: <strong>" + esc(a.profissional.nome) + "</strong>" : "Profissional ainda não definido.") + (a.inicio ? " · Ciclo de " + esc(dt(a.inicio)) + " a " + esc(dt(a.fim)) : "") + "</p></section>";
    if (a.estado === "aguardando_responsavel") {
      h += secao("Aguardando o responsável", papel === "responsavel" ? '<p class="nota" style="margin-top:6px">Ao confirmar, você passa a ser quem responde pelo pagamento do programa: ' + esc(reais(a.produto.totalCentavos)) + " em " + a.produto.parcelas + " pagamentos de " + esc(reais(a.produto.parcelaCentavos)) + ', combinados com o consultor.</p><div class="acoes"><button type="button" class="btn btn-laranja btn-grande" data-ac="confirmar">Confirmar o pedido</button></div>' : '<p class="nota" style="margin-top:6px">O seu responsável precisa confirmar o pedido no app dele. Quem confirma também responde pelo pagamento.</p>') +
        '<div class="acoes"><button type="button" class="btn btn-texto" data-ac="cancelar">Cancelar o pedido</button></div>';
    }
    if (a.estado === "aguardando_pagamento") {
      h += secao("Pagamento", '<p class="nota" style="margin-top:6px">' + esc(a.produto.parcelas + " pagamentos de " + reais(a.produto.parcelaCentavos) + " · total " + reais(a.produto.totalCentavos)) + ".</p>" + parcelasHtml(a) +
        '<p class="nota">O pagamento é combinado direto com o consultor pelo WhatsApp. Cada pagamento só aparece como pago depois que o consultor confirma. O aplicativo não faz cobrança.</p>' + (a.pagadorNome && papel !== "responsavel" && a.menor ? '<p class="nota">Quem paga: ' + esc(a.pagadorNome) + ".</p>" : "") +
        '<div class="acoes">' + (a.souPagador ? '<button type="button" class="btn btn-laranja btn-grande" data-ac="pagar">Combinar o pagamento pelo WhatsApp</button>' : "") + '<button type="button" class="btn btn-texto" data-ac="cancelar">Cancelar o pedido</button></div>');
    }
    if (a.estado === "aguardando_inicio") {
      h += secao("Falta iniciar o ciclo", '<p class="nota" style="margin-top:6px">O primeiro pagamento foi confirmado. O consultor define o profissional e a data de início.</p>' + parcelasHtml(a) + '<div class="pl-aviso info">Para começar, o profissional precisa estar vinculado a você com acesso à área “Meu planejamento”. Em Início, gere um convite de treinador e marque essa área' + (a.menor ? " (o responsável aprova o treinador)" : "") + ".</div>");
    }
    if (a.estado === "cancelado") h += secao("Pedido cancelado", '<p class="nota" style="margin-top:6px">Este pedido foi cancelado. Reembolsos, quando houver, são tratados com o consultor.</p>');
    if (a.estado === "ativo" || a.estado === "encerrado") {
      var pe = a.proximoEncontro;
      h += secao("Próximo encontro remoto", pe ? '<p style="margin-top:6px"><strong>' + esc(pe.rotulo) + "</strong> · " + esc(hora(pe)) + " · " + pe.duracaoMin + " min</p>" + (pe.link ? '<div class="acoes"><a class="btn btn-laranja" href="' + esc(pe.link) + '" target="_blank" rel="noopener noreferrer">Entrar na videochamada<span class="sr"> (abre em nova aba)</span></a></div>' : '<p class="nota">O link da videochamada será informado pelo profissional.</p>') : '<p class="nota" style="margin-top:6px">' + (a.estado === "encerrado" ? "Ciclo encerrado." : "Nenhum encontro agendado ainda. Quando o profissional agendar, a data aparece aqui.") + "</p>");
      var pl = a.plano || {};
      h += secao("Planejamento e prioridades da semana", (pl.vigente ? '<p style="margin-top:6px"><span class="pl-st ' + esc(pl.vigente.status) + '">' + esc(pl.vigente.rotulo) + "</span></p>" + (pl.vigente.aprovadoPorNome ? '<p class="nota">Aprovado por ' + esc(pl.vigente.aprovadoPorNome) + " em " + esc(dt(pl.vigente.aprovadoEm)) + ".</p>" : "") : '<p class="nota" style="margin-top:6px">Ainda não há planejamento vigente.</p>') +
        (pl.emRevisao ? '<p class="nota"><span class="comp-estado espera">Em revisão</span> Há uma versão aguardando a revisão do profissional.</p>' : "") +
        (pl.semana ? '<p class="olho" style="margin-top:10px">Esta semana</p><p><strong>' + esc(pl.semana.objetivo) + "</strong></p>" + (pl.semana.focos && pl.semana.focos.length ? U.lista(pl.semana.focos.map(function (f) { return f.texto; })) : "") : (pl.vigente ? '<p class="nota" style="margin-top:8px">A semana de hoje não está na versão vigente.</p>' : "")) +
        '<div class="acoes"><a class="btn btn-secundario" href="#/planejamento">Abrir meu planejamento</a></div>');
      var ud = a.ultimaDevolutiva;
      h += secao("Última devolutiva", ud ? '<p class="nota" style="margin-top:4px">Semana ' + ud.semana + " · " + esc(ud.autorNome) + " · " + esc(dt(ud.criadoEm)) + ' <span class="comp-origem o-treinador">Observação do profissional</span></p>' + (ud.destaques ? '<p class="comp-dev-bloco"><strong>O que foi bem</strong>' + esc(ud.destaques) + "</p>" : "") + (ud.melhorar ? '<p class="comp-dev-bloco"><strong>O que melhorar</strong>' + esc(ud.melhorar) + "</p>" : "") + (ud.foco ? '<p class="comp-dev-bloco comp-dev-foco"><strong>Foco de treino</strong>' + esc(ud.foco) + "</p>" : "") +
        (ud.audioLink ? '<div class="acoes"><a class="btn btn-secundario" href="' + esc(ud.audioLink) + '" target="_blank" rel="noopener noreferrer">Ouvir o áudio<span class="sr"> (abre em nova aba)</span></a></div>' : "") + '<div class="acoes"><a class="btn btn-secundario" href="#/devolutivas">Ver todas as devolutivas</a></div>' : '<p class="nota" style="margin-top:6px">Ainda sem devolutiva neste ciclo. A revisão acontece uma vez por semana, com base nos registros que você enviar.</p>');
      var ra = a.registrosAguardando || { total: 0, partidas: 0, treinos: 0 };
      h += secao("Registros aguardando revisão", '<p style="margin-top:6px"><strong>' + ra.total + "</strong> " + (ra.total === 1 ? "registro" : "registros") + " desde a última devolutiva (" + ra.partidas + (ra.partidas === 1 ? " partida" : " partidas") + ", " + ra.treinos + (ra.treinos === 1 ? " registro de treino" : " registros de treino") + ").</p><p class=\"nota\">A revisão se baseia nas informações efetivamente disponíveis: quanto mais você registra, melhor a devolutiva.</p>" +
        (a.estado === "ativo" && papel === "atleta" ? '<div class="acoes"><a class="btn btn-secundario" href="#/partidas/nova">Registrar partida</a><a class="btn btn-secundario" href="#/planejamento">Registrar treino da semana</a></div>' : ""));
      var rev = (a.revisoes || []), feitas = rev.filter(function (x) { return x.revisada; }).length, semN = a.ciclo ? a.ciclo.semanaAtual : null;
      h += secao("Revisões semanais", '<p class="nota" style="margin-top:6px">' + feitas + " de " + rev.length + " semanas com devolutiva" + (semN ? " · hoje é a semana " + semN : "") + ".</p>" + '<ul class="ac-lista">' + rev.filter(function (x) { return semN && x.n <= semN; }).slice().reverse().slice(0, 6).map(function (x) { return "<li>Semana " + x.n + " (" + esc(dt(x.de)) + " a " + esc(dt(x.ate)) + ") · " + (x.revisada ? '<span class="comp-estado ok">Revisada</span>' : '<span class="comp-estado">Sem devolutiva</span>') + "</li>"; }).join("") + "</ul>");
      h += secao("Encontros e planos de ação", encontrosHtml(a));
      h += secao("Canal de dúvidas", duvidasHtml(a, a.estado === "ativo" && (papel === "atleta" || papel === "responsavel")));
      if (a.estado === "encerrado" && a.encerramento) {
        h += secao("Encerramento do ciclo", '<p class="nota" style="margin-top:4px">Por ' + esc(a.encerramento.porNome || "") + " · " + esc(dt(a.encerramento.em)) + '</p><div class="comp-dev-bloco"><strong>Síntese do trabalho realizado</strong>' + esc(a.encerramento.sintese) + '</div><div class="comp-dev-bloco comp-dev-foco"><strong>Prioridades seguintes</strong>' + esc(a.encerramento.prioridades) + "</div>" +
          (a.continuidade && a.continuidade.estado === "proposta" ? '<div class="pl-aviso info"><strong>Proposta de continuidade:</strong> ' + esc(a.continuidade.texto) + ' Aceitar não cria cobrança automática: o consultor combina as condições com você.</div>' + (a.souPagador || (papel === "atleta" && !a.menor) ? '<div class="acoes"><button type="button" class="btn btn-laranja" data-ac="aceitarCont">Aceitar a proposta</button><button type="button" class="btn btn-secundario" data-ac="recusarCont">Não renovar agora</button></div>' : '<p class="nota">Quem decide é o responsável.</p>') : a.continuidade && a.continuidade.estado === "aceita" ? '<p class="pl-aviso ok">Proposta de continuidade aceita. O consultor entra em contato para combinar as condições; nenhuma cobrança é feita automaticamente.</p>' : a.continuidade && a.continuidade.estado === "recusada" ? '<p class="nota">Você optou por não renovar agora.</p>' : '<p class="nota">Sem proposta de continuidade neste momento.</p>') +
          '<p class="nota" style="margin-top:8px">Seus registros continuam na sua conta e podem ser baixados ou excluídos em <a href="#/conta">Meu perfil</a>. Não há renovação automática.</p>');
      }
    }
    h += '<details class="det" style="margin-top:14px"><summary>Condições do programa</summary><div style="margin-top:8px">' + parcelasHtml(a) + '<p class="nota">' + esc(a.produto.parcelas + " pagamentos de " + reais(a.produto.parcelaCentavos) + ", total " + reais(a.produto.totalCentavos) + ", programa de " + a.produto.meses + " meses, sem renovação automática.") + ' <a href="#/acompanhamento/oferta">Ver o que inclui e o que não inclui</a>.</p></div></details>';
    return h;
  }
  function ligarPainel(a, papel, recarregar) {
    function pedir(corpo, btn, ok) {
      ocupado(btn, true);
      api("comp-acompanhamento", { metodo: "POST", corpo: corpo }).then(function (x) {
        if (x.manual && x.contato) { window.open(x.contato, "_blank", "noopener"); toast("Combine o pagamento no WhatsApp. Depois da confirmação do consultor, ele aparece como pago."); ocupado(btn, false); return; }
        if (ok) toast(ok); recarregar();
      }).catch(function (e) { toast(e.message, null, true); ocupado(btn, false); });
    }
    Array.prototype.forEach.call(document.querySelectorAll("[data-ac]"), function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-ac");
        if (k === "confirmar") { if (window.confirm("Confirmar o pedido? Você passa a responder pelo pagamento e autoriza o programa para o atleta.")) pedir({ acao: "confirmar", id: a.id }, b, "Pedido confirmado."); }
        else if (k === "cancelar") { if (window.confirm("Cancelar este pedido?")) pedir({ acao: "cancelar", id: a.id }, b, "Pedido cancelado."); }
        else if (k === "pagar") pedir({ acao: "pagar", id: a.id }, b);
        else if (k === "aceitarCont") pedir({ acao: "decidirContinuidade", id: a.id, aceitar: true }, b, "Proposta aceita.");
        else if (k === "recusarCont") { if (window.confirm("Não renovar agora?")) pedir({ acao: "decidirContinuidade", id: a.id, aceitar: false }, b, "Registrado."); }
      });
    });
    var fd = document.getElementById("fDuvida");
    if (fd) fd.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var av = document.getElementById("avisoDu"); av.hidden = true;
      var bt = fd.querySelector("button[type=submit]"); ocupado(bt, true, "Enviando…");
      try { var x = await api("comp-acompanhamento", { metodo: "POST", corpo: { acao: "perguntar", id: a.id, texto: document.getElementById("duTexto").value } }); toast("Dúvida enviada. Resposta prevista até " + dt(x.respostaAte) + "."); recarregar(); }
      catch (e) { av.textContent = e.message; av.hidden = false; ocupado(bt, false); }
    });
  }

  /* ── condução pelo profissional ── */
  function campoTxt(id, rotulo, valor, tipo, extra) { return U.campo(id, rotulo, valor, tipo, extra); }
  function encontroProfHtml(a, e) {
    var h = "<li><p><strong>" + esc(e.rotulo) + "</strong> · " + e.duracaoMin + ' min · <span class="comp-estado ' + (e.estado === "realizado" ? "ok" : e.estado === "agendado" ? "espera" : "") + '">' + esc(ROT_ENC[e.estado] || e.estado) + "</span></p>" +
      '<p class="nota">Janela: ' + esc(dt(e.janelaDe)) + " a " + esc(dt(e.janelaAte)) + (e.estado === "agendado" ? " · " + esc(hora(e)) + (e.link ? " · " + esc(e.link) : "") : "") + "</p>";
    if (e.registro) return h + '<div class="comp-dev-bloco"><strong>Resumo registrado</strong>' + esc(e.registro.resumo) + '</div><div class="comp-dev-bloco comp-dev-foco"><strong>Plano de ação</strong>' + esc(e.registro.planoDeAcao) + "</div></li>";
    h += '<details class="det"><summary>Preparar (só você vê)</summary><form class="pl-form" data-prep="' + e.n + '" style="margin-top:8px"><div class="campo"><label for="pp' + e.n + '" class="sr">Preparação</label><textarea id="pp' + e.n + '" rows="3" maxlength="1500">' + esc(e.preparo || "") + '</textarea></div><button class="btn btn-secundario btn-pequeno" type="submit">Salvar preparação</button></form></details>';
    h += '<details class="det"><summary>' + (e.estado === "agendado" ? "Alterar o agendamento" : "Agendar") + '</summary><form class="pl-form" data-agendar="' + e.n + '" style="margin-top:8px"><div class="comp-duas">' + campoTxt("ag" + e.n + "d", "Data", e.data || "", "date") + campoTxt("ag" + e.n + "h", "Horário", e.hora || "", "time") + "</div>" + campoTxt("ag" + e.n + "l", "Link da videochamada (opcional)", e.link || "", "url", ' placeholder="https://" maxlength="300" inputmode="url"') + '<div class="aviso" role="alert" hidden></div><button class="btn btn-secundario btn-pequeno" type="submit">Salvar agendamento</button></form></details>';
    if (e.estado === "agendado") h += '<details class="det"><summary>Registrar que o encontro aconteceu</summary><form class="pl-form" data-regenc="' + e.n + '" style="margin-top:8px"><div class="campo"><label for="re' + e.n + 'r">Resumo do encontro</label><textarea id="re' + e.n + 'r" rows="4" maxlength="1500"></textarea>' + A.botaoVoz("re" + e.n + "r") + '</div><div class="campo"><label for="re' + e.n + 'p">Plano de ação combinado</label><textarea id="re' + e.n + 'p" rows="3" maxlength="1200"></textarea></div><div class="aviso" role="alert" hidden></div><button class="btn btn-primario btn-pequeno" type="submit">Registrar encontro</button></form></details>';
    return h + "</li>";
  }
  function profHtml(a) {
    var semN = a.ciclo ? a.ciclo.semanaAtual : null, rev = a.revisoes || [], pend = rev.filter(function (x) { return !x.revisada && semN && x.n <= semN; });
    var h = '<section class="cartao" style="margin-top:14px"><p class="olho">Acompanhamento MTY</p><h2>' + esc(a.atletaNome) + "</h2><p>" + chipEstado(a) + '</p><p class="nota" style="margin-top:8px">Ciclo de ' + esc(dt(a.inicio)) + " a " + esc(dt(a.fim)) + (semN ? " · semana " + semN : "") + "</p>" +
      (a.vinculoId ? '<div class="acoes"><a class="btn btn-laranja" href="#/planejamento/atleta/' + esc(a.vinculoId) + '">Planejamento e registros do atleta</a><a class="btn btn-secundario" href="#/competicao/vinculo/' + esc(a.vinculoId) + '">Dados compartilhados</a></div>' : "") + "</section>";
    var ra = a.registrosAguardando || { total: 0, partidas: 0, treinos: 0 };
    h += secao("Pendências", '<ul class="ac-lista"><li><strong>' + ra.total + "</strong> " + (ra.total === 1 ? "registro aguardando" : "registros aguardando") + " revisão (" + ra.partidas + " partida(s), " + ra.treinos + " de treino) <span class=\"comp-origem o-relato\">Relato do atleta</span></li><li><strong>" + pend.length + "</strong> " + (pend.length === 1 ? "semana sem devolutiva" : "semanas sem devolutiva") + "</li><li><strong>" + (a.pendentes ? a.pendentes.duvidas : 0) + "</strong> " + ((a.pendentes && a.pendentes.duvidas === 1) ? "dúvida sem resposta" : "dúvidas sem resposta") + " (prazo de dois dias úteis)</li></ul>");
    if (a.estado === "ativo") {
      h += secao("Devolutiva da semana", '<form id="fRev" class="pl-form" novalidate><div class="campo"><label for="rvSem">Semana</label><select id="rvSem">' + rev.filter(function (x) { return semN && x.n <= semN; }).slice().reverse().map(function (x) { return '<option value="' + x.n + '"' + (x.revisada ? " disabled" : "") + ">Semana " + x.n + " (" + esc(dt(x.de)) + " a " + esc(dt(x.ate)) + ")" + (x.revisada ? " · já revisada" : "") + "</option>"; }).join("") + "</select></div>" +
        '<div class="campo"><label for="rvBem">O que foi bem</label><textarea id="rvBem" rows="3" maxlength="600"></textarea>' + A.botaoVoz("rvBem") + '</div><div class="campo"><label for="rvMel">O que melhorar</label><textarea id="rvMel" rows="3" maxlength="600"></textarea></div>' + campoTxt("rvFoco", "Foco de treino (opcional)", "", "text", ' maxlength="200"') + campoTxt("rvAudio", "Link do áudio (opcional, https://)", "", "url", ' maxlength="300" inputmode="url" placeholder="https://"') +
        '<p class="nota">A devolutiva fica ligada à semana e aparece para o atleta e, no caso de menor de idade, para o responsável. Baseie-se no que foi registrado.</p><div class="aviso" id="avisoRv" role="alert" hidden></div><button class="btn btn-primario" type="submit">Enviar devolutiva</button></form>');
    }
    h += secao("Encontros remotos", '<ul class="ac-lista">' + a.encontros.map(function (e) { return a.estado === "ativo" ? encontroProfHtml(a, e) : "<li><strong>" + esc(e.rotulo) + "</strong> · " + esc(ROT_ENC[e.estado] || e.estado) + "</li>"; }).join("") + "</ul>");
    var abertas = (a.duvidas || []).filter(function (d) { return d.autorPapel !== "profissional" && !d.respondida; });
    h += secao("Dúvidas", (a.duvidas.length ? '<ul class="ac-lista">' + a.duvidas.map(function (d) {
      return d.autorPapel === "profissional" ? '<li><p class="nota">Sua resposta · ' + esc(dt(d.em)) + '</p><p style="white-space:pre-wrap">' + esc(d.texto) + "</p></li>" :
        '<li><p class="nota">Pergunta de ' + esc(d.autorNome || "atleta") + " · " + esc(dt(d.em)) + '</p><p style="white-space:pre-wrap">' + esc(d.texto) + "</p>" + (d.respondida ? "" : '<p class="nota"><span class="comp-estado espera">Sem resposta</span> até ' + esc(dt(d.prazo)) + '</p><form class="pl-form" data-resp="' + esc(d.id) + '"><div class="campo"><label class="sr" for="rs' + esc(d.id) + '">Resposta</label><textarea id="rs' + esc(d.id) + '" rows="3" maxlength="1500"></textarea></div><button class="btn btn-secundario btn-pequeno" type="submit">Responder</button></form>') + "</li>";
    }).join("") + "</ul>" : '<p class="nota" style="margin-top:6px">Nenhuma pergunta.</p>') + (abertas.length ? "" : ""));
    if (a.estado === "ativo") {
      var enc4 = a.encontros.filter(function (e) { return e.n === 4 && e.estado === "realizado"; }).length;
      h += secao("Encerrar o ciclo", '<form id="fEnc" class="pl-form" novalidate><div class="campo"><label for="enSin">Síntese do trabalho realizado</label><textarea id="enSin" rows="4" maxlength="2000"></textarea>' + A.botaoVoz("enSin") + '</div><div class="campo"><label for="enPri">Prioridades seguintes</label><textarea id="enPri" rows="3" maxlength="1000"></textarea></div><div class="campo"><label for="enCont">Proposta de continuidade (opcional)</label><textarea id="enCont" rows="3" maxlength="800" placeholder="Só quando fizer sentido para o atleta"></textarea></div>' +
        (enc4 ? "" : '<label class="comp-area"><input type="checkbox" id="enSem"> Encerrar sem registrar o encontro de avaliação do ciclo (o quarto)</label>') + '<div class="aviso" id="avisoEn" role="alert" hidden></div><button class="btn btn-secundario" type="submit">Encerrar o ciclo</button></form>');
    }
    return h;
  }
  function ligarProf(a, recarregar) {
    function enviar(corpo, form, ok) {
      var av = form.querySelector(".aviso"); if (av) av.hidden = true;
      var bt = form.querySelector("button[type=submit]"); ocupado(bt, true, "Salvando…");
      return api("comp-acompanhamento", { metodo: "POST", corpo: Object.assign({ id: a.id }, corpo) }).then(function () { toast(ok); recarregar(); }).catch(function (e) { if (av) { av.textContent = e.message; av.hidden = false; } else toast(e.message, null, true); ocupado(bt, false); });
    }
    Array.prototype.forEach.call(document.querySelectorAll("form[data-prep]"), function (f) { f.addEventListener("submit", function (ev) { ev.preventDefault(); var n = parseInt(f.getAttribute("data-prep"), 10); enviar({ acao: "preparar", n: n, texto: f.querySelector("textarea").value }, f, "Preparação salva."); }); });
    Array.prototype.forEach.call(document.querySelectorAll("form[data-agendar]"), function (f) { f.addEventListener("submit", function (ev) { ev.preventDefault(); var n = parseInt(f.getAttribute("data-agendar"), 10); enviar({ acao: "agendar", n: n, data: document.getElementById("ag" + n + "d").value, hora: document.getElementById("ag" + n + "h").value, link: document.getElementById("ag" + n + "l").value }, f, "Encontro agendado."); }); });
    Array.prototype.forEach.call(document.querySelectorAll("form[data-regenc]"), function (f) { f.addEventListener("submit", function (ev) { ev.preventDefault(); var n = parseInt(f.getAttribute("data-regenc"), 10); enviar({ acao: "registrarEncontro", n: n, resumo: document.getElementById("re" + n + "r").value, planoDeAcao: document.getElementById("re" + n + "p").value }, f, "Encontro registrado."); }); });
    Array.prototype.forEach.call(document.querySelectorAll("form[data-resp]"), function (f) { f.addEventListener("submit", function (ev) { ev.preventDefault(); enviar({ acao: "responder", duvidaId: f.getAttribute("data-resp"), texto: f.querySelector("textarea").value }, f, "Resposta enviada."); }); });
    var fr = document.getElementById("fRev");
    if (fr) fr.addEventListener("submit", function (ev) { ev.preventDefault(); var av = document.getElementById("avisoRv"); av.hidden = true; enviar({ acao: "revisarSemana", semana: parseInt(document.getElementById("rvSem").value, 10), destaques: document.getElementById("rvBem").value, melhorar: document.getElementById("rvMel").value, foco: document.getElementById("rvFoco").value, audioLink: document.getElementById("rvAudio").value }, fr, "Devolutiva enviada."); });
    var fe = document.getElementById("fEnc");
    if (fe) fe.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (!window.confirm("Encerrar o ciclo? O canal de dúvidas fecha e o atleta recebe a síntese.")) return;
      var sem = document.getElementById("enSem");
      enviar({ acao: "encerrar", sintese: document.getElementById("enSin").value, prioridades: document.getElementById("enPri").value, continuidade: document.getElementById("enCont").value, semAvaliacaoFinal: sem ? sem.checked : false }, fe, "Ciclo encerrado.");
    });
  }

  /* ── rotas ── */
  async function telaAcompanhamento(a1, a2) {
    tela('<p class="carregando">Carregando…</p>', true);
    var r;
    try { r = await api("comp-acompanhamento"); } catch (e) { U.erroTela(e, "#/inicio", "Início"); return; }
    if (a1 === "oferta") { telaOferta(r); return; }
    if (r.papel === "treinador") {
      if (a1 === "prof" && a2) {
        var x = r.acompanhamentos.filter(function (y) { return y.id === a2; })[0];
        if (!x) { ir("#/acompanhamento"); return; }
        tela(U.voltar("#/acompanhamento", "Acompanhamentos") + "<h1>Acompanhamento MTY</h1>" + profHtml(x));
        ligarProf(x, function () { telaAcompanhamento("prof", a2); });
        return;
      }
      tela(U.voltar("#/inicio", "Início") + "<h1>Acompanhamento MTY</h1>" + '<p class="sub">Os ciclos que você conduz.</p>' +
        (r.acompanhamentos.length ? r.acompanhamentos.map(function (x) {
          var ra = x.registrosAguardando || { total: 0 };
          return '<article class="cartao" style="margin-top:12px"><p>' + chipEstado(x) + "</p><h2>" + esc(x.atletaNome) + '</h2><p class="nota">' + (x.inicio ? "Ciclo de " + esc(dt(x.inicio)) + " a " + esc(dt(x.fim)) : "") + (x.estado === "ativo" ? " · " + ra.total + " registro(s) aguardando · " + (x.pendentes ? x.pendentes.duvidas : 0) + " dúvida(s)" : "") + '</p><div class="acoes"><a class="btn btn-laranja" href="#/acompanhamento/prof/' + esc(x.id) + '">Abrir</a></div></article>';
        }).join("") : '<div class="cartao" style="margin-top:14px"><h2>Nenhum ciclo ainda</h2><p class="nota" style="margin-top:6px">Os ciclos aparecem aqui quando o consultor define você como profissional responsável de um atleta vinculado a você.</p></div>'));
      return;
    }
    var abertos = r.acompanhamentos.filter(function (x) { return x.estado !== "cancelado"; });
    var atual = (a1 && r.acompanhamentos.filter(function (x) { return x.id === a1; })[0]) || abertos[0] || null;
    if (!atual) {
      if (r.papel === "responsavel") { tela(U.voltar("#/inicio", "Início") + "<h1>Acompanhamento MTY</h1>" + '<p class="sub">' + esc(r.produto.subtitulo) + "</p>" + ofertaHtml(r.produto) + formSolicitar(r)); return; }
      telaOferta(r); return;
    }
    tela(U.voltar("#/inicio", "Início") + "<h1>Acompanhamento MTY</h1>" + '<p class="sub">' + esc(r.produto.subtitulo) + "</p>" + painelHtml(atual, r.papel));
    ligarPainel(atual, r.papel, function () { telaAcompanhamento(a1, a2); });
  }
  A.registrar("acompanhamento", telaAcompanhamento);

  /* ── destaques da página inicial ── */
  function proximoCompromisso(d) {
    var itens = [];
    (d.torneios || []).forEach(function (t) { if (t.fim >= d.hoje) itens.push({ inicio: t.inicio < d.hoje ? d.hoje : t.inicio, titulo: t.nome, tipo: "Torneio", andamento: t.inicio <= d.hoje, periodo: U.periodo(t.inicio, t.fim), href: "#/temporada/" + t.id }); });
    (d.compromissos || []).forEach(function (c) { if (c.fim >= d.hoje) itens.push({ inicio: c.inicio < d.hoje ? d.hoje : c.inicio, titulo: c.titulo, tipo: ({ viagem: "Viagem", escola: "Escola", indisponivel: "Período indisponível", outro: "Compromisso" })[c.tipo] || "Compromisso", andamento: c.inicio <= d.hoje, periodo: U.periodo(c.inicio, c.fim), href: "#/planejamento/rotina" }); });
    itens.sort(function (a, b) { return a.inicio.localeCompare(b.inicio); });
    return itens[0] || null;
  }
  function hubAtleta() {
    var box = document.getElementById("hubPlanoDados");
    if (box) api("comp-planejamento").then(function (d) {
      var pc = proximoCompromisso(d), s = d.semana, hoje = s ? (s.atividades || []).filter(function (a) { return a.data === d.hoje; }) : [];
      var h = '<div style="margin-top:10px">' + (pc ? '<p class="olho">Próximo compromisso</p><p><strong>' + esc(pc.titulo) + '</strong> <span class="nota">· ' + esc(pc.tipo) + " · " + (pc.andamento ? "acontecendo agora" : esc(pc.periodo)) + "</span></p>" : '<p class="nota">Nenhum compromisso à vista. Adicione torneios na Temporada e viagens ou provas em Rotina e compromissos.</p>') + "</div>";
      if (d.vigente) h += '<div style="margin-top:10px"><p>' + U.chip(d.vigente) + "</p>" + (s ? '<p class="olho" style="margin-top:8px">Planejamento da semana</p><p><strong>' + esc(s.objetivo || "") + "</strong></p>" + (hoje.length ? '<p class="nota">Hoje: ' + esc(hoje.map(function (a) { return a.titulo + (a.minutos ? " (" + a.minutos + " min)" : ""); }).join("; ")) + "</p>" : '<p class="nota">Sem atividade prevista para hoje.</p>') : '<p class="nota">A semana de hoje não está na versão vigente.</p>') + "</div>";
      else h += '<p class="nota" style="margin-top:10px">Você ainda não tem planejamento. Gere uma sugestão inicial para ver a temporada, as próximas semanas e a semana atual.</p>';
      if ((d.propostas || []).length && d.vigente && d.vigente.status === "aprovado") h += '<div class="pl-aviso">Há uma proposta de ajuste aguardando revisão: o seu calendário mudou.</div>';
      box.innerHTML = h;
    }).catch(function () { box.innerHTML = ""; });
    var ac = document.getElementById("hubAcomp");
    if (ac) api("comp-acompanhamento").then(function (r) {
      var x = r.acompanhamentos.filter(function (y) { return y.estado !== "cancelado"; })[0];
      if (!x) { ac.innerHTML = '<section class="cartao" style="margin-top:14px" aria-labelledby="t-am"><p class="olho">Acompanhamento MTY</p><h2 id="t-am">Planejamento e acompanhamento remoto para jogadores de competição.</h2><p class="nota" style="margin-top:6px">Programa de 3 meses: 3 pagamentos de ' + esc(reais(r.produto.parcelaCentavos)) + " (total " + esc(reais(r.produto.totalCentavos)) + ').</p><div class="acoes"><a class="btn btn-secundario" href="#/acompanhamento">Conhecer o programa</a></div></section>'; return; }
      var pe = x.proximoEncontro, ra = x.registrosAguardando;
      ac.innerHTML = '<section class="cartao" style="margin-top:14px" aria-labelledby="t-am"><p class="olho">Acompanhamento MTY</p><h2 id="t-am">' + chipEstado(x) + "</h2>" + (x.estado === "ativo" ? '<p class="nota" style="margin-top:6px">' + (pe ? "Próximo encontro: " + esc(hora(pe)) : "Nenhum encontro agendado ainda.") + " · " + (ra ? ra.total : 0) + " registro(s) aguardando revisão.</p>" : '<p class="nota" style="margin-top:6px">' + esc(x.rotulo) + ".</p>") + '<div class="acoes"><a class="btn btn-secundario" href="#/acompanhamento">Abrir o acompanhamento</a></div></section>';
    }).catch(function () { ac.innerHTML = ""; });
  }
  function inserirDepoisDoSub(html) { var sub = document.querySelector("#app .sub"); if (sub) sub.insertAdjacentHTML("afterend", html); }
  function hubResponsavel() {
    api("comp-acompanhamento").then(function (r) {
      var lista = r.acompanhamentos.filter(function (x) { return x.estado !== "cancelado"; });
      if (!lista.length) { inserirDepoisDoSub('<section class="cartao" style="margin-top:14px"><p class="olho">Acompanhamento MTY</p><h2>Programa remoto de 3 meses</h2><p class="nota" style="margin-top:6px">O atleta faz o pedido e você confirma e responde pelo pagamento.</p><div class="acoes"><a class="btn btn-secundario" href="#/acompanhamento">Conhecer o programa</a></div></section>'); return; }
      inserirDepoisDoSub(lista.map(function (x) { return '<section class="cartao' + (x.estado === "aguardando_responsavel" ? " comp-alerta" : "") + '" style="margin-top:14px"><p class="olho">Acompanhamento MTY · ' + esc(x.atletaNome) + "</p><h2>" + chipEstado(x) + '</h2><div class="acoes"><a class="btn ' + (x.estado === "aguardando_responsavel" ? "btn-primario" : "btn-secundario") + '" href="#/acompanhamento/' + esc(x.id) + '">' + (x.estado === "aguardando_responsavel" ? "Confirmar o pedido" : "Abrir") + "</a></div></section>"; }).join(""));
    }).catch(function () { /* sem acompanhamento: nada a mostrar */ });
  }
  function hubTreinador(s) {
    var linhas = [], pend = 0;
    var vins = (s.comigo || []).filter(function (v) { return v.tipo === "treinador" && v.status === "ativo" && (v.areas || []).indexOf("planejamento") >= 0; }).slice(0, 8);
    var pr = Promise.all(vins.map(function (v) {
      return api("comp-planejamento?ver=" + encodeURIComponent(v.id)).then(function (d) {
        var em = (d.versoes || []).filter(function (x) { return x.status === "em_revisao" && x.origem !== "treinador"; });
        if (em.length) { pend += em.length; linhas.push('<li><a href="#/planejamento/atleta/' + esc(v.id) + '"><strong>' + esc(v.atleta.nome) + "</strong></a> · " + em.length + " planejamento(s) aguardando revisão</li>"); }
      }).catch(function () { /* vínculo sem a área ou sem dados */ });
    }));
    var pa = api("comp-acompanhamento").then(function (r) {
      r.acompanhamentos.filter(function (x) { return x.estado === "ativo"; }).forEach(function (x) {
        var ra = x.registrosAguardando || { total: 0 }, du = x.pendentes ? x.pendentes.duvidas : 0;
        if (ra.total || du) { pend += ra.total + du; linhas.push('<li><a href="#/acompanhamento/prof/' + esc(x.id) + '"><strong>' + esc(x.atletaNome) + "</strong></a> · Acompanhamento MTY: " + ra.total + " registro(s) aguardando revisão · " + du + " dúvida(s)</li>"); }
      });
      return r.acompanhamentos.length;
    }).catch(function () { return 0; });
    Promise.all([pr, pa]).then(function (res) {
      if (!linhas.length && !res[1]) return;
      inserirDepoisDoSub('<section class="cartao' + (linhas.length ? " comp-alerta" : "") + '" style="margin-top:14px" aria-labelledby="t-pend"><p class="olho">Pendências de revisão</p><h2 id="t-pend">' + (linhas.length ? "Há " + pend + " item(ns) aguardando você" : "Nada pendente agora") + "</h2>" + (linhas.length ? '<ul class="ac-lista">' + linhas.join("") + "</ul>" : "") + '<div class="acoes"><a class="btn btn-secundario" href="#/acompanhamento">Acompanhamentos MTY</a></div></section>');
    });
  }
  window.QL_COMP_HUB = function (comp, s) {
    if (comp.papel === "atleta") hubAtleta();
    else if (comp.papel === "responsavel") hubResponsavel();
    else if (comp.papel === "treinador") hubTreinador(s);
  };
})();
