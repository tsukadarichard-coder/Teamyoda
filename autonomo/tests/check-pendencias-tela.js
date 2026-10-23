/* Pendências do dia no Team Yoda (mty/index.html → TelaPendencias): aulas de hoje com lembrete e aviso de cancelamento,
   reposições, reservas e inscrições novas, cada uma com o link do WhatsApp já com número e texto; modelos editáveis.
   Usa React/Babel locais (defina CDN_DIR). Rode: node tests/check-pendencias-tela.js [pasta-das-capturas] */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if (!fs.existsSync(CDN)) { console.log("check-pendencias-tela: pulado (sem React/Babel locais; defina CDN_DIR)"); process.exit(0); }
const capturas = process.argv[2] || "";
const m = { "/r.js": CDN + "/react-18.3.1/package/umd/react.development.js", "/d.js": CDN + "/react-dom-18.3.1/package/umd/react-dom.development.js", "/p.js": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "/c.js": CDN + "/recharts-2.15.4/package/umd/Recharts.js", "/b.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js" };

(async () => {
  const { chromium } = require("/opt/node22/lib/node_modules/playwright");
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const raiz = path.join(__dirname, "..", "..", "mty"), html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
  const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((x) => x[1]).join("\n");
  const corte = ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
  for (const larg of [1100, 390]) {
    const corpo = `async function listaProfessores(){return [];} async function organizacao(){return "team-yoda";} var db=null, auth=null;
window.mtyAuth={usuario:()=>({uid:"u1",email:"coord@x.com"}),tokenId:async()=>"x"};\n` + ms.slice(0, corte) + `
const hoje = dataISO(new Date()), dia = new Date(hoje + "T12:00:00").getDay(), ontem = dataISO(new Date(Date.now() - 86400000)), em3 = dataISO(new Date(Date.now() + 3 * 86400000));
window.__testes = { n1: numeroWhatsApp("(11) 98765-4321"), n2: numeroWhatsApp("+55 11 98765-4321"), n3: numeroWhatsApp("123"), modelo: preencherModelo("Oi {nome}, {x}", { nome: "Ana" }) };
function Teste() {
  const [alunos] = useState([
    { id: "a1", nome: "Ana Souza", telefone: "(11) 98765-4321", pedidosReposicao: [{ id: "p1", status: "pendente", diaPreferido: 3 }], creditosReposicao: [{ id: "c1", status: "disponivel", validoAte: em3 }] },
    { id: "a2", nome: "Bia Lima", telefone: "11 91111-2222", telefoneResponsavel: "11 93333-4444", creditosReposicao: [{ id: "c2", status: "pendente_aprovacao" }] },
    { id: "a3", nome: "Caio Reis" },
  ]);
  const [turmas] = useState([{ id: "t1", nome: "Sub-12", membros: ["a1", "a2", "a3"], horarios: [{ dia, hora: "17:00", quadraId: "q1" }] }]);
  const [ocorrencias] = useState([{ id: "o0", origemTipo: "turma", origemId: "t1", data: ontem, horaInicio: "17:00", status: "agendada" }]);
  const [reservas, setReservas] = useState([{ id: "r1", quadraId: "q1", data: em3, horaInicio: "08:00", horaFim: "09:00", nomeContato: "Duda Melo", telefoneContato: "11 95555-6666", origem: "cliente", vistoPeloStaff: false }]);
  const [torneios, setTorneios] = useState([{ id: "to1", nome: "Open", categorias: [{ id: "c1", nome: "B", inscritos: [{ id: "i1", nomeContato: "Edu", telefoneContato: "11 97777-8888", origem: "cliente", vistoPeloStaff: false }] }] }]);
  const [eventos, setEventos] = useState([]);
  const [modelos, setModelos] = useState(MODELOS_MENSAGEM_PADRAO);
  window.__estado = { reservas, torneios, modelos };
  return <div style={{ padding: 12 }}><TelaPendencias alunos={alunos} turmas={turmas} quadras={[{ id: "q1", nome: "Quadra 1" }]} ocorrencias={ocorrencias}
    reservas={reservas} setReservas={setReservas} torneios={torneios} setTorneios={setTorneios} eventos={eventos} setEventos={setEventos}
    modelos={modelos} setModelos={setModelos} orgAtual="team-yoda" irParaAluno={(id) => { window.__abriu = id; }} irPara={(v) => { window.__foi = v; }} /></div>;
}
ReactDOM.createRoot(document.getElementById("root")).render(<Teste />);`;
    const pagina = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><div id=root></div><script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};</script><script src=/sync-listas.js></script><script type="text/babel">${corpo}</script>`;
    const srv = http.createServer((q, r) => { const u = q.url.split("?")[0]; if (u === "/") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(pagina); } if (m[u]) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(m[u])); } const f = path.join(raiz, u); if (f.startsWith(raiz) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(f)); } r.writeHead(404); r.end(); }).listen(0);
    const p = await b.newPage({ viewport: { width: larg, height: 900 } }), erros = [];
    p.on("pageerror", (e) => erros.push(e.message));
    await p.route(/tailwindcss/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
    await p.goto("http://localhost:" + srv.address().port + "/");
    await p.waitForFunction(() => window.__testes && /Pendências do dia/.test(document.body.innerText), null, { timeout: 90000 }).catch(() => { throw new Error("não renderizou: " + erros.join(" | ")); });
    const links = async () => p.evaluate(() => [...document.querySelectorAll('a[href^="https://wa.me/"]')].map((a) => ({ txt: a.innerText, href: decodeURIComponent(a.getAttribute("href")) })));
    if (larg === 1100) {
      const T = await p.evaluate(() => window.__testes);
      assert.strictEqual(T.n1, "5511987654321"); assert.strictEqual(T.n2, "5511987654321"); assert.strictEqual(T.n3, ""); assert.strictEqual(T.modelo, "Oi Ana, ");
      let t = await p.evaluate(() => document.body.innerText);
      assert(/17:00 · Sub-12 · Quadra 1/.test(t), "aula de hoje vinda do horário fixo da turma");
      assert(/1 aula de dias anteriores/.test(t), "aula de ontem sem fechar");
      /* lembrete: um link por jogador, com o número (responsável quando houver) e o texto */
      await p.click('button:text-is("Lembrete")');
      let L = await links();
      const daAna = L.find((l) => /5511987654321\?text=Olá, Ana! Lembrete: Sub-12 hoje às 17:00/.test(l.href));
      assert(daAna, "lembrete da Ana com número e texto: " + JSON.stringify(L.slice(0, 3)));
      assert(L.some((l) => /wa\.me\/5511933334444\?text=Olá, Bia!/.test(l.href)), "Bia: vai para o responsável");
      assert(L.some((l) => /wa\.me\/\?text=Olá, Caio!/.test(l.href) && /sem nº/.test(l.txt)), "Caio sem número: abre o WhatsApp para escolher o contato");
      assert(/cadastrar WhatsApp/.test(await p.evaluate(() => document.body.innerText)), "atalho para cadastrar o número");
      /* cancelamento com motivo */
      await p.fill('input[placeholder="ex.: chuva"]', "chuva forte");
      await p.click('button:text-is("Aviso de cancelamento")');
      L = await links();
      assert(L.some((l) => /foi cancelada \(chuva forte\)/.test(l.href)), "aviso de cancelamento com o motivo");
      /* reposições, reserva e inscrição */
      t = await p.evaluate(() => document.body.innerText);
      assert(/Ana Souza pediu reposição · prefere/.test(t), "pedido de reposição");
      assert(/1 crédito de reposição esperando sua aprovação \(Bia\)/.test(t), "crédito para aprovar");
      assert(/Crédito de Ana Souza vence em/.test(t), "crédito vencendo em 7 dias");
      assert(L.some((l) => /5511955556666\?text=Olá, Duda! Sua reserva da Quadra 1/.test(l.href)), "confirmação da reserva");
      assert(L.some((l) => /5511977778888\?text=Olá, Edu! Sua inscrição em Open · B está confirmada/.test(l.href)), "confirmação da inscrição");
      assert(!/Mensalidades em aberto/.test(t), "mensalidades só para o dono");
      await p.click('div:has-text("Duda Melo") >> button:text-is("Visto")');
      await p.waitForFunction(() => window.__estado.reservas[0].vistoPeloStaff === true);
      await p.click('div:has-text("se inscreveu") >> button:text-is("Visto")');
      await p.waitForFunction(() => window.__estado.torneios[0].categorias[0].inscritos[0].vistoPeloStaff === true);
      assert(/Nenhuma reserva ou inscrição nova/.test(await p.evaluate(() => document.body.innerText)), "vistos somem da lista");
      /* modelos editáveis */
      await p.click('button:text-is("Editar os textos")');
      await p.fill("textarea >> nth=0", "Fala, {nome}! {aula} às {hora}, te espero.");
      await p.click('button:text-is("Salvar textos")');
      await p.waitForFunction(() => /^Fala, \{nome\}/.test(window.__estado.modelos.lembrete));
      await p.click('button:text-is("Lembrete")');
      L = await links(); assert(L.some((l) => /text=Fala, Ana! Sub-12 às 17:00, te espero\./.test(l.href)), "lembrete usa o texto novo");
      await p.click('button:text-is("Abrir")'); assert.strictEqual(await p.evaluate(() => window.__abriu), "a1", "abrir o jogador do pedido");
      if (capturas) { fs.mkdirSync(capturas, { recursive: true }); await p.screenshot({ path: path.join(capturas, "pendencias.png"), fullPage: true }); }
      console.log("  lembrete, cancelamento, reposições, reserva e inscrição com WhatsApp pronto; textos editáveis");
    } else {
      await p.click('button:text-is("Lembrete")');
      const w = await p.evaluate(() => document.documentElement.scrollWidth);
      assert(w <= 392, "celular: sem rolagem lateral (" + w + " px)");
      if (capturas) await p.screenshot({ path: path.join(capturas, "pendencias-390.png"), fullPage: true });
      console.log("  celular 390 px: sem rolagem lateral");
    }
    assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
    await p.close(); srv.close();
  }
  await b.close();
  console.log("check-pendencias-tela: ok");
})().catch((e) => { console.error(e.message || e); process.exit(1); });
