/* Telas novas do Financeiro no Team Yoda (mty/index.html): Importar planilha (SheetJS no navegador → simular → gravar),
   Acesso administrativo, vencimento/forma e pendências em "Recebido e pago", e a tela Cobrança da parte administrativa
   (marca recebido, forma, quita pendência; não vê resultado nem margem). Usa a function de verdade sobre um Firebase falso.
   Precisa de React/Babel/SheetJS locais (CDN_DIR). Rode: node tests/check-financeiro-cobranca-tela.js [pasta-das-capturas] */
const fs = require("fs"), path = require("path"), http = require("http"), assert = require("assert"), Module = require("module");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
const XLSX_JS = CDN + "/xlsx-0.18.5/package/dist/xlsx.full.min.js";
if (!fs.existsSync(CDN) || !fs.existsSync(XLSX_JS)) { console.log("check-financeiro-cobranca-tela: pulado (sem React/Babel/SheetJS locais; defina CDN_DIR)"); process.exit(0); }
const capturas = process.argv[2] || "";
const XLSX = require(CDN + "/xlsx-0.18.5/package/xlsx.js");

/* planilha no formato da planilha-modelo (linha 1 = cabeçalho, linha 2 = exemplo que não entra) */
function planilhaTeste() {
  const wb = XLSX.utils.book_new();
  const aba = (nome, linhas) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(linhas), nome);
  aba("Leia primeiro", [["Planilha de migração"]]);
  aba("Alunos", [["Nome completo do aluno *", "Data de nascimento", "Responsável (nome)", "WhatsApp do responsável", "Unidade *", "Turma(s) (nome igual à aba Turmas; separe por ;)", "Situação *"],
    ["Ana Souza Lima", "", "Carla Souza", "", "Team Yoda", "", "Ativo"],
    ["Teste Silva", new Date(2012, 2, 12), "Rita Silva", "(11) 91234-5678", "Team Yoda", "Juvenil Teste", "Ativo"]]);
  aba("Turmas", [["Nome da turma *", "Unidade *", "Professor *", "Dias e horários", "Mensalidade por aluno (R$) *"],
    ["Juvenil Teste", "Team Yoda", "Leo", "Seg e Qua 18:00", 520]]);
  aba("Cobrança", [["Nome do aluno *", "O que paga *", "Turma (se for turma)", "Valor cheio (R$) *", "Valor que paga por mês (R$) *", "Dia do vencimento", "Forma de pagamento", "Quem paga (nome)"],
    ["Teste Silva", "Turma", "Juvenil Teste", 520, 520, 10, "Pix", "Rita Silva"]]);
  aba("Em aberto", [["Nome do aluno *", "Mês de referência *", "Valor (R$) *", "Vencimento", "Situação *"],
    ["Teste Silva", "10/2026", 520, new Date(2026, 9, 10), "Atrasado"]]);
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

/* Firebase falso: caminho → dados do documento */
const reg = (data, extra) => Object.assign({ id: "r" + Math.random().toString(36).slice(2, 7), tipo: "sessao", data }, extra);
const banco = {
  "orgs/team-yoda/dados/mty:alunos:v2": { value: JSON.stringify([{ id: "a1", nome: "Ana Souza", telefoneResponsavel: "(11) 98888-7777", registros: [reg("2026-11-03", { turma: "Sub-12", registradoPorUid: "p1" })] }]) },
  "orgs/team-yoda/dados/mty:turmas:v1": { value: JSON.stringify([{ id: "t1", nome: "Sub-12", membros: ["a1"], professorUid: "p1", professorNome: "Leo", horarios: [] }]) },
  "financeiro/team-yoda": { config: { turmas: { t1: { preco: 400 } }, professores: { "u:p1": { forma: "aula", individual: 90, turma: 120 } } } },
};
const doc = (c) => ({ caminho: c, get: async () => ({ exists: !!banco[c], data: () => banco[c] }), set: async (v) => { banco[c] = v; }, collection: (x) => col(c + "/" + x) });
const col = (c) => ({ doc: (d) => doc(c + "/" + d), where: () => ({ get: async () => (c.startsWith("orgs/team-yoda") ? [{ id: "p1", data: () => ({ nome: "Leo Martins", email: "leo@x.com" }) }] : []) }) });
const EMAILS = { dono: "tsukada.richard@gmail.com", adm: "adm@x.com", coord: "coord@x.com" };
const adminFalso = {
  auth: () => ({ verifyIdToken: async (t) => (EMAILS[t] ? { email: EMAILS[t] } : Promise.reject(new Error("token"))) }),
  firestore: () => ({ collection: (c) => col(c), runTransaction: async (fn) => { const pend = []; await fn({ get: (r) => r.get(), set: (r, v) => pend.push([r, v]) }); for (const [r, v] of pend) await r.set(v); } }),
};
const carregar = Module._load;
Module._load = function (pedido) { if (/_firebase-admin$/.test(pedido)) return { admin: adminFalso, app: () => {} }; return carregar.apply(this, arguments); };
const fin = require(path.join(__dirname, "../../netlify/functions/financeiro.js"));
const posts = [];
const lista = (k) => JSON.parse(banco["orgs/team-yoda/dados/" + k].value);
const cfg = () => banco["financeiro/team-yoda"].config;

const m = { "/aulas-mes.js": path.join(__dirname, "../../mty/aulas-mes.js"), "/r.js": CDN + "/react-18.3.1/package/umd/react.development.js", "/d.js": CDN + "/react-dom-18.3.1/package/umd/react-dom.development.js",
  "/p.js": CDN + "/prop-types-15.8.1/package/prop-types.min.js", "/c.js": CDN + "/recharts-2.15.4/package/umd/Recharts.js", "/b.js": CDN + "/babel-standalone-7.29.9/package/babel.min.js" };
(async () => {
  const { chromium } = require("/opt/node22/lib/node_modules/playwright");
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args: ["--no-sandbox"] });
  const raiz = path.join(__dirname, "..", "..", "mty"), html = fs.readFileSync(path.join(raiz, "index.html"), "utf8");
  const ms = [...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map((x) => x[1]).join("\n");
  const corte = ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
  assert(corte > 0, "achou o ponto de montagem do app");

  async function abrir(quem, larg, tela) {
    const corpo = `async function listaProfessores(){return [];} async function organizacao(){return "team-yoda";} var db=null, auth=null;
window.mtyAuth={usuario:()=>({uid:"u-${quem}",email:${JSON.stringify(EMAILS[quem])}}),tokenId:async()=>${JSON.stringify(quem)}};\n` + ms.slice(0, corte) + `
papelFinanceiro().then((p) => { window.__papel = p; });
ReactDOM.createRoot(document.getElementById("root")).render(<div style={{padding:12}}>${tela}</div>);`;
    const pagina = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><script src="https://cdn.tailwindcss.com"></script><div id=root></div><script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script><script src=/aulas-mes.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};</script><script src=/sync-listas.js></script><script type="text/babel">${corpo}</script>`;
    const srv = http.createServer((q, r) => { const u = q.url.split("?")[0]; if (u === "/") { r.writeHead(200, { "content-type": "text/html; charset=utf-8" }); return r.end(pagina); } if (m[u]) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(m[u])); } const f = path.join(raiz, u); if (f.startsWith(raiz) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { "content-type": "text/javascript" }); return r.end(fs.readFileSync(f)); } r.writeHead(404); r.end(); }).listen(0);
    const p = await b.newPage({ viewport: { width: larg, height: 900 } }), erros = [];
    p.on("pageerror", (e) => erros.push(e.message));
    p.on("dialog", (d) => d.accept());
    const TW = CDN + "/tw/package/dist/index.global.js"; // Tailwind local, quando houver, para as capturas saírem como no app
    await p.route(/tailwindcss/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: fs.existsSync(TW) ? fs.readFileSync(TW, "utf8") : "" }));
    await p.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/xlsx\/0\.18\.5\/xlsx\.full\.min\.js/, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: fs.readFileSync(XLSX_JS, "utf8") }));
    await p.route(/\.netlify\/functions\/financeiro/, async (rt) => {
      const q = rt.request(), url = new URL(q.url());
      if (q.method() === "POST") posts.push(JSON.parse(q.postData()));
      const r = await fin.handler({ httpMethod: q.method(), headers: q.headers(), queryStringParameters: Object.fromEntries(url.searchParams), body: q.postData() });
      await rt.fulfill({ status: r.statusCode, contentType: "application/json", body: r.body });
    });
    await p.goto("http://localhost:" + srv.address().port + "/");
    await p.waitForFunction(() => window.__papel !== undefined, null, { timeout: 90000 }).catch(() => { throw new Error("não renderizou: " + erros.join(" | ")); });
    return { p, erros, fechar: async () => { await p.close(); srv.close(); } };
  }
  const texto = (p) => p.evaluate(() => document.body.innerText);
  const esperar = (p, re, ms) => p.waitForFunction((s) => new RegExp(s).test(document.body.innerText), re.source, { timeout: ms || 20000 });

  /* ── dono: importar, dar acesso, vencimento/forma ── */
  {
    const { p, erros, fechar } = await abrir("dono", 1100, "<TelaFinanceiro />");
    assert.strictEqual(await p.evaluate(() => window.__papel), "dono");
    /* novidade do financeiro: só para quem vê o financeiro; a equipe continua na versão dela (a janela não reabre vazia) */
    const nv = await p.evaluate(() => ({ dono: novidadesTYPara(true), equipe: novidadesTYPara(false), versao: NOVIDADES_TY_VERSAO, equipeV: NOVIDADES_TY_VERSAO_EQUIPE }));
    assert(nv.dono.itens[0].so === "financeiro" && nv.dono.itens[0].novo && nv.dono.versao === nv.versao);
    assert(!nv.equipe.itens.some((x) => x.so) && (nv.equipe.itens.some((x) => x.novo) ? nv.equipe.versao === nv.versao : nv.equipe.versao === nv.equipeV));
    await esperar(p, /Entradas/);
    assert(await p.locator("[data-painel] [data-destaque-resultado]").count() === 1, "painel do mês com o resultado em destaque");
    if (capturas) { fs.mkdirSync(capturas, { recursive: true }); await p.waitForTimeout(400); await p.screenshot({ path: path.join(capturas, "financeiro-painel.png"), fullPage: true }); }
    await p.click('button:text-is("Importar planilha")');
    const antes = banco["orgs/team-yoda/dados/mty:alunos:v2"].value;
    await p.setInputFiles('input[type="file"]', { name: "Migracao-Team-Yoda.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: planilhaTeste() });
    await esperar(p, /Simulação — nada foi gravado/, 30000);
    let t = await texto(p);
    assert(/Linhas lidas: 1 alunos · 1 turmas · 1 cobrança · 1 em aberto/.test(t), "a linha de exemplo não entra: " + t.slice(0, 400));
    assert(/Alunos novos\s+1\s+0/.test(t) && /Turmas novas\s+1/.test(t), "relatório por academia");
    assert(/Previsto por mês[^\n]*R\$\s*520,00/.test(t), "previsto da cobrança importada");
    assert.strictEqual(banco["orgs/team-yoda/dados/mty:alunos:v2"].value, antes, "simular não grava");
    if (capturas) { fs.mkdirSync(capturas, { recursive: true }); await p.screenshot({ path: path.join(capturas, "financeiro-importar.png"), fullPage: true }); }
    await p.click('button:text-is("Confirmar e gravar no app")');
    await esperar(p, /Importação gravada/, 30000);
    const teste = lista("mty:alunos:v2").find((a) => a.nome === "Teste Silva");
    assert(teste && teste.nascimento === "2012-03-12" && teste.telefoneResponsavel === "(11) 91234-5678", "aluno gravado com a data da planilha");
    const jt = lista("mty:turmas:v1").find((x) => x.nome === "Juvenil Teste");
    assert(jt && jt.membros.includes(teste.id) && jt.professorUid === "p1", "turma criada com o aluno e o professor");
    assert.deepStrictEqual(cfg().cobranca[teste.id], { venc: 10, forma: "pix", pagador: "Rita Silva" });
    assert.strictEqual(cfg().pendencias.length, 1); assert.strictEqual(cfg().turmas.t1.preco, 400, "preço que já existia continua");
    if (capturas) {
      await p.click('button:text-is("Team Yoda")'); await esperar(p, /Mês a mês/); await p.waitForTimeout(400);
      await p.screenshot({ path: path.join(capturas, "financeiro-painel-dados.png"), fullPage: true });
      await p.click('button:text-is("Visão geral")'); await esperar(p, /Cada academia no mês/); await p.waitForTimeout(400);
      await p.screenshot({ path: path.join(capturas, "financeiro-geral.png"), fullPage: true });
    }

    /* acesso administrativo */
    await p.click('button:text-is("Acesso administrativo")');
    await esperar(p, /Ninguém cadastrado/);
    await p.fill('input[placeholder="e-mail da pessoa"]', "Adm@x.com");
    await p.click('button:text-is("Dar acesso")');
    await esperar(p, /Salvo\./);
    assert.deepStrictEqual(banco["financeiro/_acesso"].admins, ["adm@x.com"]);

    /* recebido e pago: vencimento/forma vindos da importação; muda a forma da Ana; pendência antiga aparece */
    await p.click('button:text-is("Team Yoda")'); await p.click('button:text-is("Recebido e pago")');
    await esperar(p, /Meses anteriores em aberto/);
    const linhaT = p.locator("div", { has: p.locator("label", { hasText: "Teste Silva · Juvenil Teste" }) }).last();
    assert.strictEqual(await linhaT.locator('input[type="number"]').inputValue(), "10");
    assert.strictEqual(await linhaT.locator("select").inputValue(), "pix");
    const linhaA = p.locator("div", { has: p.locator("label", { hasText: "Ana Souza" }) }).last();
    await linhaA.locator("select").selectOption("boleto");
    await p.click('button:text-is("Salvar Team Yoda")');
    await esperar(p, /Salvo\./);
    assert.strictEqual(cfg().cobranca.a1.forma, "boleto"); assert.strictEqual(cfg().cobranca[teste.id].forma, "pix", "a outra cobrança continua");
    t = await texto(p); assert(/Teste Silva · outubro de 2026/.test(t), "pendência de outubro listada");
    if (capturas) await p.screenshot({ path: path.join(capturas, "financeiro-recebido.png"), fullPage: true });
    assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
    await fechar();
    console.log("  dono: planilha simulada e gravada, acesso dado, vencimento/forma e pendência em Recebido e pago");
  }

  /* ── dono no celular: painel em blocos, sem rolagem lateral ── */
  {
    const { p, erros, fechar } = await abrir("dono", 390, "<TelaFinanceiro />");
    await esperar(p, /Mês a mês/);
    assert(await p.locator("[data-painel] [data-destaque-resultado]").count() === 1);
    const largura = await p.evaluate(() => document.documentElement.scrollWidth);
    assert(largura <= 392, "celular: sem rolagem lateral no painel (" + largura + " px)");
    if (capturas) { await p.waitForTimeout(400); await p.screenshot({ path: path.join(capturas, "financeiro-390.png"), fullPage: true }); }
    assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
    await fechar();
    console.log("  dono no celular 390 px: painel sem rolagem lateral");
  }

  /* ── administrativo: tela Cobrança ── */
  for (const larg of [1100, 390]) {
    const { p, erros, fechar } = await abrir("adm", larg, "<TelaCobranca />");
    assert.strictEqual(await p.evaluate(() => window.__papel), "admin");
    await esperar(p, /A receber/);
    let t = await texto(p);
    assert(!/Resultado|margem|Despesas fixas|Impostos/i.test(t), "administrativo não vê resultado, margem, despesas nem impostos");
    assert(/Teste Silva/.test(t) && /Leo Martins/.test(t) && (larg === 390 || /Ana Souza/.test(t)), "cobrança e professor aparecem");
    if (larg === 390) {
      const largura = await p.evaluate(() => document.documentElement.scrollWidth);
      assert(largura <= 392, "celular: sem rolagem lateral (" + largura + " px)");
      if (capturas) await p.screenshot({ path: path.join(capturas, "cobranca-390.png"), fullPage: true });
      assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
      await fechar(); console.log("  administrativo no celular 390 px: sem rolagem lateral"); continue;
    }
    assert(/WhatsApp \(11\) 91234-5678/.test(t), "contato do responsável com link");
    /* marca a Ana como recebida: sai da lista "Em aberto" */
    await p.locator('[data-linha-cobranca="m:t1:a1"] input[type="checkbox"]').click();
    await p.waitForFunction(() => !document.querySelector('[data-linha-cobranca="m:t1:a1"]'), null, { timeout: 15000 });
    assert.strictEqual(cfg().meses["2026-11"].recebidos["m:t1:a1"], true);
    /* muda a forma do Teste para dinheiro */
    const teste = lista("mty:alunos:v2").find((a) => a.nome === "Teste Silva"), jt = lista("mty:turmas:v1").find((x) => x.nome === "Juvenil Teste");
    await p.locator(`[data-linha-cobranca="m:${jt.id}:${teste.id}"] select`).selectOption("dinheiro");
    await p.waitForFunction((s) => document.querySelector(s) && document.querySelector(s).value === "dinheiro", `[data-linha-cobranca="m:${jt.id}:${teste.id}"] select`, { timeout: 15000 });
    assert.strictEqual(cfg().cobranca[teste.id].forma, "dinheiro"); assert.strictEqual(cfg().cobranca[teste.id].venc, 10, "vencimento continua");
    /* quita a pendência de outubro */
    await p.click('button:text-is("Pago")');
    await p.waitForFunction(() => !/Meses anteriores em aberto/.test(document.body.innerText), null, { timeout: 15000 });
    assert.strictEqual(cfg().pendencias[0].quitada, true);
    /* paga o professor */
    await p.locator("label", { hasText: "Leo Martins" }).locator("input").click();
    for (let k = 0; k < 60 && !((cfg().meses["2026-11"].pagos || {})["prof:u:p1"]); k++) await p.waitForTimeout(250);
    await p.waitForTimeout(500);
    assert.strictEqual(cfg().meses["2026-11"].pagos["prof:u:p1"], true);
    /* tudo que o administrativo mandou foi "marcar" */
    assert(posts.filter((x) => x.acao === "marcar").length >= 4 && posts.slice(-4).every((x) => x.acao === "marcar"));
    if (capturas) await p.screenshot({ path: path.join(capturas, "cobranca.png"), fullPage: true });
    assert.deepStrictEqual(erros, [], "erros de JS: " + erros.join(" | "));
    await fechar();
    console.log("  administrativo: recebido, forma, pendência quitada e professor pago");
  }

  /* ── coordenador: sem papel ── */
  {
    const { p, fechar } = await abrir("coord", 1100, "<TelaCobranca />");
    assert.strictEqual(await p.evaluate(() => window.__papel), null);
    await esperar(p, /só do dono/);
    await fechar();
    console.log("  coordenador: sem papel no financeiro, servidor recusa");
  }
  await b.close();
  console.log("check-financeiro-cobranca-tela: ok");
})().catch((e) => { console.error(e.message || e); process.exit(1); });
