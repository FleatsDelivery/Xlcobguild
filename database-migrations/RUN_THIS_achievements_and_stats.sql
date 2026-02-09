-- ============================================
-- KERNEL KUP ACHIEVEMENTS & ADVANCED STATS
-- Copy-paste this entire file into Supabase Dashboard → SQL Editor
-- ============================================

-- Step 1: Create achievements table
CREATE TABLE IF NOT EXISTS user_kkup_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_type TEXT NOT NULL, -- 'kernel_kup_champion', 'popd_kernel_mvp', 'runner_up', etc.
  kernel_kup_id UUID NOT NULL REFERENCES kernel_kups(id) ON DELETE CASCADE,
  
  -- Optional metadata for future extensibility
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  awarded_by UUID REFERENCES users(id) ON DELETE SET NULL, -- Admin who manually awarded it
  
  -- Prevent duplicate awards (same user can't win same achievement for same tournament twice)
  UNIQUE(user_id, achievement_type, kernel_kup_id)
);

-- Create indexes for achievements
CREATE INDEX IF NOT EXISTS idx_user_kkup_achievements_user ON user_kkup_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_kkup_achievements_kernel_kup ON user_kkup_achievements(kernel_kup_id);
CREATE INDEX IF NOT EXISTS idx_user_kkup_achievements_type ON user_kkup_achievements(achievement_type);

-- Step 2: Add missing player stats fields
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
SELECT '🏆🍿 Achievement system and advanced stats fields added successfully!' AS message;
