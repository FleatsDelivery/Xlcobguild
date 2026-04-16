import { useState, useEffect } from 'react';
import { Swords, Plus, Shield, Users, LogOut, Loader2, Crown, Palette, Link as LinkIcon, Settings, UserPlus, Search, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { projectId } from '/utils/supabase/info';
import { Button } from '@/app/components/ui/button';
import { BottomSheetModal } from '@/app/components/bottom-sheet-modal';
import { toast } from 'sonner';

interface Guild {
  id: string;
  name: string;
  tag: string;
  color: string;
  logo_url: string | null;
  created_by: string;
  member_limit: number;
}

interface ProfileGuildManagerProps {
  user: any;
  onRefresh?: () => Promise<void>;
}

export function ProfileGuildManager({ user, onRefresh }: ProfileGuildManagerProps) {
  const apiBase = `https://${projectId}.supabase.co/functions/v1`;
  const [guild, setGuild] = useState<Guild | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [invitingId, setInvitingId] = useState<string | null>(null);

  // Form state for Create/Edit
  const [formData, setFormData] = useState({
    name: '',
    tag: '',
    color: '#3b82f6',
    logo_url: ''
  });

  const [members, setMembers] = useState<any[]>([]);

  useEffect(() => {
    if (user?.guild_id) {
      fetchGuild(user.guild_id);
    } else {
      setLoading(false);
    }
  }, [user?.guild_id]);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      const timer = setTimeout(() => handleSearch(), 400);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  async function handleSearch() {
    setSearching(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${apiBase}/make-server-4789f4af/guilds/search-users?q=${encodeURIComponent(searchQuery)}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      const result = await response.json();
      if (response.ok) {
        setSearchResults(result.users || []);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  }

  const fetchGuild = async (id: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch(`${apiBase}/make-server-4789f4af/guilds/${id}`);
      if (!response.ok) throw new Error('Failed to fetch guild');
      const data = await response.json();
      setGuild(data.guild);
      setMembers(data.members || []);
      
      // Update form data to match server state when data arrives
      if (data.guild) {
        setFormData({
          name: data.guild.name,
          tag: data.guild.tag,
          color: data.guild.color,
          logo_url: data.guild.logo_url || ''
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // ── Modals Synchronization ──
  // Ensures fresh data on open and resets local form state
  useEffect(() => {
    if ((showEditModal || showCreateModal || showInviteModal) && user?.guild_id) {
      fetchGuild(user.guild_id, true);
    }
  }, [showEditModal, showCreateModal, showInviteModal, user?.guild_id]);

  useEffect(() => {
    if (!showEditModal && !showCreateModal && guild) {
      // Clear/Reset form when modals closed to server state
      setFormData({
        name: guild.name,
        tag: guild.tag,
        color: guild.color,
        logo_url: guild.logo_url || ''
      });
    }
  }, [showEditModal, showCreateModal]);

  useEffect(() => {
    if (showCreateModal) {
      // Clear form when opening Create
      setFormData({
        name: '',
        tag: '',
        color: '#3b82f6',
        logo_url: ''
      });
    }
  }, [showCreateModal]);

  useEffect(() => {
    if (showInviteModal && user?.guild_id) {
      // Refresh roster + trigger initial "Suggested Recruits" fetch
      fetchGuild(user.guild_id, true);
      handleSearch(); 
    }
    if (!showInviteModal) {
      // Clear search when closing Invite modal
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [showInviteModal, user?.guild_id]);


  const handleCreateGuild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.tcf_plus_active) {
      toast.error('TCF+ required to create a guild');
      return;
    }

    setSaving(true);
    // 1. Create the guild
    const { data, error } = await supabase
      .from('guild_wars_guilds')
      .insert({
        name: formData.name,
        tag: formData.tag.toUpperCase(),
        color: formData.color,
        logo_url: formData.logo_url || null,
        created_by: user.id
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message || 'Failed to create guild');
    } else {
      // 2. Set the owner's guild_id
      const { error: userError } = await supabase
        .from('users')
        .update({ guild_id: data.id })
        .eq('id', user.id);

      if (userError) {
        toast.error('Guild created, but failed to join. Please join manually.');
      } else {
        toast.success('Guild created! Welcome, Commander.');
        setShowCreateModal(false);
        if (onRefresh) await onRefresh();
      }
    }
    setSaving(false);
  };

  const handleUpdateGuild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guild) return;

    setSaving(true);
    const { error } = await supabase
      .from('guild_wars_guilds')
      .update({
        name: formData.name,
        tag: formData.tag.toUpperCase(),
        color: formData.color,
        logo_url: formData.logo_url || null
      })
      .eq('id', guild.id);

    if (error) {
      toast.error('Failed to update guild');
    } else {
      toast.success('Branding updated!');
      setShowEditModal(false);
      fetchGuild(guild.id);
      if (onRefresh) await onRefresh();
    }
    setSaving(false);
  };

  const handleLeaveGuild = async () => {
    if (!confirm('Are you sure you want to leave your guild?')) return;

    setSaving(true);
    // Use API endpoint for role syncing
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${apiBase}/make-server-4789f4af/guilds/${guild?.id}/leave`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      toast.success('Departed guild.');
      setGuild(null);
      if (onRefresh) await onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to leave guild');
    }
    setSaving(false);
  };

  const handleKickMember = async (targetUserId: string, username: string) => {
    if (!isOwner) return;
    if (!confirm(`Are you sure you want to kick ${username} from the guild?`)) return;

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${apiBase}/make-server-4789f4af/guilds/${guild?.id}/kick/${targetUserId}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      toast.success(`${username} has been discharged.`);
      fetchGuild(guild!.id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to kick member');
    }
    setSaving(false);
  };


  const handleInvite = async (targetUserId: string) => {
    setInvitingId(targetUserId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${apiBase}/make-server-4789f4af/guilds/${guild?.id}/invite/${targetUserId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      toast.success('Invitation sent!');
      // Update local state to show invited
      setSearchResults(prev => prev.map(u => u.id === targetUserId ? { ...u, invited: true } : u));
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invite');
    } finally {
      setInvitingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-harvest" />
      </div>
    );
  }

  // CASE 1: NOT IN A GUILD
  if (!user?.guild_id) {
    return (
      <div className="bg-card rounded-2xl p-5 sm:p-6 border-2 border-border">
        {/* ... (existing Create Guild view) ... */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Swords className="w-5 h-5 text-harvest" />
            <h2 className="text-lg font-bold text-foreground">My Guild</h2>
          </div>
          {user?.tcf_plus_active && (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-harvest hover:bg-amber text-white text-xs font-bold px-4 h-9 rounded-full gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Guild
            </Button>
          )}
        </div>

        <div className="border-2 border-dashed border-border rounded-xl p-8 text-center bg-muted/20">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <Shield className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-bold text-foreground mb-1">You ARE not in a guild</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto mb-4">
             Join a community on the leaderboard or create your own to start climbing the towers!
          </p>
          <Button 
             variant="outline"
             onClick={() => window.location.hash = '#leaderboard'}
             className="text-xs font-bold border-2 border-border h-9 px-6 rounded-full"
          >
             Browse Leaderboard
          </Button>
          {!user?.tcf_plus_active && (
            <p className="text-[10px] text-muted-foreground mt-4 italic">
              * TCF+ is required to create and manage your own guild.
            </p>
          )}
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <BottomSheetModal onClose={() => setShowCreateModal(false)}>
            <BottomSheetModal.Header>
              <h2 className="text-lg font-bold text-foreground">Build Your Legacy</h2>
              <p className="text-sm text-muted-foreground">Found a new guild and invite your friends</p>
            </BottomSheetModal.Header>
            <BottomSheetModal.Body>
              <form onSubmit={handleCreateGuild} className="space-y-4">
                 <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Guild Name</label>
                      <input
                        required
                        type="text"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        placeholder="e.g. The Huskar Hunters"
                        className="w-full px-3 py-2 text-sm border-2 border-border bg-input-background text-foreground rounded-xl focus:border-harvest transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Guild Tag</label>
                      <input
                        required
                        type="text"
                        value={formData.tag}
                        onChange={e => setFormData({...formData, tag: e.target.value.toUpperCase().slice(0, 5)})}
                        placeholder="HH"
                        className="w-full px-3 py-2 text-sm border-2 border-border bg-input-background text-foreground rounded-xl focus:border-harvest transition-all font-black"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Brand Color</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={formData.color}
                          onChange={e => setFormData({...formData, color: e.target.value})}
                          className="w-10 h-10 rounded-xl border-2 border-border cursor-pointer bg-transparent"
                        />
                        <input
                          type="text"
                          value={formData.color}
                          onChange={e => setFormData({...formData, color: e.target.value})}
                          className="flex-1 px-3 py-2 text-xs font-mono border-2 border-border bg-input-background text-foreground rounded-xl"
                        />
                      </div>
                    </div>
                 </div>
                 <Button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-harvest hover:bg-amber text-white font-bold h-12 rounded-2xl shadow-lg border-b-4 border-amber-600 active:border-b-0 active:translate-y-1 transition-all mt-4"
                  >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Guild'}
                  </Button>
              </form>
            </BottomSheetModal.Body>
          </BottomSheetModal>
        )}
      </div>
    );
  }

  // CASE 2: IN A GUILD
  const isOwner = guild?.created_by === user.id;

  const RANK_EMOJIS = ['\u{1F41B}', '\u{1F98C}', '\u{1F33D}', '\u{1F944}', '\u{1F35E}', '\u{1F33E}', '\u{1F33B}', '\u{1F3AF}', '\u2B50', '\u{1F31F}', '\u{1F4A5}'];

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl p-5 sm:p-6 border-2 border-border">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-harvest" />
            <h2 className="text-lg font-bold text-foreground">My Guild</h2>
          </div>
          <div className="flex gap-2">
            {isOwner && (
              <>
                <Button
                  onClick={() => setShowInviteModal(true)}
                  className="bg-harvest hover:bg-amber text-white text-xs font-bold px-4 h-9 rounded-full gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Invite
                </Button>
                <Button
                  onClick={() => setShowEditModal(true)}
                  variant="outline"
                  className="text-xs font-bold border-2 border-border h-9 px-4 rounded-full gap-1.5"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Manage
                </Button>
              </>
            )}
            <Button
              onClick={handleLeaveGuild}
              variant="ghost"
              className="text-xs font-bold text-red-500 hover:bg-red-500/10 h-9 px-4 rounded-full gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              Leave
            </Button>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border-2 border-border bg-muted/10 p-5 flex flex-col items-center text-center">
          {/* Decorative background circle */}
          <div 
            className="absolute -top-24 -right-24 w-48 h-48 rounded-full opacity-10 blur-3xl pointer-events-none"
            style={{ backgroundColor: guild?.color }}
          />
          
          <div 
            className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-xl mb-4 overflow-hidden border-4 border-card"
            style={{ backgroundColor: guild?.color }}
          >
            {guild?.logo_url ? (
              <img src={guild.logo_url} alt={guild.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white font-black text-2xl tracking-tighter">{guild?.tag}</span>
            )}
          </div>

          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-2xl font-black text-foreground leading-tight">{guild?.name}</h3>
            {isOwner && <Crown className="w-4 h-4 text-amber-500 fill-amber-500" />}
          </div>
          
          <div className="flex items-center gap-4 mt-2">
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Tag</span>
              <span className="text-sm font-bold text-harvest">{guild?.tag}</span>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Capacity</span>
              <span className="text-sm font-bold text-foreground">{members.length} / {guild?.member_limit} Members</span>
            </div>
          </div>
        </div>

        {/* Members List */}
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-4 px-1">
            <Users className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-black text-foreground uppercase tracking-widest">Roster Management</h3>
          </div>
          
          <div className="space-y-2">
            {members.map((member) => (
              <div 
                key={member.id}
                className="group flex items-center justify-between p-3 rounded-xl border-2 border-border/50 bg-muted/5 hover:border-border hover:bg-muted/10 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img 
                      src={member.discord_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${member.discord_username}`} 
                      alt={member.discord_username}
                      className="w-10 h-10 rounded-full border-2 border-border"
                    />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-card rounded-full border border-border flex items-center justify-center text-[10px] shadow-sm">
                      {RANK_EMOJIS[(member.rank_id || 1) - 1]}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold text-foreground">{member.discord_username}</p>
                      {member.id === guild?.created_by && (
                        <span className="text-[9px] font-black bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded uppercase tracking-tighter border border-amber-500/20">Lead</span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                      {(member.ranks as any)?.name || 'Earwig'} {member.prestige_level > 0 ? `• P${member.prestige_level}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isOwner && member.id !== user.id && (
                    <button
                      onClick={() => handleKickMember(member.id, member.discord_username)}
                      className="w-8 h-8 rounded-lg bg-red-500/5 text-red-500/40 hover:bg-red-500 hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                      title="Kick from guild"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <BottomSheetModal onClose={() => setShowEditModal(false)}>
          <BottomSheetModal.Header>
            <h2 className="text-lg font-bold text-foreground">Guild Management</h2>
            <p className="text-sm text-muted-foreground">Adjust branding and details</p>
          </BottomSheetModal.Header>
          <BottomSheetModal.Body>
            <form onSubmit={handleUpdateGuild} className="space-y-4">
               <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Guild Name</label>
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full px-3 py-2 text-sm border-2 border-border bg-input-background text-foreground rounded-xl focus:border-harvest transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Guild Tag</label>
                    <input
                      required
                      type="text"
                      value={formData.tag}
                      onChange={e => setFormData({...formData, tag: e.target.value.toUpperCase().slice(0, 5)})}
                      className="w-full px-3 py-2 text-sm border-2 border-border bg-input-background text-foreground rounded-xl focus:border-harvest transition-all font-black"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Color</label>
                      <input
                        type="color"
                        value={formData.color}
                        onChange={e => setFormData({...formData, color: e.target.value})}
                        className="w-full h-10 rounded-xl border-2 border-border cursor-pointer bg-transparent"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Logo URL</label>
                      <div className="relative">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                        <input
                          type="text"
                          value={formData.logo_url}
                          onChange={e => setFormData({...formData, logo_url: e.target.value})}
                          placeholder="https://..."
                          className="w-full pl-8 pr-3 py-2 text-xs border-2 border-border bg-input-background text-foreground rounded-xl focus:border-harvest transition-all"
                        />
                      </div>
                    </div>
                  </div>
               </div>
               <Button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-harvest hover:bg-amber text-white font-bold h-12 rounded-2xl shadow-lg border-b-4 border-amber-600 active:border-b-0 active:translate-y-1 transition-all mt-4"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Branding'}
                </Button>
            </form>
          </BottomSheetModal.Body>
        </BottomSheetModal>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <BottomSheetModal onClose={() => setShowInviteModal(false)} maxWidth="max-w-3xl">
          <BottomSheetModal.Header>
            <h2 className="text-lg font-bold text-foreground">Recruit Players</h2>
            <p className="text-sm text-muted-foreground">Find warriors to join your cause</p>
          </BottomSheetModal.Header>
          <BottomSheetModal.Body>
            <div className="space-y-4 pb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by Discord username..."
                  className="w-full pl-10 pr-4 py-3 bg-muted/20 border-2 border-border focus:border-harvest transition-all rounded-2xl text-sm font-medium"
                />
                {searching && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 animate-spin text-harvest" />
                  </div>
                )}
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {searchResults.length > 0 && searchQuery.length < 2 && (
                  <div className="flex items-center gap-2 px-1 mb-2">
                    <Sparkles className="w-3 h-3 text-harvest" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-harvest/70">Suggested Recruits</p>
                  </div>
                )}

                {searchResults.length > 0 ? (
                  searchResults.map(u => (
                    <div 
                      key={u.id} 
                      className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${
                        u.in_guild 
                          ? 'border-border bg-muted/30 grayscale opacity-80' 
                          : 'border-border bg-card hover:border-harvest/50 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <img 
                            src={u.discord_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.discord_username}`} 
                            className="w-12 h-12 rounded-full border-2 border-border object-cover" 
                          />
                          {!u.in_guild && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-harvest rounded-full flex items-center justify-center text-[10px] text-soil shadow-sm">
                              ✨
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-base font-bold text-foreground leading-tight">{u.discord_username}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                             <Shield className={`w-3 h-3 ${u.in_guild ? 'text-muted-foreground' : 'text-harvest'}`} />
                             <p className={`text-[10px] font-black uppercase tracking-widest ${u.in_guild ? 'text-muted-foreground' : 'text-harvest/80'}`}>
                                {u.guild_name}
                             </p>
                          </div>
                        </div>
                      </div>
                      <Button
                        disabled={u.invited || u.id === user.id || u.in_guild || invitingId === u.id}
                        onClick={() => handleInvite(u.id)}
                        className={`h-10 px-6 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                          u.invited 
                            ? 'bg-muted text-muted-foreground' 
                            : u.in_guild
                              ? 'bg-muted/50 text-muted-foreground/50 border-none'
                              : 'bg-harvest hover:bg-amber text-silk shadow-sm hover:shadow-md'
                        }`}
                      >
                        {invitingId === u.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : u.invited ? (
                          'Already Invited'
                        ) : u.in_guild ? (
                          'Already in Guild'
                        ) : (
                          'Send Invite'
                        )}
                      </Button>
                    </div>
                  ))
                ) : (
                  searchQuery.length >= 2 && !searching ? (
                    <div className="text-center py-12 bg-muted/10 rounded-3xl border-2 border-dashed border-border">
                      <Search className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm font-bold text-muted-foreground">No matches found for "{searchQuery}"</p>
                      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-widest mt-1">Try a different Discord name</p>
                    </div>
                  ) : !searching && (
                    <div className="text-center py-12 bg-muted/5 rounded-3xl border-2 border-dashed border-border flex flex-col items-center">
                       <div className="w-12 h-12 rounded-full bg-harvest/10 flex items-center justify-center mb-3">
                         <Search className="w-6 h-6 text-harvest/40" />
                       </div>
                       <p className="text-sm font-bold text-foreground">Start Your Search</p>
                       <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Type at least 2 characters to find warriors</p>
                    </div>
                  )
                )}
              </div>
            </div>
          </BottomSheetModal.Body>
        </BottomSheetModal>
      )}
    </div>
  );
}
