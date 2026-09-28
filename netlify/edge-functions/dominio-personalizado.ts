import type { Context, Config } from "@netlify/edge-functions";

/* Domínio próprio por academia — quando alguém compra um domínio dedicado
   (ex: 39tennis.com.br) pra abrir direto o app do cliente, sem precisar
   digitar "?org=..." na mão. O site continua o mesmo (teamyoda.netlify.app
   segue igual, com o painel do treinador na raiz) — só a raiz "/" desses
   domínios específicos serve o app do cliente da academia certa. Pra
   adicionar uma nova academia com domínio próprio, basta acrescentar uma
   linha no mapa abaixo.

   Um rewrite comum (context.rewrite("/cliente.html?org=...")) NÃO
   funciona aqui: rewrite troca o arquivo servido por trás dos panos, mas
   o navegador continua enxergando a URL original (sem query string) —
   e é o navegador, via window.location.search, quem o cliente.html usa
   pra saber o org. Por isso a resposta do rewrite é buscada aqui e tem
   um <script> injetado no <head>, definindo window.__ORG_FORCADO antes
   do resto da página rodar — o cliente.html lê essa variável como
   alternativa, quando a URL não tem "?org=" nenhum (ver cliente.html). */
const DOMINIO_PARA_ORG: Record<string, string> = {
  "39tennis.com.br": "39-ranch",
  "www.39tennis.com.br": "39-ranch",
};

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const org = DOMINIO_PARA_ORG[url.hostname];
  if (!org || (url.pathname !== "/" && url.pathname !== "")) {
    return context.next();
  }

  const respostaOrigem = await context.rewrite(new URL("/cliente.html", url));
  const html = await respostaOrigem.text();
  const comOrgForcado = html.replace(
    "<head>",
    `<head>\n<script>window.__ORG_FORCADO = ${JSON.stringify(org)};</script>`
  );

  const headers = new Headers(respostaOrigem.headers);
  headers.delete("content-length");

  return new Response(comOrgForcado, { status: respostaOrigem.status, headers });
};

export const config: Config = {
  path: "/",
};
