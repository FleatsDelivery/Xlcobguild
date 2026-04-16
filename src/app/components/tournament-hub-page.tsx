import { TournamentOverviewTab } from './tabs/tournament-overview-tab';
import { TournamentTeamsTab } from './tabs/tournament-teams-tab';
import { TournamentPlayersTab } from './tabs/tournament-players-tab';
import { TournamentBracketTab } from './tabs/tournament-bracket-tab';
import { TournamentMatchesTab } from './tabs/tournament-matches-tab';
import { TournamentGalleryTab } from './tabs/tournament-gallery-tab';
import { TournamentPrizesTab } from './tabs/tournament-prizes-tab';
import { TournamentStaffTab } from './tabs/tournament-staff-tab';
import { EditTournamentModal } from './EditTournamentModal';
import { useState, useEffect } from 'react';
import { ArrowLeft, AlertCircle, Settings, ChevronLeft, ChevronRight } from 'lucide-react';
import { TournamentProvider, useTournament } from '@/app/contexts/tournament-context';
import { getPhaseConfig, type TabKey } from './tournament-state-config';
import { getTournamentBanner } from '@/lib/tournament-assets';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { PhaseTransitionArrows } from './phase-transition-arrows';
// Other tabs will be imported as we build them

// ═══════════════════════════════════════════════════════
// LOADING STATE
// ═════════════════════════════════════════════���═════════

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-harvest/30 border-t-harvest rounded-full animate-spin mx-auto mb-4" />
        <p className="text-muted-foreground">Loading tournament...</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ERROR STATE
// ═══════════════════════════════════════════════════════

function ErrorState({ error, onBack }: { error: string; onBack: () => void }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-2xl border-2 border-error/20 p-8 text-center">
        <AlertCircle className="w-16 h-16 text-error mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">Failed to Load Tournament</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <button
          onClick={onBack}
          className="px-6 py-3 bg-harvest text-soil font-bold rounded-lg hover:bg-harvest/90 transition-colors"
        >
          ← Back to Kernel Kup
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// TOURNAMENT HEADER (Card-Based Design)
// ═══════════════════════════════════════════════════════

function TournamentHeader({ onBack }: { onBack: () => void }) {
  const { tournament, staff, myRegistration, myStaffApp, user, isOwner, accessToken, refetch } = useTournament();
  const [imageError, setImageError] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [adjacentTourneys, setAdjacentTourneys] = useState<{ prev: any, next: any }>({ prev: null, next: null });

  useEffect(() => {
    if (!tournament) return;
    const fetchNavList = async () => {
      try {
        const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/tournaments`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        });
        if (response.ok) {
          const data = await response.json();
          const tournaments = data.tournaments || [];
          
          const getNumber = (t: any) => {
             const match = t.name.match(/Kernel Kup (\d+)|KKup (\d+)|KKUP (\d+)/i);
             return match ? parseInt(match[1] || match[2] || match[3]) : 0;
          };

          // Sort descending: newest first 
          const sorted = [...tournaments].sort((a, b) => getNumber(b) - getNumber(a)); 
          const currentIndex = sorted.findIndex((t: any) => t.id === tournament.id);
          
          if (currentIndex !== -1) {
            setAdjacentTourneys({
              next: currentIndex > 0 ? sorted[currentIndex - 1] : null, // Newer is index - 1
              prev: currentIndex < sorted.length - 1 ? sorted[currentIndex + 1] : null  // Older is index + 1
            });
          }
        }
      } catch (err) {}
    };
    fetchNavList();
  }, [tournament?.id]);

  if (!tournament) return null;

  const phaseConfig = getPhaseConfig(tournament.status);
  const tournamentBannerUrl = getTournamentBanner(tournament.name);

  const handleSaveTournament = async () => {
    await refetch();
    setShowEditModal(false);
  };

  const handleDeleteTournament = () => {
    setShowEditModal(false);
    onBack(); // Navigate back to main page after deletion
  };

  const isUserApprovedStaff = myStaffApp?.status === 'approved' || (myRegistration as any)?.role === 'staff';
  const isUserInStaffList = staff?.some(s => s.person_id === user?.id);
  
  const baseCount = (
    (tournament as any).total_registrants || 
    (tournament as any).total_players || 
    (tournament as any).player_count || 
    (tournament as any).staff_count || 
    tournament.registration_count || 
    0
  );

  const staffCount = staff?.length || 0;
  
  // Add +1 if current user is approved staff but NOT already included in the staff list or base count
  const extraStaffCount = (isUserApprovedStaff && !isUserInStaffList) ? 1 : 0;
  
  const totalParticipants = baseCount + staffCount + extraStaffCount;

  return (
    <div className="px-3 sm:px-4 pt-4 pb-2 bg-background">
      <div className="max-w-7xl mx-auto">
        {/* Navigation - Above Card */}
        <div className="flex items-center justify-between mb-4 mt-2">
          <div className="flex-1 flex justify-start">
            {adjacentTourneys.next && (
              <button
                onClick={() => { window.location.hash = `#tournament-hub/${adjacentTourneys.next.id}`; }}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-harvest hover:bg-harvest/10 transition-colors bg-card border-2 border-border px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm group"
              >
                <ChevronLeft className="w-5 h-5 text-muted-foreground group-hover:text-harvest transition-colors" />
                <span className="truncate max-w-[120px] sm:max-w-xs">{adjacentTourneys.next.name}</span>
              </button>
            )}
          </div>

          <div className="flex-1 flex justify-end">
            {adjacentTourneys.prev && (
              <button
                onClick={() => { window.location.hash = `#tournament-hub/${adjacentTourneys.prev.id}`; }}
                className="flex items-center gap-1.5 text-muted-foreground hover:text-harvest hover:bg-harvest/10 transition-colors bg-card border-2 border-border px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm group"
              >
                <span className="truncate max-w-[120px] sm:max-w-xs">{adjacentTourneys.prev.name}</span>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-harvest transition-colors" />
              </button>
            )}
          </div>
        </div>

        {/* Header Card - Two Column Layout */}
        <div className="bg-card rounded-2xl border-2 border-border p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* LEFT SIDE: Title, Description, Status, Stats */}
            <div className="flex-1 min-w-0 space-y-4">
              {/* Title */}
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                {tournament.name}
              </h1>

              {/* Description */}
              <p className="text-muted-foreground">
                {tournament.description || 'No description available'}
              </p>

              {/* Status Badge */}
              <div>
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold ${phaseConfig.statusPillBg} ${phaseConfig.statusPillText}`}>
                  {phaseConfig.pingDot && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
                    </span>
                  )}
                  {phaseConfig.icon} {phaseConfig.label}
                </div>
              </div>

              {/* Quick Stats */}
              <div className="flex flex-wrap gap-x-8 gap-y-4">
                <div>
                  <div className="text-3xl font-bold text-foreground">
                    {totalParticipants}
                  </div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                    Participants
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-foreground">
                    {tournament.team_count || tournament.teams_count || 0}
                  </div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                    Teams
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-harvest">
                    ${((Number(tournament.prize_pool) || 0) + (Number(tournament.prize_pool_donations) || 0)).toLocaleString()}
                  </div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                    Prize Pool
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT SIDE: Banner + Controls */}
            <div className="lg:w-96 space-y-3">
              {/* Banner Image - Fixed to show full image */}
              <div className="w-full bg-harvest/10 rounded-xl overflow-hidden">
                {!imageError ? (
                  <img 
                    src={tournamentBannerUrl}
                    alt={`${tournament.name} banner`}
                    className="w-full h-auto object-contain"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="w-full h-40 flex items-center justify-center">
                    <span className="text-5xl">🌽</span>
                  </div>
                )}
              </div>

              {/* Owner Controls: Left Arrow + Edit + Right Arrow */}
              {isOwner && (
                <div className="flex items-center justify-end gap-2">
                  <PhaseTransitionArrows 
                    tournament={tournament}
                    accessToken={accessToken}
                    onSuccess={refetch}
                    showLeftArrow={true}
                  />
                  
                  <button
                    onClick={() => {
                      refetch(true); // Silent refresh to avoid full-screen spinner
                      setShowEditModal(true);
                    }}
                    className="p-2 bg-harvest/10 hover:bg-harvest/20 text-harvest rounded-lg transition-colors"
                    title="Edit Tournament"
                  >
                    <Settings className="w-5 h-5" />
                  </button>

                  <PhaseTransitionArrows 
                    tournament={tournament}
                    accessToken={accessToken}
                    onSuccess={refetch}
                    showRightArrow={true}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Tournament Modal */}
      {showEditModal && tournament && (
        <EditTournamentModal
          tournament={tournament}
          onClose={() => setShowEditModal(false)}
          onSave={handleSaveTournament}
          onDeleted={handleDeleteTournament}
          legacy={false}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// TAB NAVIGATION
// ═══════════════════════════════════════════════════════

interface TabNavProps {
  tabs: TabKey[];
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
}

function TabNav({ tabs, activeTab, onTabChange }: TabNavProps) {
  const tabLabels: Record<TabKey, string> = {
    overview: 'Overview',
    players: 'Players',
    teams: 'Teams',
    staff: 'Staff',
    matches: 'Matches',
    bracket: 'Bracket',
    gallery: 'Gallery',
    prizes: 'Prizes',
  };

  return (
    <div className="bg-background border-b border-border sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => onTabChange(tab)}
              className={`
                px-4 py-3 font-bold text-sm whitespace-nowrap transition-colors
                border-b-2
                ${activeTab === tab
                  ? 'border-harvest text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
                }
              `}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN CONTENT
// ═══════════════════════════════════════════════════════

function TournamentHubContent({ onBack }: { onBack: () => void }) {
  const { tournament, loading, error } = useTournament();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState error={error} onBack={onBack} />;
  if (!tournament) return <ErrorState error="Tournament not found" onBack={onBack} />;

  const phaseConfig = getPhaseConfig(tournament.status);
  const availableTabs = phaseConfig.availableTabs;

  // Auto-switch to overview if current tab is not available
  if (!availableTabs.includes(activeTab)) {
    setActiveTab('overview');
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <TournamentHeader onBack={onBack} />

      {/* Tab Navigation */}
      <TabNav 
        tabs={availableTabs} 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
      />

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        {activeTab === 'overview' && <TournamentOverviewTab tournamentId={tournament.id} />}
        {activeTab === 'players' && <TournamentPlayersTab />}
        {activeTab === 'teams' && <TournamentTeamsTab />}
        {activeTab === 'staff' && <TournamentStaffTab />}
        {activeTab === 'matches' && <TournamentMatchesTab />}
        {activeTab === 'bracket' && <TournamentBracketTab />}
        {activeTab === 'gallery' && <TournamentGalleryTab />}
        {activeTab === 'prizes' && <TournamentPrizesTab />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// EXPORTED PAGE COMPONENT
// ═══════════════════════════════════════════════════════

interface TournamentHubPageProps {
  tournamentId: string;
  user: any;
  accessToken: string;
  onBack: () => void;
}

export function TournamentHubPage({ 
  tournamentId, 
  user, 
  accessToken, 
  onBack 
}: TournamentHubPageProps) {
  return (
    <TournamentProvider 
      tournamentId={tournamentId} 
      user={user} 
      accessToken={accessToken}
    >
      <TournamentHubContent onBack={onBack} />
    </TournamentProvider>
  );
}
