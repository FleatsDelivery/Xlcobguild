import { useState, useEffect } from 'react';
import { Loader2, Check, ChevronDown } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { numericToRank, rankToNumeric } from '@/lib/rank-utils';
import { toast } from 'sonner';

const MEDAL_ORDER = ['Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal'] as const;

/** Build the full list of selectable ranks (Herald 1 through Immortal) */
function buildRankOptions(): { label: string; numeric: number }[] {
  const options: { label: string; numeric: number }[] = [];
  for (const medal of MEDAL_ORDER) {
    if (medal === 'Immortal') {
      options.push({ label: 'Immortal', numeric: 36 });
    } else {
      for (let stars = 1; stars <= 5; stars++) {
        options.push({
          label: `${medal} ${stars}`,
          numeric: rankToNumeric(medal, stars),
        });
      }
    }
  }
  return options;
}

const RANK_OPTIONS = buildRankOptions();

export function OfficerRankConfig() {
  const [currentMin, setCurrentMin] = useState<number | null>(null);
  const [currentMax, setCurrentMax] = useState<number | null>(null);
  const [selectedMin, setSelectedMin] = useState<number | null>(null);
  const [selectedMax, setSelectedMax] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCurrentRanks();
  }, []);

  const fetchCurrentRanks = async () => {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/config/rank-eligibility`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } },
      );
      if (res.ok) {
        const data = await res.json();
        setCurrentMin(data.min.numeric);
        setCurrentMax(data.max.numeric);
        setSelectedMin(data.min.numeric);
        setSelectedMax(data.max.numeric);
      }
    } catch (err) {
      console.error('Failed to fetch rank eligibility config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (selectedMin === null || selectedMax === null) return;
    if (selectedMin === currentMin && selectedMax === currentMax) return;

    if (selectedMin > selectedMax) {
      toast.error('Minimum rank cannot be higher than maximum rank.');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('supabase_token');
      if (!token) {
        toast.error('Authentication token not found. Please log in again.');
        return;
      }
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/config/rank-eligibility`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ min_numeric: selectedMin, max_numeric: selectedMax }),
        },
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errData.error || `Server error: ${res.status}`);
      }
      const data = await res.json();
      setCurrentMin(data.min.numeric);
      setCurrentMax(data.max.numeric);
      toast.success(`Rank eligibility updated: ${data.min.display} – ${data.max.display}`);
    } catch (err) {
      console.error('Failed to update rank eligibility:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update rank config');
    } finally {
      setSaving(false);
    }
  };

  const hasChanged = (selectedMin !== null && selectedMax !== null) &&
    (selectedMin !== currentMin || selectedMax !== currentMax);

  const minDisplay = currentMin !== null
    ? (() => {
        const r = numericToRank(currentMin);
        return r.medal === 'Immortal' ? 'Immortal' : `${r.medal} ${r.stars}`;
      })()
    : '—';
  const maxDisplay = currentMax !== null
    ? (() => {
        const r = numericToRank(currentMax);
        return r.medal === 'Immortal' ? 'Immortal' : `${r.medal} ${r.stars}`;
      })()
    : '—';

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading rank config...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        {/* Min Rank */}
        <div className="flex-1">
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
            Minimum Rank
          </label>
          <div className="relative">
            <select
              value={selectedMin ?? ''}
              onChange={(e) => setSelectedMin(Number(e.target.value))}
              className="w-full appearance-none bg-input-background border-2 border-border rounded-xl px-4 py-2.5 pr-10 text-sm font-semibold text-foreground focus:outline-none focus:border-harvest/50 transition-colors cursor-pointer"
            >
              {RANK_OPTIONS.map((opt) => (
                <option key={opt.numeric} value={opt.numeric}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Max Rank */}
        <div className="flex-1">
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
            Maximum Rank
          </label>
          <div className="relative">
            <select
              value={selectedMax ?? ''}
              onChange={(e) => setSelectedMax(Number(e.target.value))}
              className="w-full appearance-none bg-input-background border-2 border-border rounded-xl px-4 py-2.5 pr-10 text-sm font-semibold text-foreground focus:outline-none focus:border-harvest/50 transition-colors cursor-pointer"
            >
              {RANK_OPTIONS.map((opt) => (
                <option key={opt.numeric} value={opt.numeric}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={!hasChanged || saving}
          className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
            hasChanged
              ? 'bg-harvest text-white hover:bg-harvest/90 shadow-md'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Players ranked between <span className="font-bold text-foreground">{minDisplay}</span> and{' '}
        <span className="font-bold text-foreground">{maxDisplay}</span> are eligible to register
        as a Player. Players outside this range will be directed to register as a Coach instead.
        Individual tournaments can override these defaults.
      </p>
    </div>
  );
}
