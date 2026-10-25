/* QuadraLab Player · Simulador de Decisões (decisoes/), ponta a ponta no navegador, no celular (390 px) e no computador:
   · motor: todos os caminhos dos 3 cenários (alvo × altura × intensidade × recuperação) sem saltos de posição;
   · os 3 cenários jogados até o fim: alvo pela quadra e pela lista, altura e intensidade mudando a animação e o texto,
     controles bloqueados durante a animação, comparar outra alternativa (primeira escolha × explorada), repetir;
   · progresso retomado exatamente de onde parou (inclusive com o resultado aberto), dados locais inválidos, limpar;
   · resumo com as três decisões, missão e pergunta; convite à consultoria; módulo; solicitação demonstrativa;
   · movimento reduzido e nenhuma requisição para fora (nada é enviado).
   Rode: node tests/smoke-decisoes.js [pasta-das-capturas] */
const http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const raiz = path.join(__dirname, ".."), capturas = process.argv[2] || "";
const K = require(path.join(raiz, "decisoes/cenarios.js")), M = require(path.join(raiz, "decisoes/motor.js"));

/* ── motor ── */
let caminhos = 0;
for (const cen of K.CENARIOS) {
  const e0 = M.estadoInicial(cen);
  for (const o1 of cen.etapas.d1.opcoes) for (const a of M.ALTURAS) for (const i of M.INTENSIDADES) {
    const r1 = M.simular(K, cen, e0, "d1", { opcao: o1.id, altura: a, intensidade: i }), e1 = r1.estadoFinal;
    assert(cen.etapas[e1.etapa], "etapa seguinte existe");
    for (const o2 of cen.etapas[e1.etapa].opcoes) for (const a2 of M.ALTURAS) {
      const r2 = M.simular(K, cen, e1, e1.etapa, { opcao: o2.id, altura: a2, intensidade: "firme" }), e2 = r2.estadoFinal;
      assert.deepStrictEqual([r2.anim.jog[0].x, r2.anim.jog[0].y], e1.jog, "continuidade: você começa a etapa 2 onde terminou a 1");
      assert.deepStrictEqual([r2.anim.adv[0].x, r2.anim.adv[0].y], e1.adv, "continuidade: o adversário também");
      for (const o3 of cen.etapas.d3.opcoes) {
        const r3 = M.simular(K, cen, e2, "d3", { opcao: o3.id });
        caminhos++;
        assert.deepStrictEqual([r3.anim.jog[0].x, r3.anim.jog[0].y], e2.jog);
        const b = r3.anim.bola[0]; assert(Math.hypot(b.x - e2.bola[0], b.y - e2.bola[1]) < 0.01, "a bola continua de onde parou");
        assert(r3.estadoFinal.fim && /Uma resposta possível/.test(r3.avaliacao.resposta));
      }
    }
  }
}
/* altura e intensidade mudam a animação e o texto */
const c1 = K.CENARIOS[0], e0 = M.estadoInicial(c1);
const baixaMax = M.simular(K, c1, e0, "d1", { opcao: "cruzado", altura: "baixa", intensidade: "maxima" });
const altaCtl = M.simular(K, c1, e0, "d1", { opcao: "cruzado", altura: "alta", intensidade: "controlada" });
assert(Math.max(...altaCtl.anim.bola.map((q) => q.h)) > Math.max(...baixaMax.anim.bola.map((q) => q.h)) + 1, "altura alta sobe mais");
assert(altaCtl.anim.bola.find((q) => q.quique).t > baixaMax.anim.bola.find((q) => q.quique).t, "intensidade controlada: bola mais lenta");
assert.notStrictEqual(baixaMax.avaliacao.nivel, altaCtl.avaliacao.nivel, "a combinação muda a avaliação");
assert.notStrictEqual(baixaMax.avaliacao.notaAltura, altaCtl.avaliacao.notaAltura);
/* progresso inválido não quebra */
assert.deepStrictEqual(M.normalizar("lixo", K), M.progressoVazio());
assert.deepStrictEqual(M.normalizar({ cenarios: { neutralize: { execucao: { caminho: [{ etapa: "d9", opcao: "x" }] } } } }, K).cenarios.neutralize.execucao.caminho, []);
console.log("  motor: " + caminhos + " caminhos completos");

/* ── navegador ── */
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webp": "image/webp" };
const srv = http.createServer((q, r) => { let f = path.join(raiz, decodeURIComponent(q.url.split("?")[0])); if (f.endsWith("/")) f += "index.html"; if (!f.startsWith(raiz) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); r.end(fs.readFileSync(f)); }).listen(0);

(async () => {
  const base = "http://localhost:" + srv.address().port + "/decisoes/";
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const erros = [], fora = [];
  async function pagina(w, h, opts) {
    const ctx = await b.newContext(Object.assign({ viewport: { width: w, height: h } }, opts || {}));
    await ctx.route("**/*", (r) => { const u = r.request().url(); if (u.startsWith(base) || u.startsWith("http://localhost")) return r.continue(); if (/fonts\.(googleapis|gstatic)\.com/.test(u)) return r.fulfill({ body: "", contentType: "text/css" }); fora.push(u); return r.abort(); });
    const p = await ctx.newPage(); p.on("pageerror", (e) => erros.push(e.message)); p.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });
    return p;
  }
  const cap = async (p, nome) => { if (capturas) { fs.mkdirSync(capturas, { recursive: true }); await p.screenshot({ path: path.join(capturas, nome + ".png"), fullPage: true }); } };
  const txt = (p) => p.evaluate(() => document.body.innerText);
  const fimAnim = (p) => p.waitForSelector(".feedback", { timeout: 20000 });
  const semRolagem = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

  /* celular */
  let p = await pagina(390, 844);
  await p.goto(base);
  let t = await txt(p);
  assert(/O próximo ponto começa na sua decisão\./.test(t) && /Experimentar grátis/.test(t) && /Conhecer a consultoria/.test(t));
  assert(/3\s*cenários gratuitos/.test(t) && /9\s*decisões em sequência/.test(t) && /Sem cadastro/.test(t));
  assert(await semRolagem(p), "sem rolagem lateral na apresentação");
  assert.strictEqual(await p.locator("img[alt='QuadraLab Player']").count(), 1, "logo do Player preservado");
  /* prévia interativa */
  await p.click("#previaLista [data-op=cruzado]");
  await p.waitForFunction(() => /Continuar no simulador/.test(document.querySelector("#previaRes").textContent), null, { timeout: 15000 });
  await cap(p, "01-apresentacao-cel");

  /* cenário 1: alvo pela quadra, altura e intensidade, animação bloqueia, comparar, continuar */
  await p.click("text=Experimentar grátis"); await p.waitForSelector(".grade-cen");
  await p.click('a[href="#jogar-neutralize"]'); await p.waitForSelector("#quadra svg");
  assert(/Decisão 1 de 3/i.test(await txt(p)));
  assert.strictEqual(await p.locator("#btJogar").isDisabled(), true, "jogar só depois de escolher");
  await p.locator(".c-alvos .alvo").nth(1).click();                         // alvo 2 tocado na quadra
  assert.strictEqual(await p.locator('input[name="op"][value="paralela"]').isChecked(), true, "o alvo da quadra marca a lista");
  await p.click('.segmentos label:has-text("Baixa")'); await p.click('.segmentos label:has-text("Máxima")');
  assert(await p.locator(".perfil-svg").count(), "vista lateral da altura");
  await cap(p, "02-escolha-cel");
  await p.click("#btJogar");
  assert.strictEqual(await p.locator('fieldset.campo[disabled]').count() >= 1, true, "controles bloqueados durante a animação");
  assert.strictEqual(await p.locator(".c-alvos .alvo").count(), 0, "alvos fora durante a animação");
  await p.waitForTimeout(700); await cap(p, "03-animacao-cel");
  await fimAnim(p);
  t = await txt(p);
  assert(/Uma escolha que exige mais controle\./.test(t) && /altura baixa · intensidade máxima/.test(t), "feedback com a combinação");
  assert(/Primeira escolha/.test(t));
  await cap(p, "04-resultado-cel");
  await p.click("#btComparar");
  await p.click('label.op:has-text("Devolver cruzado com margem")');           // pela lista
  await p.click('.segmentos label:has-text("Alta")'); await p.click('.segmentos label:has-text("Controlada")');
  await p.click("#btJogar"); await fimAnim(p);
  t = await txt(p);
  assert(/Coerente com este contexto\./.test(t) && /Explorada/.test(t) && /Primeira escolha/.test(t), "primeira escolha e explorada");
  await p.click("#btRepetir"); assert.strictEqual(await p.locator("#btSeguir").count(), 0, "sem avançar durante a repetição"); await fimAnim(p);

  /* retomar exatamente de onde parou (resultado aberto) */
  await p.reload(); await fimAnim(p);
  assert(/Coerente com este contexto\./.test(await txt(p)), "retoma com o resultado aberto");
  await p.click("#btSeguir");
  t = await txt(p); assert(/Decisão 2 de 3/i.test(t) && /A troca seguiu cruzada/.test(t), "continuação coerente com o cruzado");
  const posJog = await p.evaluate(() => document.querySelector(".jogador").getAttribute("transform"));
  await p.reload(); await p.waitForSelector("#quadra svg");
  assert(/Decisão 2 de 3/i.test(await txt(p)), "retoma na decisão 2");
  assert.strictEqual(await p.evaluate(() => document.querySelector(".jogador").getAttribute("transform")), posJog, "mesma posição ao retomar");
  await p.click('label.op:has-text("Dar altura e margem")'); await p.click("#btJogar"); await fimAnim(p);
  assert(/bola cruzando a rede/.test(await txt(p)), "pausa com a bola no ar antes da recuperação");
  await p.click("#btSeguir");
  t = await txt(p); assert(/Decisão 3 de 3/i.test(t) && /Para onde você se recupera\?/.test(t));
  assert(!(await p.locator(".segmentos").count()), "na recuperação não há altura nem intensidade");
  await cap(p, "05-recuperacao-cel");
  await p.locator(".c-alvos .alvo").nth(0).click(); await p.click("#btJogar"); await fimAnim(p);
  t = await txt(p); assert(/Uma resposta possível do adversário/.test(t) && /Na ilustração/.test(t));
  await cap(p, "06-recuperacao-resultado-cel");
  await p.click("#btSeguir"); await p.waitForSelector(".missao");
  t = await txt(p);
  assert((t.match(/Decisão \d/gi) || []).length === 3, "resumo com as três decisões");
  assert(/altura alta · intensidade controlada/.test(t) && /Também explorado: Buscar a paralela/.test(t) && /Escolhida depois de comparar/.test(t));
  assert(/Minha escolha me deixou preparado para a bola seguinte\?/.test(t) && /Comparar outro caminho/.test(t) && /Explorar próximo cenário/.test(t));
  assert(/Você explorou essas situações no simulador/.test(t));
  await cap(p, "07-resumo-cel");
  assert(await semRolagem(p));

  /* cenários 2 e 3 até o fim, pela lista */
  for (const [id, d1, d2, d3] of [["saque", "Sacar no T", "Atacar o espaço aberto com margem", "Avançar com equilíbrio e cobrir a passada"], ["defesa", "Jogar cruzado com margem", "Pressionar com margem", "Recuperar uma posição de cobertura"]]) {
    await p.goto(base + "#jogar-" + id); await p.waitForSelector("#quadra svg");
    for (const [rot, n] of [[d1, 1], [d2, 2], [d3, 3]]) {
      assert(new RegExp("Decisão " + n + " de 3", "i").test(await txt(p)));
      await p.click('label.op:has-text("' + rot + '")'); await p.click("#btJogar"); await fimAnim(p); await p.click("#btSeguir");
    }
    await p.waitForSelector(".missao");
    assert(/Missão de treino/i.test(await txt(p)), id + ": missão");
  }
  await cap(p, "08-resumo-defesa-cel");

  /* progresso */
  await p.goto(base + "#progresso"); t = await txt(p);
  assert(/3 de 3 cenários iniciados · 3 de 3 concluídos/.test(t) && /só neste navegador/.test(t) && (t.match(/Concluído em/g) || []).length === 3);
  await p.click('a[href="#jogar-neutralize"]'); await p.waitForSelector("#quadra svg");
  await p.click('label.op:has-text("Tentar uma curta")'); await p.click("#btJogar"); await fimAnim(p); await p.click("#btSeguir");
  await p.goto(base + "#progresso"); t = await txt(p);
  assert(/Em andamento · decisão 2 de 3/.test(t) && /Retomar na decisão 2/.test(t));
  await cap(p, "09-progresso-cel");
  await p.click("text=Retomar na decisão 2"); await p.waitForSelector("#quadra svg");
  assert(/O adversário correu, chegou à curta/.test(await txt(p)), "retoma o caminho da curta");
  await p.goto(base + "#progresso"); await p.click("#btLimpar");
  assert(/Limpar todo o progresso\?/.test(await txt(p))); await p.click("#btLimparNao");
  assert(/3 de 3 concluídos/.test(await txt(p)), "cancelar mantém o progresso");
  await p.click("#btLimpar"); await p.click("#btLimparSim");
  assert(/0 de 3 cenários iniciados/.test(await txt(p)), "progresso apagado");
  /* dados locais inválidos */
  await p.evaluate(() => localStorage.setItem("qlDecisoes:v1", "{quebrado"));
  await p.goto(base + "#jogar-saque"); await p.reload(); await p.waitForSelector("#quadra svg");
  assert(/Decisão 1 de 3/i.test(await txt(p)), "dados inválidos: começa do início");

  /* módulo, consultoria e solicitação demonstrativa */
  await p.goto(base + "#modulo"); t = await txt(p);
  assert(/As primeiras quatro bolas/.test(t) && /R\$ 197/.test(t) && /preço em avaliação/.test(t) && /Somente os três cenários iniciais estão implementados/.test(t) && /não inclui análise individual/.test(t) && /Não há compra nesta versão/.test(t));
  await p.goto(base + "#consultoria"); t = await txt(p);
  assert(/Clareza sobre o que trabalhar\. Direção para aplicar\./.test(t) && /Análise de 3 partidas completas/.test(t) && /Até 6 horas de gravação/.test(t) && /R\$ 2\.000/.test(t) && /valor em avaliação/.test(t) && /Aulas presenciais/.test(t));
  await cap(p, "10-consultoria-cel");
  await p.click("text=Simular uma solicitação"); await p.waitForSelector("#formPedido");
  await p.click('#formPedido button[type="submit"]');
  assert.strictEqual(await p.locator(".erro:not([hidden])").count(), 6, "validação dos 6 campos");
  await p.fill("#nome", "Jogador Exemplo"); await p.check('input[name="perfil"][value="jogador"]'); await p.selectOption("#objetivo", "saque");
  await p.check('input[name="aplicacao"][value="professor_atual"]'); await p.check('input[name="partidas"][value="vou"]');
  await p.fill("#descricao", "curto");
  assert(/5 de 1\.000 caracteres \(mínimo 15\)/.test(await txt(p)), "contador");
  await p.click('#formPedido button[type="submit"]'); assert(/pelo menos 15 caracteres/.test(await txt(p)));
  await p.fill("#descricao", "Quero entender como construir melhor o ponto depois do meu saque.");
  await p.click('#formPedido button[type="submit"]'); await p.waitForSelector(".revisao");
  t = await txt(p); assert(/Revise a solicitação/.test(t) && /Jogador Exemplo/.test(t) && /Saque e devolução/.test(t));
  await p.click("#btEditar"); assert.strictEqual(await p.inputValue("#nome"), "Jogador Exemplo", "editar mantém os dados");
  await p.fill("#nome", "Jogadora Exemplo"); await p.click('#formPedido button[type="submit"]'); await p.waitForSelector(".revisao");
  assert(/Jogadora Exemplo/.test(await txt(p)));
  await cap(p, "11-revisao-cel");
  await p.click("#btConcluir"); t = await txt(p);
  assert(/Demonstração concluída/.test(t) && /nenhum dado foi enviado/.test(t) && /Confirmação comercial/.test(t));
  await p.context().close();

  /* computador + teclado */
  p = await pagina(1280, 860);
  await p.goto(base + "#jogar-defesa"); await p.waitForSelector("#quadra svg");
  await p.focus(".c-alvos .alvo >> nth=0"); await p.keyboard.press("Enter");
  assert.strictEqual(await p.locator('input[name="op"][value="cruzado"]').isChecked(), true, "alvo pelo teclado");
  await cap(p, "12-simulador-pc");
  await p.click("#btJogar"); await fimAnim(p);
  assert(await p.evaluate(() => document.activeElement && document.activeElement.id === "btSeguir"), "foco no próximo passo");
  assert(/Coerente com este contexto|possível para começar/.test(await txt(p)));
  await cap(p, "13-resultado-pc");
  await p.goto(base); await cap(p, "14-apresentacao-pc");
  await p.context().close();

  /* movimento reduzido: sem animação, mesmo resultado */
  p = await pagina(390, 844, { reducedMotion: "reduce" });
  await p.goto(base + "#jogar-saque"); await p.waitForSelector("#quadra svg");
  await p.click('label.op:has-text("Sacar aberto")'); const t0 = Date.now(); await p.click("#btJogar"); await fimAnim(p);
  assert(Date.now() - t0 < 1500, "movimento reduzido: resultado sem esperar a animação");
  await p.context().close();

  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  assert.deepStrictEqual(fora, [], "nada é enviado para fora: " + fora.join(" | "));
  console.log("smoke-decisoes: ok");
  await b.close(); srv.close();
})().catch((e) => { console.error(e); srv.close(); process.exit(1); });
