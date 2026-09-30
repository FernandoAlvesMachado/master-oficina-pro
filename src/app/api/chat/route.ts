import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuth } from "@/lib/auth";
import { query, isDbConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export interface ChatMessage {
  id: string;
  tenantId: string;
  sender: "MASTER" | "CLIENT";
  senderName: string;
  text: string;
  timestamp: string;
  read: boolean;
}

export interface ChatThread {
  tenantId: string;
  status: "OPEN" | "ARCHIVED";
  archivedAt?: string | null;
  lastMessageAt?: string | null;
}

// In-memory fallback if database is not reachable
let inMemoryChatStore: ChatMessage[] = [];
let inMemoryThreadsStore: Record<string, ChatThread> = {};

// Helper para cabeçalhos CORS
function setCorsHeaders(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-tenant-id");
  return response;
}

export async function OPTIONS() {
  const response = NextResponse.json({ success: true });
  return setCorsHeaders(response);
}

export async function GET(req: NextRequest) {
  const isMaster = await verifyRequestAuth(req);
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");

  // Se não for master autenticado, exige tenantId para proteger privacidade de outras oficinas
  if (!isMaster && !tenantId) {
    const res = NextResponse.json({ success: false, error: "Acesso não autorizado." }, { status: 401 });
    return setCorsHeaders(res);
  }

  try {
    if (isDbConfigured()) {
      // Garante que as tabelas existem
      await query(`
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

        CREATE TABLE IF NOT EXISTS chat_threads (
          tenant_id VARCHAR(64) PRIMARY KEY,
          status VARCHAR(20) DEFAULT 'OPEN',
          archived_at TIMESTAMPTZ,
          archived_by VARCHAR(50) DEFAULT 'MASTER',
          last_message_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      let messageRows: any[] = [];
      let threadRows: any[] = [];

      if (tenantId) {
        messageRows = await query(
          `SELECT id, tenant_id as "tenantId", sender, sender_name as "senderName", text, created_at as "timestamp", read
           FROM chat_messages
           WHERE tenant_id = $1
           ORDER BY created_at ASC`,
          [tenantId]
        );
        threadRows = await query(
          `SELECT tenant_id as "tenantId", status, archived_at as "archivedAt", last_message_at as "lastMessageAt"
           FROM chat_threads
           WHERE tenant_id = $1`,
          [tenantId]
        );
      } else {
        // Master buscando todas as conversas e todos os status
        messageRows = await query(
          `SELECT id, tenant_id as "tenantId", sender, sender_name as "senderName", text, created_at as "timestamp", read
           FROM chat_messages
           ORDER BY created_at ASC`
        );
        threadRows = await query(
          `SELECT tenant_id as "tenantId", status, archived_at as "archivedAt", last_message_at as "lastMessageAt"
           FROM chat_threads`
        );
      }

      // Converte threads para dicionário { [tenantId]: ChatThread }
      const threadsMap: Record<string, ChatThread> = {};
      threadRows.forEach((r) => {
        threadsMap[r.tenantId] = {
          tenantId: r.tenantId,
          status: r.status || "OPEN",
          archivedAt: r.archivedAt,
          lastMessageAt: r.lastMessageAt,
        };
      });

      const res = NextResponse.json({ success: true, messages: messageRows, threads: threadsMap });
      return setCorsHeaders(res);
    }
  } catch (err: any) {
    console.error("[CHAT DB GET ERROR]", err?.message);
  }

  // Fallback em memória
  const filtered = tenantId
    ? inMemoryChatStore.filter((m) => m.tenantId === tenantId)
    : inMemoryChatStore;

  const res = NextResponse.json({ success: true, messages: filtered, threads: inMemoryThreadsStore });
  return setCorsHeaders(res);
}

export async function POST(req: NextRequest) {
  try {
    const isMaster = await verifyRequestAuth(req);
    const body = await req.json();
    const { tenantId, sender = "MASTER", senderName = "Suporte Master KVNS", text } = body;

    // Se tentar enviar como MASTER mas não for autenticado
    if (sender === "MASTER" && !isMaster) {
      const res = NextResponse.json({ success: false, error: "Apenas o Master pode enviar como MASTER." }, { status: 401 });
      return setCorsHeaders(res);
    }

    if (!tenantId || !text || !text.trim()) {
      const res = NextResponse.json(
        { success: false, error: "tenantId e texto são obrigatórios." },
        { status: 400 }
      );
      return setCorsHeaders(res);
    }

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      tenantId,
      sender: sender === "CLIENT" ? "CLIENT" : "MASTER",
      senderName: senderName || (sender === "CLIENT" ? "Cliente Oficina" : "Suporte Master KVNS"),
      text: text.trim(),
      timestamp: new Date().toISOString(),
      read: sender === "MASTER",
    };

    if (isDbConfigured()) {
      await query(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id VARCHAR(64) PRIMARY KEY,
          tenant_id VARCHAR(64) NOT NULL,
          sender VARCHAR(20) NOT NULL,
          sender_name VARCHAR(255),
          text TEXT NOT NULL,
          read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS chat_threads (
          tenant_id VARCHAR(64) PRIMARY KEY,
          status VARCHAR(20) DEFAULT 'OPEN',
          archived_at TIMESTAMPTZ,
          archived_by VARCHAR(50) DEFAULT 'MASTER',
          last_message_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // Insere a mensagem
      await query(
        `INSERT INTO chat_messages (id, tenant_id, sender, sender_name, text, read, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          newMessage.id,
          newMessage.tenantId,
          newMessage.sender,
          newMessage.senderName,
          newMessage.text,
          newMessage.read,
          newMessage.timestamp,
        ]
      );

      // Regra de Ouro: Chegou mensagem nova -> Reabre o atendimento automaticamente para "OPEN"
      await query(
        `INSERT INTO chat_threads (tenant_id, status, last_message_at, updated_at)
         VALUES ($1, 'OPEN', NOW(), NOW())
         ON CONFLICT (tenant_id)
         DO UPDATE SET status = 'OPEN', last_message_at = NOW(), updated_at = NOW()`,
        [newMessage.tenantId]
      );
    } else {
      inMemoryChatStore.push(newMessage);
      inMemoryThreadsStore[newMessage.tenantId] = {
        tenantId: newMessage.tenantId,
        status: "OPEN",
        lastMessageAt: newMessage.timestamp,
      };
    }

    const res = NextResponse.json({
      success: true,
      message: newMessage,
      threadStatus: "OPEN",
    });
    return setCorsHeaders(res);
  } catch (err: any) {
    const res = NextResponse.json({ success: false, error: err.message }, { status: 500 });
    return setCorsHeaders(res);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const isMaster = await verifyRequestAuth(req);
    const body = await req.json();
    const { tenantId, action, markAllRead = true } = body;

    if (!tenantId) {
      const res = NextResponse.json({ success: false, error: "tenantId é obrigatório." }, { status: 400 });
      return setCorsHeaders(res);
    }

    if (isDbConfigured()) {
      await query(`
        CREATE TABLE IF NOT EXISTS chat_threads (
          tenant_id VARCHAR(64) PRIMARY KEY,
          status VARCHAR(20) DEFAULT 'OPEN',
          archived_at TIMESTAMPTZ,
          archived_by VARCHAR(50) DEFAULT 'MASTER',
          last_message_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      // Ação: Finalizar / Arquivar atendimento
      if (action === "join_queue") {
        await query(
          `INSERT INTO chat_threads (tenant_id, status, queue_joined_at, updated_at)
           VALUES ($1, 'QUEUE', NOW(), NOW())
           ON CONFLICT (tenant_id)
           DO UPDATE SET status = 'QUEUE', queue_joined_at = NOW(), updated_at = NOW()`,
          [tenantId]
        );
        const res = NextResponse.json({ success: true, status: "QUEUE" });
        return setCorsHeaders(res);
      }

      if (action === "accept") {
        await query(
          `INSERT INTO chat_threads (tenant_id, status, accepted_at, updated_at)
           VALUES ($1, 'OPEN', NOW(), NOW())
           ON CONFLICT (tenant_id)
           DO UPDATE SET status = 'OPEN', accepted_at = NOW(), updated_at = NOW()`,
          [tenantId]
        );
        const res = NextResponse.json({ success: true, status: "OPEN" });
        return setCorsHeaders(res);
      }

      if (action === "archive") {
        if (!isMaster) {
          const res = NextResponse.json({ success: false, error: "Apenas Master pode finalizar atendimentos." }, { status: 401 });
          return setCorsHeaders(res);
        }

        // Marca como ARCHIVED e zera mensagens não lidas
        await query(
          `INSERT INTO chat_threads (tenant_id, status, archived_at, archived_by, updated_at)
           VALUES ($1, 'ARCHIVED', NOW(), 'MASTER', NOW())
           ON CONFLICT (tenant_id)
           DO UPDATE SET status = 'ARCHIVED', archived_at = NOW(), archived_by = 'MASTER', updated_at = NOW()`,
          [tenantId]
        );

        await query(
          `UPDATE chat_messages SET read = TRUE WHERE tenant_id = $1`,
          [tenantId]
        );

        const res = NextResponse.json({ success: true, status: "ARCHIVED" });
        return setCorsHeaders(res);
      }

      // Ação: Reabrir atendimento manualmente
      if (action === "reopen") {
        await query(
          `INSERT INTO chat_threads (tenant_id, status, updated_at)
           VALUES ($1, 'OPEN', NOW())
           ON CONFLICT (tenant_id)
           DO UPDATE SET status = 'OPEN', updated_at = NOW()`,
          [tenantId]
        );
        const res = NextResponse.json({ success: true, status: "OPEN" });
        return setCorsHeaders(res);
      }

      // Ação padrão: Marcar como lido
      await query(
        `UPDATE chat_messages SET read = TRUE WHERE tenant_id = $1 AND sender = 'CLIENT'`,
        [tenantId]
      );
    } else {
      if (action === "archive") {
        inMemoryThreadsStore[tenantId] = {
          tenantId,
          status: "ARCHIVED",
          archivedAt: new Date().toISOString(),
        };
        inMemoryChatStore = inMemoryChatStore.map((m) =>
          m.tenantId === tenantId ? { ...m, read: true } : m
        );
      } else if (action === "reopen") {
        inMemoryThreadsStore[tenantId] = {
          tenantId,
          status: "OPEN",
        };
      } else {
        inMemoryChatStore = inMemoryChatStore.map((m) =>
          m.tenantId === tenantId && m.sender === "CLIENT" ? { ...m, read: true } : m
        );
      }
    }

    const res = NextResponse.json({ success: true });
    return setCorsHeaders(res);
  } catch (err: any) {
    const res = NextResponse.json({ success: false, error: err.message }, { status: 500 });
    return setCorsHeaders(res);
  }
}
