import { NextRequest, NextResponse } from "next/server";
import { query, ensureTablesExist } from "@/lib/db";
import { verifyRequestAuth } from "@/lib/auth";
import crypto from "crypto";
import { cleanText, isValidEmail, LEAD_STATUSES, publicError } from "@/lib/validation";

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
    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > 20_000) {
      return setCorsHeaders(NextResponse.json({ success: false, error: "Solicitação muito grande." }, { status: 413 }));
    }
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

    const leadName = cleanText(name, 255);
    const finalWorkshopName = cleanText(workshopName || workshop_name, 255);
    const leadEmail = cleanText(email, 254).toLowerCase();
    const leadPhone = cleanText(phone, 50);
    const leadOrigin = cleanText(origin, 100) || "landing_page_trial";

    if (!leadName || !finalWorkshopName) {
      return setCorsHeaders(
        NextResponse.json(
          { success: false, error: "Nome e nome da oficina são obrigatórios." },
          { status: 400 }
        )
      );
    }
    if (!leadEmail || !isValidEmail(leadEmail)) {
      return setCorsHeaders(NextResponse.json({ success: false, error: "E-mail válido é obrigatório." }, { status: 400 }));
    }
    if (!leadPhone) {
      return setCorsHeaders(NextResponse.json({ success: false, error: "Telefone/WhatsApp é obrigatório." }, { status: 400 }));
    }

    const leadId = `lead-${crypto.randomUUID()}`;
    const finalNotes =
      cleanText(notes, 2000) ||
      `Solicitação de Teste de 14 Dias sem senha pré-definida. Aguardando aprovação e geração de credenciais pelo Master Admin.`;

    await query(
      `INSERT INTO leads (id, name, workshop_name, email, phone, status, origin, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, 'PENDING_APPROVAL', $6, $7, NOW())`,
      [leadId, leadName, finalWorkshopName, leadEmail, leadPhone, leadOrigin, finalNotes]
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
      NextResponse.json({ success: false, error: publicError(err) }, { status: 500 })
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
    if (!LEAD_STATUSES.includes(status)) {
      return setCorsHeaders(NextResponse.json({ success: false, error: "Status do lead inválido." }, { status: 400 }));
    }

    if (tenantId) {
      const updated = await query(`UPDATE leads SET status = $1, tenant_id = $2 WHERE id = $3 RETURNING id`, [status, tenantId, leadId]);
      if (!updated.length) return setCorsHeaders(NextResponse.json({ success: false, error: "Lead não encontrado." }, { status: 404 }));
    } else {
      const updated = await query(`UPDATE leads SET status = $1 WHERE id = $2 RETURNING id`, [status, leadId]);
      if (!updated.length) return setCorsHeaders(NextResponse.json({ success: false, error: "Lead não encontrado." }, { status: 404 }));
    }

    return setCorsHeaders(NextResponse.json({ success: true }));
  } catch (err: any) {
    console.error("Erro ao atualizar status do lead:", err);
    return setCorsHeaders(
      NextResponse.json({ success: false, error: publicError(err) }, { status: 500 })
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
    const deleted = await query(`DELETE FROM leads WHERE id = $1 RETURNING id`, [leadId]);
    if (!deleted.length) return setCorsHeaders(NextResponse.json({ success: false, error: "Lead não encontrado." }, { status: 404 }));
    return setCorsHeaders(NextResponse.json({ success: true }));
  } catch (err: any) {
    return setCorsHeaders(
      NextResponse.json({ success: false, error: publicError(err) }, { status: 500 })
    );
  }
}
