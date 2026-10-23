/* QuadraLab Hub — fluxo completo e segurança no servidor:
   1 publicar → 2 encontrar → 3 pedir → 4 proposta → 5 ajuste/aceite → 6 acompanhamento → 7 avaliação → 8 vencimento da assinatura;
   acesso às conversas, menores, versões de proposta, pedidos repetidos, assinatura, pausa/suspensão, Player × Competição, moderação e métricas.
   Rode: node tests/check-hub.js */
const path = require("path"), assert = require("assert");
const fx = path.join(__dirname, "../netlify/functions/");
const store = {}; let seq = 0;
const J = (v) => JSON.parse(JSON.stringify(v));
function merge(a, b) { const o = { ...a }; for (const k of Object.keys(b)) o[k] = b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) ? merge(a[k] || {}, b[k]) : b[k]; return o; }
function docRef(p) {
  return {
    id: p.split("/").pop(),
    async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), ref: docRef(p), data: () => J(v) }; },
    async set(v, o) { store[p] = o && o.merge ? merge(store[p] || {}, J(v)) : J(v); },
    async update(v) { if (!store[p]) throw new Error("no doc " + p); Object.assign(store[p], J(v)); },
    async delete() { delete store[p]; },
    collection: (c) => colRef(p + "/" + c),
  };
}
function colRef(p, filtros = []) {
  const ids = () => Object.keys(store).filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/")).filter((k) => filtros.every(([c, v]) => store[k][c] === v));
  return {
    doc: (id) => docRef(p + "/" + id),
    async add(v) { const id = "doc" + String(++seq).padStart(12, "0"); store[p + "/" + id] = J(v); return docRef(p + "/" + id); },
    where: (c, op, v) => { assert.strictEqual(op, "=="); return colRef(p, filtros.concat([[c, v]])); },
    async get() { const docs = ids().map((k) => ({ id: k.split("/").pop(), ref: docRef(k), data: () => J(store[k]) })); return { empty: !docs.length, docs, forEach: (f) => docs.forEach(f) }; },
  };
}
const admin = { firestore: () => ({ collection: (n) => colRef(n) }) };
const tokens = {};
class ErroPublico extends Error { constructor(s, m) { super(m); this.status = s; } }
const fakePlayer = {
  admin, ErroPublico, resposta: (statusCode, corpo) => ({ statusCode, body: JSON.stringify(corpo) }),
  usuarioDoPedido: async (ev) => { const t = (ev.headers || {}).authorization; if (!tokens[t]) throw new ErroPublico(401, "login"); return tokens[t]; },
  refJogador: (uid) => docRef("jogadores/" + uid),
};
require.cache[require.resolve(fx + "_player.js")] = { id: "x", filename: "x", loaded: true, exports: fakePlayer };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };
process.env.ADMIN_SECRET = "segredo-hub";

const H = require(fx + "_hub.js");
const prof = require(fx + "hub-profissional.js").handler, busca = require(fx + "hub-busca.js").handler;
const at = require(fx + "hub-atendimentos.js").handler, adm = require(fx + "admin-hub.js").handler;
const call = async (h, uid, corpo, qs) => { const r = await h({ httpMethod: corpo ? "POST" : "GET", headers: { authorization: uid }, body: corpo ? JSON.stringify(corpo) : undefined, queryStringParameters: qs || {} }); let j = {}; try { j = JSON.parse(r.body); } catch (e) {} return { s: r.statusCode, raw: r.body, ...j }; };
const P = (uid, c) => call(prof, uid, c), B = (uid, qs) => call(busca, uid, null, qs), A = (uid, c, qs) => call(at, uid, c, qs);
const ADM = async (c) => { const r = await adm({ httpMethod: c ? "POST" : "GET", headers: { "x-admin-secret": "segredo-hub" }, body: c ? JSON.stringify(c) : undefined }); return { s: r.statusCode, raw: r.body, ...JSON.parse(r.body) }; };

const hoje = H.hojeBR(), ano = +hoje.slice(0, 4);
const somaDias = (n) => { const d = new Date(hoje + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
function treinador(uid, orgId, plano, ate) { tokens[uid] = { uid, email: uid + "@t.com", name: uid, orgId }; store["orgs/" + orgId + "/meta/info"] = { nome: orgId, plano, ...(ate ? { planoAtivoAte: ate } : {}) }; }
function jogador(uid, nome, comp, extra) { tokens[uid] = { uid, email: uid + "@t.com", name: nome }; store["jogadores/" + uid] = { nome, email: uid + "@t.com", ...(comp ? { competicao: comp } : {}), ...(extra || {}) }; }
const vinc = (resp, atleta, nome) => { store["vinculos/v" + resp + atleta] = { atletaUid: atleta, pessoaUid: resp, pessoaNome: "Resp " + resp, atletaNome: nome, tipo: "responsavel", status: "ativo" }; };

const perfilOk = {
  nomeProfissional: "Carla Souza", apresentacao: "Treinadora de tênis com foco em técnica e jogo.", biografia: "Ex-jogadora juvenil.", cidade: "Itajaí", uf: "sc", regioes: ["Balneário Camboriú"],
  locais: ["Clube Público Municipal"], modalidade: "ambos", publicos: ["juvenis", "adultos"], niveis: ["iniciante", "intermediario", "competicao"], experienciaAnos: 12, experiencia: "Clubes da região.",
  formacao: "Educação Física", idiomas: ["Português", "Espanhol"], disponibilidade: ["seg-tarde", "qua-tarde", "sab-manha"], aceitandoNovos: true, exibicao: "ambos",
  servicos: [
    { nome: "Aula particular", categoria: "aula_individual", descricao: "Uma hora de aula.", modalidade: "presencial", formato: "individual", duracaoMin: 60, precoTipo: "fixo", precoCentavos: 15000, unidade: "aula", incluiQuadra: true },
    { nome: "Preparação para o circuito", categoria: "torneios", modalidade: "ambos", precoTipo: "a_partir_de", precoCentavos: 60000, unidade: "mes" },
    { nome: "Análise remota", categoria: "remoto", modalidade: "remoto", precoTipo: "sob_consulta" },
  ],
};
const propostaOk = (extra) => ({ servico: "Aula particular", modalidade: "presencial", local: "Clube Público Municipal", dataHora: somaDias(3) + "T15:00", duracaoMin: 60, quantidade: "4 aulas em 1 mês",
  valorTotalCentavos: 60000, unidade: "pacote", incluidos: "Quadra e bolas", custosAdicionais: "", formaPagamento: "Pix direto para a treinadora", cancelamento: "Avisar com 24 h", validade: somaDias(5), ...(extra || {}) });

(async () => {
  treinador("carla", "carla-org", "essencial", somaDias(20));
  treinador("gratuito", "gratis-org", "gratis");
  treinador("beto", "beto-org", "premium", somaDias(40));
  jogador("ana", "Ana Lima", { papel: "atleta", nascimento: (ano - 30) + "-02-02" }, { ficha: { nivel: "intermediario" } });
  jogador("semdata", "Pedro Player");
  jogador("menor", "Lucas Pereira", { papel: "atleta", nascimento: (ano - 13) + "-06-06" });
  jogador("menorsemresp", "Bia Nunes", { papel: "atleta", nascimento: (ano - 12) + "-06-06" });
  jogador("mae", "Marta Pereira", { papel: "responsavel" });
  jogador("intruso", "Intruso", { papel: "atleta", nascimento: (ano - 25) + "-01-01" });
  vinc("mae", "menor", "Lucas Pereira");

  /* ── 1. publicar ── */
  assert.strictEqual((await P("ana")).s, 403, "jogador não tem perfil profissional");
  assert.strictEqual((await P("ninguem")).s, 401);
  let g = await P("gratuito");
  assert.strictEqual(g.estado, "rascunho"); assert.strictEqual(g.assinatura.ativa, false);
  assert.strictEqual((await P("gratuito", { acao: "salvar", perfil: { ...perfilOk, nomeProfissional: "Gil" } })).s, 200, "plano grátis salva rascunho");
  g = await P("gratuito"); assert.strictEqual(g.previa.nomeProfissional, "Gil", "plano grátis vê a prévia");
  const semPlano = await P("gratuito", { acao: "publicar", confirmo: true });
  assert.strictEqual(semPlano.s, 402); assert.ok(semPlano.semAssinatura);
  assert.strictEqual(store["hubProfissionais/gratuito"].estado, "rascunho");
  assert.ok(!JSON.stringify(store).includes("cobranca") && !store["orgs/gratis-org/meta/info"].planoAtivoAte, "nada de cobrança criada");

  for (const [campo, valor, trecho] of [["apresentacao", "x".repeat(301), "300"], ["biografia", "y".repeat(1501), "1.500"], ["apresentacao", "Me chame no (47) 99999-1234", "telefone"], ["biografia", "carla@exemplo.com", "e-mail"]]) {
    const r = await P("carla", { acao: "salvar", perfil: { ...perfilOk, [campo]: valor } });
    assert.strictEqual(r.s, 400, campo); assert.ok(r.erro.includes(trecho), r.erro);
  }
  assert.strictEqual((await P("carla", { acao: "salvar", perfil: { ...perfilOk, servicos: [{ ...perfilOk.servicos[0], unidade: "" }] } })).s, 400, "preço sem unidade");
  assert.strictEqual((await P("carla", { acao: "salvar", perfil: { ...perfilOk, servicos: [] } })).s, 200);
  assert.strictEqual((await P("carla", { acao: "publicar", confirmo: true })).s, 409, "sem serviço não publica");
  const salvo = await P("carla", { acao: "salvar", perfil: perfilOk });
  assert.strictEqual(salvo.s, 200); assert.strictEqual(salvo.estado, "rascunho", "pagar/salvar nunca publica sozinho");
  assert.strictEqual(salvo.perfil.uf, "SC"); assert.strictEqual(salvo.perfil.servicos.length, 3); assert.ok(salvo.perfil.servicos.every((s) => H.ID_SERVICO.test(s.id)), "cada serviço ganha um id");
  assert.strictEqual(salvo.previa.servicos[0].preco, "R$ 150,00 por aula"); assert.strictEqual(salvo.previa.servicos[1].preco, "A partir de R$ 600,00 por mês"); assert.strictEqual(salvo.previa.servicos[2].preco, "Sob consulta");
  assert.ok(!("orgId" in salvo.previa) && !("metricas" in salvo.previa), "prévia sem dados internos");
  assert.strictEqual((await P("carla", { acao: "publicar" })).s, 400, "publicar exige confirmação explícita");
  assert.strictEqual((await P("carla", { acao: "foto", dataUrl: "data:text/html;base64,PHNjcmlwdD4=" })).s, 400, "foto só imagem");
  assert.strictEqual((await P("carla", { acao: "foto", dataUrl: "data:image/jpeg;base64,/9j/4AAQ" })).s, 200);
  const pub = await P("carla", { acao: "publicar", confirmo: true });
  assert.strictEqual(pub.s, 200); assert.strictEqual(pub.estado, "publicado"); assert.ok(store["hubProfissionais/carla"].consentimentoPublicacao.em);
  assert.strictEqual((await P("beto", { acao: "salvar", perfil: { ...perfilOk, nomeProfissional: "Beto Remoto", cidade: "Curitiba", uf: "PR", regioes: [], modalidade: "remoto", exibicao: "competicao", servicos: [{ nome: "Planejamento anual", categoria: "temporada", modalidade: "remoto", precoTipo: "fixo", precoCentavos: 20000, unidade: "mes" }] } })).s, 200);
  assert.strictEqual((await P("beto", { acao: "publicar", confirmo: true })).s, 200);
  assert.strictEqual((await P("carla", { acao: "salvar", perfil: { ...perfilOk, servicos: [] } })).s, 409, "perfil publicado não fica sem serviço");

  /* ── 2. encontrar ── */
  assert.strictEqual((await B("ninguem", { modo: "player" })).s, 401, "busca exige login");
  let r = await B("ana", { modo: "player", cidade: "itajai" });
  assert.deepStrictEqual(r.resultados.map((c) => c.uid), ["carla"], "Beto só aparece na Competição");
  const card = r.resultados[0];
  assert.strictEqual(card.local, "Itajaí · SC"); assert.ok(card.foto.includes("foto=carla")); assert.ok(card.aceitandoNovos);
  assert.ok(card.preco.includes("por aula") || card.preco.includes("por mês"), "preço com unidade: " + card.preco);
  r = await B("ana", { modo: "competicao", cidade: "Itajaí" });
  assert.deepStrictEqual(r.resultados.map((c) => c.uid).sort(), ["beto", "carla"], "remoto aparece em qualquer cidade");
  r = await B("ana", { modo: "competicao", cidade: "Manaus" });
  assert.deepStrictEqual(r.resultados.map((c) => c.uid).sort(), ["beto", "carla"], "fora da cidade: só serviços remotos");
  r = await B("ana", { modo: "player", cidade: "Manaus", modalidade: "presencial" });
  assert.strictEqual(r.total, 0, "presencial em outra cidade não aparece");
  r = await B("ana", { modo: "player", cidade: "balneario camboriu", modalidade: "presencial" });
  assert.strictEqual(r.total, 1, "região atendida conta");
  r = await B("ana", { modo: "player", unidade: "aula", precoMax: "100" });
  assert.strictEqual(r.total, 0); assert.ok(r.avisoPreco.includes("por aula"));
  r = await B("ana", { modo: "player", unidade: "aula", precoMax: "200", cidade: "Itajaí" });
  assert.strictEqual(r.total, 1, "preço compara só a mesma unidade");
  r = await B("ana", { modo: "player", nivel: "avancado" }); assert.strictEqual(r.total, 0, "nível filtra");
  r = await B("ana", { modo: "player", publico: "criancas" }); assert.strictEqual(r.total, 0, "público filtra");
  r = await B("ana", { modo: "player", disponibilidade: "dom-noite" }); assert.strictEqual(r.total, 0, "disponibilidade filtra");
  r = await B("ana", { modo: "competicao", objetivo: "temporada", cidade: "Itajaí" });
  assert.strictEqual(r.resultados[0].uid, "beto", "Competição prioriza temporada quando é o objetivo");
  const semRes = store["hubMetricas/" + hoje];
  assert.ok(semRes.buscas >= 10 && semRes.buscasSemResultado >= 4, "métricas de busca com e sem resultado");
  const pf = await B("ana", { perfil: "carla", modo: "player" });
  assert.strictEqual(pf.s, 200); assert.ok(pf.recebePedidos); assert.strictEqual(pf.perfil.declarado, "Experiência e formação informadas pelo profissional.");
  assert.strictEqual(pf.perfil.verificado, null, "sem selo antes da verificação");
  assert.ok(!pf.raw.includes("carla@t.com") && !pf.raw.includes("carla-org"), "perfil público sem e-mail/org");
  assert.strictEqual(store["hubProfissionais/carla"].metricas.visualizacoes, 1);
  assert.strictEqual((await B("ana", { perfil: "gratuito" })).s, 404, "rascunho não é público");
  const foto = await busca({ httpMethod: "GET", headers: {}, queryStringParameters: { foto: "carla" } });
  assert.strictEqual(foto.statusCode, 200); assert.strictEqual(foto.headers["content-type"], "image/jpeg");
  assert.strictEqual((await busca({ httpMethod: "GET", headers: {}, queryStringParameters: { foto: "gratuito" } })).statusCode, 404);

  /* ── 3. pedir ── */
  const prep = await A("ana", null, { preparar: "carla" });
  assert.strictEqual(prep.nivel, "intermediario", "nível vem da ficha"); assert.strictEqual(prep.paraQuem[0].id, "eu"); assert.ok(prep.texto.includes("combinados diretamente"));
  const base = { acao: "enviar", profissionalUid: "carla", paraQuem: "eu", servicoId: store["hubProfissionais/carla"].servicos[0].id, objetivo: "tecnica", nivel: "intermediario", modalidade: "presencial", cidade: "Itajaí", disponibilidade: ["seg-tarde"], mensagem: "Quero melhorar o backhand.", orcamento: "até R$ 150 por aula" };
  assert.strictEqual((await A("ana", { ...base, chave: "x" })).s, 400, "sem chave do aparelho");
  assert.strictEqual((await A("ana", { ...base, chave: "chave-ana-1", mensagem: "m".repeat(1001) })).s, 400, "mensagem até 1000");
  assert.strictEqual((await A("ana", { ...base, chave: "chave-ana-1", cidade: "" })).s, 400, "presencial exige cidade");
  const env = await A("ana", { ...base, chave: "chave-ana-1" });
  assert.strictEqual(env.s, 200, env.raw); assert.strictEqual(env.mensagem, H.TEXTO_ENVIADO);
  const id1 = env.id;
  const rep = await A("ana", { ...base, chave: "chave-ana-1" });
  assert.ok(rep.repetido && rep.id === id1, "reenvio do mesmo formulário não duplica");
  const dup = await A("ana", { ...base, chave: "chave-ana-2" });
  assert.strictEqual(dup.s, 409); assert.strictEqual(dup.id, id1, "mesmo profissional+atleta+serviço em aberto = duplicado");
  assert.strictEqual(Object.keys(store).filter((k) => /^hubPedidos\/[^/]+$/.test(k)).length, 1);
  const doc1 = store["hubPedidos/" + id1];
  assert.ok(!JSON.stringify(doc1).includes("ana@t.com") && !JSON.stringify(doc1).includes("nascimento"), "pedido sem e-mail/nascimento");
  assert.strictEqual(doc1.naoLidas.carla, 1);
  /* jogador sem data de nascimento declara 18+ */
  const sd = await A("semdata", { ...base, chave: "chave-sd-1", servicoId: "" });
  assert.strictEqual(sd.s, 400); assert.ok(sd.precisaDeclarar);
  const sd2 = await A("semdata", { ...base, chave: "chave-sd-1", servicoId: "", maior18: true });
  assert.strictEqual(sd2.s, 200, sd2.raw);
  /* treinador vê, avisos chegam */
  let lc = await A("carla");
  assert.strictEqual(lc.comoProfissional.length, 2); assert.ok(lc.avisos.naoLidos >= 2);
  assert.strictEqual(lc.comoProfissional.find((p) => p.id === id1).proximaAcao, "Responda ao pedido");

  /* acesso às conversas */
  assert.strictEqual((await A("intruso", null, { id: id1 })).s, 404, "terceiro não vê o pedido");
  assert.strictEqual((await A("beto", null, { id: id1 })).s, 404, "outro profissional não vê");
  assert.strictEqual((await A("mae", null, { id: id1 })).s, 404, "responsável de outro atleta não vê");
  assert.strictEqual((await A("intruso", { acao: "mensagem", id: id1, texto: "oi" })).s, 404);
  assert.strictEqual((await A("beto", { acao: "proposta", id: id1, proposta: propostaOk() })).s, 404);
  assert.strictEqual((await A("ana", { acao: "proposta", id: id1, proposta: propostaOk() })).s, 403, "jogador não envia proposta");

  /* ── 4. proposta ── */
  const vc = await A("carla", null, { id: id1 });
  assert.strictEqual(vc.pedido.pedido.mensagem, "Quero melhorar o backhand."); assert.strictEqual(vc.pedido.naoLidas, 0); assert.strictEqual(store["hubPedidos/" + id1].naoLidas.carla, 0, "abrir zera não lidas, sem mudar o estado");
  assert.strictEqual(store["hubPedidos/" + id1].estado, "aguardando_resposta");
  assert.strictEqual((await A("carla", { acao: "mensagem", id: id1, texto: "Olá Ana! Tenho horário." })).s, 200);
  assert.strictEqual(store["hubPedidos/" + id1].estado, "em_conversa");
  assert.strictEqual(store["hubProfissionais/carla"].metricas.respondidos, 1, "tempo de primeira resposta registrado");
  assert.strictEqual((await A("carla", { acao: "proposta", id: id1, proposta: propostaOk({ validade: somaDias(-1) }) })).s, 400, "validade no passado");
  assert.strictEqual((await A("carla", { acao: "proposta", id: id1, proposta: propostaOk({ formaPagamento: "" }) })).s, 400);
  const v1 = await A("carla", { acao: "proposta", id: id1, proposta: propostaOk() });
  assert.strictEqual(v1.versao, 1); assert.strictEqual(store["hubPedidos/" + id1].estado, "proposta_enviada");
  assert.strictEqual(store["hubPedidos/" + id1].naoLidas.ana, 2, "não lidas separadas do estado");

  /* ── 5. ajuste e aceite ── */
  assert.strictEqual((await A("ana", { acao: "aceitar", id: id1, versao: 1 })).s, 400, "aceite exige confirmação com o texto");
  assert.strictEqual((await A("ana", { acao: "pedirAjuste", id: id1, versao: 1, texto: "Pode ser às 16h?" })).s, 200);
  assert.strictEqual(store["hubPedidos/" + id1].propostas[0].estado, "ajuste_pedido"); assert.strictEqual(store["hubPedidos/" + id1].estado, "em_conversa");
  assert.strictEqual((await A("ana", { acao: "aceitar", id: id1, versao: 1, confirmo: true })).s, 409, "versão com ajuste pedido não é aceita");
  const v2 = await A("carla", { acao: "proposta", id: id1, proposta: propostaOk({ dataHora: somaDias(3) + "T16:00" }) });
  assert.strictEqual(v2.versao, 2);
  const pv = store["hubPedidos/" + id1].propostas;
  assert.strictEqual(pv[0].estado, "substituida"); assert.strictEqual(pv[0].dataHora.slice(-5), "15:00", "versão antiga fica intacta");
  assert.strictEqual((await A("ana", { acao: "aceitar", id: id1, versao: 1, confirmo: true })).s, 409, "versão antiga não pode ser aceita");
  const ac = await A("ana", { acao: "aceitar", id: id1, versao: 2, confirmo: true });
  assert.strictEqual(ac.s, 200, ac.raw);
  let pd = store["hubPedidos/" + id1];
  assert.strictEqual(pd.estado, "combinado"); assert.strictEqual(pd.aceite.versao, 2); assert.ok(pd.aceite.em); assert.strictEqual(pd.aceite.texto, H.TEXTO_ACEITE);
  assert.ok(!JSON.stringify(pd).includes("\"pago\""), "nunca marca pago");
  /* proposta aceita não muda em silêncio: alteração vira versão 3 e precisa de aceite */
  const v3 = await A("carla", { acao: "proposta", id: id1, proposta: propostaOk({ valorTotalCentavos: 70000 }) });
  assert.strictEqual(v3.versao, 3); pd = store["hubPedidos/" + id1];
  assert.strictEqual(pd.estado, "combinado"); assert.strictEqual(pd.aceite.versao, 2, "aceite continua na versão 2"); assert.strictEqual(pd.propostas[1].valorTotalCentavos, 60000);
  assert.strictEqual((await A("ana", { acao: "recusarProposta", id: id1, versao: 3 })).s, 200);
  pd = store["hubPedidos/" + id1]; assert.strictEqual(pd.aceite.versao, 2); assert.strictEqual(pd.propostas[2].estado, "recusada");

  /* ── 6. acompanhamento ── */
  let la = await A("ana");
  const item = la.comoJogador.find((p) => p.id === id1);
  assert.strictEqual(item.rotulo, "Combinado"); assert.ok(item.naoLidas > 0); assert.ok(item.proximaAcao);
  const det = await A("ana", null, { id: id1 });
  assert.ok(det.mensagens.length >= 4 && det.mensagens.some((m) => m.tipo === "ajuste")); assert.ok(det.pedido.historico.length >= 5);
  assert.ok(det.textos.vinculo.includes("Vínculos"), "acompanhamento é convite separado");
  assert.ok(!/"(diario|partidas|planejamento|saude|ficha)"/.test(JSON.stringify(det)), "nada de diário, partidas, planos ou saúde");
  assert.strictEqual((await A("ana", { acao: "avaliar", id: id1, nota: 5 })).s, 409, "avaliar só depois de concluir");
  assert.strictEqual((await A("carla", { acao: "concluir", id: id1 })).s, 200);
  assert.strictEqual(store["hubPedidos/" + id1].estado, "combinado", "marcado pelo profissional ainda espera o jogador");
  assert.strictEqual((await A("ana", { acao: "concluir", id: id1 })).s, 200);
  assert.strictEqual(store["hubPedidos/" + id1].estado, "concluido");
  assert.strictEqual((await A("ana", { acao: "mensagem", id: id1, texto: "oi" })).s, 409, "conversa concluída fica só para leitura");

  /* ── 7. avaliação ── */
  assert.strictEqual((await A("carla", { acao: "avaliar", id: id1, nota: 5 })).s, 403, "profissional não se avalia");
  assert.strictEqual((await A("ana", { acao: "avaliar", id: id1, nota: 6 })).s, 400);
  assert.strictEqual((await A("ana", { acao: "avaliar", id: id1, nota: 5, comentario: "Ótima! me liga 47999991234" })).s, 400);
  assert.strictEqual((await A("ana", { acao: "avaliar", id: id1, nota: 5, comentario: "Aulas muito bem organizadas." })).s, 200);
  assert.strictEqual((await A("ana", { acao: "avaliar", id: id1, nota: 1 })).s, 409, "uma avaliação por atendimento");
  assert.strictEqual((await A("carla", { acao: "responderAvaliacao", id: id1, texto: "Obrigada, Ana!" })).s, 200);
  const pf2 = await B("intruso", { perfil: "carla" });
  assert.strictEqual(pf2.perfil.avaliacoes.length, 1); assert.strictEqual(pf2.perfil.mediaAvaliacoes, 5);
  assert.ok(pf2.perfil.avaliacoes[0].origem.includes("concluído") && !pf2.raw.includes("compra verificada"));
  assert.strictEqual(pf2.perfil.avaliacoes[0].autor, "Ana"); assert.strictEqual(pf2.perfil.avaliacoes[0].resposta.texto, "Obrigada, Ana!");

  /* ── menores ── */
  const mprep = await A("mae", null, { preparar: "carla" });
  assert.deepStrictEqual(mprep.paraQuem.map((x) => x.id), ["menor"], "responsável pede para o atleta vinculado");
  const bm = { ...base, servicoId: "", objetivo: "torneios", nivel: "competicao", mensagem: "Primeiro torneio.", modo: "competicao" };
  assert.strictEqual((await A("menorsemresp", { ...bm, chave: "chave-bia-1" })).s, 409, "menor sem responsável não envia");
  const mz = await A("menor", { ...bm, chave: "chave-lucas-1" });
  assert.strictEqual(mz.s, 200); assert.strictEqual(mz.estado, "aguardando_responsavel");
  const idm = mz.id;
  assert.strictEqual((await A("carla", null, { id: idm })).s, 404, "profissional não vê antes do responsável confirmar");
  assert.ok(!(await A("carla")).comoProfissional.some((p) => p.id === idm));
  assert.strictEqual((await A("menor", { acao: "confirmarEnvio", id: idm })).s, 409, "menor não confirma sozinho");
  assert.strictEqual(store["hubPedidos/" + idm].atletaNome, "Lucas", "só o primeiro nome do menor");
  assert.strictEqual((await A("mae", { acao: "confirmarEnvio", id: idm })).s, 200);
  let pm = store["hubPedidos/" + idm];
  assert.strictEqual(pm.estado, "aguardando_resposta"); assert.strictEqual(pm.contratanteUid, "mae");
  assert.strictEqual((await A("menor", { acao: "mensagem", id: idm, texto: "oi treinadora" })).s, 403, "sem canal privado entre profissional e menor");
  assert.strictEqual((await A("carla", { acao: "mensagem", id: idm, texto: "Olá, Marta e Lucas!" })).s, 200);
  assert.ok(store["hubNotificacoes/mae/itens/" + Object.keys(store).filter((k) => k.startsWith("hubNotificacoes/mae/itens/")).pop().split("/").pop()], "responsável recebe avisos");
  const vm = await A("menor", null, { id: idm });
  assert.strictEqual(vm.s, 200); assert.strictEqual(vm.permissoes.escrever, false); assert.deepStrictEqual(vm.responsaveisNaConversa, ["Resp"]);
  await A("carla", { acao: "proposta", id: idm, proposta: propostaOk() });
  assert.strictEqual((await A("menor", { acao: "aceitar", id: idm, versao: 1, confirmo: true })).s, 403, "menor não aceita");
  assert.strictEqual((await A("mae", { acao: "aceitar", id: idm, versao: 1, confirmo: true })).s, 200);
  assert.strictEqual(store["hubPedidos/" + idm].aceite.papel, "responsavel");
  /* responsável perde o vínculo: conversa pausa */
  store["vinculos/vmaemenor"].status = "revogado";
  assert.strictEqual((await A("carla", { acao: "mensagem", id: idm, texto: "?" })).s, 409, "sem responsável ativo, a conversa com o menor pausa");
  assert.strictEqual((await A("mae", null, { id: idm })).s, 404, "quem perdeu o vínculo deixa de ver");
  assert.strictEqual((await A("menor", null, { id: idm })).s, 200);
  store["vinculos/vmaemenor"].status = "ativo";
  /* responsável pedindo direto */
  const md = await A("mae", { ...bm, paraQuem: "menor", chave: "chave-mae-1", servicoId: store["hubProfissionais/carla"].servicos[1].id });
  assert.strictEqual(md.s, 200); assert.strictEqual(md.estado, "aguardando_resposta");
  assert.strictEqual((await A("mae", { ...bm, paraQuem: "ana", chave: "chave-mae-2" })).s, 403, "só atleta vinculado");

  /* ── pausa, suspensão e bloqueio ── */
  assert.strictEqual((await P("carla", { acao: "pausar" })).estado, "pausado");
  assert.strictEqual((await B("ana", { modo: "player", cidade: "Itajaí" })).total, 0, "pausado sai da busca");
  assert.strictEqual((await A("intruso", { ...base, chave: "chave-int-1" })).s, 409, "pausado não recebe pedido");
  assert.strictEqual((await A("carla", { acao: "mensagem", id: md.id, texto: "Sigo respondendo." })).s, 200, "conversas existentes continuam na pausa");
  assert.strictEqual((await P("carla", { acao: "publicar", confirmo: true })).estado, "publicado");
  assert.strictEqual((await ADM({ acao: "suspender", uid: "carla" })).s, 400, "moderação exige motivo");
  assert.strictEqual((await ADM({ acao: "suspender", uid: "carla", motivo: "Denúncia em análise" })).s, 200);
  assert.strictEqual((await P("carla")).estado, "suspenso");
  assert.strictEqual((await B("ana", { modo: "player", cidade: "Itajaí" })).total, 0, "suspenso sai da busca");
  assert.strictEqual((await P("carla", { acao: "publicar", confirmo: true })).s, 409, "suspenso não se republica");
  await P("carla", { acao: "pausar" });
  assert.strictEqual((await ADM({ acao: "reativar", uid: "carla", motivo: "Analisado, sem problema" })).s, 200);
  assert.strictEqual((await P("carla")).estado, "pausado", "reativação respeita a pausa do profissional");
  await P("carla", { acao: "publicar", confirmo: true });
  assert.strictEqual((await A("intruso", { acao: "bloquear", profissionalUid: "carla" })).s, 200);
  assert.strictEqual((await A("intruso", { ...base, chave: "chave-int-2" })).s, 403, "bloqueado não envia");
  assert.strictEqual((await B("intruso", { perfil: "carla" })).bloqueado, true);
  assert.strictEqual((await A("intruso", { acao: "desbloquear", profissionalUid: "carla" })).s, 200);

  /* ── denúncias e moderação: o administrador vê só o denunciado ── */
  const msgCarla = (await A("mae", null, { id: idm })).mensagens.find((m) => !m.minha && m.tipo === "texto");
  assert.strictEqual((await A("intruso", { acao: "denunciar", tipo: "mensagem", pedidoId: idm, mensagemId: msgCarla.id, motivo: "conduta" })).s, 404, "só participante denuncia mensagem");
  assert.strictEqual((await A("mae", { acao: "denunciar", tipo: "mensagem", pedidoId: idm, mensagemId: msgCarla.id, motivo: "conduta", texto: "teste" })).s, 200);
  assert.strictEqual((await A("intruso", { acao: "denunciar", tipo: "perfil", profissionalUid: "carla", motivo: "informacao_falsa" })).s, 200);
  const painel = await ADM();
  assert.strictEqual(painel.s, 200);
  assert.ok(!painel.raw.includes("Pode ser às 16h") && !painel.raw.includes("Quero melhorar o backhand"), "painel não mostra conversas nem pedidos");
  assert.ok(painel.raw.includes("Olá, Marta e Lucas!"), "mostra só a mensagem denunciada");
  const ind = painel.indicadores;
  assert.ok(ind.perfisPublicados >= 2 && ind.pedidos >= 3 && ind.respostas >= 2 && ind.propostas >= 3 && ind.aceites >= 2 && ind.concluidos >= 1 && ind.visualizacoes >= 1 && ind.buscasSemResultado >= 1 && ind.primeiraRespostaMediaMin !== null, JSON.stringify(ind));
  const dm = painel.denuncias.find((d) => d.tipo === "mensagem");
  assert.strictEqual((await ADM({ acao: "ocultarMensagem", denunciaId: dm.id, motivo: "Conteúdo impróprio" })).s, 200);
  assert.ok((await A("mae", null, { id: idm })).mensagens.some((m) => m.oculta && m.texto.includes("moderação")));
  assert.strictEqual((await ADM({ acao: "verificar", uid: "carla", itens: ["Registro profissional"], motivo: "Documento conferido" })).s, 200);
  assert.deepStrictEqual((await B("ana", { perfil: "carla" })).perfil.verificado.itens, ["Registro profissional"]);
  const pc = await P("carla");
  assert.ok(pc.indicadores.pedidos >= 3 && pc.indicadores.visualizacoes >= 1 && pc.indicadores.primeiraRespostaMin !== null, "indicadores do profissional");
  assert.strictEqual((await adm({ httpMethod: "GET", headers: { "x-admin-secret": "errado" } })).statusCode, 401);

  /* ── 8. vencimento da assinatura ── */
  store["orgs/carla-org/meta/info"].planoAtivoAte = somaDias(-1);
  assert.strictEqual((await P("carla")).estado, "indisponivel_assinatura");
  assert.strictEqual((await B("ana", { modo: "player", cidade: "Itajaí" })).total, 0, "vencida sai da busca");
  assert.strictEqual((await B("ana", { perfil: "carla" })).s, 404);
  assert.strictEqual((await busca({ httpMethod: "GET", headers: {}, queryStringParameters: { foto: "carla" } })).statusCode, 404);
  assert.strictEqual((await A("intruso", { ...base, chave: "chave-int-3" })).s, 409, "vencida bloqueia pedidos novos");
  assert.strictEqual((await A("carla", { acao: "mensagem", id: md.id, texto: "Continuamos por aqui." })).s, 200, "conversas existentes seguem");
  assert.strictEqual((await A("carla", { acao: "proposta", id: md.id, proposta: propostaOk() })).s, 200);
  /* cancelou a renovação: benefício até o fim do período pago (planoAtivoAte no futuro) */
  store["orgs/carla-org/meta/info"].planoAtivoAte = somaDias(3);
  assert.strictEqual((await P("carla")).estado, "publicado", "reativação volta ao estado escolhido sem nova publicação");
  store["orgs/carla-org/meta/info"] = { plano: "gratis" }; // estorno já tratado pelo webhook existente
  assert.strictEqual((await P("carla")).estado, "indisponivel_assinatura");

  /* encerramentos */
  store["orgs/carla-org/meta/info"] = { plano: "essencial", planoAtivoAte: somaDias(30) };
  assert.strictEqual((await A("carla", { acao: "encerrar", id: md.id })).s, 200);
  assert.strictEqual(store["hubPedidos/" + md.id].estado, "encerrado_sem_acordo");
  assert.strictEqual((await A("carla", { acao: "recusar", id: sd2.id, motivo: "Sem horário" })).s, 200);
  assert.strictEqual(store["hubPedidos/" + sd2.id].estado, "recusado");
  assert.strictEqual((await A("carla", { acao: "cancelar", id: idm })).s, 200, "profissional cancela combinado");
  assert.strictEqual(store["hubPedidos/" + idm].estado, "cancelado");
  const nv = await A("ana", { ...base, chave: "chave-ana-9" });
  assert.strictEqual(nv.s, 200, "depois de concluído, pode pedir de novo");
  assert.strictEqual((await A("ana", { acao: "cancelar", id: nv.id })).s, 200);
  assert.strictEqual((await A("ana", { acao: "lerNotificacoes" })).s, 200);
  assert.strictEqual((await A("ana")).avisos.naoLidos, 0);
  assert.ok(H.ESTADOS_PEDIDO.aguardando_resposta && Object.keys(H.ESTADOS_PEDIDO).length === 9);
  console.log("check-hub: ok");
})().catch((e) => { console.error(e); process.exit(1); });
