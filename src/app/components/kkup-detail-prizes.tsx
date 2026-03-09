/**
 * KKup Detail — Prizes Tab
 *
 * Shows the prize pool breakdown (pie chart) and award recipients for a tournament.
 * Reads per-tournament prize config from KV (via API), falling back to defaults.
 * Officers see an "Edit Prize Pool" button to customize categories/amounts.
 *
 * For historical KKups (1-9): shows champion team + Pop'd Kernel from tournament fields.
 * For newer tournaments (S3+): shows full PrizeAward records from the API.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Trophy, Crown, Star, Swords, Users, DollarSign,
  Heart, Settings, Loader2,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { TeamLogo } from '@/app/components/team-logo';
import { Button } from '@/app/components/ui/button';
import { EditPrizeConfigModal, DEFAULT_CATEGORIES } from '@/app/components/edit-prize-config-modal';
import type { TournamentPrizeConfig, PrizeCategory } from '@/app/components/edit-prize-config-modal';
import type { Tournament, Team, PlayerStat } from './kkup-detail-types';
import type { PrizeAward } from '@/lib/connect-api';
import { formatCents } from '@/lib/connect-api';
import { projectId, publicAnonKey } from '/utils/supabase/info';

// ═══════════════════════════════════════════════════════
// LEGACY EXPORTS — keep backward compat for transparency page & award modal
// ═══════════════════════════════════════════════════════

export const PRIZE_POOL_CONFIG = DEFAULT_CATEGORIES.map(c => ({
  key: c.key,
  label: c.label,
  baseAmount: c.amount_cents,
  percent: 0, // computed dynamically now
  icon: c.icon === 'crown' ? Crown : c.icon === 'star' ? Star : c.icon === 'swords' ? Swords : c.icon === 'users' ? Users : DollarSign,
  color: c.color,
  description: c.description,
  splitNote: c.split_note,
}));

export const BASE_POOL_TOTAL = DEFAULT_CATEGORIES.reduce((s, c) => s + c.amount_cents, 0);

export function calculatePrizePool(donationCents: number = 0) {
  const newTotal = BASE_POOL_TOTAL + donationCents;
  return PRIZE_POOL_CONFIG.map((prize) => ({
    ...prize,
    percent: newTotal > 0 ? (prize.baseAmount / newTotal) * 100 : 0,
    actualAmount: Math.round(newTotal * (prize.baseAmount / BASE_POOL_TOTAL)),
    newTotal,
  }));
}

// ═══════════════════════════════════════════════════════
// ICON RESOLVER
// ═══════════════════════════════════════════════════════

const ICON_MAP: Record<string, typeof Crown> = {
  crown: Crown,
  star: Star,
  swords: Swords,
  users: Users,
  'dollar-sign': DollarSign,
  zap: Trophy,
};

function resolveIcon(name: string) {
  return ICON_MAP[name] || DollarSign;
}

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

interface KKupDetailPrizesProps {
  tournament: Tournament;
  teams: Team[];
  playerStats: PlayerStat[];
  prizeAwards: PrizeAward[];
  awardsLoading: boolean;
  /** Does the current user have officer/owner permissions? */
  isOfficer?: boolean;
  /** Access token for authenticated API calls */
  accessToken?: string;
}

// ═══════════════════════════════════════════════════════
// HELPER — compute Pop'd Kernel from stats
// ═══════════════════════════════════════════════════════

function getPopdKernelFromStats(playerStats: PlayerStat[]) {
  if (!playerStats.length) return null;

  const playerAgg: Record<string, { name: string; kills: number; deaths: number; assists: number; matches: number; teamTag?: string; avatarUrl?: string | null }> = {};
  for (const s of playerStats) {
    const key = s.steam_id || s.player_name;
    if (!playerAgg[key]) {
      playerAgg[key] = {
        name: s.player_name || s.player?.name || 'Unknown',
        kills: 0, deaths: 0, assists: 0, matches: 0,
        teamTag: s.team?.tag,
        avatarUrl: s.player?.avatar_url,
      };
    }
    playerAgg[key].kills += s.kills;
    playerAgg[key].deaths += s.deaths;
    playerAgg[key].assists += s.assists;
    playerAgg[key].matches += 1;
  }

  let best: { name: string; kda: number; kills: number; deaths: number; assists: number; matches: number; teamTag?: string; avatarUrl?: string | null } | null = null;
  for (const p of Object.values(playerAgg)) {
    const kda = p.deaths === 0 ? (p.kills + p.assists) : (p.kills + p.assists) / p.deaths;
    if (!best || kda > best.kda) {
      best = { ...p, kda };
    }
  }
  return best;
}

// ═══════════════════════════════════════════════════════
// CUSTOM PIE CHART LABEL
// ═══════════════════════════════════════════════════════

function renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.05) return null; // skip tiny slices
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-[10px] font-bold" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
      {(percent * 100).toFixed(0)}%
    </text>
  );
}

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════

export function KKupDetailPrizes({
  tournament, teams, playerStats, prizeAwards, awardsLoading,
  isOfficer: isOfficerProp = false, accessToken = '',
}: KKupDetailPrizesProps) {
  const [prizeConfig, setPrizeConfig] = useState<TournamentPrizeConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);

  const hasAwardRecords = prizeAwards.length > 0;

  // ── Fetch per-tournament prize config ──
  useEffect(() => {
    let cancelled = false;
    async function fetchConfig() {
      try {
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/${tournament.id}/prize-config`,
          { headers: { 'Authorization': `Bearer ${publicAnonKey}` } },
        );
        if (!res.ok) throw new Error('Failed to fetch prize config');
        const data = await res.json();
        if (!cancelled && data.config) {
          setPrizeConfig(data.config);
        }
      } catch (err) {
        console.error('Prize config fetch error:', err);
      } finally {
        if (!cancelled) setConfigLoading(false);
      }
    }
    fetchConfig();
    return () => { cancelled = true; };
  }, [tournament.id]);

  // Resolved categories: use tournament-specific config or defaults
  const categories: PrizeCategory[] = useMemo(
    () => prizeConfig?.categories?.length ? prizeConfig.categories : DEFAULT_CATEGORIES,
    [prizeConfig],
  );

  const totalCents = useMemo(() => categories.reduce((s, c) => s + c.amount_cents, 0), [categories]);

  // Donations come from Stripe contributions tracked on the tournament record
  const donationCents = Math.round((tournament.prize_pool_donations ?? 0) * 100);

  // Pie data
  const pieData = useMemo(() => {
    const items = categories.map(c => ({
      name: c.label,
      value: c.amount_cents,
      color: c.color,
    }));
    if (donationCents > 0) {
      items.push({ name: 'Donations', value: donationCents, color: '#10b981' });
    }
    return items.filter(d => d.value > 0);
  }, [categories, donationCents]);

  const displayTotal = totalCents + donationCents;

  // Champion team
  const championTeam = useMemo(() => {
    if (tournament.winning_team_name) {
      const t = teams.find(
        (t) => t.name === tournament.winning_team_name || t.id === tournament.winning_team_id,
      );
      return { name: tournament.winning_team_name, team: t || null };
    }
    if (teams.length > 0) {
      return { name: teams[0].name, team: teams[0] };
    }
    return null;
  }, [tournament, teams]);

  // Pop'd Kernel
  const popdKernel1 = tournament.popd_kernel_1_name;
  const popdKernel2 = tournament.popd_kernel_2_name;
  const computedPopd = useMemo(() => {
    if (popdKernel1) return null;
    return getPopdKernelFromStats(playerStats);
  }, [popdKernel1, playerStats]);

  // Group awards by role
  const awardsByRole = useMemo(() => {
    const grouped: Record<string, PrizeAward[]> = {};
    for (const a of prizeAwards) {
      const role = a.role || 'other';
      if (!grouped[role]) grouped[role] = [];
      grouped[role].push(a);
    }
    return grouped;
  }, [prizeAwards]);

  return (
    <div className="space-y-6">
      {/* ─── Prize Pool Breakdown ─── */}
      <div className="bg-card rounded-2xl border-2 border-border p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-kernel-gold/10 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-5 h-5 text-kernel-gold" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">Prize Pool</h2>
              <p className="text-xs text-muted-foreground">
                {prizeConfig ? 'Custom config for this tournament' : 'Default structure'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {displayTotal > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-2xl sm:text-3xl font-black text-kernel-gold">
                  ${(displayTotal / 100).toFixed(2)}
                </span>
                {donationCents > 0 && (
                  <span className="text-xs bg-[#10b981]/10 text-[#10b981] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                    <Heart className="w-3 h-3" />
                    +${(donationCents / 100).toFixed(2)}
                  </span>
                )}
              </div>
            )}
            {isOfficerProp && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEditModal(true)}
                className="flex items-center gap-1.5"
              >
                <Settings className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Edit</span>
              </Button>
            )}
          </div>
        </div>

        {configLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-harvest" />
          </div>
        ) : (
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Pie Chart */}
            <div className="w-48 h-48 sm:w-56 sm:h-56 flex-shrink-0">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius="45%"
                      outerRadius="85%"
                      paddingAngle={2}
                      dataKey="value"
                      strokeWidth={0}
                      label={renderCustomLabel}
                      labelLine={false}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ payload }) => {
                        if (!payload?.[0]) return null;
                        const d = payload[0].payload;
                        const pct = displayTotal > 0 ? ((d.value / displayTotal) * 100).toFixed(1) : '0';
                        return (
                          <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
                            <p className="font-bold text-foreground">{d.name}</p>
                            <p className="text-muted-foreground">
                              ${(d.value / 100).toFixed(2)} ({pct}%)
                            </p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full rounded-full border-2 border-dashed border-border flex items-center justify-center">
                  <p className="text-xs text-muted-foreground text-center px-4">No prize pool configured</p>
                </div>
              )}
            </div>

            {/* Category Legend */}
            <div className="flex-1 w-full space-y-2">
              {categories.map((cat) => {
                const IconComp = resolveIcon(cat.icon);
                const pct = displayTotal > 0 ? ((cat.amount_cents / displayTotal) * 100).toFixed(1) : '0.0';
                return (
                  <div key={cat.key} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${cat.color}15` }}
                    >
                      <IconComp className="w-4 h-4" style={{ color: cat.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{cat.label}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{cat.description}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-black text-foreground">${(cat.amount_cents / 100).toFixed(2)}</p>
                      <p className="text-[10px] font-bold" style={{ color: cat.color }}>{pct}%</p>
                    </div>
                  </div>
                );
              })}
              {donationCents > 0 && (
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#10b981]/5">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-[#10b981]/10">
                    <Heart className="w-4 h-4 text-[#10b981]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">Community Donations</p>
                    <p className="text-[11px] text-muted-foreground">Boosted by the community</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-black text-[#10b981]">${(donationCents / 100).toFixed(2)}</p>
                    <p className="text-[10px] font-bold text-[#10b981]">{((donationCents / displayTotal) * 100).toFixed(1)}%</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Award Recipients ─── */}
      <div className="bg-card rounded-2xl border-2 border-border p-4 sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-harvest/10 flex items-center justify-center flex-shrink-0">
            <Trophy className="w-5 h-5 text-harvest" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">Award Recipients</h2>
            <p className="text-xs text-muted-foreground">Winners and honorees from this tournament</p>
          </div>
        </div>

        {awardsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-xl bg-muted h-20" />
            ))}
          </div>
        ) : hasAwardRecords ? (
          /* ─── S3+ tournaments: real PrizeAward records ─── */
          <div className="space-y-3">
            {Object.entries(awardsByRole).map(([role, roleAwards]) => {
              const catConfig = categories.find((c) => c.key === role);
              const RoleIcon = catConfig ? resolveIcon(catConfig.icon) : Trophy;
              const roleColor = catConfig?.color || '#d6a615';
              const roleLabel = catConfig?.label || role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

              return (
                <div key={role} className="rounded-xl border border-border bg-muted/20 p-3 sm:p-4">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${roleColor}15` }}
                    >
                      <RoleIcon className="w-3.5 h-3.5" style={{ color: roleColor }} />
                    </div>
                    <h3 className="text-sm font-bold text-foreground">{roleLabel}</h3>
                  </div>
                  <div className="space-y-2">
                    {roleAwards.map((award) => (
                      <div
                        key={award.id}
                        className="flex items-center justify-between gap-3 rounded-lg bg-card p-2.5 border border-border"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {award.recipient?.discord_avatar ? (
                            <img
                              src={`https://cdn.discordapp.com/avatars/${award.recipient_user_id}/${award.recipient.discord_avatar}.png?size=64`}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                              width={32}
                              height={32}
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                              <Users className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">
                              {award.recipient?.discord_username || 'Unknown'}
                            </p>
                            {award.reason && (
                              <p className="text-[11px] text-muted-foreground truncate">{award.reason}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-sm font-black text-foreground">
                            {formatCents(award.amount_cents)}
                          </span>
                          <StatusBadge status={award.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ─── Legacy KKups: show from tournament fields ─── */
          <div className="space-y-3">
            {/* Champion */}
            {championTeam && (
              <div className="rounded-xl border-2 border-harvest/30 bg-gradient-to-r from-harvest/5 to-kernel-gold/5 p-4 sm:p-5">
                <div className="flex items-center gap-2.5 mb-3">
                  <Crown className="w-5 h-5 text-harvest" />
                  <h3 className="text-sm font-bold text-harvest">KKup Champions</h3>
                </div>
                <div className="flex items-center gap-4">
                  {championTeam.team && (
                    <TeamLogo
                      logoUrl={championTeam.team.logo_url}
                      teamName={championTeam.name}
                      size="lg"
                    />
                  )}
                  <div>
                    <p className="text-lg sm:text-xl font-black text-foreground">{championTeam.name}</p>
                    {championTeam.team && (
                      <p className="text-xs text-muted-foreground">
                        [{championTeam.team.tag}] · {championTeam.team.wins}W-{championTeam.team.losses}L
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Pop'd Kernel */}
            {(popdKernel1 || computedPopd) && (
              <div className="rounded-xl border-2 border-[#f59e0b]/30 bg-gradient-to-r from-[#f59e0b]/5 to-kernel-gold/5 p-4 sm:p-5">
                <div className="flex items-center gap-2.5 mb-3">
                  <Star className="w-5 h-5 text-[#f59e0b]" />
                  <h3 className="text-sm font-bold text-[#f59e0b]">Pop'd Kernel Award</h3>
                  <span className="text-[10px] text-muted-foreground ml-1">Highest KDA</span>
                </div>
                {popdKernel1 ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#f59e0b]/10 flex items-center justify-center">
                        <Star className="w-5 h-5 text-[#f59e0b]" />
                      </div>
                      <div>
                        <p className="text-lg font-black text-foreground">{popdKernel1}</p>
                        <p className="text-[11px] text-muted-foreground">Tournament MVP</p>
                      </div>
                    </div>
                    {popdKernel2 && (
                      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border">
                        <div className="w-10 h-10 rounded-full bg-[#f59e0b]/10 flex items-center justify-center">
                          <Star className="w-5 h-5 text-[#f59e0b]/60" />
                        </div>
                        <div>
                          <p className="text-base font-bold text-foreground">{popdKernel2}</p>
                          <p className="text-[11px] text-muted-foreground">Runner-up</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : computedPopd ? (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#f59e0b]/10 flex items-center justify-center">
                      <Star className="w-5 h-5 text-[#f59e0b]" />
                    </div>
                    <div>
                      <p className="text-lg font-black text-foreground">{computedPopd.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        KDA: {computedPopd.kda.toFixed(2)} · {computedPopd.kills}K/{computedPopd.deaths}D/{computedPopd.assists}A across {computedPopd.matches} games
                        {computedPopd.teamTag && <> · [{computedPopd.teamTag}]</>}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* Match of the Night — placeholder for legacy */}
            <div className="rounded-xl border border-border bg-muted/20 p-4 sm:p-5">
              <div className="flex items-center gap-2.5 mb-2">
                <Swords className="w-5 h-5 text-[#ef4444]" />
                <h3 className="text-sm font-bold text-[#ef4444]">Match Of The Night</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                This award was introduced in Season 3. Historical KKups did not track this prize.
              </p>
            </div>

            {/* No data fallback */}
            {!championTeam && !popdKernel1 && !computedPopd && (
              <div className="text-center py-8">
                <Trophy className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No prize data available for this tournament.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Edit Prize Config Modal ─── */}
      {showEditModal && (
        <EditPrizeConfigModal
          tournamentId={tournament.id}
          tournamentName={tournament.name}
          accessToken={accessToken}
          currentConfig={prizeConfig}
          onClose={() => setShowEditModal(false)}
          onSaved={(config) => {
            setPrizeConfig(config);
            setShowEditModal(false);
          }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// STATUS BADGE
// ═══════════════════════════════════════════════════════

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; bg: string; text: string }> = {
    pending: { label: 'Pending', bg: 'bg-[#f59e0b]/10', text: 'text-[#f59e0b]' },
    accepted: { label: 'Accepted', bg: 'bg-[#3b82f6]/10', text: 'text-[#3b82f6]' },
    paid: { label: 'Paid', bg: 'bg-[#10b981]/10', text: 'text-[#10b981]' },
    declined: { label: 'Declined', bg: 'bg-[#ef4444]/10', text: 'text-[#ef4444]' },
    revoked: { label: 'Revoked', bg: 'bg-[#ef4444]/10', text: 'text-[#ef4444]' },
    unclaimed: { label: 'Unclaimed', bg: 'bg-[#f59e0b]/10', text: 'text-[#f59e0b]' },
    honorary: { label: 'Honorary', bg: 'bg-[#8b5cf6]/10', text: 'text-[#8b5cf6]' },
  };
  const c = config[status] || config.pending;
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}
