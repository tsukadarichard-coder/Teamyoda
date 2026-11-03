/* Roteiros da quadra animada dos exercícios (scout/quadra-exercicio.js) — todos os exercícios de quadra do catálogo MTY.
   Cada roteiro segue a "Montagem" do exercício no catálogo. Coordenadas em metros (x de -4,115 a 4,115; y de -11,885 a 11,885; rede
   em y = 0). O atleta (A) fica embaixo/à esquerda na tela e é destro: o forehand dele fica em x > 0. Quem está do outro lado (T ou P),
   destro, tem o forehand em x < 0. "fim": a bola segue depois do quique (ninguém devolve). "direto": sem quique (voleio, smash).
   Este arquivo é igual em autonomo/scout e mty/scout. */
(function (raiz) {
  var R = {
    /* ── Fundamentos ── */
    FB001: {
      resumo: "Troca na cruzada de forehand, buscando o último metro do fundo.",
      atores: { A: [2.9, -12.6], P: [-2.9, 12.6] },
      alvos: [{ x1: -4.115, y1: 10.885, x2: -0.6, y2: 11.885, rot: "último metro" }, { x1: 0.6, y1: -11.885, x2: 4.115, y2: -10.885 }],
      lances: [
        { de: "A", quique: [-2.5, 11.2], txt: "forehand cruzado profundo, no último metro" },
        { de: "P", quique: [2.5, -11.2], txt: "forehand cruzado de volta, também fundo" },
      ],
      ciclo: true,
    },
    FB002: {
      resumo: "Troca na cruzada de backhand, buscando o último metro do fundo.",
      atores: { A: [-2.9, -12.6], P: [2.9, 12.6] },
      alvos: [{ x1: 0.6, y1: 10.885, x2: 4.115, y2: 11.885, rot: "último metro" }, { x1: -4.115, y1: -11.885, x2: -0.6, y2: -10.885 }],
      lances: [
        { de: "A", quique: [2.5, 11.2], txt: "backhand cruzado profundo, no último metro" },
        { de: "P", quique: [-2.5, -11.2], txt: "backhand cruzado de volta" },
      ],
      ciclo: true,
    },
    FB003: {
      resumo: "Troca na paralela: forehand fundo e plano, sem ângulo.",
      atores: { A: [3.1, -12.6], P: [3.1, 12.6] },
      alvos: [{ x1: 1.6, y1: 8.6, x2: 4.115, y2: 11.885, rot: "paralela funda" }],
      lances: [
        { de: "A", quique: [3.0, 10.6], txt: "forehand paralelo, fundo e plano", apice: 1.9 },
        { de: "P", quique: [3.0, -10.6], txt: "devolve na paralela" },
      ],
      ciclo: true,
    },
    FB005: {
      resumo: "Rally pelo centro com forehand e backhand, voltando ao centro entre os golpes.",
      atores: { A: [0, -12.5], P: [0, 12.5] },
      cones: [[0, -12.3]],
      lances: [
        { de: "P", quique: [1.7, -10.4], txt: "bola no lado do forehand", mover: { A: [1.9, -12.4] } },
        { de: "A", quique: [0.3, 10.6], txt: "forehand fundo pelo centro e volta ao centro", mover: { A: [0, -12.5] } },
        { de: "P", quique: [-1.7, -10.4], txt: "bola no lado do backhand", mover: { A: [-1.9, -12.4] } },
        { de: "A", quique: [-0.3, 10.6], txt: "backhand fundo pelo centro e volta ao centro", mover: { A: [0, -12.5] } },
      ],
      ciclo: true,
    },
    FB007: {
      resumo: "Backhand cruzado buscando o alvo de 1 m × 1 m no canto — meta de 16 acertos.",
      atores: { A: [-2.9, -12.6], P: [2.9, 12.6] },
      alvos: [{ x1: 3.0, y1: 10.85, x2: 4.0, y2: 11.85, rot: "1×1" }],
      lances: [
        { de: "A", quique: [3.5, 11.35], txt: "backhand cruzado no alvo (conta 1 acerto)" },
        { de: "P", quique: [-2.5, -11.0], txt: "devolve cruzado no backhand do atleta" },
      ],
      ciclo: true,
    },
    FB010: {
      resumo: "Troca na cruzada; depois de cada golpe, o atleta toca o cone no centro da linha de base.",
      atores: { A: [2.9, -12.6], P: [-2.9, 12.6] },
      cones: [[0, -11.885]],
      lances: [
        { de: "A", quique: [-2.5, 10.9], txt: "forehand cruzado e corre tocar o cone do centro", mover: { A: [0, -12.2] } },
        { de: "P", quique: [-2.4, -10.8], txt: "bola no backhand do atleta", mover: { A: [-2.9, -12.6], P: [0, 12.4] } },
        { de: "A", quique: [2.5, 10.9], txt: "backhand cruzado e volta a tocar o cone", mover: { A: [0, -12.2], P: [2.9, 12.6] } },
        { de: "P", quique: [2.4, -10.8], txt: "bola no forehand do atleta", mover: { A: [2.9, -12.6], P: [-2.9, 12.6] } },
      ],
      ciclo: true,
    },
    FB013: {
      resumo: "Atleta na linha de saque; o treinador alimenta para voleio de forehand de bloqueio, com direção definida antes.",
      atores: { A: [1.0, -6.6], T: [-0.4, 9.6] },
      cesto: [0.6, 9.6],
      alvos: [{ x1: -4.115, y1: 7.0, x2: -1.6, y2: 11.885, rot: "direção" }],
      lances: [
        { de: "T", direto: true, txt: "alimenta no forehand, sem quicar (split step do atleta)", apice: 1.8, hK: 1.2, mover: { A: [1.0, -6.4] } },
        { de: "A", quique: [-2.8, 9.2], txt: "voleio de bloqueio, punho firme, sem swing", h0: 1.2, apice: 1.4, v: 11, fim: true },
      ],
      ciclo: true,
    },
    FB015: {
      resumo: "Lobs centrais do treinador para o smash: de lado, braço livre apontando, contato bem acima da cabeça.",
      atores: { A: [0.2, -6.0], T: [0, 9.8] },
      cesto: [0.8, 9.8],
      alvos: [{ x1: -4.115, y1: 6.4, x2: -1.4, y2: 11.885, rot: "alvo" }],
      lances: [
        { de: "T", direto: true, txt: "lob central", apice: 7.5, hK: 2.8, v: 9 },
        { de: "A", tipo: "smash", quique: [-2.6, 8.6], txt: "smash com o braço estendido, na direção do alvo", fim: true },
      ],
      ciclo: true,
    },
    FB016: {
      resumo: "Treinador na rede manda bolas rápidas; o atleta responde com lob defensivo alto e fundo, no backhand do adversário.",
      atores: { A: [0, -12.5], T: [-0.6, 2.4] },
      alvos: [{ x1: 0.6, y1: 10.885, x2: 4.115, y2: 11.885, rot: "fundo no BH" }],
      lances: [
        { de: "T", quique: [1.6, -9.6], txt: "bola rápida da rede", v: 15, apice: 1.4, mover: { A: [1.9, -12.5] } },
        { de: "A", quique: [3.0, 11.2], txt: "lob defensivo: 2 m acima do oponente, no último metro", apice: 7.2, v: 11, fim: true, mover: { A: [0, -12.5] } },
      ],
      ciclo: true,
    },
    FB019: {
      resumo: "Treinador na rede alimenta bolas na borda; o atleta passa cruzado, baixo sobre a rede e com ângulo.",
      atores: { A: [0.5, -12.4], T: [0.4, 2.2] },
      alvos: [{ x1: -4.115, y1: 5.4, x2: -2.4, y2: 10.0, rot: "cruzada" }],
      lances: [
        { de: "T", quique: [3.4, -9.6], txt: "bola na borda, no forehand", mover: { A: [3.7, -12.0] } },
        { de: "A", quique: [-3.3, 7.6], txt: "passada cruzada baixa, com ângulo", apice: 1.3, v: 15, fim: true, mover: { A: [0.5, -12.4] } },
      ],
      ciclo: true,
    },
    FB021: {
      resumo: "Bola curta: o atleta avança, faz o approach de forehand na paralela e sobe à rede com split step.",
      atores: { A: [1.0, -12.4], T: [-0.5, 9.8] },
      cesto: [0.4, 9.8],
      alvos: [{ x1: 1.6, y1: 8.6, x2: 4.115, y2: 11.885, rot: "paralela" }],
      lances: [
        { de: "T", quique: [1.8, -6.6], txt: "bola curta no forehand", apice: 1.6, mover: { A: [2.1, -7.3] } },
        { de: "A", quique: [3.1, 10.5], txt: "approach paralelo, fundo e baixo; sobe e faz split step", apice: 1.5, fim: true, mover: { A: [1.0, -3.6] } },
      ],
      ciclo: true,
    },
    FB023: {
      resumo: "Treinador saca dos dois lados; o atleta devolve com bloqueio — swing curto, contato firme e profundidade.",
      atores: { A: [2.4, -12.2], T: [-0.8, 12.3] },
      alvos: [{ x1: -2.0, y1: 8.9, x2: 2.0, y2: 11.885, rot: "fundo" }],
      lances: [
        { de: "T", tipo: "saque", quique: [1.6, -5.8], txt: "saque no lado de iguais, velocidade moderada", v: 17 },
        { de: "A", quique: [-0.4, 10.6], txt: "devolução de bloqueio, funda", apice: 1.9, fim: true, mover: { A: [-2.4, -12.2], T: [0.8, 12.3] } },
        { de: "T", tipo: "saque", quique: [-1.6, -5.8], txt: "saque no lado da vantagem", v: 17 },
        { de: "A", quique: [0.4, 10.6], txt: "devolução de bloqueio, funda", apice: 1.9, fim: true, mover: { A: [2.4, -12.2], T: [-0.8, 12.3] } },
      ],
      ciclo: true,
    },
    FB025: {
      resumo: "Saque flat com alvo no T, dos dois lados.",
      atores: { A: [0.8, -12.3] },
      alvos: [{ x1: -1.0, y1: 5.3, x2: 0, y2: 6.4, rot: "T" }, { x1: 0, y1: 5.3, x2: 1.0, y2: 6.4, rot: "T" }],
      lances: [
        { de: "A", tipo: "saque", quique: [-0.4, 5.9], txt: "saque flat no T (lado de iguais)", fim: true, mover: { A: [-0.8, -12.3] }, pausa: 0.6 },
        { de: "A", tipo: "saque", quique: [0.4, 5.9], txt: "saque flat no T (lado da vantagem)", fim: true, mover: { A: [0.8, -12.3] }, pausa: 0.6 },
      ],
      ciclo: true,
    },

    /* ── Padrões táticos ── */
    DT001: {
      resumo: "Armar com o forehand cruzado profundo e finalizar com o forehand invertido.",
      atores: { A: [2.8, -12.5], T: [-0.3, 9.8] },
      cesto: [0.6, 9.8],
      alvos: [{ x1: -4.115, y1: 9.9, x2: -1.4, y2: 11.885, rot: "construção" }, { x1: 1.6, y1: 6.6, x2: 4.115, y2: 11.885, rot: "finalização" }],
      lances: [
        { de: "T", quique: [2.4, -9.8], txt: "bola no forehand" },
        { de: "A", quique: [-2.8, 11.0], txt: "forehand cruzado profundo — constrói, sem atacar", fim: true, mover: { A: [0.6, -12.2] } },
        { de: "T", quique: [-1.0, -9.4], txt: "bola no meio, puxada para o backhand", mover: { A: [-1.9, -11.8] } },
        { de: "A", quique: [3.0, 9.6], txt: "forehand invertido (finalização)", v: 17, apice: 1.7, fim: true, mover: { A: [2.8, -12.5] } },
      ],
      ciclo: true,
    },
    DT002: {
      resumo: "Três bolas: forehand cruzado profundo, forehand angulado curto abrindo a quadra e forehand paralelo para finalizar.",
      atores: { A: [2.8, -12.5], T: [-0.3, 9.8] },
      cesto: [0.6, 9.8],
      alvos: [{ x1: -4.115, y1: 9.9, x2: -1.4, y2: 11.885, rot: "1" }, { x1: -4.115, y1: 3.4, x2: -2.4, y2: 6.4, rot: "2" }, { x1: 1.6, y1: 7.0, x2: 4.115, y2: 11.885, rot: "3" }],
      lances: [
        { de: "T", quique: [2.4, -9.8], txt: "1ª bola" },
        { de: "A", quique: [-2.8, 11.0], txt: "forehand cruzado profundo", fim: true, mover: { A: [1.2, -12.0] } },
        { de: "T", quique: [2.6, -9.0], txt: "2ª bola", mover: { A: [2.9, -11.6] } },
        { de: "A", quique: [-3.6, 4.8], txt: "forehand angulado curto, abrindo a quadra", apice: 1.6, fim: true, mover: { A: [1.4, -11.0] } },
        { de: "T", quique: [2.0, -7.8], txt: "3ª bola", mover: { A: [2.4, -10.2] } },
        { de: "A", quique: [3.0, 9.8], txt: "forehand paralelo — finalização", v: 17, apice: 1.7, fim: true, mover: { A: [2.8, -12.5] } },
      ],
      ciclo: true,
    },
    DT003: {
      resumo: "Armar com o backhand cruzado profundo e finalizar com o forehand cruzado.",
      atores: { A: [-2.8, -12.5], T: [0.3, 9.8] },
      cesto: [-0.6, 9.8],
      alvos: [{ x1: 1.4, y1: 9.9, x2: 4.115, y2: 11.885, rot: "construção" }, { x1: -4.115, y1: 6.4, x2: -2.0, y2: 10.5, rot: "finalização" }],
      lances: [
        { de: "T", quique: [-2.4, -9.8], txt: "bola no backhand" },
        { de: "A", quique: [2.8, 11.0], txt: "backhand cruzado profundo — constrói", fim: true, mover: { A: [0.4, -12.2] } },
        { de: "T", quique: [2.2, -9.4], txt: "bola no forehand", mover: { A: [2.7, -12.2] } },
        { de: "A", quique: [-3.2, 8.6], txt: "forehand cruzado — finalização", v: 17, apice: 1.7, fim: true, mover: { A: [-2.8, -12.5] } },
      ],
      ciclo: true,
    },
    DT005: {
      resumo: "Saque no lado de iguais e a 1ª bola no espaço aberto — a direção da 1ª bola é decidida antes do saque.",
      atores: { A: [0.8, -12.3], P: [-2.9, 12.2] },
      alvos: [{ x1: 1.4, y1: 7.0, x2: 4.115, y2: 11.885, rot: "1ª bola" }],
      lances: [
        { de: "A", tipo: "saque", quique: [-3.6, 5.6], txt: "saque aberto (direção da 1ª bola já decidida)", mover: { P: [-4.6, 10.6], A: [0.8, -11.6] } },
        { de: "P", quique: [1.4, -9.6], txt: "devolução", mover: { A: [1.9, -11.9], P: [-1.6, 11.6] } },
        { de: "A", quique: [3.0, 9.6], txt: "1ª bola no espaço aberto", v: 15, apice: 1.8, fim: true },
      ],
      ciclo: true,
    },
    DT007: {
      resumo: "Treinador saca; depois da devolução, ele lança uma bola no lado oposto para o golpe cruzado.",
      atores: { A: [2.6, -12.2], T: [-0.8, 12.3] },
      cesto: [0.4, 12.6],
      lances: [
        { de: "T", tipo: "saque", quique: [2.2, -5.8], txt: "saque", v: 17 },
        { de: "A", quique: [-2.4, 10.4], txt: "devolução", apice: 2.0, fim: true, mover: { A: [0.6, -12.2] } },
        { de: "T", quique: [-2.4, -9.6], txt: "bola lançada no lado oposto", mover: { A: [-2.8, -12.3] } },
        { de: "A", quique: [2.8, 10.8], txt: "golpe cruzado", fim: true, mover: { A: [2.6, -12.2] } },
      ],
      ciclo: true,
    },
    DT016: {
      resumo: "Forehand cruzado com ângulo para abrir a quadra, depois approach na paralela e subida à rede.",
      atores: { A: [2.8, -12.4], T: [-0.3, 9.8] },
      cesto: [0.6, 9.8],
      alvos: [{ x1: -4.115, y1: 4.6, x2: -2.6, y2: 8.0, rot: "ângulo" }, { x1: 1.6, y1: 8.4, x2: 4.115, y2: 11.885, rot: "approach" }],
      lances: [
        { de: "T", quique: [2.4, -9.8], txt: "bola no forehand" },
        { de: "A", quique: [-3.7, 6.4], txt: "forehand cruzado angulado — abre a quadra", apice: 1.7, fim: true, mover: { A: [1.0, -12.0] } },
        { de: "T", quique: [0.9, -6.0], txt: "bola curta", apice: 1.5, mover: { A: [1.4, -6.9] } },
        { de: "A", quique: [3.0, 10.4], txt: "approach na paralela e sobe à rede", apice: 1.5, fim: true, mover: { A: [1.2, -3.4] } },
      ],
      ciclo: true,
    },
    DT021: {
      resumo: "Duas bolas fundas para defender e uma mais curta ou lenta: reconhecer a oportunidade e virar para o ataque.",
      atores: { A: [0, -12.6], T: [-0.3, 9.8] },
      cesto: [0.6, 9.8],
      alvos: [{ x1: -2.2, y1: 9.9, x2: 2.2, y2: 11.885, rot: "defesa funda" }],
      lances: [
        { de: "T", quique: [2.2, -11.2], txt: "bola funda (defesa)", v: 12, mover: { A: [2.6, -13.3] } },
        { de: "A", quique: [-0.4, 11.0], txt: "defesa alta e funda, ganhando tempo", apice: 4.6, fim: true, mover: { A: [0, -12.8] } },
        { de: "T", quique: [-2.2, -11.2], txt: "outra bola funda", v: 12, mover: { A: [-2.6, -13.3] } },
        { de: "A", quique: [0.4, 11.0], txt: "defesa alta e funda", apice: 4.6, fim: true, mover: { A: [0, -12.6] } },
        { de: "T", quique: [0.9, -7.4], txt: "bola curta e lenta — a oportunidade", v: 8, apice: 1.8, mover: { A: [1.3, -8.4] } },
        { de: "A", quique: [-3.2, 8.8], txt: "reconhece e ataca", v: 18, apice: 1.5, fim: true, mover: { A: [0.4, -10.6] } },
      ],
      ciclo: true,
    },
  };

  /* ── Catálogo inteiro: atalhos ──
     C: onde quica a bola do atleta (lado de cima). B: onde quica a bola que vem para o atleta (lado de baixo).
     Quem está em cima e é destro tem o forehand em x < 0: "cruzFH" é o forehand cruzado do atleta (do forehand dele ao forehand do outro). */
  var C = {
    cruzFH: [-2.8, 10.9], cruzBH: [2.8, 10.9], parFH: [3.0, 10.4], parBH: [-3.0, 10.4], centro: [0, 10.6], alto: [0, 10.9],
    io: [2.9, 10.2], ii: [-3.0, 10.2], angFH: [-3.7, 5.4], angBH: [3.7, 5.4], dropFH: [-1.6, 1.5], dropBH: [1.6, 1.5],
    lobFH: [-2.4, 10.9], lobBH: [2.4, 10.9], vCruzFH: [-3.2, 7.6], vParFH: [3.2, 7.8], vCruzBH: [3.2, 7.6], vParBH: [-3.2, 7.8],
    vCurtoFH: [-3.6, 3.4], vCurtoBH: [3.6, 3.4], smash: [-2.4, 7.4],
    sTdc: [-0.4, 5.9], sAbdc: [-3.6, 5.6], sCorpodc: [-1.9, 5.9], sTac: [0.4, 5.9], sAbac: [3.6, 5.6], sCorpoac: [1.9, 5.9],
  };
  var B = {
    fh: [2.3, -9.8], bh: [-2.3, -9.8], centro: [0.2, -9.9], fhFunda: [2.4, -11.2], bhFunda: [-2.4, -11.2], centroFunda: [0.2, -11.2],
    fhAberta: [3.7, -9.2], bhAberta: [-3.7, -9.2], fhCurta: [1.8, -6.0], bhCurta: [-1.8, -6.0], centroCurta: [0.2, -5.8],
    fhMeia: [2.0, -8.0], bhMeia: [-2.0, -8.0], centroMeia: [0.2, -8.0], contorno: [-1.0, -9.6], contornoMeia: [-0.8, -8.0],
    dcAberto: [3.6, -5.6], dcT: [0.4, -5.9], dcCorpo: [1.9, -5.9], acAberto: [-3.6, -5.6], acT: [-0.4, -5.9], acCorpo: [-1.9, -5.9],
  };
  var VOL = { vfh: 1, vbh: 1, vcorpo: 1, lob: 1 };
  function p(tab, v) { if (typeof v !== "string") return v.slice(); if (!tab[v]) throw new Error("ponto desconhecido: " + v); return tab[v].slice(); }
  function cl(v) { return Math.max(-6.3, Math.min(6.3, v)); }
  /* onde o atleta (embaixo) ou quem está em cima fica para bater a bola que quicou em q */
  function bx(q, contorno) { return [cl(q[0] + (contorno ? -0.9 : q[0] >= -0.3 ? 0.45 : -0.45)), q[1] < -7.5 ? Math.max(-13.6, q[1] - 2.3) : q[1] - 1.1]; }
  function cm(q) { return [cl(q[0] + (q[0] <= 0.3 ? -0.45 : 0.45)), q[1] > 7.5 ? Math.min(13.6, q[1] + 2.3) : q[1] + 1.1]; }
  function z(x1, y1, x2, y2, rot) { return { x1: x1, y1: y1, x2: x2, y2: y2, rot: rot }; }
  function L(de, q, txt, x) { var l = { de: de, txt: txt }; if (q != null) l.quique = p(de === "A" || de === "D" ? C : B, q); for (var k in x || {}) l[k] = x[k]; return l; }
  function S(de, q, txt, x) { var l = L(de, q, txt, x); l.tipo = "saque"; return l; }
  function M(txt, pos, x) { var l = { de: "A", semBola: true, txt: txt, mover: { A: pos } }; for (var k in x || {}) l[k] = x[k]; return l; }
  /* bola que vai sem quicar até quem recebe (voleio, lob para o smash) */
  function V(de, txt, x) { var l = { de: de, direto: true, txt: txt, apice: 1.6, hK: 1.2, v: 12 }; for (var k in x || {}) l[k] = x[k]; return l; }
  function rot(o, ls) {
    var d = { resumo: o.r, atores: o.at, lances: ls, ciclo: o.ciclo !== false };
    ["alvos", "cones", "cesto", "duplas"].forEach(function (k) { if (o[k]) d[k] = o[k]; });
    return d;
  }
  /* treinador alimentando: cada bola é [onde quica a bola dele, onde quica a do atleta, texto da alimentação, texto do golpe, extras]
     extras: pos (onde o atleta bate), dep (para onde volta; false = fica), contorno, vf/af (velocidade e altura da alimentação),
     v/ap (do golpe), mT (o treinador anda ao alimentar), tT (o treinador anda durante o golpe), antes ([texto, posição]: deslocamento sem bola antes) */
  function treino(o) {
    var A0 = o.A || [0.3, -12.4], T0 = o.T || [-0.3, 9.8], base = o.base || A0, cur = A0.slice(), ls = [];
    o.bolas.forEach(function (b) {
      var f = b[0], x = b[4] || {}, lf, pos;
      if (x.antes) { ls.push(M(x.antes[0], x.antes[1])); cur = x.antes[1].slice(); }
      if (VOL[f]) {
        pos = x.pos || (f === "vfh" ? [cur[0] + 0.7, cur[1] + 0.2] : f === "vbh" ? [cur[0] - 0.7, cur[1] + 0.2] : f === "lob" ? [cur[0], cur[1] - 1.6] : cur.slice());
        lf = f === "lob" ? { de: "T", direto: true, txt: b[2], apice: 7.5, hK: 2.8, v: 9 } : V("T", b[2], { apice: x.af || 1.8, v: x.vf || 10 });
      } else {
        var q = p(B, f); pos = x.pos || bx(q, x.contorno);
        lf = { de: "T", quique: q, txt: b[2] }; if (x.vf) lf.v = x.vf; if (x.af) lf.apice = x.af;
      }
      lf.mover = { A: pos }; if (x.mT) lf.mover.T = x.mT; cur = pos;
      ls.push(lf);
      var la = { de: "A", quique: p(C, b[1]), txt: b[3], fim: true, mover: {} };
      if (f === "lob") la.tipo = "smash"; else if (VOL[f]) { la.h0 = 1.2; la.apice = 1.5; la.v = 12; }
      if (x.v) la.v = x.v; if (x.ap) la.apice = x.ap;
      var dep = x.dep === undefined ? base : x.dep;
      if (dep) { la.mover.A = dep; cur = dep.slice(); }
      if (x.tT) la.mover.T = x.tT;
      if (x.pausa != null) la.pausa = x.pausa;
      ls.push(la);
    });
    var d = { resumo: o.r, atores: { A: A0, T: T0 }, lances: ls, ciclo: true };
    if (o.cesto !== false) d.cesto = o.cesto || [T0[0] + 0.9, T0[1]];
    ["alvos", "cones", "duplas"].forEach(function (k) { if (o[k]) d[k] = o[k]; });
    return d;
  }
  /* quem recebe a bola anda até onde vai bater (se o roteiro não disse) */
  function auto(d) {
    var pos = {}, k;
    for (k in d.atores) pos[k] = d.atores[k].slice();
    d.lances.forEach(function (l, i) {
      if (!l.semBola && l.quique && !l.direto && !l.fim) {
        var prox = d.lances[i + 1] || (d.ciclo ? d.lances[0] : null), r = l.para !== undefined ? l.para : prox && prox.de !== l.de ? prox.de : null;
        if (r && pos[r] && !(l.mover && l.mover[r])) {
          var q = l.quique, cima = q[1] > 0;
          l.mover = Object.assign({}, l.mover || {});
          l.mover[r] = l.tipo === "saque" ? [cl(q[0] * 1.25 + (cima ? -0.3 : 0.3)), cima ? 11.9 : -11.9] : cima ? cm(q) : bx(q);
        }
      }
      for (k in (l.mover || {})) pos[k] = l.mover[k];
    });
    return d;
  }
  /* corrida: simula o golpe do outro lado e recebe a bola na corrida */
  function corrida(fh, dest, txt, r) {
    var q = fh ? "fhAberta" : "bhAberta";
    return rot({ r: r, at: { A: [0.3, -12.4], T: [-0.3, 9.8] }, cesto: [0.6, 9.8] }, [
      M(fh ? "simula o golpe de backhand" : "simula o golpe de forehand", [fh ? -2.4 : 2.6, -12.3]),
      L("T", q, fh ? "bola no forehand, do outro lado" : "bola no backhand, do outro lado", { mover: { A: bx(p(B, q)) } }),
      L("A", dest, txt, { fim: true, mover: { A: [0.3, -12.4] } }),
    ]);
  }
  /* spider: cinco bolas (centro da base, cantos do fundo e posições de rede), buscando uma de cada vez e voltando ao centro */
  function spider(r) {
    var c = [0, -11.3];
    return rot({ r: r, at: { A: c }, cones: [[0, -11.7], [3.9, -11.6], [-3.9, -11.6], [3.2, -1.4], [-3.2, -1.4]] }, [
      M("busca a bola do canto do forehand", [3.7, -11.6]), M("volta ao centro", c),
      M("busca a bola da rede, lado do forehand", [3.0, -1.6]), M("volta ao centro", c),
      M("busca a bola da rede, lado do backhand", [-3.0, -1.6]), M("volta ao centro", c),
      M("busca a bola do canto do backhand", [-3.7, -11.6]), M("volta ao centro (e para o cronômetro)", c),
    ]);
  }
  function sv(lado) { return lado === "ac" ? { A: [-0.8, -12.3], O: [3.0, 12.2] } : { A: [0.8, -12.3], O: [-3.0, 12.2] }; }
  function dev(lado) { return lado === "ac" ? { A: [-2.6, -12.2], T: [0.8, 12.3] } : { A: [2.6, -12.2], T: [-0.8, 12.3] }; }
  var Ab = [0.3, -12.4], Arede = [0.3, -3.6];

  var N = {
    /* ── Fundamentos ── */
    FB004: rot({ r: "Troca na paralela de backhand: os quadris rodam por inteiro na direção da paralela.", at: { A: [-3.1, -12.6], P: [-3.1, 12.6] }, alvos: [z(-4.115, 8.6, -1.6, 11.885, "paralela funda")] }, [
      L("A", "parBH", "backhand paralelo, fundo", { apice: 1.9 }), L("P", [-3.0, -10.6], "devolve na paralela")]),
    FB008: rot({ r: "Forehand cruzado alternando trajetória alta (topspin) e baixa (plana e rápida).", at: { A: [2.9, -12.6], P: [-2.9, 12.6] } }, [
      L("A", "cruzFH", "forehand alto, com topspin e parábola", { apice: 3.8, v: 11 }), L("P", [2.5, -11.0], "devolve cruzado"),
      L("A", "cruzFH", "forehand baixo: plano e rápido", { apice: 1.4, v: 17 }), L("P", [2.5, -11.0], "devolve cruzado")]),
    FB009: rot({ r: "Troca de backhand slice na cruzada: baixo sobre a rede, desliza no piso e vai fundo.", at: { A: [-2.9, -12.6], P: [2.9, 12.6] } }, [
      L("A", "cruzBH", "backhand slice: até 1 m acima da rede, bola que desliza", { apice: 1.4, v: 10 }), L("P", [-2.5, -11.0], "slice de volta, cruzado", { apice: 1.4, v: 10 })]),
    FB011: treino({ r: "Bolas largas no forehand forçam a base aberta: quadris e ombros giram, o peso passa do pé de trás para o da frente.", A: [0.6, -12.4], bolas: [
      ["fhAberta", "cruzFH", "bola larga no forehand", "forehand de base aberta, cruzado"], ["fh", "cruzFH", "outra bola no forehand", "base aberta de novo, rotação completa"]] }),
    FB012: treino({ r: "Bolas centrais no backhand para a base fechada: o pé da frente cruza e o ombro gira por completo.", bolas: [
      [[-1.2, -9.8], "cruzBH", "bola central, para o backhand", "backhand de base fechada, cruzado"], [[-1.4, -10.2], "parBH", "outra bola central", "backhand de base fechada, paralelo"]] }),
    FB014: treino({ r: "Atleta na linha de saque; o treinador alimenta para o voleio de backhand de bloqueio, com direção definida antes.", A: [-0.4, -6.6], T: [0.4, 9.6],
      alvos: [z(1.6, 7.0, 4.115, 11.885, "direção")], bolas: [["vbh", [2.8, 9.2], "alimenta no backhand, sem quicar (split step do atleta)", "voleio de backhand: braço estendido, punho firme, raquete um pouco aberta"]] }),
    FB017: treino({ r: "Drop shot de forehand com a mesma preparação do golpe normal; alvo no primeiro metro depois da rede.", A: [0.6, -12.0],
      alvos: [z(-4.115, 0.2, 0, 2.2, "1º metro")], bolas: [["fhMeia", "dropFH", "bola de profundidade média", "drop shot de forehand: prepara igual e segura a raquete no contato", { ap: 1.5, v: 7 }]] }),
    FB018: treino({ r: "Drop shot de backhand: a raquete acompanha a bola em vez de atravessá-la; alvo curto e cruzado.", A: [-0.6, -12.0],
      alvos: [z(0, 0.2, 4.115, 2.2, "curto cruzado")], bolas: [["bhMeia", "dropBH", "bola de profundidade média", "drop shot de backhand, curto e cruzado", { ap: 1.5, v: 7 }]] }),
    FB020: treino({ r: "Treinador na rede; o atleta passa na paralela, baixo pelo lado dele e fundo, batendo cedo.", T: [-0.4, 2.4], cesto: [0.6, 1.6],
      alvos: [z(2.4, 6.4, 4.115, 11.885, "paralela"), z(-4.115, 6.4, -2.4, 11.885, "paralela")], bolas: [
        ["fh", "parFH", "bola do treinador na rede", "passada de forehand na paralela", { ap: 1.4, v: 16 }], ["bh", "parBH", "bola no backhand", "passada de backhand na paralela", { ap: 1.4, v: 16 }]] }),
    FB022: treino({ r: "Bola curta no backhand: approach cruzado e fundo, subida à rede e split step antes do voleio.", A: [0, -12.4], T: [0.3, 9.8], bolas: [
      ["bhCurta", [2.8, 10.0], "bola curta no backhand", "approach de backhand cruzado, fundo; sobe e faz o split step", { ap: 1.5, dep: [-0.6, -3.8] }],
      ["vfh", "vCruzFH", "passada do treinador", "voleio para fechar"]] }),
    FB026: rot({ r: "Saque flat com alvo no canto externo, dos dois lados.", at: { A: [0.8, -12.3] }, alvos: [z(-4.115, 4.6, -3.0, 6.4, "aberto"), z(3.0, 4.6, 4.115, 6.4, "aberto")] }, [
      S("A", "sAbdc", "saque flat aberto (lado de iguais)", { fim: true, mover: { A: [-0.8, -12.3] }, pausa: 0.6 }),
      S("A", "sAbac", "saque flat aberto (lado da vantagem)", { fim: true, mover: { A: [0.8, -12.3] }, pausa: 0.6 })]),
    FB027: rot({ r: "Saque kick no lado da vantagem: escovada de baixo para cima, a bola sobe alto no backhand do adversário.", at: { A: [-0.8, -12.3] }, alvos: [z(2.4, 4.4, 4.115, 6.4, "backhand")] }, [
      S("A", [3.2, 5.4], "saque kick: lançamento atrás da cabeça, contato às 11h, quica alto", { fim: true, v: 15, apice: 3.4, pausa: 0.8 })]),
    FB028: rot({ r: "Saque slice dos dois lados: escovada lateral, bola baixa que abre a quadra.", at: { A: [0.8, -12.3] }, alvos: [z(-4.115, 4.4, -3.0, 6.4, "abre"), z(0, 4.6, 1.2, 6.4, "corpo")] }, [
      S("A", [-3.7, 5.2], "saque slice aberto no lado de iguais: tira o adversário da quadra", { fim: true, v: 18, mover: { A: [-0.8, -12.3] }, pausa: 0.6 }),
      S("A", [0.6, 5.8], "saque slice no lado da vantagem, entrando no corpo", { fim: true, v: 18, mover: { A: [0.8, -12.3] }, pausa: 0.6 })]),

    /* ── Padrões táticos ── */
    DT004: treino({ r: "Constrói com o backhand cruzado profundo e finaliza de forehand: invertido ou inside in.", A: [-2.8, -12.5], T: [0.3, 9.8],
      alvos: [z(1.4, 9.9, 4.115, 11.885, "construção")], bolas: [
        ["bh", "cruzBH", "bola no backhand", "backhand cruzado profundo — constrói", { dep: [0.2, -12.3] }],
        ["contorno", "io", "bola no meio", "forehand invertido (inside out)", { contorno: true, dep: [0.2, -12.3] }],
        ["contorno", "ii", "bola no meio de novo (o treinador pode sinalizar a direção)", "forehand inside in — finalização", { contorno: true, v: 17, ap: 1.7, dep: [-2.8, -12.5] }]] }),
    DT006: rot({ r: "Saque aberto no lado da vantagem (no backhand do adversário) e a 1ª bola no espaço aberto.", at: sv("ac"), alvos: [z(-4.115, 7.0, -1.4, 11.885, "1ª bola")] }, [
      S("A", "sAbac", "saque aberto no backhand (direção da 1ª bola já decidida)", { mover: { O: [4.6, 10.6], A: [-0.6, -11.6] } }),
      L("O", [1.4, -9.6], "devolução", { mover: { A: bx([1.4, -9.6]), O: [1.6, 11.6] } }),
      L("A", [-3.0, 9.6], "1ª bola no espaço aberto", { v: 15, apice: 1.8, fim: true })]),
    DT008: treino({ r: "Comando do forehand em 3 direções seguidas: cruzada, paralela e inside out.", A: [2.6, -12.4], bolas: [
      ["fh", "cruzFH", "bola no forehand", "forehand cruzado", { dep: [1.6, -12.3] }], ["fh", "parFH", "bola no forehand", "forehand paralelo", { dep: [0.6, -12.3] }],
      ["contorno", "io", "bola no lado do backhand", "contorna: forehand inside out", { contorno: true, dep: [2.6, -12.4] }]] }),
    DT009: treino({ r: "Bolas no lado do backhand: o atleta decide entre o forehand inside out (cruzado) e o inside in (paralelo).", bolas: [
      ["contorno", "io", "bola no lado do backhand", "decide: forehand inside out", { contorno: true }], ["contorno", "ii", "outra bola no lado do backhand", "ou forehand inside in", { contorno: true }]] }),
    DT010: rot({ r: "Pontos só com golpes cruzados — bola na paralela é ponto perdido.", at: { A: [2.9, -12.6], O: [-2.9, 12.6] }, alvos: [z(-4.115, 6.4, -0.6, 11.885, "cruzada"), z(0.6, -11.885, 4.115, -6.4, "")] }, [
      L("A", "cruzFH", "forehand cruzado"), L("O", [2.5, -11.0], "cruzado de volta"), L("A", [-2.0, 9.6], "cruzado de novo, mudando a altura", { apice: 3.0 }), L("O", [2.6, -10.4], "cruzado")]),
    DT011: rot({ r: "Jogo construído pelo forehand: o atleta corre para usar o forehand até nas bolas de backhand.", at: { A: Ab, O: [0, 12.4] } }, [
      L("O", [-1.2, -9.8], "bola no backhand", { mover: { A: [-2.1, -12.0] } }), L("A", "io", "contorna e bate de forehand (inside out)"),
      L("O", [2.4, -10.2], "bola no forehand"), L("A", "cruzFH", "forehand cruzado")]),
    DT012: rot({ r: "Jogo construído pelo backhand: o atleta usa o backhand sempre que possível.", at: { A: Ab, O: [0, 12.4] } }, [
      L("O", [0.9, -9.8], "bola no meio, do lado do forehand", { mover: { A: [1.8, -12.1] } }), L("A", [-2.8, 10.4], "contorna e joga de backhand"),
      L("O", [-2.4, -10.2], "bola no backhand"), L("A", "cruzBH", "backhand cruzado")]),
    DT013: rot({ r: "Rally com o centro do adversário proibido: só bolas nos cantos contam.", at: { A: [2.6, -12.5], O: [0, 12.5] }, alvos: [z(-1.4, 6.4, 1.4, 11.885, "proibido")] }, [
      L("A", "cruzFH", "forehand no canto"), L("O", [-2.4, -10.6], "bola no backhand"), L("A", "parBH", "backhand no outro canto"), L("O", [2.4, -10.6], "bola no forehand")]),
    DT014: rot({ r: "Rally em que bola antes da linha de saque do adversário é ponto negativo: profundidade em todos os golpes.", at: { A: [1.2, -12.5], O: [-1.2, 12.5] }, alvos: [z(-4.115, 0.3, 4.115, 6.4, "curta = negativo")] }, [
      L("A", [-1.6, 10.8], "funda, passa da linha de saque"), L("O", [1.4, -10.8], "devolve fundo"), L("A", [1.8, 11.0], "funda de novo"), L("O", [-1.6, -10.9], "funda")]),
    DT015: treino({ r: "Três bolas de construção neutra e só na 4ª o atleta tenta o winner.", bolas: [
      ["fh", "centro", "1ª bola de rally", "construção, sem arriscar"], ["bh", "centro", "2ª bola", "construção"], ["fh", "cruzFH", "3ª bola", "construção, empurrando o adversário"],
      ["fhMeia", "parFH", "4ª bola", "agora sim: winner", { v: 18, ap: 1.5 }]] }),
    DT017: rot({ r: "Devolução chip-and-charge: backhand slice baixo e subida imediata; fecha com o voleio.", at: dev("ac") }, [
      S("T", [-2.0, -5.8], "saque", { v: 17 }), L("A", [2.4, 10.4], "chip: backhand slice baixo sobre a rede, já avançando", { apice: 1.4, v: 10, mover: { A: [-0.6, -6.6] } }),
      V("T", "passada", { v: 13, mover: { A: [0.4, -4.0] } }), L("A", "vCruzFH", "split step e voleio para fechar", { h0: 1.2, apice: 1.5, fim: true })]),
    DT020: treino({ r: "O backhand profundo abre a quadra e o forehand inside in finaliza.", A: [-2.8, -12.5], T: [0.3, 9.8], bolas: [
      ["bh", "cruzBH", "bola no backhand", "backhand cruzado profundo — abre", { dep: [0.2, -12.3] }],
      ["contorno", "ii", "2ª bola no meio", "forehand inside in — finaliza", { contorno: true, v: 17, ap: 1.7, dep: [-2.8, -12.5] }]] }),
    DT023: rot({ r: "Serve-volley: saca, sobe direto, split step antes do voleio e fecha em 1 ou 2 voleios.", at: sv("dc") }, [
      S("A", "sAbdc", "saque aberto e já avança à rede", { mover: { A: [0.6, -6.8] } }), V("O", "devolução", { hK: 0.8, mover: { A: [0.4, -5.6] } }),
      L("A", [2.6, 9.6], "split step e 1º voleio, fundo", { h0: 0.8, apice: 1.5, v: 11, mover: { A: [0.4, -3.2] } }),
      V("O", "passada", { v: 13, mover: { A: [1.0, -3.0] } }), L("A", "vCurtoFH", "2º voleio fecha o ponto", { h0: 1.2, apice: 1.3, fim: true })]),
    DT024: rot({ r: "Segundo saque fraco (mais lento e curto): reconhecer e atacar a devolução.", at: dev("dc") }, [
      S("T", [1.2, -5.4], "segundo saque: mais lento e curto", { v: 12, apice: 2.8, mover: { A: [1.6, -9.0] } }),
      L("A", [-3.0, 10.0], "entra e ataca a devolução", { v: 17, apice: 1.6, fim: true, mover: { A: [2.6, -12.2] } })]),
    DT025: treino({ r: "Treinador na rede: se ele fica, passada; se recua, lob — e o atleta se reposiciona.", T: [-0.4, 2.4], cesto: [0.6, 1.6], bolas: [
      ["fh", "parFH", "o treinador fica na rede", "passada na paralela", { ap: 1.4, v: 16, mT: [-0.4, 2.4] }],
      ["bh", "lobBH", "o treinador recua um passo", "lob alto e fundo; depois avança e se posiciona", { mT: [-0.4, 4.4], ap: 7, v: 10, dep: [0.3, -9.4] }]] }),
    DT026: treino({ r: "Drop shot e sprint à rede; o treinador devolve como o adversário e o atleta cobre.", A: [0.3, -11.6], bolas: [
      ["fhMeia", "dropFH", "bola de profundidade média", "drop shot e sprint à rede", { ap: 1.5, v: 7, dep: [0.4, -3.4], tT: [-1.4, 3.0] }],
      ["vfh", [3.0, 6.4], "resposta do adversário", "cobre e fecha com o voleio", { mT: [-1.4, 3.0], tT: [-0.3, 9.8] }]] }),
    DT027: rot({ r: "Pontuação por zona: fundo vale +1, faixa do meio 0, perto da rede −1.", at: { A: [0.6, -12.5], P: [-0.6, 12.5] },
      alvos: [z(-4.115, 0.3, 4.115, 4.0, "−1"), z(-4.115, 4.0, 4.115, 8.0, "0"), z(-4.115, 8.0, 4.115, 11.885, "+1")] }, [
      L("A", [-2.0, 10.8], "funda: +1"), L("P", [2.0, -10.6], "devolve"), L("A", [1.6, 6.8], "no meio: 0"), L("P", [-1.8, -10.4], "devolve"), L("A", [-1.0, 3.0], "curta: −1", { fim: true })]),
    DT028: rot({ r: "Saque e mais 3 bolas com intenção definida; winner só a partir da 3ª.", at: sv("dc") }, [
      S("A", "sTdc", "saque no T (intenção definida)", { mover: { A: [0.3, -12.0] } }), L("O", [-1.0, -10.4], "devolução"),
      L("A", "cruzBH", "1º golpe: constrói"), L("O", [2.0, -10.2], "devolve"), L("A", "cruzFH", "2º golpe: abre a quadra"),
      L("O", [0.6, -8.2], "bola mais curta"), L("A", [3.0, 9.6], "3º golpe: agora pode buscar o winner", { v: 18, apice: 1.6, fim: true })]),
    DT029: treino({ r: "Três zonas: defensiva (atrás da base), construção e finalização (dentro); o golpe depende da zona.", A: [0.3, -11.0],
      alvos: [z(-4.115, -11.885, 4.115, -9.4, "construção"), z(-4.115, -9.4, 4.115, -6.4, "finalização")], bolas: [
        ["fhFunda", "alto", "bola funda: zona defensiva", "devolve alta e funda", { vf: 13, ap: 4.6, v: 11 }],
        ["fh", "cruzFH", "bola na zona de construção", "cruzada funda"], ["fhCurta", "parFH", "bola na zona de finalização", "ataca", { v: 18, ap: 1.5 }]] }),

    /* ── Desenvolvimento e controle ── */
    DC008: rot({ r: "Saques por posição: T e aberto no lado de iguais, T e aberto no lado da vantagem.", at: { A: [0.8, -12.3] },
      alvos: [z(-1.0, 4.9, 0, 6.4, "T"), z(-4.115, 4.6, -3.0, 6.4, "aberto"), z(0, 4.9, 1.0, 6.4, "T"), z(3.0, 4.6, 4.115, 6.4, "aberto")] }, [
      S("A", "sTdc", "saque no T (iguais)", { fim: true, pausa: 0.5 }), S("A", "sAbdc", "saque aberto (iguais)", { fim: true, mover: { A: [-0.8, -12.3] }, pausa: 0.5 }),
      S("A", "sTac", "saque no T (vantagem)", { fim: true, pausa: 0.5 }), S("A", "sAbac", "saque aberto (vantagem)", { fim: true, mover: { A: [0.8, -12.3] }, pausa: 0.5 })]),
    DC011: rot({ r: "Rally de forehand alternando topspin (trajetória alta) e plano (trajetória baixa), sem errar.", at: { A: [2.9, -12.6], P: [-2.9, 12.6] } }, [
      L("A", "cruzFH", "forehand com topspin, alto", { apice: 3.8, v: 11 }), L("P", [2.5, -11.0], "devolve"),
      L("A", "cruzFH", "forehand plano, baixo", { apice: 1.4, v: 16 }), L("P", [2.5, -11.0], "devolve")]),
    DC013: rot({ r: "Ciclo de 6 bolas: 2 forehands cruzados, 2 backhands cruzados e 2 trocas livres.", at: { A: [2.9, -12.6], P: [-2.9, 12.6] } }, [
      L("A", "cruzFH", "forehand cruzado (1)"), L("P", [2.5, -11.0], "devolve no forehand"), L("A", "cruzFH", "forehand cruzado (2)"),
      L("P", [-2.5, -11.0], "muda para o backhand"), L("A", "cruzBH", "backhand cruzado (1)"), L("P", [-2.5, -11.0], "devolve no backhand"),
      L("A", "cruzBH", "backhand cruzado (2)"), L("P", [0.4, -10.6], "troca livre"), L("A", [-0.4, 10.6], "troca livre"), L("P", [2.5, -11.0], "volta ao forehand")]),
    DC014: treino({ r: "Treinador alterna uma bola para voleio e uma para golpe de base, sem parar.", A: [0.3, -11.8], bolas: [
      ["vfh", "vCruzFH", "bola para voleio: o atleta entra", "voleio", { pos: [0.9, -5.2] }], ["fh", "cruzFH", "bola para golpe de base: volta", "forehand de base"]] }),
    DC016: treino({ r: "Golpes de controle extremos alternados: drop shot, lob, drop shot.", A: [0.3, -12.0], bolas: [
      ["fhMeia", "dropFH", "bola média", "drop shot", { ap: 1.5, v: 7 }], ["bh", "lobBH", "bola no backhand", "lob alto e fundo", { ap: 7, v: 10 }],
      ["fhMeia", "dropFH", "bola média", "drop shot de novo", { ap: 1.5, v: 7 }]] }),
    DC017: treino({ r: "Treinador na rede: quando avança, lob; quando recua, passada.", T: [-0.4, 3.0], cesto: [0.6, 2.2], bolas: [
      ["fh", "lobFH", "o treinador avança", "lob por cima", { mT: [-0.4, 1.6], ap: 7, v: 10 }], ["bh", "parBH", "o treinador recua", "passada na paralela", { mT: [-0.4, 4.4], ap: 1.4, v: 16 }]] }),
    DC018: treino({ r: "O treinador sinaliza um dos 4 cantos antes de alimentar; forehand no canto indicado.", A: [2.4, -12.4],
      alvos: [z(-4.115, 9.9, -2.4, 11.885, "1"), z(2.4, 9.9, 4.115, 11.885, "2"), z(-4.115, 3.6, -2.4, 6.4, "3"), z(2.4, 3.6, 4.115, 6.4, "4")], bolas: [
        ["fh", [-3.2, 10.9], "sinal: canto 1", "forehand cruzado fundo"], ["fh", [3.2, 10.9], "sinal: canto 2", "forehand paralelo fundo"],
        ["fhMeia", [-3.4, 5.0], "sinal: canto 3", "forehand cruzado curto", { ap: 1.6 }], ["fhMeia", [3.4, 5.0], "sinal: canto 4", "forehand paralelo curto", { ap: 1.6 }]] }),
    DC019: treino({ r: "Mesma estrutura com o backhand: o treinador sinaliza o canto antes de alimentar.", A: [-2.4, -12.4], T: [0.3, 9.8],
      alvos: [z(2.4, 9.9, 4.115, 11.885, "1"), z(-4.115, 9.9, -2.4, 11.885, "2"), z(2.4, 3.6, 4.115, 6.4, "3"), z(-4.115, 3.6, -2.4, 6.4, "4")], bolas: [
        ["bh", [3.2, 10.9], "sinal: canto 1", "backhand cruzado fundo"], ["bh", [-3.2, 10.9], "sinal: canto 2", "backhand paralelo fundo"],
        ["bhMeia", [3.4, 5.0], "sinal: canto 3", "backhand cruzado curto", { ap: 1.6 }], ["bhMeia", [-3.4, 5.0], "sinal: canto 4", "backhand paralelo curto", { ap: 1.6 }]] }),

    /* ── Movimentação ── */
    MV001: treino({ r: "Movimentação em X: 2 bolas fundas (defesa) e 2 curtas (ataque), voltando sempre ao centro.", A: [0.3, -10.8],
      cones: [[2.9, -13.0], [-2.9, -13.0], [2.4, -7.6], [-2.4, -7.6], [0.3, -10.8]], bolas: [
        ["fhFunda", "alto", "bola funda no forehand", "recua e defende alto", { ap: 4.6, v: 11 }], ["bhCurta", "cruzBH", "bola curta no backhand", "entra na diagonal e ataca", { v: 16 }],
        ["bhFunda", "alto", "bola funda no backhand", "recua e defende alto", { ap: 4.6, v: 11 }], ["fhCurta", "cruzFH", "bola curta no forehand", "entra e ataca", { v: 16 }]] }),
    MV002: treino({ r: "V ofensivo: avança em diagonal passando por trás do cone, ataca e recupera na diagonal oposta.", A: [0.3, -12.2], cones: [[1.1, -8.4], [-1.1, -8.4]], bolas: [
      ["fhCurta", "cruzFH", "bola curta no forehand", "entra por trás do cone e ataca", { v: 16 }], ["bhCurta", "cruzBH", "bola curta no backhand", "entra pelo outro lado e ataca", { v: 16 }]] }),
    MV003: treino({ r: "V defensivo: recua passando pela frente do cone, defende alto e fundo e recupera em diagonal.", A: [0.3, -11.2], cones: [[1.6, -12.4], [-1.6, -12.4]], bolas: [
      ["fhFunda", "alto", "bola funda no forehand", "recua pela frente do cone e defende alto", { ap: 4.8, v: 11, vf: 13 }],
      ["bhFunda", "alto", "bola funda no backhand", "recua e defende alto e fundo", { ap: 4.8, v: 11, vf: 13 }]] }),
    MV004: spider("Spider drill: parte do centro, busca cada uma das 5 bolas e volta. Cronometrar."),
    MV005: rot({ r: "Skipping lateral pelos 4 cones e forehand na saída, com a raquete já preparada.", at: { A: [-2.6, -11.4], T: [-0.3, 9.8] }, cesto: [0.6, 9.8],
      cones: [[-2.0, -11.4], [-1.2, -11.4], [-0.4, -11.4], [0.4, -11.4]] }, [
      M("skipping lateral pelos cones, preparando a raquete", [1.0, -11.6]), L("T", "fh", "bola no forehand na saída dos cones", { mover: { A: bx(B.fh) } }),
      L("A", "cruzFH", "forehand cruzado", { fim: true, mover: { A: [-2.6, -11.4] } })]),
    MV006: rot({ r: "Skipping lateral pelos cones (deslocados para o lado do backhand) e backhand na saída.", at: { A: [2.6, -11.4], T: [0.3, 9.8] }, cesto: [-0.6, 9.8],
      cones: [[2.0, -11.4], [1.2, -11.4], [0.4, -11.4], [-0.4, -11.4]] }, [
      M("skipping lateral pelos cones, preparando a raquete", [-1.0, -11.6]), L("T", "bh", "bola no backhand na saída dos cones", { mover: { A: bx(B.bh) } }),
      L("A", "cruzBH", "backhand cruzado", { fim: true, mover: { A: [2.6, -11.4] } })]),
    MV007: rot({ r: "Zig zag entre 4 cones: entra de frente, sai de costas e termina com um golpe.", at: { A: [-2.2, -12.0], T: [-0.3, 9.8] }, cesto: [0.6, 9.8],
      cones: [[-1.6, -9.6], [-0.4, -11.6], [0.8, -9.6], [2.0, -11.6]] }, [
      M("entra de frente", [-1.0, -9.2]), M("sai de costas", [0.2, -12.0]), M("entra de frente", [1.4, -9.2]), M("sai de costas", [2.6, -12.0]),
      L("T", "fh", "bola no forehand", { mover: { A: bx(B.fh) } }), L("A", "cruzFH", "forehand cruzado", { fim: true, mover: { A: [-2.2, -12.0] } })]),
    MV008: rot({ r: "Rally cruzado em que os dois sempre entram ou saem para cada golpe — nunca parados.", at: { A: [2.9, -12.4], P: [-2.9, 12.4] } }, [
      L("P", [2.5, -9.4], "bola mais curta: entra", { mover: { A: [2.9, -11.0] } }), L("A", "cruzFH", "forehand cruzado", { mover: { P: [-3.0, 13.4] } }),
      L("P", [2.6, -11.4], "bola funda: sai", { mover: { A: [3.0, -13.6] } }), L("A", [-2.4, 9.6], "forehand cruzado mais curto", { mover: { P: [-2.8, 11.2] } })]),
    MV009: rot({ r: "2x1: o atleta bate 2 cruzadas e 1 paralela; o parceiro só cruza. Depois trocam os papéis.", at: { A: [2.9, -12.4], P: [-2.9, 12.4] } }, [
      L("A", "cruzFH", "cruzada 1"), L("P", [2.5, -11.0], "cruzada"), L("A", "cruzFH", "cruzada 2"), L("P", [2.5, -11.0], "cruzada"),
      L("A", "parFH", "paralela"), L("P", [-2.5, -11.0], "cruzada (agora no backhand)"), L("A", "cruzBH", "cruzada 1 de backhand"), L("P", [-2.5, -11.0], "cruzada"),
      L("A", "cruzBH", "cruzada 2"), L("P", [-2.5, -11.0], "cruzada"), L("A", "parBH", "paralela de backhand"), L("P", [2.5, -11.0], "cruzada, de volta ao começo")]),
    MV010: rot({ r: "1x1: o atleta alterna 1 cruzada e 1 paralela; o parceiro só cruza. Ritmo mais alto.", at: { A: [2.9, -12.4], P: [-2.9, 12.4] } }, [
      L("A", "cruzFH", "cruzada"), L("P", [2.5, -11.0], "cruzada"), L("A", "parFH", "paralela"), L("P", [-2.5, -11.0], "cruzada"),
      L("A", "cruzBH", "cruzada"), L("P", [-2.5, -11.0], "cruzada"), L("A", "parBH", "paralela"), L("P", [2.5, -11.0], "cruzada")]),
    MV011: rot({ r: "2x2: o atleta manda 2 bolas para cada lado; o parceiro só joga no centro.", at: { A: Ab, P: [0, 12.5] } }, [
      L("A", [-2.8, 10.8], "lado do forehand do parceiro (1)"), L("P", [0.2, -10.4], "centro"), L("A", [-2.8, 10.8], "lado do forehand (2)"), L("P", [0.2, -10.4], "centro"),
      L("A", [2.8, 10.8], "lado do backhand do parceiro (1)"), L("P", [0.2, -10.4], "centro"), L("A", [2.8, 10.8], "lado do backhand (2)"), L("P", [0.2, -10.4], "centro")]),
    MV012: corrida(true, "cruzFH", "forehand na corrida, cruzado: fundo, plano, sem ângulo demais", "Simula o backhand e recebe o forehand na corrida; bola cruzada e funda."),
    MV013: corrida(false, "cruzBH", "backhand na corrida, cruzado e fundo", "Simula o forehand e recebe o backhand na corrida; bola cruzada e funda."),
    MV014: corrida(true, "parFH", "forehand na corrida, na paralela: contato mais cedo", "Simula o backhand e recebe o forehand na corrida; bola na paralela."),
    MV015: corrida(false, "parBH", "backhand na corrida, na paralela", "Simula o forehand e recebe o backhand na corrida; bola na paralela."),
    MV016: rot({ r: "Figura 8 em volta de dois cones: forehand no cone da esquerda, backhand no da direita.", at: { A: [0, -12.6], T: [-0.3, 9.8] }, cesto: [0.6, 9.8], cones: [[-1.4, -11.4], [1.4, -11.4]] }, [
      M("contorna o cone da esquerda", [-2.2, -12.2]), L("T", [-1.0, -9.6], "bola no cone da esquerda", { mover: { A: [-1.9, -11.9] } }),
      L("A", "io", "forehand", { fim: true }), M("contorna o cone da direita", [2.2, -12.2]), L("T", [1.0, -9.6], "bola no cone da direita", { mover: { A: [1.9, -11.9] } }),
      L("A", [-2.6, 10.4], "backhand", { fim: true, mover: { A: [0, -12.6] } })]),
    MV017: rot({ r: "Escadinha lateral em velocidade máxima, desaceleração controlada e forehand.", at: { A: [-3.0, -10.7], T: [-0.3, 9.8] }, cesto: [0.6, 9.8], cones: [[-2.6, -10.7], [0.2, -10.7]] }, [
      M("escadinha lateral, o mais rápido possível", [0.6, -10.9]), L("T", "fh", "bola no forehand", { mover: { A: bx(B.fh) } }),
      L("A", "cruzFH", "desacelera e bate o forehand", { fim: true, mover: { A: [-3.0, -10.7] } })]),
    MV018: rot({ r: "Escadinha lateral para o lado do backhand e backhand no final.", at: { A: [3.0, -10.7], T: [0.3, 9.8] }, cesto: [-0.6, 9.8], cones: [[2.6, -10.7], [-0.2, -10.7]] }, [
      M("escadinha lateral, o mais rápido possível", [-0.6, -10.9]), L("T", "bh", "bola no backhand", { mover: { A: bx(B.bh) } }),
      L("A", "cruzBH", "desacelera e bate o backhand", { fim: true, mover: { A: [3.0, -10.7] } })]),
    MV019: treino({ r: "Duas bolas fundas (defesa) e uma curta (transição): reconhecer a mudança e acelerar.", A: [0, -12.6], bolas: [
      ["fhFunda", [-0.4, 11.0], "bola funda (defesa)", "defesa alta e funda", { vf: 12, ap: 4.6, dep: [0, -12.8] }], ["bhFunda", [0.4, 11.0], "outra bola funda", "defesa alta e funda", { vf: 12, ap: 4.6, dep: [0, -12.6] }],
      ["centroCurta", "cruzFH", "bola curta (transição)", "reconhece e acelera", { vf: 8, af: 1.8, v: 18, ap: 1.5, dep: [0, -12.6] }]] }),
    MV020: rot({ r: "Triângulo de cones: o treinador sinaliza a posição, o atleta corre e bate o golpe daquela posição.", at: { A: [0, -11.8], T: [-0.3, 9.8] }, cesto: [0.6, 9.8],
      cones: [[0, -11.8], [2.4, -6.8], [-2.4, -6.8]] }, [
      M("sinal: cone do forehand", [2.4, -6.8]), L("T", [2.0, -5.2], "bola na chegada", { mover: { A: [2.5, -6.4] } }), L("A", "parFH", "ataque", { fim: true, v: 16 }),
      M("sinal: cone do backhand", [-2.4, -6.8]), L("T", [-2.0, -5.2], "bola na chegada", { mover: { A: [-2.5, -6.4] } }), L("A", "cruzBH", "ataque", { fim: true, v: 16 }),
      M("sinal: cone da base", [0, -11.8]), L("T", "centro", "bola funda", { mover: { A: bx(B.centro) } }), L("A", "centro", "bola neutra, funda", { fim: true, mover: { A: [0, -11.8] } })]),
    MV021: treino({ r: "Split step no instante exato do contato do treinador, variando a posição.", A: [0.3, -12.2], bolas: [
      ["fh", "cruzFH", "o treinador bate: split step no contato", "forehand"], ["bh", "cruzBH", "split step de novo", "backhand"], ["centroMeia", "centro", "split step", "forehand"]] }),
    MV022: treino({ r: "Bolas alternando os dois lados extremos: recuperar o máximo possível entre os golpes.", bolas: [
      ["fhAberta", "cruzFH", "bola no extremo do forehand", "forehand e recupera", { vf: 11 }], ["bhAberta", "cruzBH", "bola no extremo do backhand", "backhand e recupera", { vf: 11 }]] }),
    MV023: treino({ r: "Bola curta na diagonal: avança, forehand approach fundo e sobe à rede.", A: [-0.4, -12.2], bolas: [
      ["fhCurta", "parFH", "bola curta no forehand", "avança na diagonal: approach fundo e sobe", { ap: 1.5, dep: [0.8, -3.6] }], ["vbh", "vCruzBH", "passada", "split step e voleio"]] }),
    MV024: treino({ r: "Mesma estrutura com o backhand: avanço diagonal, approach e subida.", A: [0.4, -12.2], T: [0.3, 9.8], bolas: [
      ["bhCurta", "parBH", "bola curta no backhand", "avança na diagonal: approach de backhand e sobe", { ap: 1.5, dep: [-0.6, -3.6] }], ["vfh", "vCruzFH", "passada", "split step e voleio"]] }),
    MV025: treino({ r: "Seis bolas em ordem imprevisível — 2 cruzadas, 2 paralelas, 1 curta e 1 lob — e o atleta cobre todas.", bolas: [
      [[2.6, -10.2], "cruzFH", "cruzada", "forehand"], [[-2.6, -10.6], "centro", "paralela", "backhand"], ["centroCurta", "parFH", "curta", "entra e ataca", { v: 16 }],
      [[-2.4, -10.2], "cruzBH", "cruzada", "backhand"], [[-0.8, -11.4], "alto", "lob", "defende o lob", { af: 6.5, ap: 4.4 }], [[2.6, -10.6], "centro", "paralela", "forehand"]] }),

    /* ── Padrões de bola (desenvolvimento) ── */
    PDB001: treino({ r: "Jogador à direita: forehand alternando cruzada e paralela, plano, com peso para a frente.", A: [2.8, -12.5], bolas: [
      ["fh", "cruzFH", "bola no forehand", "forehand cruzado, plano", { ap: 1.7, v: 15 }], ["fh", "parFH", "bola no forehand", "forehand paralelo, plano", { ap: 1.7, v: 15 }]] }),
    PDB002: treino({ r: "Jogador à esquerda: backhand alternando cruzada e paralela, plano.", A: [-2.8, -12.5], T: [0.3, 9.8], bolas: [
      ["bh", "cruzBH", "bola no backhand", "backhand cruzado, plano", { ap: 1.7, v: 15 }], ["bh", "parBH", "bola no backhand", "backhand paralelo, plano", { ap: 1.7, v: 15 }]] }),
    PDB003: treino({ r: "No centro, de forehand, alternando os dois cantos e voltando ao cone central.", cones: [[0.3, -12.0]], bolas: [
      [[0.6, -9.8], [-2.8, 10.6], "bola no centro", "forehand para um canto", { ap: 1.7, v: 15 }], [[0.6, -9.8], [2.9, 10.4], "bola no centro", "forehand para o outro canto", { ap: 1.7, v: 15 }]] }),
    PDB004: corrida(true, "cruzFH", "forehand na corrida, cruzado: plano e profundo", "Simula o backhand e recebe o forehand na corrida; saída cruzada, plana e funda."),
    PDB005: corrida(false, "cruzBH", "backhand na corrida, cruzado: plano e profundo", "Simula o forehand e recebe o backhand na corrida; saída cruzada."),
    PDB006: corrida(true, "parFH", "forehand na corrida, na paralela (contato mais cedo)", "Simula o backhand e recebe o forehand na corrida; saída na paralela."),
    PDB007: corrida(false, "parBH", "backhand na corrida, na paralela (quadris rodam por completo)", "Simula o forehand e recebe o backhand na corrida; saída na paralela."),
    PDB008: rot({ r: "Forehand cruzado na corrida, recupera e muda para o forehand paralelo.", at: { A: Ab, T: [-0.3, 9.8] }, cesto: [0.6, 9.8] }, [
      M("simula o backhand", [-2.4, -12.3]), L("T", "fhAberta", "bola no forehand, do outro lado", { mover: { A: bx(B.fhAberta) } }),
      L("A", "cruzFH", "forehand cruzado na corrida", { fim: true, mover: { A: [0.6, -12.2] } }), L("T", "fh", "mais uma bola no forehand", { mover: { A: bx(B.fh) } }),
      L("A", "parFH", "forehand paralelo — muda a direção", { fim: true, mover: { A: Ab } })]),
    PDB009: rot({ r: "Backhand cruzado na corrida, recupera e finaliza com o forehand inside in.", at: { A: Ab, T: [0.3, 9.8] }, cesto: [-0.6, 9.8] }, [
      M("simula o forehand", [2.6, -12.3]), L("T", "bhAberta", "bola no backhand, do outro lado", { mover: { A: bx(B.bhAberta) } }),
      L("A", "cruzBH", "backhand cruzado na corrida", { fim: true, mover: { A: [0.2, -12.2] } }), L("T", "contorno", "bola no meio", { mover: { A: bx(B.contorno, true) } }),
      L("A", "ii", "forehand inside in — finaliza", { fim: true, v: 17, apice: 1.7, mover: { A: Ab } })]),
    PDB010: treino({ r: "Forehand perto do centro abre pela cruzada; a bola central seguinte vai de inside out. As duas planas.", bolas: [
      [[0.6, -9.8], "cruzFH", "bola perto do centro", "forehand cruzado — abre", { ap: 1.7 }], ["contorno", "io", "bola central", "forehand inside out", { contorno: true, ap: 1.7 }]] }),
    PDB011: treino({ r: "Forehand cruzado profundo para deslocar e, na bola mais central, a mudança de direção.", A: [2.6, -12.4], bolas: [
      ["fh", "cruzFH", "bola no forehand", "forehand cruzado profundo — desloca", { dep: [0.6, -12.3] }], [[0.8, -9.6], [3.0, 10.2], "bola mais central", "muda a direção", { v: 16, ap: 1.7, dep: [2.6, -12.4] }]] }),
    PDB012: treino({ r: "Backhand cruzado para deslocar e forehand para finalizar na bola central.", A: [-2.8, -12.5], T: [0.3, 9.8], bolas: [
      ["bh", "cruzBH", "bola no backhand", "backhand cruzado — desloca", { dep: [0.2, -12.3] }], [[0.6, -9.6], [-3.0, 9.6], "bola central", "forehand finaliza no espaço aberto", { v: 17, ap: 1.7, dep: [-2.8, -12.5] }]] }),
    PDB013: treino({ r: "Forehand cruzado fundo e, na bola curta cruzada, approach pela paralela e subida.", A: [2.6, -12.4], bolas: [
      ["fh", "cruzFH", "bola no forehand", "forehand cruzado fundo", { dep: [0.6, -12.0] }], ["fhCurta", "parFH", "bola curta cruzada", "approach na paralela e sobe à rede", { ap: 1.5, dep: [1.2, -3.6] }],
      ["vbh", "vCruzBH", "passada", "voleio", { dep: [2.6, -12.4] }]] }),
    PDB014: treino({ r: "Forehand inside out e, na bola curta cruzada, approach de backhand e subida.", bolas: [
      ["contorno", "io", "bola no meio", "forehand inside out", { contorno: true, dep: [0.2, -12.2] }], ["bhCurta", "parBH", "bola curta cruzada no backhand", "approach de backhand e sobe", { ap: 1.5, dep: [-1.0, -3.6] }],
      ["vfh", "vCruzFH", "passada", "voleio"]] }),
    PDB015: treino({ r: "Forehand cruzado fundo e, na bola curta central, approach de forehand no lado oposto.", A: [2.6, -12.4], bolas: [
      ["fh", "cruzFH", "bola no forehand", "forehand cruzado fundo", { dep: [0.6, -12.2] }], ["centroCurta", [3.0, 9.8], "bola curta central", "approach de forehand no lado oposto e sobe", { ap: 1.5, dep: [1.0, -3.6] }],
      ["vbh", "vCruzBH", "passada", "voleio", { dep: [2.6, -12.4] }]] }),
    PDB016: treino({ r: "Inside out para abrir e, na bola curta central, approach de forehand.", bolas: [
      ["contorno", "io", "bola no meio", "forehand inside out — abre", { contorno: true, dep: [0.2, -12.2] }], ["centroCurta", [-3.0, 9.8], "bola curta central", "approach de forehand e sobe", { ap: 1.5, dep: [-0.6, -3.6] }],
      ["vfh", "vCruzFH", "passada", "voleio"]] }),
    PDB017: treino({ r: "Inside out e inside in já avançando para a rede, as duas bolas rápidas.", bolas: [
      ["contorno", "io", "bola no meio", "forehand inside out, rápido", { contorno: true, v: 16, dep: [-0.4, -10.4] }],
      ["contornoMeia", "ii", "bola mais curta no meio", "forehand inside in, já avançando", { contorno: true, v: 16, ap: 1.6, dep: [-0.6, -3.8] }], ["vfh", "vCruzFH", "passada", "voleio"]] }),

    /* ── Padrões de rede ── */
    PDR001: treino({ r: "Bola curta: approach de forehand paralelo e voleio de backhand no lado oposto.", A: [0.3, -12.2], bolas: [
      ["fhCurta", "parFH", "bola curta no forehand", "approach paralelo; split step", { ap: 1.5, dep: [1.2, -3.8] }], ["vbh", [-3.2, 7.6], "passada", "voleio de backhand no lado oposto"]] }),
    PDR002: treino({ r: "Approach de forehand paralelo e voleio de forehand — colocação, não potência.", A: [0.3, -12.2], bolas: [
      ["fhCurta", "parFH", "bola curta no forehand", "approach paralelo; split step", { ap: 1.5, dep: [1.2, -3.8] }], ["vfh", [-3.2, 7.6], "passada", "voleio de forehand colocado"]] }),
    PDR003: treino({ r: "Approach de backhand paralelo e voleio de forehand no lado oposto.", A: [-0.3, -12.2], T: [0.3, 9.8], bolas: [
      ["bhCurta", "parBH", "bola curta no backhand", "approach de backhand paralelo; split step", { ap: 1.5, dep: [-1.0, -3.8] }], ["vfh", [3.2, 7.6], "passada", "voleio de forehand no lado oposto"]] }),
    PDR004: treino({ r: "Approach de backhand paralelo e voleio de backhand.", A: [-0.3, -12.2], T: [0.3, 9.8], bolas: [
      ["bhCurta", "parBH", "bola curta no backhand", "approach de backhand paralelo; split step", { ap: 1.5, dep: [-1.0, -3.8] }], ["vbh", [3.2, 7.6], "passada", "voleio de backhand cruzado"]] }),
    PDR005: treino({ r: "Bola curta no centro: approach de forehand pelo lado esquerdo e voleio de backhand no lado oposto.", A: [0.3, -12.2], bolas: [
      ["centroCurta", [-3.0, 9.8], "bola curta no centro", "approach de forehand pela esquerda", { pos: [-0.5, -6.8], ap: 1.5, dep: [-0.4, -3.8] }], ["vbh", [3.2, 7.6], "passada", "voleio de backhand no lado oposto"]] }),
    PDR006: treino({ r: "Mesma subida pela esquerda com voleio de forehand (avançado: o treinador decide o voleio na hora).", A: [0.3, -12.2], bolas: [
      ["centroCurta", [-3.0, 9.8], "bola curta no centro", "approach de forehand pela esquerda", { pos: [-0.5, -6.8], ap: 1.5, dep: [-0.4, -3.8] }], ["vfh", [3.2, 7.6], "passada", "voleio de forehand no lado oposto"]] }),
    PDR007: treino({ r: "Bola curta no centro: approach de forehand pelo lado direito e voleio de backhand no lado oposto.", A: [0.3, -12.2], bolas: [
      ["centroCurta", [3.0, 9.8], "bola curta no centro", "approach de forehand pela direita", { ap: 1.5, dep: [0.8, -3.8] }], ["vbh", [-3.2, 7.6], "passada", "voleio de backhand no lado oposto"]] }),
    PDR008: treino({ r: "Approach de forehand pela direita e voleio de forehand — fecha o ciclo das 8 combinações.", A: [0.3, -12.2], bolas: [
      ["centroCurta", [3.0, 9.8], "bola curta no centro", "approach de forehand pela direita", { ap: 1.5, dep: [0.8, -3.8] }], ["vfh", [-3.2, 7.6], "passada", "voleio de forehand cruzado"]] }),

    /* ── Padrões de saque ── */
    PDS001: rot({ r: "Saque e 1ª bola no lado de iguais, com a decisão tomada antes do saque.", at: sv("dc"), alvos: [z(1.4, 7.0, 4.115, 11.885, "1ª bola")] }, [
      S("A", "sAbdc", "saque aberto (decisão da 1ª bola já tomada)", { mover: { A: [0.6, -11.8] } }), L("O", [1.4, -9.8], "devolução"),
      L("A", [3.0, 9.8], "1ª bola no espaço aberto", { v: 15, apice: 1.8, fim: true })]),
    PDS002: rot({ r: "Saque e 1ª bola no lado da vantagem: o saque aberto vai no backhand do adversário.", at: sv("ac"), alvos: [z(-4.115, 7.0, -1.4, 11.885, "1ª bola")] }, [
      S("A", "sAbac", "saque aberto no backhand", { mover: { A: [-0.4, -11.8] } }), L("O", [1.2, -9.6], "devolução"),
      L("A", [-3.0, 9.8], "1ª bola, forehand cruzado no espaço aberto", { v: 15, apice: 1.8, fim: true })]),
    PDS003: rot({ r: "Saque aberto, 1ª bola de forehand pelo centro e a 2ª de inside out ou inside in.", at: sv("dc") }, [
      S("A", "sAbdc", "saque aberto", { mover: { A: [0.4, -11.9] } }), L("O", [0.6, -9.8], "devolução central"),
      L("A", "centro", "1ª bola: forehand pelo centro"), L("O", "contorno", "bola no lado do backhand", { mover: { A: bx(B.contorno, true) } }),
      L("A", "io", "2ª bola: inside out (ou inside in)", { v: 17, apice: 1.7, fim: true })]),
    PDS004: rot({ r: "Saque aberto, 1ª bola de forehand no lado direito e inside in para finalizar.", at: sv("dc") }, [
      S("A", "sAbdc", "saque aberto", { mover: { A: [0.4, -11.9] } }), L("O", [2.0, -9.8], "devolução no forehand"),
      L("A", [3.0, 9.8], "1ª bola de forehand no espaço aberto"), L("O", "contorno", "bola no lado do backhand", { mover: { A: bx(B.contorno, true) } }),
      L("A", "ii", "forehand inside in — finaliza", { v: 17, apice: 1.7, fim: true })]),
    PDS005: rot({ r: "Saque aberto, forehand cruzado e finalização de backhand cruzado ou inside out.", at: sv("dc") }, [
      S("A", "sAbdc", "saque aberto", { mover: { A: [0.4, -11.9] } }), L("O", [2.0, -9.8], "devolução no forehand"),
      L("A", "cruzFH", "forehand cruzado"), L("O", [-2.2, -9.8], "bola no backhand"), L("A", "cruzBH", "backhand cruzado (ou inside out) — finaliza", { v: 16, fim: true })]),
    PDS006: rot({ r: "Saque aberto, o backhand faz a transição e o forehand finaliza (cruzado ou inside in).", at: sv("dc") }, [
      S("A", "sAbdc", "saque aberto", { mover: { A: [0.4, -11.9] } }), L("O", [-2.0, -9.8], "devolução no backhand"),
      L("A", [2.8, 10.4], "backhand de transição"), L("O", [2.0, -9.8], "bola no forehand"), L("A", "cruzFH", "forehand cruzado (ou inside in) — finaliza", { v: 17, apice: 1.7, fim: true })]),
    PDS007: rot({ r: "Saque no T, 1ª bola de backhand e forehand cruzado ou inside in.", at: sv("dc") }, [
      S("A", "sTdc", "saque no T", { mover: { A: [0.4, -11.9] } }), L("O", [-2.0, -9.8], "devolução no backhand"),
      L("A", "cruzBH", "1ª bola de backhand"), L("O", [1.6, -9.8], "bola no forehand"), L("A", "cruzFH", "forehand cruzado (ou inside in)", { v: 17, apice: 1.7, fim: true })]),
    PDS008: rot({ r: "Saque no T, backhand e a 3ª bola de forehand decidida na hora.", at: sv("dc") }, [
      S("A", "sTdc", "saque no T", { mover: { A: [0.4, -11.9] } }), L("O", [-2.0, -9.8], "devolução no backhand"),
      L("A", "cruzBH", "backhand"), L("O", "contorno", "bola no meio", { mover: { A: bx(B.contorno, true) } }), L("A", "ii", "decide na hora: inside in ou inside out", { v: 17, apice: 1.7, fim: true })]),
    PDS009: rot({ r: "Saque no T, backhand e finalização de backhand cruzado ou inside out.", at: sv("dc") }, [
      S("A", "sTdc", "saque no T", { mover: { A: [0.4, -11.9] } }), L("O", [-2.0, -9.8], "devolução no backhand"),
      L("A", "cruzBH", "backhand"), L("O", [-2.2, -9.8], "outra bola no backhand"), L("A", [3.2, 9.6], "backhand cruzado (ou inside out) — finaliza", { v: 16, fim: true })]),
    PDS010: rot({ r: "Saque no T e o backhand como arma de abertura e finalização (paralelo ou inside in).", at: sv("dc") }, [
      S("A", "sTdc", "saque no T", { mover: { A: [0.4, -11.9] } }), L("O", [-2.0, -9.8], "devolução no backhand"),
      L("A", "cruzBH", "backhand abre"), L("O", [-2.2, -9.8], "outra bola no backhand"), L("A", "parBH", "backhand paralelo (ou inside in) — finaliza", { v: 16, apice: 1.7, fim: true })]),
    PDS011: rot({ r: "Saque no T, forehand central cruzado e finalização de backhand cruzado ou inside out.", at: sv("dc") }, [
      S("A", "sTdc", "saque no T", { mover: { A: [0.4, -11.9] } }), L("O", [0.6, -9.8], "devolução central"),
      L("A", "cruzFH", "forehand central, cruzado"), L("O", [-2.0, -9.8], "bola no backhand"), L("A", "cruzBH", "backhand cruzado (ou inside out)", { v: 16, fim: true })]),
    PDS012: rot({ r: "Saque no T, forehand central e inside in ou inside out — o mais exigente da série.", at: sv("dc") }, [
      S("A", "sTdc", "saque no T", { mover: { A: [0.4, -11.9] } }), L("O", [0.6, -9.8], "devolução central"),
      L("A", [-2.2, 10.6], "forehand central"), L("O", "contorno", "bola no meio", { mover: { A: bx(B.contorno, true) } }), L("A", "io", "inside out (ou inside in)", { v: 17, apice: 1.7, fim: true })]),

    /* ── Ataque ── */
    AT001: treino({ r: "Bola curta: entrar na quadra e jogar no espaço vazio.", alvos: [z(1.6, 6.4, 4.115, 11.885, "espaço vazio")], bolas: [
      ["fhCurta", "parFH", "bola curta", "entra e joga no espaço vazio", { v: 16, ap: 1.6 }]] }),
    AT002: treino({ r: "Bola de três quartos: ataque plano e para a frente.", bolas: [
      ["fhMeia", "cruzFH", "bola de três quartos no forehand", "ataque plano, para a frente", { v: 18, ap: 1.4 }], ["bhMeia", "cruzBH", "bola de três quartos no backhand", "ataque plano", { v: 18, ap: 1.4 }]] }),
    AT003: treino({ r: "Ataca e finaliza na rede na bola seguinte.", bolas: [
      ["fhMeia", "parFH", "bola de três quartos", "ataca e segue para a frente", { v: 17, ap: 1.5, dep: [0.8, -4.0] }], ["vbh", "vCurtoBH", "bola seguinte", "finaliza na rede"]] }),
    AT004: treino({ r: "Duas bolas: a primeira com alvo de segurança (2 m das linhas), a segunda com alvo de pressão.",
      alvos: [z(-2.1, 7.0, 2.1, 9.9, "segurança"), z(-4.115, 9.4, -2.6, 11.885, "pressão")], bolas: [
        ["fh", [-1.2, 8.6], "1ª bola", "arma no alvo de segurança"], ["fhMeia", [-3.4, 10.6], "2ª bola", "converte no alvo de pressão", { v: 17, ap: 1.6 }]] }),
    AT005: treino({ r: "Atacar por variação: curtinha ou mudança de ritmo, sem acelerar.", bolas: [
      ["fh", "dropFH", "bola no forehand", "curtinha", { ap: 1.5, v: 7 }], ["bh", [2.4, 10.4], "bola no backhand", "muda o ritmo: bola lenta e alta", { ap: 3.4, v: 9 }]] }),
    AT006: treino({ r: "Ataque por posição: ganha terreno a cada bola, até a resposta ficar impossível — sem bater forte.", bolas: [
      ["fh", "cruzFH", "1ª bola", "cruzada funda; avança", { dep: [0.3, -11.4] }], [[-2.2, -8.8], "cruzBH", "2ª bola", "mais à frente; avança de novo", { dep: [0.3, -9.6] }],
      [[2.0, -7.0], "parFH", "3ª bola", "de dentro da quadra, a bola que o adversário não alcança", { ap: 1.6 }]] }),
    AT007: treino({ r: "Curtinha disfarçada: preparação idêntica à do drive até o último instante.", bolas: [
      ["fh", "cruzFH", "bola no forehand", "drive"], ["fh", "dropFH", "a mesma bola", "mesma preparação... e curtinha", { ap: 1.5, v: 7 }]] }),
    AT008: rot({ r: "Approach na paralela e split na zona de voleio, cobrindo a rota provável da passada.", at: { A: Ab, O: [-0.3, 11.8] } }, [
      L("O", "fhCurta", "bola curta", { mover: { A: bx(B.fhCurta) } }), L("A", "parFH", "approach na paralela", { apice: 1.5, mover: { A: [1.4, -4.0] } }),
      V("O", "passada na paralela (a rota provável)", { v: 14, mover: { A: [2.2, -3.6] } }), L("A", "vCruzFH", "split na zona de voleio e voleio cruzado", { h0: 1.2, apice: 1.4, fim: true })]),
    AT009: rot({ r: "Approach pesado no backhand do adversário, caindo atrás dele, e voleio de decisão.", at: { A: Ab, O: [-0.3, 11.8] } }, [
      L("O", "fhCurta", "bola curta", { mover: { A: bx(B.fhCurta) } }), L("A", [2.8, 11.2], "approach pesado no backhand, caindo atrás", { apice: 2.6, mover: { A: [0.6, -4.0] } }),
      V("O", "resposta do backhand", { v: 12, mover: { A: [-0.4, -3.6] } }), L("A", [-3.2, 6.6], "voleio de decisão no espaço aberto", { h0: 1.2, apice: 1.4, fim: true })]),
    AT010: treino({ r: "Contorno de forehand a partir de bola central: inside out e inside in.", bolas: [
      ["contorno", "io", "bola central", "contorna: inside out", { contorno: true }], ["contorno", "ii", "bola central", "contorna: inside in", { contorno: true, v: 16 }]] }),

    /* ── Início de ponto ── */
    IP001: rot({ r: "Saca e disputa o ponto na hora, sem troca de aquecimento.", at: sv("dc") }, [
      S("A", "sAbdc", "saque", { mover: { A: [0.4, -11.9] } }), L("O", [-0.6, -10.2], "devolução"), L("A", "cruzBH", "joga o ponto"), L("O", [2.2, -10.4], "devolve"), L("A", "cruzFH", "segue o ponto", { fim: true })]),
    IP002: rot({ r: "Saque para dois alvos amplos, declarando o alvo em voz alta antes.", at: { A: [0.8, -12.3] }, alvos: [z(-4.115, 3.2, -2.0, 6.4, "alvo 1"), z(-1.6, 3.2, 0, 6.4, "alvo 2")] }, [
      S("A", "sAbdc", "declara 'alvo 1' e saca", { fim: true, pausa: 0.6 }), S("A", "sTdc", "declara 'alvo 2' e saca", { fim: true, pausa: 0.6 })]),
    IP003: rot({ r: "Saca, o professor devolve neutro e o aluno joga a 1ª bola com intenção definida.", at: { A: [0.8, -12.3], T: [-1.0, 12.2] } }, [
      S("A", "sTdc", "saque", { mover: { A: [0.4, -11.9] } }), L("T", [0.6, -10.2], "devolução neutra"), L("A", [-2.8, 10.4], "1ª bola com intenção definida", { v: 15, fim: true })]),
    IP004: rot({ r: "O ponto começa na devolução; o sacador saca controlado.", at: { A: [2.6, -12.2], O: [-0.8, 12.3] } }, [
      S("O", [1.6, -5.8], "saque controlado", { v: 16 }), L("A", [-2.0, 10.4], "devolução"), L("O", [-2.2, -10.2], "devolve"), L("A", "cruzBH", "segue o ponto", { fim: true })]),
    IP005: rot({ r: "Devolução alternando o alvo, declarado antes do saque.", at: dev("dc"), alvos: [z(-4.115, 8.4, -1.6, 11.885, "cruzado"), z(1.6, 8.4, 4.115, 11.885, "paralelo")] }, [
      S("T", [1.6, -5.8], "saque (o atleta declarou 'cruzado')", { v: 17 }), L("A", [-2.8, 10.4], "devolução cruzada", { fim: true, mover: { A: [2.6, -12.2] } }),
      S("T", [1.6, -5.8], "saque (o atleta declarou 'paralelo')", { v: 17 }), L("A", [2.8, 10.4], "devolução paralela", { fim: true, mover: { A: [2.6, -12.2] } })]),
    IP006: rot({ r: "Devolve e joga a bola seguinte com intenção definida.", at: dev("dc") }, [
      S("T", [1.6, -5.8], "saque", { v: 17 }), L("A", "centro", "devolução funda ao centro"), L("T", [-2.0, -10.2], "bola seguinte"), L("A", "cruzBH", "golpe com intenção definida", { fim: true })]),
    IP007: rot({ r: "Devolução entrando: espera dentro da linha, bloqueia com direção e sai à frente.", at: { A: [2.2, -10.6], T: [-0.8, 12.3] } }, [
      S("T", [1.8, -5.8], "saque", { v: 17, mover: { A: [2.4, -10.4] } }), L("A", [-0.6, 10.6], "bloqueia com direção e sai à frente", { apice: 1.8, v: 12, fim: true, mover: { A: [1.6, -9.0] } })]),
    IP008: rot({ r: "Devolução de trás: espera atrás e faz o golpe pleno no alvo central profundo.", at: { A: [2.6, -13.6], T: [-0.8, 12.3] }, alvos: [z(-1.4, 9.4, 1.4, 11.885, "centro fundo")] }, [
      S("T", [1.8, -5.8], "saque", { v: 19, mover: { A: [2.6, -13.4] } }), L("A", "alto", "golpe pleno, central e profundo", { apice: 2.8, fim: true, mover: { A: [2.6, -13.6] } })]),
    IP009: rot({ r: "Saque aberto no lado de iguais e ataque no espaço oposto na 1ª bola.", at: sv("dc"), alvos: [z(1.4, 7.0, 4.115, 11.885, "espaço oposto")] }, [
      S("A", "sAbdc", "saque aberto", { mover: { A: [0.6, -11.8] } }), L("O", [1.4, -9.6], "devolução"), L("A", [3.0, 9.6], "ataca o espaço oposto", { v: 16, apice: 1.7, fim: true })]),
    IP010: rot({ r: "Saque no corpo e 1ª bola agressiva pelo centro, sem dar ângulo.", at: sv("dc"), alvos: [z(-1.4, 8.4, 1.4, 11.885, "centro")] }, [
      S("A", "sCorpodc", "saque no corpo", { mover: { A: [0.4, -11.8] } }), L("O", [0.4, -9.6], "devolução apertada, no meio"), L("A", "centro", "1ª bola agressiva pelo centro", { v: 17, apice: 1.7, fim: true })]),
    IP011: rot({ r: "Saque fechado (no T) e 1ª bola protegendo a paralela.", at: sv("dc") }, [
      S("A", "sTdc", "saque fechado", { mover: { A: [0.4, -11.8] } }), L("O", [1.6, -9.8], "devolução"), L("A", [-2.4, 10.6], "1ª bola cruzada e funda, protegendo a paralela", { fim: true })]),
    IP012: rot({ r: "Matriz de três caminhos: a devolução volta cruzada, pelo meio ou paralela, e a resposta já está decidida para cada uma.", at: sv("dc") }, [
      S("A", "sAbdc", "saque aberto", { mover: { A: [0.4, -11.9] } }), L("O", [2.2, -10.2], "devolução cruzada"), L("A", [3.0, 10.0], "resposta: paralela no espaço aberto", { fim: true, mover: { A: [0.8, -12.3] } }),
      S("A", "sAbdc", "saque aberto", { mover: { A: [0.4, -11.9] } }), L("O", [0.2, -10.4], "devolução pelo meio"), L("A", "io", "resposta: inside out", { fim: true, mover: { A: [0.8, -12.3] } }),
      S("A", "sAbdc", "saque aberto", { mover: { A: [0.4, -11.9] } }), L("O", [-2.4, -10.2], "devolução paralela"), L("A", "cruzBH", "resposta: backhand cruzado", { fim: true, mover: { A: [0.8, -12.3] } })]),
    IP014: rot({ r: "Saque indecifrável: duas variações com o mesmo armado; o parceiro tenta antecipar e declara antes do contato.", at: sv("dc") }, [
      S("A", "sTdc", "saque no T (o parceiro tenta adivinhar)", { fim: true, pausa: 0.6 }), S("A", "sAbdc", "mesmo armado, saque aberto", { fim: true, pausa: 0.6 })]),
    IP015: rot({ r: "Só segundos saques, com alvo e plano declarados — proibido jogar só para não errar.", at: { A: [0.8, -12.3] }, alvos: [z(-1.4, 4.6, 0, 6.4, "alvo"), z(2.4, 4.4, 4.115, 6.4, "alvo")] }, [
      S("A", [-0.6, 5.6], "2º saque com kick no backhand (lado de iguais)", { v: 15, apice: 3.3, fim: true, mover: { A: [-0.8, -12.3] }, pausa: 0.6 }),
      S("A", [3.2, 5.4], "2º saque com kick no backhand (lado da vantagem)", { v: 15, apice: 3.4, fim: true, mover: { A: [0.8, -12.3] }, pausa: 0.6 })]),
    IP016: rot({ r: "Saque e subida imediata, com split na zona de voleio antes do golpe do adversário.", at: sv("dc") }, [
      S("A", "sAbdc", "saque e subida imediata", { mover: { A: [0.6, -6.6] } }), V("O", "devolução", { hK: 0.9, mover: { A: [0.4, -5.6] } }),
      L("A", [2.6, 9.6], "split na zona de voleio e voleio fundo", { h0: 0.9, apice: 1.5, v: 11, fim: true })]),
    IP017: rot({ r: "Devolução agressiva emendando o avanço à rede.", at: dev("dc") }, [
      S("T", [1.8, -5.8], "saque", { v: 17 }), L("A", [-2.6, 10.6], "devolução agressiva e avança", { v: 16, apice: 1.7, mover: { A: [1.0, -4.6] } }),
      V("T", "passada", { v: 13, mover: { A: [0.4, -3.6] } }), L("A", "vCruzBH", "voleio", { h0: 1.2, apice: 1.4, fim: true })]),
    IP020: rot({ r: "Devolução contra três velocidades de saque, sem aviso: lento, médio e forte.", at: dev("dc") }, [
      S("T", [1.6, -5.8], "saque lento", { v: 12, apice: 3.0 }), L("A", [-1.0, 10.6], "devolução", { fim: true, mover: { A: [2.6, -12.2] } }),
      S("T", [1.6, -5.8], "saque médio", { v: 17 }), L("A", [-1.0, 10.6], "devolução", { fim: true, mover: { A: [2.6, -12.2] } }),
      S("T", [1.6, -5.8], "saque forte", { v: 24 }), L("A", [-1.0, 10.6], "devolução curta e firme", { fim: true, mover: { A: [2.6, -12.2] } })]),

    /* ── Jogo aplicado ── */
    JA002: rot({ r: "O ponto acaba na 4ª bola; vence quem estiver mais bem posicionado.", at: sv("dc") }, [
      S("A", "sAbdc", "1ª bola: saque", { mover: { A: [0.4, -11.9] } }), L("O", [-0.6, -10.2], "2ª bola: devolução"), L("A", "cruzBH", "3ª bola: tira o adversário do lugar", { mover: { A: [0.3, -11.8] } }),
      L("O", [0.4, -10.0], "4ª bola: fim — quem está mais bem posicionado?", { fim: true })]),
    JA003: rot({ r: "Ponto ganho à frente da linha de serviço vale dois.", at: { A: Ab, O: [0, 12.2] }, alvos: [z(-4.115, -6.4, 4.115, -0.3, "vale 2")] }, [
      L("O", "fhCurta", "bola curta", { mover: { A: bx(B.fhCurta) } }), L("A", "parFH", "approach", { apice: 1.5, mover: { A: [1.2, -4.0] } }),
      V("O", "passada", { v: 13, mover: { A: [1.8, -3.6] } }), L("A", "vCruzFH", "voleio vencedor à frente da linha: vale dois", { h0: 1.2, apice: 1.4, fim: true })]),
    JA004: rot({ r: "Toda bola curta recebida obriga a entrar e atacar.", at: { A: Ab, O: [0, 12.4] } }, [
      L("O", [2.4, -10.6], "bola funda"), L("A", "cruzFH", "cruzada"), L("O", "bhCurta", "bola curta", { mover: { A: bx(B.bhCurta) } }), L("A", "parBH", "entra e ataca (obrigatório)", { v: 16, apice: 1.6, fim: true })]),
    JA011: treino({ r: "Duas defesas alternadas obrigatoriamente: alta e acelerada.", bolas: [
      ["fhAberta", "alto", "bola larga no forehand", "defesa alta", { ap: 5, v: 11 }], ["bhAberta", "cruzBH", "bola larga no backhand", "defesa acelerada, cruzada", { ap: 1.6, v: 17 }]] }),

    /* ── Ritmo e tempo ── */
    RT001: treino({ r: "Alvo no chão marca onde os pés devem estar antes do quique.", cones: [bx(B.fh), bx(B.bh)], bolas: [
      ["fh", "cruzFH", "bola no forehand", "chega com os pés no alvo antes do quique"], ["bh", "cruzBH", "bola no backhand", "chega antes da bola de novo"]] }),
    RT002: treino({ r: "Golpear no instante em que a bola para no ar depois do quique.", bolas: [
      ["fh", "cruzFH", "bola com altura", "bate no topo: a bola parada no ar", { af: 3.0, pos: [2.7, -11.2] }], ["bh", "cruzBH", "bola com altura", "bate no topo", { af: 3.0, pos: [-2.7, -11.2] }]] }),
    RT003: rot({ r: "A cada bola da troca, a base avança cerca de 30 cm para dentro da quadra.", at: { A: [2.8, -12.6], P: [-2.9, 12.4] }, cones: [[2.8, -12.6], [2.8, -12.2], [2.8, -11.8]] }, [
      L("P", [2.4, -10.9], "bola cruzada", { mover: { A: [2.8, -12.6] } }), L("A", "cruzFH", "forehand"), L("P", [2.4, -10.6], "bola cruzada", { mover: { A: [2.8, -12.2] } }),
      L("A", "cruzFH", "30 cm mais à frente"), L("P", [2.4, -10.3], "bola cruzada", { mover: { A: [2.8, -11.8] } }), L("A", "cruzFH", "mais 30 cm à frente")]),
    RT004: treino({ r: "Bola curta é convite: entrar e finalizar à frente.", bolas: [
      ["fhCurta", "parFH", "bola curta do professor", "entra e ataca", { vf: 8, af: 1.8, v: 16, ap: 1.6, dep: [0.8, -4.0] }], ["vbh", "vCurtoBH", "resposta", "finaliza à frente"]] }),
    RT005: rot({ r: "Mesma direção com duas alturas: alta e depois direta; compare o tempo que o parceiro tem.", at: { A: [2.9, -12.6], P: [-2.9, 12.6] } }, [
      L("A", "cruzFH", "trajetória alta: o parceiro tem tempo", { apice: 3.8, v: 11 }), L("P", [2.5, -11.0], "devolve"),
      L("A", "cruzFH", "trajetória direta: o parceiro tem menos tempo", { apice: 1.4, v: 17 }), L("P", [2.5, -11.0], "devolve")]),
    RT006: rot({ r: "Troca toda de dentro da linha de base, na meia quadra.", at: { A: [2.4, -10.6], P: [-2.9, 12.4] } }, [
      L("P", [2.3, -9.2], "bola cruzada", { mover: { A: [2.6, -10.4] } }), L("A", "cruzFH", "de dentro da base, na subida"), L("P", [-2.3, -9.2], "bola no backhand", { mover: { A: [-2.6, -10.4] } }), L("A", "cruzBH", "de dentro, de novo")]),
    RT007: rot({ r: "Devolução que rouba tempo: sempre na subida do quique.", at: { A: [2.0, -11.0], T: [-0.8, 12.3] } }, [
      S("T", [1.8, -5.8], "saque", { v: 18, mover: { A: [2.2, -8.0] } }), L("A", [-0.4, 10.6], "devolve na subida do quique", { apice: 1.8, fim: true, mover: { A: [2.0, -11.0] } })]),
    RT008: treino({ r: "Defesa acelerada: na corrida, acelerar a cruzada em vez de levantar a bola.", bolas: [
      ["fhAberta", "cruzFH", "bola larga no forehand", "na corrida, acelera a cruzada", { v: 17, ap: 1.5 }], ["bhAberta", "cruzBH", "bola larga no backhand", "acelera a cruzada", { v: 17, ap: 1.5 }]] }),
    RT009: treino({ r: "As duas defesas — alta ou acelerada — por chamada do professor durante o ponto.", bolas: [
      ["fhAberta", "alto", "'alta!'", "defesa alta", { ap: 5, v: 11 }], ["bhAberta", "cruzBH", "'acelera!'", "defesa acelerada", { ap: 1.5, v: 17 }]] }),
    RT010: rot({ r: "Variação para tirar a referência de tempo do parceiro: ritmo, altura e efeito.", at: { A: [2.9, -12.6], P: [-2.9, 12.6] } }, [
      L("A", "cruzFH", "rápida e baixa", { apice: 1.4, v: 17 }), L("P", [2.5, -11.0], "devolve"), L("A", [-2.4, 10.8], "alta e lenta, com topspin", { apice: 4.0, v: 10 }),
      L("P", [2.5, -11.0], "devolve"), L("A", [-2.0, 9.6], "slice baixo", { apice: 1.3, v: 9 }), L("P", [2.5, -11.0], "devolve")]),
    RT011: rot({ r: "Split antecipado: o salto começa lendo o corpo do parceiro, não a bola.", at: { A: [2.9, -12.6], P: [-2.9, 12.6] } }, [
      L("A", "cruzFH", "forehand cruzado"), L("P", [2.5, -11.0], "o atleta já fez o split lendo o corpo do parceiro")]),
    RT012: rot({ r: "Subir à rede numa bola que normalmente não pediria subida.", at: { A: [2.9, -12.4], P: [-2.9, 12.4] } }, [
      L("P", [2.4, -9.4], "bola média, sem convite"), L("A", "parFH", "ataca e sobe assim mesmo", { apice: 1.6, mover: { A: [1.2, -4.0] } }),
      V("P", "passada", { v: 13, mover: { A: [1.8, -3.6] } }), L("A", "vCruzFH", "voleio", { h0: 1.2, apice: 1.4, fim: true })]),

    /* ── Trilhos ── */
    TR001: rot({ r: "Três bolas fundas cruzadas e, a cada uma, o jogador avança meio metro (cones marcam as posições).", at: { A: [2.8, -12.4], P: [-2.9, 12.4] }, cones: [[2.8, -12.4], [2.8, -11.9], [2.8, -11.4]] }, [
      L("A", "cruzFH", "funda e cruzada"), L("P", [2.5, -10.8], "devolve fundo e cruzado", { mover: { A: [2.8, -11.9] } }), L("A", "cruzFH", "meio metro à frente"),
      L("P", [2.5, -10.4], "fundo e cruzado", { mover: { A: [2.8, -11.4] } }), L("A", "cruzFH", "mais meio metro à frente"), L("P", [2.5, -11.0], "fundo e cruzado", { mover: { A: [2.8, -12.4] } })]),
    TR002: rot({ r: "Negação de ângulo: contra a bola angulada, funda ao centro; o parceiro volta sem ângulo e o jogador escolhe o lado.", at: { A: Ab, P: [-2.8, 12.4] } }, [
      L("P", [3.6, -7.6], "bola angulada"), L("A", "centro", "funda ao centro: tira o ângulo"), L("P", [0.6, -10.2], "devolve sem ângulo"), L("A", [-3.0, 10.2], "escolhe o lado", { fim: true })]),
    TR003: treino({ r: "Três tipos de bola em ordem aleatória: o jogador diz 'neutra', 'ataque' ou 'defesa' antes de bater.", bolas: [
      [[2.4, -10.6], "centro", "funda e alta", "'neutra!'", { af: 4.0, ap: 3.0 }], ["centroCurta", "cruzFH", "curta e lenta", "'ataque!'", { vf: 8, v: 17, ap: 1.5 }],
      ["bhFunda", "alto", "profunda e rápida", "'defesa!'", { vf: 14, ap: 4.6, v: 11 }]] }),
    TR004: rot({ r: "Virada da quadra: duas cruzadas do lado não dominante, a terceira vem ao meio e o jogador contorna para o inside out.", at: { A: [-2.8, -12.5], P: [2.8, 12.5] } }, [
      L("A", "cruzBH", "cruzada de backhand (1)"), L("P", [-2.5, -11.0], "cruzada"), L("A", "cruzBH", "cruzada de backhand (2)"),
      L("P", "contorno", "bola ao meio", { mover: { A: bx(B.contorno, true) } }), L("A", "io", "contorna e vira a quadra de inside out", { v: 16, fim: true })]),
    TR005: rot({ r: "Duas bolas fundas e altas fazem o parceiro recuar; na terceira ele devolve curta e o jogador entra e ataca.", at: { A: Ab, P: [0, 12.4] } }, [
      L("A", [0, 11.0], "funda e alta: o parceiro recua", { apice: 4.0 }), L("P", [0.4, -10.6], "devolve"), L("A", [-0.6, 11.2], "funda e alta de novo", { apice: 4.0 }),
      L("P", [1.4, -6.4], "devolve curta"), L("A", [-3.0, 9.6], "entra e ataca de meia quadra", { v: 17, apice: 1.6, fim: true })]),
    TR006: treino({ r: "Bola profunda empurra o jogador; ele responde alta e funda ao centro e ataca a bola média seguinte.", bolas: [
      ["fhFunda", "alto", "bola profunda que empurra", "alta e funda ao centro", { vf: 14, ap: 4.6, v: 11, dep: [0.3, -12.0] }], ["fhMeia", "cruzFH", "bola média", "ataca", { v: 17, ap: 1.5 }]] }),
    TR007: treino({ r: "Muda a direção só na bola confortável; na desconfortável, devolve na mesma direção.", bolas: [
      ["fh", "parFH", "bola confortável (cintura, corpo equilibrado)", "muda a direção: paralela"], ["fhAberta", "cruzFH", "bola desconfortável (alta, larga, na corrida)", "devolve na mesma direção: cruzada", { af: 3.2 }]] }),
    TR008: rot({ r: "Subida intencional em quatro tempos: bola funda que empurra, aproximação baixa no lado fraco, subida e voleio.", at: { A: Ab, P: [0, 12.4] } }, [
      L("A", [0, 11.0], "1. bola funda que empurra", { apice: 3.5 }), L("P", [1.4, -7.0], "devolve mais curta"),
      L("A", [2.8, 9.8], "2. aproximação baixa no lado fraco do parceiro", { apice: 1.4, mover: { A: [0.8, -3.8] } }), V("P", "passada", { v: 13, mover: { A: [0.2, -3.6] } }),
      L("A", "vCurtoFH", "3-4. subida e voleio de decisão", { h0: 1.2, apice: 1.4, fim: true })]),
    TR009: rot({ r: "Bola neutra ao centro e ponto livre; vale dobro quem terminar com o pé dentro da quadra.", at: { A: Ab, O: [0, 12.4], T: [1.8, 12.8] } }, [
      L("T", "centro", "alimentação neutra ao centro", { mover: { A: bx(B.centro) } }), L("A", [-2.6, 10.6], "começa o ponto", { para: "O" }),
      L("O", [2.0, -9.0], "devolve", { mover: { A: [2.4, -10.4] } }), L("A", [2.8, 9.8], "termina com o pé dentro: ponto duplo", { v: 17, apice: 1.6, fim: true })]),
    TR010: rot({ r: "Bola que empurra o jogador para fora; o ponto segue e ele neutraliza antes de atacar.", at: { A: Ab, O: [0, 12.4], T: [1.8, 12.8] } }, [
      L("T", "fhAberta", "bola que empurra para fora", { mover: { A: bx(B.fhAberta) } }), L("A", "alto", "neutraliza: alta e funda", { apice: 4.5, para: "O" }),
      L("O", [0.6, -8.4], "bola mais curta", { mover: { A: bx([0.6, -8.4]) } }), L("A", "cruzFH", "agora ataca", { v: 17, apice: 1.6, fim: true })]),
    TR011: rot({ r: "Em meio à troca, o treinador entra com uma bola curta não anunciada; o ponto segue.", at: { A: [2.6, -12.4], O: [-2.6, 12.4], T: [1.8, 12.8] } }, [
      L("O", [2.4, -10.8], "troca"), L("A", "cruzFH", "troca"), L("O", [2.4, -10.8], "troca"), L("A", "cruzFH", "troca", { para: "O" }),
      L("T", "centroCurta", "bola curta, sem aviso", { mover: { A: bx(B.centroCurta) } }), L("A", [3.0, 9.8], "entra e ataca", { v: 17, apice: 1.6, fim: true })]),
    TR012: rot({ r: "Saque real; o ponto vale dobro se o jogador terminar com o pé dentro da quadra.", at: sv("dc") }, [
      S("A", "sAbdc", "saque", { mover: { A: [0.6, -11.4] } }), L("O", [1.4, -9.4], "devolução"), L("A", "parFH", "ganha terreno"),
      L("O", [0.8, -8.0], "bola mais curta", { mover: { A: [1.2, -9.4] } }), L("A", [-3.0, 9.6], "termina com o pé dentro: ponto duplo", { v: 17, apice: 1.6, fim: true })]),
    TR013: rot({ r: "O parceiro entra na quadra numa bola do treinador; o jogador neutraliza pelo centro antes de retomar a iniciativa.", at: { A: Ab, O: [0, 12.4], T: [-4.6, -12.8] } }, [
      L("T", [0.4, 6.0], "bola curta para o parceiro, que entra", { mover: { O: [0.6, 7.2] } }), L("O", [3.6, -7.4], "ataca angulado de dentro"),
      L("A", "centro", "neutraliza pelo centro"), L("O", [0.6, -10.0], "devolve"), L("A", [-3.0, 10.2], "retoma a iniciativa", { fim: true })]),
    TR014: rot({ r: "Troca cruzada; pode mudar de direção quando quiser, mas perde o ponto se mudar em bola de corrida.", at: { A: [2.6, -12.4], O: [-2.6, 12.4], T: [1.8, 12.8] } }, [
      L("T", [2.4, -10.4], "alimentação", { mover: { A: bx([2.4, -10.4]) } }), L("A", "cruzFH", "cruzada", { para: "O" }), L("O", [2.6, -9.8], "bola confortável"),
      L("A", "parFH", "muda a direção (bola confortável)", { fim: true })]),
    TR015: rot({ r: "Ponto iniciado por alimentação neutra; o jogador precisa subir em algum momento, escolhendo a bola.", at: { A: Ab, O: [0, 12.4], T: [1.8, 12.8] } }, [
      L("T", "centro", "alimentação neutra", { mover: { A: bx(B.centro) } }), L("A", [-2.6, 10.6], "troca", { para: "O" }),
      L("O", [1.6, -7.4], "bola curta: é esta"), L("A", "parFH", "approach e sobe", { apice: 1.5, mover: { A: [1.2, -3.8] } }),
      V("O", "passada", { v: 13, mover: { A: [1.8, -3.6] } }), L("A", "vCruzFH", "voleio", { h0: 1.2, apice: 1.4, fim: true })]),
    TR017: rot({ r: "Games normais; o ponto vale dobro se o jogador terminar com pelo menos um pé dentro da linha de base.", at: { A: [2.6, -12.4], O: [-2.6, 12.4] } }, [
      L("O", [2.2, -9.6], "bola", { mover: { A: [2.6, -10.8] } }), L("A", "cruzFH", "de dentro da quadra"), L("O", [-2.0, -9.4], "bola", { mover: { A: [-2.4, -10.6] } }),
      L("A", [2.9, 9.6], "ponto ganho com o pé dentro: vale dobro", { v: 17, apice: 1.6, fim: true })]),
    TR018: rot({ r: "Games normais; perde o ponto quem angular estando atrás da linha de base.", at: { A: [2.8, -13.0], O: [-2.6, 12.4] }, alvos: [z(-4.115, 3.6, -2.6, 8.0, "ângulo")] }, [
      L("O", [2.4, -11.2], "bola funda", { mover: { A: [2.8, -13.4] } }), L("A", [-1.6, 10.8], "atrás da linha: funda, sem ângulo"),
      L("O", [1.8, -7.8], "bola curta", { mover: { A: [2.2, -9.4] } }), L("A", "angFH", "de dentro pode angular", { fim: true })]),

    /* ── Padrões táticos (leitura) ── */
    PT001: treino({ r: "Ler a bola cruzada: manter a cruzada ou, quando a bola permite, trocar para a paralela.", T: [-2.4, 10.6], bolas: [
      ["fhFunda", "cruzFH", "bola cruzada funda", "mantém a cruzada"], ["fhMeia", "parFH", "bola cruzada mais curta, confortável", "troca para a paralela", { v: 16, ap: 1.7 }]] }),
    PT002: rot({ r: "Depois de cada golpe, recupera para o centro relativo ao próprio golpe, não para o centro da quadra.", at: { A: [2.8, -12.4], P: [-2.8, 12.4] }, cones: [[0.6, -12.3], [-0.5, -12.3]] }, [
      L("A", "cruzFH", "cruzada: recupera um pouco para o lado do forehand", { mover: { A: [0.6, -12.3] } }), L("P", [2.5, -10.8], "devolve cruzado"),
      L("A", "parFH", "paralela: recupera um pouco para o lado do backhand", { mover: { A: [-0.5, -12.3] } }), L("P", [-2.0, -10.8], "devolve cruzado")]),
    PT003: rot({ r: "Pop, push/open e close: profunda que arma, angulada que empurra para fora e a paralela que fecha.", at: { A: Ab, P: [0, 12.4] } }, [
      L("A", "centro", "pop: profunda, arma o ponto", { apice: 3.2 }), L("P", [2.0, -10.0], "devolve"),
      L("A", "angFH", "push/open: angulada cruzada, empurra para fora"), L("P", [1.6, -8.4], "devolve no meio"), L("A", "parFH", "close: muda para a paralela e fecha", { v: 17, apice: 1.6, fim: true })]),
    PT004: rot({ r: "Empurra com bola alta e profunda na paralela, recupera ao centro e muda de direção para fechar.", at: { A: [2.8, -12.5], P: [2.8, 12.5] } }, [
      L("A", "parFH", "alta e profunda na paralela: empurra para trás", { apice: 3.8, mover: { A: [0.3, -12.3] } }), L("P", [0.4, -9.6], "a bola volta mais central"),
      L("A", "cruzFH", "muda a direção e fecha", { v: 17, apice: 1.6, fim: true })]),
    PT005: rot({ r: "Abre a quadra na cruzada, entra num approach e finaliza com o voleio no lado oposto.", at: { A: [2.8, -12.4], P: [-2.8, 12.4] } }, [
      L("A", "angFH", "abre na cruzada, cortando o tempo"), L("P", [0.6, -7.2], "resposta curta"),
      L("A", "parFH", "approach para dentro da quadra", { apice: 1.5, mover: { A: [1.0, -3.8] } }), V("P", "passada", { v: 13, mover: { A: [1.6, -3.6] } }),
      L("A", [-3.2, 7.0], "voleio no lado oposto", { h0: 1.2, apice: 1.4, fim: true })]),
    PT008: rot({ r: "Troca de fundo em que só a profundidade conta: os últimos 2 m antes da linha de base.", at: { A: [0.6, -12.5], P: [-0.6, 12.5] },
      alvos: [z(-4.115, 9.885, 4.115, 11.885, "últimos 2 m"), z(-4.115, -11.885, 4.115, -9.885, "")] }, [
      L("A", [-1.4, 11.0], "profunda, nos últimos 2 m", { apice: 3.0 }), L("P", [1.6, -10.9], "devolve profunda", { apice: 3.0 }),
      L("A", [1.8, 11.1], "profunda de novo", { apice: 3.0 }), L("P", [-1.6, -11.0], "profunda", { apice: 3.0 })]),

    /* ── Avançado ── */
    ADV001: treino({ r: "Construção em 4 bolas: abertura neutra ao centro, cruzada com ângulo, diagonal funda e finalização no espaço aberto.", bolas: [
      ["centro", "centro", "1ª bola", "abertura neutra, profunda ao centro"], ["fh", [-3.4, 7.6], "2ª bola", "construção cruzada com ângulo"],
      ["bh", [2.8, 11.0], "3ª bola", "preparação: diagonal funda"], ["fhMeia", "parFH", "4ª bola", "finalização no espaço aberto", { v: 17, ap: 1.6 }]] }),
    ADV005: rot({ r: "Duas bolas quase juntas, em lados opostos: o atleta escolhe a mais estratégica.", at: { A: Ab, T: [-0.3, 9.8] }, cesto: [0.6, 9.8] }, [
      L("T", "bhFunda", "bola 1, funda no backhand", { pausa: 0, para: null }), L("T", "fhCurta", "bola 2, logo em seguida, curta no forehand", { mover: { A: bx(B.fhCurta) } }),
      L("A", "parFH", "escolhe a curta e ataca", { v: 16, apice: 1.6, fim: true, mover: { A: Ab } })]),
    ADV006: rot({ r: "Mini-tênis tático na metade da quadra (a linha de saque é o fundo): muitas decisões em pouco tempo.", at: { A: [0.6, -7.2], O: [-0.6, 7.2] }, alvos: [z(-4.115, -6.4, 4.115, 6.4, "")] }, [
      L("A", [-2.8, 4.8], "cruzada curta"), L("O", [2.6, -4.6], "devolve"), L("A", [2.8, 2.6], "muda a direção, curta"), L("O", [-3.2, -5.6], "devolve no outro canto")]),
    ADV011: treino({ r: "Inside out agressivo e subida imediata; o treinador manda a bola de finalização na rede.", bolas: [
      ["contorno", "io", "bola no meio", "inside out agressivo e sobe na hora", { contorno: true, v: 17, ap: 1.6, dep: [-0.2, -4.0] }], ["vfh", "vCurtoFH", "bola de finalização", "fecha na rede"]] }),
    ADV012: rot({ r: "Devolução do 2º saque com ataque máximo — devolução neutra não vale.", at: dev("dc") }, [
      S("T", [1.0, -5.2], "2º saque, mais lento", { v: 12, apice: 3.0, mover: { A: [1.4, -9.4] } }),
      L("A", [-3.0, 9.6], "entra e ataca ao máximo", { v: 19, apice: 1.5, fim: true, mover: { A: [2.6, -12.2] } })]),
    ADV013: rot({ r: "Saque, voleio e smash: o treinador simula a devolução e depois o lob.", at: { A: [0.8, -12.3], T: [-1.0, 12.2] } }, [
      S("A", "sAbdc", "saque e subida", { mover: { A: [0.6, -6.8] } }), V("T", "devolução", { hK: 0.9, mover: { A: [0.4, -5.4] } }),
      L("A", [2.8, 9.4], "voleio fundo", { h0: 0.9, apice: 1.5, v: 11, mover: { A: [0.3, -3.2] } }),
      { de: "T", direto: true, txt: "lob", apice: 7.5, hK: 2.8, v: 9, mover: { A: [0.3, -4.6] } }, L("A", "smash", "smash", { tipo: "smash", fim: true })]),
    ADV014: treino({ r: "Drop shot e sprint máximo à rede; o treinador alimenta a resposta do adversário e o atleta cobre.", A: [0.3, -11.6], bolas: [
      ["fhMeia", "dropFH", "bola média", "drop shot e sprint máximo à rede", { ap: 1.5, v: 7, dep: [0.4, -3.4], tT: [-1.4, 3.0] }],
      ["vfh", [3.0, 6.4], "resposta do adversário", "cobre e fecha", { mT: [-1.4, 3.0], tT: [-0.3, 9.8] }]] }),
    ADV017: treino({ r: "Corrida extrema para a defesa e, logo depois, uma bola para atacar.", bolas: [
      [[4.0, -10.6], "alto", "bola no extremo, forçando a corrida", "defesa alta e funda", { vf: 13, ap: 5, v: 11, dep: [0.6, -11.2] }],
      ["centroMeia", "cruzFH", "bola seguinte, em posição ofensiva", "ataca", { v: 17, ap: 1.5 }]] }),
    ADV018: rot({ r: "Rally alternando slice e topspin de propósito; o parceiro tenta identificar qual vem.", at: { A: [-2.8, -12.5], P: [2.8, 12.5] } }, [
      L("A", "cruzBH", "slice (o parceiro tenta adivinhar)", { apice: 1.4, v: 10 }), L("P", [-2.4, -10.8], "devolve"),
      L("A", "cruzBH", "topspin, mesma preparação", { apice: 3.2, v: 13 }), L("P", [-2.4, -10.8], "devolve")]),

    /* ── Brincadeiras com bola ── */
    BR003: treino({ r: "O professor grita a cor na hora de alimentar; ponto para quem acerta o cone da cor certa.", cones: [[-2.8, 11.0], [0, 11.0], [2.8, 11.0]], bolas: [
      ["fh", [-2.8, 10.8], "'vermelho!'", "acerta o cone vermelho"], ["bh", [2.8, 10.8], "'azul!'", "acerta o cone azul"], ["centro", [0, 10.8], "'amarelo!'", "acerta o amarelo"]] }),
    BR004: rot({ r: "Rei da quadra pequena: quem ganha o ponto vira rei.", at: { A: [0.6, -7.2], O: [-0.6, 7.2] }, alvos: [z(-4.115, -6.4, 4.115, 6.4, "")] }, [
      L("A", [-2.6, 4.6], "desafiante joga"), L("O", [2.4, -4.4], "o rei devolve"), L("A", [2.6, 3.0], "busca o ponto", { fim: true })]),
    BR009: rot({ r: "Cada saque que entra derruba uma peça da muralha do time.", at: { A: [0.8, -12.3] }, cones: [[-3.6, 7.0], [-2.4, 7.0], [-1.2, 7.0], [-0.2, 7.0]] }, [
      S("A", "sAbdc", "saque dentro: derruba uma peça", { fim: true, v: 15, pausa: 0.6 }), S("A", "sTdc", "outro saque dentro: mais uma", { fim: true, v: 15, pausa: 0.6 })]),
    BR011: treino({ r: "Bolas profundas e, sem aviso, uma curta: atacada e terminando dentro da quadra vale três.", bolas: [
      ["fhFunda", "centro", "bola profunda", "devolve"], ["bhFunda", "centro", "bola profunda", "devolve"], ["fhCurta", "parFH", "curta, sem aviso!", "ataca e termina dentro: 3 pontos", { v: 16, dep: [0.8, -7.6] }]] }),
    BR014: rot({ r: "Percurso de cones com mudanças de direção, em revezamento; cada volta termina com um golpe.", at: { A: [-3.4, -12.6], T: [-0.3, 9.8] }, cesto: [0.6, 9.8],
      cones: [[-2.0, -11.0], [1.4, -10.0], [-1.4, -8.4], [1.6, -7.2]] }, [
      M("corre até o 1º cone", [-2.0, -10.6]), M("muda de direção", [1.4, -9.6]), M("muda de novo", [-1.4, -8.0]), M("último cone", [1.6, -7.6]),
      L("T", "fhCurta", "bola do professor", { mover: { A: bx(B.fhCurta) } }), L("A", "cruzFH", "golpe e volta para a fila", { fim: true, mover: { A: [-3.4, -12.6] } })]),
    BR015: treino({ r: "Baldes em lugares diferentes: o mais distante vale mais. Dez bolas por criança.",
      alvos: [z(-1.0, 4.4, 0, 5.4, "1"), z(1.8, 7.4, 2.8, 8.4, "2"), z(-3.6, 10.4, -2.6, 11.4, "3")], bolas: [
        ["fh", [-0.5, 4.9], "bola", "no balde perto: 1 ponto", { ap: 1.8, v: 8 }], ["bh", [2.3, 7.9], "bola", "no balde do meio: 2 pontos", { v: 10 }], ["fh", [-3.1, 10.9], "bola", "no balde mais longe: 3 pontos"]] }),
    BR016: rot({ r: "Os dois trocam e o professor conta o tempo até o contato; ganha a dupla que reduzir a contagem sem errar.", at: { A: [2.9, -12.4], P: [-2.9, 12.4] } }, [
      L("A", "cruzFH", "'um, dois...' — bate mais cedo"), L("P", [2.5, -10.6], "devolve", { mover: { A: [2.8, -11.6] } }), L("A", "cruzFH", "contato antes, contagem menor", { apice: 1.8 }), L("P", [2.5, -10.4], "devolve")]),
    BR018: rot({ r: "O professor saca e anuncia no ar se a devolução deve ser bloqueada ou atacada.", at: dev("dc") }, [
      S("T", [1.6, -5.8], "saque: 'bloqueia!'", { v: 16 }), L("A", [-0.2, 10.4], "devolução bloqueada", { apice: 2.0, v: 11, fim: true, mover: { A: [2.6, -12.2] } }),
      S("T", [1.6, -5.8], "saque: 'ataca!'", { v: 16 }), L("A", [-3.0, 9.8], "devolução atacada", { apice: 1.5, v: 18, fim: true, mover: { A: [2.6, -12.2] } })]),
    BR021: rot({ r: "Duplas trocam bolas cooperando e contando em voz alta: a meta é bater o recorde da turma.", at: { A: [0.4, -11.6], P: [-0.4, 11.6] } }, [
      L("A", [-0.6, 9.4], "'um!'", { apice: 2.8, v: 10 }), L("P", [0.6, -9.4], "'dois!'", { apice: 2.8, v: 10 }), L("A", [0.6, 9.6], "'três!'", { apice: 2.8, v: 10 }), L("P", [-0.6, -9.6], "'quatro!'", { apice: 2.8, v: 10 })]),
    BR024: rot({ r: "Vôlei de raquete: sem quique, a bola é devolvida no ar por cima da rede.", at: { A: [0.4, -3.4], P: [-0.4, 3.4] } }, [
      V("A", "devolve no ar", { apice: 2.6, h0: 1.2, v: 7, mover: { P: [1.2, 3.6] } }), V("P", "no ar de novo", { apice: 2.6, h0: 1.2, v: 7, mover: { A: [-0.8, -3.0] } }),
      V("A", "conta o rally", { apice: 2.6, h0: 1.2, v: 7, mover: { P: [-0.6, 3.2] } }), V("P", "mais uma", { apice: 2.6, h0: 1.2, v: 7, mover: { A: [0.4, -3.4] } })]),
    BR026: rot({ r: "Dez saques; cada saque dentro avança uma casa no tabuleiro desenhado no chão.", at: { A: [0.8, -12.3] }, alvos: [z(-4.115, 0.3, 0, 6.4, "dentro")] }, [
      S("A", [-1.6, 5.2], "saque dentro: avança uma casa", { fim: true, v: 14, pausa: 0.6 }), S("A", [-2.8, 4.6], "mais um dentro: outra casa", { fim: true, v: 14, pausa: 0.6 })]),
    BR027: rot({ r: "Os dois começam na meia quadra; quem recuar além da linha de saque perde o ponto.", at: { A: [0.4, -5.4], O: [-0.4, 5.4] }, alvos: [z(-4.115, -6.4, 4.115, -0.3, ""), z(-4.115, 0.3, 4.115, 6.4, "")] }, [
      L("A", [-2.6, 4.6], "troca rápida na meia quadra", { mover: { O: [-2.8, 5.4] } }), L("O", [2.4, -4.4], "devolve", { mover: { A: [2.6, -5.2] } }),
      L("A", [2.8, 5.0], "muda o lado", { mover: { O: [3.0, 5.6] } }), L("O", [-2.0, -5.0], "devolve", { mover: { A: [-2.2, -5.8] } })]),
    BR028: rot({ r: "Antes de cada bola, o jogador aponta com a raquete para onde vai bater; o parceiro tenta cobrir.", at: { A: [2.8, -12.4], P: [0, 12.4] } }, [
      L("A", [-2.8, 10.6], "aponta e bate onde apontou"), L("P", [2.4, -10.6], "o parceiro tentou cobrir"), L("A", [2.8, 10.6], "aponta para o outro canto"), L("P", [2.4, -10.6], "devolve")]),
    BR029: rot({ r: "Toda bola que quica dentro da linha de saque precisa ser atacada.", at: { A: Ab, O: [0, 12.4] }, alvos: [z(-4.115, -6.4, 4.115, -0.3, "ataca")] }, [
      L("O", [2.4, -10.6], "bola funda"), L("A", "cruzFH", "troca"), L("O", [1.6, -5.4], "quicou dentro da linha de saque", { mover: { A: bx([1.6, -5.4]) } }), L("A", "parFH", "ataque obrigatório", { v: 16, fim: true })]),
    BR034: treino({ r: "Argolas numeradas do outro lado: cada acerto vale os pontos do alvo e a dupla soma o tesouro.",
      alvos: [z(-1.0, 3.4, 0.4, 4.8, "10"), z(1.6, 6.8, 3.0, 8.2, "20"), z(-3.6, 9.8, -2.2, 11.2, "30")], bolas: [
        ["fh", [-0.3, 4.1], "bola", "10 pontos", { ap: 1.8, v: 8 }], ["bh", [2.3, 7.5], "bola", "20 pontos", { v: 10 }], ["fh", [-2.9, 10.5], "bola", "30 pontos"]] }),
    BR036: rot({ r: "Duplas trocam por cima da rede contando as trocas, como quem entrega uma encomenda com cuidado.", at: { A: [0, -11.4], P: [0, 11.4] } }, [
      L("A", [0, 9.0], "entrega com cuidado: '1'", { apice: 3.2, v: 8 }), L("P", [0, -9.0], "'2'", { apice: 3.2, v: 8 })]),

    /* ── Coordenação ── */
    CO002: treino({ r: "Rebater para um alvo que o professor desloca durante o voo da bola.", T: [-1.8, 10.4], cesto: false, bolas: [
      ["fh", [1.8, 9.8], "o professor alimenta e corre com o alvo", "rebate para onde o alvo foi", { mT: [-1.8, 10.4], tT: [1.8, 10.6] }],
      ["bh", [-1.8, 9.8], "alimenta e leva o alvo para o outro lado", "rebate para o alvo de novo", { tT: [-1.8, 10.6] }]] }),
    CO004: treino({ r: "Corrida com freada obrigatória e equilíbrio antes do contato.", bolas: [
      ["fhAberta", "cruzFH", "bola larga no forehand", "corre, freia por completo e só então bate"], ["bhAberta", "cruzBH", "bola larga no backhand", "freia, equilibra e bate"]] }),
    CO011: treino({ r: "Dois ajustes obrigatórios de pernas (passos pequenos) antes de cada contato.", bolas: [
      ["fh", "cruzFH", "bola no forehand", "passos pequenos finais e bate"], ["bh", "cruzBH", "bola no backhand", "dois ajustes e bate"]] }),

    /* ── Físico ── */
    CF001: spider("Spider drill cronometrado: busca as 5 bolas partindo do centro e voltando. Meta: menos de 20 segundos."),
    CF002: rot({ r: "Corridas laterais: do centro da linha de base até a linha de simples, de volta ao centro e para o outro lado.", at: { A: [0, -12.0] } }, [
      M("corre até a linha de simples", [3.9, -12.0]), M("volta ao centro", [0, -12.0]), M("vai à outra linha de simples", [-3.9, -12.0]), M("volta ao centro", [0, -12.0])]),
    CF010: rot({ r: "Teste do T: da base ao topo, lateral até uma ponta, lateral até a outra e de volta.", at: { A: [0, -12.4] }, cones: [[0, -12.4], [0, -7.6], [-2.4, -7.6], [2.4, -7.6]] }, [
      M("corre do cone da base ao do topo", [0, -7.6]), M("lateral até a ponta da esquerda", [-2.4, -7.6]), M("lateral até a ponta da direita", [2.4, -7.6]),
      M("volta ao topo", [0, -7.6]), M("retorna à base, de costas", [0, -12.4])]),

    /* ── Mental ── */
    DM009: treino({ r: "Bolas de duas cores: vermelha vai cruzada, amarela vai na paralela; reage à cor assim que vê a bola.", bolas: [
      ["fh", "cruzFH", "bola vermelha", "cruzada"], ["fh", "parFH", "bola amarela", "paralela"]] }),
    DM012: treino({ r: "Três bolas difíceis que forçam o erro e, na 4ª, uma fácil para executar com perfeição.", bolas: [
      ["fhAberta", "alto", "bola difícil 1", "defende como dá", { vf: 13, ap: 4.4 }], ["bhAberta", "alto", "bola difícil 2", "defende", { vf: 13, ap: 4.4 }],
      ["fhFunda", "alto", "bola difícil 3", "defende", { vf: 14, ap: 4.4 }], ["centroMeia", "cruzFH", "4ª bola, fácil", "execução perfeita", { vf: 8, v: 15 }]] }),

    /* ── Duplas ── */
    DP001: rot({ r: "No saque, o parceiro do sacador já está perto da rede, pronto para cobrir o meio.", duplas: true,
      at: { A: [1.4, -12.3], D: [-2.6, -3.8], O: [-3.8, 12.0], Q: [2.4, 6.4] } }, [
      S("A", "sTdc", "saque; o parceiro já está postado na rede", { mover: { A: [1.4, -11.9], D: [-1.6, -3.6] } }), L("O", [2.8, -10.0], "devolução cruzada"),
      L("A", [-3.6, 10.6], "devolve cruzado, longe do parceiro deles", { fim: true })]),
    DP002: rot({ r: "Na devolução, o parceiro do devolvedor fica entre a linha do T e o centro, protegendo o meio.", duplas: true,
      at: { A: [3.4, -12.0], D: [-1.6, -6.6], O: [-1.4, 12.3], Q: [2.6, 3.8] } }, [
      S("O", [2.8, -5.6], "saque"), L("A", [-3.2, 10.0], "devolução cruzada", { mover: { D: [-0.8, -6.4] } }),
      V("O", "bola no meio", { mover: { D: [-0.4, -6.2] } }), L("D", [0.4, 5.0], "o parceiro protege o meio e intercepta", { fim: true })]),
    DP003: rot({ r: "Bolas no meio: a dupla decide e avisa em voz alta quem vai na bola.", duplas: true, at: { A: [2.2, -11.8], D: [-2.2, -11.8], T: [0, 10.0] } }, [
      L("T", [0.2, -9.4], "bola no meio: o atleta grita 'minha!'", { mover: { A: [0.8, -11.6], D: [-1.2, -11.4] } }), L("A", [-3.0, 10.4], "vai na bola", { fim: true, mover: { A: [2.2, -11.8], D: [-2.2, -11.8] } }),
      L("T", [-0.2, -9.4], "outra no meio: agora o parceiro chama", { mover: { D: [-0.6, -11.6], A: [1.2, -11.4] } }), L("D", [2.8, 10.6], "o parceiro vai na bola", { fim: true, mover: { A: [2.2, -11.8], D: [-2.2, -11.8] } })]),
    DP004: treino({ r: "Na rede, bolas rápidas e próximas, alternando os lados: reação curta.", duplas: true, A: [0.6, -2.8], T: [-0.4, 6.6], cesto: [0.6, 6.6], bolas: [
      ["vfh", [-2.4, 4.4], "bola rápida no forehand", "voleio de reflexo", { vf: 14 }], ["vbh", [2.4, 4.6], "bola rápida no backhand", "voleio de reflexo", { vf: 14 }]] }),
    DP005: rot({ r: "Começa atrás da linha de saque, avança com o approach e faz o 1º voleio já perto da rede.", duplas: true,
      at: { A: [2.0, -12.0], D: [-2.4, -3.8], T: [-0.6, 10.4] } }, [
      L("T", [2.0, -7.0], "bola curta", { mover: { A: [2.4, -8.2] } }), L("A", [-3.0, 10.2], "approach", { apice: 1.5, mover: { A: [1.8, -4.2] } }),
      V("T", "passada", { mover: { A: [2.2, -3.6] } }), L("A", [-3.4, 5.0], "1º voleio, já perto da rede", { h0: 1.2, apice: 1.4, fim: true })]),
    DP006: rot({ r: "Lob sobre o jogador da rede: ele recua para o smash e o parceiro cobre o meio que ficou aberto.", duplas: true,
      at: { A: [1.8, -3.6], D: [-1.8, -3.6], O: [-3.6, 11.6], Q: [3.0, 11.6] } }, [
      { de: "O", direto: true, txt: "lob sobre o atleta", apice: 7.5, hK: 2.8, v: 9, mover: { A: [1.6, -6.4], D: [-0.6, -4.6] } },
      L("A", [0.2, 7.0], "smash no meio deles; o parceiro já cobriu o meio", { tipo: "smash", fim: true, mover: { A: [1.8, -3.6], D: [-1.8, -3.6] } })]),
    DP007: rot({ r: "Saque e voleio em dupla: o sacador sobe e encontra o parceiro na rede.", duplas: true,
      at: { A: [1.4, -12.3], D: [-2.4, -3.8], O: [-3.8, 12.0], Q: [2.6, 6.2] } }, [
      S("A", "sTdc", "saque e sobe", { mover: { A: [1.2, -6.8] } }), V("O", "devolução baixa", { hK: 0.9, mover: { A: [1.4, -5.4] } }),
      L("A", [-3.0, 9.6], "1º voleio, fundo e cruzado", { h0: 0.9, apice: 1.5, v: 11, mover: { A: [1.8, -3.8] } }),
      V("O", "bola no parceiro", { mover: { D: [-1.8, -3.6] } }), L("D", [0.4, 6.2], "o parceiro fecha no meio", { h0: 1.2, apice: 1.4, fim: true })]),
    DP008: rot({ r: "Poach: o parceiro saca, o atleta na rede lê a devolução e cruza para fechar; o sacador cobre o lado aberto.", duplas: true,
      at: { A: [-2.4, -3.8], D: [1.4, -12.3], O: [-3.8, 12.0], Q: [2.6, 6.2] } }, [
      S("D", "sTdc", "o parceiro saca", { mover: { D: [1.2, -11.8] } }), V("O", "devolução central, fraca", { v: 11, mover: { A: [-0.2, -3.4], D: [-1.8, -11.6] } }),
      L("A", [0.8, 6.0], "cruza (poach) e fecha no meio", { h0: 1.2, apice: 1.4, fim: true })]),
    DP009: rot({ r: "O devolvedor devolve fundo e já sobe, juntando-se ao parceiro na rede.", duplas: true,
      at: { A: [3.4, -12.0], D: [-1.8, -6.6], O: [-1.4, 12.3], Q: [2.6, 3.8] } }, [
      S("O", [2.8, -5.6], "saque"), L("A", [-3.0, 10.8], "devolução funda e sobe", { apice: 2.0, mover: { A: [1.8, -4.2], D: [-1.8, -4.0] } }),
      V("O", "passada", { mover: { A: [2.0, -3.8] } }), L("A", [0.4, 5.4], "voleio no meio", { h0: 1.2, apice: 1.4, fim: true })]),
    DP010: rot({ r: "Dupla inteira na rede: conforme a bola troca de lado, os dois deslizam juntos, sem deixar o meio vazio.", duplas: true,
      at: { A: [1.8, -3.6], D: [-1.8, -3.6], O: [-3.0, 11.6], Q: [3.0, 11.6] } }, [
      V("O", "bola cruzada: a dupla desliza junta para a direita", { mover: { A: [2.6, -3.6], D: [-0.8, -3.8] } }), L("A", [2.8, 9.4], "voleio fundo"),
      V("Q", "bola do outro lado: os dois deslizam juntos para a esquerda", { mover: { A: [1.0, -3.8], D: [-2.4, -3.8] } }), L("D", [-2.8, 9.0], "voleio do parceiro", { h0: 1.2, apice: 1.4, fim: true })]),
    DP011: rot({ r: "Saque bem largo puxa o devolvedor para fora; o parceiro na rede já antecipa o cruzamento para o espaço aberto.", duplas: true,
      at: { A: [-2.4, -3.8], D: [1.4, -12.3], O: [-3.8, 12.0], Q: [2.6, 6.2] } }, [
      S("D", "sAbdc", "saque bem largo", { mover: { D: [1.0, -11.6] } }), V("O", "devolução de fora da quadra", { v: 11, mover: { A: [0.4, -3.6] } }),
      L("A", [-1.6, 4.6], "cruza e põe no espaço aberto", { h0: 1.2, apice: 1.4, fim: true })]),
    DP012: rot({ r: "Um é puxado para fora numa ponta e o parceiro vai ao centro cobrir o espaço aberto.", duplas: true,
      at: { A: [2.0, -11.6], D: [-2.0, -11.6], O: [-2.0, 11.6], Q: [2.0, 11.6] } }, [
      L("O", [-4.6, -9.6], "bola larga puxa o parceiro para fora", { mover: { D: [-5.2, -11.2], A: [0, -11.4] } }), L("D", [1.2, 10.8], "o parceiro defende funda"),
      L("Q", [0.4, -9.8], "bola no meio que ficou aberto"), L("A", [-3.4, 9.6], "o atleta, já no centro, cobre", { fim: true, mover: { D: [-2.0, -11.6] } })]),
  };
  for (var cod in N) R[cod] = auto(N[cod]);
  if (typeof module === "object" && module.exports) module.exports = R;
  else if (raiz.QLQuadraExercicio) raiz.QLQuadraExercicio.registrar(R);
})(typeof self !== "undefined" ? self : this);
