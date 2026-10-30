/* Lembretes no celular, com hora marcada (roda de hora em hora pelo agendamento do netlify.toml; horário de Brasília, UTC-3):
   · 07h — treinador: as aulas do dia dele (coordenação recebe as da academia);
   · 19h — aluno/pais: aula amanhã (aula do jogador ou da turma dele);
   · 21h — treinador: aulas de hoje que passaram e ainda estão sem marcar (realizada, falta ou cancelada).
   Cada lembrete sai uma vez por dia (pushRodadas/{data}-{tipo}). As aulas do dia vêm de _push-aulas.js (cada site tem o seu modelo
   de agenda). Este arquivo é igual nos dois sites. */
const { admin, app } = require("./_firebase-admin");
const P = require("./_push");
const AULAS = require("./_push-aulas");

const COORD = ["coordenador", "admin", "dono", "gestor"];
function agoraBrasilia(d) {
  const t = new Date((d || new Date()).getTime() - 3 * 3600 * 1000);
  return { hora: t.getUTCHours(), iso: t.toISOString().slice(0, 10), amanha: new Date(t.getTime() + 86400000).toISOString().slice(0, 10) };
}
function lista(aulas, max) {
  const l = aulas.slice(0, max).map((a) => a.hora + " " + String(a.titulo || "").trim().split(/\s+/).slice(0, 2).join(" "));
  return l.join(", ") + (aulas.length > max ? " e mais " + (aulas.length - max) : "");
}
function doTreinador(aulas, insc) { return COORD.indexOf(String(insc.papel || "")) >= 0 ? aulas : aulas.filter((a) => !a.professorUid || a.professorUid === insc.uid); }

/* mensagens (funções puras: testadas sem Firestore) */
function avisoAulasHoje(aulas, insc) {
  const v = doTreinador(aulas, insc).filter((a) => a.status !== "cancelada");
  if (!v.length) return null;
  return { titulo: v.length === 1 ? "Hoje: 1 aula" : "Hoje: " + v.length + " aulas", corpo: lista(v, 4) + ".", url: "@app", tag: "aulas-hoje" };
}
function avisoSemMarcar(aulas, insc, horaAgora) {
  const v = doTreinador(aulas, insc).filter((a) => a.status === "agendada" && a.horaFim <= horaAgora);
  if (!v.length) return null;
  return { titulo: v.length === 1 ? "1 aula de hoje sem marcar" : v.length + " aulas de hoje sem marcar", corpo: lista(v, 4) + ". Toque para marcar como dada, falta ou cancelada.", url: "@app", tag: "sem-marcar" };
}
function avisoAulaAmanha(aulas, insc) {
  const v = aulas.filter((a) => a.status !== "cancelada" && (a.alunoIds || []).indexOf(String(insc.alunoId)) >= 0);
  if (!v.length) return null;
  return { titulo: "Aula amanhã", corpo: v.length === 1 ? "Amanhã tem aula às " + v[0].hora + (v[0].turma ? " (" + v[0].titulo + ")" : "") + "." : "Amanhã tem " + v.length + " aulas: " + v.map((a) => a.hora).join(", ") + ".", url: "@app", tag: "aula-amanha" };
}

async function dadosDaOrg(orgId) {
  const col = admin.firestore().collection("orgs").doc(orgId).collection("dados"), d = {};
  for (const k of AULAS.CHAVES) {
    const s = await col.doc(k).get();
    let v = []; try { v = s.exists ? JSON.parse(s.data().value || "[]") : []; } catch (e) { v = []; }
    d[k === "mty:alunos:v2" ? "alunos" : k === "mty:turmas:v1" ? "turmas" : "ocorrencias"] = Array.isArray(v) ? v : [];
  }
  return d;
}
async function umaVezPorDia(chave) {
  try { await admin.firestore().collection("pushRodadas").doc(chave).create({ em: new Date().toISOString() }); return true; } catch (e) { return false; }
}
async function rodar(tipo, iso, horaAgora) {
  const appAlvo = tipo === "aula-amanha" ? "aluno" : "treinador";
  const snap = await admin.firestore().collection(P.COLECAO).where("app", "==", appAlvo).get();
  const porOrg = new Map();
  snap.forEach((d) => { const x = { id: d.id, ...d.data() }; if (!x.orgId) return; if (!porOrg.has(x.orgId)) porOrg.set(x.orgId, []); porOrg.get(x.orgId).push(x); });
  const k = await P.chaves(admin);
  let enviados = 0;
  for (const [orgId, inscs] of porOrg) {
    const aulas = AULAS.aulasDoDia(await dadosDaOrg(orgId), iso);
    for (const insc of inscs) {
      const aviso = tipo === "aulas-hoje" ? avisoAulasHoje(aulas, insc) : tipo === "sem-marcar" ? avisoSemMarcar(aulas, insc, horaAgora) : avisoAulaAmanha(aulas, insc);
      if (!aviso) continue;
      let r; try { r = await P.enviarUma(insc, { ...aviso, url: insc.url || "/" }, k); } catch (e) { r = { status: 0 }; }
      if (r.status >= 200 && r.status < 300) enviados++;
      else if (r.status === 404 || r.status === 410) await admin.firestore().collection(P.COLECAO).doc(insc.id).delete().catch(() => {});
    }
  }
  return enviados;
}

exports.handler = async function () {
  try {
    app();
    const t = agoraBrasilia();
    const tipo = t.hora === 7 ? "aulas-hoje" : t.hora === 19 ? "aula-amanha" : t.hora === 21 ? "sem-marcar" : null;
    if (!tipo) return { statusCode: 200, body: "nada nesta hora" };
    if (!(await umaVezPorDia(t.iso + "-" + tipo))) return { statusCode: 200, body: "já enviado hoje" };
    const n = await rodar(tipo, tipo === "aula-amanha" ? t.amanha : t.iso, "21:00");
    return { statusCode: 200, body: tipo + ": " + n + " avisos" };
  } catch (e) {
    console.error("push-lembretes:", e);
    return { statusCode: 500, body: "erro" };
  }
};
module.exports.avisoAulasHoje = avisoAulasHoje;
module.exports.avisoSemMarcar = avisoSemMarcar;
module.exports.avisoAulaAmanha = avisoAulaAmanha;
module.exports.agoraBrasilia = agoraBrasilia;
module.exports.rodar = rodar;
