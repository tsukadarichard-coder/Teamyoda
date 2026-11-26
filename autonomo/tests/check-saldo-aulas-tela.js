/* Mensalidade de N aulas na tela (26/11/2026, pedido do Richard): mty/index.html inteiro, modo local.
   · página do jogador: cartão "Mensalidade de 3 aulas por mês" com feitas, para repor e crédito da academia (a mesma conta do
     QLAulasMes.saldoDeAulas);
   · + Agendar › Aula individual › Repetir semanalmente: o campo "Mensalidade cobre" grava aulasPagasMes/aulasPagasDesde na ficha.
   Usa React/Babel locais (defina CDN_DIR). Rode: node tests/check-saldo-aulas-tela.js [pasta-das-capturas] */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("check-saldo-aulas-tela: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const capturas = process.argv[2] || "";
const raiz = path.join(__dirname, "..", "..", "mty");
const TW = CDN + "/tw/package/dist/index.global.js";
const EXT = {
  "unpkg.com/react@18": CDN + "/react-18.3.1/package/umd/react.development.js", "unpkg.com/react-dom@18": CDN + "/react-dom-18.3.1/package/umd/react-dom.development.js",
  "unpkg.com/prop-types": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "unpkg.com/recharts": CDN + "/recharts-2.15.4/package/umd/Recharts.js", "babel.min.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js",
};
let html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
/* versão geral e a da equipe (quando o item novo é só do financeiro): as duas ficam dispensadas */
const versaoNovidades = [...html.matchAll(/NOVIDADES_TY_VERSAO(?:_EQUIPE)? = "([^"]+)"/g)].map((x) => x[1]);
/* perfil do teste: papel e academia pela URL (o app sem login não tem perfil) */
html = html.replace("const [papelAtual, setPapelAtual] = useState(null);", 'const [papelAtual, setPapelAtual] = useState(new URLSearchParams(location.search).get("papel") || null);')
  .replace("const [orgAtual, setOrgAtual] = useState(null);", 'const [orgAtual, setOrgAtual] = useState(new URLSearchParams(location.search).get("org") || null);');
assert(html.includes('get("papel")') && html.includes('get("org")'), "injeção do perfil");

const hoje = new Date(), iso = (d) => d.toISOString().slice(0, 10), dia = hoje.getDay();
/* jogadores com os campos que a ficha sempre tem (como novoAluno no app) */
const fichaBase = { nascimento: "", lateralidade: "", backhand: "", estagio: "C", nivel: "Y5", objetivosAdulto: [], entrada: {}, plano: null, regPlano: {}, avaliacaoTecnica: {},
  objetivoFinal: "", marcos: [{ ano: "", marco: "", precisa: "" }], camadas: { tecnico: "", fisico: "", tatico: "", mental: "" }, prioridades: ["saque", "devolucao", "fundo", "rede"], armas: ["fundo"],
  inicio: "", semanas: 18, competicoes: [{ nome: "", data: "" }], historico: [], registros: [], anotacoes: [], adversarios: [], creditosReposicao: [], professorUid: "", professorNome: "", duracaoPadrao: "1h", criteriosClassificacao: {} };
const desloca = (n) => iso(new Date(hoje.getTime() + n * 86400000));
const diaDe = (d) => new Date(d + "T00:00:00").getDay();
/* Nicolas: mensalidade de 3 aulas desde o mês passado, com 5 aulas dadas nele; horário fixo todos os dias às 23:59 */
const mesPassado = (() => { const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); })();
const ALUNOS = [
  { ...fichaBase, id: "a1", nome: "Nicolas Prado", aulasPagasMes: 3, aulasPagasDesde: mesPassado, horarios: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dia: d, hora: "23:59", quadraId: "q1" })) },
  { ...fichaBase, id: "a2", nome: "Pedro Lima", horarios: [] },
];
const TURMAS = [];
const OCORRENCIAS = [1, 2, 3, 4, 5].map((n) => ({ id: "p" + n, origemTipo: "individual", origemId: "a1", recorrenciaChave: null, data: mesPassado + "-0" + n, horaInicio: "08:00", horaFim: "09:00", quadraId: "q1",
  professorUid: "", professorNome: "", tipo: "regular", status: "realizada", presencas: { a1: "presente" } }));
/* o que o app deve mostrar: a mesma conta, aqui no Node */
const Q = require(path.join(raiz, "aulas-mes.js"));
const hojeISO = iso(new Date(hoje.getTime() - hoje.getTimezoneOffset() * 60000));
Q.definirMarco(Q.marcoVigente("team-yoda", hojeISO));
const ESPERADO = Q.saldoDeAulas({ ocorrencias: OCORRENCIAS, alunos: ALUNOS, turmas: TURMAS, hoje: hojeISO, alunoId: "a1" });
const QUADRAS = [{ id: "q1", nome: "Quadra 1" }];

const srv = http.createServer((q, r) => {
  const u = q.url.split("?")[0];
  if (u === "/" || u === "/index.html") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(html); }
  if (u === "/mty-nuvem.js") { r.writeHead(200, { "content-type": "text/javascript" }); return r.end("/* teste: sem nuvem */"); }
  const f = path.join(raiz, decodeURIComponent(u));
  if (f.startsWith(raiz) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : f.endsWith(".css") ? "text/css" : "application/octet-stream" }); return r.end(fs.readFileSync(f)); }
  r.writeHead(404); r.end();
}).listen(0);
const base = "http://localhost:" + srv.address().port + "/";

(async () => {
  const { chromium } = require("/opt/node22/lib/node_modules/playwright");
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  async function contexto(largura, altura) {
    const ctx = await b.newContext({ viewport: { width: largura, height: altura || 860 } });
    await ctx.route(/^https?:\/\/(?!localhost)/, (rota) => {
      const url = rota.request().url();
      if (/tailwindcss/.test(url)) return rota.fulfill({ contentType: "text/javascript", body: fs.existsSync(TW) ? fs.readFileSync(TW) : "" });
      const k = Object.keys(EXT).find((x) => url.includes(x));
      if (k) return rota.fulfill({ contentType: "text/javascript", body: fs.readFileSync(EXT[k]) });
      if (/fonts\.googleapis|fonts\.gstatic/.test(url)) return rota.fulfill({ contentType: "text/css", body: "" });
      return rota.fulfill({ contentType: "text/javascript", body: "" });
    });
    await ctx.addInitScript((oc) => { window.__OC = oc; }, OCORRENCIAS);
    await ctx.addInitScript(([a, t, qd, v]) => {
      if (sessionStorage.getItem("__semeado")) return;
      sessionStorage.setItem("__semeado", "1");
      if (!localStorage.getItem("local:mty:alunos:v2")) {
        localStorage.setItem("local:mty:alunos:v2", JSON.stringify(a)); localStorage.setItem("shared:mty:turmas:v1", JSON.stringify(t));
        localStorage.setItem("shared:mty:quadras:v1", JSON.stringify(qd)); localStorage.setItem("shared:mty:onboardingDispensado", "true");
        localStorage.setItem("shared:mty:ocorrencias:v1", JSON.stringify(window.__OC));
        [].concat(v).forEach((x) => localStorage.setItem("ql-novidades:" + x, "off"));
      }
    }, [ALUNOS, TURMAS, QUADRAS, versaoNovidades]);
    return ctx;
  }
  async function abrir(ctx, query) {
    const p = await ctx.newPage(); p.erros = [];
    p.on("pageerror", (e) => p.erros.push(e.message));
    await p.goto(base + (query || ""));
    await p.waitForSelector("main.mty-main [data-hoje-resumo], main.mty-main h1", { timeout: 120000 });
    return p;
  }
  const cap = async (p, n) => { if (capturas) { fs.mkdirSync(capturas, { recursive: true }); await p.screenshot({ path: path.join(capturas, n + ".png") }); } };
  const semRolagemLateral = async (p, rot) => { const w = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); assert(w <= 1, rot + ": rolagem lateral de " + w + " px"); };
  const margemMain = async (p) => { await p.waitForTimeout(350); return p.evaluate(() => parseFloat(getComputedStyle(document.querySelector("main.mty-main")).marginLeft)); };
  const ativo = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s + ' [aria-current="page"]'); return e ? e.getAttribute("aria-label") || e.textContent.trim() : null; }, sel);

  const ctx = await contexto(1280, 900);
  const p = await abrir(ctx, "?papel=coordenador&org=team-yoda");
  p.on("dialog", (d) => d.accept());
  const ir = async (rotulo) => { await p.click('[data-menu-lateral] button:has-text("' + rotulo + '")'); await p.waitForTimeout(400); };
  const lerLS = (k) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), k);

    /* 1. página do jogador: cartão da mensalidade de 3 aulas com feitas, para repor e crédito */
  await ir("Jogadores");
  await p.click('main button:has-text("Nicolas Prado")');
  await p.waitForSelector("[data-saldo-aulas]", { timeout: 15000 });
  const t1 = await p.innerText("[data-saldo-aulas]");
  assert(/Mensalidade de 3 aulas por mês/i.test(t1), t1);
  const num = (rot) => { const m = new RegExp(rot + "\\s*\\n\\s*(\\d+)").exec(t1); return m ? Number(m[1]) : null; };
  assert.strictEqual(num("Feitas neste mês"), ESPERADO.feitasNoMes, t1);
  assert.strictEqual(num("Para repor"), ESPERADO.aRepor, t1);
  assert.strictEqual(num("Crédito da academia"), ESPERADO.credito, t1);
  await p.click('[data-saldo-aulas] button:has-text("Ver mês a mês")');
  await cap(p, "saldo-aulas-jogador");

  /* 2. + Agendar › aula individual que se repete: escolhe a mensalidade de 3 aulas e ela vai para a ficha */
  await ir("Agenda");
  await p.getByRole("button", { name: /Agendar/ }).first().evaluate((e) => e.click());
  await p.click('[aria-label="Agendar"] button:has-text("Aula individual")');
  await p.selectOption('[data-escolher="individual"]', "a2");
  const horas = p.locator('[aria-label="Agendar"] input[type="time"]');
  await horas.nth(0).fill("06:00"); await horas.nth(1).fill("07:00");
  await p.click('[aria-label="Agendar"] button:has-text("Repetir semanalmente")');
  await p.waitForSelector('[aria-label="Agendar"] [data-aulas-pagas] select');
  await p.selectOption('[aria-label="Agendar"] [data-aulas-pagas] select', "3");
  await cap(p, "saldo-aulas-agendar");
  await p.click('[aria-label="Agendar"] button:text-is("Agendar")');
  await p.waitForTimeout(700);
  const a2 = (await lerLS("local:mty:alunos:v2")).find((a) => a.id === "a2");
  assert.strictEqual(a2.aulasPagasMes, 3, "mensalidade de 3 aulas gravada na ficha");
  assert(/^\d{4}-\d{2}$/.test(a2.aulasPagasDesde || ""), "mês de início gravado: " + a2.aulasPagasDesde);
  assert.strictEqual((a2.horarios || []).length, 1, "o horário fixo também entrou");
  assert.deepStrictEqual(p.erros, [], "erros de JS: " + p.erros.join(" | "));
  console.log("check-saldo-aulas-tela: ok");
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
