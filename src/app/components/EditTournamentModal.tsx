import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { BottomSheetModal } from '@/app/components/bottom-sheet-modal';
import { ImageUpload } from '@/app/components/image-upload';
import { Loader2, Crown, Calendar, Users, Tv, ImageIcon, Trash2, AlertTriangle, Shield, ChevronDown } from '@/lib/icons';
import { projectId } from '/utils/supabase/info';
import { toast } from 'sonner';
import { getTournamentImageFolder } from '@/lib/slugify';
import { numericToRank, rankToNumeric } from '@/lib/rank-utils';

const MEDAL_ORDER = ['Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal'] as const;

function buildRankOptions(): { label: string; numeric: number }[] {
  const options: { label: string; numeric: number }[] = [];
  for (const medal of MEDAL_ORDER) {
    if (medal === 'Immortal') {
      options.push({ label: 'Immortal', numeric: 36 });
    } else {
      for (let stars = 1; stars <= 5; stars++) {
        options.push({ label: `${medal} ${stars}`, numeric: rankToNumeric(medal, stars) });
      }
    }
  }
  return options;
}

const RANK_OPTIONS = buildRankOptions();

interface EditTournamentModalProps {
  tournament: {
    id: string;
    name: string;
    status?: string;
    tournament_type?: string;
    league_id?: number | null;
    description?: string | null;
    prize_pool?: number | string | null;
    registration_start_date?: string | null;
    registration_end_date?: string | null;
    tournament_start_date?: string | null;
    tournament_end_date?: string | null;
    max_teams?: number | null;
    min_teams?: number | null;
    max_team_size?: number | null;
    min_team_size?: number | null;
    casters_needed?: number | null;
    staff_needed?: number | null;
    youtube_url?: string | null;
    twitch_url_1?: string | null;
    twitch_url_2?: string | null;
    banner_url?: string | null;
    large_icon_url?: string | null;
    square_icon_url?: string | null;
    kkup_season?: number | null;
    min_rank?: number | null;
    max_rank?: number | null;
  };
  onClose: () => void;
  onSave: () => void;
  /** Called after successful tournament deletion — parent should navigate away */
  onDeleted?: () => void;
  /** If true, uses legacy /kkup/:id/update endpoint for historical tournaments */
  legacy?: boolean;
}

// Convert a stored UTC ISO string → local datetime-local input value (YYYY-MM-DDTHH:mm)
function toDateTimeLocal(val: string | null | undefined): string {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Convert a datetime-local input value (local time) → UTC ISO string for storage
function localToUTC(val: string): string | null {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function EditTournamentModal({ tournament, onClose, onSave, onDeleted, legacy }: EditTournamentModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Form state
  const [name, setName] = useState(tournament.name || '');
  const [description, setDescription] = useState(tournament.description || '');
  const [tournamentType, setTournamentType] = useState(tournament.tournament_type || 'kernel_kup');
  const [leagueId, setLeagueId] = useState(tournament.league_id?.toString() || '');
  const [prizePool, setPrizePool] = useState(tournament.prize_pool?.toString() || '');
  const [registrationStartDate, setRegistrationStartDate] = useState(toDateTimeLocal(tournament.registration_start_date));
  const [registrationEndDate, setRegistrationEndDate] = useState(toDateTimeLocal(tournament.registration_end_date));
  const [tournamentStartDate, setTournamentStartDate] = useState(toDateTimeLocal(tournament.tournament_start_date));
  const [tournamentEndDate, setTournamentEndDate] = useState(toDateTimeLocal(tournament.tournament_end_date));
  const [maxTeams, setMaxTeams] = useState(tournament.max_teams?.toString() || '');
  const [minTeams, setMinTeams] = useState(tournament.min_teams?.toString() || '');
  const [maxTeamSize, setMaxTeamSize] = useState(tournament.max_team_size?.toString() || '');
  const [minTeamSize, setMinTeamSize] = useState(tournament.min_team_size?.toString() || '');
  const [castersNeeded, setCastersNeeded] = useState(tournament.casters_needed?.toString() || '');
  const [staffNeeded, setStaffNeeded] = useState(tournament.staff_needed?.toString() || '');
  const [youtubeUrl, setYoutubeUrl] = useState(tournament.youtube_url || '');
  const [twitchUrl1, setTwitchUrl1] = useState(tournament.twitch_url_1 || '');
  const [twitchUrl2, setTwitchUrl2] = useState(tournament.twitch_url_2 || '');
  const [bannerUrl, setBannerUrl] = useState(tournament.banner_url || '');
  const [largeIconUrl, setLargeIconUrl] = useState(tournament.large_icon_url || '');
  const [squareIconUrl, setSquareIconUrl] = useState(tournament.square_icon_url || '');
  const [season, setSeason] = useState(tournament.kkup_season?.toString() || '');

  // Rank eligibility (per-tournament override)
  const [useCustomRank, setUseCustomRank] = useState(tournament.min_rank != null || tournament.max_rank != null);
  const [editMinRank, setEditMinRank] = useState<number>(tournament.min_rank ?? 1);
  const [editMaxRank, setEditMaxRank] = useState<number>(tournament.max_rank ?? 31);

  const apiBase = `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af`;
  const accessToken = typeof window !== 'undefined' ? localStorage.getItem('supabase_token') : null;
  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`,
  };

  const imageFolder = getTournamentImageFolder(tournament.name, tournament.id);

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (legacy) {
        const res = await fetch(`${apiBase}/kkup/${tournament.id}/update`, {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({
            cover_photo_url: bannerUrl || null,
            prize_pool: prizePool || null,
            description: description || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update tournament');
      } else {
        const body: any = {
          name,
          description: description || null,
          tournament_type: tournamentType,
          league_id: leagueId ? parseInt(leagueId) : null,
          prize_pool: prizePool || null,
          registration_start_date: localToUTC(registrationStartDate),
          registration_end_date: localToUTC(registrationEndDate),
          tournament_start_date: localToUTC(tournamentStartDate),
          tournament_end_date: localToUTC(tournamentEndDate),
          max_teams: maxTeams ? parseInt(maxTeams) : null,
          min_teams: minTeams ? parseInt(minTeams) : null,
          max_team_size: maxTeamSize ? parseInt(maxTeamSize) : null,
          min_team_size: minTeamSize ? parseInt(minTeamSize) : null,
          casters_needed: castersNeeded ? parseInt(castersNeeded) : null,
          staff_needed: staffNeeded ? parseInt(staffNeeded) : null,
          youtube_url: youtubeUrl || null,
          twitch_url_1: twitchUrl1 || null,
          twitch_url_2: twitchUrl2 || null,
          kkup_season: season ? parseInt(season) : null,
          min_rank: useCustomRank ? editMinRank : null,
          max_rank: useCustomRank ? editMaxRank : null,
        };

        const res = await fetch(`${apiBase}/kkup/tournaments/${tournament.id}/config`, {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update tournament');
      }

      toast.success('Tournament updated successfully');
      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`${apiBase}/kkup/tournaments/${tournament.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete tournament');
      toast.success(`Tournament "${tournament.name}" and all related data have been deleted.`);
      onClose();
      onDeleted?.();
    } catch (err: any) {
      console.error('Delete tournament error:', err);
      toast.error(err.message || 'Failed to delete tournament');
      setError(err.message);
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <BottomSheetModal onClose={onClose} maxWidth="max-w-2xl">
      <BottomSheetModal.Header gradient="from-harvest/10 to-harvest/5" borderColor="border-harvest/20">
        <div className="flex items-center gap-3">
          <Crown className="w-6 h-6 text-harvest" />
          <div>
            <h2 className="text-lg font-bold text-foreground">Edit Tournament</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{tournament.name}</p>
          </div>
        </div>
      </BottomSheetModal.Header>

      <BottomSheetModal.Body className="space-y-6">
        {error && (
          <div className="bg-error/10 border border-error/30 rounded-xl p-3 text-error text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        {/* ── Basic Info ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4 text-harvest" />
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Basic Info</h3>
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">Tournament Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kernel Kup 10"
              disabled={legacy}
              className="bg-input-background border-border text-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-muted-foreground text-xs">Description</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tournament description..."
              rows={3}
              className="w-full rounded-xl border-2 border-border bg-input-background text-foreground px-3 py-2 text-sm focus:outline-none focus:border-harvest/50"
            />
          </div>

          {!legacy && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Tournament Type</Label>
                  <select
                    value={tournamentType}
                    onChange={(e) => setTournamentType(e.target.value)}
                    className="w-full rounded-xl border-2 border-border bg-input-background text-foreground px-3 py-2 text-sm focus:outline-none focus:border-harvest/50"
                  >
                    <option value="kernel_kup">Kernel Kup</option>
                    <option value="heaps_n_hooks">Heaps N Hooks</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs">League ID</Label>
                    <Input
                      type="number"
                      value={leagueId}
                      onChange={(e) => setLeagueId(e.target.value)}
                      placeholder="Optional"
                      className="bg-input-background border-border text-foreground"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs">Season</Label>
                    <Input
                      type="number"
                      min="1"
                      value={season}
                      onChange={(e) => setSeason(e.target.value)}
                      placeholder="e.g. 3"
                      className="bg-input-background border-border text-foreground"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Prize Pool</Label>
                <Input
                  value={prizePool}
                  onChange={(e) => setPrizePool(e.target.value)}
                  placeholder="e.g. $100 or 100"
                  className="bg-input-background border-border text-foreground"
                />
              </div>
            </>
          )}

          {legacy && (
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Prize Pool</Label>
              <Input
                value={prizePool}
                onChange={(e) => setPrizePool(e.target.value)}
                placeholder="e.g. $100"
                className="bg-input-background border-border text-foreground"
              />
            </div>
          )}
        </div>

        {/* ── Dates ── */}
        {!legacy && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-harvest" />
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Dates</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Registration Start</Label>
                <Input
                  type="datetime-local"
                  value={registrationStartDate}
                  onChange={(e) => setRegistrationStartDate(e.target.value)}
                  className="bg-input-background border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Registration End</Label>
                <Input
                  type="datetime-local"
                  value={registrationEndDate}
                  onChange={(e) => setRegistrationEndDate(e.target.value)}
                  className="bg-input-background border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Tournament Start</Label>
                <Input
                  type="datetime-local"
                  value={tournamentStartDate}
                  onChange={(e) => setTournamentStartDate(e.target.value)}
                  className="bg-input-background border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Tournament End</Label>
                <Input
                  type="datetime-local"
                  value={tournamentEndDate}
                  onChange={(e) => setTournamentEndDate(e.target.value)}
                  className="bg-input-background border-border text-foreground"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Team Settings ── */}
        {!legacy && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-harvest" />
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Team Settings</h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Max Teams</Label>
                <Input
                  type="number"
                  value={maxTeams}
                  onChange={(e) => setMaxTeams(e.target.value)}
                  placeholder="∞"
                  className="bg-input-background border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Min Teams</Label>
                <Input
                  type="number"
                  value={minTeams}
                  onChange={(e) => setMinTeams(e.target.value)}
                  placeholder="1"
                  className="bg-input-background border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Min Team Size</Label>
                <Input
                  type="number"
                  value={minTeamSize}
                  onChange={(e) => setMinTeamSize(e.target.value)}
                  placeholder="5"
                  className="bg-input-background border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Max Team Size</Label>
                <Input
                  type="number"
                  value={maxTeamSize}
                  onChange={(e) => setMaxTeamSize(e.target.value)}
                  placeholder="7"
                  className="bg-input-background border-border text-foreground"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Casters Needed</Label>
                <Input
                  type="number"
                  value={castersNeeded}
                  onChange={(e) => setCastersNeeded(e.target.value)}
                  placeholder="0"
                  className="bg-input-background border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Staff Needed</Label>
                <Input
                  type="number"
                  value={staffNeeded}
                  onChange={(e) => setStaffNeeded(e.target.value)}
                  placeholder="0"
                  className="bg-input-background border-border text-foreground"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Rank Eligibility ── */}
        {!legacy && tournamentType === 'kernel_kup' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-harvest" />
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Rank Eligibility</h3>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setUseCustomRank(false)}
                className={`flex-1 px-4 py-2.5 rounded-xl border-2 font-semibold text-sm transition-all ${
                  !useCustomRank
                    ? 'border-harvest bg-harvest/10 text-harvest'
                    : 'border-border text-muted-foreground hover:border-harvest/40'
                }`}
              >
                Use Global Default
              </button>
              <button
                type="button"
                onClick={() => setUseCustomRank(true)}
                className={`flex-1 px-4 py-2.5 rounded-xl border-2 font-semibold text-sm transition-all ${
                  useCustomRank
                    ? 'border-harvest bg-harvest/10 text-harvest'
                    : 'border-border text-muted-foreground hover:border-harvest/40'
                }`}
              >
                Custom for This Tournament
              </button>
            </div>

            {useCustomRank && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Minimum Rank</Label>
                  <div className="relative">
                    <select
                      value={editMinRank}
                      onChange={(e) => setEditMinRank(Number(e.target.value))}
                      className="w-full appearance-none bg-input-background border-2 border-border rounded-xl px-3 py-2.5 pr-10 text-sm font-semibold text-foreground focus:outline-none focus:border-harvest/50 transition-colors cursor-pointer"
                    >
                      {RANK_OPTIONS.map((opt) => (
                        <option key={opt.numeric} value={opt.numeric}>{opt.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground text-xs">Maximum Rank</Label>
                  <div className="relative">
                    <select
                      value={editMaxRank}
                      onChange={(e) => setEditMaxRank(Number(e.target.value))}
                      className="w-full appearance-none bg-input-background border-2 border-border rounded-xl px-3 py-2.5 pr-10 text-sm font-semibold text-foreground focus:outline-none focus:border-harvest/50 transition-colors cursor-pointer"
                    >
                      {RANK_OPTIONS.map((opt) => (
                        <option key={opt.numeric} value={opt.numeric}>{opt.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {useCustomRank
                ? 'Only players within this rank range can register as a Player for this tournament.'
                : 'This tournament uses the global rank eligibility range set in the Officer Panel.'}
            </p>
          </div>
        )}

        {/* ── Streaming ── */}
        {!legacy && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Tv className="w-4 h-4 text-harvest" />
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Streaming</h3>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">YouTube URL</Label>
                <Input
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://youtube.com/..."
                  className="bg-input-background border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Twitch URL 1</Label>
                <Input
                  value={twitchUrl1}
                  onChange={(e) => setTwitchUrl1(e.target.value)}
                  placeholder="https://twitch.tv/..."
                  className="bg-input-background border-border text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs">Twitch URL 2</Label>
                <Input
                  value={twitchUrl2}
                  onChange={(e) => setTwitchUrl2(e.target.value)}
                  placeholder="https://twitch.tv/..."
                  className="bg-input-background border-border text-foreground"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Images ── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <ImageIcon className="w-4 h-4 text-harvest" />
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Images</h3>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Banner Image</Label>
              <ImageUpload
                currentUrl={bannerUrl}
                onUploadComplete={(url) => setBannerUrl(url)}
                label="Upload Banner"
                folder={imageFolder}
                filename="banner"
                previewClass="w-full h-32 object-cover rounded-lg"
              />
            </div>

            {!legacy && (
              <>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Large Icon</Label>
                  <ImageUpload
                    currentUrl={largeIconUrl}
                    onUploadComplete={(url) => setLargeIconUrl(url)}
                    label="Upload Large Icon"
                    folder={imageFolder}
                    filename="large-icon"
                    previewClass="w-24 h-24 object-cover rounded-lg"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Square Icon</Label>
                  <ImageUpload
                    currentUrl={squareIconUrl}
                    onUploadComplete={(url) => setSquareIconUrl(url)}
                    label="Upload Square Icon"
                    folder={imageFolder}
                    filename="square-icon"
                    previewClass="w-16 h-16 object-cover rounded-lg"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Danger Zone ── */}
        <div className="border-2 border-error/20 rounded-xl overflow-hidden">
          <div className="bg-error/5 px-5 py-3 border-b border-error/10">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-error" />
              <h4 className="text-sm font-bold text-error uppercase tracking-wider">Danger Zone</h4>
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Delete this tournament</p>
                <p className="text-xs text-muted-foreground mt-1">Permanently delete all data including teams, rosters, registrations, invites, coach assignments, matches, and player stats.</p>
              </div>
              <Button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="bg-error hover:bg-[#c13a3a] text-white font-bold rounded-xl flex-shrink-0"
              >
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </Button>
            </div>

            {showDeleteConfirm && (
              <div className="mt-4 p-4 bg-error/5 border border-error/20 rounded-xl space-y-3">
                <p className="text-sm font-semibold text-error">
                  This action is irreversible. Type <span className="font-mono bg-error/10 px-1 rounded">{tournament.name}</span> to confirm.
                </p>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={tournament.name}
                  className="bg-input-background border-error/30 text-foreground"
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleteConfirmText !== tournament.name || deleting}
                    className="bg-error hover:bg-[#c13a3a] text-white font-bold rounded-xl disabled:opacity-50"
                  >
                    {deleting ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Deleting...</> : <><Trash2 className="w-4 h-4 mr-1" /> Permanently Delete</>}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                    className="bg-muted text-foreground font-bold rounded-xl"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </BottomSheetModal.Body>

      <BottomSheetModal.Footer className="border-t border-border pt-4">
        <div className="flex items-center justify-end gap-3">
          <Button type="button" onClick={onClose} className="bg-muted text-foreground font-bold rounded-xl">
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="bg-harvest hover:bg-amber text-white font-bold rounded-xl"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Saving...</> : 'Save Changes'}
          </Button>
        </div>
      </BottomSheetModal.Footer>
    </BottomSheetModal>
  );
}