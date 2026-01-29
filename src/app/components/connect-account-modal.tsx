import { X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { useState } from 'react';

interface ConnectAccountModalProps {
  accountType: 'twitch' | 'chesscom';
  currentUsername?: string;
  onConnect: (username: string) => Promise<void>;
  onDisconnect?: () => Promise<void>;
  onClose: () => void;
}

export function ConnectAccountModal({ 
  accountType, 
  currentUsername,
  onConnect, 
  onDisconnect,
  onClose 
}: ConnectAccountModalProps) {
  const [username, setUsername] = useState(currentUsername || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const accountInfo = {
    twitch: {
      title: 'Twitch Account',
      placeholder: 'Enter your Twitch username',
      description: 'Your Twitch username (e.g., ninja)',
      color: '#9146ff',
    },
    chesscom: {
      title: 'Chess.com Account',
      placeholder: 'Enter your Chess.com username',
      description: 'Your Chess.com username (e.g., magnuscarlsen)',
      color: '#22c55e',
    },
  };

  const info = accountInfo[accountType];
  const isConnected = !!currentUsername;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Username cannot be empty');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await onConnect(username.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to connect account');
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!onDisconnect) return;
    
    setLoading(true);
    setError('');

    try {
      await onDisconnect();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect account');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[#0f172a]">
            {isConnected ? 'Manage' : 'Connect'} {info.title}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#0f172a]/5 hover:bg-[#0f172a]/10 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-[#0f172a]" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[#0f172a] mb-2">
              {info.description}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError('');
              }}
              placeholder={info.placeholder}
              className="w-full px-4 py-3 rounded-xl border-2 border-[#0f172a]/10 focus:border-[#f97316] focus:outline-none transition-colors"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={loading || !username.trim()}
              className="flex-1 h-12 rounded-xl font-semibold"
              style={{ backgroundColor: info.color }}
            >
              {loading ? 'Saving...' : isConnected ? 'Update' : 'Connect'}
            </Button>

            {isConnected && onDisconnect && (
              <Button
                type="button"
                onClick={handleDisconnect}
                disabled={loading}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white h-12 rounded-xl font-semibold"
              >
                {loading ? 'Removing...' : 'Disconnect'}
              </Button>
            )}
          </div>
        </form>

        <p className="text-xs text-[#0f172a]/60 text-center mt-4">
          This will be displayed on your public profile
        </p>
      </div>
    </div>
  );
}