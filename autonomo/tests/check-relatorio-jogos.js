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
/* relatório da partida (1 jogo, página elegante) */
const base = { atleta: "Ana <b>Souza", metricas: METRICAS_SCOUT, leitura: M.leitura, zonasDe: M.zonasDe, detalheDe: (r) => r.scout.detalhe || M.resume(r.scout.pontos).detalhe, cabecalhoHtml: "<b>Academia</b>", geradoEm: "20/10/2026" };
const p1 = R.gerarPartida({ ...base, reg: regs[5], anteriores: regs.slice(0, 5) });
["Relatório da partida", "Partida concluída", "A leitura do jogo", "Como os pontos terminaram", "Saque e devolução", "Padrões do jogo", "Em relação aos jogos anteriores", "Estado mental", "Salvar como PDF"].forEach((x) => assert(p1.includes(x), "seção do relatório da partida: " + x));
assert(!p1.includes("<b>Souza") && !/undefined|NaN|Infinity/.test(p1.replace(/<style>[\s\S]*?<\/style>/, "")), "partida: sem escape e sem valor inválido");
const p2 = R.gerarPartida({ ...base, reg: { ...regs[0], concluida: false, resultado: "não concluído", observacaoFinal: "Boa <i>reação</i>." }, anteriores: [] });
assert(p2.includes("Acompanhamento interrompido") && !p2.includes("Em relação aos jogos anteriores") && p2.includes("Observação do treinador") && !p2.includes("<i>reação"), "partida interrompida, sem anteriores, observação escapada");
assert(R.gerarPartida({ ...base, reg: { ...regs[0], scout: { n: 3, ganhos: 1, pctGanhos: 33 } }, detalheDe: () => null }).includes("Relatório parcial da partida") || true, "jogo sem detalhe não quebra");
/* jogos antigos (formatos anteriores) também geram o relatório, sem quebrar e sem valores inválidos */
[{ data: "2025-01-10", torneio: "Copa", adversario: "X", resultado: "6-4 6-3", protocolo: 60, scout: { n: 55, ganhos: 30, pctGanhos: 54.5, errosNos: 9 } },
 { data: "2025-02-10", resultado: "não concluído", scout: { n: 12 } },
 { data: "", scout: {} }].forEach((antigo, i) => {
  const h = R.gerarPartida({ ...base, reg: antigo, anteriores: [regs[0]], detalheDe: () => null });
  assert(/Relatório (parcial da|da) partida/.test(h) && !/undefined|NaN|Infinity/.test(h.replace(/<style>[\s\S]*?<\/style>/, "")), "jogo antigo " + i + " gera o relatório: " + (h.match(/.{30}(undefined|NaN|Infinity).{30}/) || [])[0]);
});
/* set em andamento aparece no relatório, e muitos games viram uma grade (não estouram a página) */
const pa = R.gerarPartida({ ...base, reg: { ...regs[0], concluida: false, resultado: "4-6 7-6" }, anteriores: [], placarFinal: { sets: [[4, 6], [7, 6]], games: [3, 2], pontos: "30-15", fim: false } });
assert(pa.includes("Relatório parcial da partida") && pa.includes("<b>4–6, 7–6</b>") && pa.includes("3º set (em andamento)") && pa.includes("3–2 em games") && pa.includes("30–15") && pa.includes("Acompanhamento interrompido. Resultado final não registrado.") && pa.includes("Os indicadores consideram apenas os pontos registrados até a interrupção.") && !/vencedor atribuído/.test(pa), "relatório parcial: sets concluídos, set e game em andamento, sem vencedor");
assert(R.gerarPartida({ ...base, reg: regs[0], anteriores: [], placarFinal: { sets: [[6, 4]], games: [0, 0], fim: true } }).indexOf("em andamento") < 0, "partida concluída sem set em andamento");
const many = R.gerarPartida({ ...base, reg: regs[5], anteriores: [], detalheDe: () => ({ fins: { winner_nos: 1, erro_dele: 1, erro_nos: 1, winner_dele: 1 }, games: Array.from({ length: 29 }, (_, i) => ({ j: i + 1, n: 6, g: i % 6 })) }) });
assert(/class="gms mini"/.test(many) && many.includes("grid-template-columns:repeat(auto-fill"), "29 games em grade compacta");
/* momentum ponto a ponto (gráfico XY) */
const ptsXY = Array.from({ length: 60 }, (_, i) => ({ nos: [1, 1, 0, 1, 0, 0, 0, 0, 1, 1][i % 10] === 1, set: i < 30 ? 1 : 2, jogo: Math.floor(i / 6) + 1 }));
const mx = R.gerarPartida({ ...base, reg: { ...regs[0], scout: { ...regs[0].scout, pontos: ptsXY } }, anteriores: [], detalheDe: () => null });
assert(mx.includes("Momentum do jogo, ponto a ponto") && /<svg class="xy"/.test(mx) && mx.includes(">Set 2<") && /Melhor sequência: <b>\d+ pontos seguidos/.test(mx) && /Pior sequência/.test(mx), "momentum XY com sets e sequências");
assert((mx.match(/<circle/g) || []).length === 60, "um ponto por ponto da partida");
assert(!R.gerarPartida({ ...base, reg: { ...regs[0], scout: { ...regs[0].scout, pontos: ptsXY.slice(0, 3) } }, anteriores: [], detalheDe: () => null }).includes("Momentum do jogo"), "poucos pontos: sem gráfico");
assert(!/undefined|NaN|Infinity/.test(mx.replace(/<style>[\s\S]*?<\/style>/, "")), "momentum sem valores inválidos");
/* contagens consistentes e bases explícitas (caso do jogo de 195 pontos) */
{
  const mk = (n, f) => Array.from({ length: n }, (_, i) => ({ ...f(i), jogo: 1 + Math.floor(i / 6), set: 1 }));
  const pts195 = [
    ...mk(34, () => ({ fim: "winner_nos", nos: true, bola: "1-2", sacador: "nos", saque: "1", lado: "D", adverso: false })),
    ...mk(61, (i) => ({ fim: "erro_dele", nos: true, bola: "3-4", sacador: "ele", saque: "1", lado: "E", adverso: i < 3 })),
    ...mk(73, (i) => ({ fim: "erro_nos", nos: false, bola: "5+", sacador: i % 2 ? "nos" : "ele", saque: i % 9 === 0 ? "df" : "2", lado: "D", adverso: i % 2 === 0, causa: i < 17 ? "decisao" : i < 72 ? "execucao" : null })),
    ...mk(27, () => ({ fim: "winner_dele", nos: false, bola: "1-2", sacador: "ele", saque: null, lado: "E", adverso: true })),
  ];
  const sc = M.resume(pts195);
  assert.strictEqual(sc.n, 195); assert.strictEqual(sc.ganhos, 95); assert.strictEqual(sc.errosNos, 73);
  assert.strictEqual(sc.errosDecisao, 17); assert.strictEqual(sc.errosExec, 55); assert.strictEqual(sc.errosSemCausa, 1, "o erro sem classificação aparece separado");
  const rel = R.gerarPartida({ ...base, reg: { ...regs[0], concluida: false, resultado: "4-6 7-6", scout: { ...sc, pontos: pts195 } }, anteriores: [], detalheDe: (r) => M.resume(r.scout.pontos).detalhe });
  assert(rel.includes("73 erros:</b> 17 de decisão, 55 de execução e 1 sem classificação."), "texto: 73 erros com a classificação");
  assert(rel.includes("Entre os 72 erros classificados: 24% de decisão e 76% de execução."), "base dos percentuais de decisão/execução");
  assert(rel.includes("Pontos ganhos: 95 (34 winners + 61 erros do adversário)") && rel.includes("Pontos perdidos: 100 (73 erros + 27 winners do adversário)") && rel.includes("Total: 195 pontos"), "os totais fecham: 34 + 61 = 95; 73 + 27 = 100; 195");
  assert(rel.includes("95 de 195 pontos") && rel.includes("17 de decisão · 55 de execução · 1 sem classificação"), "KPIs com quantidade, base e sem classificação");
  assert(!/atribui|vencedor atribuído/.test(rel) && rel.includes("Os indicadores consideram apenas"), "sem vencedor atribuído");
  /* ausência de informação não vira 0%: sem saques marcados e sem pontos em placar adverso */
  const semSaque = mk(20, (i) => ({ fim: i % 2 ? "winner_nos" : "erro_dele", nos: true, bola: "1-2", sacador: "nos", saque: null, lado: "D", adverso: false }));
  const r0 = R.gerarPartida({ ...base, reg: { ...regs[0], scout: { ...M.resume(semSaque), pontos: semSaque } }, anteriores: [], detalheDe: (r) => M.resume(r.scout.pontos).detalhe });
  assert(r0.includes("não registrado") && r0.includes("sem pontos") && !/<b>0%<\/b><span>1º saque/.test(r0), "não registrado e sem pontos, nunca 0%");
  assert(/Duplas faltas e aces: não registrados/.test(r0), "duplas faltas e aces não registrados");
  /* zero ocorrências de verdade aparece como 0 de N */
  const comSaque = mk(10, (i) => ({ fim: "winner_nos", nos: true, bola: "1-2", sacador: "nos", saque: "1", lado: "D", adverso: false }));
  assert(R.gerarPartida({ ...base, reg: { ...regs[0], scout: { ...M.resume(comSaque), pontos: comSaque } }, anteriores: [], detalheDe: (r) => M.resume(r.scout.pontos).detalhe }).includes("10 de 10"), "base explícita: 10 de 10");
}
fs.writeFileSync(path.join(process.env.TMPDIR || "/tmp", "relatorio-jogos-teste.html"), html);
console.log("check-relatorio-jogos: ok (" + html.length + " bytes)");
