/* Consultoria com Richard Tsukada, no navegador, com as functions reais (consultoria-rt, admin-consultoria-rt, player-dados, player-competicao)
   sobre um Firestore em memória. Atleta no celular (390 px): cadastro com rascunho, partida do diagnóstico, plano publicado, ação marcada,
   jogos em sequência, calendário com filtro. Richard no computador (1280 px): painel com filtros, partida concluída, diagnóstico, plano,
   menu lateral recolhível. Responsável: relatório publicado e PDF. Treinador: sugestão no plano. Sem acesso: tela explicativa.
   Rode: node tests/smoke-consultoria-rt.js [pasta-das-capturas] */
const http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const raiz = path.join(__dirname, ".."), fx = path.join(raiz, "netlify/functions/");
const capturas = process.argv[2] || "";

const store = {}; const J = (v) => JSON.parse(JSON.stringify(v));
function merge(a, b) { const o = { ...a }; for (const k of Object.keys(b)) o[k] = b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) ? merge(a[k] || {}, b[k]) : b[k]; return o; }
function docRef(p) { return { id: p.split("/").pop(), async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), ref: docRef(p), data: () => J(v) }; }, async set(v, o) { store[p] = o && o.merge ? merge(store[p] || {}, J(v)) : J(v); }, async update(v) { Object.assign(store[p], J(v)); }, async delete() { delete store[p]; }, collection: (c) => colRef(p + "/" + c) }; }
let seq = 0;
function colRef(p, f = [], ord = null, lim = 0) {
  return {
    doc: (id) => docRef(p + "/" + id), where: (c, o, v) => colRef(p, f.concat([[c, v]]), ord, lim), orderBy: (c, d) => colRef(p, f, [c, d || "asc"], lim), limit: (n) => colRef(p, f, ord, n),
    async add(v) { const id = "doc" + String(++seq).padStart(12, "0"); store[p + "/" + id] = J(v); return docRef(p + "/" + id); },
    async get() {
      let ks = Object.keys(store).filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/")).filter((k) => f.every(([c, v]) => store[k][c] === v));
      if (ord) ks.sort((a, b) => (String(store[a][ord[0]]) < String(store[b][ord[0]]) ? -1 : 1) * (ord[1] === "desc" ? -1 : 1));
      if (lim) ks = ks.slice(0, lim);
      const d = ks.map((k) => ({ id: k.split("/").pop(), ref: docRef(k), data: () => J(store[k]) }));
      return { docs: d, empty: !d.length, size: d.length, forEach: (g) => d.forEach(g) };
    },
  };
}
const db = { collection: (n) => colRef(n), runTransaction: async (fn) => fn({ get: (r) => r.get(), set: (r, v, o) => r.set(v, o), update: (r, v) => r.update(v) }) };
const USU = {
  ana: { uid: "ana", email: "ana@exemplo.com", name: "Ana Lima" }, mae: { uid: "mae", email: "mae@exemplo.com", name: "Cláudia Lima" }, joao: { uid: "joao", email: "joao@exemplo.com", name: "João Prado" },
  richard: { uid: "richard", email: "tsukada.richard@gmail.com", name: "Richard Tsukada" }, lia: { uid: "lia", email: "lia@exemplo.com", name: "Lia Rocha" }, zeca: { uid: "zeca", email: "zeca@exemplo.com", name: "Zeca" },
};
const admin = { firestore: () => db, auth: () => ({ verifyIdToken: async (t) => { const u = USU[String(t).replace(/^tok-/, "")]; if (!u) throw new Error("x"); return u; }, getUserByEmail: async (e) => { const u = Object.values(USU).find((x) => x.email === e); if (!u) throw new Error("x"); return { uid: u.uid }; } }) };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };
const Modulo = require("module"), carregarM = Modulo._load;
Modulo._load = function (pedido, ...resto) { if (pedido === "@anthropic-ai/sdk") return class { constructor() { this.messages = { create: async () => { throw new Error("sem IA"); } }; } }; return carregarM.call(this, pedido, ...resto); };
process.env.ADMIN_SECRET = "seg"; delete process.env.ANTHROPIC_API_KEY;
const handler = (n) => require(fx + n + ".js").handler;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".json": "application/json", ".svg": "image/svg+xml", ".webp": "image/webp" };
const servidor = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/.netlify/functions/")) {
    const nome = u.pathname.split("/").pop(); let corpo = ""; req.on("data", (d) => (corpo += d));
    req.on("end", async () => { try { const r = await handler(nome)({ httpMethod: req.method, headers: req.headers, body: corpo || null, queryStringParameters: Object.fromEntries(u.searchParams) }); res.writeHead(r.statusCode, r.headers || { "content-type": "application/json" }); res.end(r.body); } catch (e) { res.writeHead(500); res.end(JSON.stringify({ erro: String(e.message) })); } });
    return;
  }
  let f = path.join(raiz, decodeURIComponent(u.pathname)); if (u.pathname.endsWith("/")) f = path.join(f, "index.html");
  if (!f.startsWith(raiz) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("não encontrado"); }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); res.end(fs.readFileSync(f));
});
const STUB = `(function(){var uid=(function(){try{return localStorage.getItem("teste-uid")||"ana"}catch(e){return "ana"}})();var a={currentUser:{uid:uid,email:uid+"@exemplo.com",displayName:uid,getIdToken:function(){return Promise.resolve("tok-"+uid)}},languageCode:"",onAuthStateChanged:function(cb){setTimeout(function(){cb(a.currentUser)},0)},signOut:function(){return Promise.resolve()}};
window.firebase={initializeApp:function(){},auth:function(){return a}};})();`;
const hoje = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10), ano = +hoje.slice(0, 4);
const mais = (n) => { const d = new Date(hoje + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const API = async (uid, corpo, q) => { const r = await handler("consultoria-rt")({ httpMethod: corpo ? "POST" : "GET", headers: { authorization: "Bearer tok-" + uid }, queryStringParameters: q || {}, body: corpo ? JSON.stringify(corpo) : null }); return { s: r.statusCode, ...JSON.parse(r.body) }; };

(async () => {
  const conta = (uid, papel, extra) => { store["jogadores/" + uid] = { nome: USU[uid].name, email: USU[uid].email, criadoEm: "2026-09-01T10:00:00Z", planosGratisUsados: 0, competicao: { papel, ativadoEm: "2026-09-01T10:00:00Z", ...(extra || {}) } }; };
  conta("ana", "atleta", { nascimento: (ano - 16) + "-03-03" }); conta("mae", "responsavel"); conta("joao", "treinador"); conta("richard", "treinador"); conta("zeca", "atleta", { nascimento: (ano - 17) + "-01-01" }); conta("lia", "atleta", { nascimento: (ano - 15) + "-02-02" });
  store["vinculos/vincMaeAna0001"] = { atletaUid: "ana", atletaNome: "Ana Lima", pessoaUid: "mae", pessoaNome: "Cláudia Lima", tipo: "responsavel", parentesco: "mae", status: "ativo", areas: ["perfil", "temporada", "planejamento", "estrategias", "partidas", "treinos"], criadoEm: "2026-09-02T10:00:00Z" };
  store["vinculos/vincJoaoAna001"] = { atletaUid: "ana", atletaNome: "Ana Lima", pessoaUid: "joao", pessoaNome: "João Prado", tipo: "treinador", status: "ativo", areas: ["perfil", "temporada", "planejamento", "estrategias", "partidas", "treinos"], criadoEm: "2026-09-03T10:00:00Z" };
  store["jogadores/ana/torneios/torneioCBT0001"] = { nome: "CBT 16 anos · Curitiba", inicio: mais(12), fim: mais(16), estado: "inscrito", cidade: "Curitiba", criadoEm: "2026-10-01T10:00:00Z" };
  store["jogadores/ana/compCompromissos/compProvas01"] = { tipo: "escola", titulo: "Semana de provas", inicio: mais(4), fim: mais(8) };
  store["jogadores/ana/partidas/partidaAntiga1"] = { data: mais(-20), tipo: "competicao", resultado: "derrota", adversario: "Carla", placar: "4/6 3/6", videoLink: "https://youtu.be/abc12345678", criadoEm: "2026-10-10T10:00:00Z" };
  /* ativação manual pelo administrador (painel) */
  const at = JSON.parse((await handler("admin-consultoria-rt")({ httpMethod: "POST", headers: { "x-admin-secret": "seg" }, body: JSON.stringify({ acao: "ativar", email: "ana@exemplo.com", inicio: hoje }) })).body);
  assert(at.ok, JSON.stringify(at)); const id = at.id;
  await API("ana", { acao: "incluirEquipe", id, vinculoId: "vincMaeAna0001" }); await API("ana", { acao: "incluirEquipe", id, vinculoId: "vincJoaoAna001" });

  await new Promise((r) => servidor.listen(0, r));
  const base = "http://localhost:" + servidor.address().port;
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const erros = [];
  async function pagina(uid, papel, w) {
    const ctx = await browser.newContext({ viewport: { width: w || 390, height: w > 600 ? 900 : 844 } });
    await ctx.route("https://www.gstatic.com/firebasejs/**", (r) => r.fulfill({ contentType: "text/javascript", body: r.request().url().includes("app-compat") ? STUB : "" }));
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ contentType: "text/css", body: "" }));
    await ctx.addInitScript(([u, p]) => { try { localStorage.setItem("teste-uid", u); localStorage.setItem("ql-comp-papel", p); } catch (e) {} }, [uid, papel]);
    const p = await ctx.newPage();
    p.on("pageerror", (e) => erros.push(uid + ": " + e.message)); p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|status of 4\d\d/.test(m.text())) erros.push(uid + ": " + m.text()); });
    return p;
  }
  const cap = async (p, n) => { if (capturas) { fs.mkdirSync(capturas, { recursive: true }); await p.screenshot({ path: path.join(capturas, n + ".png"), fullPage: true }); } };
  const semRolagem = async (p, quem) => assert(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), quem + ": sem rolagem lateral");

  /* ── atleta no celular ── */
  const a = await pagina("ana", "atleta", 390);
  await a.goto(base + "/competicao/#/consultoria");
  await a.waitForFunction((id) => location.hash === "#/consultoria/" + id + "/plano", id, { timeout: 20000 });
  await a.waitForSelector(".cr-cab >> text=Meu plano");
  assert.strictEqual(await a.locator(".cr-secoes a").count(), 5, "cinco seções");
  await a.waitForSelector("text=Começar o cadastro");
  await semRolagem(a, "atleta"); await cap(a, "consultoria-atleta-inicio");
  await a.click("text=Começar o cadastro");
  await a.waitForSelector("#fEntrada");
  await a.selectOption("#enObj", "ambos");
  await a.fill("#enHist", "CBT 16 anos desde 2025, semifinal no Banana Bowl");
  /* rascunho local: sai e volta sem perder */
  await a.reload(); await a.waitForSelector("#fEntrada");
  assert.strictEqual(await a.inputValue("#enHist"), "CBT 16 anos desde 2025, semifinal no Banana Bowl", "rascunho preservado ao recarregar");
  await a.check('input[name="enDias"][value="seg"]'); await a.check('input[name="enDias"][value="qui"]'); await a.selectOption("#enMin", "90");
  await a.click("#fEntrada button[type=submit]");
  await a.waitForSelector(".cr-partidas");
  assert.deepStrictEqual(store["jogadores/ana"].competicao.rotina.dias, ["seg", "qui"], "rotina gravada no mesmo lugar do planejamento");
  /* partida 1 do diagnóstico: aproveita uma partida do app */
  const antes = Object.keys(store).filter((k) => k.startsWith("jogadores/ana/partidas/")).length;
  await a.click('.cr-partidas a[href$="/partida/1"]'); await a.waitForSelector("#fDiag");
  await a.selectOption("#dgExist", "partidaAntiga1"); await a.fill("#dgTorneio", "Aberto FPT"); await a.fill("#dgCtx", "Quartas de final, vento forte");
  await cap(a, "consultoria-atleta-partida");
  await a.click("#fDiag button[type=submit]");
  await a.waitForSelector(".cr-partidas >> text=Material recebido");
  assert.strictEqual(Object.keys(store).filter((k) => k.startsWith("jogadores/ana/partidas/")).length, antes, "partida não duplicada");
  /* partidas 2 e 3 (atalho pelo servidor) e conclusão pelo consultor */
  await API("ana", { acao: "salvarPartidaDiag", id, n: 2, resultado: "vitoria", dados: { data: mais(-9), torneio: "CBT", adversario: "Bia", placar: "6/3 6/4", video: "https://youtu.be/xyz98765432" } });
  await API("ana", { acao: "salvarPartidaDiag", id, n: 3, resultado: "derrota", dados: { data: mais(-4), torneio: "CBT", adversario: "Duda", placar: "3/6 6/7", video: "https://youtu.be/qwe11112222" } });

  /* ── Richard no computador ── */
  const r = await pagina("richard", "treinador", 1280);
  await r.goto(base + "/competicao/#/consultoria");
  await r.waitForSelector(".cr-cab >> text=Painel do consultor", { timeout: 20000 });
  await r.waitForSelector(".crp-atleta >> text=Ana Lima");
  assert(/para analisar/.test(await r.locator(".crp-atleta").innerText()), "análises pendentes no painel");
  await r.selectOption('#crFiltros select[name="pend"]', "atraso");
  await r.waitForSelector("text=Nenhum atleta com esses filtros.");
  await r.selectOption('#crFiltros select[name="pend"]', "analise");
  await r.waitForSelector(".crp-atleta >> text=Ana Lima");
  await cap(r, "consultoria-consultor-painel");
  await r.click(".crp-atleta");
  await r.waitForSelector("text=Para você");
  /* partida 1: marcações e conclusão (o que só o consultor vê) */
  await r.goto(base + "/competicao/#/consultoria/" + id + "/partida/1"); await r.waitForSelector("#dgSt");
  await r.selectOption("#dgSt", "concluido"); await r.fill('.cr-marc [data-k="tempo"]', "12:40"); await r.fill('.cr-marc [data-k="nota"]', "MARCA-PRIVADA devolução curta");
  await r.click("#fDiag button[type=submit]"); await r.waitForSelector(".cr-partidas");
  for (const n of [2, 3]) await API("richard", { acao: "salvarPartidaDiag", id, n, dados: { status: "concluido" } });
  /* diagnóstico pela tela */
  await r.goto(base + "/competicao/#/consultoria/" + id + "/diagnostico"); await r.reload(); await r.waitForSelector("#fDg");
  assert(/3 de 3 partidas/.test(await r.locator("#fDg").innerText()));
  await r.click('[data-add="fortes"]'); await r.fill('[data-sec="fortes"] [data-k="texto"]', "Primeiro saque com direção aberta"); await r.fill('[data-sec="fortes"] [data-k="ev"]', "1 03:10, 2");
  await r.click('[data-add="dificuldades"]'); await r.fill('[data-sec="dificuldades"] [data-k="texto"]', "Devolução curta sob pressão");
  await r.click('[data-add="prioridades"]'); await r.fill('[data-sec="prioridades"] [data-k="texto"]', "Devolução mais profunda");
  await r.click('[data-add="questoes"]'); await r.fill('[data-sec="questoes"] [data-k="texto"]', "Queda física no terceiro set?");
  await r.click('#fDg button[data-pub="1"]');
  await r.waitForSelector("#fDg .aviso:not([hidden])"); assert(/precisa citar ao menos uma partida/.test(await r.locator("#fDg .aviso").innerText()), "observação sem evidência bloqueada na tela");
  await r.fill('[data-sec="dificuldades"] [data-k="ev"]', "3 41:05");
  await cap(r, "consultoria-consultor-diagnostico");
  await r.click('#fDg button[data-pub="1"]');
  await r.waitForSelector("text=Publicado em");
  /* IA sem integração: avisa e o formulário continua */
  await r.goto(base + "/competicao/#/consultoria/" + id + "/diagnostico"); await r.waitForSelector("#btIA");
  await r.click("#btIA"); await r.waitForFunction(() => /formulário/.test(document.getElementById("iaMsg").textContent));
  /* plano de 90 dias pela tela */
  await r.goto(base + "/competicao/#/consultoria/" + id + "/plano-editar"); await r.waitForSelector("#fPl");
  await r.fill("#plObj", "Consolidar a devolução e a construção do ponto");
  await r.fill('[data-prio="0"] [data-k="titulo"]', "Devolução profunda"); await r.fill('[data-prio="0"] [data-k="sit"]', "Curta sob pressão no segundo saque"); await r.fill('[data-prio="0"] [data-k="ind"]', "Devoluções além da linha de saque nos vídeos");
  await r.fill('[data-prio="0"] .cr-acao-ed [data-k="texto"]', "Gravar uma partida por mês"); await r.selectOption('[data-prio="0"] .cr-acao-ed [data-k="resp"]', "atleta"); await r.fill('[data-prio="0"] .cr-acao-ed [data-k="prazo"]', mais(30));
  await r.click('[data-prio="0"] [data-mais-acao]');
  await r.fill('[data-prio="0"] .cr-acao-ed:nth-child(2) [data-k="texto"]', "Bloco de devolução duas vezes por semana"); await r.selectOption('[data-prio="0"] .cr-acao-ed:nth-child(2) [data-k="resp"]', "treinador"); await r.fill('[data-prio="0"] .cr-acao-ed:nth-child(2) [data-k="prazo"]', mais(20));
  await r.click('#fPl button[data-fim="enviar"]'); await r.waitForSelector(".cr-cab >> text=Ana Lima");
  /* treinador comenta a versão aberta */
  const j = await pagina("joao", "treinador", 390);
  await j.goto(base + "/competicao/#/consultoria/" + id + "/plano"); await j.waitForSelector("text=Plano para você comentar", { timeout: 20000 });
  await j.fill("#crSug", "Incluir devolução de segundo saque com alvo"); await j.click("#fSug button[type=submit]");
  await j.waitForSelector("text=aguardando o Richard");
  await cap(j, "consultoria-treinador");
  await r.goto(base + "/competicao/#/consultoria/" + id + "/plano-editar"); await r.reload(); await r.waitForSelector("text=Sugestões do treinador");
  await r.click('#fPl button[data-fim="publicar"]'); await r.waitForSelector(".cr-prio >> text=Devolução profunda");
  await cap(r, "consultoria-consultor-plano");
  /* menu lateral recolhível */
  await r.click("#btRecolher"); await r.waitForSelector("#btAbrirLateral:not([hidden])");
  assert(await r.evaluate(() => getComputedStyle(document.getElementById("lateral")).display === "none" && parseInt(getComputedStyle(document.querySelector(".principal")).marginLeft, 10) === 0), "menu recolhido");
  await r.click("#btAbrirLateral"); await r.waitForSelector("#btRecolher");
  assert(await r.evaluate(() => getComputedStyle(document.getElementById("lateral")).display !== "none"), "menu aberto de novo");
  /* nota privada */
  await r.click(".cr-privado summary"); await r.fill("#crNota", "NOTA-PRIVADA conversar com a família sobre viagens"); await r.click("#fNota button[type=submit]");
  await r.waitForSelector(".cr-notas >> text=NOTA-PRIVADA");

  /* ── atleta: plano publicado, ação, jogos em sequência, calendário ── */
  await a.goto(base + "/competicao/#/consultoria/" + id + "/plano"); await a.reload();
  await a.waitForSelector(".cr-prio >> text=Devolução profunda");
  assert(!(await a.content()).includes("MARCA-PRIVADA") && !(await a.content()).includes("NOTA-PRIVADA"), "nada privado na tela do atleta");
  assert.strictEqual(await a.locator(".cr-acao input[type=checkbox]").count(), 1, "o atleta marca só a ação dele");
  await a.check(".cr-acao input[type=checkbox]"); await a.waitForSelector(".cr-acao.feita");
  await cap(a, "consultoria-atleta-plano");
  await a.click('.cr-secoes a[href$="/jogos"]'); await a.click("text=Registrar jogo"); await a.waitForSelector("#fJogo");
  await a.selectOption("#jgTor", "torneioCBT0001"); await a.selectOption("#jgSup", "saibro"); await a.fill("#jgAdv", "Eva"); await a.check('input[name="jgRes"][value="vitoria"]'); await a.fill("#jgPlacar", "6/2 6/3");
  await a.fill("#jgAplic", "Devolvi mais fundo"); await a.fill("#jgDif", "RELATO-DA-ANA nervosa no fim");
  await cap(a, "consultoria-atleta-jogo");
  await a.click('#fJogo button[data-depois="outro"]');
  await a.waitForFunction(() => document.getElementById("jgAdv") && document.getElementById("jgAdv").value === "");
  assert.strictEqual(await a.inputValue("#jgTor"), "torneioCBT0001", "lançar o próximo jogo reaproveita o torneio"); assert.strictEqual(await a.inputValue("#jgSup"), "saibro");
  await a.fill("#jgAdv", "Fê"); await a.check('input[name="jgRes"][value="derrota"]'); await a.check('input[name="jgVer"][value="treinador"]');
  await a.click('#fJogo button[data-depois="sair"]'); await a.waitForSelector(".cr-jogo >> text=Contra Fê");
  assert.strictEqual(await a.locator(".cr-jogo >> text=Contra Eva").count(), 1, "jogo aparece uma vez");
  assert(/Quem vê: Richard/.test(await a.locator(".cr-jogo", { hasText: "Contra Eva" }).innerText()), "o autor vê quem pode ler o relato");
  await a.click('.cr-secoes a[href$="/calendario"]'); await a.waitForSelector(".cr-cal");
  assert(/CBT 16 anos/.test(await a.locator(".cr-cal").first().innerText()) || /CBT 16 anos/.test(await a.locator("main").innerText()), "torneio da Temporada no calendário");
  await a.click('[data-cal="prazo"]'); await a.waitForSelector('[data-cal="prazo"][aria-pressed="true"]');
  assert(!/Semana de provas/.test(await a.locator("main").innerText()) && /Bloco de devolução|Gravar uma partida/.test(await a.locator("main").innerText()), "filtro por tipo");
  await semRolagem(a, "atleta calendário"); await cap(a, "consultoria-atleta-calendario");
  await a.click('.cr-secoes a[href$="/equipe"]'); await a.waitForSelector(".cr-equipe >> text=João Prado");
  await a.click('[data-conv="treinador"]'); await a.waitForSelector(".cr-codigo");
  await cap(a, "consultoria-atleta-equipe");

  /* ── relatório publicado para a família e PDF ── */
  const rel = await API("richard", { acao: "salvarRelatorio", id, conteudo: { titulo: "Revisão de 45 dias", objetivo: "Consolidar a devolução", periodoDe: hoje, periodoAte: mais(45), prioridades: [{ titulo: "Devolução profunda", evidencias: "Partidas 1 e 3: devolução curta no segundo saque. Jogo contra Eva: mais profundidade.", evolucao: "Mais devoluções além da linha de saque.", dificuldades: "Fim de set." }], indicadores: [{ nome: "Devoluções fundas", valor: "4 de 10 → 6 de 10", fonte: "vídeos de out." }], proximasAcoes: "Seguir com o bloco de devolução.", decisoes: "Calendário de viagens do 1º semestre.", destinatarios: ["responsavel", "atleta"] } });
  await API("richard", { acao: "publicarRelatorio", id, itemId: rel.itemId });
  const m = await pagina("mae", "responsavel", 390);
  await m.goto(base + "/competicao/#/consultoria"); await m.waitForSelector(".cr-cab", { timeout: 20000 });
  assert(!(await m.content()).includes("RELATO-DA-ANA"), "relato do atleta não aparece para o responsável");
  await m.click('.cr-secoes a[href$="/evolucao"]'); await m.waitForSelector("text=Revisão de 45 dias");
  await m.click('a:has-text("Revisão de 45 dias")');
  await m.waitForSelector(".cr-relatorio");
  await semRolagem(m, "relatório no celular"); await cap(m, "consultoria-relatorio-celular");
  await m.evaluate(() => document.body.classList.add("cr-imprimindo")); await m.emulateMedia({ media: "print" });
  if (capturas) await m.pdf({ path: path.join(capturas, "consultoria-relatorio.pdf"), format: "A4", printBackground: true });
  const pdf = await m.pdf({ format: "A4", printBackground: true });
  assert(pdf.length > 20000, "PDF gerado");
  assert(await m.evaluate(() => getComputedStyle(document.querySelector(".cr-secoes")).display === "none" && getComputedStyle(document.querySelector(".cr-rel-cab img")).display !== "none"), "PDF sem menus, com o logo");
  await m.emulateMedia({ media: "screen" });
  await m.evaluate(() => document.body.classList.remove("cr-imprimindo"));
  /* iPhone/iPad: o botão gera o PDF no aparelho com as regras de impressão da página (sem os menus do app) */
  const LIB_PDF = process.env.HTML2PDF || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn/html2pdf-0.10.1/package/dist/html2pdf.bundle.min.js";
  if (fs.existsSync(LIB_PDF)) {
    await m.route("**/lib-teste/html2pdf.js", (r) => r.fulfill({ contentType: "text/javascript", body: fs.readFileSync(LIB_PDF) }));
    await m.evaluate(() => { QLImprimir.forcar = true; QLImprimir.LIB = location.origin + "/lib-teste/html2pdf.js"; });
    await m.click("#btPdf");
    await m.waitForFunction(() => !!window.__qlUltimoPDF, null, { timeout: 60000 });
    const bytes = Buffer.from(await m.evaluate(async () => Array.from(new Uint8Array(await window.__qlUltimoPDF.arrayBuffer()))));
    assert(bytes.length > 20000 && bytes.slice(0, 4).toString() === "%PDF", "PDF do iPhone gerado");
    if (capturas) fs.writeFileSync(path.join(capturas, "consultoria-relatorio-iphone.pdf"), bytes);
    assert(!(await m.evaluate(() => document.body.classList.contains("cr-imprimindo"))), "a tela volta ao normal depois do PDF");
    await m.evaluate(() => { QLImprimir.forcar = false; const a = document.getElementById("ql-pdf-aviso"); if (a) a.remove(); });
  }

  /* ── painel do administrador: lista e ativação manual ── */
  const ad = await pagina("richard", "treinador", 1280);
  await ad.goto(base + "/painel/"); await ad.fill("#segredo", "seg"); await ad.uncheck("#manter"); await ad.click("#fEntrar button[type=submit]");
  await ad.waitForSelector("#app:not([hidden])", { timeout: 20000 });
  await ad.goto(base + "/painel/#/consultoriaRT"); await ad.waitForSelector("h1 >> text=Consultoria com Richard Tsukada");
  assert(/Ana Lima/.test(await ad.locator("#conteudo").innerText()), "consultoria da Ana listada");
  assert(!/R\$|preço|checkout/i.test(await ad.locator("#conteudo").innerText().then((t) => t.replace("Sem preço, checkout ou cobrança", ""))), "sem preço ou cobrança no painel");
  await ad.fill("#crtEmail", "lia@exemplo.com"); await ad.click("#fCrt button");
  await ad.waitForSelector("#conteudo h3 >> text=Lia Rocha");
  await cap(ad, "consultoria-admin-painel");
  assert(Object.values(store).some((x) => x && x.atletaUid === "lia" && x.estado === "ativa" && x.ciclos), "ativada pelo painel");
  /* painel do consultor com dois atletas: computador (menu recolhido e aberto) e celular */
  await r.goto(base + "/competicao/#/consultoria"); await r.reload(); await r.waitForSelector(".crp-atleta >> text=Lia Rocha");
  assert.strictEqual(await r.locator(".crp-jornada").count(), 2, "jornada de cada atleta");
  assert(await r.locator('.crp-atleta:has-text("Ana Lima") .crp-jornada li[aria-current="step"]').count() === 1, "etapa atual marcada");
  assert(/Dia \d+ de 90/.test(await r.locator(".crp-atleta").first().innerText()), "andamento do ciclo em dias");
  await r.click('[data-pend="material"]'); await r.waitForSelector('[data-pend="material"][aria-pressed="true"]');
  assert.strictEqual(await r.locator(".crp-atleta").count(), 1, "Para hoje filtra"); await r.click('[data-pend="material"]'); await r.waitForSelector('.crp-atleta >> text=Ana Lima');
  await cap(r, "consultoria-painel-computador");
  await r.click("#btRecolher"); await r.waitForTimeout(300); await cap(r, "consultoria-painel-computador-recolhido"); await r.click("#btAbrirLateral");
  const rc = await pagina("richard", "treinador", 390); await rc.goto(base + "/competicao/#/consultoria"); await rc.waitForSelector(".crp-atleta >> text=Lia Rocha", { timeout: 20000 });
  await semRolagem(rc, "painel no celular"); await cap(rc, "consultoria-painel-celular");

  /* ── sem acesso ── */
  const z = await pagina("zeca", "atleta", 390);
  await z.goto(base + "/competicao/#/consultoria"); await z.waitForSelector("text=Como funciona", { timeout: 20000 });
  assert(/não promete bolsa/.test(await z.locator("main").innerText()));
  await z.goto(base + "/competicao/#/consultoria/" + id + "/plano"); await z.waitForSelector(".aviso >> text=Consultoria não encontrada");
  await cap(z, "consultoria-sem-acesso");

  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  console.log("smoke-consultoria-rt: ok");
  await browser.close(); servidor.close();
})().catch((e) => { console.error(e); process.exit(1); });
