import { useEffect, useRef, useState } from 'react';

const STINGER_VIDEO_URL =
  'https://zizrvkkuqzwzxgwpuvxb.supabase.co/storage/v1/object/public/make-4789f4af-kkup-assets/TCF_scene_transition.mp4';

/**
 * Call once on app startup to warm the browser cache.
 * Uses a hidden <link rel="preload"> so the MP4 is already
 * downloaded (or downloading) by the time the user clicks.
 */
export function preloadStingerVideo() {
  if (typeof document === 'undefined') return;
  // Don't add twice
  if (document.querySelector('link[data-stinger-preload]')) return;
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'video';
  link.href = STINGER_VIDEO_URL;
  link.setAttribute('data-stinger-preload', '1');
  document.head.appendChild(link);
}

interface KKupStingerProps {
  onComplete: () => void;
  /** Called partway through the video so the page can navigate behind the stinger */
  onMidpoint?: () => void;
}

export function KKupStinger({ onComplete, onMidpoint }: KKupStingerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const midpointFiredRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const onMidpointRef = useRef(onMidpoint);
  const [fadingOut, setFadingOut] = useState(false);

  // Keep the refs current without re-triggering the effect
  onCompleteRef.current = onComplete;
  onMidpointRef.current = onMidpoint;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      onMidpointRef.current?.();
      onCompleteRef.current();
      return;
    }

    // Just play it — the video is preloaded and should be cached
    video.currentTime = 0;
    video.play().catch(() => {
      // Autoplay blocked or error — skip stinger entirely
      onMidpointRef.current?.();
      onCompleteRef.current();
    });

    // Safety timeout — if video somehow stalls for >10s, bail out
    const safetyTimer = setTimeout(() => {
      if (!midpointFiredRef.current) onMidpointRef.current?.();
      onCompleteRef.current();
    }, 10000);

    const handleTimeUpdate = () => {
      if (midpointFiredRef.current) return;
      if (video.duration && video.currentTime >= video.duration * 0.02) {
        midpointFiredRef.current = true;
        onMidpointRef.current?.();
      }
    };

    const handleEnded = () => {
      clearTimeout(safetyTimer);
      if (!midpointFiredRef.current) {
        midpointFiredRef.current = true;
        onMidpointRef.current?.();
      }
      setFadingOut(true);
      setTimeout(() => onCompleteRef.current(), 250);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);

    return () => {
      clearTimeout(safetyTimer);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center animate-[fadeIn_250ms_ease-out_forwards]"
      style={fadingOut ? { opacity: 0, transition: 'opacity 250ms ease-in' } : undefined}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted={false}
        preload="auto"
        onError={() => {
          onMidpointRef.current?.();
          onCompleteRef.current();
        }}
      >
        <source src={STINGER_VIDEO_URL} type="video/mp4" />
      </video>
    </div>
  );
}