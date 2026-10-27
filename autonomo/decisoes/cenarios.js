/* QuadraLab Player · Simulador de Decisões — CONTEÚDO dos cenários (sem lógica).

   Para criar um cenário novo, copie um dos objetos de CENARIOS e ajuste. As regras de funcionamento estão em motor.js.

   Coordenadas em metros, quadra de simples vista de cima: x de -4,115 (lateral esquerda) a 4,115 (lateral direita);
   y de -11,885 (sua linha de base, embaixo) a 11,885 (linha de base do adversário, em cima). Rede em y = 0, linhas de
   saque em ±6,40. Jogadores destros: o forehand de quem está embaixo fica em x > 0; o de quem está em cima, em x < 0.

   Cada etapa é uma decisão:
   · tipo "golpe": opções com alvo (onde a bola quica), risco de base (0 a 2, para este contexto), pressão de base
     (0 a 2: quanto tira de tempo do adversário), faixas ideais de altura e intensidade, texto e resumo. "resposta" é
     uma continuação possível (onde a bola do adversário quica, onde você a encontra e para onde ele volta) e leva à
     etapa "proxima". Se a próxima for uma recuperação, a animação para com a bola no ar.
   · tipo "recuperacao": opções de posição ("bissetriz" a uma profundidade y, "ficar" onde bateu, "recuar"),
     com texto e rótulo conforme a pressão que a sua bola anterior colocou no adversário (baixa, media, alta).

   Rótulos de avaliação: "coerente", "inicio" e "controle" (textos em ROTULOS). Nada aqui afirma que uma jogada ganha
   ou perde o ponto: as respostas do adversário são possibilidades ilustrativas.
   Textos escritos para revisão de Richard Tsukada antes do uso com alunos. */
(function (raiz, fab) {
  if (typeof module === "object" && module.exports) module.exports = fab();
  else raiz.QLD_CONTEUDO = fab();
})(typeof self !== "undefined" ? self : this, function () {
  var ROTULOS = {
    coerente: "Coerente com este contexto.",
    inicio: "Uma intenção possível para começar.",
    controle: "Uma escolha que exige mais controle.",
    iniciativa: "Uma escolha que devolve a iniciativa ao adversário.",
  };
  /* Metodologia MTY: os três objetivos do jogo (nesta ordem) e as duas formas de defesa */
  var OBJETIVOS = {
    quadra: "Ganhar a quadra", angulo: "Produzir ângulo", tempo: "Diminuir o tempo do adversário",
    ganhar_tempo: "Ganhar tempo para se reorganizar", margem: "Construir com margem",
  };
  var TATICAS = { inicio: "Início do ponto", neutra: "Neutra", construcao: "Construção", ataque: "Ataque", contra: "Contra-ataque", defesa: "Defesa" };
  /* as duas defesas do método valem igualmente: bola alta para ganhar tempo, ou cruzada acelerada */
  var DUAS_DEFESAS = [{ altura: ["media", "alta"], intensidade: ["controlada", "firme"] }, { altura: ["baixa", "media"], intensidade: ["firme", "maxima"] }];
  var AVISO = "Simulação didática. Trajetórias, tempos e respostas são ilustrativos.";
  var PERGUNTA = "Minha escolha me deixou preparado para a bola seguinte?";

  /* frases sobre altura e intensidade, conforme o tipo de situação do golpe */
  var NOTAS = {
    altura: {
      defesa: {
        baixa: "Passar baixo sobre a rede a partir de um contato difícil reduz a margem: a bola precisa sair muito bem tocada.",
        media: "Altura média sobre a rede equilibra margem e profundidade.",
        alta: "Mais altura sobre a rede dá margem e tempo para você voltar; se a bola for profunda, ela também empurra o adversário para trás.",
      },
      neutro: {
        baixa: "Baixa sobre a rede, a bola tende a ficar mais curta e com menos margem, sem tirar muito tempo do adversário.",
        media: "Altura média mantém a troca com margem e profundidade.",
        alta: "Alta e profunda, a bola empurra o adversário para trás e dá tempo para você se organizar.",
      },
      ataque: {
        baixa: "Baixa e firme encurta o tempo do adversário, mas pede um contato limpo: a rede fica mais perto do erro.",
        media: "Altura média mantém margem sobre a rede sem dar muito tempo ao adversário.",
        alta: "Uma bola alta no ataque dá margem, mas também dá tempo para o adversário se reposicionar.",
      },
      saque: {
        baixa: "Um saque mais rente à rede tende a ser mais reto e rápido; a margem fica pequena.",
        media: "Altura média sobre a rede é a base mais estável para escolher a direção.",
        alta: "Mais altura sobre a rede costuma vir com mais efeito: margem maior, bola mais lenta e quique mais alto.",
      },
      rede: {
        baixa: "Baixo e para a frente, o voleio chega rápido e obriga o adversário a jogar de baixo para cima.",
        media: "Altura média dá margem ao voleio sem deixar a bola subir demais para o adversário.",
        alta: "Um voleio alto e lento dá ao adversário tempo e altura para a passada ou o lobby.",
      },
      passada: {
        baixa: "Baixa sobre a rede, a bola obriga o adversário perto da rede a volear de baixo para cima.",
        media: "Altura média numa passada facilita o voleio de quem está na rede.",
        alta: "Alta sobre a rede, a bola vira um lobby: precisa passar acima do alcance dele e ainda cair dentro.",
      },
    },
    intensidade: {
      defesa: {
        controlada: "Controlada, a bola ganha tempo pela altura e pela profundidade, não pela velocidade.",
        firme: "Firme, a bola já começa a tirar tempo do adversário, se o apoio estabiliza o corpo no contato.",
        maxima: "Acelerar é uma das duas defesas do método (a outra é a bola alta): tira tempo do adversário mesmo de uma posição difícil, desde que o apoio estabilize o contato. Sem esse apoio, a margem diminui.",
      },
      neutro: {
        controlada: "Controlada, a bola mantém a troca e dá tempo para os dois.",
        firme: "Firme, a bola mantém o adversário atrás sem exigir um contato perfeito.",
        maxima: "Máxima numa bola de construção aumenta o risco sem mudar muito a situação.",
      },
      ataque: {
        controlada: "Controlada mantém a margem; a pressão vem mais da direção do que da velocidade.",
        firme: "Firme combina pressão e controle numa bola confortável.",
        maxima: "Máxima encurta o tempo do adversário e também o seu: um desvio pequeno já vira erro.",
      },
      saque: {
        controlada: "Controlado, o saque entra com mais facilidade, mas a devolução chega com menos pressão.",
        firme: "Firme combina ritmo e direção.",
        maxima: "Máximo pode render uma devolução fraca; em 30–30, porém, uma falta coloca o ponto no segundo saque.",
      },
      rede: {
        controlada: "Controlado, o voleio ganha precisão; a pressão vem da direção e da posição na rede.",
        firme: "Firme, o voleio tira tempo do adversário sem perder o controle da raquete.",
        maxima: "No voleio, força máxima raramente é necessária: perto da rede, a posição já tira o tempo do adversário.",
      },
      passada: {
        controlada: "Controlada facilita a precisão, mas dá tempo ao voleio.",
        firme: "Firme combina precisão e tempo curto para o voleio.",
        maxima: "Máxima a partir de uma corrida pede um equilíbrio que nem sempre existe.",
      },
    },
  };

  /* ── CENÁRIO 1 ── */
  var c1 = {
    id: "neutralize", numero: 1, titulo: "Neutralize e reconstrua",
    chamada: "Um saque aberto tira você da quadra. Como devolver e voltar para o ponto?",
    placar: "4–4 · 15–15", sacador: "Adversário sacando", lado: "Lado da igualdade",
    contexto: "O adversário sacou aberto no lado da igualdade. O saque tirou você da quadra: você toca de forehand, esticado, atrás da linha de base e além da lateral.",
    inicio: { jog: [5.0, -12.5], adv: [-0.6, 11.4], hContato: 0.6, previa: { de: [-0.9, 12.2], quique: [3.7, -5.6] } },
    etapas: {
      d1: {
        tipo: "golpe", numero: 1, contexto: "defesa", golpe: "Devolução de forehand, esticado",
        situacao: "Você chega atrasado e esticado, com o contato mais baixo do que gostaria. O adversário deu um passo para dentro depois do saque e está perto do centro. Há muita quadra aberta do seu lado.",
        pergunta: "Para onde devolver?",
        opcoes: [
          { id: "cruzado", rotulo: "Devolver cruzado com margem", alvo: [-2.3, 8.6], risco: 0, pressao: 0.6, ideal: DUAS_DEFESAS, objetivo: "ganhar_tempo",
            texto: "A diagonal é a direção mais longa da quadra e passa pela parte mais baixa da rede. A partir de um contato esticado, ela oferece mais margem. Alta e profunda, dá tempo para você voltar; acelerada, tira tempo do adversário. As duas são defesas válidas.",
            resumo: "Cruzado com margem: mais quadra, rede mais baixa e tempo para recuperar.",
            resposta: { quique: [2.4, -8.6], contato: [3.2, -11.7], advRecupera: [-0.7, 12.3] }, proxima: "d2_cruzado" },
          { id: "paralela", rotulo: "Buscar a paralela próxima da linha", alvo: [3.5, 10.4], risco: 1, pressao: 1.2, ideal: { altura: ["media"], intensidade: ["controlada", "firme"] },
            texto: "A paralela é mais curta e cruza a rede na parte mais alta. Mirando perto da linha, sobra pouca margem para um contato esticado e atrasado. Se a bola não for muito boa, o adversário tem a diagonal aberta para responder enquanto você ainda está fora da quadra.",
            resumo: "Paralela perto da linha: pouca margem e a diagonal aberta para a resposta.",
            resposta: { quique: [-2.8, -7.8], contato: [-3.7, -10.7], advRecupera: [0.9, 12.3] }, proxima: "d2_paralela" },
          { id: "curta", rotulo: "Tentar uma curta", alvo: [-1.6, 2.4], risco: 2, pressao: 0.4, ideal: { altura: ["media"], intensidade: ["controlada"] },
            texto: "De trás da linha de base, a curta viaja muito até a rede, e o adversário, que já está perto do centro, tende a chegar. O toque também é difícil com o corpo esticado. Se ele chegar com tempo, você fica longe da rede e com a quadra aberta.",
            resumo: "Curta de trás da linha: bola longa no ar e difícil de tocar em desequilíbrio.",
            resposta: { quique: [-2.6, -5.6], contato: [-3.3, -8.4], advRecupera: [-0.8, 3.4] }, proxima: "d2_curta" },
        ],
      },
      d2_cruzado: {
        tipo: "golpe", numero: 2, contexto: "neutro", golpe: "Forehand, equilibrado",
        situacao: "A troca seguiu cruzada. O adversário respondeu da diagonal e a bola voltou para o seu forehand, um pouco mais curta. Você chegou com tempo e mais equilibrado do que na devolução.",
        pergunta: "Qual a próxima bola?",
        opcoes: [
          { id: "altura", rotulo: "Dar altura e margem", alvo: [-2.2, 9.6], risco: 0, pressao: 0.9, ideal: { altura: ["media", "alta"], intensidade: ["controlada", "firme"] },
            texto: "Com o corpo mais organizado, uma bola alta e profunda na diagonal mantém a troca neutra e empurra o adversário para trás. Você ganha a quadra que tinha perdido e volta ao centro pronto para construir a próxima bola com intenção.",
            resumo: "Altura e margem na diagonal: troca neutra e tempo para se reorganizar.", proxima: "d3" },
          { id: "paralela", rotulo: "Acelerar a paralela", alvo: [3.5, 10.2], risco: 1, pressao: 1.6, contexto: "ataque", ideal: { altura: ["media"], intensidade: ["firme"] },
            texto: "A bola chegou mais confortável, então mudar de direção passa a ser uma possibilidade. A paralela ainda cruza a parte alta da rede e encurta o tempo do adversário, mas abre a diagonal para ele se não for profunda.",
            resumo: "Paralela acelerada: mais pressão, menos margem e a diagonal aberta se a bola ficar curta.", proxima: "d3" },
          { id: "angulo", rotulo: "Buscar um ângulo curto", alvo: [-3.4, 4.8], risco: 1, pressao: 1.2, contexto: "ataque", ideal: { altura: ["media"], intensidade: ["controlada", "firme"] },
            texto: "O ângulo curto tira o adversário da quadra, mas pede uma bola mais lenta e com efeito, que caia antes da linha de saque. Como você ainda está perto do fundo, a bola fica mais tempo no ar e o adversário pode chegar.",
            resumo: "Ângulo curto do fundo: abre a quadra, mas a bola demora e pede toque.", proxima: "d3" },
        ],
      },
      d2_paralela: {
        tipo: "golpe", numero: 2, contexto: "defesa", golpe: "Backhand, correndo",
        situacao: "O adversário chegou à paralela e respondeu cruzado, para o lado que estava aberto. Você atravessou a quadra correndo e chega à bola de backhand, ainda em movimento.",
        pergunta: "Qual a próxima bola?",
        opcoes: [
          { id: "altura", rotulo: "Dar altura e margem", alvo: [2.4, 9.4], risco: 0, pressao: 0.6, ideal: { altura: ["media", "alta"], intensidade: ["controlada", "firme"] },
            texto: "Correndo e de backhand, a prioridade é recuperar a posição. Uma bola alta e cruzada passa pela parte baixa da rede e dá tempo para você voltar ao centro. É uma forma de sair da pressão sem tentar resolver o ponto nesta bola.",
            resumo: "Altura e margem em corrida: sair da pressão e voltar ao centro.", proxima: "d3" },
          { id: "paralela", rotulo: "Acelerar a paralela", alvo: [-3.5, 10.2], risco: 2, pressao: 1.5, ideal: { altura: ["media"], intensidade: ["firme"] },
            texto: "Acelerar a paralela em plena corrida pede muito ao mesmo tempo: contato bom, equilíbrio e precisão perto da linha. Se a bola não for profunda, a quadra fica aberta de novo para a resposta cruzada.",
            resumo: "Paralela em corrida: muita exigência de uma vez só.", proxima: "d3" },
          { id: "angulo", rotulo: "Buscar um ângulo curto", alvo: [3.4, 5.0], risco: 2, pressao: 1.0, ideal: { altura: ["media"], intensidade: ["controlada"] },
            texto: "Um ângulo curto em corrida exige controle fino da bola. Se ficar curto e alto, o adversário entra na quadra com tempo para escolher.",
            resumo: "Ângulo curto em corrida: controle fino, com risco de a bola ficar no meio do caminho.", proxima: "d3" },
        ],
      },
      d2_curta: {
        tipo: "golpe", numero: 2, contexto: "passada", golpe: "Backhand baixo, correndo para a frente",
        situacao: "O adversário correu, chegou à curta e empurrou a bola para o seu backhand, ficando perto da rede. Você corre para a frente e para o lado, e encontra a bola abaixo da altura da rede.",
        pergunta: "Como passar pelo adversário na rede?",
        opcoes: [
          { id: "altura", rotulo: "Dar altura e margem", alvo: [0.6, 10.2], risco: 0.5, pressao: 1.2, ideal: { altura: ["alta"], intensidade: ["controlada", "firme"] },
            texto: "Com o adversário perto da rede e a bola baixa, dar altura vira um lobby: a bola passa acima do alcance dele e o obriga a correr para trás. Ela precisa ser alta o suficiente para não virar um smash.",
            resumo: "Lobby: tira o adversário da rede, se passar acima do alcance dele.", proxima: "d3" },
          { id: "paralela", rotulo: "Acelerar a paralela", alvo: [-3.6, 9.2], risco: 1.5, pressao: 1.6, ideal: { altura: ["baixa", "media"], intensidade: ["firme"] },
            texto: "A passada paralela é o caminho mais curto pelo lado do adversário. Com a bola abaixo da rede, ela precisa subir e descer rápido: é uma escolha que depende de muito controle.",
            resumo: "Passada paralela de uma bola baixa: caminho curto, mas muito controle.", proxima: "d3" },
          { id: "angulo", rotulo: "Buscar um ângulo curto", alvo: [3.2, 3.6], risco: 1.5, pressao: 1.4, ideal: { altura: ["baixa", "media"], intensidade: ["controlada", "firme"] },
            texto: "Um ângulo curto cruzado tira a bola do alcance do voleio, mas a bola baixa obriga a levantar e a fazer cair rápido. Pede toque e equilíbrio enquanto você ainda corre.",
            resumo: "Ângulo cruzado: longe do voleio, mas pede toque em corrida.", proxima: "d3" },
        ],
      },
      d3: {
        tipo: "recuperacao", numero: 3,
        situacao: "Sua bola ainda está no ar e o adversário se desloca para ela. Antes que ele bata, você escolhe para onde ir.",
        pergunta: "Para onde você se recupera?",
        opcoes: [
          { id: "cobrir", rotulo: "Cobrir a resposta provável", posicao: { modo: "bissetriz", y: -12.0 },
            rotulos: { baixa: "coerente", media: "coerente", alta: "coerente" },
            textos: {
              baixa: "Voltar para o ponto que divide os ângulos possíveis do adversário deixa você a distâncias parecidas das respostas mais prováveis. Como ele recebe a bola com tempo, essa posição faz ainda mais diferença.",
              media: "Voltar para o ponto que divide os ângulos possíveis do adversário deixa você a distâncias parecidas das respostas mais prováveis.",
              alta: "Com o adversário pressionado, cobrir a resposta provável deixa você pronto para a bola que ele consegue jogar, que tende a vir mais central.",
            },
            resumo: "Cobrir a resposta provável: distâncias parecidas para os dois lados." },
          { id: "rede", rotulo: "Avançar diretamente à rede", posicao: { modo: "bissetriz", y: -3.0 },
            rotulos: { baixa: "controle", media: "inicio", alta: "coerente" },
            textos: {
              baixa: "Avançar sem ter tirado o tempo do adversário deixa espaço para a passada e para o lobby.",
              media: "Avançar é possível, mas o adversário ainda tem opções: a aproximação precisa ser equilibrada e atenta ao lobby.",
              alta: "Com o adversário pressionado, avançar pode encurtar a próxima bola. Ainda assim, chegue equilibrado e cubra a passada.",
            },
            resumo: "Avançar à rede: depende de quanto a sua bola tirou de tempo do adversário." },
          { id: "canto", rotulo: "Permanecer no canto", posicao: { modo: "ficar" },
            rotulos: { baixa: "controle", media: "controle", alta: "controle" },
            textos: {
              baixa: "Ficar onde você bateu deixa o outro lado da quadra aberto. O adversário, com tempo, precisa só mudar a direção para fazer você correr de novo.",
              media: "Ficar onde você bateu deixa o outro lado da quadra aberto. O adversário precisa só mudar a direção para fazer você correr de novo.",
              alta: "Mesmo com o adversário pressionado, ficar no canto deixa o outro lado aberto para uma bola simples na diagonal.",
            },
            resumo: "Ficar no canto: o outro lado da quadra fica aberto." },
        ],
      },
    },
    missao: {
      titulo: "Devolução de saque aberto e recuperação",
      texto: "Pratique devoluções de saque aberto com o seu professor, usando uma zona ampla como alvo, e observe como você recupera o equilíbrio depois de cada devolução.",
      passos: [
        "Peça ao professor saques abertos no lado da igualdade, num ritmo que permita controlar a devolução.",
        "Marque uma zona ampla na diagonal, longe das linhas, como alvo da devolução.",
        "Depois de cada devolução, volte para perto do centro antes da bola seguinte.",
        "Ao final de cada série, conte quantas vezes você chegou equilibrado à bola seguinte.",
      ],
    },
  };

  /* ── CENÁRIO 2 ── */
  var notaSaque = "Os três saques podem ser úteis: depende da sua intenção, da sua execução e do adversário.";
  function d2Saque(situacao, oppLado) {
    var espaco = oppLado === "fora" ? "O adversário ainda está voltando do lado de fora." : oppLado === "centro" ? "Com o adversário no centro, a quadra aberta é menor." : "A devolução veio central e o adversário ficou perto do meio.";
    return {
      tipo: "golpe", numero: 2, contexto: "ataque", golpe: "Primeira bola de forehand, equilibrado",
      situacao: situacao, pergunta: "Como jogar a primeira bola?",
      opcoes: [
        { id: "espaco", rotulo: "Atacar o espaço aberto com margem", alvo: [2.6, 8.8], risco: 0, pressao: 1.6, ideal: { altura: ["media"], intensidade: ["firme", "controlada"] },
          texto: espaco + " Atacar o espaço aberto com margem, longe das linhas, já o obriga a correr; a margem protege você de errar uma bola confortável.",
          resumo: "Espaço aberto com margem: pressão sem depender da linha.", proxima: "d3" },
        { id: "linha", rotulo: "Buscar a linha com força", alvo: [3.85, 10.5], risco: 1, pressao: 1.9, ideal: { altura: ["media"], intensidade: ["firme"] },
          texto: espaco + " Buscar a linha com força vai na mesma direção, mas sem margem. Numa bola confortável é tentador; o ganho de pressão costuma ser pequeno perto do risco de errar.",
          resumo: "Linha com força: um pouco mais de pressão, muito menos margem.", proxima: "d3" },
        { id: "centro", rotulo: "Jogar alto no centro e recuar", alvo: [0.1, 9.6], risco: 0.5, pressao: 0.5, contexto: "neutro", nivel: "iniciativa", ideal: { altura: ["alta", "media"], intensidade: ["controlada", "firme"] },
          texto: "Jogar alto no centro devolve tempo ao adversário, que ainda se reorganizava depois da devolução. É uma escolha segura, mas que abre mão da vantagem criada pelo saque.",
          resumo: "Alto no centro: seguro, mas devolve o tempo ao adversário.", proxima: "d3" },
      ],
    };
  }
  var c2 = {
    id: "saque", numero: 2, titulo: "Saque e primeira bola",
    chamada: "30–30, você saca. Como o saque prepara a bola seguinte?",
    placar: "30–30", sacador: "Você sacando", lado: "Lado da igualdade",
    contexto: "30–30, você saca no lado da igualdade. O adversário espera atrás da linha de base, um pouco mais para o lado do forehand dele.",
    inicio: { jog: [0.7, -12.1], adv: [-2.6, 12.8], hContato: 2.6, saque: true },
    etapas: {
      d1: {
        tipo: "golpe", numero: 1, contexto: "saque", golpe: "Primeiro saque",
        situacao: "Você está pronto para sacar. " + notaSaque,
        pergunta: "Onde sacar?",
        opcoes: [
          { id: "aberto", rotulo: "Sacar aberto", alvo: [-3.5, 5.5], risco: 0.5, pressao: 1.2, ideal: { altura: ["media"], intensidade: ["firme", "controlada"] },
            texto: "O saque aberto puxa o adversário para fora da quadra e pode abrir o outro lado para a sua primeira bola. Mirar perto da lateral pede direção precisa; se a devolução vier cruzada e funda, ela também pode tirar você de posição.",
            resumo: "Aberto: tira o adversário da quadra e abre o outro lado.",
            resposta: { quique: [1.6, -7.3], contato: [2.0, -9.6], advRecupera: [-1.2, 12.2] }, proxima: "d2_aberto" },
          { id: "corpo", rotulo: "Sacar no corpo", alvo: [-2.3, 5.6], risco: 0, pressao: 1.0, ideal: { altura: ["media"], intensidade: ["firme", "controlada"] },
            texto: "O saque no corpo tira do adversário o espaço para estender os braços. Costuma produzir devoluções mais centrais, o que facilita a sua primeira bola, mas abre menos a quadra.",
            resumo: "No corpo: devolução mais central e primeira bola mais simples.",
            resposta: { quique: [0.3, -7.2], contato: [0.6, -9.5], advRecupera: [-0.8, 12.3] }, proxima: "d2_corpo" },
          { id: "t", rotulo: "Sacar no T", alvo: [-0.35, 5.8], risco: 0.3, pressao: 1.1, ideal: { altura: ["media", "baixa"], intensidade: ["firme"] },
            texto: "O saque no T passa pela parte mais baixa da rede e reduz o ângulo da devolução. Pode render uma devolução central; se o adversário antecipar, ele bloqueia a bola para o meio com facilidade.",
            resumo: "No T: menos ângulo para a devolução e rede mais baixa.",
            resposta: { quique: [-0.6, -7.0], contato: [-0.7, -9.4], advRecupera: [0.2, 12.4] }, proxima: "d2_t" },
        ],
      },
      d2_aberto: d2Saque("O adversário devolveu o saque aberto de forehand, esticado. A devolução veio curta, perto da linha de saque, e você chegou equilibrado.", "fora"),
      d2_corpo: d2Saque("O adversário se encolheu para devolver o saque no corpo. A devolução veio curta e central, e você chegou equilibrado.", "meio"),
      d2_t: d2Saque("O adversário bloqueou o saque no T para o meio. A devolução veio curta e você contornou a bola para jogar de forehand, equilibrado.", "centro"),
      d3: {
        tipo: "recuperacao", numero: 3,
        situacao: "Sua bola ainda está no ar e o adversário corre para ela, em defesa. Antes que ele bata, você escolhe o que fazer.",
        pergunta: "Depois da primeira bola, para onde você vai?",
        opcoes: [
          { id: "avancar", rotulo: "Avançar com equilíbrio e cobrir a passada", posicao: { modo: "bissetriz", y: -4.4 },
            rotulos: { baixa: "inicio", media: "coerente", alta: "coerente" },
            textos: {
              baixa: "Avançar é possível, mas a sua bola não tirou muito tempo do adversário: entre equilibrado, pare antes da bola dele e fique atento à passada e ao lobby.",
              media: "Avançar até perto da linha de saque, equilibrado e na linha da bola, encurta a próxima bola e ainda permite reagir à passada.",
              alta: "Com o adversário pressionado, avançar equilibrado e cobrindo a passada coloca você perto da rede para uma bola que tende a vir fraca.",
            },
            resumo: "Avançar equilibrado: aproveitar a vantagem sem ficar exposto." },
          { id: "recuar", rotulo: "Recuar", posicao: { modo: "recuar" },
            rotulos: { baixa: "coerente", media: "inicio", alta: "inicio" },
            textos: {
              baixa: "Se a sua bola não tirou tempo do adversário, recuar mantém a troca e protege você de uma resposta agressiva.",
              media: "Recuar devolve tempo ao adversário: a vantagem do saque e da primeira bola fica menor.",
              alta: "Recuar depois de colocar o adversário em defesa devolve a ele a chance de se reorganizar.",
            },
            resumo: "Recuar: mantém a troca, mas devolve tempo ao adversário." },
          { id: "colar", rotulo: "Aproximar-se excessivamente da rede", posicao: { modo: "bissetriz", y: -1.2 },
            rotulos: { baixa: "controle", media: "controle", alta: "controle" },
            textos: {
              baixa: "Colado na rede e com o adversário com tempo, o lobby fica muito fácil para ele.",
              media: "Muito perto da rede, qualquer bola por cima passa longe do seu alcance; a passada também chega mais rápido.",
              alta: "Mesmo com o adversário em defesa, colar na rede deixa o lobby como saída simples para ele.",
            },
            resumo: "Colar na rede: lobby e passada ficam mais fáceis para o adversário." },
        ],
      },
    },
    missao: {
      titulo: "Saque e primeira bola",
      texto: "Combine saque e primeira bola, observando a devolução antes de escolher a direção do ataque.",
      passos: [
        "Com o professor ou um parceiro, saque sempre do lado da igualdade, alternando aberto, no corpo e no T.",
        "Antes de decidir a primeira bola, diga em voz alta como a devolução chegou: curta ou funda, central ou aberta.",
        "Numa devolução curta e com você equilibrado, ataque o espaço aberto com margem.",
        "Depois da primeira bola, observe a resposta antes de decidir avançar.",
      ],
    },
  };

  /* ── CENÁRIO 3 ── */
  function d2Defesa(situacao, alvos, adv) {
    return {
      tipo: "golpe", numero: 2, contexto: "ataque", golpe: "Bola confortável, dentro da quadra",
      situacao: situacao, pergunta: "Como aproveitar a bola mais confortável?",
      opcoes: [
        { id: "pressionar", rotulo: "Pressionar com margem", alvo: alvos.pressionar, risco: 0, pressao: 1.5, ideal: { altura: ["media"], intensidade: ["firme", "controlada"] },
          texto: "A bola melhorou: está mais baixa, dentro da quadra, e você chegou equilibrado. Pressionar com margem, longe das linhas e longe do adversário" + (adv ? " " + adv : "") + ", transforma essa melhora em iniciativa sem aumentar muito o risco.",
          resumo: "Pressionar com margem: iniciativa sem depender da linha.", proxima: "d3" },
        { id: "linha", rotulo: "Buscar a linha com força máxima", alvo: alvos.linha, risco: 1.5, pressao: 1.9, ideal: { altura: ["media"], intensidade: ["firme"] },
          texto: "Força máxima perto da linha logo na primeira bola confortável é um salto grande: você sai da defesa direto para a bola de menor margem, ainda com o break point contra.",
          resumo: "Linha com força máxima: salto grande de risco logo depois de sair da defesa.", proxima: "d3" },
        { id: "curta", rotulo: "Devolver curto no centro", alvo: alvos.curta, risco: 1, pressao: 0.2, contexto: "neutro", nivel: "iniciativa", ideal: { altura: ["media"], intensidade: ["controlada"] },
          texto: "Uma bola curta no centro devolve ao adversário uma bola confortável: ele entra na quadra e escolhe o lado. A melhora que você conseguiu passa para ele.",
          resumo: "Curto no centro: a bola confortável passa para o adversário.", proxima: "d3" },
      ],
    };
  }
  var c3 = {
    id: "defesa", numero: 3, titulo: "Saia da defesa com intenção",
    chamada: "Break point contra, bola alta no backhand. Como sair da defesa?",
    placar: "3–4 · 30–40", sacador: "Você sacando · break point contra", lado: "Troca de fundo",
    contexto: "3–4, 30–40: break point contra, com você sacando. A troca começou e o adversário mandou uma bola alta e pesada no seu backhand. Você está atrás da linha de base, com a bola acima do ombro e o corpo inclinado para trás.",
    inicio: { jog: [-3.6, -13.6], adv: [1.8, 11.2], hContato: 1.7, previa: { de: [2.0, 11.0], quique: [-2.8, -8.6] } },
    etapas: {
      d1: {
        tipo: "golpe", numero: 1, contexto: "defesa", golpe: "Backhand alto, desequilibrado",
        situacao: "A bola chega acima do ombro e você está atrás da linha, com o peso para trás. O adversário está perto do centro, um passo dentro da quadra.",
        pergunta: "Como sair desta bola?",
        opcoes: [
          { id: "cruzado", rotulo: "Jogar cruzado com margem", alvo: [2.4, 8.8], risco: 0, pressao: 0.6, ideal: DUAS_DEFESAS, objetivo: "ganhar_tempo",
            texto: "Com a bola acima do ombro e o corpo para trás, a diagonal oferece a rede mais baixa e a quadra mais longa. Com altura, neutraliza e dá tempo para você se reequilibrar; acelerada, devolve a pressão ao adversário. As duas são defesas válidas no método.",
            resumo: "Cruzado com margem: neutralizar e ganhar tempo para se reequilibrar.",
            resposta: { quique: [-1.6, -8.0], contato: [-2.0, -10.8], advRecupera: [0.9, 12.2] }, proxima: "d2_cruzado" },
          { id: "winner", rotulo: "Buscar winner paralelo", alvo: [-3.8, 10.6], risco: 2, pressao: 1.6, ideal: { altura: ["media"], intensidade: ["firme"] },
            texto: "A paralela de uma bola alta, desequilibrado e atrás da linha, pede velocidade e precisão ao mesmo tempo. No break point, é uma bola de muito risco: se não sair perfeita, o adversário tem a diagonal aberta.",
            resumo: "Winner paralelo: velocidade e precisão ao mesmo tempo, em desequilíbrio.",
            resposta: { quique: [0.6, -7.4], contato: [0.9, -9.9], advRecupera: [-0.9, 12.2] }, proxima: "d2_winner" },
          { id: "angulo", rotulo: "Tentar ângulo curto", alvo: [3.3, 4.4], risco: 2, pressao: 1.0, ideal: { altura: ["media"], intensidade: ["controlada"] },
            texto: "Um ângulo curto a partir de uma bola alta e de trás da linha exige controle fino. A bola tende a ficar no meio do caminho, curta e sem velocidade, convidando o adversário a entrar.",
            resumo: "Ângulo curto de trás da linha: controle fino e risco de convidar o adversário a entrar.",
            resposta: { quique: [-0.4, -4.6], contato: [-0.5, -6.6], advRecupera: [1.4, 8.4] }, proxima: "d2_angulo" },
        ],
      },
      d2_cruzado: d2Defesa("A resposta veio cruzada, mais baixa e mais curta. Agora a bola chega na altura da cintura, dentro da quadra, e você está equilibrado.", { pressionar: [-2.4, 9.0], linha: [-3.85, 10.6], curta: [0.0, 4.4] }, "(ele voltou para perto do centro, cobrindo a diagonal)"),
      d2_winner: d2Defesa("O adversário chegou esticado à paralela e devolveu uma bola média para o meio da quadra. Ela chega confortável e você está equilibrado.", { pressionar: [2.6, 9.0], linha: [3.85, 10.5], curta: [0.1, 4.3] }, "(ele ainda volta do canto)"),
      d2_angulo: d2Defesa("O adversário entrou para pegar o ângulo e devolveu curto no centro. Você entra na quadra e encontra a bola na altura da cintura.", { pressionar: [-2.6, 9.2], linha: [-3.85, 10.4], curta: [0.2, 4.0] }, "(ele ficou mais à frente, perto da linha de saque)"),
      d3: {
        tipo: "recuperacao", numero: 3,
        situacao: "Sua bola ainda está no ar e o adversário se desloca para ela. Antes que ele bata, você escolhe o que fazer.",
        pergunta: "E depois de bater?",
        opcoes: [
          { id: "cobrir", rotulo: "Recuperar uma posição de cobertura", posicao: { modo: "bissetriz", y: -11.6 },
            rotulos: { baixa: "coerente", media: "coerente", alta: "coerente" },
            textos: {
              baixa: "Voltar para a posição que cobre as respostas possíveis é o que mantém você no ponto enquanto a situação ainda é neutra.",
              media: "Voltar para a posição que cobre as respostas possíveis deixa você pronto para a bola seguinte, seja ela qual for.",
              alta: "Mesmo com o adversário pressionado, recuperar a cobertura e observar a bola dele permite decidir com informação se é hora de avançar.",
            },
            resumo: "Recuperar a cobertura: pronto para a bola seguinte." },
          { id: "ficar", rotulo: "Permanecer onde bateu", posicao: { modo: "ficar" },
            rotulos: { baixa: "controle", media: "controle", alta: "controle" },
            textos: {
              baixa: "Ficar onde bateu deixa um lado inteiro da quadra aberto, e o adversário tem tempo para usá-lo.",
              media: "Ficar onde bateu deixa um lado da quadra aberto: basta ao adversário mudar a direção.",
              alta: "Mesmo com a sua bola pressionando, ficar parado deixa um lado aberto para uma resposta simples.",
            },
            resumo: "Ficar onde bateu: um lado da quadra aberto." },
          { id: "avancar", rotulo: "Avançar sem observar a qualidade da própria bola", posicao: { modo: "bissetriz", y: -3.4 },
            rotulos: { baixa: "controle", media: "controle", alta: "inicio" },
            textos: {
              baixa: "Avançar sem ver como saiu a própria bola é uma aposta: com o adversário com tempo, a passada e o lobby ficam fáceis.",
              media: "Avançar sem observar a própria bola é uma aposta: a decisão de subir depende de quanto ela tirou de tempo do adversário.",
              alta: "Desta vez a sua bola pressionou, mas a decisão de avançar veio antes de ver isso. Observar primeiro é o que transforma a aposta em escolha.",
            },
            resumo: "Avançar sem observar: decidir antes de ver a própria bola." },
        ],
      },
    },
    missao: {
      titulo: "Neutralizar, recuperar e pressionar",
      texto: "Neutralize uma bola alta, recupere a posição e identifique quando existe condição para pressionar.",
      passos: [
        "Peça ao professor bolas altas no seu backhand, com você começando atrás da linha.",
        "Responda cruzado, com altura e margem, e volte para a posição de cobertura.",
        "Quando a bola seguinte vier mais baixa e dentro da quadra, pressione com margem.",
        "Diga, antes de bater, se a bola é para neutralizar ou para pressionar.",
      ],
    },
  };

  /* módulo planejado (apenas apresentado; não implementado) */
  var MODULO = {
    titulo: "As primeiras quatro bolas",
    preco: "R$ 197", precoNota: "preço em avaliação",
    itens: ["12 cenários", "Saque, devolução, primeira bola e recuperação", "Variações de contexto", "Explicações para todas as alternativas", "Missões de treino", "Compra única, sem assinatura"],
  };

  [c1, c2, c3].forEach(function (c) { c.gratis = true; });
  c1.trilha = "defesa"; c2.trilha = "inicio"; c3.trilha = "defesa";
  c1.perguntaMetodo = "Depois da devolução, você chegou equilibrado à bola seguinte?";
  c2.perguntaMetodo = "Você leu a devolução antes de escolher a direção da primeira bola?";
  c3.perguntaMetodo = "Você sabia, antes de bater, se a bola era para neutralizar ou para pressionar?";
  /* situação tática de cada decisão (taxonomia do scout MTY) */
  c1.etapas.d1.tatica = "defesa"; ["d2_cruzado"].forEach(function (k) { c1.etapas[k].tatica = "neutra"; }); c1.etapas.d2_paralela.tatica = "defesa"; c1.etapas.d2_curta.tatica = "contra";
  c2.etapas.d1.tatica = "inicio"; ["d2_aberto", "d2_corpo", "d2_t"].forEach(function (k) { c2.etapas[k].tatica = "ataque"; });
  c3.etapas.d1.tatica = "defesa"; ["d2_cruzado", "d2_winner", "d2_angulo"].forEach(function (k) { c3.etapas[k].tatica = "construcao"; });

  return { ROTULOS: ROTULOS, OBJETIVOS: OBJETIVOS, TATICAS: TATICAS, DUAS_DEFESAS: DUAS_DEFESAS, AVISO: AVISO, PERGUNTA: PERGUNTA, NOTAS: NOTAS, CENARIOS: [c1, c2, c3], MODULO: MODULO };
});
