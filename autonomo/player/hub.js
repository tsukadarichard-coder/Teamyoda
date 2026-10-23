/* QuadraLab Hub no Player (laranja) e na Competição (azul): encontrar um treinador, ver o perfil, pedir atendimento e acompanhar em Meus atendimentos.

   Usa as utilidades de player.js (window.QL_APP) e o servidor hub-busca / hub-atendimentos. Nada aqui inventa dados: os perfis, serviços,
   avaliações e pedidos vêm do servidor, que confere quem pode ver e fazer o quê. A localização do aparelho só é usada quando a pessoa toca
   em "Usar minha localização" e serve apenas para sugerir o nome da cidade mais próxima (nada é enviado além do nome da cidade escolhida). */
(function () {
  var A = window.QL_APP;
  if (!A) return;
  var esc = A.esc, tela = A.tela, toast = A.toast, ocupado = A.ocupado, ir = A.ir;
  var COMP = window.QL_MODO === "competicao";
  var DIAS = { seg: "Seg", ter: "Ter", qua: "Qua", qui: "Qui", sex: "Sex", sab: "Sáb", dom: "Dom" };
  var TURNOS = { manha: "Manhã", tarde: "Tarde", noite: "Noite" };
  var OBJ = { comecar: "Começar a jogar", tecnica: "Melhorar a técnica", tatica: "Melhorar tática e estratégia", regularidade: "Jogar com regularidade", torneios: "Preparar para torneios", temporada: "Planejar a temporada" };
  var OBJ_ORDEM = COMP ? ["torneios", "temporada", "tatica", "tecnica", "regularidade", "comecar"] : ["comecar", "tecnica", "regularidade", "tatica", "torneios", "temporada"];
  var NIVEIS = { iniciante: "Iniciante", intermediario: "Intermediário", avancado: "Avançado", competicao: "Competição" };
  var PUBLICOS = { criancas: "Crianças", juvenis: "Juvenis", adultos: "Adultos" };
  var UNIDADES = { aula: "por aula", pessoa: "por pessoa", pacote: "por pacote", mes: "por mês" };
  var CATS = [["aula_individual", "Aula individual"], ["aula_dupla", "Aula em dupla"], ["aula_grupo", "Aula em grupo"], ["iniciacao", "Iniciação ao tênis"], ["aperfeicoamento", "Aperfeiçoamento técnico e tático"],
    ["torneios", "Preparação para torneios"], ["temporada", "Planejamento da temporada"], ["remoto", "Acompanhamento remoto"], ["estrategia", "Orientação de estratégia"]];
  if (COMP) CATS = CATS.slice(5).concat(CATS.slice(0, 5));
  var TXT_ENVIO = "Seu pedido será enviado a este profissional. Disponibilidade, valor e condições serão combinados diretamente.";
  var TXT_ENVIADO = "Pedido enviado. Você poderá acompanhar a resposta em Meus atendimentos.";
  var TXT_ACEITE = "Você está confirmando as condições combinadas com o profissional. O pagamento será realizado diretamente com ele.";
  var MOTIVOS = { informacao_falsa: "Informação falsa ou enganosa", conduta: "Conduta inadequada", assedio: "Assédio ou ofensa", spam: "Spam ou propaganda", menor: "Risco a menor de idade", outro: "Outro motivo" };
  /* cidades para sugerir a partir da localização (só no aparelho; nunca enviamos coordenadas) */
  var CIDADES = [["São Paulo", "SP", -23.55, -46.63], ["Campinas", "SP", -22.91, -47.06], ["Santos", "SP", -23.96, -46.33], ["São José dos Campos", "SP", -23.18, -45.88], ["Ribeirão Preto", "SP", -21.18, -47.81], ["Sorocaba", "SP", -23.5, -47.46],
    ["Rio de Janeiro", "RJ", -22.91, -43.17], ["Niterói", "RJ", -22.88, -43.1], ["Belo Horizonte", "MG", -19.92, -43.94], ["Uberlândia", "MG", -18.92, -48.28], ["Juiz de Fora", "MG", -21.76, -43.35], ["Vitória", "ES", -20.32, -40.34],
    ["Curitiba", "PR", -25.43, -49.27], ["Londrina", "PR", -23.31, -51.16], ["Maringá", "PR", -23.42, -51.94], ["Cascavel", "PR", -24.96, -53.46], ["Florianópolis", "SC", -27.6, -48.55], ["Joinville", "SC", -26.3, -48.85],
    ["Blumenau", "SC", -26.92, -49.07], ["Itajaí", "SC", -26.91, -48.66], ["Balneário Camboriú", "SC", -26.99, -48.63], ["Brusque", "SC", -27.1, -48.92], ["Chapecó", "SC", -27.1, -52.62], ["Criciúma", "SC", -28.68, -49.37],
    ["Porto Alegre", "RS", -30.03, -51.23], ["Caxias do Sul", "RS", -29.17, -51.18], ["Pelotas", "RS", -31.77, -52.34], ["Brasília", "DF", -15.79, -47.88], ["Goiânia", "GO", -16.69, -49.26], ["Campo Grande", "MS", -20.47, -54.62],
    ["Cuiabá", "MT", -15.6, -56.1], ["Salvador", "BA", -12.97, -38.5], ["Recife", "PE", -8.05, -34.88], ["Fortaleza", "CE", -3.73, -38.52], ["Natal", "RN", -5.79, -35.21], ["João Pessoa", "PB", -7.12, -34.86],
    ["Maceió", "AL", -9.67, -35.74], ["Aracaju", "SE", -10.91, -37.07], ["Teresina", "PI", -5.09, -42.8], ["São Luís", "MA", -2.53, -44.3], ["Belém", "PA", -1.46, -48.49], ["Manaus", "AM", -3.12, -60.02],
    ["Palmas", "TO", -10.18, -48.33], ["Porto Velho", "RO", -8.76, -63.9], ["Macapá", "AP", 0.03, -51.07], ["Boa Vista", "RR", 2.82, -60.67], ["Rio Branco", "AC", -9.97, -67.81]];

  function voltar(href, rotulo) { return '<p style="margin-bottom:8px"><a class="btn btn-texto" href="' + href + '">‹ ' + esc(rotulo) + "</a></p>"; }
  function dataBR(iso) { return iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : ""; }
  function dataHora(iso) { try { return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } }
  function reais(c) { return c == null ? "" : "R$ " + (c / 100).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d),)/g, "."); }
  function slots(l) { return (l || []).map(function (s) { var p = s.split("-"); return DIAS[p[0]] + " " + (TURNOS[p[1]] || "").toLowerCase(); }).join(", "); }
  function guarda(k, v) { try { if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } }
  function le(k) { try { return JSON.parse(sessionStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function guardaLocal(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } }
  function leLocal(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function chaveNova() { var b = new Uint8Array(12); crypto.getRandomValues(b); return "k" + Array.prototype.map.call(b, function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); }

  /* chamada que preserva o corpo do erro (pedido repetido, declaração de idade) */
  async function hubApi(caminho, corpo) {
    var u = firebase.auth().currentUser, h = { "content-type": "application/json" };
    if (u) h.authorization = "Bearer " + (await u.getIdToken());
    var r;
    try { r = await fetch("/.netlify/functions/" + caminho, { method: corpo ? "POST" : "GET", headers: h, body: corpo ? JSON.stringify(corpo) : undefined }); }
    catch (e) { throw new Error("Sem conexão. Verifique sua internet e tente de novo."); }
    var c = await r.json().catch(function () { return {}; });
    if (!r.ok) { var er = new Error(c.erro || "Algo deu errado. Tente de novo em instantes."); er.dados = c; er.status = r.status; throw er; }
    return c;
  }
  function chips(nome, tipo, mapa, marcados) {
    return '<div class="opcoes duas">' + Object.keys(mapa).map(function (k) {
      return '<label class="opcao"><input type="' + tipo + '" name="' + nome + '" value="' + esc(k) + '"' + (marcados.indexOf(k) >= 0 ? " checked" : "") + "><span>" + esc(mapa[k]) + "</span></label>";
    }).join("") + "</div>";
  }
  function gradeDias(nome, marcados) {
    return '<div class="hub-grade" role="group" aria-label="Dias e turnos"><span></span>' + Object.keys(DIAS).map(function (d) { return '<span class="hub-grade-dia">' + DIAS[d] + "</span>"; }).join("") +
      Object.keys(TURNOS).map(function (t) {
        return '<span class="hub-grade-turno">' + TURNOS[t] + "</span>" + Object.keys(DIAS).map(function (d) {
          var v = d + "-" + t;
          return '<label class="hub-grade-cel"><input type="checkbox" name="' + nome + '" value="' + v + '"' + (marcados.indexOf(v) >= 0 ? " checked" : "") + ' aria-label="' + DIAS[d] + " " + TURNOS[t] + '"><span aria-hidden="true"></span></label>';
        }).join("");
      }).join("") + "</div>";
  }
  function marcados(form, nome) { return Array.prototype.map.call(form.querySelectorAll('input[name="' + nome + '"]:checked'), function (i) { return i.value; }); }
  function valor(form, nome) { var i = form.querySelector('input[name="' + nome + '"]:checked'); return i ? i.value : ""; }

  /* ── cartão no início ── */
  function cartaoInicio() {
    return '<section class="cartao hub-inicio" style="margin-top:14px" aria-labelledby="t-hub-ini"><p class="olho">QuadraLab Hub</p><h2 id="t-hub-ini">' + (COMP ? "Encontre um treinador para torneios e temporada" : "Encontre um treinador para o seu objetivo.") + "</h2>" +
      '<p class="nota" style="margin-top:6px">Conheça treinadores, consulte serviços e combine seu atendimento diretamente pela plataforma. Buscar e pedir é gratuito.</p>' +
      '<div class="acoes"><a class="btn btn-laranja" href="#/treinadores">Encontrar um treinador</a><a class="btn btn-secundario" href="#/atendimentos">Meus atendimentos</a></div></section>';
  }

  /* ── busca ── */
  var FILTROS = "ql-hub-filtros-" + (COMP ? "c" : "p");
  async function telaBusca() {
    var f = le(FILTROS) || { objetivo: COMP ? "torneios" : "" };
    var catsMapa = {}; CATS.forEach(function (c) { catsMapa[c[0]] = c[1]; });
    tela('<h1>Encontrar um treinador</h1><p class="sub">' + (COMP ? "Profissionais para preparar torneios, planejar a temporada e ajustar a estratégia." : "Encontre um treinador para o seu objetivo.") + "</p>" +
      '<form id="fHub" class="cartao hub-filtros" novalidate>' +
      '<div class="campo"><label for="hCidade">Cidade ou região</label><input id="hCidade" maxlength="60" autocomplete="address-level2" value="' + esc(f.cidade || "") + '" placeholder="Ex.: Itajaí"></div>' +
      '<p style="margin:-6px 0 12px"><button type="button" class="btn btn-texto" id="btLocal">Usar minha localização</button> <span class="nota" id="localEstado" role="status"></span></p>' +
      '<fieldset><legend>Atendimento</legend>' + chips("modalidade", "radio", { "": "Todos", presencial: "Presencial", remoto: "Remoto" }, [f.modalidade || ""]) + "</fieldset>" +
      '<div class="campo"><label for="hObj">Objetivo</label><select id="hObj"><option value="">Qualquer objetivo</option>' + OBJ_ORDEM.map(function (k) { return '<option value="' + k + '"' + (f.objetivo === k ? " selected" : "") + ">" + OBJ[k] + "</option>"; }).join("") + "</select></div>" +
      '<details class="det"' + (f.nivel || f.publico || f.categoria || (f.disponibilidade || []).length || f.unidade ? " open" : "") + '><summary>Mais filtros</summary><div style="margin-top:12px">' +
      '<div class="campo"><label for="hNivel">Nível</label><select id="hNivel"><option value="">Qualquer nível</option>' + Object.keys(NIVEIS).map(function (k) { return '<option value="' + k + '"' + (f.nivel === k ? " selected" : "") + ">" + NIVEIS[k] + "</option>"; }).join("") + "</select></div>" +
      '<div class="campo"><label for="hPub">Público</label><select id="hPub"><option value="">Qualquer público</option>' + Object.keys(PUBLICOS).map(function (k) { return '<option value="' + k + '"' + (f.publico === k ? " selected" : "") + ">" + PUBLICOS[k] + "</option>"; }).join("") + "</select></div>" +
      '<div class="campo"><label for="hCat">Tipo de serviço</label><select id="hCat"><option value="">Qualquer serviço</option>' + CATS.map(function (c) { return '<option value="' + c[0] + '"' + (f.categoria === c[0] ? " selected" : "") + ">" + c[1] + "</option>"; }).join("") + "</select></div>" +
      '<fieldset><legend>Disponibilidade <span class="nota">(opcional)</span></legend>' + gradeDias("disp", f.disponibilidade || []) + "</fieldset>" +
      '<fieldset><legend>Faixa de preço <span class="nota">(compara só a mesma unidade)</span></legend><div class="hub-preco"><select id="hUni" aria-label="Unidade do preço"><option value="">Sem filtro de preço</option>' + Object.keys(UNIDADES).map(function (k) { return '<option value="' + k + '"' + (f.unidade === k ? " selected" : "") + ">Até … " + UNIDADES[k] + "</option>"; }).join("") + '</select><input id="hMax" inputmode="decimal" aria-label="Valor máximo em reais" placeholder="R$" value="' + esc(f.precoMax || "") + '"></div></fieldset>' +
      "</div></details>" +
      '<button class="btn btn-laranja btn-grande largo" type="submit">Buscar</button></form>' +
      '<div id="hubRes" aria-live="polite" style="margin-top:16px"></div>');
    var form = document.getElementById("fHub");
    function ler() {
      return { cidade: document.getElementById("hCidade").value.trim(), modalidade: valor(form, "modalidade"), objetivo: document.getElementById("hObj").value, nivel: document.getElementById("hNivel").value,
        publico: document.getElementById("hPub").value, categoria: document.getElementById("hCat").value, disponibilidade: marcados(form, "disp"), unidade: document.getElementById("hUni").value, precoMax: document.getElementById("hMax").value.replace(",", ".").trim() };
    }
    async function buscar(filtros) {
      guarda(FILTROS, filtros);
      var box = document.getElementById("hubRes"); if (!box) return;
      box.innerHTML = '<p class="carregando">Buscando profissionais…</p>'; box.setAttribute("aria-busy", "true");
      var q = { modo: COMP ? "competicao" : "player" };
      Object.keys(filtros).forEach(function (k) { var v = filtros[k]; if (Array.isArray(v)) v = v.join(","); if (v) q[k] = v; });
      try {
        var r = await hubApi("hub-busca?" + new URLSearchParams(q).toString());
        box.removeAttribute("aria-busy");
        if (!r.resultados.length) {
          box.innerHTML = '<div class="cartao hub-vazio"><h2>Ainda não encontramos profissionais com esses filtros.</h2><div class="acoes">' +
            (filtros.cidade ? '<button type="button" class="btn btn-secundario" data-ajuste="regiao">Ampliar a região</button>' : "") +
            '<button type="button" class="btn btn-secundario" data-ajuste="filtros">Alterar filtros</button>' +
            (filtros.modalidade !== "remoto" ? '<button type="button" class="btn btn-laranja" data-ajuste="remoto">Ver atendimento remoto</button>' : "") + "</div>" +
            (r.avisoPreco ? '<p class="nota" style="margin-top:8px">' + esc(r.avisoPreco) + "</p>" : "") + "</div>";
        } else {
          box.innerHTML = '<p class="nota" style="margin-bottom:8px">' + r.total + (r.total === 1 ? " profissional encontrado." : " profissionais encontrados.") + " A ordem considera os seus filtros, a disponibilidade informada e o perfil completo, nunca pagamento por destaque.</p>" +
            (r.avisoPreco ? '<p class="nota" style="margin-bottom:8px">' + esc(r.avisoPreco) + "</p>" : "") +
            '<ul class="hub-lista">' + r.resultados.map(cartaoProfissional).join("") + "</ul>";
        }
        box.querySelectorAll("[data-ajuste]").forEach(function (b) {
          b.addEventListener("click", function () {
            var a = b.getAttribute("data-ajuste"), n = ler();
            if (a === "regiao") { n.cidade = ""; document.getElementById("hCidade").value = ""; }
            if (a === "remoto") { n.modalidade = "remoto"; var rr = form.querySelector('input[name="modalidade"][value="remoto"]'); if (rr) rr.checked = true; }
            if (a === "filtros") { form.querySelector("details").open = true; document.getElementById("hCidade").focus(); return; }
            buscar(n);
          });
        });
      } catch (e) {
        box.removeAttribute("aria-busy");
        box.innerHTML = '<div class="aviso" role="alert">' + esc(e.message) + '</div><div class="acoes"><button type="button" class="btn btn-secundario" id="btBuscarDeNovo">Tentar de novo</button></div>';
        document.getElementById("btBuscarDeNovo").addEventListener("click", function () { buscar(filtros); });
      }
    }
    form.addEventListener("submit", function (ev) { ev.preventDefault(); buscar(ler()); });
    document.getElementById("btLocal").addEventListener("click", function () {
      var est = document.getElementById("localEstado");
      if (!navigator.geolocation) { est.textContent = "Seu navegador não informa a localização. Digite a cidade."; return; }
      est.textContent = "Procurando…";
      navigator.geolocation.getCurrentPosition(function (pos) {
        var la = pos.coords.latitude, lo = pos.coords.longitude, melhor = null, dm = 1e9;
        CIDADES.forEach(function (c) { var d = Math.pow(c[2] - la, 2) + Math.pow((c[3] - lo) * Math.cos(la * Math.PI / 180), 2); if (d < dm) { dm = d; melhor = c; } });
        if (melhor && dm < 1.5) { document.getElementById("hCidade").value = melhor[0]; est.textContent = "Cidade sugerida: " + melhor[0] + " (" + melhor[1] + "). Confira antes de buscar."; }
        else est.textContent = "Não reconheci a cidade. Digite o nome.";
      }, function () { est.textContent = "Sem permissão de localização. Digite a cidade."; }, { maximumAge: 600000, timeout: 10000 });
    });
    buscar(f);
  }
  function cartaoProfissional(c) {
    return '<li class="cartao hub-card"><div class="hub-card-topo">' +
      (c.foto ? '<img class="hub-foto" src="' + esc(c.foto) + '" alt="" width="56" height="56" loading="lazy">' : '<span class="hub-foto hub-foto-vazia" aria-hidden="true">' + esc((c.nomeProfissional || "?").slice(0, 1)) + "</span>") +
      '<div><h2 class="hub-nome">' + esc(c.nomeProfissional) + (c.verificado ? ' <span class="tag">Verificado</span>' : "") + '</h2><p class="nota">' + esc(c.local) + (c.remoto && c.local !== "Atendimento remoto" ? " · também remoto" : "") + "</p></div></div>" +
      (c.especialidades.length ? '<p class="hub-esp">' + c.especialidades.map(esc).join(" · ") + "</p>" : "") +
      '<p class="nota">' + esc(c.publicos.join(", ")) + (c.niveis.length ? " · " + esc(c.niveis.join(", ")) : "") + "</p>" +
      '<p class="hub-preco-txt"><strong>' + esc(c.preco) + "</strong>" + (c.aceitandoNovos ? ' <span class="tag">Aceitando novos alunos</span>' : "") + "</p>" +
      '<div class="acoes"><a class="btn btn-secundario" href="#/treinador/' + esc(c.uid) + '">Ver perfil</a></div></li>';
  }

  /* ── perfil público ── */
  async function telaPerfil(uid, acao, servicoId) {
    if (acao === "pedir") return telaPedir(uid, servicoId);
    tela(voltar("#/treinadores", "Encontrar um treinador") + '<p class="carregando">Carregando o perfil…</p>', true);
    var r;
    try { r = await hubApi("hub-busca?" + new URLSearchParams({ perfil: uid, modo: COMP ? "competicao" : "player" }).toString()); }
    catch (e) { tela(voltar("#/treinadores", "Encontrar um treinador") + '<div class="aviso" role="alert">' + esc(e.message) + "</div>"); return; }
    var p = r.perfil;
    var pedidoAberto = r.pedidosAbertos[0];
    tela(voltar("#/treinadores", "Encontrar um treinador") +
      '<section class="cartao hub-perfil"><div class="hub-card-topo">' + (p.foto ? '<img class="hub-foto hub-foto-g" src="' + esc(p.foto) + '" alt="Foto de ' + esc(p.nomeProfissional) + '" width="80" height="80">' : '<span class="hub-foto hub-foto-g hub-foto-vazia" aria-hidden="true">' + esc(p.nomeProfissional.slice(0, 1)) + "</span>") +
      "<div><h1>" + esc(p.nomeProfissional) + '</h1><p class="nota">' + esc(p.modalidade === "remoto" || !p.cidade ? "Atendimento remoto" : p.cidade + (p.uf ? " · " + p.uf : "")) + (p.modalidade === "ambos" ? " · presencial e remoto" : "") + "</p>" +
      (p.verificado ? '<p><span class="tag">Verificado: ' + esc(p.verificado.itens.join(", ")) + "</span></p>" : "") +
      (p.mediaAvaliacoes ? '<p class="nota">' + p.mediaAvaliacoes.toString().replace(".", ",") + " de 5 · " + r.totalAvaliacoes + (r.totalAvaliacoes === 1 ? " avaliação" : " avaliações") + "</p>" : "") + "</div></div>" +
      (p.apresentacao ? '<p style="margin-top:12px">' + esc(p.apresentacao) + "</p>" : "") +
      (p.aceitandoNovos ? '<p style="margin-top:8px"><span class="tag">Aceitando novos alunos</span></p>' : '<p class="nota" style="margin-top:8px">No momento não está aceitando novos alunos.</p>') +
      (pedidoAberto ? '<div class="aviso" style="margin-top:12px">Você já tem um pedido em andamento com este profissional (' + esc(pedidoAberto.rotulo) + '). <a href="#/atendimento/' + esc(pedidoAberto.id) + '">Abrir a conversa</a></div>' : "") +
      (r.recebePedidos && !r.bloqueado && !r.proprio ? '<div class="acoes"><a class="btn btn-laranja btn-grande" href="#/treinador/' + esc(uid) + '/pedir">Consultar disponibilidade</a></div>' : r.bloqueado ? '<p class="nota" style="margin-top:10px">Você bloqueou este profissional.</p>' : "") +
      "</section>" +
      '<h2 class="secao">Serviços</h2><ul class="hub-lista">' + p.servicos.map(function (s) {
        return '<li class="cartao hub-serv"><div class="hub-serv-topo"><h3>' + esc(s.nome) + '</h3><strong class="hub-preco-txt">' + esc(s.preco) + "</strong></div>" +
          '<p class="nota">' + esc(s.categoriaNome) + " · " + (s.modalidade === "ambos" ? "Presencial e remoto" : s.modalidade === "remoto" ? "Remoto" : "Presencial") + " · " + ({ individual: "Individual", dupla: "Dupla", grupo: "Grupo" }[s.formato] || "") +
          (s.duracaoMin ? " · " + s.duracaoMin + " min" : "") + (s.frequencia ? " · " + esc(s.frequencia) : "") + (s.local ? " · " + esc(s.local) : "") + "</p>" +
          (s.descricao ? '<p style="margin-top:6px">' + esc(s.descricao) + "</p>" : "") +
          '<p class="nota" style="margin-top:4px">' + (s.incluiQuadra ? "Inclui a quadra. " : "Quadra não incluída. ") + (s.incluiMateriais ? "Inclui materiais." : "") + "</p>" +
          (r.recebePedidos && s.abertoNovos && !r.bloqueado && !r.proprio ? '<div class="acoes"><a class="btn btn-secundario btn-pequeno" href="#/treinador/' + esc(uid) + "/pedir/" + esc(s.id) + '">Pedir este serviço</a></div>' : "") + "</li>";
      }).join("") + "</ul>" +
      (p.biografia ? '<h2 class="secao">Sobre</h2><div class="cartao"><p style="white-space:pre-line">' + esc(p.biografia) + "</p></div>" : "") +
      '<h2 class="secao">Experiência</h2><div class="cartao">' + (p.experienciaAnos != null ? "<p><strong>" + p.experienciaAnos + " anos de experiência</strong></p>" : "") + (p.experiencia ? '<p style="margin-top:4px">' + esc(p.experiencia) + "</p>" : "") +
      (p.formacao ? '<p style="margin-top:6px"><strong>Formação:</strong> ' + esc(p.formacao) + "</p>" : "") + (p.idiomas.length ? '<p style="margin-top:6px"><strong>Idiomas:</strong> ' + esc(p.idiomas.join(", ")) + "</p>" : "") +
      '<p class="nota" style="margin-top:8px">' + esc(p.declarado) + "</p></div>" +
      '<h2 class="secao">Onde e quando</h2><div class="cartao">' + (p.locais.length ? "<p><strong>Locais:</strong> " + esc(p.locais.join(" · ")) + "</p>" : "") + (p.regioes.length ? '<p style="margin-top:4px"><strong>Regiões:</strong> ' + esc(p.regioes.join(", ")) + "</p>" : "") +
      (p.disponibilidade.length ? '<p style="margin-top:4px"><strong>Disponibilidade indicativa:</strong> ' + esc(slots(p.disponibilidade)) + "</p>" : "") +
      '<p class="nota" style="margin-top:6px">Horários e valores são confirmados na conversa com o profissional.</p></div>' +
      (p.avaliacoes.length ? '<h2 class="secao">Avaliações</h2><ul class="hub-lista">' + p.avaliacoes.map(function (a) {
        return '<li class="cartao"><p><strong>' + "★".repeat(a.nota) + "☆".repeat(5 - a.nota) + "</strong> " + esc(a.autor) + (a.servico ? " · " + esc(a.servico) : "") + " · " + esc(dataBR(a.em)) + "</p>" + (a.comentario ? '<p style="margin-top:4px">' + esc(a.comentario) + "</p>" : "") +
          '<p class="nota" style="margin-top:4px">' + esc(a.origem) + "</p>" + (a.resposta ? '<p class="hub-resposta"><strong>Resposta do profissional:</strong> ' + esc(a.resposta.texto) + "</p>" : "") +
          '<button type="button" class="btn btn-texto" data-den-av="' + esc(a.id) + '">Denunciar avaliação</button></li>';
      }).join("") + "</ul>" : "") +
      '<div class="acoes" style="margin-top:18px"><button type="button" class="btn btn-texto" id="btDenPerfil">Denunciar este perfil</button>' + (r.proprio ? "" : '<button type="button" class="btn btn-texto" id="btBloq">' + (r.bloqueado ? "Desbloquear" : "Bloquear este profissional") + "</button>") + "</div>" +
      '<form id="fDen" class="cartao" hidden novalidate><h2>Denunciar</h2><input type="hidden" id="denTipo"><input type="hidden" id="denAlvo"><fieldset><legend>Motivo</legend>' + chips("motivo", "radio", MOTIVOS, []) + '</fieldset><div class="campo"><label for="denTxt">Conte o que aconteceu <span class="nota">(opcional)</span></label><textarea id="denTxt" maxlength="500"></textarea></div><div class="aviso" id="denErro" role="alert" hidden></div><button class="btn btn-primario" type="submit">Enviar denúncia</button></form>');
    ligarDenuncia(function (tipo, alvo) { return tipo === "perfil" ? { tipo: "perfil", profissionalUid: uid } : { tipo: "avaliacao", avaliacaoId: alvo }; });
    document.getElementById("btDenPerfil").addEventListener("click", function () { abrirDenuncia("perfil", uid); });
    document.querySelectorAll("[data-den-av]").forEach(function (b) { b.addEventListener("click", function () { abrirDenuncia("avaliacao", b.getAttribute("data-den-av")); }); });
    var bq = document.getElementById("btBloq");
    if (bq) bq.addEventListener("click", async function () {
      if (!r.bloqueado && !confirm("Bloquear este profissional? Ele não poderá receber pedidos seus nem trocar mensagens com você.")) return;
      ocupado(bq, true);
      try { await hubApi("hub-atendimentos", { acao: r.bloqueado ? "desbloquear" : "bloquear", profissionalUid: uid }); toast(r.bloqueado ? "Profissional desbloqueado." : "Profissional bloqueado."); telaPerfil(uid); }
      catch (e) { toast(e.message, null, true); ocupado(bq, false); }
    });
  }
  function abrirDenuncia(tipo, alvo) { var f = document.getElementById("fDen"); document.getElementById("denTipo").value = tipo; document.getElementById("denAlvo").value = alvo; f.hidden = false; f.scrollIntoView({ block: "center" }); }
  function ligarDenuncia(corpoDe) {
    var f = document.getElementById("fDen"); if (!f) return;
    f.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var err = document.getElementById("denErro"), mot = valor(f, "motivo");
      if (!mot) { err.textContent = "Escolha o motivo."; err.hidden = false; return; }
      var bt = f.querySelector("button[type=submit]"); ocupado(bt, true, "Enviando…");
      try {
        var c = corpoDe(document.getElementById("denTipo").value, document.getElementById("denAlvo").value); c.acao = "denunciar"; c.motivo = mot; c.texto = document.getElementById("denTxt").value;
        await hubApi("hub-atendimentos", c); f.hidden = true; f.reset(); toast("Denúncia recebida. A moderação vai analisar.");
      } catch (e) { err.textContent = e.message; err.hidden = false; }
      ocupado(bt, false);
    });
  }

  /* ── pedido de atendimento ── */
  async function telaPedir(uid, servicoId) {
    var volta = voltar("#/treinador/" + uid, "Perfil do profissional");
    tela(volta + '<p class="carregando">Preparando o pedido…</p>', true);
    var r;
    try { r = await hubApi("hub-atendimentos?" + new URLSearchParams({ preparar: uid }).toString()); }
    catch (e) { tela(volta + '<div class="aviso" role="alert">' + esc(e.message) + "</div>"); return; }
    if (!r.recebePedidos) { tela(volta + '<div class="cartao"><h2>Este profissional não está recebendo novos pedidos no momento.</h2><div class="acoes"><a class="btn btn-secundario" href="#/treinadores">Ver outros profissionais</a></div></div>'); return; }
    if (!r.paraQuem.length) { tela(volta + '<div class="cartao"><h2>Nenhum atleta para este pedido</h2><p class="nota" style="margin-top:6px">Como responsável, você pede atendimento para um atleta menor de idade vinculado a você. Peça o código de convite ao atleta.</p></div>'); return; }
    var RASC = "ql-hub-pedido-" + uid;
    var salvo = leLocal(RASC) || {};
    var chave = salvo.chave || chaveNova();
    var filtros = le(FILTROS) || {};
    var v = { paraQuem: salvo.paraQuem || r.paraQuem[0].id, servicoId: salvo.servicoId || servicoId || "", objetivo: salvo.objetivo || filtros.objetivo || (COMP ? "torneios" : ""), nivel: salvo.nivel || r.nivel || "",
      modalidade: salvo.modalidade || (filtros.modalidade === "remoto" ? "remoto" : "presencial"), cidade: salvo.cidade != null ? salvo.cidade : (filtros.cidade || r.cidade || ""), disponibilidade: salvo.disponibilidade || filtros.disponibilidade || [], mensagem: salvo.mensagem || "", orcamento: salvo.orcamento || "" };
    var servMapa = { "": "A combinar (não sei qual serviço)" }; r.servicos.forEach(function (s) { servMapa[s.id] = s.nome + " · " + s.preco; });
    var pqMapa = {}; r.paraQuem.forEach(function (x) { pqMapa[x.id] = x.id === "eu" ? "Para mim" : "Para " + x.nome + " (atleta vinculado)"; });
    tela(volta + "<h1>Consultar disponibilidade</h1><p class=\"sub\">Pedido para " + esc(r.profissionalNome) + ". Buscar e pedir é gratuito.</p>" +
      (salvo.em ? '<div class="aviso" role="status">Retomamos o rascunho do seu pedido. <button type="button" class="btn btn-texto" id="btDescartar">Começar de novo</button></div>' : "") +
      '<form id="fPedido" class="cartao" novalidate>' +
      (r.paraQuem.length > 1 || r.paraQuem[0].id !== "eu" ? "<fieldset><legend>Para quem</legend>" + chips("paraQuem", "radio", pqMapa, [v.paraQuem]) + "</fieldset>" : '<input type="hidden" name="paraQuemFixo" value="eu">') +
      '<div id="avisoMenor"></div>' +
      '<div class="campo"><label for="pServ">Serviço</label><select id="pServ">' + Object.keys(servMapa).map(function (k) { return '<option value="' + esc(k) + '"' + (v.servicoId === k ? " selected" : "") + ">" + esc(servMapa[k]) + "</option>"; }).join("") + "</select></div>" +
      '<div class="campo"><label for="pObj">Objetivo</label><select id="pObj" required><option value="">Escolha…</option>' + OBJ_ORDEM.map(function (k) { return '<option value="' + k + '"' + (v.objetivo === k ? " selected" : "") + ">" + OBJ[k] + "</option>"; }).join("") + "</select></div>" +
      '<div class="campo"><label for="pNivel">Nível</label><select id="pNivel" required><option value="">Escolha…</option>' + Object.keys(NIVEIS).map(function (k) { return '<option value="' + k + '"' + (v.nivel === k ? " selected" : "") + ">" + NIVEIS[k] + "</option>"; }).join("") + "</select></div>" +
      "<fieldset><legend>Atendimento</legend>" + chips("modalidade", "radio", { presencial: "Presencial", remoto: "Remoto" }, [v.modalidade]) + "</fieldset>" +
      '<div class="campo" id="boxCidade"><label for="pCidade">Cidade</label><input id="pCidade" maxlength="60" value="' + esc(v.cidade) + '"></div>' +
      "<fieldset><legend>Dias e turnos possíveis</legend>" + gradeDias("disp", v.disponibilidade) + "</fieldset>" +
      '<div class="campo"><label for="pMsg">Mensagem <span class="nota">(até 1.000 letras)</span></label><textarea id="pMsg" maxlength="1000" placeholder="Conte o que você procura.">' + esc(v.mensagem) + '</textarea><p class="nota" id="pMsgCont"></p></div>' +
      '<div class="campo"><label for="pOrc">Orçamento <span class="nota">(opcional)</span></label><input id="pOrc" maxlength="80" placeholder="Ex.: até R$ 150 por aula" value="' + esc(v.orcamento) + '"></div>' +
      '<div id="boxDeclara"></div>' +
      '<div class="hub-previa" aria-live="polite"><p class="olho">O que será compartilhado com o profissional</p><div id="previaPedido"></div><p class="nota" style="margin-top:6px">' + esc(r.compartilhado) + "</p></div>" +
      '<p style="margin-top:12px">' + esc(r.texto || TXT_ENVIO) + "</p>" +
      '<div class="aviso" id="pErro" role="alert" hidden></div>' +
      '<button class="btn btn-laranja btn-grande largo" type="submit" id="btEnviar">Enviar pedido</button></form>');
    var form = document.getElementById("fPedido");
    function pq() { return valor(form, "paraQuem") || "eu"; }
    function ler() {
      return { paraQuem: pq(), servicoId: document.getElementById("pServ").value, objetivo: document.getElementById("pObj").value, nivel: document.getElementById("pNivel").value, modalidade: valor(form, "modalidade"),
        cidade: document.getElementById("pCidade").value.trim(), disponibilidade: marcados(form, "disp"), mensagem: document.getElementById("pMsg").value, orcamento: document.getElementById("pOrc").value.trim() };
    }
    function atualizar() {
      var x = ler(), alvo = r.paraQuem.filter(function (a) { return a.id === x.paraQuem; })[0] || r.paraQuem[0];
      document.getElementById("boxCidade").hidden = x.modalidade === "remoto";
      document.getElementById("pMsgCont").textContent = x.mensagem.length + "/1000";
      document.getElementById("avisoMenor").innerHTML = alvo.menor ? '<div class="aviso">' + (alvo.id === "eu" ? (alvo.temResponsavel ? "Como você é menor de idade, o pedido vai primeiro para o seu responsável confirmar. Ele participa da conversa e decide a proposta." : "Como você é menor de idade, vincule primeiro um responsável em Início. Ele confirma o pedido e conversa com o profissional.") : "Você será o responsável na conversa e quem decide a proposta. O profissional vê só o primeiro nome do atleta.") + "</div>" : "";
      var dec = document.getElementById("boxDeclara");
      if (alvo.precisaDeclarar && !dec.firstChild) dec.innerHTML = '<label class="opcao-linha"><input type="checkbox" id="pMaior"> Declaro que tenho 18 anos ou mais.</label><p class="nota">Menores de idade pedem atendimento com um responsável vinculado (QuadraLab Competição).</p>';
      if (!alvo.precisaDeclarar) dec.innerHTML = "";
      var nomeAtleta = alvo.id === "eu" ? (alvo.menor ? alvo.nome.split(" ")[0] : alvo.nome) : alvo.nome;
      document.getElementById("previaPedido").innerHTML = '<dl class="hub-dl">' +
        "<dt>Atleta</dt><dd>" + esc(nomeAtleta) + (alvo.menor ? " (menor de idade, com responsável)" : "") + "</dd>" +
        "<dt>Serviço</dt><dd>" + esc(x.servicoId ? servMapa[x.servicoId].split(" · ")[0] : "A combinar") + "</dd>" +
        "<dt>Objetivo</dt><dd>" + esc(OBJ[x.objetivo] || "—") + "</dd><dt>Nível</dt><dd>" + esc(NIVEIS[x.nivel] || "—") + "</dd>" +
        "<dt>Atendimento</dt><dd>" + (x.modalidade === "remoto" ? "Remoto" : "Presencial" + (x.cidade ? " em " + esc(x.cidade) : "")) + "</dd>" +
        "<dt>Dias e turnos</dt><dd>" + esc(slots(x.disponibilidade) || "—") + "</dd>" +
        (x.mensagem.trim() ? "<dt>Mensagem</dt><dd>" + esc(x.mensagem.trim()) + "</dd>" : "") + (x.orcamento ? "<dt>Orçamento</dt><dd>" + esc(x.orcamento) + "</dd>" : "") + "</dl>";
      var g = ler(); g.chave = chave; g.em = new Date().toISOString(); guardaLocal(RASC, g);
    }
    form.addEventListener("input", atualizar); form.addEventListener("change", atualizar); atualizar();
    var bd = document.getElementById("btDescartar");
    if (bd) bd.addEventListener("click", function () { guardaLocal(RASC, null); telaPedir(uid, servicoId); });
    form.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var err = document.getElementById("pErro"), bt = document.getElementById("btEnviar"), x = ler();
      err.hidden = true;
      var falta = !x.objetivo ? "Escolha o objetivo." : !x.nivel ? "Escolha o nível." : !x.modalidade ? "Escolha presencial ou remoto." : x.modalidade === "presencial" && !x.cidade ? "Informe a cidade." : !x.disponibilidade.length ? "Marque pelo menos um dia e turno." : "";
      var mz = document.getElementById("pMaior");
      if (!falta && mz && !mz.checked) falta = "Confirme que você tem 18 anos ou mais.";
      if (falta) { err.textContent = falta; err.hidden = false; err.scrollIntoView({ block: "center" }); return; }
      ocupado(bt, true, "Enviando…");
      try {
        var c = Object.assign({ acao: "enviar", profissionalUid: uid, chave: chave, modo: COMP ? "competicao" : "player", maior18: mz ? mz.checked : undefined }, x);
        var res = await hubApi("hub-atendimentos", c);
        guardaLocal(RASC, null);
        tela('<div class="cartao hub-enviado" role="status"><h1>' + esc(res.mensagem || TXT_ENVIADO) + '</h1><div class="acoes"><a class="btn btn-laranja" href="#/atendimento/' + esc(res.id) + '">Abrir o pedido</a><a class="btn btn-secundario" href="#/atendimentos">Meus atendimentos</a></div></div>');
      } catch (e) {
        ocupado(bt, false);
        if (e.dados && e.dados.duplicado) { err.innerHTML = esc(e.message) + ' <a href="#/atendimento/' + esc(e.dados.id) + '">Abrir o pedido</a>'; guardaLocal(RASC, null); }
        else err.textContent = e.message;
        err.hidden = false; err.scrollIntoView({ block: "center" });
      }
    });
  }

  /* ── Meus atendimentos ── */
  function itemPedido(p) {
    return '<li class="cartao hub-item"><a class="hub-item-link" href="#/atendimento/' + esc(p.id) + '"><span class="hub-item-topo"><strong>' + esc(p.profissional.nome) + "</strong>" +
      (p.naoLidas > 0 ? '<span class="hub-badge" aria-label="' + p.naoLidas + ' não lidas">' + p.naoLidas + "</span>" : "") + "</span>" +
      '<span class="nota">' + esc(p.servicoNome) + (p.atleta.menor ? " · para " + esc(p.atleta.nome) : "") + "</span>" +
      '<span><span class="tag">' + esc(p.rotulo) + "</span></span>" + (p.proximaAcao ? '<span class="hub-proxima">' + esc(p.proximaAcao) + "</span>" : "") + "</a></li>";
  }
  async function preencherAtendimentos(box) {
    if (!box) return;
    box.innerHTML = '<p class="carregando">Carregando seus pedidos a treinadores…</p>';
    try {
      var r = await hubApi("hub-atendimentos"), l = r.comoJogador;
      var andamento = l.filter(function (p) { return ["aguardando_responsavel", "aguardando_resposta", "em_conversa", "proposta_enviada", "combinado"].indexOf(p.estado) >= 0 || (p.estado === "concluido" && p.proximaAcao); });
      var outros = l.filter(function (p) { return andamento.indexOf(p) < 0; });
      var avisos = r.avisos.itens.filter(function (a) { return !a.lida; }).slice(0, 4);
      box.innerHTML = '<h2 class="secao">Treinadores do QuadraLab Hub</h2>' +
        (avisos.length ? '<div class="aviso hub-avisos" role="status">' + avisos.map(function (a) { return "<p>" + esc(a.texto) + "</p>"; }).join("") + '<button type="button" class="btn btn-texto" id="btLerAvisos">Marcar avisos como lidos</button></div>' : "") +
        (l.length ? (andamento.length ? '<ul class="hub-lista">' + andamento.map(itemPedido).join("") + "</ul>" : '<p class="nota">Nenhum pedido em andamento.</p>') +
          (outros.length ? '<details class="det" style="margin-top:12px"><summary>Encerrados (' + outros.length + ')</summary><ul class="hub-lista" style="margin-top:10px">' + outros.map(itemPedido).join("") + "</ul></details>" : "")
          : '<div class="cartao"><p>Você ainda não pediu atendimento a um treinador.</p><div class="acoes"><a class="btn btn-laranja" href="#/treinadores">Encontrar um treinador</a></div></div>');
      var bl = document.getElementById("btLerAvisos");
      if (bl) bl.addEventListener("click", async function () { try { await hubApi("hub-atendimentos", { acao: "lerNotificacoes" }); preencherAtendimentos(box); } catch (e) { toast(e.message, null, true); } });
    } catch (e) { box.innerHTML = '<div class="aviso" role="alert">' + esc(e.message) + "</div>"; }
  }
  function telaAtendimentos() {
    tela('<h1>Meus atendimentos</h1><p class="sub">Seus pedidos a treinadores, as conversas e as propostas combinadas.</p><div id="hubAtend"></div>');
    preencherAtendimentos(document.getElementById("hubAtend"));
  }

  /* ── conversa ── */
  var timerConversa = null;
  function pararTimer() { if (timerConversa) { clearInterval(timerConversa); timerConversa = null; } }
  window.addEventListener("hashchange", pararTimer);
  function propostaHtml(v, ped, podeDecidir) {
    var rot = { vigente: "Aguardando sua decisão", aceita: "Aceita", substituida: "Substituída por outra versão", recusada: "Recusada", ajuste_pedido: "Ajuste pedido" };
    var vencida = v.estado === "vigente" && v.validade < new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
    return '<section class="cartao hub-proposta hub-prop-' + esc(v.estado) + '" data-versao="' + v.versao + '"><p class="olho">Proposta versão ' + v.versao + " · " + esc(vencida ? "Vencida" : rot[v.estado] || v.estado) + (ped.aceite && ped.aceite.versao === v.versao ? " em " + esc(dataHora(ped.aceite.em)) : "") + "</p>" +
      '<dl class="hub-dl"><dt>Serviço</dt><dd>' + esc(v.servico) + "</dd><dt>Atendimento</dt><dd>" + (v.modalidade === "remoto" ? "Remoto" : "Presencial · " + esc(v.local)) + "</dd>" +
      "<dt>Quando</dt><dd>" + esc((v.dataHora ? dataBR(v.dataHora) + (v.dataHora.length > 10 ? " às " + v.dataHora.slice(11) : "") : "") + (v.dataHoraTexto ? " " + v.dataHoraTexto : "")) + (v.duracaoMin ? " · " + v.duracaoMin + " min" : "") + "</dd>" +
      "<dt>Quantidade</dt><dd>" + esc(v.quantidade) + "</dd><dt>Valor total</dt><dd><strong>" + esc(reais(v.valorTotalCentavos)) + "</strong> " + esc(UNIDADES[v.unidade] || "") + "</dd>" +
      (v.incluidos ? "<dt>Inclui</dt><dd>" + esc(v.incluidos) + "</dd>" : "") + (v.custosAdicionais ? "<dt>Custos adicionais</dt><dd>" + esc(v.custosAdicionais) + "</dd>" : "") +
      "<dt>Pagamento</dt><dd>" + esc(v.formaPagamento) + " (direto com o profissional)</dd><dt>Cancelamento</dt><dd>" + esc(v.cancelamento) + "</dd><dt>Válida até</dt><dd>" + esc(dataBR(v.validade)) + "</dd></dl>" +
      (v.estado === "vigente" && podeDecidir && !vencida ? '<div class="acoes"><button type="button" class="btn btn-laranja" data-aceitar="' + v.versao + '">Aceitar proposta</button><button type="button" class="btn btn-secundario" data-ajuste="' + v.versao + '">Pedir ajuste</button><button type="button" class="btn btn-texto" data-recusar="' + v.versao + '">Recusar</button></div>' : "") +
      "</section>";
  }
  async function telaConversa(id) {
    pararTimer();
    var volta = voltar("#/atendimentos", "Meus atendimentos");
    tela(volta + '<p class="carregando">Abrindo a conversa…</p>', true);
    var d;
    try { d = await hubApi("hub-atendimentos?" + new URLSearchParams({ id: id }).toString()); }
    catch (e) { tela(volta + '<div class="aviso" role="alert">' + esc(e.message) + "</div>"); return; }
    var ped = d.pedido, pe = d.permissoes, p = ped.pedido || {};
    var assinatura = JSON.stringify([d.mensagens.length, ped.estado, ped.propostas.length]);
    var props = ped.propostas.slice().reverse();
    tela(volta + '<h1>' + esc(ped.profissional.nome) + '</h1><p class="sub"><span class="tag" id="hubStatus">' + esc(ped.rotulo) + "</span>" + (ped.proximaAcao ? " " + esc(ped.proximaAcao) : "") + "</p>" +
      (pe.confirmarEnvio ? '<div class="cartao comp-alerta"><h2>' + esc(ped.atleta.nome) + ' quer pedir este atendimento</h2><p class="nota" style="margin-top:6px">Ao confirmar, o pedido vai para o profissional e você participa da conversa como responsável.</p><div class="acoes"><button type="button" class="btn btn-laranja" id="btConfirmarEnvio">Confirmar e enviar</button><button type="button" class="btn btn-secundario" data-cancelar>Não enviar</button></div></div>' : "") +
      (ped.lado === "atleta_menor" ? '<div class="aviso">' + (ped.estado === "aguardando_responsavel" ? "Seu responsável precisa confirmar o envio do pedido." : "Seu responsável conversa com o profissional e decide a proposta. Você acompanha tudo aqui.") + "</div>" : "") +
      (d.responsaveisNaConversa.length && ped.lado !== "atleta_menor" ? '<p class="nota">Responsável na conversa: ' + esc(d.responsaveisNaConversa.join(", ")) + ".</p>" : "") +
      '<details class="cartao hub-original"' + (props.length ? "" : " open") + '><summary><strong>Pedido original</strong></summary><dl class="hub-dl" style="margin-top:8px"><dt>Serviço</dt><dd>' + esc(ped.servicoNome) + "</dd><dt>Objetivo</dt><dd>" + esc(OBJ[p.objetivo] || "") + "</dd><dt>Nível</dt><dd>" + esc(NIVEIS[p.nivel] || "") + "</dd>" +
      "<dt>Atendimento</dt><dd>" + (p.modalidade === "remoto" ? "Remoto" : "Presencial em " + esc(p.cidade)) + "</dd><dt>Dias e turnos</dt><dd>" + esc(slots(p.disponibilidade)) + "</dd>" + (p.mensagem ? "<dt>Mensagem</dt><dd>" + esc(p.mensagem) + "</dd>" : "") + (p.orcamento ? "<dt>Orçamento</dt><dd>" + esc(p.orcamento) + "</dd>" : "") + "</dl></details>" +
      props.map(function (v) { return propostaHtml(v, ped, pe.decidir); }).join("") +
      (ped.estado === "combinado" && ped.conclusao && ped.conclusao.marcadoPor === "profissional" && pe.decidir ? '<div class="cartao comp-alerta"><h2>O profissional marcou o atendimento como concluído</h2><div class="acoes"><button type="button" class="btn btn-laranja" data-concluir>Confirmar conclusão</button></div></div>' : "") +
      '<h2 class="secao">Conversa</h2><div class="hub-msgs" role="log" aria-label="Mensagens">' + (d.mensagens.length ? d.mensagens.map(function (m) {
        var sis = m.tipo === "sistema" || m.tipo === "proposta";
        return '<div class="hub-msg' + (sis ? " hub-msg-sis" : m.minha ? " hub-msg-minha" : "") + '">' + (m.tipo === "ajuste" ? '<span class="olho">Pedido de ajuste (versão ' + m.versao + ")</span>" : "") +
          '<p style="white-space:pre-line' + (m.oculta ? ";font-style:italic" : "") + '">' + esc(m.texto) + '</p><span class="nota">' + esc(dataHora(m.em)) + (!m.minha && !sis && !m.oculta ? ' · <button type="button" class="btn btn-texto hub-den" data-den-msg="' + esc(m.id) + '">Denunciar</button>' : "") + "</span></div>";
      }).join("") : '<p class="nota">Ainda sem mensagens. O profissional responde por aqui.</p>') + "</div>" +
      (pe.escrever ? '<form id="fMsg" class="hub-enviar" novalidate><label class="sr" for="hMsg">Mensagem</label><textarea id="hMsg" maxlength="1000" placeholder="Escreva uma mensagem"></textarea><button class="btn btn-laranja" type="submit">Enviar</button></form>' : "") +
      '<form id="fAjuste" class="cartao" hidden novalidate><h2>Pedir ajuste na proposta</h2><div class="campo"><label for="ajTxt">O que você quer mudar?</label><textarea id="ajTxt" maxlength="1000"></textarea></div><button class="btn btn-primario" type="submit">Enviar pedido de ajuste</button></form>' +
      (ped.estado === "concluido" && pe.decidir && !d.avaliacao ? '<form id="fAval" class="cartao" novalidate><h2>Avalie o atendimento</h2><fieldset><legend>Nota</legend><div class="opcoes">' + [5, 4, 3, 2, 1].map(function (n) { return '<label class="opcao"><input type="radio" name="nota" value="' + n + '"><span>' + "★".repeat(n) + "</span></label>"; }).join("") +
        '</div></fieldset><div class="campo"><label for="avTxt">Comentário <span class="nota">(opcional, público no perfil)</span></label><textarea id="avTxt" maxlength="600"></textarea></div><button class="btn btn-laranja" type="submit">Enviar avaliação</button></form>' : "") +
      (d.avaliacao ? '<div class="cartao"><h2>Sua avaliação</h2><p>' + "★".repeat(d.avaliacao.nota) + "☆".repeat(5 - d.avaliacao.nota) + "</p>" + (d.avaliacao.comentario ? "<p>" + esc(d.avaliacao.comentario) + "</p>" : "") + (d.avaliacao.resposta ? '<p class="hub-resposta"><strong>Resposta do profissional:</strong> ' + esc(d.avaliacao.resposta.texto) + "</p>" : "") + "</div>" : "") +
      '<div class="acoes" style="margin-top:16px">' +
      (pe.decidir && ["aguardando_resposta", "em_conversa", "proposta_enviada", "combinado"].indexOf(ped.estado) >= 0 ? '<button type="button" class="btn btn-texto" data-cancelar>Cancelar pedido</button>' : "") +
      (pe.decidir && ["em_conversa", "proposta_enviada"].indexOf(ped.estado) >= 0 ? '<button type="button" class="btn btn-texto" data-encerrar>Encerrar sem acordo</button>' : "") +
      (pe.decidir && ped.estado === "combinado" && !(ped.conclusao && ped.conclusao.marcadoPor === "profissional") ? '<button type="button" class="btn btn-texto" data-concluir>Marcar como concluído</button>' : "") +
      (ped.lado === "atleta_menor" && ped.estado === "aguardando_responsavel" ? '<button type="button" class="btn btn-texto" data-cancelar>Cancelar pedido</button>' : "") +
      (pe.decidir ? '<button type="button" class="btn btn-texto" data-bloquear>Bloquear profissional</button>' : "") + "</div>" +
      '<p class="nota" style="margin-top:10px">' + esc(d.textos.vinculo) + "</p>" +
      '<form id="fDen" class="cartao" hidden novalidate><h2>Denunciar mensagem</h2><input type="hidden" id="denTipo"><input type="hidden" id="denAlvo"><fieldset><legend>Motivo</legend>' + chips("motivo", "radio", MOTIVOS, []) + '</fieldset><div class="campo"><label for="denTxt">Conte o que aconteceu <span class="nota">(opcional)</span></label><textarea id="denTxt" maxlength="500"></textarea></div><div class="aviso" id="denErro" role="alert" hidden></div><button class="btn btn-primario" type="submit">Enviar denúncia</button></form>');
    async function agir(corpo, msg, bt) {
      if (bt) ocupado(bt, true);
      try { corpo.id = id; await hubApi("hub-atendimentos", corpo); if (msg) toast(msg); telaConversa(id); return true; }
      catch (e) { toast(e.message, null, true); if (bt) ocupado(bt, false); return false; }
    }
    var fm = document.getElementById("fMsg");
    if (fm) fm.addEventListener("submit", function (ev) { ev.preventDefault(); var t = document.getElementById("hMsg").value.trim(); if (t) agir({ acao: "mensagem", texto: t }, null, fm.querySelector("button")); });
    var bce = document.getElementById("btConfirmarEnvio");
    if (bce) bce.addEventListener("click", function () { agir({ acao: "confirmarEnvio" }, TXT_ENVIADO, bce); });
    document.querySelectorAll("[data-aceitar]").forEach(function (b) {
      b.addEventListener("click", function () { if (confirm(TXT_ACEITE)) agir({ acao: "aceitar", versao: Number(b.getAttribute("data-aceitar")), confirmo: true }, "Proposta aceita. O atendimento está combinado.", b); });
    });
    document.querySelectorAll("[data-recusar]").forEach(function (b) {
      b.addEventListener("click", function () { if (confirm("Recusar esta proposta? A conversa continua aberta.")) agir({ acao: "recusarProposta", versao: Number(b.getAttribute("data-recusar")) }, "Proposta recusada.", b); });
    });
    var fa = document.getElementById("fAjuste"), versaoAjuste = 0;
    document.querySelectorAll("[data-ajuste]").forEach(function (b) { b.addEventListener("click", function () { versaoAjuste = Number(b.getAttribute("data-ajuste")); fa.hidden = false; document.getElementById("ajTxt").focus(); }); });
    fa.addEventListener("submit", function (ev) { ev.preventDefault(); var t = document.getElementById("ajTxt").value.trim(); if (!t) { toast("Explique o ajuste que você quer.", null, true); return; } agir({ acao: "pedirAjuste", versao: versaoAjuste, texto: t }, "Pedido de ajuste enviado.", fa.querySelector("button")); });
    document.querySelectorAll("[data-cancelar]").forEach(function (b) { b.addEventListener("click", function () { if (confirm("Cancelar este pedido?")) agir({ acao: "cancelar" }, "Pedido cancelado.", b); }); });
    document.querySelectorAll("[data-encerrar]").forEach(function (b) { b.addEventListener("click", function () { if (confirm("Encerrar a conversa sem acordo?")) agir({ acao: "encerrar" }, "Conversa encerrada.", b); }); });
    document.querySelectorAll("[data-concluir]").forEach(function (b) { b.addEventListener("click", function () { if (confirm("Confirmar que o atendimento foi concluído?")) agir({ acao: "concluir" }, "Atendimento concluído. Você já pode avaliar.", b); }); });
    document.querySelectorAll("[data-bloquear]").forEach(function (b) { b.addEventListener("click", function () { if (confirm("Bloquear este profissional? Vocês não poderão mais trocar mensagens.")) agir({ acao: "bloquear" }, "Profissional bloqueado.", b); }); });
    var fv = document.getElementById("fAval");
    if (fv) fv.addEventListener("submit", function (ev) { ev.preventDefault(); var n = Number(valor(fv, "nota")); if (!n) { toast("Escolha uma nota.", null, true); return; } agir({ acao: "avaliar", nota: n, comentario: document.getElementById("avTxt").value }, "Obrigado pela avaliação.", fv.querySelector("button[type=submit]")); });
    ligarDenuncia(function (tipo, alvo) { return { tipo: "mensagem", pedidoId: id, mensagemId: alvo }; });
    document.querySelectorAll("[data-den-msg]").forEach(function (b) { b.addEventListener("click", function () { abrirDenuncia("mensagem", b.getAttribute("data-den-msg")); }); });
    var log = document.querySelector(".hub-msgs"); if (log && d.mensagens.length) log.scrollTop = log.scrollHeight;
    /* atualiza sozinho enquanto a conversa está aberta e ninguém está digitando */
    var rota = location.hash;
    timerConversa = setInterval(async function () {
      if (location.hash !== rota) { pararTimer(); return; }
      var t = document.getElementById("hMsg");
      if ((t && t.value) || (fa && !fa.hidden) || document.querySelector("#fDen:not([hidden])") || document.getElementById("fAval")) return;
      try { var n = await hubApi("hub-atendimentos?" + new URLSearchParams({ id: id }).toString()); if (JSON.stringify([n.mensagens.length, n.pedido.estado, n.pedido.propostas.length]) !== assinatura) telaConversa(id); } catch (e) { /* tenta na próxima */ }
    }, 20000);
  }

  var rotas = { treinadores: telaBusca, treinador: telaPerfil, atendimento: telaConversa };
  if (COMP) rotas.atendimentos = telaAtendimentos;
  A.registrarHub(rotas);
  window.QL_HUB = { cartaoInicio: cartaoInicio, preencherAtendimentos: preencherAtendimentos };
})();
