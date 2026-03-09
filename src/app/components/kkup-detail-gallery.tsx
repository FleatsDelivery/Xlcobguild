/**
 * KKup Detail — Gallery Tab
 */

import { Loader2, Image as ImageIcon } from 'lucide-react';

export interface KKupDetailGalleryProps {
  galleryImages: { name: string; url: string }[];
  galleryLoading: boolean;
  galleryLoaded: boolean;
  setLightboxIndex: (index: number) => void;
}

export function KKupDetailGallery({
  galleryImages, galleryLoading, galleryLoaded, setLightboxIndex,
}: KKupDetailGalleryProps) {
  return (
    <div className="space-y-4">
      {galleryLoading ? (
        <div className="bg-card rounded-2xl border-2 border-border p-12 text-center">
          <Loader2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30 animate-spin" />
          <p className="text-muted-foreground">Loading gallery images...</p>
        </div>
      ) : galleryLoaded && galleryImages.length === 0 ? (
        <div className="bg-card rounded-2xl border-2 border-border p-12 text-center">
          <ImageIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-muted-foreground">No gallery images available yet</p>
        </div>
      ) : (
        <div className="bg-card rounded-2xl border-2 border-border p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {galleryImages.map((image, index) => (
              <div key={index} className="relative" onClick={() => setLightboxIndex(index)}>
                <img src={image.url} alt={image.name} className="w-full h-full object-cover rounded-lg cursor-pointer" />
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-sm p-2">
                  {image.name}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
