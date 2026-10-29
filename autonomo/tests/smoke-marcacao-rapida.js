/* Marcação do scout durante o jogo: modo rápido (resultado + bola, sem rolar), faixa do último ponto com Corrigir/Detalhes e modo detalhado.
   Roda a TelaScout real. Rode: node tests/smoke-marcacao-rapida.js [autonomo|mty] */
const assert = require("assert");
const { abrir, chromium, existe } = require("./_harness-scout.js");
if (!existe()) { console.log("smoke-marcacao-rapida: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
(async () => {
  for (const app of process.argv[2] ? [process.argv[2]] : ["autonomo", "mty"]) {
    const { srv } = abrir(app);
    const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
    const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const erros = []; p.on("pageerror", (e) => erros.push(e.message)); p.on("dialog", (d) => d.accept());
    await p.goto("http://localhost:" + srv.address().port + "/");
    await p.waitForFunction(() => document.body.innerText.includes("Análise de partida"), null, { timeout: 120000 });
    await p.getByText("Iniciar acompanhamento").click(); await p.waitForTimeout(400);
    const dentro = async (nome, exato) => { const bx = await p.getByRole("button", { name: nome, exact: !!exato }).first().boundingBox(); return bx && bx.y >= 0 && bx.y + bx.height <= 844; };
    // 1) os 4 botões de resultado cabem na tela e são grandes
    for (const n of ["Winner meu", "Erro dele", "Erro meu", "Winner dele"]) {
      assert(await dentro(n), app + ": " + n + " visível sem rolar");
      assert((await p.getByRole("button", { name: n }).first().boundingBox()).height >= 70, app + ": " + n + " é grande (≥ 70 px)");
    }
    // 2) depois do resultado, as bolas aparecem grandes e visíveis, sem o formulário longo
    await p.getByRole("button", { name: "Winner meu" }).click(); await p.waitForTimeout(300);
    for (const n of ["1-4", "5-9", "10+"]) { assert(await dentro(n, true), app + ": bola " + n + " visível sem rolar"); assert((await p.getByRole("button", { name: n, exact: true }).boundingBox()).height >= 80, app + ": bola " + n + " grande"); }
    assert(!(await p.evaluate(() => document.body.innerText)).toLowerCase().includes("último golpe de"), app + ": detalhes ficam recolhidos no modo rápido");
    // 3) 2 toques registram o ponto e a faixa do último ponto aparece
    await p.getByRole("button", { name: "1-4", exact: true }).click(); await p.waitForTimeout(500);
    let t = await p.evaluate(() => document.body.innerText);
    assert(t.includes("PONTO 1 REGISTRADO") || t.includes("Ponto 1 registrado"), app + ": faixa do último ponto. " + t.slice(0, 200));
    assert(t.includes("Winner meu") && t.includes("bola 1-4"), app + ": faixa mostra o que foi marcado");
    // 4) Corrigir desfaz o ponto
    await p.getByRole("button", { name: "Corrigir" }).click(); await p.waitForTimeout(300);
    assert(!(await p.evaluate(() => document.body.innerText)).match(/PONTO 1 REGISTRADO/i), app + ": Corrigir desfez o ponto");
    // 5) erro meu: causa opcional na etapa rápida; Detalhes reabre o ponto com as escolhas
    await p.getByRole("button", { name: "Erro meu" }).click(); await p.getByRole("button", { name: "Execução" }).click(); await p.getByRole("button", { name: "5-9", exact: true }).click(); await p.waitForTimeout(400);
    await p.getByRole("button", { name: "Detalhes", exact: true }).click(); await p.waitForTimeout(400);
    t = await p.evaluate(() => document.body.innerText);
    assert(t.toLowerCase().includes("último golpe de"), app + ": Detalhes abre o formulário completo do último ponto");
    const fundo = (n) => p.getByRole("button", { name: n }).evaluate((e) => getComputedStyle(e).backgroundColor);
    assert.notStrictEqual(await fundo("Execução"), await fundo("Decisão"), app + ": a causa escolhida volta marcada (Execução destacada de Decisão)");
    await p.getByRole("button", { name: "Forehand" }).click(); await p.getByRole("button", { name: "10+", exact: true }).click(); await p.waitForTimeout(400);
    // 6) modo detalhado: o formulário completo abre direto
    await p.getByRole("button", { name: /Modo rápido/ }).click(); await p.waitForTimeout(200);
    await p.getByRole("button", { name: "Winner dele" }).click(); await p.waitForTimeout(300);
    assert((await p.evaluate(() => document.body.innerText)).toLowerCase().includes("último golpe de"), app + ": modo detalhado mostra todos os grupos");
    assert(await p.getByRole("button", { name: /Modo detalhado/ }).count() === 1, app + ": rótulo do modo");
    assert.deepStrictEqual(erros, [], app + ": erros de JS " + erros.join(" | "));
    await b.close(); srv.close(); console.log("smoke-marcacao-rapida " + app + ": ok");
  }
})().catch((e) => { console.error(e.message || e); process.exit(1); });
