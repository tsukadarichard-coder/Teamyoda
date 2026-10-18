/* Olhar do treinador, ponta a ponta no navegador: página de vendas, formulário, revisão, pagamento (checkout da Eduzz simulado), pedido recebido pelo webhook,
   publicação no painel e devolutiva tocando no app. Servidor real (as functions de verdade) sobre um Firestore e um armazenamento em memória.
   Rode: node tests/smoke-olhar.js   (precisa do Playwright e do Chromium instalados; salva capturas em tests/capturas-olhar/) */
const http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const raiz = path.join(__dirname, ".."), fx = path.join(raiz, "netlify/functions/");
const saida = path.join(__dirname, "capturas-olhar"); fs.mkdirSync(saida, { recursive: true });

/* ── Firestore em memória ── */
const store = {}; let seq = 0; const J = (v) => JSON.parse(JSON.stringify(v));
function docRef(p) { return { id: p.split("/").pop(), async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), data: () => J(v) }; }, async set(v, o) { store[p] = o && o.merge ? { ...(store[p] || {}), ...J(v) } : J(v); }, async update(v) { Object.assign(store[p], J(v)); }, async delete() { delete store[p]; }, collection: (s) => colRef(p + "/" + s) }; }
function colRef(p, f = [], ord = null, lim = 0) {
  const q = {
    doc: (id) => docRef(p + "/" + id), where: (c, o, v) => colRef(p, f.concat([[c, v]]), ord, lim), orderBy: (c, d) => colRef(p, f, [c, d || "asc"], lim), limit: (n) => colRef(p, f, ord, n),
    async add(v) { const id = "doc" + String(++seq).padStart(12, "0"); store[p + "/" + id] = J(v); return docRef(p + "/" + id); },
    async get() {
      let ks = Object.keys(store).filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/")).filter((k) => f.every(([c, v]) => store[k][c] === v));
      if (ord) ks.sort((a, b) => (String(store[a][ord[0]]) < String(store[b][ord[0]]) ? -1 : 1) * (ord[1] === "desc" ? -1 : 1));
      if (lim) ks = ks.slice(0, lim);
      const d = ks.map((k) => ({ id: k.split("/").pop(), ref: docRef(k), data: () => J(store[k]) }));
      return { docs: d, empty: !d.length, size: d.length, forEach: (g) => d.forEach(g) };
    },
  };
  return q;
}
const admin = { firestore: () => ({ collection: (n) => colRef(n) }), auth: () => ({ verifyIdToken: async (t) => { if (t !== "tok") throw new Error("x"); return { uid: "ua", email: "ana@exemplo.com", name: "Ana" }; } }) };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };
/* armazenamento simulado */
const objetos = {}, ARQ = require(fx + "_olhar-armazenamento.js");
Object.assign(ARQ, {
  urlParaEnvio: async (pid, ct, tam) => { const v = ARQ.validarArquivo(ct, tam); if (!v.ok) return v; const caminho = ARQ.novoCaminho(pid, v.info.ext); return { ok: true, url: "/__armazenamento/envio/" + caminho, caminho, contentType: ct, tipo: v.info.tipo }; },
  conferirArquivo: async (c, pid) => { const o = objetos[c]; if (!ARQ.caminhoDoPedido(c, pid) || !o) return { ok: false, erro: "Arquivo não encontrado." }; const v = ARQ.validarArquivo(o.contentType, o.tamanho); return v.ok ? { ok: true, tipo: v.info.tipo, contentType: o.contentType, tamanho: o.tamanho, md5: "m", geracao: "1" } : v; },
  mesmoArquivo: async (a) => !!objetos[a.caminho], urlParaLeitura: async (c) => ({ url: "/__armazenamento/leitura/" + c, expiraEm: "x" }), removerArquivo: async (c) => { delete objetos[c]; return true; },
});
process.env.ADMIN_SECRET = "segredo";
const O = require(fx + "_player-olhar.js");

/* ── servidor: arquivos do app + functions reais ── */
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".png": "image/png", ".json": "application/json", ".svg": "image/svg+xml" };
const servidor = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/__armazenamento/leitura/")) { const o = objetos[u.pathname.replace("/__armazenamento/leitura/", "")]; res.writeHead(o ? 200 : 404, { "content-type": o ? o.contentType : "text/plain", "accept-ranges": "bytes" }); return res.end(o ? o.corpo : ""); }
  if (u.pathname.startsWith("/__armazenamento/envio/")) { const c = u.pathname.replace("/__armazenamento/envio/", ""), parts = []; req.on("data", (d) => parts.push(d)); req.on("end", () => { objetos[c] = { contentType: req.headers["content-type"], corpo: Buffer.concat(parts), tamanho: Buffer.concat(parts).length }; res.writeHead(200); res.end(); }); return; }
  if (u.pathname.startsWith("/.netlify/functions/")) {
    const nome = u.pathname.split("/").pop(); let corpo = ""; req.on("data", (d) => (corpo += d));
    req.on("end", async () => {
      try {
        const h = require(fx + nome + ".js").handler;
        const r = await h({ httpMethod: req.method, headers: req.headers, body: corpo || null, queryStringParameters: Object.fromEntries(u.searchParams) });
        res.writeHead(r.statusCode, r.headers || { "content-type": "application/json" }); res.end(r.body);
      } catch (e) { res.writeHead(500); res.end(JSON.stringify({ erro: String(e.message) })); }
    });
    return;
  }
  let f = path.join(raiz, decodeURIComponent(u.pathname)); if (u.pathname.endsWith("/")) f = path.join(f, "index.html");
  if (!f.startsWith(raiz) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("não encontrado"); }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); res.end(fs.readFileSync(f));
});

const FIREBASE_STUB = `(function(){var cbs=[],a={currentUser:null,languageCode:"",onAuthStateChanged:function(cb){cbs.push(cb);setTimeout(function(){cb(a.currentUser)},0)},signOut:function(){a.currentUser=null;cbs.forEach(function(c){c(null)});return Promise.resolve()},signInWithEmailAndPassword:function(){a.currentUser={uid:"ua",email:"ana@exemplo.com",displayName:"Ana",getIdToken:function(){return Promise.resolve("tok")}};cbs.forEach(function(c){c(a.currentUser)});return Promise.resolve()}};
if(window.__LOGADO){a.currentUser={uid:"ua",email:"ana@exemplo.com",displayName:"Ana",getIdToken:function(){return Promise.resolve("tok")}}}
window.firebase={initializeApp:function(){},auth:function(){return a}};})();`;

(async () => {
  store["jogadores/ua"] = { nome: "Ana Souza", email: "ana@exemplo.com", criadoEm: "2026-09-01T10:00:00Z", planosGratisUsados: 1, ficha: { nivel: "intermediario", mao: "destro", backhand: "duas", piso: "saibro", armaPrincipal: "forehand", pontoFraco: "backhand", padraoPonto: "fundo", rede: "raro", devolucao: "neutra", pressao: "oscila", adversario: {} } };
  store["jogadores/ua/planos/plano00001"] = { status: "pronto", criadoEm: "2026-10-01T10:00:00Z", plano: { titulo: "Atacar a segunda bola do adversário", resumo: "Ganhar a iniciativa cedo no ponto sem abrir mão da consistência.", diretrizes: [{ titulo: "Segunda bola", acao: "Atacar cruzado", porque: "Abre a quadra" }], jogadas: [] } };
  await new Promise((r) => servidor.listen(0, r));
  const base = "http://localhost:" + servidor.address().port;
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const erros = [];
  async function novaPagina(logado, largura) {
    const ctx = await browser.newContext({ viewport: { width: largura || 390, height: 844 }, deviceScaleFactor: 1 });
    await ctx.route("https://www.gstatic.com/firebasejs/**", (r) => r.fulfill({ contentType: "text/javascript", body: r.request().url().includes("app-compat") ? FIREBASE_STUB : "" }));
    await ctx.route("https://sun.eduzz.com/**", (r) => r.fulfill({ contentType: "text/html", body: "<h1>Checkout simulado da Eduzz</h1>" }));
    const pg = await ctx.newPage();
    pg.on("pageerror", (e) => erros.push(e.message)); pg.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) erros.push(m.text()); });
    if (logado) await pg.addInitScript(() => { window.__LOGADO = true; });
    return pg;
  }
  const txt = (pg) => pg.evaluate(() => document.body.innerText);
  const cap = (pg, nome) => pg.screenshot({ path: path.join(saida, nome + ".png"), fullPage: true });
  const capEl = (pg, sel, nome) => pg.locator(sel).first().screenshot({ path: path.join(saida, nome + ".png") });
  const sem = async (pg) => assert.ok(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "sem rolagem horizontal");

  /* 1. visitante: página de vendas */
  let pg = await novaPagina(false);
  await pg.goto(base + "/player/#/", { waitUntil: "networkidle" });
  await pg.waitForSelector("#lpOlharPreco:not(:empty)", { timeout: 8000 });
  let t = await txt(pg);
  for (const x of ["Quer um olhar profissional sobre sua estratégia?", "Receba uma orientação individual de Richard Tsukada por R$ 47,90.", "Conhecer o olhar do treinador", "Uma dúvida sobre seu jogo? Receba meu olhar.", "Orientação individual", "Pagamento único. Sem assinatura.", "Quero o olhar do treinador", "Contempla uma dúvida sobre uma estratégia. Não inclui análise de partidas em vídeo, revisão completa do plano ou encontro ao vivo.", "Escolha sua estratégia", "Envie sua dúvida", "Receba minha orientação", "Posso comprar novamente?", "Qual atendimento faz sentido para você?"]) assert.ok(t.includes(x), "landing: " + x);
  assert.ok(/R\$\s47,90/.test(t) && !/R\$\s?(49|50)([^0-9,]|$)/.test(t.replace(/R\$\s?(149|1\.490)/g, "")), "preço 47,90 e nenhum 49/50");
  const ordem = await pg.evaluate(() => { const c = document.querySelectorAll("#lpConsultorias .lp-consul-card h3"); return Array.from(c).map((x) => x.textContent); });
  assert.strictEqual(ordem[0], "Olhar do treinador", "primeira opção da seção de consultorias"); assert.ok(ordem.length >= 5);
  await sem(pg); await capEl(pg, ".lp-olhar-chamada", "01a-landing-chamada"); await capEl(pg, "#lp-olhar", "01b-landing-secao"); await capEl(pg, "#lp-consultorias", "01c-landing-consultorias");
  await pg.click('[data-lp="olhar"]'); await pg.waitForTimeout(600);
  /* clicar em "Quero o olhar do treinador" sem conta: entrar/criar, preservando a intenção */
  await pg.click('#lp-olhar a[href="#/olhar/pedir"]'); await pg.waitForSelector(".ac-pagina");
  assert.ok((await txt(pg)).includes("Você está a um passo do Olhar do treinador"), "intenção preservada na tela de acesso"); assert.strictEqual(await pg.evaluate(() => location.hash), "#/olhar/pedir");
  await cap(pg, "02-acesso-com-intencao");
  await pg.click('.ac-troca a[data-ir="entrar"]'); await pg.waitForSelector("#btAcesso");
  assert.ok((await txt(pg)).includes("Você está a um passo do Olhar do treinador"), "a intenção continua na entrada");
  await pg.fill("#email", "ana@exemplo.com"); await pg.fill("#senha", "senha1234"); await pg.click("#btAcesso");
  await pg.waitForSelector("#fOlhar", { timeout: 8000 }).catch(async (e) => { console.log("TELA:", (await txt(pg)).slice(0, 400), "ERROS:", JSON.stringify(erros)); throw e; });
  assert.strictEqual(await pg.evaluate(() => location.hash), "#/olhar/pedir", "depois do login retoma o fluxo certo");
  await pg.context().close();

  /* 2. conectado: estratégia, consultorias, formulário */
  pg = await novaPagina(true);
  await pg.goto(base + "/player/#/estrategia/plano00001", { waitUntil: "networkidle" });
  await pg.waitForSelector("#olharEstrategia"); await pg.waitForFunction(() => { const e = document.getElementById("olharEstPreco"); return e && !e.hidden; });
  t = await txt(pg); assert.ok(t.includes("Quer meu olhar sobre esta estratégia?") && t.includes("R$ 47,90 · Pagamento único") && t.includes("Enviar minha dúvida"));
  await sem(pg); await cap(pg, "03-estrategia-cartao");
  await pg.goto(base + "/player/#/consultorias", { waitUntil: "networkidle" }); await pg.waitForSelector("#cn-olhar");
  t = await txt(pg); assert.ok(t.includes("Qual atendimento faz sentido para você?") && t.includes("Serviços avulsos, com pagamento por contratação, separados da assinatura da plataforma.") && t.includes("Análise completa + consultoria"));
  assert.strictEqual(await pg.evaluate(() => document.querySelector(".consul-lista .consul-card h2").textContent), "Olhar do treinador", "primeiro produto da área de consultorias");
  await sem(pg); await cap(pg, "04-consultorias");
  await pg.goto(base + "/player/#/olhar", { waitUntil: "networkidle" }); await pg.waitForSelector(".consul-resumo"); await sem(pg); await cap(pg, "05-olhar-pagina");
  await pg.goto(base + "/player/#/inicio", { waitUntil: "networkidle" }); await pg.waitForSelector("#olharInicio .olhar-chamada"); assert.ok((await txt(pg)).includes("Uma dúvida sobre sua estratégia?"));
  await cap(pg, "06-inicio-chamada");

  await pg.goto(base + "/player/#/olhar/pedir/plano00001", { waitUntil: "networkidle" }); await pg.waitForSelector("#fOlhar");
  t = await txt(pg); for (const x of ["Receba o olhar do treinador", "R$ 47,90 · Áudio ou vídeo de 3 a 5 minutos", "Qual estratégia você quer comentar?", "Qual é sua principal dúvida?", "Tem algum detalhe importante?", "Você recebe", "Este atendimento não inclui", "Quero revisar meu plano completo", "Revisar pedido"]) assert.ok(t.includes(x), "form: " + x);
  assert.strictEqual(await pg.inputValue("#olDuvida"), "", "o exemplo é só placeholder"); assert.ok((await pg.getAttribute("#olDuvida", "placeholder")).startsWith("Ex.: Minha estratégia sugere"));
  assert.ok((await txt(pg)).includes("0 de 800 caracteres"));
  await pg.click('#fOlhar button[type=submit]'); assert.ok(await pg.isVisible("#olDuvidaE"), "dúvida obrigatória"); await cap(pg, "07-form-erro");
  await pg.fill("#olDuvida", "curta demais"); await pg.click('#fOlhar button[type=submit]'); assert.ok((await pg.textContent("#olDuvidaE")).includes("30"));
  const DUVIDA = "Minha estratégia sugere atacar a segunda bola, mas tenho medo de errar e acabo apenas devolvendo. Como começar a aplicar?";
  await pg.fill("#olDuvida", DUVIDA); await pg.fill("#olCtx", "Acontece mais nos games decisivos."); assert.ok((await txt(pg)).includes(DUVIDA.length + " de 800 caracteres"));
  await sem(pg); await cap(pg, "08-form-preenchido");
  /* rascunho preservado ao consultar outra oferta e voltar */
  await pg.click('a[href="#/consultorias/revisao-estrategia"]'); await pg.waitForSelector(".consul-resumo"); await pg.goBack(); await pg.waitForSelector("#fOlhar");
  assert.strictEqual(await pg.inputValue("#olDuvida"), DUVIDA, "rascunho preservado");
  await pg.click('#fOlhar button[type=submit]'); await pg.waitForSelector("#fRevisao");
  t = await txt(pg); for (const x of ["Revise seu pedido", "Atacar a segunda bola do adversário", DUVIDA, "Acontece mais nos games decisivos.", "Devolutiva em áudio ou vídeo de 3 a 5 minutos", "Até 3 dias úteis", "Pagamento", "Único, sem recorrência", "Entendi que este atendimento contempla uma dúvida e uma devolutiva gravada, sem encontro ao vivo ou análise de partidas em vídeo.", "Continuar para pagamento · R$ 47,90"]) assert.ok(t.includes(x), "revisão: " + x);
  assert.strictEqual(await pg.isChecked("#olAceite"), false, "aceite desmarcado por padrão");
  await sem(pg); await cap(pg, "09-revisao");
  await pg.click("#btOlharPagar"); assert.ok(await pg.isVisible("#olAceiteE"), "exige o aceite");
  assert.strictEqual(Object.keys(store).filter((k) => /^olharPedidos\/[^/]+$/.test(k)).length, 0, "nada criado antes do aceite");
  /* sem checkout configurado: avisa, não simula, mantém o pedido */
  await pg.check("#olAceite"); await pg.click("#btOlharPagar"); await pg.waitForSelector("#olAviso:not([hidden])");
  assert.ok((await pg.textContent("#olAviso")).includes("indisponível")); assert.ok(store["olharPendencias/checkout-nao-configurado"], "pendência registrada para o administrador");
  const ids = Object.keys(store).filter((k) => /^olharPedidos\/[^/]+$/.test(k)); assert.strictEqual(ids.length, 1); assert.strictEqual(store[ids[0]].estado, "aguardando_pagamento"); assert.strictEqual(store[ids[0]].precoCentavos, 4790);
  await cap(pg, "10-pagamento-indisponivel");
  /* com checkout configurado */
  O.CHECKOUT_OLHAR.eduzzProductId = "9990001"; O.CHECKOUT_OLHAR.checkoutUrl = "https://sun.eduzz.com/9990001";
  await pg.click("#btOlharPagar"); await pg.waitForURL("https://sun.eduzz.com/**"); assert.strictEqual(Object.keys(store).filter((k) => /^olharPedidos\/[^/]+$/.test(k)).length, 1, "tentar de novo não duplica o pedido");
  const pid = ids[0].split("/")[1];
  /* volta ao app: aguardando confirmação (nunca "pago" pelo retorno) */
  await pg.goto(base + "/player/#/olhar/pedido/" + pid, { waitUntil: "networkidle" }); await pg.waitForSelector("#btOlharPagar");
  t = await txt(pg); assert.ok(t.includes("Aguardando a confirmação do pagamento") && !t.includes("Pedido recebido")); await sem(pg); await cap(pg, "11-aguardando-pagamento");
  await pg.goto(base + "/player/#/atendimentos", { waitUntil: "networkidle" }); await pg.waitForSelector(".olhar-item");
  t = await txt(pg); assert.ok(t.includes("Aguardando pagamento") && t.includes("Continuar o pagamento")); await cap(pg, "12-atendimentos-pendente");

  /* 3. webhook da Eduzz confirma */
  assert.strictEqual(await O.processarEventoOlhar(admin.firestore(), { faturaId: "FAT1", email: "ana@exemplo.com", produtoCod: "9990001", aprovado: true, revogar: false }, new Date().toISOString()), true);
  await pg.goto(base + "/player/#/olhar/pedido/" + pid, { waitUntil: "networkidle" }); await pg.waitForFunction(() => /Pedido recebido/.test(document.body.innerText));
  t = await txt(pg); for (const x of ["Sua dúvida foi enviada para Richard. Você poderá acompanhar a entrega por aqui.", "Valor pago", "R$ 47,90", "Devolutiva prevista até", "Acompanhar meu pedido"]) assert.ok(t.includes(x), "recebido: " + x);
  await sem(pg); await cap(pg, "13-pedido-recebido");

  /* 4. painel do Richard (tela real): fila, pedido, envio de arquivo fora e dentro da proposta, publicação */
  const cp = require("child_process"), tmp = fs.mkdtempSync(path.join(require("os").tmpdir(), "olhar-"));
  const gerar = (nome, seg, kbps) => { cp.execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=" + seg, "-c:a", "libopus", "-b:a", kbps + "k", path.join(tmp, nome)]); return path.join(tmp, nome); };
  const curto = gerar("curto.webm", 20, 24), ok = gerar("ok.webm", 240, 16);
  const pp = await novaPagina(false, 1100); pp.on("dialog", (d) => d.accept()); await pp.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await pp.goto(base + "/painel/", { waitUntil: "domcontentloaded" }); await pp.fill("#segredo", "segredo"); await pp.click('#fEntrar button[type=submit]');
  await pp.waitForSelector("#app:not([hidden])"); await pp.goto(base + "/painel/#/olhar", { waitUntil: "domcontentloaded" }); await pp.waitForSelector(".item h3 a");
  t = await txt(pp); assert.ok(t.includes("Olhar do treinador") && t.includes("Ana Souza") && t.includes("Recebido") && t.includes("Prazo"), "fila do painel"); await cap(pp, "13b-painel-fila");
  await pp.click(".item h3 a"); await pp.waitForSelector("#areaDev");
  t = await txt(pp); for (const x of ["Estratégia (copiada na contratação)", "Atacar a segunda bola do adversário", "Ficha do jogador (copiada na contratação)", "Dúvida principal", DUVIDA]) assert.ok(t.toLowerCase().includes(x.toLowerCase()), "detalhe: " + x);
  await pp.setInputFiles("#arqDev", curto); await pp.waitForFunction(() => /Arquivo anexado/.test(document.body.innerText), null, { timeout: 15000 });
  assert.ok((await txt(pp)).includes("fora da proposta de 3 a 5 minutos"), "sinaliza duração fora de 3 a 5 min"); await cap(pp, "13c-painel-detalhe-fora");
  await pp.setInputFiles("#arqDev", ok); await pp.waitForFunction(() => /4 min 0 s/.test(document.body.innerText), null, { timeout: 15000 });
  assert.ok(!(await txt(pp)).includes("A duração está fora da proposta"), "240 s está dentro da proposta"); assert.ok(await pp.locator("audio, video").count() >= 1, "tocador para conferir");
  await pp.fill("#resumoDev", "Teste atacar a segunda bola cruzada no próximo treino.");
  assert.strictEqual(store["olharPedidos/" + pid].estado, "em_analise", "anexar arquivo inicia a análise");
  assert.strictEqual(store["olharPedidos/" + pid].devolutiva, undefined, "nada publicado ainda");
  await pp.click("#btPublicarOl"); await pp.waitForFunction(() => /Devolutiva publicada/.test(document.body.innerText), null, { timeout: 15000 });
  assert.strictEqual(store["olharPedidos/" + pid].estado, "devolutiva_disponivel"); await cap(pp, "13d-painel-publicada"); await pp.context().close();

  /* 5. o jogador recebe e abre a devolutiva */
  await pg.goto(base + "/player/#/inicio", { waitUntil: "networkidle" }); await pg.reload({ waitUntil: "networkidle" }); await pg.waitForSelector("#olharInicio .olhar-nova"); assert.ok((await txt(pg)).includes("Sua orientação chegou")); await cap(pg, "14-inicio-nova");
  await pg.goto(base + "/player/#/atendimentos", { waitUntil: "networkidle" }); await pg.waitForSelector(".olhar-item"); assert.ok((await txt(pg)).includes("Ouvir minha devolutiva")); await cap(pg, "15-atendimentos-entregue");
  await pg.goto(base + "/player/#/olhar/pedido/" + pid, { waitUntil: "networkidle" }); await pg.waitForSelector("#btOlharAbrir");
  t = await txt(pg); for (const x of ["Seu olhar do treinador chegou", "Richard Tsukada", "Resumo de Richard", "Teste atacar a segunda bola", "Nada toca sozinho"]) assert.ok(t.includes(x), "entrega: " + x);
  assert.strictEqual(await pg.locator("audio, video").count(), 0, "não carrega nem toca sozinho");
  await pg.click("#btOlharAbrir"); await pg.waitForSelector(".olhar-midia");
  assert.ok(await pg.evaluate(() => { const a = document.querySelector(".olhar-midia"); return a.controls && !a.autoplay && a.paused; }), "reprodutor com controles, sem autoplay");
  await sem(pg); await cap(pg, "16-devolutiva");
  /* 6. computador */
  await pg.setViewportSize({ width: 1280, height: 900 }); await pg.goto(base + "/player/#/olhar", { waitUntil: "networkidle" }); await pg.waitForSelector(".consul-resumo"); await cap(pg, "17-olhar-computador");

  assert.deepStrictEqual(erros, [], "sem erros de JavaScript: " + JSON.stringify(erros));
  await browser.close(); servidor.close();
  console.log("smoke-olhar: ok (capturas em tests/capturas-olhar/)");
})().catch((e) => { console.error(e); process.exit(1); });
