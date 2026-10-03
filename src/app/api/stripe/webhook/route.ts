import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { ensureTablesOnce, withTransaction } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { normalizePlan, PLAN_CATALOG } from "@/lib/plans";

export const dynamic = "force-dynamic";

function customerId(value: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  return typeof value === "string" ? value : value?.id || null;
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return NextResponse.json({ received: false }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await req.text(), signature, webhookSecret);
  } catch {
    return NextResponse.json({ received: false, error: "Assinatura inválida." }, { status: 400 });
  }

  await ensureTablesOnce();
  await withTransaction(async (client) => {
    const claimed = await client.query(
      `INSERT INTO stripe_webhook_events (id, event_type) VALUES ($1, $2)
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [event.id, event.type]
    );
    if (!claimed.rowCount) return;

    if (event.type.startsWith("customer.subscription.")) {
      const subscription = event.data.object as Stripe.Subscription;
      const stripeCustomerId = customerId(subscription.customer);
      const tenantId = subscription.metadata?.tenant_id || null;
      const monthlyAmount = subscription.items.data.reduce(
        (sum, item) => sum + (item.price.unit_amount || 0) * (item.quantity || 1), 0
      );
      await client.query(
        `UPDATE tenants SET stripe_customer_id = COALESCE($1, stripe_customer_id),
          stripe_subscription_id = $2, billing_status = $3, monthly_amount_cents = $4, updated_at = NOW()
         WHERE ($5::text IS NOT NULL AND id = $5) OR ($1::text IS NOT NULL AND stripe_customer_id = $1)`,
        [stripeCustomerId, subscription.id, subscription.status.toUpperCase(), monthlyAmount, tenantId]
      );
      if (event.type === "customer.subscription.deleted") {
        await client.query(
          `UPDATE tenants SET status = CASE WHEN status <> 'BLOCKED' THEN 'BLOCKED' ELSE status END,
             billing_block_reason = CASE WHEN status <> 'BLOCKED' THEN 'PAYMENT_OVERDUE' ELSE billing_block_reason END,
             billing_status = 'CANCELED', updated_at = NOW()
           WHERE stripe_subscription_id = $1`,
          [subscription.id]
        );
      }
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenant_id || session.client_reference_id;
      const stripeCustomerId = customerId(session.customer as string | Stripe.Customer | Stripe.DeletedCustomer | null);
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id || null;
      const selectedPlan = normalizePlan(session.metadata?.giravo_plan);
      if (tenantId) {
        await client.query(
          `UPDATE tenants SET stripe_customer_id = COALESCE($1, stripe_customer_id),
             stripe_subscription_id = COALESCE($2, stripe_subscription_id),
             billing_status = 'CHECKOUT_COMPLETED', pending_plan = COALESCE($4, pending_plan), billing_checkout_url = NULL,
             billing_checkout_expires_at = NULL, billing_failure_reason = NULL,
             billing_attempt_count = 0, updated_at = NOW() WHERE id = $3`,
          [stripeCustomerId, subscriptionId, tenantId, selectedPlan]
        );
      }
    }

    if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenant_id || session.client_reference_id;
      if (tenantId) {
        const reason = event.type === "checkout.session.expired"
          ? "O cliente não concluiu o checkout dentro do prazo de validade."
          : "O meio de pagamento assíncrono foi recusado pela Stripe.";
        await client.query(
          `UPDATE tenants SET billing_status = $1, billing_failure_reason = $2,
             billing_checkout_url = NULL, billing_checkout_expires_at = NULL, updated_at = NOW()
           WHERE id = $3`,
          [event.type === "checkout.session.expired" ? "CHECKOUT_EXPIRED" : "PAYMENT_FAILED", reason, tenantId]
        );
      }
    }

    if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const stripeCustomerId = customerId(invoice.customer);
      const status = event.type === "invoice.paid" ? "PAID" : "FAILED";
      const invoiceTenantId = invoice.parent?.subscription_details?.metadata?.tenant_id || null;
      const tenant = await client.query<{ id: string; pending_plan: string | null }>(
        `SELECT id, pending_plan FROM tenants
         WHERE ($1::text IS NOT NULL AND stripe_customer_id = $1)
            OR ($2::text IS NOT NULL AND id = $2) LIMIT 1`,
        [stripeCustomerId, invoiceTenantId]
      );
      await client.query(
        `INSERT INTO stripe_payments
          (id, tenant_id, stripe_customer_id, stripe_invoice_id, amount_cents, currency, status, paid_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, paid_at = EXCLUDED.paid_at`,
        [invoice.id, tenant.rows[0]?.id || null, stripeCustomerId, invoice.id, invoice.amount_paid || invoice.amount_due || 0,
          invoice.currency, status, status === "PAID" ? new Date((invoice.status_transitions.paid_at || invoice.created) * 1000) : null]
      );
      if (tenant.rows[0]) {
        if (status === "PAID") {
          const selectedPlan = normalizePlan(tenant.rows[0].pending_plan);
          const planDefinition = selectedPlan ? PLAN_CATALOG[selectedPlan] : null;
          await client.query(
            `UPDATE tenants SET billing_status = 'PAID', last_payment_at = NOW(),
               stripe_last_invoice_id = $1, billing_grace_until = NULL,
               billing_failure_reason = NULL, billing_attempt_count = 0,
               billing_checkout_url = NULL, billing_checkout_expires_at = NULL,
               status = CASE WHEN billing_block_reason = 'PAYMENT_OVERDUE' THEN 'ACTIVE' ELSE status END,
               billing_block_reason = CASE WHEN billing_block_reason = 'PAYMENT_OVERDUE' THEN NULL ELSE billing_block_reason END,
               plan = COALESCE($3, plan), max_users = COALESCE($4, max_users),
               enabled_features = COALESCE($5::jsonb, enabled_features), pending_plan = NULL,
               updated_at = NOW() WHERE id = $2`,
            [invoice.id, tenant.rows[0].id, selectedPlan, planDefinition?.maxUsers || null,
              planDefinition ? JSON.stringify(planDefinition.features) : null]
          );
          if (planDefinition) {
            // Em downgrade, preserva os acessos mais antigos (priorizando ADMIN)
            // e desativa automaticamente o excedente ao novo limite.
            await client.query(
              `WITH ranked AS (
                 SELECT id, ROW_NUMBER() OVER (
                   ORDER BY CASE WHEN role = 'ADMIN' THEN 0 ELSE 1 END, created_at ASC, id ASC
                 ) AS position
                 FROM users WHERE tenant_id = $1 AND is_active = TRUE
               )
               UPDATE users SET is_active = FALSE
               WHERE id IN (SELECT id FROM ranked WHERE position > $2)`,
              [tenant.rows[0].id, planDefinition.maxUsers]
            );
          }
        } else {
          const graceDays = Math.min(Math.max(Number(process.env.BILLING_GRACE_DAYS || 3), 0), 30);
          const mustBlock = (invoice.attempt_count || 0) >= 2 || graceDays === 0;
          await client.query(
            `UPDATE tenants SET billing_status = 'PAST_DUE', stripe_last_invoice_id = $1,
               billing_failure_reason = $5, billing_attempt_count = $6,
               billing_grace_until = COALESCE(billing_grace_until, NOW() + ($2 * INTERVAL '1 day')),
               status = CASE WHEN $3 AND status <> 'BLOCKED' THEN 'BLOCKED' ELSE status END,
               billing_block_reason = CASE WHEN $3 AND status <> 'BLOCKED' THEN 'PAYMENT_OVERDUE' ELSE billing_block_reason END,
               updated_at = NOW() WHERE id = $4`,
            [invoice.id, graceDays, mustBlock, tenant.rows[0].id,
              invoice.last_finalization_error?.message || "A Stripe não conseguiu confirmar o pagamento da mensalidade.",
              invoice.attempt_count || 1]
          );
        }
      }
    }
  });

  return NextResponse.json({ received: true });
}
