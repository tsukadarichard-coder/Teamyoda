/* Painel do aluno com abas (26/11/2026, pedido do Richard: "preciso de um Dashboard mais funcional"; "Pode fazer"): mty/aluno.html
   com a function ver-aluno.js de verdade (Firestore de mentira). Confere as abas Início/Aulas/Plano/Evolução/Falar, o resumo (próxima
   aula da Agenda, aulas no mês, crédito, ciclo, nível), a última conquista, as últimas aulas com presença, a próxima aula do plano
   igual à da Agenda, datas dd/mm, o ponto de relatório novo que some ao abrir, a aba guardada e a sincronia de 20 s.
   Rode: node autonomo/tests/check-painel-aluno.js [pasta-das-capturas] */
const fs = require("fs"), path = require("path"), http = require("http");
const { chromium } = require("playwright");
const assert = require("assert");
const R = path.join(__dirname, "..", ".."), raiz = R + "/mty", fnDir = R + "/netlify/functions", OUT = process.argv[2] || "";
const hoje = new Date(Date.now() - 3 * 3600e3), iso = (d) => d.toISOString().slice(0, 10), mais = (n) => iso(new Date(hoje.getTime() + n * 864e5));
const aulasPlano = (n) => Array.from({ length: n }, (_, i) => ({ id: "A" + (i + 1), t: ["Forehand cruzado com alvo", "Saque com direção", "Devolução bloqueada", "Transição para a rede", "Jogo de pontos com tema"][i % 5] }));
const plano = { aprovado: true, tipo: "Ciclo de construção", prioridade: "Consistência do forehand e saque com direção",
  blocos: [{ nome: "Bloco 1 · Base", semanasLista: [1, 2, 3].map((n) => ({ n, foco: "Consistência", aulas: aulasPlano(2).map((a) => ({ ...a, id: a.id + "s" + n })) })) },
           { nome: "Bloco 2 · Construção", semanasLista: [4, 5, 6].map((n) => ({ n, foco: "Construção de ponto", aulas: aulasPlano(2).map((a) => ({ ...a, id: a.id + "s" + n })) })) }] };
const reg = { A1s1: { feita: true, data: mais(-30) }, A2s1: { feita: true, data: mais(-27) }, A1s2: { feita: true, data: mais(-23) }, A2s2: { status: "falta", data: mais(-20) }, A1s3: { feita: true, data: mais(-16) }, A2s3: { feita: true, data: mais(-13) } };
const aluno = { id: "a1", nome: "Nicolas Prado", linkToken: "tok123", professorNome: "Prof. João", duracaoPadrao: "1h", nivel: "Y3", estagio: "G",
  horarios: [{ dia: 2, hora: "17:00", quadraId: "q1" }], aulasPagasMes: 3, aulasPagasDesde: iso(hoje).slice(0, 7), plano, regPlano: reg,
  registros: [{ tipo: "sessao", data: mais(-6), presenca: "presente", conquista: { texto: "Primeira vez sacando 8 de 10 dentro no lado da vantagem", marco: true } }],
  relatoriosCiclo: [{ id: "rc1", status: "publicado", publicadoEm: new Date(Date.now() - 3 * 864e5).toISOString(), publicadoPor: "Prof. João", periodo: { de: mais(-90), ate: mais(-4) }, aulas: 22,
    texto: { abertura: "Ciclo de muito progresso.", proximoCiclo: "Saque com direção.", fechamento: "Parabéns!", pilares: { tecnico: "Forehand mais estável.", tatico: "", fisico: "", mental: "" }, conquistas: ["Sustentou 20 trocas no cruzado"] },
    marcos: [{ data: mais(-6), texto: "Primeira vez sacando 8 de 10 dentro no lado da vantagem" }] }] };
const dados = {
  "mty:alunos:v2": { value: JSON.stringify([aluno]) },
  "mty:turmas:v1": { value: JSON.stringify([{ id: "t1", nome: "Turma Laranja", membros: ["a1"], professorNome: "Prof. Lia", horarios: [{ dia: 5, hora: "15:00", quadraId: "q1" }] }]) },
  "mty:quadras:v1": { value: JSON.stringify([{ id: "q1", nome: "Quadra 1" }]) },
  "mty:ocorrencias:v1": { value: JSON.stringify([
    { id: "o1", origemTipo: "individual", origemId: "a1", data: mais(-6), horaInicio: "17:00", horaFim: "18:00", tipo: "regular", status: "realizada", presencas: { a1: "presente" } },
    { id: "o0", origemTipo: "individual", origemId: "a1", data: mais(-13), horaInicio: "17:00", horaFim: "18:00", tipo: "regular", status: "realizada", presencas: { a1: "falta" } },
    { id: "o4", origemTipo: "turma", origemId: "t1", data: mais(-8), horaInicio: "15:00", horaFim: "16:30", tipo: "regular", status: "realizada", presencas: { a1: "presente" } },
    { id: "o2", origemTipo: "individual", origemId: "a1", data: mais(1), horaInicio: "17:00", horaFim: "18:00", quadraId: "q1", professorNome: "Prof. João", tipo: "regular", status: "agendada" },
    { id: "o3", origemTipo: "turma", origemId: "t1", data: mais(3), horaInicio: "15:00", horaFim: "16:30", quadraId: "q1", professorNome: "Prof. Lia", tipo: "regular", status: "cancelada", motivoCancelamento: "Chuva" }]) },
};
const docRef = (k) => ({ get: async () => ({ exists: k in dados, data: () => dados[k] }), set: async (v) => { dados[k] = v; } });
const col = () => ({ doc: (k) => ({ ...docRef(k), collection: () => ({ doc: docRef, get: async () => ({ docs: [], forEach() {} }) }) }), get: async () => ({ docs: [], forEach() {} }), where() { return this; } });
const fakeAdmin = { firestore: Object.assign(() => ({ collection: col, runTransaction: async (fn) => fn({ get: (r) => r.get(), set: () => {} }) }), { FieldValue: { serverTimestamp: () => null } }) };
const modPath = fnDir + "/_firebase-admin.js";
require.cache[require.resolve(modPath)] = { id: modPath, filename: modPath, loaded: true, exports: { admin: fakeAdmin, app: () => {} } };
const { handler } = require(fnDir + "/ver-aluno.js");
const srv = http.createServer(async (q, r) => {
  const u = new URL(q.url, "http://x");
  if (u.pathname === "/.netlify/functions/ver-aluno") { const out = await handler({ httpMethod: "GET", queryStringParameters: Object.fromEntries(u.searchParams), headers: {} }); r.writeHead(out.statusCode, out.headers); return r.end(out.body); }
  if (u.pathname.startsWith("/.netlify/")) { r.writeHead(404); return r.end("{}"); }
  const f = path.join(raiz, decodeURIComponent(u.pathname));
  if (!f.startsWith(raiz) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { "content-type": f.endsWith(".html") ? "text/html; charset=utf-8" : f.endsWith(".css") ? "text/css" : f.endsWith(".png") ? "image/png" : "text/javascript" }); r.end(fs.readFileSync(f));
}).listen(0);
/* parte do servidor: aulas do mês e últimas aulas só deste aluno */
const { historicoAulasDoAluno } = require(fnDir + "/ver-aluno.js").interno;
const hojeS = iso(hoje);
const hist = historicoAulasDoAluno({ org: "39-ranch", aluno, turmasDoAluno: [{ id: "t1", nome: "Turma Laranja", membros: ["a1"] }], ocorrencias: JSON.parse(dados["mty:ocorrencias:v1"].value), hoje: hojeS });
assert.deepStrictEqual(hist.ultimas.map((x) => x.presenca), ["presente", "presente", "falta"], JSON.stringify(hist.ultimas));
assert.deepStrictEqual(hist.ultimas.map((x) => x.titulo), ["Aula individual", "Turma Laranja", "Aula individual"]);
assert(!JSON.stringify(hist).includes("Nicolas"), "sem o nome do aluno nas aulas");

(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox"] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const erros = []; p.on("pageerror", (e) => erros.push(e.message));
  const url = "http://localhost:" + srv.address().port + "/aluno.html?org=team-yoda&id=a1&t=tok123";
  await p.goto(url);
  await p.waitForSelector("[data-resumo]", { timeout: 20000 });
  const cap = async (n) => { if (OUT) { fs.mkdirSync(OUT, { recursive: true }); await p.screenshot({ path: path.join(OUT, n + ".png"), fullPage: true }); } };
  const visivel = (sel) => p.$eval(sel, (x) => !!(x.offsetWidth || x.offsetHeight)).catch(() => false);

  /* 1. Início: 5 abas, resumo com a próxima aula da Agenda, as outras seções escondidas */
  assert.deepStrictEqual(await p.$$eval("[data-aba]", (l) => l.map((x) => x.textContent.replace(/\s+/g, ""))), ["Início", "Aulas", "Plano", "Evolução", "Falar"]);
  const cabeca = await p.innerText("[data-cabeca-aluno]"), resumo = await p.innerText("[data-resumo]");
  assert(/Olá, Nicolas/.test(cabeca) && /PRÓXIMA AULA/i.test(cabeca) && /Turma Laranja/.test(cabeca), cabeca);
  assert(/Aulas feitas no mês\s*\n\s*2/.test(resumo) && /Y3 · Direção/.test(resumo), resumo);
  assert(/42%/.test(await p.innerText("[data-ciclo-anel]")), "anel do ciclo no Início");
  assert(await visivel("[data-ultima-conquista]"), "última conquista no Início");
  assert(!(await visivel("[data-historico-aulas]")), "aba Aulas escondida");
  assert(await p.$(".aba .ponto"), "ponto de relatório novo na aba Evolução");
  await cap("painel-inicio");

  /* 2. Aulas: próximas, mensalidade e últimas aulas com presença */
  await p.click('[data-ir-aba="aulas"] >> nth=0');
  assert(await visivel("[data-historico-aulas]"), "Aulas aberta pelo resumo");
  const t2 = await p.innerText("[data-historico-aulas]");
  assert(/2 aulas feitas · 1 falta/.test(t2) && /Faltou/.test(t2), t2);
  assert(await visivel("[data-saldo-aulas]"), "Minhas aulas (mensalidade de 3) na aba Aulas");

  /* 3. Plano: a próxima aula do plano usa a Agenda (bate com o Início) e as datas são dd/mm */
  await p.click('[data-aba="plano"]');
  const hp = await p.innerText("[data-proxima-plano-horario]");
  const amanha = mais(1), esperado = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"][new Date(amanha + "T12:00:00").getDay()] + ", " + amanha.slice(8, 10) + "/" + amanha.slice(5, 7) + " às 17:00";
  assert(hp.includes(esperado), "a aula individual de amanhã na Agenda: " + hp + " ≠ " + esperado);
  const tPlano = await p.innerText('[data-secao="plano"]');
  assert(!/\d{4}-\d{2}-\d{2}/.test(tPlano), "sem data AAAA-MM-DD no plano");

  /* 4. Evolução: abrir tira o ponto; a aba fica guardada ao recarregar */
  await p.click('[data-aba="evolucao"]');
  assert(!(await p.$(".aba .ponto")), "ponto some ao abrir a Evolução");
  assert(await visivel('[data-painel="relatorios-ciclo"]'), "relatório do ciclo na Evolução");
  await p.reload();
  await p.waitForSelector("[data-resumo]", { state: "attached", timeout: 20000 });
  assert.strictEqual(await p.$eval('[aria-selected="true"]', (x) => x.getAttribute("data-aba")), "evolucao", "aba guardada");
  assert(!(await p.$(".aba .ponto")), "relatório já visto");

  /* 5. Falar: canais de contato; atualização automática não troca de aba */
  await p.click('[data-aba="falar"]');
  assert(/Fale com a plataforma/.test(await p.innerText('[data-secao="falar"]')));
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(21000);
  assert.strictEqual(await p.$eval('[aria-selected="true"]', (x) => x.getAttribute("data-aba")), "falar", "a sincronia de 20 s mantém a aba");
  assert.strictEqual(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, "sem rolagem lateral");
  assert.deepStrictEqual(erros, []);
  await b.close(); srv.close();
  console.log("check-painel-aluno: ok");
})().catch((e) => { console.error(e); process.exit(1); });
