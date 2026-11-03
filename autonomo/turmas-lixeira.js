/* Turmas apagadas: lixeira e reconstrução.
   · Lixeira: ao remover uma turma, ela inteira (membros, horários, plano, exceções da agenda) vai para a nuvem da academia em
     "mty:lixeira-turmas:v1" e pode ser recuperada por 90 dias, igual estava.
   · Reconstrução: turmas apagadas antes de existir a lixeira não têm cópia. O que sobra delas são os rastros: as aulas da Agenda
     (Team Yoda: cada aula guarda o id da turma, o horário, o professor e quem estava) e as sessões do caderno de cada jogador (guardam
     o nome da turma e a data). Daí saem nome, jogadores, dias e horários, duração e professor. O planejamento da turma não deixa rastro.
   QLTurmasLixeira.criar(storage) → { listar(), guardar(turma, quem), tirar(id) }
   QLTurmasLixeira.reconstruir({ turmas, alunos, ocorrencias, hoje }) → [{ turma, aulas, ultima, fonte }]
   Este arquivo é igual em autonomo/ e mty/. */
(function (raiz, fab) {
  if (typeof module === "object" && module.exports) module.exports = fab();
  else raiz.QLTurmasLixeira = fab();
})(typeof self !== "undefined" ? self : this, function () {
  var CHAVE = "mty:lixeira-turmas:v1", DIAS = 90, MAX = 60;
  var DUR = [[30, "30min"], [60, "1h"], [90, "1h30"], [120, "2h"]];

  function lerJSON(v, padrao) { try { var x = JSON.parse(v); return x == null ? padrao : x; } catch (e) { return padrao; } }
  function hojeISO() { return new Date().toISOString().slice(0, 10); }
  function somaDias(iso, n) { return new Date(new Date(iso + "T12:00:00Z").getTime() + n * 86400000).toISOString().slice(0, 10); }
  function diaSemana(iso) { return new Date(iso + "T12:00:00Z").getUTCDay(); }
  function minutos(a, b) { var x = String(a).split(":"), y = String(b).split(":"); return (+y[0] * 60 + +y[1]) - (+x[0] * 60 + +x[1]); }
  function duracaoDe(min) { var m = DUR[0]; DUR.forEach(function (d) { if (Math.abs(d[0] - min) < Math.abs(m[0] - min)) m = d; }); return m[1]; }
  function maisFrequente(lista) {
    var c = {}, melhor = null;
    lista.forEach(function (x) { if (x == null || x === "") return; var k = typeof x === "string" ? x : JSON.stringify(x); c[k] = (c[k] || 0) + 1; if (!melhor || c[k] > c[melhor]) melhor = k; });
    return melhor;
  }
  function validos(lista, hoje) {
    var limite = somaDias(hoje || hojeISO(), -DIAS);
    return (Array.isArray(lista) ? lista : []).filter(function (x) { return x && x.turma && x.turma.id && String(x.removidaEm || "").slice(0, 10) >= limite; });
  }

  function criar(storage) {
    function ler() { return Promise.resolve(storage && storage.get ? storage.get(CHAVE, true) : null).then(function (r) { return lerJSON(r && r.value, []); }); }
    function gravar(l) { return Promise.resolve(storage.set(CHAVE, JSON.stringify(l), true)); }
    return {
      listar: function () { return ler().then(function (l) { return validos(l).sort(function (a, b) { return String(b.removidaEm).localeCompare(String(a.removidaEm)); }); }); },
      /* guarda a turma inteira antes de sair da lista (a mesma turma apagada de novo fica só com a versão mais nova) */
      guardar: function (turma, quem) {
        if (!turma || !turma.id) return Promise.resolve();
        return ler().then(function (l) {
          var nova = validos(l).filter(function (x) { return x.turma.id !== turma.id; });
          nova.unshift({ turma: JSON.parse(JSON.stringify(turma)), removidaEm: new Date().toISOString(), por: quem || "" });
          return gravar(nova.slice(0, MAX));
        });
      },
      tirar: function (id) { return ler().then(function (l) { return gravar(validos(l).filter(function (x) { return x.turma.id !== id; })); }); },
    };
  }

  /* Turmas que sumiram da lista mas deixaram rastro na Agenda (por id) ou no caderno (por nome). */
  function reconstruir(o) {
    o = o || {};
    var turmas = o.turmas || [], alunos = o.alunos || [], ocs = o.ocorrencias || [], hoje = o.hoje || hojeISO();
    var ids = new Set(turmas.map(function (t) { return t.id; })), nomes = new Set(turmas.map(function (t) { return String(t.nome || "").trim().toLowerCase(); }));
    /* sessões de turma no caderno: nome da turma, data, jogador */
    var sessoes = [];
    alunos.forEach(function (a) {
      (a.registros || []).forEach(function (r) { if (r && r.tipo === "sessao" && r.turma && r.data) sessoes.push({ nome: String(r.turma).trim(), data: String(r.data).slice(0, 10), alunoId: a.id, duracao: r.duracao, presente: r.presenca !== "ausente" }); });
    });
    var saida = [], nomesUsados = new Set();

    /* 1. pela Agenda: aulas de turma cujo id não existe mais */
    var porId = {};
    ocs.forEach(function (oc) { if (oc && oc.origemTipo === "turma" && oc.origemId && !ids.has(oc.origemId)) (porId[oc.origemId] = porId[oc.origemId] || []).push(oc); });
    Object.keys(porId).forEach(function (id) {
      var lista = porId[id].slice().sort(function (a, b) { return String(a.data).localeCompare(String(b.data)); });
      var desde = somaDias(hoje, -70), recentes = lista.filter(function (oc) { return oc.data >= desde; });
      if (!recentes.length) recentes = lista.slice(-10);
      /* horários: as recorrências das aulas recentes (dia da semana + hora, e a quadra) */
      var hs = {};
      recentes.forEach(function (oc) {
        if (!oc.recorrenciaChave || !oc.horaInicio) return;
        var k = diaSemana(oc.data) + "|" + oc.horaInicio;
        if (!hs[k]) hs[k] = { dia: diaSemana(oc.data), hora: oc.horaInicio, quadraId: oc.quadraId || "" };
      });
      var horarios = Object.keys(hs).map(function (k) { var h = hs[k]; return h.quadraId ? h : { dia: h.dia, hora: h.hora }; }).sort(function (a, b) { return a.dia - b.dia || a.hora.localeCompare(b.hora); });
      /* jogadores: quem estava nas aulas recentes (lista guardada ao marcar a aula) */
      var membros = [];
      recentes.forEach(function (oc) {
        (Array.isArray(oc.membrosNaAula) ? oc.membrosNaAula : []).concat(Object.keys(oc.presencas || {})).forEach(function (m) { if (membros.indexOf(m) < 0) membros.push(m); });
      });
      /* nome: sessões do caderno no mesmo dia, de jogadores desta turma */
      var datas = new Set(lista.map(function (oc) { return oc.data; }));
      var nomeCad = maisFrequente(sessoes.filter(function (s) { return datas.has(s.data) && (!membros.length || membros.indexOf(s.alunoId) >= 0); }).map(function (s) { return s.nome; }));
      if (nomeCad) {
        nomesUsados.add(nomeCad.toLowerCase());
      }
      if (!membros.length && nomeCad) sessoes.filter(function (s) { return s.nome === nomeCad && s.data >= desde; }).forEach(function (s) { if (membros.indexOf(s.alunoId) < 0) membros.push(s.alunoId); });
      membros = membros.filter(function (m) { return alunos.some(function (a) { return a.id === m; }); });
      var ult = lista[lista.length - 1], prof = maisFrequente(recentes.map(function (oc) { return oc.professorUid ? { uid: oc.professorUid, nome: oc.professorNome || "" } : null; }));
      var aux = maisFrequente(recentes.map(function (oc) { return oc.professorAuxiliarUid ? { uid: oc.professorAuxiliarUid, nome: oc.professorAuxiliarNome || "" } : null; }));
      var durMin = maisFrequente(recentes.filter(function (oc) { return oc.horaInicio && oc.horaFim; }).map(function (oc) { return String(minutos(oc.horaInicio, oc.horaFim)); }));
      prof = prof ? JSON.parse(prof) : null; aux = aux ? JSON.parse(aux) : null;
      var semana = horarios.map(function (h) { return ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][h.dia] + " " + h.hora; }).join(", ");
      saida.push({
        fonte: "agenda", aulas: lista.length, ultima: ult.data, primeira: lista[0].data,
        turma: {
          id: id, nome: nomeCad || ("Turma recuperada" + (semana ? " (" + semana + ")" : "")), membros: membros,
          duracaoPadrao: durMin ? duracaoDe(+durMin) : "1h30", horarios: horarios,
          professorUid: prof ? prof.uid : "", professorNome: prof ? prof.nome : "",
          professorAuxiliarUid: aux ? aux.uid : "", professorAuxiliarNome: aux ? aux.nome : "",
          agendaExcecoes: {}, agendaAvulsos: [], criadoEm: lista[0].data + "T12:00:00.000Z", recuperada: true,
        },
      });
    });

    /* 2. pelo caderno: nome de turma que não existe mais (e não veio da Agenda) */
    var porNome = {};
    sessoes.forEach(function (s) { var k = s.nome.toLowerCase(); if (!nomes.has(k) && !nomesUsados.has(k)) (porNome[s.nome] = porNome[s.nome] || []).push(s); });
    Object.keys(porNome).forEach(function (nome) {
      var lista = porNome[nome].sort(function (a, b) { return a.data.localeCompare(b.data); });
      var desde = somaDias(lista[lista.length - 1].data, -70);
      var membros = [];
      lista.forEach(function (s) { if (s.data >= desde && membros.indexOf(s.alunoId) < 0) membros.push(s.alunoId); });
      var datas = Array.from(new Set(lista.map(function (s) { return s.data; })));
      /* dias da semana em que a turma costumava treinar (a hora não fica no caderno: o treinador completa) */
      var dias = {};
      datas.filter(function (d) { return d >= desde; }).forEach(function (d) { var w = diaSemana(d); dias[w] = (dias[w] || 0) + 1; });
      var diasFreq = Object.keys(dias).map(Number).filter(function (w) { return dias[w] >= 2 || Object.keys(dias).length === 1; }).sort();
      var dur = maisFrequente(lista.map(function (s) { return s.duracao; }));
      saida.push({
        fonte: "caderno", aulas: datas.length, ultima: datas[datas.length - 1], primeira: datas[0], diasSemana: diasFreq,
        turma: {
          id: "turma-rec-" + Date.now().toString(36) + "-" + saida.length, nome: nome, membros: membros, duracaoPadrao: dur || "1h30",
          horarios: [], professorUid: "", professorNome: "", professorAuxiliarUid: "", professorAuxiliarNome: "",
          agendaExcecoes: {}, agendaAvulsos: [], criadoEm: datas[0] + "T12:00:00.000Z", recuperada: true,
        },
      });
    });
    return saida.filter(function (x) { return x.turma.membros.length > 0; }).sort(function (a, b) { return String(b.ultima).localeCompare(String(a.ultima)); });
  }

  return { CHAVE: CHAVE, DIAS: DIAS, criar: criar, reconstruir: reconstruir };
});
