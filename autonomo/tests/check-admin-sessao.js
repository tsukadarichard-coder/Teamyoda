/* Sessão do painel: segredo digitado uma vez, cookie HttpOnly de 30 dias, proteção contra pedidos forjados, revogação e troca de segredo.
   Rode: node tests/check-admin-sessao.js */
const path = require("path"), assert = require("assert");
const fx = path.join(__dirname, "../netlify/functions/");
const store = {}; const J = (v) => JSON.parse(JSON.stringify(v));
function docRef(p) { return { id: p.split("/").pop(), async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), data: () => J(v) }; }, async set(v) { store[p] = J(v); }, async update(v) { Object.assign(store[p], J(v)); } }; }
function colRef(p) { const ids = () => Object.keys(store).filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/")); return { doc: (id) => docRef(p + "/" + id), where: () => colRef(p), limit: () => colRef(p), async get() { const d = ids().map((k) => ({ id: k.split("/").pop(), data: () => J(store[k]) })); return { docs: d, size: d.length, empty: !d.length, forEach: (f) => d.forEach(f) }; } }; }
const admin = { firestore: () => ({ collection: (n) => colRef(n), collectionGroup: () => ({ async get() { return { docs: [], size: 0, forEach() {} }; } }) }) };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };
process.env.ADMIN_SECRET = "segredo-do-painel";
const A = require(fx + "_admin-auth.js"), S = require(fx + "admin-sessao.js").handler, P = require(fx + "admin-painel.js").handler, F = require(fx + "admin-financeiro.js").handler;

const sessao = (metodo, corpo, h) => S({ httpMethod: metodo, headers: h || {}, body: corpo ? JSON.stringify(corpo) : undefined }).then((r) => ({ s: r.statusCode, cookie: r.headers["set-cookie"] || "", ...JSON.parse(r.body) }));
const ping = (h) => P({ httpMethod: "GET", headers: h || {}, queryStringParameters: { secao: "ping" } }).then((r) => r.statusCode);
const comCookie = (c, extra) => Object.assign({ cookie: c, "x-painel": "1" }, extra || {});
const pegarCookie = (sc) => sc.split(";")[0];

(async () => {
  /* sem sessão e sem segredo: 401 sem gastar tentativas */
  assert.strictEqual((await sessao("GET")).s, 401);
  for (let i = 0; i < 30; i++) await ping({});
  assert.ok(!Object.keys(store).some((k) => k.startsWith("adminTentativas/")), "pedido sem credencial não conta como tentativa errada");

  /* entrar com o segredo certo grava o cookie com as proteções */
  const ruim = await sessao("POST", { acao: "entrar" }, { "x-admin-secret": "errado" }); assert.strictEqual(ruim.s, 401); assert.ok(!ruim.cookie);
  const ok = await sessao("POST", { acao: "entrar" }, { "x-admin-secret": "segredo-do-painel" }); assert.strictEqual(ok.s, 200);
  assert.ok(/^ql_adm=[\w-]+\.[\w-]+;/.test(ok.cookie)); for (const f of ["HttpOnly", "Secure", "SameSite=Strict", "Max-Age=2592000", "Path=/.netlify/functions"]) assert.ok(ok.cookie.includes(f), "cookie com " + f);
  assert.ok(!ok.cookie.includes("segredo-do-painel"), "o segredo não vai para o cookie");
  const ck = pegarCookie(ok.cookie);

  /* a sessão vale nas functions do painel, sem o segredo */
  assert.strictEqual(await ping(comCookie(ck)), 200);
  assert.strictEqual((await F({ httpMethod: "GET", headers: comCookie(ck) })).statusCode, 200);
  assert.strictEqual((await sessao("GET", null, comCookie(ck))).s, 200);
  /* sem o cabeçalho x-painel o cookie sozinho não vale (barra pedidos forjados de outro site) */
  assert.strictEqual(await ping({ cookie: ck }), 401);
  /* cookie adulterado, de outra chave ou vencido */
  const [corpo, ass] = ck.slice(7).split(".");
  assert.strictEqual(await ping(comCookie("ql_adm=" + corpo + "." + ass.slice(0, -2) + "xx")), 401, "assinatura alterada");
  const forjado = Buffer.from(JSON.stringify({ iat: Date.now(), exp: Date.now() + 9e9, n: "x" })).toString("base64url");
  assert.strictEqual(await ping(comCookie("ql_adm=" + forjado + "." + ass)), 401, "corpo forjado com assinatura velha");
  assert.strictEqual(await ping(comCookie("ql_adm=" + A.emitirToken(Date.now() - 31 * 86400000))), 401, "sessão de mais de 30 dias");
  assert.strictEqual(await ping(comCookie("ql_adm=" + A.emitirToken(Date.now() + 3600000))), 401, "sessão datada do futuro");
  assert.strictEqual(await ping(comCookie("outro=1; ql_adm=" + ck.slice(7))), 200, "acha o cookie entre vários");

  /* renovação: sessão com mais de 3 dias ganha cookie novo */
  const velho = "ql_adm=" + A.emitirToken(Date.now() - 5 * 86400000), ren = await sessao("GET", null, comCookie(velho)); assert.strictEqual(ren.s, 200); assert.ok(ren.renovada && ren.cookie.includes("ql_adm="));

  /* o segredo continua valendo como antes (admin.html e scripts) */
  assert.strictEqual(await ping({ "x-admin-secret": "segredo-do-painel" }), 200);
  assert.strictEqual(await ping({ "x-admin-secret": "errado" }), 401);

  /* sair apaga o cookie deste aparelho */
  const sai = await sessao("POST", { acao: "sair" }); assert.strictEqual(sai.s, 200); assert.ok(sai.cookie.includes("Max-Age=0"));

  /* "sair de todos": exige sessão; invalida o que foi emitido antes, mas uma nova entrada logo depois funciona */
  assert.strictEqual((await sessao("POST", { acao: "sairTodos" })).s, 401);
  const todos = await sessao("POST", { acao: "sairTodos" }, comCookie(ck)); assert.strictEqual(todos.s, 200);
  A._zerarCache && A._zerarCache();
  assert.strictEqual(await ping(comCookie(ck)), 401, "sessão antiga foi revogada");
  const nova = await sessao("POST", { acao: "entrar" }, { "x-admin-secret": "segredo-do-painel" }); assert.strictEqual(await ping(comCookie(pegarCookie(nova.cookie))), 200, "nova entrada vale");

  /* trocar o ADMIN_SECRET derruba todas as sessões */
  const antes = pegarCookie(nova.cookie); process.env.ADMIN_SECRET = "outro-segredo";
  assert.strictEqual(await ping(comCookie(antes)), 401, "segredo trocado invalida as sessões");
  process.env.ADMIN_SECRET = "segredo-do-painel";

  /* sem ADMIN_SECRET configurado nada entra */
  delete process.env.ADMIN_SECRET; assert.strictEqual(await ping(comCookie(antes)), 401); assert.strictEqual((await sessao("POST", { acao: "entrar" }, { "x-admin-secret": "" })).s, 401);
  process.env.ADMIN_SECRET = "segredo-do-painel";

  /* limite de tentativas erradas no login */
  for (let i = 0; i < 15; i++) await sessao("POST", { acao: "entrar" }, { "x-admin-secret": "x" + i, "x-nf-client-connection-ip": "9.9.9.9" });
  assert.strictEqual((await sessao("POST", { acao: "entrar" }, { "x-admin-secret": "x", "x-nf-client-connection-ip": "9.9.9.9" })).s, 429);
  console.log("check-admin-sessao: ok");
})().catch((e) => { console.error(e); process.exit(1); });
