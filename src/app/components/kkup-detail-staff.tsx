/**
 * KKup Detail — Staff Tab
 */

import { Crown, Shield, Users, Target, Mic, Clipboard } from 'lucide-react';

export interface KKupDetailStaffProps {
  staffMembers: any[];
}

export function KKupDetailStaff({ staffMembers }: KKupDetailStaffProps) {
  if (staffMembers.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-card rounded-2xl border-2 border-border p-12 text-center">
          <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
          <p className="text-muted-foreground">No staff data available yet</p>
        </div>
      </div>
    );
  }

  // Group staff by role
  const grouped: Record<string, any[]> = {};
  staffMembers.forEach((s: any) => {
    const role = s.role || 'Other';
    if (!grouped[role]) grouped[role] = [];
    grouped[role].push(s);
  });

  const roleConfig: Record<string, { icon: any; color: string; bg: string }> = {
    'Organizer': { icon: Crown, color: 'text-harvest', bg: 'bg-harvest/10' },
    'Admin': { icon: Shield, color: 'text-red-600', bg: 'bg-red-100' },
    'Caster': { icon: Mic, color: 'text-purple-600', bg: 'bg-purple-100' },
    'Observer': { icon: Target, color: 'text-green-600', bg: 'bg-green-100' },
    'Moderator': { icon: Shield, color: 'text-blue-600', bg: 'bg-blue-100' },
    'Coach': { icon: Clipboard, color: 'text-blue-600', bg: 'bg-blue-100' },
  };

  const orderedRoles = ['Organizer', 'Admin', 'Caster', 'Observer', 'Moderator', 'Coach',
    ...Object.keys(grouped).filter(r => !['Organizer', 'Admin', 'Caster', 'Observer', 'Moderator', 'Coach'].includes(r))
  ].filter(r => grouped[r]);

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-2xl border-2 border-border p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
            <Users className="w-5 h-5 text-purple-600" />
          </div>
          <h3 className="text-xl font-black text-foreground">Tournament Staff</h3>
          <span className="text-sm text-muted-foreground font-medium">({staffMembers.length} members)</span>
        </div>
        <div className="space-y-6">
          {orderedRoles.map(role => {
            const config = roleConfig[role] || { icon: Users, color: 'text-muted-foreground', bg: 'bg-muted' };
            const RoleIcon = config.icon;
            return (
              <div key={role}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-7 h-7 rounded-full ${config.bg} flex items-center justify-center`}>
                    <RoleIcon className={`w-3.5 h-3.5 ${config.color}`} />
                  </div>
                  <h4 className="font-bold text-foreground">{role}s</h4>
                  <span className="text-xs text-muted-foreground font-medium">({grouped[role].length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {grouped[role].map((member: any) => (
                    <div key={member.person_id + role} className="flex items-center gap-3 rounded-xl p-3 border border-border hover:border-harvest/30 transition-colors">
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt={member.display_name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-harvest to-orange-400 flex items-center justify-center text-white font-bold flex-shrink-0">
                          {member.display_name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground text-sm truncate">{member.display_name}</p>
                        {member.steam_id && /^\d+$/.test(member.steam_id) && (
                          <a href={`https://www.opendota.com/players/${member.steam_id}`} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-harvest transition-colors">
                            OpenDota
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
