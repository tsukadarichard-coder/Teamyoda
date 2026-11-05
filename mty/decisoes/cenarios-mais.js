/* QuadraLab Player · Simulador de Decisões — MAIS CENÁRIOS, a partir da Metodologia MTY (só conteúdo, sem lógica).

   Cada cenário nasce de um exercício do catálogo do método (o código aparece na missão) e das questões táticas que o
   método trabalha: a situação (início do ponto, neutra, construção, ataque, contra-ataque, defesa), os três objetivos do
   jogo (ganhar a quadra, produzir ângulo, diminuir o tempo) e os princípios travados — nunca esperar o erro do outro,
   as duas defesas (bola alta e cruzada acelerada), a paralela no ataque buscando margem, o centro relativo na
   recuperação, o gatilho de subida e a bola curta como convite.

   Mesmas convenções de cenarios.js (coordenadas em metros, você embaixo, destros). Textos para revisão de Richard
   Tsukada antes do uso com alunos. Carregar depois de cenarios.js. */
(function (raiz, fab) {
  if (typeof module === "object" && module.exports) module.exports = fab(require("./cenarios.js"));
  else fab(raiz.QLD_CONTEUDO);
})(typeof self !== "undefined" ? self : this, function (K) {
  var DD = K.DUAS_DEFESAS;
  var ALTA = DD[0], ACELERADA = DD[1];

  /* ── recuperações (decisão 3) ── */
  function recFundo() {
    return {
      tipo: "recuperacao", numero: 3, tatica: "neutra",
      situacao: "Sua bola ainda está no ar e o adversário se desloca para ela. Antes que ele bata, você escolhe para onde ir.",
      pergunta: "Para onde você se recupera?",
      opcoes: [
        { id: "relativo", rotulo: "Recuperar ao centro relativo", posicao: { modo: "bissetriz", y: -11.8 },
          rotulos: { baixa: "coerente", media: "coerente", alta: "coerente" },
          textos: {
            baixa: "O centro relativo depende do seu golpe, não do meio geométrico da quadra: é o ponto que cobre a resposta provável sem deixar faltar nem sobrar quadra. Com o adversário com tempo, essa posição faz ainda mais diferença.",
            media: "O centro relativo depende do seu golpe, não do meio geométrico da quadra: é o ponto que cobre a resposta provável sem deixar faltar nem sobrar quadra.",
            alta: "Com o adversário pressionado, recuperar ao centro relativo deixa você pronto para a bola que ele consegue jogar, e para entrar se ela vier curta.",
          },
          resumo: "Centro relativo: cobre a resposta provável, sem faltar nem sobrar quadra." },
        { id: "ficar", rotulo: "Ficar onde bateu", posicao: { modo: "ficar" },
          rotulos: { baixa: "controle", media: "controle", alta: "controle" },
          textos: {
            baixa: "Parado onde bateu, você deixa um lado inteiro aberto, e o adversário tem tempo para usá-lo.",
            media: "Parado onde bateu, você deixa um lado aberto: basta ao adversário mudar a direção.",
            alta: "Mesmo com a sua bola pressionando, ficar parado deixa um lado aberto para uma resposta simples.",
          },
          resumo: "Ficar onde bateu: um lado da quadra aberto." },
        { id: "meio", rotulo: "Parar no meio da quadra", posicao: { modo: "bissetriz", y: -8.0 },
          rotulos: { baixa: "controle", media: "controle", alta: "inicio" },
          textos: {
            baixa: "Entre a linha de saque e a de base, a bola do adversário chega no seu pé: você não está no fundo para jogar depois do quique nem na rede para volear.",
            media: "No meio da quadra, a bola tende a chegar no seu pé. Ou você avança até a rede, ou volta para o fundo.",
            alta: "Com o adversário pressionado, parar no meio pode até funcionar, mas a posição natural seria seguir até a rede ou voltar ao fundo.",
          },
          resumo: "Meio da quadra: a bola chega no pé." },
      ],
    };
  }
  function recAtaque() {
    return {
      tipo: "recuperacao", numero: 3, tatica: "ataque",
      situacao: "Sua bola ainda está no ar e o adversário corre para ela. Antes que ele bata, você escolhe o que fazer.",
      pergunta: "Depois de atacar, para onde você vai?",
      opcoes: [
        { id: "subir", rotulo: "Subir à rede na linha da bola", posicao: { modo: "bissetriz", y: -4.0 },
          rotulos: { baixa: "inicio", media: "coerente", alta: "coerente" },
          textos: {
            baixa: "Subir é possível, mas a sua bola não tirou muito tempo do adversário: faça o split antes do golpe dele e fique atento ao lobby.",
            media: "Subir na linha da bola e fazer o split na zona de voleio antes do golpe do adversário transforma o ataque em vantagem de posição.",
            alta: "Com o adversário pressionado, subir na linha da bola encurta a próxima bola, que tende a vir fraca. É a sequência que o método pede: atacar e finalizar à frente.",
          },
          resumo: "Subir na linha da bola: o ataque vira posição." },
        { id: "relativo", rotulo: "Voltar ao centro relativo no fundo", posicao: { modo: "bissetriz", y: -11.8 },
          rotulos: { baixa: "coerente", media: "inicio", alta: "inicio" },
          textos: {
            baixa: "Se a sua bola não tirou tempo do adversário, voltar ao centro relativo no fundo protege você de uma resposta agressiva.",
            media: "Voltar para o fundo devolve ao adversário parte do tempo que o ataque tirou dele.",
            alta: "Voltar para o fundo depois de pressionar devolve ao adversário a chance de se reorganizar.",
          },
          resumo: "Voltar ao fundo: seguro, mas devolve tempo." },
        { id: "meio", rotulo: "Parar no meio da quadra", posicao: { modo: "bissetriz", y: -8.0 },
          rotulos: { baixa: "controle", media: "controle", alta: "controle" },
          textos: {
            baixa: "Parado no meio da quadra, você não está no fundo nem na rede: a resposta chega no seu pé.",
            media: "No meio da quadra, a passada e a bola no pé ficam fáceis para o adversário. Ou você segue até a rede, ou volta.",
            alta: "Mesmo com o adversário pressionado, parar no meio deixa a bola chegar no seu pé. Siga até a rede.",
          },
          resumo: "Parar no meio: nem fundo, nem rede." },
      ],
    };
  }
  function recRede() {
    return {
      tipo: "recuperacao", numero: 3, tatica: "ataque",
      situacao: "Seu voleio ainda está no ar. Antes que o adversário bata, você escolhe a sua posição na rede.",
      pergunta: "Depois do voleio, onde ficar?",
      opcoes: [
        { id: "fechar", rotulo: "Fechar a rede na linha da bola", posicao: { modo: "bissetriz", y: -2.6 },
          rotulos: { baixa: "inicio", media: "coerente", alta: "coerente" },
          textos: {
            baixa: "Fechar a rede na linha do seu voleio é o caminho, mas com o adversário com tempo, mantenha distância suficiente para o lobby.",
            media: "Fechar a rede na linha da bola diminui o ângulo da passada e encurta o tempo do adversário.",
            alta: "Com o adversário pressionado, fechar a rede na linha da bola deixa a próxima bola dele perto da sua raquete.",
          },
          resumo: "Fechar na linha da bola: menos ângulo para a passada." },
        { id: "recuar", rotulo: "Recuar para o fundo", posicao: { modo: "recuar" },
          rotulos: { baixa: "inicio", media: "iniciativa", alta: "iniciativa" },
          textos: {
            baixa: "Recuar protege do lobby quando o adversário tem tempo, mas desfaz a vantagem de estar na rede.",
            media: "Recuar depois do voleio entrega ao adversário a iniciativa que a subida tinha conquistado.",
            alta: "Com o adversário pressionado, recuar desperdiça a posição que mais tira tempo dele.",
          },
          resumo: "Recuar: desfaz a vantagem da rede." },
        { id: "parado", rotulo: "Ficar parado onde voleou", posicao: { modo: "ficar" },
          rotulos: { baixa: "controle", media: "controle", alta: "inicio" },
          textos: {
            baixa: "Parado, você não acompanha a direção do próprio voleio e o adversário escolhe o lado da passada.",
            media: "Parado onde voleou, você deixa aberto o lado para onde a sua bola foi: é por ali que a passada vem.",
            alta: "Com o adversário pressionado, ficar parado pode bastar, mas acompanhar a linha da bola seria mais seguro.",
          },
          resumo: "Ficar parado: o lado da passada fica aberto." },
      ],
    };
  }

  /* ── segundas decisões reaproveitadas ── */
  /* troca de fundo com uma bola jogável; sx = lado em que você bate (1: forehand, à direita; -1: backhand) */
  function d2Construcao(situacao, sx, golpe, proxima, leitura) {
    return {
      tipo: "golpe", numero: 2, contexto: "neutro", tatica: "construcao", golpe: golpe, situacao: situacao, pergunta: "Qual a próxima bola?",
      opcoes: [
        { id: "profunda", rotulo: "Profunda com margem na diagonal", alvo: [-sx * 2.4, 9.4], risco: 0, pressao: 1.1, objetivo: "quadra", ideal: { altura: ["media", "alta"], intensidade: ["controlada", "firme"] },
          texto: (leitura ? leitura + " " : "") + "A bola profunda pela diagonal, com margem, ganha a quadra: empurra o adversário para trás e prepara a bola seguinte.",
          resumo: "Profunda na diagonal: ganhar a quadra e preparar a próxima.", proxima: proxima },
        { id: "troca", rotulo: "Trocar de direção na paralela", alvo: [sx * 3.3, 9.8], risco: 0.5, pressao: 1.7, contexto: "ataque", objetivo: "tempo", ideal: { altura: ["media"], intensidade: ["firme"] },
          texto: "Trocar de direção pela paralela tira o tempo do adversário se a bola permitir: mais curta e mais lenta que a anterior. No ataque, a paralela busca margem: mire dentro da quadra, não na linha.",
          resumo: "Troca na paralela: tira tempo, se a bola permitir.", proxima: proxima },
        { id: "angulo", rotulo: "Ângulo cruzado curto", alvo: [-sx * 3.4, 5.4], risco: 1, pressao: 1.3, contexto: "ataque", objetivo: "angulo", ideal: { altura: ["media"], intensidade: ["controlada", "firme"] },
          texto: "O ângulo curto tira o adversário pela lateral, mas a bola mais lenta e com efeito fica mais tempo no ar; de perto da linha de base, ele tende a chegar.",
          resumo: "Ângulo curto do fundo: abre a quadra, mas a bola demora.", proxima: proxima },
      ],
    };
  }
  /* você correndo para a bola: as duas defesas do método e a paralela de risco */
  function d2Defesa(situacao, sx, golpe, proxima) {
    return {
      tipo: "golpe", numero: 2, contexto: "defesa", tatica: "defesa", golpe: golpe, situacao: situacao, pergunta: "Qual defesa?",
      opcoes: [
        { id: "alta", rotulo: "Bola alta e profunda", alvo: [-sx * 1.4, 10.2], risco: 0, pressao: 0.6, objetivo: "ganhar_tempo", ideal: ALTA,
          texto: "Em corrida, a bola alta e profunda é uma das duas defesas do método: fica tempo no ar para você voltar para a quadra e empurra o adversário para trás.",
          resumo: "Defesa alta: ganhar tempo para voltar.", proxima: proxima },
        { id: "acelerada", rotulo: "Cruzada acelerada", alvo: [-sx * 2.9, 8.4], risco: 0, pressao: 1.2, objetivo: "tempo", ideal: ACELERADA,
          texto: "A outra defesa do método: em vez de levantar, acelerar a cruzada na corrida. Pela parte baixa da rede, devolve a pressão ao adversário, desde que o apoio estabilize o corpo no contato.",
          resumo: "Defesa acelerada: devolver a pressão pela diagonal.", proxima: proxima },
        { id: "paralela", rotulo: "Paralela de risco", alvo: [sx * 3.4, 10.2], risco: 1.5, pressao: 1.5, objetivo: "tempo", ideal: { altura: ["media"], intensidade: ["firme"] },
          texto: "A paralela em corrida pede velocidade e precisão ao mesmo tempo, pela parte alta da rede. Se não sair perfeita, a quadra fica aberta para a resposta cruzada.",
          resumo: "Paralela em corrida: velocidade e precisão ao mesmo tempo.", proxima: proxima },
      ],
    };
  }
  /* o adversário na rede: lobby, passada na paralela ou cruzada curta */
  function d2Passada(situacao, sx, golpe, proxima) {
    return {
      tipo: "golpe", numero: 2, contexto: "passada", tatica: "contra", golpe: golpe, situacao: situacao, pergunta: "Como passar pelo adversário na rede?",
      opcoes: [
        { id: "lobby", rotulo: "Lobby por cima dele", alvo: [-sx * 1.4, 10.0], risco: 0.3, pressao: 1.2, objetivo: "quadra", ideal: { altura: ["alta"], intensidade: ["controlada", "firme"] },
          texto: "Com o adversário perto da rede, o lobby o obriga a correr para trás e devolve a você a posição na quadra. Precisa passar acima do alcance dele para não virar smash.",
          resumo: "Lobby: tirar o adversário da rede.", proxima: proxima },
        { id: "paralela", rotulo: "Passada na paralela", alvo: [sx * 3.6, 8.8], risco: 1, pressao: 1.6, objetivo: "tempo", ideal: { altura: ["baixa", "media"], intensidade: ["firme", "maxima"] },
          texto: "A passada na paralela é o caminho mais curto pelo lado do adversário. Precisa ser baixa e rápida: alta, vira voleio fácil.",
          resumo: "Passada na paralela: caminho curto, bola baixa e rápida.", proxima: proxima },
        { id: "cruzada", rotulo: "Passada cruzada curta", alvo: [-sx * 3.2, 4.0], risco: 1, pressao: 1.4, objetivo: "angulo", ideal: { altura: ["baixa", "media"], intensidade: ["controlada", "firme"] },
          texto: "A cruzada curta tira a bola do alcance do voleio, mas obriga a bola a subir e cair rápido. Pede toque e equilíbrio.",
          resumo: "Passada cruzada curta: longe do voleio, com toque.", proxima: proxima },
      ],
    };
  }
  function opc(id, rotulo, alvo, o) { var r = { id: id, rotulo: rotulo, alvo: alvo }; for (var k in o) r[k] = o[k]; return r; }
  var IDEAL_ATAQUE = { altura: ["media"], intensidade: ["firme", "maxima"] };
  var IDEAL_BASE = { altura: ["media", "alta"], intensidade: ["controlada", "firme"] };

  /* ════ INÍCIO DO PONTO ════ */
  function d2PrimeiraBola(situacao, alvos, txt, ajustes) {
    ajustes = ajustes || {};
    function a(id, base) { var o = base; var x = ajustes[id] || {}; for (var k in x) o[k] = x[k]; return o; }
    return {
      tipo: "golpe", numero: 2, contexto: "ataque", tatica: "ataque", golpe: "Primeira bola, equilibrado", situacao: situacao, pergunta: "Como jogar a primeira bola?",
      opcoes: [
        a("espaco", opc("espaco", "Atacar o espaço aberto com margem", alvos.espaco, { risco: 0, pressao: 1.6, objetivo: "quadra", ideal: { altura: ["media"], intensidade: ["controlada", "firme"] }, texto: txt.espaco, resumo: "Espaço aberto com margem: o adversário corre toda a quadra.", proxima: "d3" })),
        a("contrape", opc("contrape", "Jogar no contrapé", alvos.contrape, { risco: 0.5, pressao: 1.5, objetivo: "tempo", ideal: { altura: ["media"], intensidade: ["firme"] }, texto: txt.contrape, resumo: "Contrapé: pega o adversário mudando de direção.", proxima: "d3" })),
        a("centro", opc("centro", "Atacar firme pelo centro", alvos.centro, { risco: 0, pressao: 1.3, objetivo: "tempo", ideal: IDEAL_ATAQUE, texto: txt.centro, resumo: "Firme pelo centro: nega o ângulo da resposta.", proxima: "d3" })),
      ],
    };
  }
  var vantagem = {
    id: "vantagem", trilha: "inicio", titulo: "Saque no lado da vantagem",
    chamada: "15–30, você saca no lado da vantagem. Aberto, no corpo ou no T, e o que vem depois?",
    placar: "15–30", sacador: "Você sacando", lado: "Lado da vantagem",
    contexto: "15–30, você saca no lado da vantagem. O adversário espera atrás da linha de base, mais perto do lado do backhand dele.",
    inicio: { jog: [-0.7, -12.1], adv: [2.6, 12.8], hContato: 2.6, saque: true },
    etapas: {
      d1: {
        tipo: "golpe", numero: 1, contexto: "saque", tatica: "inicio", golpe: "Primeiro saque",
        situacao: "Saque, devolução e as duas bolas seguintes decidem a maior parte dos pontos. As três direções podem servir: depende da sua intenção, da execução e do adversário.",
        pergunta: "Onde sacar?",
        opcoes: [
          opc("aberto", "Sacar aberto", [3.5, 5.5], { risco: 0.5, pressao: 1.2, objetivo: "quadra", ideal: { altura: ["media"], intensidade: ["firme", "controlada"] },
            texto: "No lado da vantagem, o saque aberto vai para o backhand do adversário e o tira da quadra pela lateral. Abre o lado do forehand dele para a sua primeira bola, mas pede direção precisa perto da linha.",
            resumo: "Aberto: tira o adversário pela lateral do backhand.",
            resposta: { quique: [-0.6, -7.4], contato: [-0.8, -9.6], advRecupera: [1.3, 12.2] }, proxima: "d2_aberto" }),
          opc("corpo", "Sacar no corpo", [2.2, 5.6], { risco: 0, pressao: 1.0, objetivo: "tempo", ideal: { altura: ["media"], intensidade: ["firme", "controlada"] },
            texto: "No corpo, o saque tira do adversário o espaço para soltar o braço. A devolução tende a vir central, e uma primeira bola agressiva pelo centro nega a ele o ângulo.",
            resumo: "No corpo: devolução central, sem ângulo.",
            resposta: { quique: [0.2, -7.3], contato: [0.4, -9.5], advRecupera: [0.9, 12.3] }, proxima: "d2_corpo" }),
          opc("t", "Sacar no T", [0.35, 5.8], { risco: 0.3, pressao: 1.1, objetivo: "tempo", ideal: { altura: ["media", "baixa"], intensidade: ["firme"] },
            texto: "O saque fechado, no T, passa pela parte mais baixa da rede e reduz o ângulo da devolução. Como a devolução pode voltar pela paralela, a primeira bola e a recuperação precisam proteger esse lado.",
            resumo: "No T: rede mais baixa, menos ângulo para a devolução.",
            resposta: { quique: [1.0, -7.1], contato: [1.3, -9.4], advRecupera: [-0.3, 12.4] }, proxima: "d2_t" }),
        ],
      },
      d2_aberto: d2PrimeiraBola("O adversário devolveu esticado, de backhand, e a bola veio curta no meio. Você contornou para jogar de forehand, equilibrado. Ele ainda volta do lado de fora.",
        { espaco: [-2.7, 8.8], contrape: [3.0, 9.4], centro: [0.3, 10.2] },
        { espaco: "O adversário ainda volta do lado de fora. Atacar o lado aberto com margem, longe das linhas, já o faz correr toda a quadra.",
          contrape: "Jogar de volta para onde ele saiu pega o adversário mudando de direção. Funciona quando ele corre cedo para o lado aberto; aqui, ele ainda nem chegou ao centro, e a bola vai na direção dele.",
          centro: "Pelo centro você nega o ângulo, mas o adversário ainda se recupera: a bola central dá a ele um caminho curto de volta." },
        { contrape: { risco: 1 }, centro: { pressao: 1.0, risco: 0.5 } }),
      d2_corpo: d2PrimeiraBola("O adversário se encolheu para devolver o saque no corpo, e a devolução veio central e curta. Você chegou equilibrado.",
        { espaco: [-2.7, 8.8], contrape: [2.8, 9.2], centro: [0.2, 10.2] },
        { espaco: "Com a devolução central, o lado oposto ao adversário é o espaço maior. Com margem, a bola já o obriga a se deslocar.",
          contrape: "Ele quase não se deslocou: o contrapé aqui é só uma bola no lado em que ele já está.",
          centro: "Depois do saque no corpo, a primeira bola agressiva e profunda pelo centro continua negando o ângulo ao adversário: ele não tem de onde abrir a quadra." },
        { contrape: { risco: 1 }, centro: { pressao: 1.5 } }),
      d2_t: d2PrimeiraBola("O adversário bloqueou o saque no T e a bola veio curta, no seu forehand. Ele voltou para perto do centro, um pouco para o lado do forehand dele.",
        { espaco: [2.8, 9.0], contrape: [-2.8, 9.2], centro: [0.0, 10.2] },
        { espaco: "Com o adversário um pouco para o lado do forehand, o backhand dele é o espaço aberto. Com margem, na paralela, a bola busca o espaço sem depender da linha.",
          contrape: "O contrapé aqui é o lado do forehand dele, onde ele já está chegando: a bola vai para a força do adversário.",
          centro: "Pelo centro, a bola nega o ângulo, mas não aproveita o espaço que existe no backhand dele." },
        { contrape: { risco: 1 }, centro: { pressao: 1.1, risco: 0.5 } }),
      d3: recAtaque(),
    },
    missao: {
      titulo: "Saque no lado da vantagem e primeira bola",
      texto: "Saque nas três direções do lado da vantagem e decida a primeira bola pela devolução: espaço aberto, contrapé ou centro.",
      passos: [
        "Com o professor, saque no lado da vantagem alternando aberto, no corpo e no T.",
        "Antes da primeira bola, diga em voz alta onde está o espaço aberto.",
        "Depois do saque no corpo, ataque pelo centro; depois do T, proteja a paralela.",
        "Exercícios do catálogo MTY: IP010 Saque no corpo + centro, IP011 Saque fechado + paralela protegida e PDS Saque + 1 bola AC.",
      ],
    },
    perguntaMetodo: "Depois do saque, você se posicionou antes de ver a devolução?",
  };

  var segundo = {
    id: "segundo", trilha: "inicio", titulo: "Segundo saque com intenção",
    chamada: "30–40, segundo saque. Colocar a bola em jogo ou sacar com intenção?",
    placar: "4–4 · 30–40", sacador: "Você sacando · segundo saque", lado: "Lado da vantagem",
    contexto: "4–4, 30–40: break point contra, segundo saque no lado da vantagem. O adversário deu um passo para dentro da quadra, esperando um segundo saque mais lento.",
    inicio: { jog: [-0.7, -12.1], adv: [2.4, 12.0], hContato: 2.5, saque: true },
    etapas: {
      d1: {
        tipo: "golpe", numero: 1, contexto: "saque", tatica: "inicio", golpe: "Segundo saque",
        situacao: "No segundo saque, a margem vem da altura sobre a rede e do efeito. O método proíbe sacar só para não errar.",
        pergunta: "Qual segundo saque?",
        opcoes: [
          opc("efeito", "Com efeito, alto, no backhand dele", [3.0, 5.0], { risco: 0, pressao: 1.0, objetivo: "quadra", ideal: { altura: ["alta", "media"], intensidade: ["firme", "controlada"] },
            texto: "A altura sobre a rede é a margem do segundo saque, e o efeito traz a bola de volta para dentro. No backhand dele, alto, a bola sobe acima da zona de força e empurra o adversário para trás: intenção positiva sem abrir mão da margem.",
            resumo: "Com efeito no backhand: margem pela altura e intenção na direção.",
            resposta: { quique: [-1.6, -8.8], contato: [-2.0, -11.3], advRecupera: [0.7, 12.2] }, proxima: "d2_efeito" }),
          opc("corpo", "No corpo, com efeito", [1.7, 5.3], { risco: 0.3, pressao: 0.9, objetivo: "tempo", ideal: { altura: ["alta", "media"], intensidade: ["firme"] },
            texto: "No corpo, o segundo saque tira o espaço de braço de quem entrou para atacar. A devolução tende a vir central, sem ângulo.",
            resumo: "No corpo: tira o espaço de quem entrou para atacar.",
            resposta: { quique: [0.1, -8.2], contato: [0.3, -10.8], advRecupera: [0.4, 12.3] }, proxima: "d2_corpo" }),
          opc("colocar", "Só colocar a bola em jogo", [1.0, 3.9], { risco: 0, pressao: 0.2, nivel: "iniciativa", objetivo: "margem", ideal: { altura: ["media"], intensidade: ["controlada"] },
            texto: "Sacar só para não errar é o que o método pede para nunca fazer: a bola curta e lenta no meio da área de saque convida o adversário a atacar a devolução, e o ponto começa com você defendendo.",
            resumo: "Só colocar em jogo: o ponto começa com você defendendo.",
            resposta: { quique: [3.0, -9.8], contato: [3.8, -12.3], advRecupera: [-0.4, 10.6] }, proxima: "d2_colocar" }),
        ],
      },
      d2_efeito: {
        tipo: "golpe", numero: 2, contexto: "neutro", tatica: "construcao", golpe: "Backhand, equilibrado",
        situacao: "A devolução veio neutra e funda no seu backhand. O adversário voltou para perto do centro.",
        pergunta: "Como seguir?",
        opcoes: [
          opc("cruzada", "Cruzada profunda no backhand dele", [2.4, 9.2], { risco: 0, pressao: 1.0, objetivo: "quadra", ideal: IDEAL_BASE,
            texto: "A cruzada profunda volta para o backhand dele e mantém você no comando da troca sem forçar uma bola funda.", resumo: "Cruzada profunda: comando da troca sem forçar.", proxima: "d3" }),
          opc("paralela", "Acelerar a paralela de backhand", [-3.3, 9.8], { risco: 1, pressao: 1.6, contexto: "ataque", objetivo: "tempo", ideal: { altura: ["media"], intensidade: ["firme"] },
            texto: "A paralela de uma bola funda cruza a parte alta da rede. É uma troca de direção antes da bola certa: a bola funda pede a diagonal.", resumo: "Paralela de uma bola funda: troca antes da hora.", proxima: "d3" }),
          opc("angulo", "Ângulo curto cruzado", [3.4, 5.0], { risco: 1, pressao: 1.3, contexto: "ataque", objetivo: "angulo", ideal: { altura: ["media"], intensidade: ["controlada", "firme"] },
            texto: "Produzir ângulo de uma bola funda pede uma bola lenta e com efeito, que dá tempo ao adversário de chegar.", resumo: "Ângulo de uma bola funda: o adversário chega.", proxima: "d3" }),
        ],
      },
      d2_corpo: {
        tipo: "golpe", numero: 2, contexto: "ataque", tatica: "construcao", golpe: "Forehand, no centro",
        situacao: "A devolução veio central. Você joga de forehand, perto do meio da quadra, e o adversário está no centro.",
        pergunta: "Como seguir?",
        opcoes: [
          opc("backhand", "Profunda no backhand dele", [2.6, 9.4], { risco: 0, pressao: 1.3, objetivo: "quadra", ideal: { altura: ["media", "alta"], intensidade: ["firme"] },
            texto: "Profunda no backhand dele, a bola ganha a quadra e tira o adversário do centro pelo lado em que ele tem menos força.", resumo: "Profunda no backhand: ganhar a quadra pelo lado mais fraco.", proxima: "d3" }),
          opc("angulo", "Ângulo no forehand dele", [-3.4, 5.6], { risco: 1, pressao: 1.3, objetivo: "angulo", ideal: { altura: ["media"], intensidade: ["controlada", "firme"] },
            texto: "O ângulo no forehand dele abre a quadra, mas vai para o lado da força do adversário e de perto do centro, onde ele chega bem.", resumo: "Ângulo no forehand: abre, mas vai para a força dele.", proxima: "d3" }),
          opc("centro", "Bola no centro, sem direção", [0.2, 8.6], { risco: 0, pressao: 0.5, nivel: "iniciativa", contexto: "neutro", objetivo: "margem", ideal: IDEAL_BASE,
            texto: "Uma bola no centro, curta e sem direção, não ganha quadra, não produz ângulo nem tira tempo: devolve ao adversário a escolha do ponto.", resumo: "No centro, sem direção: o adversário escolhe.", proxima: "d3" }),
        ],
      },
      d2_colocar: d2Defesa("O adversário atacou a devolução no seu forehand e entrou na quadra. Você corre para fora, atrás da linha.", 1, "Forehand, correndo", "d3"),
      d3: recFundo(),
    },
    missao: {
      titulo: "Segundo saque com alvo e plano",
      texto: "Saque apenas segundos saques, com alvo e plano declarados. Proibido jogar para não errar.",
      passos: [
        "Antes de cada segundo saque, diga o alvo e o tipo: com efeito no backhand ou no corpo.",
        "Use altura sobre a rede como margem, não a velocidade reduzida.",
        "Nas primeiras sessões, não conte as duplas faltas: conte quantos saques tiveram intenção.",
        "Exercícios do catálogo MTY: IP015 Segundo saque com alvo e IP019 Saque sob placar adverso.",
      ],
    },
    perguntaMetodo: "Seu segundo saque teve uma intenção, ou foi só para não errar?",
  };

  var devolucao = {
    id: "devolucao", trilha: "inicio", titulo: "Devolução do segundo saque",
    chamada: "30–30, segundo saque do adversário. Você entrou para devolver na subida. E agora?",
    placar: "4–4 · 30–30", sacador: "Adversário sacando · segundo saque", lado: "Lado da igualdade",
    contexto: "4–4, 30–30, segundo saque do adversário no lado da igualdade. Você entrou na quadra para devolver na subida do quique, de forehand.",
    inicio: { jog: [2.1, -8.6], adv: [-0.7, 11.8], hContato: 1.0, previa: { de: [-0.8, 12.1], quique: [1.7, -5.0] } },
    etapas: {
      d1: {
        tipo: "golpe", numero: 1, contexto: "ataque", tatica: "inicio", golpe: "Devolução de forehand, na subida",
        situacao: "Devolver na subida do quique rouba o tempo do sacador. A devolução decide o ponto tão cedo quanto o saque.",
        pergunta: "Para onde devolver?",
        opcoes: [
          opc("paralela", "Na paralela, no backhand dele", [2.9, 9.4], { risco: 0, pressao: 1.6, objetivo: "tempo", ideal: IDEAL_ATAQUE,
            texto: "Da subida do quique, a paralela no backhand do sacador é o caminho mais curto para tirar o tempo dele. No método, a paralela no ataque busca margem: mire a um metro da linha, não em cima dela.",
            resumo: "Paralela no backhand, com margem: tirar o tempo do sacador.",
            resposta: { quique: [-1.4, -7.6], contato: [-1.6, -9.6], advRecupera: [1.0, 12.1] }, proxima: "d2_paralela" }),
          opc("centro", "Profunda no centro", [0.2, 10.3], { risco: 0, pressao: 1.2, objetivo: "quadra", ideal: { altura: ["media", "alta"], intensidade: ["firme"] },
            texto: "Profunda no centro, a devolução nega o ângulo ao sacador e mantém você dentro da quadra. Tira menos tempo que a paralela, mas exige pouca precisão.",
            resumo: "Profunda no centro: nega o ângulo com pouca precisão exigida.",
            resposta: { quique: [0.9, -7.8], contato: [1.1, -9.9], advRecupera: [-0.4, 12.2] }, proxima: "d2_centro" }),
          opc("angulo", "Cruzada angulada, curta", [-3.4, 6.4], { risco: 1, pressao: 1.4, objetivo: "angulo", ideal: { altura: ["media"], intensidade: ["firme", "controlada"] },
            texto: "O ângulo cruzado tira o sacador da quadra, mas a bola curta e angulada abre a paralela para ele se a devolução não sair perfeita.",
            resumo: "Cruzada angulada: abre a quadra, e abre a paralela para ele.",
            resposta: { quique: [2.9, -8.2], contato: [3.6, -10.6], advRecupera: [-1.6, 10.8] }, proxima: "d2_angulo" }),
        ],
      },
      d2_paralela: {
        tipo: "golpe", numero: 2, contexto: "ataque", tatica: "ataque", golpe: "Backhand, dentro da quadra",
        situacao: "O sacador chegou esticado à paralela e respondeu cruzado, no seu backhand, sem profundidade. Ele ainda volta do canto.",
        pergunta: "E a sua segunda bola?",
        opcoes: [
          opc("aberto", "Atacar o lado aberto na paralela", [-2.9, 9.2], { risco: 0, pressao: 1.7, objetivo: "quadra", ideal: IDEAL_ATAQUE,
            texto: "O adversário saiu pelo canto do backhand: o lado do forehand dele está aberto. A paralela de backhand, com margem, faz ele correr toda a quadra.", resumo: "Lado aberto: o adversário corre toda a quadra.", proxima: "d3" }),
          opc("contrape", "Repetir no backhand dele", [2.6, 9.4], { risco: 0.5, pressao: 1.3, objetivo: "tempo", ideal: { altura: ["media"], intensidade: ["firme"] },
            texto: "Repetir no backhand dele pega o adversário no contrapé só se ele já tiver saído correndo para o outro lado. Aqui, ele ainda está voltando do canto e a bola vai na direção dele.", resumo: "Repetir: vai na direção em que ele já está.", proxima: "d3" }),
          opc("alta", "Bola alta no centro", [0.2, 9.6], { risco: 0, pressao: 0.5, nivel: "iniciativa", contexto: "neutro", objetivo: "margem", ideal: IDEAL_BASE,
            texto: "A bola alta no centro devolve ao sacador o tempo que a devolução tinha roubado.", resumo: "Alta no centro: devolve o tempo roubado.", proxima: "d3" }),
        ],
      },
      d2_centro: d2Construcao("A troca começou neutra: o sacador devolveu do centro e a bola veio para o seu forehand, sem pressão.", 1, "Forehand, equilibrado", "d3", "A devolução profunda tirou o ângulo do sacador e a troca está neutra."),
      d2_angulo: d2Defesa("O sacador chegou ao ângulo e respondeu na paralela, no seu forehand. Você corre para fora da quadra.", 1, "Forehand, correndo", "d3"),
      d3: recAtaque(),
    },
    missao: {
      titulo: "Devolução do segundo saque",
      texto: "Devolva o segundo saque na subida do quique, com a direção decidida antes do saque do adversário.",
      passos: [
        "Espere o segundo saque um passo dentro da quadra e faça o split no contato do sacador.",
        "Decida a direção antes do saque: paralela no backhand com margem, ou profunda no centro.",
        "Depois da devolução, decida se sobe: a decisão vem antes de devolver.",
        "Exercícios do catálogo MTY: RT007 Devolução que rouba tempo, IP017 Devolução + subida e ADV012 Devolução do 2º saque.",
      ],
    },
    perguntaMetodo: "Você decidiu a direção da devolução antes do saque do adversário?",
  };

  /* ════ CONSTRUÇÃO ════ */
  var troca = {
    id: "troca", trilha: "construcao", titulo: "Leia a cruzada antes de trocar",
    chamada: "Troca cruzada de forehand. Quando a bola permite mudar de direção?",
    placar: "2–2 · 15–15", sacador: "Troca de fundo", lado: "Forehand contra forehand",
    contexto: "A troca está cruzada, forehand contra forehand. A bola do adversário chega funda, perto da sua linha de base, com peso.",
    inicio: { jog: [2.9, -12.3], adv: [-2.6, 12.4], hContato: 0.9, previa: { de: [-2.7, 12.6], quique: [2.4, -9.6] } },
    etapas: {
      d1: {
        tipo: "golpe", numero: 1, contexto: "neutro", tatica: "neutra", golpe: "Forehand, bola funda",
        situacao: "Você está atrás da linha, com a bola chegando pesada. O adversário está na diagonal, no lado do forehand dele.",
        pergunta: "Manter ou trocar de direção?",
        opcoes: [
          opc("manter", "Manter a cruzada profunda", [-2.4, 9.4], { risco: 0, pressao: 1.0, objetivo: "quadra", ideal: IDEAL_BASE,
            texto: "Bola funda e pesada não é a bola de trocar de direção. A cruzada profunda segue pela parte baixa da rede e pela quadra mais longa, e prepara a bola certa para a troca sem abrir mão da intenção.",
            resumo: "Manter a cruzada: a bola funda não é a bola da troca.",
            resposta: { quique: [2.0, -7.6], contato: [2.4, -10.2], advRecupera: [-1.4, 12.2] }, proxima: "d2_manter" }),
          opc("trocar", "Trocar para a paralela agora", [3.5, 10.0], { risco: 1.5, pressao: 1.4, contexto: "ataque", objetivo: "tempo", ideal: { altura: ["media"], intensidade: ["firme"] },
            texto: "Trocar para a paralela a partir de uma bola funda e pesada é trocar por impulso: a bola cruza a parte alta da rede, de uma posição recuada, e abre a sua quadra para a resposta cruzada.",
            resumo: "Trocar agora: troca por impulso, de uma bola funda.",
            resposta: { quique: [-2.8, -8.2], contato: [-3.5, -10.9], advRecupera: [1.0, 12.3] }, proxima: "d2_trocar" }),
          opc("angulo", "Cruzada angulada, mais curta", [-3.4, 5.6], { risco: 1, pressao: 1.2, contexto: "ataque", objetivo: "angulo", ideal: { altura: ["media"], intensidade: ["controlada", "firme"] },
            texto: "Produzir ângulo de uma bola funda pede uma bola mais lenta e com efeito, que fica mais tempo no ar. É possível, mas o adversário, que já está na diagonal, chega com facilidade.",
            resumo: "Ângulo de uma bola funda: o adversário já está na diagonal.",
            resposta: { quique: [3.0, -8.0], contato: [3.7, -10.6], advRecupera: [-1.8, 11.2] }, proxima: "d2_angulo" }),
        ],
      },
      d2_manter: {
        tipo: "golpe", numero: 2, contexto: "ataque", tatica: "construcao", golpe: "Forehand, bola mais curta",
        situacao: "A resposta veio cruzada, mais curta e mais lenta. Você chegou equilibrado, e o adversário ainda está do lado da diagonal.",
        pergunta: "Agora é a bola da troca?",
        opcoes: [
          opc("trocar", "Trocar para a paralela com margem", [3.3, 9.6], { risco: 0, pressao: 1.7, objetivo: "tempo", ideal: { altura: ["media"], intensidade: ["firme", "maxima"] },
            texto: "Esta é a bola da troca: mais curta, mais lenta, com você equilibrado e o adversário na diagonal. A paralela no ataque busca margem: mire dentro, e a mudança de direção já tira o tempo dele.",
            resumo: "Bola certa para trocar: paralela com margem.", proxima: "d3" }),
          opc("manter", "Manter mais uma cruzada", [-2.4, 9.4], { risco: 0.5, pressao: 1.0, contexto: "neutro", objetivo: "quadra", ideal: IDEAL_BASE,
            texto: "Mais uma cruzada mantém a troca, mas deixa passar a janela: a bola mais curta era a chance de mudar de direção com margem.",
            resumo: "Mais uma cruzada: a janela da troca passa.", proxima: "d3" }),
          opc("angulo", "Ângulo curto cruzado", [-3.5, 5.4], { risco: 0.5, pressao: 1.5, objetivo: "angulo", ideal: { altura: ["media"], intensidade: ["controlada", "firme"] },
            texto: "Com a bola mais curta, o ângulo cruzado também é possível: tira o adversário pela lateral e abre a paralela para a bola seguinte.",
            resumo: "Ângulo curto: abre a paralela para a próxima.", proxima: "d3" }),
        ],
      },
      d2_trocar: d2Defesa("O adversário respondeu cruzado, para o lado que a sua troca abriu. Você atravessou a quadra e chega de backhand, correndo.", -1, "Backhand, correndo", "d3"),
      d2_angulo: d2Defesa("O adversário chegou ao ângulo e respondeu na paralela, no canto do seu forehand. Você corre para fora da quadra.", 1, "Forehand, correndo", "d3"),
      d3: recFundo(),
    },
    missao: {
      titulo: "Leitura da cruzada e troca de direção",
      texto: "Reconheça quando a bola permite trocar de direção (abrir para a paralela) e quando é para manter a cruzada.",
      passos: [
        "O professor alimenta bolas cruzadas, umas fundas e pesadas, outras curtas e lentas.",
        "Nas fundas, mantenha a cruzada profunda. Nas curtas, troque para a paralela com margem.",
        "Diga em voz alta, antes de bater, se a bola é para manter ou para trocar.",
        "Exercícios do catálogo MTY: PT001 Leitura de Bola Cruzada e Troca de Direção e DT010 Ponto Restrição - Só Cruzadas.",
      ],
    },
    perguntaMetodo: "Você trocou de direção na bola certa, ou por impulso?",
  };

  /* Pop, Push, Open, Close: três golpes em sequência no caminho principal */
  function fecho(situacao, sx, opcoes) {
    return { tipo: "golpe", numero: 3, contexto: "ataque", tatica: "ataque", golpe: sx > 0 ? "Forehand, bola curta" : "Backhand", situacao: situacao, pergunta: "Como fechar?", opcoes: opcoes };
  }
  var pop = {
    id: "pop", trilha: "construcao", titulo: "Arma, abre e fecha",
    chamada: "O padrão Pop, Push, Open, Close: cada bola tem um papel.",
    placar: "1–1 · 30–15", sacador: "Troca de fundo", lado: "Construção do ponto",
    contexto: "Troca neutra. O adversário mandou uma bola funda no centro e você joga de forehand, equilibrado. Neste cenário, as três decisões são golpes: armar, abrir e fechar.",
    inicio: { jog: [1.2, -12.0], adv: [0.4, 12.4], hContato: 0.9, previa: { de: [0.3, 12.5], quique: [1.0, -9.0] } },
    etapas: {
      d1: {
        tipo: "golpe", numero: 1, contexto: "neutro", tatica: "construcao", golpe: "Forehand, equilibrado",
        situacao: "No padrão do método, a primeira bola arma, a segunda empurra e abre, e a terceira fecha mudando de direção.",
        pergunta: "Arma: qual a primeira bola?",
        opcoes: [
          opc("pop", "Profunda, para armar", [0.6, 10.4], { risco: 0, pressao: 1.1, objetivo: "quadra", ideal: { altura: ["media", "alta"], intensidade: ["firme"] },
            texto: "A primeira bola arma: profunda, ela empurra o adversário para trás e faz a resposta dele chegar mais curta, o que abre o resto do padrão.",
            resumo: "Armar: profunda, para a próxima bola chegar curta.",
            resposta: { quique: [1.4, -7.2], contato: [1.8, -9.4], advRecupera: [0.3, 12.6] }, proxima: "d2_pop" }),
          opc("angulo", "Angular logo de cara", [-3.4, 5.6], { risco: 1, pressao: 1.2, contexto: "ataque", objetivo: "angulo", ideal: { altura: ["media"], intensidade: ["controlada", "firme"] },
            texto: "Angular antes de armar inverte a ordem do padrão: com o adversário no centro e perto da linha, o ângulo fica curto e ele chega com tempo.",
            resumo: "Angular antes de armar: o adversário chega com tempo.",
            resposta: { quique: [2.8, -8.4], contato: [3.5, -10.9], advRecupera: [-1.6, 11.0] }, proxima: "d2_angulo" }),
          opc("paralela", "Fechar já na paralela", [3.5, 10.2], { risco: 1.5, pressao: 1.4, contexto: "ataque", objetivo: "tempo", ideal: { altura: ["media"], intensidade: ["firme"] },
            texto: "Fechar o ponto na primeira bola, sem armar nem abrir, é procurar a definição antes da hora: o adversário está no centro e a paralela passa perto dele.",
            resumo: "Fechar sem armar: definição antes da hora.",
            resposta: { quique: [-2.6, -8.4], contato: [-3.3, -11.0], advRecupera: [1.1, 12.2] }, proxima: "d2_paralela" }),
        ],
      },
      d2_pop: {
        tipo: "golpe", numero: 2, contexto: "ataque", tatica: "construcao", golpe: "Forehand, bola mais curta",
        situacao: "A bola profunda funcionou: o adversário ficou atrás da linha e a resposta veio mais curta, no seu forehand.",
        pergunta: "Abre: qual a segunda bola?",
        opcoes: [
          opc("push", "Angulada cruzada, para abrir", [-3.4, 6.4], { risco: 0, pressao: 1.5, objetivo: "angulo", ideal: { altura: ["media"], intensidade: ["firme", "controlada"] },
            texto: "A bola veio mais curta: é a hora de abrir. A angulada cruzada tira o adversário pela lateral e abre a paralela para a bola seguinte.",
            resumo: "Abrir: angulada cruzada, o adversário sai pela lateral.",
            resposta: { quique: [1.9, -6.8], contato: [2.2, -8.8], advRecupera: [-2.2, 11.0] }, proxima: "d3_push" }),
          opc("pop2", "Mais uma profunda no centro", [0.2, 10.4], { risco: 0.5, pressao: 1.0, contexto: "neutro", objetivo: "quadra", ideal: { altura: ["media", "alta"], intensidade: ["firme"] },
            texto: "Mais uma profunda mantém a pressão, mas a bola curta que você criou era a deixa para abrir a quadra.",
            resumo: "Mais uma profunda: a deixa para abrir passou.",
            resposta: { quique: [1.2, -7.6], contato: [1.6, -9.8], advRecupera: [0.2, 12.5] }, proxima: "d3_pop2" }),
          opc("fechar", "Fechar já na paralela", [3.5, 10.2], { risco: 1, pressao: 1.6, objetivo: "tempo", ideal: { altura: ["media"], intensidade: ["firme"] },
            texto: "Fechar sem abrir: com a bola curta a paralela é possível, mas o adversário está no centro e cobre o lado com poucos passos.",
            resumo: "Fechar sem abrir: o adversário cobre com poucos passos.",
            resposta: { quique: [-2.4, -8.0], contato: [-3.0, -10.4], advRecupera: [1.0, 12.0] }, proxima: "d3_fechar" }),
        ],
      },
      d3_push: fecho("O adversário saiu pela lateral para pegar a angulada e devolveu uma bola curta e alta no seu forehand. O lado da paralela está aberto.", 1, [
        opc("close", "Mudar de direção na paralela", [3.2, 9.4], { risco: 0, pressao: 1.9, objetivo: "tempo", ideal: IDEAL_ATAQUE,
          texto: "Close: com o adversário fora pela lateral, a mudança de direção na paralela fecha o padrão no lado que a bola anterior abriu. No ataque, a paralela busca margem: mire dentro, não na linha.",
          resumo: "Fechar mudando de direção, no lado que a angulada abriu." }),
        opc("repetir", "Repetir a angulada", [-3.4, 6.2], { risco: 0.5, pressao: 1.3, nivel: "inicio", objetivo: "angulo", ideal: { altura: ["media"], intensidade: ["firme"] },
          texto: "Repetir o ângulo leva a bola para onde o adversário já está indo: ele corre na direção certa e chega.",
          resumo: "Repetir a angulada: o adversário já corre para lá." }),
        opc("curtinha", "Curtinha no lado aberto", [1.8, 2.6], { risco: 1, pressao: 1.5, objetivo: "tempo", ideal: { altura: ["media"], intensidade: ["controlada"] },
          texto: "A curtinha também fecha, porque atacar por variação é ataque no método. Mas o adversário está no fundo e perto da lateral: a curtinha no lado aberto exige toque e disfarce.",
          resumo: "Curtinha: também fecha, com toque e disfarce." }),
      ]),
      d3_pop2: fecho("O adversário continua no centro, atrás da linha, e a bola volta mais uma vez curta no seu forehand.", 1, [
        opc("push", "Agora abrir com a angulada", [-3.4, 6.2], { risco: 0, pressao: 1.5, objetivo: "angulo", ideal: { altura: ["media"], intensidade: ["firme", "controlada"] },
          texto: "Com a segunda bola curta, a angulada retoma o padrão: abre a quadra pela lateral para a bola seguinte.", resumo: "Retomar o padrão: abrir agora." }),
        opc("profunda", "Mais uma profunda", [0.2, 10.4], { risco: 0.5, pressao: 1.0, contexto: "neutro", nivel: "inicio", objetivo: "quadra", ideal: { altura: ["media", "alta"], intensidade: ["firme"] },
          texto: "Mais uma profunda segura a troca, mas o padrão pede que, com a bola curta, você passe para a fase de abrir.", resumo: "Mais uma profunda: o padrão não avança." }),
        opc("paralela", "Fechar na paralela", [3.4, 9.8], { risco: 1, pressao: 1.6, objetivo: "tempo", ideal: { altura: ["media"], intensidade: ["firme"] },
          texto: "Fechar sem abrir: o adversário está no centro e a paralela passa perto dele.", resumo: "Fechar sem abrir: perto do adversário." }),
      ]),
      d3_fechar: fecho("O adversário chegou à paralela e respondeu cruzado, no seu backhand. O ponto voltou a ser neutro.", -1, [
        opc("reconstruir", "Cruzada profunda para reconstruir", [2.4, 9.4], { risco: 0, pressao: 1.0, contexto: "neutro", objetivo: "quadra", ideal: IDEAL_BASE,
          texto: "O fechamento antecipado não deu certo; a cruzada profunda reconstrói o padrão do começo: armar de novo.", resumo: "Reconstruir: armar de novo." }),
        opc("insistir", "Insistir na paralela", [-3.4, 10.0], { risco: 1.5, pressao: 1.5, objetivo: "tempo", ideal: { altura: ["media"], intensidade: ["firme"] },
          texto: "Insistir na paralela de backhand, de uma bola neutra, repete a definição antes da hora.", resumo: "Insistir: definição antes da hora, de novo." }),
        opc("centro", "Bola alta no centro", [0.2, 9.8], { risco: 0, pressao: 0.5, nivel: "iniciativa", contexto: "neutro", objetivo: "margem", ideal: IDEAL_BASE,
          texto: "A bola alta no centro devolve ao adversário a escolha do ponto.", resumo: "Alta no centro: o adversário escolhe." }),
      ]),
      d2_angulo: d2Defesa("O adversário chegou ao ângulo com tempo e respondeu na paralela, no canto do seu forehand. Você corre para fora da quadra.", 1, "Forehand, correndo", "d3"),
      d2_paralela: d2Defesa("O adversário chegou à paralela e respondeu cruzado, no seu backhand. Você atravessou a quadra correndo.", -1, "Backhand, correndo", "d3"),
      d3: recFundo(),
    },
    missao: {
      titulo: "Pop, Push, Open, Close",
      texto: "Instale o padrão nomeado do método: arma profundo, empurra angulado, fecha na mudança de direção.",
      passos: [
        "O professor alimenta a sequência: uma bola para armar, uma curta para abrir, uma para fechar.",
        "Diga o papel de cada bola antes de bater: armar, abrir ou fechar.",
        "No começo, errar a ordem faz parte: o padrão se instala repetindo.",
        "Exercícios do catálogo MTY: PT003 Pop, Push, Open, Close e ADV001 Construção em 4 Bolas MTY.",
      ],
    },
    perguntaMetodo: "Cada bola teve o seu papel: armar, abrir, fechar?",
  };

  var empurra = {
    id: "empurra", trilha: "construcao", titulo: "Empurre e mude de direção",
    chamada: "A bola que empurra o adversário para trás é a que abre a mudança de direção.",
    placar: "3–3 · 15–30", sacador: "Troca de fundo", lado: "Construção do ponto",
    contexto: "Troca neutra. A bola chegou no meio-esquerda da sua quadra e você contornou para jogar de forehand.",
    inicio: { jog: [-2.0, -11.8], adv: [0.6, 12.3], hContato: 0.9, previa: { de: [0.7, 12.4], quique: [-1.6, -9.0] } },
    etapas: {
      d1: {
        tipo: "golpe", numero: 1, contexto: "neutro", tatica: "construcao", golpe: "Forehand invertido, equilibrado",
        situacao: "Você está no lado do backhand, de forehand. O adversário está no centro, atrás da linha.",
        pergunta: "Como empurrar o adversário?",
        opcoes: [
          opc("empurrar", "Alta e profunda, inside-out no backhand dele", [2.6, 10.4], { risco: 0, pressao: 1.2, objetivo: "quadra", ideal: { altura: ["alta", "media"], intensidade: ["firme"] },
            texto: "Inside-out alto e profundo no backhand dele empurra o adversário para trás da linha. É a bola que o método pede antes da mudança de direção: ela precisa realmente tirar o adversário da posição.",
            resumo: "Empurrar: alta e profunda, tirando o adversário da posição.",
            resposta: { quique: [-0.4, -7.4], contato: [-0.6, -9.6], advRecupera: [1.8, 12.8] }, proxima: "d2_empurrar" }),
          opc("rapida", "Rápida e baixa no centro", [0.4, 9.0], { risco: 0.5, pressao: 1.0, contexto: "ataque", objetivo: "tempo", ideal: { altura: ["baixa", "media"], intensidade: ["firme", "maxima"] },
            texto: "Rápida e no centro, a bola não desloca o adversário: ele devolve de onde está, e você não ganha quadra nem ângulo. No método, profundidade vem antes de velocidade.",
            resumo: "Rápida no centro: não desloca o adversário.",
            resposta: { quique: [0.8, -8.0], contato: [1.0, -10.4], advRecupera: [0.4, 12.2] }, proxima: "d2_rapida" }),
          opc("insidein", "Inside-in na paralela", [-3.4, 10.2], { risco: 1, pressao: 1.6, contexto: "ataque", objetivo: "tempo", ideal: { altura: ["media"], intensidade: ["firme"] },
            texto: "Inside-in direto, sem empurrar antes, é a definição sem preparação: a bola cruza a parte alta da rede e, se não for profunda, deixa o seu lado do forehand aberto para a resposta.",
            resumo: "Inside-in sem preparar: definição antes da hora.",
            resposta: { quique: [2.8, -8.0], contato: [3.5, -10.6], advRecupera: [-1.4, 11.6] }, proxima: "d2_insidein" }),
        ],
      },
      d2_empurrar: {
        tipo: "golpe", numero: 2, contexto: "ataque", tatica: "ataque", golpe: "Forehand, bola central",
        situacao: "O adversário devolveu de trás da linha, no canto do backhand dele, e a bola voltou mais central. Ele ainda está no canto.",
        pergunta: "É hora de mudar de direção?",
        opcoes: [
          opc("mudar", "Mudar de direção, para o lado aberto", [-3.0, 9.0], { risco: 0, pressao: 1.8, objetivo: "tempo", ideal: IDEAL_ATAQUE,
            texto: "A bola que empurrou funcionou: o adversário está no canto do backhand e a bola voltou central. Mudar de direção para o lado aberto fecha a jogada.", resumo: "Mudar de direção: fechar no lado aberto." }),
          opc("repetir", "Empurrar de novo no backhand", [2.6, 10.4], { risco: 0.5, pressao: 1.2, contexto: "neutro", nivel: "inicio", objetivo: "quadra", ideal: { altura: ["alta", "media"], intensidade: ["firme"] },
            texto: "Empurrar de novo mantém o adversário no canto, mas a bola central era a deixa para a mudança de direção.", resumo: "Empurrar de novo: a deixa passa." }),
          opc("curtinha", "Curtinha no lado aberto", [-1.6, 2.6], { risco: 0.5, pressao: 1.6, objetivo: "tempo", ideal: { altura: ["media"], intensidade: ["controlada"] },
            texto: "Com o adversário bem atrás da linha, a curtinha no lado aberto também é ataque por variação. Pede preparação idêntica à do drive até o último instante.", resumo: "Curtinha: ataque por variação, com o adversário no fundo." }),
        ].map(function (o) { o.proxima = "d3"; return o; }),
      },
      d2_rapida: {
        tipo: "golpe", numero: 2, contexto: "neutro", tatica: "construcao", golpe: "Forehand, equilibrado",
        situacao: "O adversário devolveu do centro, sem se deslocar. A troca continua neutra.",
        pergunta: "E agora?",
        opcoes: [
          opc("empurrar", "Agora sim: alta e profunda num canto", [2.6, 10.4], { risco: 0, pressao: 1.2, objetivo: "quadra", ideal: { altura: ["alta", "media"], intensidade: ["firme"] },
            texto: "Agora a bola alta e profunda no canto do backhand faz o que a bola rápida no centro não fez: tira o adversário da posição.", resumo: "Empurrar agora: tirar da posição." }),
          opc("mudar", "Mudar de direção mesmo assim", [-3.2, 9.4], { risco: 1, pressao: 1.5, contexto: "ataque", objetivo: "tempo", ideal: { altura: ["media"], intensidade: ["firme"] },
            texto: "Sem ter empurrado, a mudança de direção encontra o adversário no centro, perto da bola.", resumo: "Mudar sem empurrar: o adversário está perto." }),
          opc("centro", "Mais uma no centro", [0.3, 9.6], { risco: 0, pressao: 0.6, nivel: "iniciativa", objetivo: "margem", ideal: IDEAL_BASE,
            texto: "Mais uma bola no centro mantém o ponto sem intenção e devolve ao adversário a escolha.", resumo: "No centro de novo: sem intenção." }),
        ].map(function (o) { o.proxima = "d3"; return o; }),
      },
      d2_insidein: d2Defesa("O adversário chegou à paralela e respondeu cruzado, no canto do seu forehand, que tinha ficado aberto. Você corre para fora.", 1, "Forehand, correndo", "d3"),
      d3: recFundo(),
    },
    missao: {
      titulo: "Empurra e muda de direção",
      texto: "Empurre o adversário para trás com uma bola alta e profunda, recupere ao centro, receba a bola mais central e mude de direção.",
      passos: [
        "Comece com a bola que empurra: alta, profunda, nos últimos dois metros da quadra.",
        "Recupere ao centro antes da bola seguinte.",
        "Mude de direção só quando a bola voltar central e o adversário ainda estiver no canto.",
        "Exercícios do catálogo MTY: PT004 Empurra e Muda de Direção e PT008 Profundidade Acima de Velocidade.",
      ],
    },
    perguntaMetodo: "A bola que empurra tirou mesmo o adversário da posição?",
  };

  /* ════ ATAQUE E TRANSIÇÃO ════ */
  function d2Voleio(situacao, alvos, golpe, textos) {
    return {
      tipo: "golpe", numero: 2, contexto: "rede", tatica: "ataque", golpe: golpe, situacao: situacao, pergunta: "Qual voleio?",
      opcoes: [
        opc("aberto", "Voleio no lado aberto", alvos.aberto, { risco: 0, pressao: 1.8, objetivo: "angulo", ideal: { altura: ["baixa", "media"], intensidade: ["firme", "controlada"] }, texto: textos.aberto, resumo: "Voleio no lado aberto: longe do adversário.", proxima: "d3_rede" }),
        opc("fundo", "Voleio profundo na mesma linha", alvos.fundo, { risco: 0.5, pressao: 1.0, objetivo: "quadra", ideal: { altura: ["media"], intensidade: ["firme"] }, texto: textos.fundo, resumo: "Voleio profundo na mesma linha: perto de onde ele está.", proxima: "d3_rede" }),
        opc("deixada", "Deixadinha curta", alvos.deixada, { risco: 1, pressao: 1.5, objetivo: "tempo", ideal: { altura: ["baixa", "media"], intensidade: ["controlada"] }, texto: textos.deixada, resumo: "Deixadinha: funciona com o adversário longe, pede mãos macias.", proxima: "d3_rede" }),
      ],
    };
  }
  var convite = {
    id: "convite", trilha: "ataque", titulo: "Bola curta é convite",
    chamada: "A bola do adversário veio curta. Atacar o espaço, subir ou a curtinha?",
    placar: "2–3 · 15–15", sacador: "Troca de fundo", lado: "Bola curta",
    contexto: "A bola do adversário veio curta e baixa, no meio da sua quadra. Você entrou e chega a ela de forehand, dentro da quadra.",
    inicio: { jog: [2.0, -6.2], adv: [-0.8, 12.2], hContato: 0.8, previa: { de: [-0.9, 12.3], quique: [1.6, -4.4] } },
    etapas: {
      d1: {
        tipo: "golpe", numero: 1, contexto: "ataque", tatica: "ataque", golpe: "Forehand, dentro da quadra",
        situacao: "Bola curta é convite: o método pede entrar e decidir antes de chegar à bola. O adversário está no fundo, perto do centro.",
        pergunta: "O que fazer com a bola curta?",
        opcoes: [
          opc("approach", "Approach na paralela e subir", [3.3, 9.6], { risco: 0, pressao: 1.6, objetivo: "tempo", ideal: { altura: ["media"], intensidade: ["firme", "controlada"] },
            texto: "O approach na paralela, profundo, sobe com você pela linha da bola. Depois dele, o split na zona de voleio cobre a rota provável da passada.",
            resumo: "Approach na paralela e subida: atacar e finalizar à frente.",
            resposta: { voleio: true, contato: [1.8, -3.0], jogRecupera: [2.0, -3.8], advRecupera: [2.4, 12.4] }, proxima: "d2_approach" }),
          opc("espaco", "Atacar o espaço e voltar para o fundo", [-3.0, 9.0], { risco: 0.5, pressao: 1.6, objetivo: "tempo", ideal: IDEAL_ATAQUE,
            texto: "Atacar o espaço vazio é a primeira leitura da bola curta. Voltar para o fundo depois, porém, devolve ao adversário o tempo que o ataque tirou dele.",
            resumo: "Atacar e voltar ao fundo: o tempo tirado volta para ele.",
            resposta: { quique: [2.4, -8.2], contato: [3.0, -10.6], advRecupera: [-1.4, 11.6] }, proxima: "d2_espaco" }),
          opc("curtinha", "Curtinha disfarçada", [-1.6, 2.2], { risco: 0.5, pressao: 1.4, objetivo: "tempo", ideal: { altura: ["media"], intensidade: ["controlada"] },
            texto: "Com o adversário no fundo, a curtinha também é ataque: no método, atacar por variação conta. Ela precisa de preparação idêntica à do drive até o último instante; se ele ler, chega com a bola subindo.",
            resumo: "Curtinha disfarçada: ataque por variação.",
            resposta: { quique: [2.6, -5.4], contato: [2.4, -6.8], advRecupera: [-1.6, 3.6] }, proxima: "d2_curtinha" }),
        ],
      },
      d2_approach: d2Voleio("O adversário correu para o canto e tentou a passada na paralela. Você fez o split na zona de voleio e encontra a bola de forehand, antes do quique.",
        { aberto: [-3.2, 6.4], fundo: [3.2, 10.4], deixada: [-2.0, 1.8] }, "Voleio de forehand",
        { aberto: "Com o adversário no canto da paralela, o voleio cruzado vai para o lado aberto, longe dele. Firme e com direção basta: na rede, a posição já tira o tempo.",
          fundo: "O voleio profundo na mesma linha devolve a bola para perto de onde o adversário está. Mantém você na rede, mas não usa o lado aberto.",
          deixada: "A deixadinha do outro lado funciona com o adversário longe, no fundo. Aqui ele está no canto, então pode dar certo, mas pede mãos muito macias." }),
      d2_espaco: d2Construcao("O adversário chegou ao ataque e devolveu cruzado, fundo, no seu forehand. Você voltou para o fundo e a troca recomeça.", 1, "Forehand, no fundo", "d3", "A vantagem do ataque se perdeu quando você voltou para o fundo."),
      d2_curtinha: d2Passada("O adversário correu, chegou à curtinha e empurrou a bola para o seu forehand, ficando perto da rede.", 1, "Forehand, no meio da quadra", "d3"),
      d3: recFundo(),
      d3_rede: recRede(),
    },
    missao: {
      titulo: "Bola curta é convite",
      texto: "Na bola curta, entre e decida antes de chegar: atacar o espaço, subir com o approach ou variar com a curtinha.",
      passos: [
        "O professor manda bolas curtas misturadas à troca de fundo.",
        "Na curta, entre e finalize à frente: approach na paralela e split na zona de voleio.",
        "Alterne com a curtinha disfarçada, com a mesma preparação do drive.",
        "Exercícios do catálogo MTY: RT004 Bola curta é convite, AT008 Approach paralelo + cobertura e AT007 Curtinha disfarçada.",
      ],
    },
    perguntaMetodo: "Na bola curta, você entrou e decidiu antes de chegar à bola?",
  };

  var gatilho = {
    id: "gatilho", trilha: "ataque", titulo: "Gatilho de subida à rede",
    chamada: "A bola veio lenta e sem profundidade. É o momento de subir?",
    placar: "5–5 · 30–30", sacador: "Troca de fundo", lado: "Gatilho de subida",
    contexto: "Troca de fundo. A bola do adversário veio lenta, sem profundidade, no meio da sua quadra. Você chega a ela de forehand, entre a linha de saque e a linha de base.",
    inicio: { jog: [0.6, -8.8], adv: [-1.2, 12.3], hContato: 0.9, previa: { de: [-1.3, 12.4], quique: [0.4, -6.6] } },
    etapas: {
      d1: {
        tipo: "golpe", numero: 1, contexto: "ataque", tatica: "ataque", golpe: "Forehand, bola lenta",
        situacao: "Bola curta, lenta ou sem profundidade é o gatilho de subida do método. O erro mais comum é subir tarde, depois que a vantagem já passou.",
        pergunta: "É o momento de subir?",
        opcoes: [
          opc("subir", "Approach profundo no backhand dele e subir", [2.8, 10.2], { risco: 0, pressao: 1.5, objetivo: "tempo", ideal: { altura: ["media"], intensidade: ["firme"] },
            texto: "O gatilho apareceu: approach profundo no backhand dele e subida na linha da bola. A decisão vem antes do golpe, não depois.",
            resumo: "Gatilho reconhecido: approach e subida na linha da bola.",
            resposta: { voleio: true, contato: [-0.9, -3.2], jogRecupera: [0.9, -4.0], advRecupera: [1.4, 12.2] }, proxima: "d2_voleio" }),
          opc("fundo", "Atacar forte e voltar para o fundo", [-3.0, 9.6], { risco: 0.5, pressao: 1.6, objetivo: "tempo", ideal: IDEAL_ATAQUE,
            texto: "Atacar a bola curta é certo; voltar para o fundo depois é o que o gatilho pede para evitar: a vantagem criada pelo ataque se perde enquanto você recua.",
            resumo: "Atacar e voltar: a vantagem se perde no recuo.",
            resposta: { quique: [1.4, -8.8], contato: [1.8, -11.4], advRecupera: [-1.0, 12.0] }, proxima: "d2_fundo" }),
          opc("seguir", "Seguir a troca, cruzada neutra", [-2.4, 9.2], { risco: 0, pressao: 0.7, nivel: "iniciativa", contexto: "neutro", objetivo: "margem", ideal: IDEAL_BASE,
            texto: "Seguir a troca numa bola curta e lenta é deixar o gatilho passar: o adversário ganha tempo para se reorganizar e o ponto volta a ser neutro.",
            resumo: "Seguir a troca: o gatilho passa.",
            resposta: { quique: [2.4, -9.0], contato: [2.9, -11.8], advRecupera: [-1.6, 12.2] }, proxima: "d2_seguir" }),
        ],
      },
      d2_voleio: d2Voleio("O adversário tentou a passada cruzada. Você fez o split antes do golpe dele e encontra a bola de backhand, antes do quique.",
        { aberto: [-3.2, 6.6], fundo: [2.8, 10.2], deixada: [2.2, 1.8] }, "Voleio de backhand",
        { aberto: "O adversário está no canto do backhand dele: o voleio de backhand na paralela vai para o lado aberto, do forehand dele.",
          fundo: "Profundo de volta no backhand dele, o voleio mantém você na rede, mas vai para onde ele já está.",
          deixada: "A deixadinha cruzada, curta, vai para longe do adversário no fundo; pede mãos macias e um voleio de backhand estável." }),
      d2_fundo: d2Construcao("O adversário chegou e devolveu fundo, no seu forehand. Você está de volta ao fundo e o ponto recomeça.", 1, "Forehand, no fundo", "d3", "A vantagem do ataque passou."),
      d2_seguir: d2Construcao("O adversário se reorganizou e mandou uma bola funda no seu forehand. A troca voltou a ser neutra.", 1, "Forehand, no fundo", "d3"),
      d3: recFundo(),
      d3_rede: recRede(),
    },
    missao: {
      titulo: "Gatilho de subida à rede",
      texto: "No jogo aberto, reconheça a bola curta, lenta ou sem profundidade e só então decida subir.",
      passos: [
        "Jogue troca livre de fundo com o professor ou um parceiro.",
        "Quando a bola vier curta, lenta ou sem profundidade, suba: approach profundo e split na zona de voleio.",
        "Conte quantas vezes o gatilho apareceu e quantas vezes você subiu.",
        "Exercícios do catálogo MTY: PT006 Gatilho de Subida à Rede, RT012 Corta o tempo na subida e AT003 Ataque + finalização à frente.",
      ],
    },
    perguntaMetodo: "Quantas vezes o gatilho de subida apareceu, e quantas vezes você subiu?",
  };

  var contorno = {
    id: "contorno", trilha: "ataque", titulo: "Contorne e escolha a direção",
    chamada: "Você contornou a bola para jogar de forehand. Inside-out ou inside-in?",
    placar: "4–3 · 40–30", sacador: "Troca de fundo", lado: "Contorno de forehand",
    contexto: "Uma bola central, um pouco para o seu backhand. Você contornou, com o pé de trás recuando em diagonal, e vai jogar de forehand.",
    inicio: { jog: [-1.6, -11.4], adv: [0.8, 12.2], hContato: 0.9, previa: { de: [0.9, 12.3], quique: [-0.8, -8.6] } },
    etapas: {
      d1: {
        tipo: "golpe", numero: 1, contexto: "ataque", tatica: "ataque", golpe: "Forehand invertido",
        situacao: "Contornar deixa o seu lado do forehand aberto: a direção e a recuperação depois do golpe fazem parte da mesma decisão.",
        pergunta: "Para onde, depois de contornar?",
        opcoes: [
          opc("out", "Inside-out no backhand dele", [2.8, 9.6], { risco: 0, pressao: 1.5, objetivo: "quadra", ideal: IDEAL_ATAQUE,
            texto: "O inside-out vai pela diagonal, pela parte baixa da rede, no backhand do adversário. É a direção natural depois de contornar e mantém você no comando da troca.",
            resumo: "Inside-out: diagonal, rede mais baixa, no backhand dele.",
            resposta: { quique: [-1.6, -8.2], contato: [-1.8, -10.6], advRecupera: [1.2, 12.4] }, proxima: "d2_out" }),
          opc("in", "Inside-in na paralela", [-3.3, 10.0], { risco: 0.5, pressao: 1.8, objetivo: "tempo", ideal: { altura: ["media"], intensidade: ["firme"] },
            texto: "O inside-in vai para o lado do forehand dele, pela linha. Pega o adversário que se protege do inside-out, mas cruza a rede mais alta e, se não sair profundo, abre o seu lado do forehand.",
            resumo: "Inside-in: surpreende, mas cruza mais alto e abre o seu forehand.",
            resposta: { quique: [2.8, -8.4], contato: [3.5, -10.9], advRecupera: [-1.6, 11.8] }, proxima: "d2_in" }),
          opc("centro", "Bola alta no centro", [0.3, 9.8], { risco: 0, pressao: 0.6, nivel: "iniciativa", contexto: "neutro", objetivo: "margem", ideal: IDEAL_BASE,
            texto: "Depois de contornar, jogar no centro desperdiça o movimento: você saiu da posição para ter o forehand e não usou nenhuma das duas direções.",
            resumo: "Contornar e jogar no centro: o movimento é desperdiçado.",
            resposta: { quique: [2.2, -8.6], contato: [2.8, -11.2], advRecupera: [0.2, 12.1] }, proxima: "d2_centro" }),
        ],
      },
      d2_out: {
        tipo: "golpe", numero: 2, contexto: "ataque", tatica: "ataque", golpe: "Forehand invertido, de novo",
        situacao: "O adversário respondeu do backhand, cruzado, de volta no seu lado esquerdo. Ele se protege do inside-out, um pouco para o lado do backhand dele.",
        pergunta: "Inside-out de novo, ou mudar?",
        opcoes: [
          opc("in", "Agora o inside-in", [-3.2, 9.8], { risco: 0, pressao: 1.8, objetivo: "tempo", ideal: { altura: ["media"], intensidade: ["firme", "maxima"] },
            texto: "O adversário está protegendo o inside-out: o lado do forehand dele ficou aberto. Agora o inside-in, com margem, vai para onde ele não está.", resumo: "Inside-in quando ele protege o inside-out." }),
          opc("out", "Inside-out mais uma vez", [2.8, 9.6], { risco: 0.5, pressao: 1.3, nivel: "inicio", objetivo: "quadra", ideal: IDEAL_ATAQUE,
            texto: "Mais um inside-out mantém a troca no backhand dele, mas vai para onde ele já se protege.", resumo: "Mais um inside-out: ele já se protege." }),
          opc("angulo", "Inside-out curto, angulado", [3.4, 5.4], { risco: 1, pressao: 1.4, objetivo: "angulo", ideal: { altura: ["media"], intensidade: ["controlada", "firme"] },
            texto: "O inside-out angulado tira o adversário pela lateral do backhand, mas é uma bola mais lenta, e ele está do lado certo para chegar.", resumo: "Inside-out angulado: ele está do lado certo." }),
        ].map(function (o) { o.proxima = "d3"; return o; }),
      },
      d2_in: d2Defesa("O adversário chegou ao inside-in e respondeu cruzado, no canto do seu forehand, que o contorno deixou aberto. Você corre para fora.", 1, "Forehand, correndo", "d3"),
      d2_centro: d2Defesa("O adversário aproveitou a bola central e jogou no canto do seu forehand, aberto pelo contorno. Você corre.", 1, "Forehand, correndo", "d3"),
      d3: recFundo(),
    },
    missao: {
      titulo: "Contorno de forehand",
      texto: "A partir de uma bola central, contorne e escolha entre inside-out e inside-in; depois, recupere.",
      passos: [
        "O professor manda bolas centrais, um pouco para o seu backhand.",
        "Contorne recuando o pé de trás em diagonal e escolha a direção antes de bater.",
        "Logo depois do golpe, recupere para cobrir o lado do forehand.",
        "Exercício do catálogo MTY: AT010 Contorno de forehand e DT009 FH Inside Out e Inside In - Decisão.",
      ],
    },
    perguntaMetodo: "Depois de contornar, você recuperou a tempo de cobrir o lado do forehand?",
  };

  /* ════ DEFESA E CONTRA-ATAQUE ════ */
  var duas = {
    id: "duasdefesas", trilha: "defesa", titulo: "As duas defesas",
    chamada: "Correndo para fora da quadra: bola alta ou cruzada acelerada?",
    placar: "3–3 · 30–30", sacador: "Troca de fundo", lado: "Defesa em corrida",
    contexto: "O adversário atacou do meio da quadra para o seu forehand. Você corre para fora e chega à bola em movimento, atrás da linha.",
    inicio: { jog: [5.2, -11.4], adv: [-1.4, 9.6], hContato: 0.8, previa: { de: [-1.6, 9.6], quique: [3.8, -8.0] } },
    etapas: {
      d1: {
        tipo: "golpe", numero: 1, contexto: "defesa", tatica: "defesa", golpe: "Forehand, correndo",
        situacao: "O método tem duas defesas que coexistem: a bola alta, para ganhar tempo, e a cruzada acelerada. As duas são válidas; a questão é escolher uma com intenção.",
        pergunta: "Qual defesa?",
        opcoes: [
          opc("alta", "Bola alta e profunda", [-0.8, 10.4], { risco: 0, pressao: 0.7, objetivo: "ganhar_tempo", ideal: ALTA,
            texto: "A primeira defesa: alta e profunda, a bola fica tempo no ar para você voltar para a quadra, e o adversário, que estava dentro, é empurrado para trás.",
            resumo: "Defesa alta: tempo para voltar e o adversário empurrado para trás.",
            resposta: { quique: [1.2, -8.8], contato: [1.6, -11.4], advRecupera: [-0.6, 12.6] }, proxima: "d2_alta" }),
          opc("acelerada", "Cruzada acelerada", [-2.8, 8.6], { risco: 0, pressao: 1.3, objetivo: "tempo", ideal: ACELERADA,
            texto: "A segunda defesa: em vez de levantar, acelerar a cruzada na corrida. Com o adversário dentro da quadra, a bola rápida pela diagonal tira o tempo dele, desde que o apoio estabilize o contato.",
            resumo: "Defesa acelerada: tirar o tempo de quem estava atacando.",
            resposta: { quique: [0.8, -7.6], contato: [1.0, -10.0], advRecupera: [-2.0, 11.4] }, proxima: "d2_acelerada" }),
          opc("paralela", "Paralela de risco", [3.4, 10.4], { risco: 1.5, pressao: 1.4, objetivo: "tempo", ideal: { altura: ["media"], intensidade: ["firme"] },
            texto: "A paralela na corrida, de fora da quadra, cruza a parte alta da rede e pede uma bola perfeita. Se o adversário chegar, a diagonal inteira fica aberta para a resposta.",
            resumo: "Paralela de fora da quadra: bola perfeita ou quadra aberta.",
            resposta: { quique: [-2.6, -7.8], contato: [-3.4, -10.4], advRecupera: [0.8, 11.6] }, proxima: "d2_paralela" }),
        ],
      },
      d2_alta: d2Construcao("A bola alta funcionou: o adversário voltou para trás da linha e respondeu neutro, no centro. Você voltou para a quadra.", 1, "Forehand, equilibrado", "d3", "A defesa alta devolveu a troca à situação neutra."),
      d2_acelerada: {
        tipo: "golpe", numero: 2, contexto: "ataque", tatica: "contra", golpe: "Forehand, bola fraca",
        situacao: "A cruzada acelerada pegou o adversário esticado no forehand dele. A resposta veio fraca, no meio da sua quadra, e ele ainda volta do canto.",
        pergunta: "Como contra-atacar?",
        opcoes: [
          opc("aberto", "Atacar o lado aberto", [2.9, 9.2], { risco: 0, pressao: 1.8, objetivo: "quadra", ideal: IDEAL_ATAQUE,
            texto: "A defesa acelerada virou o ponto: o adversário está no canto do forehand e o backhand dele está aberto. Atacar esse lado com margem completa o contra-ataque.", resumo: "Contra-ataque no lado aberto." }),
          opc("repetir", "Repetir a cruzada", [-2.6, 9.2], { risco: 0.5, pressao: 1.2, nivel: "inicio", contexto: "neutro", objetivo: "quadra", ideal: IDEAL_BASE,
            texto: "Repetir a cruzada leva a bola para onde o adversário está voltando.", resumo: "Repetir: vai para onde ele volta." }),
          opc("curtinha", "Curtinha no lado aberto", [1.8, 2.4], { risco: 1, pressao: 1.5, objetivo: "tempo", ideal: { altura: ["media"], intensidade: ["controlada"] },
            texto: "Com o adversário no fundo e no canto, a curtinha do outro lado é ataque por variação, mas a bola fraca no meio pede uma curtinha muito bem disfarçada.", resumo: "Curtinha: variação, com disfarce." }),
        ].map(function (o) { o.proxima = "d3"; return o; }),
      },
      d2_paralela: d2Defesa("O adversário chegou à paralela e respondeu cruzado, no seu backhand. Você atravessou a quadra correndo.", -1, "Backhand, correndo", "d3"),
      d3: recFundo(),
    },
    missao: {
      titulo: "As duas defesas",
      texto: "Alterne a defesa alta e a defesa acelerada, por chamada do professor durante o ponto.",
      passos: [
        "O professor ataca para os cantos e chama, durante o seu deslocamento: alta ou acelerada.",
        "Na alta, procure os últimos dois metros da quadra; na acelerada, a diagonal pela parte baixa da rede.",
        "Avalie a capacidade de fazer a defesa pedida, não a qualidade fina de cada uma.",
        "Exercícios do catálogo MTY: RT009 As duas defesas e RT008 Defesa acelerada.",
      ],
    },
    perguntaMetodo: "Você escolheu a defesa (alta ou acelerada), ou só devolveu a bola?",
  };

  var saida = {
    id: "saida", trilha: "defesa", titulo: "Da defesa profunda ao ataque",
    chamada: "Bem atrás da linha de base. Como sair da defesa em poucas bolas?",
    placar: "1–2 · 0–15", sacador: "Troca de fundo", lado: "Defesa profunda",
    contexto: "O adversário empurrou você para bem atrás da linha de base, no backhand, com uma bola funda e alta.",
    inicio: { jog: [-2.2, -14.4], adv: [0.6, 11.4], hContato: 1.2, previa: { de: [0.7, 11.6], quique: [-1.8, -10.2] } },
    etapas: {
      d1: {
        tipo: "golpe", numero: 1, contexto: "defesa", tatica: "defesa", golpe: "Backhand, bem atrás da linha",
        situacao: "Você está longe da linha de base e o adversário, um passo dentro da quadra. Sair da defesa começa por recuperar a quadra.",
        pergunta: "Como sair da defesa?",
        opcoes: [
          opc("alta", "Alta e profunda no centro", [0.4, 10.6], { risco: 0, pressao: 0.7, objetivo: "ganhar_tempo", ideal: ALTA,
            texto: "Do fundo, a bola alta e profunda no centro ganha tempo para você voltar à linha de base e não dá ângulo ao adversário. É o primeiro passo da saída: recuperar a quadra.",
            resumo: "Alta no centro: recuperar a quadra sem dar ângulo.",
            resposta: { quique: [-0.9, -8.0], contato: [-1.1, -10.4], advRecupera: [0.3, 12.6] }, proxima: "d2_alta" }),
          opc("acelerada", "Cruzada acelerada", [2.8, 8.8], { risco: 0, pressao: 1.2, objetivo: "tempo", ideal: ACELERADA,
            texto: "Acelerar a cruzada mesmo de trás é a outra defesa do método. Bem atrás da linha, porém, a bola viaja mais e o adversário tem um pouco mais de tempo: o apoio precisa ser firme.",
            resumo: "Acelerada de trás: válida, com apoio firme.",
            resposta: { quique: [-1.4, -7.4], contato: [-1.6, -9.8], advRecupera: [2.2, 12.2] }, proxima: "d2_acelerada" }),
          opc("curta", "Curtinha de trás", [-1.4, 2.4], { risco: 2, pressao: 0.3, objetivo: "tempo", ideal: { altura: ["media"], intensidade: ["controlada"] },
            texto: "De tão longe, a curtinha viaja demais e o adversário, que está dentro da quadra, chega com folga.",
            resumo: "Curtinha de longe: o adversário chega com folga.",
            resposta: { quique: [2.8, -6.0], contato: [3.0, -8.6], advRecupera: [-1.0, 3.8] }, proxima: "d2_curta" }),
        ],
      },
      d2_alta: {
        tipo: "golpe", numero: 2, contexto: "ataque", tatica: "construcao", golpe: "Backhand, de volta à linha",
        situacao: "Você voltou para a linha de base e a resposta veio mais curta, no seu backhand. O adversário está no centro, atrás da linha.",
        pergunta: "Hora de passar ao ataque?",
        opcoes: [
          opc("canto", "Profunda no canto do backhand dele", [2.7, 9.8], { risco: 0, pressao: 1.4, objetivo: "quadra", ideal: { altura: ["media"], intensidade: ["firme"] },
            texto: "Com a bola mais curta, a transição começa ganhando a quadra: profunda no canto do backhand dele, a bola o tira do centro.", resumo: "Transição: ganhar a quadra no canto do backhand." }),
          opc("angulo", "Ângulo curto", [-3.4, 5.4], { risco: 1, pressao: 1.3, objetivo: "angulo", ideal: { altura: ["media"], intensidade: ["controlada", "firme"] },
            texto: "O ângulo curto antes de ganhar a quadra pede uma bola lenta, com o adversário ainda no centro.", resumo: "Ângulo antes de ganhar a quadra." }),
          opc("alta", "Mais uma alta no centro", [0.3, 10.2], { risco: 0, pressao: 0.6, nivel: "iniciativa", contexto: "defesa", objetivo: "ganhar_tempo", ideal: ALTA,
            texto: "Mais uma defesa alta numa bola que já permite atacar: a saída da defesa fica para depois e o adversário continua no comando.", resumo: "Defender de novo: a saída fica para depois." }),
        ].map(function (o) { o.proxima = "d3"; return o; }),
      },
      d2_acelerada: {
        tipo: "golpe", numero: 2, contexto: "ataque", tatica: "contra", golpe: "Backhand, bola mais curta",
        situacao: "A cruzada acelerada empurrou o adversário para o canto do backhand dele. A resposta veio mais curta, no seu backhand.",
        pergunta: "Hora de passar ao ataque?",
        opcoes: [
          opc("aberto", "Atacar o lado aberto", [-3.0, 9.4], { risco: 0, pressao: 1.8, objetivo: "quadra", ideal: IDEAL_ATAQUE,
            texto: "O adversário está no canto do backhand dele: a paralela de backhand, com margem, ataca o lado aberto e completa a transição.", resumo: "Transição completa: lado aberto." }),
          opc("contrape", "Contrapé, no backhand dele", [2.6, 9.6], { risco: 0.5, pressao: 1.3, objetivo: "tempo", ideal: { altura: ["media"], intensidade: ["firme"] },
            texto: "O contrapé funciona se ele sair correndo cedo para o outro lado. Aqui, ele ainda está no canto e a bola vai na direção dele.", resumo: "Contrapé: ele ainda está no canto." }),
          opc("centro", "Bola no centro", [0.2, 9.4], { risco: 0, pressao: 0.6, nivel: "iniciativa", contexto: "neutro", objetivo: "margem", ideal: IDEAL_BASE,
            texto: "A bola no centro devolve ao adversário o tempo que a defesa acelerada tinha tirado dele.", resumo: "No centro: devolve o tempo." }),
        ].map(function (o) { o.proxima = "d3"; return o; }),
      },
      d2_curta: d2Passada("O adversário chegou à curtinha com folga e empurrou a bola para o seu forehand, ficando perto da rede.", 1, "Forehand, correndo para a frente", "d3"),
      d3: recAtaque(),
    },
    missao: {
      titulo: "Da defesa profunda à transição",
      texto: "Saia da posição defensiva para o ataque numa sequência de três bolas.",
      passos: [
        "O professor manda bolas fundas e altas, você começa bem atrás da linha.",
        "Primeira bola: alta e profunda no centro, ou cruzada acelerada.",
        "Segunda bola: de volta à linha, ganhe a quadra; terceira: ataque o lado aberto.",
        "Exercícios do catálogo MTY: DT021 Defesa Profunda mais Transição Ataque e ADV017 Saída de Posição Defensiva Extrema.",
      ],
    },
    perguntaMetodo: "Em quantas bolas você saiu da defesa para o ataque?",
  };

  var contra = {
    id: "contra", trilha: "defesa", titulo: "Contra-ataque: passada ou lobby",
    chamada: "O adversário subiu à rede na paralela. Lobby, passada cruzada ou paralela?",
    placar: "5–4 · 30–30", sacador: "Troca de fundo", lado: "Adversário na rede",
    contexto: "O adversário fez um approach na paralela, no seu backhand, e subiu à rede. Você chega à bola equilibrado, um pouco atrás da linha.",
    inicio: { jog: [-3.6, -11.0], adv: [-1.4, 4.2], hContato: 0.9, previa: { de: [-3.2, 8.2], quique: [-2.8, -7.6] } },
    etapas: {
      d1: {
        tipo: "golpe", numero: 1, contexto: "passada", tatica: "contra", golpe: "Backhand, equilibrado",
        situacao: "O adversário está perto da rede, fechado na paralela, que é a rota provável. Antes de passar, olhe onde ele fechou.",
        pergunta: "Como passar?",
        opcoes: [
          opc("lobby", "Lobby por cima do backhand dele", [2.0, 10.0], { risco: 0.3, pressao: 1.3, objetivo: "quadra", ideal: { altura: ["alta"], intensidade: ["controlada", "firme"] },
            texto: "Ele está perto da rede e fechado na paralela. O lobby por cima do lado do backhand dele obriga a correr para trás e devolve a você a posição na quadra.",
            resumo: "Lobby por cima do backhand: ele corre para trás.",
            resposta: { quique: [0.4, -8.8], contato: [0.6, -11.0], advRecupera: [0.8, 12.0] }, proxima: "d2_lobby" }),
          opc("cruzada", "Passada cruzada angulada", [3.2, 5.0], { risco: 0.5, pressao: 1.6, objetivo: "angulo", ideal: { altura: ["baixa", "media"], intensidade: ["firme"] },
            texto: "A passada cruzada, baixa e angulada, vai para longe do voleio dele, que está fechado na paralela. Pede bola baixa sobre a rede: alta, vira voleio fácil.",
            resumo: "Passada cruzada angulada: longe do voleio.",
            resposta: { quique: [-1.4, -6.8], contato: [-1.6, -9.0], advRecupera: [0.6, 3.6] }, proxima: "d2_cruzada" }),
          opc("paralela", "Passada na paralela", [-3.6, 8.8], { risco: 1.5, pressao: 1.5, objetivo: "tempo", ideal: { altura: ["baixa", "media"], intensidade: ["firme", "maxima"] },
            texto: "Ele subiu exatamente para cobrir a paralela. A passada nessa direção precisa ser muito rápida e precisa, junto da linha, contra quem já está esperando por ela.",
            resumo: "Passada na paralela: contra quem já espera por ela.",
            resposta: { quique: [2.4, -6.4], contato: [2.9, -8.6], advRecupera: [-0.6, 3.4] }, proxima: "d2_paralela" }),
        ],
      },
      d2_lobby: d2Construcao("O adversário correu para trás e devolveu do fundo, uma bola alta no meio da sua quadra. Os dois estão no fundo de novo.", 1, "Forehand, no fundo", "d3", "O lobby tirou o adversário da rede e o ponto voltou a ser de fundo."),
      d2_cruzada: d2Passada("O adversário voleou a passada cruzada para o seu backhand e continua perto da rede, agora mais no centro.", -1, "Backhand, segunda passada", "d3"),
      d2_paralela: d2Passada("O adversário voleou a passada na paralela para o seu forehand e continua perto da rede.", 1, "Forehand, segunda passada", "d3"),
      d3: recFundo(),
    },
    missao: {
      titulo: "Passada e lobby tático",
      texto: "Contra quem sobe à rede, olhe onde ele fechou antes de escolher entre lobby, passada cruzada e paralela.",
      passos: [
        "O professor faz approach e sobe; você escolhe a passada depois de olhar para ele.",
        "Se ele fechar a paralela, use a cruzada baixa ou o lobby por cima do backhand.",
        "Depois do lobby, recupere a posição de fundo; depois da passada, prepare a segunda.",
        "Exercícios do catálogo MTY: DT025 Lob Tático mais Posicionamento na Rede e PDR (voleios depois do approach), para treinar o outro lado.",
      ],
    },
    perguntaMetodo: "Antes de passar, você olhou onde o adversário fechou a rede?",
  };

  [vantagem, segundo, devolucao, troca, pop, empurra, convite, gatilho, contorno, duas, saida, contra].forEach(function (c) { K.CENARIOS.push(c); });
  K.CENARIOS.forEach(function (c, i) { c.numero = i + 1; });
  /* construtores reaproveitados pelos arquivos seguintes (cenarios-mais2.js, cenarios-mais3.js) */
  K.CONSTRUTORES = { recFundo: recFundo, recAtaque: recAtaque, recRede: recRede, d2Construcao: d2Construcao, d2Defesa: d2Defesa, d2Passada: d2Passada,
    d2Voleio: d2Voleio, d2PrimeiraBola: d2PrimeiraBola, opc: opc, fecho: fecho, IDEAL_ATAQUE: IDEAL_ATAQUE, IDEAL_BASE: IDEAL_BASE, ALTA: ALTA, ACELERADA: ACELERADA };
  K.TRILHAS = [
    { id: "inicio", titulo: "Início do ponto", texto: "Saque, devolução e as primeiras bolas: onde a maior parte dos pontos se decide." },
    { id: "construcao", titulo: "Construção", texto: "Ganhar a quadra, produzir ângulo e escolher a bola certa para mudar de direção." },
    { id: "ataque", titulo: "Ataque e transição", texto: "Bola curta, gatilho de subida, approach e voleio." },
    { id: "defesa", titulo: "Defesa e contra-ataque", texto: "As duas defesas do método e a saída para o ataque." },
    { id: "placar", titulo: "Pontos importantes", texto: "Break point, set point e ponto longo: a decisão fechada antes, sem reabrir por medo." },
  ];
  return K;
});
