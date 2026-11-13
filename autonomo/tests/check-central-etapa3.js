/* Central Tsukada, Etapa 3: Rotina do Administrativo (_central-adm.js), os agentes do administrativo (Resumo, Faltas, Viagens),
   permissões (o administrativo edita; o Richard só vê; cada um mexe só nos rascunhos dele), o envio do resumo ao Richard e os
   avisos do expediente, com Firebase e IA falsos. Rode: node tests/check-central-etapa3.js */
const assert = require("assert"), path = require("path"), Module = require("module");
const FN = path.join(__dirname, "../../netlify/functions/");

const banco = {};
function doc(c, id) {
  const k = c + "/" + id;
  return {
    id, get: async () => ({ exists: k in banco, id, data: () => banco[k] }),
    set: async (v) => { if (JSON.stringify(v).includes("undefined")) throw new Error("valor undefined"); banco[k] = JSON.parse(JSON.stringify(v)); },
    create: async (v) => { if (k in banco) throw new Error("ALREADY_EXISTS"); banco[k] = JSON.parse(JSON.stringify(v)); },
    delete: async () => { delete banco[k]; }, collection: (x) => col(k + "/" + x),
  };
}
function col(c) {
  const f = [], st = {};
  const q = {
    doc: (id) => doc(c, id), where: (k, op, v) => { f.push([k, v]); return q; }, orderBy: (k, d) => { st.o = [k, d]; return q; }, limit: (n) => { st.n = n; return q; },
    get: async () => {
      let l = Object.keys(banco).filter((k) => k.startsWith(c + "/") && k.slice(c.length + 1).indexOf("/") < 0).map((k) => ({ id: k.slice(c.length + 1), data: () => banco[k] })).filter((d) => f.every(([k, v]) => d.data()[k] === v));
      if (st.o) l.sort((a, b) => (String(a.data()[st.o[0]]) < String(b.data()[st.o[0]]) ? -1 : 1) * (st.o[1] === "desc" ? -1 : 1));
      if (st.n) l = l.slice(0, st.n);
      return { forEach: (fn) => l.forEach(fn), docs: l, size: l.length };
    },
  };
  return q;
}
const USU = { ric: { uid: "u-ric", email: "tsukada.richard@gmail.com" }, adm: { uid: "u-adm", email: "adm@teamyoda.com" }, prof: { uid: "u-p", email: "prof@teamyoda.com", orgId: "team-yoda" } };
const adminFalso = { auth: () => ({ verifyIdToken: async (t) => { if (USU[t]) return USU[t]; throw new Error("x"); } }), firestore: () => ({ collection: (c) => col(c) }) };
const carregar = Module._load;
Module._load = function (pedido) { if (/_firebase-admin$/.test(pedido)) return { admin: adminFalso, app: () => {} }; return carregar.apply(this, arguments); };
process.env.PUSH_VAPID_PUBLICA = "BPublicaDeTeste"; process.env.PUSH_VAPID_PRIVADA = "privada"; process.env.URL = "https://teste.local";
delete process.env.QUADRALAB_ADMIN_SECRET; delete process.env.FINANCEIRO_DONOS; delete process.env.ANTHROPIC_API_KEY;

const hoje = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10), dia = (n) => { const d = new Date(hoje + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const AV = require(FN + "_central-avisos.js"), ADM = require(FN + "_central-adm.js"), AG = require(FN + "_central-agentes.js"), M = require(FN + "_central-agentes-motor.js");
const segAnt = AV.somaDias(AV.segundaDe(hoje), -7);
const salva = (k, v) => { banco["orgs/team-yoda/dados/" + k] = { value: JSON.stringify(v) }; };
salva("mty:alunos:v2", [
  { id: "a1", nome: "Lia Souza", criadoEm: segAnt + "T15:00:00.000Z", competicoes: [{ nome: "Copa Sul", data: dia(10) }] },
  { id: "a2", nome: "Caio Reis", criadoEm: "2026-01-10T10:00:00.000Z" },
  { id: "a3", nome: "Bia Lopes", criadoEm: "2026-01-10T10:00:00.000Z" },
]);
salva("mty:turmas:v1", []); salva("mty:ocorrencias:v1", []);
banco["financeiro/_acesso"] = { admins: ["adm@teamyoda.com"] };
banco["pushInscricoes/r"] = { app: "central", uid: "u-ric", papel: "richard", endpoint: "https://fcm.googleapis.com/r", keys: {} };
banco["pushInscricoes/a"] = { app: "central", uid: "u-adm", papel: "administrativo", endpoint: "https://fcm.googleapis.com/a", keys: {} };

const P = require(FN + "_push.js"), enviados = [];
P.enviarPara = async (a, filtro, aviso) => { enviados.push({ filtro, aviso }); return { enviados: 1, falhas: 0, removidos: 0 }; };
P.avisar = P.enviarPara;
global.fetch = async () => ({ ok: true, status: 202 });
const central = require(FN + "central.js");
const chamar = (quem, corpo, m) => central.handler({ httpMethod: m || "POST", headers: { authorization: "Bearer " + quem }, body: corpo ? JSON.stringify(corpo) : undefined }).then((r) => ({ status: r.statusCode, corpo: JSON.parse(r.body) }));
const ms = (d, h) => AV.momentoSP(d, h);
const ctxG = (ia) => ({ db: adminFalso.firestore(), agoraMs: ms(hoje, "12:00"), ia: ia === undefined ? null : ia, enviar: (f, a) => P.enviarPara(null, f, a) });

(async () => {
  /* ── regras: expediente de 4h, partes, semanais, mensais, fim de semana ── */
  const rot = ADM.padrao();
  let d = ADM.dia(rot, "2026-11-16"); // segunda
  assert.deepStrictEqual(d.horario, { inicio: "14:00", fim: "18:00" });
  assert.deepStrictEqual(d.partes.map((p) => p.id + " " + p.inicio + "-" + p.fim), ["inicio 14:00-15:00", "meio 15:00-17:00", "fim 17:00-18:00"]);
  assert.deepStrictEqual(d.partes.map((p) => p.itens.length), [3, 4, 3]);
  assert.ok(/resumo da semana anterior/.test(d.semanais[0].r) && d.semanais[0].agente === "resumoAdm", "segunda: resumo");
  assert.ok(/faltas/.test(ADM.dia(rot, "2026-11-18").semanais[0].r), "quarta: faltas");
  assert.ok(/semana seguinte/.test(ADM.dia(rot, "2026-11-20").semanais[0].r), "sexta: agenda e reservas");
  assert.deepStrictEqual(ADM.dia(rot, "2026-11-17").semanais, [], "terça sem semanal");
  const sab = ADM.dia(rot, "2026-11-21"); assert.ok(!sab.util && sab.partes.length === 0 && sab.total === 0, "sábado sem rotina");
  assert.ok(/depois do expediente/i.test(d.apos) && /22h/.test(d.apos));
  /* mensais: 1º dia útil de dezembro/2026 é 1/12 (terça); relatório até o dia 10; ciclo nos últimos dias */
  assert.strictEqual(ADM.primeiroDiaUtil("2026-11"), "2026-11-02", "1/11/2026 é domingo");
  assert.deepStrictEqual(ADM.dia(rot, "2026-12-01").mensais.map((x) => x.id), ["cobrancas", "relatorio"]);
  assert.deepStrictEqual(ADM.dia(rot, "2026-12-07").mensais.map((x) => x.id), ["cobrancas", "relatorio"], "cobranças continuam até feitas (até o dia 10)");
  ADM.marcar(rot, "2026-12-03", "cobrancas", true);
  assert.deepStrictEqual(ADM.dia(rot, "2026-12-07").mensais.map((x) => x.id), ["relatorio"], "feita, some dos dias seguintes");
  assert.deepStrictEqual(ADM.dia(rot, "2026-11-27").mensais.map((x) => x.id), ["ciclo"], "fim do mês: relatórios de ciclo");
  assert.deepStrictEqual(ADM.dia(rot, "2026-11-18").mensais, []);
  ADM.marcar(rot, "2026-11-16", "d-whats", true); ADM.marcar(rot, "2026-11-16", "s-resumo", true);
  d = ADM.dia(rot, "2026-11-16"); assert.strictEqual(d.feitos, 2); assert.strictEqual(d.total, 11);
  assert.throws(() => ADM.marcar(rot, "2026-11-16", "inventado", true), /desconhecido/);
  rot.inicio = "13:30"; assert.deepStrictEqual(ADM.dia(rot, "2026-11-17").horario, { inicio: "13:30", fim: "17:30" }, "horário configurável, 4 horas");
  rot.inicio = "14:00";
  /* viagens */
  ADM.salvarViagem(rot, { atleta: "Lia Souza", torneio: "Copa Sul", saida: "2026-11-19", volta: "2026-11-22", inscricao: true });
  assert.throws(() => ADM.salvarViagem(rot, { atleta: "", torneio: "x" }), /atleta e o torneio/);
  const vs = ADM.dia(rot, "2026-11-20").viagens; assert.strictEqual(vs.length, 1); assert.ok(vs[0].pendente, "falta hospedagem e transporte");
  /* avisos: começo de cada parte, só o que falta */
  const av = ADM.avisosDevidos(rot, ms("2026-11-16", "14:02"));
  assert.strictEqual(av.length, 1); assert.ok(/Início do expediente \(14:00 às 15:00\)/.test(av[0].aviso.titulo));
  assert.ok(!/Responder o WhatsApp/.test(av[0].aviso.corpo) && /Conferir a agenda do dia/.test(av[0].aviso.corpo), "o que já foi feito não aparece");
  assert.strictEqual(ADM.avisosDevidos(rot, ms("2026-11-16", "15:01"))[0].chave, "adm:2026-11-16:meio");
  assert.deepStrictEqual(ADM.avisosDevidos(rot, ms("2026-11-21", "14:02")), [], "sábado sem aviso");
  /* foto semanal → saídas */
  assert.strictEqual(ADM.saidas(rot), null, "sem foto anterior, não dá para contar saídas");
  ADM.atualizarFoto(rot, [{ id: "a1", nome: "Lia" }, { id: "a2", nome: "Caio" }], "2026-11-09");
  assert.strictEqual(ADM.atualizarFoto(rot, [], "2026-11-09"), false, "mesma semana não troca a foto");
  ADM.atualizarFoto(rot, [{ id: "a1", nome: "Lia" }], "2026-11-16");
  assert.deepStrictEqual(ADM.saidas(rot), ["Caio"]);

  /* ── permissões ── */
  assert.strictEqual((await chamar("prof", { acao: "admVer" })).status, 403, "professor não entra");
  assert.strictEqual((await chamar("ric", { acao: "admMarcar", data: hoje, id: "d-whats", feito: true })).status, 403, "o Richard só vê a rotina do administrativo");
  let r = await chamar("adm", { acao: "admMarcar", data: "2026-11-16", id: "d-whats", feito: true });
  assert.strictEqual(r.status, 200); assert.ok(banco["central/rotinaAdm"].dias["2026-11-16"].feitos["d-whats"]);
  r = await chamar("adm", { acao: "admHorario", inicio: "13:00" }); assert.strictEqual(r.corpo.rotinaAdm.horario.fim, "17:00");
  assert.strictEqual((await chamar("adm", { acao: "admHorario", inicio: "25:00" })).status, 400);
  r = await chamar("adm", { acao: "admPendencias", data: "2026-11-16", texto: "Ligar para a mãe da Bia" }); assert.strictEqual(banco["central/rotinaAdm"].dias["2026-11-16"].pendencias, "Ligar para a mãe da Bia");
  r = await chamar("adm", { acao: "admViagemSalvar", viagem: { atleta: "Lia Souza", torneio: "Copa Sul", saida: dia(9), volta: dia(12) } });
  const idV = r.corpo.viagens[0].id; assert.ok(r.corpo.torneios.some((t) => t.torneio === "Copa Sul" && t.atleta === "Lia Souza"), "torneios dos atletas vêm do Team Yoda");
  r = await chamar("ric", { acao: "admVer", data: "2026-11-16" });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.corpo.rotinaAdm.pendencias, "Ligar para a mãe da Bia", "o Richard vê");
  r = await chamar("ric", null, "GET"); assert.ok(r.corpo.rotinaAdm && Array.isArray(r.corpo.viagens), "GET do Richard traz a rotina do administrativo");
  r = await chamar("adm", null, "GET");
  assert.ok(r.corpo.rotinaAdm && r.corpo.agentesDef.map((x) => x.id).join() === "resumoAdm,faltasAdm,viagens" && !("rotina" in r.corpo), "GET do administrativo: a rotina dele e os 3 agentes dele");
  assert.strictEqual((await chamar("adm", { acao: "agenteGerar", agente: "painelSegunda" })).status, 400, "o administrativo não gera agente do Richard");
  assert.strictEqual((await chamar("ric", { acao: "agenteGerar", agente: "resumoAdm" })).status, 400, "nem o Richard gera os do administrativo");
  assert.strictEqual((await chamar("adm", { acao: "caixaEntrada", texto: "abc" })).status, 403);
  assert.strictEqual((await chamar("adm", { acao: "agentesConfig", tetoUSD: 99 })).status, 403, "o teto é do Richard");

  /* ── agentes do administrativo ── */
  r = await chamar("adm", { acao: "agenteGerar", agente: "resumoAdm" }); const idR = r.corpo.id;
  enviados.length = 0;
  await M.gerar(ctxG(null), idR);
  let it = banco["centralAgentes/" + idR];
  assert.strictEqual(it.para, "administrativo"); assert.strictEqual(it.estado, "novo");
  assert.ok(/Alunos novos\n- Lia Souza/.test(it.texto) && /Recebido no mês/.test(it.texto) && /Reposições pendentes/.test(it.texto), it.texto);
  assert.ok(/a contagem começa a partir desta semana/.test(it.texto), "primeira semana: saídas sem base");
  assert.ok(banco["central/rotinaAdm"].fotoAlunos && banco["central/rotinaAdm"].fotoAlunos.semana === AV.segundaDe(hoje), "foto dos alunos guardada");
  assert.ok(enviados.length === 1 && enviados[0].filtro.uid === "u-adm", "aviso só para o administrativo");
  /* com IA: o pedido traz os números certos */
  let pedido = null;
  r = await chamar("adm", { acao: "agenteGerar", agente: "faltasAdm" });
  await M.gerar(ctxG(async (s, m) => { pedido = m; return { texto: "Para Ana:\n- ...", usage: { input_tokens: 1000, output_tokens: 200 } }; }), r.corpo.id);
  assert.ok(/WhatsApp/.test(pedido) && banco["centralAgentes/" + r.corpo.id].texto.startsWith("Para Ana"));
  /* viagens: com torneio pela frente, gera; sem nada, arquiva em silêncio */
  r = await chamar("adm", { acao: "agenteGerar", agente: "viagens" });
  await M.gerar(ctxG(null), r.corpo.id); assert.ok(/Copa Sul/.test(banco["centralAgentes/" + r.corpo.id].texto) && banco["centralAgentes/" + r.corpo.id].estado === "novo");
  salva("mty:alunos:v2", [{ id: "a1", nome: "Lia Souza" }]); await chamar("adm", { acao: "admViagemApagar", id: idV });
  r = await chamar("adm", { acao: "agenteGerar", agente: "viagens" }); enviados.length = 0; let chamouIA = false;
  await M.gerar(ctxG(async () => { chamouIA = true; return { texto: "x", usage: {} }; }), r.corpo.id);
  assert.strictEqual(chamouIA, false, "sem viagem pela frente, não gasta IA"); assert.strictEqual(banco["centralAgentes/" + r.corpo.id].estado, "descartado"); assert.strictEqual(enviados.length, 0, "nem avisa");
  /* listas por perfil; o Richard não mexe no rascunho do administrativo */
  r = await chamar("ric", { acao: "agentesListar" }); assert.ok(r.corpo.agentes.every((x) => x.para === "richard"), "ainda não enviado: o Richard não vê");
  assert.strictEqual((await chamar("ric", { acao: "agenteItem", id: idR, op: "aprovar" })).status, 403);
  assert.strictEqual((await chamar("adm", { acao: "agenteItem", id: idR, op: "editar", texto: "Resumo revisado pelo administrativo." })).status, 200);
  banco["centralAvisos/u-ric"] = { papel: "richard", tipos: {}, silencio: { ativo: false, de: "22:00", ate: "07:00" } }; // o envio usa a hora real; sem silêncio, o aviso sai
  enviados.length = 0;
  r = await chamar("adm", { acao: "agenteItem", id: idR, op: "enviar" });
  assert.strictEqual(r.corpo.item.estado, "enviado"); assert.ok(enviados.some((e) => e.filtro.uid === "u-ric" && /Resumo da semana do administrativo/.test(e.aviso.titulo)), "aviso ao Richard");
  r = await chamar("ric", { acao: "agentesListar" });
  assert.ok(r.corpo.agentes.some((x) => x.id === idR && x.estado === "enviado" && x.texto === "Resumo revisado pelo administrativo."), "o Richard vê o resumo enviado");
  assert.strictEqual((await chamar("adm", { acao: "agenteItem", id: idR, op: "editar", texto: "x" })).status, 409, "enviado não muda mais");
  r = await chamar("adm", { acao: "agentesListar" }); assert.ok(r.corpo.agentes.every((x) => x.para === "administrativo"));
  assert.strictEqual((await chamar("adm", { acao: "agenteItem", id: r.corpo.agentes.find((x) => x.agente === "faltasAdm").id, op: "enviar" })).status, 400, "só o resumo vai ao Richard");

  /* ── avisos: o administrativo recebe o começo de cada parte; o Richard não ── */
  const CA = require(FN + "central-avisos.js");
  banco["central/rotinaAdm"].inicio = "14:00";
  enviados.length = 0;
  await CA._rodar({ db: adminFalso.firestore(), agoraMs: ms("2026-11-17", "14:01"), enviar: (f, a) => P.enviarPara(null, f, a) });
  assert.ok(enviados.length === 1 && enviados[0].filtro.uid === "u-adm" && /Início do expediente/.test(enviados[0].aviso.titulo), JSON.stringify(enviados.map((e) => [e.filtro.uid, e.aviso.titulo])));
  console.log("check-central-etapa3: ok");
})().catch((e) => { console.error(e); process.exit(1); });
