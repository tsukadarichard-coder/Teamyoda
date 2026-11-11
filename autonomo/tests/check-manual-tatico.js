/* Manual de ensino tático e estratégico no app Team Yoda (mty/manual-tatico.js + mty/index.html):
   1. os dados do manual: 96 fichas (12 por momento), 16 formatos, 32 contextos, 15 referências, campos preenchidos e
      estágios coerentes com a competência N0 a N3;
   2. no app (código real em React/Babel locais): as fichas viram a família TE do catálogo, entram no índice e no resumo do
      método dos pedidos de planejamento (jogador e turma), um plano com códigos TE é aceito, o cartão do exercício mostra
      Ler e Indicador, e a aba Tático-estratégico do Manual filtra, busca e abre a ficha pedida.
   Rode: node tests/check-manual-tatico.js [pasta-das-capturas] */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const raiz = path.join(__dirname, "..", "..", "mty");
require(path.join(raiz, "manual-tatico.js"));
const M = globalThis.MTYManualTatico;

/* 1. dados */
assert.strictEqual(M.FICHAS.length, 96, "96 fichas");
const porMomento = {};
M.FICHAS.forEach((f) => { porMomento[f[0][0]] = (porMomento[f[0][0]] || 0) + 1; });
assert.deepStrictEqual(Object.keys(porMomento), ["F", "S", "R", "C", "T", "N", "D", "U"]);
Object.values(porMomento).forEach((n) => assert.strictEqual(n, 12, "12 fichas por momento"));
assert.strictEqual(new Set(M.FICHAS.map((f) => f[0])).size, 96, "códigos únicos");
M.FICHAS.forEach((f) => {
  assert.strictEqual(f.length, 9, f[0]);
  f.forEach((v, i) => assert(String(v).trim().length >= 2, f[0] + " campo " + i + " vazio"));
  assert(/^N[0-3]( a N[0-3])?$/.test(f[2]), f[0] + " competência " + f[2]);
  assert(/^P[1-3]$/.test(f[3]), f[0] + " prioridade");
  assert(!/Indicador:/.test(f[7]), f[0] + " indicador separado do variar");
  assert(!/\s-\s?$|[a-zà-ú]- [a-zà-ú]/.test(f.join(" ")), f[0] + " palavra quebrada");
});
assert.strictEqual(M.FORMATOS.length, 16); assert.strictEqual(M.CONTEXTOS.length, 32); assert.strictEqual(M.REFERENCIAS.length, 15);
M.FORMATOS.forEach((e) => e.forEach((v, i) => assert(String(v).trim(), e[0] + " campo " + i)));
M.REFERENCIAS.forEach((r) => assert(/^https:\/\//.test(r[2]), r[0] + " endereço"));
assert.deepStrictEqual(M.estagiosDaFaixa("N0 a N1"), ["V", "L", "G", "A"]);
assert.deepStrictEqual(M.estagiosDaFaixa("N3"), ["A", "C"]);
const ex = M.exercicios();
assert(ex.every((e) => e.f === "TE" && /^TE[FSRCTNDU]\d\d$/.test(e.c) && e.e.length && e.m && e.o && e.p && e.r && e.i && e.tl && e.ti), "formato do catálogo");
assert(ex.every((e) => e.e.includes("A")), "toda ficha serve ao adulto");
assert.strictEqual(M.etiquetaIndice(ex.find((e) => e.c === "TEF04")), " [N1–N2·p1]");
assert(!/\bP\d/.test(M.blocoPrompt(10)), "o resumo não cita P1–P3 em maiúscula (viraria link de padrão)");
assert(/Toda semana do plano tem pelo menos uma aula com uma ficha TE/.test(M.blocoPrompt(10)));
assert(!/Toda semana/.test(M.blocoPrompt(1)), "com uma ficha só no estágio, vira sugestão");
console.log("  dados: 96 fichas, 16 formatos, 32 contextos, 15 referências");

/* 2. app */
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("check-manual-tatico: dados ok; tela pulada (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const capturas = process.argv[2] || "";
const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
const corte = ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const corpo = `async function listaProfessores(){return [{uid:"p1",nome:"Carlos"}];}
async function organizacao(){return "demo";} var db=null, auth=null;
` + ms.slice(0, corte) + `
window.mtyAuth={entrar:async()=>{},usuario:()=>null};
window.__app = () => {
  const aluno = { ...novoAluno(), id: "a1", nome: "Ana", estagio: "A", nivel: "Y3" };
  const crianca = { ...novoAluno(), id: "a2", nome: "Bia", estagio: "V", nivel: "Y1" };
  const te = TODOS_EXERCICIOS().filter((e) => e.f === "TE");
  const plano = { blocos: [{ nome: "B1", semanasLista: [{ n: 1, aulas: [{ t: "Aula", d: "x", ex: ["TEF02", "TES02", "IP001"] }] }] }], cadeia: [] };
  let aceito = false; try { validarPlanoJSON(plano, ["A"], []); aceito = true; } catch (e) { aceito = e.message; }
  return {
    total: TODOS_EXERCICIOS().length, te: te.length, fam: FAM.TE, conceito: CONCEITO_POR_FAMILIA.TE,
    temas: temasDeExercicios([te[0]]).map((t) => t.conceito),
    promptA: promptPlanoEstruturado(aluno, 12, 2, [], null),
    promptV: promptPlanoEstruturado(crianca, 12, 2, [], null),
    promptTurma: promptPlanoTurma({ nome: "Turma" }, [aluno, { ...aluno, id: "a3", estagio: "C" }], 12, 2, [], null),
    aceito, tatica: AREAS.tatica.familias, refs: refsExercicio(te[0]).map((r) => r.aba + ":" + r.id),
  };
};
function Raiz(){
  const [aba, setAba] = React.useState("tela");
  const e = TODOS_EXERCICIOS().find((x) => x.c === "TES02");
  window.__aba = setAba;
  return aba === "tela" ? <TelaTaticoEstrategico focoId="ficha-S02" /> : <CartaoExercicio e={e} />;
}
ReactDOM.createRoot(document.getElementById("root")).render(<Raiz />);`;
const sc = ["sync-listas.js", "scout/graficos.js", "scout/ao-vivo.js", "scout/relatorio-jogos.js", "scout/movimento-motor.js", "scout/evidencias.js", "aulas-mes.js", "manual-tatico.js"];
const pagina = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><div id=root style="padding:16px"></div>
<script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script>
${sc.map((s) => "<script src=/" + s + "></script>").join("")}
<script type="text/babel">${corpo}</script>`;
const mapa = { "/r.js": CDN + "/react-18.3.1/package/umd/react.development.js", "/d.js": CDN + "/react-dom-18.3.1/package/umd/react-dom.development.js",
  "/p.js": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "/c.js": CDN + "/recharts-2.15.4/package/umd/Recharts.js", "/b.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js" };
sc.forEach((s) => { mapa["/" + s] = path.join(raiz, s); });
const srv = http.createServer((q, r) => {
  const u = q.url.split("?")[0];
  if (u === "/") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(pagina); }
  if (mapa[u] && fs.existsSync(mapa[u])) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(mapa[u])); }
  r.writeHead(404); r.end();
}).listen(0);
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const erros = []; p.on("pageerror", (e) => erros.push(e.message));
  p.on("console", (x) => { if (x.type() === "error" && !/Failed to load|BABEL|unique "key"/.test(x.text())) erros.push("c:" + x.text().slice(0, 200)); });
  await p.goto("http://localhost:" + srv.address().port + "/");
  await p.waitForSelector("#ficha-S02", { timeout: 120000 }).catch(() => { throw new Error("não abriu: " + erros.join(" | ").slice(0, 1500)); });
  const cap = async (n) => { if (capturas) { fs.mkdirSync(capturas, { recursive: true }); await p.screenshot({ path: path.join(capturas, n + ".png"), fullPage: false }); } };

  const a = await p.evaluate(() => window.__app());
  assert.strictEqual(a.te, 96, "96 exercícios TE no catálogo");
  assert.strictEqual(a.total, 353 + 96, "o catálogo antigo continua inteiro");
  assert(/Tático-estratégico/.test(a.fam) && a.conceito === "Tático e jogo" && a.temas[0] === "Tático e jogo");
  assert(a.tatica.includes("TE") && a.tatica.includes("TR"), "a área tática usa TE sem perder TR/DT");
  assert.strictEqual(a.aceito, true, "plano com códigos TE é aceito: " + a.aceito);
  assert.deepStrictEqual(a.refs, ["tatico:ficha-F01", "tatico:progressao", "catalogo:familia-TE"]);
  assert(/TEF01 Manter a bola disponível \[N0–N1·p1\]/.test(a.promptA) && /TEU12 /.test(a.promptA), "índice do adulto com as fichas TE");
  assert(/MÉTODO TÁTICO E ESTRATÉGICO/.test(a.promptA) && /Toda semana do plano tem pelo menos uma aula com uma ficha TE/.test(a.promptA));
  assert(a.promptA.indexOf("MÉTODO TÁTICO") > a.promptA.indexOf("EXERCÍCIOS DISPONÍVEIS") && a.promptA.indexOf("MÉTODO TÁTICO") < a.promptA.indexOf("FICHA DO JOGADOR"));
  assert(/TEF01 /.test(a.promptV) && !/TES02/.test(a.promptV) && !/Toda semana do plano tem pelo menos uma aula com uma ficha TE/.test(a.promptV), "bola vermelha: só F01, regra vira sugestão");
  assert(/MÉTODO TÁTICO E ESTRATÉGICO/.test(a.promptTurma) && /TES02 Saque aberto e espaço disponível \[N2·p2\] \[A,C\]/.test(a.promptTurma), "turma com etiqueta e estágios");
  console.log("  catálogo, índice e pedidos de plano (jogador, bola vermelha e turma)");

  /* tela: a ficha pedida já aberta, no momento dela */
  let t = await p.evaluate(() => document.body.innerText);
  assert(/S02 · Saque aberto e espaço disponível/i.test(t) && /Deslocamento real de B/.test(t) && /Indicador/i.test(t), "S02 aberta: " + (await p.evaluate(() => document.getElementById("ficha-S02").innerText)).slice(0, 300));
  assert(/S · Saque e primeira bola do sacador/.test(t) && !/F01 · Manter a bola disponível/.test(t), "filtrado no momento da ficha");
  for (const s of ["Quatro estados para orientar a intenção", "Progressão de ensino em oito etapas", "Competência funcional (N0 a N3)", "Como transformar fichas em sessões", "Matriz para gerar variações", "Sessões de referência", "Medidas de aprendizagem em quadra", "Referências e alcance da evidência"])
    assert(t.includes(s), "seção " + s);
  await p.evaluate(() => document.getElementById("ficha-S02").scrollIntoView({ block: "start" }));
  await cap("tatico-01-ficha");
  await p.getByRole("button", { name: "Todos", exact: true }).click();
  await p.waitForTimeout(150);
  assert.strictEqual(await p.locator('[id^="ficha-"]').count(), 96, "todas as fichas");
  await p.getByRole("button", { name: "N3", exact: true }).click();
  await p.waitForTimeout(150);
  const n3 = await p.locator('[id^="ficha-"]').count();
  assert(n3 > 0 && n3 < 96 && (await p.locator("#ficha-F01").count()) === 0 && (await p.locator("#ficha-U12").count()) === 1, "filtro N3: " + n3);
  await p.getByRole("button", { name: "Qualquer nível", exact: true }).click();
  await p.fill('input[aria-label="Buscar nas fichas"]', "lob");
  await p.waitForTimeout(150);
  const lob = await p.locator('[id^="ficha-"]').count();
  assert(lob === 24 && (await p.locator("#ficha-D05").count()) === 1, "busca por lob: " + lob);
  await p.fill('input[aria-label="Buscar nas fichas"]', "");
  await p.getByRole("button", { name: /E06 · Saque com três respostas possíveis/ }).click();
  t = await p.evaluate(() => document.getElementById("formato-E06").innerText);
  assert(/S02 a S11; R02 a R08/.test(t) && /Intervenção/i.test(t), "formato E06 abre: " + t.slice(0, 200));
  await p.evaluate(() => document.getElementById("formatos").scrollIntoView({ block: "start" }));
  await cap("tatico-02-formatos");
  console.log("  aba Tático-estratégico: ficha pedida aberta, filtros, busca e formatos");

  /* cartão do exercício no catálogo/sessão */
  await p.evaluate(() => window.__aba("cartao"));
  await p.waitForTimeout(200);
  await p.getByText("Saque aberto e espaço disponível").first().click();
  await p.waitForTimeout(200);
  t = await p.evaluate(() => document.body.innerText);
  assert(/Ficha S02 · competência N2 · prioridade P2/.test(t) && /\bLer\b/i.test(t) && /Indicador/i.test(t) && /Terceiras bolas escolhidas/.test(t), "cartão TE com Ler e Indicador: " + t.slice(0, 900));
  await cap("tatico-03-cartao");
  console.log("  cartão do exercício TE");

  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  console.log("check-manual-tatico: ok");
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
