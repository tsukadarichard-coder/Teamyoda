/* QuadraLab Scout (scout-app/) no celular (390×844): do primeiro jogo à cópia dos jogos.
   · início vazio → marcar um jogo (atleta novo, torneio, adversário, set a 4 games) → pontos em 2 toques, ace em 1, desfazer, detalhes do último ponto;
   · fechar e abrir no meio do jogo continua do mesmo ponto; o fim aparece sozinho com placar, gráficos e o texto para compartilhar (sem adversário nem sobrenome);
   · segundo jogo, comparação jogo a jogo, página do atleta; cópia dos jogos baixada e carregada num celular limpo;
   · a contagem de uso manda só aparelho, evento e pontos; sem erro de JavaScript e sem rolagem lateral em nenhuma tela.
   Rode: node tests/smoke-scout-app.js [pasta-das-capturas] */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const raiz = path.join(__dirname, "..");
const capturas = process.argv[2] || "";
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png" };
const usos = [];
const srv = http.createServer((q, r) => {
  const u = q.url.split("?")[0];
  if (u === "/.netlify/functions/scout-app-uso") { let b = ""; q.on("data", (c) => (b += c)); q.on("end", () => { usos.push(b); r.writeHead(200, { "content-type": "application/json" }); r.end('{"ok":true}'); }); return; }
  let f = path.join(raiz, decodeURIComponent(u));
  if (u.endsWith("/")) f = path.join(f, "index.html");
  if (f.startsWith(raiz) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { "content-type": TIPOS[path.extname(f)] || "application/octet-stream" }); return r.end(fs.readFileSync(f)); }
  r.writeHead(404); r.end();
}).listen(0);
const base = "http://localhost:" + srv.address().port + "/scout-app/";

(async () => {
  const { chromium } = require("/opt/node22/lib/node_modules/playwright");
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, serviceWorkers: "block", acceptDownloads: true });
  const p = await ctx.newPage(); const erros = [];
  p.on("pageerror", (e) => erros.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text()) && !p.url().includes("/scout/?l=")) erros.push(m.text()); });
  const texto = () => p.evaluate(() => document.body.innerText); // rótulos em MAIÚSCULO via CSS: as conferências de rótulo usam tem()
  const tem = (t, trecho) => t.toLowerCase().includes(trecho.toLowerCase());
  const semRolagem = async (onde) => { const w = await p.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]); assert.ok(w[0] <= w[1], onde + ": rolagem lateral " + w); };
  const foto = async (nome) => { if (capturas) { fs.mkdirSync(capturas, { recursive: true }); await p.screenshot({ path: path.join(capturas, nome + ".png"), fullPage: true }); } };
  const pontos = () => p.textContent("[data-pontos]");
  const ponto = async (fim, bola) => { await p.click(`[data-fim="${fim}"]`); await p.click(`[data-bola="${bola || "5-9"}"]`); };

  /* quadralab.com.br/scout sem link de jogo abre o app; um link da família continua na página da família */
  await p.goto(base.replace("/scout-app/", "/scout/"), { waitUntil: "networkidle" });
  assert.ok(p.url().endsWith("/scout-app/"), "/scout leva ao app: " + p.url());
  await p.goto(base.replace("/scout-app/", "/scout/") + "?l=" + "a".repeat(32), { waitUntil: "domcontentloaded" });
  assert.ok(p.url().includes("/scout/?l="), "link ao vivo fica na página da família: " + p.url());
  await p.goto(base, { waitUntil: "networkidle" });
  assert.ok(await p.evaluate(() => { const i = document.querySelector(".marca img"); return i && i.complete && i.naturalWidth > 0; }), "logo carregado");
  let t = await texto();
  assert.ok(t.includes("Seus jogos") && t.includes("Nenhum jogo marcado ainda"), "início vazio: " + t.slice(0, 300));
  await semRolagem("início vazio"); await foto("scout-1-inicio-vazio");

  /* novo jogo */
  await p.click("[data-novo]");
  await p.fill("#nvNome", "Lucas Andrade");
  await p.fill("#nvTorneio", "Copa Sul");
  await p.fill("#nvAdv", "Fulano Secreto");
  await p.click('[data-formato="4games"]');
  assert.strictEqual(await p.inputValue("#nvNome"), "Lucas Andrade", "o nome continua depois de trocar o formato");
  assert.ok((await texto()).includes("Lucas"), "quem saca mostra o nome");
  await semRolagem("novo jogo"); await foto("scout-2-novo");
  await p.click("#btComecar");
  await p.waitForSelector("[data-pontos]");
  assert.strictEqual(await pontos(), "0-0");
  t = await texto();
  assert.ok(tem(t, "Saque de Lucas") && t.includes("Lucas × Fulano Secreto · Copa Sul"), "placar com saque e adversário (só no celular): " + t.slice(0, 300));

  /* 2 toques por ponto */
  await ponto("winner_nos");
  assert.strictEqual(await pontos(), "15-0");
  /* trocar o fim antes da bola */
  await p.click('[data-fim="erro_nos"]'); await p.click("#btTrocar"); await ponto("erro_dele", "1-4");
  assert.strictEqual(await pontos(), "30-0");
  /* desfazer */
  await p.click("#btDesfazer");
  assert.strictEqual(await pontos(), "15-0", "desfazer volta um ponto");
  /* ace em um toque */
  await p.click('[data-saq="ace"]');
  assert.strictEqual(await pontos(), "30-0", "ace marca o ponto");
  /* detalhes do último ponto */
  await p.click("#detPonto summary");
  await p.click('[data-det="golpe"] >> nth=0');
  const ult = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem("qls:v1")); const j = s.jogos[0]; return j.pontos[j.pontos.length - 1]; });
  assert.ok(ult.golpe && ult.saque === "ace" && ult.bola === "1-4", "detalhe gravado no último ponto: " + JSON.stringify(ult));
  await ponto("winner_nos"); await ponto("winner_nos"); // 1º game: 4 pontos
  assert.strictEqual(await p.textContent("[data-sets]"), "1-0");
  await ponto("winner_dele"); // 0-15 no 2º game, saque do adversário
  assert.ok(tem(await texto(), "Saque do adversário"));
  await semRolagem("marcação"); await foto("scout-3-marcacao");

  /* análise ao vivo abre */
  await p.click("#detAnalise summary");
  await p.waitForFunction(() => document.body.innerText.toLowerCase().includes("o que a partida pede"), null, { timeout: 4000 });

  /* fechar e abrir no meio do jogo */
  await p.goto(base + "#/", { waitUntil: "networkidle" });
  await p.reload({ waitUntil: "networkidle" });
  t = await texto();
  assert.ok(tem(t, "Jogo em andamento") && t.includes("Lucas · 0-15"), "jogo em andamento no início: " + t.slice(0, 300));
  await p.click("[data-andamento]");
  assert.strictEqual(await pontos(), "0-15", "continua do mesmo ponto");

  /* termina 4-0 */
  for (let i = 0; i < 40 && !(await p.$("[data-fim-jogo]")); i++) await ponto("erro_dele");
  await p.waitForSelector("[data-fim-jogo]");
  t = await texto();
  assert.ok(t.includes("Lucas venceu") && t.includes("4-0"), "fim de jogo: " + t.slice(0, 400));
  assert.ok(await p.$(".graficos section"), "gráficos do resumo");
  const wa = decodeURIComponent((await p.getAttribute("#lkWhats", "href")).split("text=")[1]);
  assert.ok(wa.startsWith("Lucas venceu · Copa Sul") && wa.includes("Placar: 4-0"), "texto do WhatsApp: " + wa);
  assert.ok(!wa.includes("Fulano") && !wa.includes("Andrade"), "texto sem adversário e sem sobrenome");
  await p.fill("#fmObs", "Sacou bem no corpo");
  await semRolagem("fim de jogo"); await foto("scout-4-fim");

  /* segundo jogo: perde 0-4 e aparece a comparação */
  await p.click('a[href="#/novo"] >> text=Marcar outro jogo');
  assert.strictEqual(await p.getAttribute('[data-atleta]:not([data-atleta="+"])', "aria-pressed"), "true", "único atleta já escolhido");
  await p.click('[data-formato="4games"]'); await p.click('[data-saca="ele"]');
  await p.click("#btComecar"); await p.waitForSelector("[data-pontos]");
  for (let i = 0; i < 40 && !(await p.$("[data-fim-jogo]")); i++) await ponto("winner_dele", "10+");
  t = await texto();
  assert.ok(t.includes("Lucas perdeu") && t.includes("0-4"), "segundo jogo: " + t.slice(0, 300));
  assert.ok(t.includes("Comparação com os jogos anteriores") && t.includes("J2"), "comparação com 2 jogos");

  /* página do atleta */
  await p.click('a[href^="#/atleta/"]');
  await p.waitForSelector("#atNome");
  t = await texto();
  assert.ok(t.includes("Lucas Andrade") && t.includes("2 jogos") && t.includes("1 vitória e 1 derrota") && t.includes("Evolução jogo a jogo"), "atleta: " + t.slice(0, 400));
  await semRolagem("atleta"); await foto("scout-5-atleta");

  /* início com a lista */
  await p.goto(base + "#/");
  await p.waitForSelector("#btCopia:not([disabled])");
  t = await texto();
  assert.ok(t.includes("venceu") && t.includes("perdeu") && t.includes("Lucas Andrade") && t.includes("2 jogos") && t.includes("Copa Sul venceu") && t.includes("17 pontos"), "lista de jogos e atletas: " + t.slice(0, 500));
  await semRolagem("início com jogos"); await foto("scout-6-inicio");

  /* cópia: baixa, limpa o celular, carrega */
  const [dl] = await Promise.all([p.waitForEvent("download"), p.click("#btCopia")]);
  const arquivo = path.join(require("os").tmpdir(), "ql-scout-copia-" + Date.now() + ".json");
  await dl.saveAs(arquivo);
  const copia = JSON.parse(fs.readFileSync(arquivo, "utf8"));
  assert.strictEqual(copia.app, "quadralab-scout"); assert.strictEqual(copia.jogos.length, 2);
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: "networkidle" });
  assert.ok((await texto()).includes("Nenhum jogo marcado ainda"), "celular limpo");
  await p.setInputFiles("#arqCopia", arquivo);
  await p.waitForFunction(() => document.body.innerText.includes("2 jogos novos"));
  t = await texto();
  assert.ok(t.includes("Lucas Andrade") && t.includes("2 jogos") && t.includes("Copa Sul"), "jogos de volta: " + t.slice(0, 300));
  const obs = await p.evaluate(() => JSON.parse(localStorage.getItem("qls:v1")).jogos.map((j) => j.observacaoFinal).join("|"));
  assert.ok(obs.includes("Sacou bem no corpo"), "anotação voltou com a cópia");
  fs.unlinkSync(arquivo);

  /* contagem de uso: só aparelho, evento e pontos */
  await p.waitForTimeout(400);
  const ev = usos.map((x) => JSON.parse(x));
  const tipos = ev.map((x) => x.e);
  assert.ok(tipos.includes("abriu") && tipos.filter((x) => x === "jogo-iniciado").length === 2 && tipos.filter((x) => x === "jogo-encerrado").length === 2, "eventos: " + tipos.join(","));
  assert.ok(ev.filter((x) => x.e === "jogo-encerrado").map((x) => x.n).sort().join() === "16,17", "pontos dos dois jogos (17 no 4-0, 16 no 0-4)");
  assert.ok(ev.every((x) => Object.keys(x).every((k) => ["a", "e", "n"].includes(k))), "só a, e, n");
  assert.ok(!usos.join("").match(/Lucas|Andrade|Fulano|Copa|Sacou/), "nada pessoal na contagem");

  assert.deepStrictEqual(erros, [], "sem erro de JavaScript");
  await b.close(); srv.close();
  console.log("smoke-scout-app: ok");
})().catch((e) => { console.error(e); srv.close(); process.exit(1); });
