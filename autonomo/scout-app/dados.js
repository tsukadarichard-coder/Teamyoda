/* QuadraLab Scout: dados do app (atletas e jogos no próprio aparelho), sem tela.
   As contas do jogo (placar, números, resumo) vêm do motor do scout (player/scout-motor.js, QLScoutMotor): as mesmas regras e
   os mesmos números do scout do treinador e do responsável. O nome do adversário e as anotações ficam só no aparelho.
   Usado por app.js no navegador e pelos testes no Node (module.exports). */
(function (raiz) {
  "use strict";
  var VERSAO = 1;
  var CHAVE = "qls:v1";
  var MAX_ATLETAS = 60, MAX_JOGOS = 400;
  var CFG_PADRAO = { formato: "3sets", saca: "nos", semVantagem: false, superTiebreakDecisivo: false, dupla: false, sacaDupla: "atleta" };
  var FORMATOS = ["3sets", "1set", "4games", "tb7", "tb10"];

  function txt(v, max) { return String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max); }
  function hex(n) { var s = ""; for (var i = 0; i < n; i++) s += Math.floor(Math.random() * 16).toString(16); return s; }
  function aleatorio(n) {
    try {
      var c = (raiz.crypto && raiz.crypto.getRandomValues) ? raiz.crypto : null;
      if (c) { var b = new Uint8Array(n / 2); c.getRandomValues(b); return Array.prototype.map.call(b, function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); }
    } catch (e) { /* segue sem crypto */ }
    return hex(n);
  }
  function novoId(prefixo) { return prefixo + Date.now().toString(36) + aleatorio(6); }
  /* data local do aparelho (o jogo é "hoje" para quem está na arquibancada) */
  function hojeLocal(d) { d = d || new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function agoraISO() { return new Date().toISOString(); }

  function vazio() { return { v: VERSAO, aparelho: aleatorio(24), atletas: [], jogos: [], criadoEm: agoraISO() }; }

  function cfgLimpa(c) {
    c = c || {};
    var f = FORMATOS.indexOf(c.formato) >= 0 ? c.formato : CFG_PADRAO.formato;
    return { formato: f, saca: c.saca === "ele" ? "ele" : "nos", semVantagem: f === "tb7" || f === "tb10" ? false : !!c.semVantagem, superTiebreakDecisivo: f === "3sets" ? !!c.superTiebreakDecisivo : false,
      dupla: !!c.dupla, sacaDupla: c.sacaDupla === "parceiro" ? "parceiro" : "atleta" };
  }
  /* Tempo de partida: `inicioEm` nasce no primeiro ponto marcado e `fimEm` quando o jogo termina (pelo placar ou por
     "encerrar"). `duracaoMin` é o ajuste à mão (chuva, marcação começada depois): quando existe, vale mais que o relógio. */
  var ISO_T = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/, MAX_DURACAO_MIN = 720;
  function minutosValidos(v) { var n = Math.round(Number(v)); return n >= 1 && n <= MAX_DURACAO_MIN ? n : null; }
  function jogoLimpo(j) {
    var x = jogoLimpoBase(j);
    if (!x) return null;
    if (ISO_T.test(String(j.inicioEm))) x.inicioEm = j.inicioEm;
    if (x.inicioEm && ISO_T.test(String(j.fimEm)) && j.fimEm >= x.inicioEm) x.fimEm = j.fimEm;
    if (minutosValidos(j.duracaoMin)) x.duracaoMin = minutosValidos(j.duracaoMin);
    return x;
  }
  /* segundos de jogo: o ajuste à mão, ou do primeiro ponto até o fim (ou até agora, com o jogo em andamento); null se não dá para saber */
  function duracaoSeg(j, agoraMs) {
    if (!j) return null;
    if (minutosValidos(j.duracaoMin)) return minutosValidos(j.duracaoMin) * 60;
    if (!j.inicioEm) return null;
    var fim = j.fimEm ? Date.parse(j.fimEm) : (agoraMs == null ? Date.now() : agoraMs), seg = Math.round((fim - Date.parse(j.inicioEm)) / 1000);
    return seg >= 0 && seg <= MAX_DURACAO_MIN * 60 ? seg : null;
  }
  function duracaoMin(j, agoraMs) { var s = duracaoSeg(j, agoraMs); return s == null ? null : Math.max(1, Math.round(s / 60)); }
  function textoDuracao(seg) {
    if (seg == null) return "";
    var m = Math.round(seg / 60);
    if (m < 1) return "menos de 1 min";
    return m < 60 ? m + " min" : Math.floor(m / 60) + "h" + String(m % 60).padStart(2, "0");
  }
  function definirDuracao(j, minutos) { var n = minutosValidos(minutos); if (n) j.duracaoMin = n; else delete j.duracaoMin; tocar(j); }
  /* encerrar antes do fim do placar, e voltar a marcar */
  function encerrar(j) { j.fim = true; if (j.inicioEm && !j.fimEm) j.fimEm = agoraISO(); tocar(j); }
  function reabrir(j) { j.fim = false; delete j.fimEm; tocar(j); }
  function jogoLimpoBase(j) {
    if (!j || typeof j !== "object" || typeof j.id !== "string" || typeof j.atletaId !== "string") return null;
    return {
      id: txt(j.id, 40), atletaId: txt(j.atletaId, 40), data: /^\d{4}-\d{2}-\d{2}$/.test(j.data) ? j.data : hojeLocal(),
      torneio: txt(j.torneio, 80), adversario: txt(j.adversario, 80), cfg: cfgLimpa(j.cfg),
      pontos: Array.isArray(j.pontos) ? j.pontos.filter(function (p) { return p && typeof p === "object" && typeof p.nos === "boolean"; }).slice(0, 2000) : [],
      mental: j.mental && typeof j.mental === "object" ? { antes: j.mental.antes || {}, jogo: j.mental.jogo || {}, depois: j.mental.depois || {} } : { antes: {}, jogo: {}, depois: {} },
      nivelAdversario: txt(j.nivelAdversario, 20), observacaoFinal: txt(j.observacaoFinal, 1200), fim: !!j.fim, usoFim: !!j.usoFim,
      parceiro: txt(j.parceiro, 60), inversoes: (Array.isArray(j.inversoes) ? j.inversoes : []).map(function (x) { return Math.round(+x); }).filter(function (x) { return x >= 0 && x <= 999; }).slice(0, 200),
      criadoEm: typeof j.criadoEm === "string" ? j.criadoEm : agoraISO(), atualizadoEm: typeof j.atualizadoEm === "string" ? j.atualizadoEm : agoraISO(),
    };
  }
  /* aceita qualquer coisa vinda do armazenamento e devolve um estado válido */
  function normalizar(x) {
    if (!x || typeof x !== "object") return vazio();
    var st = { v: VERSAO, aparelho: /^[a-f0-9]{16,32}$/.test(x.aparelho) ? x.aparelho : aleatorio(24), criadoEm: typeof x.criadoEm === "string" ? x.criadoEm : agoraISO(), atletas: [], jogos: [] };
    (Array.isArray(x.atletas) ? x.atletas : []).forEach(function (a) {
      if (a && typeof a.id === "string" && txt(a.nome, 60) && st.atletas.length < MAX_ATLETAS) st.atletas.push(atletaLimpo(a));
    });
    var ids = {}; st.atletas.forEach(function (a) { ids[a.id] = 1; });
    (Array.isArray(x.jogos) ? x.jogos : []).forEach(function (j) { var l = jogoLimpo(j); if (l && ids[l.atletaId] && st.jogos.length < MAX_JOGOS) st.jogos.push(l); });
    if (x.atual && st.jogos.some(function (j) { return j.id === x.atual && !j.fim; })) st.atual = x.atual;
    return st;
  }

  /* Notas do atleta: UTR (1,00 a 16,50; maior é melhor) e WTN (1,0 a 40,0; menor é melhor). Digitadas por quem acompanha o atleta,
     com a data; o histórico guarda cada mudança para mostrar a evolução. A busca automática depende de autorização do UTR e do WTN. */
  var NOTAS = { utr: { rot: "UTR", min: 1, max: 16.5, casas: 2 }, wtn: { rot: "WTN", min: 1, max: 40, casas: 1 } }, MAX_HIST_NOTAS = 40;
  function numeroNota(tipo, v) {
    var c = NOTAS[tipo]; if (!c || v == null || v === "") return null;
    var n = Number(String(v).replace(",", ".").trim());
    if (!isFinite(n) || n < c.min || n > c.max) return null;
    var f = Math.pow(10, c.casas); return Math.round(n * f) / f;
  }
  function dataNota(d) { return /^\d{4}-\d{2}-\d{2}$/.test(String(d || "")) ? d : null; }
  function notasLimpas(x) {
    if (!x || typeof x !== "object") return null;
    var out = {};
    Object.keys(NOTAS).forEach(function (t) { var v = numeroNota(t, x[t] && x[t].v), em = dataNota(x[t] && x[t].em); if (v != null && em) out[t] = { v: v, em: em }; });
    var hist = (Array.isArray(x.hist) ? x.hist : []).map(function (h) { var v = h && numeroNota(h.t, h.v), em = h && dataNota(h.em); return v != null && em ? { t: h.t, v: v, em: em } : null; }).filter(Boolean).slice(-MAX_HIST_NOTAS);
    if (hist.length) out.hist = hist;
    return Object.keys(out).length ? out : null;
  }
  /* grava (ou apaga, com valor vazio) a nota de hoje; o mesmo dia substitui o que já estava no histórico */
  function definirNota(st, atletaId, tipo, valor, hoje) {
    var a = atleta(st, atletaId), c = NOTAS[tipo];
    if (!a || !c) return { erro: "Atleta não encontrado." };
    var notas = notasLimpas(a.notas) || {}, em = dataNota(hoje) || hojeLocal();
    if (valor == null || String(valor).trim() === "") { delete notas[tipo]; }
    else {
      var v = numeroNota(tipo, valor);
      if (v == null) return { erro: c.rot + " deve ficar entre " + String(c.min).replace(".", ",") + " e " + String(c.max).replace(".", ",") + "." };
      notas[tipo] = { v: v, em: em };
      notas.hist = (notas.hist || []).filter(function (h) { return !(h.t === tipo && h.em === em); }).concat([{ t: tipo, v: v, em: em }]).slice(-MAX_HIST_NOTAS);
    }
    var limpa = notasLimpas(notas); if (limpa) a.notas = limpa; else delete a.notas;
    return { atleta: a };
  }
  /* junta as notas de uma cópia às do aparelho: vale a mais recente de cada tipo e o histórico soma, sem repetir o dia */
  function juntarNotas(a, outras) {
    var o = notasLimpas(outras); if (!o) return;
    var m = notasLimpas(a.notas) || {}, visto = {};
    Object.keys(NOTAS).forEach(function (t) { if (o[t] && (!m[t] || o[t].em > m[t].em)) m[t] = o[t]; });
    m.hist = (m.hist || []).concat(o.hist || []).filter(function (h) { var k = h.t + h.em; if (visto[k]) return false; visto[k] = 1; return true; })
      .sort(function (x, y) { return x.em < y.em ? -1 : x.em > y.em ? 1 : 0; }).slice(-MAX_HIST_NOTAS);
    var limpa = notasLimpas(m); if (limpa) a.notas = limpa;
  }
  function formatarNota(tipo, v) { return v == null ? "" : Number(v).toFixed(NOTAS[tipo].casas).replace(".", ","); }
  /* nota anterior à atual (a última do histórico com valor diferente), para mostrar se subiu ou desceu */
  function notaAnterior(a, tipo) {
    var n = a && a.notas, atual = n && n[tipo]; if (!atual) return null;
    var h = (n.hist || []).filter(function (x) { return x.t === tipo && x.em < atual.em && x.v !== atual.v; });
    return h.length ? h[h.length - 1] : null;
  }
  function textoNotas(a) {
    var n = a && a.notas; if (!n) return "";
    return Object.keys(NOTAS).filter(function (t) { return n[t]; }).map(function (t) { return NOTAS[t].rot + " " + formatarNota(t, n[t].v); }).join(" · ");
  }
  function atletaLimpo(a) {
    var out = { id: txt(a.id, 40), nome: txt(a.nome, 60), criadoEm: typeof a.criadoEm === "string" ? a.criadoEm : agoraISO() }, n = notasLimpas(a.notas);
    if (n) out.notas = n;
    return out;
  }

  function atleta(st, id) { return st.atletas.filter(function (a) { return a.id === id; })[0] || null; }
  function jogo(st, id) { return st.jogos.filter(function (j) { return j.id === id; })[0] || null; }

  function addAtleta(st, nome) {
    nome = txt(nome, 60);
    if (!nome) return { erro: "Digite o nome do atleta." };
    var igual = st.atletas.filter(function (a) { return a.nome.toLowerCase() === nome.toLowerCase(); })[0];
    if (igual) return { atleta: igual };
    if (st.atletas.length >= MAX_ATLETAS) return { erro: "Limite de " + MAX_ATLETAS + " atletas neste aparelho." };
    var a = { id: novoId("a"), nome: nome, criadoEm: agoraISO() };
    st.atletas.push(a);
    return { atleta: a };
  }
  function renomearAtleta(st, id, nome) {
    var a = atleta(st, id); nome = txt(nome, 60);
    if (!a) return { erro: "Atleta não encontrado." };
    if (!nome) return { erro: "Digite o nome do atleta." };
    a.nome = nome; return { atleta: a };
  }
  /* apagar o atleta apaga os jogos dele: o app pede confirmação antes */
  function removerAtleta(st, id) {
    var n = st.jogos.filter(function (j) { return j.atletaId === id; }).length;
    st.atletas = st.atletas.filter(function (a) { return a.id !== id; });
    st.jogos = st.jogos.filter(function (j) { return j.atletaId !== id; });
    if (st.atual && !jogo(st, st.atual)) delete st.atual;
    return { jogosApagados: n };
  }

  function novoJogo(st, o) {
    o = o || {};
    if (!atleta(st, o.atletaId)) return { erro: "Escolha o atleta." };
    if (st.jogos.length >= MAX_JOGOS) return { erro: "Limite de " + MAX_JOGOS + " jogos neste aparelho. Faça uma cópia e apague jogos antigos." };
    var j = jogoLimpo({ id: novoId("j"), atletaId: o.atletaId, data: hojeLocal(), torneio: o.torneio, adversario: o.adversario, parceiro: o.parceiro, cfg: o.cfg, pontos: [] });
    st.jogos.push(j); st.atual = j.id;
    return { jogo: j };
  }
  function removerJogo(st, id) { st.jogos = st.jogos.filter(function (j) { return j.id !== id; }); if (st.atual === id) delete st.atual; }
  function tocar(j) { j.atualizadoEm = agoraISO(); }

  /* placar a partir dos pontos (o motor refaz a partida ponto a ponto) */
  function placar(M, j) {
    var c = j.cfg, e = M.placarInicial(c.formato, c.saca, c.semVantagem, c.superTiebreakDecisivo);
    j.pontos.forEach(function (p) { e = M.aplicaPonto(e, p.nos); });
    return e;
  }
  function textoSets(pl) {
    var sets = pl.sets.map(function (x) { return x[0] + "-" + x[1]; });
    if (!pl.fim && (pl.g[0] || pl.g[1])) sets.push(pl.g[0] + "-" + pl.g[1]);
    return sets.join(" ");
  }
  function encerrado(M, j) { return !!(j.fim || placar(M, j).fim); }

  /* ── Dupla (pedido de 12/11/2026) ──
     Quem da nossa dupla saca: cada bloco seguido de pontos com saque da dupla é um "turno" (um game, ou 1–2 pontos no tie-break);
     os turnos alternam atleta e parceiro, começando por cfg.sacaDupla. "Trocar quem saca" grava o turno em j.inversoes e inverte
     a ordem dali em diante (ex.: no começo do 2º set a dupla escolheu outra ordem). */
  function turnoDaDupla(M, j) {
    var c = j.cfg, e = M.placarInicial(c.formato, c.saca, c.semVantagem, c.superTiebreakDecisivo), turnos = 0, ant = null;
    j.pontos.forEach(function (p) { var s = M.quemSaca(e); if (s === "nos" && ant !== "nos") turnos++; ant = s; e = M.aplicaPonto(e, p.nos); });
    if (M.quemSaca(e) !== "nos") return -1;
    return (ant === "nos" ? turnos : turnos + 1) - 1;
  }
  function quemSacaNoTurno(j, turno) {
    var inv = (j.inversoes || []).filter(function (t) { return t <= turno; }).length, primeiro = j.cfg.sacaDupla === "parceiro" ? "parceiro" : "atleta";
    return (turno + inv) % 2 === 0 ? primeiro : (primeiro === "atleta" ? "parceiro" : "atleta");
  }
  function sacadorDaDupla(M, j) { if (!j.cfg.dupla) return null; var t = turnoDaDupla(M, j); return t < 0 ? null : quemSacaNoTurno(j, t); }
  function trocarSacadorDupla(M, j) {
    if (!j.cfg.dupla) return false;
    var t = turnoDaDupla(M, j); if (t < 0) return false;
    j.inversoes = j.inversoes || []; var i = j.inversoes.indexOf(t);
    if (i >= 0) j.inversoes.splice(i, 1); else j.inversoes.push(t);
    tocar(j); return true;
  }
  function nomeParceiro(j) { return txt(j.parceiro, 60) || "Parceiro(a)"; }
  /* números de cada um na dupla: winners, erros, aces, duplas faltas e o saque */
  function numerosDaDupla(j) {
    var z = function () { return { winners: 0, erros: 0, aces: 0, df: 0, saquesMarcados: 0, primeiroDentro: 0, pontosSacando: 0, ganhosSacando: 0 }; };
    var out = { atleta: z(), parceiro: z() };
    j.pontos.forEach(function (p) {
      var quem = p.quem === "parceiro" ? "parceiro" : p.quem === "atleta" ? "atleta" : null, sac = p.sacadorNos === "parceiro" ? "parceiro" : p.sacadorNos === "atleta" ? "atleta" : null;
      if (quem && p.fim === "winner_nos" && p.saque !== "ace") out[quem].winners++;
      if (quem && p.fim === "erro_nos" && p.saque !== "df") out[quem].erros++;
      if (sac) {
        var x = out[sac]; x.pontosSacando++; if (p.nos) x.ganhosSacando++;
        if (p.saque === "ace") x.aces++;
        if (p.saque === "df") x.df++;
        if (p.saque) { x.saquesMarcados++; if (p.saque === "1" || p.saque === "ace") x.primeiroDentro++; }
      }
    });
    ["atleta", "parceiro"].forEach(function (k) { var x = out[k]; x.pctPrimeiro = x.saquesMarcados ? Math.round(x.primeiroDentro * 100 / x.saquesMarcados) : null; x.pctGanhosSacando = x.pontosSacando ? Math.round(x.ganhosSacando * 100 / x.pontosSacando) : null; });
    return out;
  }
  function mesmaModalidade(a, b) { return !!(a && a.cfg && a.cfg.dupla) === !!(b && b.cfg && b.cfg.dupla); }

  /* marca um ponto: completa placar antes, game e set, como o scout do responsável */
  function marcarPonto(M, j, p) {
    var pl = placar(M, j);
    if (pl.fim || j.fim) return { erro: "A partida já terminou." };
    var q = {}; Object.keys(p || {}).forEach(function (k) { q[k] = p[k]; });
    q.nos = !!q.nos; q.n = j.pontos.length + 1; q.placarAntes = M.rotuloPontos(pl); q.jogo = M.numeroDoGame(pl); q.set = M.numeroDoSet(pl);
    if (j.cfg.dupla) {
      var sac = sacadorDaDupla(M, j);
      if (sac) q.sacadorNos = sac; else delete q.sacadorNos;
      /* ace e dupla falta da dupla são de quem está sacando; winner e erro, de quem a pessoa marcou */
      if ((q.saque === "ace" || q.saque === "df") && sac) q.quem = sac;
      else if (q.fim === "winner_nos" || q.fim === "erro_nos") q.quem = q.quem === "parceiro" ? "parceiro" : "atleta";
      else delete q.quem;
    } else { delete q.quem; delete q.sacadorNos; }
    if (!j.inicioEm) j.inicioEm = agoraISO(); // o relógio da partida começa no primeiro ponto
    j.pontos.push(q); tocar(j);
    var acabou = placar(M, j).fim;
    if (acabou) j.fimEm = agoraISO();
    return { ponto: q, fim: acabou };
  }
  function desfazer(j) { if (!j.pontos.length) return false; j.pontos.pop(); j.fim = false; delete j.fimEm; if (!j.pontos.length) delete j.inicioEm; tocar(j); return true; }

  /* resumo no formato da página da família (o mesmo que os gráficos de scout/graficos.js desenham) */
  function resumoBase(M, st, j) {
    var a = atleta(st, j.atletaId), pl = placar(M, j), rr = M.resume(j.pontos);
    return M.montarResumoPublico({ data: j.data, torneio: j.torneio, resultado: textoSets(pl), concluida: !!(pl.fim || j.fim), observacaoFinal: j.observacaoFinal, nivelAdversario: j.nivelAdversario, mental: j.mental,
      scout: Object.assign({}, rr, { pontos: j.pontos, cfg: j.cfg }) }, { nome: a ? a.nome : "Atleta" });
  }
  /* na dupla, o resumo (gráficos, link da família, texto do WhatsApp) fala da dupla, sem o nome do parceiro: "Dupla de Lucas" */
  function resumo(M, st, j) { var r = resumoBase(M, st, j); if (j.cfg && j.cfg.dupla) { r.atleta = ("Dupla de " + r.atleta).slice(0, 40); r.dupla = true; } return r; }
  /* estatísticas somadas (aba Relatórios, pedido de 13/11/2026): os pontos de vários jogos do mesmo atleta e da mesma modalidade
     viram um resumo só, no mesmo formato dos gráficos do fim do jogo (sem placar, sets nem mental, que são de cada jogo) */
  function resumoSomado(M, st, jogos) {
    var lista = (jogos || []).filter(function (j) { return j && j.pontos && j.pontos.length; });
    if (!lista.length) return null;
    var pts = [], a = atleta(st, lista[0].atletaId), cfg = lista[0].cfg;
    lista.forEach(function (j) { pts = pts.concat(j.pontos); });
    var r = M.montarResumoPublico({ data: lista[0].data, torneio: "", resultado: "", concluida: true, observacaoFinal: "", nivelAdversario: "", mental: {},
      scout: Object.assign({}, M.resume(pts), { pontos: pts, cfg: cfg }) }, { nome: a ? a.nome : "Atleta" });
    if (cfg && cfg.dupla) { r.atleta = ("Dupla de " + r.atleta).slice(0, 40); r.dupla = true; }
    r.jogosSomados = lista.length;
    return r;
  }
  /* jogos terminados do mesmo atleta, antes deste, no formato que a análise ao vivo usa para comparar (QLAoVivo "anteriores") */
  function anteriores(M, st, j) {
    return historico(st, j.atletaId).filter(function (x) { return x.id !== j.id && mesmaModalidade(x, j) && encerrado(M, x) && x.pontos.length >= 10 && (x.data + x.criadoEm) < (j.data + j.criadoEm); })
      .slice(0, 10).map(function (x) { var r = resumo(M, st, x); return Object.assign({}, r, r.numeros, r.bolas); });
  }
  /* jogos de um atleta (ou de todos), do mais novo para o mais antigo */
  function historico(st, atletaId) {
    return st.jogos.filter(function (j) { return !atletaId || j.atletaId === atletaId; })
      .sort(function (a, b) { return (b.data + b.criadoEm).localeCompare(a.data + a.criadoEm); });
  }
  /* uma linha por jogo para a lista e para a comparação */
  function linhaJogo(M, st, j) {
    var pl = placar(M, j), n = j.pontos.length, g = j.pontos.filter(function (p) { return p.nos; }).length, a = atleta(st, j.atletaId);
    var fim = !!(pl.fim || j.fim);
    return { id: j.id, atleta: a ? a.nome : "Atleta", data: j.data, torneio: j.torneio, resultado: textoSets(pl), n: n, ganhos: g, pct: n ? Math.round(g * 100 / n) : 0,
      fim: fim, venceu: pl.fim ? pl.vencedor === "nos" : null, duracao: fim || j.duracaoMin ? textoDuracao(duracaoSeg(j)) : "", dupla: !!j.cfg.dupla, parceiro: j.cfg.dupla ? txt(j.parceiro, 60) : "" };
  }
  /* medidas lado a lado dos últimos jogos terminados (mais antigo à esquerda) */
  var MEDIDAS = [["pctGanhos", "Pontos ganhos", "%", true], ["pctPrimeiro", "1º saque dentro", "%", true], ["errosNos", "Erros", "", false], ["df", "Duplas faltas", "", false],
    ["pctAdversos", "Ganhos em placar adverso", "%", true], ["pctAte4", "Pontos em até 4 bolas", "%", null]];
  /* simples e dupla não se misturam: dupla = true compara só os jogos de dupla */
  function comparacao(M, st, atletaId, max, dupla) {
    var jogos = historico(st, atletaId).filter(function (j) { return !!j.cfg.dupla === !!dupla && encerrado(M, j) && j.pontos.length >= 10; }).slice(0, max || 6).reverse();
    var rs = jogos.map(function (j) {
      var r = resumo(M, st, j), o = Object.assign({ id: j.id, data: j.data, torneio: j.torneio, resultado: r.resultado }, r, r.numeros, r.bolas);
      /* saque não marcado no jogo: "—", não 0% */
      if (!j.pontos.some(function (p) { return p.sacador === "nos" && p.saque; })) o.pctPrimeiro = null;
      return o;
    });
    return { jogos: rs.map(function (r) { return { id: r.id, data: r.data, torneio: r.torneio, resultado: r.resultado }; }),
      linhas: MEDIDAS.map(function (m) { return { chave: m[0], rotulo: m[1], unidade: m[2], maiorMelhor: m[3], valores: rs.map(function (r) { return typeof r[m[0]] === "number" ? r[m[0]] : null; }) }; }) };
  }

  /* texto para mandar no WhatsApp: só o primeiro nome, placar e números (nunca o adversário nem as anotações) */
  function textoCompartilhar(M, st, j) {
    var r = resumo(M, st, j), pl = placar(M, j), nome = r.atleta, linhas = [];
    var fim = !!(pl.fim || j.fim);
    linhas.push((fim ? (pl.fim ? nome + (pl.vencedor === "nos" ? " venceu" : " perdeu") : "Jogo de " + nome + " encerrado") : "Jogo de " + nome + " em andamento") + (r.torneio ? " · " + r.torneio : ""));
    if (r.resultado) linhas.push("Placar: " + r.resultado);
    if (r.n) linhas.push(r.n + " pontos · " + nome + " ganhou " + r.ganhos + " (" + r.pctGanhos + "%)");
    if (fim && duracaoSeg(j) != null) linhas.push("Tempo de jogo: " + textoDuracao(duracaoSeg(j)));
    var nu = r.numeros || {}, extra = [];
    if (nu.pctPrimeiro) extra.push("1º saque dentro: " + nu.pctPrimeiro + "%");
    if (nu.errosNos != null && r.n) extra.push("erros: " + nu.errosNos);
    if (nu.aces) extra.push("aces: " + nu.aces);
    if (nu.df) extra.push("duplas faltas: " + nu.df);
    if (extra.length) linhas.push(extra.join(" · "));
    linhas.push("Marcado no QuadraLab Scout · quadralab.com.br/scout");
    return linhas.join("\n");
  }

  /* cópia de segurança: um arquivo com atletas e jogos, para guardar ou passar para outro aparelho */
  function exportar(st) {
    return JSON.stringify({ app: "quadralab-scout", versao: VERSAO, exportadoEm: agoraISO(), atletas: st.atletas, jogos: st.jogos });
  }
  /* junta uma cópia ao que já está no aparelho: atleta com o mesmo nome vira o mesmo; jogo repetido fica com a versão mais nova */
  function importar(st, texto) {
    var x;
    try { x = JSON.parse(texto); } catch (e) { return { erro: "Este arquivo não é uma cópia do QuadraLab Scout." }; }
    if (!x || x.app !== "quadralab-scout" || !Array.isArray(x.jogos) || !Array.isArray(x.atletas)) return { erro: "Este arquivo não é uma cópia do QuadraLab Scout." };
    var mapa = {}, novosAtletas = 0, novos = 0, atualizados = 0;
    x.atletas.forEach(function (a) {
      if (!a || typeof a.id !== "string" || !txt(a.nome, 60)) return;
      var antes = st.atletas.length, r = addAtleta(st, a.nome);
      if (r.atleta) { mapa[a.id] = r.atleta.id; if (st.atletas.length > antes) novosAtletas++; juntarNotas(r.atleta, a.notas); }
    });
    x.jogos.forEach(function (j0) {
      var j = jogoLimpo(j0); if (!j || !mapa[j.atletaId]) return;
      j.atletaId = mapa[j.atletaId];
      var ex = jogo(st, j.id);
      if (!ex) { if (st.jogos.length < MAX_JOGOS) { st.jogos.push(j); novos++; } }
      else if (String(j.atualizadoEm) > String(ex.atualizadoEm)) { st.jogos[st.jogos.indexOf(ex)] = j; atualizados++; }
    });
    return { atletas: novosAtletas, novos: novos, atualizados: atualizados };
  }

  /* evento da contagem anônima: só o número do aparelho, o tipo e os pontos (nada de nome, adversário ou torneio) */
  function eventoUso(st, tipo, j) {
    var e = { a: st.aparelho, e: tipo };
    if (tipo === "jogo-encerrado" && j) e.n = Math.min(2000, j.pontos.length);
    return e;
  }

  var api = { VERSAO: VERSAO, CHAVE: CHAVE, CFG_PADRAO: CFG_PADRAO, MEDIDAS: MEDIDAS, vazio: vazio, normalizar: normalizar, atleta: atleta, jogo: jogo, addAtleta: addAtleta, renomearAtleta: renomearAtleta, removerAtleta: removerAtleta,
    sacadorDaDupla: sacadorDaDupla, trocarSacadorDupla: trocarSacadorDupla, numerosDaDupla: numerosDaDupla, nomeParceiro: nomeParceiro, mesmaModalidade: mesmaModalidade, turnoDaDupla: turnoDaDupla,
    novoJogo: novoJogo, removerJogo: removerJogo, tocar: tocar, placar: placar, textoSets: textoSets, encerrado: encerrado, marcarPonto: marcarPonto, desfazer: desfazer, resumo: resumo, anteriores: anteriores,
    NOTAS: NOTAS, notasLimpas: notasLimpas, definirNota: definirNota, formatarNota: formatarNota, notaAnterior: notaAnterior, textoNotas: textoNotas, atletaLimpo: atletaLimpo,
    duracaoSeg: duracaoSeg, duracaoMin: duracaoMin, textoDuracao: textoDuracao, definirDuracao: definirDuracao, encerrar: encerrar, reabrir: reabrir,
    historico: historico, linhaJogo: linhaJogo, comparacao: comparacao, resumoSomado: resumoSomado, textoCompartilhar: textoCompartilhar, exportar: exportar, importar: importar, eventoUso: eventoUso, hojeLocal: hojeLocal, cfgLimpa: cfgLimpa };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else raiz.QLScoutApp = api;
})(typeof window !== "undefined" ? window : this);
