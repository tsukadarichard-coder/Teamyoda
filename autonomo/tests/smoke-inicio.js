/* Início do QuadraLab no celular (index.html inteiro, modo local, 390×844): visual revisado e acessível.
   · "Próxima aula" inteira na primeira tela, acima da barra de navegação (com os atalhos Atletas do Competição e Área do aluno);
   · áreas de toque ≥ 44×44, sem rolagem lateral, contraste dos textos ≥ 4,5:1;
   · passos: linha que liga os círculos sai do centro e da base de um e chega ao topo do próximo;
   · com os três passos feitos (na volta ao Início), o card mostra os ✓ e recolhe num aviso compacto; depois não volta sozinho;
   · Mais → Primeiros passos reabre o card; × fecha; barra inferior clara com a aba ativa no verde da marca.
   Usa React/Babel/Tailwind locais (defina CDN_DIR). Rode: node tests/smoke-inicio.js [pasta-das-capturas] */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("smoke-inicio: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const capturas = process.argv[2] || "";
const raiz = path.join(__dirname, "..");
const TW = CDN + "/tw/package/dist/index.global.js";
const EXT = {
  "unpkg.com/react@18": CDN + "/react-18.3.1/package/umd/react.development.js", "unpkg.com/react-dom@18": CDN + "/react-dom-18.3.1/package/umd/react-dom.development.js",
  "unpkg.com/prop-types": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "unpkg.com/recharts": CDN + "/recharts-2.15.4/package/umd/Recharts.js", "babel.min.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js",
};
let html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const versaoNovidades = /NOVIDADES_VERSAO = "([^"]+)"/.exec(html)[1];
/* os dois atalhos só aparecem com conta na nuvem: o teste liga só eles (o resto do app segue no modo local, sem login) */
const NUVEM = 'const nuvem = typeof window !== "undefined" && !!window.mtyAuth;';
assert.strictEqual(html.split(NUVEM).length - 1, 2, "atalhos com nuvem");
html = html.split(NUVEM).join("const nuvem = !!window.__nuvemTeste;");
/* "primeiro planejamento" feito sem gerar um plano de verdade */
const P3 = "const onboardingPasso3 = alunos.some((a) => a.plano);";
assert(html.includes(P3), "passo 3"); html = html.replace(P3, "const onboardingPasso3 = alunos.some((a) => a.plano || a.__planoTeste);");

const dia = new Date().getDay();
const base0 = { lateralidade: "", backhand: "", estagio: "C", nivel: "Y5", objetivosAdulto: [], entrada: {}, plano: null, regPlano: {}, avaliacaoTecnica: {}, objetivoFinal: "",
  marcos: [{ ano: "", marco: "", precisa: "" }], camadas: { tecnico: "", fisico: "", tatico: "", mental: "" }, prioridades: ["saque", "devolucao", "fundo", "rede"], armas: ["fundo"],
  inicio: "", semanas: 18, competicoes: [{ nome: "", data: "" }], historico: [], registros: [], anotacoes: [], adversarios: [], creditosReposicao: [], cadastroConcluido: true };
const NICOLAS = { ...base0, id: "a1", nome: "Nicolas Prado", nascimento: "", horarios: [] };
const PEDRO = { ...base0, id: "a2", nome: "Pedro Lima", nascimento: "2014-03-02", horarios: [{ dia, hora: "23:58" }] };

const srv = http.createServer((q, r) => {
  const u = q.url.split("?")[0];
  if (u === "/" || u === "/index.html") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(html); }
  if (u === "/mty-nuvem.js") { r.writeHead(200, { "content-type": "text/javascript" }); return r.end("/* teste: sem nuvem */"); }
  const f = path.join(raiz, decodeURIComponent(u));
  if (f.startsWith(raiz) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : f.endsWith(".png") ? "image/png" : "application/octet-stream" }); return r.end(fs.readFileSync(f)); }
  r.writeHead(404); r.end();
}).listen(0);
const base = "http://localhost:" + srv.address().port + "/";

/* contraste WCAG entre duas cores CSS (rgb/rgba sobre branco) */
function lum(rgb) { const c = rgb.map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
function razao(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

(async () => {
  const { chromium } = require("/opt/node22/lib/node_modules/playwright");
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  await ctx.route(/^https?:\/\/(?!localhost)/, (rota) => {
    const url = rota.request().url();
    if (/tailwindcss/.test(url)) return rota.fulfill({ contentType: "text/javascript", body: fs.existsSync(TW) ? fs.readFileSync(TW) : "" });
    const k = Object.keys(EXT).find((x) => url.includes(x));
    if (k) return rota.fulfill({ contentType: "text/javascript", body: fs.readFileSync(EXT[k]) });
    if (/fonts\.googleapis|fonts\.gstatic/.test(url)) return rota.fulfill({ contentType: "text/css", body: "" });
    return rota.fulfill({ contentType: "text/javascript", body: "" });
  });
  await ctx.addInitScript(([a, v]) => {
    window.__nuvemTeste = true;
    if (sessionStorage.getItem("__semeado")) return;
    sessionStorage.setItem("__semeado", "1");
    localStorage.setItem("local:mty:alunos:v2", JSON.stringify(a));
    localStorage.setItem("ql-novidades:" + v, "off");
  }, [[NICOLAS, PEDRO], versaoNovidades]);
  const p = await ctx.newPage(); const erros = [];
  p.on("pageerror", (e) => erros.push(e.message));
  const cap = async (n) => { if (capturas) { fs.mkdirSync(capturas, { recursive: true }); await p.screenshot({ path: path.join(capturas, n + ".png") }); } };
  /* a faixa laranja de "Modo local" só existe sem Firebase (nunca no app publicado): fica fora da medida da primeira tela */
  const abrirInicio = async () => { await p.goto(base); await p.waitForSelector("[data-proxima-aula]", { timeout: 120000 }); await p.addStyleTag({ content: "#mty-faixa{display:none!important}" }); await p.waitForTimeout(400); };
  /* novidades (aviso de versão) podem cobrir a tela na primeira visita: fecha se aparecer */
  const fecharNovidades = async () => { const f = p.locator('[role="dialog"] button:has-text("Entendi"), [role="dialog"] button:has-text("Fechar")'); if (await f.count()) { await f.first().click(); await p.waitForTimeout(200); } };

  /* ── 1. primeira dobra, toques, contraste, passos ── */
  await abrirInicio(); await fecharNovidades();
  const m = await p.evaluate(() => {
    const ret = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
    const nav = ret(".mty-bottomnav"), aula = ret("[data-proxima-aula]");
    const visiveis = [...document.querySelectorAll("main.mty-main button, main.mty-main a, .mty-bottomnav button")].filter((e) => {
      const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden" && !e.closest('[aria-hidden="true"]');
    });
    const inicio = [...document.querySelectorAll(".ql-cta, .ql-outline, .ql-icone-btn, .ql-passo-btn, .ql-atalho-btn, .ql-card-cabeca, .mty-bottomnav-item")].filter((e) => e.getBoundingClientRect().height > 0);
    const pequenos = inicio.map((e) => { const r = e.getBoundingClientRect(); return { t: (e.getAttribute("aria-label") || e.textContent).trim().slice(0, 34), w: Math.round(r.width), h: Math.round(r.height) }; }).filter((x) => x.w < 44 || x.h < 44);
    const cor = (e) => getComputedStyle(e).color.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
    const textos = [...document.querySelectorAll(".ql-rotulo, .ql-passo-btn, .ql-pp-card h2, .ql-outline, .ql-atalho-btn > span, .mty-bottomnav-item, [data-proxima-aula] p")].map((e) => ({ t: e.textContent.trim().slice(0, 30), c: cor(e) }));
    const lis = [...document.querySelectorAll(".ql-passo")], alin = [];
    for (let i = 0; i < lis.length - 1; i++) {
      const c = lis[i].querySelector(".ql-passo-circulo").getBoundingClientRect(), prox = lis[i + 1].querySelector(".ql-passo-circulo").getBoundingClientRect();
      const a = getComputedStyle(lis[i], "::after"), li = lis[i].getBoundingClientRect(), topo = li.top + parseFloat(a.top);
      alin.push({ cx: c.left + c.width / 2, lx: li.left + parseFloat(a.left) + parseFloat(a.width) / 2, base: c.bottom, ini: topo, fim: topo + parseFloat(a.height), proxTopo: prox.top });
    }
    const estados = lis.map((l) => l.getAttribute("data-estado"));
    return { navTopo: nav.top, navAlt: nav.height, aulaBase: aula.bottom, rolagem: document.documentElement.scrollWidth - innerWidth, pequenos, textos, alin, estados,
      navCor: getComputedStyle(document.querySelector(".mty-bottomnav")).backgroundColor, ativa: document.querySelector('.mty-bottomnav [aria-current="page"]').textContent.trim(),
      atalhos: [...document.querySelectorAll(".ql-atalho")].map((e) => Math.round(e.getBoundingClientRect().width)), visiveis: visiveis.length };
  });
  console.log("medidas:", JSON.stringify({ navTopo: m.navTopo, navAlt: m.navAlt, aulaBase: m.aulaBase, atalhos: m.atalhos, estados: m.estados }));
  await cap("inicio-01-primeiros-passos");
  assert.deepStrictEqual(m.estados, ["feito", "atual", "pendente"], "passo 1 feito, 2 atual, 3 pendente");
  assert.strictEqual(m.atalhos.length, 2, "os dois atalhos aparecem");
  assert(m.atalhos[0] < 200 && m.atalhos[1] < 200, "atalhos lado a lado: " + m.atalhos);
  assert(m.aulaBase <= m.navTopo, "Próxima aula inteira acima da barra (" + m.aulaBase + " ≤ " + m.navTopo + ")");
  assert(m.navAlt >= 76 && m.navAlt <= 84, "barra com ~80px: " + m.navAlt);
  assert(m.rolagem <= 1, "sem rolagem lateral");
  assert.deepStrictEqual(m.pequenos, [], "áreas de toque ≥ 44×44");
  for (const t of m.textos) assert(razao(t.c, [255, 255, 255]) >= 4.5, "contraste ≥ 4,5:1 em \"" + t.t + "\": " + razao(t.c, [255, 255, 255]).toFixed(2));
  for (const a of m.alin) {
    assert(Math.abs(a.cx - a.lx) < 0.6, "linha no centro do círculo: " + a.cx + " × " + a.lx);
    assert(Math.abs(a.base - a.ini) < 0.6 && Math.abs(a.fim - a.proxTopo) < 0.6, "linha da base de um círculo ao topo do próximo: " + JSON.stringify(a));
  }
  assert(/255, 255, 255/.test(m.navCor), "barra inferior clara: " + m.navCor);
  assert.strictEqual(m.ativa, "Início", "aba ativa");
  const corAtiva = await p.evaluate(() => getComputedStyle(document.querySelector('.mty-bottomnav [aria-current="page"]')).color);
  assert.strictEqual(corAtiva, "rgb(30, 77, 63)", "aba ativa no verde da marca");

  /* foco visível (teclado) no botão principal */
  await p.focus(".ql-cta"); await p.keyboard.press("Shift+Tab"); await p.keyboard.press("Tab");
  const foco = await p.evaluate(() => { const e = document.activeElement; const s = getComputedStyle(e); return e.className + " " + s.outlineStyle + " " + s.outlineWidth; });
  assert(/ql-cta solid 3px/.test(foco), "foco visível no botão principal: " + foco);

  /* atalho aberto ocupa a linha toda */
  await p.click("[data-area-aluno] .ql-atalho-btn");
  const larg = await p.evaluate(() => Math.round(document.querySelector("[data-area-aluno]").getBoundingClientRect().width));
  assert(larg > 300, "Área do aluno aberta ocupa a largura: " + larg);
  await p.click("[data-area-aluno] .ql-atalho-btn");

  /* ── 2. os três passos feitos fora do Início: na volta, ✓ ✓ ✓ e o card recolhe num aviso ── */
  assert.strictEqual(await p.evaluate(() => localStorage.getItem("ql:primeiros-passos-pendente")), "1", "aparelho lembra que viu passos pendentes");
  await p.evaluate(() => {
    const l = JSON.parse(localStorage.getItem("local:mty:alunos:v2"));
    l[0] = { ...l[0], nascimento: "2013-05-10", horarios: [{ dia: 1, hora: "08:00" }], __planoTeste: true };
    localStorage.setItem("local:mty:alunos:v2", JSON.stringify(l));
  });
  await abrirInicio();
  assert.deepStrictEqual(await p.evaluate(() => [...document.querySelectorAll(".ql-passo")].map((l) => l.getAttribute("data-estado"))), ["feito", "feito", "feito"], "os três ✓ antes de recolher");
  await p.waitForSelector("[data-primeiros-passos-concluido]", { timeout: 4000 });
  await p.waitForTimeout(500);
  const rec = await p.evaluate(() => ({ alt: document.querySelector(".ql-pp-casca").getBoundingClientRect().height, aviso: document.querySelector("[data-primeiros-passos-concluido]").innerText }));
  assert.strictEqual(rec.alt, 0, "card recolhido até zero");
  assert(/Configuração concluída/.test(rec.aviso) && /reabrir em Mais/.test(rec.aviso), "aviso compacto: " + rec.aviso);
  await cap("inicio-02-concluido");

  /* na próxima visita não aparece de novo */
  await abrirInicio();
  assert.strictEqual(await p.locator(".ql-pp-casca").count() + await p.locator("[data-primeiros-passos-concluido]").count(), 0, "concluído: nem card nem aviso na volta");

  /* ── 3. Mais → Primeiros passos reabre; × fecha ── */
  await p.click('.mty-bottomnav button:has-text("Mais")');
  await p.click("[data-mais-primeiros-passos]");
  await p.waitForSelector("[data-primeiros-passos]");
  await p.waitForTimeout(1300);
  assert.strictEqual(await p.evaluate(() => document.querySelector(".ql-pp-casca").getAttribute("data-recolhido")), "false", "reaberto pelo Mais não recolhe sozinho");
  await cap("inicio-03-reaberto");
  await p.click('[aria-label="Dispensar orientação de primeiros passos"]');
  await p.waitForTimeout(300);
  assert.strictEqual(await p.locator("[data-primeiros-passos]").count(), 0, "× fecha o card");

  /* ── 4. computador: sem barra inferior, sem rolagem lateral, atalhos lado a lado ── */
  await p.setViewportSize({ width: 1280, height: 900 }); await abrirInicio();
  const d = await p.evaluate(() => ({ nav: getComputedStyle(document.querySelector(".mty-bottomnav")).display, rol: document.documentElement.scrollWidth - innerWidth,
    cta: Math.round(document.querySelector(".ql-cta").getBoundingClientRect().width) }));
  assert.strictEqual(d.nav, "none", "computador sem barra inferior"); assert(d.rol <= 1, "computador sem rolagem lateral");
  await cap("inicio-04-computador");

  assert.deepStrictEqual(erros, [], "sem erro de JS: " + erros.join(" | "));
  console.log("smoke-inicio: ok");
  await b.close(); srv.close();
})().catch((e) => { console.error(e.message || e); process.exit(1); });
