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
  var _giravoPgPool: Pool | undefined;
  var _giravoSchemaPromise: Promise<{ success: boolean; message: string; tables: string[] }> | undefined;
}

export function getPool(): Pool {
  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error(
      "BANCO_NAO_CONFIGURADO: Nenhuma variável de conexão (POSTGRES_URL ou DATABASE_URL) foi detectada no ambiente de produção da Vercel. Lembre-se de adicionar a variável nas configurações do projeto na Vercel e disparar um REDEPLOY."
    );
  }

  if (!globalThis._giravoPgPool) {
    globalThis._giravoPgPool = new Pool({
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
  return globalThis._giravoPgPool;
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

export async function withTransaction<T>(work: (client: import("pg").PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
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
        max_users INTEGER NOT NULL DEFAULT 1,
        pending_plan VARCHAR(50),
        status VARCHAR(50) DEFAULT 'ACTIVE',
        trial_until TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        enabled_features JSONB DEFAULT '{}'::jsonb,
        company_settings JSONB DEFAULT '{}'::jsonb,
        stripe_customer_id VARCHAR(255),
        stripe_subscription_id VARCHAR(255),
        billing_status VARCHAR(50) DEFAULT 'UNCONFIGURED',
        monthly_amount_cents INTEGER DEFAULT 0,
        last_payment_at TIMESTAMPTZ,
        billing_checkout_url TEXT,
        billing_checkout_expires_at TIMESTAMPTZ,
        billing_grace_until TIMESTAMPTZ,
        billing_block_reason VARCHAR(50),
        stripe_last_invoice_id VARCHAR(255),
        billing_failure_reason TEXT,
        billing_attempt_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE tenants
        ADD COLUMN IF NOT EXISTS max_users INTEGER NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS pending_plan VARCHAR(50),
        ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS billing_status VARCHAR(50) DEFAULT 'UNCONFIGURED',
        ADD COLUMN IF NOT EXISTS monthly_amount_cents INTEGER DEFAULT 0,
        ADD COLUMN IF NOT EXISTS last_payment_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS billing_checkout_url TEXT,
        ADD COLUMN IF NOT EXISTS billing_checkout_expires_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS billing_grace_until TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS billing_block_reason VARCHAR(50),
        ADD COLUMN IF NOT EXISTS stripe_last_invoice_id VARCHAR(255);
      ALTER TABLE tenants
        ADD COLUMN IF NOT EXISTS billing_failure_reason TEXT,
        ADD COLUMN IF NOT EXISTS billing_attempt_count INTEGER DEFAULT 0;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_stripe_customer
        ON tenants(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
      UPDATE tenants SET plan = CASE
        WHEN plan = 'PRO' THEN 'PROFISSIONAL'
        WHEN plan = 'ENTERPRISE' THEN 'PREMIUM'
        WHEN plan IN ('BASIC', 'TRIAL') THEN 'ESSENCIAL'
        ELSE plan END
      WHERE plan IN ('PRO', 'ENTERPRISE', 'BASIC', 'TRIAL');
      UPDATE tenants SET max_users = CASE
        WHEN plan IN ('PREMIUM') THEN 10
        WHEN plan IN ('PRO', 'PROFISSIONAL') THEN 3
        ELSE 1 END
      WHERE max_users IS NULL OR (max_users = 1 AND plan IN ('PRO', 'PROFISSIONAL', 'PREMIUM'));
    `);

    // Eventos financeiros persistidos para auditoria e relatórios históricos.
    await client.query(`
      CREATE TABLE IF NOT EXISTS stripe_payments (
        id VARCHAR(255) PRIMARY KEY,
        tenant_id VARCHAR(64) REFERENCES tenants(id) ON DELETE SET NULL,
        stripe_customer_id VARCHAR(255),
        stripe_invoice_id VARCHAR(255) UNIQUE,
        amount_cents INTEGER NOT NULL DEFAULT 0,
        currency VARCHAR(10) NOT NULL DEFAULT 'brl',
        status VARCHAR(50) NOT NULL,
        paid_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_stripe_payments_tenant_paid
        ON stripe_payments(tenant_id, paid_at DESC);
      CREATE TABLE IF NOT EXISTS stripe_webhook_events (
        id VARCHAR(255) PRIMARY KEY,
        event_type VARCHAR(100) NOT NULL,
        processed_at TIMESTAMPTZ DEFAULT NOW()
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

      CREATE OR REPLACE FUNCTION enforce_tenant_user_limit()
      RETURNS TRIGGER AS $$
      DECLARE allowed_users INTEGER; active_users INTEGER;
      BEGIN
        IF NEW.is_active IS NOT TRUE OR NEW.tenant_id IS NULL THEN RETURN NEW; END IF;
        SELECT max_users INTO allowed_users FROM tenants WHERE id = NEW.tenant_id;
        SELECT COUNT(*) INTO active_users FROM users
          WHERE tenant_id = NEW.tenant_id AND is_active = TRUE AND id <> NEW.id;
        IF active_users >= COALESCE(allowed_users, 1) THEN
          RAISE EXCEPTION 'LIMITE_DE_USUARIOS: o plano permite no máximo % acesso(s) ativo(s).', COALESCE(allowed_users, 1)
            USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
      DROP TRIGGER IF EXISTS trg_enforce_tenant_user_limit ON users;
      CREATE TRIGGER trg_enforce_tenant_user_limit
        BEFORE INSERT OR UPDATE OF tenant_id, is_active ON users
        FOR EACH ROW EXECUTE FUNCTION enforce_tenant_user_limit();
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
        vehicles JSONB NOT NULL DEFAULT '[]'::jsonb,
        service_orders JSONB NOT NULL DEFAULT '[]'::jsonb,
        clients JSONB NOT NULL DEFAULT '[]'::jsonb,
        products JSONB NOT NULL DEFAULT '[]'::jsonb,
        sales JSONB NOT NULL DEFAULT '[]'::jsonb,
        receivables JSONB NOT NULL DEFAULT '[]'::jsonb,
        payables JSONB NOT NULL DEFAULT '[]'::jsonb,
        company_settings JSONB DEFAULT '{}'::jsonb,
        chat_data JSONB NOT NULL DEFAULT '{"messages":[],"status":"OPEN"}'::jsonb,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE tenant_store
        ADD COLUMN IF NOT EXISTS vehicles JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS service_orders JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS clients JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS products JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS sales JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS receivables JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS payables JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS chat_data JSONB NOT NULL DEFAULT '{"messages":[],"status":"OPEN"}'::jsonb;
    `);

    // 5. Vistorias fotográficas sempre isoladas por oficina.
    await client.query(`
      CREATE TABLE IF NOT EXISTS vehicle_checklists (
        id VARCHAR(64) PRIMARY KEY,
        tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        os_id VARCHAR(128),
        photos JSONB NOT NULL DEFAULT '[]'::jsonb,
        fuel_level VARCHAR(50),
        damage_notes TEXT,
        tires_condition VARCHAR(100),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_vehicle_checklists_tenant_os
        ON vehicle_checklists(tenant_id, os_id);
    `);

    // 6. Tabela chat_messages (Suporte Master x Oficinas)
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id VARCHAR(64) PRIMARY KEY,
        tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        sender VARCHAR(20) NOT NULL,
        sender_name VARCHAR(255),
        text TEXT NOT NULL,
        read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant ON chat_messages(tenant_id);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at);
    `);

    // 7. Tabela chat_threads (Controle de Atendimento Aberto x Arquivado)
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_threads (
        tenant_id VARCHAR(64) PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'OPEN',
        archived_at TIMESTAMPTZ,
        archived_by VARCHAR(50) DEFAULT 'MASTER',
        last_message_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      ALTER TABLE chat_threads
        ADD COLUMN IF NOT EXISTS queue_joined_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS archived_by VARCHAR(50) DEFAULT 'MASTER';
    `);

    // Corrige bancos antigos: garante cascata nas tabelas legadas do chat.
    await client.query(`
      DO $$
      DECLARE constraint_name TEXT;
      BEGIN
        IF to_regclass('public.chat_messages') IS NOT NULL THEN
          SELECT tc.constraint_name INTO constraint_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
          WHERE tc.table_schema = 'public' AND tc.table_name = 'chat_messages'
            AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'tenant_id'
          LIMIT 1;
          IF constraint_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE chat_messages DROP CONSTRAINT %I', constraint_name);
          END IF;
          ALTER TABLE chat_messages
            ADD CONSTRAINT chat_messages_tenant_fk FOREIGN KEY (tenant_id)
            REFERENCES tenants(id) ON DELETE CASCADE NOT VALID;
        END IF;
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // Garante sincronização bidirecional e que todo tenant com mensagens possua registro na thread
    await client.query(`
      INSERT INTO chat_threads (tenant_id, status, last_message_at, updated_at)
      SELECT DISTINCT m.tenant_id, 'OPEN', MAX(m.created_at), NOW()
      FROM chat_messages m
      LEFT JOIN chat_threads t ON t.tenant_id = m.tenant_id
      WHERE t.tenant_id IS NULL
      GROUP BY m.tenant_id
      ON CONFLICT (tenant_id) DO NOTHING;
    `);

    return {
      success: true,
      message: "Todas as tabelas do sistema GIRAVO estão ativas e sincronizadas no PostgreSQL!",
      tables: ["tenants", "users", "leads", "tenant_store", "vehicle_checklists", "chat_messages", "chat_threads", "stripe_payments", "stripe_webhook_events"],
    };
  } finally {
    client.release();
  }
}

// Evita repetir CREATE/ALTER/migrações em cada polling do painel dentro da mesma instância serverless.
export function ensureTablesOnce() {
  if (!globalThis._giravoSchemaPromise) {
    globalThis._giravoSchemaPromise = ensureTablesExist().catch((error) => {
      globalThis._giravoSchemaPromise = undefined;
      throw error;
    });
  }
  return globalThis._giravoSchemaPromise;
}
