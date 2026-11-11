/* QuadraLab Scout: servidor da conta (scout-app.js) com Firestore e login de mentira.
   Login obrigatório, perfil, atletas, jogos na nuvem (o mais novo vence, apagados não voltam), limites, link ao vivo na página da família
   (só primeiro nome e números; adversário e anotações nunca vão) e isolamento entre contas. Rode: node tests/check-scout-app-servidor.js */
const path = require("path"), assert = require("assert");
const M = require("../player/scout-motor.js");
const D = require("../scout-app/dados.js");
const fx = path.join(__dirname, "../netlify/functions/");

const store = {};
const J = (v) => JSON.parse(JSON.stringify(v));
const DEL = { __apagar: true };
function docRef(p) {
  return {
    id: p.split("/").pop(), path: p,
    async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), data: () => J(v) }; },
    async set(v) { store[p] = J(v); }, async delete() { delete store[p]; },
    async update(v) { if (store[p] === undefined) throw new Error("sem documento " + p); for (const k of Object.keys(v)) { if (v[k] === DEL) delete store[p][k]; else store[p][k] = J(v[k]); } },
    collection: (c) => colRef(p + "/" + c),
  };
}
function colRef(p, f = []) {
  const ids = () => Object.keys(store).filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/")).filter((k) => f.every(([c, v]) => store[k][c] === v));
  return { doc: (id) => docRef(p + "/" + id), where: (c, o, v) => colRef(p, f.concat([[c, v]])),
    async get() { const d = ids().map((k) => ({ id: k.split("/").pop(), data: () => J(store[k]) })); return { docs: d, size: d.length, forEach: (fn) => d.forEach(fn) }; } };
}
const firestore = () => ({ collection: (n) => colRef(n), runTransaction: async (fn) => fn({ get: (r) => r.get(), set: (r, v, o) => (o && o.merge ? (store[r.path] = { ...(store[r.path] || {}), ...J(v) }) : r.set(v)), update: (r, v) => r.update(v) }) });
firestore.FieldValue = { delete: () => DEL };
const contas = { "tk-ana": { uid: "u-ana", email: "ana@exemplo.com", name: "Ana Mãe" }, "tk-bia": { uid: "u-bia", email: "bia@exemplo.com" } };
const criados = {}, claims = {};
const admin = { firestore, auth: () => ({
  verifyIdToken: async (t) => { if (!contas[t]) throw new Error("token"); return contas[t]; },
  createUser: async (u) => { if (Object.values(criados).some((x) => x.email === u.email) || u.email === "ana@exemplo.com") { const e = new Error("existe"); e.code = "auth/email-already-exists"; throw e; } const uid = "u-novo" + Object.keys(criados).length; criados[uid] = u; return { uid }; },
  setCustomUserClaims: async (uid, c) => { claims[uid] = c; } }) };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "x", filename: "x", loaded: true, exports: { admin, app: () => {} } };
const { handler } = require(fx + "scout-app.js");
const chama = async (tk, corpo, metodo) => {
  const r = await handler({ httpMethod: metodo || (corpo ? "POST" : "GET"), headers: tk ? { authorization: "Bearer " + tk } : {}, body: corpo ? JSON.stringify(corpo) : "" });
  return { s: r.statusCode, ...JSON.parse(r.body) };
};

(async () => {
  /* login obrigatório */
  assert.strictEqual((await chama(null)).s, 401);
  assert.strictEqual((await chama("tk-falso")).s, 401);
  let r = await chama("tk-ana");
  assert.strictEqual(r.s, 200); assert.strictEqual(r.conta.nome, "Ana Mãe"); assert.strictEqual(r.conta.plano, "gratis"); assert.deepStrictEqual(r.jogos, []);
  assert.ok(store["scoutAppContas/u-ana"], "conta criada no primeiro acesso");

  /* perfil */
  assert.strictEqual((await chama("tk-ana", { acao: "perfil", nome: "", papel: "responsavel" })).s, 400);
  r = await chama("tk-ana", { acao: "perfil", nome: "Ana Souza" });
  assert.strictEqual(r.conta.nome, "Ana Souza", "acompanhamento livre: só o nome, sem papel");

  /* atletas e um jogo feito no app (dados.js + motor) */
  const st = D.normalizar(null), lucas = D.addAtleta(st, "Lucas Souza").atleta;
  const j = D.novoJogo(st, { atletaId: lucas.id, torneio: "Copa Sul", adversario: "Fulano Secreto", cfg: { formato: "4games" } }).jogo;
  for (let i = 0; i < 10; i++) D.marcarPonto(M, j, { fim: "winner_nos", nos: true, bola: "1-4", golpe: "forehand" });
  j.observacaoFinal = "ANOTACAO-PRIVADA"; j.mental.antes = { conf: 4, foco: 9 };
  assert.strictEqual((await chama("tk-ana", { acao: "salvarJogos", jogos: [j] })).s, 400, "atleta ainda não está na conta");
  r = await chama("tk-ana", { acao: "atletas", atletas: st.atletas.concat([{ id: "x", nome: "inválido" }]) });
  assert.deepStrictEqual(r.atletas.map((a) => a.nome), ["Lucas Souza"], "id inválido fica de fora");
  r = await chama("tk-ana", { acao: "salvarJogos", jogos: [j] });
  assert.deepStrictEqual(r.salvos, [j.id]);
  const guardado = JSON.parse(store["scoutAppContas/u-ana/jogos/" + j.id].dados);
  assert.strictEqual(guardado.pontos.length, 10); assert.strictEqual(guardado.adversario, "Fulano Secreto", "adversário fica na conta da pessoa");
  assert.deepStrictEqual(guardado.mental.antes, { conf: 4 }, "nota fora de 1 a 5 sai");

  /* o mais novo vence: um aparelho com versão velha não sobrescreve */
  const velho = J(j); velho.atualizadoEm = "2020-01-01T00:00:00.000Z"; velho.pontos = [];
  r = await chama("tk-ana", { acao: "salvarJogos", jogos: [velho] });
  assert.deepStrictEqual(r.antigos, [j.id]); assert.strictEqual(JSON.parse(store["scoutAppContas/u-ana/jogos/" + j.id].dados).pontos.length, 10);
  /* índice e baixar */
  r = await chama("tk-ana");
  assert.deepStrictEqual(r.jogos, [{ id: j.id, atletaId: lucas.id, atualizadoEm: j.atualizadoEm }]);
  r = await chama("tk-ana", { acao: "baixar", ids: [j.id, "jnaoexiste1", "../x"] });
  assert.strictEqual(r.jogos.length, 1); assert.strictEqual(r.jogos[0].pontos[0].golpe, "forehand");
  /* lote e campos inválidos */
  assert.strictEqual((await chama("tk-ana", { acao: "salvarJogos", jogos: [] })).s, 400);
  assert.strictEqual((await chama("tk-ana", { acao: "salvarJogos", jogos: new Array(11).fill(j) })).s, 400);
  assert.strictEqual((await chama("tk-ana", { acao: "salvarJogos", jogos: [{ ...j, id: "../../outro" }] })).s, 400);
  assert.strictEqual((await chama("tk-ana", { acao: "salvarJogos", jogos: [{ ...j, atualizadoEm: "ontem" }] })).s, 400);

  /* link ao vivo: página da família só com primeiro nome e números */
  r = await chama("tk-ana", { acao: "aoVivo", jogoId: "jnaoexiste1", resumo: {} });
  assert.strictEqual(r.s, 404, "jogo precisa estar na conta");
  const resumo = D.resumo(M, st, j);
  r = await chama("tk-ana", { acao: "aoVivo", jogoId: j.id, resumo: { ...resumo, adversario: "Fulano Secreto" } });
  assert.strictEqual(r.s, 200); assert.ok(/^[a-f0-9]{32}$/.test(r.token));
  const tok = r.token, av = store["scoutsAoVivo/" + tok];
  assert.strictEqual(av.orgId, "app:u-ana"); assert.strictEqual(store["scoutAppContas/u-ana/jogos/" + j.id].aoVivo.token, tok);
  const pub = JSON.parse(av.publico);
  assert.strictEqual(pub.atleta, "Lucas"); assert.strictEqual(pub.n, 10); assert.strictEqual(pub.aoVivo, true);
  assert.ok(!av.publico.includes("Fulano") && !av.publico.includes("Souza"), "nem adversário nem sobrenome");
  /* a página da família lê pelo mesmo endpoint de sempre */
  require.cache[require.resolve(fx + "_scout-copias.js")] = { id: "y", filename: "y", loaded: true, exports: { vinculosDoTreinador: async () => new Map(), gravarCopia: async () => {}, idAoVivo: (t) => t, academiaComCompeticao: async () => false, ERRO_PLANO_COMPETICAO: "" } };
  const familia = require(fx + "scout-ao-vivo.js").handler;
  const lida = JSON.parse((await familia({ httpMethod: "GET", queryStringParameters: { t: tok, v: "0" }, headers: {} })).body);
  assert.strictEqual(lida.publico.atleta, "Lucas"); assert.strictEqual(lida.publico.n, 10);
  /* atualizar mantém o mesmo link; fim encurta a validade */
  r = await chama("tk-ana", { acao: "aoVivo", jogoId: j.id, resumo });
  assert.strictEqual(r.token, tok); assert.strictEqual(store["scoutsAoVivo/" + tok].versao, 2);
  r = await chama("tk-ana", { acao: "aoVivo", jogoId: j.id, resumo, fim: true });
  assert.strictEqual(r.token, tok); assert.ok(Date.parse(r.expiraEm) <= Date.now() + 2 * 3600 * 1000 + 1000, "2 horas depois do fim");
  assert.strictEqual(JSON.parse(store["scoutsAoVivo/" + tok].publico).aoVivo, false);

  /* outra conta não vê nem mexe */
  r = await chama("tk-bia"); assert.deepStrictEqual(r.jogos, []); assert.strictEqual(r.conta.nome, "");
  r = await chama("tk-bia", { acao: "baixar", ids: [j.id] }); assert.deepStrictEqual(r.jogos, []);
  r = await chama("tk-bia", { acao: "aoVivo", jogoId: j.id, resumo }); assert.strictEqual(r.s, 404);
  r = await chama("tk-bia", { acao: "apagarJogo", id: j.id }); assert.strictEqual(r.s, 200);
  assert.ok(store["scoutAppContas/u-ana/jogos/" + j.id], "apagar na conta da Bia não toca no jogo da Ana");

  /* limite de 3 links ao vivo */
  const extra = [];
  for (let i = 0; i < 3; i++) { const x = D.novoJogo(st, { atletaId: lucas.id, cfg: { formato: "1set" } }).jogo; D.marcarPonto(M, x, { fim: "winner_nos", nos: true, bola: "1-4" }); extra.push(x); }
  await chama("tk-ana", { acao: "salvarJogos", jogos: extra });
  assert.strictEqual((await chama("tk-ana", { acao: "aoVivo", jogoId: extra[0].id, resumo: D.resumo(M, st, extra[0]) })).s, 200);
  assert.strictEqual((await chama("tk-ana", { acao: "aoVivo", jogoId: extra[1].id, resumo: D.resumo(M, st, extra[1]) })).s, 200);
  assert.strictEqual((await chama("tk-ana", { acao: "aoVivo", jogoId: extra[2].id, resumo: D.resumo(M, st, extra[2]) })).s, 409, "3º link aberto ao mesmo tempo (o 1º jogo ainda vale 2 h)");
  r = await chama("tk-ana", { acao: "encerrarAoVivo", jogoId: extra[0].id }); assert.strictEqual(r.ok, true);
  assert.strictEqual((await chama("tk-ana", { acao: "aoVivo", jogoId: extra[2].id, resumo: D.resumo(M, st, extra[2]) })).s, 200, "encerrar libera um link");

  /* apagar: tira o jogo, encerra o link e não deixa voltar de outro aparelho */
  r = await chama("tk-ana", { acao: "apagarJogo", id: j.id }); assert.strictEqual(r.ok, true);
  assert.ok(!store["scoutAppContas/u-ana/jogos/" + j.id] && !store["scoutsAoVivo/" + tok], "jogo e link apagados");
  r = await chama("tk-ana"); assert.ok(r.apagados.some((x) => x.id === j.id));
  const deVolta = J(j); deVolta.atualizadoEm = new Date(Date.now() + 60000).toISOString();
  r = await chama("tk-ana", { acao: "salvarJogos", jogos: [deVolta] }); assert.deepStrictEqual(r.antigos, [j.id], "jogo apagado não volta");

  assert.strictEqual((await chama("tk-ana", { acao: "outra" })).s, 400);
  assert.strictEqual((await chama("tk-ana", null, "PUT")).s, 405);
  /* análise de movimento: por atleta, 1 de cada golpe no grátis, acesso completo sem limite */
  process.env.PLAYER_EMAILS_FULL = "bia@exemplo.com";
  const mov = require(fx + "scout-app-movimento.js").handler;
  const mv = async (tk, corpo, q) => { const x = await mov({ httpMethod: corpo ? "POST" : "GET", headers: { authorization: "Bearer " + tk }, body: corpo ? JSON.stringify(corpo) : "", queryStringParameters: q || {} }); return { s: x.statusCode, ...JSON.parse(x.body) }; };
  const resumoMv = (id, golpe) => ({ id, golpe, criadoEm: "2026-11-10T12:00:00.000Z", dom: "D", itens: [{ n: "Preparação", s: "ok", v: 90, u: "°", r: "80–100" }], res: { ok: 1, atencao: 0, nao: 0 }, texto: "Bom golpe", prio: [] });
  assert.strictEqual((await mov({ httpMethod: "GET", headers: {}, queryStringParameters: {} })).statusCode, 401);
  r = await mv("tk-ana", null, { atleta: lucas.id }); assert.strictEqual(r.s, 200); assert.deepStrictEqual(r.analises, []); assert.strictEqual(r.cota.plano, "free");
  assert.strictEqual((await mv("tk-ana", null, { atleta: "aoutroatleta1" })).s, 404, "atleta de fora da conta");
  assert.strictEqual((await mv("tk-ana", { acao: "salvar", atletaId: "aoutroatleta1", resumo: resumoMv("mvabc12345", "forehand") })).s, 400);
  r = await mv("tk-ana", { acao: "salvar", atletaId: lucas.id, resumo: resumoMv("mvabc12345", "forehand") }); assert.strictEqual(r.s, 200); assert.strictEqual(r.cota.porGolpe.forehand.liberado, false);
  assert.strictEqual((await mv("tk-ana", { acao: "salvar", atletaId: lucas.id, resumo: resumoMv("mvabc12345", "forehand") })).s, 200, "refazer a mesma análise não conta de novo");
  r = await mv("tk-ana", { acao: "salvar", atletaId: lucas.id, resumo: resumoMv("mvdef67890", "forehand") });
  assert.strictEqual(r.s, 403); assert.ok(/Scout Plus/.test(r.erro), r.erro);
  r = await mv("tk-ana", { acao: "relatorio", id: "mvabc12345", relatorio: JSON.stringify({ id: "mvabc12345", resultado: { ok: 1 } }) }); assert.strictEqual(r.s, 200);
  r = await mv("tk-ana", null, { id: "mvabc12345" }); assert.strictEqual(r.relatorio.id, "mvabc12345");
  r = await mv("tk-ana", null, { atleta: lucas.id }); assert.deepStrictEqual(r.analises.map((x) => x.id), ["mvabc12345"]);
  assert.strictEqual((await mv("tk-ana", { acao: "relatorio", id: "mvnaoexiste1", relatorio: "{}" })).s, 404);
  r = await mv("tk-ana", { acao: "remover", id: "mvabc12345" }); assert.strictEqual(r.ok, true);
  r = await mv("tk-ana", { acao: "salvar", atletaId: lucas.id, resumo: resumoMv("mvghi24680", "forehand") }); assert.strictEqual(r.s, 403, "remover não devolve o uso do grátis");
  /* outra conta (com acesso completo) não vê as análises da Ana e não tem limite */
  await chama("tk-bia", { acao: "atletas", atletas: [{ id: "abiaatleta1", nome: "Duda" }] });
  r = await mv("tk-bia", null, { atleta: lucas.id }); assert.strictEqual(r.s, 404);
  assert.strictEqual((await mv("tk-bia", null, { id: "mvabc12345" })).s, 404);
  for (const id of ["mvbia000001", "mvbia000002"]) assert.strictEqual((await mv("tk-bia", { acao: "salvar", atletaId: "abiaatleta1", resumo: resumoMv(id, "saque") })).s, 200, "acesso completo sem limite");
  r = await mv("tk-bia", null, { atleta: "abiaatleta1" }); assert.strictEqual(r.cota.plano, "pago"); assert.strictEqual(r.analises.length, 2);

  /* Plano (11/11/2026): no grátis até 3 atletas; conta que já tem Plus continua sem limite; Plus vencido volta ao grátis sem perder quem já estava */
  const contaAna = () => store["scoutAppContas/u-ana"];
  r = await chama("tk-ana"); assert.strictEqual(r.conta.plano, "gratis"); assert.strictEqual(r.conta.limites.atletas, 3);
  const doisAtletas = st.atletas.concat([{ id: "asegundo0001", nome: "Marina" }]), tresAtletas = doisAtletas.concat([{ id: "aterceiro001", nome: "Caio" }]);
  const quatroAtletas = tresAtletas.concat([{ id: "aquarto00001", nome: "Duda" }]), cincoAtletas = quatroAtletas.concat([{ id: "aquinto00001", nome: "Enzo" }]);
  r = await chama("tk-ana", { acao: "atletas", atletas: doisAtletas }); assert.strictEqual(r.s, 200, "grátis: segundo atleta");
  r = await chama("tk-ana", { acao: "atletas", atletas: tresAtletas }); assert.strictEqual(r.s, 200, "grátis: terceiro atleta");
  r = await chama("tk-ana", { acao: "atletas", atletas: quatroAtletas }); assert.strictEqual(r.s, 403, "grátis: o quarto não entra"); assert.ok(/até 3 atletas/.test(r.erro) && !/Plus/.test(r.erro), r.erro);
  const amanha = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10), ontem = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  contaAna().plano = "plus"; contaAna().plusAte = amanha;
  r = await chama("tk-ana"); assert.strictEqual(r.conta.plano, "plus"); assert.strictEqual(r.conta.plusAte, amanha); assert.strictEqual(r.conta.limites.atletas, 60);
  r = await chama("tk-ana", { acao: "atletas", atletas: cincoAtletas }); assert.strictEqual(r.s, 200, "quem já tem Plus: atletas além de 3");
  r = await mv("tk-ana", { acao: "salvar", atletaId: lucas.id, resumo: resumoMv("mvplus00001", "forehand") }); assert.strictEqual(r.s, 200, "Plus: análise sem limite");
  contaAna().plusAte = ontem;
  r = await chama("tk-ana"); assert.strictEqual(r.conta.plano, "gratis", "Plus vencido");
  r = await chama("tk-ana", { acao: "atletas", atletas: cincoAtletas }); assert.strictEqual(r.s, 200, "quem já estava na conta continua");
  r = await chama("tk-ana", { acao: "atletas", atletas: cincoAtletas.concat([{ id: "asexto000001", nome: "Fabi" }]) }); assert.strictEqual(r.s, 403, "acima do limite não acrescenta atleta");
  assert.strictEqual((await mv("tk-ana", { acao: "salvar", atletaId: lucas.id, resumo: resumoMv("mvplus00002", "forehand") })).s, 403, "Plus vencido: limite do grátis volta");

  /* tempo de partida: o servidor guarda início, fim e o ajuste em minutos, e descarta o que não faz sentido */
  {
    const R = require(fx + "_scout-app.js"), base = { id: "jtempo000001", atletaId: lucas.id, atualizadoEm: "2026-11-11T12:00:00.000Z", pontos: [] };
    let jt = R.jogo({ ...base, inicioEm: "2026-11-11T10:00:00.000Z", fimEm: "2026-11-11T11:12:00.000Z", duracaoMin: 70 }, null);
    assert.deepStrictEqual([jt.inicioEm, jt.fimEm, jt.duracaoMin], ["2026-11-11T10:00:00.000Z", "2026-11-11T11:12:00.000Z", 70]);
    jt = R.jogo({ ...base, inicioEm: "2026-11-11T10:00:00.000Z", fimEm: "2026-11-11T09:00:00.000Z", duracaoMin: 9999 }, null);
    assert.deepStrictEqual([jt.inicioEm, jt.fimEm, jt.duracaoMin], ["2026-11-11T10:00:00.000Z", undefined, undefined], "fim antes do início e duração absurda não entram");
    jt = R.jogo({ ...base, inicioEm: "ontem", fimEm: "2026-11-11T11:12:00.000Z" }, null);
    assert.deepStrictEqual([jt.inicioEm, jt.fimEm], [undefined, undefined], "jogo antigo, sem relógio, continua valendo");
  }
  r = await chama("tk-bia"); assert.strictEqual(r.conta.plano, "plus"); assert.strictEqual(r.conta.acessoCompleto, true); assert.strictEqual(r.conta.plusAte, null);

  /* criar conta (sem login) */
  const conta = require(fx + "scout-app-conta.js").handler;
  const cria = async (c) => { const x = await conta({ httpMethod: "POST", body: JSON.stringify(c) }); return { s: x.statusCode, ...JSON.parse(x.body) }; };
  assert.strictEqual((await cria({ nome: "", email: "caio@x.com", senha: "12345678" })).s, 400, "nome obrigatório");
  assert.strictEqual((await cria({ nome: "Caio", email: "caio", senha: "12345678" })).s, 400);
  assert.strictEqual((await cria({ nome: "Caio", email: "caio@x.com", senha: "123" })).s, 400);
  r = await cria({ nome: "Ana", email: "ana@exemplo.com", senha: "12345678" });
  assert.strictEqual(r.s, 409); assert.ok(/mesma senha/.test(r.erro), "conta do QuadraLab já existe: entrar com a mesma senha");
  r = await cria({ nome: "Caio Lima", email: "Caio@X.com", senha: "12345678" });
  assert.strictEqual(r.s, 200, "conta sem papel"); assert.deepStrictEqual(claims["u-novo0"], { tipo: "scout" });
  assert.strictEqual(store["scoutAppContas/u-novo0"].nome, "Caio Lima"); assert.strictEqual(store["scoutAppContas/u-novo0"].email, "caio@x.com");
  assert.strictEqual((await conta({ httpMethod: "GET" })).statusCode, 405);
  console.log("check-scout-app-servidor: ok");
})().catch((e) => { console.error(e); process.exit(1); });
