/**
 * GiveawayManager — Prize type CRUD for the Officer Panel
 *
 * Lists built-in + custom prize types from the server,
 * with create/edit/delete capabilities. Built-in types
 * can be customized (icon, label, color) but not deleted.
 *
 * Data stored in KV store via routes-giveaway-config.ts.
 */

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Pencil, Trash2, Check, RotateCcw } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { BottomSheetModal } from '@/app/components/bottom-sheet-modal';
import { ConfirmModal } from '@/app/components/confirm-modal';
import { projectId } from '/utils/supabase/info';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

interface PrizeType {
  key: string;
  label: string;
  icon: string;
  color: string;
  sort_order: number;
  builtin: boolean;
}

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════

const COLOR_PRESETS = [
  '#10b981', '#d6a615', '#3b82f6', '#8b5cf6', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#84cc16', '#f97316',
  '#6366f1', '#14b8a6', '#78716c', '#1b2838',
];

const EMOJI_PRESETS = [
  '💵', '⭐', '🏷️', '📦', '🎁', '🎮', '🎧', '🖥️',
  '💎', '🏆', '🎯', '🃏', '🎪', '🎬', '🎵', '🛡️',
  '⚔️', '🌽', '🔥', '👑', '🎲', '🎰', '💰', '🎟️',
];

// ═══════════════════════════════════════════════════════
// SKELETON
// ═══════════════════════════════════════════════════════

function PrizeListSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex items-center gap-3 p-3 bg-card rounded-xl border-2 border-border">
          <div className="w-10 h-10 rounded-lg bg-muted animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-28 bg-muted rounded animate-pulse" />
            <div className="h-3 w-20 bg-muted rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════

export function GiveawayManager() {
  const [prizeTypes, setPrizeTypes] = useState<PrizeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PrizeType | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form state
  const [formKey, setFormKey] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formIcon, setFormIcon] = useState('🎁');
  const [formColor, setFormColor] = useState('#f59e0b');
  const [formSortOrder, setFormSortOrder] = useState('99');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingBuiltin, setEditingBuiltin] = useState(false);

  const token = localStorage.getItem('supabase_token') || '';

  // ── Fetch prize types ──
  const fetchPrizeTypes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/giveaway-config/prize-types`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      setPrizeTypes(data.prize_types || []);
    } catch (err: any) {
      console.error('Fetch prize types error:', err);
      toast.error('Failed to load prize types');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchPrizeTypes(); }, [fetchPrizeTypes]);

  // ── Open create form ──
  const openCreateForm = () => {
    setFormMode('create');
    setEditingKey(null);
    setEditingBuiltin(false);
    setFormKey('');
    setFormLabel('');
    setFormIcon('🎁');
    setFormColor('#f59e0b');
    setFormSortOrder(String(prizeTypes.length));
  };

  // ── Open edit form ──
  const openEditForm = (pt: PrizeType) => {
    setFormMode('edit');
    setEditingKey(pt.key);
    setEditingBuiltin(pt.builtin);
    setFormKey(pt.key);
    setFormLabel(pt.label);
    setFormIcon(pt.icon);
    setFormColor(pt.color);
    setFormSortOrder(String(pt.sort_order));
  };

  // ── Close form ──
  const closeForm = () => {
    setFormMode(null);
    setEditingKey(null);
    setEditingBuiltin(false);
  };

  // ── Save (create or update) ──
  const handleSave = async () => {
    if (!formLabel.trim()) { toast.error('Label is required'); return; }
    if (formMode === 'create' && !formKey.trim()) { toast.error('Key is required'); return; }

    setSaving(true);
    try {
      if (formMode === 'create') {
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/giveaway-config/prize-types`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: formKey.trim(), label: formLabel.trim(), icon: formIcon, color: formColor, sort_order: parseInt(formSortOrder) || 99 }),
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to create');
        toast.success(`Prize type "${formLabel.trim()}" created!`);
      } else {
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/giveaway-config/prize-types/${editingKey}`,
          {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ label: formLabel.trim(), icon: formIcon, color: formColor, sort_order: parseInt(formSortOrder) || 99 }),
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update');
        toast.success(`Prize type "${formLabel.trim()}" updated!`);
      }
      closeForm();
      fetchPrizeTypes();
    } catch (err: any) {
      console.error('Save prize type error:', err);
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/giveaway-config/prize-types/${deleteTarget.key}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      toast.success(deleteTarget.builtin
        ? `"${deleteTarget.label}" reset to default`
        : `"${deleteTarget.label}" deleted`
      );
      setDeleteTarget(null);
      fetchPrizeTypes();
    } catch (err: any) {
      console.error('Delete prize type error:', err);
      toast.error(err.message || 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <PrizeListSkeleton />;

  return (
    <div className="space-y-4">
      {/* ── Scrollable Prize Type List ── */}
      <div className="max-h-[520px] overflow-y-auto scrollbar-visible space-y-2 pr-1">
        {prizeTypes.map((pt) => (
          <div
            key={pt.key}
            className="flex items-center justify-between p-3 bg-card rounded-xl border-2 border-border hover:border-harvest/30 transition-colors group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${pt.color}15` }}
              >
                <span className="text-lg">{pt.icon}</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-foreground truncate">{pt.label}</p>
                  {pt.builtin && (
                    <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      Built-in
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="text-[10px] text-muted-foreground font-mono">{pt.key}</code>
                  <div className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: pt.color }} />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => openEditForm(pt)}
                className="w-8 h-8 rounded-lg hover:bg-harvest/10 flex items-center justify-center transition-colors"
                title="Edit"
              >
                <Pencil className="w-3.5 h-3.5 text-harvest" />
              </button>
              {!pt.builtin ? (
                <button
                  onClick={() => setDeleteTarget(pt)}
                  className="w-8 h-8 rounded-lg hover:bg-error/10 flex items-center justify-center transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5 text-error" />
                </button>
              ) : (
                <button
                  onClick={() => setDeleteTarget(pt)}
                  className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors"
                  title="Reset to default"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        ))}

        {prizeTypes.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No prize types found</p>
        )}
      </div>

      {/* ── Add Button ── */}
      <Button
        onClick={openCreateForm}
        className="w-full bg-harvest hover:bg-harvest/90 text-white gap-2"
      >
        <Plus className="w-4 h-4" />
        Add Prize Type
      </Button>

      {/* ── Create/Edit Modal ── */}
      {formMode && (
        <BottomSheetModal onClose={closeForm}>
          <BottomSheetModal.Header>
            <h2 className="text-lg font-bold text-foreground">
              {formMode === 'create' ? 'New Prize Type' : `Edit: ${formLabel}`}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {formMode === 'create' ? 'Add a new prize category for giveaways' : 'Update prize type details'}
            </p>
          </BottomSheetModal.Header>
          <BottomSheetModal.Body className="space-y-4">
            {/* Key (only on create) */}
            {formMode === 'create' && (
              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  Key <span className="text-muted-foreground/60">(lowercase, underscores — used in code)</span>
                </Label>
                <Input
                  value={formKey}
                  onChange={(e) => setFormKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                  placeholder="e.g. steam_gift_card"
                  className="text-sm bg-input-background border-2 border-border text-foreground"
                />
              </div>
            )}

            {/* Label */}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Display Label</Label>
              <Input
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="e.g. Steam Gift Card"
                className="text-sm bg-input-background border-2 border-border text-foreground"
              />
            </div>

            {/* Icon picker */}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Icon (emoji)</Label>
              <div className="flex flex-wrap gap-1.5">
                {EMOJI_PRESETS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setFormIcon(emoji)}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all ${
                      formIcon === emoji
                        ? 'bg-harvest/20 ring-2 ring-harvest scale-110'
                        : 'bg-card hover:bg-muted border border-border'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-muted-foreground">Or type custom:</span>
                <Input
                  value={formIcon}
                  onChange={(e) => setFormIcon(e.target.value)}
                  className="w-16 text-center text-sm bg-input-background border-2 border-border"
                  maxLength={4}
                />
              </div>
            </div>

            {/* Color picker */}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Color</Label>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFormColor(c)}
                    className={`w-8 h-8 rounded-lg transition-all ${
                      formColor === c ? 'ring-2 ring-offset-2 ring-harvest scale-110' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-muted-foreground">Custom hex:</span>
                <Input
                  value={formColor}
                  onChange={(e) => setFormColor(e.target.value)}
                  className="w-28 text-sm bg-input-background border-2 border-border font-mono"
                  maxLength={7}
                />
                <div className="w-6 h-6 rounded-md border border-border" style={{ backgroundColor: formColor }} />
              </div>
            </div>

            {/* Sort order */}
            <div>
              <Label className="text-xs font-semibold text-muted-foreground mb-1 block">Sort Order</Label>
              <Input
                type="number"
                min="0"
                value={formSortOrder}
                onChange={(e) => setFormSortOrder(e.target.value)}
                className="w-20 text-sm bg-input-background border-2 border-border"
              />
            </div>

            {/* Preview */}
            <div className="flex items-center gap-3 bg-card rounded-xl border-2 border-border p-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${formColor}20` }}
              >
                <span className="text-lg">{formIcon}</span>
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{formLabel || 'Untitled'}</p>
                <p className="text-[10px] font-mono text-muted-foreground">{formMode === 'create' ? formKey || 'key' : editingKey}</p>
              </div>
              <span
                className="ml-auto text-xs font-bold px-2.5 py-1 rounded-lg"
                style={{ backgroundColor: `${formColor}15`, color: formColor }}
              >
                Preview
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={closeForm} disabled={saving} className="flex-1 border-border">
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !formLabel.trim() || (formMode === 'create' && !formKey.trim())}
                className="flex-1 bg-harvest hover:bg-harvest/90 text-white gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {formMode === 'create' ? 'Create' : 'Save Changes'}
              </Button>
            </div>
          </BottomSheetModal.Body>
        </BottomSheetModal>
      )}

      {/* ── Delete Confirm Modal ── */}
      {deleteTarget && (
        <ConfirmModal
          title={deleteTarget.builtin ? 'Reset to Default' : 'Delete Prize Type'}
          message={
            deleteTarget.builtin
              ? `Reset "${deleteTarget.label}" back to its default icon, label, and color? Any customizations will be lost.`
              : `Delete the "${deleteTarget.label}" prize type? This cannot be undone. Existing prizes using this type will still display, but the type won't be available for new prizes.`
          }
          confirmText={deleteTarget.builtin ? 'Reset' : 'Delete'}
          confirmVariant={deleteTarget.builtin ? 'primary' : 'danger'}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}