-- ============================================
-- KERNEL KUP DATABASE SCHEMA
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================

-- Table 1: kernel_kups (Tournament instances)
CREATE TABLE IF NOT EXISTS kernel_kups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  league_id INTEGER UNIQUE,
  status TEXT NOT NULL DEFAULT 'registration_open' CHECK (status IN ('registration_open', 'team_formation', 'scheduled', 'in_progress', 'completed')),
  registration_opens_at TIMESTAMPTZ,
  registration_closes_at TIMESTAMPTZ,
  tournament_start_date TIMESTAMPTZ,
  tournament_end_date TIMESTAMPTZ,
  description TEXT,
  rules TEXT,
  twitch_channel TEXT DEFAULT 'kernelkup_tv1',
  youtube_playlist_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table 2: kkup_teams (Teams registered for tournaments)
CREATE TABLE IF NOT EXISTS kkup_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kernel_kup_id UUID NOT NULL REFERENCES kernel_kups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  tag TEXT,
  valve_team_id BIGINT,
  team_admin_steam_id BIGINT,
  logo_url TEXT,
  dotabuff_url TEXT,
  opendota_team_id BIGINT,
  created_by UUID REFERENCES users(id),
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(kernel_kup_id, valve_team_id)
);

-- Table 3: kkup_registrations (Individual registrations per tournament)
CREATE TABLE IF NOT EXISTS kkup_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kernel_kup_id UUID NOT NULL REFERENCES kernel_kups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('player', 'coach', 'caster', 'spectator')),
  steam_id BIGINT,
  opendota_id BIGINT,
  status TEXT DEFAULT 'registered' CHECK (status IN ('registered', 'team_assigned', 'withdrawn')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(kernel_kup_id, user_id)
);

-- Table 4: kkup_team_members (Link users to teams for a specific tournament)
CREATE TABLE IF NOT EXISTS kkup_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES kkup_teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('coach', 'player')),
  steam_id BIGINT,
  opendota_id BIGINT,
  status TEXT DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined')),
  invited_by UUID REFERENCES users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- Table 5: kkup_matches (Match schedules and results)
CREATE TABLE IF NOT EXISTS kkup_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kernel_kup_id UUID NOT NULL REFERENCES kernel_kups(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('group_stage', 'playoffs', 'grand_finals')),
  match_number INTEGER,
  team1_id UUID NOT NULL REFERENCES kkup_teams(id),
  team2_id UUID NOT NULL REFERENCES kkup_teams(id),
  scheduled_time TIMESTAMPTZ,
  game_mode TEXT CHECK (game_mode IN ('turbo', 'captains_mode')),
  best_of INTEGER DEFAULT 1,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled')),
  team1_score INTEGER DEFAULT 0,
  team2_score INTEGER DEFAULT 0,
  winner_team_id UUID REFERENCES kkup_teams(id),
  match_id BIGINT,
  dotabuff_url TEXT,
  youtube_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_kkup_teams_kernel_kup ON kkup_teams(kernel_kup_id);
CREATE INDEX IF NOT EXISTS idx_kkup_teams_valve_id ON kkup_teams(valve_team_id);
CREATE INDEX IF NOT EXISTS idx_kkup_registrations_kernel_kup ON kkup_registrations(kernel_kup_id);
CREATE INDEX IF NOT EXISTS idx_kkup_registrations_user ON kkup_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_kkup_team_members_team ON kkup_team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_kkup_team_members_user ON kkup_team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_kkup_matches_kernel_kup ON kkup_matches(kernel_kup_id);
CREATE INDEX IF NOT EXISTS idx_kkup_matches_teams ON kkup_matches(team1_id, team2_id);

-- Insert historical Kernel Kups (with known League IDs)
INSERT INTO kernel_kups (name, league_id, status, description) VALUES
  ('Kernel Kup 4', 16223, 'completed', 'The fourth annual Kernel Kup tournament'),
  ('Kernel Kup 5', 16273, 'completed', 'The fifth annual Kernel Kup tournament'),
  ('Kernel Kup 6', 16444, 'completed', 'The sixth annual Kernel Kup tournament'),
  ('Kernel Kup 7', 16767, 'completed', 'The seventh annual Kernel Kup tournament'),
  ('Kernel Kup 8', 18252, 'completed', 'The eighth annual Kernel Kup tournament'),
  ('Kernel Kup: Heaps n'' Hooks', 18401, 'completed', '1v1 mid Pudge tournament'),
  ('Kernel Kup 10', 18910, 'registration_open', 'The tenth annual Kernel Kup tournament - The biggest one yet!')
ON CONFLICT (league_id) DO NOTHING;

-- Success message
SELECT 'Kernel Kup database schema created successfully! 🌽' AS message;
