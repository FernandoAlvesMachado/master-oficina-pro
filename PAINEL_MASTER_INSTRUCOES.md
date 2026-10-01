# 🛠️ Guia de Implementação: Painel Master Administrativo GIRAVO

Este documento contém o passo a passo completo, arquitetura, esquema do banco de dados e o **código-fonte pronto para uso** para a criação do seu **Painel Master (GIRAVO)**.

Por meio desse Painel Master independente, você terá controle centralizado de todas as oficinas clientes conectadas ao mesmo banco de dados da Vercel.

---

## 📌 1. Visão Geral da Arquitetura

O sistema atual da oficina (este projeto) e o seu novo **Painel Master** compartilham a **mesma base de dados PostgreSQL na Vercel (Neon)**:

```
┌──────────────────────────────────────────────┐       ┌──────────────────────────────────────────────┐
│        SISTEMA DA OFICINA (app.giravo.com.br) │       │       PAINEL MASTER (master.giravo.com.br)   │
│  - Cadastro de Leads & Trial 14 dias         │       │  - Gestão de Todos os Clientes               │
│  - Painel com Logo, Nome e Cores Próprias    │       │  - Controle de Vencimento (+30d, +1 ano)    │
│  - Ordens de Serviço & Fotos de Vistoria     │       │  - Bloqueio / Desbloqueio Imediato           │
│  - Estoque, PDV Balcão & Financeiro          │       │  - Liberação / Bloqueio de Módulos (Flags)   │
└──────────────────────┬───────────────────────┘       └──────────────────────┬───────────────────────┘
                       │                                                      │
                       │           (Mesma POSTGRES_URL da Vercel)             │
                       └──────────────────────► ◄─────────────────────────────┘
                                                │
                                    ┌───────────────────────┐
                                    │    VERCEL POSTGRES    │
                                    │   (Neon Serverless)   │
                                    └───────────────────────┘
```

---

## 🔑 2. Como Obter as Credenciais no Dashboard da Vercel

1. Acesse o painel da **Vercel** ([vercel.com](https://vercel.com)).
2. Clique no seu projeto atual da oficina.
3. Acesse a aba **Storage** no topo.
4. Se o banco já estiver criado, clique nele. Caso ainda não tenha criado:
   - Clique em **Create Database** → escolha **Postgres (Neon)**.
   - Dê um nome (ex: `kvns-db`) e clique em **Create**.
   - Conecte o banco ao projeto atual.
5. Na aba **.env.local** ou **Quickstart** do banco, copie a variável **`POSTGRES_URL`** (ou `DATABASE_URL`).
   - Ela tem o formato:
     ```
     postgres://default:SENHA@ep-xyz.us-east-1.postgres.vercel-storage.com:5432/verceldb?sslmode=require
     ```
6. **Essa mesma URL** é o que você colocará no `.env.local` do seu segundo projeto (Painel Master).

---

## 🗄️ 3. Estrutura do Banco de Dados (Schema)

As tabelas já são criadas automaticamente pelo sistema da oficina na primeira requisição, mas aqui está a referência completa:

### Tabela `tenants` (Oficinas / Empresas)
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | VARCHAR(64) PK | Identificador único do cliente (ex: `tenant-123`) |
| `name` | VARCHAR(255) | Nome fantasia da oficina |
| `owner_name` | VARCHAR(255) | Nome do responsável / proprietário |
| `email` | VARCHAR(255) UNIQUE | E-mail principal de contato e login |
| `phone` | VARCHAR(50) | WhatsApp comercial |
| `plan` | VARCHAR(50) | Plano (`TRIAL`, `PRO`, `ENTERPRISE`) |
| `status` | VARCHAR(50) | Status da conta (`TRIAL`, `ACTIVE`, `BLOCKED`, `EXPIRED`) |
| `trial_until` | TIMESTAMPTZ | Data final do teste gratuito (14 dias) |
| `expires_at` | TIMESTAMPTZ | **Data de vencimento do programa**. Se vencido, o sistema avisa o cliente |
| `enabled_features` | JSONB | Objeto com as permissões dos módulos (ex: `{"ordens_servico": true, "checklist_fotos": true, "estoque_pecas": false, ...}`) |
| `company_settings` | JSONB | Configurações personalizadas (Logo, Nome, Cores, CNPJ, Endereço) |
| `created_at` | TIMESTAMPTZ | Data de criação do cadastro |
| `updated_at` | TIMESTAMPTZ | Última modificação |

### Tabela `users` (Operadores da Oficina)
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | VARCHAR(64) PK | ID do usuário |
| `tenant_id` | VARCHAR(64) FK | ID da oficina a qual pertence |
| `name` | VARCHAR(255) | Nome do usuário |
| `email` | VARCHAR(255) | Email de login |
| `password_hash` | TEXT | Hash da senha |
| `phone` | VARCHAR(50) | Telefone |
| `role` | VARCHAR(50) | Cargo (`ADMIN`, `GERENTE`, `MECANICO`, `RECEPCAO`) |
| `is_active` | BOOLEAN | Usuário ativo ou desativado |
| `last_login_at` | TIMESTAMPTZ | Data e hora do último acesso |

### Tabela `leads` (Geração de Leads)
| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | VARCHAR(64) PK | ID do lead |
| `tenant_id` | VARCHAR(64) FK | Tenant criado (se convertido) |
| `name` | VARCHAR(255) | Nome da pessoa que pediu teste |
| `workshop_name` | VARCHAR(255) | Nome da oficina |
| `email` | VARCHAR(255) | Email |
| `phone` | VARCHAR(50) | Telefone / WhatsApp |
| `status` | VARCHAR(50) | Status comercial (`NEW`, `CONVERTED`, `LOST`) |
| `origin` | VARCHAR(100) | Origem (`landing_page_trial`, `whatsapp`, etc.) |
| `created_at` | TIMESTAMPTZ | Data do cadastro |

### Tabela `tenant_store` (Dados da Oficina)
Armazena as ordens de serviço (incluindo as **fotos da O.S.**), clientes, produtos, vendas e caixa de forma isolada por `tenant_id`.

---

## 🚀 4. Como Criar o Projeto do Painel Master

Abra seu terminal em uma pasta separada (fora deste projeto) e execute:

```bash
# 1. Criar novo app Next.js
npx create-next-app@latest painel-master-kvns --typescript --eslint --app --no-tailwind --src-dir

# 2. Entrar na pasta do projeto
cd painel-master-kvns

# 3. Instalar bibliotecas de banco de dados e ícones
npm install pg lucide-react
npm install -D @types/pg
```

Crie o arquivo **`.env.local`** na raiz do novo projeto:

```env
# Conecte ao mesmo banco de dados da Vercel
POSTGRES_URL="sua_string_de_conexao_copiada_da_vercel"
DATABASE_URL="sua_string_de_conexao_copiada_da_vercel"

# Senha de proteção para acessar o Painel Master
MASTER_ADMIN_PASSWORD="sua_senha_secreta_aqui"
```

---

## 💻 5. Código-Fonte Pronto do Painel Master

### Arquivo A: `src/lib/db.ts` (No projeto do Painel Master)

Crie o arquivo `src/lib/db.ts`:

```typescript
import { Pool } from "pg";

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || "";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
    });
  }
  return pool;
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
```

---

### Arquivo B: `src/app/api/tenants/route.ts` (No projeto do Painel Master)

Crie o arquivo `src/app/api/tenants/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import crypto from "crypto";

function hashPassword(password: string): string {
  const salt = "kvns-workshop-platform-secret-salt";
  return crypto.createHmac("sha256", salt).update(password).digest("hex");
}

// GET: Listar todos os clientes, métricas e status de vencimento
export async function GET() {
  try {
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
        t.created_at,
        COUNT(u.id) as users_count,
        MAX(u.last_login_at) as last_login_at
      FROM tenants t
      LEFT JOIN users u ON t.id = u.tenant_id
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `);

    const now = new Date();
    const metrics = {
      total: tenants.length,
      active: tenants.filter(t => (t.status === "ACTIVE" || t.status === "TRIAL") && (!t.expires_at || new Date(t.expires_at) >= now)).length,
      trial: tenants.filter(t => t.status === "TRIAL").length,
      expired: tenants.filter(t => t.status === "EXPIRED" || (t.expires_at && new Date(t.expires_at) < now)).length,
      blocked: tenants.filter(t => t.status === "BLOCKED").length,
    };

    return NextResponse.json({ success: true, metrics, tenants });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Criar novo cliente manualmente pelo Master
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, ownerName, email, phone, password, plan = "PRO", daysValid = 30 } = body;

    const tenantId = `tenant-${Date.now()}`;
    const userId = `usr-${Date.now()}`;
    const passwordHash = hashPassword(password);
    const expiresAt = new Date(Date.now() + Number(daysValid) * 86400000);

    const defaultFeatures = {
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
      [tenantId, name, ownerName, email.toLowerCase(), phone, plan, expiresAt.toISOString(), JSON.stringify(defaultFeatures), JSON.stringify(initialSettings)]
    );

    await query(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, phone, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, 'ADMIN', true)`,
      [userId, tenantId, ownerName, email.toLowerCase(), passwordHash, phone]
    );

    await query(
      `INSERT INTO tenant_store (tenant_id, company_settings)
       VALUES ($1, $2) ON CONFLICT (tenant_id) DO NOTHING`,
      [tenantId, JSON.stringify(initialSettings)]
    );

    return NextResponse.json({ success: true, tenantId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH: Renovar validade, alterar status (Bloquear/Liberar) e Módulos
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenantId, status, addDays, enabledFeatures, newPassword } = body;

    let computedExpiresAt = null;
    if (addDays) {
      const cur = await query("SELECT expires_at FROM tenants WHERE id = $1", [tenantId]);
      const base = cur[0]?.expires_at && new Date(cur[0].expires_at) > new Date() ? new Date(cur[0].expires_at) : new Date();
      computedExpiresAt = new Date(base.getTime() + Number(addDays) * 86400000).toISOString();
    }

    await query(
      `UPDATE tenants SET
         status = COALESCE($1, status),
         expires_at = COALESCE($2, expires_at),
         enabled_features = COALESCE($3, enabled_features),
         updated_at = NOW()
       WHERE id = $4`,
      [status || null, computedExpiresAt, enabledFeatures ? JSON.stringify(enabledFeatures) : null, tenantId]
    );

    if (newPassword) {
      const newHash = hashPassword(newPassword);
      await query("UPDATE users SET password_hash = $1 WHERE tenant_id = $2 AND role = 'ADMIN'", [newHash, tenantId]);
    }

    return NextResponse.json({ success: true, newExpiresAt: computedExpiresAt });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

---

### Arquivo C: `src/app/page.tsx` (Interface do Painel Master)

Crie o arquivo `src/app/page.tsx`:

```tsx
"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  Users,
  CheckCircle,
  Clock,
  Ban,
  Plus,
  RefreshCw,
  Search,
  Calendar,
  Lock,
  Unlock,
  Sliders,
  Sparkles,
  ExternalLink,
} from "lucide-react";

interface Tenant {
  id: string;
  name: string;
  owner_name: string;
  email: string;
  phone: string;
  plan: string;
  status: "TRIAL" | "ACTIVE" | "BLOCKED" | "EXPIRED";
  expires_at: string;
  created_at: string;
  users_count: number;
  last_login_at: string;
  enabled_features: Record<string, boolean>;
}

export default function MasterDashboard() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [metrics, setMetrics] = useState<any>({ total: 0, active: 0, trial: 0, expired: 0, blocked: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");

  // Modais
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  // Form novo cliente
  const [newName, setNewName] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newDays, setNewDays] = useState(30);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tenants");
      const data = await res.json();
      if (data.success) {
        setTenants(data.tenants || []);
        setMetrics(data.metrics || {});
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName,
        ownerName: newOwner,
        email: newEmail,
        phone: newPhone,
        password: newPassword,
        daysValid: newDays,
      }),
    });
    if (res.ok) {
      setIsNewModalOpen(false);
      setNewName("");
      setNewOwner("");
      setNewEmail("");
      setNewPhone("");
      setNewPassword("");
      fetchTenants();
    }
  };

  const handleAddDays = async (tenantId: string, days: number) => {
    await fetch("/api/tenants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, addDays: days, status: "ACTIVE" }),
    });
    fetchTenants();
  };

  const handleToggleBlock = async (tenantId: string, currentStatus: string) => {
    const nextStatus = currentStatus === "BLOCKED" ? "ACTIVE" : "BLOCKED";
    await fetch("/api/tenants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, status: nextStatus }),
    });
    fetchTenants();
  };

  const handleToggleFeature = async (tenant: Tenant, featureKey: string) => {
    const updatedFeatures = {
      ...(tenant.enabled_features || {}),
      [featureKey]: !tenant.enabled_features?.[featureKey],
    };
    await fetch("/api/tenants", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: tenant.id, enabledFeatures: updatedFeatures }),
    });
    fetchTenants();
  };

  const filteredTenants = tenants.filter((t) => {
    if (statusFilter !== "TODOS" && t.status !== statusFilter) return false;
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      t.owner_name?.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q) ||
      t.phone.includes(q)
    );
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0B0E14", color: "#E2E8F0", fontFamily: "sans-serif", padding: "28px" }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", borderBottom: "1px solid #1E293B", paddingBottom: "16px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 900, color: "#F26B21", margin: 0 }}>KVNS MASTER ADMIN</h1>
          <p style={{ margin: "4px 0 0", color: "#94A3B8", fontSize: "13px" }}>Gerenciador de Oficinas, Vencimentos e Liberação de Recursos</p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={fetchTenants} style={{ background: "#1E293B", color: "#FFF", border: "1px solid #334155", padding: "8px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontWeight: 700 }}>
            <RefreshCw size={14} /> Atualizar
          </button>
          <button onClick={() => setIsNewModalOpen(true)} style={{ background: "#F26B21", color: "#FFF", border: "none", padding: "8px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontWeight: 800 }}>
            <Plus size={16} /> Novo Cliente
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "14px", marginBottom: "24px" }}>
        <div style={{ background: "#151922", padding: "16px", border: "1px solid #1E293B" }}>
          <span style={{ fontSize: "11px", color: "#94A3B8", fontWeight: 700 }}>TOTAL OFICINAS</span>
          <h2 style={{ fontSize: "28px", margin: "6px 0 0", color: "#FFF" }}>{metrics.total}</h2>
        </div>
        <div style={{ background: "#151922", padding: "16px", border: "1px solid #1E293B" }}>
          <span style={{ fontSize: "11px", color: "#10B981", fontWeight: 700 }}>ATIVAS</span>
          <h2 style={{ fontSize: "28px", margin: "6px 0 0", color: "#10B981" }}>{metrics.active}</h2>
        </div>
        <div style={{ background: "#151922", padding: "16px", border: "1px solid #1E293B" }}>
          <span style={{ fontSize: "11px", color: "#3B82F6", fontWeight: 700 }}>EM TESTE (14D)</span>
          <h2 style={{ fontSize: "28px", margin: "6px 0 0", color: "#3B82F6" }}>{metrics.trial}</h2>
        </div>
        <div style={{ background: "#151922", padding: "16px", border: "1px solid #1E293B" }}>
          <span style={{ fontSize: "11px", color: "#EAB308", fontWeight: 700 }}>VENCIDAS</span>
          <h2 style={{ fontSize: "28px", margin: "6px 0 0", color: "#EAB308" }}>{metrics.expired}</h2>
        </div>
        <div style={{ background: "#151922", padding: "16px", border: "1px solid #1E293B" }}>
          <span style={{ fontSize: "11px", color: "#EF4444", fontWeight: 700 }}>BLOQUEADAS</span>
          <h2 style={{ fontSize: "28px", margin: "6px 0 0", color: "#EF4444" }}>{metrics.blocked}</h2>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
        <input
          type="text"
          placeholder="Buscar oficina por nome, e-mail ou WhatsApp..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: 1, padding: "10px 14px", background: "#151922", border: "1px solid #1E293B", color: "#FFF", fontSize: "13px" }}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ padding: "10px 14px", background: "#151922", border: "1px solid #1E293B", color: "#FFF", fontSize: "13px" }}>
          <option value="TODOS">Todos os Status</option>
          <option value="ACTIVE">Ativos</option>
          <option value="TRIAL">Trial (Teste)</option>
          <option value="EXPIRED">Vencidos</option>
          <option value="BLOCKED">Bloqueados</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: "#151922", border: "1px solid #1E293B", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
          <thead>
            <tr style={{ background: "#0F1218", color: "#94A3B8", borderBottom: "1px solid #1E293B" }}>
              <th style={{ padding: "12px 16px" }}>OFICINA / RESPONSÁVEL</th>
              <th style={{ padding: "12px 16px" }}>CONTATO</th>
              <th style={{ padding: "12px 16px" }}>STATUS</th>
              <th style={{ padding: "12px 16px" }}>VENCIMENTO</th>
              <th style={{ padding: "12px 16px" }}>USUÁRIOS / ÚLTIMO LOGIN</th>
              <th style={{ padding: "12px 16px", textAlign: "right" }}>AÇÕES RÁPIDAS</th>
            </tr>
          </thead>
          <tbody>
            {filteredTenants.map((t) => {
              const isExpired = t.expires_at && new Date(t.expires_at) < new Date();
              return (
                <tr key={t.id} style={{ borderBottom: "1px solid #1E293B" }}>
                  <td style={{ padding: "14px 16px" }}>
                    <strong style={{ color: "#FFF" }}>{t.name}</strong>
                    <div style={{ color: "#94A3B8", fontSize: "11px" }}>{t.owner_name} • Plano: {t.plan}</div>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <div>{t.email}</div>
                    <div style={{ color: "#94A3B8", fontSize: "11px" }}>{t.phone}</div>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{
                      padding: "3px 8px",
                      fontSize: "11px",
                      fontWeight: 800,
                      background: t.status === "BLOCKED" ? "#450a0a" : isExpired ? "#422006" : "#064e3b",
                      color: t.status === "BLOCKED" ? "#f87171" : isExpired ? "#facc15" : "#34d399",
                      border: "1px solid currentColor"
                    }}>
                      {t.status === "BLOCKED" ? "BLOQUEADO" : isExpired ? "VENCIDO" : t.status}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    {t.expires_at ? new Date(t.expires_at).toLocaleDateString("pt-BR") : "Sem limite"}
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <div>{t.users_count} operador(es)</div>
                    <div style={{ color: "#64748B", fontSize: "11px" }}>
                      {t.last_login_at ? new Date(t.last_login_at).toLocaleString("pt-BR") : "Nunca acessou"}
                    </div>
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                      <button onClick={() => handleAddDays(t.id, 30)} title="+30 Dias" style={{ background: "#10B981", color: "#FFF", border: "none", padding: "6px 8px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>
                        +30d
                      </button>
                      <button onClick={() => handleAddDays(t.id, 365)} title="+1 Ano" style={{ background: "#059669", color: "#FFF", border: "none", padding: "6px 8px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>
                        +1 ano
                      </button>
                      <button onClick={() => handleToggleBlock(t.id, t.status)} style={{ background: t.status === "BLOCKED" ? "#2563EB" : "#DC2626", color: "#FFF", border: "none", padding: "6px 10px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>
                        {t.status === "BLOCKED" ? "Liberar" : "Bloquear"}
                      </button>
                      <button onClick={() => setSelectedTenant(t)} style={{ background: "#334155", color: "#FFF", border: "none", padding: "6px 10px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>
                        Funções
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Controle de Funções */}
      {selectedTenant && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#151922", border: "1px solid #334155", padding: "24px", maxWidth: "480px", width: "100%" }}>
            <h3 style={{ margin: "0 0 12px", color: "#F26B21" }}>Liberar/Bloquear Recursos: {selectedTenant.name}</h3>
            <p style={{ color: "#94A3B8", fontSize: "12px", marginBottom: "16px" }}>Marque as funções liberadas para este cliente:</p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { key: "ordens_servico", label: "Ordens de Serviço e Orçamentos" },
                { key: "checklist_fotos", label: "Checklist com Fotos da OS" },
                { key: "estoque_pecas", label: "Controle de Estoque & Peças" },
                { key: "pdv_balcao", label: "Frente de Caixa (PDV Balcão)" },
                { key: "financeiro", label: "Financeiro (Contas a Pagar/Receber)" },
                { key: "whatsapp_crm", label: "WhatsApp CRM & Mensagens" },
              ].map((f) => (
                <label key={f.key} style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "13px" }}>
                  <input
                    type="checkbox"
                    checked={selectedTenant.enabled_features?.[f.key] !== false}
                    onChange={() => handleToggleFeature(selectedTenant, f.key)}
                  />
                  <span>{f.label}</span>
                </label>
              ))}
            </div>

            <button onClick={() => setSelectedTenant(null)} style={{ marginTop: "20px", background: "#F26B21", color: "#FFF", border: "none", padding: "10px 16px", width: "100%", fontWeight: 800, cursor: "pointer" }}>
              Salvar e Fechar
            </button>
          </div>
        </div>
      )}

      {/* Modal Criar Novo Cliente */}
      {isNewModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <form onSubmit={handleCreateTenant} style={{ background: "#151922", border: "1px solid #334155", padding: "24px", maxWidth: "480px", width: "100%", display: "flex", flexDirection: "column", gap: "12px" }}>
            <h3 style={{ margin: "0 0 8px", color: "#F26B21" }}>Criar Nova Oficina / Cliente</h3>
            <input required placeholder="Nome da Oficina" value={newName} onChange={e => setNewName(e.target.value)} style={{ padding: "10px", background: "#0F1218", border: "1px solid #334155", color: "#FFF" }} />
            <input required placeholder="Nome do Responsável" value={newOwner} onChange={e => setNewOwner(e.target.value)} style={{ padding: "10px", background: "#0F1218", border: "1px solid #334155", color: "#FFF" }} />
            <input required type="email" placeholder="E-mail de Acesso" value={newEmail} onChange={e => setNewEmail(e.target.value)} style={{ padding: "10px", background: "#0F1218", border: "1px solid #334155", color: "#FFF" }} />
            <input required placeholder="WhatsApp" value={newPhone} onChange={e => setNewPhone(e.target.value)} style={{ padding: "10px", background: "#0F1218", border: "1px solid #334155", color: "#FFF" }} />
            <input required type="password" placeholder="Senha Provisória" value={newPassword} onChange={e => setNewPassword(e.target.value)} style={{ padding: "10px", background: "#0F1218", border: "1px solid #334155", color: "#FFF" }} />
            <label style={{ fontSize: "12px", color: "#94A3B8" }}>Dias de Validade Inicial:</label>
            <input type="number" value={newDays} onChange={e => setNewDays(Number(e.target.value))} style={{ padding: "10px", background: "#0F1218", border: "1px solid #334155", color: "#FFF" }} />

            <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
              <button type="button" onClick={() => setIsNewModalOpen(false)} style={{ flex: 1, padding: "10px", background: "#334155", color: "#FFF", border: "none", cursor: "pointer" }}>Cancelar</button>
              <button type="submit" style={{ flex: 1, padding: "10px", background: "#F26B21", color: "#FFF", border: "none", fontWeight: 800, cursor: "pointer" }}>Criar Oficina</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
```

---

## 🔒 6. Como Funciona o Bloqueio Automático por Vencimento

No sistema da oficina (`app.kvns.com.br`):

1. **Ao fazer Login**:
   - A rota `/api/auth/login` consulta a data `expires_at` do tenant no banco de dados.
   - Se a data atual for maior que `expires_at`, a conta recebe status `"EXPIRED"` e bloqueia o acesso à tela de trabalho, exibindo o botão para falar com você no WhatsApp.
2. **Ao ser Bloqueado Manualmente no Painel Master**:
   - Quando você clica em **"Bloquear"** no Painel Master, o status no banco vira `"BLOCKED"`.
   - Na próxima sincronização ou refresh da página, o operador da oficina é impedido de executar operações.
3. **Ao Renovar (+30d ou +1 ano)**:
   - A data `expires_at` é estendida no banco e o status volta para `"ACTIVE"`.
   - A oficina volta a funcionar instantaneamente sem precisar reinstalar nada.

---

## 🚀 7. Publicando o Painel Master na Vercel

1. Suba o segundo projeto para um novo repositório no seu GitHub (ex: `kvns-painel-master`).
2. Acesse a **Vercel** → **Add New Project** → Importe o repositório.
3. Em **Environment Variables**, adicione a mesma **`POSTGRES_URL`** do banco.
4. Clique em **Deploy**.
5. Pronto! Agora você pode gerenciar todos os seus clientes de qualquer computador ou celular.
