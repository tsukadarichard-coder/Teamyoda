/* QuadraLab Competição — página de vendas (visitante sem login).

   Só anuncia o que já existe no app: calendário e temporada, preparação por partida, diário, devolutivas, "Meu planejamento" (sugestão por regras,
   com revisão do treinador) e o Acompanhamento MTY. As imagens são capturas reais do produto com dados de demonstração, identificadas como exemplo.
   O formulário envia para comp-interesse (grava de verdade, aparece no painel do consultor). Nenhum depoimento, número de clientes, selo ou escassez. */
(function () {
  var WHATS = "https://wa.me/5511941773228?text=" + encodeURIComponent("Olá, Richard! Vi a página do QuadraLab Competição e quero conversar.");
  function ul(itens, cls) { return '<ul class="' + (cls || "cl-lista") + '">' + itens.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>"; }
  function ir(alvo, rotulo, cls) { return '<a class="cl-btn ' + cls + '" href="#/" data-ir="' + alvo + '">' + rotulo + "</a>"; }
  function pedir(servico, rotulo, cls) { return '<a class="cl-btn ' + (cls || "escuro") + '" href="#/" data-servico="' + servico + '">' + rotulo + "</a>"; }

  var CONSULT = [
    { id: "revisao", nome: "Revisão de estratégia", preco: "R$ 149", para: "Para quem já tem um plano e quer revisar suas prioridades.", itens: ["Revisão de um plano existente.", "Ajustes e três prioridades.", "Entrega em até três dias úteis.", "Não inclui análise de partidas."], botao: "Solicitar revisão" },
    { id: "ao_vivo", nome: "Consultoria ao vivo", preco: "R$ 299", para: "Para discutir o momento do jogador e definir próximos passos.", itens: ["Videochamada individual de 50 minutos.", "Leitura prévia da ficha.", "Resumo com plano de ação.", "Não inclui análise prévia de partidas."], botao: "Solicitar consultoria" },
    { id: "analise", nome: "Análise completa do jogador", preco: "R$ 1.190", para: "Para aprofundar a avaliação do jogo a partir de partidas completas.", itens: ["Três partidas completas.", "Até seis horas de gravação no total.", "Devolutiva em vídeo.", "Relatório e plano de ação.", "Prazo de sete a dez dias úteis após validação do material.", "Acima de seis horas: orçamento personalizado."], botao: "Solicitar análise" },
    { id: "analise_consultoria", nome: "Análise completa + consultoria", preco: "R$ 1.490", para: "Para aprofundar a análise e conversar sobre os resultados.", itens: ["Todas as entregas da análise completa.", "Videochamada de 50 minutos."], botao: "Solicitar análise e consultoria" }
  ];
  var FAQ = [
    ["O cadastro é grátis?", "Sim. Criar a conta e usar a plataforma (temporada, planejamento, partidas, diário e vínculos com treinador e responsável) não tem custo. O Acompanhamento MTY e as consultorias são contratações opcionais, à parte."],
    ["Os encontros são presenciais?", "Não. Todos os encontros do programa são realizados por videochamada."],
    ["Quantos encontros estão incluídos?", "Quatro: uma avaliação inicial de até 60 minutos e três encontros mensais de 50 minutos."],
    ["Quanto tempo dura?", "O ciclo inicial dura três meses. Uma continuidade pode ser combinada após avaliação e novo aceite."],
    ["O acompanhamento está incluído em qualquer acesso à plataforma?", "Não. O Acompanhamento MTY é uma contratação específica. Usar a plataforma, por si só, não inclui revisões pessoais de Richard."],
    ["Quanto custa?", "Três pagamentos de R$ 790, totalizando R$ 2.370 pelo ciclo."],
    ["Preciso pagar a plataforma separadamente?", "As funcionalidades necessárias ao acompanhamento estão incluídas durante o ciclo."],
    ["O programa inclui análise completa de partidas?", "Não. A análise integral de partidas em vídeo é um serviço adicional."],
    ["O atleta pode continuar com o treinador presencial?", "Sim. O acompanhamento pode ser alinhado com o treinador, mediante autorização."],
    ["O responsável participa?", "Participa da avaliação inicial e pode acompanhar as informações autorizadas. O diário pessoal mantém controles próprios de privacidade."],
    ["Há orientação durante os jogos?", "O programa não inclui atendimento ao vivo durante partidas ou disponibilidade permanente em torneios."],
    ["A plataforma gera o planejamento sozinha?", "Ela pode organizar informações e oferecer sugestões. O planejamento profissional do acompanhamento passa por revisão humana."],
    ["Menor de idade: por que o responsável vem antes do treinador?", "Para atletas com menos de 18 anos, o primeiro vínculo é sempre o de um responsável. Depois que ele estiver ativo, o treinador pode ser convidado e quem aprova o treinador é o responsável. Pai e mãe podem ser vinculados, cada um com a própria conta."],
    ["O responsável pode fazer o scout do jogo?", "Sim. Quando o treinador não pode ir ao jogo, o pai ou a mãe vinculado (com a área “Partidas” liberada) marca os pontos pelo celular, dentro do app, e o jogo aparece ao vivo para o atleta e para o treinador vinculado. É o mesmo scout do treinador: placar automático, saque de cada jogador, lado da quadra, ace, ataque, contra-ataque e defesa."],
    ["Como o atleta conecta o responsável e o treinador?", "Em Início, em “Quem acompanha você”, o atleta gera um código de convite (8 caracteres, válido por 7 dias) e marca o que a pessoa pode ver. Pai e mãe podem ser vinculados, cada um com o seu código e a sua conta. A pessoa digita o código na própria conta e o vínculo só vale depois de aprovado: pelo atleta ou, se for menor de idade, por um responsável já vinculado. Para o Acompanhamento MTY, o atleta marca “Meu planejamento” no convite do treinador. Qualquer lado pode encerrar o vínculo a qualquer momento, e o diário pessoal é privado por padrão."],
    ["Há garantia de resultados?", "Não. O programa oferece organização, planejamento e acompanhamento. O desenvolvimento depende de diversos fatores."]
  ];
  var FAIXAS = [["", "Escolher"], ["ate10", "Até 10 anos"], ["11-12", "11 e 12 anos"], ["13-14", "13 e 14 anos"], ["15-16", "15 e 16 anos"], ["17-18", "17 e 18 anos"], ["adulto", "Acima de 18 anos"]];
  var CATEGORIAS = [["", "Escolher"], ["iniciando", "Começando em torneios"], ["regional", "Torneios regionais"], ["estadual", "Torneios estaduais"], ["nacional", "Torneios nacionais ou de ranking"], ["outro", "Outra"]];
  var SERVICOS = [["acompanhamento", "Acompanhamento MTY"], ["revisao", "Revisão de estratégia"], ["ao_vivo", "Consultoria ao vivo"], ["analise", "Análise completa do jogador"], ["analise_consultoria", "Análise completa + consultoria"], ["nao_sei", "Ainda não sei"]];
  function opcoes(l, sel) { return l.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === sel ? " selected" : "") + ">" + o[1] + "</option>"; }).join(""); }

  /* Mídia opcional: só aparece quando houver arquivo real, autorizado e legendado. Preencha e publique os arquivos em competicao/img/.
     foto:  { src: "img/richard-tsukada.webp", alt: "Richard Tsukada orientando um atleta", w: 800, h: 1000 }
     video: { src: "img/apresentacao.mp4", poster: "img/apresentacao.jpg", legendas: "img/apresentacao-pt.vtt", duracao: "40 s" } */
  var MIDIA = { foto: null, video: null };

  var DEMOS = [
    { id: "temporada", aba: "Minha temporada", texto: "Organize torneios e períodos de preparação.", arq: "demo-temporada", alt: "Tela Temporada do aplicativo, com os próximos torneios, as datas e a prioridade de cada um.", tag: "Exemplo de temporada" },
    { id: "semana", aba: "Minha semana", texto: "Tenha clareza sobre o foco dos próximos treinos.", arq: "demo-semana", alt: "Tela Meu planejamento do aplicativo, com as semanas, os focos técnicos e táticos e as atividades previstas.", tag: "Exemplo de semana" },
    { id: "partida", aba: "Depois da partida", texto: "Registre aprendizados para orientar a próxima etapa.", arq: "demo-partida", alt: "Tela de registro de partida do aplicativo, com o que funcionou, as principais dificuldades e o botão para levar as dificuldades para o treino.", tag: "Exemplo de registro" }
  ];
  var ENTREGAS = [
    ["Planejamento técnico e tático individualizado", "Prioridades organizadas a partir do seu calendário e da sua rotina."],
    ["Revisão semanal dos registros", "Uma revisão por semana do que você registrou, com devolutiva por texto ou áudio."],
    ["Encontros por videochamada", "Uma avaliação inicial de até 60 minutos e três encontros mensais de 50 minutos."]
  ];
  var OFERTA_ITENS = [
    "Avaliação inicial por videochamada de até 60 minutos.",
    "Três encontros mensais de 50 minutos.",
    "Quatro encontros remotos no total.",
    "Planejamento técnico e tático.",
    "Uma revisão semanal dos registros enviados.",
    "Devolutivas por texto ou áudio.",
    "Canal de dúvidas com resposta em até dois dias úteis.",
    "Acesso às funcionalidades necessárias durante o ciclo."
  ];

  function fone(d, cedo, grande) {
    return '<figure class="cl-fone-fig"><div class="cl-fone"><button type="button" class="cl-fone-tela" data-ampliar="' + d.arq + '" data-alt="' + d.alt.replace(/"/g, "&quot;") + '" data-tag="' + d.tag + '" aria-label="Ampliar a captura: ' + d.alt.replace(/"/g, "&quot;") + '">' +
      '<img src="img/' + d.arq + '.webp" width="390" height="844" alt="' + d.alt.replace(/"/g, "&quot;") + '"' + (cedo ? "" : ' loading="lazy"') + ' decoding="async"></button></div>' +
      '<figcaption><span class="cl-tag-ex">' + d.tag + '</span>' + (grande ? '<span class="cl-leg">Seu calendário transformado em prioridades para treinar.</span>' : "") + '<span class="cl-leg-p">Toque na tela para ampliar. Captura do aplicativo com dados de demonstração.</span></figcaption></figure>';
  }

  function cabecalho() {
    return '<div class="cl-barra"><div class="cl-cont"><header class="cl-nav"><a class="cl-logo" href="#/" data-ir="topo" aria-label="QuadraLab Competição — início da página"><img src="../assets/logo-quadralab-competicao-v3-120.png" srcset="../assets/logo-quadralab-competicao-v3-120.png 518w, ../assets/logo-quadralab-competicao-v3-240.png 1035w" sizes="170px" width="170" height="41" alt="QuadraLab Competição"></a>' +
      '<nav class="cl-links" id="clMenu" aria-label="Seções da página"><a href="#/" data-ir="cl-demo">Como funciona</a><a href="#/" data-ir="cl-comecar">Comece grátis</a><a href="#/" data-ir="cl-profissional">Acompanhamento</a><a href="#/" data-ir="cl-consultorias">Consultorias</a><a href="#/" data-ir="cl-faq">Perguntas</a></nav>' +
      '<span class="cl-acoes"><a class="cl-entrar" href="#/entrar">Entrar</a><a class="cl-btn lima" href="#/criar">Criar conta grátis</a></span>' +
      '<button type="button" class="cl-menu-bt" id="clMenuBt" aria-expanded="false" aria-controls="clMenu">Menu</button></header></div></div>';
  }
  function abertura() {
    return cabecalho() + '<div class="cl-topo" id="topo"><div class="cl-cont"><div class="cl-hero"><div class="cl-hero-txt"><span class="comp-kicker">Para jogadores juvenis de competição</span>' +
      "<h1>Saiba o que treinar entre um torneio e outro.</h1>" +
      '<p class="cl-sub">Organize seu calendário, defina prioridades e acompanhe seu desenvolvimento. Crie sua conta grátis e comece pelos seus próximos torneios.</p>' +
      '<div class="cl-cta"><a class="cl-btn lima" href="#/criar">Criar conta grátis</a><a class="cl-link-sec" href="#/" data-ir="cl-demo">Ver a plataforma por dentro</a></div>' +
      '<p class="cl-fatos">Cadastro grátis · Para o atleta, o responsável e o treinador</p>' +
      '<p class="cl-aparte">A orientação profissional de Richard Tsukada é opcional e contratada à parte: veja mais abaixo.</p></div>' +
      '<div class="cl-hero-foto">' + fone({ arq: "demo-hero", alt: "Tela inicial do aplicativo, com a contagem para o próximo torneio, o próximo compromisso e o planejamento da semana, com o objetivo e o treino de hoje.", tag: "Exemplo de planejamento" }, true, true) + "</div></div></div></div>";
  }
  function comecar() {
    return '<section class="cl-sec" id="cl-comecar" tabindex="-1"><div class="cl-cont"><span class="comp-kicker azul">Comece grátis</span><h2>Em poucos minutos você já organiza a temporada.</h2>' +
      '<ol class="cl-passos3">' + [
        ["Crie a conta grátis", "Escolha o papel de atleta e informe a data de nascimento."],
        ["Cadastre seus torneios", "O app mostra a contagem, as datas e o que preparar antes de cada um."],
        ["Monte a equipe: responsável primeiro", "Se o atleta é menor de 18 anos, convide primeiro o pai, a mãe ou outro responsável; só depois dele vinculado o treinador pode entrar. Cada um usa um código que o atleta gera, com a própria conta, e só vê o que for marcado."]
      ].map(function (x, i) { return '<li class="cl-card"><b>' + (i + 1) + "</b><h3>" + x[0] + "</h3><p>" + x[1] + "</p></li>"; }).join("") + "</ol>" +
      '<div class="cl-cta"><a class="cl-btn argila" href="#/criar">Criar conta grátis</a><a class="cl-btn borda" href="#/entrar">Já tenho conta</a></div></div></section>';
  }
  function demonstracao() {
    return '<section class="cl-sec cl-claro" id="cl-demo" tabindex="-1"><div class="cl-cont"><span class="comp-kicker azul">A plataforma por dentro</span><h2>Veja como isso funciona na sua rotina.</h2>' +
      '<div class="cl-demo"><div class="cl-abas" role="tablist" aria-label="Telas da plataforma">' + DEMOS.map(function (d, i) {
        return '<button type="button" role="tab" class="cl-aba" id="clAba-' + d.id + '" aria-controls="clPainel-' + d.id + '" aria-selected="' + (i === 0) + '" tabindex="' + (i === 0 ? "0" : "-1") + '"><b>' + d.aba + '</b><span>' + d.texto + "</span></button>";
      }).join("") + '</div><div class="cl-paineis">' + DEMOS.map(function (d, i) {
        return '<div role="tabpanel" class="cl-painel" id="clPainel-' + d.id + '" aria-labelledby="clAba-' + d.id + '"' + (i ? " hidden" : "") + '><p class="cl-demo-d">' + d.texto + "</p>" + fone(d, false, false) + "</div>";
      }).join("") + "</div></div>" +
      '<p class="cl-nota">As sugestões do planejamento são geradas por regras, a partir do calendário, da rotina e dos registros do atleta. Elas precisam de revisão: no acompanhamento, quem revisa é o profissional. Não substituem orientação de saúde ou de preparação física.</p></div></section>';
  }
  function profissional() {
    var foto = MIDIA.foto ? '<figure class="cl-pro-foto"><img src="' + MIDIA.foto.src + '" width="' + MIDIA.foto.w + '" height="' + MIDIA.foto.h + '" alt="' + MIDIA.foto.alt + '" loading="lazy" decoding="async"></figure>' : "";
    var video = MIDIA.video ? '<div class="cl-video" id="clVideo" data-src="' + MIDIA.video.src + '" data-poster="' + (MIDIA.video.poster || "") + '" data-legendas="' + (MIDIA.video.legendas || "") + '"><button type="button" class="cl-btn borda" id="clVideoBt">Assistir à apresentação' + (MIDIA.video.duracao ? " (" + MIDIA.video.duracao + ")" : "") + "</button></div>" : "";
    return '<section class="cl-sec" id="cl-profissional" tabindex="-1"><div class="cl-cont"><div class="cl-pro' + (foto ? " com-foto" : "") + '"><div class="cl-pro-txt"><span class="comp-kicker azul">Opcional: orientação profissional</span><h2>Seu desenvolvimento acompanhado de perto, mesmo à distância.</h2>' +
      '<p class="cl-lead">No Acompanhamento MTY, Richard Tsukada revisa seus registros, organiza prioridades e ajusta o planejamento conforme sua rotina e seu calendário.</p>' + video +
      '<p class="cl-nota">Richard Tsukada é o autor da Metodologia MTY, base do QuadraLab. Quando houver treinador presencial, o trabalho é feito em conjunto com ele, mediante autorização.</p></div>' + foto +
      '<ol class="cl-entregas">' + ENTREGAS.map(function (e, i) { return '<li><b>' + (i + 1) + "</b><div><h3>" + e[0] + "</h3><p>" + e[1] + "</p></div></li>"; }).join("") + "</ol></div>" +
      '<div class="cl-duas cl-vs"><article class="cl-oferta"><p class="olho-cl">Na plataforma · grátis</p><h3>Organize calendário, estratégias, treinos e registros em um só lugar.</h3>' +
      '<div class="cl-cta"><a class="cl-btn escuro" href="#/criar">Criar conta grátis</a><a class="cl-btn borda" href="#/entrar">Já tenho conta</a></div></article>' +
      '<article class="cl-oferta destaque"><p class="olho-cl">Com o Acompanhamento MTY · contratação à parte</p><h3>Receba planejamento e revisão profissional para orientar as próximas prioridades.</h3>' +
      '<div class="cl-cta">' + ir("cl-acompanhamento", "Ver o que está incluído", "argila") + "</div></article></div>" +
      '<p class="cl-nota forte">As funcionalidades necessárias ao acompanhamento estão incluídas durante o ciclo contratado. As revisões pessoais de Richard fazem parte do Acompanhamento MTY, contratado à parte.</p></div></section>';
  }
  function oferta() {
    return '<section class="cl-sec" id="cl-acompanhamento" tabindex="-1"><div class="cl-cont"><div class="cl-card-oferta"><span class="comp-kicker azul">Acompanhamento 100% on-line</span><h2>Acompanhamento MTY</h2>' +
      '<p class="cl-lead">Três meses para organizar a preparação, acompanhar os registros e revisar as próximas prioridades.</p>' +
      '<div class="cl-preco"><p class="cl-preco-n">3 pagamentos de R$ 790</p><p class="cl-preco-t">Total do programa: <strong>R$ 2.370</strong></p></div>' +
      '<h3 class="cl-sub-t">O que está incluído</h3>' + ul(OFERTA_ITENS, "cl-checks") +
      '<p class="cl-destaque">Todos os encontros são on-line. Os treinos são realizados no local habitual do atleta.</p>' +
      '<p class="cl-nota">Análise integral de partidas em vídeo, viagens e orientação ao vivo durante jogos são serviços separados.</p>' +
      '<div class="cl-oferta-fim">' + pedir("acompanhamento", "Solicitar acompanhamento", "argila") + '<p class="cl-apoio">Você envia seu interesse e conversamos sobre objetivos, disponibilidade e início. Enviar o formulário não contrata nem cobra nada. Programa inicial de 3 meses, sem renovação automática: a renovação só acontece mediante novo aceite. A forma de pagamento é combinada no contato.</p></div></div>' +
      '<div class="cl-meses"><h3>Como os três meses funcionam</h3><div class="cl-cards cl-tres">' + [
        ["Mês 1", "Conhecer e organizar", "Avaliação inicial, definição das prioridades e organização do planejamento. Primeiro encontro mensal de revisão."],
        ["Mês 2", "Acompanhar e ajustar", "Revisão dos registros, ajustes na preparação e segundo encontro mensal."],
        ["Mês 3", "Consolidar e reavaliar", "Revisão do ciclo, síntese dos aprendizados e terceiro encontro mensal para definir os próximos passos."]
      ].map(function (m) { return '<div class="cl-card"><p class="olho-cl">' + m[0] + "</p><h3>" + m[1] + "</h3><p>" + m[2] + "</p></div>"; }).join("") + "</div></div></div></section>";
  }
  function consultorias() {
    return '<section class="cl-sec cl-claro" id="cl-consultorias" tabindex="-1"><div class="cl-cont"><span class="comp-kicker azul">Consultorias avulsas</span><h2>Uma orientação pontual para o seu momento.</h2><p class="cl-lead">Escolha um atendimento específico, sem contratar o acompanhamento de três meses.</p>' +
      '<div class="cl-consul">' + CONSULT.map(function (c) {
        return '<article class="cl-card cl-consul-card"><h3>' + c.nome + '</h3><p class="cl-valor">' + c.preco + '</p><p class="cl-para">' + c.para + "</p>" + ul(c.itens) + pedir(c.id, c.botao, "escuro") + "</article>";
      }).join("") + "</div>" +
      '<p class="cl-nota">Valores de lançamento. Valores por contratação, sem recorrência. Serviços avulsos separados do acompanhamento e da assinatura da plataforma.</p></div></section>';
  }
  function perguntas() {
    return '<section class="cl-sec" id="cl-faq" tabindex="-1"><div class="cl-cont"><span class="comp-kicker azul">Perguntas frequentes</span><h2>O que as famílias mais perguntam.</h2><div class="cl-faq">' +
      FAQ.map(function (f) { return "<details><summary>" + f[0] + "</summary><p>" + f[1] + "</p></details>"; }).join("") + "</div></div></section>";
  }
  function chamadaFinal() {
    return '<section class="cl-fim"><div class="cl-cont"><h2>Comece pela sua temporada. É grátis.</h2><p>Crie a conta, cadastre seus torneios e, se quiser orientação profissional, solicite o acompanhamento depois.</p>' +
      '<div class="cl-cta centro"><a class="cl-btn lima" href="#/criar">Criar conta grátis</a>' + pedir("acompanhamento", "Solicitar acompanhamento", "contorno") + "</div></div></section>";
  }
  function formulario() {
    return '<div class="cl-cont"><section class="cl-sec" id="cl-contato" tabindex="-1"><span class="comp-kicker azul">Formulário de interesse</span><h2>Conte um pouco sobre o atleta.</h2>' +
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
  function rodape() {
    return '<div class="cl-cont"><footer class="cl-rodape"><span>Tecnologia <strong>QuadraLab</strong> · Metodologia MTY, de Richard Tsukada</span><span>Os dados de torneios são cadastrados pelo atleta. Confirme sempre no site oficial. Sem garantia de resultados.</span></footer></div>';
  }

  window.QL_COMP_LANDING = {
    html: function () { return (abertura() + demonstracao() + comecar() + profissional() + oferta() + consultorias() + perguntas() + chamadaFinal() + formulario() + rodape()).replace(/R\$ (\d)/g, function (m, d) { return "R$\u00a0" + d; }); },
    ligar: function (raiz) {
      var reduz = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      function rolar(id) {
        var el = document.getElementById(id); if (!el) { window.scrollTo({ top: 0 }); return; }
        el.scrollIntoView({ behavior: reduz ? "auto" : "smooth", block: "start" });
        if (el.hasAttribute("tabindex")) el.focus({ preventScroll: true });
      }
      var menu = raiz.querySelector("#clMenu"), menuBt = raiz.querySelector("#clMenuBt");
      function menuAbrir(abrir, foco) { if (!menu || !menuBt) return; menu.classList.toggle("aberto", abrir); menuBt.setAttribute("aria-expanded", String(abrir)); menuBt.textContent = abrir ? "Fechar" : "Menu"; if (!abrir && foco) menuBt.focus(); }
      if (menuBt) {
        menuBt.addEventListener("click", function () { menuAbrir(menuBt.getAttribute("aria-expanded") !== "true"); });
        document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && menuBt.getAttribute("aria-expanded") === "true") menuAbrir(false, true); });
        window.addEventListener("resize", function () { if (window.innerWidth >= 900) menuAbrir(false); });
      }
      /* demonstração: abas com escolha do visitante (sem rotação automática) */
      var abas = Array.prototype.slice.call(raiz.querySelectorAll(".cl-aba"));
      function escolherAba(alvo, foco) {
        abas.forEach(function (a) {
          var sel = a === alvo; a.setAttribute("aria-selected", String(sel)); a.tabIndex = sel ? 0 : -1;
          var pn = document.getElementById(a.getAttribute("aria-controls")); if (pn) pn.hidden = !sel;
        });
        if (foco) alvo.focus();
      }
      abas.forEach(function (a, i) {
        a.addEventListener("click", function () { escolherAba(a, false); });
        a.addEventListener("keydown", function (ev) {
          var k = ev.key, n = abas.length, j = k === "ArrowRight" || k === "ArrowDown" ? (i + 1) % n : k === "ArrowLeft" || k === "ArrowUp" ? (i + n - 1) % n : k === "Home" ? 0 : k === "End" ? n - 1 : -1;
          if (j >= 0) { ev.preventDefault(); escolherAba(abas[j], true); }
        });
      });
      /* ampliar a captura: diálogo com botão Fechar, Esc, clique fora e foco devolvido */
      var ampl = null;
      function fecharAmpl() { if (!ampl) return; var voltar = ampl.voltar; ampl.el.remove(); document.documentElement.classList.remove("cl-sem-rolagem"); document.removeEventListener("keydown", ampl.tecla, true); ampl = null; if (voltar && voltar.focus) voltar.focus(); }
      function abrirAmpl(bt) {
        var el = document.createElement("div"); el.className = "cl-ampl"; el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Captura ampliada");
        var cx = document.createElement("div"); cx.className = "cl-ampl-cx";
        var fe = document.createElement("button"); fe.type = "button"; fe.className = "cl-btn lima cl-ampl-fechar"; fe.textContent = "Fechar";
        var im = document.createElement("img"); im.src = "img/" + bt.getAttribute("data-ampliar") + ".webp"; im.alt = bt.getAttribute("data-alt") || ""; im.width = 390; im.height = 844;
        var lg = document.createElement("p"); lg.className = "cl-ampl-leg"; lg.textContent = (bt.getAttribute("data-tag") || "Exemplo") + " · captura do aplicativo com dados de demonstração.";
        cx.appendChild(fe); cx.appendChild(im); cx.appendChild(lg); el.appendChild(cx); document.body.appendChild(el); document.documentElement.classList.add("cl-sem-rolagem");
        var tecla = function (ev) {
          if (ev.key === "Escape") { ev.preventDefault(); fecharAmpl(); }
          else if (ev.key === "Tab") { ev.preventDefault(); fe.focus(); }
        };
        document.addEventListener("keydown", tecla, true);
        el.addEventListener("click", function (ev) { if (ev.target === el || ev.target === cx) fecharAmpl(); });
        fe.addEventListener("click", fecharAmpl);
        ampl = { el: el, tecla: tecla, voltar: bt }; fe.focus();
      }
      raiz.querySelectorAll("[data-ampliar]").forEach(function (bt) { bt.addEventListener("click", function () { abrirAmpl(bt); }); });
      /* vídeo de apresentação: só existe quando MIDIA.video estiver preenchida; nada é baixado antes do toque e não há reprodução automática */
      var vb = document.getElementById("clVideoBt");
      if (vb) vb.addEventListener("click", function () {
        var box = document.getElementById("clVideo"), v = document.createElement("video");
        v.controls = true; v.preload = "none"; v.setAttribute("playsinline", ""); if (box.getAttribute("data-poster")) v.poster = box.getAttribute("data-poster");
        var so = document.createElement("source"); so.src = box.getAttribute("data-src"); v.appendChild(so);
        if (box.getAttribute("data-legendas")) { var tr = document.createElement("track"); tr.kind = "captions"; tr.srclang = "pt-BR"; tr.label = "Português"; tr.src = box.getAttribute("data-legendas"); tr.default = true; v.appendChild(tr); }
        box.textContent = ""; box.appendChild(v); v.focus();
      });
      raiz.querySelectorAll("[data-ir]").forEach(function (a) { a.addEventListener("click", function (ev) { ev.preventDefault(); menuAbrir(false); rolar(a.getAttribute("data-ir")); }); });
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
