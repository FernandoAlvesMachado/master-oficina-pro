import { NextRequest, NextResponse } from "next/server";
import { query, isDbConfigured, getMockLeads, setMockLeads } from "@/lib/db";

export async function GET() {
  if (isDbConfigured()) {
    try {
      const leads = await query(`
        SELECT id, tenant_id, name, workshop_name, email, phone, status, origin, notes, created_at
        FROM leads
        ORDER BY created_at DESC
        LIMIT 100
      `);
      return NextResponse.json({ success: true, leads });
    } catch (err: any) {
      console.warn("DB leads error, fallback to mock:", err.message);
    }
  }

  return NextResponse.json({ success: true, leads: getMockLeads() });
}

export async function PATCH(req: NextRequest) {
  try {
    const { leadId, status } = await req.json();

    if (isDbConfigured()) {
      try {
        await query(`UPDATE leads SET status = $1 WHERE id = $2`, [status, leadId]);
        return NextResponse.json({ success: true });
      } catch (err: any) {
        console.warn("DB update lead error:", err.message);
      }
    }

    const leads = getMockLeads().map((l) => (l.id === leadId ? { ...l, status } : l));
    setMockLeads(leads);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
