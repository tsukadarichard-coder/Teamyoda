/* Team Yoda (mty/aulas-mes.js): aulas a repor por aluno e turma, vínculo da reposição com a aula reposta (direto ou pelo
   crédito), "não vai repor", períodos semana/mês/trimestre e reposições do período. Rode: node tests/check-reposicoes-ty.js */
const assert = require("assert"), path = require("path");
const M = require(path.join(__dirname, "../../mty/aulas-mes.js"));

assert.deepStrictEqual([M.periodo("semana", "2026-11-04").inicio, M.periodo("semana", "2026-11-04").fim], ["2026-11-02", "2026-11-08"]);
assert.deepStrictEqual([M.periodo("trimestre", "2026-11-04").inicio, M.periodo("trimestre", "2026-11-04").fim], ["2026-10-01", "2026-12-31"]);
assert.strictEqual(M.periodo("mes", "2026-10-20").rotulo, "Outubro de 2026");
assert.strictEqual(M.navegarPeriodo("trimestre", "2026-11-04", -1), "2026-08-01");
assert.strictEqual(M.navegarPeriodo("semana", "2026-11-04", -1), "2026-10-28");

const hoje = "2026-11-04";
const oc = (id, o) => ({ id, horaInicio: "17:00", horaFim: "18:00", tipo: "regular", status: "agendada", presencas: {}, ...o });
const ocorrencias = [
  oc("o1", { origemTipo: "individual", origemId: "a1", data: "2026-10-06", status: "cancelada", motivoCancelamento: "Chuva" }),
  oc("o2", { origemTipo: "individual", origemId: "a1", data: "2026-10-13", status: "realizada", presencas: { a1: "falta" } }),
  oc("o3", { origemTipo: "turma", origemId: "t1", data: "2026-10-14", horaInicio: "18:00", status: "cancelada", motivoCancelamento: "Feriado", membrosNaAula: ["a1", "a2"] }),
  oc("o4", { origemTipo: "turma", origemId: "t1", data: "2026-10-21", horaInicio: "18:00", status: "realizada", presencas: { a1: "presente", a2: "falta" }, membrosNaAula: ["a1", "a2"] }),
];
const alunos = [{ id: "a1", nome: "Ana", creditosReposicao: [] }, { id: "a2", nome: "Beto", creditosReposicao: [] }];
const turmas = [{ id: "t1", nome: "Sub-12", membros: ["a1", "a2"] }];
const base = { ocorrencias, alunos, turmas, hoje };

let p = M.pendentesDeReposicao({ ...base, tipo: "individual", id: "a1" });
assert.deepStrictEqual(p.map((x) => x.id), ["o1", "o2", "o3"]);
assert.deepStrictEqual(p.map((x) => x.rotulo), ["cancelada", "faltou", "aula da turma Sub-12 cancelada"]);
assert(/cancelada \(Chuva\)/.test(M.textoPerdida(p[0])));
assert.deepStrictEqual(M.pendentesDeReposicao({ ...base, tipo: "individual", id: "a2" }).map((x) => x.rotulo), ["aula da turma Sub-12 cancelada", "faltou na turma Sub-12"]);
assert.deepStrictEqual(M.pendentesDeReposicao({ ...base, tipo: "turma", id: "t1" }).map((x) => x.id), ["o3"]);
/* academia: a aula de turma cancelada conta uma vez só */
assert.deepStrictEqual(M.todasPendentes(base).map((x) => x.entNome + ":" + x.id), ["Ana:o1", "Ana:o2", "Sub-12:o3", "Beto:o4"]);

/* reposição ligada (direto), crédito reservado, reposição da turma e "não vai repor" */
ocorrencias.push(oc("r1", { origemTipo: "individual", origemId: "a1", data: "2026-11-07", tipo: "reposicao", repoeAulaId: "o1", repoeTexto: "aula de 06/10 ter 17:00 · cancelada (Chuva)" }));
ocorrencias.push(oc("r2", { origemTipo: "individual", origemId: "a2", data: "2026-10-30", tipo: "reposicao", status: "realizada" }));
alunos[1].creditosReposicao.push({ id: "c1", origemOcorrenciaId: "o4", status: "utilizado", ocorrenciaReposicaoId: "r2", movimentacoes: [] });
ocorrencias.push(oc("r3", { origemTipo: "turma", origemId: "t1", data: "2026-10-31", tipo: "reposicao", status: "realizada", repoeAulaId: "o3" }));
alunos[0].repoDispensadas = ["o2"];
assert.deepStrictEqual(M.pendentesDeReposicao({ ...base, tipo: "individual", id: "a1" }), []);
assert.deepStrictEqual(M.pendentesDeReposicao({ ...base, tipo: "individual", id: "a2" }), []);
assert.deepStrictEqual(M.pendentesDeReposicao({ ...base, tipo: "turma", id: "t1" }), []);
const todasA1 = M.pendentesDeReposicao({ ...base, tipo: "individual", id: "a1", todas: true });
assert.strictEqual(todasA1.find((x) => x.id === "o1").coberta.id, "r1");
assert(todasA1.find((x) => x.id === "o2").dispensada);
/* reposição cancelada: a aula volta para a lista */
ocorrencias.find((o) => o.id === "r1").status = "cancelada";
assert.deepStrictEqual(M.pendentesDeReposicao({ ...base, tipo: "individual", id: "a1" }).map((x) => x.id), ["o1"]);
ocorrencias.find((o) => o.id === "r1").status = "agendada";
/* crédito disponível aparece junto; vencido tira da lista */
ocorrencias.push(oc("o5", { origemTipo: "individual", origemId: "a1", data: "2026-10-20", status: "cancelada" }));
alunos[0].creditosReposicao.push({ id: "c2", origemOcorrenciaId: "o5", status: "disponivel", movimentacoes: [] });
assert.strictEqual(M.pendentesDeReposicao({ ...base, tipo: "individual", id: "a1" })[0].credito.status, "disponivel");
alunos[0].creditosReposicao[0].validoAte = "2026-11-01";
assert.deepStrictEqual(M.pendentesDeReposicao({ ...base, tipo: "individual", id: "a1" }), []);
delete alunos[0].creditosReposicao[0].validoAte;
assert.deepStrictEqual(M.contagemPendentes(base), { "individual:a1": 1, "individual:a2": 0, "turma:t1": 0 });

/* reposições de outubro: r2 (pelo crédito) e r3 (direto) dadas; o5 a repor */
const per = M.periodo("mes", "2026-10-01");
const rp = M.reposicoesDoPeriodo({ ...base, inicio: per.inicio, fim: per.fim });
assert.deepStrictEqual(rp.lista.map((r) => [r.id, r.situacao, r.repoeTexto]), [["r2", "dada", "aula de 21/10 18:00"], ["r3", "dada", "aula de 14/10 18:00"]]);
assert.deepStrictEqual(rp.aRepor.map((x) => x.id), ["o5"]);
assert.deepStrictEqual([rp.totais.dadas, rp.totais.aRepor], [2, 1]);
/* novembro: r1 marcada, o5 fica "de antes" */
const rn = M.reposicoesDoPeriodo({ ...base, ...M.periodo("mes", "2026-11-04") });
assert.deepStrictEqual([rn.totais.marcadas, rn.totais.aReporAntes], [1, 1]);
assert.strictEqual(rn.lista[0].repoeTexto, "aula de 06/10 ter 17:00 · cancelada (Chuva)");
/* fechamento de um trimestre (período qualquer) e o PDF com reposições */
const pt = M.periodo("trimestre", "2026-10-01");
const f = M.fechamento({ ...base, inicio: pt.inicio, fim: pt.fim, rotulo: pt.rotulo });
assert.strictEqual(f.rotulo, pt.rotulo);
assert.strictEqual(f.repo.totais.dadas, 2);
const h = M.htmlGeral(f, "Team Yoda");
assert(/Relatório de aulas/.test(h) && /4º trimestre/.test(h) && /Aulas a repor/.test(h) && /aula de 14\/10 18:00/.test(h) && !/undefined|NaN/.test(h));
assert(/Aulas · 4º trimestre/.test(M.htmlAluno(f, "a1", "Team Yoda")));
/* o fechamento do mês continua igual quando chamado só com o mês */
assert.strictEqual(M.fechamento({ ...base, mes: "2026-10" }).rotulo, "outubro de 2026");
console.log("check-reposicoes-ty: ok");
