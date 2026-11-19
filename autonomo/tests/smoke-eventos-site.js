/* Eventos no site e no painel (19/11/2026), no navegador:
   A · site (mty/portal/, 390 px) com a function real sobre um Firestore em memória: a seção Eventos aparece só com evento marcado
       para o site, sem valor nenhum; o formulário confere a idade e a autorização e a inscrição chega com os dados da criança;
   B · painel (TelaEventos real em React/Babel locais): resumo, marcar pagamento, custo, filtro "Em aberto" e a planilha Excel.
   Rode: node tests/smoke-eventos-site.js [pasta-das-capturas] */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const { chromium } = require("playwright");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("smoke-eventos-site: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const XLSX_JS = CDN + "/xlsx-0.18.5/package/dist/xlsx.full.min.js";
const capturas = process.argv[2] || "";
const raiz = path.join(__dirname, "../../mty"), fx = path.join(__dirname, "../../netlify/functions/");
const store = {}; const J = (v) => JSON.parse(JSON.stringify(v));
function docRef(p) { return { id: p.split("/").pop(), path: p, collection: (n) => colRef(p + "/" + n), async get() { const v = store[p]; return { exists: v !== undefined, data: () => J(v) }; }, async set(v) { store[p] = J(v); } }; }
function colRef(p) { return { doc: (id) => docRef(p + "/" + id), where: () => colRef(p), limit: () => colRef(p), async get() { return { docs: [], size: 0, forEach() {} }; } }; }
const admin = { firestore: () => ({ collection: (n) => colRef(n), runTransaction: async (fn) => fn({ get: (r) => r.get(), set: (r, v) => { store[r.path] = J(v); } }) }), auth: () => ({ verifyIdToken: async () => { throw new Error("x"); } }) };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };
require.cache[require.resolve(fx + "_push.js")] = { id: "p", filename: "p", loaded: true, exports: { avisar: async () => null } };
const F = require(fx + "inscricao-torneio-evento.js");
const ano = new Date().getFullYear(), dataEv = ano + "-12-13";
const CHAVE = "orgs/team-yoda/dados/mty:eventos:v1";
store[CHAVE] = { value: JSON.stringify([
  { id: "ev1", nome: "Camp de Fim de Ano Team Yoda", data: dataEv, dataFim: ano + "-12-18", horaInicio: "09:00", horaFim: "12:00", local: "Cooper Tênis", tipo: "clinica", vagas: 20, ativo: true, site: true,
    descricao: "Uma manhã de tênis, jogos e brincadeiras.\nLeve garrafinha e protetor solar.", publico: "Crianças de 8 a 12 anos", idadeMin: 8, idadeMax: 12, valor: 180, cartaz: "/assets/foto-forehand.jpg", convidados: [] },
  { id: "ev2", nome: "Noite social (só no app)", data: dataEv, ativo: true, convidados: [] },
]) };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".json": "application/json" };
const srvSite = http.createServer((q, r) => {
  const u = new URL(q.url, "http://x"); let b = ""; q.on("data", (d) => (b += d));
  q.on("end", async () => {
    if (u.pathname === "/.netlify/functions/inscricao-torneio-evento") { const x = await F.handler({ httpMethod: q.method, headers: q.headers, body: b || null, queryStringParameters: Object.fromEntries(u.searchParams) }); r.writeHead(x.statusCode, x.headers); return r.end(x.isBase64Encoded ? Buffer.from(x.body, "base64") : x.body); }
    if (u.pathname.startsWith("/.netlify/functions/")) { r.writeHead(200, { "content-type": "application/json" }); return r.end("{}"); }
    let rel = decodeURIComponent(u.pathname); if (rel.endsWith("/")) rel += "index.html";
    const f = path.join(raiz, rel);
    if (f.startsWith(raiz) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); return r.end(fs.readFileSync(f)); }
    r.writeHead(404); r.end();
  });
}).listen(0);

/* painel: a TelaEventos real */
const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
const corte = ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const corpo = ms.slice(0, corte) + `
function Host() {
  const [eventos, setEventos] = useState(window.__eventosIniciais);
  window.__eventos = eventos;
  return <div style={{ padding: 12, maxWidth: 760 }}><TelaEventos eventos={eventos} setEventos={setEventos} orgAtual="team-yoda" /></div>;
}
ReactDOM.createRoot(document.getElementById("root")).render(<Host />);`;
const paginaPainel = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><div id=root></div><script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script><script src=/aulas-mes.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};</script><script type="text/babel">${corpo}</script>`;
const LIBS = { "/r.js": CDN + "/react-18.3.1/package/umd/react.development.js", "/d.js": CDN + "/react-dom-18.3.1/package/umd/react-dom.development.js", "/p.js": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "/c.js": CDN + "/recharts-2.15.4/package/umd/Recharts.js", "/b.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js", "/aulas-mes.js": path.join(raiz, "aulas-mes.js") };
const srvPainel = http.createServer((q, r) => { const u = q.url.split("?")[0]; if (u === "/") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(paginaPainel); } if (LIBS[u]) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(LIBS[u])); } r.writeHead(404); r.end(); }).listen(0);

(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox"] });
  const erros = [];
  /* ── A · site ── */
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, (rota) => rota.fulfill({ contentType: /fonts/.test(rota.request().url()) ? "text/css" : "text/javascript", body: "" }));
  const p = await ctx.newPage();
  p.on("pageerror", (e) => erros.push("site: " + e.message));
  await p.goto("http://localhost:" + srvSite.address().port + "/portal/");
  await p.waitForSelector('#eventos:not([hidden]) [data-evento="ev1"]', { timeout: 20000 });
  assert.strictEqual(await p.locator("[data-evento]").count(), 1, "só o evento marcado para o site");
  /* no topo da página, antes da abertura (pedido de 19/11/2026) */
  assert(await p.evaluate(() => { const e = document.getElementById("eventos"), a = document.getElementById("inicio"); return !!(e.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING) && e.getBoundingClientRect().top < 200; }), "eventos no topo, antes da abertura");
  const t = await p.innerText("#eventos");
  assert(/Camp de Fim de Ano Team Yoda/.test(t) && /Crianças de 8 a 12 anos/.test(t) && /Cooper Tênis/.test(t) && /09:00 às 12:00/.test(t) && /13 a 18 de dezembro/.test(t), t);
  assert(!/R\$/.test(await p.content()) && !/R\$|180/.test(t), "nenhum valor na página");
  assert(await p.isVisible('#menuBt') && (await p.locator("[data-link-eventos]").first().getAttribute("hidden")) === null, "link Eventos no menu");
  const sem = await p.evaluate(() => document.documentElement.scrollWidth); assert(sem <= 390, "sem rolagem lateral: " + sem);
  if (capturas) { await p.locator("#eventos").screenshot({ path: path.join(capturas, "site-eventos.png") }); await p.screenshot({ path: path.join(capturas, "site-topo.png") }); }
  await p.click('[data-inscrever="ev1"]');
  const form = p.locator('[data-form-evento="ev1"]');
  await form.locator('[name="nomeContato"]').fill("Maria Souza");
  await form.locator('[name="telefoneContato"]').fill("(11) 98888-7777");
  await form.locator('[name="email"]').fill("maria@exemplo.com");
  await form.locator('[name="criancaNome"]').fill("Lia Souza");
  await form.locator('[name="criancaNascimento"]').fill((ano - 6) + "-03-10");
  await form.locator('input[name="jaAluno"][value="nao"]').check();
  await form.locator('[name="observacoes"]').fill("Alergia a amendoim");
  await form.locator('button[type="submit"]').click();
  assert(/8 a 12 anos/.test(await form.locator(".msg").innerText()), "idade conferida no site");
  await form.locator('[name="criancaNascimento"]').fill((ano - 10) + "-03-10");
  await form.locator('button[type="submit"]').click();
  assert(/autorização/.test(await form.locator(".msg").innerText()), "pede a autorização");
  await form.locator('[name="autorizacao"]').check();
  if (capturas) await p.locator('[data-evento="ev1"]').screenshot({ path: path.join(capturas, "site-form.png") });
  await form.locator('button[type="submit"]').click();
  await p.waitForSelector("[data-inscricao-ok]");
  assert(/Vamos falar com você pelo WhatsApp/.test(await p.innerText("[data-inscricao-ok]")));
  const ev1 = JSON.parse(store[CHAVE].value)[0], insc = ev1.convidados[0];
  assert.deepStrictEqual([insc.nomeContato, insc.criancaNome, insc.jaAluno, insc.observacoes, insc.email, insc.status, insc.pagamento.status], ["Maria Souza", "Lia Souza", "nao", "Alergia a amendoim", "maria@exemplo.com", "confirmado", "pendente"]);
  await ctx.close();

  /* ── B · painel ── */
  const evPainel = JSON.parse(store[CHAVE].value)[0];
  evPainel.convidados.push({ id: "i2", nomeContato: "João Lima", telefoneContato: "11 97777-6666", criancaNome: "Theo Lima", criancaNascimento: (ano - 11) + "-01-20", status: "confirmado", origem: "cliente", vistoPeloStaff: false, pagamento: { status: "pendente" } },
    { id: "i3", nomeContato: "Ana Reis", telefoneContato: "11 96666-5555", criancaNome: "Bia Reis", criancaNascimento: (ano - 9) + "-05-05", status: "espera", origem: "cliente", vistoPeloStaff: false, pagamento: { status: "pendente" } });
  const ctx2 = await b.newContext({ viewport: { width: 1000, height: 1000 }, acceptDownloads: true });
  await ctx2.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx/, (rota) => rota.fulfill({ contentType: "text/javascript", body: fs.readFileSync(XLSX_JS) }));
  await ctx2.route(/tailwindcss/, (rota) => rota.fulfill({ contentType: "text/javascript", body: "" }));
  await ctx2.addInitScript((l) => { window.__eventosIniciais = l; }, [evPainel]);
  const q = await ctx2.newPage();
  q.on("pageerror", (e) => erros.push("painel: " + e.message));
  await q.goto("http://localhost:" + srvPainel.address().port + "/");
  await q.waitForSelector('[data-evento-lista="ev1"]', { timeout: 120000 });
  assert(/3 novas/i.test(await q.innerText('[data-evento-lista="ev1"]')), "inscrições novas na lista");
  await q.click('[data-evento-lista="ev1"]');
  await q.waitForSelector("[data-resumo-financeiro]");
  await q.waitForFunction(() => window.__eventos[0].convidados.every((c) => c.vistoPeloStaff !== false));
  const caixa = (k) => q.innerText('[data-resumo-evento="' + k + '"]');
  assert(/3 \(1 na espera\)/.test(await caixa("inscritos")) && /2 · R\$\s?360,00/.test(await caixa("aberto")) && /R\$\s?0,00/.test(await caixa("recebido")), await q.innerText("[data-resumo-financeiro]"));
  /* Maria pagou (Pix), Theo fica em aberto; custo das camisetas */
  const maria = q.locator('[data-inscricao-evento="' + insc.id + '"]');
  await maria.locator("[data-pagamento-status]").selectOption("pago");
  await maria.locator("select").nth(1).selectOption("Pix");
  await q.fill("[data-custo-desc]", "Camisetas"); await q.fill("[data-custo-valor]", "120,50");
  await q.getByRole("button", { name: "+ Adicionar custo" }).click();
  await q.waitForFunction(() => (window.__eventos[0].custos || []).length === 1);
  assert(/R\$\s?180,00/.test(await caixa("recebido")) && /1 · R\$\s?180,00/.test(await caixa("aberto")) && /R\$\s?120,50/.test(await caixa("custos")) && /R\$\s?59,50/.test(await caixa("resultado")) && /R\$\s?239,50/.test(await caixa("previsto")), await q.innerText("[data-resumo-financeiro]"));
  const pg = (await q.evaluate((id) => window.__eventos[0].convidados.find((c) => c.id === id).pagamento, insc.id));
  assert.deepStrictEqual([pg.status, pg.forma, !!pg.data], ["pago", "Pix", true]);
  /* filtro e WhatsApp */
  await q.click('[data-filtro-inscricoes="aberto"]');
  assert.deepStrictEqual(await q.locator("[data-inscricao-evento]").evaluateAll((l) => l.map((x) => x.getAttribute("data-inscricao-evento"))), ["i2"]);
  const zap = decodeURIComponent(await q.getAttribute('[data-inscricao-evento="i2"] [data-zap-inscricao]', "href"));
  assert(/5511977776666/.test(zap) && /Theo Lima/.test(zap) && /R\$\s?180,00/.test(zap), zap);
  if (capturas) { await q.click('[data-filtro-inscricoes="todas"]'); await q.screenshot({ path: path.join(capturas, "painel-evento.png"), fullPage: true }); }
  /* planilha */
  const [dl] = await Promise.all([q.waitForEvent("download"), q.getByRole("button", { name: "Baixar planilha (Excel)" }).click()]);
  const arq = path.join(require("os").tmpdir(), "evento-teste-" + process.pid + ".xlsx"); await dl.saveAs(arq);
  const X = require(CDN + "/xlsx-0.18.5/package");
  const wb = X.read(fs.readFileSync(arq)); fs.unlinkSync(arq);
  assert.deepStrictEqual(wb.SheetNames, ["Resumo", "Inscrições", "Custos"]);
  const linhas = X.utils.sheet_to_json(wb.Sheets["Inscrições"]);
  assert.strictEqual(linhas.length, 3);
  const lia = linhas.find((l) => l["Criança"] === "Lia Souza");
  assert.deepStrictEqual([lia["Pagamento"], lia["Valor pago (R$)"], lia["Forma"], lia["Observações"], lia["Já é aluno"]], ["Pago", 180, "Pix", "Alergia a amendoim", "Não"]);
  const resumo = Object.fromEntries(X.utils.sheet_to_json(wb.Sheets["Resumo"], { header: 1 }));
  assert.deepStrictEqual([resumo["Recebido (R$)"], resumo["Custos (R$)"], resumo["Resultado até agora (R$)"], resumo["Em aberto"]], [180, 120.5, 59.5, 1]);
  assert.deepStrictEqual(erros, [], "erros: " + erros.join(" | "));
  console.log("smoke-eventos-site: ok");
  await b.close(); srvSite.close(); srvPainel.close();
})().catch((e) => { console.error(e.message || e); process.exit(1); });
