/* Estrutura da sessão (25/11/2026): aquecimento pela idade, técnica específica (golpe isolado da ficha), parte geral do plano e
   saque e devolução; na turma, montada com os presentes. Regras puras + SessaoTurma real. Rode: node tests/check-sessao-estrutura.js [capturas]
   (base do harness: check-sessao-compartilhada.js) — Sessão do dia compartilhada entre treinadores (correção de 18/11/2026): com a sessão aberta, o que outro treinador gera ou muda
   (o rascunho chega pela nuvem no aluno ou na turma) aparece na tela, com aviso; o que este aparelho faz não gera aviso.
   Roda a TelaSessao e a SessaoTurma reais em React/Babel locais (defina CDN_DIR). Rode: node tests/check-sessao-compartilhada.js */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const { chromium } = require("playwright");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("check-sessao-estrutura: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const raiz = path.join(__dirname, "../../mty");
const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
const corte = ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const corpo = ms.slice(0, corte) + `
function Host() {
  const b = novoAluno();
  const ex = TODOS_EXERCICIOS();
  /* três crianças da bola verde: Ana e Bia com forehand na ficha, Caio com voleio de forehand; Caio falta hoje */
  const ana = { ...b, id: "a1", nome: "Ana Souza", cadastroConcluido: true, estagio: "G", golpesTecnicos: ["forehand"] };
  const bia = { ...b, id: "a2", nome: "Bia Lima", cadastroConcluido: true, estagio: "G", golpesTecnicos: ["forehand"] };
  const caio = { ...b, id: "a3", nome: "Caio Reis", cadastroConcluido: true, estagio: "G", golpesTecnicos: ["voleioFH"] };
  const [alunos, setAlunos] = useState([ana, bia, caio]);
  const aulaEx = ["CF005", "DM014", ...ex.filter((e) => e.f === "DT" && e.e.includes("G")).slice(0, 2).map((e) => e.c), ex.find((e) => /saque/i.test(e.n) && e.e.includes("G")).c];
  const [turmas, setTurmas] = useState([{ id: "t1", nome: "Verde", membros: ["a1", "a2", "a3"], horarios: [], plano: { aprovado: true, blocos: [{ nome: "Bloco 1", semanasLista: [{ n: 1, foco: "Construção", aulas: [{ t: "Aula da turma", ex: aulaEx }] }] }] } }]);
  window.__turmas = turmas; window.__aulaEx = aulaEx;
  return <div style={{ padding: 12, maxWidth: 520 }}>
    <SessaoTurma turma={turmas[0]} alunos={alunos} setAlunos={setAlunos} turmas={turmas} setTurmas={setTurmas} aoFechar={() => {}} aoRemover={() => {}} papelAtual="treinador" uidAtual="davi"
      exerciciosCustom={[]} setExerciciosCustom={() => {}} identidade={{}} ocorrencias={[]} quadras={[]} />
  </div>;
}
ReactDOM.createRoot(document.getElementById("root")).render(<Host />);`;
const pagina = `<!doctype html><meta charset=utf-8><div id=root></div><script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script><script src=/aulas-mes.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};</script>
<script>window.listaProfessores=async()=>[{uid:"davi",nome:"Davi"},{uid:"yoda",nome:"Yoda"}];</script>
<script src=/situacoes-jogo.js></script><script src=/tecnica-especifica.js></script><script src=/scout/graficos.js></script><script src=/scout/ao-vivo.js></script><script src=/scout/relatorio-jogos.js></script><script src=/scout/movimento-motor.js></script><script src=/scout/movimento.js></script><script src=/scout/video-segmentador.js></script><script src=/scout/video-jogo.js></script>
<script type="text/babel">${corpo}</script>`;
const m = { "/aulas-mes.js": path.join(raiz, "aulas-mes.js"), "/r.js": CDN + "/react-18.3.1/package/umd/react.development.js", "/d.js": CDN + "/react-dom-18.3.1/package/umd/react-dom.development.js", "/p.js": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "/c.js": CDN + "/recharts-2.15.4/package/umd/Recharts.js", "/b.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js" };
const srv = http.createServer((q, r) => { const u = q.url.split("?")[0]; if (u === "/") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(pagina); } if (m[u]) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(m[u])); } const f = path.join(raiz, decodeURIComponent(u)); if (f.startsWith(raiz) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(f)); } r.writeHead(404); r.end(); }).listen(0);
/* regras puras (tecnica-especifica.js) */
require(path.join(raiz, "tecnica-especifica.js"));
const T = globalThis.MTYTecnica, EX = T.exercicios(), TE = EX.filter((e) => e.f === "TE");
assert.strictEqual(T.GOLPES.length, 13, "todos os golpes do tênis");
T.GOLPES.forEach((g) => assert(TE.filter((e) => e.golpe === g.id).length >= 3, "pelo menos 3 formatos isolados para " + g.r));
assert(TE.every((e) => /sem construção de jogada/.test(e.m) && /4 séries de 12/.test(e.g)), "isolado, com séries e bolas");
assert(TE.filter((e) => e.e.includes("V")).every((e) => e.formato === "mao"), "bola vermelha: só lançamento à mão");
for (const c of ["DM014", "CF005", "CF013", "MV009", "MV025", "MV019"]) assert(!T.AQUECIMENTO.crianca.includes(c) && !T.AQUECIMENTO.adulto.includes(c), c + " fora do aquecimento");
assert(T.aquecimentoPermitido(["G", "A"]).includes("BR007") && !T.aquecimentoPermitido(["A"]).includes("BR007"), "turma mista: manda a faixa mais nova");
const dois = { estagio: "C", golpesTecnicos: ["forehand", "slice"] };
assert.strictEqual(T.golpeDoDia(dois, [], EX), "forehand"); assert.strictEqual(T.golpeDoDia(dois, ["TE001"], EX), "slice", "alterna entre os dois da ficha");
assert.strictEqual(T.golpeDoDia({ estagio: "C", golpesTecnicos: ["backhand"], backhand: "uma" }, [], EX), "backhand1", "backhand segue a ficha");
assert.strictEqual(T.golpeDoDia({ estagio: "A" }, ["TE001"], EX), "backhand2", "sem marcação: rodízio depois do último golpe");
assert.strictEqual(T.golpeDoDia(dois, [], EX, 7), "slice", "alto rendimento: alterna pelo dia quando não há sessão recente");
console.log("  regras: 13 golpes, " + TE.length + " exercícios isolados, aquecimento por idade, golpe do dia");

(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox"] });
  const base = "http://localhost:" + srv.address().port + "/";
  const erros = [];
  const p = await b.newPage({ viewport: { width: 480, height: 1400 } });
  p.on("pageerror", (e) => erros.push(e.message)); p.on("dialog", (d) => d.accept());
  await p.route(/tailwindcss/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
  await p.goto(base); await p.waitForFunction(() => window.__turmas && document.body.innerText.length > 50, null, { timeout: 120000 });
  /* Caio faltou: marca antes de gerar */
  const linhaCaio = p.locator("div.mb-2", { hasText: "Caio Reis" }).first();
  await linhaCaio.getByRole("button", { name: /Ausente|Faltou/i }).first().click();
  await p.waitForFunction(() => /Hoje: 2 de 3/.test(document.querySelector("[data-aviso-presentes]").innerText));
  await p.getByRole("button", { name: "Gerar sessão de hoje" }).click();
  await p.waitForSelector("[data-secao-turma]");
  const secoes = await p.$$eval("[data-secao-turma]", (l) => l.map((x) => ({ id: x.getAttribute("data-secao-turma"), t: x.innerText })));
  assert.deepStrictEqual(secoes.map((x) => x.id), ["aquecimento", "especifico", "conteudo", "saqueDev"], "as quatro partes na turma");
  const esp = secoes[1].t;
  assert(/Forehand · Ana, Bia/.test(esp) && !/Caio/.test(esp) && /isolado/.test(esp), "técnica pelos presentes (forehand de Ana e Bia; Caio faltou): " + esp.slice(0, 300));
  assert(!/Voleio FH isolado/.test(esp), "o golpe de quem faltou não entra");
  assert(!/Saltos com Corda|Visualização Pre-Treino/.test(secoes[0].t + secoes[2].t), "corda e visualização fora (aquecimento refeito, não entra na parte geral)");
  assert(/saque/i.test(secoes[3].t), "saque e devolução: " + secoes[3].t.slice(0, 200));
  const st = await p.evaluate(() => window.__turmas[0].rascunhoSessaoTurma && window.__turmas[0].rascunhoSessaoTurma.sessaoTurma);
  assert.deepStrictEqual(st && st.presentes, ["a1", "a2"], "a sessão guarda quem estava presente");
  assert(st.especifico[0].paraAlunos.join() === "a1,a2" && st.especifico[0].golpe === "forehand");
  /* trocar o exercício de técnica específica mantém o golpe e quem trabalha */
  await p.locator("[data-secao-turma=especifico]").getByRole("button", { name: "Substituir exercício" }).first().click();
  await p.waitForTimeout(300);
  const st2 = await p.evaluate(() => window.__turmas[0].rascunhoSessaoTurma.sessaoTurma);
  assert(st2.especifico[0].golpe === "forehand" && st2.especifico[0].paraAlunos.join() === "a1,a2", "troca dentro do mesmo golpe");
  if (process.argv[2]) { fs.mkdirSync(process.argv[2], { recursive: true }); await p.screenshot({ path: path.join(process.argv[2], "turma-estrutura.png"), fullPage: true }); }
  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  console.log("  turma: presença antes de gerar, quatro partes, técnica por golpe com os presentes, troca no mesmo golpe");
  console.log("check-sessao-estrutura: ok");
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
