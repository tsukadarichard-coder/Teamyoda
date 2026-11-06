/* Consultoria com Richard Tsukada: ativação manual, equipe pelos vínculos do app, permissões no servidor, rascunhos e notas privadas,
   destinatários das publicações, histórico de planos, jogos e compromissos sem duplicar e encerramento. Rode: node tests/check-consultoria-rt.js */
const path = require("path"), assert = require("assert");
const fx = path.join(__dirname, "../netlify/functions/");
const store = {}; let seq = 0;
const J = (v) => JSON.parse(JSON.stringify(v));
function aninhado(v, dentro) { if (Array.isArray(v)) { if (dentro) throw new Error("Nested arrays are not supported"); v.forEach((x) => aninhado(x, true)); } else if (v && typeof v === "object") { Object.values(v).forEach((x) => { if (x === undefined) throw new Error("undefined no Firestore"); aninhado(x, false); }); } }
function merge(a, b) { const o = { ...a }; for (const k of Object.keys(b)) o[k] = b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) ? merge(a[k] || {}, b[k]) : b[k]; return o; }
function docRef(p) {
  return {
    id: p.split("/").pop(), path: p,
    async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), ref: docRef(p), data: () => J(v) }; },
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
    where: (c, op, v) => colRef(p, filtros.concat([[c, v]]), lim), limit: (n) => colRef(p, filtros, n), orderBy: () => colRef(p, filtros, lim),
    async get() { let l = ids(); if (lim) l = l.slice(0, lim); const docs = l.map((k) => ({ id: k.split("/").pop(), ref: docRef(k), data: () => J(store[k]) })); return { empty: !docs.length, docs, forEach: (f) => docs.forEach(f) }; },
  };
}
const emails = {};
const admin = { firestore: () => ({ collection: (n) => colRef(n) }), auth: () => ({ getUserByEmail: async (e) => { const uid = emails[e]; if (!uid) throw new Error("no user"); return { uid, displayName: uid }; } }) };
const tokens = {};
class ErroPublico extends Error { constructor(s, m) { super(m); this.status = s; } }
require.cache[require.resolve(fx + "_player.js")] = { id: "x", filename: "x", loaded: true, exports: {
  admin, ErroPublico, OPCOES: {}, resposta: (statusCode, corpo) => ({ statusCode, body: JSON.stringify(corpo) }),
  usuarioDoPedido: async (ev) => { const t = ev.headers.authorization; if (!tokens[t]) throw new ErroPublico(401, "login"); return tokens[t]; }, refJogador: (uid) => docRef("jogadores/" + uid),
} };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };
const SDK = path.join(__dirname, "fake-sdk.js");
require.cache[SDK] = { id: SDK, filename: SDK, loaded: true, exports: class { constructor() {} } };
const Module = require("module"), resolverOriginal = Module._resolveFilename;
Module._resolveFilename = function (req, ...r) { return req === "@anthropic-ai/sdk" ? SDK : resolverOriginal.call(this, req, ...r); };
process.env.ADMIN_SECRET = "segredo"; delete process.env.ANTHROPIC_API_KEY;
const H = require(fx + "consultoria-rt.js").handler, ADM = require(fx + "admin-consultoria-rt.js").handler, R = require(fx + "_consultoria-rt.js");

const hoje = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10), ano = +hoje.slice(0, 4), mais = (n) => R.addDias(hoje, n);
function pessoa(uid, papel, idade, email) {
  const em = email || uid + "@t.com"; tokens[uid] = { uid, email: em, name: uid }; emails[em] = uid;
  store["jogadores/" + uid] = { nome: uid, competicao: { papel, ...(papel === "atleta" ? { nascimento: (ano - idade) + "-01-02" } : {}) } };
}
function vinculo(id, atleta, p, tipo, areas) { store["vinculos/" + id] = { atletaUid: atleta, atletaNome: atleta, pessoaUid: p, pessoaNome: p, tipo, status: "ativo", areas: areas || ["perfil", "temporada", "planejamento", "estrategias", "partidas", "treinos"], criadoEm: "2026-01-01" }; }
const U = async (uid, corpo, q) => { const r = await H({ httpMethod: corpo ? "POST" : "GET", headers: { authorization: uid }, queryStringParameters: q || {}, body: corpo ? JSON.stringify(corpo) : undefined }); return { s: r.statusCode, ...JSON.parse(r.body) }; };
const A = async (corpo, seg) => { const r = await ADM({ httpMethod: corpo ? "POST" : "GET", headers: { "x-admin-secret": seg === undefined ? "segredo" : seg }, body: corpo ? JSON.stringify(corpo) : undefined }); return { s: r.statusCode, ...JSON.parse(r.body) }; };
const nPartidas = (uid) => Object.keys(store).filter((k) => k.startsWith("jogadores/" + uid + "/partidas/")).length;

(async () => {
  pessoa("richard", "treinador", 0, "tsukada.richard@gmail.com");
  pessoa("ana", "atleta", 16); pessoa("lia", "atleta", 17); pessoa("beto", "atleta", 14); pessoa("mae", "responsavel"); pessoa("joao", "treinador"); pessoa("pedro", "treinador"); pessoa("intruso", "atleta", 20); pessoa("outroTreinador", "treinador");
  vinculo("vMaeAna000001", "ana", "mae", "responsavel"); vinculo("vMaeLia000001", "lia", "mae", "responsavel"); vinculo("vJoaoAna00001", "ana", "joao", "treinador"); vinculo("vOutroInt0001", "intruso", "outroTreinador", "treinador");
  store["jogadores/ana/partidas/partidaVelha01"] = { data: mais(-20), tipo: "competicao", resultado: "derrota", adversario: "Carla", placar: "4/6 3/6", videoLink: "https://youtu.be/abc" };
  store["jogadores/ana/torneios/torneioCBT0001"] = { nome: "CBT 16 anos", inicio: mais(10), fim: mais(14), estado: "inscrito", cidade: "Curitiba" };
  store["jogadores/ana/compCompromissos/compEscola001"] = { tipo: "escola", titulo: "Provas", inicio: mais(3), fim: mais(5) };

  /* ── ativação manual pelo administrador ── */
  assert.strictEqual((await A({ acao: "ativar", email: "ana@t.com", inicio: hoje }, "errado")).s, 401, "só o administrador ativa");
  assert.strictEqual((await A({ acao: "ativar", email: "beto@t.com", inicio: hoje })).s, 409, "menor de 15 anos não entra");
  assert.strictEqual((await A({ acao: "ativar", email: "mae@t.com", inicio: hoje })).s, 409, "só conta de atleta");
  const at = await A({ acao: "ativar", email: "ana@t.com", inicio: hoje });
  assert.strictEqual(at.s, 200); assert.strictEqual(at.ciclo.fim, mais(89), "ciclo de 90 dias");
  assert.strictEqual((await A({ acao: "ativar", email: "ana@t.com", inicio: hoje })).s, 409, "uma consultoria em aberto por atleta");
  const idL = (await A({ acao: "ativar", email: "lia@t.com", inicio: hoje })).id, id = at.id;
  assert.ok(!JSON.stringify(store["consultoriasRT/" + id]).match(/preco|centavos|checkout/i), "nada de preço ou cobrança");

  /* ── acesso: só quem é da consultoria ── */
  assert.strictEqual((await U("ana", null, { id })).s, 200);
  for (const quem of ["joao", "mae", "intruso", "outroTreinador", "pedro"]) assert.strictEqual((await U(quem, null, { id })).s, 404, quem + " sem acesso antes de entrar na equipe");
  assert.strictEqual((await U("joao")).consultorias.length, 0);
  assert.strictEqual((await U("ana", null, { painel: "1" })).s, 403, "painel é do consultor");
  const pa = await U("richard", null, { painel: "1" });
  assert.strictEqual(pa.s, 200); assert.strictEqual(pa.consultorias.length, 2); assert.ok(pa.consultorias.every((c) => c.etapa === "cadastro"));
  assert.ok(pa.consultorias[0].pendencias.some((p) => p.tipo === "material"), "material aguardado aparece no painel");

  /* ── equipe: os vínculos do app; o responsável acompanha mais de um atleta ── */
  assert.strictEqual((await U("intruso", { acao: "incluirEquipe", id, vinculoId: "vJoaoAna00001" })).s, 404);
  assert.strictEqual((await U("ana", { acao: "incluirEquipe", id, vinculoId: "vOutroInt0001" })).s, 404, "vínculo de outro atleta não entra");
  for (const v of ["vJoaoAna00001", "vMaeAna000001"]) assert.strictEqual((await U("ana", { acao: "incluirEquipe", id, vinculoId: v })).s, 200);
  assert.strictEqual((await U("richard", { acao: "incluirEquipe", id: idL, vinculoId: "vMaeLia000001" })).s, 200);
  assert.strictEqual((await U("mae")).consultorias.length, 2, "responsável com dois atletas");
  assert.strictEqual((await U("joao", null, { id })).papel, "treinador");
  /* convite pela consultoria: o treinador usa o código no app e, aprovado, entra sozinho na equipe */
  const cv = await U("richard", { acao: "convidarEquipe", id, tipo: "treinador" });
  assert.strictEqual(cv.s, 200); assert.ok(/^[A-Z0-9]{8}$/.test(cv.codigo)); assert.strictEqual(cv.aprova, "o responsável", "atleta menor: o responsável aprova o treinador");
  assert.ok((await U("ana", null, { id })).equipe.convites.some((x) => x.codigo === cv.codigo), "o atleta vê o código para enviar");
  Object.assign(store["vinculos/" + cv.vinculoId], { status: "aguardando", pessoaUid: "pedro", pessoaNome: "pedro" });
  assert.strictEqual((await U("pedro", null, { id })).s, 404, "aguardando aprovação: ainda sem acesso");
  store["vinculos/" + cv.vinculoId].status = "ativo";
  assert.strictEqual((await U("pedro", null, { id })).papel, "treinador", "aprovado: entra na equipe");

  /* ── cadastro de entrada: salvar e continuar depois; a família só mexe nos campos dela ── */
  assert.strictEqual((await U("ana", { acao: "salvarEntrada", id, entrada: { objetivo: "ambos" } })).pronta, false);
  assert.strictEqual((await U("ana", { acao: "salvarEntrada", id, entrada: { ...store["consultoriasRT/" + id].entrada, historico: "CBT 16 anos desde 2025", expectativaAtleta: "Quero entender o caminho", rankings: [{ nome: "CBT 16M", posicao: "34", fonte: "site da CBT", data: mais(-5) }] }, rotina: { dias: ["seg", "qua", "sex"], minutos: 90 } })).pronta, true);
  assert.deepStrictEqual(store["jogadores/ana"].competicao.rotina.dias, ["seg", "qua", "sex"], "rotina é a mesma do planejamento");
  await U("mae", { acao: "salvarEntrada", id, entrada: { historico: "apagado", expectativaFamilia: "Equilíbrio com a escola" } });
  assert.strictEqual(store["consultoriasRT/" + id].entrada.historico, "CBT 16 anos desde 2025", "responsável não altera o histórico");
  assert.strictEqual(store["consultoriasRT/" + id].entrada.expectativaFamilia, "Equilíbrio com a escola");
  assert.strictEqual((await U("joao", { acao: "salvarEntrada", id, entrada: {} })).s, 403);
  assert.ok(!("expectativaAtleta" in (await U("mae", null, { id })).entrada), "relato pessoal do atleta não vai para o responsável");

  /* ── três partidas: material do atleta, sem duplicar partidas do app ── */
  const antes = nPartidas("ana");
  const p1 = await U("ana", { acao: "salvarPartidaDiag", id, n: 1, resultado: "vitoria", dados: { data: mais(-10), torneio: "CBT", categoria: "16M", superficie: "saibro", adversario: "Bia", placar: "6/4 6/3", video: "https://youtu.be/p1", contexto: "Final", status: "concluido" } });
  assert.strictEqual(p1.s, 200); assert.strictEqual(p1.partida.status, "recebido", "o atleta não conclui a análise");
  assert.strictEqual(nPartidas("ana"), antes + 1, "partida nova entra uma vez nas partidas do app");
  await U("ana", { acao: "salvarPartidaDiag", id, n: 2, partidaExistenteId: "partidaVelha01", dados: { torneio: "FPT" } });
  assert.strictEqual(nPartidas("ana"), antes + 1, "partida já registrada é reaproveitada");
  assert.strictEqual(store["consultoriasRT/" + id].diagPartidas[1].video, "https://youtu.be/abc");
  assert.strictEqual((await U("ana", { acao: "salvarPartidaDiag", id, n: 3, dados: { video: "http://inseguro" } })).s, 400);
  await U("richard", { acao: "salvarPartidaDiag", id, n: 1, dados: { status: "concluido", obs: "NOTA-DE-TRABALHO", marcacoes: [{ tempo: "12:30", nota: "devolução curta" }] } });
  const vAna = await U("ana", null, { id });
  assert.ok(!JSON.stringify(vAna).includes("NOTA-DE-TRABALHO") && !("marcacoes" in vAna.diagPartidas[0]), "marcações e observações de trabalho só para o consultor");

  /* ── diagnóstico: rascunho invisível; não publica com material pendente; observação precisa de evidência ── */
  const diag = { secoes: { fortes: [{ texto: "Primeiro saque com direção", natureza: "observacao", evidencias: [{ partida: 1, tempo: "03:10" }] }], dificuldades: [{ texto: "Devolução curta sob pressão", natureza: "observacao", evidencias: [] }], prioridades: [{ texto: "Devolução profunda" }], questoes: [{ texto: "Cansaço no 3º set?" }] } };
  await U("richard", { acao: "salvarDiagnostico", id, conteudo: diag });
  assert.strictEqual((await U("ana", null, { id })).diagnostico, null, "rascunho não aparece");
  let pub = await U("richard", { acao: "publicarDiagnostico", id, conteudo: diag });
  assert.strictEqual(pub.s, 422); assert.ok(/Faltam 2 partidas/.test(pub.erro), "material pendente bloqueia a publicação");
  await U("ana", { acao: "salvarPartidaDiag", id, n: 3, resultado: "derrota", dados: { data: mais(-3), video: "https://youtu.be/p3", adversario: "Duda" } });
  for (const n of [2, 3]) await U("richard", { acao: "salvarPartidaDiag", id, n, dados: { status: "concluido" } });
  pub = await U("richard", { acao: "publicarDiagnostico", id, conteudo: diag });
  assert.strictEqual(pub.s, 422); assert.ok(pub.erros.some((e) => /precisa citar ao menos uma partida/.test(e)), "observação sem evidência não vira fato");
  diag.secoes.dificuldades[0].evidencias = [{ partida: 3, tempo: "41:05" }];
  assert.strictEqual((await U("richard", { acao: "publicarDiagnostico", id, conteudo: diag, destinatarios: ["atleta", "responsavel"] })).s, 200);
  assert.strictEqual((await U("ana", null, { id })).diagnostico.secoes.questoes[0].natureza, "hipotese", "questões ficam como a verificar");
  assert.ok((await U("mae", null, { id })).diagnostico); assert.strictEqual((await U("joao", null, { id })).diagnostico, null, "publicado só para os destinatários");

  /* ── plano de 90 dias: rascunho → comentário do treinador → publicado; versões preservadas ── */
  const plano = { objetivo: "Consolidar a devolução", prioridades: [{ titulo: "Devolução profunda", situacaoInicial: "Curta sob pressão", indicador: "Devoluções além da linha de saque nos vídeos", acoes: [{ texto: "Bloco de devolução 2x/semana", responsavel: "treinador", prazo: mais(30) }, { texto: "Gravar uma partida por mês", responsavel: "atleta", prazo: mais(-1) }] }] };
  const sp = await U("richard", { acao: "salvarPlano", id, conteudo: plano });
  assert.strictEqual((await U("ana", null, { id })).planos.length, 0, "rascunho do plano não aparece ao atleta");
  assert.strictEqual((await U("joao", null, { id })).planos.length, 0, "nem ao treinador antes de enviar");
  await U("richard", { acao: "enviarPlano", id, planoId: sp.planoId });
  assert.strictEqual((await U("joao", null, { id })).planos[0].estado, "em_comentario"); assert.strictEqual((await U("ana", null, { id })).planos.length, 0);
  assert.strictEqual((await U("joao", { acao: "sugerir", id, planoId: sp.planoId, texto: "Incluir devolução de segundo saque" })).s, 200);
  assert.strictEqual((await U("mae", { acao: "sugerir", id, texto: "x" })).s, 403, "sugestão é do treinador");
  assert.ok((await U("richard", null, { id })).sugestoes.some((s) => s.estado === "aberta"));
  assert.strictEqual((await U("ana", { acao: "publicarPlano", id, planoId: sp.planoId })).s, 403, "só o consultor publica");
  assert.strictEqual((await U("intruso", { acao: "publicarPlano", id, planoId: sp.planoId })).s, 404);
  assert.strictEqual((await U("richard", { acao: "publicarPlano", id, planoId: sp.planoId })).s, 200);
  const vig = (await U("ana", null, { id })).planoVigente;
  assert.strictEqual(vig.versao, 1); assert.strictEqual(vig.conteudo.fim, mais(89));
  /* ações: responsável marca a sua; atrasada aparece no painel */
  const acoes = (await U("ana", null, { id })).acoes, aT = acoes.find((a) => a.responsavel === "treinador"), aA = acoes.find((a) => a.responsavel === "atleta");
  assert.ok((await U("richard", null, { painel: "1" })).consultorias.find((c) => c.id === id).pendencias.some((p) => p.tipo === "atraso"), "ação atrasada no painel");
  assert.strictEqual((await U("ana", { acao: "marcarAcao", id, acaoId: aT.id, feita: true })).s, 403, "ação do treinador é do treinador");
  assert.strictEqual((await U("joao", { acao: "marcarAcao", id, acaoId: aT.id, feita: true })).s, 200);
  assert.strictEqual((await U("ana", { acao: "marcarAcao", id, acaoId: aA.id, feita: true })).s, 200);
  /* nova versão não sobrescreve a anterior */
  const sp2 = await U("richard", { acao: "salvarPlano", id, conteudo: { ...plano, objetivo: "Consolidar a devolução e o 2º saque" } });
  assert.strictEqual((await U("richard", { acao: "publicarPlano", id, planoId: sp2.planoId })).s, 200);
  const pls = (await U("ana", null, { id })).planos;
  assert.deepStrictEqual(pls.map((v) => v.estado), ["publicado", "substituido"], "histórico do plano preservado");
  assert.strictEqual(pls[1].conteudo.objetivo, "Consolidar a devolução");

  /* ── registros e quem vê ── */
  const n0 = nPartidas("ana");
  await U("ana", { acao: "registrarJogo", id, partida: { data: hoje, resultado: "vitoria", adversario: "Eva", placar: "6/2 6/2", superficie: "saibro", torneioId: "torneioCBT0001", videoLink: "https://youtu.be/j1" }, posjogo: { aplicou: "Devolvi mais fundo", dificuldade: "RELATO-PRIVADO" } });
  await U("ana", { acao: "registrarJogo", id, partida: { data: hoje, resultado: "derrota", adversario: "Fê" }, posjogo: { aplicou: "Mantive o plano" }, visivelPara: ["treinador"] });
  assert.strictEqual(nPartidas("ana"), n0 + 2, "um registro por jogo nas partidas do app");
  const rMae = await U("mae", null, { id }), rJoao = await U("joao", null, { id });
  assert.ok(!JSON.stringify(rMae).includes("RELATO-PRIVADO") && !JSON.stringify(rJoao).includes("RELATO-PRIVADO"), "relato do atleta não é exposto automaticamente");
  assert.strictEqual(rJoao.registros.length, 1, "o treinador vê só o que o atleta marcou para ele"); assert.strictEqual(rMae.registros.length, 0);
  assert.ok(JSON.stringify(await U("richard", null, { id })).includes("RELATO-PRIVADO"), "o consultor vê o relato");
  assert.ok((await U("richard", null, { painel: "1" })).consultorias.find((c) => c.id === id).pendencias.some((p) => /sem análise/.test(p.texto)), "jogo com vídeo sem análise no painel");
  assert.strictEqual((await U("joao", { acao: "registrarTreino", id, trabalhado: "Devolução de 2º saque", resposta: "Boa", ajustes: "Mais alvo" })).s, 200);
  assert.strictEqual((await U("ana", { acao: "registrarTreino", id, trabalhado: "x" })).s, 403);
  assert.ok((await U("ana", null, { id })).registros.some((r) => r.tipo === "treino"), "registro do treinador vai ao atleta por padrão");
  assert.ok(!(await U("mae", null, { id })).registros.some((r) => r.tipo === "treino"));
  assert.strictEqual((await U("ana", { acao: "salvarAnalise", id, conteudo: { resumo: "x" } })).s, 403, "o atleta não mexe em análises");

  /* ── análises, relatórios, notas privadas e reuniões ── */
  const pid = store["consultoriasRT/" + id] && Object.keys(store).find((k) => k.startsWith("jogadores/ana/partidas/") && store[k].adversario === "Eva").split("/").pop();
  const an = await U("richard", { acao: "salvarAnalise", id, conteudo: { partidaId: pid, titulo: "Contra Eva", resumo: "ANALISE-X", marcacoes: [{ tempo: "05:12", texto: "devolução funda" }], destinatarios: ["atleta"] } });
  assert.strictEqual((await U("ana", null, { id })).analises.length, 0, "análise em rascunho não aparece");
  await U("richard", { acao: "publicarAnalise", id, itemId: an.itemId });
  assert.strictEqual((await U("ana", null, { id })).analises[0].marcacoes[0].tempo, "05:12"); assert.strictEqual((await U("joao", null, { id })).analises.length, 0);
  assert.strictEqual((await U("richard", { acao: "salvarAnalise", id, itemId: an.itemId, conteudo: { resumo: "mudar" } })).s, 409, "publicado não se edita");
  await U("richard", { acao: "salvarNota", id, texto: "NOTA-PRIVADA-RICHARD" });
  for (const quem of ["ana", "mae", "joao"]) assert.ok(!JSON.stringify(await U(quem, null, { id })).includes("NOTA-PRIVADA-RICHARD"), "nota privada não vai para " + quem);
  const rel = await U("richard", { acao: "salvarRelatorio", id, conteudo: { titulo: "Revisão de 45 dias", objetivo: "Devolução", prioridades: [{ titulo: "Devolução profunda" }], destinatarios: ["responsavel"] } });
  assert.strictEqual((await U("richard", { acao: "publicarRelatorio", id, itemId: rel.itemId })).s, 422, "relatório sem evidências não publica");
  await U("richard", { acao: "salvarRelatorio", id, itemId: rel.itemId, conteudo: { titulo: "Revisão de 45 dias", objetivo: "Devolução", prioridades: [{ titulo: "Devolução profunda", evidencias: "Partidas 1 e 3" }], decisoes: "Calendário do 2º semestre", destinatarios: ["responsavel"] } });
  assert.strictEqual((await U("richard", { acao: "publicarRelatorio", id, itemId: rel.itemId })).s, 200);
  assert.strictEqual((await U("mae", null, { id })).relatorios.length, 1); assert.strictEqual((await U("ana", null, { id })).relatorios.length, 0, "relatório só para quem foi publicado");
  await U("richard", { acao: "salvarReuniao", id, data: mais(7), hora: "19:00", titulo: "Reunião com a família", link: "https://meet.example.com/x", participantes: ["atleta", "responsavel"] });
  const calM = (await U("mae", null, { id })).calendario, calJ = (await U("joao", null, { id })).calendario;
  assert.ok(calM.some((x) => x.tipo === "reuniao") && !calJ.some((x) => x.tipo === "reuniao"), "reunião só para os participantes");
  const calA = (await U("ana", null, { id })).calendario;
  assert.strictEqual(calA.filter((x) => x.tipo === "torneio").length, 1, "torneio vem da Temporada, uma vez");
  assert.strictEqual(calA.filter((x) => x.tipo === "compromisso").length, 1, "compromisso vem do planejamento, uma vez");
  assert.ok(calA.some((x) => x.tipo === "prazo") && calA.some((x) => x.tipo === "revisao"));

  /* ── IA: sem integração configurada, avisa e o fluxo manual continua ── */
  const ia = await U("richard", { acao: "ia", id, tipo: "diagnostico" });
  assert.strictEqual(ia.s, 503); assert.ok(/formulário/.test(ia.erro));
  assert.strictEqual((await U("ana", { acao: "ia", id, tipo: "diagnostico" })).s, 403);

  /* ── revogação: o vínculo revogado no app ou a saída da equipe tiram o acesso ── */
  store["vinculos/vMaeAna000001"].status = "revogado";
  assert.strictEqual((await U("mae", null, { id })).s, 404, "vínculo revogado: sem acesso");
  assert.strictEqual((await U("mae")).consultorias.length, 1, "continua acompanhando o outro atleta");
  await U("ana", { acao: "removerEquipe", id, vinculoId: "vJoaoAna00001" });
  assert.strictEqual((await U("joao", null, { id })).s, 404, "retirado da equipe: sem acesso");
  assert.strictEqual((await U("joao", { acao: "registrarTreino", id, trabalhado: "x" })).s, 404);

  /* ── encerramento e renovação ── */
  assert.strictEqual((await A({ acao: "estado", id, estado: "encerrada" })).s, 200);
  assert.strictEqual((await U("ana", { acao: "registrarJogo", id, partida: { data: hoje, resultado: "vitoria" } })).s, 409, "encerrada: sem registros novos");
  const fim = await U("ana", null, { id });
  assert.strictEqual(fim.s, 200); assert.ok(fim.diagnostico && fim.planos.length === 2, "histórico preservado após o encerramento");
  assert.strictEqual(fim.etapa, "encerrada");
  assert.strictEqual((await A({ acao: "renovar", id, inicio: mais(90) })).s, 200);
  const ren = await A(); const c1 = ren.consultorias.find((c) => c.id === id);
  assert.strictEqual(c1.ciclos.length, 2); assert.strictEqual(c1.estado, "ativa"); assert.strictEqual(c1.ciclo.fim, mais(179));
  console.log("check-consultoria-rt: ok");
})().catch((e) => { console.error(e); process.exit(1); });
