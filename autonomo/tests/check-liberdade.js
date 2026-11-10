/* QuadraLab Liberdade (autonomo/liberdade.js): fase e caminhos do onboarding, horas da semana pela Agenda, receita prevista,
   indicadores e a sugestão da semana (nunca propõe mais aulas acima do limite). Rode: node tests/check-liberdade.js */
const assert = require("assert"), path = require("path");
const L = require(path.join(__dirname, "../liberdade.js"));
const hoje = "2026-11-11"; // quarta; semana de 09/11 (seg) a 15/11 (dom)

/* fase e caminhos */
assert.strictEqual(L.faseSugerida({ alunos: 4, horasSemana: 12 }), "conquista");
assert.strictEqual(L.faseSugerida({ alunos: 40, horasSemana: 48 }), "liberdade");
assert.strictEqual(L.faseSugerida({ alunos: 25, horasSemana: 32 }), "crescimento");
assert.strictEqual(L.faseSugerida({ alunos: 25, horasSemana: 30, dificuldade: "excesso" }), "liberdade");
assert.deepStrictEqual(L.caminhosSugeridos({ horasSemana: 45, horasDesejadas: 30 }), { A: true, B: true });
assert.deepStrictEqual(L.caminhosSugeridos({ horasSemana: 32, horasDesejadas: 30 }), { A: true, B: false });

/* onboarding pulando perguntas: nada quebra, linha de base com o que foi respondido */
const so = L.aplicarOnboarding(null, { alunos: 20 }, hoje);
assert.strictEqual(so.base.alunos, 20); assert.strictEqual(so.base.rendaMes, null); assert.strictEqual(so.fase, "crescimento");
const lib0 = L.aplicarOnboarding(null, { alunos: 25, horasSemana: 40, horasQuadra: 30, rendaMes: 9000, rendaDesejada: 12000, horasDesejadas: 30, dificuldade: "picados" }, "2026-11-02");
assert.strictEqual(lib0.metas.rendaLiquida, 12000); assert.strictEqual(lib0.metas.horasSemana, 30); assert.strictEqual(lib0.rotina.horasAdminSemana, 10);
assert.deepStrictEqual(lib0.metas.diasLivres, [0]);

/* sem agenda: usa o informado */
let ind = L.indicadores(lib0, [], [], hoje);
assert.strictEqual(ind.tempo.fonte, "informado"); assert.strictEqual(ind.tempo.quadra, 30); assert.strictEqual(ind.tempo.total, 40);
assert.strictEqual(ind.renda.prevista, 9000); assert.strictEqual(ind.renda.fonte, "informado");
assert.strictEqual(ind.rentabilidade.porHora, Math.round(9000 / (40 * 4.33)));
assert.strictEqual(ind.renda.liquida, null, "sem custos não inventa renda líquida");

/* com agenda: horas pela duração de cada aula; canceladas não contam */
const alunos = [
  { id: "a1", nome: "Ana", duracaoPadrao: "1h", horarios: [{ dia: 1, hora: "08:00" }, { dia: 3, hora: "08:00" }], valorMensal: 800, criadoEm: "2026-10-01" },
  { id: "a2", nome: "Bia", duracaoPadrao: "1h30", horarios: [{ dia: 2, hora: "18:00" }], agendaExcecoes: { "2026-11-10|18:00": { status: "cancelada" } }, criadoEm: "2026-10-01" },
  { id: "a3", nome: "Caio", duracaoPadrao: "1h", horarios: [{ dia: 5, hora: "19:00" }], valorAula: 150, criadoEm: "2026-10-01" },
];
const turmas = [{ id: "t1", nome: "Sub-12", duracaoPadrao: "1h30", horarios: [{ dia: 1, hora: "17:00" }, { dia: 3, hora: "17:00" }], criadoEm: "2026-10-01" }];
const lib = Object.assign({}, lib0, { rotina: { horasAdminSemana: 6, horasDeslocSemana: 4, precoAulaMedio: 120 } });
ind = L.indicadores(lib, alunos, turmas, hoje);
assert.strictEqual(ind.tempo.fonte, "agenda");
/* Ana 2×60 + turma 2×90 + Caio 60 = 360 min = 6 h (Bia cancelada) */
assert.strictEqual(ind.tempo.quadra, 6); assert.strictEqual(ind.tempo.total, 16);
assert.strictEqual(ind.vida.acima, -14);
/* receita: Ana 800 + Caio 150 × aulas do mês + Bia e turma pelo preço médio */
assert(ind.renda.prevista > 800 && /valores e preço médio/.test(ind.renda.fonte), JSON.stringify(ind.renda));
assert.strictEqual(ind.vida.recuperadas, 24, "40 h da linha de base − 16 h desta semana");

/* sugestão: dia livre ocupado vem antes dos horários isolados */
let s = L.sugestao(Object.assign({}, lib, { metas: Object.assign({}, lib.metas, { diasLivres: [5] }) }), alunos, turmas, hoje);
assert.strictEqual(s.tipo, "diaLivre"); assert(/sexta/.test(s.texto) && /Caio/.test(s.texto));
s = L.sugestao(lib, alunos, turmas, hoje);
assert(["isolados", "rentabilidade", "ok"].includes(s.tipo), s.tipo);
for (const k of ["titulo", "texto", "beneficio", "financeiro", "jornada", "acao"]) assert(s[k], "sugestão tem " + k);

/* acima do limite: nunca sugere mais aulas */
const cheio = Object.assign({}, lib, { metas: Object.assign({}, lib.metas, { horasSemana: 10 }), rotina: { horasAdminSemana: 10, horasDeslocSemana: 4, precoAulaMedio: 120 } });
s = L.sugestao(cheio, alunos, turmas, hoje);
assert.strictEqual(s.tipo, "acima"); assert(!/mais aulas|pegar alunos novos e/i.test(s.texto + s.beneficio), "não empurra mais aulas");
/* abaixo da meta de R$/hora e com horas sobrando: fala de turma, dentro do limite */
const barato = Object.assign({}, lib, { metas: { rendaLiquida: 20000, horasSemana: 30, diasLivres: [0] }, rotina: { horasAdminSemana: 2, horasDeslocSemana: 1, precoAulaMedio: 60 } });
s = L.sugestao(barato, [{ id: "x", nome: "X", duracaoPadrao: "1h", horarios: [{ dia: 1, hora: "08:00" }, { dia: 2, hora: "08:00" }, { dia: 3, hora: "08:00" }] }], [], hoje);
assert(["rentabilidade", "isolados"].includes(s.tipo), s.tipo);
/* sem valores: pede o dado */
s = L.sugestao(L.aplicarOnboarding(null, {}, hoje), [{ id: "y", nome: "Y", duracaoPadrao: "1h", horarios: [{ dia: 1, hora: "08:00" }, { dia: 1, hora: "09:00" }] }], [], hoje);
assert.strictEqual(s.tipo, "dados");
console.log("check-liberdade: ok");
