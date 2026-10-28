/* Aulas do mês (mty/aulas-mes.js): junta Agenda e caderno, conta presença/falta/cancelamento por aluno e aulas dadas por professor. Rode: node tests/check-aulas-mes.js */
const assert = require("assert");
const A = require("../../mty/aulas-mes.js");
const oc = (o) => ({ id: "oc" + Math.random().toString(36).slice(2), origemTipo: "turma", origemId: "t1", tipo: "regular", status: "agendada",
  horaInicio: "17:00", horaFim: "18:30", professorUid: "p1", professorNome: "Paula", professorAuxiliarUid: "", substitutoUid: "", presencas: {}, ...o });
const alunos = [
  { id: "a1", nome: "Ana", registros: [], creditosReposicao: [] },
  { id: "a2", nome: "Bia", registros: [], creditosReposicao: [] },
  { id: "a3", nome: "Caio", professorUid: "p2", professorNome: "Rui", registros: [
    { id: "r1", tipo: "sessao", data: "2026-10-06", duracao: "1h", registradoPorUid: "p2", registradoPorNome: "Rui" },
  ], creditosReposicao: [] },
];
const turmas = [{ id: "t1", nome: "Terça", membros: ["a1", "a2"], professorUid: "p1", professorNome: "Paula" }];
/* registro de turma no caderno no dia 13 (sem ninguém marcar a Agenda), com a Bia ausente */
alunos[0].registros.push({ id: "rt1", tipo: "sessao", data: "2026-10-13", turma: "Terça", presenca: "presente", duracao: "1h30" });
alunos[1].registros.push({ id: "rt2", tipo: "sessao", data: "2026-10-13", turma: "Terça", presenca: "ausente", duracao: "1h30" });
const cancel = oc({ data: "2026-10-20", status: "cancelada", motivoCancelamento: "Chuva" });
const ocorrencias = [
  oc({ data: "2026-10-06", status: "realizada", duracaoEfetivaMin: 90, presencas: { a2: "falta" } }),
  oc({ data: "2026-10-13" }),                       // agendada, mas o caderno tem o registro → realizada
  cancel,
  oc({ data: "2026-10-27" }),                       // passou e ninguém marcou → sem registro
  oc({ data: "2026-10-29" }),                       // futura
  oc({ data: "2026-10-22", origemTipo: "individual", origemId: "a3", professorUid: "p2", professorNome: "Rui", status: "realizada", presencas: { a3: "falta" } }),
  oc({ data: "2026-10-23", origemTipo: "individual", origemId: "a1", tipo: "reposicao", status: "realizada", substitutoUid: "p2", substitutoNome: "Rui", horaInicio: "10:00", horaFim: "11:00" }),
  oc({ data: "2026-10-15", status: "cancelada", motivoCancelamento: A.MOTIVO_IGNORAR, excluirDoRelatorio: true }),
  oc({ data: "2026-10-16", tipo: "locacao", origemTipo: "avulsa", origemId: null }),
];
alunos[0].creditosReposicao.push({ id: "c1", alunoId: "a1", origemOcorrenciaId: cancel.id, status: "disponivel" });
const f = A.fechamento({ ocorrencias, alunos, turmas, mes: "2026-10", hoje: "2026-10-28" });

const st = f.aulas.map((a) => a.data + ":" + a.status);
assert.deepStrictEqual(st, ["2026-10-06:realizada", "2026-10-06:realizada", "2026-10-13:realizada", "2026-10-20:cancelada", "2026-10-22:falta", "2026-10-23:realizada", "2026-10-27:pendente", "2026-10-29:agendada"], st.join(" "));
const d13 = f.aulas.find((a) => a.data === "2026-10-13");
assert.strictEqual(d13.fonte, "caderno", "aula do dia 13 vem do caderno");
const caio06 = f.aulas.find((a) => a.data === "2026-10-06" && a.origemId === "a3");
assert(caio06 && caio06.ocorrenciaId === null && caio06.deu.nome === "Rui", "aula avulsa só no caderno entra, dada pelo Rui");

const ana = f.porAluno.find((l) => l.id === "a1"), bia = f.porAluno.find((l) => l.id === "a2"), caio = f.porAluno.find((l) => l.id === "a3");
assert.deepStrictEqual([ana.presencas, ana.faltas, ana.canceladas, ana.pendentes, ana.futuras, ana.reposicoesFeitas], [3, 0, 1, 1, 1, 1], "Ana");
assert.deepStrictEqual([bia.presencas, bia.faltas, bia.canceladas], [0, 2, 1], "Bia " + JSON.stringify([bia.presencas, bia.faltas, bia.canceladas]));
assert.strictEqual(ana.perdidas.length, 1); assert(ana.perdidas[0].temCredito, "cancelamento da Ana já tem crédito");
assert.strictEqual(ana.aRemarcar, 1, "Ana: o crédito disponível ainda precisa ser marcado");
assert.strictEqual(bia.aRemarcar, 1, "Bia: cancelamento por chuva sem crédito");
assert.strictEqual(bia.faltasSemReposicao, 2, "Bia: duas faltas ficam a critério");
assert.deepStrictEqual([caio.presencas, caio.faltas], [1, 1], "Caio");

const paula = f.porProfessor.find((p) => p.uid === "p1"), rui = f.porProfessor.find((p) => p.uid === "p2");
assert.deepStrictEqual([paula.dadas, paula.turma, paula.minutos, paula.canceladas, paula.pendentes], [2, 2, 180, 1, 1], "Paula " + JSON.stringify(paula));
assert.deepStrictEqual([rui.dadas, rui.individuais, rui.reposicoes, rui.substituicoes, rui.comFaltaDoAluno], [2, 2, 1, 1, 1], "Rui " + JSON.stringify(rui));
assert.deepStrictEqual(f.motivos, { Chuva: 1 });
assert.strictEqual(f.totais.pendentes, 1); assert.strictEqual(f.totais.futuras, 1);

/* professor só vê o que é dele */
const soRui = A.fechamento({ ocorrencias, alunos, turmas, mes: "2026-10", hoje: "2026-10-28", soProfessor: "p2" });
assert(soRui.aulas.every((a) => [a.titular.uid, a.deu.uid, a.auxiliar.uid].includes("p2")) && soRui.porProfessor.length === 1, "filtro do professor");

/* exportações */
assert(/Ana,3,0,1,1,1,1/.test(A.csvAlunos(f)), A.csvAlunos(f));
assert(/Rui,2,/.test(A.csvProfessores(f)));
assert(/Chuva/.test(A.htmlGeral(f, "Team Yoda")) && /Aulas a remarcar/.test(A.htmlAluno(f, "a2")) && /Faltas sem reposição/.test(A.htmlAluno(f, "a2")));
assert.strictEqual(A.somarMes("2026-12", 1), "2027-01"); assert.strictEqual(A.periodoDoMes("2026-02").fim, "2026-02-28");
assert.strictEqual(A.criadoEmISO({ id: "turma-1790000000000" }), new Date(1790000000000).toISOString().slice(0, 10));
console.log("check-aulas-mes: ok");
