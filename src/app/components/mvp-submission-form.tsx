import { useState, useEffect, useRef } from 'react';
import { Button } from '@/app/components/ui/button';
import { Camera, Loader2, Upload, X, TrendingUp, Clipboard, User as UserIcon, Star, ChevronUp, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { projectId } from '/utils/supabase/info';
import { SuccessModal } from '@/app/components/success-modal';
import { ConfirmModal } from '@/app/components/confirm-modal';

type User = {
  id: string;
  discord_username: string;
  discord_avatar: string | null;
  rank_id: number;
  prestige_level: number;
  ranks?: { name: string };
};

type ActionType = 'rank_up' | 'rank_down' | 'prestige';

export function MvpSubmissionForm({ user, onRefresh }: { user?: any; onRefresh?: () => Promise<void> }) {
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch current user and all users
  useEffect(() => {
    const fetchUsersAndCurrentUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setLoadingUsers(false);
        return;
      }

      // Fetch current user info
      const meResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/auth/me`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (meResponse.ok) {
        const meData = await meResponse.json();
        setCurrentUser(meData.user);
        setSelectedUserId(meData.user.id); // Default to current user
      }

      // Fetch all users for selection
      const { data, error } = await supabase
        .from('users')
        .select('id, discord_username, discord_avatar, rank_id, prestige_level, ranks(name)')
        .neq('role', 'guest')
        .order('discord_username', { ascending: true });

      if (error) {
        console.error('Error fetching users:', error);
        setLoadingUsers(false);
        return;
      }

      setAllUsers(data);
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

      // Upload image to Supabase Storage
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `mvp-screenshots/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('make-4789f4af-mvp-screenshots')
        .upload(filePath, imageFile, {
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
        helpText: 'Check the Requests tab to track its status.',
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

  // Determine which actions are available for the selected user
  const getAvailableActions = (): {
    rank_up: { enabled: boolean; reason?: string };
    rank_down: { enabled: boolean; reason?: string };
    prestige: { enabled: boolean; reason?: string };
  } => {
    if (!currentUser || !selectedUserId) {
      return {
        rank_up: { enabled: false, reason: 'Select a user first' },
        rank_down: { enabled: false, reason: 'Select a user first' },
        prestige: { enabled: false, reason: 'Select a user first' },
      };
    }

    const targetUser = allUsers.find(u => u.id === selectedUserId);
    if (!targetUser) {
      return {
        rank_up: { enabled: false },
        rank_down: { enabled: false },
        prestige: { enabled: false },
      };
    }

    const isSelf = currentUser.id === selectedUserId;
    const currentUserIsRank10 = currentUser.prestige_level === 5 
      ? currentUser.rank_id >= 11 
      : currentUser.rank_id >= 10;

    // Max rank depends on prestige level
    const targetMaxRank = targetUser.prestige_level === 5 ? 11 : 10;
    const targetIsAtMaxRank = targetUser.rank_id >= targetMaxRank;
    const targetCanPrestige = targetUser.prestige_level < 5 && targetIsAtMaxRank;

    return {
      rank_up: {
        enabled: !targetIsAtMaxRank || (targetIsAtMaxRank && !targetCanPrestige),
        reason: targetIsAtMaxRank && targetCanPrestige 
          ? 'User is at max rank - use Prestige instead' 
          : targetIsAtMaxRank 
            ? 'User is at max prestige and rank' 
            : undefined,
      },
      rank_down: {
        enabled: !isSelf && currentUserIsRank10 && targetUser.rank_id > 1,
        reason: isSelf 
          ? 'Cannot rank yourself down' 
          : !currentUserIsRank10 
            ? 'Only Rank 10 players can rank down others' 
            : targetUser.rank_id <= 1 
              ? 'User is already at minimum rank' 
              : undefined,
      },
      prestige: {
        enabled: currentUserIsRank10 && targetCanPrestige,
        reason: !currentUserIsRank10 
          ? 'Only Rank 10 players can prestige others' 
          : targetUser.prestige_level >= 5 
            ? 'User is at max prestige level' 
            : !targetIsAtMaxRank 
              ? 'User must be at max rank to prestige' 
              : undefined,
      },
    };
  };

  const availableActions = getAvailableActions();
  const selectedUser = allUsers.find(u => u.id === selectedUserId);

  return (
    <div className="bg-gradient-to-br from-[#3b82f6]/10 to-[#3b82f6]/5 rounded-3xl p-4 sm:p-8 border-2 border-[#3b82f6]/20">
      <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#3b82f6] flex items-center justify-center flex-shrink-0">
          <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg sm:text-xl font-bold text-[#0f172a] mb-1 sm:mb-2">Submit MVP Request</h3>
          <p className="text-xs sm:text-sm text-[#0f172a]/70 leading-relaxed">
            Submit an MVP screenshot to rank up yourself or others!
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Image Upload */}
        <div>
          <label className="block text-sm font-medium text-[#0f172a] mb-2">
            MVP Screenshot <span className="text-[#ef4444]">*</span>
          </label>
          
          {imagePreview ? (
            <div className="relative">
              <img 
                src={imagePreview} 
                alt="MVP Preview" 
                className="w-full h-64 object-cover rounded-xl border-2 border-[#0f172a]/10"
              />
              <Button
                onClick={handleRemoveImage}
                variant="outline"
                className="absolute top-2 right-2 bg-white/90 hover:bg-white border-2 border-[#ef4444]/30 text-[#ef4444] h-8 w-8 p-0 rounded-lg"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-[#0f172a]/20 rounded-xl cursor-pointer hover:border-[#3b82f6] transition-colors bg-white">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="w-10 h-10 text-[#0f172a]/40 mb-3" />
                <p className="mb-2 text-sm text-[#0f172a]/70">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-[#0f172a]/60 mb-1">
                  or copy paste an image onto this page
                </p>
                <p className="text-xs text-[#0f172a]/50">
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
            <label className="block text-sm font-medium text-[#0f172a] mb-2">
              Match ID <span className="text-[#0f172a]/40">(Optional)</span>
            </label>
            <input
              type="text"
              value={matchId}
              onChange={(e) => setMatchId(e.target.value)}
              placeholder="e.g., 7234567890"
              className="w-full px-4 py-3 rounded-xl border-2 border-[#0f172a]/10 focus:border-[#3b82f6] focus:outline-none transition-colors"
            />
          </div>

          {/* Custom User Selection Dropdown */}
          <div ref={dropdownRef}>
            <label className="block text-sm font-medium text-[#0f172a] mb-2">
              Select User <span className="text-[#ef4444]">*</span>
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                disabled={loadingUsers}
                className="w-full px-4 py-3 rounded-xl border-2 border-[#0f172a]/10 focus:border-[#3b82f6] focus:outline-none transition-colors bg-white text-left flex items-center justify-between"
              >
                {loadingUsers ? (
                  <span className="text-[#0f172a]/60 text-sm">Loading users...</span>
                ) : selectedUser ? (
                  <div className="flex items-center gap-2">
                    <img
                      src={selectedUser.discord_avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${selectedUser.discord_username}`}
                      alt={selectedUser.discord_username}
                      className="w-6 h-6 rounded-full"
                    />
                    <span className="text-sm text-[#0f172a]">{selectedUser.discord_username}</span>
                  </div>
                ) : (
                  <span className="text-[#0f172a]/60 text-sm">Choose a user...</span>
                )}
                <ChevronDown className="w-4 h-4 text-[#0f172a]/40" />
              </button>

              {/* Dropdown Menu */}
              {showUserDropdown && !loadingUsers && (
                <div className="absolute z-50 w-full mt-1 bg-white border-2 border-[#0f172a]/10 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                  {allUsers.map(user => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleUserSelect(user.id)}
                      className="w-full px-4 py-2.5 text-left hover:bg-[#3b82f6]/5 transition-colors flex items-center gap-3 border-b border-[#0f172a]/5 last:border-b-0"
                    >
                      <img
                        src={user.discord_avatar || `https://api.dicebear.com/7.x/shapes/svg?seed=${user.discord_username}`}
                        alt={user.discord_username}
                        className="w-8 h-8 rounded-full flex-shrink-0"
                      />
                      <span className="text-sm text-[#0f172a] font-medium">{user.discord_username}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Selection Pills */}
        {selectedUserId && (
          <div>
            <label className="block text-sm font-medium text-[#0f172a] mb-2">
              Action <span className="text-[#ef4444]">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {/* Rank Up Pill */}
              <button
                type="button"
                onClick={() => availableActions.rank_up.enabled && setSelectedAction('rank_up')}
                disabled={!availableActions.rank_up.enabled}
                title={availableActions.rank_up.reason}
                className={`flex sm:flex-row flex-col items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl border-2 transition-all ${
                  selectedAction === 'rank_up' && availableActions.rank_up.enabled
                    ? 'bg-[#22c55e] border-[#22c55e] text-white shadow-lg'
                    : availableActions.rank_up.enabled
                      ? 'bg-white border-[#22c55e]/30 text-[#22c55e] hover:border-[#22c55e] hover:bg-[#22c55e]/10'
                      : 'bg-white border-[#22c55e]/30 text-[#22c55e] opacity-60 cursor-not-allowed'
                }`}
              >
                <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-xs sm:text-sm font-semibold hidden sm:inline">Rank Up</span>
              </button>

              {/* Rank Down Pill */}
              <button
                type="button"
                onClick={() => availableActions.rank_down.enabled && setSelectedAction('rank_down')}
                disabled={!availableActions.rank_down.enabled}
                title={availableActions.rank_down.reason}
                className={`flex sm:flex-row flex-col items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl border-2 transition-all ${
                  selectedAction === 'rank_down' && availableActions.rank_down.enabled
                    ? 'bg-[#ef4444] border-[#ef4444] text-white shadow-lg'
                    : availableActions.rank_down.enabled
                      ? 'bg-white border-[#ef4444]/30 text-[#ef4444] hover:border-[#ef4444] hover:bg-[#ef4444]/10'
                      : 'bg-white border-[#ef4444]/30 text-[#ef4444] opacity-60 cursor-not-allowed'
                }`}
              >
                <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-xs sm:text-sm font-semibold hidden sm:inline">Rank Down</span>
              </button>

              {/* Prestige Pill */}
              <button
                type="button"
                onClick={() => availableActions.prestige.enabled && setSelectedAction('prestige')}
                disabled={!availableActions.prestige.enabled}
                title={availableActions.prestige.reason}
                className={`flex sm:flex-row flex-col items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 px-2 sm:px-3 rounded-xl border-2 transition-all ${
                  selectedAction === 'prestige' && availableActions.prestige.enabled
                    ? 'bg-[#fbbf24] border-[#fbbf24] text-white shadow-lg'
                    : availableActions.prestige.enabled
                      ? 'bg-white border-[#fbbf24]/30 text-[#fbbf24] hover:border-[#fbbf24] hover:bg-[#fbbf24]/10'
                      : 'bg-white border-[#fbbf24]/30 text-[#fbbf24] opacity-60 cursor-not-allowed'
                }`}
              >
                <Star className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-xs sm:text-sm font-semibold hidden sm:inline">Prestige</span>
              </button>
            </div>

            {/* Show reason why action is disabled */}
            {!availableActions[selectedAction].enabled && availableActions[selectedAction].reason && (
              <p className="text-xs text-[#ef4444] mt-2 flex items-center gap-1">
                <span>⚠️</span>
                {availableActions[selectedAction].reason}
              </p>
            )}
          </div>
        )}

        {/* Submit Button */}
        <Button 
          onClick={() => setShowConfirm(true)}
          className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white h-12 rounded-xl font-semibold" 
          disabled={isSubmitting || !imageFile || !selectedUserId || !availableActions[selectedAction].enabled}
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

      {/* Confirmation Modal */}
      {showConfirm && (
        <ConfirmModal
          title="Submit MVP Request?"
          message={(() => {
            const targetUser = allUsers.find(u => u.id === selectedUserId);
            const actionText = selectedAction === 'rank_up' ? 'rank up' : selectedAction === 'rank_down' ? 'rank down' : 'prestige';
            return `Submit this MVP request to ${actionText} ${targetUser?.discord_username || 'this user'}?`;
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