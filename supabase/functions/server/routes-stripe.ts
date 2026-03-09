/**
 * Stripe Routes — Checkout Sessions + Webhook Handler
 *
 * Handles:
 *   POST /stripe/create-checkout   — Create a Checkout Session (tickets, TCF+, donations)
 *   POST /stripe/webhook           — Stripe webhook event handler
 *   POST /stripe/customer-portal   — Generate Stripe Customer Portal link (TCF+ management)
 *   GET  /stripe/subscription-status — Check TCF+ subscription state from Stripe
 *
 * Stripe is authoritative for money movement.
 * Supabase is authoritative for meaning.
 */

import { PREFIX, requireAuth } from './helpers.ts';
import { createNotification, createUserActivity, createAdminLog } from './routes-notifications.ts';
import Stripe from 'npm:stripe@17';

// ══════════════════════════════════════════════════════
// STRIPE CONFIG — Price IDs from Stripe Dashboard
// ══════════════════════════════════════════════════════

const STRIPE_PRICES = {
  TICKET: 'price_1T6KKJJITiGcAD00cyJxOaF2',
  TCF_PLUS: 'price_1T2IMSJITiGcAD00nkyszAhB',
  DONATION: 'price_1T6KkVJITiGcAD00272g670Q',
} as const;

// Order types for the orders table
type OrderType = 'ticket' | 'tcf_plus' | 'donation' | 'merch';

// ══════════════════════════════════════════════════════
// BULK TICKET DISCOUNT CONFIG
// ══════════════════════════════════════════════════════

const BULK_DISCOUNTS = [
  { minQty: 10, amountOffCents: 200, couponId: 'tcf_bulk_10', name: 'Bulk 10 Tickets — $2 off' },
  { minQty: 5,  amountOffCents: 100, couponId: 'tcf_bulk_5',  name: 'Bulk 5+ Tickets — $1 off' },
] as const; // ordered high-to-low so first match wins

/**
 * Get or create a Stripe coupon for bulk ticket discounts.
 * Idempotent — safe to call on every checkout.
 */
async function ensureBulkCoupon(stripe: Stripe, couponId: string, amountOffCents: number, name: string): Promise<string> {
  try {
    await stripe.coupons.retrieve(couponId);
  } catch {
    await stripe.coupons.create({
      id: couponId,
      amount_off: amountOffCents,
      currency: 'usd',
      name,
      duration: 'once',
    });
    console.log(`Created Stripe coupon: ${couponId} ($${(amountOffCents / 100).toFixed(2)} off)`);
  }
  return couponId;
}

// ══════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════

function getStripe(): Stripe {
  const key = Deno.env.get('STRIPE_LIVE_SECRET_KEY');
  if (!key) throw new Error('STRIPE_LIVE_SECRET_KEY is not configured');
  return new Stripe(key, { apiVersion: '2024-12-18.acacia' });
}

/**
 * Ensure a Stripe Customer exists for a user. Creates one if needed and
 * persists the customer ID back to the users table.
 */
async function ensureStripeCustomer(
  stripe: Stripe,
  supabase: any,
  dbUser: any,
): Promise<string> {
  // Already have a customer ID
  if (dbUser.stripe_customer_id) return dbUser.stripe_customer_id;

  // Create a new Stripe Customer
  const customer = await stripe.customers.create({
    metadata: { tcf_user_id: dbUser.id },
    ...(dbUser.email ? { email: dbUser.email } : {}),
    ...(dbUser.discord_username ? { name: dbUser.discord_username } : {}),
  });

  // Persist to DB
  const { error } = await supabase
    .from('users')
    .update({ stripe_customer_id: customer.id })
    .eq('id', dbUser.id);

  if (error) {
    console.error(`Failed to persist stripe_customer_id for user ${dbUser.id}:`, error);
  }

  return customer.id;
}

// ══════════════════════════════════════════════════════
// ROUTE REGISTRATION
// ══════════════════════════════════════════════════════

export function registerStripeRoutes(app: any, supabase: any, anonSupabase: any) {

  // ────────────────────────────────────────────────────
  // POST /stripe/create-checkout
  // Creates a Stripe Checkout Session for the given product type
  //
  // Body: { type: 'ticket' | 'tcf_plus' | 'donation',
  //         quantity?: number, amount?: number, tournament_id?: string }
  // ────────────────────────────────────────────────────
  app.post(`${PREFIX}/stripe/create-checkout`, async (c: any) => {
    try {
      // Auth required
      const auth = await requireAuth(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;
      const { dbUser } = auth;

      const body = await c.req.json();
      const { type, quantity, amount, tournament_id, merch_variant_id, merch_product_name, merch_variant_name, merch_price_cents, merch_image_url } = body as {
        type: OrderType;
        quantity?: number;
        amount?: number; // in cents, for donations
        tournament_id?: string;
        merch_variant_id?: number;
        merch_product_name?: string;
        merch_variant_name?: string;
        merch_price_cents?: number;
        merch_image_url?: string;
      };

      if (!type) return c.json({ error: 'Missing required field: type' }, 400);

      const stripe = getStripe();
      const customerId = await ensureStripeCustomer(stripe, supabase, dbUser);

      // Build the Checkout Session config based on type
      const metadata: Record<string, string> = {
        tcf_user_id: dbUser.id,
        order_type: type,
      };

      let sessionParams: Stripe.Checkout.SessionCreateParams;

      switch (type) {
        case 'ticket': {
          const qty = Math.max(1, Math.min(quantity || 1, 10)); // 1-10 tickets
          metadata.quantity = String(qty);

          // Apply bulk discount coupon if applicable
          const discount = BULK_DISCOUNTS.find(d => qty >= d.minQty);
          let couponId: string | undefined;
          if (discount) {
            couponId = await ensureBulkCoupon(stripe, discount.couponId, discount.amountOffCents, discount.name);
            metadata.bulk_discount_cents = String(discount.amountOffCents);
          }

          sessionParams = {
            mode: 'payment',
            customer: customerId,
            // allow_promotion_codes and discounts are mutually exclusive in Stripe
            ...(couponId
              ? { discounts: [{ coupon: couponId }] }
              : { allow_promotion_codes: true }),
            line_items: [{ price: STRIPE_PRICES.TICKET, quantity: qty }],
            metadata,
            success_url: `${c.req.header('Origin') || 'https://thecornfield.gg'}/?checkout=success&type=ticket&qty=${qty}`,
            cancel_url: `${c.req.header('Origin') || 'https://thecornfield.gg'}/?checkout=cancelled`,
          };
          break;
        }

        case 'tcf_plus': {
          // Check if already subscribed
          if (dbUser.tcf_plus_active) {
            return c.json({ error: 'You already have an active TCF+ subscription' }, 400);
          }
          sessionParams = {
            mode: 'subscription',
            customer: customerId,
            allow_promotion_codes: true,
            line_items: [{ price: STRIPE_PRICES.TCF_PLUS, quantity: 1 }],
            metadata,
            success_url: `${c.req.header('Origin') || 'https://thecornfield.gg'}/?checkout=success&type=tcf_plus`,
            cancel_url: `${c.req.header('Origin') || 'https://thecornfield.gg'}/?checkout=cancelled`,
          };
          break;
        }

        case 'donation': {
          // Prize Pool Donation — 95/5 split (95% prize pool, 5% platform fee)
          // Uses custom amount via price_data
          const donationAmountCents = amount && amount >= 100 ? amount : 500; // minimum $1, default $5
          if (tournament_id) metadata.tournament_id = tournament_id;

          sessionParams = {
            mode: 'payment',
            customer: customerId,
            line_items: [{
              price_data: {
                currency: 'usd',
                product_data: {
                  name: 'Prize Pool Donation',
                },
                unit_amount: donationAmountCents,
              },
              quantity: 1,
            }],
            metadata,
            success_url: `${c.req.header('Origin') || 'https://thecornfield.gg'}/?checkout=success&type=donation`,
            cancel_url: `${c.req.header('Origin') || 'https://thecornfield.gg'}/?checkout=cancelled`,
          };
          break;
        }

        case 'merch': {
          // Merch purchase — Printful product via dynamic price_data
          if (!merch_variant_id || !merch_product_name || !merch_price_cents) {
            return c.json({ error: 'Missing merch fields: merch_variant_id, merch_product_name, merch_price_cents required' }, 400);
          }

          const merchQty = Math.max(1, Math.min(quantity || 1, 10));
          metadata.merch_variant_id = String(merch_variant_id);
          metadata.merch_product_name = merch_product_name;
          metadata.merch_variant_name = merch_variant_name || '';
          metadata.quantity = String(merchQty);

          const productData: any = {
            name: merch_product_name + (merch_variant_name ? ` — ${merch_variant_name}` : ''),
          };
          if (merch_image_url) {
            productData.images = [merch_image_url];
          }

          sessionParams = {
            mode: 'payment',
            customer: customerId,
            shipping_address_collection: {
              allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'NL', 'SE', 'NO', 'DK', 'FI', 'IE', 'NZ', 'AT', 'BE', 'CH', 'ES', 'IT', 'PT', 'PL', 'CZ', 'MX', 'BR', 'JP', 'KR', 'SG'],
            },
            line_items: [{
              price_data: {
                currency: 'usd',
                product_data: productData,
                unit_amount: merch_price_cents,
              },
              quantity: merchQty,
            }],
            metadata,
            success_url: `${c.req.header('Origin') || 'https://thecornfield.gg'}/?checkout=success&type=merch`,
            cancel_url: `${c.req.header('Origin') || 'https://thecornfield.gg'}/?checkout=cancelled`,
          };
          break;
        }

        default:
          return c.json({ error: `Unknown checkout type: ${type}` }, 400);
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      return c.json({ url: session.url, session_id: session.id });
    } catch (err: any) {
      console.error('Error creating Stripe Checkout Session:', err);
      return c.json({ error: `Failed to create checkout session: ${err.message}` }, 500);
    }
  });

  // ────────────────────────────────────────────────────
  // POST /stripe/webhook
  // Handles Stripe webhook events — NO AUTH (Stripe sends these directly)
  // Verified via webhook signing secret
  // ───────────────────────────────────────────────────
  app.post(`${PREFIX}/stripe/webhook`, async (c: any) => {
    const stripe = getStripe();
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET is not configured');
      return c.json({ error: 'Webhook secret not configured' }, 500);
    }

    // Get raw body for signature verification
    const rawBody = await c.req.text();
    const signature = c.req.header('stripe-signature');

    if (!signature) {
      console.error('Missing stripe-signature header');
      return c.json({ error: 'Missing signature' }, 400);
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
    } catch (err: any) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return c.json({ error: `Webhook signature verification failed: ${err.message}` }, 400);
    }

    console.log(`Stripe webhook received: ${event.type} (${event.id})`);

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, supabase);
          break;

        case 'invoice.paid':
          await handleInvoicePaid(event.data.object as Stripe.Invoice, supabase);
          break;

        case 'invoice.payment_failed':
          await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice, supabase);
          break;

        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, supabase);
          break;

        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, supabase);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (err: any) {
      // Log but return 200 — Stripe will retry on non-2xx, and we don't want infinite retries
      // for handler bugs. Log thoroughly for debugging.
      console.error(`Error handling webhook event ${event.type} (${event.id}):`, err);
    }

    // Always return 200 to acknowledge receipt
    return c.json({ received: true });
  });

  // ────────────────────────────────────────────────────
  // POST /stripe/customer-portal
  // Generates a Stripe Customer Portal link for subscription management
  // ────────────────────────────────────────────────────
  app.post(`${PREFIX}/stripe/customer-portal`, async (c: any) => {
    try {
      const auth = await requireAuth(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;
      const { dbUser } = auth;

      if (!dbUser.stripe_customer_id) {
        return c.json({ error: 'No Stripe customer found. You need to make a purchase first.' }, 400);
      }

      const stripe = getStripe();
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: dbUser.stripe_customer_id,
        return_url: `${c.req.header('Origin') || 'https://thecornfield.gg'}/#secret-shop?portal=return`,
      });

      return c.json({ url: portalSession.url });
    } catch (err: any) {
      console.error('Error creating Stripe Customer Portal session:', err);
      return c.json({ error: `Failed to create portal session: ${err.message}` }, 500);
    }
  });

  // ────────────────────────────────────────────────────
  // GET /stripe/subscription-status
  // Checks the status of a user's TCF+ subscription from Stripe
  // ────────────────────────────────────────────────────
  app.get(`${PREFIX}/stripe/subscription-status`, async (c: any) => {
    try {
      const auth = await requireAuth(c, supabase, anonSupabase);
      if (!auth.ok) return auth.response;
      const { dbUser } = auth;

      if (!dbUser.tcf_plus_stripe_subscription_id) {
        return c.json({ error: 'No TCF+ subscription found. You need to subscribe first.' }, 400);
      }

      const stripe = getStripe();
      const subscription = await stripe.subscriptions.retrieve(dbUser.tcf_plus_stripe_subscription_id);

      return c.json({
        status: subscription.status,
        cancel_at_period_end: subscription.cancel_at_period_end,
        current_period_end: subscription.current_period_end,
      });
    } catch (err: any) {
      console.error('Error retrieving Stripe subscription status:', err);
      return c.json({ error: `Failed to retrieve subscription status: ${err.message}` }, 500);
    }
  });
}

// ══════════════════════════════════════════════════════
// WEBHOOK EVENT HANDLERS
// ══════════════════════════════════════════════════════

/**
 * checkout.session.completed — A checkout was paid successfully.
 * Fulfills the order based on metadata.order_type.
 */
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  supabase: any,
) {
  const meta = session.metadata || {};
  const userId = meta.tcf_user_id;
  const orderType = meta.order_type as OrderType;

  if (!userId || !orderType) {
    console.error('checkout.session.completed missing metadata:', { userId, orderType, sessionId: session.id });
    return;
  }

  console.log(`Fulfilling ${orderType} for user ${userId} (session: ${session.id})`);

  // 1. Create the order record
  const amountCents = session.amount_total || 0;
  const quantity = meta.quantity ? parseInt(meta.quantity) : 1;

  const orderDescription = getOrderDescription(orderType, quantity, amountCents);

  const { error: orderError } = await supabase.from('orders').insert({
    user_id: userId,
    stripe_checkout_session_id: session.id,
    order_type: orderType,
    description: orderDescription,
    amount_cents: amountCents,
    quantity,
    status: 'completed',
    metadata: {
      stripe_customer_id: session.customer,
      tournament_id: meta.tournament_id || null,
    },
  });

  if (orderError) {
    console.error(`Failed to insert order row for session ${session.id}:`, orderError);
    // Continue fulfillment even if order insert fails — the purchase is paid
  }

  // 2. Fulfill based on type
  switch (orderType) {
    case 'ticket':
      await fulfillTickets(userId, quantity, supabase);
      break;

    case 'tcf_plus':
      await fulfillTcfPlus(userId, session, supabase);
      break;

    case 'donation':
      await fulfillDonation(userId, orderType, amountCents, meta.tournament_id, supabase);
      break;

    case 'merch':
      await fulfillMerch(userId, quantity, meta, session, supabase);
      break;
  }
}

/**
 * invoice.paid — A subscription invoice was paid (initial or renewal).
 * Extends TCF+ expiration.
 */
async function handleInvoicePaid(
  invoice: Stripe.Invoice,
  supabase: any,
) {
  const subscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription?.id;

  if (!subscriptionId) return;

  // Look up user by subscription ID
  const { data: user } = await supabase
    .from('users')
    .select('id, discord_username')
    .eq('tcf_plus_stripe_subscription_id', subscriptionId)
    .maybeSingle();

  if (!user) {
    console.log(`invoice.paid: No user found for subscription ${subscriptionId} — may be initial checkout (handled by checkout.session.completed)`);
    return;
  }

  // Calculate new expiration (1 year from now for annual, 1 month for monthly)
  const periodEnd = invoice.lines?.data?.[0]?.period?.end;
  const expiresAt = periodEnd
    ? new Date(periodEnd * 1000).toISOString()
    : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('users')
    .update({
      tcf_plus_active: true,
      tcf_plus_expires_at: expiresAt,
    })
    .eq('id', user.id);

  if (error) {
    console.error(`Failed to renew TCF+ for user ${user.id}:`, error);
  } else {
    console.log(`TCF+ renewed for user ${user.id} until ${expiresAt}`);
  }

  // Activity log for renewal (not initial — initial is logged in fulfillTcfPlus)
  try {
    await createUserActivity({
      user_id: user.id,
      type: 'tcf_plus_renewed',
      title: 'TCF+ Subscription Renewed',
      description: `Your TCF+ membership was renewed until ${new Date(expiresAt).toLocaleDateString()}.`,
      related_url: '#secret-shop',
    });
  } catch (err) {
    console.error('Non-critical: activity log for TCF+ renewal failed:', err);
  }
}

/**
 * invoice.payment_failed — A subscription renewal payment failed.
 */
async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice,
  supabase: any,
) {
  const subscriptionId = typeof invoice.subscription === 'string'
    ? invoice.subscription
    : invoice.subscription?.id;

  if (!subscriptionId) return;

  const { data: user } = await supabase
    .from('users')
    .select('id, discord_username')
    .eq('tcf_plus_stripe_subscription_id', subscriptionId)
    .maybeSingle();

  if (!user) return;

  console.log(`Payment failed for TCF+ subscription ${subscriptionId} (user: ${user.id})`);

  // Notify the user
  try {
    await createNotification({
      user_id: user.id,
      type: 'payment_failed',
      title: 'TCF+ Payment Failed',
      body: 'Your TCF+ subscription payment failed. Please update your payment method to keep your membership active.',
      action_url: '#secret-shop',
    });
  } catch (err) {
    console.error('Non-critical: notification for payment failure failed:', err);
  }
}

/**
 * customer.subscription.deleted — Subscription was cancelled (by user or failed payments).
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  supabase: any,
) {
  const { data: user } = await supabase
    .from('users')
    .select('id, discord_username')
    .eq('tcf_plus_stripe_subscription_id', subscription.id)
    .maybeSingle();

  if (!user) {
    console.log(`subscription.deleted: No user found for subscription ${subscription.id}`);
    return;
  }

  console.log(`TCF+ subscription cancelled for user ${user.id}`);

  const { error } = await supabase
    .from('users')
    .update({
      tcf_plus_active: false,
      tcf_plus_stripe_subscription_id: null,
      tcf_plus_expires_at: null,
    })
    .eq('id', user.id);

  if (error) {
    console.error(`Failed to deactivate TCF+ for user ${user.id}:`, error);
  }

  // Notify the user
  try {
    await createNotification({
      user_id: user.id,
      type: 'tcf_plus_cancelled',
      title: 'TCF+ Membership Cancelled',
      body: 'Your TCF+ subscription has been cancelled. You can resubscribe anytime from the Secret Shop.',
      action_url: '#secret-shop',
    });

    await createUserActivity({
      user_id: user.id,
      type: 'tcf_plus_cancelled',
      title: 'TCF+ Membership Cancelled',
      description: 'Your TCF+ subscription ended.',
      related_url: '#secret-shop',
    });
  } catch (err) {
    console.error('Non-critical: notification/activity for subscription cancellation failed:', err);
  }
}

/**
 * customer.subscription.updated — Subscription was updated.
 * Key scenario: user cancels in Customer Portal → cancel_at_period_end becomes true.
 * The subscription stays active until period end, then Stripe fires subscription.deleted.
 */
async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  supabase: any,
) {
  const { data: user } = await supabase
    .from('users')
    .select('id, discord_username, tcf_plus_active')
    .eq('tcf_plus_stripe_subscription_id', subscription.id)
    .maybeSingle();

  if (!user) {
    console.log(`subscription.updated: No user found for subscription ${subscription.id}`);
    return;
  }

  // Case 1: User scheduled cancellation (cancel at end of period)
  if (subscription.cancel_at_period_end) {
    const endsAt = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : null;
    const endsAtStr = endsAt ? endsAt.toLocaleDateString() : 'end of billing period';

    console.log(`TCF+ cancellation scheduled for user ${user.id} — active until ${endsAtStr}`);

    // Update expiration to match the period end (membership stays active until then)
    if (endsAt) {
      await supabase
        .from('users')
        .update({ tcf_plus_expires_at: endsAt.toISOString() })
        .eq('id', user.id);
    }

    try {
      await createNotification({
        user_id: user.id,
        type: 'tcf_plus_cancellation_scheduled',
        title: 'TCF+ Cancellation Scheduled',
        body: `Your TCF+ membership will remain active until ${endsAtStr}. You can resubscribe anytime.`,
        action_url: '#secret-shop',
      });

      await createUserActivity({
        user_id: user.id,
        type: 'tcf_plus_cancellation_scheduled',
        title: 'TCF+ Cancellation Scheduled',
        description: `Your TCF+ membership will end on ${endsAtStr}. You won't be charged again.`,
        related_url: '#secret-shop',
      });

      await createAdminLog({
        type: 'tcf_plus_cancellation_scheduled',
        action: `TCF+ cancellation scheduled for user ${user.discord_username || user.id} — active until ${endsAtStr}`,
      });
    } catch (err) {
      console.error('Non-critical: notification/activity for TCF+ cancellation schedule failed:', err);
    }
    return;
  }

  // Case 2: User un-cancelled (reactivated before period end)
  // This happens if they go back to the portal and click "Renew" before it expires
  if (!subscription.cancel_at_period_end && subscription.status === 'active') {
    console.log(`TCF+ subscription reactivated for user ${user.id}`);

    // Restore full expiration from the period end
    const periodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

    await supabase
      .from('users')
      .update({
        tcf_plus_active: true,
        tcf_plus_expires_at: periodEnd,
      })
      .eq('id', user.id);

    try {
      await createNotification({
        user_id: user.id,
        type: 'tcf_plus_reactivated',
        title: 'TCF+ Reactivated!',
        body: 'Your TCF+ cancellation has been reversed. Your membership will continue as normal.',
        action_url: '#secret-shop',
      });

      await createUserActivity({
        user_id: user.id,
        type: 'tcf_plus_reactivated',
        title: 'TCF+ Reactivated',
        description: 'You reversed your TCF+ cancellation. Your membership continues.',
        related_url: '#secret-shop',
      });
    } catch (err) {
      console.error('Non-critical: notification/activity for TCF+ reactivation failed:', err);
    }
    return;
  }

  // Case 3: Generic update (payment method change, etc.) — just log it
  console.log(`TCF+ subscription updated for user ${user.id} (status: ${subscription.status}, cancel_at_period_end: ${subscription.cancel_at_period_end})`);
}

// ══════════════════════════════════════════════════════
// FULFILLMENT FUNCTIONS
// ══════════════════════════════════════════════════════

async function fulfillTickets(userId: string, quantity: number, supabase: any) {
  // Increment ticket balance on users table
  // Use RPC or manual read-then-write since Supabase doesn't have native increment
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('kkup_tickets, total_tickets_purchased, discord_username')
    .eq('id', userId)
    .single();

  if (fetchError || !user) {
    console.error(`Failed to fetch user ${userId} for ticket fulfillment:`, fetchError);
    return;
  }

  const currentTickets = user.kkup_tickets || 0;
  const currentLifetime = user.total_tickets_purchased || 0;
  const newLifetime = currentLifetime + quantity;

  // ── Punchcard bonus: 1 free ticket for every 10 purchased (lifetime) ──
  // Compare how many 10-milestones existed before vs after this purchase
  const bonusTickets = Math.floor(newLifetime / 10) - Math.floor(currentLifetime / 10);
  const newBalance = currentTickets + quantity + bonusTickets;

  const { error: updateError } = await supabase
    .from('users')
    .update({ kkup_tickets: newBalance, total_tickets_purchased: newLifetime })
    .eq('id', userId);

  if (updateError) {
    console.error(`Failed to update ticket balance for user ${userId}:`, updateError);
    return;
  }

  console.log(`Fulfilled ${quantity} ticket(s) for user ${userId}. Balance: ${currentTickets} -> ${newBalance}, Lifetime: ${currentLifetime} -> ${newLifetime}${bonusTickets > 0 ? `, Punchcard bonus: +${bonusTickets}` : ''}`);

  // Activity + notification
  try {
    const bonusNote = bonusTickets > 0
      ? ` Plus ${bonusTickets} bonus ticket${bonusTickets > 1 ? 's' : ''} from the punchcard!`
      : '';

    await createUserActivity({
      user_id: userId,
      type: 'tickets_purchased',
      title: `Purchased ${quantity} Ticket${quantity > 1 ? 's' : ''}`,
      description: `You bought ${quantity} Kernel Kup ticket${quantity > 1 ? 's' : ''}.${bonusNote} New balance: ${newBalance}.`,
      related_url: '#secret-shop',
    });

    await createNotification({
      user_id: userId,
      type: 'purchase_confirmed',
      title: bonusTickets > 0 ? 'Tickets Purchased + Bonus!' : 'Tickets Purchased!',
      body: `${quantity} Kernel Kup ticket${quantity > 1 ? 's' : ''} added to your account.${bonusNote} Balance: ${newBalance}.`,
      action_url: '#secret-shop',
    });

    // Separate punchcard notification so it feels special
    if (bonusTickets > 0) {
      await createNotification({
        user_id: userId,
        type: 'punchcard_bonus',
        title: 'Punchcard Bonus!',
        body: `You hit ${Math.floor(newLifetime / 10) * 10} lifetime tickets! ${bonusTickets} free ticket${bonusTickets > 1 ? 's' : ''} added to your wallet as a thank-you.`,
        action_url: '#secret-shop',
      });
    }

    await createAdminLog({
      type: 'ticket_purchased',
      action: `Ticket purchase: ${quantity} ticket${quantity > 1 ? 's' : ''} by ${user.discord_username || userId} (balance: ${currentTickets} → ${newBalance}, lifetime: ${currentLifetime} → ${newLifetime}${bonusTickets > 0 ? `, punchcard bonus: +${bonusTickets}` : ''})`,
    });
  } catch (err) {
    console.error('Non-critical: activity/notification for ticket purchase failed:', err);
  }
}

async function fulfillTcfPlus(
  userId: string,
  session: Stripe.Checkout.Session,
  supabase: any,
) {
  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : (session.subscription as any)?.id;

  // Set TCF+ active with 1-year expiration
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from('users')
    .update({
      tcf_plus_active: true,
      tcf_plus_expires_at: expiresAt,
      tcf_plus_stripe_subscription_id: subscriptionId || null,
    })
    .eq('id', userId);

  if (error) {
    console.error(`Failed to activate TCF+ for user ${userId}:`, error);
    return;
  }

  // TCF+ perk: +1 free bonus ticket on initial subscription
  let bonusTicketGranted = false;
  try {
    const { data: ticketUser } = await supabase
      .from('users')
      .select('kkup_tickets')
      .eq('id', userId)
      .single();

    const currentTickets = ticketUser?.kkup_tickets || 0;
    const newBalance = currentTickets + 1;

    const { error: ticketErr } = await supabase
      .from('users')
      .update({ kkup_tickets: newBalance })
      .eq('id', userId);

    if (ticketErr) {
      console.error(`Non-critical: failed to grant bonus ticket for TCF+ user ${userId}:`, ticketErr);
    } else {
      bonusTicketGranted = true;
      console.log(`Bonus ticket granted for TCF+ user ${userId}. Ticket balance: ${currentTickets} -> ${newBalance}`);
    }
  } catch (ticketErr) {
    console.error('Non-critical: bonus ticket grant failed:', ticketErr);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  CONGRATULATIONS on becoming a TCF+ Member!`);
  console.log(`  You now have access to ALL the features in the community!`);
  console.log(`  Register for Kernel Kups for FREE -- no ticket needed!`);
  console.log(`  User ${userId} just joined the gold tier. LET'S GOOO!`);
  console.log(`  Active until ${new Date(expiresAt).toLocaleDateString()}`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    await createUserActivity({
      user_id: userId,
      type: 'tcf_plus_subscribed',
      title: 'Subscribed to TCF+',
      description: `Welcome to TCF+! Your membership is active until ${new Date(expiresAt).toLocaleDateString()}.${bonusTicketGranted ? ' You also received 1 free Kernel Kup ticket as a membership perk!' : ''}`,
      related_url: '#secret-shop',
    });

    await createNotification({
      user_id: userId,
      type: 'tcf_plus_activated',
      title: 'Welcome to TCF+!',
      body: `Your TCF+ membership is now active. Enjoy free Kernel Kup registration, exclusive giveaways, and more.${bonusTicketGranted ? ' Plus, 1 free Kernel Kup ticket has been added to your wallet!' : ''}`,
      action_url: '#secret-shop',
    });

    await createAdminLog({
      type: 'tcf_plus_new_subscriber',
      action: `New TCF+ subscriber: user ${userId}`,
    });
  } catch (err) {
    console.error('Non-critical: activity/notification for TCF+ activation failed:', err);
  }
}

async function fulfillDonation(
  userId: string,
  type: OrderType,
  amountCents: number,
  tournamentId: string | undefined,
  supabase: any,
) {
  const amountDollars = amountCents / 100;
  const amountStr = `$${amountDollars.toFixed(2)}`;
  const prizePoolContribution = amountDollars * 0.95;
  const prizePoolAmount = `$${prizePoolContribution.toFixed(2)}`;

  console.log(`Prize Pool Donation fulfilled: ${amountStr} from user ${userId} (95% = ${prizePoolAmount} to prize pool)`);

  // ── Resolve target tournament ──
  // If a tournament_id was provided in checkout metadata, use it.
  // Otherwise, auto-resolve to the next upcoming tournament.
  let resolvedTournamentId = tournamentId;
  let resolvedTournamentName = '';

  try {
    if (resolvedTournamentId) {
      // Validate the provided tournament exists
      const { data: t } = await supabase
        .from('kkup_tournaments')
        .select('id, name')
        .eq('id', resolvedTournamentId)
        .maybeSingle();
      resolvedTournamentName = t?.name || '';
    } else {
      // Auto-resolve: find the next upcoming tournament (earliest start date, not completed/archived)
      const { data: upcoming } = await supabase
        .from('kkup_tournaments')
        .select('id, name')
        .not('status', 'in', '("completed","archived")')
        .order('tournament_start_date', { ascending: true })
        .limit(1);

      if (upcoming && upcoming.length > 0) {
        resolvedTournamentId = upcoming[0].id;
        resolvedTournamentName = upcoming[0].name;
        console.log(`Auto-resolved donation target to: ${resolvedTournamentName} (${resolvedTournamentId})`);
      }
    }
  } catch (err) {
    console.error('Non-critical: failed to resolve tournament for donation:', err);
  }

  // ── Increment prize_pool_donations on the target tournament ──
  if (resolvedTournamentId) {
    try {
      const { data: tRow } = await supabase
        .from('kkup_tournaments')
        .select('prize_pool_donations')
        .eq('id', resolvedTournamentId)
        .single();

      const currentDonations = tRow?.prize_pool_donations ?? 0;
      const newDonations = currentDonations + prizePoolContribution;

      await supabase
        .from('kkup_tournaments')
        .update({ prize_pool_donations: newDonations })
        .eq('id', resolvedTournamentId);

      console.log(`Updated prize_pool_donations for ${resolvedTournamentName}: ${currentDonations} -> ${newDonations}`);
    } catch (err) {
      console.error('Non-critical: failed to update tournament prize_pool_donations:', err);
    }
  }

  // ── Update donation tracking on the user record ──
  let donorUsername = '';
  try {
    const { data: userRow, error: fetchUserErr } = await supabase
      .from('users')
      .select('total_donations_amount, discord_username')
      .eq('id', userId)
      .single();

    if (fetchUserErr) {
      console.error(`Failed to fetch user ${userId} for donation tracking:`, fetchUserErr);
    }

    donorUsername = userRow?.discord_username || '';
    const currentTotal = userRow?.total_donations_amount ?? 0;
    const newTotal = currentTotal + amountDollars;

    console.log(`Updating donation tracking for user ${userId}: total_donations_amount ${currentTotal} -> ${newTotal}, most_recent_donation = now`);

    const { error: updateErr } = await supabase
      .from('users')
      .update({
        most_recent_donation: new Date().toISOString(),
        total_donations_amount: newTotal,
      })
      .eq('id', userId);

    if (updateErr) {
      console.error(`Failed to update donation tracking for user ${userId}:`, updateErr);
    } else {
      console.log(`Successfully updated donation tracking for user ${userId}`);
    }
  } catch (err) {
    console.error('Non-critical: failed to update donation tracking for user:', err);
  }

  // ── Activity log + admin log ──
  const tournamentNote = resolvedTournamentName
    ? ` for ${resolvedTournamentName}`
    : '';

  try {
    await createUserActivity({
      user_id: userId,
      type: 'prize_pool_donated',
      title: 'Prize Pool Donation',
      description: `You donated ${amountStr}${tournamentNote} — ${prizePoolAmount} goes to the prize pool. Thank you!`,
      related_url: '#secret-shop',
    });

    await createAdminLog({
      type: 'prize_pool_donation',
      action: `Prize pool donation: ${amountStr} by ${donorUsername || userId} (${prizePoolAmount} to pool)${resolvedTournamentId ? ` → ${resolvedTournamentName}` : ''}`,
    });
  } catch (err) {
    console.error('Non-critical: activity/notification for donation failed:', err);
  }
}

// ══════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════

function getOrderDescription(type: OrderType, quantity: number, amountCents: number): string {
  const amountStr = `$${(amountCents / 100).toFixed(2)}`;
  switch (type) {
    case 'ticket':
      return `${quantity} Kernel Kup Ticket${quantity > 1 ? 's' : ''}`;
    case 'tcf_plus':
      return 'TCF+ Membership Subscription';
    case 'donation':
      return `Prize Pool Donation — ${amountStr}`;
    case 'merch':
      return `Merch Purchase — ${amountStr}`;
    default:
      return `Purchase — ${amountStr}`;
  }
}

// ══════════════════════════════════════════════════════
// PRINTFUL ORDER CREATION
// ══════════════════════════════════════════════════════

const PRINTFUL_BASE = 'https://api.printful.com';

/**
 * Creates a Printful order from a completed Stripe checkout session.
 * Retrieves the shipping address from Stripe and maps the variant to Printful.
 */
async function createPrintfulOrder(
  session: Stripe.Checkout.Session,
  meta: Record<string, string>,
  quantity: number,
): Promise<{ success: boolean; printful_order_id?: string; error?: string }> {
  const apiKey = Deno.env.get('PRINTFUL_API_KEY');
  if (!apiKey) {
    return { success: false, error: 'PRINTFUL_API_KEY not configured' };
  }

  // Get the full session with shipping details from Stripe
  const stripe = getStripe();
  const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
    expand: ['shipping_details'],
  });

  const shipping = fullSession.shipping_details;
  if (!shipping?.address) {
    return { success: false, error: 'No shipping address found on checkout session' };
  }

  const addr = shipping.address;
  const recipientName = shipping.name || 'TCF Customer';

  // Resolve store_id (reuse the cached logic from routes-printful)
  let storeId: number | null = null;
  try {
    const storesRes = await fetch(`${PRINTFUL_BASE}/stores`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (storesRes.ok) {
      const storesData = await storesRes.json();
      const stores = storesData.result || [];
      const realStore = stores.find((s: any) =>
        s.name && !s.name.toLowerCase().includes('personal order')
      );
      storeId = (realStore || stores[0])?.id || null;
    }
  } catch (err) {
    console.error('Failed to resolve Printful store for order:', err);
  }

  const storeParam = storeId ? `?store_id=${storeId}` : '';

  // Create the Printful order
  const orderPayload = {
    recipient: {
      name: recipientName,
      address1: addr.line1 || '',
      address2: addr.line2 || '',
      city: addr.city || '',
      state_code: addr.state || '',
      country_code: addr.country || 'US',
      zip: addr.postal_code || '',
    },
    items: [{
      sync_variant_id: parseInt(meta.merch_variant_id),
      quantity,
    }],
    // Auto-confirm — Printful processes the order immediately without manual review
    confirm: true,
    // Store the Stripe session ID for reference
    external_id: session.id,
  };

  console.log(`Creating Printful order for variant ${meta.merch_variant_id} x${quantity}, shipping to ${addr.city}, ${addr.state} ${addr.country}`);

  const res = await fetch(`${PRINTFUL_BASE}/orders${storeParam}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(orderPayload),
  });

  const resData = await res.json();

  if (!res.ok) {
    const errMsg = resData.error?.message || resData.result || JSON.stringify(resData);
    console.error(`Printful order creation failed (${res.status}):`, errMsg);
    return { success: false, error: `Printful API error: ${errMsg}` };
  }

  const printfulOrderId = resData.result?.id;
  console.log(`Printful order created successfully: #${printfulOrderId}`);
  return { success: true, printful_order_id: String(printfulOrderId) };
}

async function fulfillMerch(
  userId: string,
  quantity: number,
  meta: Record<string, string>,
  session: Stripe.Checkout.Session,
  supabase: any,
) {
  const productName = meta.merch_product_name || 'Merch';
  const variantName = meta.merch_variant_name || '';
  const amountCents = session.amount_total || 0;
  const amountStr = `$${(amountCents / 100).toFixed(2)}`;
  const itemDesc = `${productName}${variantName ? ` (${variantName})` : ''}`;

  console.log(`Merch fulfillment: ${itemDesc} x${quantity} for ${amountStr} — user ${userId}`);

  // Create the Printful order
  let printfulResult: { success: boolean; printful_order_id?: string; error?: string } = { success: false };
  try {
    printfulResult = await createPrintfulOrder(session, meta, quantity);
  } catch (err: any) {
    console.error(`Failed to create Printful order for session ${session.id}:`, err);
    printfulResult = { success: false, error: err.message };
  }

  if (printfulResult.success) {
    console.log(`Printful order #${printfulResult.printful_order_id} created for merch purchase`);
  } else {
    console.error(`Printful order creation failed: ${printfulResult.error}. Manual fulfillment required for session ${session.id}`);
  }

  // Activity + notification + admin log
  try {
    await createUserActivity({
      user_id: userId,
      type: 'merch_purchased',
      title: 'Merch Purchased!',
      description: `You ordered ${quantity}x ${itemDesc} for ${amountStr}. ${printfulResult.success ? 'Your order is being prepared!' : 'Your payment was received — we\'ll process your order shortly.'}`,
      related_url: '#secret-shop',
    });

    await createNotification({
      user_id: userId,
      type: 'purchase_confirmed',
      title: 'Merch Order Confirmed!',
      body: `Your order for ${quantity}x ${itemDesc} (${amountStr}) has been received. ${printfulResult.success ? 'Printful is preparing your order — you\'ll get shipping updates via email.' : 'We\'ll process your order shortly.'}`,
      action_url: '#secret-shop',
    });

    await createAdminLog({
      type: 'merch_order',
      action: `Merch order: ${quantity}x ${itemDesc} (${amountStr}) from user ${userId}${printfulResult.success ? ` — Printful order #${printfulResult.printful_order_id}` : ' — MANUAL FULFILLMENT NEEDED'}`,
    });
  } catch (err) {
    console.error('Non-critical: activity/notification for merch purchase failed:', err);
  }
}