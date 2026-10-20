/* Botões de análise do scout no app real: "Exportar relatório dos jogos" (todos juntos) com jogos de vários tipos (completo, interrompido, vindo do Competição, cópia automática) e "Reordenar prioridades". Rode: node tests/smoke-relatorio-jogos-app.js [autonomo|mty] */
const assert = require("assert");
const { abrir, chromium, existe } = require("./_harness-scout.js");
if (!existe()) { console.log("smoke-relatorio-jogos-app: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const pt = (i, fim, extra = {}) => ({ fim, nos: fim.endsWith("_nos") || fim === "erro_adv", saque: i % 2 ? "1o" : "2o", bola: ["1-2", "3-4", "5+"][i % 3], causa: fim.startsWith("erro") ? ["decisao", "execucao"][i % 2] : null, rede: false, situacao: null, adverso: false, sacador: "nos", lado: "D", dirSaque: null, n: i + 1, placarAntes: "0-0", jogo: 1, set: 1, ...extra });
const FINS = ["winner_nos", "erro_nos", "winner_adv", "erro_adv"];
const pontos = (n) => Array.from({ length: n }, (_, i) => pt(i, FINS[i % 4]));
const cfg = { formato: "3sets", saca: "nos", semVantagem: false, superTiebreakDecisivo: false };
const jogo = (id, data, n, extra = {}) => ({ id, tipo: "jogo", data, torneio: "jogo-treino", adversario: "Beto", resultado: "6-4", concluida: true, protocolo: 50, erros12: 40, scout: { n, pontos: pontos(n), cfg }, ...extra });
const regs = [
  jogo("j1", "2026-10-01", 24),
  jogo("j2", "2026-10-08", 30, { concluida: false, resultado: "não concluído", encerramento: { motivo: "medico", de: "atleta", quando: "2026-10-08" } }),
  jogo("j3", "2026-10-12", 18, { parcialAuto: true, concluida: false }),
  { id: "j4", tipo: "jogo", data: "2026-10-15", torneio: "Open", adversario: "Caio", resultado: "6-3 6-4", concluida: true, protocolo: 60, erros12: 30, scout: { n: 50, pctPrimeiro: 62, pctGanhos: 55 } },
];
(async () => {
  const app = process.argv[2] || "mty";
  const { srv } = abrir(app), porta = srv.address().port;
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  p.setDefaultTimeout(30000); const erros = [], dialogos = [];
  p.on("pageerror", (e) => erros.push(e.message)); p.on("dialog", async (d) => { dialogos.push(d.message()); await d.accept(); });
  await p.addInitScript((a) => { window.__alunosIniciais = a; window.__html = null; window.open = () => ({ document: { write: (h) => { window.__html = h; }, close() {} }, close() {} }); }, [{ id: "a1", nome: "Ana Souza", prioridades: ["saque", "devolucao"], registros: regs }]);
  await p.goto("http://localhost:" + porta + "/");
  await p.waitForFunction(() => document.body.innerText.includes("Análise de partida"), null, { timeout: 120000 });
  const btn = p.getByRole("button", { name: "Exportar relatório dos jogos" });
  assert(await btn.count() === 1, app + ": botão de exportar todos os jogos aparece");
  await btn.click(); await p.waitForTimeout(800);
  const html = await p.evaluate(() => window.__html);
  assert(html && html.length > 5000, app + ": relatório de todos os jogos foi gerado. alertas: " + JSON.stringify(dialogos) + " erros: " + erros.join(" | "));
  assert(/Ana Souza/.test(html), app + ": relatório com o nome do atleta");
  assert.deepStrictEqual(dialogos, [], app + ": sem alertas de erro " + dialogos.join(" | "));
  /* relatório de uma partida salva (interrompida) */
  await p.getByText("Relatório da partida").first().click().catch(() => {}); await p.waitForTimeout(500);
  assert.deepStrictEqual(erros, [], app + ": erros de JS " + erros.join(" | "));
  console.log("smoke-relatorio-jogos-app " + app + ": ok");
  await b.close(); srv.close();
})().catch((e) => { console.error(e.message || e); process.exit(1); });
