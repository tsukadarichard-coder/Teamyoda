/* Eventos no site do Team Yoda (netlify/functions/inscricao-torneio-evento.js, 19/11/2026), sobre um Firestore em memória:
   · GET: só o público (nada de nome, telefone ou valor), com site, faixa de idade, prazo e cartaz; evento fora do prazo some;
   · POST de evento para crianças: exige criança, nascimento e autorização; confere a idade na data do evento; lista de espera
     quando lota; guarda e-mail, já é aluno, observações e pagamento "pendente"; avisa a coordenação no celular;
   · cartaz: só a conta da academia envia; a imagem volta pelo ?img=. Rode: node tests/check-eventos-site.js */
const assert = require("assert"), path = require("path");
const fx = path.join(__dirname, "../../netlify/functions/");
const store = {}; const J = (v) => JSON.parse(JSON.stringify(v));
function docRef(p) { return { id: p.split("/").pop(), collection: (n) => colRef(p + "/" + n), async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), data: () => J(v) }; }, async set(v, o) { store[p] = o && o.merge ? { ...(store[p] || {}), ...J(v) } : J(v); }, async delete() { delete store[p]; } }; }
function colRef(p, f = []) {
  return { doc: (id) => docRef(p + "/" + id), where: (c, o, v) => colRef(p, f.concat([[c, o, v]])), limit: () => colRef(p, f),
    async get() { const ks = Object.keys(store).filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/")).filter((k) => f.every(([c, , v]) => store[k][c] === v));
      const d = ks.map((k) => ({ id: k.split("/").pop(), data: () => J(store[k]) })); return { docs: d, size: d.length, forEach: (g) => d.forEach(g) }; } };
}
const db = { collection: (n) => colRef(n), runTransaction: async (fn) => fn({ get: (r) => r.get(), set: (r, v) => { store[r.id === "mty:eventos:v1" ? "orgs/team-yoda/dados/mty:eventos:v1" : r.id] = J(v); } }) };
const admin = { firestore: () => db, auth: () => ({ verifyIdToken: async (t) => { if (t === "tk-coord") return { uid: "c1", orgId: "team-yoda", role: "coordenador" }; if (t === "tk-aluno") return { uid: "a1" }; throw new Error("x"); } }) };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };
const avisos = [];
require.cache[require.resolve(fx + "_push.js")] = { id: "p", filename: "p", loaded: true, exports: { avisar: async (a, filtro, aviso) => { avisos.push({ filtro, aviso }); } } };
const F = require(fx + "inscricao-torneio-evento.js");
const chamar = async (metodo, corpo, qs, tk) => { const r = await F.handler({ httpMethod: metodo, headers: tk ? { authorization: "Bearer " + tk } : {}, body: corpo ? JSON.stringify(corpo) : null, queryStringParameters: qs || {} }); let b; try { b = JSON.parse(r.body); } catch (e) { b = r.body; } return { status: r.statusCode, corpo: b, r }; };
const ano = new Date().getFullYear(), dataEv = ano + "-12-13", ontem = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
store["orgs/team-yoda/dados/mty:eventos:v1"] = { value: JSON.stringify([
  { id: "ev1", nome: "Camp de fim de ano", data: dataEv, horaInicio: "09:00", local: "Cooper Tênis", tipo: "clinica", descricao: "Tênis e brincadeiras", vagas: 2, ativo: true, site: true,
    publico: "Crianças de 8 a 12 anos", idadeMin: 8, idadeMax: 12, valor: 150, cartaz: "/x.jpg", custos: [{ id: "c", descricao: "Camisetas", valor: 300 }],
    opcoes: [{ id: "s1", nome: "1 semana", valor: 450 }, { id: "s2", nome: "2 semanas", valor: 800 }],
    convidados: [{ id: "i0", nomeContato: "Já Inscrito", telefoneContato: "11 90000-0000", status: "confirmado" }] },
  { id: "ev2", nome: "Encerrado", data: dataEv, ativo: true, site: true, inscricoesAte: ontem, convidados: [] },
  { id: "ev3", nome: "Social adulto", data: dataEv, ativo: true, convidados: [] },
]) };
const nasc = (idade) => (ano - idade) + "-06-01";
(async () => {
  /* GET público */
  let r = await chamar("GET", null, { org: "team-yoda" });
  assert.strictEqual(r.status, 200);
  const ids = r.corpo.eventos.map((e) => e.id);
  assert.deepStrictEqual(ids, ["ev1", "ev3"], "evento com inscrições vencidas sai da lista");
  const e1 = r.corpo.eventos[0];
  assert.deepStrictEqual([e1.site, e1.publico, e1.idadeMin, e1.idadeMax, e1.cartaz, e1.confirmados, e1.vagas], [true, "Crianças de 8 a 12 anos", 8, 12, "/x.jpg", 1, 2]);
  const txtGet = JSON.stringify(r.corpo);
  assert(!/Já Inscrito|90000|Camisetas|custos/.test(txtGet), "GET sem dados pessoais nem custos: " + txtGet);
  /* opções e valor aparecem para quem se inscreve (pedido de 19/11/2026) */
  assert.deepStrictEqual(e1.opcoes, [{ id: "s1", nome: "1 semana", valor: 450 }, { id: "s2", nome: "2 semanas", valor: 800 }]);

  /* POST: validações do evento de criança */
  const base = { org: "team-yoda", tipo: "evento", eventoId: "ev1", nomeContato: "Maria Souza", telefoneContato: "(11) 98888-7777", email: "maria@exemplo.com", jaAluno: "sim", observacoes: "Alergia a amendoim" };
  assert.strictEqual((await chamar("POST", { ...base })).status, 400, "sem criança");
  assert.strictEqual((await chamar("POST", { ...base, criancaNome: "Lia", criancaNascimento: nasc(10) })).status, 400, "sem autorização");
  r = await chamar("POST", { ...base, criancaNome: "Lia", criancaNascimento: nasc(6), autorizacao: true });
  assert.strictEqual(r.status, 400); assert(/8 a 12 anos/.test(r.corpo.erro), r.corpo.erro);
  assert.strictEqual((await chamar("POST", { ...base, email: "errado", criancaNome: "Lia", criancaNascimento: nasc(10), autorizacao: true })).status, 400, "e-mail ruim");
  r = await chamar("POST", { ...base, criancaNome: "Lia Souza", criancaNascimento: nasc(10), autorizacao: true });
  assert.strictEqual(r.status, 400, "sem escolher a opção"); assert(/opções de inscrição/.test(r.corpo.erro));
  assert.strictEqual((await chamar("POST", { ...base, opcaoId: "s9", criancaNome: "Lia Souza", criancaNascimento: nasc(10), autorizacao: true })).status, 400, "opção que não existe");
  r = await chamar("POST", { ...base, opcaoId: "s2", criancaNome: "Lia Souza", criancaNascimento: nasc(10), autorizacao: true });
  assert.deepStrictEqual([r.status, r.corpo.status], [200, "confirmado"]);
  let ev = JSON.parse(store["orgs/team-yoda/dados/mty:eventos:v1"].value)[0], c = ev.convidados[1];
  assert.deepStrictEqual([c.criancaNome, c.criancaNascimento, c.email, c.jaAluno, c.observacoes, c.status, c.origem, c.vistoPeloStaff, c.pagamento.status],
    ["Lia Souza", nasc(10), "maria@exemplo.com", "sim", "Alergia a amendoim", "confirmado", "cliente", false, "pendente"]);
  assert(c.autorizacaoEm && c.criancaIdade >= 9 && c.criancaIdade <= 10, "autorização com data e idade no evento");
  assert.deepStrictEqual([c.opcaoId, c.opcaoNome, c.valor], ["s2", "2 semanas", 800], "opção e valor guardados");
  assert.strictEqual(avisos.length, 1); assert.deepStrictEqual(avisos[0].filtro, { app: "treinador", orgId: "team-yoda", papel: "coordenador" });
  assert(/Camp de fim de ano/.test(avisos[0].aviso.titulo) && /Lia Souza/.test(avisos[0].aviso.corpo) && avisos[0].aviso.url === "/gestao?aba=eventos");
  /* lotou: a próxima vai para a lista de espera */
  r = await chamar("POST", { ...base, nomeContato: "João", opcaoId: "s1", criancaNome: "Theo", criancaNascimento: nasc(12), autorizacao: true });
  assert.deepStrictEqual([r.status, r.corpo.status], [200, "espera"]);
  assert(/lista de espera/.test(avisos[1].aviso.corpo));
  /* prazo vencido e evento sem faixa de idade (adulto) */
  assert.strictEqual((await chamar("POST", { ...base, eventoId: "ev2", criancaNome: "Lia", criancaNascimento: nasc(10), autorizacao: true })).status, 404, "fora do prazo");
  r = await chamar("POST", { org: "team-yoda", tipo: "evento", eventoId: "ev3", nomeContato: "Carlos", telefoneContato: "11 97777-6666" });
  assert.strictEqual(r.status, 200, "evento adulto continua só com nome e telefone");

  /* cartaz */
  const png = "data:image/png;base64," + Buffer.from("imagem-de-teste").toString("base64");
  assert.strictEqual((await chamar("POST", { acao: "imagem", dados: png })).status, 403, "sem conta");
  assert.strictEqual((await chamar("POST", { acao: "imagem", dados: png }, null, "tk-aluno")).status, 403, "conta sem academia");
  assert.strictEqual((await chamar("POST", { acao: "imagem", dados: "data:text/html;base64,AAAA" }, null, "tk-coord")).status, 400, "só imagem");
  r = await chamar("POST", { acao: "imagem", dados: png }, null, "tk-coord");
  assert.strictEqual(r.status, 200); const id = /img=([a-z0-9]{24})$/.exec(r.corpo.url)[1];
  r = await chamar("GET", null, { img: id });
  assert.strictEqual(r.status, 200); assert.strictEqual(r.r.headers["content-type"], "image/png"); assert.strictEqual(Buffer.from(r.r.body, "base64").toString(), "imagem-de-teste");
  assert.strictEqual((await chamar("GET", null, { img: "../x" })).status, 400);
  console.log("check-eventos-site: ok");
})().catch((e) => { console.error(e); process.exit(1); });
