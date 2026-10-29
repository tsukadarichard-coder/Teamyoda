/* Página da família (scout/?l=<token>): quando a mesma partida passa para outro link, a página segue sozinha para o novo e continua
   atualizando. Rode: node tests/smoke-link-ao-vivo-troca.js */
const assert = require("assert"), fs = require("fs"), path = require("path"), http = require("http");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const raiz = path.join(__dirname, "..");
const A = "a".repeat(32), B = "b".repeat(32);
let versaoB = 3, pedidos = [];
const pub = (n) => ({ aoVivo: true, atleta: "Nicolas", data: "2026-10-29", torneio: "Copa", resultado: "3-2", n, ganhos: Math.floor(n / 2), pctGanhos: 50, serie: [], placar: { sets: [], games: [3, 2], pontos: "15-0", sacador: "atleta" },
  /* o resumo completo, como o servidor publica (sem esses campos a página não desenha) */
  bolas: { pctCurtos: 60, pctMedios: 30, pctLongos: 10, pctAte4: 60 }, numeros: { errosNos: 2, errosDecisao: 1, errosExec: 1, df: 0, aces: 1, winners: 2, errosDele: 3 }, zonas: {}, sinais: [] });
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, "http://x");
  if (u.pathname === "/.netlify/functions/scout-ao-vivo") {
    const t = u.searchParams.get("t"); pedidos.push(t);
    r.writeHead(200, { "content-type": "application/json" });
    if (t === A) return r.end(JSON.stringify({ substituidoPor: B }));
    if (u.searchParams.get("v") === String(versaoB)) return r.end(JSON.stringify({ semMudanca: true, versao: versaoB, aoVivo: true }));
    return r.end(JSON.stringify({ versao: versaoB, publico: pub(versaoB * 4), expiraEm: new Date(Date.now() + 3600e3).toISOString() }));
  }
  const f = path.join(raiz, decodeURIComponent(u.pathname.endsWith("/") ? u.pathname + "index.html" : u.pathname));
  if (!f.startsWith(raiz) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "content-type": f.endsWith(".html") ? "text/html; charset=utf-8" : f.endsWith(".css") ? "text/css" : "text/javascript" }); r.end(fs.readFileSync(f));
}).listen(0);
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const p = await b.newPage(); const erros = []; p.on("pageerror", (e) => erros.push(e.message));
  await p.goto("http://localhost:" + srv.address().port + "/scout/?l=" + A);
  await p.waitForFunction(() => /AO VIVO/.test(document.body.innerText), null, { timeout: 15000 });
  assert(p.url().endsWith("?l=" + B), "o endereço passou para o link novo: " + p.url());
  assert(pedidos.includes(A) && pedidos.includes(B), "perguntou ao link antigo e seguiu para o novo");
  versaoB = 4; await p.waitForFunction(() => /\b16\b/.test(document.body.innerText), null, { timeout: 12000 });
  assert.deepStrictEqual(erros, [], "erros de JS " + erros.join(" | "));
  console.log("smoke-link-ao-vivo-troca: ok");
  await b.close(); srv.close();
})().catch((e) => { console.error(e.message || e); process.exit(1); });
