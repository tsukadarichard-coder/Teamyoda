/* player/scout-motor.js (responsável) tem de dar o mesmo resultado que o scout do treinador (index.html). Rode: node tests/check-scout-motor.js */
const fs = require("fs"), assert = require("assert"), path = require("path"), cp = require("child_process");
const dir = path.join(__dirname, "..");
const antes = fs.readFileSync(path.join(dir, "player/scout-motor.js"), "utf8");
cp.execFileSync(process.execPath, [path.join(__dirname, "gerar-scout-motor.js")], { stdio: "ignore" });
assert.strictEqual(fs.readFileSync(path.join(dir, "player/scout-motor.js"), "utf8"), antes, "scout-motor.js está desatualizado: rode node tests/gerar-scout-motor.js");
const M = require(path.join(dir, "player/scout-motor.js"));

/* o motor extraído do index.html (referência) */
const src = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const t = (i, f, inc) => { const a = src.indexOf(i), b = src.indexOf(f, a + i.length); return src.slice(a, b + (inc ? f.length : 0)); };
const ref = new Function([t("const PONTOS_TENIS", "const FIM_PONTO"), t("function resume(pontos)", "function leitura(r)"), t("function leitura(r)", "\n}\n", true), t("const JANELA_MOMENTO", "function sequenciasMomento"), t("const ZONAS = [", "function MapaDaQuadra"), t("function contagemDosPontos", "/* Observação final do treinador")].join("\n") + "; return { placarInicial, aplicaPonto, resume, leitura, montarResumoPublico };")();

let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const FINS = [["winner_nos", true], ["erro_dele", true], ["erro_nos", false], ["winner_dele", false]];
for (const formato of ["3sets", "1set", "4games"]) for (const saca of ["nos", "ele"]) {
  const cfg = { formato, saca, semVantagem: rnd() > 0.5, superTiebreakDecisivo: formato === "3sets" && rnd() > 0.5 };
  let e = M.placarInicial(formato, saca, cfg.semVantagem, cfg.superTiebreakDecisivo), pontos = [];
  for (let i = 0; i < 260 && !e.fim; i++) {
    const [fim, nos] = FINS[Math.floor(rnd() * 4)];
    const p = { fim, nos, saque: rnd() > 0.5 ? ["1", "2", "df", "ace"][Math.floor(rnd() * 4)] : null, bola: ["1-2", "3-4", "5+"][Math.floor(rnd() * 3)], causa: fim === "erro_nos" ? "decisao" : null, rede: rnd() > 0.8, situacao: [null, "ataque", "contra", "defesa"][Math.floor(rnd() * 4)], zona: rnd() > 0.5 ? "D-FUNDO" : null, adverso: M.ehAdverso(e), sacador: M.quemSaca(e), lado: M.ladoDoSaque(e), n: i + 1, placarAntes: M.rotuloPontos(e) };
    pontos.push(p); e = M.aplicaPonto(e, nos);
  }
  const r = M.resume(pontos);
  assert.deepStrictEqual(r, ref.resume(pontos)); assert.deepStrictEqual(M.leitura(r), ref.leitura(r));
  const reg = { data: "2026-10-18", torneio: "X", resultado: "6-4", concluida: true, scout: { ...r, pontos, cfg } };
  assert.deepStrictEqual(M.montarResumoPublico(reg, { nome: "Ana Souza" }), ref.montarResumoPublico(reg, { nome: "Ana Souza" }));
  assert.ok(e.fim || pontos.length === 260, "a partida termina pelas regras");
}
console.log("check-scout-motor: ok");
