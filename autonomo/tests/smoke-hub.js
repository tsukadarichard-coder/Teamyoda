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
  for (const w of [320, 375, 390, 430, 768, 1280]) {
    await p.setViewportSize({ width: w, height: 900 }); await p.goto(base + "/"); await p.waitForLoadState("load");
    const sobra = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(sobra <= 0, "rolagem horizontal em " + w + "px: " + sobra);
    /* nenhum elemento visível pode passar da tela (sem esconder com overflow no body) */
    const fora = await p.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && e.offsetParent !== null && !e.classList.contains("pular") && !(e.closest("svg") && e.tagName.toLowerCase() !== "svg") && (r.right > innerWidth + 0.5 || r.left < -0.5); }).map((e) => e.tagName + "." + e.className).slice(0, 5));
    assert.deepStrictEqual(fora, [], "elementos fora da tela em " + w + "px");
    if (w < 900) {
      const alt = await p.evaluate(() => document.querySelector(".topo").getBoundingClientRect().height);
      assert(alt >= 56 && alt <= 80, "cabeçalho compacto no celular (" + w + "px): " + alt);
      assert(await p.isVisible("#btn-menu") && await p.isVisible("#btn-entrar") && !(await p.isVisible(".topo-nav")), "cabeçalho do celular: logo, Entrar e menu");
      const logo = await p.evaluate(() => { const i = document.querySelector(".topo-logo img").getBoundingClientRect(); return i.width / i.height; });
      assert(Math.abs(logo - 360 / 115) < 0.05, "proporção do logo preservada: " + logo);
      const f = await p.evaluate(() => ({ h1: parseFloat(getComputedStyle(document.querySelector("h1")).fontSize), h2: parseFloat(getComputedStyle(document.querySelector("#titulo-plataformas")).fontSize), corpo: parseFloat(getComputedStyle(document.querySelector(".abertura .texto")).fontSize), lh: parseFloat(getComputedStyle(document.querySelector(".abertura .texto")).lineHeight) / parseFloat(getComputedStyle(document.querySelector(".abertura .texto")).fontSize) }));
      assert(f.h1 >= 36 && f.h1 <= 40, "título principal 36-42 px em " + w + "px: " + f.h1);
      assert(f.h2 >= 28 && f.h2 <= 32, "títulos de seção 26-30 px em " + w + "px: " + f.h2);
      assert(f.corpo >= 16 && f.corpo <= 18 && f.lh >= 1.45 && f.lh <= 1.55, "texto corrido 16-17 px, entrelinha ~1,6: " + JSON.stringify(f));
      const cab = await p.evaluate(() => { const c = (e) => { const r = document.querySelector(e).getBoundingClientRect(); return [r.top + r.height / 2, r.height, r.width]; }; return { logo: c(".topo-logo img"), entrar: c("#btn-entrar"), menu: c("#btn-menu") }; });
      assert(Math.abs(cab.logo[0] - cab.entrar[0]) <= 2 && Math.abs(cab.entrar[0] - cab.menu[0]) <= 2, "logo, Entrar e menu alinhados: " + JSON.stringify(cab));
      assert(cab.entrar[1] >= 44 && cab.entrar[2] < 90 && cab.logo[2] >= 150, "Entrar compacto com área de toque e logo maior: " + JSON.stringify(cab));
      /* ordem e distâncias da abertura: título, descrição, foto, botão, link */
      const g = await p.evaluate(() => { const r = (q) => document.querySelector(q).getBoundingClientRect(); const h = r("h1"), t = r(".abertura .texto"), f = r(".abertura-foto img"), b = r(".chamadas .botao"), l = r(".chamadas .link"), m = r(".abertura .miolo"); const cs = getComputedStyle(document.querySelector(".abertura .miolo")); return { ht: t.top - h.bottom, tf: f.top - t.bottom, fb: b.top - f.bottom, bl: l.top - b.bottom, ordem: h.top < t.top && t.top < f.top && f.top < b.top && b.top < l.top, razao: f.width / f.height, largura: f.width, conteudo: m.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight), margem: parseFloat(cs.paddingLeft) }; });
      assert(g.ordem, "ordem: título, descrição, foto, botão, link");
      assert(Math.abs(g.ht - 16) <= 2 && Math.abs(g.tf - 24) <= 2 && Math.abs(g.fb - 20) <= 2 && Math.abs(g.bl - 12) <= 14, "distâncias da abertura: " + JSON.stringify(g));
      assert(Math.abs(g.razao - 16 / 9) < 0.05 && Math.abs(g.largura - g.conteudo) < 1, "foto 16:9 na largura do conteúdo: " + JSON.stringify(g));
      assert(g.margem >= 20 && g.margem <= 24, "margens laterais de 20 a 24 px: " + g.margem);
      const primeiro = await p.evaluate(() => document.querySelector(".plat").getBoundingClientRect().top);
      assert(primeiro < 1000, "os produtos aparecem cedo (" + primeiro + ")");
      const aberto = await p.evaluate(() => [...document.querySelectorAll("details.beneficios")].some((d) => d.open));
      assert(!aberto, "benefícios recolhidos no celular");
    } else {
      assert(await p.isVisible(".topo-nav") && !(await p.isVisible("#btn-menu")), "desktop mantém a navegação horizontal");
      assert(await p.isVisible(".abertura-foto img"), "desktop mostra a fotografia ao lado do texto");
      assert(await p.evaluate(() => [...document.querySelectorAll("details.beneficios")].every((d) => d.open)), "benefícios abertos no desktop");
    }
    /* leveza: pesos, espaçamento entre letras, bordas, sombras e botões */
    const leve = await p.evaluate(() => {
      const out = [];
      document.querySelectorAll("body *").forEach((e) => {
        if (e.offsetParent === null) return; const c = getComputedStyle(e), fs = parseFloat(c.fontSize);
        const temTexto = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (temTexto && parseInt(c.fontWeight) > 600 && !/^H[1]$/.test(e.tagName)) out.push("peso " + c.fontWeight + " " + e.tagName + "." + e.className);
        if (temTexto && c.letterSpacing !== "normal" && parseFloat(c.letterSpacing) / fs > 0.02) out.push("tracking " + e.className);
        if (temTexto && c.textTransform === "uppercase") out.push("caixa alta " + e.className);
        if (/\bbotao\b/.test(e.className) && c.boxShadow !== "none") out.push("sombra no botão");
      });
      const h1 = parseInt(getComputedStyle(document.querySelector("h1")).fontWeight); if (h1 > 700) out.push("h1 " + h1);
      document.querySelectorAll(".plat, .produto, .tela").forEach((e) => { const c = getComputedStyle(e); if (Math.max(...["Top", "Right", "Bottom", "Left"].map((l) => parseFloat(c["border" + l + "Width"]))) > 1) out.push("borda grossa " + e.className); if (c.boxShadow !== "none") out.push("sombra " + e.className); });
      document.querySelectorAll(".botao").forEach((e) => { if (e.offsetParent === null) return; const r = e.getBoundingClientRect(), c = getComputedStyle(e); if (r.height < 48 || r.height > 52) out.push("altura do botão " + r.height); const rd = parseFloat(c.borderTopLeftRadius); if (rd < 6 || rd > 8) out.push("raio do botão " + rd); const fz = parseFloat(c.fontSize); if (fz < 15.9 || fz > 16.1) out.push("fonte do botão " + fz); });
      return out;
    });
    assert.deepStrictEqual(leve, [], "excesso de peso visual em " + w + "px");
  }
  /* contraste dos textos cinza (mínimo 4,5:1) */
  const contraste = await p.evaluate(() => {
    const lum = (rgb) => { const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const fundo = (e) => { while (e) { const c = getComputedStyle(e).backgroundColor; if (!/rgba\(0, 0, 0, 0\)|transparent/.test(c)) return c; e = e.parentElement; } return "rgb(250,248,241)"; };
    const ruins = [];
    document.querySelectorAll(".intro, .ident, .desc, .entrada, .aviso-telas, figcaption, .produto-nome, .fechamento p, .institucional p, .pontos li, .rodape .peq, .aba").forEach((e) => { if (e.offsetParent === null) return; const a = lum(getComputedStyle(e).color), b = lum(fundo(e)), r = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); if (r < 4.5) ruins.push(e.className + " " + r.toFixed(2)); });
    return ruins;
  });
  assert.deepStrictEqual(contraste, [], "contraste insuficiente");
  /* menu do celular */
  await p.setViewportSize({ width: 390, height: 844 }); await p.goto(base + "/");
  assert(!(await p.isVisible("#menu-nav")) && (await p.getAttribute("#btn-menu", "aria-expanded")) === "false");
  await p.click("#btn-menu");
  assert(await p.isVisible("#menu-nav") && (await p.getAttribute("#btn-menu", "aria-expanded")) === "true", "menu abre");
  const pos = await p.$$eval("#menu-nav a", (as) => as.map((a) => { const r = a.getBoundingClientRect(); return [a.textContent, Math.round(r.left), Math.round(r.top), Math.round(r.height)]; }));
  assert.deepStrictEqual(pos.map((x) => x[0]), ["Plataformas", "Como funciona", "Dúvidas"]);
  assert(pos[0][1] === pos[1][1] && pos[1][2] > pos[0][2] && pos[2][2] > pos[1][2] && pos.every((x) => x[3] >= 44), "menu vertical com áreas de toque de 44 px");
  await p.keyboard.press("Escape");
  assert(!(await p.isVisible("#menu-nav")) && (await p.getAttribute("#btn-menu", "aria-expanded")) === "false", "Esc fecha o menu");
  assert.strictEqual(await p.evaluate(() => document.activeElement.id), "btn-menu", "foco volta ao botão do menu");
  await p.click("#btn-menu"); await p.click('#menu-nav a[href="#duvidas"]'); await p.waitForTimeout(700);
  assert(!(await p.isVisible("#menu-nav")), "escolher uma seção fecha o menu");
  assert((await p.evaluate(() => document.getElementById("duvidas").getBoundingClientRect().top)) < 200, "a âncora Dúvidas rolou até a seção");
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.click("#btn-menu"); await p.click("#btn-entrar");
  assert(await p.isVisible("#menu-entrar") && !(await p.isVisible("#menu-nav")), "Entrar abre a seleção e fecha o menu de seções");
  await p.keyboard.press("Escape");
  /* botão principal rola até os três produtos */
  await p.evaluate(() => window.scrollTo(0, 0)); await p.click(".chamadas .botao"); await p.waitForTimeout(800);
  assert((await p.evaluate(() => document.getElementById("plataformas").getBoundingClientRect().top)) < 120, "Conheça as plataformas rola até os produtos");
  const cart = await p.$$eval(".plat", (as) => as.map((a) => [a.querySelector("a.botao").getAttribute("href"), a.textContent.replace(/\s+/g, " ").trim(), a.querySelector(".plat-logo").getAttribute("alt")]));
  assert.deepStrictEqual(cart.map((c) => c[0]), ["/player/", "/treinador", "/competicao/"]);
  assert.deepStrictEqual(cart.map((c) => c[2]), ["QuadraLab Player", "QuadraLab Treinador", "QuadraLab Competição"]);
  assert(/Para jogadores/.test(cart[0][1]) && /Organize suas estratégias, prepare seu jogo e registre suas partidas\./.test(cart[0][1]) && /Conhecer o Player/.test(cart[0][1]), "bloco do Player");
  assert(/Para treinadores/.test(cart[1][1]) && /Planeje os treinos e acompanhe o desenvolvimento de cada aluno\./.test(cart[1][1]) && /Conhecer o Treinador/.test(cart[1][1]), "bloco do Treinador");
  assert(/Para quem compete/.test(cart[2][1]) && /Organize o calendário, prepare seus torneios e acompanhe sua temporada\./.test(cart[2][1]) && /Conhecer o Competição/.test(cart[2][1]), "bloco do Competição");
  assert.strictEqual(await p.textContent("#titulo-plataformas"), "Uma plataforma para cada etapa do seu tênis.");
  assert.strictEqual((await p.textContent(".escolha .intro")).trim(), "Escolha por onde começar.");
  assert.strictEqual(await p.locator(".plat .plat-tela img").count(), 3, "uma captura real por plataforma");
  assert.strictEqual((await p.textContent(".abertura .texto")).trim(), "Estratégia para jogar. Planejamento para ensinar. Acompanhamento para competir.");
  assert.strictEqual(await p.locator(".como-passos li").count(), 3, "três passos em Como funciona");
  assert(!/Academia/i.test(await p.evaluate(() => document.body.innerText)), "sem Academias na página");
  const dim = await p.evaluate(() => [...document.querySelectorAll("img")].filter((i) => !(i.getAttribute("width") > 0 && i.getAttribute("height") > 0)).map((i) => i.src));
  assert.deepStrictEqual(dim, [], "imagens sem width/height");
  const lazy = await p.evaluate(() => ({ hero: document.querySelector(".abertura-foto img").loading, logo: document.querySelector(".topo-logo img").loading, abaixo: [...document.querySelectorAll(".plat img, .produto-foto img, .tela img")].every((i) => i.loading === "lazy") }));
  assert(lazy.hero !== "lazy" && lazy.logo !== "lazy" && lazy.abaixo, "só as imagens abaixo da abertura são adiadas");
  assert.strictEqual(await p.textContent(".chamadas .botao"), "Conheça as plataformas");
  assert.strictEqual((await p.textContent(".chamadas .link")).trim(), "Como funciona");
  assert.strictEqual(await p.locator(".abertura .botao").count(), 1, "um único botão principal na abertura");
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
