/* Academia Digital Team Yoda (netlify/functions/digital.js) sobre um Firestore em memória:
   · visitante vê só a vitrine (sem vídeos); cria conta; sem acesso vê a vitrine;
   · aluno da unidade liga a conta pelo link do aluno e não paga (perde o acesso se sair da lista); limite de contas por aluno;
   · equipe entra direto; coordenação salva trilhas (link do YouTube vira o ID; link inválido é recusado), vê membros e dá cortesia;
   · assinatura ativa libera; vencida não; lista de espera; progresso das aulas. Rode: node tests/check-digital.js */
process.env.DIGITAL_SEM_CURSOS_MTY = "1"; /* os cursos MTY automáticos têm teste próprio (check-digital) */
const assert = require("assert"), path = require("path");
const fx = path.join(__dirname, "../../netlify/functions/");
const store = {}; const J = (v) => JSON.parse(JSON.stringify(v)); let seq = 0;
function docRef(p) { return { id: p.split("/").pop(), ref: null, collection: (n) => colRef(p + "/" + n), async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), data: () => J(v) }; }, async set(v, o) { store[p] = o && o.merge ? { ...(store[p] || {}), ...J(v) } : J(v); } }; }
function colRef(p, f = [], lim = 0) {
  return {
    doc: (id) => docRef(p + "/" + id), where: (c, o, v) => colRef(p, f.concat([[c, o, v]]), lim), limit: (n) => colRef(p, f, n),
    async get() {
      let ks = Object.keys(store).filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/"))
        .filter((k) => f.every(([c, o, v]) => (o === "array-contains" ? (store[k][c] || []).includes(v) : store[k][c] === v)));
      if (lim) ks = ks.slice(0, lim);
      const d = ks.map((k) => { const r = docRef(k); return { id: k.split("/").pop(), ref: r, data: () => J(store[k]) }; });
      return { docs: d, size: d.length, empty: !d.length, forEach: (g) => d.forEach(g) };
    },
  };
}
const usuarios = {}; let uidSeq = 0;
const tokens = { coord: { uid: "c1", orgId: "team-yoda", role: "coordenador", email: "coord@ty" }, prof: { uid: "p1", orgId: "39-ranch", role: "treinador", email: "prof@39" } };
const admin = {
  firestore: () => ({ collection: (n) => colRef(n) }),
  auth: () => ({
    verifyIdToken: async (t) => { if (tokens[t]) return tokens[t]; throw new Error("x"); },
    createUser: async ({ email, displayName }) => { if (Object.values(usuarios).includes(email)) { const e = new Error("exists"); e.code = "auth/email-already-exists"; throw e; } const uid = "u" + (++uidSeq); usuarios[uid] = email; tokens["tk-" + email] = { uid, email, name: displayName }; return { uid }; },
  }),
};
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };
const D = require(fx + "digital.js");
const chamar = async (metodo, corpo, tk, qs) => { const r = await D.handler({ httpMethod: metodo, headers: tk ? { authorization: "Bearer " + tk } : {}, body: corpo ? JSON.stringify(corpo) : null, queryStringParameters: qs || {} }); return { status: r.statusCode, ...JSON.parse(r.body) }; };
store["orgs/team-yoda/dados/mty:alunos:v2"] = { value: JSON.stringify([{ id: "a1", nome: "Ana Souza", linkToken: "tA" }]) };
store["orgs/39-ranch/dados/mty:alunos:v2"] = { value: JSON.stringify([{ id: "r1", nome: "Rui Costa", linkToken: "tR" }]) };

(async () => {
  /* YouTube */
  const I = D.interno;
  for (const u of ["https://youtu.be/dQw4w9WgXcQ", "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10", "https://youtube.com/shorts/dQw4w9WgXcQ", "https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"]) assert.strictEqual(I.idDoYoutube(u), "dQw4w9WgXcQ", u);
  assert.strictEqual(I.idDoYoutube("https://vimeo.com/1"), "");

  /* coordenação monta o conteúdo; professor que não coordena não mexe */
  const trilhas = [
    { titulo: "Forehand do zero", nivel: "iniciante", publicada: true, aulas: [{ titulo: "Empunhadura", youtube: "https://youtu.be/dQw4w9WgXcQ", exercicios: ["fb001", "XX"] }, { titulo: "Treino com parceiro", exercicios: ["FB003"] }] },
    { titulo: "Rascunho", publicada: false, aulas: [{ titulo: "Secreta", youtube: "dQw4w9WgXcQ" }] },
  ];
  assert.strictEqual((await chamar("POST", { acao: "salvarConteudo", trilhas }, "prof")).status, 403);
  assert.strictEqual((await chamar("POST", { acao: "salvarConteudo", trilhas: [{ titulo: "X", aulas: [{ titulo: "Ruim", youtube: "https://vimeo.com/1" }] }] }, "coord")).status, 400);
  let r = await chamar("POST", { acao: "salvarConteudo", trilhas, venda: { preco: "R$ 59,90/mês", checkoutUrl: "" } }, "coord");
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.trilhas[0].aulas[0].youtube, "dQw4w9WgXcQ");
  assert.deepStrictEqual(r.trilhas[0].aulas[0].exercicios, ["FB001"]);
  assert.strictEqual((await chamar("POST", { acao: "salvarConteudo", venda: { checkoutUrl: "http://x" } }, "coord")).status, 400, "link de pagamento só https");
  await chamar("POST", { acao: "salvarConteudo", trilhas, venda: { preco: "R$ 59,90/mês" } }, "coord");

  /* visitante: só a vitrine, sem vídeos e sem a trilha não publicada */
  r = await chamar("GET", null, null);
  assert.deepStrictEqual(r.trilhas.map((t) => [t.titulo, t.aulas, t.comVideo]), [["Forehand do zero", 2, 1]]);
  assert(!JSON.stringify(r).includes("dQw4w9WgXcQ"), "a vitrine não mostra o vídeo");
  assert.strictEqual(r.venda.preco, "R$ 59,90/mês");

  /* criar conta */
  assert.strictEqual((await chamar("POST", { acao: "criar", nome: "Bia", email: "bia@x.com", senha: "123" })).status, 400);
  assert.strictEqual((await chamar("POST", { acao: "criar", nome: "Bia", email: "bia@x.com", senha: "12345678" })).status, 200);
  assert.strictEqual((await chamar("POST", { acao: "criar", nome: "Bia", email: "bia@x.com", senha: "12345678" })).status, 409);
  r = await chamar("GET", null, "tk-bia@x.com");
  assert.strictEqual(r.acesso.tipo, "nenhum"); assert.strictEqual(r.conteudo, null); assert(r.vitrine && !JSON.stringify(r).includes("dQw4w9WgXcQ"));
  assert.strictEqual((await chamar("POST", { acao: "progresso", aulaId: "x", feito: true }, "tk-bia@x.com")).status, 403);

  /* aluno da unidade: liga pelo link do aluno e não paga */
  assert.strictEqual((await chamar("POST", { acao: "vincular", link: { org: "team-yoda", id: "a1", t: "errado" } }, "tk-bia@x.com")).status, 404);
  assert.strictEqual((await chamar("POST", { acao: "vincular", link: { org: "outra", id: "a1", t: "tA" } }, "tk-bia@x.com")).status, 400);
  r = await chamar("POST", { acao: "vincular", link: { org: "team-yoda", id: "a1", t: "tA" } }, "tk-bia@x.com");
  assert.strictEqual(r.acesso.tipo, "unidade"); assert.strictEqual(r.acesso.unidade, "Team Yoda · Cooper Tênis");
  r = await chamar("GET", null, "tk-bia@x.com");
  assert(r.presencial && r.presencial.temPlano === false && r.presencial.totalAulas === 0, "resumo do plano presencial para aluno da unidade");
  assert.strictEqual(r.conteudo.trilhas.length, 1, "só as publicadas"); assert.strictEqual(r.conteudo.trilhas[0].aulas[0].youtube, "dQw4w9WgXcQ");
  const aula = r.conteudo.trilhas[0].aulas[0].id;
  r = await chamar("POST", { acao: "progresso", aulaId: aula, feito: true }, "tk-bia@x.com");
  assert(r.progresso[aula]);
  assert((await chamar("GET", null, "tk-bia@x.com")).progresso[aula], "progresso guardado");
  /* limite de contas por aluno */
  for (const e of ["c2@x.com", "c3@x.com", "c4@x.com"]) await chamar("POST", { acao: "criar", nome: "Conta", email: e, senha: "12345678" });
  assert.strictEqual((await chamar("POST", { acao: "vincular", link: { org: "team-yoda", id: "a1", t: "tA" } }, "tk-c2@x.com")).status, 200);
  assert.strictEqual((await chamar("POST", { acao: "vincular", link: { org: "team-yoda", id: "a1", t: "tA" } }, "tk-c3@x.com")).status, 200);
  assert.strictEqual((await chamar("POST", { acao: "vincular", link: { org: "team-yoda", id: "a1", t: "tA" } }, "tk-c4@x.com")).status, 409, "no máximo 3 contas por aluno");
  /* 39 Ranch também */
  assert.strictEqual((await chamar("POST", { acao: "vincular", link: { org: "39-ranch", id: "r1", t: "tR" } }, "tk-c4@x.com")).acesso.unidade, "39 Ranch Tennis Club");
  /* saiu da unidade: perde o acesso grátis */
  store["orgs/team-yoda/dados/mty:alunos:v2"] = { value: JSON.stringify([]) };
  assert.strictEqual((await chamar("GET", null, "tk-bia@x.com")).acesso.tipo, "nenhum");

  /* equipe entra direto */
  r = await chamar("GET", null, "prof");
  assert.strictEqual(r.acesso.tipo, "equipe"); assert(r.conteudo.trilhas.length === 1); assert.strictEqual(r.coordenacao, false);
  assert.strictEqual((await chamar("GET", null, "coord")).coordenacao, true);

  /* assinatura e cortesia */
  store["digitalContas/u2"].assinatura = { status: "ativa", ate: "2099-01-01", origem: "eduzz" };
  store["digitalContas/u2"].vinculos = []; store["digitalContas/u2"].vinculoChaves = [];
  assert.strictEqual((await chamar("GET", null, "tk-c2@x.com")).acesso.tipo, "assinante");
  store["digitalContas/u2"].assinatura = { status: "ativa", ate: "2020-01-01" };
  assert.strictEqual((await chamar("GET", null, "tk-c2@x.com")).acesso.tipo, "nenhum", "assinatura vencida");
  assert.strictEqual((await chamar("POST", { acao: "cortesia", email: "c2@x.com", sim: true }, "prof")).status, 403);
  assert.strictEqual((await chamar("POST", { acao: "cortesia", email: "c2@x.com", sim: true }, "coord")).status, 200);
  assert.strictEqual((await chamar("GET", null, "tk-c2@x.com")).acesso.tipo, "cortesia");
  assert.strictEqual((await chamar("POST", { acao: "cortesia", email: "ninguem@x.com", sim: true }, "coord")).status, 404);
  r = await chamar("POST", { acao: "membros" }, "coord");
  assert(r.membros.length >= 4 && r.membros.some((m) => m.email === "c2@x.com" && m.acesso.tipo === "cortesia"));

  /* catálogo de exercícios: só com acesso, e igual ao EXERCICIOS do app (sem o campo de vídeo) */
  assert.strictEqual((await chamar("GET", null, "tk-bia@x.com", { catalogo: "1" })).status, 403);
  r = await chamar("GET", null, "tk-c2@x.com", { catalogo: "1" });
  const fs = require("fs"), linha = fs.readFileSync(path.join(__dirname, "../../mty/index.html"), "utf8").split("\n").find((l) => l.startsWith("const EXERCICIOS = "));
  const K = ["c", "n", "f", "e", "m", "g", "r", "p", "x", "i", "o"];
  const esperado = JSON.parse(linha.replace(/^const EXERCICIOS = /, "").replace(/;\s*$/, "")).map((e) => Object.fromEntries(K.filter((k) => e[k] != null && e[k] !== "").map((k) => [k, e[k]])));
  assert.deepStrictEqual(r.exercicios, esperado, "netlify/functions/_exercicios-digital.json fora de sincronia com EXERCICIOS de mty/index.html (gere de novo)");

  /* cursos: categoria e quiz (a resposta certa não vai para o aluno; o servidor confere) */
  assert.strictEqual((await chamar("POST", { acao: "salvarConteudo", trilhas: [{ titulo: "C", aulas: [{ titulo: "A", quiz: [{ p: "?", op: ["x"], c: 0 }] }] }] }, "coord")).status, 400, "pergunta com 1 opção é recusada");
  assert.strictEqual((await chamar("POST", { acao: "salvarConteudo", trilhas: [{ titulo: "C", aulas: [{ titulo: "A", quiz: [{ p: "?", op: ["x", "y"] }] }] }] }, "coord")).status, 400, "sem resposta certa é recusada");
  r = await chamar("POST", { acao: "salvarConteudo", trilhas: [{ id: "cm", titulo: "Mental", categoria: "mental", publicada: true, aulas: [{ id: "q1", titulo: "Rotina", quiz: [{ p: "Quanto tempo?", op: ["5 s", "20 s", "1 min"], c: 1 }, { p: "Respira?", op: ["Sim", "Não"], c: 0 }] }] }], venda: { preco: "R$ 59,90/mês" } }, "coord");
  assert.strictEqual(r.trilhas[0].categoria, "mental");
  r = await chamar("GET", null, "tk-c2@x.com");
  assert.strictEqual(r.conteudo.trilhas[0].aulas[0].quiz.length, 2);
  assert(r.conteudo.trilhas[0].aulas[0].quiz.every((q) => q.c === undefined), "a resposta certa não vai para o aluno");
  r = await chamar("POST", { acao: "quiz", aulaId: "q1", respostas: [1, 1] }, "tk-c2@x.com");
  assert.deepStrictEqual([r.acertos, r.total, r.certas], [1, 2, [true, false]]);
  r = await chamar("POST", { acao: "quiz", aulaId: "q1", respostas: [1, 0] }, "tk-c2@x.com");
  assert.strictEqual(r.acertos, 2);
  assert.strictEqual((await chamar("GET", null, "tk-c2@x.com")).quiz.q1.acertos, 2, "melhor resultado guardado");
  assert.strictEqual((await chamar("POST", { acao: "quiz", aulaId: "q1", respostas: [1, 0] }, "tk-bia@x.com")).status, 403, "sem acesso não responde quiz");

  /* treinos guiados: registro da sessão (minutos, exercícios, acertos) */
  assert.strictEqual((await chamar("POST", { acao: "sessao", sessaoId: "fundo", minutos: 0, itens: [] }, "tk-c2@x.com")).status, 400);
  assert.strictEqual((await chamar("POST", { acao: "sessao", sessaoId: "fundo", minutos: 30, itens: [{ c: "xx" }] }, "tk-c2@x.com")).status, 400);
  r = await chamar("POST", { acao: "sessao", sessaoId: "fundo", titulo: "Fundo", minutos: 32, itens: [{ c: "fb001", feito: true, acertos: 7, tentativas: 10 }, { c: "FB003", feito: false, acertos: 12, tentativas: 10 }] }, "tk-c2@x.com");
  assert.deepStrictEqual(r.sessoes[0].itens, [{ c: "FB001", feito: true, acertos: 7, tentativas: 10 }, { c: "FB003", feito: false }], "acertos acima das tentativas são descartados");
  assert.strictEqual((await chamar("GET", null, "tk-c2@x.com")).sessoes.length, 1);
  r = await chamar("POST", { acao: "sessao", sessaoId: "correcao-mv9", analiseId: "mv9", titulo: "Correção do forehand", minutos: 25, itens: [{ t: "Flexão de joelhos no giro", feito: true }, { c: "FB001", feito: true }] }, "tk-c2@x.com");
  assert.deepStrictEqual([r.sessoes[1].analiseId, r.sessoes[1].itens[0]], ["mv9", { t: "Flexão de joelhos no giro", feito: true }], "etapas de correção (sem código do catálogo) e a análise de origem");
  assert.strictEqual((await chamar("POST", { acao: "sessao", sessaoId: "fundo", minutos: 30, itens: [] }, "tk-bia@x.com")).status, 403);

  /* análise de movimento: resumo, relatório e trecho guardados na conta de quem analisou */
  assert.strictEqual((await chamar("POST", { acao: "movRelatorio", id: "mv1", relatorio: "{}" }, "tk-c2@x.com")).status, 404, "relatório só depois do resumo");
  r = await chamar("POST", { acao: "movSalvar", resumo: { id: "mv1", golpe: "forehand", criadoEm: "2026-11-06T10:00:00Z", nota: 7 } }, "tk-c2@x.com");
  assert.strictEqual(r.movimentos.length, 1);
  assert((await chamar("POST", { acao: "movRelatorio", id: "mv1", relatorio: JSON.stringify({ id: "mv1", fases: [1, 2] }) }, "tk-c2@x.com")).ok);
  assert((await chamar("POST", { acao: "movClip", id: "mv1", clip: "[1,2,3]" }, "tk-c2@x.com")).ok);
  assert.strictEqual(JSON.parse((await chamar("GET", null, "tk-c2@x.com", { movRel: "mv1" })).relatorio).fases.length, 2);
  assert.strictEqual((await chamar("GET", null, "tk-c2@x.com", { movClip: "mv1" })).clip, "[1,2,3]");
  assert.strictEqual((await chamar("GET", null, "tk-c4@x.com", { movRel: "mv1" })).status, 404, "o relatório de um não abre para outro");
  assert.strictEqual((await chamar("GET", null, "tk-c2@x.com")).movimentos[0].golpe, "forehand");
  assert.strictEqual((await chamar("POST", { acao: "movSalvar", resumo: { id: "x".repeat(10), dados: "y".repeat(50000) } }, "tk-c2@x.com")).status, 400, "resumo grande demais");
  r = await chamar("POST", { acao: "movRemover", id: "mv1" }, "tk-c2@x.com");
  assert.strictEqual(r.movimentos.length, 0);
  assert.strictEqual((await chamar("POST", { acao: "movSalvar", resumo: { id: "mv2" } }, "tk-bia@x.com")).status, 403);

  /* lista de espera */
  assert.strictEqual((await chamar("POST", { acao: "interesse", email: "quero@x.com", nome: "Quero" })).status, 200);
  assert(store["digitalInteresses/quero@x.com"]);
  /* cursos MTY: entram uma vez, já publicados e válidos; apagados pela coordenação, não voltam */
  delete process.env.DIGITAL_SEM_CURSOS_MTY;
  const { CURSOS, VERSAO } = require(fx + "_cursos-mty.js");
  r = await chamar("GET", null, "tk-c2@x.com");
  const ids = r.conteudo.trilhas.map((t) => t.id);
  assert(["cmty-tecnica", "cmty-tatica", "cmty-mental"].every((id) => ids.includes(id)), "os 3 cursos MTY aparecem publicados");
  assert.strictEqual(store["digitalConteudo/academia"].cursosMty, VERSAO);
  const tec = r.conteudo.trilhas.find((t) => t.id === "cmty-tecnica");
  assert(tec.aulas.length === 12 && tec.aulas.every((a) => a.quiz.length === 2 && a.quiz.every((q) => q.c === undefined)), "técnica: 12 aulas com quiz sem a resposta");
  assert(!/o treinador|o professor/i.test(CURSOS.map((c) => c.aulas.map((a) => a.descricao).join(" ")).join(" ")), "texto fala com o aluno");
  r = await chamar("POST", { acao: "quiz", aulaId: "cmty-tec-01", respostas: [1, 1] }, "tk-c2@x.com");
  assert.strictEqual(r.acertos, 2, "quiz dos cursos MTY conferido no servidor");
  const cc = await chamar("POST", { acao: "conteudoCompleto" }, "coord");
  await chamar("POST", { acao: "salvarConteudo", trilhas: cc.trilhas.filter((t) => t.id !== "cmty-mental"), venda: cc.venda }, "coord");
  r = await chamar("GET", null, "tk-c2@x.com");
  assert(!r.conteudo.trilhas.some((t) => t.id === "cmty-mental"), "curso apagado pela coordenação não volta");
  assert.strictEqual(r.conteudo.trilhas.filter((t) => t.id === "cmty-tecnica").length, 1, "sem duplicar");
  /* ilustrações: toda aula MTY tem, os arquivos existem e estão em dia com o gerador */
  const aulasMty = CURSOS.flatMap((c) => c.aulas);
  assert(aulasMty.filter((a) => a.imagens.length).length >= 24, "quase todas as aulas MTY com ilustração");
  aulasMty.forEach((a) => { assert(a.imagens.length <= 3); a.imagens.forEach((im) => assert(fs.existsSync(path.join(__dirname, "../../mty", im)), "arquivo existe: " + im)); });
  assert.strictEqual(require("child_process").spawnSync(process.execPath, [path.join(__dirname, "gerar-ilustracoes-cursos.js"), "--conferir"]).status, 0, "ilustrações em dia com o gerador");
  assert.deepStrictEqual(r.conteudo.trilhas.find((t) => t.id === "cmty-tecnica").aulas[0].imagens, ["assets/foto-forehand.jpg"], "aluno recebe as ilustrações");
  /* só caminhos do próprio site, até 3 */
  const lc = require(fx + "digital.js").interno.limparConteudo;
  assert.deepStrictEqual(lc({ trilhas: [{ id: "t1", titulo: "T", aulas: [{ id: "a1", titulo: "A", imagens: ["https://mal.com/x.svg", "assets/cursos/../x.svg", "assets/foto-x.png", "assets/foto-forehand.jpg", "assets/cursos/a.svg", "assets/cursos/b.svg", "assets/cursos/c.svg"] }] }] }).trilhas[0].aulas[0].imagens,
    ["assets/foto-forehand.jpg", "assets/cursos/a.svg", "assets/cursos/b.svg"]);
  /* quem já tinha a v1: as aulas MTY sem ilustração ganham as da v2; a que a coordenação trocou fica como está */
  const doc = store["digitalConteudo/academia"];
  doc.cursosMty = "v1";
  doc.trilhas = doc.trilhas.map((t) => (t.id !== "cmty-tecnica" ? t : { ...t, aulas: t.aulas.map((a) => ({ ...a, imagens: a.id === "cmty-tec-02" ? ["assets/cursos/apoios.svg"] : [] })) }));
  r = await chamar("GET", null, "tk-c2@x.com");
  const tec2 = r.conteudo.trilhas.find((t) => t.id === "cmty-tecnica");
  assert.deepStrictEqual(tec2.aulas.find((a) => a.id === "cmty-tec-05").imagens, ["assets/foto-saque.jpg"], "v1 → v2 completa as ilustrações");
  assert.deepStrictEqual(tec2.aulas.find((a) => a.id === "cmty-tec-02").imagens, ["assets/foto-sequencia-forehand.jpg", "assets/cursos/apoios.svg"], "a escolha da coordenação fica; a foto nova da v3 entra por cima");
  assert(!r.conteudo.trilhas.some((t) => t.id === "cmty-mental"), "v2 não traz de volta curso apagado");
  assert.strictEqual(store["digitalConteudo/academia"].cursosMty, VERSAO);
  /* quem já tinha a v2: as fotos novas da v3 entram por cima das imagens da aula, uma vez só; tiradas pela coordenação, não voltam */
  const doc2 = store["digitalConteudo/academia"];
  doc2.cursosMty = "v2";
  doc2.trilhas = doc2.trilhas.map((t) => (t.id !== "cmty-tecnica" ? t : { ...t, aulas: t.aulas.map((a) => (a.id === "cmty-tec-09" ? { ...a, imagens: ["assets/cursos/tat-margem.svg"] } : a.id === "cmty-tec-03" ? { ...a, imagens: [] } : a)) }));
  r = await chamar("GET", null, "tk-c2@x.com");
  const tec3 = r.conteudo.trilhas.find((t) => t.id === "cmty-tecnica");
  assert.deepStrictEqual(tec3.aulas.find((a) => a.id === "cmty-tec-09").imagens, ["assets/foto-smash.jpg", "assets/cursos/tat-margem.svg"], "v2 → v3: foto nova por cima");
  assert.deepStrictEqual(tec3.aulas.find((a) => a.id === "cmty-tec-03").imagens, ["assets/foto-sequencia-backhand2-ty.jpg", "assets/foto-sequencia-backhand2.jpg"]);
  const cc4 = await chamar("POST", { acao: "conteudoCompleto" }, "coord");
  cc4.trilhas.find((t) => t.id === "cmty-tecnica").aulas.find((a) => a.id === "cmty-tec-09").imagens = ["assets/cursos/tat-margem.svg"];
  await chamar("POST", { acao: "salvarConteudo", trilhas: cc4.trilhas, venda: cc4.venda }, "coord");
  r = await chamar("GET", null, "tk-c2@x.com");
  assert.deepStrictEqual(r.conteudo.trilhas.find((t) => t.id === "cmty-tecnica").aulas.find((a) => a.id === "cmty-tec-09").imagens, ["assets/cursos/tat-margem.svg"], "a foto tirada não volta");
  /* salvar pela coordenação mantém as ilustrações */
  const cc2 = await chamar("POST", { acao: "conteudoCompleto" }, "coord");
  await chamar("POST", { acao: "salvarConteudo", trilhas: cc2.trilhas, venda: cc2.venda }, "coord");
  assert.deepStrictEqual(store["digitalConteudo/academia"].trilhas.find((t) => t.id === "cmty-tecnica").aulas.find((a) => a.id === "cmty-tec-05").imagens, ["assets/foto-saque.jpg"]);
  /* aula passo a passo: toda aula MTY tem etapas, com as imagens existentes; quem já tinha a v3 recebe as etapas nas aulas sem nenhuma */
  aulasMty.forEach((a) => {
    assert(a.etapas.length >= 2, "etapas: " + a.id);
    assert.deepStrictEqual(lc({ trilhas: [{ id: "t1", titulo: "T", aulas: [{ id: "a1", titulo: "A", etapas: a.etapas }] }] }).trilhas[0].aulas[0].etapas, a.etapas, "etapas MTY passam inteiras pelo saneamento: " + a.id);
    a.etapas.forEach((e) => { if (e.img) assert(fs.existsSync(path.join(__dirname, "../../mty", e.img)), "arquivo da etapa existe: " + e.img); });
  });
  assert.deepStrictEqual(CURSOS[0].aulas.find((a) => a.id === "cmty-tec-03").etapas.map((e) => e.img), [1, 2, 3, 4, 5, 6].map((k) => "assets/cursos/fases/bh2-" + k + ".jpg"), "backhand de duas mãos: as seis fases reais");
  const etl = lc({ trilhas: [{ id: "t1", titulo: "T", aulas: [{ id: "a1", titulo: "A", etapas: [
    { titulo: "Ok", img: "https://mal.com/x.jpg", credito: "c", texto: "x".repeat(900), pontos: ["a", "", "b", "c", "d", "e", "f"], erro: { sinal: "s", correcao: "c" } },
    { titulo: "Foto", img: "assets/cursos/fases/saque-1.jpg", credito: "Crédito", texto: "t", erros: [{ sinal: "a", correcao: "b" }, { sinal: "", correcao: "x" }] },
    { titulo: "", texto: "sem título" }, { titulo: "Vazia" }, "lixo"].concat(Array(20).fill({ titulo: "Mais", texto: "m" })) }] }] }).trilhas[0].aulas[0].etapas;
  assert.strictEqual(etl.length, 9, "sem título/vazias saem; no máximo 12 antes de filtrar");
  assert.strictEqual(etl[0].img, undefined, "imagem de fora do site sai (e o crédito com ela)");
  assert.strictEqual(etl[0].credito, undefined);
  assert.strictEqual(etl[0].texto.length, 800);
  assert.deepStrictEqual(etl[0].pontos, ["a", "b", "c", "d", "e"]);
  assert.deepStrictEqual(etl[1], { titulo: "Foto", texto: "t", img: "assets/cursos/fases/saque-1.jpg", credito: "Crédito", erros: [{ sinal: "a", correcao: "b" }] });
  const doc3 = store["digitalConteudo/academia"];
  doc3.cursosMty = "v3";
  doc3.trilhas = doc3.trilhas.map((t) => (t.id !== "cmty-tecnica" ? t : { ...t, aulas: t.aulas.map((a) => (a.id === "cmty-tec-02" ? { ...a, etapas: [{ titulo: "Da coordenação", texto: "x" }] } : { ...a, etapas: undefined })) }));
  r = await chamar("GET", null, "tk-c2@x.com");
  const tec4 = r.conteudo.trilhas.find((t) => t.id === "cmty-tecnica");
  assert.strictEqual(tec4.aulas.find((a) => a.id === "cmty-tec-05").etapas.length, 6, "v3 → v4: saque passo a passo");
  assert.strictEqual(tec4.aulas.find((a) => a.id === "cmty-tec-05").etapas[0].img, "assets/cursos/fases/saque-1.jpg");
  assert.deepStrictEqual(tec4.aulas.find((a) => a.id === "cmty-tec-02").etapas.map((e) => e.titulo), ["Da coordenação"], "etapas editadas pela coordenação ficam");
  assert.strictEqual(store["digitalConteudo/academia"].cursosMty, VERSAO);
  const cc5 = await chamar("POST", { acao: "conteudoCompleto" }, "coord");
  cc5.trilhas.find((t) => t.id === "cmty-tecnica").aulas.find((a) => a.id === "cmty-tec-05").etapas[0].titulo = "Posição inicial (editada)";
  await chamar("POST", { acao: "salvarConteudo", trilhas: cc5.trilhas, venda: cc5.venda }, "coord");
  r = await chamar("GET", null, "tk-c2@x.com");
  assert.strictEqual(r.conteudo.trilhas.find((t) => t.id === "cmty-tecnica").aulas.find((a) => a.id === "cmty-tec-05").etapas[0].titulo, "Posição inicial (editada)", "a coordenação edita as etapas");
  /* sequência das fases vinda de uma análise: só a coordenação, com autorização; a aula aponta para img:{id}; GET ?img serve o JPEG */
  const jpg = "data:image/jpeg;base64," + Buffer.from("\xff\xd8\xff\xe0fake-jpeg", "latin1").toString("base64");
  const pedido = { acao: "imagemCurso", trilhaId: "cmty-tecnica", aulaId: "cmty-tec-03", dados: jpg, autorizado: true, titulo: "backhand de duas mãos", origem: { org: "team-yoda", alunoId: "a1", analiseId: "mv1", golpe: "backhand" } };
  assert.strictEqual((await chamar("POST", pedido, "tk-c2@x.com")).status, 403, "aluno não envia imagem");
  assert.strictEqual((await chamar("POST", { ...pedido, autorizado: false }, "coord")).status, 400, "sem autorização de imagem");
  assert.strictEqual((await chamar("POST", { ...pedido, dados: "data:image/png;base64,AAAA" }, "coord")).status, 400, "só JPEG");
  assert.strictEqual((await chamar("POST", { ...pedido, dados: "data:image/jpeg;base64," + "A".repeat(900004) }, "coord")).status, 400, "grande demais");
  assert.strictEqual((await chamar("POST", { ...pedido, aulaId: "nao-existe" }, "coord")).status, 404);
  const ri = await chamar("POST", pedido, "coord");
  assert(/^[a-z0-9]{24}$/.test(ri.id), "id aleatório");
  assert.strictEqual(ri.imagens[0], "img:" + ri.id, "a sequência entra primeiro na aula");
  assert.strictEqual(store["digitalImagens/" + ri.id].autorizadoPor !== undefined, true);
  const tecImg = store["digitalConteudo/academia"].trilhas.find((t) => t.id === "cmty-tecnica").aulas.find((a) => a.id === "cmty-tec-03");
  assert.deepStrictEqual(tecImg.imagens, ["img:" + ri.id, "assets/foto-sequencia-backhand2-ty.jpg", "assets/foto-sequencia-backhand2.jpg"], "a sequência entra antes das fotos que a aula já tinha");
  assert.strictEqual(store["digitalConteudo/academia"].cursosMty, VERSAO, "a marca dos cursos MTY continua");
  const rg = await D.handler({ httpMethod: "GET", headers: {}, queryStringParameters: { img: ri.id } });
  assert.strictEqual(rg.statusCode, 200); assert.strictEqual(rg.headers["content-type"], "image/jpeg"); assert(rg.isBase64Encoded);
  assert.strictEqual(Buffer.from(rg.body, "base64").toString("latin1"), "\xff\xd8\xff\xe0fake-jpeg");
  assert(/immutable/.test(rg.headers["cache-control"]));
  assert.strictEqual((await D.handler({ httpMethod: "GET", headers: {}, queryStringParameters: { img: "../x" } })).statusCode, 400);
  assert.strictEqual((await D.handler({ httpMethod: "GET", headers: {}, queryStringParameters: { img: "a".repeat(24) } })).statusCode, 404);
  /* o aluno recebe a referência; salvar pela coordenação mantém */
  r = await chamar("GET", null, "tk-c2@x.com");
  assert.deepStrictEqual(r.conteudo.trilhas.find((t) => t.id === "cmty-tecnica").aulas.find((a) => a.id === "cmty-tec-03").imagens, ["img:" + ri.id, "assets/foto-sequencia-backhand2-ty.jpg", "assets/foto-sequencia-backhand2.jpg"]);
  const cc3 = await chamar("POST", { acao: "conteudoCompleto" }, "coord");
  await chamar("POST", { acao: "salvarConteudo", trilhas: cc3.trilhas, venda: cc3.venda }, "coord");
  assert.deepStrictEqual(store["digitalConteudo/academia"].trilhas.find((t) => t.id === "cmty-tecnica").aulas.find((a) => a.id === "cmty-tec-03").imagens, ["img:" + ri.id, "assets/foto-sequencia-backhand2-ty.jpg", "assets/foto-sequencia-backhand2.jpg"]);
  console.log("check-digital: ok");
})().catch((e) => { console.error(e); process.exit(1); });
