/* ═══════════════════════════════════════════════════════════════════
   MTY · NUVEM
   Configuração única do ecossistema. Todos os arquivos leem daqui —
   você preenche as credenciais UMA vez, neste arquivo, e não em cada um.

   Sem credenciais preenchidas, tudo continua funcionando no aparelho
   (localStorage). Com elas, os dados passam a viver num lugar só.
   ═══════════════════════════════════════════════════════════════════ */

const MTY_CONFIG = {
  apiKey: "COLE_AQUI",
  authDomain: "COLE_AQUI",
  projectId: "COLE_AQUI",
  storageBucket: "COLE_AQUI",
  messagingSenderId: "COLE_AQUI",
  appId: "COLE_AQUI",
};

/* Número que recebe as fichas pelo WhatsApp — código do país + DDD, só dígitos. */
const MTY_WHATSAPP = "5511941773228";

/* ─────────────────────────────────────────────────────────────────── */

const MTY = (function () {
  const ligado =
    MTY_CONFIG.apiKey !== "COLE_AQUI" && MTY_CONFIG.projectId !== "COLE_AQUI";
  let db = null;

  if (ligado && typeof firebase !== "undefined") {
    try {
      if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(MTY_CONFIG);
      db = firebase.firestore();
    } catch (e) {
      console.error("MTY · falha ao iniciar o Firebase, seguindo local:", e);
      db = null;
    }
  }

  function id(prefixo) {
    return prefixo + "-" + Date.now().toString(36) + "-" +
      Math.random().toString(36).slice(2, 7);
  }

  function apelido(nome) {
    return (nome || "sem-nome").toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  }

  /* ── gravar ──
     colecao: "fichas" | "planos" | "ciclos"
     Devolve o id do documento, ou null se ficou só no aparelho. */
  async function grave(colecao, dados, docId) {
    const chave = docId || id(colecao.slice(0, 5));
    const registro = Object.assign({}, dados, {
      atualizadoEm: new Date().toISOString(),
    });

    /* cópia local sempre — é a rede de proteção se a nuvem falhar */
    try {
      localStorage.setItem("mty:" + colecao + ":" + chave, JSON.stringify(registro));
    } catch (e) {}

    if (!db) return { id: chave, nuvem: false };

    try {
      await db.collection(colecao).doc(chave).set(registro, { merge: true });
      return { id: chave, nuvem: true };
    } catch (e) {
      console.error("MTY · falha ao gravar na nuvem, ficou local:", e);
      return { id: chave, nuvem: false, erro: String(e.message || e) };
    }
  }

  async function leia(colecao, chave) {
    if (db) {
      try {
        const s = await db.collection(colecao).doc(chave).get();
        if (s.exists) return s.data();
      } catch (e) {
        console.error("MTY · falha ao ler da nuvem:", e);
      }
    }
    try {
      const raw = localStorage.getItem("mty:" + colecao + ":" + chave);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  async function lista(colecao, limite) {
    if (!db) return [];
    try {
      const s = await db.collection(colecao)
        .orderBy("atualizadoEm", "desc").limit(limite || 100).get();
      const saida = [];
      s.forEach(function (d) { saida.push(Object.assign({ _id: d.id }, d.data())); });
      return saida;
    } catch (e) {
      console.error("MTY · falha ao listar:", e);
      return [];
    }
  }

  /* ── faixa de estado, no topo da página ── */
  function faixa(elId) {
    const el = document.getElementById(elId || "mty-faixa");
    if (!el) return;
    if (db) {
      el.textContent = "Conectado — os dados ficam guardados na nuvem da equipe";
      el.style.background = "#2E4739";
    } else {
      el.textContent = "Modo local — os dados ficam só neste aparelho";
      el.style.background = "#C25A22";
    }
    el.style.color = "#fff";
  }

  return { ligado: !!db, grave, leia, lista, faixa, apelido, id };
})();
