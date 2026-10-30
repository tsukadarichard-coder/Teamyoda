/* "Com comparação" no relatório de um jogo salvo: entram até 5 outros jogos com scout, os mais próximos antes dele e, se faltar,
   os de depois (o jogo mais antigo também compara). Nos dois apps. Rode: node tests/check-outros-jogos.js */
const fs = require("fs"), path = require("path"), assert = require("assert");
for (const app of ["autonomo", "mty"]) {
  const html = fs.readFileSync(path.join(__dirname, "..", app === "mty" ? "../mty" : ".", "index.html"), "utf8");
  const i = html.indexOf("function outrosJogosParaComparar("), j = html.indexOf("\n}\n", i) + 2;
  assert(i > 0, app + ": função encontrada");
  const f = new Function(html.slice(i, j) + "\nreturn outrosJogosParaComparar;")();
  const jogo = (id, data, n = 20) => ({ id, tipo: "jogo", data, scout: { n, pontos: [] } });
  const regs = [jogo("a", "2026-01-10"), jogo("b", "2026-02-10"), jogo("c", "2026-03-10"), { id: "x", tipo: "aula", data: "2026-03-11" }, jogo("d", "2026-04-10"),
    jogo("e", "2026-05-10"), jogo("f", "2026-06-10"), jogo("g", "2026-07-10"), { id: "s", tipo: "jogo", data: "2026-08-01" }, jogo("v", "2026-08-02", 0)];
  const al = { registros: regs };
  assert.deepStrictEqual(f(al, regs[0]).map((x) => x.id), ["b", "c", "d", "e", "f"], app + ": o mais antigo compara com os seguintes");
  assert.deepStrictEqual(f(al, regs[7]).map((x) => x.id), ["b", "c", "d", "e", "f"], app + ": o mais novo compara com os 5 anteriores");
  assert.deepStrictEqual(f(al, regs[2]).map((x) => x.id), ["a", "b", "d", "e", "f"], app + ": no meio: anteriores e, completando, os seguintes");
  assert.deepStrictEqual(f({ registros: [regs[0], jogo("m", "2026-01-10")] }, regs[0]).map((x) => x.id), ["m"], app + ": jogo do mesmo dia entra");
  assert(!f(al, regs[0]).some((x) => x.id === "a" || x.id === "s" || x.id === "v" || x.id === "x"), app + ": nunca o próprio jogo, aula, jogo sem scout ou sem pontos");
  console.log("check-outros-jogos " + app + ": ok");
}
