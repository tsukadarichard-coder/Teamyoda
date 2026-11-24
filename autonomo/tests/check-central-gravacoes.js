/* Central › Gravações (24/11/2026): regras puras de _central-gravacoes.js — status "No app" sai do link do YouTube da aula,
   marcas da Central (Gravada, No YouTube), sessões de gravação, curso novo da coordenação sem sessão, marca inválida recusada.
   Rode: node tests/check-central-gravacoes.js */
const assert = require("assert"), path = require("path");
const GR = require(path.join(__dirname, "../../netlify/functions/_central-gravacoes.js"));
const CM = require(path.join(__dirname, "../../netlify/functions/_cursos-mty.js"));
const trilhas = JSON.parse(JSON.stringify(CM.CURSOS));
trilhas[0].aulas[0].youtube = "dQw4w9WgXcQ";
trilhas.push({ id: "tr-novo", titulo: "Curso novo", publicada: false, aulas: [{ id: "tr-novo-a1", titulo: "Aula nova", duracao: "10 min" }] });
const v = GR.montar(trilhas, { "cmty-tec-01": "gravada", "cmty-tec-02": "youtube", "cmty-tat-01": "gravada" }, { FB001: "FH Cruzado Profundo" });
const aula = (id) => v.cursos.flatMap((c) => c.aulas).find((a) => a.id === id);
assert.strictEqual(aula("cmty-tec-01").status, "app", "com link do YouTube vale No app, mesmo marcada antes");
assert.strictEqual(aula("cmty-tec-02").status, "youtube");
assert.strictEqual(aula("cmty-tat-01").status, "gravada");
assert.strictEqual(aula("cmty-tec-03").status, "agravar");
assert.deepStrictEqual(v.resumo, { aulas: 30, minutos: 161, agravar: 27, gravada: 1, youtube: 1, app: 1 });
assert.strictEqual(aula("tr-novo-a1").sessao, null, "curso novo fica sem sessão");
assert.strictEqual(v.cursos[3].publicada, false);
assert.deepStrictEqual(v.sessoes.map((s) => [s.n, s.total, s.minutos]), [[1, 6, 36], [2, 3, 21], [3, 3, 17], [4, 10, 44], [5, 7, 33]]);
assert.strictEqual(v.sessoes[0].feitas, 2, "sessão 1: tec-01 (app) e tec-02 (YouTube)");
const fh = aula("cmty-tec-02");
assert(fh.etapas.length === 5 && fh.erros.length === 2 && fh.exercicios[0].nome === "FH Cruzado Profundo" && /potência/.test(fh.fecho), "roteiro do forehand");
let m = GR.limparMarca({}, "cmty-tec-05", "gravada"); assert.deepStrictEqual(m, { "cmty-tec-05": "gravada" });
m = GR.limparMarca(m, "cmty-tec-05", "agravar"); assert.deepStrictEqual(m, {}, "A gravar apaga a marca");
assert.throws(() => GR.limparMarca({}, "cmty-tec-05", "app"), /Status inválido/, "No app não se marca à mão");
assert.throws(() => GR.limparMarca({}, "../x", "gravada"), /Aula inválida/);
console.log("check-central-gravacoes: ok");
