/* Retomar partida: encerrou sem querer, voltou do relatório, retomou depois de sair (aparelho e nuvem), retomou uma partida salva como interrompida.
   Roda a TelaScout real. Rode: node tests/smoke-retomar-partida.js [autonomo|mty] */
const assert = require("assert");
const { abrir, chromium, existe } = require("./_harness-scout.js");
if (!existe()) { console.log("smoke-retomar-partida: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const MIN = 180000;
async function nova(b, porta, alunosIniciais) {
  const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  p.setDefaultTimeout(30000); p.erros = []; p.aceitar = true; p.dialogos = [];
  p.on("pageerror", (e) => p.erros.push(e.message));
  p.on("dialog", async (d) => { p.dialogos.push(d.message()); if (p.aceitar) await d.accept(); else await d.dismiss(); });
  if (alunosIniciais) await p.addInitScript((a) => { window.__alunosIniciais = a; }, alunosIniciais);
  await p.goto("http://localhost:" + porta + "/");
  await p.waitForFunction(() => document.body.innerText.includes("Análise de partida"), null, { timeout: 120000 });
  return p;
}
const marca = async (p, n) => { for (let i = 0; i < n; i++) { await p.getByRole("button", { name: "Winner meu" }).click(); await p.getByRole("button", { name: "1-2", exact: true }).click(); await p.waitForTimeout(450); } };
const texto = (p) => p.evaluate(() => document.body.innerText);
const aluno = (p) => p.evaluate(() => JSON.parse(JSON.stringify(window.__alunos[0])));
(async () => {
  const apps = process.argv[2] ? [process.argv[2]] : ["autonomo", "mty"];
  for (const app of apps) {
    const { srv } = abrir(app), porta = srv.address().port;
    const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
    /* A) encerrou sem querer: volta do relatório, salva, volta de novo e o registro é substituído */
    let p = await nova(b, porta);
    await p.getByText("Iniciar acompanhamento").click(); await p.waitForTimeout(300);
    await marca(p, 3);
    assert((await texto(p)).includes("3 pontos"), app + ": 3 pontos marcados");
    await p.getByRole("button", { name: "Encerrar e ver relatório" }).click(); await p.waitForTimeout(500);
    assert(p.dialogos.some((d) => d.includes("Você poderá voltar")), app + ": pede confirmação ao encerrar");
    let t = await texto(p);
    assert(t.includes("Encerrou sem querer?") && t.includes("Voltar à partida e continuar"), app + ": relatório oferece voltar. " + t.slice(0, 300));
    await p.getByRole("button", { name: /Voltar à partida e continuar/ }).click(); await p.waitForTimeout(500);
    t = await texto(p); assert(t.includes("3 pontos") && t.includes("Encerrar e ver relatório"), app + ": voltou para a marcação com os 3 pontos");
    await marca(p, 1); assert((await texto(p)).includes("4 pontos"), app + ": continua marcando (4 pontos)");
    await p.getByRole("button", { name: "Encerrar e ver relatório" }).click(); await p.waitForTimeout(500);
    p.aceitar = false; p.dialogos = [];
    await p.getByRole("button", { name: "Novo jogo" }).click(); await p.waitForTimeout(300);
    assert(p.dialogos.some((d) => d.includes("ainda não foi salva")), app + ": Novo jogo pede confirmação antes de apagar");
    assert((await texto(p)).includes("Voltar à partida e continuar"), app + ": cancelou, a partida continua no relatório");
    p.aceitar = true;
    await p.getByRole("button", { name: "Salvar no caderno" }).click(); await p.waitForTimeout(400);
    assert.strictEqual((await aluno(p)).registros.length, 1, app + ": partida salva no caderno");
    assert.strictEqual((await aluno(p)).registros[0].scout.pontos.length, 4);
    assert(!(await aluno(p)).scoutRascunho, app + ": ao salvar, o rascunho some");
    await p.getByRole("button", { name: /Voltar à partida e continuar/ }).click(); await p.waitForTimeout(500);
    assert((await texto(p)).includes("4 pontos"), app + ": retomou a partida já salva");
    await marca(p, 1);
    await p.getByRole("button", { name: "Encerrar e ver relatório" }).click(); await p.waitForTimeout(400);
    await p.getByRole("button", { name: "Salvar no caderno" }).click(); await p.waitForTimeout(400);
    const a2 = await aluno(p); assert.strictEqual(a2.registros.length, 1, app + ": o registro antigo foi substituído, não duplicado"); assert.strictEqual(a2.registros[0].scout.pontos.length, 5);
    assert.deepStrictEqual(p.erros, [], app + ": erros de JS " + p.erros.join(" | "));
    await p.close();

    /* B) saiu da tela no meio: a partida volta (aparelho e nuvem) */
    p = await nova(b, porta);
    await p.getByText("Iniciar acompanhamento").click(); await p.waitForTimeout(300);
    await marca(p, 3);
    await p.evaluate(() => window.__desmontar()); await p.waitForTimeout(400);
    let al = await aluno(p); assert(al.scoutRascunho && al.scoutRascunho.pontos.length === 3, app + ": ao sair, a nuvem guarda os 3 pontos");
    assert(!al.scoutRascunho.pilha, app + ": o rascunho não guarda a pilha de desfazer");
    t = await texto(p); assert(t.includes("Partida em andamento") && t.includes("Ana Souza") && t.includes("3 pontos"), app + ": o Início lista a partida em andamento. " + t.slice(0, 200));
    await p.getByRole("button", { name: /Ana Souza/ }).click(); assert.strictEqual(await p.evaluate(() => window.__abriu), "a1", app + ": tocar no cartão abre o jogador");
    await p.evaluate(() => window.__montar()); await p.waitForTimeout(500);
    t = await texto(p); assert(t.includes("Partida em andamento encontrada") && t.includes("3 pontos coletados"), app + ": banner de partida em andamento. " + t.slice(0, 250));
    await p.getByRole("button", { name: "Continuar partida em andamento" }).click(); await p.waitForTimeout(500);
    assert((await texto(p)).includes("3 pontos"), app + ": continuou com os 3 pontos");
    await marca(p, 1); assert((await texto(p)).includes("4 pontos"), app + ": desfazer/marcação funcionam após retomar");
    await p.getByRole("button", { name: "Desfazer" }).click(); await p.waitForTimeout(300);
    assert((await texto(p)).includes("3 pontos"), app + ": desfazer volta um ponto depois de retomar (pilha refeita)");
    // só na nuvem (outro aparelho): apaga o armazenamento local e remonta
    await p.evaluate(() => window.__desmontar()); await p.waitForTimeout(300);
    await p.evaluate(() => localStorage.clear()); await p.evaluate(() => window.__montar()); await p.waitForTimeout(500);
    assert((await texto(p)).includes("Partida em andamento encontrada"), app + ": a partida volta só pela nuvem");
    // começar outra com uma em andamento pede confirmação; descartar apaga
    p.aceitar = false; p.dialogos = [];
    await p.getByText("Iniciar acompanhamento").click(); await p.waitForTimeout(300);
    assert(p.dialogos.some((d) => d.includes("já tem uma partida em andamento")), app + ": começar outra pede confirmação");
    p.aceitar = true;
    await p.getByRole("button", { name: "Descartar" }).click(); await p.waitForTimeout(500);
    assert(!(await texto(p)).includes("Partida em andamento encontrada"), app + ": descartada");
    assert(!(await aluno(p)).scoutRascunho, app + ": a nuvem também foi limpa");
    assert.deepStrictEqual(p.erros, [], app + ": erros de JS (B) " + p.erros.join(" | "));
    await p.close();

    /* C) partida salva como interrompida: reabre e substitui */
    const pontos = Array.from({ length: 6 }, (_, i) => ({ fim: "winner_nos", nos: true, saque: null, bola: "1-2", causa: null, rede: false, situacao: null, adverso: false, sacador: "nos", lado: "D", dirSaque: null, n: i + 1, placarAntes: "0-0", jogo: 1, set: 1 }));
    const reg = { id: "r1", tipo: "jogo", data: "2026-10-18", torneio: "jogo-treino", adversario: "Beto", resultado: "não concluído", concluida: false, scout: { n: 6, pontos, cfg: { formato: "3sets", saca: "nos", semVantagem: false, superTiebreakDecisivo: false } } };
    p = await nova(b, porta, [{ id: "a1", nome: "Ana Souza", registros: [reg] }]);
    t = await texto(p); assert(t.includes("Partidas interrompidas salvas no caderno") && t.includes("contra Beto"), app + ": lista de interrompidas salvas. " + t.slice(0, 300));
    await p.getByRole("button", { name: "Retomar", exact: true }).click(); await p.waitForTimeout(500);
    assert((await texto(p)).includes("6 pontos"), app + ": retomou a partida salva com 6 pontos");
    await marca(p, 1);
    await p.getByRole("button", { name: "Encerrar e ver relatório" }).click(); await p.waitForTimeout(400);
    await p.getByRole("button", { name: "Salvar no caderno" }).click(); await p.waitForTimeout(400);
    const a3 = await aluno(p); assert.strictEqual(a3.registros.length, 1, app + ": substituiu o registro interrompido"); assert.strictEqual(a3.registros[0].scout.pontos.length, 7);
    assert.deepStrictEqual(p.erros, [], app + ": erros de JS (C) " + p.erros.join(" | "));
    await p.close(); await b.close(); srv.close();
    console.log("smoke-retomar-partida " + app + ": ok");
  }
})().catch((e) => { console.error(e); process.exit(1); });
