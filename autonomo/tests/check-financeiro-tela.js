/* Tela do Financeiro no Team Yoda (mty/index.html → TelaFinanceiro), com a function de verdade sobre um Firebase falso:
   preços → salvar → mês recalculado; recebido; visão geral das duas academias; menu só para o dono.
   Usa React/Babel locais (defina CDN_DIR). Rode: node tests/check-financeiro-tela.js [pasta-das-capturas] */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert"), Module = require("module");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("check-financeiro-tela: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const capturas = process.argv[2] || "";

/* Firebase falso com duas academias */
const reg = (data, extra) => Object.assign({ id: "r" + Math.random().toString(36).slice(2, 7), tipo: "sessao", data }, extra);
const banco = {
  "orgs/team-yoda/dados/mty:alunos:v2": [{ id: "a1", nome: "Ana Souza", registros: [reg("2026-11-03", { turma: "Sub-12", registradoPorUid: "p1" })] }, { id: "a2", nome: "Bia Lima", registros: [] },
    { id: "a3", nome: "Caio Reis", professorUid: "p1", professorNome: "Leo", registros: [reg("2026-11-04"), reg("2026-11-11")] }],
  "orgs/team-yoda/dados/mty:turmas:v1": [{ id: "t1", nome: "Sub-12", membros: ["a1", "a2"], professorUid: "p1", professorNome: "Leo" }],
  "orgs/39-ranch/dados/mty:quadras:v1": [{ id: "q1", nome: "Central", faixasPreco: [{ inicio: "06:00", fim: "23:00", preco: "120" }] }],
  "orgs/39-ranch/dados/mty:reservas:v1": [{ id: "r1", quadraId: "q1", data: "2026-11-10", horaInicio: "08:00", horaFim: "10:00" }],
};
const gravados = {};
const doc = (c) => ({ get: async () => { if (c.startsWith("financeiro/")) { const v = gravados[c]; return { exists: !!v, data: () => v }; } const v = banco[c]; return { exists: !!v, data: () => ({ value: JSON.stringify(v) }) }; },
  set: async (v) => { gravados[c] = v; }, collection: (x) => col(c + "/" + x) });
const col = (c) => ({ doc: (d) => doc(c + "/" + d), where: () => ({ get: async () => (c.startsWith("orgs/team-yoda") ? [{ id: "p1", data: () => ({ nome: "Leo" }) }] : []) }) });
const adminFalso = { auth: () => ({ verifyIdToken: async (t) => ({ email: t === "dono" ? "tsukada.richard@gmail.com" : "outro@x.com" }) }), firestore: () => ({ collection: (c) => col(c) }) };
const carregar = Module._load;
Module._load = function (pedido) { if (/_firebase-admin$/.test(pedido)) return { admin: adminFalso, app: () => {} }; return carregar.apply(this, arguments); };
const fin = require(path.join(__dirname, "../../netlify/functions/financeiro.js"));
const posts = [];

const m = { "/r.js": CDN + "/react-18.3.1/package/umd/react.development.js", "/d.js": CDN + "/react-dom-18.3.1/package/umd/react-dom.development.js", "/p.js": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "/c.js": CDN + "/recharts-2.15.4/package/umd/Recharts.js", "/b.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js" };
(async () => {
  const { chromium } = require("/opt/node22/lib/node_modules/playwright");
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const raiz = path.join(__dirname, "..", "..", "mty"), html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
  const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((x) => x[1]).join("\n");
  const corte = ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
  assert(corte > 0, "achou o ponto de montagem do app");
  for (const [email, larg] of [["tsukada.richard@gmail.com", 1100], ["tsukada.richard@gmail.com", 390], ["coord@x.com", 1100]]) {
    const corpo = `async function listaProfessores(){return [];} async function organizacao(){return "team-yoda";} var db=null, auth=null;
window.mtyAuth={usuario:()=>({uid:"u1",email:${JSON.stringify(email)}}),tokenId:async()=>${JSON.stringify(email.startsWith("tsukada") ? "dono" : "outro")}};\n` + ms.slice(0, corte) + `
window.__dono = ehDonoFinanceiro();
ReactDOM.createRoot(document.getElementById("root")).render(<div style={{padding:12}}><TelaFinanceiro /></div>);`;
    const pagina = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><div id=root></div><script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};</script><script src=/sync-listas.js></script><script type="text/babel">${corpo}</script>`;
    const srv = http.createServer((q, r) => { const u = q.url.split("?")[0]; if (u === "/") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(pagina); } if (m[u]) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(m[u])); } const f = path.join(raiz, u); if (f.startsWith(raiz) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(f)); } r.writeHead(404); r.end(); }).listen(0);
    const p = await b.newPage({ viewport: { width: larg, height: 900 } }), erros = [];
    p.on("pageerror", (e) => erros.push(e.message));
    await p.route(/tailwindcss/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
    await p.route(/\.netlify\/functions\/financeiro/, async (rt) => {
      const q = rt.request(), url = new URL(q.url());
      if (q.method() === "POST") posts.push(JSON.parse(q.postData()));
      const r = await fin.handler({ httpMethod: q.method(), headers: q.headers(), queryStringParameters: Object.fromEntries(url.searchParams), body: q.postData() });
      await rt.fulfill({ status: r.statusCode, contentType: "application/json", body: r.body });
    });
    await p.goto("http://localhost:" + srv.address().port + "/");
    await p.waitForFunction(() => window.__dono !== undefined, null, { timeout: 90000 }).catch(() => { throw new Error("não renderizou: " + erros.join(" | ")); });
    if (!email.startsWith("tsukada")) {
      assert.strictEqual(await p.evaluate(() => window.__dono), false, "outro e-mail não é dono (menu some)");
      await p.waitForFunction(() => /só do dono/.test(document.body.innerText), null, { timeout: 15000 });
      console.log("  outro login: menu escondido e o servidor recusa");
      await p.close(); srv.close(); continue;
    }
    assert.strictEqual(await p.evaluate(() => window.__dono), true);
    await p.waitForFunction(() => /novembro de 2026/.test(document.body.innerText) && /Entradas/.test(document.body.innerText), null, { timeout: 20000 });
    let t = await p.evaluate(() => document.body.innerText);
    if (larg === 1100) assert(/Falta preço/.test(t) && /Sub-12/.test(t), "avisa a turma sem preço"); // depois de salvo, o aviso some
    if (larg === 1100) {
      /* preços: turma 400, desconto de 50% para a Bia, pacote do Caio 600, professor por aula */
      await p.click('button:text-is("Preços")');
      await p.fill('input[placeholder="R$ / mês"] >> nth=0', "400");
      await p.click('button:text-is("descontos")'); await p.fill('input[placeholder="desconto"] >> nth=1', "50");
      await p.fill('input[placeholder="Buscar aluno"]', "Caio"); await p.fill('input[placeholder="R$ / mês"] >> nth=1', "600");
      await p.fill('input[placeholder="individual"]', "90"); await p.fill('input[placeholder="turma"]', "120");
      await p.click('button:text-is("+ Despesa fixa")'); await p.fill('input[placeholder="Nome (ex.: aluguel do clube)"]', "Aluguel"); await p.fill('input[placeholder="R$ / mês"] >> nth=2', "1500");
      await p.click('button:text-is("Salvar Team Yoda")');
      await p.waitForFunction(() => /Salvo\./.test(document.body.innerText), null, { timeout: 15000 });
      const cfg = posts[posts.length - 1].config;
      assert.strictEqual(cfg.turmas.t1.preco, 400); assert.strictEqual(cfg.descontos["t1:a2"].valor, 50); assert.strictEqual(cfg.pacotes.a3.preco, 600);
      await p.click('button:text-is("Resumo do mês")'); t = await p.evaluate(() => document.body.innerText);
      assert(/R\$\s*600,00/.test(t) && /R\$\s*1\.200,00/.test(t), "mensalidades 600 (400 + 200) e entradas 1.200");
      /* Leo: 1 aula de turma (120) + 2 individuais (180) = 300; aluguel 1.500 */
      assert(/R\$\s*300,00/.test(t) && /R\$\s*1\.500,00/.test(t), "professor por aula e despesa fixa");
      /* recebido: marca a Ana */
      await p.click('button:text-is("Recebido e pago")'); await p.click("label:has-text('Ana Souza') input"); await p.click('button:text-is("Salvar Team Yoda")');
      await p.waitForFunction(() => /Salvo\./.test(document.body.innerText), null, { timeout: 15000 });
      assert.deepStrictEqual(Object.keys(posts[posts.length - 1].config.meses["2026-11"].recebidos), ["m:t1:a1"]);
      t = await p.evaluate(() => document.body.innerText); assert(/R\$\s*400,00 de R\$\s*1\.200,00/.test(t), "recebido 400 de 1.200");
      /* visão geral: Team Yoda 1.200 + 39 Ranch 240 de quadra */
      await p.click('button:text-is("Visão geral")'); t = await p.evaluate(() => document.body.innerText);
      assert(/39 Ranch Tennis Club/.test(t) && /R\$\s*1\.440,00/.test(t), "visão geral soma as duas academias");
      if (capturas) { fs.mkdirSync(capturas, { recursive: true }); await p.screenshot({ path: path.join(capturas, "financeiro-geral.png"), fullPage: true }); await p.click('button:text-is("Team Yoda")'); await p.waitForTimeout(200); await p.screenshot({ path: path.join(capturas, "financeiro-resumo.png"), fullPage: true }); }
      console.log("  dono: preços salvos, mês recalculado, recebido marcado, visão geral das duas academias");
    } else {
      const largura = await p.evaluate(() => document.documentElement.scrollWidth);
      assert(largura <= 392, "celular: sem rolagem lateral na página (" + largura + " px)");
      if (capturas) { await p.click('button:text-is("Preços")'); await p.waitForTimeout(200); await p.screenshot({ path: path.join(capturas, "financeiro-precos-390.png"), fullPage: true }); }
      console.log("  celular 390 px: sem rolagem lateral");
    }
    assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
    await p.close(); srv.close();
  }
  await b.close();
  console.log("check-financeiro-tela: ok");
})().catch((e) => { console.error(e.message || e); process.exit(1); });
