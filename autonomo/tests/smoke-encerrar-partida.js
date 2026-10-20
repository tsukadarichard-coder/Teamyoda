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
    await p.getByRole("button", { name: "Relatório da partida (PDF)" }).click(); await p.waitForTimeout(500);
    let docs = await p.evaluate(() => window.__docs);
    assert.strictEqual(docs.length, 1, app + ": abriu o documento"); assert(/Salvar como PDF/.test(docs[0]) && /Relatório da partida/.test(docs[0]) && !/Em relação aos jogos anteriores/.test(docs[0]), app + ": relatório da partida sem comparação, pronto para salvar como PDF");
    assert(/logo-quadralab-relatorio\.png/.test(docs[0]) && !/Team Yoda|Metodologia MTY/.test(docs[0]), app + ": logo do QuadraLab (não da academia)");
    await p.getByRole("button", { name: "Com comparação aos jogos anteriores" }).click(); await p.waitForTimeout(500);
    docs = await p.evaluate(() => window.__docs); assert(/Em relação aos jogos anteriores/.test(docs[1]) && /Média dos 1 jogo anterior/.test(docs[1]), app + ": com comparação inclui o jogo anterior");
    // salvar no caderno e gerar de novo não duplica o jogo
    await p.getByRole("button", { name: "Salvar no caderno" }).click(); await p.waitForTimeout(400);
    await p.getByRole("button", { name: "Com comparação aos jogos anteriores" }).click(); await p.waitForTimeout(500);
    docs = await p.evaluate(() => window.__docs); assert(/Média dos 1 jogo anterior/.test(docs[2]) && !/Média dos 2 jogos anteriores/.test(docs[2]), app + ": depois de salvar não conta o jogo duas vezes");
    // jogos já coletados: relatório direto da lista, sem alterar nenhum registro
    await p.reload(); await p.waitForFunction(() => document.body.innerText.includes("Análise de partida"), null, { timeout: 120000 });
    const antes = await p.evaluate(() => JSON.stringify(window.__alunos[0].registros));
    await p.getByRole("button", { name: "Relatório da partida (PDF)" }).first().click(); await p.waitForTimeout(400);
    let d2 = await p.evaluate(() => window.__docs); assert(d2.length === 1 && /Relatório da partida/.test(d2[0]) && /Ana/.test(d2[0]), app + ": relatório de jogo já salvo");
    await p.getByRole("button", { name: "Com comparação" }).first().click(); await p.waitForTimeout(400);
    assert.strictEqual(await p.evaluate(() => JSON.stringify(window.__alunos[0].registros)), antes, app + ": gerar o relatório não altera nenhum registro");
    assert.deepStrictEqual(erros, [], app + ": erros de JS " + erros.join(" | "));
    console.log("smoke-encerrar-partida " + app + ": ok"); await b.close(); srv.close();
  }
})().catch((e) => { console.error(e.message || e); process.exit(1); });
