/* Kit de torneio (Observar jogos por voz, áudio no caderno, descritivo, quadro tático) igual nos dois apps de treinador:
   · arquivos compartilhados idênticos (obs-voz.js, quadro.js, a function de áudio e o armazenamento privado);
   · o bloco de componentes do index.html é o mesmo (só a altura da barra do topo muda), e o Team Yoda abre tudo sem plano.
   Rode: node tests/check-sync-kit-torneio.js */
const fs = require("fs"), path = require("path"), assert = require("assert");
const R = path.join(__dirname, "../.."), ler = (f) => fs.readFileSync(path.join(R, f), "utf8");
[["autonomo/obs-voz.js", "mty/obs-voz.js"], ["autonomo/quadro/quadro.js", "mty/quadro/quadro.js"],
  ["autonomo/netlify/functions/audio-treinador.js", "netlify/functions/audio-treinador.js"],
  ["autonomo/netlify/functions/_olhar-armazenamento.js", "netlify/functions/_olhar-armazenamento.js"],
  ["autonomo/netlify/functions/ver-aluno.js", "netlify/functions/ver-aluno.js"]]
  .forEach(([a, b]) => assert.strictEqual(ler(b), ler(a), b + " fora de sincronia com " + a + " (copie o arquivo)"));
const bloco = (h) => { const t = ler(h), a = t.indexOf("/* ── Observar jogos: fundamentos"), b = t.indexOf("function TelaMeuMetodo(", a), c = t.indexOf("const NAV_DIA_A_DIA", a); return t.slice(a, b > 0 ? b : c); };
assert.strictEqual(bloco("mty/index.html"), bloco("autonomo/index.html").replace('position: "sticky", top: 56', 'position: "sticky", top: 52'), "componentes do kit diferentes entre autonomo e mty");
const M = ler("mty/index.html");
assert(/const planoQueLibera = \(\) => null;/.test(M), "Team Yoda: tudo liberado");
["obs-voz.js\"", "{ v: \"observar\", r: \"Observar jogos\" }", "{ v: \"quadro\", r: \"Quadro tático\" }", "aba === \"observar\" ? <TelaObservar", "<CartaoPrioridadesObservadas", "prioridadesObservadasParaPrompt(a)", "nuvem: true", "CartaoObservacaoCaderno key="]
  .forEach((x) => assert(M.includes(x), "mty/index.html sem " + x));
assert(ler("mty/aluno.html").includes("painelObservacoes(d)"), "mty/aluno.html sem as observações do treinador");
assert(!/QuadraLab/.test(ler("mty/quadro/index.html")), "quadro do Team Yoda sem a marca QuadraLab");
console.log("check-sync-kit-torneio: ok");
