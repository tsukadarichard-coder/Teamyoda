/* O scout montado do vídeo vira um jogo normal no caderno: registroPartidaAuto aceita os pontos, e o relatório do jogo salvo
   (DetalheJogoRegistro → ResumoScout) mostra os "Padrões de jogo" (sequências que deram ponto e erro, velocidade e profundidade)
   lidos das batidas compactas ("seq") nos dois apps.
   Usa React/Babel locais (defina CDN_DIR). Rode: node tests/check-scout-video-caderno.js */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("check-scout-video-caderno: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const V = require("../scout/video-scout.js"), UI = require("../scout/video-scout-ui.js").QLVideoScoutUI, { simularPartida } = require("./sim-partida.js");
/* uma partida simulada passada pelo motor, gravada como o app grava */
const sim = simularPartida({ formato: "1set", semente: 9, maxPontos: 40 });
const ctx = V.calibrar(sim.cantos, { aspecto: sim.aspecto, corA: sim.cores.nos, corB: sim.cores.ele });
const an = sim.segmentos.map((s) => V.analisarPonto(s, ctx)), dec = V.decodificar(an, { formato: "1set", atletaComecaPerto: true });
const pontos = UI.compactar(V.montarScout(an, dec, (k, op) => V.analisarPonto(sim.segmentos[k], ctx, op)));
assert(pontos.length >= 30 && pontos.every((p) => /^[ne]S/.test(p.seq)), "pontos compactos com as batidas");
const P = require("../scout/padroes.js"), pad = P.analisar(pontos);
assert(pad.comBatidas === pontos.length && pad.golpes.some((g) => g.vel), "padrões lidos da forma compacta, com velocidade");

const m = { "/r.js": CDN + "/react-18.3.1/package/umd/react.development.js", "/d.js": CDN + "/react-dom-18.3.1/package/umd/react-dom.development.js", "/p.js": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "/c.js": CDN + "/recharts-2.15.4/package/umd/Recharts.js", "/b.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js" };
(async () => {
  const { chromium } = require("/opt/node22/lib/node_modules/playwright");
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  for (const app of ["mty", "autonomo"]) {
    const raiz = path.join(__dirname, "..", "..", app), html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
    const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((x) => x[1]).join("\n");
    const corte = ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
    const corpo = `async function listaProfessores(){return [];} async function organizacao(){return "demo";} var db=null, auth=null;\n` + ms.slice(0, corte) + `
const PONTOS = ${JSON.stringify(pontos)};
const reg = { ...registroPartidaAuto("pv1", { formato: "1set", saca: "nos", adversario: "Bia" }, PONTOS, null, {}, null), parcialAuto: false, origem: "video" };
const aluno = { id: "a1", nome: "Ana Souza", registros: [reg] };
window.__r = { regPontos: reg.scout.pontos.length };
ReactDOM.createRoot(document.getElementById("root")).render(<DetalheJogoRegistro r={reg} aluno={aluno} alunos={[aluno]} setAlunos={() => {}} />);`;
    const pagina = `<!doctype html><meta charset=utf-8><div id=root></div><script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};</script><script src=/sync-listas.js></script><script src=/scout/graficos.js></script><script src=/scout/padroes.js></script>
<script type="text/babel">${corpo}</script>`;
    const srv = http.createServer((q, r) => { const u = q.url.split("?")[0]; if (u === "/") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(pagina); } if (m[u]) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(m[u])); } const f = path.join(raiz, u); if (f.startsWith(raiz) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(f)); } r.writeHead(404); r.end(); }).listen(0);
    const p = await b.newPage(), erros = [];
    p.on("pageerror", (e) => erros.push(e.message));
    await p.route(/tailwindcss/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
    await p.goto("http://localhost:" + srv.address().port + "/");
    await p.waitForFunction(() => window.__r, null, { timeout: 90000 }).catch(() => { throw new Error(app + ": não renderizou: " + erros.join(" | ")); });
    const r = await p.evaluate(() => window.__r), t = await p.evaluate(() => document.body.innerText);
    assert.strictEqual(r.regPontos, pontos.length, app + ": registro com todos os pontos");
    await p.waitForTimeout(500);
    const t2 = await p.evaluate(() => document.body.innerText);
    assert(/Padrões de jogo/i.test(t2) && /Como os pontos foram ganhos/i.test(t2) && /Velocidade e profundidade de Ana/i.test(t2) && /km\/h/.test(t2), app + ": seção de padrões no relatório do jogo");
    assert.deepStrictEqual(erros, [], app + ": erros de JS: " + erros.join(" | "));
    console.log("  " + app + ": relatório do jogo com padrões · " + pontos.length + " pontos");
    await p.close(); srv.close();
  }
  await b.close();
  console.log("check-scout-video-caderno: ok");
})().catch((e) => { console.error(e.message || e); process.exit(1); });
