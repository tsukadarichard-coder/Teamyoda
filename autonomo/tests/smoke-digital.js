/* Academia Digital Team Yoda (/digital/) no navegador (390 px e computador), com a function real digital.js (e ver-aluno.js) sobre
   um Firestore e um login em memória:
   · aluno do Team Yoda abre pelo link do Meu plano, cria a conta e entra já liberado (o token sai do endereço);
   · trilha › aula: o vídeo do YouTube só carrega depois do toque (youtube-nocookie), treinos da aula, marcar como feita;
   · treinos do catálogo com busca, família e quadra animada; simulador dentro do quadro (?embed=1); conta e sair;
   · visitante sem acesso: vitrine sem vídeo, lista de espera; liga um link do 39 Ranch colado; com link de pagamento aparece Assinar;
   · professor entra com a conta do app do treinador como equipe. Rode: node tests/smoke-digital.js [pasta-das-capturas] */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const capturas = process.argv[2] || "";
const raiz = path.join(__dirname, "../../mty"), fx = path.join(__dirname, "../../netlify/functions/");

const store = {}; const J = (v) => JSON.parse(JSON.stringify(v));
function docRef(p) { return { id: p.split("/").pop(), collection: (n) => colRef(p + "/" + n), async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), data: () => J(v) }; }, async set(v, o) { store[p] = o && o.merge ? { ...(store[p] || {}), ...J(v) } : J(v); } }; }
function colRef(p, f = [], lim = 0) {
  return {
    doc: (id) => docRef(p + "/" + id), where: (c, o, v) => colRef(p, f.concat([[c, o, v]]), lim), limit: (n) => colRef(p, f, n),
    async get() {
      let ks = Object.keys(store).filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/"))
        .filter((k) => f.every(([c, o, v]) => (o === "array-contains" ? (store[k][c] || []).includes(v) : store[k][c] === v)));
      if (lim) ks = ks.slice(0, lim);
      const d = ks.map((k) => ({ id: k.split("/").pop(), ref: docRef(k), data: () => J(store[k]) }));
      return { docs: d, size: d.length, empty: !d.length, forEach: (g) => d.forEach(g) };
    },
  };
}
/* contas: e-mail → { uid, senha, claims } */
const contas = { "coord@ty.com": { uid: "c1", senha: "senha-coord", claims: { uid: "c1", orgId: "team-yoda", role: "coordenador", email: "coord@ty.com" } }, "prof@39.com": { uid: "p1", senha: "senha-prof", claims: { uid: "p1", orgId: "39-ranch", role: "treinador", email: "prof@39.com" } } };
let uidSeq = 0;
const admin = {
  firestore: () => ({ collection: (n) => colRef(n) }),
  auth: () => ({
    verifyIdToken: async (t) => { const c = Object.values(contas).find((x) => "tk-" + x.uid === t); if (!c) throw new Error("x"); return c.claims; },
    createUser: async ({ email, password, displayName }) => { if (contas[email]) { const e = new Error("exists"); e.code = "auth/email-already-exists"; throw e; } const uid = "u" + (++uidSeq); contas[email] = { uid, senha: password, claims: { uid, email, name: displayName } }; return { uid }; },
  }),
};
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };
const digital = require(fx + "digital.js").handler, verAluno = require(fx + "ver-aluno.js").handler;
store["orgs/team-yoda/dados/mty:alunos:v2"] = { value: JSON.stringify([{ id: "a1", nome: "Ana Souza", linkToken: "tA", registros: [], horarios: [] }]) };
store["orgs/39-ranch/dados/mty:alunos:v2"] = { value: JSON.stringify([{ id: "r1", nome: "Rui Costa", linkToken: "tR", registros: [], horarios: [] }]) };

/* Firebase de mentira (app + auth) no lugar do gstatic */
const FIREBASE = `window.firebase=(function(){var cbs=[],user=null;
function chamar(u){cbs.forEach(function(f){f(u)})}
try{var s=JSON.parse(sessionStorage.getItem("fakeUser")||"null");if(s)user={uid:s.uid,email:s.email,getIdToken:function(){return Promise.resolve(s.tk)}}}catch(e){}
var a={signInWithEmailAndPassword:function(e,p){return fetch("/__login",{method:"POST",body:JSON.stringify({e:e,p:p})}).then(function(r){if(!r.ok)return Promise.reject({code:"auth/invalid-credential"});return r.json()}).then(function(j){sessionStorage.setItem("fakeUser",JSON.stringify({uid:j.uid,email:e,tk:j.tk}));user={uid:j.uid,email:e,getIdToken:function(){return Promise.resolve(j.tk)}};chamar(user);return {user:user}})},
onAuthStateChanged:function(f){cbs.push(f);setTimeout(function(){f(user)},0)},signOut:function(){user=null;sessionStorage.removeItem("fakeUser");chamar(null);return Promise.resolve()},sendPasswordResetEmail:function(){return Promise.resolve()}};
return {apps:[],initializeApp:function(){this.apps.push({})},auth:function(){return a}}})();`;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, "http://x");
  let b = ""; q.on("data", (d) => (b += d));
  q.on("end", async () => {
    if (u.pathname === "/__login") { const { e, p } = JSON.parse(b); const c = contas[e]; if (!c || c.senha !== p) { r.writeHead(400); return r.end("{}"); } r.writeHead(200); return r.end(JSON.stringify({ uid: c.uid, tk: "tk-" + c.uid })); }
    if (u.pathname === "/.netlify/functions/digital" || u.pathname === "/.netlify/functions/ver-aluno") {
      const x = await (u.pathname.endsWith("/digital") ? digital : verAluno)({ httpMethod: q.method, headers: q.headers, body: b || null, queryStringParameters: Object.fromEntries(u.searchParams) });
      r.writeHead(x.statusCode, x.headers); return r.end(x.body);
    }
    let rel = decodeURIComponent(u.pathname); if (rel.endsWith("/")) rel += "index.html";
    const f = path.join(raiz, rel);
    if (f.startsWith(raiz) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); return r.end(fs.readFileSync(f)); }
    r.writeHead(404); r.end();
  });
}).listen(0);
const base = "http://localhost:" + srv.address().port;
const chamar = async (metodo, corpo, tk) => { const x = await digital({ httpMethod: metodo, headers: tk ? { authorization: "Bearer " + tk } : {}, body: corpo ? JSON.stringify(corpo) : null, queryStringParameters: {} }); return JSON.parse(x.body); };

(async () => {
  /* a coordenação monta duas trilhas (uma em rascunho) */
  const salvo = await chamar("POST", { acao: "salvarConteudo", trilhas: [
    { id: "tr1", titulo: "Forehand do zero", nivel: "iniciante", publicada: true, descricao: "Do grip ao forehand com intenção.", aulas: [
      { id: "au1", titulo: "Empunhadura e preparação", youtube: "https://youtu.be/dQw4w9WgXcQ", duracao: "8 min", descricao: "Assista e repita a sombra 10 vezes.", exercicios: ["FB001", "FB002"] },
      { id: "au2", titulo: "Troca na cruzada", exercicios: ["FB003"] }] },
    { id: "tr2", titulo: "Rascunho secreto", publicada: false, aulas: [{ id: "au9", titulo: "Ainda não", youtube: "aaaaaaaaaaa" }] },
  ], venda: { preco: "R$ 59,90/mês", observacao: "Cancele quando quiser." } }, "tk-c1");
  assert(salvo.ok, JSON.stringify(salvo));

  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const erros = [], externos = [];
  async function pagina(largura) {
    const ctx = await b.newContext({ viewport: { width: largura, height: 844 } });
    await ctx.route(/^https?:\/\/(?!localhost)/, (rota) => {
      const url = rota.request().url(); externos.push(url);
      if (/firebase-app-compat/.test(url)) return rota.fulfill({ contentType: "text/javascript", body: FIREBASE });
      rota.fulfill({ contentType: /fonts/.test(url) ? "text/css" : /ytimg/.test(url) ? "image/png" : /youtube/.test(url) ? "text/html" : "text/javascript", body: "" });
    });
    const p = await ctx.newPage();
    p.on("pageerror", (e) => erros.push(e.message)); p.on("dialog", (d) => d.accept());
    return p;
  }
  const cap = async (p, nome) => { if (capturas) await p.screenshot({ path: path.join(capturas, nome + ".png"), fullPage: true }); };

  /* 0. portal: as quatro entradas, a vitrine e o plano incluído para as unidades */
  const vis = await pagina(390);
  await vis.goto(base + "/portal/");
  assert.deepStrictEqual(await vis.$$eval("[data-porta]", (els) => els.map((e) => e.getAttribute("data-porta"))), ["professor", "cooper", "39ranch", "digital"]);
  await vis.waitForSelector("#vitTrilhas >> text=Forehand do zero · 2 aulas");
  assert(!(await vis.content()).includes("Rascunho secreto"));
  assert.strictEqual(await vis.textContent("#preco"), "R$ 59,90/mês");
  assert(/^https:\/\/wa\.me\/\d+\?text=/.test(await vis.getAttribute("[data-porta=cooper] [data-whatsapp]", "href")));
  assert.strictEqual(await vis.getAttribute("[data-porta=professor] a", "href"), "https://app.39tennis.com.br/");
  assert(/Incluída na matrícula/.test(await vis.textContent("[data-plano=unidade]")));
  assert(await vis.isHidden("#btAssinar"), "sem link de pagamento não aparece Assinar no portal");
  await vis.fill("#fEspera input[name=email]", "lead@x.com");
  await vis.click("#fEspera button");
  await vis.waitForSelector("#mEspera >> text=avisamos você");
  assert(store["digitalInteresses/lead@x.com"]);
  assert(await vis.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "portal sem rolagem lateral");
  await cap(vis, "portal-celular");
  const visPc = await pagina(1280); await visPc.goto(base + "/portal/"); await visPc.waitForSelector("#vitTrilhas .tag"); await cap(visPc, "portal-computador");

  /* 1. aluna do Team Yoda vem do Meu plano (cartão Academia Digital do link do aluno) */
  const ana = await pagina(390);
  await ana.goto(base + "/aluno.html?org=team-yoda&id=a1&t=tA");
  await ana.waitForSelector("[data-academia-digital] a >> text=Entrar na Academia Digital", { timeout: 30000 });
  assert(/Incluída na sua matrícula/.test(await ana.textContent("[data-academia-digital]")));
  await ana.click("[data-academia-digital] a");
  await ana.waitForSelector(".faixa-unidade >> text=Team Yoda · Cooper Tênis");
  assert(!/t=tA/.test(ana.url()), "o token do link sai do endereço");
  await ana.waitForSelector("text=Trilhas disponíveis:");
  assert(!(await ana.content()).includes("Rascunho secreto"), "rascunho não aparece na vitrine");
  await cap(ana, "digital-entrada");
  await ana.fill("input[name=nome]", "Ana Souza");
  await ana.fill("input[name=email]", "ana@x.com");
  await ana.fill("input[name=senha]", "123");
  await ana.click("#btEnt");
  await ana.waitForSelector("#mEnt >> text=pelo menos 8");
  await ana.fill("input[name=senha]", "senha-ana-1");
  await ana.click("#btEnt");
  await ana.waitForSelector(".msg-ok >> text=ligada ao aluno de Team Yoda · Cooper Tênis");
  assert.strictEqual(await ana.textContent("#selo"), "Aluno da unidade");
  await ana.waitForSelector("text=Acesso incluído na sua matrícula");
  assert.deepStrictEqual(store["digitalContas/u1"].vinculoChaves, ["team-yoda:a1"]);
  assert(!(await ana.content()).includes("Rascunho secreto"));
  await cap(ana, "digital-trilhas");

  /* 2. trilha › aula › vídeo só depois do toque › treinos › feita */
  await ana.click("a.trilha >> text=Forehand do zero");
  await ana.waitForSelector("text=0 de 2 aulas feitas");
  await ana.click("a.aula-item >> text=Empunhadura e preparação");
  await ana.waitForSelector("#btVideo");
  assert.strictEqual(await ana.locator("iframe").count(), 0, "o vídeo não carrega antes do toque");
  assert(!externos.some((u) => /youtube/.test(u)), "nada do YouTube antes do toque (só a miniatura)");
  await ana.waitForSelector("#exAula a.ex >> text=FB001");
  assert.strictEqual(await ana.locator("#exAula a.ex").count(), 2);
  await cap(ana, "digital-aula");
  await ana.click("#btVideo");
  const src = await ana.getAttribute("#video iframe", "src");
  assert(/^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?/.test(src), src);
  await ana.click("#exAula a.ex >> nth=0");
  await ana.waitForSelector("#quadra .qe-quadra svg");
  await ana.waitForSelector("dt >> text=Montagem");
  await cap(ana, "digital-treino");
  await ana.click("#btVoltar");
  await ana.waitForSelector("#btFeita");
  await ana.click("#btFeita");
  await ana.waitForSelector("h1 >> text=Troca na cruzada");
  assert(store["digitalContas/u1"].progresso.au1, "progresso gravado");
  await ana.click("a.voltar");
  await ana.waitForSelector("text=1 de 2 aulas feitas");
  assert.strictEqual(await ana.locator(".aula-item.feita").count(), 1);

  /* 3. treinos do catálogo */
  await ana.click(".abas a[data-aba=treinos]");
  await ana.waitForSelector("#fcont >> text=353 treinos");
  await ana.fill("#fq", "construcao em 4 bolas");
  await ana.waitForSelector("#fcont >> text=1 treino");
  await ana.fill("#fq", "");
  await ana.check("#fqd");
  const comQuadra = +(await ana.textContent("#fcont")).split(" ")[0];
  assert(comQuadra > 50 && comQuadra < 353, "filtro da quadra animada: " + comQuadra);
  await ana.selectOption("#ff", "FB");
  await ana.waitForFunction(() => /^\d+ treinos?$/.test(document.querySelector("#fcont").textContent) && [...document.querySelectorAll("#lista .cod")].every((e) => /^FB\d/.test(e.textContent)));
  await cap(ana, "digital-treinos");

  /* 4. simulador no quadro */
  await ana.click(".abas a[data-aba=simulador]");
  const fr = await (await ana.waitForSelector("#simQuadro")).contentFrame();
  await fr.waitForSelector("html.embutido .pagina h1", { timeout: 30000 });
  await cap(ana, "digital-simulador");

  /* 5. conta e sair */
  await ana.click(".abas a[data-aba=conta]");
  await ana.waitForSelector("text=Aluno de Team Yoda · Cooper Tênis · incluído na matrícula");
  assert.strictEqual(await ana.locator("#fLigar").count(), 0, "aluno da unidade não precisa ligar outro link");
  await ana.click("#btSair");
  await ana.waitForSelector("#fEntrar");

  /* 6. visitante sem acesso */
  const bia = await pagina(1280);
  await bia.goto(base + "/digital/");
  await bia.fill("input[name=nome]", "Bia Lopes");
  await bia.fill("input[name=email]", "bia@x.com");
  await bia.fill("input[name=senha]", "senha-bia-1");
  await bia.click("#btEnt");
  await bia.waitForSelector("text=Falta liberar o acesso");
  assert(await bia.isHidden("#abas"));
  await bia.waitForSelector(".preco >> text=R$ 59,90/mês");
  assert(!(await bia.content()).includes("dQw4w9WgXcQ"), "sem acesso não vê o vídeo");
  assert.strictEqual(await bia.locator("a >> text=Assinar").count(), 0, "sem link de pagamento não aparece Assinar");
  await bia.click("#btAvise");
  await bia.waitForSelector("#mAvise >> text=avisamos você");
  assert(store["digitalInteresses/bia@x.com"]);
  await cap(bia, "digital-sem-acesso");
  await bia.fill("#fLigar input", "https://exemplo.com/qualquer");
  await bia.click("#fLigar button");
  await bia.waitForSelector("#mLigar >> text=não parece um link do aluno");
  await bia.fill("#fLigar input", "https://app.39tennis.com.br/aluno.html?org=39-ranch&id=r1&t=errado");
  await bia.click("#fLigar button");
  await bia.waitForSelector("#mLigar >> text=não vale mais");
  /* com link de pagamento: Assinar */
  await chamar("POST", { acao: "salvarConteudo", trilhas: store["digitalConteudo/academia"].trilhas, venda: { preco: "R$ 59,90/mês", checkoutUrl: "https://pagamento.exemplo/ty" } }, "tk-c1");
  await bia.reload();
  await bia.waitForSelector('a.btn[href="https://pagamento.exemplo/ty"] >> text=Assinar');
  await vis.reload(); await vis.waitForSelector("#btAssinar:visible"); assert(await vis.isHidden("#fEspera"), "com link de pagamento o portal leva para assinar");
  await bia.fill("#fLigar input", base + "/aluno.html?org=39-ranch&id=r1&t=tR");
  await bia.click("#fLigar button");
  await bia.waitForSelector(".msg-ok >> text=39 Ranch Tennis Club");
  assert.strictEqual(await bia.textContent("#selo"), "Aluno da unidade");

  /* 7. professor do 39 Ranch entra com a conta do app */
  const prof = await pagina(390);
  await prof.goto(base + "/digital/");
  await prof.click("#mEntrar");
  await prof.fill("input[name=email]", "prof@39.com");
  await prof.fill("input[name=senha]", "errada");
  await prof.click("#btEnt");
  await prof.waitForSelector("#mEnt >> text=E-mail ou senha não conferem.");
  await prof.fill("input[name=senha]", "senha-prof");
  await prof.click("#btEnt");
  await prof.waitForSelector("text=Acesso da equipe · 39 Ranch Tennis Club");
  assert.strictEqual(await prof.textContent("#selo"), "Equipe");
  assert(!store["digitalContas/p1"], "conta da equipe não cria cadastro na Academia Digital");
  /* criar conta com e-mail que já existe leva para Entrar */
  const outro = await pagina(390);
  await outro.goto(base + "/digital/");
  await outro.fill("input[name=nome]", "Ana de novo");
  await outro.fill("input[name=email]", "ana@x.com");
  await outro.fill("input[name=senha]", "qualquer-123");
  await outro.click("#btEnt");
  await outro.waitForSelector("#mEnt >> text=Já existe uma conta com este e-mail");
  assert.strictEqual(await outro.inputValue("input[name=email]"), "ana@x.com");

  /* nada transborda no celular */
  for (const p of [ana, prof]) assert(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "sem rolagem lateral");
  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  console.log("smoke-digital: ok");
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
