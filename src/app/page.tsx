"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  Users,
  CheckCircle2,
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
  MessageSquare,
  KeyRound,
  Database,
  Check,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  Briefcase,
  Layers,
  Wrench,
  Camera,
  Package,
  ShoppingCart,
  DollarSign,
  Send,
  BarChart3,
  X,
  LogOut,
  Info,
  CalendarDays,
  Copy,
  Trash2,
  Phone,
  Mail,
  UserCheck,
  Building2,
} from "lucide-react";

interface Tenant {
  id: string;
  name: string;
  owner_name: string;
  email: string;
  phone: string;
  plan: string;
  status: "TRIAL" | "ACTIVE" | "BLOCKED" | "EXPIRED";
  trial_until?: string | null;
  expires_at: string | null;
  created_at: string;
  users_count: number;
  last_login_at: string | null;
  enabled_features: Record<string, boolean>;
  company_settings?: Record<string, any>;
}

interface Lead {
  id: string;
  tenant_id?: string;
  name: string;
  workshop_name: string;
  email: string;
  phone: string;
  status: string;
  origin: string;
  notes?: string;
  created_at: string;
}

export default function MasterDashboard() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [masterPassword, setMasterPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Data states
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [metrics, setMetrics] = useState({
    total: 0,
    active: 0,
    trial: 0,
    expired: 0,
    blocked: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"tenants" | "leads" | "guide">("tenants");
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [dbSource, setDbSource] = useState("");

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [planFilter, setPlanFilter] = useState("TODOS");

  // Modals
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [featuresModalTenant, setFeaturesModalTenant] = useState<Tenant | null>(null);
  const [passwordModalTenant, setPasswordModalTenant] = useState<Tenant | null>(null);
  const [calendarModalTenant, setCalendarModalTenant] = useState<Tenant | null>(null);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [actionMenuTenantId, setActionMenuTenantId] = useState<string | null>(null);

  // DB diagnostic modal state
  const [dbDiagData, setDbDiagData] = useState<any>(null);
  const [dbDiagLoading, setDbDiagLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

  // Form states
  const [newName, setNewName] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("123456");
  const [newPlan, setNewPlan] = useState("PRO");
  const [newDays, setNewDays] = useState(30);

  // Password reset state
  const [resetPasswordValue, setResetPasswordValue] = useState("");

  // Exact date state
  const [exactDateValue, setExactDateValue] = useState("");

  // Toast notification
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/auth");
      const data = await res.json();
      if (data.authenticated) {
        setIsAuthenticated(true);
        fetchTenants();
        fetchLeads();
      } else {
        setIsAuthenticated(false);
      }
    } catch {
      setIsAuthenticated(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: masterPassword }),
      });
      const data = await res.json();

      if (data.success) {
        setIsAuthenticated(true);
        fetchTenants();
        fetchLeads();
        showToast("Bem-vindo ao KVNS Master Admin!", "success");
      } else {
        setAuthError(data.error || "Senha inválida.");
      }
    } catch {
      setAuthError("Erro ao autenticar. Tente novamente.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    setIsAuthenticated(false);
    setMasterPassword("");
  };

  // Fetch tenants
  const fetchTenants = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tenants");
      const data = await res.json();
      if (data.success) {
        setTenants(data.tenants || []);
        setMetrics(data.metrics || { total: 0, active: 0, trial: 0, expired: 0, blocked: 0 });
        setIsDemoMode(Boolean(data.isDemoMode));
        setDbSource(data.dbSource || "");
      }
    } catch (err: any) {
      showToast("Erro ao carregar oficinas: " + err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Fetch leads
  const fetchLeads = async () => {
    try {
      const res = await fetch("/api/leads");
      const data = await res.json();
      if (data.success) {
        setLeads(data.leads || []);
      }
    } catch (err) {
      console.warn("Error fetching leads:", err);
    }
  };

  // Fetch DB diagnostics
  const fetchDbDiag = async () => {
    setDbDiagLoading(true);
    try {
      const res = await fetch("/api/db-status");
      const data = await res.json();
      setDbDiagData(data);
    } catch (err: any) {
      setDbDiagData({ connected: false, error: err.message });
    } finally {
      setDbDiagLoading(false);
    }
  };

  const handleSyncTables = async () => {
    setSyncLoading(true);
    try {
      const res = await fetch("/api/db-status", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        showToast("Tabelas sincronizadas no PostgreSQL com sucesso!", "success");
        fetchDbDiag();
        fetchTenants();
      } else {
        showToast("Falha ao sincronizar: " + (data.error || data.message), "error");
      }
    } catch (err: any) {
      showToast("Erro: " + err.message, "error");
    } finally {
      setSyncLoading(false);
    }
  };

  // Create tenant
  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          ownerName: newOwner,
          email: newEmail,
          phone: newPhone,
          password: newPassword,
          plan: newPlan,
          daysValid: newDays,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setIsNewModalOpen(false);
        setNewName("");
        setNewOwner("");
        setNewEmail("");
        setNewPhone("");
        setNewPassword("123456");
        showToast(`Oficina "${newName}" cadastrada com sucesso!`, "success");
        fetchTenants();
      } else {
        showToast(data.error || "Erro ao criar oficina", "error");
      }
    } catch (err: any) {
      showToast("Erro: " + err.message, "error");
    }
  };

  // Add days (+30d, +1 ano)
  const handleAddDays = async (tenantId: string, days: number, tenantName: string) => {
    try {
      const res = await fetch("/api/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, addDays: days, status: "ACTIVE" }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`+${days} dias adicionados para "${tenantName}"!`, "success");
        fetchTenants();
      }
    } catch (err: any) {
      showToast("Erro ao estender validade: " + err.message, "error");
    }
  };

  // Set exact expiration date
  const handleSetExactDate = async () => {
    if (!calendarModalTenant || !exactDateValue) return;
    try {
      const res = await fetch("/api/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: calendarModalTenant.id,
          setExactExpiresAt: new Date(exactDateValue).toISOString(),
          status: "ACTIVE",
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Data de vencimento atualizada para ${new Date(exactDateValue).toLocaleDateString("pt-BR")}!`);
        setCalendarModalTenant(null);
        fetchTenants();
      }
    } catch (err: any) {
      showToast("Erro: " + err.message, "error");
    }
  };

  // Toggle block / unblock
  const handleToggleBlock = async (tenantId: string, currentStatus: string, tenantName: string) => {
    const nextStatus = currentStatus === "BLOCKED" ? "ACTIVE" : "BLOCKED";
    try {
      const res = await fetch("/api/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, status: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          nextStatus === "BLOCKED"
            ? `Oficina "${tenantName}" BLOQUEADA!`
            : `Oficina "${tenantName}" LIBERADA e Ativa!`,
          nextStatus === "BLOCKED" ? "info" : "success"
        );
        fetchTenants();
      }
    } catch (err: any) {
      showToast("Erro ao alterar status: " + err.message, "error");
    }
  };

  // Toggle feature flag
  const handleToggleFeature = async (featureKey: string) => {
    if (!featuresModalTenant) return;
    const currentFlags = featuresModalTenant.enabled_features || {};
    const updatedFeatures = {
      ...currentFlags,
      [featureKey]: !currentFlags[featureKey],
    };

    setFeaturesModalTenant({
      ...featuresModalTenant,
      enabled_features: updatedFeatures,
    });

    try {
      await fetch("/api/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: featuresModalTenant.id,
          enabledFeatures: updatedFeatures,
        }),
      });
      // Silent sync with parent list
      setTenants((prev) =>
        prev.map((t) => (t.id === featuresModalTenant.id ? { ...t, enabled_features: updatedFeatures } : t))
      );
    } catch (err: any) {
      showToast("Erro ao salvar permissão: " + err.message, "error");
    }
  };

  // Apply feature presets
  const handleApplyPreset = async (presetType: "all" | "basic") => {
    if (!featuresModalTenant) return;
    let preset: Record<string, boolean> = {};

    if (presetType === "all") {
      preset = {
        ordens_servico: true,
        checklist_fotos: true,
        estoque_pecas: true,
        pdv_balcao: true,
        financeiro: true,
        whatsapp_crm: true,
        relatorios: true,
      };
    } else {
      preset = {
        ordens_servico: true,
        checklist_fotos: true,
        estoque_pecas: false,
        pdv_balcao: false,
        financeiro: false,
        whatsapp_crm: false,
        relatorios: false,
      };
    }

    setFeaturesModalTenant({
      ...featuresModalTenant,
      enabled_features: preset,
    });

    try {
      await fetch("/api/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: featuresModalTenant.id,
          enabledFeatures: preset,
        }),
      });
      setTenants((prev) =>
        prev.map((t) => (t.id === featuresModalTenant.id ? { ...t, enabled_features: preset } : t))
      );
      showToast("Preset aplicado com sucesso!", "success");
    } catch (err: any) {
      showToast("Erro ao aplicar preset: " + err.message, "error");
    }
  };

  // Reset password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalTenant || !resetPasswordValue) return;

    try {
      const res = await fetch("/api/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: passwordModalTenant.id,
          newPassword: resetPasswordValue,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Nova senha definida para ${passwordModalTenant.name}!`, "success");
        setPasswordModalTenant(null);
        setResetPasswordValue("");
      }
    } catch (err: any) {
      showToast("Erro ao redefinir senha: " + err.message, "error");
    }
  };

  // Delete tenant
  const handleDeleteTenant = async (tenantId: string, tenantName: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir a oficina "${tenantName}"? Esta ação é irreversível.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/tenants?tenantId=${tenantId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Oficina "${tenantName}" removida.`, "info");
        fetchTenants();
      }
    } catch (err: any) {
      showToast("Erro ao excluir: " + err.message, "error");
    }
  };

  // Convert Lead to Tenant
  const handleConvertLead = (lead: Lead) => {
    setNewName(lead.workshop_name || lead.name + " Oficina");
    setNewOwner(lead.name);
    setNewEmail(lead.email);
    setNewPhone(lead.phone);
    setNewPlan("TRIAL");
    setNewDays(14);
    setIsNewModalOpen(true);
  };

  // Filtered tenants calculation
  const filteredTenants = tenants.filter((t) => {
    if (statusFilter !== "TODOS" && t.status !== statusFilter) return false;
    if (planFilter !== "TODOS" && t.plan !== planFilter) return false;
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      (t.owner_name && t.owner_name.toLowerCase().includes(q)) ||
      (t.email && t.email.toLowerCase().includes(q)) ||
      (t.phone && t.phone.includes(q)) ||
      t.id.toLowerCase().includes(q)
    );
  });

  // Calculate expiration text helper
  const getExpirationBadge = (expiresAt: string | null, status: string) => {
    if (!expiresAt) {
      return <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>Vitalício / Sem limite</span>;
    }

    const expDate = new Date(expiresAt);
    const now = new Date();
    const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (status === "BLOCKED") {
      return (
        <div>
          <div style={{ color: "#F87171", fontWeight: 700, fontSize: "13px" }}>Bloqueado</div>
          <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>
            Vencimento: {expDate.toLocaleDateString("pt-BR")}
          </span>
        </div>
      );
    }

    if (diffDays < 0) {
      return (
        <div>
          <div style={{ color: "#F87171", fontWeight: 800, fontSize: "13px" }}>
            Vencido há {Math.abs(diffDays)} dia(s)
          </div>
          <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>
            Venceu em: {expDate.toLocaleDateString("pt-BR")}
          </span>
        </div>
      );
    }

    if (diffDays === 0) {
      return (
        <div>
          <div style={{ color: "#FBBF24", fontWeight: 800, fontSize: "13px" }}>Expira HOJE!</div>
          <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>
            {expDate.toLocaleDateString("pt-BR")}
          </span>
        </div>
      );
    }

    if (diffDays <= 5) {
      return (
        <div>
          <div style={{ color: "#FBBF24", fontWeight: 700, fontSize: "13px" }}>
            Expira em {diffDays} dias
          </div>
          <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>
            {expDate.toLocaleDateString("pt-BR")}
          </span>
        </div>
      );
    }

    return (
      <div>
        <div style={{ color: "#34D399", fontWeight: 600, fontSize: "13px" }}>
          {diffDays} dias restantes
        </div>
        <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>
          {expDate.toLocaleDateString("pt-BR")}
        </span>
      </div>
    );
  };

  // --------------------------------------------------------------------------
  // AUTHENTICATION SCREEN (GATE)
  // --------------------------------------------------------------------------
  if (isAuthenticated === false) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "radial-gradient(circle at 50% 20%, #172033 0%, #080B11 80%)",
        }}
      >
        <div
          className="glass-modal"
          style={{
            maxWidth: "440px",
            width: "100%",
            padding: "36px 32px",
            textAlign: "center",
            position: "relative",
          }}
        >
          {/* Logo Brand Emblem */}
          <div
            style={{
              width: "68px",
              height: "68px",
              borderRadius: "18px",
              background: "linear-gradient(135deg, #F26B21 0%, #B43805 100%)",
              boxShadow: "0 10px 25px rgba(242, 107, 33, 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              color: "#FFF",
            }}
          >
            <ShieldAlert size={36} strokeWidth={2.2} />
          </div>

          <h2 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "6px" }}>
            KVNS MASTER ADMIN
          </h2>
          <p style={{ color: "var(--text-muted)", fontSize: "13.5px", marginBottom: "28px" }}>
            Painel de Controle Central das Oficinas Conectadas
          </p>

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ textAlign: "left" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Senha de Acesso Mestre
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type="password"
                  required
                  placeholder="Digite sua senha de administrador..."
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    background: "rgba(10, 14, 23, 0.8)",
                    border: "1px solid #283548",
                    color: "#FFF",
                    fontSize: "14px",
                  }}
                  autoFocus
                />
              </div>
            </div>

            {authError && (
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  color: "#FCA5A5",
                  padding: "10px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <AlertTriangle size={16} />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              style={{
                width: "100%",
                padding: "13px",
                background: "linear-gradient(135deg, #F26B21 0%, #E0530A 100%)",
                color: "#FFF",
                fontWeight: 800,
                fontSize: "14px",
                borderRadius: "8px",
                boxShadow: "0 4px 15px rgba(242, 107, 33, 0.35)",
                marginTop: "6px",
              }}
            >
              {authLoading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> Entrando...
                </>
              ) : (
                <>
                  <Lock size={16} /> Acessar Painel Master
                </>
              )}
            </button>
          </form>

          <div
            style={{
              marginTop: "24px",
              paddingTop: "18px",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              fontSize: "12px",
              color: "var(--text-dim)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <Info size={14} />
            <span>Senha padrão configurada no `.env.local`: <strong>admin</strong></span>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // MAIN DASHBOARD INTERFACE
  // --------------------------------------------------------------------------
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-main)", padding: "28px 32px 60px" }}>
      {/* Toast Alert */}
      {toast && (
        <div
          className="toast-container glass-modal"
          style={{
            padding: "12px 20px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            color: "#FFF",
            borderColor:
              toast.type === "error"
                ? "var(--rose)"
                : toast.type === "info"
                ? "var(--cyan)"
                : "var(--emerald)",
          }}
        >
          {toast.type === "error" ? (
            <AlertTriangle size={18} color="var(--rose)" />
          ) : toast.type === "info" ? (
            <Info size={18} color="var(--cyan)" />
          ) : (
            <CheckCircle2 size={18} color="var(--emerald)" />
          )}
          <span style={{ fontSize: "13.5px", fontWeight: 600 }}>{toast.message}</span>
        </div>
      )}

      {/* TOP HEADER */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          paddingBottom: "22px",
          marginBottom: "24px",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "46px",
              height: "46px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, #F26B21 0%, #D84E06 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 6px 16px rgba(242, 107, 33, 0.35)",
              color: "#FFF",
            }}
          >
            <ShieldAlert size={26} strokeWidth={2.4} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#FFF", margin: 0 }}>
                KVNS MASTER ADMIN
              </h1>
              <span
                style={{
                  fontSize: "10.5px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  padding: "2px 8px",
                  borderRadius: "999px",
                  background: "rgba(242, 107, 33, 0.2)",
                  color: "var(--primary)",
                  border: "1px solid rgba(242, 107, 33, 0.4)",
                }}
              >
                Vercel Postgres Central
              </span>
            </div>
            <p style={{ margin: "2px 0 0", color: "var(--text-muted)", fontSize: "13px" }}>
              Controle de Vencimentos, Licenças, Bloqueio Imediato e Módulos de Clientes
            </p>
          </div>
        </div>

        {/* Right Header Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Database Connection Pill */}
          <button
            onClick={() => {
              setIsDbModalOpen(true);
              fetchDbDiag();
            }}
            title="Ver status da conexão com PostgreSQL da Vercel"
            style={{
              padding: "7px 12px",
              borderRadius: "8px",
              background: isDemoMode ? "rgba(245, 158, 11, 0.12)" : "rgba(16, 185, 129, 0.12)",
              border: `1px solid ${isDemoMode ? "rgba(245, 158, 11, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
              color: isDemoMode ? "#FBBF24" : "#34D399",
              fontSize: "12px",
              fontWeight: 700,
              gap: "6px",
            }}
          >
            <span
              className="pulse-dot"
              style={{ background: isDemoMode ? "#F59E0B" : "#10B981" }}
            />
            <Database size={14} />
            <span>{isDemoMode ? "Modo Demonstração" : "Neon Postgres Ativo"}</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={fetchTenants}
            style={{
              padding: "8px 14px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "8px",
              color: "var(--text-muted)",
              fontWeight: 600,
            }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Atualizar</span>
          </button>

          {/* New Client Button */}
          <button
            onClick={() => setIsNewModalOpen(true)}
            style={{
              padding: "8px 16px",
              background: "linear-gradient(135deg, #F26B21 0%, #D84E06 100%)",
              color: "#FFF",
              borderRadius: "8px",
              fontWeight: 700,
              boxShadow: "0 4px 14px rgba(242, 107, 33, 0.3)",
            }}
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>Novo Cliente</span>
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            title="Encerrar Sessão Master"
            style={{
              padding: "8px 10px",
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              color: "#F87171",
              borderRadius: "8px",
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* DEMO MODE NOTICE BANNER (IF POSTGRES_URL NOT SET) */}
      {isDemoMode && (
        <div
          style={{
            background: "linear-gradient(90deg, rgba(245, 158, 11, 0.15) 0%, rgba(15, 20, 32, 0.8) 100%)",
            border: "1px solid rgba(245, 158, 11, 0.35)",
            borderRadius: "10px",
            padding: "14px 18px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <AlertTriangle size={20} color="#F59E0B" />
            <div>
              <strong style={{ color: "#FDE68A", fontSize: "13.5px" }}>
                Conexão com PostgreSQL Neon pendente
              </strong>
              <p style={{ margin: "2px 0 0", color: "#E2E8F0", fontSize: "12.5px" }}>
                Você está navegando com dados em memória. Para controlar diretamente suas oficinas em
                produção na Vercel, adicione a variável <code>POSTGRES_URL</code> no arquivo{" "}
                <code>.env.local</code>.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsDbModalOpen(true);
              fetchDbDiag();
            }}
            style={{
              padding: "6px 12px",
              background: "#F59E0B",
              color: "#000",
              fontWeight: 800,
              fontSize: "12px",
              borderRadius: "6px",
            }}
          >
            Como Conectar na Vercel
          </button>
        </div>
      )}

      {/* METRICS ROW (KPI CARDS) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "14px",
          marginBottom: "26px",
        }}
      >
        {/* Total */}
        <div
          className="glass-panel"
          onClick={() => setStatusFilter("TODOS")}
          style={{
            padding: "18px 20px",
            cursor: "pointer",
            borderLeft: statusFilter === "TODOS" ? "4px solid #FFF" : undefined,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>
              Total de Oficinas
            </span>
            <Building2 size={16} color="var(--text-dim)" />
          </div>
          <h2 style={{ fontSize: "30px", fontWeight: 800, margin: "6px 0 0", color: "#FFF" }}>
            {metrics.total}
          </h2>
          <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Cadastradas no sistema</span>
        </div>

        {/* Ativas */}
        <div
          className="glass-panel"
          onClick={() => setStatusFilter("ACTIVE")}
          style={{
            padding: "18px 20px",
            cursor: "pointer",
            borderLeft: statusFilter === "ACTIVE" ? "4px solid var(--emerald)" : undefined,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", color: "#34D399", fontWeight: 700, textTransform: "uppercase" }}>
              Ativas & Em Dia
            </span>
            <CheckCircle2 size={16} color="var(--emerald)" />
          </div>
          <h2 style={{ fontSize: "30px", fontWeight: 800, margin: "6px 0 0", color: "#34D399" }}>
            {metrics.active}
          </h2>
          <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Acesso regular liberado</span>
        </div>

        {/* Em Teste */}
        <div
          className="glass-panel"
          onClick={() => setStatusFilter("TRIAL")}
          style={{
            padding: "18px 20px",
            cursor: "pointer",
            borderLeft: statusFilter === "TRIAL" ? "4px solid var(--cyan)" : undefined,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", color: "#22D3EE", fontWeight: 700, textTransform: "uppercase" }}>
              Em Teste (14 Dias)
            </span>
            <Clock size={16} color="var(--cyan)" />
          </div>
          <h2 style={{ fontSize: "30px", fontWeight: 800, margin: "6px 0 0", color: "#22D3EE" }}>
            {metrics.trial}
          </h2>
          <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Período de degustação</span>
        </div>

        {/* Vencidas */}
        <div
          className="glass-panel"
          onClick={() => setStatusFilter("EXPIRED")}
          style={{
            padding: "18px 20px",
            cursor: "pointer",
            borderLeft: statusFilter === "EXPIRED" ? "4px solid var(--amber)" : undefined,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", color: "#FBBF24", fontWeight: 700, textTransform: "uppercase" }}>
              Vencidas (Aviso)
            </span>
            <Clock size={16} color="var(--amber)" />
          </div>
          <h2 style={{ fontSize: "30px", fontWeight: 800, margin: "6px 0 0", color: "#FBBF24" }}>
            {metrics.expired}
          </h2>
          <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Expiradas no prazo</span>
        </div>

        {/* Bloqueadas */}
        <div
          className="glass-panel"
          onClick={() => setStatusFilter("BLOCKED")}
          style={{
            padding: "18px 20px",
            cursor: "pointer",
            borderLeft: statusFilter === "BLOCKED" ? "4px solid var(--rose)" : undefined,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", color: "#F87171", fontWeight: 700, textTransform: "uppercase" }}>
              Bloqueadas
            </span>
            <Ban size={16} color="var(--rose)" />
          </div>
          <h2 style={{ fontSize: "30px", fontWeight: 800, margin: "6px 0 0", color: "#F87171" }}>
            {metrics.blocked}
          </h2>
          <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Acesso suspenso</span>
        </div>
      </div>

      {/* TABS NAVIGATION */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: "1px solid var(--border-subtle)",
          marginBottom: "20px",
        }}
      >
        <button
          onClick={() => setActiveTab("tenants")}
          style={{
            padding: "10px 18px",
            color: activeTab === "tenants" ? "var(--primary)" : "var(--text-muted)",
            borderBottom: activeTab === "tenants" ? "2px solid var(--primary)" : "2px solid transparent",
            fontWeight: activeTab === "tenants" ? 700 : 500,
            fontSize: "13.5px",
            gap: "8px",
          }}
        >
          <Users size={16} />
          <span>Oficinas Clientes ({tenants.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("leads")}
          style={{
            padding: "10px 18px",
            color: activeTab === "leads" ? "var(--primary)" : "var(--text-muted)",
            borderBottom: activeTab === "leads" ? "2px solid var(--primary)" : "2px solid transparent",
            fontWeight: activeTab === "leads" ? 700 : 500,
            fontSize: "13.5px",
            gap: "8px",
          }}
        >
          <Sparkles size={16} />
          <span>Leads & Pedidos de Teste ({leads.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("guide")}
          style={{
            padding: "10px 18px",
            color: activeTab === "guide" ? "var(--primary)" : "var(--text-muted)",
            borderBottom: activeTab === "guide" ? "2px solid var(--primary)" : "2px solid transparent",
            fontWeight: activeTab === "guide" ? 700 : 500,
            fontSize: "13.5px",
            gap: "8px",
          }}
        >
          <Info size={16} />
          <span>Guia do Painel Master</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: TENANTS TABLE */}
      {/* ==================================================================== */}
      {activeTab === "tenants" && (
        <>
          {/* SEARCH & FILTERS BAR */}
          <div
            style={{
              display: "flex",
              gap: "12px",
              marginBottom: "18px",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {/* Search Input */}
            <div style={{ flex: 1, minWidth: "260px", position: "relative" }}>
              <Search
                size={16}
                color="var(--text-dim)"
                style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }}
              />
              <input
                type="text"
                placeholder="Buscar por nome da oficina, responsável, e-mail ou WhatsApp..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: "100%",
                  paddingLeft: "40px",
                  background: "var(--bg-card)",
                }}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-dim)",
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ background: "var(--bg-card)", minWidth: "150px" }}
            >
              <option value="TODOS">Todos os Status</option>
              <option value="ACTIVE">Ativos</option>
              <option value="TRIAL">Trial (Teste 14d)</option>
              <option value="EXPIRED">Vencidos</option>
              <option value="BLOCKED">Bloqueados</option>
            </select>

            {/* Plan Filter */}
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              style={{ background: "var(--bg-card)", minWidth: "140px" }}
            >
              <option value="TODOS">Todos os Planos</option>
              <option value="PRO">Plano PRO</option>
              <option value="ENTERPRISE">Plano Enterprise</option>
              <option value="TRIAL">Plano Trial</option>
            </select>

            {(searchTerm || statusFilter !== "TODOS" || planFilter !== "TODOS") && (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("TODOS");
                  setPlanFilter("TODOS");
                }}
                style={{
                  fontSize: "12px",
                  color: "var(--text-muted)",
                  padding: "8px 12px",
                  background: "var(--bg-card)",
                  borderRadius: "6px",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                Limpar Filtros
              </button>
            )}
          </div>

          {/* TABLE WRAPPER */}
          <div
            className="glass-panel"
            style={{
              overflowX: "auto",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr
                  style={{
                    background: "rgba(10, 14, 23, 0.9)",
                    color: "var(--text-muted)",
                    borderBottom: "1px solid var(--border-subtle)",
                    fontSize: "11.5px",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  <th style={{ padding: "14px 18px" }}>Oficina / Responsável</th>
                  <th style={{ padding: "14px 18px" }}>Contato</th>
                  <th style={{ padding: "14px 18px" }}>Status</th>
                  <th style={{ padding: "14px 18px" }}>Vencimento</th>
                  <th style={{ padding: "14px 18px" }}>Operadores</th>
                  <th style={{ padding: "14px 18px", textAlign: "right" }}>Ações Rápidas</th>
                </tr>
              </thead>
              <tbody>
                {filteredTenants.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        padding: "48px 20px",
                        textAlign: "center",
                        color: "var(--text-dim)",
                      }}
                    >
                      <Users size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                      <p style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>
                        Nenhuma oficina encontrada com os filtros selecionados.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredTenants.map((t) => {
                    const isExpired = t.expires_at && new Date(t.expires_at) < new Date();
                    const cleanPhone = (t.phone || "").replace(/\D/g, "");

                    return (
                      <tr
                        key={t.id}
                        style={{
                          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                          transition: "background 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "rgba(255, 255, 255, 0.02)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        {/* Office Name & Owner */}
                        <td style={{ padding: "16px 18px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <div
                              style={{
                                width: "38px",
                                height: "38px",
                                borderRadius: "8px",
                                background: "rgba(242, 107, 33, 0.15)",
                                border: "1px solid rgba(242, 107, 33, 0.3)",
                                color: "var(--primary)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 800,
                                fontSize: "14px",
                                flexShrink: 0,
                              }}
                            >
                              {t.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <strong style={{ color: "#FFF", fontSize: "14px", display: "block" }}>
                                {t.name}
                              </strong>
                              <div style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "2px" }}>
                                <span>{t.owner_name || "Sem responsável"}</span>
                                <span style={{ margin: "0 6px", color: "var(--text-dim)" }}>•</span>
                                <span
                                  style={{
                                    background: "rgba(255, 255, 255, 0.08)",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    fontSize: "10.5px",
                                    fontWeight: 700,
                                    color: "#CBD5E1",
                                  }}
                                >
                                  {t.plan || "PRO"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Contact */}
                        <td style={{ padding: "16px 18px" }}>
                          <div style={{ color: "#E2E8F0", fontSize: "13px" }}>{t.email}</div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              marginTop: "3px",
                            }}
                          >
                            <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>{t.phone}</span>
                            {cleanPhone && (
                              <a
                                href={`https://wa.me/55${cleanPhone}?text=Ol%C3%A1%20${encodeURIComponent(
                                  t.owner_name || t.name
                                )}%2C%20falo%20do%20suporte%20KVNS.`}
                                target="_blank"
                                rel="noreferrer"
                                title="Abrir WhatsApp direto com a oficina"
                                style={{
                                  color: "#25D366",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "3px",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  textDecoration: "none",
                                }}
                              >
                                <MessageSquare size={12} /> WhatsApp
                              </a>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td style={{ padding: "16px 18px" }}>
                          {t.status === "BLOCKED" ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "4px 10px",
                                borderRadius: "6px",
                                fontSize: "11.5px",
                                fontWeight: 800,
                                background: "rgba(239, 68, 68, 0.15)",
                                color: "#F87171",
                                border: "1px solid rgba(239, 68, 68, 0.4)",
                              }}
                            >
                              <Ban size={12} /> BLOQUEADO
                            </span>
                          ) : isExpired ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "4px 10px",
                                borderRadius: "6px",
                                fontSize: "11.5px",
                                fontWeight: 800,
                                background: "rgba(245, 158, 11, 0.15)",
                                color: "#FBBF24",
                                border: "1px solid rgba(245, 158, 11, 0.4)",
                              }}
                            >
                              <Clock size={12} /> VENCIDO
                            </span>
                          ) : t.status === "TRIAL" ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "4px 10px",
                                borderRadius: "6px",
                                fontSize: "11.5px",
                                fontWeight: 800,
                                background: "rgba(6, 182, 212, 0.15)",
                                color: "#22D3EE",
                                border: "1px solid rgba(6, 182, 212, 0.4)",
                              }}
                            >
                              <Clock size={12} /> TESTE (TRIAL)
                            </span>
                          ) : (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "4px 10px",
                                borderRadius: "6px",
                                fontSize: "11.5px",
                                fontWeight: 800,
                                background: "rgba(16, 185, 129, 0.15)",
                                color: "#34D399",
                                border: "1px solid rgba(16, 185, 129, 0.4)",
                              }}
                            >
                              <CheckCircle2 size={12} /> ATIVO
                            </span>
                          )}
                        </td>

                        {/* Expiration */}
                        <td style={{ padding: "16px 18px" }}>
                          {getExpirationBadge(t.expires_at, t.status)}
                        </td>

                        {/* Users & Last Login */}
                        <td style={{ padding: "16px 18px" }}>
                          <div style={{ color: "#E2E8F0", fontSize: "13px" }}>
                            {t.users_count || 1} operador(es)
                          </div>
                          <div style={{ color: "var(--text-dim)", fontSize: "11px", marginTop: "2px" }}>
                            {t.last_login_at
                              ? new Date(t.last_login_at).toLocaleString("pt-BR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Nunca acessou"}
                          </div>
                        </td>

                        {/* Quick Actions */}
                        <td style={{ padding: "16px 18px", textAlign: "right" }}>
                          <div
                            style={{
                              display: "flex",
                              gap: "6px",
                              justifyContent: "flex-end",
                              alignItems: "center",
                            }}
                          >
                            {/* +30 Days Renewal */}
                            <button
                              onClick={() => handleAddDays(t.id, 30, t.name)}
                              title="Adicionar +30 dias de validade e ativar oficina"
                              style={{
                                background: "rgba(16, 185, 129, 0.15)",
                                color: "#34D399",
                                border: "1px solid rgba(16, 185, 129, 0.35)",
                                padding: "6px 10px",
                                fontSize: "12px",
                                fontWeight: 700,
                                borderRadius: "6px",
                              }}
                            >
                              +30d
                            </button>

                            {/* +1 Year Renewal */}
                            <button
                              onClick={() => handleAddDays(t.id, 365, t.name)}
                              title="Renovação Anual (+1 Ano)"
                              style={{
                                background: "rgba(5, 150, 105, 0.2)",
                                color: "#6EE7B7",
                                border: "1px solid rgba(5, 150, 105, 0.4)",
                                padding: "6px 10px",
                                fontSize: "12px",
                                fontWeight: 700,
                                borderRadius: "6px",
                              }}
                            >
                              +1 ano
                            </button>

                            {/* Block / Unblock */}
                            <button
                              onClick={() => handleToggleBlock(t.id, t.status, t.name)}
                              title={t.status === "BLOCKED" ? "Desbloquear oficina" : "Bloquear acesso da oficina imediatamente"}
                              style={{
                                background:
                                  t.status === "BLOCKED"
                                    ? "rgba(37, 99, 235, 0.2)"
                                    : "rgba(239, 68, 68, 0.15)",
                                color: t.status === "BLOCKED" ? "#60A5FA" : "#F87171",
                                border: `1px solid ${
                                  t.status === "BLOCKED"
                                    ? "rgba(37, 99, 235, 0.4)"
                                    : "rgba(239, 68, 68, 0.4)"
                                }`,
                                padding: "6px 10px",
                                fontSize: "12px",
                                fontWeight: 700,
                                borderRadius: "6px",
                              }}
                            >
                              {t.status === "BLOCKED" ? <Unlock size={14} /> : <Lock size={14} />}
                              <span>{t.status === "BLOCKED" ? "Liberar" : "Bloquear"}</span>
                            </button>

                            {/* Features Modal */}
                            <button
                              onClick={() => setFeaturesModalTenant(t)}
                              title="Permissões e Módulos Liberados"
                              style={{
                                background: "var(--bg-card-subtle)",
                                color: "#FFF",
                                border: "1px solid var(--border-subtle)",
                                padding: "6px 10px",
                                fontSize: "12px",
                                fontWeight: 600,
                                borderRadius: "6px",
                              }}
                            >
                              <Sliders size={14} />
                              <span>Módulos</span>
                            </button>

                            {/* Dropdown More Menu */}
                            <div style={{ position: "relative" }}>
                              <button
                                onClick={() =>
                                  setActionMenuTenantId(actionMenuTenantId === t.id ? null : t.id)
                                }
                                style={{
                                  background: "var(--bg-card-subtle)",
                                  color: "var(--text-muted)",
                                  border: "1px solid var(--border-subtle)",
                                  padding: "6px 8px",
                                  borderRadius: "6px",
                                }}
                              >
                                •••
                              </button>

                              {actionMenuTenantId === t.id && (
                                <div
                                  className="glass-modal"
                                  style={{
                                    position: "absolute",
                                    right: 0,
                                    top: "100%",
                                    marginTop: "6px",
                                    minWidth: "210px",
                                    zIndex: 50,
                                    padding: "6px",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "2px",
                                  }}
                                >
                                  <button
                                    onClick={() => {
                                      setPasswordModalTenant(t);
                                      setActionMenuTenantId(null);
                                    }}
                                    style={{
                                      padding: "8px 12px",
                                      justifyContent: "flex-start",
                                      color: "#FFF",
                                      fontSize: "12.5px",
                                      borderRadius: "6px",
                                      width: "100%",
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                                  >
                                    <KeyRound size={14} color="#FBBF24" />
                                    <span>Alterar Senha do Admin</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      setCalendarModalTenant(t);
                                      setExactDateValue(
                                        t.expires_at ? t.expires_at.split("T")[0] : ""
                                      );
                                      setActionMenuTenantId(null);
                                    }}
                                    style={{
                                      padding: "8px 12px",
                                      justifyContent: "flex-start",
                                      color: "#FFF",
                                      fontSize: "12.5px",
                                      borderRadius: "6px",
                                      width: "100%",
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                                  >
                                    <CalendarDays size={14} color="#38BDF8" />
                                    <span>Definir Data Específica</span>
                                  </button>

                                  <div style={{ height: "1px", background: "rgba(255,255,255,0.08)", margin: "4px 0" }} />

                                  <button
                                    onClick={() => {
                                      handleDeleteTenant(t.id, t.name);
                                      setActionMenuTenantId(null);
                                    }}
                                    style={{
                                      padding: "8px 12px",
                                      justifyContent: "flex-start",
                                      color: "#F87171",
                                      fontSize: "12.5px",
                                      borderRadius: "6px",
                                      width: "100%",
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.12)")}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                                  >
                                    <Trash2 size={14} />
                                    <span>Excluir Oficina</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: LEADS (LANDING PAGE SIGNUPS) */}
      {/* ==================================================================== */}
      {activeTab === "leads" && (
        <div>
          <div style={{ marginBottom: "18px" }}>
            <h3 style={{ fontSize: "18px", color: "#FFF", margin: 0 }}>
              Leads Captados & Pedidos de Teste Gratuito
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
              Potenciais clientes que solicitaram teste de 14 dias ou entraram em contato pelas landing pages.
            </p>
          </div>

          <div className="glass-panel" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr
                  style={{
                    background: "rgba(10, 14, 23, 0.9)",
                    color: "var(--text-muted)",
                    borderBottom: "1px solid var(--border-subtle)",
                    fontSize: "11.5px",
                    textTransform: "uppercase",
                  }}
                >
                  <th style={{ padding: "14px 18px" }}>Nome / Oficina</th>
                  <th style={{ padding: "14px 18px" }}>Contato</th>
                  <th style={{ padding: "14px 18px" }}>Origem / Data</th>
                  <th style={{ padding: "14px 18px" }}>Observações</th>
                  <th style={{ padding: "14px 18px", textAlign: "right" }}>Ação Comercial</th>
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: "40px", textAlign: "center", color: "var(--text-dim)" }}>
                      Nenhum lead registrado no momento.
                    </td>
                  </tr>
                ) : (
                  leads.map((l) => (
                    <tr key={l.id} style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}>
                      <td style={{ padding: "16px 18px" }}>
                        <strong style={{ color: "#FFF", fontSize: "14px" }}>{l.name}</strong>
                        <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                          {l.workshop_name || "Oficina não informada"}
                        </div>
                      </td>
                      <td style={{ padding: "16px 18px" }}>
                        <div style={{ color: "#E2E8F0" }}>{l.email}</div>
                        <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>{l.phone}</div>
                      </td>
                      <td style={{ padding: "16px 18px" }}>
                        <span
                          style={{
                            background: "rgba(56, 189, 248, 0.15)",
                            color: "#38BDF8",
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: 700,
                          }}
                        >
                          {l.origin || "Site Principal"}
                        </span>
                        <div style={{ color: "var(--text-dim)", fontSize: "11px", marginTop: "4px" }}>
                          {new Date(l.created_at).toLocaleDateString("pt-BR")}
                        </div>
                      </td>
                      <td style={{ padding: "16px 18px", color: "var(--text-muted)" }}>
                        {l.notes || "Interesse em teste de 14 dias"}
                      </td>
                      <td style={{ padding: "16px 18px", textAlign: "right" }}>
                        <button
                          onClick={() => handleConvertLead(l)}
                          style={{
                            background: "linear-gradient(135deg, #F26B21 0%, #D84E06 100%)",
                            color: "#FFF",
                            padding: "7px 12px",
                            borderRadius: "6px",
                            fontWeight: 700,
                            fontSize: "12px",
                          }}
                        >
                          <Plus size={14} /> Criar Oficina
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: ARCHITECTURE & GUIDE */}
      {/* ==================================================================== */}
      {activeTab === "guide" && (
        <div style={{ maxWidth: "900px" }}>
          <div className="glass-panel" style={{ padding: "28px", marginBottom: "20px" }}>
            <h3 style={{ fontSize: "18px", color: "var(--primary)", margin: "0 0 12px" }}>
              🛠️ Arquitetura do Painel Master KVNS
            </h3>
            <p style={{ color: "#CBD5E1", fontSize: "13.5px", lineHeight: "1.6", marginBottom: "16px" }}>
              O sistema funciona através de uma <strong>base de dados centralizada no Neon (PostgreSQL na Vercel)</strong>.
              Tanto o sistema operacional da oficina quanto este Painel Master conectam-se à mesma string de conexão{" "}
              <code>POSTGRES_URL</code>.
            </p>

            <div
              style={{
                background: "rgba(10, 14, 23, 0.7)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "8px",
                padding: "16px",
                fontFamily: "var(--font-mono)",
                fontSize: "12.5px",
                color: "#94A3B8",
                marginBottom: "20px",
                overflowX: "auto",
              }}
            >
              <pre style={{ margin: 0 }}>
{`┌────────────────────────────────────────┐       ┌────────────────────────────────────────┐
│  SISTEMA DA OFICINA (app.kvns.com.br)  │       │   PAINEL MASTER (master.kvns.com.br)   │
│  - Cadastro de Clientes e Veículos     │       │  - Controle de Todas as Oficinas       │
│  - Ordens de Serviço & Fotos Vistoria  │       │  - Validade (+30d, +1 ano, custom)     │
│  - PDV Balcão, Estoque & Financeiro    │       │  - Bloqueio / Desbloqueio Instantâneo  │
│  - Verifica status & expires_at        │       │  - Feature Flags de Módulos (Permissão)│
└───────────────────┬────────────────────┘       └───────────────────┬────────────────────┘
                    │                                                │
                    └────────────────► ◄─────────────────────────────┘
                                       │
                           ┌───────────────────────┐
                           │    VERCEL POSTGRES    │
                           │   (Neon Serverless)   │
                           └───────────────────────┘`}
              </pre>
            </div>

            <h4 style={{ fontSize: "15px", color: "#FFF", margin: "20px 0 8px" }}>
              🔒 Como Funciona o Bloqueio por Vencimento
            </h4>
            <ul style={{ color: "#94A3B8", fontSize: "13px", lineHeight: "1.7", paddingLeft: "20px" }}>
              <li>
                <strong>Ao Fazer Login:</strong> O sistema da oficina consulta o campo <code>expires_at</code>. Se a data atual for maior, a tela de trabalho é bloqueada e exibe o botão para falar com você no WhatsApp.
              </li>
              <li>
                <strong>Bloqueio Manual Imediato:</strong> Ao clicar em <em>"Bloquear"</em>, o status vira <code>BLOCKED</code> e suspende qualquer operação no sistema cliente.
              </li>
              <li>
                <strong>Renovação Automática (+30d / +1 ano):</strong> A data <code>expires_at</code> é somada e o status retorna imediatamente para <code>ACTIVE</code>.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: CRIAR NOVA OFICINA */}
      {/* ==================================================================== */}
      {isNewModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
        >
          <div className="glass-modal" style={{ maxWidth: "520px", width: "100%", padding: "28px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <div>
                <h3 style={{ fontSize: "18px", color: "var(--primary)", margin: 0 }}>
                  Cadastrar Nova Oficina Cliente
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "12.5px", margin: "2px 0 0" }}>
                  Cria o registro do tenant e o primeiro usuário administrador
                </p>
              </div>
              <button
                onClick={() => setIsNewModalOpen(false)}
                style={{ color: "var(--text-dim)", padding: "4px" }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateTenant} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>
                  Nome Fantasia da Oficina *
                </label>
                <input
                  required
                  placeholder="Ex: Auto Mecânica Turbo Precision"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>
                  Nome do Responsável / Proprietário *
                </label>
                <input
                  required
                  placeholder="Ex: Carlos Eduardo de Oliveira"
                  value={newOwner}
                  onChange={(e) => setNewOwner(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>
                    E-mail de Login *
                  </label>
                  <input
                    required
                    type="email"
                    placeholder="carlos@oficina.com.br"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>
                    WhatsApp Comercial *
                  </label>
                  <input
                    required
                    placeholder="(11) 98765-4321"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>
                    Senha Provisória
                  </label>
                  <input
                    required
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{ width: "100%" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>
                    Plano Inicial
                  </label>
                  <select
                    value={newPlan}
                    onChange={(e) => setNewPlan(e.target.value)}
                    style={{ width: "100%" }}
                  >
                    <option value="PRO">PRO (Padrão)</option>
                    <option value="ENTERPRISE">Enterprise (VIP)</option>
                    <option value="TRIAL">Trial (Teste)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "6px" }}>
                  Validade Inicial (Dias):
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {[14, 30, 90, 365].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setNewDays(d)}
                      style={{
                        flex: 1,
                        padding: "8px",
                        borderRadius: "6px",
                        background: newDays === d ? "var(--primary)" : "var(--bg-input)",
                        color: newDays === d ? "#FFF" : "var(--text-muted)",
                        border: `1px solid ${newDays === d ? "var(--primary)" : "var(--border-subtle)"}`,
                        fontSize: "12px",
                        fontWeight: 700,
                      }}
                    >
                      {d === 365 ? "1 Ano" : `${d} Dias`}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  style={{
                    flex: 1,
                    padding: "11px",
                    background: "var(--bg-card-subtle)",
                    color: "#FFF",
                    borderRadius: "8px",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: "11px",
                    background: "linear-gradient(135deg, #F26B21 0%, #D84E06 100%)",
                    color: "#FFF",
                    borderRadius: "8px",
                    fontWeight: 800,
                  }}
                >
                  Criar Oficina
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: LIBERAR / BLOQUEAR RECURSOS (FEATURE FLAGS) */}
      {/* ==================================================================== */}
      {featuresModalTenant && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
        >
          <div className="glass-modal" style={{ maxWidth: "540px", width: "100%", padding: "28px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <div>
                <h3 style={{ fontSize: "18px", color: "var(--primary)", margin: 0 }}>
                  Permissões de Recursos
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "12.5px", margin: "2px 0 0" }}>
                  {featuresModalTenant.name} ({featuresModalTenant.plan})
                </p>
              </div>
              <button
                onClick={() => setFeaturesModalTenant(null)}
                style={{ color: "var(--text-dim)", padding: "4px" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Presets */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              <button
                type="button"
                onClick={() => handleApplyPreset("all")}
                style={{
                  flex: 1,
                  padding: "7px 10px",
                  borderRadius: "6px",
                  background: "rgba(16, 185, 129, 0.15)",
                  color: "#34D399",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  fontSize: "12px",
                  fontWeight: 700,
                }}
              >
                <Check size={14} /> Liberar Tudo (VIP)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset("basic")}
                style={{
                  flex: 1,
                  padding: "7px 10px",
                  borderRadius: "6px",
                  background: "rgba(255, 255, 255, 0.05)",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border-subtle)",
                  fontSize: "12px",
                }}
              >
                Apenas O.S. & Fotos
              </button>
            </div>

            {/* Modules Checkbox List */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                maxHeight: "360px",
                overflowY: "auto",
                paddingRight: "6px",
              }}
            >
              {[
                {
                  key: "ordens_servico",
                  label: "Ordens de Serviço e Orçamentos",
                  desc: "Criação de O.S., cadastro de clientes e impressão de termos",
                  icon: Wrench,
                },
                {
                  key: "checklist_fotos",
                  label: "Checklist com Fotos da O.S.",
                  desc: "Vistoria veicular fotográfica de entrada e saída (inspeção)",
                  icon: Camera,
                },
                {
                  key: "estoque_pecas",
                  label: "Controle de Estoque & Peças",
                  desc: "Entrada/saída de produtos, código de barras e margem de lucro",
                  icon: Package,
                },
                {
                  key: "pdv_balcao",
                  label: "Frente de Caixa (PDV Balcão)",
                  desc: "Vendas diretas de peças no balcão com cupom não-fiscal",
                  icon: ShoppingCart,
                },
                {
                  key: "financeiro",
                  label: "Financeiro & Contas a Pagar/Receber",
                  desc: "Fluxo de caixa diário, despesas, faturamento e contas",
                  icon: DollarSign,
                },
                {
                  key: "whatsapp_crm",
                  label: "WhatsApp CRM & Mensagens Automáticas",
                  desc: "Disparo de orçamentos e avisos de carro pronto no WhatsApp",
                  icon: Send,
                },
                {
                  key: "relatorios",
                  label: "Relatórios Gerenciais & DRE",
                  desc: "Painel de métricas, ticket médio e lucratividade",
                  icon: BarChart3,
                },
              ].map((f) => {
                const isChecked = featuresModalTenant.enabled_features?.[f.key] !== false;
                const IconComponent = f.icon;

                return (
                  <div
                    key={f.key}
                    onClick={() => handleToggleFeature(f.key)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                      background: isChecked ? "rgba(242, 107, 33, 0.08)" : "var(--bg-input)",
                      border: `1px solid ${isChecked ? "rgba(242, 107, 33, 0.3)" : "var(--border-subtle)"}`,
                      borderRadius: "8px",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "6px",
                          background: isChecked ? "var(--primary)" : "rgba(255,255,255,0.05)",
                          color: isChecked ? "#FFF" : "var(--text-dim)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <IconComponent size={16} />
                      </div>
                      <div>
                        <strong style={{ fontSize: "13.5px", color: isChecked ? "#FFF" : "var(--text-muted)" }}>
                          {f.label}
                        </strong>
                        <p style={{ margin: "2px 0 0", fontSize: "11.5px", color: "var(--text-dim)" }}>
                          {f.desc}
                        </p>
                      </div>
                    </div>

                    <div
                      style={{
                        width: "22px",
                        height: "22px",
                        borderRadius: "6px",
                        background: isChecked ? "var(--emerald)" : "transparent",
                        border: `2px solid ${isChecked ? "var(--emerald)" : "var(--border-subtle)"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#FFF",
                        flexShrink: 0,
                      }}
                    >
                      {isChecked && <Check size={14} strokeWidth={3} />}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => {
                setFeaturesModalTenant(null);
                showToast("Permissões de módulos salvas com sucesso!");
              }}
              style={{
                marginTop: "20px",
                background: "linear-gradient(135deg, #F26B21 0%, #D84E06 100%)",
                color: "#FFF",
                padding: "12px",
                width: "100%",
                borderRadius: "8px",
                fontWeight: 800,
                fontSize: "14px",
              }}
            >
              Concluir e Salvar
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: REDEFINIR SENHA DO CLIENTE */}
      {/* ==================================================================== */}
      {passwordModalTenant && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
        >
          <div className="glass-modal" style={{ maxWidth: "440px", width: "100%", padding: "26px" }}>
            <h3 style={{ fontSize: "18px", color: "var(--primary)", margin: "0 0 6px" }}>
              Alterar Senha do Administrador
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "12.5px", marginBottom: "18px" }}>
              Define uma nova senha de acesso para <strong>{passwordModalTenant.name}</strong> ({passwordModalTenant.email}).
            </p>

            <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>
                  Nova Senha de Acesso *
                </label>
                <input
                  required
                  type="text"
                  placeholder="Digite a nova senha..."
                  value={resetPasswordValue}
                  onChange={(e) => setResetPasswordValue(e.target.value)}
                  style={{ width: "100%" }}
                  autoFocus
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setPasswordModalTenant(null)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "var(--bg-card-subtle)",
                    color: "#FFF",
                    borderRadius: "6px",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "var(--primary)",
                    color: "#FFF",
                    borderRadius: "6px",
                    fontWeight: 700,
                  }}
                >
                  Salvar Nova Senha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: DEFINIR DATA ESPECÍFICA */}
      {/* ==================================================================== */}
      {calendarModalTenant && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
        >
          <div className="glass-modal" style={{ maxWidth: "420px", width: "100%", padding: "26px" }}>
            <h3 style={{ fontSize: "18px", color: "var(--primary)", margin: "0 0 6px" }}>
              Data de Vencimento Personalizada
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "12.5px", marginBottom: "18px" }}>
              Escolha a data exata em que o acesso de <strong>{calendarModalTenant.name}</strong> deve expirar:
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginBottom: "4px" }}>
                  Data Final de Validade
                </label>
                <input
                  type="date"
                  value={exactDateValue}
                  onChange={(e) => setExactDateValue(e.target.value)}
                  style={{ width: "100%", colorScheme: "dark" }}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setCalendarModalTenant(null)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "var(--bg-card-subtle)",
                    color: "#FFF",
                    borderRadius: "6px",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSetExactDate}
                  style={{
                    flex: 1,
                    padding: "10px",
                    background: "var(--primary)",
                    color: "#FFF",
                    borderRadius: "6px",
                    fontWeight: 700,
                  }}
                >
                  Atualizar Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: DIAGNÓSTICO DO BANCO DE DADOS (POSTGRES VERCEL / NEON) */}
      {/* ==================================================================== */}
      {isDbModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
        >
          <div className="glass-modal" style={{ maxWidth: "560px", width: "100%", padding: "28px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "18px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <Database size={22} color="var(--primary)" />
                <h3 style={{ fontSize: "18px", color: "#FFF", margin: 0 }}>
                  Conexão Vercel Postgres (Neon)
                </h3>
              </div>
              <button
                onClick={() => setIsDbModalOpen(false)}
                style={{ color: "var(--text-dim)", padding: "4px" }}
              >
                <X size={20} />
              </button>
            </div>

            {dbDiagLoading ? (
              <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 10px" }} />
                <span>Testando conexão com o PostgreSQL...</span>
              </div>
            ) : dbDiagData?.connected ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div
                  style={{
                    background: "rgba(16, 185, 129, 0.15)",
                    border: "1px solid rgba(16, 185, 129, 0.4)",
                    borderRadius: "8px",
                    padding: "14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <CheckCircle2 size={24} color="#34D399" />
                  <div>
                    <strong style={{ color: "#34D399", fontSize: "14px" }}>
                      Conectado com Sucesso ao PostgreSQL!
                    </strong>
                    <p style={{ margin: "2px 0 0", color: "#E2E8F0", fontSize: "12px" }}>
                      Latência do servidor: <strong>{dbDiagData.latencyMs}ms</strong> • Versão:{" "}
                      {dbDiagData.databaseVersion}
                    </p>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>
                    Tabelas Detectadas no Banco:
                  </span>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "6px" }}>
                    {(dbDiagData.existingTables || []).map((t: string) => (
                      <span
                        key={t}
                        style={{
                          background: "var(--bg-input)",
                          border: "1px solid var(--border-subtle)",
                          padding: "3px 8px",
                          borderRadius: "4px",
                          fontSize: "11.5px",
                          color: "#CBD5E1",
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleSyncTables}
                  disabled={syncLoading}
                  style={{
                    background: "var(--bg-card-subtle)",
                    border: "1px solid var(--border-subtle)",
                    color: "#FFF",
                    padding: "10px",
                    borderRadius: "6px",
                    fontSize: "13px",
                    fontWeight: 700,
                  }}
                >
                  <RefreshCw size={14} className={syncLoading ? "animate-spin" : ""} />
                  <span>Sincronizar / Criar Tabelas Automaticamente</span>
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div
                  style={{
                    background: "rgba(245, 158, 11, 0.15)",
                    border: "1px solid rgba(245, 158, 11, 0.4)",
                    borderRadius: "8px",
                    padding: "14px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                  }}
                >
                  <AlertTriangle size={22} color="#F59E0B" style={{ flexShrink: 0, marginTop: "2px" }} />
                  <div>
                    <strong style={{ color: "#FDE68A", fontSize: "13.5px" }}>
                      {dbDiagData?.message || "POSTGRES_URL não configurada"}
                    </strong>
                    <p style={{ margin: "4px 0 0", color: "#E2E8F0", fontSize: "12px", lineHeight: "1.5" }}>
                      Para que o Painel Master gerencie as mesmas oficinas conectadas ao seu sistema, configure a variável no arquivo <code>.env.local</code>.
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    background: "rgba(10, 14, 23, 0.8)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "8px",
                    padding: "14px",
                    fontSize: "12px",
                    color: "var(--text-muted)",
                  }}
                >
                  <strong style={{ color: "#FFF", display: "block", marginBottom: "6px" }}>
                    Como Obter na Vercel:
                  </strong>
                  <ol style={{ paddingLeft: "18px", margin: 0, lineHeight: "1.6" }}>
                    <li>Acesse seu painel na <strong>Vercel (vercel.com)</strong>.</li>
                    <li>Abra seu projeto atual e clique na aba <strong>Storage</strong>.</li>
                    <li>Clique no banco Postgres (Neon) e acesse <strong>.env.local</strong>.</li>
                    <li>Copie o valor de <code>POSTGRES_URL</code> e cole no seu arquivo local.</li>
                  </ol>
                </div>
              </div>
            )}

            <button
              onClick={() => setIsDbModalOpen(false)}
              style={{
                marginTop: "18px",
                width: "100%",
                padding: "10px",
                background: "var(--bg-card-subtle)",
                color: "#FFF",
                borderRadius: "6px",
              }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
