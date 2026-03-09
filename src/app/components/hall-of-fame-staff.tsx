import { useMemo, useRef, useEffect, useState } from 'react';
import { ArrowUp, ArrowDown, Search } from 'lucide-react';
import { getRoleBadgeTag, getRoleBadgeStyle } from '@/lib/roles';
import type { HallOfFameStaff, TournamentType } from './hall-of-fame-types';

const BATCH_SIZE = 25;

type StaffSortKey = 'name' | 'totalTournaments' | 'primaryRole';
type SortOrder = 'asc' | 'desc';

interface Props {
  staff: HallOfFameStaff[];
  selectedTab: TournamentType;
  searchTerm: string;
  staffLoading: boolean;
}

export function HallOfFameStaffTab({ staff, selectedTab, searchTerm, staffLoading }: Props) {
  const [sortField, setSortField] = useState<StaffSortKey>('totalTournaments');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setVisibleCount(BATCH_SIZE); }, [searchTerm, selectedTab, sortField, sortOrder]);

  const handleSort = (field: StaffSortKey) => {
    setSortOrder(prev => sortField === field ? (prev === 'asc' ? 'desc' : 'asc') : 'desc');
    setSortField(field);
  };

  const sortedStaff = useMemo(() => {
    const getStats = (s: HallOfFameStaff) =>
      selectedTab === 'all' ? s.stats :
      selectedTab === 'kernel_kup' ? s.kernelKupStats : s.heapsNHooksStats;

    const filtered = staff.filter(s => {
      const stats = getStats(s);
      if (!stats) return false;
      return s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.allRoles.some(r => r.toLowerCase().includes(searchTerm.toLowerCase()));
    });

    return [...filtered].sort((a, b) => {
      const aStats = getStats(a);
      const bStats = getStats(b);
      if (!aStats || !bStats) return 0;

      switch (sortField) {
        case 'name':
          return sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
        case 'totalTournaments': {
          const diff = aStats.totalTournaments - bStats.totalTournaments;
          return sortOrder === 'asc' ? diff : -diff;
        }
        case 'primaryRole': {
          const cmp = aStats.primaryRole.localeCompare(bStats.primaryRole);
          return sortOrder === 'asc' ? cmp : -cmp;
        }
        default: return 0;
      }
    });
  }, [staff, searchTerm, sortField, sortOrder, selectedTab]);

  const visibleStaff = sortedStaff.slice(0, visibleCount);
  const hasMore = visibleCount < sortedStaff.length;

  useEffect(() => {
    if (!hasMore || !sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) setVisibleCount(prev => prev + BATCH_SIZE); },
      { rootMargin: '200px' }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasMore, visibleCount]);

  if (staffLoading) {
    return (
      <div className="bg-card rounded-2xl border-2 border-border overflow-hidden">
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-muted animate-pulse flex-shrink-0" />
              <div className="w-10 h-10 rounded-full bg-muted animate-pulse flex-shrink-0" />
              <div className="flex-1 h-4 bg-muted rounded animate-pulse" />
              <div className="w-20 h-4 bg-muted rounded animate-pulse" />
              <div className="w-14 h-4 bg-muted rounded animate-pulse hidden sm:block" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sortedStaff.length === 0) {
    return (
      <div className="bg-card rounded-2xl border-2 border-border p-12 text-center">
        <Search className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
        <p className="text-xl font-bold text-muted-foreground">No staff found{selectedTab !== 'all' ? ` for ${selectedTab === 'kernel_kup' ? 'Kernel Kup' : "Heaps n' Hooks"}` : ''}</p>
      </div>
    );
  }

  const SortHeader = ({ field, label, align = 'center' }: { field: StaffSortKey; label: string; align?: 'left' | 'center' }) => (
    <th
      className={`py-4 px-6 text-xs font-bold text-muted-foreground cursor-pointer hover:text-harvest transition-colors uppercase tracking-wide ${align === 'left' ? 'text-left' : 'text-center'}`}
      onClick={() => handleSort(field)}
    >
      <div className="whitespace-nowrap">
        {label}
        {sortField === field && (sortOrder === 'asc' ? <ArrowUp className="w-4 h-4 inline ml-1" /> : <ArrowDown className="w-4 h-4 inline ml-1" />)}
      </div>
    </th>
  );

  // Color mapping for common staff roles
  const roleColors: Record<string, string> = {
    'Caster': 'bg-[#3b82f6]/10 text-[#3b82f6]',
    'Producer': 'bg-[#8b5cf6]/10 text-[#8b5cf6]',
    'Observer': 'bg-[#10b981]/10 text-[#10b981]',
    'Drafter': 'bg-[#f59e0b]/10 text-[#f59e0b]',
    'Admin': 'bg-[#ef4444]/10 text-[#ef4444]',
    'Host': 'bg-[#ec4899]/10 text-[#ec4899]',
  };

  return (
    <>
      <div className="bg-card rounded-2xl border-2 border-border">
        <div className="overflow-auto max-h-[calc(100vh-13rem)]">
          <table className="w-full">
            <thead className="bg-muted border-b-2 border-border sticky top-0 z-30">
              <tr>
                <th className="py-4 px-6 text-xs font-bold text-muted-foreground uppercase tracking-wide text-center w-12">#</th>
                <SortHeader field="name" label="Staff Member" align="left" />
                <SortHeader field="primaryRole" label="Primary Role" />
                <th className="py-4 px-6 text-xs font-bold text-muted-foreground uppercase tracking-wide text-center">All Roles</th>
                <SortHeader field="totalTournaments" label="Tourneys" />
              </tr>
            </thead>
            <tbody>
              {visibleStaff.map((member, index) => {
                const stats = selectedTab === 'all' ? member.stats :
                  selectedTab === 'kernel_kup' ? member.kernelKupStats : member.heapsNHooksStats;
                if (!stats) return null;

                return (
                  <tr key={member.id} className={`border-b border-border ${index % 2 === 0 ? 'bg-card' : 'bg-muted/50'} hover:bg-harvest/5 transition-colors`}>
                    <td className="py-5 px-6 text-center font-bold text-muted-foreground text-sm">{index + 1}</td>
                    <td className="py-5 px-6">
                      <div className="flex items-center gap-3 min-w-[200px]">
                        {member.avatar_url ? (
                          <img src={member.avatar_url} alt={member.name} className="w-10 h-10 rounded-full border-2 border-border" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-harvest to-amber flex items-center justify-center text-sm font-bold text-white">
                            {member.name[0]?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-foreground text-sm">{member.name}</p>
                          {member.user && (() => {
                            const tag = getRoleBadgeTag(member.user.role);
                            const style = getRoleBadgeStyle(member.user.role);
                            return (
                              <span
                                className={`text-[10px] font-black px-1.5 py-0.5 rounded ${style.badge}`}
                                style={style.hex && !style.badge ? { color: style.hex, backgroundColor: `${style.hex}15` } : undefined}
                              >
                                {tag}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </td>
                    <td className="py-5 px-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${roleColors[stats.primaryRole] || 'bg-muted text-muted-foreground'}`}>
                        {stats.primaryRole}
                      </span>
                    </td>
                    <td className="py-5 px-6 text-center">
                      <div className="flex flex-wrap gap-1 justify-center">
                        {stats.allRoles.map(({ role, count }) => (
                          <span key={role} className={`px-2 py-0.5 rounded text-[10px] font-semibold ${roleColors[role] || 'bg-muted text-muted-foreground'}`}>
                            {role} x{count}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-5 px-6 text-center">
                      <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-harvest/10 text-harvest font-black">
                        {stats.totalTournaments}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-4">
          <p className="text-sm text-muted-foreground">Showing {visibleCount} of {sortedStaff.length} staff...</p>
        </div>
      )}
    </>
  );
}