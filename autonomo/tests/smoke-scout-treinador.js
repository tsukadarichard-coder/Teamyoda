/* Treinador no app Competição: a aba Ao vivo oferece "Marcar o jogo" e o scout abre ligado ao atleta. Rode: node tests/smoke-scout-treinador.js (precisa do Playwright e do Chromium) */
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
const admin = { firestore: () => ({ collection: (n) => colRef(n) }), auth: () => ({ verifyIdToken: async (t) => { if (t !== "tok") throw new Error("x"); return { uid: "tr1", email: "coach@exemplo.com", name: "Coach" }; } }) };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };
/* armazenamento simulado */
const objetos = {};
process.env.ADMIN_SECRET = "segredo";


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

const FIREBASE_STUB = `(function(){var cbs=[],a={currentUser:null,languageCode:"",onAuthStateChanged:function(cb){cbs.push(cb);setTimeout(function(){cb(a.currentUser)},0)},signOut:function(){a.currentUser=null;cbs.forEach(function(c){c(null)});return Promise.resolve()},signInWithEmailAndPassword:function(){a.currentUser={uid:"tr1",email:"coach@exemplo.com",displayName:"Coach",getIdToken:function(){return Promise.resolve("tok")}};cbs.forEach(function(c){c(a.currentUser)});return Promise.resolve()}};
if(window.__LOGADO){a.currentUser={uid:"tr1",email:"coach@exemplo.com",displayName:"Coach",getIdToken:function(){return Promise.resolve("tok")}}}
window.firebase={initializeApp:function(){},auth:function(){return a}};})();`;


(async () => {
  store["jogadores/tr1"] = { nome: "Coach Silva", email: "coach@exemplo.com", competicao: { papel: "treinador" } };
  store["jogadores/at1"] = { nome: "Ana Souza", competicao: { papel: "atleta", nascimento: "2005-01-01" } };
  store["vinculos/vinc000000001"] = { tipo: "treinador", status: "ativo", atletaUid: "at1", atletaNome: "Ana Souza", pessoaUid: "tr1", pessoaNome: "Coach Silva", areas: ["partidas"], criadoEm: "2026-10-01T10:00:00Z" };
  await new Promise((r) => servidor.listen(0, r));
  const base = "http://localhost:" + servidor.address().port;
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const erros = [];
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route("https://www.gstatic.com/firebasejs/**", (r) => r.fulfill({ contentType: "text/javascript", body: r.request().url().includes("app-compat") ? FIREBASE_STUB : "" }));
  const pg = await ctx.newPage(); await pg.addInitScript(() => { window.__LOGADO = true; localStorage.setItem("ql-comp-papel", "treinador"); });
  pg.on("pageerror", (e) => erros.push(e.message));
  await pg.goto(base + "/competicao/#/ao-vivo", { waitUntil: "networkidle" });
  await pg.waitForSelector('a[href$="/marcar"]', { timeout: 8000 });
  assert.ok((await pg.textContent("#aoVivoMarcar")).includes("Marcar o jogo de Ana Souza"), "a aba Ao vivo do treinador mostra o botão de marcar");
  await pg.screenshot({ path: path.join(saida, "scout-treinador-ao-vivo.png") });
  await pg.click('a[href$="/marcar"]'); await pg.waitForSelector("#sfIniciar");
  assert.ok((await pg.textContent("body")).includes("Marque os pontos do jogo"), "texto próprio do treinador");
  await pg.click('[data-ment="antes"][data-mk="conf"][data-mv="4"]');
  await pg.click("#sfIniciar"); await pg.waitForSelector(".sf-cab");
  await pg.click('[data-mjogo="3"]');
  await pg.click('[data-fim="winner_nos"]'); await pg.waitForSelector('[data-bola="1-2"]'); await pg.click('[data-dec="boa"]'); await pg.click('[data-bola="1-2"]');
  await pg.waitForFunction(() => /1 pontos/.test(document.body.innerText) || /\b1\b.*pontos/.test(document.body.innerText));
  await pg.waitForTimeout(1500);
  const vivo = Object.keys(store).filter((k) => /^scoutsAoVivo\//.test(k));
  assert.strictEqual(vivo.length, 1, "o jogo foi aberto ao vivo"); assert.strictEqual(store[vivo[0]].atletaUid, "at1", "ligado ao atleta pelo vínculo");
  for (let k = 0; k < 4; k++) { await pg.click('[data-fim="winner_nos"]'); await pg.waitForSelector('[data-bola="1-2"]'); await pg.click('[data-bola="1-2"]'); await pg.waitForTimeout(450); }
  await pg.waitForSelector(".qa-topo", { timeout: 4000 });
  assert.ok((await pg.textContent(".qa-topo")).includes("seguidos"), "alerta de sequência em tempo real");
  await pg.click(".sf-analise summary"); await pg.waitForSelector(".sf-analise .qa-svg");
  const painel = await pg.textContent(".sf-analise"); assert.ok(painel.includes("Ponto a ponto") && painel.includes("Game a game"), "painel com ponto a ponto e game a game");
  await pg.screenshot({ path: path.join(saida, "analise-ao-vivo.png"), fullPage: true });
  for (let k = 0; k < 20 && JSON.parse(store[vivo[0]].publico).n < 5; k++) await pg.waitForTimeout(400);
  { const pub = JSON.parse(store[vivo[0]].publico);
    assert.strictEqual(pub.mental.antes.conf, 4, "mental antes chegou ao resumo ao vivo");
    assert.strictEqual(pub.mental.jogo[1], 3, "mental do game chegou");
    assert.deepStrictEqual(pub.detalhe.decisoes.boa, { n: 1, g: 1 }, "decisão do ponto chegou");
    assert.deepStrictEqual(pub.detalhe.games[0], { j: 1, n: 5, g: 5, boa: 1, disc: 0, ruim: 0 }, "game a game chegou"); }
  await pg.screenshot({ path: path.join(saida, "scout-treinador-marcando.png") });
  /* Pensamentos antes do jogo: escreve, solta, e nada fica guardado em lugar nenhum */
  await pg.goto(base + "/competicao/#/pensamentos", { waitUntil: "networkidle" }); await pg.waitForSelector("#pensTxt");
  assert.ok(await pg.isDisabled("#pensSoltar"), "sem pensamentos, o botão de soltar fica desligado");
  await pg.fill("#pensTxt", "segredo-muito-especifico-123"); await pg.click("#pensAdd");
  await pg.waitForSelector(".pens-papel"); assert.ok((await pg.textContent(".pens-lista")).includes("segredo-muito-especifico-123"));
  await pg.screenshot({ path: path.join(saida, "pensamentos-papel.png") });
  await pg.click("#pensSoltar"); await pg.waitForSelector(".pens-limpo", { timeout: 6000 });
  const corpo = await pg.textContent("body"); assert.ok(corpo.includes("Cabeça limpa") && !corpo.includes("segredo-muito-especifico-123"), "o pensamento foi apagado da tela");
  await pg.screenshot({ path: path.join(saida, "pensamentos-limpo.png") });
  const guardado = await pg.evaluate(() => JSON.stringify([localStorage, sessionStorage]) + document.cookie);
  assert.ok(!guardado.includes("segredo-muito-especifico-123") && !JSON.stringify(store).includes("segredo-muito-especifico-123"), "nada guardado no aparelho nem no servidor");
  /* Ritual pré-jogo dentro do app: versão curta, intenção só em memória */
  await pg.goto(base + "/competicao/#/ritual", { waitUntil: "networkidle" }); await pg.waitForSelector("#ritCurto");
  await pg.click("#ritCurto"); await pg.waitForSelector("#ritAcao");
  assert.ok((await pg.textContent("h1")).includes("Acalmar"), "versão curta começa em Acalmar");
  await pg.click("#ritPula"); await pg.waitForSelector("#ritIn"); await pg.fill("#ritIn", "olhar a bola até o contato"); await pg.screenshot({ path: path.join(saida, "ritual-intencao.png") });
  await pg.click("#ritPula"); await pg.waitForFunction(() => /Ativar/.test(document.querySelector("h1").textContent));
  await pg.click("#ritPula"); await pg.waitForSelector(".rit-fim");
  assert.ok((await pg.textContent(".rit-int")).includes("olhar a bola até o contato"), "a intenção aparece no fim");
  await pg.screenshot({ path: path.join(saida, "ritual-fim.png") });
  assert.ok(!(await pg.evaluate(() => JSON.stringify([localStorage, sessionStorage]))).includes("olhar a bola"), "a intenção não é guardada");
  /* aba Recomendações: campo aberto para recomendar o que quiser */
  await pg.goto(base + "/competicao/#/recomendacoes", { waitUntil: "networkidle" }); await pg.waitForSelector(".rec-form textarea");
  assert.ok((await pg.textContent("body")).includes("Recomende o que quiser ao seu atleta"));
  await pg.click(".rec-form button[type=submit]"); assert.ok(await pg.isVisible(".rec-aviso"), "recomendação vazia não envia");
  await pg.fill(".rec-form input", "Rotina antes do saque"); await pg.fill(".rec-form textarea", "Leia sobre rotina entre pontos e teste no próximo treino: respirar, escolher o alvo, sacar.");
  await pg.screenshot({ path: path.join(saida, "recomendacoes-treinador.png") });
  await pg.click(".rec-form button[type=submit]"); await pg.waitForSelector("[data-exrec]");
  const rec = Object.keys(store).filter((k) => /^jogadores\/at1\/devolutivas\//.test(k)).map((k) => store[k])[0];
  assert.ok(rec && rec.tipo === "recomendacao" && rec.refRotulo === "Recomendação · Rotina antes do saque" && rec.recomendacao.startsWith("Leia sobre rotina"), "recomendação gravada para o atleta");
  assert.ok((await pg.textContent("body")).includes("Enviadas por você"));
  /* atalho na tela de início: aviso discreto no Início, instruções em Ajuda e suporte */
  await pg.goto(base + "/competicao/#/inicio", { waitUntil: "networkidle" }); await pg.waitForSelector("#cartaoInstalar", { timeout: 8000 });
  assert.ok((await pg.textContent("#cartaoInstalar")).includes("Deixe o app na sua tela de início"));
  await pg.click('#cartaoInstalar a[href="#/ajuda"]'); await pg.waitForSelector("#instalarApp");
  const ti = await pg.textContent("#instalarApp");
  for (const x of ["Atalho na tela de início", "iPhone e iPad (Safari)", "Adicionar à Tela de Início", "Android (Chrome)", "Instalar app", "Computador (Chrome ou Edge)", "Adicionar ao Dock"]) assert.ok(ti.includes(x), "instruções: " + x);
  await pg.screenshot({ path: path.join(saida, "atalho-instrucoes.png"), fullPage: false });
  await pg.goto(base + "/competicao/#/inicio", { waitUntil: "networkidle" }); await pg.waitForSelector("#cartaoInstalar"); await pg.click("#btInstalarDepois");
  await pg.goto(base + "/competicao/#/ajuda"); await pg.goto(base + "/competicao/#/inicio", { waitUntil: "networkidle" }); await pg.waitForTimeout(600);
  assert.strictEqual(await pg.locator("#cartaoInstalar").count(), 0, "depois de dispensar, não volta");
  assert.deepStrictEqual(erros, [], JSON.stringify(erros));
  await browser.close(); servidor.close();
  console.log("smoke-scout-treinador: ok");
})().catch((e) => { console.error(e); process.exit(1); });
