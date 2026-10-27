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
const K = require(path.join(raiz, "decisoes/cenarios-mais3.js")), M = require(path.join(raiz, "decisoes/motor.js"));

/* ── motor: todos os caminhos de todos os cenários (3 combinações de altura × intensidade por golpe) ── */
let caminhos = 0;
const COMB = [["baixa", "maxima"], ["media", "firme"], ["alta", "controlada"]];
function anda(cen, est, prof) {
  const et = cen.etapas[est.etapa];
  assert(et, cen.id + ": etapa " + est.etapa + " existe"); assert.strictEqual(et.numero, prof, cen.id + " " + est.etapa + ": decisão " + prof);
  for (const o of et.opcoes) for (const c of (et.tipo === "golpe" ? COMB : [[null, null]])) {
    const r = M.simular(K, cen, est, est.etapa, { opcao: o.id, altura: c[0], intensidade: c[1] }), a = r.anim;
    if (a.jog.length) assert(Math.hypot(a.jog[0].x - est.jog[0], a.jog[0].y - est.jog[1]) < 0.01, cen.id + ": você começa onde terminou a etapa anterior");
    if (a.adv.length) assert(Math.hypot(a.adv[0].x - est.adv[0], a.adv[0].y - est.adv[1]) < 0.01, cen.id + ": o adversário também");
    assert(Math.hypot(a.bola[0].x - est.bola[0], a.bola[0].y - est.bola[1]) < 0.05, cen.id + ": a bola continua de onde parou");
    assert(a.bola.every((q) => Math.abs(q.x) < 7 && Math.abs(q.y) < 16 && q.h >= -0.01 && q.h < 7), cen.id + ": bola dentro da área desenhada");
    if (r.estadoFinal.etapa) anda(cen, r.estadoFinal, prof + 1);
    else { caminhos++; assert(r.estadoFinal.fim && prof === 3, cen.id + ": termina na decisão 3"); if (r.recuperacao) assert(/Uma resposta possível/.test(r.avaliacao.resposta)); }
  }
}
assert.strictEqual(K.CENARIOS.length, 34, "34 cenários");
assert.strictEqual(new Set(K.CENARIOS.map((c) => c.id)).size, 34, "ids únicos");
/* cada cenário: uma trilha conhecida, uma escolha coerente na decisão 1, e os exercícios citados existem no catálogo MTY */
const CAT = new Set(require(path.join(raiz, "netlify/functions/_player-catalogo.js")).DRILLS.map((d) => d.c));
K.CENARIOS.forEach((cen) => {
  assert(K.TRILHAS.some((t) => t.id === cen.trilha) || cen.gratis, cen.id + ": trilha");
  const est = M.estadoInicial(cen);
  assert(cen.etapas.d1.opcoes.some((o) => COMB.concat([["alta", "firme"], ["media", "controlada"], ["baixa", "controlada"], ["baixa", "firme"], ["media", "maxima"]]).some((c) => M.simular(K, cen, est, "d1", { opcao: o.id, altura: c[0], intensidade: c[1] }).avaliacao.nivel === "coerente")), cen.id + ": há uma escolha coerente");
  (cen.missao.passos.join(" ").match(/\b(?:IP|RT|AT|PT|DT|ADV)\d{3}\b/g) || []).forEach((cod) => assert(CAT.has(cod), cen.id + ": " + cod + " existe no catálogo"));
});
K.CENARIOS.forEach((cen) => { assert(cen.missao && cen.missao.passos.length && cen.perguntaMetodo, cen.id + ": missão e pergunta do método"); anda(cen, M.estadoInicial(cen), 1); });
/* as duas defesas do método: alta e cruzada acelerada são coerentes no mesmo alvo */
const dd = K.CENARIOS.find((c) => c.id === "neutralize");
assert.strictEqual(M.avaliarGolpe(K, dd.etapas.d1, dd.etapas.d1.opcoes[0], "alta", "controlada").nivel, "coerente");
assert.strictEqual(M.avaliarGolpe(K, dd.etapas.d1, dd.etapas.d1.opcoes[0], "media", "maxima").nivel, "coerente", "cruzada acelerada também é defesa válida");
assert.strictEqual(M.avaliarGolpe(K, K.CENARIOS.find((c) => c.id === "segundo").etapas.d1, K.CENARIOS.find((c) => c.id === "segundo").etapas.d1.opcoes[2], "media", "controlada").nivel, "iniciativa", "sacar só para não errar devolve a iniciativa");
/* altura e intensidade mudam a animação e o texto */
const c1 = K.CENARIOS[0], e0 = M.estadoInicial(c1);
const baixaMax = M.simular(K, c1, e0, "d1", { opcao: "cruzado", altura: "baixa", intensidade: "maxima" });
const altaCtl = M.simular(K, c1, e0, "d1", { opcao: "cruzado", altura: "alta", intensidade: "controlada" });
assert(Math.max(...altaCtl.anim.bola.map((q) => q.h)) > Math.max(...baixaMax.anim.bola.map((q) => q.h)) + 1, "altura alta sobe mais");
assert(altaCtl.anim.bola.find((q) => q.quique).t > baixaMax.anim.bola.find((q) => q.quique).t, "intensidade controlada: bola mais lenta");
assert.notStrictEqual(M.simular(K, c1, e0, "d1", { opcao: "paralela", altura: "baixa", intensidade: "maxima" }).avaliacao.nivel, M.simular(K, c1, e0, "d1", { opcao: "paralela", altura: "media", intensidade: "firme" }).avaliacao.nivel, "a combinação muda a avaliação");
assert.notStrictEqual(baixaMax.avaliacao.notaAltura, altaCtl.avaliacao.notaAltura);
/* progresso inválido não quebra */
assert.deepStrictEqual(M.normalizar("lixo", K), M.progressoVazio());
assert.deepStrictEqual(M.normalizar({ cenarios: { neutralize: { execucao: { caminho: [{ etapa: "d9", opcao: "x" }] } } } }, K).cenarios["neutralize.1"].execucao.caminho, []);
/* camada de jogo: níveis mudam a avaliação, estrelas, desbloqueio, revisão espaçada, sequência de dias, relâmpago */
assert.strictEqual(K.NIVEIS.length, 4);
const vant = K.CENARIOS.find((c) => c.id === "vantagem"), ctp = vant.etapas.d2_aberto.opcoes.find((o) => o.id === "contrape");
assert.notStrictEqual(M.avaliarGolpe(K, vant.etapas.d2_aberto, ctp, "media", "firme", K.NIVEIS[0].variante).nivel, M.avaliarGolpe(K, vant.etapas.d2_aberto, ctp, "media", "firme", K.NIVEIS[1].variante).nivel, "o nível muda a avaliação");
assert(M.avaliarGolpe(K, vant.etapas.d2_aberto, ctp, "media", "firme", K.NIVEIS[1].variante).notasVariante.length, "nota do nível no retorno");
const camOk = [{ etapa: "d1", opcao: "cruzado", altura: "alta", intensidade: "firme" }, { etapa: "d2_cruzado", opcao: "altura", altura: "alta", intensidade: "firme" }, { etapa: "d3", opcao: "cobrir" }];
assert.strictEqual(M.estrelas(K, c1, camOk, [], {}).estrelas, 3);
const tentErr = [{ etapa: "d1", opcao: "curta", altura: "baixa", intensidade: "maxima", primeira: true }, { etapa: "d1", opcao: "cruzado", altura: "alta", intensidade: "firme" }];
assert.strictEqual(M.estrelas(K, c1, camOk, tentErr, {}).estrelas, 2, "a estrela vale pela primeira escolha");
const pg = M.normalizar({ cenarios: { "neutralize.1": { historico: [{ concluidoEm: "2026-10-20T10:00:00Z", caminho: camOk, estrelas: 1 }] } } }, K);
assert.strictEqual(M.nivelLiberado(pg, "neutralize", 2), false, "1 estrela não libera o nível 2");
const pg2 = M.normalizar({ cenarios: { "neutralize.1": { historico: [{ concluidoEm: "2026-10-26T10:00:00Z", caminho: camOk, estrelas: 3 }] } } }, K);
assert.strictEqual(M.nivelLiberado(pg2, "neutralize", 2), true);
assert.strictEqual(M.revisoes(K, pg2, Date.parse("2026-10-28T10:00:00Z")).length, 0, "3 estrelas: volta em 7 dias");
assert.deepStrictEqual(M.revisoes(K, pg2, Date.parse("2026-11-03T11:00:00Z")).map((r) => [r.cenario, r.nivel]), [["neutralize", 2]], "volta em outro nível");
assert.strictEqual(M.sequenciaDias(["2026-10-25", "2026-10-26", "2026-10-27"], "2026-10-27"), 3);
assert(M.poolRelampago(K).length >= 100);
const r1 = M.simular(K, c1, e0, "d1", { opcao: "cruzado", altura: "alta", intensidade: "firme", previsao: "cruzada" });
assert(M.CATEGORIAS[r1.respostaCategoria] && r1.previsao, "categoria da resposta e previsão");
assert.strictEqual(M.temResposta(c1, "d1", "cruzado"), true); assert.strictEqual(M.temResposta(c1, "d2_cruzado", "altura"), false, "pausa antes da recuperação: sem previsão");
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

  /* camada de jogo: estrelas no resumo, nível 2 liberado com variações, previsão da resposta, nível bloqueado */
  await p.goto(base + "#resumo-saque"); t = await txt(p);
  assert(/de 3 primeiras escolhas coerentes/.test(t), "estrelas no resumo");
  await p.goto(base + "#jogar-pop.3"); t = await txt(p);
  assert(/Nível 3 bloqueado/.test(t), "nível bloqueado sem estrelas no anterior");
  await p.goto(base + "#jogar-neutralize"); await p.waitForSelector("#quadra svg");
  await p.click('label.op:has-text("Devolver cruzado com margem")'); await p.click('.segmentos label:has-text("Alta")');
  assert(await p.locator(".chips-prev").count(), "previsão aparece quando a jogada mostra uma resposta");
  await p.click('.chips-prev label:has-text("Cruzada")');
  await p.click("#btJogar"); await fimAnim(p);
  t = await txt(p); assert(/Você previu: Cruzada/.test(t), "resultado da previsão");
  await p.click("#btSeguir");
  assert(!(await p.locator(".chips-prev").count()), "sem previsão antes de escolher o alvo");
  await p.click('label.op:has-text("Dar altura e margem")'); await p.click('.segmentos label:has-text("Alta")');
  assert(!(await p.locator(".chips-prev").count()), "sem previsão quando a animação pausa antes da recuperação");
  await p.click("#btJogar"); await fimAnim(p); await p.click("#btSeguir");
  await p.click('label.op:has-text("Cobrir a resposta provável")'); await p.click('.chips-prev label:has-text("Pelo meio")'); await p.click("#btJogar"); await fimAnim(p); await p.click("#btSeguir");
  await p.waitForSelector(".placar-final"); t = await txt(p);
  assert(/Nível 2 liberado/.test(t), "2+ estrelas liberam o nível 2");
  await cap(p, "08d-estrelas-cel");
  await p.click("text=Jogar o nível 2"); await p.waitForSelector("#quadra svg"); t = await txt(p);
  assert(/Nível 2 de 4/i.test(t) && /Quadra rápida/.test(t) && /Adversário agressivo/.test(t), "nível 2 com quadra rápida e adversário agressivo");
  await p.click('label.op:has-text("Tentar uma curta")'); await p.click("#btJogar"); await fimAnim(p);
  assert(/Neste nível/i.test(await txt(p)), "nota do nível no retorno");
  await cap(p, "08e-nivel2-cel");
  await p.goto(base + "#cenarios"); t = await txt(p);
  assert(/de 408 estrelas/.test(t) && /pontos de leitura/.test(t) && /dias? seguidos?/.test(t), "placar do jogo");

  /* revisão do dia: um cenário concluído há 8 dias volta, em outro nível */
  await p.evaluate(() => { const k = "qlDecisoes:v1", g = JSON.parse(localStorage.getItem(k)); g.cenarios["defesa.1"].historico.forEach((h) => { h.concluidoEm = new Date(Date.now() - 8 * 864e5).toISOString(); }); localStorage.setItem(k, JSON.stringify(g)); });
  await p.goto(base + "#desafios"); await p.reload(); t = await txt(p);
  assert(/Saia da defesa com intenção/.test(t), "revisão do dia lista o cenário");
  await cap(p, "08f-desafios-cel");
  await p.locator("[data-rev]").first().click(); await p.waitForSelector("#quadra svg");
  assert(/Nível 2 de 4/i.test(await txt(p)), "a revisão abre outro nível, mesmo bloqueado na campanha");

  /* relâmpago: 10 decisões com tempo */
  await p.goto(base + "#relampago"); await p.waitForSelector("[data-rel]");
  for (let i = 0; i < 10; i++) {
    await p.waitForSelector("[data-rel]:not([disabled])");
    if (i === 3) { await p.waitForFunction(() => /Tempo esgotado/.test(document.querySelector("#relRet").textContent), null, { timeout: 9000 }); }
    else await p.locator("[data-rel]").first().click();
    if (i === 0) await cap(p, "08g-relampago-cel");
    await p.click("#painel .btn-primario");
  }
  await p.waitForFunction(() => /^Relâmpago: \d+ pontos/.test(document.querySelector("h1").textContent), null, { timeout: 5000 });
  t = await txt(p); assert(/Tempo esgotado/.test(t) && (t.match(/\n\d+\. /g) || []).length >= 10, "resultado do relâmpago com as 10 decisões");
  await p.goto(base + "#desafios"); assert(/Sua melhor marca: [1-9]/.test(await txt(p)), "melhor marca guardada");

  /* cenários do método: biblioteca por situação tática; "Arma, abre e fecha" com três golpes; approach e voleio */
  await p.goto(base + "#cenarios"); t = await txt(p);
  assert(/Para começar · gratuitos/i.test(t) && /Prévia do conteúdo planejado/.test(t), "biblioteca: gratuitos e prévia");
  for (const tr of ["Início do ponto", "Construção", "Ataque e transição", "Defesa e contra-ataque", "Pontos importantes"]) assert(t.includes(tr), "trilha " + tr);
  assert.strictEqual(await p.locator("article.cen").count(), 34, "34 cenários na biblioteca");
  await cap(p, "08b-biblioteca-cel");
  await p.goto(base + "#jogar-pop"); await p.waitForSelector("#quadra svg");
  assert(/Situação tática: Construção/i.test(await txt(p)), "situação tática na decisão");
  for (const rot of ["Profunda, para armar", "Angulada cruzada, para abrir", "Mudar de direção na paralela"]) {
    await p.click('label.op:has-text("' + rot + '")'); await p.click("#btJogar"); await fimAnim(p);
    assert(/Objetivo do método nesta escolha/.test(await txt(p)), "objetivo do método no retorno");
    await p.click("#btSeguir");
  }
  await p.waitForSelector(".missao"); t = await txt(p);
  assert(/Cada bola teve o seu papel/.test(t) && /PT003/.test(t), "pop: pergunta do método e exercício do catálogo");
  await p.goto(base + "#jogar-convite"); await p.waitForSelector("#quadra svg");
  await p.click('label.op:has-text("Approach na paralela e subir")'); await p.click("#btJogar"); await fimAnim(p); await p.click("#btSeguir");
  t = await txt(p); assert(/Qual voleio\?/.test(t) && /Voleio de forehand/i.test(t), "approach leva ao voleio");
  await p.click('label.op:has-text("Voleio no lado aberto")'); await p.click("#btJogar"); await fimAnim(p); await p.click("#btSeguir");
  t = await txt(p); assert(/Fechar a rede na linha da bola/.test(t), "recuperação na rede");
  await cap(p, "08c-rede-cel");
  await p.click('label.op:has-text("Fechar a rede na linha da bola")'); await p.click("#btJogar"); await fimAnim(p); await p.click("#btSeguir");
  await p.waitForSelector(".missao");
  await p.goto(base + "#jogar-segundo"); await p.waitForSelector("#quadra svg");
  await p.click('label.op:has-text("Só colocar a bola em jogo")'); await p.click("#btJogar"); await fimAnim(p);
  assert(/devolve a iniciativa ao adversário/.test(await txt(p)), "sacar só para não errar: devolve a iniciativa");
  /* novos padrões: abre e sobe (três golpes, o último um voleio), smash e ponto importante */
  await p.goto(base + "#jogar-abresobe"); await p.waitForSelector("#quadra svg");
  for (const rot of ["Cruzada angulada, para abrir", "Approach na paralela e subir", "Voleio no lado aberto"]) {
    await p.click('label.op:has-text("' + rot + '")'); await p.click("#btJogar"); await fimAnim(p); await p.click("#btSeguir");
  }
  await p.waitForSelector(".missao"); assert(/PT005/.test(await txt(p)), "abre e sobe: exercício do catálogo");
  await p.goto(base + "#jogar-smash"); await p.waitForSelector("#quadra svg");
  await p.click('label.op:has-text("Força máxima na linha")'); await p.click("#btJogar"); await fimAnim(p);
  assert(/pouca margem/.test(await txt(p)), "smash: força máxima na linha explicada");
  await p.goto(base + "#jogar-longos"); await p.waitForSelector("#quadra svg");
  await p.click('label.op:has-text("Alta no meio, esperando o erro")'); await p.click("#btJogar"); await fimAnim(p);
  assert(/esperar o erro do outro/.test(await txt(p)), "ponto longo: esperar o erro devolve a iniciativa");
  await p.goto(base + "#progresso"); await p.click("#btLimpar"); await p.click("#btLimparSim");
  for (const id of ["neutralize", "saque", "defesa"]) { /* refaz os três gratuitos para o resto do teste */
    await p.goto(base + "#jogar-" + id); await p.waitForSelector("#quadra svg");
    for (let n = 0; n < 3; n++) { await p.locator('input[name="op"]').first().check({ force: true }); await p.click("#btJogar"); await fimAnim(p); await p.click("#btSeguir"); }
    await p.waitForSelector(".missao");
  }

  /* progresso */
  await p.goto(base + "#progresso"); t = await txt(p);
  assert(/3 de 34 cenários iniciados · 3 de 34 concluídos/.test(t) && /só neste navegador/.test(t) && (t.match(/Concluído em/g) || []).length === 3);
  await p.click('a[href="#jogar-neutralize"]'); await p.waitForSelector("#quadra svg");
  await p.click('label.op:has-text("Tentar uma curta")'); await p.click("#btJogar"); await fimAnim(p); await p.click("#btSeguir");
  await p.goto(base + "#progresso"); t = await txt(p);
  assert(/Em andamento · decisão 2 de 3/.test(t) && /Retomar na decisão 2/.test(t));
  await cap(p, "09-progresso-cel");
  await p.click("text=Retomar na decisão 2"); await p.waitForSelector("#quadra svg");
  assert(/O adversário correu, chegou à curta/.test(await txt(p)), "retoma o caminho da curta");
  await p.goto(base + "#progresso"); await p.click("#btLimpar");
  assert(/Limpar todo o progresso\?/.test(await txt(p))); await p.click("#btLimparNao");
  assert(/3 de 34 concluídos/.test(await txt(p)), "cancelar mantém o progresso");
  await p.click("#btLimpar"); await p.click("#btLimparSim");
  assert(/0 de 34 cenários iniciados/.test(await txt(p)), "progresso apagado");
  /* dados locais inválidos */
  await p.evaluate(() => localStorage.setItem("qlDecisoes:v1", "{quebrado"));
  await p.goto(base + "#jogar-saque"); await p.reload(); await p.waitForSelector("#quadra svg");
  assert(/Decisão 1 de 3/i.test(await txt(p)), "dados inválidos: começa do início");

  /* módulo, consultoria e solicitação demonstrativa */
  await p.goto(base + "#modulo"); t = await txt(p);
  assert(/As primeiras quatro bolas/.test(t) && /R\$ 197/.test(t) && /preço em avaliação/.test(t) && /Os três cenários iniciais são gratuitos/.test(t) && /prévia do conteúdo planejado/.test(t) && /não inclui análise individual/.test(t) && /Não há compra nesta versão/.test(t));
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
