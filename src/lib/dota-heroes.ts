// ═══════════════════════════════════════════════════════
// DYNAMIC HERO CACHE — fetches from OpenDota to cover newly added heroes
// ═══════════════════════════════════════════════════════

/** Runtime cache: hero_id → { name, internal_name } fetched from OpenDota */
let _dynamicHeroCache: Record<number, { name: string; internal_name: string }> | null = null;
let _dynamicHeroFetchPromise: Promise<void> | null = null;

/** Fetch all heroes from OpenDota and cache. Call once on app load or first miss. */
export async function ensureDynamicHeroCache(): Promise<void> {
  if (_dynamicHeroCache) return;
  if (_dynamicHeroFetchPromise) { await _dynamicHeroFetchPromise; return; }

  _dynamicHeroFetchPromise = (async () => {
    try {
      const res = await fetch('https://api.opendota.com/api/heroes');
      if (res.ok) {
        const heroes = await res.json();
        const cache: Record<number, { name: string; internal_name: string }> = {};
        for (const hero of heroes) {
          if (hero.id && hero.localized_name) {
            const internal = (hero.name || '').replace(/^npc_dota_hero_/, '');
            cache[hero.id] = { name: hero.localized_name, internal_name: internal };
          }
        }
        if (Object.keys(cache).length > 50) {
          _dynamicHeroCache = cache;
          // Also backfill the static maps for immediate use
          for (const [id, data] of Object.entries(cache)) {
            const numId = Number(id);
            if (!HERO_ID_TO_IMAGE[numId]) HERO_ID_TO_IMAGE[numId] = data.internal_name;
            if (!HERO_ID_TO_NAME[numId]) HERO_ID_TO_NAME[numId] = data.name;
          }
          // Clear name→id cache so it rebuilds with new entries
          _nameToIdCache = null;
          console.log(`[dota-heroes] Dynamic hero cache loaded: ${Object.keys(cache).length} heroes`);
        }
      }
    } catch (err) {
      console.warn('[dota-heroes] Failed to fetch dynamic hero data:', err);
    }
    if (!_dynamicHeroCache) _dynamicHeroCache = {};
  })();

  await _dynamicHeroFetchPromise;
}

// Hero ID to CDN name mapping
// Source: OpenDota API hero data
// https://api.opendota.com/api/heroes

export const HERO_ID_TO_IMAGE: Record<number, string> = {
  1: 'antimage',
  2: 'axe',
  3: 'bane',
  4: 'bloodseeker',
  5: 'crystal_maiden',
  6: 'drow_ranger',
  7: 'earthshaker',
  8: 'juggernaut',
  9: 'mirana',
  10: 'morphling',
  11: 'nevermore', // Shadow Fiend
  12: 'phantom_lancer',
  13: 'puck',
  14: 'pudge',
  15: 'razor',
  16: 'sand_king',
  17: 'storm_spirit',
  18: 'sven',
  19: 'tiny',
  20: 'vengefulspirit',
  21: 'windrunner', // Windranger
  22: 'zuus', // Zeus
  23: 'kunkka',
  25: 'lina',
  26: 'lion',
  27: 'shadow_shaman',
  28: 'slardar',
  29: 'tidehunter',
  30: 'witch_doctor',
  31: 'lich',
  32: 'riki',
  33: 'enigma',
  34: 'tinker',
  35: 'sniper',
  36: 'necrolyte', // Necrophos
  37: 'warlock',
  38: 'beastmaster',
  39: 'queenofpain',
  40: 'venomancer',
  41: 'faceless_void',
  42: 'skeleton_king', // Wraith King
  43: 'death_prophet',
  44: 'phantom_assassin',
  45: 'pugna',
  46: 'templar_assassin',
  47: 'viper',
  48: 'luna',
  49: 'dragon_knight',
  50: 'dazzle',
  51: 'rattletrap', // Clockwerk
  52: 'leshrac',
  53: 'furion', // Nature's Prophet
  54: 'life_stealer',
  55: 'dark_seer',
  56: 'clinkz',
  57: 'omniknight',
  58: 'enchantress',
  59: 'huskar',
  60: 'night_stalker',
  61: 'broodmother',
  62: 'bounty_hunter',
  63: 'weaver',
  64: 'jakiro',
  65: 'batrider',
  66: 'chen',
  67: 'spectre',
  68: 'ancient_apparition',
  69: 'doom_bringer', // Doom
  70: 'ursa',
  71: 'spirit_breaker',
  72: 'gyrocopter',
  73: 'alchemist',
  74: 'invoker',
  75: 'silencer',
  76: 'obsidian_destroyer', // Outworld Destroyer
  77: 'lycan',
  78: 'brewmaster',
  79: 'shadow_demon',
  80: 'lone_druid',
  81: 'chaos_knight',
  82: 'meepo',
  83: 'treant',
  84: 'ogre_magi',
  85: 'undying',
  86: 'rubick',
  87: 'disruptor',
  88: 'nyx_assassin',
  89: 'naga_siren',
  90: 'keeper_of_the_light',
  91: 'wisp', // Io
  92: 'visage',
  93: 'slark',
  94: 'medusa',
  95: 'troll_warlord',
  96: 'centaur',
  97: 'magnataur',
  98: 'shredder', // Timbersaw
  99: 'bristleback',
  100: 'tusk',
  101: 'skywrath_mage',
  102: 'abaddon',
  103: 'elder_titan',
  104: 'legion_commander',
  105: 'techies',
  106: 'ember_spirit',
  107: 'earth_spirit',
  108: 'abyssal_underlord', // Underlord
  109: 'terrorblade',
  110: 'phoenix',
  111: 'oracle',
  112: 'winter_wyvern',
  113: 'arc_warden',
  114: 'monkey_king',
  119: 'dark_willow',
  120: 'pangolier',
  121: 'grimstroke',
  123: 'hoodwink',
  126: 'void_spirit',
  128: 'snapfire',
  129: 'mars',
  135: 'dawnbreaker',
  136: 'marci',
  137: 'primal_beast',
  138: 'muerta',
  145: 'ringmaster',
  146: 'kez',
};

// Hero ID to Display Name mapping
export const HERO_ID_TO_NAME: Record<number, string> = {
  1: 'Anti-Mage',
  2: 'Axe',
  3: 'Bane',
  4: 'Bloodseeker',
  5: 'Crystal Maiden',
  6: 'Drow Ranger',
  7: 'Earthshaker',
  8: 'Juggernaut',
  9: 'Mirana',
  10: 'Morphling',
  11: 'Shadow Fiend',
  12: 'Phantom Lancer',
  13: 'Puck',
  14: 'Pudge',
  15: 'Razor',
  16: 'Sand King',
  17: 'Storm Spirit',
  18: 'Sven',
  19: 'Tiny',
  20: 'Vengeful Spirit',
  21: 'Windranger',
  22: 'Zeus',
  23: 'Kunkka',
  25: 'Lina',
  26: 'Lion',
  27: 'Shadow Shaman',
  28: 'Slardar',
  29: 'Tidehunter',
  30: 'Witch Doctor',
  31: 'Lich',
  32: 'Riki',
  33: 'Enigma',
  34: 'Tinker',
  35: 'Sniper',
  36: 'Necrophos',
  37: 'Warlock',
  38: 'Beastmaster',
  39: 'Queen of Pain',
  40: 'Venomancer',
  41: 'Faceless Void',
  42: 'Wraith King',
  43: 'Death Prophet',
  44: 'Phantom Assassin',
  45: 'Pugna',
  46: 'Templar Assassin',
  47: 'Viper',
  48: 'Luna',
  49: 'Dragon Knight',
  50: 'Dazzle',
  51: 'Clockwerk',
  52: 'Leshrac',
  53: "Nature's Prophet",
  54: 'Lifestealer',
  55: 'Dark Seer',
  56: 'Clinkz',
  57: 'Omniknight',
  58: 'Enchantress',
  59: 'Huskar',
  60: 'Night Stalker',
  61: 'Broodmother',
  62: 'Bounty Hunter',
  63: 'Weaver',
  64: 'Jakiro',
  65: 'Batrider',
  66: 'Chen',
  67: 'Spectre',
  68: 'Ancient Apparition',
  69: 'Doom',
  70: 'Ursa',
  71: 'Spirit Breaker',
  72: 'Gyrocopter',
  73: 'Alchemist',
  74: 'Invoker',
  75: 'Silencer',
  76: 'Outworld Destroyer',
  77: 'Lycan',
  78: 'Brewmaster',
  79: 'Shadow Demon',
  80: 'Lone Druid',
  81: 'Chaos Knight',
  82: 'Meepo',
  83: 'Treant Protector',
  84: 'Ogre Magi',
  85: 'Undying',
  86: 'Rubick',
  87: 'Disruptor',
  88: 'Nyx Assassin',
  89: 'Naga Siren',
  90: 'Keeper of the Light',
  91: 'Io',
  92: 'Visage',
  93: 'Slark',
  94: 'Medusa',
  95: 'Troll Warlord',
  96: 'Centaur Warrunner',
  97: 'Magnus',
  98: 'Timbersaw',
  99: 'Bristleback',
  100: 'Tusk',
  101: 'Skywrath Mage',
  102: 'Abaddon',
  103: 'Elder Titan',
  104: 'Legion Commander',
  105: 'Techies',
  106: 'Ember Spirit',
  107: 'Earth Spirit',
  108: 'Underlord',
  109: 'Terrorblade',
  110: 'Phoenix',
  111: 'Oracle',
  112: 'Winter Wyvern',
  113: 'Arc Warden',
  114: 'Monkey King',
  119: 'Dark Willow',
  120: 'Pangolier',
  121: 'Grimstroke',
  123: 'Hoodwink',
  126: 'Void Spirit',
  128: 'Snapfire',
  129: 'Mars',
  135: 'Dawnbreaker',
  136: 'Marci',
  137: 'Primal Beast',
  138: 'Muerta',
  145: 'Ringmaster',
  146: 'Kez',
};

/**
 * Get the hero display name from hero ID
 * @param heroId - The Dota 2 hero ID
 * @returns Hero display name (e.g., "Anti-Mage")
 */
export function getHeroName(heroId: number): string {
  return HERO_ID_TO_NAME[heroId] || `Hero ${heroId}`;
}

/**
 * Get the hero portrait image URL from OpenDota CDN
 * @param heroId - The Dota 2 hero ID
 * @returns URL to the hero portrait image
 */
export function getHeroImageUrl(heroId: number): string {
  const heroName = HERO_ID_TO_IMAGE[heroId];
  if (!heroName) {
    console.warn(`Unknown hero ID: ${heroId}`);
    return ''; // Return empty string for unknown heroes
  }
  // Use Steam's CDN which is more reliable
  return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${heroName}.png`;
}

/**
 * Get the hero full portrait image URL (larger version)
 * @param heroId - The Dota 2 hero ID
 * @returns URL to the hero full portrait image
 */
export function getHeroFullImageUrl(heroId: number): string {
  const heroName = HERO_ID_TO_IMAGE[heroId];
  if (!heroName) {
    console.warn(`Unknown hero ID: ${heroId}`);
    return '';
  }
  return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${heroName}.png`;
}

/**
 * Get the hero icon URL (small version)
 * @param heroId - The Dota 2 hero ID
 * @returns URL to the hero icon
 */
export function getHeroIconUrl(heroId: number): string {
  const heroName = HERO_ID_TO_IMAGE[heroId];
  if (!heroName) {
    console.warn(`Unknown hero ID: ${heroId}`);
    return '';
  }
  return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/icons/${heroName}.png`;
}

// Reverse lookup: Display Name → Hero ID (built lazily)
let _nameToIdCache: Record<string, number> | null = null;
function getNameToIdMap(): Record<string, number> {
  if (!_nameToIdCache) {
    _nameToIdCache = {};
    for (const [id, name] of Object.entries(HERO_ID_TO_NAME)) {
      _nameToIdCache[name.toLowerCase()] = Number(id);
    }
  }
  return _nameToIdCache;
}

/**
 * Get hero portrait image URL from hero display name (e.g. "Disruptor")
 * Useful when you only have a name string (e.g. from KKup match stats)
 */
export function getHeroImageByName(heroName: string): string {
  const map = getNameToIdMap();
  const heroId = map[heroName.toLowerCase()];
  if (!heroId) return '';
  return getHeroImageUrl(heroId);
}