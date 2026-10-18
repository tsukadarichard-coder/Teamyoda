/* Painel QuadraLab — dashboard integrado e áreas de trabalho (consultorias, acompanhamento, contatos, pagamentos, contas, academias, sistema).
   Todo dado vem das functions admin-* com o segredo no cabeçalho x-admin-secret. O segredo fica em memória (e na aba, se o administrador pedir).
   Tudo que vem do servidor passa por esc() antes de entrar no HTML. */
(function () {
  "use strict";
  var segredo = "", cache = {}, TTL = 60000, secaoAtual = "", ultimaCarga = null;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function reais(c) { c = c || 0; return (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: c % 100 ? 2 : 0 }); }
  function dt(iso) { if (!iso) return "—"; var p = String(iso).slice(0, 10).split("-"); return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : String(iso); }
  function dthora(iso) { if (!iso) return "—"; try { return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (e) { return String(iso); } }
  function hojeISO() { var d = new Date(Date.now() - 3 * 3600 * 1000); return d.toISOString().slice(0, 10); }
  function idadeDias(iso) { if (!iso) return 0; return Math.max(0, Math.round((Date.parse(hojeISO() + "T12:00:00Z") - Date.parse(String(iso).slice(0, 10) + "T12:00:00Z")) / 86400000)); }
  function n(v) { return (v == null ? 0 : v).toLocaleString("pt-BR"); }
  function toast(t, erro) { var e = $("#toast"); e.textContent = t; e.className = "toast" + (erro ? " erro" : ""); e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { e.hidden = true; }, 5000); }

  /* ── servidor ── */
  async function chamar(nome, op) {
    op = op || {};
    var r;
    try { r = await fetch("/.netlify/functions/" + nome + (op.qs || ""), { method: op.corpo ? "POST" : "GET", headers: Object.assign({ "x-painel": "1", "content-type": "application/json" }, segredo ? { "x-admin-secret": segredo } : {}), body: op.corpo ? JSON.stringify(op.corpo) : undefined }); }
    catch (e) { throw new Error("Sem conexão. Verifique a internet e tente de novo."); }
    var j = await r.json().catch(function () { return {}; });
    if (r.status === 401 && $("#app").hidden === false) { sair("Sessão recusada pelo servidor. Entre de novo."); throw new Error(j.erro || "Não autorizado."); }
    if (!r.ok) throw new Error(j.erro || "Erro " + r.status);
    return j;
  }
  async function carregar(chave, nome, qs, forcar) {
    var c = cache[chave + qs];
    if (!forcar && c && Date.now() - c.em < TTL) return c.dado;
    var d = await chamar(nome, { qs: qs });
    cache[chave + qs] = { em: Date.now(), dado: d };
    if (chave === "resumo") { ultimaCarga = new Date(); atualizarBadges(d); }
    return d;
  }
  function invalidar() { cache = {}; }

  /* ── entrada e saída ── */
  /* Entrada: o segredo é digitado uma vez. Com "Manter conectado", o servidor grava um cookie de sessão (HttpOnly, 30 dias, só deste aparelho):
     o segredo não fica guardado em lugar nenhum e o JavaScript da página não consegue ler o cookie. Sem a opção, o segredo vive só na memória da aba. */
  function sair(msg, semAviso) {
    segredo = ""; cache = {};
    if (!semAviso) fetch("/.netlify/functions/admin-sessao", { method: "POST", headers: { "x-painel": "1", "content-type": "application/json" }, body: JSON.stringify({ acao: "sair" }) }).catch(function () { /* sem conexão: o cookie vence sozinho */ });
    $("#app").hidden = true; $("#entrada").hidden = false; $("#segredo").value = "";
    var er = $("#erroEntrada"); if (msg) { er.textContent = msg; er.hidden = false; } else er.hidden = true;
  }
  function mostrarApp() { $("#entrada").hidden = true; $("#app").hidden = false; rotear(); }
  async function entrar(valor, manter) {
    if (manter) {
      var r = await fetch("/.netlify/functions/admin-sessao", { method: "POST", headers: { "x-painel": "1", "x-admin-secret": valor, "content-type": "application/json" }, body: JSON.stringify({ acao: "entrar" }) }).catch(function () { throw new Error("Sem conexão. Verifique a internet e tente de novo."); });
      var j = await r.json().catch(function () { return {}; });
      if (!r.ok) throw new Error(j.erro || "Erro " + r.status);
      segredo = ""; // a sessão passa a ser o cookie
      await chamar("admin-painel", { qs: "?secao=ping" });
    } else { segredo = valor; await chamar("admin-painel", { qs: "?secao=ping" }); }
    mostrarApp();
  }
  $("#fEntrar").addEventListener("submit", async function (ev) {
    ev.preventDefault();
    var er = $("#erroEntrada"); er.hidden = true;
    var v = $("#segredo").value.trim(); if (!v) { er.textContent = "Informe o segredo de administrador."; er.hidden = false; return; }
    var bt = $("#btEntrar"); bt.disabled = true; bt.textContent = "Entrando…";
    try { await entrar(v, $("#manter").checked); } catch (e) { segredo = ""; er.textContent = e.message; er.hidden = false; }
    $("#segredo").value = "";
    bt.disabled = false; bt.textContent = "Entrar";
  });
  $("#btSair").addEventListener("click", function () { sair(); });
  $("#btAtualizar").addEventListener("click", function () { invalidar(); rotear(true); });
  $("#btMenu").addEventListener("click", function () { var m = $("#menu"), a = m.classList.toggle("aberto"); this.setAttribute("aria-expanded", String(a)); });
  /* já conectado neste aparelho? (cookie de sessão válido) entra sem pedir o segredo; a sessão é renovada sozinha */
  fetch("/.netlify/functions/admin-sessao", { headers: { "x-painel": "1" } }).then(function (r) { if (r.ok) { segredo = ""; mostrarApp(); } }).catch(function () { /* sem conexão: fica na tela de entrada */ });

  /* ── dica (tooltip) dos gráficos ── */
  var dica = $("#dica");
  document.addEventListener("mousemove", function (ev) {
    var t = ev.target.closest && ev.target.closest("[data-dica]");
    if (!t) { dica.hidden = true; return; }
    dica.textContent = t.getAttribute("data-dica"); dica.hidden = false;
    var x = Math.min(window.innerWidth - dica.offsetWidth - 8, ev.clientX + 14); dica.style.left = Math.max(8, x) + "px"; dica.style.top = (ev.clientY + 16) + "px";
  });

  /* ── roteamento ── */
  function lerHash() {
    var h = location.hash.replace(/^#\/?/, ""), partes = h.split("?"), caminho = partes[0].split("/"), q = {};
    (partes[1] || "").split("&").forEach(function (p) { if (!p) return; var kv = p.split("="); q[decodeURIComponent(kv[0])] = decodeURIComponent((kv[1] || "").replace(/\+/g, " ")); });
    return { s: caminho[0] || "visao", sub: caminho[1] || "", q: q };
  }
  function irPara(secao, q, sub) {
    var qs = Object.keys(q || {}).filter(function (k) { return q[k]; }).map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(q[k]); }).join("&");
    var alvo = "#/" + secao + (sub ? "/" + sub : "") + (qs ? "?" + qs : "");
    if (location.hash === alvo) rotear(); else location.hash = alvo;
  }
  window.addEventListener("hashchange", function () { if (!$("#app").hidden) rotear(); });
  var TELAS = {};
  async function rotear(forcar) {
    var h = lerHash(), f = TELAS[h.s] ? h.s : "visao"; secaoAtual = f;
    $$("#menu a").forEach(function (a) { if (a.getAttribute("data-s") === f || (f === "usuarios" && a.getAttribute("data-s") === "usuarios")) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    $("#menu").classList.remove("aberto"); $("#btMenu").setAttribute("aria-expanded", "false");
    var c = $("#conteudo"); c.innerHTML = '<p class="carregando">Carregando…</p>';
    try {
      if (f !== "visao" && !cache["resumo"]) carregar("resumo", "admin-painel", "?secao=resumo").catch(function () { /* os contadores do menu são um extra */ });
      await TELAS[f](h, !!forcar);
    } catch (e) { c.innerHTML = '<div class="aviso erro" role="alert">' + esc(e.message) + '</div><div class="acoes"><button type="button" class="bt claro" id="btTentar">Tentar de novo</button></div>'; var b = $("#btTentar"); if (b) b.onclick = function () { invalidar(); rotear(true); }; }
    if (ultimaCarga) $("#atualizadoEm").textContent = "Atualizado às " + ultimaCarga.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    window.scrollTo(0, 0); c.focus({ preventScroll: true });
  }
  function atualizarBadges(r) {
    var tot = {}; (r.precisaDeVoce || []).forEach(function (p) { tot[p.secao] = (tot[p.secao] || 0) + p.n; });
    $$("[data-b]").forEach(function (b) { var v = tot[b.getAttribute("data-b")]; b.hidden = !v; b.textContent = v || ""; b.setAttribute("aria-label", v ? v + " pendente(s)" : ""); });
  }
  function cabeca(titulo, sub, acoes) { return '<div class="cabeca"><div><h1>' + esc(titulo) + "</h1>" + (sub ? '<p class="sub">' + esc(sub) + "</p>" : "") + "</div>" + (acoes || "") + "</div>"; }

  /* ── gráficos (SVG, uma escala, marcas finas, dica ao passar o mouse e tabela alternativa) ── */
  function escalaMax(v) { if (v <= 0) return 1; var e = Math.pow(10, Math.floor(Math.log(v) / Math.LN10)), f = v / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e; }
  var COR = { azul: "#1242CC", verde: "#2E8B57" };
  function graficoBarras(titulo, nota, dados, fmt, aria) {
    var W = 440, H = 200, pl = 40, pb = 26, pt = 10, pr = 8, max = escalaMax(Math.max.apply(null, dados.map(function (d) { return d.n; }).concat([0]))), area = H - pb - pt, w = (W - pl - pr) / dados.length, bw = Math.min(34, w * 0.62);
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(aria) + '">';
    [0, 0.5, 1].forEach(function (f) { var y = pt + area * (1 - f); s += '<line class="' + (f ? "grade-l" : "eixo") + '" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y + '" y2="' + y + '"/><text x="' + (pl - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + esc(fmt(max * f)) + "</text>"; });
    dados.forEach(function (d, i) {
      var h = area * (d.n / max), x = pl + w * i + (w - bw) / 2, y = pt + area - h;
      s += '<rect class="barra" x="' + x + '" y="' + (d.n ? y : pt + area - 1) + '" width="' + bw + '" height="' + (d.n ? Math.max(h, 2) : 1) + '" rx="4" fill="' + COR.azul + '" data-dica="' + esc(d.rot + ": " + fmt(d.n)) + '"/>';
      if (!(dados.length > 8 && String(d.eixo).length > 3 && (dados.length - 1 - i) % 2)) s += '<text x="' + (x + bw / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(d.eixo) + "</text>";
    });
    s += "</svg>";
    return '<figure class="graf" style="margin:0"><h3>' + esc(titulo) + '</h3><p class="nota">' + esc(nota) + "</p>" + s + tabelaAlt(["Período", titulo], dados.map(function (d) { return [d.rot, fmt(d.n)]; })) + "</figure>";
  }
  function graficoEmpilhado(titulo, nota, dados, fmt, legenda, aria) {
    var W = 440, H = 200, pl = 64, pb = 26, pt = 10, pr = 8, max = escalaMax(Math.max.apply(null, dados.map(function (d) { return d.a + d.b; }).concat([0]))), area = H - pb - pt, w = (W - pl - pr) / dados.length, bw = Math.min(46, w * 0.6);
    var s = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(aria) + '">';
    [0, 0.5, 1].forEach(function (f) { var y = pt + area * (1 - f); s += '<line class="' + (f ? "grade-l" : "eixo") + '" x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y + '" y2="' + y + '"/><text x="' + (pl - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + esc(fmt(max * f)) + "</text>"; });
    dados.forEach(function (d, i) {
      var x = pl + w * i + (w - bw) / 2, ha = area * (d.a / max), hb = area * (d.b / max), yb = pt + area - hb, ya = yb - ha - (d.a && d.b ? 2 : 0), tip = d.rot + " · " + legenda[0] + ": " + fmt(d.a) + " · " + legenda[1] + ": " + fmt(d.b);
      if (d.b) s += '<rect class="barra" x="' + x + '" y="' + yb + '" width="' + bw + '" height="' + Math.max(hb, 2) + '" rx="4" fill="' + COR.verde + '" data-dica="' + esc(tip) + '"/>';
      if (d.a) s += '<rect class="barra" x="' + x + '" y="' + ya + '" width="' + bw + '" height="' + Math.max(ha, 2) + '" rx="4" fill="' + COR.azul + '" data-dica="' + esc(tip) + '"/>';
      if (!d.a && !d.b) s += '<rect x="' + x + '" y="' + (pt + area - 1) + '" width="' + bw + '" height="1" fill="#C9D3CD" data-dica="' + esc(d.rot + ": " + fmt(0)) + '"/>';
      if (!(dados.length > 8 && String(d.eixo).length > 3 && (dados.length - 1 - i) % 2)) s += '<text x="' + (x + bw / 2) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(d.eixo) + "</text>";
    });
    s += "</svg>";
    return '<figure class="graf" style="margin:0"><h3>' + esc(titulo) + '</h3><p class="nota">' + esc(nota) + '</p><div class="legenda"><span><i style="background:' + COR.azul + '"></i>' + esc(legenda[0]) + '</span><span><i style="background:' + COR.verde + '"></i>' + esc(legenda[1]) + "</span></div>" + s +
      tabelaAlt(["Mês", legenda[0], legenda[1]], dados.map(function (d) { return [d.rot, fmt(d.a), fmt(d.b)]; })) + "</figure>";
  }
  function tabelaAlt(cab, linhas) {
    return '<details><summary>Ver como tabela</summary><div class="tabela-rolagem"><table><thead><tr>' + cab.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") + "</tr></thead><tbody>" + linhas.map(function (l) { return "<tr>" + l.map(function (c) { return "<td>" + esc(c) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div></details>";
  }
  function semanaRot(s) { return dt(s).slice(0, 5); }
  var MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

  /* ── CSV ── */
  function baixarCsv(nome, cab, linhas) {
    function cel(v) { v = v == null ? "" : String(v); return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    var txt = "﻿" + [cab].concat(linhas).map(function (l) { return l.map(cel).join(";"); }).join("\r\n");
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" })); a.download = nome + "-" + hojeISO() + ".csv"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  /* ══ Visão geral ══ */
  function kpi(num, rot, azul) { return '<div class="kpi"><div class="n' + (azul ? " azul" : "") + (/^R\$/.test(num) ? " moeda" : "") + '">' + esc(num) + '</div><div class="r">' + esc(rot) + "</div></div>"; }
  function produto(titulo, link, rotuloLink, kpis) { return '<section class="produto"><header><h3>' + esc(titulo) + '</h3><a href="' + link + '">' + esc(rotuloLink) + '</a></header><div class="kpis">' + kpis.join("") + "</div></section>"; }
  TELAS.visao = async function (h, forcar) {
    var r = await carregar("resumo", "admin-painel", "?secao=resumo", forcar), c = $("#conteudo");
    var p = r.player, k = r.competicao, co = r.consultorias, ac = r.acompanhamentos, ct = r.contatos, ad = r.academias;
    var hero = '<div class="hero" aria-label="Financeiro consolidado"><div><div class="n lima">' + esc(reais(r.financeiro.confirmadoCentavos)) + '</div><div class="r">Confirmado (consultorias e parcelas do Acompanhamento)</div></div><div><div class="n">' + esc(reais(r.financeiro.aReceberCentavos)) + '</div><div class="r">A receber nos pedidos e ciclos em aberto</div></div><div><div class="n">' + n(co.emAberto + ac.emAberto + ct.novos) + '</div><div class="r">Itens em aberto: ' + n(co.emAberto) + " consultorias, " + n(ac.emAberto) + " acompanhamentos, " + n(ct.novos) + ' contatos novos</div></div><p class="nota">' + esc(r.financeiro.nota) + "</p></div>";
    var pend = r.precisaDeVoce.length ? '<ul class="pend">' + r.precisaDeVoce.map(function (x) {
      return '<li><a href="#/' + x.secao + (x.filtro ? "?estado=" + encodeURIComponent(x.filtro) : "") + '"><span class="n">' + n(x.n) + "</span><span>" + esc(x.titulo) + '</span><span class="nivel ' + x.nivel + '">' + { alto: "Alta", medio: "Média", baixo: "Baixa" }[x.nivel] + "</span></a></li>";
    }).join("") + "</ul>" : '<p class="vazio">Nada pendente agora. Os contadores aparecem aqui quando algo precisar de você.</p>';
    var prods = '<div class="grade duas">' +
      produto("QuadraLab Player", "#/usuarios?papel=player", "Ver contas", [kpi(n(p.contas), "contas (todas)", true), kpi(n(p.novas7), "novas nos últimos 7 dias (" + n(p.novas30) + " em 30)"), kpi(n(p.assinaturasAtivas), "assinaturas ativas"), kpi(n(p.venceEm7), "vencem em 7 dias"), kpi(n(p.comFicha), "com ficha preenchida"), kpi(n(p.registros.planos), "planos de jogo criados")]) +
      produto("QuadraLab Competição", "#/usuarios?papel=atleta", "Ver contas", [kpi(n(k.papeis.atleta), "atletas (" + n(k.menores) + " menores de idade)", true), kpi(n(k.papeis.responsavel), "responsáveis"), kpi(n(k.papeis.treinador), "treinadores"), kpi(n(k.vinculos.ativos), "vínculos ativos"), kpi(n(k.vinculos.aguardando), "vínculos aguardando aprovação"), kpi(n(k.registros.torneios), "torneios cadastrados")]) +
      produto("Consultorias avulsas", "#/consultorias", "Abrir", [kpi(n(co.emAberto), "pedidos em aberto", true), kpi(n(co.porEstado.aguardando_pagamento || 0), "aguardando pagamento (" + reais(co.aReceberCentavos) + ")"), kpi(reais(co.receitaConfirmadaCentavos), "confirmado"), kpi(n(co.total), "pedidos no total")]) +
      produto("Acompanhamento MTY", "#/acompanhamentos", "Abrir", [kpi(n(ac.ativos), "ciclos em andamento", true), kpi(n((ac.porEstado.aguardando_inicio || 0)), "pagos, aguardando início"), kpi(reais(ac.recebidoCentavos), "recebido em parcelas"), kpi(reais(ac.aReceberCentavos), "parcelas a receber"), kpi(n(ac.duvidasSemResposta), "dúvidas sem resposta (" + n(ac.duvidasAtrasadas) + " fora do prazo)"), kpi(n(ac.encontrosProximos.length), "encontros nos próximos 7 dias")]) +
      produto("Treinador e academias", "#/academias", "Abrir", [kpi(n(ad.total), "academias", true), kpi(n(ad.alunos), "jogadores/alunos cadastrados"), kpi(n(ad.vencidas), "licenças vencidas"), kpi(n(ad.vencendo14), "vencem em 14 dias"), kpi(n(ad.pendentes), "treinadores aguardando aprovação"), kpi(r.scoutsAoVivo == null ? "—" : n(r.scoutsAoVivo), "scouts ao vivo agora")]) +
      produto("Página de vendas", "#/contatos", "Abrir", [kpi(n(ct.novos), "contatos novos", true), kpi(n(ct.ult7), "recebidos em 7 dias"), kpi(n(ct.total), "contatos no total"), kpi(n(ct.porServico.acompanhamento || 0), "interessados no Acompanhamento")]) + "</div>";
    var graf = '<div class="grade graficos">' + graficoBarras("Novas contas por semana", "Player e Competição, últimas 8 semanas.", p.seriesNovas.map(function (s) { return { rot: "Semana de " + dt(s.semana), eixo: semanaRot(s.semana), n: s.n }; }), n, "Gráfico de barras das novas contas por semana") +
      graficoEmpilhado("Recebimentos confirmados por mês", "Últimos 6 meses, pelo preço de cada serviço.", r.financeiro.porMes.map(function (m) { var mm = parseInt(m.mes.slice(5), 10); return { rot: MESES[mm - 1] + "/" + m.mes.slice(0, 4), eixo: MESES[mm - 1], a: m.consultorias, b: m.acompanhamento }; }), reais, ["Consultorias", "Acompanhamento MTY"], "Gráfico de barras empilhadas dos recebimentos por mês") +
      graficoBarras("Contatos da página de vendas por semana", "Últimas 8 semanas.", ct.seriesNovas.map(function (s) { return { rot: "Semana de " + dt(s.semana), eixo: semanaRot(s.semana), n: s.n }; }), n, "Gráfico de barras dos contatos por semana") + "</div>";
    var prox = ac.encontrosProximos.length ? '<div class="tabela-rolagem"><table><thead><tr><th>Quando</th><th>Atleta</th><th>Encontro</th></tr></thead><tbody>' + ac.encontrosProximos.map(function (e) { return "<tr><td>" + esc(dt(e.data) + " " + (e.hora || "")) + "</td><td>" + esc(e.atleta) + "</td><td>" + esc(e.rotulo) + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<p class="nota">Nenhum encontro agendado para os próximos 7 dias.</p>';
    var ativ = '<ul class="pend">' + r.atividade.map(function (a) { return '<li><a href="#/' + a.secao + '"><span class="nivel baixo">' + esc(a.tipo) + "</span><span>" + esc(a.texto) + '</span><span class="nota">' + esc(dthora(a.em)) + "</span></a></li>"; }).join("") + "</ul>";
    c.innerHTML = cabeca("Visão geral", "Todos os produtos QuadraLab num só lugar. Gerado em " + dthora(r.geradoEm) + ".") + hero +
      '<section class="secao"><h2>Precisa de você</h2>' + pend + "</section>" + '<section class="secao"><h2>Produtos</h2>' + prods + "</section>" + '<section class="secao"><h2>Evolução</h2>' + graf + "</section>" +
      '<div class="grade duas"><section class="secao"><h2>Próximos encontros</h2>' + prox + '</section><section class="secao"><h2>Atividade recente</h2>' + (r.atividade.length ? ativ : '<p class="nota">Sem atividade ainda.</p>') + "</section></div>" +
      (r.erros && r.erros.length ? '<div class="aviso atencao" style="margin-top:16px">Parte dos números não pôde ser lida: ' + esc(r.erros.join(", ")) + ".</div>" : "") + (p.truncado ? '<div class="aviso atencao" style="margin-top:16px">Há mais contas que o limite de leitura: os números do Player são parciais.</div>' : "");
  };

  /* ══ componentes de lista ══ */
  function chips(lista, atual, contagem, grupo) {
    return '<div class="chips" role="group" aria-label="Filtrar por situação">' + lista.map(function (x) { return '<button type="button" class="chip" data-chip="' + esc(x[0]) + '" aria-pressed="' + (x[0] === atual) + '">' + esc(x[1]) + "<b>" + n(contagem(x[0])) + "</b></button>"; }).join("") + "</div>";
  }
  function ligarFiltros(secao, q, extra) {
    $$("[data-chip]").forEach(function (b) { b.addEventListener("click", function () { var nq = Object.assign({}, q); nq.estado = b.getAttribute("data-chip"); irPara(secao, nq); }); });
    var f = $("#fBusca");
    if (f) f.addEventListener("submit", function (ev) { ev.preventDefault(); var nq = Object.assign({}, q); nq.q = $("#busca").value.trim(); if ($("#ordem")) nq.ord = $("#ordem").value; irPara(secao, nq); });
    var o = $("#ordem"); if (o) o.addEventListener("change", function () { var nq = Object.assign({}, q); nq.ord = o.value; nq.q = $("#busca").value.trim(); irPara(secao, nq); });
  }
  function barraBusca(q, ordens, csv) {
    return '<form id="fBusca" class="barra-filtro" role="search"><div><label for="busca">Buscar</label><input id="busca" type="search" value="' + esc(q.q || "") + '" placeholder="Nome, e-mail, serviço…" autocomplete="off"></div>' +
      (ordens ? '<div><label for="ordem">Ordenar</label><select id="ordem">' + ordens.map(function (o) { return '<option value="' + o[0] + '"' + ((q.ord || ordens[0][0]) === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select></div>" : "<span></span>") +
      '<div class="acoes" style="margin:0"><button class="bt azul" type="submit">Buscar</button>' + (csv ? '<button class="bt claro" type="button" id="btCsv">Exportar CSV</button>' : "") + "</div></form>";
  }

  /* ══ Consultorias ══ */
  var EST_PED = [["", "Todos"], ["aguardando_responsavel", "Aguardando o responsável"], ["aguardando_pagamento", "Aguardando pagamento"], ["pago", "Pago"], ["em_andamento", "Em andamento"], ["entregue", "Entregue"], ["cancelado", "Cancelado"], ["reembolsado", "Reembolsado"]];
  var CLASSE_PED = { aguardando_responsavel: "espera", aguardando_pagamento: "espera", pago: "info", em_andamento: "info", entregue: "ok", cancelado: "neutro", reembolsado: "neutro" };
  function rotuloPed(e) { return (EST_PED.filter(function (x) { return x[0] === e; })[0] || [e, e])[1]; }
  TELAS.consultorias = async function (h, forcar) {
    var d = await carregar("pedidos", "admin-pedidos", "", forcar), q = h.q, c = $("#conteudo"), est = q.estado || "";
    var todos = d.pedidos;
    function atrasado(p) { var dias = idadeDias(p.estado === "aguardando_pagamento" ? p.criadoEm : p.pagoEm || p.criadoEm); return (p.estado === "aguardando_pagamento" && dias >= 3) || (["pago", "em_andamento"].indexOf(p.estado) >= 0 && dias >= 5); }
    var lista = todos.filter(function (p) { return (!est || p.estado === est) && (!q.q || (p.nome + " " + p.atletaNome + " " + (p.pagadorNome || "") + " " + (p.pagadorEmail || "")).toLowerCase().indexOf(q.q.toLowerCase()) >= 0); });
    var ord = q.ord || "novos";
    lista.sort(function (a, b) { return ord === "antigos" ? String(a.criadoEm).localeCompare(String(b.criadoEm)) : ord === "parados" ? (atrasado(b) - atrasado(a)) || String(a.criadoEm).localeCompare(String(b.criadoEm)) : String(b.criadoEm).localeCompare(String(a.criadoEm)); });
    var sem = (d.pagamentosSemPedido || []).length ? '<section class="secao"><h2>Pagamentos da Eduzz sem pedido</h2><p class="nota">O e-mail do pagador não bateu com nenhum pedido. Vincule ao pedido certo.</p>' + d.pagamentosSemPedido.map(function (x) {
      var cand = todos.filter(function (p) { return p.estado === "aguardando_pagamento" && p.consultoriaId === x.consultoriaId; });
      return '<div class="item"><p>' + esc(x.email) + " · fatura " + esc(x.faturaId) + " · " + esc(dthora(x.recebidoEm)) + '</p><p class="meta">' + esc(x.motivo) + '</p><div class="acoes"><select data-sp="' + esc(x.id) + '" aria-label="Pedido para vincular"><option value="">Escolher pedido…</option>' + cand.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.nome + " · " + p.atletaNome + " · " + dt(p.criadoEm)) + "</option>"; }).join("") + '</select><button class="bt azul pequeno" data-vincular="' + esc(x.id) + '">Vincular</button></div></div>';
    }).join("") + "</section>" : "";
    c.innerHTML = cabeca("Consultorias avulsas", "Pedidos feitos pelo aplicativo: pagamento, entrega e histórico.") + sem +
      '<div class="filtros">' + chips(EST_PED, est, function (e) { return e ? todos.filter(function (p) { return p.estado === e; }).length : todos.length; }) + barraBusca(q, [["novos", "Mais novos"], ["antigos", "Mais antigos"], ["parados", "Parados há mais tempo"]], true) + "</div>" +
      '<p class="nota">' + n(lista.length) + " de " + n(todos.length) + " pedido(s).</p>" + (lista.length ? lista.map(function (p) { return cartaoPedido(p, d.transicoes, atrasado(p)); }).join("") : '<div class="cartao" style="margin-top:12px"><p>Nenhum pedido neste filtro.</p></div>');
    ligarFiltros("consultorias", q);
    $("#btCsv").onclick = function () { baixarCsv("consultorias", ["id", "criado em", "serviço", "valor (R$)", "situação", "atleta", "menor de idade", "pagador", "e-mail do pagador", "pago em", "pago por"], lista.map(function (p) { return [p.id, p.criadoEm, p.nome, (p.precoCentavos / 100).toFixed(2).replace(".", ","), rotuloPed(p.estado), p.atletaNome, p.menor ? "sim" : "não", p.pagadorNome || "", p.pagadorEmail || "", p.pagoEm || "", p.pagoPor || ""]; })); };
    $$("[data-vincular]").forEach(function (b) { b.onclick = async function () { var sel = $('[data-sp="' + b.getAttribute("data-vincular") + '"]'); if (!sel.value) { toast("Escolha o pedido.", true); return; } try { await chamar("admin-pedidos", { corpo: { acao: "vincularPagamento", faturaId: b.getAttribute("data-vincular"), pedidoId: sel.value } }); toast("Pagamento vinculado."); invalidar(); rotear(true); } catch (e) { toast(e.message, true); } }; });
    $$("[data-salvar-ped]").forEach(function (b) { b.onclick = function () { salvarPedido(b, d.transicoes); }; });
  };
  function cartaoPedido(p, transicoes, atraso) {
    var ctx = p.contexto || {}, dias = idadeDias(p.criadoEm), aberto = ["aguardando_responsavel", "aguardando_pagamento", "pago", "em_andamento"].indexOf(p.estado) >= 0;
    var perm = transicoes[p.estado] || [];
    var det = "";
    if (ctx.observacao) det += '<p class="rot">Mensagem do atleta</p><div class="bloco">' + esc(ctx.observacao) + "</div>";
    if (ctx.torneio) det += '<p class="rot">Torneio</p><div class="bloco">' + esc(ctx.torneio.nome + " · " + [ctx.torneio.inicio, ctx.torneio.fim].filter(Boolean).map(dt).join(" a ") + (ctx.torneio.cidade ? " · " + ctx.torneio.cidade : "")) + "</div>";
    if (ctx.partidas && ctx.partidas.length) det += '<p class="rot">Partidas compartilhadas</p>' + ctx.partidas.map(function (x) { return '<div class="bloco">' + esc(dt(x.data) + " · contra " + (x.adversario || "—") + " · " + x.resultado + " " + (x.placar || "")) + "</div>"; }).join("");
    if (ctx.scouts && ctx.scouts.length) det += '<p class="rot">Scouts do treinador</p>' + ctx.scouts.map(function (x) { return '<div class="bloco">' + esc(x.rotulo + " · " + dt(x.data)) + "</div>"; }).join("");
    if (ctx.devolutivas && ctx.devolutivas.length) det += '<p class="rot">Devolutivas</p>' + ctx.devolutivas.map(function (x) { return '<div class="bloco">' + esc(x.refRotulo + " · " + x.autorNome + "\nBem: " + x.destaques + "\nMelhorar: " + x.melhorar + (x.foco ? "\nFoco: " + x.foco : "")) + "</div>"; }).join("");
    if (ctx.perfil && ctx.perfil.length) det += '<p class="rot">Perfil do atleta</p><div class="bloco">' + esc(ctx.perfil.map(function (x) { return x.rotulo + ": " + x.valor; }).join("\n")) + "</div>";
    if (ctx.links && ctx.links.length) det += '<p class="rot">Vídeos</p>' + ctx.links.map(function (u) { return '<div class="bloco"><a href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(u) + "</a></div>"; }).join("");
    var form = perm.length || p.estado === "pago" || p.estado === "em_andamento" ? '<p class="rot">Atualizar</p><div class="campos duas" data-form-ped="' + esc(p.id) + '"><select class="f-estado" aria-label="Mudar situação"><option value="">Manter a situação</option>' + perm.map(function (s) { return '<option value="' + s + '">' + esc(rotuloPed(s)) + "</option>"; }).join("") + '</select><input class="f-nota" placeholder="Nota interna (opcional)" maxlength="500"><textarea class="f-entrega" placeholder="Entrega para o atleta (texto)" maxlength="4000">' + esc((p.entrega && p.entrega.texto) || "") + '</textarea><input class="f-link" type="url" placeholder="Link da entrega (https://)" maxlength="300" value="' + esc((p.entrega && p.entrega.link) || "") + '"></div><div class="acoes"><button class="bt azul pequeno" data-salvar-ped="' + esc(p.id) + '">Salvar</button></div>' : "";
    var hist = (p.historico || []).slice(-6).reverse().map(function (x) { return '<div class="bloco">' + esc(dthora(x.em) + " · " + x.por + " · " + x.acao) + "</div>"; }).join("");
    return '<article class="item" id="ped-' + esc(p.id) + '"><div class="item-topo"><span class="estado ' + (CLASSE_PED[p.estado] || "neutro") + '">' + esc(rotuloPed(p.estado)) + "</span>" + (aberto ? '<span class="idade' + (atraso ? " atraso" : "") + '">' + (atraso ? "Parado: " : "") + "há " + dias + (dias === 1 ? " dia" : " dias") + "</span>" : "") + "</div><h3>" + esc(p.nome) + " · " + esc(reais(p.precoCentavos)) + '</h3><p class="meta">Atleta: ' + esc(p.atletaNome) + (p.menor ? " (menor de idade)" : "") + " · pagador: " + esc(p.pagadorNome || "—") + (p.pagadorEmail ? " &lt;" + esc(p.pagadorEmail) + "&gt;" : "") + " · pedido em " + esc(dt(p.criadoEm)) + (p.pagoEm ? " · pago em " + esc(dt(p.pagoEm)) + " (" + esc(p.pagoPor || "") + ")" : "") + '</p><details><summary>Abrir pedido</summary>' + det + form + (hist ? '<p class="rot">Histórico</p>' + hist : "") + "</details></article>";
  }
  async function salvarPedido(b, transicoes) {
    var id = b.getAttribute("data-salvar-ped"), f = $('[data-form-ped="' + id + '"]'), estado = $(".f-estado", f).value, corpo = { acao: "atualizar", id: id, nota: $(".f-nota", f).value };
    if (estado) corpo.estado = estado;
    var tx = $(".f-entrega", f).value.trim(), lk = $(".f-link", f).value.trim(); if (tx || lk) corpo.entrega = { texto: tx, link: lk };
    if (estado === "pago") { if (!window.confirm("Confirmar que você RECEBEU o pagamento deste pedido?")) return; corpo.confirmoPagamento = true; }
    if (estado === "reembolsado" && !window.confirm("Marcar como reembolsado?")) return;
    b.disabled = true;
    try { await chamar("admin-pedidos", { corpo: corpo }); toast("Pedido atualizado."); invalidar(); rotear(true); } catch (e) { toast(e.message, true); b.disabled = false; }
  }

  /* ══ Olhar do treinador ══
     Fila dos pedidos pagos, ficha e estratégia copiadas na contratação, envio do áudio/vídeo ao armazenamento privado e publicação.
     Nada é publicado sozinho: só o botão "Publicar devolutiva", com confirmação, libera a resposta ao jogador. */
  var EST_OL = [["", "Todos"], ["recebido", "Recebidos"], ["em_analise", "Em análise"], ["devolutiva_disponivel", "Entregues"], ["reembolsado", "Reembolsados"]];
  var CLASSE_OL = { recebido: "info", em_analise: "info", devolutiva_disponivel: "ok", reembolsado: "neutro" };
  function prazoOl(x) {
    if (x.estado !== "recebido" && x.estado !== "em_analise") return "";
    if (x.atrasado) return '<span class="idade atraso">Prazo vencido em ' + esc(dt(x.prazoEm)) + "</span>";
    return '<span class="idade">Prazo ' + esc(dt(x.prazoEm)) + (x.diasParaPrazo != null ? " (" + (x.diasParaPrazo === 0 ? "hoje" : "em " + x.diasParaPrazo + " d") + ")" : "") + "</span>";
  }
  TELAS.olhar = async function (h, forcar) {
    if (h.q.id) return telaOlharDetalhe(h.q.id);
    var d = await carregar("olhar", "admin-olhar", "", forcar), c = $("#conteudo"), est = h.q.estado || "", todos = d.fila;
    var lista = todos.filter(function (x) { return (!est || x.estado === est) && (!h.q.q || (x.nome + " " + x.email + " " + x.numero).toLowerCase().indexOf(h.q.q.toLowerCase()) >= 0); });
    var avisos = "";
    if (d.pendencias.length) avisos += '<div class="aviso atencao" role="alert">Alguém tentou pagar, mas o produto ainda não tem checkout da Eduzz configurado em <code>_player-olhar.js</code> (productId e link). O app avisou o jogador que o pagamento está indisponível.</div>';
    if (d.pagamentosSemPedido.length) avisos += '<section class="secao"><h2>Pagamentos da Eduzz sem pedido</h2><p class="nota">O e-mail do pagador não bateu com nenhum pedido aguardando pagamento. Vincule ao pedido certo.</p>' + d.pagamentosSemPedido.map(function (x) {
      return '<div class="item"><p>' + esc(x.email) + " · fatura " + esc(x.faturaId) + " · " + esc(dthora(x.recebidoEm)) + '</p><p class="meta">' + esc(x.motivo) + '</p><div class="acoes"><select data-sp-ol="' + esc(x.id) + '" aria-label="Pedido para vincular"><option value="">Vincular ao pedido…</option>' + d.aguardandoPagamento.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.numero + " · " + p.email) + "</option>"; }).join("") + '</select><button class="bt azul" type="button" data-vincular-ol="' + esc(x.id) + '">Vincular</button></div></div>';
    }).join("") + "</section>";
    c.innerHTML = cabeca("Olhar do treinador", "Devolutivas gravadas de 3 a 5 minutos, " + reais(d.produto.precoCentavos) + " por pedido (pagamento único). Prazo de " + d.produto.prazoDiasUteis + " dias úteis após a confirmação.", '<div class="acoes" style="margin:0"><button class="bt claro" type="button" id="btPrepArm">Preparar armazenamento</button></div>') + avisos +
      '<div class="filtros">' + chips(EST_OL, est, function (e) { return e ? todos.filter(function (x) { return x.estado === e; }).length : todos.length; }) + barraBusca(h.q, null, false) + "</div>" +
      '<p class="nota">' + n(lista.length) + " de " + n(todos.length) + " pedido(s) pagos. Aguardando pagamento: " + n(d.aguardandoPagamento.length) + ".</p>" +
      (lista.length ? lista.map(function (x) {
        return '<article class="item"><div class="item-topo"><span class="estado ' + (CLASSE_OL[x.estado] || "neutro") + '">' + esc(x.rotulo) + "</span>" + prazoOl(x) + '</div><h3><a href="#/olhar?id=' + esc(x.id) + '">' + esc(x.nome) + " · " + esc(x.numero) + "</a></h3>" +
          '<p class="meta">' + esc(x.estrategia) + " · confirmado em " + esc(dt(x.confirmadoEm)) + " · " + esc(x.pagamentoRotulo) + (x.temRascunho ? " · tem rascunho" : "") + "</p><p>" + esc(x.duvida) + '</p><div class="acoes"><a class="bt azul" href="#/olhar?id=' + esc(x.id) + '">Abrir pedido</a></div></article>';
      }).join("") : '<div class="cartao" style="margin-top:12px"><p>Nenhum pedido neste filtro.</p></div>');
    ligarFiltros("olhar", h.q);
    $("#btPrepArm").onclick = async function () {
      if (!window.confirm("Liberar o envio de arquivos do navegador para o armazenamento privado (CORS do bucket)? É feito uma vez.")) return;
      try { var r = await chamar("admin-olhar", { corpo: { acao: "prepararArmazenamento" } }); toast("Armazenamento preparado (" + r.bucket + ")."); } catch (e) { toast(e.message, true); }
    };
    $$("[data-vincular-ol]").forEach(function (b) { b.onclick = async function () { var sel = $('[data-sp-ol="' + b.getAttribute("data-vincular-ol") + '"]'); if (!sel.value) { toast("Escolha o pedido.", true); return; } try { await chamar("admin-olhar", { corpo: { acao: "vincularPagamento", faturaId: b.getAttribute("data-vincular-ol"), pedidoId: sel.value } }); toast("Pagamento vinculado."); invalidar(); rotear(true); } catch (e) { toast(e.message, true); } }; });
  };
  function tipoPorExtensao(f) {
    if (f.type) return f.type.toLowerCase();
    var e = String(f.name || "").split(".").pop().toLowerCase();
    return ({ mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", webm: "audio/webm", mp4: "video/mp4" })[e] || "";
  }
  function medirDuracao(f, tipo) {
    return new Promise(function (ok, err) {
      var el = document.createElement(tipo.indexOf("video/") === 0 ? "video" : "audio"), url = URL.createObjectURL(f);
      el.preload = "metadata";
      el.onloadedmetadata = function () {
        if (el.duration === Infinity) { el.currentTime = 1e101; el.ontimeupdate = function () { el.ontimeupdate = null; URL.revokeObjectURL(url); ok(el.duration); }; return; }
        URL.revokeObjectURL(url); ok(el.duration);
      };
      el.onerror = function () { URL.revokeObjectURL(url); err(new Error("Não foi possível ler este arquivo. Use MP3, M4A, AAC, WebM ou MP4.")); };
      el.src = url;
    });
  }
  function duracaoTxt(s) { return Math.floor(s / 60) + " min " + (s % 60) + " s"; }
  async function telaOlharDetalhe(id) {
    var d = await chamar("admin-olhar", { qs: "?id=" + encodeURIComponent(id) }), c = $("#conteudo"), s = d.snapshot, ficha = (s && s.ficha) || {}, est = s && s.estrategia && s.estrategia.plano;
    var fichaHtml = Object.keys(ficha).filter(function (k) { return k !== "adversario" && typeof ficha[k] === "string" && ficha[k]; }).map(function (k) { return "<div><dt>" + esc(k) + "</dt><dd>" + esc(ficha[k]) + "</dd></div>"; }).join("");
    var estHtml = est ? '<div class="bloco"><strong>' + esc(est.titulo || "") + "</strong>\n" + esc(est.resumo || "") + "</div>" + (est.diretrizes || []).map(function (x) { return '<div class="bloco"><strong>' + esc(x.titulo) + "</strong>\n" + esc(x.acao) + (x.porque ? "\nPor quê: " + esc(x.porque) : "") + "</div>"; }).join("") : '<p class="nota">A estratégia não pôde ser copiada na contratação' + (d.estrategiaPrevia ? " (prévia: " + esc(d.estrategiaPrevia.titulo) + ")" : "") + ".</p>";
    var aberto = d.estado === "recebido" || d.estado === "em_analise", r = d.rascunho || {}, pub = d.devolutiva;
    function midia(m) { return m && m.url ? (m.tipo === "video" ? '<video controls preload="metadata" playsinline src="' + esc(m.url) + '" style="width:100%;max-height:60vh"></video>' : '<audio controls preload="metadata" src="' + esc(m.url) + '" style="width:100%"></audio>') : (m && m.erroArquivo ? '<p class="nota">' + esc(m.erroArquivo) + "</p>" : ""); }
    var fora = r.duracaoSeg && (r.duracaoSeg < d.padrao.minSeg || r.duracaoSeg > d.padrao.maxSeg);
    c.innerHTML = '<p><a href="#/olhar">Voltar para a fila</a></p>' + cabeca("Pedido " + d.numero, d.nome + " · " + d.email) +
      '<section class="secao"><p><span class="estado ' + (CLASSE_OL[d.estado] || "neutro") + '">' + esc(d.rotulo) + "</span> " + prazoOl(d) + '</p><p class="meta">' + esc(d.pagamentoRotulo) + " · confirmado em " + esc(dt(d.confirmadoEm)) + " · prazo " + esc(dt(d.prazoEm)) + '</p>' +
      '<p class="rot">Dúvida principal</p><div class="bloco">' + esc(d.duvida) + "</div>" + (d.contexto ? '<p class="rot">Detalhe adicional</p><div class="bloco">' + esc(d.contexto) + "</div>" : "") + "</section>" +
      '<section class="secao"><h2>Estratégia (copiada na contratação)</h2>' + estHtml + "</section>" +
      '<section class="secao"><h2>Ficha do jogador (copiada na contratação)</h2>' + (fichaHtml ? '<dl class="ficha-dl">' + fichaHtml + "</dl>" : '<p class="nota">Sem ficha copiada.</p>') + "</section>" +
      (aberto ? '<section class="secao" id="areaDev"><h2>Devolutiva</h2><p class="nota">Áudio ou vídeo de 3 a 5 minutos. Formatos: ' + esc(d.limites.formatos) + ". Limites: áudio " + d.limites.audioMaxMB + " MB, vídeo " + d.limites.videoMaxMB + " MB. Arquivo privado: só o dono do pedido o abre, por link curto.</p>" +
        (d.estado === "recebido" ? '<div class="acoes"><button class="bt claro" type="button" id="btIniciarOl">Iniciar análise</button></div>' : "") +
        '<div class="campo"><label for="arqDev">Anexar áudio ou vídeo</label><input id="arqDev" type="file" accept=".mp3,.m4a,.aac,.webm,.mp4,audio/*,video/mp4,video/webm"></div><p class="nota" id="envioEstado" role="status"></p>' +
        (r.tipo ? '<div class="bloco"><strong>Arquivo anexado:</strong> ' + esc(r.tipo) + " · " + esc((r.tamanho / 1048576).toFixed(1)) + " MB · duração " + esc(duracaoTxt(r.duracaoSeg || 0)) + (fora ? '</div><div class="aviso atencao">A duração está fora da proposta de 3 a 5 minutos. Você pode publicar assim mesmo, com confirmação.' : "") + "</div>" + midia(r) : '<p class="nota">Nenhum arquivo anexado ainda.</p>') +
        '<div class="campo"><label for="resumoDev">Resumo escrito (opcional)</label><textarea id="resumoDev" rows="3" maxlength="1200">' + esc(r.resumo || "") + '</textarea></div>' +
        '<div class="acoes"><button class="bt claro" type="button" id="btSalvarOl">Salvar rascunho</button>' + (r.tipo ? '<button class="bt claro" type="button" id="btRemoverOl">Remover arquivo</button>' : "") + '<button class="bt azul" type="button" id="btPublicarOl"' + (r.tipo ? "" : " disabled") + ">Publicar devolutiva</button></div></section>" : "") +
      (pub ? '<section class="secao"><h2>Devolutiva publicada</h2><p class="meta">Publicada em ' + esc(dthora(pub.publicadaEm)) + " · " + (pub.vista ? "o jogador já abriu" : "o jogador ainda não abriu") + " · " + esc(duracaoTxt(pub.duracaoSeg || 0)) + "</p>" + midia(pub) + (pub.resumo ? '<div class="bloco">' + esc(pub.resumo) + "</div>" : "") + "</section>" : "") +
      '<section class="secao"><h2>Histórico</h2>' + (d.historico || []).map(function (x) { return '<div class="bloco">' + esc(dthora(x.em) + " · " + x.por + " · " + x.acao) + "</div>"; }).join("") + "</section>";
    function recarregar() { invalidar(); telaOlharDetalhe(id); }
    var bi = $("#btIniciarOl"); if (bi) bi.onclick = async function () { try { await chamar("admin-olhar", { corpo: { acao: "iniciar", id: id } }); recarregar(); } catch (e) { toast(e.message, true); } };
    var salvar = async function () { await chamar("admin-olhar", { corpo: { acao: "salvarRascunho", id: id, resumo: $("#resumoDev").value } }); };
    var bs = $("#btSalvarOl"); if (bs) bs.onclick = async function () { try { await salvar(); toast("Rascunho salvo."); } catch (e) { toast(e.message, true); } };
    var br = $("#btRemoverOl"); if (br) br.onclick = async function () { if (!window.confirm("Remover o arquivo do rascunho?")) return; try { await chamar("admin-olhar", { corpo: { acao: "removerArquivo", id: id } }); recarregar(); } catch (e) { toast(e.message, true); } };
    var inp = $("#arqDev");
    if (inp) inp.onchange = async function () {
      var f = inp.files[0], st = $("#envioEstado"); if (!f) return;
      try {
        var tipo = tipoPorExtensao(f); if (!tipo) throw new Error("Formato não reconhecido.");
        st.textContent = "Lendo o arquivo…"; var dur = Math.round(await medirDuracao(f, tipo));
        st.textContent = "Preparando o envio…"; var env = await chamar("admin-olhar", { corpo: { acao: "urlEnvio", id: id, contentType: tipo, tamanho: f.size } });
        st.textContent = "Enviando (" + (f.size / 1048576).toFixed(1) + " MB)…";
        var resp = await fetch(env.url, { method: "PUT", headers: env.cabecalhos, body: f });
        if (!resp.ok) throw new Error("O envio ao armazenamento falhou (" + resp.status + "). Se for a primeira vez, use “Preparar armazenamento”.");
        st.textContent = "Conferindo o arquivo…"; var reg = await chamar("admin-olhar", { corpo: { acao: "registrarArquivo", id: id, caminho: env.caminho, duracaoSeg: dur } });
        toast(reg.foraDoPadrao ? "Arquivo anexado, fora da proposta de 3 a 5 minutos." : "Arquivo anexado."); recarregar();
      } catch (e) { st.textContent = e.message; toast(e.message, true); }
    };
    var bp = $("#btPublicarOl"); if (bp) bp.onclick = async function () {
      if (!window.confirm("Publicar a devolutiva para " + d.nome + "? Ela passa a aparecer na conta do jogador.")) return;
      var corpo = { acao: "publicar", id: id, confirmo: true };
      if (fora && !window.confirm("O arquivo tem " + duracaoTxt(r.duracaoSeg) + ", fora da proposta de 3 a 5 minutos. Publicar assim mesmo?")) return;
      if (fora) corpo.confirmoForaDoPadrao = true;
      bp.disabled = true;
      try { await salvar(); await chamar("admin-olhar", { corpo: corpo }); toast("Devolutiva publicada."); recarregar(); } catch (e) { toast(e.message, true); bp.disabled = false; }
    };
  }

  /* ══ Acompanhamento MTY ══ */
  var EST_AC = [["", "Todos"], ["aguardando_responsavel", "Aguardando o responsável"], ["aguardando_pagamento", "Aguardando pagamento"], ["aguardando_inicio", "Aguardando início"], ["ativo", "Em andamento"], ["encerrado", "Encerrado"], ["cancelado", "Cancelado"]];
  var CLASSE_AC = { aguardando_responsavel: "espera", aguardando_pagamento: "espera", aguardando_inicio: "info", ativo: "ok", encerrado: "neutro", cancelado: "neutro" };
  var ROT_ENC = { a_agendar: "a agendar", agendado: "agendado", realizado: "realizado", cancelado: "cancelado" };
  TELAS.acompanhamentos = async function (h, forcar) {
    var d = await carregar("acs", "admin-acompanhamentos", "", forcar), q = h.q, c = $("#conteudo"), est = q.estado || "", todos = d.acompanhamentos;
    var lista = todos.filter(function (a) { return (!est || a.estado === est) && (!q.q || ((a.atletaNome || "") + " " + (a.pagadorNome || "") + " " + (a.pagadorEmail || "") + " " + ((a.profissional && a.profissional.nome) || "")).toLowerCase().indexOf(q.q.toLowerCase()) >= 0); });
    c.innerHTML = cabeca("Acompanhamento MTY", "Contratação, pagamentos (3 de R$ 790) e condução do ciclo de 3 meses. O aplicativo não cobra: cada pagamento é confirmado aqui.") +
      '<div class="filtros">' + chips(EST_AC, est, function (e) { return e ? todos.filter(function (a) { return a.estado === e; }).length : todos.length; }) + barraBusca(q, null, false) + "</div>" +
      '<p class="nota">' + n(lista.length) + " de " + n(todos.length) + " acompanhamento(s).</p>" + (lista.length ? lista.map(cartaoAc).join("") : '<div class="cartao" style="margin-top:12px"><p>Nenhum acompanhamento neste filtro.</p></div>');
    ligarFiltros("acompanhamentos", q);
    $$("[data-pag]").forEach(function (b) { b.onclick = async function () { var p = b.getAttribute("data-pag").split(":"), pagar = b.getAttribute("data-novo") === "pago"; if (pagar && !window.confirm("Confirmar que você RECEBEU o pagamento " + p[1] + "?")) return; b.disabled = true; try { await chamar("admin-acompanhamentos", { corpo: { acao: "pagamento", id: p[0], n: parseInt(p[1], 10), estado: b.getAttribute("data-novo"), confirmo: pagar ? true : undefined } }); toast("Pagamento atualizado."); invalidar(); rotear(true); } catch (e) { toast(e.message, true); b.disabled = false; } }; });
    $$("[data-iniciar]").forEach(function (b) { b.onclick = async function () { var id = b.getAttribute("data-iniciar"), box = $('[data-ini="' + id + '"]'), v = $("select", box).value, di = $("input", box).value; if (!v) { toast("Escolha o profissional.", true); return; } b.disabled = true; try { await chamar("admin-acompanhamentos", { corpo: { acao: "iniciar", id: id, vinculoId: v, inicio: di } }); toast("Ciclo iniciado."); invalidar(); rotear(true); } catch (e) { toast(e.message, true); b.disabled = false; } }; });
    $$("[data-cancelar-ac]").forEach(function (b) { b.onclick = async function () { if (!window.confirm("Cancelar este acompanhamento? Reembolsos, se houver, são tratados fora do aplicativo.")) return; var id = b.getAttribute("data-cancelar-ac"), nota = $('[data-nota-ac="' + id + '"]').value; try { await chamar("admin-acompanhamentos", { corpo: { acao: "cancelar", id: id, nota: nota } }); toast("Cancelado."); invalidar(); rotear(true); } catch (e) { toast(e.message, true); } }; });
  };
  function cartaoAc(a) {
    var pagas = (a.parcelas || []).filter(function (p) { return p.estado === "pago"; }).length, dias = idadeDias(a.criadoEm);
    var parc = '<p class="rot">Pagamentos (' + pagas + " de " + (a.parcelas || []).length + " confirmados)</p>" + (a.parcelas || []).map(function (p) {
      var ativo = a.estado !== "cancelado" && a.estado !== "aguardando_responsavel";
      return '<div class="bloco"><strong>Pagamento ' + p.n + "</strong> · " + esc(reais(p.valorCentavos)) + " · " + (p.estado === "pago" ? '<span class="estado ok">Pago em ' + esc(dt(p.pagoEm)) + "</span>" : '<span class="estado espera">Pendente</span>') + (ativo ? '<div class="acoes"><button class="bt claro pequeno" data-pag="' + esc(a.id + ":" + p.n) + '" data-novo="' + (p.estado === "pago" ? "pendente" : "pago") + '">' + (p.estado === "pago" ? "Desfazer" : "Confirmar recebimento") + "</button></div>" : "") + "</div>";
    }).join("");
    var ini = "";
    if (a.estado === "aguardando_inicio") {
      var ps = a.profissionaisPossiveis || [];
      ini = '<p class="rot">Iniciar o ciclo</p>' + (ps.length ? "" : '<div class="aviso atencao">O atleta ainda não tem treinador vinculado. Peça para gerar um convite de treinador no app e para o profissional usar o código.</div>') + '<div class="campos duas" data-ini="' + esc(a.id) + '"><select aria-label="Profissional"><option value="">Escolher o profissional…</option>' + ps.map(function (v) { return '<option value="' + esc(v.vinculoId) + '">' + esc(v.nome + (v.email ? " <" + v.email + ">" : "") + (v.planejamento ? "" : " (falta compartilhar “Meu planejamento”)")) + "</option>"; }).join("") + '</select><input type="date" value="' + hojeISO() + '" aria-label="Data de início"></div><div class="acoes"><button class="bt azul pequeno" data-iniciar="' + esc(a.id) + '">Iniciar ciclo</button></div>';
    }
    var enc = (a.encontros || []).length ? '<p class="rot">Encontros</p>' + a.encontros.map(function (e) { return '<div class="bloco">' + esc(e.rotulo + " · " + e.duracaoMin + " min · " + (ROT_ENC[e.estado] || e.estado) + (e.data ? " · " + dt(e.data) + " " + (e.hora || "") : "")) + "</div>"; }).join("") : "";
    var hist = (a.historico || []).slice(-5).reverse().map(function (x) { return '<div class="bloco">' + esc(dthora(x.em) + " · " + x.por + " · " + x.acao) + "</div>"; }).join("");
    var cancel = ["encerrado", "cancelado"].indexOf(a.estado) < 0 ? '<div class="acoes"><input data-nota-ac="' + esc(a.id) + '" placeholder="Nota interna (opcional)" maxlength="500" aria-label="Nota interna"><button class="bt claro pequeno" data-cancelar-ac="' + esc(a.id) + '">Cancelar acompanhamento</button></div>' : "";
    return '<article class="item"><div class="item-topo"><span class="estado ' + (CLASSE_AC[a.estado] || "neutro") + '">' + esc(a.rotulo) + "</span>" + (["aguardando_pagamento", "aguardando_inicio"].indexOf(a.estado) >= 0 ? '<span class="idade' + (dias >= 3 ? " atraso" : "") + '">há ' + dias + (dias === 1 ? " dia" : " dias") + "</span>" : "") + "</div><h3>" + esc(a.atletaNome || "Atleta") + (a.menor ? " (menor de idade)" : "") + '</h3><p class="meta">Pagador: ' + esc(a.pagadorNome || "—") + (a.pagadorEmail ? " &lt;" + esc(a.pagadorEmail) + "&gt;" : "") + " · solicitado em " + esc(dt(a.criadoEm)) + (a.articulacao ? " · autorizou articular com o treinador presencial" : "") + (a.profissional ? " · profissional: " + esc(a.profissional.nome) : "") + (a.inicio ? " · ciclo de " + esc(dt(a.inicio)) + " a " + esc(dt(a.fim)) : "") +
      "</p><details" + (["aguardando_inicio", "aguardando_pagamento"].indexOf(a.estado) >= 0 ? " open" : "") + "><summary>Abrir acompanhamento</summary>" + parc + ini + enc + (hist ? '<p class="rot">Histórico</p>' + hist : "") + cancel + "</details></article>";
  }

  /* ══ Contatos da página de vendas ══ */
  var EST_CT = [["", "Todos"], ["novo", "Novos"], ["contatado", "Contatados"], ["arquivado", "Arquivados"]];
  TELAS.contatos = async function (h, forcar) {
    var d = await carregar("contatos", "admin-interesses", "", forcar), q = h.q, c = $("#conteudo"), est = q.estado || "", todos = d.contatos;
    var lista = todos.filter(function (x) { return (!est || x.status === est) && (!q.q || (x.nome + " " + x.email + " " + x.telefone + " " + x.rotuloServico + " " + x.objetivo).toLowerCase().indexOf(q.q.toLowerCase()) >= 0); });
    c.innerHTML = cabeca("Contatos da página de vendas", "Solicitações de contato do formulário do QuadraLab Competição. Nada foi contratado nem cobrado.") + '<div class="filtros">' + chips(EST_CT, est, function (e) { return e ? todos.filter(function (x) { return x.status === e; }).length : todos.length; }) + barraBusca(q, null, true) + "</div>" +
      '<p class="nota">' + n(lista.length) + " de " + n(todos.length) + " contato(s).</p>" + (lista.length ? lista.map(function (x) {
        var dias = idadeDias(x.criadoEm), cls = x.status === "novo" ? "espera" : x.status === "contatado" ? "ok" : "neutro";
        return '<article class="item"><div class="item-topo"><span class="estado ' + cls + '">' + esc({ novo: "Novo", contatado: "Contatado", arquivado: "Arquivado" }[x.status] || x.status) + '</span><span class="idade' + (x.status === "novo" && dias >= 2 ? " atraso" : "") + '">há ' + dias + (dias === 1 ? " dia" : " dias") + "</span></div><h3>" + esc(x.nome) + " · " + esc(x.rotuloServico) + '</h3><p class="meta">' + esc(x.email) + " · " + esc(x.telefone) + " · " + esc(dthora(x.criadoEm)) + '</p><div class="bloco">' + esc("Atleta: " + x.rotuloFaixa + " · " + x.rotuloCategoria + "\nObjetivo: " + x.objetivo + (x.nota ? "\nNota: " + x.nota : "")) + '</div><div class="acoes"><a class="bt claro pequeno" href="https://wa.me/55' + esc(String(x.telefone).replace(/^55/, "")) + '" target="_blank" rel="noopener noreferrer">Abrir no WhatsApp</a>' +
          [["contatado", "Marcar como contatado"], ["arquivado", "Arquivar"], ["novo", "Voltar para novo"]].filter(function (s) { return s[0] !== x.status; }).map(function (s) { return '<button class="bt claro pequeno" data-ct="' + esc(x.id) + ":" + s[0] + '">' + s[1] + "</button>"; }).join("") + "</div></article>";
      }).join("") : '<div class="cartao" style="margin-top:12px"><p>Nenhum contato neste filtro.</p></div>');
    ligarFiltros("contatos", q);
    $("#btCsv").onclick = function () { baixarCsv("contatos", ["recebido em", "situação", "nome", "e-mail", "telefone", "serviço", "faixa etária", "categoria", "objetivo", "nota"], lista.map(function (x) { return [x.criadoEm, x.status, x.nome, x.email, x.telefone, x.rotuloServico, x.rotuloFaixa, x.rotuloCategoria, x.objetivo, x.nota || ""]; })); };
    $$("[data-ct]").forEach(function (b) { b.onclick = async function () { var p = b.getAttribute("data-ct").split(":"), nota = p[1] === "arquivado" ? "" : (window.prompt("Nota interna (opcional)") || ""); b.disabled = true; try { await chamar("admin-interesses", { corpo: { acao: "status", id: p[0], status: p[1], nota: nota } }); toast("Atualizado."); invalidar(); rotear(true); } catch (e) { toast(e.message, true); b.disabled = false; } }; });
  };

  /* ══ Pagamentos ══ */
  TELAS.pagamentos = async function (h, forcar) {
    var d = await carregar("pagamentos", "admin-painel", "?secao=pagamentos", forcar), r = await carregar("resumo", "admin-painel", "?secao=resumo", false), c = $("#conteudo"), f = r.financeiro;
    var rec = d.recebimentos;
    c.innerHTML = cabeca("Pagamentos", "Recebimentos confirmados, faturas da Eduzz e assinaturas do Player.", '<button class="bt claro" id="btCsv">Exportar recebimentos (CSV)</button>') +
      '<div class="hero"><div><div class="n lima">' + esc(reais(f.confirmadoCentavos)) + '</div><div class="r">Confirmado (consultorias + parcelas)</div></div><div><div class="n">' + esc(reais(f.aReceberCentavos)) + '</div><div class="r">A receber</div></div><div><div class="n">' + n(d.semPedido.length) + '</div><div class="r">pagamentos da Eduzz sem pedido</div></div><p class="nota">' + esc(f.nota) + "</p></div>" +
      (d.semPedido.length ? '<div class="aviso atencao" style="margin-top:12px">Há pagamentos da Eduzz sem pedido. <a href="#/consultorias">Vincular em Consultorias</a>.</div>' : "") +
      '<section class="secao"><h2>Recebimentos confirmados</h2>' + (rec.length ? '<div class="tabela-rolagem"><table><thead><tr><th>Data</th><th>Origem</th><th>Item</th><th>Atleta</th><th class="num">Valor</th><th>Situação</th><th>Confirmado por</th></tr></thead><tbody>' + rec.map(function (x) { return "<tr><td>" + esc(dt(x.em)) + "</td><td>" + esc(x.origem) + "</td><td>" + esc(x.nome) + "</td><td>" + esc(x.atleta) + '</td><td class="num">' + esc(reais(x.valorCentavos)) + "</td><td>" + esc(x.estado === "reembolsado" ? "Reembolsado" : x.estado === "pago" ? "Pago" : x.estado === "em_andamento" ? "Pago, em andamento" : "Pago, entregue") + "</td><td>" + esc(x.por || "—") + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<p class="nota">Nenhum recebimento confirmado ainda.</p>') + "</section>" +
      '<section class="secao"><h2>Assinaturas do Player</h2>' + (d.assinaturas.length ? '<div class="tabela-rolagem"><table><thead><tr><th>Conta</th><th>Plano</th><th>Situação</th><th>Válida até</th></tr></thead><tbody>' + d.assinaturas.map(function (x) { var venc = x.ativoAte && x.ativoAte < hojeISO(); return '<tr class="link" data-uid="' + esc(x.uid) + '"><td>' + esc(x.nome || x.uid) + "</td><td>" + esc(x.nome_produto || "—") + '</td><td><span class="estado ' + (x.status === "ativa" ? "ok" : "neutro") + '">' + esc(x.status) + "</span></td><td>" + esc(dt(x.ativoAte)) + (venc ? ' <span class="estado espera">vencida</span>' : "") + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<p class="nota">Nenhuma assinatura registrada. Os produtos do Player na Eduzz ' + (d.produtosPlayerCompletos ? "estão configurados." : "ainda não estão configurados.") + "</p>") + "</section>" +
      '<section class="secao"><h2>Faturas da Eduzz (Player)</h2>' + (d.faturas.length ? '<div class="tabela-rolagem"><table><thead><tr><th>Atualizada</th><th>Fatura</th><th>Situação</th><th>Produto</th><th>E-mail</th></tr></thead><tbody>' + d.faturas.map(function (x) { return "<tr><td>" + esc(dthora(x.atualizadoEm)) + "</td><td>" + esc(x.id) + '</td><td><span class="estado ' + (x.estado === "paga" ? "ok" : "neutro") + '">' + esc(x.estado) + "</span></td><td>" + esc(x.produtoId || "—") + "</td><td>" + esc(x.email) + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<p class="nota">Nenhuma fatura recebida pelo webhook da Eduzz.</p>') + '<p class="nota" style="margin-top:8px">' + n(d.webhooksProcessados == null ? 0 : d.webhooksProcessados) + " evento(s) da Eduzz processados · " + (d.pendentes.length) + " pagamento(s) de quem ainda não criou conta.</p></section>";
    $("#btCsv").onclick = function () { baixarCsv("recebimentos", ["data", "origem", "item", "atleta", "valor (R$)", "situação", "confirmado por"], rec.map(function (x) { return [x.em, x.origem, x.nome, x.atleta, (x.valorCentavos / 100).toFixed(2).replace(".", ","), x.estado, x.por || ""]; })); };
    $$("tr[data-uid]").forEach(function (tr) { tr.onclick = function () { irPara("usuarios", {}, tr.getAttribute("data-uid")); }; });
  };

  /* ══ Análise ══ */
  var ROT_ESTADO_V = { "treinador:ativo": "Treinadores ativos", "responsavel:ativo": "Responsáveis ativos", "treinador:aguardando": "Treinadores aguardando aprovação", "responsavel:aguardando": "Responsáveis aguardando aprovação", "treinador:convite": "Convites de treinador abertos", "responsavel:convite": "Convites de responsável abertos" };
  var ROT_FAIXA = { ate10: "Até 10 anos", "11-12": "11 e 12 anos", "13-14": "13 e 14 anos", "15-16": "15 e 16 anos", "17-18": "17 e 18 anos", adulto: "Acima de 18 anos" };
  var ROT_SERV = { acompanhamento: "Acompanhamento MTY", revisao: "Revisão de estratégia", ao_vivo: "Consultoria ao vivo", analise: "Análise completa", analise_consultoria: "Análise + consultoria", nao_sei: "Ainda não sei" };
  var ROT_CAT = { iniciando: "Começando em torneios", regional: "Regionais", estadual: "Estaduais", nacional: "Nacionais ou ranking", outro: "Outra" };
  var ROT_PLAN = { sugestao: "Sugestão", em_revisao: "Em revisão", aprovado: "Aprovado", substituido: "Substituído" };
  function funilHtml(titulo, nota, passos) {
    var max = Math.max.apply(null, passos.map(function (p) { return p.n; }).concat([1]));
    return '<section class="cartao funil"><h2>' + esc(titulo) + '</h2><p class="nota">' + esc(nota) + '</p><ol class="funil-lista">' + passos.map(function (p) {
      return '<li><div class="funil-topo"><span>' + esc(p.rotulo) + '</span><b>' + n(p.n) + "</b></div>" +
        '<div class="funil-trilho"><div class="funil-barra" style="width:' + Math.max(p.n ? 2 : 0, Math.round(p.n / max * 100)) + '%" data-dica="' + esc(p.rotulo + ": " + n(p.n) + (p.pctContas != null ? " (" + p.pctContas + "% do início)" : "")) + '"></div></div>' +
        '<div class="nota">' + (p.pctContas != null ? p.pctContas + "% das contas" : "") + (p.pctAnterior != null ? " · " + p.pctAnterior + "% do passo anterior" : "") + "</div></li>";
    }).join("") + "</ol>" + tabelaAlt(["Passo", "Contas", "% do início", "% do passo anterior"], passos.map(function (p) { return [p.rotulo, n(p.n), p.pctContas == null ? "—" : p.pctContas + "%", p.pctAnterior == null ? "—" : p.pctAnterior + "%"]; })) + "</section>";
  }
  function listaPares(titulo, pares, rot) {
    return '<section class="cartao"><h2>' + esc(titulo) + "</h2>" + (pares.length ? '<div class="tabela-rolagem"><table><tbody>' + pares.map(function (x) { return "<tr><td>" + esc(rot && rot[x.k] ? rot[x.k] : x.k) + '</td><td class="num">' + n(x.n) + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<p class="nota">Sem dados ainda.</p>') + "</section>";
  }
  function objParaPares(o, rot) { return Object.keys(o || {}).map(function (k) { return { k: k, n: o[k] }; }).sort(function (a, b) { return b.n - a.n; }).map(function (x) { return { k: (rot && rot[x.k]) || x.k, n: x.n }; }); }
  TELAS.analise = async function (h, forcar) {
    var d = await carregar("analise", "admin-painel", "?secao=analise", forcar), c = $("#conteudo"), a = d.atividade, cp = d.competicao, pl = d.planos, st = d.site, ac = d.academias;
    var ordemAt = { alto: 0, medio: 1, baixo: 2 }, atencao = d.atencao.slice().sort(function (x, y) { return ordemAt[x.nivel] - ordemAt[y.nivel]; });
    c.innerHTML = cabeca("Análise", "Como as pessoas usam o QuadraLab: funis, atividade, recursos, IA, planos e site. Só contagens: nada de nome, e-mail ou conteúdo.", '<button class="bt claro" id="btCsv">Exportar (CSV)</button>') +
      (d.truncado.length ? '<div class="aviso atencao">Alguns números foram limitados por volume: ' + esc(d.truncado.join(", ")) + ".</div>" : "") +
      '<div class="kpis">' + kpi(n(a.ativos7), "contas ativas em 7 dias", true) + kpi(n(a.ativos30), "contas ativas em 30 dias") + kpi(a.retornoPct == null ? "—" : a.retornoPct + "%", "voltaram nos últimos 14 dias (contas com 14 dias ou mais)") + kpi(n(a.novas30), "contas novas em 30 dias") + kpi(pl.conversaoPct == null ? "—" : pl.conversaoPct + "%", "contas com assinatura ativa") + "</div>" +
      '<section class="secao"><h2>Pontos de atenção</h2>' + (atencao.length ? '<ul class="pendencias">' + atencao.map(function (p) { return '<li class="aten ' + esc(p.nivel) + '"><span class="estado ' + (p.nivel === "alto" ? "espera" : p.nivel === "medio" ? "info" : "neutro") + '">' + (p.nivel === "alto" ? "Urgente" : p.nivel === "medio" ? "Importante" : "Informação") + "</span> " + esc(p.texto) + (p.secao && p.secao !== "analise" ? ' <a href="#/' + esc(p.secao) + '">Abrir</a>' : "") + "</li>"; }).join("") + "</ul>" : '<div class="aviso ok">Nada fora do esperado agora.</div>') + "</section>" +
      '<section class="secao">' + graficoBarras("Contas ativas por semana", "Contas que registraram algo na semana (partida, plano, treino, torneio, diário…)", a.serie.map(function (s) { return { n: s.n, rot: "Semana de " + dt(s.semana), eixo: semanaRot(s.semana) }; }), n, "Contas ativas por semana") + "</section>" +
      '<div class="grade duas">' + funilHtml("Funil do Player", "Contas sem papel da Competição. Cada passo conta as contas que fizeram aquilo, não só as que fizeram o passo anterior.", d.funilPlayer) + funilHtml("Funil da Competição (atletas)", "Do cadastro até o acompanhamento. Mostra onde o atleta para.", d.funilCompeticao) + "</div>" +
      '<section class="secao"><h2>Uso dos recursos</h2><div class="tabela-rolagem"><table><thead><tr><th>Recurso</th><th class="num">Total</th><th class="num">7 dias</th><th class="num">30 dias</th><th class="num">Contas em 30 dias</th></tr></thead><tbody>' + d.uso.map(function (u) { return "<tr><td>" + esc(u.rotulo) + '</td><td class="num">' + n(u.total) + '</td><td class="num">' + n(u.ult7) + '</td><td class="num">' + n(u.ult30) + '</td><td class="num">' + n(u.contas30) + "</td></tr>"; }).join("") + "</tbody></table></div></section>" +
      '<section class="secao"><h2>IA e qualidade (30 dias)</h2><div class="tabela-rolagem"><table><thead><tr><th>Geração</th><th class="num">Pedidos</th><th class="num">Prontos</th><th class="num">Com erro</th><th class="num">Sem cota</th><th class="num">Travados</th><th class="num">Taxa de erro</th></tr></thead><tbody>' + d.ia.map(function (i) { return "<tr><td>" + esc(i.rotulo) + '</td><td class="num">' + n(i.total30) + '</td><td class="num">' + n(i.pronto) + '</td><td class="num">' + n(i.erro) + '</td><td class="num">' + n(i.semCota) + '</td><td class="num">' + n(i.travados) + '</td><td class="num">' + (i.taxaErroPct == null ? "—" : i.taxaErroPct + "%") + "</td></tr>"; }).join("") + '</tbody></table></div><p class="nota">“Sem cota” é quando a conta bateu no limite do plano; não conta como erro. Contas que bateram no limite: ' + n(d.ia[0].contasSemCota) + " (planos de jogo) e " + n(d.ia[1].contasSemCota) + " (planejamentos).</p></section>" +
      '<div class="grade duas"><section class="cartao"><h2>Planos e assinaturas do Player</h2><div class="kpis">' + kpi(n(pl.assinantes), "assinantes ativos", true) + kpi(n(pl.vencemEm7), "vencem em 7 dias") + kpi(n(pl.faturasPagas), "faturas pagas") + kpi(n(pl.faturasRevogadas), "faturas revogadas") + "</div>" + '<div class="tabela-rolagem"><table><tbody>' + objParaPares(pl.porStatus).map(function (x) { return "<tr><td>Assinatura: " + esc(x.k) + '</td><td class="num">' + n(x.n) + "</td></tr>"; }).join("") + '</tbody></table></div><p class="nota">Valores em reais ficam em Financeiro e Eduzz: o webhook da Eduzz não traz preços.</p></section>' +
      '<section class="cartao"><h2>Competição</h2><div class="kpis">' + kpi(n(cp.atletas), "atletas", true) + kpi(n(cp.menores), "menores de idade") + kpi(n(cp.comTreinador), "com treinador") + kpi(n(cp.comResponsavel), "com responsável") + kpi(n(cp.comTorneioFuturo), "com torneio futuro") + kpi(n(cp.torneios30), "torneios em 30 dias") + "</div>" +
      '<div class="tabela-rolagem"><table><tbody>' + objParaPares(cp.vinculosPorEstado, ROT_ESTADO_V).map(function (x) { return "<tr><td>" + esc(x.k) + '</td><td class="num">' + n(x.n) + "</td></tr>"; }).join("") + objParaPares(cp.planejamentoPorStatus, ROT_PLAN).map(function (x) { return "<tr><td>Planejamento: " + esc(x.k) + '</td><td class="num">' + n(x.n) + "</td></tr>"; }).join("") + objParaPares(cp.prioridadeTorneios, { A: "Torneios prioridade A", B: "Torneios prioridade B", C: "Torneios prioridade C", sem: "Torneios sem prioridade" }).map(function (x) { return "<tr><td>" + esc(x.k) + '</td><td class="num">' + n(x.n) + "</td></tr>"; }).join("") + "</tbody></table></div></section></div>" +
      '<section class="secao"><h2>Site e contatos</h2><p class="nota">' + n(st.total) + " contato(s) no total, " + n(st.ult30) + " nos últimos 30 dias" + (st.medianaHorasAteContato == null ? "." : ". Tempo mediano até o primeiro contato: " + st.medianaHorasAteContato + " h (" + n(st.contatados) + " contato(s) respondido(s)).") + '</p><div class="grade duas">' + listaPares("Por serviço", st.porServico, ROT_SERV) + listaPares("Por faixa etária", st.porFaixa, ROT_FAIXA) + listaPares("Por categoria", st.porCategoria, ROT_CAT) + listaPares("Por situação", st.porStatus, { novo: "Novos", contatado: "Contatados", arquivado: "Arquivados" }) + "</div></section>" +
      '<section class="secao"><h2>Academias (app do treinador)</h2><div class="kpis">' + kpi(n(ac.total), "academias", true) + kpi(n(ac.alunos), "alunos cadastrados") + kpi(n(ac.vencidas), "licenças vencidas") + "</div>" + '<div class="tabela-rolagem"><table><tbody>' + objParaPares(ac.porPlano, { gratis: "Plano grátis", essencial: "Plano essencial", premium: "Plano premium", sem: "Sem plano" }).map(function (x) { return "<tr><td>" + esc(x.k) + '</td><td class="num">' + n(x.n) + "</td></tr>"; }).join("") + "</tbody></table></div></section>";
    $("#btCsv").onclick = function () {
      var linhas = [];
      d.funilPlayer.forEach(function (p) { linhas.push(["Funil do Player", p.rotulo, p.n, p.pctContas == null ? "" : p.pctContas + "%", p.pctAnterior == null ? "" : p.pctAnterior + "%"]); });
      d.funilCompeticao.forEach(function (p) { linhas.push(["Funil da Competição", p.rotulo, p.n, p.pctContas == null ? "" : p.pctContas + "%", p.pctAnterior == null ? "" : p.pctAnterior + "%"]); });
      d.uso.forEach(function (u) { linhas.push(["Uso 30 dias", u.rotulo, u.ult30, "total " + u.total, "7 dias " + u.ult7 + " · contas " + u.contas30]); });
      d.atividade.serie.forEach(function (s) { linhas.push(["Contas ativas por semana", dt(s.semana), s.n, "", ""]); });
      baixarCsv("analise", ["bloco", "item", "valor", "complemento", "complemento 2"], linhas);
    };
  };

  /* ══ Entradas — quem entrou e o que chegou ══ */
  var TIPOS_ENT = [["", "Tudo"], ["conta", "Contas"], ["vinculo", "Vínculos"], ["pedido", "Pedidos"], ["acompanhamento", "Acompanhamento"], ["contato", "Contatos"], ["academia", "Academias"]];
  var CLASSE_ENT = { conta: "ok", vinculo: "info", pedido: "info", acompanhamento: "info", contato: "espera", academia: "neutro" };
  function mesRot(m) { return MESES[+m.slice(5, 7) - 1] + "/" + m.slice(2, 4); }
  TELAS.entradas = async function (h, forcar) {
    var q = h.q, dias = q.dias || "30", tipo = q.tipo || "", c = $("#conteudo");
    var d = await carregar("entradas", "admin-painel", "?secao=entradas&dias=" + encodeURIComponent(dias) + "&tipo=" + encodeURIComponent(tipo), forcar);
    var cont = d.contagem, totalJanela = Object.keys(cont).reduce(function (s, k) { return s + cont[k]; }, 0);
    var busca = (q.q || "").toLowerCase(), lista = d.eventos.filter(function (e) { return !busca || (e.texto + " " + e.detalhe + " " + e.rotulo).toLowerCase().indexOf(busca) >= 0; });
    function link(secao, extra) { var nq = Object.assign({}, q, extra || {}); return nq; }
    c.innerHTML = cabeca("Entradas", "Quem entrou e o que chegou: contas novas, vínculos, pedidos, contatos e academias, do mais recente ao mais antigo.", '<button class="bt claro" id="btCsv">Exportar (CSV)</button>') +
      '<div class="kpis">' + kpi(n(d.resumo.hoje), "contas novas hoje", true) + kpi(n(d.resumo.dias7), "contas nos últimos 7 dias") + kpi(n(d.resumo.dias30), "contas nos últimos 30 dias") + kpi(n(d.resumo.total), "contas no total") + "</div>" +
      '<section class="secao">' + graficoBarras("Contas novas por semana", "Player e Competição juntos, últimas 12 semanas", d.serieContas.map(function (s) { return { n: s.player + s.atleta + s.responsavel + s.treinador, rot: "Semana de " + dt(s.semana), eixo: semanaRot(s.semana) }; }), n, "Contas novas por semana") +
      tabelaAlt(["Semana", "Só Player", "Atletas", "Responsáveis", "Treinadores"], d.serieContas.map(function (s) { return [dt(s.semana), s.player, s.atleta, s.responsavel, s.treinador]; })) + "</section>" +
      '<div class="filtros"><div class="chips" role="group" aria-label="Período">' + [["7", "7 dias"], ["30", "30 dias"], ["90", "90 dias"], ["365", "1 ano"]].map(function (p) { return '<button type="button" class="chip" data-per="' + p[0] + '" aria-pressed="' + (p[0] === dias) + '">' + p[1] + "</button>"; }).join("") + "</div>" +
      chips(TIPOS_ENT, tipo, function (t) { return t ? cont[t] || 0 : totalJanela; }) + barraBusca(q, null, false) + "</div>" +
      '<p class="nota">' + n(lista.length) + " registro(s) nos últimos " + esc(dias) + " dias" + (d.truncado ? " (mostrando os 300 mais recentes)" : "") + ".</p>" +
      (lista.length ? '<div class="tabela-rolagem"><table><thead><tr><th>Quando</th><th>O quê</th><th>Detalhe</th><th>Situação</th><th></th></tr></thead><tbody>' + lista.map(function (e) {
        return "<tr><td>" + esc(dthora(e.em)) + '</td><td><span class="estado ' + (CLASSE_ENT[e.tipo] || "neutro") + '">' + esc(e.rotulo) + "</span></td><td>" + esc(e.texto) + "</td><td>" + esc(e.detalhe || "—") + '</td><td>' + (e.uid ? '<a href="#/usuarios/' + esc(e.uid) + '">Abrir conta</a>' : '<a href="#/' + esc(e.secao) + '">Abrir</a>') + "</td></tr>";
      }).join("") + "</tbody></table></div>" : '<div class="cartao" style="margin-top:12px"><p>Nada neste período e filtro.</p></div>');
    $$("[data-chip]").forEach(function (b) { b.addEventListener("click", function () { irPara("entradas", link("", { tipo: b.getAttribute("data-chip") })); }); });
    $("#fBusca").addEventListener("submit", function (ev) { ev.preventDefault(); irPara("entradas", link("", { q: $("#busca").value.trim() })); });
    $$("[data-per]").forEach(function (b) { b.addEventListener("click", function () { irPara("entradas", link("", { dias: b.getAttribute("data-per") })); }); });
    $("#btCsv").onclick = function () { baixarCsv("entradas", ["quando", "tipo", "o quê", "detalhe", "situação"], lista.map(function (e) { return [e.em, e.rotulo, e.texto, e.detalhe || "", e.secao]; })); };
  };
  /* ══ Eduzz — relatório do webhook ══ */
  TELAS.eduzz = async function (h, forcar) {
    var d = await carregar("eduzz", "admin-painel", "?secao=eduzz", forcar), c = $("#conteudo");
    var fat = d.faturasPlayer.porEstado, cls = { pago: "ok", reembolso: "espera", cancelado: "neutro", outro: "neutro" };
    c.innerHTML = cabeca("Eduzz", "O que a Eduzz avisou ao sistema e o que isso virou: acessos liberados, revogados e pagamentos sem pedido.", '<button class="bt claro" id="btCsv">Exportar eventos (CSV)</button>') +
      (d.webhookConfigurado ? "" : '<div class="aviso atencao">O segredo do webhook da Eduzz não está definido no servidor. Sem ele nenhum pagamento é reconhecido. <a href="#/sistema">Ver configuração</a>.</div>') +
      '<div class="aviso" style="margin-top:12px">' + esc(d.avisoValores) + ' <a href="#/financeiro">Abrir Financeiro</a>.</div>' +
      '<div class="kpis" style="margin-top:12px">' + kpi(n(d.total), "eventos processados", true) + kpi(n(d.ultimos7), "nos últimos 7 dias") + kpi(n(d.ultimos30), "nos últimos 30 dias") + kpi(n(d.semPedido.length), "pagamentos sem pedido") + kpi(n(d.aguardandoConta), "pagos sem conta criada") + kpi(d.ultimoEvento ? dt(d.ultimoEvento) : "—", "último evento") + "</div>" +
      '<section class="secao">' + graficoEmpilhado("Eventos por mês", "Aprovações e, ao lado, cancelamentos, reembolsos e chargebacks", d.porMes.map(function (m) { return { a: m.pago, b: m.reembolso + m.cancelado, rot: mesRot(m.mes), eixo: MESES[+m.mes.slice(5, 7) - 1] }; }), n, ["Pagamentos aprovados", "Cancelamentos e reembolsos"], "Eventos da Eduzz por mês") + "</section>" +
      '<section class="secao"><h2>Por tipo de evento</h2>' + (d.porEvento.length ? '<div class="tabela-rolagem"><table><thead><tr><th>Evento</th><th class="num">Quantidade</th></tr></thead><tbody>' + d.porEvento.map(function (e) { return "<tr><td>" + esc(e.rotulo) + '</td><td class="num">' + n(e.n) + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<p class="nota">Nenhum evento recebido ainda.</p>') + "</section>" +
      '<section class="secao"><h2>Faturas do Player</h2><p class="nota">' + n(d.faturasPlayer.total) + " fatura(s): " + (Object.keys(fat).length ? Object.keys(fat).map(function (k) { return n(fat[k]) + " " + esc(k); }).join(" · ") : "nenhuma") + ".</p></section>" +
      '<section class="secao"><h2>Pagamentos sem pedido</h2>' + (d.semPedido.length ? '<div class="tabela-rolagem"><table><thead><tr><th>Recebido</th><th>Fatura</th><th>Consultoria</th><th>Motivo</th></tr></thead><tbody>' + d.semPedido.map(function (s) { return "<tr><td>" + esc(dthora(s.recebidoEm)) + "</td><td>" + esc(s.faturaId || s.id) + "</td><td>" + esc(s.consultoriaId || "—") + "</td><td>" + esc(s.motivo || "—") + "</td></tr>"; }).join("") + '</tbody></table></div><p class="nota" style="margin-top:8px"><a href="#/consultorias">Vincular em Consultorias</a></p>' : '<p class="nota">Nenhum. Todo pagamento reconhecido tem pedido.</p>') + "</section>" +
      '<section class="secao"><h2>Academias liberadas pela Eduzz</h2>' + (d.academias.length ? '<div class="tabela-rolagem"><table><thead><tr><th>Academia</th><th>Plano</th><th>Válido até</th><th>Última atualização</th><th>Situação</th></tr></thead><tbody>' + d.academias.map(function (o) { return "<tr><td>" + esc(o.nome) + "</td><td>" + esc(o.plano || "—") + "</td><td>" + esc(dt(o.ativoAte)) + '</td><td>' + esc(dthora(o.atualizadoEm)) + '</td><td><span class="estado ' + (o.revogadoEm ? "neutro" : o.vencida ? "espera" : "ok") + '">' + (o.revogadoEm ? "Acesso revogado" : o.vencida ? "Vencida" : "Ativa") + "</span></td></tr>"; }).join("") + "</tbody></table></div>" : '<p class="nota">Nenhuma academia liberada pela Eduzz até agora.</p>') + "</section>" +
      '<section class="secao"><h2>Eventos recentes</h2>' + (d.eventos.length ? '<div class="tabela-rolagem"><table><thead><tr><th>Processado</th><th>Evento</th><th>E-mail</th><th>Origem</th></tr></thead><tbody>' + d.eventos.map(function (e) { return "<tr><td>" + esc(dthora(e.em)) + '</td><td><span class="estado ' + (cls[/paid/.test(e.evento) ? "pago" : /refund|chargeback/.test(e.evento) ? "reembolso" : /cancel/.test(e.evento) ? "cancelado" : "outro"] || "neutro") + '">' + esc(e.rotulo) + "</span></td><td>" + esc(e.email || "—") + "</td><td>" + esc(e.tipo || "Geral") + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<p class="nota">Nenhum evento ainda.</p>') + "</section>";
    $("#btCsv").onclick = function () { baixarCsv("eduzz-eventos", ["processado em", "evento", "e-mail", "origem"], d.eventos.map(function (e) { return [e.em, e.rotulo, e.email, e.tipo || "Geral"]; })); };
  };

  /* ══ Financeiro ══ */
  function decimal(c) { return (c / 100).toFixed(2).replace(".", ","); }
  function sel(id, mapa, atual) { return '<select id="' + id + '">' + Object.keys(mapa).map(function (k) { return '<option value="' + esc(k) + '"' + (k === atual ? " selected" : "") + ">" + esc(mapa[k]) + "</option>"; }).join("") + "</select>"; }
  TELAS.financeiro = async function (h, forcar) {
    var q = h.q, mes = /^\d{4}-\d{2}$/.test(q.mes || "") ? q.mes : "", c = $("#conteudo");
    var d = await carregar("financeiro", "admin-painel", "?secao=financeiro" + (mes ? "&mes=" + mes : ""), forcar), L = d.listas, editar = null;
    if (q.editar) editar = d.movimentos.filter(function (m) { return m.id === q.editar; })[0] || null;
    var ma = d.mesAtual, base = "R$";
    function formLanc() {
      var e = editar || { tipo: "despesa", data: hojeISO(), categoria: "ferramentas", produto: "geral", descricao: "", valorCentavos: 0 };
      return '<form id="fLanc" class="cartao form-lanc" novalidate><h2>' + (editar ? "Editar lançamento" : "Novo lançamento") + '</h2><p class="nota">Registre o que o sistema não vê sozinho: vendas da Eduzz, Pix, taxas, ferramentas, anúncios, impostos. Isso não cobra nem reembolsa ninguém.</p><div class="form-grade">' +
        '<div><label for="lTipo">Tipo</label><select id="lTipo"><option value="receita"' + (e.tipo === "receita" ? " selected" : "") + '>Receita (entrou)</option><option value="despesa"' + (e.tipo === "despesa" ? " selected" : "") + ">Despesa (saiu)</option></select></div>" +
        '<div><label for="lData">Data</label><input id="lData" type="date" value="' + esc(e.data) + '" required></div>' +
        '<div><label for="lValor">Valor (R$)</label><input id="lValor" inputmode="decimal" placeholder="149,90" value="' + (e.valorCentavos ? decimal(e.valorCentavos) : "") + '" autocomplete="off" required></div>' +
        '<div><label for="lCat">Categoria</label><select id="lCat"></select></div>' +
        '<div><label for="lProd">Produto</label>' + sel("lProd", L.produtos, e.produto) + "</div>" +
        '<div class="largo"><label for="lDesc">Descrição</label><input id="lDesc" maxlength="200" value="' + esc(e.descricao) + '" placeholder="Ex.: vendas Eduzz da semana, hospedagem, anúncio" autocomplete="off" required></div></div>' +
        '<div class="aviso erro" id="lErro" role="alert" hidden></div><div class="acoes"><button class="bt azul" type="submit">' + (editar ? "Salvar alterações" : "Adicionar lançamento") + "</button>" + (editar ? '<button class="bt claro" type="button" id="lCancelar">Cancelar</button>' : "") + "</div></form>";
    }
    var movs = d.movimentos;
    c.innerHTML = cabeca("Financeiro", "Receitas, despesas e resultado por mês e por produto. Soma o que o painel já confirmou com o que você lança à mão.", '<button class="bt claro" id="btCsv">Exportar (CSV)</button>') +
      '<div class="kpis">' + kpi(reais(ma.receita), "receita em " + mesRot(ma.mes), true) + kpi(reais(ma.despesa), "despesas em " + mesRot(ma.mes)) + kpi(reais(ma.resultado), "resultado em " + mesRot(ma.mes)) + kpi(reais(d.aReceberCentavos), "a receber (pedidos e parcelas)") + kpi(reais(d.totais.resultado), "resultado em 12 meses") + "</div>" +
      '<p class="nota" style="margin-top:8px">' + esc(d.nota) + (d.reembolsadoCentavos ? " Reembolsos de consultorias já marcados: " + esc(reais(d.reembolsadoCentavos)) + " (fora das receitas)." : "") + "</p>" +
      '<section class="secao">' + graficoEmpilhado("Receita por mês", "Confirmada no painel (consultorias e parcelas) e lançada por você", d.linhas.map(function (l) { return { a: l.receitaAuto, b: l.receitaManual, rot: mesRot(l.mes), eixo: MESES[+l.mes.slice(5, 7) - 1] }; }), reais, ["Confirmada no painel", "Lançada por você"], "Receita por mês") + "</section>" +
      '<section class="secao">' + graficoBarras("Despesas por mês", "Somente o que você lançou", d.linhas.map(function (l) { return { n: l.despesa, rot: mesRot(l.mes), eixo: MESES[+l.mes.slice(5, 7) - 1] }; }), reais, "Despesas por mês") + "</section>" +
      '<section class="secao"><h2>Resultado por mês</h2><div class="tabela-rolagem"><table><thead><tr><th>Mês</th><th class="num">Receita confirmada</th><th class="num">Receita lançada</th><th class="num">Despesas</th><th class="num">Resultado</th></tr></thead><tbody>' + d.linhas.slice().reverse().map(function (l) { return '<tr class="link" data-mes="' + esc(l.mes) + '"><td>' + esc(mesRot(l.mes)) + '</td><td class="num">' + esc(reais(l.receitaAuto)) + '</td><td class="num">' + esc(reais(l.receitaManual)) + '</td><td class="num">' + esc(reais(l.despesa)) + '</td><td class="num"><b>' + esc(reais(l.resultado)) + "</b>" + (l.resultado < 0 ? ' <span class="estado espera">negativo</span>' : "") + "</td></tr>"; }).join("") + '</tbody></table></div><p class="nota" style="margin-top:6px">Toque num mês para ver só os movimentos dele.</p></section>' +
      '<section class="secao"><h2>Por produto (12 meses)</h2><div class="tabela-rolagem"><table><thead><tr><th>Produto</th><th class="num">Receita</th><th class="num">Despesas</th><th class="num">Resultado</th></tr></thead><tbody>' + (d.porProduto.length ? d.porProduto.map(function (p) { return "<tr><td>" + esc(p.rotulo) + '</td><td class="num">' + esc(reais(p.receita)) + '</td><td class="num">' + esc(reais(p.despesa)) + '</td><td class="num"><b>' + esc(reais(p.resultado)) + "</b></td></tr>"; }).join("") : '<tr><td colspan="4">Sem movimentos ainda.</td></tr>') + "</tbody></table></div></section>" +
      (d.despesasPorCategoria.length ? '<section class="secao"><h2>Despesas por categoria</h2><div class="tabela-rolagem"><table><tbody>' + d.despesasPorCategoria.map(function (x) { return "<tr><td>" + esc(x.categoria) + '</td><td class="num">' + esc(reais(x.valorCentavos)) + "</td></tr>"; }).join("") + "</tbody></table></div></section>" : "") +
      '<section class="secao">' + formLanc() + "</section>" +
      '<section class="secao"><h2>Movimentos' + (mes ? " de " + esc(mesRot(mes)) : "") + "</h2>" + (mes ? '<p class="nota"><a href="#/financeiro">Ver todos os meses</a></p>' : "") + (movs.length ? '<div class="tabela-rolagem"><table><thead><tr><th>Data</th><th>Tipo</th><th>Origem</th><th>Descrição</th><th>Produto</th><th class="num">Valor</th><th></th></tr></thead><tbody>' + movs.map(function (m) { return "<tr><td>" + esc(dt(m.data)) + '</td><td><span class="estado ' + (m.tipo === "receita" ? "ok" : "espera") + '">' + (m.tipo === "receita" ? "Receita" : "Despesa") + "</span></td><td>" + esc(m.automatico ? m.origem : "Lançado por você") + "</td><td>" + esc(m.descricao) + (m.categoria ? '<br><span class="nota">' + esc(m.categoria) + "</span>" : "") + "</td><td>" + esc(L.produtos[m.produto] || m.produto) + '</td><td class="num">' + (m.tipo === "despesa" ? "−" : "") + esc(reais(m.valorCentavos)) + "</td><td>" + (m.id ? '<button class="bt claro pequeno" data-ed="' + esc(m.id) + '">Editar</button> <button class="bt claro pequeno" data-ex="' + esc(m.id) + '">Excluir</button>' : "") + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<p class="nota">Nenhum movimento' + (mes ? " neste mês" : " ainda") + ".</p>") + "</section>";
    function cats() { var t = $("#lTipo").value, mapa = t === "receita" ? L.categoriasReceita : L.categoriasDespesa, atual = editar && editar.tipo === t ? Object.keys(mapa).filter(function (k) { return mapa[k] === editar.categoria; })[0] : ""; $("#lCat").innerHTML = Object.keys(mapa).map(function (k) { return '<option value="' + esc(k) + '"' + (k === atual ? " selected" : "") + ">" + esc(mapa[k]) + "</option>"; }).join(""); }
    cats(); $("#lTipo").addEventListener("change", cats);
    $("#fLanc").addEventListener("submit", async function (ev) {
      ev.preventDefault(); var er = $("#lErro"); er.hidden = true;
      var corpo = { acao: editar ? "editar" : "criar", id: editar ? editar.id : undefined, tipo: $("#lTipo").value, data: $("#lData").value, valor: $("#lValor").value, categoria: $("#lCat").value, produto: $("#lProd").value, descricao: $("#lDesc").value };
      var bt = ev.target.querySelector("button[type=submit]"); bt.disabled = true;
      try { await chamar("admin-financeiro", { corpo: corpo }); toast(editar ? "Lançamento atualizado." : "Lançamento adicionado."); invalidar(); irPara("financeiro", mes ? { mes: mes } : {}); }
      catch (e) { er.textContent = e.message; er.hidden = false; bt.disabled = false; }
    });
    var cn = $("#lCancelar"); if (cn) cn.onclick = function () { irPara("financeiro", mes ? { mes: mes } : {}); };
    $$("[data-ed]").forEach(function (b) { b.onclick = function () { irPara("financeiro", { mes: mes, editar: b.getAttribute("data-ed") }); }; });
    $$("[data-ex]").forEach(function (b) { b.onclick = async function () { if (!window.confirm("Excluir este lançamento? Isso não afeta pedidos nem pagamentos.")) return; b.disabled = true; try { await chamar("admin-financeiro", { corpo: { acao: "excluir", id: b.getAttribute("data-ex") } }); toast("Lançamento excluído."); invalidar(); rotear(true); } catch (e) { toast(e.message, true); b.disabled = false; } }; });
    $$("tr[data-mes]").forEach(function (tr) { tr.onclick = function () { irPara("financeiro", { mes: tr.getAttribute("data-mes") }); }; });
    $("#btCsv").onclick = function () { baixarCsv("financeiro", ["data", "tipo", "origem", "descrição", "categoria", "produto", "valor (R$)"], movs.map(function (m) { return [m.data, m.tipo, m.automatico ? m.origem : "Lançado", m.descricao, m.categoria, L.produtos[m.produto] || m.produto, (m.tipo === "despesa" ? "-" : "") + decimal(m.valorCentavos)]; })); };
  };

  /* ══ Contas Player e Competição ══ */
  var PAPEIS = [["", "Todas"], ["player", "Só Player"], ["atleta", "Atletas"], ["responsavel", "Responsáveis"], ["treinador", "Treinadores"]];
  TELAS.usuarios = async function (h, forcar) {
    if (h.sub) return telaUsuario(h.sub);
    var q = h.q, c = $("#conteudo"), pagina = parseInt(q.pagina, 10) || 1;
    var d = await carregar("usuarios", "admin-painel", "?secao=usuarios&q=" + encodeURIComponent(q.q || "") + "&papel=" + encodeURIComponent(q.estado || "") + "&pagina=" + pagina, forcar);
    c.innerHTML = cabeca("Contas Player e Competição", "Contas dos dois produtos. O painel mostra só dados de cadastro e contagens, nunca o conteúdo de diário, partidas ou planos.") +
      '<div class="filtros">' + chips(PAPEIS, q.estado || "", function () { return ""; }).replace(/<b>[^<]*<\/b>/g, "") + barraBusca(q, null, false) + "</div>" +
      '<p class="nota">' + n(d.total) + " conta(s) · página " + d.pagina + " de " + Math.max(1, Math.ceil(d.total / d.porPagina)) + ".</p>" +
      (d.usuarios.length ? '<div class="tabela-rolagem"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Papel na Competição</th><th>Assinatura Player</th><th>Criada em</th></tr></thead><tbody>' + d.usuarios.map(function (u) { return '<tr class="link" data-uid="' + esc(u.uid) + '"><td><strong>' + esc(u.nome || "—") + "</strong></td><td>" + esc(u.email || "—") + "</td><td>" + esc(u.papel ? ({ atleta: "Atleta", responsavel: "Responsável", treinador: "Treinador" }[u.papel] || u.papel) + (u.menor ? " (menor)" : "") : "—") + "</td><td>" + esc(u.assinatura || "—") + "</td><td>" + esc(dt(u.criadoEm)) + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<div class="cartao"><p>Nenhuma conta neste filtro.</p></div>') +
      '<div class="paginacao"><button class="bt claro pequeno" id="pgAnt"' + (pagina <= 1 ? " disabled" : "") + '>Página anterior</button><button class="bt claro pequeno" id="pgProx"' + (pagina * d.porPagina >= d.total ? " disabled" : "") + ">Próxima página</button></div>";
    ligarFiltros("usuarios", q);
    $$("tr[data-uid]").forEach(function (tr) { tr.onclick = function () { irPara("usuarios", {}, tr.getAttribute("data-uid")); }; });
    $("#pgAnt").onclick = function () { var nq = Object.assign({}, q); nq.pagina = String(pagina - 1); irPara("usuarios", nq); };
    $("#pgProx").onclick = function () { var nq = Object.assign({}, q); nq.pagina = String(pagina + 1); irPara("usuarios", nq); };
  };
  async function telaUsuario(uid) {
    var u = await chamar("admin-painel", { qs: "?secao=usuario&uid=" + encodeURIComponent(uid) }), c = $("#conteudo");
    var cont = u.contagens, linhasC = Object.keys(cont).filter(function (k) { return cont[k]; }).map(function (k) { return "<tr><td>" + esc({ torneios: "Torneios", partidas: "Partidas", preparos: "Preparações", diario: "Registros de diário", devolutivas: "Devolutivas", focos: "Focos de treino", scouts: "Scouts", compPlanejamentos: "Versões de planejamento", compExecucoes: "Registros de treino", planos: "Planos de jogo", planejamentos: "Programas de treino" }[k] || k) + '</td><td class="num">' + n(cont[k]) + "</td></tr>"; }).join("");
    c.innerHTML = '<p><a href="#/usuarios">Voltar para as contas</a></p>' + cabeca(u.nome || "Conta", u.email || "") +
      '<div class="grade duas"><section class="cartao"><h2>Cadastro</h2><dl class="perfil"><dt>Conta criada em</dt><dd>' + esc(dt(u.criadoEm)) + "</dd><dt>Ficha do Player</dt><dd>" + (u.fichaPreenchida ? "Preenchida" : "Não preenchida") + "</dd><dt>Competição</dt><dd>" + (u.competicao ? esc({ atleta: "Atleta", responsavel: "Responsável", treinador: "Treinador" }[u.competicao.papel]) + (u.competicao.menor ? " (menor de idade)" : "") + (u.competicao.idade != null ? ", " + u.competicao.idade + " anos" : "") + ", ativada em " + esc(dt(u.competicao.ativadoEm)) : "Não ativada") + "</dd><dt>Assinatura Player</dt><dd>" + (u.assinatura ? esc(u.assinatura.status + (u.assinatura.produto ? " · " + u.assinatura.produto : "") + (u.assinatura.ativoAte ? " · até " + dt(u.assinatura.ativoAte) : "")) : "Nenhuma") + "</dd></dl></section>" +
      '<section class="cartao"><h2>Uso (contagens)</h2>' + (linhasC ? '<div class="tabela-rolagem"><table><tbody>' + linhasC + "</tbody></table></div>" : '<p class="nota">Nenhum registro ainda.</p>') + '<p class="nota" style="margin-top:8px">Somente contagens. O conteúdo é privado do usuário.</p></section></div>' +
      '<section class="secao"><h2>Vínculos</h2>' + (u.vinculos.length ? '<div class="tabela-rolagem"><table><thead><tr><th>Papel</th><th>Com</th><th>Situação</th><th>Áreas</th><th>Criado em</th></tr></thead><tbody>' + u.vinculos.map(function (v) { return "<tr><td>" + esc(v.lado) + "</td><td>" + esc(v.outra || "—") + '</td><td><span class="estado ' + (v.status === "ativo" ? "ok" : v.status === "aguardando" || v.status === "convite" ? "espera" : "neutro") + '">' + esc(v.status) + "</span></td><td>" + esc((v.areas || []).join(", ")) + "</td><td>" + esc(dt(v.criadoEm)) + "</td></tr>"; }).join("") + "</tbody></table></div>" : '<p class="nota">Sem vínculos.</p>') + "</section>" +
      '<section class="secao"><h2>Pedidos e acompanhamentos</h2>' + (u.pedidos.length || u.acompanhamentos.length ? '<ul class="pend">' + u.pedidos.map(function (p) { return '<li><a href="#/consultorias?q=' + encodeURIComponent(u.nome) + '"><span class="nivel baixo">Consultoria</span><span>' + esc(p.nome + " · " + reais(p.precoCentavos)) + '</span><span class="estado ' + (CLASSE_PED[p.estado] || "neutro") + '">' + esc(rotuloPed(p.estado)) + "</span></a></li>"; }).join("") + u.acompanhamentos.map(function (a) { return '<li><a href="#/acompanhamentos?q=' + encodeURIComponent(u.nome) + '"><span class="nivel baixo">Acompanhamento</span><span>' + esc(a.inicio ? dt(a.inicio) + " a " + dt(a.fim) : "Solicitado em " + dt(a.criadoEm)) + '</span><span class="estado ' + (CLASSE_AC[a.estado] || "neutro") + '">' + esc((EST_AC.filter(function (x) { return x[0] === a.estado; })[0] || [0, a.estado])[1]) + "</span></a></li>"; }).join("") + "</ul>" : '<p class="nota">Nenhum.</p>') + "</section>";
  }

  /* ══ Academias (app do treinador) ══ */
  var PLANOS_ORG = { gratis: "Grátis (até 5 jogadores)", essencial: "Essencial (até 30)", premium: "Premium (ilimitado)" };
  TELAS.academias = async function (h, forcar) {
    var d = await carregar("academias", "admin-painel", "?secao=academias", forcar), c = $("#conteudo"), q = h.q, lista = d.academias.filter(function (a) { return !q.q || (a.nome + " " + a.orgId).toLowerCase().indexOf(q.q.toLowerCase()) >= 0; });
    c.innerHTML = cabeca("Academias (app do treinador)", "Contas do app de treinadores (Team Yoda e QuadraLab Treinador): plano, validade, jogadores e pedidos de acesso.") + '<div class="filtros">' + barraBusca(q, null, false) + "</div>" +
      (lista.length ? '<div class="tabela-rolagem"><table><thead><tr><th>Academia</th><th class="num">Jogadores</th><th class="num">Equipe</th><th class="num">Aprovações pendentes</th><th>Plano</th><th>Válido até</th><th>Eduzz</th><th></th></tr></thead><tbody>' + lista.map(function (a) {
        return '<tr data-org="' + esc(a.orgId) + '"><td><strong>' + esc(a.nome) + '</strong><div class="nota">' + esc(a.orgId) + '</div></td><td class="num">' + (a.alunos == null ? "—" : n(a.alunos)) + '</td><td class="num">' + n(a.equipe) + '</td><td class="num">' + (a.pendentes ? '<span class="estado espera">' + n(a.pendentes) + "</span>" : "0") + '</td><td><select class="o-plano" aria-label="Plano de ' + esc(a.nome) + '"><option value="">Sem limite</option>' + Object.keys(PLANOS_ORG).map(function (k) { return '<option value="' + k + '"' + (a.plano === k ? " selected" : "") + ">" + esc(PLANOS_ORG[k].split(" ")[0]) + "</option>"; }).join("") + '</select></td><td><input type="date" class="o-validade" value="' + esc(a.planoAtivoAte || "") + '" aria-label="Válido até">' + (a.vencida ? ' <span class="estado espera">vencida</span>' : "") + "</td><td>" + esc(a.eduzzUltimaFatura ? (a.eduzzRevogadoEm ? "Revogado " + dt(a.eduzzRevogadoEm) : "Fatura " + dt(a.eduzzAtualizadoEm)) : "—") + '</td><td><button class="bt claro pequeno" data-salvar-org="' + esc(a.orgId) + '">Salvar</button></td></tr>';
      }).join("") + "</tbody></table></div>" : '<div class="cartao"><p>Nenhuma academia encontrada.</p></div>') +
      '<section class="secao"><details class="cartao"><summary><strong>Criar nova academia</strong></summary><div class="campos duas"><div><label for="nOrg">Identificador (orgId)</label><input id="nOrg" placeholder="academia-exemplo" autocomplete="off"></div><div><label for="nNome">Nome da academia</label><input id="nNome" autocomplete="off"></div><div><label for="nLogo">Logo (URL, opcional)</label><input id="nLogo" type="url" autocomplete="off"></div><div><label for="nPlano">Plano</label><select id="nPlano"><option value="">Sem limite (piloto/teste)</option>' + Object.keys(PLANOS_ORG).map(function (k) { return '<option value="' + k + '">' + esc(PLANOS_ORG[k]) + "</option>"; }).join("") + '</select></div><div><label for="nValid">Licença paga até (opcional)</label><input id="nValid" type="date"></div><div><label for="nEmail">E-mail do treinador</label><input id="nEmail" type="email" autocomplete="off"></div><div><label for="nSenha">Senha inicial</label><input id="nSenha" type="text" placeholder="pelo menos 6 caracteres" autocomplete="off"></div><label class="check" style="align-self:end"><input type="checkbox" id="nManual"> Mostrar a aba Manual</label></div><div class="aviso erro" id="erroOrg" role="alert" hidden></div><div class="acoes"><button class="bt azul" id="btCriarOrg">Criar academia</button></div></details></section>';
    ligarFiltros("academias", q);
    $$("[data-salvar-org]").forEach(function (b) { b.onclick = async function () { var tr = b.closest("tr"), plano = $(".o-plano", tr).value, val = $(".o-validade", tr).value; b.disabled = true; try { await chamar("atualizar-org", { corpo: { orgId: b.getAttribute("data-salvar-org"), plano: plano || undefined, planoAtivoAte: val || undefined, limparPlanoAtivoAte: !val } }); toast("Academia atualizada."); invalidar(); rotear(true); } catch (e) { toast(e.message, true); b.disabled = false; } }; });
    $("#btCriarOrg").onclick = async function () {
      var er = $("#erroOrg"); er.hidden = true; var corpo = { orgId: $("#nOrg").value.trim(), nomeAcademia: $("#nNome").value.trim(), logoUrl: $("#nLogo").value.trim(), plano: $("#nPlano").value, planoAtivoAte: $("#nValid").value, mostrarManual: $("#nManual").checked, email: $("#nEmail").value.trim(), senha: $("#nSenha").value };
      if (!corpo.orgId || !corpo.email || !corpo.senha) { er.textContent = "Preencha o identificador, o e-mail e a senha."; er.hidden = false; return; }
      this.disabled = true;
      try { var r = await chamar("provisionar-org", { corpo: corpo }); toast('Academia "' + r.orgId + '" criada para ' + r.email + "."); invalidar(); rotear(true); } catch (e) { er.textContent = e.message; er.hidden = false; this.disabled = false; }
    };
  };

  /* ══ Sistema ══ */
  TELAS.sistema = async function (h, forcar) {
    var d = await carregar("sistema", "admin-painel", "?secao=sistema", forcar), c = $("#conteudo");
    function linha(ok, opcional, rot, det) { return '<div class="status-sis"><span class="estado ' + (ok ? "ok" : opcional ? "neutro" : "espera") + ' marco">' + (ok ? "OK" : opcional ? "Opcional" : "Pendente") + '</span><div><strong>' + esc(rot) + '</strong><p class="nota">' + esc(det) + "</p></div></div>"; }
    c.innerHTML = cabeca("Sistema e configuração", "Conferência do que precisa estar configurado para tudo funcionar. Só mostra “definido” ou “não definido”, nunca os valores.") +
      '<div class="grade duas"><section class="cartao"><h2>Variáveis do Netlify</h2>' + d.itens.map(function (i) { return linha(i.ok, i.opcional, i.rotulo, i.efeito); }).join("") + '</section><section class="cartao"><h2>Pagamentos e políticas</h2>' + d.comerciais.map(function (i) { return linha(i.ok, false, i.rotulo, i.detalhe); }).join("") + "</section></div>" +
      '<section class="secao"><h2>Sessões neste painel</h2><p class="nota">Quem entra com “Manter conectado” fica conectado por 30 dias no aparelho. Se perder um celular ou computador, encerre todas as sessões e, se achar necessário, troque o ADMIN_SECRET no Netlify (isso também derruba tudo).</p><div class="acoes"><button type="button" class="bt claro" id="btSairTodos">Sair de todos os aparelhos</button></div></section>' +
      '<section class="secao"><h2>Atalhos</h2><div class="acoes"><a class="bt claro" href="' + esc(d.links.netlifyQuadralab) + '" target="_blank" rel="noopener noreferrer">Netlify · quadralab</a><a class="bt claro" href="' + esc(d.links.netlifyTeamYoda) + '" target="_blank" rel="noopener noreferrer">Netlify · teamyoda</a><a class="bt claro" href="https://wa.me/' + esc(d.whatsapp) + '" target="_blank" rel="noopener noreferrer">WhatsApp de suporte</a></div></section>';
    var bst = $("#btSairTodos"); if (bst) bst.onclick = async function () { if (!window.confirm("Encerrar todas as sessões? Você e qualquer outro aparelho precisarão digitar o segredo de novo.")) return; bst.disabled = true; try { await chamar("admin-sessao", { corpo: { acao: "sairTodos" } }); sair("Todas as sessões foram encerradas. Entre de novo com o segredo.", true); } catch (e) { toast(e.message, true); bst.disabled = false; } };
  };
})();
