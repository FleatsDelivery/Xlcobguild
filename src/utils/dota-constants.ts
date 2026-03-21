// Dota 2 Hero Constants
// Re-export everything from the centralized dota-heroes library
export { 
  getHeroName, 
  getHeroImageUrl, 
  getHeroImageByName,  // NEW: For when you have hero name string instead of ID
  getHeroFullImageUrl, 
  getHeroIconUrl, 
  HERO_ID_TO_IMAGE, 
  HERO_ID_TO_NAME 
} from '@/lib/dota-heroes';

// Legacy alias for backward compatibility
export { getHeroImageUrl as getHeroImage } from '@/lib/dota-heroes';