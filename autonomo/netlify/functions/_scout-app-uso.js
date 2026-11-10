/* QuadraLab Scout (scout-app/): contagem de uso anônima, para medir o teste do app.

   O app manda só { a: número sorteado do aparelho, e: evento, n: pontos do jogo }. Nunca nome, atleta, adversário, torneio ou anotação:
   qualquer outro campo faz o pedido ser recusado.

   Firestore:
   · scoutAppUso/{AAAA-MM-DD}       → { abriu, iniciados, encerrados, pontos, aparelhos, novos, primeiroJogo, tresJogos } do dia (horário de Brasília)
   · scoutAppAparelhos/{a}          → { primeiroDia, ultimoDia, jogosEncerrados, diaConta, eventosDia }

   "aparelhos" conta cada aparelho uma vez por dia; "primeiroJogo" e "tresJogos" contam o dia em que o aparelho terminou o 1º e o 3º jogo,
   que é a medida do teste (aparelhos com 1 jogo terminado e com 3 ou mais). */
const EVENTOS = ["abriu", "jogo-iniciado", "jogo-encerrado"];
const APARELHO = /^[a-f0-9]{16,32}$/;
const MAX_EVENTOS_DIA = 60;
const CAMPOS_DIA = ["abriu", "iniciados", "encerrados", "pontos", "aparelhos", "novos", "primeiroJogo", "tresJogos"];

function hojeBR(agora) { return new Date((agora || Date.now()) - 3 * 3600 * 1000).toISOString().slice(0, 10); }
function addDias(dia, n) { return new Date(Date.parse(dia + "T12:00:00Z") + n * 86400000).toISOString().slice(0, 10); }

/* confere o pedido; devolve { a, e, n } ou { erro } */
function validar(corpo) {
  if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return { erro: "Pedido inválido." };
  if (Object.keys(corpo).some((k) => !["a", "e", "n"].includes(k))) return { erro: "Campo não aceito." };
  const a = String(corpo.a || ""), e = String(corpo.e || "");
  if (!APARELHO.test(a)) return { erro: "Aparelho inválido." };
  if (!EVENTOS.includes(e)) return { erro: "Evento desconhecido." };
  let n = 0;
  if (corpo.n != null) { n = Number(corpo.n); if (!Number.isInteger(n) || n < 0 || n > 2000) return { erro: "Número de pontos inválido." }; }
  return { a, e, n: e === "jogo-encerrado" ? n : 0 };
}

/* grava um evento; devolve { ok } ou { limite: true } */
async function registrar(db, ev, agora) {
  const dia = hojeBR(agora);
  const refAp = db.collection("scoutAppAparelhos").doc(ev.a), refDia = db.collection("scoutAppUso").doc(dia);
  return db.runTransaction(async (tx) => {
    const sAp = await tx.get(refAp), sDia = await tx.get(refDia);
    const ap = sAp.exists ? sAp.data() : null, d = sDia.exists ? sDia.data() : {};
    const eventosDia = ap && ap.diaConta === dia ? (ap.eventosDia || 0) : 0;
    if (eventosDia >= MAX_EVENTOS_DIA) return { limite: true };
    const novoDia = {};
    CAMPOS_DIA.forEach((k) => { novoDia[k] = d[k] || 0; });
    if (!ap || ap.ultimoDia !== dia) novoDia.aparelhos++;
    if (!ap) novoDia.novos++;
    let jogos = (ap && ap.jogosEncerrados) || 0;
    if (ev.e === "abriu") novoDia.abriu++;
    if (ev.e === "jogo-iniciado") novoDia.iniciados++;
    if (ev.e === "jogo-encerrado") {
      novoDia.encerrados++; novoDia.pontos += ev.n; jogos++;
      if (jogos === 1) novoDia.primeiroJogo++;
      if (jogos === 3) novoDia.tresJogos++;
    }
    tx.set(refDia, novoDia);
    tx.set(refAp, { primeiroDia: (ap && ap.primeiroDia) || dia, ultimoDia: dia, jogosEncerrados: jogos, diaConta: dia, eventosDia: eventosDia + 1 });
    return { ok: true };
  });
}

/* números para o painel: últimos 7 e 30 dias, série diária de 30 dias e totais de aparelhos */
async function resumoUso(db, hoje) {
  const dias = []; for (let i = 29; i >= 0; i--) dias.push(addDias(hoje, -i));
  const snaps = await Promise.all(dias.map((d) => db.collection("scoutAppUso").doc(d).get()));
  const serie = snaps.map((s, i) => { const x = s.exists ? s.data() : {}; const o = { dia: dias[i] }; CAMPOS_DIA.forEach((k) => { o[k] = x[k] || 0; }); return o; });
  const soma = (l) => { const o = {}; CAMPOS_DIA.forEach((k) => { o[k] = l.reduce((t, x) => t + x[k], 0); }); return o; };
  const ap = db.collection("scoutAppAparelhos");
  const conta = async (q) => (await q.count().get()).data().count;
  const [total, comUm, comTres] = await Promise.all([conta(ap), conta(ap.where("jogosEncerrados", ">=", 1)), conta(ap.where("jogosEncerrados", ">=", 3))]);
  return { dias7: soma(serie.slice(-7)), dias30: soma(serie), serie, aparelhos: { total, comUmJogo: comUm, comTresJogos: comTres } };
}

module.exports = { EVENTOS, MAX_EVENTOS_DIA, validar, registrar, resumoUso, hojeBR };
