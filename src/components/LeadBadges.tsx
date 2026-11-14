"use client";

import React from "react";
import { getLeadStatusKey, getOriginLabel, STATUS_LABELS, TRIAL_ORIGIN, type LeadLike, type LeadStatusKey } from "@/lib/leads";

const ORIGIN_COLORS: Record<string, string> = {
  [TRIAL_ORIGIN]: "#38BDF8",
  material_calculadora_hora: "#FBBF24",
  material_modelo_os: "#A78BFA",
  material_checklist_entrada: "#34D399",
};

const STATUS_COLORS: Record<LeadStatusKey, string> = {
  PENDING: "#9EE824",
  APPROVED: "#10B981",
  REJECTED: "#F87171",
  NEW: "#38BDF8",
  CONTACTED: "#FBBF24",
  CONVERTED: "#10B981",
  DISCARDED: "#94A3B8",
  OTHER: "#94A3B8",
};

function pillStyle(color: string): React.CSSProperties {
  return {
    background: `${color}26`,
    color,
    border: `1px solid ${color}59`,
    padding: "2px 8px",
    borderRadius: "var(--radius-sm)",
    fontSize: "11px",
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    whiteSpace: "nowrap",
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
}

export function OriginBadge({ origin }: { origin?: string | null }) {
  const color = (origin && ORIGIN_COLORS[origin]) || "#94A3B8";
  const label = getOriginLabel(origin);
  return (
    <span style={pillStyle(color)} title={origin || undefined}>
      {label}
    </span>
  );
}

export function LeadStatusBadge({ lead }: { lead: LeadLike }) {
  const key = getLeadStatusKey(lead);
  const color = STATUS_COLORS[key];
  const label = key === "OTHER" ? lead.status || "Sem status" : STATUS_LABELS[key];
  return (
    <span style={{ ...pillStyle(color), borderRadius: "var(--radius-full)", fontWeight: 800, textTransform: "uppercase" }}>
      {label}
    </span>
  );
}
