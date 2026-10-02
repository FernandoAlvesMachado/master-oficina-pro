import { NextRequest } from "next/server";

export const COOKIE_NAME = "giravo_master_auth_token";
export const LEGACY_COOKIE_NAME = "kvns_master_auth_token";
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24 horas

function getSecretString(): string {
  const secret = process.env.AUTH_SECRET || process.env.MASTER_ADMIN_PASSWORD;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET ou MASTER_ADMIN_PASSWORD precisa estar configurado.");
  }
  return secret || "development-only-secret-change-me";
}

function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Cria assinatura HMAC-SHA256 usando Web Crypto API
async function signMessage(message: string, secretStr: string): Promise<string> {
  const secretBytes = stringToUint8Array(secretStr);
  const messageBytes = stringToUint8Array(message);

  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes as any,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, messageBytes as any);
  return bufferToHex(signature);
}

// Gera token criptográfico com timestamp e assinatura HMAC
export async function createSessionToken(): Promise<string> {
  const timestamp = Date.now().toString();
  const secret = getSecretString();
  const signature = await signMessage(timestamp, secret);
  return `${timestamp}.${signature}`;
}

// Valida token com timing safety e expiração
export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token || !token.includes(".")) {
    return false;
  }

  const [timestampStr, signature] = token.split(".");
  const timestamp = parseInt(timestampStr, 10);

  if (isNaN(timestamp)) {
    return false;
  }

  // Verifica expiração (24 horas) e previne tokens do futuro
  const now = Date.now();
  if (now - timestamp > SESSION_MAX_AGE_MS || now < timestamp - 60000) {
    return false;
  }

  const secret = getSecretString();
  const expectedSignature = await signMessage(timestampStr, secret);

  if (signature.length !== expectedSignature.length) {
    return false;
  }

  // Comparação em tempo constante
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  return result === 0;
}

export async function verifyRequestAuth(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(COOKIE_NAME)?.value || req.cookies.get(LEGACY_COOKIE_NAME)?.value;
  return verifySessionToken(token);
}
