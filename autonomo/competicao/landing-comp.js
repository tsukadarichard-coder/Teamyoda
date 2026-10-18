/* QuadraLab Competição — página de apresentação (visitante sem login). Os botões levam ao cadastro e à entrada do app. */
(function () {
  window.QL_COMP_LANDING = {
    html: function () {
      return '<div class="cl-topo"><div class="cl-cont">' +
        '<header class="cl-nav"><span class="cl-logo"><img src="../assets/logo-quadralab-competicao-v3-120.png" srcset="../assets/logo-quadralab-competicao-v3-120.png 518w, ../assets/logo-quadralab-competicao-v3-240.png 1035w" sizes="140px" width="140" height="34" alt="QuadraLab Competição"></span>' +
        '<span><a class="cl-entrar" href="#/entrar">Entrar</a> <a class="cl-btn lima" href="#/criar">Criar conta</a></span></header>' +
        '<div class="cl-hero"><div class="cl-hero-txt"><span class="comp-kicker">Para quem joga torneios</span>' +
        '<h1>Cada torneio, <em>preparado.</em></h1>' +
        '<p class="cl-sub">Calendário da temporada, preparação por partida e diário num só lugar. O treinador e a família veem só o que o atleta permitir.</p>' +
        '<div class="cl-cta"><a class="cl-btn argila" href="#/criar">Montar minha temporada</a><a class="cl-btn contorno" href="#/criar">Sou treinador ou responsável</a></div></div>' +
        '<div class="comp-hero" aria-hidden="true"><div class="cl-mini"><span class="comp-kicker">Exemplo ilustrativo</span><div class="comp-count"><span class="comp-num">2</span><span class="comp-un">dias</span></div><h2>Torneio de exemplo</h2><p>Dados de demonstração, não são reais</p></div>' +
        '<ol class="cl-prior"><li>Servir no T do deuce</li><li>Devolução funda</li><li>Subir na bola curta</li></ol></div></div></div></div>' +
        '<div class="cl-cont"><section class="cl-sec"><h2>Do calendário à quadra</h2><div class="cl-cards">' +
        '<div class="cl-card"><b>01</b><h3>Sua temporada</h3><p>Cadastre cada torneio com datas e prazo de inscrição, receba lembretes e leve tudo para o calendário do celular.</p></div>' +
        '<div class="cl-card"><b>02</b><h3>Preparação por partida</h3><p>Até três prioridades, o padrão de jogo e o que você espera do adversário. Depois, registre o que funcionou.</p></div>' +
        '<div class="cl-card"><b>03</b><h3>Devolutiva e treino</h3><p>Receba o olhar do treinador e leve o que ficou difícil no jogo para o foco do próximo treino.</p></div>' +
        '<div class="cl-card"><b>04</b><h3>Meu planejamento</h3><p>Temporada, próximas quatro semanas e a semana atual, organizadas pelo seu calendário e pela sua rotina. Uma sugestão inicial para o treinador revisar e aprovar.</p></div>' +
        '<div class="cl-card"><b>05</b><h3>Acompanhamento MTY</h3><p>Programa remoto de 3 meses com avaliação inicial, encontros mensais, revisão semanal dos seus registros e canal de dúvidas.</p></div></div></section>' +
        '<section class="cl-sec"><div class="cl-priv"><div><span class="comp-kicker">Privacidade em primeiro lugar</span><h2>Cada pessoa vê só o que você permitir</h2>' +
        '<p>Treinador e responsável entram por um código que o atleta gera. Para atletas menores de idade, o responsável aprova o treinador. Qualquer lado pode encerrar o vínculo a qualquer momento.</p></div>' +
        '<div class="cl-perm"><div>Temporada e torneios<span class="cl-tag">Compartilhado</span></div><div>Estratégia por partida<span class="cl-tag">Compartilhado</span></div><div>Diário pessoal<span class="cl-tag priv">Privado</span></div></div></div></section>' +
        '<section class="cl-fim"><h2>Monte a sua temporada</h2><p>Leva menos de um minuto para começar.</p><p><a class="cl-btn escuro" href="#/criar">Criar minha conta</a></p></section>' +
        '<footer class="cl-rodape"><span>Tecnologia <strong>QuadraLab</strong> · Metodologia MTY, de Richard Tsukada</span><span>Os dados de torneios são cadastrados pelo atleta. Confirme sempre no site oficial.</span></footer></div>';
    },
    ligar: function () {}
  };
})();
