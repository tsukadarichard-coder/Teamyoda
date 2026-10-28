/* Marcação de aulas em um toque + Relatório do mês (Team Yoda): Realizada/Cancelada com motivo e reposição, chamada rápida,
   desfazer, aula do caderno fora das pendências, aulas previstas pela grade no topo do relatório, alunos e professores.
   Roda as telas reais em React/Babel locais (defina CDN_DIR). Rode: node tests/smoke-aulas-mes.js */
const fs=require("fs"),path=require("path"),http=require("http");const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const assert=require("assert");
const CDN=process.env.CDN_DIR||"/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if(!fs.existsSync(CDN)){console.log("smoke-aulas-mes: pulado (sem React/Babel locais; defina CDN_DIR)");process.exit(0);}
const raiz=path.join(__dirname,"..","..","mty");
const html=fs.readFileSync(path.join(raiz,"index.html"),"utf8");
const ms=[...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join("\n");
const corte=ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const stub=/async function listaProfessores\(/.test(ms)?"":"async function listaProfessores(){return [];}\n";
const corpo=stub+ms.slice(0,corte)+`
const DIA=86400000, iso=(ms)=>new Date(ms).toISOString().slice(0,10), agora=Date.now();
const HOJE=iso(agora), ONTEM=iso(agora-DIA), ANTEONTEM=iso(agora-2*DIA), HA17=iso(agora-17*DIA);
function Host(){
 const b=novoAluno();
 const al=(id,nome,extra)=>({...b,id,nome,cadastroConcluido:true,...extra});
 const [alunos,setAlunos]=useState([
  al("a1","Ana Souza"),al("a2","Bia Lima"),
  al("a3","Caio Reis",{professorUid:"p2",professorNome:"Rui"}),
  al("a"+(agora-20*DIA),"Enzo Prado",{professorUid:"p2",professorNome:"Rui",duracaoPadrao:"1h",horarios:[{dia:new Date(HA17+"T00:00:00").getDay(),hora:"07:00"}]}),
  al("a"+(agora-5*DIA),"Duda Alves",{professorUid:"p2",professorNome:"Rui",duracaoPadrao:"1h",horarios:[{dia:new Date(ANTEONTEM+"T00:00:00").getDay(),hora:"08:00"}]}),
 ].map((a)=>a.id==="a1"?{...a,registros:[{id:"r1",tipo:"sessao",data:ANTEONTEM,turma:"Turma Terça",presenca:"presente",duracao:"1h30"}]}:a));
 const [turmas,setTurmas]=useState([{id:"t1",nome:"Turma Terça",membros:["a1","a2"],professorUid:"p1",professorNome:"Paula",horarios:[]}]);
 const oc=(o)=>novaOcorrencia({origemTipo:"turma",origemId:"t1",horaInicio:"17:00",horaFim:"18:30",professorUid:"p1",professorNome:"Paula",...o});
 const [ocorrencias,setOcorrencias]=useState([
  oc({id:"oc-hoje",data:HOJE}),
  oc({id:"oc-ontem",data:ONTEM,origemTipo:"individual",origemId:"a3",professorUid:"p2",professorNome:"Rui",horaInicio:"09:00",horaFim:"10:00"}),
  oc({id:"oc-caderno",data:ANTEONTEM}),
 ]);
 const [aba,setAba]=useState("hoje");
 window.__estado={alunos,turmas,ocorrencias};window.__setAba=setAba;
 return <div style={{padding:12,maxWidth:560}}>
  {aba==="hoje"?<TelaAulasHoje alunos={alunos} setAlunos={setAlunos} turmas={turmas} setTurmas={setTurmas} quadras={[]} reservas={[]} bloqueiosAula={[]} ocorrencias={ocorrencias} setOcorrencias={setOcorrencias} regrasReposicao={regrasReposicaoPadrao()} uidAtual="p1" papelAtual="coordenador" />
  :<TelaFechamentoMes ocorrencias={ocorrencias} setOcorrencias={setOcorrencias} alunos={alunos} setAlunos={setAlunos} turmas={turmas} regrasReposicao={regrasReposicaoPadrao()} papelAtual="coordenador" uidAtual="p1" identidade={{nome:"Team Yoda"}} irParaReposicoes={()=>{window.__foiReposicoes=1}} irParaAluno={()=>{}} />}
 </div>;}
ReactDOM.createRoot(document.getElementById("root")).render(<Host />);`;
const pagina=`<!doctype html><meta charset=utf-8><div id=root></div><script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script>${process.env.TW?"<script src=/tw.js></script>":""}
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};</script>
<script src=/scout/graficos.js></script><script src=/scout/ao-vivo.js></script><script src=/scout/relatorio-jogos.js></script><script src=/scout/movimento-motor.js></script><script src=/scout/evidencias.js></script><script src=/scout/movimento.js></script><script src=/scout/video-segmentador.js></script><script src=/scout/video-jogo.js></script>
<script src=/plano-equipe.js></script><script src=/equipe-rendimento.js></script><script src=/aulas-mes.js></script>
<script type="text/babel">${corpo}</script>`;
const m={"/r.js":CDN+"/react-18.3.1/package/umd/react.development.js","/d.js":CDN+"/react-dom-18.3.1/package/umd/react-dom.development.js","/p.js":CDN+"/prop-types-15.8.1/package/prop-types.min.js","/c.js":CDN+"/recharts-2.15.4/package/umd/Recharts.js","/b.js":CDN+"/babel-standalone-7.29.9/package/babel.min.js","/tw.js":CDN+"/tw/package/dist/index.global.js"};
const srv=http.createServer((q,r)=>{const u=q.url.split("?")[0];if(u==="/"){r.writeHead(200,{"content-type":"text/html; charset=utf-8"});return r.end(pagina)}if(m[u]){r.writeHead(200,{"content-type":"text/javascript"});return r.end(fs.readFileSync(m[u]))}const f=path.join(raiz,decodeURIComponent(u));if(f.startsWith(raiz)&&fs.existsSync(f)&&fs.statSync(f).isFile()){r.writeHead(200,{"content-type":"text/javascript"});return r.end(fs.readFileSync(f))}r.writeHead(404);r.end()}).listen(0);
const CAP=process.env.CAP_DIR;
(async()=>{const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args:["--no-sandbox"]}),p=await b.newPage({viewport:{width:390,height:900}});
const erros=[];p.on("pageerror",e=>erros.push(e.message));p.on("console",m=>{if(m.type()==="error"&&!/Failed to load|BABEL/.test(m.text()))erros.push("c:"+m.text().slice(0,200))});
p.on("dialog",d=>d.accept());
const est=()=>p.evaluate(()=>window.__estado);const ocDe=async(id)=>(await est()).ocorrencias.find(o=>o.id===id);
await p.goto("http://localhost:"+srv.address().port+"/");
await p.waitForSelector("[data-marcar-aula]",{timeout:120000});
let t=await p.evaluate(()=>document.body.innerText);
assert(/Caio Reis/.test(t),"pendência de ontem aparece");
const semReg=t.split("AULAS SEM REGISTRO")[1]||t.split("Aulas sem registro")[1]||"";
assert(!/Turma Terça/.test(semReg),"a aula registrada no caderno não fica entre as sem registro");
assert(/Duda Alves/.test(semReg)&&(semReg.match(/Duda Alves/g)||[]).length===1,"Duda só tem a aula depois do cadastro: "+semReg);
if(CAP)await p.screenshot({path:CAP+"/hoje-antes.png",fullPage:true});
/* hoje: um toque em Realizada, depois Bia faltou */
await p.locator("[data-marcar-aula]").first().getByText("✓ Realizada").click();await p.waitForTimeout(200);
let o=await ocDe("oc-hoje");assert.strictEqual(o.status,"realizada");assert.deepStrictEqual(o.membrosNaAula,["a1","a2"],"foto da turma");assert.strictEqual(o.duracaoEfetivaMin,90);
await p.locator("[data-chamada-rapida]").getByText("Bia Lima").click();await p.waitForTimeout(200);
o=await ocDe("oc-hoje");assert.strictEqual(o.presencas.a2,"falta","Bia faltou");
/* ontem (Caio): cancelada por chuva com reposição */
await p.locator("[data-marcar-aula]").first().getByText("✕ Cancelada").click();
await p.locator("[data-cancelar-aula]").getByText("Chuva",{exact:true}).click();
assert(await p.locator("[data-cancelar-aula] input[type=checkbox]").isChecked(),"chuva sugere reposição");
if(CAP)await p.screenshot({path:CAP+"/hoje-cancelar.png",fullPage:true});
await p.locator("[data-cancelar-aula]").getByText("Confirmar").click();await p.waitForTimeout(200);
o=await ocDe("oc-ontem");assert.strictEqual(o.status,"cancelada");assert.strictEqual(o.motivoCancelamento,"Chuva");
let caio=(await est()).alunos.find(a=>a.id==="a3");assert.strictEqual((caio.creditosReposicao||[]).length,1,"crédito do Caio");assert.strictEqual(caio.creditosReposicao[0].status,"pendente_aprovacao");
/* desfazer volta a agendada e tira o crédito não usado */
await p.locator("[data-desfazer-aula]").last().click();await p.waitForTimeout(200);
o=await ocDe("oc-ontem");assert.strictEqual(o.status,"agendada","desfeito");
caio=(await est()).alunos.find(a=>a.id==="a3");assert.strictEqual((caio.creditosReposicao||[]).length,0,"crédito retirado");
if(CAP)await p.screenshot({path:CAP+"/hoje-depois.png",fullPage:true});

/* Relatório do mês */
await p.evaluate(()=>window.__setAba("mes"));await p.waitForSelector("[data-fechamento-mes]");
t=await p.evaluate(()=>document.body.innerText);
const mesmoMes=(d)=>d.slice(0,7)===new Date().toISOString().slice(0,7);
const ontemNoMes=await p.evaluate(()=>{const d=new Date(Date.now()-86400000).toISOString();return d.slice(0,7)===new Date().toISOString().slice(0,7)});
if(ontemNoMes){assert(/aulas? sem registro/.test(t)&&/Caio Reis/.test(t.split("Visão geral")[0]),"Caio no topo do relatório");}
const ha17NoMes=await p.evaluate(()=>{const d=new Date(Date.now()-17*86400000).toISOString();return d.slice(0,7)===new Date().toISOString().slice(0,7)});
if(ha17NoMes){
  /* fora dos 14 dias que Aulas de hoje gera: só a grade sabe dessa aula; aparece sem estar gravada */
  const ha17=await p.evaluate(()=>new Date(Date.now()-17*86400000).toISOString().slice(0,10));
  assert(!(await est()).ocorrencias.some(o=>o.data===ha17),"a aula de 17 dias atrás não está gravada");
  const linha=p.locator("[data-pendentes-mes] > div",{hasText:"Enzo Prado"}).filter({hasText:ha17.slice(8,10)+"/"+ha17.slice(5,7)});
  await linha.getByText("✓ Realizada").click();await p.waitForTimeout(200);
  const nova=(await est()).ocorrencias.find(o=>o.data===ha17);
  assert(nova&&nova.status==="realizada"&&!("virtual" in nova),"marcar a aula prevista grava a ocorrência");
}
if(CAP)await p.screenshot({path:CAP+"/mes-geral.png",fullPage:true});
t=await p.evaluate(()=>document.body.innerText);
assert(/Realizadas/.test(t)&&/Faltas de alunos/.test(t)&&/A remarcar/.test(t),"tiles");
await p.click("[data-vista=alunos]");await p.waitForSelector("[data-linha-aluno=a2]");
await p.click("[data-linha-aluno=a2] button");await p.waitForTimeout(150);
t=await p.evaluate(()=>document.body.innerText);
assert(/Relatório do aluno \(PDF\)/.test(t)&&/Aulas perdidas sem reposição/i.test(t)&&/faltou/.test(t),"detalhe da Bia");
await p.locator("[data-perdidas]").getByText("Dar reposição").first().click();await p.waitForTimeout(200);
const bia=(await est()).alunos.find(a=>a.id==="a2");assert.strictEqual((bia.creditosReposicao||[]).length,1,"reposição dada à Bia pela falta");
if(CAP)await p.screenshot({path:CAP+"/mes-alunos.png",fullPage:true});
await p.click("[data-vista=professores]");await p.waitForTimeout(150);
t=await p.evaluate(()=>document.body.innerText);
assert(/Paula/.test(t)&&/aulas? dadas?/.test(t),"professores");
if(CAP)await p.screenshot({path:CAP+"/mes-professores.png",fullPage:true});
assert.deepStrictEqual(erros,[],"erros de JS "+erros.join(" | "));console.log("smoke-aulas-mes: ok");
await b.close();srv.close()})().catch(e=>{console.error(e.message||e);process.exit(1)});
