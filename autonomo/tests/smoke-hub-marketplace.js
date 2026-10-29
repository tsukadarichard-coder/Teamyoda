/* QuadraLab Hub no navegador, ponta a ponta, com as functions de verdade sobre um Firestore em memória:
   Treinador (plano grátis vê a venda; Essencial monta o perfil, vê a prévia e publica) → Player encontra, vê o perfil e pede →
   Treinador responde e envia proposta → Player aceita → conclusão confirmada → avaliação; Competição em azul; celular sem rolagem lateral.
   Usa React/Babel locais para a tela do Treinador (defina CDN_DIR). Rode: node tests/smoke-hub-marketplace.js  (capturas em tests/capturas-hub/) */
const http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const AULAS_MES_JS=require("fs").readFileSync(require("path").join(__dirname,"../../mty/aulas-mes.js"),"utf8");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("smoke-hub-marketplace: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
/* o Hub está desligado enquanto o Treinador e o Player são validados separados (LIGACAO_PLAYER no index.html; ver tests/check-apps-separados.js) */
if (/const LIGACAO_PLAYER = false;/.test(fs.readFileSync(path.join(__dirname, "../index.html"), "utf8"))) { console.log("smoke-hub-marketplace: pulado (Hub desligado: LIGACAO_PLAYER = false)"); process.exit(0); }
const raiz = path.join(__dirname, ".."), fx = path.join(raiz, "netlify/functions/");
const saida = path.join(__dirname, "capturas-hub"); fs.mkdirSync(saida, { recursive: true });

const store = {}; let seq = 0; const J = (v) => JSON.parse(JSON.stringify(v));
function merge(a, b) { const o = { ...a }; for (const k of Object.keys(b)) o[k] = b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) ? merge(a[k] || {}, b[k]) : b[k]; return o; }
function docRef(p) { return { id: p.split("/").pop(), async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), ref: docRef(p), data: () => J(v) }; }, async set(v, o) { store[p] = o && o.merge ? merge(store[p] || {}, J(v)) : J(v); }, async update(v) { Object.assign(store[p], J(v)); }, async delete() { delete store[p]; }, collection: (s) => colRef(p + "/" + s) }; }
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
const USUARIOS = {
  "t-carla": { uid: "carlaprof01", email: "carla@exemplo.com", name: "Carla", orgId: "carla-org" },
  "t-gil": { uid: "gilprof0001", email: "gil@exemplo.com", name: "Gil", orgId: "gil-org" },
  "t-ana": { uid: "anajogadora", email: "ana@exemplo.com", name: "Ana" },
  "t-mae": { uid: "maeresp0001", email: "marta@exemplo.com", name: "Marta" },
};
const admin = { firestore: () => ({ collection: (n) => colRef(n) }), auth: () => ({ verifyIdToken: async (t) => { if (!USUARIOS[t]) throw new Error("x"); return USUARIOS[t]; } }) };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".png": "image/png", ".json": "application/json", ".svg": "image/svg+xml", ".jpg": "image/jpeg" };
const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
const corte = ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const corpoTreinador = ms.slice(0, corte) + `
function Host(){ const [aba,setAba]=useState(location.hash==="#pedidos"?"hubPedidos":"hubPerfil"); window.__aba=setAba;
 return <div style={{padding:"16px",maxWidth:760}}>{aba==="hubPerfil"?<TelaPerfilProfissional planoAtual={window.__plano} planoVencido={false} emailAtual="carla@exemplo.com" aoAbrirPedidos={()=>setAba("hubPedidos")}/>:<TelaPedidosAtendimento aoAbrirPerfil={()=>setAba("hubPerfil")}/>}</div>; }
ReactDOM.createRoot(document.getElementById("root")).render(<Host />);`;
const paginaTreinador = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><div id=root></div><script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script><script>${AULAS_MES_JS}</script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};window.mtyAuth={usuario:()=>({uid:"x",email:"carla@exemplo.com"}),tokenId:async()=>window.__TOKEN};</script>
<script src=/scout/graficos.js></script><script src=/scout/ao-vivo.js></script><script src=/scout/relatorio-jogos.js></script><script src=/scout/movimento-motor.js></script><script src=/metodo/metodo-proprio.js></script><script src=/scout/evidencias.js></script><script src=/scout/movimento.js></script><script src=/scout/video-segmentador.js></script><script src=/scout/video-jogo.js></script>
<script type="text/babel">${corpoTreinador}</script>`;
const CDNMAP = { "/r.js": CDN + "/react-18.3.1/package/umd/react.development.js", "/d.js": CDN + "/react-dom-18.3.1/package/umd/react-dom.development.js", "/p.js": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "/c.js": CDN + "/recharts-2.15.4/package/umd/Recharts.js", "/b.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js" };

const servidor = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/__treinador") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return res.end(paginaTreinador); }
  if (CDNMAP[u.pathname]) { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(fs.readFileSync(CDNMAP[u.pathname])); }
  if (u.pathname.startsWith("/.netlify/functions/")) {
    const nome = u.pathname.split("/").pop(); let corpo = ""; req.on("data", (d) => (corpo += d));
    req.on("end", async () => {
      try {
        const r = await require(fx + nome + ".js").handler({ httpMethod: req.method, headers: req.headers, body: corpo || null, queryStringParameters: Object.fromEntries(u.searchParams) });
        res.writeHead(r.statusCode, r.headers || { "content-type": "application/json" }); res.end(r.isBase64Encoded ? Buffer.from(r.body, "base64") : r.body);
      } catch (e) { res.writeHead(500); res.end(JSON.stringify({ erro: String(e.message) })); }
    });
    return;
  }
  let f = path.join(raiz, decodeURIComponent(u.pathname)); if (u.pathname.endsWith("/")) f = path.join(f, "index.html");
  if (!f.startsWith(raiz) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end("não encontrado"); }
  res.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); res.end(fs.readFileSync(f));
});
const stubFirebase = (tok, uid, email) => `(function(){var cbs=[],u={uid:"${uid}",email:"${email}",displayName:"",getIdToken:function(){return Promise.resolve("${tok}")}},a={currentUser:u,languageCode:"",onAuthStateChanged:function(cb){cbs.push(cb);setTimeout(function(){cb(a.currentUser)},0)},signOut:function(){a.currentUser=null;cbs.forEach(function(c){c(null)});return Promise.resolve()}};window.firebase={initializeApp:function(){},auth:function(){return a}};})();`;

(async () => {
  const hoje = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10), ano = +hoje.slice(0, 4);
  const ate = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10);
  store["orgs/carla-org/meta/info"] = { nome: "Carla", plano: "essencial", planoAtivoAte: ate };
  store["orgs/gil-org/meta/info"] = { nome: "Gil", plano: "gratis" };
  store["jogadores/anajogadora"] = { nome: "Ana Lima", email: "ana@exemplo.com", criadoEm: "2026-09-01T10:00:00Z", competicao: { papel: "atleta", nascimento: (ano - 30) + "-02-02" }, ficha: { nivel: "intermediario", mao: "destro", backhand: "duas", piso: "saibro", armaPrincipal: "forehand", pontoFraco: "backhand", padraoPonto: "construtor", rede: "convidado", devolucao: "segura", pressao: "mantem", adversario: {} } };
  store["jogadores/maeresp0001"] = { nome: "Marta Pereira", email: "marta@exemplo.com", criadoEm: "2026-09-01T10:00:00Z", competicao: { papel: "responsavel" } };
  await new Promise((r) => servidor.listen(0, r));
  const base = "http://localhost:" + servidor.address().port;
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const erros = [];
  async function pagina(tok, largura) {
    const us = USUARIOS[tok];
    const ctx = await browser.newContext({ viewport: { width: largura || 390, height: 844 } });
    await ctx.route("https://www.gstatic.com/firebasejs/**", (r) => r.fulfill({ contentType: "text/javascript", body: r.request().url().includes("app-compat") ? stubFirebase(tok, us.uid, us.email) : "" }));
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    const pg = await ctx.newPage();
    pg.on("pageerror", (e) => erros.push(tok + ": " + e.message));
    pg.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_FAILED|404|\[BABEL\] Note/.test(m.text())) erros.push(tok + " c: " + m.text().slice(0, 200)); });
    pg.on("dialog", (d) => d.accept());
    return pg;
  }
  async function treinador(tok, plano, hash) {
    const pg = await pagina(tok, 390);
    await pg.addInitScript((v) => { window.__TOKEN = v[0]; window.__plano = v[1]; }, [tok, plano]);
    await pg.goto(base + "/__treinador" + (hash || ""));
    await pg.waitForSelector(hash === "#pedidos" ? "[data-hub-pedidos]" : "[data-hub-perfil] [data-hub-estado], [data-hub-perfil] [role=alert]", { timeout: 120000 });
    return pg;
  }
  const txt = (pg) => pg.evaluate(() => document.body.innerText);
  const cap = (pg, nome) => pg.screenshot({ path: path.join(saida, nome + ".png"), fullPage: true });
  const semRolagem = async (pg, onde) => assert.ok(await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "sem rolagem horizontal: " + onde);

  /* 1a. plano grátis: rascunho e prévia, publicação bloqueada com a explicação comercial */
  let pg = await treinador("t-gil", "gratis");
  let t = await txt(pg);
  assert.ok(t.includes("Organize suas aulas e seja encontrado por novos jogadores.") && t.includes("A quantidade de contatos depende da procura, da região e dos serviços oferecidos."), "venda no plano grátis");
  assert.ok(await pg.isDisabled('button:has-text("Publicar perfil")'), "grátis não publica");
  await cap(pg, "01-treinador-gratis"); await pg.context().close();

  /* 1b. Essencial: montar o perfil, salvar rascunho, prévia e publicar com confirmação */
  pg = await treinador("t-carla", "essencial");
  assert.strictEqual(await pg.textContent("[data-hub-estado]"), "Rascunho");
  await pg.fill('[aria-label="Nome profissional"]', "Carla Souza");
  await pg.fill('[aria-label="Apresentação"]', "Treinadora de tênis com foco em técnica e tomada de decisão.");
  await pg.fill('[aria-label="Cidade"]', "Itajaí"); await pg.fill('[aria-label="UF"]', "sc");
  await pg.fill('[aria-label="Locais públicos de atendimento"]', "Clube Municipal de Tênis");
  await pg.click('[aria-label="Modalidade"] button:has-text("Presencial e remoto")');
  for (const x of ["Juvenis", "Adultos"]) await pg.click('[aria-label="Públicos"] button:has-text("' + x + '")');
  for (const x of ["Iniciante", "Intermediário"]) await pg.click('[aria-label="Níveis"] button:has-text("' + x + '")');
  await pg.click('[aria-label="Seg Tarde"]'); await pg.click('[aria-label="Qua Tarde"]');
  await pg.click('button:has-text("+ Adicionar serviço")');
  await pg.fill('[aria-label="Nome do serviço 1"]', "Aula particular");
  await pg.fill('[aria-label="Valor em reais do serviço 1"]', "150");
  await pg.click('button:has-text("Salvar rascunho")');
  await pg.waitForFunction(() => document.body.innerText.includes("Rascunho salvo."));
  await pg.click('[role=tab]:has-text("Prévia pública")');
  await pg.waitForSelector("[data-hub-previa]");
  t = await txt(pg); assert.ok(t.includes("R$ 150,00 por aula") && t.includes("Experiência e formação informadas pelo profissional."), "prévia com preço e unidade");
  await semRolagem(pg, "prévia do treinador"); await cap(pg, "02-treinador-previa");
  await pg.click('[role=tab]:has-text("Editar")');
  await pg.check('text=Quero publicar meu perfil no QuadraLab Player e Competição');
  await pg.click('button:has-text("Publicar perfil")');
  await pg.waitForFunction(() => document.querySelector("[data-hub-estado]").textContent === "Publicado");
  assert.ok((await txt(pg)).includes("Seu perfil está publicado. Mantenha seus serviços e sua disponibilidade atualizados."), "vazio do treinador publicado");
  await semRolagem(pg, "perfil do treinador"); await cap(pg, "03-treinador-publicado"); await pg.context().close();

  /* 2. Player encontra (laranja) */
  pg = await pagina("t-ana", 390);
  await pg.goto(base + "/player/#/inicio"); await pg.waitForSelector(".hub-inicio", { timeout: 15000 });
  assert.ok((await txt(pg)).includes("Encontre um treinador para o seu objetivo."));
  await pg.click('.hub-inicio a:has-text("Encontrar um treinador")');
  await pg.waitForSelector("#fHub"); await pg.fill("#hCidade", "Manaus"); await pg.click('#fHub label:has-text("Presencial")'); await pg.click('#fHub button[type=submit]');
  await pg.waitForSelector(".hub-vazio"); t = await txt(pg);
  assert.ok(t.includes("Ainda não encontramos profissionais com esses filtros.") && t.includes("Ampliar a região") && t.includes("Ver atendimento remoto"), "vazio com saídas");
  await cap(pg, "04-player-sem-resultado");
  await pg.click('[data-ajuste="remoto"]'); await pg.waitForSelector(".hub-card", { timeout: 8000 });
  assert.ok((await txt(pg)).includes("Carla Souza"), "remoto aparece em outra cidade");
  await pg.fill("#hCidade", "Itajaí"); await pg.click('#fHub label:has-text("Todos")'); await pg.click('#fHub button[type=submit]');
  await pg.waitForSelector(".hub-card"); t = await txt(pg);
  assert.ok(t.includes("Itajaí · SC") && t.includes("R$ 150,00 por aula") && t.includes("Aceitando novos alunos") && t.includes("nunca pagamento por destaque"));
  const corBotao = await pg.evaluate(() => getComputedStyle(document.querySelector("#fHub .btn-laranja")).backgroundColor);
  assert.ok(/rgb\((1[5-9]\d|2\d\d), (5\d|6\d|7\d|8\d), (1\d|2\d|3\d)\)/.test(corBotao), "Player em laranja: " + corBotao);
  await semRolagem(pg, "busca do Player"); await cap(pg, "05-player-busca");
  await pg.click('.hub-card a:has-text("Ver perfil")'); await pg.waitForSelector(".hub-perfil");
  t = await txt(pg); assert.ok(t.includes("Consultar disponibilidade") && t.includes("Experiência e formação informadas pelo profissional.") && t.includes("Denunciar este perfil"));
  await semRolagem(pg, "perfil público"); await cap(pg, "06-player-perfil");

  /* 3. pedido: pré-preenchido, prévia exata, validação e envio único */
  await pg.click('a:has-text("Consultar disponibilidade")'); await pg.waitForSelector("#fPedido");
  assert.strictEqual(await pg.inputValue("#pNivel"), "intermediario", "nível vem da ficha");
  await pg.selectOption("#pObj", "tecnica"); await pg.fill("#pMsg", "Quero melhorar o backhand.");
  await pg.click("#btEnviar"); await pg.waitForSelector("#pErro:not([hidden])");
  assert.ok((await pg.textContent("#pErro")).includes("dia e turno"), "valida dias");
  await pg.click('#fPedido [aria-label="Seg Tarde"]');
  t = await pg.textContent("#previaPedido"); assert.ok(t.includes("Ana Lima") && t.includes("Melhorar a técnica") && t.includes("Seg tarde") && t.includes("Quero melhorar o backhand."), "prévia do que será compartilhado: " + t);
  assert.ok((await txt(pg)).includes("Seu pedido será enviado a este profissional. Disponibilidade, valor e condições serão combinados diretamente."));
  await semRolagem(pg, "formulário do pedido"); await cap(pg, "07-player-pedido");
  await pg.click("#btEnviar"); await pg.waitForSelector(".hub-enviado");
  assert.ok((await txt(pg)).includes("Pedido enviado. Você poderá acompanhar a resposta em Meus atendimentos."));
  assert.strictEqual(Object.keys(store).filter((k) => /^hubPedidos\/[^/]+$/.test(k)).length, 1);
  await pg.goto(base + "/player/#/treinadores"); await pg.waitForSelector("#fHub");
  await pg.goto(base + "/player/#/treinador/carlaprof01/pedir"); await pg.waitForSelector("#fPedido", { timeout: 8000 }).catch(async (e) => { console.log("TELA:", (await txt(pg)).slice(0, 600), await pg.evaluate(() => location.hash), erros); throw e; });
  await pg.selectOption("#pObj", "tecnica"); await pg.click('#fPedido [aria-label="Seg Tarde"]'); await pg.click("#btEnviar");
  await pg.waitForFunction(() => /Já existe um pedido em andamento/.test(document.getElementById("pErro").textContent));
  assert.strictEqual(Object.keys(store).filter((k) => /^hubPedidos\/[^/]+$/.test(k)).length, 1, "não duplica");
  const idPedido = Object.keys(store).find((k) => /^hubPedidos\/[^/]+$/.test(k)).split("/")[1];

  /* 4. treinador responde e envia proposta */
  let tr = await treinador("t-carla", "essencial", "#pedidos");
  await tr.waitForSelector("[data-hub-item]"); t = await txt(tr);
  assert.ok(t.includes("Ana Lima") && t.includes("Responda ao pedido"), "pedido na lista do treinador");
  await cap(tr, "08-treinador-pedidos");
  await tr.click("[data-hub-item]"); await tr.waitForSelector("[data-hub-conversa]");
  assert.ok((await txt(tr)).includes("Quero melhorar o backhand."), "pedido original na conversa");
  await tr.fill('[aria-label="Mensagem"]', "Olá, Ana! Tenho horário na segunda."); await tr.click('[data-hub-conversa] button:has-text("Enviar")');
  await tr.waitForFunction(() => document.body.innerText.includes("Tenho horário na segunda"));
  await tr.click('button:has-text("Enviar proposta")'); await tr.waitForSelector("[data-hub-form-proposta]");
  await tr.click('[data-hub-form-proposta] button:has-text("Enviar proposta")');
  await tr.waitForFunction(() => /Informe o serviço/.test(document.body.innerText), null, { timeout: 8000 });
  await tr.fill('[aria-label="Serviço da proposta"]', "Aula particular");
  await tr.fill('[aria-label="Local da proposta"]', "Clube Municipal de Tênis"); await tr.fill('[aria-label="Combinação de horário"]', "Segundas às 15h");
  await tr.fill('[aria-label="Quantidade ou período"]', "4 aulas em 1 mês"); await tr.fill('[aria-label="Valor total"]', "560");
  await tr.selectOption('[aria-label="Unidade da proposta"]', "pacote");
  await tr.fill('[aria-label="Forma de pagamento"]', "Pix direto para a treinadora"); await tr.fill('[aria-label="Condições de cancelamento"]', "Avisar com 24 horas");
  await tr.click('[data-hub-form-proposta] button:has-text("Enviar proposta")');
  await tr.waitForSelector('[data-hub-proposta="1"]', { timeout: 8000 }).catch(async (e) => { console.log("TELA:", (await txt(tr)).slice(0, 1500)); throw e; }); assert.ok((await txt(tr)).includes("R$ 560,00 por pacote"));
  await semRolagem(tr, "conversa do treinador"); await cap(tr, "09-treinador-proposta");

  /* 5. jogador vê em Meus atendimentos e aceita */
  await pg.goto(base + "/player/#/atendimentos"); await pg.waitForSelector(".hub-item", { timeout: 10000 });
  t = await txt(pg); assert.ok(t.includes("Treinadores do QuadraLab Hub") && t.includes("Proposta enviada") && t.includes("Aceite, recuse ou peça ajuste"), "Meus atendimentos com status e próxima ação");
  assert.ok(await pg.locator(".hub-badge").count() >= 1, "não lidas separadas do status");
  await cap(pg, "10-player-meus-atendimentos");
  await pg.click(".hub-item-link"); await pg.waitForSelector("[data-aceitar]");
  await semRolagem(pg, "conversa do jogador"); await cap(pg, "11-player-conversa");
  await pg.click("[data-aceitar]"); await pg.waitForFunction(() => /Combinado/.test((document.getElementById("hubStatus") || {}).textContent || ""));
  assert.strictEqual(store["hubPedidos/" + idPedido].aceite.versao, 1);
  assert.ok(!(await txt(pg)).includes("Pago"), "nada de pago");

  /* 6–7. conclusão confirmada e avaliação */
  await tr.reload(); await tr.waitForSelector("[data-hub-pedidos]"); await tr.click("[data-hub-item]"); await tr.waitForSelector("[data-hub-conversa]");
  await tr.click('button:has-text("Marcar atendimento como concluído")'); await tr.waitForFunction(() => document.body.innerText.includes("Aguardando a confirmação"));
  await pg.reload(); await pg.waitForSelector("[data-concluir]"); await pg.click("[data-concluir]");
  await pg.waitForSelector("#fAval"); await pg.click('#fAval label:has-text("★★★★★")'); await pg.fill("#avTxt", "Aulas muito bem organizadas."); await pg.click('#fAval button[type=submit]');
  await pg.waitForFunction(() => document.body.innerText.includes("Sua avaliação"));
  await pg.goto(base + "/player/#/treinador/carlaprof01"); await pg.waitForSelector(".hub-perfil");
  t = await txt(pg); assert.ok(t.includes("Aulas muito bem organizadas.") && t.includes("Avaliação de um atendimento concluído") && !/compra verificada/i.test(t));
  await cap(pg, "12-player-perfil-avaliado");
  await pg.context().close(); await tr.context().close();

  /* Competição (azul), responsável, celular estreito */
  pg = await pagina("t-mae", 320);
  await pg.goto(base + "/competicao/#/treinadores"); await pg.waitForSelector("#fHub", { timeout: 15000 });
  assert.strictEqual(await pg.inputValue("#hObj"), "torneios", "Competição prioriza torneios");
  t = await txt(pg); assert.ok(t.includes("Profissionais para preparar torneios"));
  const corComp = await pg.evaluate(() => getComputedStyle(document.querySelector("#fHub .btn-laranja")).backgroundColor);
  assert.strictEqual(corComp, "rgb(18, 66, 204)", "Competição em azul");
  await pg.waitForSelector(".hub-card, .hub-vazio");
  await semRolagem(pg, "busca da Competição 320px"); await cap(pg, "13-competicao-busca");
  await pg.goto(base + "/competicao/#/atendimentos"); await pg.waitForSelector("#hubAtend .cartao, #hubAtend .hub-item");
  assert.ok((await txt(pg)).includes("Meus atendimentos")); await semRolagem(pg, "Meus atendimentos Competição");
  await pg.context().close();

  /* Hub (site): seção de profissionais */
  pg = await pagina("t-ana", 390);
  await pg.goto(base + "/hub/index.html"); await pg.waitForSelector("#profissionais");
  t = await txt(pg); assert.ok(t.includes("Encontre profissionais para cada etapa do seu tênis.") && t.includes("Conheça treinadores, consulte serviços e combine seu atendimento diretamente pela plataforma."));
  await semRolagem(pg, "Hub"); await pg.locator("#profissionais").screenshot({ path: path.join(saida, "14-hub-secao.png") });
  await pg.context().close();

  assert.deepStrictEqual(erros, [], "erros de JavaScript");
  console.log("smoke-hub-marketplace: ok (" + fs.readdirSync(saida).length + " capturas em " + saida + ")");
  await browser.close(); servidor.close();
})().catch((e) => { console.error(e); process.exit(1); });
