/* Partida já salva no caderno não pode continuar aparecendo como "em andamento". Extrai rascunhoRedundante do app real. */
const assert=require("assert"),fs=require("fs"),path=require("path");
for(const app of ["../../mty/index.html","../index.html"]){
 const t=fs.readFileSync(path.join(__dirname,app),"utf8");const i=t.indexOf("function rascunhoRedundante"),j=t.indexOf("const semRascunhoScout");
 assert(i>0&&j>i,app+": função não encontrada");const rascunhoRedundante=new Function(t.slice(i,j)+";return rascunhoRedundante;")();
 const P=(n)=>Array.from({length:n},(_,k)=>({n:k+1,fim:k%2?"erro_nos":"winner_nos"}));
 const r={pontos:P(195),cfg:{}};
 assert.strictEqual(rascunhoRedundante({scoutRascunho:r,registros:[{tipo:"jogo",scout:{pontos:P(195)}}]}),true,"salvo com os mesmos pontos");
 assert.strictEqual(rascunhoRedundante({scoutRascunho:r,registros:[{tipo:"jogo",scout:{pontos:P(200)}}]}),true,"salvo com mais pontos");
 assert.strictEqual(rascunhoRedundante({scoutRascunho:r,registros:[{tipo:"jogo",parcialAuto:true,scout:{pontos:P(195)}}]}),false,"a cópia automática não conta como salvo");
 assert.strictEqual(rascunhoRedundante({scoutRascunho:r,registros:[{tipo:"jogo",scout:{pontos:P(120)}}]}),false,"salvo com menos pontos: ainda há partida em andamento");
 assert.strictEqual(rascunhoRedundante({scoutRascunho:r,registros:[{tipo:"jogo",scout:{pontos:P(195).map(p=>({...p,fim:"winner_adv"}))}}]}),false,"outro jogo com o mesmo tamanho");
 assert.strictEqual(rascunhoRedundante({registros:[]}),false);
}
console.log("check-rascunho-redundante: ok");
