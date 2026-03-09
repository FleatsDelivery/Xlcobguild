import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Trash2, Pencil, Shield, Users, Palette, Tag, Type, Check, Lock } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { BottomSheetModal } from '@/app/components/bottom-sheet-modal';
import { SuccessModal } from '@/app/components/success-modal';
import { supabase } from '@/lib/supabase';
import { projectId } from '/utils/supabase/info';
import { loadCustomRoles, type CustomRole } from '@/lib/roles';

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════

const COLOR_PRESETS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#78716c',
];

const TIER_CONFIG: Record<string, { label: string; color: string }> = {
  owner: { label: 'Owner', color: '#d6a615' },
  officer: { label: 'Officer', color: '#3b82f6' },
  member: { label: 'Member', color: '#10b981' },
  guest: { label: 'Guest', color: '#78716c' },
};

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

interface RoleItem extends CustomRole {
  isBuiltin: boolean;
  sortOrder: number;
}

type FormMode = 'create' | 'edit';

// ═══════════════════════════════════════════════════════
// SKELETON
// ═══════════════════════════════════════════════════════

function RoleListSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex items-center gap-3 p-3 bg-card rounded-xl border-2 border-border">
          <div className="w-8 h-8 rounded-lg bg-muted animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            <div className="h-3 w-32 bg-muted rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════

export function RoleManagement() {
  const [allRoles, setAllRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [saving, setSaving] = useState(false);

  // Which role is being edited (by value)
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [editingIsBuiltin, setEditingIsBuiltin] = useState(false);

  // Form state
  const [formValue, setFormValue] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formBadgeTag, setFormBadgeTag] = useState('');
  const [formHex, setFormHex] = useState('#3b82f6');
  const [formTier, setFormTier] = useState<'member' | 'officer'>('member');

  // Delete confirmation modal
  const [deleteModal, setDeleteModal] = useState<{
    role: RoleItem;
    affectedUsers: number;
    loading: boolean;
    deleting: boolean;
  } | null>(null);

  const [successModal, setSuccessModal] = useState<{
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
    helpText?: string;
  } | null>(null);

  const getAuthHeader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    return { 'Authorization': `Bearer ${session.access_token}` };
  };

  const baseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af`;

  const fetchRoles = useCallback(async () => {
    try {
      const headers = await getAuthHeader();
      const response = await fetch(`${baseUrl}/roles`, { headers });
      if (response.ok) {
        const data = await response.json();
        const roles: RoleItem[] = (data.roles || []).map((r: any) => ({
          value: r.value,
          displayName: r.displayName,
          badgeTag: r.badgeTag,
          hex: r.hex,
          tier: r.tier,
          isBuiltin: r.isBuiltin,
          sortOrder: r.sortOrder,
        }));
        setAllRoles(roles);
        const custom = roles.filter(r => !r.isBuiltin);
        loadCustomRoles(custom);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const builtinRoles = allRoles.filter(r => r.isBuiltin);
  const customRoles = allRoles.filter(r => !r.isBuiltin);

  // Auto-generate value and badge tag from display name (only in create mode)
  const handleDisplayNameChange = (name: string) => {
    setFormDisplayName(name);
    if (formMode === 'create') {
      const autoValue = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
      setFormValue(autoValue);
      const words = name.trim().split(/\s+/);
      const autoTag = words.length > 1
        ? words.map(w => w[0]).join('').toUpperCase().slice(0, 5)
        : name.toUpperCase().slice(0, 5);
      setFormBadgeTag(autoTag);
    }
  };

  const resetForm = () => {
    setFormValue('');
    setFormDisplayName('');
    setFormBadgeTag('');
    setFormHex('#3b82f6');
    setFormTier('member');
    setFormMode(null);
    setEditingValue(null);
    setEditingIsBuiltin(false);
  };

  const openCreateForm = () => {
    resetForm();
    setFormMode('create');
  };

  const openEditForm = (role: RoleItem) => {
    setFormMode('edit');
    setEditingValue(role.value);
    setEditingIsBuiltin(role.isBuiltin);
    setFormValue(role.value);
    setFormDisplayName(role.displayName);
    setFormBadgeTag(role.badgeTag);
    setFormHex(role.hex);
    setFormTier(role.tier === 'officer' ? 'officer' : 'member');
  };

  const handleSave = async () => {
    if (!formDisplayName || !formBadgeTag || !formHex) {
      setSuccessModal({ type: 'error', title: 'Missing Fields', message: 'Please fill in all required fields.' });
      return;
    }
    if (formMode === 'create' && !formValue) {
      setSuccessModal({ type: 'error', title: 'Missing Fields', message: 'DB Value is required.' });
      return;
    }

    setSaving(true);
    try {
      const headers = { ...(await getAuthHeader()), 'Content-Type': 'application/json' };

      if (formMode === 'create') {
        const response = await fetch(`${baseUrl}/roles`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ value: formValue, displayName: formDisplayName, badgeTag: formBadgeTag, hex: formHex, tier: formTier }),
        });
        if (response.ok) {
          setSuccessModal({ type: 'success', title: 'Role Created', message: `"${formDisplayName}" has been created. You can now assign it to users in User Management.` });
          resetForm();
          fetchRoles();
        } else {
          const error = await response.json();
          setSuccessModal({ type: 'error', title: 'Failed to Create Role', message: error.error || 'Something went wrong.' });
        }
      } else if (formMode === 'edit' && editingValue) {
        const response = await fetch(`${baseUrl}/roles/${editingValue}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ displayName: formDisplayName, badgeTag: formBadgeTag, hex: formHex, tier: formTier }),
        });
        if (response.ok) {
          setSuccessModal({ type: 'success', title: 'Role Updated', message: `"${formDisplayName}" has been updated.` });
          resetForm();
          fetchRoles();
        } else {
          const error = await response.json();
          setSuccessModal({ type: 'error', title: 'Failed to Update Role', message: error.error || 'Something went wrong.' });
        }
      }
    } catch (error) {
      console.error('Error saving role:', error);
      setSuccessModal({ type: 'error', title: 'Error', message: 'Failed to save role. Check console for details.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = async (role: RoleItem) => {
    setDeleteModal({ role, affectedUsers: 0, loading: true, deleting: false });
    try {
      const headers = await getAuthHeader();
      const response = await fetch(`${baseUrl}/roles/${role.value}/users`, { headers });
      if (response.ok) {
        const data = await response.json();
        setDeleteModal(prev => prev ? { ...prev, affectedUsers: data.count || 0, loading: false } : null);
      } else {
        setDeleteModal(prev => prev ? { ...prev, loading: false } : null);
      }
    } catch (error) {
      console.error('Error fetching user count for role:', error);
      setDeleteModal(prev => prev ? { ...prev, loading: false } : null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    setDeleteModal(prev => prev ? { ...prev, deleting: true } : null);
    try {
      const headers = await getAuthHeader();
      const response = await fetch(`${baseUrl}/roles/${deleteModal.role.value}`, {
        method: 'DELETE',
        headers,
      });
      if (response.ok) {
        const affected = deleteModal.affectedUsers;
        const roleName = deleteModal.role.displayName;
        setDeleteModal(null);
        setSuccessModal({
          type: 'success',
          title: 'Role Deleted',
          message: `"${roleName}" has been removed.${affected > 0 ? ` ${affected} user${affected !== 1 ? 's were' : ' was'} moved to Guest.` : ''}`,
        });
        fetchRoles();
      } else {
        const error = await response.json();
        setDeleteModal(null);
        setSuccessModal({ type: 'error', title: 'Failed to Delete', message: error.error || 'Something went wrong.' });
      }
    } catch (error) {
      console.error('Error deleting role:', error);
      setDeleteModal(null);
      setSuccessModal({ type: 'error', title: 'Error', message: 'Failed to delete role. Check console for details.' });
    }
  };

  /** Renders a single role card row */
  const RoleCard = ({ role }: { role: RoleItem }) => {
    const tierInfo = TIER_CONFIG[role.tier] || TIER_CONFIG.member;
    const isEditing = editingValue === role.value;

    return (
      <div
        className={`flex items-center justify-between p-3 bg-card rounded-xl border-2 transition-colors ${
          isEditing ? 'border-harvest/40 bg-harvest/5' : 'border-border'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0"
            style={{ backgroundColor: role.hex }}
          >
            {role.badgeTag}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold text-foreground truncate">{role.displayName}</p>
              {role.isBuiltin && (
                <Lock className="w-3 h-3 text-muted-foreground shrink-0" title="Built-in role" />
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">
              <code className="bg-muted px-1 py-0.5 rounded">{role.value}</code>
              <span className="mx-1">&middot;</span>
              <span style={{ color: tierInfo.color }} className="font-semibold">
                {tierInfo.label}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            onClick={() => openEditForm(role)}
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 border-harvest/30 text-harvest hover:bg-harvest/10"
            disabled={isEditing}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          {!role.isBuiltin && (
            <Button
              onClick={() => handleDeleteClick(role)}
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 border-[#ef4444]/30 text-[#ef4444] hover:bg-[#ef4444]/10"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  if (loading) return <RoleListSkeleton />;

  return (
    <div className="space-y-4">
      {/* Scrollable role list */}
      <div className="max-h-[520px] overflow-y-auto scrollbar-visible space-y-4 pr-1">
        {/* Built-in Roles */}
        <div>
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
            Built-in Roles
            <span className="ml-1.5 text-muted-foreground/60 font-normal normal-case">(display only — cannot delete)</span>
          </h4>
          <div className="space-y-2">
            {builtinRoles.map(role => (
              <RoleCard key={role.value} role={role} />
            ))}
          </div>
        </div>

        {/* Custom Roles */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Custom Roles</h4>
          </div>

          {customRoles.length === 0 && (
            <p className="text-xs text-muted-foreground italic py-2">
              No custom roles yet. Create one to expand your guild system.
            </p>
          )}

          {customRoles.length > 0 && (
            <div className="space-y-2">
              {customRoles.map(role => (
                <RoleCard key={role.value} role={role} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Role button */}
      <Button
        onClick={openCreateForm}
        className="w-full bg-harvest hover:bg-amber text-white gap-2"
      >
        <Plus className="w-4 h-4" />
        New Role
      </Button>

      {/* ── Create / Edit Modal ── */}
      {formMode && (
        <BottomSheetModal onClose={resetForm}>
          <BottomSheetModal.Header>
            <h2 className="text-lg font-bold text-foreground">
              {formMode === 'create' ? 'Create New Guild Role' : `Edit Role: ${formDisplayName || editingValue}`}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {formMode === 'create' ? 'Define a new custom guild role' : 'Update role display and permissions'}
            </p>
          </BottomSheetModal.Header>
          <BottomSheetModal.Body className="space-y-4">
            {/* Display Name */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1">
                <Type className="w-3.5 h-3.5" />
                Display Name *
              </label>
              <input
                type="text"
                value={formDisplayName}
                onChange={(e) => handleDisplayNameChange(e.target.value)}
                placeholder="e.g. Husk Hunters"
                className="w-full px-3 py-2 text-sm border-2 border-border bg-input-background text-foreground rounded-lg focus:outline-none focus:border-harvest transition-all"
                maxLength={30}
              />
            </div>

            {/* Value + Badge Tag (side by side) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1">
                  <Shield className="w-3.5 h-3.5" />
                  DB Value *
                </label>
                <input
                  type="text"
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="husk_hunters"
                  className={`w-full px-3 py-2 text-sm font-mono border-2 border-border bg-input-background text-foreground rounded-lg focus:outline-none focus:border-harvest transition-all ${
                    formMode === 'edit' ? 'bg-muted text-muted-foreground cursor-not-allowed' : ''
                  }`}
                  maxLength={30}
                  disabled={formMode === 'edit'}
                />
                {formMode === 'edit' && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">DB value cannot be changed</p>
                )}
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1">
                  <Tag className="w-3.5 h-3.5" />
                  Badge Tag *
                </label>
                <input
                  type="text"
                  value={formBadgeTag}
                  onChange={(e) => setFormBadgeTag(e.target.value.toUpperCase().slice(0, 5))}
                  placeholder="HH"
                  className="w-full px-3 py-2 text-sm font-mono uppercase border-2 border-border bg-input-background text-foreground rounded-lg focus:outline-none focus:border-harvest transition-all"
                  maxLength={5}
                />
              </div>
            </div>

            {/* Color Picker */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2">
                <Palette className="w-3.5 h-3.5" />
                Brand Color *
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {COLOR_PRESETS.map(color => (
                  <button
                    key={color}
                    onClick={() => setFormHex(color)}
                    className={`w-7 h-7 rounded-lg transition-all ${
                      formHex === color ? 'ring-2 ring-offset-1 ring-foreground scale-110' : 'hover:scale-110'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formHex}
                  onChange={(e) => setFormHex(e.target.value)}
                  className="w-8 h-8 rounded-lg border-2 border-border cursor-pointer"
                />
                <input
                  type="text"
                  value={formHex}
                  onChange={(e) => setFormHex(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs font-mono border-2 border-border bg-input-background text-foreground rounded-lg focus:outline-none focus:border-harvest"
                  placeholder="#3b82f6"
                />
              </div>
            </div>

            {/* Permission Tier */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2">
                <Users className="w-3.5 h-3.5" />
                Permission Tier
                {editingIsBuiltin && (
                  <span className="text-[10px] text-muted-foreground/60 font-normal flex items-center gap-0.5">
                    <Lock className="w-2.5 h-2.5" /> Locked for built-in roles
                  </span>
                )}
              </label>
              {editingIsBuiltin ? (
                <div className="py-2 px-3 rounded-lg bg-muted text-sm text-muted-foreground border-2 border-border">
                  {TIER_CONFIG[formTier]?.label || formTier} tier — cannot be changed for built-in roles
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setFormTier('member')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all border-2 ${
                      formTier === 'member'
                        ? 'bg-[#10b981] text-white border-transparent'
                        : 'bg-card text-muted-foreground border-border hover:border-[#10b981]/40'
                    }`}
                  >
                    Member
                    <span className="block text-[10px] font-normal mt-0.5 opacity-70">Standard access</span>
                  </button>
                  <button
                    onClick={() => setFormTier('officer')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all border-2 ${
                      formTier === 'officer'
                        ? 'bg-[#3b82f6] text-white border-transparent'
                        : 'bg-card text-muted-foreground border-border hover:border-[#3b82f6]/40'
                    }`}
                  >
                    Officer
                    <span className="block text-[10px] font-normal mt-0.5 opacity-70">Admin panels</span>
                  </button>
                </div>
              )}
            </div>

            {/* Preview */}
            {formDisplayName && (
              <div className="bg-muted rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-2">Preview</p>
                <div className="flex items-center gap-3">
                  <span
                    className="px-2 py-0.5 text-white text-xs font-semibold rounded-full"
                    style={{ backgroundColor: formHex }}
                  >
                    {formDisplayName}
                  </span>
                  <span
                    className="px-1.5 py-0.5 text-white text-[8px] font-bold rounded-full"
                    style={{ backgroundColor: formHex }}
                  >
                    {formBadgeTag || '?'}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">{formValue || 'value'}</span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleSave}
                disabled={saving || !formDisplayName || !formBadgeTag || (formMode === 'create' && !formValue)}
                className={`flex-1 text-white ${formMode === 'edit' ? 'bg-[#3b82f6] hover:bg-[#2563eb]' : 'bg-harvest hover:bg-amber'}`}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : formMode === 'edit' ? (
                  <><Check className="w-4 h-4 mr-1.5" /> Save Changes</>
                ) : (
                  <><Plus className="w-4 h-4 mr-1.5" /> Create Role</>
                )}
              </Button>
              <Button
                onClick={resetForm}
                variant="outline"
                className="border-border"
              >
                Cancel
              </Button>
            </div>
          </BottomSheetModal.Body>
        </BottomSheetModal>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteModal && (
        <BottomSheetModal onClose={() => !deleteModal.deleting && setDeleteModal(null)}>
          <BottomSheetModal.Header gradient="from-[#ef4444]/10 to-[#ef4444]/5" borderColor="border-[#ef4444]/20">
            <h2 className="text-lg font-bold text-foreground">Delete Role</h2>
            <p className="text-sm text-muted-foreground mt-1">This action cannot be undone</p>
          </BottomSheetModal.Header>
          <BottomSheetModal.Body className="space-y-4">
            <div className="bg-muted rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold"
                  style={{ backgroundColor: deleteModal.role.hex }}
                >
                  {deleteModal.role.badgeTag}
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{deleteModal.role.displayName}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{deleteModal.role.value}</p>
                </div>
              </div>

              {deleteModal.loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking affected users...
                </div>
              ) : (
                <div className={`rounded-lg p-3 ${
                  deleteModal.affectedUsers > 0
                    ? 'bg-[#f59e0b]/10 border border-[#f59e0b]/30'
                    : 'bg-[#10b981]/10 border border-[#10b981]/30'
                }`}>
                  {deleteModal.affectedUsers > 0 ? (
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-[#f59e0b]">
                        {deleteModal.affectedUsers} user{deleteModal.affectedUsers !== 1 ? 's' : ''} will be affected
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {deleteModal.affectedUsers === 1 ? 'This user' : 'These users'} will be moved to the <span className="font-semibold text-foreground">Guest</span> role automatically.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-[#10b981]">
                      No users currently have this role
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                onClick={confirmDelete}
                disabled={deleteModal.loading || deleteModal.deleting}
                className="flex-1 bg-[#ef4444] hover:bg-[#dc2626] text-white"
              >
                {deleteModal.deleting ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-1.5" /> Deleting...</>
                ) : (
                  <><Trash2 className="w-4 h-4 mr-1.5" /> Delete Role</>
                )}
              </Button>
              <Button
                onClick={() => setDeleteModal(null)}
                variant="outline"
                className="border-border"
                disabled={deleteModal.deleting}
              >
                Cancel
              </Button>
            </div>
          </BottomSheetModal.Body>
        </BottomSheetModal>
      )}

      {/* Success / Error Modal */}
      {successModal && (
        <SuccessModal
          type={successModal.type}
          title={successModal.title}
          message={successModal.message}
          helpText={successModal.helpText}
          onClose={() => setSuccessModal(null)}
        />
      )}
    </div>
  );
}