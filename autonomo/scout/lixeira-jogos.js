/* Lixeira de jogos (scout) · Tecnologia QuadraLab.
   Todo jogo com pontos marcados que some do caderno de um jogador (excluído, descartado, apagado por engano ou por outro aparelho)
   vai para a lixeira da academia e pode ser recuperado por 90 dias. Cada jogo apagado fica num documento próprio e o jogador tem um
   índice pequeno (o que mostrar na tela sem baixar os jogos):
     dados/mty:lixeira:v1:{alunoId}:{regId}   → o registro inteiro do jogo (com os pontos)
     dados/mty:lixeira-idx:v1:{alunoId}       → [{ regId, removidoEm, data, adversario, torneio, resultado, pontos }]
   QLLixeiraJogos.removidos(antes, depois) → [{ alunoId, alunoNome, registro }] (função pura: compara duas listas de jogadores)
   QLLixeiraJogos.criar(storage) → { guardar(itens), indice(alunoId), ler(alunoId, regId), tirar(alunoId, regId) } */
(function (raiz, fab) {
  if (typeof module === "object" && module.exports) module.exports = fab();
  else raiz.QLLixeiraJogos = fab();
})(typeof self !== "undefined" ? self : this, function () {
  var REG = "mty:lixeira:v1:", IDX = "mty:lixeira-idx:v1:", DIAS = 90, MAX = 60;
  var ID = /^[A-Za-z0-9_.@-]{1,120}$/;

  function pontosDe(r) { return (r && r.scout && Array.isArray(r.scout.pontos)) ? r.scout.pontos.length : 0; }
  function ehJogo(r) { return r && r.tipo === "jogo" && r.id != null && pontosDe(r) > 0; }
  /* o mesmo jogo continua em outro registro (cópia automática que foi trocada pela versão salva): não é jogo perdido */
  function cobertoPor(r, lista) {
    var p = r.scout.pontos, n = p.length, a = JSON.stringify(p[0]), z = JSON.stringify(p[n - 1]);
    return (lista || []).some(function (g) {
      if (!ehJogo(g) || g.id === r.id || pontosDe(g) < n) return false;
      var q = g.scout.pontos;
      return JSON.stringify(q[0]) === a && JSON.stringify(q[n - 1]) === z && (!r.adversario || !g.adversario || r.adversario === g.adversario);
    });
  }

  function removidos(antes, depois) {
    var agora = {}, saida = [];
    (depois || []).forEach(function (a) { if (a && a.id != null) agora[a.id] = a; });
    (antes || []).forEach(function (a) {
      if (!a || a.id == null) return;
      var d = agora[a.id];
      if (!d) return; /* jogador inteiro removido: decisão à parte, não é jogo perdido */
      var ficam = {};
      (d.registros || []).forEach(function (g) { if (g && g.id != null) ficam[g.id] = true; });
      (a.registros || []).forEach(function (r) {
        if (!ehJogo(r) || ficam[r.id] || cobertoPor(r, d.registros)) return;
        saida.push({ alunoId: String(a.id), alunoNome: a.nome || "", registro: r });
      });
    });
    return saida;
  }

  function lerJSON(v, padrao) { try { var x = JSON.parse(v); return x == null ? padrao : x; } catch (e) { return padrao; } }
  function resumo(r, quando) {
    return { regId: String(r.id), removidoEm: quando, data: r.data || "", adversario: r.adversario || "", torneio: r.torneio || "", resultado: r.resultado || "", pontos: pontosDe(r), interrompida: r.concluida === false };
  }
  function valido(alunoId, regId) { return ID.test(String(alunoId)) && (regId === undefined || ID.test(String(regId))); }

  function criar(storage) {
    function frescos(lista) {
      var lim = Date.now() - DIAS * 86400000;
      return (lista || []).filter(function (x) { return x && x.regId && Date.parse(x.removidoEm || "") >= lim; });
    }
    async function indice(alunoId) {
      if (!storage || !valido(alunoId)) return [];
      var r = await storage.get(IDX + alunoId);
      return frescos(lerJSON(r && r.value, [])).sort(function (a, b) { return String(b.removidoEm).localeCompare(String(a.removidoEm)); });
    }
    async function guardar(itens) {
      if (!storage || !itens || !itens.length) return 0;
      var quando = new Date().toISOString(), porAluno = {}, n = 0;
      itens.forEach(function (it) { if (valido(it.alunoId, it.registro.id)) (porAluno[it.alunoId] = porAluno[it.alunoId] || []).push(it); });
      for (var alunoId in porAluno) {
        var lista = porAluno[alunoId];
        for (var i = 0; i < lista.length; i++) {
          var r = lista[i].registro;
          await storage.set(REG + alunoId + ":" + r.id, JSON.stringify({ alunoId: alunoId, alunoNome: lista[i].alunoNome, removidoEm: quando, registro: r }));
        }
        var atual = await indice(alunoId), ids = {};
        lista.forEach(function (it) { ids[String(it.registro.id)] = true; });
        var novo = lista.map(function (it) { return resumo(it.registro, quando); }).concat(atual.filter(function (x) { return !ids[x.regId]; })).slice(0, MAX);
        await storage.set(IDX + alunoId, JSON.stringify(novo));
        n += lista.length;
      }
      return n;
    }
    async function ler(alunoId, regId) {
      if (!storage || !valido(alunoId, regId)) return null;
      var r = await storage.get(REG + alunoId + ":" + regId);
      var x = lerJSON(r && r.value, null);
      return x && x.registro ? x.registro : null;
    }
    async function tirar(alunoId, regId) {
      if (!storage || !valido(alunoId, regId)) return;
      var atual = await indice(alunoId);
      await storage.set(IDX + alunoId, JSON.stringify(atual.filter(function (x) { return x.regId !== String(regId); })));
      if (storage.delete) await storage.delete(REG + alunoId + ":" + regId);
    }
    return { guardar: guardar, indice: indice, ler: ler, tirar: tirar };
  }

  return { removidos: removidos, criar: criar, REG: REG, IDX: IDX, DIAS: DIAS };
});
