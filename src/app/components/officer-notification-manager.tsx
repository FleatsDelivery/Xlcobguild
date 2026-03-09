/**
 * Officer Notification Manager — CRUD for notification type configs
 *
 * Allows officers to manage notification types: create, edit, delete, toggle.
 * Also includes a one-click "Seed Defaults" button for initial setup.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Bell, Plus, Trash2, Loader2, CheckCircle, XCircle, Edit2, Save,
  UserPlus, Star, Gift, Trophy, Shield, Activity,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { BottomSheetModal } from '@/app/components/bottom-sheet-modal';
import { projectId } from '/utils/supabase/info';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════

interface NotificationTypeConfig {
  slug: string;
  label: string;
  icon: string;
  color: string;
  description: string;
  enabled: boolean;
}

const ICON_OPTIONS = [
  { name: 'Bell', icon: Bell },
  { name: 'UserPlus', icon: UserPlus },
  { name: 'CheckCircle', icon: CheckCircle },
  { name: 'XCircle', icon: XCircle },
  { name: 'Star', icon: Star },
  { name: 'Gift', icon: Gift },
  { name: 'Trophy', icon: Trophy },
  { name: 'Shield', icon: Shield },
  { name: 'Activity', icon: Activity },
];

const ICON_MAP: Record<string, React.ElementType> = Object.fromEntries(
  ICON_OPTIONS.map(i => [i.name, i.icon])
);

function getIcon(name: string): React.ElementType {
  return ICON_MAP[name] || Bell;
}

// ═══════════════════════════════════════════════════════
// SKELETON
// ═══════════════════════════════════════════════════════

function NotifListSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border">
          <div className="w-8 h-8 rounded-lg bg-muted animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-28 bg-muted rounded animate-pulse" />
            <div className="h-3 w-40 bg-muted rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════

export function OfficerNotificationManager() {
  const [configs, setConfigs] = useState<NotificationTypeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [deletingSlug, setDeletingSlug] = useState<string | null>(null);

  // Modal state
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<NotificationTypeConfig>>({});

  const apiBase = `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af`;

  const getHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token || ''}`,
    };
  }, []);

  const fetchConfigs = useCallback(async () => {
    try {
      const headers = await getHeaders();
      const res = await fetch(`${apiBase}/notification-configs`, { headers });
      if (res.ok) {
        const data = await res.json();
        setConfigs(data.configs || []);
      }
    } catch (err) {
      console.error('Failed to load notification configs:', err);
    } finally {
      setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => { fetchConfigs(); }, [fetchConfigs]);

  // Seed defaults
  const seedDefaults = async () => {
    setSeeding(true);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${apiBase}/notification-configs/seed-defaults`, { method: 'POST', headers });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Seeded ${data.count} default notification types!`);
        await fetchConfigs();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to seed defaults');
      }
    } catch (err) {
      toast.error('Failed to seed defaults');
    } finally {
      setSeeding(false);
    }
  };

  // Save (create or update)
  const saveConfig = async () => {
    if (!form.slug && !editingSlug) { toast.error('Slug is required'); return; }
    const slug = editingSlug || form.slug!;
    setSaving(true);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${apiBase}/notification-configs/${slug}`, {
        method: 'PUT', headers,
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success(editingSlug ? 'Updated!' : 'Created!');
        closeModal();
        await fetchConfigs();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to save');
      }
    } catch (err) {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const deleteConfig = async (slug: string) => {
    setDeletingSlug(slug);
    try {
      const headers = await getHeaders();
      const res = await fetch(`${apiBase}/notification-configs/${slug}`, { method: 'DELETE', headers });
      if (res.ok) {
        toast.success('Deleted!');
        setConfigs(prev => prev.filter(c => c.slug !== slug));
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to delete');
      }
    } catch (err) {
      toast.error('Failed to delete');
    } finally {
      setDeletingSlug(null);
    }
  };

  // Open modals
  const openCreate = () => {
    setEditingSlug(null);
    setModalMode('create');
    setForm({ slug: '', label: '', icon: 'Bell', color: '#6b7280', description: '', enabled: true });
  };

  const openEdit = (cfg: NotificationTypeConfig) => {
    setEditingSlug(cfg.slug);
    setModalMode('edit');
    setForm({ ...cfg });
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingSlug(null);
    setForm({});
  };

  if (loading) return <NotifListSkeleton />;

  return (
    <div>
      {/* Seed defaults if empty */}
      {configs.length === 0 && (
        <div className="bg-harvest/5 border border-harvest/20 rounded-xl p-4 mb-4">
          <p className="text-sm text-foreground font-semibold mb-2">No notification types configured yet</p>
          <p className="text-xs text-muted-foreground mb-3">Seed the default types to get started. You can customize them later.</p>
          <Button
            onClick={seedDefaults}
            disabled={seeding}
            className="bg-harvest hover:bg-harvest/90 text-white font-bold text-xs rounded-xl h-9"
          >
            {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Star className="w-3.5 h-3.5 mr-1.5" />}
            Seed Default Types
          </Button>
        </div>
      )}

      {/* ── Scrollable Config List ── */}
      <div className="max-h-[520px] overflow-y-auto scrollbar-visible space-y-2 mb-4 pr-1">
        {configs.map(cfg => {
          const Icon = getIcon(cfg.icon);
          return (
            <div key={cfg.slug} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border hover:border-harvest/30 transition-all">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: `${cfg.color}15` }}
                >
                  <Icon className="w-4 h-4" style={{ color: cfg.color }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{cfg.label}</span>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">{cfg.slug}</span>
                    {!cfg.enabled && (
                      <span className="text-[10px] text-[#ef4444] bg-[#ef4444]/10 px-1.5 py-0.5 rounded font-bold">Disabled</span>
                    )}
                  </div>
                  {cfg.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{cfg.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEdit(cfg)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => deleteConfig(cfg.slug)}
                  disabled={deletingSlug === cfg.slug}
                  className="p-1.5 rounded-lg hover:bg-[#ef4444]/10 text-muted-foreground hover:text-[#ef4444] transition-colors"
                >
                  {deletingSlug === cfg.slug ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Add Button ── */}
      <Button
        onClick={openCreate}
        className="w-full bg-muted hover:bg-muted/80 text-muted-foreground font-bold text-xs rounded-xl h-9"
      >
        <Plus className="w-3.5 h-3.5 mr-1.5" />
        Add Notification Type
      </Button>

      {/* ── Create/Edit Modal ── */}
      {modalMode && (
        <BottomSheetModal onClose={closeModal}>
          <BottomSheetModal.Header>
            <h2 className="text-lg font-bold text-foreground">
              {modalMode === 'create' ? 'New Notification Type' : 'Edit Notification Type'}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {modalMode === 'create' ? 'Define a new notification category' : 'Update notification type settings'}
            </p>
          </BottomSheetModal.Header>
          <BottomSheetModal.Body className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {modalMode === 'create' && (
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Slug</label>
                  <Input
                    value={form.slug || ''}
                    onChange={e => setForm({ ...form, slug: e.target.value.replace(/[^a-z0-9_]/g, '') })}
                    placeholder="e.g. team_invite"
                    className="h-8 text-xs bg-input-background"
                  />
                </div>
              )}
              <div>
                <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Label</label>
                <Input
                  value={form.label || ''}
                  onChange={e => setForm({ ...form, label: e.target.value })}
                  placeholder="Team Invite"
                  className="h-8 text-xs bg-input-background"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.color || '#6b7280'}
                    onChange={e => setForm({ ...form, color: e.target.value })}
                    className="w-8 h-8 rounded-lg border border-border cursor-pointer"
                  />
                  <Input
                    value={form.color || ''}
                    onChange={e => setForm({ ...form, color: e.target.value })}
                    className="h-8 text-xs flex-1 font-mono bg-input-background"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Icon</label>
              <div className="flex flex-wrap gap-1.5">
                {ICON_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  const selected = form.icon === opt.name;
                  return (
                    <button
                      key={opt.name}
                      onClick={() => setForm({ ...form, icon: opt.name })}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                        selected ? 'bg-harvest/20 ring-2 ring-harvest' : 'bg-muted hover:bg-muted/80'
                      }`}
                      title={opt.name}
                    >
                      <Icon className={`w-4 h-4 ${selected ? 'text-harvest' : 'text-muted-foreground'}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-muted-foreground mb-1 block">Description</label>
              <Input
                value={form.description || ''}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Short description..."
                className="h-8 text-xs bg-input-background"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.enabled !== false}
                  onChange={e => setForm({ ...form, enabled: e.target.checked })}
                  className="w-4 h-4 rounded accent-harvest"
                />
                Enabled
              </label>

              <div className="flex gap-2">
                <Button onClick={closeModal} className="bg-muted text-muted-foreground text-xs rounded-xl h-8 px-3">Cancel</Button>
                <Button onClick={saveConfig} disabled={saving} className="bg-harvest hover:bg-harvest/90 text-white text-xs rounded-xl h-8 px-4 font-bold">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                  {modalMode === 'create' ? 'Create' : 'Save'}
                </Button>
              </div>
            </div>
          </BottomSheetModal.Body>
        </BottomSheetModal>
      )}
    </div>
  );
}