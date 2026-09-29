import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    const configuredPassword = process.env.MASTER_ADMIN_PASSWORD || "admin";

    if (password === configuredPassword) {
      const response = NextResponse.json({ success: true, message: "Acesso autorizado ao Master Admin" });
      
      // Cookie de autenticação simples para proteger o painel
      response.cookies.set("kvns_master_auth", "authorized", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 dias
        path: "/",
      });

      return response;
    }

    return NextResponse.json({ success: false, error: "Senha incorreta do Master Admin" }, { status: 401 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const authCookie = req.cookies.get("kvns_master_auth");
  const isAuthenticated = authCookie?.value === "authorized";
  const hasPasswordConfigured = Boolean(process.env.MASTER_ADMIN_PASSWORD);

  return NextResponse.json({
    authenticated: isAuthenticated,
    hasPasswordConfigured,
  });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: "Sessão encerrada" });
  response.cookies.delete("kvns_master_auth");
  return response;
}
