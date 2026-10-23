/* Aba "Análise de movimento" dos apps do treinador (autonomo e mty): extrai o componente do próprio index.html e o roda em React,
   com cotas por plano (gratis bloqueado, essencial limitado, premium e sem plano ilimitados), histórico e evolução.
   Precisa de React/Babel locais: defina CDN_DIR (padrão: scratchpad/cdn). Rode: node tests/smoke-movimento-app.js */
const fs = require("fs"), path = require("path"), http = require("http");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const assert = require("assert");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("smoke-movimento-app: pulado (sem React/Babel locais em " + CDN + ")"); process.exit(0); }
const lib = { react: CDN + "/react-18.3.1/package/umd/react.development.js", dom: CDN + "/react-dom-18.3.1/package/umd/react-dom.development.js", babel: CDN + "/babel-standalone-7.29.9/package/babel.min.js" };
(async () => {
  for (const app of ["autonomo", "mty"]) {
    const raiz = path.join(__dirname, "..", app === "mty" ? "../mty" : ".");
    const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
    const i = html.indexOf("/* Selo \"Tecnologia QuadraLab\"");
    const j = html.indexOf("function TelaScout({ aluno, alunos, setAlunos, identidade }) {");
    assert(i > 0 && j > i, app + ": componentes não encontrados");
    const fonte = html.slice(i, j);
    const pagina = `<!doctype html><meta charset=utf-8><link rel=stylesheet href="/scout/movimento.css"><div id=raiz></div>
<script src=/lib/react.js></script><script src=/lib/dom.js></script><script src=/lib/babel.js></script>
<script src=/scout/movimento-motor.js></script><script src=/scout/movimento-arquivo.js></script><script src=/scout/movimento.js></script><script src=/scout/video-segmentador.js></script><script src=/scout/video-audio.js></script><script src=/scout/video-scout.js></script><script src=/scout/video-visao.js></script><script src=/scout/video-scout-ui.js></script><script src=/scout/quadra-auto.js></script><script src=/scout/padroes.js></script><script src=/scout/video-jogo.js></script>
<script type="text/babel">
const { useState, useEffect, useRef } = React;
const _m = QLMovimento.montar; QLMovimento.montar = (el, o) => { const c = _m(el, o); window.__ctl = c; return c; };
const _v = QLVideoJogo.montar; QLVideoJogo.montar = (el, o) => { const c = _v(el, o); window.__vctl = c; return c; };
const C = { linha: "#ddd", cal: "#fff", tinta: "#111", papel: "#fff", grafite: "#555", saibro: "#c65825" };
const ARCH = "sans-serif"; const prosa = {};
const db = null; const organizacao = async () => null; /* sem nuvem: o arquivo de relatórios usa o localStorage */
${fonte}
function Host() {
  const [alunos, setAlunos] = useState([{ id: "a1", nome: "Ana Souza", movimentos: window.__legado || [] }, { id: "a2", nome: "Bia Lima", movimentos: [] }]);
  const [plano, setPlano] = useState(window.__plano === undefined ? null : window.__plano);
  window.__setPlano = setPlano; window.__alunos = alunos;
  return <div><TelaMovimento aluno={alunos[0]} alunos={alunos} setAlunos={setAlunos} identidade={{ nomeAcademia: "Academia X" }} planoAtual={plano} /></div>;
}
ReactDOM.createRoot(document.getElementById("raiz")).render(<Host />);
</script>`;
    const srv = http.createServer((req, res) => {
      const u = new URL(req.url, "http://x");
      if (u.pathname === "/") { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return res.end(pagina); }
      if (u.pathname.startsWith("/lib/")) { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(fs.readFileSync(lib[u.pathname.slice(5, -3)])); }
      const f = path.join(raiz, decodeURIComponent(u.pathname));
      if (!f.startsWith(raiz) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { "content-type": f.endsWith(".css") ? "text/css" : f.endsWith(".png") ? "image/png" : "text/javascript" }); res.end(fs.readFileSync(f));
    }).listen(0);
    const porta = srv.address().port;
    const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
    const erros = [];
    async function abre(plano) {
      const p = await b.newPage({ viewport: { width: 390, height: 900 } });
      p.on("pageerror", (e) => erros.push(e.message)); p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) erros.push(m.text()); });
      await p.addInitScript((pl) => { window.__plano = pl; }, plano);
      await p.goto("http://localhost:" + porta + "/");
      await p.waitForSelector(".qlm [data-r=demo]", { timeout: 20000 });
      return p;
    }
    // sem plano (Team Yoda / academia antiga): ilimitado, sem aviso de cota
    let p = await abre(null);
    assert((await p.textContent("body")).includes("Tecnologia"), app + ": selo Tecnologia QuadraLab");
    assert(!(await p.textContent("body")).includes("Plano com limite"), app + ": sem plano não mostra limite");
    // demonstração não salva nada
    await p.locator(".qlm").first().locator("[data-r=demo]").click();
    await p.waitForSelector(".qlm [data-r=saida]:not([hidden])");
    assert.strictEqual(await p.locator(".qm-fase").count(), 6, app + ": 6 fotos");
    assert((await p.locator(".qlm").first().locator("[data-r=salvoMsg]").textContent()).includes("Demonstração"), app + ": demonstração não salva");
    assert.strictEqual(await p.evaluate(() => window.__alunos[0].movimentos.length), 0, app + ": demo não grava no jogador");
    // análises reais (quadros injetados): salva no jogador, a 2ª compara com a 1ª
    /* vídeo de celular em pé (1080×1920): as fotos das fases saem altas; no arquivo elas são reduzidas, nunca descartadas */
    await p.evaluate(() => { const cv = document.querySelector(".qlm [data-r=cv]"); cv.width = 1080; cv.height = 1920; });
    const analisa = async () => { await p.evaluate(() => window.__ctl.injetar(window.QLBiomec.sintetico(40, "D").map((q, k) => { q.t = k * 0.05; return q; }), {})); await p.waitForTimeout(300); };
    await analisa();
    assert.strictEqual(await p.evaluate(() => window.__alunos[0].movimentos.length), 1, app + ": 1ª análise salva no jogador");
    assert(await p.locator(".qlm").first().locator("[data-r=cmpC]").isHidden(), app + ": 1ª análise não compara");
    await analisa();
    assert.strictEqual(await p.evaluate(() => window.__alunos[0].movimentos.length), 2, app + ": 2ª análise salva");
    assert(await p.locator(".qlm").first().locator("[data-r=cmpC]").isVisible(), app + ": 2ª análise compara com a anterior");
    // jogo em vídeo: pontos classificados são salvos no jogador; o 2º jogo compara com o 1º
    await p.getByText("Jogo em vídeo", { exact: true }).first().click();
    const jogo = async (ganhos) => {
      await p.evaluate((g) => { const pts = []; for (let i = 0; i < 10; i++) pts.push({ n: i + 1, ini: i * 20, fim: i * 20 + 8, saque: i * 20 + 2, golpes: 3 + (i % 4), duracao: 4, sacador: i % 2 ? "B" : "A", venc: i < g ? "A" : "B", tipo: i < g ? "Winner" : "Erro não forçado" }); window.__vctl.definirPontos(pts); window.__vctl.estado.regId = null; window.__vctl.estado.salvo = false; }, ganhos);
      await p.locator(".qlm [data-r=salvar]").click(); await p.waitForTimeout(250);
    };
    await jogo(4);
    assert.strictEqual(await p.evaluate(() => window.__alunos[0].jogosVideo.length), 1, app + ": 1º jogo em vídeo salvo");
    await jogo(7);
    assert.strictEqual(await p.evaluate(() => window.__alunos[0].jogosVideo.length), 2, app + ": 2º jogo em vídeo salvo");
    assert.strictEqual(await p.evaluate(() => window.__alunos[0].jogosVideo[1].res.pctGanhos), 70, app + ": resumo do jogo");
    // aba evolução
    await p.getByText("Evolução", { exact: true }).first().click();
    assert((await p.textContent("body")).includes("Última análise × anterior"), app + ": evolução mostra comparação com a anterior");
    assert((await p.textContent("body")).includes("Forehand · 2 análises"), app + ": evolução agrupa por golpe");
    assert((await p.textContent("body")).includes("Jogos em vídeo · 2 jogos"), app + ": evolução dos jogos em vídeo");
    assert((await p.textContent("body")).includes("Último jogo × anteriores"), app + ": jogo em vídeo compara com anteriores");
    // cada análise guarda o relatório completo num arquivo à parte; "Ver relatório" reabre com fotos, checklist e conclusão
    await p.waitForFunction(() => Object.keys(localStorage).filter((k) => k.startsWith("local:mty:movrel:v1:")).length === 2, null, { timeout: 5000 });
    assert.strictEqual(await p.locator("[data-ver]:visible").count(), 2, app + ": Evolução lista as 2 análises com Ver relatório");
    let [pop] = await Promise.all([p.waitForEvent("popup"), p.locator("[data-ver]:visible").first().click()]);
    await pop.waitForFunction(() => /^Análise de movimento/.test(document.title));
    let tr = await pop.textContent("body");
    assert(tr.includes("Checklist por fase") && tr.includes("Conclusão e intervenções sugeridas") && tr.includes("Ana Souza"), app + ": relatório completo reaberto");
    assert(tr.includes("Evolução em relação à análise anterior"), app + ": a mais recente traz a comparação guardada");
    assert.strictEqual(await pop.locator(".fotos img").count(), 6, app + ": relatório reaberto com as 6 fotos das fases");
    await pop.close();
    // a lista do jogador perde as análises (gravação que falhou / outro aparelho gravou por cima): ao abrir, elas voltam do arquivo
    await p.reload();
    await p.waitForSelector(".qlm [data-r=demo]", { timeout: 20000 });
    await p.waitForFunction(() => window.__alunos[0].movimentos.length === 2, null, { timeout: 5000 });
    assert.strictEqual(await p.locator(".qlm [data-r=lista] [data-ver]").count(), 2, app + ": Análises salvas recuperadas do arquivo");
    if (process.env.CAPTURAS) { await p.locator(".qm-hist [data-r=lista]").scrollIntoViewIfNeeded(); await p.screenshot({ path: path.join(process.env.CAPTURAS, app + "-lista.png") }); }
    [pop] = await Promise.all([p.waitForEvent("popup"), p.locator(".qlm [data-r=lista] [data-ver]").last().click()]);
    await pop.waitForFunction(() => /^Análise de movimento/.test(document.title));
    assert.strictEqual(await pop.locator(".fotos img").count(), 6, app + ": análise mais antiga também reabre completa");
    const tamanhos = await pop.evaluate(() => Promise.all([...document.querySelectorAll(".fotos img")].map((i) => (i.complete ? Promise.resolve() : new Promise((r) => { i.onload = r; })).then(() => [i.naturalWidth, i.naturalHeight]))));
    assert(tamanhos.every(([w, h]) => w > 0 && h > 0 && Math.max(w, h) <= 560 && h > w), app + ": fotos em pé guardadas reduzidas (" + JSON.stringify(tamanhos[0]) + ")");
    if (process.env.CAPTURAS) { await pop.setViewportSize({ width: 390, height: 1400 }); await pop.screenshot({ path: path.join(process.env.CAPTURAS, app + "-relatorio.png") }); }
    await pop.close();
    // remover tira do histórico e do arquivo, e não volta ao recarregar
    p.once("dialog", (d) => d.accept());
    await p.locator(".qlm [data-r=lista] [data-rm]").first().click();
    await p.waitForFunction(() => Object.keys(localStorage).filter((k) => k.startsWith("local:mty:movrel:v1:")).length === 1, null, { timeout: 5000 });
    await p.reload();
    await p.waitForSelector(".qlm [data-r=demo]", { timeout: 20000 });
    await p.waitForFunction(() => window.__alunos[0].movimentos.length === 1, null, { timeout: 5000 });
    await p.waitForTimeout(300);
    assert.strictEqual(await p.locator(".qlm [data-r=lista] [data-ver]").count(), 1, app + ": removida não volta");
    await p.close();
    // análise antiga (de antes do arquivo): só o resumo existe; reabre como relatório resumido e entra no índice do jogador
    const pl = await b.newPage({ viewport: { width: 390, height: 900 } });
    pl.on("pageerror", (e) => erros.push(e.message));
    await pl.addInitScript(() => { window.__plano = null; window.__legado = [{ id: "mvantigo", criadoEm: "2026-08-02T12:00:00.000Z", golpe: "saque", emp: "", dom: "D", itens: [{ n: "Joelhos no lançamento", s: "atencao", v: 150, u: "°", r: "≤ 140°" }], res: { ok: 3, atencao: 1, nao: 2 }, texto: "Flexão de joelhos curta no lançamento.", prio: ["Joelhos no lançamento"], origem: "video" }]; });
    await pl.goto("http://localhost:" + porta + "/");
    await pl.waitForSelector(".qlm [data-r=demo]", { timeout: 20000 });
    await pl.waitForFunction(() => /mvantigo/.test(localStorage.getItem("local:mty:movidx:v1:a1") || ""), null, { timeout: 5000 });
    [pop] = await Promise.all([pl.waitForEvent("popup"), pl.locator(".qlm [data-r=lista] [data-ver]").first().click()]);
    await pop.waitForFunction(() => /^Análise de movimento/.test(document.title));
    tr = await pop.textContent("body");
    assert(tr.includes("antes de o app guardar o relatório completo") && tr.includes("Joelhos no lançamento") && tr.includes("Flexão de joelhos curta"), app + ": análise antiga reabre pelo resumo");
    await pl.close();
    // planos
    const casos = [["gratis", /não está incluída|Essencial e Premium/], ["essencial", /Plano com limite: você usou 0 de 5/], ["premium", null]];
    for (const [pl, esp] of casos) {
      p = await abre(pl); const t = await p.textContent("body");
      if (esp) assert(esp.test(t), app + " " + pl + ": mensagem de plano esperada → " + t.slice(0, 400));
      else assert(!/Plano com limite|não está incluída/.test(t), app + " premium ilimitado");
      if (pl === "gratis") assert(await p.locator(".qlm").first().locator("[data-r=go]").isDisabled(), app + ": gratis não analisa");
      if (pl === "essencial") {
        await p.evaluate(() => { window.__ctl.estado.cota = window.QLBiomec.cota("movimento", "essencial", []); });
        const mes = new Date().toISOString();
        const reg = (id) => ({ id, criadoEm: mes, golpe: "forehand", emp: "", dom: "D", itens: [], res: { ok: 1, atencao: 0, nao: 0 }, texto: "", prio: [] });
        const c = await p.evaluate((rs) => { const c = window.QLBiomec.cota("movimento", "essencial", rs); return c; }, [reg("x1"), reg("x2"), reg("x3"), reg("x4"), reg("x5")]);
        assert.strictEqual(c.liberado, false, app + ": 5 de 5 bloqueia");
        for (let k = 0; k < 5; k++) { await p.evaluate(() => window.__ctl.injetar(window.QLBiomec.sintetico(40, "D").map((q, i) => { q.t = i * 0.05; return q; }), {})); await p.waitForTimeout(250); }
        assert((await p.textContent(".qlm")).includes("Você usou as 5 análises de movimento deste mês"), app + ": após 5 análises, aviso de limite do mês");
        await p.getByText("Jogo em vídeo", { exact: true }).first().click();
        for (let k = 0; k < 2; k++) {
          await p.evaluate(() => { const pts = [{ n: 1, ini: 0, fim: 8, saque: 2, golpes: 3, duracao: 4, sacador: "A", venc: "A", tipo: "Ace" }]; window.__vctl.definirPontos(pts); window.__vctl.estado.regId = null; window.__vctl.estado.salvo = false; });
          await p.locator(".qlm [data-r=salvar]").click(); await p.waitForTimeout(250);
        }
        assert((await p.textContent("body")).includes("Você salvou os 2 jogos em vídeo deste mês"), app + ": após 2 jogos, aviso de limite do mês");
        assert.strictEqual(await p.evaluate(() => window.QLBiomec.cota("movimento", "essencial", [{ criadoEm: "2020-01-01T00:00:00Z" }]).usados), 0, app + ": meses anteriores não contam");
      }
      await p.close();
    }
    assert.deepStrictEqual(erros, [], app + ": erros de JS " + erros.join(" | "));
    await b.close(); srv.close();
    console.log("smoke-movimento-app " + app + ": ok");
  }
})().catch((e) => { console.error(e); process.exit(1); });
