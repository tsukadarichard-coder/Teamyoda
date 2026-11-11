/* Alto rendimento no navegador (390 px):
   A · app do professor (código real de mty/index.html em React/Babel locais, modo sem nuvem):
       migração das equipes antigas → atletas no alto rendimento; ficha: calendário com prioridade, plano gerado, registro em
       viagem, meta e medida; Sessão do dia: presença (quem está em torneio vem desmarcado), sessão com bloco coletivo do tema
       comum e tarefas individuais, fechamento → marcador e carga de cada um atualizados.
   B · Meu plano do atleta (aluno.html + functions reais ver-aluno e ar-atleta sobre um Firestore em memória): painel com a
       semana e a carga, registro de jogo fora do CT que entra no marcador e na carga.
   Rode: node tests/smoke-alto-rendimento.js [pasta-das-capturas] */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const raiz = path.join(__dirname, "../../mty"), fx = path.join(__dirname, "../../netlify/functions/");
const capturas = process.argv[2] || "";
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("smoke-alto-rendimento: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const AR = require(path.join(raiz, "alto-rendimento.js"));
const hoje = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

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
const verAluno = require(fx + "ver-aluno.js").handler, arAtleta = require(fx + "ar-atleta.js").handler;
const cal = [{ id: "t1", nome: "Copa Sul", inicio: AR.somaDias(hoje, -1), fim: AR.somaDias(hoje, 3), prioridade: "principal" }];
store["orgs/team-yoda/dados/mty:alunos:v2"] = { value: JSON.stringify([{ id: "a1", nome: "Ana Souza", linkToken: "tA", registros: [], horarios: [] }]) };
store["orgs/team-yoda/ar/a1"] = { ativo: true, calendario: cal, progresso: { cumpridos: {} }, cargaSemanas: {},
  plano: AR.gerarPlano({ calendario: cal, inicio: AR.somaDias(hoje, -14), semanas: 10, minutosSemana: 600, prioridades: ["fundo", "saque"] }) };

/* ── página do app do professor (A) ── */
const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
const corte = ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const fixtures = JSON.stringify([
  { ...{ id: "j1", nome: "Ana Souza", estagio: "C", nivel: "Y5", prioridades: ["fundo", "saque"], competicoes: [{ nome: "Copa Sul", data: AR.somaDias(hoje, 10), fim: AR.somaDias(hoje, 13) }] } },
  { id: "j2", nome: "Bia Lima", estagio: "C", nivel: "Y5", prioridades: ["fundo", "rede"], competicoes: [] },
  { id: "j3", nome: "Caio Reis", estagio: "C", nivel: "Y5", prioridades: ["rede", "saque"], competicoes: [] },
  { id: "j4", nome: "Duda Prado", estagio: "A", nivel: "Y3", prioridades: [], competicoes: [] },
]);
const corpo = `async function listaProfessores(){return [{uid:"p1",nome:"Carlos"}];}
async function organizacao(){return null;} var db=null, auth=null;
window.storage = { async get(k, sh) { const raw = localStorage.getItem((sh ? "shared:" : "local:") + k); return raw === null ? null : { key: k, value: raw }; }, async set(k, v, sh) { localStorage.setItem((sh ? "shared:" : "local:") + k, v); return { key: k }; } };
` + ms.slice(0, corte) + `
window.mtyAuth={entrar:async()=>{},usuario:()=>null};
/* IA simulada: guarda o pedido e devolve um plano com códigos reais do catálogo */
iniciarJobIA = async (prompt, max, etapa) => { window.__prompt = prompt; if (etapa) etapa("Enviando o pedido"); return { jobId: "job-teste", org: "demo" }; };
aguardarJobIA = async () => { await new Promise((r) => setTimeout(r, 300)); const cat = TODOS_EXERCICIOS(), d = (f) => cat.find((e) => e.f === f && !e.semBola).c, sit = cat.find((e) => e.tl).c;
  const crases = String.fromCharCode(96, 96, 96); return crases + "json\\n" + JSON.stringify({ prioridade: "Devolução agressiva antes do Brasileiro", observacao: [{ t: "a · scout", d: "sem jogos com scout ainda" }], semanas: [
    { n: 1, foco: "Afinação", conteudos: [{ tema: "ip:inicio", ex: d("IP"), vezes: 2, essencial: true, criterio: "60% de devoluções em jogo" }, { tema: "tat:situacao", ex: sit, vezes: 1 }, { tema: "tec:rede", ex: d("PDR"), vezes: 1, essencial: true }] }] }) + "\\n" + crases; };
function Raiz(){
  const [alunos, setAlunosBase] = React.useState(() => ${fixtures}.map((a) => ({ ...novoAluno(), ...a })));
  const [tela, setTela] = React.useState({ v: "ar" });
  const setAlunos = (l) => { setAlunosBase(l); window.__alunos = l; };
  window.__alunos = alunos; window.__tela = setTela;
  const aberto = alunos.find((a) => a.id === tela.id);
  return tela.v === "ar" ? <TelaAltoRendimento alunos={alunos} setAlunos={setAlunos} uidAtual="p1" papelAtual="coordenador" identidade={{ nome: "Team Yoda" }} aoAbrirJogador={(id, sub) => setTela({ v: "ficha", id, sub })} />
    : <div><button id="voltar" onClick={() => setTela({ v: "ar" })}>voltar</button><AbaAltoRendimento aluno={aberto} alunos={alunos} setAlunos={setAlunos} /></div>;
}
ReactDOM.createRoot(document.getElementById("root")).render(<Raiz />);`;
const sc = ["sync-listas.js", "scout/graficos.js", "scout/ao-vivo.js", "scout/relatorio-jogos.js", "scout/movimento-motor.js", "scout/evidencias.js", "aulas-mes.js", "situacoes-jogo.js", "alto-rendimento.js", "plano-equipe.js", "equipe-rendimento.js", "relatorio-atleta.js"];
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
    if (u.pathname === "/.netlify/functions/ver-aluno" || u.pathname === "/.netlify/functions/ar-atleta") {
      const x = await (u.pathname.endsWith("ver-aluno") ? verAluno : arAtleta)({ httpMethod: q.method, headers: q.headers, body: b || null, queryStringParameters: Object.fromEntries(u.searchParams) });
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

  /* ── A · app do professor ── */
  await p.goto(base + "/__app");
  await p.evaluate(() => localStorage.setItem("shared:mty:equipes:v1", JSON.stringify([{ id: "eq1", nome: "Equipe juvenil", membros: ["j1", "j2", "j3"], plano: { status: "fechado" } }])));
  await p.reload();
  await espera(/Alto rendimento/);
  await espera(/3 atleta\(s\) das equipes de competição/);
  assert(/Equipes de competição \(arquivo\)/.test(await texto()), "equipes antigas ficam como arquivo");
  await p.getByRole("button", { name: "Trazer para o alto rendimento", exact: true }).click();
  await espera(/Sem plano individual: abra e gere o plano/);
  assert.strictEqual(await p.locator("[data-atleta-ar]").count(), 3);
  const flags = await p.evaluate(() => window.__alunos.filter((a) => a.altoRendimento && a.altoRendimento.ativo).map((a) => a.id));
  assert.deepStrictEqual(flags.sort(), ["j1", "j2", "j3"]);
  const docAna = await p.evaluate(() => JSON.parse(localStorage.getItem("mty:ar:doc:j1")));
  assert.strictEqual(docAna.calendario.length, 1, "a competição da ficha vira o primeiro torneio do calendário");
  assert.deepStrictEqual([docAna.calendario[0].inicio, docAna.calendario[0].fim], [AR.somaDias(hoje, 10), AR.somaDias(hoje, 13)], "com o início e o término da ficha");
  /* fases da ficha: o torneio ocupa todas as semanas entre o início e o término */
  const fases = await p.evaluate(() => { const f = (c) => montaFases({ inicio: "2026-11-02", semanas: 8, competicoes: [c] }).map((x) => x.fase === "Torneio" ? "T" : "-").join("");
    return [f({ nome: "T", data: "2026-11-18" }), f({ nome: "T", data: "2026-11-18", fim: "2026-11-26" }), f({ nome: "T", data: "2026-11-18", fim: "2026-11-10" })]; });
  assert.deepStrictEqual(fases, ["--T-----", "--TT----", "--T-----"], "um dia: uma semana; início e término: as semanas do período; término antes do início é ignorado");
  await cap("ar-01-lista");

  /* ficha da Ana: calendário com torneio principal, gerar plano */
  await p.locator('[data-atleta-ar="j1"] >> text=Abrir').click();
  await espera(/Ainda sem plano individual/);
  await p.getByRole("button", { name: "Calendário", exact: true }).click();
  await p.fill('input[aria-label="Nome do torneio"]', "Brasileiro");
  await p.fill('input[aria-label="Início"]', AR.somaDias(hoje, 35)); await p.fill('input[aria-label="Fim"]', AR.somaDias(hoje, 41));
  await p.selectOption('select[aria-label="Prioridade"]', "principal");
  await p.getByRole("button", { name: "Adicionar torneio", exact: true }).click();
  await espera(/Brasileiro/);
  await p.getByRole("button", { name: "Plano", exact: true }).click();
  await p.fill('input[aria-label="Semanas"]', "12");
  await p.getByRole("button", { name: "Gerar com IA", exact: true }).click();
  await espera(/Revise o plano da IA antes de usar/);
  const pedido = await p.evaluate(() => window.__prompt);
  for (const x of ["PRINCÍPIOS TRAVADOS", "use SOMENTE estes códigos", "FICHA DO ATLETA", "CALENDÁRIO DE TORNEIOS", "Brasileiro", "Principal", "ESQUELETO DO PLANO", "NÃO mude fases nem carga", "TEMAS (use exatamente estas chaves)", "ÚLTIMAS 8 SEMANAS"])
    assert(pedido.includes(x), "o pedido da IA tem: " + x);
  assert(/Prioridade:.*Devolução agressiva/.test(await texto()));
  await cap("ar-02-revisao-ia");
  await p.getByRole("button", { name: "Usar este plano", exact: true }).click();
  await espera(/Plano individual · versão 1 · gerado pela IA/);
  assert(/Pré-competitiva/.test(await texto()) && /Competição/.test(await texto()), "fases pelo calendário");
  await cap("ar-02-plano");
  /* registro fora do CT */
  await p.getByRole("button", { name: "Registros", exact: true }).click();
  await p.locator("[data-form-registro-ar]").getByRole("button", { name: "Jogo", exact: true }).click();
  await p.fill('input[aria-label="Minutos"]', "100");
  await p.selectOption('select[aria-label="PSE"]', "8");
  await p.fill('input[aria-label="Adversário"]', "Lia");
  await p.locator("[data-form-registro-ar] input[type=checkbox]").first().check();
  await p.locator("[data-form-registro-ar]").getByRole("button", { name: "Registrar", exact: true }).click();
  await espera(/x Lia/);
  assert(/800 UA/.test(await texto()), "100 min × PSE 8");
  /* meta e medida */
  await p.getByRole("button", { name: "Metas e testes", exact: true }).click();
  await p.selectOption('select[aria-label="Pilar da meta"]', "fisico");
  await p.selectOption('select[aria-label="Teste da meta"]', "t-agil");
  await p.fill('input[aria-label="Descrição da meta"]', "Agilidade abaixo de 4,8 s");
  await p.fill('input[aria-label="Alvo"]', "4.8");
  await p.getByRole("button", { name: "Adicionar meta", exact: true }).click();
  await p.selectOption('select[aria-label="Teste"]', "t-agil");
  await p.fill('input[aria-label="Resultado do teste"]', "4,9");
  await p.getByRole("button", { name: "Registrar medida", exact: true }).click();
  await espera(/atual 4.9/);
  await p.getByRole("button", { name: "Carga", exact: true }).click();
  await espera(/UA = minutos × esforço/);
  await cap("ar-03-carga");

  /* planos de Bia e Caio */
  for (const id of ["j2", "j3"]) {
    await p.click("#voltar"); await espera(/Sessão do dia/);
    await p.locator(`[data-atleta-ar="${id}"] >> text=Abrir`).click();
    await p.getByRole("button", { name: "Plano", exact: true }).click(); await p.getByRole("button", { name: "Gerar sem IA (modelo)", exact: true }).click();
    await p.getByRole("button", { name: "Usar este plano", exact: true }).click(); await espera(/Plano individual · versão 1 · modelo sem IA/);
  }
  await p.click("#voltar"); await espera(/Sessão do dia/);

  /* Sessão do dia */
  await p.getByRole("button", { name: "Sessão do dia", exact: true }).click();
  await espera(/Marque quem está no CT/);
  assert.strictEqual(await p.locator("[data-presenca] input:checked").count(), 3, "os três no CT vêm marcados");
  await p.getByRole("button", { name: "Montar a sessão", exact: true }).click();
  await espera(/Sessão de .* · 120 min/);
  assert(await p.locator('[data-bloco-ar="entrada"]').count() === 1 && await p.locator('[data-bloco-ar="ip:inicio"]').count() === 1 && await p.locator('[data-bloco-ar="jogo"]').count() === 1, "esqueleto MTY");
  if (process.env.MOSTRA) console.log(await p.evaluate(() => [...document.querySelectorAll("[data-bloco-ar]")].map((b) => b.getAttribute("data-bloco-ar") + ": " + b.innerText.replace(/\n/g, " | ")).join("\n")));
  /* rede está pendente nos três planos (IA da Ana e modelo de Bia e Caio): bloco coletivo dos três */
  const rede = p.locator('[data-bloco-ar="tec:rede"]');
  assert.strictEqual(await rede.count(), 1, "bloco coletivo do tema comum (rede)");
  const tRede = await rede.innerText();
  assert(/Ana/.test(tRede) && /Bia/.test(tRede) && /Caio/.test(tRede), tRede);
  /* cartões de exercício como nas outras sessões: ↻ substituir, escolher outro */
  assert(await p.locator("[data-exercicio-ar]").count() >= 5, "cartões de exercício nos blocos e nas tarefas");
  const antes = await rede.locator("[data-exercicio-ar]").first().getAttribute("data-exercicio-ar");
  await rede.getByRole("button", { name: "Substituir exercício" }).first().click();
  await p.waitForTimeout(300);
  const depois = await rede.locator("[data-exercicio-ar]").first().getAttribute("data-exercicio-ar");
  assert(depois && depois !== antes, "↻ trocou o exercício do bloco: " + antes + " → " + depois);
  await rede.getByRole("button", { name: "Escolher outro" }).first().click();
  const sel = rede.locator("select").first(), opcao = await sel.locator("option").nth(1).getAttribute("value");
  await sel.selectOption(opcao); await p.waitForTimeout(300);
  assert.strictEqual(await rede.locator("[data-exercicio-ar]").first().getAttribute("data-exercicio-ar"), opcao, "escolher outro");
  const sesSalva = await p.evaluate(() => JSON.parse(localStorage.getItem("mty:ar:sessoes"))[0]);
  assert.deepStrictEqual(sesSalva.divergencias.map((d) => d.tipo), ["troca", "escolha"], "trocas registradas na sessão");
  assert.strictEqual(await p.locator('[data-bloco-ar="individual"]').count(), 1, "tarefas individuais");
  await cap("ar-04-sessao");
  await p.getByRole("button", { name: "Fechar a sessão", exact: true }).click();
  await espera(/O que cada um realmente fez/);
  await p.selectOption('select[aria-label="PSE de Bia"]', "7");
  await p.locator('[data-fechar-atleta="j3"] input[type=checkbox]').first().uncheck();
  await p.getByRole("button", { name: "Registrar e fechar", exact: true }).click();
  await espera(/Sessão fechada/);
  const regsBia = await p.evaluate(() => JSON.parse(localStorage.getItem("mty:ar:registros:j2") || "[]"));
  assert.strictEqual(regsBia.length, 1); assert.strictEqual(regsBia[0].ua, 840, "120 min × PSE 7"); assert(regsBia[0].conteudosFeitos.length >= 2);
  assert.strictEqual(JSON.parse((await p.evaluate(() => localStorage.getItem("mty:ar:registros:j3"))) || "[]").length, 0, "quem não treinou não gera registro");
  const docBia = await p.evaluate(() => JSON.parse(localStorage.getItem("mty:ar:doc:j2")));
  assert(Object.keys(docBia.progresso.cumpridos).length >= 2, "marcador da Bia atualizado");
  assert.strictEqual(docBia.cargaSemanas[AR.chaveSemana(hoje)].ua, 840);
  await p.locator("text=← Alto rendimento").click();
  await espera(/Sessões no CT/);
  assert(/fechada/.test(await p.locator("[data-sessao-ar]").first().innerText()));
  await cap("ar-05-depois");
  console.log("  A · professor: migração, calendário, plano, registro, meta, sessão do dia e fechamento");

  /* ── A2 · turmas do alto rendimento: montar, editar, sessão da turma e presença ── */
  assert(/Monte uma turma com os atletas que treinam juntos/.test(await texto()));
  await p.getByRole("button", { name: "Nova turma", exact: true }).click();
  await espera(/Quem treina junto no CT/);
  assert.strictEqual(await p.locator("[data-membro]").count(), 3, "só os atletas do alto rendimento entram na lista");
  await p.getByRole("button", { name: "Salvar turma", exact: true }).click();
  await espera(/Dê um nome à turma/);
  await p.fill('input[aria-label="Nome da turma"]', "Juvenil A");
  await p.locator('[data-membro="j1"] input').check(); await p.locator('[data-membro="j2"] input').check();
  await p.selectOption('select[aria-label="Professor responsável"]', "p1");
  await p.fill('input[aria-label="Dias e horário"]', "seg, qua e sex às 14h");
  await p.getByRole("button", { name: "Salvar turma", exact: true }).click();
  await espera(/Turma Juvenil A salva/);
  let cartaoT = p.locator("[data-turma-ar]").first();
  assert(/2 atletas: Ana, Bia/.test(await cartaoT.innerText()) && /Carlos · seg, qua e sex às 14h · nenhuma sessão fechada ainda/.test(await cartaoT.innerText()), await cartaoT.innerText());
  /* editar: entra o Caio */
  await cartaoT.getByRole("button", { name: "Editar", exact: true }).click();
  await espera(/Editar turma/);
  await p.locator('[data-membro="j3"] input').check();
  await p.getByRole("button", { name: "Salvar turma", exact: true }).click();
  await espera(/3 atletas: Ana, Bia, Caio/);
  const turmasSalvas = await p.evaluate(() => JSON.parse(localStorage.getItem("shared:mty:arTurmas:v1")));
  assert.deepStrictEqual([turmasSalvas.length, turmasSalvas[0].membros, turmasSalvas[0].professorNome], [1, ["j1", "j2", "j3"], "Carlos"]);
  /* sessão da turma: presença de quem veio; o Caio faltou */
  await p.locator("[data-turma-ar]").first().getByRole("button", { name: "Sessão da turma", exact: true }).click();
  await espera(/Sessão da turma Juvenil A/);
  assert.strictEqual(await p.locator("[data-presenca] input:checked").count(), 3, "os atletas da turma vêm marcados");
  await p.locator('[data-presenca="j3"] input').uncheck();
  await p.getByRole("button", { name: "Montar a sessão", exact: true }).click();
  await espera(/Turma Juvenil A · .* · 120 min/);
  const sesTurma = await p.evaluate(() => JSON.parse(localStorage.getItem("mty:ar:sessoes")).find((x) => x.turmaId));
  assert.deepStrictEqual([sesTurma.turmaNome, sesTurma.convocados, sesTurma.presentes.slice().sort()], ["Juvenil A", ["j1", "j2", "j3"], ["j1", "j2"]]);
  await p.getByRole("button", { name: "Fechar a sessão", exact: true }).click();
  await espera(/O que cada um realmente fez/);
  await p.getByRole("button", { name: "Registrar e fechar", exact: true }).click();
  await espera(/Sessão fechada/);
  await p.locator("text=← Alto rendimento").click();
  await espera(/1 sessão · presença 67%/);
  cartaoT = p.locator("[data-turma-ar]").first();
  await cartaoT.getByRole("button", { name: "Presença", exact: true }).click();
  assert(/1 de 1 · 100%/.test(await p.locator('[data-presenca-atleta="j1"]').innerText()));
  assert(/0 de 1 · 0% · última falta/.test(await p.locator('[data-presenca-atleta="j3"]').innerText()));
  assert(/presentes: Ana, Bia · faltaram: Caio/.test(await p.locator("[data-presenca-turma]").innerText()), await p.locator("[data-presenca-turma]").innerText());
  assert(/Juvenil A/.test(await p.locator("[data-sessao-ar]").first().innerText()), "a sessão da turma aparece com o nome dela");
  await cap("ar-06-turma");
  /* calendário: editar um torneio já lançado (muda o término, mantém o id) */
  await p.locator('[data-atleta-ar="j1"] >> text=Abrir').click();
  await p.getByRole("button", { name: "Calendário", exact: true }).click();
  const idBr = await p.locator("[data-torneio]", { hasText: "Brasileiro" }).getAttribute("data-torneio");
  await p.locator("[data-torneio]", { hasText: "Brasileiro" }).getByRole("button", { name: "Editar", exact: true }).click();
  await espera(/Editar torneio/);
  await p.fill('input[aria-label="Fim"]', AR.somaDias(hoje, 45));
  await p.getByRole("button", { name: "Salvar torneio", exact: true }).click();
  await espera(/Novo torneio/);
  const calAna = (await p.evaluate(() => JSON.parse(localStorage.getItem("mty:ar:doc:j1")))).calendario.find((x) => x.nome === "Brasileiro");
  assert.deepStrictEqual([calAna.id, calAna.inicio, calAna.fim, calAna.prioridade], [idBr, AR.somaDias(hoje, 35), AR.somaDias(hoje, 45), "principal"], "torneio editado no lugar");
  console.log("  A2 · turmas: montar, editar, sessão da turma, presença; torneio editado com início e término");

  /* ── B · Meu plano do atleta ── */
  await p.goto(base + "/aluno.html?org=team-yoda&id=a1&t=tA");
  await p.waitForSelector("[data-alto-rendimento]", { timeout: 20000 });
  let t = await p.locator("[data-alto-rendimento]").innerText();
  assert(/Em torneio: Copa Sul/.test(t) && /Carga da semana: 0 UA/.test(t), t);
  await p.click("[data-ar-abrir]");
  await p.check('[data-ar-form] input[value="jogo"]');
  await p.fill('[data-ar-form] input[name="minutos"]', "120");
  await p.selectOption('[data-ar-form] select[name="pse"]', "8");
  await p.fill('[data-ar-form] input[name="adversario"]', "Rival");
  const marcados = await p.locator('[data-ar-form] input[name="feito"]').count();
  if (marcados) await p.locator('[data-ar-form] input[name="feito"]').first().check();
  await cap("ar-06-meu-plano");
  await p.click('[data-ar-form] button[type="submit"]');
  await p.waitForSelector("text=Registrado. Entrou na sua carga", { timeout: 15000 });
  t = await p.locator("[data-alto-rendimento]").innerText();
  assert(/Carga da semana: 960 UA/.test(t) && /a confirmar/.test(t), t);
  const regs = Object.keys(store).filter((k) => k.startsWith("orgs/team-yoda/ar/a1/registros/"));
  assert.strictEqual(regs.length, 1); assert.strictEqual(store[regs[0]].autor, "atleta");
  console.log("  B · atleta: semana, carga e registro de jogo fora do CT");

  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  console.log("smoke-alto-rendimento: ok");
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
