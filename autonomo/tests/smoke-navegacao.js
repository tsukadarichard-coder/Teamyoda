/* Navegação do Team Yoda (mty/index.html inteiro, modo local, sem login): Hoje/Jogadores/Agenda/Mais, menu lateral recolhível
   no computador, painel sobreposto no tablet e no celular, grupos que abrem e fecham, rotas antigas, preferências salvas e
   permissões por perfil. Usa React/Babel locais (defina CDN_DIR). Rode: node tests/smoke-navegacao.js [pasta-das-capturas] */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("smoke-navegacao: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const capturas = process.argv[2] || "";
const raiz = path.join(__dirname, "..", "..", "mty");
const TW = CDN + "/tw/package/dist/index.global.js";
const EXT = {
  "unpkg.com/react@18": CDN + "/react-18.3.1/package/umd/react.development.js", "unpkg.com/react-dom@18": CDN + "/react-dom-18.3.1/package/umd/react-dom.development.js",
  "unpkg.com/prop-types": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "unpkg.com/recharts": CDN + "/recharts-2.15.4/package/umd/Recharts.js", "babel.min.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js",
};
let html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const versaoNovidades = /NOVIDADES_TY_VERSAO = "([^"]+)"/.exec(html)[1];
/* perfil do teste: papel e academia pela URL (o app sem login não tem perfil) */
html = html.replace("const [papelAtual, setPapelAtual] = useState(null);", 'const [papelAtual, setPapelAtual] = useState(new URLSearchParams(location.search).get("papel") || null);')
  .replace("const [orgAtual, setOrgAtual] = useState(null);", 'const [orgAtual, setOrgAtual] = useState(new URLSearchParams(location.search).get("org") || null);');
assert(html.includes('get("papel")') && html.includes('get("org")'), "injeção do perfil");

const hoje = new Date(), iso = (d) => d.toISOString().slice(0, 10), dia = hoje.getDay();
/* jogadores com os campos que a ficha sempre tem (como novoAluno no app) */
const fichaBase = { nascimento: "", lateralidade: "", backhand: "", estagio: "C", nivel: "Y5", objetivosAdulto: [], entrada: {}, plano: null, regPlano: {}, avaliacaoTecnica: {},
  objetivoFinal: "", marcos: [{ ano: "", marco: "", precisa: "" }], camadas: { tecnico: "", fisico: "", tatico: "", mental: "" }, prioridades: ["saque", "devolucao", "fundo", "rede"], armas: ["fundo"],
  inicio: "", semanas: 18, competicoes: [{ nome: "", data: "" }], historico: [], registros: [], anotacoes: [], adversarios: [], creditosReposicao: [], professorUid: "", professorNome: "", duracaoPadrao: "1h30", criteriosClassificacao: {} };
const ALUNOS = [
  { ...fichaBase, id: "a1", nome: "Nicolas Prado", horarios: [{ dia, hora: "23:58", quadraId: "q1" }], pedidosReposicao: [{ id: "r1", status: "pendente" }] },
  { ...fichaBase, id: "a2", nome: "Pedro Lima", horarios: [] },
];
const TURMAS = [{ id: "t1", nome: "Sub-12", membros: ["a2"], horarios: [{ dia, hora: "00:01" }] }];
const QUADRAS = [{ id: "q1", nome: "Quadra 1" }];

const srv = http.createServer((q, r) => {
  const u = q.url.split("?")[0];
  if (u === "/" || u === "/index.html") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(html); }
  if (u === "/mty-nuvem.js") { r.writeHead(200, { "content-type": "text/javascript" }); return r.end("/* teste: sem nuvem */"); }
  const f = path.join(raiz, decodeURIComponent(u));
  if (f.startsWith(raiz) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { "content-type": f.endsWith(".js") ? "text/javascript" : f.endsWith(".css") ? "text/css" : "application/octet-stream" }); return r.end(fs.readFileSync(f)); }
  r.writeHead(404); r.end();
}).listen(0);
const base = "http://localhost:" + srv.address().port + "/";

(async () => {
  const { chromium } = require("/opt/node22/lib/node_modules/playwright");
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  async function contexto(largura, altura) {
    const ctx = await b.newContext({ viewport: { width: largura, height: altura || 860 } });
    await ctx.route(/^https?:\/\/(?!localhost)/, (rota) => {
      const url = rota.request().url();
      if (/tailwindcss/.test(url)) return rota.fulfill({ contentType: "text/javascript", body: fs.existsSync(TW) ? fs.readFileSync(TW) : "" });
      const k = Object.keys(EXT).find((x) => url.includes(x));
      if (k) return rota.fulfill({ contentType: "text/javascript", body: fs.readFileSync(EXT[k]) });
      if (/fonts\.googleapis|fonts\.gstatic/.test(url)) return rota.fulfill({ contentType: "text/css", body: "" });
      return rota.fulfill({ contentType: "text/javascript", body: "" });
    });
    await ctx.addInitScript(([a, t, qd, v]) => {
      if (sessionStorage.getItem("__semeado")) return;
      sessionStorage.setItem("__semeado", "1");
      if (!localStorage.getItem("local:mty:alunos:v2")) {
        localStorage.setItem("local:mty:alunos:v2", JSON.stringify(a)); localStorage.setItem("shared:mty:turmas:v1", JSON.stringify(t));
        localStorage.setItem("shared:mty:quadras:v1", JSON.stringify(qd)); localStorage.setItem("shared:mty:onboardingDispensado", "true");
        localStorage.setItem("ql-novidades:" + v, "off");
      }
    }, [ALUNOS, TURMAS, QUADRAS, versaoNovidades]);
    return ctx;
  }
  async function abrir(ctx, query) {
    const p = await ctx.newPage(); p.erros = [];
    p.on("pageerror", (e) => p.erros.push(e.message));
    await p.goto(base + (query || ""));
    await p.waitForSelector("main.mty-main [data-hoje-resumo], main.mty-main h1", { timeout: 120000 });
    return p;
  }
  const cap = async (p, n) => { if (capturas) { fs.mkdirSync(capturas, { recursive: true }); await p.screenshot({ path: path.join(capturas, n + ".png") }); } };
  const semRolagemLateral = async (p, rot) => { const w = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); assert(w <= 1, rot + ": rolagem lateral de " + w + " px"); };
  const margemMain = async (p) => { await p.waitForTimeout(350); return p.evaluate(() => parseFloat(getComputedStyle(document.querySelector("main.mty-main")).marginLeft)); };
  const ativo = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s + ' [aria-current="page"]'); return e ? e.getAttribute("aria-label") || e.textContent.trim() : null; }, sel);

  /* ── computador 1280: expandido na primeira visita, cabeçalho sem o texto antigo, grupos, recolher, Mais, preferência ── */
  let ctx = await contexto(1280);
  let p = await abrir(ctx, "?papel=coordenador&org=team-yoda");
  await p.waitForSelector("[data-menu-lateral]");
  let t = await p.locator("[data-menu-lateral]").innerText();
  assert(!/Ficha, periodização e sessão/.test(t) && !/315 exercícios/.test(t), "cabeçalho sem o texto antigo");
  assert(/Hoje/.test(t) && /Jogadores/.test(t) && /Agenda/.test(t), "destinos principais");
  for (const g of ["Treino e análise", "Grupos", "Gestão da academia", "Método e formação", "Configurações e suporte"]) assert(t.toUpperCase().includes(g.toUpperCase()), "grupo " + g);
  assert.strictEqual(await p.locator('[data-menu-lateral] [data-grupo-nav][aria-expanded="true"]').count(), 0, "primeira vez em Hoje: grupos recolhidos");
  assert.strictEqual(await ativo(p, "[data-menu-lateral]"), "Hoje");
  assert.strictEqual(await margemMain(p), 248, "conteúdo ao lado do menu expandido");
  t = await p.locator("main").innerText();
  assert(/^Hoje/m.test(t) && /Próxima aula/i.test(t) && /Aulas de hoje/.test(t) && /Pendências/.test(t), "Hoje: próxima aula, aulas do dia e pendências");
  assert(/Nicolas Prado pediu reposição/.test(t), "pendência real (pedido de reposição)");
  assert(/Quadra 1/.test(t), "quadra da aula");
  assert(!/microfone|Ditar/i.test(await p.locator("[data-menu-lateral]").innerText()) && await p.locator("main [data-hoje-resumo] button:has-text('Ditar')").count() === 0, "sem voz em destaque na navegação nem em Hoje");
  await cap(p, "nav-01-desktop-expandido");

  /* grupo abre, a escolha fica salva; Catálogo de exercícios mostra a quantidade */
  await p.click('[data-menu-lateral] [data-grupo-nav="treino"]');
  assert.strictEqual(await p.getAttribute('[data-menu-lateral] [data-grupo-nav="treino"]', "aria-expanded"), "true");
  await p.click('[data-menu-lateral] button:has-text("Catálogo de exercícios")');
  await p.waitForSelector("[data-total-catalogo]");
  assert(/^\d+ exercícios no catálogo/.test(await p.locator("[data-total-catalogo]").innerText()), "quantidade no catálogo");
  assert.strictEqual(await ativo(p, "[data-menu-lateral]"), "Catálogo de exercícios", "página ativa destacada");
  const prefGrupos = await p.evaluate(() => JSON.parse(localStorage.getItem("mty:menu:local:grupos")));
  assert.strictEqual(prefGrupos.treino, true, "escolha dos grupos salva");
  /* grupo da página atual sinalizado mesmo recolhido */
  await p.click('[data-menu-lateral] [data-grupo-nav="treino"]');
  assert.strictEqual(await p.locator('[data-menu-lateral] [data-grupo-nav="treino"] [aria-label="contém a página atual"]').count(), 1, "ponto no grupo recolhido da página atual");

  /* recolher sem perder o que foi digitado */
  await p.fill('main input[placeholder="Buscar por código, nome ou montagem"]', "saque");
  await p.click("[data-recolher-menu]");
  await p.waitForSelector("[data-menu-recolhido]");
  assert.strictEqual(await p.locator("[data-menu-lateral]").count(), 0);
  assert.strictEqual(await p.inputValue('main input[placeholder="Buscar por código, nome ou montagem"]'), "saque", "o campo continua preenchido");
  assert.strictEqual(await margemMain(p), 68, "conteúdo ocupa o espaço liberado");
  assert.strictEqual(await p.evaluate(() => localStorage.getItem("mty:menu:local:recolhido")), "true", "preferência salva");
  const botoesTrilho = await p.locator("[data-menu-recolhido] button").evaluateAll((l) => l.map((x) => x.getAttribute("aria-label")));
  assert.deepStrictEqual(botoesTrilho, ["Expandir menu", "Hoje", "Jogadores", "Agenda", "Mais", "Ajuda e configurações"], "faixa: só os acessos principais");
  assert.strictEqual(await p.getAttribute('[data-menu-recolhido] [aria-label="Mais"]', "class").then((c) => /ativo/.test(c)), true, "Mais marcado (página do menu complementar)");
  await semRolagemLateral(p, "recolhido");
  /* rótulo pelo teclado */
  await p.focus('[data-menu-recolhido] [aria-label="Jogadores"]'); await p.keyboard.press("Tab"); await p.keyboard.press("Shift+Tab");
  const rotulo = await p.evaluate(() => { const e = document.querySelector('[data-menu-recolhido] [aria-label="Jogadores"]'); const s = getComputedStyle(e, "::after"); return [s.content, s.visibility]; });
  assert.deepStrictEqual(rotulo, ['"Jogadores"', "visible"], "rótulo aparece com o foco do teclado");
  await cap(p, "nav-02-desktop-recolhido");

  /* "Mais" na faixa: painel ao lado, escolhe e fecha, continua recolhido; Esc devolve o foco */
  await p.click('[data-menu-recolhido] [aria-label="Mais"]');
  await p.waitForSelector("[data-painel-nav]");
  assert.strictEqual(await p.evaluate(() => getComputedStyle(document.querySelector("[data-painel-nav]")).left), "68px", "painel ao lado da faixa");
  await cap(p, "nav-03-desktop-mais");
  await p.keyboard.press("Escape");
  await p.waitForSelector("[data-painel-nav]", { state: "detached" });
  assert.strictEqual(await p.evaluate(() => document.activeElement && document.activeElement.getAttribute("aria-label")), "Mais", "Esc fecha e devolve o foco ao Mais");
  await p.click('[data-menu-recolhido] [aria-label="Mais"]');
  await p.click('[data-painel-nav] [data-grupo-nav="grupos"]');
  await p.click('[data-painel-nav] button:has-text("Turmas")');
  await p.waitForSelector("[data-painel-nav]", { state: "detached" });
  await p.waitForSelector('main h1:has-text("Turmas")');
  assert.strictEqual(await p.locator("[data-menu-recolhido]").count(), 1, "continua recolhido");

  /* preferência respeitada na próxima visita; rotas antigas */
  await p.evaluate(() => sessionStorage.setItem("mty:nav:aba", "aulas-hoje"));
  await p.reload(); await p.waitForSelector("[data-menu-recolhido]", { timeout: 120000 });
  await p.waitForSelector('[data-secoes-pagina] [aria-current="page"]:has-text("Aulas de hoje")');
  assert.strictEqual(await ativo(p, "[data-menu-recolhido]"), "Hoje", "Aulas de hoje fica dentro de Hoje");
  await p.evaluate(() => sessionStorage.setItem("mty:nav:aba", "reposicoes")); await p.reload();
  await p.waitForSelector('[data-secoes-pagina] [aria-current="page"]:has-text("Reposições")', { timeout: 120000 });
  assert.strictEqual(await ativo(p, "[data-menu-recolhido]"), "Agenda", "Reposições fica dentro de Agenda");
  await p.evaluate(() => sessionStorage.setItem("mty:nav:aba", "pendencias")); await p.reload();
  await p.waitForSelector('[data-secoes-pagina] [aria-current="page"]:has-text("Pendências")', { timeout: 120000 });
  /* abrir o jogador a partir de Hoje e voltar para Hoje */
  await p.click('[data-menu-recolhido] [aria-label="Hoje"]');
  await p.click('[data-pendencias-hoje] button:has-text("Nicolas Prado pediu reposição")');
  await p.waitForSelector("[data-voltar-origem]");
  assert(/Voltar para Hoje/.test(await p.locator("[data-voltar-origem]").innerText()));
  await p.click("[data-voltar-origem]"); await p.waitForSelector("[data-hoje-resumo]");
  await p.click("[data-expandir-menu]"); await p.waitForSelector("[data-menu-lateral]");
  assert.strictEqual(await p.evaluate(() => localStorage.getItem("mty:menu:local:recolhido")), "false");
  /* Planejamentos (Treino e análise) e Ajuda (novidades e primeiros passos de volta) */
  const abrirGrupo = async (id) => { if ((await p.getAttribute('[data-menu-lateral] [data-grupo-nav="' + id + '"]', "aria-expanded")) !== "true") await p.click('[data-menu-lateral] [data-grupo-nav="' + id + '"]'); };
  await abrirGrupo("treino"); await p.click('[data-menu-lateral] button:has-text("Planejamentos")');
  await p.waitForSelector("[data-tela-planejamentos]");
  t = await p.locator("[data-tela-planejamentos]").innerText();
  assert(/Nicolas Prado/.test(t) && /Sem planejamento/.test(t) && /Sub-12/.test(t), "planejamentos de jogadores e turmas");
  await p.click('[data-tela-planejamentos] button:has-text("Nicolas Prado")');
  await p.waitForSelector("[data-voltar-origem]");
  assert(/Voltar para Planejamentos/.test(await p.locator("[data-voltar-origem]").innerText()), "volta para Planejamentos");
  await p.click("[data-voltar-origem]"); await p.waitForSelector("[data-tela-planejamentos]");
  await abrirGrupo("config"); await p.click('[data-menu-lateral] button:has-text("Ajuda")');
  await p.waitForSelector("[data-tela-ajuda]");
  await p.click('[data-tela-ajuda] button:has-text("Ver novidades")'); await p.waitForSelector("[data-novidades]");
  await p.mouse.click(1270, 850); await p.waitForSelector("[data-novidades]", { state: "detached" });
  await p.click('[data-tela-ajuda] button:has-text("Mostrar primeiros passos")'); await p.waitForSelector("[data-hoje-resumo]");
  assert.strictEqual(await ativo(p, "[data-menu-lateral]"), "Hoje");
  assert.deepStrictEqual(p.erros, [], "erros de JS (computador): " + p.erros.join(" | "));
  await ctx.close();

  /* ── perfil professor: sem os itens de gestão restritos ── */
  ctx = await contexto(1280);
  p = await abrir(ctx, "?org=team-yoda");
  t = await p.locator("[data-menu-lateral]").innerText();
  await p.click('[data-menu-lateral] [data-grupo-nav="gestao"]').catch(() => {});
  t = await p.locator("[data-menu-lateral]").innerText();
  assert(!/Quadras|Horários recorrentes|Clientes|Torneios|Eventos|Aulas da equipe|Equipe da organização|Financeiro/.test(t), "professor não vê gestão restrita: " + t);
  assert(/Relatório de aulas/.test(t), "professor continua vendo o próprio relatório");
  assert.strictEqual(await p.locator('[data-secoes-pagina] button:has-text("Pendências")').count(), 0, "seção Pendências da academia só para coordenador/dono");
  /* a rota antiga de uma tela restrita não abre a tela para quem não pode */
  await p.evaluate(() => sessionStorage.setItem("mty:nav:aba", "quadras")); await p.reload(); await p.waitForSelector("main.mty-main", { timeout: 120000 });
  await p.waitForTimeout(800);
  assert(!/Cadastrar quadra|Nova quadra/.test(await p.locator("main").innerText()), "rota de Quadras protegida");
  assert.deepStrictEqual(p.erros, [], "erros de JS (professor): " + p.erros.join(" | "));
  await ctx.close();

  /* ── tablet 900: menu sobreposto pelo ☰, conteúdo sem margem, preferência do computador intocada ── */
  ctx = await contexto(900);
  p = await abrir(ctx, "?papel=coordenador&org=team-yoda");
  await p.evaluate(() => localStorage.setItem("mty:menu:local:recolhido", "true"));
  assert.strictEqual(await p.locator("[data-menu-lateral], [data-menu-recolhido], [data-barra-inferior]").count(), 0, "tablet: sem lateral fixa e sem barra inferior");
  assert.strictEqual(await margemMain(p), 0);
  await p.click("[data-abrir-menu]"); await p.waitForSelector("[data-painel-nav]");
  t = await p.locator("[data-painel-nav]").innerText();
  assert(/Hoje/.test(t) && /Jogadores/.test(t) && /Agenda/.test(t) && /TREINO E ANÁLISE/i.test(t), "tablet: menu inteiro no painel");
  assert.strictEqual(await p.evaluate(() => document.body.style.overflow), "hidden", "rolagem de trás bloqueada");
  await cap(p, "nav-04-tablet-menu");
  await p.click('[data-painel-nav] [data-nav-principais] button:has-text("Agenda")');
  await p.waitForSelector("[data-painel-nav]", { state: "detached" });
  assert.strictEqual(await p.evaluate(() => document.body.style.overflow), "", "rolagem liberada ao fechar");
  assert.strictEqual(await p.evaluate(() => localStorage.getItem("mty:menu:local:recolhido")), "true", "preferência do computador intocada");
  await semRolagemLateral(p, "tablet");
  assert.deepStrictEqual(p.erros, [], "erros de JS (tablet): " + p.erros.join(" | "));
  await ctx.close();

  /* ── celular 390: barra inferior, Mais como painel, fecha pelo fundo e ao escolher, nada escondido atrás da barra ── */
  ctx = await contexto(390, 844);
  p = await abrir(ctx, "?papel=coordenador&org=team-yoda");
  await p.waitForSelector("[data-barra-inferior]");
  const rotulosBarra = await p.locator("[data-barra-inferior] button").allInnerTexts();
  assert.deepStrictEqual(rotulosBarra.map((x) => x.trim()), ["Hoje", "Jogadores", "Agenda", "Mais"]);
  assert.strictEqual(await p.locator("[data-menu-lateral], [data-menu-recolhido], [data-abrir-menu]").count(), 0, "uma navegação só");
  const pad = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector("main.mty-main")).paddingBottom));
  const alturaBarra = await p.evaluate(() => document.querySelector("[data-barra-inferior]").getBoundingClientRect().height);
  assert(pad >= alturaBarra + 10, "conteúdo não fica atrás da barra (" + pad + " ≥ " + alturaBarra + ")");
  await semRolagemLateral(p, "celular Hoje");
  await cap(p, "nav-05-celular-hoje");
  await p.click('[data-barra-inferior] button:has-text("Mais")'); await p.waitForSelector("[data-painel-nav]");
  assert.strictEqual(await p.locator("[data-painel-nav] [data-nav-principais]").count(), 0, "celular: o painel traz só os grupos");
  for (const g of ["treino", "grupos", "gestao", "metodo", "config"]) await p.click('[data-painel-nav] [data-grupo-nav="' + g + '"]');
  const rola = await p.evaluate(() => { const e = document.querySelector("[data-painel-nav]"); return e.scrollHeight > e.clientHeight; });
  assert(rola, "o próprio painel rola");
  await p.evaluate(() => { document.querySelector("[data-painel-nav]").scrollTop = 9999; });
  assert(await p.locator("[data-fechar-painel]").isVisible(), "fechar continua visível ao rolar");
  await cap(p, "nav-06-celular-mais");
  await p.mouse.click(380, 400);
  await p.waitForSelector("[data-painel-nav]", { state: "detached" });
  await p.click('[data-barra-inferior] button:has-text("Mais")');
  await p.click('[data-painel-nav] button:has-text("Equipes de competição")');
  await p.waitForSelector("[data-painel-nav]", { state: "detached" });
  await p.waitForSelector("[data-equipes]");
  assert.strictEqual(await p.getAttribute('[data-barra-inferior] button:has-text("Mais")', "aria-expanded"), "false");
  await semRolagemLateral(p, "celular equipes");
  await p.click('[data-barra-inferior] button:has-text("Agenda")');
  await p.waitForSelector('[data-secoes-pagina] button:has-text("Reposições")');
  await semRolagemLateral(p, "celular agenda");
  await cap(p, "nav-07-celular-agenda");
  assert.deepStrictEqual(p.erros, [], "erros de JS (celular): " + p.erros.join(" | "));
  await ctx.close();

  srv.close(); await b.close();
  console.log("smoke-navegacao: ok");
})().catch((e) => { console.error(e); srv.close(); process.exit(1); });
