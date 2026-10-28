/* Observar jogos (observação rápida de partida) no navegador, 390 px, com os componentes reais do index.html:
   · dois jogos ao mesmo tempo (abas no celular), toques bom/ajustar por fundamento com o placar do momento, nota escrita, tirar um toque;
   · recarregar no meio do jogo não perde nada (fica no aparelho); encerrar cria um registro "observacao" no caderno de cada jogador;
   · plano grátis: gráfico com cadeado; Essencial: gráfico por fundamento; o caderno mostra o registro com resumo e detalhes.
   Rode: node tests/smoke-observar-jogos.js [pasta-das-capturas] */
const http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const raiz = path.join(__dirname, ".."), capturas = process.argv[2] || "";
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("smoke-observar-jogos: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
const corte = ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const corpo = ms.slice(0, corte) + `function Host() {
  const [alunos, setAlunos] = useState(() => { try { return JSON.parse(localStorage.getItem("__alunos")) || window.__ini; } catch (e) { return window.__ini; } });
  useEffect(() => { localStorage.setItem("__alunos", JSON.stringify(alunos)); window.__lista = alunos; }, [alunos]);
  const [caderno, setCaderno] = useState(null);
  const a = caderno && alunos.find((x) => x.id === caderno);
  return <div style={{ padding: 16 }}>{a ? <TelaRegistro aluno={a} alunos={alunos} setAlunos={setAlunos} identidade={{}} planoAtual={window.__plano} />
    : <TelaObservar alunos={alunos} setAlunos={setAlunos} planoAtual={window.__plano} aoVerCaderno={setCaderno} />}</div>;
}
ReactDOM.createRoot(document.getElementById("root")).render(<Host />);`;
const ALUNOS = [{ id: "j1", nome: "Lia Souza", registros: [] }, { id: "j2", nome: "Beto Alves", registros: [] }];
const pagina = (plano) => `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><div id=root></div>
<script src="https://cdn.tailwindcss.com"></script>
<script src=/__cdn/r.js></script><script src=/__cdn/d.js></script><script src=/__cdn/p.js></script><script src=/__cdn/c.js></script><script src=/__cdn/b.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};window.__plano=${JSON.stringify(plano)};window.__ini=${JSON.stringify(ALUNOS)};</script>
<script src=/scout/graficos.js></script><script src=/scout/ao-vivo.js></script><script src=/scout/relatorio-jogos.js></script><script src=/scout/movimento-motor.js></script><script src=/scout/evidencias.js></script><script src=/scout/movimento.js></script>
<script type="text/babel">${corpo}</script>`;
const CDNS = { "/__cdn/r.js": "/react-18.3.1/package/umd/react.development.js", "/__cdn/d.js": "/react-dom-18.3.1/package/umd/react-dom.development.js", "/__cdn/p.js": "/prop-types-15.8.1/package/prop-types.min.js", "/__cdn/c.js": "/recharts-2.15.4/package/umd/Recharts.js", "/__cdn/b.js": "/babel-standalone-7.29.9/package/babel.min.js" };
let plano = "gratis";
const servidor = http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/__t") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return res.end(pagina(plano)); }
  if (CDNS[u.pathname]) { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(fs.readFileSync(CDN + CDNS[u.pathname])); }
  const f = path.join(raiz, decodeURIComponent(u.pathname));
  if (!f.startsWith(raiz) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(""); }
  res.writeHead(200, { "content-type": "text/javascript" }); res.end(fs.readFileSync(f));
});
(async () => {
  await new Promise((r) => servidor.listen(0, r));
  const base = "http://localhost:" + servidor.address().port;
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  /* tailwind do CDN público não é necessário no teste: só as classes md:hidden/hidden importam, e sem ele os dois painéis aparecem */
  await ctx.route("https://cdn.tailwindcss.com/**", (r) => r.fulfill({ contentType: "text/javascript", body: "" }));
  await ctx.route("https://cdn.tailwindcss.com", (r) => r.fulfill({ contentType: "text/javascript", body: "" }));
  const p = await ctx.newPage(); const erros = []; p.on("pageerror", (e) => erros.push(e.message));
  const cap = async (n) => { if (capturas) await p.screenshot({ path: path.join(capturas, n + ".png"), fullPage: true }); };
  const abrir = async () => { await p.goto(base + "/__t"); await p.waitForSelector("[data-observar], [data-observando], [data-observar-salvo]", { timeout: 120000 }); };

  await abrir();
  await p.selectOption('[data-observar-jogador="0"]', "j1"); await p.fill('[aria-label="Adversário do jogo 1"]', "Carla"); await p.fill('[aria-label="Torneio do jogo 1"]', "Copa Verão");
  await p.selectOption('[data-observar-jogador="1"]', "j2");
  assert.strictEqual(await p.locator('[data-observar-jogador="1"] option[value="j1"]').count(), 0, "o mesmo jogador não entra nos dois jogos");
  await cap("observar-01-comecar");
  await p.click("text=Começar a observar"); await p.waitForSelector("[data-observando]");

  const painel = (i) => p.locator("[data-painel-obs]").nth(i);
  await painel(0).locator('input[placeholder="Ex.: 6/4 3/2"]').fill("6/4 2/1");
  await painel(0).locator('[data-toque="saque:ajustar"]').click(); await painel(0).locator('[data-toque="saque:ajustar"]').click();
  await painel(0).locator('[data-toque="fundo:bom"]').click(); await painel(0).locator('[data-toque="mental:bom"]').click();
  await painel(0).locator("textarea").fill("Segundo saque muito curto no 30-30"); await painel(0).locator("select").selectOption("saque"); await painel(0).locator("button:has-text('Anotar')").click();
  await painel(1).locator('[data-toque="devolucao:bom"]').click();
  await painel(0).locator("[data-obs] button").first().click(); /* tira a última (a nota)… */
  let r = await p.evaluate(() => JSON.parse(localStorage.getItem("ql-observar:v1")));
  assert.strictEqual(r.jogos[0].obs.length, 4, "nota tirada"); assert.strictEqual(r.jogos[0].obs[0].placar, "6/4 2/1", "placar vai junto");
  await painel(0).locator("textarea").fill("Segundo saque muito curto no 30-30"); await painel(0).locator("select").selectOption("saque"); await painel(0).locator("button:has-text('Anotar')").click();
  await cap("observar-02-observando");

  /* recarregar no meio do jogo */
  await p.reload(); await p.waitForSelector("[data-observando]", { timeout: 120000 });
  r = await p.evaluate(() => JSON.parse(localStorage.getItem("ql-observar:v1")));
  assert(r.jogos[0].obs.length === 5 && r.jogos[1].obs.length === 1, "nada se perde ao recarregar");

  /* encerrar: registros no caderno; grátis vê o cadeado do gráfico */
  await p.click("text=Encerrar e salvar no caderno"); await p.waitForSelector("[data-observar-salvo]");
  const lista = await p.evaluate(() => window.__lista);
  const reg = lista[0].registros[0];
  assert(reg.tipo === "observacao" && reg.obs.length === 5 && reg.adversario === "Carla" && reg.torneio === "Copa Verão" && lista[1].registros[0].obs.length === 1, "um registro por jogador");
  assert(await p.locator("[data-observar-salvo] [data-cadeado=essencial]").count() >= 1 && !(await p.locator("[data-grafico-observacao]").count()), "grátis: gráfico com cadeado");
  assert.strictEqual(await p.evaluate(() => localStorage.getItem("ql-observar:v1")), null, "rascunho limpo");
  await cap("observar-03-salvo-gratis");

  /* caderno do jogador */
  await p.locator("text=Ver no caderno").first().click(); await p.waitForSelector("[data-caderno-observacao]");
  let t = await p.evaluate(() => document.body.innerText);
  assert(/Observação de partida/.test(t) && /Copa Verão · × Carla · 6\/4 2\/1/.test(t) && /5 observações · 2 bom · 2 ajustar · 1 nota/.test(t), "resumo no caderno");
  await p.click("[data-caderno-observacao] >> text=Ver detalhes");
  assert(/Segundo saque muito curto/.test(await p.evaluate(() => document.body.innerText)), "detalhes com a nota");

  /* Essencial: gráfico liberado */
  plano = "essencial"; await abrir();
  await p.evaluate(() => {}); /* o Host abre na tela de observar; o caderno da Lia mostra o gráfico */
  await p.evaluate(() => { localStorage.removeItem("ql-observar:v1"); });
  await p.goto(base + "/__t"); await p.waitForSelector("[data-observar]");
  /* volta a abrir o caderno pelo atalho do Host */
  await p.evaluate(() => {});
  plano = "essencial";
  await p.selectOption('[data-observar-jogador="0"]', "j1"); await p.click("text=Começar a observar");
  await painel(0).locator('[data-toque="tatico:bom"]').click(); await p.click("text=Encerrar e salvar no caderno");
  await p.waitForSelector("[data-grafico-observacao]");
  await cap("observar-04-salvo-essencial");
  await p.locator("text=Ver no caderno").first().click(); await p.waitForSelector("[data-caderno-observacao]");
  await p.locator("[data-caderno-observacao] >> text=Ver detalhes").first().click();
  await p.waitForSelector("[data-caderno-observacao] [data-grafico-observacao]");
  await cap("observar-05-caderno");
  assert(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "sem rolagem lateral");
  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  console.log("smoke-observar-jogos: ok");
  await browser.close(); servidor.close();
})().catch((e) => { console.error(e); servidor.close(); process.exit(1); });
