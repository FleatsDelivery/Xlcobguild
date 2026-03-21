/**
 * Tournament Staff Tab - Displays staff members grouped by stream assignment
 *
 * Shows tournament staff with avatars, role badges, TCF+ status, grouped by stream.
 * TCF+ flair uses TcfPlusAvatarRing — the same canonical component used on the
 * profile page, leaderboard, home page, and nav sidebar.
 */

import { useState, useEffect } from 'react';
import { Users, Eye, ExternalLink } from 'lucide-react';
import { useTournament } from '@/app/contexts/tournament-context';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { TwitchIcon } from '@/lib/icons';
import { TcfPlusAvatarRing } from '@/app/components/tcf-plus-avatar-ring';
import { Footer } from '@/app/components/footer';
import { TabNoData } from '@/app/components/tab-no-data';

interface StaffMember {
  id: string;
  person_id: string;
  name: string;
  avatar: string | null;
  role: string;
  tcf_plus: boolean;
  twitch_username: string | null;
  twitch_avatar: string | null;
}

interface Stream {
  name: string;
  staff: StaffMember[];
}

interface StaffData {
  streams: Stream[];
}

export function TournamentStaffTab() {
  const { tournament } = useTournament();
  const [staffData, setStaffData] = useState<StaffData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tournament) return;
    // I1 — Upcoming: staff hasn't been assigned yet, skip fetch
    if (tournament.status === 'upcoming') return;

    const fetchStaff = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/tournaments/${tournament.id}/staff-roster`,
          {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
            },
          }
        );

        if (!res.ok) {
          throw new Error('Failed to fetch staff data');
        }

        const data = await res.json();
        console.log('🌽 Staff Tab: Received data from backend:', data);
        setStaffData(data);
      } catch (err) {
        console.error('Error fetching staff:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchStaff();
  }, [tournament?.id]);

  if (!tournament) return null;

  // I1 — Upcoming phase: no staff assigned yet
  if (tournament.status === 'upcoming') {
    return (
      <>
        <TabNoData
          icon={Users}
          title="No Staff Data Available"
          subtitle="Staff assignments haven't been made yet. The broadcast team and tournament staff will appear here once they've been assigned."
          hint="Available from: Registration Open"
        />
        <Footer />
      </>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 sm:py-16">
        <div className="w-12 h-12 border-4 border-harvest/30 border-t-harvest rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card rounded-2xl border-2 border-error/20 p-6 sm:p-8 text-center">
        <p className="text-error font-semibold mb-2">Failed to load staff data</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!staffData || !staffData.streams || staffData.streams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 sm:py-16">
        <Users className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground mb-4" />
        <p className="text-base sm:text-lg text-muted-foreground">No staff data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {staffData.streams.map((stream) => {
        const twitchChannel = stream.name.toLowerCase().replace(/\s+/g, '');
        const twitchUrl = `https://twitch.tv/${twitchChannel}`;
        const isUnassigned = stream.name === 'Unassigned';

        return (
          <div
            key={stream.name}
            className={`bg-card rounded-2xl border-2 p-4 sm:p-6 ${
              isUnassigned
                ? 'border-border'
                : 'border-[#9146FF]/20 bg-gradient-to-br from-card to-[#9146FF]/5'
            }`}
          >
            {/* Stream Header */}
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isUnassigned ? 'bg-muted' : 'bg-[#9146FF]/10'
              }`}>
                <TwitchIcon className={`w-5 h-5 ${isUnassigned ? 'text-muted-foreground' : 'text-[#9146FF]'}`} />
              </div>
              <h3 className={`text-xl sm:text-2xl font-bold ${
                isUnassigned ? 'text-foreground' : 'text-[#9146FF]'
              }`}>
                {stream.name}
              </h3>

              {!isUnassigned && (
                <a
                  href={twitchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#9146FF] hover:bg-[#772ce8] text-white font-semibold transition-all group"
                  title={`Watch ${stream.name} on Twitch`}
                >
                  <Eye className="w-4 h-4" />
                  <span className="text-sm hidden sm:inline">Watch</span>
                  <ExternalLink className="w-3 h-3 opacity-70 group-hover:opacity-100" />
                </a>
              )}

              <div className="ml-auto text-sm sm:text-base text-muted-foreground">
                {stream.staff.length} {stream.staff.length === 1 ? 'member' : 'members'}
              </div>
            </div>

            {/* Staff Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {stream.staff.map((member) => (
                <div
                  key={member.id}
                  className={`bg-background rounded-xl border-2 p-3 sm:p-4 hover:border-harvest/50 transition-all ${
                    member.tcf_plus ? 'border-harvest/30 shadow-lg shadow-harvest/10' : 'border-border'
                  }`}
                >
                  {/* Avatar + Name row */}
                  <div className="flex items-start gap-3 mb-3">
                    {/* TcfPlusAvatarRing — canonical TCF+ avatar component */}
                    <TcfPlusAvatarRing active={member.tcf_plus} size="sm">
                      {member.avatar ? (
                        <img
                          src={member.avatar}
                          alt={member.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                          <Users className="w-6 h-6 text-muted-foreground" />
                        </div>
                      )}
                    </TcfPlusAvatarRing>

                    {/* Name + optional Twitch icon link */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-foreground truncate text-sm sm:text-base">
                          {member.name}
                        </p>
                        {member.twitch_username && (
                          <a
                            href={`https://twitch.tv/${member.twitch_username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 p-1 rounded hover:bg-[#9146FF]/10 transition-colors group"
                            title={`${member.name} on Twitch: ${member.twitch_username}`}
                          >
                            <TwitchIcon className="w-4 h-4 text-[#9146FF] group-hover:scale-110 transition-transform" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Role Badge */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-husk/10 border border-husk/20">
                    <span className="text-xs sm:text-sm font-semibold text-husk-bright">
                      {member.role}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <Footer />
    </div>
  );
}