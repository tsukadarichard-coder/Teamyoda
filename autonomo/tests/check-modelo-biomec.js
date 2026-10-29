/* Modelo de referência da análise biomecânica: o modelo padrão de cada golpe cumpre os itens do próprio checklist que dependem da
   técnica (não dos ajustes de faixa do treinador); o encaixe no atleta respeita quadril, tamanho do tronco, sentido do golpe e
   canhotos; uma análise salva vira modelo e volta igual. Rode: node tests/check-modelo-biomec.js */
const a = require("assert");
const B = require("../scout/movimento-motor.js");
const R = B.REGRAS;
const med = (lm) => B.medidas({ lm: lm.map((p) => p || { x: NaN, y: NaN, v: 0 }) }, "D", 1);

/* forehand */
let m = B.modeloPadrao("forehand").map(med);
a.ok(m[1].antebracoND <= R.antebracoNaoDominante.max, "forehand: braço não dominante paralelo no giro (" + m[1].antebracoND + ")");
a.ok(m[3].contatoFrente >= R.contatoFrente.min, "forehand: contato à frente");
a.ok(m[3].alturaContato >= -0.2 && m[3].alturaContato <= 0.9, "forehand: altura do contato");
a.ok(m[3].joelhos - m[1].joelhos > 10, "forehand: extensão de pernas até o contato");
a.ok(m[1].largOmbros > m[0].largOmbros + 0.3, "forehand: ombros giram na preparação");
a.ok(m[1].joelhos < m[0].joelhos, "forehand: carrega as pernas no giro");
a.ok(Math.abs(m[1].joelhos - R.joelhos.alvo) <= R.joelhos.tol && Math.abs(m[1].tronco - R.tronco.alvo) <= R.tronco.tol, "forehand: joelhos e tronco do giro dentro das faixas padrão (" + Math.round(m[1].joelhos) + "°, " + Math.round(m[1].tronco) + "°)");
/* backhand de duas mãos e de uma mão */
m = B.modeloPadrao("backhand", "2").map(med);
a.ok(m[1].distMaos <= R.backhand.duasMaos.max, "backhand 2 mãos: mãos juntas no giro");
a.ok(Math.abs(m[3].largOmbros - m[1].largOmbros) >= R.backhand.rotacao.min, "backhand: rotação dos ombros");
a.ok(m[3].contatoFrente >= R.contatoFrente.min, "backhand 2 mãos: contato à frente");
m = B.modeloPadrao("backhand", "1").map(med);
a.ok(m[3].ndAtras >= R.backhand.ndAtras.min, "backhand 1 mão: braço não dominante como contrapeso");
/* saque */
m = B.modeloPadrao("saque").map(med);
const S = R.saque;
a.ok(m[1].cotoveloND >= S.cotoveloLancamento.min && m[1].alturaPunhoNDCabeca >= 0.4, "saque: lançamento estendido e alto");
a.ok(Math.abs(m[2].joelhos - S.joelhosArmada.alvo) <= S.joelhosArmada.tol && Math.abs(m[2].cotoveloDom - S.cotoveloArmada.alvo) <= S.cotoveloArmada.tol, "saque: armada");
a.ok(m[3].cotoveloDom >= S.cotoveloContato.min && m[3].alturaPunhoCabeca >= S.alturaContato.min && m[3].frenteCabeca >= S.frenteCabeca.min, "saque: contato alto, estendido e à frente");
a.ok(m[3].joelhos - m[2].joelhos >= S.extensaoJoelhos.min, "saque: extensão de pernas");

/* encaixe no atleta: quadril no lugar, tronco do mesmo tamanho, sentido do golpe, canhoto troca os lados */
const r = B.checklist(B.sintetico(60, "D"), "D"); r.proporcao = 1;
const fase = r.fases[3], pose = fase.pose;
const quad = (p) => [(p[23][0] + p[24][0]) / 2, (p[23][1] + p[24][1]) / 2];
const tronco = (p) => Math.hypot((p[11][0] + p[12][0]) / 2 - quad(p)[0], (p[11][1] + p[12][1]) / 2 - quad(p)[1]);
const al = B.alinharModelo(B.modeloPadrao("forehand")[3], pose, 1, 1, "D").map((p) => p && [p.x, p.y]);
a.ok(Math.abs(quad(al)[0] - quad(pose)[0]) < 1e-9 && Math.abs(quad(al)[1] - quad(pose)[1]) < 1e-9, "quadril do modelo no quadril do atleta");
a.ok(Math.abs(tronco(al) - tronco(pose)) / tronco(pose) < 0.12, "tronco do modelo do tamanho do atleta");
a.ok(al[16][0] > quad(al)[0], "golpe para a frente (direita)");
const esq = B.alinharModelo(B.modeloPadrao("forehand")[3], pose, 1, -1, "E").map((p) => p && [p.x, p.y]);
a.ok(esq[15][0] < quad(esq)[0], "canhoto golpeando para a esquerda: punho esquerdo à frente");
a.ok(Math.abs(esq[15][1] - al[16][1]) < 1e-9, "canhoto: o braço do golpe é o esquerdo");

/* análise salva como modelo: ida e volta */
const mod = B.modeloDeResultado(r, "D");
a.strictEqual(mod.length, 6);
const volta = B.alinharModelo(mod[3], pose, 1, r.direcao, "D");
a.ok(Math.abs(volta[16].x - pose[16][0]) < 1e-3 && Math.abs(volta[16].y - pose[16][1]) < 1e-3, "modelo da própria análise volta à mesma pose");
const comp = B.compararModelo(r, "D", mod);
a.ok(comp[3].linhas.length >= 4 && comp[3].linhas.every((l) => Math.abs(l.atleta - l.modelo) < 0.5), "comparação com o próprio modelo: diferença zero");
a.ok(B.compararModelo(r, "D", B.modeloPadrao("forehand"))[3].linhas.some((l) => l.chave === "cotoveloDom"), "comparação com o padrão traz o cotovelo");
/* animação: pose do modelo no tempo, entre as fases */
const meio = B.poseNoTempo(mod, r.fases, (r.fases[2].t + r.fases[3].t) / 2);
a.ok(meio[16].x > Math.min(mod[2][16].x, mod[3][16].x) - 1e-9 && meio[16].x < Math.max(mod[2][16].x, mod[3][16].x) + 1e-9, "pose interpolada entre as fases");
console.log("check-modelo-biomec: ok");
