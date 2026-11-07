/* Migração para o Financeiro (netlify/functions/_financeiro-importar.js e a ação "importar"/"marcar" de financeiro.js):
   lê a planilha-modelo, casa alunos/turmas/professores pelo nome, não apaga nada, simula antes de gravar e a parte
   administrativa só vê o que cobrar e pagar. Rode: node tests/check-financeiro-importar.js */
const assert = require("assert"), path = require("path"), Module = require("module");
const IMP = require(path.join(__dirname, "../../netlify/functions/_financeiro-importar.js"));

/* ── utilitários ── */
assert.strictEqual(IMP.dinheiro("R$ 1.234,56"), 1234.56);
assert.strictEqual(IMP.dinheiro("450"), 450);
assert.strictEqual(IMP.dinheiro("1.200"), 1200);
assert.strictEqual(IMP.dinheiro(520), 520);
assert.strictEqual(IMP.dinheiro("abc"), null);
assert.strictEqual(IMP.mesISO("10/2026"), "2026-10");
assert.strictEqual(IMP.mesISO("2026-10-01"), "2026-10");
assert.strictEqual(IMP.mesISO("out/2026"), "2026-10");
assert.strictEqual(IMP.dataISO("12/03/2012"), "2012-03-12");
assert.strictEqual(IMP.diaVencimento("10"), 10);
assert.strictEqual(IMP.diaVencimento("2026-11-05"), 5);
assert.strictEqual(IMP.formaPagamento("Recorrente no Let's Play"), "letsplay");
assert.strictEqual(IMP.formaPagamento("PIX"), "pix");
assert.deepStrictEqual(IMP.horarios("Seg e Qua 18:00"), [{ dia: 1, hora: "18:00" }, { dia: 3, hora: "18:00" }]);
assert.deepStrictEqual(IMP.horarios("ter 19h, qui 19h30"), [{ dia: 2, hora: "19:00" }, { dia: 4, hora: "19:30" }]);
assert.deepStrictEqual(IMP.orgsDaUnidade("39 Ranch"), ["39-ranch"]);

/* ── planilha como o navegador manda: nome da aba → linhas { cabeçalho: valor } (linha de exemplo incluída) ── */
const abas = {
  "Leia primeiro": [{ x: "ignorar" }],
  Alunos: [
    { "Nome completo do aluno *": "Ana Souza Lima", "Responsável (nome)": "Carla Souza", "Unidade *": "Team Yoda" }, // exemplo: sai
    { "Nome completo do aluno *": "Bia Rocha", "Data de nascimento": "2013-05-02", "Responsável (nome)": "Rita Rocha", "WhatsApp do responsável": "(11) 97777-6666",
      "Unidade *": "Team Yoda", "Professor principal": "Leo", "Turma(s) (nome igual à aba Turmas; separe por ;)": "Sub-12; Competição", "Situação *": "Ativo" },
    { "Nome completo do aluno *": "Ana Souza", "WhatsApp do responsável": "(11) 95555-4444", "Unidade *": "Team Yoda", "Situação *": "Ativo" }, // casa com "Ana Souza Pereira"
    { "Nome completo do aluno *": "Caio Saiu", "Unidade *": "Team Yoda", "Situação *": "Saiu" },
    { "Nome completo do aluno *": "Duda Ranch", "Unidade *": "39 Ranch", "Situação *": "Ativo" },
  ],
  Turmas: [
    { "Nome da turma *": "Sub-12", "Unidade *": "Team Yoda", "Professor *": "Leo Martins", "Dias e horários": "Ter e Qui 17h", "Mensalidade por aluno (R$) *": 500 },
    { "Nome da turma *": "Competição", "Unidade *": "Team Yoda", "Professor *": "Leo", "Dias e horários": "Seg 18:00, Qua 19:30", "Duração da aula": "2h", "Mensalidade por aluno (R$) *": "R$ 800,00" },
  ],
  "Cobrança": [
    { "Nome do aluno *": "Bia Rocha", "O que paga *": "Turma", "Turma (se for turma)": "Sub-12", "Valor cheio (R$) *": 500, "Desconto (%)": 10, "Valor que paga por mês (R$) *": 450, "Dia do vencimento": 10, "Forma de pagamento": "Pix", "Quem paga (nome)": "Rita Rocha" },
    { "Nome do aluno *": "Bia Rocha", "O que paga *": "Turma", "Turma (se for turma)": "Competição", "Valor cheio (R$) *": 800, "Valor que paga por mês (R$) *": 700, "Dia do vencimento": 10 },
    { "Nome do aluno *": "Ana Souza", "O que paga *": "Pacote individual", "Valor que paga por mês (R$) *": 600, "Dia do vencimento": 5, "Forma de pagamento": "Cartão recorrente" },
    { "Nome do aluno *": "Novo da Cobranca", "O que paga *": "Outro", "Valor que paga por mês (R$) *": 100 },
  ],
  "Em aberto": [
    { "Nome do aluno *": "Bia Rocha", "Mês de referência *": "10/2026", "Valor (R$) *": 450, "Vencimento": "10/10/2026", "Situação *": "Atrasado" },
    { "Nome do aluno *": "Bia Rocha", "Mês de referência *": "09/2026", "Valor (R$) *": 450, "Situação *": "Pago" },
    { "Nome do aluno *": "Ana Souza", "Mês de referência *": "11/2026", "Valor (R$) *": 600, "Situação *": "Pago" },
  ],
  Professores: [
    { "Nome do professor *": "Leo", "E-mail que usa no app": "leo@x.com", "Unidade": "Team Yoda", "Forma de pagamento *": "Por aula", "Valor por aula individual (R$)": 90, "Valor por aula de turma (R$)": 120 },
    { "Nome do professor *": "Marta Fixa", "Forma de pagamento *": "Fixo", "Valor fixo mensal (R$)": 3000 },
  ],
  "Despesas fixas": [
    { "Despesa *": "Aluguel das quadras", "Unidade": "Team Yoda", "Categoria *": "Aluguel", "Valor mensal (R$) *": 6000, "Observações": "Contrato com o clube" }, // exemplo: sai
    { "Despesa *": "Aluguel do clube", "Unidade": "Team Yoda", "Categoria *": "Aluguel", "Valor mensal (R$) *": "7.500" },
  ],
};
const estado = {
  "team-yoda": { alunos: [{ id: "a1", nome: "Ana Souza Pereira", telefoneResponsavel: "", registros: [] }], turmas: [{ id: "t1", nome: "Sub 12", membros: ["a1"], professorUid: "", horarios: [] }],
    professores: [{ uid: "p1", nome: "Leo Martins", email: "leo@x.com" }], config: { despesas: [{ id: "d0", nome: "Luz", categoria: "outros", valor: 300 }] } },
  "39-ranch": { alunos: [], turmas: [], professores: [], config: {} },
};
const antes = JSON.stringify(estado);
const planilha = IMP.lerPlanilha(abas);
assert.strictEqual(planilha.alunos.length, 4, "linha de exemplo da aba Alunos não entra");
assert.strictEqual(planilha.despesas.length, 1, "linha de exemplo da aba Despesas não entra");
let n = 0;
const plano = IMP.planejar(planilha, estado, { inicio: "2026-11", id: (p) => p + "N" + (++n) });
assert.strictEqual(JSON.stringify(estado), antes, "planejar não mexe no estado recebido");
const ty = plano.estado["team-yoda"], rc = plano.estado["39-ranch"], R = plano.relatorio["team-yoda"];

/* alunos: existente casado pelo nome parecido, novos criados, quem saiu não entra */
assert.strictEqual(ty.alunos.length, 3, "Ana existente + Bia + 'Novo da Cobranca'");
const ana = ty.alunos.find((a) => a.id === "a1"), bia = ty.alunos.find((a) => a.nome === "Bia Rocha");
assert.strictEqual(ana.nome, "Ana Souza Pereira", "nome do app não muda");
assert.strictEqual(ana.telefoneResponsavel, "(11) 95555-4444", "campo vazio é preenchido");
assert(plano.aproximados.some((x) => x.planilha === "Ana Souza" && x.app === "Ana Souza Pereira"), "casamento por nome parecido aparece no relatório");
assert.strictEqual(bia.nascimento, "2013-05-02"); assert.strictEqual(bia.nomeResponsavel, "Rita Rocha"); assert.strictEqual(bia.professorUid, "p1");
assert.strictEqual(bia.cadastroConcluido, true); assert(Array.isArray(bia.registros) && Array.isArray(bia.marcos), "aluno novo no formato da ficha");
assert(!ty.alunos.some((a) => a.nome === "Caio Saiu"), "quem saiu não é criado"); assert.strictEqual(R.alunosSaiu, 1);
assert.strictEqual(rc.alunos.length, 1, "aluno do 39 Ranch vai para o 39 Ranch");

/* turmas: "Sub-12" casa com "Sub 12"; Competição é criada com horários e professor */
assert.strictEqual(ty.turmas.length, 2);
const t1 = ty.turmas.find((t) => t.id === "t1"), comp = ty.turmas.find((t) => t.nome === "Competição");
assert.deepStrictEqual(t1.horarios, [{ dia: 2, hora: "17:00" }, { dia: 4, hora: "17:00" }]); assert.strictEqual(t1.professorUid, "p1");
assert(t1.membros.includes("a1") && t1.membros.includes(bia.id), "matrículas somadas, ninguém sai da turma");
assert.deepStrictEqual(comp.horarios, [{ dia: 1, hora: "18:00" }, { dia: 3, hora: "19:30" }]); assert.strictEqual(comp.duracaoPadrao, "2h");

/* financeiro: preço, desconto, pacote, vencimento, forma */
const C = ty.config;
assert.strictEqual(C.turmas.t1.preco, 500); assert.strictEqual(C.turmas[comp.id].preco, 800);
assert.deepStrictEqual(C.descontos["t1:" + bia.id], { tipo: "pct", valor: 10 });
assert.deepStrictEqual(C.descontos[comp.id + ":" + bia.id], { tipo: "valor", valor: 100 }, "paga menos que a turma: vira desconto em R$");
assert.strictEqual(C.pacotes.a1.preco, 600);
assert.deepStrictEqual(C.cobranca[bia.id], { venc: 10, forma: "pix", pagador: "Rita Rocha" });
assert.strictEqual(C.cobranca.a1.forma, "cartao");
assert.strictEqual(R.previstoMensal, 450 + 700 + 600);

/* em aberto: outubro (antes do controle) vira pendência; pago antigo não; novembro pago marca o recebido */
assert.strictEqual(C.pendencias.length, 1); assert.strictEqual(C.pendencias[0].mes, "2026-10"); assert.strictEqual(C.pendencias[0].valor, 450);
assert.strictEqual(C.meses["2026-11"].recebidos["p:a1"], true, "pacote pago em novembro já entra como recebido");

/* professores e despesas */
assert.deepStrictEqual(C.professores["u:p1"], { forma: "aula", individual: 90, turma: 120, fixo: 0, pct: 0 });
assert.strictEqual(C.professores["n:Marta Fixa"].fixo, 3000, "professor sem conta fica pelo nome");
assert(plano.avisos.some((a) => /Marta Fixa/.test(a)), "aviso do professor sem conta");
assert(C.despesas.some((d) => d.nome === "Luz" && d.valor === 300), "despesa que já existia continua");
assert(C.despesas.some((d) => d.nome === "Aluguel do clube" && d.valor === 7500));
assert(plano.avisos.some((a) => /tipo "outro"/.test(a)));
assert(ty.mudou.alunos && ty.mudou.turmas && ty.mudou.config);

/* importar de novo é idempotente: nada duplica */
const de2 = IMP.planejar(planilha, { "team-yoda": { alunos: ty.alunos, turmas: ty.turmas, professores: estado["team-yoda"].professores, config: ty.config }, "39-ranch": { alunos: rc.alunos, turmas: rc.turmas, professores: [], config: rc.config } }, { inicio: "2026-11" });
assert.strictEqual(de2.estado["team-yoda"].alunos.length, 3); assert.strictEqual(de2.estado["team-yoda"].turmas.length, 2);
assert.strictEqual(de2.estado["team-yoda"].config.pendencias.length, 1); assert.strictEqual(de2.relatorio["team-yoda"].alunosNovos, 0);

/* ── servidor: simular não grava; importar grava numa transação; administrativo só marca ── */
const banco = {
  "orgs/team-yoda/dados/mty:alunos:v2": { value: JSON.stringify(estado["team-yoda"].alunos) },
  "orgs/team-yoda/dados/mty:turmas:v1": { value: JSON.stringify(estado["team-yoda"].turmas) },
  "financeiro/team-yoda": { config: estado["team-yoda"].config },
};
const gravacoes = [];
const doc = (caminho) => ({ caminho, get: async () => ({ exists: !!banco[caminho], data: () => banco[caminho] }), set: async (v) => { banco[caminho] = v; gravacoes.push(caminho); }, collection: (c) => col(caminho + "/" + c) });
const col = (caminho) => ({ doc: (d) => doc(caminho + "/" + d), where: () => ({ get: async () => (caminho.startsWith("orgs/team-yoda") ? [{ id: "p1", data: () => ({ nome: "Leo Martins", email: "leo@x.com" }) }] : []) }) });
const adminFalso = {
  apps: [1], app: () => {},
  auth: () => ({ verifyIdToken: async (t) => ({ dono: { email: "tsukada.richard@gmail.com" }, adm: { email: "Adm@x.com" }, coord: { email: "coord@x.com" } })[t] || Promise.reject(new Error("x")) }),
  firestore: () => ({ collection: (c) => col(c), runTransaction: async (fn) => { const pend = []; await fn({ get: (r) => r.get(), set: (r, v) => pend.push([r, v]) }); for (const [r, v] of pend) await r.set(v); } }),
};
const carregar = Module._load;
Module._load = function (pedido) { if (/_firebase-admin$/.test(pedido)) return { admin: adminFalso, app: () => {} }; return carregar.apply(this, arguments); };
const fn = require(path.join(__dirname, "../../netlify/functions/financeiro.js"));
const chamar = (metodo, token, extra) => fn.handler(Object.assign({ httpMethod: metodo, headers: token ? { authorization: "Bearer " + token } : {}, queryStringParameters: {} }, extra))
  .then((r) => ({ status: r.statusCode, corpo: JSON.parse(r.body) }));
const post = (token, corpo) => chamar("POST", token, { body: JSON.stringify(corpo) });

(async () => {
  assert.strictEqual((await chamar("GET", "coord", { queryStringParameters: { quem: "1" } })).corpo.papel, null, "coordenador sem papel");
  assert.strictEqual((await chamar("GET", "dono", { queryStringParameters: { quem: "1" } })).corpo.papel, "dono");
  assert.strictEqual((await post("adm", { acao: "importar", planilha: { abas } })).status, 403, "sem acesso cadastrado, o administrativo não entra");
  assert.strictEqual((await post("coord", { acao: "acesso", admins: ["coord@x.com"] })).status, 403, "só o dono cadastra acesso");
  const ac = await post("dono", { acao: "acesso", admins: ["adm@x.com", "lixo", "tsukada.richard@gmail.com"] });
  assert.deepStrictEqual(ac.corpo.admins, ["adm@x.com"], "e-mail inválido e o próprio dono saem da lista");
  assert.strictEqual((await chamar("GET", "adm", { queryStringParameters: { quem: "1" } })).corpo.papel, "admin");

  /* simular: relatório sem gravar nada */
  const sim = await post("dono", { acao: "importar", planilha: { abas }, simular: true });
  assert.strictEqual(sim.status, 200); assert.strictEqual(sim.corpo.simulado, true);
  assert.strictEqual(sim.corpo.relatorio["team-yoda"].alunosNovos, 2); assert(!gravacoes.some((g) => /dados|financeiro\/team/.test(g)), "simular não grava");
  assert.strictEqual((await post("adm", { acao: "importar", planilha: { abas }, simular: false })).status, 403, "administrativo não importa");

  /* importar de verdade */
  const imp = await post("dono", { acao: "importar", planilha: { abas }, simular: false });
  assert.strictEqual(imp.status, 200); assert.strictEqual(imp.corpo.simulado, false);
  const alunos = JSON.parse(banco["orgs/team-yoda/dados/mty:alunos:v2"].value);
  assert.strictEqual(alunos.length, 3); assert(banco["financeiro/team-yoda"].config.cobranca, "cobrança gravada");
  assert.strictEqual(banco["financeiro/team-yoda"].config.professores["n:Marta Fixa"].fixo, 3000, "chave de professor com espaço passa na limpeza");
  const bia2 = alunos.find((a) => a.nome === "Bia Rocha");

  /* visão do administrativo: cobrar e pagar, sem resultado, margem nem despesas */
  const va = await chamar("GET", "adm", { queryStringParameters: { mes: "2026-11" } });
  assert.strictEqual(va.status, 200); assert.strictEqual(va.corpo.papel, "admin");
  const vty = va.corpo.academias.find((a) => a.org === "team-yoda");
  const txt = JSON.stringify(va.corpo);
  assert(!/resultado|margem|"despesas"|impostoPct|"config"/.test(txt), "administrativo não recebe resultado, margem, despesas nem a config");
  const linhaBia = vty.cobrar.find((l) => l.alunoId === bia2.id && l.onde === "Sub 12"); // nome da turma no app
  assert(linhaBia, "mensalidade da Bia aparece para cobrar"); assert.strictEqual(linhaBia.valor, 450); assert.strictEqual(linhaBia.venc, 10);
  assert.strictEqual(linhaBia.contato, "(11) 97777-6666"); assert.strictEqual(linhaBia.pagador, "Rita Rocha");
  assert.strictEqual(vty.pendencias.length, 1, "pendência de outubro aparece");
  assert(vty.totais.aReceber > 0);

  /* administrativo marca recebido, quita pendência e muda forma; não grava preço */
  const pid = vty.pendencias[0].id;
  const mk = await post("adm", { acao: "marcar", org: "team-yoda", mes: "2026-11", recebidos: { [linhaBia.chave]: true, "m:inventado:x": true }, pendencias: { [pid]: true }, cobranca: { [bia2.id]: { forma: "boleto" } } });
  assert.strictEqual(mk.status, 200);
  const cfg = banco["financeiro/team-yoda"].config;
  assert.strictEqual(cfg.meses["2026-11"].recebidos[linhaBia.chave], true); assert(!cfg.meses["2026-11"].recebidos["m:inventado:x"], "chave que não existe no mês não entra");
  assert.strictEqual(cfg.pendencias[0].quitada, true); assert.strictEqual(cfg.cobranca[bia2.id].forma, "boleto"); assert.strictEqual(cfg.cobranca[bia2.id].venc, 10, "o resto da cobrança fica");
  assert.strictEqual((await post("adm", { org: "team-yoda", config: { turmas: {} } })).status, 403, "administrativo não grava preços");
  assert.strictEqual(cfg.turmas.t1.preco, 500, "preço continua");

  /* dono continua vendo tudo, com a lista de acesso */
  const vd = await chamar("GET", "dono", { queryStringParameters: { mes: "2026-11" } });
  assert.strictEqual(vd.corpo.papel, "dono"); assert.deepStrictEqual(vd.corpo.acesso.admins, ["adm@x.com"]);
  const r = vd.corpo.academias.find((a) => a.org === "team-yoda").mes;
  assert.strictEqual(r.pendencias.abertas.length, 0, "pendência quitada sai da lista");
  console.log("check-financeiro-importar: ok");
})().catch((e) => { console.error(e); process.exit(1); });
