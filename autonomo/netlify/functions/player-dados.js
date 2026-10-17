/* QuadraLab Player — leitura e gravação dos dados do próprio jogador.

   GET                      → perfil, ficha, planos e quantos planos ainda pode gerar
   GET ?plano={id}          → só aquele plano (o app consulta enquanto ele é gerado)
   GET ?planejamento={id}   → só aquele planejamento por semanas
   POST { acao: "salvarFicha", ficha } → grava a ficha (validada em _player.js)
   POST { acao: "escolherJogadas", planoId, escolhidas } → grava quais jogadas do plano o jogador quer treinar

   Sempre pelo uid do token: um jogador nunca alcança dados de outro. */
const {
  admin, ErroPublico, resposta, usuarioDoPedido, refJogador, resumoAssinatura, fonteDeEstrategia,
  PLANOS_GRATIS, planoFull, nivelDoJogador, recursosDoNivel, normalizarFicha, limparComplementos, GRUPOS_PERGUNTA, fichaCompleta,
} = require("./_player");

const { aplicarPendentes } = require("./_player-faturas");

const ID_VALIDO = /^[A-Za-z0-9_-]{8,40}$/;
const STATUS_SESSAO = ["em_andamento", "feito", "parcial", "nao_feito"];

function publicoPlano(id, p) {
  return {
    id,
    status: p.status,
    criadoEm: p.criadoEm,
    fonte: p.fonte || null,
    adversarioNome: p.adversarioNome || null,
    plano: p.status === "pronto" ? p.plano : null,
    erro: p.status === "erro" ? p.erro : null,
    ...(p.status === "erro" && p.semCota ? { semCota: true, motivoCota: p.motivoCota || null, renovaEm: p.renovaEm || null } : {}),
    escolhidas: Array.isArray(p.escolhidas) ? p.escolhidas : [],
    ...(p.status === "pronto" && p.plano && p.plano.evolucao ? { fundamentacao: p.fundamentacao || null, decisoes: p.decisoes || {} } : {}),
  };
}

function publicoPlanejamento(id, p, completo) {
  const base = {
    id, status: p.status, criadoEm: p.criadoEm, baseadoEm: p.baseadoEm || null, params: p.params || null, arquivado: !!p.arquivado,
    erro: p.status === "erro" ? p.erro : null,
    ...(p.status === "erro" && p.semCota ? { semCota: true, motivoCota: p.motivoCota || null, renovaEm: p.renovaEm || null } : {}),
  };
  if (p.status === "pronto" && p.planejamento) {
    if (completo) { base.planejamento = p.planejamento; base.registros = p.registros || {}; }
    else {
      /* a lista já traz cada treino com a sua situação: Início e Treinos escolhem o próximo treino com a mesma regra, sem outra consulta */
      const regs = p.registros || {};
      base.titulo = p.planejamento.titulo;
      base.sessoes = [];
      for (const w of p.planejamento.semanas || []) {
        for (const x of w.sessoes || []) {
          const r = regs[x.id];
          base.sessoes.push({ id: x.id, semana: w.n, data: x.data, titulo: x.titulo, status: r ? r.status : "pendente", blocos: (x.itens || []).length });
        }
      }
    }
  }
  return base;
}

const COTAS = require("./_player-cotas");
const PART = require("./_player-partidas");

function hojeNoBrasil() { return new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10); }

function cotas(dados, email) {
  const c = fonteDeEstrategia(dados, email);
  if (c.fonte === "full") return { full: true, gratisRestantes: 0, creditos: 0, podeGerar: true, fonteCota: "full" };
  const gratisRestantes = Math.max(0, PLANOS_GRATIS - (dados.planosGratisUsados || 0));
  const creditos = Math.max(0, dados.creditosPlano || 0);
  if (COTAS.modeloAtivo()) {
    const hoje = hojeNoBrasil();
    const planoId = COTAS.planoIdDoNivel(nivelDoJogador(dados, email, hoje), false);
    const j = COTAS.avaliarGeracao(dados, { planoId, tipo: "planosJogo", hoje }), a = COTAS.avaliarGeracao(dados, { planoId, tipo: "estrategiasAdversario", hoje });
    const motivo = j.fonte ? null : j;
    return {
      full: false, modelo: true, gratisRestantes, creditos, podeGerar: !!(j.fonte || a.fonte), podePlanoJogo: !!j.fonte, podeAdversario: !!a.fonte, fonteCota: j.fonte || a.fonte || null,
      ...(motivo ? { semCotaMotivo: motivo.motivo, ...(motivo.renovaEm ? { renovaEm: motivo.renovaEm } : {}) } : {}),
    };
  }
  return {
    full: false, gratisRestantes, creditos, podeGerar: !!c.fonte, fonteCota: c.fonte || null,
    ...(c.fonte ? {} : { semCotaMotivo: c.motivo, ...(c.renovaEm ? { renovaEm: c.renovaEm } : {}) }),
  };
}

exports.handler = async function (event) {
  try {
    const usuario = await usuarioDoPedido(event);
    const ref = refJogador(usuario.uid);

    if (event.httpMethod === "GET") {
      const idPlano = (event.queryStringParameters || {}).plano;
      if (idPlano) {
        const s = await ref.collection("planos").doc(String(idPlano)).get();
        if (!s.exists) return resposta(404, { erro: "Plano não encontrado." });
        return resposta(200, { plano: publicoPlano(s.id, s.data()) });
      }

      const idPlanejamento = (event.queryStringParameters || {}).planejamento;
      if (idPlanejamento) {
        const s = await ref.collection("planejamentos").doc(String(idPlanejamento)).get();
        if (!s.exists) return resposta(404, { erro: "Planejamento não encontrado." });
        return resposta(200, { planejamento: publicoPlanejamento(s.id, s.data(), true) });
      }

      let snap = await ref.get();
      if (!snap.exists) {
        /* Conta que existe no login mas ainda não tem documento de
           jogador (ex.: entrou com um e-mail já cadastrado no QuadraLab):
           nasce aqui, com a mesma cota grátis de qualquer jogador novo. */
        await ref.set({
          nome: usuario.name || "", email: usuario.email || "",
          criadoEm: new Date().toISOString(), planosGratisUsados: 0, creditosPlano: 0,
        });
        snap = await ref.get();
      }
      let dados = snap.data();
      /* quem pagou a assinatura antes de criar a conta recebe o acesso ao entrar com o e-mail da compra */
      if (!dados.assinatura && usuario.email) {
        try {
          await aplicarPendentes(admin.firestore(), usuario.uid, usuario.email);
          dados = (await ref.get()).data() || dados;
        } catch (e) { console.error("player-dados: falha ao aplicar assinatura pendente", e); }
      }
      const planosSnap = await ref.collection("planos").orderBy("criadoEm", "desc").limit(20).get();
      const planos = [];
      planosSnap.forEach((d) => planos.push(publicoPlano(d.id, d.data())));
      const planejSnap = await ref.collection("planejamentos").orderBy("criadoEm", "desc").limit(20).get();
      const planejamentos = [];
      planejSnap.forEach((d) => planejamentos.push(publicoPlanejamento(d.id, d.data(), false)));
      const partSnap = await ref.collection("partidas").orderBy("data", "desc").limit(300).get();
      const partidas = []; partSnap.forEach((d) => partidas.push({ id: d.id, ...d.data() }));
      const nivelPlano = nivelDoJogador(dados, usuario.email);
      const ficha = dados.ficha || null;
      const assinatura = resumoAssinatura(dados, usuario.email);
      return resposta(200, {
        nivelPlano, recursos: COTAS.modeloAtivo() ? { ...recursosDoNivel(nivelPlano), planejamento: true, treinoDia: true } : recursosDoNivel(nivelPlano), planejamentos,
        adversariosCadastrados: Object.values(dados.adversarios || {}).map((a) => a.nome).filter(Boolean),
        desafio: dados.desafio || null,
        partidas, resumoPartidas: PART.resumoPartidas(partidas), relatorios: COTAS.modeloAtivo() ? ({ free: "basico", start: "mensal", pro: "periodo", performance: "avancado", full: "avancado" })[COTAS.planoIdDoNivel(nivelPlano, planoFull(usuario.email))] || "basico" : "avancado",
        janelaIA: require("./_player-evolucao").janelaDoPlano(COTAS.planoIdDoNivel(nivelPlano, planoFull(usuario.email))), opcoesPartida: { tipos: PART.TIPOS, superficies: PART.SUPERFICIES, resultados: PART.RESULTADOS, execucao: PART.EXECUCAO, aspectos: PART.ASPECTOS },
        assinatura, fichaAtualizadaEm: dados.fichaAtualizadaEm || null,
        perfil: { nome: dados.nome || "", email: usuario.email || dados.email || "", foto: dados.foto || "" },
        ficha, complementos: limparComplementos(dados.complementos),
        fichaCompleta: !!ficha && fichaCompleta(ficha),
        planos,
        ...cotas(dados, usuario.email),
      });
    }

    if (event.httpMethod === "POST") {
      let body;
      try { body = JSON.parse(event.body || "{}"); }
      catch (e) { throw new ErroPublico(400, "Corpo da requisição inválido."); }
      if (body.acao === "escolherJogadas") {
        const idPlano = String(body.planoId || "");
        if (!ID_VALIDO.test(idPlano)) throw new ErroPublico(400, "Plano inválido.");
        const refPlano = ref.collection("planos").doc(idPlano);
        const sPlano = await refPlano.get();
        if (!sPlano.exists || sPlano.data().status !== "pronto") throw new ErroPublico(404, "Plano não encontrado.");
        const total = ((sPlano.data().plano || {}).jogadas || []).length;
        const bruto = Array.isArray(body.escolhidas) ? body.escolhidas : [];
        const escolhidas = [...new Set(bruto.filter((n) => Number.isInteger(n) && n >= 0 && n < total))].sort((a, b) => a - b);
        await refPlano.update({ escolhidas });
        return resposta(200, { ok: true, escolhidas });
      }
      if (body.acao === "salvarConta") {
        /* dados da CONTA (nome e foto opcional); o perfil esportivo é a ficha */
        const nome = String(body.nome || "").replace(/\s+/g, " ").trim().slice(0, 80);
        if (!nome) throw new ErroPublico(400, "Informe seu nome.");
        const atualiza = { nome };
        if (body.foto === "") atualiza.foto = "";
        else if (body.foto != null) {
          const foto = String(body.foto);
          if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(foto) || foto.length > 60000) throw new ErroPublico(400, "A foto precisa ser uma imagem JPEG pequena. Tente outra foto.");
          atualiza.foto = foto;
        }
        await ref.set(atualiza, { merge: true });
        try { await admin.auth().updateUser(usuario.uid, { displayName: nome }); } catch (e) { console.error("player-dados: nome não atualizado no login", e); }
        return resposta(200, { ok: true, perfil: { nome, email: usuario.email || "", foto: atualiza.foto !== undefined ? atualiza.foto : ((await ref.get()).data() || {}).foto || "" } });
      }
      if (body.acao === "salvarComplementos") {
        /* respostas do jogador às perguntas do plano: entram nos próximos planos e programas de treino */
        const atuais = limparComplementos(((await ref.get()).data() || {}).complementos);
        const chaveDe = (c) => c.pergunta + "|" + c.contexto;
        const porChave = new Map(atuais.map((c) => [chaveDe(c), c]));
        for (const c of Array.isArray(body.complementos) ? body.complementos.slice(0, 20) : []) {
          const pergunta = String((c && c.pergunta) || "").replace(/\s+/g, " ").trim().slice(0, 300);
          const resposta = String((c && c.resposta) || "").replace(/\s+/g, " ").trim().slice(0, 500);
          const grupo = GRUPOS_PERGUNTA.includes(c && c.grupo) ? c.grupo : "jogador";
          const contexto = grupo === "jogador" ? "" : String((c && c.contexto) || "").replace(/\s+/g, " ").trim().slice(0, 60);
          if (!pergunta) continue;
          const chave = pergunta + "|" + contexto;
          porChave.delete(chave); // regravar move para o fim: as mais recentes ficam
          if (resposta) porChave.set(chave, { pergunta, resposta, grupo, contexto });
        }
        const complementos = limparComplementos([...porChave.values()].slice(-16));
        await ref.set({ complementos }, { merge: true });
        return resposta(200, { ok: true, complementos });
      }
      if (body.acao === "registrarSessao") {
        /* Treino do dia (Plano 2): o servidor confere o direito ao recurso e
           que a sessão existe naquele planejamento — o app esconder o botão
           não protege nada. */
        const dadosJ = (await ref.get()).data() || {};
        if (!COTAS.modeloAtivo() && !recursosDoNivel(nivelDoJogador(dadosJ, usuario.email)).treinoDia) {
          throw new ErroPublico(403, "O registro de treinos faz parte de uma assinatura. Veja as opções em Minha assinatura.");
        }
        const idPlanej = String(body.planejamentoId || "");
        const idSessao = String(body.sessaoId || "");
        if (!ID_VALIDO.test(idPlanej) || !/^s\d{1,2}-\d{1,2}$/.test(idSessao)) throw new ErroPublico(400, "Sessão inválida.");
        if (!STATUS_SESSAO.includes(body.status)) throw new ErroPublico(400, "Status inválido.");
        const refPlanej = ref.collection("planejamentos").doc(idPlanej);
        const sPlanej = await refPlanej.get();
        const pj = sPlanej.exists ? sPlanej.data() : null;
        if (!pj || pj.status !== "pronto" || !pj.planejamento) throw new ErroPublico(404, "Planejamento não encontrado.");
        const existe = (pj.planejamento.semanas || []).some((w) => (w.sessoes || []).some((x) => x.id === idSessao));
        if (!existe) throw new ErroPublico(404, "Sessão não encontrada.");
        const obs = String(body.obs || "").replace(/\s+/g, " ").trim().slice(0, 600);
        const sessaoPlan = pj.planejamento.semanas.flatMap((w) => w.sessoes).find((x) => x.id === idSessao);
        const nBlocos = (sessaoPlan.itens || []).length;
        const blocos = [...new Set((Array.isArray(body.blocos) ? body.blocos : []).filter((n) => Number.isInteger(n) && n >= 0 && n < nBlocos))].sort((a, b) => a - b);
        const anterior = (pj.registros || {})[idSessao] || {};
        const agora = new Date().toISOString();
        const registro = { status: body.status, obs, blocos, em: agora, iniciadoEm: anterior.iniciadoEm || agora };
        await refPlanej.set({ registros: { [idSessao]: registro } }, { merge: true });
        return resposta(200, { ok: true, registro });
      }
      if (body.acao === "desafioIniciar" || body.acao === "desafioDia") {
        /* Desafio de 7 dias: sequência de práticas montada no aparelho a partir da estratégia do próprio jogador (sem IA, sem cota).
           Aqui só se guarda o andamento: qual estratégia, que dia foi feito e a anotação opcional. Os dias seguem em ordem. */
        const refJ = ref;
        const dJ = (await refJ.get()).data() || {};
        if (body.acao === "desafioIniciar") {
          const idPl = String(body.planoId || "");
          if (!/^[A-Za-z0-9_-]{8,40}$/.test(idPl)) throw new ErroPublico(400, "Estratégia inválida.");
          const sPl = await refJ.collection("planos").doc(idPl).get();
          if (!sPl.exists || sPl.data().status !== "pronto") throw new ErroPublico(404, "Estratégia não encontrada.");
          if (dJ.desafio && dJ.desafio.planoId === idPl && !body.reiniciar) return resposta(200, { ok: true, desafio: dJ.desafio });
          const desafio = { planoId: idPl, iniciadoEm: new Date().toISOString(), dias: {} };
          await refJ.update({ desafio });
          return resposta(200, { ok: true, desafio });
        }
        const dia = Number(body.dia);
        if (!Number.isInteger(dia) || dia < 1 || dia > 7) throw new ErroPublico(400, "Dia inválido.");
        if (!dJ.desafio) throw new ErroPublico(409, "Comece o desafio antes.");
        const dias = dJ.desafio.dias || {};
        if (dia > 1 && !(dias[String(dia - 1)] || {}).feito && !(dias[String(dia)] || {}).feito) throw new ErroPublico(409, "Faça os dias em ordem: conclua o dia " + (dia - 1) + " primeiro.");
        const nota = String(body.nota == null ? "" : body.nota).replace(/[ \t]+/g, " ").trim().slice(0, 500);
        const registro = { feito: body.feito !== false, nota, em: new Date().toISOString() };
        await refJ.set({ desafio: { dias: { [String(dia)]: registro } } }, { merge: true });
        return resposta(200, { ok: true, dia, registro });
      }
      if (body.acao === "decidirSugestao") {
        /* O jogador aceita ou rejeita (ou desfaz) uma sugestão da Evolução Inteligente. Só grava a decisão: a estratégia
           em si nunca é alterada automaticamente. */
        const idPl = String(body.planoId || ""), idSug = String(body.sugestaoId || "");
        if (!/^[A-Za-z0-9_-]{8,40}$/.test(idPl) || !/^s[1-3]$/.test(idSug)) throw new ErroPublico(400, "Sugestão inválida.");
        if (!["aceita", "rejeitada", "pendente"].includes(body.decisao)) throw new ErroPublico(400, "Decisão inválida.");
        const refPl = ref.collection("planos").doc(idPl);
        const sPl = await refPl.get();
        const dp = sPl.exists ? sPl.data() : null;
        if (!dp || dp.status !== "pronto" || !((dp.plano || {}).evolucao || {}).sugestoes || !dp.plano.evolucao.sugestoes.some((x) => x.id === idSug)) throw new ErroPublico(404, "Sugestão não encontrada.");
        await refPl.set({ decisoes: { [idSug]: body.decisao } }, { merge: true });
        return resposta(200, { ok: true, decisao: body.decisao });
      }
      if (body.acao === "salvarPartida") {
        /* Registro pós-jogo preenchido pelo jogador. Criar ou corrigir (mesmo id); não consome nenhuma cota de geração. */
        const idPartida = String(body.id || "");
        if (!/^[A-Za-z0-9_-]{8,40}$/.test(idPartida)) throw new ErroPublico(400, "Registro inválido.");
        let p;
        try { p = PART.normalizarPartida(body, hojeNoBrasil()); } catch (e) { throw new ErroPublico(400, e.message); }
        if (p.planoId) {
          const sPl = await ref.collection("planos").doc(p.planoId).get();
          if (!sPl.exists) p.planoId = null; // só se relaciona a estratégia da própria conta
          else p.planoTitulo = ((sPl.data().plano || {}).titulo || "").slice(0, 120);
        }
        const refPart = ref.collection("partidas").doc(idPartida);
        const sPart = await refPart.get();
        const agora = new Date().toISOString();
        if (!sPart.exists) {
          const todas = await ref.collection("partidas").get(); let n = 0; todas.forEach(() => n++);
          if (n >= PART.LIMITE_PARTIDAS) throw new ErroPublico(409, "Você chegou ao limite de registros de partidas. Exclua os mais antigos para continuar.");
        }
        const registro = { ...p, origem: "informado_pelo_jogador", criadoEm: sPart.exists ? sPart.data().criadoEm : agora, atualizadoEm: agora };
        await refPart.set(registro);
        return resposta(200, { ok: true, partida: { id: idPartida, ...registro } });
      }
      if (body.acao === "excluirPartida") {
        const idPartida = String(body.id || "");
        if (!/^[A-Za-z0-9_-]{8,40}$/.test(idPartida)) throw new ErroPublico(400, "Registro inválido.");
        const refPart = ref.collection("partidas").doc(idPartida);
        if (!(await refPart.get()).exists) throw new ErroPublico(404, "Registro não encontrado.");
        await refPart.delete();
        return resposta(200, { ok: true });
      }
      if (body.acao === "arquivarPrograma") {
        /* Arquivar não apaga nada: o programa continua na lista e no histórico, só deixa de contar como ativo.
           Desarquivar respeita o limite de programas ativos do plano. */
        const idPlanej = String(body.planejamentoId || "");
        if (!ID_VALIDO.test(idPlanej)) throw new ErroPublico(400, "Programa inválido.");
        const arquivar = body.arquivado !== false;
        const refPlanej = ref.collection("planejamentos").doc(idPlanej);
        const sP = await refPlanej.get();
        if (!sP.exists) throw new ErroPublico(404, "Programa não encontrado.");
        if (!arquivar && COTAS.modeloAtivo()) {
          const dadosJ = (await ref.get()).data() || {};
          const todos = await ref.collection("planejamentos").get();
          const lista = []; todos.forEach((d) => { if (d.id !== idPlanej) lista.push(d.data()); });
          const planoId = COTAS.planoIdDoNivel(nivelDoJogador(dadosJ, usuario.email, hojeNoBrasil()), planoFull(usuario.email));
          const av = COTAS.avaliarPrograma(planoId, COTAS.contarProgramasAtivos(lista, hojeNoBrasil()));
          if (!av.ok && COTAS.programaAtivo({ ...sP.data(), arquivado: false }, hojeNoBrasil())) throw new ErroPublico(409, av.mensagem);
        }
        await refPlanej.set({ arquivado: arquivar }, { merge: true });
        return resposta(200, { ok: true, arquivado: arquivar });
      }
      if (body.acao !== "salvarFicha") throw new ErroPublico(400, "Ação desconhecida.");
      const ficha = normalizarFicha(body.ficha);
      await ref.set({ ficha, fichaAtualizadaEm: new Date().toISOString() }, { merge: true });
      return resposta(200, { ok: true, ficha, fichaCompleta: fichaCompleta(ficha) });
    }

    return resposta(405, { erro: "Método não permitido." });
  } catch (e) {
    if (e instanceof ErroPublico) return resposta(e.status, { erro: e.message });
    console.error("player-dados:", e);
    return resposta(500, { erro: "Não foi possível carregar seus dados agora. Tente de novo em instantes." });
  }
};
