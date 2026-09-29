import { NextRequest, NextResponse } from "next/server";
import { isDbConfigured, query, ensureTablesExist, getEnvDiagnostics } from "@/lib/db";
import { verifyRequestAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  if (!(await verifyRequestAuth(req))) {
    return NextResponse.json({ success: false, error: "Acesso não autorizado." }, { status: 401 });
  }

  const configured = isDbConfigured();
  const envDiag = getEnvDiagnostics();

  if (!configured) {
    return NextResponse.json({
      connected: false,
      configured: false,
      envDiagnostics: envDiag,
      message: "Nenhuma variável de ambiente de banco de dados foi encontrada pelo servidor da Vercel.",
      tip: "Verifique se a variável POSTGRES_URL ou DATABASE_URL foi adicionada para o ambiente 'Production' e execute um 'Redeploy' no painel da Vercel.",
    });
  }

  try {
    const start = Date.now();
    await query("SELECT 1;");
    const latencyMs = Date.now() - start;

    const tablesRes = await query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`
    );
    const tableNames = tablesRes.map((r) => r.table_name);

    return NextResponse.json({
      connected: true,
      configured: true,
      latencyMs,
      existingTables: tableNames,
      envDiagnostics: envDiag,
      requiredTablesPresent: ["tenants", "users", "tenant_store"].every((t) =>
        tableNames.includes(t)
      ),
    });
  } catch (err: any) {
    return NextResponse.json({
      connected: false,
      configured: true,
      error: err.message || "Falha na conexão com o banco de dados.",
      envDiagnostics: envDiag,
      message: "Falha ao conectar no PostgreSQL. Verifique se a string de conexão está correta e com sslmode=require.",
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
