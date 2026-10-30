/* Notificações no app do treinador (QuadraLab, index.html inteiro, modo local, 390×844), com um QLPush de mentira:
   · Início mostra o convite "Receba os lembretes no celular"; Ativar chama QLPush.ativar({ app: "treinador" }) e o convite some;
   · "Agora não" fecha e não volta; Mais traz o cartão compacto com o estado "ativo" e o botão Desligar;
   · iPhone fora da tela de início: o convite explica como instalar (sem botão Ativar).
   Usa React/Babel/Tailwind locais (defina CDN_DIR). Rode: node tests/smoke-push-ui.js */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("smoke-push-ui: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const raiz = path.join(__dirname, "..");
const TW = CDN + "/tw/package/dist/index.global.js";
const EXT = {
  "unpkg.com/react@18": CDN + "/react-18.3.1/package/umd/react.development.js", "unpkg.com/react-dom@18": CDN + "/react-dom-18.3.1/package/umd/react-dom.development.js",
  "unpkg.com/prop-types": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "unpkg.com/recharts": CDN + "/recharts-2.15.4/package/umd/Recharts.js", "babel.min.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js",
};
let html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const versaoNovidades = /NOVIDADES_VERSAO = "([^"]+)"/.exec(html)[1];
/* os cartões só aparecem com conta na nuvem: o teste liga só eles (o resto do app segue no modo local) */
const COND = "if (!window.mtyAuth || !window.QLPush";
assert.strictEqual(html.split(COND).length - 1, 2, "condição dos cartões");
html = html.split(COND).join("if (!(window.mtyAuth || window.__pushTeste) || !window.QLPush");
const FALSO = `<script>(function(){var s=sessionStorage.getItem("__pushEstado")||"inativo";window.__ativacoes=[];
window.QLPush={suportado:function(){return true},motivo:function(){return window.__iosTeste?"No iPhone e no iPad, as notificações funcionam com o app na tela de início.":""},
estado:function(){return Promise.resolve(s)},ativar:function(o){window.__ativacoes.push(o);s="ativo";sessionStorage.setItem("__pushEstado","ativo");return Promise.resolve({ok:true})},
desativar:function(){s="inativo";sessionStorage.setItem("__pushEstado","inativo");return Promise.resolve()},ios:function(){return !!window.__iosTeste},instalado:function(){return false}};})();</script>`;
assert(html.includes('<script src="push-cliente.js"></script>'), "app carrega push-cliente.js");
html = html.replace('<script src="push-cliente.js"></script>', '<script src="push-cliente.js"></script>' + FALSO);

const base0 = { lateralidade: "", backhand: "", estagio: "C", nivel: "Y5", objetivosAdulto: [], entrada: {}, plano: null, regPlano: {}, avaliacaoTecnica: {}, objetivoFinal: "",
  marcos: [{ ano: "", marco: "", precisa: "" }], camadas: { tecnico: "", fisico: "", tatico: "", mental: "" }, prioridades: ["saque", "devolucao", "fundo", "rede"], armas: ["fundo"],
  inicio: "", semanas: 18, competicoes: [{ nome: "", data: "" }], historico: [], registros: [], anotacoes: [], adversarios: [], creditosReposicao: [], cadastroConcluido: true };
const ALUNOS = [{ ...base0, id: "a1", nome: "Nicolas Prado", nascimento: "", horarios: [{ dia: new Date().getDay(), hora: "23:58" }] }];

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
  async function abrir(ios) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await ctx.route(/^https?:\/\/(?!localhost)/, (rota) => {
      const url = rota.request().url();
      if (/tailwindcss/.test(url)) return rota.fulfill({ contentType: "text/javascript", body: fs.existsSync(TW) ? fs.readFileSync(TW) : "" });
      const k = Object.keys(EXT).find((x) => url.includes(x));
      if (k) return rota.fulfill({ contentType: "text/javascript", body: fs.readFileSync(EXT[k]) });
      return rota.fulfill({ contentType: /fonts/.test(url) ? "text/css" : "text/javascript", body: "" });
    });
    await ctx.addInitScript(([a, v, ios]) => {
      window.__pushTeste = true; window.__iosTeste = ios;
      if (sessionStorage.getItem("__semeado")) return;
      sessionStorage.setItem("__semeado", "1");
      localStorage.setItem("local:mty:alunos:v2", JSON.stringify(a));
      localStorage.setItem("ql-novidades:" + v, "off");
    }, [ALUNOS, versaoNovidades, ios]);
    const p = await ctx.newPage(), erros = [];
    p.on("pageerror", (e) => erros.push(e.message));
    await p.goto(base); await p.waitForSelector("[data-proxima-aula]", { timeout: 120000 }); await p.waitForTimeout(400);
    return { ctx, p, erros };
  }

  /* 1. convite no Início → Ativar */
  let { ctx, p, erros } = await abrir(false);
  const convite = p.locator("[data-convite-notificacoes]");
  await convite.waitFor({ timeout: 10000 });
  assert(/Receba os lembretes no celular/.test(await convite.textContent()), "título do convite");
  await convite.locator('button:has-text("Ativar notificações")').click();
  await p.waitForTimeout(300);
  assert.deepStrictEqual(await p.evaluate(() => window.__ativacoes.map((x) => x.app)), ["treinador"], "ativou como treinador");
  assert.strictEqual(await convite.count(), 0, "convite some depois de ativar");

  /* 2. Mais → cartão compacto com o estado ativo; Desligar volta para inativo */
  await p.locator('.mty-bottomnav button:has-text("Mais")').click();
  const cartao = p.locator("[data-notificacoes]").first();
  await cartao.waitFor({ timeout: 10000 });
  assert(/Desligar/.test(await cartao.textContent()), "cartão mostra Desligar quando ativo: " + (await cartao.textContent()));
  await cartao.locator('button:has-text("Desligar")').click(); await p.waitForTimeout(300);
  assert(/desligadas/.test(await cartao.textContent()), "mensagem de desligado");
  assert.deepStrictEqual(erros, [], "sem erros na página");
  await ctx.close();

  /* 3. "Agora não" fecha o convite e ele não volta */
  ({ ctx, p, erros } = await abrir(false));
  await p.locator("[data-convite-notificacoes]").waitFor({ timeout: 10000 });
  await p.locator('[data-convite-notificacoes] button:has-text("Agora não")').click();
  await p.reload(); await p.waitForSelector("[data-proxima-aula]", { timeout: 120000 }); await p.waitForTimeout(600);
  assert.strictEqual(await p.locator("[data-convite-notificacoes]").count(), 0, "convite fechado não volta");
  await ctx.close();

  /* 4. iPhone fora da tela de início: explica e não oferece o botão */
  ({ ctx, p, erros } = await abrir(true));
  await p.locator("[data-convite-notificacoes]").waitFor({ timeout: 10000 });
  const t = await p.locator("[data-convite-notificacoes]").textContent();
  assert(/tela de início/.test(t) && !/Ativar notificações/.test(t), "iPhone: instrução de instalar");
  assert.deepStrictEqual(erros, [], "sem erros na página (iPhone)");
  await ctx.close();

  await b.close(); srv.close();
  console.log("smoke-push-ui: ok");
})().catch((e) => { console.error(e); process.exit(1); });
