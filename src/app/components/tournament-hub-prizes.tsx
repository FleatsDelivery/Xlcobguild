/**
 * Tournament Prizes Config - STUB FILE
 * 
 * This is a temporary stub extracted from tournament-hub to prevent import errors.
 * This config is still used by award-master-modal and transparency-page.
 */

export const BASE_POOL_TOTAL = 1000;

export const PRIZE_POOL_CONFIG = {
  '1st': { percentage: 50, amount: 500, icon: '🥇', color: '#fbbf24' },
  '2nd': { percentage: 30, amount: 300, icon: '🥈', color: '#9ca3af' },
  '3rd': { percentage: 20, amount: 200, icon: '🥉', color: '#f97316' },
} as const;

export type PrizePlace = keyof typeof PRIZE_POOL_CONFIG;
