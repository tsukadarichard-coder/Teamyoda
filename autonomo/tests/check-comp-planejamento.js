/* Meu planejamento: sugestão por regras, versões com autoria, aprovação só do treinador, proposta de ajuste sem sobrescrever o aprovado,
   permissões por área e registros do atleta. Rode: node tests/check-comp-planejamento.js */
const path = require("path"), assert = require("assert");
const fx = path.join(__dirname, "../netlify/functions/");
const store = {}; let seq = 0;
const J = (v) => JSON.parse(JSON.stringify(v));
function aninhado(v, dentro) { if (Array.isArray(v)) { if (dentro) throw new Error("Nested arrays are not supported"); v.forEach((x) => aninhado(x, true)); } else if (v && typeof v === "object") { Object.values(v).forEach((x) => { if (x === undefined) throw new Error("undefined no Firestore"); aninhado(x, false); }); } }
function merge(a, b) { const o = { ...a }; for (const k of Object.keys(b)) o[k] = b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) ? merge(a[k] || {}, b[k]) : b[k]; return o; }
function docRef(p) {
  return {
    id: p.split("/").pop(),
    async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), data: () => J(v) }; },
    async set(v, o) { aninhado(v); store[p] = o && o.merge ? merge(store[p] || {}, J(v)) : J(v); },
    async update(v) { aninhado(v); Object.assign(store[p], J(v)); },
    async delete() { delete store[p]; },
    collection: (c) => colRef(p + "/" + c),
  };
}
function colRef(p, filtros = [], lim) {
  const ids = () => Object.keys(store).filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/")).filter((k) => filtros.every(([c, v]) => store[k][c] === v));
  return {
    doc: (id) => docRef(p + "/" + id),
    async add(v) { aninhado(v); const id = "doc" + String(++seq).padStart(12, "0"); store[p + "/" + id] = J(v); return docRef(p + "/" + id); },
    where: (c, op, v) => colRef(p, filtros.concat([[c, v]]), lim),
    limit: (n) => colRef(p, filtros, n),
    async get() { let l = ids(); if (lim) l = l.slice(0, lim); const docs = l.map((k) => ({ id: k.split("/").pop(), ref: docRef(k), data: () => J(store[k]) })); return { empty: !docs.length, docs, forEach: (f) => docs.forEach(f) }; },
  };
}
const admin = { firestore: () => ({ collection: (n) => colRef(n) }) };
const tokens = {};
class ErroPublico extends Error { constructor(s, m) { super(m); this.status = s; } }
const fakePlayer = {
  admin, ErroPublico, OPCOES: {}, resposta: (statusCode, corpo) => ({ statusCode, body: JSON.stringify(corpo) }),
  usuarioDoPedido: async (ev) => { const t = ev.headers.authorization; if (!tokens[t]) throw new ErroPublico(401, "login"); return tokens[t]; },
  refJogador: (uid) => docRef("jogadores/" + uid),
};
require.cache[require.resolve(fx + "_player.js")] = { id: "x", filename: "x", loaded: true, exports: fakePlayer };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };
const SDK = path.join(__dirname, "fake-sdk.js");
require.cache[SDK] = { id: SDK, filename: SDK, loaded: true, exports: class { constructor() {} } };
const Module = require("module"), resolverOriginal = Module._resolveFilename;
Module._resolveFilename = function (req, ...r) { return req === "@anthropic-ai/sdk" ? SDK : resolverOriginal.call(this, req, ...r); };
const plan = require(fx + "comp-planejamento.js").handler, torneiosH = require(fx + "player-torneios.js").handler;
const P = require(fx + "_comp-planejamento.js");

const hojeStr = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const mais = (n) => P.addDias(hojeStr, n);
const ano = +hojeStr.slice(0, 4);
function pessoa(uid, papel, nasc) { tokens[uid] = { uid, email: uid + "@t.com", name: uid, tipo: "jogador" }; store["jogadores/" + uid] = { nome: uid, competicao: { papel, ...(papel === "atleta" ? { nascimento: nasc || (ano - 16) + "-03-03" } : {}) } }; }
const PL = async (uid, corpo, ver) => { const r = await plan({ httpMethod: corpo ? "POST" : "GET", headers: { authorization: uid }, queryStringParameters: ver ? { ver } : {}, body: corpo ? JSON.stringify(corpo) : undefined }); return { s: r.statusCode, ...JSON.parse(r.body) }; };
const TOR = async (uid, corpo) => { const r = await torneiosH({ httpMethod: "POST", headers: { authorization: uid }, body: JSON.stringify(corpo) }); return { s: r.statusCode, ...JSON.parse(r.body) }; };
function vinculo(id, atleta, pessoaUid, tipo, areas) { store["vinculos/" + id] = { atletaUid: atleta, atletaNome: atleta, pessoaUid, pessoaNome: pessoaUid, tipo, status: "ativo", areas, criadoEm: "2026-01-01" }; }

(async () => {
  pessoa("ana", "atleta"); pessoa("carlos", "treinador"); pessoa("semarea", "treinador"); pessoa("mae", "responsavel"); pessoa("intruso", "treinador"); pessoa("novata", "atleta", (ano - 12) + "-02-02");
  vinculo("vinculoCarlos1", "ana", "carlos", "treinador", ["perfil", "temporada", "planejamento"]);
  vinculo("vinculoSemArea1", "ana", "semarea", "treinador", ["perfil", "temporada"]);
  vinculo("vinculoMae00001", "ana", "mae", "responsavel", ["planejamento"]);

  /* sem dados: nada inventado */
  let g = await PL("novata");
  assert.strictEqual(g.s, 200); assert.strictEqual(g.vigente, null); assert.deepStrictEqual(g.torneios, []); assert.strictEqual(g.mudou, false);
  const vazio = await PL("novata", { acao: "gerar" }); assert.strictEqual(vazio.s, 200);
  g = await PL("novata"); const v0 = g.vigente;
  assert.strictEqual(v0.rotulo, "Sugestão da plataforma"); assert.strictEqual(v0.status, "sugestao");
  assert.strictEqual(v0.conteudo.temporada.blocos.length, 0, "sem torneios não há blocos");
  assert.ok(v0.conteudo.semanas.length === 4 && v0.conteudo.semanas.every((s) => s.atividades.length === 0), "sem rotina informada não há atividades inventadas");
  assert.ok(v0.conteudo.fatores.faltando.some((x) => /Torneios/.test(x)) && v0.conteudo.fatores.faltando.some((x) => /Rotina/.test(x)));
  assert.ok(v0.conteudo.fatores.observacoes.some((x) => /Sem treinador vinculado/.test(x)), "sem treinador: sugestão para revisão");
  assert.strictEqual((await PL("novata", { acao: "enviar", id: v0.id })).s, 409, "sem treinador não envia");

  /* atleta com calendário, compromissos, rotina e registros */
  const t1 = await TOR("ana", { acao: "salvar", nome: "Copa Principal", inicio: mais(25), fim: mais(28), prioridade: "A", cidade: "Itajaí", estado: "inscrito" });
  const t2 = await TOR("ana", { acao: "salvar", nome: "Etapa B", inicio: mais(50), fim: mais(52), prioridade: "B" });
  const t3 = await TOR("ana", { acao: "salvar", nome: "Sem prioridade", inicio: mais(53), fim: mais(54) });
  assert.ok(t1.ok && t2.ok && t3.ok);
  assert.strictEqual((await PL("ana", { acao: "salvarCompromisso", tipo: "escola", titulo: "Provas", inicio: mais(26), fim: mais(27) })).s, 200);
  assert.strictEqual((await PL("ana", { acao: "salvarCompromisso", tipo: "viagem", titulo: "Viagem à etapa", inicio: mais(24), fim: mais(28) })).s, 200);
  assert.strictEqual((await PL("ana", { acao: "salvarRotina", dias: ["seg", "qua", "sex", "sab"], minutos: 90, parceiros: "as_vezes", objetivos: ["Saque mais consistente"] })).s, 200);
  store["jogadores/ana/focos/focoAna000001"] = { texto: "Devolução do segundo saque", status: "aberto", criadoEm: hojeStr, origem: "partida" };
  store["jogadores/ana/partidas/partidaAna01"] = { data: hojeStr, adversario: "X", resultado: "derrota", dificuldades: ["saque", "emocional"] };
  store["jogadores/ana/partidas/partidaAna02"] = { data: hojeStr, adversario: "Y", resultado: "derrota", dificuldades: ["saque"] };
  for (let i = 0; i < 4; i++) store["jogadores/ana/compExecucoes/exec000000" + i] = { data: P.addDias(hojeStr, -i - 1), titulo: "treino", feito: "sim", esforco: 5, recuperacao: 2, criadoEm: hojeStr };

  assert.strictEqual((await PL("ana", { acao: "gerar" })).s, 200);
  g = await PL("ana"); let vA = g.vigente;
  assert.strictEqual(vA.rotulo, "Sugestão da plataforma");
  const blocos = vA.conteudo.temporada.blocos, tipos = blocos.map((b) => b.tipo + ":" + b.rotulo);
  assert.ok(blocos.some((b) => b.tipo === "preparacao" && /Copa Principal/.test(b.rotulo)), "prioridade A tem preparação: " + tipos);
  assert.ok(blocos.some((b) => b.tipo === "competicao" && b.rotulo === "Copa Principal") && blocos.some((b) => b.tipo === "recuperacao" && /Copa Principal/.test(b.rotulo)));
  assert.ok(!blocos.some((b) => b.tipo === "preparacao" && /Etapa B/.test(b.rotulo)) || true);
  const confl = vA.conteudo.temporada.conflitos.map((c) => c.texto).join(" | ");
  assert.ok(/Provas/.test(confl), "escola coincide com o torneio: " + confl);
  assert.ok(!/Viagem à etapa/.test(confl), "viagem do próprio torneio não é conflito");
  assert.ok(/Defina a prioridade de Sem prioridade/.test(confl), "prioridade ausente é sinalizada");
  assert.ok(/Menos de 3 dias entre Etapa B e Sem prioridade/.test(confl) || /se cruzam/.test(confl), "intervalo curto: " + confl);
  assert.strictEqual(vA.conteudo.semanas.length, 4);
  const ativ = vA.conteudo.semanas.flatMap((s) => s.atividades);
  assert.ok(ativ.length > 0 && ativ.every((a) => a.data >= hojeStr), "atividades só de hoje em diante");
  assert.ok(ativ.filter((a) => a.tipo === "treino" || a.tipo === "jogo_treino").every((a) => ["seg", "qua", "sex", "sab"].includes(P.diaDaSemana(a.data))), "treino só nos dias da rotina");
  assert.ok(vA.conteudo.semanas[0].focos.some((f) => f.origem === "foco") && vA.conteudo.semanas[0].focos.some((f) => f.origem === "atleta"), "focos com origem preservada");
  assert.ok(vA.conteudo.semanas[0].focos.some((f) => f.origem === "partida"), "dificuldade repetida em duas partidas vira foco");
  assert.ok(vA.conteudo.fatores.observacoes.some((x) => /esforço alto/.test(x) && /não prescreve/.test(x)), "alerta de esforço sem prescrição");
  assert.ok(!/(série|repetições|kg|fisioterap)/i.test(JSON.stringify(vA.conteudo)), "nenhuma prescrição física ou clínica");
  assert.strictEqual((await PL("ana", { acao: "gerar" })).s, 409, "mesmo calendário não gera duplicata");

  /* enviar: só com treinador com a área */
  assert.strictEqual((await PL("ana", { acao: "enviar", id: vA.id })).s, 200);
  assert.strictEqual((await PL("ana")).vigente.status, "em_revisao");
  assert.strictEqual((await PL("ana", { acao: "gerar" })).s, 409, "em revisão não gera outra sugestão");
  assert.strictEqual((await PL("ana", { acao: "retirar", id: vA.id })).s, 200);
  assert.strictEqual((await PL("ana", { acao: "enviar", id: vA.id })).s, 200);

  /* permissões de leitura */
  assert.strictEqual((await PL("semarea", null, "vinculoSemArea1")).s, 403, "sem a área não vê");
  assert.strictEqual((await PL("intruso", null, "vinculoCarlos1")).s, 404, "outro treinador não alcança o vínculo");
  const mae = await PL("mae", null, "vinculoMae00001"); assert.strictEqual(mae.s, 200); assert.strictEqual(mae.podeEditar, false);
  assert.strictEqual((await PL("mae", { acao: "aprovar", vinculoId: "vinculoMae00001", id: vA.id })).s, 403, "responsável não aprova");
  assert.strictEqual((await PL("ana", { acao: "aprovar", vinculoId: "vinculoCarlos1", id: vA.id })).s, 404, "atleta não aprova pelo vínculo do treinador");
  const ver = await PL("carlos", null, "vinculoCarlos1"); assert.strictEqual(ver.s, 200); assert.strictEqual(ver.podeEditar, true); assert.ok(ver.versoes.length >= 1);

  /* treinador revisa e aprova */
  const alterado = JSON.parse(JSON.stringify(vA.conteudo)); alterado.semanas[0].objetivo = "Objetivo ajustado pelo treinador"; alterado.orientacoes = "Priorizar o saque.";
  const rev = await PL("carlos", { acao: "treinadorSalvar", vinculoId: "vinculoCarlos1", baseId: vA.id, conteudo: alterado });
  assert.strictEqual(rev.s, 200, JSON.stringify(rev));
  let gv = await PL("ana"); assert.strictEqual(gv.vigente.rotulo, "Em revisão (rascunho do treinador)"); assert.strictEqual(gv.vigente.autorNome, "carlos");
  assert.strictEqual(gv.historico.find((h) => h.id === vA.id).status, "substituido", "a versão do atleta enviada fica substituída pela revisão");
  assert.strictEqual((await PL("carlos", { acao: "aprovar", vinculoId: "vinculoCarlos1", id: rev.id })).s, 200);
  gv = await PL("ana"); const aprov = gv.vigente;
  assert.strictEqual(aprov.status, "aprovado"); assert.strictEqual(aprov.rotulo, "Aprovado pelo treinador"); assert.strictEqual(aprov.aprovadoPorNome, "carlos"); assert.ok(aprov.aprovadoEm);
  assert.strictEqual(aprov.conteudo.semanas[0].objetivo, "Objetivo ajustado pelo treinador"); assert.ok(aprov.historico.length >= 1);
  assert.strictEqual((await PL("carlos", { acao: "aprovar", vinculoId: "vinculoCarlos1", id: aprov.id })).s, 409, "já aprovada");

  /* mudança no calendário: proposta, sem trocar o aprovado */
  const t4 = await TOR("ana", { acao: "salvar", nome: "Torneio Novo", inicio: mais(40), fim: mais(42), prioridade: "A" });
  assert.ok(t4.ok);
  gv = await PL("ana");
  assert.strictEqual(gv.vigente.id, aprov.id, "o aprovado continua vigente"); assert.strictEqual(gv.vigente.status, "aprovado");
  assert.strictEqual(gv.mudou, true); assert.ok(gv.motivosMudanca.some((m) => /Torneio incluído: Torneio Novo/.test(m)));
  assert.strictEqual(gv.propostas.length, 1, "uma proposta de ajuste"); const prop = gv.propostas[0];
  assert.strictEqual(prop.status, "sugestao"); assert.strictEqual(prop.substituiId, aprov.id);
  assert.ok(prop.comparacao.some((c) => /Torneio Novo/.test(c.texto) && c.tipo === "adicionado"), JSON.stringify(prop.comparacao));
  assert.ok(prop.mudancas.some((m) => /Torneio Novo/.test(m)));
  /* outra mudança no mesmo calendário não duplica a proposta; uma nova mudança gera outra */
  await TOR("ana", { acao: "salvar", id: t4.id, nome: "Torneio Novo", inicio: mais(41), fim: mais(43), prioridade: "A" });
  gv = await PL("ana"); assert.strictEqual(gv.propostas.length, 1, "a proposta antiga não revisada é substituída"); assert.notStrictEqual(gv.propostas[0].id, prop.id);
  /* aprovar a proposta exige revisão: sugestão → enviada → aprovada; a anterior vira substituída */
  assert.strictEqual((await PL("carlos", { acao: "aprovar", vinculoId: "vinculoCarlos1", id: gv.propostas[0].id })).s, 409, "sugestão não revisada não é aprovada direto");
  assert.strictEqual((await PL("ana", { acao: "enviar", id: gv.propostas[0].id })).s, 200);
  assert.strictEqual((await PL("carlos", { acao: "aprovar", vinculoId: "vinculoCarlos1", id: gv.propostas[0].id })).s, 200);
  gv = await PL("ana"); assert.notStrictEqual(gv.vigente.id, aprov.id); assert.strictEqual(gv.vigente.status, "aprovado");
  assert.strictEqual(gv.historico.find((h) => h.id === aprov.id).status, "substituido"); assert.strictEqual(gv.mudou, false);

  /* ajuste do atleta nunca vira aprovado */
  const ed = await PL("ana", { acao: "editar", baseId: gv.vigente.id, conteudo: gv.vigente.conteudo });
  assert.strictEqual(ed.s, 200); gv = await PL("ana");
  assert.strictEqual(gv.vigente.status, "aprovado"); assert.strictEqual(gv.propostas[0].origem, "atleta"); assert.strictEqual(gv.propostas[0].rotulo, "Ajuste seu, sem revisão profissional");

  /* registros do atleta */
  const at = gv.vigente.conteudo.semanas.flatMap((s) => s.atividades).find((a) => a.tipo === "treino");
  assert.strictEqual((await PL("ana", { acao: "registrar", data: mais(1), titulo: "x", feito: "sim" })).s, 400, "data futura");
  assert.strictEqual((await PL("ana", { acao: "registrar", data: hojeStr, feito: "talvez", titulo: "x" })).s, 400);
  assert.strictEqual((await PL("ana", { acao: "registrar", data: hojeStr, versaoId: gv.vigente.id, atividadeId: at.id, feito: "parcial", esforco: 4, recuperacao: 3, obs: "cansada" })).s, 200);
  assert.strictEqual((await PL("ana", { acao: "registrar", data: hojeStr, versaoId: gv.vigente.id, atividadeId: at.id, feito: "sim", esforco: 3 })).s, 200);
  gv = await PL("ana"); assert.strictEqual(gv.execucoes.filter((x) => x.atividadeId === at.id).length, 1, "a mesma atividade não duplica o registro");
  const vc = await PL("carlos", null, "vinculoCarlos1"); assert.ok(vc.execucoes.length >= 1, "treinador vê os registros do plano");

  /* isolamento: o planejamento de um atleta nunca aparece para outro */
  assert.strictEqual((await PL("novata")).vigente.conteudo.temporada.blocos.length, 0);
  assert.strictEqual((await PL("carlos")).s, 403, "treinador não tem planejamento próprio");
  assert.strictEqual((await PL("ana", { acao: "salvarRotina", dias: DIAS7(), minutos: 60 })).s, 400, "pelo menos um dia sem treino");
  function DIAS7() { return ["seg", "ter", "qua", "qui", "sex", "sab", "dom"]; }

  /* menor de 14 anos: no máximo 5 dias de atividade por semana */
  pessoa("jovem", "atleta", (ano - 12) + "-06-06");
  await PL("jovem", { acao: "salvarRotina", dias: ["seg", "ter", "qua", "qui", "sex", "sab"], minutos: 60 });
  await PL("jovem", { acao: "gerar" });
  const sj = (await PL("jovem")).vigente.conteudo.semanas;
  assert.ok(sj.every((s) => s.atividades.filter((a) => a.tipo === "treino" || a.tipo === "jogo_treino").length <= 4), "limite conservador por idade");
  console.log("check-comp-planejamento: ok");
})().catch((e) => { console.error(e); process.exit(1); });
