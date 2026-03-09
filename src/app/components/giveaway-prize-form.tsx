/**
 * GiveawayPrizeForm — Dynamic prize row builder for create/edit modal
 *
 * Handles add/remove/reorder of prizes with type-specific fields.
 * Loads prize types dynamically from the server (KV store) so custom
 * types created in the Giveaway Manager appear automatically.
 *
 * Extracted to keep the modal under 400 lines per guidelines.
 */

import { useState, useEffect } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Button } from '@/app/components/ui/button';
import { projectId, publicAnonKey } from '/utils/supabase/info';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

/** A prize type option loaded from the server */
export interface PrizeTypeOption {
  key: string;
  label: string;
  icon: string;
  color: string;
  sort_order: number;
  builtin: boolean;
}

export interface PrizeFormData {
  id?: string; // present when editing existing
  type: string; // now accepts any prize type key, not just built-in PrizeType
  title: string;
  description: string;
  cash_amount: string;
  cash_currency: string;
  dota_plus_months: string;
  discount_percent: string;
  discount_code: string;
}

export function createEmptyPrize(): PrizeFormData {
  return {
    type: 'other',
    title: '',
    description: '',
    cash_amount: '',
    cash_currency: 'USD',
    dota_plus_months: '',
    discount_percent: '',
    discount_code: '',
  };
}

/** Convert a DB prize row into form data */
export function prizeToFormData(prize: any): PrizeFormData {
  return {
    id: prize.id,
    type: prize.type || 'other',
    title: prize.title || '',
    description: prize.description || '',
    cash_amount: prize.cash_amount ? String(prize.cash_amount) : '',
    cash_currency: prize.cash_currency || 'USD',
    dota_plus_months: prize.dota_plus_months ? String(prize.dota_plus_months) : '',
    discount_percent: prize.discount_percent ? String(prize.discount_percent) : '',
    discount_code: prize.discount_code || '',
  };
}

/** Convert form data to API payload */
export function formDataToPayload(prize: PrizeFormData, sortOrder: number) {
  return {
    type: prize.type,
    title: prize.title.trim() || getPrizeAutoTitle(prize),
    description: prize.description.trim() || null,
    cash_amount: prize.type === 'cash' && prize.cash_amount ? parseFloat(prize.cash_amount) : null,
    cash_currency: prize.type === 'cash' ? prize.cash_currency || 'USD' : 'USD',
    dota_plus_months: prize.type === 'dota_plus' && prize.dota_plus_months ? parseInt(prize.dota_plus_months) : null,
    discount_percent: prize.type === 'discount_code' && prize.discount_percent ? parseFloat(prize.discount_percent) : null,
    discount_code: prize.type === 'discount_code' ? prize.discount_code || null : null,
    sort_order: sortOrder,
    rank: sortOrder + 1,
  };
}

function getPrizeAutoTitle(prize: PrizeFormData): string {
  switch (prize.type) {
    case 'cash': return prize.cash_amount ? `$${prize.cash_amount} ${prize.cash_currency}` : 'Cash Prize';
    case 'dota_plus': return prize.dota_plus_months ? `${prize.dota_plus_months}mo Dota Plus` : 'Dota Plus';
    case 'discount_code': return prize.discount_percent ? `${prize.discount_percent}% Off` : 'Discount Code';
    default: return 'Prize';
  }
}

// ═══════════════════════════════════════════════════════
// BUILT-IN TYPE-SPECIFIC FIELD KEYS
// ═══════════════════════════════════════════════════════

// Only these built-in types get extra form fields. Custom types just get title + description.
const TYPES_WITH_EXTRA_FIELDS = new Set(['cash', 'dota_plus', 'discount_code']);

// Fallback options if the server fetch fails
const FALLBACK_OPTIONS: PrizeTypeOption[] = [
  { key: 'cash', label: 'Cash', icon: '💵', color: '#10b981', sort_order: 0, builtin: true },
  { key: 'dota_plus', label: 'Dota Plus', icon: '⭐', color: '#d6a615', sort_order: 1, builtin: true },
  { key: 'discount_code', label: 'Discount Code', icon: '🏷️', color: '#3b82f6', sort_order: 2, builtin: true },
  { key: 'physical', label: 'Physical Item', icon: '📦', color: '#8b5cf6', sort_order: 3, builtin: true },
  { key: 'other', label: 'Other', icon: '🎁', color: '#f59e0b', sort_order: 4, builtin: true },
];

// Module-level cache so we don't re-fetch every time the component mounts
let cachedTypes: PrizeTypeOption[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 1 minute

async function fetchPrizeTypes(): Promise<PrizeTypeOption[]> {
  // Return cache if fresh
  if (cachedTypes && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedTypes;
  }

  try {
    const token = localStorage.getItem('supabase_token') || publicAnonKey;
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/giveaway-config/prize-types`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) throw new Error('Failed to fetch prize types');
    const data = await res.json();
    cachedTypes = data.prize_types || FALLBACK_OPTIONS;
    cacheTimestamp = Date.now();
    return cachedTypes!;
  } catch (err) {
    console.error('Failed to load prize types, using fallback:', err);
    return FALLBACK_OPTIONS;
  }
}

// ═══════════════════════════════════════════════════════
// SINGLE PRIZE ROW
// ═══════════════════════════════════════════════════════

function PrizeRow({
  prize,
  index,
  typeOptions,
  onUpdate,
  onRemove,
}: {
  prize: PrizeFormData;
  index: number;
  typeOptions: PrizeTypeOption[];
  onUpdate: (index: number, data: PrizeFormData) => void;
  onRemove: (index: number) => void;
}) {
  const update = (field: keyof PrizeFormData, value: string) => {
    onUpdate(index, { ...prize, [field]: value });
  };

  const selectedType = typeOptions.find(t => t.key === prize.type);

  return (
    <div className="bg-muted/30 rounded-xl p-4 space-y-3 relative group">
      {/* Remove button */}
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="absolute top-3 right-3 w-6 h-6 rounded-full bg-error/10 text-error flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-error/20"
        title="Remove prize"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {/* Row 1: Type + Title */}
      <div className="flex gap-3">
        <div className="w-44 flex-shrink-0">
          <Label className="text-xs text-muted-foreground mb-1 block">Type</Label>
          <select
            value={prize.type}
            onChange={(e) => update('type', e.target.value)}
            className="w-full h-9 rounded-md border border-border bg-input-background px-2 text-sm text-foreground"
          >
            {typeOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.icon} {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-0">
          <Label className="text-xs text-muted-foreground mb-1 block">Title</Label>
          <Input
            value={prize.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder={getPrizeAutoTitle(prize)}
            className="h-9 text-sm"
          />
        </div>
      </div>

      {/* Row 2: Type-specific fields (built-in types only) */}
      {prize.type === 'cash' && (
        <div className="flex gap-3">
          <div className="w-28">
            <Label className="text-xs text-muted-foreground mb-1 block">Amount</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={prize.cash_amount}
              onChange={(e) => update('cash_amount', e.target.value)}
              placeholder="5.00"
              className="h-9 text-sm"
            />
          </div>
          <div className="w-24">
            <Label className="text-xs text-muted-foreground mb-1 block">Currency</Label>
            <select
              value={prize.cash_currency}
              onChange={(e) => update('cash_currency', e.target.value)}
              className="w-full h-9 rounded-md border border-border bg-input-background px-2 text-sm text-foreground"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="CAD">CAD</option>
              <option value="AUD">AUD</option>
            </select>
          </div>
        </div>
      )}

      {prize.type === 'dota_plus' && (
        <div className="w-28">
          <Label className="text-xs text-muted-foreground mb-1 block">Months</Label>
          <Input
            type="number"
            min="1"
            max="24"
            value={prize.dota_plus_months}
            onChange={(e) => update('dota_plus_months', e.target.value)}
            placeholder="1"
            className="h-9 text-sm"
          />
        </div>
      )}

      {prize.type === 'discount_code' && (
        <div className="flex gap-3">
          <div className="w-28">
            <Label className="text-xs text-muted-foreground mb-1 block">% Off</Label>
            <Input
              type="number"
              min="1"
              max="100"
              value={prize.discount_percent}
              onChange={(e) => update('discount_percent', e.target.value)}
              placeholder="10"
              className="h-9 text-sm"
            />
          </div>
          <div className="flex-1 min-w-0">
            <Label className="text-xs text-muted-foreground mb-1 block">Code (hidden until won)</Label>
            <Input
              value={prize.discount_code}
              onChange={(e) => update('discount_code', e.target.value)}
              placeholder="TCFSAVE10"
              className="h-9 text-sm"
            />
          </div>
        </div>
      )}

      {/* Optional description for all types */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">Description (optional)</Label>
        <Input
          value={prize.description}
          onChange={(e) => update('description', e.target.value)}
          placeholder="e.g. Sent via PayPal within 24h"
          className="h-9 text-sm"
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════

interface GiveawayPrizeFormProps {
  prizes: PrizeFormData[];
  onChange: (prizes: PrizeFormData[]) => void;
}

export function GiveawayPrizeForm({ prizes, onChange }: GiveawayPrizeFormProps) {
  const [typeOptions, setTypeOptions] = useState<PrizeTypeOption[]>(cachedTypes || FALLBACK_OPTIONS);
  const [loadingTypes, setLoadingTypes] = useState(!cachedTypes);

  // Fetch prize types on mount
  useEffect(() => {
    let cancelled = false;
    fetchPrizeTypes().then((types) => {
      if (!cancelled) {
        setTypeOptions(types);
        setLoadingTypes(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const handleUpdate = (index: number, data: PrizeFormData) => {
    const next = [...prizes];
    next[index] = data;
    onChange(next);
  };

  const handleRemove = (index: number) => {
    onChange(prizes.filter((_, i) => i !== index));
  };

  const handleAdd = () => {
    onChange([...prizes, createEmptyPrize()]);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
          Prizes ({prizes.length})
          {loadingTypes && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          className="gap-1.5 text-xs h-8"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Prize
        </Button>
      </div>

      {prizes.length === 0 && (
        <div className="text-center py-6 text-sm text-muted-foreground bg-muted/20 rounded-xl border-2 border-dashed border-border">
          No prizes yet — add at least one prize
        </div>
      )}

      {prizes.map((prize, i) => (
        <PrizeRow
          key={i}
          prize={prize}
          index={i}
          typeOptions={typeOptions}
          onUpdate={handleUpdate}
          onRemove={handleRemove}
        />
      ))}
    </div>
  );
}
