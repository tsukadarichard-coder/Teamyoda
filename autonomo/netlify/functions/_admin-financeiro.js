/* Lançamentos manuais do controle financeiro do painel (receitas e despesas que o sistema não vê sozinho).
   Valores sempre em centavos inteiros. Nada aqui cobra, reembolsa ou fala com a Eduzz. */
const TIPOS = ["receita", "despesa"];
const PRODUTOS = { player: "QuadraLab Player", competicao: "QuadraLab Competição", consultoria: "Consultorias avulsas", acompanhamento: "Acompanhamento MTY", treinador: "App do treinador (academias)", geral: "Geral / sem produto" };
const CATEGORIAS_RECEITA = { eduzz: "Venda pela Eduzz", pix: "Pix / transferência", cartao: "Cartão / maquininha", outra: "Outra receita" };
const CATEGORIAS_DESPESA = { plataforma: "Taxas da plataforma (Eduzz, pagamento)", ferramentas: "Ferramentas e hospedagem", ia: "IA e serviços de software", marketing: "Marketing e anúncios", impostos: "Impostos", equipe: "Equipe e profissionais", reembolso: "Reembolso ao cliente", outra: "Outra despesa" };
const MAX_CENTAVOS = 1000000000; // R$ 10 milhões

function categoriasDe(tipo) { return tipo === "receita" ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA; }
function dataValida(s) { if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const d = new Date(s + "T12:00:00Z"); return !isNaN(d) && d.toISOString().slice(0, 10) === s && +s.slice(0, 4) >= 2020 && +s.slice(0, 4) <= 2100; }

/* aceita centavos inteiros; texto em reais ("1.234,56") só quando vier como string */
function centavosDe(v) {
  if (typeof v === "number") return Number.isInteger(v) ? v : NaN;
  const t = String(v == null ? "" : v).trim().replace(/^R\$\s*/, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(t)) return NaN;
  const [i, f = ""] = t.replace(/\./g, "").split(",");
  return parseInt(i, 10) * 100 + parseInt((f + "00").slice(0, 2), 10);
}
function validar(b) {
  const tipo = String(b.tipo || "");
  if (!TIPOS.includes(tipo)) return { erro: "Escolha receita ou despesa." };
  const data = String(b.data || "");
  if (!dataValida(data)) return { erro: "Informe uma data válida." };
  const valorCentavos = centavosDe(b.valorCentavos != null ? b.valorCentavos : b.valor);
  if (!Number.isInteger(valorCentavos) || valorCentavos <= 0 || valorCentavos > MAX_CENTAVOS) return { erro: "Informe um valor maior que zero, por exemplo 149,90." };
  const categoria = String(b.categoria || "");
  if (!categoriasDe(tipo)[categoria]) return { erro: "Escolha uma categoria." };
  const produto = String(b.produto || "geral");
  if (!PRODUTOS[produto]) return { erro: "Escolha o produto." };
  const descricao = String(b.descricao || "").replace(/\s+/g, " ").trim().slice(0, 200);
  if (!descricao) return { erro: "Descreva o lançamento em poucas palavras." };
  return { ok: { tipo, data, valorCentavos, categoria, produto, descricao } };
}
module.exports = { TIPOS, PRODUTOS, CATEGORIAS_RECEITA, CATEGORIAS_DESPESA, categoriasDe, validar, centavosDe, dataValida };
