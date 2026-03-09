/**
 * GiveawaysPage — Listing page for all giveaways
 *
 * Orchestrator: fetches data, manages filter state, renders cards.
 * Uses semantic tokens for dark mode compatibility.
 */

import { useState, useEffect, useMemo } from 'react';
import { Gift, AlertCircle, Filter, Plus } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { GiveawayCard } from '@/app/components/giveaway-card';
import { CreateGiveawayModal } from '@/app/components/create-giveaway-modal';
import { Footer } from '@/app/components/footer';
import { isOfficer } from '@/lib/roles';
import {
  ALL_GIVEAWAY_PHASES,
  getGiveawayPhaseConfig,
  type GiveawayListItem,
  type GiveawayPhase,
} from './giveaway-state-config';

// ═══════════════════════════════════════════════════════
// FILTER PILLS
// ═══════════════════════════════════════════════════════

const FILTER_OPTIONS: { value: 'all' | GiveawayPhase; label: string }[] = [
  { value: 'all', label: 'All' },
  ...ALL_GIVEAWAY_PHASES.map((phase) => ({
    value: phase,
    label: getGiveawayPhaseConfig(phase).label,
  })),
];

// ═══════════════════════════════════════════════════════
// SKELETON COMPONENTS
// ═══════════════════════════════════════════════════════

function GiveawayCardSkeleton() {
  return (
    <div className="bg-card rounded-2xl border-2 border-border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="animate-pulse bg-muted rounded-full h-6 w-16" />
        <div className="animate-pulse bg-muted rounded-full h-5 w-12" />
      </div>
      <div className="space-y-2">
        <div className="animate-pulse bg-muted rounded-xl h-6 w-3/4" />
        <div className="animate-pulse bg-muted rounded-xl h-4 w-full" />
      </div>
      <div className="flex gap-2">
        <div className="animate-pulse bg-muted rounded-lg h-8 w-24" />
        <div className="animate-pulse bg-muted rounded-lg h-8 w-20" />
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <div className="animate-pulse bg-muted rounded-xl h-4 w-20" />
        <div className="animate-pulse bg-muted rounded-xl h-4 w-16" />
      </div>
    </div>
  );
}

function GiveawaysGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
      {[1, 2, 3, 4].map(i => (
        <GiveawayCardSkeleton key={i} />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════

interface GiveawaysPageProps {
  user?: any;
}

export function GiveawaysPage({ user }: GiveawaysPageProps) {
  const [giveaways, setGiveaways] = useState<GiveawayListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | GiveawayPhase>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const canCreate = isOfficer(user?.role);
  const accessToken = localStorage.getItem('supabase_token') || '';

  useEffect(() => {
    fetchGiveaways();
  }, []);

  const fetchGiveaways = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('supabase_token') || publicAnonKey;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/giveaways`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setGiveaways(data.giveaways || []);
    } catch (err: any) {
      console.error('Failed to fetch giveaways:', err);
      setError(err.message || 'Failed to load giveaways');
    } finally {
      setLoading(false);
    }
  };

  // Filter giveaways
  const filteredGiveaways = useMemo(() => {
    if (filter === 'all') return giveaways;
    return giveaways.filter((g) => g.status === filter);
  }, [giveaways, filter]);

  // Separate active (open) from others for visual grouping
  const openGiveaways = useMemo(
    () => filteredGiveaways.filter((g) => g.status === 'open'),
    [filteredGiveaways]
  );
  const otherGiveaways = useMemo(
    () => filteredGiveaways.filter((g) => g.status !== 'open'),
    [filteredGiveaways]
  );

  const handleCardClick = (giveaway: GiveawayListItem) => {
    window.location.hash = `#giveaway/${giveaway.id}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6 sm:mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-harvest/15 flex items-center justify-center">
              <Gift className="w-5 h-5 sm:w-6 sm:h-6 text-harvest" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-foreground font-['Inter']">Giveaways</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">Monthly prizes for the community</p>
            </div>
          </div>

          {canCreate && (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-harvest hover:bg-harvest/90 text-white gap-2"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">New Giveaway</span>
            </Button>
          )}
        </div>

        {/* ── Filters ── */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          {FILTER_OPTIONS.map((opt) => {
            // Don't show draft filter for non-officers
            if (opt.value === 'draft' && !canCreate) return null;
            const isActive = filter === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-harvest text-white'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* ── Loading ── */}
        {loading && <GiveawaysGridSkeleton />}

        {/* ── Error ── */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <AlertCircle className="w-10 h-10 text-error" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" onClick={fetchGiveaways} className="text-sm">
              Retry
            </Button>
          </div>
        )}

        {/* ── Empty ── */}
        {!loading && !error && filteredGiveaways.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Gift className="w-12 h-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {filter === 'all'
                ? 'No giveaways yet — check back soon!'
                : `No ${getGiveawayPhaseConfig(filter as GiveawayPhase).label.toLowerCase()} giveaways`}
            </p>
          </div>
        )}

        {/* ── Active Giveaways (Open) — Featured ── */}
        {!loading && !error && openGiveaways.length > 0 && filter === 'all' && (
          <div className="mb-8">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2 font-['Inter']">
              <span className="w-2 h-2 bg-[#10b981] rounded-full animate-pulse" />
              Open Now
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {openGiveaways.map((g) => (
                <GiveawayCard key={g.id} giveaway={g} onClick={() => handleCardClick(g)} />
              ))}
            </div>
          </div>
        )}

        {/* ── Other Giveaways ── */}
        {!loading && !error && (filter === 'all' ? otherGiveaways : filteredGiveaways).length > 0 && (
          <div>
            {filter === 'all' && openGiveaways.length > 0 && (
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 font-['Inter']">
                Past & Upcoming
              </h2>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {(filter === 'all' ? otherGiveaways : filteredGiveaways).map((g) => (
                <GiveawayCard key={g.id} giveaway={g} onClick={() => handleCardClick(g)} />
              ))}
            </div>
          </div>
        )}
      </div>

      <Footer />

      {/* Create Modal */}
      {showCreateModal && (
        <CreateGiveawayModal
          accessToken={accessToken}
          onClose={() => setShowCreateModal(false)}
          onSaved={(giveaway) => {
            setShowCreateModal(false);
            // Navigate to the new giveaway's detail page
            window.location.hash = `#giveaway/${giveaway.id}`;
          }}
        />
      )}
    </div>
  );
}