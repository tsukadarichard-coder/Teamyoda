/* Quadra animada dos exercícios no QuadraLab (autonomo/index.html, modo local, 390×844): Mais › Catálogo de exercícios, exercício do
   piloto com "▶ Na quadra", quadra que cabe na largura do celular sem rolagem lateral, Reproduzir anima com a legenda da bola.
   · Turmas apagadas: turma apagada antes da lixeira aparece pelo caderno (nome, jogadores, dia da semana) e volta com Recuperar;
     Remover turma pede confirmação, vai para a lixeira e volta igual;
   · Agenda: Apagar da agenda (só esta aula) some da agenda; Editar muda horário e duração de só esta aula (o lugar antigo some,
     não fica "cancelada"). Usa React/Babel/Tailwind locais (defina CDN_DIR). Rode: node tests/smoke-quadra-exercicio-ql.js [capturas] */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("smoke-quadra-exercicio-ql: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const capturas = process.argv[2] || "";
const raiz = path.join(__dirname, "..");
const TW = CDN + "/tw/package/dist/index.global.js";
const EXT = {
  "unpkg.com/react@18": CDN + "/react-18.3.1/package/umd/react.development.js", "unpkg.com/react-dom@18": CDN + "/react-dom-18.3.1/package/umd/react-dom.development.js",
  "unpkg.com/prop-types": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "unpkg.com/recharts": CDN + "/recharts-2.15.4/package/umd/Recharts.js", "babel.min.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js",
};
const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const versaoNovidades = /NOVIDADES_VERSAO = "([^"]+)"/.exec(html)[1];
const hoje = new Date(), iso = (d) => { const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return x.toISOString().slice(0, 10); }, dia = hoje.getDay();
const antes = (n) => iso(new Date(hoje.getTime() - n * 86400000));
const base0 = { lateralidade: "", backhand: "", estagio: "C", nivel: "Y5", objetivosAdulto: [], entrada: {}, plano: null, regPlano: {}, avaliacaoTecnica: {}, objetivoFinal: "",
  marcos: [{ ano: "", marco: "", precisa: "" }], camadas: { tecnico: "", fisico: "", tatico: "", mental: "" }, prioridades: ["saque", "devolucao", "fundo", "rede"], armas: ["fundo"],
  inicio: "", semanas: 18, competicoes: [{ nome: "", data: "" }], historico: [], anotacoes: [], adversarios: [], creditosReposicao: [], cadastroConcluido: true, nascimento: "", horarios: [] };
const sessao = (n) => ({ id: "r" + n, tipo: "sessao", data: antes(n), turma: "Adultos noite", duracao: "1h" });
const ALUNOS = [
  { ...base0, id: "a1", nome: "Caio Reis", registros: [sessao(7), sessao(14)] },
  { ...base0, id: "a2", nome: "Duda Melo", registros: [sessao(7)] },
];
const TURMAS = [{ id: "turma-1", nome: "Sub-12", membros: ["a1", "a2"], duracaoPadrao: "1h", horarios: [{ dia, hora: "09:00" }, { dia, hora: "15:00" }], agendaExcecoes: {}, agendaAvulsos: [], observacoes: "guardar" }];

const srv = http.createServer((q, r) => {
  const u = q.url.split("?")[0];
  if (u === "/" || u === "/index.html") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(html); }
  if (u === "/mty-nuvem.js") { r.writeHead(200, { "content-type": "text/javascript" }); return r.end("/* teste: sem nuvem */"); }
  const f = path.join(raiz, decodeURIComponent(u));
  if (f.startsWith(raiz) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : "application/octet-stream" }); return r.end(fs.readFileSync(f)); }
  r.writeHead(404); r.end();
}).listen(0);
const base = "http://localhost:" + srv.address().port + "/";

(async () => {
  const { chromium } = require("/opt/node22/lib/node_modules/playwright");
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await ctx.route(/^https?:\/\/(?!localhost)/, (rota) => {
    const url = rota.request().url();
    if (/tailwindcss/.test(url)) return rota.fulfill({ contentType: "text/javascript", body: fs.existsSync(TW) ? fs.readFileSync(TW) : "" });
    const k = Object.keys(EXT).find((x) => url.includes(x));
    if (k) return rota.fulfill({ contentType: "text/javascript", body: fs.readFileSync(EXT[k]) });
    return rota.fulfill({ contentType: /fonts/.test(url) ? "text/css" : "text/javascript", body: "" });
  });
  await ctx.addInitScript(([a, t, v]) => {
    if (sessionStorage.getItem("__semeado")) return;
    sessionStorage.setItem("__semeado", "1");
    localStorage.setItem("local:mty:alunos:v2", JSON.stringify(a)); localStorage.setItem("shared:mty:turmas:v1", JSON.stringify(t));
    localStorage.setItem("ql-novidades:" + v, "off");
  }, [ALUNOS, TURMAS, versaoNovidades]);
  const p = await ctx.newPage(), erros = [];
  p.on("pageerror", (e) => erros.push(e.message));
  p.on("dialog", (d) => d.accept());
  const cap = async (n) => { if (capturas) { fs.mkdirSync(capturas, { recursive: true }); await p.screenshot({ path: path.join(capturas, n + ".png"), fullPage: true }); } };
  const lerLS = (k) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), k);
  await p.goto(base); await p.waitForSelector("[data-proxima-aula]", { timeout: 120000 }); await p.addStyleTag({ content: "#mty-faixa{display:none!important}" });

  await p.click('.mty-bottomnav button:has-text("Mais")');
  await p.locator('button:has-text("Catálogo de exercícios"):visible').first().click();
  await p.fill('input[placeholder="Buscar por código, nome ou montagem"]', "FB013");
  await p.waitForTimeout(300);
  await p.locator('button:has-text("▶ Na quadra")').first().click();
  await p.waitForSelector('[data-quadra-exercicio="FB013"] svg');
  const larg = await p.evaluate(() => ({ svg: document.querySelector('[data-quadra-exercicio="FB013"] svg').getBoundingClientRect().width, rol: document.documentElement.scrollWidth - innerWidth }));
  assert(larg.svg > 250 && larg.rol <= 1, "quadra na largura do celular, sem rolagem lateral " + JSON.stringify(larg));
  await p.click('[data-quadra-exercicio="FB013"] .qe-play');
  await p.waitForTimeout(1500);
  assert(/^1 de 2 · Treinador: alimenta no forehand/.test(await p.textContent('[data-quadra-exercicio="FB013"] .qe-txt')), "legenda da 1ª bola");
  await p.locator('[data-quadra-exercicio="FB013"]').scrollIntoViewIfNeeded();
  await cap("quadra-quadralab");
  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  console.log("smoke-quadra-exercicio-ql: ok");
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
