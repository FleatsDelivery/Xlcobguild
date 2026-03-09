/**
 * Tournament Hub — Historical Data Manager
 *
 * Self-contained component that fetches and renders ALL tab content
 * for completed/archived tournaments. The orchestrator delegates to
 * this component when isFinished is true.
 *
 * Tab names are the same as lifecycle tabs (overview, teams, players,
 * staff) plus matches and gallery. The orchestrator doesn't need to
 * know about the archive-specific sub-components — this component
 * handles the swap internally.
 *
 * Reuses the existing kkup-detail sub-components for rendering.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Loader2, Database, Plus, X,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/app/components/ui/button';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { slugifyTournamentName } from '@/lib/slugify';

import { KKupDetailOverview } from './kkup-detail-overview';
import { KKupDetailMatches } from './kkup-detail-matches';
import { KKupDetailPlayerStats } from './kkup-detail-player-stats';
import { KKupDetailTeams } from './kkup-detail-teams';
import { KKupDetailStaff } from './kkup-detail-staff';
import { KKupDetailGallery } from './kkup-detail-gallery';
import { KKupDetailPrizes } from './kkup-detail-prizes';
import { EditTeamModal } from '@/app/components/edit-team-modal';
import { EditMatchModal } from '@/app/components/edit-match-modal';
import { CreateMatchModal } from '@/app/components/create-match-modal';

import type { Tournament, Team, Match, PlayerStat, RosterEntry } from './kkup-detail-types';
import type { PrizeAward } from '@/lib/connect-api';
import { getTournamentAwards } from '@/lib/connect-api';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

/** The tabs this component can render content for */
export type FinishedTab = 'overview' | 'teams' | 'players' | 'matches' | 'staff' | 'gallery' | 'prizes';

interface TournamentHubHistoryProps {
  tournamentId: string;
  tournament: any;
  isOwner: boolean;
  accessToken: string;
  activeTab: FinishedTab;
  setActiveTab: (tab: string) => void;
}

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════

export function TournamentHubHistory({
  tournamentId, tournament, isOwner, accessToken, activeTab, setActiveTab,
}: TournamentHubHistoryProps) {
  // ── Historical data state ──
  const [loading, setLoading] = useState(true);
  const [histTournament, setHistTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  const [heroBans, setHeroBans] = useState<Record<number, number>>({});
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [coachMembers, setCoachMembers] = useState<any[]>([]);
  const [teamRosters, setTeamRosters] = useState<Record<string, RosterEntry[]>>({});
  const [loadingRosters, setLoadingRosters] = useState(false);
  
  // Track if we've fetched rosters to avoid dependency issues
  const rostersFetchedRef = useRef(false);

  // ── Gallery state ──
  const [galleryImages, setGalleryImages] = useState<{ name: string; url: string }[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryLoaded, setGalleryLoaded] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // ── Owner tool state ──
  const [scraping, setScraping] = useState(false);
  const [enrichingMatches, setEnrichingMatches] = useState(false);
  const [fixingHeroNames, setFixingHeroNames] = useState(false);
  const [addingMatch, setAddingMatch] = useState(false);
  const [matchIdInput, setMatchIdInput] = useState('');
  const [showAddMatchModal, setShowAddMatchModal] = useState(false);

  // ── Edit modals ──
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showEditTeamModal, setShowEditTeamModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [showEditMatchModal, setShowEditMatchModal] = useState(false);
  const [showCreateMatchModal, setShowCreateMatchModal] = useState(false);

  // ── Prize awards state ──
  const [prizeAwards, setPrizeAwards] = useState<PrizeAward[]>([]);
  const [awardsLoading, setAwardsLoading] = useState(false);
  const [awardsLoaded, setAwardsLoaded] = useState(false);

  const apiBase = `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af`;

  // ═══════════════════════════════════════════════════════
  // DATA FETCHING
  // ═══════════════════════════════════════════════════════

  const fetchHistoricalData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiBase}/kkup/${tournamentId}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      if (!res.ok) throw new Error('Failed to fetch historical tournament data');
      const data = await res.json();

      setHistTournament(data.tournament);
      setTeams(data.teams || []);
      setMatches(data.matches || []);
      setPlayerStats(data.player_stats || []);
      setHeroBans(data.hero_bans || {});
      setStaffMembers(data.staff || []);
      setCoachMembers(data.coaches || []);

      // Build roster map from inline roster data
      if (data.rosters && data.rosters.length > 0) {
        const rostersByTeam: Record<string, RosterEntry[]> = {};
        data.rosters.forEach((r: any) => {
          if (!rostersByTeam[r.team_id]) rostersByTeam[r.team_id] = [];
          rostersByTeam[r.team_id].push({
            id: r.person_id || r.id,
            team_id: r.team_id,
            player_profile_id: r.person_id,
            is_standin: r.is_standin || false,
            player: {
              id: r.person_id,
              player_name: r.person?.display_name || 'Unknown',
              steam_id: r.person?.steam_id || '',
              account_id: parseInt(r.person?.steam_id || '0', 10),
              avatar_url: null,
              dotabuff_url: r.person?.steam_id ? `https://www.dotabuff.com/players/${r.person.steam_id}` : null,
              opendota_url: r.person?.steam_id ? `https://www.opendota.com/players/${r.person.steam_id}` : null,
            },
          });
        });
        setTeamRosters(rostersByTeam);
      }
    } catch (err) {
      console.error('Historical data fetch error:', err);
      toast.error('Failed to load historical tournament data');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    // Reset roster fetch tracking when tournament changes
    rostersFetchedRef.current = false;
    fetchHistoricalData();
  }, [fetchHistoricalData]);

  // ── Lazy gallery fetch ──
  useEffect(() => {
    if (activeTab !== 'gallery' || galleryLoaded || !tournament) return;
    const slug = tournament.name ? slugifyTournamentName(tournament.name) : null;
    if (!slug || slug.length < 3) { setGalleryLoaded(true); return; }

    const fetchGallery = async () => {
      setGalleryLoading(true);
      try {
        const res = await fetch(`${apiBase}/kkup/storage/list?path=${slug}`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` },
        });
        if (!res.ok) throw new Error('Failed to fetch gallery');
        const data = await res.json();
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
        const excludeNames = new Set(['league_banner.png', 'league_large_icon.png', 'league_square_icon.png', '.emptyFolderPlaceholder']);
        const images = (data.files || data || [])
          .filter((f: any) => {
            if (f.isFolder || excludeNames.has(f.name)) return false;
            const lower = f.name.toLowerCase();
            return imageExtensions.some(ext => lower.endsWith(ext));
          })
          .map((f: any) => ({ name: f.name, url: f.url }));
        setGalleryImages(images);
      } catch (err) {
        console.error('Gallery fetch error:', err);
        toast.error('Failed to load gallery images');
      } finally {
        setGalleryLoading(false);
        setGalleryLoaded(true);
      }
    };
    fetchGallery();
  }, [activeTab, tournament, galleryLoaded]);

  // ── Lazy roster fetch (when not included inline) ──
  const fetchTeamRosters = async () => {
    if (!tournamentId || teams.length === 0) return;
    try {
      setLoadingRosters(true);
      const rostersData: Record<string, RosterEntry[]> = {};
      await Promise.all(
        teams.map(async (team) => {
          try {
            const res = await fetch(`${apiBase}/tournament/${tournamentId}/team/${team.id}/roster`, {
              headers: { 'Authorization': `Bearer ${publicAnonKey}` },
            });
            if (res.ok) {
              const data = await res.json();
              rostersData[team.id] = data.roster || [];
            }
          } catch (err) {
            console.error(`Error fetching roster for team ${team.id}:`, err);
          }
        }),
      );
      setTeamRosters(rostersData);
    } catch (err) {
      console.error('Roster fetch error:', err);
    } finally {
      setLoadingRosters(false);
    }
  };

  useEffect(() => {
    if ((activeTab === 'teams' || activeTab === 'matches') && teams.length > 0 && !rostersFetchedRef.current) {
      rostersFetchedRef.current = true;
      fetchTeamRosters();
    }
  }, [activeTab, teams, fetchTeamRosters]);

  // ── Lazy prize awards fetch ──
  useEffect(() => {
    if (activeTab !== 'prizes' || awardsLoaded || !tournamentId) return;
    const fetchAwards = async () => {
      setAwardsLoading(true);
      try {
        const data = await getTournamentAwards(tournamentId);
        setPrizeAwards(data.awards || []);
      } catch (err) {
        console.error('Awards fetch error:', err);
        // Non-critical — legacy KKups won't have award records
      } finally {
        setAwardsLoading(false);
        setAwardsLoaded(true);
      }
    };
    fetchAwards();
  }, [activeTab, tournamentId, awardsLoaded]);

  // ═══════════════════════════════════════════════════════
  // OWNER TOOLS
  // ═══════════════════════════════════════════════════════

  const getKKupNumber = (t: Tournament | null): string | null => {
    if (!t) return null;
    const match = t.name.match(/Kernel Kup (\d+)|KKup (\d+)|KKUP (\d+)/i);
    if (match) return match[1] || match[2] || match[3];
    return null;
  };

  const handleScrapeData = async () => {
    if (!histTournament?.league_id) {
      toast.error('This tournament does not have a League ID — cannot scrape data');
      return;
    }
    try {
      setScraping(true);
      toast.info('Starting scrape from OpenDota... This may take a minute!', { duration: 3000 });
      const token = localStorage.getItem('supabase_token');
      const res = await fetch(`${apiBase}/kkup/scrape/${tournamentId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to scrape data'); }
      const data = await res.json();
      toast.success(`${data.message || 'Scrape complete!'}`, {
        description: `Scraped ${data.matches_scraped} matches, ${data.players_created} players, ${data.stats_created} stats`,
      });
      setTimeout(() => fetchHistoricalData(), 1000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to scrape tournament data');
    } finally { setScraping(false); }
  };

  const handleAddMatch = async () => {
    if (!matchIdInput || isNaN(Number(matchIdInput))) {
      toast.error('Please enter a valid Match ID (number only)');
      return;
    }
    try {
      setAddingMatch(true);
      toast.info('Adding match from OpenDota...');
      const token = localStorage.getItem('supabase_token');
      const res = await fetch(`${apiBase}/kkup/${tournamentId}/add-match`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: matchIdInput }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to add match'); }
      const data = await res.json();
      toast.success(data.message, { description: `Added ${data.stats_created} player stats` });
      setShowAddMatchModal(false);
      setMatchIdInput('');
      setTimeout(() => fetchHistoricalData(), 1000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add match');
    } finally { setAddingMatch(false); }
  };

  const handleEnrichMatches = async () => {
    try {
      setEnrichingMatches(true);
      toast.info('Fetching match details from OpenDota... This may take a minute!', { duration: 3000 });
      const token = localStorage.getItem('supabase_token');
      const res = await fetch(`${apiBase}/kkup/${tournamentId}/enrich-matches`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to enrich matches'); }
      const data = await res.json();
      toast.success(data.message, { description: `Enriched ${data.enriched} matches with scores and player data!` });
      setTimeout(() => fetchHistoricalData(), 1000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to enrich matches');
    } finally { setEnrichingMatches(false); }
  };

  const handleFixHeroNames = async () => {
    try {
      setFixingHeroNames(true);
      toast.info('Fixing hero names...', { duration: 3000 });
      const token = localStorage.getItem('supabase_token');
      const res = await fetch(`${apiBase}/kkup/fix-hero-names`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Failed to fix hero names'); }
      const data = await res.json();
      toast.success(data.message, { description: `Updated ${data.updated} hero names!` });
      setTimeout(() => fetchHistoricalData(), 1000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fix hero names');
    } finally { setFixingHeroNames(false); }
  };

  // ═══════════════════════════════════════════════════════
  // LOADING STATE
  // ═══════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-harvest animate-spin" />
      </div>
    );
  }

  // Use the historical tournament data if available, fall back to hub data
  const t = histTournament || tournament;

  // ═══════════════════════════════════════════════════════
  // OWNER DATA TOOLS BAR
  // ═══════════════════════════════════════════════════════

  const ownerToolsBar = isOwner && (
    <div className="bg-card rounded-xl border-2 border-border p-3 sm:p-4">
      <div className="flex items-center gap-2 mb-3">
        <Database className="w-4 h-4 text-harvest" />
        <span className="text-sm font-bold text-foreground">Data Tools</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Owner</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {t?.league_id && (
          <Button
            size="sm"
            className="bg-harvest hover:bg-amber text-white text-xs"
            onClick={handleScrapeData}
            disabled={scraping}
          >
            {scraping ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Scraping...</> : 'Scrape OpenDota'}
          </Button>
        )}
        <Button
          size="sm"
          className="bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs"
          onClick={handleEnrichMatches}
          disabled={enrichingMatches}
        >
          {enrichingMatches ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Enriching...</> : 'Enrich Matches'}
        </Button>
        <Button
          size="sm"
          className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white text-xs"
          onClick={handleFixHeroNames}
          disabled={fixingHeroNames}
        >
          {fixingHeroNames ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Fixing...</> : 'Fix Hero Names'}
        </Button>
        <Button
          size="sm"
          className="bg-[#10b981] hover:bg-[#059669] text-white text-xs"
          onClick={() => setShowAddMatchModal(true)}
        >
          <Plus className="w-3 h-3 mr-1" /> Add Match
        </Button>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════
  // TAB CONTENT
  // ═══════════════════════════════════════════════════════

  return (
    <>
      {/* Owner data tools — shown on all tabs for finished tournaments */}
      {ownerToolsBar}

      {/* Tab Content — same tab names as lifecycle, different components */}
      {activeTab === 'overview' && (
        <KKupDetailOverview
          tournament={t as Tournament}
          teams={teams}
          playerStats={playerStats}
          heroBans={heroBans}
          getKKupNumber={getKKupNumber}
          setActiveTab={setActiveTab}
        />
      )}

      {activeTab === 'matches' && (
        <KKupDetailMatches
          matches={matches}
          playerStats={playerStats}
          teamRosters={teamRosters}
          isOwner={isOwner}
          setSelectedMatch={setSelectedMatch}
          setShowEditMatchModal={setShowEditMatchModal}
        />
      )}

      {activeTab === 'teams' && (
        <KKupDetailTeams
          teams={teams}
          playerStats={playerStats}
          teamRosters={teamRosters}
          loadingRosters={loadingRosters}
          isOwner={isOwner}
          setSelectedTeam={setSelectedTeam}
          setShowEditTeamModal={setShowEditTeamModal}
          setActiveTab={setActiveTab}
        />
      )}

      {activeTab === 'players' && (
        <KKupDetailPlayerStats
          playerStats={playerStats}
          coachMembers={coachMembers}
        />
      )}

      {activeTab === 'staff' && (
        <KKupDetailStaff staffMembers={staffMembers} />
      )}

      {activeTab === 'gallery' && (
        <KKupDetailGallery
          galleryImages={galleryImages}
          galleryLoading={galleryLoading}
          galleryLoaded={galleryLoaded}
          setLightboxIndex={setLightboxIndex}
        />
      )}

      {activeTab === 'prizes' && (
        <KKupDetailPrizes
          tournament={t as Tournament}
          teams={teams}
          playerStats={playerStats}
          prizeAwards={prizeAwards}
          awardsLoading={awardsLoading}
          isOfficer={isOwner}
          accessToken={accessToken}
        />
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* MODALS                                                  */}
      {/* ═══════════════════════════════════════════════════════ */}

      {/* Add Match Modal */}
      {showAddMatchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl max-w-md w-full p-6 border-2 border-border">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">Add Match Manually</h2>
              <button onClick={() => { setShowAddMatchModal(false); setMatchIdInput(''); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-2">Dota 2 Match ID</label>
                <input
                  type="text" value={matchIdInput}
                  onChange={(e) => setMatchIdInput(e.target.value)}
                  placeholder="e.g., 7891234567"
                  className="w-full px-4 py-3 border-2 border-border rounded-lg focus:outline-none focus:border-harvest text-foreground bg-input-background"
                />
                <p className="text-sm text-muted-foreground mt-2">Enter the Match ID from Dotabuff or OpenDota.</p>
              </div>
              <div className="flex gap-3">
                <Button onClick={() => { setShowAddMatchModal(false); setMatchIdInput(''); }} className="flex-1 bg-muted hover:bg-muted/80 text-foreground border-2 border-border">
                  Cancel
                </Button>
                <Button onClick={handleAddMatch} disabled={addingMatch || !matchIdInput} className="flex-1 bg-harvest hover:bg-amber text-white">
                  {addingMatch ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding...</> : <><Plus className="w-4 h-4 mr-2" />Add Match</>}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Team Modal */}
      {showEditTeamModal && selectedTeam && (
        <EditTeamModal
          team={selectedTeam}
          tournamentId={tournamentId}
          onClose={() => setShowEditTeamModal(false)}
          onSave={fetchHistoricalData}
        />
      )}

      {/* Edit Match Modal */}
      {showEditMatchModal && selectedMatch && (
        <EditMatchModal
          match={selectedMatch}
          tournamentId={tournamentId}
          availableTeams={teams}
          onClose={() => setShowEditMatchModal(false)}
          onSave={fetchHistoricalData}
        />
      )}

      {/* Create Match Modal */}
      {showCreateMatchModal && (
        <CreateMatchModal
          tournamentId={tournamentId}
          availableTeams={teams}
          onClose={() => setShowCreateMatchModal(false)}
          onSave={fetchHistoricalData}
        />
      )}

      {/* Gallery Lightbox */}
      {lightboxIndex !== null && galleryImages.length > 0 && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50" onClick={() => setLightboxIndex(null)}>
          <button className="absolute top-4 right-4 text-white/80 hover:text-white z-10" onClick={() => setLightboxIndex(null)}>
            <X className="w-8 h-8" />
          </button>
          {galleryImages.length > 1 && (
            <>
              <button
                className="absolute left-4 text-white/80 hover:text-white z-10 bg-black/40 hover:bg-black/60 rounded-full p-2"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex - 1 + galleryImages.length) % galleryImages.length); }}
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button
                className="absolute right-4 text-white/80 hover:text-white z-10 bg-black/40 hover:bg-black/60 rounded-full p-2"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((lightboxIndex + 1) % galleryImages.length); }}
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </>
          )}
          <div className="max-w-[90vw] max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img src={galleryImages[lightboxIndex].url} alt={galleryImages[lightboxIndex].name} className="max-w-full max-h-[85vh] object-contain rounded-lg" />
            <p className="text-white/80 text-sm mt-3 text-center">
              {galleryImages[lightboxIndex].name}
              <span className="text-white/40 ml-2">({lightboxIndex + 1} / {galleryImages.length})</span>
            </p>
          </div>
        </div>
      )}
    </>
  );
}