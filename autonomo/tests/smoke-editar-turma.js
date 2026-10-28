/* Editar turma no QuadraLab: o cartão da lista tem "Editar", que abre a turma com a edição aberta; nome, horários e jogadores mudam e ficam salvos.
   Roda a TelaTurmas real em React/Babel locais (defina CDN_DIR). Rode: node tests/smoke-editar-turma.js */
const fs=require("fs"),path=require("path"),http=require("http");const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const assert=require("assert");
const CDN=process.env.CDN_DIR||"/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if(!fs.existsSync(CDN)){console.log("smoke-editar-turma: pulado (sem React/Babel locais; defina CDN_DIR)");process.exit(0);}
const raiz=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(raiz,"index.html"),"utf8");
const ms=[...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join("\n");
const corte=ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const corpo="async function listaProfessores(){return [];}\n"+ms.slice(0,corte)+`
function Host(){
 const b=novoAluno();
 const al=(id,nome)=>({...b,id,nome,cadastroConcluido:true,estagio:"C"});
 const [alunos,setAlunos]=useState([al("a1","Ana Souza"),al("a2","Bia Lima"),al("a3","Caio Reis")]);
 const [turmas,setTurmas]=useState([{id:"t1",nome:"Turma Terça",membros:["a1","a2"],duracaoPadrao:"2h",professorUid:"",horarios:[{dia:2,hora:"17:00"}],agendaExcecoes:{},agendaAvulsos:[]}]);
 window.__turmas=turmas;
 return <div style={{padding:12,maxWidth:520}}><TelaTurmas alunos={alunos} setAlunos={setAlunos} turmas={turmas} setTurmas={setTurmas} papelAtual="coordenador" uidAtual="" exerciciosCustom={[]} setExerciciosCustom={()=>{}} identidade={{}} /></div>;}
ReactDOM.createRoot(document.getElementById("root")).render(<Host />);`;
const pagina=`<!doctype html><meta charset=utf-8><div id=root></div><script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};</script>
<script src=/scout/graficos.js></script><script src=/scout/ao-vivo.js></script><script src=/scout/relatorio-jogos.js></script><script src=/scout/movimento-motor.js></script><script src=/scout/evidencias.js></script><script src=/scout/movimento.js></script><script src=/scout/video-segmentador.js></script><script src=/scout/video-jogo.js></script>
<script type="text/babel">${corpo}</script>`;
const m={"/r.js":CDN+"/react-18.3.1/package/umd/react.development.js","/d.js":CDN+"/react-dom-18.3.1/package/umd/react-dom.development.js","/p.js":CDN+"/prop-types-15.8.1/package/prop-types.min.js","/c.js":CDN+"/recharts-2.15.4/package/umd/Recharts.js","/b.js":CDN+"/babel-standalone-7.29.9/package/babel.min.js"};
const srv=http.createServer((q,r)=>{const u=q.url.split("?")[0];if(u==="/"){r.writeHead(200,{"content-type":"text/html; charset=utf-8"});return r.end(pagina)}if(m[u]){r.writeHead(200,{"content-type":"text/javascript"});return r.end(fs.readFileSync(m[u]))}const f=path.join(raiz,decodeURIComponent(u));if(f.startsWith(raiz)&&fs.existsSync(f)&&fs.statSync(f).isFile()){r.writeHead(200,{"content-type":"text/javascript"});return r.end(fs.readFileSync(f))}r.writeHead(404);r.end()}).listen(0);
(async()=>{const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args:["--no-sandbox"]}),p=await b.newPage({viewport:{width:390,height:900}});
const erros=[];p.on("pageerror",e=>erros.push(e.message));p.on("console",m=>{if(m.type()==="error"&&!/Failed to load|BABEL/.test(m.text()))erros.push("c:"+m.text().slice(0,200))});
p.on("dialog",d=>d.accept());
await p.goto("http://localhost:"+srv.address().port+"/");
await p.waitForSelector("[data-editar-turma]",{timeout:120000});
await p.click("[data-editar-turma]");
await p.getByText("Salvar alterações").waitFor({timeout:5000});
let t=await p.evaluate(()=>document.body.innerText);
assert(/Jogadores da turma \(2\)/.test(t)&&/Adicionar jogador/.test(t),"jogadores já abertos: "+t.slice(0,500));
await p.fill('input[placeholder="ex: Terça 17h"]',"Turma Quinta");
await p.click("text=Salvar alterações");await p.waitForTimeout(300);
assert.strictEqual(await p.evaluate(()=>window.__turmas[0].nome),"Turma Quinta","nome salvo");
await p.getByRole("button",{name:"Caio Reis",exact:true}).click();
await p.getByRole("button",{name:"Adicionar",exact:true}).click();await p.waitForTimeout(300);
assert.deepStrictEqual(await p.evaluate(()=>window.__turmas[0].membros),["a1","a2","a3"],"jogador adicionado");
await p.locator('button[title="Remover da turma"]').first().click();await p.waitForTimeout(300);
assert.deepStrictEqual(await p.evaluate(()=>window.__turmas[0].membros),["a2","a3"],"jogador removido");
/* Abrir a edição de novo e mexer nos horários pelo editor real. */
await p.click("text=Editar turma");await p.getByText("Salvar alterações").waitFor();
t=await p.evaluate(()=>document.body.innerText);
assert(/Dias e horários de treino/.test(t),"editor de horários visível");
/* tira Terça 17:00 e põe Quinta 18:30 */
const ed=p.locator("text=Dias e horários de treino").locator("xpath=ancestor::div[1]/..");
await ed.locator("span:has-text('17:00') button").click();
await ed.getByRole("button",{name:/^Qui/}).click();
await ed.locator('input[type=time]').fill("18:30");
await ed.getByRole("button",{name:"+ Adicionar"}).click();
await p.click("text=Salvar alterações");await p.waitForTimeout(300);
const hs=await p.evaluate(()=>window.__turmas[0].horarios);
assert(hs.length===1&&hs[0].hora==="18:30"&&hs[0].dia!==2,"horários salvos "+JSON.stringify(hs));
await p.click("text=← Turmas");await p.waitForTimeout(300);
t=await p.evaluate(()=>document.body.innerText);
assert(/Turma Quinta/.test(t)&&/2h · 2 jogadores/.test(t)&&/18:30/.test(t),"lista atualizada "+t.slice(0,400));
await p.screenshot({path:process.env.CAP||"/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/editar-turma.png",fullPage:true});
assert.deepStrictEqual(erros,[],"erros de JS "+erros.join(" | "));console.log("smoke-editar-turma: ok");
await b.close();srv.close()})().catch(e=>{console.error(e.message||e);process.exit(1)});
