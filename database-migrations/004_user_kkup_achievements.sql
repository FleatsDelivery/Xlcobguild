-- ============================================
-- KERNEL KUP ACHIEVEMENTS & TROPHIES
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================

-- Create achievements table
CREATE TABLE IF NOT EXISTS user_kkup_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_type TEXT NOT NULL, -- 'kernel_kup_champion', 'popd_kernel_mvp', 'most_kills', 'runner_up', etc.
  kernel_kup_id UUID NOT NULL REFERENCES kernel_kups(id) ON DELETE CASCADE,
  
  -- Optional metadata for future extensibility
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  awarded_by UUID REFERENCES users(id) ON DELETE SET NULL, -- Admin who manually awarded it
  
  -- Prevent duplicate awards (same user can't win same achievement for same tournament twice)
  UNIQUE(user_id, achievement_type, kernel_kup_id)
);

-- Create indexes for performance
CREATE INDEX idx_user_kkup_achievements_user ON user_kkup_achievements(user_id);
CREATE INDEX idx_user_kkup_achievements_kernel_kup ON user_kkup_achievements(kernel_kup_id);
CREATE INDEX idx_user_kkup_achievements_type ON user_kkup_achievements(achievement_type);

-- Success message
SELECT 'Kernel Kup achievements table created successfully! 🏆🍿' AS message;
