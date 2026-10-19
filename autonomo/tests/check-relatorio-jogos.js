/* Relatório dos jogos (scout/relatorio-jogos.js): gera o documento com jogos simulados pelo motor do scout, confere as seções e que nada vaza sem escape. */
const assert = require("assert"), fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "..");
const M = require(path.join(dir, "player/scout-motor.js")), R = require(path.join(dir, "scout/relatorio-jogos.js"));
const src = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const t = (i, f) => { const a = src.indexOf(i), b = src.indexOf(f, a + i.length); assert(a >= 0 && b > a, "trecho: " + i); return src.slice(a, b); };
const trechos = [t("function inclinacaoLinear(", "/* Resumo factual"), t("const ROTULO_ZONA_COMP", "function ComparacaoScoutCompleta")].join("\n");
const { METRICAS_SCOUT, tendenciaScout } = new Function("M", "C", "zonasDe", "serieMomento", "const JANELA_MOMENTO = 6; const sequenciasMomento = () => ({ melhor: { tam: 4 }, pior: { tam: 2 } });" + trechos + "; return { METRICAS_SCOUT, tendenciaScout };")(M, { grafite: "#5B6B63" }, M.zonasDe, M.serieMomento);
/* tendenciaScout usa C.grafite no app; aqui basta uma cor */

let seed = 11; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const FINS = [["winner_nos", true], ["erro_dele", true], ["erro_nos", false], ["winner_dele", false]];
const regs = [];
for (let j = 0; j < 6; j++) {
  const cfg = { formato: "3sets", saca: j % 2 ? "nos" : "ele", semVantagem: false, superTiebreakDecisivo: false };
  let e = M.placarInicial(cfg.formato, cfg.saca, false, false), pontos = [];
  for (let i = 0; i < 70 + j * 5 && !e.fim; i++) {
    const [fim, nos] = FINS[Math.floor(rnd() * 4)] ; const ganha = rnd() < 0.45 + j * 0.03 ? true : nos;
    const f2 = FINS.filter((x) => x[1] === ganha)[Math.floor(rnd() * 2)][0];
    const sacador = M.quemSaca(e);
    const p = { fim: f2, nos: ganha, saque: rnd() > 0.5 ? ["1", "2", "df", "ace"][Math.floor(rnd() * 4)] : null, bola: ["1-2", "3-4", "5+"][Math.floor(rnd() * 3)], causa: f2 === "erro_nos" ? (rnd() > 0.5 ? "decisao" : "execucao") : null,
      rede: rnd() > 0.8, situacao: ["ataque", "contra", "defesa", "neutra", "construcao"][Math.floor(rnd() * 5)], golpe: ["forehand", "backhand", "voleio", "smash", "drop", "lob", "devolucao"][Math.floor(rnd() * 7)], corrida: rnd() > 0.7, direcao: rnd() > 0.5 ? "cruzado" : "paralelo",
      dec: ["boa", "disc", "ruim", null][Math.floor(rnd() * 4)], jogo: M.numeroDoGame(e), adverso: M.ehAdverso(e), sacador, lado: M.ladoDoSaque(e), dirSaque: ["aberto", "fechado", "corpo", null][Math.floor(rnd() * 4)], zona: ["D-REDE", "E-FUNDO", "D-FUNDO", null][Math.floor(rnd() * 4)], n: i + 1, placarAntes: M.rotuloPontos(e) };
    pontos.push(p); e = M.aplicaPonto(e, ganha);
  }
  const r = M.resume(pontos);
  regs.push({ id: "r" + j, tipo: "jogo", data: "2026-0" + (j + 1) + "-10", torneio: j % 2 ? "Copa <Brasil>" : "jogo-treino", adversario: "Adv " + j, resultado: "6-4 3-6 6-2", concluida: true, nivelAdversario: ["intermediario", "avancado"][j % 2], observacaoFinal: j === 5 ? "Boa evolução no saque.\nTrabalhar a devolução <b>no lado esquerdo</b>." : "",
    mental: { antes: { conf: 2 + (j % 3), foco: 3, energia: 4, calma: 2 + (j % 2) }, depois: { conf: 3 + (j % 2), foco: 4, energia: 3, calma: 3 }, jogo: { 1: 3, 2: 4 } }, scout: { ...r, pontos, cfg } });
}
const html = R.gerar({ atleta: "Ana <b>Souza", jogos: regs, metricas: METRICAS_SCOUT, tendencia: tendenciaScout, leitura: M.leitura, zonasDe: M.zonasDe, detalheDe: (r) => r.scout.detalhe || M.resume(r.scout.pontos).detalhe, cabecalhoHtml: "<div>CABEÇALHO</div>", geradoEm: "19/10/2026" });
["Relatório dos jogos", "Leitura do período", "Evolução jogo a jogo", "Pontos ganhos", "Decisões e estado mental", "Mental antes e depois do jogo", "Comparação de todos os dados", "Acumulado de todos os jogos", "Como os pontos terminaram", "Cada jogo", "J6", "CABEÇALHO", "Salvar como PDF", "Copa &lt;Brasil&gt;", "adversário avançado"].forEach((s) => assert(html.includes(s), "falta: " + s));
assert(!html.includes("<b>Souza") && !html.includes("<b>no lado"), "texto sem escape");
assert(!/undefined|NaN|Infinity/.test(html.replace(/<style>[\s\S]*?<\/style>/, "")), "valor inválido no relatório: " + (html.match(/.{30}(undefined|NaN|Infinity).{30}/) || [])[0]);
assert((html.match(/<svg/g) || []).length >= 14, "poucos gráficos: " + (html.match(/<svg/g) || []).length);
/* um único jogo e jogo sem detalhe não quebram */
const um = R.gerar({ atleta: "Ana", jogos: [regs[0]], metricas: METRICAS_SCOUT, tendencia: tendenciaScout, leitura: M.leitura, zonasDe: M.zonasDe, detalheDe: () => null, cabecalhoHtml: "", geradoEm: "x" });
assert(um.includes("Com um único jogo"), "aviso de jogo único");
fs.writeFileSync(path.join(process.env.TMPDIR || "/tmp", "relatorio-jogos-teste.html"), html);
console.log("check-relatorio-jogos: ok (" + html.length + " bytes)");
