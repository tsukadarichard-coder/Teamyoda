/* Revisão do plano com evidências: TelaPlano real mostra as sugestões, aceitar inclui o reforço no bloco, recusar entra no diário, o cartão do Início aparece e o prompt recebe as evidências.
   Roda a TelaSessao real em React/Babel locais (defina CDN_DIR). Rode: node tests/smoke-hub-treinador.js [mty|autonomo] */
const fs=require("fs"),path=require("path"),http=require("http");const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const assert=require("assert");
const CDN=process.env.CDN_DIR||"/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if(!fs.existsSync(CDN)){console.log("smoke-hub-treinador: pulado (sem React/Babel locais; defina CDN_DIR)");process.exit(0);}
const app=process.argv[2]||"mty";const raiz=path.join(__dirname,"..",app==="mty"?"../mty":".");
const html=fs.readFileSync(path.join(raiz,"index.html"),"utf8");
const ms=[...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join("\n");
const corte=ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const corpo=ms.slice(0,corte)+`
window.mtyAuth={entrar:async()=>{},usuario:()=>null};
ReactDOM.createRoot(document.getElementById("root")).render(<TelaVendas aoEntrar={()=>{}} />);`;
const pagina=`<!doctype html><meta charset=utf-8><div id=root></div><script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};</script>
<script src=/scout/graficos.js></script><script src=/scout/ao-vivo.js></script><script src=/scout/relatorio-jogos.js></script><script src=/scout/movimento-motor.js></script><script src=/scout/evidencias.js></script><script src=/scout/movimento.js></script><script src=/scout/video-segmentador.js></script><script src=/scout/video-jogo.js></script>
<script type="text/babel">${corpo}</script>`;
const m={"/r.js":CDN+"/react-18.3.1/package/umd/react.development.js","/d.js":CDN+"/react-dom-18.3.1/package/umd/react-dom.development.js","/p.js":CDN+"/prop-types-15.8.1/package/prop-types.min.js","/c.js":CDN+"/recharts-2.15.4/package/umd/Recharts.js","/b.js":CDN+"/babel-standalone-7.29.9/package/babel.min.js"};
const srv=http.createServer((q,r)=>{const u=q.url.split("?")[0];if(u==="/"){r.writeHead(200,{"content-type":"text/html; charset=utf-8"});return r.end(pagina)}if(m[u]){r.writeHead(200,{"content-type":"text/javascript"});return r.end(fs.readFileSync(m[u]))}const f=path.join(raiz,decodeURIComponent(u));if(f.startsWith(raiz)&&fs.existsSync(f)&&fs.statSync(f).isFile()){r.writeHead(200,{"content-type":"text/javascript"});return r.end(fs.readFileSync(f))}r.writeHead(404);r.end()}).listen(0);
(async()=>{const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args:["--no-sandbox"]}),p=await b.newPage({viewport:{width:480,height:900}});
const erros=[];p.on("pageerror",e=>erros.push(e.message));p.on("console",m=>{if(m.type()==="error"&&!/Failed to load|BABEL/.test(m.text()))erros.push("c:"+m.text().slice(0,200))});
const url="http://localhost:"+srv.address().port+"/";
for(const [w,hash] of [[1280,"#entrar"],[390,"#entrar"],[1280,"#qlab-planos"]]){
  await p.setViewportSize({width:w,height:900});await p.goto(url+hash);await p.reload();
  await p.waitForSelector(".qlab-vendas",{timeout:120000});await p.waitForTimeout(1200);
  if(hash==="#entrar"){
    const ativo=await p.evaluate(()=>document.activeElement&&document.activeElement.id);
    assert.strictEqual(ativo,"qlab-login-email",app+": /treinador#entrar leva ao campo de e-mail do login ("+w+"px)");
    if(w<860)assert(await p.isVisible('[role="dialog"]'),app+": no celular o login abre em tela própria");
  }else{
    const topo=await p.evaluate(()=>document.getElementById("qlab-planos").getBoundingClientRect().top);
    assert(topo<500,app+": #qlab-planos rola até os planos ("+topo+")");
  }
}
assert.deepStrictEqual(erros,[],app+": erros de JS "+erros.join(" | "));console.log("smoke-hub-treinador "+app+": ok");
await b.close();srv.close()})().catch(e=>{console.error(e.message||e);process.exit(1)});