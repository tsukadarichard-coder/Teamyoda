/* ═══════════════════════════════════════════════════════════════════
   MTY · NUVEM
   Configuração única do ecossistema. Todos os arquivos leem daqui —
   você preenche as credenciais UMA vez, neste arquivo, e não em cada um.

   Sem credenciais preenchidas, tudo continua funcionando no aparelho
   (localStorage). Com elas, os dados passam a viver na nuvem — mas
   separados por academia: cada conta pertence a uma "organização"
   (orgId), atribuída pelo administrador quando cria a conta do
   treinador. Ninguém vê dado de outra academia, mesmo logado.

   Contas não são autoatribuídas — não existe "criar conta" aqui.
   Uma conta só enxerga dados quando o administrador a liga a uma
   organização (função netlify/functions/provisionar-org.js).
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
  let db = null, auth = null;

  if (ligado && typeof firebase !== "undefined") {
    try {
      if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(MTY_CONFIG);
      db = firebase.firestore();
      if (firebase.auth) auth = firebase.auth();
    } catch (e) {
      console.error("MTY · falha ao iniciar o Firebase, seguindo local:", e);
      db = null; auth = null;
    }
  }

  function id(prefixo) {
    return prefixo + "-" + Date.now().toString(36) + "-" +
      Math.random().toString(36).slice(2, 7);
  }

  function apelido(nome) {
    return (nome || "sem-nome").toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  }

  /* ── organização do usuário logado ──
     Vem de uma custom claim (orgId) no token do Firebase Auth, atribuída
     pelo administrador. Sem ela, a conta existe mas não enxerga nuvem —
     só o administrador resolve isso (não é algo que o app conserta sozinho).
     Força um refresh do token uma vez por login, porque claims novas só
     aparecem depois disso — depois fica em cache até o próximo login. */
  let claimsCache = null;
  if (auth) {
    auth.onAuthStateChanged(async function (u) {
      if (!u) { claimsCache = null; return; }
      try {
        const tok = await u.getIdTokenResult(true);
        claimsCache = tok.claims || {};
      } catch (e) {
        claimsCache = null;
      }
    });
  }

  async function organizacao() {
    if (!auth || !auth.currentUser) return null;
    if (claimsCache && claimsCache.orgId) return claimsCache.orgId;
    try {
      const tok = await auth.currentUser.getIdTokenResult();
      claimsCache = tok.claims || {};
      return claimsCache.orgId || null;
    } catch (e) {
      return null;
    }
  }

  /* ── gravar ──
     colecao: "fichas" | "planos" | "ciclos" | qualquer nome do app.
     Devolve o id do documento, e diz se a nuvem foi usada — false
     também quando a conta está logada mas ainda sem organização. */
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
    const org = await organizacao();
    if (!org) return { id: chave, nuvem: false, erro: "conta sem academia vinculada" };

    try {
      await db.collection("orgs").doc(org).collection(colecao).doc(chave)
        .set(registro, { merge: true });
      return { id: chave, nuvem: true };
    } catch (e) {
      console.error("MTY · falha ao gravar na nuvem, ficou local:", e);
      return { id: chave, nuvem: false, erro: String(e.message || e) };
    }
  }

  async function leia(colecao, chave) {
    if (db) {
      const org = await organizacao();
      if (org) {
        try {
          const s = await db.collection("orgs").doc(org).collection(colecao).doc(chave).get();
          if (s.exists) return s.data();
        } catch (e) {
          console.error("MTY · falha ao ler da nuvem:", e);
        }
      }
    }
    try {
      const raw = localStorage.getItem("mty:" + colecao + ":" + chave);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  async function lista(colecao, limite) {
    if (!db) return [];
    const org = await organizacao();
    if (!org) return [];
    try {
      const s = await db.collection("orgs").doc(org).collection(colecao)
        .orderBy("atualizadoEm", "desc").limit(limite || 100).get();
      const saida = [];
      s.forEach(function (d) { saida.push(Object.assign({ _id: d.id }, d.data())); });
      return saida;
    } catch (e) {
      console.error("MTY · falha ao listar:", e);
      return [];
    }
  }

  /* ── faixa de estado, no topo da página ──
     Async de propósito: espera organizacao() resolver de verdade em vez
     de ler o cache de claims direto, que pode ainda não ter chegado
     (a claim carrega um round-trip de rede logo após o login). */
  async function faixa(elId) {
    const el = document.getElementById(elId || "mty-faixa");
    if (!el) return;
    el.style.color = "#fff";
    if (!db) {
      el.textContent = "Modo local — os dados ficam só neste aparelho";
      el.style.background = "#C25A22";
      return;
    }
    if (!auth || !auth.currentUser) {
      el.textContent = "Nuvem configurada — entre com sua conta para sincronizar com a academia";
      el.style.background = "#C25A22";
      return;
    }
    const org = await organizacao();
    if (!org) {
      el.textContent = "Conta sem academia vinculada — fale com o administrador";
      el.style.background = "#8A2E2E";
      return;
    }
    el.textContent = "Conectado — os dados ficam guardados na nuvem da sua academia";
    el.style.background = "#2E4739";
  }

  /* ── autenticação ──
     Só "entrar" e "sair" — não existe autoatribuição de conta. Uma conta
     nova é criada pelo administrador (netlify/functions/provisionar-org.js),
     já com a organização atribuída. */
  const authApi = auth ? {
    entrar: (email, senha) => auth.signInWithEmailAndPassword(email, senha),
    sair: () => auth.signOut(),
    observar: (cb) => auth.onAuthStateChanged(cb),
    usuario: () => auth.currentUser,
    tokenId: (forcar) => auth.currentUser ? auth.currentUser.getIdToken(!!forcar) : Promise.resolve(null),
  } : null;

  return { ligado: !!db, grave, leia, lista, faixa, apelido, id, organizacao, auth: authApi };
})();
