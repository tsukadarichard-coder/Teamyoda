/* Central Tsukada, Etapa 1 (avisos no celular e lista Implantação): regras (_central-avisos.js), ações de central.js por perfil
   (Richard, administrativo, professor) e o envio agendado (central-avisos.js) com Firebase falso.
   Rode: node tests/check-central-avisos.js */
const assert = require("assert"), path = require("path"), Module = require("module");
const FN = path.join(__dirname, "../../netlify/functions/");

/* ── Firestore falso (coleções com where/limit, create que falha se existir, delete) ── */
const banco = {};
function doc(c, id) {
  const k = c + "/" + id;
  return {
    id, get: async () => ({ exists: k in banco, id, data: () => banco[k] }),
    set: async (v) => { banco[k] = JSON.parse(JSON.stringify(v)); },
    create: async (v) => { if (k in banco) throw new Error("ALREADY_EXISTS"); banco[k] = JSON.parse(JSON.stringify(v)); },
    delete: async () => { delete banco[k]; },
    collection: (x) => col(k + "/" + x),
  };
}
function col(c) {
  const filtros = [];
  const q = {
    doc: (id) => doc(c, id),
    where: (campo, op, v) => { filtros.push([campo, v]); return q; },
    limit: () => q,
    get: async () => {
      const l = Object.keys(banco).filter((k) => k.startsWith(c + "/") && k.slice(c.length + 1).indexOf("/") < 0)
        .map((k) => ({ id: k.slice(c.length + 1), data: () => banco[k] })).filter((d) => filtros.every(([f, v]) => d.data()[f] === v));
      return { forEach: (fn) => l.forEach(fn), docs: l, size: l.length, empty: !l.length };
    },
  };
  return q;
}
const USUARIOS = {
  ric: { uid: "u-ric", email: "tsukada.richard@gmail.com" }, adm: { uid: "u-adm", email: "adm@teamyoda.com" },
  prof: { uid: "u-prof", email: "prof@teamyoda.com", orgId: "team-yoda", role: "professor" },
};
const adminFalso = { auth: () => ({ verifyIdToken: async (t) => { if (USUARIOS[t]) return USUARIOS[t]; throw new Error("token"); } }), firestore: () => ({ collection: (c) => col(c) }) };
const carregar = Module._load;
Module._load = function (pedido) { if (/_firebase-admin$/.test(pedido)) return { admin: adminFalso, app: () => {} }; return carregar.apply(this, arguments); };
process.env.PUSH_VAPID_PUBLICA = "BPublicaDeTeste"; process.env.PUSH_VAPID_PRIVADA = "privada";
delete process.env.QUADRALAB_ADMIN_SECRET; delete process.env.FINANCEIRO_DONOS;

const A = require(FN + "_central-avisos.js");
const P = require(FN + "_push.js");
const enviados = [];
P.enviarPara = async (admin, filtro, aviso) => {
  const alvo = Object.keys(banco).filter((k) => k.startsWith("pushInscricoes/")).map((k) => banco[k]).filter((x) => x.app === filtro.app && x.uid === filtro.uid);
  alvo.forEach(() => enviados.push({ filtro, aviso }));
  return { enviados: alvo.length, falhas: 0, removidos: 0 };
};
P.avisar = P.enviarPara;
const central = require(FN + "central.js");
const agendado = require(FN + "central-avisos.js");
const chamar = (m, quem, corpo) => central.handler({ httpMethod: m, headers: quem ? { authorization: "Bearer " + quem } : {}, body: corpo ? JSON.stringify(corpo) : undefined })
  .then((r) => ({ status: r.statusCode, corpo: JSON.parse(r.body) }));
const insc = (n) => ({ endpoint: "https://fcm.googleapis.com/fcm/send/aparelho-" + n, keys: { p256dh: "B".repeat(87), auth: "a".repeat(22) } });
const ms = (data, hhmm) => A.momentoSP(data, hhmm);

(async () => {
  /* ── regras puras ── */
  assert.deepStrictEqual(A.sp(ms("2026-11-16", "08:00")), { data: "2026-11-16", hhmm: "08:00", dow: 1 }, "São Paulo = UTC−3");
  const pr = A.prefsPadrao("richard");
  assert.deepStrictEqual(Object.keys(pr.tipos), ["tarefas", "resumo", "blocos", "agentes", "pagamentosAlerta"]);
  assert.deepStrictEqual(Object.keys(A.prefsPadrao("administrativo").tipos), ["rotinaAdm", "lembretesPagamento"], "administrativo: só a rotina dele e os pagamentos");
  assert.ok(A.emSilencio(pr, ms("2026-11-16", "23:10")) && A.emSilencio(pr, ms("2026-11-17", "06:59")) && !A.emSilencio(pr, ms("2026-11-17", "07:00")), "22h às 7h atravessa a meia-noite");
  assert.ok(!A.emSilencio({ silencio: { ativo: false, de: "22:00", ate: "07:00" } }, ms("2026-11-16", "23:10")), "silêncio desligado");
  assert.ok(A.emSilencio({ silencio: { ativo: true, de: "13:00", ate: "14:00" } }, ms("2026-11-16", "13:30")) && !A.emSilencio({ silencio: { ativo: true, de: "13:00", ate: "14:00" } }, ms("2026-11-16", "14:30")));
  const lp = A.limparPrefs({ tipos: { tarefas: false, rotinaAdm: true, x: true }, silencio: { de: "25:00", ate: "06:30" } }, "richard");
  assert.strictEqual(lp.tipos.tarefas, false); assert.ok(!("rotinaAdm" in lp.tipos) && !("x" in lp.tipos), "tipo de outro perfil não entra");
  assert.deepStrictEqual(lp.silencio, { ativo: true, de: "22:00", ate: "06:30" }, "hora inválida volta ao padrão");
  const padrao = A.implantacaoPadrao();
  assert.strictEqual(padrao.length, 11); assert.deepStrictEqual(padrao.map((t) => t.grupo).join(","), "viagem,viagem,viagem,code,code,code,time,time,time,time,pessoal");
  assert.ok(/áudio de presença/.test(padrao[0].titulo) && /versão de viagem/.test(padrao[10].titulo));
  const li = A.limparImplantacao([{ id: "im01", grupo: "viagem", titulo: "  A  ", status: "feito", feitoEm: "2026-11-13", data: "2026-11-20", hora: "9:00" }, { titulo: "" }, { id: "im01", titulo: "B", grupo: "??", data: "x", hora: "10:00" }]);
  assert.strictEqual(li.length, 2); assert.strictEqual(li[0].titulo, "A"); assert.strictEqual(li[0].hora, "", "hora inválida sai");
  assert.notStrictEqual(li[1].id, "im01", "id repetido é trocado"); assert.strictEqual(li[1].grupo, "pessoal"); assert.strictEqual(li[1].data, ""); assert.strictEqual(li[1].hora, "", "sem data não há hora");
  /* devidas: na hora; sem hora às 9h; janela de 30 min; feita não sai */
  const lt = [{ id: "t1", titulo: "Ligar", status: "a_fazer", data: "2026-11-16", hora: "14:00" }, { id: "t2", titulo: "Sem hora", status: "a_fazer", data: "2026-11-16", hora: "" }, { id: "t3", titulo: "Feita", status: "feito", data: "2026-11-16", hora: "14:00" }];
  assert.deepStrictEqual(A.tarefasDevidas(lt, ms("2026-11-16", "13:59")).map((x) => x.chave), []);
  assert.deepStrictEqual(A.tarefasDevidas(lt, ms("2026-11-16", "14:03")).map((x) => x.chave), ["tarefa:t1:2026-11-16T14:00"]);
  assert.deepStrictEqual(A.tarefasDevidas(lt, ms("2026-11-16", "14:31")).map((x) => x.chave), [], "passou da janela");
  assert.deepStrictEqual(A.tarefasDevidas(lt, ms("2026-11-16", "09:05")).map((x) => x.chave), ["tarefa:t2:2026-11-16T09:00"]);
  const rs = A.resumoDevido(padrao, [{ data: "2026-11-18", titulo: "x" }, { data: "2026-10-01", semanal: true, titulo: "y" }, { data: "2026-12-01", titulo: "z" }], ms("2026-11-16", "08:02"));
  assert.ok(rs && rs.chave === "resumo:2026-11-16" && /0 de 11 feitas/.test(rs.aviso.corpo) && /2 compromissos/.test(rs.aviso.corpo), JSON.stringify(rs));
  assert.strictEqual(A.resumoDevido(padrao, [], ms("2026-11-17", "08:02")), null, "só na segunda");
  assert.strictEqual(A.resumoDevido(padrao, [], ms("2026-11-16", "07:55")), null, "antes das 8h");

  /* ── perfis ── */
  assert.strictEqual((await chamar("GET", null)).status, 401);
  assert.strictEqual((await chamar("GET", "prof")).status, 403, "professor não entra na Central");
  assert.strictEqual((await chamar("POST", "prof", { acao: "avisosSalvar", prefs: {} })).status, 403);
  assert.strictEqual((await chamar("GET", "adm")).status, 403, "fora da lista do Financeiro, o administrativo não entra");
  banco["financeiro/_acesso"] = { admins: ["adm@teamyoda.com"] };
  let r = await chamar("GET", "adm");
  assert.strictEqual(r.status, 200); assert.strictEqual(r.corpo.papel, "administrativo");
  assert.ok(!("dados" in r.corpo) && !("auto" in r.corpo) && !("implantacao" in r.corpo), "o administrativo não vê agenda, negócios nem a Implantação");
  assert.deepStrictEqual(r.corpo.tipos.map((t) => t.id), ["rotinaAdm", "lembretesPagamento"]); assert.deepStrictEqual(r.corpo.tipos.map((t) => t.ativo), [true, false], "rotina do administrativo na Etapa 3; pagamentos na Etapa 4");
  assert.strictEqual(r.corpo.chavePush, "BPublicaDeTeste");
  assert.strictEqual((await chamar("POST", "adm", { acao: "implantacaoSalvar", tarefas: [] })).status, 403, "Implantação só do Richard");
  assert.strictEqual((await chamar("POST", "adm", { dados: { agenda: [] } })).status, 403, "o administrativo não grava a agenda do Richard");
  r = await chamar("GET", "ric");
  assert.strictEqual(r.status, 200); assert.strictEqual(r.corpo.papel, "richard");
  assert.ok(r.corpo.dados && r.corpo.auto, "o de sempre continua"); assert.strictEqual(r.corpo.implantacao.length, 11, "a lista já vem carregada");
  assert.deepStrictEqual(r.corpo.tipos.filter((t) => t.ativo).map((t) => t.id), ["tarefas", "resumo", "blocos", "agentes"], "Etapa 2 liga blocos e agentes");

  /* agenda continua igual: gravar dados não mexe na Implantação e vice-versa */
  assert.strictEqual((await chamar("POST", "ric", { dados: { agenda: [{ id: "ag1", titulo: "Reunião", data: "2026-11-18", inicio: "10:00" }] } })).status, 200);
  const lista = r.corpo.implantacao.map((t, i) => (i === 0 ? { ...t, status: "feito", feitoEm: "2026-11-13" } : i === 1 ? { ...t, data: "2026-11-16", hora: "14:00" } : t));
  r = await chamar("POST", "ric", { acao: "implantacaoSalvar", tarefas: lista });
  assert.strictEqual(r.status, 200); assert.strictEqual(banco["central/implantacao"].tarefas[0].status, "feito");
  assert.strictEqual(banco["central/dono"].dados.agenda[0].titulo, "Reunião", "a agenda não mudou");
  r = await chamar("GET", "ric"); assert.strictEqual(r.corpo.implantacao[1].hora, "14:00"); assert.strictEqual(r.corpo.dados.agenda.length, 1);

  /* preferências: cada um as suas, só os tipos do perfil */
  r = await chamar("POST", "adm", { acao: "avisosSalvar", prefs: { tipos: { tarefas: true, rotinaAdm: false }, silencio: { ativo: true, de: "21:00", ate: "08:00" } } });
  assert.deepStrictEqual(r.corpo.avisos.tipos, { rotinaAdm: false, lembretesPagamento: true }); assert.ok(!banco["centralAvisos/u-adm"].tipos.tarefas);
  assert.strictEqual((await chamar("GET", "adm")).corpo.avisos.silencio.de, "21:00");

  /* inscrição, estado, teste e cancelar */
  assert.strictEqual((await chamar("POST", "ric", { acao: "avisosTeste" })).status, 409, "sem aparelho, o teste explica");
  assert.strictEqual((await chamar("POST", "ric", { acao: "avisosInscrever", inscricao: { endpoint: "https://malicioso.com/x", keys: insc(1).keys } })).status, 400, "só serviços de push conhecidos");
  assert.strictEqual((await chamar("POST", "ric", { acao: "avisosInscrever", inscricao: insc(1) })).status, 200);
  assert.strictEqual((await chamar("POST", "adm", { acao: "avisosInscrever", inscricao: insc(2) })).status, 200);
  const gr = banco["pushInscricoes/" + P.idDaInscricao(insc(1).endpoint)];
  assert.deepStrictEqual([gr.app, gr.uid, gr.papel, gr.url], ["central", "u-ric", "richard", "/"], "o perfil vem do login, não do navegador");
  assert.strictEqual((await chamar("POST", "ric", { acao: "avisosEstado", endpoint: insc(1).endpoint })).corpo.inscrito, true);
  assert.strictEqual((await chamar("POST", "adm", { acao: "avisosEstado", endpoint: insc(1).endpoint })).corpo.inscrito, false, "aparelho de outra pessoa");
  enviados.length = 0;
  r = await chamar("POST", "ric", { acao: "avisosTeste" });
  assert.strictEqual(r.status, 200); assert.strictEqual(enviados.length, 1); assert.strictEqual(enviados[0].filtro.uid, "u-ric", "o teste vai só para quem tocou");
  await chamar("POST", "adm", { acao: "avisosCancelar", endpoint: insc(1).endpoint });
  assert.ok(banco["pushInscricoes/" + P.idDaInscricao(insc(1).endpoint)], "não cancela o aparelho de outra pessoa");

  /* ── envio agendado ── */
  const rodar = (data, hhmm) => { enviados.length = 0; return agendado._rodar({ db: adminFalso.firestore(), agoraMs: ms(data, hhmm), enviar: (filtro, aviso) => P.enviarPara(null, filtro, aviso) }); };
  let o = await rodar("2026-11-16", "14:02");
  assert.strictEqual(o.enviados, 1); assert.ok(/alunos que evoluíram/.test(enviados[0].aviso.corpo) && enviados[0].filtro.uid === "u-ric", JSON.stringify(enviados));
  o = await rodar("2026-11-16", "14:07"); assert.strictEqual(o.enviados, 0); assert.strictEqual(o.repetidos, 1, "o mesmo aviso não sai duas vezes");
  o = await rodar("2026-11-16", "08:03");
  assert.strictEqual(o.enviados, 1); assert.ok(/1 de 11 feitas/.test(enviados[0].aviso.corpo) && /1 compromisso/.test(enviados[0].aviso.corpo), enviados[0] && enviados[0].aviso.corpo);
  assert.ok(enviados.every((e) => e.filtro.uid === "u-ric"), "o administrativo não recebe os avisos do Richard");
  /* silêncio: tarefa às 23h não sai, nem depois */
  const comNoite = banco["central/implantacao"].tarefas.map((t, i) => (i === 2 ? { ...t, data: "2026-11-16", hora: "23:00" } : t));
  await chamar("POST", "ric", { acao: "implantacaoSalvar", tarefas: comNoite });
  o = await rodar("2026-11-16", "23:01"); assert.strictEqual(o.enviados, 0); assert.strictEqual(o.silencio, 1);
  /* tipo desligado não sai */
  await chamar("POST", "ric", { acao: "avisosSalvar", prefs: { tipos: { tarefas: false }, silencio: { ativo: false } } });
  const comTarde = banco["central/implantacao"].tarefas.map((t, i) => (i === 3 ? { ...t, data: "2026-11-17", hora: "15:00" } : t));
  await chamar("POST", "ric", { acao: "implantacaoSalvar", tarefas: comTarde });
  o = await rodar("2026-11-17", "15:01"); assert.strictEqual(o.enviados, 0, "Tarefas desligado");
  await chamar("POST", "ric", { acao: "avisosSalvar", prefs: { tipos: { tarefas: true } } });
  o = await rodar("2026-11-17", "15:04"); assert.strictEqual(o.enviados, 1, "ligado de novo, dentro da janela");
  console.log("check-central-avisos: ok");
})().catch((e) => { console.error(e); process.exit(1); });
