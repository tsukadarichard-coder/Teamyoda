/* Imagens das fases em todo relatório de análise de movimento: a pose de cada fase vai no resultado; sem a foto do vídeo, o relatório
   mostra o desenho da pose; o relatório do atleta traz as imagens de cada análise (também as publicadas antes de guardarem o id).
   Rode: node tests/check-imagens-fases.js */
const a = require("assert");
global.window = global;
const B = require("../scout/movimento-motor.js");
window.QLBiomec = B;
require("../scout/movimento.js");
const M = window.QLMovimento;

/* 1. a pose de cada fase fica no resultado (forehand e saque) */
const r = B.checklist(B.sintetico(60, "D"), "D");
a.ok(r.fases.every((f) => Array.isArray(f.pose) && f.pose.length === 33 && f.pose.filter(Boolean).length >= 13), "pose em cada fase");
a.ok(r.fases[0].pose[11].every((v) => typeof v === "number" && Math.round(v * 1000) / 1000 === v), "pose compacta (3 casas)");
const sq = B.checklist(B.sintetico(70, "D", "saque"), "D", null, "saque");
a.ok(sq.fases.every((f) => f.pose && f.pose.some(Boolean)), "pose no saque");
a.ok(JSON.stringify(r.fases.map((f) => f.pose)).length < 8000, "pose leve no relatório");

/* 2. imagem de cada fase: foto quando existe, senão a pose */
r.proporcao = 1.778;
const fotos = ["data:image/jpeg;base64,AAA", "", "data:image/jpeg;base64,BBB"];
const im = M.imagensFases(r, fotos);
a.strictEqual(im.length, 6);
a.deepStrictEqual(im.map((x) => x.foto), [true, false, true, false, false, false]);
a.ok(im[1].src.startsWith("data:image/svg+xml") && decodeURIComponent(im[1].src).includes("<line") && decodeURIComponent(im[1].src).includes('height="853"'), "pose desenhada na proporção do vídeo");
const antigo = JSON.parse(JSON.stringify(r)); antigo.fases.forEach((f) => { delete f.pose; });
a.ok(M.imagensFases(antigo, []).every((x) => x.src === ""), "análise antiga sem pose: sem imagem");

/* 3. relatório: sem nenhuma foto, ainda tem uma imagem por fase */
const html = M.relatorioHTML({ resultado: r, golpe: "forehand", emp: "", dom: "D", fotos: [], logo: "x.png" });
a.strictEqual((html.match(/<img src="data:image\/svg\+xml/g) || []).length, 6, "6 imagens de pose");
a.ok(/pose detectada naquele momento/.test(html));
const html2 = M.relatorioHTML({ resultado: r, golpe: "forehand", emp: "", dom: "D", fotos: fotos, logo: "x.png" });
a.strictEqual((html2.match(/<img src="data:image\/jpeg/g) || []).length, 2, "fotos do vídeo quando existem");
a.ok(/antes de o app guardar as imagens/.test(M.relatorioHTML({ resultado: antigo, golpe: "forehand", emp: "", dom: "D", fotos: [], logo: "x.png" })));

/* 4. relatório do atleta com as imagens de cada análise */
const R = require("../../mty/relatorio-atleta.js");
const movs = [{ id: "mv1", criadoEm: "2026-10-05T10:00:00Z", golpe: "forehand", emp: "", res: { ok: 5, atencao: 3 }, prio: ["Giro"] }];
const rel = R.coletar({ id: "a1", nome: "Ana", registros: [] }, movs, { tipo: "mes", mes: "2026-10" });
a.strictEqual(rel.movimentos[0].id, "mv1", "o relatório guarda o id da análise");
const arqs = { mv1: { resultado: r, fotos: [] } };
(async () => {
  const imgs = await R.imagensMovimentos(rel, async (id) => arqs[id] || null, movs);
  a.strictEqual(imgs.mv1.length, 6);
  const h = R.html(rel, { imagensMov: imgs });
  a.strictEqual((h.match(/<img src="data:image\/svg\+xml/g) || []).length, 6, "6 imagens no relatório do atleta");
  a.ok(/class="rel-fases"/.test(h) && /1\. /.test(h));
  /* relatório publicado antes de guardar o id: acha a análise pela data e golpe */
  const antigoRel = JSON.parse(JSON.stringify(rel)); delete antigoRel.movimentos[0].id;
  const imgs2 = await R.imagensMovimentos(antigoRel, async (id) => arqs[id] || null, movs);
  a.strictEqual((R.html(antigoRel, { imagensMov: imgs2 }).match(/<img src=/g) || []).length, 6, "relatório antigo também ganha as imagens");
  a.ok(!/<img/.test(R.html(rel, {})), "sem imagens carregadas, o relatório sai sem quebrar");
  console.log("check-imagens-fases: ok");
})().catch((e) => { console.error(e); process.exit(1); });
