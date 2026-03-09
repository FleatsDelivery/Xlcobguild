/**
 * Shared types for KKup Detail Page and its tab sub-components.
 */

export interface Tournament {
  id: string;
  name: string;
  league_id: number | null;
  tournament_start_date: string;
  tournament_end_date: string;
  prize_pool: string;
  prize_pool_donations?: number;
  status: string;
  description: string;
  twitch_channel: string;
  youtube_playlist_url: string;
  cover_photo_url: string | null;
  youtube_url: string | null;
  league_banner_url?: string | null;
  league_large_icon_url?: string | null;
  league_square_icon_url?: string | null;
  tournament_type?: string;
  winning_team_id?: string;
  winning_team_name?: string;
  popd_kernel_1_person_id?: string;
  popd_kernel_2_person_id?: string;
  popd_kernel_1_name?: string;
  popd_kernel_2_name?: string;
  staff_count?: number;
  team_count?: number;
  player_count?: number;
  match_count?: number;
  player_match_stats_count?: number;
  twitch_url_1?: string;
  twitch_url_2?: string;
}

export interface Team {
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

export interface PlayerProfile {
  id: string;
  player_name: string;
  steam_id: string;
  account_id: number;
  avatar_url: string | null;
  dotabuff_url: string | null;
  opendota_url: string | null;
}

export interface RosterEntry {
  id: string;
  team_id: string;
  player_profile_id: string;
  player: PlayerProfile;
  is_standin?: boolean;
}

export interface Match {
  id: string;
  team1_id: string;
  team2_id: string;
  stage: string;
  status: string;
  team1: { id: string; name: string; tag: string; logo_url: string | null };
  team2: { id: string; name: string; tag: string; logo_url: string | null };
  winner: { id: string; name: string; tag: string; logo_url: string | null } | null;
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

export interface PlayerStat {
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
  team?: { id: string; name: string; tag: string; logo_url: string | null };
}