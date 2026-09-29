import { NextRequest, NextResponse } from "next/server";
import { query, hashPassword, ensureTablesExist } from "@/lib/db";
import { verifyRequestAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: Listar todos os clientes, métricas e status de vencimento
export async function GET(req: NextRequest) {
  if (!(await verifyRequestAuth(req))) {
    return NextResponse.json(
      { success: false, error: "Acesso não autorizado. Autenticação obrigatória." },
      { status: 401 }
    );
  }

  try {
    await ensureTablesExist();

    const tenants = await query(`
      SELECT 
        t.id,
        t.name,
        t.owner_name,
        t.email,
        t.phone,
        t.plan,
        t.status,
        t.trial_until,
        t.expires_at,
        t.enabled_features,
        t.company_settings,
        t.created_at,
        COUNT(u.id)::int as users_count,
        MAX(u.last_login_at) as last_login_at
      FROM tenants t
      LEFT JOIN users u ON t.id = u.tenant_id
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `);

    const now = new Date();
    const metrics = {
      total: tenants.length,
      active: tenants.filter(
        (t: any) =>
          (t.status === "ACTIVE" || t.status === "TRIAL") &&
          (!t.expires_at || new Date(t.expires_at) >= now)
      ).length,
      trial: tenants.filter((t: any) => t.status === "TRIAL").length,
      expired: tenants.filter(
        (t: any) => t.status === "EXPIRED" || (t.expires_at && new Date(t.expires_at) < now)
      ).length,
      blocked: tenants.filter((t: any) => t.status === "BLOCKED").length,
    };

    return NextResponse.json({
      success: true,
      isDemoMode: false,
      dbSource: "PostgreSQL Neon",
      metrics,
      tenants,
    });
  } catch (err: any) {
    console.error("Erro na consulta de tenants no PostgreSQL:", err);
    return NextResponse.json(
      {
        success: false,
        error: err.message || "Falha ao processar consulta de oficinas.",
        metrics: { total: 0, active: 0, trial: 0, expired: 0, blocked: 0 },
        tenants: [],
      },
      { status: 500 }
    );
  }
}

// POST: Criar novo cliente manualmente pelo Master
export async function POST(req: NextRequest) {
  if (!(await verifyRequestAuth(req))) {
    return NextResponse.json({ success: false, error: "Acesso não autorizado." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      name,
      ownerName,
      email,
      phone,
      password = "123",
      plan = "PRO",
      daysValid = 30,
      enabledFeatures: customFeatures,
    } = body;

    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: "Nome da oficina e E-mail são obrigatórios." },
        { status: 400 }
      );
    }

    const tenantId = `tenant-${Date.now()}`;
    const userId = `usr-${Date.now()}`;
    const passwordHash = hashPassword(password);
    const expiresAt = new Date(Date.now() + Number(daysValid) * 86400000);

    const defaultFeatures = customFeatures || {
      ordens_servico: true,
      checklist_fotos: true,
      estoque_pecas: true,
      pdv_balcao: true,
      financeiro: true,
      whatsapp_crm: true,
      relatorios: true,
    };

    const initialSettings = {
      name,
      tradeName: name,
      slogan: "Centro Automotivo Especializado",
      phone,
      email,
      primaryColor: "#F26B21",
      secondaryColor: "#0f172a",
      themeMode: "light",
      userName: ownerName,
      userRole: "Administrador / Proprietário",
    };

    await query(
      `INSERT INTO tenants (id, name, owner_name, email, phone, plan, status, expires_at, enabled_features, company_settings)
       VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', $7, $8, $9)`,
      [
        tenantId,
        name,
        ownerName,
        email.toLowerCase().trim(),
        phone,
        plan,
        expiresAt.toISOString(),
        JSON.stringify(defaultFeatures),
        JSON.stringify(initialSettings),
      ]
    );

    await query(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, phone, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, 'ADMIN', true)`,
      [userId, tenantId, ownerName, email.toLowerCase().trim(), passwordHash, phone]
    );

    await query(
      `INSERT INTO tenant_store (tenant_id, company_settings)
       VALUES ($1, $2) ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantId, JSON.stringify(initialSettings)]
    );

    return NextResponse.json({ success: true, tenantId, isDemoMode: false });
  } catch (err: any) {
    console.error("Erro ao criar tenant:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// PATCH: Renovar validade, alterar status (Bloquear/Liberar), Módulos ou Senha
export async function PATCH(req: NextRequest) {
  if (!(await verifyRequestAuth(req))) {
    return NextResponse.json({ success: false, error: "Acesso não autorizado." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { tenantId, status, addDays, setExactExpiresAt, enabledFeatures, newPassword } = body;

    if (!tenantId) {
      return NextResponse.json({ success: false, error: "tenantId é obrigatório" }, { status: 400 });
    }

    let computedExpiresAt: string | null = null;

    if (setExactExpiresAt) {
      computedExpiresAt = new Date(setExactExpiresAt).toISOString();
    } else if (addDays) {
      const cur = await query("SELECT expires_at FROM tenants WHERE id = $1", [tenantId]);
      const base =
        cur[0]?.expires_at && new Date(cur[0].expires_at) > new Date()
          ? new Date(cur[0].expires_at)
          : new Date();
      computedExpiresAt = new Date(base.getTime() + Number(addDays) * 86400000).toISOString();
    }

    await query(
      `UPDATE tenants SET
         status = COALESCE($1, status),
         expires_at = COALESCE($2, expires_at),
         enabled_features = COALESCE($3, enabled_features),
         updated_at = NOW()
       WHERE id = $4`,
      [
        status || null,
        computedExpiresAt,
        enabledFeatures ? JSON.stringify(enabledFeatures) : null,
        tenantId,
      ]
    );

    if (newPassword) {
      const newHash = hashPassword(newPassword);
      await query("UPDATE users SET password_hash = $1 WHERE tenant_id = $2 AND role = 'ADMIN'", [
        newHash,
        tenantId,
      ]);
    }

    return NextResponse.json({ success: true, newExpiresAt: computedExpiresAt, isDemoMode: false });
  } catch (err: any) {
    console.error("Erro ao atualizar tenant:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

// DELETE: Remover oficina
export async function DELETE(req: NextRequest) {
  if (!(await verifyRequestAuth(req))) {
    return NextResponse.json({ success: false, error: "Acesso não autorizado." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("tenantId");

    if (!tenantId) {
      return NextResponse.json({ success: false, error: "tenantId é obrigatório" }, { status: 400 });
    }

    await query("DELETE FROM tenants WHERE id = $1", [tenantId]);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Erro ao deletar tenant:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
