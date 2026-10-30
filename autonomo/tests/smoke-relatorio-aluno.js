/* Aba Relatório do aluno, no navegador, com o app inteiro (modo local, sem login), nos dois apps:
   abre o jogador → Relatório; período e seções; observação do treinador guardada na ficha; "Gerar relatório (PDF)" abre um
   documento só com perfil, planejamento (andamento e critério), aulas, scout dos jogos e análise biomecânica.
   Usa React/Babel/Tailwind locais (defina CDN_DIR). Rode: node tests/smoke-relatorio-aluno.js [autonomo|mty] [pasta-das-capturas] */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("smoke-relatorio-aluno: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const capturas = process.argv[3] || "";
const TW = CDN + "/tw/package/dist/index.global.js";
const EXT = {
  "unpkg.com/react@18": CDN + "/react-18.3.1/package/umd/react.development.js", "unpkg.com/react-dom@18": CDN + "/react-dom-18.3.1/package/umd/react-dom.development.js",
  "unpkg.com/prop-types": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "unpkg.com/recharts": CDN + "/recharts-2.15.4/package/umd/Recharts.js", "babel.min.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js",
};
const M = require("../player/scout-motor.js");
/* um jogo com scout de verdade (motor do scout) */
function jogo(id, data, viesNos, resultado) {
  let e = M.placarInicial("3sets", "nos", false, false); const pontos = []; let s = id.length * 97;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 50 && !e.fim; i++) {
    const ganha = rnd() < viesNos, fim = ganha ? "winner_nos" : "erro_nos";
    pontos.push({ fim, nos: ganha, saque: "1", bola: "1-4", causa: ganha ? null : "decisao", jogo: M.numeroDoGame(e), adverso: M.ehAdverso(e), sacador: M.quemSaca(e), lado: M.ladoDoSaque(e) });
    e = M.aplicaPonto(e, ganha);
  }
  return { id, tipo: "jogo", data, torneio: "Copa Sul", adversario: "Rival " + id, resultado, concluida: true, scout: { ...M.resume(pontos), pontos } };
}
const fichaBase = { lateralidade: "destro", backhand: "2", estagio: "C", nivel: "Y5", objetivosAdulto: [], entrada: {}, avaliacaoTecnica: {}, objetivoFinal: "Jogar o estadual",
  marcos: [{ ano: "", marco: "", precisa: "" }], camadas: { tecnico: "", fisico: "", tatico: "", mental: "" }, prioridades: ["saque", "devolucao", "fundo", "rede"], armas: ["fundo"],
  inicio: "", semanas: 18, competicoes: [{ nome: "", data: "" }], historico: [], anotacoes: [], adversarios: [], creditosReposicao: [], professorUid: "", professorNome: "Richard", duracaoPadrao: "1h30",
  criteriosClassificacao: {}, cadastroConcluido: true, horarios: [] };
const plano = { tipo: "individual", geradoEm: "2026-09-01", blocos: [
  { titulo: "Base de consistência", saida: "8 de 10 bolas cruzadas no fundo", semanasLista: [{ n: 1, foco: "Consistência cruzada", aulas: [{ t: "Aula 1", ex: [] }, { t: "Aula 2", ex: [] }] }, { n: 2, foco: "Profundidade", aulas: [{ t: "Aula 3", ex: [] }] }] },
  { titulo: "Ataque", saida: "Fechar 3 de 5 pontos na rede", semanasLista: [{ n: 3, foco: "Transição", aulas: [{ t: "Aula 4", ex: [] }, { t: "Aula 5", ex: [] }] }] }] };
const hojeISO = new Date().toISOString().slice(0, 10);
const NICOLAS = { ...fichaBase, id: "a1", nome: "Nicolas Prado", nascimento: "2013-05-10", plano,
  regPlano: { A01: { status: "feita", data: "2026-09-08" }, A02: { status: "feita", data: "2026-09-15" }, A03: { status: "falta", data: "2026-09-22" } },
  registros: [jogo("j1", "2026-09-10", 0.42, "4-6 3-6"), jogo("j2", "2026-09-24", 0.55, "6-4 6-3"), jogo("j3", "2026-10-08", 0.6, "6-2 6-4"),
    { id: "s1", tipo: "sessao", data: "2026-09-08", ciclo: 1, duracao: 90, exercicios: ["Cruzada em 4 bolas", "Saque no T"], corrigi: "Base aberta" }],
  movimentos: [{ id: "m1", criadoEm: "2026-09-20T10:00:00.000Z", golpe: "saque", res: { ok: 7, atencao: 2, nao: 1 }, texto: "Lançamento um pouco à frente",
    prio: ["Flexão de joelho na carga"], itens: [{ n: "Flexão do joelho", v: 158, u: "°", r: "120–150°", s: "atencao" }, { n: "Altura do contato", v: 1.2, u: "", r: "", s: "ok" }] }] };

(async () => {
  const { chromium } = require("/opt/node22/lib/node_modules/playwright");
  const apps = process.argv[2] ? [process.argv[2]] : ["autonomo", "mty"];
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  for (const app of apps) {
    const raiz = app === "mty" ? path.join(__dirname, "../../mty") : path.join(__dirname, "..");
    let html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
    const versao = /NOVIDADES(?:_TY)?_VERSAO = "([^"]+)"/.exec(html)[1];
    if (app === "mty") html = html.replace("const [papelAtual, setPapelAtual] = useState(null);", 'const [papelAtual, setPapelAtual] = useState("coordenador");')
      .replace("const [orgAtual, setOrgAtual] = useState(null);", 'const [orgAtual, setOrgAtual] = useState("team-yoda");');
    const srv = http.createServer((q, r) => {
      const u = q.url.split("?")[0];
      if (u === "/" || u === "/index.html") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(html); }
      if (u === "/mty-nuvem.js") { r.writeHead(200, { "content-type": "text/javascript" }); return r.end("/* teste: sem nuvem */"); }
      const f = path.join(raiz, decodeURIComponent(u));
      if (f.startsWith(raiz) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : f.endsWith(".png") ? "image/png" : f.endsWith(".css") ? "text/css" : "application/octet-stream" }); return r.end(fs.readFileSync(f)); }
      r.writeHead(404); r.end();
    }).listen(0);
    const base = "http://localhost:" + srv.address().port + "/";
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.route(/^https?:\/\/(?!localhost)/, (rota) => { const url = rota.request().url();
      if (/tailwindcss/.test(url)) return rota.fulfill({ contentType: "text/javascript", body: fs.readFileSync(TW) });
      const k = Object.keys(EXT).find((x) => url.includes(x)); if (k) return rota.fulfill({ contentType: "text/javascript", body: fs.readFileSync(EXT[k]) });
      return rota.fulfill({ contentType: "text/javascript", body: "" }); });
    await ctx.addInitScript(([a, v]) => { if (sessionStorage.getItem("__s")) return; sessionStorage.setItem("__s", "1");
      localStorage.setItem("local:mty:alunos:v2", JSON.stringify(a)); localStorage.setItem("ql-novidades:" + v, "off"); localStorage.setItem("shared:mty:onboardingDispensado", "true"); }, [[NICOLAS], versao]);
    const p = await ctx.newPage(); const erros = []; p.on("pageerror", (e) => erros.push(e.message));
    await p.goto(base); await p.waitForSelector("main.mty-main h1", { timeout: 120000 }); await p.waitForTimeout(500);
    await p.locator(".mty-sidebar button", { hasText: /^Jogadores$/ }).first().click();
    await p.getByText("Nicolas Prado").first().click(); await p.waitForTimeout(500);
    await p.locator("button", { hasText: /^Relatório$/ }).first().click();
    await p.waitForSelector("[data-relatorio-aluno]", { timeout: 10000 });
    const t = await p.locator("[data-relatorio-aluno]").innerText();
    assert(/Relatório de Nicolas/.test(t) && /2 de 5 aulas do plano feitas/.test(t) && /3 jogos com scout/.test(t) && /1 análise/.test(t), app + ": resumo do que entra: " + t.slice(0, 400));
    /* observação do treinador fica guardada na ficha */
    await p.fill("#rel-obs", "Evoluiu muito no saque.\nPróximo foco: rede.");
    await p.locator("#rel-obs").blur(); await p.waitForTimeout(400);
    const salva = await p.evaluate(() => JSON.parse(localStorage.getItem("local:mty:alunos:v2"))[0].relatorioObs);
    assert.strictEqual(salva, "Evoluiu muito no saque.\nPróximo foco: rede.", app + ": observação guardada na ficha");
    if (capturas) { fs.mkdirSync(capturas, { recursive: true }); await p.screenshot({ path: path.join(capturas, "relatorio-aba-" + app + ".png"), fullPage: true }); }
    /* gerar: abre o documento com tudo */
    const [doc] = await Promise.all([ctx.waitForEvent("page"), p.getByRole("button", { name: "Gerar relatório (PDF)" }).click()]);
    await doc.waitForFunction(() => /Salvar como PDF/.test(document.body.innerText), null, { timeout: 15000 });
    const dt = await doc.evaluate(() => document.body.innerText);
    for (const x of ["NICOLAS PRADO".toLowerCase(), "perfil", "planejamento", "aulas no período", "scout dos jogos", "análise biomecânica", "observação do treinador"]) assert(dt.toLowerCase().includes(x), app + ": documento tem " + x);
    assert(/2 de 5/.test(dt) && /8 de 10 bolas cruzadas no fundo/.test(dt) && /bloco atual/i.test(dt), app + ": planejamento com andamento e critério");
    assert(/2 × 1/.test(dt) && /Evolução no período/i.test(dt), app + ": scout com vitórias e evolução");
    assert(/Flexão do joelho/.test(dt) && !/Altura do contato/.test(dt) && /Lançamento um pouco à frente/.test(dt), app + ": biomecânica com o que pede atenção");
    assert(/Evoluiu muito no saque/.test(dt) && /Cruzada em 4 bolas/.test(dt) && /12 anos|13 anos/.test(dt), app + ": observação, sessões e idade");
    if (capturas) { await doc.setViewportSize({ width: 900, height: 1200 }); await doc.screenshot({ path: path.join(capturas, "relatorio-doc-" + app + ".png"), fullPage: true }); }
    await doc.close();
    /* só uma seção e um período sem jogos */
    for (const rot of ["Perfil", "Planejamento", "Aulas no período", "Análise biomecânica"]) await p.locator("[data-relatorio-aluno] label").filter({ hasText: new RegExp("^" + rot) }).locator("input").click();
    await p.getByRole("radio", { name: "Escolher datas" }).click();
    await p.locator('input[type="date"]').first().fill("2026-10-01"); await p.locator('input[type="date"]').nth(1).fill("2026-10-31");
    const [doc2] = await Promise.all([ctx.waitForEvent("page"), p.getByRole("button", { name: "Gerar relatório (PDF)" }).click()]);
    await doc2.waitForFunction(() => /Salvar como PDF/.test(document.body.innerText), null, { timeout: 15000 });
    const d2 = await doc2.evaluate(() => document.body.innerText);
    assert(/De 01\/10\/2026 até 31\/10\/2026/.test(d2) && /1\s*jogo com scout/i.test(d2) && !/PLANEJAMENTO/i.test(d2.replace(/Este relatório organiza[^\n]*/, "")) && !/Análise biomecânica/i.test(d2), app + ": só o scout de outubro: " + d2.slice(0, 300));
    await doc2.close();
    assert.deepStrictEqual(erros, [], app + ": erros de JS " + erros.join(" | "));
    console.log("smoke-relatorio-aluno " + app + ": ok");
    await ctx.close(); srv.close();
  }
  await b.close();
})().catch((e) => { console.error(e.message || e); process.exit(1); });
