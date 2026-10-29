/* Retomar partida: encerrou sem querer, voltou do relatório, retomou depois de sair (aparelho e nuvem), retomou uma partida salva como interrompida.
   Roda a TelaScout real. Rode: node tests/smoke-retomar-partida.js [autonomo|mty] */
const assert = require("assert");
const { abrir, chromium, existe } = require("./_harness-scout.js");
if (!existe()) { console.log("smoke-retomar-partida: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const MIN = 180000;
async function nova(b, porta, alunosIniciais, sessao) {
  const p = await b.newPage({ viewport: { width: 420, height: 900 } });
  p.setDefaultTimeout(30000); p.erros = []; p.aceitar = true; p.dialogos = [];
  p.on("pageerror", (e) => p.erros.push(e.message));
  p.on("dialog", async (d) => { p.dialogos.push(d.message()); if (p.aceitar) await d.accept(); else await d.dismiss(); });
  if (alunosIniciais) await p.addInitScript((a) => { window.__alunosIniciais = a; }, alunosIniciais);
  if (sessao) await p.addInitScript((kv) => { Object.keys(kv).forEach((k) => sessionStorage.setItem(k, kv[k])); }, sessao);
  await p.goto("http://localhost:" + porta + "/");
  /* pedido do Caderno abre direto na marcação; senão a tela inicial do scout */
  await p.waitForFunction((direto) => document.body.innerText.includes(direto ? "Encerrar e ver relatório" : "Análise de partida"), !!sessao, { timeout: 120000 });
  return p;
}
const marca = async (p, n) => { for (let i = 0; i < n; i++) { await p.getByRole("button", { name: "Winner meu" }).click(); await p.getByRole("button", { name: "1-2", exact: true }).click(); await p.waitForTimeout(450); } };
const texto = (p) => p.evaluate(() => document.body.innerText);
const aluno = (p) => p.evaluate(() => JSON.parse(JSON.stringify(window.__alunos[0])));
async function salvar(p) { const b = p.getByRole("button", { name: "Salvar no caderno" }); if (await b.count()) await b.click(); else { const c = p.getByRole("button", { name: "Salvar alterações" }); if (await c.count()) await c.click(); } await p.waitForTimeout(400); }
async function encerrar(p) { await p.getByRole("button", { name: "Encerrar e ver relatório" }).click(); await p.waitForTimeout(200); const d = p.getByRole("button", { name: "Encerrar de vez" }); if (await d.count()) { await d.click(); await p.getByRole("button", { name: "Prefiro não informar" }).click(); await p.getByRole("button", { name: "Salvar e ver o relatório" }).click(); } await p.waitForTimeout(500); }
(async () => {
  const apps = process.argv[2] ? [process.argv[2]] : ["autonomo", "mty"];
  for (const app of apps) {
    const { srv } = abrir(app), porta = srv.address().port;
    const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
    /* A) encerrar: voltar à partida pelo diálogo; encerrar de vez não oferece mais retomar; salvar no caderno */
    let p = await nova(b, porta);
    await p.getByText("Iniciar acompanhamento").click(); await p.waitForTimeout(300);
    await marca(p, 3);
    assert((await texto(p)).includes("3 pontos"), app + ": 3 pontos marcados");
    await p.getByRole("button", { name: "Encerrar e ver relatório" }).click(); await p.waitForSelector("[data-encerrar]");
    assert(await p.getByRole("button", { name: "Voltar à partida" }).count() === 1, app + ": pergunta ao encerrar (encerrar de vez ou voltar)");
    await p.getByRole("button", { name: "Voltar à partida" }).click(); await p.waitForTimeout(400);
    let t = await texto(p); assert(t.includes("3 pontos") && t.includes("Encerrar e ver relatório"), app + ": voltou para a marcação com os 3 pontos");
    await marca(p, 1); assert((await texto(p)).includes("4 pontos"), app + ": continua marcando (4 pontos)");
    await encerrar(p);
    t = await texto(p);
    assert(!t.includes("Encerrou sem querer?") && !t.includes("Voltar à partida e continuar"), app + ": depois de encerrar de vez o relatório não oferece retomar. " + t.slice(0, 200));
    assert.strictEqual((await aluno(p)).registros.length, 1, app + ": encerrar de vez salva o jogo incompleto no caderno");
    assert.strictEqual((await aluno(p)).registros[0].concluida, false); assert.strictEqual((await aluno(p)).registros[0].encerramento.motivo, "nao_informado");
    assert.strictEqual((await aluno(p)).registros[0].scout.pontos.length, 4);
    assert(!(await aluno(p)).scoutRascunho, app + ": o rascunho some ao encerrar de vez");
    assert((await texto(p)).toLowerCase().includes("salvo no caderno"), app + ": relatório mostra que já está salvo");
    assert.deepStrictEqual(p.erros, [], app + ": erros de JS " + p.erros.join(" | "));
    await p.close();

    /* A2) com a cópia automática já criada (passaram >5 s), encerrar de vez não deixa a partida "em andamento" nem ressuscita depois */
    p = await nova(b, porta);
    await p.getByText("Iniciar acompanhamento").click(); await p.waitForTimeout(300);
    await marca(p, 3); await p.waitForTimeout(6500);
    assert((await aluno(p)).scoutRascunho && (await aluno(p)).registros.length === 1, app + ": durante a partida, rascunho e registro automático existem");
    await encerrar(p); await p.waitForTimeout(7000);
    let al2 = await aluno(p);
    assert(!al2.scoutRascunho, app + ": depois de encerrar de vez o rascunho não volta (nem 7 s depois)");
    assert.strictEqual(al2.registros.length, 1, app + ": um único registro (a cópia automática foi substituída, sem duplicar)");
    assert.strictEqual(al2.registros[0].concluida, false); assert(al2.registros[0].encerramento, app + ": com o motivo");
    await p.evaluate(() => window.__desmontar()); await p.waitForTimeout(400); await p.evaluate(() => window.__montar()); await p.waitForTimeout(600);
    t = await texto(p); assert(!t.includes("Partida em andamento encontrada"), app + ": ao voltar à tela não há partida em andamento. " + t.slice(0, 200));
    assert.deepStrictEqual(p.erros, [], app + ": erros de JS (A2) " + p.erros.join(" | "));
    await p.close();

    /* B) saiu da tela no meio: a partida volta (aparelho e nuvem) */
    p = await nova(b, porta);
    await p.getByText("Iniciar acompanhamento").click(); await p.waitForTimeout(300);
    await marca(p, 3);
    await p.evaluate(() => window.__desmontar()); await p.waitForTimeout(400);
    let al = await aluno(p); assert(al.scoutRascunho && al.scoutRascunho.pontos.length === 3, app + ": ao sair, a nuvem guarda os 3 pontos");
    assert(!al.scoutRascunho.pilha, app + ": o rascunho não guarda a pilha de desfazer");
    assert(al.registros.length === 1 && al.registros[0].concluida === false && al.registros[0].scout.pontos.length === 3, app + ": ao sair, o jogo incompleto já está no caderno e pode ser reaberto");
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
    assert((await aluno(p)).registros.some((r) => r.tipo === "jogo" && r.scout.pontos.length === 3), app + ": descartar a partida em andamento não apaga o jogo do caderno");
    assert.deepStrictEqual(p.erros, [], app + ": erros de JS (B) " + p.erros.join(" | "));
    await p.close();

    /* C) partida salva como interrompida: reabre e substitui */
    const pontos = Array.from({ length: 6 }, (_, i) => ({ fim: "winner_nos", nos: true, saque: null, bola: "1-2", causa: null, rede: false, situacao: null, adverso: false, sacador: "nos", lado: "D", dirSaque: null, n: i + 1, placarAntes: "0-0", jogo: 1, set: 1 }));
    const reg = { id: "r1", tipo: "jogo", data: "2026-10-18", torneio: "jogo-treino", adversario: "Beto", resultado: "não concluído", concluida: false, scout: { n: 6, pontos, cfg: { formato: "3sets", saca: "nos", semVantagem: false, superTiebreakDecisivo: false } } };
    p = await nova(b, porta, [{ id: "a1", nome: "Ana Souza", registros: [reg] }]);
    t = await texto(p); assert(t.includes("Voltar a um jogo salvo") && t.includes("contra Beto"), app + ": lista de interrompidas salvas. " + t.slice(0, 300));
    await p.getByRole("button", { name: "Retomar", exact: true }).click(); await p.waitForTimeout(500);
    assert((await texto(p)).includes("6 pontos"), app + ": retomou a partida salva com 6 pontos");
    await marca(p, 1);
    await encerrar(p);
    await salvar(p);
    const a3 = await aluno(p); assert.strictEqual(a3.registros.length, 1, app + ": substituiu o registro interrompido"); assert.strictEqual(a3.registros[0].scout.pontos.length, 7);
    assert.deepStrictEqual(p.erros, [], app + ": erros de JS (C) " + p.erros.join(" | "));
    await p.close();

    /* D) jogo concluído e já compartilhado com a família: reabre (também pelo pedido do Caderno), corrige e salva no mesmo registro */
    const ganho = Array.from({ length: 48 }, (_, i) => ({ fim: "winner_nos", nos: true, saque: null, bola: "1-2", causa: null, rede: false, situacao: null, adverso: false, sacador: "nos", lado: "D", dirSaque: null, n: i + 1, placarAntes: "0-0", jogo: 1, set: 1 }));
    const concl = { id: "rJ", tipo: "jogo", data: "2026-10-10", torneio: "Interclubes", adversario: "Caio", resultado: "6-0 6-0", concluida: true, observacaoFinal: "Jogo sólido.", nivelAdversario: "igual",
      compartilhado: { token: "tokenfamilia123", criadoEm: "2026-10-10T10:00:00Z", ate: "2099-01-01", publico: { n: 48 } },
      scout: { n: 48, pontos: ganho, cfg: { formato: "3sets", saca: "nos", semVantagem: false, superTiebreakDecisivo: false } } };
    p = await nova(b, porta, [{ id: "a1", nome: "Ana Souza", registros: [concl] }], { "ql-reabrir:a1": "rJ" });
    t = await texto(p); assert(t.includes("48 pontos") && t.includes("Encerrar e ver relatório"), app + ": o pedido do Caderno abre o jogo concluído na marcação. " + t.slice(0, 200));
    assert(t.includes("Partida encerrada"), app + ": mostra que a partida estava encerrada");
    await p.getByRole("button", { name: "Desfazer" }).click(); await p.waitForTimeout(300);
    assert((await texto(p)).includes("47 pontos"), app + ": desfaz o último ponto de um jogo concluído");
    await encerrar(p);
    await salvar(p);
    const a4 = await aluno(p); assert.strictEqual(a4.registros.length, 1, app + ": o jogo reaberto não duplica");
    const r4 = a4.registros[0]; assert.strictEqual(r4.id, "rJ", app + ": mantém o mesmo registro");
    assert.strictEqual(r4.scout.pontos.length, 47); assert.strictEqual(r4.compartilhado.token, "tokenfamilia123", app + ": o link da família continua o mesmo");
    assert(r4.compartilhado.publico && r4.compartilhado.publico.placar && r4.compartilhado.publico.n === 47, app + ": o link da família passa a mostrar o jogo atualizado com o placar");
    assert.strictEqual(r4.observacaoFinal, "Jogo sólido."); assert.strictEqual(r4.nivelAdversario, "igual");
    assert.deepStrictEqual(p.erros, [], app + ": erros de JS (D) " + p.erros.join(" | "));
    await p.close();

    /* E) continuar depois de sair (rascunho de versões antigas, sem o id do registro) não cria outra cópia do mesmo jogo */
    p = await nova(b, porta);
    await p.getByText("Iniciar acompanhamento").click(); await p.waitForTimeout(300);
    await marca(p, 3); await p.waitForTimeout(6500);
    await p.evaluate(() => window.__desmontar()); await p.waitForTimeout(400);
    await p.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.startsWith("scout-rascunho:")); const r = JSON.parse(localStorage.getItem(k)); delete r.idRegistro; r.salvoEm = new Date(Date.now() + 60000).toISOString(); localStorage.setItem(k, JSON.stringify(r)); });
    for (let volta = 0; volta < 2; volta++) {
      await p.evaluate(() => window.__montar()); await p.waitForTimeout(500);
      await p.getByRole("button", { name: "Continuar partida em andamento" }).click(); await p.waitForTimeout(400);
      await marca(p, 1); await p.waitForTimeout(6500);
      await p.evaluate(() => window.__desmontar()); await p.waitForTimeout(400);
    }
    let a5 = await aluno(p);
    assert.strictEqual(a5.registros.length, 1, app + ": continuar duas vezes mantém um só registro (" + a5.registros.map((r) => r.id + ":" + r.scout.pontos.length).join(", ") + ")");
    assert.strictEqual(a5.registros[0].scout.pontos.length, 5);
    /* encerrar de vez pelo cartão, com motivo: some da lista "Voltar a um jogo salvo" e não fica cópia interrompida */
    await p.evaluate(() => window.__montar()); await p.waitForTimeout(500);
    await p.getByRole("button", { name: "Encerrar de vez e salvar como interrompida" }).click(); await p.waitForTimeout(300);
    await p.getByRole("button", { name: "Prefiro não informar" }).click(); await p.getByRole("button", { name: "Salvar e ver o relatório" }).click(); await p.waitForTimeout(7000);
    a5 = await aluno(p);
    assert(a5.registros.length === 1 && a5.registros[0].encerramento && !a5.scoutRascunho, app + ": encerrada com motivo, um registro só");
    await p.evaluate(() => window.__desmontar()); await p.waitForTimeout(300); await p.evaluate(() => window.__montar()); await p.waitForTimeout(600);
    t = await texto(p);
    assert(!t.includes("Voltar a um jogo salvo") && !t.includes("Partida em andamento encontrada"), app + ": a encerrada com motivo não aparece para retomar. " + t.slice(0, 300));
    assert.deepStrictEqual(p.erros, [], app + ": erros de JS (E) " + p.erros.join(" | "));
    await p.close();

    /* G) jogo apagado do caderno vai para a lixeira e volta inteiro com "Recuperar" (o jogo do Nicolas que sumiu não se perde mais) */
    const ptsG = Array.from({ length: 30 }, (_, i) => ({ fim: i % 2 ? "erro_nos" : "winner_nos", nos: !(i % 2), saque: null, bola: "1-2", causa: null, rede: false, situacao: null, adverso: false, sacador: "nos", lado: "D", dirSaque: null, n: i + 1, placarAntes: "0-0", jogo: 1, set: 1 }));
    const regG = { id: "rG", tipo: "jogo", data: "2026-10-20", torneio: "ITF Foz do Iguaçu", adversario: "Simon", resultado: "4-6 7-6", concluida: false, parcialAuto: true, observacaoFinal: "Câimbra no 3º set.", scout: { n: 30, pontos: ptsG, cfg: { formato: "3sets", saca: "nos", semVantagem: false, superTiebreakDecisivo: false } } };
    p = await nova(b, porta, [{ id: "a1", nome: "Ana Souza", registros: [regG, { id: "obs", tipo: "observacao", data: "2026-10-21" }] }]);
    await p.waitForTimeout(400);
    await p.evaluate(() => window.__setAlunos((l) => l.map((a) => ({ ...a, registros: a.registros.filter((r) => r.id !== "rG") }))));
    await p.waitForTimeout(500);
    await p.evaluate(() => window.__desmontar()); await p.waitForTimeout(300); await p.evaluate(() => window.__montar()); await p.waitForTimeout(800);
    t = await texto(p);
    assert(t.includes("Jogos apagados") && t.includes("contra Simon") && t.includes("30 pontos"), app + ": o jogo apagado aparece na lixeira. " + t.slice(0, 400));
    await p.getByRole("button", { name: "Recuperar" }).click(); await p.waitForTimeout(600);
    const a7 = await aluno(p), volta = a7.registros.find((r) => r.id === "rG");
    assert(volta && volta.scout.pontos.length === 30 && volta.observacaoFinal === "Câimbra no 3º set." && volta.parcialAuto === false, app + ": recuperado inteiro, como jogo salvo");
    await p.waitForTimeout(300);
    assert(!(await texto(p)).includes("Jogos apagados"), app + ": recuperado sai da lixeira");
    /* Descartar a partida em andamento não apaga mais o jogo do caderno */
    assert.deepStrictEqual(p.erros, [], app + ": erros de JS (G) " + p.erros.join(" | "));
    await p.close();

    /* H) Team Yoda, dono: procurar um jogo apagado antes da lixeira (link ao vivo da família) e devolver ao caderno */
    if (app === "mty") {
      p = await b.newPage({ viewport: { width: 420, height: 900 } }); p.erros = []; p.on("pageerror", (e) => p.erros.push(e.message)); p.on("dialog", (d) => d.accept());
      await p.addInitScript(() => {
        window.__alunosIniciais = [{ id: "a1", nome: "Nicolas Kanashiro", registros: [] }];
        window.mtyAuth = { usuario: () => ({ email: "tsukada.richard@gmail.com" }), tokenId: async () => "tok" };
        const f0 = window.fetch;
        window.fetch = async (u, o) => {
          if (String(u).includes("recuperar-jogo")) { window.__pedido = JSON.parse(o.body); return new Response(JSON.stringify({ achados: [{ fonte: "ao-vivo", id: "aaaabbbb", atleta: "Nicolas", data: "2026-10-20", torneio: "ITF Foz do Iguaçu", resultado: "4-6 7-6", n: 195, pontos: 195,
            resumo: { atleta: "Nicolas", data: "2026-10-20", torneio: "ITF Foz do Iguaçu", resultado: "4-6 7-6", concluida: false, n: 195, ganhos: 95, pctGanhos: 49, numeros: { errosNos: 73, errosDecisao: 17, errosExec: 55, df: 12, aces: 5, pctPrimeiro: 57 }, observacaoFinal: "Jogador teve câimbra no 1/1 do terceiro set", serie: [] } }] }), { status: 200 }); }
          return f0(u, o);
        };
      });
      await p.goto("http://localhost:" + porta + "/");
      await p.waitForFunction(() => document.body.innerText.includes("Análise de partida"), null, { timeout: 120000 });
      await p.getByText("Procurar um jogo apagado (antes da lixeira)").click();
      await p.getByRole("button", { name: "Procurar", exact: true }).click(); await p.waitForTimeout(400);
      t = await texto(p);
      assert(t.includes("ITF Foz do Iguaçu") && t.includes("link ao vivo da família") && t.includes("195 pontos"), app + ": a busca mostra o jogo achado no link ao vivo. " + t.slice(0, 500));
      assert.strictEqual(await p.evaluate(() => window.__pedido.termo), "Nicolas", app + ": procura pelo primeiro nome do jogador");
      await p.getByRole("button", { name: "Devolver ao caderno" }).click(); await p.waitForTimeout(400);
      const a8 = await aluno(p), j8 = a8.registros.find((r) => r.tipo === "jogo");
      assert(j8 && j8.resultado === "4-6 7-6" && j8.data === "2026-10-20" && j8.torneio === "ITF Foz do Iguaçu" && j8.observacaoFinal.includes("câimbra") && j8.scout.errosDecisao === 17, app + ": o jogo volta ao caderno com o placar e os números " + JSON.stringify(j8 && { r: j8.resultado, d: j8.data }));
      assert.deepStrictEqual(p.erros, [], app + ": erros de JS (H) " + p.erros.join(" | "));
      await p.close();
    }

    /* I) confronto direto: adversário enfrentado mais de uma vez aparece na aba Scout; ao digitar o nome, o app avisa o histórico */
    {
      const sc = (n, pg) => ({ n, pctGanhos: pg, errosNos: 10, pctPrimeiro: 60, adversos: 5, pctAdversos: 40, pontos: [{ n: 1 }] });
      const regsI = [
        { id: "c1", tipo: "jogo", data: "2026-03-02", torneio: "Copa Sul", adversario: "Simon Escudeiro", resultado: "6-3 6-4", concluida: true, scout: sc(80, 58) },
        { id: "c2", tipo: "jogo", data: "2026-10-20", torneio: "ITF Foz do Iguaçu", adversario: "simon escudeiro", resultado: "4-6 7-6", concluida: false, scout: sc(195, 49) },
      ];
      p = await nova(b, porta, [{ id: "a1", nome: "Nicolas Kanashiro", registros: regsI }]);
      t = await texto(p);
      assert(t.includes("Confrontos diretos") && t.includes("Simon Escudeiro · 2 jogos · 1 vitória · 0 derrotas · 1 interrompido"), app + ": cartão de confrontos diretos. " + t.slice(0, 500));
      await p.getByRole("button", { name: /Simon Escudeiro · 2 jogos/ }).click(); await p.waitForTimeout(200);
      t = await texto(p);
      assert(t.includes("Todos os jogos contra Simon Escudeiro") && t.includes("Copa Sul") && t.includes("ITF Foz do Iguaçu") && t.includes("58% → 49%"), app + ": tabela do confronto com a evolução. " + t.slice(0, 900));
      await p.locator("input").first().fill("Simon Escudeiro"); await p.waitForTimeout(200);
      assert((await p.locator("[data-aviso-confronto]").textContent()).includes("Já jogou contra"), app + ": aviso ao digitar o adversário");
      assert.deepStrictEqual(p.erros, [], app + ": erros de JS (I) " + p.erros.join(" | "));
      await p.close();
    }

    /* F) caderno com cópias repetidas (versões antigas): ao abrir fica um registro por partida; o link da família passa para o que fica */
    const pts = (n, bola) => Array.from({ length: n }, (_, i) => ({ fim: "winner_nos", nos: i % 3 !== 2, saque: null, bola, causa: null, rede: false, situacao: null, adverso: false, sacador: "nos", lado: "D", dirSaque: null, n: i + 1, placarAntes: "0-0", jogo: 1, set: 1 }));
    const cfgJ = { formato: "3sets", saca: "nos", semVantagem: false, superTiebreakDecisivo: false };
    const X = pts(9, "1-2"), Y = pts(4, "3-4");
    const regsF = [
      { id: "pA", tipo: "jogo", data: "2026-10-20", adversario: "Simon", resultado: "1-0", concluida: false, parcialAuto: true, compartilhado: { token: "famX", ate: "2099-01-01" }, scout: { n: 9, pontos: X, cfg: cfgJ } },
      { id: "pB", tipo: "jogo", data: "2026-10-20", adversario: "Simon", resultado: "1-0", concluida: false, parcialAuto: true, scout: { n: 6, pontos: X.slice(0, 6), cfg: cfgJ } },
      { id: "rX", tipo: "jogo", data: "2026-10-23", adversario: "Simon", resultado: "1-0", concluida: false, encerramento: { motivo: "chuva" }, scout: { n: 9, pontos: X, cfg: cfgJ } },
      { id: "pY", tipo: "jogo", data: "2026-10-24", adversario: "Rafael", resultado: "0-0", concluida: false, parcialAuto: true, scout: { n: 4, pontos: Y, cfg: cfgJ } },
      { id: "nota", tipo: "observacao", data: "2026-10-24" },
    ];
    p = await nova(b, porta, [{ id: "a1", nome: "Ana Souza", registros: regsF }]);
    await p.waitForTimeout(600);
    const a6 = await aluno(p);
    assert.deepStrictEqual(a6.registros.map((r) => r.id), ["rX", "pY", "nota"], app + ": cópias do mesmo jogo saíram");
    assert.strictEqual(a6.registros[0].compartilhado.token, "famX", app + ": o link da família passou para o registro que ficou");
    t = await texto(p);
    assert(t.includes("contra Rafael") && !t.includes("contra Simon"), app + ": a lista mostra só a interrompida sem motivo. " + t.slice(0, 400));
    assert.deepStrictEqual(p.erros, [], app + ": erros de JS (F) " + p.erros.join(" | "));
    await p.close(); await b.close(); srv.close();
    console.log("smoke-retomar-partida " + app + ": ok");
  }
})().catch((e) => { console.error(e); process.exit(1); });
