// Regras compartilhadas (cliente e servidor) para os leads captados pela landing page.
// Não importe nada de servidor aqui: este arquivo também é usado pelo painel no navegador.

export const TRIAL_ORIGIN = "landing_page_trial";
export const MATERIAL_ORIGIN_PREFIX = "material_";

export const MATERIAL_ORIGINS = {
  material_calculadora_hora: {
    label: "Calculadora da hora de mão de obra",
    short: "Calculadora",
    // Complemento usado na mensagem de WhatsApp: "Vi que você <action>..."
    action: "usou a nossa Calculadora da hora de mão de obra",
  },
  material_modelo_os: {
    label: "Modelo de ordem de serviço (PDF)",
    short: "Modelo de OS",
    action: "baixou o nosso Modelo de ordem de serviço (PDF)",
  },
  material_checklist_entrada: {
    label: "Checklist de entrada de veículo (PDF)",
    short: "Checklist",
    action: "baixou o nosso Checklist de entrada de veículo (PDF)",
  },
} as const;

export type MaterialOrigin = keyof typeof MATERIAL_ORIGINS;

export const ORIGIN_FILTERS = [
  { id: "ALL", label: "Todos" },
  { id: "TRIAL", label: "Teste grátis" },
  { id: "material_calculadora_hora", label: "Calculadora" },
  { id: "material_modelo_os", label: "Modelo de OS" },
  { id: "material_checklist_entrada", label: "Checklist" },
] as const;

export type OriginFilter = (typeof ORIGIN_FILTERS)[number]["id"];

// Fluxo de status dos leads de material: NEW -> CONTACTED -> CONVERTED | DISCARDED
export const MATERIAL_LEAD_STATUSES = ["NEW", "CONTACTED", "CONVERTED", "DISCARDED"] as const;
export type MaterialLeadStatus = (typeof MATERIAL_LEAD_STATUSES)[number];

export interface LeadLike {
  tenant_id?: string | null;
  origin?: string | null;
  status?: string | null;
}

export interface LeadRecord extends LeadLike {
  id: string;
  name: string;
  workshop_name: string;
  email: string;
  phone: string;
  status: string;
  origin: string;
  notes?: string | null;
  created_at: string;
}

export interface MaterialLeadStat {
  origin: string;
  last7: number;
  last30: number;
}

export function isMaterialOrigin(origin?: string | null): boolean {
  return Boolean(origin && origin.startsWith(MATERIAL_ORIGIN_PREFIX));
}

/**
 * Lead de material ainda sem conta: segue o fluxo NEW/CONTACTED/CONVERTED/DISCARDED e
 * não pode usar ações que dependem de tenant (aprovar teste, gerar senha, ativar tenant).
 * Depois de "Converter em teste grátis" ele ganha tenant_id e passa a seguir o fluxo de teste.
 */
export function isMaterialFlowLead(lead: LeadLike): boolean {
  return isMaterialOrigin(lead.origin) && !lead.tenant_id;
}

export function getOriginLabel(origin?: string | null): string {
  if (!origin) return "Origem não informada";
  if (origin === TRIAL_ORIGIN) return "Teste grátis";
  const material = MATERIAL_ORIGINS[origin as MaterialOrigin];
  return material ? material.label : origin;
}

export function matchesOriginFilter(lead: LeadLike, filter: OriginFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "TRIAL") return !isMaterialOrigin(lead.origin);
  return lead.origin === filter;
}

// Chave de status usada para filtros e selos. Leads de teste mantêm o agrupamento antigo
// (NEW/PENDING/PENDING_APPROVAL = aguardando aprovação; APPROVED/CONVERTED = aprovado).
export type LeadStatusKey =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "NEW"
  | "CONTACTED"
  | "CONVERTED"
  | "DISCARDED"
  | "OTHER";

export function getLeadStatusKey(lead: LeadLike): LeadStatusKey {
  const st = lead.status || "";
  if (isMaterialFlowLead(lead)) {
    if (!st) return "NEW";
    return (MATERIAL_LEAD_STATUSES as readonly string[]).includes(st) ? (st as LeadStatusKey) : "OTHER";
  }
  if (!st || st === "PENDING_APPROVAL" || st === "NEW" || st === "PENDING") return "PENDING";
  if (st === "APPROVED" || st === "CONVERTED") return "APPROVED";
  if (st === "REJECTED") return "REJECTED";
  return "OTHER";
}

export const STATUS_FILTERS: { id: "ALL" | LeadStatusKey; label: string }[] = [
  { id: "ALL", label: "Todos os status" },
  { id: "PENDING", label: "Teste: aguardando aprovação" },
  { id: "APPROVED", label: "Teste: aprovado" },
  { id: "REJECTED", label: "Teste: recusado" },
  { id: "NEW", label: "Material: novo" },
  { id: "CONTACTED", label: "Material: contatado" },
  { id: "CONVERTED", label: "Material: convertido" },
  { id: "DISCARDED", label: "Material: descartado" },
];

export const STATUS_LABELS: Record<LeadStatusKey, string> = {
  PENDING: "Aguarda aprovação",
  APPROVED: "Aprovado",
  REJECTED: "Recusado",
  NEW: "Novo",
  CONTACTED: "Contatado",
  CONVERTED: "Convertido",
  DISCARDED: "Descartado",
  OTHER: "Outro",
};

export function onlyDigits(value?: string | null): string {
  return (value || "").replace(/\D/g, "");
}

// "(67) 99999-0000" -> "5567999990000". Não duplica o 55 se o número já vier com DDI.
export function whatsappNumber(phone?: string | null): string {
  const digits = onlyDigits(phone);
  if (!digits) return "";
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;
  return `55${digits}`;
}

export function materialWhatsAppMessage(lead: { name?: string | null; origin?: string | null }): string {
  const firstName = (lead.name || "").trim().split(/\s+/)[0] || "tudo bem";
  const material = MATERIAL_ORIGINS[lead.origin as MaterialOrigin];
  const action = material ? material.action : "baixou um material gratuito";
  return (
    `Olá, ${firstName}! Aqui é da GIRAVO. ` +
    `Vi que você ${action} no nosso site. ` +
    `Conseguiu aproveitar? Se quiser, te mostro como o GIRAVO organiza isso direto no sistema da oficina.`
  );
}

export function trialWhatsAppMessage(lead: { name?: string | null }): string {
  const firstName = (lead.name || "").trim().split(/\s+/)[0] || "tudo bem";
  return `Olá, ${firstName}! Aqui é da GIRAVO. Recebemos sua solicitação de teste grátis do sistema e já estamos preparando seu acesso.`;
}

export function leadWhatsAppMessage(lead: { name?: string | null; origin?: string | null }): string {
  return isMaterialOrigin(lead.origin) ? materialWhatsAppMessage(lead) : trialWhatsAppMessage(lead);
}

export function whatsappLink(phone: string | null | undefined, message?: string): string {
  const number = whatsappNumber(phone);
  if (!number) return "";
  return `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

export function mailtoLink(email: string | null | undefined, subject?: string): string {
  const clean = (email || "").trim();
  if (!clean) return "";
  return `mailto:${encodeURIComponent(clean).replace(/%40/g, "@")}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
}
