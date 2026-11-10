/* QuadraLab Liberdade (Treinador 2.0 · Etapa 1) no app do treinador inteiro (index.html, modo local, 390×844):
   · onboarding de 6 perguntas no Início (com Pular), depois da Próxima aula, que segue na primeira tela;
   · cartão Minha Liberdade com os quatro números e a sugestão da semana, que abre a Agenda;
   · tela Minha Liberdade pelo Mais: metas, rotina, valor por jogador; tudo gravado em mty:liberdade:v1:local;
   · quem dispensa ("Agora não") não vê mais o onboarding; sem rolagem lateral. Rode: node tests/smoke-liberdade.js [capturas]
   (cabeçalho original do smoke-inicio, de onde vem o servidor:)
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
const CAIO = { ...base0, id: "a3", nome: "Caio Reis", nascimento: "2012-01-01", duracaoPadrao: "1h", horarios: [{ dia: 1, hora: "08:00" }, { dia: 3, hora: "08:00" }, { dia: 5, hora: "19:00" }], criadoEm: "2026-01-01" };

const srv = http.createServer((q, r) => {
  const u = q.url.split("?")[0];
  if (u === "/" || u === "/index.html") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(html); }
  if (u === "/mty-nuvem.js") { r.writeHead(200, { "content-type": "text/javascript" }); return r.end("/* teste: sem nuvem */"); }
  const f = path.join(raiz, decodeURIComponent(u));
  if (f.startsWith(raiz) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : f.endsWith(".png") ? "image/png" : "application/octet-stream" }); return r.end(fs.readFileSync(f)); }
  r.writeHead(404); r.end();
}).listen(0);
const base = "http://localhost:" + srv.address().port + "/";


(async () => {
  const { chromium } = require("/opt/node22/lib/node_modules/playwright");
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true });
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
  }, [[NICOLAS, PEDRO, CAIO], versaoNovidades]);
  const p = await ctx.newPage(); const erros = [];
  p.on("pageerror", (e) => erros.push(e.message));
  const cap = async (n, cheia) => { if (capturas) { fs.mkdirSync(capturas, { recursive: true }); await p.screenshot({ path: path.join(capturas, n + ".png"), fullPage: !!cheia }); } };
  const lib = () => p.evaluate(() => JSON.parse(localStorage.getItem("shared:mty:liberdade:v1:local") || "null"));
  await p.goto(base); await p.waitForSelector("[data-proxima-aula]", { timeout: 120000 }); await p.addStyleTag({ content: "#mty-faixa{display:none!important}" });

  /* 1. onboarding no Início, depois da Próxima aula */
  await p.waitForSelector("[data-onboarding-liberdade]");
  const ordem = await p.evaluate(() => { const a = document.querySelector("[data-proxima-aula]"), o = document.querySelector("[data-onboarding-liberdade]"); return !!(a.compareDocumentPosition(o) & Node.DOCUMENT_POSITION_FOLLOWING); });
  assert(ordem, "o onboarding vem depois da Próxima aula");
  await p.locator("[data-onboarding-liberdade]").scrollIntoViewIfNeeded(); await cap("liberdade-1-onboarding");
  const resp = [["16 a 30"], ["40 a 50 h"], ["Pular"], ["R$ 12 mil"], ["30 h"], ["Horários picados"]];
  for (const [r] of resp) await p.locator("[data-onboarding-liberdade] button", { hasText: r }).first().click();
  await p.waitForSelector("[data-cartao-liberdade]");
  let d = await lib();
  assert.strictEqual(d.onboarding.respostas.alunos, 23); assert.strictEqual(d.onboarding.respostas.horasSemana, 45);
  assert.strictEqual(d.onboarding.respostas.rendaMes, undefined, "pulou a renda"); assert.strictEqual(d.metas.rendaLiquida, 12000); assert.strictEqual(d.metas.horasSemana, 30);
  assert.strictEqual(d.fase, "liberdade"); assert(d.base && d.base.data, "linha de base com data");

  /* 2. cartão: quatro números e a sugestão (Caio tem dias com uma aula só) */
  let t = await p.locator("[data-cartao-liberdade]").innerText();
  assert(/Renda/.test(t) && /Tempo/.test(t) && /R\$ por hora/.test(t) && /Qualidade de vida/.test(t), t);
  assert(/pela agenda/.test(t), "horas em quadra vêm da agenda");
  assert(await p.locator("[data-sugestao-liberdade]").count() === 1);
  await p.locator("[data-cartao-liberdade]").scrollIntoViewIfNeeded(); await cap("liberdade-2-cartao");

  /* 3. tela completa pelo Abrir: metas, rotina e valor por jogador gravam */
  await p.locator("[data-cartao-liberdade] button:has-text('Abrir')").click();
  await p.waitForSelector("[data-tela-liberdade]");
  await p.fill("#libPreco", "150"); await p.fill("#libAdm", "6"); await p.fill("#libDesl", "4"); await p.fill("#libCustos", "800"); await p.fill("#libImposto", "6");
  await p.fill('input[aria-label="Valor de Caio Reis"]', "900");
  await p.waitForTimeout(600);
  d = await lib();
  assert.strictEqual(d.rotina.precoAulaMedio, 150); assert.strictEqual(d.rotina.horasDeslocSemana, 4); assert.strictEqual(d.rotina.impostoPct, 6);
  const alunos = await p.evaluate(() => JSON.parse(localStorage.getItem("local:mty:alunos:v2")));
  assert.strictEqual(alunos.find((a) => a.id === "a3").valorMensal, 900, "valor mensal do Caio gravado no jogador");
  t = await p.locator("[data-tela-liberdade]").innerText();
  assert(/líquida/.test(t), "com custos e imposto aparece a renda líquida");
  const largura = await p.evaluate(() => document.documentElement.scrollWidth);
  assert(largura <= 392, "sem rolagem lateral (" + largura + ")");
  await cap("liberdade-3-tela", true);

  /* 4. a ação da sugestão abre a Agenda (sem mudar nada) */
  const antes = JSON.stringify(alunos);
  const bt = p.locator("[data-tela-liberdade] [data-sugestao-liberdade] button");
  if (await bt.count()) { await bt.click(); await p.waitForTimeout(400); }
  assert.strictEqual(JSON.stringify(await p.evaluate(() => JSON.parse(localStorage.getItem("local:mty:alunos:v2")))), antes, "a sugestão não altera a agenda");

  /* 5. outro aparelho/conta: "Agora não" dispensa o onboarding */
  await p.evaluate(() => { localStorage.removeItem("shared:mty:liberdade:v1:local"); });
  await p.reload(); await p.waitForSelector("[data-onboarding-liberdade]", { timeout: 120000 });
  await p.click("[data-onboarding-liberdade] button:has-text('Agora não')");
  await p.waitForTimeout(400); assert.strictEqual(await p.locator("[data-onboarding-liberdade]").count(), 0);
  assert.strictEqual((await lib()).dispensado, true);
  await p.reload(); await p.waitForSelector("[data-proxima-aula]", { timeout: 120000 }); await p.waitForTimeout(600);
  assert.strictEqual(await p.locator("[data-onboarding-liberdade]").count(), 0, "dispensado não volta");

  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  await b.close(); srv.close();
  console.log("smoke-liberdade: ok");
})().catch((e) => { console.error(e.message || e); process.exit(1); });
