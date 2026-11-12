/* QuadraLab Scout (scout-app/): regras da conta, dos atletas e dos jogos na nuvem. Sem acesso ao Firestore aqui: só validação e decisão,
   para os testes rodarem sem servidor. O handler está em scout-app.js.

   Firestore:
   · scoutAppContas/{uid}               → { nome, email, papel, plano, criadoEm, atualizadoEm, atletas: [{id, nome, criadoEm}], apagados: [{id, em}] }
   · scoutAppContas/{uid}/jogos/{id}    → { atletaId, atualizadoEm, aoVivo?: { token, expiraEm }, dados: JSON do jogo }
   O nome do adversário e as anotações ficam só na conta da pessoa: o link ao vivo passa por limpar() (_scout-publico) e nunca leva esses campos. */
const PAPEIS = ["responsavel", "atleta", "treinador", "outro"];
const FORMATOS = ["3sets", "1set", "4games", "tb7", "tb10"];
const ID_ATLETA = /^a[a-z0-9]{6,40}$/, ID_JOGO = /^j[a-z0-9]{6,40}$/, DATA = /^\d{4}-\d{2}-\d{2}$/, ISO = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/;
const MAX_ATLETAS = 60, MAX_JOGOS = 400, MAX_PONTOS = 2000, MAX_JOGO_BYTES = 450000, MAX_APAGADOS = 300, MAX_LOTE = 10, MAX_BAIXAR = 40;
const CAMPOS_PONTO = { fim: 20, saque: 8, bola: 6, causa: 12, situacao: 16, golpe: 16, direcao: 16, zona: 12, dirSaque: 12, qualDev: 12, dec: 8, sacador: 6, lado: 6, placarAntes: 8 };

class ErroPedido extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const txt = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const nota = (v) => { v = Math.round(+v); return v >= 1 && v <= 5 ? v : 0; };

function contaNova(token, agora) {
  return { nome: txt(token.name, 60), email: txt(token.email, 120).toLowerCase(), papel: "", plano: "gratis", criadoEm: agora, atualizadoEm: agora, atletas: [], apagados: [] };
}
/* Plano (decisão do Richard em 11/11/2026): o grátis tem até 3 atletas; a análise de movimento saiu do app e a venda do Scout Plus
   está parada até ele definir o preço. Em 12/11/2026: link ao vivo e relatório em PDF só no Scout Plus (o link é barrado em scout-app.js). Conta que já
   tem Plus (webhook-eduzz, até plusAte) ou acesso completo (PLAYER_EMAILS_FULL) continua com atletas até MAX_ATLETAS. */
const LIMITE_ATLETAS_GRATIS = 3;
const hojeBR = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
function plusAtivo(c, full) { return !!full || (!!c && c.plano === "plus" && typeof c.plusAte === "string" && c.plusAte >= hojeBR()); }
/* o que o app recebe da conta (nunca o e-mail de outra pessoa: aqui só existe a conta de quem pediu) */
function contaPublica(c, full) {
  const plus = plusAtivo(c, full);
  return { nome: c.nome || "", email: c.email || "", papel: c.papel || "", plano: plus ? "plus" : "gratis", plusAte: plus && !full ? c.plusAte : null, acessoCompleto: !!full,
    limites: { atletas: plus ? MAX_ATLETAS : LIMITE_ATLETAS_GRATIS }, criadoEm: c.criadoEm || null };
}

function perfil(corpo) {
  const nome = txt(corpo.nome, 60);
  if (!nome) throw new ErroPedido(400, "Digite o seu nome.");
  /* o Scout é de acompanhamento livre: ninguém precisa dizer se é responsável, atleta ou treinador (campo antigo, opcional) */
  return { nome };
}

/* UTR (1 a 16,5) e WTN (1 a 40) do atleta, digitados no app, com a data e um histórico curto */
const FAIXA_NOTA = { utr: [1, 16.5, 100], wtn: [1, 40, 10] };
function notaRanking(tipo, v) { const f = FAIXA_NOTA[tipo], n = Number(v); return f && typeof v === "number" && Number.isFinite(n) && n >= f[0] && n <= f[1] ? Math.round(n * f[2]) / f[2] : null; }
function notasDoAtleta(x) {
  if (!x || typeof x !== "object") return null;
  const out = {};
  for (const t of Object.keys(FAIXA_NOTA)) { const v = notaRanking(t, x[t] && x[t].v); if (v != null && DATA.test(String(x[t].em))) out[t] = { v, em: x[t].em }; }
  const hist = (Array.isArray(x.hist) ? x.hist : []).map((h) => { const v = h && notaRanking(h.t, h.v); return v != null && DATA.test(String(h.em)) ? { t: h.t, v, em: h.em } : null; }).filter(Boolean).slice(-40);
  if (hist.length) out.hist = hist;
  return Object.keys(out).length ? out : null;
}
function atletas(lista, atuais, plus) {
  if (!Array.isArray(lista)) throw new ErroPedido(400, "Lista de atletas inválida.");
  if (lista.length > MAX_ATLETAS) throw new ErroPedido(400, "Limite de " + MAX_ATLETAS + " atletas por conta.");
  const vistos = {}, out = [];
  for (const a of lista) {
    if (!a || !ID_ATLETA.test(String(a.id)) || vistos[a.id]) continue;
    const nome = txt(a.nome, 60); if (!nome) continue;
    const n = notasDoAtleta(a.notas);
    vistos[a.id] = 1; out.push({ id: a.id, nome, criadoEm: ISO.test(a.criadoEm) ? a.criadoEm : new Date().toISOString(), ...(n ? { notas: n } : {}) });
  }
  /* no grátis não entra atleta novo além do limite; quem já estava na conta (de quando era Plus) continua */
  if (!plus && atuais) {
    const ja = new Set(atuais.map((a) => a.id)), novos = out.filter((a) => !ja.has(a.id));
    if (novos.length && out.length > LIMITE_ATLETAS_GRATIS) throw new ErroPedido(403, "São até " + LIMITE_ATLETAS_GRATIS + " atletas por conta.");
  }
  return out;
}

function ponto(p, i) {
  if (!p || typeof p !== "object" || typeof p.nos !== "boolean") return null;
  const o = { nos: p.nos, n: i + 1 };
  for (const k of Object.keys(CAMPOS_PONTO)) if (p[k] != null && p[k] !== "") o[k] = txt(p[k], CAMPOS_PONTO[k]);
  for (const k of ["rede", "corrida", "adverso", "devAdv"]) if (p[k]) o[k] = true;
  for (const k of ["jogo", "set"]) { const v = Math.round(+p[k]); if (v >= 1 && v <= 99) o[k] = v; }
  return o;
}
/* um jogo vindo do app: só os campos conhecidos, com tipos e tamanhos conferidos */
function jogo(j, idsAtletas) {
  if (!j || typeof j !== "object" || !ID_JOGO.test(String(j.id))) throw new ErroPedido(400, "Jogo inválido.");
  if (!ID_ATLETA.test(String(j.atletaId)) || (idsAtletas && !idsAtletas.has(j.atletaId))) throw new ErroPedido(400, "O atleta deste jogo não está na conta.");
  if (!ISO.test(String(j.atualizadoEm))) throw new ErroPedido(400, "Jogo sem data de atualização.");
  const c = j.cfg || {}, f = FORMATOS.includes(c.formato) ? c.formato : "3sets";
  const mental = j.mental || {}, bloco = (o) => { const r = {}; for (const k of ["conf", "foco", "energia", "calma"]) if (nota(o && o[k])) r[k] = nota(o[k]); return r; };
  const jg = {}; Object.keys(mental.jogo || {}).slice(0, 60).forEach((g) => { const n = Math.round(+g), v = nota(mental.jogo[g]); if (n >= 1 && n <= 60 && v) jg[n] = v; });
  const out = {
    id: j.id, atletaId: j.atletaId, data: DATA.test(j.data) ? j.data : new Date().toISOString().slice(0, 10),
    torneio: txt(j.torneio, 80), adversario: txt(j.adversario, 80),
    cfg: { formato: f, saca: c.saca === "ele" ? "ele" : "nos", semVantagem: f === "tb7" || f === "tb10" ? false : !!c.semVantagem, superTiebreakDecisivo: f === "3sets" ? !!c.superTiebreakDecisivo : false },
    pontos: (Array.isArray(j.pontos) ? j.pontos : []).slice(0, MAX_PONTOS).map(ponto).filter(Boolean),
    mental: { antes: bloco(mental.antes), jogo: jg, depois: bloco(mental.depois) },
    nivelAdversario: txt(j.nivelAdversario, 20), observacaoFinal: txt(j.observacaoFinal, 1200), fim: !!j.fim, usoFim: !!j.usoFim,
    criadoEm: ISO.test(String(j.criadoEm)) ? j.criadoEm : j.atualizadoEm, atualizadoEm: j.atualizadoEm,
  };
  /* tempo de partida: do primeiro ponto ao fim, e o ajuste à mão em minutos */
  if (ISO.test(String(j.inicioEm))) out.inicioEm = j.inicioEm;
  if (out.inicioEm && ISO.test(String(j.fimEm)) && j.fimEm >= out.inicioEm) out.fimEm = j.fimEm;
  const dur = Math.round(+j.duracaoMin); if (dur >= 1 && dur <= 720) out.duracaoMin = dur;
  if (JSON.stringify(out).length > MAX_JOGO_BYTES) throw new ErroPedido(413, "Jogo grande demais.");
  return out;
}

/* apagados: lista curta de ids para os outros aparelhos também tirarem o jogo */
function comApagado(lista, id, em) { return [{ id, em }].concat((lista || []).filter((x) => x && x.id !== id)).slice(0, MAX_APAGADOS); }

module.exports = { PAPEIS, LIMITE_ATLETAS_GRATIS, plusAtivo, hojeBR, MAX_ATLETAS, MAX_JOGOS, MAX_LOTE, MAX_BAIXAR, ID_JOGO, ID_ATLETA, ErroPedido, contaNova, contaPublica, perfil, atletas, jogo, comApagado };
