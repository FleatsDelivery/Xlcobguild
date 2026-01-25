import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Camera, Loader2, Upload, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { projectId } from '/utils/supabase/info';
import { SuccessModal } from '@/app/components/success-modal';

export function MvpSubmissionForm() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [matchId, setMatchId] = useState('');
  const [openDotaLink, setOpenDotaLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modal, setModal] = useState<{
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
    helpText?: string;
  } | null>(null);

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
            opendota_link: openDotaLink.trim() || null,
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
      setOpenDotaLink('');
      setIsSubmitting(false);
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

  return (
    <div className="bg-gradient-to-br from-[#3b82f6]/10 to-[#3b82f6]/5 rounded-3xl p-8 border-2 border-[#3b82f6]/20">
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 rounded-full bg-[#3b82f6] flex items-center justify-center flex-shrink-0">
          <Camera className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-[#0f172a] mb-2">Submit MVP Request 📸</h3>
          <p className="text-[#0f172a]/70 text-sm leading-relaxed">
            Upload your MVP screenshot to request a rank-up. Officers will review and approve it!
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
                <p className="text-xs text-[#0f172a]/60">
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

        {/* OpenDota Link (Optional) */}
        <div>
          <label className="block text-sm font-medium text-[#0f172a] mb-2">
            OpenDota Match Link <span className="text-[#0f172a]/40">(Optional)</span>
          </label>
          <input
            type="text"
            value={openDotaLink}
            onChange={(e) => setOpenDotaLink(e.target.value)}
            placeholder="https://www.opendota.com/matches/..."
            className="w-full px-4 py-3 rounded-xl border-2 border-[#0f172a]/10 focus:border-[#3b82f6] focus:outline-none transition-colors"
          />
        </div>

        {/* Submit Button */}
        <Button 
          onClick={handleSubmit}
          className="w-full bg-[#3b82f6] hover:bg-[#2563eb] text-white h-12 rounded-xl font-semibold" 
          disabled={isSubmitting || !imageFile}
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