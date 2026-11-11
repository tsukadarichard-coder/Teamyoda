/* Situações de jogo no app Team Yoda (mty/situacoes-jogo.js + mty/index.html), integradas ao que já existe:
   1. dados: 96 situações (12 por momento do ponto), 16 formatos, 32 contextos, 15 referências; cada situação vira um
      exercício de uma família existente (DT, IP, PDB, AT, PDR, DP), continuando a numeração, sem colidir com códigos antigos;
      as referências entre situações (formatos, sessões, ciclo) já apontam para os códigos do catálogo;
   2. app (código real em React/Babel locais): nenhuma família ou aba nova; o catálogo antigo continua inteiro; os pedidos
      de plano (jogador e turma) marcam as situações no índice, trazem a regra semanal e os três princípios novos; um plano
      com os códigos novos é aceito; o cartão mostra Ler e Indicador; Táticas, Condução, Aulas e Como decide mostram as
      seções novas.
   Rode: node tests/check-situacoes-jogo.js [pasta-das-capturas] */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const raiz = path.join(__dirname, "..", "..", "mty");
require(path.join(raiz, "situacoes-jogo.js"));
const M = globalThis.MTYSituacoes;

/* 1. dados */
assert.strictEqual(M.FICHAS.length, 96, "96 situações");
const porMomento = {};
M.FICHAS.forEach((f) => { porMomento[f[0][0]] = (porMomento[f[0][0]] || 0) + 1; });
assert.deepStrictEqual(Object.keys(porMomento), ["F", "S", "R", "C", "T", "N", "D", "U"]);
Object.values(porMomento).forEach((n) => assert.strictEqual(n, 12));
M.FICHAS.forEach((f) => {
  assert.strictEqual(f.length, 9, f[0]);
  f.forEach((v, i) => assert(String(v).trim().length >= 2, f[0] + " campo " + i + " vazio"));
  assert(/^N[0-3]( a N[0-3])?$/.test(f[2]) && /^P[1-3]$/.test(f[3]), f[0]);
  assert(!/Indicador:/.test(f[7]) && !/[a-zà-ú]- [a-zà-ú]/.test(f.join(" ")), f[0] + " texto");
});
assert.strictEqual(M.FORMATOS.length, 16); assert.strictEqual(M.CONTEXTOS.length, 32); assert.strictEqual(M.REFERENCIAS.length, 15);
const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const antigos = JSON.parse(html.split("\n").find((l) => l.startsWith("const EXERCICIOS = ")).replace(/^const EXERCICIOS = /, "").replace(/;\s*$/, ""));
const codAntigos = new Set(antigos.map((e) => e.c));
const ex = M.exercicios();
assert.strictEqual(new Set(ex.map((e) => e.c)).size, 96, "códigos únicos");
ex.forEach((e) => {
  assert(["DT", "IP", "PDB", "AT", "PDR", "DP"].includes(e.f), e.c + " família existente");
  assert(/^[A-Z]+\d{3}$/.test(e.c) && e.c.startsWith(e.f), e.c + " formato do código");
  assert(!codAntigos.has(e.c), e.c + " colide com o catálogo");
  assert(e.e.length && e.e.includes("A") && e.m && e.o && e.p && e.r && e.i && e.tl && e.ti, e.c + " campos");
});
assert.strictEqual(M.codigo("F01"), "DT031"); assert.strictEqual(M.codigo("D12"), "DT054");
assert.strictEqual(M.codigo("S01"), "IP021"); assert.strictEqual(M.codigo("R12"), "IP044");
assert.strictEqual(M.codigo("U12"), "DP024");
const textos = JSON.stringify([M.FORMATOS.map((e) => e[2]), M.CICLO_OITO, M.SESSAO_EXEMPLOS]);
assert(!/\b[FSCTNDU]\d\d\b/.test(textos) && !/\bR\d\d\b(?!\])/.test(textos.replace(/\[R\d\d[^\]]*\]/g, "")), "referências traduzidas para o catálogo");
assert(/DT031 a DT042/.test(M.FORMATOS[0][2]), "E01 aponta para DT031 a DT042");
const tudo = JSON.stringify(M);
assert(!/manual/i.test(tudo), "nada se apresenta como manual");
assert(/Toda semana do plano/.test(M.regraPrompt(10)) && !/Toda semana/.test(M.regraPrompt(1)) && M.regraPrompt(0) === "");
console.log("  dados: 96 situações em famílias existentes, códigos novos, referências traduzidas");

/* 2. app */
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("check-situacoes-jogo: dados ok; tela pulada (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const capturas = process.argv[2] || "";
const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
const corte = ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const corpo = `async function listaProfessores(){return [{uid:"p1",nome:"Carlos"}];}
async function organizacao(){return "demo";} var db=null, auth=null;
` + ms.slice(0, corte) + `
window.mtyAuth={entrar:async()=>{},usuario:()=>null};
window.__app = () => {
  const aluno = { ...novoAluno(), id: "a1", nome: "Ana", estagio: "A", nivel: "Y3" };
  const crianca = { ...novoAluno(), id: "a2", nome: "Bia", estagio: "V", nivel: "Y1" };
  const plano = { blocos: [{ nome: "B1", semanasLista: [{ n: 1, aulas: [{ t: "Aula", d: "x", ex: ["DT032", "IP022", "DP013", "IP001"] }] }] }], cadeia: [] };
  let aceito = false; try { validarPlanoJSON(plano, ["A"], []); aceito = true; } catch (e) { aceito = e.message; }
  const sit = TODOS_EXERCICIOS().filter((e) => e.tl);
  return {
    total: TODOS_EXERCICIOS().length, sit: sit.length, familias: Object.keys(FAM).length, temTE: !!FAM.TE, abas: NAV_MANUAL.map((t) => t.v),
    principios: PRINCIPIOS_MTY.length,
    promptA: promptPlanoEstruturado(aluno, 12, 2, [], null),
    promptV: promptPlanoEstruturado(crianca, 12, 2, [], null),
    promptTurma: promptPlanoTurma({ nome: "Turma" }, [aluno, { ...aluno, id: "a3", estagio: "C" }], 12, 2, [], null),
    aceito, refs: refsExercicio(sit[0]).map((r) => r.aba + ":" + r.id),
    conceitos: [...new Set(sit.map((e) => CONCEITO_POR_FAMILIA[e.f]))],
  };
};
function Raiz(){
  const [aba, setAba] = React.useState("taticas");
  window.__aba = setAba;
  const e = TODOS_EXERCICIOS().find((x) => x.c === "IP022");
  return aba === "taticas" ? <TelaTaticas /> : aba === "conducao" ? <TelaConducao /> : aba === "aulas" ? <TelaAulas /> : aba === "metodo" ? <TelaMetodo /> : <CartaoExercicio e={e} />;
}
ReactDOM.createRoot(document.getElementById("root")).render(<Raiz />);`;
const sc = ["sync-listas.js", "scout/graficos.js", "scout/ao-vivo.js", "scout/relatorio-jogos.js", "scout/movimento-motor.js", "scout/evidencias.js", "aulas-mes.js", "situacoes-jogo.js"];
const pagina = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><div id=root style="padding:16px"></div>
<script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script>
${sc.map((s) => "<script src=/" + s + "></script>").join("")}
<script type="text/babel">${corpo}</script>`;
const mapa = { "/r.js": CDN + "/react-18.3.1/package/umd/react.development.js", "/d.js": CDN + "/react-dom-18.3.1/package/umd/react-dom.development.js",
  "/p.js": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "/c.js": CDN + "/recharts-2.15.4/package/umd/Recharts.js",
  "/b.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js" };
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
  await p.waitForSelector("#situacao-jogo", { timeout: 120000 }).catch(() => { throw new Error("não abriu: " + erros.join(" | ").slice(0, 1500)); });
  const cap = async (n, sel) => {
    if (!capturas) return; fs.mkdirSync(capturas, { recursive: true });
    if (sel) await p.evaluate((s) => document.querySelector(s).scrollIntoView({ block: "start" }), sel);
    await p.screenshot({ path: path.join(capturas, n + ".png") });
  };

  const a = await p.evaluate(() => window.__app());
  assert.strictEqual(a.total, 353 + 96, "catálogo antigo inteiro + 96");
  assert.strictEqual(a.sit, 96);
  assert(!a.temTE && !a.abas.includes("tatico"), "sem família nem aba separada");
  assert(["Construção de ponto", "Rede e finalização", "Saque e devolução"].every((c) => a.conceitos.includes(c)), "situações caem nos conceitos já existentes: " + a.conceitos);
  assert.strictEqual(a.aceito, true, "plano com códigos novos aceito: " + a.aceito);
  assert.deepStrictEqual(a.refs.slice(0, 2), ["catalogo:familia-DT", "taticas:situacao-jogo"]);
  assert(/DT031 Manter a bola disponível \(situação\)/.test(a.promptA) && /IP022 Saque aberto e espaço disponível \(situação\)/.test(a.promptA), "índice marca as situações");
  assert(/Toda semana do plano/.test(a.promptA) && /Tática se ensina por situação de jogo/.test(a.promptA) && /boa escolha com erro continua boa escolha/.test(a.promptA), "regra e princípios no pedido");
  assert(a.promptA.indexOf("Toda semana do plano") > a.promptA.indexOf("EXERCÍCIOS DISPONÍVEIS") && a.promptA.indexOf("Toda semana do plano") < a.promptA.indexOf("FICHA DO JOGADOR"));
  assert(/DT031 /.test(a.promptV) && !/IP022/.test(a.promptV) && !/Toda semana do plano/.test(a.promptV), "bola vermelha: uma situação, regra vira sugestão");
  assert(/IP022 Saque aberto e espaço disponível \(situação\) \[A,C\]/.test(a.promptTurma) && /Toda semana do plano/.test(a.promptTurma), "turma");
  assert(!/manual|MÉTODO TÁTICO|família TE/i.test(a.promptA.replace(/Manual MTY|do manual|no manual/gi, "")), "o pedido não fala de outro manual");
  console.log("  catálogo, princípios e pedidos de plano (jogador, bola vermelha, turma)");

  /* Táticas */
  let t = await p.evaluate(() => document.body.innerText);
  for (const s of ["A situação de jogo", "Os quatro estados do ponto", "Onde estão as situações no catálogo", "Da leitura à transferência", "Nível por situação", "O que ensinar primeiro", "Como variar uma situação", "Medir decisão e execução", "Mais termos de trabalho", "Tática por situação de placar"])
    assert(new RegExp(s, "i").test(t), "Táticas: " + s);
  assert(/DT031 a DT042/.test(t) && /IP021 a IP032/.test(t) && /DP013 a DP024/.test(t), "tabela de onde estão");
  assert(/Y5–Y6 · Desenvolvimento competitivo/i.test(t), "nível na escada Y");
  await p.getByRole("button", { name: /Placar e momento do ponto/ }).click();
  assert(/Break point no saque/.test(await p.evaluate(() => document.body.innerText)), "contextos abrem");
  await cap("situacoes-01-taticas", "#situacao-jogo");
  /* Condução, Aulas, Como decide */
  await p.evaluate(() => window.__aba("conducao")); await p.waitForTimeout(200);
  t = await p.evaluate(() => document.body.innerText);
  assert(/Perguntas que ajudam a decidir/i.test(t) && /Vou observar este bloco sem indicar a jogada/.test(t), "Condução");
  await p.evaluate(() => window.__aba("aulas")); await p.waitForTimeout(200);
  t = await p.evaluate(() => document.body.innerText);
  assert(/Como desenhar uma tarefa de situação/i.test(t) && /Formatos de prática/i.test(t) && /Ciclo inicial de oito sessões/i.test(t), "Aulas");
  assert(/IP022, IP030 e IP031/.test(t) && /DT031 DT032 DT034; E01 E02/.test(t), "sessões com os códigos do catálogo");
  await p.getByRole("button", { name: /E06 · Saque com três respostas possíveis/ }).click();
  assert(/IP022 a IP031; IP034 a IP040/.test(await p.evaluate(() => document.getElementById("formato-E06").innerText)), "formato E06");
  await cap("situacoes-02-aulas", "#formatos-pratica");
  await p.evaluate(() => window.__aba("metodo")); await p.waitForTimeout(200);
  t = await p.evaluate(() => document.body.innerText);
  assert(/O que a pesquisa sustenta/i.test(t) && /Representatividade/.test(t), "Como decide");
  /* cartão */
  await p.evaluate(() => window.__aba("cartao")); await p.waitForTimeout(200);
  await p.getByText("Saque aberto e espaço disponível").first().click(); await p.waitForTimeout(200);
  t = await p.evaluate(() => document.body.innerText);
  assert(/\bLer\b/i.test(t) && /Deslocamento real de B/.test(t) && /Indicador/i.test(t) && /Terceiras bolas escolhidas/.test(t) && !/Ficha S02/.test(t), "cartão: " + t.slice(0, 400));
  await cap("situacoes-03-cartao");
  console.log("  Táticas, Condução, Aulas, Como decide e cartão do exercício");

  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  console.log("check-situacoes-jogo: ok");
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
