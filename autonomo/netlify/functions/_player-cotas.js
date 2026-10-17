/* QuadraLab Player — cotas e limites dos planos Free, Start, Pro e Performance.

   Regras puras (sem Firebase): as functions de geração leem o jogador, chamam estas funções DENTRO da transação
   e gravam o que elas devolvem. Nada aqui libera acesso pago nem cobra: o plano vem do nível que o webhook da
   Eduzz (ou a liberação manual) já grava em jogadores/{uid} — p1 = Start, p2 = Pro, p3 = Performance.

   CHAVE DE ATIVAÇÃO: o modelo novo só vale com PLAYER_MODELO_PLANOS=1 no Netlify. Desligada (padrão), tudo se
   comporta como antes. Ligar muda as regras de geração para os usuários atuais, por isso depende de aprovação.

   O que conta e o que não conta:
   · conta: nova geração com IA concluída e salva — plano de jogo (do próprio jogador) ou estratégia contra
     adversário. Geração que falha devolve a cota. Revisão manual e consulta a conteúdo antigo nunca contam.
   · não conta: jogadas e sessões de treino (sem limite em nenhum plano).
   · Free: cota vitalícia (planosGratisUsados). Pagos: por ciclo da assinatura (periodoInicio); sem ciclo
     (liberação manual), por mês-calendário.
   · Crédito avulso (creditosPlano) continua valendo como geração extra de qualquer tipo, como antes. */

const PLANOS = {
  free:        { nome: "Player Free",        planosJogo: 1,  estrategiasAdversario: 0,  adversarios: 0,  programasAtivos: 1,  resultados: 0 },
  start:       { nome: "Player Start",       planosJogo: 2,  estrategiasAdversario: 2,  adversarios: 3,  programasAtivos: 2,  resultados: 5 },
  pro:         { nome: "Player Pro",         planosJogo: 5,  estrategiasAdversario: 5,  adversarios: 10, programasAtivos: 5,  resultados: 20 },
  performance: { nome: "Player Performance", planosJogo: 10, estrategiasAdversario: 12, adversarios: 30, programasAtivos: 10, resultados: null },
};
const NIVEL_PARA_PLANO = { gratis: "free", p1: "start", p2: "pro", p3: "performance" };

function modeloAtivo() { return process.env.PLAYER_MODELO_PLANOS === "1"; }

/* acesso completo (conta de teste) não tem limite; os demais seguem o nível */
function planoIdDoNivel(nivel, full) { return full ? "full" : (NIVEL_PARA_PLANO[nivel] || "free"); }
function limitesDoPlano(planoId) {
  return planoId === "full" ? { nome: "Acesso completo", planosJogo: null, estrategiasAdversario: null, adversarios: null, programasAtivos: null, resultados: null } : PLANOS[planoId] || PLANOS.free;
}

function cicloDe(dados, planoId, hoje) {
  if (planoId === "free" || planoId === "full") return "vitalicio";
  const ass = dados && dados.assinatura;
  if (ass && ass.periodoInicio) return String(ass.periodoInicio).slice(0, 10);
  return "mes-" + String(hoje).slice(0, 7);
}

/* quanto já foi usado neste ciclo */
function usoDoCiclo(dados, planoId, ciclo) {
  /* Free: a cota é vitalícia e conta toda geração já feita (inclusive as de uma assinatura anterior), nunca menos
     que o contador antigo planosGratisUsados */
  if (planoId === "free") return { planosJogo: Math.max((dados && dados.planosGratisUsados) || 0, (dados && dados.geracoesTotal) || 0), estrategiasAdversario: 0 };
  const c = (dados && dados.cotas) || {};
  if (c.ciclo !== ciclo) return { planosJogo: 0, estrategiasAdversario: 0 };
  return { planosJogo: c.planosJogo || 0, estrategiasAdversario: c.estrategiasAdversario || 0 };
}

const ROTULO_TIPO = { planosJogo: "plano de jogo", estrategiasAdversario: "estratégia contra adversário" };

/* Pode gerar? tipo = "planosJogo" | "estrategiasAdversario". Devolve a fonte (modelo, credito ou full) ou o motivo. */
function avaliarGeracao(dados, { planoId, tipo, hoje }) {
  if (planoId === "full") return { fonte: "full" };
  const lim = limitesDoPlano(planoId)[tipo];
  const ciclo = cicloDe(dados, planoId, hoje);
  const usadas = usoDoCiclo(dados, planoId, ciclo)[tipo];
  if (usadas < lim) return { fonte: "modelo", ciclo, usadas, limite: lim };
  if (((dados && dados.creditosPlano) || 0) > 0) return { fonte: "credito", ciclo };
  const free = planoId === "free";
  const renovaEm = !free && dados.assinatura && dados.assinatura.ativoAte ? dados.assinatura.ativoAte : null;
  let mensagem;
  if (lim === 0) mensagem = "Estratégias contra adversários fazem parte dos planos pagos. Seu plano de jogo e o histórico continuam disponíveis.";
  else if (free) mensagem = "Você já usou o seu plano de jogo gratuito. Seus registros continuam disponíveis; para criar outro, amplie o plano.";
  else mensagem = "Você atingiu o limite de " + (tipo === "planosJogo" ? "planos de jogo" : "estratégias contra adversários") + " do seu ciclo. Seus registros continuam disponíveis.";
  return { fonte: null, motivo: lim === 0 ? "plano_sem_recurso" : "limite_modelo", tipo, usadas, limite: lim, renovaEm, mensagem };
}

/* campos a gravar no jogador quando a geração é reservada (fonte "modelo") */
function reservarCota(dados, { planoId, tipo, ciclo }) {
  const total = ((dados && dados.geracoesTotal) || 0) + 1;
  if (planoId === "free") return { planosGratisUsados: ((dados && dados.planosGratisUsados) || 0) + 1, geracoesTotal: total };
  const u = usoDoCiclo(dados, planoId, ciclo);
  u[tipo] += 1;
  return { geracoesTotal: total, cotas: { ciclo, planosJogo: u.planosJogo, estrategiasAdversario: u.estrategiasAdversario } };
}
/* o inverso, quando a geração falha: nunca fica abaixo de zero e só mexe no ciclo em que foi gasta */
function devolverReserva(dados, { planoId, tipo, ciclo }) {
  const total = Math.max(0, ((dados && dados.geracoesTotal) || 0) - 1);
  if (planoId === "free") return { planosGratisUsados: Math.max(0, ((dados && dados.planosGratisUsados) || 0) - 1), geracoesTotal: total };
  const c = (dados && dados.cotas) || {};
  if (c.ciclo !== ciclo) return { geracoesTotal: total };
  const u = { planosJogo: c.planosJogo || 0, estrategiasAdversario: c.estrategiasAdversario || 0 };
  u[tipo] = Math.max(0, u[tipo] - 1);
  return { geracoesTotal: total, cotas: { ciclo, ...u } };
}

/* ── adversários cadastrados ──
   Guardados como mapa no próprio documento do jogador (jogadores/{uid}.adversarios), então entram na mesma
   transação da cota. Só o apelido e uma data: nada de dado pessoal além do que o jogador escreveu na ficha. */
function slugAdversario(nome) {
  return String(nome || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}
function registrarAdversario(dados, nome, planoId, agora) {
  const slug = slugAdversario(nome) || "adversario";
  const mapa = { ...((dados && dados.adversarios) || {}) };
  if (mapa[slug]) return { ok: true, mapa, novo: false, slug };
  const lim = limitesDoPlano(planoId).adversarios;
  if (lim !== null && Object.keys(mapa).length >= lim) {
    return { ok: false, motivo: "limite_adversarios", limite: lim, mensagem: lim === 0
      ? "Estratégias contra adversários fazem parte dos planos pagos."
      : "Você atingiu o limite de adversários cadastrados do seu plano (" + lim + "). Remova um adversário ou amplie o plano; seus registros continuam disponíveis." };
  }
  mapa[slug] = { nome: String(nome || "Adversário").trim().slice(0, 60) || "Adversário", criadoEm: agora };
  return { ok: true, mapa, novo: true, slug };
}

/* ── programas de treinamento ativos ──
   Ativo = em geração, ou pronto, não arquivado, com treino ainda por fazer e sem ter passado da data da última
   sessão. Termina sozinho no fim (todos os treinos registrados ou data vencida) e pode ser arquivado à mão. */
function programaAtivo(p, hoje) {
  if (!p || p.arquivado) return false;
  if (p.status === "gerando") return true;
  if (p.status !== "pronto" || !p.planejamento) return false;
  const regs = p.registros || {};
  let ultima = "", pendente = false;
  for (const w of p.planejamento.semanas || []) for (const s of w.sessoes || []) {
    if (s.data && s.data > ultima) ultima = s.data;
    const r = regs[s.id];
    if (!r || r.status === "em_andamento") pendente = true;
  }
  return pendente && (!ultima || ultima >= hoje);
}
function contarProgramasAtivos(lista, hoje) { return lista.filter((p) => programaAtivo(p, hoje)).length; }
function avaliarPrograma(planoId, ativos) {
  const lim = limitesDoPlano(planoId).programasAtivos;
  if (lim === null || ativos < lim) return { ok: true };
  return { ok: false, limite: lim, mensagem: "Você já tem " + ativos + (ativos === 1 ? " programa de treinamento ativo" : " programas de treinamento ativos") + ", o limite do seu plano. Conclua ou arquive um programa para criar outro; seus programas anteriores continuam disponíveis." };
}

/* resumo para a tela "Minha assinatura" */
function resumoUso(dados, { planoId, hoje, programasAtivos }) {
  const lim = limitesDoPlano(planoId), ciclo = cicloDe(dados, planoId, hoje), u = usoDoCiclo(dados, planoId, ciclo);
  const ass = dados && dados.assinatura;
  return {
    ativo: modeloAtivo(), plano: { id: planoId, nome: lim.nome }, ciclo: planoId === "free" || planoId === "full" ? null : ciclo,
    renovaEm: ass && ass.ativoAte ? ass.ativoAte : null, periodo: planoId === "free" ? "vitalicio" : "ciclo",
    planosJogo: { usadas: u.planosJogo, limite: lim.planosJogo },
    estrategiasAdversario: { usadas: u.estrategiasAdversario, limite: lim.estrategiasAdversario },
    adversarios: { usadas: Object.keys((dados && dados.adversarios) || {}).length, limite: lim.adversarios },
    programasAtivos: { usadas: programasAtivos, limite: lim.programasAtivos },
    creditos: Math.max(0, (dados && dados.creditosPlano) || 0),
  };
}

module.exports = {
  PLANOS, modeloAtivo, planoIdDoNivel, limitesDoPlano, cicloDe, usoDoCiclo, avaliarGeracao, reservarCota, devolverReserva,
  slugAdversario, registrarAdversario, programaAtivo, contarProgramasAtivos, avaliarPrograma, resumoUso, ROTULO_TIPO,
};
