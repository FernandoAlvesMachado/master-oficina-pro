import { Pool } from "pg";
import crypto from "crypto";

function cleanCandidate(val: string | undefined): string {
  if (!val) return "";
  let s = val.trim();
  // Remove aspas se foram coladas junto
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  // Se o usuário colou a chave junto no valor (ex: DATABASE_URL=postgresql://...)
  if (s.includes("=") && !s.startsWith("postgres")) {
    const idx = s.indexOf("=");
    const after = s.substring(idx + 1).trim();
    if (after.startsWith("postgres")) {
      s = after;
    }
  }
  return s;
}

// Recupera a string de conexão de forma dinâmica e resiliente através das variáveis de ambiente
export function getConnectionString(): string {
  // Lista de possíveis nomes de variáveis na Vercel / Neon / Supabase
  const candidateKeys = [
    process.env.POSTGRES_URL,
    process.env.DATABASE_URL,
    process.env.POSTGRES_PRISMA_URL,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_URL_NO_SSL,
    process.env.NEON_DATABASE_URL,
    process.env.VERCEL_POSTGRES_URL,
  ];

  for (const raw of candidateKeys) {
    const cleaned = cleanCandidate(raw);
    if (cleaned.length > 10 && !cleaned.includes("sua_string_de_conexao")) {
      return cleaned;
    }
  }

  // 2. Variáveis individuais do PostgreSQL (se configuradas no painel da Vercel)
  if (process.env.PGHOST && process.env.PGUSER && process.env.PGPASSWORD) {
    const host = cleanCandidate(process.env.PGHOST);
    const user = cleanCandidate(process.env.PGUSER);
    const pass = cleanCandidate(process.env.PGPASSWORD);
    const db = cleanCandidate(process.env.PGDATABASE) || "neondb";
    const port = cleanCandidate(process.env.PGPORT) || "5432";
    return `postgresql://${user}:${pass}@${host}:${port}/${db}?sslmode=require`;
  }

  return "";
}

export function isDbConfigured(): boolean {
  const cs = getConnectionString();
  return Boolean(cs && cs.trim().length > 10);
}

// Helper para diagnóstico sem expor segredos
export function getEnvDiagnostics() {
  return {
    has_POSTGRES_URL: Boolean(process.env.POSTGRES_URL && process.env.POSTGRES_URL.length > 10),
    has_DATABASE_URL: Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.length > 10),
    has_POSTGRES_PRISMA_URL: Boolean(process.env.POSTGRES_PRISMA_URL),
    has_POSTGRES_URL_NON_POOLING: Boolean(process.env.POSTGRES_URL_NON_POOLING),
    has_PGHOST: Boolean(process.env.PGHOST),
    isConfigured: isDbConfigured(),
    nodeEnv: process.env.NODE_ENV,
  };
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
      "BANCO_NAO_CONFIGURADO: Nenhuma variável de conexão (POSTGRES_URL ou DATABASE_URL) foi detectada no ambiente de produção da Vercel. Lembre-se de adicionar a variável nas configurações do projeto na Vercel e disparar um REDEPLOY."
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

    // 5. Tabela chat_messages (Suporte Master x Oficinas)
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id VARCHAR(64) PRIMARY KEY,
        tenant_id VARCHAR(64) NOT NULL,
        sender VARCHAR(20) NOT NULL,
        sender_name VARCHAR(255),
        text TEXT NOT NULL,
        read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant ON chat_messages(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);
    `);

    // 6. Tabela chat_threads (Controle de Atendimento Aberto x Arquivado)
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_threads (
        tenant_id VARCHAR(64) PRIMARY KEY,
        status VARCHAR(20) DEFAULT 'OPEN',
        archived_at TIMESTAMPTZ,
        archived_by VARCHAR(50) DEFAULT 'MASTER',
        last_message_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    return {
      success: true,
      message: "Todas as tabelas do sistema KVNS estão ativas e sincronizadas no PostgreSQL!",
      tables: ["tenants", "users", "leads", "tenant_store", "chat_messages", "chat_threads"],
    };
  } finally {
    client.release();
  }
}
