/* Padrão de Atendimento MTY no navegador (390 px):
   A · app do professor (código real de mty/index.html em React/Babel locais, modo sem nuvem, conta do dono):
       painel do Head Trainer (% de checklist, aula sem registro, faltas, sem marco, conversa semanal, mensagem do ciclo);
       sessão individual: cartão de preparação, conquista com marco, nota pessoal e checklist (3 itens marcam sozinhos) no
       registro; caderno; sessão de turma: preparação de cada jogador, conquista por jogador, ausente fica fora;
       relatório do ciclo: rascunho da IA (simulada) só com dados permitidos, revisão, mensagem do Richard e publicação.
   B · página do aluno (aluno.html + function real ver-aluno sobre um Firestore em memória): só o relatório publicado aparece.
   Rode: node tests/smoke-atendimento.js [pasta-das-capturas] */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const raiz = path.join(__dirname, "../../mty"), fx = path.join(__dirname, "../../netlify/functions/");
const capturas = process.argv[2] || "";
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("smoke-atendimento: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const A = require(path.join(raiz, "atendimento.js"));
const hoje = new Date().toISOString().slice(0, 10);
const dia = (n) => A.somaDias(hoje, n);

/* ── Firestore em memória para as functions (B) ── */
const store = {}; const J = (v) => JSON.parse(JSON.stringify(v));
function docRef(p) { return { id: p.split("/").pop(), collection: (n) => colRef(p + "/" + n), async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), data: () => J(v) }; },
  async set(v, o) { store[p] = o && o.merge ? { ...(store[p] || {}), ...J(v) } : J(v); }, async update(v) { store[p] = { ...(store[p] || {}), ...J(v) }; } }; }
function colRef(p, f = [], ord = null, lim = 0) {
  return {
    doc: (id) => docRef(p + "/" + id), where: (c, o, v) => colRef(p, f.concat([[c, o, v]]), ord, lim), orderBy: (c, d) => colRef(p, f, [c, d], lim), limit: (n) => colRef(p, f, ord, n),
    async get() {
      let ks = Object.keys(store).filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/")).filter((k) => f.every(([c, o, v]) => store[k][c] === v));
      if (ord) ks.sort((a, b) => (store[a][ord[0]] < store[b][ord[0]] ? -1 : 1) * (ord[1] === "desc" ? -1 : 1));
      if (lim) ks = ks.slice(0, lim);
      const d = ks.map((k) => ({ id: k.split("/").pop(), ref: docRef(k), data: () => J(store[k]) }));
      return { docs: d, size: d.length, empty: !d.length, forEach: (g) => d.forEach(g) };
    },
  };
}
const admin = { firestore: Object.assign(() => ({ collection: (n) => colRef(n), batch: () => ({ set() {}, update() {}, commit: async () => {} }) }), { FieldValue: { serverTimestamp: () => new Date().toISOString(), arrayUnion: (...x) => x, increment: (n) => n } }), auth: () => ({ verifyIdToken: async () => { throw new Error("x"); } }) };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };
const verAluno = require(fx + "ver-aluno.js").handler;
const textoRel = { abertura: "Foi um ciclo muito bom para a Ana.", pilares: { tecnico: "Saque mais solto.", tatico: "", fisico: "", mental: "" }, conquistas: ["Primeiro ace no jogo"], proximoCiclo: "Devolução.", fechamento: "Parabéns!" };
store["orgs/team-yoda/dados/mty:alunos:v2"] = { value: JSON.stringify([{ id: "a1", nome: "Ana Souza", linkToken: "tA", registros: [], horarios: [],
  historicoRelatorios: [{ id: "REL-1", data: dia(-30) + "T10:00:00Z", tipo: "ciclo", feitas: 6, total: 8, texto: "FECHAMENTO-INTERNO: corrigi a empunhadura; deixei passar o saque.", criterios: [{ nome: "Cruzado", resultado: "sim" }] }],
  relatoriosCiclo: [
  { id: "rc1", status: "publicado", publicadoEm: dia(-1) + "T10:00:00Z", publicadoPor: "Carlos", publico: "pais", periodo: { de: dia(-60), ate: dia(-1) }, aulas: 8, texto: textoRel,
    marcos: [{ data: dia(-3), texto: "Primeiro ace no jogo" }], mensagemCiclo: { texto: "Orgulho deste grupo.", autor: "Richard Tsukada" }, mensagemIndividual: "Ana, siga assim.", autorUid: "INTERNO-UID" },
  { id: "rc2", status: "rascunho", publico: "pais", periodo: { de: dia(-60), ate: hoje }, texto: { ...textoRel, abertura: "RASCUNHO-SECRETO" } },
] }]) };

/* ── página do app do professor (A) ── */
const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
const corte = ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const at = (o) => A.camposDoRegistro(o);
const base0 = { estagio: "C", nivel: "Y5", prioridades: ["fundo", "saque"], competicoes: [], professorUid: "p1", professorNome: "Carlos" };
const fixtures = JSON.stringify([
  { ...base0, id: "j1", nome: "Ana Souza", nascimento: "2014-05-02", registros: [
    { id: "r1", tipo: "sessao", data: dia(-70), registradoPorUid: "p1", registradoPorNome: "Carlos", corrigi: "SEGREDO-CORRIGI", ignorei: "SEGREDO-IGNOREI", leituraDaAula: "SEGREDO-LEITURA",
      ...at({ fichaVista: true, marcados: { nome: true, objetivo: true, retorno: true }, conquista: { texto: "Sacou por cima pela primeira vez" }, pilares: { tecnico: "Lançamento mais alto" } }) },
    { id: "r2", tipo: "sessao", data: dia(-7), registradoPorUid: "p1", registradoPorNome: "Carlos", proximoFoco: "Devolução de segundo saque",
      ...at({ marcados: { nome: true }, conquista: { texto: "Trocou 10 bolas cruzadas" }, notaPessoal: "Torneio no dia 20" }) },
  ] },
  { ...base0, id: "j2", nome: "Bia Lima", registros: [] },
  { ...base0, id: "j3", nome: "Caio Reis", registros: [] },
]);
const oc = (id, alunoId, n, extra) => ({ id, tipo: "regular", origemTipo: "individual", origemId: alunoId, data: dia(n), horaInicio: "09:00", horaFim: "10:00", professorUid: "p1", professorNome: "Carlos", status: "agendada", ...extra });
const ocorrencias = JSON.stringify([
  oc("o1", "j3", -3), oc("o2", "j2", -2, { status: "realizada", presencas: { j2: "falta" } }), oc("o3", "j2", -5, { status: "realizada", presencas: { j2: "falta" } }), oc("o4", "j2", -9, { status: "realizada", presencas: { j2: "falta" } }),
]);
const turma = JSON.stringify({ id: "t1", nome: "Turma Azul", membros: ["j2", "j3"], duracaoPadrao: "1h", professorUid: "p1", professorNome: "Carlos", horarios: [] });
const corpo = `async function listaProfessores(){return [{uid:"p1",nome:"Carlos"},{uid:"p2",nome:"Rita"}];}
async function organizacao(){return null;} var db=null, auth=null;
window.storage = { async get(k, sh) { const raw = localStorage.getItem((sh ? "shared:" : "local:") + k); return raw === null ? null : { key: k, value: raw }; }, async set(k, v, sh) { localStorage.setItem((sh ? "shared:" : "local:") + k, v); return { key: k }; } };
` + ms.slice(0, corte) + `
window.mtyAuth={entrar:async()=>{},usuario:()=>({ email: "tsukada.richard@gmail.com", uid: "p1" })};
/* IA simulada: guarda o pedido e devolve o relatório no formato combinado */
chamarIA = async (prompt, max, etapa) => { window.__prompt = prompt; if (etapa) etapa("Escrevendo"); await new Promise((r) => setTimeout(r, 200));
  const crases = String.fromCharCode(96, 96, 96);
  return crases + "json\\n" + JSON.stringify({ abertura: "A Ana teve um ciclo de muita evolução.", pilares: { tecnico: "O saque ficou mais solto.", tatico: "", fisico: "", mental: "" }, conquistas: ["Primeiro ace no jogo", "Trocou 10 bolas cruzadas"], proximoCiclo: "Vamos trabalhar a devolução.", fechamento: "Parabéns pelo empenho!" }) + "\\n" + crases; };
function Raiz(){
  const [alunos, setAlunosBase] = React.useState(() => ${fixtures}.map((a) => ({ ...novoAluno(), ...a })));
  const [turmas, setTurmasBase] = React.useState(() => [${turma}]);
  const [tela, setTela] = React.useState({ v: "painel" });
  const setAlunos = (l) => setAlunosBase((prev) => { const n = typeof l === "function" ? l(prev) : l; window.__alunos = n; return n; });
  const setTurmas = (l) => setTurmasBase((prev) => (typeof l === "function" ? l(prev) : l));
  window.__alunos = alunos; window.__tela = setTela;
  const aberto = alunos.find((a) => a.id === tela.id);
  const comum = { papelAtual: "coordenador", uidAtual: "p1", exerciciosCustom: [], setExerciciosCustom: () => {} };
  if (tela.v === "painel") return <TelaPadraoAtendimento alunos={alunos} turmas={turmas} ocorrencias={${ocorrencias}} irParaAluno={(id) => { window.__foi = id; }} irParaTurma={() => {}} />;
  if (tela.v === "sessao") return <TelaSessao key={tela.id} aluno={aberto} alunos={alunos} setAlunos={setAlunos} setSubaba={() => {}} {...comum} />;
  if (tela.v === "resumo") return <div data-resumo><ResumoAtendimentoRegistro r={aberto.registros[aberto.registros.length - 1]} /></div>;
  if (tela.v === "turma") return <SessaoTurma turma={turmas[0]} alunos={alunos} setAlunos={setAlunos} turmas={turmas} setTurmas={setTurmas} aoFechar={() => {}} aoRemover={() => {}} identidade={{ nome: "Team Yoda" }} ocorrencias={[]} quadras={[]} {...comum} />;
  if (tela.v === "relatorio") return <RelatorioCicloCliente aluno={aberto} setAlunos={setAlunos} identidade={{ nome: "Team Yoda" }} papelAtual="coordenador" uidAtual="p1" />;
  return null;
}
ReactDOM.createRoot(document.getElementById("root")).render(<Raiz />);`;
const sc = ["sync-listas.js", "scout/graficos.js", "scout/ao-vivo.js", "scout/relatorio-jogos.js", "scout/movimento-motor.js", "scout/evidencias.js", "aulas-mes.js", "situacoes-jogo.js", "alto-rendimento.js", "atendimento.js", "plano-equipe.js", "equipe-rendimento.js", "relatorio-atleta.js"];
const paginaApp = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><div id=root style="padding:16px"></div>
<script src=/__cdn/r.js></script><script src=/__cdn/d.js></script><script src=/__cdn/p.js></script><script src=/__cdn/c.js></script><script src=/__cdn/b.js></script>
${sc.map((s) => "<script src=/" + s + "></script>").join("")}
<script type="text/babel">${corpo}</script>`;
const cdn = { "/__cdn/r.js": CDN + "/react-18.3.1/package/umd/react.development.js", "/__cdn/d.js": CDN + "/react-dom-18.3.1/package/umd/react-dom.development.js",
  "/__cdn/p.js": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "/__cdn/c.js": CDN + "/recharts-2.15.4/package/umd/Recharts.js", "/__cdn/b.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js" };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
const srv = http.createServer((q, r) => {
  const u = new URL(q.url, "http://x"); let b = "";
  q.on("data", (d) => (b += d));
  q.on("end", async () => {
    if (u.pathname === "/__app") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(paginaApp); }
    if (cdn[u.pathname]) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(cdn[u.pathname])); }
    if (u.pathname === "/.netlify/functions/ver-aluno") {
      const x = await verAluno({ httpMethod: q.method, headers: q.headers, body: b || null, queryStringParameters: Object.fromEntries(u.searchParams) });
      r.writeHead(x.statusCode, x.headers); return r.end(x.body);
    }
    let rel = decodeURIComponent(u.pathname); if (rel.endsWith("/")) rel += "index.html";
    const f = path.join(raiz, rel);
    if (f.startsWith(raiz) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { "content-type": MIME[path.extname(f)] || "application/octet-stream" }); return r.end(fs.readFileSync(f)); }
    r.writeHead(404); r.end();
  });
}).listen(0);
const base = "http://localhost:" + srv.address().port;

(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route(/^https?:\/\/(?!localhost)/, (rota) => rota.fulfill({ contentType: /fonts/.test(rota.request().url()) ? "text/css" : "text/javascript", body: "" }));
  const p = await ctx.newPage();
  const erros = []; p.on("pageerror", (e) => erros.push(e.message)); p.on("dialog", (d) => d.accept());
  p.on("console", (x) => { if (x.type() === "error" && !/Failed to load|BABEL|unique "key"|404/.test(x.text())) erros.push("c:" + x.text().slice(0, 200)); });
  const cap = async (n) => { if (capturas) { fs.mkdirSync(capturas, { recursive: true }); await p.screenshot({ path: path.join(capturas, n + ".png"), fullPage: true }); } };
  const texto = () => p.evaluate(() => document.body.innerText);
  const espera = async (re, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (re.test(await texto())) return; await p.waitForTimeout(150); } throw new Error("não apareceu " + re + "\n" + (await texto()).slice(0, 1200) + "\n" + erros.join(" | ")); };
  const botao = (nome) => p.getByRole("button", { name: nome, exact: true });
  const ir = (t) => p.evaluate((x) => window.__tela(x), t);
  const semRolagem = async (onde) => assert(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "sem rolagem lateral em " + onde);

  /* ── A1 · painel do Head Trainer ── */
  await p.goto(base + "/__app");
  await espera(/Padrão de atendimento/);
  await espera(/Só a sua conta abre este painel/);
  let t = await p.locator("[data-padrao-atendimento]").innerText();
  assert(/Checklist completo\s*0%\s*0 de 1 aulas/.test(t), "checklist: só a aula dos últimos 30 dias com o padrão\n" + t.slice(0, 600));
  assert(/Aulas sem registro\s*1\s*há mais de 24 h/.test(t), "aula sem registro");
  assert(/Alunos com 3 faltas ou mais\s*1/.test(t) && /Alunos sem marco\s*1/.test(t), "faltas e sem marco");
  t = await p.locator('[data-prof="Carlos"]').innerText();
  assert(/0% completo/.test(t) && /0 de 1 aulas completas · média 3 de 6 itens/.test(t) && /1 aula sem registro/.test(t), t);
  assert(/sem aulas com o padrão/.test(await p.locator('[data-prof="Rita"]').innerText()), "professor sem aula com o padrão também aparece");
  t = await p.locator('[data-conversa="Carlos"]').innerText();
  assert(/Caio Reis\s*Aula de \d\d\/\d\d sem registro/.test(t) && /Bia Lima\s*3 faltas em 30 dias/.test(t) && /Ana Souza\s*Nenhum marco em 70 dias/.test(t), t);
  await p.locator('[data-conversa="Carlos"]').getByRole("button", { name: "Bia Lima", exact: true }).click();
  assert.strictEqual(await p.evaluate(() => window.__foi), "j2", "a ficha sugerida abre o aluno");
  await p.getByLabel("Mensagem do ciclo").fill("Orgulho de ver este grupo evoluindo.");
  await botao("Salvar mensagem").click();
  await espera(/Mensagem do ciclo salva/);
  const cfg = await p.evaluate(() => JSON.parse(localStorage.getItem("shared:mty:atendimento:v1")));
  assert.strictEqual(cfg.mensagemCiclo.texto, "Orgulho de ver este grupo evoluindo.");
  await semRolagem("painel"); await cap("atend-01-painel");
  console.log("  A1 · painel: checklist por professor, sem registro, faltas, sem marco, conversa e mensagem do ciclo");

  /* ── A2 · sessão individual ── */
  await ir({ v: "sessao", id: "j1" });
  await espera(/Preparação da aula/i);
  assert(!/Trocou 10 bolas cruzadas/.test(await texto()), "a preparação começa fechada");
  await botao("Ver preparação").click();
  t = await p.locator("[data-preparacao]").innerText();
  assert(/Trocou 10 bolas cruzadas/.test(t) && /Torneio no dia 20/.test(t) && /Devolução de segundo saque/.test(t), "foco, conquista da última aula e nota pessoal\n" + t);
  await cap("atend-02-preparacao");
  await botao("Gerar sessão").click();
  /* a barra fixa de finalizar depende do CSS da página real; aqui o toque vai direto no botão */
  await botao("Finalizar e registrar aula").evaluate((el) => el.click());
  await p.waitForSelector("[data-checklist-atendimento]");
  assert.strictEqual(await p.locator('[data-item="ficha"]').getAttribute("data-feito"), "sim", "abrir a preparação marca 'Li a ficha'");
  assert.strictEqual(await p.locator('[data-item="devolutiva"]').getAttribute("data-feito"), "nao");
  assert.strictEqual(await p.locator('[data-item="registro"]').getAttribute("data-feito"), "sim");
  await p.getByLabel("Conquista do dia").fill("Primeiro ace no jogo");
  await botao("☆ Marcar como marco").click();
  await p.getByLabel("Nota pessoal").fill("Viaja no feriado");
  assert.strictEqual(await p.locator('[data-item="devolutiva"]').getAttribute("data-feito"), "sim", "a conquista marca a devolutiva");
  for (const i of ["nome", "objetivo", "retorno"]) await p.locator('[data-item="' + i + '"]').click();
  await p.locator('[role="dialog"]').evaluate((el) => { const s = el.querySelector("div[style*='overflow']"); if (s) s.scrollTop = s.scrollHeight; });
  await cap("atend-03-fechamento");
  await botao("Confirmar registro no caderno").click();
  await p.waitForFunction(() => (window.__alunos.find((a) => a.id === "j1").registros || []).length === 3, null, { timeout: 15000 });
  let reg = await p.evaluate(() => window.__alunos.find((a) => a.id === "j1").registros[2]);
  assert.deepStrictEqual(reg.atendimento, { v: 1, ficha: true, nome: true, objetivo: true, retorno: true, devolutiva: true, registro: true });
  assert.deepStrictEqual([reg.conquista, reg.notaPessoal], [{ texto: "Primeiro ace no jogo", marco: true }, "Viaja no feriado"]);
  assert(reg.tipo === "sessao" && Array.isArray(reg.exercicios) && reg.exercicios.length > 0, "o registro da aula continua igual, com os campos novos a mais");
  await ir({ v: "resumo", id: "j1" });
  await espera(/Padrão de atendimento: 6 de 6/);
  t = await p.locator("[data-resumo]").innerText();
  assert(/CONQUISTA · MARCO/i.test(t) && /Primeiro ace no jogo/.test(t) && /Viaja no feriado/.test(t), t);
  console.log("  A2 · sessão individual: preparação, conquista com marco, nota pessoal, checklist e caderno");

  /* ── A3 · sessão de turma ── */
  await ir({ v: "turma" });
  await espera(/Turma Azul/);
  await botao("Sessão").click();
  await espera(/Preparação da aula/i);
  await botao("Ver preparação").click();
  assert.strictEqual(await p.locator("[data-prep-aluno]").count(), 2, "um cartão por jogador da turma");
  await botao("Ausente").nth(1).click();
  assert.strictEqual(await p.locator('[data-atend-jogador="j3"]').count(), 0, "ausente não tem conquista");
  await p.locator('[data-atend-jogador="j2"]').click();
  await p.getByLabel("Conquista do dia").fill("Voleio firme na rede");
  await botao("Finalizar e registrar aula").click();
  await p.waitForSelector("[data-checklist-atendimento]");
  assert(/1 de 1 com conquista/.test(await p.locator('[data-item="devolutiva"]').innerText()), "devolutiva da turma: quantos presentes têm conquista");
  await p.locator('[data-item="objetivo"]').click();
  await cap("atend-04-turma");
  await botao("Salvar sessão").click();
  await p.waitForFunction(() => (window.__alunos.find((a) => a.id === "j2").registros || []).length === 1);
  const [rb, rc] = await p.evaluate(() => ["j2", "j3"].map((id) => window.__alunos.find((a) => a.id === id).registros[0]));
  assert.deepStrictEqual(rb.atendimento, { v: 1, ficha: true, nome: false, objetivo: true, retorno: false, devolutiva: true, registro: true });
  assert.deepStrictEqual(rb.conquista, { texto: "Voleio firme na rede", marco: false });
  assert(rc.presenca === "ausente" && !rc.atendimento && !rc.conquista, "quem faltou fica fora do padrão");
  console.log("  A3 · turma: preparação por jogador, conquista por jogador, ausente fora");

  /* ── A4 · relatório do ciclo ── */
  await ir({ v: "relatorio", id: "j1" });
  await espera(/Relatório do ciclo para o cliente/);
  await botao("Novo relatório do ciclo").click();
  await p.getByLabel("Início do período").fill(dia(-80));
  t = await p.locator("[data-rc-contagem]").innerText();
  assert(/3 aulas · 3 conquistas · 1 marco · 1 observação por pilar/.test(t), t);
  assert.strictEqual(await p.getByRole("radio", { name: "Para os pais" }).getAttribute("aria-checked"), "true", "menor de 18: versão dos pais");
  await botao("Gerar rascunho com IA").click();
  await espera(/Rascunho escrito pela IA/);
  const prompt = await p.evaluate(() => window.__prompt);
  assert(/PAIS/.test(prompt) && /Primeiro ace no jogo \[MARCO\]/.test(prompt) && /Lançamento mais alto/.test(prompt) && /Devolução de segundo saque/.test(prompt), "dados permitidos no pedido");
  assert(!/SEGREDO|Viaja no feriado|Torneio no dia 20|Souza/.test(prompt), "anotações internas, nota pessoal e sobrenome não vão para a IA");
  t = await p.locator("[data-rc-previa]").innerText();
  assert(/A Ana teve um ciclo de muita evolução/.test(t) && /MARCOS DO CICLO/i.test(t) && /Primeiro ace no jogo/.test(t) && /Mensagem de Richard Tsukada/i.test(t) && /Orgulho de ver este grupo evoluindo/.test(t), t);
  await p.getByLabel("Abertura").fill("A Ana teve um ciclo de muita evolução e dedicação.");
  await p.getByLabel("Mensagem individual do Richard").fill("Ana, que orgulho do seu primeiro ace!");
  assert.strictEqual(await p.evaluate(() => (window.__alunos.find((a) => a.id === "j1").relatoriosCiclo || []).length), 0, "nada é gravado antes de salvar");
  await botao("Publicar para o cliente").click();
  await espera(/Publicado: já aparece na página do aluno/);
  const rel = await p.evaluate(() => window.__alunos.find((a) => a.id === "j1").relatoriosCiclo[0]);
  assert.deepStrictEqual([rel.status, rel.publico, rel.publicadoPor, rel.aulas], ["publicado", "pais", "Carlos", 3]);
  assert.strictEqual(rel.texto.abertura, "A Ana teve um ciclo de muita evolução e dedicação.");
  assert.deepStrictEqual([rel.mensagemCiclo.texto, rel.mensagemIndividual], ["Orgulho de ver este grupo evoluindo.", "Ana, que orgulho do seu primeiro ace!"]);
  assert(await botao("Despublicar").count() === 1 && await botao("Baixar PDF").count() === 1);
  await semRolagem("relatório"); await cap("atend-05-relatorio");
  await botao("‹ Voltar à lista").click();
  assert(/para os pais · publicado/.test(await p.locator("[data-rc-item]").innerText()));
  console.log("  A4 · relatório: IA só com dados permitidos, revisão, mensagem do Richard, publicação");

  /* ── B · página do aluno ── */
  await p.goto(base + "/aluno.html?org=team-yoda&id=a1&t=tA");
  await p.waitForSelector('[data-painel="relatorios-ciclo"]', { timeout: 20000 });
  t = await p.locator('[data-painel="relatorios-ciclo"]').innerText();
  assert(/Foi um ciclo muito bom para a Ana/.test(t) && /Primeiro ace no jogo/.test(t) && /Orgulho deste grupo/.test(t) && /Ana, siga assim/.test(t) && /Professor: Carlos/.test(t), t);
  assert(!/RASCUNHO-SECRETO/.test(await texto()), "rascunho nunca chega à página do aluno");
  const resp = await p.evaluate(async () => (await fetch("/.netlify/functions/ver-aluno?org=team-yoda&id=a1&t=tA")).text());
  assert(!/RASCUNHO-SECRETO|INTERNO-UID/.test(resp), "a function só entrega o relatório publicado e os campos do relatório");
  /* o relatório de fechamento antigo (escrito para o treinador) saiu da página e o texto não sai mais da function */
  assert(!/FECHAMENTO-INTERNO/.test(resp) && /"feitas":6/.test(resp), "do fechamento só saem os números");
  assert(!/Seus relatórios de ciclo|FECHAMENTO-INTERNO/.test(await texto()), "a página do aluno não mostra mais o fechamento do treinador");
  await p.locator('[data-rc-ver="rc1"]').click();
  assert.strictEqual(await p.locator("[data-rc-aberto]").count(), 0, "fecha");
  await semRolagem("página do aluno"); await cap("atend-06-aluno");
  console.log("  B · página do aluno: só o relatório publicado");

  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  console.log("smoke-atendimento: ok");
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
