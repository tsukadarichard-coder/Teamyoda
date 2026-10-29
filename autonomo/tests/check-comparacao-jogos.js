/* Comparação do jogo recém-marcado com os anteriores (função compararJogoComAnteriores do app do treinador, nos dois apps). Rode: node tests/check-comparacao-jogos.js */
const fs = require("fs"), path = require("path"), assert = require("assert");
const M = require("../player/scout-motor.js");
for (const app of ["autonomo", "mty"]) {
  const html = fs.readFileSync(path.join(__dirname, "..", app === "mty" ? "../mty" : ".", "index.html"), "utf8");
  const a = html.indexOf("const ROTULO_ZONA_COMP"), b = html.indexOf("function ComparacaoScoutCompleta");
  const c = html.indexOf("function compararJogoComAnteriores"), d = html.indexOf("function ConfrontoDireto"); /* até os componentes do confronto direto (JSX) */
  assert(a > 0 && b > a && c > 0 && d > c, app + ": trechos não encontrados");
  const C = { grafite: "#555", quadra: "#0a0", saibro: "#c50", tinta: "#111", linha: "#ddd", papel: "#fff", cal: "#fff" };
  const corpo = html.slice(a, b) + "\n" + html.slice(c, d) + "\nreturn { compararJogoComAnteriores, METRICAS_SCOUT };";
  const pre = "const JANELA_MOMENTO = 6, serieMomento = () => [], sequenciasMomento = () => ({ melhor: { tam: 0 }, pior: { tam: 0 } }), zonasDe = () => ({});"; /* o momento e as zonas têm testes próprios (check-ao-vivo-analise) */
  const mod = new Function("M", "C", pre + "\n" + corpo)(M, C);
  // jogos de teste (medidas já calculadas, como ficam salvas no caderno)
  const jogo = (o) => ({ tipo: "jogo", scout: { n: 20, ...o } });
  const ant = [jogo({ pctGanhos: 40, errosNos: 8, pctPrimeiro: 55, aces: 1 }), jogo({ pctGanhos: 45, errosNos: 7, pctPrimeiro: 60, aces: 2 })], atual = { n: 20, pctGanhos: 70, errosNos: 3, pctPrimeiro: 58, aces: 1.5 };
  const r = mod.compararJogoComAnteriores({ ...atual, pontos: [], cfg: {} }, ant);
  assert.strictEqual(r.n, 2, app + ": conta jogos anteriores");
  const L = (rot) => r.linhas.find((l) => l.rot === rot);
  assert.strictEqual(L("Pontos ganhos").sentido, 1, app + ": mais pontos ganhos = melhor");
  assert.strictEqual(L("Pontos ganhos").media, "42.5%", app + ": média dos anteriores");
  assert.strictEqual(L("Pontos ganhos").ultimo, "45%", app + ": último jogo");
  assert.strictEqual(L("Erros").sentido, 1, app + ": menos erros = melhor");
  assert.strictEqual(L("1º saque dentro").sentido, 0, app + ": variação pequena = igual");
  assert(r.melhoraram >= 2 && r.pioraram === 0, app + ": contagens " + r.melhoraram + "/" + r.pioraram);
  const pior = mod.compararJogoComAnteriores({ n: 20, pctGanhos: 20, errosNos: 12, pontos: [], cfg: {} }, ant);
  assert.strictEqual(pior.linhas.find((l) => l.rot === "Erros").sentido, -1, app + ": mais erros = pior");
  // sem jogos anteriores
  assert.strictEqual(mod.compararJogoComAnteriores({ ...atual, pontos: [], cfg: {} }, []).n, 0, app + ": primeiro jogo");
  // jogo importado do Competição (sem pontos e sem várias medidas) não quebra
  const imp = { tipo: "jogo", origemCompeticao: true, scout: { n: 30, pctGanhos: 50 } };
  const r2 = mod.compararJogoComAnteriores({ ...atual, pontos: [], cfg: {} }, [imp]);
  assert(r2.linhas.some((l) => l.rot === "Pontos ganhos"), app + ": jogo importado compara o que tem");
  console.log("check-comparacao-jogos " + app + ": ok (" + r.linhas.length + " medidas)");
}
