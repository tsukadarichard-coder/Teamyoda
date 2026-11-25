/* Quem administra a equipe no painel de gestão (25/11/2026, pedido do Richard: "Eu preciso do acesso total e o Adm tb"):
   o coordenador da academia e, além dele, o Richard (dono do Financeiro) e o administrativo (lista de Financeiro › Acessos),
   desde que a conta seja de uma academia (claims.orgId). A academia é sempre a da própria conta. */
async function podeGerirEquipe(claims) {
  if (!claims || !claims.orgId) return false;
  if (claims.role === "coordenador") return true;
  try {
    const papel = await require("./financeiro")._papelDe(claims);
    return papel === "dono" || papel === "admin";
  } catch (e) { return false; }
}
module.exports = { podeGerirEquipe };
