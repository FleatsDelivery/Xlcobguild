import { useState, useEffect } from 'react';
import { Shield, Plus, Pencil, Trash2, Users, Tag, Palette, Link as LinkIcon, Loader2, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/app/components/ui/button';
import { BottomSheetModal } from '@/app/components/bottom-sheet-modal';
import { toast } from 'sonner';

interface Guild {
  id: string;
  name: string;
  tag: string;
  color: string;
  logo_url: string | null;
  member_limit: number;
}

export function AdminGuildWarsManager() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingGuild, setEditingGuild] = useState<Guild | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchGuilds();
  }, []);

  const fetchGuilds = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('guild_wars_guilds')
      .select('*')
      .order('name');
    
    if (error) {
      toast.error('Failed to fetch guilds');
    } else {
      setGuilds(data || []);
    }
    setLoading(false);
  };

  const handleUpdateGuild = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGuild) return;

    setSaving(true);
    const { error } = await supabase
      .from('guild_wars_guilds')
      .update({
        name: editingGuild.name,
        tag: editingGuild.tag,
        color: editingGuild.color,
        logo_url: editingGuild.logo_url,
        member_limit: editingGuild.member_limit
      })
      .eq('id', editingGuild.id);

    if (error) {
      toast.error('Failed to update guild');
    } else {
      toast.success('Guild updated successfully');
      setEditingGuild(null);
      fetchGuilds();
    }
    setSaving(false);
  };

  const filteredGuilds = guilds.filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    g.tag.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-harvest" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search guilds..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 text-sm border-2 border-border rounded-xl focus:outline-none focus:border-harvest transition-all bg-input-background text-foreground"
        />
      </div>

      {/* Guild List */}
      <div className="grid gap-2">
        {filteredGuilds.map(guild => (
          <div 
            key={guild.id}
            className="flex items-center justify-between p-3 bg-card rounded-xl border-2 border-border hover:border-harvest/30 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center shadow-md overflow-hidden shrink-0"
                style={{ backgroundColor: guild.color }}
              >
                {guild.logo_url ? (
                  <img src={guild.logo_url} alt={guild.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white font-black text-sm">{guild.tag}</span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-foreground text-sm truncate">{guild.name}</h4>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-muted text-muted-foreground tracking-tighter">
                    {guild.tag}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Users className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs font-bold text-harvest">
                    Cap: {guild.member_limit} members
                  </span>
                </div>
              </div>
            </div>

            <Button
              onClick={() => setEditingGuild(guild)}
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 border-harvest/30 text-harvest hover:bg-harvest/10"
            >
              <Pencil className="w-4 h-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editingGuild && (
        <BottomSheetModal onClose={() => setEditingGuild(null)}>
          <BottomSheetModal.Header>
            <h2 className="text-lg font-bold text-foreground">Edit Guild</h2>
            <p className="text-sm text-muted-foreground">Adjust branding and growth limits</p>
          </BottomSheetModal.Header>
          <BottomSheetModal.Body>
            <form onSubmit={handleUpdateGuild} className="space-y-4">
              <div className="space-y-3">
                {/* Visual Preview */}
                <div className="bg-muted/30 rounded-2xl p-6 border-2 border-border flex flex-col items-center">
                   <div 
                     className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-xl mb-4 overflow-hidden border-4 border-white/10"
                     style={{ backgroundColor: editingGuild.color }}
                   >
                     {editingGuild.logo_url ? (
                       <img src={editingGuild.logo_url} alt="Logo" className="w-full h-full object-cover" />
                     ) : (
                       <span className="text-white font-black text-2xl tracking-tighter">{editingGuild.tag}</span>
                     )}
                   </div>
                   <h3 className="text-xl font-black text-foreground">{editingGuild.name || 'New Guild'}</h3>
                   <span className="text-xs font-bold text-muted-foreground uppercase opacity-50">#{editingGuild.id.slice(0,8)}</span>
                </div>

                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Name</label>
                    <input
                      type="text"
                      value={editingGuild.name}
                      onChange={e => setEditingGuild({...editingGuild, name: e.target.value})}
                      className="w-full px-3 py-2 text-sm border-2 border-border bg-input-background text-foreground rounded-xl focus:border-harvest transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Tag (Short)</label>
                    <input
                      type="text"
                      value={editingGuild.tag}
                      onChange={e => setEditingGuild({...editingGuild, tag: e.target.value.toUpperCase().slice(0, 5)})}
                      className="w-full px-3 py-2 text-sm border-2 border-border bg-input-background text-foreground rounded-xl focus:border-harvest transition-all font-black uppercase"
                    />
                  </div>
                </div>

                {/* Member Limit */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Member Limit</label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                      type="number"
                      value={editingGuild.member_limit}
                      onChange={e => setEditingGuild({...editingGuild, member_limit: parseInt(e.target.value)})}
                      className="w-full pl-10 pr-4 py-2 text-sm border-2 border-border bg-input-background text-foreground rounded-xl focus:border-harvest transition-all"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground font-medium pl-1 italic">Default is 50. Increase for prizes or TCF+ bonuses.</p>
                </div>

                {/* Brading */}
                <div className="grid grid-cols-2 gap-3">
                   <div className="space-y-1">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Brand Color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={editingGuild.color}
                        onChange={e => setEditingGuild({...editingGuild, color: e.target.value})}
                        className="w-10 h-10 rounded-xl border-2 border-border cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={editingGuild.color}
                        onChange={e => setEditingGuild({...editingGuild, color: e.target.value})}
                        className="flex-1 px-3 py-2 text-xs font-mono border-2 border-border bg-input-background text-foreground rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-1">Logo URL</label>
                    <div className="relative">
                      <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                      <input
                        type="text"
                        value={editingGuild.logo_url || ''}
                        onChange={e => setEditingGuild({...editingGuild, logo_url: e.target.value || null})}
                        placeholder="https://..."
                        className="w-full pl-8 pr-3 py-2 text-xs border-2 border-border bg-input-background text-foreground rounded-xl focus:border-harvest transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-harvest hover:bg-amber text-white font-bold h-12 rounded-2xl shadow-lg border-b-4 border-amber-600 active:border-b-0 active:translate-y-1 transition-all"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingGuild(null)}
                  className="px-6 h-12 rounded-2xl border-2 border-border font-bold text-muted-foreground"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </BottomSheetModal.Body>
        </BottomSheetModal>
      )}
    </div>
  );
}
