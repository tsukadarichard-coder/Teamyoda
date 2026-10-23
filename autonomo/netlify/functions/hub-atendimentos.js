/* QuadraLab Hub — pedidos de atendimento, conversa privada, propostas versionadas, conclusão, avaliações, denúncias e bloqueios.
   Usado por "Meus atendimentos" (Player e Competição) e "Pedidos de atendimento" (QuadraLab Treinador).

   GET                         → meus pedidos (como jogador/responsável e, se for treinador, como profissional) e avisos
   GET ?id=                    → um pedido com a conversa (só participantes); zera as não lidas de quem abriu
   GET ?preparar=<uid prof>    → dados para o formulário: para quem, nível, serviços e o que será compartilhado
   POST { acao, ... }          → enviar, confirmarEnvio, mensagem, proposta, pedirAjuste, aceitar, recusarProposta, recusar, cancelar,
                                 encerrar, concluir, avaliar, responderAvaliacao, denunciar, bloquear, desbloquear, lerNotificacoes

   Segurança (tudo conferido aqui, nunca no aparelho):
   · só participantes leem o pedido: o profissional, quem contrata e, com atleta menor, os responsáveis com vínculo ativo
     (o atleta menor acompanha, mas não conversa sozinho com o profissional: não existe canal privado entre profissional e menor);
   · atleta menor só envia com responsável vinculado; o responsável confirma, negocia e aceita;
   · o pedido compartilha só o que está no formulário: nada de diário, partidas, planos, análises ou saúde;
     ligar o profissional ao acompanhamento do jogador é o convite de vínculo, separado e explícito;
   · cada proposta é uma versão nova; o aceite grava versão, data e quem aceitou; proposta aceita nunca é editada;
   · o app não marca nada como pago e não cria agenda: pagamento e horário são combinados direto com o profissional;
   · assinatura vencida, pausa ou suspensão impedem pedidos novos, mas as conversas que já existem continuam. */
const { ErroPublico, resposta, usuarioDoPedido, refJogador } = require("./_player");
const C = require("./_player-competicao");
const H = require("./_hub");
const D = require("./_hub-dados");

const NIVEL_FICHA = { iniciante: "iniciante", intermediario: "intermediario", avancado: "avancado", competidor: "competicao" };
const primeiroNome = (n) => String(n || "").trim().split(/\s+/)[0] || "Atleta";
const hist = (p, por, acao) => [...(p.historico || []).slice(-60), { em: H.agora(), por, acao }];

/* papel de quem chama dentro do pedido; null = não participa */
function ladoDe(ped, uid, resp) {
  if (uid === ped.profissionalUid) return "profissional";
  if (uid === ped.contratanteUid) return ped.menor && ped.contratantePapel === "responsavel" && !resp.some((r) => r.uid === uid) ? null : "contratante"; // responsável que perdeu o vínculo deixa de participar
  if (ped.menor && resp.some((r) => r.uid === uid)) return "responsavel";
  if (uid === ped.atletaUid) return ped.menor ? "atleta_menor" : "contratante";
  return null;
}
const decide = (lado) => lado === "contratante" || lado === "responsavel";
const escreve = (lado) => lado === "profissional" || decide(lado);

/* quem recebe aviso e conta não lida (todos menos quem agiu) */
function destinatarios(ped, resp, menos) {
  const l = [ped.profissionalUid, ped.contratanteUid, ped.atletaUid].concat(ped.menor ? resp.map((r) => r.uid) : []);
  return [...new Set(l)].filter((u) => u && u !== menos && !(ped.estado === "aguardando_responsavel" && u === ped.profissionalUid));
}
function somarNaoLidas(ped, uids) { const n = { ...(ped.naoLidas || {}) }; for (const u of uids) n[u] = (n[u] || 0) + 1; return n; }

async function carregar(id, uid) {
  if (!H.ID.test(String(id || ""))) throw new ErroPublico(400, "Pedido inválido.");
  const ref = D.col("hubPedidos").doc(id), s = await ref.get();
  if (!s.exists) throw new ErroPublico(404, "Pedido não encontrado.");
  const ped = s.data(), resp = ped.menor ? await D.responsaveisAtivos(ped.atletaUid) : [];
  const lado = ladoDe(ped, uid, resp);
  if (!lado || (lado === "profissional" && ped.estado === "aguardando_responsavel")) throw new ErroPublico(404, "Pedido não encontrado.");
  return { ref, ped, resp, lado };
}

/* registra um evento: grava o pedido, a mensagem (se houver), avisa e conta não lidas */
async function registrar(x, uid, mudanca, aviso, msg) {
  const ped = { ...x.ped, ...mudanca };
  const outros = destinatarios(ped, x.resp, uid);
  const upd = { ...mudanca, naoLidas: somarNaoLidas(ped, outros), atualizadoEm: H.agora(), historico: hist(x.ped, x.lado, aviso.historico || aviso.texto) };
  await x.ref.set(JSON.parse(JSON.stringify(upd)), { merge: true });
  if (msg) await x.ref.collection("mensagens").add({ porUid: uid, papel: x.lado, tipo: msg.tipo || "texto", texto: msg.texto, versao: msg.versao || null, em: H.agora() });
  if (aviso.tipo) await D.notificar(outros, aviso.tipo, x.ref.id, aviso.texto);
}

async function exigirConversaSegura(x) {
  if (x.ped.menor && !x.resp.length) throw new ErroPublico(409, "Esta conversa está pausada: o atleta é menor de idade e está sem responsável vinculado.");
  if (await D.bloqueado(x.ped.profissionalUid, [x.ped.contratanteUid, x.ped.atletaUid])) throw new ErroPublico(403, "A conversa foi bloqueada.");
}

async function listar(uid, ehProf) {
  const vistos = new Map(), hoje = H.hojeBR();
  const add = async (lado, docs) => { for (const d of docs) if (!vistos.has(d.id)) vistos.set(d.id, { d, lado }); };
  if (ehProf) await add("profissional", (await D.col("hubPedidos").where("profissionalUid", "==", uid).get()).docs.filter((d) => d.data().estado !== "aguardando_responsavel"));
  for (const campo of ["contratanteUid", "solicitanteUid", "atletaUid"]) await add(null, (await D.col("hubPedidos").where(campo, "==", uid).get()).docs);
  for (const a of await D.atletasDoResponsavel(uid)) await add(null, (await D.col("hubPedidos").where("atletaUid", "==", a.uid).get()).docs.filter((d) => d.data().menor));
  const comoProf = [], comoJogador = [];
  for (const { d, lado } of vistos.values()) {
    const ped = d.data(), resp = ped.menor ? await D.responsaveisAtivos(ped.atletaUid) : [];
    const l = lado || ladoDe(ped, uid, resp);
    if (!l) continue;
    const item = H.pedidoParaLado(d.id, ped, uid, l, hoje);
    delete item.propostas; delete item.historico;
    (l === "profissional" ? comoProf : comoJogador).push(item);
  }
  const ord = (a, b) => (b.naoLidas > 0) - (a.naoLidas > 0) || String(b.atualizadoEm).localeCompare(String(a.atualizadoEm));
  return { comoProfissional: comoProf.sort(ord), comoJogador: comoJogador.sort(ord) };
}

async function avisos(uid) {
  const l = (await D.col("hubNotificacoes").doc(uid).collection("itens").get()).docs.map((d) => ({ id: d.id, ...d.data() }));
  l.sort((a, b) => String(b.em).localeCompare(String(a.em)));
  return { itens: l.slice(0, 30), naoLidos: l.filter((x) => !x.lida).length };
}

exports.handler = async function (event) {
  try {
    const u = await usuarioDoPedido(event), uid = u.uid, ehProf = !!u.orgId, hoje = H.hojeBR();
    const q = event.queryStringParameters || {};

    if (event.httpMethod === "GET") {
      if (q.id) {
        const x = await carregar(String(q.id), uid);
        const msgs = (await x.ref.collection("mensagens").get()).docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.em).localeCompare(String(b.em)))
          .map((m) => ({ id: m.id, papel: m.papel, minha: m.porUid === uid, tipo: m.tipo, versao: m.versao, em: m.em, texto: m.oculta ? "Mensagem removida pela moderação." : m.texto, oculta: !!m.oculta }));
        if ((x.ped.naoLidas || {})[uid]) await x.ref.set({ naoLidas: { ...x.ped.naoLidas, [uid]: 0 } }, { merge: true });
        const av = await D.col("hubAvaliacoes").doc(x.ref.id).get();
        const p = H.pedidoParaLado(x.ref.id, x.ped, uid, x.lado, hoje);
        p.naoLidas = 0;
        return resposta(200, {
          pedido: p, mensagens: msgs,
          responsaveisNaConversa: x.ped.menor ? x.resp.map((r) => primeiroNome(r.nome)) : [],
          permissoes: { escrever: escreve(x.lado) && H.ABERTOS.includes(x.ped.estado) && x.ped.estado !== "aguardando_responsavel", decidir: decide(x.lado), profissional: x.lado === "profissional", confirmarEnvio: x.lado === "responsavel" && x.ped.estado === "aguardando_responsavel" },
          avaliacao: av.exists ? { nota: av.data().nota, comentario: av.data().comentario, em: av.data().em, resposta: av.data().resposta || null, oculta: !!av.data().oculta } : null,
          textos: { aceite: H.TEXTO_ACEITE, vinculo: "Este pedido não dá acesso ao seu diário, partidas, planos, análises ou dados de saúde. Para o profissional acompanhar seus treinos, gere um convite em Vínculos." },
        });
      }
      if (q.preparar) {
        const profUid = String(q.preparar), p = await D.perfil(profUid);
        if (!p) throw new ErroPublico(404, "Profissional não encontrado.");
        const js = await refJogador(uid).get();
        if (!js.exists) throw new ErroPublico(403, "Os pedidos são feitos pelo QuadraLab Player ou Competição.");
        const jog = js.data(), comp = jog.competicao || {}, nasc = comp.nascimento || jog.nascimento || null;
        const para = [];
        if (comp.papel !== "responsavel") {
          const menor = C.ehMenor(nasc, hoje);
          para.push({ id: "eu", nome: jog.nome || "Eu", menor, precisaDeclarar: !nasc, temResponsavel: menor ? (await D.responsaveisAtivos(uid)).length > 0 : null });
        }
        for (const a of await D.atletasDoResponsavel(uid)) {
          const ad = (await refJogador(a.uid).get()).data() || {}, an = (ad.competicao || {}).nascimento;
          if (!an || C.ehMenor(an, hoje)) para.push({ id: a.uid, nome: primeiroNome(ad.nome || a.nome), menor: true, precisaDeclarar: false, temResponsavel: true });
        }
        return resposta(200, {
          paraQuem: para, nivel: NIVEL_FICHA[(jog.ficha || {}).nivel] || "", cidade: jog.cidade || "",
          servicos: (p.servicos || []).filter((s) => s.abertoNovos !== false).map(H.servicoPublico), profissionalNome: p.nomeProfissional,
          recebePedidos: H.recebePedidos(p, await D.elegivel(p.orgId, hoje)), texto: H.TEXTO_ENVIO,
          compartilhado: "Vão para o profissional: o nome de quem pede, o primeiro nome do atleta (e se é menor de idade), o serviço, o objetivo, o nível, a modalidade, a cidade, os dias e turnos, a mensagem e o orçamento, se você informar. Nada do diário, partidas, planos, análises, saúde, e-mail ou telefone.",
        });
      }
      const l = await listar(uid, ehProf);
      return resposta(200, { ...l, avisos: await avisos(uid), estados: H.ESTADOS_PEDIDO });
    }

    if (event.httpMethod !== "POST") return resposta(405, { erro: "Método não permitido." });
    let b;
    try { b = JSON.parse(event.body || "{}"); } catch (e) { throw new ErroPublico(400, "Pedido inválido."); }

    if (b.acao === "lerNotificacoes") {
      for (const d of (await D.col("hubNotificacoes").doc(uid).collection("itens").get()).docs) if (!d.data().lida) await d.ref.update({ lida: true });
      return resposta(200, { ok: true });
    }

    if (b.acao === "enviar") {
      const js = await refJogador(uid).get();
      if (!js.exists) throw new ErroPublico(403, "Os pedidos são feitos pelo QuadraLab Player ou Competição.");
      const jog = js.data(), comp = jog.competicao || {};
      const profUid = String(b.profissionalUid || "");
      if (profUid === uid) throw new ErroPublico(400, "Você não pode pedir atendimento a si mesmo.");
      const p = /^[A-Za-z0-9]{1,128}$/.test(profUid) ? await D.perfil(profUid) : null;
      if (!p) throw new ErroPublico(404, "Profissional não encontrado.");
      if (!/^[A-Za-z0-9_-]{8,64}$/.test(String(b.chave || ""))) throw new ErroPublico(400, "Atualize a página e tente de novo.");
      const id = D.idPedido(uid, b.chave);
      if ((await D.col("hubPedidos").doc(id).get()).exists) return resposta(200, { ok: true, id, repetido: true, mensagem: H.TEXTO_ENVIADO });
      if (!H.recebePedidos(p, await D.elegivel(p.orgId, hoje))) throw new ErroPublico(409, "Este profissional não está recebendo novos pedidos no momento.");
      const r = H.validarPedido(b);
      if (!r.ok) return resposta(400, { erro: r.erros[0], erros: r.erros });

      /* para quem: o próprio jogador ou um atleta menor vinculado a este responsável */
      let atletaUid, atletaNome, menor, contratanteUid, papel, declaracao = null;
      if (!b.paraQuem || b.paraQuem === "eu") {
        if (comp.papel === "responsavel") throw new ErroPublico(400, "Escolha para qual atleta é o atendimento.");
        const nasc = comp.nascimento || jog.nascimento || null;
        atletaUid = uid; menor = C.ehMenor(nasc, hoje);
        if (!nasc) {
          if (b.maior18 !== true) return resposta(400, { erro: "Confirme que você tem 18 anos ou mais. Menores de idade pedem atendimento com um responsável vinculado.", precisaDeclarar: true });
          declaracao = { maior18: true, em: H.agora() };
        }
        atletaNome = menor ? primeiroNome(jog.nome) : jog.nome || u.name || "Jogador";
        contratanteUid = menor ? null : uid; papel = menor ? null : "atleta";
        if (menor && !(await D.responsaveisAtivos(uid)).length) throw new ErroPublico(409, "Como você é menor de idade, vincule primeiro um responsável: ele confirma e conversa com o profissional.");
      } else {
        const meus = await D.atletasDoResponsavel(uid), a = meus.find((x) => x.uid === String(b.paraQuem));
        if (!a) throw new ErroPublico(403, "Você só pode pedir para um atleta com quem tem vínculo ativo de responsável.");
        const ad = (await refJogador(a.uid).get()).data() || {}, an = (ad.competicao || {}).nascimento;
        if (an && !C.ehMenor(an, hoje)) throw new ErroPublico(409, "Atleta maior de idade faz o próprio pedido.");
        atletaUid = a.uid; atletaNome = primeiroNome(ad.nome || a.nome); menor = true; contratanteUid = uid; papel = "responsavel";
      }
      if (await D.bloqueado(profUid, [uid, atletaUid])) throw new ErroPublico(403, "Não é possível enviar pedidos a este profissional.");

      let serv = null;
      if (r.pedido.servicoId) {
        serv = (p.servicos || []).find((s) => s.id === r.pedido.servicoId);
        if (!serv || serv.abertoNovos === false) throw new ErroPublico(409, "Este serviço não está aberto a novos pedidos. Escolha outro.");
      }
      const existentes = (await D.col("hubPedidos").where("profissionalUid", "==", profUid).where("atletaUid", "==", atletaUid).get()).docs.filter((d) => H.ABERTOS.includes(d.data().estado));
      const igual = existentes.find((d) => (d.data().pedido || {}).servicoId === r.pedido.servicoId);
      if (igual) return resposta(409, { erro: "Já existe um pedido em andamento com este profissional para este serviço. Continue por Meus atendimentos.", id: igual.id, duplicado: true });
      const abertosMeus = (await D.col("hubPedidos").where("solicitanteUid", "==", uid).get()).docs.filter((d) => H.ABERTOS.includes(d.data().estado)).length;
      if (abertosMeus >= H.MAX_ABERTOS_POR_PESSOA) throw new ErroPublico(429, "Você já tem " + H.MAX_ABERTOS_POR_PESSOA + " pedidos em andamento. Conclua ou cancele algum antes de enviar outro.");

      const estado = contratanteUid ? "aguardando_resposta" : "aguardando_responsavel";
      const ped = {
        profissionalUid: profUid, profissionalNome: p.nomeProfissional, solicitanteUid: uid, contratanteUid, contratantePapel: papel,
        contratanteNome: contratanteUid ? jog.nome || u.name || "Jogador" : null, atletaUid, atletaNome, menor, declaracao,
        origem: b.modo === "competicao" ? "competicao" : "player", pedido: r.pedido, servicoNome: serv ? serv.nome : "A combinar",
        estado, propostas: [], naoLidas: {}, criadoEm: H.agora(), atualizadoEm: H.agora(), enviadoEm: contratanteUid ? H.agora() : null,
        historico: [{ em: H.agora(), por: papel || "atleta_menor", acao: contratanteUid ? "pedido enviado" : "pedido criado, aguarda o responsável" }],
      };
      const ref = D.col("hubPedidos").doc(id);
      if (contratanteUid) {
        ped.naoLidas[profUid] = 1;
        await ref.set(ped);
        await D.notificar([profUid], "novo_pedido", id, "Novo pedido de atendimento de " + primeiroNome(ped.contratanteNome) + ".");
        await D.metrica({ pedidos: 1 }); await D.metricaProfissional(profUid, { pedidos: 1 });
        return resposta(200, { ok: true, id, estado, mensagem: H.TEXTO_ENVIADO });
      }
      const resp = await D.responsaveisAtivos(uid);
      for (const x of resp) ped.naoLidas[x.uid] = 1;
      await ref.set(ped);
      await D.notificar(resp.map((x) => x.uid), "confirmar_pedido", id, atletaNome + " quer pedir um atendimento a " + p.nomeProfissional + ". Confirme o envio.");
      return resposta(200, { ok: true, id, estado, mensagem: "Pedido criado. Seu responsável precisa confirmar o envio em Meus atendimentos." });
    }

    if (b.acao === "denunciar") {
      const motivo = H.MOTIVOS_DENUNCIA[b.motivo] ? b.motivo : null;
      if (!motivo) throw new ErroPublico(400, "Escolha o motivo.");
      const texto = H.txt(b.texto, 500, true);
      if (texto === null) throw new ErroPublico(400, "Descreva em até 500 letras.");
      let alvo, conteudo = "";
      if (b.tipo === "perfil") {
        const p = await D.perfil(String(b.profissionalUid || ""));
        if (!p) throw new ErroPublico(404, "Perfil não encontrado.");
        alvo = { profissionalUid: String(b.profissionalUid) }; conteudo = p.nomeProfissional + " — " + (p.apresentacao || "");
      } else if (b.tipo === "mensagem") {
        const x = await carregar(String(b.pedidoId || ""), uid);
        const m = await x.ref.collection("mensagens").doc(String(b.mensagemId || "x")).get();
        if (!m.exists || m.data().porUid === uid) throw new ErroPublico(404, "Mensagem não encontrada.");
        alvo = { pedidoId: x.ref.id, mensagemId: m.id, profissionalUid: x.ped.profissionalUid, autorPapel: m.data().papel }; conteudo = m.data().texto;
      } else if (b.tipo === "avaliacao") {
        const a = await D.col("hubAvaliacoes").doc(String(b.avaliacaoId || "x")).get();
        if (!a.exists) throw new ErroPublico(404, "Avaliação não encontrada.");
        alvo = { avaliacaoId: a.id, profissionalUid: a.data().profissionalUid }; conteudo = a.data().comentario || "";
      } else throw new ErroPublico(400, "O que você quer denunciar?");
      await D.col("hubDenuncias").add({ tipo: b.tipo, alvo, conteudo: String(conteudo).slice(0, 1600), motivo, texto, porUid: uid, em: H.agora(), estado: "aberta" });
      return resposta(200, { ok: true, mensagem: "Denúncia recebida. A moderação vai analisar." });
    }

    if (b.acao === "bloquear" || b.acao === "desbloquear") {
      let prof, pessoa;
      if (b.id) {
        const x = await carregar(String(b.id), uid);
        if (x.lado === "profissional") { prof = uid; pessoa = x.ped.contratanteUid || x.ped.solicitanteUid; }
        else if (decide(x.lado)) { prof = x.ped.profissionalUid; pessoa = uid; }
        else throw new ErroPublico(403, "Peça ao seu responsável.");
      } else { prof = String(b.profissionalUid || ""); pessoa = uid; if (!(await D.perfil(prof))) throw new ErroPublico(404, "Perfil não encontrado."); }
      const ref = D.col("hubBloqueios").doc(D.idBloqueio(prof, pessoa));
      if (b.acao === "bloquear") await ref.set({ profissionalUid: prof, pessoaUid: pessoa, porUid: uid, em: H.agora() });
      else { const s = await ref.get(); if (s.exists && s.data().porUid !== uid) throw new ErroPublico(403, "Só quem bloqueou pode desbloquear."); await ref.delete(); }
      return resposta(200, { ok: true });
    }

    /* demais ações: sobre um pedido existente, só por participantes */
    const x = await carregar(String(b.id || ""), uid), ped = x.ped, nome = x.lado === "profissional" ? "O profissional" : primeiroNome(ped.contratanteNome || ped.atletaNome);

    if (b.acao === "confirmarEnvio") {
      if (x.lado !== "responsavel" || ped.estado !== "aguardando_responsavel") throw new ErroPublico(409, "Este pedido não está aguardando a sua confirmação.");
      const p = await D.perfil(ped.profissionalUid);
      if (!p || !H.recebePedidos(p, await D.elegivel(p.orgId, hoje))) throw new ErroPublico(409, "Este profissional não está recebendo novos pedidos no momento.");
      if (await D.bloqueado(ped.profissionalUid, [uid, ped.atletaUid])) throw new ErroPublico(403, "Não é possível enviar pedidos a este profissional.");
      const jog = (await refJogador(uid).get()).data() || {};
      await registrar({ ...x, ped: { ...ped, estado: "aguardando_resposta" } }, uid, { estado: "aguardando_resposta", contratanteUid: uid, contratantePapel: "responsavel", contratanteNome: jog.nome || u.name || "Responsável", enviadoEm: H.agora() },
        { tipo: "novo_pedido", texto: "Novo pedido de atendimento de " + primeiroNome(jog.nome) + " (responsável).", historico: "pedido confirmado pelo responsável e enviado" });
      await D.metrica({ pedidos: 1 }); await D.metricaProfissional(ped.profissionalUid, { pedidos: 1 });
      return resposta(200, { ok: true, mensagem: H.TEXTO_ENVIADO });
    }

    if (b.acao === "mensagem") {
      if (!escreve(x.lado)) throw new ErroPublico(403, ped.menor ? "Quem conversa com o profissional é o seu responsável." : "Você não pode escrever neste pedido.");
      if (!H.ABERTOS.includes(ped.estado) || ped.estado === "aguardando_responsavel") throw new ErroPublico(409, "Esta conversa está encerrada.");
      const texto = H.txt(b.texto, 1000, true);
      if (!texto) throw new ErroPublico(400, texto === null ? "A mensagem tem até 1.000 letras." : "Escreva a mensagem.");
      await exigirConversaSegura(x);
      const mud = {};
      if (x.lado === "profissional" && ped.estado === "aguardando_resposta") {
        mud.estado = "em_conversa"; mud.primeiraRespostaEm = H.agora();
        const min = Math.max(0, Math.round((Date.now() - Date.parse(ped.enviadoEm || ped.criadoEm)) / 60000));
        await D.metrica({ respostas: 1, minPrimeiraResposta: min }); await D.metricaProfissional(uid, { respondidos: 1, minPrimeiraResposta: min });
      }
      await registrar(x, uid, mud, { tipo: "mensagem", texto: "Nova mensagem de " + nome + ".", historico: "mensagem" }, { texto });
      return resposta(200, { ok: true });
    }

    if (b.acao === "proposta") {
      if (x.lado !== "profissional") throw new ErroPublico(403, "Só o profissional envia propostas.");
      if (!["aguardando_resposta", "em_conversa", "proposta_enviada", "combinado"].includes(ped.estado)) throw new ErroPublico(409, "Este pedido não aceita propostas agora.");
      await exigirConversaSegura(x);
      const r = H.validarProposta(b.proposta || {}, hoje);
      if (!r.ok) return resposta(400, { erro: r.erros[0], erros: r.erros });
      const versao = (ped.propostas || []).length + 1;
      const propostas = (ped.propostas || []).map((v) => (v.estado === "vigente" || v.estado === "ajuste_pedido" ? { ...v, estado: "substituida" } : v));
      propostas.push({ versao, ...r.proposta, estado: "vigente", criadaEm: H.agora() });
      const mud = { propostas, estado: ped.estado === "combinado" ? "combinado" : "proposta_enviada" };
      if (ped.estado === "aguardando_resposta") {
        mud.primeiraRespostaEm = H.agora();
        const min = Math.max(0, Math.round((Date.now() - Date.parse(ped.enviadoEm || ped.criadoEm)) / 60000));
        await D.metrica({ respostas: 1, minPrimeiraResposta: min }); await D.metricaProfissional(uid, { respondidos: 1, minPrimeiraResposta: min });
      }
      await registrar(x, uid, mud, { tipo: "proposta", texto: (ped.estado === "combinado" ? "Alteração da proposta" : "Nova proposta") + " (versão " + versao + ") de " + ped.profissionalNome + ".", historico: "proposta versão " + versao }, { tipo: "proposta", texto: "Proposta versão " + versao + " enviada.", versao });
      await D.metrica({ propostas: 1 }); await D.metricaProfissional(uid, { propostas: 1 });
      return resposta(200, { ok: true, versao });
    }

    if (["pedirAjuste", "aceitar", "recusarProposta"].includes(b.acao)) {
      if (!decide(x.lado)) throw new ErroPublico(403, ped.menor ? "Quem decide a proposta é o responsável." : "Só quem contrata decide a proposta.");
      const v = H.propostaVigente(ped);
      if (!v || Number(b.versao) !== v.versao) throw new ErroPublico(409, "Esta versão da proposta não está mais valendo. Abra o pedido de novo para ver a versão atual.");
      await exigirConversaSegura(x);
      const trocar = (estado, extra) => (ped.propostas || []).map((p) => (p.versao === v.versao ? { ...p, estado, ...extra } : p));
      if (b.acao === "pedirAjuste") {
        const texto = H.txt(b.texto, 1000, true);
        if (!texto) throw new ErroPublico(400, "Explique o ajuste que você quer.");
        await registrar(x, uid, { propostas: trocar("ajuste_pedido", { ajusteEm: H.agora() }), estado: ped.estado === "combinado" ? "combinado" : "em_conversa" },
          { tipo: "ajuste", texto: nome + " pediu ajuste na proposta versão " + v.versao + ".", historico: "ajuste pedido na versão " + v.versao }, { tipo: "ajuste", texto, versao: v.versao });
        return resposta(200, { ok: true });
      }
      if (b.acao === "recusarProposta") {
        await registrar(x, uid, { propostas: trocar("recusada", { recusadaEm: H.agora() }), estado: ped.estado === "combinado" ? "combinado" : "em_conversa" },
          { tipo: "recusa", texto: nome + " recusou a proposta versão " + v.versao + ".", historico: "proposta versão " + v.versao + " recusada" }, { tipo: "sistema", texto: "Proposta versão " + v.versao + " recusada.", versao: v.versao });
        return resposta(200, { ok: true });
      }
      if (b.confirmo !== true) throw new ErroPublico(400, H.TEXTO_ACEITE);
      if (v.validade < hoje) throw new ErroPublico(409, "Esta proposta venceu em " + v.validade.split("-").reverse().join("/") + ". Peça uma nova versão ao profissional.");
      const aceite = { versao: v.versao, em: H.agora(), porUid: uid, papel: x.lado === "responsavel" || ped.contratantePapel === "responsavel" ? "responsavel" : "atleta", texto: H.TEXTO_ACEITE };
      const era = ped.estado === "combinado";
      await registrar(x, uid, { propostas: trocar("aceita", { aceitaEm: aceite.em }), estado: "combinado", aceite, aceites: [...(ped.aceites || []), aceite] },
        { tipo: "aceite", texto: nome + " aceitou a proposta versão " + v.versao + ".", historico: "proposta versão " + v.versao + " aceita" }, { tipo: "sistema", texto: "Proposta versão " + v.versao + " aceita.", versao: v.versao });
      if (!era) { await D.metrica({ aceites: 1 }); await D.metricaProfissional(ped.profissionalUid, { combinados: 1 }); }
      return resposta(200, { ok: true });
    }

    if (b.acao === "recusar") {
      if (x.lado !== "profissional") throw new ErroPublico(403, "Só o profissional recusa o pedido.");
      if (!["aguardando_resposta", "em_conversa", "proposta_enviada"].includes(ped.estado)) throw new ErroPublico(409, "Este pedido não pode ser recusado agora.");
      const motivo = H.txt(b.motivo, 300, true) || "";
      await registrar(x, uid, { estado: "recusado", encerradoEm: H.agora() }, { tipo: "recusa", texto: ped.profissionalNome + " recusou o pedido.", historico: "pedido recusado" }, motivo ? { tipo: "sistema", texto: "Pedido recusado: " + motivo } : null);
      return resposta(200, { ok: true });
    }
    if (b.acao === "cancelar") {
      const podeJogador = decide(x.lado) || (x.lado === "atleta_menor" && ped.estado === "aguardando_responsavel");
      if (!(podeJogador || (x.lado === "profissional" && ped.estado === "combinado"))) throw new ErroPublico(403, x.lado === "profissional" ? "Antes do acordo, use Recusar ou Encerrar sem acordo." : "Peça ao seu responsável para cancelar.");
      if (!H.ABERTOS.includes(ped.estado)) throw new ErroPublico(409, "Este pedido já foi encerrado.");
      const motivo = H.txt(b.motivo, 300, true) || "";
      await registrar(x, uid, { estado: "cancelado", encerradoEm: H.agora() }, { tipo: "cancelamento", texto: nome + " cancelou o atendimento.", historico: "cancelado" }, motivo ? { tipo: "sistema", texto: "Cancelado: " + motivo } : null);
      return resposta(200, { ok: true });
    }
    if (b.acao === "encerrar") {
      if (!(x.lado === "profissional" || decide(x.lado))) throw new ErroPublico(403, "Peça ao seu responsável.");
      if (!["em_conversa", "proposta_enviada"].includes(ped.estado)) throw new ErroPublico(409, "Só dá para encerrar sem acordo uma conversa em andamento.");
      await registrar(x, uid, { estado: "encerrado_sem_acordo", encerradoEm: H.agora() }, { tipo: "encerramento", texto: nome + " encerrou a conversa sem acordo.", historico: "encerrado sem acordo" }, null);
      return resposta(200, { ok: true });
    }
    if (b.acao === "concluir") {
      if (ped.estado !== "combinado") throw new ErroPublico(409, "Só um atendimento combinado pode ser concluído.");
      if (x.lado === "profissional") {
        await registrar(x, uid, { conclusao: { marcadoPor: "profissional", em: H.agora() } }, { tipo: "conclusao", texto: ped.profissionalNome + " marcou o atendimento como concluído. Confirme se está tudo certo.", historico: "conclusão marcada pelo profissional" }, null);
        return resposta(200, { ok: true, aguardandoConfirmacao: true });
      }
      if (!decide(x.lado)) throw new ErroPublico(403, "Quem confirma é o seu responsável.");
      await registrar(x, uid, { estado: "concluido", conclusao: { marcadoPor: (ped.conclusao || {}).marcadoPor || x.lado, em: (ped.conclusao || {}).em || H.agora(), confirmadoPorUid: uid, confirmadoEm: H.agora() } },
        { tipo: "conclusao", texto: nome + " confirmou a conclusão do atendimento.", historico: "conclusão confirmada" }, null);
      await D.metrica({ concluidos: 1 }); await D.metricaProfissional(ped.profissionalUid, { concluidos: 1 });
      return resposta(200, { ok: true });
    }
    if (b.acao === "avaliar") {
      if (!decide(x.lado)) throw new ErroPublico(403, ped.menor ? "A avaliação é feita pelo responsável." : "Só quem contratou avalia.");
      if (ped.estado !== "concluido") throw new ErroPublico(409, "A avaliação abre depois que o atendimento é concluído e confirmado.");
      const ref = D.col("hubAvaliacoes").doc(x.ref.id);
      if (ped.avaliado || (await ref.get()).exists) throw new ErroPublico(409, "Este atendimento já foi avaliado.");
      const nota = Number(b.nota), comentario = H.txt(b.comentario, 600, true);
      if (!Number.isInteger(nota) || nota < 1 || nota > 5) throw new ErroPublico(400, "Dê uma nota de 1 a 5.");
      if (comentario === null) throw new ErroPublico(400, "O comentário tem até 600 letras.");
      if (H.temContatoPrivado(comentario)) throw new ErroPublico(400, "Tire contatos e links do comentário: ele fica público no perfil.");
      await ref.set({ profissionalUid: ped.profissionalUid, pedidoId: x.ref.id, nota, comentario, autorNome: primeiroNome(ped.contratanteNome), servicoNome: ped.servicoNome, em: H.agora(), oculta: false });
      await registrar(x, uid, { avaliado: true }, { tipo: "avaliacao", texto: "Seu atendimento recebeu uma avaliação.", historico: "avaliado" }, null);
      return resposta(200, { ok: true });
    }
    if (b.acao === "responderAvaliacao") {
      if (x.lado !== "profissional") throw new ErroPublico(403, "Só o profissional responde à avaliação.");
      const ref = D.col("hubAvaliacoes").doc(x.ref.id), a = await ref.get();
      if (!a.exists) throw new ErroPublico(404, "Avaliação não encontrada.");
      if (a.data().resposta) throw new ErroPublico(409, "Você já respondeu a esta avaliação.");
      const texto = H.txt(b.texto, 600, true);
      if (!texto) throw new ErroPublico(400, "Escreva a resposta (até 600 letras).");
      if (H.temContatoPrivado(texto)) throw new ErroPublico(400, "Tire contatos e links da resposta: ela fica pública no perfil.");
      await ref.set({ resposta: { texto, em: H.agora() } }, { merge: true });
      return resposta(200, { ok: true });
    }
    throw new ErroPublico(400, "Ação desconhecida.");
  } catch (e) {
    if (e instanceof ErroPublico) return resposta(e.status, { erro: e.message });
    console.error("hub-atendimentos:", e && e.message);
    return resposta(500, { erro: "Não foi possível concluir agora. Tente de novo em instantes." });
  }
};
