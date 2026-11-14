"use client";

import React, { useEffect } from "react";
import { Ban, Building2, Mail, MessageCircle, Sparkles, Undo2, User, X, Phone, Calendar, Info, CheckCircle2, ArrowRight } from "lucide-react";
import { LeadStatusBadge, OriginBadge } from "@/components/LeadBadges";
import {
  getLeadStatusKey,
  getOriginLabel,
  isMaterialFlowLead,
  leadWhatsAppMessage,
  mailtoLink,
  MATERIAL_LEAD_STATUSES,
  STATUS_LABELS,
  whatsappLink,
  type LeadRecord,
  type MaterialLeadStatus,
} from "@/lib/leads";

interface LeadDetailModalProps {
  lead: LeadRecord;
  busy: boolean;
  onClose: () => void;
  onChangeStatus: (status: MaterialLeadStatus) => void;
  onConvert: () => void;
  onStartApproval: () => void;
  onReject: () => void;
}

const fieldLabel: React.CSSProperties = {
  fontSize: "10.5px",
  color: "var(--text-dim)",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  fontWeight: 700,
  display: "flex",
  alignItems: "center",
  gap: "4px",
};

const fieldValue: React.CSSProperties = {
  fontSize: "13px",
  color: "#E2E8F0",
  marginTop: "2px",
  wordBreak: "break-word",
};

const actionButton = (color: string, solid = false): React.CSSProperties => ({
  background: solid ? color : `${color}1F`,
  color: solid ? "#06080D" : color,
  border: `1px solid ${solid ? color : `${color}59`}`,
  padding: "9px 14px",
  borderRadius: "var(--radius-sm)",
  fontSize: "12.5px",
  fontWeight: 800,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  textDecoration: "none",
});

export default function LeadDetailModal({
  lead,
  busy,
  onClose,
  onChangeStatus,
  onConvert,
  onStartApproval,
  onReject,
}: LeadDetailModalProps) {
  const materialFlow = isMaterialFlowLead(lead);
  const statusKey = getLeadStatusKey(lead);
  const waHref = whatsappLink(lead.phone, leadWhatsAppMessage(lead));
  const mailHref = mailtoLink(lead.email, `GIRAVO – ${getOriginLabel(lead.origin)}`);
  const createdAt = lead.created_at ? new Date(lead.created_at) : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.85)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 115,
        padding: "16px",
      }}
    >
      <div
        className="glass-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Detalhe do lead"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "620px",
          width: "100%",
          maxHeight: "92vh",
          overflowY: "auto",
          padding: "22px",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--border-strong)",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.7)",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {/* Cabeçalho */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: "17px", fontWeight: 800, color: "#FFF", margin: 0, wordBreak: "break-word" }}>
              {lead.workshop_name || lead.name || "Lead sem nome"}
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
              <OriginBadge origin={lead.origin} />
              <LeadStatusBadge lead={lead} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{ background: "transparent", border: "none", color: "var(--text-dim)", padding: "4px", cursor: "pointer" }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Dados de contato */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "12px",
            background: "var(--bg-main)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            padding: "14px",
          }}
        >
          <div>
            <div style={fieldLabel}><User size={11} /> Responsável</div>
            <div style={fieldValue}>{lead.name || "—"}</div>
          </div>
          <div>
            <div style={fieldLabel}><Building2 size={11} /> Oficina</div>
            <div style={fieldValue}>{lead.workshop_name || "—"}</div>
          </div>
          <div>
            <div style={fieldLabel}><Mail size={11} /> E-mail</div>
            <div style={fieldValue}>{lead.email || "—"}</div>
          </div>
          <div>
            <div style={fieldLabel}><Phone size={11} /> Telefone</div>
            <div style={fieldValue}>{lead.phone || "—"}</div>
          </div>
          <div>
            <div style={fieldLabel}><Calendar size={11} /> Recebido em</div>
            <div style={fieldValue}>
              {createdAt && !Number.isNaN(createdAt.getTime())
                ? createdAt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
                : "—"}
            </div>
          </div>
          <div>
            <div style={fieldLabel}>Origem (valor bruto)</div>
            <div style={{ ...fieldValue, fontFamily: "monospace", fontSize: "12px" }}>{lead.origin || "—"}</div>
          </div>
        </div>

        {/* Contato rápido */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {waHref ? (
            <a href={waHref} target="_blank" rel="noopener noreferrer" style={{ ...actionButton("#25D366", true), flex: 1 }}>
              <MessageCircle size={15} />
              <span>Chamar no WhatsApp</span>
            </a>
          ) : (
            <span style={{ ...actionButton("#94A3B8"), flex: 1, cursor: "not-allowed", opacity: 0.6 }}>Sem telefone</span>
          )}
          {mailHref ? (
            <a href={mailHref} style={{ ...actionButton("#38BDF8"), flex: 1 }}>
              <Mail size={15} />
              <span>Enviar e-mail</span>
            </a>
          ) : null}
        </div>

        {/* Observações (texto livre vindo de formulário público: renderizado sempre como texto) */}
        <div>
          <div style={{ ...fieldLabel, marginBottom: "6px" }}>Observações</div>
          <pre
            style={{
              margin: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontFamily: "inherit",
              fontSize: "12.5px",
              lineHeight: 1.55,
              color: "#CBD5E1",
              background: "var(--bg-main)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              padding: "12px 14px",
              maxHeight: "240px",
              overflowY: "auto",
            }}
          >
            {lead.notes || "Sem observações."}
          </pre>
        </div>

        {/* Ações conforme o tipo de lead */}
        {materialFlow ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={fieldLabel}>Status do lead</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "6px" }}>
              {MATERIAL_LEAD_STATUSES.map((st) => {
                const active = statusKey === st;
                return (
                  <button
                    key={st}
                    type="button"
                    disabled={busy || active}
                    onClick={() => onChangeStatus(st)}
                    style={{
                      padding: "8px 10px",
                      fontSize: "12px",
                      fontWeight: active ? 900 : 600,
                      borderRadius: "var(--radius-sm)",
                      border: active ? "1px solid var(--primary)" : "1px solid var(--border-subtle)",
                      background: active ? "rgba(158, 232, 36, 0.15)" : "var(--bg-card-subtle)",
                      color: active ? "var(--primary)" : "var(--text-muted)",
                      cursor: busy || active ? "default" : "pointer",
                      opacity: busy && !active ? 0.6 : 1,
                    }}
                  >
                    {active && <CheckCircle2 size={12} style={{ marginRight: 4, verticalAlign: "-2px" }} />}
                    {STATUS_LABELS[st]}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={onConvert}
              style={{ ...actionButton("#9EE824", true), opacity: busy ? 0.6 : 1, cursor: busy ? "wait" : "pointer" }}
            >
              <Sparkles size={15} />
              <span>Converter em teste grátis</span>
              <ArrowRight size={14} />
            </button>

            <div style={{ display: "flex", gap: "8px", fontSize: "11.5px", color: "var(--text-dim)", alignItems: "flex-start" }}>
              <Info size={13} style={{ flexShrink: 0, marginTop: "1px" }} />
              <span>
                Este lead ainda não tem oficina vinculada. Aprovar teste, gerar senha e ativar a oficina ficam
                disponíveis depois de converter em teste grátis.
              </span>
            </div>
          </div>
        ) : statusKey === "PENDING" ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            <button type="button" disabled={busy} onClick={onStartApproval} style={{ ...actionButton("#9EE824", true), flex: 1 }}>
              <Sparkles size={15} />
              <span>Aprovar & gerar acesso</span>
            </button>
            <button type="button" disabled={busy} onClick={onReject} style={actionButton("#F87171")}>
              <Ban size={14} />
              <span>Recusar</span>
            </button>
          </div>
        ) : statusKey === "REJECTED" ? (
          <div style={{ fontSize: "12px", color: "var(--text-dim)", display: "flex", gap: "6px", alignItems: "center" }}>
            <Undo2 size={13} /> Solicitação recusada. Use “Reabrir” na lista para voltar à aprovação.
          </div>
        ) : null}
      </div>
    </div>
  );
}
