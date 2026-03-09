/**
 * Tournament Create Modal
 *
 * Officer/owner modal for creating a new tournament.
 * Uses the BottomSheetModal pattern with dark mode semantic tokens.
 *
 * Sections:
 *   1. Dota 2 League Link (name, ID, type)
 *   2. League Graphics (banner, large icon, square icon via ImageUpload)
 *   3. Description
 *   4. Dates & Times
 *   5. Teams & Staffing
 *   6. Media Links
 */
import { useState } from 'react';
import {
  Crown, Loader2, Calendar, Users, Tv, Link2, ImageIcon, Shield, ChevronDown,
} from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { ImageUpload } from '@/app/components/image-upload';
import { BottomSheetModal } from '@/app/components/bottom-sheet-modal';
import { projectId } from '/utils/supabase/info';
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
        options.push({
          label: `${medal} ${stars}`,
          numeric: rankToNumeric(medal, stars),
        });
      }
    }
  }
  return options;
}

const RANK_OPTIONS = buildRankOptions();

interface TournamentCreateModalProps {
  accessToken: string;
  onClose: () => void;
  onCreated: (tournament: any) => void;
}

export function TournamentCreateModal({ accessToken, onClose, onCreated }: TournamentCreateModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [tournamentType, setTournamentType] = useState<'kernel_kup' | 'heaps_n_hooks'>('kernel_kup');
  const [description, setDescription] = useState('');
  const [leagueId, setLeagueId] = useState('');
  const [registrationStartDate, setRegistrationStartDate] = useState('');
  const [registrationEndDate, setRegistrationEndDate] = useState('');
  const [tournamentStartDate, setTournamentStartDate] = useState('');
  const [tournamentEndDate, setTournamentEndDate] = useState('');
  const [minTeams, setMinTeams] = useState('');
  const [maxTeams, setMaxTeams] = useState('');
  const [maxTeamSize, setMaxTeamSize] = useState('7');
  const [minTeamSize, setMinTeamSize] = useState('5');
  const [castersNeeded, setCastersNeeded] = useState('');
  const [staffNeeded, setStaffNeeded] = useState('');
  const [prizePool, setPrizePool] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [twitchUrl1, setTwitchUrl1] = useState('');
  const [twitchUrl2, setTwitchUrl2] = useState('');
  const [season, setSeason] = useState('');

  // Rank eligibility (per-tournament override)
  const [useCustomRank, setUseCustomRank] = useState(false);
  const [minRank, setMinRank] = useState<number>(1);   // Herald 1
  const [maxRank, setMaxRank] = useState<number>(31);   // Divine 1

  // League graphic URLs (uploaded to storage)
  const [bannerUrl, setBannerUrl] = useState('');
  const [largeIconUrl, setLargeIconUrl] = useState('');
  const [squareIconUrl, setSquareIconUrl] = useState('');

  // Derive a clean folder name from the tournament name (reactive to input)
  const uploadFolder = getTournamentImageFolder(name || '');

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Tournament name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: any = {
        name: name.trim(),
        tournament_type: tournamentType,
      };

      // Dota 2 League ID
      if (leagueId.trim()) payload.league_id = parseInt(leagueId);

      // Only include non-empty optional fields
      if (description.trim()) payload.description = description.trim();
      if (registrationStartDate) payload.registration_start_date = new Date(registrationStartDate).toISOString();
      if (registrationEndDate) payload.registration_end_date = new Date(registrationEndDate).toISOString();
      if (tournamentStartDate) payload.tournament_start_date = new Date(tournamentStartDate).toISOString();
      if (tournamentEndDate) payload.tournament_end_date = new Date(tournamentEndDate).toISOString();
      if (maxTeams) payload.max_teams = parseInt(maxTeams);
      if (minTeams) payload.min_teams = parseInt(minTeams);
      if (maxTeamSize) payload.max_team_size = parseInt(maxTeamSize);
      if (minTeamSize) payload.min_team_size = parseInt(minTeamSize);
      if (castersNeeded) payload.casters_needed = parseInt(castersNeeded);
      if (staffNeeded) payload.staff_needed = parseInt(staffNeeded);
      if (prizePool) payload.prize_pool = parseFloat(prizePool);
      if (youtubeUrl.trim()) payload.youtube_url = youtubeUrl.trim();
      if (twitchUrl1.trim()) payload.twitch_url_1 = twitchUrl1.trim();
      if (twitchUrl2.trim()) payload.twitch_url_2 = twitchUrl2.trim();
      if (season.trim()) payload.kkup_season = parseInt(season);

      // Rank eligibility
      if (useCustomRank) {
        payload.min_rank = minRank;
        payload.max_rank = maxRank;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/tournaments/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create tournament');
      }

      onCreated(data.tournament);
    } catch (err: any) {
      console.error('Create tournament error:', err);
      setError(err.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  // Shared input classes for consistency
  const inputClass = 'h-11 rounded-xl border-2 border-border focus:border-harvest bg-input-background text-foreground';
  const inputSmClass = 'h-10 rounded-xl border-2 border-border focus:border-harvest bg-input-background text-foreground text-sm';
  const sectionHeaderClass = 'flex items-center gap-2';
  const sectionTitleClass = 'text-sm font-bold text-muted-foreground uppercase tracking-wider';

  return (
    <BottomSheetModal onClose={onClose} maxWidth="max-w-2xl">
      <BottomSheetModal.Header
        gradient="from-harvest/10 to-harvest/5"
        borderColor="border-harvest/20"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-harvest/20 flex items-center justify-center">
            <Crown className="w-6 h-6 text-harvest" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">Create Tournament</h3>
            <p className="text-sm text-muted-foreground">
              Create your league at{' '}
              <a
                href="https://www.dota2.com/league/0/list"
                target="_blank"
                rel="noopener noreferrer"
                className="text-harvest underline hover:text-harvest/80"
              >
                dota2.com/league
              </a>
              {' '}first, then fill in details here.
            </p>
          </div>
        </div>
      </BottomSheetModal.Header>

      <BottomSheetModal.Body className="space-y-6">
        {/* Error */}
        {error && (
          <div className="bg-error/10 border-2 border-error/20 rounded-xl p-4 text-error text-sm font-medium">
            {error}
          </div>
        )}

        {/* ── Dota 2 League Link ── */}
        <div className="bg-[#3b82f6]/5 border-2 border-[#3b82f6]/20 rounded-xl p-5 space-y-4">
          <div className={sectionHeaderClass}>
            <Link2 className="w-5 h-5 text-[#3b82f6]" />
            <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">Dota 2 League Link</h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground font-semibold">Tournament Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='e.g. "Kernel Kup 10"'
                className={inputClass}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="league-id" className="text-foreground font-semibold flex items-center gap-1.5">
                  League ID
                  <span className="text-xs font-normal text-muted-foreground">(Dota)</span>
                </Label>
                <Input
                  id="league-id"
                  type="number"
                  value={leagueId}
                  onChange={(e) => setLeagueId(e.target.value)}
                  placeholder="e.g. 17683"
                  className="h-11 rounded-xl border-2 border-[#3b82f6]/20 focus:border-[#3b82f6] bg-input-background text-foreground"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="season" className="text-foreground font-semibold">Season</Label>
                <Input
                  id="season"
                  type="number"
                  min="1"
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  placeholder="e.g. 3"
                  className="h-11 rounded-xl border-2 border-[#3b82f6]/20 focus:border-[#3b82f6] bg-input-background text-foreground"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground font-semibold">Tournament Type</Label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setTournamentType('kernel_kup')}
                className={`flex-1 px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                  tournamentType === 'kernel_kup'
                    ? 'border-harvest bg-harvest/10 text-harvest'
                    : 'border-border text-muted-foreground hover:border-harvest/40'
                }`}
              >
                Kernel Kup (5v5)
              </button>
              <button
                type="button"
                onClick={() => setTournamentType('heaps_n_hooks')}
                className={`flex-1 px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
                  tournamentType === 'heaps_n_hooks'
                    ? 'border-harvest bg-harvest/10 text-harvest'
                    : 'border-border text-muted-foreground hover:border-harvest/40'
                }`}
              >
                Heaps n Hooks (1v1)
              </button>
            </div>
          </div>
        </div>

        {/* ── League Graphics ── */}
        <div className="space-y-4">
          <div className={sectionHeaderClass}>
            <ImageIcon className="w-4 h-4 text-harvest" />
            <h4 className={sectionTitleClass}>League Graphics</h4>
            <span className="text-xs text-muted-foreground">(same files uploaded to Dota)</span>
          </div>
          {name.trim() && (
            <p className="text-[10px] text-muted-foreground font-mono bg-muted rounded-lg px-2 py-1 inline-block">
              Storage: /{uploadFolder}/
            </p>
          )}

          {/* Banner - full width */}
          <ImageUpload
            currentUrl={bannerUrl || null}
            onUploadComplete={setBannerUrl}
            label="League Banner (600 x 120 px)"
            folder={uploadFolder}
            filename="league_banner.png"
            previewClass="w-full h-20 object-cover rounded-lg border-2 border-border"
          />

          {/* Icons - side by side */}
          <div className="grid grid-cols-2 gap-4">
            <ImageUpload
              currentUrl={largeIconUrl || null}
              onUploadComplete={setLargeIconUrl}
              label="Large Icon (256 x 144 px)"
              folder={uploadFolder}
              filename="league_large_icon.png"
              previewClass="w-full h-24 object-cover rounded-lg border-2 border-border"
            />
            <ImageUpload
              currentUrl={squareIconUrl || null}
              onUploadComplete={setSquareIconUrl}
              label="Square Icon (120 x 120 px)"
              folder={uploadFolder}
              filename="league_square_icon.png"
              previewClass="w-full h-24 object-contain rounded-lg border-2 border-border"
            />
          </div>
        </div>

        {/* ── Description ── */}
        <div className="space-y-2">
          <Label htmlFor="description" className="text-foreground font-semibold">Description</Label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tournament description, rules summary, etc."
            className="w-full h-24 rounded-xl border-2 border-border focus:border-harvest bg-input-background text-foreground px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-harvest/30"
          />
        </div>

        {/* ── Dates & Times ── */}
        <div className="space-y-4">
          <div className={sectionHeaderClass}>
            <Calendar className="w-4 h-4 text-harvest" />
            <h4 className={sectionTitleClass}>Dates & Times</h4>
            <span className="text-xs text-muted-foreground ml-auto">{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reg-start" className="text-muted-foreground text-sm">Registration Opens</Label>
              <Input
                id="reg-start"
                type="datetime-local"
                value={registrationStartDate}
                onChange={(e) => setRegistrationStartDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reg-end" className="text-muted-foreground text-sm">Registration Closes</Label>
              <Input
                id="reg-end"
                type="datetime-local"
                value={registrationEndDate}
                onChange={(e) => setRegistrationEndDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="start-date" className="text-muted-foreground text-sm">Tournament Starts</Label>
              <Input
                id="start-date"
                type="datetime-local"
                value={tournamentStartDate}
                onChange={(e) => setTournamentStartDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date" className="text-muted-foreground text-sm">Tournament Ends</Label>
              <Input
                id="end-date"
                type="datetime-local"
                value={tournamentEndDate}
                onChange={(e) => setTournamentEndDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* ── Team Config + Staffing ── */}
        <div className="space-y-4">
          <div className={sectionHeaderClass}>
            <Users className="w-4 h-4 text-harvest" />
            <h4 className={sectionTitleClass}>Teams & Staffing</h4>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="min-teams" className="text-muted-foreground text-xs">Min Teams</Label>
              <Input
                id="min-teams"
                type="number"
                min="2"
                max="8"
                value={minTeams}
                onChange={(e) => setMinTeams(e.target.value)}
                placeholder="2"
                className={inputSmClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="max-teams" className="text-muted-foreground text-xs">Max Teams</Label>
              <Input
                id="max-teams"
                type="number"
                min="2"
                value={maxTeams}
                onChange={(e) => setMaxTeams(e.target.value)}
                placeholder="--"
                className={inputSmClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="min-team-size" className="text-muted-foreground text-xs">Min Roster</Label>
              <Input
                id="min-team-size"
                type="number"
                min="1"
                max="10"
                value={minTeamSize}
                onChange={(e) => setMinTeamSize(e.target.value)}
                className={inputSmClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="max-team-size" className="text-muted-foreground text-xs">Max Roster</Label>
              <Input
                id="max-team-size"
                type="number"
                min="1"
                max="10"
                value={maxTeamSize}
                onChange={(e) => setMaxTeamSize(e.target.value)}
                className={inputSmClass}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-1">Min Teams: minimum approved teams needed to generate bracket (default 2). Default roster: 5 starters + 2 subs = 7 max. Coach is separate.</p>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="casters-needed" className="text-muted-foreground text-xs">Casters Needed</Label>
              <Input
                id="casters-needed"
                type="number"
                min="0"
                value={castersNeeded}
                onChange={(e) => setCastersNeeded(e.target.value)}
                placeholder="--"
                className={inputSmClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-needed" className="text-muted-foreground text-xs">Staff Needed</Label>
              <Input
                id="staff-needed"
                type="number"
                min="0"
                value={staffNeeded}
                onChange={(e) => setStaffNeeded(e.target.value)}
                placeholder="--"
                className={inputSmClass}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prize-pool" className="text-muted-foreground text-xs">Prize Pool ($)</Label>
              <Input
                id="prize-pool"
                type="number"
                min="0"
                step="0.01"
                value={prizePool}
                onChange={(e) => setPrizePool(e.target.value)}
                placeholder="0"
                className={inputSmClass}
              />
            </div>
          </div>
        </div>

        {/* ── Rank Eligibility ── */}
        {tournamentType === 'kernel_kup' && (
          <div className="space-y-4">
            <div className={sectionHeaderClass}>
              <Shield className="w-4 h-4 text-harvest" />
              <h4 className={sectionTitleClass}>Rank Eligibility</h4>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setUseCustomRank(false)}
                className={`flex-1 px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
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
                className={`flex-1 px-4 py-3 rounded-xl border-2 font-semibold text-sm transition-all ${
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
                      value={minRank}
                      onChange={(e) => setMinRank(Number(e.target.value))}
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
                      value={maxRank}
                      onChange={(e) => setMaxRank(Number(e.target.value))}
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
                : 'This tournament will use the global rank eligibility range set in the Officer Panel.'}
            </p>
          </div>
        )}

        {/* ── Media Links ── */}
        <div className="space-y-4">
          <div className={sectionHeaderClass}>
            <Tv className="w-4 h-4 text-harvest" />
            <h4 className={sectionTitleClass}>Media Links</h4>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="youtube" className="text-muted-foreground text-xs">YouTube URL</Label>
              <Input
                id="youtube"
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/..."
                className={inputSmClass}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="twitch1" className="text-muted-foreground text-xs">Twitch URL #1</Label>
                <Input
                  id="twitch1"
                  type="url"
                  value={twitchUrl1}
                  onChange={(e) => setTwitchUrl1(e.target.value)}
                  placeholder="https://twitch.tv/..."
                  className={inputSmClass}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="twitch2" className="text-muted-foreground text-xs">Twitch URL #2</Label>
                <Input
                  id="twitch2"
                  type="url"
                  value={twitchUrl2}
                  onChange={(e) => setTwitchUrl2(e.target.value)}
                  placeholder="https://twitch.tv/..."
                  className={inputSmClass}
                />
              </div>
            </div>
          </div>
        </div>
      </BottomSheetModal.Body>

      <BottomSheetModal.Footer>
        <div className="flex gap-3">
          <Button
            type="button"
            onClick={onClose}
            className="flex-1 bg-muted hover:bg-muted/80 text-foreground h-12 rounded-xl font-semibold"
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            className="flex-1 bg-harvest hover:bg-harvest/80 text-white h-12 rounded-xl font-bold disabled:opacity-50"
            disabled={saving || !name.trim()}
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Crown className="w-5 h-5 mr-2" />
                Create Tournament
              </>
            )}
          </Button>
        </div>
      </BottomSheetModal.Footer>
    </BottomSheetModal>
  );
}