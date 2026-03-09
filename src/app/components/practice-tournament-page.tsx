/**
 * Practice Tournament Page — Lightweight, KV-backed tournament viewer
 * 
 * Orchestrator for practice tournaments. Fetches from /practice/* endpoints,
 * normalizes data to the same shapes as real tournament pages, and renders
 * using shared components (LiveMatchPanel, MatchCardWithHeroes).
 * 
 * Two modes:
 *   1. List view (#practice) — create/manage practice tournaments
 *   2. Detail view (#practice/{league_id}) — view a specific practice tournament
 */

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Loader2, Plus, Trash2, RefreshCw,
  Radio, Swords, Users, Trophy, AlertCircle, Zap,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { LiveMatchPanel } from './live-match-panel';
import type { LiveGame } from './live-match-panel';
import { MatchCardWithHeroes } from './match-card-with-heroes';
import { TeamLogo } from './team-logo';
import { Footer } from './footer';
import { ConfirmModal } from './confirm-modal';
import { ensureDynamicHeroCache } from '@/lib/dota-heroes';
import { getPollInterval, canManualRefresh } from '@/lib/live-polling-config';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

interface PracticeMeta {
  league_id: number;
  name: string;
  status: string;
  created_at: string;
  created_by: string;
  last_refreshed: string;
  total_matches: number;
  detailed_matches: number;
  team_count: number;
}

interface PracticeTeam {
  id: string;
  name: string;
  tag: string;
  logo_url: string | null;
  wins: number;
  losses: number;
  total_kills: number;
}

interface PracticeTournamentPageProps {
  user: any;
  accessToken: string;
  leagueId?: string; // If provided, show detail view; otherwise show list
  onBack: () => void;
}

type DetailTab = 'live' | 'matches' | 'teams';

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af`;

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════

export function PracticeTournamentPage({ user, accessToken, leagueId, onBack }: PracticeTournamentPageProps) {
  if (leagueId) {
    return <PracticeDetail leagueId={leagueId} user={user} accessToken={accessToken} onBack={onBack} />;
  }
  return <PracticeList user={user} accessToken={accessToken} onBack={onBack} />;
}

// ═══════════════════════════════════════════════════════
// LIST VIEW — Create & manage practice tournaments
// ═══════════════════════════════════════════════════════

function PracticeList({ user, accessToken, onBack }: { user: any; accessToken: string; onBack: () => void }) {
  const [tournaments, setTournaments] = useState<PracticeMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [leagueInput, setLeagueInput] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<PracticeMeta | null>(null);
  const [deleting, setDeleting] = useState(false);

  const authHeaders = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/practice/list`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      const data = await res.json();
      setTournaments(data.tournaments || []);
    } catch (err) {
      console.error('Failed to fetch practice tournaments:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  // ── Hydrate dynamic hero cache (covers heroes added after static map was written) ──
  useEffect(() => { ensureDynamicHeroCache(); }, []);

  const handleCreate = async () => {
    const id = parseInt(leagueInput.trim(), 10);
    if (!id || isNaN(id)) {
      toast.error('Enter a valid league ID (number)');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/practice/create`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ league_id: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Creation failed');
      toast.success(`Created: ${data.meta?.name || `League ${id}`}`);
      setLeagueInput('');
      await fetchList();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (meta: PracticeMeta) => {
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/practice/${meta.league_id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      toast.success(data.message || 'Deleted');
      setDeleteConfirm(null);
      await fetchList();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="px-3 sm:px-4 py-4 min-h-screen bg-background">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 rounded-lg hover:bg-muted transition-all">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground flex items-center gap-2">
                <Zap className="w-6 h-6 sm:w-7 sm:h-7 text-harvest" />
                Practice Tournaments
              </h1>
              <p className="text-sm text-muted-foreground">KV-backed throwaway tournaments for testing live features</p>
            </div>
          </div>
        </div>

        {/* Create Form */}
        <div className="bg-card rounded-2xl border-2 border-border p-4 sm:p-6">
          <h2 className="text-lg font-bold text-foreground mb-3">Create Practice Tournament</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Enter a Steam league ID (find it on Dotabuff under the league URL). The system will pull all match history and team data from Steam.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              value={leagueInput}
              onChange={(e) => setLeagueInput(e.target.value)}
              placeholder="League ID (e.g. 19116)"
              className="flex-1 bg-input-background"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <Button
              onClick={handleCreate}
              disabled={creating || !leagueInput.trim()}
              className="bg-harvest hover:bg-harvest/90 text-white font-bold"
            >
              {creating ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Creating...</>
              ) : (
                <><Plus className="w-4 h-4 mr-2" /> Create</>
              )}
            </Button>
          </div>
          {creating && (
            <p className="text-xs text-muted-foreground mt-3 animate-pulse">
              Pulling data from Steam API... This may take 30-60 seconds for leagues with many matches.
            </p>
          )}
        </div>

        {/* Tournament List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-harvest" />
          </div>
        ) : tournaments.length === 0 ? (
          <div className="bg-card rounded-2xl border-2 border-border p-8 sm:p-12 text-center">
            <Radio className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-muted-foreground font-semibold">No practice tournaments yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create one above to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tournaments.map((t) => (
              <div
                key={t.league_id}
                className="bg-card rounded-2xl border-2 border-border hover:border-harvest/50 transition-all cursor-pointer p-4 sm:p-5"
                onClick={() => { window.location.hash = `#practice/${t.league_id}`; }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-foreground truncate">{t.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">League #{t.league_id}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm(t); }}
                    className="p-1.5 rounded-lg hover:bg-[#ef4444]/10 text-muted-foreground hover:text-[#ef4444] transition-all flex-shrink-0"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Swords className="w-3.5 h-3.5" /> {t.detailed_matches} matches</span>
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {t.team_count} teams</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">
                  Created by {t.created_by} • {new Date(t.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Footer />

      {deleteConfirm && (
        <ConfirmModal
          title="Delete Practice Tournament?"
          message={`This will permanently delete "${deleteConfirm.name}" and all associated match data from the KV store. This cannot be undone.`}
          confirmText="Delete"
          confirmVariant="danger"
          loading={deleting}
          loadingText="Deleting..."
          onConfirm={() => handleDelete(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// DETAIL VIEW — View a specific practice tournament
// ═══════════════════════════════════════════════════════

function PracticeDetail({ leagueId, user, accessToken, onBack }: { leagueId: string; user: any; accessToken: string; onBack: () => void }) {
  const [meta, setMeta] = useState<PracticeMeta | null>(null);
  const [teams, setTeams] = useState<PracticeTeam[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [playerStats, setPlayerStats] = useState<Record<string, any[]>>({}); // match_id → stats
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>('live');

  // Live polling
  const [liveGames, setLiveGames] = useState<LiveGame[]>([]);
  const [livePolledAt, setLivePolledAt] = useState<string | null>(null);
  const [liveRefreshing, setLiveRefreshing] = useState(false);

  // Refresh
  const [refreshing, setRefreshing] = useState(false);

  // Expanded match (for loading player stats)
  const [loadingMatchStats, setLoadingMatchStats] = useState<string | null>(null);

  const authHeaders = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };

  // ── Fetch tournament data ──
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/practice/${leagueId}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Not found');
      }
      const data = await res.json();
      setMeta(data.meta);
      setTeams(data.teams || []);
      setMatches(data.matches || []);
    } catch (err: any) {
      setError(err.message);
      console.error('Practice tournament fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Hydrate dynamic hero cache (covers heroes added after static map was written) ──
  useEffect(() => { ensureDynamicHeroCache(); }, []);

  // ── Poll live games ──
  const pollLive = useCallback(async () => {
    try {
      setLiveRefreshing(true);
      const res = await fetch(`${API_BASE}/practice/${leagueId}/live`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      const data = await res.json();
      setLiveGames(data.games || []);
      setLivePolledAt(data.polled_at || new Date().toISOString());
    } catch (err) {
      console.error('Live poll error:', err);
    } finally {
      setLiveRefreshing(false);
    }
  }, [leagueId]);

  // Auto-poll when on live tab
  useEffect(() => {
    if (activeTab !== 'live') return;
    pollLive();
    const isTcfPlus = !!user?.tcf_plus_active;
    const interval = setInterval(pollLive, getPollInterval(isTcfPlus));
    return () => clearInterval(interval);
  }, [activeTab, pollLive, user?.tcf_plus_active]);

  // ── Refresh match data ──
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`${API_BASE}/practice/${leagueId}/refresh`, {
        method: 'POST',
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Refresh failed');
      toast.success(`Refreshed: +${data.new_matches} new matches`);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  // ── Fetch player stats for a specific match ──
  const fetchMatchStats = async (matchId: string) => {
    if (playerStats[matchId]) return; // Already cached
    setLoadingMatchStats(matchId);
    try {
      const res = await fetch(`${API_BASE}/practice/${leagueId}/match/${matchId}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      const data = await res.json();
      if (data.playerStats) {
        setPlayerStats(prev => ({ ...prev, [matchId]: data.playerStats }));
      }
    } catch (err) {
      console.error(`Failed to fetch stats for match ${matchId}:`, err);
    } finally {
      setLoadingMatchStats(null);
    }
  };

  // ── Loading / Error states ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-harvest mx-auto mb-3" />
          <p className="text-muted-foreground font-semibold">Loading practice tournament...</p>
        </div>
      </div>
    );
  }

  if (error || !meta) {
    return (
      <div className="px-3 sm:px-4 py-8 min-h-screen bg-background">
        <div className="max-w-4xl mx-auto">
          <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="bg-card rounded-2xl border-2 border-[#ef4444]/30 p-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-[#ef4444]" />
            <p className="text-foreground font-bold text-lg">Tournament Not Found</p>
            <p className="text-muted-foreground mt-2">{error || 'This practice tournament may have been deleted.'}</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Tab config ──
  const tabs: { key: DetailTab; label: string; icon: typeof Radio; count?: number }[] = [
    { key: 'live', label: 'Live', icon: Radio, count: liveGames.length },
    { key: 'matches', label: 'Matches', icon: Swords, count: matches.length },
    { key: 'teams', label: 'Teams', icon: Users, count: teams.length },
  ];

  // Sort teams by wins descending
  const sortedTeams = [...teams].sort((a, b) => b.wins - a.wins || a.losses - b.losses);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-[#ef4444] to-[#dc2626] relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iLjA1Ij48cGF0aCBkPSJNMzYgMzRWMGgySjM2ek0wIDM0VjBIMnYzNHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8 relative">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-white/80 hover:text-white mb-4 text-sm font-bold"
          >
            <ArrowLeft className="w-4 h-4" /> Practice Tournaments
          </button>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-bold uppercase tracking-wide">
                  Practice
                </span>
                <span className="text-white/60 text-xs font-mono">League #{meta.league_id}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">{meta.name}</h1>
              <p className="text-white/60 text-sm mt-1">
                {meta.detailed_matches} matches • {meta.team_count} teams • Last refreshed {new Date(meta.last_refreshed).toLocaleString()}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleRefresh}
                disabled={refreshing}
                className="bg-white/20 hover:bg-white/30 text-white border border-white/20 font-bold text-xs"
                size="sm"
              >
                {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        <div className="flex gap-1 overflow-x-auto py-3 -mb-px">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#ef4444] text-white'
                    : 'bg-transparent text-muted-foreground hover:bg-muted'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.count != null && tab.count > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-6">
        {/* LIVE TAB */}
        {activeTab === 'live' && (
          <LiveMatchPanel
            games={liveGames}
            polledAt={livePolledAt || undefined}
            onRefresh={canManualRefresh(!!user?.tcf_plus_active) ? pollLive : undefined}
            refreshing={liveRefreshing}
            pollIntervalMs={getPollInterval(!!user?.tcf_plus_active)}
            isTcfPlus={!!user?.tcf_plus_active}
          />
        )}

        {/* MATCHES TAB */}
        {activeTab === 'matches' && (
          <div className="space-y-4">
            {matches.length === 0 ? (
              <div className="bg-card rounded-2xl border-2 border-border p-8 sm:p-12 text-center">
                <Swords className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-muted-foreground font-semibold">No match data yet</p>
                <p className="text-sm text-muted-foreground mt-1">Matches will appear here after games are completed</p>
              </div>
            ) : (
              matches.map((match) => {
                const matchStats = playerStats[match.id] || playerStats[String(match.match_id)] || [];
                const matchKey = match.id || String(match.match_id);
                const isLoadingThis = loadingMatchStats === matchKey;

                return (
                  <div key={matchKey}>
                    <MatchCardWithHeroes
                      match={match}
                      playerStats={matchStats}
                      isOwner={false}
                    />
                    {matchStats.length === 0 && (
                      <div className="flex justify-center -mt-1">
                        <button
                          onClick={() => fetchMatchStats(matchKey)}
                          disabled={isLoadingThis}
                          className="px-4 py-1.5 rounded-b-lg bg-muted text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all border border-t-0 border-border"
                        >
                          {isLoadingThis ? (
                            <span className="flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> Loading stats...</span>
                          ) : (
                            'Load Player Stats'
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TEAMS TAB */}
        {activeTab === 'teams' && (
          <div className="space-y-4">
            {sortedTeams.length === 0 ? (
              <div className="bg-card rounded-2xl border-2 border-border p-8 sm:p-12 text-center">
                <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-muted-foreground font-semibold">No teams found</p>
              </div>
            ) : (
              <div className="bg-card rounded-2xl border-2 border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-max">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border text-xs font-bold text-muted-foreground uppercase tracking-wide">
                        <th className="text-left p-3 sm:p-4">#</th>
                        <th className="text-left p-3 sm:p-4">Team</th>
                        <th className="text-center p-3 sm:p-4">W</th>
                        <th className="text-center p-3 sm:p-4">L</th>
                        <th className="text-center p-3 sm:p-4 hidden sm:table-cell">Win%</th>
                        <th className="text-center p-3 sm:p-4 hidden sm:table-cell">Total Kills</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTeams.map((team, i) => {
                        const totalGames = team.wins + team.losses;
                        const winRate = totalGames > 0 ? ((team.wins / totalGames) * 100).toFixed(0) : '0';
                        return (
                          <tr key={team.id} className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-all">
                            <td className="p-3 sm:p-4">
                              <span className={`font-black text-sm ${i === 0 ? 'text-harvest' : i < 3 ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {i + 1}
                              </span>
                            </td>
                            <td className="p-3 sm:p-4">
                              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                <TeamLogo logoUrl={team.logo_url} teamName={team.name} size="sm" />
                                <div className="min-w-0">
                                  <p className="font-bold text-foreground text-sm truncate">{team.name}</p>
                                  <p className="text-[10px] text-muted-foreground">{team.tag}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-3 sm:p-4 text-center font-black text-[#10b981] text-sm">{team.wins}</td>
                            <td className="p-3 sm:p-4 text-center font-black text-[#ef4444] text-sm">{team.losses}</td>
                            <td className="p-3 sm:p-4 text-center font-bold text-foreground text-sm hidden sm:table-cell">{winRate}%</td>
                            <td className="p-3 sm:p-4 text-center font-bold text-muted-foreground text-sm hidden sm:table-cell">{team.total_kills.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}