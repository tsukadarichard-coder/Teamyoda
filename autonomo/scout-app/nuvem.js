/* QuadraLab Scout: conta (Firebase do QuadraLab) e sincronização dos jogos com a nuvem (functions scout-app e scout-app-conta).
   O app continua funcionando sem internet: tudo é gravado primeiro no aparelho (dados.js) e enviado quando há conexão.
   Regras da sincronização:
   · jogo: vale o que tem o atualizadoEm mais novo (no aparelho ou na nuvem); jogo apagado em um aparelho some dos outros;
   · atletas: a lista do aparelho manda quando foi mudada aqui desde o último envio; senão vale a da nuvem (mais os criados aqui);
   · link ao vivo: o jogo é salvo na conta e o resumo vai para a página da família (/scout/?l=...), sempre com limpeza no servidor. */
(function (raiz) {
  "use strict";
  var FIREBASE = {
    apiKey: "AIzaSyBEHp7uzFqH1D_9pnHcZFm21ITXP3bpFFo", authDomain: "mty-coach.firebaseapp.com", projectId: "mty-coach",
    storageBucket: "mty-coach.firebasestorage.app", messagingSenderId: "108398981681", appId: "1:108398981681:web:1c8b377f3effb96c399b10",
  };
  var auth = null;

  function iniciar(aoMudar) {
    if (typeof raiz.firebase === "undefined") return false;
    if (!raiz.firebase.apps.length) raiz.firebase.initializeApp(FIREBASE);
    auth = raiz.firebase.auth(); auth.languageCode = "pt";
    auth.onAuthStateChanged(function (u) { aoMudar(u ? { uid: u.uid, email: u.email || "", nome: u.displayName || "" } : null); });
    return true;
  }
  function mensagem(e) {
    var c = (e && e.code) || "";
    return /invalid-credential|wrong-password|user-not-found|invalid-login/.test(c) ? "E-mail ou senha incorretos."
      : /too-many-requests/.test(c) ? "Muitas tentativas. Aguarde alguns minutos e tente de novo."
      : /network/.test(c) ? "Sem conexão. Conecte-se à internet para entrar."
      : (e && e.message) || "Não foi possível continuar agora.";
  }
  async function api(caminho, corpo) {
    var h = { "content-type": "application/json" };
    if (auth && auth.currentUser) h.authorization = "Bearer " + (await auth.currentUser.getIdToken());
    var r;
    try { r = await fetch("/.netlify/functions/" + caminho, { method: corpo ? "POST" : "GET", headers: h, body: corpo ? JSON.stringify(corpo) : undefined, cache: "no-store" }); }
    catch (e) { var x = new Error("Sem conexão. Os jogos continuam salvos no celular."); x.semRede = true; throw x; }
    var c = await r.json().catch(function () { return {}; });
    if (!r.ok) { var er = new Error(c.erro || "Algo deu errado. Tente de novo em instantes."); er.status = r.status; throw er; }
    return c;
  }
  async function entrar(email, senha) { try { await auth.signInWithEmailAndPassword(email, senha); } catch (e) { throw new Error(mensagem(e)); } }
  async function criar(dados) { await api("scout-app-conta", dados); await entrar(dados.email, dados.senha); }
  async function recuperar(email) { try { await auth.sendPasswordResetEmail(email); } catch (e) { if (/network/.test((e && e.code) || "")) throw new Error(mensagem(e)); /* não revela se o e-mail existe */ } }
  function sair() { return auth ? auth.signOut() : Promise.resolve(); }

  /* ── metadados da sincronização, por conta: o que já foi enviado e os links ao vivo ── */
  function chaveMeta(uid) { return "qls:sync:" + uid; }
  function lerMeta(uid) { try { var m = JSON.parse(localStorage.getItem(chaveMeta(uid)) || "null"); if (m && typeof m === "object") return { enviados: m.enviados || {}, atletasSujos: !!m.atletasSujos, aoVivo: m.aoVivo || {}, ultima: m.ultima || null }; } catch (e) { /* segue */ } return { enviados: {}, atletasSujos: false, aoVivo: {}, ultima: null }; }
  function gravarMeta(uid, m) { try { localStorage.setItem(chaveMeta(uid), JSON.stringify(m)); } catch (e) { /* sem espaço */ } }

  /* junta o que veio da nuvem com o aparelho (função pura: testada no Node) */
  function juntar(D, st, nuvem, meta) {
    var mudou = false;
    (nuvem.apagados || []).forEach(function (x) { if (D.jogo(st, x.id)) { D.removerJogo(st, x.id); mudou = true; } delete meta.enviados[x.id]; });
    if (!meta.atletasSujos) {
      var locais = st.atletas.filter(function (a) { return !(nuvem.atletas || []).some(function (b) { return b.id === a.id; }) && st.jogos.some(function (j) { return j.atletaId === a.id; }); });
      var antes = JSON.stringify(st.atletas);
      st.atletas = (nuvem.atletas || []).map(function (a) { return { id: a.id, nome: a.nome, criadoEm: a.criadoEm }; }).concat(locais);
      if (locais.length) meta.atletasSujos = true;
      if (JSON.stringify(st.atletas) !== antes) mudou = true;
    }
    var idx = {}; (nuvem.jogos || []).forEach(function (x) { idx[x.id] = x; });
    var baixar = (nuvem.jogos || []).filter(function (x) { var l = D.jogo(st, x.id); return !l || String(l.atualizadoEm) < String(x.atualizadoEm); }).map(function (x) { return x.id; });
    var enviar = st.jogos.filter(function (j) { var s = idx[j.id]; return !s || String(j.atualizadoEm) > String(s.atualizadoEm); }).map(function (j) { return j.id; });
    return { mudou: mudou, baixar: baixar, enviar: enviar };
  }
  function aplicarBaixados(D, st, jogos) {
    var n = 0;
    (jogos || []).forEach(function (j0) {
      var lista = D.normalizar({ aparelho: st.aparelho, atletas: st.atletas, jogos: [j0] }).jogos, j = lista[0]; if (!j) return;
      var ex = D.jogo(st, j.id);
      if (!ex) { st.jogos.push(j); n++; } else if (String(j.atualizadoEm) > String(ex.atualizadoEm)) { st.jogos[st.jogos.indexOf(ex)] = j; n++; }
    });
    return n;
  }

  var emCurso = null;
  /* sincroniza tudo; devolve { baixados, enviados } ou lança erro (sem rede, sessão vencida...) */
  function sincronizar(D, uid, lerEstado, salvarEstado) {
    if (emCurso) return emCurso;
    emCurso = (async function () {
      var meta = lerMeta(uid), nuvem = await api("scout-app"), st = lerEstado();
      var plano = juntar(D, st, nuvem, meta);
      if (plano.mudou) salvarEstado(st);
      if (meta.atletasSujos) { await api("scout-app", { acao: "atletas", atletas: st.atletas }); meta.atletasSujos = false; }
      var baixados = 0, enviados = 0;
      for (var i = 0; i < plano.baixar.length; i += 40) {
        var r = await api("scout-app", { acao: "baixar", ids: plano.baixar.slice(i, i + 40) });
        st = lerEstado(); baixados += aplicarBaixados(D, st, r.jogos); salvarEstado(st);
      }
      st = lerEstado();
      var lista = plano.enviar.map(function (id) { return D.jogo(st, id); }).filter(Boolean);
      for (var k = 0; k < lista.length; k += 10) {
        var lote = lista.slice(k, k + 10), x = await api("scout-app", { acao: "salvarJogos", jogos: lote });
        lote.forEach(function (j) { meta.enviados[j.id] = j.atualizadoEm; }); enviados += (x.salvos || []).length;
      }
      meta.ultima = new Date().toISOString(); gravarMeta(uid, meta);
      return { baixados: baixados, enviados: enviados, conta: nuvem.conta };
    })();
    return emCurso.then(function (r) { emCurso = null; return r; }, function (e) { emCurso = null; throw e; });
  }
  function marcarAtletasSujos(uid) { var m = lerMeta(uid); m.atletasSujos = true; gravarMeta(uid, m); }

  /* link ao vivo: salva o jogo na conta e manda o resumo; devolve { token, url } */
  async function aoVivo(uid, j, resumo, fim) {
    await api("scout-app", { acao: "salvarJogos", jogos: [j] });
    var r = await api("scout-app", { acao: "aoVivo", jogoId: j.id, resumo: resumo, fim: !!fim });
    var m = lerMeta(uid); m.enviados[j.id] = j.atualizadoEm;
    if (r.token) m.aoVivo[j.id] = { token: r.token, expiraEm: r.expiraEm }; else delete m.aoVivo[j.id];
    gravarMeta(uid, m);
    return { token: r.token, expiraEm: r.expiraEm, url: r.token ? location.origin + "/scout/?l=" + r.token : null };
  }
  async function encerrarAoVivo(uid, jogoId) { await api("scout-app", { acao: "encerrarAoVivo", jogoId: jogoId }); var m = lerMeta(uid); delete m.aoVivo[jogoId]; gravarMeta(uid, m); }
  function linkAoVivo(uid, jogoId) { var x = lerMeta(uid).aoVivo[jogoId]; return x && Date.parse(x.expiraEm) > Date.now() ? { token: x.token, expiraEm: x.expiraEm, url: location.origin + "/scout/?l=" + x.token } : null; }
  async function apagarJogo(jogoId) { await api("scout-app", { acao: "apagarJogo", id: jogoId }); }
  async function perfil(nome, papel) { return (await api("scout-app", { acao: "perfil", nome: nome, papel: papel })).conta; }

  var api_ = { iniciar: iniciar, entrar: entrar, criar: criar, recuperar: recuperar, sair: sair, api: api, sincronizar: sincronizar, juntar: juntar, aplicarBaixados: aplicarBaixados,
    marcarAtletasSujos: marcarAtletasSujos, aoVivo: aoVivo, encerrarAoVivo: encerrarAoVivo, linkAoVivo: linkAoVivo, apagarJogo: apagarJogo, perfil: perfil, lerMeta: lerMeta };
  if (typeof module !== "undefined" && module.exports) module.exports = api_; else raiz.QLScoutNuvem = api_;
})(typeof window !== "undefined" ? window : this);
