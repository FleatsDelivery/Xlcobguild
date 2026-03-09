/**
 * Checkout Context — persists checkout metadata across Stripe redirects.
 *
 * Before redirecting to Stripe, call `saveCheckoutContext()` with details
 * about what the user is purchasing. When Stripe redirects back, call
 * `loadCheckoutContext()` to retrieve it for the success modal, then
 * `clearCheckoutContext()` after displaying.
 *
 * Stored in localStorage with a 1-hour TTL to prevent stale data.
 */

const STORAGE_KEY = 'tcf_checkout_context';
const TTL_MS = 60 * 60 * 1000; // 1 hour

export interface CheckoutContext {
  type: 'ticket' | 'tcf_plus' | 'donation' | 'merch';
  /** Amount in dollars (not cents) */
  amount?: number;
  /** Ticket quantity */
  quantity?: number;
  /** Bulk discount in dollars (e.g. 1 for $1 off at 5 tickets) */
  discount?: number;
  /** Tournament name for donation context */
  tournamentName?: string;
  /** Tournament ID */
  tournamentId?: string;
  /** Merch product name */
  productName?: string;
  /** When the checkout was initiated */
  timestamp: number;
}

export function saveCheckoutContext(ctx: Omit<CheckoutContext, 'timestamp'>): void {
  try {
    const data: CheckoutContext = { ...ctx, timestamp: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save checkout context:', err);
  }
}

export function loadCheckoutContext(): CheckoutContext | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const ctx: CheckoutContext = JSON.parse(raw);

    // Expire after TTL
    if (Date.now() - ctx.timestamp > TTL_MS) {
      clearCheckoutContext();
      return null;
    }

    return ctx;
  } catch (err) {
    console.error('Failed to load checkout context:', err);
    clearCheckoutContext();
    return null;
  }
}

export function clearCheckoutContext(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    // Silent fail — non-critical
  }
}

// ═══════════════════════════════════════════════════════
// Checkout Result — written by App.tsx when Stripe redirects back
// with ?checkout=success|cancelled in the URL query string.
// Read by SecretShopPage to decide whether to show the celebration modal.
// ═══════════════════════════════════════════════════════

const RESULT_KEY = 'tcf_checkout_result';
const RESULT_TTL_MS = 5 * 60 * 1000; // 5 minutes — should be consumed almost immediately

export interface CheckoutResult {
  status: 'success' | 'cancelled';
  type: string | null;
  qty: number | null;
  timestamp: number;
}

export function saveCheckoutResult(result: Omit<CheckoutResult, 'timestamp'>): void {
  try {
    localStorage.setItem(RESULT_KEY, JSON.stringify({ ...result, timestamp: Date.now() }));
  } catch (err) {
    console.error('Failed to save checkout result:', err);
  }
}

export function loadCheckoutResult(): CheckoutResult | null {
  try {
    const raw = localStorage.getItem(RESULT_KEY);
    if (!raw) return null;
    const result: CheckoutResult = JSON.parse(raw);
    if (Date.now() - result.timestamp > RESULT_TTL_MS) {
      clearCheckoutResult();
      return null;
    }
    return result;
  } catch (err) {
    console.error('Failed to load checkout result:', err);
    clearCheckoutResult();
    return null;
  }
}

export function clearCheckoutResult(): void {
  try {
    localStorage.removeItem(RESULT_KEY);
  } catch (err) {
    // Silent fail
  }
}