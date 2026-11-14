/* Venda dos planos anuais do QuadraLab Scout: o ÚNICO lugar para ligar a venda no app e na página de apresentação
   (decisão do Richard em 14/11/2026: "Depois só configura na Eduzz").
   Enquanto preço e link estiverem vazios, tudo continua "plano anual · em breve", sem preço nem botão de compra.
   Para abrir a venda:
     1. Criar na Eduzz os produtos anuais "QuadraLab Scout Plus" (até 3 atletas) e "QuadraLab Scout Treinador" (atletas sem limite).
     2. Preencher abaixo o preço como deve aparecer (ex.: "R$ 199") e o link do checkout de cada um (https://chk.eduzz.com/...).
     3. No webhook-eduzz.js, ligar o código de cada produto ao plano por 12 meses — mudança na integração de pagamento:
        só com o "pode fazer" do Richard.
   Quem compra precisa usar o mesmo e-mail da conta do Scout: é por ele que o webhook encontra a conta. */
window.QLSVenda = {
  plus: { preco: "", link: "" },
  treinador: { preco: "", link: "" },
};
