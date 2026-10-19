/* Placar na página da família: do motor do scout, passando pela limpeza do servidor, até o HTML. Rode: node tests/check-placar-familia.js */
const assert = require("assert"), path = require("path");
/* o servidor pede firebase-admin só para ler dados; aqui só a função pura limpar() é usada */
require.cache[require.resolve("../netlify/functions/_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin: {}, app: () => {} } };
const M = require("../player/scout-motor.js");
const { limpar } = require("../netlify/functions/_scout-publico.js");
const G = require("../scout/graficos.js");
const nos = (v) => ({ nos: v, fim: v ? "winner_nos" : "erro_nos", bola: "1-2" });
const jogaGame = (v) => [nos(v), nos(v), nos(v), nos(v)];
function resumo(pontos, extra) {
  const r = M.resume(pontos);
  const reg = { data: "2026-10-20", torneio: "", resultado: "", concluida: false, scout: { ...r, pontos, cfg: { formato: "3sets", saca: "nos" } }, ...(extra || {}) };
  return { ...M.montarResumoPublico(reg, { nome: "Ana Souza" }), aoVivo: true };
}
// 1) começo: 0-0 e quem saca primeiro
let p = limpar(resumo([]));
assert(p.placar && p.placar.sacador === "atleta" && p.placar.games.join("-") === "0-0", "início do jogo");
assert(G.placarAoVivo(p).includes("Ana") && G.placarAoVivo(p).includes("Adversário"), "nomes");
// 2) um game ganho e pontos no seguinte: 1-0, 15-30, adversário saca
const pts = [...jogaGame(true), nos(true), nos(false), nos(false)];
p = limpar(resumo(pts));
assert.strictEqual(p.placar.games.join("-"), "1-0"); assert.strictEqual(p.placar.pontos, "15-30"); assert.strictEqual(p.placar.sacador, "adversario");
let html = G.placarAoVivo(p);
assert(html.includes("Games") && html.includes("Game") && html.includes(">15<") && html.includes(">30<") && html.includes("Ao vivo"), "tela ao vivo mostra games e pontos");
assert((html.match(/qg-pl-bola"/g) || []).length === 1, "só um sacador marcado");
// 3) set fechado: 6-0 depois 1-0 no 2º set
let longo = []; for (let i = 0; i < 6; i++) longo = longo.concat(jogaGame(true)); longo = longo.concat(jogaGame(true));
p = limpar(resumo(longo)); assert.strictEqual(p.placar.sets.length, 1); assert.deepStrictEqual(p.placar.sets[0], [6, 0]); assert.strictEqual(p.placar.games.join("-"), "1-0");
assert(G.placarAoVivo(p).includes("Set 1"), "coluna do set fechado");
// 4) partida encerrada: 2 sets a 0
let fim = []; for (let i = 0; i < 12; i++) fim = fim.concat(jogaGame(true));
p = limpar({ ...resumo(fim), aoVivo: false, concluida: true }); assert(p.placar.fim && p.placar.vencedor === "atleta", "fim da partida");
html = G.placarAoVivo(p); assert(html.includes("vitória de Ana") && !html.includes(">Games<"), "partida encerrada");
// 5) interrompida (não terminou, sem ao vivo)
p = limpar({ ...resumo(pts), aoVivo: false, concluida: false }); assert(G.placarAoVivo(p).includes("interrompido"), "interrompida");
// 6) segurança: o servidor descarta lixo e nome de adversário nunca passa
const sujo = limpar({ ...resumo(pts), placar: { sets: [[6, 4, 9], ["x", -3]], games: [200, "a"], pontos: "<script>", sacador: "<b>", vencedor: "x", adversario: "Fulano" } });
assert.deepStrictEqual(sujo.placar.sets[1], [0, 0]); assert.deepStrictEqual(sujo.placar.games, [0, 0]); assert.strictEqual(sujo.placar.sacador, ""); assert(!JSON.stringify(sujo).includes("Fulano"));
assert(!G.placarAoVivo(sujo).includes("<script>"), "html escapado");
// 7) links antigos, sem placar, não quebram
assert.strictEqual(G.placarAoVivo({ atleta: "Ana", resultado: "6-4" }), "");
console.log("check-placar-familia: ok");
