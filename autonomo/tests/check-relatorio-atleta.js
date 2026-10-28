/* Relatório do atleta (mty/relatorio-atleta.js): período por torneio, mês e datas; só organiza o registrado; perguntas internas fora;
   texto escapado; o mesmo formato a partir do link do aluno. Rode: node tests/check-relatorio-atleta.js */
const assert = require("assert");
const R = require("../../mty/relatorio-atleta.js");
const aluno = { nome: "Nicolas Prado", registros: [
  { id: "j1", tipo: "jogo", data: "2026-10-10", torneio: "Copa Verão", adversario: "Caio", resultado: "6-4 6-3", observacaoFinal: "Boa leitura", scout: { n: 80, pctGanhos: 55, pctPrimeiro: 62, saquesMarcados: 30, df: 2 } },
  { id: "j2", tipo: "jogo", data: "2026-10-11", torneio: "Copa Verão", adversario: "Léo", resultado: "3-6 4-6", scout: { n: 60, pctGanhos: 45 } },
  { id: "j3", tipo: "jogo", data: "2026-09-20", torneio: "jogo-treino", adversario: "—", resultado: "6-2", scout: { n: 40, pctGanhos: 60 } },
  { id: "o1", tipo: "observacao", contexto: "partida", data: "2026-10-10", torneio: "Copa Verão", resumo: { positivos: "- Boa devolução cruzada", atencao: "- Segundo saque curto", insights: "- Trabalhar profundidade", perguntas: "- Perguntar sobre o nervosismo <b>", prioridades: "- Segundo saque curto" } },
  { id: "o2", tipo: "observacao", contexto: "conversa", data: "2026-10-12", obs: [{ texto: "conversa privada", natureza: "positivo" }] },
  { id: "o3", tipo: "observacao", contexto: "partida", data: "2026-09-21", obs: [{ texto: "Mais agressivo <script>", natureza: "positivo" }, { texto: "Perguntar algo", natureza: "pergunta" }] },
] };
const movs = [{ id: "m1", criadoEm: "2026-10-12T10:00:00Z", golpe: "saque", res: { ok: 8, atencao: 3 }, prio: ["Flexão dos joelhos"] }, { id: "m2", criadoEm: "2026-08-01T10:00:00Z", golpe: "forehand", res: { ok: 5, atencao: 1 } }];

let r = R.coletar(aluno, movs, { tipo: "torneio", torneio: "Copa Verão" });
assert.strictEqual(r.rotulo, "Copa Verão · 10/10/2026 a 11/10/2026");
assert.deepStrictEqual(r.jogos.map((j) => j.data), ["2026-10-10", "2026-10-11"], "só os jogos do torneio");
assert.deepStrictEqual([r.numeros.jogos, r.numeros.pontos, r.numeros.pctGanhosMedio, r.numeros.observacoes], [2, 140, 50, 1]);
assert.deepStrictEqual(r.positivos, ["Boa devolução cruzada"]); assert.deepStrictEqual(r.atencao, ["Segundo saque curto"]);
assert.deepStrictEqual(r.foco, ["Segundo saque curto", "Trabalhar profundidade"], "prioridades e insights, sem repetir");
assert.strictEqual(r.movimentos.length, 0, "análise de movimento fora das datas do torneio não entra");
assert(!JSON.stringify(r).includes("nervosismo") && !JSON.stringify(r).includes("conversa privada"), "perguntas e conversas ficam fora");

r = R.coletar(aluno, movs, { tipo: "mes", mes: "2026-10" });
assert.strictEqual(r.rotulo, "Outubro de 2026"); assert.strictEqual(r.numeros.jogos, 2); assert.deepStrictEqual(r.movimentos.map((m) => [m.golpe, m.ok, m.atencao]), [["Saque", 8, 3]]);
r = R.coletar(aluno, movs, { tipo: "datas", de: "2026-09-01", ate: "2026-09-30" });
assert.strictEqual(r.jogos[0].torneio, "", "jogo-treino não vira torneio"); assert.deepStrictEqual(r.positivos, ["Mais agressivo <script>"]); assert.strictEqual(r.numeros.observacoes, 1);
assert.deepStrictEqual(R.torneiosDoAluno(aluno), ["Copa Verão"]);

const h = R.html(r, { observacao: "Bom mês <img src=x>", treinador: "Richard", publicadoEm: "2026-10-30T10:00:00Z" });
assert(h.includes("&lt;script&gt;") && h.includes("&lt;img src=x&gt;") && !h.includes("<script>") && h.includes("Observação do treinador") && h.includes("Publicado em 30/10/2026 por Richard"), "escapado e completo");
assert(/não é uma avaliação completa/.test(h));
assert(R.html(r, { automatico: true }).includes("sem a observação do treinador"));
assert(/window.print/.test(R.documento(r, {})));

/* a partir do link do aluno */
const d = { nome: "Nicolas", jogos: [{ data: "2026-10-10", torneio: "Copa Verão", resultado: "6-4 6-3", n: 80, pctGanhos: 55 }, { data: "2025-01-01", n: 10, pctGanhos: 30 }],
  movimentos: movs, observacoes: [{ data: "2026-10-10", contexto: "partida", torneio: "Copa Verão", resumo: { positivos: "- Boa devolução", atencao: "", insights: "- Profundidade", prioridades: "" } }] };
r = R.coletarDoLink(d, { tipo: "datas", de: "2026-10-01", ate: "2026-10-31" });
assert.deepStrictEqual([r.numeros.jogos, r.numeros.pctGanhosMedio, r.numeros.movimentos], [1, 55, 1]); assert.deepStrictEqual(r.foco, ["Profundidade"]);
assert.strictEqual(R.coletarDoLink(d, { tipo: "tudo" }).numeros.jogos, 2);
console.log("check-relatorio-atleta: ok");
