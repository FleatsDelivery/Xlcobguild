import { X, Loader2 } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { useState } from 'react';

interface ConnectOpenDotaModalProps {
  onConnect: (opendotaId: string) => Promise<void>;
  onClose: () => void;
}

export function ConnectOpenDotaModal({ onConnect, onClose }: ConnectOpenDotaModalProps) {
  const [opendotaId, setOpendotaId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!opendotaId.trim()) {
      setError('Please enter your Steam32 ID');
      return;
    }

    if (!/^\d+$/.test(opendotaId.trim())) {
      setError('Steam32 ID must be numeric');
      return;
    }

    setLoading(true);
    try {
      await onConnect(opendotaId.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to connect OpenDota account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="relative bg-gradient-to-br from-harvest/10 to-harvest/5 rounded-t-3xl p-6 border-b-2 border-harvest/20">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center transition-all hover:scale-110"
          >
            <X className="w-5 h-5 text-field-dark" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-harvest flex items-center justify-center text-2xl">
              🎮
            </div>
            <div>
              <h3 className="text-xl font-bold text-field-dark">Connect OpenDota</h3>
              <p className="text-sm text-field-dark/60">Link your Dota 2 stats</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <label htmlFor="opendota-id" className="block text-sm font-semibold text-field-dark mb-2">
              Steam32 Account ID
            </label>
            <input
              id="opendota-id"
              type="text"
              value={opendotaId}
              onChange={(e) => setOpendotaId(e.target.value)}
              placeholder="123456789"
              className="w-full px-4 py-3 rounded-xl border-2 border-field-dark/10 focus:border-harvest focus:outline-none transition-colors font-mono"
              disabled={loading}
            />
            <p className="text-xs text-field-dark/60 mt-2">
              Enter your numeric Steam32 ID to connect your OpenDota profile
            </p>
          </div>

          {/* Help Text */}
          <div className="bg-[#3b82f6]/5 rounded-2xl p-4 mb-6 border-2 border-[#3b82f6]/20">
            <p className="text-xs text-field-dark/70 mb-2 font-semibold">
              How to find your Steam32 ID:
            </p>
            <ol className="text-xs text-field-dark/60 space-y-1 list-decimal list-inside">
              <li>Visit <span className="font-mono">opendota.com</span></li>
              <li>Search for your Steam profile</li>
              <li>Copy the numeric ID from the URL</li>
            </ol>
          </div>

          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 mb-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <Button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 bg-field-dark/10 hover:bg-field-dark/20 text-field-dark h-12 rounded-xl font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-harvest hover:bg-amber text-white h-12 rounded-xl font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Connecting...
                </>
              ) : (
                'Connect'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}