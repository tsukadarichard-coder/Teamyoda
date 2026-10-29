/* "Sessão de hoje": o botão Gerar sessão precisa funcionar para jogador sem histórico, sem prioridades, de qualquer estágio e com plano (a tela quebrava com TypeError).
   Roda a TelaSessao real em React/Babel locais (defina CDN_DIR). Rode: node tests/smoke-sessao-substituto.js [mty|autonomo] */
const fs=require("fs"),path=require("path"),http=require("http");const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const assert=require("assert");
const CDN=process.env.CDN_DIR||"/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if(!fs.existsSync(CDN)){console.log("smoke-sessao-substituto: pulado (sem React/Babel locais; defina CDN_DIR)");process.exit(0);}
const app=process.argv[2]||"mty";const raiz=path.join(__dirname,"..",app==="mty"?"../mty":".");
const html=fs.readFileSync(path.join(raiz,"index.html"),"utf8");
const ms=[...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join("\n");
const corte=ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const est=process.argv[3]||"C", niv=process.argv[4]||"Y5";
const corpo=ms.slice(0,corte)+`
function Host(){const b=novoAluno();const aluno={...b,id:"a1",nome:"Ana Souza",cadastroConcluido:true,estagio:"C",professorUid:"yoda",professorNome:"Yoda",
 plano:{aprovado:true,blocos:[{nome:"Bloco 1",semanasLista:[{n:1,foco:"Saque",aulas:[{t:"Aula 1",ex:TODOS_EXERCICIOS().slice(0,5).map(e=>e.c)}]}]}]}};
 const [alunos,setAlunos]=useState([aluno]);window.__alunos=alunos;
 return <div style={{padding:12,maxWidth:520}}><TelaSessao aluno={alunos[0]} alunos={alunos} setAlunos={setAlunos} setSubaba={()=>{}} papelAtual="treinador" uidAtual="davi" exerciciosCustom={[]} setExerciciosCustom={()=>{}} /></div>;}
ReactDOM.createRoot(document.getElementById("root")).render(<Host />);`;
const pagina=`<!doctype html><meta charset=utf-8><div id=root></div><script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script><script src=/aulas-mes.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};</script>
<script>window.listaProfessores=async()=>[{uid:"davi",nome:"Davi"},{uid:"yoda",nome:"Yoda"}];</script>
<script src=/scout/graficos.js></script><script src=/scout/ao-vivo.js></script><script src=/scout/relatorio-jogos.js></script><script src=/scout/movimento-motor.js></script><script src=/scout/movimento.js></script><script src=/scout/video-segmentador.js></script><script src=/scout/video-jogo.js></script>
<script type="text/babel">${corpo}</script>`;
const m={"/aulas-mes.js":require("path").join(__dirname,"../../mty/aulas-mes.js"),"/r.js":CDN+"/react-18.3.1/package/umd/react.development.js","/d.js":CDN+"/react-dom-18.3.1/package/umd/react-dom.development.js","/p.js":CDN+"/prop-types-15.8.1/package/prop-types.min.js","/c.js":CDN+"/recharts-2.15.4/package/umd/Recharts.js","/b.js":CDN+"/babel-standalone-7.29.9/package/babel.min.js"};
const srv=http.createServer((q,r)=>{const u=q.url.split("?")[0];if(u==="/"){r.writeHead(200,{"content-type":"text/html; charset=utf-8"});return r.end(pagina)}if(m[u]){r.writeHead(200,{"content-type":"text/javascript"});return r.end(fs.readFileSync(m[u]))}const f=path.join(raiz,decodeURIComponent(u));if(f.startsWith(raiz)&&fs.existsSync(f)&&fs.statSync(f).isFile()){r.writeHead(200,{"content-type":"text/javascript"});return r.end(fs.readFileSync(f))}r.writeHead(404);r.end()}).listen(0);
(async()=>{const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args:["--no-sandbox"]}),p=await b.newPage({viewport:{width:480,height:900}});
const erros=[];p.on("pageerror",e=>erros.push(e.message));p.on("dialog",d=>d.accept());
await p.goto("http://localhost:"+srv.address().port+"/");await p.waitForFunction(()=>document.body.innerText.length>50,null,{timeout:120000});
const t0=await p.evaluate(()=>document.body.innerText);
assert(/professor Yoda/.test(t0)&&/no lugar dele/.test(t0),app+": avisa que está no lugar do titular");
const gerar=p.getByRole("button",{name:/Gerar sessão|Pré-visualizar sessão/}).first();
assert(await gerar.isEnabled(),app+": professor que não é o titular pode gerar a sessão");
assert(await p.getByRole("button",{name:/Foi dia de chuva/}).isEnabled(),app+": e usar o dia de chuva");
await gerar.click();await p.waitForTimeout(600);
assert(/PREVISTOS|CONDUZIR|Gerar nova versão/i.test(await p.evaluate(()=>document.body.innerText)),app+": a sessão foi gerada");
const fin=p.getByRole("button",{name:"Finalizar e registrar aula"});assert(await fin.isEnabled(),app+": e finalizar a aula");
await fin.evaluate(e=>e.click());await p.waitForTimeout(400);
if(app==="mty"){const q=p.locator("[data-quem-deu]");assert(/Quem deu esta aula\?/.test(await q.innerText())&&/Titular/.test(await q.innerText()),app+": no fim da aula pergunta quem deu");
  assert.strictEqual(await q.getByRole("button",{name:"Substituto"}).getAttribute("aria-pressed"),"true",app+": quem não é o titular já vem como substituto");}
await p.getByRole("button",{name:/Confirmar registro/}).last().evaluate(e=>e.click());await p.waitForTimeout(800);
const regs=await p.evaluate(()=>window.__alunos[0].registros||[]);
assert(regs.length===1&&regs[0].tipo==="sessao"&&(app==="autonomo"||regs[0].substitutoUid==="davi"),app+": a aula ficou registrada com o substituto: "+JSON.stringify(regs.map(r=>[r.tipo,r.substitutoUid])));
assert.deepStrictEqual(erros,[],app+": erros de JS "+erros.join(" | "));console.log("smoke-sessao-substituto "+app+": ok");
await b.close();srv.close()})().catch(e=>{console.error(e.message||e);process.exit(1)});