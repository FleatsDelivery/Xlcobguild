import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Loader2, 
  Crown, 
  Trophy, 
  Calendar, 
  Users, 
  Swords, 
  Edit, 
  ExternalLink, 
  Youtube, 
  ArrowLeft, 
  AlertCircle, 
  Pencil, 
  Target, 
  X, 
  Plus,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { Button } from '@/app/components/ui/button';
import { TeamLogo } from '@/app/components/team-logo';
import { TournamentTopPlayers } from '@/app/components/tournament-top-players';
import { TournamentHeroStats } from '@/app/components/tournament-hero-stats';
import { MatchCardWithHeroes } from '@/app/components/match-card-with-heroes';
import { EditTournamentModal } from '@/app/components/EditTournamentModal';
import { EditTeamModal } from '@/app/components/edit-team-modal';
import { CreateTeamModal } from '@/app/components/create-team-modal';
import { EditMatchModal } from '@/app/components/edit-match-modal';
import { CreateMatchModal } from '@/app/components/create-match-modal';
import { AwardAchievementModal } from "@/app/components/award-achievement-modal";
import { AggregatedPlayerStats } from "@/app/components/aggregated-player-stats";
import { getHeroImageUrl } from '@/lib/dota-heroes';
import { Footer } from "@/app/components/footer";

// Twitch Icon Component
const TwitchIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
  </svg>
);

interface Tournament {
  id: string;
  name: string;
  league_id: number | null;
  tournament_start_date: string;
  tournament_end_date: string;
  prize_pool: string;
  status: string;
  description: string;
  twitch_channel: string;
  youtube_playlist_url: string;
  cover_photo_url: string | null;
  youtube_url: string | null;
  league_banner_url?: string | null;
  league_large_icon_url?: string | null;
  league_square_icon_url?: string | null;
}

interface Team {
  id: string;
  name: string;
  tag: string;
  logo_url: string | null;
  wins: number;
  losses: number;
  series_wins?: number;
  series_losses?: number;
  game_wins?: number;
  game_losses?: number;
  total_kills?: number;
}

interface PlayerProfile {
  id: string;
  player_name: string;
  steam_id: string;
  account_id: number;
  avatar_url: string | null;
  dotabuff_url: string | null;
  opendota_url: string | null;
}

interface RosterEntry {
  id: string;
  team_id: string;
  player_profile_id: string;
  player: PlayerProfile;
}

interface Match {
  id: string;
  team1_id: string;
  team2_id: string;
  stage: string;
  status: string;
  team1: {
    id: string;
    name: string;
    tag: string;
    logo_url: string | null;
  };
  team2: {
    id: string;
    name: string;
    tag: string;
    logo_url: string | null;
  };
  winner: {
    id: string;
    name: string;
    tag: string;
    logo_url: string | null;
  } | null;
  winner_team_id: string | null;
  team1_score: number;
  team2_score: number;
  scheduled_time: string;
  dotabuff_url: string | null;
  youtube_url: string | null;
  twitch_vod_url: string | null;
  youtube_vod_url: string | null;
  match_id: number | null;
  series_id: number | null;
}

interface PlayerStat {
  id: string;
  match_id: string;
  team_id: string;
  player_name: string;
  steam_id: string;
  hero_id: number;
  hero_name: string;
  kills: number;
  deaths: number;
  assists: number;
  last_hits: number;
  denies: number;
  gpm: number;
  xpm: number;
  hero_damage: number;
  tower_damage: number;
  hero_healing: number;
  net_worth?: number;
  gold?: number;
  observer_uses?: number;
  sentry_uses?: number;
  level?: number;
  is_winner: boolean;
  account_id: number;
  player: {
    steam_id: string;
    name: string;
    avatar_url: string | null;
    dotabuff_url: string | null;
    opendota_url: string | null;
  } | null;
  team?: {
    id: string;
    name: string;
    tag: string;
    logo_url: string | null;
  };
}

export function KKupDetailPage({ id }: { id: string }) {
  // Utility function to extract KKup number from tournament name
  const getKKupNumber = (tournament: Tournament | null): string | null => {
    if (!tournament) return null;
    
    // Try to extract number from tournament name (e.g., "Kernel Kup 5" -> "5")
    const match = tournament.name.match(/Kernel Kup (\d+)|KKup (\d+)|KKUP (\d+)/i);
    if (match) {
      return match[1] || match[2] || match[3];
    }
    return null;
  };

  // Utility function to generate league asset URLs
  const getLeagueAssetUrl = (tournament: Tournament | null, assetType: 'banner' | 'large_icon' | 'square_icon'): string | null => {
    const kkupNumber = getKKupNumber(tournament);
    if (!kkupNumber) return null;
    
    const filename = assetType === 'banner' ? 'league_banner.png' 
                   : assetType === 'large_icon' ? 'league_large_icon.png'
                   : 'league_square_icon.png';
    
    return `https://${projectId}.supabase.co/storage/v1/object/public/make-4789f4af-kkup-assets/kkup${kkupNumber}/${filename}`;
  };

  const [loading, setLoading] = useState(true);
  const [tournament, setTournament] =
    useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>(
    [],
  );
  const [heroBans, setHeroBans] = useState<Record<number, number>>({});
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "matches" | "teams" | "player-stats" | "gallery"
  >("overview");
  const [showEditModal, setShowEditModal] = useState(false);
  const [showEditTeamModal, setShowEditTeamModal] =
    useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] =
    useState(false);
  const [showEditMatchModal, setShowEditMatchModal] =
    useState(false);
  const [showCreateMatchModal, setShowCreateMatchModal] =
    useState(false);
  const [showAwardAchievementModal, setShowAwardAchievementModal] =
    useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(
    null,
  );
  const [selectedMatch, setSelectedMatch] =
    useState<Match | null>(null);
  const [scraping, setScraping] = useState(false);
  const [addingMatch, setAddingMatch] = useState(false);
  const [matchIdInput, setMatchIdInput] = useState("");
  const [showAddMatchModal, setShowAddMatchModal] =
    useState(false);
  const [teamRosters, setTeamRosters] = useState<
    Record<string, RosterEntry[]>
  >({});
  const [loadingRosters, setLoadingRosters] = useState(false);
  const [enrichingMatches, setEnrichingMatches] =
    useState(false);
  const [fixingHeroNames, setFixingHeroNames] = useState(false);

  // Gallery state
  const [galleryImages, setGalleryImages] = useState<{ name: string; url: string }[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryLoaded, setGalleryLoaded] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    fetchCurrentUser();
    fetchTournamentData();
  }, [id]);

  const fetchCurrentUser = async () => {
    try {
      const token = localStorage.getItem("supabase_token");
      if (!token) return;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/auth/me`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
      }
    } catch (error) {
      console.error("Error fetching current user:", error);
    }
  };

  const fetchTournamentData = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/${id}`,
        {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        },
      );

      if (!response.ok) {
        throw new Error("Failed to fetch tournament data");
      }

      const data = await response.json();
      console.log("✅ Tournament data loaded:", data);
      setTournament(data.tournament);
      setTeams(data.teams || []);
      setMatches(data.matches || []);
      setPlayerStats(data.player_stats || []);
      setHeroBans(data.hero_bans || {});
    } catch (error) {
      console.error("Error fetching tournament:", error);
      toast.error("Failed to load tournament data");
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamRosters = async () => {
    if (!id || teams.length === 0) return;

    try {
      setLoadingRosters(true);
      const rostersData: Record<string, RosterEntry[]> = {};

      // Fetch rosters for all teams in parallel
      await Promise.all(
        teams.map(async (team) => {
          try {
            const response = await fetch(
              `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/tournament/${id}/team/${team.id}/roster`,
              {
                headers: {
                  Authorization: `Bearer ${publicAnonKey}`,
                },
              },
            );

            if (response.ok) {
              const data = await response.json();
              rostersData[team.id] = data.roster || [];
            }
          } catch (error) {
            console.error(
              `Error fetching roster for team ${team.id}:`,
              error,
            );
          }
        }),
      );

      setTeamRosters(rostersData);
    } catch (error) {
      console.error("Error fetching team rosters:", error);
    } finally {
      setLoadingRosters(false);
    }
  };

  // Fetch rosters when teams data is available and when switching to Teams or Matches tab
  useEffect(() => {
    if (
      (activeTab === "teams" || activeTab === "matches") &&
      teams.length > 0 &&
      Object.keys(teamRosters).length === 0
    ) {
      fetchTeamRosters();
    }
  }, [activeTab, teams]);

  // Fetch gallery images when switching to Gallery tab
  useEffect(() => {
    if (activeTab === "gallery" && !galleryLoaded && tournament) {
      const kkupNumber = getKKupNumber(tournament);
      if (!kkupNumber) {
        setGalleryLoaded(true);
        return;
      }

      const fetchGallery = async () => {
        setGalleryLoading(true);
        try {
          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/storage/list?path=kkup${kkupNumber}`,
            { headers: { Authorization: `Bearer ${publicAnonKey}` } }
          );

          if (!response.ok) throw new Error("Failed to fetch gallery");

          const data = await response.json();
          const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
          // Filter to only image files, exclude known league assets and .emptyFolderPlaceholder
          const excludeNames = new Set([
            'league_banner.png', 'league_large_icon.png', 'league_square_icon.png',
            '.emptyFolderPlaceholder'
          ]);
          const images = (data.files || data || [])
            .filter((f: any) => {
              if (f.isFolder || excludeNames.has(f.name)) return false;
              const lower = f.name.toLowerCase();
              return imageExtensions.some(ext => lower.endsWith(ext));
            })
            .map((f: any) => ({ name: f.name, url: f.url }));

          setGalleryImages(images);
        } catch (error) {
          console.error("Error fetching gallery:", error);
          toast.error("Failed to load gallery images");
        } finally {
          setGalleryLoading(false);
          setGalleryLoaded(true);
        }
      };

      fetchGallery();
    }
  }, [activeTab, tournament, galleryLoaded]);

  const handleScrapeData = async () => {
    if (!tournament?.league_id) {
      toast.error(
        "This tournament does not have a League ID - cannot scrape data",
      );
      return;
    }

    try {
      setScraping(true);
      toast.info(
        "🌽 Starting scrape from OpenDota... This may take a minute!",
        {
          duration: 3000,
        },
      );
      const token = localStorage.getItem("supabase_token");

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/scrape/${id}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to scrape data");
      }

      const data = await response.json();
      toast.success(
        `✅ ${data.message || "Scrape complete!"}`,
        {
          description: `Scraped ${data.matches_scraped} matches, ${data.players_created} players, ${data.stats_created} stats`,
        },
      );

      // Refresh data
      setTimeout(() => {
        fetchTournamentData();
      }, 1000);
    } catch (error: any) {
      console.error("Scrape error:", error);
      toast.error(
        error.message || "Failed to scrape tournament data",
      );
    } finally {
      setScraping(false);
    }
  };

  const handleAddMatch = async () => {
    if (!matchIdInput || isNaN(Number(matchIdInput))) {
      toast.error(
        "Please enter a valid Match ID (number only)",
      );
      return;
    }

    try {
      setAddingMatch(true);
      toast.info("🌽 Adding match from OpenDota...");
      const token = localStorage.getItem("supabase_token");

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/${id}/add-match`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ match_id: matchIdInput }),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add match");
      }

      const data = await response.json();
      toast.success(`✅ ${data.message}`, {
        description: `Added ${data.stats_created} player stats`,
      });

      setShowAddMatchModal(false);
      setMatchIdInput("");

      // Refresh data
      setTimeout(() => {
        fetchTournamentData();
      }, 1000);
    } catch (error: any) {
      console.error("Add match error:", error);
      toast.error(error.message || "Failed to add match");
    } finally {
      setAddingMatch(false);
    }
  };

  const handleEnrichMatches = async () => {
    try {
      setEnrichingMatches(true);
      toast.info(
        "🌽 Fetching match details from OpenDota... This may take a minute!",
        {
          duration: 3000,
        },
      );
      const token = localStorage.getItem("supabase_token");

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/${id}/enrich-matches`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error || "Failed to enrich matches",
        );
      }

      const data = await response.json();
      toast.success(`✅ ${data.message}`, {
        description: `Successfully enriched ${data.enriched} matches with scores and player data!`,
      });

      // Refresh data
      setTimeout(() => {
        fetchTournamentData();
      }, 1000);
    } catch (error: any) {
      console.error("Enrich matches error:", error);
      toast.error(error.message || "Failed to enrich matches");
    } finally {
      setEnrichingMatches(false);
    }
  };

  const handleFixHeroNames = async () => {
    try {
      setFixingHeroNames(true);
      toast.info(
        "🛠️ Fixing hero names... This may take a minute!",
        {
          duration: 3000,
        },
      );
      const token = localStorage.getItem("supabase_token");

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/fix-hero-names`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error || "Failed to fix hero names",
        );
      }

      const data = await response.json();
      toast.success(`✅ ${data.message}`, {
        description: `Successfully updated ${data.updated} hero names!`,
      });

      // Refresh data
      setTimeout(() => {
        fetchTournamentData();
      }, 1000);
    } catch (error: any) {
      console.error("Fix hero names error:", error);
      toast.error(error.message || "Failed to fix hero names");
    } finally {
      setFixingHeroNames(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "TBA";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const getKDA = (k: number, d: number, a: number) => {
    const kda = d === 0 ? k + a : (k + a) / d;
    return kda.toFixed(2);
  };

  if (loading) {
    return (
      <div className="pt-16 sm:pt-20 pb-20 sm:pb-24 px-4 min-h-screen bg-[#fdf5e9]">
        <div className="max-w-7xl mx-auto flex items-center justify-center py-20">
          <Loader2 className="w-12 h-12 text-[#f97316] animate-spin" />
        </div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="pt-16 sm:pt-20 pb-20 sm:pb-24 px-4 min-h-screen bg-[#fdf5e9]">
        <div className="max-w-4xl mx-auto text-center py-20">
          <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 p-12">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-[#f97316]" />
            <h1 className="text-2xl font-bold text-[#0f172a] mb-4">
              Tournament Not Found
            </h1>
            <Button
              onClick={() =>
                (window.location.hash = "#kernel-kup")
              }
              className="bg-[#f97316] hover:bg-[#ea580c] text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Kernel Kup
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isOwner = currentUser?.role === "owner";

  // Compute league asset URLs
  const leagueBannerUrl = getLeagueAssetUrl(tournament, 'banner');
  const leagueLargeIconUrl = getLeagueAssetUrl(tournament, 'large_icon');

  return (
    <div className="pt-16 sm:pt-20 pb-20 sm:pb-24 px-4 min-h-screen bg-[#fdf5e9]">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="space-y-4">
          <Button
            onClick={() =>
              (window.location.hash = "#kernel-kup")
            }
            className="bg-white hover:bg-[#0f172a]/5 text-[#0f172a] border-2 border-[#0f172a]/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Kernel Kup
          </Button>

          <div
            className="relative bg-gradient-to-br from-[#f97316] to-[#ea580c] rounded-3xl p-8 sm:p-12 overflow-hidden"
            style={
              leagueBannerUrl
                ? {
                    backgroundImage: `url(${leagueBannerUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : undefined
            }
          >
            {/* Dark overlay for better text readability when using banner image */}
            {leagueBannerUrl && (
              <div className="absolute inset-0 bg-gradient-to-br from-black/60 to-black/40" />
            )}

            <div className="relative z-10 flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-4">
                  <Crown className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                  <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white drop-shadow-lg">
                    {tournament.name}
                  </h1>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  <span
                    className={`px-4 py-1.5 rounded-full text-sm font-bold backdrop-blur-sm ${
                      tournament.status === "completed"
                        ? "bg-white/20 text-white"
                        : "bg-[#10b981] text-white"
                    }`}
                  >
                    {tournament.status === "completed"
                      ? "🏆 Completed"
                      : "⚡ " + tournament.status}
                  </span>
                  {tournament.league_id && (
                    <span className="px-4 py-1.5 rounded-full text-sm font-bold bg-white/20 backdrop-blur-sm text-white">
                      League ID: {tournament.league_id}
                    </span>
                  )}
                </div>
                <p className="text-white/90 text-lg max-w-2xl drop-shadow-md">
                  {tournament.description ||
                    "The Corn Field's annual Dota 2 championship tournament"}
                </p>
              </div>

              {isOwner && (
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => setShowEditModal(true)}
                    className="bg-white text-[#f97316] hover:bg-white/90 font-bold"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Tournament
                  </Button>
                  {tournament.league_id && (
                    <Button
                      onClick={() =>
                        window.open(
                          `https://www.dotabuff.com/esports/leagues/${tournament.league_id}`,
                          "_blank",
                        )
                      }
                      className="bg-[#3b82f6] hover:bg-[#2563eb] text-white font-bold"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View on Dotabuff
                    </Button>
                  )}
                  {tournament.youtube_playlist_url && (
                    <Button
                      onClick={() => window.open(tournament.youtube_playlist_url, "_blank")}
                      className="bg-[#ff0000] hover:bg-[#cc0000] text-white font-bold"
                    >
                      <Youtube className="w-4 h-4 mr-2" />
                      Watch on YouTube
                    </Button>
                  )}
                  {tournament.twitch_channel && (
                    <Button
                      onClick={() =>
                        window.open(
                          `https://twitch.tv/${tournament.twitch_channel}`,
                          "_blank",
                        )
                      }
                      className="bg-[#9146ff] hover:bg-[#7d3fd8] text-white font-bold"
                    >
                      <TwitchIcon className="w-4 h-4 mr-2" />
                      Watch on Twitch
                    </Button>
                  )}
                  {tournament.youtube_url && (
                    <Button
                      onClick={() => window.open(tournament.youtube_url!, "_blank")}
                      className="bg-[#ff0000] hover:bg-[#cc0000] text-white font-bold"
                    >
                      <Youtube className="w-4 h-4 mr-2" />
                      KKUP Movie
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl border-2 border-[#0f172a]/10 p-2">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
            {(
              [
                "overview",
                "matches",
                "teams",
                "player-stats",
                "gallery"
              ] as const
            ).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-bold text-sm sm:text-base transition-all ${
                  activeTab === tab
                    ? "bg-[#f97316] text-white"
                    : "bg-transparent text-[#0f172a]/60 hover:bg-[#0f172a]/5"
                }`}
              >
                {tab === "player-stats" ? "Players" : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-6 border-2 border-[#0f172a]/10">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-5 h-5 text-[#f97316]" />
              <span className="text-sm font-semibold text-[#0f172a]/60">
                Tournament Dates
              </span>
            </div>
            <p className="text-[#0f172a] font-bold">
              {formatDate(tournament.tournament_start_date)}
            </p>
            <p className="text-[#0f172a]/60 text-sm">
              to {formatDate(tournament.tournament_end_date)}
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 border-2 border-[#0f172a]/10">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5 text-[#f97316]" />
              <span className="text-sm font-semibold text-[#0f172a]/60">
                Prize Pool
              </span>
            </div>
            <p className="text-[#0f172a] font-bold">
              {tournament.prize_pool || "TBA"}
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 border-2 border-[#0f172a]/10">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-[#f97316]" />
              <span className="text-sm font-semibold text-[#0f172a]/60">
                Teams
              </span>
            </div>
            <p className="text-[#0f172a] font-bold">
              {teams.length} Teams
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 border-2 border-[#0f172a]/10">
            <div className="flex items-center gap-2 mb-2">
              <Swords className="w-5 h-5 text-[#f97316]" />
              <span className="text-sm font-semibold text-[#0f172a]/60">
                Matches
              </span>
            </div>
            <p className="text-[#0f172a] font-bold">
              {matches.length} Matches
            </p>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {teams.length > 0 && (
              <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Crown className="w-6 h-6 text-[#f97316]" />
                  <h2 className="text-2xl font-bold text-[#0f172a]">
                    Final Standings
                  </h2>
                </div>
                <div className="space-y-3">
                  {teams.map((team, index) => (
                    <button
                      key={team.id}
                      onClick={() => setActiveTab("teams")}
                      className={`w-full flex flex-col sm:flex-row items-center justify-between rounded-xl border-2 transition-all cursor-pointer gap-3 sm:gap-0 ${
                        index === 0
                          ? "bg-gradient-to-r from-[#f97316]/10 to-[#ea580c]/10 border-[#f97316] shadow-[0_0_30px_rgba(249,115,22,0.3)] hover:shadow-[0_0_40px_rgba(249,115,22,0.5)] p-4 sm:p-6"
                          : "bg-[#fdf5e9] border-[#0f172a]/10 hover:border-[#f97316]/50 hover:bg-[#f97316]/5 p-3 sm:p-4"
                      }`}
                    >
                      <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                        {index === 0 && (
                          <Crown className="w-8 h-8 sm:w-10 sm:h-10 text-[#f97316] animate-pulse" />
                        )}
                        <span
                          className={`font-black ${
                            index === 0
                              ? "text-2xl sm:text-3xl text-[#f97316]"
                              : "text-xl sm:text-2xl text-[#0f172a]/40"
                          }`}
                        >
                          #{index + 1}
                        </span>
                        <TeamLogo
                          logoUrl={team.logo_url}
                          teamName={team.name}
                          size={index === 0 ? "lg" : "md"}
                        />
                        <div className="text-left flex-1 min-w-0">
                          <p className={`font-bold truncate ${index === 0 ? "text-xl sm:text-2xl text-[#0f172a]" : "text-base sm:text-lg text-[#0f172a]"}`}>
                            {team.name}
                          </p>
                          {index === 0 && (
                            <p className="text-xs sm:text-sm font-bold text-[#f97316] mt-1">
                              🏆 Kernel Kup Champions
                            </p>
                          )}
                          {team.tag && (
                            <p className={`text-[#0f172a]/60 truncate ${index === 0 ? "text-sm sm:text-base" : "text-xs sm:text-sm"}`}>
                              {team.tag}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:gap-6">
                        {/* Matches (Games) */}
                        <div className="text-center">
                          <p className={`text-[#0f172a]/60 font-semibold mb-1 ${index === 0 ? "text-xs sm:text-sm" : "text-[10px] sm:text-xs"}`}>Matches</p>
                          <p className={`font-bold text-[#0f172a] ${index === 0 ? "text-lg sm:text-xl" : "text-base sm:text-lg"}`}>
                            {team.game_wins !== undefined ? `${team.game_wins}-${team.game_losses}` : `${team.wins}-${team.losses}`}
                          </p>
                        </div>
                        
                        {/* Series */}
                        <div className={`text-center border-x-2 border-[#0f172a]/10 ${index === 0 ? "px-3 sm:px-6" : "px-2 sm:px-4"}`}>
                          <p className={`text-[#0f172a]/60 font-semibold mb-1 ${index === 0 ? "text-xs sm:text-sm" : "text-[10px] sm:text-xs"}`}>Series</p>
                          <p className={`font-bold text-[#f97316] ${index === 0 ? "text-lg sm:text-xl" : "text-base sm:text-lg"}`}>
                            {team.series_wins !== undefined ? `${team.series_wins}-${team.series_losses}` : `-`}
                          </p>
                        </div>
                        
                        {/* Score (Total Kills) */}
                        <div className="text-center">
                          <p className={`text-[#0f172a]/60 font-semibold mb-1 ${index === 0 ? "text-xs sm:text-sm" : "text-[10px] sm:text-xs"}`}>Score</p>
                          <p className={`font-bold text-[#0f172a] ${index === 0 ? "text-lg sm:text-xl" : "text-base sm:text-lg"}`}>
                            {team.total_kills !== undefined ? team.total_kills : `-`}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Top Players */}
            {playerStats.length > 0 && (
              <TournamentTopPlayers 
                playerStats={playerStats} 
                onPlayerClick={(playerName) => {
                  setActiveTab('player-stats');
                  // Optionally scroll to top after tab change
                  setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
                }} 
              />
            )}

            {/* Popular Heroes */}
            {playerStats.length > 0 && (
              <TournamentHeroStats playerStats={playerStats} heroBans={heroBans} />
            )}

            {/* Kernel Kup Movie */}
            {(() => {
              // Fallback map for tournaments that don't have the URL stored in the DB yet
              const kkupMovieFallback: Record<string, string> = {
                '2': '909f42A5Dyg',
                '3': 'aLZYOv48xXI',
                '4': 'xBGhqw_aYFM',
                '5': 'sVkCKgnzLME',
                '7': 'oOpod0s_nTw',
                '9': '6PSUxXCszu0',
              };

              // Extract YouTube video ID from a URL
              const extractVideoId = (url: string): string | null => {
                const patterns = [
                  /youtube\.com\/embed\/([^?&/]+)/,
                  /youtube\.com\/watch\?v=([^&]+)/,
                  /youtu\.be\/([^?&/]+)/,
                  /youtube\.com\/v\/([^?&/]+)/,
                ];
                for (const pattern of patterns) {
                  const match = url.match(pattern);
                  if (match) return match[1];
                }
                return null;
              };

              const kkNum = getKKupNumber(tournament);

              // Try youtube_url first, then youtube_playlist_url, then fallback map
              let videoId: string | null = null;
              if (tournament.youtube_url) {
                videoId = extractVideoId(tournament.youtube_url);
              }
              if (!videoId && tournament.youtube_playlist_url) {
                videoId = extractVideoId(tournament.youtube_playlist_url);
              }
              if (!videoId && kkNum) {
                videoId = kkupMovieFallback[kkNum] || null;
              }

              if (!videoId) return null;
              return (
                <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <Youtube className="w-6 h-6 text-[#ff0000]" />
                    <h2 className="text-2xl font-bold text-[#0f172a]">
                      Kernel Kup {kkNum} Movie
                    </h2>
                  </div>
                  <div className="relative w-full overflow-hidden rounded-xl" style={{ paddingBottom: '56.25%' }}>
                    <iframe
                      className="absolute inset-0 w-full h-full"
                      src={`https://www.youtube.com/embed/${videoId}`}
                      title={`Kernel Kup ${kkNum} Movie`}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                  </div>
                </div>
              );
            })()}

            {teams.length === 0 && matches.length === 0 && (
              <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 p-12 text-center">
                <Trophy className="w-16 h-16 mx-auto mb-4 text-[#0f172a]/20" />
                <h3 className="text-xl font-bold text-[#0f172a] mb-2">
                  No Data Yet
                </h3>
                <p className="text-[#0f172a]/60">
                  Tournament data will appear here once matches
                  are played
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === "teams" && (
          <div className="space-y-6">
            {teams.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 p-12 text-center">
                <Users className="w-16 h-16 mx-auto mb-4 text-[#0f172a]/20" />
                <p className="text-[#0f172a]/60 mb-4">
                  No team data available yet
                </p>
              </div>
            ) : (
              teams.map((team) => {
                // Calculate top 3 heroes for this team
                const teamStats = playerStats.filter(
                  (stat) => stat.team?.id === team.id,
                );
                const heroCount = new Map<
                  string,
                  { name: string; count: number; wins: number }
                >();

                teamStats.forEach((stat) => {
                  const heroKey = stat.hero_name;
                  if (!heroCount.has(heroKey)) {
                    heroCount.set(heroKey, {
                      name: stat.hero_name,
                      count: 0,
                      wins: 0,
                    });
                  }
                  const hero = heroCount.get(heroKey)!;
                  hero.count++;
                  if (stat.is_winner) hero.wins++;
                });

                const topHeroes = Array.from(heroCount.values())
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 3);

                return (
                  <div
                    key={team.id}
                    className="bg-white rounded-xl border-2 border-[#0f172a]/10 overflow-hidden"
                  >
                    <div className="bg-gradient-to-r from-[#0f172a] to-[#1e293b] p-4 flex items-center gap-4">
                      <TeamLogo
                        logoUrl={team.logo_url}
                        teamName={team.name}
                        size="lg"
                      />
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white">
                          {team.name}
                        </h3>
                        {team.tag && (
                          <p className="text-white/70">
                            {team.tag}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-6">
                          {/* Matches (Games) */}
                          <div className="text-center">
                            <p className="text-xs text-white/70 font-semibold mb-1">Matches</p>
                            <p className="text-lg font-bold text-white">
                              {team.game_wins !== undefined ? `${team.game_wins}-${team.game_losses}` : `${team.wins}-${team.losses}`}
                            </p>
                          </div>
                          
                          {/* Series */}
                          <div className="text-center px-4 border-x-2 border-white/20">
                            <p className="text-xs text-white/70 font-semibold mb-1">Series</p>
                            <p className="text-lg font-bold text-[#f97316]">
                              {team.series_wins !== undefined ? `${team.series_wins}-${team.series_losses}` : `-`}
                            </p>
                          </div>
                          
                          {/* Score (Total Kills) */}
                          <div className="text-center">
                            <p className="text-xs text-white/70 font-semibold mb-1">Score</p>
                            <p className="text-lg font-bold text-white">
                              {team.total_kills !== undefined ? team.total_kills : `-`}
                            </p>
                          </div>
                        </div>
                      </div>
                      {isOwner && (
                        <Button
                          size="sm"
                          className="bg-white/10 hover:bg-white/20 text-white border-2 border-white/20"
                          onClick={() => {
                            setSelectedTeam(team);
                            setShowEditTeamModal(true);
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    {/* Top 3 Heroes Section */}
                    {topHeroes.length > 0 && (
                      <div className="p-4 border-b-2 border-[#0f172a]/10">
                        <h4 className="text-sm font-bold text-[#0f172a]/60 mb-3 uppercase tracking-wide">
                          Top Heroes
                        </h4>
                        <div className="grid grid-cols-3 gap-3">
                          {topHeroes.map((hero, index) => {
                            // Use the centralized getHeroImageUrl function
                            const teamStats = playerStats.filter(
                              (stat) => stat.team?.id === team.id && stat.hero_name === hero.name,
                            );
                            const heroId = teamStats[0]?.hero_id;
                            const heroImageUrl = heroId ? getHeroImageUrl(heroId) : null;
                            const winRate =
                              hero.count > 0
                                ? (
                                    (hero.wins / hero.count) *
                                    100
                                  ).toFixed(0)
                                : "0";

                            return (
                              <div
                                key={hero.name}
                                className="relative bg-gradient-to-br from-[#0f172a] to-[#1e293b] rounded-lg overflow-hidden border-2 border-[#f97316]/20 group hover:border-[#f97316] transition-all"
                              >
                                {heroImageUrl && (
                                  <img
                                    src={heroImageUrl}
                                    alt={hero.name}
                                    className="w-full aspect-video object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                                    onError={(e) => {
                                      // Fallback if image fails to load
                                      e.currentTarget.style.display =
                                        "none";
                                    }}
                                  />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                                <div className="absolute bottom-0 left-0 right-0 p-2">
                                  <p className="text-white font-bold text-xs truncate">
                                    {hero.name}
                                  </p>
                                  <div className="flex items-center justify-between">
                                    <p className="text-[#f97316] font-bold text-xs">
                                      {hero.count} picks
                                    </p>
                                    <p className="text-white/80 text-xs">
                                      {winRate}% WR
                                    </p>
                                  </div>
                                </div>
                                {index === 0 && (
                                  <div className="absolute top-2 right-2 bg-[#f97316] text-white text-xs font-black px-2 py-1 rounded">
                                    #1
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Roster Section */}
                    {loadingRosters ? (
                      <div className="pt-4 border-t-2 border-[#0f172a]/10 flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 text-[#f97316] animate-spin" />
                      </div>
                    ) : teamRosters[team.id] &&
                      teamRosters[team.id].length > 0 ? (
                      <div className="p-4">
                        <h4 className="text-sm font-bold text-[#0f172a]/60 mb-3 uppercase tracking-wide">
                          Roster ({teamRosters[team.id].length}{" "}
                          Players)
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {teamRosters[team.id].map(
                            (rosterEntry) => (
                              <button
                                key={rosterEntry.id}
                                onClick={() => {
                                  setActiveTab('player-stats');
                                  setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
                                }}
                                className="flex flex-col items-center gap-3 p-3 bg-[#fdf5e9] rounded-lg border-2 border-[#0f172a]/10 hover:border-[#f97316] hover:bg-[#f97316]/5 transition-all cursor-pointer"
                              >
                                {rosterEntry.player
                                  .avatar_url ? (
                                  <img
                                    src={
                                      rosterEntry.player
                                        .avatar_url
                                    }
                                    alt={
                                      rosterEntry.player
                                        .player_name
                                    }
                                    className="w-12 h-12 rounded-full border-2 border-[#f97316]/20"
                                  />
                                ) : (
                                  <div className="w-12 h-12 rounded-full bg-[#f97316]/20 flex items-center justify-center">
                                    <Users className="w-6 h-6 text-[#f97316]" />
                                  </div>
                                )}
                                <div className="flex-1 min-w-0 w-full text-center">
                                  <p className="font-bold text-[#0f172a] text-sm truncate">
                                    {
                                      rosterEntry.player
                                        .name || rosterEntry.player.player_name
                                    }
                                  </p>
                                  
                                  <div className="flex gap-2 mt-1 justify-center">
                                    {rosterEntry.player
                                      .opendota_url && (
                                      <a
                                        href={
                                          rosterEntry.player
                                            .opendota_url
                                        }
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-[#f97316] hover:underline"
                                        onClick={(e) =>
                                          e.stopPropagation()
                                        }
                                      >
                                        OpenDota
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </button>
                            ),
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="pt-4 border-t-2 border-[#0f172a]/10 text-center py-6">
                        <Users className="w-8 h-8 mx-auto mb-2 text-[#0f172a]/20" />
                        <p className="text-sm text-[#0f172a]/40">
                          No roster data available
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === "matches" && (
          <div className="space-y-6">
            {matches.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 p-12 text-center">
                <Swords className="w-16 h-16 mx-auto mb-4 text-[#0f172a]/20" />
                <p className="text-[#0f172a]/60">
                  No match data available yet
                </p>
              </div>
            ) : (
              matches.map((match) => {
                // Filter player stats for this match
                const matchStats = playerStats.filter(
                  (s) => s.match_id === match.id,
                );
                return (
                  <MatchCardWithHeroes
                    key={match.id}
                    match={match}
                    playerStats={matchStats}
                    team1Roster={teamRosters[match.team1_id] || []}
                    team2Roster={teamRosters[match.team2_id] || []}
                    isOwner={isOwner}
                    onEdit={() => {
                      setSelectedMatch(match);
                      setShowEditMatchModal(true);
                    }}
                  />
                );
              })
            )}
          </div>
        )}

        {activeTab === "player-stats" && (
          <div className="space-y-4">
            {playerStats.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 p-12 text-center">
                <Target className="w-16 h-16 mx-auto mb-4 text-[#0f172a]/20" />
                <p className="text-[#0f172a]/60">
                  No player stats available yet
                </p>
              </div>
            ) : (
              <AggregatedPlayerStats stats={playerStats} />
            )}
          </div>
        )}

        {activeTab === "gallery" && (
          <div className="space-y-4">
            {galleryLoading ? (
              <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 p-12 text-center">
                <Loader2 className="w-16 h-16 mx-auto mb-4 text-[#0f172a]/20 animate-spin" />
                <p className="text-[#0f172a]/60">
                  Loading gallery images...
                </p>
              </div>
            ) : galleryLoaded && galleryImages.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 p-12 text-center">
                <ImageIcon className="w-16 h-16 mx-auto mb-4 text-[#0f172a]/20" />
                <p className="text-[#0f172a]/60">
                  No gallery images available yet
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {galleryImages.map((image, index) => (
                    <div
                      key={index}
                      className="relative"
                      onClick={() => setLightboxIndex(index)}
                    >
                      <img
                        src={image.url}
                        alt={image.name}
                        className="w-full h-full object-cover rounded-lg cursor-pointer"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-sm p-2">
                        {image.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {showEditModal && (
        <EditTournamentModal
          tournament={tournament}
          onClose={() => setShowEditModal(false)}
          onSave={fetchTournamentData}
        />
      )}

      {/* Add Match Modal */}
      {showAddMatchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-[#0f172a]">
                Add Match Manually
              </h2>
              <button
                onClick={() => {
                  setShowAddMatchModal(false);
                  setMatchIdInput("");
                }}
                className="text-[#0f172a]/60 hover:text-[#0f172a]"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#0f172a] mb-2">
                  Dota 2 Match ID
                </label>
                <input
                  type="text"
                  value={matchIdInput}
                  onChange={(e) =>
                    setMatchIdInput(e.target.value)
                  }
                  placeholder="e.g., 7891234567"
                  className="w-full px-4 py-3 border-2 border-[#0f172a]/10 rounded-lg focus:outline-none focus:border-[#f97316] text-[#0f172a]"
                />
                <p className="text-sm text-[#0f172a]/60 mt-2">
                  Enter the Match ID from Dotabuff or OpenDota.
                  The match will be fetched from OpenDota and
                  added to this tournament.
                </p>
                <p className="text-xs text-[#0f172a]/40 mt-1">
                  💡 Tip: Works with both professional matches
                  and amateur lobby matches!
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    setShowAddMatchModal(false);
                    setMatchIdInput("");
                  }}
                  className="flex-1 bg-white hover:bg-[#0f172a]/5 text-[#0f172a] border-2 border-[#0f172a]/10"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddMatch}
                  disabled={addingMatch || !matchIdInput}
                  className="flex-1 bg-[#f97316] hover:bg-[#ea580c] text-white"
                >
                  {addingMatch ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Match
                    </>
                  )}
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
          tournamentId={id!}
          onClose={() => setShowEditTeamModal(false)}
          onSave={fetchTournamentData}
        />
      )}

      {/* Create Team Modal */}
      {showCreateTeamModal && (
        <CreateTeamModal
          tournamentId={id!}
          onClose={() => setShowCreateTeamModal(false)}
          onSave={fetchTournamentData}
        />
      )}

      {/* Edit Match Modal */}
      {showEditMatchModal && selectedMatch && (
        <EditMatchModal
          match={selectedMatch}
          tournamentId={id!}
          availableTeams={teams}
          onClose={() => setShowEditMatchModal(false)}
          onSave={fetchTournamentData}
        />
      )}

      {/* Create Match Modal */}
      {showCreateMatchModal && (
        <CreateMatchModal
          tournamentId={id!}
          availableTeams={teams}
          onClose={() => setShowCreateMatchModal(false)}
          onSave={fetchTournamentData}
        />
      )}

      {/* Award Achievement Modal */}
      {showAwardAchievementModal && (
        <AwardAchievementModal
          tournamentId={id!}
          onClose={() => setShowAwardAchievementModal(false)}
          onSave={fetchTournamentData}
        />
      )}

      {/* Gallery Lightbox */}
      {lightboxIndex !== null && galleryImages.length > 0 && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white z-10"
            onClick={() => setLightboxIndex(null)}
          >
            <X className="w-8 h-8" />
          </button>

          {galleryImages.length > 1 && (
            <>
              <button
                className="absolute left-4 text-white/80 hover:text-white z-10 bg-black/40 hover:bg-black/60 rounded-full p-2"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((lightboxIndex - 1 + galleryImages.length) % galleryImages.length);
                }}
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button
                className="absolute right-4 text-white/80 hover:text-white z-10 bg-black/40 hover:bg-black/60 rounded-full p-2"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((lightboxIndex + 1) % galleryImages.length);
                }}
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </>
          )}

          <div
            className="max-w-[90vw] max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={galleryImages[lightboxIndex].url}
              alt={galleryImages[lightboxIndex].name}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            <p className="text-white/80 text-sm mt-3 text-center">
              {galleryImages[lightboxIndex].name}
              <span className="text-white/40 ml-2">
                ({lightboxIndex + 1} / {galleryImages.length})
              </span>
            </p>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}