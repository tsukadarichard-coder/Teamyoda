/* QuadraLab (autonomo/index.html, modo local, 390×844): reposições ligadas à aula perdida e relatório de aulas.
   · + Reposição: quem tem aula a repor vem primeiro com a contagem; ao escolher o jogador, a lista das aulas a repor
     (canceladas, faltas, aula da turma cancelada) e a escolha de qual está sendo reposta, gravada na reposição;
   · Relatório de aulas (semana, mês, trimestre): a repor, reposições com a aula reposta, "Não vai repor", Agendar reposição
     da aula da turma direto do relatório; a aula cancelada aberta na Agenda mostra a reposição marcada.
   Rode: node tests/smoke-reposicoes-ql.js [capturas] */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("smoke-reposicoes-ql: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
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
const ALUNOS = [
  { ...base0, id: "a1", nome: "Caio Reis", duracaoPadrao: "1h", horarios: [{ dia, hora: "17:00" }], agendaAvulsos: [],
    agendaExcecoes: { [antes(7) + "|17:00"]: { status: "cancelada", motivo: "Chuva" }, [antes(14) + "|17:00"]: { status: "falta" } }, registros: [] },
  { ...base0, id: "a2", nome: "Duda Melo", registros: [] },
];
const TURMAS = [{ id: "turma-1", nome: "Sub-12", membros: ["a1", "a2"], duracaoPadrao: "1h", horarios: [{ dia, hora: "09:00" }],
  agendaExcecoes: { [antes(7) + "|09:00"]: { status: "cancelada" } }, agendaAvulsos: [] }];

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


  /* ── + Reposição: quem tem aula a repor vem primeiro, com a contagem ── */
  await p.click('.mty-bottomnav button:has-text("Agenda")');
  await p.waitForSelector('button:has-text("+ Reposição")', { timeout: 15000 });
  assert(/Relatório de aulas · 3 a repor/.test(await p.locator('button:has-text("Relatório de aulas")').innerText()), "botão do relatório com o total a repor");
  await p.click('button:has-text("+ Reposição")');
  const primeiro = await p.locator("[data-escolher-reposicao]").first().innerText();
  assert(/Caio Reis/.test(primeiro) && /3 aulas a repor/.test(primeiro), "Caio primeiro, com 3 aulas a repor: " + primeiro);
  assert(/1 aula a repor/.test(await p.locator('[data-escolher-reposicao="turma-1"]').innerText()), "turma com 1 a repor");
  await p.click('[data-escolher-reposicao="a1"]');
  await p.waitForSelector("[data-aulas-a-repor]");
  let lista = await p.locator("[data-aulas-a-repor]").innerText();
  assert(/Qual aula está sendo reposta\?/.test(lista) && /faltou/.test(lista) && /cancelada \(Chuva\)/.test(lista) && /aula da turma Sub-12 cancelada/.test(lista) && /Nenhuma: reposição extra/.test(lista), lista);
  assert(await p.locator('[data-repoe="ag:' + antes(14) + '|17:00"] input').isChecked(), "a mais antiga vem marcada");
  await p.click('[data-repoe="ag:' + antes(7) + '|17:00"]');
  await p.fill('[aria-label="Agendar aula"] input[type="time"]', "20:00");
  await cap("ql-reposicao-escolher-aula");
  await p.click('[aria-label="Agendar aula"] button:has-text("Agendar reposição")');
  await p.waitForTimeout(400);
  let alunos = await lerLS("local:mty:alunos:v2");
  const av = alunos.find((a) => a.id === "a1").agendaAvulsos[0];
  assert(av && av.reposicao && av.repoe === "ag:" + antes(7) + "|17:00" && av.data === iso(hoje) && /aula de .*cancelada \(Chuva\)/.test(av.repoeTexto) && /Reposição da aula de/.test(av.motivo), JSON.stringify(av));
  await p.click('button:has-text("+ Reposição")');
  assert(/2 aulas a repor/.test(await p.locator('[data-escolher-reposicao="a1"]').innerText()), "a aula reposta saiu da lista");
  await p.click('[aria-label="Fechar"]');

  /* ── a reposição aberta na Agenda diz o que repõe ── */
  await p.click('button:has-text("20:00–")');
  assert(/Repõe a aula de .*\(Chuva\)/.test(await p.locator("[data-repoe-info]").innerText()), "detalhe da reposição");
  await p.click('[aria-label="Fechar"]');

  /* ── relatório: período, a repor, não vai repor, agendar a da turma ── */
  await p.click('button:has-text("Relatório de aulas")');
  await p.waitForSelector("[data-relatorio-aulas]");
  await p.click('[data-periodo="trimestre"]');
  assert(/trimestre/.test(await p.locator("[data-rotulo-periodo]").innerText()));
  let rel = await p.locator("[data-relatorio-aulas]").innerText();
  assert(/Aulas a repor/.test(rel) && /Reposições do período/.test(rel) && /Por jogador e turma/.test(rel), rel.slice(0, 400));
  assert(/Repõe a aula de/.test(await p.locator("[data-reposicao-relatorio]").first().innerText()), "reposição do período com a aula reposta");
  const nRepor = Number(await p.locator("[data-total-a-repor]").getAttribute("data-total-a-repor"));
  assert(nRepor >= 2, "a repor no trimestre: " + nRepor);
  await cap("ql-relatorio-aulas");
  await p.click('[data-a-repor="ag:' + antes(14) + '|17:00"] button:has-text("Não vai repor")');
  await p.waitForTimeout(300);
  assert.strictEqual(await p.locator('[data-a-repor="ag:' + antes(14) + '|17:00"]').count(), 0, "não vai repor tira da lista");
  alunos = await lerLS("local:mty:alunos:v2");
  assert.deepStrictEqual(alunos.find((a) => a.id === "a1").repoDispensadas, ["ag:" + antes(14) + "|17:00"]);
  await p.click('[data-a-repor="ag:' + antes(7) + '|09:00"] button:has-text("Agendar reposição")');
  await p.waitForSelector("[data-aulas-a-repor]");
  assert(await p.locator('[data-repoe="ag:' + antes(7) + '|09:00"] input').isChecked(), "a aula da turma vem escolhida");
  assert(/Reposição · Sub-12/.test(await p.locator('[aria-label="Agendar aula"]').innerText()));
  await p.fill('[aria-label="Agendar aula"] input[type="time"]', "21:00");
  await p.click('[aria-label="Agendar aula"] button:has-text("Agendar reposição")');
  await p.waitForTimeout(400);
  const turmas = await lerLS("shared:mty:turmas:v1");
  assert.strictEqual(turmas[0].agendaAvulsos[0].repoe, "ag:" + antes(7) + "|09:00");
  assert.strictEqual(await p.locator('[data-a-repor="ag:' + antes(7) + '|09:00"]').count(), 0, "a aula da turma saiu da lista do relatório");
  await p.click('[data-periodo="semana"]');
  await p.click('[data-periodo="mes"]');
  await p.click('[data-relatorio-aulas] [aria-label="Período anterior"]');
  assert(/Outubro|Setembro|Agosto|Julho|Junho|Maio|Abril|Março|Fevereiro|Janeiro|Dezembro|Novembro/.test(await p.locator("[data-rotulo-periodo]").innerText()));
  await cap("ql-relatorio-mes-anterior");
  await p.click('[aria-label="Relatório de aulas"] [aria-label="Fechar"]');

  /* ── aula cancelada aberta na Agenda: mostra a reposição marcada ── */
  await p.click('[role="tab"]:has-text("Semana")');
  await p.click('[aria-label="Período anterior"]');
  await p.locator('.mty-semana-mobile button:has-text("17:00 · Caio Reis")').first().click();
  assert(/Reposição marcada para/.test(await p.locator("[data-reposicao-da-aula]").innerText()), "aula cancelada mostra a reposição");
  assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
  console.log("smoke-reposicoes-ql: ok");
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
