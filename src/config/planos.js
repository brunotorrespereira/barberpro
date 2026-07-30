/**
 * PLANOS — Definição funcional dos planos do BarberPro SaaS.
 *
 * Este arquivo contém APENAS limites, recursos e comportamento funcional.
 * Valores comerciais ficam em precos.js — separados para permitir
 * promoções e reajustes sem impactar a lógica de planos.
 *
 * versaoPlano: salvo em cada empresa para permitir evolução dos planos
 * sem impactar clientes que contrataram versões anteriores.
 */

export const VERSAO_PLANOS_ATUAL = 'v1';

export const PLANOS = {
  starter: {
    planoId: 'starter',
    nome: 'Starter',
    versao: 'v1',
    limites: {
      barbeiros: 2,
      usuarios: 1,
      clientes: 100,
      agendamentosPorMes: 200,
    },
    recursos: {
      agendamentos: true,
      clientes: true,
      barbeiros: true,
      relatorios: false,
      multiusuario: false,
      apiAccess: false,
      whatsappIntegration: false,
      fidelidade: false,
    },
  },

  profissional: {
    planoId: 'profissional',
    nome: 'Profissional',
    versao: 'v1',
    limites: {
      barbeiros: 10,
      usuarios: 5,
      clientes: -1,           // -1 = ilimitado
      agendamentosPorMes: -1,
    },
    recursos: {
      agendamentos: true,
      clientes: true,
      barbeiros: true,
      relatorios: true,
      multiusuario: true,
      apiAccess: false,
      whatsappIntegration: true,
      fidelidade: true,
    },
  },
};

/** Retorna a configuração funcional de um plano pelo id. */
export function getPlano(planoId) {
  return PLANOS[planoId] ?? PLANOS.starter;
}

/** Verifica se um recurso está disponível em um plano. */
export function recursoDisponivel(planoId, recurso) {
  return getPlano(planoId).recursos[recurso] ?? false;
}

/** Retorna o limite de um plano. -1 significa ilimitado. */
export function getLimite(planoId, limite) {
  return getPlano(planoId).limites[limite] ?? 0;
}
