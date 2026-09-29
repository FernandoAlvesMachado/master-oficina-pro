import { NextRequest, NextResponse } from "next/server";
import { isDbConfigured, query, ensureTablesExist } from "@/lib/db";
import { verifyRequestAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  // Verificação defensiva de autenticação
  if (!(await verifyRequestAuth(req))) {
    return NextResponse.json({ success: false, error: "Acesso não autorizado." }, { status: 401 });
  }

  const configured = isDbConfigured();

  if (!configured) {
    return NextResponse.json({
      connected: false,
      configured: false,
      message: "Banco de dados não configurado nas variáveis de ambiente do servidor.",
    });
  }

  try {
    const start = Date.now();
    await query("SELECT 1;");
    const latencyMs = Date.now() - start;

    // Checar apenas presença das tabelas essenciais (sem expor detalhes de infraestrutura)
    const tablesRes = await query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`
    );
    const tableNames = tablesRes.map((r) => r.table_name);

    return NextResponse.json({
      connected: true,
      configured: true,
      latencyMs,
      existingTables: tableNames,
      requiredTablesPresent: ["tenants", "users", "tenant_store"].every((t) =>
        tableNames.includes(t)
      ),
    });
  } catch (err: any) {
    return NextResponse.json({
      connected: false,
      configured: true,
      error: "Falha na conexão com o banco de dados.",
      message: "Verifique as variáveis de ambiente e liberação de conexões na Vercel / Neon.",
    });
  }
}

export async function POST(req: NextRequest) {
  if (!(await verifyRequestAuth(req))) {
    return NextResponse.json({ success: false, error: "Acesso não autorizado." }, { status: 401 });
  }

  try {
    const res = await ensureTablesExist();
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
