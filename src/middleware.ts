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
    if (pathname.startsWith("/api/")) {
      res.headers.set("Cache-Control", "no-store, max-age=0");
    }
    const devEval = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
    res.headers.set("Content-Security-Policy", `default-src 'self'; img-src 'self' data: blob: https:; font-src 'self' https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'unsafe-inline'${devEval}; connect-src 'self'`);
    if (process.env.NODE_ENV === "production") {
      res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    return res;
  };

  // Bloqueia CSRF em operações que alteram dados. Chamadas internas sem Origin (server-to-server) continuam válidas.
  if (["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) {
    const origin = req.headers.get("origin");
    const requestHosts = new Set([
      req.nextUrl.host,
      req.headers.get("host") || "",
      (req.headers.get("x-forwarded-host") || "").split(",")[0].trim(),
    ].filter(Boolean));
    let originAllowed = true;
    if (origin) {
      try {
        originAllowed = requestHosts.has(new URL(origin).host);
      } catch {
        originAllowed = false;
      }
    }
    if (!originAllowed) {
      return applySecurityHeaders(
        NextResponse.json({ success: false, error: "Origem da requisição não autorizada." }, { status: 403 })
      );
    }
  }

  // Permite rota de login (/api/auth via POST), envio de leads da landing page (/api/leads via POST) e requisições OPTIONS (CORS)
  if (
    (pathname === "/api/auth" && req.method === "POST") ||
    (pathname === "/api/leads" && req.method === "POST") ||
    (pathname === "/api/stripe/webhook" && req.method === "POST") ||
    (pathname === "/api/billing/client" && req.method === "GET") ||
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
