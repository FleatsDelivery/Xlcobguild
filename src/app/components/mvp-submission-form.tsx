import { useState, useEffect, useRef } from 'react';
import { Button } from '@/app/components/ui/button';
import { Camera, Loader2, Upload, X, TrendingUp, Star, ChevronUp, ChevronDown, Bell, BellOff, Info, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { projectId } from '/utils/supabase/info';
import { SuccessModal } from '@/app/components/success-modal';
import { ConfirmModal } from '@/app/components/confirm-modal';
import { fireMvpConfetti } from '@/lib/confetti';

// --- Image Compression Utility ---
// Compresses images client-side using Canvas API before upload.
// Converts to JPEG at 75% quality and caps dimensions at 1920x1080.
// Typically reduces 2-4MB PNGs down to 200-400KB with no visible quality loss.
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;
const JPEG_QUALITY = 0.75;

function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    // If already small enough (< 200KB), skip compression
    if (file.size < 200 * 1024) {
      resolve(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Scale down if exceeding max dimensions
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Failed to compress image'));
            return;
          }

          // Create a new File with .jpg extension
          const compressedFile = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, '.jpg'),
            { type: 'image/jpeg' }
          );

          console.log(
            `🌽 Image compressed: ${(file.size / 1024).toFixed(0)}KB → ${(compressedFile.size / 1024).toFixed(0)}KB (${Math.round((1 - compressedFile.size / file.size) * 100)}% reduction)`
          );

          resolve(compressedFile);
        },
        'image/jpeg',
        JPEG_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image for compression'));
    };

    img.src = url;
  });
}

type User = {
  id: string;
  discord_username: string;
  discord_avatar: string | null;
  rank_id: number;
  prestige_level: number;
  ranks?: { name: string };
};

type ActionType = 'rank_up' | 'rank_down';

// Rank names for display in smart info banners
const RANK_NAMES = [
  '', // 0 index unused
  'Earwig', 'Ugandan Kob', 'Private Maize', 'Specialist Ingredient',
  'Corporal Corn Bread', 'Sergeant Husk', 'Sergeant Major Fields',
  'Captain Cornhole', 'Major Cob', 'Corn Star', "Pop'd Kernel",
];

type SmartRankUpMode = 'normal' | 'prestige' | 'promote_popd' | 'maxed';

type SmartRankUpInfo = {
  enabled: boolean;
  mode: SmartRankUpMode;
  label: string;
  icon: 'chevron' | 'star' | 'zap';
  description?: string;
  reason?: string;
  // Styling
  activeColor: string;      // bg + border when selected
  inactiveColor: string;    // border + text when not selected
};

type SmartRankDownInfo = {
  enabled: boolean;
  reason?: string;
};

export function MvpSubmissionForm({ user, onRefresh, onBadgeRefresh, locked, variant = 'card' }: { user?: any; onRefresh?: () => Promise<void>; onBadgeRefresh?: () => void; locked?: boolean; variant?: 'card' | 'bare' }) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [matchId, setMatchId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [modal, setModal] = useState<{
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
    helpText?: string;
  } | null>(null);

  // New state for user selection and action
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<ActionType>('rank_up');
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [notifyDiscord, setNotifyDiscord] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fetchedRef = useRef(false);

  // Fetch current user and all users in parallel
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchUsersAndCurrentUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setLoadingUsers(false);
        return;
      }

      const [meRes, usersRes] = await Promise.allSettled([
        fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/auth/me`,
          { headers: { 'Authorization': `Bearer ${session.access_token}` } }
        ),
        supabase
          .from('users')
          .select('id, discord_username, discord_avatar, rank_id, prestige_level, ranks(name)')
          .neq('role', 'guest')
          .order('discord_username', { ascending: true }),
      ]);

      // Process current user
      if (meRes.status === 'fulfilled' && meRes.value.ok) {
        try {
          const meData = await meRes.value.json();
          setCurrentUser(meData.user);
          setSelectedUserId(meData.user.id);
        } catch (err) {
          console.error('Error parsing me response:', err);
        }
      }

      // Process all users
      if (usersRes.status === 'fulfilled' && !usersRes.value.error && usersRes.value.data) {
        setAllUsers(usersRes.value.data);
      } else {
        console.error('Error fetching users:', usersRes.status === 'fulfilled' ? usersRes.value.error : usersRes);
      }

      setLoadingUsers(false);
    };

    fetchUsersAndCurrentUser();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Add paste event listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            handleImageFromPaste(blob);
          }
          e.preventDefault();
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleImageFromPaste = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setModal({
        type: 'error',
        title: 'Invalid File Type',
        message: 'Please paste an image file (PNG, JPG, or WEBP).',
      });
      return;
    }
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setModal({
        type: 'error',
        title: 'File Too Large',
        message: 'Image must be less than 5MB.',
        helpText: 'Try compressing your image or selecting a different screenshot.',
      });
      return;
    }

    setImageFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setModal({
      type: 'success',
      title: '📋 Image Pasted!',
      message: 'Your screenshot has been pasted successfully.',
    });
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setModal({
          type: 'error',
          title: 'Invalid File Type',
          message: 'Please select an image file (PNG, JPG, or WEBP).',
        });
        return;
      }
      
      // Check file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setModal({
          type: 'error',
          title: 'File Too Large',
          message: 'Image must be less than 5MB.',
          helpText: 'Try compressing your image or selecting a different screenshot.',
        });
        return;
      }

      setImageFile(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSubmit = async () => {
    if (!imageFile) {
      setModal({
        type: 'info',
        title: 'Screenshot Required',
        message: 'Please upload an MVP screenshot before submitting.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setModal({
          type: 'error',
          title: 'Authentication Required',
          message: 'Please sign in first.',
        });
        setIsSubmitting(false);
        return;
      }

      // Compress the image before uploading (Canvas API, JPEG @ 75%)
      let fileToUpload = imageFile;
      try {
        fileToUpload = await compressImage(imageFile);
      } catch (compressError) {
        console.warn('Image compression failed, uploading original:', compressError);
        // Fall back to original file if compression fails
      }

      // Upload image to Supabase Storage
      const fileExt = fileToUpload.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `mvp-screenshots/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('make-4789f4af-mvp-screenshots')
        .upload(filePath, fileToUpload, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        setModal({
          type: 'error',
          title: 'Upload Failed',
          message: 'Failed to upload image. Please try again.',
          helpText: uploadError.message || 'Check your internet connection and try again.',
        });
        setIsSubmitting(false);
        return;
      }

      // Submit MVP request with file path (not signed URL)
      // The backend will generate signed URLs when needed
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/requests/mvp`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            screenshot_url: filePath, // Store the file path, not signed URL
            match_id: matchId.trim() || null,
            user_id: selectedUserId,
            action: selectedAction,
            notify_discord: notifyDiscord,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setModal({
          type: 'error',
          title: 'Submission Failed',
          message: data.error || 'Failed to submit MVP request',
          helpText: 'Please try again later or contact support if the issue persists.',
        });
        setIsSubmitting(false);
        return;
      }

      setModal({
        type: 'success',
        title: '🌽 MVP Request Submitted!',
        message: 'Your rank-up request has been submitted successfully.',
        helpText: 'Check the Activity tab in your Inbox to track its status.',
      });
      
      // Reset form
      setImageFile(null);
      setImagePreview(null);
      setMatchId('');
      setIsSubmitting(false);

      // Refresh the user data if provided
      if (onRefresh) {
        await onRefresh();
      }

      // Refresh badges if provided
      if (onBadgeRefresh) {
        await onBadgeRefresh();
      }

      // Fire confetti
      fireMvpConfetti();
    } catch (error) {
      console.error('Error submitting MVP:', error);
      setModal({
        type: 'error',
        title: 'Submission Failed',
        message: 'Failed to submit MVP request. Please try again.',
        helpText: 'If the problem persists, contact support.',
      });
      setIsSubmitting(false);
    }
  };

  const handleUserSelect = (userId: string) => {
    setSelectedUserId(userId);
    setShowUserDropdown(false);
    // Reset to rank_up when changing users
    setSelectedAction('rank_up');
  };

  // ── Smart Action Detection ──
  // Replaces the old 3-button system with intelligent 2-button detection.
  // The Rank Up button morphs based on the target user's state.
  const getSmartRankUpInfo = (): SmartRankUpInfo => {
    if (!selectedUserId) {
      return { enabled: false, mode: 'normal', label: 'Rank Up', icon: 'chevron', reason: 'Select a user first',
        activeColor: '#22c55e', inactiveColor: '#22c55e' };
    }
    const targetUser = allUsers.find(u => u.id === selectedUserId);
    if (!targetUser) {
      return { enabled: false, mode: 'normal', label: 'Rank Up', icon: 'chevron',
        activeColor: '#22c55e', inactiveColor: '#22c55e' };
    }

    const targetMaxRank = targetUser.prestige_level === 5 ? 11 : 10;
    const targetIsAtMaxRank = targetUser.rank_id >= targetMaxRank;
    const targetCanPrestige = targetUser.prestige_level < 5 && targetIsAtMaxRank;

    // Case 1: Target is at Corn Star and can prestige (prestige 0-4, rank 10)
    if (targetCanPrestige) {
      return {
        enabled: true,
        mode: 'prestige',
        label: 'Prestige',
        icon: 'star',
        description: `${targetUser.discord_username} is at Corn Star — this will reset to Rank 1 and prestige ${targetUser.prestige_level} → ${targetUser.prestige_level + 1}`,
        activeColor: '#f59e0b',  // amber
        inactiveColor: '#f59e0b',
      };
    }

    // Case 2: Already at absolute max (rank 11, prestige 5) — Pop'd Kernel and maxed
    if (targetIsAtMaxRank) {
      return {
        enabled: false,
        mode: 'maxed',
        label: 'Rank Up',
        icon: 'chevron',
        reason: `${targetUser.discord_username} is at Pop'd Kernel (max rank & prestige)`,
        activeColor: '#22c55e',
        inactiveColor: '#22c55e',
      };
    }

    // Case 3: Prestige 5, rank 10 → next rank is Pop'd Kernel (rank 11)
    if (targetUser.prestige_level === 5 && targetUser.rank_id === 10) {
      return {
        enabled: true,
        mode: 'promote_popd',
        label: "Pop'd Kernel",
        icon: 'zap',
        description: `This will promote ${targetUser.discord_username} to Pop'd Kernel — the ultimate rank!`,
        activeColor: '#8b5cf6',  // purple
        inactiveColor: '#8b5cf6',
      };
    }

    // Case 4: Normal rank up (rank 1-9 at any prestige, or rank < 10 at prestige 5)
    const nextRank = RANK_NAMES[targetUser.rank_id + 1] || 'Unknown';
    return {
      enabled: true,
      mode: 'normal',
      label: 'Rank Up',
      icon: 'chevron',
      description: `${RANK_NAMES[targetUser.rank_id]} → ${nextRank}`,
      activeColor: '#22c55e',  // green
      inactiveColor: '#22c55e',
    };
  };

  const getSmartRankDownInfo = (): SmartRankDownInfo => {
    if (!currentUser || !selectedUserId) {
      return { enabled: false, reason: 'Select a user first' };
    }
    const targetUser = allUsers.find(u => u.id === selectedUserId);
    if (!targetUser) return { enabled: false };

    const isSelf = currentUser.id === selectedUserId;
    // Only Corn Star (rank 10) can rank down — NOT Pop'd Kernel (rank 11, protected)
    const submitterIsCornStar = currentUser.rank_id === 10;
    const targetIsPopdKernel = targetUser.rank_id === 11 && targetUser.prestige_level === 5;

    if (isSelf) return { enabled: false, reason: 'Cannot rank yourself down' };
    if (!submitterIsCornStar) return { enabled: false, reason: 'Only Corn Star can rank down others' };
    if (targetUser.rank_id <= 1) return { enabled: false, reason: 'User is already at minimum rank' };
    if (targetIsPopdKernel) return { enabled: false, reason: "Pop'd Kernel is protected from de-ranks" };

    return { enabled: true };
  };

  const smartRankUp = getSmartRankUpInfo();
  const smartRankDown = getSmartRankDownInfo();
  const selectedUser = allUsers.find(u => u.id === selectedUserId);

  // Determine if the current selection is valid for submission
  const isActionEnabled = selectedAction === 'rank_up' ? smartRankUp.enabled : smartRankDown.enabled;
  const disabledReason = selectedAction === 'rank_up' ? smartRankUp.reason : smartRankDown.reason;

  // ── Skeleton loading state ──
  if (loadingUsers) {
    const skeletonContent = (
      <>
        {variant === 'card' && (
          <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-muted animate-pulse flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-5 sm:h-6 w-48 bg-muted rounded animate-pulse" />
              <div className="h-3 sm:h-4 w-64 bg-muted rounded animate-pulse" />
            </div>
          </div>
        )}
        <div className="space-y-3 sm:space-y-4">
          {/* Upload area skeleton */}
          <div className="h-40 sm:h-64 bg-muted rounded-xl animate-pulse" />
          {/* Inputs skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="h-4 w-20 bg-muted rounded animate-pulse" />
              <div className="h-12 bg-muted rounded-xl animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              <div className="h-12 bg-muted rounded-xl animate-pulse" />
            </div>
          </div>
          {/* Submit button skeleton */}
          <div className="h-12 bg-muted rounded-xl animate-pulse" />
        </div>
      </>
    );

    if (variant === 'bare') return <div>{skeletonContent}</div>;

    return (
      <div className="bg-gradient-to-br from-[#3b82f6]/10 to-[#3b82f6]/5 rounded-2xl sm:rounded-3xl p-4 sm:p-8 border-2 border-[#3b82f6]/20">
        {skeletonContent}
      </div>
    );
  }

  // ── Form content (shared between card and bare variants) ──
  const formContent = (
    <>
      {/* Locked overlay when onboarding guild step isn't complete */}
      {locked && variant === 'card' && (
        <div className="mb-4 sm:mb-6 bg-muted border-2 border-border rounded-xl p-4 text-center">
          <Shield className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-bold text-muted-foreground">Join a guild to unlock MVP requests</p>
          <p className="text-xs text-muted-foreground mt-1">Complete the onboarding steps above to start ranking up</p>
        </div>
      )}
      <div className={locked && variant === 'card' ? 'opacity-40 pointer-events-none select-none' : ''}>
      {/* Card variant header — hidden in bare mode (modal provides its own) */}
      {variant === 'card' && (
        <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-[#3b82f6] flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base sm:text-xl font-bold text-foreground">Submit MVP Request</h3>
              {/* Discord Notification Toggle */}
              <button
                type="button"
                onClick={() => setNotifyDiscord(!notifyDiscord)}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs font-medium transition-all duration-200 flex-shrink-0 ${
                  notifyDiscord
                    ? 'bg-[#5865F2]/15 text-[#5865F2] border border-[#5865F2]/30'
                    : 'bg-muted text-muted-foreground border border-border'
                }`}
              >
                {notifyDiscord ? (
                  <Bell className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                ) : (
                  <BellOff className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                )}
                <span className="hidden sm:inline">{notifyDiscord ? 'Discord ON' : 'Discord OFF'}</span>
                {/* Toggle track */}
                <div className={`w-7 h-4 rounded-full relative transition-colors duration-200 ${
                  notifyDiscord ? 'bg-[#5865F2]' : 'bg-gray-300'
                }`}>
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    notifyDiscord ? 'translate-x-3.5' : 'translate-x-0.5'
                  }`} />
                </div>
              </button>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-0.5 sm:mt-2">
              Submit an MVP screenshot to rank up yourself or others!
            </p>
          </div>
        </div>
      )}

      {/* Discord toggle for bare variant — compact, inline with form */}
      {variant === 'bare' && (
        <div className="flex items-center justify-end mb-3">
          <button
            type="button"
            onClick={() => setNotifyDiscord(!notifyDiscord)}
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs font-medium transition-all duration-200 flex-shrink-0 ${
              notifyDiscord
                ? 'bg-[#5865F2]/15 text-[#5865F2] border border-[#5865F2]/30'
                : 'bg-muted text-muted-foreground border border-border'
            }`}
          >
            {notifyDiscord ? (
              <Bell className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            ) : (
              <BellOff className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            )}
            <span>{notifyDiscord ? 'Discord ON' : 'Discord OFF'}</span>
            <div className={`w-7 h-4 rounded-full relative transition-colors duration-200 ${
              notifyDiscord ? 'bg-[#5865F2]' : 'bg-gray-300'
            }`}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                notifyDiscord ? 'translate-x-3.5' : 'translate-x-0.5'
              }`} />
            </div>
          </button>
        </div>
      )}

      <div className="space-y-3 sm:space-y-4">
        {/* Image Upload */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5 sm:mb-2">
            MVP Screenshot <span className="text-[#ef4444]">*</span>
          </label>
          
          {imagePreview ? (
            <div className="relative">
              <img 
                src={imagePreview} 
                alt="MVP Preview" 
                className="w-full h-48 sm:h-64 object-cover rounded-xl border-2 border-border"
              />
              <Button
                onClick={handleRemoveImage}
                variant="outline"
                className="absolute top-2 right-2 bg-card/90 hover:bg-card border-2 border-[#ef4444]/30 text-[#ef4444] h-8 w-8 p-0 rounded-lg"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-40 sm:h-64 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-[#3b82f6] transition-colors bg-card">
              <div className="flex flex-col items-center justify-center py-4 sm:pt-5 sm:pb-6">
                <Upload className="w-8 h-8 sm:w-10 sm:h-10 text-muted-foreground mb-2 sm:mb-3" />
                <p className="mb-1 sm:mb-2 text-xs sm:text-sm text-muted-foreground">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-muted-foreground mb-1">
                  or copy paste an image onto this page
                </p>
                <p className="text-xs text-muted-foreground">
                  PNG, JPG, or WEBP (MAX. 5MB)
                </p>
              </div>
              <input 
                type="file" 
                className="hidden" 
                accept="image/*"
                onChange={handleImageSelect}
              />
            </label>
          )}
        </div>

        {/* Match ID + User Selection - Side by side on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Match ID (Optional) */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Match ID <span className="text-muted-foreground">(Optional)</span>
            </label>
            <input
              type="text"
              value={matchId}
              onChange={(e) => setMatchId(e.target.value)}
              placeholder="e.g., 7234567890"
              className="w-full px-4 py-3 rounded-xl border-2 border-border bg-input-background text-foreground focus:border-[#3b82f6] focus:outline-none transition-colors"
            />
          </div>

          {/* Custom User Selection Dropdown */}
          <div ref={dropdownRef}>
            <label className="block text-sm font-medium text-foreground mb-2">
              Select User <span className="text-[#ef4444]">*</span>
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                disabled={loadingUsers}
                className="w-full px-4 py-3 rounded-xl border-2 border-border focus:border-[#3b82f6] focus:outline-none transition-colors bg-input-background text-left flex items-center justify-between"
              >
                {loadingUsers ? (
                  <span className="text-muted-foreground text-sm">Loading users...</span>
                ) : selectedUser ? (
                  <div className="flex items-center gap-2">
                    <img
                      src={selectedUser.discord_avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${selectedUser.discord_username}`}
                      alt={selectedUser.discord_username}
                      className="w-6 h-6 rounded-full"
                      width={24}
                      height={24}
                    />
                    <span className="text-sm text-foreground">{selectedUser.discord_username}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">Choose a user...</span>
                )}
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>

              {/* Dropdown Menu */}
              {showUserDropdown && !loadingUsers && (
                <div className="absolute z-50 w-full mt-1 bg-popover border-2 border-border rounded-xl shadow-lg max-h-60 overflow-y-auto">
                  {allUsers.map(user => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleUserSelect(user.id)}
                      className="w-full px-4 py-2.5 text-left hover:bg-[#3b82f6]/5 transition-colors flex items-center gap-3 border-b border-border last:border-b-0"
                    >
                      <img
                        src={user.discord_avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${user.discord_username}`}
                        alt={user.discord_username}
                        className="w-8 h-8 rounded-full flex-shrink-0"
                        width={32}
                        height={32}
                      />
                      <span className="text-sm text-foreground font-medium">{user.discord_username}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Smart Action Selection — 2 Buttons */}
        {selectedUserId && (
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Action <span className="text-[#ef4444]">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {/* Smart Rank Up / Prestige / Pop'd Kernel Button */}
              <button
                type="button"
                onClick={() => smartRankUp.enabled && setSelectedAction('rank_up')}
                disabled={!smartRankUp.enabled}
                title={smartRankUp.reason}
                className={`flex items-center justify-center gap-1.5 sm:gap-2 py-3 px-3 sm:px-4 rounded-xl border-2 transition-all ${
                  selectedAction === 'rank_up' && smartRankUp.enabled
                    ? `text-white shadow-lg`
                    : smartRankUp.enabled
                      ? `bg-card hover:bg-opacity-10`
                      : 'bg-card opacity-50 cursor-not-allowed'
                }`}
                style={
                  selectedAction === 'rank_up' && smartRankUp.enabled
                    ? { backgroundColor: smartRankUp.activeColor, borderColor: smartRankUp.activeColor }
                    : smartRankUp.enabled
                      ? { borderColor: `${smartRankUp.inactiveColor}40`, color: smartRankUp.inactiveColor }
                      : { borderColor: '#22c55e40', color: '#22c55e' }
                }
              >
                {smartRankUp.icon === 'star' ? (
                  <Star className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : smartRankUp.icon === 'zap' ? (
                  <span className="text-sm sm:text-base">💥</span>
                ) : (
                  <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" />
                )}
                <span className="text-xs sm:text-sm font-semibold">{smartRankUp.label}</span>
              </button>

              {/* Rank Down Button */}
              <button
                type="button"
                onClick={() => smartRankDown.enabled && setSelectedAction('rank_down')}
                disabled={!smartRankDown.enabled}
                title={smartRankDown.reason}
                className={`flex items-center justify-center gap-1.5 sm:gap-2 py-3 px-3 sm:px-4 rounded-xl border-2 transition-all ${
                  selectedAction === 'rank_down' && smartRankDown.enabled
                    ? 'bg-[#ef4444] border-[#ef4444] text-white shadow-lg'
                    : smartRankDown.enabled
                      ? 'bg-card border-[#ef4444]/30 text-[#ef4444] hover:border-[#ef4444] hover:bg-[#ef4444]/10'
                      : 'bg-card border-[#ef4444]/30 text-[#ef4444] opacity-50 cursor-not-allowed'
                }`}
              >
                <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-xs sm:text-sm font-semibold">Rank Down</span>
              </button>
            </div>

            {/* Smart Info Banner — shows what will happen */}
            {selectedAction === 'rank_up' && smartRankUp.enabled && smartRankUp.description && (
              <div className={`mt-2.5 px-3 py-2 rounded-lg text-xs leading-relaxed flex items-start gap-2 ${
                smartRankUp.mode === 'prestige'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : smartRankUp.mode === 'promote_popd'
                    ? 'bg-purple-50 text-purple-800 border border-purple-200'
                    : 'bg-green-50 text-green-800 border border-green-200'
              }`}>
                <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>{smartRankUp.description}</span>
              </div>
            )}

            {/* Disabled reason */}
            {!isActionEnabled && disabledReason && (
              <p className="text-xs text-[#ef4444] mt-2 flex items-center gap-1">
                <span>⚠️</span>
                {disabledReason}
              </p>
            )}
          </div>
        )}

        {/* Submit Button */}
        <Button 
          onClick={() => setShowConfirm(true)}
          className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white h-12 rounded-xl font-semibold" 
          disabled={isSubmitting || !imageFile || !selectedUserId || !isActionEnabled || locked}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Uploading...
            </>
          ) : (
            <>
              <Camera className="w-5 h-5 mr-2" />
              Submit MVP Request
            </>
          )}
        </Button>
      </div>
    </div>
    </>
  );

  // ── Bare variant: no outer chrome ──
  if (variant === 'bare') {
    return (
      <>
        {formContent}

        {/* Confirmation Modal */}
        {showConfirm && (
          <ConfirmModal
            title="Submit MVP Request?"
            message={(() => {
              const targetUser = allUsers.find(u => u.id === selectedUserId);
              if (selectedAction === 'rank_down') {
                return `Submit this MVP request to rank down ${targetUser?.discord_username || 'this user'}?`;
              }
              if (smartRankUp.mode === 'prestige') {
                return `Submit this MVP request to prestige ${targetUser?.discord_username || 'this user'}? This will reset their rank to Earwig and increase prestige to ${(targetUser?.prestige_level || 0) + 1}.`;
              }
              if (smartRankUp.mode === 'promote_popd') {
                return `Submit this MVP request to promote ${targetUser?.discord_username || 'this user'} to Pop'd Kernel? This is the ultimate rank!`;
              }
              return `Submit this MVP request to rank up ${targetUser?.discord_username || 'this user'}?`;
            })()}
            confirmText="Submit Request"
            confirmVariant="primary"
            onConfirm={() => {
              setShowConfirm(false);
              handleSubmit();
            }}
            onCancel={() => setShowConfirm(false)}
          />
        )}

        {/* Modal */}
        {modal && (
          <SuccessModal
            type={modal.type}
            title={modal.title}
            message={modal.message}
            helpText={modal.helpText}
            onClose={() => setModal(null)}
          />
        )}
      </>
    );
  }

  // ── Card variant: full chrome ──
  return (
    <div className="bg-gradient-to-br from-[#3b82f6]/10 to-[#3b82f6]/5 rounded-2xl sm:rounded-3xl p-4 sm:p-8 border-2 border-[#3b82f6]/20">
      {formContent}

      {/* Confirmation Modal */}
      {showConfirm && (
        <ConfirmModal
          title="Submit MVP Request?"
          message={(() => {
            const targetUser = allUsers.find(u => u.id === selectedUserId);
            if (selectedAction === 'rank_down') {
              return `Submit this MVP request to rank down ${targetUser?.discord_username || 'this user'}?`;
            }
            // Smart rank up messaging
            if (smartRankUp.mode === 'prestige') {
              return `Submit this MVP request to prestige ${targetUser?.discord_username || 'this user'}? This will reset their rank to Earwig and increase prestige to ${(targetUser?.prestige_level || 0) + 1}.`;
            }
            if (smartRankUp.mode === 'promote_popd') {
              return `Submit this MVP request to promote ${targetUser?.discord_username || 'this user'} to Pop'd Kernel? This is the ultimate rank!`;
            }
            return `Submit this MVP request to rank up ${targetUser?.discord_username || 'this user'}?`;
          })()}
          confirmText="Submit Request"
          confirmVariant="primary"
          onConfirm={() => {
            setShowConfirm(false);
            handleSubmit();
          }}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {/* Modal */}
      {modal && (
        <SuccessModal
          type={modal.type}
          title={modal.title}
          message={modal.message}
          helpText={modal.helpText}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}