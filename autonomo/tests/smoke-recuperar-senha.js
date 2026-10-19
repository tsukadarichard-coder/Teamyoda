/* Revisão do plano com evidências: TelaPlano real mostra as sugestões, aceitar inclui o reforço no bloco, recusar entra no diário, o cartão do Início aparece e o prompt recebe as evidências.
   Roda a TelaSessao real em React/Babel locais (defina CDN_DIR). Rode: node tests/smoke-recuperar-senha.js [mty|autonomo] */
const fs=require("fs"),path=require("path"),http=require("http");const {chromium}=require("/opt/node22/lib/node_modules/playwright");
const assert=require("assert");
const CDN=process.env.CDN_DIR||"/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
if(!fs.existsSync(CDN)){console.log("smoke-recuperar-senha: pulado (sem React/Babel locais; defina CDN_DIR)");process.exit(0);}
const app=process.argv[2]||"mty";const raiz=path.join(__dirname,"..",app==="mty"?"../mty":".");
const html=fs.readFileSync(path.join(raiz,"index.html"),"utf8");
const ms=[...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join("\n");
const corte=ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
const corpo=ms.slice(0,corte)+`ReactDOM.createRoot(document.getElementById("root")).render(<TelaLogin aoEntrar={()=>{}} />);`;
const pagina=`<!doctype html><meta charset=utf-8><div id=root></div><script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};</script>
<script src=/scout/graficos.js></script><script src=/scout/ao-vivo.js></script><script src=/scout/relatorio-jogos.js></script><script src=/scout/movimento-motor.js></script><script src=/scout/evidencias.js></script><script src=/scout/movimento.js></script><script src=/scout/video-segmentador.js></script><script src=/scout/video-jogo.js></script>
<script>window.__envios=[];window.mtyAuth={entrar:async()=>{},recuperarSenha:async(e)=>{window.__envios.push(e);if(e==="semconta@x.com")throw {code:"auth/user-not-found"};if(e==="falha@x.com")throw {code:"auth/network-request-failed"}}};</script><script type="text/babel">${corpo}</script>`;
const m={"/r.js":CDN+"/react-18.3.1/package/umd/react.development.js","/d.js":CDN+"/react-dom-18.3.1/package/umd/react-dom.development.js","/p.js":CDN+"/prop-types-15.8.1/package/prop-types.min.js","/c.js":CDN+"/recharts-2.15.4/package/umd/Recharts.js","/b.js":CDN+"/babel-standalone-7.29.9/package/babel.min.js"};
const srv=http.createServer((q,r)=>{const u=q.url.split("?")[0];if(u==="/"){r.writeHead(200,{"content-type":"text/html; charset=utf-8"});return r.end(pagina)}if(m[u]){r.writeHead(200,{"content-type":"text/javascript"});return r.end(fs.readFileSync(m[u]))}const f=path.join(raiz,decodeURIComponent(u));if(f.startsWith(raiz)&&fs.existsSync(f)&&fs.statSync(f).isFile()){r.writeHead(200,{"content-type":"text/javascript"});return r.end(fs.readFileSync(f))}r.writeHead(404);r.end()}).listen(0);
(async()=>{const b=await chromium.launch({executablePath:"/opt/pw-browsers/chromium-1194/chrome-linux/chrome",args:["--no-sandbox"]}),p=await b.newPage();
const erros=[];p.on("pageerror",e=>erros.push(e.message));
await p.goto("http://localhost:"+srv.address().port+"/");await p.waitForSelector("text=Esqueci minha senha",{timeout:120000});
await p.getByRole("button",{name:"Esqueci minha senha"}).click();
await p.waitForFunction(()=>/Digite seu e-mail/.test(document.body.innerText),null,{timeout:5000});
assert.deepStrictEqual(await p.evaluate(()=>window.__envios),[],"sem e-mail não envia");
await p.locator("input[type=email]").fill("tec@x.com");await p.getByRole("button",{name:"Esqueci minha senha"}).click();
await p.waitForFunction(()=>/enviamos um link de recuperação/.test(document.body.innerText),null,{timeout:5000});
await p.locator("input[type=email]").fill("semconta@x.com");await p.getByRole("button",{name:"Esqueci minha senha"}).click();await p.waitForTimeout(300);
assert(/enviamos um link de recuperação/.test(await p.evaluate(()=>document.body.innerText)),"mesma mensagem sem conta");
await p.locator("input[type=email]").fill("falha@x.com");await p.getByRole("button",{name:"Esqueci minha senha"}).click();
await p.waitForFunction(()=>/Não consegui enviar agora/.test(document.body.innerText),null,{timeout:5000});
assert.deepStrictEqual(await p.evaluate(()=>window.__envios),["tec@x.com","semconta@x.com","falha@x.com"]);
assert.deepStrictEqual(erros,[]);console.log("smoke-recuperar-senha "+app+": ok");await b.close();srv.close()})().catch(e=>{console.error(e.message||e);process.exit(1)});