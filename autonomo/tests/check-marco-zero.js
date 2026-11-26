/* Marco zero do Team Yoda (26/11/2026, "Pode fazer o Marco zero... as reposições zeram"): a contagem de aulas, pendências e
   reposições começa em 1/12/2026; antes do dia nada muda; a partir do dia, créditos não usados e pedidos pendentes de antes
   são zerados nos dados (sem apagar) e o Financeiro conta só daí em diante. Rode: node autonomo/tests/check-marco-zero.js */
const assert = require("assert"), path = require("path"), fs = require("fs");
const Q = require(path.join(__dirname, "../../mty/aulas-mes.js"));
assert.strictEqual(fs.readFileSync(path.join(__dirname, "../../mty/aulas-mes.js"), "utf8"), fs.readFileSync(path.join(__dirname, "../../netlify/functions/_aulas-mes.js"), "utf8"), "cópias iguais");
const M = "2026-12-01";
assert.strictEqual(Q.marcoDe("team-yoda"), M);
assert.strictEqual(Q.marcoDe("39-ranch"), "", "a 39 Ranch não tem marco");
assert.strictEqual(Q.marcoVigente("team-yoda", "2026-11-30"), "", "antes do dia, nada muda");
assert.strictEqual(Q.marcoVigente("team-yoda", "2026-12-01"), M);
assert.strictEqual(Q.hojeSP(Date.parse("2026-12-01T02:00:00Z")), "2026-11-30", "dia em São Paulo");

const oc = (id, data, status, extra) => ({ id, origemTipo: "individual", origemId: "a1", data, horaInicio: "10:00", horaFim: "11:00", tipo: "regular", status, ...extra });
const ocorrencias = [oc("n1", "2026-11-20", "cancelada", { motivo: "Chuva" }), oc("n2", "2026-11-25", "realizada"), oc("n3", "2026-11-27", "agendada"),
  oc("d1", "2026-12-03", "cancelada", { motivo: "Chuva" }), oc("d2", "2026-12-04", "realizada")];
const alunos = [{ id: "a1", nome: "Ana" }];
/* sem marco: novembro conta */
Q.definirMarco("");
assert.strictEqual(Q.fechamento({ ocorrencias, alunos, turmas: [], mes: "2026-11", hoje: "2026-12-05" }).totais.aulas, 3);
assert.strictEqual(Q.todasPendentes({ ocorrencias, alunos, turmas: [], hoje: "2026-12-05" }).length, 2);
/* com marco: novembro fica fora de tudo; dezembro conta normal */
Q.definirMarco(Q.marcoVigente("team-yoda", "2026-12-05"));
assert.strictEqual(Q.fechamento({ ocorrencias, alunos, turmas: [], mes: "2026-11", hoje: "2026-12-05" }).totais.aulas, 0, "novembro zerado");
const dez = Q.fechamento({ ocorrencias, alunos, turmas: [], mes: "2026-12", hoje: "2026-12-05" }).totais;
assert.strictEqual(dez.aulas, 2); assert.strictEqual(dez.canceladas, 1); assert.strictEqual(dez.realizadas, 1);
const pend = Q.todasPendentes({ ocorrencias, alunos, turmas: [], hoje: "2026-12-05" });
assert.deepStrictEqual(pend.map((p) => p.data), ["2026-12-03"], "só a reposição de dezembro");
Q.definirMarco("");

/* zerar reposições nos dados */
const turmaAluno = [{ id: "a1", nome: "Ana", creditosReposicao: [
  { id: "c1", status: "disponivel", criadoEm: "2026-11-21T10:00:00Z" },
  { id: "c2", status: "pendente_aprovacao", criadoEm: "2026-11-28T10:00:00Z" },
  { id: "c3", status: "reservado", criadoEm: "2026-11-22T10:00:00Z", ocorrenciaReposicaoId: "r9" },
  { id: "c4", status: "disponivel", criadoEm: "2026-12-03T10:00:00Z" },
  { id: "c5", status: "utilizado", criadoEm: "2026-11-10T10:00:00Z" }],
  pedidosReposicao: [{ id: "p1", status: "pendente", em: "2026-11-25T09:00:00Z" }, { id: "p2", status: "pendente", em: "2026-12-02T09:00:00Z" }, { id: "p3", status: "pendente" }] },
  { id: "a2", nome: "Bia" }];
assert.strictEqual(Q.aplicarMarcoZero(turmaAluno, M, "2026-11-30", "x").mudou, false, "antes do dia nada muda");
const r = Q.aplicarMarcoZero(turmaAluno, M, "2026-12-01", "2026-12-01T03:00:00Z");
assert(r.mudou); assert.strictEqual(r.creditos, 2); assert.strictEqual(r.pedidos, 2);
const cs = r.alunos[0].creditosReposicao, ps = r.alunos[0].pedidosReposicao;
assert.deepStrictEqual(cs.map((c) => c.status), ["cancelado", "cancelado", "reservado", "disponivel", "utilizado"], "só os não usados de antes");
assert(/Marco zero \(01\/12\/2026\)/.test(cs[0].motivoCancelamento) && cs[0].marcoZero === M);
assert.deepStrictEqual(ps.map((p) => p.status), ["arquivado", "pendente", "arquivado"], "pedidos de antes (e sem data) arquivados");
assert.strictEqual(r.alunos[1], turmaAluno[1], "aluno sem reposição não muda");
assert.strictEqual(Q.aplicarMarcoZero(r.alunos, M, "2026-12-02", "y").mudou, false, "aplicar de novo não muda nada");
assert.strictEqual(turmaAluno[0].creditosReposicao[0].status, "disponivel", "não altera a lista original");

/* Financeiro: calcularMes conta pelo marco da academia (dados.marco) */
const F = require(path.join(__dirname, "../../netlify/functions/_financeiro-calc.js"));
const dados = { alunos, turmas: [], ocorrencias, quadras: [], reservas: [], torneios: [], eventos: [], professores: [] };
const semMarco = F.calcularMes(dados, {}, "2026-11", "2026-12-05");
const comMarco = F.calcularMes({ ...dados, marco: M }, {}, "2026-11", "2026-12-05");
assert.notDeepStrictEqual(JSON.stringify(semMarco), JSON.stringify(comMarco), "o marco muda a conta de novembro");
assert.strictEqual(F.calcularMes({ ...dados }, {}, "2026-11", "2026-12-05").toString(), semMarco.toString(), "sem marco volta ao normal (o marco não fica preso)");
const imp = fs.readFileSync(path.join(__dirname, "../../netlify/functions/_financeiro-importar.js"), "utf8");
assert(/opcoes\.inicio \|\| "2026-12"/.test(imp), "importação começa em dezembro (o que estava em aberto antes vira pendência)");
console.log("check-marco-zero: ok");
