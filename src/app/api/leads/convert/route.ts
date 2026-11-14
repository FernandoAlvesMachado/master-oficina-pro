import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { ensureTablesOnce, withTransaction } from "@/lib/db";
import { verifyRequestAuth } from "@/lib/auth";
import { cleanText, isValidEmail, publicError } from "@/lib/validation";
import { isMaterialFlowLead } from "@/lib/leads";

export const dynamic = "force-dynamic";
export const revalidate = 0;

class ConvertError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/**
 * POST /api/leads/convert  { leadId }
 * Converte um lead de material gratuito (tenant_id NULL) em solicitação de teste grátis,
 * criando os mesmos registros que a landing cria no fluxo de teste:
 *   - tenants: status PENDING, plan ESSENCIAL (a migração do painel já converte TRIAL em ESSENCIAL)
 *   - users: is_active = false, password_hash 'PENDING_APPROVAL'
 *   - tenant_store
 * Depois vincula o lead (tenant_id) e muda o status para 'PENDING'. A origin é mantida.
 * A partir daí o lead segue o fluxo normal de aprovação do teste.
 */
export async function POST(req: NextRequest) {
  if (!(await verifyRequestAuth(req))) {
    return NextResponse.json({ success: false, error: "Acesso não autorizado." }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const leadId = cleanText(body?.leadId, 64);
    if (!leadId) {
      return NextResponse.json({ success: false, error: "leadId é obrigatório." }, { status: 400 });
    }

    await ensureTablesOnce();

    const result = await withTransaction(async (client) => {
      const leadRes = await client.query(
        `SELECT id, tenant_id, name, workshop_name, email, phone, origin, status
         FROM leads WHERE id = $1 FOR UPDATE`,
        [leadId]
      );
      const lead = leadRes.rows[0];
      if (!lead) throw new ConvertError("Lead não encontrado.", 404);
      if (lead.tenant_id) throw new ConvertError("Este lead já está vinculado a uma oficina.", 409);
      if (!isMaterialFlowLead(lead)) {
        throw new ConvertError("Apenas leads de material gratuito podem ser convertidos por aqui.", 400);
      }

      const email = cleanText(lead.email, 254).toLowerCase();
      if (!isValidEmail(email)) throw new ConvertError("O lead não tem um e-mail válido.", 400);
      const ownerName = cleanText(lead.name, 255) || "Proprietário";
      const workshopName = cleanText(lead.workshop_name, 255) || ownerName;
      const phone = cleanText(lead.phone, 50);

      // Bloqueia concorrência entre duas conversões/aprovações do mesmo e-mail nesta transação.
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`lead-email:${email}`]);

      const existingUser = await client.query(
        `SELECT u.id, t.name AS tenant_name
         FROM users u LEFT JOIN tenants t ON t.id = u.tenant_id
         WHERE LOWER(u.email) = $1 LIMIT 1`,
        [email]
      );
      if (existingUser.rowCount) {
        const where = existingUser.rows[0].tenant_name ? ` (oficina "${existingUser.rows[0].tenant_name}")` : "";
        throw new ConvertError(`Já existe um usuário com o e-mail ${email}${where}.`, 409);
      }
      const existingTenant = await client.query(
        `SELECT id, name FROM tenants WHERE LOWER(email) = $1 LIMIT 1`,
        [email]
      );
      if (existingTenant.rowCount) {
        throw new ConvertError(`Já existe uma oficina cadastrada com o e-mail ${email} ("${existingTenant.rows[0].name}").`, 409);
      }

      // Mesmo formato da landing (src/app/api/lead/route.ts): ids `<prefixo>-<ts>-<rnd>` com o mesmo rnd,
      // todos os módulos liberados e o mesmo company_settings no tenant e no tenant_store.
      const ts = Date.now();
      const rnd = crypto.randomBytes(8).toString("base64url").replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 5).padEnd(5, "0");
      const tenantId = `tenant-${ts}-${rnd}`;
      const userId = `usr-${ts}-${rnd}`;
      const enabledFeatures = {
        ordens_servico: true,
        checklist_fotos: true,
        estoque_pecas: true,
        pdv_balcao: true,
        financeiro: true,
        whatsapp_crm: true,
        relatorios: true,
      };
      const settings = {
        name: workshopName,
        tradeName: workshopName,
        slogan: "Centro Automotivo Especializado",
        phone,
        email,
        primaryColor: "#C7F34A",
        secondaryColor: "#141A1F",
        themeMode: "light",
        userName: ownerName,
        userRole: "Administrador / Proprietário",
      };

      await client.query(
        `INSERT INTO tenants (id, name, owner_name, email, phone, plan, status, trial_until, expires_at, enabled_features, company_settings)
         VALUES ($1, $2, $3, $4, $5, 'ESSENCIAL', 'PENDING', NULL, NULL, $6, $7)`,
        [tenantId, workshopName, ownerName, email, phone, JSON.stringify(enabledFeatures), JSON.stringify(settings)]
      );
      await client.query(
        `INSERT INTO users (id, tenant_id, name, email, password_hash, phone, role, is_active)
         VALUES ($1, $2, $3, $4, 'PENDING_APPROVAL', $5, 'ADMIN', false)`,
        [userId, tenantId, ownerName, email, phone]
      );
      await client.query(
        `INSERT INTO tenant_store (tenant_id, company_settings)
         VALUES ($1, $2) ON CONFLICT (tenant_id) DO NOTHING`,
        [tenantId, JSON.stringify(settings)]
      );
      await client.query(
        `UPDATE leads SET tenant_id = $1, status = 'PENDING' WHERE id = $2`,
        [tenantId, leadId]
      );

      return { tenantId };
    });

    return NextResponse.json({ success: true, tenantId: result.tenantId, status: "PENDING" });
  } catch (err: any) {
    if (err instanceof ConvertError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    if (err?.code === "23505") {
      return NextResponse.json(
        { success: false, error: "Já existe uma oficina ou usuário com este e-mail." },
        { status: 409 }
      );
    }
    console.error("Erro ao converter lead em teste grátis:", err);
    return NextResponse.json({ success: false, error: publicError(err) }, { status: 500 });
  }
}
