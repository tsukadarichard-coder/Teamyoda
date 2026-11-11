/* Alto rendimento do Team Yoda: o plano é INDIVIDUAL e a sessão coletiva nasce dos planos de quem está presente.
   Lógica pura (sem tela, sem banco), usada pelo app do professor (mty/index.html) e, numa cópia idêntica, pelo servidor
   (netlify/functions/_alto-rendimento.js, registro do atleta em viagem). Os dados moram no Firestore em:
     orgs/{org}/ar/{alunoId}              { ativo, calendario, metas, plano, planoHistorico, progresso, cargaSemanas, ajustes }
     orgs/{org}/ar/{alunoId}/registros/*  { data, origem: ct|viagem, tipo: treino|jogo, minutos, pse, ua, conteudosFeitos, … }
     orgs/{org}/ar/{alunoId}/avaliacoes/* { data, testeId, pilar, valor, obs }
     orgs/{org}/arSessoes/*               { data, duracaoMin, presentes, blocos, status: rascunho|fechada }
   Regras do Richard (11/11/2026): periodização pelo calendário de torneios com prioridade; a semana do plano segue a data;
   quem volta de viagem recupera só os conteúdos ESSENCIAIS que ficaram para trás (os outros expiram); a carga soma CT e
   viagem (minutos × PSE, em UA). */
(function (raiz) {
  "use strict";
  var DIA = 86400000;

  var PILARES = [
    { v: "tecnico", r: "Técnico" }, { v: "tatico", r: "Tático" }, { v: "fisico", r: "Físico" }, { v: "mental", r: "Mental" },
  ];
  var PRIORIDADES = {
    principal: { r: "Principal", afinacao: 2, regeneracao: 1 },
    secundario: { r: "Secundário", afinacao: 1, regeneracao: 0 },
    preparatorio: { r: "Preparatório", afinacao: 0, regeneracao: 0 },
  };
  /* fases e o alvo de carga da semana (fração dos minutos-base e PSE média esperada) */
  var FASES = {
    base: { r: "Base", vol: 1.0, pse: 5 },
    especifica: { r: "Específica", vol: 0.95, pse: 6 },
    ponte: { r: "Ponte competitiva", vol: 0.7, pse: 6 },
    precompetitiva: { r: "Pré-competitiva", vol: 0.7, pse: 7 },
    competicao: { r: "Competição", vol: 0.5, pse: 7 },
    preparatoria: { r: "Competição preparatória", vol: 0.85, pse: 6 },
    transicao: { r: "Transição", vol: 0.4, pse: 3 },
  };
  /* temas: a chave que junta atletas na sessão. Conteúdos com o mesmo tema viram um bloco coletivo. */
  var TEMAS = {
    "tec:saque": { pilar: "tecnico", r: "Saque", busca: /saque/i, familias: ["PDS", "IP", "FB"] },
    "tec:devolucao": { pilar: "tecnico", r: "Devolução", busca: /devolu/i, familias: ["IP", "FB"] },
    "tec:fundo": { pilar: "tecnico", r: "Fundo de quadra", busca: /cruzad|paralel|profund|fundo|topspin/i, familias: ["DC", "PDB", "FB", "DT"] },
    "tec:rede": { pilar: "tecnico", r: "Transição e rede", busca: /voleio|smash|aproxima|approach|rede/i, familias: ["PDR", "AT", "FB"] },
    "ip:inicio": { pilar: "tecnico", r: "Início do ponto (saque, devolução e a bola seguinte)", busca: /saque|devolu/i, familias: ["IP", "PDS"] },
    "tat:situacao": { pilar: "tatico", r: "Situação de jogo (ler e decidir)", busca: /./, familias: ["DT", "IP", "PDB", "AT", "PDR"], situacao: true },
    "tat:padrao": { pilar: "tatico", r: "Padrões táticos", busca: /./, familias: ["PT", "TR", "DT"] },
    "tat:plano": { pilar: "tatico", r: "Plano de jogo e adversários", busca: /./, familias: ["JA", "ADV"] },
    "fis:forca": { pilar: "fisico", r: "Força e potência", busca: /força|potên|salto|medicine|elást/i, familias: ["CF"] },
    "fis:velocidade": { pilar: "fisico", r: "Velocidade e agilidade", busca: /veloc|agil|sprint|reação|split/i, familias: ["MV", "CF"] },
    "fis:resistencia": { pilar: "fisico", r: "Resistência específica", busca: /resist|interval|série|contínu/i, familias: ["CF", "MV"] },
    "fis:regenerativo": { pilar: "fisico", r: "Regenerativo e mobilidade", busca: /mobil|along|regener|solt/i, familias: ["CO", "MV", "CF"] },
    "men:rotina": { pilar: "mental", r: "Rotina entre pontos", busca: /rotina|protocolo|respir/i, familias: ["DM"] },
    "men:placar": { pilar: "mental", r: "Decisão sob placar", busca: /placar|press|tie|break/i, familias: ["DM", "JA"] },
    "jogo:torneio": { pilar: "tatico", r: "Jogos do torneio", foraDoCT: true },
    "men:revisao": { pilar: "mental", r: "Revisão do torneio (o que funcionou, o que treinar)", individual: true },
  };
  /* o que cada fase pede por semana: [tema, vezes, essencial, tipo] — tipo "individual" não junta atletas */
  var MODELO = {
    base: [["tec:A1", 2, true], ["tec:A2", 1, false], ["tat:situacao", 1, false], ["fis:forca", 2, true, "individual"], ["fis:resistencia", 1, false], ["men:rotina", 1, false]],
    especifica: [["ip:inicio", 2, true], ["tec:A1", 1, true], ["tat:situacao", 2, true], ["tat:padrao", 1, false], ["fis:velocidade", 2, false], ["men:rotina", 1, false]],
    ponte: [["ip:inicio", 1, true], ["tat:situacao", 1, true], ["fis:velocidade", 1, false], ["fis:regenerativo", 1, false, "individual"], ["men:placar", 1, false]],
    precompetitiva: [["ip:inicio", 2, true], ["tat:plano", 1, true], ["tat:situacao", 1, false], ["fis:velocidade", 1, false], ["men:placar", 1, true]],
    competicao: [["jogo:torneio", 1, false, "fora_do_ct"], ["men:rotina", 1, false]],
    preparatoria: [["jogo:torneio", 1, false, "fora_do_ct"], ["ip:inicio", 1, true], ["tat:situacao", 1, false], ["fis:forca", 1, false, "individual"]],
    transicao: [["fis:regenerativo", 2, false, "individual"], ["men:revisao", 1, true, "individual"]],
  };
  var TESTES_PADRAO = [
    { id: "t-saque1", pilar: "tecnico", nome: "1º saque dentro (20 saques, 10 de cada lado)", unidade: "%", melhor: "maior" },
    { id: "t-prof", pilar: "tecnico", nome: "Bolas além da linha de saque em troca viva (30 bolas)", unidade: "bolas", melhor: "maior" },
    { id: "t-devol", pilar: "tecnico", nome: "Devoluções em jogo contra 1º saque (20)", unidade: "devoluções", melhor: "maior" },
    { id: "t-aprov", pilar: "tatico", nome: "Aproveitamento de oportunidade (bloco de pontos)", unidade: "%", melhor: "maior" },
    { id: "t-forcado", pilar: "tatico", nome: "Ataque forçado (bloco de pontos)", unidade: "%", melhor: "menor" },
    { id: "t-agil", pilar: "fisico", nome: "Agilidade 5-10-5", unidade: "s", melhor: "menor" },
    { id: "t-sprint", pilar: "fisico", nome: "Sprint de 20 m", unidade: "s", melhor: "menor" },
    { id: "t-salto", pilar: "fisico", nome: "Salto vertical com contramovimento", unidade: "cm", melhor: "maior" },
    { id: "t-yoyo", pilar: "fisico", nome: "Yo-Yo IR1", unidade: "m", melhor: "maior" },
    { id: "t-rotina", pilar: "mental", nome: "Rotina entre pontos executada (sets com regra)", unidade: "%", melhor: "maior" },
    { id: "t-pimp", pilar: "mental", nome: "Pontos importantes vencidos (break e set point)", unidade: "%", melhor: "maior" },
  ];
  var AREAS_TEMA = { saque: "tec:saque", devolucao: "tec:devolucao", fundo: "tec:fundo", rede: "tec:rede" };

  /* ── datas ── */
  function iso(d) { return new Date(d).toISOString().slice(0, 10); }
  function dt(s) { return new Date(String(s).slice(0, 10) + "T12:00:00Z"); }
  function segunda(s) { var d = dt(s), w = (d.getUTCDay() + 6) % 7; return iso(d.getTime() - w * DIA); }
  function somaDias(s, n) { return iso(dt(s).getTime() + n * DIA); }
  function dias(a, b) { return Math.round((dt(b) - dt(a)) / DIA); }
  function chaveSemana(data) { return segunda(data); }

  /* ── calendário ── */
  function torneiosOrdenados(cal) {
    return (cal || []).filter(function (t) { return t && t.inicio; }).slice().sort(function (a, b) { return a.inicio < b.inicio ? -1 : 1; });
  }
  /* onde o atleta está hoje: em torneio (viajando), voltou (até 3 dias depois do fim) ou no CT */
  function statusAtleta(ar, hoje) {
    var ts = torneiosOrdenados(ar && ar.calendario);
    for (var i = 0; i < ts.length; i++) {
      var t = ts[i], fim = t.fim || t.inicio;
      if (hoje >= somaDias(t.inicio, -1) && hoje <= fim) return { v: "torneio", r: "Em torneio: " + (t.nome || "torneio"), torneio: t };
    }
    for (var j = ts.length - 1; j >= 0; j--) {
      var u = ts[j], f = u.fim || u.inicio;
      if (f < hoje && dias(f, hoje) <= 3) return { v: "voltou", r: "Voltou de " + (u.nome || "torneio"), torneio: u };
    }
    return { v: "ct", r: "No CT" };
  }
  function proximoTorneio(ar, hoje) {
    return torneiosOrdenados(ar && ar.calendario).find(function (t) { return (t.fim || t.inicio) >= hoje; }) || null;
  }

  /* ── periodização: semana a semana a partir do calendário ── */
  function fasesDoCalendario(calendario, inicio, semanas) {
    var base = segunda(inicio), linha = [];
    for (var i = 0; i < semanas; i++) linha.push({ n: i + 1, inicio: somaDias(base, 7 * i), fase: null, torneioId: null });
    var idx = function (data) { var k = Math.floor(dias(base, segunda(data)) / 7); return k >= 0 && k < semanas ? k : -1; };
    var ts = torneiosOrdenados(calendario), comp = [];
    ts.forEach(function (t) {
      var a = idx(t.inicio), b = idx(t.fim || t.inicio);
      if (a < 0 && b < 0) return;
      a = Math.max(a, 0); if (b < 0) b = semanas - 1;
      for (var k = a; k <= b; k++) { linha[k].fase = t.prioridade === "preparatorio" ? "preparatoria" : "competicao"; linha[k].torneioId = t.id; }
      comp.push({ a: a, b: b, t: t });
    });
    /* afinação antes e regeneração depois, conforme a prioridade */
    comp.forEach(function (x) {
      var p = PRIORIDADES[x.t.prioridade] || PRIORIDADES.secundario;
      for (var k3 = 1; k3 <= p.afinacao; k3++) { var w = x.a - k3; if (w >= 0 && !linha[w].fase) { linha[w].fase = "precompetitiva"; linha[w].torneioId = x.t.id; } }
      for (var k4 = 1; k4 <= p.regeneracao; k4++) { var z = x.b + k4; if (z < semanas && !linha[z].fase) linha[z].fase = "transicao"; }
    });
    /* ponte entre torneios próximos: o vão de até 2 semanas que a afinação e a regeneração não ocuparam */
    for (var c = 0; c < comp.length - 1; c++) {
      var vao = comp[c + 1].a - comp[c].b - 1;
      if (vao >= 1 && vao <= 2) for (var k2 = comp[c].b + 1; k2 < comp[c + 1].a; k2++) if (!linha[k2].fase) linha[k2].fase = "ponte";
    }
    /* o resto: base longe do próximo evento importante, específica perto (até 4 semanas) */
    for (var k5 = 0; k5 < semanas; k5++) {
      if (linha[k5].fase) continue;
      var prox = comp.find(function (x) { return x.a > k5 && x.t.prioridade !== "preparatorio"; });
      linha[k5].fase = prox && prox.a - k5 <= 4 ? "especifica" : "base";
    }
    return linha;
  }

  /* ── escolher um exercício do catálogo para um tema (determinístico: gira pela semana) ── */
  function exercicioPara(tema, catalogo, estagio, giro) {
    var T = TEMAS[tema]; if (!T || !T.familias || !catalogo || !catalogo.length) return null;
    var pool = catalogo.filter(function (e) {
      return e && T.familias.indexOf(e.f) >= 0 && (!estagio || !e.e || e.e.indexOf(estagio) >= 0) && !e.semBola &&
        (T.situacao ? !!e.tl : T.busca.test((e.n || "") + " " + (e.m || "")));
    });
    if (!pool.length) pool = catalogo.filter(function (e) { return e && T.familias.indexOf(e.f) >= 0 && !e.semBola; });
    if (!pool.length) return null;
    var e = pool[Math.abs(giro || 0) % pool.length];
    return { c: e.c, n: e.n };
  }

  /* ── plano individual ──
     opcoes: { calendario, inicio, semanas, minutosSemana, prioridades (áreas da ficha), estagio, catalogo } */
  function gerarPlano(o) {
    var semanas = Math.max(1, Math.min(52, Number(o.semanas) || 12)), minutos = Math.max(60, Number(o.minutosSemana) || 600);
    var areas = (o.prioridades && o.prioridades.length ? o.prioridades : ["saque", "devolucao", "fundo", "rede"]).filter(function (a) { return AREAS_TEMA[a]; });
    var linha = fasesDoCalendario(o.calendario || [], o.inicio, semanas);
    var fases = [], blocos = [];
    linha.forEach(function (s) {
      var ult = blocos[blocos.length - 1];
      if (!ult || ult.fase !== s.fase || ult.torneioId !== (s.fase === "base" || s.fase === "especifica" ? ult.torneioId : s.torneioId)) {
        var nFase = blocos.filter(function (b) { return b.fase === s.fase; }).length + 1;
        ult = { id: "b" + (blocos.length + 1), fase: s.fase, torneioId: s.torneioId, titulo: FASES[s.fase].r + (nFase > 1 ? " " + nFase : ""), semanas: [] };
        blocos.push(ult);
      }
      var F = FASES[s.fase], k = 0;
      var conteudos = MODELO[s.fase].map(function (m) {
        var tema = m[0];
        if (tema === "tec:A1") tema = AREAS_TEMA[areas[0]] || "tec:fundo";
        if (tema === "tec:A2") tema = AREAS_TEMA[areas[1] || areas[0]] || "tec:saque";
        k++;
        var ex = exercicioPara(tema, o.catalogo, o.estagio, s.n + k);
        return { id: "s" + s.n + "-" + k, pilar: TEMAS[tema].pilar, tema: tema, titulo: TEMAS[tema].r, codigoExercicio: ex ? ex.c : null, nomeExercicio: ex ? ex.n : null,
          tipo: m[3] || "coletivo", vezesAlvo: m[1], essencial: !!m[2] };
      });
      ult.semanas.push({ n: s.n, inicio: s.inicio, cargaAlvo: { minutos: Math.round(minutos * F.vol), ua: Math.round(minutos * F.vol * F.pse) }, conteudos: conteudos });
    });
    blocos.forEach(function (b) {
      var f = fases[fases.length - 1];
      if (!f || f.fase !== b.fase) { f = { id: "f" + (fases.length + 1), fase: b.fase, nome: FASES[b.fase].r, inicio: b.semanas[0].inicio }; fases.push(f); }
      f.fim = somaDias(b.semanas[b.semanas.length - 1].inicio, 6); b.faseId = f.id;
    });
    return { versao: 1, geradoEm: new Date().toISOString(), inicio: segunda(o.inicio), semanas: semanas, minutosSemana: minutos, fases: fases, blocos: blocos };
  }
  function semanasDoPlano(plano) {
    var out = [];
    ((plano && plano.blocos) || []).forEach(function (b) { (b.semanas || []).forEach(function (s) { out.push({ bloco: b, semana: s }); }); });
    return out;
  }
  /* a semana do plano segue a data (antes do início: a 1ª; depois do fim: a última) */
  function semanaAtual(plano, hoje) {
    var lista = semanasDoPlano(plano); if (!lista.length) return null;
    var seg = segunda(hoje), achada = null;
    lista.forEach(function (x) { if (x.semana.inicio <= seg) achada = x; });
    return achada || lista[0];
  }

  /* ── marcador de progresso ── */
  function vezes(progresso, id) { var c = progresso && progresso.cumpridos && progresso.cumpridos[id]; return c ? c.vezes || 0 : 0; }
  /* pendentes de hoje: o que falta na semana atual + os ESSENCIAIS que ficaram para trás (os outros expiram) */
  function pendentes(ar, hoje, incluirForaDoCT) {
    var plano = ar && ar.plano, prog = (ar && ar.progresso) || {}, atual = semanaAtual(plano, hoje);
    if (!atual) return [];
    var out = [];
    semanasDoPlano(plano).forEach(function (x) {
      if (x.semana.inicio > atual.semana.inicio) return;
      var daSemana = x.semana.n === atual.semana.n;
      x.semana.conteudos.forEach(function (c) {
        if (!incluirForaDoCT && c.tipo === "fora_do_ct") return;
        var falta = (c.vezesAlvo || 1) - vezes(prog, c.id);
        if (falta <= 0) return;
        if (!daSemana && !c.essencial) return;
        out.push(Object.assign({}, c, { falta: falta, atrasado: !daSemana, semanaN: x.semana.n, blocoTitulo: x.bloco.titulo }));
      });
    });
    return out.sort(function (a, b) { return (b.atrasado ? 1 : 0) - (a.atrasado ? 1 : 0) || (b.essencial ? 1 : 0) - (a.essencial ? 1 : 0); });
  }
  function marcador(ar, hoje) {
    var atual = semanaAtual(ar && ar.plano, hoje); if (!atual) return null;
    var prog = (ar && ar.progresso) || {}, cs = atual.semana.conteudos;
    var alvo = cs.reduce(function (s, c) { return s + (c.vezesAlvo || 1); }, 0), feito = cs.reduce(function (s, c) { return s + Math.min(c.vezesAlvo || 1, vezes(prog, c.id)); }, 0);
    var pend = pendentes(ar, hoje, true);
    return { blocoId: atual.bloco.id, blocoTitulo: atual.bloco.titulo, fase: atual.bloco.fase, faseNome: FASES[atual.bloco.fase].r, semanaN: atual.semana.n, totalSemanas: semanasDoPlano(ar.plano).length,
      inicioSemana: atual.semana.inicio, cargaAlvo: atual.semana.cargaAlvo, feitos: feito, alvo: alvo, pct: alvo ? Math.round((100 * feito) / alvo) : 0,
      pendentes: pend.filter(function (c) { return !c.atrasado; }), atrasados: pend.filter(function (c) { return c.atrasado; }),
      conteudos: cs.map(function (c) { return Object.assign({}, c, { feitas: vezes(prog, c.id) }); }) };
  }

  /* ── registros e carga ── */
  function ua(minutos, pse) { return Math.round((Number(minutos) || 0) * (Number(pse) || 0)); }
  function normalizarRegistro(r) {
    var minutos = Math.max(0, Math.min(600, Math.round(Number(r.minutos) || 0))), pse = Math.max(0, Math.min(10, Math.round(Number(r.pse) || 0)));
    return { id: String(r.id || "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)), data: String(r.data || "").slice(0, 10),
      origem: r.origem === "viagem" ? "viagem" : "ct", tipo: r.tipo === "jogo" ? "jogo" : "treino", minutos: minutos, pse: pse, ua: ua(minutos, pse),
      conteudosFeitos: (Array.isArray(r.conteudosFeitos) ? r.conteudosFeitos : []).map(String).slice(0, 30), sessaoId: r.sessaoId || null, torneioId: r.torneioId || null,
      jogo: r.tipo === "jogo" && r.jogo ? { adversario: String(r.jogo.adversario || "").slice(0, 80), placar: String(r.jogo.placar || "").slice(0, 40), resultado: r.jogo.resultado === "vitoria" ? "vitoria" : r.jogo.resultado === "derrota" ? "derrota" : "" } : null,
      obs: String(r.obs || "").slice(0, 500), autor: r.autor === "atleta" ? "atleta" : "treinador", confirmado: r.autor === "atleta" ? !!r.confirmado : true, criadoEm: r.criadoEm || new Date().toISOString() };
  }
  /* aplica um registro novo no marcador e na carga da semana; devolve { progresso, cargaSemanas } novos */
  function aplicarRegistro(ar, reg, hoje) {
    var prog = JSON.parse(JSON.stringify((ar && ar.progresso) || { cumpridos: {} })); prog.cumpridos = prog.cumpridos || {};
    reg.conteudosFeitos.forEach(function (id) { var c = prog.cumpridos[id] || { vezes: 0 }; c.vezes = (c.vezes || 0) + 1; c.ultima = reg.data; c.onde = reg.origem; prog.cumpridos[id] = c; });
    var carga = JSON.parse(JSON.stringify((ar && ar.cargaSemanas) || {})), k = chaveSemana(reg.data), s = carga[k] || { minutos: 0, ua: 0, sessoes: 0, jogos: 0, viagem: 0 };
    s.minutos += reg.minutos; s.ua += reg.ua; s.sessoes += reg.tipo === "treino" ? 1 : 0; s.jogos += reg.tipo === "jogo" ? 1 : 0; s.viagem += reg.origem === "viagem" ? reg.ua : 0;
    carga[k] = s;
    var m = marcador(Object.assign({}, ar, { progresso: prog }), hoje || reg.data);
    if (m) { prog.blocoId = m.blocoId; prog.semanaN = m.semanaN; }
    prog.atualizadoEm = new Date().toISOString();
    return { progresso: prog, cargaSemanas: carga };
  }
  /* recalcula tudo a partir da lista de registros (para quando um registro é corrigido ou apagado) */
  function recalcular(ar, registros, hoje) {
    var base = Object.assign({}, ar, { progresso: { cumpridos: {} }, cargaSemanas: {} });
    (registros || []).slice().sort(function (a, b) { return a.data < b.data ? -1 : 1; }).forEach(function (r) {
      var x = aplicarRegistro(base, normalizarRegistro(r), hoje); base.progresso = x.progresso; base.cargaSemanas = x.cargaSemanas;
    });
    return { progresso: base.progresso, cargaSemanas: base.cargaSemanas };
  }
  function cargaSemanaAtual(ar, hoje) {
    var k = chaveSemana(hoje), s = (ar && ar.cargaSemanas && ar.cargaSemanas[k]) || { minutos: 0, ua: 0, sessoes: 0, jogos: 0, viagem: 0 };
    var atual = semanaAtual(ar && ar.plano, hoje), alvo = atual ? atual.semana.cargaAlvo : null;
    return Object.assign({ semana: k, alvo: alvo, pct: alvo && alvo.ua ? Math.round((100 * s.ua) / alvo.ua) : null }, s);
  }
  /* aguda (semana atual) ÷ crônica (média das 4 semanas anteriores) */
  function acwr(ar, hoje) {
    var c = (ar && ar.cargaSemanas) || {}, k = chaveSemana(hoje), aguda = (c[k] || {}).ua || 0, soma = 0;
    for (var i = 1; i <= 4; i++) soma += (c[somaDias(k, -7 * i)] || {}).ua || 0;
    return soma ? Math.round((aguda / (soma / 4)) * 100) / 100 : null;
  }
  /* teto de intensidade do dia: normal, reduzido ou regenerativo, com o motivo */
  function tetoDoDia(ar, registrosRecentes, hoje) {
    var jogos = (registrosRecentes || []).filter(function (r) { return r.tipo === "jogo" && r.data <= hoje && dias(r.data, hoje) <= 3; }).length;
    if (jogos >= 2) return { v: "regenerativo", r: "Regenerativo: " + jogos + " jogos nos últimos 3 dias" };
    var t = proximoTorneio(ar, hoje);
    if (t && t.prioridade === "principal" && t.inicio > hoje && dias(hoje, t.inicio) <= 3) return { v: "reduzido", r: "Reduzido: afinação para " + (t.nome || "o torneio principal") };
    var c = cargaSemanaAtual(ar, hoje);
    if (c.pct != null && c.pct > 120) return { v: "reduzido", r: "Reduzido: carga da semana em " + c.pct + "% do alvo" };
    var a = acwr(ar, hoje);
    if (a != null && a > 1.5) return { v: "reduzido", r: "Reduzido: carga aguda " + a + "× a crônica" };
    return { v: "normal", r: "Normal" };
  }
  /* propostas de ajuste olhando a última semana completa */
  function ajusteSemanal(ar, hoje) {
    var out = [], k = somaDias(chaveSemana(hoje), -7), c = (ar && ar.cargaSemanas && ar.cargaSemanas[k]) || { ua: 0 };
    var x = semanaAtual(ar && ar.plano, k), alvo = x && x.semana.inicio === k ? x.semana.cargaAlvo : null;
    if (alvo && alvo.ua) {
      var pct = Math.round((100 * c.ua) / alvo.ua);
      if (pct < 70) out.push({ tipo: "carga_baixa", r: "Semana de " + k.split("-").reverse().join("/") + ": carga em " + pct + "% do alvo. Rever o volume desta semana ou repor o que é essencial." });
      if (pct > 120) out.push({ tipo: "carga_alta", r: "Semana de " + k.split("-").reverse().join("/") + ": carga em " + pct + "% do alvo. Aliviar a semana atual." });
    }
    var atr = pendentes(ar, hoje).filter(function (p) { return p.atrasado; });
    if (atr.length >= 3) out.push({ tipo: "pendencias", r: atr.length + " conteúdos essenciais atrasados: priorizar nas próximas sessões." });
    return out;
  }

  /* ── sessão do dia no CT ──
     atletas: [{ id, nome, ar, registros (recentes) }]; duracaoMin; catalogo e estagio para escolher exercícios */
  function montarSessao(o) {
    var hoje = o.hoje, dur = Math.max(45, Number(o.duracaoMin) || 120), presentes = (o.atletas || []).filter(function (a) { return a && a.ar && a.ar.plano; });
    var info = presentes.map(function (a) {
      return { id: a.id, nome: a.nome, teto: tetoDoDia(a.ar, a.registros, hoje), pend: pendentes(a.ar, hoje), m: marcador(a.ar, hoje) };
    });
    var dose = function (x) { return x.teto.v === "normal" ? "normal" : x.teto.v === "reduzido" ? "reduzida" : "leve"; };
    var todos = info.map(function (x) { return x.id; }), blocos = [], usados = {};
    var porAtleta = function (pred) { var m = {}; info.forEach(function (x) { var c = x.pend.find(function (p) { return pred(p) && !usados[x.id + ":" + p.id]; }); if (c) m[x.id] = c; }); return m; };
    var doseDe = function (ids) { var d = {}; info.forEach(function (x) { if (ids.indexOf(x.id) >= 0) d[x.id] = dose(x); }); return d; };
    var bloco = function (b) { b.id = "k" + (blocos.length + 1); b.ordem = blocos.length + 1; blocos.push(b); Object.keys(b.conteudoPorAtleta || {}).forEach(function (id) { usados[id + ":" + b.conteudoPorAtleta[id].id] = 1; }); };
    var conteudoIds = function (m) { var r = {}; Object.keys(m).forEach(function (id) { r[id] = { id: m[id].id, titulo: m[id].titulo, atrasado: !!m[id].atrasado }; }); return r; };
    var mEntrada = Math.round(dur * 0.12), mIP = Math.round(dur * 0.2), mJogo = Math.round(dur * 0.18), resto = dur - mEntrada - mIP - mJogo;
    var ex = function (tema, giro) { return exercicioPara(tema, o.catalogo, o.estagio, giro) || {}; };
    bloco({ tipo: "coletivo", tema: "entrada", titulo: "Entrada e base motora", minutos: mEntrada, atletas: todos, conteudoPorAtleta: {}, dose: doseDe(todos),
      codigoExercicio: (ex("fis:velocidade", 1)).c || null, nomeExercicio: (ex("fis:velocidade", 1)).n || null });
    /* início do ponto: sempre coletivo (o método exige toda semana); conta para quem tem esse conteúdo pendente */
    var ip = porAtleta(function (p) { return p.tema === "ip:inicio" || p.tema === "tec:saque" || p.tema === "tec:devolucao"; });
    bloco({ tipo: "coletivo", tema: "ip:inicio", titulo: TEMAS["ip:inicio"].r, minutos: mIP, atletas: todos, conteudoPorAtleta: conteudoIds(ip), dose: doseDe(todos),
      codigoExercicio: ex("ip:inicio", 2).c || null, nomeExercicio: ex("ip:inicio", 2).n || null });
    /* temas em comum: 2 ou mais presentes com o mesmo tema pendente (tipo coletivo); primeiro o que é essencial para mais gente */
    var contagem = {};
    info.forEach(function (x) { x.pend.forEach(function (p) { if (p.tipo !== "coletivo" || usados[x.id + ":" + p.id] || p.tema === "ip:inicio") return; (contagem[p.tema] = contagem[p.tema] || {})[x.id] = contagem[p.tema][x.id] || p; }); });
    var temas = Object.keys(contagem).map(function (t) { var ids = Object.keys(contagem[t]); return { t: t, ids: ids, ess: ids.filter(function (id) { return contagem[t][id].essencial; }).length }; })
      .filter(function (x) { return x.ids.length >= 2; }).sort(function (a, b) { return b.ess - a.ess || b.ids.length - a.ids.length; });
    var nCol = Math.min(temas.length, Math.max(1, Math.floor(resto / 30))), mInd = resto;
    if (temas.length) { var mCol = Math.max(15, Math.round((resto * 0.6) / nCol)); mInd = Math.max(0, resto - mCol * nCol);
      temas.slice(0, nCol).forEach(function (x, i) { var m = {}; x.ids.forEach(function (id) { m[id] = contagem[x.t][id]; });
        var cont = {}; x.ids.forEach(function (id) { var c = m[id].codigoExercicio; if (c) cont[c] = { n: (cont[c] ? cont[c].n : 0) + 1, nome: m[id].nomeExercicio }; });
        var top = Object.keys(cont).sort(function (a, b) { return cont[b].n - cont[a].n; })[0];
        bloco({ tipo: "coletivo", tema: x.t, titulo: TEMAS[x.t] ? TEMAS[x.t].r : x.t, minutos: mCol, atletas: x.ids, conteudoPorAtleta: conteudoIds(m), dose: doseDe(x.ids),
          codigoExercicio: top || ex(x.t, i + 3).c || null, nomeExercicio: top ? cont[top].nome : ex(x.t, i + 3).n || null }); }); }
    /* tarefas individuais: o que sobrou do plano de cada um (até 2), em estações */
    var tarefas = {};
    info.forEach(function (x) { tarefas[x.id] = x.pend.filter(function (p) { return !usados[x.id + ":" + p.id]; }).slice(0, x.teto.v === "regenerativo" ? 1 : 2)
      .map(function (p) { return { id: p.id, titulo: p.titulo, tema: p.tema, codigoExercicio: p.codigoExercicio || null, nomeExercicio: p.nomeExercicio || null, atrasado: !!p.atrasado }; }); });
    var comTarefa = todos.filter(function (id) { return tarefas[id].length; });
    if (comTarefa.length && mInd >= 10) {
      blocos.push({ id: "k" + (blocos.length + 1), ordem: blocos.length + 1, tipo: "individual", tema: "individual", titulo: "Tarefas individuais (estações)", minutos: mInd, atletas: comTarefa, tarefas: tarefas, dose: doseDe(comTarefa), conteudoPorAtleta: {} });
      comTarefa.forEach(function (id) { tarefas[id].forEach(function (t) { usados[id + ":" + t.id] = 1; }); });
    } else mJogo += mInd;
    /* jogo aplicado: coletivo; a regra de cada um vem do tático pendente dele */
    var regra = {}; info.forEach(function (x) { var t = x.pend.find(function (p) { return p.pilar === "tatico" && !usados[x.id + ":" + p.id]; }); if (t) regra[x.id] = t; });
    bloco({ tipo: "coletivo", tema: "jogo", titulo: "Jogo aplicado com regra", minutos: mJogo, atletas: todos.filter(function (id) { return info.find(function (x) { return x.id === id; }).teto.v !== "regenerativo"; }),
      conteudoPorAtleta: conteudoIds(regra), dose: doseDe(todos), codigoExercicio: ex("tat:plano", 4).c || null, nomeExercicio: ex("tat:plano", 4).n || null });
    return { data: hoje, duracaoMin: dur, presentes: todos, status: "rascunho", criadoEm: new Date().toISOString(),
      atletas: info.map(function (x) { return { id: x.id, nome: x.nome, teto: x.teto, semana: x.m ? { n: x.m.semanaN, bloco: x.m.blocoTitulo, fase: x.m.faseNome } : null, pendentes: x.pend.length }; }),
      blocos: blocos };
  }
  /* conteúdos que a sessão previa para um atleta (para pré-marcar no fechamento) */
  function conteudosDaSessao(sessao, alunoId) {
    var out = [];
    (sessao.blocos || []).forEach(function (b) {
      if ((b.atletas || []).indexOf(alunoId) < 0) return;
      var c = b.conteudoPorAtleta && b.conteudoPorAtleta[alunoId]; if (c) out.push({ id: c.id, titulo: c.titulo, bloco: b.titulo });
      ((b.tarefas && b.tarefas[alunoId]) || []).forEach(function (t) { out.push({ id: t.id, titulo: t.titulo, bloco: b.titulo }); });
    });
    return out;
  }
  /* fechamento: um registro de CT para cada presente que treinou */
  function registrosDoFechamento(sessao, entradas) {
    return (sessao.presentes || []).filter(function (id) { return entradas[id] && entradas[id].presente !== false; }).map(function (id) {
      var e = entradas[id];
      return normalizarRegistro({ data: sessao.data, origem: "ct", tipo: "treino", sessaoId: sessao.id, minutos: e.minutos != null ? e.minutos : sessao.duracaoMin, pse: e.pse,
        conteudosFeitos: e.feitos || conteudosDaSessao(sessao, id).map(function (c) { return c.id; }), obs: e.obs, autor: "treinador" });
    });
  }

  /* ── avaliações: evolução de cada teste (primeira, última, melhor e se melhorou) ── */
  function evolucaoTestes(avaliacoes, testes) {
    var porTeste = {};
    (avaliacoes || []).forEach(function (a) { (porTeste[a.testeId] = porTeste[a.testeId] || []).push(a); });
    return Object.keys(porTeste).map(function (id) {
      var t = (testes || TESTES_PADRAO).find(function (x) { return x.id === id; }) || { id: id, nome: id, unidade: "", melhor: "maior" };
      var l = porTeste[id].slice().sort(function (a, b) { return a.data < b.data ? -1 : 1; }), p = l[0], u = l[l.length - 1];
      var dif = Math.round((Number(u.valor) - Number(p.valor)) * 100) / 100;
      return { teste: t, medidas: l, primeira: p, ultima: u, diferenca: dif, melhorou: l.length > 1 ? (t.melhor === "menor" ? dif < 0 : dif > 0) : null };
    });
  }
  /* metas: alvo atingido pela última medida do teste ligado à meta */
  function situacaoMeta(meta, avaliacoes, testes) {
    var t = (testes || TESTES_PADRAO).find(function (x) { return x.id === meta.testeId; });
    var l = (avaliacoes || []).filter(function (a) { return a.testeId === meta.testeId; }).sort(function (a, b) { return a.data < b.data ? -1 : 1; });
    if (!t || !l.length || meta.alvo == null || meta.alvo === "") return { atual: l.length ? l[l.length - 1].valor : null, atingida: null };
    var v = Number(l[l.length - 1].valor), alvo = Number(meta.alvo);
    return { atual: v, atingida: t.melhor === "menor" ? v <= alvo : v >= alvo };
  }

  /* membros das equipes de competição antigas que ainda não estão no alto rendimento (migração) */
  function atletasDasEquipes(equipes, alunos) {
    var ids = {};
    (equipes || []).forEach(function (e) { (e.membros || []).forEach(function (id) { ids[id] = 1; }); });
    return (alunos || []).filter(function (a) { return ids[a.id] && !(a.altoRendimento && a.altoRendimento.ativo); });
  }

  /* ── plano pela IA ──
     O calendário decide as fases e a carga (gerarPlano, sem IA); a IA escolhe os conteúdos e os exercícios de cada semana.
     esqueleto(plano): o que vai no pedido. aplicarIA(base, resposta, catalogo): valida e encaixa a resposta no esqueleto;
     código que não existe no catálogo derruba o plano (como no plano das turmas); semana que a IA esqueceu fica com o modelo. */
  function esqueleto(plano) {
    return semanasDoPlano(plano).map(function (x) {
      return { n: x.semana.n, inicio: x.semana.inicio, fase: x.bloco.fase, faseNome: FASES[x.bloco.fase].r, bloco: x.bloco.titulo, torneioId: x.bloco.torneioId || null,
        cargaAlvo: x.semana.cargaAlvo, modelo: x.semana.conteudos.map(function (c) { return { tema: c.tema, vezes: c.vezesAlvo, essencial: c.essencial }; }) };
    });
  }
  function aplicarIA(base, resposta, catalogo) {
    if (!base || !base.blocos) throw new Error("Plano base ausente.");
    var r = resposta && (resposta.plano || resposta);
    if (!r || !Array.isArray(r.semanas) || !r.semanas.length) throw new Error("A resposta não trouxe as semanas do plano.");
    var mapa = {}; (catalogo || []).forEach(function (e) { if (e && e.c) mapa[e.c] = e; });
    var porN = {}; r.semanas.forEach(function (s) { if (s && s.n != null) porN[Number(s.n)] = s; });
    var ruins = [], usadasIA = 0;
    var plano = JSON.parse(JSON.stringify(base));
    plano.blocos.forEach(function (b) {
      b.semanas.forEach(function (sem) {
        var ia = porN[sem.n]; if (!ia || !Array.isArray(ia.conteudos) || !ia.conteudos.length) return;
        var k = 0, lista = [];
        ia.conteudos.slice(0, 10).forEach(function (c) {
          if (!c) return;
          var tema = TEMAS[c.tema] ? c.tema : null, cod = c.ex ? String(c.ex).trim().toUpperCase() : null;
          if (cod && !mapa[cod]) { ruins.push(cod); return; }
          if (!tema) { if (!cod) return; tema = "tat:situacao"; }
          var T = TEMAS[tema]; k++;
          lista.push({ id: "s" + sem.n + "-" + k, pilar: T.pilar, tema: tema, titulo: String(c.titulo || T.r).slice(0, 90), codigoExercicio: T.foraDoCT ? null : cod, nomeExercicio: T.foraDoCT || !cod ? null : mapa[cod].n,
            tipo: T.foraDoCT ? "fora_do_ct" : c.tipo === "individual" || T.individual ? "individual" : "coletivo",
            vezesAlvo: Math.max(1, Math.min(4, Math.round(Number(c.vezes) || 1))), essencial: !!c.essencial, criterio: String(c.criterio || "").slice(0, 200) });
        });
        if (!lista.length) return;
        if ((b.fase === "competicao" || b.fase === "preparatoria") && !lista.some(function (c) { return c.tema === "jogo:torneio"; })) {
          k++; lista.unshift({ id: "s" + sem.n + "-" + k, pilar: "tatico", tema: "jogo:torneio", titulo: TEMAS["jogo:torneio"].r, codigoExercicio: null, nomeExercicio: null, tipo: "fora_do_ct", vezesAlvo: 1, essencial: false, criterio: "" });
        }
        sem.conteudos = lista; sem.foco = String(ia.foco || "").slice(0, 160); usadasIA++;
      });
    });
    if (ruins.length) throw new Error("Códigos que não existem no catálogo: " + ruins.filter(function (x, i, l) { return l.indexOf(x) === i; }).join(", "));
    if (!usadasIA) throw new Error("A resposta não trouxe conteúdos válidos para nenhuma semana.");
    plano.origem = "ia"; plano.semanasIA = usadasIA;
    plano.prioridade = String(r.prioridade || "").slice(0, 240);
    plano.observacao = (Array.isArray(r.observacao) ? r.observacao : []).slice(0, 10).map(function (o) { return { t: String((o && o.t) || o || "").slice(0, 120), d: String((o && o.d) || "").slice(0, 300) }; });
    return plano;
  }

  /* ── turmas do alto rendimento ──
     Uma turma é só um grupo salvo de atletas (nome, quem treina junto, professor, horário): o plano continua individual e a
     sessão da turma é a sessão do dia montada com quem está presente. A sessão guarda `turmaId` e `convocados` (quem era da
     turma naquele dia), então a presença se lê depois sem depender de quem está na turma hoje. */
  function limparTurma(t, idsValidos) {
    t = t || {};
    var vistos = {}, membros = (Array.isArray(t.membros) ? t.membros : []).filter(function (id) {
      if (!id || vistos[id] || (idsValidos && idsValidos.indexOf(id) < 0)) return false; vistos[id] = 1; return true;
    });
    return { id: String(t.id || ""), nome: String(t.nome || "").trim().slice(0, 60), membros: membros,
      professorUid: String(t.professorUid || ""), professorNome: String(t.professorNome || "").slice(0, 80),
      horario: String(t.horario || "").trim().slice(0, 120), criadoEm: String(t.criadoEm || ""), atualizadoEm: String(t.atualizadoEm || "") };
  }
  function treinouNaSessao(s, id) {
    /* semPlano: esteve na sessão da turma, mas ainda não tem plano individual (conta a presença, não entra na montagem) */
    if ((s.semPlano || []).indexOf(id) >= 0) return true;
    return (s.presentes || []).indexOf(id) >= 0 && !(s.realizado && s.realizado[id] && s.realizado[id].presente === false);
  }
  /* só sessões fechadas da turma contam; devolve a lista (mais recente primeiro) e o resumo de cada atleta que está na turma hoje */
  function presencaDaTurma(turma, sessoes) {
    var lista = (sessoes || []).filter(function (s) { return s && s.turmaId === turma.id && s.status === "fechada"; })
      .sort(function (a, b) { return a.data < b.data ? 1 : a.data > b.data ? -1 : 0; })
      .map(function (s) {
        var esperados = Array.isArray(s.convocados) && s.convocados.length ? s.convocados : (turma.membros || []);
        var presentes = esperados.filter(function (id) { return treinouNaSessao(s, id); });
        return { id: s.id, data: s.data, esperados: esperados, presentes: presentes,
          ausentes: esperados.filter(function (id) { return presentes.indexOf(id) < 0; }),
          convidados: (s.presentes || []).filter(function (id) { return esperados.indexOf(id) < 0 && treinouNaSessao(s, id); }) };
      });
    var porAtleta = {};
    (turma.membros || []).forEach(function (id) {
      var x = { sessoes: 0, presencas: 0, faltas: 0, pct: null, ultimaFalta: null };
      lista.forEach(function (s) {
        if (s.esperados.indexOf(id) < 0) return;
        x.sessoes++;
        if (s.presentes.indexOf(id) >= 0) x.presencas++; else { x.faltas++; if (!x.ultimaFalta) x.ultimaFalta = s.data; }
      });
      x.pct = x.sessoes ? Math.round(100 * x.presencas / x.sessoes) : null;
      porAtleta[id] = x;
    });
    return { sessoes: lista, porAtleta: porAtleta, total: lista.length };
  }

  var api = {
    limparTurma: limparTurma, presencaDaTurma: presencaDaTurma,
    PILARES: PILARES, PRIORIDADES: PRIORIDADES, FASES: FASES, TEMAS: TEMAS, MODELO: MODELO, TESTES_PADRAO: TESTES_PADRAO,
    segunda: segunda, somaDias: somaDias, dias: dias, chaveSemana: chaveSemana,
    statusAtleta: statusAtleta, proximoTorneio: proximoTorneio, fasesDoCalendario: fasesDoCalendario, exercicioPara: exercicioPara,
    gerarPlano: gerarPlano, semanasDoPlano: semanasDoPlano, semanaAtual: semanaAtual, pendentes: pendentes, marcador: marcador,
    normalizarRegistro: normalizarRegistro, aplicarRegistro: aplicarRegistro, recalcular: recalcular, cargaSemanaAtual: cargaSemanaAtual, acwr: acwr,
    tetoDoDia: tetoDoDia, ajusteSemanal: ajusteSemanal, montarSessao: montarSessao, conteudosDaSessao: conteudosDaSessao,
    registrosDoFechamento: registrosDoFechamento, esqueleto: esqueleto, aplicarIA: aplicarIA, evolucaoTestes: evolucaoTestes, situacaoMeta: situacaoMeta, atletasDasEquipes: atletasDasEquipes,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  raiz.MTYAltoRendimento = api;
})(typeof window !== "undefined" ? window : globalThis);
