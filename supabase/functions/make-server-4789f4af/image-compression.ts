/**
 * Image Compression Utility -- Server-Side
 * 
 * Compresses uploaded images (PNG/JPG) to reduce storage costs.
 * Uses browser-standard APIs available in Deno Deploy.
 * 
 * Target: Keep images under 200KB for team logos, 500KB for banners
 */

/**
 * Compress an image file to target size
 * 
 * @param file - Original file (File or Blob)
 * @param maxWidth - Max width in pixels (default: 800 for logos, 1920 for banners)
 * @param quality - JPEG quality 0-1 (default: 0.85)
 * @returns Compressed Blob
 */
export async function compressImage(
  file: File | Blob,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    format?: 'png' | 'jpeg';
  } = {}
): Promise<Blob> {
  const {
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.85,
    format = 'jpeg',
  } = options;

  try {
    // For Deno, we need to use a different approach since we don't have canvas/sharp
    // We'll use the Web APIs available in Deno Deploy
    
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // For now, we'll return the original file if it's already small enough
    // In production, you'd use a library like 'imagescript' from npm
    const MAX_SIZE = format === 'jpeg' ? 200 * 1024 : 300 * 1024; // 200KB for JPEG, 300KB for PNG
    
    if (arrayBuffer.byteLength <= MAX_SIZE) {
      console.log(`Image already under ${MAX_SIZE / 1024}KB, skipping compression`);
      return file;
    }

    // TODO: Implement actual compression using imagescript or similar
    // For now, just return the original file
    console.warn('Image compression not yet implemented - returning original file');
    return file;
    
  } catch (error) {
    console.error('Image compression failed:', error);
    // On error, return original file
    return file;
  }
}

/**
 * Validate image file type
 */
export function isValidImageType(mimeType: string): boolean {
  return mimeType === 'image/png' || mimeType === 'image/jpeg' || mimeType === 'image/jpg';
}

/**
 * Get recommended compression settings for different asset types
 */
export function getCompressionSettings(assetType: 'team_logo' | 'banner' | 'icon' | 'gallery') {
  switch (assetType) {
    case 'team_logo':
      return { maxWidth: 512, maxHeight: 512, quality: 0.85, format: 'png' as const };
    case 'banner':
      return { maxWidth: 1920, maxHeight: 1080, quality: 0.90, format: 'jpeg' as const };
    case 'icon':
      return { maxWidth: 256, maxHeight: 256, quality: 0.85, format: 'png' as const };
    case 'gallery':
      return { maxWidth: 1200, maxHeight: 1200, quality: 0.85, format: 'jpeg' as const };
    default:
      return { maxWidth: 800, maxHeight: 800, quality: 0.85, format: 'jpeg' as const };
  }
}
