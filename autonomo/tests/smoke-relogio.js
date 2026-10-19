/* "Sessão de hoje": o botão Gerar sessão precisa funcionar para jogador sem histórico, sem prioridades, de qualquer estágio e com plano (a tela quebrava com TypeError).
   Roda a TelaSessao real em React/Babel locais (defina CDN_DIR). Rode: node tests/smoke-relogio.js [mty|autonomo] */
const fs=require("fs"),path=require("path"),http=require("http");const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const assert=require("assert");
const CDN=process.env.CDN_DIR||"/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if(!fs.existsSync(CDN)){console.log("smoke-relogio: pulado (sem React/Babel locais; defina CDN_DIR)");process.exit(0);}
const app=process.argv[2]||"mty";const raiz=path.join(__dirname,"..",app==="mty"?"../mty":".");
const html=fs.readFileSync(path.join(raiz,"index.html"),"utf8");
const ms=[...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join("\n");
const corte=ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const est=process.argv[3]||"C", niv=process.argv[4]||"Y5";
const corpo=ms.slice(0,corte)+`
function Host(){const b=novoAluno();const aluno={...b,id:"a1",nome:"Ana Souza",cadastroConcluido:true,estagio:"C",plano:{blocos:[{nome:"Bloco 1",semanasLista:[{n:1,foco:"Saque",aulas:[{t:"Aula 1",ex:TODOS_EXERCICIOS().slice(0,5).map(e=>e.c)}]}]}]}};
 const [alunos,setAlunos]=useState([aluno]);return <div style={{padding:12,maxWidth:520}}><TelaSessao aluno={alunos[0]} alunos={alunos} setAlunos={setAlunos} setSubaba={()=>{}} papelAtual="coordenador" uidAtual="u1" exerciciosCustom={[]} setExerciciosCustom={()=>{}} /></div>;}
ReactDOM.createRoot(document.getElementById("root")).render(<Host />);`;
const pagina=`<!doctype html><meta charset=utf-8><div id=root></div><script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};</script>
<script src=/scout/graficos.js></script><script src=/scout/ao-vivo.js></script><script src=/scout/relatorio-jogos.js></script><script src=/scout/movimento-motor.js></script><script src=/scout/movimento.js></script><script src=/scout/video-segmentador.js></script><script src=/scout/video-jogo.js></script>
<script>window.__posts=[];window.mtyAuth={usuario:()=>({uid:"u1"}),tokenId:async()=>"t"};window.fetch=async(u,o)=>{const c=JSON.parse(o.body);window.__posts.push({u,c});return {ok:true,json:async()=>({ok:true,token:"ab".repeat(16)})}};</script><script type="text/babel">${corpo}</script>`;
const m={"/r.js":CDN+"/react-18.3.1/package/umd/react.development.js","/d.js":CDN+"/react-dom-18.3.1/package/umd/react-dom.development.js","/p.js":CDN+"/prop-types-15.8.1/package/prop-types.min.js","/c.js":CDN+"/recharts-2.15.4/package/umd/Recharts.js","/b.js":CDN+"/babel-standalone-7.29.9/package/babel.min.js"};
const srv=http.createServer((q,r)=>{const u=q.url.split("?")[0];if(u==="/"){r.writeHead(200,{"content-type":"text/html; charset=utf-8"});return r.end(pagina)}if(m[u]){r.writeHead(200,{"content-type":"text/javascript"});return r.end(fs.readFileSync(m[u]))}const f=path.join(raiz,decodeURIComponent(u));if(f.startsWith(raiz)&&fs.existsSync(f)&&fs.statSync(f).isFile()){r.writeHead(200,{"content-type":"text/javascript"});return r.end(fs.readFileSync(f))}r.writeHead(404);r.end()}).listen(0);
(async()=>{const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args:["--no-sandbox"]}),p=await b.newPage({viewport:{width:480,height:900}});
const erros=[];p.on("pageerror",e=>erros.push(e.message));
await p.goto("http://localhost:"+srv.address().port+"/");await p.waitForFunction(()=>document.body.innerText.length>50,null,{timeout:120000});
assert.strictEqual(await p.locator("[data-relogio]").count(),0,"sem sessão não mostra o botão");
await p.getByRole("button",{name:/Gerar sessão|Pré-visualizar sessão/}).first().click();await p.waitForSelector("[data-relogio]",{timeout:10000});
await p.getByRole("button",{name:"Enviar para o relógio"}).click();await p.waitForSelector("[data-link-relogio]",{timeout:5000});
const post=await p.evaluate(()=>window.__posts[0]);
assert.strictEqual(post.c.acao,"publicar");assert.strictEqual(post.c.alunoId,"a1");
assert.deepStrictEqual(post.c.secoes.map(s=>s.t),["Aquecimento","Conteúdo"],"seções da aula");
assert(post.c.secoes.every(s=>s.itens.length&&s.itens.every(i=>i.n&&i.min>0)),"exercícios com nome e tempo");
assert(/sessao-relogio\?t=abab/.test(await p.textContent("[data-link-relogio]")),"link mostrado");
assert(/Atalhos/.test(await p.evaluate(()=>document.body.innerText)),"passos do Atalhos");
await p.getByRole("button",{name:"Apagar link"}).click();await p.waitForTimeout(300);
assert.strictEqual(await p.locator("[data-link-relogio]").count(),0,"link apagado");
assert.strictEqual((await p.evaluate(()=>window.__posts.map(x=>x.c.acao))).join(),"publicar,revogar");
assert.deepStrictEqual(erros,[],app+": erros de JS "+erros.join(" | "));console.log("smoke-relogio "+app+": ok");
await b.close();srv.close()})().catch(e=>{console.error(e.message||e);process.exit(1)});