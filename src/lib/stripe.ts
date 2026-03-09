/**
 * Stripe Checkout Utilities — Frontend
 *
 * Shared helpers for creating Stripe checkout sessions and opening
 * the customer billing portal. Used by Secret Shop and Profile pages.
 */

import { supabase } from '@/lib/supabase';
import { projectId } from '/utils/supabase/info';

// ── Types ──────────────────────────────────────────────────────────────

export interface CheckoutParams {
  type: string;
  quantity?: number;
  amount?: number;
  tournament_id?: string;
  merch_variant_id?: number;
  merch_product_name?: string;
  merch_variant_name?: string;
  merch_price_cents?: number;
  merch_image_url?: string;
}

// ── Checkout Session ───────────────────────────────────────────────────

export async function createCheckoutSession(params: CheckoutParams): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('You must be logged in to make a purchase.');

  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/stripe/create-checkout`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    },
  );

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errData.error || `HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!data.url) throw new Error('No checkout URL returned from server');
  return data.url;
}

// ── Customer Portal ────────────────────────────────────────────────────

export async function openCustomerPortal(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('You must be logged in.');

  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/stripe/customer-portal`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  );

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errData.error || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.url;
}

// ── Subscription Status ────────────────────────────────────────────────

export interface SubscriptionStatus {
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: number; // Unix timestamp
}

export async function fetchSubscriptionStatus(): Promise<SubscriptionStatus | null> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return null;

  const res = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/stripe/subscription-status`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    },
  );

  if (!res.ok) {
    // 400 = no subscription, not an error
    if (res.status === 400) return null;
    const errData = await res.json().catch(() => ({ error: res.statusText }));
    console.error('Failed to fetch subscription status:', errData.error);
    return null;
  }

  return res.json();
}