import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuth } from "@/lib/auth";
import { ensureTablesOnce, query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ChatStatus = "OPEN" | "ARCHIVED" | "QUEUE";

type ChatMessage = {
  id: string;
  tenantId: string;
  sender: "MASTER" | "CLIENT";
  senderName: string;
  text: string;
  timestamp: string;
  read: boolean;
};

async function requireMaster(req: NextRequest) {
  if (!(await verifyRequestAuth(req))) {
    return NextResponse.json({ success: false, error: "Acesso não autorizado." }, { status: 401 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const denied = await requireMaster(req);
  if (denied) return denied;
  await ensureTablesOnce();

  const tenantId = new URL(req.url).searchParams.get("tenantId");

  try {
    const messageRows = tenantId
      ? await query(
          `SELECT id, tenant_id as "tenantId", sender, sender_name as "senderName", text, created_at as "timestamp", read
           FROM chat_messages
           WHERE tenant_id = $1
           ORDER BY created_at ASC`,
          [tenantId]
        )
      : await query(
          `SELECT id, tenant_id as "tenantId", sender, sender_name as "senderName", text, created_at as "timestamp", read
           FROM chat_messages
           ORDER BY created_at ASC`
        );

    const threadRows = tenantId
      ? await query(
          `SELECT tenant_id as "tenantId", status, queue_joined_at as "queueJoinedAt", accepted_at as "acceptedAt", archived_at as "archivedAt", last_message_at as "lastMessageAt"
           FROM chat_threads
           WHERE tenant_id = $1`,
          [tenantId]
        )
      : await query(
          `SELECT tenant_id as "tenantId", status, queue_joined_at as "queueJoinedAt", accepted_at as "acceptedAt", archived_at as "archivedAt", last_message_at as "lastMessageAt"
           FROM chat_threads`
        );

    const messages: ChatMessage[] = messageRows.map((m: any) => ({
      id: String(m.id),
      tenantId: String(m.tenantId),
      sender: m.sender === "MASTER" ? "MASTER" : "CLIENT",
      senderName: String(m.senderName || (m.sender === "MASTER" ? "Suporte Master GIRAVO" : "Cliente Oficina")),
      text: String(m.text || ""),
      timestamp: m.timestamp ? new Date(m.timestamp).toISOString() : new Date().toISOString(),
      read: Boolean(m.read),
    }));

    const threads: Record<string, any> = {};
    for (const row of threadRows) {
      threads[row.tenantId] = {
        tenantId: row.tenantId,
        status: ["OPEN", "ARCHIVED", "QUEUE"].includes(row.status) ? row.status : "OPEN",
        archivedAt: row.archivedAt ? new Date(row.archivedAt).toISOString() : null,
        lastMessageAt: row.lastMessageAt ? new Date(row.lastMessageAt).toISOString() : null,
        queueJoinedAt: row.queueJoinedAt ? new Date(row.queueJoinedAt).toISOString() : null,
        acceptedAt: row.acceptedAt ? new Date(row.acceptedAt).toISOString() : null,
      };
    }

    return NextResponse.json({ success: true, messages, threads });
  } catch (err: any) {
    console.error("[MASTER CHAT GET ERROR]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireMaster(req);
  if (denied) return denied;
  await ensureTablesOnce();

  const body = await req.json();
  const tenantId = String(body.tenantId || "").trim();
  const text = String(body.text || "").trim();
  if (!tenantId || !text) {
    return NextResponse.json({ success: false, error: "tenantId e texto são obrigatórios." }, { status: 400 });
  }
  if (text.length > 5000) {
    return NextResponse.json({ success: false, error: "Mensagem excede o limite de 5.000 caracteres." }, { status: 400 });
  }

  const messageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = new Date().toISOString();
  const sender = "MASTER";
  const senderName = String(body.senderName || "Suporte Master GIRAVO").slice(0, 255);

  try {
    // 1. Grava diretamente na tabela oficial chat_messages (que a oficina lê)
    await query(
      `INSERT INTO chat_messages (id, tenant_id, sender, sender_name, text, read, created_at)
       VALUES ($1, $2, $3, $4, $5, true, $6)`,
      [messageId, tenantId, sender, senderName, text, timestamp]
    );

    // 2. Garante thread aberta e atualiza last_message_at no chat_threads
    await query(
      `INSERT INTO chat_threads (tenant_id, status, accepted_at, last_message_at, updated_at)
       VALUES ($1, 'OPEN', NOW(), NOW(), NOW())
       ON CONFLICT (tenant_id)
       DO UPDATE SET
         status = 'OPEN',
         accepted_at = COALESCE(chat_threads.accepted_at, NOW()),
         last_message_at = NOW(),
         updated_at = NOW()`,
      [tenantId]
    );

    const message: ChatMessage = {
      id: messageId,
      tenantId,
      sender,
      senderName,
      text,
      timestamp,
      read: true,
    };

    // 3. Atualiza espelho em tenant_store para compatibilidade caso o registro exista
    try {
      await query(
        `UPDATE tenant_store
         SET chat_data = jsonb_set(
           jsonb_set(COALESCE(chat_data, '{"messages":[],"status":"OPEN"}'::jsonb), '{messages}',
             (COALESCE(chat_data->'messages', '[]'::jsonb) || $2::jsonb), true),
           '{status}', '"OPEN"'::jsonb, true
         ) || jsonb_build_object('lastMessageAt', $3::text), updated_at = NOW()
         WHERE tenant_id = $1`,
        [tenantId, JSON.stringify([message]), timestamp]
      );
    } catch {
      // Ignora erro no espelho se tenant_store não existir para esse tenant
    }

    return NextResponse.json({ success: true, message, threadStatus: "OPEN" });
  } catch (err: any) {
    console.error("[MASTER CHAT POST ERROR]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireMaster(req);
  if (denied) return denied;
  await ensureTablesOnce();

  const { tenantId, action } = await req.json();
  if (!tenantId) {
    return NextResponse.json({ success: false, error: "tenantId é obrigatório." }, { status: 400 });
  }

  let newStatus: ChatStatus = "OPEN";

  try {
    if (action === "archive") {
      newStatus = "ARCHIVED";
      await query(
        `INSERT INTO chat_threads (tenant_id, status, archived_at, archived_by, updated_at)
         VALUES ($1, 'ARCHIVED', NOW(), 'MASTER', NOW())
         ON CONFLICT (tenant_id)
         DO UPDATE SET status = 'ARCHIVED', archived_at = NOW(), archived_by = 'MASTER', updated_at = NOW()`,
        [tenantId]
      );
      await query(`UPDATE chat_messages SET read = TRUE WHERE tenant_id = $1`, [tenantId]);
    } else if (action === "accept") {
      newStatus = "OPEN";
      await query(
        `INSERT INTO chat_threads (tenant_id, status, accepted_at, updated_at)
         VALUES ($1, 'OPEN', NOW(), NOW())
         ON CONFLICT (tenant_id)
         DO UPDATE SET status = 'OPEN', accepted_at = NOW(), updated_at = NOW()`,
        [tenantId]
      );
    } else if (action === "reopen") {
      newStatus = "OPEN";
      await query(
        `INSERT INTO chat_threads (tenant_id, status, archived_at, updated_at)
         VALUES ($1, 'OPEN', NULL, NOW())
         ON CONFLICT (tenant_id)
         DO UPDATE SET status = 'OPEN', archived_at = NULL, updated_at = NOW()`,
        [tenantId]
      );
    } else if (action === "join_queue") {
      newStatus = "QUEUE";
      await query(
        `INSERT INTO chat_threads (tenant_id, status, queue_joined_at, updated_at)
         VALUES ($1, 'QUEUE', NOW(), NOW())
         ON CONFLICT (tenant_id)
         DO UPDATE SET status = 'QUEUE', queue_joined_at = NOW(), updated_at = NOW()`,
        [tenantId]
      );
    } else {
      // Ação padrão: marcar mensagens do cliente como lidas pelo Master
      await query(
        `UPDATE chat_messages SET read = TRUE WHERE tenant_id = $1 AND sender = 'CLIENT'`,
        [tenantId]
      );
    }

    // Atualiza espelho jsonb em tenant_store se existir
    try {
      await query(
        `UPDATE tenant_store
         SET chat_data = jsonb_set(
           COALESCE(chat_data, '{"messages":[],"status":"OPEN"}'::jsonb),
           '{status}',
           to_jsonb($2::text),
           true
         ), updated_at = NOW()
         WHERE tenant_id = $1`,
        [tenantId, newStatus]
      );
    } catch {
      // Ignora erro no espelho
    }

    return NextResponse.json({ success: true, status: newStatus });
  } catch (err: any) {
    console.error("[MASTER CHAT PATCH ERROR]", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

