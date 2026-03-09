import { PREFIX, setCoachAssignment } from "./helpers.ts";
import * as kv from "./kv_store.tsx";
import { createAdminLog } from "./routes-notifications.ts";

// Steam32 → Steam64 conversion constant
const STEAM_64_OFFSET = BigInt('76561197960265728');

// ── CSV Parser ──────────────────────────────────────────────────────
function parseCSV(csvText: string): Record<string, string | null>[] {
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const rows: Record<string, string | null>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    // Skip empty lines and separator rows (all commas or whitespace)
    if (!line || /^[,\s]*$/.test(line)) continue;

    const values = parseCsvLine(line);
    const row: Record<string, string | null> = {};
    for (let j = 0; j < headers.length; j++) {
      const val = (values[j] ?? '').trim();
      row[headers[j].trim()] = (val === '' || val.toLowerCase() === 'null') ? null : val;
    }
    rows.push(row);
  }

  return rows;
}

/** Parse a single CSV line, handling quoted fields */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

/** Convert MM/DD/YYYY to YYYY-MM-DD (ISO date) */
function parseDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, month, day, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return dateStr; // Already ISO or unexpected format
}

/** Parse a number, returning null for non-numeric strings */
function parseNum(val: string | null): number | null {
  if (val === null || val === '') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

/** Parse an integer, returning a default if non-numeric */
function parseInt0(val: string | null): number {
  if (val === null || val === '') return 0;
  const n = parseInt(val, 10);
  return isNaN(n) ? 0 : n;
}

export function registerCsvImportRoutes(app: Hono, supabase: any, anonSupabase: any) {

  // ── Helper: require owner ──
  async function requireOwner(c: any) {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) return null;
    const { data: { user: authUser }, error } = await anonSupabase.auth.getUser(accessToken);
    if (error || !authUser) return null;
    const { data: dbUser } = await supabase.from('users').select('role').eq('supabase_id', authUser.id).single();
    if (!dbUser || dbUser.role !== 'owner') return null;
    return authUser;
  }

  /**
   * POST /kkup/csv-import
   * Body: { overview_csv, staff_csv, teams_csv, players_csv, matches_csv, stats_csv, force?: boolean, target_tournament_id?: string }
   */
  app.post(`${PREFIX}/kkup/csv-import`, async (c) => {
    try {
      const authUser = await requireOwner(c);
      if (!authUser) return c.json({ error: 'Owner access required' }, 403);

      const body = await c.req.json();
      const { overview_csv, staff_csv, teams_csv, players_csv, matches_csv, stats_csv, force = false, target_tournament_id = null } = body;

      if (!overview_csv || !staff_csv || !teams_csv || !players_csv || !matches_csv || !stats_csv) {
        return c.json({ error: 'All 6 CSV strings are required (overview, staff, teams, players, matches, stats)' }, 400);
      }

      const log: string[] = [];
      const errors: string[] = [];
      const stats = {
        persons_upserted: 0,
        tournament_created: false,
        staff_inserted: 0,
        teams_inserted: 0,
        rosters_inserted: 0,
        matches_inserted: 0,
        player_stats_inserted: 0,
      };

      // ── STEP 0: Parse all CSVs ──
      log.push('Parsing CSVs...');
      const overviewRows = parseCSV(overview_csv);
      const staffRows = parseCSV(staff_csv);
      const teamRows = parseCSV(teams_csv);
      const playerRows = parseCSV(players_csv);
      const matchRows = parseCSV(matches_csv);
      const statsRows = parseCSV(stats_csv);

      if (overviewRows.length === 0) return c.json({ error: 'Overview CSV is empty or invalid' }, 400);

      const overview = overviewRows[0];
      const tournamentName = overview.name || 'Unknown Tournament';
      const tournamentType = overview.tournament_type || 'kernel_kup';
      const is1v1 = tournamentType === 'heaps_n_hooks';

      log.push(`Tournament: ${tournamentName} (${tournamentType})`);
      log.push(`Parsed: ${staffRows.length} staff, ${teamRows.length} teams, ${playerRows.length} players, ${matchRows.length} matches, ${statsRows.length} stats`);

      // ── Check for existing tournament ──
      // If target_tournament_id is provided, we're importing INTO an existing tournament
      let tournamentId: string;

      if (target_tournament_id) {
        // Verify the target tournament exists
        const { data: targetTournament, error: targetErr } = await supabase
          .from('kkup_tournaments').select('id, name')
          .eq('id', target_tournament_id).maybeSingle();

        if (targetErr || !targetTournament) {
          return c.json({ error: `Target tournament not found: ${target_tournament_id}` }, 404);
        }

        log.push(`Importing into existing tournament: "${targetTournament.name}" (${target_tournament_id})`);

        if (force) {
          // Delete existing child data (teams, matches, etc.) but keep the tournament record
          log.push('Force mode: clearing existing child data...');
          const { data: existingTeams } = await supabase
            .from('kkup_teams').select('id').eq('tournament_id', target_tournament_id);
          const existingTeamIds = (existingTeams || []).map((t: any) => t.id);

          if (existingTeamIds.length > 0) {
            await supabase.from('kkup_coach_assignments').delete().in('team_id', existingTeamIds);
            await supabase.from('kkup_team_invites').delete().in('team_id', existingTeamIds);
            await supabase.from('kkup_team_rosters').delete().in('team_id', existingTeamIds);
          }
          // Delete matches + stats for this tournament
          const { data: existingMatches } = await supabase
            .from('kkup_matches').select('id').eq('tournament_id', target_tournament_id);
          const existingMatchIds = (existingMatches || []).map((m: any) => m.id);
          if (existingMatchIds.length > 0) {
            await supabase.from('kkup_player_match_stats').delete().in('match_id', existingMatchIds);
          }
          await supabase.from('kkup_matches').delete().eq('tournament_id', target_tournament_id);
          await supabase.from('kkup_teams').delete().eq('tournament_id', target_tournament_id);
          await supabase.from('kkup_tournament_staff').delete().eq('tournament_id', target_tournament_id);
          log.push('Existing child data cleared');
        }

        // Update the tournament metadata from the overview CSV
        const tournamentUpdates: any = {
          tournament_type: tournamentType,
          status: overview.status || 'completed',
          winning_team_name: overview.winning_team_name || null,
          staff_count: parseNum(overview.staff_count),
          team_count: parseNum(overview.team_count),
          player_count: parseNum(overview.player_count),
          match_count: parseNum(overview.match_count),
          player_match_stats_count: parseNum(overview.player_match_stats_count),
        };
        // Only overwrite these if the CSV provides them (don't wipe existing data)
        if (overview.description) tournamentUpdates.description = overview.description;
        if (overview.league_id) tournamentUpdates.league_id = overview.league_id;
        if (overview.tournament_start_date) tournamentUpdates.tournament_start_date = parseDate(overview.tournament_start_date);
        if (overview.tournament_end_date) tournamentUpdates.tournament_end_date = parseDate(overview.tournament_end_date);
        if (overview.prize_pool) tournamentUpdates.prize_pool = parseNum(overview.prize_pool);

        await supabase.from('kkup_tournaments').update(tournamentUpdates).eq('id', target_tournament_id);
        tournamentId = target_tournament_id;
        stats.tournament_created = false;
        log.push(`Updated existing tournament metadata`);
      } else {
        // Original behavior: create a new tournament from the CSV
        const { data: existingTournament } = await supabase
          .from('kkup_tournaments').select('id, name')
          .eq('name', tournamentName).maybeSingle();

        if (existingTournament && !force) {
          return c.json({
            error: `Tournament "${tournamentName}" already exists (ID: ${existingTournament.id}). Use force=true to delete and reimport.`,
            existing_id: existingTournament.id,
          }, 409);
        }

        if (existingTournament && force) {
          log.push(`Force mode: deleting existing tournament "${tournamentName}" (${existingTournament.id})`);
          const { error: delError } = await supabase
            .from('kkup_tournaments').delete().eq('id', existingTournament.id);
          if (delError) {
            errors.push(`Failed to delete existing tournament: ${delError.message}`);
            return c.json({ error: 'Failed to delete existing tournament', details: delError.message, log }, 500);
          }
          log.push('Existing tournament deleted successfully');
        }

        // ── STEP 3: Insert tournament ──
        log.push('Creating tournament...');
        const { data: tournament, error: tournamentError } = await supabase
          .from('kkup_tournaments')
          .insert({
            league_id: overview.league_id || null,
            name: tournamentName,
            tournament_type: tournamentType,
            status: overview.status || 'completed',
            description: overview.description || null,
            registration_start_date: parseDate(overview.registration_start_date),
            registration_end_date: parseDate(overview.registration_end_date),
            tournament_start_date: parseDate(overview.tournament_start_date),
            tournament_end_date: parseDate(overview.tournament_end_date),
            youtube_url: overview.youtube_url || null,
            twitch_url_1: overview.twitch_url_1 || null,
            twitch_url_2: overview.twitch_url_2 || null,
            winning_team_name: overview.winning_team_name || null,
            staff_count: parseNum(overview.staff_count),
            team_count: parseNum(overview.team_count),
            player_count: parseNum(overview.player_count),
            match_count: parseNum(overview.match_count),
            player_match_stats_count: parseNum(overview.player_match_stats_count),
            prize_pool: parseNum(overview.prize_pool) ?? 0,
          })
          .select('id').single();

        if (tournamentError || !tournament) {
          return c.json({
            error: 'Failed to create tournament',
            details: tournamentError?.message,
            log,
          }, 500);
        }

        tournamentId = tournament.id;
        stats.tournament_created = true;
        log.push(`Tournament created: ${tournamentId}`);
      }

      // ── STEP 4: Insert staff ──
      log.push('Inserting staff...');
      for (const row of staffRows) {
        if (!row.steam_id) continue;
        const personId = personIdMap.get(row.steam_id);
        if (!personId) { errors.push(`Staff person not found for steam_id ${row.steam_id}`); continue; }

        const { error: staffError } = await supabase
          .from('kkup_tournament_staff')
          .insert({
            tournament_id: tournamentId,
            person_id: personId,
            role: row.role || 'Unknown',
          });

        if (staffError) {
          errors.push(`Staff insert error for ${row.staff_name}: ${staffError.message}`);
        } else {
          stats.staff_inserted++;
        }
      }
      log.push(`Inserted ${stats.staff_inserted} staff entries`);

      // ── STEP 5: Insert teams ──
      log.push('Inserting teams...');
      // Two maps for resolving teams later:
      const teamByValveId = new Map<string, string>(); // valve_team_id → kkup_teams.id
      const teamByName = new Map<string, string>();     // team_name → kkup_teams.id (fallback for null valve IDs)

      for (const row of teamRows) {
        const captainPersonId = row.team_captain_id ? personIdMap.get(row.team_captain_id) : null;
        const coachPersonId = row.team_coach_id ? personIdMap.get(row.team_coach_id) : null;

        const { data: team, error: teamError } = await supabase
          .from('kkup_teams')
          .insert({
            tournament_id: tournamentId,
            valve_team_id: row.team_id || null,
            team_name: row.team_name || 'Unknown Team',
            team_tag: row.team_tag || null,
            captain_person_id: captainPersonId || null,
            coach_person_id: coachPersonId || null,
          })
          .select('id').single();

        if (teamError) {
          errors.push(`Team insert error for ${row.team_name}: ${teamError.message}`);
        } else if (team) {
          stats.teams_inserted++;
          if (row.team_id) teamByValveId.set(row.team_id, team.id);
          teamByName.set(row.team_name || '', team.id);
          // Dual-write coach assignment to kkup_coach_assignments (non-critical)
          if (coachPersonId) {
            try { await setCoachAssignment(supabase, team.id, coachPersonId, tournamentId); }
            catch (coachErr) { console.error(`Non-critical: coach assignment dual-write for CSV team ${row.team_name} failed:`, coachErr); }
          }
        }
      }
      log.push(`Inserted ${stats.teams_inserted} teams`);

      // ── STEP 5b: Match team logos from storage bucket ──
      log.push('Matching team logos from kkup-assets storage bucket...');
      let logosMatched = 0;
      let logosFallbackSteam = 0;
      try {
        const { data: logoFiles, error: listError } = await supabase.storage
          .from('make-4789f4af-kkup-assets')
          .list('team_logos', { limit: 500, sortBy: { column: 'name', order: 'asc' } });

        if (listError) {
          errors.push(`Failed to list team_logos folder: ${listError.message}`);
        } else if (logoFiles && logoFiles.length > 0) {
          // Build a lookup of normalized filename → full path + public URL
          const normalize = (s: string): string =>
            s.toLowerCase().trim()
              .replace(/\.[^.]+$/, '')        // strip file extension
              .replace(/[_\-]+/g, ' ')         // underscores/hyphens → spaces
              .replace(/\s+/g, ' ')            // collapse whitespace
              .replace(/[^a-z0-9 ]/g, '');     // strip special chars

          const logoLookup = new Map<string, string>(); // normalized name → public URL
          for (const file of logoFiles) {
            if (!file.name || !file.name.includes('.')) continue; // skip folders
            const fullPath = `team_logos/${file.name}`;
            const { data: urlData } = supabase.storage
              .from('make-4789f4af-kkup-assets')
              .getPublicUrl(fullPath);
            if (urlData?.publicUrl) {
              logoLookup.set(normalize(file.name), urlData.publicUrl);
            }
          }
          log.push(`Found ${logoLookup.size} logo files in storage bucket`);

          // For each team, try to match by team_name then team_tag
          for (const row of teamRows) {
            const teamName = row.team_name || '';
            const teamTag = row.team_tag || '';
            const teamDbId = teamByName.get(teamName) || (row.team_id ? teamByValveId.get(row.team_id) : null);
            if (!teamDbId) continue;

            const normalizedName = normalize(teamName);
            const normalizedTag = normalize(teamTag);

            let matchedUrl: string | null = null;

            // Try exact normalized match on team name
            if (logoLookup.has(normalizedName)) {
              matchedUrl = logoLookup.get(normalizedName)!;
            }
            // Try exact normalized match on team tag
            else if (normalizedTag && logoLookup.has(normalizedTag)) {
              matchedUrl = logoLookup.get(normalizedTag)!;
            }
            // Try partial match: logo filename contains team name or vice versa
            else {
              for (const [normalizedFile, url] of logoLookup.entries()) {
                if (normalizedFile.includes(normalizedName) || normalizedName.includes(normalizedFile)) {
                  matchedUrl = url;
                  break;
                }
                if (normalizedTag && (normalizedFile.includes(normalizedTag) || normalizedTag.includes(normalizedFile))) {
                  matchedUrl = url;
                  break;
                }
              }
            }

            if (matchedUrl) {
              const { error: logoUpdateError } = await supabase
                .from('kkup_teams').update({ logo_url: matchedUrl }).eq('id', teamDbId);
              if (logoUpdateError) {
                errors.push(`Logo update error for ${teamName}: ${logoUpdateError.message}`);
              } else {
                logosMatched++;
                log.push(`  Logo matched: "${teamName}" -> ${matchedUrl.split('/').pop()}`);
              }
            }
            // Fallback: Steam CDN for teams with valve_team_id (only if no bucket match)
            else if (row.team_id && /^\d+$/.test(row.team_id)) {
              const steamLogoUrl = `https://steamcdn-a.akamaihd.net/apps/dota2/images/team_logos/${row.team_id}.png`;
              const { error: steamLogoError } = await supabase
                .from('kkup_teams').update({ logo_url: steamLogoUrl }).eq('id', teamDbId);
              if (!steamLogoError) {
                logosFallbackSteam++;
                log.push(`  Steam CDN fallback: "${teamName}" (valve_id: ${row.team_id})`);
              }
            }
          }
        } else {
          log.push('No files found in team_logos folder');
        }
      } catch (e: any) {
        errors.push(`Team logo matching error: ${e.message}`);
      }
      log.push(`Team logos: ${logosMatched} matched from bucket, ${logosFallbackSteam} from Steam CDN, ${stats.teams_inserted - logosMatched - logosFallbackSteam} unmatched`);

      // ── Helper: resolve team by valve_id or name ──
      function resolveTeamId(valveTeamId: string | null, teamName: string | null): string | null {
        if (valveTeamId && teamByValveId.has(valveTeamId)) return teamByValveId.get(valveTeamId)!;
        if (teamName && teamByName.has(teamName)) return teamByName.get(teamName)!;
        return null;
      }

      // ── STEP 6: Insert team rosters ──
      log.push('Inserting team rosters...');
      for (const row of playerRows) {
        if (!row.steam_id) continue;
        const personId = personIdMap.get(row.steam_id);
        if (!personId) { errors.push(`Roster person not found for steam_id ${row.steam_id}`); continue; }

        const teamId = resolveTeamId(row.team_id, row.team_name);
        if (!teamId) { errors.push(`Roster team not found for ${row.team_name} (valve_id: ${row.team_id})`); continue; }

        const { error: rosterError } = await supabase
          .from('kkup_team_rosters')
          .insert({
            team_id: teamId,
            person_id: personId,
          });

        if (rosterError) {
          // Duplicate is OK (UNIQUE constraint)
          if (!rosterError.message.includes('duplicate')) {
            errors.push(`Roster insert error for ${row.player_name}: ${rosterError.message}`);
          }
        } else {
          stats.rosters_inserted++;
        }
      }
      log.push(`Inserted ${stats.rosters_inserted} roster entries`);

      // ── STEP 7: Insert matches ──
      log.push('Inserting matches...');
      const matchIdMap = new Map<string, string>(); // external_match_id → kkup_matches.id

      for (const row of matchRows) {
        if (!row.match_id) continue;

        const radiantTeamId = resolveTeamId(row.radiant_team_id, row.radiant_team_name);
        const direTeamId = resolveTeamId(row.dire_team_id, row.dire_team_name);
        const winningTeamId = resolveTeamId(row.winning_team_id, row.winning_team_name);

        // 1v1 person IDs (KK9 only)
        const radiantPersonId = is1v1 && row.radiant_player_id
          ? personIdMap.get(row.radiant_player_id) : null;
        const direPersonId = is1v1 && row.dire_player_id
          ? personIdMap.get(row.dire_player_id) : null;

        const { data: match, error: matchError } = await supabase
          .from('kkup_matches')
          .insert({
            tournament_id: tournamentId,
            series_id: row.series_id || null,
            external_match_id: row.match_id,
            game_mode: row.game_mode || null,
            radiant_team_id: radiantTeamId,
            radiant_team_score: parseNum(row.radiant_team_score),
            dire_team_id: direTeamId,
            dire_team_score: parseNum(row.dire_team_score),
            radiant_person_id: radiantPersonId,
            dire_person_id: direPersonId,
            match_length: parseNum(row.match_length),
            match_time: row.match_time || null,
            match_date: parseDate(row.match_date),
            winning_team_id: winningTeamId,
          })
          .select('id').single();

        if (matchError) {
          errors.push(`Match insert error for match_id ${row.match_id}: ${matchError.message}`);
        } else if (match) {
          stats.matches_inserted++;
          matchIdMap.set(row.match_id, match.id);
        }
      }
      log.push(`Inserted ${stats.matches_inserted} matches`);

      // ── STEP 8: Insert player match stats ──
      log.push('Inserting player match stats...');
      for (const row of statsRows) {
        if (!row.match_id || !row.player_id) continue;

        const matchDbId = matchIdMap.get(row.match_id);
        if (!matchDbId) { errors.push(`Stats: match not found for external_match_id ${row.match_id}`); continue; }

        const personId = personIdMap.get(row.player_id);
        if (!personId) { errors.push(`Stats: person not found for steam_id ${row.player_id}`); continue; }

        const teamId = resolveTeamId(row.team_id, row.team_name);
        if (!teamId) { errors.push(`Stats: team not found for ${row.team_name} (valve_id: ${row.team_id})`); continue; }

        const { error: statError } = await supabase
          .from('kkup_player_match_stats')
          .insert({
            match_id: matchDbId,
            person_id: personId,
            team_id: teamId,
            hero: row.hero || null,
            kills: parseInt0(row.kills),
            deaths: parseInt0(row.deaths),
            assists: parseInt0(row.assists),
            net_worth: parseNum(row.net_worth),
            last_hits: parseNum(row.last_hits),
            denies: parseNum(row.denies),
            gpm: parseNum(row.gpm),
            xpm: parseNum(row.xpm),
          });

        if (statError) {
          if (!statError.message.includes('duplicate')) {
            errors.push(`Stats insert error for ${row.player_name} in match ${row.match_id}: ${statError.message}`);
          }
        } else {
          stats.player_stats_inserted++;
        }
      }
      log.push(`Inserted ${stats.player_stats_inserted} player match stats`);

      // ── STEP 8b: Detect stand-ins and add missing roster entries ──
      // A stand-in is a player who has match stats for a team but isn't in that team's roster.
      // This happens when a sub fills in for a missing player.
      log.push('Detecting stand-ins from match stats...');
      let standinsAdded = 0;
      try {
        // Get all existing roster entries for this tournament's teams
        const allTeamIds = [...new Set([...teamByValveId.values(), ...teamByName.values()])];
        const { data: existingRosters } = await supabase
          .from('kkup_team_rosters')
          .select('team_id, person_id')
          .in('team_id', allTeamIds);

        const rosterSet = new Set<string>();
        (existingRosters || []).forEach((r: any) => {
          rosterSet.add(`${r.team_id}:${r.person_id}`);
        });

        // Scan all player_match_stats for this tournament's matches
        const allMatchDbIds = Array.from(matchIdMap.values());
        if (allMatchDbIds.length > 0) {
          const { data: allStats } = await supabase
            .from('kkup_player_match_stats')
            .select('person_id, team_id')
            .in('match_id', allMatchDbIds);

          // Find unique person+team combos not in roster
          const missingRosterEntries = new Set<string>();
          (allStats || []).forEach((s: any) => {
            if (s.person_id && s.team_id) {
              const key = `${s.team_id}:${s.person_id}`;
              if (!rosterSet.has(key) && !missingRosterEntries.has(key)) {
                missingRosterEntries.add(key);
              }
            }
          });

          for (const key of missingRosterEntries) {
            const [teamId, personId] = key.split(':');
            const { error: standinError } = await supabase
              .from('kkup_team_rosters')
              .insert({ team_id: teamId, person_id: personId });

            if (standinError) {
              if (!standinError.message.includes('duplicate')) {
                errors.push(`Stand-in roster insert error: ${standinError.message}`);
              }
            } else {
              standinsAdded++;
              // Look up display name for logging
              let standinName = 'unknown';
              for (const [sid, name] of personsMap.entries()) {
                if (personIdMap.get(sid) === personId) {
                  standinName = name;
                  break;
                }
              }
              // Look up team name
              let standinTeamName = 'unknown team';
              for (const [tName, tId] of teamByName.entries()) {
                if (tId === teamId) { standinTeamName = tName; break; }
              }
              log.push(`  Stand-in detected: "${standinName}" added to "${standinTeamName}" roster`);
            }
          }
        }
      } catch (e: any) {
        errors.push(`Stand-in detection error: ${e.message}`);
      }
      log.push(`Stand-ins: ${standinsAdded} additional roster entries added from match stats`);

      // ── STEP 9: Update tournament with winning_team_id + popd_kernel person IDs ──
      log.push('Updating tournament with final references...');
      const winningTeamDbId = resolveTeamId(overview.winning_team_id, overview.winning_team_name);
      const popd1PersonId = overview.popd_kernel_1_player_id
        ? personIdMap.get(overview.popd_kernel_1_player_id) : null;
      const popd2PersonId = overview.popd_kernel_2_player_id
        ? personIdMap.get(overview.popd_kernel_2_player_id) : null;

      const updates: any = {};
      if (winningTeamDbId) updates.winning_team_id = winningTeamDbId;
      if (popd1PersonId) updates.popd_kernel_1_person_id = popd1PersonId;
      if (popd2PersonId) updates.popd_kernel_2_person_id = popd2PersonId;

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('kkup_tournaments').update(updates).eq('id', tournamentId);
        if (updateError) {
          errors.push(`Tournament update error: ${updateError.message}`);
        } else {
          log.push(`Updated tournament: winning_team=${!!winningTeamDbId}, popd1=${!!popd1PersonId}, popd2=${!!popd2PersonId}`);
        }
      }

      // ── STEP 10: Update tournaments_won for winning team players ──
      if (winningTeamDbId) {
        log.push('Updating tournaments_won for winning team players...');
        const { data: winningRoster } = await supabase
          .from('kkup_team_rosters').select('person_id')
          .eq('team_id', winningTeamDbId);

        if (winningRoster) {
          for (const rosterEntry of winningRoster) {
            // Read-then-write to increment tournaments_won
            const { data: person } = await supabase
              .from('kkup_persons').select('tournaments_won')
              .eq('id', rosterEntry.person_id).single();
            if (person) {
              await supabase.from('kkup_persons')
                .update({ tournaments_won: (person.tournaments_won || 0) + 1 })
                .eq('id', rosterEntry.person_id);
            }
          }
          log.push(`Updated tournaments_won for ${winningRoster.length} winning team players`);
        }
      }

      // ── STEP 11: Enrich player avatars via Steam Web API ──
      log.push('Enriching player avatars via Steam Web API...');
      const steamApiKey = Deno.env.get('STEAM_WEB_API_KEY');
      let avatarsFetched = 0;
      let avatarsSkipped = 0;

      if (steamApiKey) {
        // Collect numeric steam_ids that don't already have a cached avatar
        const numericSteamIds: string[] = [];
        for (const steamId of personsMap.keys()) {
          if (/^\d+$/.test(steamId)) {
            // Check if we already have a cached avatar for this person
            const existing = await kv.get(`kkup_avatar:${steamId}`);
            if (!existing) {
              numericSteamIds.push(steamId);
            } else {
              avatarsSkipped++;
            }
          }
        }

        log.push(`${numericSteamIds.length} players need avatar lookup (${avatarsSkipped} already cached)`);

        // Steam API accepts up to 100 steam64 IDs per call
        const BATCH_SIZE = 100;
        for (let i = 0; i < numericSteamIds.length; i += BATCH_SIZE) {
          const batch = numericSteamIds.slice(i, i + BATCH_SIZE);
          const steam64Ids = batch.map(id => (BigInt(id) + STEAM_64_OFFSET).toString());

          try {
            const steamUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${steamApiKey}&steamids=${steam64Ids.join(',')}`;
            const response = await fetch(steamUrl);

            if (response.ok) {
              const data = await response.json();
              const players = data?.response?.players || [];

              for (const player of players) {
                // Convert steam64 back to steam32 to use as key
                const steam32 = (BigInt(player.steamid) - STEAM_64_OFFSET).toString();
                const avatarUrl = player.avatarfull || player.avatarmedium || player.avatar || null;

                if (avatarUrl) {
                  await kv.set(`kkup_avatar:${steam32}`, {
                    avatar_url: avatarUrl,
                    personaname: player.personaname || null,
                    profileurl: player.profileurl || null,
                    fetched_at: new Date().toISOString(),
                  });
                  avatarsFetched++;
                }
              }
            } else {
              errors.push(`Steam API batch ${Math.floor(i / BATCH_SIZE) + 1} failed: ${response.status} ${response.statusText}`);
            }
          } catch (e: any) {
            errors.push(`Steam API batch error: ${e.message}`);
          }
        }

        log.push(`Fetched ${avatarsFetched} new avatars from Steam API`);
      } else {
        log.push('STEAM_WEB_API_KEY not set, skipping avatar enrichment');
      }

      // ── DONE ──
      const hasErrors = errors.length > 0;
      log.push(`Import ${hasErrors ? 'completed with errors' : 'completed successfully'}`);

      try { await createAdminLog({ type: 'csv_imported', action: `CSV imported "${tournamentName}" (${stats.teams_inserted} teams, ${stats.matches_inserted} matches, ${stats.player_stats_inserted} stats)`, actor_name: 'Owner' }); } catch (_) {}

      return c.json({
        success: true,
        tournament_id: tournamentId,
        tournament_name: tournamentName,
        stats,
        log,
        errors: errors.length > 0 ? errors : undefined,
        error_count: errors.length,
      });

    } catch (error: any) {
      console.error('CSV Import fatal error:', error);
      return c.json({ error: 'CSV Import failed: ' + error.message }, 500);
    }
  });

  /**
   * POST /kkup/csv-import/preview
   * Dry-run: parses CSVs and returns summary without inserting anything
   */
  app.post(`${PREFIX}/kkup/csv-import/preview`, async (c) => {
    try {
      const authUser = await requireOwner(c);
      if (!authUser) return c.json({ error: 'Owner access required' }, 403);

      const body = await c.req.json();
      const { overview_csv, staff_csv, teams_csv, players_csv, matches_csv, stats_csv } = body;

      const overviewRows = parseCSV(overview_csv || '');
      const staffRows = parseCSV(staff_csv || '');
      const teamRows = parseCSV(teams_csv || '');
      const playerRows = parseCSV(players_csv || '');
      const matchRows = parseCSV(matches_csv || '');
      const statsRows = parseCSV(stats_csv || '');

      const overview = overviewRows[0] || {};
      const tournamentType = overview.tournament_type || 'kernel_kup';
      const is1v1 = tournamentType === 'heaps_n_hooks';

      // Collect unique persons
      const personsMap = new Map<string, string>();
      for (const row of staffRows) { if (row.steam_id) personsMap.set(row.steam_id, row.staff_name || ''); }
      for (const row of playerRows) { if (row.steam_id) personsMap.set(row.steam_id, row.player_name || ''); }
      for (const row of teamRows) {
        if (row.team_captain_id) personsMap.set(row.team_captain_id, row.team_captain || '');
        if (row.team_coach_id) personsMap.set(row.team_coach_id, row.team_coach_name || '');
      }
      if (is1v1) {
        for (const row of matchRows) {
          if (row.radiant_player_id) personsMap.set(row.radiant_player_id, row.radiant_player_name || '');
          if (row.dire_player_id) personsMap.set(row.dire_player_id, row.dire_player_name || '');
        }
      }
      for (const row of statsRows) { if (row.player_id) personsMap.set(row.player_id, row.player_name || ''); }
      if (overview.popd_kernel_1_player_id) personsMap.set(overview.popd_kernel_1_player_id, overview.popd_kernel_1_player_name || '');
      if (overview.popd_kernel_2_player_id) personsMap.set(overview.popd_kernel_2_player_id, overview.popd_kernel_2_player_name || '');

      // Check if tournament already exists
      const tournamentName = overview.name || 'Unknown';
      const { data: existingTournament } = await supabase
        .from('kkup_tournaments').select('id, name')
        .eq('name', tournamentName).maybeSingle();

      return c.json({
        success: true,
        preview: {
          tournament_name: tournamentName,
          tournament_type: tournamentType,
          is_1v1: is1v1,
          status: overview.status || 'completed',
          description: overview.description || '',
          start_date: overview.tournament_start_date || '',
          end_date: overview.tournament_end_date || '',
          winning_team: overview.winning_team_name || 'TBD',
          popd_kernel_1: overview.popd_kernel_1_player_name || null,
          popd_kernel_2: overview.popd_kernel_2_player_name || null,
          prize_pool: overview.prize_pool || '0',
          counts: {
            unique_persons: personsMap.size,
            staff: staffRows.length,
            teams: teamRows.length,
            players: playerRows.length,
            matches: matchRows.length,
            player_match_stats: statsRows.length,
          },
          persons: Array.from(personsMap.entries()).map(([id, name]) => ({ steam_id: id, display_name: name })),
          teams: teamRows.map(t => ({ valve_team_id: t.team_id, name: t.team_name, tag: t.team_tag, captain: t.team_captain })),
          already_exists: !!existingTournament,
          existing_id: existingTournament?.id || null,
        },
      });

    } catch (error: any) {
      console.error('CSV Preview error:', error);
      return c.json({ error: 'Preview failed: ' + error.message }, 500);
    }
  });

}