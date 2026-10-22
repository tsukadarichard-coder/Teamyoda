/* Aulas da equipe (Team Yoda, coordenador): a lista junta as aulas individuais e as de turma de todos os
   professores, uma sessão de turma aparece uma vez só (com presença), quem deu a aula é quem registrou
   (registradoPor*) → substituto → titular, e o filtro por professor, o período e a busca funcionam.
   Roda TelaEquipe real em React/Babel locais (defina CDN_DIR). Rode: node tests/check-aulas-equipe.js [pasta-das-capturas] */
const fs=require("fs"),path=require("path"),http=require("http");const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const assert=require("assert");
const CDN=process.env.CDN_DIR||"/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if(!fs.existsSync(CDN)){console.log("check-aulas-equipe: pulado (sem React/Babel locais; defina CDN_DIR)");process.exit(0);}
const raiz=path.join(__dirname,"..","..","mty");const capturas=process.argv[2]||"";
const html=fs.readFileSync(path.join(raiz,"index.html"),"utf8");
const ms=[...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join("\n");
const corte=ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const d=(n)=>new Date(Date.now()-n*86400000).toISOString().slice(0,10);
const sess=(id,data,extra)=>({id,tipo:"sessao",data,ciclo:"Construção · semana 2 · Construção em 3 bolas",duracao:60,exercicios:["IP01"],exerciciosStatus:{},corrigi:"Preparação curta da direita.",ignorei:"",mudaria:"",proximoFoco:"Construção em 3 bolas.",leituraDaAula:"",temas:[],...extra});
const alunos=[
  {id:"a1",nome:"Ana Souza",professorUid:"p1",professorNome:"Carlos",registros:[sess("r1",d(0),{registradoPorUid:"p1",registradoPorNome:"Carlos"}),sess("r2",d(3),{}),{id:"j1",tipo:"jogo",data:d(1)}]},
  {id:"a2",nome:"Bruno Lima",professorUid:"p2",professorNome:"Marina",registros:[sess("r3",d(1),{substitutoUid:"p1",substitutoNome:"Carlos",registradoPorUid:"p1",registradoPorNome:"Carlos"}),sess("r4",d(20),{})]},
  {id:"a3",nome:"Caio Reis",professorUid:"p2",professorNome:"Marina",registros:[sess("t1-a3",d(2),{turma:"Turma Sub-12",presenca:"presente",notaIndividual:"Ótima leitura de jogo",registradoPorUid:"p2",registradoPorNome:"Marina"})]},
  {id:"a4",nome:"Duda Alves",professorUid:"p2",professorNome:"Marina",registros:[sess("t1-a4",d(2),{turma:"Turma Sub-12",presenca:"ausente",exercicios:[],registradoPorUid:"p2",registradoPorNome:"Marina"})]},
  {id:"a5",nome:"Sem Aula",professorUid:"p3",professorNome:"Rafael",registros:[]},
];
const turmas=[{id:"tu1",nome:"Turma Sub-12",professorUid:"p2",professorNome:"Marina",membros:["a3","a4"]}];
/* listaProfessores/organizacao/db moram no script comum da página (Firebase); aqui, substitutos com 3 professores */
const corpo=`async function listaProfessores(){return [{uid:"p1",nome:"Carlos"},{uid:"p2",nome:"Marina"},{uid:"p3",nome:"Rafael"}];}
async function organizacao(){return "demo";} var db=null, auth=null;
`+ms.slice(0,corte)+`
window.mtyAuth={entrar:async()=>{},usuario:()=>null};
window.__abriu=[];
ReactDOM.createRoot(document.getElementById("root")).render(<TelaEquipe alunos={${JSON.stringify(alunos)}} turmas={${JSON.stringify(turmas)}} membros={[]} setMembros={()=>{}}
  carregandoForm={false} uidAtual="p0" irPara={(id)=>window.__abriu.push("plano:"+id)} irParaCaderno={(id)=>window.__abriu.push("caderno:"+id)} irParaTurma={(id)=>window.__abriu.push("turma:"+id)} irParaManual={()=>{}} />);`;
const pagina=`<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><script src="https://cdn.tailwindcss.com"></script><div id=root style="padding:16px"></div><script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};</script>
<script src=/sync-listas.js></script><script src=/scout/graficos.js></script><script src=/scout/ao-vivo.js></script><script src=/scout/relatorio-jogos.js></script><script src=/scout/movimento-motor.js></script><script src=/scout/evidencias.js></script><script src=/scout/movimento.js></script><script src=/scout/video-segmentador.js></script><script src=/scout/video-audio.js></script><script src=/scout/video-scout.js></script><script src=/scout/video-visao.js></script><script src=/scout/video-scout-ui.js></script><script src=/scout/quadra-auto.js></script><script src=/scout/padroes.js></script><script src=/scout/video-jogo.js></script>
<script type="text/babel">${corpo}</script>`;
const m={"/r.js":CDN+"/react-18.3.1/package/umd/react.development.js","/d.js":CDN+"/react-dom-18.3.1/package/umd/react-dom.development.js","/p.js":CDN+"/prop-types-15.8.1/package/prop-types.min.js","/c.js":CDN+"/recharts-2.15.4/package/umd/Recharts.js","/b.js":CDN+"/babel-standalone-7.29.9/package/babel.min.js"};
const srv=http.createServer((q,r)=>{const u=q.url.split("?")[0];if(u==="/"){r.writeHead(200,{"content-type":"text/html; charset=utf-8"});return r.end(pagina)}if(m[u]){r.writeHead(200,{"content-type":"text/javascript"});return r.end(fs.readFileSync(m[u]))}const f=path.join(raiz,decodeURIComponent(u));if(f.startsWith(raiz)&&fs.existsSync(f)&&fs.statSync(f).isFile()){r.writeHead(200,{"content-type":"text/javascript"});return r.end(fs.readFileSync(f))}r.writeHead(404);r.end()}).listen(0);
(async()=>{const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args:["--no-sandbox"]}),p=await b.newPage({viewport:{width:430,height:1400}});
await p.route(/tailwindcss/,r=>r.fulfill({status:200,contentType:"text/javascript",body:""}));
const erros=[];p.on("pageerror",e=>erros.push(e.message));p.on("console",x=>{if(x.type()==="error"&&!/Failed to load|BABEL/.test(x.text()))erros.push("c:"+x.text().slice(0,200))});
await p.goto("http://localhost:"+srv.address().port+"/");await p.waitForSelector("text=Aulas da equipe",{timeout:90000}).catch(e=>{throw new Error("não abriu: "+erros.join(" | ").slice(0,1500))});await p.waitForTimeout(800);
const texto=async()=>p.evaluate(()=>document.body.innerText);
// 7 dias (padrão): Ana hoje (Carlos), Bruno ontem (Carlos substituindo Marina), turma há 2 dias (uma vez só), Ana há 3 dias (registro antigo → titular Carlos); fora: 20 dias, jogo
if(capturas){fs.mkdirSync(capturas,{recursive:true});await p.screenshot({path:path.join(capturas,"aulas-equipe-7dias.png"),fullPage:true});}
let t=await texto();
if(process.env.MOSTRA)console.log(t);
assert(/Hoje · 1 aula/i.test(t)&&/Ontem · 1 aula/i.test(t),"agrupa por dia");
assert.strictEqual((t.match(/Turma Sub-12/g)||[]).length>=1,true);
assert.strictEqual((t.match(/Turma · 1 presente · 1 faltou/gi)||[]).length,1,"a sessão de turma aparece uma vez, com a presença");
assert(/Substituição · titular: Marina/i.test(t),"mostra a substituição e o titular");
assert(!/Hoje · 2/i.test(t)&&(t.match(/Bruno Lima/g)||[]).length===1,"jogos e aulas fora do período não entram");
assert(/Carlos\s*\n\s*3 aulas · 7 dias/.test(t),"Carlos: 3 aulas (inclui a de substituto e a antiga atribuída ao titular) ("+t.slice(0,400)+")");
assert(/Marina\s*\n\s*1 aula · 7 dias/.test(t),"Marina: 1 aula (a turma)");
assert(/Rafael\s*\n\s*0 aulas · 7 dias[\s\S]*?Nenhuma aula registrada no período/.test(t),"quem não registrou aparece com zero");
if(capturas){fs.mkdirSync(capturas,{recursive:true});await p.screenshot({path:path.join(capturas,"aulas-equipe-7dias.png"),fullPage:true});}
// filtra por professor tocando no cartão
await p.click("text=Marina >> nth=0");await p.waitForTimeout(300);t=await texto();
assert(!/Ana Souza/.test(t)&&/Turma Sub-12/.test(t),"filtro por professor");
await p.click("text=Ver o que foi feito");await p.waitForTimeout(300);t=await texto();
assert(/Presentes: Caio Reis/.test(t)&&/Faltaram: Duda Alves/.test(t)&&/Notas individuais: Caio Reis: Ótima leitura de jogo/.test(t)&&/Corrigi/i.test(t),"detalhe da turma: presença, notas e observações");
if(capturas)await p.screenshot({path:path.join(capturas,"aulas-equipe-detalhe-turma.png"),fullPage:true});
await p.click("text=Abrir turma →");assert.deepStrictEqual(await p.evaluate(()=>window.__abriu),["turma:tu1"]);
// 30 dias + todos + busca
await p.click("text=Marina >> nth=0");await p.click("button:has-text('30 dias')");await p.waitForTimeout(300);t=await texto();
assert(/Marina\s*\n\s*2 aulas · 30 dias/.test(t),"30 dias inclui a aula antiga da Marina");
await p.fill("input[placeholder='Buscar…']","bruno");await p.waitForTimeout(300);t=await texto();
assert(/Bruno Lima/.test(t)&&!/Ana Souza\n/.test(t),"busca por jogador");
await p.click("text=Abrir caderno do jogador →");assert.deepStrictEqual(await p.evaluate(()=>window.__abriu),["turma:tu1","caderno:a2"]);
// visão geral leva à lista filtrada
await p.click("button:has-text('Visão geral')");await p.waitForTimeout(600);
t=await texto();
assert(/Carlos[\s\S]{0,200}3 aulas registradas · 7 dias/i.test(t)&&/Marina[\s\S]{0,200}1 aula registrada · 7 dias/i.test(t),"visão geral conta as aulas registradas por professor");
if(capturas)await p.screenshot({path:path.join(capturas,"equipe-visao-geral.png"),fullPage:true});
await p.click("text=Ver aulas registradas → >> nth=1");await p.waitForTimeout(500);t=await texto();
assert(/Turma Sub-12/.test(t)&&!/Ana Souza/.test(t),"o atalho da visão geral abre a lista já filtrada pelo professor");
assert.deepStrictEqual(erros,[],"erros de JS: "+erros.join(" | "));
console.log("check-aulas-equipe: ok");await b.close();srv.close()})().catch(e=>{console.error(e.message||e);process.exit(1)});
