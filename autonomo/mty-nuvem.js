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

/* Projeto Firebase PRÓPRIO deste produto (QuadraLab) — nunca o mesmo da
   Team Yoda. Preencha depois de criar o projeto novo no Firebase Console
   (Configurações do projeto → Seus apps → Config do SDK) e ativar
   Firestore + Authentication (Email/senha) nele. Enquanto estiver
   "COLE_AQUI", o app roda só no aparelho (localStorage), sem nuvem —
   o que é seguro por padrão, mas não sincroniza nada entre dispositivos
   nem libera o link do aluno/relatórios na nuvem. */
const MTY_CONFIG = {
  apiKey: "AIzaSyBEHp7uzFqH1D_9pnHcZFm21ITXP3bpFFo",
  authDomain: "mty-coach.firebaseapp.com",
  projectId: "mty-coach",
  storageBucket: "mty-coach.firebasestorage.app",
  messagingSenderId: "108398981681",
  appId: "1:108398981681:web:1c8b377f3effb96c399b10",
};

/* Número que recebe as fichas pelo WhatsApp — código do país + DDD, só dígitos. */
const MTY_WHATSAPP = "5511941773228";

/* ── métricas de produto (opcional) ──
   Só pra enxergar em que etapa o treinador trava no caminho
   apresentação → cadastro → primeiro jogador → plano salvo → aula
   registrada — nunca manda nome, ficha, avaliação ou observação de
   jogador nenhum, só o nome da etapa (ver MTY.evento() abaixo).

   Pra ativar: crie uma conta grátis em https://posthog.com, crie um
   projeto e cole a "Project API Key" dele aqui (Configurações do
   projeto → chaves de API de projeto). Enquanto estiver "COLE_AQUI",
   MTY.evento() não faz nada — nenhum script de terceiro chega a
   carregar e nenhuma métrica é coletada. */
const POSTHOG_KEY = "COLE_AQUI";
const POSTHOG_HOST = "https://us.i.posthog.com";

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

  /* ── métricas de produto ──
     Carrega o PostHog só se a chave estiver preenchida — sem ela, nada
     é injetado na página. O pacote vem de uma versão exata do CDN (não
     "a mais nova de sempre"): foi exatamente um script de terceiro sem
     versão travada que derrubou a Metodologia MTY em produção uma vez
     (ver commit do fix do Babel) — aqui não se repete isso.
     autocapture/pageview/gravação de sessão ficam desligados de
     propósito: só os eventos que o próprio app dispara, nomeados,
     chegam ao PostHog — nunca o clique em cima do nome de um jogador. */
  let posthogPronto = false;
  if (POSTHOG_KEY !== "COLE_AQUI" && typeof document !== "undefined") {
    try {
      const s = document.createElement("script");
      s.src = "https://unpkg.com/posthog-js@1.438.1/dist/array.js";
      s.crossOrigin = "anonymous";
      s.onload = function () {
        try {
          window.posthog.init(POSTHOG_KEY, {
            api_host: POSTHOG_HOST,
            autocapture: false, capture_pageview: false, capture_pageleave: false,
            disable_session_recording: true,
          });
          posthogPronto = true;
        } catch (e) { posthogPronto = false; }
      };
      document.head.appendChild(s);
    } catch (e) { posthogPronto = false; }
  }
  /* Dispara um evento de ETAPA do funil (ex.: "conta_criada",
     "jogador_criado", "plano_salvo", "aula_registrada") — nunca com
     nome, ficha, avaliação nem observação de jogador. Sem chave
     configurada, ou enquanto o script ainda não carregou, não faz
     nada — nunca trava nem lança erro pro resto do app. */
  function evento(nome) {
    if (!posthogPronto || typeof window.posthog === "undefined") return;
    try { window.posthog.capture(nome); } catch (e) {}
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

  return { ligado: !!db, grave, leia, lista, faixa, apelido, id, organizacao, auth: authApi, evento };
})();
