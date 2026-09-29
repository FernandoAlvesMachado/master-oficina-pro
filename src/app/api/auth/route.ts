import { NextRequest, NextResponse } from "next/server";
import { createSessionToken, verifyRequestAuth, COOKIE_NAME } from "@/lib/auth";

// Rate limiting simples em memória para prevenir ataques de força bruta
interface RateLimitEntry {
  attempts: number;
  blockedUntil: number;
}
const loginAttempts = new Map<string, RateLimitEntry>();

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  return forwarded?.split(",")[0].trim() || realIp || "unknown-ip";
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const now = Date.now();
    const entry = loginAttempts.get(ip) || { attempts: 0, blockedUntil: 0 };

    // Verifica se IP está temporariamente bloqueado
    if (entry.blockedUntil > now) {
      const waitMinutes = Math.ceil((entry.blockedUntil - now) / 60000);
      return NextResponse.json(
        {
          success: false,
          error: `Muitas tentativas incorretas. Bloqueio de segurança temporário. Tente novamente em ${waitMinutes} minuto(s).`,
        },
        { status: 429 }
      );
    }

    const { password } = await req.json();
    const configuredPassword = process.env.MASTER_ADMIN_PASSWORD || "admin";

    if (password === configuredPassword) {
      // Sucesso: reseta tentativas
      loginAttempts.delete(ip);

      const sessionToken = await createSessionToken();
      const response = NextResponse.json({
        success: true,
        message: "Acesso autorizado ao Master Admin",
      });

      // Cookie criptografado, HTTP-only e com SameSite Strict
      response.cookies.set(COOKIE_NAME, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 60 * 60 * 24, // 24 horas
        path: "/",
      });

      return response;
    }

    // Falha: incrementa contador de tentativas
    entry.attempts += 1;
    if (entry.attempts >= 5) {
      entry.blockedUntil = now + 15 * 60 * 1000; // Bloqueio de 15 minutos
      loginAttempts.set(ip, entry);
      return NextResponse.json(
        {
          success: false,
          error: "Limite de tentativas excedido. Bloqueado por 15 minutos por segurança.",
        },
        { status: 429 }
      );
    }

    loginAttempts.set(ip, entry);
    const remaining = 5 - entry.attempts;
    return NextResponse.json(
      {
        success: false,
        error: `Senha incorreta. Restam ${remaining} tentativa(s) antes do bloqueio temporário.`,
      },
      { status: 401 }
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const isAuth = await verifyRequestAuth(req);
  return NextResponse.json({
    authenticated: isAuth,
  });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: "Sessão encerrada com segurança" });
  response.cookies.delete(COOKIE_NAME);
  return response;
}
