/**
 * CSV Tournament Importer — Generic
 * Owner-only admin tool: optionally pick an existing tournament to import into,
 * drop the folder of 6 CSVs, auto-detect + assign files, preview, and import.
 *
 * Works for any Kernel Kup or Heaps n Hooks tournament — no hardcoded list.
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Upload, FileText, Eye, Rocket, CheckCircle2, AlertTriangle,
  XCircle, Loader2, ArrowLeft, Trash2, Users, Shield, Swords,
  BarChart3, Trophy, RefreshCw, FolderOpen, ChevronDown, Link2,
} from 'lucide-react';
import { projectId } from '/utils/supabase/info';
import { supabase } from '@/lib/supabase';
import { Footer } from '@/app/components/footer';

// ── Types ────────────────────────────────────────────────────────────
type CsvSlot = 'overview' | 'staff' | 'teams' | 'players' | 'matches' | 'stats';

interface CsvFile {
  name: string;
  content: string;
  rowCount: number;
}

interface PreviewData {
  tournament_name: string;
  tournament_type: string;
  is_1v1: boolean;
  status: string;
  description: string;
  start_date: string;
  end_date: string;
  winning_team: string;
  popd_kernel_1: string | null;
  popd_kernel_2: string | null;
  prize_pool: string;
  counts: {
    unique_persons: number;
    staff: number;
    teams: number;
    players: number;
    matches: number;
    player_match_stats: number;
  };
  persons: { steam_id: string; display_name: string }[];
  teams: { valve_team_id: string | null; name: string; tag: string; captain: string }[];
  already_exists: boolean;
  existing_id: string | null;
}

interface ImportResult {
  success: boolean;
  tournament_id: string;
  tournament_name: string;
  stats: {
    persons_upserted: number;
    tournament_created: boolean;
    staff_inserted: number;
    teams_inserted: number;
    rosters_inserted: number;
    matches_inserted: number;
    player_stats_inserted: number;
  };
  log: string[];
  errors?: string[];
  error_count: number;
}

interface ExistingTournament {
  id: string;
  name: string;
  status: string;
  tournament_type?: string;
}

const CSV_SLOT_META: { key: CsvSlot; label: string; icon: typeof FileText; pattern: string }[] = [
  { key: 'overview',  label: 'Overview',      icon: Trophy,    pattern: 'overview' },
  { key: 'staff',     label: 'Staff',         icon: Shield,    pattern: 'staff' },
  { key: 'teams',     label: 'Teams',         icon: Users,     pattern: 'teams' },
  { key: 'players',   label: 'Players',       icon: Users,     pattern: 'players' },
  { key: 'matches',   label: 'Matches',       icon: Swords,    pattern: 'matches' },
  { key: 'stats',     label: 'Player Stats',  icon: BarChart3, pattern: 'player_match_stats' },
];

type Step = 'upload' | 'preview' | 'importing' | 'result';

// ── Helper: count data rows in CSV text ─────────────────────────────
function countCsvRows(content: string): number {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  return lines.filter(l => l.trim() && !/^[,\s]*$/.test(l.trim())).length - 1; // minus header
}

// ── Helper: auto-detect which slot a file belongs to ────────────────
function detectSlot(filename: string): CsvSlot | null {
  const lower = filename.toLowerCase();
  if (lower.includes('player_match_stats') || lower.includes('playermatchstats'))  return 'stats';
  if (lower.includes('overview'))   return 'overview';
  if (lower.includes('staff'))      return 'staff';
  if (lower.includes('teams'))      return 'teams';
  if (lower.includes('players'))    return 'players';
  if (lower.includes('matches'))    return 'matches';
  return null;
}

export function CsvTournamentImporter({ user, onBack }: { user: any; onBack: () => void }) {
  const [files, setFiles] = useState<Partial<Record<CsvSlot, CsvFile>>>({});
  const [step, setStep] = useState<Step>('upload');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forceImport, setForceImport] = useState(false);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);

  // Target tournament (optional — import into existing)
  const [targetMode, setTargetMode] = useState<'auto' | 'existing'>('auto');
  const [existingTournaments, setExistingTournaments] = useState<ExistingTournament[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [loadingTournaments, setLoadingTournaments] = useState(false);

  const allFilesUploaded = CSV_SLOT_META.every(slot => files[slot.key]);
  const uploadedCount = CSV_SLOT_META.filter(slot => files[slot.key]).length;

  // Fetch existing tournaments when switching to "existing" mode
  useEffect(() => {
    if (targetMode === 'existing' && existingTournaments.length === 0) {
      fetchExistingTournaments();
    }
  }, [targetMode]);

  const fetchExistingTournaments = async () => {
    setLoadingTournaments(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/tournaments`,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      );
      if (res.ok) {
        const data = await res.json();
        setExistingTournaments(
          (data.tournaments || []).map((t: any) => ({
            id: t.id,
            name: t.name,
            status: t.status,
            tournament_type: t.tournament_type,
          }))
        );
      }
    } catch (err) {
      console.error('Failed to fetch tournaments:', err);
    } finally {
      setLoadingTournaments(false);
    }
  };

  // Process multiple files and auto-assign to slots
  const processFiles = useCallback((fileList: FileList) => {
    const newFiles: Partial<Record<CsvSlot, CsvFile>> = {};
    let processed = 0;
    const total = fileList.length;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (!file.name.endsWith('.csv')) continue;

      const slot = detectSlot(file.name);
      if (!slot) continue;

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        newFiles[slot] = {
          name: file.name,
          content,
          rowCount: countCsvRows(content),
        };
        processed++;
        if (processed === total || Object.keys(newFiles).length === 6) {
          setFiles(prev => ({ ...prev, ...newFiles }));
        }
      };
      reader.readAsText(file);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleSingleFileUpload = useCallback((slot: CsvSlot, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setFiles(prev => ({
        ...prev,
        [slot]: { name: file.name, content, rowCount: countCsvRows(content) },
      }));
    };
    reader.readAsText(file);
  }, []);

  const clearFile = (slot: CsvSlot) => {
    setFiles(prev => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
  };

  const handlePreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/csv-import/preview`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            overview_csv: files.overview?.content,
            staff_csv: files.staff?.content,
            teams_csv: files.teams?.content,
            players_csv: files.players?.content,
            matches_csv: files.matches?.content,
            stats_csv: files.stats?.content,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Preview failed');
      setPreview(data.preview);
      setStep('preview');
    } catch (err: any) {
      setError(err.message);
      console.error('Preview error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setStep('importing');
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const payload: any = {
        overview_csv: files.overview?.content,
        staff_csv: files.staff?.content,
        teams_csv: files.teams?.content,
        players_csv: files.players?.content,
        matches_csv: files.matches?.content,
        stats_csv: files.stats?.content,
        force: forceImport,
      };

      // If importing into an existing tournament, pass the target ID
      if (targetMode === 'existing' && selectedTargetId) {
        payload.target_tournament_id = selectedTargetId;
      }

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-4789f4af/kkup/csv-import`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setResult(data);
      setImportResults(prev => [...prev, data]);
      setStep('result');
    } catch (err: any) {
      setError(err.message);
      setStep('preview');
      console.error('Import error:', err);
    }
  };

  const resetForAnother = () => {
    setFiles({});
    setStep('upload');
    setPreview(null);
    setResult(null);
    setError(null);
    setForceImport(false);
  };

  const selectedTargetName = targetMode === 'existing' && selectedTargetId
    ? existingTournaments.find(t => t.id === selectedTargetId)?.name
    : null;

  return (
    <div className="p-3 sm:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-br from-harvest/10 to-harvest/5 rounded-2xl sm:rounded-3xl p-4 sm:p-8 border-2 border-harvest/20 mb-4 sm:mb-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={onBack}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-card border-2 border-border flex items-center justify-center hover:border-harvest/30 transition-all flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-3xl font-bold text-foreground">CSV Tournament Importer</h2>
              <p className="text-muted-foreground text-[11px] sm:text-sm">
                Drop 6 CSVs, preview, and import any tournament
              </p>
            </div>
            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-harvest flex items-center justify-center flex-shrink-0">
              <Upload className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
            </div>
          </div>

          {/* Recently imported */}
          {importResults.length > 0 && (
            <div className="mt-3 sm:mt-4 flex flex-wrap gap-1.5">
              {importResults.map((r, i) => (
                <div key={i} className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-bold ${
                  r.error_count === 0 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {r.tournament_name} {r.error_count === 0 ? '✓' : '⚠'}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-4 sm:mb-6 px-1">
          {['Load Files', 'Preview', 'Import', 'Done'].map((label, idx) => {
            const stepMap: Step[] = ['upload', 'preview', 'importing', 'result'];
            const currentIdx = stepMap.indexOf(step);
            const isActive = idx === currentIdx;
            const isPast = idx < currentIdx;
            return (
              <div key={label} className="flex items-center gap-1.5 flex-1">
                <div className={`w-5 h-5 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[9px] sm:text-xs font-bold transition-all flex-shrink-0 ${
                  isActive ? 'bg-harvest text-white' :
                  isPast ? 'bg-harvest/20 text-harvest' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {isPast ? <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : idx + 1}
                </div>
                <span className={`text-[8px] sm:text-[10px] font-semibold hidden sm:inline ${isActive ? 'text-harvest' : isPast ? 'text-harvest/60' : 'text-muted-foreground'}`}>
                  {label}
                </span>
                {idx < 3 && <div className={`flex-1 h-0.5 rounded ${isPast ? 'bg-harvest/30' : 'bg-muted'}`} />}
              </div>
            );
          })}
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 border-2 border-red-200 dark:border-red-800 rounded-xl p-3 sm:p-4 mb-4 flex items-start gap-2">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">Error</p>
              <p className="text-xs text-red-600 dark:text-red-300 break-words">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 flex-shrink-0">
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ═══════ STEP 1: LOAD FILES ═══════ */}
        {step === 'upload' && (
          <div className="space-y-3 sm:space-y-4">
            {/* Target tournament mode */}
            <div className="bg-card rounded-xl border-2 border-border p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-harvest" />
                <h4 className="text-sm font-bold text-foreground uppercase tracking-wider">Import Target</h4>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => { setTargetMode('auto'); setSelectedTargetId(''); }}
                  className={`flex-1 px-4 py-2.5 rounded-xl border-2 font-semibold text-sm transition-all ${
                    targetMode === 'auto'
                      ? 'border-harvest bg-harvest/10 text-harvest'
                      : 'border-border text-muted-foreground hover:border-harvest/40'
                  }`}
                >
                  New from CSV
                </button>
                <button
                  type="button"
                  onClick={() => setTargetMode('existing')}
                  className={`flex-1 px-4 py-2.5 rounded-xl border-2 font-semibold text-sm transition-all ${
                    targetMode === 'existing'
                      ? 'border-harvest bg-harvest/10 text-harvest'
                      : 'border-border text-muted-foreground hover:border-harvest/40'
                  }`}
                >
                  Into Existing Tournament
                </button>
              </div>

              {targetMode === 'auto' && (
                <p className="text-xs text-muted-foreground">
                  The tournament name, type, and dates will be read from the overview CSV.
                  A new tournament record will be created automatically.
                </p>
              )}

              {targetMode === 'existing' && (
                <div className="space-y-2">
                  {loadingTournaments ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading tournaments...
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <select
                          value={selectedTargetId}
                          onChange={(e) => setSelectedTargetId(e.target.value)}
                          className="w-full appearance-none bg-input-background border-2 border-border rounded-xl px-4 py-2.5 pr-10 text-sm font-semibold text-foreground focus:outline-none focus:border-harvest/50 transition-colors cursor-pointer"
                        >
                          <option value="">Select a tournament...</option>
                          {existingTournaments.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.status})
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        CSV data (teams, matches, stats) will be imported into the selected tournament.
                        The tournament's metadata will be updated from the overview CSV.
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Drop zone for all files */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-harvest/30 rounded-xl sm:rounded-2xl p-4 sm:p-8 bg-harvest/5 hover:bg-harvest/10 transition-all text-center"
            >
              <FolderOpen className="w-10 h-10 sm:w-14 sm:h-14 text-harvest/40 mx-auto mb-2 sm:mb-3" />
              <p className="text-sm sm:text-base font-bold text-foreground mb-1">
                Drop all 6 CSV files here
              </p>
              <p className="text-[10px] sm:text-xs text-muted-foreground mb-3">
                Files are auto-detected by name (overview, staff, teams, players, matches, player_match_stats)
              </p>
              <div className="flex items-center justify-center gap-2 sm:gap-3">
                <button
                  onClick={() => multiFileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 bg-harvest text-white rounded-xl text-xs sm:text-sm font-bold hover:bg-harvest/90 transition-all shadow-sm"
                >
                  <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Select Files
                </button>
                <button
                  onClick={() => folderInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 bg-card text-foreground rounded-xl text-xs sm:text-sm font-semibold border-2 border-border hover:border-harvest/30 transition-all"
                >
                  <FolderOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Select Folder
                </button>
              </div>
              {/* Hidden inputs */}
              <input
                ref={multiFileInputRef}
                type="file"
                accept=".csv"
                multiple
                className="hidden"
                onChange={(e) => { if (e.target.files) processFiles(e.target.files); e.target.value = ''; }}
              />
              <input
                ref={folderInputRef}
                type="file"
                /* @ts-ignore - webkitdirectory is non-standard but widely supported */
                webkitdirectory=""
                directory=""
                multiple
                className="hidden"
                onChange={(e) => { if (e.target.files) processFiles(e.target.files); e.target.value = ''; }}
              />
            </div>

            {/* File slots grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              {CSV_SLOT_META.map((slot) => {
                const file = files[slot.key];
                const SlotIcon = slot.icon;
                return (
                  <div
                    key={slot.key}
                    className={`rounded-xl border-2 p-2.5 sm:p-3 transition-all ${
                      file ? 'border-harvest/40 bg-harvest/5' : 'border-border bg-card'
                    }`}
                  >
                    {file ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-harvest flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] sm:text-xs font-bold text-foreground truncate">{slot.label}</p>
                          <p className="text-[9px] sm:text-[10px] text-harvest font-semibold">{file.rowCount} rows</p>
                        </div>
                        <button onClick={() => clearFile(slot.key)} className="text-red-400 hover:text-red-600 flex-shrink-0">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <SlotIcon className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground/40 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] sm:text-xs font-semibold text-muted-foreground">{slot.label}</p>
                          <p className="text-[8px] sm:text-[9px] text-muted-foreground/60">Click to upload</p>
                        </div>
                        <input
                          type="file"
                          accept=".csv"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleSingleFileUpload(slot.key, f);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action bar */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-card border-2 border-border text-foreground hover:border-harvest/30 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <div className="flex-1 text-right">
                <span className="text-xs sm:text-sm font-semibold text-muted-foreground mr-3">
                  {uploadedCount}/6 files
                </span>
              </div>
              <button
                onClick={handlePreview}
                disabled={!allFilesUploaded || loading || (targetMode === 'existing' && !selectedTargetId)}
                className={`flex items-center gap-1.5 px-5 sm:px-8 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  allFilesUploaded && !(targetMode === 'existing' && !selectedTargetId)
                    ? 'bg-harvest hover:bg-harvest/90 text-white shadow-md'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                }`}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                Preview
              </button>
            </div>
          </div>
        )}

        {/* ═══════ STEP 2: PREVIEW ═══════ */}
        {step === 'preview' && preview && (
          <div className="space-y-3 sm:space-y-4">
            {/* Target info banner */}
            {targetMode === 'existing' && selectedTargetName && (
              <div className="bg-[#3b82f6]/10 border-2 border-[#3b82f6]/20 rounded-xl p-3 sm:p-4 flex items-center gap-3">
                <Link2 className="w-5 h-5 text-[#3b82f6] flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-foreground">Importing into: {selectedTargetName}</p>
                  <p className="text-xs text-muted-foreground">Data from the CSV will be attached to this existing tournament record.</p>
                </div>
              </div>
            )}

            {/* Tournament info */}
            <div className="bg-card rounded-xl border-2 border-border p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-bold text-foreground mb-3">{preview.tournament_name}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                <InfoPill label="Type" value={preview.is_1v1 ? 'Heaps n Hooks (1v1)' : 'Kernel Kup (5v5)'} />
                <InfoPill label="Status" value={preview.status} />
                <InfoPill label="Dates" value={`${preview.start_date} — ${preview.end_date}`} />
                <InfoPill label="Winner" value={preview.winning_team} highlight />
                <InfoPill label="Prize Pool" value={`$${preview.prize_pool}`} />
                {preview.popd_kernel_1 && <InfoPill label="Pop'd Kernel" value={preview.popd_kernel_1} highlight />}
                {preview.popd_kernel_2 && <InfoPill label="Pop'd Kernel #2" value={preview.popd_kernel_2} highlight />}
              </div>
              {preview.description && (
                <p className="text-xs text-muted-foreground mt-3 italic">{preview.description}</p>
              )}
            </div>

            {/* Counts */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[
                { label: 'Persons', count: preview.counts.unique_persons, icon: Users },
                { label: 'Staff', count: preview.counts.staff, icon: Shield },
                { label: 'Teams', count: preview.counts.teams, icon: Users },
                { label: 'Players', count: preview.counts.players, icon: Users },
                { label: 'Matches', count: preview.counts.matches, icon: Swords },
                { label: 'Stats', count: preview.counts.player_match_stats, icon: BarChart3 },
              ].map(item => (
                <div key={item.label} className="bg-card rounded-xl border-2 border-border p-2 sm:p-3 text-center">
                  <item.icon className="w-4 h-4 sm:w-5 sm:h-5 text-harvest mx-auto mb-1" />
                  <p className="text-lg sm:text-xl font-bold text-foreground">{item.count}</p>
                  <p className="text-[9px] sm:text-xs text-muted-foreground font-medium">{item.label}</p>
                </div>
              ))}
            </div>

            {/* Teams list */}
            <div className="bg-card rounded-xl border-2 border-border p-3 sm:p-4">
              <h4 className="text-xs sm:text-sm font-bold text-foreground mb-2">Teams</h4>
              <div className="space-y-1">
                {preview.teams.map((team, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs sm:text-sm py-1 border-b border-border last:border-0">
                    <span className="font-mono text-[9px] sm:text-[10px] text-harvest w-16 sm:w-20 truncate flex-shrink-0">{team.valve_team_id || 'auto-uuid'}</span>
                    <span className="font-semibold text-foreground flex-1 min-w-0 truncate">{team.name}</span>
                    <span className="text-muted-foreground text-[10px] sm:text-xs flex-shrink-0">[{team.tag}]</span>
                    <span className="text-muted-foreground text-[9px] sm:text-[10px] flex-shrink-0">Capt: {team.captain}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Persons list (collapsed) */}
            <details className="bg-card rounded-xl border-2 border-border">
              <summary className="p-3 sm:p-4 cursor-pointer text-xs sm:text-sm font-bold text-foreground hover:text-harvest transition-colors">
                All {preview.counts.unique_persons} Persons (click to expand)
              </summary>
              <div className="px-3 sm:px-4 pb-3 sm:pb-4 max-h-60 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5">
                  {preview.persons.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs py-0.5">
                      <span className="font-mono text-harvest text-[10px] w-20 flex-shrink-0">{p.steam_id}</span>
                      <span className="text-foreground truncate">{p.display_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </details>

            {/* Already exists warning (only in auto mode) */}
            {targetMode === 'auto' && preview.already_exists && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-800 rounded-xl p-3 sm:p-4 flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Tournament already exists!</p>
                  <p className="text-xs text-amber-600 dark:text-amber-300">
                    "{preview.tournament_name}" (ID: {preview.existing_id?.slice(0, 8)}...) is already in the database.
                  </p>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={forceImport}
                      onChange={(e) => setForceImport(e.target.checked)}
                      className="rounded border-amber-300 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Force reimport (deletes existing data first)</span>
                  </label>
                </div>
              </div>
            )}

            {/* Force option for existing tournament mode */}
            {targetMode === 'existing' && (
              <div className="bg-card rounded-xl border-2 border-border p-3 sm:p-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forceImport}
                    onChange={(e) => setForceImport(e.target.checked)}
                    className="rounded border-border text-harvest focus:ring-harvest"
                  />
                  <span className="text-xs font-semibold text-foreground">Clear existing child data first (teams, matches, stats)</span>
                </label>
                <p className="text-[10px] text-muted-foreground mt-1 ml-6">
                  Check this if the tournament already has CSV-imported data you want to replace.
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setStep('upload')}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-card border-2 border-border text-foreground hover:border-harvest/30 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={handleImport}
                disabled={targetMode === 'auto' && preview.already_exists && !forceImport}
                className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  targetMode === 'auto' && preview.already_exists && !forceImport
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'bg-harvest hover:bg-harvest/90 text-white shadow-md'
                }`}
              >
                <Rocket className="w-4 h-4" />
                Import {selectedTargetName || preview.tournament_name}
              </button>
            </div>
          </div>
        )}

        {/* ═══════ STEP 3: IMPORTING ═══════ */}
        {step === 'importing' && (
          <div className="bg-card rounded-2xl border-2 border-border p-8 sm:p-12 text-center">
            <Loader2 className="w-12 h-12 sm:w-16 sm:h-16 animate-spin text-harvest mx-auto mb-4" />
            <h3 className="text-lg sm:text-xl font-bold text-foreground mb-2">
              Importing...
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Upserting persons, creating teams, inserting matches & stats...
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-2">
              This may take 10–30 seconds depending on tournament size.
            </p>
          </div>
        )}

        {/* ═══════ STEP 4: RESULT ═══════ */}
        {step === 'result' && result && (
          <div className="space-y-3 sm:space-y-4">
            {/* Success/error banner */}
            <div className={`rounded-xl border-2 p-4 sm:p-6 ${
              result.error_count === 0 ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800' : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800'
            }`}>
              <div className="flex items-center gap-3 mb-3">
                {result.error_count === 0 ? (
                  <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-green-500" />
                ) : (
                  <AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10 text-amber-500" />
                )}
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-foreground">
                    {result.error_count === 0 ? 'Import Successful!' : 'Import Completed with Warnings'}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {result.tournament_name} &middot; ID: {result.tournament_id?.slice(0, 8)}...
                  </p>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 sm:gap-2 mt-4">
                {[
                  { label: 'Persons', value: result.stats.persons_upserted },
                  { label: 'Staff', value: result.stats.staff_inserted },
                  { label: 'Teams', value: result.stats.teams_inserted },
                  { label: 'Rosters', value: result.stats.rosters_inserted },
                  { label: 'Matches', value: result.stats.matches_inserted },
                  { label: 'Stats', value: result.stats.player_stats_inserted },
                  { label: 'Errors', value: result.error_count },
                ].map(item => (
                  <div key={item.label} className={`rounded-lg p-2 text-center ${
                    item.label === 'Errors' && item.value > 0 ? 'bg-red-100 dark:bg-red-950/50' : 'bg-card/70'
                  }`}>
                    <p className={`text-base sm:text-lg font-bold ${
                      item.label === 'Errors' && item.value > 0 ? 'text-red-600' : 'text-foreground'
                    }`}>{item.value}</p>
                    <p className="text-[8px] sm:text-[10px] text-muted-foreground font-medium">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Import log */}
            <details className="bg-card rounded-xl border-2 border-border">
              <summary className="p-3 sm:p-4 cursor-pointer text-xs sm:text-sm font-bold text-foreground hover:text-harvest transition-colors">
                Import Log ({result.log.length} entries)
              </summary>
              <div className="px-3 sm:px-4 pb-3 sm:pb-4 max-h-48 overflow-y-auto">
                {result.log.map((entry, i) => (
                  <p key={i} className="text-[10px] sm:text-xs text-muted-foreground font-mono py-0.5">{entry}</p>
                ))}
              </div>
            </details>

            {/* Errors log */}
            {result.errors && result.errors.length > 0 && (
              <details className="bg-red-50 dark:bg-red-950/30 rounded-xl border-2 border-red-200 dark:border-red-800">
                <summary className="p-3 sm:p-4 cursor-pointer text-xs sm:text-sm font-bold text-red-700 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors">
                  Errors ({result.errors.length})
                </summary>
                <div className="px-3 sm:px-4 pb-3 sm:pb-4 max-h-48 overflow-y-auto">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-[10px] sm:text-xs text-red-600 dark:text-red-300 font-mono py-0.5">{err}</p>
                  ))}
                </div>
              </details>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <button
                onClick={resetForAnother}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-harvest hover:bg-harvest/90 text-white shadow-md transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Import Another
              </button>
              <button
                onClick={onBack}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-card border-2 border-border text-foreground hover:border-harvest/30 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Profile
              </button>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

/** Small info display pill */
function InfoPill({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-2 ${highlight ? 'bg-harvest/10 border border-harvest/20' : 'bg-muted'}`}>
      <p className="text-[9px] sm:text-[10px] text-muted-foreground font-medium uppercase">{label}</p>
      <p className={`text-xs sm:text-sm font-semibold truncate ${highlight ? 'text-harvest' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}
