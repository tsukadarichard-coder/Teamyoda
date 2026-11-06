/* Aulas e reposições da Agenda (QuadraLab treinador).
   A Agenda do QuadraLab não guarda uma lista de aulas: projeta os horários fixos (`horarios`) de cada jogador/turma em datas
   reais, com as marcações em `agendaExcecoes` ("data|hora" → realizada/cancelada/falta/excluida) e os encontros avulsos em
   `agendaAvulsos` (com `reposicao: true` quando é reposição). Este módulo lê esses mesmos dados, sem gravar nada, e responde:
   · quais aulas ficaram para repor de um jogador ou turma (canceladas, faltas, e para o jogador também as faltas registradas
     no caderno em sessões de turma e as aulas da turma dele que foram canceladas);
   · qual aula cada reposição repõe (o avulso de reposição guarda `repoe` = id da aula perdida);
   · o relatório de um período (semana, mês ou trimestre): aulas dadas, canceladas, faltas, sem registro, reposições dadas
     e marcadas, e o que ainda falta repor.
   Ids das aulas perdidas: "ag:<data>|<hora>" (aula do próprio jogador/turma), "tc:<turmaId>|<data>|<hora>" (aula da turma
   cancelada, vista pelo jogador) e "cad:<turmaId>|<data>" (falta do jogador numa sessão de turma registrada no caderno).
   Uma aula deixa de estar "a repor" quando há reposição ligada a ela que não foi cancelada nem apagada, ou quando o treinador
   marca "não vai repor" (`repoDispensadas` na ficha do jogador ou da turma).
   Navegador: window.QLAgendaAulas; Node (testes): module.exports. */
(function (raiz) {
  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  var DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  var DUR = { "30min": 30, "1h": 60, "1h30": 90, "2h": 120 };
  var JANELA_DIAS = 120; /* aulas perdidas mais antigas que isso não aparecem como pendentes */

  function pad(n) { return String(n).padStart(2, "0"); }
  function iso(d) { return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()); }
  function dataUTC(s) { return new Date(s + "T12:00:00Z"); }
  function somaDias(s, n) { var d = dataUTC(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); }
  function diaSemana(s) { return dataUTC(s).getUTCDay(); }
  function dataBR(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || "")); return m ? m[3] + "/" + m[2] : ""; }
  function dataBRAno(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || "")); return m ? m[3] + "/" + m[2] + "/" + m[1] : ""; }
  function diaCurto(s) { return DIAS[diaSemana(s)]; }
  function minutos(d) { return DUR[d] || 90; }
  function horaMais(h, min) {
    var p = String(h || "00:00").split(":").map(Number), t = p[0] * 60 + p[1] + min;
    return pad(Math.floor(t / 60) % 24) + ":" + pad(t % 60);
  }
  /* quando o jogador/turma passou a existir: ids nascem com Date.now() ("a1730…", "turma-1730…") */
  function criadoEm(ent) {
    if (!ent) return "";
    if (ent.criadoEm) return String(ent.criadoEm).slice(0, 10);
    var m = /(\d{13})/.exec(String(ent.id || ""));
    return m ? new Date(Number(m[1])).toISOString().slice(0, 10) : "";
  }

  /* ── períodos ── */
  function inicioSemana(s) { var w = diaSemana(s); return somaDias(s, w === 0 ? -6 : 1 - w); }
  function periodo(tipo, ref) {
    var a = Number(ref.slice(0, 4)), m = Number(ref.slice(5, 7));
    if (tipo === "semana") {
      var i = inicioSemana(ref), f = somaDias(i, 6);
      return { tipo: tipo, inicio: i, fim: f, rotulo: "Semana de " + dataBR(i) + " a " + dataBR(f) };
    }
    if (tipo === "trimestre") {
      var t = Math.floor((m - 1) / 3), m1 = t * 3 + 1, ultimo = new Date(Date.UTC(a, m1 + 2, 0)).getUTCDate();
      return { tipo: tipo, inicio: a + "-" + pad(m1) + "-01", fim: a + "-" + pad(m1 + 2) + "-" + pad(ultimo), rotulo: (t + 1) + "º trimestre de " + a + " (" + MESES[m1 - 1] + " a " + MESES[m1 + 1] + ")" };
    }
    var u = new Date(Date.UTC(a, m, 0)).getUTCDate();
    return { tipo: "mes", inicio: a + "-" + pad(m) + "-01", fim: a + "-" + pad(m) + "-" + pad(u), rotulo: MESES[m - 1].replace(/^./, function (c) { return c.toUpperCase(); }) + " de " + a };
  }
  /* referência do período anterior/seguinte */
  function navegar(tipo, ref, n) {
    if (tipo === "semana") return somaDias(ref, 7 * n);
    var a = Number(ref.slice(0, 4)), m = Number(ref.slice(5, 7)) - 1 + (tipo === "trimestre" ? 3 * n : n);
    var d = new Date(Date.UTC(a, m, 1));
    return iso(d);
  }

  /* ── caderno: sessões registradas ── */
  function sessoes(alunos) {
    var lista = [];
    (alunos || []).forEach(function (a) {
      (a.registros || []).forEach(function (r) {
        if (r && r.tipo === "sessao" && r.data) lista.push({ alunoId: a.id, data: String(r.data).slice(0, 10), turma: r.turma || "", presenca: r.presenca || "presente" });
      });
    });
    return lista;
  }
  function temSessao(ss, tipo, ent, data) {
    return ss.some(function (s) { return s.data === data && (tipo === "turma" ? s.turma === ent.nome : !s.turma && s.alunoId === ent.id); });
  }

  /* ── reposições de uma ficha ── */
  function reposicoesDe(ent) { return ((ent && ent.agendaAvulsos) || []).filter(function (av) { return av.reposicao; }); }
  function statusAvulso(ent, av) { return (((ent && ent.agendaExcecoes) || {})[av.data + "|" + av.hora] || {}).status || "agendada"; }
  /* a reposição "vale" (cobre a aula perdida) enquanto não for cancelada nem apagada */
  function reposicaoValida(ent, av) { var s = statusAvulso(ent, av); return s !== "cancelada" && s !== "excluida"; }
  function cobertaPor(ent, id) {
    return reposicoesDe(ent).find(function (av) { return av.repoe === id && reposicaoValida(ent, av); }) || null;
  }
  function dispensada(ent, id) { return ((ent && ent.repoDispensadas) || []).indexOf(id) >= 0; }

  /* aulas perdidas de uma ficha, vindas da Agenda (canceladas e faltas), exceto as próprias reposições */
  function perdidasDaAgenda(ent, tipo) {
    var ex = (ent && ent.agendaExcecoes) || {}, out = [];
    Object.keys(ex).forEach(function (chave) {
      var e = ex[chave] || {};
      if (e.status !== "cancelada" && e.status !== "falta") return;
      var p = chave.split("|"), data = p[0], hora = p[1] || "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return;
      var av = ((ent && ent.agendaAvulsos) || []).find(function (x) { return x.data === data && x.hora === hora; });
      if (av && av.reposicao) return; /* reposição cancelada não vira outra aula a repor: a original volta a ficar pendente */
      out.push({
        id: "ag:" + chave, data: data, hora: hora, horaFim: av ? av.horaFim : horaMais(hora, minutos(ent.duracaoPadrao)),
        status: e.status, motivo: e.motivo || "", entTipo: tipo, entId: ent.id, origem: tipo === "turma" ? "turma" : "individual",
        rotulo: e.status === "falta" ? (tipo === "turma" ? "falta registrada" : "faltou") : "cancelada",
      });
    });
    return out;
  }

  /* Aulas a repor de um jogador (tipo "individual") ou turma, da mais antiga para a mais nova.
     `todas: true` traz também as já cobertas e as dispensadas, com `coberta`/`dispensada` marcados. */
  function pendentesDeReposicao(o) {
    var alunos = o.alunos || [], turmas = o.turmas || [], hoje = o.hoje || iso(new Date());
    var desde = o.desde || somaDias(hoje, -JANELA_DIAS);
    var ent = o.tipo === "turma" ? turmas.find(function (t) { return t.id === o.id; }) : alunos.find(function (a) { return a.id === o.id; });
    if (!ent) return [];
    var lista = perdidasDaAgenda(ent, o.tipo === "turma" ? "turma" : "individual").map(function (p) {
      return Object.assign(p, { nome: ent.nome || "", coberta: cobertaPor(ent, p.id), dispensada: dispensada(ent, p.id) });
    });
    if (o.tipo !== "turma") {
      turmas.filter(function (t) { return (t.membros || []).indexOf(ent.id) >= 0; }).forEach(function (t) {
        /* aula da turma cancelada: o jogador também perdeu (reposta pela turma ou só para ele) */
        perdidasDaAgenda(t, "turma").filter(function (p) { return p.status === "cancelada"; }).forEach(function (p) {
          var id = "tc:" + t.id + "|" + p.data + "|" + p.hora;
          lista.push(Object.assign({}, p, {
            id: id, idTurma: p.id, nome: t.nome || "Turma", origem: "turma-cancelada", rotulo: "aula da turma " + (t.nome || "") + " cancelada",
            coberta: cobertaPor(ent, id) || cobertaPor(t, p.id), dispensada: dispensada(ent, id) || dispensada(t, p.id),
          }));
        });
      });
      /* faltou numa sessão de turma registrada no caderno */
      sessoes([ent]).filter(function (s) { return s.turma && s.presenca === "ausente"; }).forEach(function (s) {
        var t = turmas.find(function (x) { return x.nome === s.turma; });
        var id = "cad:" + (t ? t.id : s.turma) + "|" + s.data;
        if (lista.some(function (x) { return x.id === id; })) return;
        lista.push({
          id: id, data: s.data, hora: "", horaFim: "", status: "falta", motivo: "", entTipo: "individual", entId: ent.id, origem: "caderno",
          nome: s.turma, rotulo: "faltou na turma " + s.turma, coberta: cobertaPor(ent, id), dispensada: dispensada(ent, id),
        });
      });
    }
    lista = lista.filter(function (p) { return p.data >= desde && (!o.ate || p.data <= o.ate); });
    if (!o.todas) lista = lista.filter(function (p) { return !p.coberta && !p.dispensada; });
    return lista.sort(function (a, b) { return (a.data + a.hora).localeCompare(b.data + b.hora); });
  }

  /* quantas aulas a repor cada ficha tem (para mostrar ao escolher para quem é a reposição) */
  function contagemPendentes(o) {
    var c = {};
    (o.alunos || []).forEach(function (a) { c["individual:" + a.id] = pendentesDeReposicao(Object.assign({}, o, { tipo: "individual", id: a.id })).length; });
    (o.turmas || []).forEach(function (t) { c["turma:" + t.id] = pendentesDeReposicao(Object.assign({}, o, { tipo: "turma", id: t.id })).length; });
    return c;
  }

  /* "aula de 12/10 17:00" a partir do id da aula perdida (quando a reposição não guardou o texto) */
  function textoDoId(id) {
    var p = String(id || "").split("|"), cab = p[0].split(":"), data, hora;
    if (cab[0] === "ag") { data = cab.slice(1).join(":"); hora = p[1]; }
    else if (cab[0] === "tc") { data = p[1]; hora = p[2]; }
    else if (cab[0] === "cad") { data = p[1]; }
    return /^\d{4}-\d{2}-\d{2}$/.test(data || "") ? "aula de " + dataBR(data) + (hora ? " " + hora : "") : "";
  }
  /* total de aulas a repor da academia, sem contar duas vezes a aula de turma cancelada (que aparece em cada jogador) */
  function totalPendentes(o) {
    var n = 0;
    (o.alunos || []).forEach(function (a) { n += pendentesDeReposicao(Object.assign({}, o, { tipo: "individual", id: a.id })).filter(function (p) { return p.origem !== "turma-cancelada"; }).length; });
    (o.turmas || []).forEach(function (t) { n += pendentesDeReposicao(Object.assign({}, o, { tipo: "turma", id: t.id })).length; });
    return n;
  }
  /* texto curto de uma aula perdida: "12/10 ter 17:00 · cancelada (Chuva)" */
  function descreverPerdida(p) {
    return dataBR(p.data) + " " + diaCurto(p.data) + (p.hora ? " " + p.hora : "") + " · " + p.rotulo + (p.motivo ? " (" + p.motivo + ")" : "");
  }

  /* ── aulas de um período ── */
  function aulasDoPeriodo(o) {
    var alunos = o.alunos || [], turmas = o.turmas || [], hoje = o.hoje || iso(new Date()), ss = sessoes(alunos), aulas = [];
    function processar(ent, tipo) {
      var desde = criadoEm(ent), vistas = {};
      var ex = ent.agendaExcecoes || {};
      function status(chave, data, avulso) {
        var s = (ex[chave] || {}).status;
        if (s === "excluida") return null;
        if (s === "realizada" || s === "cancelada" || s === "falta") return s;
        if (data > hoje) return "agendada";
        if (temSessao(ss, tipo, ent, data)) return "realizada";
        return data === hoje ? "hoje" : "semRegistro";
      }
      function add(data, hora, horaFim, avulso) {
        var chave = data + "|" + hora;
        if (vistas[chave]) return;
        vistas[chave] = 1;
        var st = status(chave, data, avulso);
        if (!st) return;
        var e = ex[chave] || {};
        aulas.push({
          id: "ag:" + chave, chave: chave, entTipo: tipo, entId: ent.id, nome: ent.nome || (tipo === "turma" ? "Turma sem nome" : "Sem nome"),
          data: data, hora: hora, horaFim: horaFim, status: st, motivo: e.motivo || "",
          fonte: e.status ? "agenda" : st === "realizada" ? "caderno" : "agenda",
          reposicao: !!(avulso && avulso.reposicao), repoe: avulso && avulso.repoe || null, repoeTexto: avulso && avulso.repoeTexto || "", avulsoId: avulso ? avulso.id : null,
        });
      }
      (ent.agendaAvulsos || []).forEach(function (av) { if (av.data >= o.inicio && av.data <= o.fim) add(av.data, av.hora, av.horaFim, av); });
      for (var d = o.inicio; d <= o.fim; d = somaDias(d, 1)) {
        if (desde && d < desde) continue;
        var w = diaSemana(d);
        (ent.horarios || []).forEach(function (h) { if (h.dia === w) add(d, h.hora, horaMais(h.hora, minutos(ent.duracaoPadrao)), null); });
      }
      /* marcação de um horário fixo que depois mudou: a aula aconteceu (ou foi cancelada) mesmo assim */
      Object.keys(ex).forEach(function (chave) {
        var p = chave.split("|");
        if (p[0] >= o.inicio && p[0] <= o.fim && ex[chave] && ex[chave].status && ex[chave].status !== "excluida") add(p[0], p[1] || "", horaMais(p[1] || "00:00", minutos(ent.duracaoPadrao)), null);
      });
    }
    alunos.filter(function (a) { return a.nome; }).forEach(function (a) { processar(a, "individual"); });
    turmas.forEach(function (t) { processar(t, "turma"); });
    return aulas.sort(function (a, b) { return (a.data + a.hora).localeCompare(b.data + b.hora) || a.nome.localeCompare(b.nome); });
  }

  /* ── relatório do período ── */
  function relatorio(o) {
    var alunos = o.alunos || [], turmas = o.turmas || [], hoje = o.hoje || iso(new Date());
    var aulas = aulasDoPeriodo(o);
    var porEnt = {};
    function linha(tipo, id, nome) {
      var k = tipo + ":" + id;
      if (!porEnt[k]) porEnt[k] = { chave: k, tipo: tipo, id: id, nome: nome, realizadas: 0, canceladas: 0, faltas: 0, semRegistro: 0, agendadas: 0, reposicoesDadas: 0, reposicoesMarcadas: 0, aRepor: 0, faltasCaderno: 0 };
      return porEnt[k];
    }
    var t = { aulas: 0, realizadas: 0, canceladas: 0, faltas: 0, semRegistro: 0, agendadas: 0, reposicoesDadas: 0, reposicoesMarcadas: 0, reposicoesNaoFeitas: 0, aRepor: 0, aReporAntes: 0, faltasCaderno: 0 };
    var reposicoes = [];
    aulas.forEach(function (a) {
      var l = linha(a.entTipo, a.entId, a.nome), fut = a.status === "agendada" || a.status === "hoje";
      if (!fut) t.aulas++;
      if (a.status === "realizada") { t.realizadas++; l.realizadas++; }
      else if (a.status === "cancelada") { t.canceladas++; l.canceladas++; }
      else if (a.status === "falta") { t.faltas++; l.faltas++; }
      else if (a.status === "semRegistro") { t.semRegistro++; l.semRegistro++; }
      else { t.agendadas++; l.agendadas++; }
      if (a.reposicao) {
        var situacao = a.status === "realizada" ? "dada" : a.status === "cancelada" ? "cancelada" : a.status === "falta" ? "faltou" : a.status === "semRegistro" ? "semRegistro" : "marcada";
        if (situacao === "dada") { t.reposicoesDadas++; l.reposicoesDadas++; }
        else if (situacao === "marcada" || situacao === "semRegistro") { t.reposicoesMarcadas++; l.reposicoesMarcadas++; }
        else t.reposicoesNaoFeitas++;
        reposicoes.push(Object.assign({}, a, { situacao: situacao }));
      }
    });
    /* faltas registradas no caderno em sessões de turma, dentro do período */
    sessoes(alunos).forEach(function (s) {
      if (!s.turma || s.presenca !== "ausente" || s.data < o.inicio || s.data > o.fim) return;
      var al = alunos.find(function (a) { return a.id === s.alunoId; });
      if (!al) return;
      t.faltasCaderno++; linha("individual", al.id, al.nome || "Sem nome").faltasCaderno++;
    });
    /* o que falta repor: aulas perdidas dentro do período (e as anteriores ainda em aberto, em separado) */
    var aRepor = [], antes = [];
    function juntar(tipo, ent) {
      var lista = pendentesDeReposicao({ alunos: alunos, turmas: turmas, hoje: hoje, tipo: tipo, id: ent.id, desde: somaDias(o.inicio, -JANELA_DIAS), ate: o.fim });
      /* a aula da turma cancelada já aparece na própria turma: no jogador só entra o que é só dele */
      if (tipo === "individual") lista = lista.filter(function (p) { return p.origem !== "turma-cancelada"; });
      lista.forEach(function (p) {
        var item = Object.assign({}, p, { entNome: ent.nome || "", entTipo: tipo, entId: ent.id });
        if (p.data >= o.inicio) { aRepor.push(item); linha(tipo, ent.id, ent.nome || "").aRepor++; } else antes.push(item);
      });
    }
    alunos.filter(function (a) { return a.nome; }).forEach(function (a) { juntar("individual", a); });
    turmas.forEach(function (tt) { juntar("turma", tt); });
    t.aRepor = aRepor.length; t.aReporAntes = antes.length;
    /* o que cada reposição repôs, em texto */
    reposicoes.forEach(function (r) { if (!r.repoeTexto && r.repoe) r.repoeTexto = textoDoId(r.repoe); });
    var porEntidade = Object.keys(porEnt).map(function (k) { return porEnt[k]; }).sort(function (a, b) { return a.nome.localeCompare(b.nome); });
    return {
      tipo: o.tipoPeriodo || "", inicio: o.inicio, fim: o.fim, rotulo: o.rotulo || (dataBR(o.inicio) + " a " + dataBR(o.fim)), hoje: hoje,
      aulas: aulas, totais: t, porEntidade: porEntidade, reposicoes: reposicoes,
      aRepor: aRepor.sort(function (a, b) { return (a.data + a.hora).localeCompare(b.data + b.hora); }),
      aReporAntes: antes.sort(function (a, b) { return (a.data + a.hora).localeCompare(b.data + b.hora); }),
    };
  }

  /* ── PDF / impressão ── */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  var ROTULO = { realizada: "Dada", cancelada: "Cancelada", falta: "Falta", semRegistro: "Sem registro", agendada: "Agendada", hoje: "Hoje" };
  var SITUACAO_REPO = { dada: "Dada", marcada: "Marcada", semRegistro: "Passou sem registro", cancelada: "Cancelada (a aula volta a ficar a repor)", faltou: "Aluno faltou na reposição" };
  var ESTILO = 'body{font-family:-apple-system,system-ui,"Segoe UI",sans-serif;color:#141210;max-width:760px;margin:28px auto;padding:0 18px}' +
    'h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:24px 0 8px}.sub{color:#6B6461;font-size:13px;margin-bottom:16px}' +
    'table{width:100%;border-collapse:collapse;font-size:12.5px}th,td{text-align:left;padding:6px 6px;border-bottom:1px solid #E4DED9;vertical-align:top}th{font-size:11px;color:#6B6461;text-transform:uppercase;letter-spacing:.03em}' +
    'td.n,th.n{text-align:right}.tiles{display:flex;flex-wrap:wrap;gap:8px}.tile{border:1px solid #E4DED9;border-radius:8px;padding:8px 12px;min-width:96px}.tile b{display:block;font-size:18px}.tile span{font-size:11px;color:#6B6461}' +
    '.alerta{color:#8A6100;font-weight:700}tr{break-inside:avoid}.no-print{margin-top:20px;display:flex;gap:10px}@media print{.no-print{display:none !important}}';
  function tile(r, v) { return '<div class="tile"><span>' + esc(r) + '</span><b>' + esc(v) + '</b></div>'; }
  function html(rel, academia) {
    var t = rel.totais;
    var repor = rel.aRepor.map(function (p) {
      return '<tr><td>' + dataBR(p.data) + ' ' + diaCurto(p.data) + (p.hora ? ' ' + esc(p.hora) : '') + '</td><td>' + esc(p.entNome) + (p.entTipo === "turma" ? ' <i>(turma)</i>' : '') + '</td><td>' + esc(p.rotulo) + (p.motivo ? ' (' + esc(p.motivo) + ')' : '') + '</td></tr>';
    }).join("");
    var repos = rel.reposicoes.map(function (r) {
      return '<tr><td>' + dataBR(r.data) + ' ' + diaCurto(r.data) + ' ' + esc(r.hora) + '</td><td>' + esc(r.nome) + (r.entTipo === "turma" ? ' <i>(turma)</i>' : '') + '</td><td>' + esc(r.repoeTexto || "—") + '</td><td>' + esc(SITUACAO_REPO[r.situacao] || r.situacao) + '</td></tr>';
    }).join("");
    var ents = rel.porEntidade.map(function (l) {
      return '<tr><td>' + esc(l.nome) + (l.tipo === "turma" ? ' <i>(turma)</i>' : '') + '</td><td class="n">' + l.realizadas + '</td><td class="n">' + l.canceladas + '</td><td class="n">' + (l.faltas + l.faltasCaderno) + '</td><td class="n">' + l.semRegistro + '</td><td class="n">' + l.reposicoesDadas + '</td><td class="n">' + l.reposicoesMarcadas + '</td><td class="n' + (l.aRepor ? ' alerta' : '') + '">' + l.aRepor + '</td></tr>';
    }).join("");
    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de aulas · ' + esc(rel.rotulo) + '</title><style>' + ESTILO + '</style></head><body>' +
      (academia ? '<div class="sub" style="margin-bottom:4px">' + esc(academia) + '</div>' : '') +
      '<h1>Relatório de aulas e reposições</h1><div class="sub">' + esc(rel.rotulo) + ' · ' + dataBRAno(rel.inicio) + ' a ' + dataBRAno(rel.fim) + '</div>' +
      '<div class="tiles">' + tile("Aulas dadas", t.realizadas) + tile("Canceladas", t.canceladas) + tile("Faltas", t.faltas + t.faltasCaderno) + tile("Sem registro", t.semRegistro) +
      tile("Reposições dadas", t.reposicoesDadas) + tile("Reposições marcadas", t.reposicoesMarcadas) + tile("A repor", t.aRepor) + '</div>' +
      (t.aReporAntes ? '<p class="sub alerta" style="margin-top:10px">Além destas, ' + t.aReporAntes + ' aula' + (t.aReporAntes === 1 ? '' : 's') + ' de antes deste período ainda ' + (t.aReporAntes === 1 ? 'está' : 'estão') + ' a repor.</p>' : '') +
      '<h2>Aulas a repor</h2><table><thead><tr><th>Aula perdida</th><th>Jogador ou turma</th><th>O que houve</th></tr></thead><tbody>' + (repor || '<tr><td colspan="3">Nenhuma aula a repor neste período.</td></tr>') + '</tbody></table>' +
      '<h2>Reposições</h2><table><thead><tr><th>Reposição</th><th>Jogador ou turma</th><th>Repõe</th><th>Situação</th></tr></thead><tbody>' + (repos || '<tr><td colspan="4">Nenhuma reposição neste período.</td></tr>') + '</tbody></table>' +
      '<h2>Por jogador e turma</h2><table><thead><tr><th>Nome</th><th class="n">Dadas</th><th class="n">Cancel.</th><th class="n">Faltas</th><th class="n">Sem reg.</th><th class="n">Repos. dadas</th><th class="n">Repos. marcadas</th><th class="n">A repor</th></tr></thead><tbody>' +
      (ents || '<tr><td colspan="8">Nenhuma aula neste período.</td></tr>') + '</tbody></table>' +
      '<div class="no-print"><button onclick="window.print()" style="padding:10px 16px;font-weight:700;cursor:pointer">Salvar como PDF / Imprimir</button>' +
      '<button onclick="window.close()" style="padding:10px 16px;font-weight:700;cursor:pointer;background:transparent;border:1px solid #14121055">← Voltar ao app</button></div></body></html>';
  }

  var api = {
    JANELA_DIAS: JANELA_DIAS, ROTULO: ROTULO, SITUACAO_REPO: SITUACAO_REPO,
    periodo: periodo, navegar: navegar, dataBR: dataBR, diaCurto: diaCurto, somaDias: somaDias,
    pendentesDeReposicao: pendentesDeReposicao, contagemPendentes: contagemPendentes, totalPendentes: totalPendentes, descreverPerdida: descreverPerdida, textoDoId: textoDoId,
    reposicoesDe: reposicoesDe, aulasDoPeriodo: aulasDoPeriodo, relatorio: relatorio, html: html,
  };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.QLAgendaAulas = api;
})(typeof window !== "undefined" ? window : this);
