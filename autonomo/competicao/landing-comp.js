/* QuadraLab Competição — página de vendas (visitante sem login).

   Só anuncia o que já existe no app: calendário e temporada, preparação por partida, diário, devolutivas, "Meu planejamento" (sugestão por regras,
   com revisão do treinador) e o Acompanhamento MTY. As imagens são capturas reais do produto com dados de demonstração, identificadas como exemplo.
   O formulário envia para comp-interesse (grava de verdade, aparece no painel do consultor). Nenhum depoimento, número de clientes, selo ou escassez. */
(function () {
  var WHATS = "https://wa.me/5511941773228?text=" + encodeURIComponent("Olá, Richard! Vi a página do QuadraLab Competição e quero conversar.");
  function ul(itens, cls) { return '<ul class="' + (cls || "cl-lista") + '">' + itens.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>"; }
  function img(nome, alt, w, h, cedo) {
    return '<figure class="cl-foto"><img src="img/' + nome + '.webp" width="' + w + '" height="' + h + '" alt="' + alt + '"' + (cedo ? "" : ' loading="lazy"') + ' decoding="async"><figcaption>Exemplo ilustrativo: captura do aplicativo com dados de demonstração.</figcaption></figure>';
  }
  function ir(alvo, rotulo, cls) { return '<a class="cl-btn ' + cls + '" href="#/" data-ir="' + alvo + '">' + rotulo + "</a>"; }
  function pedir(servico, rotulo, cls) { return '<a class="cl-btn ' + (cls || "escuro") + '" href="#/" data-servico="' + servico + '">' + rotulo + "</a>"; }

  var INCLUI = [
    ["Avaliação inicial", "Uma videochamada de até 60 minutos com atleta e responsável para conhecer objetivos, rotina, histórico e calendário."],
    ["Três encontros mensais", "Uma videochamada de 50 minutos em cada mês do programa, adicional à avaliação inicial."],
    ["Planejamento individualizado", "Organização técnica e tática do ciclo, com prioridades e ajustes conforme a rotina e os torneios."],
    ["Revisão semanal", "Uma revisão por semana dos registros enviados, com devolutiva por texto ou áudio."],
    ["Canal de dúvidas", "Atendimento pela plataforma, com resposta em até dois dias úteis."],
    ["Fechamento do ciclo", "Síntese do trabalho e definição das próximas prioridades no último encontro mensal."],
    ["Acesso à plataforma", "Funcionalidades necessárias ao acompanhamento incluídas durante os três meses, sem assinatura adicional obrigatória para essas entregas."]
  ];
  var CONSULT = [
    { id: "revisao", nome: "Revisão de estratégia", preco: "R$ 149", para: "Para quem já tem um plano e quer revisar suas prioridades.", itens: ["Revisão de um plano existente.", "Ajustes e três prioridades.", "Entrega em até três dias úteis.", "Não inclui análise de partidas."], botao: "Solicitar revisão" },
    { id: "ao_vivo", nome: "Consultoria ao vivo", preco: "R$ 299", para: "Para discutir o momento do jogador e definir próximos passos.", itens: ["Videochamada individual de 50 minutos.", "Leitura prévia da ficha.", "Resumo com plano de ação.", "Não inclui análise prévia de partidas."], botao: "Solicitar consultoria" },
    { id: "analise", nome: "Análise completa do jogador", preco: "R$ 1.190", para: "Para aprofundar a avaliação do jogo a partir de partidas completas.", itens: ["Três partidas completas.", "Até seis horas de gravação no total.", "Devolutiva em vídeo.", "Relatório e plano de ação.", "Prazo de sete a dez dias úteis após validação do material.", "Acima de seis horas: orçamento personalizado."], botao: "Solicitar análise" },
    { id: "analise_consultoria", nome: "Análise completa + consultoria", preco: "R$ 1.490", para: "Para aprofundar a análise e conversar sobre os resultados.", itens: ["Todas as entregas da análise completa.", "Videochamada de 50 minutos."], botao: "Solicitar análise e consultoria" }
  ];
  var FAQ = [
    ["Os encontros são presenciais?", "Não. Todos os encontros do programa são realizados por videochamada."],
    ["Quantos encontros estão incluídos?", "Quatro: uma avaliação inicial de até 60 minutos e três encontros mensais de 50 minutos."],
    ["Quanto tempo dura?", "O ciclo inicial dura três meses. Uma continuidade pode ser combinada após avaliação e novo aceite."],
    ["Quanto custa?", "Três pagamentos de R$ 790, totalizando R$ 2.370 pelo ciclo."],
    ["Preciso pagar a plataforma separadamente?", "As funcionalidades necessárias ao acompanhamento estão incluídas durante o ciclo."],
    ["O programa inclui análise completa de partidas?", "Não. A análise integral de partidas em vídeo é um serviço adicional."],
    ["O atleta pode continuar com o treinador presencial?", "Sim. O acompanhamento pode ser alinhado com o treinador, mediante autorização."],
    ["O responsável participa?", "Participa da avaliação inicial e pode acompanhar as informações autorizadas. O diário pessoal mantém controles próprios de privacidade."],
    ["Há orientação durante os jogos?", "O programa não inclui atendimento ao vivo durante partidas ou disponibilidade permanente em torneios."],
    ["A plataforma gera o planejamento sozinha?", "Ela pode organizar informações e oferecer sugestões. O planejamento profissional do acompanhamento passa por revisão humana."],
    ["Há garantia de resultados?", "Não. O programa oferece organização, planejamento e acompanhamento. O desenvolvimento depende de diversos fatores."]
  ];
  var FAIXAS = [["", "Escolher"], ["ate10", "Até 10 anos"], ["11-12", "11 e 12 anos"], ["13-14", "13 e 14 anos"], ["15-16", "15 e 16 anos"], ["17-18", "17 e 18 anos"], ["adulto", "Acima de 18 anos"]];
  var CATEGORIAS = [["", "Escolher"], ["iniciando", "Começando em torneios"], ["regional", "Torneios regionais"], ["estadual", "Torneios estaduais"], ["nacional", "Torneios nacionais ou de ranking"], ["outro", "Outra"]];
  var SERVICOS = [["acompanhamento", "Acompanhamento MTY"], ["revisao", "Revisão de estratégia"], ["ao_vivo", "Consultoria ao vivo"], ["analise", "Análise completa do jogador"], ["analise_consultoria", "Análise completa + consultoria"], ["nao_sei", "Ainda não sei"]];
  function opcoes(l, sel) { return l.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === sel ? " selected" : "") + ">" + o[1] + "</option>"; }).join(""); }

  function cabecalho() {
    return '<header class="cl-nav"><a class="cl-logo" href="#/" data-ir="topo" aria-label="QuadraLab Competição — início da página"><img src="../assets/logo-quadralab-competicao-v3-120.png" srcset="../assets/logo-quadralab-competicao-v3-120.png 518w, ../assets/logo-quadralab-competicao-v3-240.png 1035w" sizes="140px" width="140" height="34" alt="QuadraLab Competição"></a>' +
      '<nav class="cl-links" aria-label="Seções da página"><a href="#/" data-ir="cl-como">Como funciona</a><a href="#/" data-ir="cl-planejamento">Planejamento</a><a href="#/" data-ir="cl-acompanhamento">Acompanhamento</a><a href="#/" data-ir="cl-consultorias">Consultorias</a></nav>' +
      '<span class="cl-acoes"><a class="cl-entrar" href="#/entrar">Entrar</a>' + ir("cl-acompanhamento", "Conhecer o acompanhamento", "lima cl-curto") + "</span></header>";
  }
  function abertura() {
    return '<div class="cl-topo" id="topo"><div class="cl-cont">' + cabecalho() +
      '<div class="cl-hero"><div class="cl-hero-txt"><span class="comp-kicker">PARA JOGADORES JUVENIS DE COMPETIÇÃO</span>' +
      "<h1>Seu próximo torneio faz parte de um <em>plano maior.</em></h1>" +
      '<p class="cl-sub">Conecte calendário, estratégia e treinos. Com o acompanhamento remoto de Richard Tsukada, organize a preparação e acompanhe o desenvolvimento do atleta, mesmo quando o treinador não está na viagem.</p>' +
      '<div class="cl-cta">' + ir("cl-acompanhamento", "Conhecer o acompanhamento", "argila") + ir("cl-ofertas", "Explorar a plataforma", "contorno") + "</div>" +
      '<ul class="cl-fatos"><li>100% on-line</li><li>Ciclo inicial de 3 meses</li><li>Atleta, família e treinador conectados</li></ul></div>' +
      '<div class="cl-hero-foto">' + img("exemplo-temporada", "Tela de exemplo do planejamento da temporada, com blocos de preparação, competição e recuperação ao redor de dois torneios de exemplo.", 390, 406, true) + "</div></div></div></div>";
  }
  function familia() {
    return '<div class="cl-cont"><section class="cl-sec" id="cl-como" tabindex="-1"><span class="comp-kicker azul">Como funciona</span><h2>O torneio termina. O aprendizado continua.</h2>' +
      '<p class="cl-lead">Entre viagens, escola, treinos e competições, cada partida traz informações importantes. O QuadraLab Competição ajuda a organizar esses registros e transformá-los em prioridades para a próxima etapa.</p>' +
      '<div class="cl-cards cl-cinco">' + [
        ["Saber o que trabalhar", "Antes do próximo torneio, as prioridades ficam claras e à vista."],
        ["Registrar cada partida", "O que funcionou, o que foi difícil e o que levar para o treino."],
        ["Receber orientação à distância", "Revisão de um profissional, mesmo quando o treinador não está na viagem."],
        ["Alinhar atleta, família e treinador", "Cada pessoa vê só o que o atleta permitir."],
        ["Dar continuidade", "Uma linha entre competir e treinar, semana após semana."]
      ].map(function (c, i) { return '<div class="cl-card"><b>0' + (i + 1) + "</b><h3>" + c[0] + "</h3><p>" + c[1] + "</p></div>"; }).join("") + "</div>" +
      '<p class="cl-nota">Treinador e responsável entram por um código que o atleta gera. Para atletas menores de idade, o responsável aprova o treinador. Qualquer lado pode encerrar o vínculo a qualquer momento, e o diário pessoal é privado por padrão.</p></section>';
  }
  function ofertas() {
    return '<section class="cl-sec" id="cl-ofertas" tabindex="-1"><span class="comp-kicker azul">Duas ofertas complementares</span><h2>A plataforma organiza. O profissional orienta.</h2>' +
      '<div class="cl-duas"><article class="cl-oferta"><p class="olho-cl">Plataforma QuadraLab Competição</p><h3>Organização para sua jornada competitiva.</h3>' +
      ul(["Calendário e temporada.", "Estratégias por partida.", "Registros de jogos e treinos.", "Preparação e desafios.", "Diário pessoal.", "Histórico de desenvolvimento.", "Sugestões de planejamento, geradas por regras para o atleta e o treinador revisarem."]) +
      '<div class="cl-cta"><a class="cl-btn escuro" href="#/criar">Criar minha conta</a><a class="cl-btn borda" href="#/entrar">Já tenho conta</a></div></article>' +
      '<article class="cl-oferta destaque"><p class="olho-cl">Acompanhamento MTY</p><h3>Planejamento e revisão com um profissional.</h3>' +
      ul(["Avaliação inicial.", "Planejamento técnico e tático individualizado.", "Revisões semanais.", "Encontros mensais por videochamada.", "Ajustes conforme calendário e registros."]) +
      '<div class="cl-cta">' + ir("cl-acompanhamento", "Conhecer o acompanhamento", "argila") + "</div></article></div>" +
      '<p class="cl-nota forte">A plataforma organiza as informações. No acompanhamento, Richard revisa o contexto do atleta e orienta as próximas prioridades.</p></section>';
  }
  function planejamento() {
    return '<section class="cl-sec" id="cl-planejamento" tabindex="-1"><span class="comp-kicker azul">Planejamento conectado ao calendário</span><h2>Uma visão da temporada. Um objetivo para esta semana.</h2>' +
      '<div class="cl-cards cl-tres"><div class="cl-card"><p class="olho-cl">Temporada</p><h3>Torneios, viagens, escola e blocos de preparação</h3><p>Organizados em conjunto, com as prioridades de cada competição.</p></div>' +
      '<div class="cl-card"><p class="olho-cl">Próximas semanas</p><h3>Prioridades de desenvolvimento</h3><p>Alinhadas aos compromissos do atleta.</p></div>' +
      '<div class="cl-card"><p class="olho-cl">Esta semana</p><h3>Objetivos e atividades claros</h3><p>Para orientar a prática, com registro do que foi feito.</p></div></div>' +
      '<div class="cl-fotos">' + img("exemplo-semanas", "Tela de exemplo das próximas semanas, com objetivo, focos e atividades previstas por semana.", 390, 693) + '<div class="cl-fotos-txt"><p class="cl-lead">As sugestões consideram o calendário, a rotina e os registros do atleta. No acompanhamento, o planejamento é revisado pelo profissional responsável.</p>' +
      ul(["Cada versão tem autor, data e histórico.", "Uma versão aprovada só muda quando o treinador aprova outra: mudanças no calendário geram uma proposta de ajuste.", "Mostra o que foi considerado e o que faltou informar."]) +
      '<p class="cl-nota">É uma organização de prioridades técnicas e táticas. Não determina sozinha a periodização ideal e não substitui orientação de saúde ou de preparação física.</p></div></div></section>';
  }
  function acompanhamento() {
    return '<section class="cl-acomp" id="cl-acompanhamento" tabindex="-1"><div class="cl-cont"><span class="comp-kicker">100% on-line</span><h2>Acompanhamento MTY</h2>' +
      '<p class="cl-lead claro">Três meses de planejamento, orientação e revisão para dar continuidade ao desenvolvimento do atleta.</p>' +
      '<div class="cl-preco"><p class="cl-preco-n">3 pagamentos de R$ 790</p><p class="cl-preco-t">Investimento total do programa: <strong>R$ 2.370</strong></p>' +
      '<p class="cl-preco-nota">Programa inicial de 3 meses, sem renovação automática. A forma de pagamento é combinada no contato.</p></div>' +
      '<div class="cl-inclui">' + INCLUI.map(function (x) { return '<div class="cl-item"><h3>' + x[0] + "</h3><p>" + x[1] + "</p></div>"; }).join("") + "</div>" +
      '<p class="cl-destaque">São quatro encontros remotos no total: uma avaliação inicial e três encontros mensais.</p>' +
      '<div class="cl-acomp-fim"><div>' + pedir("acompanhamento", "Quero solicitar o acompanhamento", "lima") + '<p class="cl-apoio">Envie seu interesse para alinharmos objetivos, disponibilidade e início do programa.</p></div>' +
      img("exemplo-acompanhamento", "Tela de exemplo do painel do acompanhamento, com o profissional responsável, o próximo encontro remoto e as prioridades da semana.", 390, 666) + "</div></div></section>";
  }
  function meses() {
    return '<div class="cl-cont"><section class="cl-sec" id="cl-meses"><span class="comp-kicker azul">Como os três meses funcionam</span><h2>Um ciclo, três momentos.</h2><div class="cl-cards cl-tres">' + [
      ["Mês 1", "Conhecer e organizar", "Avaliação inicial, definição das prioridades e organização do planejamento. Primeiro encontro mensal de revisão."],
      ["Mês 2", "Acompanhar e ajustar", "Revisão dos registros, ajustes na preparação e segundo encontro mensal."],
      ["Mês 3", "Consolidar e reavaliar", "Revisão do ciclo, síntese dos aprendizados e terceiro encontro mensal para definir os próximos passos."]
    ].map(function (m) { return '<div class="cl-card"><p class="olho-cl">' + m[0] + "</p><h3>" + m[1] + "</h3><p>" + m[2] + "</p></div>"; }).join("") + "</div>" +
      '<p class="cl-nota">A organização de cada mês depende do calendário individual do atleta. O programa pode continuar por um novo ciclo, mediante avaliação e novo aceite.</p></section>' +
      '<section class="cl-sec" id="cl-escopo"><span class="comp-kicker azul">Escopo do acompanhamento</span><div class="cl-duas"><article class="cl-oferta"><h3>Como funciona à distância</h3><p>Todos os encontros são realizados por videochamada. O atleta executa os treinos no local habitual. Quando houver treinador presencial, o planejamento pode ser alinhado com ele mediante autorização.</p></article>' +
      '<article class="cl-oferta"><h3>O que é contratado separadamente</h3><p>Análise integral de partidas em vídeo, acompanhamento presencial, viagens e orientação ao vivo durante competições não estão incluídos.</p></article></div></section></div>';
  }
  function consultorias() {
    return '<div class="cl-cont"><section class="cl-sec" id="cl-consultorias" tabindex="-1"><span class="comp-kicker azul">Consultorias avulsas</span><h2>Precisa de uma orientação pontual?</h2><p class="cl-lead">Escolha um atendimento específico, sem contratar o acompanhamento de três meses.</p>' +
      '<div class="cl-consul">' + CONSULT.map(function (c) {
        return '<article class="cl-card cl-consul-card"><h3>' + c.nome + '</h3><p class="cl-valor">' + c.preco + '</p><p class="cl-para">' + c.para + "</p>" + ul(c.itens) + pedir(c.id, c.botao, "escuro") + "</article>";
      }).join("") + "</div>" +
      '<p class="cl-nota">Valores de lançamento. Valores por contratação, sem recorrência. Serviços avulsos separados do acompanhamento e da assinatura da plataforma.</p></section>';
  }
  function profissional() {
    return '<section class="cl-sec" id="cl-profissional"><span class="comp-kicker azul">O profissional</span><h2>Acompanhamento com Richard Tsukada</h2><div class="cl-duas"><div><p class="cl-lead">Richard Tsukada é o treinador por trás da Metodologia MTY, base do QuadraLab. No acompanhamento, ele revisa o contexto do atleta (calendário, registros e objetivos) e orienta as próximas prioridades em linguagem simples, para o atleta e para a família.</p></div>' +
      '<div><p>Na prática, a Metodologia MTY organiza o desenvolvimento em poucas prioridades por vez, ligadas ao que acontece nas partidas, para que o treino de cada semana tenha um objetivo claro.</p><p class="cl-nota">Quando houver treinador presencial, o trabalho é feito em conjunto com ele, mediante autorização.</p></div></div></section>';
  }
  function perguntas() {
    return '<section class="cl-sec" id="cl-faq"><span class="comp-kicker azul">Perguntas frequentes</span><h2>O que as famílias mais perguntam.</h2><div class="cl-faq">' +
      FAQ.map(function (f) { return "<details><summary>" + f[0] + "</summary><p>" + f[1] + "</p></details>"; }).join("") + "</div></section>";
  }
  function formulario() {
    return '<section class="cl-sec" id="cl-contato" tabindex="-1"><span class="comp-kicker azul">Formulário de interesse</span><h2>Conte um pouco sobre o atleta.</h2>' +
      '<p class="cl-lead">Pedimos só o necessário para o primeiro contato. É uma solicitação de contato: não contrata nada, não gera cobrança e não reserva vaga.</p>' +
      '<form id="clForm" class="cl-form" novalidate><div class="cl-hp" aria-hidden="true"><label>Não preencha este campo<input type="text" name="site" tabindex="-1" autocomplete="off"></label></div>' +
      '<div class="cl-campo"><label for="clNome">Nome do responsável ou contratante</label><input id="clNome" name="nome" autocomplete="name" maxlength="80" required></div>' +
      '<div class="cl-dois"><div class="cl-campo"><label for="clEmail">E-mail</label><input id="clEmail" name="email" type="email" autocomplete="email" maxlength="120" inputmode="email" required></div>' +
      '<div class="cl-campo"><label for="clTel">Telefone com DDD</label><input id="clTel" name="telefone" type="tel" autocomplete="tel" maxlength="20" inputmode="tel" required></div></div>' +
      '<div class="cl-dois"><div class="cl-campo"><label for="clFaixa">Faixa etária do atleta</label><select id="clFaixa" name="faixa" required>' + opcoes(FAIXAS) + "</select></div>" +
      '<div class="cl-campo"><label for="clCat">Categoria ou experiência competitiva</label><select id="clCat" name="categoria" required>' + opcoes(CATEGORIAS) + "</select></div></div>" +
      '<div class="cl-campo"><label for="clServ">Serviço de interesse</label><select id="clServ" name="servico" required>' + opcoes(SERVICOS, "acompanhamento") + "</select></div>" +
      '<div class="cl-campo"><label for="clObj">Objetivo principal</label><textarea id="clObj" name="objetivo" rows="3" maxlength="400" required></textarea><p class="cl-dica">Não inclua dados de saúde nem documentos.</p></div>' +
      '<label class="cl-aceite"><input type="checkbox" id="clOk" name="consentimento"> Autorizo o contato do QuadraLab para tratar desta solicitação. Os dados são usados só para isso.</label>' +
      '<div class="cl-aviso" id="clAviso" role="alert" hidden></div><button type="submit" class="cl-btn argila cl-envia">Enviar solicitação de contato</button>' +
      '<p class="cl-alt">Prefere conversar agora? <a href="' + WHATS + '" target="_blank" rel="noopener">Falar pelo WhatsApp<span class="sr"> (abre em nova aba)</span></a></p></form>' +
      '<div class="cl-ok" id="clOkBox" role="status" hidden><h3>Solicitação recebida.</h3><p>Entraremos em contato pelo e-mail ou telefone informado. Nada foi contratado nem cobrado: o próximo passo é a nossa conversa.</p></div></section></div>';
  }
  function encerramento() {
    return '<section class="cl-fim"><div class="cl-cont"><h2>Dê continuidade ao que cada torneio ensina.</h2><p>Organize a preparação e conte com acompanhamento remoto para revisar prioridades ao longo da temporada.</p>' +
      '<p class="cl-cta centro">' + pedir("acompanhamento", "Solicitar acompanhamento", "argila") + ir("cl-ofertas", "Explorar a plataforma", "borda") + "</p></div></section>" +
      '<div class="cl-cont"><footer class="cl-rodape"><span>Tecnologia <strong>QuadraLab</strong> · Metodologia MTY, de Richard Tsukada</span><span>Os dados de torneios são cadastrados pelo atleta. Confirme sempre no site oficial. Sem garantia de resultados.</span></footer></div>';
  }

  window.QL_COMP_LANDING = {
    html: function () { return (abertura() + familia() + ofertas() + planejamento() + '</div>' + acompanhamento() + meses() + consultorias() + profissional() + perguntas() + formulario() + encerramento()).replace(/R\$ (\d)/g, function (m, d) { return "R$\u00a0" + d; }); },
    ligar: function (raiz) {
      var reduz = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      function rolar(id) {
        var el = document.getElementById(id); if (!el) { window.scrollTo({ top: 0 }); return; }
        el.scrollIntoView({ behavior: reduz ? "auto" : "smooth", block: "start" });
        if (el.hasAttribute("tabindex")) el.focus({ preventScroll: true });
      }
      raiz.querySelectorAll("[data-ir]").forEach(function (a) { a.addEventListener("click", function (ev) { ev.preventDefault(); rolar(a.getAttribute("data-ir")); }); });
      raiz.querySelectorAll("[data-servico]").forEach(function (a) {
        a.addEventListener("click", function (ev) {
          ev.preventDefault();
          var s = document.getElementById("clServ"); if (s) s.value = a.getAttribute("data-servico");
          rolar("cl-contato");
          setTimeout(function () { var n = document.getElementById("clNome"); if (n) n.focus({ preventScroll: true }); }, reduz ? 0 : 500);
        });
      });
      var f = document.getElementById("clForm");
      if (!f) return;
      f.addEventListener("submit", async function (ev) {
        ev.preventDefault();
        var av = document.getElementById("clAviso"), bt = f.querySelector("button[type=submit]");
        function v(n) { return f.elements[n].value.trim(); }
        function falha(msg, whats) { av.textContent = msg; if (whats) { av.appendChild(document.createTextNode(" ")); var a = document.createElement("a"); a.href = WHATS; a.target = "_blank"; a.rel = "noopener"; a.textContent = "Falar pelo WhatsApp"; av.appendChild(a); } av.hidden = false; }
        av.hidden = true;
        var corpo = { nome: v("nome"), email: v("email"), telefone: v("telefone"), faixa: v("faixa"), categoria: v("categoria"), servico: v("servico"), objetivo: v("objetivo"), consentimento: f.elements.consentimento.checked, site: v("site") };
        if (corpo.nome.length < 2) { falha("Informe o nome do responsável ou de quem está contratando."); f.elements.nome.focus(); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(corpo.email)) { falha("Informe um e-mail válido."); f.elements.email.focus(); return; }
        if (corpo.telefone.replace(/\D/g, "").length < 10) { falha("Informe um telefone com DDD, para o contato."); f.elements.telefone.focus(); return; }
        if (!corpo.faixa) { falha("Escolha a faixa etária do atleta."); f.elements.faixa.focus(); return; }
        if (!corpo.categoria) { falha("Escolha a categoria ou a experiência competitiva."); f.elements.categoria.focus(); return; }
        if (corpo.objetivo.length < 3) { falha("Conte, em poucas palavras, o objetivo principal."); f.elements.objetivo.focus(); return; }
        if (!corpo.consentimento) { falha("Marque a autorização para entrarmos em contato."); return; }
        bt.disabled = true; var texto = bt.textContent; bt.textContent = "Enviando…";
        try {
          var r = await fetch("/.netlify/functions/comp-interesse", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });
          var j = await r.json().catch(function () { return {}; });
          if (r.ok && j.ok) { f.hidden = true; var box = document.getElementById("clOkBox"); box.hidden = false; box.setAttribute("tabindex", "-1"); box.focus(); return; }
          falha(j.erro || "Não foi possível enviar agora.", r.status >= 429);
        } catch (e) { falha("Sem conexão. Verifique a internet e tente de novo.", true); }
        bt.disabled = false; bt.textContent = texto;
      });
    }
  };
})();
