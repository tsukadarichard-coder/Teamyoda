/* Ficha rápida, aba Avaliação, Montar turmas e fim do ciclo (pedido do Richard em 25/11/2026). Componentes reais em React/Babel
   locais (defina CDN_DIR). Rode: node tests/check-ficha-rapida.js [capturas] */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const { chromium } = require("playwright");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("check-ficha-rapida: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const raiz = path.join(__dirname, "../../mty");
const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
const corte = ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const corpo = ms.slice(0, corte) + `
async function listaProfessores() { return [{ uid: "p1", nome: "Davi" }, { uid: "p2", nome: "Lia" }]; }
function Host() {
  const b = novoAluno();
  const modo = location.hash.slice(1) || "rapida";
  const [criados, setCriados] = useState([]);
  const [turmas, setTurmas] = useState([{ id: "t-ex", nome: "Terça 17h", membros: [] }]);
  const base = (id, nome, estagio, nivel, extra) => ({ ...b, id, nome, estagio, nivel, cadastroConcluido: true, ondeTreina: "definir", professorUid: "p1", ...extra });
  const [alunos, setAlunos] = useState([
    base("a1", "Ana", "G", "Y3", { nascimento: "2016-03-01" }), base("a2", "Bia", "G", "Y3", { nascimento: "2016-08-01" }), base("a3", "Caio", "G", "Y4", { nascimento: "2015-01-01" }),
    base("a4", "Davi", "G", "Y3", { nascimento: "2016-01-01" }), base("a5", "Eva", "G", "Y3", { nascimento: "2017-01-01" }),
    base("a6", "Fabio", "A", "Y3", {}), base("a7", "Gil", "A", "Y3", {}), base("a8", "Hugo", "C", "Y5", { ondeTreina: "individual" }),
    base("a9", "Iara", "C", "Y5", { fichaRapida: true, registros: [
      { tipo: "sessao", data: "2099-01-02", aulaDoPlano: "Aula 1", corrigi: "contato atrasado no FH", proximoFoco: "split step", temas: [{ nome: "Construção", status: "parcial" }], conquista: { texto: "8 de 10 saques", marco: true } },
      { tipo: "jogo", data: "2099-01-03" }] }),
  ]);
  window.__estado = { criados, turmas, alunos };
  window.__f = { completudeFicha, sugerirGrupos, resumoDoCiclo, registrosParaPrompt, promptPlanoEstruturado, nivelRapido };
  return <div style={{ padding: 12, maxWidth: 520 }}>
    {modo === "rapida" && <FichaRapida uidAtual="p1" turmas={turmas} aoCriar={(n, o) => setCriados((l) => [...l, { n, o }])} aoCancelar={() => {}} aoFichaCompleta={() => {}} />}
    {modo === "avaliacao" && <AbaAvaliacao aluno={alunos[8]} salvar={async (d) => { setAlunos((l) => l.map((a) => (a.id === d.id ? d : a))); return true; }} papelAtual="coordenador" uidAtual="p1" quadras={[]} />}
    {modo === "turmas" && <MontarTurmas alunos={alunos} turmas={turmas} setTurmas={setTurmas} setAlunos={setAlunos} professores={[{ uid: "p1", nome: "Davi" }]} aoFechar={() => {}} />}
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
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox"] });
  const base = "http://localhost:" + srv.address().port + "/";
  const erros = [], cap = process.argv[2];
  const abrir = async (hash) => {
    const p = await b.newPage({ viewport: { width: 480, height: 1300 } });
    p.on("pageerror", (e) => erros.push(e.message)); p.on("dialog", (d) => d.accept());
    await p.route(/tailwindcss/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
    await p.goto(base + hash); await p.waitForFunction(() => window.__estado, null, { timeout: 120000 });
    return p;
  };
  /* 1. ficha rápida */
  let p = await abrir("#rapida");
  await p.click('button:text-is("Salvar e gerar plano")');
  assert(/Escreva o nome/.test(await p.innerText("[data-ficha-rapida]")), "nome obrigatório");
  await p.fill("[data-rapida-nome]", "Lia Souza");
  await p.click('button:text-is("Salvar e gerar plano")');
  assert(/Escolha o estágio/.test(await p.innerText("[data-ficha-rapida]")), "estágio obrigatório");
  await p.click('[data-rapida-estagio] button:text-is("Competição")');
  await p.click('[data-rapida-nivel] button:text-is("Intermediário")');
  assert(/Começa no nível Y5/.test(await p.innerText("[data-ficha-rapida]")), "competição intermediário = Y5");
  await p.click('button:text-is("Evoluir no jogo")'); await p.click('button:text-is("Uma mão")');
  await p.click('[data-rapida-golpes] [data-golpe="backhand1"]'); await p.click('[data-rapida-golpes] [data-golpe="slice"]');
  assert(await p.locator('[data-rapida-golpes] [data-golpe="voleioFH"]').isDisabled(), "no máximo 2 golpes");
  assert.strictEqual(await p.locator('[data-rapida-golpes] [data-golpe="backhand2"]').count(), 0, "backhand de duas mãos some com backhand de uma mão");
  await p.selectOption("[data-rapida-onde]", "definir");
  if (cap) { fs.mkdirSync(cap, { recursive: true }); await p.screenshot({ path: path.join(cap, "ficha-rapida.png"), fullPage: true }); }
  await p.click('button:text-is("Salvar e gerar plano")');
  await p.waitForFunction(() => window.__estado.criados.length === 1);
  const c = await p.evaluate(() => window.__estado.criados[0]);
  assert.strictEqual(c.n.nome, "Lia Souza"); assert.strictEqual(c.n.estagio, "C"); assert.strictEqual(c.n.nivel, "Y5");
  assert.deepStrictEqual(c.n.golpesTecnicos, ["backhand1", "slice"]); assert.strictEqual(c.n.backhand, "uma"); assert.strictEqual(c.n.objetivoRapido, "evoluir");
  assert(c.n.fichaRapida && c.n.cadastroConcluido && !c.n.soCadastro && c.n.ondeTreina === "definir" && c.n.aulasPorSemana === 2);
  assert.deepStrictEqual(c.o, { turmaId: null, gerarIA: true });
  const f = await p.evaluate(() => ({ v: window.__f.nivelRapido("V", 2), a: window.__f.nivelRapido("A", 0) }));
  assert.deepStrictEqual(f, { v: "Y2", a: "Y2" });
  await p.close(); console.log("  ficha rápida: obrigatórios, nível rápido em Y, até 2 golpes, onde treina, IA ligada");

  /* 2. aba Avaliação */
  p = await abrir("#avaliacao");
  let t = await p.innerText("[data-aba-avaliacao]");
  assert(/Ficha \d+% completa/.test(t) && /Avaliação técnica por golpe/.test(t) && /Classificação por critérios/.test(t) && /Contexto/.test(t), "cartões e completude: " + t.slice(0, 300));
  assert(/Hoje, observe: Forehand/.test(t), "sugestão do dia: o primeiro golpe sem avaliação");
  const antes = await p.evaluate(() => window.__f.completudeFicha(window.__estado.alunos[8]).pct);
  await p.click('[data-parte-avaliacao="fisico"] button');
  await p.waitForSelector("[data-salvar-parte]");
  assert.strictEqual(await p.locator("text=Etapa 1 de 5").count(), 0, "sem a régua das 5 etapas");
  await p.getByRole("button", { name: "Destro" }).first().click();
  await p.click('[data-salvar-parte] button:text-is("Salvar")');
  await p.waitForSelector("[data-aba-avaliacao]");
  const depois = await p.evaluate(() => window.__f.completudeFicha(window.__estado.alunos[8]).pct);
  assert(depois > antes, "preencher uma parte sobe a completude: " + antes + " → " + depois);
  await p.close(); console.log("  avaliação: cartões, completude (" + antes + "% → " + depois + "%), parte aberta sozinha e salva");

  /* 3. montar turmas */
  p = await abrir("#turmas");
  await p.waitForSelector("[data-grupo-sugerido]");
  let grupos = await p.$$eval("[data-grupo-sugerido]", (l) => l.map((x) => ({ n: x.querySelector("input").value, t: x.innerText })));
  assert.strictEqual(grupos.length, 3, "Verde (5 → 3 + 2), Adulto (2): " + JSON.stringify(grupos));
  assert(/Verde/.test(grupos[0].n) && /Adulto/.test(grupos[2].n) && !/Hugo/.test(grupos.map((g) => g.t).join()), "quem faz aula individual fica de fora por padrão");
  assert(/Iara/.test(await p.innerText("[data-soltos]")), "sozinha no estágio: fora dos grupos, sem turma de um aluno só");
  await p.locator("[data-grupo-sugerido]").last().getByRole("button", { name: "Criar esta turma" }).click();
  await p.waitForFunction(() => window.__estado.turmas.length === 2);
  const nova = await p.evaluate(() => window.__estado.turmas[1]);
  assert.deepStrictEqual(nova.membros.sort(), ["a6", "a7"]); assert.strictEqual(nova.professorUid, "p1");
  assert(await p.evaluate(() => window.__estado.alunos.filter((a) => ["a6", "a7"].includes(a.id)).every((a) => a.ondeTreina === "turma")), "alunos marcados como em turma");
  if (cap) await p.screenshot({ path: path.join(cap, "montar-turmas.png"), fullPage: true });
  await p.close(); console.log("  turmas: grupos por estágio e nível, equilibrados, criar turma com o professor da maioria");

  /* 4. fim do ciclo: números sem IA e o que a IA recebe */
  p = await abrir("#rapida");
  const r = await p.evaluate(() => { const a = { ...window.__estado.alunos[8], historicoRelatorios: [{ data: "2099-01-01", texto: "x" }] };
    return { res: window.__f.resumoDoCiclo(a), reg: window.__f.registrosParaPrompt(a), prompt: window.__f.promptPlanoEstruturado(a, 4, 2, a.historicoRelatorios, { tecnico: 50, tatico: 50, fisico: 50, pontos: 50 }) }; });
  assert.strictEqual(r.res.aulas, 1); assert.strictEqual(r.res.jogos, 1); assert.strictEqual(r.res.marcos, 1); assert.strictEqual(r.res.temas.parcial, 1);
  assert(/corrigiu: contato atrasado no FH/.test(r.reg) && /próximo foco: split step/.test(r.reg) && /conquista \(marco\): 8 de 10 saques/.test(r.reg));
  assert(/REGISTROS DAS AULAS DESTE CICLO/.test(r.prompt) && /Ficha rápida: a primeira classificação é uma estimativa/.test(r.prompt), "o pedido do plano leva os registros e o aviso da ficha rápida");
  await p.close(); console.log("  fim do ciclo: resumo sem IA e registros das aulas no pedido do próximo plano");
  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  console.log("check-ficha-rapida: ok");
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
