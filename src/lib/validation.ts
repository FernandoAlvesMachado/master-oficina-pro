export const TENANT_STATUSES = ["TRIAL", "ACTIVE", "BLOCKED", "EXPIRED"] as const;
export const LEAD_STATUSES = [
  "NEW",
  "PENDING",
  "PENDING_APPROVAL",
  "APPROVED",
  "CONVERTED",
  "REJECTED",
] as const;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function integerInRange(value: unknown, min: number, max: number): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export function publicError(error: unknown, fallback = "Não foi possível concluir a operação.") {
  if (process.env.NODE_ENV !== "production" && error instanceof Error) return error.message;
  return fallback;
}
