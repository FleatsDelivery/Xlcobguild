/**
 * Edit Prize Config Modal — per-tournament prize pool editor
 *
 * Officers can add/remove prize categories, edit amounts, and preview
 * the pie chart before saving. Saves to KV via PUT /kkup/:id/prize-config.
 */
import { useState, useMemo, useCallback } from 'react';
import {
  Crown, Star, Swords, Users, Zap, DollarSign,
  Plus, Trash2, GripVertical, Loader2, Check, X,
  Palette, Save, RotateCcw,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { BottomSheetModal } from '@/app/components/bottom-sheet-modal';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface PrizeCategory {
  key: string;
  label: string;
  amount_cents: number;
  color: string;
  icon: string; // lucide icon name
  description: string;
  split_note: string;
  recipient_type: 'team' | 'players' | 'users';
  max_recipients?: number;
  place?: number;
}

export interface TournamentPrizeConfig {
  categories: PrizeCategory[];
}

interface EditPrizeConfigModalProps {
  tournamentId: string;
  tournamentName: string;
  accessToken: string;
  currentConfig: TournamentPrizeConfig | null;
  onClose: () => void;
  onSaved: (config: TournamentPrizeConfig) => void;
}

// ═══════════════════════════════════════════════════════
// PRESETS & DEFAULTS
// ═══════════════════════════════════════════════════════

const PRESET_COLORS = [
  '#d6a615', '#f59e0b', '#ef4444', '#6366f1', '#10b981',
  '#8b5cf6', '#3b82f6', '#ec4899', '#f97316', '#14b8a6',
];

const ICON_OPTIONS: { name: string; icon: typeof Crown }[] = [
  { name: 'crown', icon: Crown },
  { name: 'star', icon: Star },
  { name: 'swords', icon: Swords },
  { name: 'users', icon: Users },
  { name: 'zap', icon: Zap },
  { name: 'dollar-sign', icon: DollarSign },
];

function getIconComponent(name: string) {
  return ICON_OPTIONS.find(i => i.name === name)?.icon || DollarSign;
}

const RECIPIENT_TYPE_OPTIONS: { value: PrizeCategory['recipient_type']; label: string }[] = [
  { value: 'team', label: 'Winning Team' },
  { value: 'players', label: 'Individual Players' },
  { value: 'users', label: 'Discord Users (staff etc.)' },
];

/** Default categories for a brand new KKup config */
export const DEFAULT_CATEGORIES: PrizeCategory[] = [
  {
    key: 'staff',
    label: 'Staff Pay',
    amount_cents: 7500,
    color: '#6366f1',
    icon: 'users',
    description: '$5 per person per day',
    split_note: 'Split among all staff',
    recipient_type: 'users',
  },
  {
    key: 'champion',
    label: 'KKup Champions',
    amount_cents: 5000,
    color: '#d6a615',
    icon: 'crown',
    description: 'Tournament winners',
    split_note: 'Split among the winning team',
    recipient_type: 'team',
    place: 1,
  },
  {
    key: 'popd_kernel',
    label: "Pop'd Kernel Award",
    amount_cents: 500,
    color: '#f59e0b',
    icon: 'star',
    description: 'Highest KDA of the tournament',
    split_note: 'Individual award',
    recipient_type: 'players',
    max_recipients: 2,
  },
  {
    key: 'match_of_the_night',
    label: 'Match Of The Night',
    amount_cents: 2000,
    color: '#ef4444',
    icon: 'swords',
    description: 'Most exciting match voted by viewers',
    split_note: 'Split among all players in the match',
    recipient_type: 'players',
  },
];

// ═══════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════

export function EditPrizeConfigModal({
  tournamentId, tournamentName, accessToken, currentConfig, onClose, onSaved,
}: EditPrizeConfigModalProps) {
  const [categories, setCategories] = useState<PrizeCategory[]>(
    currentConfig?.categories?.length ? [...currentConfig.categories] : [...DEFAULT_CATEGORIES],
  );
  const [saving, setSaving] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const totalCents = useMemo(
    () => categories.reduce((sum, c) => sum + c.amount_cents, 0),
    [categories],
  );

  const pieData = useMemo(
    () => categories
      .filter(c => c.amount_cents > 0)
      .map(c => ({
        name: c.label,
        value: c.amount_cents,
        color: c.color,
        percent: totalCents > 0 ? ((c.amount_cents / totalCents) * 100).toFixed(1) : '0',
      })),
    [categories, totalCents],
  );

  // ── Handlers ──

  const updateCategory = useCallback((index: number, patch: Partial<PrizeCategory>) => {
    setCategories(prev => prev.map((c, i) => i === index ? { ...c, ...patch } : c));
  }, []);

  const removeCategory = useCallback((index: number) => {
    setCategories(prev => prev.filter((_, i) => i !== index));
    setExpandedIndex(null);
  }, []);

  const addCategory = useCallback(() => {
    const usedColors = new Set(categories.map(c => c.color));
    const nextColor = PRESET_COLORS.find(c => !usedColors.has(c)) || PRESET_COLORS[0];
    const newKey = `custom_${Date.now()}`;
    setCategories(prev => [
      ...prev,
      {
        key: newKey,
        label: 'New Prize',
        amount_cents: 0,
        color: nextColor,
        icon: 'dollar-sign',
        description: '',
        split_note: '',
        recipient_type: 'players',
      },
    ]);
    setExpandedIndex(categories.length);
  }, [categories]);

  const resetToDefaults = useCallback(() => {
    setCategories([...DEFAULT_CATEGORIES]);
    setExpandedIndex(null);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const config: TournamentPrizeConfig = { categories };
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/${tournamentId}/prize-config`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(config),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      toast.success('Prize pool config saved!');
      onSaved(config);
    } catch (err: any) {
      console.error('Save prize config error:', err);
      toast.error(err.message || 'Failed to save prize config');
    } finally {
      setSaving(false);
    }
  };

  // ═══════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════

  return (
    <BottomSheetModal onClose={onClose} maxWidth="max-w-2xl">
      <BottomSheetModal.Header gradient="from-harvest/10 to-kernel-gold/10" borderColor="border-harvest/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-harvest to-kernel-gold flex items-center justify-center shadow-md">
            <DollarSign className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Prize Pool Structure</h2>
            <p className="text-xs text-muted-foreground">{tournamentName}</p>
          </div>
        </div>
      </BottomSheetModal.Header>

      <BottomSheetModal.Body>
        <div className="space-y-5">
          {/* ── Pie Chart Preview ── */}
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-44 h-44 flex-shrink-0">
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ payload }) => {
                        if (!payload?.[0]) return null;
                        const d = payload[0].payload;
                        return (
                          <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
                            <p className="font-bold text-foreground">{d.name}</p>
                            <p className="text-muted-foreground">
                              ${(d.value / 100).toFixed(2)} ({d.percent}%)
                            </p>
                          </div>
                        );
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="w-full h-full rounded-full border-2 border-dashed border-border flex items-center justify-center">
                  <p className="text-xs text-muted-foreground text-center">No prizes<br />configured</p>
                </div>
              )}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <p className="text-3xl font-black text-foreground">
                ${(totalCents / 100).toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {categories.length} {categories.length === 1 ? 'category' : 'categories'}
              </p>
              {/* Legend */}
              <div className="flex flex-wrap gap-2 mt-3">
                {categories.map((c, i) => (
                  <button
                    key={c.key}
                    onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
                    className={`flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full border transition-all ${
                      expandedIndex === i
                        ? 'border-harvest bg-harvest/10 text-foreground'
                        : 'border-border bg-muted/50 text-muted-foreground hover:border-harvest/30'
                    }`}
                  >
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── Category List ── */}
          <div className="space-y-2">
            {categories.map((cat, index) => {
              const isExpanded = expandedIndex === index;
              const IconComp = getIconComponent(cat.icon);
              const percent = totalCents > 0 ? ((cat.amount_cents / totalCents) * 100).toFixed(1) : '0.0';

              return (
                <div
                  key={cat.key}
                  className={`rounded-xl border transition-all ${
                    isExpanded ? 'border-harvest/50 bg-harvest/5' : 'border-border bg-card hover:border-harvest/30'
                  }`}
                >
                  {/* Summary row — always visible */}
                  <button
                    onClick={() => setExpandedIndex(isExpanded ? null : index)}
                    className="w-full flex items-center gap-3 p-3 text-left"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${cat.color}15` }}
                    >
                      <IconComp className="w-4 h-4" style={{ color: cat.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{cat.label}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{cat.description || 'No description'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-black text-foreground">${(cat.amount_cents / 100).toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground">{percent}%</p>
                    </div>
                  </button>

                  {/* Expanded editor */}
                  {isExpanded && (
                    <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
                      {/* Label + Amount row */}
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Label</label>
                          <Input
                            value={cat.label}
                            onChange={(e) => updateCategory(index, { label: e.target.value })}
                            className="bg-input-background text-sm"
                            placeholder="Prize name"
                          />
                        </div>
                        <div className="w-28">
                          <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Amount ($)</label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">$</span>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={(cat.amount_cents / 100).toFixed(2)}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                updateCategory(index, { amount_cents: isNaN(val) ? 0 : Math.round(val * 100) });
                              }}
                              className="pl-7 bg-input-background text-sm"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Description</label>
                        <Input
                          value={cat.description}
                          onChange={(e) => updateCategory(index, { description: e.target.value })}
                          className="bg-input-background text-sm"
                          placeholder="What this prize is for"
                        />
                      </div>

                      {/* Split Note */}
                      <div>
                        <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Split Note</label>
                        <Input
                          value={cat.split_note}
                          onChange={(e) => updateCategory(index, { split_note: e.target.value })}
                          className="bg-input-background text-sm"
                          placeholder="e.g. Split among the winning team"
                        />
                      </div>

                      {/* Recipient Type */}
                      <div>
                        <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Recipient Type</label>
                        <div className="flex gap-2">
                          {RECIPIENT_TYPE_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => updateCategory(index, { recipient_type: opt.value })}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                cat.recipient_type === opt.value
                                  ? 'border-harvest bg-harvest/10 text-foreground'
                                  : 'border-border bg-muted text-muted-foreground hover:border-harvest/30'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Color + Icon row */}
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Color</label>
                          <div className="flex gap-1.5 flex-wrap">
                            {PRESET_COLORS.map(color => (
                              <button
                                key={color}
                                onClick={() => updateCategory(index, { color })}
                                className={`w-6 h-6 rounded-full border-2 transition-all ${
                                  cat.color === color ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'
                                }`}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Icon</label>
                          <div className="flex gap-1.5">
                            {ICON_OPTIONS.map(opt => {
                              const I = opt.icon;
                              return (
                                <button
                                  key={opt.name}
                                  onClick={() => updateCategory(index, { icon: opt.name })}
                                  className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
                                    cat.icon === opt.name
                                      ? 'border-harvest bg-harvest/10'
                                      : 'border-border bg-muted hover:border-harvest/30'
                                  }`}
                                >
                                  <I className="w-3.5 h-3.5" style={{ color: cat.icon === opt.name ? cat.color : undefined }} />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={() => removeCategory(index)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-error hover:text-error/80 transition-colors pt-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remove this prize
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Add + Reset buttons ── */}
          <div className="flex gap-2">
            <button
              onClick={addCategory}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-border hover:border-harvest/50 text-sm font-semibold text-muted-foreground hover:text-foreground transition-all flex-1"
            >
              <Plus className="w-4 h-4" />
              Add Prize Category
            </button>
            <button
              onClick={resetToDefaults}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border hover:border-harvest/30 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
        </div>
      </BottomSheetModal.Body>

      <BottomSheetModal.Footer>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-shrink-0">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || categories.length === 0}
            className="flex-1 bg-harvest hover:bg-harvest/90 text-white font-bold"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</>
            ) : (
              <><Save className="w-4 h-4 mr-2" /> Save Prize Pool — ${(totalCents / 100).toFixed(2)}</>
            )}
          </Button>
        </div>
      </BottomSheetModal.Footer>
    </BottomSheetModal>
  );
}
