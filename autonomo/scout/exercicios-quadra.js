/* Roteiros da quadra animada dos exercícios (scout/quadra-exercicio.js) — piloto com 20 exercícios do catálogo MTY.
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
  if (typeof module === "object" && module.exports) module.exports = R;
  else if (raiz.QLQuadraExercicio) raiz.QLQuadraExercicio.registrar(R);
})(typeof self !== "undefined" ? self : this);
