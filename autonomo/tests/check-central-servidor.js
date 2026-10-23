/* Central do dono (netlify/functions/central.js) com Firebase falso: só o dono entra; números do Team Yoda e do 39 Ranch;
   QuadraLab pelo painel do administrador quando há segredo; gravação só da estrutura conhecida.
   Rode: node tests/check-central-servidor.js */
const assert = require("assert"), path = require("path"), Module = require("module");
const hoje = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10), ontem = new Date(Date.now() - 27 * 3600000).toISOString().slice(0, 10);
const banco = {
  "orgs/team-yoda/dados/mty:alunos:v2": [{ id: "a1", nome: "Ana", registros: [], pedidosReposicao: [{ status: "pendente" }] }, { id: "a2", nome: "Bia", registros: [] }],
  "orgs/team-yoda/dados/mty:turmas:v1": [{ id: "t1", nome: "Sub-12", membros: ["a1", "a2"] }],
  "orgs/team-yoda/dados/mty:ocorrencias:v1": [{ id: "o1", data: hoje, status: "agendada" }, { id: "o2", data: ontem, status: "agendada" }, { id: "o3", data: hoje, status: "cancelada" }],
  "orgs/39-ranch/dados/mty:reservas:v1": [{ id: "r1", quadraId: "q1", data: hoje, horaInicio: "08:00", horaFim: "09:00", origem: "cliente" }],
  "orgs/39-ranch/dados/mty:quadras:v1": [{ id: "q1", nome: "Central", faixasPreco: [{ inicio: "06:00", fim: "23:00", preco: "100" }] }],
};
const gravados = {};
const doc = (c) => ({ get: async () => { if (/^(financeiro|central)\//.test(c)) { const v = gravados[c]; return { exists: !!v, data: () => v }; } const v = banco[c]; return { exists: !!v, data: () => ({ value: JSON.stringify(v) }) }; },
  set: async (v) => { gravados[c] = v; }, collection: (x) => col(c + "/" + x) });
const col = (c) => ({ doc: (d) => doc(c + "/" + d), where: () => ({ get: async () => [] }) });
const adminFalso = { auth: () => ({ verifyIdToken: async (t) => { if (t === "dono") return { email: "tsukada.richard@gmail.com" }; if (t === "outro") return { email: "prof@x.com", role: "coordenador" }; throw new Error("x"); } }), firestore: () => ({ collection: (c) => col(c) }) };
const carregar = Module._load;
Module._load = function (pedido) { if (/_firebase-admin$/.test(pedido)) return { admin: adminFalso, app: () => {} }; return carregar.apply(this, arguments); };
let pedidoQL = null;
global.fetch = async (url, o) => { pedidoQL = { url, segredo: o.headers["x-admin-secret"] }; return { ok: true, json: async () => ({ player: { contas: 120, novas30: 14, assinaturasAtivas: 37, venceEm7: 3 }, financeiro: { confirmadoCentavos: 459000, aReceberCentavos: 89000 }, precisaDeVoce: [{ nivel: "alto", titulo: "Consultorias pagas sem entrega há 5 dias ou mais", n: 2 }] }) }; };
const fn = require(path.join(__dirname, "../../netlify/functions/central.js"));
const chamar = (m, token, extra) => fn.handler(Object.assign({ httpMethod: m, headers: token ? { authorization: "Bearer " + token } : {} }, extra)).then((r) => ({ status: r.statusCode, corpo: JSON.parse(r.body) }));

(async () => {
  assert.strictEqual((await chamar("GET", null)).status, 401);
  assert.strictEqual((await chamar("GET", "outro")).status, 403, "coordenador não vê a Central");
  assert.strictEqual((await chamar("POST", "outro", { body: "{}" })).status, 403);

  /* sem segredo do QuadraLab: só avisa que não está configurado */
  delete process.env.QUADRALAB_ADMIN_SECRET;
  let r = await chamar("GET", "dono");
  assert.strictEqual(r.status, 200); assert.deepStrictEqual(r.corpo.auto.quadralab, { configurado: false });
  const ty = r.corpo.auto["team-yoda"], rc = r.corpo.auto["39-ranch"];
  assert.strictEqual(ty.jogadores, 2); assert.strictEqual(ty.turmas, 1); assert.strictEqual(ty.aulasHoje, 1, "cancelada não conta"); assert.strictEqual(ty.aulasEmAberto, 1);
  assert.strictEqual(ty.pedidosReposicao, 1); assert.strictEqual(ty.semPreco, true, "turma sem preço avisada");
  assert.strictEqual(rc.entradas, 100, "39 Ranch: 1 h de quadra"); assert.strictEqual(rc.reservasNovas, 1);
  assert.deepStrictEqual(r.corpo.dados, { agenda: [], tarefas: [], negocios: {}, revisoes: {}, notas: [] }, "começa vazio");

  /* com segredo: números do QuadraLab pelo painel */
  process.env.QUADRALAB_ADMIN_SECRET = "s3gredo";
  r = await chamar("GET", "dono");
  assert.strictEqual(pedidoQL.segredo, "s3gredo"); assert(/quadralab\.com\.br\/\.netlify\/functions\/admin-painel\?secao=resumo$/.test(pedidoQL.url));
  const ql = r.corpo.auto.quadralab;
  assert.strictEqual(ql.assinaturasAtivas, 37); assert.strictEqual(ql.confirmado, 4590); assert.strictEqual(ql.aReceber, 890); assert.strictEqual(ql.precisaDeVoce[0].n, 2);
  global.fetch = async () => ({ ok: false, status: 401 });
  r = await chamar("GET", "dono"); assert(/respondeu 401/.test(r.corpo.auto.quadralab.erro), "erro do painel aparece sem derrubar a Central");

  /* gravação: limpa o que não é conhecido */
  const p = await chamar("POST", "dono", { body: JSON.stringify({ dados: {
    agenda: [{ id: "ag1", titulo: "Reunião com o clube", data: hoje, inicio: "10:00", fim: "11:00", negocio: "39-ranch", semanal: true }, { titulo: "", data: hoje }, { titulo: "sem data" }],
    tarefas: [{ id: "t1", titulo: "Fechar preços", negocio: "team-yoda", prazo: hoje, prioridade: "urgente" }, { titulo: "x", negocio: "???" }],
    negocios: { alvor: { metas: { "2026-11": { receita: "5000" } }, indicadores: { "2026-11": { receita: 4200, nota: "bom mês" }, "2026-13": { receita: 1 } }, links: [{ rotulo: "Site", url: "https://alvorhub.netlify.app" }, { rotulo: "ruim", url: "javascript:alert(1)" }] }, hack: { x: 1 } },
    revisoes: { [hoje]: { bem: "Muito", prioridades: ["A", "B", "C", "D", "E", "F"] } },
    notas: [{ texto: "Decidi abrir turma de sábado", decisao: true, negocio: "team-yoda", data: hoje }], extra: 1,
  } }) });
  assert.strictEqual(p.status, 200);
  const g = gravados["central/dono"].dados;
  assert.strictEqual(g.agenda.length, 1, "compromisso sem título ou sem data é descartado"); assert.strictEqual(g.agenda[0].semanal, true);
  assert.strictEqual(g.tarefas[0].prioridade, "media", "prioridade desconhecida vira média"); assert.strictEqual(g.tarefas[1].negocio, "geral");
  assert.strictEqual(g.negocios.alvor.metas["2026-11"].receita, 5000); assert(!g.negocios.alvor.indicadores["2026-13"], "mês inválido some");
  assert.deepStrictEqual(g.negocios.alvor.links.map((l) => l.rotulo), ["Site"], "só links https"); assert(!g.negocios.hack, "negócio desconhecido some");
  assert.strictEqual(g.revisoes[hoje].prioridades.length, 5, "até 5 prioridades"); assert(!("extra" in g));
  r = await chamar("GET", "dono"); assert.strictEqual(r.corpo.dados.tarefas[0].titulo, "Fechar preços", "lê o que gravou");
  console.log("check-central-servidor: ok");
})().catch((e) => { console.error(e); process.exit(1); });
