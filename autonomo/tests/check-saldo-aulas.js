/* Mensalidade de N aulas (26/11/2026, pedido do Richard): "a mensalidade ser referente a 3 aulas ao invés de 4... tem mês que nós
   temos 5 aulas. Essas aulas excedentes ficam como crédito para eventuais reposições". Decisões dele: a falta é abatida sozinha
   do crédito, o crédito acumula de um mês para o outro e a regra é por aluno.
   Confere QLAulasMes.saldosDeAulas/saldoDeAulas, a cobertura das pendências de reposição pelo saldo, o fechamento por aluno,
   o marco zero e que mty/aulas-mes.js e netlify/functions/_aulas-mes.js são iguais. Rode: node autonomo/tests/check-saldo-aulas.js */
const fs = require("fs"), path = require("path"), assert = require("assert");
const raiz = path.join(__dirname, "..", "..");
assert.strictEqual(fs.readFileSync(path.join(raiz, "mty/aulas-mes.js"), "utf8"), fs.readFileSync(path.join(raiz, "netlify/functions/_aulas-mes.js"), "utf8"), "as duas cópias de aulas-mes são iguais");
const Q = require(path.join(raiz, "mty/aulas-mes.js"));
Q.definirMarco("");

/* quartas-feiras: dez/2026 tem 5 (2, 9, 16, 23, 30), jan/2027 tem 4 (6, 13, 20, 27), fev/2027 tem 4 (3, 10, 17, 24) */
const aluno = { id: "a1", nome: "Nicolas", aulasPagasMes: 3, aulasPagasDesde: "2026-12", horarios: [{ dia: 3, hora: "17:00", quadraId: "q1" }], registros: [], creditosReposicao: [] };
const outro = { id: "a2", nome: "Pedro", horarios: [{ dia: 3, hora: "18:00" }], registros: [] };
const oc = (data, pres, extra) => ({ id: "o" + data, origemTipo: "individual", origemId: "a1", recorrenciaChave: "individual:a1:3:17:00", tipo: "regular", data, horaInicio: "17:00", horaFim: "18:00",
  status: pres ? "realizada" : "agendada", presencas: pres ? { a1: pres } : {}, ...extra });
const base = { alunos: [aluno, outro], turmas: [] };
const S = (ocorrencias, hoje) => Q.saldoDeAulas({ ...base, ocorrencias, hoje, alunoId: "a1" });

assert.strictEqual(Q.aulasPagas(aluno), 3);
assert.strictEqual(Q.aulasPagas(outro), 0);
assert.strictEqual(Q.saldoDeAulas({ ...base, ocorrencias: [], hoje: "2026-12-10", alunoId: "a2" }), null, "sem mensalidade de N aulas: nada muda");

/* 1. no meio do mês, com uma falta: ainda dá para fazer as 3 (os horários que a Agenda não abriu contam) */
let ocs = [oc("2026-12-02", "presente"), oc("2026-12-09", "falta"), oc("2026-12-16", "presente")];
let s = S(ocs, "2026-12-20");
assert.deepStrictEqual([s.feitas, s.feitasNoMes, s.aFazerNoMes, s.saldo, s.credito, s.aRepor], [2, 2, 2, 0, 0, 0], JSON.stringify(s));

/* 2. fim do mês: fez 4 de 5 → 1 aula de crédito da academia */
ocs = ocs.concat([oc("2026-12-23", "presente"), oc("2026-12-30", "presente")]);
s = S(ocs, "2026-12-31");
assert.deepStrictEqual([s.feitas, s.saldo, s.credito, s.aRepor], [4, 1, 1, 0]);
assert.strictEqual(s.meses[0].faltas, 1);
assert.strictEqual(Q.textoSaldo(s), "Mensalidade de 3 aulas por mês · 1 aula de crédito da academia");

/* 3. janeiro: 2 faltas em 4 → −1 no mês, abatido do crédito de dezembro → 0; as faltas não viram reposição */
ocs = ocs.concat([oc("2027-01-06", "presente"), oc("2027-01-13", "falta"), oc("2027-01-20", "falta"), oc("2027-01-27", "presente")]);
s = S(ocs, "2027-01-31");
assert.deepStrictEqual([s.meses[1].saldo, s.saldo, s.credito, s.aRepor], [-1, 0, 0, 0]);
let pend = Q.pendentesDeReposicao({ ...base, ocorrencias: ocs, hoje: "2027-01-31", tipo: "individual", id: "a1" });
assert.strictEqual(pend.length, 0, "faltas cobertas pelo crédito: nada a repor");
assert.strictEqual(Q.pendentesDeReposicao({ ...base, ocorrencias: ocs, hoje: "2027-01-31", tipo: "individual", id: "a1", todas: true }).filter((p) => p.cobertaPeloSaldo).length, 3);

/* 4. fevereiro: fez 1 de 4 → −2 → 2 aulas a repor; ficam as 2 faltas mais recentes */
ocs = ocs.concat([oc("2027-02-03", "falta"), oc("2027-02-10", "presente"), oc("2027-02-17", "falta"), oc("2027-02-24", "falta")]);
s = S(ocs, "2027-02-28");
assert.deepStrictEqual([s.saldo, s.credito, s.aRepor], [-2, 0, 2]);
pend = Q.pendentesDeReposicao({ ...base, ocorrencias: ocs, hoje: "2027-02-28", tipo: "individual", id: "a1" });
assert.deepStrictEqual(pend.map((p) => p.data), ["2027-02-17", "2027-02-24"]);

/* 5. reposição feita em março conta como aula dada */
ocs = ocs.concat([{ ...oc("2027-03-05", "presente"), id: "rep1", tipo: "reposicao", recorrenciaChave: null }]);
s = S(ocs.concat(["2027-03-03", "2027-03-10", "2027-03-17", "2027-03-24", "2027-03-31"].map((d) => oc(d, "presente"))), "2027-03-31");
assert.deepStrictEqual([s.meses[3].feitas, s.meses[3].reposicoes, s.meses[3].saldo, s.saldo], [6, 1, 3, 1]);

/* 6. fechamento do mês: a remarcar vem do saldo */
const f = Q.fechamento({ ...base, ocorrencias: ocs, mes: "2027-02", hoje: "2027-02-28" });
const l = f.porAluno.find((x) => x.id === "a1");
assert.strictEqual(l.aRemarcar, 2);
assert.strictEqual(l.saldoAulas.aRepor, 2);
assert.strictEqual(f.porAluno.find((x) => x.id === "a2"), undefined);

/* 7. turma: aula da turma conta; aula sem registro no mês passado não vira dívida */
const turma = { id: "t1", nome: "Sub-12", membros: ["a1"], horarios: [] };
const ot = (data, status, pres) => ({ id: "t" + data, origemTipo: "turma", origemId: "t1", tipo: "regular", data, horaInicio: "09:00", horaFim: "10:00", status, presencas: pres || {} });
const al2 = { ...aluno, horarios: [], aulasPagasDesde: "2027-04" };
s = Q.saldoDeAulas({ alunos: [al2], turmas: [turma], ocorrencias: [ot("2027-04-03", "realizada", { a1: "presente" }), ot("2027-04-10", "agendada"), ot("2027-04-17", "realizada", { a1: "presente" })], hoje: "2027-05-02", alunoId: "a1" });
assert.deepStrictEqual([s.meses[0].feitas, s.meses[0].semRegistro, s.meses[0].saldo], [2, 1, 0], "abril: a aula sem registro ainda pode ser registrada");
/* maio: sem horário fixo e sem nenhuma aula marcada, as 3 do mês não têm como ser dadas */
assert.strictEqual(s.meses[1].saldo, -3, "maio sem nenhuma aula prevista: 3 a repor");

/* 8. marco zero: antes dele não conta */
Q.definirMarco("2027-02-01");
s = S(ocs, "2027-02-28");
assert.strictEqual(s.desde, "2027-02");
assert.deepStrictEqual([s.meses.length, s.saldo, s.aRepor], [1, -2, 2]);
Q.definirMarco("");

/* 9. horário fixo em dia sem aula na Agenda: no passado conta como "sem registro" (não vira dívida) */
s = Q.saldoDeAulas({ alunos: [{ ...aluno, aulasPagasDesde: "2027-06" }], turmas: [], ocorrencias: [], hoje: "2027-07-01", alunoId: "a1" });
assert.deepStrictEqual([s.meses[0].semRegistro, s.meses[0].saldo], [5, 0], "junho/2027 tem 5 quartas sem registro");

/* 10. servidor (Meu plano): ver-aluno devolve só os números do aluno; sem mensalidade de N aulas, nada */
const modPath = path.join(raiz, "netlify/functions/_firebase-admin.js");
require.cache[require.resolve(modPath)] = { id: modPath, filename: modPath, loaded: true, exports: { admin: {}, app: () => {} } };
const { saldoAulasDoAluno } = require(path.join(raiz, "netlify/functions/ver-aluno.js")).interno;
const sv = saldoAulasDoAluno({ org: "39-ranch", aluno, turmasDoAluno: [], ocorrencias: ocs, hoje: "2027-02-28" });
assert.deepStrictEqual([sv.pagasMes, sv.aRepor, sv.credito, sv.meses.length], [3, 2, 0, 3]);
assert(!JSON.stringify(sv).includes("Nicolas"), "sem nome no saldo");
assert.strictEqual(saldoAulasDoAluno({ org: "team-yoda", aluno: outro, turmasDoAluno: [], ocorrencias: ocs, hoje: "2027-02-28" }), null);
/* marco zero do Team Yoda (1/12/2026) vale no servidor */
assert.strictEqual(saldoAulasDoAluno({ org: "team-yoda", aluno: { ...aluno, aulasPagasDesde: "2026-10" }, turmasDoAluno: [], ocorrencias: ocs, hoje: "2027-02-28" }).desde, "2026-12");
Q.definirMarco("");

/* 11. aluno.html mostra "Minhas aulas" nos dois caminhos do Meu plano; Cobrança recebe o texto do saldo */
const h = fs.readFileSync(path.join(raiz, "mty/aluno.html"), "utf8");
assert(/function painelSaldoAulas\(d\)/.test(h) && (h.match(/painelSaldoAulas\(d\)/g) || []).length >= 3, "painel nos dois caminhos");
const fin = fs.readFileSync(path.join(raiz, "netlify/functions/financeiro.js"), "utf8");
assert(/saldosDeAulas\(/.test(fin) && /aulas: sa \?/.test(fin), "Cobrança leva a mensalidade de N aulas");
console.log("check-saldo-aulas: ok");
