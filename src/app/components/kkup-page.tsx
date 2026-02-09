import { useState, useEffect } from 'react';
import { Crown, Calendar, Users, Trophy, Sparkles, ExternalLink, Twitch, Video, User, ChevronDown, ChevronUp, Loader2, AlertCircle, Upload, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { Footer } from '@/app/components/footer';

interface Tournament {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: 'upcoming' | 'registration_open' | 'in_progress' | 'completed';
  max_teams: number;
  registration_deadline: string;
  prize_pool: string;
  format: string;
  rules: string;
  league_id?: number;
  twitch_channel?: string;
  created_at: string;
  updated_at: string;
  league_large_icon_url?: string;
  winning_team?: { tag: string };
}

interface KKUPPageProps {
  user?: any;
}

export function KKUPPage({ user }: KKUPPageProps) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Utility function to extract KKup number from tournament name
  const getKKupNumber = (tournament: any): string | null => {
    if (!tournament) return null;
    
    // Try to extract number from tournament name (e.g., "Kernel Kup 5" -> "5")
    const match = tournament.name.match(/Kernel Kup (\d+)|KKup (\d+)|KKUP (\d+)/i);
    if (match) {
      return match[1] || match[2] || match[3];
    }
    return null;
  };

  // Utility function to generate league asset URL
  const getLeagueAssetUrl = (tournament: any, assetType: 'banner' | 'large_icon' | 'square_icon'): string | null => {
    const kkupNumber = getKKupNumber(tournament);
    if (!kkupNumber) return null;
    
    const filename = assetType === 'banner' ? 'league_banner.png' 
                   : assetType === 'large_icon' ? 'league_large_icon.png'
                   : 'league_square_icon.png';
    
    return `https://${projectId}.supabase.co/storage/v1/object/public/make-4789f4af-kkup-assets/kkup${kkupNumber}/${filename}`;
  };

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/tournaments`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch tournaments');
      }

      const data = await response.json();
      setTournaments(data.tournaments || []);
    } catch (err) {
      console.error('Error fetching tournaments:', err);
      setError('Failed to load tournament data');
    } finally {
      setLoading(false);
    }
  };

  // Find the current/next tournament
  const currentTournament = tournaments.find(t => 
    t.status === 'registration_open' || t.status === 'in_progress'
  ) || tournaments.find(t => t.status === 'upcoming');

  // Past tournaments - sorted by Kernel Kup number descending (newest first)
  const pastTournaments = tournaments
    .filter(t => t.status === 'completed')
    .sort((a, b) => {
      const numA = parseInt(getKKupNumber(a) || '0');
      const numB = parseInt(getKKupNumber(b) || '0');
      return numB - numA; // Descending order (7, 6, 5, 4)
    });

  if (loading) {
    return (
      <div className="pt-16 sm:pt-20 pb-20 sm:pb-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-[#f97316] animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pt-16 sm:pt-20 pb-20 sm:pb-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-2xl border-2 border-[#ef4444]/20 p-6 flex items-center gap-4">
            <AlertCircle className="w-8 h-8 text-[#ef4444]" />
            <div>
              <h3 className="text-lg font-bold text-[#0f172a]">Error Loading Tournaments</h3>
              <p className="text-[#0f172a]/60">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-16 sm:pt-20 pb-20 sm:pb-24 px-4">
      <div className="max-w-7xl mx-auto space-y-8 sm:space-y-12">
        {/* Hero Section with Stickers */}
        <div className="relative bg-gradient-to-br from-[#f97316] to-[#ea580c] rounded-3xl p-8 sm:p-12 shadow-2xl overflow-hidden">
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex-1 text-center sm:text-left">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-4 leading-tight">
                  🌽 Kernel Kup
                </h1>
                <p className="text-xl sm:text-2xl text-white/90 font-semibold mb-6">
                  The Corniest Dota 2 Tournament in North America
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center sm:justify-start">
                  <Button
                    onClick={() => window.location.hash = '#hall-of-fame'}
                    className="bg-white text-[#f97316] hover:bg-white/90 font-bold text-lg px-8 py-6 rounded-xl shadow-lg transition-all hover:scale-105"
                  >
                    <Trophy className="w-5 h-5 mr-2" />
                    🏛️ Hall of Fame
                  </Button>
                  {currentTournament && (
                    <Button
                      onClick={() => window.location.hash = `#kkup/${currentTournament.id}`}
                      className="bg-[#fbbf24] text-[#0f172a] hover:bg-[#fbbf24]/90 font-bold text-lg px-8 py-6 rounded-xl shadow-lg transition-all hover:scale-105"
                    >
                      View Current Tournament
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0">
                <div className="relative">
                  <div className="w-40 h-40 sm:w-48 sm:h-48 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center shadow-2xl border-4 border-white/20">
                    <Trophy className="w-24 h-24 sm:w-32 sm:h-32 text-white" strokeWidth={1.5} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tournament Builder removed - now accessible only via Profile page for Owner/Queen of Hog */}

        {/* Past Tournaments */}
        {pastTournaments.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-[#f97316]" />
              <h2 className="text-3xl font-bold text-[#0f172a]">Tournament History</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {pastTournaments.map((tournament: any) => {
                const leagueLargeIconUrl = getLeagueAssetUrl(tournament, 'large_icon');
                const kkupNumber = getKKupNumber(tournament);
                
                return (
                  <div key={tournament.id} className="space-y-2">
                    {/* Title */}
                    {kkupNumber && (
                      <div className="flex items-center gap-2 px-2">
                        <Trophy className="w-4 h-4 text-[#f97316]" />
                        <h3 className="text-lg font-bold text-[#0f172a]">
                          Kernel Kup {kkupNumber}
                          {tournament.winning_team?.tag && (
                            <span className="text-[#f97316]"> - {tournament.winning_team.tag}</span>
                          )}
                        </h3>
                      </div>
                    )}
                    
                    {/* Card */}
                    <div
                      className="relative rounded-lg sm:rounded-xl overflow-hidden border-2 border-[#0f172a]/10 hover:border-[#f97316] transition-all duration-200 cursor-pointer group hover:scale-105"
                      onClick={() => window.location.hash = `#kkup/${tournament.id}`}
                    >
                      {leagueLargeIconUrl ? (
                        <img
                          src={leagueLargeIconUrl}
                          alt={tournament.name}
                          className="w-full aspect-[3/2] object-cover group-hover:opacity-90 transition-opacity"
                        />
                      ) : (
                        <div className="w-full aspect-[3/2] bg-gradient-to-br from-[#f97316] to-[#ea580c] flex items-center justify-center">
                          <div className="text-center p-4 sm:p-6">
                            <Crown className="w-12 h-12 sm:w-16 sm:h-16 text-white mx-auto mb-2 sm:mb-4" />
                            <h3 className="text-lg sm:text-2xl font-black text-white">{tournament.name}</h3>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Current/Upcoming Tournament */}
        {currentTournament ? (
          <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 overflow-hidden">
            <div className="bg-gradient-to-r from-[#f97316]/10 to-[#ea580c]/10 px-6 py-4 border-b-2 border-[#0f172a]/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Trophy className="w-6 h-6 text-[#f97316]" />
                  <h2 className="text-2xl font-bold text-[#0f172a]">{currentTournament.name}</h2>
                </div>
                <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${
                  currentTournament.status === 'registration_open' 
                    ? 'bg-[#10b981] text-white' 
                    : currentTournament.status === 'in_progress'
                    ? 'bg-[#f97316] text-white'
                    : 'bg-[#0f172a]/10 text-[#0f172a]'
                }`}>
                  {currentTournament.status === 'registration_open' ? '🎉 Registration Open' : 
                   currentTournament.status === 'in_progress' ? '⚡ Live' : 
                   '📅 Coming Soon'}
                </span>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <p className="text-[#0f172a]/70 text-lg leading-relaxed">
                {currentTournament.description}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#f97316]/5 rounded-xl p-4 border-2 border-[#f97316]/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-5 h-5 text-[#f97316]" />
                    <span className="text-sm font-semibold text-[#0f172a]/60">Tournament Dates</span>
                  </div>
                  <p className="text-[#0f172a] font-bold">
                    {new Date(currentTournament.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                  <p className="text-[#0f172a]/60 text-sm">
                    to {new Date(currentTournament.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>

                <div className="bg-[#f97316]/5 rounded-xl p-4 border-2 border-[#f97316]/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-[#f97316]" />
                    <span className="text-sm font-semibold text-[#0f172a]/60">Max Teams</span>
                  </div>
                  <p className="text-[#0f172a] font-bold">{currentTournament.max_teams} Teams</p>
                </div>

                <div className="bg-[#f97316]/5 rounded-xl p-4 border-2 border-[#f97316]/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy className="w-5 h-5 text-[#f97316]" />
                    <span className="text-sm font-semibold text-[#0f172a]/60">Prize Pool</span>
                  </div>
                  <p className="text-[#0f172a] font-bold">{currentTournament.prize_pool}</p>
                </div>

                <div className="bg-[#f97316]/5 rounded-xl p-4 border-2 border-[#f97316]/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-5 h-5 text-[#f97316]" />
                    <span className="text-sm font-semibold text-[#0f172a]/60">Registration Deadline</span>
                  </div>
                  <p className="text-[#0f172a] font-bold">
                    {new Date(currentTournament.registration_deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>

              {currentTournament.format && (
                <div className="bg-[#0f172a]/5 rounded-xl p-5 border-2 border-[#0f172a]/10">
                  <h3 className="font-bold text-[#0f172a] mb-2 flex items-center gap-2">
                    <Video className="w-5 h-5 text-[#f97316]" />
                    Tournament Format
                  </h3>
                  <p className="text-[#0f172a]/70">{currentTournament.format}</p>
                </div>
              )}

              {currentTournament.twitch_channel && (
                <div className="bg-purple-500/10 rounded-xl p-5 border-2 border-purple-500/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Twitch className="w-6 h-6 text-purple-600" />
                      <div>
                        <h3 className="font-bold text-[#0f172a]">Watch Live on Twitch</h3>
                        <p className="text-[#0f172a]/60 text-sm">twitch.tv/{currentTournament.twitch_channel}</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => window.open(`https://twitch.tv/${currentTournament.twitch_channel}`, '_blank')}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Watch Now
                    </Button>
                  </div>
                </div>
              )}

              {currentTournament.status === 'registration_open' && (
                <div className="bg-gradient-to-r from-[#f97316] to-[#ea580c] rounded-2xl p-6 text-center space-y-4">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2">Ready to Compete?</h3>
                    <p className="text-white/90">Use <code className="bg-white/20 px-2 py-1 rounded font-mono">/register</code> in Discord to sign up!</p>
                  </div>
                  <Button
                    className="bg-white text-[#f97316] hover:bg-white/90 font-bold text-lg px-8 py-6"
                  >
                    <User className="w-5 h-5 mr-2" />
                    Registration Instructions
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border-2 border-[#0f172a]/10 p-8 text-center">
            <Trophy className="w-16 h-16 text-[#0f172a]/20 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-[#0f172a] mb-2">No Active Tournament</h2>
            <p className="text-[#0f172a]/60">Check back soon for the next Kernel Kup announcement!</p>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}