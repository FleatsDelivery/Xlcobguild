/**
 * Tournament Gallery Tab - Phase-Agnostic
 * 
 * Displays all images from the tournament's storage folder (kernel-kup-{N}/)
 * Includes ALL photos: UI assets (banners, icons), team logos, and event photos
 * Uses react-responsive-masonry for beautiful grid layout
 * Works across all 7 tournament phases
 */

import { useState, useEffect } from 'react';
import { Image as ImageIcon, ExternalLink, AlertCircle } from 'lucide-react';
import Masonry, { ResponsiveMasonry } from 'react-responsive-masonry';
import { useTournament } from '@/app/contexts/tournament-context';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { Footer } from '@/app/components/footer';

interface GalleryImage {
  name: string;
  url: string;
  created_at?: string;
}

export function TournamentGalleryTab() {
  const { tournament } = useTournament();
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  useEffect(() => {
    if (!tournament) return;
    fetchGalleryImages();
  }, [tournament]);

  const fetchGalleryImages = async () => {
    if (!tournament) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/tournaments/${tournament.id}/gallery`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch gallery');
      }

      const data = await response.json();
      setGalleryImages(data.gallery_images || []);
    } catch (err: any) {
      console.error('Failed to fetch gallery images:', err);
      setError(err.message || 'Failed to load gallery');
    } finally {
      setLoading(false);
    }
  };

  if (!tournament) return null;

  // ═══════════════════════════════════════════════════════
  // LOADING STATE
  // ═══════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-harvest/30 border-t-harvest rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading gallery...</p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // ERROR STATE
  // ═══════════════════════════════════════════════════════

  if (error) {
    return (
      <div className="bg-card rounded-2xl border-2 border-error/20 p-8 text-center">
        <AlertCircle className="w-16 h-16 text-error mx-auto mb-4" />
        <h3 className="text-xl font-bold text-foreground mb-2">Failed to Load Gallery</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <button
          onClick={fetchGalleryImages}
          className="px-6 py-3 bg-harvest text-soil font-bold rounded-lg hover:bg-harvest/90 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // EMPTY STATE
  // ═══════════════════════════════════════════════════════

  if (galleryImages.length === 0) {
    return (
      <div className="bg-card rounded-2xl border-2 border-border p-8 text-center">
        <ImageIcon className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-xl font-bold text-foreground mb-2">No Gallery Images Yet</h3>
        <p className="text-muted-foreground">
          Tournament photos and memories will be displayed here once they're uploaded.
        </p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // GALLERY GRID
  // ═══════════════════════════════════════════════════════

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <ImageIcon className="w-6 h-6 text-harvest" />
          <h2 className="text-2xl font-bold text-foreground">
            Tournament Gallery
          </h2>
          <span className="px-3 py-1 bg-harvest/10 text-harvest font-semibold rounded-lg text-sm">
            {galleryImages.length} {galleryImages.length === 1 ? 'photo' : 'photos'}
          </span>
        </div>
      </div>

      {/* Masonry Grid */}
      <ResponsiveMasonry columnsCountBreakPoints={{ 350: 1, 750: 2, 900: 3 }}>
        <Masonry gutter="1rem">
          {galleryImages.map((image, idx) => (
            <div
              key={idx}
              className="bg-card rounded-xl overflow-hidden border-2 border-border hover:border-harvest/30 transition-all group cursor-pointer"
              onClick={() => setLightboxImage(image.url)}
            >
              <div className="relative">
                <img
                  src={image.url}
                  alt={image.name}
                  className="w-full h-auto"
                  loading="lazy"
                />
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-soil/0 group-hover:bg-soil/70 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="text-center space-y-2">
                    <ExternalLink className="w-8 h-8 text-harvest mx-auto" />
                    <p className="text-silk font-semibold">View Full Size</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </Masonry>
      </ResponsiveMasonry>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-soil/95 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 w-12 h-12 bg-card rounded-full flex items-center justify-center text-foreground hover:bg-harvest hover:text-soil transition-all"
          >
            ✕
          </button>
          <img
            src={lightboxImage}
            alt="Gallery image"
            className="max-w-full max-h-full rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
          <a
            href={lightboxImage}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-4 right-4 px-6 py-3 bg-harvest text-soil font-bold rounded-lg hover:bg-harvest/90 transition-colors flex items-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            Open Original
          </a>
        </div>
      )}

      <Footer />
    </div>
  );
}