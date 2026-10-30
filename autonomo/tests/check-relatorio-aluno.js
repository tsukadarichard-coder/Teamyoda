/* Relatório do aluno (scout/relatorio-aluno.js): um documento com perfil, planejamento, aulas, scout e biomecânica.
   Confere períodos, seções escolhidas, números, evolução dos jogos, fotos/itens da biomecânica e que nada vaza sem escape.
   Rode: node tests/check-relatorio-aluno.js */
const assert = require("assert"), fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "..");
const M = require(path.join(dir, "player/scout-motor.js")), R = require(path.join(dir, "scout/relatorio-aluno.js"));
const src = fs.readFileSync(path.join(dir, "index.html"), "utf8");
const t = (i, f) => { const a = src.indexOf(i), b = src.indexOf(f, a + i.length); assert(a >= 0 && b > a, "trecho: " + i); return src.slice(a, b); };
const { METRICAS_SCOUT } = new Function("M", "C", "zonasDe", "serieMomento", "const JANELA_MOMENTO = 6; const sequenciasMomento = () => ({ melhor: { tam: 4 }, pior: { tam: 2 } });" +
  [t("function inclinacaoLinear(", "/* Resumo factual"), t("const ROTULO_ZONA_COMP", "function ComparacaoScoutCompleta")].join("\n") + "; return { METRICAS_SCOUT };")(M, { grafite: "#555" }, M.zonasDe, () => []);

/* períodos */
assert.deepStrictEqual(R.periodo("tudo"), { de: "", ate: "", rotulo: "Todo o histórico" });
assert.deepStrictEqual(R.periodo("30d", "2026-10-30"), { de: "2026-09-30", ate: "2026-10-30", rotulo: "Últimos 30 dias" });
assert.strictEqual(R.periodo("ano", "2026-10-30").de, "2026-01-01");
assert.deepStrictEqual(R.periodo("datas", null, "2026-05-01", "2026-03-01"), { de: "2026-03-01", ate: "2026-05-01", rotulo: "De 01/03/2026 até 01/05/2026" }, "datas invertidas");
const p3 = R.periodo("datas", null, "2026-03-01", "2026-05-31");
assert(R.noPeriodo("2026-03-01T10:00", p3) && R.noPeriodo("2026-05-31", p3) && !R.noPeriodo("2026-06-01", p3) && !R.noPeriodo("", p3) && R.noPeriodo("", R.periodo("tudo")), "dentro/fora do período");

/* jogos simulados pelo motor do scout */
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const jogos = [0, 1, 2, 3].map((j) => {
  let e = M.placarInicial("3sets", "nos", false, false); const pontos = [];
  for (let i = 0; i < 60 && !e.fim; i++) {
    const ganha = rnd() < 0.4 + j * 0.08, fim = ganha ? (rnd() > 0.5 ? "winner_nos" : "erro_dele") : (rnd() > 0.5 ? "erro_nos" : "winner_dele");
    pontos.push({ fim, nos: ganha, saque: ["1", "2", "df"][Math.floor(rnd() * 3)], bola: ["1-4", "5-9", "10+"][Math.floor(rnd() * 3)], causa: fim === "erro_nos" ? "decisao" : null, jogo: M.numeroDoGame(e), adverso: M.ehAdverso(e), sacador: M.quemSaca(e), lado: M.ladoDoSaque(e) });
    e = M.aplicaPonto(e, ganha);
  }
  return { id: "j" + j, tipo: "jogo", data: "2026-0" + (j + 3) + "-15", torneio: j ? "Copa <X>" : "jogo-treino", adversario: "Rival " + j, resultado: j % 2 ? "6-3 6-4" : "3-6 4-6", observacaoFinal: j === 3 ? "Boa <i>leitura</i>" : "", scout: { ...M.resume(pontos), pontos } };
});
const vencedor = (r) => (r.resultado === "6-3 6-4" ? "vitoria" : "derrota");
const base = {
  atleta: "Nicolas <b>Prado", periodo: R.periodo("tudo"), geradoEm: "30/10/2026", cabecalhoHtml: "<img alt=QuadraLab>",
  perfil: [["Idade", "12 anos"], ["Estágio · nível", "C · Y5"], ["Backhand", ""], ["Objetivo", "Jogar <torneios>"]],
  plano: { nome: "", geradoEm: "2026-03-01", prioridade: "Saque", observacao: "", feitas: 5, total: 12, blocos: [
    { titulo: "Base", semanas: 4, foco: ["Consistência"], saida: "8 de 10 bolas <no fundo>", feitas: 5, total: 6, liberado: true, atual: false },
    { titulo: "Ataque", semanas: 4, foco: [], saida: "", feitas: 0, total: 6, liberado: false, atual: true }] },
  aulas: { feitas: 5, faltas: 1, canceladas: 2, sessoes: [{ data: "2026-04-02", titulo: "Ciclo 1", exercicios: ["Cruzadas <4>", "Saque"], obs: "Ajustei a base" }] },
  jogos, metricas: METRICAS_SCOUT, leitura: M.leitura, vencedor,
  movimentos: [{ data: "2026-04-10T10:00:00Z", golpe: "Saque", ok: 6, atencao: 2, nao: 1, fotos: [{ src: "data:image/jpeg;base64,AAA", nome: "Troféu" }],
    itens: [{ nome: "Joelho <flexão>", valor: 152.44, unidade: "°", ref: "130–150°", status: "atencao" }, { nome: "Ombro", valor: 90, unidade: "°", ref: "", status: "ok" }], texto: "Lançamento alto", prio: ["Flexão de joelho"] }],
  observacao: "Evoluiu muito <no saque>.\nSegue firme.",
};
const h = R.html(base);
["Relatório do aluno · Tecnologia QuadraLab", "Todo o histórico", "gerado em 30/10/2026", "Perfil", "Planejamento", "Aulas no período", "Scout dos jogos", "Análise biomecânica", "Observação do treinador", "Salvar como PDF"]
  .forEach((x) => assert(h.includes(x), "tem: " + x));
assert(h.includes("5 de 12") && h.includes("42% do planejamento") && h.includes("critério confirmado") && h.includes("bloco atual"), "planejamento: andamento e blocos");
assert(h.includes("8 de 10 bolas &lt;no fundo&gt;") && !h.includes("<no fundo>"), "critério escapado");
assert(/<b>1<\/b><span>falta<\/span>/.test(h) && h.includes("aulas canceladas") && h.includes("Cruzadas &lt;4&gt;"), "aulas");
assert(h.includes("<b>4</b><span>jogos com scout") && h.includes("<b>2 × 2</b>") && h.includes("vitórias × derrotas"), "scout: jogos e vitórias");
assert(h.includes("Evolução no período") && /class="(bom|ruim)"/.test(h), "scout: evolução com sinal");
assert((h.match(/<tr><td>\d\d\/\d\d\/2026<\/td><td class="tx">/g) || []).length === 4, "scout: uma linha por jogo");
assert(h.includes("Boa &lt;i&gt;leitura&lt;/i&gt;"), "observação do jogo escapada");
assert(h.includes('src="data:image/jpeg;base64,AAA"') && h.includes("1. Troféu") && h.includes("Joelho &lt;flexão&gt;") && h.includes("152.4°") && h.includes("Lançamento alto") && h.includes("Flexão de joelho"), "biomecânica: foto, item, conclusão e prioridades");
assert(!/<td class="tx">Ombro/.test(h), "biomecânica: só os itens que pedem atenção na tabela");
assert(h.includes("Evoluiu muito &lt;no saque&gt;.<br>Segue firme."), "observação do treinador escapada com quebra de linha");
assert(!h.includes("<b>Prado") && !h.includes("Copa <X>") && !h.includes("<torneios>"), "nada sem escape");
assert(!/undefined|NaN|Infinity/.test(h.replace(/<style>[\s\S]*?<\/style>/, "")), "sem valor inválido");
assert(!h.includes("Backhand</dt>"), "campo vazio do perfil fica de fora");

/* seções escolhidas */
const so = R.html({ ...base, secoes: { scout: true }, observacao: "" });
assert(so.includes("Scout dos jogos") && !so.includes("<h2>Planejamento") && !so.includes("<h2>Análise biomecânica") && !so.includes("<h2>Perfil"), "só a seção escolhida");
/* aluno sem nada registrado: o documento sai, com avisos */
const vz = R.html({ atleta: "Novo", periodo: R.periodo("30d", "2026-10-30"), plano: null, aulas: { feitas: 0, faltas: 0, canceladas: 0, sessoes: [] }, jogos: [], movimentos: [], metricas: METRICAS_SCOUT });
assert(vz.includes("Ainda não há planejamento") && vz.includes("Nenhum jogo com scout no período") && vz.includes("Nenhuma análise de movimento no período") && vz.includes("Nenhuma aula marcada"), "avisos sem dados");
console.log("check-relatorio-aluno: ok (" + h.length + " bytes)");
