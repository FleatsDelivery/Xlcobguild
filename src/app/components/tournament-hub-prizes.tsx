/**
 * Tournament Prizes Config
 *
 * Shared by award-master-modal and transparency-page.
 * Exported as an array so both .map() and .find(p => p.key) work.
 */

import { Trophy, Medal, Award } from 'lucide-react';

export const BASE_POOL_TOTAL = 15000; // in cents = $150.00

export const PRIZE_POOL_CONFIG = [
  {
    key: '1st',
    label: '1st Place — Champions',
    percent: 34,
    baseAmount: Math.round(15000 * 0.34), // 5100 cents = $51.00
    description: 'Split equally among winning team members',
    splitNote: 'per player: ~$10.20',
    icon: Trophy,
    color: '#f59e0b',
  },
  {
    key: '2nd',
    label: '2nd Place — Runners Up',
    percent: 20,
    baseAmount: Math.round(15000 * 0.20), // 3000 cents = $30.00
    description: 'Split equally among runner-up team members',
    splitNote: 'per player: ~$6.00',
    icon: Medal,
    color: '#9ca3af',
  },
  {
    key: '3rd',
    label: '3rd Place',
    percent: 13,
    baseAmount: Math.round(15000 * 0.13), // 1950 cents = $19.50
    description: 'Split equally among third-place team members',
    splitNote: 'per player: ~$3.90',
    icon: Award,
    color: '#f97316',
  },
  {
    key: 'staff',
    label: 'Staff Pay',
    percent: 33,
    baseAmount: Math.round(15000 * 0.33), // 4950 cents = $49.50
    description: 'Distributed among casters, producers, lobby hosts',
    splitNote: 'split among staff roles',
    icon: Award,
    color: '#6366f1',
  },
];

export type PrizePlace = (typeof PRIZE_POOL_CONFIG)[number]['key'];
