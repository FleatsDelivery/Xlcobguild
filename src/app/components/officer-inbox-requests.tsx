/**
 * Officer Inbox — Requests Tab
 *
 * Shows pending items that require officer action:
 *   - Team approvals (pending_approval)
 *   - Staff applications (pending)
 *   - MVP rank-up requests (pending) — with inline approve/deny/dismiss
 *
 * Receives all data via props from the orchestrator (officer-inbox-page.tsx).
 */
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Inbox, Loader2, CheckCircle, XCircle,
  Users, Shield, Star, Clock, Trash2,
  ChevronDown, ChevronUp, TrendingUp, TrendingDown, Sparkles,
  Image as ImageIcon, ArrowRight,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { timeAgo } from '@/lib/date-utils';
import { TeamLogo } from '@/app/components/team-logo';

// ── Types ────────────────────────────────────────────────────────────

export interface OfficerRequest {
  id: string;
  raw_id: string;
  request_type: 'kkup_team_approval' | 'kkup_staff_application' | 'mvp_request';
  tournament_id?: string;
  tournament_name?: string;
  status: string;
  created_at: string;
  data: any;
}

// ── Type display config ──────────────────────────────────────────────

const REQUEST_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  kkup_team_approval:     { label: 'Team Approval',   icon: Users,  color: '#8b5cf6' },
  kkup_staff_application: { label: 'Staff App',       icon: Shield, color: '#6366f1' },
  mvp_request:            { label: 'MVP Request',     icon: Star,   color: '#f59e0b' },
};

// ── Action label for MVP requests ────────────────────────────────────

const MVP_ACTION_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  rank_up:   { label: 'Rank Up',   icon: TrendingUp,   color: '#10b981' },
  rank_down: { label: 'Rank Down', icon: TrendingDown,  color: '#ef4444' },
  prestige:  { label: 'Prestige',  icon: Sparkles,      color: '#8b5cf6' },
};

// ── Props ────────────────────────────────────────────────────────────

interface OfficerRequestsTabProps {
  requests: OfficerRequest[];
  mvpRequests: any[];
  typeFilter: string | null;
  onTypeFilter: (type: string | null) => void;
  onApproveTeam: (tournamentId: string, teamId: string) => void;
  onDenyTeam: (tournamentId: string, teamId: string) => void;
  onDismissTeam: (tournamentId: string, teamId: string) => void;
  onReviewStaff: (tournamentId: string, userId: string, status: 'approved' | 'denied') => void;
  onDismissStaff: (tournamentId: string, userId: string) => void;
  onApproveMVP: (requestId: string) => void;
  onDenyMVP: (requestId: string) => void;
  onDismissMVP: (requestId: string) => void;
  actioningId: string | null;
  resolvedCards: Record<string, 'approved' | 'denied' | 'dismissed' | 'error'>;
  loading: boolean;
}

export function OfficerRequestsTab({
  requests,
  mvpRequests,
  typeFilter,
  onTypeFilter,
  onApproveTeam,
  onDenyTeam,
  onDismissTeam,
  onReviewStaff,
  onDismissStaff,
  onApproveMVP,
  onDenyMVP,
  onDismissMVP,
  actioningId,
  resolvedCards,
  loading,
}: OfficerRequestsTabProps) {

  // Merge KKup requests + MVP requests into a unified list
  const allRequests = useMemo(() => {
    const merged: OfficerRequest[] = [...requests];

    for (const mvp of mvpRequests) {
      if (mvp.status === 'pending') {
        merged.push({
          id: `mvp_${mvp.id}`,
          raw_id: mvp.id,
          request_type: 'mvp_request',
          status: 'pending',
          created_at: mvp.created_at,
          data: mvp,
        });
      }
    }

    merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return merged;
  }, [requests, mvpRequests]);

  // Type counts for filter pills
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of allRequests) {
      counts[r.request_type] = (counts[r.request_type] || 0) + 1;
    }
    return counts;
  }, [allRequests]);

  // Filtered
  const filtered = useMemo(() => {
    if (!typeFilter) return allRequests.filter(r => r.status === 'pending');
    return allRequests.filter(r => r.request_type === typeFilter && r.status === 'pending');
  }, [allRequests, typeFilter]);

  // ── Render ──

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mb-3 text-harvest" />
        <p className="font-semibold">Loading requests...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Type filter pills */}
      {Object.keys(typeCounts).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => onTypeFilter(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
              !typeFilter
                ? 'bg-harvest/15 border-harvest/30 text-harvest'
                : 'bg-muted border-border text-muted-foreground hover:text-foreground hover:border-harvest/20'
            }`}
          >
            All ({allRequests.filter(r => r.status === 'pending').length})
          </button>
          {Object.entries(typeCounts).map(([type, count]) => {
            const config = REQUEST_TYPE_CONFIG[type];
            if (!config) return null;
            return (
              <button
                key={type}
                onClick={() => onTypeFilter(typeFilter === type ? null : type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 ${
                  typeFilter === type
                    ? 'bg-harvest/15 border-harvest/30 text-harvest'
                    : 'bg-muted border-border text-muted-foreground hover:text-foreground hover:border-harvest/20'
                }`}
              >
                <config.icon className="w-3 h-3" />
                {config.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Request cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <CheckCircle className="w-12 h-12 mb-3 opacity-40" />
          <p className="font-bold text-lg">All caught up</p>
          <p className="text-sm mt-1">No pending requests need your attention.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered.map(req => (
              <motion.div
                key={req.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -60, transition: { duration: 0.25 } }}
                transition={{ duration: 0.2 }}
              >
                <RequestCard
                  request={req}
                  onApproveTeam={onApproveTeam}
                  onDenyTeam={onDenyTeam}
                  onDismissTeam={onDismissTeam}
                  onReviewStaff={onReviewStaff}
                  onDismissStaff={onDismissStaff}
                  onApproveMVP={onApproveMVP}
                  onDenyMVP={onDenyMVP}
                  onDismissMVP={onDismissMVP}
                  actioningId={actioningId}
                  resolvedCards={resolvedCards}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}


// ── Individual Request Card ──────────────────────────────────────────

function RequestCard({
  request,
  onApproveTeam,
  onDenyTeam,
  onDismissTeam,
  onReviewStaff,
  onDismissStaff,
  onApproveMVP,
  onDenyMVP,
  onDismissMVP,
  actioningId,
  resolvedCards,
}: {
  request: OfficerRequest;
  onApproveTeam: (tournamentId: string, teamId: string) => void;
  onDenyTeam: (tournamentId: string, teamId: string) => void;
  onDismissTeam: (tournamentId: string, teamId: string) => void;
  onReviewStaff: (tournamentId: string, userId: string, status: 'approved' | 'denied') => void;
  onDismissStaff: (tournamentId: string, userId: string) => void;
  onApproveMVP: (requestId: string) => void;
  onDenyMVP: (requestId: string) => void;
  onDismissMVP: (requestId: string) => void;
  actioningId: string | null;
  resolvedCards: Record<string, 'approved' | 'denied' | 'dismissed' | 'error'>;
}) {
  const config = REQUEST_TYPE_CONFIG[request.request_type] || { label: 'Request', icon: Inbox, color: '#6b7280' };
  const Icon = config.icon;

  // Compute the action key that matches how the orchestrator sets actioningId/resolvedCards
  const actionKey = request.request_type === 'kkup_staff_application'
    ? `staff_${request.data?.user_id}_${request.tournament_id}`
    : request.id; // team_${teamId} and mvp_${mvpId} already match request.id

  const isActioning = actioningId === actionKey;
  const resolvedStatus = resolvedCards[actionKey];

  // Resolved state styling
  const resolvedBorder = resolvedStatus === 'approved' ? 'border-[#10b981]'
    : resolvedStatus === 'denied' ? 'border-[#ef4444]'
    : resolvedStatus === 'dismissed' ? 'border-muted-foreground'
    : resolvedStatus === 'error' ? 'border-[#ef4444]'
    : '';
  const resolvedBg = resolvedStatus === 'approved' ? 'bg-[#10b981]/5'
    : resolvedStatus === 'denied' ? 'bg-[#ef4444]/5'
    : resolvedStatus === 'dismissed' ? 'bg-muted/50'
    : resolvedStatus === 'error' ? 'bg-[#ef4444]/5'
    : '';

  return (
    <div className={`bg-card rounded-xl border-2 p-4 transition-all duration-300 ${
      resolvedStatus
        ? `${resolvedBorder} ${resolvedBg}`
        : 'border-border hover:border-harvest/30'
    }`}>
      {/* Resolved banner */}
      {resolvedStatus && (
        <div className={`flex items-center gap-2 mb-3 px-3 py-1.5 rounded-lg text-xs font-bold ${
          resolvedStatus === 'approved' ? 'bg-[#10b981]/10 text-[#10b981]'
            : resolvedStatus === 'denied' ? 'bg-[#ef4444]/10 text-[#ef4444]'
            : resolvedStatus === 'dismissed' ? 'bg-muted text-muted-foreground'
            : 'bg-[#ef4444]/10 text-[#ef4444]'
        }`}>
          {resolvedStatus === 'approved' && <><CheckCircle className="w-3.5 h-3.5" /> Approved</>}
          {resolvedStatus === 'denied' && <><XCircle className="w-3.5 h-3.5" /> Denied</>}
          {resolvedStatus === 'dismissed' && <><Trash2 className="w-3.5 h-3.5" /> Dismissed</>}
          {resolvedStatus === 'error' && <><XCircle className="w-3.5 h-3.5" /> Action Failed</>}
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${config.color}15` }}
        >
          <Icon className="w-4.5 h-4.5" style={{ color: config.color }} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${config.color}15`, color: config.color }}
            >
              {config.label}
            </span>
            {request.tournament_name && (
              <span className="text-xs text-muted-foreground truncate">
                {request.tournament_name}
              </span>
            )}
          </div>

          {/* Request-specific content */}
          {request.request_type === 'kkup_team_approval' && (
            <TeamApprovalContent request={request} />
          )}
          {request.request_type === 'kkup_staff_application' && (
            <StaffAppContent request={request} />
          )}
          {request.request_type === 'mvp_request' && (
            <MVPRequestContent request={request} />
          )}

          {/* Timestamp */}
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            {timeAgo(request.created_at)}
          </div>
        </div>
      </div>

      {/* Action buttons — hidden when resolved (card is about to exit) */}
      {!resolvedStatus && (
      <div className="flex items-center gap-2 mt-3 pl-12 flex-wrap">
        {request.request_type === 'kkup_team_approval' && request.tournament_id && (
          <>
            <Button
              onClick={() => onApproveTeam(request.tournament_id!, request.raw_id)}
              disabled={isActioning}
              className="bg-[#10b981]/10 hover:bg-[#10b981]/20 text-[#10b981] font-bold text-xs rounded-lg h-8 px-3"
            >
              {isActioning ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle className="w-3 h-3 mr-1" />}
              Approve
            </Button>
            <Button
              onClick={() => onDenyTeam(request.tournament_id!, request.raw_id)}
              disabled={isActioning}
              className="bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] font-bold text-xs rounded-lg h-8 px-3"
            >
              <XCircle className="w-3 h-3 mr-1" />
              Deny
            </Button>
            <Button
              onClick={() => onDismissTeam(request.tournament_id!, request.raw_id)}
              disabled={isActioning}
              className="bg-muted hover:bg-muted/80 text-muted-foreground font-bold text-xs rounded-lg h-8 px-3 ml-auto"
              title="Delete this request permanently"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Dismiss
            </Button>
          </>
        )}
        {request.request_type === 'kkup_staff_application' && request.tournament_id && (
          <>
            <Button
              onClick={() => onReviewStaff(request.tournament_id!, request.data?.user_id, 'approved')}
              disabled={isActioning}
              className="bg-[#10b981]/10 hover:bg-[#10b981]/20 text-[#10b981] font-bold text-xs rounded-lg h-8 px-3"
            >
              {isActioning ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle className="w-3 h-3 mr-1" />}
              Approve
            </Button>
            <Button
              onClick={() => onReviewStaff(request.tournament_id!, request.data?.user_id, 'denied')}
              disabled={isActioning}
              className="bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] font-bold text-xs rounded-lg h-8 px-3"
            >
              <XCircle className="w-3 h-3 mr-1" />
              Deny
            </Button>
            <Button
              onClick={() => onDismissStaff(request.tournament_id!, request.data?.user_id)}
              disabled={isActioning}
              className="bg-muted hover:bg-muted/80 text-muted-foreground font-bold text-xs rounded-lg h-8 px-3 ml-auto"
              title="Delete this request permanently"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Dismiss
            </Button>
          </>
        )}
        {request.request_type === 'mvp_request' && (
          <>
            <Button
              onClick={() => onApproveMVP(request.raw_id)}
              disabled={isActioning}
              className="bg-[#10b981]/10 hover:bg-[#10b981]/20 text-[#10b981] font-bold text-xs rounded-lg h-8 px-3"
            >
              {isActioning ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle className="w-3 h-3 mr-1" />}
              Approve
            </Button>
            <Button
              onClick={() => onDenyMVP(request.raw_id)}
              disabled={isActioning}
              className="bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] font-bold text-xs rounded-lg h-8 px-3"
            >
              <XCircle className="w-3 h-3 mr-1" />
              Deny
            </Button>
            <Button
              onClick={() => onDismissMVP(request.raw_id)}
              disabled={isActioning}
              className="bg-muted hover:bg-muted/80 text-muted-foreground font-bold text-xs rounded-lg h-8 px-3 ml-auto"
              title="Delete this request permanently"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Dismiss
            </Button>
          </>
        )}
      </div>
      )}
    </div>
  );
}


// ── Request Content Renderers ────────────────────────────────────────

function TeamApprovalContent({ request }: { request: OfficerRequest }) {
  const team = request.data;
  const captain = team?.captain;
  return (
    <div className="flex items-center gap-3">
      <TeamLogo logoUrl={team?.logo_url} teamName={team?.team_name || 'Team'} size="sm" />
      <div>
        <p className="text-sm font-bold text-foreground">
          {team?.team_name || 'Unknown Team'}
          {team?.team_tag && <span className="text-muted-foreground font-semibold ml-1.5">[{team.team_tag}]</span>}
        </p>
        {captain && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Captain: <span className="font-semibold text-foreground/80">{captain.display_name}</span>
          </p>
        )}
      </div>
    </div>
  );
}

function StaffAppContent({ request }: { request: OfficerRequest }) {
  const app = request.data;
  return (
    <div>
      <p className="text-sm font-bold text-foreground">
        {app?.discord_username || 'Unknown User'}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">
        Role preference: <span className="font-semibold text-foreground/80">
          {app?.role_preference === 'either' || app?.role_preference === 'flexible' ? 'Flexible' 
            : app?.role_preference === 'tournament_director' ? 'Tournament Director'
            : app?.role_preference || 'Not specified'}
        </span>
      </p>
      {app?.message && (
        <p className="text-xs text-muted-foreground mt-1 italic line-clamp-2">
          &ldquo;{app.message}&rdquo;
        </p>
      )}
    </div>
  );
}

function MVPRequestContent({ request }: { request: OfficerRequest }) {
  const mvp = request.data;
  const submitter = mvp?.users; // joined submitter from rank_up_requests_user_id_fkey
  const target = mvp?.target_user;
  const action = mvp?.action || 'rank_up';
  const actionCfg = MVP_ACTION_CONFIG[action] || MVP_ACTION_CONFIG.rank_up;
  const ActionIcon = actionCfg.icon;

  const [showScreenshot, setShowScreenshot] = useState(false);

  // Current rank info
  const currentRank = target?.rank_id || mvp?.current_rank_id;
  const currentPrestige = target?.prestige_level || mvp?.current_prestige_level || 0;

  // Names
  const targetName = target?.discord_username || mvp?.target_discord_username || 'Unknown';
  const submitterName = submitter?.discord_username || 'Unknown';
  const isSelfSubmit = submitterName === targetName;
  const targetAvatar = target?.discord_avatar;
  const submitterAvatar = submitter?.discord_avatar;

  // Projected next rank
  let nextRank: string | null = null;
  if (currentRank != null) {
    if (action === 'rank_up') nextRank = `Rank ${currentRank + 1}${currentPrestige > 0 ? ` P${currentPrestige}` : ''}`;
    else if (action === 'rank_down') nextRank = `Rank ${currentRank - 1}${currentPrestige > 0 ? ` P${currentPrestige}` : ''}`;
    else if (action === 'prestige') nextRank = `Rank 1 P${currentPrestige + 1}`;
  }

  return (
    <div>
      {/* Action type badge */}
      <div className="flex items-center gap-2 mb-2">
        <span
          className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
          style={{ backgroundColor: `${actionCfg.color}15`, color: actionCfg.color }}
        >
          <ActionIcon className="w-2.5 h-2.5" />
          {actionCfg.label}
        </span>
      </div>

      {/* Requester → Target visual */}
      <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-2.5">
        {/* Submitter */}
        <div className="flex items-center gap-2 min-w-0">
          {submitterAvatar ? (
            <img src={submitterAvatar} alt={submitterName} className="w-8 h-8 rounded-full flex-shrink-0 border border-border" width={32} height={32} />
          ) : (
            <div className="w-8 h-8 rounded-full bg-harvest/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-harvest">{submitterName.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground truncate">{submitterName}</p>
            <p className="text-[10px] text-muted-foreground">
              {isSelfSubmit ? 'Self-request' : 'Requester'}
              {submitter?.rank_id != null && (
                <span className="ml-1 font-semibold">
                  R{submitter.rank_id}{(submitter.prestige_level || 0) > 0 ? ` P${submitter.prestige_level}` : ''}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Arrow */}
        {!isSelfSubmit && (
          <>
            <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            {/* Target */}
            <div className="flex items-center gap-2 min-w-0">
              {targetAvatar ? (
                <img src={targetAvatar} alt={targetName} className="w-8 h-8 rounded-full flex-shrink-0 border border-border" width={32} height={32} />
              ) : (
                <div className="w-8 h-8 rounded-full bg-[#3b82f6]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-[#3b82f6]">{targetName.charAt(0).toUpperCase()}</span>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground truncate">{targetName}</p>
                <p className="text-[10px] text-muted-foreground">
                  Target
                  {currentRank != null && (
                    <span className="ml-1 font-semibold">
                      R{currentRank}{currentPrestige > 0 ? ` P${currentPrestige}` : ''}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Rank change preview */}
      {currentRank != null && nextRank && (
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-muted-foreground">Rank change:</span>
          <span className="text-xs font-bold text-foreground">
            Rank {currentRank}{currentPrestige > 0 ? ` P${currentPrestige}` : ''}
          </span>
          <ArrowRight className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs font-bold" style={{ color: actionCfg.color }}>
            {nextRank}
          </span>
        </div>
      )}

      {/* Self-submit: show target rank for self-requests */}
      {isSelfSubmit && currentRank != null && (
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">Current rank:</span>
          <span className="text-xs font-bold text-foreground">
            Rank {currentRank}{currentPrestige > 0 ? ` P${currentPrestige}` : ''}
          </span>
        </div>
      )}

      {/* Description */}
      {mvp?.description && (
        <p className="text-xs text-muted-foreground mt-2 italic line-clamp-3">
          &ldquo;{mvp.description}&rdquo;
        </p>
      )}

      {/* Screenshot toggle */}
      {mvp?.screenshot_url && (
        <div className="mt-2">
          <button
            onClick={(e) => { e.stopPropagation(); setShowScreenshot(!showScreenshot); }}
            className="flex items-center gap-1.5 text-xs font-semibold text-harvest hover:text-harvest/80 transition-colors"
          >
            <ImageIcon className="w-3 h-3" />
            {showScreenshot ? 'Hide' : 'View'} Screenshot
            {showScreenshot ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          {showScreenshot && (
            <div className="mt-2 rounded-lg overflow-hidden border border-border bg-muted">
              <a href={mvp.screenshot_url} target="_blank" rel="noopener noreferrer">
                <img
                  src={mvp.screenshot_url}
                  alt="MVP Screenshot"
                  className="w-full max-h-80 object-contain"
                  loading="lazy"
                />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}