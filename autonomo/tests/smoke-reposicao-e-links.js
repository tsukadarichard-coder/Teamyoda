/* Reposição para qualquer aluno ou turma e link do aluno dentro da turma, com os componentes reais do app em React/Babel locais:
   · Team Yoda: "+ Nova reposição" em Reposições cria a reposição para um aluno e para uma turma; "Desmarcar" cancela;
   · Team Yoda: "Gerar link" de um jogador na aba Evolução da turma funciona (antes quebrava: a aba não recebia a lista de jogadores);
   · QuadraLab (treinador): "+ Reposição" na Agenda marca uma reposição só naquela data, para jogador ou turma.
   Defina CDN_DIR (padrão: scratchpad/cdn). Rode: node tests/smoke-reposicao-e-links.js [pasta-das-capturas] */
const fs = require("fs"), path = require("path"), http = require("http");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const assert = require("assert");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("smoke-reposicao-e-links: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const capturas = process.argv[2] || "";
const LIB = { "/r.js": CDN + "/react-18.3.1/package/umd/react.development.js", "/d.js": CDN + "/react-dom-18.3.1/package/umd/react-dom.development.js", "/p.js": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "/c.js": CDN + "/recharts-2.15.4/package/umd/Recharts.js", "/b.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js" };
const SCOUT = ["graficos.js", "ao-vivo.js", "relatorio-jogos.js", "movimento-motor.js", "evidencias.js", "movimento-arquivo.js", "movimento.js", "video-segmentador.js", "video-audio.js", "video-scout.js", "video-visao.js", "video-scout-ui.js", "quadra-auto.js", "padroes.js", "video-jogo.js"];

function servir(app, montagem) {
  const raiz = path.join(__dirname, "..", app === "mty" ? "../mty" : ".");
  const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
  const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
  const corte = ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
  assert(corte > 0, app + ": ponto de montagem não encontrado");
  const corpo = `async function listaProfessores(){return [{uid:"p1",nome:"Carlos"},{uid:"p2",nome:"Marina"}];}
async function organizacao(){return "demo";} var db=null, auth=null;
` + ms.slice(0, corte) + `
window.mtyAuth={entrar:async()=>{},usuario:()=>null};
${montagem}`;
  const pagina = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><script src="https://cdn.tailwindcss.com"></script><div id=root style="padding:16px"></div>
<script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return "tok" + Math.random().toString(36).slice(2,10)}};</script>
<script src=/sync-listas.js></script>${SCOUT.map((f) => "<script src=/scout/" + f + "></script>").join("")}
<script type="text/babel">${corpo}</script>`;
  return http.createServer((q, r) => {
    const u = q.url.split("?")[0];
    if (u === "/") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(pagina); }
    if (LIB[u]) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(LIB[u])); }
    const f = path.join(raiz, decodeURIComponent(u));
    if (f.startsWith(raiz) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(f)); }
    r.writeHead(404); r.end();
  }).listen(0);
}

const hoje = new Date(Date.now() - 3 * 3600 * 1000), amanha = new Date(hoje.getTime() + 86400000).toISOString().slice(0, 10);
const plano = (t) => ({ aprovado: true, tipo: "Ciclo de construção", prioridade: "Construção de ponto", blocos: [{ nome: "Bloco 1", titulo: "Bloco 1", semanasLista: [{ n: 1, foco: "Construção", aulas: [{ t: t + " 1", ex: [] }, { t: t + " 2", ex: [] }] }] }], observacao: [] });

(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  async function abrir(srv, esperar) {
    const p = await b.newPage({ viewport: { width: 430, height: 1300 } });
    await p.route(/tailwindcss/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
    const erros = []; p.erros = erros;
    p.on("pageerror", (e) => erros.push(e.message));
    p.on("console", (x) => { if (x.type() === "error" && !/Failed to load|BABEL/.test(x.text())) erros.push("c:" + x.text().slice(0, 200)); });
    p.on("dialog", (d) => d.accept());
    await p.goto("http://localhost:" + srv.address().port + "/");
    await p.waitForSelector(esperar, { timeout: 120000 }).catch(() => { throw new Error("não abriu: " + erros.join(" | ").slice(0, 1500)); });
    return p;
  }
  const alunos = [{ id: "a1", nome: "Ana Souza", duracaoPadrao: "1h", professorUid: "p1", professorNome: "Carlos", camadas: { tecnico: "Forehand com preparação curta." } }, { id: "a2", nome: "Bruno Lima", duracaoPadrao: "1h", camadas: { tecnico: "" } }];
  const turmas = [{ id: "t1", nome: "Turma Sub-12", membros: ["a1", "a2"], duracaoPadrao: "1h30", professorUid: "p2", professorNome: "Marina", plano: plano("Aula da turma"), regPlano: {} }];

  /* ── Team Yoda: Reposições ── */
  let srv = servir("mty", `
function Host(){ const [alunos,setAlunos]=useState(${JSON.stringify(alunos)}); const [ocorrencias,setOcorrencias]=useState([]); const [regras,setRegras]=useState(regrasReposicaoPadrao());
  window.__oc=ocorrencias; window.__alunos=alunos;
  return <TelaReposicoes alunos={alunos} setAlunos={setAlunos} turmas={${JSON.stringify(turmas)}} quadras={[{id:"q1",nome:"Quadra 1"}]} reservas={[]} bloqueiosAula={[]} ocorrencias={ocorrencias} setOcorrencias={setOcorrencias} regrasReposicao={regras} setRegrasReposicao={setRegras} papelAtual="coordenador" />; }
ReactDOM.createRoot(document.getElementById("root")).render(<Host />);`);
  let p = await abrir(srv, "text=+ Nova reposição");
  // aluno
  await p.click("text=+ Nova reposição");
  await p.waitForSelector("text=Reposição para");
  await p.selectOption("[role=dialog] select >> nth=0", "a1");
  await p.fill("[role=dialog] input[type=date]", amanha);
  await p.fill("[role=dialog] input[type=time] >> nth=0", "17:00");
  assert.strictEqual(await p.inputValue("[role=dialog] input[type=time] >> nth=1"), "18:00", "término sugerido pela duração do aluno");
  await p.fill("[role=dialog] textarea", "Aula de 12/10 cancelada pela chuva");
  if (capturas) { fs.mkdirSync(capturas, { recursive: true }); await p.screenshot({ path: path.join(capturas, "nova-reposicao-aluno.png") }); }
  await p.click("text=Agendar reposição");
  await p.waitForFunction(() => window.__oc.length === 1);
  let oc = await p.evaluate(() => window.__oc[0]);
  assert.strictEqual(oc.tipo, "reposicao"); assert.strictEqual(oc.origemTipo, "individual"); assert.strictEqual(oc.origemId, "a1"); assert.strictEqual(oc.data, amanha);
  assert.strictEqual(oc.professorUid, "p1", "professor do aluno"); assert.strictEqual(oc.motivoReposicao, "Aula de 12/10 cancelada pela chuva");
  // turma
  await p.click("text=+ Nova reposição");
  await p.click("[role=dialog] button:has-text('Uma turma')");
  await p.selectOption("[role=dialog] select >> nth=0", "t1");
  await p.fill("[role=dialog] input[type=date]", amanha);
  await p.fill("[role=dialog] input[type=time] >> nth=0", "17:30");
  await p.click("text=Agendar reposição");
  await p.waitForSelector("[role=dialog] >> text=Conflito de aluno", { timeout: 3000 }); // Ana já tem reposição às 17h: conflito de aluno
  await p.fill("[role=dialog] input[type=time] >> nth=0", "19:00");
  await p.click("text=Agendar reposição");
  await p.waitForFunction(() => window.__oc.length === 2);
  oc = await p.evaluate(() => window.__oc[1]);
  assert.strictEqual(oc.origemTipo, "turma"); assert.strictEqual(oc.origemId, "t1"); assert.strictEqual(oc.horaFim, "20:30", "duração da turma"); assert.strictEqual(oc.professorUid, "p2");
  let t = await p.evaluate(() => document.body.innerText);
  assert(/Reposições marcadas \(2\)/i.test(t) && /Ana Souza/.test(t) && /Turma Sub-12 \(turma\)/.test(t), "lista das reposições marcadas");
  if (capturas) await p.screenshot({ path: path.join(capturas, "reposicoes-marcadas.png"), fullPage: true });
  await p.click("[data-reposicao] >> text=Desmarcar >> nth=0");
  await p.waitForFunction(() => window.__oc.filter((o) => o.status === "cancelada").length === 1);
  t = await p.evaluate(() => document.body.innerText);
  assert(/Reposições marcadas \(1\)/i.test(t), "desmarcar tira da lista");
  assert.deepStrictEqual(p.erros, [], "erros (Reposições): " + p.erros.join(" | "));
  await p.close(); srv.close();

  /* ── Team Yoda: Gerar link na aba Evolução da turma ── */
  srv = servir("mty", `
function Host(){ const [alunos,setAlunos]=useState(${JSON.stringify(alunos)}); const [turmas,setTurmas]=useState(${JSON.stringify(turmas)});
  window.__alunos=alunos;
  return <TelaTurmas alunos={alunos} setAlunos={setAlunos} turmas={turmas} setTurmas={setTurmas} papelAtual="coordenador" uidAtual="p2" identidade={{}} exerciciosCustom={[]} setExerciciosCustom={()=>{}} ocorrencias={[]} quadras={[]} />; }
ReactDOM.createRoot(document.getElementById("root")).render(<Host />);`);
  p = await abrir(srv, "text=Turma Sub-12");
  await p.click("text=Turma Sub-12");
  await p.click("button:has-text('Evolução')");
  await p.waitForSelector("text=Compartilhar com os jogadores", { timeout: 10000 });
  await p.click("text=Gerar link >> nth=0");
  await p.waitForSelector("input[id^=mty-link-membro-]", { timeout: 5000 });
  const link = await p.inputValue("input[id^=mty-link-membro-]");
  assert(/\/aluno\.html\?org=demo&id=a1&t=tok/.test(link), "link do jogador gerado na turma: " + link);
  assert(/^tok/.test(await p.evaluate(() => window.__alunos[0].linkToken)), "token gravado no jogador");
  if (capturas) await p.screenshot({ path: path.join(capturas, "turma-gerar-link.png"), fullPage: true });
  assert.deepStrictEqual(p.erros, [], "erros (link na turma): " + p.erros.join(" | "));
  await p.close(); srv.close();

  /* ── Team Yoda: turma ainda sem plano — o link sai pela aba Plano (traz análises, scouts e o plano da turma quando houver) ── */
  srv = servir("mty", `
function Host(){ const [alunos,setAlunos]=useState(${JSON.stringify(alunos)}); const [turmas,setTurmas]=useState(${JSON.stringify([{ id: "t2", nome: "Turma Sem Plano", membros: ["a2"], duracaoPadrao: "1h" }])});
  window.__alunos=alunos;
  return <TelaTurmas alunos={alunos} setAlunos={setAlunos} turmas={turmas} setTurmas={setTurmas} papelAtual="coordenador" uidAtual="p2" identidade={{}} exerciciosCustom={[]} setExerciciosCustom={()=>{}} ocorrencias={[]} quadras={[]} />; }
ReactDOM.createRoot(document.getElementById("root")).render(<Host />);`);
  p = await abrir(srv, "text=Turma Sem Plano");
  await p.click("text=Turma Sem Plano");
  await p.click("button:has-text('Plano') >> nth=0");
  await p.waitForSelector("text=Compartilhar com os jogadores", { timeout: 10000 });
  await p.click("text=Gerar link >> nth=0");
  await p.waitForSelector("input[id^=mty-link-membro-]", { timeout: 5000 });
  assert(/id=a2&t=tok/.test(await p.inputValue("input[id^=mty-link-membro-]")), "link gerado numa turma sem plano");
  assert.deepStrictEqual(p.erros, [], "erros (turma sem plano): " + p.erros.join(" | "));
  await p.close(); srv.close();

  /* ── QuadraLab (treinador): + Reposição na Agenda ── */
  srv = servir("autonomo", `
function Host(){ const [alunos,setAlunos]=useState(${JSON.stringify(alunos)}); const [turmas,setTurmas]=useState(${JSON.stringify(turmas)});
  window.__alunos=alunos; window.__turmas=turmas;
  return <TelaAgenda alunos={alunos} setAlunos={setAlunos} turmas={turmas} setTurmas={setTurmas} aoVerJogador={()=>{}} aoAbrirPlano={()=>{}} aoAbrirSessao={()=>{}} aoAbrirTurmas={()=>{}} />; }
ReactDOM.createRoot(document.getElementById("root")).render(<Host />);`);
  p = await abrir(srv, "text=+ Reposição");
  await p.click("text=+ Reposição");
  await p.waitForSelector("text=Reposição pra quem?");
  await p.click("[role=dialog] button:has-text('Turma Sub-12')");
  await p.waitForSelector("text=Motivo da reposição (opcional)");
  await p.fill("[role=dialog] input[type=time]", "08:00");
  await p.fill("[role=dialog] input[placeholder^='Ex.:']", "Chuva no sábado");
  await p.click("[role=dialog] button:has-text('Agendar reposição')");
  await p.waitForFunction(() => (window.__turmas[0].agendaAvulsos || []).length === 1);
  const av = await p.evaluate(() => window.__turmas[0].agendaAvulsos[0]);
  assert.strictEqual(av.reposicao, true); assert.strictEqual(av.motivo, "Chuva no sábado"); assert.strictEqual(av.hora, "08:00");
  assert.strictEqual(await p.evaluate(() => (window.__turmas[0].horarios || []).length), 0, "reposição não vira horário fixo");
  t = await p.evaluate(() => document.body.innerText);
  assert(/Reposição/.test(t) && /Turma Sub-12/.test(t), "a agenda do dia mostra a reposição");
  if (capturas) await p.screenshot({ path: path.join(capturas, "quadralab-agenda-reposicao.png"), fullPage: true });
  assert.deepStrictEqual(p.erros, [], "erros (Agenda QuadraLab): " + p.erros.join(" | "));
  await p.close(); srv.close();

  await b.close();
  console.log("smoke-reposicao-e-links: ok");
})().catch((e) => { console.error(e.message || e); process.exit(1); });
