import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ensureTablesOnce, query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeEqual(left: string, right: string) {
  const a = crypto.createHash("sha256").update(left).digest();
  const b = crypto.createHash("sha256").update(right).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  const configuredKey = process.env.GIRAVO_INTERNAL_API_KEY || "";
  const suppliedKey = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (configuredKey.length < 32 || !suppliedKey || !safeEqual(suppliedKey, configuredKey)) {
    return NextResponse.json({ success: false, error: "Acesso interno não autorizado." }, { status: 401 });
  }

  const tenantId = req.nextUrl.searchParams.get("tenantId")?.trim();
  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  if (!tenantId) return NextResponse.json({ success: false, error: "tenantId é obrigatório." }, { status: 400 });

  await ensureTablesOnce();
  // A consulta do cliente também efetiva o bloqueio quando o prazo de tolerância termina.
  await query(
    `UPDATE tenants SET status = 'BLOCKED', billing_block_reason = 'PAYMENT_OVERDUE', updated_at = NOW()
     WHERE id = $1 AND billing_status = 'PAST_DUE' AND billing_grace_until <= NOW()
       AND status <> 'BLOCKED'`,
    [tenantId]
  );
  const rows = await query<any>(
    `SELECT t.id, t.status, t.expires_at, t.plan, t.max_users, t.enabled_features,
            t.billing_status, t.billing_cycle, t.billing_grace_until, t.billing_block_reason,
            t.billing_checkout_url, t.billing_checkout_expires_at, t.last_payment_at,
            t.billing_failure_reason, t.billing_attempt_count,
            (SELECT COUNT(*)::int FROM users u WHERE u.tenant_id = t.id AND u.is_active = TRUE) AS active_users
     FROM tenants t WHERE t.id = $1 LIMIT 1`,
    [tenantId]
  );
  const tenant = rows[0];
  if (!tenant) return NextResponse.json({ success: false, error: "Conta não encontrada." }, { status: 404 });

  const checkoutValid = tenant.billing_checkout_url && (!tenant.billing_checkout_expires_at || new Date(tenant.billing_checkout_expires_at) > new Date());
  const expired = tenant.expires_at && new Date(tenant.expires_at) < new Date();
  const daysRemaining = tenant.expires_at
    ? Math.max(0, Math.ceil((new Date(tenant.expires_at).getTime() - Date.now()) / 86400000))
    : null;
  const accessAllowed = tenant.status !== "BLOCKED" && tenant.status !== "EXPIRED" && !expired;
  const userRows = userId ? await query<any>(
    `SELECT id, name, email, role, job_title, permissions, is_active, last_login_at
     FROM users WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
    [userId, tenantId]
  ) : [];
  const accountUser = userRows[0] || null;
  const effectivePermissions = accountUser
    ? accountUser.role === "ADMIN"
      ? tenant.enabled_features || {}
      : Object.fromEntries(Object.entries(accountUser.permissions || {}).filter(([key, allowed]) => allowed === true && tenant.enabled_features?.[key] === true))
    : null;
  return NextResponse.json({
    success: true,
    tenantId: tenant.id,
    access: { allowed: accessAllowed, status: tenant.status, reason: tenant.billing_block_reason },
    userAccess: accountUser ? {
      id: accountUser.id,
      name: accountUser.name,
      email: accountUser.email,
      role: accountUser.role,
      jobTitle: accountUser.job_title,
      active: accountUser.is_active,
      allowed: accessAllowed && accountUser.is_active,
      permissions: effectivePermissions,
      lastLoginAt: accountUser.last_login_at,
    } : null,
    billing: {
      status: tenant.billing_status,
      cycle: tenant.billing_cycle || "monthly",
      graceUntil: tenant.billing_grace_until,
      lastPaymentAt: tenant.last_payment_at,
      serviceUntil: tenant.expires_at,
      daysRemaining,
      checkoutUrl: checkoutValid ? tenant.billing_checkout_url : null,
      checkoutExpiresAt: checkoutValid ? tenant.billing_checkout_expires_at : null,
      failureReason: tenant.billing_failure_reason,
      paymentAttempts: tenant.billing_attempt_count,
    },
    entitlements: {
      plan: tenant.plan,
      maxUsers: tenant.max_users,
      activeUsers: tenant.active_users,
      canAddUser: tenant.active_users < tenant.max_users,
      features: tenant.enabled_features || {},
    },
  });
}
