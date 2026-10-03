import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { ensureTablesOnce, hashPassword, query } from "@/lib/db";
import { verifyRequestAuth } from "@/lib/auth";
import { isValidEmail, publicError } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ROLES = ["ADMIN", "GERENTE", "ATENDENTE", "MECANICO", "FINANCEIRO"] as const;

function role(value: unknown) {
  const normalized = String(value || "ATENDENTE").toUpperCase();
  return ROLES.includes(normalized as typeof ROLES[number]) ? normalized : "ATENDENTE";
}

function allowedPermissions(input: unknown, enabled: Record<string, boolean>) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return Object.fromEntries(Object.entries(input as Record<string, unknown>)
    .filter(([key]) => enabled[key] === true)
    .map(([key, value]) => [key, value === true]));
}

async function authorized(req: NextRequest) {
  return verifyRequestAuth(req);
}

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ success: false, error: "Acesso não autorizado." }, { status: 401 });
  try {
    await ensureTablesOnce();
    const rows = await query<any>(`
      SELECT t.id AS tenant_id, t.name AS tenant_name, t.plan, t.status AS tenant_status,
             t.max_users, t.enabled_features,
             u.id, u.name, u.email, u.phone, u.role, u.job_title, u.permissions,
             u.is_active, u.last_login_at, u.created_at
      FROM tenants t
      LEFT JOIN users u ON u.tenant_id = t.id
      ORDER BY t.name ASC, CASE WHEN u.role = 'ADMIN' THEN 0 ELSE 1 END, u.created_at ASC
    `);
    const workshops = new Map<string, any>();
    for (const row of rows) {
      if (!workshops.has(row.tenant_id)) workshops.set(row.tenant_id, {
        id: row.tenant_id, name: row.tenant_name, plan: row.plan, status: row.tenant_status,
        maxUsers: row.max_users, enabledFeatures: row.enabled_features || {}, users: [],
      });
      if (row.id) workshops.get(row.tenant_id).users.push({
        id: row.id, name: row.name, email: row.email, phone: row.phone, role: row.role,
        jobTitle: row.job_title, permissions: row.permissions || {}, isActive: row.is_active,
        lastLoginAt: row.last_login_at, createdAt: row.created_at,
      });
    }
    return NextResponse.json({ success: true, workshops: [...workshops.values()] });
  } catch (error) {
    return NextResponse.json({ success: false, error: publicError(error, "Falha ao carregar acessos.") }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ success: false, error: "Acesso não autorizado." }, { status: 401 });
  try {
    await ensureTablesOnce();
    const body = await req.json();
    const tenantId = String(body.tenantId || "").trim();
    const name = String(body.name || "").trim().slice(0, 255);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!tenantId || !name || !isValidEmail(email) || password.length < 8) {
      return NextResponse.json({ success: false, error: "Informe oficina, nome, e-mail válido e senha com pelo menos 8 caracteres." }, { status: 400 });
    }
    const tenants = await query<any>("SELECT enabled_features FROM tenants WHERE id = $1 LIMIT 1", [tenantId]);
    if (!tenants[0]) return NextResponse.json({ success: false, error: "Oficina não encontrada." }, { status: 404 });
    const id = `usr_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
    const permissions = allowedPermissions(body.permissions, tenants[0].enabled_features || {});
    await query(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, phone, role, job_title, permissions, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,TRUE)`,
      [id, tenantId, name, email, await hashPassword(password), String(body.phone || "").slice(0, 50) || null,
        role(body.role), String(body.jobTitle || "").slice(0, 100) || null, JSON.stringify(permissions)]
    );
    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error: any) {
    const message = error?.code === "23514" ? error.message : error?.code === "23505" ? "Este e-mail já possui acesso nesta oficina." : publicError(error, "Falha ao criar acesso.");
    return NextResponse.json({ success: false, error: message }, { status: error?.code === "23514" || error?.code === "23505" ? 409 : 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ success: false, error: "Acesso não autorizado." }, { status: 401 });
  try {
    await ensureTablesOnce();
    const body = await req.json();
    const userId = String(body.userId || "").trim();
    const current = await query<any>(`SELECT u.id, u.tenant_id, t.enabled_features FROM users u JOIN tenants t ON t.id=u.tenant_id WHERE u.id=$1 LIMIT 1`, [userId]);
    if (!current[0]) return NextResponse.json({ success: false, error: "Usuário não encontrado." }, { status: 404 });
    const permissions = allowedPermissions(body.permissions, current[0].enabled_features || {});
    const passwordHash = typeof body.password === "string" && body.password.length >= 8 ? await hashPassword(body.password) : null;
    await query(
      `UPDATE users SET name=COALESCE($2,name), phone=$3, role=$4, job_title=$5,
         permissions=$6::jsonb, is_active=$7, password_hash=COALESCE($8,password_hash)
       WHERE id=$1`,
      [userId, String(body.name || "").trim().slice(0,255) || null, String(body.phone || "").slice(0,50) || null,
       role(body.role), String(body.jobTitle || "").slice(0,100) || null, JSON.stringify(permissions), body.isActive !== false, passwordHash]
    );
    return NextResponse.json({ success: true });
  } catch (error: any) {
    const message = error?.code === "23514" ? error.message : publicError(error, "Falha ao atualizar acesso.");
    return NextResponse.json({ success: false, error: message }, { status: error?.code === "23514" ? 409 : 500 });
  }
}
