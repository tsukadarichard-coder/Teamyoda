/* Planejamento da equipe (mty/plano-equipe.js) e a parte dele no relatório do atleta. Rode: node tests/check-plano-equipe.js */
const assert = require("assert");
const P = require("../../mty/plano-equipe.js"), R = require("../../mty/relatorio-atleta.js");

/* ciclo de 4 semanas a partir de uma segunda, treinos seg/qua/sex */
let p = P.montarCiclo({ semanas: 4, inicio: "2026-11-02", dias: [5, 1, 3], duracaoMin: 90, grupo: "misto", objetivo: "Preparar a Copa Verão" });
assert.deepStrictEqual([p.ciclo.semanas, p.ciclo.inicio, p.ciclo.fim, p.ciclo.dias], [4, "2026-11-02", "2026-11-29", [1, 3, 5]]);
assert.deepStrictEqual(p.semanas.map((s) => [s.n, s.inicio, s.fim]), [[1, "2026-11-02", "2026-11-08"], [2, "2026-11-09", "2026-11-15"], [3, "2026-11-16", "2026-11-22"], [4, "2026-11-23", "2026-11-29"]]);
assert.deepStrictEqual(p.semanas[0].dias.map((d) => d.data), ["2026-11-02", "2026-11-04", "2026-11-06"], "seg, qua e sex");
assert.deepStrictEqual(Object.keys(p.meses), ["2026-11"]);

/* o coordenador preenche; remontar com mais semanas e outros dias mantém o que já foi escrito */
p.semanas[0].grupo = "tecnico"; p.semanas[0].itens = ["saque", "inventado", "movimentacao"]; p.semanas[0].obs = "Base do saque";
p.semanas[0].dias[0] = { ...p.semanas[0].dias[0], grupo: "tecnico", itens: ["saque", "precisao"], obs: "Cestos de saque" };
p.meses["2026-11"] = { grupo: "tecnico", obs: "Mês de base" };
p = P.montarCiclo({ semanas: 8, inicio: "2026-11-02", dias: [1, 2], duracaoMin: 60 }, p);
assert.strictEqual(p.semanas.length, 8); assert.strictEqual(p.ciclo.fim, "2026-12-27");
assert.deepStrictEqual([p.semanas[0].grupo, p.semanas[0].itens, p.semanas[0].obs], ["tecnico", ["movimentacao", "saque"], "Base do saque"], "item desconhecido some, ordem da classificação");
assert.deepStrictEqual(p.semanas[0].dias.map((d) => d.data), ["2026-11-02", "2026-11-03"]);
assert.strictEqual(p.semanas[0].dias[0].obs, "Cestos de saque", "o dia que continua no ciclo mantém o que foi escrito");
assert.deepStrictEqual(Object.keys(p.meses), ["2026-11", "2026-12"]); assert.strictEqual(p.meses["2026-11"].obs, "Mês de base");
assert(P.montarCiclo({ semanas: 99, inicio: "x", dias: [] }).semanas.length === 24, "no máximo 24 semanas");

/* situação, semana atual e explicação dos ciclos */
assert.strictEqual(P.situacao(p, "2026-10-30"), "antes"); assert.strictEqual(P.situacao(p, "2026-11-10"), "andamento"); assert.strictEqual(P.situacao(p, "2027-01-05"), "encerrado");
assert.strictEqual(P.semanaDe(p, "2026-11-10").n, 2);
assert(/blocos de 4/.test(P.explicacaoCiclo(8)) && /torneio-alvo/.test(P.explicacaoCiclo(12)) && /1 a 24/.test(P.explicacaoCiclo(5)));
assert.strictEqual(P.rotuloCiclo(p.ciclo), "8 semanas · 02/11 a 27/12 · Seg, Ter · 60 min");

/* limpar (o que vai para o link do aluno) */
const l = P.limpar({ ...p, segredo: "x", semanas: p.semanas.map((s, i) => (i === 0 ? { ...s, extra: "<b>" } : s)) });
assert(!JSON.stringify(l).includes("segredo") && !JSON.stringify(l).includes("extra") && l.semanas.length === 8);
const h = P.htmlAluno({ equipe: "Juvenil <A>", coordenador: "Richard", plano: l }, "2026-11-02", false);
assert(/Juvenil &lt;A&gt;/.test(h) && /Esta semana/.test(h) && /hoje/.test(h) && /Cestos de saque/.test(h) && !/Todas as semanas/.test(h));
assert(/Todas as semanas/.test(P.htmlAluno({ equipe: "J", plano: l }, "2026-11-02", true)));

/* no relatório: semanas do período, com grupo, itens e observações */
const aluno = { nome: "Nicolas", registros: [] };
let r = R.coletar(aluno, [], { tipo: "mes", mes: "2026-11" }, [{ equipe: "Juvenil", plano: p }]);
assert.strictEqual(r.planejamento.length, 1); assert.strictEqual(r.planejamento[0].semanas.length, 5, "semanas que tocam novembro");
assert.deepStrictEqual([r.planejamento[0].semanas[0].grupo, r.planejamento[0].semanas[0].itens], ["Técnico", ["Movimentação", "Saque"]]);
const html = R.html(r, {});
assert(/Planejamento da equipe · Juvenil/.test(html) && /Semana 1/.test(html) && /Técnico · Movimentação, Saque/.test(html) && /Cestos de saque/.test(html) && !/Nenhum registro neste período/.test(html));
assert.strictEqual(R.coletar(aluno, [], { tipo: "mes", mes: "2027-03" }, [{ equipe: "Juvenil", plano: p }]).planejamento.length, 0, "fora do ciclo, nada");
r = R.coletarDoLink({ nome: "Nicolas", planosEquipe: [{ equipe: "Juvenil", plano: l }] }, { tipo: "datas", de: "2026-11-01", ate: "2026-11-08" });
assert.strictEqual(r.planejamento[0].semanas.length, 1);
console.log("check-plano-equipe: ok");
