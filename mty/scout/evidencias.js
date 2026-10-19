/* Planejamento que melhora com os dados · Tecnologia QuadraLab.
   Junta biomecânica (aluno.movimentos), jogos com scout (aluno.registros) e as decisões do treinador (aluno.revisoesPlano)
   em ACHADOS, transforma os que se repetem em PROPOSTAS DE AJUSTE do plano (o treinador aceita, recusa ou adia) e confere depois se o ajuste funcionou.
   Funções puras: o app entrega o catálogo de exercícios em ctx.exercicios(area, n). Nada muda no plano sozinho.
   As referências abaixo são provisórias (metas por área do método e regras práticas) e podem ser ajustadas num só lugar. */
(function (raiz, fab) {
  if (typeof module === "object" && module.exports) module.exports = fab(require("./movimento-motor.js"));
  else raiz.QLEvidencias = fab(raiz.QLBiomec);
})(this, function (B) {
  var DIA = 86400000;
  var REF = {
    primeiroSaqueMin: 60,        // meta "1º saque dentro ≥ 60%" da área Saque do método
    duplasFaltasMedia: 3,        // duplas faltas por jogo
    devolucaoErrosPct: 30,       // % de pontos no saque dele perdidos por erro de devolução
    decisaoDomina: 0.55,         // parcela dos erros que são de decisão (ou de execução)
    errosMinimos: 6,             // erros somados nos jogos analisados, para a leitura valer
    mentalBaixo: 2.5,            // média do "mental no game" (1 a 5)
    jogosMin: 2,                 // mínimo de jogos para uma leitura; 3 ou mais = confiança alta
    analisesMin: 2,              // mínimo de análises do mesmo golpe para uma leitura
    medicaoVelhaDias: 21,        // análise do golpe em foco mais velha que isso pede nova medição
    jogoVelhoDias: 30,
    cooldown: { pendente: 9999, aceita: 21, recusada: 30, adiada: 7 },
    maxPendentes: 5, maxNovas: 3
  };
  var NOME_GOLPE = { forehand: "Forehand", backhand: "Backhand", saque: "Saque" };
  var AREA_DO_GOLPE = { forehand: "fundo", backhand: "fundo", saque: "saque" };

  function t(iso) { var x = Date.parse(iso); return isFinite(x) ? x : 0; }
  function ordenar(l) { return (l || []).slice().sort(function (a, b) { return t(a.criadoEm) - t(b.criadoEm); }); }
  function media(v) { return v.length ? v.reduce(function (s, x) { return s + x; }, 0) / v.length : 0; }
  function arred(x) { return Math.round(x * 10) / 10; }
  function chaveGrupo(m) { return m.golpe + (m.golpe === "backhand" ? "|" + (m.emp || "") : ""); }
  function nomeGrupo(m) { return NOME_GOLPE[m.golpe] + (m.golpe === "backhand" ? (String(m.emp) === "1" ? " (uma mão)" : " (duas mãos)") : ""); }
  function jogosScout(aluno) {
    return (aluno.registros || []).filter(function (r) { return r.tipo === "jogo" && r.scout && r.scout.n > 0 && !r.origemCompeticao; })
      .sort(function (a, b) { return String(a.data) < String(b.data) ? -1 : 1; });
  }
  function forcaPor(n) { return n >= 3 ? "alta" : "media"; }

  /* ── achados ── */
  function achadosBiomecanica(aluno) {
    var grupos = {}, ordem = [], out = [];
    ordenar(aluno.movimentos).forEach(function (m) { var k = chaveGrupo(m); if (!grupos[k]) { grupos[k] = []; ordem.push(k); } grupos[k].push(m); });
    ordem.forEach(function (k) {
      var g = grupos[k], ult = g[g.length - 1], janela = g.slice(-3), nomes = {};
      if (g.length < REF.analisesMin) return;
      janela.forEach(function (m) { m.itens.forEach(function (i) { nomes[i.n] = 1; }); });
      Object.keys(nomes).forEach(function (nome) {
        var seq = janela.map(function (m) { return m.itens.filter(function (i) { return i.n === nome && i.s !== "nao_avaliavel"; })[0] || null; }).filter(Boolean);
        if (seq.length < REF.analisesMin) return;
        var ultimo = seq[seq.length - 1], anterior = seq[seq.length - 2], nAt = seq.filter(function (i) { return i.s === "atencao"; }).length;
        var base = { fonte: "biomecanica", golpe: ult.golpe, emp: ult.emp || "", grupo: nomeGrupo(ult), item: nome, area: AREA_DO_GOLPE[ult.golpe], tipo: "tecnico", ultimaEm: ult.criadoEm, valor: ultimo.v, unidade: ultimo.u, ref: ultimo.r, analises: seq.length };
        if (ultimo.s === "atencao" && anterior.s === "atencao") {
          out.push(Object.assign({ id: "bio:" + k + ":" + nome, sentido: "problema", forca: forcaPor(nAt),
            titulo: nomeGrupo(ult) + ": " + nome,
            texto: "Fora da referência em " + nAt + " das últimas " + seq.length + " análises (última: " + (ultimo.v == null ? "—" : arred(ultimo.v) + (ultimo.u || "")) + ", referência " + ultimo.r + ")." }, base));
        } else if (ultimo.s === "ok" && anterior.s === "atencao") {
          out.push(Object.assign({ id: "bio:" + k + ":" + nome, sentido: "progresso", forca: "media",
            titulo: nomeGrupo(ult) + ": " + nome, texto: "Voltou para dentro da referência na última análise (antes estava em atenção)." }, base));
        }
      });
    });
    return out;
  }

  function achadosScout(aluno) {
    var jogos = jogosScout(aluno), ult = jogos.slice(-3), out = [];
    if (ult.length < REF.jogosMin) return out;
    var f = forcaPor(ult.length), sc = function (r) { return r.scout; };
    var prim = ult.map(sc).filter(function (s) { return s.pctPrimeiro > 0; }).map(function (s) { return s.pctPrimeiro; });
    if (prim.length >= REF.jogosMin && media(prim) < REF.primeiroSaqueMin)
      out.push({ id: "sc:primeiro-saque", fonte: "scout", area: "saque", tipo: "tecnico", sentido: "problema", forca: forcaPor(prim.length), titulo: "1º saque dentro abaixo da meta",
        texto: "Média de " + arred(media(prim)) + "% nos últimos " + prim.length + " jogos (meta do método: ≥ " + REF.primeiroSaqueMin + "%).", metrica: "pctPrimeiro", valor: arred(media(prim)), meta: REF.primeiroSaqueMin });
    var dfs = ult.map(sc).map(function (s) { return s.df || 0; });
    if (media(dfs) >= REF.duplasFaltasMedia)
      out.push({ id: "sc:duplas-faltas", fonte: "scout", area: "saque", tipo: "tecnico", sentido: "problema", forca: f, titulo: "Duplas faltas acima do esperado",
        texto: "Média de " + arred(media(dfs)) + " duplas faltas por jogo nos últimos " + ult.length + " jogos.", metrica: "df", valor: arred(media(dfs)), meta: REF.duplasFaltasMedia - 1, sentidoMeta: "descer" });
    var dev = ult.map(sc).filter(function (s) { return s.nSaqueDele > 0; }).map(function (s) { return s.pctErrosDevolucao || 0; });
    if (dev.length >= REF.jogosMin && media(dev) >= REF.devolucaoErrosPct)
      out.push({ id: "sc:devolucao", fonte: "scout", area: "devolucao", tipo: "tecnico", sentido: "problema", forca: forcaPor(dev.length), titulo: "Erros de devolução frequentes",
        texto: "Em média " + arred(media(dev)) + "% dos pontos no saque do adversário terminam em erro de devolução.", metrica: "pctErrosDevolucao", valor: arred(media(dev)), meta: REF.devolucaoErrosPct - 5, sentidoMeta: "descer" });
    var dec = 0, exe = 0;
    ult.forEach(function (r) { dec += r.scout.errosDecisao || 0; exe += r.scout.errosExec || 0; });
    if (dec + exe >= REF.errosMinimos) {
      if (dec / (dec + exe) >= REF.decisaoDomina)
        out.push({ id: "sc:decisao", fonte: "scout", area: "tatica", tipo: "tatico", sentido: "problema", forca: f, titulo: "Erros por decisão predominam",
          texto: Math.round(dec / (dec + exe) * 100) + "% dos erros dos últimos " + ult.length + " jogos foram de decisão (" + dec + " de " + (dec + exe) + ")." });
      else if (exe / (dec + exe) >= REF.decisaoDomina)
        out.push({ id: "sc:execucao", fonte: "scout", area: "fundo", tipo: "tecnico", sentido: "problema", forca: f, titulo: "Erros por execução predominam",
          texto: Math.round(exe / (dec + exe) * 100) + "% dos erros dos últimos " + ult.length + " jogos foram de execução (" + exe + " de " + (dec + exe) + ")." });
    }
    var baixos = 0, comMental = 0;
    ult.forEach(function (r) {
      var vals = Object.keys((r.mental && r.mental.jogo) || {}).map(function (g) { return +r.mental.jogo[g]; }).filter(function (v) { return v >= 1 && v <= 5; });
      if (vals.length >= 2) { comMental++; if (media(vals) <= REF.mentalBaixo) baixos++; }
    });
    if (comMental >= REF.jogosMin && baixos >= REF.jogosMin)
      out.push({ id: "sc:mental", fonte: "scout", area: "mental", tipo: "mental", sentido: "problema", forca: forcaPor(baixos), titulo: "Mental baixo durante os jogos",
        texto: "Em " + baixos + " dos últimos " + comMental + " jogos com avaliação, a média do mental nos games ficou em " + REF.mentalBaixo + " ou menos (escala de 1 a 5)." });
    return out;
  }

  /* cruza as fontes: execução no scout + problema técnico no vídeo = leitura mais forte; execução no scout sem problema no vídeo = hipótese física/mental */
  function cruzar(achados, aluno) {
    var exec = achados.filter(function (a) { return a.id === "sc:execucao"; })[0];
    var bio = achados.filter(function (a) { return a.fonte === "biomecanica" && a.sentido === "problema"; });
    if (exec && bio.length) bio.forEach(function (b) { b.cruzado = true; b.forca = "alta"; b.texto += " Os jogos confirmam: erros por execução predominam."; });
    if (exec && !bio.length && (aluno.movimentos || []).length >= REF.analisesMin)
      achados.push({ id: "hip:fisico-mental", fonte: "cruzamento", area: "mental", tipo: "fisico_mental", sentido: "hipotese", forca: "baixa", titulo: "Erros de execução sem causa técnica no vídeo",
        texto: "Os jogos mostram muitos erros de execução, mas as análises de vídeo estão dentro da referência. Vale observar fadiga, pressão ou ritmo antes de mexer na técnica." });
    return achados;
  }

  function achados(aluno) {
    var a = cruzar(achadosBiomecanica(aluno).concat(achadosScout(aluno)), aluno), peso = { alta: 0, media: 1, baixa: 2 };
    return a.sort(function (x, y) { return (x.sentido === "problema" ? 0 : 1) - (y.sentido === "problema" ? 0 : 1) || peso[x.forca] - peso[y.forca]; });
  }

  /* ── propostas ── */
  /* Mapa checklist de vídeo → termos do catálogo de exercícios (busca em nome + método). Serve para o reforço sugerido atacar o item, não só a área. */
  var BUSCA_ITEM = [
    [/lançamento|lancamento/i, "lançamento|toss|arremesso"],
    [/flexão de joelhos na armada|extensão de pernas|extensao de pernas/i, "pernas|agach|impuls|salto|armada"],
    [/cotovelo|extensão do cotovelo|altura do contato \(punho/i, "contato|ponto de impacto|cotovelo"],
    [/contato à frente|contato a frente/i, "contato|à frente|a frente"],
    [/altura do contato/i, "altura|bolas altas"],
    [/duas mãos|braço não dominante|antebraço não dominante/i, "não dominante|nao dominante|duas mãos|backhand"],
    [/rotação de ombros/i, "rota|giro|ombro"],
    [/split step/i, "split"],
    [/flexão de joelhos no giro|extensão dos joelhos|flexão de tronco/i, "agach|joelho|pernas|tronco|flex"],
    [/seguimento/i, "seguimento|finaliza"]
  ];
  function buscaDoItem(item) {
    for (var i = 0; i < BUSCA_ITEM.length; i++) if (BUSCA_ITEM[i][0].test(item || "")) return new RegExp(BUSCA_ITEM[i][1], "i");
    return null;
  }
  /* Aprendizado entre jogadores: ajustes aceitos que funcionaram (ou não) ensinam quais exercícios priorizar para o mesmo item/métrica. Fica só na memória do app. */
  function chaveAprendizado(r) { var e = r.esperado || {}; return e.item || e.metrica || null; }
  function aprendizado(alunos) {
    var pontos = {};
    (alunos || []).forEach(function (a) {
      var ef = efeitos(a);
      (a.revisoesPlano || []).forEach(function (r) {
        var k = chaveAprendizado(r), res = ef[r.id];
        if (!k || !res || !r.aplicada || !r.acao || !r.acao.ex) return;
        var d = res.estado === "funcionou" ? 1 : res.estado === "sem_melhora" ? -1 : 0;
        if (!d) return;
        pontos[k] = pontos[k] || {};
        r.acao.ex.forEach(function (c) { pontos[k][c] = (pontos[k][c] || 0) + d; });
      });
    });
    return pontos;
  }
  function escolher(ctx, area, achado, n) {
    var cand = ctx.exercicios ? ctx.exercicios(area, 12, achado) : [], pts = (ctx.aprendizado || {})[achado.item || achado.metrica] || {};
    return cand.map(function (c, i) { return { c: c, i: i, p: pts[c] || 0 }; }).sort(function (x, y) { return y.p - x.p || x.i - y.i; }).filter(function (x, i, l) { return x.p > -1 || i < n; }).slice(0, n).map(function (x) { return x.c; });
  }
  function dicas(achado) {
    var d = B && B.INTERV && B.INTERV[achado.item];
    return d ? d.ex.slice(0, 3) : [];
  }
  function proposta(a, o) {
    return Object.assign({ id: "rv" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), criadoEm: o.agora, status: "pendente", achadoId: a.id, chave: o.chave, fonte: a.fonte, forca: a.forca,
      titulo: o.titulo, motivo: a.texto, tipo: o.tipo, acao: o.acao, dicas: o.dicas || [], esperado: o.esperado || null, linhaBase: o.linhaBase || null }, {});
  }
  function bloqueada(revisoes, chave, agora) {
    return (revisoes || []).some(function (r) {
      if (r.chave !== chave) return false;
      var dias = (t(agora) - t(r.decididoEm || r.criadoEm)) / DIA;
      if (r.status === "pendente") return true;
      return dias < (REF.cooldown[r.status === "aceita" ? "aceita" : r.status === "recusada" ? "recusada" : "adiada"] || 0);
    });
  }
  function novasPropostas(aluno, ctx) {
    ctx = ctx || {}; var agora = ctx.agora || new Date().toISOString(), rev = aluno.revisoesPlano || [], out = [];
    var pend = rev.filter(function (r) { return r.status === "pendente"; }).length;
    if (pend >= REF.maxPendentes) return out;
    var ach = achados(aluno), ex = function (area, n, a) { return escolher(ctx, area, a || {}, n); };
    function tentar(chave, fazer) { if (out.length + pend < REF.maxPendentes && out.length < REF.maxNovas && !bloqueada(rev, chave, agora)) out.push(fazer(chave)); }
    ach.forEach(function (a) {
      if (a.sentido === "problema" && a.fonte === "biomecanica" && a.forca !== "baixa")
        tentar("reforco:" + a.id, function (c) {
          return proposta(a, { chave: c, agora: agora, tipo: "reforco", titulo: "Reforçar " + a.titulo, dicas: dicas(a),
            acao: { tipo: "reforco", area: a.area, ex: ex(a.area, 3, a), bloco: ctx.blocoAtual || null },
            esperado: { fonte: "biomecanica", golpe: a.golpe, emp: a.emp, item: a.item, meta: "ok" }, linhaBase: { s: "atencao", v: a.valor == null ? null : a.valor } });
        });
      else if (a.sentido === "problema" && a.fonte === "scout" && (a.area === "saque" || a.area === "devolucao" || a.area === "fundo"))
        tentar("reforco:" + a.id, function (c) {
          return proposta(a, { chave: c, agora: agora, tipo: "reforco", titulo: "Reforçar: " + a.titulo.charAt(0).toLowerCase() + a.titulo.slice(1),
            acao: { tipo: "reforco", area: a.area, ex: ex(a.area, 3, a), bloco: ctx.blocoAtual || null },
            esperado: a.metrica ? { fonte: "scout", metrica: a.metrica, meta: a.meta, sentido: a.sentidoMeta || "subir" } : { fonte: "scout", metrica: "errosExec", sentido: "descer" },
            linhaBase: a.metrica ? { valor: a.valor } : null });
        });
      else if (a.id === "sc:decisao")
        tentar("foco:" + a.id, function (c) {
          return proposta(a, { chave: c, agora: agora, tipo: "foco", titulo: "Dar mais peso à decisão nas situações de jogo",
            acao: { tipo: "foco", area: "tatica", texto: "Incluir situações de jogo com escolha de padrão de ponto (por exemplo, jogos condicionados) em pelo menos 1 aula por semana, e pedir ao jogador que declare a decisão antes do ponto." },
            esperado: { fonte: "scout", metrica: "errosDecisao", sentido: "descer" }, linhaBase: { valor: arred(media(jogosScout(aluno).slice(-3).map(function (r) { return r.scout.errosDecisao || 0; }))) } });
        });
      else if (a.id === "sc:mental")
        tentar("foco:" + a.id, function (c) {
          return proposta(a, { chave: c, agora: agora, tipo: "foco", titulo: "Trabalhar rotina e preparo mental nos treinos",
            acao: { tipo: "foco", area: "mental", texto: "Incluir a rotina entre pontos e uma conversa curta de mental no início de cada aula; registrar o mental por game no próximo jogo. Rever a carga competitiva se o jogador estiver sobrecarregado." },
            esperado: null });
        });
      else if (a.id === "hip:fisico-mental")
        tentar("medicao:" + a.id, function (c) {
          return proposta(a, { chave: c, agora: agora, tipo: "medicao", titulo: "Observar fadiga e pressão antes de mexer na técnica",
            acao: { tipo: "medicao", texto: "Nos próximos treinos, observar se os erros de execução crescem no final da sessão ou em situação de pressão, e marcar o mental no próximo jogo." }, esperado: null });
        });
      else if (a.sentido === "progresso")
        tentar("progresso:" + a.id, function (c) {
          return proposta(a, { chave: c, agora: agora, tipo: "progresso", titulo: "Critério técnico atingido: " + a.titulo,
            acao: { tipo: "progresso", texto: "O item voltou para a referência. Considere encerrar o reforço desse ponto e seguir o bloco." }, esperado: null });
        });
    });
    // horizonte móvel: perto do fim das aulas planejadas, com evidências novas, propõe renovar as próximas semanas já com os dados
    if (ctx.aulasRestantes != null && ctx.aulasRestantes <= 3 && ach.some(function (a) { return a.forca !== "baixa" && a.sentido !== "progresso"; }))
      tentar("horizonte", function (c) {
        return proposta({ id: "horizonte", fonte: "cruzamento", forca: "media", texto: ctx.aulasRestantes === 0 ? "As aulas planejadas acabaram e há evidências recentes dos vídeos e dos jogos." : "Restam " + ctx.aulasRestantes + (ctx.aulasRestantes === 1 ? " aula" : " aulas") + " do plano e há evidências recentes dos vídeos e dos jogos." },
          { chave: c, agora: agora, tipo: "horizonte", titulo: "Renovar as próximas semanas com os dados atuais",
            acao: { tipo: "horizonte", texto: "Gere o próximo ciclo na aba Plano: as evidências e os ajustes que você decidiu já entram no gerador. Aceitar aqui só registra a decisão." }, esperado: null });
      });
    // medições combinadas: o golpe em foco sem análise recente, ou sem jogo recente
    var ultimaPorGolpe = {};
    ordenar(aluno.movimentos).forEach(function (m) { ultimaPorGolpe[chaveGrupo(m)] = m; });
    ach.filter(function (a) { return a.sentido === "problema" && a.fonte === "biomecanica"; }).forEach(function (a) {
      var k = a.golpe + (a.golpe === "backhand" ? "|" + a.emp : ""), u = ultimaPorGolpe[k];
      if (u && (t(agora) - t(u.criadoEm)) / DIA >= REF.medicaoVelhaDias)
        tentar("medicao:video:" + k, function (c) {
          return proposta({ id: "med:" + k, fonte: "biomecanica", forca: "media", texto: "A última análise de " + nomeGrupo(u) + " tem " + Math.round((t(agora) - t(u.criadoEm)) / DIA) + " dias e há pontos em atenção." },
            { chave: c, agora: agora, tipo: "medicao", titulo: "Gravar novo vídeo de " + nomeGrupo(u), acao: { tipo: "medicao", texto: "Gravar 1 " + NOME_GOLPE[u.golpe].toLowerCase() + " ao final da próxima aula para conferir a evolução." } });
        });
    });
    var jogos = jogosScout(aluno);
    if (jogos.length && (ach.length) && (t(agora) - t(jogos[jogos.length - 1].data)) / DIA >= REF.jogoVelhoDias)
      tentar("medicao:jogo", function (c) {
        return proposta({ id: "med:jogo", fonte: "scout", forca: "media", texto: "O último jogo com scout tem mais de " + REF.jogoVelhoDias + " dias." },
          { chave: c, agora: agora, tipo: "medicao", titulo: "Marcar o próximo jogo (scout)", acao: { tipo: "medicao", texto: "Marcar o scout do próximo jogo para atualizar a leitura do plano." } });
      });
    return out;
  }

  /* ── efeito dos ajustes aceitos ── */
  function efeitos(aluno) {
    var res = {};
    (aluno.revisoesPlano || []).forEach(function (r) {
      if (r.status !== "aceita" || !r.esperado) return;
      var e = r.esperado, desde = t(r.decididoEm);
      if (e.fonte === "biomecanica") {
        var novas = ordenar(aluno.movimentos).filter(function (m) { return m.golpe === e.golpe && String(m.emp || "") === String(e.emp || "") && t(m.criadoEm) > desde; });
        if (!novas.length) { res[r.id] = { estado: "aguardando", texto: "Aguardando uma nova análise de " + NOME_GOLPE[e.golpe].toLowerCase() + "." }; return; }
        var it = novas[novas.length - 1].itens.filter(function (i) { return i.n === e.item; })[0];
        if (!it || it.s === "nao_avaliavel") { res[r.id] = { estado: "aguardando", texto: "O item não pôde ser medido na última análise." }; return; }
        if (it.s === "ok") res[r.id] = { estado: "funcionou", texto: "Voltou para a referência na análise de " + new Date(novas[novas.length - 1].criadoEm).toLocaleDateString("pt-BR") + "." };
        else if (novas.length >= 2) res[r.id] = { estado: "sem_melhora", texto: "Ainda fora da referência após " + novas.length + " análises. Vale revisar o exercício." };
        else res[r.id] = { estado: "aguardando", texto: "Ainda fora da referência; aguardando mais uma análise." };
      } else if (e.fonte === "scout" && e.metrica) {
        var js = jogosScout(aluno).filter(function (j) { return t(j.data) > desde; });
        if (js.length < REF.jogosMin) { res[r.id] = { estado: "aguardando", texto: "Aguardando mais " + (REF.jogosMin - js.length) + (REF.jogosMin - js.length === 1 ? " jogo" : " jogos") + " com scout." }; return; }
        var m = media(js.map(function (j) { return j.scout[e.metrica] || 0; })), base = r.linhaBase && r.linhaBase.valor, desce = e.sentido === "descer";
        var bom = e.meta != null ? (desce ? m <= e.meta : m >= e.meta) : (base != null && (desce ? m < base : m > base));
        res[r.id] = bom ? { estado: "funcionou", texto: "Média de " + arred(m) + " nos jogos seguintes (antes: " + (base == null ? "—" : base) + ")." } : { estado: "sem_melhora", texto: "Média de " + arred(m) + " nos jogos seguintes (antes: " + (base == null ? "—" : base) + ")." };
      }
    });
    return res;
  }

  /* ── texto para o gerador de planejamento (IA) ── */
  function textoParaPrompt(aluno, agora) {
    var ach = achados(aluno).filter(function (a) { return a.forca !== "baixa" || a.sentido === "hipotese"; }), rev = aluno.revisoesPlano || [], L = [];
    var ef = efeitos(aluno);
    if (ach.length) {
      L.push("EVIDÊNCIAS RECENTES (vídeos de biomecânica e jogos com scout) — só o que se repete em mais de uma medição:");
      ach.slice(0, 8).forEach(function (a) { L.push("· [" + a.fonte + " · " + a.tipo + " · confiança " + a.forca + "] " + a.titulo + ": " + a.texto); });
    }
    var aceitas = rev.filter(function (r) { return r.status === "aceita" && r.tipo !== "medicao"; }).slice(-5);
    if (aceitas.length) {
      L.push("AJUSTES JÁ DECIDIDOS PELO TREINADOR (mantenha coerência com eles):");
      aceitas.forEach(function (r) { L.push("· " + r.titulo + (ef[r.id] ? " — " + ef[r.id].estado.replace("_", " ") + ": " + ef[r.id].texto : "")); });
    }
    var recusadas = rev.filter(function (r) { return r.status === "recusada" && (t(agora || new Date().toISOString()) - t(r.decididoEm)) / DIA < 60; }).slice(-4);
    if (recusadas.length) { L.push("SUGESTÕES QUE O TREINADOR RECUSOU (não insista nelas):"); recusadas.forEach(function (r) { L.push("· " + r.titulo); }); }
    if (!L.length) return null;
    L.push("Use estas evidências para calibrar prioridade e areaFoco dos blocos quando fizerem sentido junto com a ficha; nunca invente um número que não esteja listado aqui.");
    return L.join("\n");
  }

  /* ── metas de saída medidas pelos dados ──
     Para a área em foco do bloco, confere o que o vídeo e o scout já provam. Só indica: quem libera o bloco continua sendo o treinador. */
  function metaDaArea(aluno, areaId) {
    var ind = [], jogos = jogosScout(aluno).slice(-2), ultimaPor = {};
    ordenar(aluno.movimentos).forEach(function (m) { ultimaPor[chaveGrupo(m)] = m; });
    function video(golpes) {
      golpes.forEach(function (k) {
        var m = ultimaPor[k]; if (!m) return;
        var aten = m.itens.filter(function (i) { return i.s === "atencao"; });
        ind.push({ id: "video:" + k, fonte: "biomecanica", rotulo: "Vídeo · " + nomeGrupo(m), atingido: aten.length === 0,
          texto: aten.length ? aten.length + (aten.length === 1 ? " ponto" : " pontos") + " ainda em atenção (" + aten.slice(0, 2).map(function (i) { return i.n; }).join(", ") + ")" : "todos os pontos avaliados dentro da referência" });
      });
    }
    if (areaId === "saque") {
      var pr = jogos.map(function (r) { return r.scout.pctPrimeiro; }).filter(function (v) { return v > 0; });
      if (pr.length >= REF.jogosMin) ind.push({ id: "scout:primeiro", fonte: "scout", rotulo: "1º saque dentro (meta ≥ " + REF.primeiroSaqueMin + "%)", atingido: media(pr) >= REF.primeiroSaqueMin, texto: "média de " + arred(media(pr)) + "% nos últimos " + pr.length + " jogos" });
      video(["saque"]);
    } else if (areaId === "devolucao") {
      var dv = jogos.filter(function (r) { return r.scout.nSaqueDele > 0; }).map(function (r) { return r.scout.pctErrosDevolucao || 0; });
      if (dv.length >= REF.jogosMin) ind.push({ id: "scout:devolucao", fonte: "scout", rotulo: "Erros de devolução (apoio: ≤ " + (REF.devolucaoErrosPct - 5) + "%)", atingido: media(dv) <= REF.devolucaoErrosPct - 5, texto: "média de " + arred(media(dv)) + "% nos últimos " + dv.length + " jogos" });
    } else if (areaId === "fundo") {
      video(Object.keys(ultimaPor).filter(function (k) { return k.indexOf("forehand") === 0 || k.indexOf("backhand") === 0; }));
      var ex = jogos.length >= REF.jogosMin ? jogos.reduce(function (n, r) { return n + (r.scout.errosExec || 0); }, 0) / jogos.length : null;
      if (ex != null) ind.push({ id: "scout:exec", fonte: "scout", rotulo: "Erros de execução por jogo", atingido: null, texto: "média de " + arred(ex) + " nos últimos " + jogos.length + " jogos (acompanhar a queda)" });
    } else if (areaId === "mental") {
      var mm = jogos.map(function (r) { var v = Object.keys((r.mental && r.mental.jogo) || {}).map(function (g) { return +r.mental.jogo[g]; }).filter(function (x) { return x >= 1 && x <= 5; }); return v.length >= 2 ? media(v) : null; }).filter(function (v) { return v != null; });
      if (mm.length >= REF.jogosMin) ind.push({ id: "scout:mental", fonte: "scout", rotulo: "Mental nos games (apoio: ≥ 3)", atingido: media(mm) >= 3, texto: "média de " + arred(media(mm)) + " (escala de 1 a 5)" });
    }
    var medidos = ind.filter(function (i) { return i.atingido !== null; });
    return { indicadores: ind, sugereLiberar: medidos.length > 0 && medidos.every(function (i) { return i.atingido; }), temDados: ind.length > 0 };
  }

  function decidir(revisoes, id, status, agora) {
    return (revisoes || []).map(function (r) { return r.id === id ? Object.assign({}, r, { status: status, decididoEm: agora || new Date().toISOString() }) : r; });
  }
  function pendentes(aluno) { return (aluno.revisoesPlano || []).filter(function (r) { return r.status === "pendente"; }); }

  return { REF: REF, achados: achados, novasPropostas: novasPropostas, efeitos: efeitos, textoParaPrompt: textoParaPrompt, metaDaArea: metaDaArea, aprendizado: aprendizado, buscaDoItem: buscaDoItem, decidir: decidir, pendentes: pendentes, bloqueada: bloqueada };
});
