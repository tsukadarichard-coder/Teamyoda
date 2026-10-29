/* Gerar planejamento com IA: sessão vencida (401) renova e tenta de novo; 401 persistente e 403 mostram mensagem clara. Roda a TelaPlano real (defina CDN_DIR).
   Rode: node tests/smoke-gerar-ia-sessao.js [mty|autonomo] */
const fs=require("fs"),path=require("path"),http=require("http"),assert=require("assert");const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const CDN=process.env.CDN_DIR||"/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if(!fs.existsSync(CDN)){console.log("smoke-gerar-ia-sessao: pulado (sem React/Babel locais; defina CDN_DIR)");process.exit(0);}
const app=process.argv[2]||"mty";const raiz=path.join(__dirname,"..",app==="mty"?"../mty":".");
const html=fs.readFileSync(path.join(raiz,"index.html"),"utf8");
const ms=[...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join("\n");
const planos=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(t=>/let db = null, auth = null/.test(t)).join("\n");
const corte=ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const corpo=ms.slice(0,corte)+`
function HostPlano(){const b=novoAluno();const [alunos,setAlunos]=useState([{...b,id:"a1",nome:"Ana Souza",nascimento:"2014-03-02",estagio:"L",nivel:"Y5",cadastroConcluido:true,lateralidade:"destro",backhand:"duas",contexto:"clube",tempoTreinando:"2 anos"}]);window.__alunos=alunos;
 return <div style={{padding:12,maxWidth:560}}><TelaPlano aluno={alunos[0]} alunos={alunos} setAlunos={setAlunos} modo="resumo" papelAtual="coordenador" uidAtual="u1" identidade={{nome:"Team Yoda"}} setSubaba={()=>{}} aoAcessarFicha={()=>{}} exerciciosCustom={[]} setExerciciosCustom={()=>{}} ocorrencias={[]} /></div>;}
ReactDOM.createRoot(document.getElementById("root")).render(<HostPlano />);`;
const fb=`(function(){var docs={};function ref(p){return{id:p.split("/").pop(),get:async()=>({exists:docs[p]!==undefined,id:p.split("/").pop(),data:()=>docs[p]}),set:async(v,o)=>{docs[p]=Object.assign({},o&&o.merge?docs[p]:{},v)},update:async v=>{docs[p]=Object.assign({},docs[p],v)},delete:async()=>{delete docs[p]},onSnapshot:function(cb){setTimeout(()=>cb({exists:docs[p]!==undefined,data:()=>docs[p]}),0);return()=>{}},collection:c=>col(p+"/"+c)}}
function col(p){return{doc:i=>ref(p+"/"+i),get:async()=>({docs:[],empty:true,size:0,forEach(){}}),where:()=>col(p),orderBy:()=>col(p),limit:()=>col(p),onSnapshot:function(cb){setTimeout(()=>cb({docs:[],forEach(){}}),0);return()=>{}},add:async v=>ref(p+"/n")}}
var u={uid:"u1",email:"coord@teamyoda.com",displayName:"Coord",getIdToken:async()=>"tok",getIdTokenResult:async()=>({claims:{orgId:"team-yoda",role:"coordenador"}})};var cbs=[];
var a={currentUser:u,onAuthStateChanged:function(cb){cbs.push(cb);setTimeout(()=>cb(u),0);return()=>{}},signOut:async()=>{}};
window.__docs=docs;window.firebase={apps:[{}],initializeApp(){},firestore:()=>({collection:col,doc:p=>ref(p),runTransaction:async f=>f({get:async r=>r.get(),set(){},update(){}}),batch:()=>({set(){},update(){},delete(){},commit:async()=>{}})}),auth:()=>a};window.firebase.firestore.FieldValue={increment:n=>n,serverTimestamp:()=>"t",delete:()=>null,arrayUnion:(...x)=>x};window.firebase.auth.Auth={Persistence:{LOCAL:"local"}};})();`;
const pagina=`<!doctype html><meta charset=utf-8><div id=root></div><script>${fb}</script><script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script><script src=/aulas-mes.js></script><script src=/mty-nuvem.js></script>
<script>${planos}</script><script src=/scout/graficos.js></script><script src=/scout/ao-vivo.js></script><script src=/scout/relatorio-jogos.js></script><script src=/scout/movimento-motor.js></script><script src=/scout/movimento.js></script><script src=/scout/video-segmentador.js></script><script src=/scout/video-jogo.js></script>
<script type="text/babel">${corpo}</script>`;
const m={"/aulas-mes.js":require("path").join(__dirname,"../../mty/aulas-mes.js"),"/r.js":CDN+"/react-18.3.1/package/umd/react.development.js","/d.js":CDN+"/react-dom-18.3.1/package/umd/react-dom.development.js","/p.js":CDN+"/prop-types-15.8.1/package/prop-types.min.js","/c.js":CDN+"/recharts-2.15.4/package/umd/Recharts.js","/b.js":CDN+"/babel-standalone-7.29.9/package/babel.min.js"};
const srv=http.createServer((q,r)=>{const u=q.url.split("?")[0];if(u==="/"){r.writeHead(200,{"content-type":"text/html; charset=utf-8"});return r.end(pagina)}if(m[u]){r.writeHead(200,{"content-type":"text/javascript"});return r.end(fs.readFileSync(m[u]))}const f=path.join(raiz,decodeURIComponent(u));if(f.startsWith(raiz)&&fs.existsSync(f)&&fs.statSync(f).isFile()){r.writeHead(200,{"content-type":f.endsWith(".css")?"text/css":"text/javascript"});return r.end(fs.readFileSync(f))}r.writeHead(404);r.end()}).listen(0);
(async()=>{const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args:["--no-sandbox"]});
const casos=[["ok",1,/Gerando em segundo plano|Montando o plano/,0],["401-depois-ok",2,/Gerando em segundo plano|Montando o plano/,0],["401-sempre",2,/Sua sessão expirou/,0],["403",1,/ainda não está ligada a uma academia/,0]];
for(const [modo,esperados,texto] of casos.map(c=>c)){const n0=esperados;
 const p=await b.newPage({viewport:{width:480,height:900}});const erros=[];let n=0;p.on("pageerror",e=>erros.push(e.message));
 await p.route("**/.netlify/functions/gerar-ia-background",async r=>{n++;
  if(modo==="401-depois-ok"&&n===1)return r.fulfill({status:401,body:"Login inválido ou expirado."});
  if(modo==="401-sempre")return r.fulfill({status:401,body:"Login inválido ou expirado."});
  if(modo==="403")return r.fulfill({status:403,body:"Esta conta ainda não está ligada a uma academia."});
  await r.fulfill({status:202,body:""})});
 await p.goto("http://localhost:"+srv.address().port+"/");
 await p.waitForFunction(()=>document.body.innerText.length>50,null,{timeout:120000});
 await p.getByText("Gerar pela ficha").first().click();await p.waitForTimeout(500);
 await p.getByRole("button",{name:/Gerar planejamento/}).first().click();await p.waitForTimeout(2500);
 const t=await p.evaluate(()=>document.body.innerText);
 assert(texto.test(t),app+" ["+modo+"]: mensagem esperada "+texto+" · tela: "+t.slice(-200).replace(/\n+/g," | "));
 assert.strictEqual(n,n0,app+" ["+modo+"]: pedidos ao servidor");
 assert.deepStrictEqual(erros,[],app+" ["+modo+"]: erros de JS "+erros.join(" | "));await p.close();}
console.log("smoke-gerar-ia-sessao "+app+": ok");await b.close();srv.close()})().catch(e=>{console.error(e.message||e);process.exit(1)});
