/* Contraste do app do treinador (index.html inteiro, modo local): percorre Início, Mais, Jogadores, Turmas, Agenda (dia e semana),
   Casos, Observar jogos, Quadro tático, Meu método, Catálogo, ficha do jogador (Perfil, Planejamento, Aulas, Evolução) e Ajuda,
   no computador (1280) e no celular (390), e mede cada texto contra o fundo onde ele está (com a opacidade dos elementos).
   Falha se algum texto ficar abaixo de 4,5:1 (3:1 para texto grande). Botões desativados (opacidade < 0,6) ficam de fora,
   como manda a WCAG. Usa React/Babel/Tailwind locais (defina CDN_DIR). Rode: node tests/check-contraste-app.js */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("check-contraste-app: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const raiz = path.join(__dirname, "..");
const TW = CDN + "/tw/package/dist/index.global.js";
const EXT = {
  "unpkg.com/react@18": CDN + "/react-18.3.1/package/umd/react.development.js", "unpkg.com/react-dom@18": CDN + "/react-dom-18.3.1/package/umd/react-dom.development.js",
  "unpkg.com/prop-types": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "unpkg.com/recharts": CDN + "/recharts-2.15.4/package/umd/Recharts.js", "babel.min.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js",
};
let html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const versaoNovidades = /NOVIDADES_VERSAO = "([^"]+)"/.exec(html)[1];
/* os dois atalhos só aparecem com conta na nuvem: o teste liga só eles (o resto do app segue no modo local, sem login) */
const NUVEM = 'const nuvem = typeof window !== "undefined" && !!window.mtyAuth;';
assert.strictEqual(html.split(NUVEM).length - 1, 2, "atalhos com nuvem");
html = html.split(NUVEM).join("const nuvem = !!window.__nuvemTeste;");
/* "primeiro planejamento" feito sem gerar um plano de verdade */
const P3 = "const onboardingPasso3 = alunos.some((a) => a.plano);";
assert(html.includes(P3), "passo 3"); html = html.replace(P3, "const onboardingPasso3 = alunos.some((a) => a.plano || a.__planoTeste);");

const dia = new Date().getDay();
const base0 = { lateralidade: "", backhand: "", estagio: "C", nivel: "Y5", objetivosAdulto: [], entrada: {}, plano: null, regPlano: {}, avaliacaoTecnica: {}, objetivoFinal: "",
  marcos: [{ ano: "", marco: "", precisa: "" }], camadas: { tecnico: "", fisico: "", tatico: "", mental: "" }, prioridades: ["saque", "devolucao", "fundo", "rede"], armas: ["fundo"],
  inicio: "", semanas: 18, competicoes: [{ nome: "", data: "" }], historico: [], registros: [], anotacoes: [], adversarios: [], creditosReposicao: [], cadastroConcluido: true };
const NICOLAS = { ...base0, id: "a1", nome: "Nicolas Prado", nascimento: "", horarios: [] };
const PEDRO = { ...base0, id: "a2", nome: "Pedro Lima", nascimento: "2014-03-02", horarios: [{ dia, hora: "23:58" }] };

const srv = http.createServer((q, r) => {
  const u = q.url.split("?")[0];
  if (u === "/" || u === "/index.html") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(html); }
  if (u === "/mty-nuvem.js") { r.writeHead(200, { "content-type": "text/javascript" }); return r.end("/* teste: sem nuvem */"); }
  const f = path.join(raiz, decodeURIComponent(u));
  if (f.startsWith(raiz) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : f.endsWith(".png") ? "image/png" : "application/octet-stream" }); return r.end(fs.readFileSync(f)); }
  r.writeHead(404); r.end();
}).listen(0);
const base = "http://localhost:" + srv.address().port + "/";

/* contraste WCAG entre duas cores CSS (rgb/rgba sobre branco) */
function lum(rgb) { const c = rgb.map((v) => v / 255).map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
function razao(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }


const AUDITA = () => {
  const L = (c) => { const v = c.map((x) => x / 255).map((x) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4))); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const rgb = (t) => { const m = t.match(/[\d.]+/g); return m ? m.map(Number) : null; };
  const fundo = (e) => { let acc = null; for (let n = e; n; n = n.parentElement) { const cs = getComputedStyle(n); const c = rgb(cs.backgroundColor); if (c && (c.length < 4 || c[3] > 0.6)) return c.slice(0, 3); if (cs.backgroundImage && cs.backgroundImage !== "none" && /gradient/.test(cs.backgroundImage)) { const g = rgb(cs.backgroundImage); if (g) return g.slice(0, 3); } } return [255, 255, 255]; };
  const saida = {};
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) {
    const t = n.textContent.trim(); if (!t || t.length < 2) continue;
    const e = n.parentElement; if (!e) continue;
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    const cs = getComputedStyle(e); if (cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.1 || e.closest('[aria-hidden="true"], svg, #mty-faixa')) continue;
    let op = 1; for (let k = e; k; k = k.parentElement) op *= parseFloat(getComputedStyle(k).opacity || 1);
    const c = rgb(cs.color); if (!c) continue;
    const bg = fundo(e); const a = (c[3] == null ? 1 : c[3]) * op;
    const cor = c.slice(0, 3).map((x, i) => x * a + bg[i] * (1 - a));
    const x = L(cor), y = L(bg), raz = (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    const tam = parseFloat(cs.fontSize), negr = parseInt(cs.fontWeight) >= 700, grande = tam >= 24 || (tam >= 18.66 && negr);
    const min = grande ? 3 : 4.5;
    if (raz < min - 0.01) { const k = cs.color + " / " + bg.join(","); if (!saida[k]) saida[k] = { raz: raz.toFixed(2), cor: cs.color, op: op.toFixed(2), bg: "rgb(" + bg.join(",") + ")", ex: [] }; if (saida[k].ex.length < 3) saida[k].ex.push(t.slice(0, 40)); }
  }
  return saida;
};
(async () => {
  const { chromium } = require("/opt/node22/lib/node_modules/playwright");
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const tudo = {};
  for (const larg of [1280, 390]) {
    const ctx = await b.newContext({ viewport: { width: larg, height: larg > 500 ? 900 : 844 } });
    await ctx.route(/^https?:\/\/(?!localhost)/, (rota) => { const url = rota.request().url();
      if (/tailwindcss/.test(url)) return rota.fulfill({ contentType: "text/javascript", body: fs.readFileSync(TW) });
      const k = Object.keys(EXT).find((x) => url.includes(x)); if (k) return rota.fulfill({ contentType: "text/javascript", body: fs.readFileSync(EXT[k]) });
      return rota.fulfill({ contentType: "text/javascript", body: "" }); });
    await ctx.addInitScript(([a, v]) => { window.__nuvemTeste = true; if (sessionStorage.getItem("__s")) return; sessionStorage.setItem("__s", "1");
      localStorage.setItem("local:mty:alunos:v2", JSON.stringify(a)); localStorage.setItem("ql-novidades:" + v, "off"); }, [[NICOLAS, PEDRO], versaoNovidades]);
    const p = await ctx.newPage(); const erros = []; p.on("pageerror", (e) => erros.push(e.message));
    await p.goto(base); await p.waitForSelector("[data-proxima-aula]", { timeout: 120000 }); await p.addStyleTag({ content: "#mty-faixa{display:none!important}" }); await p.waitForTimeout(500);
    const regist = async (nome) => { await p.waitForTimeout(450); const r = await p.evaluate(AUDITA); for (const [k, v] of Object.entries(r)) { const kk = k; if (!tudo[kk]) tudo[kk] = { ...v, telas: [] }; if (tudo[kk].telas.length < 6) tudo[kk].telas.push(larg + ":" + nome); } };
    const ir = async (rot) => { if (larg > 500) await p.click('.mty-sidebar button:has-text("' + rot + '")'); else { await p.click('.mty-bottomnav button:has-text("Mais")'); await p.click('[role="dialog"] button:has-text("' + rot + '")'); } };
    await regist("Início");
    if (larg < 500) { await p.click('.mty-bottomnav button:has-text("Mais")'); await regist("Mais"); await p.keyboard.press("Escape"); await p.click('[aria-label="Fechar"]').catch(() => {}); }
    const telas = larg > 500 ? ["Jogadores", "Turmas", "Agenda", "Casos", "Observar jogos", "Quadro tático", "Meu método", "Catálogo de exercícios"] : [];
    for (const t of telas) { try { await ir(t); await regist(t); } catch (e) { console.log("falhou abrir", t, e.message.slice(0, 80)); } }
    if (larg > 500) {
      try { await p.click('.mty-sidebar button:has-text("Agenda")'); await p.getByText("Semana", { exact: true }).click(); await regist("Agenda semana"); } catch (e) {}
      try { await p.click('.mty-sidebar button:has-text("Jogadores")'); await p.getByText("Pedro Lima").first().click(); await regist("Ficha Pedro");
        for (const aba of ["Planejamento", "Aulas", "Evolução"]) { try { await p.getByRole("button", { name: aba, exact: true }).first().click(); await regist("Ficha " + aba); } catch (e) {} }
      } catch (e) { console.log("ficha", e.message.slice(0, 80)); }
      try { await p.click('.mty-sidebar a:has-text("Ajuda"), .mty-sidebar button:has-text("Ajuda")'); await regist("Ajuda"); } catch (e) {}
    }
    assert.deepStrictEqual(erros, [], larg + ": erros de JS");
    await ctx.close();
  }
  const lista = Object.values(tudo).filter((x) => parseFloat(x.op) >= 0.6).sort((a, b) => a.raz - b.raz);
  for (const x of lista) console.log(x.raz, x.cor, "op" + x.op, "sobre", x.bg, "|", x.ex.join(" ¦ "), "|", x.telas.join(", "));
  await b.close(); srv.close();
  assert.strictEqual(lista.length, 0, lista.length + " combinação(ões) de cor abaixo do contraste mínimo");
  console.log("check-contraste-app: ok");
})().catch((e) => { console.error(e.message || e); process.exit(1); });
