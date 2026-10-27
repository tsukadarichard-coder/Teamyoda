/* Manual ao lado do trabalho (app Team Yoda, mty/): a ficha, os exercícios, o plano e a sessão apontam para o conceito do Manual;
   o conceito abre num painel por cima da tela e "Voltar" (botão, Voltar do navegador/celular ou Esc) devolve o treinador
   exatamente onde estava — mesma rolagem e o preenchimento pela metade intacto. Toda referência usada pelas telas
   existe de verdade no Manual (âncora encontrada no painel).
   Roda o código real do app em React/Babel locais (defina CDN_DIR). Rode: node tests/check-manual-links.js [pasta-das-capturas] */
const fs=require("fs"),path=require("path"),http=require("http");const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const assert=require("assert");
const CDN=process.env.CDN_DIR||"/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if(!fs.existsSync(CDN)){console.log("check-manual-links: pulado (sem React/Babel locais; defina CDN_DIR)");process.exit(0);}
const raiz=path.join(__dirname,"..","..","mty");const capturas=process.argv[2]||"";
const html=fs.readFileSync(path.join(raiz,"index.html"),"utf8");
const ms=[...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join("\n");
const corte=ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const corpo=`async function listaProfessores(){return [{uid:"p1",nome:"Carlos"}];}
async function organizacao(){return "demo";} var db=null, auth=null;
`+ms.slice(0,corte)+`
window.mtyAuth={entrar:async()=>{},usuario:()=>null};
function Teste(){
  const { ctx, pilha, voltar } = usePainelManual(true);
  window.__abrir = ctx.abrir;
  window.__pilha = pilha.length;
  const aluno = React.useMemo(() => ({ ...novoAluno(), id: "a1" }), []);
  const plano = { titulo: "Plano", blocos: [] };
  return (
    <ManualCtx.Provider value={ctx}>
      <TelaFicha aluno={aluno} salvar={async () => {}} papelAtual="coordenador" uidAtual="p0" quadras={[]} />
      <h2 id="exercicios">Exercícios</h2>
      {["IP001", "TR001", "FB001", "BR001", "MV001"].map((c) => { const e = TODOS_EXERCICIOS().find((x) => x.c === c); return e ? <CartaoExercicio key={c} e={e} /> : null; })}
      <CardAulaChecklist id="x1" indice={1} titulo="Trilho fechado do P1" descricao="Saque aberto e reduzir o tempo do adversário (T-05)" status={() => null} defineStatus={() => {}} reg={{}} campo={() => {}} chuvaAberta={null} setChuvaAberta={() => {}} podeEditar={true} papelAtual="coordenador" />
    </ManualCtx.Provider>
  );
}
function Comparacao(){ return <div id="painel"><PainelManualHost /></div>; }
function PainelManualHost(){ return null; }
function Raiz(){
  const { ctx, pilha, voltar } = usePainelManual(true);
  window.__abrir = ctx.abrir;
  const aluno = React.useMemo(() => ({ ...novoAluno(), id: "a1" }), []);
  return (
    <ManualCtx.Provider value={ctx}>
      <div style={{ minHeight: 2600 }}>
        <TelaFicha aluno={aluno} salvar={async () => {}} papelAtual="coordenador" uidAtual="p0" quadras={[]} />
        <h2 id="exercicios">Exercícios</h2>
        {["IP001", "TR001", "FB001", "BR001", "MV001"].map((c) => { const e = TODOS_EXERCICIOS().find((x) => x.c === c); return e ? <CartaoExercicio key={c} e={e} /> : null; })}
        <CardAulaChecklist id="x1" indice={1} titulo="Trilho fechado do P1" descricao="Saque aberto e reduzir o tempo do adversário (T-05)" status={() => null} defineStatus={() => {}} reg={{}} campo={() => {}} chuvaAberta={null} setChuvaAberta={() => {}} podeEditar={true} papelAtual="coordenador" />
      </div>
      <PainelManual pilha={pilha} aoVoltar={voltar} exerciciosCustom={[]} setExerciciosCustom={() => {}} />
    </ManualCtx.Provider>
  );
}
/* toda referência que as telas podem usar */
window.__refs = () => {
  const lista = [...Object.values(REF_MANUAL), ...Object.keys(FAM).map(refFamilia), ...GOLPES_ENTRADA.map(refGolpe)];
  TODOS_EXERCICIOS().forEach((e) => refsExercicio(e).forEach((r) => lista.push(r)));
  ["P1 P2 P16 T-02 M-01 P-05 C-03 D-05 I-07 trilho início do ponto lúdico placar regeneração reavaliação"].forEach((t) => refsNoTexto(t).forEach((r) => lista.push(r)));
  ["V", "L", "G", "A", "C"].forEach((s) => lista.push(refTrilha(s)));
  const vistos = {};
  return lista.filter(Boolean).filter((r) => { const k = r.aba + "|" + r.id; if (vistos[k]) return false; vistos[k] = 1; return true; });
};
ReactDOM.createRoot(document.getElementById("root")).render(<Raiz />);`;
const pagina=`<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><script src="https://cdn.tailwindcss.com"></script><div id=root style="padding:16px"></div><script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script>
<script src=/sync-listas.js></script><script src=/scout/graficos.js></script><script src=/scout/ao-vivo.js></script><script src=/scout/relatorio-jogos.js></script><script src=/scout/movimento-motor.js></script><script src=/scout/evidencias.js></script><script src=/scout/movimento.js></script><script src=/scout/video-segmentador.js></script><script src=/scout/video-audio.js></script><script src=/scout/video-scout.js></script><script src=/scout/video-visao.js></script><script src=/scout/video-scout-ui.js></script><script src=/scout/quadra-auto.js></script><script src=/scout/padroes.js></script><script src=/scout/video-jogo.js></script>
<script type="text/babel">${corpo}</script>`;
const m={"/r.js":CDN+"/react-18.3.1/package/umd/react.development.js","/d.js":CDN+"/react-dom-18.3.1/package/umd/react-dom.development.js","/p.js":CDN+"/prop-types-15.8.1/package/prop-types.min.js","/c.js":CDN+"/recharts-2.15.4/package/umd/Recharts.js","/b.js":CDN+"/babel-standalone-7.29.9/package/babel.min.js"};
const srv=http.createServer((q,r)=>{const u=q.url.split("?")[0];if(u==="/"){r.writeHead(200,{"content-type":"text/html; charset=utf-8"});return r.end(pagina)}if(m[u]){r.writeHead(200,{"content-type":"text/javascript"});return r.end(fs.readFileSync(m[u]))}const f=path.join(raiz,decodeURIComponent(u));if(f.startsWith(raiz)&&fs.existsSync(f)&&fs.statSync(f).isFile()){r.writeHead(200,{"content-type":"text/javascript"});return r.end(fs.readFileSync(f))}r.writeHead(404);r.end()}).listen(0);
(async()=>{const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args:["--no-sandbox"]}),p=await b.newPage({viewport:{width:390,height:844}});
await p.route(/tailwindcss/,r=>r.fulfill({status:200,contentType:"text/javascript",body:""}));
const erros=[];p.on("pageerror",e=>erros.push(e.message));p.on("console",x=>{if(x.type()==="error"&&!/Failed to load|BABEL|unique "key"/.test(x.text()))erros.push("c:"+x.text().slice(0,200))});
await p.goto("http://localhost:"+srv.address().port+"/");await p.waitForSelector(".mty-link-manual",{timeout:120000}).catch(e=>{throw new Error("não abriu: "+erros.join(" | ").slice(0,1500))});await p.waitForTimeout(500);
const cap=async(n)=>{if(capturas){fs.mkdirSync(capturas,{recursive:true});await p.screenshot({path:path.join(capturas,n+".png")});}};
const painelAberto=()=>p.evaluate(()=>!!document.querySelector(".mty-painel-manual"));

/* 1. preenche a ficha pela metade, rola, abre o Manual e volta: nada se perde */
const nome=p.locator("input").first();await nome.fill("Ana em preenchimento");
await p.evaluate(()=>window.scrollTo(0,120));const rolagem=await p.evaluate(()=>window.scrollY);
await cap("manual-01-ficha");
await p.click('.mty-link-manual[data-manual="metodo:principio-1"]');await p.waitForSelector(".mty-painel-manual");await p.waitForTimeout(400);
let t=await p.evaluate(()=>document.querySelector(".mty-painel-manual").innerText);
if(process.env.MOSTRA)console.log(t.slice(0,600));
assert(/Manual MTY · Como decide/i.test(t)&&/A ficha é a F-01/.test(t)&&/Voltar/.test(t),"painel com o conceito");
assert(await p.evaluate(()=>document.querySelector(".mty-painel-manual .mty-foco-manual")?.id)==="principio-1","conceito destacado");
await cap("manual-02-painel");
await p.click(".mty-manual-voltar");await p.waitForTimeout(300);
assert(!(await painelAberto()),"Voltar fecha o painel");
assert.strictEqual(await nome.inputValue(),"Ana em preenchimento","o preenchimento continua");
assert.strictEqual(await p.evaluate(()=>window.scrollY),rolagem,"a rolagem continua");
const url=p.url();

/* 2. Voltar do navegador (celular) e Esc também fecham, sem sair da página */
await p.click('.mty-link-manual[data-manual="metodo:principio-1"]');await p.waitForSelector(".mty-painel-manual");
await p.goBack();await p.waitForTimeout(300);
assert(!(await painelAberto())&&p.url()===url&&(await nome.inputValue())==="Ana em preenchimento","Voltar do navegador fecha o painel e fica no app");
await p.click('.mty-link-manual[data-manual="metodo:principio-1"]');await p.waitForSelector(".mty-painel-manual");
await p.keyboard.press("Escape");await p.waitForTimeout(300);
assert(!(await painelAberto()),"Esc fecha");

/* 3. exercício: o chip leva ao conceito; trilho leva ao princípio do trilho; aula do plano lê os códigos do texto */
await p.click('.mty-link-manual:has-text("Conceito no Manual") >> nth=0');await p.waitForSelector(".mty-painel-manual");await p.waitForTimeout(400);
t=await p.evaluate(()=>document.querySelector(".mty-painel-manual").innerText);
assert(/IP · Início do ponto/.test(t)&&/Quando usar:/.test(t)&&/exercícios/.test(t),"família do exercício com foco e quando usar");
await cap("manual-03-familia");
await p.click(".mty-manual-voltar");await p.waitForTimeout(300);
const aula=await p.evaluate(()=>[...document.querySelectorAll(".mty-link-manual")].map(b=>b.getAttribute("data-manual")));
for(const k of ["taticas:padrao-P1","tecnica:T-05","metodo:principio-11","aulas:reducao-tempo"])assert(aula.includes(k),"link presente: "+k+" em "+aula.join(","));
await p.click('.mty-link-manual[data-manual="taticas:padrao-P1"]');await p.waitForSelector(".mty-painel-manual");await p.waitForTimeout(400);
t=await p.evaluate(()=>document.querySelector(".mty-painel-manual").innerText);
assert(/Sequência:/.test(t)&&/Saque aberto/.test(t),"o padrão P1 abre já expandido");
await p.click(".mty-manual-voltar");await p.waitForTimeout(300);

/* 4. todas as referências possíveis existem no Manual */
const refs=await p.evaluate(()=>window.__refs());
const faltam=[];
for(const r of refs){
  await p.evaluate((r)=>window.__abrir(r),r);await p.waitForTimeout(160);
  const ok=await p.evaluate((id)=>!!document.querySelector('.mty-painel-manual [id="'+id+'"]'),r.id);
  if(!ok)faltam.push(r.aba+":"+r.id);
  await p.evaluate(()=>document.querySelector(".mty-manual-voltar").click());await p.waitForTimeout(120);
}
assert.deepStrictEqual(faltam,[],"referências sem âncora no Manual");
assert(!(await painelAberto()),"pilha esvaziada");
assert.deepStrictEqual(erros,[],"erros de JS: "+erros.join(" | "));
console.log("check-manual-links: ok ("+refs.length+" referências)");
await b.close();srv.close();})().catch(e=>{console.error(e);process.exit(1)});
