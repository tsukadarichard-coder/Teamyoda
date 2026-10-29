/* "Salvar como PDF / Imprimir" no iPhone/iPad: o imprimir do navegador não funciona em página aberta pelo app na tela inicial, então lá o
   botão gera o PDF no aparelho (html2pdf) e oferece Compartilhar/Abrir. Simula o iPhone forçando o modo (Chromium). Rode: node tests/smoke-imprimir-ios.js */
const assert = require("assert"), fs = require("fs"), path = require("path"), http = require("http");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const raiz = path.join(__dirname, "..");
const LIB = process.env.HTML2PDF || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn/html2pdf-0.10.1/package/dist/html2pdf.bundle.min.js";
if (!fs.existsSync(LIB)) { console.log("smoke-imprimir-ios: pulado (sem html2pdf local; defina HTML2PDF)"); process.exit(0); }
assert.strictEqual(fs.readFileSync(path.join(raiz, "imprimir.js"), "utf8"), fs.readFileSync(path.join(raiz, "../mty/imprimir.js"), "utf8"), "cópias iguais");
const pagina = `<!doctype html><meta charset=utf-8><script src=/imprimir.js></script><script src=/scout/movimento-motor.js></script><script src=/scout/movimento.js></script><button id=b>abrir</button>`;
const srv = http.createServer((q, r) => {
  const u = q.url.split("?")[0];
  if (u === "/") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(pagina); }
  if (u === "/lib/html2pdf.js") { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(LIB)); }
  const f = path.join(raiz, decodeURIComponent(u));
  if (!f.startsWith(raiz) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "content-type": "text/javascript" }); r.end(fs.readFileSync(f));
}).listen(0);
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } }); const erros = []; p.on("pageerror", (e) => erros.push(e.message));
  await p.goto("http://localhost:" + srv.address().port + "/");
  await p.evaluate(() => {
    QLImprimir.forcar = true; QLImprimir.LIB = location.origin + "/lib/html2pdf.js";
    document.getElementById("b").onclick = () => {
      const r = QLBiomec.checklist(QLBiomec.sintetico(60, "D"), "D"); r.proporcao = 1.778;
      const w = window.open("", "_blank");
      w.document.write(QLMovimento.relatorioHTML({ resultado: r, golpe: "forehand", emp: "2", dom: "D", fotos: [], logo: "x.png", atleta: "Nicolas" })); w.document.close();
    };
  });
  const [pop] = await Promise.all([p.waitForEvent("popup"), p.click("#b")]);
  await pop.waitForSelector(".nop button");
  await pop.click(".nop button"); /* "Salvar como PDF / Imprimir" */
  await pop.waitForFunction(() => /PDF pronto/.test((document.getElementById("ql-pdf-aviso") || {}).textContent || ""), null, { timeout: 60000 });
  const info = await pop.evaluate(async () => { const b = window.__qlUltimoPDF; const t = new Uint8Array(await b.slice(0, 5).arrayBuffer()); return { n: b.size, tipo: b.type, cab: String.fromCharCode.apply(null, t) }; });
  if (process.env.PDF_SAIDA) fs.writeFileSync(process.env.PDF_SAIDA, Buffer.from(await pop.evaluate(async () => Array.from(new Uint8Array(await window.__qlUltimoPDF.arrayBuffer())))));
  assert(info.cab === "%PDF-" && info.n > 20000, "gerou um PDF de verdade " + JSON.stringify(info));
  assert(await pop.locator("#ql-pdf-abrir").isVisible(), "botão de abrir o PDF");
  assert(await pop.locator(".nop").isVisible(), "os botões do relatório voltam depois de gerar");
  /* fora do iPhone/iPad continua o imprimir do navegador */
  assert.strictEqual(await p.evaluate(() => { QLImprimir.forcar = false; const w = window.open("", "_blank"); const nativo = typeof w.print === "function" && !/gerar/.test(String(w.print)); w.close(); return nativo; }), true, "fora do iOS o imprimir é o do navegador");
  assert.deepStrictEqual(erros, [], "erros de JS " + erros.join(" | "));
  console.log("smoke-imprimir-ios: ok (" + Math.round(info.n / 1024) + " KB)");
  await b.close(); srv.close();
})().catch((e) => { console.error(e.message || e); process.exit(1); });
