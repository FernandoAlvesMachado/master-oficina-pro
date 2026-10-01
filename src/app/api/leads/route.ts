import { NextRequest, NextResponse } from "next/server";
import { query, ensureTablesExist } from "@/lib/db";
import { verifyRequestAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function setCorsHeaders(res: NextResponse): NextResponse {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-requested-with");
  return res;
}

export async function OPTIONS() {
  return setCorsHeaders(new NextResponse(null, { status: 204 }));
}

/**
 * GET /api/leads
 * Retorna todos os leads cadastrados, ordenando pendentes primeiro
 */
export async function GET(req: NextRequest) {
  if (!(await verifyRequestAuth(req))) {
    return setCorsHeaders(
      NextResponse.json({ success: false, error: "Acesso não autorizado." }, { status: 401 })
    );
  }

  try {
    await ensureTablesExist();
    const leads = await query(`
      SELECT id, tenant_id, name, workshop_name, email, phone, status, origin, notes, created_at
      FROM leads
      ORDER BY 
        CASE 
          WHEN status IN ('PENDING_APPROVAL', 'NEW', 'PENDING') THEN 0
          WHEN status IN ('APPROVED', 'CONVERTED') THEN 1
          ELSE 2 
        END,
        created_at DESC
      LIMIT 200
    `);
    return setCorsHeaders(NextResponse.json({ success: true, leads }));
  } catch (err: any) {
    console.error("Erro ao buscar leads no PostgreSQL:", err);
    return setCorsHeaders(NextResponse.json({ success: true, leads: [] }));
  }
}

/**
 * POST /api/leads
 * Endpoint PÚBLICO para receber formulários da Landing Page (Solicitação de Teste de 14 Dias)
 * O cliente NÃO define senha aqui. A senha será gerada e o acesso liberado pelo Master Admin!
 */
export async function POST(req: NextRequest) {
  try {
    await ensureTablesExist();
    const body = await req.json();
    const {
      name,
      workshopName,
      workshop_name,
      email,
      phone,
      origin = "landing_page_trial",
      notes,
    } = body;

    const leadName = (name || "").trim();
    const finalWorkshopName = (workshopName || workshop_name || "").trim();
    const leadEmail = (email || "").trim().toLowerCase();
    const leadPhone = (phone || "").trim();

    if (!leadName && !finalWorkshopName) {
      return setCorsHeaders(
        NextResponse.json(
          { success: false, error: "Nome ou nome da oficina é obrigatório." },
          { status: 400 }
        )
      );
    }

    const leadId = `lead-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const finalNotes =
      notes ||
      `Solicitação de Teste de 14 Dias sem senha pré-definida. Aguardando aprovação e geração de credenciais pelo Master Admin.`;

    await query(
      `INSERT INTO leads (id, name, workshop_name, email, phone, status, origin, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, 'PENDING_APPROVAL', $6, $7, NOW())`,
      [leadId, leadName || finalWorkshopName, finalWorkshopName || leadName, leadEmail, leadPhone, origin, finalNotes]
    );

    return setCorsHeaders(
      NextResponse.json({
        success: true,
        leadId,
        status: "PENDING_APPROVAL",
        message:
          "Solicitação de teste recebida com sucesso! Seu acesso está sendo preparado e será liberado pela nossa equipe.",
      })
    );
  } catch (err: any) {
    console.error("Erro ao registrar solicitação de lead:", err);
    return setCorsHeaders(
      NextResponse.json({ success: false, error: err.message }, { status: 500 })
    );
  }
}

/**
 * PATCH /api/leads
 * Atualiza status (ex: PENDING_APPROVAL, APPROVED, REJECTED)
 */
export async function PATCH(req: NextRequest) {
  if (!(await verifyRequestAuth(req))) {
    return setCorsHeaders(
      NextResponse.json({ success: false, error: "Acesso não autorizado." }, { status: 401 })
    );
  }

  try {
    const { leadId, status, tenantId } = await req.json();
    if (!leadId || !status) {
      return setCorsHeaders(
        NextResponse.json({ success: false, error: "leadId e status são obrigatórios." }, { status: 400 })
      );
    }

    if (tenantId) {
      await query(`UPDATE leads SET status = $1, tenant_id = $2 WHERE id = $3`, [status, tenantId, leadId]);
    } else {
      await query(`UPDATE leads SET status = $1 WHERE id = $2`, [status, leadId]);
    }

    return setCorsHeaders(NextResponse.json({ success: true }));
  } catch (err: any) {
    console.error("Erro ao atualizar status do lead:", err);
    return setCorsHeaders(
      NextResponse.json({ success: false, error: err.message }, { status: 500 })
    );
  }
}

/**
 * DELETE /api/leads
 * Remove um lead descartado
 */
export async function DELETE(req: NextRequest) {
  if (!(await verifyRequestAuth(req))) {
    return setCorsHeaders(
      NextResponse.json({ success: false, error: "Acesso não autorizado." }, { status: 401 })
    );
  }

  try {
    const { leadId } = await req.json();
    if (!leadId) {
      return setCorsHeaders(
        NextResponse.json({ success: false, error: "leadId é obrigatório." }, { status: 400 })
      );
    }
    await query(`DELETE FROM leads WHERE id = $1`, [leadId]);
    return setCorsHeaders(NextResponse.json({ success: true }));
  } catch (err: any) {
    return setCorsHeaders(
      NextResponse.json({ success: false, error: err.message }, { status: 500 })
    );
  }
}
