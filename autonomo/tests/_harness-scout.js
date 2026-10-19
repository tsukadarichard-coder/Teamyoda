/* Roda a TelaScout real (extraída do index.html do app) em React/Babel locais, sem login nem Firebase. Usado por smoke-retomar-partida.js.
   Defina CDN_DIR com React, ReactDOM, prop-types, Recharts e @babel/standalone (padrão: scratchpad/cdn). */
const fs = require("fs"), path = require("path"), http = require("http");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const CDN = process.env.CDN_DIR || "/tmp/claude-0/-home-user-Teamyoda/f36f7b1a-5380-5cd8-93be-4b9b8aa1980b/scratchpad/cdn";
function abrir(app) {
const raiz = path.join(__dirname, "..", app === "mty" ? "../mty" : ".");
const html=fs.readFileSync(path.join(raiz,"index.html"),"utf8");
const ms=[...html.matchAll(/<script type="text\/babel"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join("\n");
const corte=ms.indexOf('ReactDOM.createRoot(document.getElementById("root")).render(<App />);');
if(corte<0)throw new Error("fim do app não encontrado");
const corpo=ms.slice(0,corte)+`
function HostScout(){const [alunos,setAlunos]=useState(window.__alunosIniciais||[{id:"a1",nome:"Ana Souza",registros:[]}]);window.__alunos=alunos;
 const [ver,setVer]=useState(true);window.__desmontar=()=>setVer(false);window.__montar=()=>setVer(true);
 return <div style={{padding:12,maxWidth:480}}><CartaoPartidasEmAndamento alunos={alunos} aoAbrirScout={(id) => { window.__abriu = id; }} />{ver?<TelaScout aluno={alunos[0]} alunos={alunos} setAlunos={setAlunos} identidade={{}} />:<p id="fora">fora</p>}</div>;}
ReactDOM.createRoot(document.getElementById("root")).render(<HostScout />);`;
const pagina=`<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width"><div id=root></div>
<script src=/r.js></script><script src=/d.js></script><script src=/p.js></script><script src=/c.js></script><script src=/b.js></script>
<script>window.MTY={evento(){},id:()=>"x",map(){},tokenSeguro(){return ""}};</script>
<script src=/scout/graficos.js></script><script src=/scout/ao-vivo.js></script><script src=/scout/relatorio-jogos.js></script><script src=/scout/movimento-motor.js></script><script src=/scout/movimento.js></script><script src=/scout/video-segmentador.js></script><script src=/scout/video-jogo.js></script>
<link rel=stylesheet href=/scout/ao-vivo.css><link rel=stylesheet href=/scout/graficos.css><link rel=stylesheet href=/scout/movimento.css>
<script type="text/babel">${corpo}</script>`;
const m={"/r.js":CDN+"/react-18.3.1/package/umd/react.development.js","/d.js":CDN+"/react-dom-18.3.1/package/umd/react-dom.development.js","/p.js":CDN+"/prop-types-15.8.1/package/prop-types.min.js","/c.js":CDN+"/recharts-2.15.4/package/umd/Recharts.js","/b.js":CDN+"/babel-standalone-7.29.9/package/babel.min.js"};
const srv=http.createServer((q,r)=>{const u=q.url.split("?")[0];if(u==="/"){r.writeHead(200,{"content-type":"text/html; charset=utf-8"});return r.end(pagina)}if(m[u]){r.writeHead(200,{"content-type":"text/javascript"});return r.end(fs.readFileSync(m[u]))}const f=path.join(raiz,decodeURIComponent(u));if(f.startsWith(raiz)&&fs.existsSync(f)&&fs.statSync(f).isFile()){r.writeHead(200,{"content-type":f.endsWith(".css")?"text/css":f.endsWith(".png")?"image/png":"text/javascript"});return r.end(fs.readFileSync(f))}r.writeHead(404);r.end()}).listen(0);
return { srv, raiz };
}
module.exports = { abrir, chromium, CDN, existe: () => fs.existsSync(CDN) };
