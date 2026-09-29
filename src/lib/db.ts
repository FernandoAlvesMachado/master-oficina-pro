import { Pool } from "pg";
import crypto from "crypto";

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || "";

let pool: Pool | null = null;

export function isDbConfigured(): boolean {
  return Boolean(connectionString && connectionString.trim().length > 10 && !connectionString.includes("sua_string_de_conexao"));
}

export function getPool(): Pool | null {
  if (!isDbConfigured()) {
    return null;
  }
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes("localhost") ? false : { rejectUnauthorized: false },
      max: 10,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

export function hashPassword(password: string): string {
  const salt = "kvns-workshop-platform-secret-salt";
  return crypto.createHmac("sha256", salt).update(password).digest("hex");
}

export async function query<T = any>(sqlText: string, params: any[] = []): Promise<T[]> {
  const p = getPool();
  if (!p) {
    throw new Error("POSTGRES_URL_NOT_CONFIGURED");
  }
  const client = await p.connect();
  try {
    const res = await client.query(sqlText, params);
    return res.rows as T[];
  } finally {
    client.release();
  }
}

// Inicializa automaticamente as tabelas se ainda não existirem no PostgreSQL Neon
export async function ensureTablesExist(): Promise<{ success: boolean; message: string; tables: string[] }> {
  if (!isDbConfigured()) {
    return {
      success: false,
      message: "Banco de dados não configurado no .env.local",
      tables: [],
    };
  }

  const p = getPool();
  if (!p) throw new Error("Pool unavailable");
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

// Fallback Mock Store para testes e demonstração imediata caso o Neon ainda não tenha URL
export interface MockTenant {
  id: string;
  name: string;
  owner_name: string;
  email: string;
  phone: string;
  plan: string;
  status: "TRIAL" | "ACTIVE" | "BLOCKED" | "EXPIRED";
  trial_until: string | null;
  expires_at: string | null;
  enabled_features: Record<string, boolean>;
  company_settings: Record<string, any>;
  created_at: string;
  users_count: number;
  last_login_at: string | null;
}

// Memória local para demonstração inicial enquanto o usuário configura a Vercel
let globalMockTenants: MockTenant[] = [
  {
    id: "tenant-demo-01",
    name: "Auto Mecânica Prime Motors",
    owner_name: "Carlos Eduardo Silva",
    email: "carlos@primemotors.com.br",
    phone: "(11) 98765-4321",
    plan: "PRO",
    status: "ACTIVE",
    trial_until: null,
    expires_at: new Date(Date.now() + 24 * 86400000).toISOString(),
    enabled_features: {
      ordens_servico: true,
      checklist_fotos: true,
      estoque_pecas: true,
      pdv_balcao: true,
      financeiro: true,
      whatsapp_crm: true,
      relatorios: true,
    },
    company_settings: {
      primaryColor: "#F26B21",
    },
    created_at: new Date(Date.now() - 45 * 86400000).toISOString(),
    users_count: 3,
    last_login_at: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  {
    id: "tenant-demo-02",
    name: "Speed Garage Centro Automotivo",
    owner_name: "Marcos Vinicius Ribeiro",
    email: "contato@speedgarage.com",
    phone: "(21) 99876-1234",
    plan: "TRIAL",
    status: "TRIAL",
    trial_until: new Date(Date.now() + 8 * 86400000).toISOString(),
    expires_at: new Date(Date.now() + 8 * 86400000).toISOString(),
    enabled_features: {
      ordens_servico: true,
      checklist_fotos: true,
      estoque_pecas: false,
      pdv_balcao: false,
      financeiro: true,
      whatsapp_crm: false,
      relatorios: false,
    },
    company_settings: {
      primaryColor: "#0284C7",
    },
    created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
    users_count: 1,
    last_login_at: new Date(Date.now() - 5 * 3600000).toISOString(),
  },
  {
    id: "tenant-demo-03",
    name: "Oficina do Alemão Especializada",
    owner_name: "Ricardo Schmidt",
    email: "ricardo@oficinadoalemao.com",
    phone: "(47) 99123-9988",
    plan: "ENTERPRISE",
    status: "EXPIRED",
    trial_until: null,
    expires_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    enabled_features: {
      ordens_servico: true,
      checklist_fotos: true,
      estoque_pecas: true,
      pdv_balcao: true,
      financeiro: true,
      whatsapp_crm: true,
      relatorios: true,
    },
    company_settings: {},
    created_at: new Date(Date.now() - 90 * 86400000).toISOString(),
    users_count: 5,
    last_login_at: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: "tenant-demo-04",
    name: "Injeção Eletrônica & Suspensão Santos",
    owner_name: "José Ferreira Santos",
    email: "santos.mecanica@gmail.com",
    phone: "(31) 98455-7711",
    plan: "PRO",
    status: "BLOCKED",
    trial_until: null,
    expires_at: new Date(Date.now() + 15 * 86400000).toISOString(),
    enabled_features: {
      ordens_servico: true,
      checklist_fotos: true,
      estoque_pecas: false,
      pdv_balcao: false,
      financeiro: false,
      whatsapp_crm: false,
      relatorios: false,
    },
    company_settings: {},
    created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    users_count: 2,
    last_login_at: new Date(Date.now() - 12 * 86400000).toISOString(),
  },
];

let globalMockLeads = [
  {
    id: "lead-01",
    name: "Rodrigo Mendonça",
    workshop_name: "Mendonça Auto Peças e Mecânica",
    email: "rodrigo.mendonca@yahoo.com.br",
    phone: "(19) 97112-4433",
    status: "NEW",
    origin: "landing_page_trial",
    notes: "Interessado em teste de 14 dias para 3 mecânicos",
    created_at: new Date(Date.now() - 4 * 3600000).toISOString(),
  },
  {
    id: "lead-02",
    name: "Felipe Nogueira",
    workshop_name: "FN Car Service",
    email: "fn.carservice@outlook.com",
    phone: "(81) 99344-8822",
    status: "NEW",
    origin: "whatsapp_instagram",
    notes: "Viu anúncio no Instagram sobre checklist fotográfico",
    created_at: new Date(Date.now() - 18 * 3600000).toISOString(),
  },
];

export function getMockTenants(): MockTenant[] {
  return globalMockTenants;
}

export function setMockTenants(tenants: MockTenant[]) {
  globalMockTenants = tenants;
}

export function getMockLeads() {
  return globalMockLeads;
}

export function setMockLeads(leads: any[]) {
  globalMockLeads = leads;
}
