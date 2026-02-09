-- Add prize_pool and cover_photo_url columns to kernel_kups if they don't exist
ALTER TABLE kernel_kups ADD COLUMN IF NOT EXISTS prize_pool TEXT DEFAULT 'TBA';
ALTER TABLE kernel_kups ADD COLUMN IF NOT EXISTS cover_photo_url TEXT;

SELECT 'Added prize_pool and cover_photo_url columns to kernel_kups! 🌽' AS message;
