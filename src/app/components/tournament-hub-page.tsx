import { TournamentOverviewTab } from './tabs/tournament-overview-tab';
import { TournamentTeamsTab } from './tabs/tournament-teams-tab';
import { TournamentPlayersTab } from './tabs/tournament-players-tab';
import { TournamentBracketTab } from './tabs/tournament-bracket-tab';
import { TournamentMatchesTab } from './tabs/tournament-matches-tab';
import { TournamentGalleryTab } from './tabs/tournament-gallery-tab';
import { TournamentPrizesTab } from './tabs/tournament-prizes-tab';
import { TournamentStaffTab } from './tabs/tournament-staff-tab';
import { EditTournamentModal } from './EditTournamentModal';
import { useState } from 'react';
import { ArrowLeft, AlertCircle, Settings } from 'lucide-react';
import { TournamentProvider, useTournament } from '@/app/contexts/tournament-context';
import { getPhaseConfig, type TabKey } from './tournament-state-config';
import { getTournamentBanner } from '@/lib/tournament-assets';
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
        <h2 className="text-2xl font-black text-foreground mb-2">Failed to Load Tournament</h2>
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
  const { tournament, isOwner, accessToken, refetch } = useTournament();
  const [imageError, setImageError] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

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

  return (
    <div className="px-3 sm:px-4 pt-4 pb-2 bg-background">
      <div className="max-w-7xl mx-auto">
        {/* Back Button - Above Card */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-semibold">Back to Kernel Kup</span>
        </button>

        {/* Header Card - Two Column Layout */}
        <div className="bg-card rounded-2xl border-2 border-border p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* LEFT SIDE: Title, Description, Status, Stats */}
            <div className="flex-1 min-w-0 space-y-4">
              {/* Title */}
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">
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
              <div className="flex gap-6">
                <div>
                  <div className="text-3xl font-black text-foreground">
                    {tournament.player_count || tournament.registration_count || 0}
                  </div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                    Players
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-black text-foreground">
                    {tournament.team_count || tournament.teams_count || 0}
                  </div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                    Teams
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
                  
                  {/* Edit Tournament Button */}
                  <button
                    onClick={() => setShowEditModal(true)}
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