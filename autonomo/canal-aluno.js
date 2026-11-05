/* Conversas do aluno (link do aluno e Área do aluno): o grupo de cada turma em que o aluno está e a conversa com o professor
   (netlify/functions/canal.js). Fica num botão fixo, por cima da página, com a própria atualização: o resto da página se
   redesenha a cada 20 s e não pode apagar o que a pessoa está escrevendo. Quem escreve pode marcar "sou o responsável".
   Este arquivo é igual em autonomo/ e mty/. */
(function () {
  "use strict";
  var q = new URLSearchParams(location.search), LINK = q.get("org") && q.get("id") && q.get("t") ? { org: q.get("org"), id: q.get("id"), t: q.get("t") } : null;
  var auth = !LINK && typeof firebase !== "undefined" && firebase.apps && firebase.apps.length ? firebase.auth() : null;
  if (!LINK && !auth) return;
  var CHAVE = LINK ? LINK.org + ":" + LINK.id : "conta";
  var estado = { canais: [], aberto: null, dados: null, painel: false, erro: "", enviando: false, rascunho: "" };
  var raiz, timerLista = 0, timerConversa = 0;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function ler(k) { try { return localStorage.getItem("ql-canal-aluno:" + CHAVE + ":" + k) || ""; } catch (e) { return ""; } }
  function gravar(k, v) { try { localStorage.setItem("ql-canal-aluno:" + CHAVE + ":" + k, v); } catch (e) { /* sem armazenamento */ } }
  function hora(iso) { var d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }); }
  async function chamar(corpo) {
    var h = { "content-type": "application/json" };
    if (LINK) corpo.link = LINK;
    else { var u = auth.currentUser; if (!u) throw new Error("Entre com a sua conta."); h.authorization = "Bearer " + (await u.getIdToken()); }
    var r = await fetch("/.netlify/functions/canal", { method: "POST", headers: h, body: JSON.stringify(corpo), cache: "no-store" });
    var d = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(d.erro || "Não foi possível agora.");
    return d;
  }
  function naoLidas(c) { return c.ultima && c.ultima.em > ler("lido:" + c.canal) ? 1 : 0; }

  function estilo() {
    if (document.getElementById("ql-canal-estilo")) return;
    var s = document.createElement("style"); s.id = "ql-canal-estilo";
    s.textContent = ".qc-bt{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:60;border:none;border-radius:999px;background:#0E3B2E;color:#fff;font:700 15px system-ui,-apple-system,sans-serif;padding:13px 18px;box-shadow:0 6px 18px rgba(0,0,0,.25);cursor:pointer;min-height:48px}" +
      ".qc-bt b{display:inline-block;min-width:20px;margin-left:6px;padding:1px 6px;border-radius:999px;background:#E8691F;font-size:12px}" +
      ".qc-fundo{position:fixed;inset:0;background:rgba(10,20,16,.45);z-index:61}" +
      ".qc-painel{position:fixed;left:0;right:0;bottom:0;top:8vh;max-width:640px;margin:0 auto;background:#fff;z-index:62;border-radius:16px 16px 0 0;display:flex;flex-direction:column;font-family:system-ui,-apple-system,sans-serif;color:#14202B}" +
      ".qc-topo{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #E4DED9}.qc-topo h2{font-size:16px;margin:0;flex:1}" +
      ".qc-x{border:none;background:none;font-size:22px;width:44px;height:44px;cursor:pointer;color:#555}.qc-volta{border:none;background:none;font-size:15px;font-weight:700;color:#0E3B2E;cursor:pointer;min-height:44px;padding:0 6px}" +
      ".qc-corpo{flex:1;overflow-y:auto;padding:12px 14px}.qc-item{display:block;width:100%;text-align:left;border:1px solid #E4DED9;border-radius:12px;background:#fff;padding:12px;margin-bottom:8px;cursor:pointer;font:inherit}" +
      ".qc-item strong{font-size:15px}.qc-item span{display:block;font-size:13px;color:#666;margin-top:3px}.qc-novo{display:inline-block;width:9px;height:9px;border-radius:50%;background:#E8691F;margin-left:6px}" +
      ".qc-msg{display:flex;margin-bottom:8px}.qc-msg.minha{justify-content:flex-end}.qc-bolha{max-width:82%;border:1px solid #E4DED9;border-radius:12px;padding:7px 10px;background:#F6F3EF}" +
      ".qc-msg.minha .qc-bolha{background:#E3F1E8}.qc-msg.prof .qc-bolha{background:#FFF4E8}.qc-autor{font-size:11.5px;font-weight:700;color:#555}.qc-texto{font-size:14.5px;white-space:pre-wrap;word-break:break-word;margin:2px 0 0}" +
      ".qc-apagar{border:none;background:none;font-size:11.5px;color:#666;text-decoration:underline;cursor:pointer;padding:2px 0}.qc-nota{font-size:12.5px;color:#666;margin:0 0 10px}" +
      ".qc-pe{border-top:1px solid #E4DED9;padding:10px 14px calc(10px + env(safe-area-inset-bottom))}.qc-pe textarea{width:100%;box-sizing:border-box;font:inherit;font-size:15px;border:1px solid #C9D3CE;border-radius:10px;padding:9px;min-height:46px;resize:vertical}" +
      ".qc-linha{display:flex;gap:8px;align-items:center;justify-content:space-between;margin-top:8px;flex-wrap:wrap}.qc-enviar{border:none;border-radius:10px;background:#0E3B2E;color:#fff;font-weight:700;font-size:15px;padding:11px 18px;cursor:pointer;min-height:44px}" +
      ".qc-enviar:disabled{opacity:.5}.qc-erro{background:#FBEAEA;color:#8A1F1F;border-radius:10px;padding:8px 10px;font-size:13px;margin-bottom:8px}.qc-resp{font-size:13px;display:flex;align-items:center;gap:6px}";
    document.head.appendChild(s);
  }

  function desenhar() {
    estilo();
    if (!raiz) { raiz = document.createElement("div"); raiz.id = "ql-conversas"; document.body.appendChild(raiz); }
    if (!estado.canais.length && !estado.painel) { raiz.innerHTML = ""; return; } /* conta sem vínculo, link inválido: sem botão */
    var novas = estado.canais.reduce(function (n, c) { return n + naoLidas(c); }, 0);
    var html = '<button type="button" class="qc-bt" data-qc-abrir aria-haspopup="dialog">Conversas' + (novas ? "<b>" + novas + "</b>" : "") + "</button>";
    if (estado.painel) {
      html += '<div class="qc-fundo" data-qc-fechar></div><div class="qc-painel" role="dialog" aria-modal="true" aria-label="Conversas">';
      if (!estado.aberto) {
        html += '<div class="qc-topo"><h2>Conversas</h2><button type="button" class="qc-x" data-qc-fechar aria-label="Fechar">×</button></div><div class="qc-corpo">' +
          (estado.erro ? '<div class="qc-erro">' + esc(estado.erro) + "</div>" : "") +
          estado.canais.map(function (c) {
            return '<button type="button" class="qc-item" data-qc-canal="' + esc(c.canal) + '"><strong>' + esc(c.tipo === "turma" ? "Grupo da turma " + c.nome : c.nome) + "</strong>" + (naoLidas(c) ? '<i class="qc-novo" aria-label="mensagem nova"></i>' : "") +
              "<span>" + (c.ultima ? esc(c.ultima.autorNome + ": " + c.ultima.texto) : c.tipo === "turma" ? "O professor e a turma conversam aqui." : "Fale com o seu professor por aqui.") + "</span></button>";
          }).join("") + "</div>";
      } else {
        var d = estado.dados, turma = d && d.tipo === "turma", bloqueado = d && (d.soProfessor || d.silenciado);
        html += '<div class="qc-topo"><button type="button" class="qc-volta" data-qc-voltar>‹</button><h2>' + esc(d ? (turma ? "Grupo da turma " + d.nome : d.nome) : "Carregando…") + '</h2><button type="button" class="qc-x" data-qc-fechar aria-label="Fechar">×</button></div>' +
          '<div class="qc-corpo" id="qcMensagens">' + (estado.erro ? '<div class="qc-erro">' + esc(estado.erro) + "</div>" : "") +
          (d ? '<p class="qc-nota">' + (turma ? "Todos da turma e o professor leem as mensagens deste grupo. Aparece só o primeiro nome. Combine com respeito." : "Só você (e o seu responsável) e o professor leem esta conversa.") + "</p>" +
            (d.mensagens.length ? "" : '<p class="qc-nota">Nenhuma mensagem ainda.</p>') +
            d.mensagens.map(function (m) {
              var prof = m.autor.tipo === "professor";
              return '<div class="qc-msg' + (m.minha ? " minha" : "") + (prof ? " prof" : "") + '"><div class="qc-bolha"><div class="qc-autor">' + esc(m.autor.nome) + (prof ? " · professor" : "") + " · " + esc(hora(m.em)) + "</div>" +
                (m.apagada ? '<p class="qc-texto" style="font-style:italic;color:#777">Mensagem apagada</p>' : '<p class="qc-texto">' + esc(m.texto) + "</p>") +
                (m.minha && !m.apagada ? '<button type="button" class="qc-apagar" data-qc-apagar="' + esc(m.id) + '">Apagar</button>' : "") + "</div></div>";
            }).join("") : "") + "</div>";
        if (d) html += '<div class="qc-pe">' + (bloqueado
          ? '<p class="qc-nota" style="margin:0">' + (d.soProfessor ? "Neste canal só o professor escreve." : "O professor pausou as suas mensagens neste canal.") + "</p>"
          : '<textarea id="qcTexto" maxlength="1000" placeholder="' + (turma ? "Mensagem para a turma" : "Mensagem para o professor") + '" aria-label="Mensagem">' + esc(estado.rascunho) + "</textarea>" +
            '<div class="qc-linha"><label class="qc-resp"><input type="checkbox" id="qcResp"' + (ler("responsavel") === "1" ? " checked" : "") + "> Sou o responsável</label>" +
            '<button type="button" class="qc-enviar" id="qcEnviar"' + (estado.enviando ? " disabled" : "") + ">" + (estado.enviando ? "Enviando…" : "Enviar") + "</button></div>") + "</div>";
      }
      html += "</div>";
    }
    var focado = document.activeElement && document.activeElement.id === "qcTexto", pos = focado ? document.activeElement.selectionStart : 0;
    raiz.innerHTML = html;
    var rp = document.getElementById("qcResp");
    if (rp) rp.addEventListener("change", function () { gravar("responsavel", rp.checked ? "1" : "0"); });
    var ta = document.getElementById("qcTexto");
    if (ta) { ta.addEventListener("input", function () { estado.rascunho = ta.value; }); if (focado) { ta.focus(); try { ta.setSelectionRange(pos, pos); } catch (e) { /* */ } } }
    var cx = document.getElementById("qcMensagens"); if (cx && estado.aberto) cx.scrollTop = cx.scrollHeight;
  }

  async function atualizarLista() {
    try { var r = await chamar({ acao: "meus" }); estado.canais = r.canais || []; estado.erro = ""; }
    catch (e) { if (estado.painel) estado.erro = e.message; }
    if (!estado.aberto) desenhar(); else desenharBotaoSoh();
  }
  function desenharBotaoSoh() { var b = raiz && raiz.querySelector("[data-qc-abrir]"); if (!b) return; var n = estado.canais.reduce(function (s, c) { return s + naoLidas(c); }, 0); b.innerHTML = "Conversas" + (n ? "<b>" + n + "</b>" : ""); }
  async function abrirConversa(canal, silencioso) {
    estado.aberto = canal; if (!silencioso) { estado.dados = null; estado.erro = ""; desenhar(); }
    try {
      var d = await chamar({ acao: "listar", canal: canal });
      if (estado.aberto !== canal) return;
      var mudou = !estado.dados || JSON.stringify(estado.dados.mensagens) !== JSON.stringify(d.mensagens) || estado.dados.soProfessor !== d.soProfessor || estado.dados.silenciado !== d.silenciado;
      estado.dados = d; estado.erro = "";
      if (d.mensagens.length) gravar("lido:" + canal, d.mensagens[d.mensagens.length - 1].em);
      if (mudou || !silencioso) desenhar();
    } catch (e) { estado.erro = e.message; desenhar(); }
  }
  async function enviar() {
    var ta = document.getElementById("qcTexto"); if (!ta || !ta.value.trim() || estado.enviando) return;
    var resp = document.getElementById("qcResp"); gravar("responsavel", resp && resp.checked ? "1" : "0");
    estado.rascunho = ta.value; estado.enviando = true; desenhar();
    try { await chamar({ acao: "enviar", canal: estado.aberto, texto: estado.rascunho, comoResponsavel: !!(resp && resp.checked) }); estado.rascunho = ""; }
    catch (e) { estado.erro = e.message; }
    estado.enviando = false; await abrirConversa(estado.aberto, true); desenhar();
  }

  document.addEventListener("click", function (ev) {
    var a = ev.target.closest("[data-qc-abrir],[data-qc-fechar],[data-qc-canal],[data-qc-voltar],[data-qc-apagar],#qcEnviar");
    if (!a || !raiz || !raiz.contains(a)) return;
    if (a.hasAttribute("data-qc-abrir")) { estado.painel = true; estado.aberto = null; desenhar(); atualizarLista(); }
    else if (a.hasAttribute("data-qc-fechar")) { estado.painel = false; estado.aberto = null; desenhar(); }
    else if (a.hasAttribute("data-qc-voltar")) { estado.aberto = null; desenhar(); atualizarLista(); }
    else if (a.hasAttribute("data-qc-canal")) abrirConversa(a.getAttribute("data-qc-canal"));
    else if (a.hasAttribute("data-qc-apagar")) { if (window.confirm("Apagar esta mensagem?")) chamar({ acao: "apagar", canal: estado.aberto, mensagemId: a.getAttribute("data-qc-apagar") }).then(function () { abrirConversa(estado.aberto, true); }).catch(function (e) { estado.erro = e.message; desenhar(); }); }
    else if (a.id === "qcEnviar") enviar();
  });
  document.addEventListener("keydown", function (ev) { if (ev.target && ev.target.id === "qcTexto" && ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); enviar(); } });

  function iniciar() {
    atualizarLista();
    clearInterval(timerLista); clearInterval(timerConversa);
    timerLista = setInterval(function () { if (!document.hidden && !estado.aberto) atualizarLista(); }, 60000);
    timerConversa = setInterval(function () { if (!document.hidden && estado.painel && estado.aberto) abrirConversa(estado.aberto, true); }, 15000);
  }
  if (LINK) iniciar();
  else auth.onAuthStateChanged(function (u) {
    if (u) { setTimeout(iniciar, 800); }
    else { clearInterval(timerLista); clearInterval(timerConversa); estado = { canais: [], aberto: null, dados: null, painel: false, erro: "", enviando: false, rascunho: "" }; if (raiz) raiz.innerHTML = ""; }
  });
})();
