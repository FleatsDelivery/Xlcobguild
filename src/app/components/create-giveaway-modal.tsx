/**
 * CreateGiveawayModal — Create or edit a giveaway with prizes
 *
 * Supports two modes:
 *   - Create: empty form, POST /giveaways
 *   - Edit:   pre-populated from existing giveaway, PATCH /giveaways/:id
 *
 * Prize management is delegated to GiveawayPrizeForm (extracted sub-component).
 */

import { useState, useEffect } from 'react';
import { X, Gift, Loader2, Lock, Globe, ImageIcon } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { ImageUpload } from '@/app/components/image-upload';
import { projectId } from '/utils/supabase/info';
import { toast } from 'sonner';
import {
  GiveawayPrizeForm,
  createEmptyPrize,
  prizeToFormData,
  formDataToPayload,
  type PrizeFormData,
} from './giveaway-prize-form';
import type { GiveawayDetail } from './giveaway-state-config';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

type GiveawayVisibility = 'members' | 'public';

interface CreateGiveawayModalProps {
  onClose: () => void;
  onSaved: (giveaway: any) => void;
  accessToken: string;
  /** If provided, opens in edit mode */
  existingGiveaway?: GiveawayDetail | null;
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

/** Format a Date to local datetime-local input value */
function toDatetimeLocal(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  // Offset to local timezone
  const offset = d.getTimezoneOffset() * 60000;
  const local = new Date(d.getTime() - offset);
  return local.toISOString().slice(0, 16);
}

// Shared input styling overrides for better contrast inside the modal
const INPUT_CLASS = 'text-sm bg-background border-2 border-border focus:border-harvest';
const TEXTAREA_CLASS = 'text-sm bg-background border-2 border-border focus:border-harvest min-h-[80px]';

// ═══════════════════════════════════════════════════════
// VISIBILITY PICKER
// ═══════════════════════════════════════════════════════

const VISIBILITY_OPTIONS: { value: GiveawayVisibility; label: string; desc: string; icon: typeof Lock }[] = [
  {
    value: 'members',
    label: 'Members Only',
    desc: 'Only registered guild members can enter',
    icon: Lock,
  },
  {
    value: 'public',
    label: 'Public',
    desc: 'Anyone can enter — great for stream giveaways',
    icon: Globe,
  },
];

// ═══════════════════════════════════════════════════════
// MAIN MODAL
// ═══════════════════════════════════════════════════════

export function CreateGiveawayModal({
  onClose,
  onSaved,
  accessToken,
  existingGiveaway,
}: CreateGiveawayModalProps) {
  const isEdit = !!existingGiveaway;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [winnerCount, setWinnerCount] = useState('1');
  const [closesAt, setClosesAt] = useState('');
  const [visibility, setVisibility] = useState<GiveawayVisibility>('members');
  const [bannerUrl, setBannerUrl] = useState('');
  const [prizes, setPrizes] = useState<PrizeFormData[]>([createEmptyPrize()]);

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Pre-populate for edit mode
  useEffect(() => {
    if (existingGiveaway) {
      setTitle(existingGiveaway.title || '');
      setDescription(existingGiveaway.description || '');
      setWinnerCount(String(existingGiveaway.winner_count || 1));
      setClosesAt(toDatetimeLocal(existingGiveaway.closes_at));
      setVisibility((existingGiveaway as any).visibility || 'members');
      setBannerUrl(existingGiveaway.image_url || '');
      if (existingGiveaway.prizes && existingGiveaway.prizes.length > 0) {
        setPrizes(existingGiveaway.prizes.map(prizeToFormData));
      }
    }
  }, [existingGiveaway]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: any = {
        title: title.trim(),
        description: description.trim() || null,
        image_url: bannerUrl || null,
        visibility,
        winner_count: parseInt(winnerCount) || 1,
        closes_at: closesAt ? new Date(closesAt).toISOString() : null,
        prizes: prizes.map((p, i) => formDataToPayload(p, i)),
      };

      const url = isEdit
        ? `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/giveaways/${existingGiveaway!.id}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/giveaways`;

      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${isEdit ? 'update' : 'create'} giveaway`);

      toast.success(isEdit ? 'Giveaway updated!' : 'Giveaway created!');
      onSaved(data.giveaway);
    } catch (err: any) {
      console.error(`${isEdit ? 'Update' : 'Create'} giveaway error:`, err);
      setError(err.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-card rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-harvest/15 to-harvest/5 rounded-t-3xl p-6 border-b-2 border-border flex-shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-all hover:scale-110 z-10"
          >
            <X className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-harvest/20 flex items-center justify-center">
              <Gift className="w-6 h-6 text-harvest" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground font-['Inter']">
                {isEdit ? 'Edit Giveaway' : 'Create Giveaway'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isEdit ? 'Update details and prizes' : 'Starts as draft — open when ready'}
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* ── Banner Image ── */}
          <div>
            <Label className="text-sm font-semibold text-foreground mb-1.5 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-muted-foreground" />
              Banner Image
            </Label>
            <p className="text-[11px] text-muted-foreground mb-2">
              Custom graphic for this giveaway (600×120 recommended). Shows on listing cards and detail page.
            </p>
            <ImageUpload
              currentUrl={bannerUrl || null}
              onUploadComplete={setBannerUrl}
              label=""
              folder="giveaways"
              filename={`banner-${Date.now()}.png`}
              previewClass="w-full h-24 object-cover rounded-xl border-2 border-border"
            />
          </div>

          {/* ── Title ── */}
          <div>
            <Label className="text-sm font-semibold text-foreground mb-1.5 block">Title *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. February Dota Plus Giveaway"
              className={INPUT_CLASS}
              autoFocus
            />
          </div>

          {/* ── Description ── */}
          <div>
            <Label className="text-sm font-semibold text-foreground mb-1.5 block">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell members what this giveaway is about..."
              className={TEXTAREA_CLASS}
            />
          </div>

          {/* ── Visibility Toggle ── */}
          <div>
            <Label className="text-sm font-semibold text-foreground mb-2 block">Visibility</Label>
            <div className="grid grid-cols-2 gap-3">
              {VISIBILITY_OPTIONS.map((opt) => {
                const active = visibility === opt.value;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setVisibility(opt.value)}
                    className={`flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                      active
                        ? 'border-harvest bg-harvest/10 ring-1 ring-harvest/30'
                        : 'border-border bg-background hover:border-muted-foreground/30'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      active ? 'bg-harvest/20' : 'bg-muted'
                    }`}>
                      <Icon className={`w-4 h-4 ${active ? 'text-harvest' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-sm font-bold ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {opt.label}
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                        {opt.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Winner count + Close date row ── */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-semibold text-foreground mb-1.5 block">Winner Count</Label>
              <Input
                type="number"
                min="1"
                max="50"
                value={winnerCount}
                onChange={(e) => setWinnerCount(e.target.value)}
                className={INPUT_CLASS}
              />
              <p className="text-[11px] text-muted-foreground mt-1">How many winners to draw</p>
            </div>
            <div>
              <Label className="text-sm font-semibold text-foreground mb-1.5 block">Closes At</Label>
              <Input
                type="datetime-local"
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                className={INPUT_CLASS}
              />
              <p className="text-[11px] text-muted-foreground mt-1">Optional — auto-closes entries</p>
            </div>
          </div>

          {/* ── Prizes ── */}
          <div className="pt-2 border-t border-border">
            <GiveawayPrizeForm prizes={prizes} onChange={setPrizes} />
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-error bg-error/10 rounded-lg px-4 py-2.5">
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="p-6 pt-4 border-t-2 border-border flex items-center justify-end gap-3 flex-shrink-0">
          <Button variant="outline" onClick={onClose} disabled={saving} type="button">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={saving || !title.trim()}
            className="bg-harvest hover:bg-harvest/90 text-white gap-2"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Gift className="w-4 h-4" />
            )}
            {isEdit ? 'Save Changes' : 'Create Giveaway'}
          </Button>
        </div>
      </div>
    </div>
  );
}
