/* QuadraLab Player — números para validar o produto (sem dados pessoais).
   Protegida pelo mesmo segredo dos outros painéis de admin (x-admin-secret).
   Devolve só contagens: nunca e-mail, nome, ficha ou observações. */
const { admin, app } = require("./_firebase-admin");
const { resposta, fichaCompleta } = require("./_player");

exports.handler = async function (event) {
  if (event.httpMethod !== "GET") return resposta(405, { erro: "Método não permitido." });
  const segredo = event.headers["x-admin-secret"] || event.headers["X-Admin-Secret"];
  if (!segredo || segredo !== process.env.ADMIN_SECRET) return resposta(401, { erro: "Segredo de administrador ausente ou incorreto." });

  try {
    app();
    const db = admin.firestore();
    const refs = await db.collection("jogadores").listDocuments();
    const m = {
      jogadores: refs.length, fichaCompleta: 0, comPlano: 0, planosGerados: 0, planosComJogadas: 0,
      comPlanejamento: 0, planejamentosGerados: 0,
      comTreinoRegistrado: 0, treinosRegistrados: 0, treinosFeitos: 0, treinosParciais: 0, treinosNaoFeitos: 0,
      voltaramEmOutraSemana: 0, pagantes: 0,
    };
    for (const ref of refs) {
      const [sJ, planos, planejs] = await Promise.all([ref.get(), ref.collection("planos").get(), ref.collection("planejamentos").get()]);
      const dj = sJ.exists ? sJ.data() : {};
      if (dj.ficha && fichaCompleta(dj.ficha)) m.fichaCompleta++;
      if (dj.planoPago && dj.planoPago !== "gratis") m.pagantes++;
      let prontos = 0, comJog = 0;
      planos.forEach((d) => { const p = d.data(); if (p.status === "pronto") { prontos++; if ((p.escolhidas || []).length) comJog++; } });
      if (prontos) m.comPlano++;
      m.planosGerados += prontos; m.planosComJogadas += comJog;
      let pj = 0, regs = 0; const dias = new Set();
      planejs.forEach((d) => {
        const p = d.data(); if (p.status !== "pronto") return; pj++;
        Object.values(p.registros || {}).forEach((r) => {
          if (!["feito", "parcial", "nao_feito"].includes(r.status)) return; // em andamento ainda não é treino registrado
          regs++;
          if (r.status === "feito") m.treinosFeitos++; else if (r.status === "parcial") m.treinosParciais++; else if (r.status === "nao_feito") m.treinosNaoFeitos++;
          if (r.em) dias.add(String(r.em).slice(0, 10));
        });
      });
      if (pj) m.comPlanejamento++;
      m.planejamentosGerados += pj; m.treinosRegistrados += regs;
      if (regs) m.comTreinoRegistrado++;
      /* "voltou": registrou treinos em pelo menos 2 semanas diferentes (dias com 7+ de diferença) */
      const ord = [...dias].sort();
      if (ord.length > 1 && (new Date(ord[ord.length - 1]) - new Date(ord[0])) >= 7 * 86400000) m.voltaramEmOutraSemana++;
    }
    return resposta(200, { geradoEm: new Date().toISOString(), ...m });
  } catch (e) {
    console.error("player-metricas:", e);
    return resposta(500, { erro: "Não foi possível calcular agora." });
  }
};
