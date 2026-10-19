/* Relatório dos jogos no Competição: monta o relatório a partir de resumos públicos (o que o atleta/responsável/treinador recebem), sem os pontos do jogo. */
const assert = require("assert"), fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "..");
const fx = path.join(dir, "netlify/functions/");
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "x", filename: "x", loaded: true, exports: {} };
const M = require(path.join(dir, "player/scout-motor.js")), R = require(path.join(dir, "scout/relatorio-jogos.js")), { limpar } = require(path.join(dir, "netlify/functions/_scout-publico"));
const src = fs.readFileSync(path.join(dir, "player/player.js"), "utf8");
const t = (i, f) => { const a = src.indexOf(i), b = src.indexOf(f, a + i.length); assert(a >= 0 && b > a, "trecho: " + i); return src.slice(a, b); };
const codigo = [t("  var SC_ZONAS", "  function scMetricas()"), t("  function scTendenciaRel", "  function abrirRelatorioScouts")].join("\n");
const { scMetricasRel, scTendenciaRel } = new Function("esc", codigo + "; return { scMetricasRel, scTendenciaRel };")((s) => s);

let seed = 5; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const FINS = [["winner_nos", true], ["erro_dele", true], ["erro_nos", false], ["winner_dele", false]];
const resumos = [];
for (let j = 0; j < 4; j++) {
  const cfg = { formato: "3sets", saca: "nos", semVantagem: false, superTiebreakDecisivo: false };
  let e = M.placarInicial("3sets", "nos", false, false), pontos = [];
  for (let i = 0; i < 60 && !e.fim; i++) {
    const ganha = rnd() < 0.5 + j * 0.05, fim = FINS.filter((x) => x[1] === ganha)[Math.floor(rnd() * 2)][0];
    pontos.push({ fim, nos: ganha, saque: rnd() > 0.5 ? "1" : null, bola: ["1-2", "3-4", "5+"][Math.floor(rnd() * 3)], causa: fim === "erro_nos" ? "decisao" : null, rede: false, situacao: "ataque", dec: rnd() > 0.5 ? "boa" : "ruim", jogo: M.numeroDoGame(e), adverso: M.ehAdverso(e), sacador: M.quemSaca(e), lado: M.ladoDoSaque(e), zona: "D-FUNDO", n: i + 1, placarAntes: M.rotuloPontos(e) });
    e = M.aplicaPonto(e, ganha);
  }
  const rr = M.resume(pontos);
  const reg = { data: "2026-0" + (j + 1) + "-05", torneio: "Copa " + j, resultado: "6-4 6-3", concluida: true, observacaoFinal: j === 3 ? "Boa <i>evolução</i>." : "", nivelAdversario: "avancado", mental: { antes: { conf: 3, foco: 4 }, depois: { conf: 4 }, jogo: { 1: 3 } }, scout: { ...rr, pontos, cfg } };
  resumos.push({ id: "s" + j, data: reg.data, resumo: limpar(JSON.parse(JSON.stringify(M.montarResumoPublico(reg, { nome: "Ana Souza" })))) });
}
const jogos = resumos.map((x) => { const rs = x.resumo, flat = Object.assign({}, rs, rs.numeros, rs.bolas); return { id: x.id, data: rs.data, torneio: rs.torneio, adversario: "", resultado: rs.resultado, concluida: rs.concluida !== false, nivelAdversario: rs.nivelAdversario, observacaoFinal: rs.observacaoFinal, mental: rs.mental, scout: flat }; });
const html = R.gerar({ atleta: jogos[0].scout.atleta, jogos, metricas: scMetricasRel(), tendencia: scTendenciaRel, leitura: (s) => (s.sinais || []).map((x) => ["", x]), detalheDe: (r) => r.scout.detalhe || null, zonasDe: (_p, s) => s.zonas || {}, cabecalhoHtml: "<div>QUADRALAB · COMPETIÇÃO</div>", geradoEm: "19/10/2026" });
["Relatório dos jogos", "Leitura do período", "Evolução jogo a jogo", "Pontos ganhos", "Comparação de todos os dados", "Cada jogo", "game a game", "Decisões de Ana", "Decisões e estado mental", "adversário avançado", "Boa &lt;i&gt;evolução", "QUADRALAB · COMPETIÇÃO", "Mapa da quadra"].forEach((s) => assert(html.includes(s), "falta: " + s));
assert(!/undefined|NaN|Infinity/.test(html.replace(/<style>[\s\S]*?<\/style>/, "")), "valor inválido: " + (html.match(/.{30}(undefined|NaN|Infinity).{30}/) || [])[0]);
assert((html.match(/<svg/g) || []).length >= 10, "poucos gráficos");
assert(fs.readFileSync(path.join(dir, "competicao/index.html"), "utf8").includes("relatorio-jogos.js"));
console.log("check-relatorio-competicao: ok");
