"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  ShieldCheck,
  Lock,
  CreditCard,
  Sparkles,
  Building2,
  User,
  Phone,
  Mail,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  MessageSquare,
  AlertCircle,
  Clock,
  Zap,
  Check,
  ChevronRight,
  Shield,
  Layers,
  Wrench,
  Camera,
  Package,
  ShoppingCart,
  DollarSign,
  BarChart3,
  HelpCircle,
  Copy,
  QrCode,
  Key,
} from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { GiravoIcon, GiravoLogo } from "@/components/GiravoBrand";

interface PlanItem {
  key: string;
  name: string;
  priceCents: number;
  priceFormatted: string;
  description: string;
  maxUsers: number;
  features: Record<string, boolean>;
}

interface TenantData {
  id: string;
  name: string;
  ownerName: string;
  email: string;
  phone: string;
  status: string;
  billingStatus: string;
  expiresAt: string | null;
  lastPaymentAt: string | null;
}

interface PixData {
  key: string;
  keyType: string;
  beneficiary: string;
  city: string;
}

const FEATURE_LABELS: Record<string, { label: string; desc: string }> = {
  ordens_servico: { label: "Ordens de Serviço & Orçamentos", desc: "Abertura de O.S., placa, modelo e serviços" },
  checklist_fotos: { label: "Checklist com Vistoria Fotográfica", desc: "Fotos de entrada e saída com laudo digital" },
  estoque_pecas: { label: "Controle de Estoque & Peças", desc: "Catálogo completo, custos e margem de lucro" },
  pdv_balcao: { label: "Frente de Caixa (PDV Balcão)", desc: "Venda rápida de peças e serviços sem burocracia" },
  financeiro: { label: "Financeiro & Contas a Pagar/Receber", desc: "Fluxo de caixa diário e controle financeiro" },
  whatsapp_crm: { label: "WhatsApp CRM & Mensagens", desc: "Avisos de status do veículo enviados direto no WhatsApp" },
  relatorios: { label: "Relatórios Gerenciais & Lucratividade", desc: "DRE, faturamento e desempenho da equipe" },
};

function generatePixPayload(key: string, name: string, city: string, amount: number, txid: string = "GIRAVO") {
  const formatField = (id: string, value: string) => {
    const len = value.length.toString().padStart(2, "0");
    return `${id}${len}${value}`;
  };

  const cleanName = (name || "GIRAVO")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .substring(0, 25)
    .toUpperCase();
  const cleanCity = (city || "SAO PAULO")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .substring(0, 15)
    .toUpperCase();
  const amountStr = amount.toFixed(2);

  const merchantAccountInfo = formatField("00", "BR.GOV.BCB.PIX") + formatField("01", key);
  const additionalData = formatField("05", txid);

  const raw =
    formatField("00", "01") +
    formatField("26", merchantAccountInfo) +
    formatField("52", "0000") +
    formatField("53", "986") +
    formatField("54", amountStr) +
    formatField("58", "BR") +
    formatField("59", cleanName) +
    formatField("60", cleanCity) +
    formatField("62", additionalData) +
    "6304";

  let crc = 0xffff;
  for (let i = 0; i < raw.length; i++) {
    crc ^= raw.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  const crcHex = (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
  return raw + crcHex;
}

export default function PagamentoPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const tenantId = (params?.id as string) || "";

  const isSuccessRedirect = searchParams.get("sucesso") === "1";
  const isCancelRedirect = searchParams.get("cancelado") === "1";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanItem | null>(null);
  const [catalog, setCatalog] = useState<PlanItem[]>([]);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [publishableKey, setPublishableKey] = useState<string>("");
  const [pixData, setPixData] = useState<PixData>({
    key: "financeiro@giravo.com.br",
    keyType: "E-mail",
    beneficiary: "GIRAVO Soluções Automotivas",
    city: "SÃO PAULO",
  });
  const [isPaid, setIsPaid] = useState(false);
  const [updatingPlan, setUpdatingPlan] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  // Tab de pagamento selecionada: "card" ou "pix"
  const [paymentTab, setPaymentTab] = useState<"card" | "pix">("card");

  // Estado da cópia do PIX
  const [pixCopied, setPixCopied] = useState(false);

  const [showKeyConfig, setShowKeyConfig] = useState(false);
  const [inputPublishableKey, setInputPublishableKey] = useState("");
  const savingKey = false;
  const keySaveMessage = "";

  // Estado de configuração da chave Stripe pelo Admin
  // Estado de montagem do Stripe Embedded
  const [stripeMounted, setStripeMounted] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState("");
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const stripeCheckoutRef = useRef<any>(null);
  const stripeActionsRef = useRef<any>(null);

  // FAQ state
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const fetchInvoice = async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`/api/pagamento?id=${encodeURIComponent(tenantId)}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Não foi possível localizar os dados desta fatura.");
      }

      setTenant(data.tenant);
      setSelectedPlan(data.plan);
      setCatalog(data.catalog || []);
      setCheckoutUrl(data.checkoutUrl || null);
      setClientSecret(data.clientSecret || null);
      setBillingCycle(data.billingCycle === "annual" ? "annual" : "monthly");
      setStripeError(data.checkoutError || "");
      if (data.publishableKey) {
        setPublishableKey(data.publishableKey);
      }
      if (data.pix) {
        setPixData(data.pix);
      }
      setIsPaid(Boolean(data.isPaid));
    } catch (err: any) {
      console.error("[FETCH INVOICE]", err);
      setError(err.message || "Erro de conexão ao carregar a fatura.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
  }, [tenantId]);

  // Monta o checkout embutido do Stripe quando houver publishableKey e clientSecret
  useEffect(() => {
    let isCancelled = false;

    async function mountEmbedded() {
      if (isPaid || !publishableKey || !clientSecret || paymentTab !== "card") {
        return;
      }

      const mountPoint = document.getElementById("stripe-embedded-checkout");
      if (!mountPoint) return;

      try {
        setStripeLoading(true);
        setStripeError("");
        setStripeMounted(false);
        if (stripeCheckoutRef.current) {
          try {
            stripeCheckoutRef.current.unmount();
          } catch (_) {}
          stripeCheckoutRef.current = null;
        }

        mountPoint.innerHTML = "";

        const stripe = await loadStripe(publishableKey);
        if (!stripe || isCancelled) return;

        const checkoutSdk = stripe.initCheckoutElementsSdk({
          clientSecret,
          elementsOptions: {
            appearance: {
              theme: "night",
              variables: {
                colorPrimary: "#9ee824",
                colorBackground: "#0b111b",
                colorText: "#f8fafc",
                colorDanger: "#fb7185",
                borderRadius: "10px",
                fontFamily: "inherit",
              },
              rules: {
                ".Input": { border: "1px solid rgba(255,255,255,.14)", boxShadow: "none" },
                ".Input:focus": { border: "1px solid #9ee824", boxShadow: "0 0 0 1px #9ee824" },
                ".Tab": { border: "1px solid rgba(255,255,255,.12)", boxShadow: "none" },
                ".Tab--selected": { border: "1px solid #9ee824", boxShadow: "none" },
              },
            },
          },
        });
        const actionsResult = await checkoutSdk.loadActions();
        if (isCancelled) return;
        if (actionsResult.type === "error") throw new Error(actionsResult.error.message);
        stripeActionsRef.current = actionsResult.actions;
        const paymentElement = checkoutSdk.createPaymentElement({ layout: "tabs" });
        stripeCheckoutRef.current = paymentElement;
        paymentElement.mount("#stripe-embedded-checkout");
        setStripeMounted(true);
      } catch (err: any) {
        console.error("[MOUNT STRIPE EMBEDDED ERROR]", err);
        setStripeError(err?.message || "Não foi possível carregar o formulário seguro da Stripe.");
      } finally {
        if (!isCancelled) setStripeLoading(false);
      }
    }

    mountEmbedded();

    return () => {
      isCancelled = true;
      if (stripeCheckoutRef.current) {
        try {
          stripeCheckoutRef.current.unmount();
        } catch (_) {}
        stripeCheckoutRef.current = null;
      }
      stripeActionsRef.current = null;
    };
  }, [publishableKey, clientSecret, paymentTab, isPaid, selectedPlan?.key]);

  const handleConfirmPayment = async () => {
    const actions = stripeActionsRef.current;
    if (!actions || confirmingPayment) return;
    try {
      setConfirmingPayment(true);
      setStripeError("");
      const validation = await actions.validateElements();
      if (validation.type === "error") throw new Error(validation.error.message);
      const result = await actions.confirm({
        redirect: "if_required",
      });
      if (result.type === "error") throw new Error(result.error.message);
      await fetchInvoice();
    } catch (err: any) {
      setStripeError(err?.message || "Não foi possível confirmar o pagamento.");
    } finally {
      setConfirmingPayment(false);
    }
  };

  const handleSelectPlan = async (planKey: string) => {
    if (!tenant || planKey === selectedPlan?.key || updatingPlan) return;
    try {
      setUpdatingPlan(true);
      const res = await fetch("/api/pagamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenant.id, plan: planKey, billingCycle }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Falha ao trocar o plano.");
      }

      const newPlan = catalog.find((p) => p.key === planKey);
      if (newPlan) setSelectedPlan(newPlan);
      if (data.checkoutUrl) setCheckoutUrl(data.checkoutUrl);
      if (data.clientSecret) setClientSecret(data.clientSecret);
    } catch (err: any) {
      alert(err.message || "Erro ao atualizar o plano.");
    } finally {
      setUpdatingPlan(false);
    }
  };

  const handleBillingCycle = async (cycle: "monthly" | "annual") => {
    if (!tenant || !selectedPlan || cycle === billingCycle || updatingPlan) return;
    try {
      setUpdatingPlan(true);
      setStripeMounted(false);
      setStripeError("");
      setPaymentTab("card");
      const res = await fetch("/api/pagamento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenant.id, plan: selectedPlan.key, billingCycle: cycle }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Falha ao alterar a forma de cobrança.");
      setBillingCycle(cycle);
      setCheckoutUrl(data.checkoutUrl || null);
      setClientSecret(data.clientSecret || null);
    } catch (err: any) {
      setStripeError(err.message || "Não foi possível atualizar o checkout.");
    } finally {
      setUpdatingPlan(false);
    }
  };

  const handleSavePublishableKey = () => {
    alert("Por segurança, configure STRIPE_PUBLISHABLE_KEY nas variáveis do servidor e faça um novo deploy.");
  };

  // Cálculo do código PIX
  const currentPriceNumber = selectedPlan ? selectedPlan.priceCents / 100 : 149.9;
  const annualPriceCents = selectedPlan ? Math.round(selectedPlan.priceCents * 12 * 0.9) : 0;
  const displayedTotal = billingCycle === "annual" ? annualPriceCents : (selectedPlan?.priceCents || 0);
  const displayedTotalFormatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(displayedTotal / 100);
  const pixCode = generatePixPayload(
    pixData.key,
    pixData.beneficiary,
    pixData.city,
    currentPriceNumber,
    `GIRAVO-${tenant?.id?.slice(-6) || "PAY"}`
  );

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixCode);
    setPixCopied(true);
    setTimeout(() => setPixCopied(false), 3000);
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#06080D", color: "#FFF" }}>
        <GiravoIcon size={52} color="var(--primary)" />
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "20px", color: "var(--text-muted)", fontSize: "14px" }}>
          <RefreshCw size={16} className="animate-spin" />
          <span>Carregando sua fatura com ambiente seguro...</span>
        </div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#06080D", padding: "20px" }}>
        <div className="checkout-card" style={{ maxWidth: "480px", textAlign: "center", padding: "36px 28px" }}>
          <AlertCircle size={44} color="var(--rose)" style={{ margin: "0 auto 16px" }} />
          <h2 style={{ fontSize: "20px", fontWeight: 800, margin: "0 0 8px" }}>Fatura Não Encontrada</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "13.5px", margin: "0 0 24px" }}>
            {error || "O identificador informado não corresponde a uma oficina ativa no sistema."}
          </p>
          <a
            href="https://wa.me/5511999999999?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20com%20o%20pagamento%20da%20minha%20oficina%20no%20GIRAVO."
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "12px 20px",
              background: "#25D366",
              color: "#06080D",
              borderRadius: "10px",
              fontWeight: 800,
              fontSize: "13px",
              textDecoration: "none",
            }}
          >
            <MessageSquare size={16} />
            <span>Falar com o Suporte no WhatsApp</span>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      {/* ================================================================== */}
      {/* HEADER DE CHECKOUT SEGURO                                         */}
      {/* ================================================================== */}
      <header
        style={{
          borderBottom: "1px solid var(--border-subtle)",
          background: "rgba(6, 8, 13, 0.95)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 50,
          padding: "14px 24px",
        }}
      >
        <div
          style={{
            maxWidth: "1140px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <GiravoLogo size={26} variant="compact" />
            <span
              style={{
                fontSize: "10px",
                fontWeight: 800,
                color: "var(--primary)",
                background: "rgba(158, 232, 36, 0.12)",
                border: "1px solid rgba(158, 232, 36, 0.3)",
                padding: "2px 7px",
                borderRadius: "4px",
                letterSpacing: "0.06em",
              }}
            >
              CHECKOUT OFICIAL
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                color: "#34D399",
                background: "rgba(16, 185, 129, 0.1)",
                padding: "4px 10px",
                borderRadius: "6px",
                border: "1px solid rgba(16, 185, 129, 0.25)",
              }}
            >
              <Lock size={13} />
              <span className="desktop-only">Ambiente 100% Seguro (SSL 256-bit)</span>
              <span className="mobile-only">Seguro (SSL)</span>
            </div>

            <a
              href="https://wa.me/5511999999999?text=Ol%C3%A1%2C%20estou%20na%20p%C3%A1gina%20de%20pagamento%20e%20gostaria%20de%20tirar%20uma%20d%C3%BAvida."
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "12px",
                fontWeight: 700,
                color: "var(--text-muted)",
                textDecoration: "none",
              }}
            >
              <MessageSquare size={14} color="#25D366" />
              <span>Ajuda</span>
            </a>
          </div>
        </div>
      </header>

      {/* ================================================================== */}
      {/* CONTEÚDO PRINCIPAL                                                */}
      {/* ================================================================== */}
      <main style={{ maxWidth: "1140px", margin: "0 auto", padding: "28px 20px 60px" }}>
        {/* Banner de Feedback de Pagamento / Cancelamento */}
        {isPaid && (
          <div
            style={{
              background: "linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(5, 150, 105, 0.08))",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              borderRadius: "14px",
              padding: "24px",
              marginBottom: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: "rgba(16, 185, 129, 0.2)",
                  display: "grid",
                  placeItems: "center",
                  color: "#34D399",
                }}
              >
                <CheckCircle2 size={28} />
              </div>
              <div>
                <h3 style={{ fontSize: "17px", fontWeight: 800, color: "#FFF", margin: "0 0 4px" }}>
                  🎉 Pagamento Aprovado com Sucesso!
                </h3>
                <p style={{ color: "#D1FAE5", fontSize: "13px", margin: 0 }}>
                  A assinatura da <strong>{tenant.name}</strong> está 100% ativa. Todos os recursos foram liberados.
                </p>
              </div>
            </div>
            <a
              href="http://localhost:3000"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 20px",
                background: "#10B981",
                color: "#06080D",
                borderRadius: "10px",
                fontWeight: 800,
                fontSize: "13px",
                textDecoration: "none",
                boxShadow: "0 4px 16px rgba(16, 185, 129, 0.3)",
              }}
            >
              <span>Acessar o Painel da Oficina</span>
              <ArrowRight size={16} />
            </a>
          </div>
        )}

        {isCancelRedirect && !isPaid && (
          <div
            style={{
              background: "rgba(245, 158, 11, 0.12)",
              border: "1px solid rgba(245, 158, 11, 0.35)",
              borderRadius: "12px",
              padding: "14px 18px",
              marginBottom: "24px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              fontSize: "13px",
              color: "#FDE68A",
            }}
          >
            <Clock size={18} color="#FBBF24" />
            <span>O pagamento anterior foi interrompido. Você pode concluir os dados abaixo com total segurança.</span>
          </div>
        )}

        {/* Top Info da Oficina */}
        <div
          style={{
            background: "rgba(13, 17, 26, 0.8)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "14px",
            padding: "16px 20px",
            marginBottom: "24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: "linear-gradient(145deg, #1A2234, #0F1420)",
                border: "1px solid rgba(158, 232, 36, 0.3)",
                color: "var(--primary)",
                display: "grid",
                placeItems: "center",
                fontWeight: 900,
                fontSize: "15px",
                flexShrink: 0,
              }}
            >
              {tenant.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#FFF", margin: 0 }}>
                  {tenant.name}
                </h2>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 800,
                    padding: "2px 7px",
                    borderRadius: "4px",
                    background: isPaid ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                    color: isPaid ? "#34D399" : "#FBBF24",
                    border: `1px solid ${isPaid ? "rgba(16, 185, 129, 0.3)" : "rgba(245, 158, 11, 0.3)"}`,
                  }}
                >
                  {isPaid ? "ASSINATURA EM DIA" : "AGUARDANDO PAGAMENTO"}
                </span>
              </div>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                Responsável: <strong style={{ color: "#E2E8F0" }}>{tenant.ownerName}</strong>
                {tenant.phone && <span> • WhatsApp: {tenant.phone}</span>}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "var(--text-dim)" }}>
            <ShieldCheck size={14} color="var(--primary)" />
            <span>Fatura Gerada pelo Painel Master GIRAVO</span>
          </div>
        </div>

        {/* Grid de 2 Colunas */}
        <div className="checkout-grid">
          {/* ================================================================ */}
          {/* COLUNA ESQUERDA: PLANOS & BENEFÍCIOS                            */}
          {/* ================================================================ */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Seletor de Planos */}
            <div className="checkout-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#FFF", margin: 0 }}>
                    Selecione ou Confirme o Plano
                  </h3>
                  <p style={{ margin: "3px 0 0", color: "var(--text-muted)", fontSize: "12px" }}>
                    Você pode alterar o plano a qualquer momento sem taxas adicionais
                  </p>
                </div>
                <Sparkles size={18} color="var(--primary)" />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px" }}>
                {catalog.map((p) => {
                  const isSelected = selectedPlan?.key === p.key;
                  const isPopular = p.key === "PROFISSIONAL";

                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => handleSelectPlan(p.key)}
                      disabled={updatingPlan || isPaid}
                      className={`checkout-plan-btn ${isSelected ? "selected" : ""}`}
                    >
                      {isPopular && (
                        <span
                          style={{
                            position: "absolute",
                            top: "-8px",
                            right: "10px",
                            background: "var(--primary)",
                            color: "#06080D",
                            fontSize: "9px",
                            fontWeight: 900,
                            padding: "1px 6px",
                            borderRadius: "4px",
                            letterSpacing: "0.04em",
                          }}
                        >
                          MAIS ESCOLHIDO
                        </span>
                      )}

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "11px", fontWeight: 800, color: isSelected ? "var(--primary)" : "var(--text-dim)", textTransform: "uppercase" }}>
                          {p.name}
                        </span>
                        {isSelected && <Check size={14} color="var(--primary)" strokeWidth={3} />}
                      </div>

                      <div style={{ fontSize: "18px", fontWeight: 900, color: "#FFF", fontFamily: "var(--font-mono)" }}>
                        {p.priceFormatted}
                        <small style={{ fontSize: "10px", color: "var(--text-dim)", fontWeight: 500 }}>/mês</small>
                      </div>

                      <span style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>
                        Até {p.maxUsers} operador(es)
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* O Que Está Incluso no Plano */}
            <div className="checkout-card">
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                <Layers size={18} color="var(--primary)" />
                <h3 style={{ fontSize: "15px", fontWeight: 800, color: "#FFF", margin: 0 }}>
                  Recursos Liberados no Plano {selectedPlan?.name}
                </h3>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {Object.entries(FEATURE_LABELS).map(([key, info]) => {
                  const enabled = Boolean(selectedPlan?.features?.[key]);

                  return (
                    <div
                      key={key}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        background: enabled ? "rgba(255, 255, 255, 0.02)" : "transparent",
                        opacity: enabled ? 1 : 0.45,
                      }}
                    >
                      <div
                        style={{
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          background: enabled ? "rgba(158, 232, 36, 0.15)" : "rgba(255, 255, 255, 0.06)",
                          color: enabled ? "var(--primary)" : "var(--text-dim)",
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                          marginTop: "2px",
                        }}
                      >
                        {enabled ? <Check size={13} strokeWidth={3} /> : <Lock size={12} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: "13px", color: enabled ? "#FFF" : "var(--text-dim)" }}>
                          {info.label}
                        </strong>
                        {info.desc && (
                          <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "1px" }}>
                            {info.desc}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Vantagens estruturais */}
              <div
                style={{
                  marginTop: "18px",
                  paddingTop: "14px",
                  borderTop: "1px solid var(--border-subtle)",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                  fontSize: "11.5px",
                  color: "var(--text-muted)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Zap size={14} color="var(--primary)" />
                  <span>Ativação Instantânea</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <ShieldCheck size={14} color="var(--primary)" />
                  <span>Sem Fidelidade</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Building2 size={14} color="var(--primary)" />
                  <span>Backup em Nuvem</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <MessageSquare size={14} color="var(--primary)" />
                  <span>Suporte WhatsApp</span>
                </div>
              </div>
            </div>
          </div>

          {/* ================================================================ */}
          {/* COLUNA DIREITA: CHECKOUT EMBUTIDO DIRETO NA TELA                 */}
          {/* ================================================================ */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              className="checkout-card"
              style={{
                border: "1px solid rgba(158, 232, 36, 0.3)",
                background: "linear-gradient(155deg, rgba(17, 24, 38, 0.98), rgba(9, 13, 20, 0.98))",
              }}
            >
              {/* Resumo da fatura */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <span style={{ fontSize: "11px", fontWeight: 800, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  RESUMO DA FATURA
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 800,
                    padding: "2px 7px",
                    borderRadius: "4px",
                    background: isPaid ? "rgba(16, 185, 129, 0.15)" : "rgba(158, 232, 36, 0.15)",
                    color: isPaid ? "#34D399" : "var(--primary)",
                  }}
                >
                  {isPaid ? "PAGO" : "FATURA ABERTA"}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "16px" }}>
                <button type="button" disabled={updatingPlan || isPaid} onClick={() => handleBillingCycle("monthly")} className={`payment-tab-btn ${billingCycle === "monthly" ? "active" : ""}`}>
                  <CreditCard size={15} /><span>Mensal</span>
                </button>
                <button type="button" disabled={updatingPlan || isPaid} onClick={() => handleBillingCycle("annual")} className={`payment-tab-btn ${billingCycle === "annual" ? "active" : ""}`}>
                  <Sparkles size={15} /><span>Anual · 10% OFF</span>
                </button>
              </div>

              {/* Detalhes de preço */}
              <div style={{ padding: "14px 0", borderTop: "1px solid var(--border-subtle)", borderBottom: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "8px" }}>
                  <span style={{ color: "var(--text-muted)" }}>Plano {selectedPlan?.name} ({billingCycle === "annual" ? "Anual" : "Mensal"})</span>
                  <span style={{ color: "#FFF", fontWeight: 700 }}>{billingCycle === "annual" ? `${selectedPlan?.priceFormatted} × 12` : selectedPlan?.priceFormatted}</span>
                </div>

                {billingCycle === "annual" && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "8px" }}>
                  <span style={{ color: "var(--text-muted)" }}>Desconto anual</span><span style={{ color: "var(--primary)", fontWeight: 800 }}>−10%</span>
                </div>}

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "8px" }}>
                  <span style={{ color: "var(--text-muted)" }}>Taxa de Setup & Implantação</span>
                  <span style={{ color: "var(--primary)", fontWeight: 800 }}>GRÁTIS (R$ 0,00)</span>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginTop: "12px",
                    paddingTop: "12px",
                    borderTop: "1px dashed var(--border-subtle)",
                  }}
                >
                  <div>
                    <strong style={{ fontSize: "14px", color: "#FFF" }}>Total a Pagar</strong>
                    <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>{billingCycle === "annual" ? "Pagamento único · 12 meses de acesso" : "Cobrança recorrente mensal"}</div>
                  </div>
                  <strong style={{ fontSize: "26px", color: "var(--primary)", fontFamily: "var(--font-mono)", fontWeight: 900 }}>
                    {displayedTotalFormatted}
                  </strong>
                </div>
              </div>

              {/* ============================================================== */}
              {/* TABS DE MÉTODO DE PAGAMENTO                                    */}
              {/* ============================================================== */}
              {!isPaid && (
                <div style={{ marginTop: "18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "14px", color: "var(--text-muted)", fontSize: "12px" }}>
                    {billingCycle === "annual" ? <QrCode size={15} color="var(--primary)" /> : <CreditCard size={15} color="var(--primary)" />}
                    <span>{billingCycle === "annual" ? "Escolha cartão ou PIX" : "Pagamento seguro com cartão"}</span>
                  </div>

                  {/* ABA 1: CARTÃO DE CRÉDITO DIRETO NA TELA */}
                  {paymentTab === "card" && (
                    <div>
                      {publishableKey && clientSecret ? (
                        <div>
                          <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                            <Lock size={13} color="var(--primary)" />
                            <span>{billingCycle === "annual" ? "Escolha cartão ou PIX no formulário seguro abaixo:" : "Preencha os dados do cartão diretamente abaixo para concluir:"}</span>
                          </div>

                          {stripeLoading && !stripeMounted && (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", padding: "40px 0", color: "var(--text-dim)", fontSize: "13px" }}>
                              <RefreshCw size={16} className="animate-spin" color="var(--primary)" />
                              <span>Carregando formulário seguro de cartão...</span>
                            </div>
                          )}

                          {stripeError && (
                            <div role="alert" style={{ marginBottom: "12px", padding: "12px 14px", borderRadius: "10px", border: "1px solid rgba(239, 68, 68, .35)", background: "rgba(239, 68, 68, .08)", color: "#fca5a5", fontSize: "12px", lineHeight: 1.5 }}>
                              {stripeError}
                            </div>
                          )}

                          {/* Container Oficial do Stripe Embedded */}
                          <div id="stripe-embedded-checkout" style={{ minHeight: stripeMounted ? "150px" : "220px" }} />
                          <button type="button" onClick={handleConfirmPayment} disabled={!stripeMounted || confirmingPayment} className="checkout-pay-btn" style={{ width: "100%", border: 0, marginTop: "14px", opacity: !stripeMounted || confirmingPayment ? 0.65 : 1, cursor: !stripeMounted || confirmingPayment ? "wait" : "pointer" }}>
                            {confirmingPayment ? <RefreshCw size={17} className="animate-spin" /> : billingCycle === "annual" ? <Sparkles size={17} /> : <CreditCard size={17} />}
                            <span>{confirmingPayment ? "Confirmando..." : billingCycle === "annual" ? `Pagar ${displayedTotalFormatted}` : `Assinar por ${displayedTotalFormatted}/mês`}</span>
                            {!confirmingPayment && <ArrowRight size={16} />}
                          </button>
                        </div>
                      ) : (
                        /* Preview de Cartão Titanium com Opções Diretas */
                        <div>
                          <div className="titanium-card-preview">
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: "12px", fontWeight: 800, color: "var(--primary)", letterSpacing: "1px" }}>
                                GIRAVO TITANIUM
                              </span>
                              <div style={{ display: "flex", gap: "4px" }}>
                                <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#EB001B", opacity: 0.85 }} />
                                <div style={{ width: "12px", height: "12px", borderRadius: "50%", background: "#F79E1B", opacity: 0.85, marginLeft: "-5px" }} />
                              </div>
                            </div>

                            <div style={{ marginTop: "16px" }}>
                              <div className="card-chip" />
                            </div>

                            <div className="card-number-display">
                              •••• •••• •••• ••••
                            </div>

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                              <div>
                                <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.6)", textTransform: "uppercase", display: "block" }}>
                                  Titular
                                </span>
                                <strong style={{ fontSize: "12px", letterSpacing: "0.5px" }}>
                                  {tenant.ownerName.toUpperCase() || "OFICINA CLIENTE"}
                                </strong>
                              </div>
                              <div>
                                <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.6)", textTransform: "uppercase", display: "block" }}>
                                  Validade
                                </span>
                                <strong style={{ fontSize: "12px" }}>MM/AA</strong>
                              </div>
                            </div>
                          </div>

                          {/* Caixa de Ativação do Stripe Embedded para o Admin */}
                          <div
                            style={{
                              background: "rgba(10, 15, 23, 0.9)",
                              border: "1px solid rgba(158, 232, 36, 0.25)",
                              borderRadius: "12px",
                              padding: "16px",
                              marginBottom: "16px",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#FFF" }}>
                                <Key size={14} color="var(--primary)" />
                                <span>Ativar Preenchimento Direto de Cartão</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowKeyConfig(!showKeyConfig)}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "var(--primary)",
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  textDecoration: "underline",
                                }}
                              >
                                {showKeyConfig ? "Ocultar" : "Configurar Chave"}
                              </button>
                            </div>

                            <p style={{ margin: "0 0 10px", fontSize: "11.5px", color: "var(--text-muted)", lineHeight: 1.4 }}>
                              Para os clientes digitarem o cartão diretamente nesta tela sem sair para o Stripe, insira sua <strong>Chave Publicável</strong> (obtida no painel Stripe &gt; Desenvolvedores &gt; Chaves de API).
                            </p>

                            {showKeyConfig && (
                              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
                                <input
                                  type="text"
                                  value={inputPublishableKey}
                                  onChange={(e) => setInputPublishableKey(e.target.value)}
                                  placeholder="pk_live_..."
                                  style={{
                                    width: "100%",
                                    padding: "9px 12px",
                                    borderRadius: "8px",
                                    background: "#06090F",
                                    border: "1px solid rgba(255,255,255,0.15)",
                                    color: "#FFF",
                                    fontSize: "12px",
                                    fontFamily: "monospace",
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={handleSavePublishableKey}
                                  disabled={savingKey}
                                  style={{
                                    padding: "8px 14px",
                                    background: "var(--primary)",
                                    color: "#000",
                                    border: "none",
                                    borderRadius: "8px",
                                    fontSize: "12px",
                                    fontWeight: 800,
                                    cursor: "pointer",
                                  }}
                                >
                                  {savingKey ? "Salvando..." : "Salvar e Ativar Formulário na Tela"}
                                </button>
                                {keySaveMessage && (
                                  <span style={{ fontSize: "11px", color: "#34D399" }}>{keySaveMessage}</span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Botões de Ação Alternativos */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                            {checkoutUrl && (
                              <a
                                href={checkoutUrl}
                                className="checkout-pay-btn"
                                style={{ opacity: updatingPlan ? 0.7 : 1 }}
                              >
                                <CreditCard size={18} />
                                <span>{updatingPlan ? "Atualizando..." : "Pagar Agora no Stripe Seguro"}</span>
                                <ArrowRight size={16} />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => handleBillingCycle("annual")}
                              style={{
                                padding: "12px",
                                background: "rgba(255, 255, 255, 0.05)",
                                border: "1px solid var(--border-subtle)",
                                color: "#FFF",
                                borderRadius: "10px",
                                fontSize: "13px",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "8px",
                              }}
                            >
                              <QrCode size={16} color="var(--primary)" />
                              <span>Pagar anual via PIX · 10% OFF</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ABA 2: PIX INSTANTÂNEO COM QR CODE & COPIA E COLA */}
                  {paymentTab === "pix" && (
                    <div className="pix-qr-container">
                      <div style={{ marginBottom: "14px" }}>
                        <span style={{ fontSize: "11px", color: "var(--text-dim)", textTransform: "uppercase", fontWeight: 700 }}>
                          Valor a Transferir
                        </span>
                        <div style={{ fontSize: "24px", fontWeight: 900, color: "var(--primary)", fontFamily: "var(--font-mono)" }}>
                          {selectedPlan?.priceFormatted}
                        </div>
                      </div>

                      {/* QR Code Dinâmico */}
                      <div className="pix-qr-wrapper">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixCode)}`}
                          alt="QR Code PIX GIRAVO"
                          style={{ width: "190px", height: "190px", display: "block" }}
                        />
                      </div>

                      <div style={{ fontSize: "11.5px", color: "var(--text-muted)", marginBottom: "4px" }}>
                        Abra o app do seu banco e escaneie o QR Code ou copie o código abaixo:
                      </div>

                      {/* Código Copia e Cola */}
                      <div className="pix-code-pill">
                        <span className="pix-code-text">{pixCode}</span>
                        <button type="button" onClick={handleCopyPix} className="pix-copy-btn">
                          {pixCopied ? <Check size={14} /> : <Copy size={14} />}
                          <span>{pixCopied ? "Copiado!" : "Copiar"}</span>
                        </button>
                      </div>

                      {/* Dados do Favorecido */}
                      <div
                        style={{
                          width: "100%",
                          marginTop: "16px",
                          padding: "12px",
                          borderRadius: "10px",
                          background: "rgba(255, 255, 255, 0.02)",
                          border: "1px solid rgba(255, 255, 255, 0.06)",
                          textAlign: "left",
                          fontSize: "11.5px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span style={{ color: "var(--text-dim)" }}>Chave PIX:</span>
                          <strong style={{ color: "#FFF" }}>{pixData.key}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span style={{ color: "var(--text-dim)" }}>Favorecido:</span>
                          <strong style={{ color: "#FFF" }}>{pixData.beneficiary}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "var(--text-dim)" }}>Cidade:</span>
                          <strong style={{ color: "#FFF" }}>{pixData.city}</strong>
                        </div>
                      </div>

                      {/* Botão Enviar Comprovante no WhatsApp */}
                      <a
                        href={`https://wa.me/5511999999999?text=${encodeURIComponent(
                          `Olá! Realizei o pagamento via PIX da oficina ${tenant.name} no valor de ${selectedPlan?.priceFormatted} referente ao plano ${selectedPlan?.name}. Segue o comprovante!`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          width: "100%",
                          marginTop: "16px",
                          padding: "13px 16px",
                          background: "#25D366",
                          color: "#06080D",
                          borderRadius: "10px",
                          fontWeight: 800,
                          fontSize: "13px",
                          textDecoration: "none",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          boxShadow: "0 4px 16px rgba(37, 211, 102, 0.25)",
                        }}
                      >
                        <MessageSquare size={16} />
                        <span>Já Paguei / Enviar Comprovante WhatsApp</span>
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Botão Quando Já Quitado */}
              {isPaid && (
                <div style={{ textAlign: "center", padding: "16px 0" }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#34D399", fontSize: "13px", fontWeight: 700, marginBottom: "14px" }}>
                    <CheckCircle2 size={18} />
                    <span>Fatura quitada com sucesso</span>
                  </div>
                  <a
                    href="http://localhost:3000"
                    className="checkout-pay-btn"
                    style={{ background: "var(--emerald)" }}
                  >
                    <span>Abrir Painel da Oficina</span>
                    <ArrowRight size={16} />
                  </a>
                </div>
              )}

              {/* Selos de Segurança Oficiais */}
              <div
                style={{
                  marginTop: "20px",
                  paddingTop: "16px",
                  borderTop: "1px solid var(--border-subtle)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  fontSize: "11px",
                  color: "var(--text-muted)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <ShieldCheck size={14} color="#34D399" />
                  <span>Criptografia de ponta a ponta (AES-256)</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <CreditCard size={14} color="#38BDF8" />
                  <span>{billingCycle === "annual" ? "Cartão ou PIX para o plano anual" : "Pagamento mensal somente no cartão"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Check size={14} color="var(--primary)" />
                  <span>Cancelamento fácil a qualquer momento</span>
                </div>
              </div>
            </div>

            {/* Dúvidas Rápidas (FAQ) */}
            <div className="checkout-card" style={{ padding: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <HelpCircle size={15} color="var(--primary)" />
                <h4 style={{ margin: 0, fontSize: "13px", fontWeight: 800, color: "#FFF" }}>Dúvidas Frequentes</h4>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
                <div style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "6px" }}>
                  <strong style={{ color: "#E2E8F0", display: "block", marginBottom: "2px" }}>
                    Quando meu acesso é ativado?
                  </strong>
                  <span style={{ color: "var(--text-muted)" }}>
                    Instantaneamente. O webhook confirma o pagamento em segundos e libera todos os módulos.
                  </span>
                </div>

                <div style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "6px" }}>
                  <strong style={{ color: "#E2E8F0", display: "block", marginBottom: "2px" }}>
                    Preciso assinar fidelidade?
                  </strong>
                  <span style={{ color: "var(--text-muted)" }}>
                    Não! O pagamento é mensal. Você tem liberdade para cancelar quando quiser.
                  </span>
                </div>

                <div>
                  <strong style={{ color: "#E2E8F0", display: "block", marginBottom: "2px" }}>
                    Precisa de nota fiscal ou suporte?
                  </strong>
                  <span style={{ color: "var(--text-muted)" }}>
                    Nossa equipe emite sua nota fiscal e fica à disposição no WhatsApp para qualquer necessidade.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ================================================================== */}
      {/* RODAPÉ INSTITUCIONAL GIRAVO                                       */}
      {/* ================================================================== */}
      <footer
        style={{
          marginTop: "60px",
          borderTop: "1px solid var(--border-subtle)",
          padding: "24px 20px",
          textAlign: "center",
          color: "var(--text-dim)",
          fontSize: "12px",
        }}
      >
        <div style={{ maxWidth: "1140px", margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
          <GiravoLogo size={22} variant="compact" />
          <p style={{ margin: 0 }}>
            © {new Date().getFullYear()} GIRAVO Software de Gestão para Oficinas. Todos os direitos reservados.
          </p>
          <p style={{ margin: 0, fontSize: "11px" }}>
            Tecnologia em nuvem com alta disponibilidade e segurança de dados bancários.
          </p>
        </div>
      </footer>
    </div>
  );
}
