/* QuadraLab Player — análise biomecânica (análise de movimento): regras puras, sem Firebase.

   A análise roda no aparelho do jogador (o vídeo não é enviado); o servidor guarda o resumo e o relatório e decide se a
   análise pode ser salva:
   · Free: UMA análise de cada golpe (forehand, backhand e saque), para sempre. Remover a análise não devolve o uso.
     Refazer a mesma análise (mesmo registro, ex.: reaplicar as faixas de referência) não conta de novo.
   · Planos pagos e acesso completo: sem limite.
   Nada aqui cobra nem libera plano pago: o nível vem de nivelDoJogador (webhook da Eduzz / liberação manual). */
const GOLPES = ["forehand", "backhand", "saque"];
const NOME_GOLPE = { forehand: "forehand", backhand: "backhand", saque: "saque" };
const LIMITE_FREE_POR_GOLPE = 1;
const MAX_ANALISES = 300;
const MAX_RELATORIO = 900000; // um documento do Firestore aceita ~1 MB
const ID_ANALISE = /^mv[a-z0-9]{6,30}$/;

function ilimitado(nivel, full) { return !!full || (nivel && nivel !== "gratis"); }

/* uso gravado no jogador: { forehand: n, backhand: n, saque: n } (só cresce) */
function usoDe(dados) {
  const u = (dados && dados.movimentoUso) || {};
  const out = {};
  GOLPES.forEach((g) => { out[g] = Math.max(0, Number.isInteger(u[g]) ? u[g] : 0); });
  return out;
}

/* o que a tela recebe: por golpe, quantas usou, o limite (null = sem limite) e se pode analisar */
function cota(dados, { nivel, full }) {
  const sem = ilimitado(nivel, full), uso = usoDe(dados), porGolpe = {};
  GOLPES.forEach((g) => { porGolpe[g] = { usadas: uso[g], limite: sem ? null : LIMITE_FREE_POR_GOLPE, liberado: sem || uso[g] < LIMITE_FREE_POR_GOLPE }; });
  return { plano: sem ? "pago" : "free", porGolpe };
}

/* pode salvar este resumo? novo = id ainda não salvo nesta conta */
function avaliarSalvar(dados, { nivel, full, golpe, novo, total }) {
  if (!GOLPES.includes(golpe)) return { ok: false, status: 400, mensagem: "Golpe inválido." };
  if (!novo) return { ok: true, conta: false };
  if (total >= MAX_ANALISES) return { ok: false, status: 409, mensagem: "Você chegou ao limite de " + MAX_ANALISES + " análises guardadas. Remova as mais antigas." };
  if (ilimitado(nivel, full)) return { ok: true, conta: true };
  if (usoDe(dados)[golpe] >= LIMITE_FREE_POR_GOLPE) {
    return { ok: false, status: 403, motivo: "limite_free", mensagem: "Você já usou a análise gratuita de " + NOME_GOLPE[golpe] + ". No plano gratuito é 1 análise de cada golpe; para analisar de novo, amplie o plano." };
  }
  return { ok: true, conta: true };
}

/* resumo da análise (o mesmo formato do QLBiomec.resumir), limpo: só os campos conhecidos, com tamanho limitado */
function txt(v, n) { return String(v == null ? "" : v).slice(0, n); }
function num(v) { return typeof v === "number" && isFinite(v) ? Math.round(v * 10) / 10 : null; }
function limparResumo(r) {
  if (!r || typeof r !== "object") return null;
  if (!ID_ANALISE.test(String(r.id || "")) || !GOLPES.includes(r.golpe)) return null;
  const criado = txt(r.criadoEm, 30);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(criado)) return null;
  const S = ["ok", "atencao", "nao_avaliavel"];
  const res = r.res || {};
  return {
    id: r.id, criadoEm: criado, golpe: r.golpe, emp: r.golpe === "backhand" && (r.emp === "1" || r.emp === "2") ? r.emp : "", dom: r.dom === "E" ? "E" : "D",
    itens: (Array.isArray(r.itens) ? r.itens : []).slice(0, 40).map((i) => ({ n: txt(i && i.n, 120), s: S.includes(i && i.s) ? i.s : "nao_avaliavel", v: num(i && i.v), u: txt(i && i.u, 8), r: txt(i && i.r, 40) })),
    res: { ok: Math.max(0, res.ok | 0), atencao: Math.max(0, res.atencao | 0), nao: Math.max(0, res.nao | 0) },
    texto: txt(r.texto, 1500), prio: (Array.isArray(r.prio) ? r.prio : []).slice(0, 10).map((p) => txt(p, 120)), origem: "video",
  };
}

/* relatório completo (JSON do QLMovArquivo): precisa ser da mesma análise e caber num documento */
function relatorioValido(texto, id) {
  if (typeof texto !== "string" || texto.length > MAX_RELATORIO) return false;
  let o; try { o = JSON.parse(texto); } catch (e) { return false; }
  return !!(o && o.id === id && o.resultado && typeof o.resultado === "object");
}

/* trecho do golpe (scout/movimento.js capturarClip): quadros pequenos em JPEG + a pose de cada um, para o vídeo e o boneco rodarem
   juntos no relatório reaberto. Fica num documento à parte (movimentoClips/{id}): não pesa no relatório nem na lista. */
function clipValido(texto) {
  if (typeof texto !== "string" || texto.length > MAX_RELATORIO) return false;
  let o; try { o = JSON.parse(texto); } catch (e) { return false; }
  if (!o || !Array.isArray(o.t) || !Array.isArray(o.fotos) || !Array.isArray(o.poses)) return false;
  if (o.t.length < 2 || o.t.length > 60 || o.fotos.length !== o.t.length || o.poses.length !== o.t.length) return false;
  return o.t.every((x) => typeof x === "number" && isFinite(x)) && o.fotos.every((f) => typeof f === "string" && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(f));
}

module.exports = { GOLPES, LIMITE_FREE_POR_GOLPE, MAX_ANALISES, MAX_RELATORIO, ID_ANALISE, ilimitado, usoDe, cota, avaliarSalvar, limparResumo, relatorioValido, clipValido };
