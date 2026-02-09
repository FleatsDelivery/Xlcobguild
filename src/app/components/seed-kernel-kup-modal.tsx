import { Database, X, Trophy, Users, Calendar } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

interface SeedKernelKupModalProps {
  kernelKupId: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SeedKernelKupModal({
  kernelKupId,
  onConfirm,
  onCancel,
}: SeedKernelKupModalProps) {
  // Tournament details based on Kernel Kup ID
  const tournamentDetails: Record<number, { name: string; teams: number; matches: number; date: string }> = {
    1: { name: 'Kernel Kup 1', teams: 6, matches: 15, date: 'August 2022' },
    2: { name: 'Kernel Kup 2', teams: 8, matches: 14, date: 'December 2022' },
    3: { name: 'Kernel Kup 3', teams: 8, matches: 14, date: 'May 2023' },
    8: { name: 'Kernel Kup 8', teams: 2, matches: 1, date: 'January 2026' },
    9: { name: 'Kernel Kup 9', teams: 8, matches: 10, date: 'July 2025' },
  };

  const details = tournamentDetails[kernelKupId] || { 
    name: `Kernel Kup ${kernelKupId}`, 
    teams: 0, 
    matches: 0, 
    date: 'Unknown' 
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="relative bg-gradient-to-br from-[#f97316]/10 to-[#f97316]/5 rounded-t-3xl p-6 border-b-2 border-[#f97316]/20">
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center transition-all hover:scale-110"
          >
            <X className="w-5 h-5 text-[#0f172a]" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#f97316] to-[#ea580c] flex items-center justify-center shadow-md">
              <Database className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-[#0f172a]">Seed Tournament Data</h3>
          </div>

          <p className="text-sm text-[#0f172a]/70">
            Review the tournament details before importing historical data
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Tournament Name */}
          <div className="bg-gradient-to-br from-[#f97316]/5 to-[#ea580c]/5 rounded-2xl p-4 border-2 border-[#f97316]/20 mb-4">
            <div className="flex items-center gap-3">
              <Trophy className="w-6 h-6 text-[#f97316]" />
              <div>
                <p className="text-xs text-[#0f172a]/60 font-semibold">Tournament</p>
                <p className="text-lg font-bold text-[#0f172a]">{details.name}</p>
              </div>
            </div>
          </div>

          {/* Tournament Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-[#fdf5e9] rounded-xl p-3 border-2 border-[#0f172a]/10">
              <Users className="w-5 h-5 text-[#f97316] mb-1" />
              <p className="text-xs text-[#0f172a]/60">Teams</p>
              <p className="text-xl font-bold text-[#0f172a]">{details.teams}</p>
            </div>

            <div className="bg-[#fdf5e9] rounded-xl p-3 border-2 border-[#0f172a]/10">
              <Database className="w-5 h-5 text-[#f97316] mb-1" />
              <p className="text-xs text-[#0f172a]/60">Matches</p>
              <p className="text-xl font-bold text-[#0f172a]">{details.matches}</p>
            </div>

            <div className="bg-[#fdf5e9] rounded-xl p-3 border-2 border-[#0f172a]/10">
              <Calendar className="w-5 h-5 text-[#f97316] mb-1" />
              <p className="text-xs text-[#0f172a]/60">Date</p>
              <p className="text-sm font-bold text-[#0f172a]">{details.date}</p>
            </div>
          </div>

          {/* Warning Message */}
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-yellow-800 leading-relaxed">
              <strong>⚠️ Important:</strong> This will create a new tournament in the database with all teams, players, and match data. Make sure you haven't already seeded this tournament.
            </p>
          </div>

          {/* What Will Be Created */}
          <div className="mb-6">
            <p className="text-sm font-semibold text-[#0f172a] mb-2">What will be created:</p>
            <ul className="space-y-2 text-sm text-[#0f172a]/70">
              <li className="flex items-start gap-2">
                <span className="text-[#f97316] mt-0.5">✓</span>
                <span>Tournament record with metadata</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#f97316] mt-0.5">✓</span>
                <span>{details.teams} teams with rosters</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#f97316] mt-0.5">✓</span>
                <span>{details.matches} matches with results</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#f97316] mt-0.5">✓</span>
                <span>Player statistics and performance data</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#f97316] mt-0.5">✓</span>
                <span>Hero picks and bans</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 pt-0 flex gap-3">
          <Button
            onClick={onCancel}
            className="flex-1 bg-[#0f172a]/10 hover:bg-[#0f172a]/20 text-[#0f172a] h-12 rounded-xl font-semibold"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            className="flex-1 bg-gradient-to-br from-[#f97316] to-[#ea580c] hover:from-[#ea580c] hover:to-[#c2410c] text-white h-12 rounded-xl font-semibold shadow-md"
          >
            <Database className="w-5 h-5 mr-2" />
            Seed Now
          </Button>
        </div>
      </div>
    </div>
  );
}