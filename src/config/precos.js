/**
 * PREÇOS — Valores comerciais dos planos do BarberPro SaaS.
 *
 * Este arquivo contém APENAS informações de precificação.
 * Limites e recursos ficam em planos.js.
 *
 * Separação garante que reajustes, promoções ou novos gateways
 * não alterem a definição funcional dos planos.
 *
 * Gateways suportados (IDs preenchidos na integração futura):
 *   - Stripe
 *   - Mercado Pago
 *   - Asaas
 */

export const PRECOS = {
  starter: {
    planoId: 'starter',
    moeda: 'BRL',
    valor: 0,             // em centavos — R$ 0,00 (trial/gratuito)
    intervalo: 'mensal',
    ativo: true,
    descricao: 'Ideal para começar',
    gateway: {
      stripe:      { priceId: null },
      mercadopago: { planId: null  },
      asaas:       { planId: null  },
    },
  },

  profissional: {
    planoId: 'profissional',
    moeda: 'BRL',
    valor: 9700,          // em centavos — R$ 97,00
    intervalo: 'mensal',
    ativo: true,
    descricao: 'Para barbearias em crescimento',
    gateway: {
      stripe:      { priceId: null },
      mercadopago: { planId: null  },
      asaas:       { planId: null  },
    },
  },
};

/** Retorna o preço de um plano pelo id. */
export function getPreco(planoId) {
  return PRECOS[planoId] ?? null;
}

/** Retorna o valor formatado em reais (ex: "R$ 97,00"). */
export function formatarValor(planoId) {
  const preco = getPreco(planoId);
  if (!preco || preco.valor === 0) return 'Grátis';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(preco.valor / 100);
}
