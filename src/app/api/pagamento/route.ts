import { NextRequest, NextResponse } from "next/server";
import { ensureTablesOnce, query } from "@/lib/db";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { normalizePlan, PLAN_CATALOG, stripePriceForPlan, PlanKey } from "@/lib/plans";
import { publicError } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getPublishableKey(): string {
  return (
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
    process.env.STRIPE_PUBLISHABLE_KEY ||
    ""
  ).trim();
}

function stripeKeysUseSameMode(secretKey: string, publishableKey: string): boolean {
  const secretMode = secretKey.startsWith("sk_live_") ? "live" : secretKey.startsWith("sk_test_") ? "test" : "";
  const publicMode = publishableKey.startsWith("pk_live_") ? "live" : publishableKey.startsWith("pk_test_") ? "test" : "";
  return Boolean(secretMode && publicMode && secretMode === publicMode);
}

export async function GET(req: NextRequest) {
  try {
    await ensureTablesOnce();
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("id") || searchParams.get("tenantId") || "";

    if (!tenantId) {
      return NextResponse.json({ success: false, error: "Identificador da oficina é obrigatório." }, { status: 400 });
    }

    const rows = await query<any>(
      `SELECT id, name, owner_name, email, phone, plan, status, expires_at,
              stripe_customer_id, stripe_subscription_id, billing_status, billing_cycle,
              billing_checkout_url, billing_checkout_expires_at, pending_plan, last_payment_at
       FROM tenants WHERE id = $1 LIMIT 1`,
      [tenantId]
    );

    const tenant = rows[0];
    if (!tenant) {
      return NextResponse.json({ success: false, error: "Oficina não encontrada no sistema." }, { status: 404 });
    }

    const selectedPlanKey = normalizePlan(tenant.pending_plan || tenant.plan) || "PROFISSIONAL";
    const planInfo = PLAN_CATALOG[selectedPlanKey];

    const isPaid = ["PAID", "ACTIVE"].includes(tenant.billing_status || "") && tenant.status !== "EXPIRED" && tenant.status !== "BLOCKED";

    const publishableKey = getPublishableKey();
    const secretKey = (process.env.STRIPE_SECRET_KEY || "").trim();
    let checkoutError: string | null = null;
    let checkoutUrl = tenant.billing_checkout_url as string | null;
    let clientSecret: string | null = null;
    const isCheckoutValid = checkoutUrl && tenant.billing_checkout_expires_at && new Date(tenant.billing_checkout_expires_at) > new Date();

    // Se a sessão salva for um client_secret embedded
    if (checkoutUrl && checkoutUrl.startsWith("cs_")) {
      clientSecret = checkoutUrl;
    }

    // Se o checkout estiver expirado ou ausente e a Stripe estiver configurada, recria a sessão automaticamente
    if (!isPaid && (!isCheckoutValid || !clientSecret) && isStripeConfigured()) {
      try {
        const stripe = getStripe();
        const priceId = stripePriceForPlan(selectedPlanKey);

        if (priceId) {
          let customerId = tenant.stripe_customer_id;
          if (!customerId) {
            const customer = await stripe.customers.create({
              name: tenant.name,
              email: tenant.email,
              metadata: { tenant_id: tenant.id },
            }, { idempotencyKey: `giravo-pay-cust-${tenant.id}` });
            customerId = customer.id;
            await query(`UPDATE tenants SET stripe_customer_id = $1, updated_at = NOW() WHERE id = $2`, [customerId, tenant.id]);
          }

          const returnUrl = `${req.nextUrl.origin}/pagamento/${tenant.id}`;

          // Se a chave publicável estiver configurada, gera sessão embutida (embedded_page)
          if (publishableKey && stripeKeysUseSameMode(secretKey, publishableKey)) {
            const session = await stripe.checkout.sessions.create({
              ui_mode: "embedded_page",
              mode: "subscription",
              allowed_payment_method_types: ["card"],
              customer: customerId,
              line_items: [{ price: priceId, quantity: 1 }],
              return_url: `${returnUrl}?sucesso=1&session_id={CHECKOUT_SESSION_ID}`,
              client_reference_id: tenant.id,
              subscription_data: { metadata: { tenant_id: tenant.id, giravo_plan: selectedPlanKey } },
              metadata: { tenant_id: tenant.id, giravo_plan: selectedPlanKey },
            });

            clientSecret = session.client_secret || null;
            checkoutUrl = session.client_secret || null;

            await query(
              `UPDATE tenants SET billing_checkout_url = $1, billing_checkout_expires_at = $2,
               billing_status = 'CHECKOUT_PENDING', pending_plan = $3, updated_at = NOW() WHERE id = $4`,
              [clientSecret, new Date(session.expires_at * 1000).toISOString(), selectedPlanKey, tenant.id]
            );
          } else {
            // Modo hosted fallback se ainda não tiver publishable key
            const session = await stripe.checkout.sessions.create({
              mode: "subscription",
              allowed_payment_method_types: ["card"],
              customer: customerId,
              line_items: [{ price: priceId, quantity: 1 }],
              success_url: `${returnUrl}?sucesso=1`,
              cancel_url: `${returnUrl}?cancelado=1`,
              client_reference_id: tenant.id,
              subscription_data: { metadata: { tenant_id: tenant.id, giravo_plan: selectedPlanKey } },
              metadata: { tenant_id: tenant.id, giravo_plan: selectedPlanKey },
            });

            checkoutUrl = session.url;
            await query(
              `UPDATE tenants SET billing_checkout_url = $1, billing_checkout_expires_at = $2,
               billing_status = 'CHECKOUT_PENDING', pending_plan = $3, updated_at = NOW() WHERE id = $4`,
              [session.url, new Date(session.expires_at * 1000).toISOString(), selectedPlanKey, tenant.id]
            );
          }
        }
      } catch (err) {
        console.error("[PAGAMENTO AUTO-CHECKOUT]", err);
        checkoutError = publicError(err, "Não foi possível iniciar o checkout seguro.");
      }
    }

    if (!publishableKey) {
      checkoutError = "Checkout incorporado indisponível: configure STRIPE_PUBLISHABLE_KEY no servidor.";
    } else if (!stripeKeysUseSameMode(secretKey, publishableKey)) {
      checkoutError = "As chaves publicável e secreta da Stripe precisam pertencer ao mesmo modo (teste ou produção).";
    }

    const priceFormatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(planInfo.priceCents / 100);

    return NextResponse.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        ownerName: tenant.owner_name,
        email: tenant.email,
        phone: tenant.phone,
        status: tenant.status,
        billingStatus: tenant.billing_status,
        expiresAt: tenant.expires_at,
        lastPaymentAt: tenant.last_payment_at,
      },
      plan: {
        key: planInfo.key,
        name: planInfo.name,
        priceCents: planInfo.priceCents,
        priceFormatted,
        description: planInfo.description,
        maxUsers: planInfo.maxUsers,
        features: planInfo.features,
      },
      catalog: Object.values(PLAN_CATALOG).map((p) => ({
        key: p.key,
        name: p.name,
        priceCents: p.priceCents,
        priceFormatted: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(p.priceCents / 100),
        description: p.description,
        maxUsers: p.maxUsers,
        features: p.features,
      })),
      checkoutUrl,
      clientSecret,
      publishableKey,
      isEmbedded: Boolean(publishableKey && clientSecret),
      checkoutError,
      pix: {
        key: process.env.PIX_KEY || "financeiro@giravo.com.br",
        keyType: process.env.PIX_KEY_TYPE || "E-mail",
        beneficiary: process.env.PIX_BENEFICIARY || "GIRAVO Soluções Automotivas",
        city: process.env.PIX_CITY || "SÃO PAULO",
      },
      isPaid,
      isTrial: tenant.status === "TRIAL",
      billingCycle: tenant.billing_cycle === "annual" ? "annual" : "monthly",
    });
  } catch (error) {
    console.error("[API PAGAMENTO GET]", error);
    return NextResponse.json({ success: false, error: publicError(error, "Falha ao carregar fatura.") }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTablesOnce();
    const body = await req.json();

    // Ação: Salvar chave publicável da Stripe
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const requestedPlan = normalizePlan(body.plan);
    const billingCycle = body.billingCycle === "annual" ? "annual" : "monthly";

    if (!tenantId) {
      return NextResponse.json({ success: false, error: "tenantId é obrigatório." }, { status: 400 });
    }
    if (!requestedPlan) {
      return NextResponse.json({ success: false, error: "Plano inválido." }, { status: 400 });
    }

    if (!isStripeConfigured()) {
      return NextResponse.json({ success: false, error: "Pagamento online temporariamente indisponível." }, { status: 503 });
    }

    const rows = await query<any>(
      `SELECT id, name, email, phone, stripe_customer_id FROM tenants WHERE id = $1 LIMIT 1`,
      [tenantId]
    );
    const tenant = rows[0];
    if (!tenant) {
      return NextResponse.json({ success: false, error: "Oficina não encontrada." }, { status: 404 });
    }

    const priceId = stripePriceForPlan(requestedPlan);
    if (!priceId) {
      return NextResponse.json({ success: false, error: "Preço do plano não configurado na Stripe." }, { status: 500 });
    }

    const stripe = getStripe();
    let customerId = tenant.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: tenant.name,
        email: tenant.email,
        metadata: { tenant_id: tenant.id },
      }, { idempotencyKey: `giravo-post-cust-${tenant.id}` });
      customerId = customer.id;
      await query(`UPDATE tenants SET stripe_customer_id = $1, updated_at = NOW() WHERE id = $2`, [customerId, tenant.id]);
    }

    const returnUrl = `${req.nextUrl.origin}/pagamento/${tenant.id}`;
    const publishableKey = getPublishableKey();

    let clientSecret: string | null = null;
    let checkoutUrl: string | null = null;
    let expiresAt: string = "";
    const planInfo = PLAN_CATALOG[requestedPlan];
    const annualAmountCents = Math.round(planInfo.priceCents * 12 * 0.9);
    const lineItems = billingCycle === "annual"
      ? [{ price_data: { currency: "brl", unit_amount: annualAmountCents, product_data: { name: `GIRAVO ${planInfo.name} - Plano anual`, description: "12 meses de acesso com 10% de desconto" } }, quantity: 1 }]
      : [{ price: priceId, quantity: 1 }];
    const sessionMode = billingCycle === "annual" ? "payment" as const : "subscription" as const;
    const metadata = { tenant_id: tenant.id, giravo_plan: requestedPlan, billing_cycle: billingCycle };

    const secretKey = (process.env.STRIPE_SECRET_KEY || "").trim();
    if (publishableKey && !stripeKeysUseSameMode(secretKey, publishableKey)) {
      return NextResponse.json({ success: false, error: "As chaves publicável e secreta da Stripe precisam pertencer ao mesmo modo (teste ou produção)." }, { status: 503 });
    }

    if (publishableKey) {
      const session = await stripe.checkout.sessions.create({
        ui_mode: "embedded_page",
        mode: sessionMode,
        customer: customerId,
        line_items: lineItems,
        allowed_payment_method_types: billingCycle === "annual" ? ["card", "pix"] : ["card"],
        return_url: `${returnUrl}?sucesso=1&session_id={CHECKOUT_SESSION_ID}`,
        client_reference_id: tenant.id,
        ...(billingCycle === "monthly" ? { subscription_data: { metadata } } : {}),
        metadata,
      });

      clientSecret = session.client_secret || null;
      checkoutUrl = session.client_secret || null;
      expiresAt = new Date(session.expires_at * 1000).toISOString();

      await query(
        `UPDATE tenants SET billing_checkout_url = $1, billing_checkout_expires_at = $2,
         billing_status = 'CHECKOUT_PENDING', pending_plan = $3, billing_cycle = $5, updated_at = NOW() WHERE id = $4`,
        [clientSecret, expiresAt, requestedPlan, tenant.id, billingCycle]
      );
    } else {
      const session = await stripe.checkout.sessions.create({
        mode: sessionMode,
        customer: customerId,
        line_items: lineItems,
        allowed_payment_method_types: billingCycle === "annual" ? ["card", "pix"] : ["card"],
        success_url: `${returnUrl}?sucesso=1`,
        cancel_url: `${returnUrl}?cancelado=1`,
        client_reference_id: tenant.id,
        ...(billingCycle === "monthly" ? { subscription_data: { metadata } } : {}),
        metadata,
      });

      checkoutUrl = session.url;
      expiresAt = new Date(session.expires_at * 1000).toISOString();

      await query(
        `UPDATE tenants SET billing_checkout_url = $1, billing_checkout_expires_at = $2,
         billing_status = 'CHECKOUT_PENDING', pending_plan = $3, billing_cycle = $5, updated_at = NOW() WHERE id = $4`,
        [session.url, expiresAt, requestedPlan, tenant.id, billingCycle]
      );
    }

    return NextResponse.json({
      success: true,
      checkoutUrl,
      clientSecret,
      publishableKey,
      plan: requestedPlan,
      billingCycle,
      amountCents: billingCycle === "annual" ? annualAmountCents : planInfo.priceCents,
      expiresAt,
    });
  } catch (error) {
    console.error("[API PAGAMENTO POST]", error);
    return NextResponse.json({ success: false, error: publicError(error, "Falha ao gerar checkout.") }, { status: 500 });
  }
}
