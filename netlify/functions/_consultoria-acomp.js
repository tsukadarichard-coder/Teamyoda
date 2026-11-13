/* Consultoria, Etapas 2 a 5: o acompanhamento online (ciclo, tarefas da semana, check-in, encontros, análises, alto rendimento,
   formatos e relatório do ciclo). Regras em _consultoria-ciclo.js; aqui o Firestore. Chamado por consultoria.js.

   ctx = { db, agora(), avisarCliente(uid, titulo, corpo, url), avisarRichard(titulo, corpo, url) } */
const K = require("./_consultoria-ciclo");
const C = require("./_consultoria");
const { Erro } = C;

const col = (ctx, n) => ctx.db().collection(n);
const ID = /^[A-Za-z0-9_-]{6,80}$/;
async function lista(ctx, n, campo, valor) { const s = await col(ctx, n).where(campo, "==", valor).get(); return s.docs.map((d) => ({ id: d.id, ...d.data() })); }
async function doc(ctx, n, id) { if (!ID.test(String(id || ""))) throw new Erro(400, "Item inválido."); const s = await col(ctx, n).doc(id).get(); return s.exists ? { id, ...s.data() } : null; }
const porData = (campo, desc) => (a, b) => (desc ? -1 : 1) * String(a[campo] || "").localeCompare(String(b[campo] || ""));
const primeiro = (n) => String(n || "").split(" ")[0];
function dataHoraBR(iso) { const d = new Date(Date.parse(iso) - 3 * 3600000).toISOString(); return d.slice(8, 10) + "/" + d.slice(5, 7) + " às " + d.slice(11, 16); }

async function lerConfig(ctx) { const s = await col(ctx, "consultoriaConfig").doc("geral").get(); return s.exists ? { linkEncontro: "", modelos: [], formatos: [], ...s.data() } : { linkEncontro: "", modelos: [], formatos: [] }; }
async function cicloAtivo(ctx, uid) { const l = (await lista(ctx, "consultoriaCiclos", "uid", uid)).filter((c) => c.estado === "ativo"); return l.sort(porData("criadoEm", true))[0] || null; }
async function lerAR(ctx, uid) { const s = await col(ctx, "consultoriaAR").doc(uid).get(); return s.exists ? { ligado: false, torneios: [], registros: [], ...s.data() } : { ligado: false, torneios: [], registros: [] }; }
function arPublico(ar, hoje) {
  if (!ar || !ar.ligado) return null;
  const torneios = (ar.torneios || []).slice().sort(porData("inicio"));
  return { ligado: true, torneios, fase: K.faseAtual(torneios, hoje), carga: K.cargaSemanal(ar.registros || [], hoje, 6),
    registros: (ar.registros || []).slice().sort(porData("data", true)).slice(0, 30) };
}

/* tudo do acompanhamento de um cliente (para ele mesmo ou para a ficha do Richard) */
async function dados(ctx, uid, paraRichard) {
  const hoje = K.hojeBR(), semana = K.semanaDe();
  const [ciclos, tarefas, encontros, checkins, analises, ar, config] = await Promise.all([lista(ctx, "consultoriaCiclos", "uid", uid), lista(ctx, "consultoriaTarefas", "uid", uid),
    lista(ctx, "consultoriaEncontros", "uid", uid), lista(ctx, "consultoriaCheckins", "uid", uid), lista(ctx, "consultoriaAnalises", "uid", uid), lerAR(ctx, uid), paraRichard ? null : lerConfig(ctx)]);
  const ativo = ciclos.filter((c) => c.estado === "ativo").sort(porData("criadoEm", true))[0] || null;
  const doCiclo = (x) => !ativo || x.cicloId === ativo.id || !x.cicloId;
  const tarefasC = tarefas.filter(doCiclo).sort(porData("criadoEm")), encontrosC = encontros.sort(porData("quando"));
  const analisesC = analises.sort(porData("data", true));
  const out = {
    ciclo: ativo ? K.cicloPublico(ativo.id, ativo, hoje) : null,
    ciclosAnteriores: ciclos.filter((c) => c.estado === "encerrado").sort(porData("encerradoEm", true)).map((c) => K.cicloPublico(c.id, c, hoje)),
    semana, hoje,
    tarefas: tarefasC.map((t) => K.tarefaPublica(t.id, t)),
    adesao: K.adesao(tarefasC, semana),
    encontros: encontrosC.map((e) => K.encontroPublico(e.id, e, paraRichard)),
    checkins: checkins.sort(porData("semana", true)).slice(0, paraRichard ? 30 : 12).map((c) => ({ id: c.id, semana: c.semana, nota: c.nota, texto: c.texto || "", duvida: c.duvida || "", resposta: c.resposta || null, criadoEm: c.criadoEm })),
    analises: analisesC.map((a) => K.analisePublica(a.id, a)),
    ar: paraRichard ? { ...(arPublico(ar, hoje) || { ligado: false }), torneios: (ar.torneios || []).slice().sort(porData("inicio")) } : arPublico(ar, hoje),
    uso: ativo ? K.usoDoFormato(ativo.formato, encontros.filter((e) => !ativo || e.cicloId === ativo.id), analises.filter((a) => a.cicloId === ativo.id)) : null,
  };
  out.checkinDaSemana = out.checkins.filter((c) => c.semana === semana)[0] || null;
  if (!paraRichard) out.temLinkEncontro = !!(config && config.linkEncontro);
  return out;
}

/* ── ações do cliente ── */
async function acaoCliente(ctx, claims, a, b, cliente) {
  const uid = claims.uid, t = ctx.agora();
  if (a === "tarefaFeita") {
    const x = await doc(ctx, "consultoriaTarefas", b.id);
    if (!x || x.uid !== uid) throw new Erro(404, "Tarefa não encontrada.");
    const feita = b.feita !== false, novo = { ...x, estado: feita ? "feita" : "aberta", comentario: C.txt(b.comentario, K.L.textoMax) || (feita ? x.comentario || "" : ""), feitaEm: feita ? x.feitaEm || t : null };
    delete novo.id; await col(ctx, "consultoriaTarefas").doc(x.id).set(novo);
    if (feita && novo.comentario && novo.comentario !== (x.comentario || "")) await ctx.avisarRichard("Tarefa feita: " + x.titulo, primeiro(cliente.nome) + ": " + novo.comentario.slice(0, 90), "/richard/#/cliente/" + uid);
    return { tarefa: K.tarefaPublica(x.id, novo) };
  }
  if (a === "checkin") {
    if (!cliente || cliente.estado !== "ativo") throw new Erro(403, "O check-in abre quando a consultoria estiver liberada.");
    const c = K.limparCheckin(b), semana = K.semanaDe(), id = K.idCheckin(uid, semana), atual = await doc(ctx, "consultoriaCheckins", id), ciclo = await cicloAtivo(ctx, uid);
    const novo = { ...(atual || {}), uid, cicloId: ciclo ? ciclo.id : null, semana, ...c, criadoEm: atual ? atual.criadoEm : t, atualizadoEm: t };
    delete novo.id; await col(ctx, "consultoriaCheckins").doc(id).set(novo);
    if (!atual) await ctx.avisarRichard("Check-in de " + primeiro(cliente.nome), "Semana nota " + c.nota + (c.duvida ? " · tem uma dúvida" : ""), "/richard/#/cliente/" + uid);
    return { checkin: { id, semana, nota: novo.nota, texto: novo.texto, duvida: novo.duvida, resposta: novo.resposta || null } };
  }
  if (a === "arRegistro" || a === "arRegistroApagar") {
    const ar = await lerAR(ctx, uid);
    if (!ar.ligado) throw new Erro(403, "O alto rendimento não está ligado na sua consultoria.");
    if (a === "arRegistro") ar.registros = [K.limparRegistro(b)].concat(ar.registros || []).slice(0, K.L.registrosMax);
    else ar.registros = (ar.registros || []).filter((r) => r.id !== b.id);
    await col(ctx, "consultoriaAR").doc(uid).set(ar);
    return { ar: arPublico(ar, K.hojeBR()) };
  }
  return undefined;
}

/* ── ações do Richard ── */
async function clienteExiste(ctx, uid) {
  if (!C.UID.test(String(uid || ""))) throw new Erro(400, "Cliente inválido.");
  const s = await col(ctx, "consultoriaClientes").doc(uid).get(); if (!s.exists) throw new Erro(404, "Cliente não encontrado.");
  return s.data();
}
async function avisoDeTarefa(ctx, uid, cli) {
  /* um aviso a cada 20 minutos no máximo, para não lotar o celular quando o Richard monta a semana */
  const ref = col(ctx, "consultoriaClientes").doc(uid), t = ctx.agora();
  if (cli.ultimoAvisoTarefa && Date.parse(t) - Date.parse(cli.ultimoAvisoTarefa) < 20 * 60000) return;
  await ref.set({ ...cli, ultimoAvisoTarefa: t });
  await ctx.avisarCliente(uid, "Tarefas da semana", "O Richard deixou tarefas para você nesta semana.", "/richard/#/semana");
}
async function acaoRichard(ctx, claims, a, b) {
  const t = ctx.agora();
  if (a === "cicloSalvar") {
    const cli = await clienteExiste(ctx, b.uid), atual = await cicloAtivo(ctx, b.uid), c = K.limparCiclo(b, atual);
    if (atual) { const novo = { ...atual, ...c, atualizadoEm: t }; delete novo.id; await col(ctx, "consultoriaCiclos").doc(atual.id).set(novo); return { ciclo: K.cicloPublico(atual.id, novo) }; }
    const n = (await lista(ctx, "consultoriaCiclos", "uid", b.uid)).length + 1, ref = col(ctx, "consultoriaCiclos").doc();
    const novo = { uid: b.uid, numero: n, ...c, estado: "ativo", criadoEm: t, atualizadoEm: t };
    await ref.set(novo);
    await ctx.avisarCliente(b.uid, "Seu ciclo começou", "O Richard montou o plano do ciclo " + n + ", " + primeiro(cli.nome) + ". Veja o objetivo e as metas.", "/richard/#/plano");
    return { ciclo: K.cicloPublico(ref.id, novo) };
  }
  if (a === "relatorioRascunho" || a === "cicloEncerrar") {
    await clienteExiste(ctx, b.uid);
    const atual = await cicloAtivo(ctx, b.uid); if (!atual) throw new Erro(404, "Este cliente não tem ciclo em andamento.");
    if (a === "relatorioRascunho") {
      const d = await dados(ctx, b.uid, true), envs = await lista(ctx, "consultoriaEnvios", "uid", b.uid), checks = d.checkins.filter((c) => c.semana >= atual.inicio);
      const tarefas = d.tarefas;
      return { texto: K.rascunhoRelatorio(atual, { encontrosFeitos: d.encontros.filter((e) => e.estado === "feito" && e.quando >= atual.inicio).length,
        devolutivas: envs.filter((e) => e.estado === "respondido" && e.tipo !== "recado" && String(e.devolutiva && e.devolutiva.respondidoEm) >= atual.inicio).length,
        analises: d.analises.filter((x) => x.data >= atual.inicio).length, tarefas: tarefas.length, tarefasFeitas: tarefas.filter((x) => x.estado === "feita").length, adesao: d.adesao,
        checkins: checks.length, semanas: atual.semanas, notaMedia: checks.length ? Math.round((checks.reduce((s, c) => s + c.nota, 0) / checks.length) * 10) / 10 : null }) };
    }
    const texto = C.txt(b.texto, 12000);
    if (texto.length < 20) throw new Erro(400, "Escreva o relatório do ciclo antes de encerrar.");
    const novo = { ...atual, metas: K.limparMetas(b.metas || atual.metas), estado: "encerrado", encerradoEm: t, relatorio: { texto, publicadoEm: t } };
    delete novo.id; await col(ctx, "consultoriaCiclos").doc(atual.id).set(novo);
    await ctx.avisarCliente(b.uid, "Relatório do ciclo", "O Richard fechou o ciclo " + (atual.numero || 1) + " com o relatório da sua evolução.", "/richard/#/plano");
    return { ciclo: K.cicloPublico(atual.id, novo) };
  }
  if (a === "tarefaSalvar") {
    const cli = await clienteExiste(ctx, b.uid), x = K.limparTarefa(b), ciclo = await cicloAtivo(ctx, b.uid);
    if (b.id) {
      const atual = await doc(ctx, "consultoriaTarefas", b.id); if (!atual || atual.uid !== b.uid) throw new Erro(404, "Tarefa não encontrada.");
      const novo = { ...atual, ...x, atualizadoEm: t }; delete novo.id; await col(ctx, "consultoriaTarefas").doc(atual.id).set(novo); return { tarefa: K.tarefaPublica(atual.id, novo) };
    }
    const daSemana = (await lista(ctx, "consultoriaTarefas", "uid", b.uid)).filter((y) => y.semana === x.semana).length;
    if (daSemana >= K.L.tarefasSemanaMax) throw new Erro(409, "Esta semana já tem " + K.L.tarefasSemanaMax + " tarefas.");
    const ref = col(ctx, "consultoriaTarefas").doc(), novo = { uid: b.uid, cicloId: ciclo ? ciclo.id : null, ...x, estado: "aberta", origem: C.txt(b.origem, 60) || null, criadoEm: t };
    await ref.set(novo); await avisoDeTarefa(ctx, b.uid, cli);
    return { tarefa: K.tarefaPublica(ref.id, novo) };
  }
  if (a === "tarefaApagar") { const x = await doc(ctx, "consultoriaTarefas", b.id); if (!x) throw new Erro(404, "Tarefa não encontrada."); await col(ctx, "consultoriaTarefas").doc(x.id).delete(); return { ok: true }; }
  if (a === "encontroSalvar") {
    const cli = await clienteExiste(ctx, b.uid), cfg = await lerConfig(ctx), x = K.limparEncontro(b, cfg.linkEncontro), ciclo = await cicloAtivo(ctx, b.uid);
    if (b.id) {
      const atual = await doc(ctx, "consultoriaEncontros", b.id); if (!atual || atual.uid !== b.uid) throw new Erro(404, "Encontro não encontrado.");
      const mudouHora = atual.quando !== x.quando, novo = { ...atual, ...x, avisos: mudouHora ? {} : atual.avisos || {}, atualizadoEm: t }; delete novo.id;
      await col(ctx, "consultoriaEncontros").doc(atual.id).set(novo);
      if (x.estado === "feito" && atual.estado !== "feito" && (x.notas || x.combinados.length)) await ctx.avisarCliente(b.uid, "Anotações do encontro", "O Richard deixou as anotações e os combinados do encontro.", "/richard/#/encontros");
      else if (mudouHora && x.estado === "marcado") await ctx.avisarCliente(b.uid, "Encontro remarcado", "Novo horário: " + dataHoraBR(x.quando) + ".", "/richard/#/encontros");
      else if (x.estado === "cancelado" && atual.estado !== "cancelado") await ctx.avisarCliente(b.uid, "Encontro cancelado", "O encontro de " + dataHoraBR(atual.quando) + " foi cancelado.", "/richard/#/encontros");
      return { encontro: K.encontroPublico(atual.id, novo, true) };
    }
    const ref = col(ctx, "consultoriaEncontros").doc(), novo = { uid: b.uid, cicloId: ciclo ? ciclo.id : null, ...x, avisos: {}, criadoEm: t };
    await ref.set(novo);
    await ctx.avisarCliente(b.uid, "Encontro marcado", primeiro(cli.nome) + ", o Richard marcou um encontro para " + dataHoraBR(x.quando) + ".", "/richard/#/encontros");
    return { encontro: K.encontroPublico(ref.id, novo, true) };
  }
  if (a === "encontroApagar") { const x = await doc(ctx, "consultoriaEncontros", b.id); if (!x) throw new Erro(404, "Encontro não encontrado."); await col(ctx, "consultoriaEncontros").doc(x.id).delete(); return { ok: true }; }
  if (a === "combinadosParaTarefas") {
    const e = await doc(ctx, "consultoriaEncontros", b.id); if (!e) throw new Erro(404, "Encontro não encontrado.");
    if (!(e.combinados || []).length) throw new Erro(400, "Escreva os combinados do encontro primeiro.");
    if (e.combinadosViraramTarefas) throw new Erro(409, "Os combinados deste encontro já viraram tarefas.");
    const cli = await clienteExiste(ctx, e.uid), ciclo = await cicloAtivo(ctx, e.uid), semana = K.semanaDe();
    for (const c of e.combinados) await col(ctx, "consultoriaTarefas").doc().set({ uid: e.uid, cicloId: ciclo ? ciclo.id : null, titulo: c, tipo: "outro", detalhe: "Combinado no encontro de " + dataHoraBR(e.quando) + ".", semana, estado: "aberta", origem: "encontro:" + e.id, criadoEm: t });
    const novo = { ...e, combinadosViraramTarefas: true }; delete novo.id; await col(ctx, "consultoriaEncontros").doc(e.id).set(novo);
    await avisoDeTarefa(ctx, e.uid, cli);
    return { criadas: e.combinados.length };
  }
  if (a === "checkinResponder") {
    const c = await doc(ctx, "consultoriaCheckins", b.id); if (!c) throw new Erro(404, "Check-in não encontrado.");
    const texto = C.txt(b.texto, K.L.textoMax); if (texto.length < 2) throw new Erro(400, "Escreva a resposta.");
    const novo = { ...c, resposta: { texto, em: t } }; delete novo.id; await col(ctx, "consultoriaCheckins").doc(c.id).set(novo);
    await ctx.avisarCliente(c.uid, "O Richard respondeu o seu check-in", texto.slice(0, 100), "/richard/#/semana");
    return { ok: true };
  }
  if (a === "analiseSalvar") {
    await clienteExiste(ctx, b.uid); const x = K.limparAnalise(b), ciclo = await cicloAtivo(ctx, b.uid);
    if (b.id) { const atual = await doc(ctx, "consultoriaAnalises", b.id); if (!atual || atual.uid !== b.uid) throw new Erro(404, "Análise não encontrada."); const novo = { ...atual, ...x }; delete novo.id; await col(ctx, "consultoriaAnalises").doc(atual.id).set(novo); return { analise: K.analisePublica(atual.id, novo) }; }
    const ref = col(ctx, "consultoriaAnalises").doc(), novo = { uid: b.uid, cicloId: ciclo ? ciclo.id : null, ...x, criadoEm: t };
    await ref.set(novo);
    await ctx.avisarCliente(b.uid, "Análise nova", "O Richard publicou: " + x.titulo + ".", "/richard/#/plano");
    return { analise: K.analisePublica(ref.id, novo) };
  }
  if (a === "analiseApagar") { const x = await doc(ctx, "consultoriaAnalises", b.id); if (!x) throw new Erro(404, "Análise não encontrada."); await col(ctx, "consultoriaAnalises").doc(x.id).delete(); return { ok: true }; }
  if (a === "arLigar" || a === "arTorneioSalvar" || a === "arTorneioApagar") {
    await clienteExiste(ctx, b.uid); const ar = await lerAR(ctx, b.uid);
    if (a === "arLigar") ar.ligado = b.ligado !== false;
    if (a === "arTorneioSalvar") { const x = K.limparTorneio(b.torneio || {}); ar.torneios = (ar.torneios || []).filter((y) => y.id !== x.id).concat([x]).slice(-K.L.torneiosMax); }
    if (a === "arTorneioApagar") ar.torneios = (ar.torneios || []).filter((y) => y.id !== b.id);
    await col(ctx, "consultoriaAR").doc(b.uid).set(ar);
    if (a === "arLigar" && ar.ligado) await ctx.avisarCliente(b.uid, "Alto rendimento", "O Richard ligou a aba Rendimento: calendário de torneios e registro de treinos e jogos.", "/richard/#/rendimento");
    return { ar: { ...(arPublico(ar, K.hojeBR()) || { ligado: false }), torneios: (ar.torneios || []).slice().sort(porData("inicio")) } };
  }
  if (a === "configSalvar") { const c = K.limparConfig(b); await col(ctx, "consultoriaConfig").doc("geral").set({ ...c, atualizadoEm: t }); return { config: c }; }
  return undefined;
}

/* ── painel "Hoje" do Richard ── */
async function hoje(ctx, clientes) {
  const agoraMs = Date.parse(ctx.agora()), semana = K.semanaDe(agoraMs), anterior = K.somaDias(semana, -7);
  const [encs, chkSemana, ciclos, tarefasAnt] = await Promise.all([lista(ctx, "consultoriaEncontros", "estado", "marcado"), lista(ctx, "consultoriaCheckins", "semana", semana),
    lista(ctx, "consultoriaCiclos", "estado", "ativo"), lista(ctx, "consultoriaTarefas", "semana", anterior)]);
  const nome = (uid) => (clientes[uid] ? clientes[uid].nome : "Cliente");
  const proximos = encs.filter((e) => Date.parse(e.quando) > agoraMs - 2 * 3600000 && Date.parse(e.quando) < agoraMs + 7 * 86400000).sort(porData("quando"))
    .map((e) => ({ ...K.encontroPublico(e.id, e, true), uid: e.uid, cliente: nome(e.uid) }));
  const comCiclo = ciclos.map((c) => c.uid).filter((uid, i, l) => l.indexOf(uid) === i && clientes[uid] && clientes[uid].estado === "ativo");
  const fizeram = {}; chkSemana.forEach((c) => { fizeram[c.uid] = c; });
  const checkinsParaLer = chkSemana.filter((c) => !c.resposta).map((c) => ({ id: c.id, uid: c.uid, cliente: nome(c.uid), nota: c.nota, texto: c.texto || "", duvida: c.duvida || "" }));
  const semCheckin = comCiclo.filter((uid) => !fizeram[uid]).map((uid) => ({ uid, cliente: nome(uid) }));
  const porCliente = {}; tarefasAnt.forEach((x) => { (porCliente[x.uid] = porCliente[x.uid] || []).push(x); });
  const adesaoBaixa = Object.keys(porCliente).map((uid) => ({ uid, cliente: nome(uid), adesao: K.adesao(porCliente[uid], semana), tarefas: porCliente[uid].length }))
    .filter((x) => x.adesao != null && x.adesao < 50 && clientes[x.uid] && clientes[x.uid].estado === "ativo");
  return { semana, encontros: proximos, checkinsParaLer, semCheckin, adesaoBaixa, ciclosAtivos: comCiclo.length };
}

/* ── avisos agendados (de hora em hora): encontro na véspera e 1 hora antes; lembrete do check-in no domingo à tarde ── */
async function avisosAgendados(ctx) {
  const agoraMs = Date.parse(ctx.agora()), out = { encontros: 0, checkins: 0 };
  for (const e of await lista(ctx, "consultoriaEncontros", "estado", "marcado")) {
    const dev = K.avisosDevidos(e, agoraMs); if (!dev.length) continue;
    const novo = { ...e, avisos: { ...(e.avisos || {}) } }; delete novo.id;
    for (const k of dev) {
      novo.avisos[k] = ctx.agora(); out.encontros++;
      await ctx.avisarCliente(e.uid, k === "vespera" ? "Encontro amanhã" : "Encontro em 1 hora", "Encontro com o Richard " + dataHoraBR(e.quando) + "." + (e.link ? " O link está no app." : ""), "/richard/#/encontros");
      if (k === "hora") await ctx.avisarRichard("Encontro em 1 hora", "Encontro marcado " + dataHoraBR(e.quando) + ".", "/richard/#/hoje");
    }
    await col(ctx, "consultoriaEncontros").doc(e.id).set(novo);
  }
  const br = new Date(agoraMs - 3 * 3600000), semana = K.semanaDe(agoraMs);
  if (br.getUTCDay() === 0 && br.getUTCHours() === 18) {
    const cfgRef = col(ctx, "consultoriaConfig").doc("lembretes"), cfg = await cfgRef.get();
    if (!(cfg.exists && cfg.data().checkin === semana)) {
      await cfgRef.set({ checkin: semana, em: ctx.agora() });
      const feitos = {}; (await lista(ctx, "consultoriaCheckins", "semana", semana)).forEach((c) => { feitos[c.uid] = true; });
      const uids = (await lista(ctx, "consultoriaCiclos", "estado", "ativo")).map((c) => c.uid).filter((u, i, l) => l.indexOf(u) === i && !feitos[u]);
      for (const uid of uids) { out.checkins++; await ctx.avisarCliente(uid, "Check-in da semana", "Como foi a sua semana de treino? Leva um minuto.", "/richard/#/semana"); }
    }
  }
  return out;
}

module.exports = { dados, acaoCliente, acaoRichard, hoje, avisosAgendados, lerConfig };
