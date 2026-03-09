/**
 * Tournament Hub — Staff Tab
 *
 * Shows approved staff, pending applications (for officers/owners),
 * and an "Apply as Staff" CTA for registered users.
 * Receives all data and handlers as props from the orchestrator.
 */

import {
  Shield, Briefcase, Mic, CheckCircle, XCircle, Clock,
  Users, Plus, Loader2, MessageSquare, Crown, Film, HandHelping, UserMinus,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { timeAgo } from '@/lib/date-utils';
import { TcfPlusAvatarRing } from '@/app/components/tcf-plus-avatar-ring';
import { TcfPlusBadge } from '@/app/components/tcf-plus-badge';
import { useState } from 'react';

// ── Types ────────────────────────────────────────────────────────────

export interface TournamentHubStaffProps {
  tournament: any;
  staffApps: any[];
  myStaffApp: any;
  staffSummary: any;
  user: any;
  isOwner: boolean;
  isMutable: boolean;
  myRegistration: any;
  handleStaffReview: (userId: string, status: 'approved' | 'denied', username: string) => void;
  handleRemoveStaff: (userId: string, username: string) => void;
  setShowStaffModal?: (show: boolean) => void;
}

// ── Status config ────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ElementType; label: string }> = {
  approved: { bg: 'bg-[#10b981]/10', text: 'text-[#10b981]', icon: CheckCircle, label: 'Approved' },
  pending:  { bg: 'bg-[#f59e0b]/10', text: 'text-[#f59e0b]', icon: Clock,       label: 'Pending' },
  denied:   { bg: 'bg-[#ef4444]/10', text: 'text-[#ef4444]', icon: XCircle,     label: 'Denied' },
};

const ROLE_ICONS: Record<string, React.ElementType> = {
  staff: Briefcase,
  caster: Mic,
  producer: Film,
  helper: HandHelping,
  tournament_director: Crown,
  other: Users,
  flexible: Users,
  either: Users,
};

/** Human-readable role label */
function getRoleLabel(pref: string): string {
  const labels: Record<string, string> = {
    caster: 'Caster',
    producer: 'Producer',
    helper: 'Helper',
    tournament_director: 'Tournament Director',
    flexible: 'Flexible',
    other: 'Other',
    staff: 'Staff',
    either: 'Staff / Caster',
  };
  return labels[pref] || pref || 'Staff';
}

// ═══════════════════════════════════════════════════════════════════════

export function TournamentHubStaff({
  tournament,
  staffApps,
  myStaffApp,
  staffSummary,
  user,
  isOwner,
  isMutable,
  myRegistration,
  handleStaffReview,
  handleRemoveStaff,
}: TournamentHubStaffProps) {

  const approvedStaff = staffApps.filter(a => a.status === 'approved');
  const pendingStaff = staffApps.filter(a => a.status === 'pending');
  const deniedStaff = staffApps.filter(a => a.status === 'denied');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#6366f1]" />
            Tournament Staff
          </h3>
          {staffSummary && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {staffSummary.approved || 0} approved
              {staffSummary.pending > 0 && (
                <span className="text-[#f59e0b] ml-1">· {staffSummary.pending} pending</span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* My application status */}
      {myStaffApp && (
        <div className={`rounded-xl border-2 p-4 ${
          myStaffApp.status === 'approved' ? 'bg-[#10b981]/5 border-[#10b981]/20'
          : myStaffApp.status === 'pending' ? 'bg-[#f59e0b]/5 border-[#f59e0b]/20'
          : 'bg-[#ef4444]/5 border-[#ef4444]/20'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              myStaffApp.status === 'approved' ? 'bg-[#10b981]/10' : myStaffApp.status === 'pending' ? 'bg-[#f59e0b]/10' : 'bg-[#ef4444]/10'
            }`}>
              {myStaffApp.status === 'approved' ? <CheckCircle className="w-5 h-5 text-[#10b981]" />
                : myStaffApp.status === 'pending' ? <Clock className="w-5 h-5 text-[#f59e0b]" />
                : <XCircle className="w-5 h-5 text-[#ef4444]" />}
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">
                Your Staff Application: {myStaffApp.status === 'pending' ? 'Under Review' : myStaffApp.status === 'approved' ? 'Approved!' : 'Not Selected'}
              </p>
              <p className="text-xs text-muted-foreground">
                Applied as {getRoleLabel(myStaffApp.role_preference)}
                {myStaffApp.applied_at && ` · ${timeAgo(myStaffApp.applied_at)}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pending Applications (officer/owner view) */}
      {isOwner && pendingStaff.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-[#f59e0b] uppercase tracking-wide flex items-center gap-2">
            <Clock className="w-4 h-4" /> Pending Applications ({pendingStaff.length})
          </h4>
          <div className="space-y-2">
            {pendingStaff.map((app: any, index: number) => (
              <div
                key={app.user_id || app.id}
                className="animate-staff-card-slide-in"
                style={{
                  animationDelay: `${index * 0.05}s`,
                }}
              >
                <StaffAppCard
                  app={app}
                  isOwner={isOwner}
                  onReview={handleStaffReview}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approved Staff */}
      {approvedStaff.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-sm font-bold text-[#10b981] uppercase tracking-wide flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> Approved Staff ({approvedStaff.length})
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {approvedStaff.map((app: any, index: number) => (
              <div
                key={app.user_id || app.id}
                className="animate-staff-card-scale-in"
                style={{
                  animationDelay: `${index * 0.05}s`,
                }}
              >
                <StaffMemberCard
                  app={app}
                  isOwner={isOwner}
                  onRemove={handleRemoveStaff}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        !isOwner && pendingStaff.length === 0 && (
          <div className="bg-card rounded-2xl border-2 border-dashed border-border p-12 text-center">
            <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-semibold">No staff yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Staff applications will appear here once reviewed.
            </p>
          </div>
        )
      )}

      {/* Denied (owner only, collapsed) */}
      {isOwner && deniedStaff.length > 0 && (
        <div className="space-y-3 opacity-60">
          <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <XCircle className="w-4 h-4" /> Denied ({deniedStaff.length})
          </h4>
          <div className="space-y-2">
            {deniedStaff.map((app: any, index: number) => (
              <div
                key={app.user_id || app.id}
                className="animate-staff-card-slide-in"
                style={{
                  animationDelay: `${index * 0.05}s`,
                }}
              >
                <StaffAppCard
                  app={app}
                  isOwner={isOwner}
                  onReview={handleStaffReview}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// ── Staff Member Card (approved, public) ─────────────────────────────

function StaffMemberCard({ app, isOwner, onRemove }: { app: any; isOwner: boolean; onRemove: (userId: string, username: string) => void }) {
  const RoleIcon = ROLE_ICONS[app.role_preference] || Briefcase;

  return (
    <div className="bg-card rounded-xl border-2 border-border p-4 flex items-center gap-3">
      <TcfPlusAvatarRing active={app.tcf_plus_active} size="xs">
      {app.discord_avatar ? (
        <img
          src={app.discord_avatar}
          alt={app.discord_username}
          className="w-10 h-10 rounded-full border-2 border-[#6366f1]/20"
          width={40} height={40}
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-[#6366f1]/10 flex items-center justify-center">
          <span className="text-sm font-bold text-[#6366f1]">
            {(app.discord_username || '?').charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      </TcfPlusAvatarRing>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="font-bold text-foreground text-sm truncate">{app.discord_username || 'Unknown'}</p>
          {app.tcf_plus_active && <TcfPlusBadge size="xs" />}
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <RoleIcon className="w-3 h-3" />
          {getRoleLabel(app.role_preference)}
        </p>
      </div>
      <CheckCircle className="w-4 h-4 text-[#10b981] flex-shrink-0" />
      {isOwner && (
        <Button
          onClick={() => onRemove(app.user_id, app.discord_username)}
          className="bg-muted hover:bg-[#ef4444]/10 text-muted-foreground hover:text-[#ef4444] h-8 px-3 rounded-lg text-xs font-bold"
        >
          <UserMinus className="w-3.5 h-3.5 mr-1" /> Remove
        </Button>
      )}
    </div>
  );
}

// ── Staff Application Card (pending/denied, owner view) ──────────────

function StaffAppCard({ app, isOwner, onReview }: {
  app: any;
  isOwner: boolean;
  onReview: (userId: string, status: 'approved' | 'denied', username: string) => void;
}) {
  const RoleIcon = ROLE_ICONS[app.role_preference] || Briefcase;
  const statusStyle = STATUS_STYLES[app.status] || STATUS_STYLES.pending;
  const StatusIcon = statusStyle.icon;

  return (
    <div className={`rounded-xl border-2 p-4 ${statusStyle.bg} border-current/10`}
      style={{ borderColor: app.status === 'approved' ? '#10b98130' : app.status === 'denied' ? '#ef444430' : '#f59e0b30' }}
    >
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <TcfPlusAvatarRing active={app.tcf_plus_active} size="xs">
          {app.discord_avatar ? (
            <img src={app.discord_avatar} alt={app.discord_username} className="w-10 h-10 rounded-full border border-border" width={40} height={40} />
          ) : (
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <span className="text-sm font-bold text-muted-foreground">
                {(app.discord_username || '?').charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          </TcfPlusAvatarRing>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-bold text-foreground text-sm">{app.discord_username || 'Unknown'}</p>
              {app.tcf_plus_active && <TcfPlusBadge size="xs" />}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RoleIcon className="w-3 h-3" />
              <span className="font-semibold">{getRoleLabel(app.role_preference)}</span>
              {app.applied_at && (
                <>
                  <span>·</span>
                  <span>{timeAgo(app.applied_at)}</span>
                </>
              )}
            </div>
            {app.message && (
              <p className="text-xs text-muted-foreground mt-1 italic">"{app.message}"</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {app.status === 'pending' && isOwner && (
            <>
              <Button
                onClick={() => onReview(app.user_id, 'approved', app.discord_username)}
                className="bg-[#10b981] hover:bg-[#059669] text-white h-8 px-3 rounded-lg text-xs font-bold"
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1" /> Approve
              </Button>
              <Button
                onClick={() => onReview(app.user_id, 'denied', app.discord_username)}
                className="bg-muted hover:bg-[#ef4444]/10 text-muted-foreground hover:text-[#ef4444] h-8 px-3 rounded-lg text-xs font-bold"
              >
                <XCircle className="w-3.5 h-3.5 mr-1" /> Deny
              </Button>
            </>
          )}
          {app.status !== 'pending' && (
            <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${statusStyle.bg} ${statusStyle.text}`}>
              <StatusIcon className="w-3 h-3" />
              {statusStyle.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}