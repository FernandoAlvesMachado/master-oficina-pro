import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import crypto from "crypto";
import { verifyRequestAuth } from "@/lib/auth";
import { ensureTablesOnce, query } from "@/lib/db";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { publicError } from "@/lib/validation";
import { normalizePlan, PLAN_CATALOG, stripePriceForPlan } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const formatDay = (date: Date) => date.toISOString().slice(0, 10);

export async function GET(req: NextRequest) {
  if (!(await verifyRequestAuth(req))) {
    return NextResponse.json({ success: false, error: "Acesso não autorizado." }, { status: 401 });
  }

  await ensureTablesOnce();
  const tenants = await query<any>(`
    SELECT id, name, email, status, stripe_customer_id, stripe_subscription_id,
           billing_status, monthly_amount_cents, last_payment_at
    FROM tenants ORDER BY created_at DESC
  `);

  if (!isStripeConfigured()) {
    return NextResponse.json({
      success: true,
      configured: false,
      metrics: { revenueToday: 0, revenueMonth: 0, mrr: 0, activeSubscriptions: 0, overdue: 0, churnRate: 0 },
      series: [],
      customers: tenants,
      message: "Configure STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET para ativar dados reais.",
    });
  }

  try {
    const stripe = getStripe();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const chartStart = new Date(todayStart);
    chartStart.setDate(chartStart.getDate() - 6);

    const [subscriptions, invoices] = await Promise.all([
      stripe.subscriptions.list({ status: "all", limit: 100, expand: ["data.customer"] }),
      stripe.invoices.list({ status: "paid", created: { gte: Math.floor(monthStart.getTime() / 1000) }, limit: 100, expand: ["data.customer"] }),
    ]);

    const activeStatuses = new Set(["active", "trialing"]);
    const active = subscriptions.data.filter((subscription) => activeStatuses.has(subscription.status));
    const overdue = subscriptions.data.filter((subscription) => ["past_due", "unpaid", "incomplete"].includes(subscription.status));
    const canceledThisMonth = subscriptions.data.filter((subscription) =>
      subscription.canceled_at && subscription.canceled_at >= Math.floor(monthStart.getTime() / 1000)
    );
    const mrr = active.reduce((total, subscription) => total + subscription.items.data.reduce(
      (sum, item) => sum + (item.price.unit_amount || 0) * (item.quantity || 1), 0
    ), 0);

    const paidInvoices = invoices.data.filter((invoice) => (invoice.amount_paid || 0) > 0);
    const revenueMonth = paidInvoices.reduce((sum, invoice) => sum + (invoice.amount_paid || 0), 0);
    const revenueToday = paidInvoices
      .filter((invoice) => new Date(invoice.created * 1000) >= todayStart)
      .reduce((sum, invoice) => sum + (invoice.amount_paid || 0), 0);

    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(chartStart);
      date.setDate(date.getDate() + index);
      return { date: formatDay(date), amount: 0, sales: 0 };
    });
    for (const invoice of paidInvoices) {
      const key = formatDay(new Date(invoice.created * 1000));
      const day = days.find((item) => item.date === key);
      if (day) { day.amount += invoice.amount_paid || 0; day.sales += 1; }
    }

    const tenantByCustomer = new Map(tenants.filter((tenant) => tenant.stripe_customer_id).map((tenant) => [tenant.stripe_customer_id, tenant]));
    const ranking = paidInvoices.reduce<Record<string, { id: string; name: string; amount: number; sales: number }>>((acc, invoice) => {
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id || "sem-cliente";
      const tenant = tenantByCustomer.get(customerId);
      const customer = typeof invoice.customer === "object" && invoice.customer && !invoice.customer.deleted ? invoice.customer as Stripe.Customer : null;
      const key = tenant?.id || customerId;
      acc[key] ||= { id: key, name: tenant?.name || customer?.name || customer?.email || "Cliente Stripe", amount: 0, sales: 0 };
      acc[key].amount += invoice.amount_paid || 0;
      acc[key].sales += 1;
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      configured: true,
      livemode: subscriptions.data[0]?.livemode ?? false,
      metrics: {
        revenueToday,
        revenueMonth,
        mrr,
        activeSubscriptions: active.length,
        overdue: overdue.length,
        churnRate: subscriptions.data.length ? (canceledThisMonth.length / subscriptions.data.length) * 100 : 0,
      },
      series: days,
      ranking: Object.values(ranking).sort((a, b) => b.amount - a.amount).slice(0, 5),
      customers: tenants,
    });
  } catch (error) {
    console.error("[STRIPE BILLING]", error);
    return NextResponse.json({ success: false, configured: true, error: publicError(error, "Falha ao consultar a Stripe.") }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await verifyRequestAuth(req))) {
    return NextResponse.json({ success: false, error: "Acesso não autorizado." }, { status: 401 });
  }
  if (!isStripeConfigured()) {
    return NextResponse.json({ success: false, error: "Stripe ainda não configurada." }, { status: 503 });
  }

  try {
    await ensureTablesOnce();
    const body = await req.json();
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const action = body.action;
    const tenants = await query<any>(
      `SELECT id, name, email, plan, stripe_customer_id, stripe_subscription_id,
              billing_checkout_url, billing_checkout_expires_at, pending_plan
       FROM tenants WHERE id = $1 LIMIT 1`, [tenantId]
    );
    const tenant = tenants[0];
    if (!tenant) return NextResponse.json({ success: false, error: "Oficina não encontrada." }, { status: 404 });

    const stripe = getStripe();
    const returnUrl = `${req.nextUrl.origin}/`;
    let stripeCustomerId = tenant.stripe_customer_id as string | null;

    if (action === "send_checkout_notification") {
      const checkoutValid = tenant.billing_checkout_url && tenant.billing_checkout_expires_at && new Date(tenant.billing_checkout_expires_at) > new Date();
      if (!checkoutValid) {
        return NextResponse.json({ success: false, error: "Gere um checkout válido antes de enviar a notificação." }, { status: 409 });
      }
      const selectedPlan = normalizePlan(tenant.pending_plan || tenant.plan) || "PROFISSIONAL";
      const plan = PLAN_CATALOG[selectedPlan];
      const timestamp = new Date().toISOString();
      const message = {
        id: `billing-${crypto.randomUUID()}`,
        tenantId: tenant.id,
        sender: "MASTER",
        senderName: "Financeiro GIRAVO",
        text: `Sua assinatura do plano ${plan.name} está pronta. Conclua o pagamento para manter todos os recursos ativos.`,
        timestamp,
        read: false,
        type: "BILLING_CHECKOUT",
        actionUrl: tenant.billing_checkout_url,
        actionLabel: "Assinar plano",
        billingPlan: selectedPlan,
        amountCents: plan.priceCents,
        expiresAt: tenant.billing_checkout_expires_at,
      };
      const notified = await query(
        `UPDATE tenant_store SET chat_data = jsonb_set(
           jsonb_set(COALESCE(chat_data, '{"messages":[],"status":"OPEN"}'::jsonb), '{messages}',
             COALESCE(chat_data->'messages', '[]'::jsonb) || $2::jsonb, true),
           '{status}', '"OPEN"'::jsonb, true
         ) || jsonb_build_object('lastMessageAt', $3::text), updated_at = NOW()
         WHERE tenant_id = $1 RETURNING tenant_id`,
        [tenant.id, JSON.stringify([message]), timestamp]
      );
      if (!notified.length) return NextResponse.json({ success: false, error: "Canal da oficina não encontrado." }, { status: 404 });
      return NextResponse.json({ success: true, message });
    }

    if (action === "portal") {
      if (!stripeCustomerId) return NextResponse.json({ success: false, error: "Esta oficina ainda não possui cliente Stripe." }, { status: 409 });
      const portal = await stripe.billingPortal.sessions.create({ customer: stripeCustomerId, return_url: returnUrl });
      return NextResponse.json({ success: true, url: portal.url });
    }

    if (action !== "checkout" && action !== "change_plan") {
      return NextResponse.json({ success: false, error: "Ação de cobrança inválida." }, { status: 400 });
    }
    const selectedPlan = normalizePlan(body.plan);
    if (!selectedPlan) return NextResponse.json({ success: false, error: "Selecione um plano válido." }, { status: 400 });
    const priceId = stripePriceForPlan(selectedPlan);
    if (!priceId) return NextResponse.json({ success: false, error: `Configure o Price ID da Stripe para o plano ${PLAN_CATALOG[selectedPlan].name}.` }, { status: 503 });

    if (action === "change_plan") {
      if (!tenant.stripe_subscription_id) {
        return NextResponse.json({ success: false, error: "A oficina ainda não possui assinatura para alterar." }, { status: 409 });
      }
      const subscription = await stripe.subscriptions.retrieve(tenant.stripe_subscription_id);
      const item = subscription.items.data[0];
      if (!item) return NextResponse.json({ success: false, error: "A assinatura não possui item de plano." }, { status: 409 });
      await stripe.subscriptions.update(subscription.id, {
        items: [{ id: item.id, price: priceId }],
        proration_behavior: "always_invoice",
        metadata: { ...subscription.metadata, tenant_id: tenant.id, giravo_plan: selectedPlan },
      });
      await query(
        `UPDATE tenants SET pending_plan = $1, billing_status = 'PLAN_CHANGE_PENDING', updated_at = NOW() WHERE id = $2`,
        [selectedPlan, tenant.id]
      );
      return NextResponse.json({ success: true, changed: true, plan: selectedPlan });
    }

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: tenant.name,
        email: tenant.email,
        metadata: { tenant_id: tenant.id },
      }, { idempotencyKey: `giravo-customer-${tenant.id}` });
      stripeCustomerId = customer.id;
      await query(`UPDATE tenants SET stripe_customer_id = $1, updated_at = NOW() WHERE id = $2`, [stripeCustomerId, tenant.id]);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${returnUrl}?billing=success`,
      cancel_url: `${returnUrl}?billing=cancelled`,
      client_reference_id: tenant.id,
      subscription_data: { metadata: { tenant_id: tenant.id, giravo_plan: selectedPlan } },
      metadata: { tenant_id: tenant.id, giravo_plan: selectedPlan },
    });
    await query(
      `UPDATE tenants SET billing_checkout_url = $1, billing_checkout_expires_at = $2,
        billing_status = 'CHECKOUT_PENDING', pending_plan = $3, updated_at = NOW() WHERE id = $4`,
      [session.url, new Date(session.expires_at * 1000).toISOString(), selectedPlan, tenant.id]
    );
    return NextResponse.json({
      success: true,
      url: session.url,
      checkoutSessionId: session.id,
      expiresAt: new Date(session.expires_at * 1000).toISOString(),
      plan: selectedPlan,
    });
  } catch (error) {
    console.error("[STRIPE ACTION]", error);
    return NextResponse.json({ success: false, error: publicError(error, "Falha ao iniciar a cobrança na Stripe.") }, { status: 502 });
  }
}
