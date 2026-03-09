/**
 * Stripe Connect API — Frontend Helpers
 *
 * Shared helpers for interacting with routes-connect.ts endpoints.
 * Used by Profile (user onboarding), Officer Panel (prize management),
 * and Inbox (accept/decline prizes).
 */

import { supabase } from '@/lib/supabase';
import { projectId } from '/utils/supabase/info';

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/connect`;

async function getToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('You must be logged in.');
  return token;
}

async function apiGet(path: string) {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function apiPost(path: string, body?: any) {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function apiPut(path: string, body?: any) {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Connect Onboarding ─────────────────────────────────────────────────

export interface ConnectStatus {
  status: 'not_connected' | 'pending' | 'pending_verification' | 'active';
  account_id: string | null;
  details_submitted?: boolean;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
}

export async function getConnectStatus(): Promise<ConnectStatus> {
  return apiGet('/status');
}

export async function startOnboarding(returnUrl?: string, refreshUrl?: string) {
  return apiPost('/onboard', { return_url: returnUrl, refresh_url: refreshUrl });
}

export async function getDashboardLink() {
  return apiPost('/dashboard');
}

// ── Prize Awards ───────────────────────────────────────────────────────

export interface PrizeAward {
  id: string;
  recipient_user_id: string;
  awarded_by_user_id: string;
  amount_cents: number;
  reason: string | null;
  tournament_id: string | null;
  team_id: string | null;
  master_team_id: string | null;
  person_id: string | null;
  place: number | null;
  role: string;
  status: 'pending' | 'accepted' | 'declined' | 'paid' | 'revoked' | 'honorary';
  stripe_transfer_id: string | null;
  denial_reason: string | null;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
  paid_at: string | null;
  revoked_at: string | null;
  // Enriched fields (from list endpoints)
  recipient?: {
    id: string;
    discord_username: string;
    discord_avatar: string | null;
    stripe_connect_status: string | null;
  } | null;
  tournament?: {
    id: string;
    name: string;
  } | null;
}

export interface CreateAwardParams {
  recipient_user_id: string;
  amount_cents: number;
  reason?: string;
  tournament_id?: string;
  team_id?: string;
  place?: number;
  role?: string;
}

export interface CreateAwardBatchParams {
  tournament_id: string;
  role: string;
  team_id?: string;
  recipients: Array<{ user_id?: string; person_id?: string; amount_cents: number }>;
  reason?: string;
  place?: number;
}

export async function createAwardBatch(params: CreateAwardBatchParams) {
  return apiPost('/award-batch', params);
}

export async function createAward(params: CreateAwardParams) {
  return apiPost('/award', params);
}

export async function acceptAward(awardId: string) {
  return apiPut(`/award/${awardId}/accept`);
}

export async function declineAward(awardId: string, reason?: string) {
  return apiPut(`/award/${awardId}/decline`, { reason });
}

export async function disburseAward(awardId: string) {
  return apiPost(`/award/${awardId}/disburse`);
}

export async function revokeAward(awardId: string, reason?: string) {
  return apiPut(`/award/${awardId}/revoke`, { reason });
}

export async function getMyAwards(): Promise<{ awards: PrizeAward[] }> {
  return apiGet('/awards/mine');
}

export async function getTournamentAwards(tournamentId: string): Promise<{ awards: PrizeAward[] }> {
  return apiGet(`/awards/tournament/${tournamentId}`);
}

export async function getAllAwards(status?: string): Promise<{ awards: PrizeAward[] }> {
  const query = status ? `?status=${status}` : '';
  return apiGet(`/awards/all${query}`);
}

// ── Utility ────────────────────────────────────────────────────────────

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}