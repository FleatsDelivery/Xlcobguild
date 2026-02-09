// Dota 2 Item ID to name mapping
// Common items used in competitive Dota

export interface DotaItem {
  id: number;
  name: string;
  displayName: string;
}

export const DOTA_ITEMS: DotaItem[] = [
  // Starting Items
  { id: 29, name: 'branches', displayName: 'Iron Branch' },
  { id: 40, name: 'tango', displayName: 'Tango' },
  { id: 42, name: 'flask', displayName: 'Healing Salve' },
  { id: 43, name: 'clarity', displayName: 'Clarity' },
  { id: 216, name: 'faerie_fire', displayName: 'Faerie Fire' },
  { id: 265, name: 'enchanted_mango', displayName: 'Enchanted Mango' },
  
  // Basic Items
  { id: 182, name: 'stout_shield', displayName: 'Stout Shield' },
  { id: 41, name: 'courier', displayName: 'Animal Courier' },
  { id: 46, name: 'tpscroll', displayName: 'Town Portal Scroll' },
  { id: 237, name: 'ward_observer', displayName: 'Observer Ward' },
  { id: 38, name: 'ward_sentry', displayName: 'Sentry Ward' },
  { id: 39, name: 'dust', displayName: 'Dust of Appearance' },
  { id: 188, name: 'smoke_of_deceit', displayName: 'Smoke of Deceit' },
  
  // Boots
  { id: 29, name: 'boots', displayName: 'Boots of Speed' },
  { id: 48, name: 'power_treads', displayName: 'Power Treads' },
  { id: 50, name: 'phase_boots', displayName: 'Phase Boots' },
  { id: 220, name: 'travel_boots', displayName: 'Boots of Travel' },
  { id: 214, name: 'travel_boots_2', displayName: 'Boots of Travel 2' },
  { id: 231, name: 'arcane_boots', displayName: 'Arcane Boots' },
  { id: 180, name: 'tranquil_boots', displayName: 'Tranquil Boots' },
  { id: 235, name: 'guardian_greaves', displayName: 'Guardian Greaves' },
  
  // Common Items
  { id: 34, name: 'magic_stick', displayName: 'Magic Stick' },
  { id: 37, name: 'magic_wand', displayName: 'Magic Wand' },
  { id: 16, name: 'bracer', displayName: 'Bracer' },
  { id: 15, name: 'wraith_band', displayName: 'Wraith Band' },
  { id: 14, name: 'null_talisman', displayName: 'Null Talisman' },
  { id: 73, name: 'soul_ring', displayName: 'Soul Ring' },
  { id: 77, name: 'ring_of_basilius', displayName: 'Ring of Basilius' },
  { id: 181, name: 'urn_of_shadows', displayName: 'Urn of Shadows' },
  { id: 226, name: 'spirit_vessel', displayName: 'Spirit Vessel' },
  { id: 79, name: 'headdress', displayName: 'Headdress' },
  { id: 240, name: 'wind_lace', displayName: 'Wind Lace' },
  
  // Upgraded Items
  { id: 1, name: 'blink', displayName: 'Blink Dagger' },
  { id: 108, name: 'force_staff', displayName: 'Force Staff' },
  { id: 202, name: 'glimmer_cape', displayName: 'Glimmer Cape' },
  { id: 232, name: 'lotus_orb', displayName: 'Lotus Orb' },
  { id: 254, name: 'aether_lens', displayName: 'Aether Lens' },
  { id: 102, name: 'drum_of_endurance', displayName: 'Drum of Endurance' },
  { id: 86, name: 'medallion_of_courage', displayName: 'Medallion of Courage' },
  { id: 229, name: 'solar_crest', displayName: 'Solar Crest' },
  { id: 94, name: 'vladmir', displayName: "Vladmir's Offering" },
  { id: 116, name: 'mekansm', displayName: 'Mekansm' },
  { id: 92, name: 'buckler', displayName: 'Buckler' },
  { id: 88, name: 'pipe', displayName: 'Pipe of Insight' },
  { id: 172, name: 'crimson_guard', displayName: 'Crimson Guard' },
  
  // Weapons
  { id: 127, name: 'blade_mail', displayName: 'Blade Mail' },
  { id: 2, name: 'blades_of_attack', displayName: 'Blades of Attack' },
  { id: 4, name: 'chainmail', displayName: 'Chainmail' },
  { id: 114, name: 'platemail', displayName: 'Platemail' },
  { id: 17, name: 'mithril_hammer', displayName: 'Mithril Hammer' },
  { id: 135, name: 'javelin', displayName: 'Javelin' },
  { id: 140, name: 'maelstrom', displayName: 'Maelstrom' },
  { id: 147, name: 'mjollnir', displayName: 'Mjollnir' },
  { id: 141, name: 'lesser_crit', displayName: 'Crystalys' },
  { id: 66, name: 'greater_crit', displayName: 'Daedalus' },
  { id: 152, name: 'dragon_lance', displayName: 'Dragon Lance' },
  { id: 236, name: 'hurricane_pike', displayName: 'Hurricane Pike' },
  
  // Armlet, BKB, etc
  { id: 151, name: 'armlet', displayName: 'Armlet of Mordiggian' },
  { id: 116, name: 'black_king_bar', displayName: 'Black King Bar' },
  { id: 139, name: 'monkey_king_bar', displayName: 'Monkey King Bar' },
  { id: 119, name: 'ethereal_blade', displayName: 'Ethereal Blade' },
  { id: 137, name: 'silver_edge', displayName: 'Silver Edge' },
  { id: 133, name: 'shadow_blade', displayName: 'Shadow Blade' },
  
  // Mobility
  { id: 231, name: 'yasha', displayName: 'Yasha' },
  { id: 145, name: 'sange', displayName: 'Sange' },
  { id: 150, name: 'sange_and_yasha', displayName: 'Sange and Yasha' },
  { id: 250, name: 'kaya', displayName: 'Kaya' },
  { id: 251, name: 'kaya_and_sange', displayName: 'Kaya and Sange' },
  { id: 252, name: 'yasha_and_kaya', displayName: 'Yasha and Kaya' },
  { id: 256, name: 'trident', displayName: 'Kaya Sange and Yasha' },
  { id: 96, name: 'euls', displayName: "Eul's Scepter of Divinity" },
  
  // Stat Items
  { id: 75, name: 'ultimate_scepter', displayName: "Aghanim's Scepter" },
  { id: 108, name: 'ultimate_scepter_2', displayName: "Aghanim's Blessing" },
  { id: 249, name: 'ultimate_scepter_roshan', displayName: "Aghanim's Scepter (Roshan)" },
  { id: 609, name: 'aghanims_shard', displayName: "Aghanim's Shard" },
  { id: 1, name: 'refresher', displayName: 'Refresher Orb' },
  { id: 100, name: 'assault', displayName: 'Assault Cuirass' },
  { id: 112, name: 'heart', displayName: 'Heart of Tarrasque' },
  { id: 104, name: 'shivas_guard', displayName: "Shiva's Guard" },
  { id: 98, name: 'sheepstick', displayName: 'Scythe of Vyse' },
  { id: 174, name: 'octarine_core', displayName: 'Octarine Core' },
  { id: 106, name: 'bloodstone', displayName: 'Bloodstone' },
  
  // Damage Items
  { id: 121, name: 'desolator', displayName: 'Desolator' },
  { id: 185, name: 'moon_shard', displayName: 'Moon Shard' },
  { id: 125, name: 'butterfly', displayName: 'Butterfly' },
  { id: 123, name: 'skadi', displayName: 'Eye of Skadi' },
  { id: 110, name: 'abyssal_blade', displayName: 'Abyssal Blade' },
  { id: 143, name: 'bloodthorn', displayName: 'Bloodthorn' },
  { id: 131, name: 'orchid', displayName: 'Orchid Malevolence' },
  { id: 129, name: 'radiance', displayName: 'Radiance' },
  { id: 149, name: 'diffusal_blade', displayName: 'Diffusal Blade' },
  { id: 154, name: 'manta', displayName: 'Manta Style' },
  { id: 117, name: 'linkens_sphere', displayName: "Linken's Sphere" },
  { id: 168, name: 'satanic', displayName: 'Satanic' },
  { id: 36, name: 'helm_of_the_dominator', displayName: 'Helm of the Dominator' },
  { id: 206, name: 'nullifier', displayName: 'Nullifier' },
  { id: 208, name: 'gungir', displayName: 'Gleipnir' },
  { id: 204, name: 'rapier', displayName: 'Divine Rapier' },
  
  // Neutral Items (examples - there are many more)
  { id: 300, name: 'arcane_ring', displayName: 'Arcane Ring' },
  { id: 301, name: 'ocean_heart', displayName: 'Ocean Heart' },
  { id: 302, name: 'broom_handle', displayName: 'Broom Handle' },
  { id: 329, name: 'vampire_fangs', displayName: 'Vampire Fangs' },
  { id: 330, name: 'spell_prism', displayName: 'Spell Prism' },
  { id: 357, name: 'apex', displayName: 'Apex' },
];

/**
 * Get item name by ID
 */
export function getItemName(itemId: number | null | undefined): string {
  if (!itemId) return '';
  const item = DOTA_ITEMS.find(i => i.id === itemId);
  return item?.displayName || `Item ${itemId}`;
}

/**
 * Get item image URL from Dota 2 CDN
 */
export function getItemImageUrl(itemId: number | null | undefined): string {
  if (!itemId) return '';
  const item = DOTA_ITEMS.find(i => i.id === itemId);
  if (!item) return '';
  return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${item.name}.png`;
}

/**
 * Get all heroes as array for dropdowns
 */
export function getAllHeroes(): Array<{ id: number; name: string }> {
  return Object.entries(HERO_ID_TO_NAME).map(([id, name]) => ({
    id: parseInt(id),
    name,
  }));
}

// Import hero data
import { HERO_ID_TO_NAME } from './dota-heroes';
