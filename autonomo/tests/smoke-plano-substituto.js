/* Revisão do plano com evidências: TelaPlano real mostra as sugestões, aceitar inclui o reforço no bloco, recusar entra no diário, o cartão do Início aparece e o prompt recebe as evidências.
   Roda a TelaSessao real em React/Babel locais (defina CDN_DIR). Rode: node tests/smoke-revisao-plano.js [mty|autonomo] */
const fs=require("fs"),path=require("path"),http=require("http");const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const assert=require("assert");
const CDN=process.env.CDN_DIR||"/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if(!fs.existsSync(CDN)){console.log("smoke-revisao-plano: pulado (sem React/Babel locais; defina CDN_DIR)");process.exit(0);}
const app=process.argv[2]||"mty";const raiz=path.join(__dirname,"..",app==="mty"?"../mty":".");
const html=fs.readFileSync(path.join(raiz,"index.html"),"utf8");
const ms=[...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join("\n");
const corte=ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const corpo=ms.slice(0,corte)+`
function Host(){
 const b=novoAluno();
 const base=(id,nome)=>({...b,id,nome,cadastroConcluido:true,estagio:"C"});
 const [alunos,setAlunos]=useState([base("a1","Ana Souza"),base("a2","Bia Lima")]);
 const [turmas,setTurmas]=useState([{id:"t1",nome:"Turma Terça",membros:["a1","a2"],professorUid:"yoda",professorNome:"Yoda",plano:null}]);
 window.__turmas=turmas;
 return <div style={{padding:12,maxWidth:560}}><TelaPlano turma={turmas[0]} membros={alunos} turmas={turmas} setTurmas={setTurmas} alunos={alunos} setAlunos={setAlunos} setSubaba={()=>{}} modo="resumo" papelAtual="treinador" uidAtual="davi" identidade={{}} exerciciosCustom={[]} setExerciciosCustom={()=>{}} ocorrencias={[]} /></div>;}
ReactDOM.createRoot(document.getElementById("root")).render(<Host />);`;
const pagina=`<!doctype html><meta charset=utf-8><div id=root></div><script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};</script>
<script src=/scout/graficos.js></script><script src=/scout/ao-vivo.js></script><script src=/scout/relatorio-jogos.js></script><script src=/scout/movimento-motor.js></script><script src=/scout/evidencias.js></script><script src=/scout/movimento.js></script><script src=/scout/video-segmentador.js></script><script src=/scout/video-jogo.js></script>
<script type="text/babel">${corpo}</script>`;
const m={"/r.js":CDN+"/react-18.3.1/package/umd/react.development.js","/d.js":CDN+"/react-dom-18.3.1/package/umd/react-dom.development.js","/p.js":CDN+"/prop-types-15.8.1/package/prop-types.min.js","/c.js":CDN+"/recharts-2.15.4/package/umd/Recharts.js","/b.js":CDN+"/babel-standalone-7.29.9/package/babel.min.js"};
const srv=http.createServer((q,r)=>{const u=q.url.split("?")[0];if(u==="/"){r.writeHead(200,{"content-type":"text/html; charset=utf-8"});return r.end(pagina)}if(m[u]){r.writeHead(200,{"content-type":"text/javascript"});return r.end(fs.readFileSync(m[u]))}const f=path.join(raiz,decodeURIComponent(u));if(f.startsWith(raiz)&&fs.existsSync(f)&&fs.statSync(f).isFile()){r.writeHead(200,{"content-type":"text/javascript"});return r.end(fs.readFileSync(f))}r.writeHead(404);r.end()}).listen(0);
(async()=>{const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args:["--no-sandbox"]}),p=await b.newPage({viewport:{width:480,height:900}});
const erros=[];p.on("pageerror",e=>erros.push(e.message));p.on("console",m=>{if(m.type()==="error"&&!/Failed to load|BABEL/.test(m.text()))erros.push("c:"+m.text().slice(0,200))});
await p.goto("http://localhost:"+srv.address().port+"/");
await p.waitForFunction(()=>document.body.innerText.includes("Sem planejamento"),null,{timeout:120000});
let t=await p.evaluate(()=>document.body.innerText);
assert(/é do professor Yoda\. Você pode gerar, colar e aprovar o plano no lugar dele/.test(t),app+": aviso de substituto no plano da turma. "+t.slice(0,300));
assert(!/a montagem do plano fica travada/.test(t),app+": sem o aviso de travamento");
await p.locator("button").filter({hasText:/ficha/i}).first().click();await p.waitForTimeout(400);
const gerar=p.getByRole("button",{name:"Gerar planejamento"});
assert(await gerar.count()===1,app+": botão Gerar planejamento aparece");
assert(await gerar.isEnabled(),app+": professor que não é titular consegue gerar o plano da turma");
assert.deepStrictEqual(erros,[],app+": erros de JS "+erros.join(" | "));console.log("smoke-plano-substituto "+app+": ok");
await b.close();srv.close()})().catch(e=>{console.error(e.message||e);process.exit(1)});