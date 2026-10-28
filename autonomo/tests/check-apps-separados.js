/* Treinador e Player validados separados: o app do treinador não se liga ao Player/Competição (Hub, atletas da academia, troca de scouts,
   jogo ao vivo no app do atleta) e o Player, o Competição e a página inicial não oferecem o Hub. O papel Treinador do Competição continua.
   A ponte com o Competição voltou pelo app do treinador (atletas ligados à ficha, jogo ao vivo, troca de scouts), só no Essencial e no Premium.
   Rode: node tests/check-apps-separados.js */
const fs = require("fs"), path = require("path"), assert = require("assert");
const ler = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

const treinador = ler("index.html");
assert(/const LIGACAO_PLAYER = false;/.test(treinador), "index.html: LIGACAO_PLAYER precisa estar false");
/* Hub: desligado. Competição: ligado pelo app do treinador, só nos planos Essencial e Premium (o servidor confere) */
assert(/const LIGACAO_COMPETICAO = true;/.test(treinador) && /competicao: "essencial"/.test(treinador), "index.html: conexão com o Competição no Essencial e Premium");
["{LIGACAO_COMPETICAO && <CartaoVinculoAcademia", "{LIGACAO_COMPETICAO && window.mtyAuth && <CartaoIntercambio", "LIGACAO_PLAYER && { id: \"hub\"",
  "if (!LIGACAO_COMPETICAO) return undefined;\n    let vivo = true;\n    chamarAoVivo({ acao: \"atletas\" })", "if (!LIGACAO_PLAYER || !exigeLogin || !uidAtual) return;",
  "{LIGACAO_PLAYER && <div className=\"qlab-planos-inclusos\" data-venda-hub"].forEach((t) => assert(treinador.includes(t), "index.html: falta a chave em " + t.slice(0, 60)));
assert(!/perfil profissional no QuadraLab Hub/.test(treinador), "index.html: planos ainda citam o perfil no Hub");
assert(!/O que é o perfil profissional no QuadraLab Hub\?/.test(treinador), "index.html: pergunta do Hub ainda nas perguntas frequentes");

for (const f of ["player/index.html", "competicao/index.html", "hub/index.html"]) {
  const t = ler(f);
  assert(!/<script src="[^"]*hub\.js"><\/script>/.test(t.replace(/<script src="\/hub\/[^"]*"><\/script>/g, "")), f + ": ainda carrega o hub.js do Player");
  assert(!t.includes("#/treinadores"), f + ": ainda leva a Encontrar um treinador");
}
const comp = ler("competicao/index.html");
assert(!comp.includes('href="#/atendimentos"'), "competicao/index.html: Meus atendimentos (Hub) ainda no menu");
assert(ler("player/index.html").includes('href="#/atendimentos"'), "player/index.html: Meus atendimentos (Olhar do treinador) precisa continuar");
assert(/\["atleta", "responsavel", "treinador"\]/.test(ler("player/player.js")), "Competição: o papel Treinador continua");
console.log("check-apps-separados: ok");
