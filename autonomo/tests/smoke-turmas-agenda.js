/* Team Yoda (mty/index.html inteiro, modo local): turmas apagadas e agenda editável.
   · Remover turma pede confirmação e manda para "Turmas apagadas"; Recuperar devolve a turma igual (com o plano);
   · turma apagada antes da lixeira aparece reconstruída pela Agenda (nome pelo caderno, jogadores, horário, professor) e volta
     com o mesmo id (as aulas antigas voltam a mostrar o nome);
   · Agenda: Editar uma aula (outro horário, só esta) e Apagar da agenda (só esta) — a aula apagada não volta ao trocar de semana.
   Usa React/Babel locais (defina CDN_DIR). Rode: node tests/smoke-turmas-agenda.js [pasta-das-capturas] */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("smoke-turmas-agenda: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
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

  const ctx = await contexto(1280, 900);
  const p = await abrir(ctx, "?papel=coordenador&org=team-yoda");
  p.on("dialog", (d) => d.accept());
  const ir = async (rotulo) => { await p.click('[data-menu-lateral] button:has-text("' + rotulo + '")'); await p.waitForTimeout(400); };
  const lerLS = (k) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), k);

  /* ── turmas: remover com confirmação → lixeira → recuperar ── */
  await p.click('[data-menu-lateral] [data-grupo-nav="grupos"]').catch(() => {});
  await ir("Turmas");
  await p.waitForTimeout(500);
  await p.click('main button:has-text("Abrir turma")');
  await p.click('button:text-is("Sessão")');
  await p.click('button:has-text("Remover turma")');
  await p.waitForTimeout(500);
  assert(!(await lerLS("shared:mty:turmas:v1")).some((t) => t.id === "t1"), "turma removida da lista");
  const lix = await lerLS("shared:mty:lixeira-turmas:v1");
  assert(lix && lix[0].turma.id === "t1" && lix[0].turma.observacoes === "Turma da manhã — guardar", "turma inteira guardada na lixeira");
  await p.click('button:has-text("Turmas apagadas")');
  await p.waitForSelector("[data-turmas-apagadas]");
  let t = await p.locator("[data-turmas-apagadas]").innerText();
  assert(/Sub-12/.test(t) && /Removida em/.test(t), "lixeira lista a turma: " + t.slice(0, 300));
  /* a turma apagada antes da lixeira, reconstruída pela Agenda */
  assert(/Sub-14 Competição/.test(t) && /Encontrada na Agenda/.test(t) && /Nicolas Prado/.test(t) && /Pedro Lima/.test(t) && /17:00/.test(t), "reconstruída pela Agenda: " + t);
  await cap(p, "turmas-apagadas");
  await p.click('[data-turma-apagada="t1"] button:has-text("Recuperar")');
  await p.waitForTimeout(400);
  let turmas = await lerLS("shared:mty:turmas:v1");
  const volta = turmas.find((x) => x.id === "t1");
  assert(volta && volta.observacoes === "Turma da manhã — guardar" && volta.membros.length === 2, "recuperada igual");
  await p.click('[data-turma-apagada="turma-99"] button:has-text("Recuperar")');
  await p.waitForTimeout(400);
  turmas = await lerLS("shared:mty:turmas:v1");
  const rec = turmas.find((x) => x.id === "turma-99");
  assert(rec && rec.nome === "Sub-14 Competição" && rec.membros.length === 2 && rec.horarios[0].hora === "17:00" && rec.horarios[0].quadraId === "q1", "recriada com o mesmo id, nome, jogadores e horário");
  assert(!(await p.locator("[data-turmas-apagadas]").innerText()).includes("Removida em"), "recuperada sai da lixeira");

  /* ── agenda: editar uma aula (só esta) e apagar outra (só esta) ── */
  await ir("Agenda");
  await p.waitForSelector('main button:has-text("Sub-12")', { timeout: 15000 });
  await p.click('main button:has-text("Sub-12")');
  await p.waitForSelector('[role="dialog"][aria-label="Detalhes do compromisso"] [data-edicao-ocorrencia]');
  await p.click('[data-edicao-ocorrencia] button:has-text("Editar")');
  await p.fill('[data-edicao-ocorrencia] input[type="time"] >> nth=0', "11:30");
  assert.strictEqual(await p.inputValue('[data-edicao-ocorrencia] input[type="time"] >> nth=1'), "12:30", "fim acompanha o início (mesma duração)");
  await cap(p, "agenda-editar");
  await p.click('[data-edicao-ocorrencia] button:has-text("Salvar")');
  await p.waitForTimeout(400);
  let oc = (await lerLS("shared:mty:ocorrencias:v1")).filter((o) => o.origemId === "t1" && o.data === iso(hoje));
  assert.strictEqual(oc.length, 1, "uma aula do Sub-12 hoje (não recriou no horário antigo)");
  assert.strictEqual(oc[0].horaInicio, "11:30", "horário novo");
  turmas = await lerLS("shared:mty:turmas:v1");
  assert((turmas.find((x) => x.id === "t1").agendaExcluidas || []).includes(iso(hoje) + "|10:00"), "horário antigo anotado para não voltar");
  assert.strictEqual(turmas.find((x) => x.id === "t1").horarios[0].hora, "10:00", "o horário fixo da turma não mudou (só esta)");
  /* apagar */
  await p.click('[role="dialog"] button[aria-label="Fechar"]').catch(() => {});
  await p.click('main button:has-text("Sub-12")');
  await p.click('[data-edicao-ocorrencia] button:has-text("Apagar da agenda")');
  await p.click('[data-edicao-ocorrencia] button:text-is("Apagar")');
  await p.waitForTimeout(400);
  oc = (await lerLS("shared:mty:ocorrencias:v1")).filter((o) => o.origemId === "t1" && o.data === iso(hoje));
  assert.strictEqual(oc.length, 0, "aula apagada");
  /* trocar de semana e voltar: não reaparece */
  await p.click('main button[aria-label*="róxim"], main button:has-text("›")').catch(() => {});
  await p.waitForTimeout(300);
  await p.click('main button:has-text("Hoje")').catch(() => {});
  await p.waitForTimeout(500);
  oc = (await lerLS("shared:mty:ocorrencias:v1")).filter((o) => o.origemId === "t1" && o.data === iso(hoje));
  assert.strictEqual(oc.length, 0, "a aula apagada não volta ao gerar a semana de novo");
  /* a aula antiga da turma recuperada mostra o nome de novo */
  assert.deepStrictEqual(p.erros, [], "erros de JS: " + p.erros.join(" | "));
  console.log("smoke-turmas-agenda (Team Yoda): ok");
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
