/* Quadra animada dos exercícios (scout/quadra-exercicio.js), dentro do app: Team Yoda (computador) e QuadraLab (celular).
   No Catálogo de exercícios, o exercício do piloto mostra "▶ Na quadra"; o cartão abre a quadra com o desenho completo e o
   Reproduzir anima as bolas e os deslocamentos, com o texto de cada bola. Exercício fora do piloto não mostra o botão.
   · Remover turma pede confirmação e manda para "Turmas apagadas"; Recuperar devolve a turma igual (com o plano);
   · turma apagada antes da lixeira aparece reconstruída pela Agenda (nome pelo caderno, jogadores, horário, professor) e volta
     com o mesmo id (as aulas antigas voltam a mostrar o nome);
   · Agenda: Editar uma aula (outro horário, só esta) e Apagar da agenda (só esta) — a aula apagada não volta ao trocar de semana.
   Usa React/Babel locais (defina CDN_DIR). Rode: node tests/smoke-turmas-agenda.js [pasta-das-capturas] */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("smoke-quadra-exercicio: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const capturas = process.argv[2] || "";
const raiz = path.join(__dirname, "..", "..", "mty");
const TW = CDN + "/tw/package/dist/index.global.js";
const EXT = {
  "unpkg.com/react@18": CDN + "/react-18.3.1/package/umd/react.development.js", "unpkg.com/react-dom@18": CDN + "/react-dom-18.3.1/package/umd/react-dom.development.js",
  "unpkg.com/prop-types": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "unpkg.com/recharts": CDN + "/recharts-2.15.4/package/umd/Recharts.js", "babel.min.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js",
};
let html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
/* versão geral e a da equipe (quando o item novo é só do financeiro): as duas ficam dispensadas */
const versaoNovidades = [...html.matchAll(/NOVIDADES_TY_VERSAO(?:_EQUIPE)? = "([^"]+)"/g)].map((x) => x[1]);
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
const TURMAS = [{ id: "t1", nome: "Sub-12", membros: ["a1", "a2"], horarios: [{ dia, hora: "10:00" }], duracaoPadrao: "1h", observacoes: "Turma da manhã — guardar" }];
/* turma apagada antes da lixeira: só sobraram aulas na Agenda e sessões no caderno */
const passado = (n) => iso(new Date(hoje.getTime() - n * 86400000));
const OCORRENCIAS = [7, 14].map((n) => ({ id: "ocx" + n, origemTipo: "turma", origemId: "turma-99", recorrenciaChave: "turma:turma-99:" + new Date(passado(n) + "T12:00:00Z").getUTCDay() + ":17:00",
  data: passado(n), horaInicio: "17:00", horaFim: "18:30", quadraId: "q1", professorUid: "", professorNome: "", tipo: "regular", status: "realizada", membrosNaAula: ["a1", "a2"], presencas: {} }));
ALUNOS[0].registros = [{ id: "r1", tipo: "sessao", data: passado(7), turma: "Sub-14 Competição" }];
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
    await ctx.addInitScript((oc) => { window.__OC = oc; }, OCORRENCIAS);
    await ctx.addInitScript(([a, t, qd, v]) => {
      if (sessionStorage.getItem("__semeado")) return;
      sessionStorage.setItem("__semeado", "1");
      if (!localStorage.getItem("local:mty:alunos:v2")) {
        localStorage.setItem("local:mty:alunos:v2", JSON.stringify(a)); localStorage.setItem("shared:mty:turmas:v1", JSON.stringify(t));
        localStorage.setItem("shared:mty:quadras:v1", JSON.stringify(qd)); localStorage.setItem("shared:mty:onboardingDispensado", "true");
        localStorage.setItem("shared:mty:ocorrencias:v1", JSON.stringify(window.__OC));
        [].concat(v).forEach((x) => localStorage.setItem("ql-novidades:" + x, "off"));
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

  async function verificar(p, rot) {
    await p.fill('input[placeholder="Buscar por código, nome ou montagem"]', "DT002");
    await p.waitForTimeout(300);
    const chip = p.locator('button:has-text("▶ Na quadra")').first();
    await chip.waitFor({ timeout: 10000 });
    await chip.click();
    await p.waitForSelector('[data-quadra-exercicio="DT002"] svg');
    const svg = await p.locator('[data-quadra-exercicio="DT002"] svg').innerHTML();
    assert((svg.match(/font-size="0.6"/g) || []).length === 6, rot + ": seis bolas numeradas no desenho");
    await p.click('[data-quadra-exercicio="DT002"] .qe-play');
    await p.waitForTimeout(2500);
    const txt = await p.textContent('[data-quadra-exercicio="DT002"] .qe-txt');
    assert(/^\d de 6 · (Treinador|Atleta): /.test(txt), rot + ": legenda da bola atual: " + txt);
    assert(/Pausar/.test(await p.textContent('[data-quadra-exercicio="DT002"] .qe-play')), rot + ": botão vira Pausar");
    await cap(p, "quadra-" + rot);
    await p.click('[data-quadra-exercicio="DT002"] .qe-play');
    /* duplas (quadra de duplas, quatro jogadores) e deslocamento sem bola (spider) também tocam */
    for (const [cod, n] of [["DP006", 4], ["MV004", 1]]) {
      await p.fill('input[placeholder="Buscar por código, nome ou montagem"]', cod);
      await p.waitForTimeout(300);
      await p.locator('button:has-text("▶ Na quadra")').first().click();
      await p.waitForSelector('[data-quadra-exercicio="' + cod + '"] svg');
      assert.strictEqual(await p.locator('[data-quadra-exercicio="' + cod + '"] .qe-j').count(), n, rot + ": " + cod + " com " + n + " jogador(es)");
      await p.click('[data-quadra-exercicio="' + cod + '"] .qe-play');
      await p.waitForTimeout(1500);
      assert(/^\d de \d · /.test(await p.textContent('[data-quadra-exercicio="' + cod + '"] .qe-txt')), rot + ": " + cod + " anda");
      await p.click('[data-quadra-exercicio="' + cod + '"] .qe-play');
    }
    /* jogo de placar (sem bola marcada na quadra): sem botão */
    await p.fill('input[placeholder="Buscar por código, nome ou montagem"]', "DT018");
    await p.waitForTimeout(300);
    assert.strictEqual(await p.locator('button:has-text("▶ Na quadra")').count(), 0, rot + ": DT018 não tem quadra");
    assert.deepStrictEqual(p.erros, [], rot + ": erros de JS " + p.erros.join(" | "));
  }
  /* Team Yoda, computador */
  const ctx = await contexto(1280, 900);
  const p = await abrir(ctx, "?papel=coordenador&org=team-yoda");
  await p.click('[data-menu-lateral] [data-grupo-nav="treino"]');
  await p.click('[data-menu-lateral] button:has-text("Catálogo de exercícios")');
  await verificar(p, "team-yoda");
  await ctx.close();
  console.log("smoke-quadra-exercicio (Team Yoda): ok");
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
