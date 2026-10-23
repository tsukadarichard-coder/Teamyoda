/* Central do dono, site separado (central/index.html), com a function de verdade (central.js, servida pelo Team Yoda e
   alcançada por /api/central) sobre um Firebase falso: login (senha errada, outra conta, dono), números automáticos, tarefa digitada tecla a tecla (o campo não perde o foco), compromisso na agenda,
   revisão semanal virando tarefas, notas e gravação automática. Usa React/Babel locais (defina CDN_DIR).
   Rode: node tests/check-central-tela.js [pasta-das-capturas] */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert"), Module = require("module");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("check-central-tela: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const capturas = process.argv[2] || "";
const hoje = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10), ontem = new Date(Date.now() - 27 * 3600000).toISOString().slice(0, 10);
const banco = {
  "orgs/team-yoda/dados/mty:alunos:v2": [{ id: "a1", nome: "Ana", registros: [], pedidosReposicao: [{ status: "pendente" }] }, { id: "a2", nome: "Bia", registros: [] }],
  "orgs/team-yoda/dados/mty:turmas:v1": [{ id: "t1", nome: "Sub-12", membros: ["a1", "a2"] }],
  "orgs/team-yoda/dados/mty:ocorrencias:v1": [{ id: "o1", data: hoje, status: "agendada" }, { id: "o2", data: ontem, status: "agendada" }],
  "orgs/39-ranch/dados/mty:reservas:v1": [{ id: "r1", quadraId: "q1", data: hoje, horaInicio: "08:00", horaFim: "09:00", origem: "cliente" }],
  "orgs/39-ranch/dados/mty:quadras:v1": [{ id: "q1", nome: "Central", faixasPreco: [{ inicio: "06:00", fim: "23:00", preco: "100" }] }],
};
const gravados = {};
const doc = (c) => ({ get: async () => { if (/^(financeiro|central)\//.test(c)) { const v = gravados[c]; return { exists: !!v, data: () => v }; } const v = banco[c]; return { exists: !!v, data: () => ({ value: JSON.stringify(v) }) }; },
  set: async (v) => { gravados[c] = v; }, collection: (x) => col(c + "/" + x) });
const col = (c) => ({ doc: (d) => doc(c + "/" + d), where: () => ({ get: async () => [] }) });
const adminFalso = { auth: () => ({ verifyIdToken: async (t) => ({ email: t === "dono" ? "tsukada.richard@gmail.com" : "outro@x.com" }) }), firestore: () => ({ collection: (c) => col(c) }) };
const carregar = Module._load;
Module._load = function (pedido) { if (/_firebase-admin$/.test(pedido)) return { admin: adminFalso, app: () => {} }; return carregar.apply(this, arguments); };
delete process.env.QUADRALAB_ADMIN_SECRET;
const central = require(path.join(__dirname, "../../netlify/functions/central.js"));
let posts = 0;
const m = { "/r.js": CDN + "/react-18.3.1/package/umd/react.development.js", "/d.js": CDN + "/react-dom-18.3.1/package/umd/react-dom.development.js", "/p.js": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "/c.js": CDN + "/recharts-2.15.4/package/umd/Recharts.js", "/b.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js" };

(async () => {
  const { chromium } = require("/opt/node22/lib/node_modules/playwright");
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const raiz = path.join(__dirname, "..", "..", "central"), pagina = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
  const toml = fs.readFileSync(path.join(raiz, "netlify.toml"), "utf8");
  assert(/from = "\/api\/central"\s+to = "https:\/\/app\.39tennis\.com\.br\/\.netlify\/functions\/central"\s+status = 200/.test(toml), "proxy /api/central → function do Team Yoda");
  /* Firebase falso: senha "certa" entra; o token diz quem é */
  const firebaseFalso = `window.firebase = { apps: [], initializeApp() { this.apps.push(1); }, auth() { return window.__auth; } };
window.__auth = { currentUser: null, cbs: [], onAuthStateChanged(cb) { this.cbs.push(cb); setTimeout(() => cb(this.currentUser), 0); return () => {}; },
  async signInWithEmailAndPassword(e, s) { if (s !== "certa") throw { code: "auth/invalid-credential" }; this.currentUser = { email: e, getIdToken: async () => (e === "tsukada.richard@gmail.com" ? "dono" : "outro") }; this.cbs.forEach((c) => c(this.currentUser)); },
  async signOut() { this.currentUser = null; this.cbs.forEach((c) => c(null)); }, async sendPasswordResetEmail() {} };`;
  const externos = { "react.production.min.js": m["/r.js"], "react-dom.production.min.js": m["/d.js"], "babel.min.js": m["/b.js"] };
  const srv = http.createServer((q, r) => { const u = q.url.split("?")[0]; if (u === "/") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(pagina); } const f = path.join(raiz, u); if (f.startsWith(raiz) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200); return r.end(fs.readFileSync(f)); } r.writeHead(404); r.end(); }).listen(0);
  for (const larg of [1100, 390]) {
    const p = await b.newPage({ viewport: { width: larg, height: 900 } }), erros = [];
    p.on("pageerror", (e) => erros.push(e.message));
    await p.route(/tailwindcss|fonts\.g/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
    await p.route(/firebase-app-compat/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: firebaseFalso }));
    await p.route(/firebase-auth-compat/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
    await p.route(/unpkg\.com/, (r) => { const nome = Object.keys(externos).find((k) => r.request().url().endsWith(k)); return r.fulfill({ status: 200, contentType: "text/javascript", body: fs.readFileSync(externos[nome]) }); });
    await p.route(/\/api\/central$/, async (rt) => {
      const q = rt.request(); if (q.method() === "POST") posts++;
      const r = await central.handler({ httpMethod: q.method(), headers: q.headers(), body: q.postData() });
      await rt.fulfill({ status: r.statusCode, contentType: "application/json", body: r.body });
    });
    await p.goto("http://localhost:" + srv.address().port + "/");
    await p.waitForSelector('input[type="password"]', { timeout: 90000 }).catch(() => { throw new Error("não renderizou o login: " + erros.join(" | ")); });
    const entrar = async (email, senha) => { await p.fill('input[type="email"]', email); await p.fill('input[type="password"]', senha); await p.click('button:text-is("Entrar")'); };
    if (larg === 1100) {
      await entrar("tsukada.richard@gmail.com", "errada");
      await p.waitForFunction(() => /E-mail ou senha não conferem/.test(document.body.innerText), null, { timeout: 5000 });
      await entrar("prof@x.com", "certa");
      await p.waitForFunction(() => /só do dono/.test(document.body.innerText), null, { timeout: 5000 });
      if (capturas) { fs.mkdirSync(capturas, { recursive: true }); }
      await p.click('button:text-is("Sair")');
      await p.waitForSelector('input[type="password"]', { timeout: 5000 });
      console.log("  login: senha errada recusada; outra conta vê só o aviso");
    }
    await entrar("tsukada.richard@gmail.com", "certa");
    await p.waitForFunction(() => /Precisa de você/.test(document.body.innerText), null, { timeout: 90000 }).catch(() => { throw new Error("não renderizou: " + erros.join(" | ")); });
    let t = await p.evaluate(() => document.body.innerText);
    if (larg === 1100) {
      assert(/1 aula\(s\) sem fechar/.test(t) && /1 pedido\(s\) de reposição/.test(t) && /1 reserva\(s\) nova\(s\)/.test(t), "alertas automáticos do Team Yoda e do 39 Ranch");
      assert(/2 jogadores/.test(t) && /R\$\s*100,00/.test(t), "cartões com números automáticos");
      /* tarefa digitada tecla a tecla: se o campo perdesse o foco, ficaria só a primeira letra */
      await p.locator('input[placeholder="Nova tarefa"]').first().pressSequentially("Ligar para o contador", { delay: 15 });
      await p.locator('input[aria-label="Prazo"]').first().fill(hoje);
      await p.locator('select').first().selectOption("39-ranch");
      await p.click('button:text-is("Adicionar")');
      await p.waitForFunction(() => /Ligar para o contador/.test(document.body.innerText) && /Salvo ✓/.test(document.body.innerText), null, { timeout: 15000 });
      assert.strictEqual(gravados["central/dono"].dados.tarefas[0].titulo, "Ligar para o contador", "tarefa gravada inteira");
      assert.strictEqual(gravados["central/dono"].dados.tarefas[0].negocio, "39-ranch");
      /* compromisso de hoje */
      await p.click('button:text-is("+ Compromisso")');
      await p.locator('input[placeholder="Título (ex.: reunião com o clube)"]').pressSequentially("Reunião com o clube", { delay: 15 });
      await p.fill('input[aria-label="Início"]', "10:00");
      await p.click('button:text-is("Salvar")');
      await p.waitForFunction(() => /10:00/.test(document.body.innerText) && /Reunião com o clube/.test(document.body.innerText), null, { timeout: 5000 });
      /* agenda da semana mostra o compromisso e o prazo da tarefa */
      await p.click('button:text-is("Agenda")');
      t = await p.evaluate(() => document.body.innerText);
      assert(/Reunião com o clube/.test(t) && /prazo: Ligar para o contador/.test(t), "agenda da semana");
      /* concluir a tarefa na aba Tarefas */
      await p.click('button:text-is("Tarefas")');
      await p.click('input[aria-label="Concluir Ligar para o contador"]');
      await p.waitForFunction(() => !/Ligar para o contador/.test(document.body.innerText), null, { timeout: 5000 });
      /* revisão semanal: prioridades viram tarefas de alta prioridade */
      await p.click('button:text-is("Revisão semanal")');
      await p.locator('input[placeholder="1."]').pressSequentially("Fechar preços do 39", { delay: 10 });
      await p.fill('input[placeholder="2."]', "Contratar professor");
      await p.click('button:text-is("Concluir revisão e virar as prioridades em tarefas")');
      await p.waitForFunction(() => /Revisão feita ✓/.test(document.body.innerText), null, { timeout: 5000 });
      /* nota de decisão */
      await p.click('button:text-is("Notas e decisões")');
      await p.locator('textarea[placeholder="Ideia, conversa, decisão…"]').pressSequentially("Abrir turma de sábado", { delay: 10 });
      await p.click('label:has-text("é uma decisão") input'); await p.click('button:text-is("Guardar")');
      /* negócios: meta do Alvor digitada */
      await p.click('button:text-is("Negócios")');
      await p.locator('input[placeholder="meta"]').nth(9).pressSequentially("5000", { delay: 10 });
      await p.locator('input[placeholder="realizado"]').first().fill("4200").catch(() => {});
      await p.waitForFunction(() => /Salvo ✓/.test(document.body.innerText), null, { timeout: 15000 });
      await p.waitForTimeout(300);
      const g = gravados["central/dono"].dados;
      assert(g.tarefas.find((x) => x.titulo === "Ligar para o contador").feita, "tarefa concluída gravada");
      assert.deepStrictEqual(g.tarefas.filter((x) => x.prioridade === "alta").map((x) => x.titulo).sort(), ["Contratar professor", "Fechar preços do 39"], "prioridades viraram tarefas");
      assert.strictEqual(g.agenda[0].titulo, "Reunião com o clube"); assert.strictEqual(g.agenda[0].inicio, "10:00");
      assert(g.notas[0].decisao && g.notas[0].texto === "Abrir turma de sábado", "nota de decisão");
      const mes = hoje.slice(0, 7);
      assert.strictEqual(g.negocios.alvor.metas[mes].receita, 5000, "meta do Alvor gravada inteira (sem perder o foco)");
      assert(posts < 15, "gravação agrupada, não uma por tecla (" + posts + ")");
      if (capturas) { fs.mkdirSync(capturas, { recursive: true }); await p.screenshot({ path: path.join(capturas, "central-negocios.png"), fullPage: true }); await p.click('button:text-is("Hoje")'); await p.screenshot({ path: path.join(capturas, "central-hoje.png"), fullPage: true }); }
      console.log("  hoje com alertas e números; tarefa, compromisso, revisão, nota e meta gravados (" + posts + " gravações)");
    } else {
      for (const aba of ["Hoje", "Agenda", "Tarefas", "Negócios", "Revisão semanal", "Notas e decisões"]) {
        await p.click('button:text-is("' + aba + '")');
        const w = await p.evaluate(() => document.documentElement.scrollWidth);
        assert(w <= 392, "celular sem rolagem lateral em " + aba + " (" + w + ")");
      }
      await p.click('button:text-is("Hoje")');
      assert(/Prioridades da semana|Precisa de você/.test(await p.evaluate(() => document.body.innerText)));
      if (capturas) await p.screenshot({ path: path.join(capturas, "central-390.png"), fullPage: true });
      console.log("  celular 390 px: todas as abas cabem na tela");
    }
    assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
    await p.close();
  }
  srv.close(); await b.close();
  console.log("check-central-tela: ok");
})().catch((e) => { console.error(e.message || e); process.exit(1); });
