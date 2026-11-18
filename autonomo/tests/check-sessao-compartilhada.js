/* Sessão do dia compartilhada entre treinadores (correção de 18/11/2026): com a sessão aberta, o que outro treinador gera ou muda
   (o rascunho chega pela nuvem no aluno ou na turma) aparece na tela, com aviso; o que este aparelho faz não gera aviso.
   Roda a TelaSessao e a SessaoTurma reais em React/Babel locais (defina CDN_DIR). Rode: node tests/check-sessao-compartilhada.js */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const { chromium } = require("playwright");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("check-sessao-compartilhada: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const raiz = path.join(__dirname, "../../mty");
const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
const corte = ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const corpo = ms.slice(0, corte) + `
function Host() {
  const b = novoAluno();
  const ex = TODOS_EXERCICIOS();
  const aluno = { ...b, id: "a1", nome: "Ana Souza", cadastroConcluido: true, estagio: "C", professorUid: "yoda", professorNome: "Yoda",
    plano: { aprovado: true, blocos: [{ nome: "Bloco 1", semanasLista: [{ n: 1, foco: "Saque", aulas: [{ t: "Aula 1", ex: ex.slice(0, 5).map((e) => e.c) }] }] }] } };
  const bia = { ...b, id: "a2", nome: "Bia Lima", cadastroConcluido: true, estagio: "C" };
  const [alunos, setAlunos] = useState([aluno, bia]);
  const [turmas, setTurmas] = useState([{ id: "t1", nome: "Sub-12", membros: ["a1", "a2"], horarios: [], plano: { aprovado: true, blocos: [{ nome: "Bloco 1", semanasLista: [{ n: 1, foco: "Rede", aulas: [{ t: "Aula da turma", ex: ex.slice(5, 9).map((e) => e.c) }] }] }] } }]);
  window.__aulaEmVigor = aulaEmVigor;
  window.__alunos = alunos; window.__turmas = turmas; window.__setAlunos = setAlunos; window.__setTurmas = setTurmas; window.__ex = ex;
  const modo = location.hash === "#turma" ? "turma" : "ind";
  return <div style={{ padding: 12, maxWidth: 520 }}>
    {modo === "ind" ? <TelaSessao aluno={alunos[0]} alunos={alunos} setAlunos={setAlunos} setSubaba={() => {}} papelAtual="treinador" uidAtual="davi" exerciciosCustom={[]} setExerciciosCustom={() => {}} />
      : <SessaoTurma turma={turmas[0]} alunos={alunos} setAlunos={setAlunos} turmas={turmas} setTurmas={setTurmas} aoFechar={() => {}} aoRemover={() => {}} papelAtual="treinador" uidAtual="davi"
          exerciciosCustom={[]} setExerciciosCustom={() => {}} identidade={{}} ocorrencias={[]} quadras={[]} />}
  </div>;
}
ReactDOM.createRoot(document.getElementById("root")).render(<Host />);`;
const pagina = `<!doctype html><meta charset=utf-8><div id=root></div><script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script><script src=/aulas-mes.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};</script>
<script>window.listaProfessores=async()=>[{uid:"davi",nome:"Davi"},{uid:"yoda",nome:"Yoda"}];</script>
<script src=/scout/graficos.js></script><script src=/scout/ao-vivo.js></script><script src=/scout/relatorio-jogos.js></script><script src=/scout/movimento-motor.js></script><script src=/scout/movimento.js></script><script src=/scout/video-segmentador.js></script><script src=/scout/video-jogo.js></script>
<script type="text/babel">${corpo}</script>`;
const m = { "/aulas-mes.js": path.join(raiz, "aulas-mes.js"), "/r.js": CDN + "/react-18.3.1/package/umd/react.development.js", "/d.js": CDN + "/react-dom-18.3.1/package/umd/react-dom.development.js", "/p.js": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "/c.js": CDN + "/recharts-2.15.4/package/umd/Recharts.js", "/b.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js" };
const srv = http.createServer((q, r) => { const u = q.url.split("?")[0]; if (u === "/") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(pagina); } if (m[u]) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(m[u])); } const f = path.join(raiz, decodeURIComponent(u)); if (f.startsWith(raiz) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(f)); } r.writeHead(404); r.end(); }).listen(0);
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox"] });
  const base = "http://localhost:" + srv.address().port + "/";
  const erros = [];
  const abrir = async (hash) => {
    const p = await b.newPage({ viewport: { width: 480, height: 900 } });
    p.on("pageerror", (e) => erros.push(e.message)); p.on("dialog", (d) => d.accept());
    await p.route(/tailwindcss/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
    await p.goto(base + hash); await p.waitForFunction(() => window.__alunos && document.body.innerText.length > 50, null, { timeout: 120000 });
    return p;
  };
  const texto = (p) => p.evaluate(() => document.body.innerText);

  /* 1. sessão individual: gera aqui, outro treinador troca um exercício */
  let p = await abrir("#ind");
  await p.getByRole("button", { name: /Gerar sessão|Pré-visualizar sessão/ }).first().click();
  await p.waitForFunction(() => window.__alunos[0].rascunhoSessao && window.__alunos[0].rascunhoSessao.plano);
  await p.waitForTimeout(300);
  assert.strictEqual(await p.locator("[data-aviso-sessao-remota]").count(), 0, "o que este aparelho faz não gera aviso");
  const novo = await p.evaluate(() => {
    const a = window.__alunos[0], r = JSON.parse(JSON.stringify(a.rascunhoSessao)), usados = new Set([...(r.plano.aquecimento || []), ...(r.plano.conteudo || [])].map((e) => e.c));
    const outro = window.__ex.find((e) => !usados.has(e.c) && e.n && e.n.length > 6);
    r.plano.conteudo[0] = { ...outro };
    window.__setAlunos((l) => l.map((x) => (x.id === "a1" ? { ...x, rascunhoSessao: r } : x)));
    return outro.n;
  });
  await p.waitForSelector("[data-aviso-sessao-remota]");
  assert(/Sessão atualizada por outro treinador/.test(await p.innerText("[data-aviso-sessao-remota]")));
  assert((await texto(p)).includes(novo), "o exercício que o outro treinador colocou aparece: " + novo);
  /* outro treinador registra a aula: a tela daqui fica sabendo */
  await p.evaluate(() => window.__setAlunos((l) => l.map((x) => (x.id === "a1" ? { ...x, rascunhoSessao: null } : x))));
  await p.waitForFunction(() => /registrou ou descartou esta sessão/.test(document.body.innerText));
  assert(/Gerar sessão|Pré-visualizar sessão/.test(await texto(p)), "volta para gerar");
  /* registrar aqui não avisa como se fosse outro */
  await p.getByRole("button", { name: /Gerar sessão|Pré-visualizar sessão/ }).first().click();
  await p.waitForFunction(() => window.__alunos[0].rascunhoSessao);
  await p.getByRole("button", { name: "Finalizar e registrar aula" }).evaluate((e) => e.click()); await p.waitForTimeout(300);
  await p.getByRole("button", { name: /Confirmar registro/ }).last().evaluate((e) => e.click()); await p.waitForTimeout(800);
  assert.strictEqual((await p.evaluate(() => window.__alunos[0].registros || [])).length, 1, "aula registrada");
  assert(!/registrou ou descartou esta sessão/.test(await texto(p)), "sem aviso de outro treinador ao registrar aqui");
  await p.close();

  /* 2. sessão de turma: outro treinador gera a sessão com a tela daqui aberta */
  p = await abrir("#turma");
  await p.waitForFunction(() => /Gerar sessão|Montar a sessão|gerar/i.test(document.body.innerText));
  const nomes = await p.evaluate(() => {
    const ex = window.__ex, aq = ex.slice(10, 12).map((e) => ({ ...e })), co = ex.slice(20, 23).map((e) => ({ ...e }));
    window.__setTurmas((l) => l.map((t) => ({ ...t, rascunhoSessaoTurma: { sessaoTurma: { aquecimento: aq, conteudo: co }, criadoEm: new Date().toISOString().slice(0, 10), aulaId: (window.__aulaEmVigor(t) || {}).id || null } })));
    return co.map((e) => e.n);
  });
  await p.waitForSelector("[data-aviso-sessao-remota]");
  await p.waitForTimeout(300);
  const t = await texto(p);
  assert(nomes.every((n) => t.includes(n)), "a sessão da turma montada pelo outro treinador aparece: " + nomes.join(", ") + "\n" + t.slice(0, 1500));
  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  console.log("check-sessao-compartilhada: ok");
  await b.close(); srv.close();
})().catch((e) => { console.error(e.message || e); process.exit(1); });
