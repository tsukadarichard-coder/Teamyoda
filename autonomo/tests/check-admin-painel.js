/* Painel do administrador: segredo, limite de tentativas, números do dashboard, pendências, financeiro, contas sem conteúdo pessoal e configuração sem vazar valores.
   Rode: node tests/check-admin-painel.js */
const path = require("path"), assert = require("assert");
const fx = path.join(__dirname, "../netlify/functions/");
const store = {};
const J = (v) => JSON.parse(JSON.stringify(v));
function docRef(p) { return { id: p.split("/").pop(), async get() { const v = store[p]; return { exists: v !== undefined, id: p.split("/").pop(), data: () => J(v) }; }, async set(v) { store[p] = J(v); }, async update(v) { Object.assign(store[p], J(v)); }, collection: (c) => colRef(p + "/" + c) }; }
function colRef(p, f = []) {
  const ids = () => Object.keys(store).filter((k) => k.startsWith(p + "/") && !k.slice(p.length + 1).includes("/")).filter((k) => f.every(([c, v]) => store[k][c] === v));
  const docs = () => ids().map((k) => ({ id: k.split("/").pop(), data: () => J(store[k]) }));
  return { doc: (id) => docRef(p + "/" + id), where: (c, o, v) => colRef(p, f.concat([[c, v]])), async listDocuments() { return ids().map((k) => docRef(k)); }, async get() { const d = docs(); return { docs: d, size: d.length, forEach: (fn) => d.forEach(fn) }; } };
}
const admin = { firestore: () => ({ collection: (n) => colRef(n), collectionGroup: (n) => ({ async get() { const d = Object.keys(store).filter((k) => { const s = k.split("/"); return s.length % 2 === 0 && s[s.length - 2] === n; }).map((k) => ({ id: k.split("/").pop(), ref: { path: k }, data: () => J(store[k]) })); return { docs: d, size: d.length, forEach: (fn) => d.forEach(fn) }; } }) }) };
require.cache[require.resolve(fx + "_firebase-admin.js")] = { id: "y", filename: "y", loaded: true, exports: { admin, app: () => {} } };
process.env.ADMIN_SECRET = "segredo"; process.env.ANTHROPIC_API_KEY = "VALOR-SECRETO-XYZ"; process.env.FIREBASE_SERVICE_ACCOUNT = "{\"private_key\":\"NUNCA-VAZAR\"}";
delete process.env.WEBHOOK_EDUZZ_SECRET; delete process.env.INTERESSE_WEBHOOK_URL;
const P = require(fx + "admin-painel.js").handler;
const G = async (qs, seg, ip) => { const r = await P({ httpMethod: "GET", headers: { "x-admin-secret": seg === undefined ? "segredo" : seg, "x-nf-client-connection-ip": ip || "1.1.1.1" }, queryStringParameters: qs }); return { s: r.statusCode, raw: r.body, ...JSON.parse(r.body) }; };
const hoje = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
const mais = (n) => { const d = new Date(hoje + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const ano = +hoje.slice(0, 4);
(async () => {
  assert.strictEqual((await P({ httpMethod: "POST", headers: {} })).statusCode, 405);
  assert.strictEqual((await G({ secao: "ping" }, "")).s, 401); assert.strictEqual((await G({ secao: "ping" }, "errado")).s, 401);
  assert.strictEqual((await G({ secao: "ping" })).s, 200);
  for (let i = 0; i < 15; i++) await G({ secao: "ping" }, "errado", "7.7.7.7");
  assert.strictEqual((await G({ secao: "ping" }, "errado", "7.7.7.7")).s, 429, "limite de tentativas erradas por conexão");
  assert.strictEqual((await G({ secao: "ping" }, "segredo", "7.7.7.7")).s, 200, "o segredo certo continua entrando");

  store["jogadores/u1"] = { nome: "Ana Souza", email: "ana@exemplo.com", criadoEm: hoje + "T09:00:00.000Z", competicao: { papel: "atleta", nascimento: (ano - 14) + "-01-01", ativadoEm: hoje + "T09:05:00.000Z", rotina: { dias: ["seg"] } }, assinatura: { status: "ativa", nome: "Pro", ativoAte: mais(5) }, ficha: { nivel: "x" } };
  store["jogadores/u2"] = { nome: "Carlos Lima", email: "carlos@exemplo.com", criadoEm: mais(-20) + "T09:00:00.000Z", competicao: { papel: "treinador", ativadoEm: mais(-20) + "T09:00:00.000Z" } };
  store["jogadores/u3"] = { nome: "Maria Souza", email: "maria@exemplo.com", criadoEm: mais(-3) + "T09:00:00.000Z", competicao: { papel: "responsavel", ativadoEm: mais(-3) + "T09:00:00.000Z" } };
  store["jogadores/u4"] = { nome: "Só Player", email: "player@exemplo.com", criadoEm: mais(-40) + "T09:00:00.000Z", ficha: { nivel: "y" } };
  store["jogadores/u1/diario/d1"] = { texto: "SEGREDO DO DIÁRIO", data: hoje }; store["jogadores/u1/torneios/t1"] = { nome: "Copa X" }; store["jogadores/u1/partidas/p1"] = { adversario: "ADVERSARIO-PRIVADO" }; store["jogadores/u1/compPlanejamentos/v1"] = { versao: 1 };
  store["vinculos/v1"] = { atletaUid: "u1", atletaNome: "Ana Souza", pessoaUid: "u2", pessoaNome: "Carlos Lima", tipo: "treinador", status: "ativo", areas: ["perfil"], criadoEm: hoje };
  store["vinculos/v2"] = { atletaUid: "u1", atletaNome: "Ana Souza", pessoaUid: "u3", pessoaNome: "Maria Souza", tipo: "responsavel", status: "aguardando", areas: [], criadoEm: hoje };
  store["pedidosConsultoria/c1"] = { atletaUid: "u1", atletaNome: "Ana Souza", nome: "Revisão de estratégia", consultoriaId: "revisao-estrategia", precoCentavos: 14900, estado: "aguardando_pagamento", criadoEm: mais(-5) + "T10:00:00.000Z" };
  store["pedidosConsultoria/c2"] = { atletaUid: "u1", atletaNome: "Ana Souza", nome: "Consultoria ao vivo", consultoriaId: "consultoria-ao-vivo", precoCentavos: 29900, estado: "pago", pagoEm: mais(-7) + "T10:00:00.000Z", criadoEm: mais(-8) + "T10:00:00.000Z" };
  store["consultoriasPagamentosSemPedido/f1"] = { consultoriaId: "analise-completa", email: "x@y.com", faturaId: "f1", recebidoEm: hoje, motivo: "sem pedido" };
  store["acompanhamentos/a1"] = { atletaUid: "u1", atletaNome: "Ana Souza", estado: "ativo", criadoEm: mais(-10) + "T10:00:00.000Z", inicio: mais(-6), fim: mais(80), parcelas: [{ n: 1, valorCentavos: 79000, estado: "pago", pagoEm: mais(-9) + "T10:00:00.000Z" }, { n: 2, valorCentavos: 79000, estado: "pendente" }, { n: 3, valorCentavos: 79000, estado: "pendente" }], encontros: [{ n: 1, estado: "agendado", data: mais(2), hora: "19:00", rotulo: "Avaliação inicial" }] };
  store["acompanhamentos/a1/duvidas/q1"] = { autorPapel: "atleta", autorNome: "Ana", texto: "Posso?", em: mais(-6) + "T10:00:00.000Z" };
  store["acompanhamentos/a2"] = { atletaUid: "u4", atletaNome: "Outro Atleta", estado: "aguardando_inicio", criadoEm: mais(-2) + "T10:00:00.000Z", parcelas: [{ n: 1, valorCentavos: 79000, estado: "pago", pagoEm: hoje + "T10:00:00.000Z" }, { n: 2, valorCentavos: 79000, estado: "pendente" }, { n: 3, valorCentavos: 79000, estado: "pendente" }] };
  store["interessesCompeticao/i1"] = { nome: "Contato Novo", email: "c@x.com", telefone: "11999999999", servico: "acompanhamento", status: "novo", criadoEm: hoje + "T08:00:00.000Z" };
  store["orgs/academia1"] = {}; store["orgs/academia1/meta/info"] = { nome: "Academia 1", plano: "essencial", planoAtivoAte: mais(-2), criadoEm: mais(-100) }; store["orgs/academia1/dados/mty:alunos:v2"] = { value: JSON.stringify([{ id: 1 }, { id: 2 }, { id: 3 }]) };
  store["orgs/academia1/solicitacoes/s1"] = { status: "pendente", nome: "Treinador novo" }; store["orgs/academia1/solicitacoes/s2"] = { status: "aprovada", nome: "Coord" };
  store["jogadoresFaturas/ft1"] = { estado: "paga", email: "ana@exemplo.com", produtoId: "p1", dias: 30, atualizadoEm: hoje };

  const r = await G({ secao: "resumo" }); assert.strictEqual(r.s, 200, r.raw);
  assert.strictEqual(r.player.contas, 4); assert.strictEqual(r.player.novas7, 2); assert.strictEqual(r.player.comFicha, 2); assert.strictEqual(r.player.assinaturasAtivas, 1); assert.strictEqual(r.player.venceEm7, 1);
  assert.deepStrictEqual(r.competicao.papeis, { atleta: 1, responsavel: 1, treinador: 1 }); assert.strictEqual(r.competicao.menores, 1); assert.strictEqual(r.competicao.vinculos.ativos, 1); assert.strictEqual(r.competicao.vinculos.aguardando, 1);
  assert.strictEqual(r.competicao.registros.torneios, 1); assert.strictEqual(r.competicao.registros.diario, 1);
  assert.strictEqual(r.consultorias.total, 2); assert.strictEqual(r.consultorias.receitaConfirmadaCentavos, 29900); assert.strictEqual(r.consultorias.aReceberCentavos, 14900);
  assert.strictEqual(r.acompanhamentos.ativos, 1); assert.strictEqual(r.acompanhamentos.recebidoCentavos, 158000); assert.strictEqual(r.acompanhamentos.aReceberCentavos, 79000 * 4, "parcelas pendentes de ciclos em andamento");
  assert.strictEqual(r.acompanhamentos.duvidasSemResposta, 1); assert.strictEqual(r.acompanhamentos.duvidasAtrasadas, 1); assert.strictEqual(r.acompanhamentos.encontrosProximos.length, 1);
  assert.strictEqual(r.contatos.novos, 1); assert.strictEqual(r.academias.total, 1); assert.strictEqual(r.academias.alunos, 3); assert.strictEqual(r.academias.vencidas, 1); assert.strictEqual(r.academias.pendentes, 1);
  assert.strictEqual(r.financeiro.confirmadoCentavos, 29900 + 158000); assert.strictEqual(r.financeiro.porMes.length, 6); assert.strictEqual(r.player.seriesNovas.length, 8);
  const titulos = r.precisaDeVoce.map((x) => x.titulo).join(" | ");
  for (const t of [/Consultorias aguardando pagamento/, /pagas sem entrega/, /Eduzz sem pedido/, /pagos aguardando início/, /fora do prazo/, /Contatos novos/, /licença vencida/, /aguardando aprovação/]) assert.ok(t.test(titulos), String(t) + " em " + titulos);
  assert.strictEqual(r.precisaDeVoce[0].nivel, "alto", "mais urgentes primeiro"); assert.ok(r.atividade.length > 3 && r.atividade[0].em >= r.atividade[1].em);
  assert.ok(!r.raw.includes("SEGREDO DO DIÁRIO") && !r.raw.includes("ADVERSARIO-PRIVADO"), "nada de conteúdo pessoal no resumo");

  const pg = await G({ secao: "pagamentos" }); assert.strictEqual(pg.s, 200);
  assert.ok(pg.faturas[0].email.includes("***") && !pg.raw.includes("ana@exemplo.com"), "e-mail mascarado"); assert.strictEqual(pg.semPedido.length, 1); assert.ok(pg.recebimentos.some((x) => x.origem === "Acompanhamento MTY") && pg.recebimentos.some((x) => x.origem === "Consultoria"));
  const us = await G({ secao: "usuarios", q: "souza" }); assert.strictEqual(us.total, 2); assert.ok(us.usuarios.every((u) => /souza/i.test(u.nome)));
  assert.strictEqual((await G({ secao: "usuarios", papel: "player" })).total, 1, "só Player"); assert.strictEqual((await G({ secao: "usuarios", papel: "treinador" })).total, 1);
  const u = await G({ secao: "usuario", uid: "u1" }); assert.strictEqual(u.s, 200); assert.strictEqual(u.contagens.diario, 1); assert.strictEqual(u.contagens.torneios, 1); assert.strictEqual(u.vinculos.length, 2); assert.strictEqual(u.pedidos.length, 2); assert.strictEqual(u.competicao.menor, true);
  assert.ok(!u.raw.includes("SEGREDO DO DIÁRIO") && !u.raw.includes("ADVERSARIO-PRIVADO") && !JSON.stringify(u).includes("nascimento"), "conta: só contagens, sem conteúdo nem data de nascimento");
  assert.strictEqual((await G({ secao: "usuario", uid: "naoexiste1" })).s, 404); assert.strictEqual((await G({ secao: "usuario", uid: "../x" })).s, 404);
  const ac = await G({ secao: "academias" }); assert.strictEqual(ac.academias[0].alunos, 3); assert.strictEqual(ac.academias[0].pendentes, 1); assert.strictEqual(ac.academias[0].equipe, 1); assert.strictEqual(ac.academias[0].vencida, true);
  const sis = await G({ secao: "sistema" }); assert.strictEqual(sis.s, 200); assert.ok(!sis.raw.includes("VALOR-SECRETO-XYZ") && !sis.raw.includes("NUNCA-VAZAR"), "configuração nunca devolve valores");
  assert.strictEqual(sis.itens.find((i) => i.chave === "ANTHROPIC_API_KEY").ok, true); assert.strictEqual(sis.itens.find((i) => i.chave === "WEBHOOK_EDUZZ_SECRET").ok, false);
  store["webhooksEduzzProcessados/f9|myeduzz.invoice_paid"] = { evento: "myeduzz.invoice_paid", email: "ana@exemplo.com", processadoEm: hoje + "T10:00:00.000Z" };
  store["webhooksEduzzProcessados/f9|myeduzz.invoice_refunded"] = { evento: "myeduzz.invoice_refunded", email: "ana@exemplo.com", processadoEm: hoje + "T11:00:00.000Z" };
  store["webhooksEduzzProcessados/c9|myeduzz.invoice_paid"] = { evento: "myeduzz.invoice_paid", email: "x@y.com", processadoEm: mais(-40) + "T11:00:00.000Z", tipo: "consultoria" };
  store["financeiroLancamentos/l1aaaaaa"] = { tipo: "despesa", data: hoje, valorCentavos: 5000, categoria: "ferramentas", produto: "geral", descricao: "Hospedagem" };
  store["financeiroLancamentos/l2aaaaaa"] = { tipo: "receita", data: hoje, valorCentavos: 12000, categoria: "eduzz", produto: "player", descricao: "Vendas Eduzz do mês" };

  const en = await G({ secao: "entradas", dias: "365" }); assert.strictEqual(en.s, 200);
  assert.ok(en.eventos.some((e) => e.tipo === "conta" && /Ana Souza/.test(e.texto)) && en.eventos.some((e) => e.tipo === "vinculo") && en.eventos.some((e) => e.tipo === "pedido") && en.eventos.some((e) => e.tipo === "academia"), "linha do tempo reúne contas, vínculos, pedidos e academias");
  assert.strictEqual(en.resumo.hoje, 1); assert.strictEqual(en.resumo.total, 4); assert.ok(en.serieContas.length === 12);
  assert.ok(!en.raw.includes("ana@exemplo.com") && !en.raw.includes("SEGREDO DO DIÁRIO"), "entradas: e-mail mascarado e sem conteúdo pessoal");
  assert.ok((await G({ secao: "entradas", dias: "90", tipo: "pedido" })).eventos.every((e) => e.tipo === "pedido"), "filtro por tipo");
  assert.strictEqual((await G({ secao: "entradas", dias: "1" })).eventos.some((e) => e.tipo === "conta" && /Só Player/.test(e.texto)), false, "janela de dias");

  const ez = await G({ secao: "eduzz" }); assert.strictEqual(ez.s, 200);
  assert.strictEqual(ez.total, 3); assert.strictEqual(ez.ultimos30, 2); assert.ok(ez.porEvento.some((e) => e.rotulo === "Reembolso" && e.n === 1));
  assert.strictEqual(ez.porMes[ez.porMes.length - 1].pago, 1); assert.strictEqual(ez.porMes[ez.porMes.length - 1].reembolso, 1);
  assert.strictEqual(ez.semPedido.length, 1); assert.ok(ez.academias.length >= 0 && /não traz valores/.test(ez.avisoValores)); assert.ok(!ez.raw.includes("ana@exemplo.com"), "eduzz: e-mail mascarado");

  const fi = await G({ secao: "financeiro" }); assert.strictEqual(fi.s, 200);
  assert.strictEqual(fi.linhas.length, 12); assert.strictEqual(fi.mesAtual.despesa, 5000);
  assert.ok(fi.mesAtual.receita >= 12000, "receita manual entra"); assert.strictEqual(fi.mesAtual.resultado, fi.mesAtual.receita - 5000);
  assert.ok(fi.porProduto.some((p) => p.produto === "player" && p.receita === 12000) && fi.despesasPorCategoria[0].valorCentavos === 5000);
  assert.ok(fi.movimentos.some((m) => m.automatico) && fi.movimentos.some((m) => !m.automatico), "automáticos e manuais juntos");
  assert.ok(fi.aReceberCentavos > 0);

  /* ── análise: funis, atividade, uso, IA, planos, site ── */
  const iso = (n) => mais(n) + "T10:00:00.000Z";
  store["jogadores/u4"].ficha = { nivel: "x" }; // ficha parcial: só conta como "com ficha" na regra simples do teste
  store["jogadores/u5"] = { nome: "Nova Sem Ficha", email: "n@x.com", criadoEm: iso(-10) };
  store["jogadores/u6"] = { nome: "Assinante", email: "s@x.com", criadoEm: iso(-30), assinatura: { status: "ativa", ativoAte: mais(5) } };
  store["jogadores/u6/planos/pa1"] = { status: "pronto", criadoEm: iso(-20) }; store["jogadores/u6/planos/pa2"] = { status: "pronto", criadoEm: iso(-2) };
  store["jogadores/u6/planejamentos/pl1"] = { status: "pronto", criadoEm: iso(-15), registros: { a: { status: "feito", em: iso(-14) }, b: { status: "feito", em: iso(-3) }, c: { status: "em_andamento", em: iso(-1) } } };
  store["jogadores/u5/planos/pe1"] = { status: "erro", semCota: true, criadoEm: iso(-1) };
  store["jogadores/u4/planos/pe2"] = { status: "erro", erro: "falhou", criadoEm: iso(-2) }; store["jogadores/u4/planos/pe3"] = { status: "erro", erro: "falhou", criadoEm: iso(-3) }; store["jogadores/u4/planos/pe4"] = { status: "erro", erro: "falhou", criadoEm: iso(-4) };
  store["jogadores/u4/planos/pg1"] = { status: "gerando", criadoEm: new Date(Date.now() - 3600000).toISOString() };
  store["jogadores/u1/torneios/tf1"] = { nome: "Copa", inicio: mais(20), fim: mais(23), prioridade: "A", criadoEm: iso(-5) };
  store["jogadores/u1/compPlanejamentos/cp1"] = { status: "sugestao", criadoEm: iso(-1) };
  store["interessesCompeticao/i2"] = { nome: "Ana", servico: "revisao", faixa: "13-14", categoria: "regional", status: "contatado", criadoEm: iso(-5), atualizadoEm: iso(-4) };
  const an = await G({ secao: "analise" }); assert.strictEqual(an.s, 200);
  assert.ok(an.funilPlayer[0].n >= 3 && an.funilPlayer.every((p) => p.pctContas === null || (p.pctContas >= 0 && p.pctContas <= 100)), "funil do Player: percentuais sobre as contas");
  assert.ok(an.funilPlayer.every((p) => p.pctAnterior === null || p.pctAnterior <= 100), "percentual do passo anterior nunca passa de 100");
  assert.strictEqual(an.funilPlayer.find((p) => p.rotulo === "Plano de jogo criado").n, 1, "só u6 tem plano pronto entre as contas do Player");
  assert.strictEqual(an.funilPlayer.find((p) => p.rotulo === "Registrou em outra semana").n, 1, "u6 registrou treino com mais de 7 dias de diferença");
  assert.strictEqual(an.funilPlayer.find((p) => p.rotulo === "Assinante").n, 1);
  assert.strictEqual(an.funilCompeticao.find((p) => p.rotulo === "Torneio cadastrado").n, 1); assert.strictEqual(an.funilCompeticao.find((p) => p.rotulo === "Planejamento gerado").n, 1);
  assert.ok(an.atividade.ativos30 >= 3 && an.atividade.ativos7 >= 1 && an.atividade.serie.length === 8);
  const planosUso = an.uso.find((u) => u.rotulo.startsWith("Planos de jogo")); assert.strictEqual(planosUso.total, 7); assert.strictEqual(planosUso.ult7, 6);
  const iaP = an.ia[0]; assert.strictEqual(iaP.semCota, 1); assert.strictEqual(iaP.erro, 3); assert.strictEqual(iaP.travados, 1); assert.strictEqual(iaP.contasSemCota, 1); assert.ok(iaP.taxaErroPct >= 10);
  assert.ok(an.planos.assinantes >= 1 && an.planos.assinantes === an.planos.porStatus.ativa, "assinantes = contas com assinatura ativa"); assert.ok(an.planos.vencemEm7 >= 1); assert.strictEqual(an.competicao.comTorneioFuturo, 1); assert.strictEqual(an.competicao.torneios30, 1);
  assert.strictEqual(an.site.medianaHorasAteContato, 24); assert.ok(an.site.porServico.length >= 1);
  assert.ok(an.atencao.some((a) => /sem a ficha completa/.test(a.texto)) && an.atencao.some((a) => /parada\(s\)/.test(a.texto)) && an.atencao.some((a) => /bateram no limite/.test(a.texto)) && an.atencao.some((a) => /Planos de jogo com erro/.test(a.texto)), "pontos de atenção");
  assert.ok(!an.raw.includes("Nova Sem Ficha") && !an.raw.includes("n@x.com") && !an.raw.includes("ana@exemplo.com") && !an.raw.includes("SEGREDO DO DIÁRIO"), "análise: só contagens, sem nome, e-mail ou conteúdo");
  assert.strictEqual((await G({ secao: "nada" })).s, 400);
  console.log("check-admin-painel: ok");
})().catch((e) => { console.error(e); process.exit(1); });
