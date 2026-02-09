-- ============================================
-- KERNEL KUP PLAYER STATS & PROFILES (FIXED)
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================

-- Drop existing tables if they exist (to start fresh)
DROP TABLE IF EXISTS kkup_match_player_stats CASCADE;
DROP TABLE IF EXISTS kkup_player_profiles CASCADE;

-- Table 1: kkup_player_profiles (Historical player data across all tournaments)
CREATE TABLE kkup_player_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  player_name TEXT NOT NULL,
  steam_id BIGINT,
  opendota_id BIGINT,
  dotabuff_url TEXT,
  avatar_url TEXT,
  
  -- Aggregate stats across all KKUPs
  total_tournaments_played INTEGER DEFAULT 0,
  total_matches_played INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  total_losses INTEGER DEFAULT 0,
  total_kills INTEGER DEFAULT 0,
  total_deaths INTEGER DEFAULT 0,
  total_assists INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique index on steam_id (only for non-null values)
CREATE UNIQUE INDEX idx_kkup_player_profiles_steam_unique ON kkup_player_profiles(steam_id) WHERE steam_id IS NOT NULL;

-- Table 2: kkup_match_player_stats (Individual match performance)
CREATE TABLE kkup_match_player_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES kkup_matches(id) ON DELETE CASCADE,
  player_profile_id UUID NOT NULL REFERENCES kkup_player_profiles(id) ON DELETE CASCADE,
  team_id UUID REFERENCES kkup_teams(id) ON DELETE SET NULL,
  
  -- Player info
  player_name TEXT NOT NULL,
  steam_id BIGINT,
  
  -- Match performance
  hero_id INTEGER NOT NULL,
  hero_name TEXT NOT NULL,
  position_played INTEGER,
  is_winner BOOLEAN NOT NULL,
  
  -- Core stats
  kills INTEGER DEFAULT 0,
  deaths INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  last_hits INTEGER DEFAULT 0,
  denies INTEGER DEFAULT 0,
  gpm INTEGER DEFAULT 0,
  xpm INTEGER DEFAULT 0,
  
  -- Advanced stats
  hero_damage INTEGER DEFAULT 0,
  tower_damage INTEGER DEFAULT 0,
  hero_healing INTEGER DEFAULT 0,
  level INTEGER DEFAULT 0,
  items TEXT[],
  
  -- Match details
  game_duration_seconds INTEGER,
  dotabuff_match_id BIGINT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure uniqueness per player per match
  UNIQUE(match_id, player_profile_id)
);

-- Create indexes for performance
CREATE INDEX idx_kkup_player_profiles_user ON kkup_player_profiles(user_id);
CREATE INDEX idx_kkup_player_profiles_steam ON kkup_player_profiles(steam_id);
CREATE INDEX idx_kkup_match_stats_match ON kkup_match_player_stats(match_id);
CREATE INDEX idx_kkup_match_stats_player ON kkup_match_player_stats(player_profile_id);
CREATE INDEX idx_kkup_match_stats_team ON kkup_match_player_stats(team_id);

-- Success message
SELECT 'Kernel Kup player stats schema created successfully! 🌽' AS message;
