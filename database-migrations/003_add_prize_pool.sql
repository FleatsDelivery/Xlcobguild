-- Add prize_pool column to kernel_kups if it doesn't exist
ALTER TABLE kernel_kups ADD COLUMN IF NOT EXISTS prize_pool TEXT DEFAULT 'TBA';

SELECT 'Added prize_pool column to kernel_kups! 🌽' AS message;
