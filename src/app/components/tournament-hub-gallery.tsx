import { Loader2, ImageIcon, Camera } from '@/lib/icons';
import { TournamentHubEmptyState } from './tournament-hub-empty-state';

export interface TournamentHubGalleryProps {
  tournament: any;
  galleryImages: { name: string; url: string }[];
  galleryLoading: boolean;
  galleryLoaded: boolean;
  isFinished: boolean;
  setLightboxIndex: (index: number) => void;
  isRelevant?: boolean;
}

export function TournamentHubGallery({
  tournament,
  galleryImages,
  galleryLoading,
  galleryLoaded,
  isFinished,
  setLightboxIndex,
  isRelevant = true,
}: TournamentHubGalleryProps) {
  // ── EARLY PHASE: Not relevant yet ──
  if (!isRelevant) {
    return (
      <TournamentHubEmptyState
        icon={Camera}
        title="Gallery Populates After Tournament"
        description="Photos and highlights from the tournament will be uploaded here once the event concludes. Check back after the finals!"
      />
    );
  }
  
  // ── Loading state ──
  if (galleryLoading) {
    return (
      <div className="bg-card rounded-2xl border-2 border-border p-12 text-center">
        <Loader2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30 animate-spin" />
        <p className="text-muted-foreground">Loading gallery images...</p>
      </div>
    );
  }

  // ── Empty state for pre-tournament phases ──
  if (!isFinished && (!galleryImages || galleryImages.length === 0)) {
    return (
      <div className="bg-card rounded-2xl border-2 border-border p-12 text-center">
        <Camera className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
        <h3 className="text-xl font-bold text-foreground mb-2">Gallery Coming Soon</h3>
        <p className="text-muted-foreground">
          Photos will be added during and after the tournament.
        </p>
      </div>
    );
  }

  // ── Empty state for finished tournaments with no images ──
  if (galleryLoaded && galleryImages.length === 0) {
    return (
      <div className="bg-card rounded-2xl border-2 border-border p-12 text-center">
        <ImageIcon className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
        <p className="text-muted-foreground">No gallery images available</p>
      </div>
    );
  }

  // ── Gallery grid ──
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-card rounded-2xl border-2 border-border p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <Camera className="w-6 h-6 text-harvest" />
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">Gallery</h2>
            <p className="text-sm text-muted-foreground">
              {galleryImages.length} {galleryImages.length === 1 ? 'photo' : 'photos'}
            </p>
          </div>
        </div>
      </div>

      {/* Image grid */}
      <div className="bg-card rounded-2xl border-2 border-border p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {galleryImages.map((image, index) => (
            <div
              key={index}
              className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-harvest transition-all group"
              onClick={() => setLightboxIndex(index)}
            >
              <img
                src={image.url}
                alt={image.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent text-white text-xs p-2 truncate">
                {image.name}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}