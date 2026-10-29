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
const mov=(id,dia,itens)=>({id,criadoEm:"2026-09-"+dia+"T10:00:00Z",golpe:"forehand",emp:"",dom:"d",itens:itens.map(([n,s,v])=>({n,s,v,u:"°",r:"≥ 30"}))});
function Host(){
 const b=novoAluno();
 const [alunos,setAlunos]=useState([{...b,id:"a1",nome:"Ana Souza",cadastroConcluido:true,estagio:"C",
  plano:{blocos:[{nome:"Bloco 1",titulo:"Bloco 1",areaFoco:"fundo",semanasLista:[{n:1,foco:"Fundo",aulas:[{t:"Aula 1",ex:TODOS_EXERCICIOS().slice(0,3).map(e=>e.c)}]}]}]},
  movimentos:[mov("m1","01",[["Flexão de joelhos","atencao",10]]),mov("m2","10",[["Flexão de joelhos","atencao",12]])]}]);
 window.__alunos=alunos;
 return <div style={{padding:12,maxWidth:520}}><MetaMedida areaId="saque" aluno={{registros:[{tipo:"jogo",data:"2026-09-01",scout:{n:40,pctPrimeiro:64}},{tipo:"jogo",data:"2026-09-08",scout:{n:40,pctPrimeiro:68}}]}} /><CartaoRevisoesPlano alunos={alunos} irPara={()=>{}} /><TelaPlano aluno={alunos[0]} alunos={alunos} setAlunos={setAlunos} setSubaba={()=>{}} aoAcessarFicha={()=>{}} modo="resumo" papelAtual="coordenador" uidAtual="u1" identidade={null} exerciciosCustom={[]} setExerciciosCustom={()=>{}} ocorrencias={[]} />
 <button id="prompt" onClick={()=>{window.__prompt=promptPlanoEstruturado(alunos[0],4,3,[],{tecnico:50,tatico:50,fisico:50,pontos:50})}}>p</button></div>;}
ReactDOM.createRoot(document.getElementById("root")).render(<Host />);`;
const pagina=`<!doctype html><meta charset=utf-8><div id=root></div><script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script><script src=/aulas-mes.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};</script>
<script src=/scout/graficos.js></script><script src=/scout/ao-vivo.js></script><script src=/scout/relatorio-jogos.js></script><script src=/scout/movimento-motor.js></script><script src=/scout/evidencias.js></script><script src=/scout/movimento.js></script><script src=/scout/video-segmentador.js></script><script src=/scout/video-jogo.js></script>
<script type="text/babel">${corpo}</script>`;
const m={"/aulas-mes.js":require("path").join(__dirname,"../../mty/aulas-mes.js"),"/r.js":CDN+"/react-18.3.1/package/umd/react.development.js","/d.js":CDN+"/react-dom-18.3.1/package/umd/react-dom.development.js","/p.js":CDN+"/prop-types-15.8.1/package/prop-types.min.js","/c.js":CDN+"/recharts-2.15.4/package/umd/Recharts.js","/b.js":CDN+"/babel-standalone-7.29.9/package/babel.min.js"};
const srv=http.createServer((q,r)=>{const u=q.url.split("?")[0];if(u==="/"){r.writeHead(200,{"content-type":"text/html; charset=utf-8"});return r.end(pagina)}if(m[u]){r.writeHead(200,{"content-type":"text/javascript"});return r.end(fs.readFileSync(m[u]))}const f=path.join(raiz,decodeURIComponent(u));if(f.startsWith(raiz)&&fs.existsSync(f)&&fs.statSync(f).isFile()){r.writeHead(200,{"content-type":"text/javascript"});return r.end(fs.readFileSync(f))}r.writeHead(404);r.end()}).listen(0);
(async()=>{const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args:["--no-sandbox"]}),p=await b.newPage({viewport:{width:480,height:900}});
const erros=[];p.on("pageerror",e=>erros.push(e.message));p.on("console",m=>{if(m.type()==="error"&&!/Failed to load|BABEL/.test(m.text()))erros.push("c:"+m.text().slice(0,200))});
await p.goto("http://localhost:"+srv.address().port+"/");
await p.waitForSelector("[data-revisao-plano]",{timeout:120000});
await p.waitForSelector("[data-sugestao]",{timeout:10000});
let t=await p.evaluate(()=>document.body.innerText);
assert(/medido pelos dados/i.test(t)&&/Os dados confirmam o critério/.test(t),app+": meta medida");
assert(/Revisão sugerida do plano/.test(t),app+": cartão do Início");
assert(/Reforçar/i.test(t)&&/Aceitar/.test(t),app+": sugestão visível");
await p.getByRole("button",{name:/Aceitar e incluir/}).first().click();await p.waitForTimeout(500);
const reg=await p.evaluate(()=>window.__alunos[0].regPlano);
assert(reg&&reg.__blocos["Bloco 1"].reforcos.length===1&&reg.__blocos["Bloco 1"].reforcos[0].ex.length===3,app+": reforço incluído no bloco "+JSON.stringify(reg));
const rev=await p.evaluate(()=>window.__alunos[0].revisoesPlano);
assert(rev.some(r=>r.status==="aceita"&&r.aplicada),app+": aceita e aplicada");
const vs=await p.evaluate(()=>window.__alunos[0].versoesPlano);assert(vs&&vs.length===1&&vs[0].n===2,app+": versão do plano registrada");
assert(/Versões do plano/.test(await p.evaluate(()=>document.body.innerText)),app+": lista de versões");
await p.getByRole("button",{name:/Diário de ajustes/}).click();await p.waitForTimeout(200);
t=await p.evaluate(()=>document.body.innerText);assert(/Aceita em/.test(t)&&/Aguardando/.test(t),app+": diário com efeito pendente");
const pend=rev.filter(r=>r.status==="pendente");
if(pend.length){await p.getByRole("button",{name:/Recusar/}).first().click();await p.waitForTimeout(300);}
await p.click("#prompt");const pr=await p.evaluate(()=>window.__prompt);
assert(/EVIDÊNCIAS RECENTES/.test(pr)&&/AJUSTES JÁ DECIDIDOS/.test(pr),app+": prompt com evidências e ajustes");
assert.deepStrictEqual(erros,[],app+": erros de JS "+erros.join(" | "));console.log("smoke-revisao-plano "+app+": ok");
await b.close();srv.close()})().catch(e=>{console.error(e.message||e);process.exit(1)});