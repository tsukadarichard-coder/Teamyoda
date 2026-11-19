/* Agenda do app do Team Yoda para o professor (19/11/2026, "Veja se toda a parte de gestão está fora do acesso dos professores"):
   a reserva de quadra aparece como "Quadra reservada", sem nome nem telefone do cliente e sem "Cancelar reserva"; o "+ Agendar"
   não oferece Locação nem Bloqueio; o menu com link de reservas, página pública, quadras e horários recorrentes some. A gestão
   (podeGestao) continua vendo tudo. Usa React/Babel locais (defina CDN_DIR). Rode: node tests/check-agenda-professor.js */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const { chromium } = require("playwright");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("check-agenda-professor: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const raiz = path.join(__dirname, "../../mty");
const html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
const corte = ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const corpo = `async function listaProfessores(){return [{uid:"p1",nome:"Carlos"}];} async function organizacao(){return null;} var db=null, auth=null;
window.storage = { async get(k){ return null; }, async set(k, v){ return { key: k, value: v }; } };
` + ms.slice(0, corte) + `
function Host() {
  const hoje = dataISO(new Date());
  const [reservas, setReservas] = useState([{ id: "r1", quadraId: "q1", data: hoje, horaInicio: "10:00", horaFim: "11:00", nomeContato: "Cliente Fulano", telefoneContato: "11 98888-1111", origem: "cliente" }]);
  window.__reservas = reservas;
  return <TelaAgenda alunos={[]} setAlunos={() => {}} turmas={[]} setTurmas={() => {}} ocorrencias={[]} setOcorrencias={() => {}} quadras={[{ id: "q1", nome: "Quadra 1", ativa: true }]}
    reservas={reservas} setReservas={setReservas} bloqueiosAula={[]} orgAtual="team-yoda" mostraQuadras={true} uidAtual="p1" papelAtual={window.__papel} exigeLogin={true}
    regrasReposicao={{}} setAba={(v) => { window.__aba = v; }} podeGestao={window.__gestao} irParaSessaoAluno={() => {}} irParaSessaoTurma={() => {}} irParaTurmaAR={() => {}} />;
}
ReactDOM.createRoot(document.getElementById("root")).render(<div style={{ padding: 12 }}><Host /></div>);`;
const pagina = `<!doctype html><meta charset=utf-8><div id=root></div><script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script><script src=/aulas-mes.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};</script><script src=/alto-rendimento.js></script><script type="text/babel">${corpo}</script>`;
const m = { "/aulas-mes.js": path.join(raiz, "aulas-mes.js"), "/alto-rendimento.js": path.join(raiz, "alto-rendimento.js"), "/r.js": CDN + "/react-18.3.1/package/umd/react.development.js", "/d.js": CDN + "/react-dom-18.3.1/package/umd/react-dom.development.js", "/p.js": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "/c.js": CDN + "/recharts-2.15.4/package/umd/Recharts.js", "/b.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js" };
const srv = http.createServer((q, r) => { const u = q.url.split("?")[0]; if (u === "/") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(pagina); } if (m[u]) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(m[u])); } r.writeHead(404); r.end(); }).listen(0);
(async () => {
  const b = await chromium.launch({ args: ["--no-sandbox"] }), erros = [];
  const abrir = async (papel, gestao) => {
    const ctx = await b.newContext({ viewport: { width: 1100, height: 900 } });
    await ctx.addInitScript((x) => { window.__papel = x.papel; window.__gestao = x.gestao; }, { papel, gestao });
    await ctx.route(/tailwindcss/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
    const p = await ctx.newPage(); p.on("pageerror", (e) => erros.push(papel + ": " + e.message));
    await p.goto("http://localhost:" + srv.address().port + "/");
    await p.waitForFunction(() => /Locação|Quadra reservada|Cliente Fulano/.test(document.body.innerText), null, { timeout: 120000 }).catch(async () => { throw new Error("agenda não mostrou a reserva: " + erros.join(" | ") + "\n" + (await p.evaluate(() => document.body.innerText)).slice(0, 800)); });
    return { p, ctx };
  };
  /* professor */
  let { p, ctx } = await abrir("treinador", false);
  let t = await p.evaluate(() => document.body.innerText);
  assert(/Quadra reservada/.test(t) && !/Cliente Fulano|98888/.test(t), "professor não vê o cliente: " + t.slice(0, 600));
  assert(!/Mais opções/.test(t), "sem o menu de gestão da Agenda");
  await p.getByText("Quadra reservada").first().evaluate((e) => (e.closest("button,[role=button]") || e).click());
  await p.waitForSelector("[data-reserva-oculta]");
  t = await p.evaluate(() => document.body.innerText);
  assert(!/Cancelar reserva|98888|Cliente Fulano/.test(t), "detalhe sem cliente e sem cancelar");
  const agendar = p.getByRole("button", { name: /Agendar/ }).first();
  if (await agendar.count()) {
    await p.keyboard.press("Escape"); await p.evaluate(() => { const f = [...document.querySelectorAll("div")].find((d) => getComputedStyle(d).position === "fixed" && d.onclick); if (f) f.click(); });
    await agendar.evaluate((e) => e.click()); await p.waitForTimeout(300);
    const tipos = await p.evaluate(() => [...document.querySelectorAll('[aria-label="Agendar"] button')].map((x) => x.innerText.trim()));
    assert(tipos.includes("Aula individual") && tipos.includes("Reposição") && !tipos.includes("Locação") && !tipos.includes("Bloqueio"), "tipos do professor: " + tipos.join(","));
  }
  await ctx.close();
  /* gestão */
  ({ p, ctx } = await abrir("coordenador", true));
  t = await p.evaluate(() => document.body.innerText);
  assert(/Cliente Fulano/.test(t) && /Mais opções/.test(t), "gestão vê o cliente e o menu");
  await ctx.close();
  assert.deepStrictEqual(erros, [], erros.join(" | "));
  console.log("check-agenda-professor: ok");
  await b.close(); srv.close();
})().catch((e) => { console.error(e.message || e); process.exit(1); });
