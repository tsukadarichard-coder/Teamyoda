/* Versão em segundo plano do gerador de IA.
   Gerar um plano de várias semanas facilmente passa dos ~10s que uma
   function comum tem para responder — o sufixo "-background" no nome do
   arquivo é o que diz ao Netlify para deixar essa function rodar até 15
   minutos, sem prender quem chamou esperando a resposta.

   O resultado não volta na resposta HTTP (o Netlify já respondeu 202
   antes disso) — ele é escrito em orgs/{orgId}/iaJobs/{jobId}, e é de lá
   que o app lê quando o job termina. */
const { admin, app } = require("./_firebase-admin");

/* Conta o uso real de IA por academia — só chamado quando a Anthropic
   de fato gerou algo (sucesso ou cortado por tamanho, tudo cobrado do
   mesmo jeito); uma recusa antes de gerar (400/401/429) não é chamada
   aqui. Falha em registrar nunca derruba a geração em si. */
async function registrarUso(orgId, dados) {
  try {
    const usage = dados.usage || {};
    await admin.firestore().collection("orgs").doc(orgId).collection("meta").doc("usoIA").set({
      geracoes: admin.firestore.FieldValue.increment(1),
      tokensEntrada: admin.firestore.FieldValue.increment(usage.input_tokens || 0),
      tokensSaida: admin.firestore.FieldValue.increment(usage.output_tokens || 0),
      ultimaEm: new Date().toISOString(),
    }, { merge: true });
  } catch (e) {
    console.error("Falha ao registrar uso de IA:", e);
  }
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Método não permitido." };

  const cabecalho = event.headers.authorization || event.headers.Authorization || "";
  const idToken = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : null;
  if (!idToken) return { statusCode: 401, body: "Faltou o login." };

  let claims;
  try {
    app();
    claims = await admin.auth().verifyIdToken(idToken);
  } catch (e) {
    return { statusCode: 401, body: "Login inválido ou expirado." };
  }
  if (!claims.orgId) return { statusCode: 403, body: "Esta conta ainda não está ligada a uma academia." };

  let corpo;
  try {
    corpo = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: "Corpo da requisição inválido." };
  }

  const { prompt, maxTokens, jobId } = corpo;
  if (!prompt || typeof prompt !== "string" || !jobId) {
    return { statusCode: 400, body: "Faltou prompt ou jobId." };
  }

  const ref = admin.firestore().collection("orgs").doc(claims.orgId).collection("iaJobs").doc(jobId);

  const chaveAnthropic = process.env.ANTHROPIC_API_KEY;
  if (!chaveAnthropic) {
    await ref.set({ status: "erro", erro: "O servidor ainda não tem a chave da Anthropic configurada.", criadoEm: new Date().toISOString() });
    return { statusCode: 202, body: "" };
  }

  /* claude-sonnet-5 aceita até 128 mil tokens de saída — um plano de
     turma com várias semanas e aulas detalhadas passa fácil de 8 mil e
     saía cortado no meio do JSON (o app via isso como "JSON Parse
     error: Unexpected EOF", sem dizer o que realmente aconteceu). */
  const tokensMax = Math.min(Math.max(Number(maxTokens) || 4000, 1), 32000);

  /* Sem stream, essa chamada é UMA requisição HTTP só, que fica presa
     esperando o corpo inteiro chegar de uma vez — pra um plano grande
     (16-32 mil tokens de saída), a geração pode passar de vários
     minutos sem nenhum byte trafegando, e tanto a própria Anthropic
     quanto a infraestrutura de rede no meio do caminho tratam isso como
     conexão parada e derrubam antes de terminar (daí "demora muito ou
     não gera por exceder o tempo", mesmo esta function tendo até 15min).
     Com stream, os tokens chegam aos poucos — a conexão nunca fica
     muda por muito tempo, então não tem motivo pra ninguém no caminho
     decidir que ela travou. */
  const abortTimeout = AbortController ? new AbortController() : null;
  const cronometro = abortTimeout ? setTimeout(() => abortTimeout.abort(), 13 * 60 * 1000) : null;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": chaveAnthropic,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: tokensMax,
        messages: [{ role: "user", content: prompt }],
        stream: true,
      }),
      signal: abortTimeout ? abortTimeout.signal : undefined,
    });
    if (!r.ok) {
      const dados = await r.json().catch(() => ({}));
      await ref.set({
        status: "erro",
        erro: (dados && dados.error && dados.error.message) || ("Erro " + r.status),
        criadoEm: new Date().toISOString(),
      });
      return { statusCode: 202, body: "" };
    }

    const { texto, usage, stopReason } = await lerEventosDeStream(r.body);
    await registrarUso(claims.orgId, { usage });
    if (stopReason === "max_tokens") {
      await ref.set({
        status: "erro",
        erro: "A resposta da IA foi cortada por passar do limite de tamanho antes de terminar o plano. Tente com menos aulas por semana, ou gere de novo — às vezes sai mais enxuto.",
        criadoEm: new Date().toISOString(),
      });
      return { statusCode: 202, body: "" };
    }
    await ref.set({ status: "pronto", texto, criadoEm: new Date().toISOString() });
  } catch (e) {
    const motivo = e && e.name === "AbortError"
      ? "A geração passou de 13 minutos sem terminar e foi interrompida."
      : "Falha ao falar com a Anthropic: " + String(e.message || e);
    await ref.set({ status: "erro", erro: motivo, criadoEm: new Date().toISOString() });
  } finally {
    if (cronometro) clearTimeout(cronometro);
  }

  return { statusCode: 202, body: "" };
};

/* Lê a resposta em streaming (Server-Sent Events) da Anthropic,
   acumulando o texto conforme cada pedaço chega — ver comentário acima
   sobre por que isso evita o timeout que a versão sem stream sofria.
   Formato de cada evento: "event: <tipo>\ndata: <json>\n\n". Só os
   tipos usados aqui (message_start pro usage de entrada,
   content_block_delta pro texto, message_delta pro usage de saída e
   stop_reason) são tratados — os demais (content_block_start/stop,
   message_stop, ping) são ignorados de propósito. */
async function lerEventosDeStream(corpo) {
  const reader = corpo.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let texto = "";
  const usage = { input_tokens: 0, output_tokens: 0 };
  let stopReason = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let fimEvento;
    while ((fimEvento = buffer.indexOf("\n\n")) >= 0) {
      const bloco = buffer.slice(0, fimEvento);
      buffer = buffer.slice(fimEvento + 2);
      const linhaDados = bloco.split("\n").find((l) => l.startsWith("data:"));
      if (!linhaDados) continue;
      let evento;
      try { evento = JSON.parse(linhaDados.slice(5).trim()); } catch (e) { continue; }
      if (evento.type === "message_start" && evento.message && evento.message.usage) {
        usage.input_tokens = evento.message.usage.input_tokens || 0;
      } else if (evento.type === "content_block_delta" && evento.delta && evento.delta.type === "text_delta") {
        texto += evento.delta.text;
      } else if (evento.type === "message_delta") {
        if (evento.delta && evento.delta.stop_reason) stopReason = evento.delta.stop_reason;
        if (evento.usage && evento.usage.output_tokens) usage.output_tokens = evento.usage.output_tokens;
      } else if (evento.type === "error") {
        throw new Error((evento.error && evento.error.message) || "Erro no streaming da Anthropic.");
      }
    }
  }
  return { texto, usage, stopReason };
}
