import { useEffect, useState, useMemo } from 'react';
import { Swords, Medal, Crown, Search, Eye, Star, Popcorn, Trophy, TrendingUp, Users, Info, ArrowUpRight, Plus, Award } from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { projectId } from '/utils/supabase/info';
import { isOfficer, getRoleDisplayName, getRoleBadgeStyle } from '@/lib/roles';
import { UserProfileModal } from '@/app/components/user-profile-modal';
import { Footer } from '@/app/components/footer';
import { MvpSubmissionModal } from '@/app/components/mvp-submission-modal';
import { TcfPlusAvatarRing } from '@/app/components/tcf-plus-avatar-ring';
import { RankBadge } from '@/app/components/rank-badge';
import { TrophyInline } from '@/app/components/trophy-image';

interface LeaderboardUser {
  id: string;
  discord_username: string;
  discord_avatar: string | null;
  rank_id: number;
  prestige_level: number;
  role: string;
  created_at: string;
  steam_id?: string | null;
  tcf_plus_active?: boolean | null;
  twitch_username?: string | null;
  twitch_avatar?: string | null;
  discord_id?: string | null;
  guild_id?: string | null;
  mvp_count?: number;
  guild?: {
    id: string;
    name: string;
    tag: string;
    color: string;
    logo_url: string | null;
  } | null;
  opendota_data?: {
    badge_rank?: {
      medal: string;
      stars: number;
      rank_tier: number;
      leaderboard_rank: number | null;
    };
    top_3_heroes?: any[];
    primary_role?: string | null;
  };
  ranks: {
    id: number;
    name: string;
    display_order: number;
  };
  kkup_stats?: {
    linked: boolean;
    championships: number;
    popd_kernels: number;
  };
}

interface LeaderboardGuild {
  id: string;
  name: string;
  tag: string;
  color: string;
  logo_url: string | null;
  kernels: number;
  member_count: number;
  member_limit: number;
  total_mvp_count: number;
  avg_rank_id?: number;
  avg_prestige?: number;
}

// Rank emojis mapping (same as home page)
const rankEmojis = [
  '\u{1F41B}', // 1. Earwig
  '\u{1F98C}', // 2. Ugandan Kob
  '\u{1F33D}', // 3. Private Maize
  '\u{1F944}', // 4. Specialist Ingredient
  '\u{1F35E}', // 5. Corporal Corn Bread
  '\u{1F33E}', // 6. Sergeant Husk
  '\u{1F33B}', // 7. Sergeant Major Fields
  '\u{1F3AF}', // 8. Captain Cornhole
  '\u2B50',    // 9. Major Cob
  '\u{1F31F}', // 10. Corn Star
  '\u{1F4A5}', // 11. Pop'd Kernel
];

const rankRoster = [
  'Earwig',
  'Ugandan Kob',
  'Private Maize',
  'Specialist Ingredient',
  'Corporal Corn Bread',
  'Sergeant Husk',
  'Sergeant Major Fields',
  'Captain Cornhole',
  'Major Cob',
  'Corn Star',
  'Pop\'d Kernel',
];

/** Dynamic tab config — derived from actual data */
interface RoleTab {
  id: string;
  label: string;
  hex: string;           // brand color
  filter: (u: LeaderboardUser) => boolean;
}

/** Build role tabs dynamically from the users array */
function buildRoleTabs(users: LeaderboardUser[]): RoleTab[] {
  const tabs: RoleTab[] = [
    { id: 'all', label: 'All', hex: '#f59e0b', filter: () => true },
  ];

  // Build guild-based tabs from actual user data
  const guildMap = new Map<string, { name: string; tag: string; color: string; count: number }>();
  for (const u of users) {
    if (u.guild && u.guild.name !== 'Unaffiliated') {
      const existing = guildMap.get(u.guild.id);
      if (existing) {
        existing.count++;
      } else {
        guildMap.set(u.guild.id, { name: u.guild.name, tag: u.guild.tag, color: u.guild.color, count: 1 });
      }
    }
  }

  // Sort guilds by member count descending
  const sortedGuilds = [...guildMap.entries()].sort((a, b) => b[1].count - a[1].count);
  for (const [guildId, guild] of sortedGuilds) {
    tabs.push({
      id: `guild_${guildId}`,
      label: guild.tag || guild.name,
      hex: guild.color,
      filter: (u) => u.guild?.id === guildId,
    });
  }

  // Guest tab (no guild or Unaffiliated)
  const guestCount = users.filter(u => u.role === 'guest').length;
  if (guestCount > 0) {
    tabs.push({ id: 'guest', label: 'Guest', hex: getRoleBadgeStyle('guest').hex, filter: (u) => u.role === 'guest' });
  }

  // Officers tab
  const hasOfficers = users.some(u => isOfficer(u.role));
  if (hasOfficers) {
    tabs.push({ id: '__officers', label: 'Officers', hex: '#3b82f6', filter: (u) => isOfficer(u.role) });
  }

  return tabs;
}

// ═══════════════════════════════════════════════════════
// SKELETON COMPONENTS
// ═══════════════════════════════════════════════════════

function PodiumSkeleton() {
  return (
    <div className="bg-card rounded-2xl border-2 border-border p-4 sm:p-8 mb-3 sm:mb-6">
      <div className="h-6 w-40 bg-muted rounded-lg animate-pulse mx-auto mb-6" />
      <div className="grid grid-cols-3 gap-3 sm:gap-6 items-end">
        {/* 2nd place */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-muted animate-pulse" />
          <div className="h-4 w-20 bg-muted rounded-lg animate-pulse" />
          <div className="h-3 w-16 bg-muted rounded-lg animate-pulse" />
        </div>
        {/* 1st place — taller */}
        <div className="flex flex-col items-center gap-2 -mt-4">
          <div className="w-6 h-6 bg-muted rounded animate-pulse" />
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-muted animate-pulse" />
          <div className="h-5 w-24 bg-muted rounded-lg animate-pulse" />
          <div className="h-3 w-20 bg-muted rounded-lg animate-pulse" />
        </div>
        {/* 3rd place */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-muted animate-pulse" />
          <div className="h-4 w-20 bg-muted rounded-lg animate-pulse" />
          <div className="h-3 w-16 bg-muted rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  );
}

function UserRowSkeleton() {
  return (
    <div className="bg-card rounded-xl sm:rounded-2xl p-2.5 sm:p-5 border-2 border-border flex items-center gap-2 sm:gap-4">
      <div className="w-7 h-7 sm:w-12 sm:h-12 rounded-lg bg-muted animate-pulse flex-shrink-0" />
      <div className="w-9 h-9 sm:w-14 sm:h-14 rounded-full bg-muted animate-pulse flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="h-4 w-1/3 bg-muted rounded-lg animate-pulse" />
        <div className="h-3 w-1/4 bg-muted rounded-lg animate-pulse" />
      </div>
      <div className="hidden sm:flex items-center gap-3">
        <div className="w-12 h-12 bg-muted rounded-lg animate-pulse" />
        <div className="w-12 h-12 bg-muted rounded-lg animate-pulse" />
      </div>
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <>
      <PodiumSkeleton />
      <div className="space-y-1.5 sm:space-y-3">
        {[1, 2, 3, 4, 5, 6, 7].map(i => <UserRowSkeleton key={i} />)}
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════
// TOP 3 PODIUM COMPONENT
// ═══════════════════════════════════════════════════════

const PODIUM_STYLES = [
  // 1st place
  {
    bgGradient: 'from-yellow-400/20 to-amber-300/10',
    border: 'border-yellow-400/60',
    badgeBg: 'bg-gradient-to-br from-yellow-400 to-amber-500',
    avatarSize: 'w-16 h-16 sm:w-20 sm:h-20',
    avatarBorder: 'border-yellow-400',
    nameSize: 'text-sm sm:text-lg',
    crown: true,
    padTop: 'pt-2',
  },
  // 2nd place
  {
    bgGradient: 'from-gray-300/20 to-gray-200/10',
    border: 'border-gray-300/60',
    badgeBg: 'bg-gradient-to-br from-gray-400 to-gray-500',
    avatarSize: 'w-14 h-14 sm:w-16 sm:h-16',
    avatarBorder: 'border-gray-300',
    nameSize: 'text-xs sm:text-base',
    crown: false,
    padTop: 'pt-3 sm:pt-6',
  },
  // 3rd place
  {
    bgGradient: 'from-orange-300/20 to-orange-200/10',
    border: 'border-orange-300/60',
    badgeBg: 'bg-gradient-to-br from-orange-400 to-orange-500',
    avatarSize: 'w-14 h-14 sm:w-16 sm:h-16',
    avatarBorder: 'border-orange-300',
    nameSize: 'text-xs sm:text-base',
    crown: false,
    padTop: 'pt-3 sm:pt-6',
  },
];

function TopThreePodium({
  users,
  onUserClick,
}: {
  users: LeaderboardUser[];
  onUserClick: (u: LeaderboardUser) => void;
}) {
  if (users.length < 3) return null;

  // Render order: [2nd, 1st, 3rd]
  const renderOrder = [1, 0, 2];

  return (
    <div className="bg-card rounded-2xl border-2 border-border p-3 sm:p-6 mb-3 sm:mb-6">
      <h2 className="text-base sm:text-xl font-bold text-foreground mb-0.5 text-center">
        Top 3 MVPs
      </h2>
      <p className="text-[10px] sm:text-xs text-muted-foreground text-center mb-3 sm:mb-5">
        Ranked by Prestige, Guild Rank, Championships, Pop'd Kernels
      </p>

      <div className="grid grid-cols-3 gap-2 sm:gap-5 items-end">
        {renderOrder.map(dataIdx => {
          const u = users[dataIdx];
          const s = PODIUM_STYLES[dataIdx];
          const emoji = rankEmojis[u.rank_id - 1];
          const isPopdKernel = u.rank_id === 11;
          const hasChampionships = u.kkup_stats?.linked && u.kkup_stats.championships > 0;
          const hasPopdKernels = u.kkup_stats?.linked && u.kkup_stats.popd_kernels > 0;
          const guildColor = u.guild?.color || getRoleBadgeStyle(u.role).hex;
          const guildLabel = u.guild && u.guild.name !== 'Unaffiliated' ? u.guild.tag : getRoleDisplayName(u.role);

          return (
            <div
              key={u.id}
              className={`${s.padTop} cursor-pointer group`}
              onClick={() => onUserClick(u)}
            >
              <div className={`bg-gradient-to-br ${s.bgGradient} rounded-xl border-2 ${s.border} p-2.5 sm:p-4 text-center relative transition-all group-hover:scale-[1.03] group-hover:shadow-lg`}>
                {/* Position badge */}
                <div className={`${s.badgeBg} text-white rounded-full w-7 h-7 sm:w-9 sm:h-9 flex items-center justify-center font-bold text-xs sm:text-base mx-auto mb-1.5 sm:mb-2 border-2 border-card shadow-md`}>
                  {dataIdx + 1}
                </div>

                {/* Crown for 1st */}
                {s.crown && <Crown className="w-4 h-4 sm:w-6 sm:h-6 mx-auto mb-0.5 text-yellow-500" />}

                {/* Avatar */}
                <div className="flex justify-center mb-2 sm:mb-3">
                <TcfPlusAvatarRing active={u.tcf_plus_active} size="sm">
                {u.discord_avatar ? (
                  <img
                    src={u.discord_avatar}
                    alt={u.discord_username}
                    className={`${s.avatarSize} rounded-full border-4 ${s.avatarBorder} object-cover`}
                    width={96}
                    height={96}
                  />
                ) : (
                  <div className={`${s.avatarSize} rounded-full bg-harvest/20 flex items-center justify-center border-4 ${s.avatarBorder}`}>
                    <span className="text-harvest font-bold text-lg sm:text-2xl">
                      {u.discord_username[0].toUpperCase()}
                    </span>
                  </div>
                )}
                </TcfPlusAvatarRing>
                </div>

                {/* Name */}
                <p className={`${s.nameSize} font-bold text-foreground mb-0.5 truncate`}>
                  {u.discord_username}
                </p>

                {/* Guild pill */}
                <span
                  className="inline-block px-1.5 py-0.5 text-white text-[8px] sm:text-[10px] font-bold rounded-full mb-1"
                  style={{ backgroundColor: guildColor }}
                >
                  {guildLabel}
                </span>

                {/* Rank */}
                <div className="flex items-center justify-center gap-1 mb-1">
                  {isPopdKernel ? (
                    <Popcorn className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-harvest" />
                  ) : (
                    <span className="text-xs sm:text-sm">{emoji}</span>
                  )}
                  <span className="text-xs sm:text-sm font-bold text-foreground">
                    {u.ranks?.name || 'Unranked'}
                  </span>
                </div>

                {/* Prestige 5-Star Display */}
                <div className="flex items-center justify-center gap-0.5 mt-1">
                  {[1, 2, 3, 4, 5].map((level) => {
                    const isAchieved = (u.prestige_level || 0) >= level;
                    const starEmoji = level === 5 ? '💥' : '🌟';
                    return (
                      <span 
                        key={level} 
                        className={`text-[12px] leading-none ${
                          isAchieved ? 'drop-shadow-sm' : 'opacity-15 grayscale'
                        }`}
                      >
                        {starEmoji}
                      </span>
                    );
                  })}
                </div>

                {/* Badges row */}
                <div className="flex items-center justify-center gap-3 mt-1">
                  <div className="flex flex-col items-center">
                    <TrendingUp className="w-3.5 h-3.5 text-[#3b82f6]" />
                    <p className="text-[10px] font-black text-[#3b82f6] leading-none mt-1">
                      {u.mvp_count || 0} MVP
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GuildCard({ 
  guild, 
  position, 
  isMember, 
  onJoin, 
  onView 
}: { 
  guild: LeaderboardGuild; 
  position: number; 
  isMember: boolean; 
  onJoin: () => void; 
  onView: () => void;
}) {
  const percentage = (guild.member_count / guild.member_limit) * 100;
  
  return (
    <div className="bg-card rounded-[2rem] border-2 border-border overflow-hidden group hover:border-harvest/50 transition-all hover:shadow-2xl relative flex flex-col h-full">
       {/* Rank Badge Floating - Sharper, more premium look */}
       <div className={`absolute top-6 left-6 z-20 px-4 py-1.5 rounded-xl text-[11px] font-black border-2 shadow-2xl transition-transform hover:scale-105 ${
         position === 1 ? 'border-yellow-400 bg-yellow-400 text-black shadow-yellow-400/20' :
         position === 2 ? 'border-gray-300 bg-gray-300 text-black shadow-gray-300/20' :
         position === 3 ? 'border-orange-500 bg-orange-500 text-black shadow-orange-500/20' :
         'border-border/50 bg-black/60 text-white backdrop-blur-md'
       }`}>
          {position === 1 ? '🏆 1ST PLACE' : 
           position === 2 ? '🥈 2ND PLACE' : 
           position === 3 ? '🥉 3RD PLACE' : 
           `${position}${
             (position % 10 === 1 && position % 100 !== 11) ? 'ST' :
             (position % 10 === 2 && position % 100 !== 12) ? 'ND' :
             (position % 10 === 3 && position % 100 !== 13) ? 'RD' : 'TH'
           } PLACE`}
       </div>

       {/* Banner / Header */}
       <div className="h-28 relative overflow-hidden flex-shrink-0">
          <div className="absolute inset-0 opacity-30" style={{ backgroundColor: guild.color }} />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-card/50 to-card" />
          
          {/* Decorative Pattern */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: `radial-gradient(circle at 2px 2px, ${guild.color} 1px, transparent 0)`, backgroundSize: '16px 16px' }} />

           {/* Logo overlapping banner */}
           <div className="absolute -bottom-8 left-8 z-10">
              <div className="w-24 h-24 rounded-2xl border-4 border-card shadow-2xl overflow-hidden bg-white/10 backdrop-blur-sm flex-shrink-0 flex items-center justify-center p-1">
                 {guild.logo_url ? (
                   <img src={guild.logo_url} alt={guild.name} className="w-full h-auto max-h-full object-contain" />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center font-black rounded-lg" style={{ backgroundColor: guild.color }}>
                      <span className="text-white text-2xl">{guild.tag}</span>
                   </div>
                 )}
              </div>
           </div>
        </div>

       <div className="p-6 pt-10 flex flex-col flex-1">
          <div className="flex justify-between items-start mb-6">
             <div className="min-w-0 pr-4">
                <h3 className="text-xl font-black text-foreground mb-1 leading-tight group-hover:text-harvest transition-colors truncate">
                   {guild.name}
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                   <span className="px-2 py-0.5 rounded-lg text-[10px] font-black text-white uppercase tracking-wider shadow-sm" style={{ backgroundColor: guild.color }}>
                      {guild.tag}
                   </span>
                   <div className="flex items-center gap-1.5 text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-lg border border-border/50">
                      <Users className="w-3 h-3" />
                      <span className="text-[10px] font-black uppercase tabular-nums">{guild.member_count} / {guild.member_limit}</span>
                   </div>
                 </div>
             </div>
             
               <div className="flex flex-col items-center flex-shrink-0 ml-4">
                  <CornMeter 
                    kernels={guild.kernels} 
                    mvpCount={Number(guild.total_mvp_count || 0)}
                    size="sm" 
                    className="scale-110" 
                  />
               </div>
          </div>
           {/* Average Rank Display - Enhanced Design (Full Width) */}
           {guild.avg_rank_id && (
             <div className="relative mt-2 mb-8 group/rank w-full">
                <div className="absolute -inset-2 bg-harvest/5 rounded-2xl blur-lg opacity-0 group-hover/rank:opacity-100 transition-opacity" />
                <div className="relative flex items-center justify-between gap-3 bg-card/40 backdrop-blur-md rounded-2xl p-3 border border-border/50 shadow-sm overflow-hidden w-full">
                   <div className="flex items-center gap-3">
                      {/* Mini Rank Icon */}
                      <div className="w-11 h-11 rounded-xl bg-harvest/10 flex items-center justify-center text-2xl border border-harvest/20 shadow-inner group-hover/rank:rotate-[360deg] transition-all duration-700">
                         {rankEmojis[guild.avg_rank_id - 1]}
                      </div>
                      <div>
                         <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1 text-xs">AVG MEMBER TIER</p>
                         <p className="text-[14px] font-black text-foreground uppercase tracking-tighter leading-none">
                            {rankRoster[guild.avg_rank_id - 1] || 'Unknown'}
                         </p>
                      </div>
                   </div>

                   {/* Emojis to the side */}
                   {typeof guild.avg_prestige === 'number' && (
                      <div className="flex items-center gap-1.5 px-4">
                         {[1, 2, 3, 4, 5].map((level) => {
                            const isAchieved = (guild.avg_prestige || 0) >= level;
                            const emoji = level === 5 ? '💥' : '🌟';
                            return (
                               <span key={level} className={`text-[14px] leading-none transition-all duration-300 ${isAchieved ? 'drop-shadow-sm scale-110' : 'opacity-20 grayscale'}`}>
                                  {emoji}
                               </span>
                            );
                         })}
                      </div>
                   )}
                   
                   {/* HUD Accent Line */}
                   <div className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-harvest/50 to-transparent group-hover:w-full transition-all duration-700" style={{ width: '15%' }} />
                </div>
             </div>
           )}

          {/* Capacity Progress */}
          <div className="mb-8 mt-auto">
            <div className="flex justify-between items-end mb-1.5">
               <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Guild Capacity</span>
               <span className="text-[10px] font-black text-foreground">{Math.round(percentage)}%</span>
            </div>
            <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden border border-border/50">
               <div 
                 className="h-full transition-all duration-1000 ease-out" 
                 style={{ width: `${percentage}%`, backgroundColor: guild.color, boxShadow: `0 0 10px ${guild.color}40` }} 
               />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-auto">
             <button 
               onClick={onView}
               className="flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black bg-muted hover:bg-muted/80 text-foreground transition-all border border-transparent hover:border-border"
             >
                <Info className="w-4 h-4" />
                Members
             </button>
             {isMember ? (
               <div className="flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black bg-harvest/10 text-harvest border-2 border-harvest/30 cursor-default shadow-inner">
                  <Star className="w-4 h-4 fill-harvest" />
                  Joined
               </div>
             ) : (
               <button 
                 onClick={onJoin}
                 className="flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-black bg-harvest text-white hover:bg-amber shadow-lg shadow-harvest/30 transition-all group scale-100 hover:scale-[1.02] active:scale-[0.98]"
               >
                  Join
                  <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
               </button>
             )}
          </div>
       </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════

import { CornMeter } from '@/app/components/corn-meter';

export function LeaderboardPage({ user, onRefresh }: { user: any; onRefresh?: () => void }) {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [guilds, setGuilds] = useState<LeaderboardGuild[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<LeaderboardUser | null>(null);
  const [showJoinConfirm, setShowJoinConfirm] = useState<LeaderboardGuild | null>(null);
  const [joinStatus, setJoinStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [viewTab, setViewTab] = useState<'fields' | 'towers'>('towers');
  const [showMvpModal, setShowMvpModal] = useState(false);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const handleJoinGuild = async (guild: LeaderboardGuild) => {
    if (user?.guild_id === guild.id) return;
    setShowJoinConfirm(guild);
  };

  const executeJoin = async (guild: LeaderboardGuild) => {
    setIsJoining(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/guilds/${guild.id}/join`,
        { 
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session.access_token}` } 
        }
      );

      if (response.ok) {
        setJoinStatus({ type: 'success', message: `Welcome to ${guild.name}! You have successfully joined the tower.` });
        setShowJoinConfirm(null);
        await fetchLeaderboard();
      } else {
        const error = await response.json();
        setJoinStatus({ type: 'error', message: error.error || 'Failed to join guild. Please try again later.' });
      }
    } catch (err) {
      console.error('Join guild error:', err);
      setJoinStatus({ type: 'error', message: 'A network error occurred. Please check your connection.' });
    } finally {
      setIsJoining(false);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/leaderboard`,
        { headers: { 'Authorization': `Bearer ${session.access_token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setGuilds(data.guilds || []);
      } else {
        console.error('Failed to fetch leaderboard');
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankBadgeColor = (position: number) => {
    if (position === 1) return 'bg-gradient-to-br from-[#fbbf24] to-[#f59e0b] text-white';
    if (position === 2) return 'bg-gradient-to-br from-[#9ca3af] to-[#6b7280] text-white';
    if (position === 3) return 'bg-gradient-to-br from-[#d97706] to-[#b45309] text-white';
    return 'bg-muted text-muted-foreground';
  };

  const getRankIcon = (position: number) => {
    if (position === 1) return <Crown className="w-6 h-6 text-[#fbbf24]" />;
    if (position === 2) return <Medal className="w-6 h-6 text-[#9ca3af]" />;
    if (position === 3) return <Medal className="w-6 h-6 text-[#d97706]" />;
    return null;
  };

  const getMobileRankIcon = (position: number) => {
    if (position === 1) return <Crown className="w-4 h-4 text-[#fbbf24]" />;
    if (position === 2) return <Medal className="w-4 h-4 text-[#9ca3af]" />;
    if (position === 3) return <Medal className="w-4 h-4 text-[#d97706]" />;
    return null;
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const scrollToCurrentUser = () => {
    if (!user) return;
    const userCard = document.querySelector(`[data-user-id="${user.id}"]`);
    if (userCard) {
      userCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      userCard.classList.add('ring-4', 'ring-harvest/50');
      setTimeout(() => { userCard.classList.remove('ring-4', 'ring-harvest/50'); }, 2000);
    }
  };

  // Build dynamic tabs from the actual user data
  const roleTabs = useMemo(() => buildRoleTabs(users), [users]);
  const currentTab = roleTabs.find(t => t.id === activeTab) || roleTabs[0];

  const filteredUsers = users.filter(u =>
    u.discord_username.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const tabFilteredUsers = filteredUsers.filter(currentTab?.filter || (() => true));

  // Inclusive guild list (now showing Unaffiliated)
  const rankedGuilds = guilds;

  // For podium: use the global top 3 (not filtered)
  const globalTop3 = users.slice(0, 3);
  // For the list: skip top 3 only on "All" tab with no search
  const isUnfilteredAll = activeTab === 'all' && !searchTerm;
  const listUsers = isUnfilteredAll ? tabFilteredUsers.slice(3) : tabFilteredUsers;

  return (
    <div className="p-3 sm:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header Card */}
        <div className="bg-gradient-to-br from-harvest/10 to-harvest/5 rounded-2xl sm:rounded-3xl p-4 sm:p-8 border-2 border-harvest/20 mb-3 sm:mb-6">
          <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-harvest flex items-center justify-center flex-shrink-0">
              <Swords className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-3xl font-black text-foreground uppercase tracking-tight">
                {viewTab === 'towers' ? 'Guild Wars' : 'Players of Power'}
              </h2>
              <p className="text-muted-foreground text-[11px] sm:text-sm font-medium">
                {viewTab === 'towers' 
                  ? 'The most powerful guilds in The Corn Field 🌽' 
                  : 'Individual player rankings and prestige leaderboard'}
              </p>
            </div>
          </div>

          {/* Tab Switcher: Towers vs Players */}
          <div className="flex p-1 bg-card/50 backdrop-blur-sm border-2 border-border rounded-2xl mb-4">
            <button
              onClick={() => setViewTab('towers')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                viewTab === 'towers' 
                ? 'bg-harvest text-white shadow-md' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Crown className="w-4 h-4" />
              Guilds
            </button>
            <button
              onClick={() => setViewTab('fields')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                viewTab === 'fields' 
                ? 'bg-[#3b82f6] text-white shadow-md' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Users className="w-4 h-4" />
              Players
            </button>
          </div>

          {/* Upload MVP & MVP Count Row */}
          {user?.role && user.role !== 'guest' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {/* Upload MVP Button */}
              <button
                onClick={() => setShowMvpModal(true)}
                className="flex items-center gap-3 px-3 sm:px-4 py-2.5 sm:py-3 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-xl transition-all hover:shadow-md group"
              >
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0 group-hover:bg-white/30 transition-colors">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-xs sm:text-sm font-bold leading-tight">Upload MVP</p>
                  <p className="text-[10px] sm:text-xs text-white/70 leading-tight">Submit screenshot</p>
                </div>
                <span className="text-white/50 group-hover:text-white/80 transition-colors text-lg font-bold">+</span>
              </button>

              {/* MVP Count Card */}
              <div className="bg-card/40 backdrop-blur-sm rounded-xl px-3 sm:px-4 py-2.5 sm:py-3 border-2 border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <Award className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-bold text-foreground">MVP Count</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">My 2026 MVP Count</p>
                  </div>
                </div>
                <div className="text-xl sm:text-2xl font-black text-amber-500 tabular-nums">
                  {user?.mvp_count ?? 0}
                </div>
              </div>
            </div>
          )}

          {/* Search Bar and Jump Button - ONLY ON FIELDS */}
          {viewTab === 'fields' && (
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 text-xs sm:text-sm border-2 border-border rounded-xl focus:outline-none focus:border-harvest transition-all bg-input-background text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <button
                onClick={scrollToCurrentUser}
                className="flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 bg-harvest hover:bg-amber text-white text-xs sm:text-sm font-semibold rounded-xl transition-all whitespace-nowrap"
              >
                <span className="hidden sm:inline">Jump to You</span>
                <span className="sm:hidden">Find Me</span>
                <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          )}

          {/* Divider + Role Filter Tabs - ONLY ON FIELDS */}
          {viewTab === 'fields' && (
            <div className="border-t border-harvest/20 pt-2 sm:pt-3">
            {!loading && users.length > 0 && (
              <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {roleTabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  const count = users.filter(tab.filter).length;
                  const hex = tab.hex;

                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap border-2 flex-shrink-0"
                      style={isActive ? {
                        backgroundColor: hex,
                        color: 'white',
                        borderColor: 'transparent',
                      } : {
                        backgroundColor: 'var(--card)',
                        color: hex,
                        borderColor: `${hex}30`,
                      }}
                    >
                      {tab.label}
                      <span
                        className="px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold"
                        style={isActive ? {
                          backgroundColor: 'rgba(255,255,255,0.2)',
                          color: 'white',
                        } : {
                          backgroundColor: 'rgba(128,128,128,0.1)',
                          color: 'rgba(128,128,128,0.6)',
                        }}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            </div>
          )}
        </div>

        {/* Leaderboard Content */}
        {loading ? (
          <LeaderboardSkeleton />
        ) : users.length === 0 ? (
          <div className="bg-card rounded-2xl shadow-sm p-8 sm:p-12 border-2 border-border text-center">
            <Trophy className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground/30 mx-auto mb-3 sm:mb-4" />
            <p className="text-base sm:text-lg font-semibold text-foreground mb-2">No members yet!</p>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Be the first to join the guild and climb the ranks.
            </p>
          </div>
        ) : viewTab === 'towers' ? (
          <div className="space-y-6">
            {/* Guild List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {rankedGuilds.map((g, i) => (
                <GuildCard 
                  key={g.id}
                  guild={g}
                  position={i + 1}
                  isMember={user?.guild_id === g.id}
                  onView={() => {
                    setActiveTab(`guild_${g.id}`);
                    setViewTab('fields');
                  }}
                  onJoin={() => handleJoinGuild(g)}
                />
              ))}
            </div>

            {/* Create Guild Call to Action */}
            {user?.role && user.role !== 'guest' && !rankedGuilds.some(g => g.id === user.guild_id) && (
              <div className="bg-gradient-to-br from-harvest/5 to-amber/5 rounded-[2rem] border-2 border-dashed border-harvest/30 p-8 text-center mt-8 group hover:border-harvest/50 transition-all">
                <div className="w-16 h-16 rounded-2xl bg-harvest/10 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                   <Plus className="w-8 h-8 text-harvest" />
                </div>
                <h3 className="text-xl font-black text-foreground mb-2">Want your own Tower?</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                   Build your legacy, recruit followers, and climb the Leaderboard. TCF+ members can establish their own guilds.
                </p>
                <button 
                  onClick={() => alert("Redirecting to Guild Manager...")}
                  className="px-8 py-3 bg-foreground text-background rounded-2xl font-black text-sm hover:bg-foreground/90 transition-all shadow-xl"
                >
                   Create A Guild
                </button>
              </div>
            )}
          </div>
        ) : (
              <>
                {/* Field of Battle (Individual Players) */}
                {/* Top 3 Podium — only show on "All" tab with no search */}
                {isUnfilteredAll && globalTop3.length >= 3 && (
                  <TopThreePodium
                    users={globalTop3}
                    onUserClick={setSelectedUser}
                  />
                )}

                {/* User List */}
                <div className="space-y-1.5 sm:space-y-3">
                  {listUsers.length === 0 ? (
                    <div className="bg-card rounded-2xl shadow-sm p-8 sm:p-12 border-2 border-border text-center">
                      <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-sm sm:text-base font-semibold text-foreground mb-1">No members found</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {searchTerm ? 'Try a different search term' : 'No members in this guild yet'}
                      </p>
                    </div>
                  ) : (
                    listUsers.map((leaderboardUser) => {
                      const position = users.indexOf(leaderboardUser) + 1;
                      const isTopThree = position <= 3;
                      const emoji = rankEmojis[leaderboardUser.rank_id - 1];
                      const isPopdKernel = leaderboardUser.rank_id === 11;
                      const hasChampionships = leaderboardUser.kkup_stats?.linked && leaderboardUser.kkup_stats.championships > 0;
                      const hasPopdKernels = leaderboardUser.kkup_stats?.linked && leaderboardUser.kkup_stats.popd_kernels > 0;
                      const hasDotaBadge = leaderboardUser.opendota_data?.badge_rank && leaderboardUser.opendota_data.badge_rank.medal !== 'Unranked';
                      const guildColor = leaderboardUser.guild?.color || getRoleBadgeStyle(leaderboardUser.role).hex;
                      const guildLabel = leaderboardUser.guild && leaderboardUser.guild.name !== 'Unaffiliated'
                        ? leaderboardUser.guild.tag
                        : getRoleDisplayName(leaderboardUser.role);

                      return (
                        <div
                          key={leaderboardUser.id}
                          data-user-id={leaderboardUser.id}
                          onClick={() => setSelectedUser(leaderboardUser)}
                          className={`bg-card rounded-xl sm:rounded-2xl shadow-sm p-2.5 sm:p-5 border-2 transition-all hover:scale-[1.01] sm:hover:scale-[1.02] hover:shadow-md cursor-pointer ${
                            isTopThree
                              ? 'border-harvest/30 bg-gradient-to-r from-harvest/5 to-transparent'
                              : 'border-border'
                          }`}
                        >
                          {/* ===== MOBILE LAYOUT (< sm) ===== */}
                          <div className="flex items-center gap-2 sm:hidden">
                            {/* Position # */}
                            <div className={`w-7 h-7 rounded-lg ${getRankBadgeColor(position)} flex items-center justify-center flex-shrink-0 text-xs font-bold`}>
                              {position <= 3 ? getMobileRankIcon(position) : `#${position}`}
                            </div>

                            {/* Avatar */}
                            <TcfPlusAvatarRing active={leaderboardUser.tcf_plus_active} size="xs">
                            {leaderboardUser.discord_avatar ? (
                              <img
                                src={leaderboardUser.discord_avatar}
                                alt={leaderboardUser.discord_username}
                                className="w-9 h-9 rounded-full border-2 border-harvest/20 flex-shrink-0"
                                width={36}
                                height={36}
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-harvest/10 flex items-center justify-center border-2 border-harvest/20 flex-shrink-0">
                                <span className="text-harvest font-bold text-sm">
                                  {leaderboardUser.discord_username[0].toUpperCase()}
                                </span>
                              </div>
                            )}
                            </TcfPlusAvatarRing>

                            {/* Name + role badge */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1">
                                <p className="font-bold text-foreground text-sm truncate">
                                  {leaderboardUser.discord_username}
                                </p>
                                <span
                                  className="px-1 py-0.5 text-white text-[8px] font-bold rounded-full flex-shrink-0"
                                  style={{ backgroundColor: guildColor }}
                                >
                                  {guildLabel}
                                </span>
                              </div>
                              {/* Compact rank line */}
                              <div className="flex items-center gap-1 mt-0.5">
                                {isPopdKernel ? (
                                  <Popcorn className="w-3.5 h-3.5 text-harvest" />
                                ) : (
                                  <span className="text-xs">{emoji}</span>
                                )}
                                <span className="text-[11px] text-muted-foreground font-medium truncate">{leaderboardUser.ranks?.name || 'Unranked'}</span>
                                {leaderboardUser.prestige_level > 0 && (
                                  <span className="text-[10px] text-[#d97706] font-bold ml-auto flex-shrink-0">⭐{leaderboardUser.prestige_level}</span>
                                )}
                              </div>
                            </div>

                            {/* Minimal mobile badges */}
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <div className="flex flex-col items-center">
                                  <TrendingUp className="w-3 h-3 text-[#3b82f6]" />
                                  <span className="text-[8px] font-black text-[#3b82f6] leading-none mt-0.5">{leaderboardUser.mvp_count || 0}</span>
                                </div>
                                <div className="flex items-center gap-0.5 bg-foreground/5 px-1.5 py-1 rounded-lg border border-foreground/5">
                                  {[1, 2, 3, 4, 5].map((level) => {
                                    const isAchieved = (leaderboardUser.prestige_level || 0) >= level;
                                    const starEmoji = level === 5 ? '💥' : '🌟';
                                    return (
                                      <span key={level} className={`text-[10px] leading-none ${isAchieved ? '' : 'opacity-10 grayscale'}`}>
                                        {starEmoji}
                                      </span>
                                    );
                                  })}
                                </div>
                            </div>
                          </div>

                          {/* ===== DESKTOP LAYOUT (>= sm) ===== */}
                          <div className="hidden sm:flex items-center gap-4">
                            {/* Position Badge */}
                            <div className={`w-12 h-12 rounded-xl ${getRankBadgeColor(position)} flex items-center justify-center flex-shrink-0 font-bold text-lg shadow-sm`}>
                              {getRankIcon(position) || `#${position}`}
                            </div>

                            {/* User Avatar */}
                            <TcfPlusAvatarRing active={leaderboardUser.tcf_plus_active} size="sm">
                            {leaderboardUser.discord_avatar ? (
                              <img
                                src={leaderboardUser.discord_avatar}
                                alt={leaderboardUser.discord_username}
                                className="w-14 h-14 rounded-full border-2 border-harvest/20 flex-shrink-0"
                                width={56}
                                height={56}
                              />
                            ) : (
                              <div className="w-14 h-14 rounded-full bg-harvest/10 flex items-center justify-center border-2 border-harvest/20 flex-shrink-0">
                                <span className="text-harvest font-bold text-xl">
                                  {leaderboardUser.discord_username[0].toUpperCase()}
                                </span>
                              </div>
                            )}
                            </TcfPlusAvatarRing>

                            {/* User Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <p className="font-bold text-foreground text-lg truncate">
                                  {leaderboardUser.discord_username}
                                </p>
                                <span
                                  className="px-2 py-0.5 text-white text-xs font-semibold rounded-full"
                                  style={{ backgroundColor: guildColor }}
                                >
                                  {guildLabel}
                                </span>
                              </div>
                            </div>

                            {/* Right Side: Players Stats (Rank, MVP, Prestige) */}
                            <div className="flex-shrink-0">
                              <div className="flex items-center gap-4">
                                {/* Guild Rank */}
                                <div className="flex flex-col items-center min-w-[60px]">
                                  {isPopdKernel ? (
                                    <Popcorn className="w-6 h-6 text-harvest mb-0.5" />
                                  ) : (
                                    <span className="text-xl mb-0.5">{emoji}</span>
                                  )}
                                  <p className="text-[10px] font-black text-harvest text-center uppercase tracking-tight">
                                    {leaderboardUser.ranks?.name || 'Unranked'}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground font-bold">
                                    RANK {leaderboardUser.rank_id || 0}
                                  </p>
                                </div>

                                {/* MVP Count */}
                                <div className="flex flex-col items-center min-w-[60px]">
                                  <div className="w-8 h-8 rounded-lg bg-[#3b82f6]/10 flex items-center justify-center mb-0.5">
                                    <TrendingUp className="w-4 h-4 text-[#3b82f6]" />
                                  </div>
                                  <p className="text-[10px] font-black text-[#3b82f6] text-center uppercase">
                                    {leaderboardUser.mvp_count || 0} MVP
                                  </p>
                                </div>

                                {/* Prestige 5-Star Display */}
                                <div className="flex flex-col items-center bg-foreground/5 px-4 py-2 rounded-xl border border-foreground/5">
                                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest leading-none mb-1.5">Prestige</p>
                                  <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map((level) => {
                                      const isAchieved = (leaderboardUser.prestige_level || 0) >= level;
                                      const starEmoji = level === 5 ? '💥' : '🌟';
                                      return (
                                        <span 
                                          key={level} 
                                          className={`text-[14px] leading-none transition-all duration-300 ${
                                            isAchieved ? 'drop-shadow-sm scale-110' : 'opacity-10 grayscale'
                                          }`}
                                        >
                                          {starEmoji}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
              )}
            </div>
          </>
        )}

        {/* Info Card */}
        {!loading && users.length > 0 && (
          <div className="mt-3 sm:mt-6 bg-[#3b82f6]/5 rounded-xl sm:rounded-2xl p-3 sm:p-6 border-2 border-[#3b82f6]/20">
            <p className="text-[10px] sm:text-sm text-muted-foreground text-center font-bold tracking-tight">
              {viewTab === 'towers' ? (
                <>🌽 RANKING PRIORITY: <span className="text-foreground">SCORE</span> → <span className="text-foreground">MVP COUNT</span> → <span className="text-foreground">GUILD CAPACITY</span></>
              ) : (
                <>🌽 RANKING PRIORITY: <span className="text-foreground">PRESTIGE</span> → <span className="text-foreground">GUILD RANK</span> → <span className="text-foreground">CHAMPIONSHIPS</span> → <span className="text-foreground">POP'D KERNELS</span> → <span className="text-foreground">DOTA BADGE</span></>
              )}
            </p>
          </div>
        )}
      </div>

      {/* User Profile Modal */}
      {selectedUser && (
        <UserProfileModal
          key="profile-modal"
          user={selectedUser}
          currentUser={user}
          onClose={() => setSelectedUser(null)}
          onUpdate={fetchLeaderboard}
        />
      )}

      {/* MVP Submission Modal */}
      {showMvpModal && (
        <MvpSubmissionModal
          key="mvp-modal"
          user={user}
          onClose={() => setShowMvpModal(false)}
          onRefresh={onRefresh ? async () => { onRefresh(); } : undefined}
        />
      )}

      {/* Join Guild Confirmation Modal */}
      {showJoinConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-card w-full max-w-md rounded-3xl border-2 border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 text-center">
              <div className="w-24 h-24 mx-auto mb-6 rounded-2xl border-4 border-harvest/20 bg-muted overflow-hidden flex items-center justify-center">
                {showJoinConfirm.logo_url ? (
                  <img src={showJoinConfirm.logo_url} alt={showJoinConfirm.name} className="w-full h-full object-contain p-2" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-black" style={{ backgroundColor: showJoinConfirm.color }}>
                    <span className="text-white text-3xl">{showJoinConfirm.tag}</span>
                  </div>
                )}
              </div>
              
              <h3 className="text-2xl font-black text-foreground mb-2 whitespace-nowrap">Join {showJoinConfirm.name}?</h3>
              <p className="text-muted-foreground text-sm mb-6">You're about to join this guild's ranks. Ready to make your mark?</p>
              
              {/* Enriched Stats Overview */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-foreground/5 p-3 rounded-2xl border border-foreground/5">
                   <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-1">Guild Rank Score</p>
                   <p className="text-lg font-black text-harvest">{(showJoinConfirm.kernels ?? 0).toLocaleString()}</p>
                </div>
                <div className="bg-foreground/5 p-3 rounded-2xl border border-foreground/5">
                   <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider mb-1">Avg Member Rank</p>
                   <p className="text-lg font-black text-harvest">
                     {showJoinConfirm.avg_rank_id ? rankEmojis[showJoinConfirm.avg_rank_id - 1] : '🐛'}
                   </p>
                </div>
              </div>

              <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-8">
                <div className="flex items-start gap-3 text-left">
                  <Info className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-black text-red-500 uppercase tracking-wider mb-1">Rank Reset Warning</p>
                    <p className="text-xs text-red-500/80 leading-relaxed font-bold">
                      Joining a new guild will reset your current **Guild Wars Rank** and **Prestige** to 1. This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowJoinConfirm(null)}
                  disabled={isJoining}
                  className="flex-1 py-4 px-6 rounded-2xl font-black text-sm bg-muted text-muted-foreground hover:bg-muted/80 transition-all disabled:opacity-50"
                >
                  CANCEL
                </button>
                <button
                  onClick={() => executeJoin(showJoinConfirm)}
                  disabled={isJoining}
                  className="flex-1 py-4 px-6 rounded-2xl font-black text-sm bg-harvest text-white shadow-lg shadow-harvest/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isJoining ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'CONFIRM JOIN'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Join Status Modal (Success/Failure) */}
      {joinStatus && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-card w-full max-w-sm rounded-3xl border-2 border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 text-center">
              <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${
                joinStatus.type === 'success' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
              }`}>
                {joinStatus.type === 'success' ? <Star className="w-8 h-8" /> : <Info className="w-8 h-8" />}
              </div>
              
              <h3 className="text-xl font-black text-foreground mb-2">
                {joinStatus.type === 'success' ? 'Welcome Home!' : 'Guild Access Denied'}
              </h3>
              <p className="text-muted-foreground text-sm mb-6 font-medium">
                {joinStatus.message}
              </p>

              <button
                onClick={() => setJoinStatus(null)}
                className={`w-full py-4 px-6 rounded-2xl font-black text-sm transition-all hover:scale-105 active:scale-95 ${
                  joinStatus.type === 'success' 
                  ? 'bg-harvest text-white shadow-lg shadow-harvest/20' 
                  : 'bg-muted text-foreground'
                }`}
              >
                {joinStatus.type === 'success' ? 'LET\'S GO!' : 'DISMISS'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
