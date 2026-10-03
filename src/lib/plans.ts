export const PLAN_CATALOG = {
  ESSENCIAL: {
    key: "ESSENCIAL",
    name: "Essencial",
    priceCents: 8990,
    maxUsers: 1,
    description: "Para o proprietário organizar a rotina da oficina.",
    features: {
      ordens_servico: true,
      checklist_fotos: true,
      estoque_pecas: false,
      pdv_balcao: false,
      financeiro: false,
      whatsapp_crm: false,
      relatorios: false,
    },
  },
  PROFISSIONAL: {
    key: "PROFISSIONAL",
    name: "Profissional",
    priceCents: 14990,
    maxUsers: 3,
    description: "Operação completa para equipes em crescimento.",
    features: {
      ordens_servico: true,
      checklist_fotos: true,
      estoque_pecas: true,
      pdv_balcao: true,
      financeiro: true,
      whatsapp_crm: false,
      relatorios: true,
    },
  },
  PREMIUM: {
    key: "PREMIUM",
    name: "Premium",
    priceCents: 24990,
    maxUsers: 10,
    description: "Todos os recursos e mais acessos para alta performance.",
    features: {
      ordens_servico: true,
      checklist_fotos: true,
      estoque_pecas: true,
      pdv_balcao: true,
      financeiro: true,
      whatsapp_crm: true,
      relatorios: true,
    },
  },
} as const;

export type PlanKey = keyof typeof PLAN_CATALOG;

export function normalizePlan(value: unknown): PlanKey | null {
  const key = String(value || "").toUpperCase();
  if (key === "PRO") return "PROFISSIONAL";
  return key in PLAN_CATALOG ? key as PlanKey : null;
}

export function stripePriceForPlan(plan: PlanKey) {
  return {
    ESSENCIAL: process.env.STRIPE_PRICE_ESSENCIAL,
    PROFISSIONAL: process.env.STRIPE_PRICE_PROFISSIONAL,
    PREMIUM: process.env.STRIPE_PRICE_PREMIUM,
  }[plan];
}
