/* Inicialização compartilhada do Firebase Admin SDK, usada pelas
   functions que precisam validar login ou gerenciar contas.

   Espera a variável de ambiente FIREBASE_SERVICE_ACCOUNT com o JSON
   da conta de serviço (Firebase console → Configurações do projeto →
   Contas de serviço → Gerar nova chave privada) colado como string,
   configurada no Netlify em Site configuration → Environment variables. */
const admin = require("firebase-admin");

function app() {
  if (admin.apps.length) return admin.app();
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT não configurada no Netlify.");
  let credenciais;
  try {
    credenciais = JSON.parse(raw);
  } catch (e) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT não é um JSON válido.");
  }
  return admin.initializeApp({ credential: admin.credential.cert(credenciais) });
}

module.exports = { admin, app };
