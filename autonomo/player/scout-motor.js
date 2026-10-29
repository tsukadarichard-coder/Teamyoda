/* Motor do scout (placar, saque, lado da quadra, estatísticas e resumo público).
   GERADO de index.html (scout do treinador) por tests/gerar-scout-motor.js: não edite aqui. O teste check-scout-motor.js falha se os dois divergirem.
   Usado pelo responsável, para marcar o jogo com as mesmas regras e os mesmos números do treinador. */
(function (raiz) {
"use strict";
const PONTOS_TENIS = ["0", "15", "30", "40"];

function placarInicial(formato, sacaPrimeiro, semVantagem, superTiebreakDecisivo) {
  return {
    formato, p: [0, 0], g: [0, 0], sets: [], saque: sacaPrimeiro,
    tiebreak: !!tiebreakUnico(formato), fim: false, vencedor: null,
    semVantagem: !!semVantagem, superTiebreakDecisivo: !!superTiebreakDecisivo,
  };
}

function rotuloPontos(e) {
  if (e.tiebreak) return `${e.p[0]}-${e.p[1]}`;
  const [a, b] = e.p;
  if (a >= 3 && b >= 3) {
    if (a === b) return "40-40";
    if (e.semVantagem) return "40-40"; // ponto decisivo: nunca chega a existir "AD", o game fecha no próprio ponto
    return a > b ? "AD-40" : "40-AD";
  }
  return `${PONTOS_TENIS[a]}-${PONTOS_TENIS[b]}`;
}

/* placar adverso: adversário à frente no game, ou nós atrás em games no set */
function ehAdverso(e) {
  if (e.p[1] > e.p[0]) return true;
  if (e.g[1] > e.g[0]) return true;
  return false;
}

function gamesParaSet(formato) {
  return formato === "4games" ? 4 : 6;
}
/* Partida inteira num tie-break só: "tb7" (tie-break de 7 pontos) e "tb10" (match tie-break de 10 pontos), 2 de diferença. */
function tiebreakUnico(formato) {
  return formato === "tb7" ? 7 : formato === "tb10" ? 10 : 0;
}

/* Duas mecânicas reais de pontuação, opcionais e configuráveis — antes
   só existia a regra clássica (vantagem + games até o fim, sem super
   tie-break), e isso era dito como limitação. Agora:
   - semVantagem: ponto decisivo em 40-40 (quem ganha o ponto seguinte
     fecha o game, sem exigir 2 de diferença) — regra "no-ad".
   - superTiebreakDecisivo: só se aplica ao "Melhor de 3 sets"; quando
     o placar de sets fica 1-1, o 3º set inteiro vira um único
     tie-break de 10 pontos (2 de diferença) em vez de um set normal de
     games — convenção comum em torneios amadores pra não jogar um 3º
     set completo. */
function aplicaPonto(e0, nos) {
  const e = { ...e0, p: [...e0.p], g: [...e0.g], sets: [...e0.sets] };
  if (e.fim) return e;
  const i = nos ? 0 : 1, j = nos ? 1 : 0;
  e.p[i]++;

  const alvoGames = gamesParaSet(e.formato);
  const unico = tiebreakUnico(e.formato);
  const setDecisivoComSuperTB = !!unico || (e.formato === "3sets" && e.superTiebreakDecisivo && e.sets.length === 2);
  if (setDecisivoComSuperTB) e.tiebreak = true;
  const alvoTiebreak = unico || (setDecisivoComSuperTB ? 10 : 7);

  function fechaGame(quem) {
    e.g[quem]++;
    e.p = [0, 0];
    e.saque = e.saque === "nos" ? "ele" : "nos";
    const o = quem === 0 ? 1 : 0;
    if (e.g[quem] >= alvoGames && e.g[quem] - e.g[o] >= 2) fechaSet(quem);
    else if (e.g[0] === alvoGames && e.g[1] === alvoGames) e.tiebreak = true;
  }
  function fechaSet(quem, pontosTiebreakFinais) {
    e.sets.push(setDecisivoComSuperTB ? pontosTiebreakFinais : [e.g[0], e.g[1]]);
    e.g = [0, 0];
    e.tiebreak = false;
    const meus = e.sets.filter((s) => s[0] > s[1]).length;
    const dele = e.sets.filter((s) => s[1] > s[0]).length;
    const preciso = e.formato === "3sets" ? 2 : 1;
    if (meus >= preciso || dele >= preciso) {
      e.fim = true;
      e.vencedor = meus > dele ? "nos" : "ele";
    }
  }

  if (e.tiebreak) {
    if (e.p[i] >= alvoTiebreak && e.p[i] - e.p[j] >= 2) {
      const pontosFinaisTB = [e.p[0], e.p[1]]; // precisa ser lido ANTES de zerar e.p abaixo
      e.saque = e.saque === "nos" ? "ele" : "nos"; // o próximo set começa com o saque de quem não abriu o tie-break
      e.g[i]++;
      e.p = [0, 0];
      fechaSet(i, pontosFinaisTB);
    }
  } else {
    const golDoGame = e.semVantagem ? (e.p[i] >= 4 && e.p[i] > e.p[j]) : (e.p[i] >= 4 && e.p[i] - e.p[j] >= 2);
    if (golDoGame) fechaGame(i);
  }
  return e;
}

/* Quem saca o ponto que vai ser jogado: no game comum é placar.saque; no tie-break o saque troca a cada dois pontos. */
function quemSaca(e) {
  if (!e.tiebreak) return e.saque;
  const n = e.p[0] + e.p[1];
  return Math.floor((n + 1) / 2) % 2 === 0 ? e.saque : (e.saque === "nos" ? "ele" : "nos");
}
/* Lado da quadra de onde sai o saque, calculado pelo placar: soma de pontos par = lado da igualdade (direito); ímpar = lado da vantagem (esquerdo). Vale também no tie-break. */
function ladoDoSaque(e) { return (e.p[0] + e.p[1]) % 2 === 0 ? "D" : "E"; }
const ROTULO_LADO = { D: "lado da igualdade (direito)", E: "lado da vantagem (esquerdo)" };
const SITUACOES = [["ataque", "Ataque"], ["contra", "Contra-ataque"], ["defesa", "Defesa"], ["neutra", "Neutra"], ["construcao", "Construção"]];
/* último golpe do jogador no ponto (opcional), com a marca "na corrida" e a direção; direção do saque de quem saca */
const GOLPES = [["forehand", "Forehand"], ["backhand", "Backhand"], ["voleio", "Voleio"], ["smash", "Smash"], ["drop", "Drop shot"], ["lob", "Lob"], ["devolucao", "Devolução"]];
const DIRECOES = [["cruzado", "Cruzado"], ["paralelo", "Paralelo"]];
const DIRECOES_SAQUE = [["aberto", "Aberto"], ["fechado", "Fechado"], ["corpo", "Corpo"]];
/* qualidade da devolução do jogador (opcional, no ponto em que o adversário saca) e nível do adversário (no fim da partida) */
const QUALIDADES_DEVOLUCAO = [["boa", "Boa"], ["regular", "Regular"], ["fraca", "Fraca"]];
const NIVEIS_ADVERSARIO = [["iniciante", "Iniciante"], ["intermediario", "Intermediário"], ["avancado", "Avançado"], ["competitivo", "Competitivo"], ["elite", "Elite / profissional"]];
/* avaliação mental (1 a 5) antes, durante (por game) e depois do jogo; decisão do jogador em cada ponto (opcional); game de cada ponto */
const ESCALAS_MENTAIS = [["conf", "Confiança"], ["foco", "Foco"], ["energia", "Energia"], ["calma", "Controle emocional"]];
const DECISOES = [["boa", "Boa"], ["disc", "Discutível"], ["ruim", "Ruim"]];
function numeroDoGame(pl) { return pl.sets.reduce((t, x) => t + x[0] + x[1], 0) + pl.g[0] + pl.g[1] + 1; }
function numeroDoSet(pl) { return pl.sets.length + 1; }
function mentalLimpo(m) {
  const v = (x) => { x = Math.round(+x); return x >= 1 && x <= 5 ? x : 0; };
  const bloco = (o) => Object.fromEntries(ESCALAS_MENTAIS.map(([k]) => [k, v(o && o[k])]));
  const jogo = {};
  Object.keys((m && m.jogo) || {}).slice(0, 60).forEach((g) => { const n = Math.round(+g); if (n >= 1 && n <= 60 && v(m.jogo[g])) jogo[n] = v(m.jogo[g]); });
  return { antes: bloco(m && m.antes), depois: bloco(m && m.depois), jogo };
}
/* erro de devolução de saque: o jogador errou ao devolver o saque do adversário (golpe marcado como devolução ou, sem golpe marcado, ponto de 1–2 bolas) */
function erroDeDevolucao(p) { return p.fim === "erro_nos" && p.sacador === "ele" && p.saque !== "df" && (p.golpe === "devolucao" || (!p.golpe && p.bola === "1-2")); }
/* e o inverso: o adversário errou a devolução do saque do jogador */
/* erro de devolução do adversário: marcado no ponto ("Erro de devolução do adversário") ou, sem a marcação, erro dele na bola 1–2 do nosso saque */
function erroDeDevolucaoDele(p) { return p.fim === "erro_dele" && p.sacador === "nos" && p.saque !== "df" && p.saque !== "ace" && (p.devAdv === true || (p.devAdv !== false && p.bola === "1-2")); }

function resume(pontos) {
  const n = pontos.length || 1;
  const conta = (f) => pontos.filter(f).length;
  const pct = (x) => Math.round((x / n) * 100);

  const curtos = conta((p) => p.bola === "1-2");
  const medios = conta((p) => p.bola === "3-4");
  const longos = conta((p) => p.bola === "5+");
  const ganhos = conta((p) => p.nos);
  const errosNos = pontos.filter((p) => p.fim === "erro_nos");
  const errosDecisao = errosNos.filter((p) => p.causa === "decisao").length;
  const errosExec = errosNos.filter((p) => p.causa === "execucao").length;
  const errosCurtos = errosNos.filter((p) => p.bola === "1-2").length;

  const meusSaques = pontos.filter((p) => p.sacador === "nos");
  const df = meusSaques.filter((p) => p.saque === "df");
  const dfAdverso = df.filter((p) => p.adverso).length;
  const saquesAdverso = meusSaques.filter((p) => p.adverso).length || 1;
  const saquesNeutro = meusSaques.length - saquesAdverso || 1;
  const razaoDF = ((dfAdverso / saquesAdverso) / (Math.max(df.length - dfAdverso, 0.0001) / saquesNeutro)) || 0;

  const primeiros = meusSaques.filter((p) => p.saque === "1").length;
  const comSaqueMarcado = meusSaques.filter((p) => p.saque === "1" || p.saque === "2" || p.saque === "df").length || 1;
  const aces = meusSaques.filter((p) => p.saque === "ace").length;

  /* saque do adversário, lado da quadra e tipo de ponto */
  const saquesDele = pontos.filter((p) => p.sacador === "ele");
  const acesAdv = saquesDele.filter((p) => p.saque === "ace").length;
  const dfAdv = saquesDele.filter((p) => p.saque === "df").length;
  const comSaqueDele = saquesDele.filter((p) => p.saque === "1" || p.saque === "2" || p.saque === "df").length;
  const pctDe = (lista) => (lista.length ? Math.round((lista.filter((p) => p.nos).length / lista.length) * 100) : 0);
  const doLado = (lista, l) => lista.filter((p) => p.lado === l);
  const sacD = doLado(meusSaques, "D"), sacE = doLado(meusSaques, "E"), devD = doLado(saquesDele, "D"), devE = doLado(saquesDele, "E");
  const sit = (k) => pontos.filter((p) => p.situacao === k);
  const ganhosDe = (l) => l.filter((p) => p.nos).length;
  const devNos = pontos.filter((p) => p.sacador === "ele"), devEle = pontos.filter((p) => p.sacador === "nos");
  const detalhe = {
    fins: { winner_nos: conta((p) => p.fim === "winner_nos"), erro_dele: conta((p) => p.fim === "erro_dele"), erro_nos: conta((p) => p.fim === "erro_nos"), winner_dele: conta((p) => p.fim === "winner_dele") },
    golpes: Object.fromEntries(GOLPES.map(([k]) => { const l = pontos.filter((p) => p.golpe === k); return [k, { n: l.length, w: l.filter((p) => p.fim === "winner_nos").length, e: l.filter((p) => p.fim === "erro_nos").length, g: ganhosDe(l), c: l.filter((p) => p.corrida).length }]; })),
    direcao: Object.fromEntries(DIRECOES.map(([k]) => { const l = pontos.filter((p) => p.direcao === k); return [k, { n: l.length, g: ganhosDe(l), c: l.filter((p) => p.corrida).length }]; })),
    saqueDir: Object.fromEntries(["nos", "ele"].map((s) => [s, Object.fromEntries(DIRECOES_SAQUE.map(([k]) => { const l = pontos.filter((p) => p.sacador === s && p.dirSaque === k); return [k, { n: l.length, a: l.filter((p) => p.saque === "ace").length, g: l.filter((p) => (s === "nos" ? p.nos : !p.nos)).length }]; }))])),
    situacoes: Object.fromEntries(SITUACOES.map(([k]) => { const l = pontos.filter((p) => p.situacao === k); return [k, { n: l.length, g: ganhosDe(l) }]; })),
    devolucao: { nos: { n: devNos.length, e: devNos.filter(erroDeDevolucao).length, q: Object.fromEntries(QUALIDADES_DEVOLUCAO.map(([k]) => { const l = devNos.filter((p) => p.qualDev === k); return [k, { n: l.length, g: ganhosDe(l) }]; })) }, ele: { n: devEle.length, e: devEle.filter(erroDeDevolucaoDele).length } },
    corrida: { n: conta((p) => p.corrida), g: conta((p) => p.corrida && p.nos) },
    decisoes: Object.fromEntries(DECISOES.map(([k]) => { const l = pontos.filter((p) => p.dec === k); return [k, { n: l.length, g: ganhosDe(l) }]; })),
    games: [...new Set(pontos.filter((p) => p.jogo).map((p) => p.jogo))].sort((a, b) => a - b).map((j) => {
      const l = pontos.filter((p) => p.jogo === j), d = (k) => l.filter((p) => p.dec === k).length;
      return { j, n: l.length, g: ganhosDe(l), boa: d("boa"), disc: d("disc"), ruim: d("ruim"), s: l[0].set || 1, w: l[l.length - 1].nos ? 1 : 0 };
    }),
  };

  const protocolo = conta((p) => p.protocolo);
  const rede = conta((p) => p.rede);
  const redeGanha = conta((p) => p.rede && p.nos);
  const ataquePerdido = conta((p) => p.ataquePerdido);

  const adversos = pontos.filter((p) => p.adverso);
  const adversosGanhos = adversos.filter((p) => p.nos).length;

  return {
    n: pontos.length, curtos, medios, longos,
    pctCurtos: pct(curtos), pctMedios: pct(medios), pctLongos: pct(longos),
    pctAte4: pct(curtos + medios),
    ganhos, pctGanhos: pct(ganhos),
    errosNos: errosNos.length, errosDecisao, errosExec, errosSemCausa: errosNos.length - errosDecisao - errosExec, errosCurtos,
    pctErrosCurtos: errosNos.length ? Math.round((errosCurtos / errosNos.length) * 100) : 0,
    df: df.length, dfAdverso, razaoDF: Number(razaoDF.toFixed(1)),
    pctPrimeiro: Math.round((primeiros / comSaqueMarcado) * 100), primeirosDentro: primeiros, saquesMarcados: meusSaques.filter((p) => p.saque === "1" || p.saque === "2" || p.saque === "df").length,
    pctProtocolo: pct(protocolo), rede, redeGanha, ataquePerdido,
    aces, acesAdv, dfAdv, nSaqueDele: saquesDele.length,
    pctPrimeiroAdv: comSaqueDele ? Math.round((saquesDele.filter((p) => p.saque === "1").length / comSaqueDele) * 100) : 0,
    nSacD: sacD.length, pctSacD: pctDe(sacD), nSacE: sacE.length, pctSacE: pctDe(sacE),
    nDevD: devD.length, pctDevD: pctDe(devD), nDevE: devE.length, pctDevE: pctDe(devE),
    nAtaque: sit("ataque").length, pctAtaque: pctDe(sit("ataque")), nContra: sit("contra").length, pctContra: pctDe(sit("contra")), nDefesa: sit("defesa").length, pctDefesa: pctDe(sit("defesa")),
    detalhe, errosDevolucao: detalhe.devolucao.nos.e, errosDevolucaoDele: detalhe.devolucao.ele.e,
    pctErrosDevolucao: detalhe.devolucao.nos.n ? Math.round((detalhe.devolucao.nos.e / detalhe.devolucao.nos.n) * 100) : 0,
    adversos: adversos.length, adversosGanhos,
    pctAdversos: adversos.length ? Math.round((adversosGanhos / adversos.length) * 100) : 0,
  };
}

function leitura(r) {
  const sinais = [];
  if (r.pctErrosCurtos >= 40)
    sinais.push(["devolucao", `${r.pctErrosCurtos}% dos seus erros aconteceram na bola 1–2. O ponto está sendo perdido antes de existir — o trabalho é de início do ponto, não de troca.`]);
  if (r.razaoDF >= 1.5 && r.df > 0)
    sinais.push(["saque", `As duplas faltas aparecem ${r.razaoDF}× mais sob placar adverso. Isso é rotina antes do saque, não mecânica.`]);
  else if (r.pctPrimeiro > 0 && r.pctPrimeiro < 55)
    sinais.push(["saque", `${r.pctPrimeiro}% de primeiro saque dentro. Abaixo da faixa que sustenta o padrão de abertura.`]);
  if (r.nSacD >= 6 && r.nSacE >= 6 && Math.abs(r.pctSacD - r.pctSacE) >= 20)
    sinais.push(["saque", `No saque, o jogador ganha ${r.pctSacD}% dos pontos pelo lado da igualdade (${r.nSacD}) e ${r.pctSacE}% pelo lado da vantagem (${r.nSacE}). A diferença está num lado só: vale olhar a direção e o plano de saque desse lado.`]);
  if (r.nDevD >= 6 && r.nDevE >= 6 && Math.abs(r.pctDevD - r.pctDevE) >= 20)
    sinais.push(["devolucao", `Contra o saque do adversário, o jogador ganha ${r.pctDevD}% pelo lado da igualdade (${r.nDevD}) e ${r.pctDevE}% pelo lado da vantagem (${r.nDevE}). Um dos lados da devolução está custando pontos.`]);
  if (r.detalhe && r.detalhe.devolucao.nos.n >= 8 && r.errosDevolucao >= 3 && r.pctErrosDevolucao >= 25)
    sinais.push(["devolucao", `Erros de devolução de saque: ${r.errosDevolucao} em ${r.detalhe.devolucao.nos.n} pontos no saque do adversário (${r.pctErrosDevolucao}%). O ponto está sendo perdido na primeira bola em jogo: vale olhar a posição de espera, o split step e o alvo da devolução.`]);
  if (r.errosDecisao > r.errosExec && r.errosNos >= 5)
    sinais.push(["fundo", `Entre os ${r.errosDecisao + r.errosExec} erros classificados, ${r.errosDecisao} são de decisão e ${r.errosExec} de execução.${r.errosSemCausa > 0 ? ` Há ${r.errosSemCausa} sem classificação.` : ""}`]);
  if (r.errosExec > r.errosDecisao * 2 && r.errosNos >= 5)
    sinais.push(["fundo", `Entre os ${r.errosDecisao + r.errosExec} erros classificados, ${r.errosExec} são de execução e ${r.errosDecisao} de decisão.${r.errosSemCausa > 0 ? ` Há ${r.errosSemCausa} sem classificação.` : ""}`]);
  if (r.pctProtocolo > 0 && r.pctProtocolo < 70)
    sinais.push(["mental", `Protocolo presente em ${r.pctProtocolo}% dos pontos. Abaixo de 80% o intervalo de 20 segundos está sendo desperdiçado.`]);
  if (r.ataquePerdido >= 4)
    sinais.push(["rede", `${r.ataquePerdido} bolas com demanda de ataque não convertidas. É a assimetria clássica: reconhecer defesa é fácil, decidir atacar é o que custa.`]);
  if (r.pctLongos >= 35)
    sinais.push(["movimentacao", `${r.pctLongos}% dos pontos passaram de cinco bolas. Acima do que os dados do circuito mostram — o tempo do adversário não está sendo reduzido.`]);
  return sinais;
}

const JANELA_MOMENTO = 6;
function serieMomento(pontos, cfg) {
  let e = cfg && cfg.formato ? placarInicial(cfg.formato, cfg.saca, cfg.semVantagem, cfg.superTiebreakDecisivo) : null;
  let saldo = 0;
  return pontos.map((p, i) => {
    const set = e ? e.sets.length : 0;
    saldo += p.nos ? 1 : -1;
    const mom = pontos.slice(Math.max(0, i - JANELA_MOMENTO + 1), i + 1).reduce((s, q) => s + (q.nos ? 1 : -1), 0);
    if (e) e = aplicaPonto(e, p.nos);
    return { n: i + 1, nos: !!p.nos, saldo, mom, pos: Math.max(mom, 0), neg: Math.min(mom, 0), set, antes: p.placarAntes || "" };
  });
}

const ZONAS = [
  ["D-REDE", "Dir · rede"], ["D-APR", "Dir · aprox."], ["D-FUNDO", "Dir · fundo"],
  ["E-REDE", "Esq · rede"], ["E-APR", "Esq · aprox."], ["E-FUNDO", "Esq · fundo"],
];
function zonasDe(pontos) {
  const z = {};
  (pontos || []).forEach((p) => {
    if (!p.zona || !ZONAS.some((x) => x[0] === p.zona)) return;
    z[p.zona] = z[p.zona] || { n: 0, ganhos: 0 };
    z[p.zona].n++;
    if (p.nos) z[p.zona].ganhos++;
  });
  return z;
}

function contagemDosPontos(pontos, cfg) {
  let e = cfg && cfg.formato ? placarInicial(cfg.formato, cfg.saca, cfg.semVantagem, cfg.superTiebreakDecisivo) : null;
  return pontos.map((p) => {
    if (!e) return ["", p.fim || ""];
    const antes = e, depois = aplicaPonto(e, p.nos);
    e = depois;
    if (depois.sets.length > antes.sets.length) return ["Set " + depois.sets[depois.sets.length - 1].join("-"), p.fim || ""];
    if (depois.g[0] + depois.g[1] > antes.g[0] + antes.g[1]) return ["Game " + depois.g[0] + "-" + depois.g[1], p.fim || ""];
    return [rotuloPontos(depois), p.fim || ""];
  });
}
/* Placar completo para a página da família: refeito a partir dos pontos marcados (sets fechados, games, pontos do game, quem saca). */
function placarDoResumo(sc) {
  const pts = (sc && sc.pontos) || [], cfg = (sc && sc.cfg) || {};
  if (!cfg.formato) return null;
  let e = placarInicial(cfg.formato, cfg.saca === "ele" ? "ele" : "nos", !!cfg.semVantagem, !!cfg.superTiebreakDecisivo);
  pts.forEach((p) => { e = aplicaPonto(e, !!p.nos); });
  return {
    sets: e.sets.map((s) => [s[0], s[1]]), games: [e.g[0], e.g[1]], pontos: e.fim ? "" : rotuloPontos(e), tiebreak: !!e.tiebreak,
    sacador: e.fim ? "" : (quemSaca(e) === "nos" ? "atleta" : "adversario"), fim: !!e.fim, vencedor: e.fim ? (e.vencedor === "nos" ? "atleta" : "adversario") : "",
  };
}
function montarResumoPublico(reg, aluno) {
  const sc = reg.scout, serie = serieMomento(sc.pontos || [], sc.cfg), sinais = leitura(sc), contagem = contagemDosPontos(sc.pontos || [], sc.cfg);
  return {
    atleta: String(aluno.nome || "Atleta").trim().split(/\s+/)[0].slice(0, 40),
    data: reg.data, torneio: reg.torneio && reg.torneio !== "jogo-treino" ? String(reg.torneio).slice(0, 80) : "",
    resultado: reg.resultado || "", concluida: !!reg.concluida, placar: placarDoResumo(sc),
    n: sc.n, ganhos: sc.ganhos, pctGanhos: sc.pctGanhos,
    bolas: { pctCurtos: sc.pctCurtos, pctMedios: sc.pctMedios, pctLongos: sc.pctLongos, pctAte4: sc.pctAte4 },
    numeros: { errosNos: sc.errosNos, errosDecisao: sc.errosDecisao, errosExec: sc.errosExec, df: sc.df, pctProtocolo: sc.pctProtocolo, rede: sc.rede, redeGanha: sc.redeGanha, ataquePerdido: sc.ataquePerdido, pctAdversos: sc.pctAdversos,
      pctPrimeiro: sc.pctPrimeiro, aces: sc.aces, acesAdv: sc.acesAdv, dfAdv: sc.dfAdv, pctPrimeiroAdv: sc.pctPrimeiroAdv,
      pctSacD: sc.nSacD ? sc.pctSacD : 0, nSacD: sc.nSacD, pctSacE: sc.nSacE ? sc.pctSacE : 0, nSacE: sc.nSacE, pctDevD: sc.nDevD ? sc.pctDevD : 0, nDevD: sc.nDevD, pctDevE: sc.nDevE ? sc.pctDevE : 0, nDevE: sc.nDevE,
      nAtaque: sc.nAtaque, pctAtaque: sc.pctAtaque, nContra: sc.nContra, pctContra: sc.pctContra, nDefesa: sc.nDefesa, pctDefesa: sc.pctDefesa },
    detalhe: sc.detalhe || resume(sc.pontos || []).detalhe, observacaoFinal: String(reg.observacaoFinal || "").trim().slice(0, 1200),
    nivelAdversario: NIVEIS_ADVERSARIO.some((x) => x[0] === reg.nivelAdversario) ? reg.nivelAdversario : "", mental: mentalLimpo(reg.mental),
    zonas: zonasDe(sc.pontos), serie: serie.map((x, i) => [x.nos ? 1 : 0, x.set, contagem[i][0], contagem[i][1]]), sinais: sinais.map((s) => s[1]),
  };
}
/* Link do aluno (aluno.html): os jogos com scout entram lá com o mesmo resumo da página da família. As contas desse resumo
   moram aqui no app, então o app guarda os resumos de cada jogador que tem link num documento à parte
   (orgs/{org}/dados/mty:paraAluno:v1:{alunoId}), que ver-aluno.js lê. Só regrava quando algum jogo muda. */
const enviadosParaAluno = {};
async function publicarResumosParaAlunos(alunos) {
  if (!db) return;
  const org = await organizacao();
  if (!org) return;
  for (const a of alunos || []) {
    if (!a || !a.linkToken || !a.id) continue;
    const jogos = (a.registros || []).filter((r) => r.tipo === "jogo" && r.scout).sort((x, y) => String(x.data || "").localeCompare(String(y.data || "")));
    const assinatura = jogos.map((r) => [r.id, r.data, (r.scout.pontos || []).length, r.scout.n, r.resultado, r.concluida, (r.observacaoFinal || "").length, r.nivelAdversario].join(":")).join("|");
    const chave = org + "|" + a.id;
    if (enviadosParaAluno[chave] === assinatura) continue;
    const lista = [];
    jogos.forEach((r) => { try { lista.push({ id: r.id, video: r.origem === "video", ...montarResumoPublico(r, a) }); } catch (e) { /* jogo sem dados suficientes para o resumo */ } });
    let valor = JSON.stringify({ jogos: lista, atualizadoEm: new Date().toISOString() });
    while (valor.length > 900000 && lista.length > 1) { lista.shift(); valor = JSON.stringify({ jogos: lista, atualizadoEm: new Date().toISOString() }); }
    try {
      await db.collection("orgs").doc(org).collection("dados").doc("mty:paraAluno:v1:" + a.id).set({ value: valor, atualizado: Date.now() });
      enviadosParaAluno[chave] = assinatura;
    } catch (e) { console.error("resumos do link do aluno:", e && e.message); }
  }
}

var motor = { placarInicial: placarInicial, aplicaPonto: aplicaPonto, rotuloPontos: rotuloPontos, ehAdverso: ehAdverso, quemSaca: quemSaca, ladoDoSaque: ladoDoSaque, ROTULO_LADO: ROTULO_LADO, SITUACOES: SITUACOES, GOLPES: GOLPES, DIRECOES: DIRECOES, DIRECOES_SAQUE: DIRECOES_SAQUE, QUALIDADES_DEVOLUCAO: QUALIDADES_DEVOLUCAO, NIVEIS_ADVERSARIO: NIVEIS_ADVERSARIO, ESCALAS_MENTAIS: ESCALAS_MENTAIS, DECISOES: DECISOES, numeroDoGame: numeroDoGame, numeroDoSet: numeroDoSet, mentalLimpo: mentalLimpo, erroDeDevolucao: erroDeDevolucao, erroDeDevolucaoDele: erroDeDevolucaoDele, ZONAS: ZONAS, resume: resume, leitura: leitura, montarResumoPublico: montarResumoPublico, serieMomento: serieMomento, contagemDosPontos: contagemDosPontos, zonasDe: zonasDe };
if (typeof module !== "undefined" && module.exports) module.exports = motor; else raiz.QLScoutMotor = motor;
})(typeof window !== "undefined" ? window : this);
