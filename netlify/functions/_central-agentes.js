/* Central Tsukada — agentes (aprovados em 13/11/2026 com a Etapa 2; teto de US$ 10 por mês). Regras puras, sem Firebase.
   Cada agente faz um trabalho estreito num horário fixo e entrega um RASCUNHO na aba "Agentes" da Central: o Richard aprova,
   edita ou descarta. Nenhum agente manda mensagem para aluno, pai ou professor. Os dados vêm do Team Yoda pelo servidor
   (o mesmo painel do Padrão de Atendimento, _atendimento.js, cópia de mty/atendimento.js).
   IA: claude-opus-5-5 pela chave do servidor (ANTHROPIC_API_KEY), com fallback do servidor em caso de recusa. Sem chave,
   com o teto do mês atingido, ou se a IA falhar, o agente entrega um rascunho sem IA (as mesmas listas, sem o texto corrido).
   Custo: tokens de entrada × US$ 4/milhão + tokens de saída × US$ 20/milhão (preço do claude-opus-5-5). */
const AV = require("./_central-avisos");

const MODELO = "claude-opus-5-5";
const PRECO = { entrada: 4 / 1e6, saida: 20 / 1e6 };
const TETO_PADRAO_USD = 10;

/* quando: dow (0 = domingo … 6 = sábado, como sp().dow) e hora cheia de São Paulo; diaMes para os mensais */
const AGENTES = {
  painelSegunda: { rot: "Painel de segunda", etapa: 2, quando: { dow: 1, hora: 7 }, para: "richard",
    desc: "Só as exceções da semana, em ordem de prioridade: aulas sem registro, checklist incompleto por professor, faltas e alunos sem marco." },
  conversas: { rot: "Conversas com professores", etapa: 2, quando: { dow: 1, hora: 7 }, para: "richard",
    desc: "Uma pauta por professor: os números da semana, um ponto forte, um ponto para conversar e de quem é a vez na observação." },
  presenca: { rot: "Presença à distância", etapa: 2, quando: { dow: 4, hora: 20 }, para: "richard",
    desc: "Alunos que bateram marco e alunos que precisam de incentivo, com um roteiro curto de áudio para cada um." },
  mensagemCiclo: { rot: "Mensagem do ciclo", etapa: 2, quando: { diaMes: 25, hora: 8 }, para: "richard",
    desc: "Rascunho da sua mensagem pessoal do mês para os relatórios de ciclo, com base nas conquistas registradas." },
  caixaEntrada: { rot: "Caixa de entrada", etapa: 2, quando: null, para: "richard",
    desc: "Você escreve solto e o agente separa em tarefas e compromissos para você confirmar." },
  resumoAdm: { rot: "Resumo do administrativo", etapa: 3, quando: { dow: 1, hora: 8 }, para: "administrativo", desc: "Resumo da semana anterior (pagamentos, alunos novos, saídas, reposições pendentes) para o administrativo revisar e enviar." },
  faltasAdm: { rot: "Faltas e aulas sem registro", etapa: 3, quando: { dow: 3, hora: 14 }, para: "administrativo", desc: "Rascunho dos avisos aos professores sobre aulas sem registro e alunos com muitas faltas." },
  viagens: { rot: "Viagens", etapa: 3, quando: { hora: 9 }, para: "administrativo", desc: "Prazos de inscrição, hospedagem e transporte dos próximos torneios, e quem sai ou volta na semana." },
};
const ETAPA_AGENTES = 3; // Etapa 3 (13/11/2026): os três agentes do administrativo
const ativo = (id) => !!AGENTES[id] && AGENTES[id].etapa <= ETAPA_AGENTES;

function configPadrao() { const ligados = {}; Object.keys(AGENTES).forEach((k) => { ligados[k] = true; }); return { ligados, tetoUSD: TETO_PADRAO_USD, gasto: {} }; }
function limparConfig(c) {
  const p = configPadrao(), x = c && typeof c === "object" ? c : {};
  Object.keys(p.ligados).forEach((k) => { if (x.ligados && typeof x.ligados[k] === "boolean") p.ligados[k] = x.ligados[k]; });
  const t = Number(x.tetoUSD); if (isFinite(t) && t >= 0 && t <= 200) p.tetoUSD = Math.round(t * 100) / 100;
  Object.keys(x.gasto || {}).filter((m) => /^\d{4}-\d{2}$/.test(m)).sort().slice(-24).forEach((m) => { const v = Number(x.gasto[m]); if (isFinite(v) && v >= 0) p.gasto[m] = Math.round(v * 1e6) / 1e6; });
  if (typeof x.segredo === "string" && /^[a-f0-9]{48}$/.test(x.segredo)) p.segredo = x.segredo;
  return p;
}
function publicoConfig(c, hoje) { const mes = hoje.slice(0, 7); return { ligados: c.ligados, tetoUSD: c.tetoUSD, gastoMes: Math.round((c.gasto[mes] || 0) * 100) / 100, mes }; }
function custoUSD(usage) { const u = usage || {}; return (u.input_tokens || 0) * PRECO.entrada + (u.cache_creation_input_tokens || 0) * PRECO.entrada * 1.25 + (u.cache_read_input_tokens || 0) * PRECO.entrada * 0.1 + (u.output_tokens || 0) * PRECO.saida; }
function dentroDoTeto(c, hoje) { return (c.gasto[hoje.slice(0, 7)] || 0) < c.tetoUSD; }

/* o período do rascunho: a segunda da semana (semanais), o mês (mensais) ou o dia */
function periodoDe(id, agoraMs) {
  const a = AV.sp(agoraMs), q = AGENTES[id].quando || {};
  if (q.diaMes) return a.data.slice(0, 7);
  if (q.dow != null) return AV.segundaDe(a.data);
  return a.data;
}
/* quem está na hora agora (o agendador roda de hora em hora; o id do rascunho é agente-período, então sai uma vez só) */
function devidos(agoraMs, cfg) {
  const a = AV.sp(agoraMs), hora = Number(a.hhmm.slice(0, 2)), dia = Number(a.data.slice(8, 10));
  return Object.keys(AGENTES).filter((id) => {
    const q = AGENTES[id].quando; if (!q || !ativo(id) || !cfg.ligados[id]) return false;
    if (q.hora !== hora) return false;
    if (q.diaMes && q.diaMes !== dia) return false;
    if (q.dow != null && q.dow !== a.dow) return false;
    return true;
  }).map((id) => ({ agente: id, periodo: periodoDe(id, agoraMs), id: id + "-" + periodoDe(id, agoraMs) }));
}

/* ── o que cada agente lê (montado no servidor a partir do Team Yoda) ──
   fontes: { hoje, painel (MTYAtendimento.painel), faltas: [{nome, faltas, professor}], marcosSemana: [{nome, texto, data, professor}],
             conquistasMes: [{nome, texto, marco}], rotina (semana de _central-rotina), professores: [nomes da rotina] } */
const curto = (l, n) => (l || []).slice(0, n);
function contexto(id, f, extra) {
  const P = f.painel || { totais: {}, professores: [], atrasadas: [], alunosSemMarco: [] };
  if (id === "painelSegunda") return {
    semana: f.hoje, totais: P.totais,
    professores: P.professores.map((p) => ({ nome: p.nome, aulas: p.aulas, checklistCompleto: p.pctCompleto, aulasSemRegistro: p.atrasadas, itemMaisEsquecido: p.itemMaisEsquecido && p.itemMaisEsquecido.r })),
    aulasSemRegistro: curto(P.atrasadas, 12).map((x) => ({ data: x.data, aula: x.nome, professor: x.professor, horas: x.horas })),
    faltas: curto(f.faltas, 12), semMarco: curto(P.alunosSemMarco, 12).map((x) => ({ nome: x.nome, dias: x.dias, professor: x.professor })),
  };
  if (id === "conversas") return {
    observacaoDaSemana: f.rotina ? f.rotina.observacao : null,
    professores: (f.professores && f.professores.length ? f.professores : P.professores.map((p) => p.nome)).map((nome) => {
      const p = P.professores.find((x) => x.nome === nome) || {};
      return { nome, aulas: p.aulas || 0, checklistCompleto: p.pctCompleto == null ? null : p.pctCompleto, aulasSemRegistro: p.atrasadas || 0,
        itemMaisEsquecido: p.itemMaisEsquecido && p.itemMaisEsquecido.r, fichasParaConversar: curto(p.conversa, 6).map((c) => ({ aluno: c.nome, motivo: c.motivo })) };
    }),
  };
  if (id === "presenca") return { marcosDaSemana: curto(f.marcosSemana, 15), precisamDeIncentivo: curto(f.faltas, 8).concat(curto(P.alunosSemMarco, 8).map((x) => ({ nome: x.nome, motivo: x.dias + " dias sem marco", professor: x.professor }))) };
  if (id === "mensagemCiclo") return { mes: f.hoje.slice(0, 7), conquistasDoMes: curto(f.conquistasMes, 25), checklistGeral: P.totais && P.totais.pctCompleto };
  if (id === "caixaEntrada") return { hoje: f.hoje, texto: String((extra && extra.texto) || "").slice(0, 4000) };
  /* ── administrativo (Etapa 3) ── */
  if (id === "resumoAdm") return {
    semanaAnterior: f.semanaAnterior || null, pagamentosDoMes: f.pagamentos || null,
    alunosNovos: curto(f.alunosNovos, 20), saidas: f.saidas == null ? null : curto(f.saidas, 20),
    reposicoesPendentes: f.reposicoes ? { total: f.reposicoes.total, exemplos: curto(f.reposicoes.lista, 8) } : null,
  };
  if (id === "faltasAdm") {
    const porProf = {};
    (f.faltas || []).forEach((x) => { (porProf[x.professor] = porProf[x.professor] || { professor: x.professor, faltas: [], semRegistro: [] }).faltas.push({ aluno: x.nome, faltas: x.faltas }); });
    (P.atrasadas || []).forEach((x) => { (porProf[x.professor] = porProf[x.professor] || { professor: x.professor, faltas: [], semRegistro: [] }).semRegistro.push({ aula: x.nome, data: x.data }); });
    return { professores: Object.values(porProf).slice(0, 10).map((p) => ({ professor: p.professor, faltas: curto(p.faltas, 8), semRegistro: curto(p.semRegistro, 8) })) };
  }
  if (id === "viagens") return { hoje: f.hoje, torneiosProximos: curto(f.torneiosProximos, 20), viagensCadastradas: curto(f.viagens, 20) };
  return {};
}

const SISTEMA = "Você é um assistente do Team Yoda (academia de tênis do Richard Tsukada, Head Trainer), trabalhando para o Richard ou para o administrativo da academia. "
  + "Escreva em português do Brasil, direto e curto, no tom da casa: próximo, cordial, prático. Use só os dados fornecidos; não invente aluno, número nem fato. O que você escreve é um rascunho que o "
  + "Richard (ou o administrativo) revisa antes de usar: nunca fale como se a mensagem já tivesse sido enviada. Sem markdown pesado: use títulos curtos em linha própria e listas com hífen.";
const PEDIDOS = {
  painelSegunda: "Monte o painel de segunda: só as exceções que pedem ação nesta semana, em ordem de prioridade (o mais urgente primeiro), cada uma com o porquê em uma linha e a ação sugerida. "
    + "Agrupe por: aulas sem registro, checklist por professor, faltas, alunos sem marco. Se uma lista estiver vazia, não a mencione. Termine com 'Para fazer hoje:' e no máximo 3 itens. Cabe em 20 minutos de leitura e ação.",
  conversas: "Monte a pauta das conversas de 20 minutos com cada professor (um bloco por professor): números da semana em uma linha, um ponto forte para elogiar, "
    + "um ponto para conversar (com o aluno citado, se houver) e uma pergunta aberta para fazer. No fim, diga de quem é a vez na observação de aula desta semana.",
  presenca: "Prepare a presença à distância de sexta: para cada aluno que bateu marco, um roteiro de áudio de 20 a 30 segundos parabenizando pela conquista específica; "
    + "para cada aluno que precisa de incentivo, um roteiro de áudio curto e acolhedor, sem citar faltas como cobrança. Use o primeiro nome do aluno. Máximo de 10 roteiros, os marcos primeiro.",
  mensagemCiclo: "Escreva o rascunho da mensagem pessoal do Richard que vai em todos os relatórios de ciclo deste mês (de 60 a 100 palavras): tom caloroso, reconheça o esforço, "
    + "cite de forma geral o tipo de conquista que mais apareceu no mês (sem nomes de alunos) e termine olhando para o próximo ciclo. Depois, em 'Destaques do mês', liste até 5 conquistas com o nome do aluno, para o Richard escolher se cita alguma.",
  resumoAdm: "Escreva o resumo da semana anterior que o administrativo vai revisar e enviar ao Richard. Seções curtas, nesta ordem: Pagamentos (situação do mês: recebido, em aberto, atrasados, "
    + "e quem está atrasado), Alunos novos, Saídas (se a lista vier nula, diga que a contagem começa a partir desta semana), Reposições pendentes. Termine com 'Pontos de atenção:' (no máximo 3). "
    + "Fale como o administrativo falando com o Richard, na primeira pessoa do plural.",
  faltasAdm: "Prepare, para cada professor da lista, uma mensagem curta de WhatsApp que o administrativo vai mandar: os alunos com muitas faltas (pedindo que o professor fale com o aluno ou a família) "
    + "e as aulas sem registro (pedindo para registrar). Tom cordial e prático, sem cobrança dura. Um bloco por professor, começando por 'Para <professor>:'. Professor sem nada, não aparece.",
  viagens: "Monte a lista do que o administrativo precisa fazer para as viagens de torneio: para cada torneio dos próximos dias, o que falta (inscrição, hospedagem, transporte) e quem sai ou volta "
    + "nesta semana, lembrando de avisar os professores. Torneio que ainda não está nas viagens cadastradas: sugira cadastrar. Ordem: o mais próximo primeiro. Curto.",
  caixaEntrada: "Separe o texto do Richard em tarefas e compromissos. Responda SÓ com um JSON neste formato, sem nada antes nem depois: "
    + '{"tarefas":[{"titulo":"…","prazo":"AAAA-MM-DD ou vazio","prioridade":"alta|media|baixa","negocio":"team-yoda|39-ranch|quadralab|alvor|geral"}],'
    + '"compromissos":[{"titulo":"…","data":"AAAA-MM-DD","inicio":"HH:MM ou vazio","negocio":"…"}],"observacao":"uma linha, se algo ficou ambíguo"}. '
    + "Datas relativas (amanhã, quinta, semana que vem) contam a partir de hoje. Compromisso exige data; sem data, vira tarefa.",
};
function mensagem(id, ctx) { return PEDIDOS[id] + "\n\nDados (JSON):\n" + JSON.stringify(ctx); }

/* ── rascunho sem IA (sem chave, teto atingido ou falha) ── */
function linhas(l, fn) { return (l || []).map(fn).join("\n"); }
function semIA(id, ctx) {
  if (id === "painelSegunda") {
    const p = [];
    if (ctx.aulasSemRegistro.length) p.push("Aulas sem registro\n" + linhas(ctx.aulasSemRegistro, (x) => "- " + x.aula + " (" + x.data.split("-").reverse().slice(0, 2).join("/") + ", " + x.professor + ")"));
    const chk = ctx.professores.filter((x) => x.checklistCompleto != null && x.checklistCompleto < 80);
    if (chk.length) p.push("Checklist abaixo de 80%\n" + linhas(chk, (x) => "- " + x.nome + ": " + x.checklistCompleto + "%" + (x.itemMaisEsquecido ? " (mais esquecido: " + x.itemMaisEsquecido + ")" : "")));
    if (ctx.faltas.length) p.push("Faltas\n" + linhas(ctx.faltas, (x) => "- " + x.nome + ": " + x.faltas + " faltas em 30 dias (" + x.professor + ")"));
    if (ctx.semMarco.length) p.push("Sem marco\n" + linhas(ctx.semMarco, (x) => "- " + x.nome + ": " + x.dias + " dias (" + x.professor + ")"));
    return p.length ? p.join("\n\n") : "Nenhuma exceção esta semana.";
  }
  if (id === "conversas") return ctx.professores.map((p) => p.nome + "\n- " + p.aulas + " aulas, checklist " + (p.checklistCompleto == null ? "—" : p.checklistCompleto + "%") + ", " + p.aulasSemRegistro + " sem registro"
    + (p.fichasParaConversar.length ? "\n" + linhas(p.fichasParaConversar, (c) => "- " + c.aluno + ": " + c.motivo) : "")).join("\n\n")
    + (ctx.observacaoDaSemana ? "\n\nObservação de aula desta semana: " + ctx.observacaoDaSemana : "");
  if (id === "presenca") return (ctx.marcosDaSemana.length ? "Bateram marco\n" + linhas(ctx.marcosDaSemana, (x) => "- " + x.nome + ": " + x.texto) : "Nenhum marco registrado nesta semana.")
    + (ctx.precisamDeIncentivo.length ? "\n\nPrecisam de incentivo\n" + linhas(ctx.precisamDeIncentivo, (x) => "- " + x.nome + (x.motivo ? ": " + x.motivo : x.faltas ? ": " + x.faltas + " faltas" : "")) : "");
  if (id === "mensagemCiclo") return "Conquistas do mês\n" + (ctx.conquistasDoMes.length ? linhas(ctx.conquistasDoMes, (x) => "- " + x.nome + ": " + x.texto + (x.marco ? " (marco)" : "")) : "- nenhuma registrada");
  if (id === "resumoAdm") {
    const pg = ctx.pagamentosDoMes, real = (v) => "R$ " + Number(v || 0).toFixed(2).replace(".", ",");
    return ["Pagamentos" + (pg ? "\n- Recebido no mês: " + real(pg.recebido) + "\n- Em aberto: " + pg.emAberto + " (" + real(pg.valorEmAberto) + ")\n- Atrasados: " + pg.atrasados + (pg.atrasadosNomes && pg.atrasadosNomes.length ? " (" + pg.atrasadosNomes.join(", ") + ")" : "") : "\n- sem dados"),
      "Alunos novos\n" + (ctx.alunosNovos.length ? linhas(ctx.alunosNovos, (x) => "- " + x) : "- nenhum"),
      "Saídas\n" + (ctx.saidas == null ? "- a contagem começa a partir desta semana" : ctx.saidas.length ? linhas(ctx.saidas, (x) => "- " + x) : "- nenhuma"),
      "Reposições pendentes\n- " + (ctx.reposicoesPendentes ? ctx.reposicoesPendentes.total : 0)].join("\n\n");
  }
  if (id === "faltasAdm") return ctx.professores.length ? ctx.professores.map((p) => "Para " + p.professor + ":" + (p.faltas.length ? "\n- Faltas: " + p.faltas.map((x) => x.aluno + " (" + x.faltas + ")").join(", ") : "")
    + (p.semRegistro.length ? "\n- Aulas sem registro: " + p.semRegistro.map((x) => x.aula + " " + x.data.split("-").reverse().slice(0, 2).join("/")).join(", ") : "")).join("\n\n") : "Nenhum aluno com muitas faltas e nenhuma aula sem registro.";
  if (id === "viagens") return (ctx.torneiosProximos.length ? "Torneios nos próximos 30 dias\n" + linhas(ctx.torneiosProximos, (t) => "- " + t.atleta + ": " + t.torneio + " (" + t.data.split("-").reverse().slice(0, 2).join("/") + ")") : "Nenhum torneio nos próximos 30 dias.")
    + (ctx.viagensCadastradas.length ? "\n\nViagens cadastradas\n" + linhas(ctx.viagensCadastradas, (v) => "- " + v.atleta + " · " + v.torneio + ": falta " + (["inscricao", "hospedagem", "transporte"].filter((k) => !v[k]).join(", ") || "nada")) : "");
  if (id === "caixaEntrada") return JSON.stringify({ tarefas: ctx.texto.split(/\n+/).map((t) => t.trim()).filter(Boolean).slice(0, 20).map((titulo) => ({ titulo: titulo.slice(0, 160), prazo: "", prioridade: "media", negocio: "geral" })), compromissos: [], observacao: "Sem IA: cada linha virou uma tarefa." });
  return "";
}

/* caixa de entrada: lê o JSON da resposta (tolerante) e devolve só o que é válido */
const DATA = /^\d{4}-\d{2}-\d{2}$/, HORA = /^([01]\d|2[0-3]):[0-5]\d$/, NEGOCIOS = ["team-yoda", "39-ranch", "quadralab", "alvor", "geral"];
function lerPropostas(texto) {
  let o = null; const s = String(texto || ""), i = s.indexOf("{"), j = s.lastIndexOf("}");
  if (i >= 0 && j > i) { try { o = JSON.parse(s.slice(i, j + 1)); } catch (e) { o = null; } }
  if (!o || typeof o !== "object") return null;
  const lin = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
  return {
    tarefas: (Array.isArray(o.tarefas) ? o.tarefas : []).slice(0, 30).map((t) => ({ titulo: lin(t && t.titulo, 160), prazo: DATA.test(String(t && t.prazo)) ? t.prazo : "",
      prioridade: ["alta", "media", "baixa"].indexOf(t && t.prioridade) >= 0 ? t.prioridade : "media", negocio: NEGOCIOS.indexOf(t && t.negocio) >= 0 ? t.negocio : "geral" })).filter((t) => t.titulo),
    compromissos: (Array.isArray(o.compromissos) ? o.compromissos : []).slice(0, 30).map((c) => ({ titulo: lin(c && c.titulo, 120), data: DATA.test(String(c && c.data)) ? c.data : "",
      inicio: HORA.test(String(c && c.inicio)) ? c.inicio : "", negocio: NEGOCIOS.indexOf(c && c.negocio) >= 0 ? c.negocio : "geral" })).filter((c) => c.titulo && c.data),
    observacao: lin(o.observacao, 300),
  };
}
function textoDasPropostas(p) {
  const out = [];
  if (p.tarefas.length) out.push("Tarefas\n" + p.tarefas.map((t) => "- " + t.titulo + (t.prazo ? " (até " + t.prazo.split("-").reverse().slice(0, 2).join("/") + ")" : "")).join("\n"));
  if (p.compromissos.length) out.push("Compromissos\n" + p.compromissos.map((c) => "- " + c.titulo + " (" + c.data.split("-").reverse().slice(0, 2).join("/") + (c.inicio ? " " + c.inicio : "") + ")").join("\n"));
  if (p.observacao) out.push(p.observacao);
  return out.join("\n\n") || "Nada para separar.";
}

/* conteúdo vazio não chama a IA (economiza o teto): as viagens só quando há torneio ou viagem pela frente */
function vazio(id, ctx) { return id === "viagens" && !ctx.torneiosProximos.length && !ctx.viagensCadastradas.length; }
const paraDe = (agente) => (AGENTES[agente] || {}).para || "richard";

/* item como a tela vê */
function itemPublico(id, x) {
  return { id, agente: x.agente, para: paraDe(x.agente), enviadoEm: x.enviadoEm || "", rot: (AGENTES[x.agente] || {}).rot || x.agente, periodo: x.periodo || "", estado: x.estado, titulo: x.titulo || "", texto: x.texto || "",
    propostas: x.propostas || null, semIA: !!x.semIA, motivoSemIA: x.motivoSemIA || "", custoUSD: Math.round((x.custoUSD || 0) * 10000) / 10000,
    criadoEm: x.criadoEm || "", atualizadoEm: x.atualizadoEm || "", aplicadoEm: x.aplicadoEm || "" };
}

module.exports = { MODELO, PRECO, AGENTES, ETAPA_AGENTES, ativo, configPadrao, limparConfig, publicoConfig, custoUSD, dentroDoTeto, periodoDe, devidos,
  contexto, SISTEMA, PEDIDOS, mensagem, semIA, lerPropostas, textoDasPropostas, itemPublico, vazio, paraDe };
