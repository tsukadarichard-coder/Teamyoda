/* QuadraLab Player — leitura e gravação dos dados do próprio jogador.

   GET                      → perfil, ficha, planos e quantos planos ainda pode gerar
   GET ?plano={id}          → só aquele plano (o app consulta enquanto ele é gerado)
   GET ?planejamento={id}   → só aquele planejamento por semanas
   POST { acao: "salvarFicha", ficha } → grava a ficha (validada em _player.js)
   POST { acao: "escolherJogadas", planoId, escolhidas } → grava quais jogadas do plano o jogador quer treinar

   Sempre pelo uid do token: um jogador nunca alcança dados de outro. */
const {
  ErroPublico, resposta, usuarioDoPedido, refJogador,
  PLANOS_GRATIS, planoFull, nivelDoJogador, recursosDoNivel, normalizarFicha, limparComplementos, GRUPOS_PERGUNTA, fichaCompleta,
} = require("./_player");

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
    escolhidas: Array.isArray(p.escolhidas) ? p.escolhidas : [],
  };
}

function publicoPlanejamento(id, p, completo) {
  const base = {
    id, status: p.status, criadoEm: p.criadoEm, baseadoEm: p.baseadoEm || null, params: p.params || null,
    erro: p.status === "erro" ? p.erro : null,
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

function cotas(dados, email) {
  if (planoFull(email)) return { full: true, gratisRestantes: 0, creditos: 0, podeGerar: true };
  const gratisRestantes = Math.max(0, PLANOS_GRATIS - (dados.planosGratisUsados || 0));
  const creditos = Math.max(0, dados.creditosPlano || 0);
  return { full: false, gratisRestantes, creditos, podeGerar: gratisRestantes + creditos > 0 };
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
      const dados = snap.data();
      const planosSnap = await ref.collection("planos").orderBy("criadoEm", "desc").limit(20).get();
      const planos = [];
      planosSnap.forEach((d) => planos.push(publicoPlano(d.id, d.data())));
      const planejSnap = await ref.collection("planejamentos").orderBy("criadoEm", "desc").limit(20).get();
      const planejamentos = [];
      planejSnap.forEach((d) => planejamentos.push(publicoPlanejamento(d.id, d.data(), false)));
      const nivelPlano = nivelDoJogador(dados, usuario.email);
      const ficha = dados.ficha || null;
      return resposta(200, {
        nivelPlano, recursos: recursosDoNivel(nivelPlano), planejamentos,
        perfil: { nome: dados.nome || "", email: usuario.email || dados.email || "" },
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
        if (!recursosDoNivel(nivelDoJogador(dadosJ, usuario.email)).treinoDia) {
          throw new ErroPublico(403, "O registro do treino do dia faz parte do Plano 2.");
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
