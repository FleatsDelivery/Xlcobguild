import { useState, useEffect } from 'react';
import { Button } from '@/app/components/ui/button';
import { Upload, Loader2, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { projectId } from '/utils/supabase/info';

interface ImageUploadProps {
  currentUrl?: string | null;
  onUploadComplete: (url: string) => void;
  label?: string;
  accept?: string;
  folder?: string;
  filename?: string;
  previewClass?: string;
}

export function ImageUpload({ 
  currentUrl, 
  onUploadComplete, 
  label = "Upload Image",
  accept = "image/*",
  folder,
  filename: customFilename,
  previewClass,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl || null);

  // Sync previewUrl when currentUrl prop changes (e.g. after async image existence check)
  useEffect(() => {
    if (currentUrl && !previewUrl) {
      setPreviewUrl(currentUrl);
    }
  }, [currentUrl]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('File too large. Maximum size is 5MB');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    try {
      setUploading(true);
      const token = localStorage.getItem('supabase_token');

      const formData = new FormData();
      formData.append('file', file);
      if (folder) formData.append('folder', folder);
      if (customFilename) formData.append('filename', customFilename);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/upload`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload file');
      }

      const data = await response.json();
      toast.success('✅ Image uploaded successfully!');
      onUploadComplete(data.url);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload image');
      setPreviewUrl(currentUrl || null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    onUploadComplete('');
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-field-dark">
        {label}
      </label>

      {previewUrl ? (
        <div className="relative">
          <img
            src={previewUrl}
            alt="Preview"
            className={previewClass || "w-full h-32 object-cover rounded-lg border-2 border-field-dark/10"}
          />
          <div className="absolute top-2 right-2 flex gap-2">
            <label className="cursor-pointer">
              <input
                type="file"
                accept={accept}
                onChange={handleFileChange}
                disabled={uploading}
                className="hidden"
              />
              <div className="bg-white rounded-lg p-2 shadow-lg border-2 border-field-dark/10 hover:bg-field-dark/5">
                <Upload className="w-4 h-4 text-harvest" />
              </div>
            </label>
            <button
              onClick={handleRemove}
              className="bg-white rounded-lg p-2 shadow-lg border-2 border-field-dark/10 hover:bg-field-dark/5"
            >
              <X className="w-4 h-4 text-[#ef4444]" />
            </button>
          </div>
          {uploading && (
            <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <label className="block cursor-pointer">
          <input
            type="file"
            accept={accept}
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
          />
          <div className="border-2 border-dashed border-field-dark/20 rounded-lg p-8 text-center hover:border-harvest hover:bg-harvest/5 transition-all">
            {uploading ? (
              <Loader2 className="w-8 h-8 mx-auto mb-2 text-harvest animate-spin" />
            ) : (
              <Upload className="w-8 h-8 mx-auto mb-2 text-field-dark/40" />
            )}
            <p className="text-sm font-semibold text-field-dark">
              {uploading ? 'Uploading...' : 'Click to upload'}
            </p>
            <p className="text-xs text-field-dark/60 mt-1">
              PNG, JPG, GIF, WebP up to 5MB
            </p>
          </div>
        </label>
      )}
    </div>
  );
}