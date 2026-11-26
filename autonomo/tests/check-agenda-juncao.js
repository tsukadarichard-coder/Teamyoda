/* Agenda entre aparelhos (26/11/2026, "excluir para as semanas seguintes... não está excluindo, ele continua mantendo"):
   · a lista de aulas (mty:ocorrencias:v1) passa pela junção (MTYSync.mesclar): um aparelho com a Agenda antiga aberta não traz
     de volta as aulas apagadas em outro; e o que ele marcou (presença) não se perde;
   · semAulaRepetida: dois aparelhos que geraram a mesma aula fixa (mesma série e data) ficam com uma só;
   · ocorrenciasSemHorarioFixo: aulas fixas futuras cujo horário saiu da ficha/turma saem; passadas, com presença, já começadas e
     de outros tipos ficam. Lê as funções do próprio mty/index.html. Rode: node autonomo/tests/check-agenda-juncao.js */
const fs = require("fs"), path = require("path"), assert = require("assert"), vm = require("vm");
const raiz = path.join(__dirname, "..", "..");
const html = fs.readFileSync(path.join(raiz, "mty/index.html"), "utf8");
const pegar = (inicio) => { const i = html.indexOf(inicio); assert(i >= 0, "não achei " + inicio); let n = 0, j = html.indexOf("{", i);
  for (; j < html.length; j++) { if (html[j] === "{") n++; else if (html[j] === "}" && --n === 0) break; } return html.slice(i, j + 1); };
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(raiz, "mty/sync-listas.js"), "utf8"), ctx);
vm.runInContext([pegar("function chaveRecorrencia("), pegar("function semAulaRepetida("), pegar("function ocorrenciasSemHorarioFixo(")].join("\n") +
  "\nthis.semAulaRepetida = semAulaRepetida; this.ocorrenciasSemHorarioFixo = ocorrenciasSemHorarioFixo;", ctx);
const mesclar = (ctx.window.MTYSync || ctx.MTYSync).mesclar;
assert(/listas: new Set\(\[[^\]]*"mty:ocorrencias:v1"/.test(html), "a agenda está na junção (SINC.listas)");

const oc = (id, data, extra) => ({ id, origemTipo: "turma", origemId: "t1", recorrenciaChave: "turma:t1:3:17:00", data, horaInicio: "17:00", status: "agendada", presencas: {}, ...extra });

/* 1. apagadas num aparelho não voltam com o outro */
const base = [oc("o1", "2026-12-02"), oc("o2", "2026-12-09"), oc("o3", "2026-12-16")];
const aparelhoA = [base[0]]; /* apagou "esta e as próximas" a partir de 09/12 */
const nuvemDepoisDeA = aparelhoA;
const aparelhoB = base; /* ainda com a Agenda antiga, grava */
const j1 = ctx.semAulaRepetida(mesclar(base, aparelhoB, nuvemDepoisDeA));
assert.strictEqual(JSON.stringify(Array.from(j1).map((o) => o.id)), JSON.stringify(["o1"]), "as apagadas continuam apagadas");

/* 2. presença marcada no aparelho B em aula que A apagou: fica (alguém mexeu nela) */
const bMarcou = [base[0], { ...base[1], presencas: { a1: "presente" } }, base[2]];
const j2 = mesclar(base, bMarcou, nuvemDepoisDeA);
assert.strictEqual(JSON.stringify(Array.from(j2).map((o) => o.id).sort()), JSON.stringify(["o1", "o2"]), "a aula com presença marcada não some");

/* 3. aula repetida (dois aparelhos geraram a mesma): fica uma, a marcada ou a mais antiga */
const dup = ctx.semAulaRepetida([oc("x1", "2026-12-02", { criadoEm: "2026-11-26T10:00:00Z" }), oc("x2", "2026-12-02", { criadoEm: "2026-11-26T09:00:00Z" }),
  oc("y1", "2026-12-09", { criadoEm: "2026-11-26T09:00:00Z" }), oc("y2", "2026-12-09", { criadoEm: "2026-11-26T10:00:00Z", status: "realizada" }),
  { id: "av", origemTipo: "avulsa", recorrenciaChave: null, data: "2026-12-02" }]);
assert.strictEqual(JSON.stringify(Array.from(dup).map((o) => o.id)), JSON.stringify(["x2", "y2", "av"]), "uma por série e data; avulsa intacta");

/* 4. horário que saiu da ficha */
const alunos = [{ id: "a1", horarios: [] }, { id: "a2", horarios: [{ dia: 3, hora: "18:00" }] }];
const turmas = [{ id: "t1", horarios: [{ dia: 3, hora: "17:00" }] }];
const ind = (id, data, extra) => ({ id, origemTipo: "individual", origemId: "a1", recorrenciaChave: "individual:a1:3:17:00", data, horaInicio: "17:00", status: "agendada", presencas: {}, ...extra });
const lista = [ind("f1", "2026-12-02"), ind("f2", "2026-11-26", { horaInicio: "20:00" }), ind("hojeJa", "2026-11-26", { horaInicio: "09:00" }),
  ind("passada", "2026-11-19"), ind("presenca", "2026-12-09", { presencas: { a1: "falta" } }), ind("cancelada", "2026-12-16", { status: "cancelada" }),
  { ...ind("a2ok", "2026-12-02"), origemId: "a2", recorrenciaChave: "individual:a2:3:18:00" }, oc("turmaOk", "2026-12-02"),
  { id: "avulsa", origemTipo: "avulsa", recorrenciaChave: null, data: "2026-12-02", status: "agendada" }];
const fora = ctx.ocorrenciasSemHorarioFixo(lista, alunos, turmas, "2026-11-26", "12:00");
assert.strictEqual(JSON.stringify(Array.from(fora).sort()), JSON.stringify(["f1", "f2"]), "só as futuras sem horário fixo saem");
assert.strictEqual(ctx.ocorrenciasSemHorarioFixo(lista, alunos, [], "2026-11-26", "12:00").has("turmaOk"), true, "turma sem o horário: a aula sai");
console.log("check-agenda-juncao: ok");
