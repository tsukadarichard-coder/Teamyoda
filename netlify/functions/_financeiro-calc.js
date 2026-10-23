/* Financeiro (só controle) · cálculo do mês de uma academia a partir do que o app já registra e da tabela de preços que
   o dono preenche. Nada aqui cobra, gera link ou fala com banco/Eduzz: só soma.

   dados  = { alunos, turmas, quadras, reservas, torneios, eventos, professores: [{ uid, nome }] }
   config = {
     turmas:      { [turmaId]: { preco } }                      mensalidade por aluno da turma
     descontos:   { [turmaId + ":" + alunoId]: { tipo: "pct" | "valor", valor } }
     pacotes:     { [alunoId]: { preco } }                       pacote mensal de aulas individuais
     torneios:    { [torneioId]: { inscricao } }
     eventos:     { [eventoId]: { porPessoa } }
     professores: { [chave]: { forma: "aula" | "fixo" | "pct", individual, turma, fixo, pct } }
     despesas:    [{ id, nome, categoria: "aluguel" | "manutencao" | "materiais" | "outros", valor }]
     impostoPct, inicio: "AAAA-MM",
     meses: { "AAAA-MM": { recebidos: { chave: true }, pagos: { chave: true }, valores: { despesaId: n }, manuais: [{ id, tipo, descricao, valor }] } }
   }
   calcularMes(dados, config, "AAAA-MM") → resumo com entradas, saídas, resultado e o controle do que foi recebido/pago. */
const CATEGORIAS_DESPESA = { aluguel: "Aluguel", manutencao: "Manutenção", materiais: "Materiais", outros: "Outras" };

function num(v) { const n = Number(v); return isFinite(n) ? n : 0; }
function r2(v) { return Math.round(v * 100) / 100; }
function noMes(data, mes) { return typeof data === "string" && data.slice(0, 7) === mes; }
function chaveProfessor(uid, nome) { return uid ? "u:" + uid : "n:" + (nome || ""); }

/* mesma leitura das "Aulas da equipe" do app: cada sessão registrada no caderno; a de turma conta uma vez por dia */
function aulasDoMes(alunos, turmas, mes) {
  const turmaPorNome = new Map((turmas || []).map((t) => [t.nome, t]));
  const ind = [], grupos = new Map();
  (alunos || []).forEach((a) => (a.registros || []).forEach((r) => {
    if (!r || r.tipo !== "sessao" || !noMes(r.data, mes)) return;
    if (r.turma) {
      const chave = r.data + "|" + r.turma;
      if (grupos.has(chave)) return;
      const t = turmaPorNome.get(r.turma);
      grupos.set(chave, { tipo: "turma", data: r.data, turmaId: t ? t.id : null,
        quemUid: r.registradoPorUid || r.substitutoUid || (t && t.professorUid) || "",
        quemNome: r.registradoPorNome || r.substitutoNome || (t && t.professorNome) || "Professor não definido" });
    } else {
      ind.push({ tipo: "individual", data: r.data, alunoId: a.id,
        quemUid: r.registradoPorUid || r.substitutoUid || a.professorUid || "",
        quemNome: r.registradoPorNome || r.substitutoNome || a.professorNome || "Professor não definido" });
    }
  }));
  return ind.concat([...grupos.values()]);
}

/* preço da quadra numa hora (primeira faixa que cobre, igual ao app) */
function precoNaHora(quadra, hora) {
  const f = ((quadra && quadra.faixasPreco) || []).find((x) => x.inicio <= hora && hora < x.fim && x.preco !== "" && x.preco != null && !isNaN(Number(x.preco)));
  return f ? Number(f.preco) : null;
}
function maisMeiaHora(h) { let [a, b] = h.split(":").map(Number); b += 30; if (b >= 60) { b -= 60; a += 1; } return String(a).padStart(2, "0") + ":" + String(b).padStart(2, "0"); }

function calcularMes(dados, config, mes) {
  dados = dados || {}; config = config || {};
  const alunos = dados.alunos || [], turmas = dados.turmas || [], doMes = (config.meses || {})[mes] || {};
  const recebidos = doMes.recebidos || {}, pagos = doMes.pagos || {}, valores = doMes.valores || {};
  const alunoPorId = new Map(alunos.map((a) => [a.id, a]));
  const cfgT = config.turmas || {}, cfgD = config.descontos || {}, cfgP = config.pacotes || {};

  /* ── entradas ── */
  const mensalidades = { total: 0, turmas: [], semPreco: [] };
  turmas.forEach((t) => {
    const membros = (t.membros || []).map((id) => alunoPorId.get(id)).filter(Boolean);
    const preco = num(cfgT[t.id] && cfgT[t.id].preco);
    if (!preco) { if (membros.length) mensalidades.semPreco.push({ id: t.id, nome: t.nome || "Turma", alunos: membros.length }); return; }
    const linhas = membros.map((a) => {
      const d = cfgD[t.id + ":" + a.id], desconto = !d ? 0 : d.tipo === "pct" ? preco * Math.min(100, num(d.valor)) / 100 : Math.min(preco, num(d.valor));
      const chave = "m:" + t.id + ":" + a.id;
      return { chave, alunoId: a.id, nome: a.nome || "Sem nome", bruto: preco, desconto: r2(desconto), valor: r2(preco - desconto), recebido: !!recebidos[chave] };
    });
    const total = r2(linhas.reduce((s, l) => s + l.valor, 0));
    mensalidades.turmas.push({ id: t.id, nome: t.nome || "Turma", preco, professorUid: t.professorUid || "", professorNome: t.professorNome || "", alunos: linhas, total });
    mensalidades.total += total;
  });
  mensalidades.total = r2(mensalidades.total);

  const aulas = aulasDoMes(alunos, turmas, mes);
  const pacotes = { total: 0, alunos: [] };
  Object.keys(cfgP).forEach((id) => {
    const a = alunoPorId.get(id), preco = num(cfgP[id] && cfgP[id].preco); if (!a || !preco) return;
    const chave = "p:" + id;
    pacotes.alunos.push({ chave, alunoId: id, nome: a.nome || "Sem nome", professorUid: a.professorUid || "", valor: preco,
      aulasNoMes: aulas.filter((x) => x.tipo === "individual" && x.alunoId === id).length, recebido: !!recebidos[chave] });
    pacotes.total += preco;
  });
  pacotes.total = r2(pacotes.total);

  const quadras = { total: 0, reservas: 0, horasSemPreco: 0, porQuadra: [] };
  const quadraPorId = new Map((dados.quadras || []).map((q) => [q.id, q]));
  const porQ = new Map();
  (dados.reservas || []).forEach((r) => {
    if (!noMes(r.data, mes) || !r.horaInicio || !r.horaFim || r.status === "cancelada") return;
    const q = quadraPorId.get(r.quadraId); let v = 0, semPreco = 0;
    for (let h = r.horaInicio; h < r.horaFim; h = maisMeiaHora(h)) { const p = precoNaHora(q, h); if (p == null) semPreco += 0.5; else v += p / 2; }
    const k = r.quadraId || "?", e = porQ.get(k) || { id: k, nome: (q && q.nome) || "Quadra", reservas: 0, total: 0, horasSemPreco: 0 };
    e.reservas++; e.total += v; e.horasSemPreco += semPreco; porQ.set(k, e);
    quadras.reservas++; quadras.total += v; quadras.horasSemPreco += semPreco;
  });
  quadras.porQuadra = [...porQ.values()].map((e) => ({ ...e, total: r2(e.total) }));
  quadras.total = r2(quadras.total);

  const torneios = { total: 0, lista: [] };
  (dados.torneios || []).forEach((t) => {
    if (!noMes(t.dataInicio || (t.criadoEm || "").slice(0, 10), mes)) return;
    const inscritos = (t.categorias || []).reduce((s, c) => s + (c.inscritos || []).length, 0), preco = num((config.torneios || {})[t.id] && config.torneios[t.id].inscricao);
    torneios.lista.push({ id: t.id, nome: t.nome || "Torneio", inscritos, preco, total: r2(inscritos * preco) });
    torneios.total += inscritos * preco;
  });
  torneios.total = r2(torneios.total);

  const eventos = { total: 0, lista: [] };
  (dados.eventos || []).forEach((ev) => {
    if (!noMes(ev.data, mes)) return;
    const confirmados = (ev.convidados || []).filter((c) => (c.status || "confirmado") === "confirmado").length, preco = num((config.eventos || {})[ev.id] && config.eventos[ev.id].porPessoa);
    eventos.lista.push({ id: ev.id, nome: ev.nome || "Evento", confirmados, preco, total: r2(confirmados * preco) });
    eventos.total += confirmados * preco;
  });
  eventos.total = r2(eventos.total);

  const manuais = (doMes.manuais || []).map((m) => ({ id: m.id, tipo: m.tipo === "saida" ? "saida" : "entrada", descricao: m.descricao || "", valor: r2(num(m.valor)) }));
  const manuaisEntrada = r2(manuais.filter((m) => m.tipo === "entrada").reduce((s, m) => s + m.valor, 0));
  const manuaisSaida = r2(manuais.filter((m) => m.tipo === "saida").reduce((s, m) => s + m.valor, 0));
  const entradas = r2(mensalidades.total + pacotes.total + quadras.total + torneios.total + eventos.total + manuaisEntrada);

  /* ── saídas ── */
  const profs = new Map();
  (dados.professores || []).forEach((p) => profs.set(chaveProfessor(p.uid, p.nome), { chave: chaveProfessor(p.uid, p.nome), uid: p.uid || "", nome: p.nome || "Professor" }));
  aulas.forEach((x) => {
    const k = x.quemUid && profs.has("u:" + x.quemUid) ? "u:" + x.quemUid : chaveProfessor(x.quemUid, x.quemNome);
    if (!profs.has(k)) profs.set(k, { chave: k, uid: x.quemUid || "", nome: x.quemNome });
    x.chave = k;
  });
  const professores = { total: 0, lista: [] };
  profs.forEach((p) => {
    const cfg = (config.professores || {})[p.chave] || {}, forma = cfg.forma || "aula";
    const ind = aulas.filter((x) => x.chave === p.chave && x.tipo === "individual").length, tur = aulas.filter((x) => x.chave === p.chave && x.tipo === "turma").length;
    const gerada = r2(mensalidades.turmas.filter((t) => p.uid && t.professorUid === p.uid).reduce((s, t) => s + t.total, 0) +
      pacotes.alunos.filter((a) => p.uid && a.professorUid === p.uid).reduce((s, a) => s + a.valor, 0));
    const valor = r2(forma === "fixo" ? num(cfg.fixo) : forma === "pct" ? gerada * num(cfg.pct) / 100 : ind * num(cfg.individual) + tur * num(cfg.turma));
    const chave = "prof:" + p.chave;
    professores.lista.push({ chave, professor: p.chave, nome: p.nome, forma, aulasIndividuais: ind, aulasTurma: tur, receitaGerada: gerada, valor, configurado: !!(config.professores || {})[p.chave], pago: !!pagos[chave] });
    professores.total += valor;
  });
  professores.lista.sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome));
  professores.total = r2(professores.total);

  const fixas = { total: 0, lista: [] };
  (config.despesas || []).forEach((d) => {
    const valor = r2(num(valores[d.id] != null ? valores[d.id] : d.valor)), chave = "d:" + d.id;
    fixas.lista.push({ chave, id: d.id, nome: d.nome || "Despesa", categoria: CATEGORIAS_DESPESA[d.categoria] ? d.categoria : "outros", valor, pago: !!pagos[chave] });
    fixas.total += valor;
  });
  fixas.total = r2(fixas.total);

  const impostoPct = num(config.impostoPct), imposto = { pct: impostoPct, valor: r2(entradas * impostoPct / 100), pago: !!pagos.imposto };
  const saidas = r2(professores.total + fixas.total + imposto.valor + manuaisSaida);

  /* ── controle: o que entrou e o que saiu de fato ── */
  const aReceber = mensalidades.turmas.flatMap((t) => t.alunos).concat(pacotes.alunos);
  const recebido = r2(aReceber.filter((l) => l.recebido).reduce((s, l) => s + l.valor, 0));
  const emAberto = aReceber.filter((l) => !l.recebido && l.valor > 0);
  const aPagar = professores.lista.map((p) => ({ chave: p.chave, valor: p.valor, pago: p.pago })).concat(fixas.lista, [{ chave: "imposto", valor: imposto.valor, pago: imposto.pago }]);
  const pago = r2(aPagar.filter((l) => l.pago).reduce((s, l) => s + l.valor, 0));

  return {
    mes, entradas, saidas, resultado: r2(entradas - saidas), margem: entradas ? Math.round((entradas - saidas) / entradas * 1000) / 10 : null,
    receitas: { mensalidades, pacotes, quadras, torneios, eventos, manuais: manuaisEntrada },
    despesas: { professores, fixas, imposto, manuais: manuaisSaida },
    manuais,
    controle: { recebido, aReceber: r2(aReceber.reduce((s, l) => s + l.valor, 0)), emAberto: emAberto.map((l) => ({ chave: l.chave, nome: l.nome, valor: l.valor })),
      pago, aPagar: r2(aPagar.reduce((s, l) => s + l.valor, 0)), pendentesPagar: aPagar.filter((l) => !l.pago && l.valor > 0).length },
  };
}

/* soma de várias academias no mesmo mês (visão geral) */
function somarMeses(lista) {
  const s = { entradas: 0, saidas: 0, resultado: 0, recebido: 0, aReceber: 0, pago: 0, aPagar: 0, porTipo: { mensalidades: 0, pacotes: 0, quadras: 0, torneios: 0, eventos: 0, manuaisEntrada: 0, professores: 0, fixas: 0, imposto: 0, manuaisSaida: 0 } };
  lista.forEach((m) => {
    s.entradas += m.entradas; s.saidas += m.saidas; s.resultado += m.resultado;
    s.recebido += m.controle.recebido; s.aReceber += m.controle.aReceber; s.pago += m.controle.pago; s.aPagar += m.controle.aPagar;
    const t = s.porTipo;
    t.mensalidades += m.receitas.mensalidades.total; t.pacotes += m.receitas.pacotes.total; t.quadras += m.receitas.quadras.total;
    t.torneios += m.receitas.torneios.total; t.eventos += m.receitas.eventos.total; t.manuaisEntrada += m.receitas.manuais;
    t.professores += m.despesas.professores.total; t.fixas += m.despesas.fixas.total; t.imposto += m.despesas.imposto.valor; t.manuaisSaida += m.despesas.manuais;
  });
  Object.keys(s).forEach((k) => { if (typeof s[k] === "number") s[k] = r2(s[k]); });
  Object.keys(s.porTipo).forEach((k) => { s.porTipo[k] = r2(s.porTipo[k]); });
  s.margem = s.entradas ? Math.round(s.resultado / s.entradas * 1000) / 10 : null;
  return s;
}

/* meses anteriores para comparar (AAAA-MM, do mais antigo ao atual) */
function mesesAte(mes, n) {
  const [a, m] = mes.split("-").map(Number), l = [];
  for (let k = n - 1; k >= 0; k--) { const d = new Date(Date.UTC(a, m - 1 - k, 1)); l.push(d.toISOString().slice(0, 7)); }
  return l;
}

module.exports = { calcularMes, somarMeses, mesesAte, aulasDoMes, chaveProfessor, CATEGORIAS_DESPESA };
