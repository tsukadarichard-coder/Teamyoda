/* Aba "Competição" na ficha do jogador (app do treinador), no navegador (390 px), com a function player-competicao simulada:
   · grátis: cadeado e assinatura; sem atleta ligado: explica como ligar; ligado: temporada, partidas, scouts, preparação, focos e diário
     que o atleta compartilha (áreas não compartilhadas aparecem como tal);
   · devolutiva: o formulário manda tipo, referência e textos para player-competicao e a lista recarrega; apagar pede confirmação.
   Rode: node tests/smoke-competicao-ficha.js [pasta-das-capturas] */
const http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const raiz = path.join(__dirname, ".."), capturas = process.argv[2] || "";
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("smoke-competicao-ficha: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }

const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
const corte = ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const corpo = ms.slice(0, corte) + `function Host() {
  return <div style={{ padding: 16 }}><TelaCompeticaoAtleta aluno={window.__aluno} planoAtual={window.__plano} aoAbrirInicio={() => { window.__inicio = true; }} /></div>;
}
ReactDOM.createRoot(document.getElementById("root")).render(<Host />);`;
const pagina = (plano, aluno) => `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><div id=root></div>
<script src=/__cdn/r.js></script><script src=/__cdn/d.js></script><script src=/__cdn/p.js></script><script src=/__cdn/c.js></script><script src=/__cdn/b.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};window.mtyAuth={usuario:()=>({uid:"prof1"}),tokenId:async()=>"prof1"};window.__plano=${JSON.stringify(plano)};window.__aluno=${JSON.stringify(aluno)};</script>
<script src=/scout/graficos.js></script><script src=/scout/ao-vivo.js></script><script src=/scout/relatorio-jogos.js></script><script src=/scout/movimento-motor.js></script><script src=/scout/evidencias.js></script><script src=/scout/movimento.js></script>
<script type="text/babel">${corpo}</script>`;
const CDNS = { "/__cdn/r.js": "/react-18.3.1/package/umd/react.development.js", "/__cdn/d.js": "/react-dom-18.3.1/package/umd/react-dom.development.js", "/__cdn/p.js": "/prop-types-15.8.1/package/prop-types.min.js", "/__cdn/c.js": "/recharts-2.15.4/package/umd/Recharts.js", "/__cdn/b.js": "/babel-standalone-7.29.9/package/babel.min.js" };

/* o que a function devolve para o vínculo (mesmo formato de player-competicao GET ?ver) */
const devolutivas = [];
const VER = () => ({
  atleta: { nome: "Lia Souza" }, areas: ["perfil", "temporada", "partidas", "treinos"],
  dados: {
    torneios: [{ id: "torneio00001", nome: "Copa Verão", inicio: "2026-11-10", fim: "2026-11-12", cidade: "Campinas", categoria: "16F", estado: "inscrito", prioridade: "A", fase: "proximo", diasParaInicio: 13 },
      { id: "torneio00002", nome: "Aberto de Outono", inicio: "2026-04-01", fim: "2026-04-03", estado: "encerrado", fase: "passado", diasParaInicio: -210 }],
    partidas: [{ id: "partida0002", data: "2026-10-20", resultado: "derrota", placar: "4-6 4-6", adversario: "Carla", torneioId: "torneio00002", rodada: "Final" },
      { id: "partida0001", data: "2026-10-12", resultado: "vitoria", placar: "6-2 6-3", adversario: "Bia" }],
    scouts: [{ id: "sc1", data: "2026-10-20", rotulo: "Lia × Carla", origem: "academia", resumo: { n: 120, pctGanhos: 46 } }],
    focos: [{ id: "f1", texto: "Primeiro saque em 65%", origemRotulo: "Contra Carla · 2026-10-20", status: "aberto" }, { id: "f2", texto: "Resolvido", status: "resolvido" }],
    diario: [{ id: "d1", data: "2026-10-21", texto: "Fiquei nervosa no fim do segundo set.", humor: 2 }],
  },
  diarioPorRegistro: true,
  devolutivas: devolutivas.slice(),
  referencias: { torneios: [{ id: "torneio00001", rotulo: "Copa Verão" }], partidas: [{ id: "partida0002", rotulo: "Contra Carla · 2026-10-20" }] },
});
const posts = [];
const servidor = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x"); let cr = ""; req.on("data", (d) => (cr += d)); await new Promise((r) => req.on("end", r));
  if (u.pathname === "/__t") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return res.end(pagina(u.searchParams.get("plano"), JSON.parse(u.searchParams.get("aluno")))); }
  if (CDNS[u.pathname]) { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(fs.readFileSync(CDN + CDNS[u.pathname])); }
  if (u.pathname === "/.netlify/functions/player-competicao") {
    assert.strictEqual(req.headers.authorization, "Bearer prof1");
    res.writeHead(200, { "content-type": "application/json" });
    if (req.method === "GET") { assert.strictEqual(u.searchParams.get("ver"), "vinc123456"); return res.end(JSON.stringify(VER())); }
    const b = JSON.parse(cr); posts.push(b);
    if (b.acao === "devolutiva") devolutivas.push({ id: "dev" + devolutivas.length, tipo: b.tipo, refId: b.refId, refRotulo: b.tipo === "partida" ? "Contra Carla · 2026-10-20" : "Geral", destaques: b.destaques, melhorar: b.melhorar, foco: b.foco, criadoEm: "2026-10-28T10:00:00Z" });
    if (b.acao === "excluirDevolutiva") devolutivas.splice(devolutivas.findIndex((d) => d.id === b.devolutivaId), 1);
    return res.end(JSON.stringify({ ok: true }));
  }
  const f = path.join(raiz, decodeURIComponent(u.pathname));
  if (!f.startsWith(raiz) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(""); }
  res.writeHead(200, { "content-type": "text/javascript" }); res.end(fs.readFileSync(f));
});
(async () => {
  await new Promise((r) => servidor.listen(0, r)); const base = "http://localhost:" + servidor.address().port;
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const p = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const erros = []; p.on("pageerror", (e) => erros.push(e.message));
  const cap = async (n) => { if (capturas) await p.screenshot({ path: path.join(capturas, n + ".png"), fullPage: true }); };
  const abrir = (plano, aluno) => p.goto(base + "/__t?plano=" + plano + "&aluno=" + encodeURIComponent(JSON.stringify(aluno)));
  const ligado = { id: "j1", nome: "Lia Souza", competicao: { vinculoId: "vinc123456", nome: "Lia Souza" } };

  await abrir("gratis", ligado); await p.waitForSelector('[data-competicao-ficha="bloqueado"]', { timeout: 120000 });
  assert(await p.locator("[data-cadeado=essencial]").count() >= 1, "grátis: cadeado");
  await cap("competicao-ficha-01-gratis");

  await abrir("essencial", { id: "j2", nome: "Rafa" }); await p.waitForSelector('[data-competicao-ficha="sem-vinculo"]', { timeout: 120000 });
  await p.click("text=Ir para o Início"); assert(await p.evaluate(() => window.__inicio), "leva ao Início para ligar");

  await abrir("essencial", ligado); await p.waitForSelector('[data-competicao-ficha="ok"]', { timeout: 120000 });
  let t = await p.evaluate(() => document.body.innerText);
  assert(/Copa Verão/.test(t) && /em 13 dias/.test(t) && /1 torneio\(s\) já disputado/.test(t), "temporada com o próximo torneio");
  assert(/1 vitória e 1 derrota/.test(t) && /Derrota contra Carla · 4-6 4-6/.test(t) && /Aberto de Outono · Final/.test(t), "partidas");
  assert(/46% dos pontos ganhos em 120/.test(t) && /marcado por você/.test(t), "scouts");
  assert(/Primeiro saque em 65%/.test(t) && !/Resolvido/.test(t), "só focos em aberto");
  assert(/Fiquei nervosa/.test(t) && /Só os registros que o atleta escolheu/.test(t), "diário por registro");
  assert(/O atleta não compartilhou esta parte/.test(await p.locator('[data-bloco-comp="estrategias"]').innerText()), "preparação não compartilhada");

  await p.selectOption("[data-form-devolutiva] select >> nth=0", "partida");
  await p.selectOption('[data-form-devolutiva] select[aria-label="Qual"]', "partida0002");
  await p.fill("[data-form-devolutiva] textarea >> nth=0", "Boa agressividade na devolução.");
  await p.fill("[data-form-devolutiva] textarea >> nth=1", "Primeiro saque no fim do set.");
  await p.fill("[data-form-devolutiva] textarea >> nth=2", "Primeiro saque em 65%");
  await p.click("text=Enviar devolutiva");
  await p.waitForSelector("[data-devolutiva]");
  assert.deepStrictEqual(posts[0], { acao: "devolutiva", id: "vinc123456", tipo: "partida", refId: "partida0002", destaques: "Boa agressividade na devolução.", melhorar: "Primeiro saque no fim do set.", foco: "Primeiro saque em 65%", assunto: "", recomendacao: "" });
  t = await p.locator("[data-devolutivas]").innerText();
  assert(/Devolutiva enviada/.test(t) && /Foi bem: Boa agressividade/.test(t), "devolutiva aparece");
  await cap("competicao-ficha-02-atleta");
  p.once("dialog", (d) => d.accept());
  await p.click("[data-devolutiva] >> text=Apagar");
  await p.waitForFunction(() => !document.querySelector("[data-devolutiva]"));
  assert.strictEqual(posts[1].acao, "excluirDevolutiva");
  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  console.log("smoke-competicao-ficha: ok");
  await browser.close(); servidor.close();
})().catch((e) => { console.error(e); servidor.close(); process.exit(1); });
