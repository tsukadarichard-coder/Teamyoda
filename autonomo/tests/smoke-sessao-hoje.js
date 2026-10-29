/* "Sessão de hoje": o botão Gerar sessão precisa funcionar para jogador sem histórico, sem prioridades, de qualquer estágio e com plano (a tela quebrava com TypeError).
   Roda a TelaSessao real em React/Babel locais (defina CDN_DIR). Rode: node tests/smoke-sessao-hoje.js [mty|autonomo] */
const fs=require("fs"),path=require("path"),http=require("http");const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const assert=require("assert");
const CDN=process.env.CDN_DIR||"/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if(!fs.existsSync(CDN)){console.log("smoke-sessao-hoje: pulado (sem React/Babel locais; defina CDN_DIR)");process.exit(0);}
const app=process.argv[2]||"mty";const raiz=path.join(__dirname,"..",app==="mty"?"../mty":".");
const html=fs.readFileSync(path.join(raiz,"index.html"),"utf8");
const ms=[...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join("\n");
const corte=ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const est=process.argv[3]||"C", niv=process.argv[4]||"Y5";
const corpo=ms.slice(0,corte)+`
async function listaProfessores(){return [];}
const VARS=[
 {n:"C/Y5 padrão",o:{}},{n:"estagio V",o:{estagio:"V"}},{n:"estagio L",o:{estagio:"L"}},{n:"estagio G",o:{estagio:"G"}},{n:"estagio A",o:{estagio:"A"}},{n:"estagio vazio",o:{estagio:""}},
 {n:"sem historico",o:{historico:undefined}},{n:"prioridades vazias",o:{prioridades:[]}},{n:"prioridades undefined",o:{prioridades:undefined}},{n:"nivel vazio",o:{nivel:""}},{n:"V/Y1",o:{estagio:"V",nivel:"Y1"}},
 {n:"COM PLANO normal",o:()=>({plano:{blocos:[{nome:"Bloco 1",semanasLista:[{n:1,foco:"Saque",aulas:[{t:"Aula 1",ex:TODOS_EXERCICIOS().slice(0,5).map(e=>e.c)}]}]}]}})},
 {n:"COM PLANO ex desconhecido",o:()=>({plano:{blocos:[{nome:"Bloco 1",semanasLista:[{n:1,foco:"Saque",aulas:[{t:"Aula 1",ex:["ZZZ999","QQQ1"]}]}]}]}})},
 {n:"COM PLANO sem ex",o:()=>({plano:{blocos:[{nome:"Bloco 1",semanasLista:[{n:1,foco:"Saque",aulas:[{t:"Aula 1"}]}]}]}})},
 {n:"COM PLANO sem historico",o:()=>({historico:undefined,plano:{blocos:[{nome:"Bloco 1",semanasLista:[{n:1,foco:"Saque",aulas:[{t:"Aula 1",ex:TODOS_EXERCICIOS().slice(0,5).map(e=>e.c)}]}]}]}})}];
function HostSessao(){const [i,setI]=useState(0);window.__setI=setI;const v=VARS[i];const b=novoAluno();const [alunos,setAlunos]=useState([]);
 const aluno={...b,id:"a1",nome:"Ana Souza",cadastroConcluido:true,...(typeof v.o==="function"?v.o():v.o)};
 return <div style={{padding:12,maxWidth:520}} key={i}><p id="var">{v.n}</p><TelaSessao aluno={aluno} alunos={[aluno]} setAlunos={()=>{}} setSubaba={()=>{}} papelAtual="coordenador" uidAtual="u1" exerciciosCustom={[]} setExerciciosCustom={()=>{}} /></div>;}
ReactDOM.createRoot(document.getElementById("root")).render(<HostSessao />);`;
const pagina=`<!doctype html><meta charset=utf-8><div id=root></div><script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script><script src=/aulas-mes.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};</script>
<script src=/scout/graficos.js></script><script src=/scout/ao-vivo.js></script><script src=/scout/relatorio-jogos.js></script><script src=/scout/movimento-motor.js></script><script src=/scout/movimento.js></script><script src=/scout/video-segmentador.js></script><script src=/scout/video-jogo.js></script>
<script type="text/babel">${corpo}</script>`;
const m={"/aulas-mes.js":require("path").join(__dirname,"../../mty/aulas-mes.js"),"/r.js":CDN+"/react-18.3.1/package/umd/react.development.js","/d.js":CDN+"/react-dom-18.3.1/package/umd/react-dom.development.js","/p.js":CDN+"/prop-types-15.8.1/package/prop-types.min.js","/c.js":CDN+"/recharts-2.15.4/package/umd/Recharts.js","/b.js":CDN+"/babel-standalone-7.29.9/package/babel.min.js"};
const srv=http.createServer((q,r)=>{const u=q.url.split("?")[0];if(u==="/"){r.writeHead(200,{"content-type":"text/html; charset=utf-8"});return r.end(pagina)}if(m[u]){r.writeHead(200,{"content-type":"text/javascript"});return r.end(fs.readFileSync(m[u]))}const f=path.join(raiz,decodeURIComponent(u));if(f.startsWith(raiz)&&fs.existsSync(f)&&fs.statSync(f).isFile()){r.writeHead(200,{"content-type":"text/javascript"});return r.end(fs.readFileSync(f))}r.writeHead(404);r.end()}).listen(0);
(async()=>{const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args:["--no-sandbox"]}),p=await b.newPage({viewport:{width:480,height:900}});
const erros=[];p.on("pageerror",e=>erros.push(e.message));p.on("console",m=>{if(m.type()==="error"&&!/Failed to load|BABEL/.test(m.text()))erros.push("c:"+m.text().slice(0,200))});
await p.goto("http://localhost:"+srv.address().port+"/");
await p.waitForFunction(()=>document.body.innerText.length>50,null,{timeout:120000});
const antes=await p.evaluate(()=>document.body.innerText);console.log("TELA:",antes.slice(0,400).replace(/\n+/g," | "));
for(let i=0;i<15;i++){await p.evaluate(k=>window.__setI(k),i);await p.waitForTimeout(500);
 const nome=await p.textContent("#var",{timeout:4000}).catch(()=>null);if(!nome){console.log("variante",i,"QUEBROU a tela:",erros.filter(x=>!x.startsWith("c:The above")).slice(-3).map(x=>x.slice(0,300)));break;}const bt=p.getByRole("button",{name:/Gerar sessão|Pré-visualizar sessão/});
 const e0=erros.length;let res="sem botão";
 if(await bt.count()){await bt.first().click();await p.waitForTimeout(500);const t=await p.evaluate(()=>document.body.innerText);res=/PREVISTOS|Gerar nova versão|CONDUZIR/.test(t)?"OK gerou":"NÃO GEROU";}
 assert.strictEqual(res,"OK gerou",app+": variante \""+nome+"\" → "+res+(erros.length>e0?" · "+erros[erros.length-1].slice(0,160):""));}
assert.deepStrictEqual(erros,[],app+": erros de JS "+erros.join(" | "));console.log("smoke-sessao-hoje "+app+": ok (15 variantes)");
await b.close();srv.close()})().catch(e=>{console.error(e.message||e);process.exit(1)});
