/* Aulas e reposições da Agenda do QuadraLab (agenda-aulas.js): aulas a repor por jogador e turma, vínculo da reposição com
   a aula reposta, "não vai repor", relatório por semana/mês/trimestre. Rode: node tests/check-agenda-aulas.js */
const assert = require("assert"), path = require("path");
const Q = require(path.join(__dirname, "../agenda-aulas.js"));

/* períodos */
assert.deepStrictEqual([Q.periodo("semana", "2026-11-04").inicio, Q.periodo("semana", "2026-11-04").fim], ["2026-11-02", "2026-11-08"]);
assert.deepStrictEqual([Q.periodo("mes", "2026-02-10").inicio, Q.periodo("mes", "2026-02-10").fim], ["2026-02-01", "2026-02-28"]);
assert.deepStrictEqual([Q.periodo("trimestre", "2026-11-04").inicio, Q.periodo("trimestre", "2026-11-04").fim], ["2026-10-01", "2026-12-31"]);
assert.strictEqual(Q.navegar("trimestre", "2026-11-04", -1).slice(0, 7), "2026-08");
assert.strictEqual(Q.navegar("semana", "2026-11-04", 1), "2026-11-11");
assert(/trimestre/.test(Q.periodo("trimestre", "2026-11-04").rotulo));

const hoje = "2026-11-04";
/* Ana: aula fixa às terças 17h (criada em setembro). Turma Sub-12: quartas 18h, Ana e Beto. */
const criado = String(Date.UTC(2026, 8, 1)); // 13 dígitos
const ana = {
  id: "a" + criado, nome: "Ana", duracaoPadrao: "1h", horarios: [{ dia: 2, hora: "17:00" }],
  agendaExcecoes: {
    "2026-10-06|17:00": { status: "cancelada", motivo: "Chuva" },
    "2026-10-13|17:00": { status: "falta" },
    "2026-10-20|17:00": { status: "realizada" },
    "2026-10-27|17:00": { status: "cancelada" },
  },
  agendaAvulsos: [],
  registros: [{ tipo: "sessao", data: "2026-10-21", turma: "Sub-12", presenca: "ausente" }],
};
const beto = { id: "a" + (Number(criado) + 5), nome: "Beto", duracaoPadrao: "1h", horarios: [], agendaExcecoes: {}, agendaAvulsos: [], registros: [{ tipo: "sessao", data: "2026-10-21", turma: "Sub-12", presenca: "presente" }] };
const turma = {
  id: "turma-" + criado, nome: "Sub-12", membros: [ana.id, beto.id], duracaoPadrao: "1h30", horarios: [{ dia: 3, hora: "18:00" }],
  agendaExcecoes: { "2026-10-14|18:00": { status: "cancelada", motivo: "Feriado" } }, agendaAvulsos: [],
};
let alunos = [ana, beto], turmas = [turma];

/* pendentes da Ana: 2 canceladas + 1 falta (agenda), turma cancelada em 14/10, falta no caderno em 21/10 */
let p = Q.pendentesDeReposicao({ alunos, turmas, hoje, tipo: "individual", id: ana.id });
assert.deepStrictEqual(p.map((x) => x.id), ["ag:2026-10-06|17:00", "ag:2026-10-13|17:00", "tc:" + turma.id + "|2026-10-14|18:00", "cad:" + turma.id + "|2026-10-21", "ag:2026-10-27|17:00"]);
assert.strictEqual(p[0].motivo, "Chuva");
assert(/cancelada \(Chuva\)/.test(Q.descreverPerdida(p[0])));
assert.strictEqual(p[1].rotulo, "faltou");
assert.strictEqual(p[0].horaFim, "18:00");
/* turma: só a cancelada dela */
assert.deepStrictEqual(Q.pendentesDeReposicao({ alunos, turmas, hoje, tipo: "turma", id: turma.id }).map((x) => x.id), ["ag:2026-10-14|18:00"]);

/* reposição ligada à aula de 06/10 tira ela da lista; reposição da turma cobre a aula da turma para a Ana também */
ana.agendaAvulsos = [{ id: "av1", data: "2026-11-07", hora: "09:00", horaFim: "10:00", reposicao: true, repoe: "ag:2026-10-06|17:00", repoeTexto: "aula de 06/10 17:00" }];
turma.agendaAvulsos = [{ id: "av2", data: "2026-10-31", hora: "09:00", horaFim: "10:30", reposicao: true, repoe: "ag:2026-10-14|18:00" }];
turma.agendaExcecoes["2026-10-31|09:00"] = { status: "realizada" };
p = Q.pendentesDeReposicao({ alunos, turmas, hoje, tipo: "individual", id: ana.id });
assert.deepStrictEqual(p.map((x) => x.id), ["ag:2026-10-13|17:00", "cad:" + turma.id + "|2026-10-21", "ag:2026-10-27|17:00"]);
assert.strictEqual(Q.pendentesDeReposicao({ alunos, turmas, hoje, tipo: "turma", id: turma.id }).length, 0);
/* a lista completa mostra quem cobriu */
const todas = Q.pendentesDeReposicao({ alunos, turmas, hoje, tipo: "individual", id: ana.id, todas: true });
assert.strictEqual(todas.find((x) => x.id === "ag:2026-10-06|17:00").coberta.id, "av1");

/* reposição cancelada: a aula volta a ficar a repor (e a reposição cancelada não vira outra pendência) */
ana.agendaExcecoes["2026-11-07|09:00"] = { status: "cancelada" };
p = Q.pendentesDeReposicao({ alunos, turmas, hoje, tipo: "individual", id: ana.id });
assert(p.some((x) => x.id === "ag:2026-10-06|17:00"));
assert(!p.some((x) => x.id === "ag:2026-11-07|09:00"));
delete ana.agendaExcecoes["2026-11-07|09:00"];

/* "não vai repor" */
ana.repoDispensadas = ["cad:" + turma.id + "|2026-10-21"];
p = Q.pendentesDeReposicao({ alunos, turmas, hoje, tipo: "individual", id: ana.id });
assert.deepStrictEqual(p.map((x) => x.id), ["ag:2026-10-13|17:00", "ag:2026-10-27|17:00"]);
assert.deepStrictEqual(Q.contagemPendentes({ alunos, turmas, hoje }), { ["individual:" + ana.id]: 2, ["individual:" + beto.id]: 0, ["turma:" + turma.id]: 0 });

/* janela: aula perdida de muito tempo atrás não aparece */
ana.agendaExcecoes["2026-01-06|17:00"] = { status: "cancelada" };
assert(!Q.pendentesDeReposicao({ alunos, turmas, hoje, tipo: "individual", id: ana.id }).some((x) => x.data === "2026-01-06"));
delete ana.agendaExcecoes["2026-01-06|17:00"];

/* relatório de outubro */
const per = Q.periodo("mes", "2026-10-01");
const rel = Q.relatorio({ alunos, turmas, hoje, inicio: per.inicio, fim: per.fim, rotulo: per.rotulo });
const t = rel.totais;
/* Ana: 4 terças (06, 13, 20, 27) · turma: 4 quartas (07, 14, 21, 28) + reposição de 31/10 */
assert.strictEqual(t.realizadas, 1 + 1 + 1, "Ana 20/10, turma 21/10 pelo caderno, reposição da turma 31/10");
assert.strictEqual(t.canceladas, 3);
assert.strictEqual(t.faltas, 1);
assert.strictEqual(t.semRegistro, 2, "turma 07 e 28/10 sem registro");
assert.strictEqual(t.reposicoesDadas, 1);
assert.strictEqual(t.faltasCaderno, 1);
assert.deepStrictEqual(rel.aRepor.map((x) => x.id), ["ag:2026-10-13|17:00", "ag:2026-10-27|17:00"]);
const repTurma = rel.reposicoes.find((r) => r.avulsoId === "av2");
assert.strictEqual(repTurma.situacao, "dada");
assert.strictEqual(repTurma.repoeTexto, "aula de 14/10 18:00");
const linhaAna = rel.porEntidade.find((l) => l.id === ana.id);
assert.deepStrictEqual([linhaAna.realizadas, linhaAna.canceladas, linhaAna.faltas, linhaAna.aRepor, linhaAna.faltasCaderno], [1, 2, 1, 2, 1]);
/* novembro: a reposição marcada para 07/11 e o que ficou de outubro aparece como "de antes" */
const pn = Q.periodo("mes", "2026-11-04");
const reln = Q.relatorio({ alunos, turmas, hoje, inicio: pn.inicio, fim: pn.fim });
assert.strictEqual(reln.totais.reposicoesMarcadas, 1);
assert.strictEqual(reln.reposicoes[0].repoeTexto, "aula de 06/10 17:00");
assert.strictEqual(reln.totais.aReporAntes, 2);
/* aula de antes do cadastro não entra */
const pAntes = Q.periodo("mes", "2026-08-10");
assert.strictEqual(Q.relatorio({ alunos, turmas, hoje, inicio: pAntes.inicio, fim: pAntes.fim }).aulas.length, 0);
/* trimestre e HTML */
const pt = Q.periodo("trimestre", "2026-10-01");
const relt = Q.relatorio({ alunos, turmas, hoje, inicio: pt.inicio, fim: pt.fim, rotulo: pt.rotulo });
const h = Q.html(relt, "Academia X");
assert(/Relatório de aulas e reposições/.test(h) && /Aulas a repor/.test(h) && /Academia X/.test(h) && /aula de 14\/10 18:00/.test(h) && !/undefined|NaN/.test(h));
assert.strictEqual(Q.textoDoId("tc:t1|2026-10-14|18:00"), "aula de 14/10 18:00");
assert.strictEqual(Q.textoDoId("cad:t1|2026-10-21"), "aula de 21/10");
console.log("check-agenda-aulas: ok");
assert.strictEqual(Q.totalPendentes({ alunos, turmas, hoje }), 2);
