/* Pop-up de avisos do professor no Team Yoda (mty/index.html → avisosDoProfessorPopup + PopupAvisosProfessor): aulas em
   aberto, aulas de hoje a dar, reposições a marcar dos jogadores dele e o próximo passo da formação.
   Usa React/Babel locais (defina CDN_DIR). Rode: node tests/check-avisos-professor.js [pasta-das-capturas] */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("check-avisos-professor: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const capturas = process.argv[2] || "";
const m = { "/r.js": CDN + "/react-18.3.1/package/umd/react.development.js", "/d.js": CDN + "/react-dom-18.3.1/package/umd/react-dom.development.js", "/p.js": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "/c.js": CDN + "/recharts-2.15.4/package/umd/Recharts.js", "/b.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js" };

(async () => {
  const { chromium } = require("/opt/node22/lib/node_modules/playwright");
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const raiz = path.join(__dirname, "..", "..", "mty"), html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
  const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((x) => x[1]).join("\n");
  const corte = ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
  const corpo = `async function listaProfessores(){return [];} async function organizacao(){return "team-yoda";} var db=null, auth=null;\n` + ms.slice(0, corte) + `
const agora = new Date(); agora.setHours(10, 0, 0, 0);
const hoje = dataISO(agora), ontem = dataISO(new Date(agora.getTime() - 86400000)), antes = dataISO(new Date(agora.getTime() - 3 * 86400000)), em5 = dataISO(new Date(agora.getTime() + 5 * 86400000));
const dia = agora.getDay();
const alunos = [
  { id: "a1", nome: "Ana", professorUid: "p1", horarios: [{ dia, hora: "08:00" }], creditosReposicao: [{ id: "c1", status: "disponivel", validoAte: em5 }, { id: "c2", status: "disponivel", ocorrenciaReposicaoId: "oX" }, { id: "c3", status: "disponivel", validoAte: antes }] },
  { id: "a2", nome: "Bia", pedidosReposicao: [{ id: "p", status: "pendente" }] },
  { id: "a3", nome: "Caio", professorUid: "p2", creditosReposicao: [{ id: "c4", status: "disponivel" }] },
];
const turmas = [{ id: "t1", nome: "Sub-12", membros: ["a2"], professorUid: "p1", horarios: [{ dia, hora: "17:00" }] }, { id: "t2", nome: "Adulto", membros: ["a3"], professorUid: "p2", horarios: [{ dia, hora: "18:00" }] }];
const ocorrencias = [
  { id: "o1", origemTipo: "turma", origemId: "t1", data: ontem, horaInicio: "17:00", status: "agendada", professorUid: "p1" },
  { id: "o2", origemTipo: "turma", origemId: "t1", data: antes, horaInicio: "17:00", status: "realizada", professorUid: "p1" },
  { id: "o3", origemTipo: "turma", origemId: "t2", data: ontem, horaInicio: "18:00", status: "agendada", professorUid: "p2" },
  { id: "o4", origemTipo: "individual", origemId: "a3", data: ontem, horaInicio: "09:00", status: "agendada", professorUid: "p2", substitutoUid: "p1" },
];
const c0 = CURSOS_FORMACAO[0], c1 = CURSOS_FORMACAO[1];
const membro = novoMembroFormacao("Leo", "p1");
membro.progresso[c0.id][0] = { concluido: true }; membro.progresso[c0.id][1] = { concluido: true };
const membroQuiz = novoMembroFormacao("Duda", "p2"); c0.modulos.forEach((_, i) => { membroQuiz.progresso[c0.id][i] = { concluido: true }; });
const av = avisosDoProfessorPopup({ uid: "p1", alunos, turmas, ocorrencias, membrosFormacao: [membro, membroQuiz], agora });
const avQ = avisosDoProfessorPopup({ uid: "p2", alunos, turmas, ocorrencias, membrosFormacao: [membro, membroQuiz], agora });
const avNovo = avisosDoProfessorPopup({ uid: "p9", alunos, turmas, ocorrencias, membrosFormacao: [], agora });
window.__r = { av, avQ, avNovo, c0: c0.nome, m3: c0.modulos[2].t, c0m1: c0.modulos[0].t, total: CURSOS_FORMACAO.reduce((s, c) => s + c.modulos.length, 0), n: CURSOS_FORMACAO.length };
function Teste() {
  const [aberto, setAberto] = useState(true);
  return aberto ? <PopupAvisosProfessor avisos={av} aoIr={(v) => { window.__foi = v; setAberto(false); }} aoFechar={() => { window.__fechou = true; setAberto(false); }} /> : <p>fechado</p>;
}
ReactDOM.createRoot(document.getElementById("root")).render(<Teste />);`;
  const pagina = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><div id=root></div><script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};</script><script src=/sync-listas.js></script><script type="text/babel">${corpo}</script>`;
  const srv = http.createServer((q, r) => { const u = q.url.split("?")[0]; if (u === "/") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(pagina); } if (m[u]) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(m[u])); } const f = path.join(raiz, u); if (f.startsWith(raiz) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(f)); } r.writeHead(404); r.end(); }).listen(0);
  for (const larg of [1100, 390]) {
    const p = await b.newPage({ viewport: { width: larg, height: 860 } }), erros = [];
    p.on("pageerror", (e) => erros.push(e.message));
    await p.route(/tailwindcss/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
    await p.goto("http://localhost:" + srv.address().port + "/");
    await p.waitForFunction(() => window.__r && document.querySelector("[data-popup-avisos]"), null, { timeout: 90000 }).catch(() => { throw new Error("não renderizou: " + erros.join(" | ")); });
    if (larg === 1100) {
      const R = await p.evaluate(() => window.__r), av = R.av;
      assert.deepStrictEqual(av.emAberto.map((x) => x.id).sort(), ["o1", "o4"], "aulas em aberto dele (titular e substituto), não as dos outros nem as já fechadas");
      assert.deepStrictEqual(av.aDar.map((x) => x.hora + " " + x.titulo), ["17:00 Sub-12"], "aula de hoje ainda por dar (a das 8h já passou; a das 18h é de outro professor)");
      assert.deepStrictEqual(av.reposicoes.map((r) => r.nome + ":" + r.tipo), ["Ana:credito", "Bia:pedido"], "crédito disponível sem horário e pedido, só dos jogadores dele");
      assert.strictEqual(av.formacao.cursoIndice, 1); assert.strictEqual(av.formacao.proximo, "Módulo 3: " + R.m3); assert.strictEqual(av.formacao.feitos, 2);
      assert.strictEqual(R.avQ.formacao.proximo, "Quiz do curso", "módulos do curso feitos: falta o quiz");
      assert.strictEqual(R.avNovo.formacao.proximo, "Módulo 1: " + R.c0m1, "quem não começou vê o primeiro módulo");
      assert.strictEqual(R.avNovo.urgente, 0);
      const t = await p.evaluate(() => document.body.innerText);
      assert(/Aulas em aberto · 2/.test(t) && /Aulas de hoje · 1/.test(t) && /Reposições a marcar · 2/.test(t), "seções no pop-up");
      assert(new RegExp("Estágio atual: curso 1 de " + R.n).test(t) && /Próximo: Módulo 3/.test(t) && new RegExp("2 de " + R.total + " módulos concluídos").test(t), "formação no pop-up");
      if (capturas) { fs.mkdirSync(capturas, { recursive: true }); await p.screenshot({ path: path.join(capturas, "popup-avisos.png") }); }
      await p.click('button:text-is("Fechar as aulas")'); assert.strictEqual(await p.evaluate(() => window.__foi), "aulas-hoje", "botão leva para Aulas de hoje");
      console.log("  avisos calculados por professor; pop-up com aulas em aberto, de hoje, reposições e formação");
    } else {
      const w = await p.evaluate(() => document.documentElement.scrollWidth);
      assert(w <= 392, "celular sem rolagem lateral (" + w + ")");
      if (capturas) await p.screenshot({ path: path.join(capturas, "popup-avisos-390.png") });
      await p.click('button:text-is("Ver depois")'); assert(await p.evaluate(() => window.__fechou), "ver depois fecha");
      console.log("  celular 390 px: cabe na tela");
    }
    assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
    await p.close();
  }
  srv.close(); await b.close();
  console.log("check-avisos-professor: ok");
})().catch((e) => { console.error(e.message || e); process.exit(1); });
