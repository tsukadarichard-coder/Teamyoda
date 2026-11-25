/* Central › Tarefas do administrativo (25/11/2026): regras puras de _central-tarefas.js e as ações da function central.js
   (quem cria, quem muda o status, avisos). Rode: node autonomo/tests/check-central-tarefas.js */
const path = require("path"), assert = require("assert");
const TF = require(path.join(__dirname, "../../netlify/functions/_central-tarefas.js"));
const t0 = "2026-11-20T12:00:00.000Z", t1 = "2026-11-21T12:00:00.000Z", t2 = "2026-11-22T12:00:00.000Z";

assert.throws(() => TF.nova({ titulo: "ab" }, "Richard", t0), /pelo menos 3/);
const a = TF.nova({ titulo: "  Ligar   para a família ", detalhe: "x".repeat(1500), prazo: "2026-11-21", prioridade: "alta" }, "Richard", t0);
assert.strictEqual(a.titulo, "Ligar para a família"); assert.strictEqual(a.detalhe.length, 1000); assert.strictEqual(a.status, "nova"); assert.strictEqual(a.prioridade, "alta");
const b = TF.nova({ titulo: "Planilha", prazo: "21/11/2026", prioridade: "urgente" }, "Richard", t0);
assert.strictEqual(b.prazo, ""); assert.strictEqual(b.prioridade, "normal");
let l = [a, b];
l = TF.mudarStatus(l, a.id, "andamento", "", "Administrativo", t1);
assert.strictEqual(l[0].status, "andamento"); assert.strictEqual(l[0].historico[1].acao, "começou");
l = TF.mudarStatus(l, a.id, "concluida", "feito", "Administrativo", t2);
assert.strictEqual(l[0].concluidaEm, t2); assert.deepStrictEqual(l[0].historico[2], { em: t2, por: "Administrativo", acao: "concluiu", comentario: "feito" });
l = TF.mudarStatus(l, a.id, "andamento", "", "Richard", t2);
assert.strictEqual(l[0].historico[3].acao, "reabriu"); assert.strictEqual(l[0].concluidaEm, "");
l = TF.mudarStatus(l, b.id, "", "olhei", "Administrativo", t2);
assert.strictEqual(l[1].status, "nova"); assert.strictEqual(l[1].historico[1].acao, "comentou");
assert.throws(() => TF.mudarStatus(l, b.id, "", "", "x", t2), /Nada/);
assert.throws(() => TF.mudarStatus(l, b.id, "feita", "", "x", t2), /inválido/);
assert.throws(() => TF.mudarStatus(l, "nao", "andamento", "", "x", t2), /não encontrada/);
l = TF.editar(l, b.id, { titulo: "Planilha de viagens", prazo: "2026-11-19" }, "Richard", t2);
assert.strictEqual(l[1].titulo, "Planilha de viagens"); assert.strictEqual(l[1].prazo, "2026-11-19");
const v = TF.vista(l, "2026-11-20");
assert.strictEqual(v.contagem.novas, 1); assert.strictEqual(v.contagem.andamento, 1); assert.strictEqual(v.contagem.atrasadas, 1);
assert(v.novas[0].atrasada && !v.andamento[0].atrasada);
assert.strictEqual(TF.apagar(l, b.id).length, 1);
/* limpar: até 300, saem primeiro as concluídas antigas */
const muitas = [...Array(320).keys()].map((i) => ({ id: "x" + i, status: i < 40 ? "concluida" : "nova", concluidaEm: i < 40 ? "2026-01-0" + ((i % 9) + 1) + "T00:00:00Z" : "" }));
const lim = TF.limpar(muitas, "2026-11-20T00:00:00Z");
assert(lim.length <= 300 && lim.filter((x) => x.status === "nova").length === 280, "abertas ficam");

/* ações pela function, com um Firestore falso */
const Module = require("module"), gravados = {}, enviados = [];
const doc = (c) => ({ get: async () => ({ exists: !!gravados[c], data: () => gravados[c] }), set: async (x) => { gravados[c] = JSON.parse(JSON.stringify(x)); } });
const consulta = (c) => { const f = []; const q = { where: (k, op, x) => { f.push([k, x]); return q; }, get: async () => { const l = Object.keys(gravados).filter((k) => k.startsWith(c + "/")).map((k) => ({ id: k.slice(c.length + 1), data: () => gravados[k] })).filter((d) => f.every(([k, x]) => d.data()[k] === x)); return { forEach: (fn) => l.forEach(fn), docs: l }; } }; return q; };
const col = (c) => ({ doc: (d) => doc(c + "/" + d), where: (k, op, x) => consulta(c).where(k, op, x), get: () => consulta(c).get() });
const adminFalso = { auth: () => ({ verifyIdToken: async (t) => (t === "dono" ? { email: "tsukada.richard" + "@gmail.com", uid: "u-ric" } : t === "adm" ? { email: "adm@x.com", uid: "u-adm" } : { email: "o@x.com", uid: "u-o" }) }), firestore: () => ({ collection: col, doc: (p) => doc(p) }) };
adminFalso.firestore.FieldValue = { serverTimestamp: () => Date.now(), increment: (n) => n, arrayUnion: (...x) => x, delete: () => undefined };
const carregar = Module._load;
Module._load = function (pedido) { if (/_firebase-admin$/.test(pedido)) return { admin: adminFalso, app: () => {} }; return carregar.apply(this, arguments); };
gravados["financeiro/_acesso"] = { admins: ["adm@x.com"] };
gravados["pushInscricoes/p1"] = { app: "central", uid: "u-adm", papel: "administrativo" };
gravados["pushInscricoes/p2"] = { app: "central", uid: "u-ric", papel: "richard" };
const PUSH = require(path.join(__dirname, "../../netlify/functions/_push.js"));
PUSH.enviarPara = async (ad, filtro, aviso) => { enviados.push({ filtro, aviso }); return 1; };
PUSH.avisar = async (ad, filtro, aviso) => { enviados.push({ filtro, aviso }); return 1; };
const central = require(path.join(__dirname, "../../netlify/functions/central.js"));
const chamar = async (quem, corpo) => { const r = await central.handler({ httpMethod: "POST", headers: { authorization: "Bearer " + quem }, body: JSON.stringify(corpo) }); return { st: r.statusCode, d: JSON.parse(r.body || "{}") }; };

(async () => {
  let r = await chamar("adm", { acao: "tarefaAdmCriar", tarefa: { titulo: "Tentativa" } });
  assert.strictEqual(r.st, 403, "administrativo não cria");
  r = await chamar("outro", { acao: "tarefasAdmVer" });
  assert(r.st === 403 || r.st === 401, "outra conta não vê: " + r.st);
  r = await chamar("dono", { acao: "tarefaAdmCriar", tarefa: { titulo: "Conferir as reservas", prazo: "2026-12-01" } });
  assert.strictEqual(r.st, 200, JSON.stringify(r.d)); assert.strictEqual(r.d.tarefasAdm.contagem.novas, 1);
  const id = r.d.tarefasAdm.novas[0].id;
  assert(enviados.some((e) => e.filtro.uid === "u-adm" && /Tarefa nova do Richard/.test(e.aviso.titulo)), "aviso ao administrativo: " + JSON.stringify(enviados));
  r = await chamar("adm", { acao: "tarefaAdmEditar", id, tarefa: { titulo: "Mudar" } });
  assert.strictEqual(r.st, 403, "administrativo não edita");
  r = await chamar("adm", { acao: "tarefaAdmApagar", id });
  assert.strictEqual(r.st, 403, "administrativo não apaga");
  r = await chamar("adm", { acao: "tarefaAdmStatus", id, status: "andamento" });
  assert.strictEqual(r.d.tarefasAdm.contagem.andamento, 1);
  enviados.length = 0;
  r = await chamar("adm", { acao: "tarefaAdmStatus", id, status: "concluida", comentario: "Tudo certo" });
  assert.strictEqual(r.d.tarefasAdm.contagem.concluidas, 1);
  assert(enviados.some((e) => e.filtro.uid === "u-ric" && /concluída/.test(e.aviso.titulo) && /Tudo certo/.test(e.aviso.corpo)), "aviso ao Richard");
  r = await chamar("adm", { acao: "tarefaAdmStatus", id: "nao-existe", status: "andamento" });
  assert.strictEqual(r.st, 400);
  r = await chamar("dono", { acao: "tarefaAdmApagar", id });
  assert.strictEqual(r.d.tarefasAdm.contagem.concluidas, 0);
  /* a leitura inicial já traz as tarefas, para o Richard e para o administrativo */
  const g = async (t) => JSON.parse((await central.handler({ httpMethod: "GET", headers: { authorization: "Bearer " + t } })).body);
  assert((await g("adm")).tarefasAdm, "GET do administrativo traz as tarefas");
  assert((await g("dono")).tarefasAdm, "GET do Richard traz as tarefas");
  console.log("check-central-tarefas: ok");
})().catch((e) => { console.error(e.stack || e); process.exit(1); });
