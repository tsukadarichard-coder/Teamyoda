/* O link do jogador de turma mostra o plano da TURMA (ele não tem plano individual). Roda a function real ver-aluno com um Firestore de mentira. */
const assert=require("assert"),path=require("path");
const dados={};
const docRef=(k)=>({get:async()=>({exists:k in dados,data:()=>dados[k]}),set:async(v)=>{dados[k]=v}});
const fakeAdmin={firestore:()=>({collection:()=>({doc:()=>({collection:()=>({doc:docRef})})})})};
const modPath=path.join(__dirname,"../../netlify/functions/_firebase-admin.js");
require.cache[require.resolve(modPath)]={id:modPath,filename:modPath,loaded:true,exports:{admin:fakeAdmin,app:()=>{}}};
const {handler}=require("../../netlify/functions/ver-aluno.js");
const plano=(aprovado)=>({aprovado,tipo:"ciclo",blocos:[{nome:"B1",semanasLista:[{n:1,foco:"Saque",aulas:[{t:"Aula 1",ex:["x"]},{t:"Aula 2",ex:["y"]}]}]}]});
const get=async(id)=>JSON.parse((await handler({httpMethod:"GET",queryStringParameters:{org:"o",id,t:"tok"}})).body);
(async()=>{
 const base=[{id:"a1",nome:"Nicolas",linkToken:"tok",horarios:[]},{id:"a2",nome:"Solo",linkToken:"tok",plano:plano(true),regPlano:{},horarios:[]}];
 dados["mty:alunos:v2"]={value:JSON.stringify(base)};
 dados["mty:turmas:v1"]={value:JSON.stringify([{id:"t1",nome:"Turma",membros:["a1"],plano:plano(true),regPlano:{},horarios:[{dia:2,hora:"10:00"}]}])};
 let d=await get("a1");
 assert.strictEqual(d.temPlano,true,"jogador de turma vê o plano da turma");assert.strictEqual(d.totalAulas,2);assert.strictEqual(d.planoDaTurma.nome,"Turma","o link diz que é o plano da turma");assert.strictEqual(d.horarios.length,1);
 dados["mty:turmas:v1"]={value:JSON.stringify([{id:"t1",nome:"Turma",membros:["a1"],plano:plano(false),horarios:[]}])};
 d=await get("a1");assert.strictEqual(d.temPlano,false);assert.strictEqual(d.planoRascunho,true,"plano da turma ainda em rascunho não aparece");
 dados["mty:turmas:v1"]={value:JSON.stringify([{id:"t1",nome:"Turma",membros:["a1"],plano:plano(true),regPlano:{},horarios:[{dia:2,hora:"10:00"}]}])};
 const r=await handler({httpMethod:"POST",body:JSON.stringify({org:"o",id:"a1",t:"tok",acao:"cancelar"})});
 assert.strictEqual(r.statusCode,400);assert(/fale direto com o seu treinador/i.test(JSON.parse(r.body).erro),"cancelar não é mais pelo link do aluno");
 const r2=await handler({httpMethod:"POST",body:JSON.stringify({org:"o",id:"a2",t:"tok",acao:"reagendar",diaPreferido:2,horaPreferido:"10:00"})});
 assert.strictEqual(r2.statusCode,400,"remarcar também não");
 assert.deepStrictEqual(JSON.parse(dados["mty:alunos:v2"].value)[1].pedidosReposicao,undefined,"nada gravado");
 console.log("check-ver-aluno-turma: ok");
})().catch(e=>{console.error(e.message||e);process.exit(1)});
