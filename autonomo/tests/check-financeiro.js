/* Financeiro do Team Yoda (só controle): o mês calculado a partir dos dados do app e da tabela de preços.
   Rode: node tests/check-financeiro.js */
const assert = require("assert");
const F = require("../../netlify/functions/_financeiro-calc.js");

const reg = (data, extra) => Object.assign({ id: "r" + Math.random().toString(36).slice(2, 7), tipo: "sessao", data }, extra);
const dados = {
  alunos: [
    { id: "a1", nome: "Ana", registros: [reg("2026-11-03", { turma: "Sub-12", registradoPorUid: "p1" }), reg("2026-11-10", { turma: "Sub-12", registradoPorUid: "p1" })] },
    { id: "a2", nome: "Bia", registros: [reg("2026-11-03", { turma: "Sub-12", registradoPorUid: "p1" })] },
    { id: "a3", nome: "Caio", professorUid: "p2", professorNome: "Duda", registros: [reg("2026-11-04"), reg("2026-11-11"), reg("2026-11-18"), reg("2026-10-28")] },
    { id: "a4", nome: "Dani", registros: [] },
  ],
  turmas: [
    { id: "t1", nome: "Sub-12", membros: ["a1", "a2"], professorUid: "p1", professorNome: "Leo" },
    { id: "t2", nome: "Adulto", membros: ["a4"], professorUid: "p1", professorNome: "Leo" },
  ],
  quadras: [{ id: "q1", nome: "Quadra 1", faixasPreco: [{ inicio: "06:00", fim: "18:00", preco: "100" }, { inicio: "18:00", fim: "23:00", preco: "140" }] }, { id: "q2", nome: "Quadra 2", faixasPreco: [] }],
  reservas: [
    { id: "r1", quadraId: "q1", data: "2026-11-05", horaInicio: "17:00", horaFim: "19:00" }, // 100 + 140
    { id: "r2", quadraId: "q2", data: "2026-11-06", horaInicio: "10:00", horaFim: "11:00" }, // sem preço
    { id: "r3", quadraId: "q1", data: "2026-12-01", horaInicio: "10:00", horaFim: "11:00" }, // outro mês
  ],
  torneios: [{ id: "to1", nome: "Open", dataInicio: "2026-11-20", categorias: [{ inscritos: [{}, {}, {}] }, { inscritos: [{}] }] }],
  eventos: [{ id: "e1", nome: "Clínica", data: "2026-11-22", convidados: [{ status: "confirmado" }, { status: "confirmado" }, { status: "espera" }] }],
  professores: [{ uid: "p1", nome: "Leo" }, { uid: "p2", nome: "Duda" }, { uid: "p3", nome: "Gui" }],
};
const config = {
  turmas: { t1: { preco: 400 } },                             // Adulto sem preço: aparece para precificar
  descontos: { "t1:a2": { tipo: "pct", valor: 25 } },
  pacotes: { a3: { preco: 600 } },
  torneios: { to1: { inscricao: 80 } },
  eventos: { e1: { porPessoa: 50 } },
  professores: { "u:p1": { forma: "aula", individual: 90, turma: 120 }, "u:p2": { forma: "pct", pct: 50 }, "u:p3": { forma: "fixo", fixo: 1000 } },
  despesas: [{ id: "d1", nome: "Aluguel", categoria: "aluguel", valor: 2000 }, { id: "d2", nome: "Saibro", categoria: "manutencao", valor: 300 }],
  impostoPct: 6,
  meses: { "2026-11": { recebidos: { "m:t1:a1": true, "p:a3": true }, pagos: { "d:d1": true, "prof:u:p3": true }, valores: { d2: 450 }, manuais: [{ id: "x1", tipo: "entrada", descricao: "Patrocínio", valor: 500 }, { id: "x2", tipo: "saida", descricao: "Bolas", valor: 220 }] } },
};
const m = F.calcularMes(dados, config, "2026-11");

/* entradas */
assert.strictEqual(m.receitas.mensalidades.total, 700, "turma: 400 + 400 com 25% de desconto");
assert.deepStrictEqual(m.receitas.mensalidades.semPreco.map((t) => t.nome), ["Adulto"], "turma sem preço aparece para precificar");
assert.strictEqual(m.receitas.pacotes.total, 600); assert.strictEqual(m.receitas.pacotes.alunos[0].aulasNoMes, 3, "aulas do pacote no mês (a de outubro fica fora)");
assert.strictEqual(m.receitas.quadras.total, 240, "preço por faixa de horário, meia em meia hora");
assert.strictEqual(m.receitas.quadras.horasSemPreco, 1, "reserva em quadra sem preço é avisada");
assert.strictEqual(m.receitas.torneios.total, 320, "4 inscritos × 80"); assert.strictEqual(m.receitas.eventos.total, 100, "só confirmados");
assert.strictEqual(m.entradas, 700 + 600 + 240 + 320 + 100 + 500);

/* saídas */
const prof = (n) => m.despesas.professores.lista.find((p) => p.nome === n);
assert.strictEqual(prof("Leo").aulasTurma, 2, "aula de turma conta uma vez por dia"); assert.strictEqual(prof("Leo").valor, 240);
assert.strictEqual(prof("Duda").aulasIndividuais, 3); assert.strictEqual(prof("Duda").receitaGerada, 600); assert.strictEqual(prof("Duda").valor, 300, "50% do que as aulas dele renderam");
assert.strictEqual(prof("Gui").valor, 1000, "fixo mensal");
assert.strictEqual(m.despesas.fixas.total, 2450, "valor do mês substitui o padrão (saibro 450)");
assert.strictEqual(m.despesas.imposto.valor, Math.round(m.entradas * 0.06 * 100) / 100);
assert.strictEqual(m.saidas, Math.round((1540 + 2450 + m.despesas.imposto.valor + 220) * 100) / 100);
assert.strictEqual(m.resultado, Math.round((m.entradas - m.saidas) * 100) / 100);

/* controle */
assert.strictEqual(m.controle.recebido, 1000, "mensalidade da Ana + pacote do Caio");
assert.deepStrictEqual(m.controle.emAberto.map((l) => l.nome), ["Bia"], "quem está em aberto");
assert.strictEqual(m.controle.pago, 3000, "aluguel + fixo do Gui");

/* outro mês: nada do mês de novembro vaza */
const d = F.calcularMes(dados, config, "2026-12");
assert.strictEqual(d.receitas.quadras.total, 100); assert.strictEqual(d.receitas.torneios.total, 0); assert.strictEqual(d.controle.recebido, 0);
assert.strictEqual(d.despesas.fixas.total, 2300, "sem valor do mês, vale o padrão");

/* visão geral: soma das academias */
const g = F.somarMeses([m, d]);
assert.strictEqual(g.entradas, Math.round((m.entradas + d.entradas) * 100) / 100);
assert.strictEqual(g.porTipo.quadras, 340);
assert.deepStrictEqual(F.mesesAte("2026-02", 4), ["2025-11", "2025-12", "2026-01", "2026-02"]);

/* sem configuração nenhuma: tudo zero, sem erro */
const z = F.calcularMes(dados, {}, "2026-11");
assert.strictEqual(z.entradas, 240, "só as quadras, que já têm preço no app");
assert.strictEqual(z.receitas.mensalidades.semPreco.length, 2);
/* aulas marcadas como realizada na Agenda também pagam o professor; o substituto marcado recebe no lugar do titular;
   "Aluno faltou" e cancelada não entram; Agenda + caderno no mesmo dia contam uma vez */
const oc = (o) => Object.assign({ id: "oc" + Math.random().toString(36).slice(2, 7), tipo: "regular", status: "realizada", horaInicio: "17:00", horaFim: "18:00", presencas: {} }, o);
const comAgenda = Object.assign({}, dados, { ocorrencias: [
  oc({ origemTipo: "turma", origemId: "t2", data: "2026-11-02", professorUid: "p1", professorNome: "Leo" }),                                   // Leo, turma, só na Agenda
  oc({ origemTipo: "turma", origemId: "t1", data: "2026-11-03", professorUid: "p1", professorNome: "Leo" }),                                   // já está no caderno: conta uma vez
  oc({ origemTipo: "turma", origemId: "t2", data: "2026-11-09", professorUid: "p1", professorNome: "Leo", substitutoUid: "p3", substitutoNome: "Gui" }), // Gui substituiu
  oc({ origemTipo: "individual", origemId: "a4", data: "2026-11-12", professorUid: "p1", professorNome: "Leo", presencas: { a4: "falta" } }),  // aluno faltou
  oc({ origemTipo: "turma", origemId: "t2", data: "2026-11-16", professorUid: "p1", professorNome: "Leo", status: "cancelada", motivoCancelamento: "Chuva" }),
  oc({ origemTipo: "individual", origemId: "a4", data: "2026-11-19", professorUid: "p1", professorNome: "Leo", tipo: "reposicao" }),          // reposição dada
  oc({ origemTipo: "individual", origemId: "a4", data: "2026-11-20", professorUid: "p1", professorNome: "Leo", status: "agendada" }),         // não marcada
] });
const ma = F.calcularMes(comAgenda, config, "2026-11");
const profA = (n) => ma.despesas.professores.lista.find((p) => p.nome === n);
assert.strictEqual(profA("Leo").aulasTurma, 3, "Leo: 03 e 10 (caderno) + 02 (Agenda); o 03 não duplica, o 09 foi do Gui");
assert.strictEqual(profA("Leo").aulasIndividuais, 1, "Leo: só a reposição do dia 19 (falta, cancelada e agendada não contam)");
assert.strictEqual(profA("Leo").valor, 3 * 120 + 90);
assert.strictEqual(profA("Gui").aulasTurma, 1, "o substituto recebe a aula que deu");
assert.strictEqual(profA("Duda").aulasIndividuais, 3, "aulas só do caderno continuam contando");
/* o módulo do servidor é cópia exata do app */
const fs = require("fs"), path = require("path");
assert.strictEqual(fs.readFileSync(path.join(__dirname, "../../netlify/functions/_aulas-mes.js"), "utf8"), fs.readFileSync(path.join(__dirname, "../../mty/aulas-mes.js"), "utf8"), "netlify/functions/_aulas-mes.js precisa ser igual a mty/aulas-mes.js");
console.log("check-financeiro: ok");
