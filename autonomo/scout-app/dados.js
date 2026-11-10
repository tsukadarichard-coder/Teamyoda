/* QuadraLab Scout: dados do app (atletas e jogos no próprio aparelho), sem tela.
   As contas do jogo (placar, números, resumo) vêm do motor do scout (player/scout-motor.js, QLScoutMotor): as mesmas regras e
   os mesmos números do scout do treinador e do responsável. O nome do adversário e as anotações ficam só no aparelho.
   Usado por app.js no navegador e pelos testes no Node (module.exports). */
(function (raiz) {
  "use strict";
  var VERSAO = 1;
  var CHAVE = "qls:v1";
  var MAX_ATLETAS = 60, MAX_JOGOS = 400;
  var CFG_PADRAO = { formato: "3sets", saca: "nos", semVantagem: false, superTiebreakDecisivo: false };
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
    return { formato: f, saca: c.saca === "ele" ? "ele" : "nos", semVantagem: f === "tb7" || f === "tb10" ? false : !!c.semVantagem, superTiebreakDecisivo: f === "3sets" ? !!c.superTiebreakDecisivo : false };
  }
  function jogoLimpo(j) {
    if (!j || typeof j !== "object" || typeof j.id !== "string" || typeof j.atletaId !== "string") return null;
    return {
      id: txt(j.id, 40), atletaId: txt(j.atletaId, 40), data: /^\d{4}-\d{2}-\d{2}$/.test(j.data) ? j.data : hojeLocal(),
      torneio: txt(j.torneio, 80), adversario: txt(j.adversario, 80), cfg: cfgLimpa(j.cfg),
      pontos: Array.isArray(j.pontos) ? j.pontos.filter(function (p) { return p && typeof p === "object" && typeof p.nos === "boolean"; }).slice(0, 2000) : [],
      mental: j.mental && typeof j.mental === "object" ? { antes: j.mental.antes || {}, jogo: j.mental.jogo || {}, depois: j.mental.depois || {} } : { antes: {}, jogo: {}, depois: {} },
      nivelAdversario: txt(j.nivelAdversario, 20), observacaoFinal: txt(j.observacaoFinal, 1200), fim: !!j.fim, usoFim: !!j.usoFim,
      criadoEm: typeof j.criadoEm === "string" ? j.criadoEm : agoraISO(), atualizadoEm: typeof j.atualizadoEm === "string" ? j.atualizadoEm : agoraISO(),
    };
  }
  /* aceita qualquer coisa vinda do armazenamento e devolve um estado válido */
  function normalizar(x) {
    if (!x || typeof x !== "object") return vazio();
    var st = { v: VERSAO, aparelho: /^[a-f0-9]{16,32}$/.test(x.aparelho) ? x.aparelho : aleatorio(24), criadoEm: typeof x.criadoEm === "string" ? x.criadoEm : agoraISO(), atletas: [], jogos: [] };
    (Array.isArray(x.atletas) ? x.atletas : []).forEach(function (a) {
      if (a && typeof a.id === "string" && txt(a.nome, 60) && st.atletas.length < MAX_ATLETAS) st.atletas.push({ id: txt(a.id, 40), nome: txt(a.nome, 60), criadoEm: typeof a.criadoEm === "string" ? a.criadoEm : agoraISO() });
    });
    var ids = {}; st.atletas.forEach(function (a) { ids[a.id] = 1; });
    (Array.isArray(x.jogos) ? x.jogos : []).forEach(function (j) { var l = jogoLimpo(j); if (l && ids[l.atletaId] && st.jogos.length < MAX_JOGOS) st.jogos.push(l); });
    if (x.atual && st.jogos.some(function (j) { return j.id === x.atual && !j.fim; })) st.atual = x.atual;
    return st;
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
    var j = jogoLimpo({ id: novoId("j"), atletaId: o.atletaId, data: hojeLocal(), torneio: o.torneio, adversario: o.adversario, cfg: o.cfg, pontos: [] });
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

  /* marca um ponto: completa placar antes, game e set, como o scout do responsável */
  function marcarPonto(M, j, p) {
    var pl = placar(M, j);
    if (pl.fim || j.fim) return { erro: "A partida já terminou." };
    var q = {}; Object.keys(p || {}).forEach(function (k) { q[k] = p[k]; });
    q.nos = !!q.nos; q.n = j.pontos.length + 1; q.placarAntes = M.rotuloPontos(pl); q.jogo = M.numeroDoGame(pl); q.set = M.numeroDoSet(pl);
    j.pontos.push(q); tocar(j);
    return { ponto: q, fim: placar(M, j).fim };
  }
  function desfazer(j) { if (!j.pontos.length) return false; j.pontos.pop(); j.fim = false; tocar(j); return true; }

  /* resumo no formato da página da família (o mesmo que os gráficos de scout/graficos.js desenham) */
  function resumo(M, st, j) {
    var a = atleta(st, j.atletaId), pl = placar(M, j), rr = M.resume(j.pontos);
    return M.montarResumoPublico({ data: j.data, torneio: j.torneio, resultado: textoSets(pl), concluida: !!(pl.fim || j.fim), observacaoFinal: j.observacaoFinal, nivelAdversario: j.nivelAdversario, mental: j.mental,
      scout: Object.assign({}, rr, { pontos: j.pontos, cfg: j.cfg }) }, { nome: a ? a.nome : "Atleta" });
  }
  /* jogos terminados do mesmo atleta, antes deste, no formato que a análise ao vivo usa para comparar (QLAoVivo "anteriores") */
  function anteriores(M, st, j) {
    return historico(st, j.atletaId).filter(function (x) { return x.id !== j.id && encerrado(M, x) && x.pontos.length >= 10 && (x.data + x.criadoEm) < (j.data + j.criadoEm); })
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
      fim: fim, venceu: pl.fim ? pl.vencedor === "nos" : null };
  }
  /* medidas lado a lado dos últimos jogos terminados (mais antigo à esquerda) */
  var MEDIDAS = [["pctGanhos", "Pontos ganhos", "%", true], ["pctPrimeiro", "1º saque dentro", "%", true], ["errosNos", "Erros", "", false], ["df", "Duplas faltas", "", false],
    ["pctAdversos", "Ganhos em placar adverso", "%", true], ["pctAte4", "Pontos em até 4 bolas", "%", null]];
  function comparacao(M, st, atletaId, max) {
    var jogos = historico(st, atletaId).filter(function (j) { return encerrado(M, j) && j.pontos.length >= 10; }).slice(0, max || 6).reverse();
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
      if (r.atleta) { mapa[a.id] = r.atleta.id; if (st.atletas.length > antes) novosAtletas++; }
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
    novoJogo: novoJogo, removerJogo: removerJogo, tocar: tocar, placar: placar, textoSets: textoSets, encerrado: encerrado, marcarPonto: marcarPonto, desfazer: desfazer, resumo: resumo, anteriores: anteriores,
    historico: historico, linhaJogo: linhaJogo, comparacao: comparacao, textoCompartilhar: textoCompartilhar, exportar: exportar, importar: importar, eventoUso: eventoUso, hojeLocal: hojeLocal, cfgLimpa: cfgLimpa };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else raiz.QLScoutApp = api;
})(typeof window !== "undefined" ? window : this);
