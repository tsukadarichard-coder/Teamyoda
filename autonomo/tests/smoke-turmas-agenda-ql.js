/* QuadraLab (autonomo/index.html inteiro, modo local, 390×844): turmas apagadas e agenda editável.
   · Turmas apagadas: turma apagada antes da lixeira aparece pelo caderno (nome, jogadores, dia da semana) e volta com Recuperar;
     Remover turma pede confirmação, vai para a lixeira e volta igual;
   · Agenda: Apagar da agenda (só esta aula) some da agenda; Editar muda horário e duração de só esta aula (o lugar antigo some,
     não fica "cancelada"). Usa React/Babel/Tailwind locais (defina CDN_DIR). Rode: node tests/smoke-turmas-agenda-ql.js [capturas] */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("smoke-turmas-agenda-ql: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
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

  /* ── turmas ── */
  await p.click('.mty-bottomnav button:has-text("Mais")');
  await p.locator('button:has-text("Turmas"):visible').first().click();
  await p.locator('button:has-text("Turmas apagadas"):visible').first().click();
  await p.waitForSelector("[data-turmas-apagadas]");
  let t = await p.locator("[data-turmas-apagadas]").innerText();
  assert(/Adultos noite/.test(t) && /Encontrada no caderno/.test(t) && /Caio Reis/.test(t) && /Duda Melo/.test(t), "achada pelo caderno: " + t);
  await cap("ql-turmas-apagadas");
  await p.click('[data-turmas-apagadas] button:has-text("Recuperar")');
  await p.waitForTimeout(400);
  let turmas = await lerLS("shared:mty:turmas:v1");
  const rec = turmas.find((x) => x.nome === "Adultos noite");
  assert(rec && rec.membros.length === 2 && rec.duracaoPadrao === "1h", "recriada com nome, jogadores e duração");
  await p.click('[data-turmas-apagadas] button:has-text("Fechar")');
  /* remover com confirmação → lixeira → volta igual */
  await p.locator('button:has-text("Abrir turma"):visible').first().click();
  await p.waitForTimeout(500);
  if (!(await p.locator('button:has-text("Remover turma")').count())) await p.click('button:text-is("Sessão")').catch(() => {});
  await p.click('button:has-text("Remover turma")');
  await p.waitForTimeout(400);
  assert(!(await lerLS("shared:mty:turmas:v1")).some((x) => x.id === "turma-1"), "removida");
  await p.locator('button:has-text("Turmas apagadas"):visible').first().click();
  await p.click('[data-turma-apagada="turma-1"] button:has-text("Recuperar")');
  await p.waitForTimeout(400);
  turmas = await lerLS("shared:mty:turmas:v1");
  assert(turmas.some((x) => x.id === "turma-1" && x.observacoes === "guardar" && x.horarios.length === 2), "voltou igual");

  /* ── agenda: apagar só a aula das 9h; editar a das 15h para 16:00–17:30 ── */
  await p.click('.mty-bottomnav button:has-text("Agenda")');
  await p.waitForSelector('button:has-text("09:00")', { timeout: 15000 });
  await p.click('button:has-text("09:00–10:00")');
  await p.click('button:has-text("Apagar da agenda")');
  await p.click('[data-apagar-aula] button:has-text("Só esta aula")');
  await p.waitForTimeout(400);
  assert.strictEqual(await p.locator('button:has-text("09:00–10:00")').count(), 0, "aula das 9h sumiu");
  turmas = await lerLS("shared:mty:turmas:v1");
  const sub = turmas.find((x) => x.id === "turma-1");
  assert.strictEqual(sub.agendaExcecoes[iso(hoje) + "|09:00"].status, "excluida");
  assert.strictEqual(sub.horarios.length, 2, "horário fixo continua (só esta aula)");
  await p.click('button:has-text("15:00–16:00")');
  await p.click('button:has-text("Editar (dia, horário, duração)")');
  await p.fill('[aria-label="Editar aula"] input[type="time"] >> nth=0', "16:00");
  assert.strictEqual(await p.inputValue('[aria-label="Editar aula"] input[type="time"] >> nth=1'), "17:00", "fim acompanha o início");
  await p.fill('[aria-label="Editar aula"] input[type="time"] >> nth=1', "17:30");
  await cap("ql-agenda-editar");
  await p.click('[aria-label="Editar aula"] button:has-text("Salvar")');
  await p.waitForTimeout(400);
  const txt = await p.locator("main").innerText();
  assert(/16:00–17:30/.test(txt) && !/15:00–16:00/.test(txt), "aula movida para 16:00–17:30 e o horário antigo sumiu (não ficou cancelada)");
  await cap("ql-agenda-depois");
  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  console.log("smoke-turmas-agenda-ql: ok");
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
