/* Teste e capturas do protótipo QuadraLab Tática (trilha do jogador). Rode da raiz do repositório:
   python3 -m http.server 8787 --bind 127.0.0.1 &   e   node autonomo/tests/smoke-tatica-prototipo.js <pasta-das-capturas> */
const { chromium } = require("playwright");
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const OUT = process.argv[2] || "";
const BASE = process.env.TATICA_URL || "http://127.0.0.1:8787/autonomo/tatica-app/index.html";
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const erros = [];
  p.on("pageerror", (e) => erros.push(String(e)));
  p.on("console", (m) => { if (m.type() === "error" && !/fonts\.g|youtube|ERR_/.test(m.text())) erros.push(m.text()); });
  if (OUT) fs.mkdirSync(OUT, { recursive: true });
  const foto = async (nome, inteira) => { if (OUT) await p.screenshot({ path: path.join(OUT, nome + ".png"), fullPage: !!inteira }); };
  const semRolagem = async (nome) => { const w = await p.evaluate(() => document.documentElement.scrollWidth); assert.ok(w <= 390, nome + ": rolagem lateral " + w); };
  const texto = () => p.evaluate(() => document.querySelector("main").innerText);
  const clicarTexto = async (sel, t) => { const ok = await p.evaluate(([s, tt]) => { const el = [...document.querySelectorAll(s)].find((x) => x.textContent.trim() === tt); if (el) el.click(); return !!el; }, [sel, t]); assert.ok(ok, "opção não encontrada: " + t.slice(0, 60)); };
  const certas = (cod) => p.evaluate((c) => { const f = window.MTYSituacoes.FICHAS.find((x) => x[0] === c); return [f[4], f[5].split(/(?<=[.!?])\s+/)[0]]; }, cod);
  const responderQuiz = async (cod) => {
    const [ler, dec] = await certas(cod);
    await clicarTexto(".opcao", ler); await p.waitForSelector("[data-retorno]"); await p.click("#btSeguir");
    await clicarTexto(".opcao", dec); await p.waitForSelector("[data-retorno]"); await p.click("#btSeguir");
    await p.waitForFunction(() => /Leitura e decisão certas/.test(document.querySelector("main h1").textContent));
  };

  /* 1. diagnóstico → trilha */
  await p.goto(BASE + "#/", { waitUntil: "networkidle" });
  await p.waitForSelector("[data-diag-probs]");
  await semRolagem("diagnóstico"); await foto("tatica-1-diagnostico");
  await p.click('[data-nivel="N1"]'); await p.click('[data-prob="atacar"]'); await p.click('[data-prob="erro"]');
  await p.click('[data-prob="rede"]'); assert.strictEqual(await p.locator('[data-prob][aria-pressed="true"]').count(), 2, "no máximo 2 problemas");
  await foto("tatica-1b-diagnostico-escolhido", true);
  await p.click("#btTrilha"); await p.waitForSelector("[data-atual]");
  assert.strictEqual(await p.getAttribute("[data-atual]", "data-atual"), "F05");
  assert.strictEqual(await p.locator("[data-trilha] .trilha li").count(), 6);
  await semRolagem("trilha"); await foto("tatica-2-trilha"); await foto("tatica-2b-trilha-inteira", true);

  /* 2. situação: os 6 passos */
  await p.click("[data-proximo]"); await p.waitForSelector("[data-passos]");
  assert.ok(await p.$('[data-passo="leu"].ok'), "entender marcado ao abrir");
  await semRolagem("situação"); await foto("tatica-3-situacao", true);

  /* 3. Pausa e decide */
  await p.click('[data-passo="decide"] a'); await p.waitForSelector(".opcoes");
  await foto("tatica-4-pausa-decide");
  await responderQuiz("F05");
  await foto("tatica-4b-resultado");
  await p.goto(BASE + "#/situacao/F05"); await p.waitForSelector("[data-passos]");
  await p.click('[data-marcar="sim"]'); await p.waitForSelector('[data-passo="sim"].ok');
  await p.click('[data-marcar="quadra"]'); await p.waitForSelector('[data-passo="quadra"].ok');

  /* 4. jogo: registro com decisão separada da execução */
  await p.click('[data-passo="jogo"] a'); await p.waitForSelector("[data-novo-plano]");
  await p.click('a[href^="#/registro/novo"]'); await p.waitForSelector("#gCod");
  await p.fill("#gContra", "Marcos"); await p.click('[data-ap="sim"]');
  for (let i = 0; i < 4; i++) await p.click('[data-mais="oport"]');
  await p.click('[data-mais="aprov"]'); await p.click('[data-mais="recus"]'); await p.click('[data-mais="recus"]');
  await p.click('[data-dec="boa"]'); await p.click('[data-exe="nao"]');
  await p.fill("#g_boa", "Ataquei a bola curta no 4-4, mesmo errando.");
  await semRolagem("registro"); await foto("tatica-5-registro", true);
  await p.click("#btSalvarReg"); await p.waitForSelector("[data-leitura]");
  assert.ok(/escolheu bem e a bola não saiu/.test(await p.innerText("[data-leitura]")), await p.innerText("[data-leitura]"));
  await foto("tatica-5b-leitura");
  await p.goto(BASE + "#/jogo"); await p.waitForSelector("[data-resumo-jogos]");
  assert.ok(/1 de 4/.test(await p.innerText("[data-resumo-jogos]")), await p.innerText("[data-resumo-jogos]"));
  await foto("tatica-6-jogo", true);

  /* 5. revisão em outro dia: só vale 2 dias depois do primeiro acerto */
  await p.goto(BASE + "#/"); await p.waitForSelector("[data-trilha]");
  assert.ok(!(await p.$("[data-revisoes]")), "sem revisão no mesmo dia");
  assert.strictEqual(await p.getAttribute("[data-atual]", "data-atual"), "F11", "a trilha anda depois de treinar e usar no jogo");
  await p.evaluate(() => { const e = JSON.parse(localStorage.getItem("qlt:v1")); const d = new Date(Date.now() - 3 * 864e5).toISOString(); e.prog.F05.quiz.forEach((q) => { q.em = d; }); localStorage.setItem("qlt:v1", JSON.stringify(e)); });
  await p.reload(); await p.waitForSelector("[data-revisoes]");
  await p.click("[data-revisoes] a"); await p.waitForSelector(".opcoes");
  assert.ok(/Revisão/i.test(await texto()));
  await responderQuiz("F05");
  assert.ok(/fixada/.test(await texto()));
  await p.goto(BASE + "#/situacao/F05"); await p.waitForSelector('[data-passo="retida"].ok');
  assert.ok(/Aprendida/.test(await texto()));

  /* 6. manual completo */
  await p.goto(BASE + "#/ler"); await p.waitForSelector(".indice");
  assert.ok((await p.locator(".indice li").count()) >= 60, "manual completo");
  await p.goto(BASE + "#/ler/7"); await p.waitForSelector(".leitura");
  await semRolagem("manual completo"); await foto("tatica-7-manual-completo");

  /* 7. vídeo com pausa (sem tocar o vídeo: o teste não depende do YouTube) */
  await p.goto(BASE + "#/video/novo"); await p.waitForSelector("#vLink");
  await p.fill("#vLink", "https://youtu.be/M7lc1UVf-VE"); await p.fill("#vTitulo", "Devolução no 30-30");
  await p.fill("#vIni", "0:20"); await p.fill("#vPausa", "0:10"); await p.fill("#vFim", "0:30");
  await p.click("#btSalvarVideo"); assert.ok(await p.isVisible("#vErro"), "pausa antes do começo é recusada");
  await p.fill("#vPausa", "0:25"); await p.click("#btSalvarVideo"); await p.waitForSelector("#btJaVi");
  await semRolagem("vídeo"); await foto("tatica-8-video");
  await p.click("#btJaVi"); await p.waitForSelector("[data-responder]");
  await p.fill("#rVi", "Bola alta no meu backhand, ele no centro."); await p.click('[data-faria="Construir"]'); await p.fill("#rPara", "cruzado fundo");
  await foto("tatica-8b-video-pausa", true);
  await p.click("#btVerResto"); await p.waitForSelector("#btJaVi2"); await p.click("#btJaVi2"); await p.waitForSelector("[data-comparar]");
  await p.click('[data-comp="Parecidas"]'); await p.fill("#rDepois", "Ganhar altura deu tempo para recuperar.");
  await p.click("#btGuardarResp"); await p.waitForFunction(() => /Respostas anteriores/.test(document.querySelector("main").innerText));

  /* 8. plano de jogo com a situação da vez */
  await p.goto(BASE + "#/jogo"); await p.waitForSelector("[data-novo-plano]"); await p.click("[data-novo-plano]");
  await p.waitForSelector("#plTitulo"); assert.ok(await p.$("[data-sugestao]"), "sugestão do manual a partir da situação");
  await p.fill("#plTitulo", "Copa Sul · contra Marcos"); await p.click('[data-adv="X09"]');
  await p.click("#btGerar"); await p.waitForSelector("[data-plano]");
  assert.ok(/situação que estou aprendendo/i.test(await p.innerText("[data-plano]")));
  await foto("tatica-9-plano", true);

  /* 9. simulador dentro do app e proposta */
  await p.goto(BASE + "#/simulador"); await p.waitForSelector("#simFrame"); await p.frameLocator("#simFrame").locator("main").waitFor(); await p.waitForTimeout(1200);
  const topoVisivel = await p.frame({ url: /decisoes/ }).evaluate(() => { const t = document.querySelector(".topo"); return t ? getComputedStyle(t).display !== "none" : false; });
  assert.ok(!topoVisivel, "cabeçalho do simulador escondido");
  await foto("tatica-10-simulador");
  await p.goto(BASE + "#/planos"); await p.waitForSelector(".planos-preco"); assert.ok(!/R\$/.test(await texto()), "sem preço");
  await p.goto(BASE + "#/treinar"); await p.waitForSelector("main h1"); await semRolagem("treinar"); await foto("tatica-11-treinar");
  assert.deepStrictEqual(erros, [], "erros no console: " + erros.join(" | "));
  console.log("smoke-tatica-prototipo: ok");
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
