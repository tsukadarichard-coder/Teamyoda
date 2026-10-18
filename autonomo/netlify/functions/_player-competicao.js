/* QuadraLab Player Competição — regras puras de papéis e vínculos (sem Firebase; o handler lê/grava e chama estas funções).

   Papéis (gravados no servidor em jogadores/{uid}.competicao.papel): atleta, responsavel, treinador.
   Vínculo = permissão de uma pessoa ver áreas de um atleta. Nasce sempre de um convite do atleta (código) e só vale depois
   de aprovado. Estados: convite → aguardando → ativo; qualquer ponto → revogado/recusado/cancelado; convite vencido = expirado.

   Quem aprova:
   · responsável: o atleta aprova o primeiro; pai e mãe (até MAX_RESPONSAVEIS) podem ser vinculados, cada um com o próprio convite. Se o atleta é
     menor e já tem um responsável ativo, um novo responsável só entra com a aprovação de um responsável já ativo (o menor sozinho não basta);
   · treinador de atleta adulto: o atleta;
   · treinador de atleta menor: um responsável com vínculo ativo — o atleta menor sozinho não basta.
   Revogar vale para os dois lados a qualquer momento. Se um menor fica sem responsável ativo, os vínculos de treinador dele são encerrados.
   O diário nunca entra em um vínculo sem estar marcado explicitamente. */
const crypto = require("crypto");

const PAPEIS = ["atleta", "responsavel", "treinador"];
const TIPOS = ["responsavel", "treinador"];
const AREAS = ["perfil", "temporada", "planejamento", "estrategias", "partidas", "treinos", "diario"];
const AREAS_PADRAO = ["perfil", "temporada", "planejamento", "estrategias", "partidas", "treinos"]; // o diário é privado por padrão
const ROTULO_AREA = { perfil: "Perfil de jogador", temporada: "Temporada e torneios", planejamento: "Meu planejamento (compromissos, rotina e registros de treino)", estrategias: "Estratégias", partidas: "Partidas", treinos: "Treinos", diario: "Diário pessoal" };
const PARENTESCOS = { pai: "Pai", mae: "Mãe", outro: "Outro responsável" };
const MAX_RESPONSAVEIS = 4; // vínculos de responsável em aberto ou ativos por atleta (pai, mãe e mais dois, se necessário)
const VALIDADE_CONVITE_DIAS = 7;
const MAX_CONVITES_ABERTOS = 5;
const MAX_TENTATIVAS_DIA = 10;
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I/L

function gerarCodigo() {
  const b = crypto.randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += ALFABETO[b[i] % ALFABETO.length];
  return s;
}
function normalizarCodigo(c) { return String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8); }

/* idade em anos completos; null se a data não for válida ou for implausível */
function idadeEm(nascimento, hoje) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(nascimento || ""));
  if (!m) return null;
  const a = +m[1], mes = +m[2], d = +m[3];
  const dt = new Date(Date.UTC(a, mes - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== mes - 1 || dt.getUTCDate() !== d) return null;
  const h = /^(\d{4})-(\d{2})-(\d{2})$/.exec(hoje);
  if (!h) return null;
  let idade = +h[1] - a;
  if (+h[2] < mes || (+h[2] === mes && +h[3] < d)) idade--;
  return idade >= 5 && idade <= 100 ? idade : null;
}
function ehMenor(nascimento, hoje) { const i = idadeEm(nascimento, hoje); return i !== null && i < 18; }

function areasValidas(lista) {
  const out = [];
  for (const a of Array.isArray(lista) ? lista : []) if (AREAS.includes(a) && !out.includes(a)) out.push(a);
  return out;
}

function somarDias(isoData, dias) {
  const d = new Date(isoData + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
function conviteVencido(v, hoje) { return v.status === "convite" && !!v.expiraEm && v.expiraEm < hoje; }

/* quem pode aprovar este vínculo (aguardando)? devolve { ok } ou { ok:false, motivo } */
function podeDecidir(v, uid, atletaMenor, responsaveisAtivosUids) {
  if (v.status !== "aguardando") return { ok: false, motivo: "Este pedido não está aguardando decisão." };
  if (v.tipo === "treinador" && atletaMenor) {
    return responsaveisAtivosUids.includes(uid) ? { ok: true } : { ok: false, motivo: "Para um atleta menor de idade, quem aprova o treinador é o responsável." };
  }
  if (v.tipo === "responsavel" && atletaMenor && responsaveisAtivosUids.length) {
    return responsaveisAtivosUids.includes(uid) && uid !== v.pessoaUid ? { ok: true } : { ok: false, motivo: "Para um atleta menor de idade, um novo responsável é aprovado por um responsável que já está vinculado." };
  }
  return uid === v.atletaUid ? { ok: true } : { ok: false, motivo: "Só o atleta pode aprovar este vínculo." };
}

/* quem pode editar as áreas ou revogar? atleta, a própria pessoa (só revogar) e, para menor, o responsável ativo (editar/revogar) */
function podeEditarAreas(v, uid, atletaMenor, responsaveisAtivosUids) {
  if (v.tipo === "responsavel") return uid === v.atletaUid; // um responsável não mexe no vínculo do outro (pai/mãe)
  return uid === v.atletaUid || (atletaMenor && responsaveisAtivosUids.includes(uid));
}
function podeRevogar(v, uid, atletaMenor, responsaveisAtivosUids) {
  return podeEditarAreas(v, uid, atletaMenor, responsaveisAtivosUids) || uid === v.pessoaUid;
}

/* o que a pessoa vinculada vê do perfil: só as respostas de escolha da ficha, com rótulo; texto livre (observações, relato, adversário) nunca */
const ROTULO_CAMPO = {
  nivel: "Nível", mao: "Mão", backhand: "Esquerda", piso: "Piso", armaPrincipal: "Golpe mais forte", pontoFraco: "Ponto mais vulnerável",
  padraoPonto: "Padrão de ponto", rede: "Rede", devolucao: "Devolução", pressao: "Sob pressão",
};
function perfilCompartilhavel(ficha, opcoes) {
  const out = [];
  for (const k of Object.keys(ROTULO_CAMPO)) {
    const v = ficha && ficha[k];
    if (typeof v !== "string" || !v) continue;
    const mapa = (opcoes && opcoes[k]) || {};
    out.push({ campo: k, rotulo: ROTULO_CAMPO[k], valor: String(mapa[v] || v).split(" — ")[0] });
  }
  return out;
}

/* versão que o navegador recebe: nunca o código de convites de outras pessoas nem e-mails além do necessário */
function publicoVinculo(id, v, ladoAtleta) {
  return {
    id, tipo: v.tipo, parentesco: v.tipo === "responsavel" && PARENTESCOS[v.parentesco] ? v.parentesco : null, status: v.status, areas: v.areas || [], criadoEm: v.criadoEm, expiraEm: v.expiraEm || null,
    atleta: { nome: v.atletaNome || "Atleta" },
    pessoa: v.pessoaUid ? { nome: v.pessoaNome || "Pessoa", email: ladoAtleta ? v.pessoaEmail || null : null } : null,
    ...(ladoAtleta && v.status === "convite" ? { codigo: v.codigo } : {}),
  };
}

module.exports = {
  PAPEIS, TIPOS, AREAS, AREAS_PADRAO, ROTULO_AREA, VALIDADE_CONVITE_DIAS, PARENTESCOS, MAX_RESPONSAVEIS, MAX_CONVITES_ABERTOS, MAX_TENTATIVAS_DIA,
  gerarCodigo, normalizarCodigo, idadeEm, ehMenor, areasValidas, somarDias, conviteVencido,
  podeDecidir, podeEditarAreas, podeRevogar, perfilCompartilhavel, publicoVinculo,
};
