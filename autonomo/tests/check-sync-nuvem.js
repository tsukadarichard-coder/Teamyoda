/* Duas contas (professores) na mesma academia: o que um registra aparece para o outro e nenhum apaga o do outro.
   Roda o trecho real "junção das listas" do mty/index.html contra um Firestore de mentira. */
const assert=require("assert"),fs=require("fs"),path=require("path");
const html=fs.readFileSync(path.join(__dirname,"../../mty/index.html"),"utf8");
const i=html.indexOf("/* ── junção das listas da academia"),j=html.indexOf("window.storage = db ? storageFirestore : storageLocal;");
assert(i>0&&j>i,"trecho de junção não encontrado");const trecho=html.slice(i,j);
const MTYSync=require("../../mty/sync-listas.js");
const nuvem={};const ouvintes=[];
function fakeDb(){return{collection:()=>({doc:()=>({collection:()=>({doc:(k)=>({
  get:async()=>({exists:k in nuvem,data:()=>nuvem[k]}),
  onSnapshot:(cb)=>{const o={k,cb};ouvintes.push(o);return()=>{ouvintes.splice(ouvintes.indexOf(o),1)}}, _k:k})})})}),
  runTransaction:async(fn)=>{const w=[];await fn({get:async(ref)=>({exists:ref._k in nuvem,data:()=>nuvem[ref._k]}),set:(ref,v)=>w.push([ref._k,v])});w.forEach(([k,v])=>{nuvem[k]=v;ouvintes.filter(o=>o.k===k).forEach(o=>o.cb({exists:true,metadata:{hasPendingWrites:false},data:()=>v}))})}}}
/* o fake precisa de doc(k) em três níveis: orgs/org/dados/k */
function db2(){const d=fakeDb();const doc=(k)=>({get:async()=>({exists:k in nuvem,data:()=>nuvem[k]}),onSnapshot:(cb)=>{const o={k,cb};ouvintes.push(o);return()=>{ouvintes.splice(ouvintes.indexOf(o),1)}},_k:k});
 return{collection:()=>({doc:()=>({collection:()=>({doc})})}),runTransaction:d.runTransaction}}
function cliente(){const db=db2();const storageFirestore={async get(k){return k in nuvem?{key:k,value:nuvem[k].value}:null},async set(k,v){nuvem[k]={value:v}}};
 const f=new Function("db","organizacao","storageFirestore","window",trecho+";return {SINC,storageFirestore};");
 const w={MTYSync};return f(db,async()=>"org",storageFirestore,w);}
(async()=>{
 const K="mty:alunos:v2",al=(id,x={})=>({id,nome:id,registros:[],...x});
 nuvem[K]={value:JSON.stringify([al("a"),al("b")])};
 const A=cliente(),B=cliente();let estA=null,estB=null;
 for(const [c,nome] of [[A,"A"],[B,"B"]]){const r=await c.storageFirestore.get(K);const lista=JSON.parse(r.value);if(nome==="A")estA=lista;else estB=lista;}
 A.SINC.aoMudar[K]=l=>{estA=l};A.SINC.local[K]=()=>estA;A.SINC.pronto[K]=()=>true;
 B.SINC.aoMudar[K]=l=>{estB=l};B.SINC.local[K]=()=>estB;B.SINC.pronto[K]=()=>true;
 await A.storageFirestore.observar(K);await B.storageFirestore.observar(K);
 /* B registra uma sessão no aluno "a" */
 estB=estB.map(x=>x.id==="a"?{...x,registros:[{id:"r1",tipo:"sessao",por:"B"}]}:x);
 await B.storageFirestore.set(K,JSON.stringify(estB));
 assert.strictEqual(estA.find(x=>x.id==="a").registros.length,1,"A enxerga a sessão que B registrou, sem recarregar");
 /* A, ainda com a tela dele, edita outro aluno e grava: a sessão de B continua na nuvem */
 estA=estA.map(x=>x.id==="b"?{...x,nome:"Beto"}:x);
 await A.storageFirestore.set(K,JSON.stringify(estA));
 const final=JSON.parse(nuvem[K].value);
 assert.strictEqual(final.find(x=>x.id==="a").registros.length,1,"a gravação de A não apagou a sessão de B");
 assert.strictEqual(final.find(x=>x.id==="b").nome,"Beto");
 /* a tela de B recebeu a edição de A sozinha; B então registra mais uma sessão e grava */
 assert.strictEqual(estB.find(x=>x.id==="b").nome,"Beto","B enxerga a edição de A");
 estB=estB.map(x=>x.id==="a"?{...x,registros:[...x.registros,{id:"r2",tipo:"sessao",por:"B"}]}:x);
 await B.storageFirestore.set(K,JSON.stringify(estB));
 const f2=JSON.parse(nuvem[K].value);
 assert.strictEqual(f2.find(x=>x.id==="a").registros.length,2);assert.strictEqual(f2.find(x=>x.id==="b").nome,"Beto");
 /* B ficou sem receber (aparelho dormindo) e grava com a lista velha: junta, não apaga o que A fez depois */
 B.SINC.base[K]=[al("a",{registros:[{id:"r1",tipo:"sessao",por:"B"},{id:"r2",tipo:"sessao",por:"B"}]}),al("b")];
 await B.storageFirestore.set(K,JSON.stringify([al("a",{registros:[{id:"r1",tipo:"sessao",por:"B"},{id:"r2",tipo:"sessao",por:"B"},{id:"r3",tipo:"sessao",por:"B"}]}),al("b")]));
 const f3=JSON.parse(nuvem[K].value);
 assert.strictEqual(f3.find(x=>x.id==="a").registros.length,3);assert.strictEqual(f3.find(x=>x.id==="b").nome,"Beto","edição de A não foi desfeita");
 console.log("check-sync-nuvem: ok");
})().catch(e=>{console.error(e.message||e);process.exit(1)});
