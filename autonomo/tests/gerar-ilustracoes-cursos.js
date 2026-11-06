/* Gera as ilustrações dos cursos da Academia Digital (mty/assets/cursos/*.svg).
   · Técnica: o boneco nas 6 fases de cada golpe, a partir da pose de referência da análise de movimento (scout/movimento-motor.js,
     QLBiomec.modeloPadrao), com a fase da aula em destaque; e diagramas (lançamento do saque, devolução, voleio, approach,
     empunhaduras no cabo, os quatro apoios).
   · Tática: quadra vista de cima (cores da quadra animada), com alvos, setas e zonas.
   · Mental: esquemas das rotinas.
   Rode: node tests/gerar-ilustracoes-cursos.js   (ou com --conferir para só checar se os arquivos estão em dia) */
const fs = require("fs"), path = require("path");
const B = require(path.join(__dirname, "../../mty/scout/movimento-motor.js"));
const DIR = path.join(__dirname, "../../mty/assets/cursos");
const COR = { fundo: "#F6F8F7", tinta: "#17251F", cinza: "#5B6B63", linha: "#E2E8E5", quadra: "#3A7B56", fora: "#2A5E43", bola: "#E4F542", atleta: "#E8691F", outro: "#0D3328", verde: "#69B32A", alvo: "rgba(244,255,138,.55)", alvoBorda: "#C9D64A", azul: "#1E5A6B", vermelho: "#C2412F" };
const FONTE = "Inter, system-ui, -apple-system, Segoe UI, sans-serif";
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const n = (v) => Math.round(v * 10) / 10;
function svg(w, h, corpo, titulo) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + " " + h + '" width="' + w + '" height="' + h + '" role="img" aria-label="' + esc(titulo) + '" font-family="' + FONTE + '">' +
    "<title>" + esc(titulo) + "</title>" +
    '<defs><marker id="seta" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker></defs>' +
    '<rect width="' + w + '" height="' + h + '" rx="18" fill="' + COR.fundo + '"/>' + corpo + "</svg>\n";
}
function texto(x, y, t, o) {
  o = o || {};
  return '<text x="' + n(x) + '" y="' + n(y) + '" font-size="' + (o.tam || 15) + '" font-weight="' + (o.peso || 600) + '" fill="' + (o.cor || COR.tinta) + '"' + (o.meio ? ' text-anchor="middle"' : o.fim ? ' text-anchor="end"' : "") + ">" + esc(t) + "</text>";
}

/* ── boneco nas fases ── */
const LIG = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32]];
const LADO_DOM = new Set(["12-14", "14-16", "24-26", "26-28", "28-32", "12-24"]);
function boneco(p, cx, cy, esc1, destaque) {
  const P = (i) => (p[i] ? [cx + p[i].x * esc1, cy + p[i].y * esc1] : null);
  let s = "";
  LIG.forEach(([a, b]) => {
    const A = P(a), C = P(b); if (!A || !C) return;
    const dom = LADO_DOM.has(a + "-" + b) || LADO_DOM.has(b + "-" + a);
    s += '<line x1="' + n(A[0]) + '" y1="' + n(A[1]) + '" x2="' + n(C[0]) + '" y2="' + n(C[1]) + '" stroke="' + (dom ? COR.atleta : COR.tinta) + '" stroke-width="' + (dom ? 5.5 : 4.5) + '" stroke-linecap="round"/>';
  });
  /* raquete: prolonga o antebraço dominante (cotovelo → punho) */
  const co = P(14), pu = P(16);
  if (co && pu) {
    const dx = pu[0] - co[0], dy = pu[1] - co[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    const cabo = [pu[0] + ux * esc1 * 0.28, pu[1] + uy * esc1 * 0.28], cab = [pu[0] + ux * esc1 * 0.62, pu[1] + uy * esc1 * 0.62];
    const ang = Math.atan2(uy, ux) * 180 / Math.PI;
    s += '<line x1="' + n(pu[0]) + '" y1="' + n(pu[1]) + '" x2="' + n(cabo[0]) + '" y2="' + n(cabo[1]) + '" stroke="' + COR.outro + '" stroke-width="3.5" stroke-linecap="round"/>' +
      '<ellipse cx="' + n(cab[0]) + '" cy="' + n(cab[1]) + '" rx="' + n(esc1 * 0.2) + '" ry="' + n(esc1 * 0.13) + '" transform="rotate(' + n(ang) + " " + n(cab[0]) + " " + n(cab[1]) + ')" fill="none" stroke="' + COR.outro + '" stroke-width="3"/>';
  }
  const cab0 = P(0); if (cab0) s += '<circle cx="' + n(cab0[0]) + '" cy="' + n(cab0[1]) + '" r="' + n(esc1 * 0.17) + '" fill="' + COR.fundo + '" stroke="' + COR.tinta + '" stroke-width="4"/>';
  return s;
}
/* pontos extremos do boneco (com a raquete e a cabeça), em unidades da pose */
function extremos(p) {
  const xs = [], ys = [];
  [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28, 31, 32].forEach((i) => { if (p[i]) { xs.push(p[i].x); ys.push(p[i].y); } });
  if (p[0]) { xs.push(p[0].x - 0.17, p[0].x + 0.17); ys.push(p[0].y - 0.17); }
  if (p[14] && p[16]) { const dx = p[16].x - p[14].x, dy = p[16].y - p[14].y, L = Math.hypot(dx, dy) || 1;
    xs.push(p[16].x + dx / L * 0.84); ys.push(p[16].y + dy / L * 0.84); }
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}
function fasesGolpe(golpe, emp, destaque, titulo) {
  const poses = B.modeloPadrao(golpe, emp), nomes = golpe === "saque" ? ["Lançamento", "Troféu", "Armada", "Contato", "Seguimento", "Recuperação"] : ["Preparação", "Giro", "Descida", "Contato", "Terminação", "Recuperação"];
  const W = 600, colW = 200, linH = 255, H = 2 * linH + 56;
  /* cabe no cartão, do topo ao chão: altura útil 198, largura útil 176 */
  const esc1 = Math.min(58, ...poses.map((p) => { const e = extremos(p); return Math.min(198 / (e.y1 - e.y0), 176 / (e.x1 - e.x0)); }));
  let s = texto(20, 34, titulo, { tam: 19, peso: 800 });
  poses.forEach((p, i) => {
    const col = i % 3, lin = Math.floor(i / 3), x0 = col * colW, y0 = 50 + lin * linH, on = destaque.includes(i);
    s += '<rect x="' + (x0 + 8) + '" y="' + (y0 + 4) + '" width="' + (colW - 16) + '" height="' + (linH - 12) + '" rx="14" fill="' + (on ? "#EAF5E1" : "#fff") + '" stroke="' + (on ? COR.verde : COR.linha) + '" stroke-width="' + (on ? 3 : 1.5) + '"/>';
    s += '<line x1="' + (x0 + 24) + '" y1="' + (y0 + 214) + '" x2="' + (x0 + colW - 24) + '" y2="' + (y0 + 214) + '" stroke="' + COR.linha + '" stroke-width="3"/>';
    /* escala comum às 6 fases; pés no chão do cartão e boneco centrado na largura */
    const e = extremos(p), cx = x0 + colW / 2 - ((e.x0 + e.x1) / 2) * esc1, cy = y0 + 210 - e.y1 * esc1;
    s += boneco(p, cx, cy, esc1);
    s += '<circle cx="' + (x0 + 30) + '" cy="' + (y0 + 28) + '" r="13" fill="' + (on ? COR.verde : COR.tinta) + '"/>' + texto(x0 + 30, y0 + 33, String(i + 1), { tam: 13, peso: 800, cor: "#fff", meio: true });
    s += texto(x0 + colW / 2, y0 + 236, nomes[i], { tam: 15, peso: on ? 800 : 600, meio: true, cor: on ? "#2F5F12" : COR.tinta });
  });
  return svg(W, H, s, titulo);
}

/* ── quadra vista de cima (vertical; você embaixo) ── */
const Lq = 11.885, Wq = 4.115, Wd = 5.485, Sq = 6.4;
function quadra(o) {
  o = o || {};
  const W = 360, H = 656, k = 22.5, cx = W / 2, cy = 350;
  const X = (x) => cx + x * k, Y = (y) => cy - y * k;
  let s = '<rect x="10" y="54" width="' + (W - 20) + '" height="' + (H - 64) + '" rx="16" fill="' + COR.fora + '"/>' +
    '<rect x="' + n(X(-Wd)) + '" y="' + n(Y(Lq)) + '" width="' + n(2 * Wd * k) + '" height="' + n(2 * Lq * k) + '" fill="' + COR.quadra + '"/>';
  const ln = (x1, y1, x2, y2, w) => '<line x1="' + n(X(x1)) + '" y1="' + n(Y(y1)) + '" x2="' + n(X(x2)) + '" y2="' + n(Y(y2)) + '" stroke="#fff" stroke-width="' + (w || 2) + '"/>';
  s += ln(-Wd, -Lq, Wd, -Lq) + ln(-Wd, Lq, Wd, Lq) + ln(-Wd, -Lq, -Wd, Lq) + ln(Wd, -Lq, Wd, Lq) + ln(-Wq, -Lq, -Wq, Lq) + ln(Wq, -Lq, Wq, Lq) +
    ln(-Wq, -Sq, Wq, -Sq) + ln(-Wq, Sq, Wq, Sq) + ln(0, -Sq, 0, Sq) + ln(0, -Lq, 0, -Lq + 0.3) + ln(0, Lq, 0, Lq - 0.3);
  s += '<line x1="' + n(X(-Wd - 0.6)) + '" y1="' + cy + '" x2="' + n(X(Wd + 0.6)) + '" y2="' + cy + '" stroke="#DDE5E0" stroke-width="4" stroke-dasharray="2 3"/>';
  return { s, X, Y, k, W, H };
}
/* rótulo legível sobre a quadra: pílula clara atrás do texto */
function rotulo(x, y, t) {
  const w = String(t).length * 7.2 + 14;
  return '<rect x="' + n(x - w / 2) + '" y="' + n(y - 11) + '" width="' + n(w) + '" height="21" rx="10.5" fill="rgba(255,255,255,.92)"/>' + texto(x, y + 4.5, t, { tam: 12.5, peso: 800, meio: true, cor: COR.tinta });
}
const Q = {
  zona(q, x1, y1, x2, y2, rot, cor, onde) { const a = q.X(Math.min(x1, x2)), b = q.Y(Math.max(y1, y2)), w = Math.abs(x2 - x1) * q.k, h = Math.abs(y2 - y1) * q.k;
    return '<rect x="' + n(a) + '" y="' + n(b) + '" width="' + n(w) + '" height="' + n(h) + '" rx="6" fill="' + (cor || COR.alvo) + '" stroke="' + (cor ? "none" : COR.alvoBorda) + '" stroke-width="2" stroke-dasharray="5 4"/>' +
      (rot ? rotulo(a + w / 2, onde === "cima" ? b - 12 : onde === "baixo" ? b + h + 14 : b + h / 2, rot) : ""); },
  jog(q, x, y, rot, cor) { return '<circle cx="' + n(q.X(x)) + '" cy="' + n(q.Y(y)) + '" r="11" fill="' + (cor || COR.atleta) + '" stroke="#fff" stroke-width="2.5"/>' + texto(q.X(x), q.Y(y) + 5, rot, { tam: 12, peso: 800, cor: "#fff", meio: true }); },
  bola(q, x, y, num) { return '<circle cx="' + n(q.X(x)) + '" cy="' + n(q.Y(y)) + '" r="7" fill="' + COR.bola + '" stroke="#2A3410" stroke-width="1.5"/>' + (num ? texto(q.X(x) + 12, q.Y(y) + 5, String(num), { tam: 13, peso: 800, cor: "#fff" }) : ""); },
  seta(q, x1, y1, x2, y2, o) { o = o || {}; const mx = (q.X(x1) + q.X(x2)) / 2 + (o.curva || 0), my = (q.Y(y1) + q.Y(y2)) / 2;
    return '<path d="M' + n(q.X(x1)) + " " + n(q.Y(y1)) + " Q" + n(mx) + " " + n(my) + " " + n(q.X(x2)) + " " + n(q.Y(y2)) + '" fill="none" stroke="' + (o.cor || COR.bola) + '" stroke-width="' + (o.larg || 3) + '"' + (o.trac ? ' stroke-dasharray="7 5"' : "") + ' marker-end="url(#seta)"/>'; },
};
function quebrar(t, max) {
  const out = []; let l = "";
  String(t).split(" ").forEach((p) => { if (l && (l + " " + p).length > max) { out.push(l); l = p; } else l = l ? l + " " + p : p; });
  if (l) out.push(l); return out;
}
function quadraSvg(titulo, desenhar, notas) {
  const q = quadra(); let s = q.s + desenhar(q);
  s = texto(18, 34, titulo, { tam: 19, peso: 800 }) + s;
  let ns = "", y = q.H + 6;
  (notas || []).forEach((t) => {
    const linhas = quebrar(t[1], 40);
    ns += '<circle cx="26" cy="' + (y + 12) + '" r="5.5" fill="' + t[0] + '" stroke="#8FA097" stroke-width="1"/>';
    linhas.forEach((l, j) => { ns += texto(38, y + 17 + j * 19, l, { tam: 14, peso: 600 }); });
    y += linhas.length * 19 + 7;
  });
  return svg(q.W, y + 10, s + ns, titulo);
}

/* ── diagramas simples (cartões com passos) ── */
function passos(titulo, itens, o) {
  o = o || {};
  const W = 600, h = 64, H = 64 + itens.length * (h + 10) + 10;
  let s = texto(20, 36, titulo, { tam: 19, peso: 800 });
  itens.forEach((it, i) => {
    const y = 56 + i * (h + 10);
    s += '<rect x="16" y="' + y + '" width="' + (W - 32) + '" height="' + h + '" rx="14" fill="#fff" stroke="' + COR.linha + '" stroke-width="1.5"/>' +
      '<circle cx="50" cy="' + (y + h / 2) + '" r="17" fill="' + (it[2] || COR.verde) + '"/>' + texto(50, y + h / 2 + 6, o.icone ? o.icone[i] || String(i + 1) : String(i + 1), { tam: 15, peso: 800, cor: "#fff", meio: true }) +
      texto(80, y + 27, it[0], { tam: 16, peso: 800 }) + texto(80, y + 48, it[1], { tam: 13.5, peso: 500, cor: COR.cinza });
  });
  return svg(W, H, s, titulo);
}

const ARQ = {};
/* técnica */
ARQ["fases-forehand"] = fasesGolpe("forehand", "", [], "As seis fases do forehand");
ARQ["forehand-contato"] = fasesGolpe("forehand", "", [3], "Forehand: contato à frente do corpo");
ARQ["backhand2-fases"] = fasesGolpe("backhand", "2", [3], "Backhand de duas mãos: contato mais à frente");
ARQ["backhand1-fases"] = fasesGolpe("backhand", "1", [3, 4], "Backhand de uma mão: braço estendido e contrapeso");
ARQ["saque-fases"] = fasesGolpe("saque", "", [1, 3], "Saque: troféu e contato no ponto mais alto");
ARQ["recuperacao-forehand"] = fasesGolpe("forehand", "", [5], "Recuperação: o começo do golpe seguinte");
ARQ["saque-lancamentos"] = (function () {
  const W = 600, H = 330; let s = texto(20, 34, "Saque: onde lançar a bola (destro, visto de cima)", { tam: 19, peso: 800 });
  s += '<rect x="20" y="52" width="560" height="200" rx="14" fill="' + COR.quadra + '"/><line x1="20" y1="232" x2="580" y2="232" stroke="#fff" stroke-width="3"/>' + texto(300, 248, "linha de base", { tam: 12, peso: 600, cor: "#DDE5E0", meio: true });
  s += '<ellipse cx="300" cy="196" rx="34" ry="18" fill="' + COR.atleta + '" stroke="#fff" stroke-width="2"/>' + texto(300, 201, "você", { tam: 12, peso: 800, cor: "#fff", meio: true });
  s += '<line x1="300" y1="190" x2="300" y2="70" stroke="#fff" stroke-width="2" stroke-dasharray="4 5" opacity=".7"/>' + texto(306, 76, "para a quadra", { tam: 12, peso: 600, cor: "#DDE5E0" });
  [["Plano", 330, 140, "à frente e um pouco à direita"], ["Slice", 392, 158, "mais à direita"], ["Kick", 300, 186, "sobre a cabeça ou um pouco atrás"]].forEach(([r, x, y, d], i) => {
    s += '<circle cx="' + x + '" cy="' + y + '" r="11" fill="' + COR.bola + '" stroke="#2A3410" stroke-width="1.5"/>' + texto(x + 16, y - 8, r, { tam: 15, peso: 800, cor: "#fff" });
    s += texto(40, 280 + i * 18, r + ": " + d, { tam: 14, peso: 600 });
  });
  return svg(W, H + 10, s, "Onde lançar a bola no saque plano, slice e kick");
})();
ARQ["devolucao-posicoes"] = quadraSvg("Devolução: onde ficar", (q) => Q.zona(q, 0.4, -13.25, 4.6, -11.95, "1º saque", "rgba(13,51,40,.75)") + Q.zona(q, 0.4, -11.85, 4.6, -10.55, "2º saque", "rgba(232,105,31,.75)") +
  Q.jog(q, -1.6, 11.6, "S", COR.outro) + Q.seta(q, -1.6, 11.3, 2.6, -5.2, { trac: true, cor: "#fff", larg: 2 }) + Q.seta(q, 2.5, -10.4, 0, 8.6, { curva: -10 }) + Q.zona(q, -1.6, 8.0, 1.6, 10.8, "fundo e centro"),
  [[COR.outro, "1º saque forte: atrás da linha, bloqueie com direção"], [COR.atleta, "2º saque: dentro da quadra, ataque cedo"], [COR.bola, "split no contato do sacador; alvo: fundo e ao centro"]]);
ARQ["voleio-zona"] = quadraSvg("Voleio: a zona de voleio", (q) => Q.zona(q, -4.1, -6.4, 4.1, -2.0, "zona de voleio", "rgba(244,255,138,.35)", "baixo") + Q.jog(q, 0.8, -3.4, "V") + Q.jog(q, -1.5, 9.5, "A", COR.outro) +
  Q.seta(q, 0.8, -6.2, 0.8, -3.9, { cor: "#fff", larg: 2, trac: true }) + Q.seta(q, 0.8, -3.0, -3.0, 7.0, { curva: 8 }),
  [[COR.atleta, "split quando o adversário bate"], [COR.bola, "para a frente e fechando o ângulo, nunca para trás"]]);
ARQ["approach-paralela"] = quadraSvg("Approach na paralela e split", (q) => Q.jog(q, 2.6, -5.6, "A") + Q.seta(q, 2.6, -5.3, 3.2, 9.0, { curva: -6 }) + Q.zona(q, 1.8, 7.0, 4.0, 10.6, "paralela") +
  Q.seta(q, 2.6, -5.6, 1.6, -2.6, { cor: "#fff", larg: 2, trac: true }) + Q.jog(q, 1.6, -2.4, "S", COR.verde) + Q.jog(q, 2.9, 11.4, "O", COR.outro),
  [[COR.bola, "contato na subida, direção paralela (fecha o ângulo da passada)"], [COR.verde, "o approach termina no split na zona de voleio"]]);
ARQ["empunhaduras"] = (function () {
  const W = 600, H = 360; let s = texto(20, 34, "Empunhaduras: o cabo visto de baixo (destro)", { tam: 19, peso: 800 });
  const cx = 170, cy = 200, r = 92, nomes = { 1: "", 2: "Continental", 3: "Eastern", 4: "Semi-western", 5: "Western" };
  let pts = []; for (let i = 0; i < 8; i++) { const a = (-90 + 22.5 + i * 45) * Math.PI / 180; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  s += '<polygon points="' + pts.map((p) => n(p[0]) + "," + n(p[1])).join(" ") + '" fill="#fff" stroke="' + COR.tinta + '" stroke-width="4"/>';
  for (let i = 0; i < 8; i++) { const a = (-90 + i * 45) * Math.PI / 180, num = i + 1, on = num >= 2 && num <= 4;
    s += '<circle cx="' + n(cx + (r - 26) * Math.cos(a)) + '" cy="' + n(cy + (r - 26) * Math.sin(a)) + '" r="14" fill="' + (on ? [COR.verde, COR.azul, COR.atleta][num - 2] : "#E9EEEB") + '"/>' + texto(cx + (r - 26) * Math.cos(a), cy + (r - 26) * Math.sin(a) + 5, String(num), { tam: 13, peso: 800, cor: on ? "#fff" : COR.cinza, meio: true }); }
  texto(cx, cy + 5, "", {});
  s += texto(cx, cy - r - 14, "topo do cabo (face da raquete)", { tam: 12, peso: 600, cor: COR.cinza, meio: true });
  [["2 · Continental", "face 2 · saque, voleio, smash e slice", COR.verde], ["3 · Eastern", "face 3 · contato à frente, na cintura", COR.azul], ["4 · Semi-western", "face 4 · fundo moderno, topspin", COR.atleta]].forEach(([t, d, c], i) => {
    const y = 120 + i * 70; s += '<circle cx="320" cy="' + (y - 5) + '" r="9" fill="' + c + '"/>' + texto(338, y, t, { tam: 16, peso: 800 }) + texto(338, y + 21, d, { tam: 13, peso: 500, cor: COR.cinza });
  });
  s += texto(20, H - 18, "Referência: a base do dedo indicador (e a palma) sobre a face numerada do cabo.", { tam: 13, peso: 600, cor: COR.cinza });
  return svg(W, H, s, "Empunhaduras continental, eastern e semi-western no cabo");
})();
ARQ["apoios"] = (function () {
  const W = 600, H = 300; let s = texto(20, 34, "Os quatro apoios no forehand (destro, visto de cima)", { tam: 19, peso: 800 });
  const pe = (x, y, ang, cor) => '<ellipse cx="' + x + '" cy="' + y + '" rx="11" ry="22" transform="rotate(' + ang + " " + x + " " + y + ')" fill="' + cor + '"/>';
  [["Aberto", "pressão de tempo", 0, [[-22, 0, 35], [26, 0, 20]]], ["Semiaberto", "troca de fundo", 1, [[-18, 14, 40], [24, -12, 25]]], ["Quadrado", "com tempo", 2, [[-16, 28, 60], [20, -24, 60]]], ["Fechado", "bola baixa, slice", 3, [[-6, 34, 75], [22, -28, 80]]]].forEach(([t, d, i, pes]) => {
    const x0 = 22 + i * 142, cx = x0 + 66, cy = 150;
    s += '<rect x="' + x0 + '" y="56" width="132" height="190" rx="14" fill="#fff" stroke="' + COR.linha + '" stroke-width="1.5"/>';
    s += '<line x1="' + (x0 + 12) + '" y1="214" x2="' + (x0 + 120) + '" y2="214" stroke="' + COR.linha + '" stroke-width="3"/>' + texto(cx, 232, "linha de base", { tam: 11, peso: 600, cor: COR.cinza, meio: true });
    s += '<line x1="' + cx + '" y1="92" x2="' + cx + '" y2="70" stroke="' + COR.verde + '" stroke-width="3" marker-end="url(#seta)"/>' + texto(cx + 6, 84, "rede", { tam: 11, peso: 600, cor: COR.verde });
    pes.forEach(([dx, dy, ang], j) => { s += pe(cx + dx, cy + dy, ang, j === 0 ? COR.tinta : COR.atleta); });
    s += texto(cx, 270, t, { tam: 16, peso: 800, meio: true }) + texto(cx, 290, d, { tam: 12.5, peso: 500, cor: COR.cinza, meio: true });
  });
  return svg(W, H + 10, s, "Os quatro apoios: aberto, semiaberto, quadrado e fechado");
})();

/* tática */
ARQ["tat-reconhecer"] = quadraSvg("Que bola você recebeu?", (q) => Q.zona(q, -4.1, -11.9, 4.1, -8.6, "defesa: funda ou correndo", "rgba(194,65,47,.45)") + Q.zona(q, -4.1, -8.6, 4.1, -5.2, "neutra: na cintura, equilibrado", "rgba(244,255,138,.40)") +
  Q.zona(q, -4.1, -5.2, 4.1, -1.2, "ataque: curta ou lenta", "rgba(105,179,42,.55)") + Q.jog(q, 0, -12.7, "A"),
  [[COR.vermelho, "defesa: alta e funda, ou acelerada na cruzada"], ["#C9D64A", "neutra: fundo e ao centro, com margem"], [COR.verde, "ataque: entre na quadra e acelere"]]);
ARQ["tat-neutra"] = quadraSvg("Bola neutra: fundo e ao centro", (q) => Q.jog(q, 1.4, -12.4, "A") + Q.seta(q, 1.4, -12, 0, 8.6, { curva: -8 }) + Q.zona(q, -2.1, 7.0, 2.1, 9.9, "2 m para dentro") + Q.jog(q, 0.4, 12.6, "O", COR.outro),
  [[COR.bola, "fundo e ao centro, com margem sobre a rede"], [COR.alvoBorda, "não tente ganhar o ponto nesta bola"]]);
ARQ["tat-ataque"] = quadraSvg("Bola de ataque: entre e acelere", (q) => Q.bola(q, 1.6, -5.0) + Q.seta(q, 1.4, -12.6, 1.6, -6.2, { cor: "#fff", larg: 2, trac: true }) + Q.jog(q, 1.6, -6.0, "A") +
  Q.seta(q, 1.6, -5.6, -3.4, 10.6, { curva: 6 }) + Q.zona(q, -4.1, 8.8, -2.4, 11.9, "perto da linha") + Q.jog(q, 1.2, 12.6, "O", COR.outro),
  [["#fff", "entre na quadra: contato entre a cintura e o peito"], [COR.bola, "alvo mais perto das linhas"]]);
ARQ["tat-defesa"] = quadraSvg("Bola de defesa: duas respostas", (q) => Q.jog(q, -3.6, -12.6, "A") + Q.seta(q, -3.4, -12.3, 0.4, 10.6, { trac: true, curva: -30, cor: "#fff" }) + Q.seta(q, -3.4, -12.1, 3.4, 7.0, { curva: 20 }) + Q.jog(q, 2.2, 3.2, "O", COR.outro),
  [["#fff", "alta e funda: ganha tempo para voltar"], [COR.bola, "acelerada na cruzada: para o ataque dele"], [COR.verde, "a transição para o ataque é a bola seguinte"]]);
ARQ["tat-arma-converte"] = quadraSvg("A bola que arma e a que converte", (q) => Q.jog(q, 1.2, -12.2, "A") + Q.seta(q, 1.2, -11.8, -2.0, 8.4, { curva: -6 }) + Q.zona(q, -3.0, 7.0, -0.8, 9.9, "1 · segurança") +
  Q.jog(q, -2.0, 11.4, "O", COR.outro) + Q.seta(q, 0.2, -9.6, 3.7, 10.6, { curva: 10, trac: true }) + Q.zona(q, 2.4, 9.0, 4.1, 11.9, "2 · pressão") + Q.bola(q, 0.2, -9.8),
  [[COR.bola, "1 · arma: alvo de segurança, 2 m para dentro"], [COR.alvoBorda, "2 · converte: perto da linha, no espaço aberto"]]);
ARQ["tat-margem"] = (function () {
  const W = 600, H = 330; let s = texto(20, 34, "Margem: a bola profunda nasce da altura", { tam: 19, peso: 800 });
  s += '<line x1="30" y1="210" x2="570" y2="210" stroke="' + COR.quadra + '" stroke-width="6"/><line x1="300" y1="210" x2="300" y2="170" stroke="' + COR.tinta + '" stroke-width="5"/>' + texto(300, 162, "rede", { tam: 12, peso: 700, cor: COR.cinza, meio: true });
  s += texto(40, 232, "você", { tam: 13, peso: 700, cor: COR.cinza }) + texto(560, 232, "fundo do outro lado", { tam: 13, peso: 700, cor: COR.cinza, fim: true });
  s += '<path d="M60 185 Q300 40 540 208" fill="none" stroke="' + COR.verde + '" stroke-width="4" marker-end="url(#seta)"/>';
  s += '<path d="M60 185 Q240 152 400 208" fill="none" stroke="' + COR.vermelho + '" stroke-width="4" stroke-dasharray="8 6" marker-end="url(#seta)"/>';
  s += '<line x1="24" y1="260" x2="52" y2="260" stroke="' + COR.verde + '" stroke-width="4"/>' + texto(62, 265, "alta sobre a rede: cai funda", { tam: 14.5, peso: 800, cor: "#2F5F12" });
  s += '<line x1="24" y1="286" x2="52" y2="286" stroke="' + COR.vermelho + '" stroke-width="4" stroke-dasharray="8 6"/>' + texto(62, 291, "rasante: cai curta ou para na rede", { tam: 14.5, peso: 800, cor: COR.vermelho });
  s += texto(20, 318, "Mire com margem: sobre a rede e para dentro das linhas.", { tam: 14, peso: 600, cor: COR.cinza });
  return svg(W, H, s, "Margem: a bola alta sobre a rede cai funda; a rasante cai curta");
})();
ARQ["tat-ganhar-quadra"] = quadraSvg("Reduzir o tempo e ganhar a quadra", (q) => Q.jog(q, 0.4, -12.6, "A") + Q.seta(q, 0.4, -12.2, 0.4, -9.6, { cor: "#fff", larg: 2, trac: true }) + Q.jog(q, 0.4, -9.4, "A") +
  Q.seta(q, 0.4, -9.0, 0.6, 10.4, { curva: -6 }) + Q.zona(q, -2.0, 8.8, 2.4, 11.9, "funda", null, "baixo") + Q.jog(q, 0.6, 11.4, "O", COR.outro) + Q.seta(q, 0.6, 11.8, 0.6, 13.3, { cor: "#fff", larg: 2, trac: true }),
  [["#fff", "cada bola funda: ele recua um metro, você avança um"], [COR.bola, "pegue a bola mais cedo, jogue mais fundo, ganhe terreno"]]);
ARQ["tat-direcao"] = quadraSvg("Mudar a direção e virar a quadra", (q) => Q.jog(q, 2.8, -12.0, "A") + Q.seta(q, -2.6, 11.0, 2.8, -11.4, { cor: "rgba(255,255,255,.7)", larg: 2, trac: true }) + Q.seta(q, 2.8, -11.6, 3.4, 9.8, { curva: -4 }) +
  Q.jog(q, -0.6, -11.6, "A", COR.verde) + Q.seta(q, -0.4, -11.2, -3.2, 9.4, { curva: 14, trac: true }),
  [[COR.bola, "mude a direção só com bola confortável (cintura-peito, equilibrado)"], [COR.verde, "vire a quadra com a bola que veio para o meio"]]);
ARQ["tat-negar-angulo"] = quadraSvg("Negar ângulo: funda ao centro", (q) => Q.jog(q, -1.0, -12.2, "A") + Q.seta(q, -1.0, -11.8, 0, 9.6, { curva: -4 }) + Q.zona(q, -1.4, 8.2, 1.4, 11.2, "centro") + Q.jog(q, 0, 12.4, "O", COR.outro) +
  Q.seta(q, 0, 12.0, -4.6, -4.0, { cor: "rgba(194,65,47,.8)", larg: 2, trac: true }) + Q.seta(q, 0, 12.0, 4.6, -4.0, { cor: "rgba(194,65,47,.8)", larg: 2, trac: true }),
  [[COR.bola, "bola funda ao centro tira o ângulo dele"], [COR.vermelho, "do centro, os ângulos abertos ficam difíceis"]]);
ARQ["tat-padrao"] = quadraSvg("O padrão: 2 a 4 bolas decididas", (q) => Q.jog(q, 1.2, -12.2, "A") + Q.seta(q, 1.2, -11.8, -2.6, 9.4, { curva: -6 }) + Q.bola(q, -2.6, 9.4, 1) + Q.seta(q, 0.6, -10.4, -3.2, 10.2, { curva: -8, trac: true }) + Q.bola(q, -3.2, 10.2, 2) +
  Q.seta(q, 0.8, -7.6, 3.6, 8.6, { curva: 12 }) + Q.bola(q, 3.6, 8.6, 3),
  [[COR.bola, "1 e 2: cruzadas fundas que armam"], [COR.verde, "3: muda a direção no espaço aberto"]]);

/* mental */
ARQ["men-rotina"] = passos("A rotina de 20 segundos", [["Fechar o ponto", "vire de costas, olhe para as cordas", COR.tinta], ["Respirar", "uma ou mais respirações pela barriga", COR.azul], ["Decidir", "escolha a tática do próximo ponto", COR.verde]]);
ARQ["men-processo"] = passos("Foco no processo", [["Depois de cada ponto", "nomeie uma coisa que você executou bem", COR.verde], ["Ganhou ou perdeu", "não importa: o placar fica de fora", COR.cinza]]);
ARQ["men-respirar"] = passos("Respirar entre os pontos", [["Respiração 1", "pela barriga, devagar", COR.azul], ["Respiração 2", "solte o ar mais devagar do que puxou", COR.azul], ["Respiração 3", "só depois volte para o saque ou a devolução", COR.azul]]);
ARQ["men-erros"] = passos("Voltar depois de erros", [["Bola difícil", "erro induzido: tudo bem", COR.vermelho], ["Bola difícil", "erro induzido: tudo bem", COR.vermelho], ["Bola difícil", "erro induzido: tudo bem", COR.vermelho], ["Bola fácil", "volte à rotina e execute perfeito", COR.verde]], { icone: ["✕", "✕", "✕", "✓"] });
ARQ["men-visualizar"] = passos("Visualização antes do treino", [["Feche os olhos", "5 minutos antes de entrar em quadra", COR.tinta], ["Veja e sinta", "o som da bola, o toque na raquete, o alvo", COR.azul], ["Execute na cabeça", "os exercícios do dia, bem feitos", COR.verde]]);
ARQ["men-checklist-saque"] = passos("Checklist antes do saque", [["Pés", "posição dos pés", COR.tinta], ["Alvo", "olhe para onde vai sacar", COR.azul], ["Respirar", "uma respiração", COR.azul], ["Visualizar", "a trajetória da bola", COR.verde], ["Executar", "e só então sacar", COR.atleta]]);
ARQ["men-balanco"] = passos("O balanço depois do jogo", [["O que funcionou", "decisões e golpes que deram certo", COR.verde], ["O que não funcionou", "sem culpar ninguém", COR.vermelho], ["Por que os erros", "foi decisão ou execução?", COR.azul], ["O que treinar", "1 ou 2 pontos para a próxima semana", COR.tinta]]);

const conferir = process.argv.includes("--conferir");
fs.mkdirSync(DIR, { recursive: true });
let fora = [];
for (const [nome, conteudo] of Object.entries(ARQ)) {
  const f = path.join(DIR, nome + ".svg");
  if (conferir) { if (!fs.existsSync(f) || fs.readFileSync(f, "utf8") !== conteudo) fora.push(nome); }
  else fs.writeFileSync(f, conteudo);
}
if (conferir && fora.length) { console.error("ilustrações fora de dia (rode node tests/gerar-ilustracoes-cursos.js): " + fora.join(", ")); process.exit(1); }
console.log((conferir ? "ilustrações dos cursos em dia: " : "geradas: ") + Object.keys(ARQ).length);
module.exports = { NOMES: Object.keys(ARQ) };
