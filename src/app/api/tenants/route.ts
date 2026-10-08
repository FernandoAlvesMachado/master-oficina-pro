import { NextRequest, NextResponse } from "next/server";
import { query, hashPassword, ensureTablesOnce, withTransaction } from "@/lib/db";
import { verifyRequestAuth } from "@/lib/auth";
import { cleanText, integerInRange, isRecord, isValidEmail, publicError, TENANT_STATUSES } from "@/lib/validation";
import { normalizePlan, PLAN_CATALOG } from "@/lib/plans";

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
    await ensureTablesOnce();

    const tenants = await query(`
      SELECT 
        t.id,
        t.name,
        t.owner_name,
        t.email,
        t.phone,
        t.plan,
        t.max_users,
        t.status,
        t.trial_until,
        t.expires_at,
        t.enabled_features,
        t.company_settings,
        t.stripe_customer_id,
        t.stripe_subscription_id,
        t.billing_status,
        t.monthly_amount_cents,
        t.last_payment_at,
        t.billing_checkout_url,
        t.billing_checkout_expires_at,
        t.billing_grace_until,
        t.billing_block_reason,
        t.stripe_last_invoice_id,
        t.billing_failure_reason,
        t.billing_attempt_count,
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
      name: rawName,
      ownerName: rawOwnerName,
      email: rawEmail,
      phone: rawPhone,
      password: rawPassword,
      plan: rawPlan = "PRO",
      daysValid = 30,
      enabledFeatures: customFeatures,
      leadId,
      status: requestedStatus,
    } = body;

    const name = cleanText(rawName, 255);
    const ownerName = cleanText(rawOwnerName || rawName, 255);
    const email = cleanText(rawEmail, 254).toLowerCase();
    const phone = cleanText(rawPhone, 50);
    const password = cleanText(rawPassword, 128);
    const plan = normalizePlan(rawPlan) || "PROFISSIONAL";
    const validDays = integerInRange(daysValid, 1, 3650);

    if (!name || !ownerName || !isValidEmail(email) || password.length < 6 || !validDays) {
      return NextResponse.json(
        { success: false, error: "Informe oficina, responsável, e-mail válido, senha com pelo menos 6 caracteres e validade entre 1 e 3650 dias." },
        { status: 400 }
      );
    }

    if (customFeatures !== undefined && (!isRecord(customFeatures) || Object.values(customFeatures).some((v) => typeof v !== "boolean"))) {
      return NextResponse.json({ success: false, error: "Permissões de módulos inválidas." }, { status: 400 });
    }
    if (requestedStatus && !TENANT_STATUSES.includes(requestedStatus)) {
      return NextResponse.json({ success: false, error: "Status da oficina inválido." }, { status: 400 });
    }

    const tenantId = `tenant-${Date.now()}`;
    const userId = `usr-${Date.now()}`;
    const passwordHash = hashPassword(password);
    const expiresAt = new Date(Date.now() + validDays * 86400000);
    const isTrial = requestedStatus === "TRIAL";
    const tenantStatus = requestedStatus || (isTrial ? "TRIAL" : "ACTIVE");
    const trialUntil = isTrial ? expiresAt.toISOString() : null;

    const planDefinition = PLAN_CATALOG[plan];
    const defaultFeatures = customFeatures || planDefinition.features;

    const initialSettings = {
      name,
      tradeName: name,
      slogan: "Centro Automotivo Especializado",
      phone,
      email,
      primaryColor: "#9EE824",
      secondaryColor: "#0f172a",
      themeMode: "light",
      userName: ownerName,
      userRole: "Administrador / Proprietário",
    };

    await ensureTablesOnce();

    const existingTenant = await query<{ id: string }>("SELECT id FROM tenants WHERE LOWER(email) = $1 LIMIT 1", [email]);
    if (existingTenant.length > 0) {
      return NextResponse.json(
        { success: false, error: "Já existe uma oficina cadastrada com este e-mail. Utilize outro e-mail." },
        { status: 409 }
      );
    }

    await withTransaction(async (client) => {
      await client.query(
      `INSERT INTO tenants (id, name, owner_name, email, phone, plan, max_users, status, trial_until, expires_at, enabled_features, company_settings)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        tenantId,
        name,
        ownerName,
        email.toLowerCase().trim(),
        phone,
        plan,
        planDefinition.maxUsers,
        tenantStatus,
        trialUntil,
        expiresAt.toISOString(),
        JSON.stringify(defaultFeatures),
        JSON.stringify(initialSettings),
      ]
      );

      await client.query(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, phone, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, 'ADMIN', true)`,
      [userId, tenantId, ownerName, email.toLowerCase().trim(), passwordHash, phone]
      );

      await client.query(
      `INSERT INTO tenant_store (tenant_id, company_settings)
       VALUES ($1, $2) ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantId, JSON.stringify(initialSettings)]
      );

    // Se a oficina foi originada de um Lead pendente, marca como APROVADO e associa o tenant
    if (leadId) {
      try {
        await client.query(
          `UPDATE leads SET status = 'APPROVED', tenant_id = $1 WHERE id = $2`,
          [tenantId, leadId]
        );
      } catch (leadErr) { console.warn("Aviso ao vincular lead com tenant:", leadErr); }
    }
    });

    return NextResponse.json({
      success: true,
      tenantId,
      generatedPassword: password,
      expiresAt: expiresAt.toISOString(),
      isDemoMode: false,
    });
  } catch (err: any) {
    console.error("Erro ao criar tenant:", err);
    if (err?.code === "23505") {
      return NextResponse.json(
        { success: false, error: "Já existe uma oficina cadastrada com este e-mail." },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: false, error: publicError(err, "Falha ao cadastrar oficina.") }, { status: 500 });
  }
}

// PATCH: Renovar validade, alterar status (Bloquear/Liberar), Módulos ou Senha
export async function PATCH(req: NextRequest) {
  if (!(await verifyRequestAuth(req))) {
    return NextResponse.json({ success: false, error: "Acesso não autorizado." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { tenantId, status, addDays, setExactExpiresAt, setRemainingDays, enabledFeatures, newPassword } = body;

    if (!tenantId) {
      return NextResponse.json({ success: false, error: "tenantId é obrigatório" }, { status: 400 });
    }

    if (status && !TENANT_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: "Status da oficina inválido." }, { status: 400 });
    }
    if (enabledFeatures !== undefined && (!isRecord(enabledFeatures) || Object.values(enabledFeatures).some((v) => typeof v !== "boolean"))) {
      return NextResponse.json({ success: false, error: "Permissões de módulos inválidas." }, { status: 400 });
    }
    if (newPassword !== undefined && cleanText(newPassword, 128).length < 6) {
      return NextResponse.json({ success: false, error: "A nova senha deve ter pelo menos 6 caracteres." }, { status: 400 });
    }

    let computedExpiresAt: string | null = null;

    if (setRemainingDays !== undefined && setRemainingDays !== null) {
      const days = integerInRange(setRemainingDays, 0, 3650);
      if (days === null) return NextResponse.json({ success: false, error: "Quantidade de dias inválida." }, { status: 400 });
      computedExpiresAt = new Date(Date.now() + days * 86400000).toISOString();
    } else if (setExactExpiresAt) {
      const exactDate = new Date(setExactExpiresAt);
      if (Number.isNaN(exactDate.getTime())) return NextResponse.json({ success: false, error: "Data de vencimento inválida." }, { status: 400 });
      computedExpiresAt = exactDate.toISOString();
    } else if (addDays) {
      const days = integerInRange(addDays, 1, 3650);
      if (!days) return NextResponse.json({ success: false, error: "Quantidade de dias inválida." }, { status: 400 });
      const cur = await query("SELECT expires_at FROM tenants WHERE id = $1", [tenantId]);
      if (!cur.length) return NextResponse.json({ success: false, error: "Conta não encontrada." }, { status: 404 });
      const base =
        cur[0]?.expires_at && new Date(cur[0].expires_at) > new Date()
          ? new Date(cur[0].expires_at)
          : new Date();
      computedExpiresAt = new Date(base.getTime() + days * 86400000).toISOString();
    }

    const updated = await query(
      `UPDATE tenants SET
         status = COALESCE($1, status),
         expires_at = COALESCE($2, expires_at),
         enabled_features = COALESCE($3, enabled_features),
         billing_block_reason = CASE
           WHEN $1 = 'BLOCKED' THEN 'MANUAL'
           WHEN $1 = 'ACTIVE' THEN NULL
           ELSE billing_block_reason
         END,
         updated_at = NOW()
       WHERE id = $4 RETURNING id`,
      [
        status || null,
        computedExpiresAt,
        enabledFeatures ? JSON.stringify(enabledFeatures) : null,
        tenantId,
      ]
    );
    if (!updated.length) return NextResponse.json({ success: false, error: "Conta não encontrada." }, { status: 404 });

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
    return NextResponse.json({ success: false, error: publicError(err) }, { status: 500 });
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

    const deleted = await withTransaction(async (client) => {
      const exists = await client.query("SELECT id FROM tenants WHERE id = $1 FOR UPDATE", [tenantId]);
      if (!exists.rowCount) return null;

      // Remove dados em qualquer tabela atual ou futura que pertençam ao tenant.
      // Os nomes vêm exclusivamente do catálogo do PostgreSQL e são escapados pelo servidor.
      const tables = await client.query<{ table_name: string }>(`
        SELECT DISTINCT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'tenant_id'
          AND table_name <> 'tenants'
        ORDER BY table_name
      `);
      const counts: Record<string, number> = {};
      for (const { table_name: tableName } of tables.rows) {
        const safeTableName = '"' + tableName.replace(/"/g, '""') + '"';
        const result = await client.query(`DELETE FROM ${safeTableName} WHERE tenant_id = $1`, [tenantId]);
        counts[tableName] = result.rowCount || 0;
      }
      await client.query("DELETE FROM tenants WHERE id = $1", [tenantId]);
      return counts;
    });

    if (!deleted) {
      return NextResponse.json({ success: false, error: "Conta não encontrada." }, { status: 404 });
    }
    return NextResponse.json({ success: true, deleted });
  } catch (err: any) {
    console.error("Erro ao deletar tenant:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
