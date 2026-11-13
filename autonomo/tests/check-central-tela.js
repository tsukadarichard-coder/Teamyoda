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
  "orgs/team-yoda/dados/mty:ocorrencias:v1": [{ id: "o1", data: hoje, status: "agendada" }, { id: "o2", data: ontem, status: "agendada" }].concat(
    /* aulas dadas, canceladas e marcadas espalhadas para o gráfico dia a dia (não mudam os alertas) */
    [...Array(13).keys()].flatMap((k) => { const d = new Date(Date.now() - 3 * 3600000 - (k + 2) * 86400000).toISOString().slice(0, 10); return [...Array(2 + (k * 7) % 5).keys()].map((n) => ({ id: "r" + k + "-" + n, data: d, status: n === 4 ? "cancelada" : "realizada" })); }),
    [...Array(7).keys()].flatMap((k) => { const d = new Date(Date.now() - 3 * 3600000 + (k + 1) * 86400000).toISOString().slice(0, 10); return [...Array(1 + (k * 3) % 4).keys()].map((n) => ({ id: "f" + k + "-" + n, data: d, status: "agendada" })); })),
  "orgs/39-ranch/dados/mty:reservas:v1": [{ id: "r1", quadraId: "q1", data: hoje, horaInicio: "08:00", horaFim: "09:00", origem: "cliente" }],
  "orgs/39-ranch/dados/mty:quadras:v1": [{ id: "q1", nome: "Central", faixasPreco: [{ inicio: "06:00", fim: "23:00", preco: "100" }] }],
};
const gravados = {};
const doc = (c) => ({ get: async () => { if (/^(financeiro|central|centralAvisos|pushInscricoes|centralAgentes)\//.test(c)) { const v = gravados[c]; return { exists: !!v, data: () => v }; } const v = banco[c]; return { exists: !!v, data: () => ({ value: JSON.stringify(v) }) }; },
  set: async (v) => { gravados[c] = JSON.parse(JSON.stringify(v)); }, create: async (v) => { if (gravados[c]) throw new Error("existe"); gravados[c] = JSON.parse(JSON.stringify(v)); }, delete: async () => { delete gravados[c]; }, collection: (x) => col(c + "/" + x) });
function consulta(c) {
  const f = [], st = {};
  const q = { where: (k, op, v) => { f.push([k, v]); return q; }, orderBy: (k, d) => { st.o = [k, d]; return q; }, limit: (n) => { st.n = n; return q; },
    get: async () => { let l = Object.keys(gravados).filter((k) => k.startsWith(c + "/") && k.slice(c.length + 1).indexOf("/") < 0).map((k) => ({ id: k.slice(c.length + 1), data: () => gravados[k] })).filter((d) => f.every(([k, v]) => d.data()[k] === v));
      if (st.o) l.sort((a, b) => (String(a.data()[st.o[0]]) < String(b.data()[st.o[0]]) ? -1 : 1) * (st.o[1] === "desc" ? -1 : 1)); if (st.n) l = l.slice(0, st.n); return { forEach: (fn) => l.forEach(fn), docs: l }; } };
  return q;
}
const col = (c) => ({ doc: (d) => doc(c + "/" + d), where: (k, op, v) => consulta(c).where(k, op, v), orderBy: (k, d) => consulta(c).orderBy(k, d), get: () => consulta(c).get() });
const adminFalso = { auth: () => ({ verifyIdToken: async (t) => (t === "dono" ? { email: "tsukada.richard@gmail.com", uid: "u-ric" } : t === "adm" ? { email: "adm@x.com", uid: "u-adm" } : { email: "outro@x.com", uid: "u-outro" }) }), firestore: () => ({ collection: (c) => col(c) }) };
const carregar = Module._load;
Module._load = function (pedido) { if (/_firebase-admin$/.test(pedido)) return { admin: adminFalso, app: () => {} }; return carregar.apply(this, arguments); };
delete process.env.QUADRALAB_ADMIN_SECRET;
process.env.PUSH_VAPID_PUBLICA = "BPublicaDeTeste"; process.env.PUSH_VAPID_PRIVADA = "privada";
gravados["financeiro/_acesso"] = { admins: ["adm@x.com"] };
const PUSH = require(path.join(__dirname, "../../netlify/functions/_push.js")), testes = [];
PUSH.enviarPara = async (a, filtro, aviso) => { const n = Object.keys(gravados).filter((k) => k.startsWith("pushInscricoes/") && gravados[k].uid === filtro.uid && gravados[k].app === filtro.app).length; if (n) testes.push({ filtro, aviso }); return { enviados: n, falhas: 0, removidos: 0 }; };
const central = require(path.join(__dirname, "../../netlify/functions/central.js"));
const BG = require(path.join(__dirname, "../../netlify/functions/central-agentes-background.js"));
const iaFalsa = async (sist, msg) => (/Separe o texto/.test(msg) ? { texto: JSON.stringify({ tarefas: [{ titulo: "Ligar para o João", prazo: "", prioridade: "alta", negocio: "team-yoda" }], compromissos: [], observacao: "" }), usage: { input_tokens: 200, output_tokens: 60 } }
  : { texto: "Para fazer hoje:\n- Conversar com a professora sobre as aulas sem registro.", usage: { input_tokens: 4000, output_tokens: 500 } });
global.fetch = async (url, o) => { setTimeout(() => BG._processar({ httpMethod: "POST", headers: o.headers, body: o.body }, { db: adminFalso.firestore(), agoraMs: Date.now(), ia: iaFalsa }).catch((e) => console.error(e)), 300); return { ok: true, status: 202 }; };
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
  async signInWithEmailAndPassword(e, s) { if (s !== "certa") throw { code: "auth/invalid-credential" }; this.currentUser = { email: e, getIdToken: async () => (e === "tsukada.richard@gmail.com" ? "dono" : e === "adm@x.com" ? "adm" : "outro") }; this.cbs.forEach((c) => c(this.currentUser)); },
  async signOut() { this.currentUser = null; this.cbs.forEach((c) => c(null)); }, async sendPasswordResetEmail() {} };`;
  const externos = { "react.production.min.js": m["/r.js"], "react-dom.production.min.js": m["/d.js"], "babel.min.js": m["/b.js"] };
  const srv = http.createServer((q, r) => { const u = q.url.split("?")[0]; if (u === "/") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(pagina); } const f = path.join(raiz, u); if (f.startsWith(raiz) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200); return r.end(fs.readFileSync(f)); } r.writeHead(404); r.end(); }).listen(0);
  for (const larg of [1100, 390]) {
    const p = await b.newPage({ viewport: { width: larg, height: 900 } }), erros = [];
    p.on("pageerror", (e) => erros.push(e.message));
    await p.addInitScript(() => {
      window.PushManager = function () {};
      window.Notification = { permission: "default", requestPermission: async () => { window.Notification.permission = "granted"; return "granted"; } };
      let inscrito = null;
      const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/teste-central", toJSON() { return { endpoint: this.endpoint, keys: { p256dh: "B".repeat(87), auth: "a".repeat(22) } }; }, unsubscribe: async () => { inscrito = null; return true; } };
      const reg = { pushManager: { getSubscription: async () => inscrito, subscribe: async () => (inscrito = sub) } };
      Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { register: async () => reg, ready: Promise.resolve(reg), getRegistration: async () => reg } });
    });
    const TW = CDN + "/tw/package/dist/index.global.js"; // Tailwind local, quando houver, para as capturas saírem como no site
    await p.route(/tailwindcss/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: fs.existsSync(TW) ? fs.readFileSync(TW, "utf8") : "" }));
    await p.route(/fonts\.g/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
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
      await p.waitForFunction(() => /só do Richard e do administrativo/.test(document.body.innerText), null, { timeout: 5000 });
      assert(!/Precisa de você|Implantação/.test(await p.evaluate(() => document.body.innerText)), "outra conta não vê nada");
      await p.click('button:text-is("Sair")'); await p.waitForSelector('input[type="password"]', { timeout: 5000 });
      /* administrativo: a rotina dele (Hoje), viagens, os agentes dele e os avisos; nada da agenda, negócios ou Implantação do Richard */
      await entrar("adm@x.com", "certa");
      await p.waitForFunction(() => /Central · Administrativo/.test(document.body.innerText) && document.querySelector("[data-rotina-adm]"), null, { timeout: 20000 });
      let ta = await p.evaluate(() => document.body.innerText);
      assert(!/Tarefas da Implantação|Precisa de você|Agenda de hoje|Rotina do Head Trainer/.test(ta), "administrativo não vê o que é do Richard: " + ta.slice(0, 300));
      assert(/Expediente: 14:00 às 18:00/.test(ta) && /Depois do expediente, até as 22h/.test(ta), "rotina do dia: " + ta.slice(0, 400));
      const ehUtil = await p.$("[data-parte]");
      if (ehUtil) {
        await p.click('[data-item-adm="d-whats"] input'); await p.waitForFunction(() => /1 de \d+ feitos/.test(document.querySelector("[data-progresso-adm]").innerText), null, { timeout: 10000 });
        assert(Object.values(gravados["central/rotinaAdm"].dias)[0].feitos["d-whats"], "item marcado gravado");
      }
      await p.fill('input[aria-label="Início do expediente"]', "13:00"); await p.click('button:text-is("Mudar o início")');
      await p.waitForFunction(() => /Expediente: 13:00 às 17:00/.test(document.body.innerText), null, { timeout: 10000 });
      if (capturas) { fs.mkdirSync(capturas, { recursive: true }); await p.screenshot({ path: path.join(capturas, "central-adm-hoje.png"), fullPage: true }); }
      await p.click('[data-aba-adm="viagens"]'); await p.waitForSelector("[data-viagens]");
      await p.click('button:text-is("+ Viagem")'); await p.fill('[data-nova-viagem] input[placeholder="Atleta"]', "Lia Souza"); await p.fill('[data-nova-viagem] input[placeholder="Torneio"]', "Copa Sul");
      await p.click('button:text-is("Salvar viagem")'); await p.waitForSelector("[data-viagem]");
      await p.click('[data-viagem] [data-check="inscricao"]'); await p.waitForFunction(() => document.querySelector('[data-viagem] [data-check="inscricao"]').checked, null, { timeout: 10000 });
      assert(gravados["central/rotinaAdm"].viagens[0].inscricao === true, "viagem com inscrição marcada");
      await p.click('[data-aba-adm="agentes"]'); await p.waitForSelector("[data-config-agentes]");
      ta = await p.innerText("[data-agentes]");
      assert(/Resumo do administrativo/.test(ta) && /Faltas e aulas sem registro/.test(ta) && /Viagens/.test(ta) && !/Caixa de entrada|Painel de segunda|Teto do mês/.test(ta), "agentes do administrativo: " + ta.slice(0, 400));
      await p.click('[data-aba-adm="avisos"]'); await p.waitForSelector("[data-estado-avisos=inativo]", { timeout: 10000 });
      ta = await p.evaluate(() => document.body.innerText);
      assert(/Rotina do administrativo/.test(ta) && /Lembretes de pagamento do dia/.test(ta) && /chega na Etapa 4/.test(ta) && !/chega na Etapa 3/.test(ta), "avisos do administrativo");
      await p.click('button:text-is("Ativar neste aparelho")');
      await p.waitForSelector("[data-estado-avisos=ativo]", { timeout: 10000 });
      assert.strictEqual(gravados["pushInscricoes/" + PUSH.idDaInscricao("https://fcm.googleapis.com/fcm/send/teste-central")].papel, "administrativo", "inscrito como administrativo");
      if (capturas) { fs.mkdirSync(capturas, { recursive: true }); await p.screenshot({ path: path.join(capturas, "central-administrativo.png"), fullPage: true }); }
      await p.click('button:text-is("Desligar neste aparelho")'); await p.waitForSelector("[data-estado-avisos=inativo]", { timeout: 10000 });
      if (capturas) { fs.mkdirSync(capturas, { recursive: true }); }
      await p.click('button:text-is("Sair")');
      await p.waitForSelector('input[type="password"]', { timeout: 5000 });
      console.log("  login: senha errada recusada; outra conta vê só o aviso; administrativo com a rotina, viagens, agentes e avisos dele");
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
      /* Implantação: cartão no Hoje, 11 tarefas na ordem, marcar feita e pôr data/hora (salva à parte da agenda) */
      await p.click('button:text-is("Hoje")');
      await p.waitForSelector("[data-cartao-implantacao]");
      assert(/1\. Gravar o áudio de presença/.test(await p.innerText("[data-cartao-implantacao]")), "cartão da Implantação no Hoje");
      await p.click('[data-aba-central="implantacao"]'); await p.waitForSelector("[data-implantacao]");
      let ti = await p.innerText("[data-implantacao]");
      assert(/0 de 11/.test(ti) && /DURANTE A VIAGEM/i.test(ti) && /11\. Começar a Rotina do Head Trainer/.test(ti), ti.slice(0, 400));
      const agendaAntes = JSON.stringify(gravados["central/dono"].dados.agenda);
      await p.click('input[aria-label="Concluir Gravar o áudio de presença para o time."]');
      await p.locator('[data-tarefa-impl="im02"] input[aria-label="Data"]').fill(hoje);
      await p.locator('[data-tarefa-impl="im02"] input[aria-label="Hora"]').fill("14:00");
      await p.waitForFunction(() => /1 de 11/.test(document.body.innerText) && /Salvo ✓/.test(document.body.innerText), null, { timeout: 15000 });
      await p.waitForTimeout(1500);
      const im = gravados["central/implantacao"].tarefas;
      assert(im[0].status === "feito" && im[0].feitoEm === hoje && im[1].data === hoje && im[1].hora === "14:00", JSON.stringify(im.slice(0, 2)));
      assert.strictEqual(JSON.stringify(gravados["central/dono"].dados.agenda), agendaAntes, "a agenda não mudou");
      if (capturas) await p.screenshot({ path: path.join(capturas, "central-implantacao.png"), fullPage: true });
      /* Avisos: ativar, testar, preferências */
      await p.click('[data-aba-central="avisos"]'); await p.waitForSelector("[data-estado-avisos=inativo]", { timeout: 10000 });
      const tv = await p.evaluate(() => document.body.innerText);
      assert(/Tarefas da Implantação com data/.test(tv) && /Resumo da semana/.test(tv) && /Blocos da rotina/.test(tv) && /Agentes com rascunho novo/.test(tv) && /chega na Etapa 4/.test(tv) && !/Rotina do administrativo/.test(tv), "Richard vê os avisos dele");
      await p.click('button:text-is("Ativar neste aparelho")'); await p.waitForSelector("[data-estado-avisos=ativo]", { timeout: 10000 });
      await p.click('button:text-is("Enviar notificação de teste")');
      await p.waitForFunction(() => /Notificação de teste enviada/.test(document.body.innerText), null, { timeout: 10000 });
      assert(testes.length === 1 && testes[0].filtro.uid === "u-ric", "teste só para o Richard");
      await p.click('[data-tipo="resumo"]'); await p.fill("[data-silencio-de]", "21:30");
      await p.click('button:text-is("Salvar preferências")'); await p.waitForFunction(() => /Salvo ✓/.test(document.querySelector("[data-prefs-salvas]").innerText), null, { timeout: 10000 });
      assert(gravados["centralAvisos/u-ric"].tipos.resumo === false && gravados["centralAvisos/u-ric"].silencio.de === "21:30", JSON.stringify(gravados["centralAvisos/u-ric"]));
      if (capturas) await p.screenshot({ path: path.join(capturas, "central-avisos.png"), fullPage: true });
      console.log("  Implantação (cartão, marcar, data e hora) e Avisos (ativar, teste, preferências) gravados à parte da agenda");
      /* Rotina do Head Trainer: CT de 6h, viagem de 3h20, bloco feito, rodízio */
      await p.click('[data-aba-central="hoje"]'); await p.waitForSelector("[data-cartao-rotina]");
      assert(/Semana no CT/.test(await p.innerText("[data-cartao-rotina]")), "cartão da rotina no Hoje");
      await p.click('[data-aba-central="rotina"]'); await p.waitForSelector("[data-rotina]");
      let tr = await p.innerText("[data-rotina]");
      assert(/planejadas/.test(tr) && /6h feitas|0 min/.test(tr) && /Observação de aula desta semana/.test(tr) && /Gestão pelo painel/.test(tr), tr.slice(0, 500));
      await p.click('[data-modo="viagem"]'); await p.waitForFunction(() => document.querySelector('[data-modo="viagem"]').getAttribute("aria-pressed") === "true", null, { timeout: 10000 });
      tr = await p.innerText("[data-rotina]");
      assert(/3h20 planejadas/.test(tr) && /Vitrine do método/.test(tr) && /Descanso protegido/.test(tr), "viagem: " + tr.slice(0, 400));
      await p.click('[data-bloco-rotina="g"] input[type="checkbox"]'); await p.waitForFunction(() => /45 min/.test(document.querySelector("[data-horas]").innerText), null, { timeout: 10000 });
      const segAgora = Object.keys(gravados["central/rotina"].semanas)[0];
      assert(gravados["central/rotina"].semanas[segAgora].modo === "viagem" && gravados["central/rotina"].semanas[segAgora].feitos.g, JSON.stringify(gravados["central/rotina"].semanas));
      await p.click('[data-modo="ct"]'); await p.waitForFunction(() => /6h planejadas/.test(document.querySelector("[data-rotina]").innerText), null, { timeout: 10000 });
      if (capturas) await p.screenshot({ path: path.join(capturas, "central-rotina.png"), fullPage: true });
      /* Agentes: gerar agora, aprovar; caixa de entrada vira tarefa */
      await p.click('[data-aba-central="agentes"]'); await p.waitForSelector("[data-config-agentes]");
      const ta = await p.innerText("[data-agentes]");
      assert(/Painel de segunda/.test(ta) && /toda segunda, às 7h/.test(ta) && !/Resumo do administrativo/.test(ta) && /US\$ 0,00/.test(ta), ta.slice(0, 600));
      await p.locator('[data-config-agentes] button:has-text("Gerar agora")').first().click();
      await p.waitForSelector("[data-preparando]", { timeout: 10000 });
      await p.waitForFunction(() => /Conversar com a professora/.test(document.body.innerText), null, { timeout: 20000 });
      await p.locator('[data-item-agente] button:text-is("Aprovar")').first().click();
      await p.waitForFunction(() => /aprovado/.test(document.querySelector("[data-item-agente]") ? document.querySelector("[data-item-agente]").innerText : ""), null, { timeout: 10000 });
      assert(Object.keys(gravados).some((k) => k.startsWith("centralAgentes/painelSegunda-manual") && gravados[k].estado === "aprovado"), "rascunho aprovado gravado");
      await p.fill("[data-caixa]", "ligar pro João amanhã"); await p.click('button:text-is("Organizar")');
      await p.waitForFunction(() => /Pôr na agenda e nas tarefas/.test(document.body.innerText), null, { timeout: 20000 });
      await p.click('button:text-is("Pôr na agenda e nas tarefas")');
      await p.waitForFunction(() => /entrou na agenda e nas tarefas/.test(document.body.innerText), null, { timeout: 10000 });
      assert(gravados["central/dono"].dados.tarefas.some((t) => t.titulo === "Ligar para o João" && t.prioridade === "alta"), "a caixa de entrada virou tarefa");
      assert(/US\$ 0,0[2-9]/.test(await p.innerText("[data-gasto]")) || gravados["central/agentesConfig"].gasto, "gasto contado");
      if (capturas) await p.screenshot({ path: path.join(capturas, "central-agentes.png"), fullPage: true });
      console.log("  Rotina (CT/viagem, bloco feito) e Agentes (gerar, aprovar, caixa de entrada vira tarefa)");
      /* o Richard vê a rotina do administrativo, sem poder marcar */
      await p.click('[data-aba-central="administrativo"]'); await p.waitForSelector("[data-rotina-adm]");
      const tAdm = await p.innerText("[data-rotina-adm]");
      assert(/quem marca é ele/.test(tAdm) && /Expediente: 13:00 às 17:00/.test(tAdm), tAdm.slice(0, 300));
      assert(await p.evaluate(() => [...document.querySelectorAll("[data-item-adm] input")].every((i) => i.disabled)), "caixinhas travadas para o Richard");
      assert(/Lia Souza · Copa Sul/.test(await p.innerText("[data-viagens]")), "o Richard vê as viagens");
      if (capturas) await p.screenshot({ path: path.join(capturas, "central-ric-administrativo.png"), fullPage: true });
      console.log("  Administrativo: o Richard vê a rotina e as viagens, sem editar");
    } else {
      for (const aba of ["Hoje", "Rotina", "Agenda", "Tarefas", "Implantação", "Agentes", "Administrativo", "Negócios", "Revisão semanal", "Notas e decisões", "Avisos"]) {
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
