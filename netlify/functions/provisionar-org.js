/* Onboarding de uma nova academia. Não existe tela de cadastro no app —
   por enquanto, você chama esta function (com o segredo de admin) para
   criar (ou reaproveitar) a conta do treinador e ligá-la a uma
   organização. É o único lugar que atribui orgId a alguém.

   Exemplo:
   curl -X POST https://SEU-SITE.netlify.app/.netlify/functions/provisionar-org \
     -H "content-type: application/json" \
     -H "x-admin-secret: SEU_ADMIN_SECRET" \
     -d '{"orgId":"team-yoda","nomeAcademia":"Team Yoda Tennis Pro","logoUrl":"https://SEU-SITE.netlify.app/assets/logo-team-yoda.jpg","email":"treinador@exemplo.com","senha":"umaSenhaForte123","plano":"essencial","planoAtivoAte":"2027-01-01","mostrarManual":false}'
   logoUrl é opcional — sem ele, a academia vê o próprio nome como logotipo de texto no lugar do logo.
   plano é opcional ("gratis", "essencial" ou "premium" — ver LIMITES_POR_PLANO
   no index.html; sem esse campo, a academia fica sem limite de jogadores,
   igual academia antiga). planoAtivoAte é opcional ("AAAA-MM-DD") — depois
   dessa data o app para de aceitar jogador novo até você rodar de novo
   este mesmo comando com uma data mais adiante (renovação manual).
   mostrarManual (opcional, true/false) decide se a aba "Manual" (Catálogo,
   Técnica, Táticas, Condução, Públicos, Como decide — a documentação do
   método MTY da própria Team Yoda) aparece pra essa academia. Sem esse
   campo no documento, o app mostra normalmente (compatível com toda
   academia de antes desta opção existir); a partir de agora o admin.html
   manda sempre um valor explícito, e o padrão do formulário é ocultar
   pra academia nova, já que o método é da Team Yoda, não dela.
   mostrarQuadras (opcional, true/false) decide se a aba "Quadras" (reserva
   avulsa de quadra/espaço, com link público de reserva pro cliente) aparece
   pra essa academia — é o oposto do mostrarManual: sem esse campo, a aba
   fica ESCONDIDA (nenhuma academia de antes desta opção usava isso), só
   liga pra quem for provisionado com a opção marcada. A Team Yoda é a
   exceção: tem uma liberação própria no código (index.html e
   reservar-quadra.js), sem depender deste campo. */
const { admin, app } = require("./_firebase-admin");

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return resposta(405, { erro: "Método não permitido." });
  }

  const segredo = event.headers["x-admin-secret"] || event.headers["X-Admin-Secret"];
  if (!segredo || segredo !== process.env.ADMIN_SECRET) {
    return resposta(401, { erro: "Segredo de administrador ausente ou incorreto." });
  }

  let corpo;
  try {
    corpo = JSON.parse(event.body || "{}");
  } catch (e) {
    return resposta(400, { erro: "Corpo da requisição inválido." });
  }

  const { orgId, nomeAcademia, logoUrl, email, senha, plano, planoAtivoAte, mostrarManual, mostrarQuadras } = corpo;
  if (!orgId || !email || !senha) {
    return resposta(400, { erro: "Faltou orgId, email ou senha." });
  }
  if (!/^[a-z0-9-]+$/.test(orgId)) {
    return resposta(400, { erro: "orgId só pode ter letras minúsculas, números e hífen." });
  }
  if (String(senha).length < 6) {
    return resposta(400, { erro: "A senha precisa de pelo menos 6 caracteres." });
  }
  if (plano && !["gratis", "essencial", "premium"].includes(plano)) {
    return resposta(400, { erro: 'plano precisa ser "gratis", "essencial" ou "premium".' });
  }
  if (planoAtivoAte && !/^\d{4}-\d{2}-\d{2}$/.test(planoAtivoAte)) {
    return resposta(400, { erro: 'planoAtivoAte precisa estar no formato "AAAA-MM-DD".' });
  }

  try {
    app();
    let usuario;
    try {
      usuario = await admin.auth().getUserByEmail(email);
    } catch (e) {
      usuario = await admin.auth().createUser({ email, password: senha });
    }
    await admin.auth().setCustomUserClaims(usuario.uid, { orgId, role: "coordenador" });
    /* nome e logoUrl são a identidade que troca a marca fixa do app
       (Team Yoda) pela da própria academia, assim que ela loga — ver
       o componente Marca no index.html. logoUrl aceita qualquer URL
       pública de imagem, inclusive um asset já hospedado no próprio
       site (ex.: a Team Yoda pode apontar pro próprio logo dela em
       https://SEU-SITE.netlify.app/assets/logo-team-yoda.jpg, sem
       precisar subir nada nem mudar de código). */
    const identidade = { nome: nomeAcademia || orgId, atualizadoEm: new Date().toISOString() };
    if (logoUrl) identidade.logoUrl = logoUrl;
    if (plano) identidade.plano = plano;
    if (planoAtivoAte) identidade.planoAtivoAte = planoAtivoAte;
    if (typeof mostrarManual === "boolean") identidade.mostrarManual = mostrarManual;
    if (typeof mostrarQuadras === "boolean") identidade.mostrarQuadras = mostrarQuadras;
    await admin.firestore().collection("orgs").doc(orgId).collection("meta").doc("info").set(identidade, { merge: true });

    /* Também registra essa conta em solicitacoes, do mesmo jeito que um
       treinador aprovado — assim listaProfessores() e a aba Equipe
       enxergam o próprio coordenador com o role certo desde o início.
       Só define nome/status na primeira vez, pra não sobrescrever um
       nome que o coordenador já tenha editado numa reprovisão. */
    const solicitacaoRef = admin.firestore().collection("orgs").doc(orgId).collection("solicitacoes").doc(usuario.uid);
    const solicitacaoAtual = await solicitacaoRef.get();
    if (!solicitacaoAtual.exists) {
      await solicitacaoRef.set({
        nome: nomeAcademia || email, email, status: "aprovada", role: "coordenador",
        criadoEm: new Date().toISOString(),
      });
    } else {
      await solicitacaoRef.set({ role: "coordenador" }, { merge: true });
    }

    return resposta(200, {
      ok: true,
      orgId,
      uid: usuario.uid,
      email,
      aviso: "Se a conta já existia e estava logada em algum aparelho, ela só enxerga a academia depois de sair e entrar de novo (o token antigo não carrega a claim nova).",
    });
  } catch (e) {
    return resposta(500, { erro: String(e.message || e) });
  }
};

function resposta(statusCode, corpo) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) };
}
