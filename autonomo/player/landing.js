/* QuadraLab Player — página pública de apresentação (visitante sem login, em /player/).

   Só desenha a página e liga os botões. Entrar e cadastrar continuam sendo as telas do app (#/entrar e #/criar);
   nada aqui toca em conta, dados ou cobrança. As consultorias vêm do servidor (player-publico), a mesma fonte do
   app, então preço, prazo e condições nunca divergem. */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function reais(c) { return (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 }).replace(/ /g, " "); }

  /* capturas reais da plataforma (já sem a barra de status do iPhone), em duas larguras */
  var TELAS = {
    inicio: { alt: "Tela Início do QuadraLab Player: próximo treino, estratégia selecionada, jogadas para praticar e progresso dos treinos." },
    estrategias: { alt: "Tela Estratégias do QuadraLab Player: estratégias contra um adversário específico e para o seu próprio jogo." },
    jogadas: { alt: "Tela Jogadas do QuadraLab Player: sequência de golpes, quando usar e o botão Adicionar ao treino." },
    treinos: { alt: "Tela Treinos do QuadraLab Player: próximo treino agendado, programa de treino e treinos concluídos." },
  };
  function fone(chave, o) {
    o = o || {};
    var t = TELAS[chave], base = "landing/" + chave;
    return '<div class="lp-fone' + (o.grande ? " lp-fone-grande" : "") + '"><div class="lp-fone-tela">' +
      '<img src="' + base + '-420.webp" srcset="' + base + '-420.webp 420w, ' + base + '-840.webp 840w" sizes="' + (o.grande ? "(min-width: 900px) 340px, 270px" : "(min-width: 900px) 300px, 250px") + '" width="420" height="857" alt="' + esc(t.alt) + '" ' +
      (o.topo ? 'fetchpriority="high" decoding="async"' : 'loading="lazy" decoding="async"') + "></div></div>";
  }

  var PASSOS = [
    { n: "01", titulo: "Defina sua estratégia", texto: "Entenda suas características, desenvolva seu estilo de jogo e prepare planos para enfrentar diferentes adversários.", tela: "estrategias" },
    { n: "02", titulo: "Escolha suas jogadas", texto: "Organize sequências táticas, compreenda quando utilizá-las e selecione o que deseja praticar.", tela: "jogadas" },
    { n: "03", titulo: "Transforme em treino", texto: "Estruture programas de treinamento, acompanhe os treinos e registre sua evolução.", tela: "treinos" },
  ];
  var BENEFICIOS = [
    ["Estratégias personalizadas", "Com base no seu perfil e, se quiser, contra um adversário específico."],
    ["Jogadas organizadas por objetivos", "Sequências de golpes, quando usar e o que treinar em cada uma."],
    ["Programas de treinamento estruturados", "Semanas de treino nos dias e na duração que cabem na sua rotina."],
    ["Acompanhamento de progresso", "Marque o que fez em cada treino e veja quantos já foram concluídos."],
    ["Integração entre planejamento e prática", "As jogadas que você escolhe viram os treinos do seu programa."],
  ];

  function cabecalho() {
    return '<header class="lp-topo"><div class="lp-cont lp-topo-in">' +
      '<a class="lp-marca" href="#/" data-lp="topo" aria-label="QuadraLab Player"><picture>' +
        '<source srcset="../assets/logo-quadralab-player-v2-120.webp 518w, ../assets/logo-quadralab-player-v2-240.webp 1035w" sizes="150px" type="image/webp">' +
        '<img src="../assets/logo-quadralab-player-v2-120.png" width="150" height="35" alt="QuadraLab Player"></picture></a>' +
      '<nav class="lp-topo-acoes" aria-label="Acesso"><a class="lp-btn lp-btn-linha" href="#/entrar">Entrar</a></nav></div></header>';
  }
  function hero() {
    return '<section class="lp-hero" aria-labelledby="lp-h1"><div class="lp-cont lp-hero-in"><div class="lp-hero-txt">' +
      '<p class="lp-olho">Tênis com estratégia</p>' +
      '<h1 id="lp-h1">Seu jogo começa com uma <span>estratégia.</span></h1>' +
      '<p class="lp-gratis-hero">Comece gratuitamente. Evolua no seu ritmo.</p>' +
      '<p class="lp-sub">Transforme suas características, estratégias e jogadas em um plano de treinamento inteligente para evoluir dentro de quadra.</p>' +
      '<div class="lp-botoes"><a class="lp-btn lp-btn-branco" href="#/criar">Criar minha conta grátis</a><button type="button" class="lp-btn lp-btn-claro" data-lp="como">Conhecer a plataforma</button></div>' +
      '<ul class="lp-inclui" aria-label="Incluído no cadastro gratuito"><li>Sem cartão de crédito</li><li>Plano de jogo inicial</li><li>Jogadas liberadas</li></ul></div>' +
      '<div class="lp-hero-fone">' + fone("inicio", { grande: true, topo: true }) + "</div></div></section>";
  }
  function comoFunciona() {
    return '<section class="lp-secao lp-como" id="lp-como" aria-labelledby="lp-h2-como"><div class="lp-cont"><h2 id="lp-h2-como" class="lp-h2">Da estratégia ao treino. Tudo conectado.</h2>' +
      '<ol class="lp-passos">' + PASSOS.map(function (p, i) {
        return '<li class="lp-passo' + (i % 2 ? " lp-passo-inv" : "") + '"><div class="lp-passo-txt"><h3><span class="lp-n">' + p.n + "</span> — " + esc(p.titulo) + "</h3><p>" + esc(p.texto) + "</p></div>" +
          '<div class="lp-passo-fone">' + fone(p.tela) + "</div></li>";
      }).join("") + "</ol></div></section>";
  }
  function inteligente() {
    return '<section class="lp-secao lp-intel" id="lp-evolucao-inteligente" aria-labelledby="lp-h2-intel"><div class="lp-cont"><h2 id="lp-h2-intel" class="lp-h2">Evolução Inteligente QuadraLab</h2>' +
      '<p class="lp-intel-sub">Quanto mais você joga, mais informações o QuadraLab utiliza para ajudar a planejar seus próximos desafios.</p>' +
      '<ol class="lp-intel-passos"><li><strong>Você registra</strong><span>Resultados e avaliações dos seus jogos, preenchidos por você.</span></li>' +
      '<li><strong>O QuadraLab considera</strong><span>Seu perfil, os planos anteriores e os seus registros, conforme o seu plano.</span></li>' +
      '<li><strong>Você decide</strong><span>As sugestões chegam como hipóteses, com os motivos. Você aceita ou rejeita; nada muda sozinho.</span></li></ol>' +
      '<p class="lp-intel-nota">Baseada nas informações que você preenche, sem promessa de melhora de desempenho. O registro de partidas e a Evolução Inteligente estão sendo liberados em etapas.</p></div></section>';
  }
  function planos() {
    return '<section class="lp-secao lp-planos" id="lp-planos" aria-labelledby="lp-h2-planos"><div class="lp-cont"><h2 id="lp-h2-planos" class="lp-h2">Escolha como evoluir</h2>' +
      '<p class="lp-sub-claro">Comece de graça, sem cartão de crédito. Mude de plano quando fizer sentido; seus registros ficam com você.</p>' +
      '<div class="lp-planos-lista" id="lpPlanos" aria-live="polite"><p class="lp-carregando-claro">Carregando os planos…</p></div>' +
      '<div class="lp-tabela-wrap" id="lpTabela" hidden></div>' +
      '<p class="lp-planos-nota">Jogadas e sessões de treino não têm limite em nenhum plano. Os planos pagos estarão disponíveis em breve.</p></div></section>';
  }
  function diferenca() {
    return '<section class="lp-secao lp-dif" aria-labelledby="lp-h2-dif"><div class="lp-cont"><h2 id="lp-h2-dif" class="lp-h2">Plataforma e consultorias são coisas diferentes</h2>' +
      '<ul class="lp-dif-lista"><li><strong>O cadastro é gratuito</strong><span>Crie sua conta e use os recursos gratuitos sem pagar nada.</span></li>' +
      '<li><strong>Recursos adicionais, conforme o plano</strong><span>Além do que é gratuito, há recursos que dependem do plano.</span></li>' +
      '<li><strong>Consultorias são opcionais</strong><span>Atendimento individual, contratado separadamente. Você não precisa de consultoria para usar o QuadraLab Player.</span></li></ul></div></section>';
  }
  function evolucao() {
    return '<section class="lp-secao lp-evolucao" aria-labelledby="lp-h2-evo"><div class="lp-cont"><h2 id="lp-h2-evo" class="lp-h2">Sua evolução em um só lugar</h2>' +
      '<ul class="lp-beneficios">' + BENEFICIOS.map(function (b) { return "<li><strong>" + esc(b[0]) + "</strong><span>" + esc(b[1]) + "</span></li>"; }).join("") + "</ul></div></section>";
  }
  function consultorias() {
    return '<section class="lp-secao lp-consul" id="lp-consultorias" aria-labelledby="lp-h2-con"><div class="lp-cont"><h2 id="lp-h2-con" class="lp-h2">Consultorias QuadraLab Player</h2>' +
      '<p class="lp-sub-escuro">Atendimento individual com Richard Tsukada.</p>' +
      '<p class="lp-aviso"><strong>Serviços individuais contratados à parte.</strong> Não estão incluídos na assinatura do QuadraLab Player.</p>' +
      '<div class="lp-consul-lista" id="lpConsultorias" aria-live="polite"><p class="lp-carregando">Carregando as consultorias…</p></div>' +
      '<p class="lp-nota-escura" id="lpNotaConsul" hidden>Preços de lançamento, por contratação, sem renovação automática. Para solicitar, entre ou crie a sua conta gratuita: depois você escolhe o serviço e envia a solicitação.</p></div></section>';
  }
  function final() {
    return '<section class="lp-final" aria-labelledby="lp-h2-fim"><div class="lp-cont lp-final-in"><h2 id="lp-h2-fim">Pare de apenas jogar. Comece a jogar com um plano.</h2>' +
      "<p>Conheça uma nova maneira de organizar sua estratégia, desenvolver suas jogadas e transformar cada treino em uma oportunidade de evolução.</p>" +
      '<a class="lp-btn lp-btn-branco lp-btn-grande" href="#/criar">Começar no QuadraLab Player</a></div></section>';
  }
  function rodape(links) {
    var extra = (links && links.termos ? '<a href="' + esc(links.termos) + '" target="_blank" rel="noopener">Termos de uso</a>' : "") + (links && links.privacidade ? '<a href="' + esc(links.privacidade) + '" target="_blank" rel="noopener">Política de privacidade</a>' : "");
    return '<footer class="lp-rodape"><div class="lp-cont"><p>Tecnologia <strong>QuadraLab</strong> · Metodologia MTY, de Richard Tsukada</p><nav aria-label="Rodapé"><a href="#/entrar">Entrar</a>' + extra + "</nav></div></footer>";
  }

  function html() { return cabecalho() + "<main>" + hero() + comoFunciona() + evolucao() + inteligente() + planos() + diferenca() + consultorias() + final() + "</main>" + rodape(null); }

  function cartaoConsulta(c) {
    var destaque = !!c.selo;
    return '<article class="lp-consul-card' + (destaque ? " lp-consul-destaque" : "") + '" aria-labelledby="lc-' + esc(c.id) + '">' +
      (c.selo ? '<p class="lp-selo">' + esc(c.selo) + "</p>" : "") +
      '<h3 id="lc-' + esc(c.id) + '">' + esc(c.nome) + "</h3>" +
      '<p class="lp-consul-desc">' + esc(c.descricao) + "</p>" +
      '<p class="lp-consul-para"><strong>Indicado para:</strong> ' + esc(c.indicadoPara) + "</p>" +
      (c.regra ? '<p class="lp-consul-regra">' + esc(c.regra) + "</p>" : "") +
      '<ul class="lp-consul-entregas" aria-label="Principais entregas">' + c.principais.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" +
      '<p class="lp-consul-preco"><span class="lp-rotulo">Preço de lançamento</span><strong>' + esc(reais(c.precoCentavos)) + '</strong> <span class="lp-un">' + esc(c.unidadePreco) + " · pagamento único</span></p>" +
      '<p class="lp-consul-prazo"><span class="lp-rotulo">Prazo ou duração</span>' + esc(c.prazoCurto) + "</p>" +
      '<a class="lp-btn ' + (destaque ? "lp-btn-lima" : "lp-btn-verde") + ' lp-btn-cheio" href="#/consultorias/' + esc(c.id) + '/solicitar">' + esc(c.botao) + "</a>" +
      '<p class="lp-ver"><a href="#/consultorias/' + esc(c.id) + '">Ver detalhes<span class="lp-sr"> de ' + esc(c.nome) + "</span></a></p></article>";
  }
  /* ordem comercial: do preço mais acessível ao de maior valor, com o atendimento completo em destaque no fim */
  function ordenar(lista) { return lista.slice().sort(function (a, b) { return a.precoCentavos - b.precoCentavos; }); }

  function cartaoPlano(p) {
    var gratis = p.precoCentavos === 0;
    return '<article class="lp-plano' + (p.destaque ? " lp-plano-destaque" : "") + (gratis ? " lp-plano-free" : "") + '" aria-labelledby="pl-' + esc(p.id) + '">' +
      (gratis ? '<p class="lp-selo lp-selo-claro">Comece aqui</p>' : p.destaque ? '<p class="lp-selo">Recomendado</p>' : "") +
      '<h3 id="pl-' + esc(p.id) + '">' + esc(p.nome) + "</h3><p class=\"lp-plano-para\">" + esc(p.para) + "</p>" +
      '<p class="lp-plano-preco"><strong>' + (gratis ? "R$ 0" : esc(reais(p.precoCentavos))) + '</strong> <span>' + (gratis ? "para sempre" : "por mês") + "</span></p>" +
      '<ul class="lp-plano-itens">' + p.itens.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" +
      (p.disponivel ? '<a class="lp-btn lp-btn-lima lp-btn-cheio" href="#/criar">Criar minha conta grátis</a>'
        : '<button type="button" class="lp-btn lp-btn-linha lp-btn-cheio" disabled aria-disabled="true">Assinatura em breve</button>') + "</article>";
  }
  function tabelaPlanos(planos, linhas) {
    return '<h3 class="lp-tabela-titulo">Compare os planos</h3><div class="lp-tabela-rolagem" tabindex="0" role="region" aria-label="Comparação entre os planos"><table class="lp-tabela"><thead><tr><th scope="col"><span class="lp-sr">Recurso</span></th>' +
      planos.map(function (p) { return '<th scope="col"' + (p.destaque ? ' class="lp-col-destaque"' : "") + ">" + esc(p.nome.replace("Player ", "")) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      linhas.map(function (l, i) { return '<tr><th scope="row">' + esc(l) + "</th>" + planos.map(function (p) { return "<td" + (p.destaque ? ' class="lp-col-destaque"' : "") + ">" + esc(p.comparacao[i]) + "</td>"; }).join("") + "</tr>"; }).join("") +
      '<tr><th scope="row">Jogadas</th>' + planos.map(function (p) { return "<td" + (p.destaque ? ' class="lp-col-destaque"' : "") + ">Acesso completo</td>"; }).join("") + "</tr></tbody></table></div>";
  }
  async function carregarConsultorias() {
    var alvo = document.getElementById("lpConsultorias"), alvoPlanos = document.getElementById("lpPlanos");
    if (!alvo) return;
    try {
      var r = await fetch("/.netlify/functions/player-publico");
      if (!r.ok) throw new Error();
      var dados = await r.json();
      if (!document.getElementById("lpConsultorias")) return;
      if (alvoPlanos && dados.planos && dados.planos.length) {
        alvoPlanos.innerHTML = dados.planos.map(cartaoPlano).join("");
        var tb = document.getElementById("lpTabela"); tb.innerHTML = tabelaPlanos(dados.planos, dados.linhasComparacao || []); tb.hidden = false;
      }
      alvo.innerHTML = ordenar(dados.consultorias || []).map(cartaoConsulta).join("");
      document.getElementById("lpNotaConsul").hidden = false;
      var rod = document.querySelector(".lp-rodape");
      if (rod) rod.outerHTML = rodape(dados.links);
    } catch (e) {
      if (alvoPlanos && !alvoPlanos.querySelector(".lp-plano")) alvoPlanos.innerHTML = '<p class="lp-carregando-claro">Não foi possível carregar os planos agora. <button type="button" class="lp-link" id="lpTentarPlanos">Tentar de novo</button></p>';
      var tp = document.getElementById("lpTentarPlanos"); if (tp) tp.addEventListener("click", carregarConsultorias);
      alvo.innerHTML = '<p class="lp-carregando">Não foi possível carregar as consultorias agora. <button type="button" class="lp-link" id="lpTentar">Tentar de novo</button></p>';
      var t = document.getElementById("lpTentar"); if (t) t.addEventListener("click", carregarConsultorias);
    }
  }

  var ouvinte = null;
  function ligar(raiz) {
    if (ouvinte) raiz.removeEventListener("click", ouvinte);
    ouvinte = function (ev) {
      var a = ev.target.closest("[data-lp]");
      if (!a) return;
      ev.preventDefault(); // rolagem dentro da página: não mexe no endereço (que é a rota do app)
      if (a.getAttribute("data-lp") === "como") { var s = document.getElementById("lp-como"); if (s) s.scrollIntoView({ behavior: "smooth", block: "start" }); }
      else window.scrollTo({ top: 0, behavior: "smooth" });
    };
    raiz.addEventListener("click", ouvinte);
    carregarConsultorias();
  }

  window.QL_LANDING = { html: html, ligar: ligar };
})();
