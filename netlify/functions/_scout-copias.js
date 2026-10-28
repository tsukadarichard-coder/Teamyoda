/* Cópias duráveis de scouts na conta do atleta (QuadraLab Competição) e vínculos de treinador. Usado por scout-ao-vivo e scout-intercambio.
   Uma cópia é o resumo público (já limpo por limpar()) guardado como texto JSON no documento jogadores/<uid>/scouts/<id>, com "origem":
     · "treinador": enviado pelo treinador da academia (Team Yoda) para o atleta vinculado;
     · "ao-vivo": jogo marcado ao vivo no Competição (por responsável ou treinador) e guardado quando a partida termina.
   O atleta pode excluir qualquer cópia; o treinador só retira as que ele mesmo enviou. */
const crypto = require("crypto");
const { admin } = require("./_firebase-admin");
const { limpar } = require("./_scout-publico");

const MAX_SCOUTS = 100;
const agora = () => new Date().toISOString();
const colDoAtleta = (atletaUid) => admin.firestore().collection("jogadores").doc(atletaUid).collection("scouts");
const idEnviado = (orgId, jogoId) => "tr" + crypto.createHash("sha256").update(String(orgId) + "|" + String(jogoId)).digest("hex").slice(0, 24);
const idAoVivo = (token) => "av" + String(token).slice(0, 30);

/* vínculos ativos (de treinador; ou também de responsável, na conta sem academia) com a área "partidas" para esta conta: pelo uid ou, se o e-mail é verificado, pelo e-mail usado no convite */
async function vinculosDoTreinador(db, claims, tipo) {
  const tipos = [].concat(tipo || "treinador");
  const achados = new Map();
  const col = db.collection("vinculos");
  const consultas = [col.where("pessoaUid", "==", claims.uid).get()];
  if (claims.email && claims.email_verified) consultas.push(col.where("pessoaEmail", "==", String(claims.email).toLowerCase()).get());
  for (const snap of await Promise.all(consultas)) snap.forEach((d) => {
    const v = d.data();
    if (tipos.includes(v.tipo) && v.status === "ativo" && Array.isArray(v.areas) && v.areas.includes("partidas") && v.atletaUid) achados.set(d.id, v);
  });
  return achados;
}

/* grava (ou atualiza) a cópia; devolve false quando o atleta já está no limite de scouts */
async function gravarCopia(atletaUid, id, { origem, orgId, marcadoPor, resumo }) {
  const pub = limpar(resumo), col = colDoAtleta(atletaUid), doc = col.doc(id), existe = (await doc.get()).exists;
  if (!existe && (await col.get()).docs.length >= MAX_SCOUTS) return false;
  const dados = { origem, orgId: orgId || null, marcadoPor: marcadoPor || null, dataJogo: pub.data || "", atualizadoEm: agora(), copia: JSON.stringify(pub),
    rotulo: (pub.torneio || "Partida") + (pub.resultado ? " · " + pub.resultado : "") };
  if (existe) await doc.update(dados); else await doc.set({ ...dados, importadoEm: agora(), torneioId: null, partidaId: null });
  return true;
}
/* Conexão do app do treinador com o QuadraLab Competição (atletas vinculados, jogo ao vivo no app do atleta, troca de scouts):
   planos Essencial e Premium em dia. Conta de academia sem plano definido (academias antigas, Team Yoda) segue liberada. */
const ERRO_PLANO_COMPETICAO = "A conexão com o QuadraLab Competição faz parte dos planos Essencial e Premium.";
async function academiaComCompeticao(db, orgId) {
  const s = await db.collection("orgs").doc(orgId).collection("meta").doc("info").get();
  const i = s.exists ? s.data() : {};
  if (!i.plano) return true;
  if (i.plano !== "essencial" && i.plano !== "premium") return false;
  return !(i.planoAtivoAte && i.planoAtivoAte < agora().slice(0, 10));
}
module.exports = { MAX_SCOUTS, colDoAtleta, idEnviado, idAoVivo, vinculosDoTreinador, gravarCopia, academiaComCompeticao, ERRO_PLANO_COMPETICAO };
