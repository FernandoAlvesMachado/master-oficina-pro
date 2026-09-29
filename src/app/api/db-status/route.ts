import { NextResponse } from "next/server";
import { isDbConfigured, query, ensureTablesExist } from "@/lib/db";

export async function GET() {
  const configured = isDbConfigured();

  if (!configured) {
    return NextResponse.json({
      connected: false,
      configured: false,
      message: "POSTGRES_URL não configurada no arquivo .env.local",
      tip: "Abra o .env.local e cole a URL do seu PostgreSQL da Vercel/Neon",
    });
  }

  try {
    const start = Date.now();
    const result = await query<{ now: string; version: string }>(
      "SELECT NOW() as now, version() as version;"
    );
    const latencyMs = Date.now() - start;

    // Checar tabelas existentes
    const tablesRes = await query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`
    );
    const tableNames = tablesRes.map((r) => r.table_name);

    return NextResponse.json({
      connected: true,
      configured: true,
      latencyMs,
      serverTime: result[0]?.now,
      databaseVersion: result[0]?.version?.split(" ")?.[0] || "PostgreSQL",
      existingTables: tableNames,
      requiredTablesPresent: ["tenants", "users", "tenant_store"].every((t) =>
        tableNames.includes(t)
      ),
    });
  } catch (err: any) {
    return NextResponse.json({
      connected: false,
      configured: true,
      error: err.message,
      message: "Falha ao conectar no PostgreSQL. Verifique credenciais ou liberação de IP/SSL.",
    });
  }
}

export async function POST() {
  try {
    const res = await ensureTablesExist();
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
