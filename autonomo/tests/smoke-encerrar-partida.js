/* Encerrar a partida: escolha explícita (encerrar de vez ou voltar) e relatório em PDF direto da tela do relatório. Roda a TelaScout real. Rode: node tests/smoke-encerrar-partida.js [autonomo|mty] */
const assert = require("assert");
const { abrir, chromium, existe } = require("./_harness-scout.js");
if (!existe()) { console.log("smoke-encerrar-partida: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
(async () => {
  for (const app of process.argv[2] ? [process.argv[2]] : ["autonomo", "mty"]) {
    const { srv } = abrir(app);
    const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
    const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const erros = []; p.on("pageerror", (e) => erros.push(e.message));
    await p.addInitScript(() => {
      window.__alunosIniciais = [{ id: "a1", nome: "Ana Souza", registros: [{ id: "r0", tipo: "jogo", data: "2026-09-01", torneio: "jogo-treino", adversario: "X", resultado: "6-4", scout: { n: 10, ganhos: 5, pctGanhos: 50 } }] }];
      window.__docs = []; window.open = () => ({ document: { write: (h) => window.__docs.push(h), close() {} }, close() {} });
    });
    await p.goto("http://localhost:" + srv.address().port + "/");
    await p.waitForFunction(() => document.body.innerText.includes("Análise de partida"), null, { timeout: 120000 });
    await p.getByText("Iniciar acompanhamento").click(); await p.waitForTimeout(400);
    for (const [r, bola] of [["Winner meu", "1-2"], ["Erro dele", "3-4"], ["Winner meu", "5+"]]) { await p.getByRole("button", { name: r }).first().click(); await p.waitForTimeout(300); await p.getByRole("button", { name: bola, exact: true }).click(); await p.waitForTimeout(350); }
    // 1) encerrar com a partida em andamento: escolha explícita
    await p.getByRole("button", { name: "Encerrar e ver relatório" }).click(); await p.waitForSelector("[data-encerrar]");
    let t = await p.evaluate(() => document.body.innerText);
    assert(/Encerrar a partida\?/.test(t) && /3 pontos/.test(t), app + ": diálogo com os pontos");
    assert(await p.getByRole("button", { name: "Voltar à partida" }).count() === 1 && await p.getByRole("button", { name: "Encerrar de vez e ver o relatório" }).count() === 1, app + ": as duas opções");
    // 2) voltar mantém a partida
    await p.getByRole("button", { name: "Voltar à partida" }).click(); await p.waitForTimeout(300);
    assert.strictEqual(await p.locator("[data-encerrar]").count(), 0, app + ": diálogo fechou");
    assert(await p.getByRole("button", { name: "Winner meu" }).first().isVisible(), app + ": segue na marcação");
    // 3) encerrar de vez abre o relatório com o PDF
    await p.getByRole("button", { name: "Encerrar e ver relatório" }).click(); await p.getByRole("button", { name: "Encerrar de vez e ver o relatório" }).click();
    await p.waitForSelector("[data-pdf-partida]");
    await p.getByRole("button", { name: "Relatório desta partida (PDF)" }).click(); await p.waitForTimeout(500);
    let docs = await p.evaluate(() => window.__docs);
    assert.strictEqual(docs.length, 1, app + ": abriu o documento"); assert(/Salvar como PDF|print/i.test(docs[0]) && /1 jogo analisado|jogo analisado/.test(docs[0]), app + ": relatório de 1 jogo, pronto para salvar como PDF");
    await p.getByRole("button", { name: "Com a evolução dos jogos anteriores" }).click(); await p.waitForTimeout(500);
    docs = await p.evaluate(() => window.__docs); assert(/<b>2<\/b><span>jogos analisados/.test(docs[1]), app + ": com a evolução inclui o jogo anterior");
    // salvar no caderno e gerar de novo não duplica o jogo
    await p.getByRole("button", { name: "Salvar no caderno" }).click(); await p.waitForTimeout(400);
    await p.getByRole("button", { name: "Com a evolução dos jogos anteriores" }).click(); await p.waitForTimeout(500);
    docs = await p.evaluate(() => window.__docs); assert(/<b>2<\/b><span>jogos analisados/.test(docs[2]), app + ": depois de salvar não conta o jogo duas vezes");
    assert.deepStrictEqual(erros, [], app + ": erros de JS " + erros.join(" | "));
    console.log("smoke-encerrar-partida " + app + ": ok"); await b.close(); srv.close();
  }
})().catch((e) => { console.error(e.message || e); process.exit(1); });
