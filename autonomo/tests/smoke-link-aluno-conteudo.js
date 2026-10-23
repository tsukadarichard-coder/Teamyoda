/* Página do link do aluno (aluno.html) com a function real ver-aluno.js por trás (Firestore de mentira), nos dois apps:
   aparecem o planejamento da turma, as análises de movimento (o relatório completo abre com as fotos), os jogos com scout
   (abrem a página do scout com o mesmo resumo da família) e os jogos em vídeo.
   Rode: node tests/smoke-link-aluno-conteudo.js [pasta-das-capturas] */
const fs = require("fs"), path = require("path"), http = require("http");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const assert = require("assert");
const capturas = process.argv[2] || "";

const FOTO = "data:image/svg+xml;base64," + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="64"><rect width="48" height="64" fill="#123"/></svg>').toString("base64");
const plano = (t) => ({ aprovado: true, tipo: "Ciclo de construção", prioridade: "Construção de ponto", blocos: [{ nome: "Bloco 1", semanasLista: [{ n: 1, foco: "Construção", aulas: [{ t: t + " 1" }, { t: t + " 2" }] }] }] });
const mov = (id, criadoEm, ok) => ({ id, criadoEm, golpe: "forehand", emp: "", dom: "D", itens: [{ n: "Flexão de joelhos no giro", s: "atencao", v: 148, u: "°", r: "90 ± 10" }], res: { ok, atencao: 3, nao: 5 }, texto: "Base alta no giro.", prio: ["Flexão de joelhos no giro"] });

function dadosIniciais() {
  return {
    "mty:alunos:v2": { value: JSON.stringify([
      { id: "a1", nome: "Ana Souza", linkToken: "tok123", horarios: [], plano: plano("Individual"), regPlano: {}, movimentos: [mov("mv1", "2026-09-01T10:00:00Z", 4)],
        jogosVideo: [{ id: "jv1", criadoEm: "2026-09-20T10:00:00Z", res: { total: 30, pctGanhos: 60, batidasMedia: 4.2 } }] },
    ]) },
    "mty:turmas:v1": { value: JSON.stringify([{ id: "t1", nome: "Turma Sub-12", membros: ["a1"], plano: plano("Aula da turma"), regPlano: { A01: { feita: true } }, horarios: [{ dia: 6, hora: "09:00" }] }]) },
    "mty:movidx:v1:a1": { value: JSON.stringify({ itens: [mov("mv2", "2026-10-01T10:00:00Z", 5)], removidos: [] }) },
    "mty:movrel:v1:mv2": { value: JSON.stringify({ id: "mv2", alunoId: "a1", criadoEm: "2026-10-01T10:00:00Z", golpe: "forehand", emp: "", dom: "D", atleta: "Ana Souza",
      resultado: { golpe: "forehand", nomes: ["Preparação", "Giro"], fases: [{ nome: "Preparação", quadro: 0, t: 0 }, { nome: "Giro", quadro: 1, t: 0.5 }],
        itens: [{ fase: 1, nome: "Flexão de joelhos no giro", valor: 148, unidade: "°", ref: "90 ± 10", status: "atencao", comentario: "Pouca flexão de joelhos: base alta." }],
        resumo: { ok: 5, atencao: 1, nao_avaliavel: 0 } }, fotos: [FOTO, FOTO], resumo: mov("mv2", "2026-10-01T10:00:00Z", 5) }) },
    "mty:paraAluno:v1:a1": { value: JSON.stringify({ jogos: [{ id: "j1", atleta: "Ana", data: "2026-10-12", torneio: "Copa da Primavera", resultado: "6/4 6/3", concluida: true, n: 80, ganhos: 46, pctGanhos: 57.5,
      serie: [[1, 1, "15-0", "winner_nos"], [0, 1, "15-15", "erro_nos"]], sinais: ["Saque forte no primeiro serviço."], numeros: { aces: 3 }, zonas: {} }] }) },
  };
}

(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  for (const app of ["mty", "autonomo"]) {
    const raiz = path.join(__dirname, "..", app === "mty" ? "../mty" : ".");
    const fnDir = path.join(__dirname, "..", app === "mty" ? "../netlify/functions" : "netlify/functions");
    const dados = dadosIniciais();
    const docRef = (k) => ({ get: async () => ({ exists: k in dados, data: () => dados[k] }), set: async (v) => { dados[k] = v; } });
    const fakeAdmin = { firestore: () => ({ collection: () => ({ doc: () => ({ collection: () => ({ doc: docRef }) }) }) }) };
    const modPath = path.join(fnDir, "_firebase-admin.js");
    require.cache[require.resolve(modPath)] = { id: modPath, filename: modPath, loaded: true, exports: { admin: fakeAdmin, app: () => {} } };
    const { handler } = require(path.join(fnDir, "ver-aluno.js"));
    const srv = http.createServer(async (q, r) => {
      const u = new URL(q.url, "http://x");
      if (u.pathname === "/.netlify/functions/ver-aluno") {
        const out = await handler({ httpMethod: "GET", queryStringParameters: Object.fromEntries(u.searchParams) });
        r.writeHead(out.statusCode, out.headers); return r.end(out.body);
      }
      const f = path.join(raiz, decodeURIComponent(u.pathname));
      if (!f.startsWith(raiz) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { r.writeHead(404); return r.end(); }
      const tipo = f.endsWith(".html") ? "text/html; charset=utf-8" : f.endsWith(".css") ? "text/css" : f.endsWith(".png") ? "image/png" : "text/javascript";
      r.writeHead(200, { "content-type": tipo }); r.end(fs.readFileSync(f));
    }).listen(0);
    const base = "http://localhost:" + srv.address().port;
    const ctx = await b.newContext({ viewport: { width: 390, height: 900 } });
    const erros = [];
    const p = await ctx.newPage();
    p.on("pageerror", (e) => erros.push(e.message));
    await p.goto(base + "/aluno.html?org=demo&id=a1&t=tok123");
    await p.waitForSelector("[data-painel=movimentos]", { timeout: 20000 });
    const t = await p.evaluate(() => document.body.innerText);
    assert(/Planejamento da turma · Turma Sub-12/i.test(t), app + ": planejamento da turma no link");
    assert(/1 de 2\s*aulas realizadas/.test(t), app + ": progresso da turma");
    assert(/Análises de movimento/i.test(t) && (t.match(/Ver relatório/g) || []).length === 2, app + ": as 2 análises (ficha + arquivo)");
    assert(/Seus jogos \(scout\)/i.test(t) && /Copa da Primavera/.test(t), app + ": jogos com scout");
    assert(/Jogos em vídeo/i.test(t) && /30 pontos · 60% ganhos/.test(t), app + ": jogos em vídeo");
    if (capturas) { fs.mkdirSync(capturas, { recursive: true }); await p.screenshot({ path: path.join(capturas, app + "-link-aluno.png"), fullPage: true }); }

    // relatório completo de uma análise (com fotos e comentários)
    let [pop] = await Promise.all([p.waitForEvent("popup"), p.click("[data-acao=ver-movimento][data-id=mv2]")]);
    await pop.waitForFunction(() => /^Análise de movimento/.test(document.title), null, { timeout: 10000 });
    let tr = await pop.evaluate(() => document.body.innerText);
    assert(/Checklist por fase/.test(tr) && /Pouca flexão de joelhos: base alta/.test(tr) && /Ana Souza/.test(tr), app + ": relatório completo da análise");
    assert.strictEqual(await pop.locator(".fotos img").count(), 2, app + ": com as fotos das fases");
    if (capturas) await pop.screenshot({ path: path.join(capturas, app + "-link-aluno-relatorio.png"), fullPage: true });
    await pop.close();
    // análise antiga (sem arquivo): relatório resumido
    [pop] = await Promise.all([p.waitForEvent("popup"), p.click("[data-acao=ver-movimento][data-id=mv1]")]);
    await pop.waitForFunction(() => /^Análise de movimento/.test(document.title), null, { timeout: 10000 });
    tr = await pop.evaluate(() => document.body.innerText);
    assert(/antes de o app guardar o relatório completo/.test(tr) && /Base alta no giro/.test(tr), app + ": análise antiga abre pelo resumo");
    await pop.close();

    // jogo: abre a página do scout com o resumo
    const href = await p.getAttribute("[data-painel=jogos] a", "href");
    assert(/scout\/index\.html\?a=1&org=demo&id=a1&t=tok123&j=j1/.test(href), app + ": link do jogo");
    const pj = await ctx.newPage();
    pj.on("pageerror", (e) => erros.push("scout: " + e.message));
    await pj.goto(base + "/" + href);
    await pj.waitForFunction(() => /Partida de Ana/.test(document.body.innerText), null, { timeout: 15000 });
    const tj = await pj.evaluate(() => document.body.innerText);
    assert(/Saque forte no primeiro serviço/.test(tj) && /link de aluno/.test(tj), app + ": página do jogo pelo link do aluno");
    if (capturas) await pj.screenshot({ path: path.join(capturas, app + "-link-aluno-jogo.png"), fullPage: true });
    // token errado: nada abre
    await pj.goto(base + "/scout/index.html?a=1&org=demo&id=a1&t=errado&j=j1");
    await pj.waitForFunction(() => /inválido/i.test(document.body.innerText), null, { timeout: 15000 });

    assert.deepStrictEqual(erros, [], app + ": erros de JS " + erros.join(" | "));
    await ctx.close(); srv.close();
    console.log("smoke-link-aluno-conteudo " + app + ": ok");
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
