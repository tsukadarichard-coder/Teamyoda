/* Meu plano: professor e próximas aulas do aluno (pedido do Richard em 19/11/2026).
   Testa a função pura do servidor (ver-aluno.js) e confere que o aluno.html mostra o painel. */
const assert = require("assert"), fs = require("fs"), path = require("path");
const raiz = path.join(__dirname, "..", "..");
const dados = {};
const docRef = (k) => ({ get: async () => ({ exists: k in dados, data: () => dados[k] }), set: async (v) => { dados[k] = v; } });
const fakeAdmin = { firestore: () => ({ collection: () => ({ doc: () => ({ collection: () => ({ doc: docRef }) }) }) }) };
const modPath = path.join(raiz, "netlify/functions/_firebase-admin.js");
require.cache[require.resolve(modPath)] = { id: modPath, filename: modPath, loaded: true, exports: { admin: fakeAdmin, app: () => {} } };
const mod = require(path.join(raiz, "netlify/functions/ver-aluno.js"));
const { proximasAulasDoAluno, professoresDoAluno } = mod.interno;
let ok = 0; const t = (nome, fn) => { fn(); ok++; console.log("ok -", nome); };

const hoje = "2026-11-19"; // quinta
const aluno = { id: "a1", nome: "Ana", professorNome: "Prof. João", duracaoPadrao: "1h", horarios: [{ dia: 1, hora: "17:00", quadraId: "q1" }] }; // segunda
const turma = { id: "t1", nome: "Turma Laranja", membros: ["a1"], professorNome: "Prof. Lia", duracaoPadrao: "1h30", horarios: [{ dia: 5, hora: "15:00", quadraId: "q2" }] }; // sexta
const arTurmas = [{ id: "ar1", nome: "Grupo AR", membros: ["a1"], professorNome: "Prof. Rui", duracaoMin: 120, horarios: [{ dia: 6, hora: "08:00" }] }, { id: "ar2", nome: "Outro", membros: ["b9"], horarios: [{ dia: 6, hora: "10:00" }] }];
const quadras = [{ id: "q1", nome: "Quadra 1" }, { id: "q2", nome: "Quadra 2" }];
const ocorrencias = [
  { origemTipo: "turma", origemId: "t1", data: "2026-11-20", horaInicio: "15:00", horaFim: "16:30", quadraId: "q2", professorNome: "Prof. Lia", tipo: "regular", status: "cancelada", motivoCancelamento: "Chuva", recorrenciaChave: "turma:t1:5:15:00" },
  { origemTipo: "individual", origemId: "a1", data: "2026-11-21", horaInicio: "10:00", horaFim: "11:00", quadraId: "q1", professorNome: "Prof. João", substitutoNome: "Prof. Max", tipo: "reposicao", status: "agendada" },
  { origemTipo: "individual", origemId: "a1", data: "2026-11-23", horaInicio: "18:00", horaFim: "19:00", quadraId: "q1", professorNome: "Prof. João", tipo: "regular", status: "agendada", recorrenciaChave: "individual:a1:1:17:00" },
  { origemTipo: "avulsa", origemId: null, data: "2026-11-22", horaInicio: "09:00", tipo: "locacao", status: "agendada" },
  { origemTipo: "individual", origemId: "b9", data: "2026-11-22", horaInicio: "09:00", tipo: "regular", status: "agendada" },
  { origemTipo: "individual", origemId: "a1", data: "2026-11-10", horaInicio: "09:00", tipo: "regular", status: "realizada" },
];
const lista = proximasAulasDoAluno({ aluno, turmasDoAluno: [turma], ocorrencias, arTurmas, quadras, hoje, dias: 14 });

t("só aulas do aluno, dentro do período, sem locação", () => {
  assert(lista.every((a) => a.data >= hoje && a.data <= "2026-12-02"), "fora do período");
  assert(!lista.some((a) => a.horaInicio === "09:00" && a.data === "2026-11-22"), "locação ou aula de outro aluno entrou");
  assert(!lista.some((a) => a.horaInicio === "10:00" && a.data === "2026-11-22"), "turma AR de outro entrou");
});
t("aula da turma cancelada aparece cancelada, sem duplicar a projeção", () => {
  const sexta = lista.filter((a) => a.data === "2026-11-20");
  assert.strictEqual(sexta.length, 1); assert.strictEqual(sexta[0].status, "cancelada"); assert.strictEqual(sexta[0].motivo, "Chuva");
  assert.strictEqual(sexta[0].titulo, "Turma Laranja"); assert.strictEqual(sexta[0].quadra, "Quadra 2");
  const sexta2 = lista.find((a) => a.data === "2026-11-27"); assert(sexta2 && sexta2.status === "agendada" && sexta2.horaFim === "16:30" && sexta2.professor === "Prof. Lia");
});
t("reposição com substituto", () => {
  const r = lista.find((a) => a.data === "2026-11-21" && a.horaInicio === "10:00");
  assert(r && r.tipo === "reposicao" && r.titulo === "Reposição" && r.professor === "Prof. Max" && r.substituindo === "Prof. João" && r.diaSemana === "sáb");
});
t("aula remarcada não volta no horário original", () => {
  const seg = lista.filter((a) => a.data === "2026-11-23");
  assert.strictEqual(seg.length, 1); assert.strictEqual(seg[0].horaInicio, "18:00");
  const seg2 = lista.find((a) => a.data === "2026-11-30"); assert(seg2 && seg2.horaInicio === "17:00" && seg2.horaFim === "18:00" && seg2.tipo === "individual");
});
t("alto rendimento projetado", () => {
  const ar = lista.filter((a) => a.tipo === "alto");
  assert.strictEqual(ar.length, 2); assert.strictEqual(ar[0].horaFim, "10:00"); assert.strictEqual(ar[0].professor, "Prof. Rui");
});
t("ordenado por data e hora", () => {
  const ch = lista.map((a) => a.data + a.horaInicio); assert.deepStrictEqual(ch, [...ch].sort());
});
t("professores sem repetir", () => {
  const p = professoresDoAluno(aluno, [turma, { id: "t2", nome: "T2", membros: ["a1"], professorNome: "Prof. João" }], arTurmas);
  assert.deepStrictEqual(p.map((x) => x.nome), ["Prof. João", "Prof. Lia", "Prof. Rui"]);
  assert.deepStrictEqual(p[0].onde, ["aulas individuais", "T2"]);
});
t("aluno.html mostra o painel", () => {
  const h = fs.readFileSync(path.join(raiz, "mty/aluno.html"), "utf8");
  assert(/function painelMinhasAulas\(d\)/.test(h)); assert((h.match(/painelMinhasAulas\(d\)/g) || []).length >= 3, "painel não entra nos dois caminhos");
});
(async () => {
  /* pela function de verdade (Firestore de mentira): a resposta traz professores e próximas aulas */
  const hojeSP = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
  dados["mty:alunos:v2"] = { value: JSON.stringify([{ ...aluno, linkToken: "tok", horarios: [] }]) };
  dados["mty:turmas:v1"] = { value: JSON.stringify([turma]) };
  dados["mty:ocorrencias:v1"] = { value: JSON.stringify([{ origemTipo: "individual", origemId: "a1", data: hojeSP, horaInicio: "23:00", horaFim: "23:30", quadraId: "q1", professorNome: "Prof. João", tipo: "experimental", status: "agendada" }]) };
  dados["mty:quadras:v1"] = { value: JSON.stringify(quadras) };
  let r = await mod.handler({ httpMethod: "GET", queryStringParameters: { org: "o", id: "a1", t: "tok" } });
  let d = JSON.parse(r.body);
  assert.strictEqual(r.statusCode, 200);
  assert.deepStrictEqual(d.professores.map((x) => x.nome), ["Prof. João", "Prof. Lia"]);
  const exp = d.proximasAulas.find((a) => a.tipo === "experimental"); assert(exp && exp.titulo === "Aula experimental" && exp.quadra === "Quadra 1");
  assert(d.proximasAulas.some((a) => a.titulo === "Turma Laranja"), "turma projetada");
  ok++; console.log("ok - function responde professores e próximas aulas");
  dados["mty:ocorrencias:v1"] = { value: "{quebrado" };
  r = await mod.handler({ httpMethod: "GET", queryStringParameters: { org: "o", id: "a1", t: "tok" } }); d = JSON.parse(r.body);
  assert.strictEqual(r.statusCode, 200); assert(Array.isArray(d.proximasAulas));
  ok++; console.log("ok - dado da Agenda quebrado não derruba a página");
  console.log(ok + " verificações ok");
})().catch((e) => { console.error(e); process.exit(1); });
