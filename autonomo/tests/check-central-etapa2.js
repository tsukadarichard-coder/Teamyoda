/* Central Tsukada, Etapa 2: Rotina do Head Trainer (_central-rotina.js), agentes (_central-agentes.js e o motor), as ações de
   central.js (só o Richard), a function em segundo plano (segredo interno) e o agendador, com Firebase e IA falsos.
   Rode: node tests/check-central-etapa2.js */
const assert = require("assert"), path = require("path"), fs = require("fs"), Module = require("module");
const FN = path.join(__dirname, "../../netlify/functions/");

/* ── Firestore falso ── */
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
  const f = [], st = { ordem: null, lim: 0 };
  const q = {
    doc: (id) => doc(c, id), where: (campo, op, v) => { f.push([campo, v]); return q; }, orderBy: (campo, dir) => { st.ordem = [campo, dir]; return q; }, limit: (n) => { st.lim = n; return q; },
    get: async () => {
      let l = Object.keys(banco).filter((k) => k.startsWith(c + "/") && k.slice(c.length + 1).indexOf("/") < 0).map((k) => ({ id: k.slice(c.length + 1), data: () => banco[k] }))
        .filter((d) => f.every(([campo, v]) => d.data()[campo] === v));
      if (st.ordem) l.sort((a, b) => (String(a.data()[st.ordem[0]]) < String(b.data()[st.ordem[0]]) ? -1 : 1) * (st.ordem[1] === "desc" ? -1 : 1));
      if (st.lim) l = l.slice(0, st.lim);
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

/* Team Yoda: 2 alunos, um com marco na semana, um com 3 faltas; 4 professores aprovados */
const SP = (ms) => new Date(ms - 3 * 3600000).toISOString().slice(0, 10);
const hoje = SP(Date.now()), dia = (n) => { const d = new Date(hoje + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const salva = (k, v) => { banco["orgs/team-yoda/dados/" + k] = { value: JSON.stringify(v) }; };
salva("mty:alunos:v2", [
  { id: "a1", nome: "Lia Souza", professorNome: "Ana", registros: [{ data: dia(-2), presenca: "presente", atendimento: { marcados: [] }, conquista: { texto: "Primeiro saque com kick", marco: true }, professorNome: "Ana" }] },
  { id: "a2", nome: "Caio Reis", professorNome: "Bruno", registros: [] },
]);
salva("mty:turmas:v1", []);
salva("mty:ocorrencias:v1", [-3, -6, -9].map((n, i) => ({ id: "o" + i, origemTipo: "individual", origemId: "a2", data: dia(n), horaInicio: "10:00", horaFim: "11:00", status: "realizada", presencas: { a2: "falta" } })));
["Ana", "Bruno", "Carla", "Duda"].forEach((n, i) => { banco["orgs/team-yoda/solicitacoes/s" + i] = { status: "aprovada", nome: n }; });

const AV = require(FN + "_central-avisos.js"), R = require(FN + "_central-rotina.js"), AG = require(FN + "_central-agentes.js"), M = require(FN + "_central-agentes-motor.js");
const P = require(FN + "_push.js"), enviados = [];
P.enviarPara = async (a, filtro, aviso) => { enviados.push({ filtro, aviso }); return { enviados: 1, falhas: 0, removidos: 0 }; };
P.avisar = P.enviarPara;
const disparos = [];
global.fetch = async (url, o) => { disparos.push({ url, segredo: o.headers["x-central-segredo"], corpo: JSON.parse(o.body) }); return { ok: true, status: 202 }; };
const central = require(FN + "central.js"), bg = require(FN + "central-agentes-background.js"), agend = require(FN + "central-agentes.js");
const chamar = (quem, corpo, m) => central.handler({ httpMethod: m || "POST", headers: { authorization: "Bearer " + quem }, body: corpo ? JSON.stringify(corpo) : undefined }).then((r) => ({ status: r.statusCode, corpo: JSON.parse(r.body) }));
const ms = (d, h) => AV.momentoSP(d, h);

(async () => {
  assert.strictEqual(fs.readFileSync(FN + "_atendimento.js", "utf8"), fs.readFileSync(path.join(__dirname, "../../mty/atendimento.js"), "utf8"), "netlify/functions/_atendimento.js precisa ser igual a mty/atendimento.js");

  /* ── rotina: modelos, teto, rodízio, mínimo, avisos ── */
  const rot = R.rotinaPadrao(["Ana", "Bruno", "Carla", "Duda", "Extra"]);
  assert.deepStrictEqual(rot.professores, ["Ana", "Bruno", "Carla", "Duda"], "4 professores");
  const seg = "2026-11-16";
  let s = R.semana(rot, seg);
  assert.strictEqual(s.modo, "ct"); assert.strictEqual(s.marcada, false, "sem marcar vale CT");
  assert.strictEqual(s.totalMin, 360); assert.strictEqual(s.passouDoTeto, false, "CT = 6h, no teto");
  assert.deepStrictEqual(s.blocos.map((b) => b.dia + ":" + b.tipo).join(","), "0:gestao,1:conversa,1:conversa,1:conversa,1:conversa,2:quadra,3:observacao,4:distancia");
  assert.deepStrictEqual(s.blocos.filter((b) => b.tipo === "conversa").map((b) => b.professor), ["Ana", "Bruno", "Carla", "Duda"]);
  assert.strictEqual(s.observacao, "Ana");
  R.marcarModo(rot, seg, "viagem"); s = R.semana(rot, seg);
  assert.strictEqual(s.totalMin, 200, "viagem 3h20"); assert.ok(s.blocos.some((b) => b.tipo === "descanso") && !s.blocos.some((b) => b.tipo === "observacao"), "viagem: descanso, sem observação");
  assert.strictEqual(R.somaMin(s.blocos), 200, "descanso não conta");
  R.marcarModo(rot, seg, "ct");
  R.editarBloco(rot, "ct", "q", { duracaoMin: 120 }); s = R.semana(rot, seg);
  assert.ok(s.passouDoTeto && s.totalMin === 390, "passou de 6h avisa");
  R.editarBloco(rot, "ct", "q", { duracaoMin: 90, inicio: "16:30" }); assert.strictEqual(R.semana(rot, seg).blocos.find((b) => b.id === "q").inicio, "16:30");
  /* rodízio: só anda quando a observação é feita; pulada, a próxima semana no CT observa o mesmo professor */
  assert.strictEqual(R.semana(rot, "2026-11-23").observacao, "Ana", "semana seguinte sem fazer: mesma professora");
  R.marcarFeito(rot, seg, "o", true, "2026-11-19");
  assert.strictEqual(R.semana(rot, seg).blocos.find((b) => b.id === "o").professor, "Ana", "a feita guarda quem foi observado");
  assert.strictEqual(R.semana(rot, "2026-11-23").observacao, "Bruno", "rodízio andou");
  R.marcarFeito(rot, seg, "o", false); assert.strictEqual(rot.rodizio.proximo, 0, "desfazer volta o rodízio");
  R.marcarFeito(rot, seg, "o", true, "2026-11-19");
  /* mínimo da semana e avisos 15 min antes */
  const devS = R.blocosDevidos(rot, ms(seg, "08:47"));
  assert.deepStrictEqual(devS.map((d) => d.chave), ["bloco:2026-11-16:g"], "gestão às 9h avisa às 8h45");
  assert.ok(/Gestão pelo painel às 09:00/.test(devS[0].aviso.titulo));
  assert.deepStrictEqual(R.blocosDevidos(rot, ms("2026-11-17", "08:46")).length, 1, "conversa das 9h");
  R.marcarMinimo(rot, seg, true);
  assert.deepStrictEqual(R.blocosDevidos(rot, ms("2026-11-17", "08:46")), [], "no mínimo da semana, conversa não avisa");
  assert.strictEqual(R.semana(rot, seg).totalMinimo, 130, "mínimo: gestão + presença à distância");
  R.marcarMinimo(rot, seg, false);
  R.marcarRitmo(rot, "mensal", "2026-11", 5, true, "Comunicação com os pais"); R.marcarRitmo(rot, "trimestral", "2026-T4", 0, true);
  const rit = R.ritmos(rot, "2026-11-20");
  assert.ok(rit.mensal[5].feito && rit.tema === "Comunicação com os pais" && rit.trimestral[0].feito && rit.trimestre === "2026-T4");
  assert.deepStrictEqual(JSON.parse(JSON.stringify(R.limparRotina(JSON.parse(JSON.stringify(rot))))), JSON.parse(JSON.stringify(R.limparRotina(rot))), "gravar e ler de novo dá o mesmo");

  /* ── agentes: quando rodam, custo, teto ── */
  const cfg = AG.configPadrao();
  assert.deepStrictEqual(AG.devidos(ms("2026-11-16", "07:03"), cfg).map((d) => d.id), ["painelSegunda-2026-11-16", "conversas-2026-11-16"], "segunda às 7h");
  assert.deepStrictEqual(AG.devidos(ms("2026-11-19", "20:03"), cfg).map((d) => d.id), ["presenca-2026-11-16"], "quinta às 20h");
  assert.deepStrictEqual(AG.devidos(ms("2026-11-25", "08:03"), cfg).map((d) => d.id), ["mensagemCiclo-2026-11"], "dia 25 às 8h");
  assert.deepStrictEqual(AG.devidos(ms("2026-11-16", "08:03"), cfg).map((d) => d.id), ["resumoAdm-2026-11-16"], "resumo do administrativo na segunda às 8h (Etapa 3)");
  cfg.ligados.conversas = false; assert.deepStrictEqual(AG.devidos(ms("2026-11-16", "07:03"), cfg).map((d) => d.id), ["painelSegunda-2026-11-16"], "desligado não roda");
  assert.ok(Math.abs(AG.custoUSD({ input_tokens: 1e6, output_tokens: 1e5 }) - 6) < 1e-9, "US$ 4 por milhão de entrada + 20 por milhão de saída");
  assert.strictEqual(AG.dentroDoTeto({ tetoUSD: 10, gasto: { "2026-11": 9.99 } }, "2026-11-20"), true);
  assert.strictEqual(AG.dentroDoTeto({ tetoUSD: 10, gasto: { "2026-11": 10 } }, "2026-11-20"), false);
  const lp = AG.lerPropostas('Claro! {"tarefas":[{"titulo":"Ligar pro João","prazo":"2026-11-20","prioridade":"alta","negocio":"team-yoda"},{"titulo":""}],"compromissos":[{"titulo":"Reunião","data":"2026-11-21","inicio":"10:00"},{"titulo":"sem data"}],"observacao":"ok"}');
  assert.strictEqual(lp.tarefas.length, 1); assert.strictEqual(lp.compromissos.length, 1, "compromisso sem data sai"); assert.strictEqual(lp.compromissos[0].negocio, "geral");
  assert.strictEqual(AG.lerPropostas("sem json"), null);

  /* ── permissões ── */
  assert.strictEqual((await chamar("adm", { acao: "rotinaVer" })).status, 403, "rotina só do Richard");
  assert.strictEqual((await chamar("adm", { acao: "caixaEntrada", texto: "x" })).status, 403);
  assert.strictEqual((await chamar("adm", { acao: "agenteItem", id: "x", op: "aprovar" })).status, 403);
  assert.strictEqual((await chamar("prof", { acao: "rotinaVer" })).status, 403);
  banco["financeiro/_acesso"] = { admins: ["adm@teamyoda.com"] };
  let r = await chamar("adm", null, "GET");
  assert.ok(r.status === 200 && !("rotina" in r.corpo) && !("ritmos" in r.corpo) && r.corpo.agentes.every((x) => x.para === "administrativo") && r.corpo.agentesDef.every((x) => x.para === "administrativo"), "o administrativo não vê a rotina do Richard nem os agentes dele");

  /* ── rotina pela function: nomes dos professores do Team Yoda, marcar viagem, feito, bloco ── */
  r = await chamar("ric", null, "GET");
  assert.strictEqual(r.status, 200); assert.ok(r.corpo.rotina && r.corpo.ritmos && r.corpo.agentesConfig && Array.isArray(r.corpo.agentes));
  assert.deepStrictEqual(r.corpo.professores, ["Ana", "Bruno", "Carla", "Duda"], "professores vêm do Team Yoda");
  assert.deepStrictEqual(r.corpo.agentesConfig, { ligados: AG.configPadrao().ligados, tetoUSD: 10, gastoMes: 0, mes: hoje.slice(0, 7) });
  assert.ok(!("segredo" in r.corpo.agentesConfig), "o segredo interno nunca vai para a tela");
  assert.ok(r.corpo.agentesDef.find((a) => a.id === "resumoAdm").ativo && r.corpo.agentesDef.find((a) => a.id === "painelSegunda").ativo);
  r = await chamar("ric", { acao: "rotinaModo", semana: "2026-11-18", modo: "viagem" });
  assert.strictEqual(r.corpo.rotina.semana, "2026-11-16", "qualquer dia vira a segunda da semana"); assert.strictEqual(r.corpo.rotina.modo, "viagem");
  r = await chamar("ric", { acao: "rotinaFeito", semana: "2026-11-16", blocoId: "v", feito: true });
  assert.ok(r.corpo.rotina.blocos.find((b) => b.id === "v").feito);
  assert.strictEqual((await chamar("ric", { acao: "rotinaFeito", semana: "2026-11-16", blocoId: "nada", feito: true })).status, 400);
  r = await chamar("ric", { acao: "rotinaBloco", semana: "2026-11-16", modo: "viagem", blocoId: "g", inicio: "07:30", duracaoMin: 40 });
  assert.strictEqual(r.corpo.rotina.blocos.find((b) => b.id === "g").inicio, "07:30");
  r = await chamar("ric", { acao: "rotinaRestaurar", semana: "2026-11-16", modo: "viagem" }); assert.strictEqual(r.corpo.rotina.blocos.find((b) => b.id === "g").inicio, "08:00", "volta ao padrão");
  r = await chamar("ric", { acao: "rotinaProfessores", professores: ["Ana", "Bia", "Carla", "Duda"] }); assert.strictEqual(r.corpo.professores[1], "Bia");
  r = await chamar("ric", { acao: "rotinaRitmo", tipo: "mensal", periodo: hoje.slice(0, 7), idx: 0, feito: true, tema: "Escuta" });
  assert.ok(r.corpo.ritmos.mensal[0].feito && r.corpo.ritmos.tema === "Escuta");
  assert.ok(banco["central/rotina"].semanas["2026-11-16"].modo === "viagem", "gravado em central/rotina");

  /* ── agentes pela function: Gerar agora → segundo plano com segredo → rascunho sem IA (sem chave) ── */
  disparos.length = 0;
  r = await chamar("ric", { acao: "agenteGerar", agente: "painelSegunda" });
  assert.strictEqual(r.status, 200); const id1 = r.corpo.id;
  assert.ok(r.corpo.agentes.find((x) => x.id === id1).estado === "gerando");
  assert.strictEqual(disparos.length, 1); assert.strictEqual(disparos[0].url, "https://teste.local/.netlify/functions/central-agentes-background");
  const segredo = banco["central/agentesConfig"].segredo; assert.ok(/^[a-f0-9]{48}$/.test(segredo) && disparos[0].segredo === segredo);
  assert.strictEqual((await bg._processar({ httpMethod: "POST", headers: { "x-central-segredo": "errado" }, body: JSON.stringify({ id: id1 }) }, { db: adminFalso.firestore(), agoraMs: Date.now() })).statusCode, 403, "sem o segredo, não roda");
  const ricInsc = { app: "central", uid: "u-ric", papel: "richard", endpoint: "https://fcm.googleapis.com/x", keys: {} };
  banco["pushInscricoes/r1"] = ricInsc;
  enviados.length = 0;
  let o = await bg._processar({ httpMethod: "POST", headers: { "x-central-segredo": segredo }, body: JSON.stringify({ id: id1 }) }, { db: adminFalso.firestore(), agoraMs: ms(hoje, "12:00"), enviar: (f, a) => P.enviarPara(null, f, a) });
  assert.strictEqual(o.statusCode, 200);
  let it = banco["centralAgentes/" + id1];
  assert.strictEqual(it.estado, "novo"); assert.strictEqual(it.semIA, true); assert.ok(/não está configurada/.test(it.motivoSemIA));
  assert.ok(/Caio Reis: 3 faltas/.test(it.texto), "rascunho sem IA com as faltas: " + it.texto);
  assert.strictEqual(enviados.length, 1); assert.ok(/Painel de segunda/.test(enviados[0].aviso.titulo) && enviados[0].filtro.uid === "u-ric", "aviso para o Richard");

  /* com IA (falsa): contexto, custo somado, sem nomes inventados */
  let pedidoIA = null;
  const iaFalsa = async (sistema, msg) => { pedidoIA = { sistema, msg }; return { texto: "Para fazer hoje:\n- Conversar com Bruno sobre o Caio.", usage: { input_tokens: 5000, output_tokens: 800 } }; };
  await M.criar({ db: adminFalso.firestore(), agoraMs: ms(hoje, "12:00") }, "presenca-teste", "presenca", { periodo: hoje });
  await M.gerar({ db: adminFalso.firestore(), agoraMs: ms(hoje, "12:00"), ia: iaFalsa, enviar: (f, a) => P.enviarPara(null, f, a) }, "presenca-teste");
  it = banco["centralAgentes/presenca-teste"];
  assert.strictEqual(it.semIA, false); assert.ok(/Conversar com Bruno/.test(it.texto));
  assert.ok(/Primeiro saque com kick/.test(pedidoIA.msg) && /Lia Souza/.test(pedidoIA.msg), "o agente leu o marco da semana");
  assert.ok(/não invente/.test(pedidoIA.sistema) && /nunca fale como se a mensagem já tivesse sido enviada/.test(pedidoIA.sistema));
  const gasto = banco["central/agentesConfig"].gasto[hoje.slice(0, 7)];
  assert.ok(Math.abs(gasto - (5000 * 4 + 800 * 20) / 1e6) < 1e-9, "gasto somado: " + gasto);
  /* teto atingido: rascunho sem IA, a IA nem é chamada */
  banco["central/agentesConfig"].tetoUSD = 0.01; pedidoIA = null;
  await M.criar({ db: adminFalso.firestore(), agoraMs: ms(hoje, "12:00") }, "conversas-teste", "conversas", { periodo: hoje });
  await M.gerar({ db: adminFalso.firestore(), agoraMs: ms(hoje, "12:00"), ia: iaFalsa }, "conversas-teste");
  it = banco["centralAgentes/conversas-teste"];
  assert.strictEqual(pedidoIA, null, "passou do teto, não chama a IA"); assert.ok(it.semIA && /teto/.test(it.motivoSemIA) && /Ana/.test(it.texto));
  /* falha da IA vira rascunho sem IA */
  banco["central/agentesConfig"].tetoUSD = 10;
  await M.criar({ db: adminFalso.firestore(), agoraMs: ms(hoje, "12:00") }, "mensagemCiclo-teste", "mensagemCiclo", { periodo: hoje.slice(0, 7) });
  await M.gerar({ db: adminFalso.firestore(), agoraMs: ms(hoje, "12:00"), ia: async () => { throw new Error("529 overloaded"); } }, "mensagemCiclo-teste");
  it = banco["centralAgentes/mensagemCiclo-teste"]; assert.ok(it.semIA && /falhou/.test(it.motivoSemIA) && /Primeiro saque com kick/.test(it.texto));
  /* recusa conta o custo e entrega sem IA */
  await M.criar({ db: adminFalso.firestore(), agoraMs: ms(hoje, "12:00") }, "painel-recusa", "painelSegunda", { periodo: hoje });
  await M.gerar({ db: adminFalso.firestore(), agoraMs: ms(hoje, "12:00"), ia: async () => ({ recusa: true, usage: { input_tokens: 100, output_tokens: 0 } }) }, "painel-recusa");
  assert.ok(banco["centralAgentes/painel-recusa"].semIA);
  /* gerar de novo um rascunho pronto não refaz */
  assert.strictEqual((await M.gerar({ db: adminFalso.firestore(), agoraMs: Date.now(), ia: iaFalsa }, "presenca-teste")).ok, false);

  /* caixa de entrada: separa e, aprovada, entra na agenda e nas tarefas */
  r = await chamar("ric", { acao: "caixaEntrada", texto: "ligar pro João quinta\nreunião com o clube dia 21 às 10h" });
  const idC = r.corpo.id;
  await M.gerar({ db: adminFalso.firestore(), agoraMs: Date.now(), ia: async () => ({ texto: JSON.stringify({ tarefas: [{ titulo: "Ligar pro João", prazo: dia(1), prioridade: "alta", negocio: "team-yoda" }], compromissos: [{ titulo: "Reunião com o clube", data: dia(2), inicio: "10:00", negocio: "39-ranch" }], observacao: "" }), usage: { input_tokens: 300, output_tokens: 120 } }) }, idC);
  it = banco["centralAgentes/" + idC];
  assert.ok(it.propostas.tarefas.length === 1 && /Ligar pro João/.test(it.texto) && /Compromissos/.test(it.texto));
  assert.strictEqual((await chamar("ric", { acao: "agenteItem", id: idC, op: "editar", texto: "x" })).status, 200);
  r = await chamar("ric", { acao: "agenteItem", id: idC, op: "aprovar" });
  assert.strictEqual(r.corpo.item.estado, "aprovado"); assert.ok(r.corpo.item.aplicadoEm);
  const dono = banco["central/dono"].dados;
  assert.ok(dono.tarefas.some((t) => t.titulo === "Ligar pro João" && t.prioridade === "alta") && dono.agenda.some((c) => c.titulo === "Reunião com o clube" && c.inicio === "10:00"), "entrou na agenda e nas tarefas");
  await chamar("ric", { acao: "agenteItem", id: idC, op: "aprovar" });
  assert.strictEqual(banco["central/dono"].dados.tarefas.filter((t) => t.titulo === "Ligar pro João").length, 1, "aprovar de novo não duplica");
  r = await chamar("ric", { acao: "agenteItem", id: "presenca-teste", op: "descartar" }); assert.strictEqual(r.corpo.item.estado, "descartado");
  /* config: desligar e mudar o teto */
  r = await chamar("ric", { acao: "agentesConfig", ligados: { presenca: false }, tetoUSD: 15 });
  assert.strictEqual(r.corpo.agentesConfig.tetoUSD, 15); assert.strictEqual(r.corpo.agentesConfig.ligados.presenca, false); assert.strictEqual(r.corpo.agentesConfig.ligados.painelSegunda, true);
  assert.strictEqual(banco["central/agentesConfig"].segredo, segredo, "mudar a config não troca o segredo");

  /* agendador: segunda 7h cria os dois e dispara; na mesma hora de novo, não duplica; preso há 30 min é redisparado */
  disparos.length = 0;
  let a1 = await agend._rodar({ db: adminFalso.firestore(), agoraMs: ms("2026-11-30", "07:03") });
  assert.deepStrictEqual(a1.criados, ["painelSegunda-2026-11-30", "conversas-2026-11-30"]); assert.strictEqual(disparos.length, 2);
  a1 = await agend._rodar({ db: adminFalso.firestore(), agoraMs: ms("2026-11-30", "07:33") });
  assert.deepStrictEqual(a1.criados, []); assert.deepStrictEqual(a1.redisparados.sort(), ["conversas-2026-11-30", "painelSegunda-2026-11-30"].sort(), "ainda gerando há 30 min: tenta de novo");
  assert.strictEqual(banco["centralAgentes/painelSegunda-2026-11-30"].tentativas, 2);

  /* avisos: o agendador dos avisos agora manda o bloco da rotina 15 min antes */
  const CA = require(FN + "central-avisos.js");
  enviados.length = 0;
  const rotG = banco["central/rotina"]; rotG.semanas["2026-11-30"] = { modo: "ct", feitos: {}, minimo: false };
  await CA._rodar({ db: adminFalso.firestore(), agoraMs: ms("2026-11-30", "08:46"), enviar: (f, a) => P.enviarPara(null, f, a) });
  assert.ok(enviados.some((e) => /Gestão pelo painel às 09:00/.test(e.aviso.titulo)), "aviso do bloco: " + JSON.stringify(enviados.map((e) => e.aviso.titulo)));
  console.log("check-central-etapa2: ok");
})().catch((e) => { console.error(e); process.exit(1); });
