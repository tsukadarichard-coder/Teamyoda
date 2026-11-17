/* Team Yoda (mty/index.html): cadastro rápido "Só cadastro" (aluno sem aula nem planejamento) e o cartão "Área do aluno" na ficha
   (e-mails de acesso, convite pelo e-mail de criar senha e aviso pelo WhatsApp). Pedido do Richard em 17/11/2026.
   Usa React/Babel locais (defina CDN_DIR). Rode: node tests/check-cadastro-rapido.js [pasta-das-capturas] */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("check-cadastro-rapido: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const capturas = process.argv[2] || "";
const m = { "/aulas-mes.js": path.join(__dirname, "../../mty/aulas-mes.js"), "/r.js": CDN + "/react-18.3.1/package/umd/react.development.js", "/d.js": CDN + "/react-dom-18.3.1/package/umd/react-dom.development.js", "/p.js": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "/c.js": CDN + "/recharts-2.15.4/package/umd/Recharts.js", "/b.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js" };
(async () => {
  const { chromium } = require("playwright");
  const b = await chromium.launch({ args: ["--no-sandbox"] });
  const raiz = path.join(__dirname, "..", "..", "mty"), html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
  const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((x) => x[1]).join("\n");
  const corte = ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
  const corpo = `async function listaProfessores(){return [{ uid: "u1", nome: "Prof Um" }, { uid: "u2", nome: "Prof Dois" }];} async function organizacao(){return "team-yoda";} var db=null, auth=null;
window.__chamadas = []; window.__resets = [];
window.mtyAuth={usuario:()=>({uid:"u1",email:"prof@x.com"}),tokenId:async()=>"tk",recuperarSenha:async(e)=>{window.__resets.push(e);}};
window.fetch = async (url, o) => { const c = JSON.parse(o.body); window.__chamadas.push(c); return { ok: true, status: 200, json: async () => ({ ok: true }) }; };\n` + ms.slice(0, corte) + `
function Teste() {
  const [alunos, setAlunos] = useState([{ ...novoAluno(), id: "a0", nome: "Antigo", cadastroConcluido: true, estagio: "C", professorNome: "Prof Um" }]);
  const [aberto, setAberto] = useState(null);
  window.__alunos = alunos;
  window.__grupos = agruparAlunosPorProfessorETipo(alunos);
  const salvar = async (f) => { setAlunos((l) => l.map((a) => (a.id === f.id ? f : a))); return true; };
  const al = alunos.find((a) => a.id === aberto);
  return <div style={{ padding: 12 }}>
    {!al && <CadastroRapido uidAtual="u1" aoCriar={(n) => { setAlunos((l) => [...l, n]); setAberto(n.id); }} aoCancelar={() => {}} />}
    {al && <TelaFicha key={al.id} aluno={al} salvar={salvar} papelAtual="coordenador" uidAtual="u1" quadras={[]} />}
  </div>;
}
ReactDOM.createRoot(document.getElementById("root")).render(<Teste />);`;
  const pagina = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><div id=root></div><script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script><script src=/aulas-mes.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return "tok" + Math.random().toString(36).slice(2, 8)}};</script><script src=/sync-listas.js></script><script type="text/babel">${corpo}</script>`;
  const srv = http.createServer((q, r) => { const u = q.url.split("?")[0]; if (u === "/") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(pagina); } if (m[u]) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(m[u])); } const f = path.join(raiz, decodeURIComponent(u)); if (f.startsWith(raiz) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(f)); } r.writeHead(404); r.end(); }).listen(0);
  const p = await b.newPage({ viewport: { width: 390, height: 900 } }), erros = [];
  p.on("pageerror", (e) => erros.push(e.message));
  p.on("dialog", (d) => d.accept());
  await p.route(/tailwindcss/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
  await p.goto("http://localhost:" + srv.address().port + "/");
  await p.waitForSelector("[data-cadastro-rapido]", { timeout: 90000 }).catch(() => { throw new Error("não renderizou: " + erros.join(" | ")); });
  await p.waitForFunction(() => document.querySelectorAll("[data-cadastro-rapido] select option").length === 3);
  if (capturas) await p.screenshot({ path: path.join(capturas, "cadastro-rapido.png"), fullPage: true });

  /* validação: nome e e-mail */
  await p.click('button:text-is("Cadastrar aluno")');
  assert.ok(/Escreva o nome do aluno/.test(await p.innerText("[data-cadastro-rapido]")));
  await p.fill("[data-rapido-nome]", "Lia Mendes"); await p.fill("[data-rapido-email]", "mae-errado");
  await p.click('button:text-is("Cadastrar aluno")');
  assert.ok(/Confira o e-mail/.test(await p.innerText("[data-cadastro-rapido]")));
  await p.fill("[data-rapido-email]", " Mae.Lia@Exemplo.com ");
  await p.selectOption("[data-cadastro-rapido] select", "u2");
  await p.click('button:text-is("Cadastrar aluno")');
  await p.waitForSelector("[data-so-cadastro]");
  let al = await p.evaluate(() => window.__alunos.find((a) => a.nome === "Lia Mendes"));
  assert.strictEqual(al.soCadastro, true); assert.strictEqual(al.cadastroConcluido, true);
  assert.deepStrictEqual(al.emailsAcesso, ["mae.lia@exemplo.com"]); assert.ok(/^tok/.test(al.linkToken), "link nasce com o e-mail");
  assert.deepStrictEqual([al.professorUid, al.professorNome, (al.horarios || []).length, al.plano], ["u2", "Prof Dois", 0, null]);
  const grupos = await p.evaluate(() => window.__grupos);
  assert.ok(grupos["Prof Dois"]["Só cadastro"] && grupos["Prof Dois"]["Só cadastro"][0].nome === "Lia Mendes", "grupo Só cadastro na lista");

  /* ficha: aviso de só cadastro + cartão da Área do aluno */
  let t = await p.innerText("#root");
  assert.ok(/Só cadastro/i.test(t) && /Completar cadastro/i.test(t) && /Área do aluno/i.test(t), t.slice(0, 400));
  assert.strictEqual(await p.inputValue('[data-email-acesso="0"]'), "mae.lia@exemplo.com");
  if (capturas) await p.screenshot({ path: path.join(capturas, "ficha-so-cadastro.png"), fullPage: true });

  /* segundo e-mail: salvar e convidar */
  await p.fill('[data-email-acesso="1"]', "lia@exemplo.com");
  await p.click('button:text-is("Salvar e-mails")');
  await p.waitForFunction(() => (window.__alunos.find((a) => a.nome === "Lia Mendes").emailsAcesso || []).length === 2);
  await p.click('button:text-is("Enviar convite para lia@exemplo.com")');
  await p.waitForSelector("[data-zap-convite]");
  const ch = await p.evaluate(() => window.__chamadas);
  assert.deepStrictEqual(ch.map((c) => [c.acao, c.email]), [["convidarAluno", "lia@exemplo.com"]]);
  assert.deepStrictEqual(await p.evaluate(() => window.__resets), ["lia@exemplo.com"]);
  const zap = decodeURIComponent(await p.getAttribute("[data-zap-convite]", "href"));
  assert.ok(/teamyoda\.com\.br\/minha-area/.test(zap) && /Lia/.test(zap) && /lia@exemplo\.com/.test(zap), zap);

  /* tirar o e-mail corta o acesso; o rascunho da ficha guarda os e-mails (concluir a ficha não os apaga) */
  await p.fill('[data-email-acesso="1"]', "");
  await p.click('button:text-is("Salvar e-mails")');
  await p.waitForFunction(() => window.__alunos.find((a) => a.nome === "Lia Mendes").emailsAcesso.length === 1);
  await p.click('button:text-is("Completar cadastro")');
  await p.waitForFunction(() => /Etapa 1 de 5/i.test(document.body.innerText));
  assert.deepStrictEqual(erros, []);
  console.log("check-cadastro-rapido: ok");
  await b.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
