/* Leitura pública e limitada do progresso de UM jogador, para o link que
   o treinador compartilha com o aluno — sem login, sem ver o resto do
   elenco. A segurança aqui não é a regra do Firestore (o Admin SDK
   ignora regras) — é o "linkToken" gerado por jogador: sem ele batendo
   exatamente, a function nem devolve o nome. */
const { admin, app } = require("./_firebase-admin");

exports.handler = async function (event) {
  if (event.httpMethod !== "GET") return resposta(405, { erro: "Método não permitido." });

  const q = event.queryStringParameters || {};
  const { org, id, t } = q;
  if (!org || !id || !t) return resposta(400, { erro: "Link incompleto." });

  try {
    app();
    const snap = await admin.firestore().collection("orgs").doc(org).collection("dados").doc("mty:alunos:v2").get();
    if (!snap.exists) return resposta(404, { erro: "Não encontrei essa academia." });

    let alunos;
    try { alunos = JSON.parse(snap.data().value || "[]"); }
    catch (e) { return resposta(500, { erro: "Dados da academia corrompidos." }); }

    const aluno = alunos.find((a) => a.id === id);
    if (!aluno || !aluno.linkToken || aluno.linkToken !== t) {
      return resposta(404, { erro: "Link inválido — peça um novo ao seu treinador." });
    }

    const plano = aluno.plano;
    const reg = aluno.regPlano || {};
    const aulas = [];
    if (plano && plano.blocos) {
      let n = 0;
      plano.blocos.forEach((b) => (b.semanasLista || []).forEach((sem) =>
        (sem.aulas || []).forEach((au) => {
          n++;
          const aid = "A" + String(n).padStart(2, "0");
          const r = reg[aid] || {};
          const status = r.status || (r.feita ? "feita" : "");
          aulas.push({
            bloco: b.titulo || b.nome || "",
            semana: sem.n,
            foco: sem.foco || "",
            titulo: au.t || "",
            status,
            data: r.data || null,
          });
        })));
    }

    return resposta(200, {
      nome: aluno.nome || "Jogador",
      temPlano: !!plano,
      tipoPlano: plano ? plano.tipo || "" : null,
      prioridade: plano ? plano.prioridade || "" : null,
      totalAulas: aulas.length,
      aulasFeitas: aulas.filter((a) => a.status === "feita").length,
      aulas,
    });
  } catch (e) {
    return resposta(500, { erro: String(e.message || e) });
  }
};

function resposta(statusCode, corpo) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) };
}
