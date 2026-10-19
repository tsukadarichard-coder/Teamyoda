/* Revisão do plano com evidências: TelaPlano real mostra as sugestões, aceitar inclui o reforço no bloco, recusar entra no diário, o cartão do Início aparece e o prompt recebe as evidências.
   Roda a TelaSessao real em React/Babel locais (defina CDN_DIR). Rode: node tests/smoke-meu-metodo.js [mty|autonomo] */
const fs=require("fs"),path=require("path"),http=require("http");const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const assert=require("assert");
const CDN=process.env.CDN_DIR||"/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if(!fs.existsSync(CDN)){console.log("smoke-meu-metodo: pulado (sem React/Babel locais; defina CDN_DIR)");process.exit(0);}
const app=process.argv[2]||"mty";const raiz=path.join(__dirname,"..",app==="mty"?"../mty":".");
const html=fs.readFileSync(path.join(raiz,"index.html"),"utf8");
const ms=[...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join("\n");
const corte=ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const corpo=ms.slice(0,corte)+`
function Host(){const [metodo,setMetodo]=useState(window.__premium?null:null);const [ex,setEx]=useState([]);setCatalogoCustom(ex);window.__metodo=metodo;window.__ex=ex;
 window.__t={setMetodoProprio,promptPlanoMeuMetodo,validarPlanoJSON,novoAluno,setPlano:(p)=>{window.__plano=p}};
 window.__IA=null;chamarIA=async()=>window.__IA;
 return <div style={{padding:12,maxWidth:520}}><TelaMeuMetodo metodo={metodo} setMetodo={setMetodo} planoAtual={window.__premium?"premium":"essencial"} exerciciosCustom={ex} setExerciciosCustom={setEx}/></div>;}
ReactDOM.createRoot(document.getElementById("root")).render(<Host />);`;
const pagina=`<!doctype html><meta charset=utf-8><div id=root></div><script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};</script>
<script src=/scout/graficos.js></script><script src=/scout/ao-vivo.js></script><script src=/scout/relatorio-jogos.js></script><script src=/scout/movimento-motor.js></script><script src=/metodo/metodo-proprio.js></script><script src=/scout/evidencias.js></script><script src=/scout/movimento.js></script><script src=/scout/video-segmentador.js></script><script src=/scout/video-jogo.js></script>
<script>window.mtyAuth={usuario:()=>({uid:"u1"}),tokenId:async()=>"t"};</script><script type="text/babel">${corpo}</script>`;
const m={"/r.js":CDN+"/react-18.3.1/package/umd/react.development.js","/d.js":CDN+"/react-dom-18.3.1/package/umd/react-dom.development.js","/p.js":CDN+"/prop-types-15.8.1/package/prop-types.min.js","/c.js":CDN+"/recharts-2.15.4/package/umd/Recharts.js","/b.js":CDN+"/babel-standalone-7.29.9/package/babel.min.js"};
const srv=http.createServer((q,r)=>{const u=q.url.split("?")[0];if(u==="/"){r.writeHead(200,{"content-type":"text/html; charset=utf-8"});return r.end(pagina)}if(m[u]){r.writeHead(200,{"content-type":"text/javascript"});return r.end(fs.readFileSync(m[u]))}const f=path.join(raiz,decodeURIComponent(u));if(f.startsWith(raiz)&&fs.existsSync(f)&&fs.statSync(f).isFile()){r.writeHead(200,{"content-type":"text/javascript"});return r.end(fs.readFileSync(f))}r.writeHead(404);r.end()}).listen(0);
(async()=>{const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args:["--no-sandbox"]});
const abre=async(premium)=>{const p=await b.newPage({viewport:{width:480,height:1000}});p.on("pageerror",e=>erros.push(e.message));await p.addInitScript(v=>{window.__premium=v},premium);await p.goto("http://localhost:"+srv.address().port+"/");await p.waitForFunction(()=>document.body.innerText.length>30,null,{timeout:120000});return p};
const erros=[];
let p=await abre(false);assert.strictEqual(await p.locator("[data-metodo-bloqueado]").count(),1,"plano Essencial vê o bloqueio");assert(/Disponível no plano Premium/.test(await p.evaluate(()=>document.body.innerText)));await p.close();
p=await abre(true);await p.waitForSelector("[data-meu-metodo]",{timeout:20000});
assert(await p.getByRole("checkbox",{name:/Usar o meu método/}).isDisabled(),"ativação travada sem os mínimos");
assert(/pelo menos 3 princípios/.test(await p.evaluate(()=>document.body.innerText)),"lista o que falta");
// biblioteca por planilha
await p.getByLabel("Planilha de exercícios").fill("Nome;Objetivo;Montagem;Carga;Progressão\nSaque alvo;Direção;3 alvos;4x10;Alvos menores\nVoleio duplo;Rede;2x1;5 min;\nRali longo;Consistência;cross;10 min;\nPasse e vá;Transição;fila;8 min;\nDevolução cruzada;Devolução;cesto;3x10;\nSmash e lob;Rede;par;6 min;");
await p.getByRole("button",{name:"Adicionar à biblioteca"}).click();await p.waitForFunction(()=>/6 exercício\(s\) adicionado/.test(document.body.innerText));
assert.strictEqual(await p.evaluate(()=>window.__ex.length),6);assert(await p.evaluate(()=>window.__ex.every(e=>/^MEU\d{3}$/.test(e.c)&&e.e.length===5)),"códigos MEU e estágios");
// princípios e áreas
const pr=p.getByLabel("Princípios");await pr.fill("Sempre bola viva\nPernas primeiro\nDecisão antes da técnica");await pr.blur();
await p.getByRole("button",{name:"+ Adicionar área"}).click();await p.getByLabel("Área 1").fill("Saque");await p.getByLabel("Critério de Saque").fill("1º saque ≥ 65%");
await p.getByRole("button",{name:"+ Adicionar área"}).click();await p.getByLabel("Área 2").fill("Rede");await p.getByLabel("Critério de Rede").fill("8 de 10 voleios");
await p.waitForFunction(()=>!document.querySelector("input[type=checkbox]").disabled,null,{timeout:5000});
await p.getByRole("checkbox",{name:/Usar o meu método/}).check();
const m=await p.evaluate(()=>window.__metodo);assert(m.ativo&&m.principios.length===3&&m.areas.length===2&&m.areas[0].criterio==="1º saque ≥ 65%","método ativo e salvo no estado");
// importar com IA (resposta simulada)
await p.evaluate(()=>{window.__IA=JSON.stringify({principios:["Nunca treino sem objetivo","Pernas primeiro"],areas:[{nome:"Mental",criterio:"rotina entre pontos"}],naoFazer:["Cesto parado"],exercicios:[{nome:"Mini-tênis",objetivo:"toque"},{nome:"Saque alvo",objetivo:"repetido"}]})});
await p.getByLabel("Material do treinador").fill("Meu método: trabalho sempre com bola viva e pernas primeiro. ".repeat(3));
await p.getByRole("button",{name:"Preencher com IA"}).click();await p.waitForFunction(()=>/Revise os campos abaixo/.test(document.body.innerText),null,{timeout:10000});
const m2=await p.evaluate(()=>window.__metodo);assert(m2.principios.length===4&&m2.areas.length===3&&m2.naoFazer.length===1,"mescla sem duplicar: "+JSON.stringify(m2.principios));
assert(m2.ativo===true,"importar não desativa nem ativa sozinho");
await p.getByRole("button",{name:/Adicionar os 2 exercícios/}).click();await p.waitForFunction(()=>window.__ex.length===7);
assert(await p.evaluate(()=>window.__ex.filter(e=>e.n==="Saque alvo").length===1),"não duplica exercício já existente");
// prompt e validação do plano com o método próprio
const r=await p.evaluate(()=>{const T=window.__t;T.setMetodoProprio(window.__metodo);const a={...T.novoAluno(),nome:"Ana",estagio:"C",registros:[]};
 const pr=T.promptPlanoMeuMetodo(a,4,3,[],{tecnico:50,tatico:50,fisico:50,pontos:50});
 const cod=window.__ex[0].c;const plano={blocos:[{nome:"Bloco um",titulo:"x",areaFoco:"",saida:"1º saque ≥ 65%",semanasLista:[{n:1,foco:"f",aulas:[{t:"A1",ex:[cod]}]}]}]};
 const v=T.validarPlanoJSON(plano,["C"],[]);return {pr,ex:v.blocos[0].semanasLista[0].aulas[0].ex,cod};});
assert(/Sempre bola viva/.test(r.pr)&&/1º saque ≥ 65%/.test(r.pr)&&/MEU001 Saque alvo/.test(r.pr),"prompt usa o método e a biblioteca dele");
const mm=r.pr.match(/.{0,80}(MTY|Richard Tsukada|Y1–Y6).{0,80}/g);assert(!mm,"prompt sem regras do MTY: "+JSON.stringify(mm));
assert.deepStrictEqual(r.ex,[r.cod],"validação não injeta exercícios do MTY");
assert.deepStrictEqual(erros,[],"erros de JS "+erros.join(" | "));console.log("smoke-meu-metodo "+app+": ok");
await b.close();srv.close()})().catch(e=>{console.error(e.message||e);process.exit(1)});