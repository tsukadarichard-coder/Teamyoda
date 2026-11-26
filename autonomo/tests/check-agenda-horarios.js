/* Agenda e horários fixos (26/11/2026, "quando a gente retira o horário da aula e o aluno está numa turma, continua conflitando o
   horário na agenda" e "excluir para as semanas seguintes... não está excluindo"): mty/index.html inteiro, modo local.
   · horário que saiu da ficha: as próximas aulas daquela série saem da Agenda (passadas e com presença marcada ficam);
   · Agenda › Apagar da agenda › Esta e as próximas: tira o horário fixo da turma, apaga as próximas e elas não voltam ao trocar de semana.
   Usa React/Babel locais (defina CDN_DIR). Rode: node tests/check-agenda-horarios.js [pasta-das-capturas] */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("check-agenda-horarios: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
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
/* Nicolas teve aula individual às 17:00 (amanhã), mas o horário saiu da ficha; ele também está na turma Sub-12 */
const ALUNOS = [
  { ...fichaBase, id: "a1", nome: "Nicolas Prado", horarios: [] },
  { ...fichaBase, id: "a2", nome: "Pedro Lima", horarios: [{ dia, hora: "23:58", quadraId: "q1" }] },
];
const TURMAS = [{ id: "t1", nome: "Sub-12", membros: ["a1", "a2"], horarios: [{ dia, hora: "23:59", quadraId: "q1" }], duracaoPadrao: "1h" }];
const w1 = diaDe(desloca(1)), chaveA1 = "individual:a1:" + w1 + ":17:00";
const oc = (id, data, extra) => ({ id, origemTipo: "individual", origemId: "a1", recorrenciaChave: chaveA1, data, horaInicio: "17:00", horaFim: "18:00", quadraId: "q1",
  professorUid: "", professorNome: "", tipo: "regular", status: "agendada", presencas: {}, ...extra });
const OCORRENCIAS = [
  oc("a1-amanha", desloca(1)), oc("a1-semana2", desloca(8)), oc("a1-passada", desloca(-6), { status: "realizada" }),
  oc("a1-com-presenca", desloca(15), { presencas: { a1: "presente" } }),
  { ...oc("a2-hoje", iso(hoje)), origemId: "a2", recorrenciaChave: "individual:a2:" + dia + ":23:58", horaInicio: "23:58", horaFim: "23:59" },
];
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

    /* 1. horário que saiu da ficha: as próximas aulas daquela série saem da Agenda (passada e com presença ficam) */
  await p.waitForTimeout(1500);
  let ocs = await lerLS("shared:mty:ocorrencias:v1");
  const ids = new Set(ocs.map((o) => o.id));
  assert(!ids.has("a1-amanha") && !ids.has("a1-semana2"), "aulas futuras sem horário fixo saíram: " + [...ids].join(","));
  assert(ids.has("a1-passada") && ids.has("a1-com-presenca") && ids.has("a2-hoje"), "passada, com presença e as que têm horário ficam");

  /* 2. Agenda › Apagar da agenda › Esta e as próximas: tira o horário fixo e as próximas não voltam */
  await ir("Agenda");
  await p.waitForSelector('main button:has-text("Sub-12")', { timeout: 15000 });
  await p.click('main button:has-text("Sub-12")');
  await p.waitForSelector('[role="dialog"][aria-label="Detalhes do compromisso"] [data-edicao-ocorrencia]');
  await p.click('[data-edicao-ocorrencia] button:has-text("Apagar da agenda")');
  await p.click('[data-edicao-ocorrencia] label:has-text("Esta e as próximas")');
  await cap(p, "agenda-apagar-proximas");
  await p.click('[data-edicao-ocorrencia] button:text-is("Apagar")');
  await p.waitForTimeout(600);
  const turmas = await lerLS("shared:mty:turmas:v1");
  assert.deepStrictEqual(turmas.find((x) => x.id === "t1").horarios, [], "o horário fixo da turma saiu");
  ocs = await lerLS("shared:mty:ocorrencias:v1");
  assert.strictEqual(ocs.filter((o) => o.origemId === "t1" && o.data >= iso(hoje)).length, 0, "nenhuma aula da turma daqui pra frente");
  /* outras semanas: nada volta */
  for (let k = 0; k < 2; k++) { await p.click('main button[aria-label*="róxim"]').catch(() => {}); await p.waitForTimeout(400); }
  await p.click('main button:has-text("Hoje")').catch(() => {});
  await p.waitForTimeout(600);
  ocs = await lerLS("shared:mty:ocorrencias:v1");
  assert.strictEqual(ocs.filter((o) => o.origemId === "t1" && o.data >= iso(hoje)).length, 0, "trocando de semana, as aulas apagadas não voltam");
  assert(ocs.some((o) => o.id === "a2-hoje"), "a aula do Pedro continua");
  assert.deepStrictEqual(p.erros, [], "erros de JS: " + p.erros.join(" | "));
  console.log("check-agenda-horarios: ok");
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
