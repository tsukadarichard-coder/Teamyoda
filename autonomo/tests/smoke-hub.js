/* Página inicial (QuadraLab Hub): layout sem rolagem lateral em vários tamanhos, menu "Já tenho conta", abas, perguntas, destinos dos botões,
   imagens carregadas, sem setas nos botões e encaminhamento de quem já tem sessão de treinador. Rode: node tests/smoke-hub.js */
const assert = require("assert"), fs = require("fs"), path = require("path"), http = require("http");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const raiz = path.join(__dirname, "..");
const tipos = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".webp": "image/webp", ".png": "image/png", ".json": "application/json" };
/* imita as regras do netlify.toml: "/" mostra o Hub e "/treinador" mostra o app */
const reescreve = { "/": "/hub/index.html", "/treinador": "/index.html" };
const srv = http.createServer((q, r) => {
  let u = decodeURIComponent(q.url.split("?")[0]); u = reescreve[u] || u; if (u.endsWith("/")) u += "index.html";
  const f = path.join(raiz, u);
  if (!f.startsWith(raiz) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end("nao"); }
  r.writeHead(200, { "content-type": tipos[path.extname(f)] || "application/octet-stream" }); r.end(fs.readFileSync(f));
}).listen(0);
const porta = srv.address().port, base = "http://localhost:" + porta;
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const ctx = await b.newContext();
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const p = await ctx.newPage(); const erros = [];
  p.on("pageerror", (e) => erros.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED/.test(m.text())) erros.push("c:" + m.text().slice(0, 160)); });
  for (const w of [360, 390, 768, 1280]) {
    await p.setViewportSize({ width: w, height: 900 }); await p.goto(base + "/"); await p.waitForLoadState("load");
    const sobra = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(sobra <= 0, "rolagem horizontal em " + w + "px: " + sobra);
    const cortado = await p.evaluate(() => [...document.querySelectorAll("img")].filter((i) => i.getBoundingClientRect().right > innerWidth + 1).map((i) => i.alt));
    assert.deepStrictEqual(cortado, [], "imagem cortada em " + w + "px");
  }
  await p.setViewportSize({ width: 390, height: 900 }); await p.goto(base + "/");
  /* destinos */
  const hrefs = await p.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")));
  for (const h of new Set(hrefs)) {
    if (h.startsWith("#")) { assert(await p.evaluate((id) => !!document.getElementById(id), h.slice(1)), "âncora sem destino: " + h); continue; }
    const caminho = h.split("#")[0].split("?")[0]; if (!caminho || caminho === "/") continue;
    const rr = await ctx.request.get(base + caminho); assert.strictEqual(rr.status(), 200, "destino inexistente: " + h);
  }
  const textoBotoes = await p.evaluate(() => [...document.querySelectorAll(".botao, .topo-faixa a, summary")].map((e) => e.textContent).join("|"));
  assert(!/[→›»➜➔]/.test(textoBotoes), "botão com seta");
  /* imagens */
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(600);
  await p.evaluate(async () => { for (const i of document.querySelectorAll("img")) i.loading = "eager"; });
  await p.waitForTimeout(800);
  const semImg = await p.evaluate(() => [...document.querySelectorAll("img")].filter((i) => i.offsetParent !== null && !(i.naturalWidth > 0)).map((i) => i.src));
  assert.deepStrictEqual(semImg, [], "imagens não carregaram");
  /* menu Já tenho conta */
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.click("#btn-entrar"); assert(await p.isVisible("#menu-entrar"), "menu abriu");
  const ent = await p.$$eval("#menu-entrar a", (as) => as.map((a) => [a.textContent, a.getAttribute("href")]));
  assert.deepStrictEqual(ent, [["Entrar no Player", "/player/#/entrar"], ["Entrar no Treinador", "/treinador#entrar"], ["Entrar no Competição", "/competicao/#/entrar"]]);
  await p.keyboard.press("Escape"); assert(!(await p.isVisible("#menu-entrar")), "Esc fecha o menu");
  /* abas */
  assert(await p.isVisible("#painel-player") && !(await p.isVisible("#painel-treinador")));
  await p.click("#aba-treinador"); assert(await p.isVisible("#painel-treinador") && !(await p.isVisible("#painel-player")), "aba Treinador");
  await p.focus("#aba-treinador"); await p.keyboard.press("ArrowRight"); assert(await p.isVisible("#painel-competicao"), "seta troca a aba");
  assert.strictEqual(await p.getAttribute("#aba-competicao", "aria-selected"), "true");
  /* perguntas */
  const d = p.locator("details").first(); await d.locator("summary").click(); assert(await d.evaluate((e) => e.open), "pergunta abre");
  /* sessão de treinador: vai para o app; com ?hub=1 fica */
  const tok = (o) => "x." + Buffer.from(JSON.stringify(o)).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_") + ".y";
  async function comSessao(payload, url) {
    const q = await ctx.newPage();
    await q.addInitScript((t) => { const r = indexedDB.open("firebaseLocalStorageDb", 1); r.onupgradeneeded = () => r.result.createObjectStore("firebaseLocalStorage", { keyPath: "fbase_key" }); r.onsuccess = () => { const tx = r.result.transaction("firebaseLocalStorage", "readwrite"); tx.objectStore("firebaseLocalStorage").put({ fbase_key: "firebase:authUser:k:[DEFAULT]", value: { stsTokenManager: { accessToken: t } } }); }; }, tok(payload));
    await q.goto(base + "/hub/hub.css"); await q.waitForTimeout(700); await q.goto(base + url); await q.waitForTimeout(900);
    const u = new URL(q.url()).pathname + new URL(q.url()).search; if (process.env.DBG) console.log("DBG", await q.evaluate(() => sessionStorage.getItem("ql-hub-ficar")), q.url()); await q.close(); return u;
  }
  assert.strictEqual(await comSessao({ orgId: "o1" }, "/"), "/treinador", "treinador com sessão vai para o app");
  assert.strictEqual(await comSessao({ role: "jogador" }, "/"), "/", "jogador não é desviado");
  assert.strictEqual(await comSessao({ orgId: "o1" }, "/?hub=1"), "/?hub=1", "logotipo mantém no Hub");
  const ctx2 = await b.newContext(); await ctx2.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort()); const v = await ctx2.newPage(); await v.goto(base + "/"); await v.waitForTimeout(600);
  const bancos = await v.evaluate(async () => (await indexedDB.databases()).map((d) => d.name)); await v.close();
  assert(!bancos.includes("firebaseLocalStorageDb"), "o Hub não pode criar o banco do Firebase vazio: " + bancos.join(","));
  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  console.log("smoke-hub: ok"); await b.close(); srv.close();
})().catch((e) => { console.error(e.message || e); process.exit(1); });
