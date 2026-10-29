/* Análises de movimento no caderno do jogador (TelaRegistro real, nos dois apps): aparecem na linha do tempo e no filtro próprio,
   "Ver fotos e checklist" mostra as fotos das fases e os pareceres do arquivo, a análise antiga (só resumo) avisa que não tem fotos,
   "Exportar caderno em PDF" leva as análises com as fotos, e remover tira do caderno e do arquivo.
   Defina CDN_DIR (padrão: scratchpad/cdn). Rode: node tests/smoke-caderno-movimento.js [pasta-das-capturas] */
const fs = require("fs"), path = require("path"), http = require("http");
const AULAS_MES_JS=require("fs").readFileSync(require("path").join(__dirname,"../../mty/aulas-mes.js"),"utf8");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const assert = require("assert");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("smoke-caderno-movimento: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const capturas = process.argv[2] || "";
const LIB = { "/r.js": CDN + "/react-18.3.1/package/umd/react.development.js", "/d.js": CDN + "/react-dom-18.3.1/package/umd/react-dom.development.js", "/p.js": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "/c.js": CDN + "/recharts-2.15.4/package/umd/Recharts.js", "/b.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js" };
const SCOUT = ["graficos.js", "ao-vivo.js", "relatorio-jogos.js", "movimento-motor.js", "evidencias.js", "movimento-arquivo.js", "movimento.js", "video-segmentador.js", "video-audio.js", "video-scout.js", "video-visao.js", "video-scout-ui.js", "quadra-auto.js", "padroes.js", "video-jogo.js"];

function servir(app, montagem) {
  const raiz = path.join(__dirname, "..", app === "mty" ? "../mty" : ".");
  const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
  const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
  const corte = ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
  assert(corte > 0, app + ": ponto de montagem não encontrado");
  const corpo = `async function listaProfessores(){return [{uid:"p1",nome:"Carlos"},{uid:"p2",nome:"Marina"}];}
async function organizacao(){return "demo";} var db=null, auth=null;
` + ms.slice(0, corte) + `
window.mtyAuth={entrar:async()=>{},usuario:()=>null};
${montagem}`;
  const pagina = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><script src="https://cdn.tailwindcss.com"></script><div id=root style="padding:16px"></div>
<script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script><script>${AULAS_MES_JS}</script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return "tok" + Math.random().toString(36).slice(2,10)}};</script>
<script src=/sync-listas.js></script>${SCOUT.map((f) => "<script src=/scout/" + f + "></script>").join("")}
<script type="text/babel">${corpo}</script>`;
  return http.createServer((q, r) => {
    const u = q.url.split("?")[0];
    if (u === "/") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(pagina); }
    if (LIB[u]) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(LIB[u])); }
    const f = path.join(raiz, decodeURIComponent(u));
    if (f.startsWith(raiz) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(f)); }
    r.writeHead(404); r.end();
  }).listen(0);
}


const FOTO = "data:image/svg+xml;base64," + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="45" height="80"><rect width="45" height="80" fill="#123"/></svg>').toString("base64");
const resumo = (id, criadoEm, ok) => ({ id, criadoEm, golpe: "forehand", emp: "", dom: "D", itens: [{ n: "Flexão de joelhos no giro", s: "atencao", v: 148, u: "°", r: "90 ± 10" }], res: { ok, atencao: 3, nao: 5 }, texto: "Base alta no giro.", prio: ["Flexão de joelhos no giro"] });
const nomes = ["Preparação", "Giro", "Descida", "Contato", "Seguimento", "Recuperação"];
const arquivo = { id: "mv2", alunoId: "a1", criadoEm: "2026-10-01T10:00:00.000Z", golpe: "forehand", emp: "", dom: "D", atleta: "Ana Souza",
  resultado: { golpe: "forehand", nomes, fases: nomes.map((n, i) => ({ nome: n, quadro: i, t: i * 0.3 })),
    itens: [{ fase: 1, nome: "Flexão de joelhos no giro", valor: 148.4, unidade: "°", ref: "90 ± 10", status: "atencao", comentario: "Pouca flexão de joelhos: base alta." }],
    resumo: { ok: 5, atencao: 1, nao_avaliavel: 0 } }, fotos: nomes.map(() => FOTO), resumo: resumo("mv2", "2026-10-01T10:00:00.000Z", 5) };

(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  for (const app of ["mty", "autonomo"]) {
    /* mv1: análise antiga (só na ficha) · mv2: está só no arquivo da academia (a ficha perdeu), com fotos */
    const alunos = [{ id: "a1", nome: "Ana Souza", estagio: "E2", nivel: "Y2", registros: [{ id: "j1", tipo: "jogo", data: "2026-09-15", torneio: "Copa", adversario: "X", resultado: "6/4", protocolo: 60 }], anotacoes: [], movimentos: [resumo("mv1", "2026-09-01T10:00:00.000Z", 4)] }];
    const srv = servir(app, `
function Host(){ const [alunos,setAlunos]=useState(${JSON.stringify(alunos)}); window.__alunos=alunos;
  return <TelaRegistro aluno={alunos[0]} alunos={alunos} setAlunos={setAlunos} identidade={{nomeAcademia:"Academia X"}} aoReabrirJogo={()=>{}} />; }
ReactDOM.createRoot(document.getElementById("root")).render(<Host />);`);
    const p = await b.newPage({ viewport: { width: 430, height: 1300 } });
    await p.route(/tailwindcss/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
    const erros = [];
    p.on("pageerror", (e) => erros.push(e.message));
    p.on("console", (x) => { if (x.type() === "error" && !/Failed to load|BABEL/.test(x.text())) erros.push("c:" + x.text().slice(0, 200)); });
    await p.addInitScript((arq) => {
      localStorage.setItem("local:mty:movrel:v1:mv2", JSON.stringify(arq));
      localStorage.setItem("local:mty:movidx:v1:a1", JSON.stringify({ itens: [arq.resumo], removidos: [] }));
    }, arquivo);
    await p.goto("http://localhost:" + srv.address().port + "/");
    await p.waitForSelector("text=Caderno do jogador", { timeout: 120000 }).catch(() => { throw new Error("não abriu: " + erros.join(" | ").slice(0, 1500)); });
    await p.waitForSelector("[data-movimento=mv2]", { timeout: 10000 });
    let t = await p.evaluate(() => document.body.innerText);
    assert.strictEqual(await p.locator("[data-movimento]").count(), 2, app + ": as 2 análises no caderno (ficha + arquivo)");
    assert(/Análise de movimento/i.test(t) && /Forehand/.test(t) && /5 itens OK · 3 em atenção/.test(t), app + ": resumo da análise no caderno");
    // filtro próprio
    await p.click("button:has-text('Análises de movimento')");
    assert.strictEqual(await p.locator("[data-movimento]").count(), 2, app + ": filtro Análises de movimento");
    assert.strictEqual(await p.locator("text=Copa").count(), 0, app + ": filtro tira os jogos");
    // fotos e checklist
    await p.click("[data-movimento=mv2] >> text=Ver fotos e checklist");
    await p.waitForSelector("[data-movimento=mv2] img", { timeout: 5000 });
    assert.strictEqual(await p.locator("[data-movimento=mv2] img").count(), 6, app + ": 6 fotos das fases no caderno");
    t = await p.locator("[data-movimento=mv2]").innerText();
    assert(/Pouca flexão de joelhos: base alta/.test(t) && /1\. Preparação/.test(t), app + ": checklist com comentários e nomes das fases");
    if (capturas) { fs.mkdirSync(capturas, { recursive: true }); await p.screenshot({ path: path.join(capturas, app + "-caderno-movimento.png"), fullPage: true }); }
    await p.click("[data-movimento=mv1] >> text=Ver fotos e checklist");
    await p.waitForSelector("[data-movimento=mv1] >> text=antes de o app guardar o relatório completo", { timeout: 5000 });
    // PDF do caderno com as análises e as fotos
    let [pop] = await Promise.all([p.waitForEvent("popup"), p.click("text=Exportar caderno em PDF")]);
    await pop.waitForFunction(() => /Caderno ·/.test(document.title), null, { timeout: 10000 });
    t = await pop.evaluate(() => document.body.innerText);
    assert(/Análises de movimento/.test(t) && /Pouca flexão de joelhos/.test(t) && /Base alta no giro/.test(t), app + ": análises no PDF do caderno");
    assert.strictEqual(await pop.locator(".fotos img").count(), 6, app + ": fotos no PDF do caderno");
    if (capturas) await pop.screenshot({ path: path.join(capturas, app + "-caderno-pdf.png"), fullPage: true });
    await pop.close();
    // relatório completo (PDF) direto do caderno
    [pop] = await Promise.all([p.waitForEvent("popup"), p.click("[data-movimento=mv2] >> text=Relatório completo (PDF)")]);
    await pop.waitForFunction(() => /^Análise de movimento/.test(document.title), null, { timeout: 10000 });
    assert.strictEqual(await pop.locator(".fotos img").count(), 6, app + ": relatório completo com fotos");
    await pop.close();
    // remover tira do caderno e do arquivo
    p.once("dialog", (d) => d.accept());
    await p.click("[data-movimento=mv2] [aria-label='Excluir análise']");
    await p.waitForFunction(() => !localStorage.getItem("local:mty:movrel:v1:mv2"), null, { timeout: 5000 });
    await p.waitForFunction(() => document.querySelectorAll("[data-movimento]").length === 1, null, { timeout: 5000 });
    assert.deepStrictEqual(erros, [], app + ": erros de JS " + erros.join(" | "));
    await p.close(); srv.close();
    console.log("smoke-caderno-movimento " + app + ": ok");
  }
  await b.close();
})().catch((e) => { console.error(e.message || e); process.exit(1); });
