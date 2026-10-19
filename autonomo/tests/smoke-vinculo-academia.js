/* Revisão do plano com evidências: TelaPlano real mostra as sugestões, aceitar inclui o reforço no bloco, recusar entra no diário, o cartão do Início aparece e o prompt recebe as evidências.
   Roda a TelaSessao real em React/Babel locais (defina CDN_DIR). Rode: node tests/smoke-vinculo-academia.js [mty|autonomo] */
const fs=require("fs"),path=require("path"),http=require("http");const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const assert=require("assert");
const CDN=process.env.CDN_DIR||"/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if(!fs.existsSync(CDN)){console.log("smoke-vinculo-academia: pulado (sem React/Babel locais; defina CDN_DIR)");process.exit(0);}
const app=process.argv[2]||"mty";const raiz=path.join(__dirname,"..",app==="mty"?"../mty":".");
const html=fs.readFileSync(path.join(raiz,"index.html"),"utf8");
const ms=[...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join("\n");
const corte=ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const corpo=ms.slice(0,corte)+`ReactDOM.createRoot(document.getElementById("root")).render(<div style={{padding:12}}><CartaoVinculoAcademia /></div>);`;
const pagina=`<!doctype html><meta charset=utf-8><div id=root></div><script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};</script>
<script src=/scout/graficos.js></script><script src=/scout/ao-vivo.js></script><script src=/scout/relatorio-jogos.js></script><script src=/scout/movimento-motor.js></script><script src=/scout/evidencias.js></script><script src=/scout/movimento.js></script><script src=/scout/video-segmentador.js></script><script src=/scout/video-jogo.js></script>
<script>window.mtyAuth={usuario:()=>({uid:"u1"}),tokenId:async()=>"t"};window.__chamadas=[];window.fetch=async(u,o)=>{const b=JSON.parse(o.body);window.__chamadas.push(b);if(b.acao==="meuCodigo")return {ok:true,json:async()=>({ok:true,codigo:"ABCD2345"})};if(b.email==="nao@x.com")return {ok:false,status:404,json:async()=>({erro:"Esse e-mail ainda não tem conta de atleta no QuadraLab Player."})};return {ok:true,json:async()=>({ok:true,atleta:"Ana"})}};</script><script type="text/babel">${corpo}</script>`;
const m={"/r.js":CDN+"/react-18.3.1/package/umd/react.development.js","/d.js":CDN+"/react-dom-18.3.1/package/umd/react-dom.development.js","/p.js":CDN+"/prop-types-15.8.1/package/prop-types.min.js","/c.js":CDN+"/recharts-2.15.4/package/umd/Recharts.js","/b.js":CDN+"/babel-standalone-7.29.9/package/babel.min.js"};
const srv=http.createServer((q,r)=>{const u=q.url.split("?")[0];if(u==="/"){r.writeHead(200,{"content-type":"text/html; charset=utf-8"});return r.end(pagina)}if(m[u]){r.writeHead(200,{"content-type":"text/javascript"});return r.end(fs.readFileSync(m[u]))}const f=path.join(raiz,decodeURIComponent(u));if(f.startsWith(raiz)&&fs.existsSync(f)&&fs.statSync(f).isFile()){r.writeHead(200,{"content-type":"text/javascript"});return r.end(fs.readFileSync(f))}r.writeHead(404);r.end()}).listen(0);
(async()=>{const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args:["--no-sandbox"]}),p=await b.newPage();
const erros=[];p.on("pageerror",e=>erros.push(e.message));
await p.goto("http://localhost:"+srv.address().port+"/");await p.waitForSelector("[data-vinculo-academia]",{timeout:120000});
await p.getByRole("button",{name:/Atletas da academia/}).click();
await p.waitForFunction(()=>document.querySelector("[data-codigo-academia]")&&document.querySelector("[data-codigo-academia]").textContent==="ABCD2345",null,{timeout:10000});
await p.getByPlaceholder("email@do.atleta").fill("nao@x.com");await p.getByRole("button",{name:/Pedir vínculo/}).click();
await p.waitForFunction(()=>/ainda não tem conta/.test(document.body.innerText),null,{timeout:10000});
await p.getByPlaceholder("email@do.atleta").fill("ana@x.com");await p.getByRole("button",{name:/Pedir vínculo/}).click();
await p.waitForFunction(()=>/Pedido enviado a Ana/.test(document.body.innerText),null,{timeout:10000});
const ch=await p.evaluate(()=>window.__chamadas.map(c=>c.acao));assert.deepStrictEqual(ch,["meuCodigo","pedirVinculo","pedirVinculo"]);
assert.deepStrictEqual(erros,[]);console.log("smoke-vinculo-academia "+app+": ok");await b.close();srv.close()})().catch(e=>{console.error(e.message||e);process.exit(1)});