import crypto from "crypto";
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

type ChatData = {
  messages: ChatMessage[];
  status: ChatStatus;
  archivedAt?: string | null;
  lastMessageAt?: string | null;
  acceptedAt?: string | null;
};

const emptyChat = (): ChatData => ({ messages: [], status: "OPEN" });

function normalizeChat(value: unknown): ChatData {
  const raw = value && typeof value === "object" ? (value as Partial<ChatData>) : {};
  return {
    ...raw,
    messages: Array.isArray(raw.messages) ? raw.messages.slice(-1000) : [],
    status: ["OPEN", "ARCHIVED", "QUEUE"].includes(String(raw.status))
      ? (raw.status as ChatStatus)
      : "OPEN",
  };
}

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
  const rows = tenantId
    ? await query(`SELECT tenant_id, chat_data FROM tenant_store WHERE tenant_id = $1`, [tenantId])
    : await query(`SELECT tenant_id, chat_data FROM tenant_store`);

  const messages: ChatMessage[] = [];
  const threads: Record<string, any> = {};
  for (const row of rows) {
    const chat = normalizeChat(row.chat_data);
    messages.push(...chat.messages);
    threads[row.tenant_id] = {
      tenantId: row.tenant_id,
      status: chat.status,
      archivedAt: chat.archivedAt || null,
      lastMessageAt: chat.lastMessageAt || null,
    };
  }
  messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return NextResponse.json({ success: true, messages, threads });
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

  const message: ChatMessage = {
    id: `msg-${crypto.randomUUID()}`,
    tenantId,
    sender: "MASTER",
    senderName: String(body.senderName || "Suporte Master GIRAVO").slice(0, 255),
    text,
    timestamp: new Date().toISOString(),
    read: true,
  };
  const updated = await query(
    `UPDATE tenant_store
     SET chat_data = jsonb_set(
       jsonb_set(COALESCE(chat_data, $2::jsonb), '{messages}',
         (COALESCE(chat_data->'messages', '[]'::jsonb) || $3::jsonb), true),
       '{status}', '"OPEN"'::jsonb, true
     ) || jsonb_build_object('lastMessageAt', $4::text), updated_at = NOW()
     WHERE tenant_id = $1 RETURNING tenant_id`,
    [tenantId, JSON.stringify(emptyChat()), JSON.stringify([message]), message.timestamp]
  );
  if (!updated.length) {
    return NextResponse.json({ success: false, error: "Conta não encontrada." }, { status: 404 });
  }
  return NextResponse.json({ success: true, message, threadStatus: "OPEN" });
}

export async function PATCH(req: NextRequest) {
  const denied = await requireMaster(req);
  if (denied) return denied;
  await ensureTablesOnce();

  const { tenantId, action } = await req.json();
  if (!tenantId) {
    return NextResponse.json({ success: false, error: "tenantId é obrigatório." }, { status: 400 });
  }

  const rows = await query(`SELECT chat_data FROM tenant_store WHERE tenant_id = $1`, [tenantId]);
  if (!rows.length) return NextResponse.json({ success: false, error: "Conta não encontrada." }, { status: 404 });
  const chat = normalizeChat(rows[0].chat_data);
  const now = new Date().toISOString();

  if (action === "archive") {
    chat.status = "ARCHIVED";
    chat.archivedAt = now;
    chat.messages = chat.messages.map((message) => ({ ...message, read: true }));
  } else if (action === "reopen" || action === "accept") {
    chat.status = "OPEN";
    chat.archivedAt = null;
    if (action === "accept") chat.acceptedAt = now;
  } else if (action === "join_queue") {
    chat.status = "QUEUE";
  } else {
    chat.messages = chat.messages.map((message) =>
      message.sender === "CLIENT" ? { ...message, read: true } : message
    );
  }

  await query(`UPDATE tenant_store SET chat_data = $2::jsonb, updated_at = NOW() WHERE tenant_id = $1`, [
    tenantId,
    JSON.stringify(chat),
  ]);
  return NextResponse.json({ success: true, status: chat.status });
}
