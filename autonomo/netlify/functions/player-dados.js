/* QuadraLab Player — leitura e gravação dos dados do próprio jogador.

   GET                      → perfil, ficha, planos e quantos planos ainda pode gerar
   GET ?plano={id}          → só aquele plano (o app consulta enquanto ele é gerado)
   POST { acao: "salvarFicha", ficha } → grava a ficha (validada em _player.js)

   Sempre pelo uid do token: um jogador nunca alcança dados de outro. */
const {
  ErroPublico, resposta, usuarioDoPedido, refJogador,
  PLANOS_GRATIS, normalizarFicha, fichaCompleta,
} = require("./_player");

function publicoPlano(id, p) {
  return {
    id,
    status: p.status,
    criadoEm: p.criadoEm,
    fonte: p.fonte || null,
    adversarioNome: p.adversarioNome || null,
    plano: p.status === "pronto" ? p.plano : null,
    erro: p.status === "erro" ? p.erro : null,
  };
}

function cotas(dados) {
  const gratisRestantes = Math.max(0, PLANOS_GRATIS - (dados.planosGratisUsados || 0));
  const creditos = Math.max(0, dados.creditosPlano || 0);
  return { gratisRestantes, creditos, podeGerar: gratisRestantes + creditos > 0 };
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
      const ficha = dados.ficha || null;
      return resposta(200, {
        perfil: { nome: dados.nome || "", email: dados.email || usuario.email || "" },
        ficha,
        fichaCompleta: !!ficha && fichaCompleta(ficha),
        planos,
        ...cotas(dados),
      });
    }

    if (event.httpMethod === "POST") {
      let body;
      try { body = JSON.parse(event.body || "{}"); }
      catch (e) { throw new ErroPublico(400, "Corpo da requisição inválido."); }
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
