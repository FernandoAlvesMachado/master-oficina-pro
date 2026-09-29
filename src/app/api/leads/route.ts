import { NextRequest, NextResponse } from "next/server";
import { query, ensureTablesExist } from "@/lib/db";
import { verifyRequestAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (!(await verifyRequestAuth(req))) {
    return NextResponse.json({ success: false, error: "Acesso não autorizado." }, { status: 401 });
  }

  try {
    await ensureTablesExist();
    const leads = await query(`
      SELECT id, tenant_id, name, workshop_name, email, phone, status, origin, notes, created_at
      FROM leads
      ORDER BY created_at DESC
      LIMIT 100
    `);
    return NextResponse.json({ success: true, leads });
  } catch (err: any) {
    console.error("Erro ao buscar leads no PostgreSQL:", err);
    return NextResponse.json({ success: true, leads: [] });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await verifyRequestAuth(req))) {
    return NextResponse.json({ success: false, error: "Acesso não autorizado." }, { status: 401 });
  }

  try {
    const { leadId, status } = await req.json();
    await query(`UPDATE leads SET status = $1 WHERE id = $2`, [status, leadId]);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Erro ao atualizar status do lead:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
