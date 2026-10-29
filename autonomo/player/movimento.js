/* QuadraLab Player — análise biomecânica (análise de movimento) do jogador, em #/movimento.

   A tela é a mesma do app do treinador (scout/movimento.js, Tecnologia QuadraLab): a análise roda no aparelho e o vídeo não é
   enviado. O resumo e o relatório completo ficam na conta do jogador (servidor player-movimento), que também decide o limite:
   no plano gratuito, 1 análise de cada golpe (forehand, backhand e saque); nos planos pagos, sem limite. */
(function () {
  var A = window.QL_APP;
  if (!A || window.QL_MODO === "competicao") return;
  var esc = A.esc, tela = A.tela;
  var NOME = { forehand: "forehand", backhand: "backhand", saque: "saque" };
  var carregou = null;

  /* motor, tela e estilo da análise: só quando o jogador abre a página */
  function carregarModulos() {
    if (carregou) return carregou;
    function script(src) { return new Promise(function (ok, falha) { var s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = function () { falha(new Error("Não foi possível carregar a análise. Verifique sua conexão.")); }; document.head.appendChild(s); }); }
    if (!document.querySelector('link[href="../scout/movimento.css"]')) { var l = document.createElement("link"); l.rel = "stylesheet"; l.href = "../scout/movimento.css"; document.head.appendChild(l); }
    carregou = (window.QLBiomec ? Promise.resolve() : script("../scout/movimento-motor.js")).then(function () { return window.QLMovimento ? null : script("../scout/movimento.js"); })
      .catch(function (e) { carregou = null; throw e; });
    return carregou;
  }

  function textoCota(c, g) {
    if (!c || c.limite == null) return null;
    var nome = NOME[g];
    return {
      limite: c.limite, usados: c.usadas, restantes: Math.max(0, c.limite - c.usadas), liberado: c.liberado,
      texto: c.liberado ? "Plano gratuito: você tem 1 análise de " + nome + ". Ela fica salva com o relatório; para analisar este golpe de novo depois, amplie o plano."
        : "Você já usou a análise gratuita de " + nome + ". Seus relatórios continuam aqui; para analisar este golpe de novo, amplie o plano.",
    };
  }

  async function telaMovimento() {
    tela('<p class="carregando">Carregando a análise de movimento…</p>', true);
    var d;
    try { var r = await Promise.all([A.api("player-movimento"), carregarModulos()]); d = r[0]; }
    catch (e) {
      tela('<div class="pilha"><div class="aviso">' + esc(e.message) + '</div><div class="acoes"><button class="btn btn-primario" id="btTentarMov" type="button">Tentar de novo</button></div></div>');
      document.getElementById("btTentarMov").addEventListener("click", telaMovimento);
      return;
    }
    var cota = d.cota || { plano: "pago", porGolpe: {} }, free = cota.plano === "free";
    var nome = (A.dados && A.dados() && A.dados().perfil && A.dados().perfil.nome) || "";
    tela('<h1>Análise de movimento</h1>' +
      '<p class="nota" style="margin-top:6px">Filme um golpe (forehand, backhand ou saque) e veja o checklist por fase, os pontos fortes e o que treinar. A análise roda no seu celular: o vídeo não é enviado.</p>' +
      (free ? '<div class="cartao compacto" style="margin-top:12px" data-mov="free"><p><strong>Plano gratuito:</strong> 1 análise de cada golpe — forehand, backhand e saque.</p>' +
        '<p class="nota" style="margin-top:4px">Nos planos pagos, a análise de movimento não tem limite.</p><div class="acoes"><a class="btn btn-secundario" href="#/assinaturas">Comparar planos</a></div></div>' : "") +
      '<div id="movArea" style="margin-top:14px"></div>');
    var logo = new URL("../assets/logo-quadralab.png", location.href).href;
    var salvando = Promise.resolve();
    var arquivo = {
      /* o relatório só entra depois do resumo salvo (é o resumo que conta no limite) */
      salvar: function (aluno, arq) { return salvando.then(function () { return A.api("player-movimento", { metodo: "POST", corpo: { acao: "relatorio", id: arq.id, relatorio: JSON.stringify(arq) } }); }); },
      ler: function (id) { return A.api("player-movimento?id=" + encodeURIComponent(id)).then(function (r) { return r.relatorio; }); },
      indice: function () { return Promise.resolve({ itens: d.analises || [], removidos: [] }); },
      registrar: function () { return Promise.resolve(); },
      remover: function () { return Promise.resolve(); },
    };
    window.QL_MOVIMENTO = window.QLMovimento.montar(document.getElementById("movArea"), {
      atleta: nome, alunoId: "eu", historico: d.analises || [], logo: "../assets/logo-quadralab.png", logoAbsoluto: logo, arquivo: arquivo,
      modelos: false, /* no Player: modelo padrão e as próprias análises; modelos da academia são do app do treinador */
      cotaGolpe: function (g) { return textoCota(cota.porGolpe[g], g); },
      aoSalvar: function (reg) {
        salvando = A.api("player-movimento", { metodo: "POST", corpo: { acao: "salvar", resumo: reg } })
          .then(function (r) { if (r.cota) cota = r.cota; })
          .catch(function (e) { e.publico = true; throw e; });
        return salvando;
      },
      aoRemover: function (id) { return A.api("player-movimento", { metodo: "POST", corpo: { acao: "remover", id: id } }); },
    });
  }

  A.registrarHub({ movimento: telaMovimento });
})();
