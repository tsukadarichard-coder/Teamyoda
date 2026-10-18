# Olhar do treinador (QuadraLab Player)

Produto de entrada: uma dúvida sobre uma estratégia, respondida por Richard Tsukada em áudio ou vídeo de 3 a 5 minutos.
**R$ 47,90, pagamento único, sem recorrência.** Prazo: até 3 dias úteis após a confirmação do pagamento.

## Onde está cada coisa
- `netlify/functions/_player-olhar.js`: fonte única de preço (4790 centavos), textos de escopo, prazo, limites, estados, dias úteis/feriados e a ligação com a Eduzz.
- `netlify/functions/player-olhar.js`: pedido, pagamento e entrega do lado do jogador.
- `netlify/functions/admin-olhar.js`: fila e entrega do lado do Richard (Painel → Olhar do treinador).
- `netlify/functions/_olhar-armazenamento.js`: armazenamento privado (URLs assinadas curtas).
- `netlify/functions/webhook-eduzz.js`: confirma o pagamento (idempotente) e reconhece estorno/cancelamento.
- Página de vendas: `player/landing.js`. App: `player/player.js` (telas `#/olhar`, `#/olhar/pedir`, `#/olhar/revisar`, `#/olhar/pedido/ID`, `#/atendimentos`).

## O que falta configurar fora do código para vender e entregar de verdade
1. **Eduzz**: criar o produto "Olhar do treinador", valor R$ 47,90, pagamento único. Em `_player-olhar.js`, preencher `CHECKOUT_OLHAR` (`eduzzProductId` e `checkoutUrl`, https). Enquanto estiver vazio, o app avisa que o pagamento está indisponível, registra a pendência no Painel e não simula nada. O webhook já cobre os eventos de fatura paga, cancelada e reembolsada. A Eduzz não informa valores no webhook: o preço de R$ 47,90 precisa estar certo no produto da Eduzz.
2. **Retorno do checkout**: na Eduzz, configurar a página de retorno para `https://quadralab.com.br/player/#/atendimentos`.
3. **Armazenamento (Firebase Storage)**: ativar o Storage do projeto; conta de serviço com permissão de Storage; se o bucket não for `<projeto>.firebasestorage.app` nem `<projeto>.appspot.com`, definir `FIREBASE_STORAGE_BUCKET` no Netlify. Publicar `storage.rules` (nega todo acesso direto). No Painel → Olhar do treinador, tocar em **Preparar armazenamento** uma vez (libera o envio do navegador ao bucket).
4. **Feriados municipais ou recessos**: acrescentar em `FERIADOS_EXTRAS` (formato `AAAA-MM-DD`). Os nacionais, Carnaval, Sexta-feira Santa e Corpus Christi já são calculados.
5. **Avisos (opcional)**: `OLHAR_WEBHOOK_URL` (Slack ou similar) avisa a equipe quando um pedido é pago. Não há envio de e-mail configurado na plataforma: a confirmação e a devolutiva são avisadas dentro do app (início e Meus atendimentos), e o pedido registra que o e-mail está indisponível.
6. **Termos e privacidade**: os links reais (`LINKS` em `_player-assinaturas.js`) e a política de armazenamento/retenção dos arquivos, que hoje não existe em texto.

## Testes
- `node tests/check-olhar.js`: regras, pedido, pagamento, idempotência, snapshot, acesso e entrega.
- `node tests/smoke-olhar.js`: ponta a ponta no navegador (precisa de Playwright, Chromium e ffmpeg).
