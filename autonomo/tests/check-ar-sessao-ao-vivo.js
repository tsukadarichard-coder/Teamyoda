/* Alto rendimento (mty/index.html → SessaoAltoRendimento), correção de 18/11/2026, com uma nuvem simulada (onSnapshot):
   · quem abre a sessão da turma depois adota a sessão que outro treinador já montou hoje (não nasce uma segunda);
   · o que outro treinador muda aparece na tela aberta, com o nome dele;
   · atleta com o plano montado e sem aprovar aparece como "falta aprovar", com "Usar o plano" ali mesmo.
   Usa React/Babel locais (defina CDN_DIR). Rode: node tests/check-ar-sessao-ao-vivo.js */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const { chromium } = require("playwright");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("check-ar-sessao-ao-vivo: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const raiz = path.join(__dirname, "../../mty");
const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
const corte = ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const corpo = `async function listaProfessores(){return [{uid:"p1",nome:"Carlos"},{uid:"p2",nome:"Yoda"}];}
async function organizacao(){return "team-yoda";} var auth=null;
const SESS = {}, ouvintes = [], AR_DOCS = {};
const copia = (v) => JSON.parse(JSON.stringify(v));
const doDia = (dia) => Object.values(SESS).filter((s) => s.data === dia).map((s) => ({ data: () => copia(s), metadata: { hasPendingWrites: false } }));
const emitir = () => ouvintes.slice().forEach((o) => o.cb({ docs: doDia(o.dia) }));
const colSessoes = {
  doc: (id) => ({ set: async (v) => { SESS[id] = copia(v); setTimeout(emitir, 20); } }),
  where: (campo, op, dia) => ({ onSnapshot: (cb) => { const o = { dia, cb }; ouvintes.push(o); setTimeout(() => cb({ docs: doDia(dia) }), 0); return () => { const i = ouvintes.indexOf(o); if (i >= 0) ouvintes.splice(i, 1); }; } }),
  orderBy: () => ({ limit: () => ({ get: async () => ({ docs: Object.values(SESS).map((s) => ({ data: () => copia(s) })) }) }) }),
};
const subVazia = { doc: () => ({ set: async () => {}, delete: async () => {} }), orderBy: () => ({ limit: () => ({ get: async () => ({ docs: [] }) }) }) };
const colAr = { doc: (id) => ({ set: async (v) => { AR_DOCS[id] = { ...(AR_DOCS[id] || {}), ...copia(v) }; }, get: async () => ({ exists: !!AR_DOCS[id], data: () => AR_DOCS[id] }), collection: () => subVazia }) };
var db = { collection: () => ({ doc: () => ({ collection: (c) => (c === "arSessoes" ? colSessoes : colAr) }) }) };
window.__remoto = (s) => { SESS[s.id] = copia(s); emitir(); };
window.__sess = SESS; window.__arDocs = AR_DOCS;
` + ms.slice(0, corte) + `
const AR = window.MTYAltoRendimento, hoje = hojeEq();
const plano = () => AR.gerarPlano({ calendario: [], inicio: AR.somaDias(hoje, -7), semanas: 8, minutosSemana: 600, prioridades: ["fundo", "saque"] });
window.__plano = plano; window.__hoje = hoje;
function Host() {
  const [ars, setArs] = useState({ j1: { ativo: true, plano: plano() }, j2: { ativo: true, planoCandidato: plano() } });
  window.__ars = ars;
  const atletas = [{ id: "j1", nome: "Ana Souza" }, { id: "j2", nome: "Bia Lima" }];
  return <div style={{ padding: 12, maxWidth: 560 }}><SessaoAltoRendimento atletas={atletas} ars={ars} regs={{}} sessaoInicial={null} turma={{ id: "t1", nome: "Sub-14", membros: ["j1", "j2"] }}
    uidAtual="p1" nomeProfessor="Carlos" aoVoltar={() => {}} exerciciosCustom={[]} setExerciciosCustom={() => {}}
    aoAprovarPlano={async (id) => { const patch = aprovarPlanoAR(ars[id]); await arGravar(id, patch); setArs((x) => ({ ...x, [id]: { ...x[id], ...patch } })); }} /></div>;
}
ReactDOM.createRoot(document.getElementById("root")).render(<Host />);`;
const sc = ["sync-listas.js", "scout/graficos.js", "scout/movimento-motor.js", "scout/evidencias.js", "aulas-mes.js", "situacoes-jogo.js", "alto-rendimento.js", "plano-equipe.js", "equipe-rendimento.js"];
const pagina = `<!doctype html><meta charset=utf-8><div id=root></div><script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};window.storage={async get(){return null},async set(k,v){return {key:k,value:v}}};</script>
${sc.map((s) => "<script src=/" + s + "></script>").join("")}<script type="text/babel">${corpo}</script>`;
const m = { "/r.js": CDN + "/react-18.3.1/package/umd/react.development.js", "/d.js": CDN + "/react-dom-18.3.1/package/umd/react-dom.development.js", "/p.js": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "/c.js": CDN + "/recharts-2.15.4/package/umd/Recharts.js", "/b.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js" };
const srv = http.createServer((q, r) => { const u = q.url.split("?")[0]; if (u === "/") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(pagina); } if (m[u]) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(m[u])); } const f = path.join(raiz, decodeURIComponent(u)); if (f.startsWith(raiz) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(f)); } r.writeHead(404); r.end(); }).listen(0);
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox"] });
  const p = await b.newPage({ viewport: { width: 480, height: 900 } }), erros = [];
  p.on("pageerror", (e) => erros.push(e.message)); p.on("console", (x) => { if (x.type() === "error" && !/\[BABEL\]/.test(x.text())) erros.push(x.text()); });
  await p.route(/tailwindcss/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
  await p.goto("http://localhost:" + srv.address().port + "/");
  await p.waitForSelector("[data-sessao-presenca]", { timeout: 120000 }).catch(() => { throw new Error("não renderizou: " + erros.join(" | ")); });
  const texto = () => p.evaluate(() => document.body.innerText);

  /* plano montado e sem aprovar */
  assert(/Plano montado, falta aprovar para entrar na sessão/.test(await p.innerText('[data-presenca="j2"]')));
  /* na turma a presença dela conta mesmo sem plano; o que muda é entrar na montagem */
  await p.locator('[data-presenca="j2"]').getByRole("button", { name: "Usar o plano", exact: true }).click();
  await p.waitForFunction(() => document.querySelector('[data-presenca="j2"] input').checked);
  const doc = await p.evaluate(() => window.__arDocs.j2);
  assert(doc && doc.plano && doc.plano.versao === 1 && doc.planoCandidato === null, "aprovado e gravado: " + JSON.stringify(doc && Object.keys(doc)));

  /* outro treinador (Yoda) monta a sessão da turma com a tela daqui ainda na presença: ela é adotada */
  await p.evaluate(() => {
    const A = window.MTYAltoRendimento, s = A.montarSessao({ atletas: [{ id: "j1", nome: "Ana Souza", ar: window.__ars.j1, registros: [] }], hoje: window.__hoje, duracaoMin: 90, catalogo: TODOS_EXERCICIOS(), estagio: "C" });
    Object.assign(s, { id: "ses-yoda", treinadorUid: "p2", treinadorNome: "Yoda", turmaId: "t1", turmaNome: "Sub-14", convocados: ["j1", "j2"], semPlano: [] });
    window.__remoto(s);
  });
  await p.waitForSelector("[data-sessao-blocos]");
  assert(/Esta turma já tem a sessão de hoje, montada por Yoda/.test(await p.innerText("[data-aviso-outro]")));
  assert(/90 min/.test(await texto()), "é a sessão do Yoda (90 min)");
  const blocos0 = await p.locator("[data-bloco-ar]").count();

  /* Yoda tira um bloco: aparece aqui */
  await p.evaluate(() => { const s = JSON.parse(JSON.stringify(window.__sess["ses-yoda"])); s.blocos.splice(1, 1); s.alteradoPorNome = "Yoda"; s.alteradoEm = new Date().toISOString(); window.__remoto(s); });
  await p.waitForFunction((n) => document.querySelectorAll("[data-bloco-ar]").length === n - 1, blocos0);
  assert(/Sessão atualizada por Yoda/.test(await p.innerText("[data-aviso-outro]")));

  /* a mudança daqui vai para a nuvem com o nome de quem mudou, sem aviso de "outro" para si mesmo */
  await p.evaluate(() => new Promise((r) => setTimeout(r, 6500))); /* espera o aviso anterior sumir */
  const sorteio = p.locator("[data-exercicio-ar] button[aria-label]").first();
  if (await sorteio.count()) {
    await sorteio.click();
    await p.waitForFunction(() => window.__sess["ses-yoda"].alteradoPorNome === "Carlos");
    await p.waitForTimeout(300);
    assert.strictEqual(await p.locator("[data-aviso-outro]").count(), 0, "sem aviso da própria mudança");
  }
  assert.strictEqual(Object.keys(await p.evaluate(() => window.__sess)).length, 1, "não nasceu uma segunda sessão da turma");
  assert.deepStrictEqual(erros, [], "erros: " + erros.join(" | "));
  console.log("check-ar-sessao-ao-vivo: ok");
  await b.close(); srv.close();
})().catch((e) => { console.error(e.message || e); process.exit(1); });
