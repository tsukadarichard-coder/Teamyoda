const assert=require("assert");const {mesclar}=require("../../mty/sync-listas.js");
const a=(id,extra={})=>({id,nome:id,registros:[],...extra});
/* o professor B registrou uma sessão; A (desatualizado) edita outro aluno e grava: nada se perde */
const base=[a("x"),a("y")];
const nuvem=[a("x",{registros:[{id:"r1",tipo:"sessao"}]}),a("y")];
const local=[a("x"),a("y",{nome:"Yago"})];
let m=mesclar(base,local,nuvem);
assert.strictEqual(m.find(z=>z.id==="x").registros.length,1,"sessão do outro professor preservada");
assert.strictEqual(m.find(z=>z.id==="y").nome,"Yago","edição local preservada");
/* os dois registraram no mesmo aluno: soma */
m=mesclar(base,[a("x",{registros:[{id:"r2"}]}),a("y")],nuvem);
assert.deepStrictEqual(m.find(z=>z.id==="x").registros.map(r=>r.id).sort(),["r1","r2"]);
/* aluno novo de cada lado */
m=mesclar(base,[...base,a("n1")],[...base,a("n2")]);
assert.deepStrictEqual(m.map(z=>z.id).sort(),["n1","n2","x","y"]);
/* remoção só vale se o outro lado não mexeu */
m=mesclar(base,[a("x")],base);assert.deepStrictEqual(m.map(z=>z.id),["x"],"removido aqui, intacto lá");
m=mesclar(base,[a("x")],[a("x"),a("y",{nome:"Yan"})]);assert(m.some(z=>z.id==="y"&&z.nome==="Yan"),"removido aqui, editado lá: fica");
/* campo solto mudado nos dois: vale o local; mudado só na nuvem: vale a nuvem */
m=mesclar(base,[a("x",{nome:"L"}),a("y")],[a("x",{nome:"N"}),a("y",{nome:"N2"})]);
assert.strictEqual(m[0].nome,"L");assert.strictEqual(m[1].nome,"N2");
/* sem base (primeira gravação): une sem perder */
m=mesclar([],[a("x")],[a("y")]);assert.strictEqual(m.length,2);
/* histórico (listas sem id) soma sem repetir */
m=mesclar([a("x",{historico:[["a"]]})],[a("x",{historico:[["a"],["l"]]})],[a("x",{historico:[["a"],["n"]]})]);
assert.deepStrictEqual(m[0].historico,[["a"],["n"],["l"]]);
console.log("check-sync-listas: ok");
