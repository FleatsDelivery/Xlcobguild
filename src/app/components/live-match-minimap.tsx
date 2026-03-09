/**
 * Live Minimap — Dota 2 minimap with real-time hero positions and tower states.
 *
 * Renders a canvas-based minimap showing:
 * - Hero positions (colored by team, greyscale when dead)
 * - Tower positions from bitmask (green = standing, red = destroyed)
 * - Hero tooltips on hover
 *
 * Coordinate mapping: Dota world coords (~-8288 to +8288) → pixel space.
 * The minimap image is from Valve's CDN.
 */

import { useMemo } from 'react';
import { getHeroImageUrl } from '@/utils/dota-constants';
import type { LiveGame } from './live-match-panel';

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════

// Dota 2 world coordinate bounds (playable area)
const WORLD_MIN = -8288;
const WORLD_MAX = 8288;
const WORLD_RANGE = WORLD_MAX - WORLD_MIN;

// The map PNG has a dark out-of-bounds border around the actual terrain.
// These insets define where the playable terrain sits within the image (0-1 range).
// Tune these if markers look offset — increase to push markers inward, decrease to push outward.
// NOTE: dota-mini-map.png has a visible black outline border. These insets account for that.
// TUNING LOG:
//   0.13 → way too compressed, heroes all clustered in center
//   0.06 → closer but side lanes look like jungle, mid looks right
//   0.02 → current — spreads heroes outward to match actual lane positions
const MAP_INSET = { top: 0.02, right: 0.02, bottom: 0.02, left: 0.02 };

// Dota 2 minimap image — hosted in Supabase public storage
const MINIMAP_URL = 'https://zizrvkkuqzwzxgwpuvxb.supabase.co/storage/v1/object/public/dota-maps/dota-mini-map.png';

// Team colors
const RADIANT_COLOR = '#10b981';
const DIRE_COLOR = '#ef4444';

// Tower positions in Dota world coordinates (approximate)
// Bitmask order: bits 0-10 → T1top, T1mid, T1bot, T2top, T2mid, T2bot, T3top, T3mid, T3bot, T4top, T4bot
const RADIANT_TOWER_POSITIONS: [number, number][] = [
  [-6100, 1800],    // T1 Top
  [-1600, -1200],   // T1 Mid
  [4900, -6100],    // T1 Bot
  [-6100, -800],    // T2 Top
  [-3400, -2400],   // T2 Mid
  [2500, -6100],    // T2 Bot
  [-6600, -3200],   // T3 Top
  [-4700, -4100],   // T3 Mid
  [-3800, -6000],   // T3 Bot
  [-5600, -4200],   // T4 Top (Ancient)
  [-5200, -4800],   // T4 Bot (Ancient)
];

const DIRE_TOWER_POSITIONS: [number, number][] = [
  [-4800, 6000],    // T1 Top
  [500, 400],       // T1 Mid
  [6100, 1800],     // T1 Bot
  [-3200, 6000],    // T2 Top
  [600, 2800],      // T2 Mid
  [6100, 3200],     // T2 Bot
  [3200, 5600],     // T3 Top
  [3800, 5100],     // T3 Mid
  [6100, 4800],     // T3 Bot
  [4800, 5200],     // T4 Top (Ancient)
  [5200, 5600],     // T4 Bot (Ancient)
];

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

/** Convert Dota world coordinates to minimap pixel position (0-1 range, with inset correction) */
function worldToMinimap(x: number, y: number): { px: number; py: number } {
  // Dota Y-axis is inverted (positive = up in game, but down on image)
  const rawPx = (x - WORLD_MIN) / WORLD_RANGE;
  const rawPy = 1 - (y - WORLD_MIN) / WORLD_RANGE;
  // Remap from 0-1 full image space → inset terrain area
  const px = MAP_INSET.left + rawPx * (1 - MAP_INSET.left - MAP_INSET.right);
  const py = MAP_INSET.top + rawPy * (1 - MAP_INSET.top - MAP_INSET.bottom);
  return { px: Math.max(0, Math.min(1, px)), py: Math.max(0, Math.min(1, py)) };
}

/** Check if a tower is standing from the bitmask */
function isTowerAlive(state: number, bit: number): boolean {
  return (state & (1 << bit)) !== 0;
}

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════

interface LiveMinimapProps {
  game: LiveGame;
}

interface HeroMarker {
  id: number;
  name: string;
  playerName: string;
  px: number;
  py: number;
  side: 'radiant' | 'dire';
  isDead: boolean;
  respawnTimer: number;
  ultReady: boolean;
}

export function LiveMinimap({ game }: LiveMinimapProps) {
  const allPlayers = useMemo(() => {
    const markers: HeroMarker[] = [];

    game.radiant_players.forEach(p => {
      if (!p.hero_id) return;
      const { px, py } = worldToMinimap(p.position_x || 0, p.position_y || 0);
      markers.push({
        id: p.hero_id,
        name: p.hero_name,
        playerName: p.name || p.hero_name,
        px, py,
        side: 'radiant',
        isDead: (p.respawn_timer || 0) > 0,
        respawnTimer: p.respawn_timer || 0,
        ultReady: p.ultimate_state === 3,
      });
    });

    game.dire_players.forEach(p => {
      if (!p.hero_id) return;
      const { px, py } = worldToMinimap(p.position_x || 0, p.position_y || 0);
      markers.push({
        id: p.hero_id,
        name: p.hero_name,
        playerName: p.name || p.hero_name,
        px, py,
        side: 'dire',
        isDead: (p.respawn_timer || 0) > 0,
        respawnTimer: p.respawn_timer || 0,
        ultReady: p.ultimate_state === 3,
      });
    });

    return markers;
  }, [game.radiant_players, game.dire_players]);

  // Check if we have any position data (all zeros = no position data from API)
  const hasPositions = allPlayers.some(p => p.px !== 0.5 || p.py !== 0.5);

  return (
    <div className="rounded-xl overflow-hidden border-2 border-border bg-[#0a0e05]">
      {/* Map container — single relative wrapper, aspect-ratio keeps it square */}
      <div className="relative w-full" style={{ aspectRatio: '1/1' }}>
        {/* Minimap background — real Dota 2 map image */}
        <img
          src={MINIMAP_URL}
          alt="Dota 2 minimap"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Tower markers */}
        {RADIANT_TOWER_POSITIONS.map((pos, i) => {
          const alive = isTowerAlive(game.radiant_tower_state, i);
          const { px, py } = worldToMinimap(pos[0], pos[1]);
          return (
            <div
              key={`rt-${i}`}
              className="absolute"
              style={{
                left: `${px * 100}%`,
                top: `${py * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div
                className="w-2 h-2 sm:w-2.5 sm:h-2.5 rotate-45 border"
                style={{
                  backgroundColor: alive ? RADIANT_COLOR : 'transparent',
                  borderColor: alive ? RADIANT_COLOR : '#4b5563',
                  opacity: alive ? 0.9 : 0.3,
                }}
              />
            </div>
          );
        })}

        {DIRE_TOWER_POSITIONS.map((pos, i) => {
          const alive = isTowerAlive(game.dire_tower_state, i);
          const { px, py } = worldToMinimap(pos[0], pos[1]);
          return (
            <div
              key={`dt-${i}`}
              className="absolute"
              style={{
                left: `${px * 100}%`,
                top: `${py * 100}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div
                className="w-2 h-2 sm:w-2.5 sm:h-2.5 rotate-45 border"
                style={{
                  backgroundColor: alive ? DIRE_COLOR : 'transparent',
                  borderColor: alive ? DIRE_COLOR : '#4b5563',
                  opacity: alive ? 0.9 : 0.3,
                }}
              />
            </div>
          );
        })}

        {/* Hero markers */}
        {allPlayers.map((hero) => {
          const color = hero.side === 'radiant' ? RADIANT_COLOR : DIRE_COLOR;
          const heroImgUrl = getHeroImageUrl(hero.id);

          return (
            <div
              key={`hero-${hero.side}-${hero.id}`}
              className="absolute group"
              style={{
                left: `${hero.px * 100}%`,
                top: `${hero.py * 100}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: hero.isDead ? 5 : 10,
              }}
            >
              {/* Hero icon */}
              <div
                className={`relative w-5 h-5 sm:w-6 sm:h-6 rounded-full overflow-hidden border-2 ${hero.isDead ? 'grayscale opacity-40' : ''}`}
                style={{ borderColor: color }}
              >
                <img
                  src={heroImgUrl}
                  alt={hero.name}
                  className="w-full h-full object-cover scale-125"
                  width={24}
                  height={24}
                />
                {hero.isDead && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <span className="text-[7px] font-black text-white">{hero.respawnTimer}</span>
                  </div>
                )}
              </div>

              {/* Ult ready glow */}
              {hero.ultReady && !hero.isDead && (
                <div
                  className="absolute inset-0 rounded-full animate-ping"
                  style={{
                    borderWidth: 1,
                    borderColor: color,
                    opacity: 0.4,
                    width: '100%',
                    height: '100%',
                  }}
                />
              )}

              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 bg-soil/95 text-white text-[9px] font-bold rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 border border-white/10">
                {hero.playerName}
                {hero.isDead && <span className="text-[#ef4444] ml-1">({hero.respawnTimer}s)</span>}
              </div>
            </div>
          );
        })}

        {/* "No position data" overlay when Steam isn't sending coordinates */}
        {!hasPositions && allPlayers.length > 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="text-center">
              <p className="text-white/60 text-xs font-bold">Positions unavailable</p>
              <p className="text-white/30 text-[10px]">Waiting for game data...</p>
            </div>
          </div>
        )}

        {/* Legend — bottom corner */}
        <div className="absolute bottom-1 left-1 flex items-center gap-2.5 px-1.5 py-0.5 rounded bg-black/70 text-[8px] text-white/60 font-semibold">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: RADIANT_COLOR }} />
            Radiant
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: DIRE_COLOR }} />
            Dire
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rotate-45 inline-block" style={{ backgroundColor: '#9ca3af' }} />
            Towers
          </span>
        </div>
      </div>
    </div>
  );
}