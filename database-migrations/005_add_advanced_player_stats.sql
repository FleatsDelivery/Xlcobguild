-- ============================================
-- ADD ADVANCED PLAYER STATS FIELDS
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================

-- Add missing fields to kkup_match_player_stats
ALTER TABLE kkup_match_player_stats
  ADD COLUMN IF NOT EXISTS gold INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_worth INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS observer_uses INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sentry_uses INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS item_0 INTEGER,
  ADD COLUMN IF NOT EXISTS item_1 INTEGER,
  ADD COLUMN IF NOT EXISTS item_2 INTEGER,
  ADD COLUMN IF NOT EXISTS item_3 INTEGER,
  ADD COLUMN IF NOT EXISTS item_4 INTEGER,
  ADD COLUMN IF NOT EXISTS item_5 INTEGER,
  ADD COLUMN IF NOT EXISTS backpack_0 INTEGER,
  ADD COLUMN IF NOT EXISTS backpack_1 INTEGER,
  ADD COLUMN IF NOT EXISTS backpack_2 INTEGER,
  ADD COLUMN IF NOT EXISTS item_neutral INTEGER;

-- Add OpenDota URL to player profiles
ALTER TABLE kkup_player_profiles
  ADD COLUMN IF NOT EXISTS opendota_url TEXT;

-- Success message
SELECT 'Advanced player stats fields added successfully! 🎮' AS message;
