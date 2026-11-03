/* Turmas apagadas (turmas-lixeira.js): lixeira de 90 dias e reconstrução das turmas apagadas antes da lixeira, pelos rastros da
   Agenda (Team Yoda) e do caderno (os dois apps). Rode: node tests/check-turmas-lixeira.js */
const assert = require("assert"), fs = require("fs"), path = require("path");
const raiz = path.join(__dirname, "..");
assert.strictEqual(fs.readFileSync(path.join(raiz, "turmas-lixeira.js"), "utf8"), fs.readFileSync(path.join(raiz, "../mty/turmas-lixeira.js"), "utf8"), "cópias iguais em autonomo/ e mty/");
const T = require(path.join(raiz, "turmas-lixeira.js"));

(async () => {
  /* lixeira */
  const mem = {};
  const storage = { get: async (k) => (k in mem ? { key: k, value: mem[k] } : null), set: async (k, v) => { mem[k] = v; return { key: k, value: v }; } };
  const L = T.criar(storage);
  const sub12 = { id: "turma-1", nome: "Sub-12", membros: ["a1", "a2"], horarios: [{ dia: 2, hora: "18:00" }], plano: { blocos: [1, 2] }, agendaExcecoes: { "2026-10-01|18:00": { status: "cancelada" } } };
  await L.guardar(sub12, "Richard");
  await L.guardar({ ...sub12, nome: "Sub-12 (2)" }, "Richard");
  let l = await L.listar();
  assert.strictEqual(l.length, 1, "a mesma turma apagada de novo fica só uma vez");
  assert.deepStrictEqual(l[0].turma.plano, { blocos: [1, 2] }, "turma inteira, com o plano");
  assert.strictEqual(l[0].por, "Richard");
  const velho = JSON.parse(mem[T.CHAVE]); velho.push({ turma: { id: "turma-velha", nome: "Antiga" }, removidaEm: "2026-01-01T10:00:00Z" }); mem[T.CHAVE] = JSON.stringify(velho);
  l = await L.listar(); assert(!l.some((x) => x.turma.id === "turma-velha"), "depois de 90 dias some da lixeira");
  await L.tirar("turma-1"); assert.strictEqual((await L.listar()).length, 0, "recuperada sai da lixeira");

  /* reconstrução pela Agenda (Team Yoda): id, horários, jogadores, duração, professor; nome pelo caderno */
  const alunos = [
    { id: "a1", nome: "Ana", registros: [{ tipo: "sessao", data: "2026-10-27", turma: "Sub-14 Competição", duracao: "1h30" }, { tipo: "sessao", data: "2026-10-29", turma: "Sub-14 Competição" }] },
    { id: "a2", nome: "Bia", registros: [{ tipo: "sessao", data: "2026-10-27", turma: "Sub-14 Competição", presenca: "ausente" }] },
    { id: "a3", nome: "Caio", registros: [{ tipo: "sessao", data: "2026-10-06", turma: "Adultos noite" }, { tipo: "sessao", data: "2026-10-13", turma: "Adultos noite" }, { tipo: "sessao", data: "2026-10-20", turma: "Adultos noite", duracao: "1h" }] },
    { id: "a4", nome: "Duda", registros: [{ tipo: "sessao", data: "2026-10-20", turma: "Adultos noite" }, { tipo: "sessao", data: "2026-10-22", turma: "Turma viva" }] },
  ];
  const oc = (data, hora, fim, extra) => ({ id: "oc" + data + hora, origemTipo: "turma", origemId: "turma-99", recorrenciaChave: "turma:turma-99:x:" + hora, data, horaInicio: hora, horaFim: fim, professorUid: "p1", professorNome: "Léo", quadraId: "q2", ...extra });
  const ocorrencias = [
    oc("2026-10-27", "17:00", "18:30", { membrosNaAula: ["a1", "a2"], presencas: { a1: "presente", a2: "falta" } }), /* terça */
    oc("2026-10-29", "17:00", "18:30", { membrosNaAula: ["a1", "a2"] }), /* quinta */
    oc("2026-11-03", "17:00", "18:30", {}),
    { id: "x", origemTipo: "turma", origemId: "turma-viva", data: "2026-10-22", horaInicio: "10:00", horaFim: "11:00" },
  ];
  const turmas = [{ id: "turma-viva", nome: "Turma viva", membros: ["a4"] }];
  const r = T.reconstruir({ turmas, alunos, ocorrencias, hoje: "2026-11-03" });
  const ag = r.find((x) => x.fonte === "agenda");
  assert(ag, "achou a turma pela Agenda");
  assert.strictEqual(ag.turma.id, "turma-99", "mesmo id: as aulas antigas voltam a apontar para ela");
  assert.strictEqual(ag.turma.nome, "Sub-14 Competição", "nome pelo caderno");
  assert.deepStrictEqual(ag.turma.membros.sort(), ["a1", "a2"]);
  assert.deepStrictEqual(ag.turma.horarios, [{ dia: 2, hora: "17:00", quadraId: "q2" }, { dia: 4, hora: "17:00", quadraId: "q2" }], "terça e quinta 17h na quadra");
  assert.strictEqual(ag.turma.duracaoPadrao, "1h30"); assert.strictEqual(ag.turma.professorNome, "Léo"); assert.strictEqual(ag.aulas, 3);
  assert(!r.some((x) => x.turma.id === "turma-viva" || x.turma.nome === "Turma viva"), "turma que existe não aparece");
  /* reconstrução só pelo caderno (QuadraLab): nome, jogadores, dias da semana (hora a completar) */
  const cad = r.find((x) => x.fonte === "caderno");
  assert(cad && cad.turma.nome === "Adultos noite", "achou pelo caderno");
  assert.deepStrictEqual(cad.turma.membros.sort(), ["a3", "a4"]);
  assert.deepStrictEqual(cad.diasSemana, [2], "treinava às terças");
  assert.strictEqual(cad.turma.duracaoPadrao, "1h");
  assert.strictEqual(r.filter((x) => x.turma.nome === "Sub-14 Competição").length, 1, "a mesma turma não aparece duas vezes (agenda e caderno)");
  /* sem rastro de jogador existente: não sugere */
  assert.strictEqual(T.reconstruir({ turmas: [], alunos: [], ocorrencias: [oc("2026-10-27", "17:00", "18:30", { membrosNaAula: ["zz"] })] }).length, 0);
  console.log("check-turmas-lixeira: ok");
})().catch((e) => { console.error(e); process.exit(1); });
