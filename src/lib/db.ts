import { Pool } from "pg";
import crypto from "crypto";

// Recupera a string de conexão de forma estritamente segura através das variáveis de ambiente
export function getConnectionString(): string {
  // 1. Variáveis diretas injetadas com segurança na Vercel ou .env.local
  const envUrl =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED;

  if (envUrl && envUrl.trim().length > 10 && !envUrl.includes("sua_string_de_conexao")) {
    return envUrl.trim();
  }

  // 2. Variáveis individuais do PostgreSQL (se configuradas no painel da Vercel)
  if (process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD) {
    const host = process.env.PGHOST;
    const user = process.env.PGUSER;
    const pass = process.env.PGPASSWORD;
    const db = process.env.PGDATABASE || "neondb";
    const port = process.env.PGPORT || "5432";
    return `postgresql://${user}:${pass}@${host}:${port}/${db}?sslmode=require`;
  }

  return "";
}

export function isDbConfigured(): boolean {
  const cs = getConnectionString();
  return Boolean(cs && cs.trim().length > 10);
}

// Manter singleton do Pool no escopo global para evitar vazamento de conexões em serverless
declare global {
  // eslint-disable-next-line no-var
  var _kvnsPgPool: Pool | undefined;
}

export function getPool(): Pool {
  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error(
      "BANCO_NAO_CONFIGURADO: A variável de ambiente POSTGRES_URL ou DATABASE_URL não foi definida no servidor."
    );
  }

  if (!globalThis._kvnsPgPool) {
    globalThis._kvnsPgPool = new Pool({
      connectionString,
      ssl: connectionString.includes("localhost")
        ? false
        : {
            rejectUnauthorized: false,
          },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return globalThis._kvnsPgPool;
}

export function hashPassword(password: string): string {
  const salt = process.env.PASSWORD_SALT || "kvns-workshop-platform-secret-salt";
  return crypto.createHmac("sha256", salt).update(password).digest("hex");
}

export async function query<T = any>(sqlText: string, params: any[] = []): Promise<T[]> {
  const p = getPool();
  const client = await p.connect();
  try {
    const res = await client.query(sqlText, params);
    return res.rows as T[];
  } finally {
    client.release();
  }
}

// Inicializa automaticamente as tabelas se ainda não existirem no PostgreSQL
export async function ensureTablesExist(): Promise<{ success: boolean; message: string; tables: string[] }> {
  if (!isDbConfigured()) {
    throw new Error("POSTGRES_URL_NOT_CONFIGURED");
  }

  const p = getPool();
  const client = await p.connect();

  try {
    // 1. Tabela tenants
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        owner_name VARCHAR(255),
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(50),
        plan VARCHAR(50) DEFAULT 'PRO',
        status VARCHAR(50) DEFAULT 'ACTIVE',
        trial_until TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        enabled_features JSONB DEFAULT '{}'::jsonb,
        company_settings JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 2. Tabela users
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        tenant_id VARCHAR(64) REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        password_hash TEXT NOT NULL,
        phone VARCHAR(50),
        role VARCHAR(50) DEFAULT 'ADMIN',
        is_active BOOLEAN DEFAULT TRUE,
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
    `);

    // 3. Tabela leads
    await client.query(`
      CREATE TABLE IF NOT EXISTS leads (
        id VARCHAR(64) PRIMARY KEY,
        tenant_id VARCHAR(64),
        name VARCHAR(255) NOT NULL,
        workshop_name VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(50),
        status VARCHAR(50) DEFAULT 'NEW',
        origin VARCHAR(100) DEFAULT 'landing_page_trial',
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // 4. Tabela tenant_store
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenant_store (
        tenant_id VARCHAR(64) PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
        company_settings JSONB DEFAULT '{}'::jsonb,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    return {
      success: true,
      message: "Todas as tabelas do sistema KVNS estão ativas e sincronizadas no PostgreSQL!",
      tables: ["tenants", "users", "leads", "tenant_store"],
    };
  } finally {
    client.release();
  }
}
