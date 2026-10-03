"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Monitor,
  Smartphone,
  MessageCircle,
  Eye,
  Car,
  Paperclip,
  CheckCheck,
  ChevronDown,
  Filter,
  ArrowRight,
  Activity,
  FileText,
  User,
  ExternalLink,
  Volume2,
  VolumeX,
  Bell,
  BellOff,
  Archive,
  Inbox,
} from "lucide-react";
import { GiravoIcon, GiravoLogo, GiravoAppBadge } from "@/components/GiravoBrand";

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

interface ChatMessage {
  id: string;
  tenantId: string;
  sender: "MASTER" | "CLIENT";
  senderName: string;
  text: string;
  timestamp: string;
  read: boolean;
}

const CORE_FEATURES = [
  { key: "ordens_servico", label: "Ordens de Serviço e Orçamentos", shortLabel: "O.S.", desc: "Abertura de O.S. e cadastro de veículos" },
  { key: "checklist_fotos", label: "Checklist com Fotos da O.S.", shortLabel: "Fotos Vistoria", desc: "Vistoria veicular fotográfica de entrada/saída" },
  { key: "estoque_pecas", label: "Controle de Estoque & Peças", shortLabel: "Estoque", desc: "Controle de peças, compras e margem" },
  { key: "pdv_balcao", label: "Frente de Caixa (PDV Balcão)", shortLabel: "PDV", desc: "Vendas diretas de peças e produtos no balcão" },
  { key: "financeiro", label: "Financeiro & Contas", shortLabel: "Financeiro", desc: "Fluxo de caixa diário e contas a pagar/receber" },
  { key: "whatsapp_crm", label: "WhatsApp CRM & Mensagens", shortLabel: "WhatsApp CRM", desc: "Avisos e relacionamento pelo WhatsApp" },
  { key: "relatorios", label: "Relatórios Gerenciais & DRE", shortLabel: "Relatórios", desc: "Métricas de lucratividade e faturamento" },
];

function featureDefinitions(flags: Record<string, boolean> = {}) {
  const known = new Set(CORE_FEATURES.map((feature) => feature.key));
  const discovered = Object.keys(flags)
    .filter((key) => !known.has(key))
    .sort()
    .map((key) => ({
      key,
      label: key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
      shortLabel: key.replace(/_/g, " "),
      desc: "Módulo sincronizado automaticamente pela oficina",
    }));
  return [...CORE_FEATURES, ...discovered];
}

export default function MasterDashboard() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [masterPassword, setMasterPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Navigation state (Sidebar)
  const [activeNav, setActiveNav] = useState<"tenants" | "operational" | "chat" | "leads" | "db">("tenants");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [dbSource, setDbSource] = useState("");

  // Filters for Tenants Table
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [planFilter, setPlanFilter] = useState("TODOS");

  // Operational View State (Espelho do Cliente com Dados Reais)
  const [selectedOperationalTenantId, setSelectedOperationalTenantId] = useState<string>("");
  const [operationalDeviceMode, setOperationalDeviceMode] = useState<"desktop" | "mobile">("desktop");
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState<string | null>(null);
  const [selectedInspectionModal, setSelectedInspectionModal] = useState<any | null>(null);
  const [operationalData, setOperationalData] = useState<{
    metrics: {
      activeOsCount: number;
      completedOsCount: number;
      monthlyRevenue: string;
      totalPhotosCount: number;
      stockItemsCount: number;
      lowStockCount: number;
      clientsCount: number;
      vehiclesCount: number;
    };
    serviceOrders: any[];
    inspectionPhotos: any[];
    products: any[];
    companySettings: any;
    hasRealData: boolean;
  } | null>(null);
  const [operationalLoading, setOperationalLoading] = useState(false);

  // Chat State & Real-time Notification Engine (WhatsApp Architecture)
  const [selectedChatTenantId, setSelectedChatTenantId] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newChatText, setNewChatText] = useState("");
  const [chatSearch, setChatSearch] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [browserNotifEnabled, setBrowserNotifEnabled] = useState(false);
  const [chatThreads, setChatThreads] = useState<Record<string, { tenantId: string; status: "OPEN" | "ARCHIVED" | "QUEUE"; archivedAt?: string | null }>>({});
  const [chatFilterTab, setChatFilterTab] = useState<"OPEN" | "ARCHIVED" | "ALL">("OPEN");
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const knownMsgIdsRef = useRef<Set<string>>(new Set());
  const isFirstFetchRef = useRef(true);
  const activeNavRef = useRef(activeNav);
  const selectedChatTenantIdRef = useRef(selectedChatTenantId);
  const tenantsRef = useRef<Tenant[]>(tenants);

  useEffect(() => {
    activeNavRef.current = activeNav;
  }, [activeNav]);

  useEffect(() => {
    selectedChatTenantIdRef.current = selectedChatTenantId;
  }, [selectedChatTenantId]);

  useEffect(() => {
    tenantsRef.current = tenants;
  }, [tenants]);

  // Checa se notificações do navegador já estão liberadas
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setBrowserNotifEnabled(Notification.permission === "granted");
    }
  }, []);

  // Sintetizador Web Audio API estilo WhatsApp para mensagem recebida (bip harmônico duplo)
  const playIncomingMessageSound = () => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Primeiro tom (Lá 880Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.22, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.14);

      // Segundo tom harmônico (Mi 1320Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1320, now + 0.08);
      gain2.gain.setValueAtTime(0.26, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.35);
    } catch (err) {
      console.warn("Audio Context error:", err);
    }
  };

  // Sintetizador para mensagem enviada (pop/click característico de envio)
  const playSentMessageSound = () => {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.06);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch (err) {}
  };

  // Solicitar permissão de notificação desktop
  const requestBrowserNotificationPermission = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          setBrowserNotifEnabled(true);
          showToast("Notificações de atendimento ativadas no seu computador!", "success");
        } else {
          showToast("Permissão de notificações não concedida no navegador.", "info");
        }
      } catch (err) {
        console.warn("Notification permission error:", err);
      }
    }
  };

  // Disparar notificação nativa do sistema operacional
  const triggerBrowserNotification = (title: string, body: string, tenantId: string) => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      try {
        const n = new Notification(title, {
          body,
          icon: "/favicon.ico",
          tag: `chat-${tenantId}`,
        });
        n.onclick = () => {
          window.focus();
          setSelectedChatTenantId(tenantId);
          setActiveNav("chat");
          n.close();
        };
      } catch (e) {
        console.warn("Browser Notification error:", e);
      }
    }
  };

  // Modals
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [featuresModalTenant, setFeaturesModalTenant] = useState<Tenant | null>(null);
  const [passwordModalTenant, setPasswordModalTenant] = useState<Tenant | null>(null);
  const [calendarModalTenant, setCalendarModalTenant] = useState<Tenant | null>(null);
  const [daysModalTenant, setDaysModalTenant] = useState<Tenant | null>(null);
  const [customRemainingDays, setCustomRemainingDays] = useState<number>(30);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [actionMenuTenantId, setActionMenuTenantId] = useState<string | null>(null);

  // DB diagnostic modal state
  const [dbDiagData, setDbDiagData] = useState<any>(null);
  const [dbDiagLoading, setDbDiagLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);

  // Form states (Novo Cliente)
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

  // Lead Approval & Credentials Flow States (Aprovação de Teste de 14 Dias sem senha prévia)
  const [approvingLead, setApprovingLead] = useState<Lead | null>(null);
  const [approvalWorkshopName, setApprovalWorkshopName] = useState("");
  const [approvalOwnerName, setApprovalOwnerName] = useState("");
  const [approvalEmail, setApprovalEmail] = useState("");
  const [approvalPhone, setApprovalPhone] = useState("");
  const [approvalPassword, setApprovalPassword] = useState("");
  const [approvalDays, setApprovalDays] = useState(14);
  const [approvalFeatures, setApprovalFeatures] = useState<Record<string, boolean>>({
    ordens_servico: true,
    checklist_fotos: true,
    estoque_pecas: true,
    pdv_balcao: true,
    financeiro: true,
    whatsapp_crm: true,
    relatorios: true,
  });
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvedSuccessData, setApprovedSuccessData] = useState<{
    lead: Lead;
    tenantId: string;
    password: string;
    expiresAt: string;
    workshopUrl: string;
  } | null>(null);
  const [leadFilterTab, setLeadFilterTab] = useState<"PENDING" | "APPROVED" | "REJECTED" | "ALL">("PENDING");
  const [leadSearchTerm, setLeadSearchTerm] = useState("");

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
        fetchChatMessages();
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
        fetchChatMessages();
        showToast("Painel Master autenticado com sucesso!", "success");
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
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setTenants(data.tenants || []);
        setMetrics(data.metrics || { total: 0, active: 0, trial: 0, expired: 0, blocked: 0 });
        setIsDemoMode(Boolean(data.isDemoMode));
        setDbSource(data.dbSource || "");

        // Seleciona primeira oficina se não houver selecionada
        if (!selectedOperationalTenantId && data.tenants && data.tenants.length > 0) {
          setSelectedOperationalTenantId(data.tenants[0].id);
        }
        if (!selectedChatTenantId && data.tenants && data.tenants.length > 0) {
          setSelectedChatTenantId(data.tenants[0].id);
        }
      } else {
        showToast(data.error || "Erro ao carregar oficinas", "error");
        if (data.error && data.error.includes("BANCO_NAO_CONFIGURADO")) {
          setIsDbModalOpen(true);
        }
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
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setLeads(data.leads || []);
      }
    } catch (err) {
      console.warn("Error fetching leads:", err);
    }
  };

  // Fetch operational live data from PostgreSQL (tenant_store & vehicle_checklists)
  const fetchOperationalData = async (tenantId?: string) => {
    const targetId = tenantId || selectedOperationalTenantId;
    if (!targetId) return;
    setOperationalLoading(true);
    try {
      const res = await fetch(`/api/operational?tenantId=${encodeURIComponent(targetId)}`);
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      const data = await res.json();
      if (data.success && data.data) {
        setOperationalData(data.data);
      }
    } catch (err) {
      console.warn("Error fetching operational data:", err);
    } finally {
      setOperationalLoading(false);
    }
  };

  useEffect(() => {
    if (selectedOperationalTenantId && isAuthenticated) {
      fetchOperationalData(selectedOperationalTenantId);
    }
  }, [selectedOperationalTenantId, isAuthenticated, activeNav]);

  // Marcar mensagens de uma oficina como lidas
  const markChatAsRead = async (tenantId: string) => {
    if (!tenantId) return;
    try {
      await fetch("/api/chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      // Atualização imediata no estado local
      setChatMessages((prev) =>
        prev.map((m) =>
          m.tenantId === tenantId && m.sender === "CLIENT" ? { ...m, read: true } : m
        )
      );
    } catch (err) {
      console.warn("Erro ao marcar chat como lido:", err);
    }
  };

  // Fetch Chat Messages com inteligência estilo WhatsApp (detecção de novas mensagens)
  const fetchChatMessages = async (isBackgroundPoll = false) => {
    try {
      const res = await fetch("/api/chat");
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.messages)) {
        const incoming: ChatMessage[] = data.messages;

        // Se não for a primeira carga inicial, detecta novas mensagens recebidas de CLIENTES
        if (!isFirstFetchRef.current) {
          const newClientMsgs = incoming.filter(
            (m) => m.sender === "CLIENT" && !knownMsgIdsRef.current.has(m.id)
          );

          if (newClientMsgs.length > 0) {
            playIncomingMessageSound();

            const latest = newClientMsgs[newClientMsgs.length - 1];
            const senderTenant = tenantsRef.current.find((t) => t.id === latest.tenantId);
            const tenantName = senderTenant ? senderTenant.name : latest.senderName || "Oficina";

            // Dispara notificação nativa do computador (Notification API)
            triggerBrowserNotification(
              `💬 Nova mensagem: ${tenantName}`,
              latest.text,
              latest.tenantId
            );

            // Se o master não estiver na aba chat ou na conversa desta oficina, avisa via toast
            if (
              activeNavRef.current !== "chat" ||
              selectedChatTenantIdRef.current !== latest.tenantId
            ) {
              showToast(`💬 ${tenantName}: "${latest.text.slice(0, 45)}..."`, "info");
            }
          }
        }

        // Armazena todos os IDs conhecidos
        incoming.forEach((m) => knownMsgIdsRef.current.add(m.id));
        isFirstFetchRef.current = false;
        setChatMessages(incoming);

        // Atualiza status das threads (Em Aberto vs Arquivado)
        if (data.threads) {
          setChatThreads(data.threads);
        }

        // Se estiver com a conversa aberta nesta oficina, marca automaticamente como lida no DB
        if (activeNavRef.current === "chat" && selectedChatTenantIdRef.current) {
          const hasUnreadCurrent = incoming.some(
            (m) => m.tenantId === selectedChatTenantIdRef.current && m.sender === "CLIENT" && !m.read
          );
          if (hasUnreadCurrent) {
            markChatAsRead(selectedChatTenantIdRef.current);
          }
        }
      }
    } catch (err) {
      if (!isBackgroundPoll) {
        console.warn("Erro ao buscar mensagens do chat:", err);
      }
    }
  };

  // Polling em segundo plano contínuo (Heartbeat de 2.5s estilo WhatsApp)
  useEffect(() => {
    if (!isAuthenticated) return;

    // Intervalo de polling rápido (chat e novas solicitações de leads)
    const interval = setInterval(() => {
      fetchChatMessages(true);
      fetchLeads();
    }, 3500);

    // Sync instantâneo quando o usuário foca na janela/aba
    const onFocus = () => {
      fetchChatMessages(true);
      fetchLeads();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchChatMessages(true);
        fetchLeads();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isAuthenticated, soundEnabled]);

  // Send Chat Message com feedback sonoro e envio instantâneo otimista
  const handleSendChatMessage = async (customText?: string) => {
    const textToSend = (customText || newChatText).trim();
    if (!textToSend || !selectedChatTenantId) return;

    const tempId = `temp-${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      tenantId: selectedChatTenantId,
      sender: "MASTER",
      senderName: "Suporte Master GIRAVO",
      text: textToSend,
      timestamp: new Date().toISOString(),
      read: false,
    };

    // Feedback imediato na tela e som de mensagem enviada
    setChatMessages((prev) => [...prev, optimisticMessage]);
    // Reabre automaticamente o atendimento caso estivesse arquivado
    setChatThreads((prev) => ({
      ...prev,
      [selectedChatTenantId]: { tenantId: selectedChatTenantId, status: "OPEN" },
    }));
    setNewChatText("");
    playSentMessageSound();

    setTimeout(() => {
      chatScrollRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 40);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: selectedChatTenantId,
          sender: "MASTER",
          senderName: "Suporte Master GIRAVO",
          text: textToSend,
        }),
      });
      const data = await res.json();
      if (data.success && data.message) {
        knownMsgIdsRef.current.add(data.message.id);
        setChatMessages((prev) =>
          prev.map((m) => (m.id === tempId ? data.message : m))
        );
      }
    } catch (err: any) {
      showToast("Erro ao enviar mensagem: " + err.message, "error");
    }
  };

  // Finalizar Atendimento e Arquivar Conversa (sai da caixa de entrada)
  // Aceitar Atendimento na Fila de Processamento
  const handleAcceptChat = async (tenantId: string, tenantName: string) => {
    if (!tenantId) return;
    try {
      const res = await fetch("/api/chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, action: "accept" }),
      });
      const data = await res.json();
      if (data.success) {
        setChatThreads((prev) => ({
          ...prev,
          [tenantId]: { ...(prev[tenantId] || {}), tenantId, status: "OPEN" },
        }));
        showToast(`Atendimento com "${tenantName}" aceito e iniciado!`, "success");
      }
    } catch (err: any) {
      showToast("Erro ao aceitar atendimento: " + err.message, "error");
    }
  };

  const handleArchiveChat = async (tenantId: string, tenantName: string) => {
    if (!tenantId) return;
    try {
      const res = await fetch("/api/chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, action: "archive" }),
      });
      const data = await res.json();
      if (data.success) {
        setChatThreads((prev) => ({
          ...prev,
          [tenantId]: { tenantId, status: "ARCHIVED", archivedAt: new Date().toISOString() },
        }));
        setChatMessages((prev) =>
          prev.map((m) => (m.tenantId === tenantId ? { ...m, read: true } : m))
        );
        showToast(`Atendimento com "${tenantName}" finalizado! A conversa foi arquivada.`, "success");
      }
    } catch (err: any) {
      showToast("Erro ao finalizar atendimento: " + err.message, "error");
    }
  };

  // Reabrir Atendimento Manualmente
  const handleReopenChat = async (tenantId: string, tenantName: string) => {
    if (!tenantId) return;
    try {
      const res = await fetch("/api/chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, action: "reopen" }),
      });
      const data = await res.json();
      if (data.success) {
        setChatThreads((prev) => ({
          ...prev,
          [tenantId]: { tenantId, status: "OPEN" },
        }));
        showToast(`Atendimento com "${tenantName}" reaberto na caixa de entrada.`, "info");
      }
    } catch (err: any) {
      showToast("Erro ao reabrir atendimento: " + err.message, "error");
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

  // Open modal to modify remaining days
  const handleOpenDaysModal = (tenant: Tenant) => {
    let currentRemaining = 30;
    if (tenant.expires_at) {
      const diff = Math.ceil((new Date(tenant.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      currentRemaining = diff > 0 ? diff : 0;
    }
    setCustomRemainingDays(currentRemaining);
    setDaysModalTenant(tenant);
  };

  // Save modified remaining days
  const handleSaveRemainingDays = async () => {
    if (!daysModalTenant) return;
    try {
      const res = await fetch("/api/tenants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: daysModalTenant.id,
          setRemainingDays: Number(customRemainingDays),
          status: "ACTIVE",
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(
          `Validade de "${daysModalTenant.name}" definida para ${customRemainingDays} dias restantes!`,
          "success"
        );
        setDaysModalTenant(null);
        fetchTenants();
      } else {
        showToast(data.error || "Erro ao atualizar dias restantes", "error");
      }
    } catch (err: any) {
      showToast("Erro: " + err.message, "error");
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
      [featureKey]: currentFlags[featureKey] === false,
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
      preset = Object.fromEntries(
        featureDefinitions(featuresModalTenant.enabled_features).map((feature) => [feature.key, true])
      );
    } else {
      preset = Object.fromEntries(
        featureDefinitions(featuresModalTenant.enabled_features).map((feature) => [
          feature.key,
          feature.key === "ordens_servico" || feature.key === "checklist_fotos",
        ])
      );
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
      const res = await fetch(`/api/tenants?tenantId=${encodeURIComponent(tenantId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setChatMessages((prev) => prev.filter((message) => message.tenantId !== tenantId));
        setSelectedChatTenantId((current) => current === tenantId ? "" : current);
        setSelectedOperationalTenantId((current) => current === tenantId ? "" : current);
        showToast(`Oficina "${tenantName}" e todos os dados vinculados foram removidos.`, "info");
        fetchTenants();
      } else {
        showToast(data.error || "Não foi possível excluir a conta.", "error");
      }
    } catch (err: any) {
      showToast("Erro ao excluir: " + err.message, "error");
    }
  };

  // Quick navigation helpers
  const handleViewOperational = (tenantId: string) => {
    setSelectedOperationalTenantId(tenantId);
    setActiveNav("operational");
    fetchOperationalData(tenantId);
  };

  const handleOpenChat = (tenantId: string) => {
    setSelectedChatTenantId(tenantId);
    setActiveNav("chat");
  };

  // Gerador de senhas seguras e fáceis para aprovação de teste
  const generateRandomPassword = () => {
    const prefixes = ["GIRAVO", "GIRO", "AUTO", "TURBO", "OFICINA"];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${num}`;
  };

  // Iniciar aprovação de lead (abre modal dedicado de aprovação com senha gerada)
  const handleStartApproval = (lead: Lead) => {
    setApprovingLead(lead);
    setApprovalWorkshopName(lead.workshop_name || (lead.name ? `${lead.name} Oficina` : "Oficina GIRAVO"));
    setApprovalOwnerName(lead.name || "Proprietário");
    setApprovalEmail(lead.email || "");
    setApprovalPhone(lead.phone || "");
    setApprovalPassword(generateRandomPassword());
    setApprovalDays(14);
    setApprovalFeatures({
      ordens_servico: true,
      checklist_fotos: true,
      estoque_pecas: true,
      pdv_balcao: true,
      financeiro: true,
      whatsapp_crm: true,
      relatorios: true,
    });
  };

  // Confirmar aprovação e criar conta da oficina
  const handleConfirmApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approvingLead) return;
    setApprovalLoading(true);

    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: approvingLead.id,
          name: approvalWorkshopName,
          ownerName: approvalOwnerName,
          email: approvalEmail,
          phone: approvalPhone,
          password: approvalPassword,
          plan: "TRIAL",
          status: "TRIAL",
          daysValid: approvalDays,
          enabledFeatures: approvalFeatures,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Oficina "${approvalWorkshopName}" aprovada e liberada com sucesso!`, "success");
        setLeads((prev) =>
          prev.map((l) =>
            l.id === approvingLead.id
              ? { ...l, status: "APPROVED", tenant_id: data.tenantId }
              : l
          )
        );
        fetchTenants();
        fetchLeads();

        const originUrl = typeof window !== "undefined" ? window.location.origin : "";
        const workshopUrl = originUrl.includes("3005")
          ? originUrl.replace("3005", "3000")
          : "https://app.giravo.com.br";

        setApprovedSuccessData({
          lead: approvingLead,
          tenantId: data.tenantId,
          password: approvalPassword,
          expiresAt: data.expiresAt,
          workshopUrl,
        });

        setApprovingLead(null);
      } else {
        showToast(data.error || "Erro ao aprovar oficina", "error");
      }
    } catch (err: any) {
      showToast("Erro: " + err.message, "error");
    } finally {
      setApprovalLoading(false);
    }
  };

  // Recusar solicitação de teste
  const handleRejectLead = async (leadId: string, leadName: string) => {
    if (!confirm(`Deseja recusar a solicitação de teste de "${leadName}"?`)) return;
    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, status: "REJECTED" }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Solicitação de "${leadName}" marcada como recusada.`, "info");
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, status: "REJECTED" } : l))
        );
      }
    } catch (err: any) {
      showToast("Erro: " + err.message, "error");
    }
  };

  // Reabrir solicitação recusada
  const handleReopenLead = async (leadId: string) => {
    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId, status: "PENDING_APPROVAL" }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Solicitação reaberta para aprovação!", "success");
        setLeads((prev) =>
          prev.map((l) => (l.id === leadId ? { ...l, status: "PENDING_APPROVAL" } : l))
        );
      }
    } catch (err: any) {
      showToast("Erro: " + err.message, "error");
    }
  };

  // Excluir solicitação permanentemente
  const handleDeleteLead = async (leadId: string) => {
    if (!confirm("Excluir esta solicitação permanentemente?")) return;
    try {
      const res = await fetch("/api/leads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("Solicitação excluída.", "info");
        setLeads((prev) => prev.filter((l) => l.id !== leadId));
      }
    } catch (err: any) {
      showToast("Erro: " + err.message, "error");
    }
  };

  // Gerador de mensagem formatada de boas-vindas para WhatsApp
  const getWhatsAppMessageText = (params: {
    ownerName: string;
    workshopName: string;
    email: string;
    password: string;
    url: string;
    days: number;
  }) => {
    return (
      `🎉 *Olá, ${params.ownerName}!* Tudo bem?\n\n` +
      `Sua solicitação de teste de ${params.days} dias no sistema *GIRAVO* para a oficina *${params.workshopName}* foi *APROVADA* com sucesso! 🚀\n\n` +
      `Aqui estão seus dados de acesso exclusivos:\n` +
      `🔗 *Link do Sistema:* ${params.url}\n` +
      `👤 *E-mail de Login:* ${params.email}\n` +
      `🔑 *Senha Provisória:* ${params.password}\n\n` +
      `Seus módulos de Ordens de Serviço, Fotos de Vistoria, Estoque e Financeiro já estão 100% liberados para você usar.\n\n` +
      `Aproveite para cadastrar seus primeiros clientes e emitir sua primeira O.S.!\n` +
      `Se tiver qualquer dúvida, basta responder aqui. Bem-vindo ao GIRAVO!`
    );
  };

  // Convert Lead to Tenant (redireciona para o modal de aprovação)
  const handleConvertLead = (lead: Lead) => {
    handleStartApproval(lead);
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

  // Selected Tenant for Operational Mirror
  const currentOperationalTenant =
    tenants.find((t) => t.id === selectedOperationalTenantId) || tenants[0];

  // Total de Mensagens Não Lidas de Clientes
  const totalUnreadMessages = chatMessages.filter(
    (m) => m.sender === "CLIENT" && !m.read
  ).length;

  // Atualiza título da aba no navegador com contador estilo WhatsApp Web
  useEffect(() => {
    if (totalUnreadMessages > 0) {
      document.title = `(${totalUnreadMessages}) 💬 Atendimento Master | GIRAVO`;
    } else {
      document.title = "GIRAVO Painel Master | Gestão que faz seu negócio girar";
    }
  }, [totalUnreadMessages]);

  // Contadores de Atendimentos Abertos vs Arquivados
  const openThreadsCount = tenants.filter((t) => {
    const thread = chatThreads[t.id];
    const msgs = chatMessages.filter((m) => m.tenantId === t.id);
    const hasUnread = msgs.some((m) => m.sender === "CLIENT" && !m.read);
    return hasUnread || thread?.status !== "ARCHIVED";
  }).length;

  const archivedThreadsCount = tenants.filter((t) => {
    const thread = chatThreads[t.id];
    const msgs = chatMessages.filter((m) => m.tenantId === t.id);
    const hasUnread = msgs.some((m) => m.sender === "CLIENT" && !m.read);
    return thread?.status === "ARCHIVED" && !hasUnread;
  }).length;

  // Contagens e Filtros para Solicitações de Teste de 14 Dias (Leads)
  const isPendingStatus = (st?: string) =>
    !st || st === "PENDING_APPROVAL" || st === "NEW" || st === "PENDING";
  const isApprovedStatus = (st?: string) =>
    st === "APPROVED" || st === "CONVERTED";
  const isRejectedStatus = (st?: string) =>
    st === "REJECTED";

  const pendingLeadsCount = leads.filter((l) => isPendingStatus(l.status)).length;
  const approvedLeadsCount = leads.filter((l) => isApprovedStatus(l.status)).length;
  const rejectedLeadsCount = leads.filter((l) => isRejectedStatus(l.status)).length;

  const filteredLeads = leads.filter((l) => {
    // 1. Filtro por status
    if (leadFilterTab === "PENDING" && !isPendingStatus(l.status)) return false;
    if (leadFilterTab === "APPROVED" && !isApprovedStatus(l.status)) return false;
    if (leadFilterTab === "REJECTED" && !isRejectedStatus(l.status)) return false;

    // 2. Filtro por busca de texto
    if (!leadSearchTerm.trim()) return true;
    const q = leadSearchTerm.toLowerCase();
    return (
      (l.name && l.name.toLowerCase().includes(q)) ||
      (l.workshop_name && l.workshop_name.toLowerCase().includes(q)) ||
      (l.email && l.email.toLowerCase().includes(q)) ||
      (l.phone && l.phone.includes(q)) ||
      (l.notes && l.notes.toLowerCase().includes(q))
    );
  });

  // Lista de Oficinas para o Chat Filtrada e Ordenada (Estilo WhatsApp + Inbox Zero)
  const sortedChatTenants = [...tenants]
    .filter((t) => {
      // 1. Filtro por busca de texto
      if (chatSearch) {
        const q = chatSearch.toLowerCase();
        const matches =
          t.name.toLowerCase().includes(q) ||
          (t.owner_name && t.owner_name.toLowerCase().includes(q)) ||
          (t.phone && t.phone.includes(q));
        if (!matches) return false;
      }

      const thread = chatThreads[t.id];
      const msgs = chatMessages.filter((m) => m.tenantId === t.id);
      const hasUnread = msgs.some((m) => m.sender === "CLIENT" && !m.read);

      // Regra de Ouro solicitada:
      // "a conversa fica arquivada na conta do cliente, pra sair da caixa de entrada no chat, só aparece quando chega mensagem nova"
      if (chatFilterTab === "OPEN") {
        if (hasUnread) return true; // Se tem mensagem nova, SEMPRE reaparece na caixa de entrada!
        if (thread?.status === "ARCHIVED") return false; // Sai da caixa de entrada se finalizado
        return true;
      }

      if (chatFilterTab === "ARCHIVED") {
        return thread?.status === "ARCHIVED" && !hasUnread;
      }

      return true;
    })
    .sort((a, b) => {
      const aMsgs = chatMessages.filter((m) => m.tenantId === a.id);
      const bMsgs = chatMessages.filter((m) => m.tenantId === b.id);
      const aLast = aMsgs[aMsgs.length - 1];
      const bLast = bMsgs[bMsgs.length - 1];
      const aTime = aLast ? new Date(aLast.timestamp).getTime() : new Date(a.created_at || 0).getTime();
      const bTime = bLast ? new Date(bLast.timestamp).getTime() : new Date(b.created_at || 0).getTime();
      return bTime - aTime; // Mensagem mais recente vai para o topo!
    });

  // Selected Tenant for Chat
  const currentChatTenant =
    tenants.find((t) => t.id === selectedChatTenantId) || sortedChatTenants[0] || tenants[0];

  const currentChatMessages = chatMessages.filter(
    (m) => m.tenantId === currentChatTenant?.id
  );

  // --------------------------------------------------------------------------
  // AUTHENTICATION SCREEN (GATE) COM BORDAS RETAS
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
          background: "var(--bg-main)",
        }}
      >
        <div
          className="glass-modal"
          style={{
            maxWidth: "420px",
            width: "100%",
            padding: "38px 32px",
            textAlign: "center",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(158, 232, 36, 0.08)",
          }}
        >
          {/* Logo Brand Emblem GIRAVO */}
          <div style={{ marginBottom: "26px" }}>
            <div
              style={{
                width: "68px",
                height: "68px",
                borderRadius: "20px",
                background: "linear-gradient(145deg, #131A26, #0A0E15)",
                border: "1px solid rgba(158, 232, 36, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
                boxShadow: "0 12px 30px rgba(0, 0, 0, 0.6), 0 0 25px rgba(158, 232, 36, 0.18)",
              }}
            >
              <GiravoIcon size={46} color="var(--primary)" />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "4px" }}>
              <h2 style={{ fontSize: "22px", fontWeight: 900, color: "#FFF", letterSpacing: "0.03em", margin: 0 }}>
                GIRAVO
              </h2>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  color: "var(--primary)",
                  background: "rgba(158, 232, 36, 0.12)",
                  border: "1px solid rgba(158, 232, 36, 0.3)",
                  padding: "2px 7px",
                  borderRadius: "4px",
                  letterSpacing: "0.04em",
                }}
              >
                MASTER
              </span>
            </div>

            <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: "4px 0 6px" }}>
              Gestão que faz seu negócio girar.
            </p>
            <p style={{ color: "var(--text-dim)", fontSize: "11px", margin: 0, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" }}>
              Oficinas • Auto centers • Revendas
            </p>
          </div>

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ textAlign: "left" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Senha Mestre de Administrador
              </label>
              <input
                type="password"
                required
                placeholder="Digite sua senha de acesso..."
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  background: "var(--bg-input)",
                  border: "1px solid var(--border-strong)",
                  color: "#FFF",
                  fontSize: "14px",
                  borderRadius: "var(--radius-sm)",
                }}
                autoFocus
              />
            </div>

            {authError && (
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.4)",
                  color: "#FCA5A5",
                  padding: "10px",
                  fontSize: "12.5px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  textAlign: "left",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              style={{
                width: "100%",
                padding: "13px",
                background: "var(--primary)",
                color: "#06080D",
                fontWeight: 800,
                fontSize: "13.5px",
                borderRadius: "var(--radius-sm)",
                marginTop: "4px",
                boxShadow: "0 4px 18px rgba(158, 232, 36, 0.25)",
              }}
            >
              {authLoading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" /> Verificando...
                </>
              ) : (
                <>
                  <Lock size={15} /> Acessar Painel Master GIRAVO
                </>
              )}
            </button>
          </form>

          <div
            style={{
              marginTop: "24px",
              paddingTop: "16px",
              borderTop: "1px solid var(--border-subtle)",
              fontSize: "11.5px",
              color: "var(--text-dim)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <Info size={13} />
            <span>Ambiente seguro protegido por middleware e token HMAC</span>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // MAIN DASHBOARD LAYOUT: SIDEBAR + MAIN CONTENT AREA
  // --------------------------------------------------------------------------
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-main)" }}>
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
            <AlertTriangle size={16} color="var(--rose)" />
          ) : toast.type === "info" ? (
            <Info size={16} color="var(--cyan)" />
          ) : (
            <CheckCircle2 size={16} color="var(--emerald)" />
          )}
          <span style={{ fontSize: "13px", fontWeight: 600 }}>{toast.message}</span>
        </div>
      )}

      {/* ==================================================================== */}
      {/* LEFT SIDEBAR (NAVEGAÇÃO INDUSTRIAL / RETO) */}
      {/* ==================================================================== */}
      <aside
        style={{
          width: sidebarCollapsed ? "72px" : "260px",
          background: "var(--bg-sidebar)",
          borderRight: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          position: "sticky",
          top: 0,
          height: "100vh",
          transition: "width 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          zIndex: 40,
        }}
      >
        {/* Brand / Logo Top */}
        <div
          style={{
            padding: "20px 18px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: sidebarCollapsed ? "center" : "space-between",
          }}
        >
          {!sidebarCollapsed ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "11px",
                  background: "linear-gradient(145deg, #131A26, #0A0E15)",
                  border: "1px solid rgba(158, 232, 36, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.5), 0 0 12px rgba(158, 232, 36, 0.15)",
                  flexShrink: 0,
                }}
              >
                <GiravoIcon size={24} color="var(--primary)" />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <h2 style={{ fontSize: "15px", fontWeight: 900, color: "#FFF", letterSpacing: "0.03em", margin: 0 }}>
                    GIRAVO
                  </h2>
                  <span
                    style={{
                      fontSize: "9px",
                      fontWeight: 800,
                      color: "var(--primary)",
                      background: "rgba(158, 232, 36, 0.12)",
                      border: "1px solid rgba(158, 232, 36, 0.3)",
                      padding: "1px 5px",
                      borderRadius: "4px",
                      letterSpacing: "0.04em",
                    }}
                  >
                    MASTER
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "2px" }}>
                  <span className="pulse-dot" style={{ background: "var(--primary)" }} />
                  <span style={{ fontSize: "9.5px", color: "var(--text-dim)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    CENTRAL DE GESTÃO
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "linear-gradient(145deg, #131A26, #0A0E15)",
                border: "1px solid rgba(158, 232, 36, 0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 10px rgba(158, 232, 36, 0.15)",
              }}
            >
              <GiravoIcon size={22} color="var(--primary)" />
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav style={{ flex: 1, padding: "16px 10px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {/* Tab 1: Clientes & Oficinas */}
          <button
            onClick={() => setActiveNav("tenants")}
            title="Clientes & Oficinas"
            style={{
              width: "100%",
              padding: "11px 14px",
              borderRadius: "var(--radius-sm)",
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
              background: activeNav === "tenants" ? "var(--bg-card-subtle)" : "transparent",
              color: activeNav === "tenants" ? "var(--primary)" : "var(--text-muted)",
              borderLeft: activeNav === "tenants" ? "3px solid var(--primary)" : "3px solid transparent",
              fontSize: "13px",
              fontWeight: activeNav === "tenants" ? 700 : 500,
            }}
          >
            <Users size={18} />
            {!sidebarCollapsed && <span>Clientes & Oficinas</span>}
            {!sidebarCollapsed && tenants.length > 0 && (
              <span
                style={{
                  marginLeft: "auto",
                  background: activeNav === "tenants" ? "rgba(158, 232, 36, 0.16)" : "rgba(255, 255, 255, 0.05)",
                  color: activeNav === "tenants" ? "var(--primary)" : "var(--text-dim)",
                  padding: "1px 6px",
                  borderRadius: "var(--radius-full)",
                  fontSize: "11px",
                  fontWeight: 700,
                }}
              >
                {tenants.length}
              </span>
            )}
          </button>

          {/* Tab 2: Visão Operacional (Espelho do Cliente) */}
          <button
            onClick={() => setActiveNav("operational")}
            title="Visão Operacional do Cliente"
            style={{
              width: "100%",
              padding: "11px 14px",
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
              background: activeNav === "operational" ? "var(--bg-card-subtle)" : "transparent",
              color: activeNav === "operational" ? "var(--primary)" : "var(--text-muted)",
              borderLeft: activeNav === "operational" ? "3px solid var(--primary)" : "3px solid transparent",
              fontSize: "13px",
              fontWeight: activeNav === "operational" ? 700 : 500,
            }}
          >
            <Monitor size={18} />
            {!sidebarCollapsed && <span>Visão Operacional</span>}
            {!sidebarCollapsed && (
              <span
                style={{
                  marginLeft: "auto",
                  background: "rgba(56, 189, 248, 0.15)",
                  color: "#38BDF8",
                  padding: "1px 5px",
                  fontSize: "10px",
                  fontWeight: 800,
                }}
              >
                ESPELHO
              </span>
            )}
          </button>

          {/* Tab 3: Painel de Atendimento (Chat com Oficinas) */}
          <button
            onClick={() => {
              setActiveNav("chat");
              if (selectedChatTenantId) {
                markChatAsRead(selectedChatTenantId);
              }
            }}
            title="Painel de Atendimento e Chat"
            style={{
              width: "100%",
              padding: "11px 14px",
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
              background: activeNav === "chat" ? "var(--bg-card-subtle)" : "transparent",
              color: activeNav === "chat" ? "var(--primary)" : "var(--text-muted)",
              borderLeft: activeNav === "chat" ? "3px solid var(--primary)" : "3px solid transparent",
              fontSize: "13px",
              fontWeight: activeNav === "chat" ? 700 : 500,
            }}
          >
            <MessageCircle size={18} />
            {!sidebarCollapsed && <span>Atendimento & Chat</span>}
            {!sidebarCollapsed && (
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
                {totalUnreadMessages > 0 ? (
                  <span
                    style={{
                      background: "var(--emerald)",
                      color: "#FFF",
                      padding: "2px 7px",
                      fontSize: "11px",
                      fontWeight: 800,
                      boxShadow: "0 0 12px rgba(16, 185, 129, 0.4)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {totalUnreadMessages}
                  </span>
                ) : (
                  <span
                    style={{
                      background: "rgba(16, 185, 129, 0.15)",
                      color: "#34D399",
                      padding: "1px 6px",
                      fontSize: "10.5px",
                      fontWeight: 800,
                    }}
                  >
                    CHAT
                  </span>
                )}
              </div>
            )}
          </button>

          {/* Tab 4: Leads & Degustação */}
          <button
            onClick={() => setActiveNav("leads")}
            title="Leads & Testes Gratuitos"
            style={{
              width: "100%",
              padding: "11px 14px",
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
              background: activeNav === "leads" ? "var(--bg-card-subtle)" : "transparent",
              color: activeNav === "leads" ? "var(--primary)" : "var(--text-muted)",
              borderLeft: activeNav === "leads" ? "3px solid var(--primary)" : "3px solid transparent",
              fontSize: "13px",
              fontWeight: activeNav === "leads" ? 700 : 500,
            }}
          >
            <Sparkles size={18} />
            {!sidebarCollapsed && <span>Solicitações de Teste</span>}
            {!sidebarCollapsed && (
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "6px" }}>
                {pendingLeadsCount > 0 ? (
                  <span
                    style={{
                      background: "rgba(158, 232, 36, 0.2)",
                      color: "var(--primary)",
                      border: "1px solid rgba(158, 232, 36, 0.35)",
                      padding: "2px 7px",
                      borderRadius: "var(--radius-full)",
                      fontSize: "10.5px",
                      fontWeight: 800,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span className="pulse-dot" style={{ background: "var(--primary)", width: "5px", height: "5px" }} />
                    {pendingLeadsCount} {pendingLeadsCount === 1 ? "pendente" : "pendentes"}
                  </span>
                ) : leads.length > 0 ? (
                  <span
                    style={{
                      background: "rgba(255, 255, 255, 0.05)",
                      color: "var(--text-dim)",
                      padding: "1px 6px",
                      borderRadius: "var(--radius-full)",
                      fontSize: "10.5px",
                      fontWeight: 700,
                    }}
                  >
                    {leads.length}
                  </span>
                ) : null}
              </div>
            )}
          </button>

          {/* Tab 5: Conexão & Diagnóstico */}
          <button
            onClick={() => {
              setActiveNav("db");
              fetchDbDiag();
            }}
            title="Banco de Dados & Conexão"
            style={{
              width: "100%",
              padding: "11px 14px",
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
              background: activeNav === "db" ? "var(--bg-card-subtle)" : "transparent",
              color: activeNav === "db" ? "var(--primary)" : "var(--text-muted)",
              borderLeft: activeNav === "db" ? "3px solid var(--primary)" : "3px solid transparent",
              fontSize: "13px",
              fontWeight: activeNav === "db" ? 700 : 500,
            }}
          >
            <Database size={18} />
            {!sidebarCollapsed && <span>Banco & Conexão</span>}
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div style={{ padding: "14px", borderTop: "1px solid var(--border-subtle)" }}>
          {/* Quick New Client Button */}
          {!sidebarCollapsed && (
            <button
              onClick={() => setIsNewModalOpen(true)}
              style={{
                width: "100%",
                padding: "10px",
                background: "var(--primary)",
                color: "#06080D",
                fontWeight: 800,
                fontSize: "12.5px",
                borderRadius: "var(--radius-sm)",
                marginBottom: "12px",
                boxShadow: "0 2px 10px rgba(158, 232, 36, 0.2)",
              }}
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>Nova Oficina</span>
            </button>
          )}

          {/* Database connection badge */}
          <div
            onClick={() => {
              setActiveNav("db");
              fetchDbDiag();
            }}
            style={{
              padding: "8px 10px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              cursor: "pointer",
              marginBottom: "10px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span className="pulse-dot" style={{ background: "var(--emerald)", flexShrink: 0 }} />
            {!sidebarCollapsed && (
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#34D399" }}>PostgreSQL Neon</div>
                <div style={{ fontSize: "10px", color: "var(--text-dim)", whiteSpace: "nowrap" }}>Conectado ao vivo</div>
              </div>
            )}
          </div>

          {/* User & Logout */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {!sidebarCollapsed && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    background: "var(--bg-card-subtle)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  AD
                </div>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#FFF" }}>Administrador</div>
                  <div style={{ fontSize: "10px", color: "var(--text-dim)" }}>Sessão Segura</div>
                </div>
              </div>
            )}
            <button
              onClick={handleLogout}
              title="Encerrar Sessão"
              style={{
                padding: "6px 8px",
                background: "rgba(239, 68, 68, 0.1)",
                color: "#F87171",
                border: "1px solid rgba(239, 68, 68, 0.3)",
              }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ==================================================================== */}
      {/* MAIN CONTENT AREA */}
      {/* ==================================================================== */}
      <main style={{ flex: 1, padding: "26px 32px 60px", minWidth: 0, overflowX: "hidden" }}>
        {/* Top Header Bar */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingBottom: "18px",
            marginBottom: "24px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 800, color: "#FFF", margin: 0, letterSpacing: "-0.01em" }}>
              {activeNav === "tenants" && "Gestão de Clientes & Oficinas"}
              {activeNav === "operational" && "Espelho Operacional da Oficina (Dashboard do Cliente)"}
              {activeNav === "chat" && "Central de Atendimento & Chat com as Oficinas"}
              {activeNav === "leads" && "Leads & Solicitações de Teste (14 Dias)"}
              {activeNav === "db" && "Diagnóstico de Infraestrutura & Banco de Dados"}
            </h1>
            <p style={{ margin: "3px 0 0", color: "var(--text-muted)", fontSize: "12.5px" }}>
              {activeNav === "tenants" && "Controle centralizado de validade, bloqueios e permissões de módulos"}
              {activeNav === "operational" && "Visualize exatamente como o cliente vê o sistema com ordens de serviço, checklist e financeiro"}
              {activeNav === "chat" && "Canal de comunicação direta com os operadores e donos de oficina dentro da plataforma"}
              {activeNav === "leads" && "Oportunidades de novos clientes que pediram degustação pelas páginas de captura"}
              {activeNav === "db" && "Monitoramento de conexão direta com o Neon Serverless e tabelas"}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button
              onClick={fetchTenants}
              style={{
                padding: "8px 14px",
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-muted)",
                fontSize: "12.5px",
                fontWeight: 600,
              }}
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              <span>Atualizar</span>
            </button>

            {activeNav === "tenants" && (
              <button
                onClick={() => setIsNewModalOpen(true)}
                style={{
                  padding: "8px 16px",
                  background: "var(--primary)",
                  color: "#06080D",
                  fontWeight: 800,
                  fontSize: "12.5px",
                  borderRadius: "var(--radius-sm)",
                  boxShadow: "0 2px 10px rgba(158, 232, 36, 0.2)",
                }}
              >
                <Plus size={15} strokeWidth={2.5} />
                <span>Nova Oficina</span>
              </button>
            )}
          </div>
        </header>

        {/* ================================================================== */}
        {/* ABA 1: CLIENTES & OFICINAS (TABELA COMPLETA COM VISUAL RETO) */}
        {/* ================================================================== */}
        {activeNav === "tenants" && (
          <div>
            {/* KPI Metrics Row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "12px",
                marginBottom: "22px",
              }}
            >
              {/* Total */}
              <div
                className="glass-panel"
                onClick={() => setStatusFilter("TODOS")}
                style={{
                  padding: "16px 18px",
                  cursor: "pointer",
                  borderLeft: statusFilter === "TODOS" ? "3px solid #FFF" : "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>
                    Total Oficinas
                  </span>
                  <Building2 size={15} color="var(--text-dim)" />
                </div>
                <h2 style={{ fontSize: "28px", fontWeight: 800, margin: "4px 0 0", color: "#FFF" }}>
                  {metrics.total}
                </h2>
                <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Cadastradas no banco</span>
              </div>

              {/* Ativas */}
              <div
                className="glass-panel"
                onClick={() => setStatusFilter("ACTIVE")}
                style={{
                  padding: "16px 18px",
                  cursor: "pointer",
                  borderLeft: statusFilter === "ACTIVE" ? "3px solid var(--emerald)" : "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: "#34D399", fontWeight: 700, textTransform: "uppercase" }}>
                    Ativas & Em Dia
                  </span>
                  <CheckCircle2 size={15} color="var(--emerald)" />
                </div>
                <h2 style={{ fontSize: "28px", fontWeight: 800, margin: "4px 0 0", color: "#34D399" }}>
                  {metrics.active}
                </h2>
                <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Acesso regular ativo</span>
              </div>

              {/* Em Teste */}
              <div
                className="glass-panel"
                onClick={() => setStatusFilter("TRIAL")}
                style={{
                  padding: "16px 18px",
                  cursor: "pointer",
                  borderLeft: statusFilter === "TRIAL" ? "3px solid var(--cyan)" : "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: "#22D3EE", fontWeight: 700, textTransform: "uppercase" }}>
                    Em Teste (Trial)
                  </span>
                  <Clock size={15} color="var(--cyan)" />
                </div>
                <h2 style={{ fontSize: "28px", fontWeight: 800, margin: "4px 0 0", color: "#22D3EE" }}>
                  {metrics.trial}
                </h2>
                <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Período de 14 dias</span>
              </div>

              {/* Vencidas */}
              <div
                className="glass-panel"
                onClick={() => setStatusFilter("EXPIRED")}
                style={{
                  padding: "16px 18px",
                  cursor: "pointer",
                  borderLeft: statusFilter === "EXPIRED" ? "3px solid var(--amber)" : "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: "#FBBF24", fontWeight: 700, textTransform: "uppercase" }}>
                    Vencidas
                  </span>
                  <Clock size={15} color="var(--amber)" />
                </div>
                <h2 style={{ fontSize: "28px", fontWeight: 800, margin: "4px 0 0", color: "#FBBF24" }}>
                  {metrics.expired}
                </h2>
                <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Prazo expirado</span>
              </div>

              {/* Bloqueadas */}
              <div
                className="glass-panel"
                onClick={() => setStatusFilter("BLOCKED")}
                style={{
                  padding: "16px 18px",
                  cursor: "pointer",
                  borderLeft: statusFilter === "BLOCKED" ? "3px solid var(--rose)" : "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: "#F87171", fontWeight: 700, textTransform: "uppercase" }}>
                    Bloqueadas
                  </span>
                  <Ban size={15} color="var(--rose)" />
                </div>
                <h2 style={{ fontSize: "28px", fontWeight: 800, margin: "4px 0 0", color: "#F87171" }}>
                  {metrics.blocked}
                </h2>
                <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Suspensão manual</span>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: "260px", position: "relative" }}>
                <Search
                  size={15}
                  color="var(--text-dim)"
                  style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }}
                />
                <input
                  type="text"
                  placeholder="Buscar por oficina, responsável, e-mail ou WhatsApp..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: "100%",
                    paddingLeft: "36px",
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

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ background: "var(--bg-card)", minWidth: "150px" }}
              >
                <option value="TODOS">Todos os Status</option>
                <option value="ACTIVE">Ativos</option>
                <option value="TRIAL">Trial (14 Dias)</option>
                <option value="EXPIRED">Vencidos</option>
                <option value="BLOCKED">Bloqueados</option>
              </select>

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
            </div>

            {/* Table */}
            <div className="glass-panel" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                <thead>
                  <tr
                    style={{
                      background: "rgba(8, 11, 17, 0.95)",
                      color: "var(--text-muted)",
                      borderBottom: "1px solid var(--border-subtle)",
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    <th style={{ padding: "14px 18px" }}>Oficina / Responsável</th>
                    <th style={{ padding: "14px 18px" }}>Contato</th>
                    <th style={{ padding: "14px 18px" }}>Status</th>
                    <th style={{ padding: "14px 18px" }}>Vencimento (Clique p/ Mudar)</th>
                    <th style={{ padding: "14px 18px" }}>Operadores</th>
                    <th style={{ padding: "14px 18px", textAlign: "right" }}>Ações Rápidas</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTenants.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-dim)" }}>
                        <Users size={32} style={{ margin: "0 auto 10px", opacity: 0.3 }} />
                        <p style={{ margin: 0, fontSize: "13.5px" }}>Nenhuma oficina encontrada com os filtros atuais.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredTenants.map((t) => {
                      const cleanPhone = (t.phone || "").replace(/\D/g, "");

                      return (
                        <tr
                          key={t.id}
                          style={{
                            borderBottom: "1px solid var(--border-subtle)",
                            transition: "background 0.1s ease",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-card-hover)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          {/* Workshop Name & Plan */}
                          <td style={{ padding: "14px 18px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <div
                                style={{
                                  width: "36px",
                                  height: "36px",
                                  background: "var(--bg-card-subtle)",
                                  border: "1px solid var(--border-subtle)",
                                  color: "var(--primary)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontWeight: 800,
                                  fontSize: "13px",
                                  flexShrink: 0,
                                }}
                              >
                                {t.name.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <strong style={{ color: "#FFF", fontSize: "13.5px", display: "block" }}>
                                  {t.name}
                                </strong>
                                <div style={{ color: "var(--text-muted)", fontSize: "11.5px", marginTop: "2px" }}>
                                  <span>{t.owner_name || "Responsável não informado"}</span>
                                  <span style={{ margin: "0 5px", color: "var(--text-dim)" }}>•</span>
                                  <span
                                    style={{
                                      background: "rgba(255, 255, 255, 0.06)",
                                      padding: "1px 5px",
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
                          <td style={{ padding: "14px 18px" }}>
                            <div style={{ color: "#E2E8F0", fontSize: "12.5px" }}>{t.email}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                              <span style={{ color: "var(--text-muted)", fontSize: "11.5px" }}>{t.phone}</span>
                              {cleanPhone && (
                                <a
                                  href={`https://wa.me/55${cleanPhone}?text=Ol%C3%A1%20${encodeURIComponent(
                                    t.owner_name || t.name
                                  )}%2C%20falo%20do%20suporte%20GIRAVO.`}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Falar no WhatsApp"
                                  style={{
                                    color: "#25D366",
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    textDecoration: "none",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "2px",
                                  }}
                                >
                                  <MessageSquare size={11} /> WhatsApp
                                </a>
                              )}
                            </div>
                          </td>

                          {/* Status */}
                          <td style={{ padding: "14px 18px" }}>
                            {t.status === "BLOCKED" ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  padding: "3px 8px",
                                  fontSize: "11px",
                                  fontWeight: 800,
                                  background: "rgba(239, 68, 68, 0.15)",
                                  color: "#F87171",
                                  border: "1px solid rgba(239, 68, 68, 0.3)",
                                }}
                              >
                                <Ban size={11} /> BLOQUEADO
                              </span>
                            ) : t.expires_at && new Date(t.expires_at) < new Date() ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  padding: "3px 8px",
                                  fontSize: "11px",
                                  fontWeight: 800,
                                  background: "rgba(245, 158, 11, 0.15)",
                                  color: "#FBBF24",
                                  border: "1px solid rgba(245, 158, 11, 0.3)",
                                }}
                              >
                                <Clock size={11} /> VENCIDO
                              </span>
                            ) : t.status === "TRIAL" ? (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  padding: "3px 8px",
                                  fontSize: "11px",
                                  fontWeight: 800,
                                  background: "rgba(6, 182, 212, 0.15)",
                                  color: "#22D3EE",
                                  border: "1px solid rgba(6, 182, 212, 0.3)",
                                }}
                              >
                                <Clock size={11} /> TESTE (14D)
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  padding: "3px 8px",
                                  fontSize: "11px",
                                  fontWeight: 800,
                                  background: "rgba(16, 185, 129, 0.15)",
                                  color: "#34D399",
                                  border: "1px solid rgba(16, 185, 129, 0.3)",
                                }}
                              >
                                <CheckCircle2 size={11} /> ATIVO
                              </span>
                            )}
                          </td>

                          {/* Expiration with Direct Clickable Modifier */}
                          <td style={{ padding: "14px 18px" }}>
                            <div
                              onClick={() => handleOpenDaysModal(t)}
                              title="Clique para modificar os dias restantes desta oficina"
                              style={{
                                cursor: "pointer",
                                padding: "4px 8px",
                                border: "1px solid transparent",
                                display: "inline-block",
                                transition: "all 0.12s ease",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgba(158, 232, 36, 0.1)";
                                e.currentTarget.style.borderColor = "var(--primary)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "transparent";
                                e.currentTarget.style.borderColor = "transparent";
                              }}
                            >
                              {getExpirationBadge(t.expires_at, t.status)}
                            </div>
                          </td>

                          {/* Operators & Last Access */}
                          <td style={{ padding: "14px 18px" }}>
                            <div style={{ color: "#E2E8F0", fontSize: "12.5px" }}>
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
                          <td style={{ padding: "14px 18px", textAlign: "right" }}>
                            <div style={{ display: "flex", gap: "5px", justifyContent: "flex-end", alignItems: "center" }}>
                              {/* Modificar Dias Restantes (Item Solicitado) */}
                              <button
                                onClick={() => handleOpenDaysModal(t)}
                                title="Modificar dias restantes no painel"
                                style={{
                                  background: "rgba(245, 158, 11, 0.15)",
                                  color: "#FBBF24",
                                  border: "1px solid rgba(245, 158, 11, 0.35)",
                                  padding: "5px 8px",
                                  fontSize: "11.5px",
                                  fontWeight: 700,
                                  gap: "3px",
                                }}
                              >
                                <Clock size={12} />
                                <span>Dias</span>
                              </button>

                              {/* +30d */}
                              <button
                                onClick={() => handleAddDays(t.id, 30, t.name)}
                                title="+30 Dias"
                                style={{
                                  background: "rgba(16, 185, 129, 0.15)",
                                  color: "#34D399",
                                  border: "1px solid rgba(16, 185, 129, 0.35)",
                                  padding: "5px 8px",
                                  fontSize: "11.5px",
                                  fontWeight: 700,
                                }}
                              >
                                +30d
                              </button>

                              {/* +1 ano */}
                              <button
                                onClick={() => handleAddDays(t.id, 365, t.name)}
                                title="+1 Ano"
                                style={{
                                  background: "rgba(5, 150, 105, 0.2)",
                                  color: "#6EE7B7",
                                  border: "1px solid rgba(5, 150, 105, 0.4)",
                                  padding: "5px 8px",
                                  fontSize: "11.5px",
                                  fontWeight: 700,
                                }}
                              >
                                +1a
                              </button>

                              {/* Ver Dashboard Operacional */}
                              <button
                                onClick={() => handleViewOperational(t.id)}
                                title="Ver Espelho do Dashboard Operacional do Cliente"
                                style={{
                                  background: "rgba(56, 189, 248, 0.15)",
                                  color: "#38BDF8",
                                  border: "1px solid rgba(56, 189, 248, 0.35)",
                                  padding: "5px 8px",
                                  fontSize: "11.5px",
                                  fontWeight: 700,
                                  gap: "3px",
                                }}
                              >
                                <Monitor size={12} />
                                <span>Espelho</span>
                              </button>

                              {/* Chat */}
                              <button
                                onClick={() => handleOpenChat(t.id)}
                                title="Abrir Chat de Atendimento com esta Oficina"
                                style={{
                                  background: "rgba(16, 185, 129, 0.15)",
                                  color: "#34D399",
                                  border: "1px solid rgba(16, 185, 129, 0.35)",
                                  padding: "5px 8px",
                                  fontSize: "11.5px",
                                  fontWeight: 700,
                                  gap: "3px",
                                }}
                              >
                                <MessageCircle size={12} />
                                <span>Chat</span>
                              </button>

                              {/* Bloquear / Liberar */}
                              <button
                                onClick={() => handleToggleBlock(t.id, t.status, t.name)}
                                title={t.status === "BLOCKED" ? "Desbloquear oficina" : "Bloquear oficina imediatamente"}
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
                                  padding: "5px 8px",
                                  fontSize: "11.5px",
                                  fontWeight: 700,
                                }}
                              >
                                {t.status === "BLOCKED" ? <Unlock size={12} /> : <Lock size={12} />}
                                <span>{t.status === "BLOCKED" ? "Liberar" : "Bloquear"}</span>
                              </button>

                              {/* Módulos */}
                              <button
                                onClick={() => setFeaturesModalTenant(t)}
                                title="Permissões de Módulos"
                                style={{
                                  background: "var(--bg-card-subtle)",
                                  color: "#FFF",
                                  border: "1px solid var(--border-subtle)",
                                  padding: "5px 8px",
                                  fontSize: "11.5px",
                                  fontWeight: 600,
                                }}
                              >
                                <Sliders size={12} />
                              </button>

                              {/* Dropdown More */}
                              <div style={{ position: "relative" }}>
                                <button
                                  onClick={() =>
                                    setActionMenuTenantId(actionMenuTenantId === t.id ? null : t.id)
                                  }
                                  style={{
                                    background: "var(--bg-card-subtle)",
                                    color: "var(--text-muted)",
                                    border: "1px solid var(--border-subtle)",
                                    padding: "5px 7px",
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
                                      marginTop: "4px",
                                      minWidth: "210px",
                                      zIndex: 50,
                                      padding: "4px",
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "2px",
                                    }}
                                  >
                                    <button
                                      onClick={() => {
                                        handleOpenDaysModal(t);
                                        setActionMenuTenantId(null);
                                      }}
                                      style={{
                                        padding: "8px 10px",
                                        justifyContent: "flex-start",
                                        color: "#FBBF24",
                                        fontSize: "12px",
                                        width: "100%",
                                      }}
                                    >
                                      <Clock size={13} color="#FBBF24" />
                                      <span>Modificar Dias Restantes</span>
                                    </button>

                                    <button
                                      onClick={() => {
                                        setPasswordModalTenant(t);
                                        setActionMenuTenantId(null);
                                      }}
                                      style={{
                                        padding: "8px 10px",
                                        justifyContent: "flex-start",
                                        color: "#FFF",
                                        fontSize: "12px",
                                        width: "100%",
                                      }}
                                    >
                                      <KeyRound size={13} color="#FBBF24" />
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
                                        padding: "8px 10px",
                                        justifyContent: "flex-start",
                                        color: "#FFF",
                                        fontSize: "12px",
                                        width: "100%",
                                      }}
                                    >
                                      <CalendarDays size={13} color="#38BDF8" />
                                      <span>Definir Data Específica</span>
                                    </button>

                                    <div style={{ height: "1px", background: "var(--border-subtle)", margin: "3px 0" }} />

                                    <button
                                      onClick={() => {
                                        handleDeleteTenant(t.id, t.name);
                                        setActionMenuTenantId(null);
                                      }}
                                      style={{
                                        padding: "8px 10px",
                                        justifyContent: "flex-start",
                                        color: "#F87171",
                                        fontSize: "12px",
                                        width: "100%",
                                      }}
                                    >
                                      <Trash2 size={13} />
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
          </div>
        )}

        {/* ================================================================== */}
        {/* ABA 2: VISÃO OPERACIONAL DO CLIENTE (ESPELHO DO DASHBOARD DA OFICINA) */}
        {/* ================================================================== */}
        {activeNav === "operational" && (
          <div>
            {/* Top Selector Bar */}
            <div
              className="glass-panel"
              style={{
                padding: "16px 20px",
                marginBottom: "20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1, minWidth: "280px" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>
                  Selecionar Oficina:
                </span>
                <select
                  value={selectedOperationalTenantId}
                  onChange={(e) => {
                    setSelectedOperationalTenantId(e.target.value);
                    fetchOperationalData(e.target.value);
                  }}
                  style={{
                    flex: 1,
                    maxWidth: "360px",
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-strong)",
                    color: "#FFF",
                    fontWeight: 700,
                  }}
                >
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.owner_name}) • {t.status}
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Buttons for this workshop */}
              {currentOperationalTenant && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    onClick={() => fetchOperationalData(selectedOperationalTenantId)}
                    disabled={operationalLoading}
                    title="Recarregar dados reais da oficina diretamente do banco PostgreSQL"
                    style={{
                      background: "rgba(56, 189, 248, 0.15)",
                      color: "#38BDF8",
                      border: "1px solid rgba(56, 189, 248, 0.35)",
                      padding: "6px 12px",
                      fontSize: "12px",
                      fontWeight: 700,
                      gap: "5px",
                      opacity: operationalLoading ? 0.6 : 1,
                    }}
                  >
                    <RefreshCw size={13} style={{ animation: operationalLoading ? "spin 1s linear infinite" : "none" }} />
                    <span>{operationalLoading ? "Atualizando..." : "Sincronizar"}</span>
                  </button>

                  <button
                    onClick={() => handleOpenDaysModal(currentOperationalTenant)}
                    style={{
                      background: "rgba(245, 158, 11, 0.15)",
                      color: "#FBBF24",
                      border: "1px solid rgba(245, 158, 11, 0.35)",
                      padding: "6px 12px",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    <Clock size={13} />
                    <span>Ajustar Dias</span>
                  </button>

                  <button
                    onClick={() => handleOpenChat(currentOperationalTenant.id)}
                    style={{
                      background: "rgba(16, 185, 129, 0.15)",
                      color: "#34D399",
                      border: "1px solid rgba(16, 185, 129, 0.35)",
                      padding: "6px 12px",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    <MessageCircle size={13} />
                    <span>Falar no Chat</span>
                  </button>

                  <button
                    onClick={() => setFeaturesModalTenant(currentOperationalTenant)}
                    style={{
                      background: "var(--bg-card-subtle)",
                      color: "#FFF",
                      border: "1px solid var(--border-subtle)",
                      padding: "6px 12px",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    <Sliders size={13} />
                    <span>Módulos</span>
                  </button>

                  {/* Device toggle */}
                  <div style={{ display: "flex", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", marginLeft: "6px", overflow: "hidden" }}>
                    <button
                      onClick={() => setOperationalDeviceMode("desktop")}
                      title="Visão Desktop"
                      style={{
                        padding: "6px 10px",
                        background: operationalDeviceMode === "desktop" ? "var(--primary)" : "transparent",
                        color: operationalDeviceMode === "desktop" ? "#06080D" : "var(--text-dim)",
                        fontWeight: 700,
                      }}
                    >
                      <Monitor size={14} />
                    </button>
                    <button
                      onClick={() => setOperationalDeviceMode("mobile")}
                      title="Visão Mobile"
                      style={{
                        padding: "6px 10px",
                        background: operationalDeviceMode === "mobile" ? "var(--primary)" : "transparent",
                        color: operationalDeviceMode === "mobile" ? "#06080D" : "var(--text-dim)",
                        fontWeight: 700,
                      }}
                    >
                      <Smartphone size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Operational Mirror Container */}
            {currentOperationalTenant ? (
              <div
                style={{
                  maxWidth: operationalDeviceMode === "mobile" ? "440px" : "100%",
                  margin: operationalDeviceMode === "mobile" ? "0 auto" : "0",
                  transition: "max-width 0.2s ease",
                  border: "1px solid var(--border-strong)",
                  background: "#080B12",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.8)",
                }}
              >
                {/* Simulated Workshop Header */}
                <div
                  style={{
                    background: "#0F1422",
                    padding: "16px 20px",
                    borderBottom: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        background:
                          operationalData?.companySettings?.primaryColor ||
                          currentOperationalTenant.company_settings?.primaryColor ||
                          "#9EE824",
                        color: "#06080D",
                        borderRadius: "var(--radius-sm)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 900,
                        fontSize: "14px",
                      }}
                    >
                      <Wrench size={18} />
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <h3 style={{ fontSize: "15px", fontWeight: 800, color: "#FFF", margin: 0 }}>
                          {operationalData?.companySettings?.tradeName ||
                            operationalData?.companySettings?.name ||
                            currentOperationalTenant.name}
                        </h3>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 800,
                            padding: "1px 6px",
                            background: operationalData?.hasRealData
                              ? "rgba(16, 185, 129, 0.2)"
                              : "rgba(245, 158, 11, 0.2)",
                            color: operationalData?.hasRealData ? "#34D399" : "#FBBF24",
                            border: `1px solid ${
                              operationalData?.hasRealData
                                ? "rgba(16, 185, 129, 0.4)"
                                : "rgba(245, 158, 11, 0.4)"
                            }`,
                          }}
                        >
                          {operationalData?.hasRealData
                            ? "DADOS REAIS SINCRONIZADOS"
                            : "AGUARDANDO DADOS DA OFICINA"}
                        </span>
                      </div>
                      <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "2px" }}>
                        {operationalData?.companySettings?.slogan ||
                          currentOperationalTenant.company_settings?.slogan ||
                          "Centro Automotivo Especializado"}{" "}
                        • WhatsApp: {currentOperationalTenant.phone}
                      </div>
                    </div>
                  </div>

                  {/* Active features badges */}
                  <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                    {featureDefinitions(currentOperationalTenant.enabled_features).map((feat) => {
                      const enabled = currentOperationalTenant.enabled_features?.[feat.key] !== false;
                      return (
                        <span
                          key={feat.key}
                          style={{
                            fontSize: "10.5px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background: enabled ? "rgba(158, 232, 36, 0.15)" : "rgba(255, 255, 255, 0.05)",
                            color: enabled ? "var(--primary)" : "var(--text-dim)",
                            border: `1px solid ${enabled ? "rgba(158, 232, 36, 0.35)" : "var(--border-subtle)"}`,
                          }}
                        >
                          {enabled ? "✓ " : "✗ "}
                          {feat.shortLabel}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Simulated Workshop Metrics */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: operationalDeviceMode === "mobile" ? "1fr 1fr" : "repeat(4, 1fr)",
                    gap: "1px",
                    background: "var(--border-subtle)",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  <div style={{ background: "#0B0E17", padding: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 700 }}>O.S. EM ANDAMENTO</span>
                      <Wrench size={14} color="var(--primary)" />
                    </div>
                    <h4 style={{ fontSize: "24px", fontWeight: 800, margin: "4px 0 0", color: "#FFF" }}>
                      {operationalLoading ? "..." : (operationalData?.metrics?.activeOsCount ?? 0)}
                    </h4>
                    <span style={{ fontSize: "11px", color: "#34D399" }}>
                      {operationalData?.metrics?.completedOsCount ?? 0} concluídas no mês
                    </span>
                  </div>

                  <div style={{ background: "#0B0E17", padding: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 700 }}>FATURAMENTO (MÊS)</span>
                      <DollarSign size={14} color="#10B981" />
                    </div>
                    <h4 style={{ fontSize: "24px", fontWeight: 800, margin: "4px 0 0", color: "#34D399" }}>
                      {operationalLoading ? "..." : (operationalData?.metrics?.monthlyRevenue || "R$ 0,00")}
                    </h4>
                    <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                      {((operationalData?.metrics?.activeOsCount || 0) + (operationalData?.metrics?.completedOsCount || 0))} ordens registradas
                    </span>
                  </div>

                  <div style={{ background: "#0B0E17", padding: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 700 }}>FOTOS DE VISTORIA</span>
                      <Camera size={14} color="#38BDF8" />
                    </div>
                    <h4 style={{ fontSize: "24px", fontWeight: 800, margin: "4px 0 0", color: "#38BDF8" }}>
                      {operationalLoading ? "..." : `${operationalData?.metrics?.totalPhotosCount ?? 0} fotos`}
                    </h4>
                    <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                      {(operationalData?.metrics?.totalPhotosCount || 0) > 0 ? "Inspeção digital ativa" : "Nenhuma foto salva"}
                    </span>
                  </div>

                  <div style={{ background: "#0B0E17", padding: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 700 }}>ITENS NO ESTOQUE</span>
                      <Package size={14} color="#FBBF24" />
                    </div>
                    <h4 style={{ fontSize: "24px", fontWeight: 800, margin: "4px 0 0", color: "#FBBF24" }}>
                      {operationalLoading ? "..." : `${operationalData?.metrics?.stockItemsCount ?? 0} peças`}
                    </h4>
                    <span style={{ fontSize: "11px", color: (operationalData?.metrics?.lowStockCount || 0) > 0 ? "#F87171" : "var(--text-dim)" }}>
                      {operationalData?.metrics?.lowStockCount ?? 0} itens com estoque baixo
                    </span>
                  </div>
                </div>

                {operationalData?.inspectionPhotos && operationalData.inspectionPhotos.length > 0 && (
                  <section style={{ padding: "20px", borderTop: "1px solid var(--border-subtle)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: "12px" }}>
                      <div>
                        <h4 style={{ fontSize: "14px", fontWeight: 800, color: "#FFF", margin: 0 }}>Galeria de vistorias</h4>
                        <p style={{ margin: "3px 0 0", color: "var(--text-dim)", fontSize: "11.5px" }}>
                          Fotos reais enviadas pela oficina, inclusive vistorias ainda sem O.S. vinculada.
                        </p>
                      </div>
                      <span style={{ fontSize: "11px", color: "#38BDF8", fontWeight: 800 }}>
                        {operationalData.inspectionPhotos.length} ARQUIVO(S)
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "10px" }}>
                      {operationalData.inspectionPhotos.map((photo: any, index: number) => {
                        const safeUrl = /^(https?:\/\/|data:image\/|blob:)/i.test(String(photo.url || "")) ? photo.url : "";
                        return (
                          <button key={`${photo.url}-${index}`} onClick={() => safeUrl && setSelectedPhotoPreview(safeUrl)} disabled={!safeUrl}
                            aria-label={`Ampliar ${photo.description || `foto ${index + 1}`}`}
                            style={{ display: "block", padding: 0, textAlign: "left", overflow: "hidden", background: "#080B12", border: "1px solid var(--border-subtle)" }}>
                            {safeUrl ? (
                              <img src={safeUrl} alt={photo.description || `Foto ${index + 1}`} loading="lazy" style={{ width: "100%", height: "112px", objectFit: "cover", display: "block" }} />
                            ) : (
                              <div style={{ height: "112px", display: "grid", placeItems: "center" }}><Camera size={26} color="var(--text-dim)" /></div>
                            )}
                            <span style={{ display: "block", padding: "8px 9px", color: "#FFF", fontSize: "10.5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {photo.osId || "Vistoria"} · {photo.description || `Foto ${index + 1}`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* Simulated Workshop Real Work Orders Table */}
                <div style={{ padding: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <div>
                      <h4 style={{ fontSize: "14px", fontWeight: 800, color: "#FFF", margin: 0 }}>
                        Ordens de Serviço na Oficina
                      </h4>
                      <p style={{ margin: "2px 0 0", color: "var(--text-dim)", fontSize: "11.5px" }}>
                        {operationalData?.hasRealData
                          ? "Dados operacionais sincronizados do PostgreSQL (tenant_store)"
                          : "Aguardando cadastro de ordens pelo aplicativo da oficina"}
                      </p>
                    </div>
                    <span
                      style={{
                        fontSize: "11px",
                        color: operationalData?.hasRealData ? "#34D399" : "var(--text-muted)",
                        background: "#131826",
                        padding: "3px 8px",
                        border: `1px solid ${operationalData?.hasRealData ? "rgba(16, 185, 129, 0.3)" : "var(--border-subtle)"}`,
                      }}
                    >
                      {operationalData?.hasRealData ? "● Ao vivo do banco" : "○ Sem ordens ativas"}
                    </span>
                  </div>

                  {operationalData?.serviceOrders && operationalData.serviceOrders.length > 0 ? (
                    <div style={{ border: "1px solid var(--border-subtle)", overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "12px" }}>
                        <thead>
                          <tr style={{ background: "#0D111C", color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)" }}>
                            <th style={{ padding: "10px 14px" }}>O.S. / VEÍCULO</th>
                            <th style={{ padding: "10px 14px" }}>CLIENTE</th>
                            <th style={{ padding: "10px 14px" }}>SERVIÇO PRINCIPAL</th>
                            <th style={{ padding: "10px 14px" }}>VALOR</th>
                            <th style={{ padding: "10px 14px" }}>VISTORIA (FOTOS)</th>
                            <th style={{ padding: "10px 14px", textAlign: "right" }}>STATUS O.S.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {operationalData.serviceOrders.map((item: any) => (
                            <tr key={item.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                              <td style={{ padding: "12px 14px" }}>
                                <strong style={{ color: "#FFF", fontSize: "12.5px" }}>{item.vehicle}</strong>
                                <div style={{ color: "var(--primary)", fontSize: "11px", fontWeight: 700 }}>
                                  {item.plate} • {item.id}
                                </div>
                              </td>
                              <td style={{ padding: "12px 14px", color: "#E2E8F0" }}>
                                <div>{item.client}</div>
                                {item.clientPhone && (
                                  <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>
                                    {item.clientPhone}
                                  </div>
                                )}
                              </td>
                              <td style={{ padding: "12px 14px", color: "var(--text-muted)" }}>{item.service}</td>
                              <td style={{ padding: "12px 14px" }}>
                                <strong style={{ color: "#FFF" }}>{item.value}</strong>
                              </td>
                              <td style={{ padding: "12px 14px" }}>
                                {item.photosCount > 0 ? (
                                  <button
                                    onClick={() => setSelectedInspectionModal(item)}
                                    style={{
                                      background: "rgba(56, 189, 248, 0.12)",
                                      color: "#38BDF8",
                                      border: "1px solid rgba(56, 189, 248, 0.3)",
                                      padding: "3px 8px",
                                      fontSize: "11px",
                                      fontWeight: 700,
                                      gap: "4px",
                                    }}
                                  >
                                    <Camera size={12} />
                                    <span>{item.photosCount} foto(s) salva(s)</span>
                                  </button>
                                ) : (
                                  <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Sem fotos</span>
                                )}
                              </td>
                              <td style={{ padding: "12px 14px", textAlign: "right" }}>
                                <span
                                  style={{
                                    padding: "2px 8px",
                                    fontSize: "10.5px",
                                    fontWeight: 800,
                                    color: item.statusColor || "#38BDF8",
                                    background: "rgba(255,255,255,0.05)",
                                    border: `1px solid ${item.statusColor || "#38BDF8"}`,
                                  }}
                                >
                                  {item.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: "36px 20px",
                        textAlign: "center",
                        background: "#0A0D15",
                        border: "1px dashed var(--border-subtle)",
                      }}
                    >
                      <Wrench size={32} color="var(--text-dim)" style={{ margin: "0 auto 10px", opacity: 0.5 }} />
                      <h5 style={{ fontSize: "13.5px", color: "#FFF", margin: "0 0 4px" }}>
                        Nenhuma Ordem de Serviço Registrada
                      </h5>
                      <p style={{ fontSize: "12px", color: "var(--text-dim)", maxWidth: "420px", margin: "0 auto" }}>
                        Esta oficina ainda não abriu ordens de serviço no sistema. Quando os operadores cadastrarem veículos e serviços, eles aparecerão aqui em tempo real.
                      </p>
                    </div>
                  )}

                  {/* Peças e Estoque da Oficina */}
                  {operationalData?.products && operationalData.products.length > 0 && (
                    <div style={{ marginTop: "24px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                        <div>
                          <h4 style={{ fontSize: "13.5px", fontWeight: 800, color: "#FFF", margin: 0 }}>
                            Estoque de Peças & Produtos da Oficina ({operationalData.products.length} itens recentes)
                          </h4>
                          <p style={{ margin: "2px 0 0", color: "var(--text-dim)", fontSize: "11px" }}>
                            Monitoramento das peças cadastradas no estoque da oficina
                          </p>
                        </div>
                      </div>

                      <div style={{ border: "1px solid var(--border-subtle)", overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "11.5px" }}>
                          <thead>
                            <tr style={{ background: "#0D111C", color: "var(--text-muted)", borderBottom: "1px solid var(--border-subtle)" }}>
                              <th style={{ padding: "8px 12px" }}>CÓDIGO</th>
                              <th style={{ padding: "8px 12px" }}>DESCRIÇÃO</th>
                              <th style={{ padding: "8px 12px" }}>CATEGORIA</th>
                              <th style={{ padding: "8px 12px" }}>ESTOQUE</th>
                              <th style={{ padding: "8px 12px" }}>LOCALIZAÇÃO</th>
                              <th style={{ padding: "8px 12px", textAlign: "right" }}>PREÇO VENDA</th>
                            </tr>
                          </thead>
                          <tbody>
                            {operationalData.products.map((p: any) => {
                              const isLow = Number(p.stock || 0) <= Number(p.minStock || 5);
                              return (
                                <tr key={p.id || p.code} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                                  <td style={{ padding: "9px 12px", color: "var(--primary)", fontWeight: 700 }}>{p.code || p.id}</td>
                                  <td style={{ padding: "9px 12px", color: "#FFF", fontWeight: 600 }}>{p.description || p.name}</td>
                                  <td style={{ padding: "9px 12px", color: "var(--text-muted)" }}>{p.category || "Geral"}</td>
                                  <td style={{ padding: "9px 12px" }}>
                                    <span
                                      style={{
                                        padding: "2px 6px",
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        color: isLow ? "#F87171" : "#34D399",
                                        background: isLow ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)",
                                        border: `1px solid ${isLow ? "rgba(239, 68, 68, 0.3)" : "rgba(16, 185, 129, 0.3)"}`,
                                      }}
                                    >
                                      {p.stock} un {isLow ? "(Baixo)" : ""}
                                    </span>
                                  </td>
                                  <td style={{ padding: "9px 12px", color: "var(--text-dim)" }}>{p.location || "Padrão"}</td>
                                  <td style={{ padding: "9px 12px", textAlign: "right", color: "#FFF", fontWeight: 700 }}>
                                    {typeof p.salePrice === "number"
                                      ? p.salePrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                                      : p.salePrice || "R$ 0,00"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Operational Details Card */}
                  <div
                    style={{
                      marginTop: "20px",
                      display: "grid",
                      gridTemplateColumns: operationalDeviceMode === "mobile" ? "1fr" : "1fr 1fr",
                      gap: "14px",
                    }}
                  >
                    <div
                      style={{
                        background: "#0D111C",
                        border: "1px solid var(--border-subtle)",
                        padding: "16px",
                      }}
                    >
                      <h5 style={{ fontSize: "12.5px", color: "var(--primary)", margin: "0 0 10px" }}>
                        Ficha Cadastral da Oficina
                      </h5>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
                        <div>ID do Tenant: <strong style={{ color: "#FFF" }}>{currentOperationalTenant.id}</strong></div>
                        <div>Proprietário: <strong style={{ color: "#FFF" }}>{currentOperationalTenant.owner_name}</strong></div>
                        <div>E-mail de Login: <strong style={{ color: "#FFF" }}>{currentOperationalTenant.email}</strong></div>
                        <div>WhatsApp Oficial: <strong style={{ color: "#FFF" }}>{currentOperationalTenant.phone}</strong></div>
                        <div>Plano Atual: <strong style={{ color: "#FFF" }}>{currentOperationalTenant.plan}</strong></div>
                        <div>Data de Expiração: <strong style={{ color: "#34D399" }}>{currentOperationalTenant.expires_at ? new Date(currentOperationalTenant.expires_at).toLocaleDateString("pt-BR") : "Sem limite"}</strong></div>
                      </div>
                    </div>

                    <div
                      style={{
                        background: "#0D111C",
                        border: "1px solid var(--border-subtle)",
                        padding: "16px",
                      }}
                    >
                      <h5 style={{ fontSize: "12.5px", color: "#38BDF8", margin: "0 0 10px" }}>
                        Status dos Módulos Liberados no App
                      </h5>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "11.5px" }}>
                        {[
                          { label: "Ordens de Serviço", key: "ordens_servico" },
                          { label: "Checklist com Fotos", key: "checklist_fotos" },
                          { label: "Estoque de Peças", key: "estoque_pecas" },
                          { label: "PDV Balcão", key: "pdv_balcao" },
                          { label: "Contas a Pagar/Rec.", key: "financeiro" },
                          { label: "WhatsApp CRM", key: "whatsapp_crm" },
                        ].map((m) => {
                          const active = currentOperationalTenant.enabled_features?.[m.key] !== false;
                          return (
                            <div key={m.key} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span
                                style={{
                                  width: "8px",
                                  height: "8px",
                                  background: active ? "var(--emerald)" : "var(--rose)",
                                }}
                              />
                              <span style={{ color: active ? "#FFF" : "var(--text-dim)" }}>{m.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
                Nenhuma oficina selecionada.
              </div>
            )}
          </div>
        )}

        {/* ================================================================== */}
        {/* ABA 3: PAINEL DE ATENDIMENTO & CHAT COM AS OFICINAS (ESTILO WHATSAPP) */}
        {/* ================================================================== */}
        {activeNav === "chat" && (
          <div
            className="glass-panel"
            style={{
              height: "calc(100vh - 165px)",
              display: "flex",
              border: "1px solid var(--border-subtle)",
              overflow: "hidden",
            }}
          >
            {/* -------------------------------------------------------------- */}
            {/* COLUNA ESQUERDA: LISTA DE CONVERSAS (ORDENADA POR ATIVIDADE)   */}
            {/* -------------------------------------------------------------- */}
            <div
              style={{
                width: "350px",
                borderRight: "1px solid var(--border-subtle)",
                display: "flex",
                flexDirection: "column",
                background: "var(--bg-sidebar)",
                flexShrink: 0,
              }}
            >
              {/* Header da Lista com Controles de Som e Notificação */}
              <div
                style={{
                  padding: "14px 16px",
                  borderBottom: "1px solid var(--border-subtle)",
                  background: "rgba(10, 14, 22, 0.98)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <h3 style={{ fontSize: "14px", fontWeight: 800, color: "#FFF", margin: 0 }}>
                      Conversas
                    </h3>
                    {totalUnreadMessages > 0 && (
                      <span
                        style={{
                          background: "var(--emerald)",
                          color: "#FFF",
                          padding: "1px 7px",
                          fontSize: "11px",
                          fontWeight: 800,
                        }}
                      >
                        {totalUnreadMessages} nova(s)
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "3px" }}>
                    <span className="pulse-dot" style={{ background: "var(--emerald)", width: "6px", height: "6px" }} />
                    <span style={{ fontSize: "10.5px", color: "var(--text-dim)", fontWeight: 600 }}>
                      Ao vivo • Polling 2.5s
                    </span>
                  </div>
                </div>

                {/* Controles de Áudio e Notificação Desktop */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !soundEnabled;
                      setSoundEnabled(next);
                      if (next) playIncomingMessageSound();
                      showToast(next ? "Som do chat ativado!" : "Som do chat silenciado.", "info");
                    }}
                    title={soundEnabled ? "Silenciar notificações sonoras" : "Ativar notificações sonoras"}
                    style={{
                      background: soundEnabled ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                      color: soundEnabled ? "#34D399" : "#F87171",
                      border: `1px solid ${soundEnabled ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                      padding: "5px 8px",
                      fontSize: "11px",
                      fontWeight: 700,
                      gap: "4px",
                    }}
                  >
                    {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                    <span>{soundEnabled ? "Som Ativo" : "Mudo"}</span>
                  </button>

                  {!browserNotifEnabled && (
                    <button
                      type="button"
                      onClick={requestBrowserNotificationPermission}
                      title="Ativar notificações na área de trabalho do computador"
                      style={{
                        background: "rgba(56, 189, 248, 0.15)",
                        color: "#38BDF8",
                        border: "1px solid rgba(56, 189, 248, 0.3)",
                        padding: "5px 8px",
                        fontSize: "11px",
                        fontWeight: 700,
                      }}
                    >
                      <Bell size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Abas de Filtro da Caixa de Entrada (Em Aberto vs Finalizados) */}
              <div
                style={{
                  display: "flex",
                  borderBottom: "1px solid var(--border-subtle)",
                  background: "rgba(8, 11, 17, 0.95)",
                }}
              >
                <button
                  type="button"
                  onClick={() => setChatFilterTab("OPEN")}
                  style={{
                    flex: 1,
                    padding: "9px 6px",
                    fontSize: "11px",
                    fontWeight: chatFilterTab === "OPEN" ? 800 : 500,
                    color: chatFilterTab === "OPEN" ? "var(--primary)" : "var(--text-muted)",
                    borderBottom: chatFilterTab === "OPEN" ? "2px solid var(--primary)" : "2px solid transparent",
                    background: chatFilterTab === "OPEN" ? "var(--bg-card-subtle)" : "transparent",
                    gap: "4px",
                    justifyContent: "center",
                  }}
                >
                  <Inbox size={12} />
                  <span>Em Aberto</span>
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "1px 5px",
                      background: chatFilterTab === "OPEN" ? "rgba(158, 232, 36, 0.2)" : "rgba(255,255,255,0.06)",
                      color: chatFilterTab === "OPEN" ? "var(--primary)" : "var(--text-dim)",
                      borderRadius: "var(--radius-full)",
                      fontWeight: 700,
                    }}
                  >
                    {openThreadsCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setChatFilterTab("ARCHIVED")}
                  style={{
                    flex: 1,
                    padding: "9px 6px",
                    fontSize: "11px",
                    fontWeight: chatFilterTab === "ARCHIVED" ? 800 : 500,
                    color: chatFilterTab === "ARCHIVED" ? "#38BDF8" : "var(--text-muted)",
                    borderBottom: chatFilterTab === "ARCHIVED" ? "2px solid #38BDF8" : "2px solid transparent",
                    background: chatFilterTab === "ARCHIVED" ? "var(--bg-card-subtle)" : "transparent",
                    gap: "4px",
                    justifyContent: "center",
                  }}
                >
                  <Archive size={12} />
                  <span>Finalizados</span>
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "1px 5px",
                      background: chatFilterTab === "ARCHIVED" ? "rgba(56, 189, 248, 0.2)" : "rgba(255,255,255,0.06)",
                      color: chatFilterTab === "ARCHIVED" ? "#38BDF8" : "var(--text-dim)",
                      fontWeight: 700,
                    }}
                  >
                    {archivedThreadsCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setChatFilterTab("ALL")}
                  style={{
                    padding: "9px 10px",
                    fontSize: "11px",
                    fontWeight: chatFilterTab === "ALL" ? 800 : 500,
                    color: chatFilterTab === "ALL" ? "#FFF" : "var(--text-dim)",
                    borderBottom: chatFilterTab === "ALL" ? "2px solid #FFF" : "2px solid transparent",
                    background: chatFilterTab === "ALL" ? "var(--bg-card-subtle)" : "transparent",
                    justifyContent: "center",
                  }}
                >
                  Todos ({tenants.length})
                </button>
              </div>

              {/* Barra de Busca de Contatos */}
              <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-input)" }}>
                <div style={{ position: "relative" }}>
                  <Search
                    size={14}
                    color="var(--text-dim)"
                    style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }}
                  />
                  <input
                    type="text"
                    placeholder="Buscar oficina ou cliente..."
                    value={chatSearch}
                    onChange={(e) => setChatSearch(e.target.value)}
                    style={{
                      width: "100%",
                      paddingLeft: "32px",
                      paddingRight: chatSearch ? "28px" : "10px",
                      fontSize: "12px",
                      background: "rgba(13, 17, 26, 0.9)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  />
                  {chatSearch && (
                    <button
                      onClick={() => setChatSearch("")}
                      style={{
                        position: "absolute",
                        right: "8px",
                        top: "50%",
                        transform: "translateY(-50%)",
                        color: "var(--text-dim)",
                      }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* Lista Dinâmica com Rolagem e Ordenação WhatsApp */}
              <div style={{ flex: 1, overflowY: "auto" }}>
                {sortedChatTenants.length === 0 ? (
                  <div style={{ padding: "30px 16px", textAlign: "center", color: "var(--text-dim)", fontSize: "12px" }}>
                    Nenhuma oficina encontrada na busca.
                  </div>
                ) : (
                  sortedChatTenants.map((t) => {
                    const isSelected = currentChatTenant?.id === t.id;
                    const msgs = chatMessages.filter((m) => m.tenantId === t.id);
                    const lastMsg = msgs[msgs.length - 1];
                    const unreadCount = msgs.filter((m) => m.sender === "CLIENT" && !m.read).length;

                    // Formatação de data/hora estilo WhatsApp
                    let timeFormatted = "";
                    if (lastMsg) {
                      const msgDate = new Date(lastMsg.timestamp);
                      const isToday = msgDate.toDateString() === new Date().toDateString();
                      timeFormatted = isToday
                        ? msgDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : msgDate.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
                    }

                    return (
                      <div
                        key={t.id}
                        onClick={() => {
                          setSelectedChatTenantId(t.id);
                          markChatAsRead(t.id);
                        }}
                        style={{
                          padding: "12px 14px",
                          borderBottom: "1px solid var(--border-subtle)",
                          cursor: "pointer",
                          background: isSelected ? "var(--bg-card-subtle)" : "transparent",
                          borderLeft: isSelected ? "3px solid var(--primary)" : "3px solid transparent",
                          transition: "background 0.1s ease",
                          display: "flex",
                          gap: "12px",
                          alignItems: "center",
                        }}
                      >
                        {/* Avatar do cliente */}
                        <div
                          style={{
                            width: "42px",
                            height: "42px",
                            borderRadius: "var(--radius-sm)",
                            background: isSelected ? "var(--primary)" : "#131826",
                            border: "1px solid var(--border-subtle)",
                            color: isSelected ? "#06080D" : "var(--primary)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 800,
                            fontSize: "14px",
                            flexShrink: 0,
                            position: "relative",
                          }}
                        >
                          {t.name.slice(0, 2).toUpperCase()}
                          <span
                            style={{
                              position: "absolute",
                              bottom: "-2px",
                              right: "-2px",
                              width: "10px",
                              height: "10px",
                              background:
                                t.status === "ACTIVE"
                                  ? "var(--emerald)"
                                  : t.status === "BLOCKED"
                                  ? "var(--rose)"
                                  : "var(--amber)",
                              border: "2px solid var(--bg-sidebar)",
                            }}
                          />
                        </div>

                        {/* Conteúdo da Conversa */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "3px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                              <strong
                                style={{
                                  fontSize: "13px",
                                  color: isSelected ? "var(--primary)" : unreadCount > 0 ? "#FFF" : "#E2E8F0",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  fontWeight: unreadCount > 0 ? 800 : 600,
                                }}
                              >
                                {t.name}
                              </strong>
                              {chatThreads[t.id]?.status === "ARCHIVED" && (
                                <span
                                  style={{
                                    fontSize: "9.5px",
                                    padding: "1px 5px",
                                    background: "rgba(56, 189, 248, 0.15)",
                                    color: "#38BDF8",
                                    fontWeight: 700,
                                    flexShrink: 0,
                                  }}
                                >
                                  Arquivado
                                </span>
                              )}
                            </div>
                            {timeFormatted && (
                              <span
                                style={{
                                  fontSize: "10.5px",
                                  color: unreadCount > 0 ? "var(--emerald)" : "var(--text-dim)",
                                  fontWeight: unreadCount > 0 ? 700 : 500,
                                  marginLeft: "6px",
                                  flexShrink: 0,
                                }}
                              >
                                {timeFormatted}
                              </span>
                            )}
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                            <p
                              style={{
                                margin: 0,
                                fontSize: "11.5px",
                                color: unreadCount > 0 ? "#F8FAFC" : "var(--text-muted)",
                                fontWeight: unreadCount > 0 ? 700 : 400,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                              }}
                            >
                              {lastMsg ? (
                                <>
                                  {lastMsg.sender === "MASTER" && (
                                    <CheckCheck size={13} color={lastMsg.read ? "#53BDEB" : "#8696A0"} style={{ flexShrink: 0 }} />
                                  )}
                                  <span>{lastMsg.sender === "MASTER" ? `Você: ${lastMsg.text}` : lastMsg.text}</span>
                                </>
                              ) : (
                                <span style={{ color: "var(--text-dim)", fontStyle: "italic" }}>Nenhuma mensagem anterior</span>
                              )}
                            </p>

                            {unreadCount > 0 && (
                              <span
                                style={{
                                  background: "var(--emerald)",
                                  color: "#FFF",
                                  fontSize: "10.5px",
                                  fontWeight: 800,
                                  padding: "2px 6px",
                                  flexShrink: 0,
                                  boxShadow: "0 0 8px rgba(16, 185, 129, 0.4)",
                                }}
                              >
                                {unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* -------------------------------------------------------------- */}
            {/* COLUNA DIREITA: JANELA DO CHAT (ESTILO WHATSAPP WEB DARK)     */}
            {/* -------------------------------------------------------------- */}
            {currentChatTenant ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg-card)", minWidth: 0 }}>
                {/* Header da Conversa Ativa */}
                <div
                  style={{
                    padding: "12px 18px",
                    borderBottom: "1px solid var(--border-subtle)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "rgba(10, 14, 22, 0.98)",
                    gap: "12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                    <div
                      style={{
                        width: "38px",
                        height: "38px",
                        background: "var(--bg-card-subtle)",
                        border: "1px solid var(--border-subtle)",
                        color: "var(--primary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: "14px",
                        flexShrink: 0,
                      }}
                    >
                      {currentChatTenant.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <h4 style={{ fontSize: "14px", fontWeight: 800, color: "#FFF", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {currentChatTenant.name}
                        </h4>
                        <span
                          style={{
                            fontSize: "10px",
                            padding: "1px 6px",
                            background:
                              currentChatTenant.status === "ACTIVE"
                                ? "rgba(16, 185, 129, 0.15)"
                                : "rgba(245, 158, 11, 0.15)",
                            color: currentChatTenant.status === "ACTIVE" ? "#34D399" : "#FBBF24",
                            fontWeight: 700,
                          }}
                        >
                          {currentChatTenant.status} • {currentChatTenant.plan}
                        </span>
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ color: "var(--emerald)", fontWeight: 700 }}>● Online agora</span>
                        <span>•</span>
                        <span>{currentChatTenant.owner_name}</span>
                        {currentChatTenant.phone && (
                          <>
                            <span>•</span>
                            <span>{currentChatTenant.phone}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Ações Rápidas no Topo */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                    {currentChatTenant.phone && (
                      <a
                        href={`https://wa.me/55${currentChatTenant.phone.replace(/\D/g, "")}?text=Ol%C3%A1%20${encodeURIComponent(currentChatTenant.owner_name || currentChatTenant.name)}%2C%20falo%20do%20suporte%20Master%20GIRAVO.`}
                        target="_blank"
                        rel="noreferrer"
                        title="Abrir WhatsApp Externo"
                        style={{
                          background: "rgba(37, 211, 102, 0.15)",
                          color: "#25D366",
                          border: "1px solid rgba(37, 211, 102, 0.35)",
                          padding: "6px 10px",
                          fontSize: "11.5px",
                          fontWeight: 700,
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <MessageSquare size={13} />
                        <span>WhatsApp Web</span>
                      </a>
                    )}

                    <button
                      onClick={() => handleViewOperational(currentChatTenant.id)}
                      style={{
                        background: "var(--bg-card-subtle)",
                        border: "1px solid var(--border-subtle)",
                        color: "#FFF",
                        padding: "6px 10px",
                        fontSize: "11.5px",
                        fontWeight: 600,
                      }}
                    >
                      <Monitor size={12} />
                      <span>Ver Painel Espelho</span>
                    </button>

                    <button
                      onClick={() => handleOpenDaysModal(currentChatTenant)}
                      style={{
                        background: "rgba(245, 158, 11, 0.15)",
                        border: "1px solid rgba(245, 158, 11, 0.3)",
                        color: "#FBBF24",
                        padding: "6px 10px",
                        fontSize: "11.5px",
                        fontWeight: 700,
                      }}
                    >
                      <Clock size={12} />
                      <span>Ajustar Dias</span>
                    </button>

                    {/* Botão de Finalizar ou Reabrir Atendimento */}
                    {chatThreads[currentChatTenant.id]?.status === "QUEUE" ? (
                      <button
                        onClick={() => handleAcceptChat(currentChatTenant.id, currentChatTenant.name)}
                        title="Aceitar atendimento da oficina na fila"
                        style={{
                          background: "#F59E0B",
                          color: "#000",
                          border: "none",
                          padding: "6px 14px",
                          fontSize: "12px",
                          fontWeight: 900,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                      >
                        <Clock size={13} />
                        <span>Aceitar Atendimento (Na Fila)</span>
                      </button>
                    ) : chatThreads[currentChatTenant.id]?.status === "ARCHIVED" ? (
                      <button
                        onClick={() => handleReopenChat(currentChatTenant.id, currentChatTenant.name)}
                        title="Reabrir este atendimento e retornar para a caixa de entrada"
                        style={{
                          background: "rgba(56, 189, 248, 0.15)",
                          color: "#38BDF8",
                          border: "1px solid rgba(56, 189, 248, 0.4)",
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: 800,
                          gap: "5px",
                        }}
                      >
                        <Inbox size={13} />
                        <span>Reabrir Atendimento</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleArchiveChat(currentChatTenant.id, currentChatTenant.name)}
                        title="Finalizar atendimento e arquivar conversa (sai da caixa de entrada até nova mensagem)"
                        style={{
                          background: "rgba(16, 185, 129, 0.15)",
                          color: "#34D399",
                          border: "1px solid rgba(16, 185, 129, 0.4)",
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: 800,
                          gap: "5px",
                        }}
                      >
                        <CheckCircle2 size={13} color="var(--emerald)" />
                        <span>Finalizar Atendimento</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Banner Informativo se Atendimento estiver na Fila */}
                {chatThreads[currentChatTenant.id]?.status === "QUEUE" && (
                  <div
                    style={{
                      background: "#2A1805",
                      borderBottom: "1px solid #F59E0B",
                      padding: "8px 18px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11.5px", color: "#FDE68A" }}>
                      <Clock size={14} color="#F59E0B" style={{ flexShrink: 0 }} />
                      <span>
                        Oficina aguardando na <strong style={{ color: "#F59E0B" }}>fila de processamento</strong>. Clique em <strong>Aceitar Atendimento</strong> para iniciar.
                      </span>
                    </div>
                    <button
                      onClick={() => handleAcceptChat(currentChatTenant.id, currentChatTenant.name)}
                      style={{
                        background: "#F59E0B",
                        color: "#000",
                        border: "none",
                        padding: "5px 12px",
                        fontSize: "11.5px",
                        fontWeight: 900,
                        cursor: "pointer",
                      }}
                    >
                      Aceitar Agora
                    </button>
                  </div>
                )}

                {/* Banner Informativo se Atendimento estiver Arquivado / Finalizado */}
                {chatThreads[currentChatTenant.id]?.status === "ARCHIVED" && (
                  <div
                    style={{
                      background: "#0A101D",
                      borderBottom: "1px solid rgba(56, 189, 248, 0.3)",
                      padding: "8px 18px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11.5px", color: "#94A3B8" }}>
                      <Archive size={14} color="#38BDF8" style={{ flexShrink: 0 }} />
                      <span>
                        Este atendimento está <strong style={{ color: "#38BDF8" }}>finalizado e arquivado</strong> na conta da oficina. A conversa sairá da caixa de entrada em aberto e reaparecerá automaticamente assim que o cliente enviar uma nova mensagem.
                      </span>
                    </div>
                    <button
                      onClick={() => handleReopenChat(currentChatTenant.id, currentChatTenant.name)}
                      style={{
                        background: "rgba(56, 189, 248, 0.2)",
                        color: "#38BDF8",
                        border: "1px solid rgba(56, 189, 248, 0.4)",
                        padding: "3px 8px",
                        fontSize: "11px",
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      Reabrir Agora
                    </button>
                  </div>
                )}

                {/* Thread de Mensagens (WhatsApp Web Style) */}
                <div
                  style={{
                    flex: 1,
                    padding: "20px 24px",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    background: "#080B12",
                  }}
                >
                  {/* Divisor Informativo Central */}
                  <div style={{ textAlign: "center", margin: "0 auto 12px", width: "100%" }}>
                    <span
                      style={{
                        background: "#0F1420",
                        border: "1px solid var(--border-subtle)",
                        color: "var(--text-dim)",
                        padding: "4px 12px",
                        fontSize: "10.5px",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Canal de Atendimento Direto GIRAVO Pro
                    </span>
                  </div>

                  {currentChatMessages.length === 0 ? (
                    <div style={{ textAlign: "center", margin: "auto", color: "var(--text-dim)", maxWidth: "360px" }}>
                      <MessageCircle size={40} style={{ margin: "0 auto 12px", opacity: 0.3, color: "var(--primary)" }} />
                      <p style={{ fontSize: "14px", fontWeight: 700, color: "#FFF" }}>
                        Inicie o atendimento com {currentChatTenant.name}
                      </p>
                      <p style={{ fontSize: "12px", marginTop: "4px", color: "var(--text-muted)" }}>
                        As mensagens chegam e saem em tempo real no widget de chat integrado no painel do cliente.
                      </p>
                    </div>
                  ) : (
                    currentChatMessages.map((msg) => {
                      const isMaster = msg.sender === "MASTER";
                      return (
                        <div
                          key={msg.id}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: isMaster ? "flex-end" : "flex-start",
                            maxWidth: "70%",
                            alignSelf: isMaster ? "flex-end" : "flex-start",
                          }}
                        >
                          <div
                            style={{
                              background: isMaster ? "#005C4B" : "#202C33",
                              color: "#FFF",
                              border: isMaster ? "1px solid #026b57" : "1px solid #2A3942",
                              padding: "8px 12px 6px 12px",
                              fontSize: "13px",
                              lineHeight: "1.45",
                              wordBreak: "break-word",
                              boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
                              minWidth: "110px",
                            }}
                          >
                            {!isMaster && (
                              <div style={{ fontSize: "11px", fontWeight: 700, color: "#38BDF8", marginBottom: "3px" }}>
                                {msg.senderName}
                              </div>
                            )}

                            <div style={{ whiteSpace: "pre-wrap" }}>{msg.text}</div>

                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "flex-end",
                                gap: "4px",
                                marginTop: "4px",
                              }}
                            >
                              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.6)" }}>
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              {isMaster && (
                                <span title={msg.read ? "Mensagem lida pelo cliente" : "Mensagem entregue"}>
                                  <CheckCheck
                                    size={13}
                                    color={msg.read ? "#53BDEB" : "#8696A0"}
                                  />
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatScrollRef} />
                </div>

                {/* Respostas Rápidas Pré-configuradas (Chips estilo WhatsApp) */}
                <div
                  style={{
                    padding: "8px 16px",
                    background: "var(--bg-sidebar)",
                    borderTop: "1px solid var(--border-subtle)",
                    display: "flex",
                    gap: "6px",
                    overflowX: "auto",
                  }}
                >
                  <span style={{ fontSize: "10.5px", color: "var(--text-dim)", fontWeight: 700, alignSelf: "center", marginRight: "4px", flexShrink: 0 }}>
                    RESPOSTAS:
                  </span>
                  {[
                    "✅ Liberamos mais dias de teste para sua oficina!",
                    "👋 Olá! Sou o suporte técnico GIRAVO. Como posso te ajudar hoje?",
                    "🔧 Seus módulos de checklist e fotos já estão liberados.",
                    "⏳ Notamos que seu teste de 14 dias está perto do fim.",
                    "🔒 Suas permissões foram atualizadas com sucesso.",
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleSendChatMessage(preset)}
                      style={{
                        padding: "5px 10px",
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-subtle)",
                        color: "var(--text-muted)",
                        fontSize: "11px",
                        whiteSpace: "nowrap",
                        transition: "all 0.1s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#FFF";
                        e.currentTarget.style.borderColor = "var(--primary)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "var(--text-muted)";
                        e.currentTarget.style.borderColor = "var(--border-subtle)";
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                {/* Caixa de Entrada Estilo WhatsApp Web (Enter envia, Shift+Enter pula linha) */}
                <div
                  style={{
                    padding: "12px 16px",
                    background: "rgba(10, 14, 22, 0.98)",
                    borderTop: "1px solid var(--border-subtle)",
                    display: "flex",
                    gap: "10px",
                    alignItems: "flex-end",
                  }}
                >
                  <textarea
                    rows={1}
                    placeholder={`Digite sua mensagem para ${currentChatTenant.name}... (Enter para enviar, Shift+Enter para nova linha)`}
                    value={newChatText}
                    onChange={(e) => setNewChatText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendChatMessage();
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: "10px 14px",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border-strong)",
                      color: "#FFF",
                      fontSize: "13px",
                      resize: "none",
                      minHeight: "42px",
                      maxHeight: "120px",
                      lineHeight: "1.4",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleSendChatMessage()}
                    disabled={!newChatText.trim()}
                    style={{
                      padding: "11px 18px",
                      background: newChatText.trim() ? "var(--primary)" : "var(--bg-card-subtle)",
                      color: newChatText.trim() ? "#06080D" : "#FFF",
                      borderRadius: "var(--radius-sm)",
                      fontWeight: 800,
                      fontSize: "13px",
                      height: "42px",
                      opacity: newChatText.trim() ? 1 : 0.6,
                      boxShadow: newChatText.trim() ? "0 2px 10px rgba(158, 232, 36, 0.25)" : "none",
                    }}
                  >
                    <Send size={15} />
                    <span>Enviar</span>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)" }}>
                Selecione uma oficina na lista ao lado para conversar.
              </div>
            )}
          </div>
        )}

        {/* ================================================================== */}
        {/* ABA 4: LEADS & PROSPECÇÃO (VISUAL RETO) */}
        {/* ================================================================== */}
        {activeNav === "leads" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Header & Explicação do Novo Fluxo */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <h3 style={{ fontSize: "18px", color: "#FFF", margin: 0, fontWeight: 800 }}>
                    Solicitações de Teste de 14 Dias
                  </h3>
                  {pendingLeadsCount > 0 && (
                    <span
                      style={{
                        background: "rgba(158, 232, 36, 0.18)",
                        color: "var(--primary)",
                        border: "1px solid rgba(158, 232, 36, 0.4)",
                        padding: "3px 10px",
                        borderRadius: "var(--radius-full)",
                        fontSize: "11px",
                        fontWeight: 800,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span className="pulse-dot" style={{ background: "var(--primary)", width: "6px", height: "6px" }} />
                      {pendingLeadsCount} {pendingLeadsCount === 1 ? "oficina aguarda aprovação" : "oficinas aguardam aprovação"}
                    </span>
                  )}
                </div>
                <p style={{ color: "var(--text-muted)", fontSize: "13px", marginTop: "4px" }}>
                  Oficinas que solicitaram teste de 14 dias pela landing page sem senha prévia.
                  Apenas oficinas aprovadas pelo Master recebem senha de acesso e são criadas no sistema.
                </p>
              </div>

              {/* Botão de atualização rápida */}
              <button
                type="button"
                onClick={() => {
                  fetchLeads();
                  showToast("Lista de solicitações sincronizada!", "info");
                }}
                style={{
                  background: "var(--bg-card-subtle)",
                  border: "1px solid var(--border-subtle)",
                  color: "#FFF",
                  padding: "8px 14px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "12px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                }}
              >
                <RefreshCw size={13} />
                <span>Atualizar Lista</span>
              </button>
            </div>

            {/* KPI Cards / Filtros Rápidos de Status */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "12px",
              }}
            >
              {/* Card 1: Aguardando Aprovação */}
              <div
                className="glass-panel"
                onClick={() => setLeadFilterTab("PENDING")}
                style={{
                  padding: "16px 18px",
                  cursor: "pointer",
                  borderRadius: "var(--radius-md)",
                  border: leadFilterTab === "PENDING" ? "1px solid var(--primary)" : "1px solid var(--border-subtle)",
                  background: leadFilterTab === "PENDING" ? "rgba(158, 232, 36, 0.08)" : "var(--bg-card)",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: "var(--primary)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Aguardando Aprovação
                  </span>
                  <Clock size={16} color="var(--primary)" />
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "6px" }}>
                  <h3 style={{ fontSize: "28px", fontWeight: 900, color: "#FFF", margin: 0 }}>
                    {pendingLeadsCount}
                  </h3>
                  <span style={{ fontSize: "11.5px", color: pendingLeadsCount > 0 ? "var(--primary)" : "var(--text-dim)" }}>
                    {pendingLeadsCount > 0 ? "Ação pendente" : "Tudo em dia"}
                  </span>
                </div>
              </div>

              {/* Card 2: Aprovadas & Liberadas */}
              <div
                className="glass-panel"
                onClick={() => setLeadFilterTab("APPROVED")}
                style={{
                  padding: "16px 18px",
                  cursor: "pointer",
                  borderRadius: "var(--radius-md)",
                  border: leadFilterTab === "APPROVED" ? "1px solid var(--emerald)" : "1px solid var(--border-subtle)",
                  background: leadFilterTab === "APPROVED" ? "rgba(16, 185, 129, 0.08)" : "var(--bg-card)",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: "var(--emerald)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Aprovadas & Liberadas
                  </span>
                  <CheckCircle2 size={16} color="var(--emerald)" />
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "6px" }}>
                  <h3 style={{ fontSize: "28px", fontWeight: 900, color: "var(--emerald)", margin: 0 }}>
                    {approvedLeadsCount}
                  </h3>
                  <span style={{ fontSize: "11.5px", color: "var(--text-dim)" }}>Contas ativas</span>
                </div>
              </div>

              {/* Card 3: Recusadas */}
              <div
                className="glass-panel"
                onClick={() => setLeadFilterTab("REJECTED")}
                style={{
                  padding: "16px 18px",
                  cursor: "pointer",
                  borderRadius: "var(--radius-md)",
                  border: leadFilterTab === "REJECTED" ? "1px solid var(--rose)" : "1px solid var(--border-subtle)",
                  background: leadFilterTab === "REJECTED" ? "rgba(239, 68, 68, 0.08)" : "var(--bg-card)",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: "var(--rose)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Recusadas / Inativas
                  </span>
                  <Ban size={16} color="var(--rose)" />
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "6px" }}>
                  <h3 style={{ fontSize: "28px", fontWeight: 900, color: "#CBD5E1", margin: 0 }}>
                    {rejectedLeadsCount}
                  </h3>
                  <span style={{ fontSize: "11.5px", color: "var(--text-dim)" }}>Não liberadas</span>
                </div>
              </div>

              {/* Card 4: Total de Solicitações */}
              <div
                className="glass-panel"
                onClick={() => setLeadFilterTab("ALL")}
                style={{
                  padding: "16px 18px",
                  cursor: "pointer",
                  borderRadius: "var(--radius-md)",
                  border: leadFilterTab === "ALL" ? "1px solid rgba(255, 255, 255, 0.4)" : "1px solid var(--border-subtle)",
                  background: leadFilterTab === "ALL" ? "rgba(255, 255, 255, 0.05)" : "var(--bg-card)",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Todas as Solicitações
                  </span>
                  <Users size={16} color="var(--text-muted)" />
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "6px" }}>
                  <h3 style={{ fontSize: "28px", fontWeight: 900, color: "#FFF", margin: 0 }}>
                    {leads.length}
                  </h3>
                  <span style={{ fontSize: "11.5px", color: "var(--text-dim)" }}>Recebidas</span>
                </div>
              </div>
            </div>

            {/* Barra de Filtros e Busca */}
            <div
              className="glass-panel"
              style={{
                padding: "14px 18px",
                display: "flex",
                flexWrap: "wrap",
                gap: "14px",
                alignItems: "center",
                justifyContent: "space-between",
                borderRadius: "var(--radius-md)",
              }}
            >
              {/* Abas em formato Pill */}
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {[
                  { id: "PENDING", label: "Aguardando Aprovação", count: pendingLeadsCount, color: "var(--primary)" },
                  { id: "APPROVED", label: "Aprovadas", count: approvedLeadsCount, color: "var(--emerald)" },
                  { id: "REJECTED", label: "Recusadas", count: rejectedLeadsCount, color: "var(--rose)" },
                  { id: "ALL", label: "Todas", count: leads.length, color: "#FFF" },
                ].map((tab) => {
                  const isActive = leadFilterTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setLeadFilterTab(tab.id as any)}
                      style={{
                        padding: "7px 14px",
                        fontSize: "12px",
                        fontWeight: isActive ? 800 : 600,
                        borderRadius: "var(--radius-full)",
                        background: isActive ? tab.color : "var(--bg-card-subtle)",
                        color: isActive ? "#06080D" : "var(--text-muted)",
                        border: isActive ? `1px solid ${tab.color}` : "1px solid var(--border-subtle)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span>{tab.label}</span>
                      <span
                        style={{
                          background: isActive ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.08)",
                          padding: "1px 6px",
                          borderRadius: "var(--radius-full)",
                          fontSize: "10.5px",
                        }}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Caixa de Pesquisa */}
              <div style={{ position: "relative", minWidth: "260px", flex: 1, maxWidth: "400px" }}>
                <Search
                  size={15}
                  color="var(--text-dim)"
                  style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }}
                />
                <input
                  type="text"
                  placeholder="Buscar por oficina, nome, email ou telefone..."
                  value={leadSearchTerm}
                  onChange={(e) => setLeadSearchTerm(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px 8px 36px",
                    fontSize: "12.5px",
                    borderRadius: "var(--radius-sm)",
                  }}
                />
                {leadSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setLeadSearchTerm("")}
                    style={{
                      position: "absolute",
                      right: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--text-dim)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: "2px",
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Tabela de Solicitações */}
            <div className="glass-panel" style={{ overflowX: "auto", borderRadius: "var(--radius-md)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                <thead>
                  <tr
                    style={{
                      background: "rgba(8, 11, 17, 0.95)",
                      color: "var(--text-muted)",
                      borderBottom: "1px solid var(--border-subtle)",
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    <th style={{ padding: "14px 18px" }}>Oficina & Responsável</th>
                    <th style={{ padding: "14px 18px" }}>Status da Solicitação</th>
                    <th style={{ padding: "14px 18px" }}>Contatos & WhatsApp</th>
                    <th style={{ padding: "14px 18px" }}>Origem & Data</th>
                    <th style={{ padding: "14px 18px" }}>Observações</th>
                    <th style={{ padding: "14px 18px", textAlign: "right" }}>Ações do Master</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: "60px 20px", textAlign: "center", color: "var(--text-dim)" }}>
                        <div style={{ maxWidth: "420px", margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                          <div
                            style={{
                              width: "48px",
                              height: "48px",
                              borderRadius: "var(--radius-full)",
                              background: "rgba(158, 232, 36, 0.1)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Sparkles size={22} color="var(--primary)" />
                          </div>
                          <strong style={{ color: "#FFF", fontSize: "14px" }}>
                            Nenhuma solicitação encontrada
                          </strong>
                          <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
                            {leadSearchTerm
                              ? `Não há resultados para "${leadSearchTerm}". Tente outros termos.`
                              : leadFilterTab === "PENDING"
                              ? "Nenhuma oficina aguardando aprovação no momento. Quando alguém se cadastrar na landing page, aparecerá aqui instantaneamente!"
                              : "Nenhuma solicitação nesta categoria."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredLeads.map((l) => {
                      const isPending = isPendingStatus(l.status);
                      const isApproved = isApprovedStatus(l.status);
                      const isRejected = isRejectedStatus(l.status);

                      return (
                        <tr
                          key={l.id}
                          style={{
                            borderBottom: "1px solid var(--border-subtle)",
                            background: isPending ? "rgba(158, 232, 36, 0.02)" : "transparent",
                            transition: "background 0.1s ease",
                          }}
                        >
                          {/* Oficina & Responsável */}
                          <td style={{ padding: "16px 18px" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                              <div
                                style={{
                                  width: "36px",
                                  height: "36px",
                                  borderRadius: "var(--radius-sm)",
                                  background: isPending ? "rgba(158, 232, 36, 0.15)" : isApproved ? "rgba(16, 185, 129, 0.15)" : "rgba(255,255,255,0.06)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                }}
                              >
                                <Building2
                                  size={18}
                                  color={isPending ? "var(--primary)" : isApproved ? "var(--emerald)" : "var(--text-muted)"}
                                />
                              </div>
                              <div>
                                <strong style={{ color: "#FFF", fontSize: "14px", display: "block" }}>
                                  {l.workshop_name || "Oficina não nomeada"}
                                </strong>
                                <div style={{ color: "var(--text-muted)", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                                  <User size={12} color="var(--text-dim)" />
                                  <span>{l.name || "Responsável"}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td style={{ padding: "16px 18px" }}>
                            {isPending ? (
                              <span
                                style={{
                                  background: "rgba(158, 232, 36, 0.15)",
                                  color: "var(--primary)",
                                  border: "1px solid rgba(158, 232, 36, 0.35)",
                                  padding: "4px 10px",
                                  borderRadius: "var(--radius-full)",
                                  fontSize: "11px",
                                  fontWeight: 800,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                }}
                              >
                                <span className="pulse-dot" style={{ background: "var(--primary)", width: "6px", height: "6px" }} />
                                AGUARDA SUA APROVAÇÃO
                              </span>
                            ) : isApproved ? (
                              <span
                                style={{
                                  background: "rgba(16, 185, 129, 0.15)",
                                  color: "var(--emerald)",
                                  border: "1px solid rgba(16, 185, 129, 0.35)",
                                  padding: "4px 10px",
                                  borderRadius: "var(--radius-full)",
                                  fontSize: "11px",
                                  fontWeight: 800,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                }}
                              >
                                <CheckCircle2 size={13} color="var(--emerald)" />
                                APROVADA & CRIADA
                              </span>
                            ) : (
                              <span
                                style={{
                                  background: "rgba(239, 68, 68, 0.15)",
                                  color: "var(--rose)",
                                  border: "1px solid rgba(239, 68, 68, 0.35)",
                                  padding: "4px 10px",
                                  borderRadius: "var(--radius-full)",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                }}
                              >
                                <Ban size={13} color="var(--rose)" />
                                RECUSADA
                              </span>
                            )}
                          </td>

                          {/* Contatos & WhatsApp */}
                          <td style={{ padding: "16px 18px" }}>
                            <div style={{ color: "#E2E8F0", fontSize: "12.5px" }}>{l.email || "Sem e-mail"}</div>
                            {l.phone && (
                              <a
                                href={`https://wa.me/55${l.phone.replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  color: "#34D399",
                                  fontSize: "12px",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  marginTop: "3px",
                                  textDecoration: "none",
                                }}
                              >
                                <MessageCircle size={12} />
                                <span>{l.phone}</span>
                              </a>
                            )}
                          </td>

                          {/* Origem & Data */}
                          <td style={{ padding: "16px 18px" }}>
                            <span
                              style={{
                                background: "rgba(56, 189, 248, 0.15)",
                                color: "#38BDF8",
                                border: "1px solid rgba(56, 189, 248, 0.3)",
                                padding: "2px 8px",
                                borderRadius: "var(--radius-sm)",
                                fontSize: "11px",
                                fontWeight: 700,
                              }}
                            >
                              {l.origin || "Landing Page"}
                            </span>
                            <div style={{ color: "var(--text-dim)", fontSize: "11px", marginTop: "4px" }}>
                              {l.created_at ? new Date(l.created_at).toLocaleDateString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "Data recente"}
                            </div>
                          </td>

                          {/* Observações */}
                          <td style={{ padding: "16px 18px", color: "var(--text-muted)", fontSize: "12px", maxWidth: "240px" }}>
                            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={l.notes}>
                              {l.notes || "Solicitação de Teste de 14 Dias"}
                            </div>
                          </td>

                          {/* Ações do Master */}
                          <td style={{ padding: "16px 18px", textAlign: "right" }}>
                            {isPending ? (
                              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                                <button
                                  type="button"
                                  onClick={() => handleStartApproval(l)}
                                  title="Aprovar esta solicitação, definir senha e criar conta da oficina"
                                  style={{
                                    background: "var(--primary)",
                                    color: "#06080D",
                                    padding: "8px 14px",
                                    borderRadius: "var(--radius-sm)",
                                    fontSize: "12px",
                                    fontWeight: 900,
                                    border: "none",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    boxShadow: "0 2px 10px rgba(158, 232, 36, 0.3)",
                                    transition: "all 0.15s ease",
                                  }}
                                >
                                  <Sparkles size={14} strokeWidth={2.5} />
                                  <span>Aprovar & Gerar Acesso</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleRejectLead(l.id, l.name || l.workshop_name)}
                                  title="Recusar esta solicitação (não libera acesso)"
                                  style={{
                                    background: "rgba(239, 68, 68, 0.12)",
                                    color: "var(--rose)",
                                    border: "1px solid rgba(239, 68, 68, 0.3)",
                                    padding: "8px 12px",
                                    borderRadius: "var(--radius-sm)",
                                    fontSize: "12px",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  <Ban size={13} />
                                  <span>Recusar</span>
                                </button>
                              </div>
                            ) : isApproved ? (
                              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                                {l.phone && (
                                  <a
                                    href={`https://wa.me/55${l.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                                      getWhatsAppMessageText({
                                        ownerName: l.name || "Cliente",
                                        workshopName: l.workshop_name || "sua Oficina",
                                        email: l.email || "",
                                        password: "(senha já gerada)",
                                        url: typeof window !== "undefined" && window.location.origin.includes("3005") ? window.location.origin.replace("3005", "3000") : "https://app.giravo.com.br",
                                        days: 14,
                                      })
                                    )}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Enviar mensagem pelo WhatsApp"
                                    style={{
                                      background: "rgba(37, 211, 102, 0.15)",
                                      color: "#25D366",
                                      border: "1px solid rgba(37, 211, 102, 0.35)",
                                      padding: "7px 12px",
                                      borderRadius: "var(--radius-sm)",
                                      fontSize: "11.5px",
                                      fontWeight: 800,
                                      textDecoration: "none",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "5px",
                                    }}
                                  >
                                    <MessageSquare size={13} />
                                    <span>WhatsApp</span>
                                  </a>
                                )}

                                {l.tenant_id && (
                                  <button
                                    type="button"
                                    onClick={() => handleViewOperational(l.tenant_id!)}
                                    title="Acessar espelho operacional desta oficina"
                                    style={{
                                      background: "var(--bg-card-subtle)",
                                      border: "1px solid var(--border-subtle)",
                                      color: "#FFF",
                                      padding: "7px 12px",
                                      borderRadius: "var(--radius-sm)",
                                      fontSize: "11.5px",
                                      fontWeight: 600,
                                      cursor: "pointer",
                                    }}
                                  >
                                    <Monitor size={12} />
                                    <span>Ver Oficina</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                                <button
                                  type="button"
                                  onClick={() => handleReopenLead(l.id)}
                                  title="Reabrir esta solicitação para aprovação"
                                  style={{
                                    background: "rgba(56, 189, 248, 0.15)",
                                    color: "#38BDF8",
                                    border: "1px solid rgba(56, 189, 248, 0.35)",
                                    padding: "6px 12px",
                                    borderRadius: "var(--radius-sm)",
                                    fontSize: "11.5px",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  <RefreshCw size={12} />
                                  <span>Reabrir</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteLead(l.id)}
                                  title="Excluir lead permanentemente"
                                  style={{
                                    background: "rgba(239, 68, 68, 0.1)",
                                    color: "var(--rose)",
                                    border: "1px solid rgba(239, 68, 68, 0.25)",
                                    padding: "6px 10px",
                                    borderRadius: "var(--radius-sm)",
                                    fontSize: "11.5px",
                                    cursor: "pointer",
                                  }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================================================== */}
        {/* ABA 5: BANCO & DIAGNÓSTICO (VISUAL RETO) */}
        {/* ================================================================== */}
        {activeNav === "db" && (
          <div style={{ maxWidth: "800px" }}>
            <div className="glass-panel" style={{ padding: "24px", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <Database size={22} color="var(--primary)" />
                <h3 style={{ fontSize: "16px", color: "#FFF", margin: 0 }}>
                  Status da Conexão com PostgreSQL Neon (Vercel)
                </h3>
              </div>

              {dbDiagLoading ? (
                <div style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)" }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 10px" }} />
                  <span>Testando conexão com o banco de dados...</span>
                </div>
              ) : dbDiagData?.connected ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div
                    style={{
                      background: "rgba(16, 185, 129, 0.12)",
                      border: "1px solid rgba(16, 185, 129, 0.35)",
                      padding: "14px",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <CheckCircle2 size={22} color="#34D399" />
                    <div>
                      <strong style={{ color: "#34D399", fontSize: "13.5px" }}>
                        Conexão Ativa com o PostgreSQL Neon!
                      </strong>
                      <p style={{ margin: "2px 0 0", color: "#E2E8F0", fontSize: "12px" }}>
                        Latência da requisição: <strong>{dbDiagData.latencyMs}ms</strong>
                      </p>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 700 }}>
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
                      fontSize: "12.5px",
                      fontWeight: 700,
                      marginTop: "10px",
                    }}
                  >
                    <RefreshCw size={13} className={syncLoading ? "animate-spin" : ""} />
                    <span>Sincronizar Estrutura do Banco</span>
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div
                    style={{
                      background: "rgba(245, 158, 11, 0.12)",
                      border: "1px solid rgba(245, 158, 11, 0.4)",
                      padding: "14px",
                    }}
                  >
                    <strong style={{ color: "#FDE68A", fontSize: "13px" }}>
                      {dbDiagData?.message || "Verificando configuração de banco..."}
                    </strong>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ==================================================================== */}
      {/* MODAL: MODIFICAR DIAS RESTANTES (ITEM REQUISITADO COM BORDAS RETAS) */}
      {/* ==================================================================== */}
      {daysModalTenant && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
        >
          <div className="glass-modal" style={{ maxWidth: "460px", width: "100%", padding: "28px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    background: "rgba(245, 158, 11, 0.2)",
                    color: "#FBBF24",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Clock size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: "16px", color: "#FFF", margin: 0 }}>
                    Modificar Dias Restantes
                  </h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "12px", margin: "2px 0 0" }}>
                    {daysModalTenant.name}
                  </p>
                </div>
              </div>
              <button onClick={() => setDaysModalTenant(null)} style={{ color: "var(--text-dim)", padding: "4px" }}>
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                background: "rgba(10, 14, 23, 0.7)",
                border: "1px solid var(--border-subtle)",
                padding: "12px 14px",
                marginBottom: "16px",
                fontSize: "12px",
                color: "var(--text-muted)",
              }}
            >
              <div>
                Validade atual:{" "}
                <strong style={{ color: "#FFF" }}>
                  {daysModalTenant.expires_at
                    ? new Date(daysModalTenant.expires_at).toLocaleDateString("pt-BR")
                    : "Sem limite definido"}
                </strong>
              </div>
              <div style={{ marginTop: "3px", fontSize: "11.5px", color: "var(--text-dim)" }}>
                Digite quantos dias de acesso a oficina terá a partir de hoje.
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "12px", color: "#FFF", fontWeight: 700, marginBottom: "6px" }}>
                Dias Restantes Desejados:
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                  type="number"
                  min="0"
                  max="3650"
                  value={customRemainingDays}
                  onChange={(e) => setCustomRemainingDays(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  style={{
                    flex: 1,
                    fontSize: "20px",
                    fontWeight: 800,
                    padding: "10px 14px",
                    color: "var(--primary)",
                    background: "rgba(10, 14, 23, 0.9)",
                    border: "1px solid var(--border-strong)",
                    textAlign: "center",
                  }}
                  autoFocus
                />
                <span style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: 600 }}>
                  dias restantes
                </span>
              </div>

              <div
                style={{
                  marginTop: "10px",
                  fontSize: "12px",
                  color: "#34D399",
                  background: "rgba(16, 185, 129, 0.1)",
                  padding: "8px 10px",
                  border: "1px solid rgba(16, 185, 129, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Calendar size={13} />
                <span>
                  Nova data calculada:{" "}
                  <strong>
                    {new Date(Date.now() + customRemainingDays * 86400000).toLocaleDateString("pt-BR")}
                  </strong>{" "}
                  (Oficina reativada)
                </span>
              </div>
            </div>

            {/* Presets */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "10.5px", color: "var(--text-muted)", fontWeight: 700, marginBottom: "6px", textTransform: "uppercase" }}>
                Atalhos Rápidos:
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "5px" }}>
                {[
                  { days: 0, label: "0d (Vence hoje)" },
                  { days: 7, label: "7 dias" },
                  { days: 14, label: "14d (Trial)" },
                  { days: 30, label: "30 dias" },
                  { days: 60, label: "60 dias" },
                  { days: 90, label: "90 dias" },
                  { days: 180, label: "180 dias" },
                  { days: 365, label: "365d (1 ano)" },
                ].map((preset) => (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() => setCustomRemainingDays(preset.days)}
                    style={{
                      padding: "7px 4px",
                      fontSize: "11px",
                      fontWeight: 700,
                      borderRadius: "var(--radius-xs)",
                      background: customRemainingDays === preset.days ? "var(--primary)" : "rgba(255, 255, 255, 0.05)",
                      color: customRemainingDays === preset.days ? "#06080D" : "var(--text-muted)",
                      border: `1px solid ${customRemainingDays === preset.days ? "var(--primary)" : "var(--border-subtle)"}`,
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setDaysModalTenant(null)}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "var(--bg-card-subtle)",
                  color: "#FFF",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "12.5px",
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveRemainingDays}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "var(--primary)",
                  color: "#06080D",
                  borderRadius: "var(--radius-sm)",
                  fontWeight: 800,
                  fontSize: "12.5px",
                  boxShadow: "0 2px 10px rgba(158, 232, 36, 0.2)",
                }}
              >
                Salvar Dias Restantes
              </button>
            </div>
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
            background: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
        >
          <div className="glass-modal" style={{ maxWidth: "500px", width: "100%", padding: "26px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <div>
                <h3 style={{ fontSize: "16px", color: "var(--primary)", margin: 0 }}>
                  Cadastrar Nova Oficina
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "12px", margin: "2px 0 0" }}>
                  Adiciona a empresa e o primeiro login administrador
                </p>
              </div>
              <button onClick={() => setIsNewModalOpen(false)} style={{ color: "var(--text-dim)", padding: "4px" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTenant} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11.5px", color: "var(--text-muted)", marginBottom: "3px" }}>
                  Nome da Oficina *
                </label>
                <input required placeholder="Ex: Auto Mecânica Turbo Precision" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ width: "100%" }} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11.5px", color: "var(--text-muted)", marginBottom: "3px" }}>
                  Responsável / Proprietário *
                </label>
                <input required placeholder="Ex: Carlos Oliveira" value={newOwner} onChange={(e) => setNewOwner(e.target.value)} style={{ width: "100%" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11.5px", color: "var(--text-muted)", marginBottom: "3px" }}>E-mail *</label>
                  <input required type="email" placeholder="carlos@oficina.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} style={{ width: "100%" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11.5px", color: "var(--text-muted)", marginBottom: "3px" }}>WhatsApp *</label>
                  <input required placeholder="(11) 98765-4321" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} style={{ width: "100%" }} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11.5px", color: "var(--text-muted)", marginBottom: "3px" }}>Senha Provisória</label>
                  <input required type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={{ width: "100%" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11.5px", color: "var(--text-muted)", marginBottom: "3px" }}>Plano</label>
                  <select value={newPlan} onChange={(e) => setNewPlan(e.target.value)} style={{ width: "100%" }}>
                    <option value="PRO">PRO</option>
                    <option value="ENTERPRISE">Enterprise</option>
                    <option value="TRIAL">Trial</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11.5px", color: "var(--text-muted)", marginBottom: "5px" }}>Validade Inicial (Dias):</label>
                <div style={{ display: "flex", gap: "6px" }}>
                  {[14, 30, 90, 365].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setNewDays(d)}
                      style={{
                        flex: 1,
                        padding: "7px",
                        background: newDays === d ? "var(--primary)" : "var(--bg-input)",
                        color: newDays === d ? "#06080D" : "var(--text-muted)",
                        border: `1px solid ${newDays === d ? "var(--primary)" : "var(--border-subtle)"}`,
                        borderRadius: "var(--radius-xs)",
                        fontSize: "11.5px",
                        fontWeight: 700,
                      }}
                    >
                      {d === 365 ? "1 Ano" : `${d} Dias`}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                <button type="button" onClick={() => setIsNewModalOpen(false)} style={{ flex: 1, padding: "10px", background: "var(--bg-card-subtle)", color: "#FFF", borderRadius: "var(--radius-sm)" }}>
                  Cancelar
                </button>
                <button type="submit" style={{ flex: 1, padding: "10px", background: "var(--primary)", color: "#06080D", fontWeight: 800, borderRadius: "var(--radius-sm)", boxShadow: "0 2px 10px rgba(158, 232, 36, 0.2)" }}>
                  Criar Oficina
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: MÓDULOS / FEATURE FLAGS */}
      {/* ==================================================================== */}
      {featuresModalTenant && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
        >
          <div className="glass-modal" style={{ maxWidth: "520px", width: "100%", padding: "26px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div>
                <h3 style={{ fontSize: "16px", color: "var(--primary)", margin: 0 }}>Permissões de Recursos</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "12px", margin: "2px 0 0" }}>{featuresModalTenant.name}</p>
              </div>
              <button onClick={() => setFeaturesModalTenant(null)} style={{ color: "var(--text-dim)", padding: "4px" }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", gap: "6px", marginBottom: "14px" }}>
              <button type="button" onClick={() => handleApplyPreset("all")} style={{ flex: 1, padding: "6px 8px", background: "rgba(16, 185, 129, 0.15)", color: "#34D399", border: "1px solid rgba(16, 185, 129, 0.3)", fontSize: "11.5px", fontWeight: 700 }}>
                <Check size={13} /> Liberar Tudo (VIP)
              </button>
              <button type="button" onClick={() => handleApplyPreset("basic")} style={{ flex: 1, padding: "6px 8px", background: "var(--bg-input)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)", fontSize: "11.5px" }}>
                Apenas O.S. & Fotos
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "340px", overflowY: "auto" }}>
              {featureDefinitions(featuresModalTenant.enabled_features).map((f) => {
                const isChecked = featuresModalTenant.enabled_features?.[f.key] !== false;
                return (
                  <div
                    key={f.key}
                    onClick={() => handleToggleFeature(f.key)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      borderRadius: "var(--radius-sm)",
                      background: isChecked ? "rgba(158, 232, 36, 0.08)" : "var(--bg-input)",
                      border: `1px solid ${isChecked ? "rgba(158, 232, 36, 0.3)" : "var(--border-subtle)"}`,
                      cursor: "pointer",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "13px", color: isChecked ? "#FFF" : "var(--text-muted)" }}>{f.label}</strong>
                      <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--text-dim)" }}>{f.desc}</p>
                    </div>
                    <div
                      style={{
                        width: "18px",
                        height: "18px",
                        background: isChecked ? "var(--emerald)" : "transparent",
                        border: `1px solid ${isChecked ? "var(--emerald)" : "var(--border-subtle)"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#FFF",
                      }}
                    >
                      {isChecked && <Check size={12} strokeWidth={3} />}
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
                marginTop: "16px",
                background: "var(--primary)",
                color: "#FFF",
                padding: "10px",
                width: "100%",
                fontWeight: 800,
                fontSize: "13px",
              }}
            >
              Concluir e Salvar
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: VISTORIA FOTOGRÁFICA & CHECKLIST REAL DA O.S. */}
      {/* ==================================================================== */}
      {selectedInspectionModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.88)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 120,
            padding: "20px",
          }}
        >
          <div
            className="glass-modal"
            style={{
              maxWidth: "720px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "24px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Camera size={18} color="#38BDF8" />
                <h4 style={{ fontSize: "15px", color: "#FFF", margin: 0 }}>
                  Vistoria Fotográfica & Checklist ({selectedInspectionModal.id})
                </h4>
              </div>
              <button
                onClick={() => setSelectedInspectionModal(null)}
                style={{ color: "var(--text-dim)", padding: "4px" }}
              >
                <X size={18} />
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                background: "#0A0D15",
                padding: "12px 14px",
                border: "1px solid var(--border-subtle)",
                marginBottom: "16px",
              }}
            >
              <div>
                <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Veículo & Placa</span>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#FFF" }}>
                  {selectedInspectionModal.vehicle} ({selectedInspectionModal.plate})
                </div>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Cliente</span>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#FFF" }}>
                  {selectedInspectionModal.client}
                </div>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Nível de Combustível</span>
                <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#38BDF8" }}>
                  {selectedInspectionModal.fuelLevel || "1/2"}
                </div>
              </div>
              <div>
                <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Estado dos Pneus</span>
                <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#34D399" }}>
                  {selectedInspectionModal.tiresCondition || "BOM"}
                </div>
              </div>
              {selectedInspectionModal.damageNotes && (
                <div style={{ gridColumn: "1 / -1", paddingTop: "4px", borderTop: "1px solid var(--border-subtle)" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-dim)" }}>Avarias / Observações na Entrada</span>
                  <div style={{ fontSize: "12px", color: "#FBBF24" }}>
                    {selectedInspectionModal.damageNotes}
                  </div>
                </div>
              )}
            </div>

            <h5 style={{ fontSize: "13px", color: "#FFF", margin: "0 0 10px" }}>
              Fotos Anexadas na Vistoria ({selectedInspectionModal.photos?.length || 0})
            </h5>

            {Array.isArray(selectedInspectionModal.photos) && selectedInspectionModal.photos.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                  gap: "12px",
                  marginBottom: "18px",
                }}
              >
                {selectedInspectionModal.photos.map((photo: any, i: number) => {
                  const photoUrl = typeof photo === "string" ? photo : photo.url || photo.dataUrl;
                  const photoDesc =
                    typeof photo === "object"
                      ? photo.description || `Foto ${i + 1}`
                      : `Foto ${i + 1}`;
                  return (
                    <div
                      key={i}
                      style={{
                        background: "#06080D",
                        border: "1px solid var(--border-subtle)",
                        overflow: "hidden",
                      }}
                    >
                      {photoUrl ? (
                        <a href={photoUrl} target="_blank" rel="noreferrer" title="Clique para ver tamanho original">
                          <img
                            src={photoUrl}
                            alt={photoDesc}
                            style={{
                              width: "100%",
                              height: "150px",
                              objectFit: "cover",
                              display: "block",
                              cursor: "zoom-in",
                            }}
                          />
                        </a>
                      ) : (
                        <div
                          style={{
                            height: "150px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "#080B12",
                          }}
                        >
                          <Camera size={32} color="var(--primary)" opacity={0.4} />
                        </div>
                      )}
                      <div style={{ padding: "8px 10px", fontSize: "11.5px" }}>
                        <div style={{ color: "#FFF", fontWeight: 700 }}>{photoDesc}</div>
                        {photo.timestamp && (
                          <span style={{ color: "var(--text-dim)", fontSize: "10.5px" }}>
                            {photo.timestamp}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  padding: "24px",
                  textAlign: "center",
                  color: "var(--text-dim)",
                  fontSize: "12px",
                  background: "#0A0D15",
                  border: "1px dashed var(--border-subtle)",
                  marginBottom: "18px",
                }}
              >
                Nenhuma foto registrada nesta ordem de serviço.
              </div>
            )}

            <button
              onClick={() => setSelectedInspectionModal(null)}
              style={{
                width: "100%",
                padding: "10px",
                background: "var(--bg-card-subtle)",
                color: "#FFF",
                fontSize: "12.5px",
                fontWeight: 600,
              }}
            >
              Fechar Vistoria
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: PREVIEW DE FOTOS DE VISTORIA */}
      {/* ==================================================================== */}
      {selectedPhotoPreview && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 110,
            padding: "20px",
          }}
        >
          <div className="glass-modal" style={{ maxWidth: "560px", width: "100%", padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Camera size={18} color="#38BDF8" />
                <h4 style={{ fontSize: "14px", color: "#FFF", margin: 0 }}>Vistoria Fotográfica da O.S.</h4>
              </div>
              <button onClick={() => setSelectedPhotoPreview(null)} style={{ color: "var(--text-dim)", padding: "4px" }}>
                <X size={18} />
              </button>
            </div>

            <img
              src={selectedPhotoPreview}
              alt="Foto ampliada da vistoria"
              style={{ width: "100%", maxHeight: "68vh", objectFit: "contain", display: "block", background: "#05070B", marginBottom: "18px" }}
            />

            <button onClick={() => setSelectedPhotoPreview(null)} style={{ width: "100%", padding: "10px", background: "var(--bg-card-subtle)", color: "#FFF", fontSize: "12px" }}>
              Fechar Galeria
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
            background: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
        >
          <div className="glass-modal" style={{ maxWidth: "420px", width: "100%", padding: "24px" }}>
            <h3 style={{ fontSize: "16px", color: "var(--primary)", margin: "0 0 6px" }}>Alterar Senha do Admin</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "12px", marginBottom: "16px" }}>
              Define uma nova senha para <strong>{passwordModalTenant.name}</strong> ({passwordModalTenant.email}).
            </p>

            <form onSubmit={handleResetPassword} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11.5px", color: "var(--text-muted)", marginBottom: "4px" }}>Nova Senha *</label>
                <input required type="text" placeholder="Digite a nova senha..." value={resetPasswordValue} onChange={(e) => setResetPasswordValue(e.target.value)} style={{ width: "100%" }} autoFocus />
              </div>

              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button type="button" onClick={() => setPasswordModalTenant(null)} style={{ flex: 1, padding: "9px", background: "var(--bg-card-subtle)", color: "#FFF", borderRadius: "var(--radius-sm)", fontSize: "12px" }}>
                  Cancelar
                </button>
                <button type="submit" style={{ flex: 1, padding: "9px", background: "var(--primary)", color: "#06080D", borderRadius: "var(--radius-sm)", fontSize: "12px", fontWeight: 800, boxShadow: "0 2px 8px rgba(158, 232, 36, 0.2)" }}>
                  Salvar Senha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL: DATA DE VENCIMENTO ESPECÍFICA */}
      {/* ==================================================================== */}
      {calendarModalTenant && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: "20px",
          }}
        >
          <div className="glass-modal" style={{ maxWidth: "400px", width: "100%", padding: "24px" }}>
            <h3 style={{ fontSize: "16px", color: "var(--primary)", margin: "0 0 6px" }}>Data de Vencimento Específica</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "12px", marginBottom: "16px" }}>{calendarModalTenant.name}</p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11.5px", color: "var(--text-muted)", marginBottom: "4px" }}>Data Final</label>
                <input type="date" value={exactDateValue} onChange={(e) => setExactDateValue(e.target.value)} style={{ width: "100%", colorScheme: "dark", borderRadius: "var(--radius-sm)" }} />
              </div>

              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button type="button" onClick={() => setCalendarModalTenant(null)} style={{ flex: 1, padding: "9px", background: "var(--bg-card-subtle)", color: "#FFF", borderRadius: "var(--radius-sm)", fontSize: "12px" }}>
                  Cancelar
                </button>
                <button type="button" onClick={handleSetExactDate} style={{ flex: 1, padding: "9px", background: "var(--primary)", color: "#06080D", borderRadius: "var(--radius-sm)", fontSize: "12px", fontWeight: 800, boxShadow: "0 2px 8px rgba(158, 232, 36, 0.2)" }}>
                  Atualizar Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 1: APROVAÇÃO DE TESTE DE 14 DIAS & GERAÇÃO DE SENHA (MASTER)  */}
      {/* ==================================================================== */}
      {approvingLead && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.85)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 120,
            padding: "20px",
          }}
        >
          <div
            className="glass-modal"
            style={{
              maxWidth: "580px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "26px",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border-strong)",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(158, 232, 36, 0.15)",
            }}
          >
            {/* Modal Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "var(--radius-md)",
                    background: "rgba(158, 232, 36, 0.15)",
                    border: "1px solid rgba(158, 232, 36, 0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Sparkles size={20} color="var(--primary)" />
                </div>
                <div>
                  <h3 style={{ fontSize: "17px", fontWeight: 800, color: "#FFF", margin: 0 }}>
                    Aprovação de Teste de 14 Dias
                  </h3>
                  <span style={{ fontSize: "12px", color: "var(--primary)", fontWeight: 600 }}>
                    GIRAVO • Gestão que faz seu negócio girar
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setApprovingLead(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-dim)",
                  padding: "4px",
                  cursor: "pointer",
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Banner de Instrução do Fluxo */}
            <div
              style={{
                background: "rgba(158, 232, 36, 0.08)",
                border: "1px solid rgba(158, 232, 36, 0.25)",
                padding: "12px 14px",
                borderRadius: "var(--radius-sm)",
                marginBottom: "18px",
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
              }}
            >
              <KeyRound size={16} color="var(--primary)" style={{ flexShrink: 0, marginTop: "2px" }} />
              <div style={{ fontSize: "12px", color: "#E2E8F0", lineHeight: "1.45" }}>
                <strong style={{ color: "var(--primary)" }}>Geração de Senha pelo Master Admin:</strong> O cliente enviou o formulário público da landing page sem definir senha. Você define ou gera a senha provisória abaixo e, ao confirmar, a oficina será criada com acesso liberado.
              </div>
            </div>

            <form onSubmit={handleConfirmApproval} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Linha 1: Oficina e Responsável */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, color: "var(--text-muted)", marginBottom: "5px" }}>
                    Nome da Oficina *
                  </label>
                  <input
                    type="text"
                    required
                    value={approvalWorkshopName}
                    onChange={(e) => setApprovalWorkshopName(e.target.value)}
                    style={{ width: "100%", borderRadius: "var(--radius-sm)" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, color: "var(--text-muted)", marginBottom: "5px" }}>
                    Nome do Responsável *
                  </label>
                  <input
                    type="text"
                    required
                    value={approvalOwnerName}
                    onChange={(e) => setApprovalOwnerName(e.target.value)}
                    style={{ width: "100%", borderRadius: "var(--radius-sm)" }}
                  />
                </div>
              </div>

              {/* Linha 2: E-mail e WhatsApp */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, color: "var(--text-muted)", marginBottom: "5px" }}>
                    E-mail de Login do Admin *
                  </label>
                  <input
                    type="email"
                    required
                    value={approvalEmail}
                    onChange={(e) => setApprovalEmail(e.target.value)}
                    style={{ width: "100%", borderRadius: "var(--radius-sm)" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, color: "var(--text-muted)", marginBottom: "5px" }}>
                    WhatsApp do Cliente *
                  </label>
                  <input
                    type="text"
                    required
                    value={approvalPhone}
                    onChange={(e) => setApprovalPhone(e.target.value)}
                    style={{ width: "100%", borderRadius: "var(--radius-sm)" }}
                  />
                </div>
              </div>

              {/* Linha 3: Bloco de Senha Provisória Gerada */}
              <div
                style={{
                  background: "#080B12",
                  border: "1px solid rgba(158, 232, 36, 0.3)",
                  padding: "14px",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 800, color: "#FFF", display: "flex", alignItems: "center", gap: "6px" }}>
                    <KeyRound size={14} color="var(--primary)" />
                    <span>Senha Provisória de Acesso da Oficina *</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setApprovalPassword(generateRandomPassword())}
                    style={{
                      background: "rgba(158, 232, 36, 0.15)",
                      color: "var(--primary)",
                      border: "1px solid rgba(158, 232, 36, 0.35)",
                      padding: "4px 8px",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "11px",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <RefreshCw size={12} />
                    <span>Gerar Outra</span>
                  </button>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    required
                    value={approvalPassword}
                    onChange={(e) => setApprovalPassword(e.target.value)}
                    style={{
                      flex: 1,
                      fontFamily: "monospace",
                      fontSize: "14px",
                      fontWeight: 700,
                      letterSpacing: "1px",
                      color: "var(--primary)",
                      background: "#05070B",
                      border: "1px solid var(--border-strong)",
                      borderRadius: "var(--radius-sm)",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(approvalPassword);
                      showToast("Senha copiada para a área de transferência!", "success");
                    }}
                    style={{
                      padding: "8px 12px",
                      background: "var(--bg-card-subtle)",
                      border: "1px solid var(--border-subtle)",
                      color: "#FFF",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "11.5px",
                      cursor: "pointer",
                    }}
                  >
                    <Copy size={13} />
                  </button>
                </div>
                <span style={{ fontSize: "11px", color: "var(--text-dim)", marginTop: "6px", display: "block" }}>
                  Você poderá enviar esta senha pelo WhatsApp do cliente com 1 clique assim que aprovar.
                </span>
              </div>

              {/* Linha 4: Período de Teste (Validade) */}
              <div>
                <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, color: "var(--text-muted)", marginBottom: "6px" }}>
                  Período de Teste Gratuito *
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {[14, 30, 60].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setApprovalDays(d)}
                      style={{
                        flex: 1,
                        padding: "8px",
                        fontSize: "12px",
                        fontWeight: approvalDays === d ? 800 : 500,
                        background: approvalDays === d ? "var(--primary)" : "var(--bg-card-subtle)",
                        color: approvalDays === d ? "#06080D" : "var(--text-muted)",
                        borderRadius: "var(--radius-sm)",
                        border: approvalDays === d ? "1px solid var(--primary)" : "1px solid var(--border-subtle)",
                        cursor: "pointer",
                      }}
                    >
                      {d} dias {d === 14 ? "(Padrão)" : ""}
                    </button>
                  ))}
                  <div style={{ width: "90px" }}>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={approvalDays}
                      onChange={(e) => setApprovalDays(Number(e.target.value))}
                      placeholder="Dias"
                      style={{ width: "100%", borderRadius: "var(--radius-sm)", textAlign: "center" }}
                    />
                  </div>
                </div>
              </div>

              {/* Linha 5: Módulos Habilitados */}
              <div>
                <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, color: "var(--text-muted)", marginBottom: "6px" }}>
                  Módulos Liberados para esta Oficina:
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {[
                    { key: "ordens_servico", label: "Ordens de Serviço" },
                    { key: "checklist_fotos", label: "Checklist com Fotos" },
                    { key: "estoque_pecas", label: "Estoque de Peças" },
                    { key: "pdv_balcao", label: "PDV Balcão" },
                    { key: "financeiro", label: "Financeiro & Contas" },
                    { key: "whatsapp_crm", label: "WhatsApp CRM" },
                    { key: "relatorios", label: "Relatórios & DRE" },
                  ].map((m) => (
                    <label
                      key={m.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "11.5px",
                        color: "#E2E8F0",
                        background: "#080B12",
                        padding: "6px 10px",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border-subtle)",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={approvalFeatures[m.key] !== false}
                        onChange={(e) =>
                          setApprovalFeatures((prev) => ({
                            ...prev,
                            [m.key]: e.target.checked,
                          }))
                        }
                        style={{ accentColor: "var(--primary)" }}
                      />
                      <span>{m.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Footer Actions */}
              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setApprovingLead(null)}
                  disabled={approvalLoading}
                  style={{
                    flex: 1,
                    padding: "11px",
                    background: "var(--bg-card-subtle)",
                    color: "#FFF",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={approvalLoading}
                  style={{
                    flex: 2,
                    padding: "11px",
                    background: "var(--primary)",
                    color: "#06080D",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "13px",
                    fontWeight: 900,
                    boxShadow: "0 2px 14px rgba(158, 232, 36, 0.35)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    cursor: "pointer",
                  }}
                >
                  {approvalLoading ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Criando Conta e Liberando...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} strokeWidth={2.5} />
                      <span>Confirmar Aprovação & Criar Acesso</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: SUCESSO & ENVIO DOS DADOS DE ACESSO VIA WHATSAPP (1-CLIQUE) */}
      {/* ==================================================================== */}
      {approvedSuccessData && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.88)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 130,
            padding: "20px",
          }}
        >
          <div
            className="glass-modal"
            style={{
              maxWidth: "540px",
              width: "100%",
              padding: "28px",
              borderRadius: "var(--radius-lg)",
              border: "1px solid rgba(158, 232, 36, 0.4)",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(158, 232, 36, 0.2)",
              textAlign: "center",
            }}
          >
            {/* Ícone de Sucesso */}
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "var(--radius-full)",
                background: "rgba(158, 232, 36, 0.18)",
                border: "2px solid var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <CheckCircle2 size={32} color="var(--primary)" />
            </div>

            <h3 style={{ fontSize: "20px", fontWeight: 900, color: "#FFF", margin: "0 0 6px" }}>
              Oficina Aprovada com Sucesso! 🚀
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: "0 0 20px" }}>
              A conta da oficina <strong>{approvedSuccessData.lead.workshop_name || approvedSuccessData.lead.name}</strong> foi provisionada no banco de dados com teste de 14 dias ativo.
            </p>

            {/* Card com os Dados de Acesso */}
            <div
              style={{
                background: "#080B12",
                border: "1px solid var(--border-strong)",
                borderRadius: "var(--radius-md)",
                padding: "16px",
                textAlign: "left",
                marginBottom: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-dim)", textTransform: "uppercase" }}>Link de Acesso</span>
                  <div style={{ color: "#38BDF8", fontSize: "13px", fontWeight: 700 }}>
                    {approvedSuccessData.workshopUrl}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(approvedSuccessData.workshopUrl);
                    showToast("Link copiado!", "success");
                  }}
                  style={{
                    background: "var(--bg-card-subtle)",
                    border: "1px solid var(--border-subtle)",
                    color: "#FFF",
                    padding: "4px 8px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "11px",
                    cursor: "pointer",
                  }}
                >
                  <Copy size={12} />
                </button>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-dim)", textTransform: "uppercase" }}>E-mail de Login</span>
                  <div style={{ color: "#FFF", fontSize: "13px", fontWeight: 700 }}>
                    {approvedSuccessData.lead.email}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(approvedSuccessData.lead.email);
                    showToast("E-mail copiado!", "success");
                  }}
                  style={{
                    background: "var(--bg-card-subtle)",
                    border: "1px solid var(--border-subtle)",
                    color: "#FFF",
                    padding: "4px 8px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "11px",
                    cursor: "pointer",
                  }}
                >
                  <Copy size={12} />
                </button>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-dim)", textTransform: "uppercase" }}>Senha Provisória Gerada</span>
                  <div style={{ color: "var(--primary)", fontSize: "14px", fontWeight: 800, fontFamily: "monospace" }}>
                    {approvedSuccessData.password}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(approvedSuccessData.password);
                    showToast("Senha copiada!", "success");
                  }}
                  style={{
                    background: "rgba(158, 232, 36, 0.15)",
                    border: "1px solid rgba(158, 232, 36, 0.35)",
                    color: "var(--primary)",
                    padding: "4px 8px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <Copy size={12} />
                </button>
              </div>

              <div>
                <span style={{ fontSize: "11px", color: "var(--text-dim)", textTransform: "uppercase" }}>Validade do Teste</span>
                <div style={{ color: "#34D399", fontSize: "12.5px", fontWeight: 600 }}>
                  14 Dias (expira em {approvedSuccessData.expiresAt ? new Date(approvedSuccessData.expiresAt).toLocaleDateString("pt-BR") : "14 dias"})
                </div>
              </div>
            </div>

            {/* Ação Principal: WhatsApp com 1 Clique */}
            {approvedSuccessData.lead.phone ? (
              <a
                href={`https://wa.me/55${approvedSuccessData.lead.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                  getWhatsAppMessageText({
                    ownerName: approvedSuccessData.lead.name || "Proprietário",
                    workshopName: approvedSuccessData.lead.workshop_name || "sua Oficina",
                    email: approvedSuccessData.lead.email || "",
                    password: approvedSuccessData.password,
                    url: approvedSuccessData.workshopUrl,
                    days: 14,
                  })
                )}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  width: "100%",
                  padding: "13px",
                  background: "#25D366",
                  color: "#06080D",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "14px",
                  fontWeight: 900,
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  marginBottom: "10px",
                  boxShadow: "0 4px 16px rgba(37, 211, 102, 0.35)",
                }}
              >
                <MessageSquare size={17} />
                <span>Enviar Dados de Acesso no WhatsApp do Cliente</span>
              </a>
            ) : null}

            <button
              type="button"
              onClick={() => setApprovedSuccessData(null)}
              style={{
                width: "100%",
                padding: "10px",
                background: "var(--bg-card-subtle)",
                color: "#FFF",
                borderRadius: "var(--radius-sm)",
                fontSize: "12.5px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Concluir e Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
