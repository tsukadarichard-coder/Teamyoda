/* Estrutura da sessão do Team Yoda (pedido do Richard em 25/11/2026): toda sessão de aula (individual, turma e alto rendimento)
   tem quatro partes, nesta ordem — Aquecimento, Técnica específica, Parte geral (o que o planejamento já define, com a tática)
   e Saque e devolução. Este arquivo traz o que é novo:
   · a família TE · Técnica específica: um golpe só, isolado, sem construção de jogada (lançamento à mão, cesto parado, cesto
     com deslocamento), para todos os golpes do tênis;
   · a lista fechada de aquecimento: só o que se faz dentro da quadra, separada por idade (crianças × adultos e competição);
   · as regras puras de escolha: o golpe do dia de cada aluno (o que o professor marcou na ficha, alternando) e o exercício.
   O planejamento não muda. Só o app do professor carrega este arquivo. */
(function (raiz) {
  "use strict";

  /* todos os golpes do tênis; `bh` liga o backhand ao campo Backhand da ficha (1 = uma mão, 2 = duas mãos) */
  var GOLPES = [
    { id: "forehand", r: "Forehand", curto: "FH" },
    { id: "backhand2", r: "Backhand de duas mãos", curto: "BH duas mãos", bh: "2" },
    { id: "backhand1", r: "Backhand de uma mão", curto: "BH uma mão", bh: "1" },
    { id: "slice", r: "Slice de backhand", curto: "Slice" },
    { id: "voleioFH", r: "Voleio de forehand", curto: "Voleio FH" },
    { id: "voleioBH", r: "Voleio de backhand", curto: "Voleio BH" },
    { id: "meiovoleio", r: "Meio-voleio", curto: "Meio-voleio" },
    { id: "smash", r: "Smash", curto: "Smash" },
    { id: "lob", r: "Lob", curto: "Lob" },
    { id: "curtinha", r: "Curtinha (deixada)", curto: "Curtinha" },
    { id: "approach", r: "Bola de aproximação (approach)", curto: "Approach" },
    { id: "saque", r: "Saque", curto: "Saque" },
    { id: "devolucao", r: "Devolução", curto: "Devolução" },
  ];
  var GOLPE = {}; GOLPES.forEach(function (g) { GOLPE[g.id] = g; });
  /* rodízio quando a ficha não tem golpe marcado: crianças ficam nos golpes de base; adultos e competição passam por todos */
  /* saque e devolução têm a parte própria em toda sessão: entram aqui só quando o professor marca na ficha */
  var RODIZIO_CRIANCA = ["forehand", "backhand", "voleioFH", "voleioBH"];
  var RODIZIO_ADULTO = ["forehand", "backhand", "voleioFH", "voleioBH", "slice", "approach", "smash", "curtinha", "lob", "meiovoleio"];
  var CRIANCA = { V: 1, L: 1, G: 1 };

  var VOL_CRIANCA = "Crianças (bola vermelha, laranja ou verde): 3 séries de 8 bolas, pausa de 30 s.";
  var VOL_ADULTO = "Adultos e competição: 4 séries de 12 bolas, pausa de 30 a 45 s.";
  var ISOLADO = " Só este golpe, sem construção de jogada: a bola volta para o cesto, ninguém troca.";

  /* cada golpe: o que observar (x), o objetivo (o) e os formatos; cada formato vira um exercício TE */
  var DADOS = [
    ["forehand", "Unit turn completo antes do quique; contato à frente do pé da frente; terminação sobre o ombro oposto.", "Forehand estável, com contato à frente e profundidade pela altura.", [
      ["mao", "Lançamento à mão, base fixa", "Professor ao lado, a 2–3 m, lança a bola com quique na zona do forehand. Aluno de lado, bate cruzado para o fundo."],
      ["cesto", "Cesto, base fixa", "Professor do outro lado com o cesto, bola no forehand na altura da cintura. Alvo: último terço da quadra, na cruzada."],
      ["mov", "Cesto com deslocamento lateral", "Aluno parte do centro, desloca para o forehand, bate cruzado e recupera para o centro com passos laterais antes da próxima bola."],
      ["mov2", "Cesto entrando e saindo", "Bolas alternadas curta e funda, sempre no forehand: o aluno entra ou recua para acertar a distância antes de bater."]]],
    ["backhand2", "As duas mãos na raquete desde o início; o braço não dominante comanda; contato mais à frente que o forehand.", "Backhand de duas mãos estável, sem perder a estrutura dos braços.", [
      ["mao", "Lançamento à mão, base fixa", "Professor ao lado lança no backhand. Ombros a 90° da rede antes do quique, bate cruzado."],
      ["cesto", "Cesto, base fixa", "Professor com o cesto do outro lado, bola no backhand na cintura. Alvo no fundo, na cruzada."],
      ["mov", "Cesto com deslocamento lateral", "Do centro, desloca para o backhand, bate e recupera com passos laterais."],
      ["mov2", "Cesto entrando e saindo", "Bolas alternadas curta e funda no backhand: ajustar a distância com os pés, não com os braços."]]],
    ["backhand1", "Preparação cedo com o ombro apontando a bola; braço de trás estica no contato (contrapeso); contato bem à frente.", "Backhand de uma mão com preparação adiantada e contato à frente.", [
      ["mao", "Lançamento à mão, base fixa", "Professor ao lado lança no backhand com quique médio. Giro completo antes do quique."],
      ["cesto", "Cesto, base fixa", "Cesto do outro lado, bola na altura da cintura. Alvo cruzado no fundo."],
      ["mov", "Cesto com deslocamento lateral", "Do centro, desloca para o backhand, bate e recupera."],
      ["mov2", "Cesto com bola alta", "Bola mais alta no backhand: recuar para pegar mais baixo ou entrar para pegar na subida, sem bater acima do ombro."]]],
    ["slice", "Face aberta; escovada de cima para baixo, à frente do corpo; ombros de lado até depois do contato.", "Slice baixo e longo, que passa baixo na rede.", [
      ["mao", "Lançamento à mão, base fixa", "Professor lança no backhand. Bater de slice com a bola passando baixa na rede."],
      ["cesto", "Cesto, base fixa", "Cesto do outro lado. Alvo: bola que quica depois da linha de saque e continua baixa."],
      ["mov", "Cesto com deslocamento", "Bola aberta no backhand: chegar de lado e cortar por baixo, recuperando para o centro."]]],
    ["voleioFH", "Empunhadura continental; preparação só com os ombros; passo em direção à bola; punho firme no contato.", "Voleio de forehand como bloqueio, com direção definida.", [
      ["mao", "Lançamento à mão, perto da rede", "Aluno a 2 m da rede, professor lança à mão na altura do peito. Bloqueio sem swing."],
      ["cesto", "Cesto, base fixa", "Aluno entre a rede e a linha de saque. Professor alimenta do cesto no forehand. Alvo na cruzada."],
      ["mov", "Cesto com deslocamento lateral", "Split step a cada bola, passo cruzado para o forehand e volta ao centro da rede."]]],
    ["voleioBH", "Continental; ombros giram, raquete não passa da linha do corpo; passo cruzado; contato à frente.", "Voleio de backhand firme, com contato à frente.", [
      ["mao", "Lançamento à mão, perto da rede", "Aluno a 2 m da rede, lançamento à mão no backhand, na altura do peito."],
      ["cesto", "Cesto, base fixa", "Bolas do cesto no backhand. Alvo na paralela e na cruzada, alternando."],
      ["mov", "Cesto com deslocamento lateral", "Split step, passo cruzado para o backhand e recuperação ao centro."]]],
    ["meiovoleio", "Base baixa com joelhos flexionados; raquete na frente do corpo; contato logo depois do quique, sem swing.", "Meio-voleio controlado, sem levantar o corpo.", [
      ["mao", "Lançamento à mão nos pés", "Aluno na linha de saque, professor lança a bola para quicar perto dos pés. Bloquear para frente."],
      ["cesto", "Cesto na linha de saque", "Cesto do outro lado, bolas baixas nos pés do aluno, que está parado na linha de saque."],
      ["mov", "Cesto subindo para a rede", "Aluno sobe da linha de fundo, faz o split na linha de saque e devolve o meio-voleio."]]],
    ["smash", "De lado para a rede; braço não dominante aponta a bola; raquete direto ao troféu; contato alto e à frente.", "Smash com preparação curta e contato no alto.", [
      ["mao", "Lançamento à mão perto da rede", "Aluno perto da rede, professor lança bola alta à mão. Bater com controle, sem força máxima."],
      ["cesto", "Lobs do cesto", "Professor manda lobs do cesto. Aluno entre a rede e a linha de saque, contato no alto."],
      ["mov", "Lobs com recuo", "Lobs mais fundos: passada cruzada para trás, parar, bater e voltar a fechar a rede."]]],
    ["lob", "Face aberta; terminação alta; a bola passa acima do alcance de quem está na rede e cai funda.", "Lob alto e fundo.", [
      ["mao", "Lançamento à mão, base fixa", "Professor ao lado lança, aluno levanta a bola por cima de um alvo imaginário na rede, até o fundo."],
      ["cesto", "Cesto, base fixa", "Cesto do outro lado, com o professor ou um aluno parado na rede como referência. Alvo nos últimos 2 m."],
      ["mov", "Cesto com deslocamento", "Bolas abertas: chegar e levantar o lob em defesa, recuperando para o centro."]]],
    ["curtinha", "Mesma preparação do drive; a face abre embaixo da bola; mãos macias; segundo quique dentro da área de saque.", "Curtinha disfarçada, com backspin e pouca altura.", [
      ["mao", "Lançamento à mão, base fixa", "Professor lança na meia quadra. Aluno prepara como drive e solta a curtinha."],
      ["cesto", "Cesto, base fixa", "Cesto do outro lado, bola na meia quadra. Alvo: área de saque, perto da rede."],
      ["mov", "Cesto entrando na quadra", "Bola curta: entrar e soltar a curtinha em movimento, sem parar antes do golpe."]]],
    ["approach", "Preparação curta em movimento; contato à frente e na subida; seguir a linha da bola depois do golpe.", "Bola de aproximação profunda, batida em movimento.", [
      ["mao", "Lançamento à mão, bola curta", "Professor lança bola curta; aluno entra, bate na subida e para na linha de saque (sem voleio)."],
      ["cesto", "Cesto, bola curta", "Cesto do outro lado, bolas curtas alternando forehand e backhand. Direção padrão: paralela."],
      ["mov", "Cesto com subida até a rede", "Bater o approach e seguir a linha da bola até a zona de voleio, com split step no fim (sem voleio)."]]],
    ["saque", "Lançamento sempre igual, à frente; troféu com joelhos flexionados; contato no alto com o braço estendido.", "Saque regular, com o mesmo armado em todas as bolas.", [
      ["mao", "Só o lançamento", "Aluno lança a bola e deixa cair: ela deve quicar à frente do pé da frente, sempre no mesmo lugar. Raquete apontando para cima."],
      ["cesto", "Cesto do aluno, série por lado", "Aluno com o próprio cesto saca séries alternando lado iguais e lado vantagem, alvos no T e aberto."],
      ["mov", "Saque e recuperação", "Sacar, aterrissar dentro da quadra e fazer o split pronto para a devolução, a cada bola."]]],
    ["devolucao", "Split step no contato do sacador; preparação curta; contato à frente com direção decidida antes.", "Devolução firme, com preparação curta.", [
      ["mao", "Lançamento por cima, de perto", "Professor na linha de saque do outro lado lança a bola por cima, imitando o saque. Aluno faz o split e devolve no meio da quadra."],
      ["cesto", "Cesto imitando o saque", "Professor alimenta do cesto, do lugar do sacador, com bolas firmes. Alvo: fundo e centro."],
      ["mov", "Devolução e recuperação", "Devolver e recuperar para o centro da linha de fundo, com split step na próxima bola."]]],
  ];
  var ESTAGIOS_FORMATO = { mao: ["V", "L", "G", "A", "C"], cesto: ["L", "G", "A", "C"], mov: ["G", "A", "C"], mov2: ["G", "A", "C"] };
  var REGRESSAO = { mao: "Bola mais lenta (vermelha ou laranja) e quadra reduzida; menos bolas por série.", cesto: "Voltar ao lançamento à mão, com o professor mais perto.", mov: "Tirar o deslocamento: cesto com base fixa.", mov2: "Tirar o deslocamento: cesto com base fixa." };
  var PROGRESSAO = { mao: "Passar para o cesto, com o professor do outro lado.", cesto: "Acrescentar deslocamento antes de cada bola.", mov: "Bolas mais rápidas ou alvo menor, mantendo a técnica.", mov2: "Bolas mais rápidas ou alvo menor, mantendo a técnica." };

  var EXERCICIOS = [], n = 0;
  DADOS.forEach(function (d) {
    var g = GOLPE[d[0]];
    d[3].forEach(function (f) {
      n++;
      var e = ESTAGIOS_FORMATO[f[0]].slice();
      EXERCICIOS.push({
        c: "TE" + String(n).padStart(3, "0"), n: g.curto + " isolado · " + f[1], f: "TE", e: e, golpe: g.id, formato: f[0],
        m: f[2] + ISOLADO,
        g: (e.some(function (s) { return CRIANCA[s]; }) ? VOL_CRIANCA + " " : "") + VOL_ADULTO,
        r: REGRESSAO[f[0]], p: PROGRESSAO[f[0]], x: d[1],
        i: "Direção e velocidade da bola. Aqui só se corrige o golpe: nada de ponto, de jogada ou de placar.",
        v: 0, o: d[2],
      });
    });
  });
  /* dois aquecimentos novos, dentro da quadra, para adultos e competição */
  var AQUECIMENTO_NOVOS = [
    { c: "AQ001", n: "Minitênis de ativação", f: "CO", e: ["G", "A", "C"], m: "Dois jogadores dentro das áreas de saque trocam bolas curtas e lentas, sem pressa, aumentando o ritmo aos poucos. Sem pontuação.", g: "4–5 min", r: "Bola mais lenta e trocas cooperativas contadas.", p: "Alternar forehand e backhand a cada bola.", x: "Pés ativos e contato à frente, com a raquete solta.", i: "Força e direção: é só para o corpo entrar no ritmo.", v: 0, o: "Ativar o corpo e o tempo de bola antes do treino." },
    { c: "AQ002", n: "Mobilidade dinâmica na linha de base", f: "CO", e: ["A", "C"], m: "Na linha de base, de um corredor ao outro: passadas largas com rotação de tronco, elevação de joelhos, chute de calcanhar, deslocamento lateral e passada cruzada.", g: "5 min, 2 idas e voltas de cada", r: "Menos amplitude, ritmo de caminhada.", p: "Terminar com 2 acelerações curtas de 5 m.", x: "Postura e amplitude crescente, sem pressa.", i: "Velocidade: é aquecimento.", v: 0, o: "Preparar quadril, tronco e ombros para o treino." },
  ];

  /* Aquecimento: lista fechada do que se faz dentro da quadra, por idade (crianças = V, L, G; adultos e competição = A, C).
     Ficou de fora o que não cabe: visualização "antes de entrar em quadra", corda, prancha e os exercícios que já são treino
     (troca de bolas em dupla, corridas com golpe, defesa e transição, cobertura de quadra). */
  var AQUECIMENTO = {
    crianca: ["BR001", "BR002", "BR006", "BR007", "BR013", "BR014", "BR020", "BR032", "CO013", "CO015", "CO017", "CO018", "CO020", "CF014", "MV004", "MV005", "MV006", "MV017", "MV018", "MV021", "AQ001"],
    adulto: ["AQ001", "AQ002", "CO012", "CO014", "CO016", "CO019", "CO020", "CF002", "CF003", "CF014", "FB029", "FB030", "MV004", "MV005", "MV006", "MV007", "MV016", "MV017", "MV018", "MV020", "MV021"],
  };
  function faixa(estagio) { return CRIANCA[estagio] ? "crianca" : "adulto"; }
  /* códigos de aquecimento permitidos para um ou mais estágios (turma com idades misturadas: a faixa mais nova manda) */
  function aquecimentoPermitido(estagios) {
    var l = [].concat(estagios || []).filter(Boolean);
    var f = l.some(function (s) { return CRIANCA[s]; }) ? "crianca" : "adulto";
    return AQUECIMENTO[f].slice();
  }

  /* golpes marcados na ficha (até 2); "backhand" genérico vira o da ficha */
  function golpeDoBackhand(aluno) { var b = String(aluno && aluno.backhand); return b === "1" || b === "uma" ? "backhand1" : "backhand2"; }
  function resolver(id, aluno) { return id === "backhand" ? golpeDoBackhand(aluno) : (GOLPE[id] ? id : null); }
  function golpesDaFicha(aluno) {
    return ((aluno && aluno.golpesTecnicos) || []).map(function (g) { return resolver(g, aluno); }).filter(Boolean).slice(0, 2);
  }
  /* golpe já trabalhado num exercício TE */
  function golpeDoCodigo(c, catalogo) { var e = (catalogo || EXERCICIOS).find(function (x) { return x.c === c; }); return e && e.f === "TE" ? e.golpe : null; }
  /* golpe de hoje: o da ficha, alternando entre os dois marcados pelo último que a sessão trabalhou; sem marcação, o rodízio da
     faixa de idade, seguindo depois do último golpe trabalhado. ultimos = códigos das sessões recentes (mais recente por último). */
  /* dia (opcional, número do dia): quando não há sessão recente com técnica específica para alternar (alto rendimento), os dois
     golpes da ficha alternam pelo dia */
  function golpeDoDia(aluno, ultimos, catalogo, dia) {
    var feitos = (ultimos || []).map(function (c) { return golpeDoCodigo(c, catalogo); }).filter(Boolean), ultimo = feitos[feitos.length - 1] || null;
    var ficha = golpesDaFicha(aluno);
    if (ficha.length) {
      if (ficha.length === 2 && !ultimo && dia != null) return ficha[Math.abs(dia) % 2];
      if (ficha.length === 2 && ultimo === ficha[0]) return ficha[1];
      return ficha[0];
    }
    var rod = (CRIANCA[aluno && aluno.estagio] ? RODIZIO_CRIANCA : RODIZIO_ADULTO).map(function (g) { return resolver(g, aluno); });
    var i = ultimo ? rod.indexOf(ultimo) : -1;
    return rod[(i + 1) % rod.length];
  }
  /* exercício TE do golpe para o estágio; evita repetir o formato feito por último; crianças pequenas ficam no lançamento à mão */
  function exercicioTecnico(golpe, estagios, evitar, catalogo) {
    var l = [].concat(estagios || []).filter(Boolean), cat = (catalogo || EXERCICIOS).filter(function (e) { return e.f === "TE" && e.golpe === golpe; });
    var cabe = cat.filter(function (e) { return !l.length || l.every(function (s) { return e.e.indexOf(s) >= 0; }); });
    if (!cabe.length) cabe = cat.filter(function (e) { return l.some(function (s) { return e.e.indexOf(s) >= 0; }); });
    if (!cabe.length) cabe = cat;
    var frescos = cabe.filter(function (e) { return !(evitar && evitar.has && evitar.has(e.c)); });
    var fonte = frescos.length ? frescos : cabe;
    return fonte.length ? fonte[Math.floor(Math.random() * fonte.length)] : null;
  }
  /* Técnica específica de um grupo (turma ou CT): um exercício por golpe, com quem trabalha cada um.
     alunos = [{ id, nome, estagio, backhand, golpesTecnicos, ultimos }] */
  function tecnicaDoGrupo(alunos, catalogo) {
    var porGolpe = {};
    (alunos || []).forEach(function (a) { var g = golpeDoDia(a, a.ultimos, catalogo); (porGolpe[g] = porGolpe[g] || []).push(a); });
    return Object.keys(porGolpe).map(function (g) {
      var quem = porGolpe[g], ex = exercicioTecnico(g, quem.map(function (a) { return a.estagio; }), null, catalogo);
      return ex ? { golpe: g, rotulo: GOLPE[g].r, exercicio: ex, alunos: quem.map(function (a) { return a.id; }) } : null;
    }).filter(Boolean).sort(function (a, b) { return b.alunos.length - a.alunos.length; });
  }

  raiz.MTYTecnica = {
    GOLPES: GOLPES, GOLPE: GOLPE, AQUECIMENTO: AQUECIMENTO,
    exercicios: function () { return EXERCICIOS.concat(AQUECIMENTO_NOVOS); },
    aquecimentoPermitido: aquecimentoPermitido, faixa: faixa,
    golpesDaFicha: golpesDaFicha, golpeDoDia: golpeDoDia, golpeDoBackhand: golpeDoBackhand,
    exercicioTecnico: exercicioTecnico, tecnicaDoGrupo: tecnicaDoGrupo,
  };
})(typeof window !== "undefined" ? window : globalThis);
