import { useEffect, useRef, useState } from 'react';

interface KKupStingerProps {
  onComplete: () => void;
}

export function KKupStinger({ onComplete }: KKupStingerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fadeState, setFadeState] = useState<'fade-in' | 'playing' | 'fade-out'>('fade-in');
  const [videoError, setVideoError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Fade in animation
    setTimeout(() => {
      setFadeState('playing');
    }, 200);

    // Try to play the video
    const playVideo = async () => {
      try {
        video.currentTime = 0;
        await video.play();
      } catch (error) {
        console.error('Failed to play stinger video:', error);
        setVideoError(true);
        // If autoplay fails, complete immediately
        onComplete();
      }
    };

    playVideo();

    // Handle video end - start fade out before completing
    const handleEnded = () => {
      setFadeState('fade-out');
      setTimeout(() => {
        onComplete();
      }, 300); // Wait for fade out animation
    };

    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('ended', handleEnded);
    };
  }, [onComplete]);

  // If video fails to load, don't show anything
  if (videoError) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-black flex items-center justify-center transition-opacity duration-300 ${
        fadeState === 'fade-in' ? 'opacity-0' : fadeState === 'fade-out' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <video
        ref={videoRef}
        className={`w-full h-full object-cover transition-opacity duration-200 ${
          fadeState === 'fade-in' ? 'opacity-0' : 'opacity-100'
        }`}
        playsInline
        muted={false}
        preload="auto"
        onError={() => {
          setVideoError(true);
          onComplete();
        }}
      >
        <source
          src="https://zizrvkkuqzwzxgwpuvxb.supabase.co/storage/v1/object/public/make-4789f4af-kkup-assets/TCF_scene_transition.mp4"
          type="video/mp4"
        />
      </video>
    </div>
  );
}