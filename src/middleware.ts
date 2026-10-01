import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, COOKIE_NAME, LEGACY_COOKIE_NAME } from "./lib/auth";

// Segurança Global: Intercepta e protege todas as APIs e rotas sensíveis
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Injeta cabeçalhos de segurança HTTP em todas as respostas
  const applySecurityHeaders = (res: NextResponse) => {
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("X-XSS-Protection", "1; mode=block");
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    return res;
  };

  // Permite rota de login (/api/auth via POST), envio de leads da landing page (/api/leads via POST) e requisições OPTIONS (CORS)
  if (
    (pathname === "/api/auth" && req.method === "POST") ||
    (pathname === "/api/leads" && req.method === "POST") ||
    req.method === "OPTIONS"
  ) {
    return applySecurityHeaders(NextResponse.next());
  }

  // Verifica proteção para todas as rotas da API
  if (pathname.startsWith("/api/")) {
    const token = req.cookies.get(COOKIE_NAME)?.value || req.cookies.get(LEGACY_COOKIE_NAME)?.value;
    const isValid = await verifySessionToken(token);

    if (!isValid) {
      return applySecurityHeaders(
        NextResponse.json(
          {
            success: false,
            error: "ACESSO_NEGADO: Sessão não autorizada ou expirada. Faça login com a senha mestre.",
          },
          { status: 401 }
        )
      );
    }
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    /*
     * Intercepta todas as rotas da API
     */
    "/api/:path*",
  ],
};
