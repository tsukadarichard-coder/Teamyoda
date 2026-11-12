/* QuadraLab Scout: relatório dos jogos de um atleta em PDF. O documento é o mesmo do scout do treinador e do Competição
   (scout/relatorio-jogos.js, QLRelatorioJogos.gerar): gráficos de evolução, comparação de todos os dados, pontos fortes e de atenção
   e o resumo de cada jogo. Aqui só se monta a entrada a partir dos jogos guardados na conta (dados.js) e as medidas, as mesmas do Competição.
   O nome do adversário nunca entra (o relatório usa o resumo público de cada jogo). Usado pelo app e pelos testes no Node. */
(function (raiz) {
  "use strict";

  function tendencia(v, maior) {
    var n = v.length, sx = (n - 1) * n / 2, sx2 = (n - 1) * n * (2 * n - 1) / 6, sy = v.reduce(function (a, b) { return a + b; }, 0), sxy = v.reduce(function (a, b, i) { return a + i * b; }, 0), den = n * sx2 - sx * sx, inc = den ? (n * sxy - sx * sy) / den : 0, tot = inc * (n - 1), est = Math.abs(tot) < 1, mel = maior ? inc > 0 : inc < 0;
    return { media: sy / n, variacaoTotal: tot, estavel: est, melhorou: !est && mel, cor: est ? "#5B6B63" : (mel ? "#1F6B4A" : "#A6432F"), seta: est ? "→" : (inc > 0 ? "▲" : "▼") };
  }
  /* maior sequência de pontos ganhos (melhor) e perdidos (pior), pela série do resumo ([ganhou 1/0, set, ...]) */
  function sequencias(serie) {
    var melhor = 0, pior = 0, a = 0, b = 0;
    (serie || []).forEach(function (x) { if (x && x[0]) { a++; b = 0; } else { b++; a = 0; } if (a > melhor) melhor = a; if (b > pior) pior = b; });
    return { melhor: melhor, pior: pior };
  }
  function metricas(M) {
    function m1(grupo, k, rot, suf, melhor, get) { return { grupo: grupo || undefined, k: k, rot: rot, suf: suf, melhor: melhor, get: get }; }
    var m = [
      m1("O jogo", "n", "Pontos coletados", "", null, function (s) { return s.n; }),
      m1("", "pctGanhos", "Pontos ganhos", "%", true, function (s) { return s.pctGanhos; }),
      m1("", "duracaoMin", "Tempo de jogo (min)", "", null, function (s) { return s.duracaoMin || null; }),
      m1("Onde o ponto se decidiu", "pctCurtos", "Em 1–4 bolas", "%", null, function (s) { return s.pctCurtos; }),
      m1("", "pctMedios", "Em 5–9 bolas", "%", null, function (s) { return s.pctMedios; }),
      m1("", "pctLongos", "Em 10 bolas ou mais", "%", null, function (s) { return s.pctLongos; }),
      m1("Erros do atleta", "errosNos", "Erros", "", false, function (s) { return s.errosNos; }),
      m1("", "errosDecisao", "— por decisão", "", false, function (s) { return s.errosDecisao; }),
      m1("", "errosExec", "— por execução", "", false, function (s) { return s.errosExec; }),
      m1("Saque", "pctPrimeiro", "1º saque dentro", "%", true, function (s) { return s.pctPrimeiro || null; }),
      m1("", "df", "Duplas faltas", "", false, function (s) { return s.df; }),
      m1("", "aces", "Aces do atleta", "", true, function (s) { return s.aces != null ? s.aces : null; }),
      m1("", "acesAdv", "Aces do adversário", "", false, function (s) { return s.acesAdv != null ? s.acesAdv : null; }),
      m1("", "dfAdv", "Duplas faltas do adversário", "", null, function (s) { return s.dfAdv != null ? s.dfAdv : null; }),
      m1("", "pctPrimeiroAdv", "1º saque do adversário dentro", "%", null, function (s) { return s.pctPrimeiroAdv || null; }),
      m1("Lado da quadra", "pctSacD", "Ganhos no saque do atleta · igualdade", "%", true, function (s) { return s.nSacD ? s.pctSacD : null; }),
      m1("", "pctSacE", "Ganhos no saque do atleta · vantagem", "%", true, function (s) { return s.nSacE ? s.pctSacE : null; }),
      m1("", "pctDevD", "Ganhos no saque dele · igualdade", "%", true, function (s) { return s.nDevD ? s.pctDevD : null; }),
      m1("", "pctDevE", "Ganhos no saque dele · vantagem", "%", true, function (s) { return s.nDevE ? s.pctDevE : null; }),
      m1("Tipo de ponto", "pctAtaque", "Ganhos em ataque", "%", true, function (s) { return s.nAtaque ? s.pctAtaque : null; }),
      m1("", "pctContra", "Ganhos em contra-ataque", "%", true, function (s) { return s.nContra ? s.pctContra : null; }),
      m1("", "pctDefesa", "Ganhos em defesa", "%", true, function (s) { return s.nDefesa ? s.pctDefesa : null; }),
      m1("Hábitos e decisões", "redeConv", "Subidas à rede convertidas", "%", true, function (s) { return s.rede ? Math.round(s.redeGanha / s.rede * 100) : null; }),
      m1("", "ataquePerdido", "Demandas de ataque perdidas", "", false, function (s) { return s.ataquePerdido || null; }),
      m1("Sob pressão", "pctAdversos", "Ganhos em placar adverso", "%", true, function (s) { return s.pctAdversos || null; }),
      m1("Momento do jogo", "seqFavor", "Maior sequência a favor (pontos)", "", true, function (s) { return (s.serie || []).length >= 10 ? sequencias(s.serie).melhor : null; }),
      m1("", "seqContra", "Maior sequência contra (pontos)", "", false, function (s) { return (s.serie || []).length >= 10 ? sequencias(s.serie).pior : null; })
    ];
    (M.ZONAS || []).forEach(function (z, i) { m.push(m1(i === 0 ? "Mapa da quadra (saldo por zona)" : "", "zona-" + z[0], z[1], "", true, function (s) { var x = (s.zonas || {})[z[0]]; return x ? x.ganhos - (x.n - x.ganhos) : null; })); });
    return m;
  }

  /* jogos terminados do atleta com pontos suficientes, do mais antigo ao mais novo */
  function jogosDoRelatorio(M, D, st, atletaId) {
    return D.historico(st, atletaId).filter(function (j) { return D.encerrado(M, j) && j.pontos.length >= 10; }).reverse();
  }
  /* entrada de QLRelatorioJogos.gerar */
  function opcoes(M, D, st, atletaId, extra) {
    extra = extra || {};
    var a = D.atleta(st, atletaId), jogos = jogosDoRelatorio(M, D, st, atletaId).map(function (j) {
      var r = D.resumo(M, st, j), flat = Object.assign({}, r, r.numeros, r.bolas, { duracaoMin: D.duracaoMin ? D.duracaoMin(j) : null });
      return { id: j.id, data: j.data, torneio: r.torneio || "", adversario: "", resultado: r.resultado || "", concluida: r.concluida !== false, nivelAdversario: r.nivelAdversario || "", observacaoFinal: r.observacaoFinal || "", mental: r.mental || null, scout: flat };
    });
    return {
      atleta: String(a ? a.nome : "Atleta").trim().split(/\s+/)[0], jogos: jogos, metricas: metricas(M), tendencia: tendencia,
      leitura: function (s) { return (s.sinais || []).map(function (t) { return ["", t]; }); },
      detalheDe: function (r) { return r.scout.detalhe || null; }, zonasDe: function (_p, s) { return s.zonas || {}; },
      tema: "scout", // o documento sai no roxo do Scout (o padrão do módulo é o verde dos outros apps)
      cabecalhoHtml: '<div style="border-bottom:3px solid #260A3E;padding-bottom:10px;margin-bottom:16px"><div style="font-weight:800;font-size:13px;letter-spacing:.06em;color:#260A3E">QUADRALAB <span style="color:#6A12BA">SCOUT</span></div></div>',
      geradoEm: extra.geradoEm || new Date().toLocaleDateString("pt-BR"),
      notaAtleta: D.textoNotas ? D.textoNotas(a) : "",
    };
  }
  /* um jogo no formato que o relatório usa (o nome do adversário nunca entra) */
  function registroDoJogo(M, D, st, j) {
    var r = D.resumo(M, st, j), flat = Object.assign({}, r, r.numeros, r.bolas, { duracaoMin: D.duracaoMin ? D.duracaoMin(j) : null, pontos: j.pontos, cfg: j.cfg });
    return { id: j.id, data: j.data, torneio: r.torneio || "", adversario: "", resultado: r.resultado || "", concluida: r.concluida !== false, nivelAdversario: r.nivelAdversario || "", observacaoFinal: r.observacaoFinal || "",
      mental: r.mental || null, duracaoMin: D.duracaoMin ? D.duracaoMin(j) : null, scout: flat };
  }
  /* entrada de QLRelatorioJogos.gerarPartida: o relatório de UM jogo (também de jogo ainda em andamento), comparado com até 5 anteriores */
  function opcoesPartida(M, D, st, j, extra) {
    extra = extra || {};
    var base = opcoes(M, D, st, j.atletaId, extra), pl = D.placar(M, j);
    var anteriores = D.historico(st, j.atletaId).filter(function (x) { return x.id !== j.id && D.encerrado(M, x) && x.pontos.length >= 10 && (x.data + x.criadoEm) < (j.data + j.criadoEm); })
      .slice(0, 5).reverse().map(function (x) { return registroDoJogo(M, D, st, x); });
    return {
      atleta: base.atleta, reg: registroDoJogo(M, D, st, j), anteriores: anteriores, metricas: base.metricas, leitura: base.leitura, zonasDe: base.zonasDe, detalheDe: base.detalheDe,
      placarFinal: { sets: pl.sets.map(function (x) { return [x[0], x[1]]; }), games: [pl.g[0], pl.g[1]], pontos: pl.fim ? "" : M.rotuloPontos(pl), fim: !!pl.fim },
      cabecalhoHtml: base.cabecalhoHtml, geradoEm: base.geradoEm, notaAtleta: base.notaAtleta, tema: base.tema,
    };
  }

  var api = { metricas: metricas, tendencia: tendencia, sequencias: sequencias, jogosDoRelatorio: jogosDoRelatorio, opcoes: opcoes, opcoesPartida: opcoesPartida, registroDoJogo: registroDoJogo };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else raiz.QLScoutRelatorio = api;
})(typeof window !== "undefined" ? window : this);
