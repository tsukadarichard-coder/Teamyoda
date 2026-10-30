/* Team Yoda — equipes de competição e relatório do atleta, no navegador (390 px), com os componentes reais de mty/index.html,
   mty/relatorio-atleta.js e a página do aluno (mty/aluno.html + a function ver-aluno real):
   · criar a equipe (coordenador, auxiliar, atletas) sem plano; situação de cada atleta (ficha, scout, observação, biomecânica);
   · rascunhos do período (torneio) para todos; o relatório junta só o registrado; observação com rascunho da IA (simulada);
   · o coordenador publica, envia pelo WhatsApp (link da página do aluno) e baixa o PDF; o auxiliar só salva o rascunho;
   · a página do aluno mostra o relatório publicado (não o rascunho) e "Gerar relatório" faz o resumo automático;
   · janela de novidades do Team Yoda com os recursos novos em destaque e o atalho "Abrir".
   Rode: node tests/smoke-equipes-relatorio.js [pasta-das-capturas] */
const http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const AULAS_MES_JS=require("fs").readFileSync(require("path").join(__dirname,"../../mty/aulas-mes.js"),"utf8");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const raiz = path.join(__dirname, "../../mty"), fx = path.join(__dirname, "../../netlify/functions/"), capturas = process.argv[2] || "";
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("smoke-equipes-relatorio: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }

const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
const corte = ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
assert(corte > 0);
const corpo = ms.slice(0, corte) + `chamarIA = async (prompt, max, etapa) => { window.__prompt = prompt; etapa && etapa("A IA está escrevendo"); await new Promise((r) => setTimeout(r, 150)); return "Nicolas fez uma boa Copa Verão. Foco: segundo saque."; };
function Host() {
  const [alunos, setAlunos] = useState(() => { try { return JSON.parse(localStorage.getItem("__alunos")) || window.__ini; } catch (e) { return window.__ini; } });
  useEffect(() => { localStorage.setItem("__alunos", JSON.stringify(alunos)); window.__lista = alunos; }, [alunos]);
  const [aba, setAba] = useState(window.__aba || "equipes");
  window.__irPara = setAba;
  return <div style={{ padding: 16 }}>
    {window.__novidades && <JanelaNovidades nomeApp="Team Yoda" versao={NOVIDADES_TY_VERSAO} itens={NOVIDADES_TY} irPara={(v) => setAba(v)} />}
    {aba === "equipes" ? <TelaEquipes alunos={alunos} setAlunos={setAlunos} uidAtual={window.__uid} papelAtual={window.__papel} identidade={{ nomeAcademia: "Team Yoda" }} aoAbrirJogador={(id) => { window.__abriu = id; }} /> : <p data-aba={aba}>{aba}</p>}
  </div>;
}
ReactDOM.createRoot(document.getElementById("root")).render(<Host />);`;
const ALUNOS = [
  { id: "j1", nome: "Nicolas Prado", linkToken: null, horarios: [], registros: [
    { id: "g1", tipo: "jogo", data: "2026-10-10", torneio: "Copa Verão", adversario: "Caio", resultado: "6-4 6-3", scout: { n: 80, pctGanhos: 55, pctPrimeiro: 62, saquesMarcados: 30, df: 2 } },
    { id: "g2", tipo: "jogo", data: "2026-10-11", torneio: "Copa Verão", adversario: "Léo", resultado: "3-6 4-6", scout: { n: 60, pctGanhos: 45 } },
    { id: "o1", tipo: "observacao", contexto: "partida", data: "2026-10-10", torneio: "Copa Verão", resumo: { positivos: "- Boa devolução cruzada", atencao: "- Segundo saque curto", insights: "- Trabalhar profundidade", perguntas: "- Pergunta interna", prioridades: "" } },
  ], movimentos: [{ id: "m1", criadoEm: "2026-10-11T09:00:00Z", golpe: "saque", res: { ok: 8, atencao: 3 }, prio: ["Flexão dos joelhos"] }] },
  { id: "j2", nome: "Pedro Lima", cadastroConcluido: false, horarios: [], registros: [] },
  { id: "j3", nome: "Lia Souza", horarios: [], registros: [] },
];
const PROFS = [{ uid: "u1", nome: "Richard" }, { uid: "u2", nome: "Ana" }];
const STUBS = `window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return "tok123"}};window.db=null;
window.organizacao=async()=>"org1";window.listaProfessores=async()=>${JSON.stringify(PROFS)};
window.storage={get:async(k)=>{const v=localStorage.getItem("st:"+k);return v===null?null:{key:k,value:v};},set:async(k,v)=>{localStorage.setItem("st:"+k,v);return {key:k,value:v};}};
window.__abertas=[];window.open=function(u){const w={u:u,html:"",document:{write:function(h){w.html+=h;},close:function(){}}};window.__abertas.push(w);return w;};`;
const pagina = (q) => `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><div id=root></div>
<script src=/__cdn/r.js></script><script src=/__cdn/d.js></script><script src=/__cdn/p.js></script><script src=/__cdn/c.js></script><script src=/__cdn/b.js></script><script>${AULAS_MES_JS}</script>
<script>${STUBS};window.__ini=${JSON.stringify(ALUNOS)};window.__uid=${JSON.stringify(q.get("uid") || "u1")};window.__papel=${JSON.stringify(q.get("papel") || "professor")};window.__novidades=${q.get("novidades") ? "true" : "false"};</script>
<script src=/scout/graficos.js></script><script src=/scout/ao-vivo.js></script><script src=/scout/relatorio-jogos.js></script><script src=/scout/movimento-motor.js></script><script src=/scout/evidencias.js></script><script src=/scout/movimento.js></script><script src=/obs-voz.js></script><script src=/plano-equipe.js></script><script src=/equipe-rendimento.js></script><script src=/relatorio-atleta.js></script>
<script type="text/babel">${corpo}</script>`;
const CDNS = { "/__cdn/r.js": "/react-18.3.1/package/umd/react.development.js", "/__cdn/d.js": "/react-dom-18.3.1/package/umd/react-dom.development.js", "/__cdn/p.js": "/prop-types-15.8.1/package/prop-types.min.js", "/__cdn/c.js": "/recharts-2.15.4/package/umd/Recharts.js", "/__cdn/b.js": "/babel-standalone-7.29.9/package/babel.min.js" };

/* ver-aluno real com Firestore em memória (a lista de jogadores vem do que o teste salvou no app) */
const dados = {};
const docRef = (k) => ({ get: async () => ({ exists: k in dados, data: () => dados[k] }), set: async (v) => { dados[k] = v; }, collection: () => ({ doc: docRef }) });
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin: { firestore: () => ({ collection: () => ({ doc: () => ({ collection: () => ({ doc: docRef }) }) }) }) }, app: () => {} } };
const verAluno = require(fx + "ver-aluno.js").handler;

const servidor = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x"); let cr = ""; req.on("data", (d) => (cr += d)); await new Promise((r) => req.on("end", r));
  if (u.pathname === "/__t") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return res.end(pagina(u.searchParams)); }
  if (CDNS[u.pathname]) { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(fs.readFileSync(CDN + CDNS[u.pathname])); }
  if (u.pathname === "/.netlify/functions/ver-aluno") { const r = await verAluno({ httpMethod: req.method, headers: req.headers, body: cr || null, queryStringParameters: Object.fromEntries(u.searchParams) }); res.writeHead(r.statusCode, r.headers); return res.end(r.body); }
  const f = path.join(raiz, decodeURIComponent(u.pathname));
  if (!f.startsWith(raiz) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(""); }
  res.writeHead(200, { "content-type": f.endsWith(".html") ? "text/html; charset=utf-8" : f.endsWith(".css") ? "text/css" : "text/javascript" }); res.end(fs.readFileSync(f));
});
(async () => {
  await new Promise((r) => servidor.listen(0, r)); const base = "http://localhost:" + servidor.address().port;
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route("https://www.gstatic.com/**", (r) => r.fulfill({ contentType: "text/javascript", body: "" }));
  await ctx.route("https://cdn.jsdelivr.net/**", (r) => r.fulfill({ contentType: "text/javascript", body: "" }));
  const p = await ctx.newPage(); const erros = []; p.on("pageerror", (e) => erros.push(e.message));
  const cap = async (n) => { if (capturas) await p.screenshot({ path: path.join(capturas, n + ".png"), fullPage: true }); };
  const lista = () => p.evaluate(() => window.__lista);

  /* criar a equipe */
  await p.goto(base + "/__t?uid=u1"); await p.waitForSelector("[data-equipes]", { timeout: 120000 });
  await p.click("text=Nova equipe"); await p.waitForSelector("[data-form-equipe]");
  await p.fill('[aria-label="Nome da equipe"]', "Juvenil competição");
  await p.selectOption('[aria-label="Coordenador"]', "u1");
  await p.click('[data-form-equipe] label:has-text("Ana")');
  await p.click('[data-atleta-opcao]:has-text("Nicolas Prado")'); await p.click('[data-atleta-opcao]:has-text("Pedro Lima")');
  await p.click("text=Salvar equipe"); await p.waitForSelector("[data-equipe-aberta]");
  let t = await p.evaluate(() => document.body.innerText);
  assert(/Coordenador: Richard · Auxiliares: Ana/.test(t), "coordenador e auxiliar");
  const nic = p.locator('[data-atleta-equipe="Nicolas Prado"]'), ped = p.locator('[data-atleta-equipe="Pedro Lima"]');
  assert(/Ficha completa/.test(await nic.innerText()) && /Scout 11\/10/.test(await nic.innerText()) && /Observação 10\/10/.test(await nic.innerText()) && /Biomecânica 11\/10/.test(await nic.innerText()), "situação do Nicolas");
  assert(/Ficha incompleta/.test(await ped.innerText()) && /Sem scout/.test(await ped.innerText()), "situação do Pedro");
  await ped.locator("text=Abrir ficha").click(); assert.strictEqual(await p.evaluate(() => window.__abriu), "j2");

  /* rascunhos do torneio para todos */
  await p.selectOption('[data-relatorios-equipe] [aria-label="Tipo de período"]', "torneio");
  assert.strictEqual(await p.inputValue('[data-relatorios-equipe] [aria-label="Torneio"]'), "Copa Verão");
  await p.click("text=Gerar rascunhos para todos"); await p.waitForSelector("text=Rascunhos prontos para 2 atleta(s)");
  let l = await lista();
  assert(l[0].relatoriosAtleta.length === 1 && l[1].relatoriosAtleta.length === 1 && l[0].relatoriosAtleta[0].status === "rascunho", "um rascunho por atleta");
  assert.deepStrictEqual([l[0].relatoriosAtleta[0].dados.numeros.jogos, l[0].relatoriosAtleta[0].dados.numeros.movimentos], [2, 1]);
  await cap("equipe-01");

  /* relatório do Nicolas: prévia, rascunho da IA, publicar, WhatsApp e PDF */
  await nic.locator("text=Abrir relatório").click(); await p.waitForSelector("[data-relatorio-editor]");
  t = await p.locator("[data-previa-relatorio]").innerText();
  assert(/Copa Verão · 10\/10\/2026 a 11\/10\/2026/.test(t) && /Boa devolução cruzada/.test(t) && /Segundo saque curto/.test(t) && /Trabalhar profundidade/.test(t) && /Saque · 11\/10\/2026/.test(t) && !/Pergunta interna/.test(t), "prévia com o registrado: " + t);
  await p.click("text=Rascunho com IA");
  await p.waitForFunction(() => /boa Copa Verão/.test(document.querySelector('[aria-label="Observação do treinador"]').value));
  const prompt = await p.evaluate(() => window.__prompt);
  assert(/SOMENTE/.test(prompt) && /Copa Verão/.test(prompt) && /Boa devolução cruzada/.test(prompt) && !/Pergunta interna/.test(prompt), "a IA recebe só os dados");
  await p.fill('[aria-label="Observação do treinador"]', "Nicolas competiu com coragem. Foco: segundo saque.");
  await cap("equipe-02-editor");
  await p.click("text=Publicar para o aluno"); await p.waitForSelector("[data-relatorio-publicado]");
  l = await lista();
  const pub = l[0].relatoriosAtleta[0];
  assert(pub.status === "publicado" && pub.publicadoPor === "Richard" && pub.observacao === "Nicolas competiu com coragem. Foco: segundo saque.", "publicado");
  await p.click("text=Enviar pelo WhatsApp");
  await p.waitForFunction(() => window.__abertas.length > 0);
  const zap = decodeURIComponent((await p.evaluate(() => window.__abertas[0].u)).split("text=")[1]);
  assert(/relatório de Nicolas \(Copa Verão/.test(zap) && /\/aluno\.html\?org=org1&id=j1&t=tok123/.test(zap), "WhatsApp com o link da página do aluno: " + zap);
  assert.strictEqual((await lista())[0].linkToken, "tok123", "chave do link criada");
  await p.click("text=Baixar PDF");
  const doc = await p.evaluate(() => window.__abertas[1].html);
  assert(/Observação do treinador/.test(doc) && /competiu com coragem/.test(doc) && /window\.print/.test(doc), "PDF");

  /* auxiliar: abre e salva rascunho, não publica */
  await p.goto(base + "/__t?uid=u2"); await p.waitForSelector("[data-equipes]", { timeout: 120000 });
  await p.click("[data-equipe-card]"); await p.waitForSelector("[data-equipe-aberta]");
  await p.locator('[data-atleta-equipe="Pedro Lima"]').locator("text=Relatório do período").click(); await p.waitForSelector("[data-relatorio-editor]");
  t = await p.evaluate(() => document.body.innerText);
  assert(/Quem publica é o coordenador da equipe\./.test(t) && !/Publicar para o aluno/.test(t), "auxiliar não publica");
  await p.fill('[aria-label="Observação do treinador"]', "Rascunho da Ana"); await p.click("text=Salvar rascunho");
  l = await lista();
  assert(l[1].relatoriosAtleta.some((r) => r.observacao === "Rascunho da Ana" && r.autorNome === "Ana" && r.status === "rascunho"), "rascunho do auxiliar");

  /* página do aluno: o publicado aparece; o rascunho não; "Gerar relatório" automático */
  dados["mty:alunos:v2"] = { value: JSON.stringify((await lista()).map((a) => ({ ...a, linkToken: a.linkToken || "x" + a.id }))) };
  await p.goto(base + "/aluno.html?org=org1&id=j1&t=tok123"); await p.waitForSelector('[data-painel="relatorios-atleta"]', { timeout: 20000 });
  t = await p.locator('[data-painel="relatorios-atleta"]').innerText();
  assert(/Relatórios do treinador/.test(t) && /Copa Verão/.test(t) && /por Richard/.test(t), "relatório publicado na página do aluno");
  await p.click("[data-rel-ver]"); await p.waitForSelector('[data-painel="relatorios-atleta"] .rel-obs');
  assert(/competiu com coragem/.test(await p.locator('[data-painel="relatorios-atleta"]').innerText()));
  await p.selectOption("[data-gerar-periodo]", "tudo"); await p.click("[data-gerar-rel]"); await p.waitForSelector("[data-relatorio-gerado]");
  assert(/sem a observação do treinador/.test(await p.locator("[data-relatorio-gerado]").innerText()), "resumo automático identificado");
  await cap("equipe-03-aluno");
  await p.goto(base + "/aluno.html?org=org1&id=j2&t=xj2"); await p.waitForSelector('[data-painel="relatorios-atleta"]', { timeout: 20000 });
  assert(!/Rascunho da Ana/.test(await p.evaluate(() => document.body.innerText)), "rascunho não aparece para o aluno");

  /* excluir a equipe: o auxiliar não pode; o coordenador exclui (com confirmação) e os relatórios ficam na ficha do atleta */
  await p.goto(base + "/__t?uid=u2"); await p.waitForSelector("[data-equipe-card]", { timeout: 120000 });
  await p.click("[data-equipe-card]"); await p.click("text=Editar equipe");
  assert(/Só o coordenador da equipe pode excluí-la/.test(await p.locator("[data-excluir-equipe]").innerText()), "auxiliar não exclui");
  await p.goto(base + "/__t?uid=u1"); await p.waitForSelector("[data-equipe-card]", { timeout: 120000 });
  await p.click("[data-equipe-card]"); await p.click("text=Editar equipe");
  p.once("dialog", (d) => d.dismiss()); await p.click("text=Excluir equipe"); await p.waitForTimeout(200);
  assert.strictEqual(await p.locator("[data-form-equipe]").count(), 1, "cancelar a confirmação não exclui");
  p.once("dialog", (d) => d.accept()); await p.click("text=Excluir equipe");
  await p.waitForSelector("[data-equipes]"); await p.waitForTimeout(200);
  assert.strictEqual(await p.locator("[data-equipe-card]").count(), 0, "equipe excluída");
  assert.deepStrictEqual(await p.evaluate(() => JSON.parse(localStorage.getItem("st:mty:equipes:v1"))), [], "lista salva vazia");
  assert((await lista())[0].relatoriosAtleta.length >= 1, "relatórios do atleta continuam");

  /* novidades em destaque, com atalho */
  await p.goto(base + "/__t?uid=u1&novidades=1"); await p.waitForSelector("[data-novidades]", { timeout: 120000 });
  assert(await p.locator("[data-novidade-nova]").count() >= 5 && /Já disponível no Team Yoda/.test(await p.locator("[data-novidades]").innerText()), "novidades em destaque");
  await cap("equipe-04-novidades");
  await p.locator('[data-novidade-nova]:has-text("Relatório do aluno") >> text=Abrir').click();
  await p.waitForSelector('[data-aba="alunos"]'); assert.strictEqual(await p.locator("[data-novidades]").count(), 0);
  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  console.log("smoke-equipes-relatorio: ok");
  await browser.close(); servidor.close();
})().catch((e) => { console.error(e); servidor.close(); process.exit(1); });
