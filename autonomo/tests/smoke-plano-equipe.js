/* Team Yoda — planejamento da equipe de competição, no navegador (390 px), com os componentes reais de mty/index.html,
   mty/plano-equipe.js, mty/relatorio-atleta.js e a página do aluno (mty/aluno.html + a function ver-aluno real):
   · o coordenador cria o ciclo (explicação de 4/8/12 semanas, início, dias, duração, grupo, objetivo), sem IA;
   · preenche o semanal (grupo, itens, observação), o mensal e o diário (copiar a semana para os dias, observação do dia);
   · o auxiliar só vê; o resumo aparece na equipe; os rascunhos de relatório levam o planejamento do período;
   · fechar o planejamento: visão geral com gráficos, semanal com os dias por grupo, diário; só fechado vai para os atletas;
   · avaliação ao final da sessão (nota da sessão, presença, rendimento, nota por item, observação), aba Rendimento e relatório do ciclo;
   · aba Equipe na ficha do jogador e o painel "Planejamento da equipe" na página do aluno.
   Rode: node tests/smoke-plano-equipe.js [pasta-das-capturas] */
const http = require("http"), fs = require("fs"), path = require("path"), assert = require("assert");
const AULAS_MES_JS=require("fs").readFileSync(require("path").join(__dirname,"../../mty/aulas-mes.js"),"utf8");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const raiz = path.join(__dirname, "../../mty"), fx = path.join(__dirname, "../../netlify/functions/"), capturas = process.argv[2] || "";
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("smoke-plano-equipe: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }

const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
const corte = ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
assert(corte > 0);
const corpo = ms.slice(0, corte) + `chamarIA = async () => { window.__usouIA = true; return ""; };
function Host() {
  const [alunos, setAlunos] = useState(() => { try { return JSON.parse(localStorage.getItem("__alunos")) || window.__ini; } catch (e) { return window.__ini; } });
  useEffect(() => { localStorage.setItem("__alunos", JSON.stringify(alunos)); window.__lista = alunos; }, [alunos]);
  return <div style={{ padding: 16 }}>
    {window.__aba === "jogador" ? <AbaEquipeJogador aluno={alunos[0]} aoAbrirEquipes={() => { window.__foiEquipes = true; }} />
      : <TelaEquipes alunos={alunos} setAlunos={setAlunos} uidAtual={window.__uid} papelAtual="professor" identidade={{ nomeAcademia: "Team Yoda" }} aoAbrirJogador={() => {}} />}
  </div>;
}
ReactDOM.createRoot(document.getElementById("root")).render(<Host />);`;

/* datas no fuso de São Paulo: a segunda desta semana é o início do ciclo, então "esta semana" é a semana 1 */
const hoje = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const somar = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const segunda = somar(hoje, -((new Date(hoje + "T12:00:00Z").getUTCDay() + 6) % 7));
const mesHoje = hoje.slice(0, 7);

const ALUNOS = [
  { id: "j1", nome: "Nicolas Prado", linkToken: "tok1", horarios: [], registros: [] },
  { id: "j2", nome: "Pedro Lima", linkToken: "tok2", horarios: [], registros: [] },
  { id: "j3", nome: "Lia Souza", linkToken: "tok3", horarios: [], registros: [] },
];
const EQUIPES = [{ id: "eq1", nome: "Juvenil competição", coordenadorUid: "u1", coordenadorNome: "Richard", auxiliares: [{ uid: "u2", nome: "Ana" }], membros: ["j1", "j2"], criadoEm: "2026-10-01T10:00:00Z" }];
const PROFS = [{ uid: "u1", nome: "Richard" }, { uid: "u2", nome: "Ana" }];
const STUBS = `window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return "tok123"}};window.db=null;
window.organizacao=async()=>"org1";window.listaProfessores=async()=>${JSON.stringify(PROFS)};
if(!localStorage.getItem("st:mty:equipes:v1"))localStorage.setItem("st:mty:equipes:v1",${JSON.stringify(JSON.stringify(EQUIPES))});
window.storage={get:async(k)=>{const v=localStorage.getItem("st:"+k);return v===null?null:{key:k,value:v};},set:async(k,v)=>{localStorage.setItem("st:"+k,v);return {key:k,value:v};}};
window.__abertas=[];window.open=function(){const w={html:"",document:{write(h){w.html+=h;},close(){}}};window.__abertas.push(w);return w;};`;
const pagina = (q) => `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><div id=root></div>
<script src=/__cdn/r.js></script><script src=/__cdn/d.js></script><script src=/__cdn/p.js></script><script src=/__cdn/c.js></script><script src=/__cdn/b.js></script><script>${AULAS_MES_JS}</script>
<script>${STUBS};window.__ini=${JSON.stringify(ALUNOS)};window.__uid=${JSON.stringify(q.get("uid") || "u1")};window.__aba=${JSON.stringify(q.get("aba") || "")};</script>
<script src=/scout/graficos.js></script><script src=/scout/ao-vivo.js></script><script src=/scout/relatorio-jogos.js></script><script src=/scout/movimento-motor.js></script><script src=/scout/evidencias.js></script><script src=/scout/movimento.js></script><script src=/obs-voz.js></script><script src=/plano-equipe.js></script><script src=/equipe-rendimento.js></script><script src=/relatorio-atleta.js></script>
<script type="text/babel">${corpo}</script>`;
const CDNS = { "/__cdn/r.js": "/react-18.3.1/package/umd/react.development.js", "/__cdn/d.js": "/react-dom-18.3.1/package/umd/react-dom.development.js", "/__cdn/p.js": "/prop-types-15.8.1/package/prop-types.min.js", "/__cdn/c.js": "/recharts-2.15.4/package/umd/Recharts.js", "/__cdn/b.js": "/babel-standalone-7.29.9/package/babel.min.js" };

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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: "America/Sao_Paulo" });
  await ctx.route("https://www.gstatic.com/**", (r) => r.fulfill({ contentType: "text/javascript", body: "" }));
  await ctx.route("https://cdn.jsdelivr.net/**", (r) => r.fulfill({ contentType: "text/javascript", body: "" }));
  const p = await ctx.newPage(); const erros = []; p.on("pageerror", (e) => erros.push(e.message));
  const cap = async (n) => { if (capturas) await p.screenshot({ path: path.join(capturas, n + ".png"), fullPage: true }); };
  const equipes = () => p.evaluate(() => JSON.parse(localStorage.getItem("st:mty:equipes:v1")));
  const plano = async () => (await equipes())[0].plano;
  const semEsperar = async () => p.waitForTimeout(60);

  /* coordenador: criar o ciclo */
  await p.goto(base + "/__t?uid=u1"); await p.waitForSelector("[data-equipes]", { timeout: 120000 });
  await p.click("[data-equipe-card]"); await p.waitForSelector("[data-planejamento-equipe]");
  assert(/Monte o ciclo da equipe/.test(await p.locator("[data-planejamento-equipe]").innerText()));
  await p.click("text=Criar planejamento"); await p.waitForSelector("[data-config-ciclo]");
  assert(/Ciclo curto/.test(await p.locator("[data-explicacao-ciclo]").innerText()), "4 semanas explicado");
  await p.click('[data-config-ciclo] button:has-text("8 semanas")');
  assert(/Dois blocos de 4/.test(await p.locator("[data-explicacao-ciclo]").innerText()), "8 semanas explicado");
  await p.click('[data-config-ciclo] button:has-text("12 semanas")');
  assert(/torneio-alvo/.test(await p.locator("[data-explicacao-ciclo]").innerText()), "12 semanas explicado");
  await p.click('[data-config-ciclo] button:has-text("Personalizado")');
  await p.fill('[aria-label="Número de semanas"]', "6"); assert(/1 a 24/.test(await p.locator("[data-explicacao-ciclo]").innerText()));
  await p.click('[data-config-ciclo] button:has-text("4 semanas")');
  await p.fill('[aria-label="Início do ciclo"]', segunda);
  await p.fill('[aria-label="Duração da sessão"]', "75");
  await p.click('[data-config-ciclo] button:text-is("Sex")'); await p.click('[data-config-ciclo] button:text-is("Sáb")');
  await p.click('[data-config-ciclo] [role="radio"]:has-text("Misto")');
  await p.fill('[aria-label="Objetivo do ciclo"]', "Preparar a Copa Verão");
  assert(/4 semanas · 3 dias de treino por semana/.test(await p.locator("[data-config-ciclo]").innerText()), "resumo do ciclo antes de criar");
  await cap("plano-01-ciclo");
  await p.click("text=Criar o planejamento"); await p.waitForSelector("[data-resumo-ciclo]");
  let pl = await plano();
  assert.deepStrictEqual([pl.ciclo.semanas, pl.ciclo.inicio, pl.ciclo.fim, pl.ciclo.dias, pl.ciclo.duracaoMin, pl.ciclo.grupo, pl.ciclo.objetivo], [4, segunda, somar(segunda, 27), [1, 3, 6], 75, "misto", "Preparar a Copa Verão"]);
  assert.deepStrictEqual(pl.semanas[0].dias.map((d) => d.data), [segunda, somar(segunda, 2), somar(segunda, 5)], "seg, qua e sáb");
  assert(/semana 1 de 4/.test(await p.locator("[data-resumo-ciclo]").innerText()));
  assert.strictEqual(await p.evaluate(() => !!window.__usouIA), false, "sem IA");

  /* semanal: grupo, itens e observação da semana 1 (a desta semana, já aberta) */
  const s1 = p.locator('[data-semana-eq="1"]');
  assert(/esta semana/.test(await s1.innerText()));
  await s1.locator('[role="radio"]:text-is("Técnico")').click(); await semEsperar();
  await s1.locator('button[aria-pressed]:has-text("Saque")').click(); await semEsperar();
  await s1.locator('button[aria-pressed]:has-text("Movimentação")').click(); await semEsperar();
  await s1.locator('button[aria-pressed]:has-text("Construção")').click(); await semEsperar();
  await p.fill('[aria-label="Observações da semana 1"]', "Base do saque e deslocamento"); await p.locator("[data-resumo-ciclo]").click(); await semEsperar();
  pl = await plano();
  assert.deepStrictEqual([pl.semanas[0].grupo, pl.semanas[0].itens, pl.semanas[0].obs], ["tecnico", ["saque", "movimentacao", "construcao"], "Base do saque e deslocamento"]);
  assert(/Técnico · Movimentação, Saque, Construção/.test(await s1.innerText()), "resumo na ordem da classificação");
  await cap("plano-02-semanal");

  /* mensal */
  await p.click('[role="tab"]:has-text("Mensal")');
  const m = p.locator(`[data-mes="${mesHoje}"]`);
  await m.locator('[role="radio"]:text-is("Tático")').click(); await semEsperar();
  await m.locator("textarea").fill("Mês de base técnica"); await p.locator("[data-resumo-ciclo]").click(); await semEsperar();
  pl = await plano();
  assert.deepStrictEqual([pl.meses[mesHoje].grupo, pl.meses[mesHoje].obs], ["tatico", "Mês de base técnica"]);
  assert(/Semana 1 .*Técnico · Movimentação, Saque, Construção/.test(await m.innerText()), "o mês lista as semanas");

  /* diário: copiar a semana para os dias e observação de um dia */
  await p.click('[role="tab"]:has-text("Semanal")'); await s1.locator("text=Ver os 3 dias de treino").click();
  await p.waitForSelector("[data-dia-eq]");
  await p.click("text=Copiar a semana para os dias vazios"); await semEsperar();
  const d1 = p.locator(`[data-dia-eq="${segunda}"]`);
  await d1.locator('button[aria-pressed]:has-text("Construção")').click(); await semEsperar();
  await d1.locator('button[aria-pressed]:has-text("Precisão")').click(); await semEsperar();
  await d1.locator("textarea").fill("Cestos de saque com alvo"); await p.locator("[data-resumo-ciclo]").click(); await semEsperar();
  pl = await plano();
  assert.deepStrictEqual([pl.semanas[0].dias[0].grupo, pl.semanas[0].dias[0].itens, pl.semanas[0].dias[0].obs], ["tecnico", ["saque", "movimentacao", "precisao"], "Cestos de saque com alvo"]);
  assert.deepStrictEqual([pl.semanas[0].dias[1].grupo, pl.semanas[0].dias[1].itens], ["tecnico", ["saque", "movimentacao", "construcao"]], "o dia vazio recebe a semana");
  assert.strictEqual(pl.semanas[1].dias[0].grupo, "", "a semana 2 continua vazia");
  assert(/75 min/.test(await d1.innerText()));
  await cap("plano-03-diario");

  /* editar o ciclo para 8 semanas mantém o que foi escrito */
  await p.click("text=Editar ciclo"); await p.click('[data-config-ciclo] button:has-text("8 semanas")'); await p.click("text=Salvar o ciclo");
  await p.waitForSelector("[data-resumo-ciclo]");
  pl = await plano();
  assert(pl.semanas.length === 8 && pl.semanas[0].obs === "Base do saque e deslocamento" && pl.semanas[0].dias[0].obs === "Cestos de saque com alvo", "ciclo maior mantém o escrito");
  assert.strictEqual(pl.status, "rascunho", "começa como rascunho");

  /* fechar: vira a visão com gráficos (geral, semanal com os dias por grupo, diário) */
  assert(/Rascunho · só a comissão vê/.test(await p.locator("[data-status-plano]").innerText()));
  p.once("dialog", (d) => d.accept());
  await p.click("text=Fechar planejamento"); await p.waitForSelector("text=Reabrir para editar");
  pl = await plano(); assert(pl.status === "fechado" && pl.fechadoEm && pl.semanas[0].obs === "Base do saque e deslocamento", "fechado, sem perder nada");
  assert(/Fechado em .* visível para os atletas/.test(await p.locator("[data-status-plano]").innerText()));
  await p.click('[role="tab"]:has-text("Geral")'); await p.waitForSelector("[data-vista-geral] [data-visao-geral]");
  let tg = await p.locator("[data-vista-geral]").innerText();
  assert(/24\s*sessões de treino/.test(tg) && /30 h\s*de treino planejado/.test(tg) && /Sessões por grupo em cada semana/.test(tg) && /O que o ciclo trabalha/.test(tg) && /Mês de base técnica/.test(tg), "visão geral: " + tg.slice(0, 300));
  assert(await p.locator("[data-vista-geral] [data-grafico]").count() >= 2);
  await cap("plano-06-geral");
  await p.click('[role="tab"]:has-text("Semanal")');
  assert(await p.locator('[data-semana-eq="1"] [data-dias-semana]').count() === 1 && await p.locator("[data-plano-equipe] textarea").count() === 0, "semanal fechado: dias por grupo e sem edição");
  await p.click('[role="tab"]:has-text("Diário")'); await p.waitForSelector(`[data-dia-eq="${segunda}"]`);

  /* avaliar a sessão de segunda */
  await p.locator(`[data-dia-eq="${segunda}"]`).locator("text=Avaliar sessão").click(); await p.waitForSelector("[data-avaliacao-sessao]");
  await p.click('[aria-label="Nota da sessão"] [role="radio"]:text-is("4")');
  await p.fill('[aria-label="Observações da sessão"]', "Boa intensidade");
  const avN = p.locator('[data-avaliar-atleta="Nicolas Prado"]'), avP = p.locator('[data-avaliar-atleta="Pedro Lima"]');
  await avN.locator('[aria-label="Rendimento de Nicolas Prado"] [role="radio"]:text-is("4")').click();
  await avN.locator("text=Notas por item").click();
  await avN.locator('[aria-label="Saque de Nicolas Prado"] [role="radio"]:text-is("5")').click();
  await avN.locator('[aria-label="Observação sobre Nicolas Prado"]').fill("Ótimo saque");
  await avP.locator('[role="radio"]:has-text("Faltou")').click();
  assert(/1 de 2 presentes · 1 com nota de rendimento/.test(await p.locator("[data-avaliacao-sessao]").innerText()));
  assert.strictEqual(await avP.locator('[aria-label="Rendimento de Pedro Lima"]').count(), 0, "quem faltou não recebe nota");
  await cap("plano-07-avaliar");
  await p.click("text=Salvar avaliação"); await p.waitForSelector(`[data-dia-eq="${segunda}"] >> text=Editar avaliação`);
  pl = await plano(); const av = pl.avaliacoes[segunda];
  assert.deepStrictEqual([av.nota, av.obs, av.atletas.j1.nota, av.atletas.j1.itens, av.atletas.j1.obs, av.atletas.j2.presente, av.autorNome], [4, "Boa intensidade", 4, { saque: 5 }, "Ótimo saque", false, "Richard"]);
  assert(/Avaliada · Sessão 4\/5 · 1\/2 presentes · rendimento 4,0/.test(await p.locator(`[data-dia-eq="${segunda}"]`).innerText()));

  /* aba Rendimento e o relatório do ciclo */
  await p.click('[role="tab"]:has-text("Rendimento")'); await p.waitForSelector("[data-vista-rendimento] [data-rendimento]");
  const tr = await p.locator("[data-vista-rendimento]").innerText();
  assert(/50%/.test(tr) && /4,0/.test(tr) && /Rendimento médio por semana/.test(tr) && /Rendimento por item/.test(tr) && /Nicolas Prado/.test(tr) && /Presença 0 de 1/.test(tr), "rendimento: " + tr.slice(0, 400));
  await cap("plano-08-rendimento");
  await p.click("text=Gerar relatório parcial do ciclo");
  const docCiclo = await p.evaluate(() => window.__abertas[window.__abertas.length - 1].html);
  assert(/Relatório do ciclo · Juvenil competição/.test(docCiclo) && /Relatório parcial/.test(docCiclo) && /Boa intensidade/.test(docCiclo) && /Ótimo saque/.test(docCiclo) && /Sessões por grupo em cada semana/.test(docCiclo), "relatório do ciclo");

  /* de volta à equipe: resumo e o planejamento entra no rascunho do relatório do mês */
  await p.click("text=‹ Voltar à equipe"); await p.waitForSelector("[data-planejamento-equipe]");
  const tpe = await p.locator("[data-planejamento-equipe]").innerText();
  assert(/semana 1: Técnico · Movimentação, Saque, Construção/.test(tpe) && /Fechado · visível para os atletas/.test(tpe) && await p.locator("[data-sessoes-pendentes]").count() === 1, "cartão da equipe: " + tpe);
  await p.click("text=Gerar rascunhos para todos"); await p.waitForSelector("text=Rascunhos prontos para 2 atleta(s)");
  const lista = await p.evaluate(() => window.__lista);
  const rel = lista[0].relatoriosAtleta[0].dados;
  assert(rel.planejamento && rel.planejamento.length === 1 && rel.planejamento[0].equipe === "Juvenil competição", "planejamento no relatório");
  await p.locator('[data-atleta-equipe="Nicolas Prado"]').locator("text=Abrir relatório").click(); await p.waitForSelector("[data-previa-relatorio]");
  const previa = await p.locator("[data-previa-relatorio]").innerText();
  assert(/Planejamento da equipe · Juvenil competição/.test(previa) && /Cestos de saque com alvo/.test(previa), "prévia do relatório com o planejamento");
  assert(/Rendimento nos treinos · Juvenil competição/.test(previa) && /Ótimo saque/.test(previa) && rel.rendimento[0].media === 4, "rendimento no relatório do atleta");

  /* auxiliar: só vê */
  await p.goto(base + "/__t?uid=u2"); await p.waitForSelector("[data-equipes]", { timeout: 120000 });
  await p.click("[data-equipe-card]"); await p.click("text=Abrir planejamento"); await p.waitForSelector("[data-resumo-ciclo]");
  let t = await p.evaluate(() => document.body.innerText);
  assert(/Só o coordenador da equipe edita o planejamento/.test(t) && !/Editar ciclo/.test(t) && await p.locator("[data-plano-equipe] textarea").count() === 0, "auxiliar só lê");
  assert(/Você pode avaliar as sessões/.test(t) && /Sessões por grupo em cada semana/.test(t), "auxiliar abre na visão geral");
  await p.click('[role="tab"]:has-text("Semanal")');
  assert(/Base do saque e deslocamento/.test(await p.locator('[data-semana-eq="1"]').innerText()));
  await p.click('[role="tab"]:has-text("Diário")');
  assert.strictEqual(await p.locator(`[data-dia-eq="${segunda}"] >> text=Editar avaliação`).count(), 1, "auxiliar avalia");

  /* aba Equipe na ficha do jogador */
  await p.goto(base + "/__t?uid=u1&aba=jogador"); await p.waitForSelector("[data-aba-equipe]", { timeout: 120000 });
  await p.waitForSelector("[data-aba-equipe] >> text=Esta semana");
  t = await p.locator("[data-aba-equipe]").innerText();
  assert(/Juvenil competição/.test(t) && /coord\. Richard/.test(t) && /Cestos de saque com alvo/.test(t) && !/Todas as semanas/.test(t), "aba do jogador: " + t);
  await p.click("text=Ver o ciclo inteiro");
  t = await p.locator("[data-aba-equipe]").innerText();
  assert(/TODAS AS SEMANAS|Todas as semanas/i.test(t) && /Mês de base técnica/.test(t) && /Semana 8/.test(t));
  assert(/Presença 1 de 1 \(100%\) · média 4,0/.test(await p.locator("[data-rendimento-jogador]").innerText()) && /Ótimo saque/.test(await p.locator("[data-rendimento-jogador]").innerText()), "rendimento na ficha");
  await cap("plano-04-ficha");

  /* página do aluno: membro vê; quem não é da equipe não vê */
  dados["mty:alunos:v2"] = { value: JSON.stringify(ALUNOS) };
  dados["mty:equipes:v1"] = { value: JSON.stringify(await p.evaluate(() => JSON.parse(localStorage.getItem("st:mty:equipes:v1")))) };
  await p.goto(base + "/aluno.html?org=org1&id=j1&t=tok1"); await p.waitForSelector('[data-painel="plano-equipe"]', { timeout: 20000 });
  t = await p.locator('[data-painel="plano-equipe"]').innerText();
  assert(/Planejamento da equipe/.test(t) && /Juvenil competição/.test(t) && /Esta semana/i.test(t) && /Cestos de saque com alvo/.test(t) && /Preparar a Copa Verão/.test(t), "painel do aluno: " + t);
  assert(!/Ótimo saque|Boa intensidade/.test(await p.evaluate(() => document.body.innerText)), "as avaliações não aparecem no link");
  await p.click("[data-plano-equipe-ver]");
  assert(/Todas as semanas/i.test(await p.locator('[data-painel="plano-equipe"]').innerText()));
  await cap("plano-05-aluno");
  await p.goto(base + "/aluno.html?org=org1&id=j3&t=tok3"); await p.waitForSelector('[data-painel="relatorios-atleta"]', { timeout: 20000 });
  assert.strictEqual(await p.locator('[data-painel="plano-equipe"]').count(), 0, "fora da equipe não vê");
  /* rascunho não vai para o link */
  dados["mty:equipes:v1"] = { value: JSON.stringify(JSON.parse(dados["mty:equipes:v1"].value).map((e) => ({ ...e, plano: { ...e.plano, status: "rascunho" } }))) };
  await p.goto(base + "/aluno.html?org=org1&id=j1&t=tok1"); await p.waitForSelector('[data-painel="relatorios-atleta"]', { timeout: 20000 });
  assert.strictEqual(await p.locator('[data-painel="plano-equipe"]').count(), 0, "rascunho não aparece para o aluno");
  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  console.log("smoke-plano-equipe: ok");
  await browser.close(); servidor.close();
})().catch((e) => { console.error(e); servidor.close(); process.exit(1); });
