/* Painel do administrador — leitura integrada de todos os produtos QuadraLab (somente leitura).

   GET ?secao=ping                      → confere o segredo
   GET ?secao=resumo                    → números de cada produto, "precisa de você", financeiro e atividade recente
   GET ?secao=pagamentos                → faturas do Player, parcelas do Acompanhamento, consultorias e pagamentos sem pedido, receita por mês
   GET ?secao=usuarios&q=&papel=&pagina= → contas do Player/Competição (sem conteúdo pessoal)
   GET ?secao=usuario&uid=              → uma conta: papel, assinatura, vínculos, pedidos e contagens (nunca o conteúdo de diário, partidas ou planos)
   GET ?secao=academias                 → academias do app do treinador (plano, validade, jogadores, pedidos de acesso pendentes)
   GET ?secao=analise                   → funis (Player e Competição), atividade, uso dos recursos, qualidade da IA, planos, site e pontos de atenção (só contagens)
   GET ?secao=entradas&tipo=&dias=       → quem entrou e o que chegou (contas, vínculos, pedidos, contatos, academias), com série semanal
   GET ?secao=eduzz                     → relatório do webhook da Eduzz: eventos, faturas, pendências, academias (sem valores)
   GET ?secao=financeiro&mes=           → receitas confirmadas + lançamentos manuais, despesas, resultado por mês e por produto
   GET ?secao=sistema                   → conferência de configuração (só "definido / não definido", nunca os valores)

   As ações (mudar estado, confirmar pagamento, iniciar ciclo, atualizar plano) continuam nas functions admin-* de cada área.
   Segredo: cabeçalho x-admin-secret. Tentativas erradas são limitadas por conexão. */
const A = require("./_admin-auth");
const { admin, app } = require("./_firebase-admin");
const CONS = require("./_player-consultorias");
const ASS = require("./_player-assinaturas");
const AC = require("./_comp-acompanhamento");
const C = require("./_player-competicao");

function resposta(statusCode, corpo) { return { statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(corpo) }; }
const LIMITE_CONTAS = 6000;
const dia = (iso) => String(iso || "").slice(0, 10);
const addDias = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diasEntre = (a, b) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86400000);
const segundaDe = (iso) => { const d = new Date(iso + "T12:00:00Z"); return addDias(iso, -((d.getUTCDay() + 6) % 7)); };
const soma = (l, f) => l.reduce((s, x) => s + (f(x) || 0), 0);
const mascara = (e) => { const [u, d] = String(e || "").split("@"); return u && d ? u.slice(0, 2) + "***@" + d : ""; };

async function ler(col, limite) { const o = []; const s = await col.get(); s.forEach((d) => { if (o.length < (limite || 100000)) o.push({ id: d.id, ...d.data() }); }); return o; }
async function contarGrupo(db, nome) {
  try {
    const q = db.collectionGroup(nome);
    if (typeof q.count === "function") return (await q.count().get()).data().count;
    const s = await q.get(); return s.size != null ? s.size : s.docs.length;
  } catch (e) { return null; }
}
/* semanas (segunda a domingo) das últimas n, da mais antiga para a atual */
function semanas(hoje, n) { const ini = segundaDe(hoje), o = []; for (let i = n - 1; i >= 0; i--) o.push(addDias(ini, -7 * i)); return o; }
function serieSemanal(datas, hoje, n) {
  const sem = semanas(hoje, n), cont = sem.map(() => 0);
  datas.forEach((d) => { const x = dia(d); if (!x) return; const i = sem.length - 1 - Math.floor(diasEntre(x, addDias(segundaDe(hoje), 6)) / 7); if (i >= 0 && i < sem.length) cont[i]++; });
  return sem.map((s, i) => ({ semana: s, n: cont[i] }));
}
const mesDe = (iso) => String(iso || "").slice(0, 7);
function ultimosMeses(hoje, n) { const [a, m] = [+hoje.slice(0, 4), +hoje.slice(5, 7)], o = []; for (let i = n - 1; i >= 0; i--) { let mm = m - i, aa = a; while (mm < 1) { mm += 12; aa--; } o.push(aa + "-" + String(mm).padStart(2, "0")); } return o; }

async function dadosGerais(db, hoje) {
  const jogadores = await ler(db.collection("jogadores"), LIMITE_CONTAS);
  const pedidos = await ler(db.collection("pedidosConsultoria"));
  const acs = await ler(db.collection("acompanhamentos"));
  const interesses = await ler(db.collection("interessesCompeticao"));
  const vinculos = await ler(db.collection("vinculos"));
  return { jogadores, pedidos, acs, interesses, vinculos };
}

async function resumo(db, hoje) {
  const agora = new Date().toISOString(), erros = [];
  const { jogadores, pedidos, acs, interesses, vinculos } = await dadosGerais(db, hoje);
  const sem8 = (l) => serieSemanal(l, hoje, 8);
  const em = (d) => dia(d) >= addDias(hoje, -7), em30 = (d) => dia(d) >= addDias(hoje, -30);

  /* Player */
  const assin = {}; jogadores.forEach((j) => { const s = j.assinatura && j.assinatura.status ? j.assinatura.status : "sem"; assin[s] = (assin[s] || 0) + 1; });
  const venceEm7 = jogadores.filter((j) => j.assinatura && j.assinatura.status === "ativa" && j.assinatura.ativoAte && j.assinatura.ativoAte >= hoje && j.assinatura.ativoAte <= addDias(hoje, 7)).length;
  const player = {
    contas: jogadores.length, novas7: jogadores.filter((j) => em(j.criadoEm)).length, novas30: jogadores.filter((j) => em30(j.criadoEm)).length,
    comFicha: jogadores.filter((j) => j.ficha && Object.keys(j.ficha).length).length, assinaturas: assin, assinaturasAtivas: assin.ativa || 0, venceEm7,
    seriesNovas: sem8(jogadores.map((j) => j.criadoEm)), truncado: jogadores.length >= LIMITE_CONTAS,
  };
  const grupos = ["planos", "planejamentos", "partidas"], contP = {};
  for (const g of grupos) contP[g] = await contarGrupo(db, g);
  player.registros = contP;

  /* Competição */
  const papeis = { atleta: 0, responsavel: 0, treinador: 0 }; let menores = 0;
  jogadores.forEach((j) => { const c = j.competicao || {}; if (papeis[c.papel] != null) { papeis[c.papel]++; if (c.papel === "atleta" && C.ehMenor(c.nascimento, hoje)) menores++; } });
  const vinc = {}; vinculos.forEach((v) => { const k = v.tipo + ":" + v.status; vinc[k] = (vinc[k] || 0) + 1; });
  const contC = {}; for (const g of ["torneios", "preparos", "diario", "devolutivas", "compPlanejamentos", "compExecucoes", "focos", "scouts"]) contC[g] = await contarGrupo(db, g);
  const competicao = {
    contas: papeis.atleta + papeis.responsavel + papeis.treinador, papeis, menores,
    novas7: jogadores.filter((j) => j.competicao && j.competicao.papel && em(j.competicao.ativadoEm)).length,
    vinculos: { ativos: vinculos.filter((v) => v.status === "ativo").length, aguardando: vinculos.filter((v) => v.status === "aguardando").length, convites: vinculos.filter((v) => v.status === "convite").length, detalhe: vinc },
    registros: contC, seriesNovas: sem8(jogadores.filter((j) => j.competicao && j.competicao.papel).map((j) => j.competicao.ativadoEm)),
  };

  /* consultorias */
  const porEstado = {}; pedidos.forEach((p) => { porEstado[p.estado] = (porEstado[p.estado] || 0) + 1; });
  const confirmados = pedidos.filter((p) => ["pago", "em_andamento", "entregue"].includes(p.estado));
  const aReceber = pedidos.filter((p) => p.estado === "aguardando_pagamento");
  const consultorias = {
    total: pedidos.length, porEstado, receitaConfirmadaCentavos: soma(confirmados, (p) => p.precoCentavos), aReceberCentavos: soma(aReceber, (p) => p.precoCentavos),
    emAberto: pedidos.filter((p) => CONS.ABERTOS.includes(p.estado)).length, seriesNovas: sem8(pedidos.map((p) => p.criadoEm)),
    porServico: Object.entries(pedidos.reduce((m, p) => { m[p.nome] = (m[p.nome] || 0) + 1; return m; }, {})).map(([nome, n]) => ({ nome, n })).sort((a, b) => b.n - a.n),
  };

  /* acompanhamentos */
  const acEstado = {}; acs.forEach((a) => { acEstado[a.estado] = (acEstado[a.estado] || 0) + 1; });
  const parcelas = acs.flatMap((a) => (a.parcelas || []).map((p) => ({ ...p, acEstado: a.estado })));
  const abertos = acs.filter((a) => AC.ABERTOS.includes(a.estado));
  const duvidasSem = [];
  for (const a of acs.filter((x) => x.estado === "ativo")) {
    try {
      const ds = await ler(db.collection("acompanhamentos").doc(a.id).collection("duvidas"));
      ds.filter((d) => d.autorPapel !== "profissional" && !ds.some((r) => r.respondeA === d.id)).forEach((d) => duvidasSem.push({ ac: a.id, atleta: a.atletaNome, em: d.em, prazo: AC.prazoDiasUteis(d.em, 2) }));
    } catch (e) { erros.push("dúvidas"); }
  }
  const proximos = acs.flatMap((a) => (a.encontros || []).filter((e) => e.estado === "agendado" && e.data >= hoje && e.data <= addDias(hoje, 7)).map((e) => ({ ac: a.id, atleta: a.atletaNome, rotulo: e.rotulo, data: e.data, hora: e.hora })));
  const acomp = {
    total: acs.length, porEstado: acEstado, emAberto: abertos.length, ativos: acEstado.ativo || 0,
    recebidoCentavos: soma(parcelas.filter((p) => p.estado === "pago"), (p) => p.valorCentavos),
    aReceberCentavos: soma(parcelas.filter((p) => p.estado !== "pago" && ["aguardando_pagamento", "aguardando_inicio", "ativo"].includes(p.acEstado)), (p) => p.valorCentavos),
    duvidasSemResposta: duvidasSem.length, duvidasAtrasadas: duvidasSem.filter((d) => d.prazo < hoje).length, encontrosProximos: proximos.sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora)), seriesNovas: sem8(acs.map((a) => a.criadoEm)),
  };

  /* contatos da página de vendas */
  const intServ = {}; interesses.forEach((i) => { intServ[i.servico] = (intServ[i.servico] || 0) + 1; });
  const contatos = { total: interesses.length, novos: interesses.filter((i) => i.status === "novo").length, ult7: interesses.filter((i) => em(i.criadoEm)).length, porServico: intServ, seriesNovas: sem8(interesses.map((i) => i.criadoEm)) };

  /* academias (app do treinador) */
  let academias = { total: 0, alunos: 0, vencidas: 0, vencendo14: 0, pendentes: 0, porPlano: {} };
  try {
    const orgs = await db.collection("orgs").listDocuments();
    academias.total = orgs.length;
    for (const o of orgs) {
      const info = (await o.collection("meta").doc("info").get()); const i = info.exists ? info.data() : {};
      academias.porPlano[i.plano || "sem limite"] = (academias.porPlano[i.plano || "sem limite"] || 0) + 1;
      if (i.planoAtivoAte) { if (i.planoAtivoAte < hoje) academias.vencidas++; else if (i.planoAtivoAte <= addDias(hoje, 14)) academias.vencendo14++; }
      try { const d = await o.collection("dados").doc("mty:alunos:v2").get(); if (d.exists) { const l = JSON.parse(d.data().value || "[]"); if (Array.isArray(l)) academias.alunos += l.length; } } catch (e) { /* blob malformado */ }
      try { (await o.collection("solicitacoes").get()).forEach((s) => { const st = (s.data() || {}).status; if (st && !["aprovada", "recusada", "removida"].includes(st)) academias.pendentes++; }); } catch (e) { /* sem solicitações */ }
    }
  } catch (e) { erros.push("academias"); }
  let aoVivo = null;
  try { aoVivo = (await ler(db.collection("scoutsAoVivo"))).filter((s) => Date.parse(s.expiraEm) > Date.now()).length; } catch (e) { /* sem scouts ao vivo */ }

  /* sem pedido (Eduzz) */
  let semPedido = 0; try { semPedido = (await ler(db.collection("consultoriasPagamentosSemPedido"))).length; } catch (e) { /* nada */ }

  /* precisa de você */
  const pend = [];
  const velhos = aReceber.filter((p) => diasEntre(dia(p.criadoEm), hoje) >= 3);
  if (velhos.length) pend.push({ nivel: "alto", titulo: "Consultorias aguardando pagamento há 3 dias ou mais", n: velhos.length, secao: "consultorias", filtro: "aguardando_pagamento" });
  const semEntrega = pedidos.filter((p) => ["pago", "em_andamento"].includes(p.estado) && diasEntre(dia(p.pagoEm || p.criadoEm), hoje) >= 5);
  if (semEntrega.length) pend.push({ nivel: "alto", titulo: "Consultorias pagas sem entrega há 5 dias ou mais", n: semEntrega.length, secao: "consultorias", filtro: "pago" });
  if (semPedido) pend.push({ nivel: "alto", titulo: "Pagamentos da Eduzz sem pedido correspondente", n: semPedido, secao: "pagamentos" });
  const ini = acs.filter((a) => a.estado === "aguardando_inicio").length;
  if (ini) pend.push({ nivel: "alto", titulo: "Acompanhamentos pagos aguardando início do ciclo", n: ini, secao: "acompanhamentos", filtro: "aguardando_inicio" });
  const acPag = acs.filter((a) => a.estado === "aguardando_pagamento" && diasEntre(dia(a.criadoEm), hoje) >= 3).length;
  if (acPag) pend.push({ nivel: "medio", titulo: "Acompanhamentos aguardando o primeiro pagamento há 3 dias ou mais", n: acPag, secao: "acompanhamentos", filtro: "aguardando_pagamento" });
  if (acomp.duvidasAtrasadas) pend.push({ nivel: "alto", titulo: "Dúvidas do Acompanhamento fora do prazo de dois dias úteis", n: acomp.duvidasAtrasadas, secao: "acompanhamentos", filtro: "ativo" });
  if (contatos.novos) pend.push({ nivel: "medio", titulo: "Contatos novos da página de vendas", n: contatos.novos, secao: "contatos", filtro: "novo" });
  if (academias.vencidas) pend.push({ nivel: "medio", titulo: "Academias com licença vencida", n: academias.vencidas, secao: "academias" });
  if (academias.vencendo14) pend.push({ nivel: "baixo", titulo: "Academias com licença vencendo em 14 dias", n: academias.vencendo14, secao: "academias" });
  if (academias.pendentes) pend.push({ nivel: "medio", titulo: "Treinadores aguardando aprovação nas academias", n: academias.pendentes, secao: "academias" });
  if (player.venceEm7) pend.push({ nivel: "baixo", titulo: "Assinaturas do Player vencendo em 7 dias", n: player.venceEm7, secao: "pagamentos" });
  const ordem = { alto: 0, medio: 1, baixo: 2 }; pend.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);

  /* atividade recente */
  const ativ = [];
  pedidos.forEach((p) => ativ.push({ em: p.criadoEm, tipo: "Consultoria", texto: "Pedido de " + p.nome + " · " + (p.atletaNome || "atleta"), secao: "consultorias" }));
  acs.forEach((a) => ativ.push({ em: a.criadoEm, tipo: "Acompanhamento", texto: "Solicitação de " + (a.atletaNome || "atleta"), secao: "acompanhamentos" }));
  acs.forEach((a) => (a.parcelas || []).filter((p) => p.pagoEm).forEach((p) => ativ.push({ em: p.pagoEm, tipo: "Pagamento", texto: "Pagamento " + p.n + " confirmado · " + (a.atletaNome || "atleta"), secao: "acompanhamentos" })));
  interesses.forEach((i) => ativ.push({ em: i.criadoEm, tipo: "Contato", texto: i.nome + " · " + (i.servico || ""), secao: "contatos" }));
  jogadores.filter((j) => j.criadoEm).forEach((j) => ativ.push({ em: j.criadoEm, tipo: "Conta", texto: "Nova conta " + (j.competicao && j.competicao.papel ? "Competição (" + j.competicao.papel + ")" : "Player"), secao: "usuarios" }));
  ativ.sort((a, b) => String(b.em).localeCompare(String(a.em)));

  /* financeiro consolidado */
  const meses = ultimosMeses(hoje, 6), recMes = meses.map((m) => ({ mes: m, consultorias: 0, acompanhamento: 0 }));
  confirmados.forEach((p) => { const i = meses.indexOf(mesDe(p.pagoEm || p.criadoEm)); if (i >= 0) recMes[i].consultorias += p.precoCentavos || 0; });
  parcelas.filter((p) => p.estado === "pago" && p.pagoEm).forEach((p) => { const i = meses.indexOf(mesDe(p.pagoEm)); if (i >= 0) recMes[i].acompanhamento += p.valorCentavos || 0; });
  const financeiro = { confirmadoCentavos: consultorias.receitaConfirmadaCentavos + acomp.recebidoCentavos, aReceberCentavos: consultorias.aReceberCentavos + acomp.aReceberCentavos, porMes: recMes, nota: "Valores confirmados à mão no painel (consultorias e parcelas) pelo preço de cada serviço. Assinaturas do Player vêm da Eduzz e não entram nesta soma." };

  return { geradoEm: agora, hoje, player, competicao, consultorias, acompanhamentos: acomp, contatos, academias, scoutsAoVivo: aoVivo, financeiro, precisaDeVoce: pend, atividade: ativ.slice(0, 18), erros };
}

async function pagamentos(db, hoje) {
  const faturas = (await ler(db.collection("jogadoresFaturas"))).sort((a, b) => String(b.atualizadoEm || "").localeCompare(String(a.atualizadoEm || ""))).slice(0, 100)
    .map((f) => ({ id: f.id, estado: f.estado, produtoId: f.produtoId || null, email: mascara(f.email), dias: f.dias || null, atualizadoEm: f.atualizadoEm || null }));
  const pendentes = (await ler(db.collection("jogadoresAssinaturasPendentes"))).map((p) => ({ id: p.id, email: mascara(p.email), estado: p.estado, produtoId: p.produtoId || null }));
  const semPedido = (await ler(db.collection("consultoriasPagamentosSemPedido"))).map((s) => ({ id: s.id, consultoriaId: s.consultoriaId, email: s.email, faturaId: s.faturaId, recebidoEm: s.recebidoEm, motivo: s.motivo }));
  const jogadores = await ler(db.collection("jogadores"), LIMITE_CONTAS);
  const assinaturas = jogadores.filter((j) => j.assinatura && j.assinatura.status).map((j) => ({ uid: j.id, nome: j.nome || "", status: j.assinatura.status, nome_produto: j.assinatura.nome || "", ativoAte: j.assinatura.ativoAte || null })).sort((a, b) => String(a.ativoAte || "9").localeCompare(String(b.ativoAte || "9")));
  const pedidos = await ler(db.collection("pedidosConsultoria")), acs = await ler(db.collection("acompanhamentos"));
  const itens = [];
  pedidos.filter((p) => ["pago", "em_andamento", "entregue", "reembolsado"].includes(p.estado)).forEach((p) => itens.push({ origem: "Consultoria", nome: p.nome, atleta: p.atletaNome || "", valorCentavos: p.precoCentavos, estado: p.estado, em: p.pagoEm || p.criadoEm, por: p.pagoPor || "", id: p.id }));
  acs.forEach((a) => (a.parcelas || []).filter((p) => p.estado === "pago").forEach((p) => itens.push({ origem: "Acompanhamento MTY", nome: "Pagamento " + p.n + " de " + (a.parcelas || []).length, atleta: a.atletaNome || "", valorCentavos: p.valorCentavos, estado: "pago", em: p.pagoEm, por: p.confirmadoPor || "consultor", id: a.id })));
  itens.sort((a, b) => String(b.em).localeCompare(String(a.em)));
  const webhooks = await contarGrupo(db, "webhooksEduzzProcessados");
  return { faturas, pendentes, semPedido, assinaturas: assinaturas.slice(0, 200), recebimentos: itens.slice(0, 300), webhooksProcessados: webhooks, checkoutConsultoriaConfigurado: Object.keys(CONS.CHECKOUT_CONSULTORIA).filter((k) => CONS.checkoutDe(k)).length, checkoutConsultoriaTotal: Object.keys(CONS.CHECKOUT_CONSULTORIA).length, produtosPlayerCompletos: ASS.CATALOGO.filter(ASS.produtoCompleto).length };
}

async function usuarios(db, q, hoje) {
  const jogadores = await ler(db.collection("jogadores"), LIMITE_CONTAS);
  const busca = String(q.q || "").trim().toLowerCase(), papel = String(q.papel || "");
  let lista = jogadores.map((j) => ({
    uid: j.id, nome: j.nome || "", email: j.email || "", criadoEm: j.criadoEm || (j.competicao && j.competicao.ativadoEm) || null,
    papel: (j.competicao && j.competicao.papel) || "", menor: !!(j.competicao && j.competicao.papel === "atleta" && C.ehMenor(j.competicao.nascimento, hoje)),
    assinatura: (j.assinatura && j.assinatura.status) || "", comFicha: !!(j.ficha && Object.keys(j.ficha).length),
  }));
  if (papel === "player") lista = lista.filter((u) => !u.papel); else if (papel) lista = lista.filter((u) => u.papel === papel);
  if (busca) lista = lista.filter((u) => (u.nome + " " + u.email + " " + u.uid).toLowerCase().includes(busca));
  lista.sort((a, b) => String(b.criadoEm || "").localeCompare(String(a.criadoEm || "")));
  const pagina = Math.max(1, parseInt(q.pagina, 10) || 1), por = 40;
  return { total: lista.length, pagina, porPagina: por, usuarios: lista.slice((pagina - 1) * por, pagina * por) };
}

async function usuario(db, uid, hoje) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(String(uid || ""))) return null;
  const ref = db.collection("jogadores").doc(uid), s = await ref.get();
  if (!s.exists) return null;
  const j = s.data(), c = j.competicao || {};
  const cont = {}; for (const n of ["torneios", "partidas", "preparos", "diario", "devolutivas", "focos", "scouts", "compPlanejamentos", "compExecucoes", "planos", "planejamentos"]) { try { cont[n] = (await ref.collection(n).get()).docs.length; } catch (e) { cont[n] = null; } }
  const vin = []; for (const campo of ["atletaUid", "pessoaUid"]) (await db.collection("vinculos").where(campo, "==", uid).get()).forEach((d) => { const v = d.data(); vin.push({ id: d.id, lado: campo === "atletaUid" ? "como atleta" : "como " + v.tipo, tipo: v.tipo, status: v.status, outra: campo === "atletaUid" ? v.pessoaNome || "" : v.atletaNome || "", areas: v.areas || [], criadoEm: v.criadoEm }); });
  const peds = []; for (const campo of ["atletaUid", "pagadorUid"]) (await db.collection("pedidosConsultoria").where(campo, "==", uid).get()).forEach((d) => { if (!peds.some((x) => x.id === d.id)) peds.push({ id: d.id, nome: d.data().nome, estado: d.data().estado, precoCentavos: d.data().precoCentavos, criadoEm: d.data().criadoEm }); });
  const acs = []; for (const campo of ["atletaUid", "pagadorUid", "profissionalUid"]) (await db.collection("acompanhamentos").where(campo, "==", uid).get()).forEach((d) => { if (!acs.some((x) => x.id === d.id)) acs.push({ id: d.id, estado: d.data().estado, inicio: d.data().inicio || null, fim: d.data().fim || null, criadoEm: d.data().criadoEm }); });
  const a = j.assinatura || null;
  return {
    uid, nome: j.nome || "", email: j.email || "", criadoEm: j.criadoEm || null,
    competicao: c.papel ? { papel: c.papel, ativadoEm: c.ativadoEm || null, menor: c.papel === "atleta" ? C.ehMenor(c.nascimento, hoje) : null, idade: c.papel === "atleta" ? C.idadeEm(c.nascimento, hoje) : null, rotinaInformada: !!c.rotina } : null,
    assinatura: a ? { status: a.status, produto: a.nome || a.produtoId || "", ativoAte: a.ativoAte || null, ultimaFatura: a.ultimaFatura || null } : null,
    fichaPreenchida: !!(j.ficha && Object.keys(j.ficha).length), contagens: cont, vinculos: vin, pedidos: peds, acompanhamentos: acs,
  };
}

async function academias(db, hoje) {
  const orgs = await db.collection("orgs").listDocuments(), lista = [];
  for (const o of orgs) {
    const info = (await o.collection("meta").doc("info").get()), i = info.exists ? info.data() : {};
    let alunos = null; try { const d = await o.collection("dados").doc("mty:alunos:v2").get(); if (d.exists) { const l = JSON.parse(d.data().value || "[]"); alunos = Array.isArray(l) ? l.length : null; } } catch (e) { /* ignora */ }
    let pend = 0, equipe = 0; try { (await o.collection("solicitacoes").get()).forEach((s) => { const x = s.data() || {}; if (x.status === "aprovada") equipe++; else if (x.status && !["recusada", "removida"].includes(x.status)) pend++; }); } catch (e) { /* ignora */ }
    lista.push({ orgId: o.id, nome: i.nome || o.id, plano: i.plano || null, planoAtivoAte: i.planoAtivoAte || null, vencida: !!(i.planoAtivoAte && i.planoAtivoAte < hoje), criadoEm: i.criadoEm || null, eduzzUltimaFatura: i.eduzzUltimaFatura || null, eduzzAtualizadoEm: i.eduzzAtualizadoEm || null, eduzzRevogadoEm: i.eduzzRevogadoEm || null, alunos, equipe, pendentes: pend });
  }
  lista.sort((a, b) => String(b.eduzzAtualizadoEm || b.criadoEm || "").localeCompare(String(a.eduzzAtualizadoEm || a.criadoEm || "")));
  return { academias: lista };
}

/* ── Entradas: quem entrou e o que chegou, em ordem de data ── */
async function entradas(db, q, hoje) {
  const { jogadores, pedidos, acs, interesses, vinculos } = await dadosGerais(db, hoje);
  const ev = [];
  const papelDe = (j) => (j.competicao && j.competicao.papel) || "";
  const ROT_PAPEL = { atleta: "atleta", responsavel: "responsável", treinador: "treinador" };
  jogadores.forEach((j) => { const p = papelDe(j), data = j.criadoEm || (j.competicao && j.competicao.ativadoEm); if (data) ev.push({ em: data, tipo: "conta", rotulo: "Nova conta", texto: (j.nome || "Sem nome") + " · " + (p ? "Competição (" + ROT_PAPEL[p] + ")" : "Player"), detalhe: mascara(j.email), secao: "usuarios", uid: j.id }); });
  vinculos.forEach((v) => { if (v.criadoEm) ev.push({ em: v.criadoEm, tipo: "vinculo", rotulo: "Vínculo", texto: (v.atletaNome || "Atleta") + " ↔ " + (v.pessoaNome || v.pessoaEmail || "pessoa") + " (" + (v.tipo || "") + ")", detalhe: v.status || "", secao: "usuarios", uid: v.atletaUid }); });
  pedidos.forEach((p) => { if (p.criadoEm) ev.push({ em: p.criadoEm, tipo: "pedido", rotulo: "Pedido", texto: (p.nome || "Consultoria") + " · " + (p.atletaNome || "atleta"), detalhe: p.estado || "", secao: "consultorias" }); });
  acs.forEach((a) => { if (a.criadoEm) ev.push({ em: a.criadoEm, tipo: "acompanhamento", rotulo: "Acompanhamento", texto: "Solicitação de " + (a.atletaNome || "atleta"), detalhe: a.estado || "", secao: "acompanhamentos" }); });
  interesses.forEach((i) => { if (i.criadoEm) ev.push({ em: i.criadoEm, tipo: "contato", rotulo: "Contato", texto: (i.nome || "Sem nome") + " · " + (i.servico || ""), detalhe: i.status || "novo", secao: "contatos" }); });
  try {
    for (const o of await db.collection("orgs").listDocuments()) {
      const s = await o.collection("meta").doc("info").get(), i = s.exists ? s.data() : {};
      if (i.criadoEm) ev.push({ em: i.criadoEm, tipo: "academia", rotulo: "Academia", texto: (i.nome || o.id) + " entrou no app do treinador", detalhe: i.plano || "", secao: "academias" });
    }
  } catch (e) { /* sem academias */ }
  ev.sort((a, b) => String(b.em).localeCompare(String(a.em)));
  const tipo = String(q.tipo || ""), dias = Math.min(365, Math.max(1, parseInt(q.dias, 10) || 30)), desde = addDias(hoje, -dias);
  const contagem = {}; ev.filter((e) => dia(e.em) >= desde).forEach((e) => { contagem[e.tipo] = (contagem[e.tipo] || 0) + 1; });
  const lista = ev.filter((e) => dia(e.em) >= desde && (!tipo || e.tipo === tipo));
  const novas = jogadores.filter((j) => j.criadoEm || (j.competicao && j.competicao.ativadoEm));
  const sem = semanas(hoje, 12), serie = sem.map((s) => ({ semana: s, player: 0, atleta: 0, responsavel: 0, treinador: 0 }));
  novas.forEach((j) => { const d = dia(j.criadoEm || j.competicao.ativadoEm), i = sem.length - 1 - Math.floor(diasEntre(d, addDias(segundaDe(hoje), 6)) / 7); if (i >= 0 && i < sem.length) serie[i][papelDe(j) || "player"]++; });
  return { dias, tipo, total: lista.length, contagem, resumo: { hoje: novas.filter((j) => dia(j.criadoEm || j.competicao.ativadoEm) === hoje).length, dias7: novas.filter((j) => dia(j.criadoEm || j.competicao.ativadoEm) >= addDias(hoje, -7)).length, dias30: novas.filter((j) => dia(j.criadoEm || j.competicao.ativadoEm) >= addDias(hoje, -30)).length, total: jogadores.length }, serieContas: serie, eventos: lista.slice(0, 300), truncado: lista.length > 300 };
}

/* ── Eduzz: o que o webhook recebeu e o que isso virou (sem valores: a Eduzz não os envia ao sistema) ── */
const ROT_EDUZZ = { "myeduzz.invoice_paid": "Pagamento aprovado", "myeduzz.invoice_canceled": "Cancelamento", "myeduzz.invoice_refunded": "Reembolso", "myeduzz.invoice_chargeback": "Chargeback" };
const GRUPO_EDUZZ = (e) => (/paid/.test(e) ? "pago" : /refund|chargeback/.test(e) ? "reembolso" : /cancel/.test(e) ? "cancelado" : "outro");
async function eduzz(db, hoje) {
  const eventos = [];
  try { (await db.collectionGroup("webhooksEduzzProcessados").get()).forEach((d) => { const x = d.data() || {}; eventos.push({ id: d.id, evento: x.evento || String(d.id).split("|")[1] || "", email: mascara(x.email), em: x.processadoEm || null, tipo: x.tipo === "consultoria" ? "Consultoria" : "" }); }); }
  catch (e) { /* sem leitura */ }
  eventos.sort((a, b) => String(b.em).localeCompare(String(a.em)));
  const meses = ultimosMeses(hoje, 6), porMes = meses.map((m) => ({ mes: m, pago: 0, reembolso: 0, cancelado: 0, outro: 0 })), porEvento = {};
  eventos.forEach((e) => { porEvento[e.evento] = (porEvento[e.evento] || 0) + 1; const i = meses.indexOf(mesDe(e.em)); if (i >= 0) porMes[i][GRUPO_EDUZZ(e.evento)]++; });
  const faturas = await ler(db.collection("jogadoresFaturas")), pend = await ler(db.collection("jogadoresAssinaturasPendentes")), semPedido = await ler(db.collection("consultoriasPagamentosSemPedido"));
  const estFaturas = {}; faturas.forEach((f) => { estFaturas[f.estado || "?"] = (estFaturas[f.estado || "?"] || 0) + 1; });
  const orgs = []; for (const o of await db.collection("orgs").listDocuments()) { const s = await o.collection("meta").doc("info").get(), i = s.exists ? s.data() : {}; if (i.eduzzUltimaFatura || i.eduzzAtualizadoEm || i.eduzzRevogadoEm) orgs.push({ orgId: o.id, nome: i.nome || o.id, plano: i.plano || null, ativoAte: i.planoAtivoAte || null, atualizadoEm: i.eduzzAtualizadoEm || null, revogadoEm: i.eduzzRevogadoEm || null, vencida: !!(i.planoAtivoAte && i.planoAtivoAte < hoje) }); }
  const e7 = eventos.filter((e) => dia(e.em) >= addDias(hoje, -7)).length, e30 = eventos.filter((e) => dia(e.em) >= addDias(hoje, -30)).length;
  return {
    total: eventos.length, ultimos7: e7, ultimos30: e30, ultimoEvento: eventos[0] ? eventos[0].em : null,
    porEvento: Object.keys(porEvento).map((k) => ({ evento: k, rotulo: ROT_EDUZZ[k] || k, n: porEvento[k] })).sort((a, b) => b.n - a.n), porMes,
    eventos: eventos.slice(0, 200).map((e) => ({ ...e, rotulo: ROT_EDUZZ[e.evento] || e.evento })),
    faturasPlayer: { total: faturas.length, porEstado: estFaturas }, aguardandoConta: pend.length, semPedido: semPedido.map((s) => ({ id: s.id, consultoriaId: s.consultoriaId, faturaId: s.faturaId, recebidoEm: s.recebidoEm, motivo: s.motivo })), academias: orgs,
    webhookConfigurado: !!String(process.env.WEBHOOK_EDUZZ_SECRET || "").trim(),
    avisoValores: "O webhook da Eduzz não traz valores para o sistema. Os valores deste painel vêm dos preços de cada serviço e dos lançamentos que você digita em Financeiro; nenhum número da Eduzz é inventado aqui.",
  };
}

/* ── Financeiro: automático (pedidos e parcelas confirmados) + lançamentos manuais ── */
async function financeiro(db, hoje, q) {
  const F = require("./_admin-financeiro");
  const meses = ultimosMeses(hoje, 12), idx = {}; meses.forEach((m, i) => { idx[m] = i; });
  const linhas = meses.map((m) => ({ mes: m, receitaAuto: 0, receitaManual: 0, despesa: 0 }));
  const porProduto = {}, porCategoria = {}, movimentos = [];
  const prod = (k) => (porProduto[k] = porProduto[k] || { produto: k, rotulo: F.PRODUTOS[k] || k, receita: 0, despesa: 0 });
  const pedidos = await ler(db.collection("pedidosConsultoria")), acs = await ler(db.collection("acompanhamentos"));
  let aReceber = 0, reembolsado = 0;
  const entra = (origem, produto, nome, data, valor, estado) => {
    const i = idx[mesDe(data)];
    if (i >= 0 && i != null) linhas[i].receitaAuto += valor;
    prod(produto).receita += valor; movimentos.push({ id: null, origem, tipo: "receita", data: dia(data), valorCentavos: valor, produto, categoria: "", descricao: nome, automatico: true, estado });
  };
  pedidos.forEach((p) => {
    const v = p.precoCentavos || 0;
    if (["pago", "em_andamento", "entregue"].includes(p.estado)) entra("Consultoria", "consultoria", (p.nome || "Consultoria") + " · " + (p.atletaNome || ""), p.pagoEm || p.criadoEm, v, p.estado);
    else if (p.estado === "reembolsado") reembolsado += v;
    else if (p.estado === "aguardando_pagamento") aReceber += v;
  });
  acs.forEach((a) => (a.parcelas || []).forEach((p) => {
    if (p.estado === "pago" && p.pagoEm) entra("Acompanhamento MTY", "acompanhamento", "Pagamento " + p.n + " · " + (a.atletaNome || ""), p.pagoEm, p.valorCentavos || 0, "pago");
    else if (["aguardando_pagamento", "aguardando_inicio", "ativo"].includes(a.estado)) aReceber += p.valorCentavos || 0;
  }));
  const lanc = await ler(db.collection("financeiroLancamentos"));
  lanc.forEach((l) => {
    const i = idx[mesDe(l.data)], v = l.valorCentavos || 0;
    if (l.tipo === "receita") { if (i != null) linhas[i].receitaManual += v; prod(l.produto || "geral").receita += v; }
    else { if (i != null) linhas[i].despesa += v; prod(l.produto || "geral").despesa += v; const c = F.CATEGORIAS_DESPESA[l.categoria] || l.categoria; porCategoria[c] = (porCategoria[c] || 0) + v; }
    movimentos.push({ id: l.id, origem: "Manual", tipo: l.tipo, data: l.data, valorCentavos: v, produto: l.produto || "geral", categoria: (F.categoriasDe(l.tipo)[l.categoria]) || l.categoria || "", descricao: l.descricao || "", automatico: false });
  });
  movimentos.sort((a, b) => String(b.data).localeCompare(String(a.data)));
  const mesAtual = linhas[linhas.length - 1], tot = linhas.reduce((s, l) => ({ receita: s.receita + l.receitaAuto + l.receitaManual, despesa: s.despesa + l.despesa }), { receita: 0, despesa: 0 });
  const mes = String(q.mes || "");
  return {
    linhas: linhas.map((l) => ({ ...l, receita: l.receitaAuto + l.receitaManual, resultado: l.receitaAuto + l.receitaManual - l.despesa })),
    mesAtual: { mes: mesAtual.mes, receita: mesAtual.receitaAuto + mesAtual.receitaManual, despesa: mesAtual.despesa, resultado: mesAtual.receitaAuto + mesAtual.receitaManual - mesAtual.despesa },
    totais: { receita: tot.receita, despesa: tot.despesa, resultado: tot.receita - tot.despesa }, aReceberCentavos: aReceber, reembolsadoCentavos: reembolsado,
    porProduto: Object.keys(porProduto).map((k) => ({ ...porProduto[k], resultado: porProduto[k].receita - porProduto[k].despesa })).sort((a, b) => b.receita - a.receita),
    despesasPorCategoria: Object.keys(porCategoria).map((k) => ({ categoria: k, valorCentavos: porCategoria[k] })).sort((a, b) => b.valorCentavos - a.valorCentavos),
    movimentos: (/^\d{4}-\d{2}$/.test(mes) ? movimentos.filter((m) => mesDe(m.data) === mes) : movimentos).slice(0, 500),
    listas: { produtos: F.PRODUTOS, categoriasReceita: F.CATEGORIAS_RECEITA, categoriasDespesa: F.CATEGORIAS_DESPESA },
    nota: "Receitas automáticas: consultorias e parcelas do Acompanhamento confirmadas no painel, pelo preço do serviço. Vendas da Eduzz entram só se você as lançar. Despesas são sempre lançadas por você.",
  };
}

/* ── Análise: funis, atividade, uso dos recursos, qualidade da IA, planos e site (só contagens; nada de nome, e-mail ou conteúdo) ── */
const LIMITE_GRUPO = 20000;
async function lerGrupo(db, nome, trunc) {
  const o = [];
  try { const s = await db.collectionGroup(nome).get(); s.forEach((d) => { if (o.length >= LIMITE_GRUPO) { trunc.add(nome); return; } const p = d.ref && d.ref.path ? d.ref.path.split("/") : []; o.push({ uid: p[0] === "jogadores" ? p[1] : null, id: d.id, ...d.data() }); }); }
  catch (e) { trunc.add(nome + " (não lido)"); }
  return o.filter((x) => x.uid);
}
const quando = (x) => String(x.criadoEm || x.em || x.atualizadoEm || x.data || "");
const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
const mediana = (l) => { if (!l.length) return null; const s = l.slice().sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };

async function analise(db, hoje) {
  const trunc = new Set(), agora = Date.now();
  const jogadores = await ler(db.collection("jogadores"), LIMITE_CONTAS);
  if (jogadores.length >= LIMITE_CONTAS) trunc.add("jogadores");
  const G = {}; for (const g of ["planos", "planejamentos", "partidas", "preparos", "diario", "torneios", "scouts", "devolutivas", "focos", "compPlanejamentos", "compExecucoes"]) G[g] = await lerGrupo(db, g, trunc);
  const vinculos = await ler(db.collection("vinculos")), acs = await ler(db.collection("acompanhamentos")), interesses = await ler(db.collection("interessesCompeticao"));
  let fichaCompleta = (f) => !!(f && Object.keys(f).length); try { fichaCompleta = require("./_player").fichaCompleta; } catch (e) { /* mantém a regra simples */ }
  const d7 = addDias(hoje, -7), d30 = addDias(hoje, -30), d14 = addDias(hoje, -14), d3 = addDias(hoje, -3);
  const papelDe = (j) => (j.competicao && j.competicao.papel) || "";
  const comPapel = (p) => jogadores.filter((j) => papelDe(j) === p);
  const uidsDe = (lista, f) => new Set(lista.filter(f || (() => true)).map((x) => x.uid));

  /* atividade: pares (conta, dia) de qualquer registro feito pela conta */
  const dias = new Map(); // uid → Set de dias
  const marca = (uid, iso) => { const d = dia(iso); if (!d || d > hoje) return; if (!dias.has(uid)) dias.set(uid, new Set()); dias.get(uid).add(d); };
  for (const g of Object.keys(G)) G[g].forEach((x) => { marca(x.uid, quando(x)); if (g === "planejamentos") Object.values(x.registros || {}).forEach((r) => r && marca(x.uid, r.em)); });
  const ativosDesde = (desde) => { let n = 0; dias.forEach((set) => { for (const d of set) if (d >= desde) { n++; break; } }); return n; };
  const sem = semanas(hoje, 8), serieAtivos = sem.map((ini) => { const fim = addDias(ini, 6); let n = 0; dias.forEach((set) => { for (const d of set) if (d >= ini && d <= fim) { n++; break; } }); return { semana: ini, n }; });
  const antigas = jogadores.filter((j) => j.criadoEm && dia(j.criadoEm) <= d14), voltaram = antigas.filter((j) => { const s = dias.get(j.id); if (!s) return false; for (const d of s) if (d >= d14) return true; return false; });

  /* funil do Player: contas sem papel da Competição */
  const pl = jogadores.filter((j) => !papelDe(j)), plIds = new Set(pl.map((j) => j.id));
  const comPlano = uidsDe(G.planos, (p) => p.status === "pronto"), comPlanej = uidsDe(G.planejamentos, (p) => p.status === "pronto");
  const treinoReg = new Set(), semanasTreino = new Map();
  G.planejamentos.filter((p) => p.status === "pronto").forEach((p) => Object.values(p.registros || {}).forEach((r) => { if (r && ["feito", "parcial", "nao_feito"].includes(r.status)) { treinoReg.add(p.uid); if (r.em) { if (!semanasTreino.has(p.uid)) semanasTreino.set(p.uid, new Set()); semanasTreino.get(p.uid).add(dia(r.em)); } } }));
  let voltouOutraSemana = 0; semanasTreino.forEach((set) => { const o = [...set].sort(); if (o.length > 1 && diasEntre(o[0], o[o.length - 1]) >= 7) voltouOutraSemana++; });
  const pagante = (j) => (j.assinatura && j.assinatura.status === "ativa") || (j.planoPago && j.planoPago !== "gratis");
  const passosP = [["Contas do Player", pl.length], ["Ficha completa", pl.filter((j) => fichaCompleta(j.ficha || {})).length], ["Plano de jogo criado", pl.filter((j) => comPlano.has(j.id)).length], ["Planejamento semanal criado", pl.filter((j) => comPlanej.has(j.id)).length], ["Treino registrado", pl.filter((j) => treinoReg.has(j.id)).length], ["Registrou em outra semana", pl.filter((j) => semanasTreino.has(j.id) && (() => { const o = [...semanasTreino.get(j.id)].sort(); return o.length > 1 && diasEntre(o[0], o[o.length - 1]) >= 7; })()).length], ["Assinante", pl.filter(pagante).length]];
  const funilPlayer = passosP.map((p, i) => ({ rotulo: p[0], n: p[1], pctAnterior: i && p[1] <= passosP[i - 1][1] ? pct(p[1], passosP[i - 1][1]) : null, pctContas: pct(p[1], passosP[0][1]) }));

  /* funil da Competição: atletas */
  const atletas = comPapel("atleta"), atIds = new Set(atletas.map((j) => j.id));
  const vincAtivo = new Set(vinculos.filter((v) => v.status === "ativo").map((v) => v.atletaUid));
  const comAcomp = new Set(acs.filter((a) => a.estado !== "cancelado").map((a) => a.atletaUid));
  const passosC = [["Atletas", atletas.length], ["Torneio cadastrado", atletas.filter((j) => uidsDe(G.torneios).has(j.id)).length], ["Preparação criada", atletas.filter((j) => uidsDe(G.preparos).has(j.id)).length], ["Partida registrada", atletas.filter((j) => uidsDe(G.partidas).has(j.id)).length], ["Planejamento gerado", atletas.filter((j) => uidsDe(G.compPlanejamentos).has(j.id)).length], ["Treinador ou responsável vinculado", atletas.filter((j) => vincAtivo.has(j.id)).length], ["Acompanhamento solicitado", atletas.filter((j) => comAcomp.has(j.id)).length]];
  const sT = uidsDe(G.torneios), sPr = uidsDe(G.preparos), sPa = uidsDe(G.partidas), sCp = uidsDe(G.compPlanejamentos);
  const funilComp = passosC.map((p, i) => ({ rotulo: p[0], n: p[1], pctAnterior: i && p[1] <= passosC[i - 1][1] ? pct(p[1], passosC[i - 1][1]) : null, pctContas: pct(p[1], passosC[0][1]) }));

  /* uso por recurso */
  const R = [["Planos de jogo (estratégias)", "planos"], ["Planejamentos semanais do Player", "planejamentos"], ["Partidas registradas", "partidas"], ["Preparações por partida", "preparos"], ["Registros de diário", "diario"], ["Torneios cadastrados", "torneios"], ["Scouts importados", "scouts"], ["Devolutivas do treinador", "devolutivas"], ["Focos de treino", "focos"], ["Versões de planejamento (Competição)", "compPlanejamentos"], ["Treinos executados (Competição)", "compExecucoes"]];
  const uso = R.map(([rot, g]) => { const l = G[g]; return { rotulo: rot, total: l.length, ult7: l.filter((x) => dia(quando(x)) >= d7).length, ult30: l.filter((x) => dia(quando(x)) >= d30).length, contas30: new Set(l.filter((x) => dia(quando(x)) >= d30).map((x) => x.uid)).size }; });

  /* qualidade da IA e limites (planos de jogo e planejamentos do Player, últimos 30 dias) */
  const ia = ["planos", "planejamentos"].map((g) => {
    const l = G[g].filter((x) => dia(quando(x)) >= d30), st = {}; l.forEach((x) => { st[x.status || "?"] = (st[x.status || "?"] || 0) + 1; });
    const travados = G[g].filter((x) => x.status === "gerando" && x.criadoEm && agora - Date.parse(x.criadoEm) > 30 * 60000).length;
    const semCota = l.filter((x) => x.semCota); const ex = l.length - semCota.length;
    return { rotulo: g === "planos" ? "Planos de jogo" : "Planejamentos do Player", total30: l.length, pronto: st.pronto || 0, erro: (st.erro || 0) - semCota.length, semCota: semCota.length, contasSemCota: new Set(semCota.map((x) => x.uid)).size, gerando: st.gerando || 0, travados, taxaErroPct: pct(Math.max(0, (st.erro || 0) - semCota.length), ex) };
  });

  /* planos e assinaturas do Player */
  const assinStatus = {}; jogadores.forEach((j) => { const s = (j.assinatura && j.assinatura.status) || "sem"; assinStatus[s] = (assinStatus[s] || 0) + 1; });
  const vence7 = jogadores.filter((j) => j.assinatura && j.assinatura.status === "ativa" && j.assinatura.ativoAte && j.assinatura.ativoAte >= hoje && j.assinatura.ativoAte <= addDias(hoje, 7)).length;
  let faturas = []; try { faturas = await ler(db.collection("jogadoresFaturas")); } catch (e) { /* sem faturas */ }
  const planosAss = { assinantes: jogadores.filter(pagante).length, contas: jogadores.length, conversaoPct: pct(jogadores.filter(pagante).length, jogadores.length), porStatus: assinStatus, vencemEm7: vence7, faturasPagas: faturas.filter((f) => f.estado === "paga").length, faturasRevogadas: faturas.filter((f) => f.estado && f.estado !== "paga").length };

  /* Competição */
  const menores = atletas.filter((j) => C.ehMenor(j.competicao.nascimento, hoje)), respAtivos = new Set(vinculos.filter((v) => v.status === "ativo" && v.tipo === "responsavel").map((v) => v.atletaUid)), treiAtivos = new Set(vinculos.filter((v) => v.status === "ativo" && v.tipo === "treinador").map((v) => v.atletaUid));
  const futuros = G.torneios.filter((t) => t.inicio && t.inicio >= hoje), futurosPor = new Set(futuros.map((t) => t.uid));
  const planStatus = {}; G.compPlanejamentos.forEach((p) => { planStatus[p.status] = (planStatus[p.status] || 0) + 1; });
  const competicao = {
    atletas: atletas.length, menores: menores.length, adultos: atletas.length - menores.length, responsaveis: comPapel("responsavel").length, treinadores: comPapel("treinador").length,
    comTreinador: atletas.filter((j) => treiAtivos.has(j.id)).length, comResponsavel: atletas.filter((j) => respAtivos.has(j.id)).length, menoresSemResponsavel: menores.filter((j) => !respAtivos.has(j.id)).length,
    comTorneioFuturo: atletas.filter((j) => futurosPor.has(j.id)).length, torneios30: futuros.filter((t) => t.inicio <= addDias(hoje, 30)).length, torneios60: futuros.filter((t) => t.inicio <= addDias(hoje, 60)).length,
    planejamentoPorStatus: planStatus, vinculosPorEstado: vinculos.reduce((m, v) => { const k = v.tipo + ":" + v.status; m[k] = (m[k] || 0) + 1; return m; }, {}),
    prioridadeTorneios: G.torneios.reduce((m, t) => { const k = t.prioridade || "sem"; m[k] = (m[k] || 0) + 1; return m; }, {}),
  };

  /* site: contatos */
  const cont = (campo) => Object.entries(interesses.reduce((m, i) => { const k = i[campo] || "—"; m[k] = (m[k] || 0) + 1; return m; }, {})).map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n);
  const horas = interesses.filter((i) => i.status === "contatado" && i.criadoEm && i.atualizadoEm).map((i) => Math.max(0, Math.round((Date.parse(i.atualizadoEm) - Date.parse(i.criadoEm)) / 3600000)));
  const site = { total: interesses.length, ult30: interesses.filter((i) => dia(i.criadoEm) >= d30).length, porServico: cont("servico"), porFaixa: cont("faixa"), porCategoria: cont("categoria"), porStatus: cont("status"), medianaHorasAteContato: mediana(horas), contatados: horas.length };

  /* academias (app do treinador) */
  const acad = { total: 0, vencidas: 0, alunos: 0, porPlano: {} };
  try { for (const o of await db.collection("orgs").listDocuments()) { const s = await o.collection("meta").doc("info").get(), i = s.exists ? s.data() : {}; acad.total++; if (i.planoAtivoAte && i.planoAtivoAte < hoje) acad.vencidas++; acad.porPlano[i.plano || "sem"] = (acad.porPlano[i.plano || "sem"] || 0) + 1; try { const dd = await o.collection("dados").doc("mty:alunos:v2").get(); if (dd.exists) { const l = JSON.parse(dd.data().value || "[]"); if (Array.isArray(l)) acad.alunos += l.length; } } catch (e) { /* sem alunos */ } } } catch (e) { /* sem academias */ }

  /* pontos de atenção */
  const aten = [];
  const semFicha = pl.filter((j) => j.criadoEm && dia(j.criadoEm) <= d3 && !fichaCompleta(j.ficha || {})).length;
  if (semFicha) aten.push({ nivel: "medio", texto: semFicha + " conta(s) do Player criadas há 3 dias ou mais ainda sem a ficha completa: o primeiro passo não foi concluído.", secao: "usuarios" });
  const iaP = ia[0]; if (iaP.taxaErroPct >= 10 && iaP.erro >= 3) aten.push({ nivel: "alto", texto: "Planos de jogo com erro: " + iaP.taxaErroPct + "% nos últimos 30 dias (" + iaP.erro + " de " + (iaP.total30 - iaP.semCota) + ").", secao: "analise" });
  const travados = ia[0].travados + ia[1].travados; if (travados) aten.push({ nivel: "alto", texto: travados + " geração(ões) da IA parada(s) em “gerando” há mais de 30 minutos.", secao: "analise" });
  const semCotaContas = new Set([...G.planos, ...G.planejamentos].filter((x) => x.semCota && dia(quando(x)) >= d30).map((x) => x.uid)).size;
  if (semCotaContas) aten.push({ nivel: "baixo", texto: semCotaContas + " conta(s) bateram no limite do plano nos últimos 30 dias: possível oportunidade de assinatura.", secao: "analise" });
  if (competicao.menoresSemResponsavel) aten.push({ nivel: "medio", texto: competicao.menoresSemResponsavel + " atleta(s) menor(es) de idade sem responsável vinculado.", secao: "usuarios" });
  const parados = vinculos.filter((v) => v.status === "aguardando" && v.aceitoEm && dia(v.aceitoEm) <= d3).length; if (parados) aten.push({ nivel: "medio", texto: parados + " vínculo(s) aguardando aprovação há 3 dias ou mais.", secao: "usuarios" });
  const semTorneio = atletas.filter((j) => j.criadoEm && dia(j.criadoEm) <= d14 && !sT.has(j.id)).length; if (semTorneio) aten.push({ nivel: "baixo", texto: semTorneio + " atleta(s) com conta há 14 dias ou mais sem nenhum torneio cadastrado.", secao: "usuarios" });

  return {
    geradoEm: new Date().toISOString(), truncado: [...trunc],
    atividade: { ativos7: ativosDesde(d7), ativos30: ativosDesde(d30), contas: jogadores.length, novas30: jogadores.filter((j) => dia(j.criadoEm) >= d30).length, retornoPct: pct(voltaram.length, antigas.length), antigas: antigas.length, serie: serieAtivos },
    funilPlayer, funilCompeticao: funilComp, uso, ia, planos: planosAss, competicao, site, academias: acad, atencao: aten,
  };
}

function sistema() {
  const e = process.env, def = (k) => !!String(e[k] || "").trim();
  const itens = [
    { chave: "ADMIN_SECRET", rotulo: "Segredo do painel", ok: def("ADMIN_SECRET"), efeito: "Sem ele ninguém entra neste painel." },
    { chave: "FIREBASE_SERVICE_ACCOUNT", rotulo: "Firebase (conta de serviço)", ok: def("FIREBASE_SERVICE_ACCOUNT"), efeito: "Sem ele nenhuma function grava ou lê dados: login, pedidos, formulário e painel." },
    { chave: "ANTHROPIC_API_KEY", rotulo: "Chave da IA (Anthropic)", ok: def("ANTHROPIC_API_KEY"), efeito: "Planos de jogo, leitura de inscrição de torneio e relatórios com IA." },
    { chave: "WEBHOOK_EDUZZ_SECRET", rotulo: "Segredo do webhook da Eduzz", ok: def("WEBHOOK_EDUZZ_SECRET"), efeito: "Sem ele os pagamentos da Eduzz não são reconhecidos." },
    { chave: "INTERESSE_WEBHOOK_URL", rotulo: "Aviso de novo contato (opcional)", ok: def("INTERESSE_WEBHOOK_URL"), opcional: true, efeito: "Avisa em Slack ou similar quando chega um contato da página de vendas. Sem ele, os contatos só aparecem aqui." },
    { chave: "PLAYER_EMAILS_FULL", rotulo: "Contas com acesso completo ao Player (teste)", ok: def("PLAYER_EMAILS_FULL"), opcional: true, efeito: "Lista de e-mails liberados manualmente." },
    { chave: "PLAYER_MODELO_PLANOS", rotulo: "Modelo de planos do Player", ok: def("PLAYER_MODELO_PLANOS"), opcional: true, efeito: "Liga o controle de limites por plano, quando decidido." },
  ];
  const comerciais = [
    { rotulo: "Produtos do Player na Eduzz", ok: ASS.CATALOGO.filter(ASS.produtoCompleto).length > 0, detalhe: ASS.CATALOGO.filter(ASS.produtoCompleto).length + " completo(s)" },
    { rotulo: "Checkout das consultorias avulsas", ok: Object.keys(CONS.CHECKOUT_CONSULTORIA).some((k) => CONS.checkoutDe(k)), detalhe: Object.keys(CONS.CHECKOUT_CONSULTORIA).filter((k) => CONS.checkoutDe(k)).length + " de " + Object.keys(CONS.CHECKOUT_CONSULTORIA).length + " com link; os demais são combinados no WhatsApp" },
    { rotulo: "Acompanhamento MTY na Eduzz (3 parcelas)", ok: false, detalhe: "Ainda combinado no WhatsApp; cada pagamento é confirmado à mão neste painel" },
    { rotulo: "Políticas de pagamento, remarcação e cancelamento", ok: !!(ASS.POLITICAS && (ASS.POLITICAS.pagamento || ASS.POLITICAS.remarcacao || ASS.POLITICAS.cancelamento)), detalhe: "Textos ainda não definidos aparecem como “informados no atendimento”" },
  ];
  return { itens, comerciais, whatsapp: ASS.WHATSAPP, links: { netlifyQuadralab: "https://app.netlify.com/projects/quadralab", netlifyTeamYoda: "https://app.netlify.com/projects/teamyoda" } };
}

exports.handler = async function (event) {
  if (event.httpMethod !== "GET") return resposta(405, { erro: "Método não permitido." });
  const q = event.queryStringParameters || {};
  if (!(await A.autorizar(event))) {
    if (A.enviouCredencial(event) && (await A.tentativaErrada(event))) return resposta(429, { erro: "Muitas tentativas. Aguarde uma hora." });
    return resposta(401, { erro: "Segredo de administrador ausente ou incorreto." });
  }
  try {
    if ((q.secao || "") === "sistema") return resposta(200, sistema());
    app();
    const db = admin.firestore(), hoje = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
    switch (q.secao) {
      case "ping": return resposta(200, { ok: true });
      case "resumo": return resposta(200, await resumo(db, hoje));
      case "pagamentos": return resposta(200, await pagamentos(db, hoje));
      case "usuarios": return resposta(200, await usuarios(db, q, hoje));
      case "usuario": { const u = await usuario(db, q.uid, hoje); return u ? resposta(200, u) : resposta(404, { erro: "Conta não encontrada." }); }
      case "academias": return resposta(200, await academias(db, hoje));
      case "analise": return resposta(200, await analise(db, hoje));
      case "entradas": return resposta(200, await entradas(db, q, hoje));
      case "eduzz": return resposta(200, await eduzz(db, hoje));
      case "financeiro": return resposta(200, await financeiro(db, hoje, q));
      default: return resposta(400, { erro: "Seção desconhecida." });
    }
  } catch (e) {
    console.error("admin-painel:", e && e.message);
    return resposta(500, { erro: "Não foi possível carregar agora." });
  }
};
exports.sistema = sistema;
