/* QuadraLab Liberdade (Treinador 2.0, Etapa 1): os números do painel "Minha Liberdade" e a sugestão da semana.
   Só calcula; não grava nada e não muda agenda, preços nem mensagens. As telas (autonomo/index.html) exibem o resultado.
   Entradas:
   · lib: o documento mty:liberdade:v1:{uid} (onboarding, linha de base, metas, rotina, meses) — ver o plano
     https://claude.ai/artifact/BaECVvuPwxZcXnsFkPFZfU;
   · alunos e turmas do app (horários fixos, avulsos e marcações da Agenda; valor opcional `valorMensal` ou `valorAula`);
   · hoje ("AAAA-MM-DD").
   As horas em quadra vêm da Agenda (QLAgendaAulas.aulasDoPeriodo): aulas dadas, de hoje e marcadas da semana, pela duração
   de cada uma; canceladas e faltas não contam. Toda conta diz de onde veio ("agenda", "valores", "preço médio", "informado").
   Nada aqui é promessa: a sugestão fala em estimativa e nunca propõe mais aulas quando a semana já está no limite.
   Navegador: window.QLLiberdade (usa window.QLAgendaAulas); Node (testes): module.exports. */
(function (raiz) {
  var SEMANAS_MES = 4.33;
  var DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  var DIFICULDADES = {
    alunos: "Conseguir alunos", picados: "Horários picados", cancelamentos: "Cancelamentos", hora: "Ganho pouco por hora",
    excesso: "Trabalho demais", conhecimento: "Quero viver também do conhecimento",
  };
  var FASES = {
    conquista: { nome: "Conquista", texto: "Construir a carteira de alunos." },
    crescimento: { nome: "Crescimento", texto: "Organizar a agenda e ganhar mais por hora." },
    liberdade: { nome: "Liberdade", texto: "Depender menos das horas em quadra." },
  };

  function num(v) { var n = Number(v); return isFinite(n) && n > 0 ? n : 0; }
  function r1(v) { return Math.round(v * 10) / 10; }
  function pad(n) { return String(n).padStart(2, "0"); }
  function iso(d) { return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()); }
  function dataUTC(s) { return new Date(s + "T12:00:00Z"); }
  function somaDias(s, n) { var d = dataUTC(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); }
  function diaSemana(s) { return dataUTC(s).getUTCDay(); }
  function inicioSemana(s) { var w = diaSemana(s); return somaDias(s, w === 0 ? -6 : 1 - w); }
  function minutosEntre(h1, h2) {
    var a = String(h1 || "").split(":").map(Number), b = String(h2 || "").split(":").map(Number);
    if (a.length < 2 || b.length < 2 || !isFinite(a[0]) || !isFinite(b[0])) return 60;
    var m = (b[0] * 60 + (b[1] || 0)) - (a[0] * 60 + (a[1] || 0));
    return m > 0 && m <= 300 ? m : 60;
  }
  function agenda() { return raiz.QLAgendaAulas || (typeof require === "function" ? require("./agenda-aulas.js") : null); }

  /* ── fase e caminhos sugeridos pelo onboarding (o professor pode trocar) ── */
  function faseSugerida(resp) {
    var r = resp || {}, alunos = num(r.alunos), horas = num(r.horasSemana);
    if (r.dificuldade === "alunos" || (r.alunos != null && alunos <= 15)) return "conquista";
    if (horas >= 40 || r.dificuldade === "excesso") return "liberdade";
    return "crescimento";
  }
  function caminhosSugeridos(resp) {
    var r = resp || {}, horas = num(r.horasSemana), meta = num(r.horasDesejadas);
    return { A: true, B: r.dificuldade === "conhecimento" || (horas > 0 && meta > 0 && meta < horas - 10) };
  }
  /* documento novo a partir das respostas: linha de base congelada com a data */
  function aplicarOnboarding(lib, resp, hoje) {
    var r = resp || {}, d = Object.assign({ versao: 1, metas: {}, rotina: {}, meses: {} }, lib || {});
    d.onboarding = { feitoEm: hoje, respostas: r };
    d.base = { data: hoje, alunos: r.alunos != null ? num(r.alunos) : null, horasSemana: r.horasSemana != null ? num(r.horasSemana) : null, rendaMes: r.rendaMes != null ? num(r.rendaMes) : null };
    d.fase = faseSugerida(r);
    d.caminhos = caminhosSugeridos(r);
    d.metas = Object.assign({ diasLivres: [0] }, d.metas || {});
    if (r.rendaDesejada != null && !d.metas.rendaLiquida) d.metas.rendaLiquida = num(r.rendaDesejada);
    if (r.horasDesejadas != null && !d.metas.horasSemana) d.metas.horasSemana = num(r.horasDesejadas);
    if (r.horasQuadra != null && r.horasSemana != null && d.rotina.horasAdminSemana == null) {
      var fora = Math.max(0, num(r.horasSemana) - num(r.horasQuadra));
      d.rotina.horasAdminSemana = fora; /* tudo o que não é quadra entra como "fora da quadra" até o professor separar */
      d.rotina.horasDeslocSemana = 0;
    }
    return d;
  }

  /* ── aulas da semana pela Agenda ── */
  function aulasSemana(alunos, turmas, hoje) {
    var ag = agenda(); if (!ag) return [];
    var ini = inicioSemana(hoje), fim = somaDias(ini, 6);
    return ag.aulasDoPeriodo({ alunos: alunos || [], turmas: turmas || [], hoje: hoje, inicio: ini, fim: fim })
      .filter(function (a) { return a.status !== "cancelada" && a.status !== "falta"; })
      .map(function (a) { return Object.assign({}, a, { minutos: minutosEntre(a.hora, a.horaFim) }); });
  }
  function aulasMes(alunos, turmas, hoje) {
    var ag = agenda(); if (!ag) return [];
    var ini = hoje.slice(0, 8) + "01", d = dataUTC(ini); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0);
    return ag.aulasDoPeriodo({ alunos: alunos || [], turmas: turmas || [], hoje: hoje, inicio: ini, fim: iso(d) })
      .filter(function (a) { return a.status !== "cancelada" && a.status !== "falta"; });
  }

  /* ── receita prevista do mês: valor por aluno/turma quando há; senão aulas do mês × preço médio; senão o informado ── */
  function receitaPrevista(lib, alunos, turmas, hoje) {
    var rot = (lib && lib.rotina) || {}, preco = num(rot.precoAulaMedio), aulas = aulasMes(alunos, turmas, hoje);
    var total = 0, comValor = 0, semValor = 0, porPreco = 0;
    function ent(e, tipo) {
      if (!e || (tipo === "individual" && !e.nome)) return;
      var doMes = aulas.filter(function (a) { return a.entTipo === tipo && a.entId === e.id; }).length;
      if (num(e.valorMensal)) { total += num(e.valorMensal); comValor++; }
      else if (num(e.valorAula)) { total += num(e.valorAula) * doMes; comValor++; }
      else if (doMes) { semValor++; if (preco) { total += preco * doMes; porPreco += doMes; } }
    }
    (alunos || []).forEach(function (a) { ent(a, "individual"); });
    (turmas || []).forEach(function (t) { ent(t, "turma"); });
    if (comValor || porPreco) return { valor: Math.round(total), fonte: comValor && !semValor ? "valores" : comValor ? "valores e preço médio" : "preço médio", semValor: preco ? 0 : semValor };
    var inf = lib && lib.base && lib.base.rendaMes;
    return inf ? { valor: Math.round(inf), fonte: "informado", semValor: semValor } : { valor: null, fonte: "", semValor: semValor };
  }

  /* ── os quatro indicadores do painel ── */
  function indicadores(lib, alunos, turmas, hoje) {
    var L = lib || {}, rot = L.rotina || {}, metas = L.metas || {}, base = L.base || {}, mes = (L.meses || {})[hoje.slice(0, 7)] || {};
    var semana = aulasSemana(alunos, turmas, hoje);
    var minQuadra = semana.reduce(function (s, a) { return s + a.minutos; }, 0);
    var temAgenda = semana.length > 0;
    var r = L.onboarding && L.onboarding.respostas || {};
    var quadra = temAgenda ? r1(minQuadra / 60) : (r.horasQuadra != null ? num(r.horasQuadra) : null);
    var adm = rot.horasAdminSemana != null ? num(rot.horasAdminSemana) : null, desl = rot.horasDeslocSemana != null ? num(rot.horasDeslocSemana) : null;
    var total = quadra != null ? r1(quadra + (adm || 0) + (desl || 0)) : (r.horasSemana != null ? num(r.horasSemana) : null);
    var rec = receitaPrevista(L, alunos, turmas, hoje);
    var recebido = mes.recebido != null ? num(mes.recebido) : null;
    var bruto = recebido != null ? recebido : rec.valor;
    var temCusto = rot.custosMes != null || rot.impostoPct != null;
    var liquida = bruto != null && temCusto ? Math.round(bruto - num(rot.custosMes) - bruto * Math.min(100, num(rot.impostoPct)) / 100) : null;
    var horasMes = total ? total * SEMANAS_MES : 0;
    var diasLivres = (metas.diasLivres || []).filter(function (d) { return d >= 0 && d <= 6; });
    var diasComAula = {}; semana.forEach(function (a) { diasComAula[diaSemana(a.data)] = true; });
    var livresRespeitados = diasLivres.filter(function (d) { return !diasComAula[d]; });
    return {
      renda: { prevista: rec.valor, fonte: rec.fonte, semValor: rec.semValor, recebido: recebido, liquida: liquida },
      tempo: { quadra: quadra, adm: adm, desloc: desl, total: total, fonte: temAgenda ? "agenda" : quadra != null ? "informado" : "" , aulas: semana.length },
      rentabilidade: { porHora: bruto != null && horasMes ? Math.round(bruto / horasMes) : null, liquidaPorHora: liquida != null && horasMes ? Math.round(liquida / horasMes) : null,
        necessariaPorHora: num(metas.rendaLiquida) && num(metas.horasSemana) ? Math.round(num(metas.rendaLiquida) / (num(metas.horasSemana) * SEMANAS_MES)) : null },
      vida: { limite: num(metas.horasSemana) || null, acima: total != null && num(metas.horasSemana) ? r1(total - num(metas.horasSemana)) : null,
        diasLivres: diasLivres, diasLivresRespeitados: livresRespeitados.length,
        recuperadas: total != null && base.horasSemana != null && hoje > (base.data || "") && inicioSemana(hoje) > inicioSemana(base.data || hoje) ? r1(num(base.horasSemana) - total) : null },
      semana: semana,
    };
  }

  /* ── sugestão da semana: uma só, a de maior impacto, sempre como estimativa ── */
  function sugestao(lib, alunos, turmas, hoje, ind) {
    var I = ind || indicadores(lib, alunos, turmas, hoje), L = lib || {}, metas = L.metas || {}, rot = L.rotina || {};
    var semana = I.semana || [], porDia = {};
    semana.forEach(function (a) { (porDia[a.data] = porDia[a.data] || []).push(a); });
    var limite = I.vida.limite, acima = I.vida.acima;
    /* 1. aula em dia que o professor quer livre */
    var emLivre = semana.filter(function (a) { return (metas.diasLivres || []).indexOf(diaSemana(a.data)) >= 0; });
    /* 2. dias com uma aula só (horário isolado): o dia inteiro preso por uma aula */
    var isolados = Object.keys(porDia).filter(function (d) { return porDia[d].length === 1 && (metas.diasLivres || []).indexOf(diaSemana(d)) < 0; }).sort();
    if (acima != null && acima > 2) {
      return { tipo: "acima", titulo: "Sua semana está " + acima + " h acima do seu limite",
        texto: isolados.length ? "Há " + isolados.length + " dia" + (isolados.length > 1 ? "s" : "") + " com uma aula só (" + isolados.map(function (d) { return DIAS[diaSemana(d)]; }).join(", ") + "). Reagrupar essas aulas em dias que você já vai à quadra pode reduzir o deslocamento, se os alunos puderem." : "Antes de pegar alunos novos, vale ver quais horários rendem menos por hora e quais tarefas fora da quadra podem diminuir.",
        beneficio: "Voltar para perto do seu limite de " + limite + " h", financeiro: "Sem mudança prevista na renda se as aulas forem só reagrupadas",
        jornada: isolados.length ? "Até " + Math.min(acima, isolados.length * 1.5).toFixed(1).replace(".", ",") + " h a menos por semana (estimativa, inclui deslocamento)" : "Depende do que for ajustado",
        acao: { rotulo: "Ver a agenda da semana", aba: "agenda" } };
    }
    if (emLivre.length) {
      var d0 = emLivre[0];
      return { tipo: "diaLivre", titulo: emLivre.length + " aula" + (emLivre.length > 1 ? "s" : "") + " em dia que você quer livre",
        texto: "Você marcou " + DIAS[diaSemana(d0.data)] + " como dia livre e tem aula com " + d0.nome + ". Mudar para outro dia preserva o seu descanso, se o aluno puder.",
        beneficio: "Proteger o dia de descanso", financeiro: "Sem mudança prevista na renda", jornada: "Libera o " + DIAS[diaSemana(d0.data)],
        acao: { rotulo: "Ver a agenda da semana", aba: "agenda" } };
    }
    if (isolados.length >= 2) {
      return { tipo: "isolados", titulo: isolados.length + " dias com uma aula só",
        texto: "Em " + isolados.map(function (d) { return DIAS[diaSemana(d)]; }).join(", ") + " você vai à quadra para uma aula. Reagrupar duas delas em dias cheios pode liberar um período inteiro, se os alunos tiverem disponibilidade.",
        beneficio: "Um período livre na semana", financeiro: "Sem mudança prevista na renda", jornada: "Até 3 h a menos por semana (estimativa, inclui deslocamento)",
        acao: { rotulo: "Ver a agenda da semana", aba: "agenda" } };
    }
    var ph = I.rentabilidade.porHora, nec = I.rentabilidade.necessariaPorHora;
    if (ph && nec && ph < nec * 0.9) {
      var reaj = Math.min(30, Math.ceil((nec / ph - 1) * 100 / 5) * 5);
      var podeMais = limite && I.tempo.total != null && I.tempo.total < limite - 2;
      return { tipo: "rentabilidade", titulo: "Sua hora vale R$ " + ph + "; a meta pede cerca de R$ " + nec,
        texto: podeMais ? "Você ainda tem cerca de " + Math.round(limite - I.tempo.total) + " h dentro do seu limite. Preencher parte delas com uma turma rende mais por hora do que aulas individuais avulsas." : "Sem aumentar horas, o caminho é o valor da hora: um reajuste de cerca de " + reaj + "% ou trocar horários individuais de baixo valor por turmas. Simule antes de decidir.",
        beneficio: "Chegar mais perto da sua meta de renda", financeiro: podeMais ? "Depende do valor e do número de alunos da turma" : "Reajuste de " + reaj + "% ≈ R$ " + Math.round((I.renda.prevista || 0) * reaj / 100) + " a mais por mês, se nenhum aluno sair (estimativa)",
        jornada: podeMais ? "Dentro do seu limite de " + limite + " h" : "Sem horas a mais", acao: { rotulo: "Revisar valores dos alunos", aba: "liberdade" } };
    }
    if (I.renda.prevista == null || (I.renda.semValor && !num(rot.precoAulaMedio))) {
      return { tipo: "dados", titulo: "Falta o valor das aulas para calcular sua hora",
        texto: "Informe o preço médio da aula (ou o valor de cada aluno) e as horas que você gasta fora da quadra. Com isso o painel mostra quanto vale a sua hora de trabalho.",
        beneficio: "Ver a sua renda por hora real", financeiro: "—", jornada: "2 minutos", acao: { rotulo: "Preencher valores", aba: "liberdade" } };
    }
    if (I.tempo.adm == null && I.tempo.desloc == null) {
      return { tipo: "rotina", titulo: "Conte também o tempo fora da quadra",
        texto: "Mensagens, planejamento e deslocamento também são trabalho. Informe as horas por semana para o painel calcular a sua jornada total.",
        beneficio: "Ver a jornada real", financeiro: "—", jornada: "1 minuto", acao: { rotulo: "Informar horas", aba: "liberdade" } };
    }
    return { tipo: "ok", titulo: "Semana dentro das suas metas",
      texto: "Sua jornada está dentro do limite e a sua hora está perto do que a meta pede. Continue registrando as aulas para comparar os meses.",
      beneficio: "Manter o ritmo", financeiro: "—", jornada: "—", acao: { rotulo: "Ver a agenda", aba: "agenda" } };
  }

  var api = { SEMANAS_MES: SEMANAS_MES, DIFICULDADES: DIFICULDADES, FASES: FASES, DIAS: DIAS, faseSugerida: faseSugerida, caminhosSugeridos: caminhosSugeridos,
    aplicarOnboarding: aplicarOnboarding, aulasSemana: aulasSemana, receitaPrevista: receitaPrevista, indicadores: indicadores, sugestao: sugestao, inicioSemana: inicioSemana };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.QLLiberdade = api;
})(typeof window !== "undefined" ? window : globalThis);
