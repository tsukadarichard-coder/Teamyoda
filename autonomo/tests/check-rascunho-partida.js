/* Retomar partida: o rascunho refaz placar e "desfazer" a partir dos pontos e cabe no limite do navegador.
   Rode: node tests/check-rascunho-partida.js */
const fs = require("fs"), path = require("path"), assert = require("assert");
const M = require("../player/scout-motor.js");
for (const app of ["autonomo", "mty"]) {
  const html = fs.readFileSync(path.join(__dirname, "..", app === "mty" ? "../mty" : ".", "index.html"), "utf8");
  const a = html.indexOf("function refazerPlacar"), b = html.indexOf("function textoPlacarRascunho"), c = html.indexOf("function dataHoraCurta");
  assert(a > 0 && b > a && c > b, app + ": funções do rascunho não encontradas");
  const mod = new Function("M", "const { placarInicial, aplicaPonto, rotuloPontos } = M;\n" + html.slice(a, c) + "\nreturn { refazerPlacar, textoPlacarRascunho };")(M);
  const cfg = { formato: "3sets", saca: "nos", semVantagem: false, superTiebreakDecisivo: false };
  // 260 pontos alternando quem ganha, com os campos que o app guarda em cada ponto
  let e = M.placarInicial(cfg.formato, cfg.saca, false, false); const pontos = [];
  for (let i = 0; i < 260 && !e.fim; i++) { const nos = i % 2 === 0; pontos.push({ fim: nos ? "winner_nos" : "erro_nos", nos, saque: null, bola: "3-4", causa: null, rede: false, situacao: "neutra", adverso: false, sacador: "nos", lado: "D", dirSaque: null, n: i + 1, placarAntes: M.rotuloPontos(e), jogo: 1, set: 1 }); e = M.aplicaPonto(e, nos); }
  const r = mod.refazerPlacar(cfg, pontos);
  assert.deepStrictEqual(r.placar, e, app + ": o placar refeito é o mesmo do jogo");
  assert.strictEqual(r.pilha.length, pontos.length, app + ": um passo de desfazer por ponto");
  assert.deepStrictEqual(r.pilha[r.pilha.length - 1].pontos.length, pontos.length - 1, app + ": desfazer volta um ponto");
  assert.deepStrictEqual(M.aplicaPonto(r.pilha[r.pilha.length - 1].placar, pontos[pontos.length - 1].nos), r.placar, app + ": desfazer e refazer dá o mesmo placar");
  // tamanho: o formato antigo (com a pilha) estourava o limite do navegador; o novo não
  const antigo = JSON.stringify({ cfg, placar: r.placar, pontos, pilha: r.pilha, fase: "durante", aoVivo: null, mental: {} }).length;
  const novo = JSON.stringify({ cfg, placar: r.placar, pontos, fase: "durante", aoVivo: null, mental: {}, salvoEm: "2026-10-20T10:00:00Z" }).length;
  assert(pontos.length >= 200, app + ": partida longa de teste (" + pontos.length + " pontos)");
  assert(antigo > 20 * novo, app + ": o formato antigo crescia com o quadrado dos pontos (" + Math.round(antigo / 1024) + " KB contra " + Math.round(novo / 1024) + " KB)");
  assert(novo < 200 * 1024, app + ": rascunho novo cabe com folga (" + Math.round(novo / 1024) + " KB)");
  assert(mod.textoPlacarRascunho({ placar: r.placar }).length > 0);
  const meio = mod.refazerPlacar(cfg, pontos.slice(0, 40)).placar;
  assert(/\(\w+-\w+\)/.test(mod.textoPlacarRascunho({ placar: meio })), app + ": texto do placar em andamento mostra os pontos do game");
  console.log("check-rascunho-partida " + app + ": ok (antigo " + Math.round(antigo / 1024) + " KB × novo " + Math.round(novo / 1024) + " KB, " + pontos.length + " pontos)");
}
