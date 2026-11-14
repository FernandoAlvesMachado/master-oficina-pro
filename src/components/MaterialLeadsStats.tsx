"use client";

import React from "react";
import { FileText, ArrowRight } from "lucide-react";
import { MATERIAL_ORIGINS, type MaterialLeadStat, type MaterialOrigin, type OriginFilter } from "@/lib/leads";

interface MaterialLeadsStatsProps {
  stats: MaterialLeadStat[];
  onOpen: (filter: OriginFilter) => void;
}

/** Contadores de leads de material gratuito por origem (últimos 7 e 30 dias). */
export default function MaterialLeadsStats({ stats, onOpen }: MaterialLeadsStatsProps) {
  const byOrigin = new Map(stats.map((s) => [s.origin, s]));
  const knownOrigins = Object.keys(MATERIAL_ORIGINS) as MaterialOrigin[];
  // Origens de material desconhecidas (ex.: um material novo na landing) também aparecem, com o valor bruto.
  const unknownOrigins = stats.map((s) => s.origin).filter((o) => !(o in MATERIAL_ORIGINS));
  const rows = [...knownOrigins, ...unknownOrigins];
  const total7 = stats.reduce((acc, s) => acc + (s.last7 || 0), 0);
  const total30 = stats.reduce((acc, s) => acc + (s.last30 || 0), 0);

  return (
    <div className="glass-panel" style={{ padding: "18px", borderRadius: "var(--radius-md)", marginBottom: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <FileText size={16} color="var(--primary)" />
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#FFF" }}>Leads de materiais gratuitos</h3>
        </div>
        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
          <strong style={{ color: "#FFF" }}>{total7}</strong> em 7 dias · <strong style={{ color: "#FFF" }}>{total30}</strong> em 30 dias
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
        {rows.map((origin) => {
          const stat = byOrigin.get(origin);
          const known = MATERIAL_ORIGINS[origin as MaterialOrigin];
          const filter = (known ? origin : "ALL") as OriginFilter;
          return (
            <button
              key={origin}
              type="button"
              onClick={() => onOpen(filter)}
              title="Ver estes leads"
              style={{
                textAlign: "left",
                background: "var(--bg-card-subtle)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                padding: "12px 14px",
                cursor: "pointer",
                color: "inherit",
              }}
            >
              <div style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 700, display: "flex", justifyContent: "space-between", gap: "6px" }}>
                <span>{known ? known.label : origin}</span>
                <ArrowRight size={13} color="var(--text-dim)" style={{ flexShrink: 0 }} />
              </div>
              <div style={{ display: "flex", gap: "18px", marginTop: "8px" }}>
                <div>
                  <div style={{ fontSize: "22px", fontWeight: 900, color: "#FFF", lineHeight: 1 }}>{stat?.last7 ?? 0}</div>
                  <div style={{ fontSize: "10.5px", color: "var(--text-dim)", marginTop: "3px" }}>últimos 7 dias</div>
                </div>
                <div>
                  <div style={{ fontSize: "22px", fontWeight: 900, color: "var(--text-muted)", lineHeight: 1 }}>{stat?.last30 ?? 0}</div>
                  <div style={{ fontSize: "10.5px", color: "var(--text-dim)", marginTop: "3px" }}>últimos 30 dias</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
