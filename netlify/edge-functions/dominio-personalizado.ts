import type { Context, Config } from "@netlify/edge-functions";

/* Domínio próprio por academia — quando alguém compra um domínio dedicado
   (ex: 39tennis.com.br) pra abrir direto o app do cliente, sem precisar
   digitar "?org=..." na mão. O site continua o mesmo (teamyoda.netlify.app
   segue igual, com o painel do treinador na raiz) — só a raiz "/" desses
   domínios específicos é redirecionada pro app do cliente da academia
   certa. Pra adicionar uma nova academia com domínio próprio, basta
   acrescentar uma linha no mapa abaixo. */
const DOMINIO_PARA_ORG: Record<string, string> = {
  "39tennis.com.br": "39-ranch",
  "www.39tennis.com.br": "39-ranch",
};

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const org = DOMINIO_PARA_ORG[url.hostname];
  if (org && (url.pathname === "/" || url.pathname === "")) {
    return context.rewrite(`/cliente.html?org=${org}`);
  }
  return context.next();
};

export const config: Config = {
  path: "/",
};
