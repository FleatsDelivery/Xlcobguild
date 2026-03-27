/**
 * KKUP Tools Routes -- enrich matches, sync names/logos, OpenDota import, fix hero names,
 * all-teams, storage listing, bulk logo update, link/unlink profiles, user stats, search, find-duplicates
 * 13 routes
 */
import type { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { PREFIX, getHeroName, getHeroIdFromName } from "./helpers.ts";
import { createAdminLog } from "./routes-notifications.ts";
import { normalizeToAccountId, steam32ToSteam64, getDotabuffUrl, getOpendotaUrl, getSteamProfileUrl } from "./steam-id-helpers.ts";

export function registerKkupToolsRoutes(app: Hono, supabase: any, anonSupabase: any) {

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

  // Enrich matches with OpenDota data (Owner only)
  app.post(`${PREFIX}/kkup/:kkup_id/enrich-matches`, async (c) => {
    try {
      if (!await requireOwner(c)) return c.json({ error: 'Owner access required' }, 403);

      const kkupId = c.req.param('kkup_id');
      const { data: matches, error: matchesError } = await supabase
        .from('kkup_matches').select('*').eq('tournament_id', kkupId).order('scheduled_time', { ascending: true });
      if (matchesError) return c.json({ error: 'Failed to fetch matches' }, 500);
      if (!matches || matches.length === 0) return c.json({ error: 'No matches found' }, 404);

      const apiKey = Deno.env.get('OPENDOTA_API_KEY');
      let enrichedCount = 0, skippedCount = 0, errorCount = 0;
      const errors: any[] = [];

      for (const match of matches) {
        try {
          if (!match.match_id) { skippedCount++; continue; }

          const res = await fetch(`https://api.opendota.com/api/matches/${match.match_id}?api_key=${apiKey}`);
          if (!res.ok) { errorCount++; errors.push({ match_id: match.match_id, error: `HTTP ${res.status}` }); continue; }
          const detail = await res.json();
          if (!detail || detail.error) { errorCount++; errors.push({ match_id: match.match_id, error: 'Not found on OpenDota' }); continue; }

          // Find or create teams
          let radiantTeam: any = null, direTeam: any = null;
          for (const [teamKey, teamData] of [['radiant_team', detail.radiant_team], ['dire_team', detail.dire_team]] as const) {
            if (!teamData) continue;
            const { data: existing } = await supabase.from('kkup_teams').select('*').eq('tournament_id', kkupId).eq('valve_team_id', teamData.team_id).maybeSingle();
            if (existing) { if (teamKey === 'radiant_team') radiantTeam = existing; else direTeam = existing; }
            else {
              const { data: newTeam } = await supabase.from('kkup_teams').insert({
                tournament_id: kkupId, team_name: teamData.name || 'Unknown', team_tag: teamData.tag,
                valve_team_id: teamData.team_id, logo_url: teamData.logo_url
              }).select().single();
              if (teamKey === 'radiant_team') radiantTeam = newTeam; else direTeam = newTeam;
            }
          }

          const winnerTeam = detail.radiant_win ? radiantTeam : direTeam;
          const team1Score = match.team1_id === radiantTeam?.id ? (detail.radiant_score || 0) : (detail.dire_score || 0);
          const team2Score = match.team2_id === radiantTeam?.id ? (detail.radiant_score || 0) : (detail.dire_score || 0);

          await supabase.from('kkup_matches').update({
            team1_score: team1Score, team2_score: team2Score, winner_team_id: winnerTeam?.id,
            radiant_win: detail.radiant_win, duration: detail.duration || 0,
            pick_bans_data: detail.picks_bans || null, opendota_fetched: true, opendota_fetched_at: new Date().toISOString(),
          }).eq('id', match.id);

          // Player stats
          for (const player of detail.players) {
            let profile: any = null;
            if (player.account_id) {
              const { data: existing } = await supabase.from('kkup_persons').select('*').eq('steam_id', String(player.account_id)).maybeSingle();
              if (existing) profile = existing;
              else {
                const { data: np } = await supabase.from('kkup_persons').insert({
                  steam_id: String(player.account_id), display_name: player.personaname || `Player ${player.account_id}`,
                  avatar_url: player.avatarfull,
                }).select().single();
                profile = np;
              }
            }

            const isRadiant = player.player_slot < 128;
            const teamId = isRadiant ? radiantTeam?.id : direTeam?.id;
            if (!teamId) continue;

            const statData = {
              match_id: match.id, team_id: teamId, person_id: profile?.id || null,
              hero_id: player.hero_id || 0,
              hero: getHeroName(player.hero_id || 0),
              kills: player.kills || 0, deaths: player.deaths || 0, assists: player.assists || 0,
              last_hits: player.last_hits || 0, denies: player.denies || 0,
              gpm: player.gold_per_min || 0, xpm: player.xp_per_min || 0,
              net_worth: player.net_worth || player.total_gold || 0,
            };

            const { data: existingStats } = await supabase.from('kkup_player_match_stats').select('*').eq('match_id', match.id).eq('person_id', profile?.id || null).maybeSingle();
            if (existingStats) await supabase.from('kkup_player_match_stats').update(statData).eq('id', existingStats.id);
            else await supabase.from('kkup_player_match_stats').insert(statData);
          }

          enrichedCount++;
          await new Promise(r => setTimeout(r, 200));
        } catch (e: any) { errorCount++; errors.push({ match_id: match.match_id, error: e.message }); }
      }

      const { data: t } = await supabase.from('kkup_tournaments').select('name').eq('id', kkupId).maybeSingle();
      try { await createAdminLog({ type: 'data_enrich', action: `Enriched ${enrichedCount}/${matches.length} matches for ${t?.name || kkupId} (${errorCount} errors)`, actor_name: 'Owner' }); } catch (_) {}

      return c.json({ success: true, enriched: enrichedCount, skipped: skippedCount, errors: errorCount, error_details: errors, message: `Enriched ${enrichedCount} out of ${matches.length} matches` });
    } catch (error: any) {
      console.error('Enrich matches error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // Sync player names & team logos (Owner only)
  app.post(`${PREFIX}/kkup/sync-names-logos`, async (c) => {
    try {
      if (!await requireOwner(c)) return c.json({ error: 'Owner access required' }, 403);

      let playersUpdated = 0, teamsUpdated = 0, usersUpdated = 0, masterTeamsUpdated = 0;
      const errors: string[] = [];

      // ═══════════════════════════════════════════════════════════════
      // PHASE 1: Sync Player Names & Avatars from Steam Web API
      // ═══════════════════════════════════════════════════════════════
      const { data: players } = await supabase.from('kkup_persons').select('id, steam_id, display_name').not('steam_id', 'is', null);
      if (players && players.length > 0) {
        console.log(`🔄 Syncing ${players.length} players from Steam Web API...`);
        
        // Batch Steam IDs into groups of 100 (Steam API limit)
        const BATCH_SIZE = 100;
        for (let i = 0; i < players.length; i += BATCH_SIZE) {
          const batch = players.slice(i, i + BATCH_SIZE);
          const steamIds = batch.map((p: any) => p.steam_id).join(',');
          
          try {
            const steamApiKey = Deno.env.get('STEAM_WEB_API_KEY');
            if (!steamApiKey) {
              errors.push('STEAM_WEB_API_KEY not configured');
              break;
            }

            // Call Steam Web API GetPlayerSummaries (source of truth!)
            const res = await fetch(
              `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${steamApiKey}&steamids=${steamIds}`
            );
            
            if (res.ok) {
              const data = await res.json();
              const steamPlayers = data.response?.players || [];
              
              for (const steamPlayer of steamPlayers) {
                const person = batch.find((p: any) => p.steam_id === steamPlayer.steamid);
                if (!person) continue;
                
                const updates: any = {};
                
                // Update display name from Steam (current, real-time data!)
                if (steamPlayer.personaname && steamPlayer.personaname !== person.display_name) {
                  updates.display_name = steamPlayer.personaname;
                }
                
                // Update avatar from Steam
                if (steamPlayer.avatarfull) {
                  updates.avatar_url = steamPlayer.avatarfull;
                }
                
                if (Object.keys(updates).length > 0) {
                  await supabase.from('kkup_persons').update(updates).eq('id', person.id);
                  playersUpdated++;
                  
                  // Also sync to users table if they have a linked Discord account
                  const { data: linkedUser } = await supabase
                    .from('users')
                    .select('id')
                    .eq('steam_id', person.steam_id)
                    .single();
                  
                  if (linkedUser) {
                    await supabase.from('users').update({
                      steam_name: updates.display_name || undefined,
                      steam_avatar: updates.avatar_url || undefined
                    }).eq('id', linkedUser.id);
                    usersUpdated++;
                  }
                }
              }
            } else {
              errors.push(`Steam API returned ${res.status} for batch ${i / BATCH_SIZE + 1}`);
            }
            
            // Delay between batches to avoid rate limiting
            await new Promise(r => setTimeout(r, 200));
          } catch (batchError) {
            console.error(`Error processing player batch ${i / BATCH_SIZE + 1}:`, batchError);
            errors.push(`Batch ${i / BATCH_SIZE + 1} failed: ${batchError instanceof Error ? batchError.message : String(batchError)}`);
          }
        }
      }

      // ═══════════════════════════════════════════════════════════════
      // PHASE 2: Sync Master Team Logos (Source of Truth)
      // ═══════════════════════════════════════════════════════════════
      const { data: masterTeams } = await supabase.from('kkup_master_teams').select('id, team_tag, team_name, logo_url');
      if (masterTeams && masterTeams.length > 0) {
        console.log(`🔄 Syncing ${masterTeams.length} master team logos from team_logos/ folder...`);
        
        for (const team of masterTeams) {
          try {
            const sanitizedTag = (team.team_tag || team.team_name || '')
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '');
            
            if (!sanitizedTag || sanitizedTag.length < 2) continue;
            
            // Search in master team_logos/ folder for .png or .jpg
            const { data: pngFiles } = await supabase.storage
              .from('make-4789f4af-kkup-assets')
              .list('team_logos', { search: sanitizedTag });
            
            let foundFile = pngFiles?.find((f: any) => f.name.toLowerCase().includes(sanitizedTag));
            
            if (foundFile) {
              const { data: urlData } = supabase.storage
                .from('make-4789f4af-kkup-assets')
                .getPublicUrl(`team_logos/${foundFile.name}`);
              
              if (urlData?.publicUrl && urlData.publicUrl !== team.logo_url) {
                await supabase.from('kkup_master_teams').update({ logo_url: urlData.publicUrl }).eq('id', team.id);
                masterTeamsUpdated++;
              }
            }
          } catch (teamError) {
            console.error(`Error syncing master team ${team.team_tag}:`, teamError);
          }
        }
      }

      // ═══════════════════════════════════════════════════════════════
      // PHASE 3: Sync Tournament Team Logos (per-tournament snapshots)
      // ═══════════════════════════════════════════════════════════════
      const { data: teams } = await supabase.from('kkup_teams').select('id, team_tag, team_name, tournament_id, master_team_id, logo_url');
      if (teams && teams.length > 0) {
        console.log(`🔄 Syncing ${teams.length} tournament team logos...`);
        
        const { data: tournaments } = await supabase.from('kkup_tournaments').select('id, name');
        const tournamentMap = new Map(tournaments?.map((t: any) => [t.id, t.name]) || []);
        
        for (const team of teams) {
          try {
            const tournamentName = tournamentMap.get(team.tournament_id);
            if (!tournamentName) continue;
            
            const isHeapsNHooks = tournamentName.toLowerCase().includes('heaps') && tournamentName.toLowerCase().includes('hooks');
            const folderName = tournamentName.toLowerCase().trim()
              .replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
            
            if (folderName.length < 3) continue;
            
            let foundLogoUrl: string | null = null;
            
            if (isHeapsNHooks) {
              // Heaps n Hooks: Pull from tournament-specific folder
              const sanitizedName = (team.team_tag || team.team_name || '')
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '');
              
              const { data: fileData } = await supabase.storage
                .from('make-4789f4af-kkup-assets')
                .list(folderName, { search: sanitizedName });
              
              if (fileData && fileData.length > 0) {
                const { data: urlData } = supabase.storage
                  .from('make-4789f4af-kkup-assets')
                  .getPublicUrl(`${folderName}/${fileData[0].name}`);
                foundLogoUrl = urlData?.publicUrl || null;
              }
            } else {
              // Kernel Kup: Pull from master team_logos/ folder
              if (team.master_team_id) {
                // Use master team logo if linked
                const { data: masterTeam } = await supabase
                  .from('kkup_master_teams')
                  .select('logo_url')
                  .eq('id', team.master_team_id)
                  .single();
                foundLogoUrl = masterTeam?.logo_url || null;
              } else {
                // Fallback: search team_logos/ by tag
                const sanitizedTag = (team.team_tag || team.team_name || '')
                  .toLowerCase()
                  .replace(/[^a-z0-9]/g, '');
                
                const { data: fileData } = await supabase.storage
                  .from('make-4789f4af-kkup-assets')
                  .list('team_logos', { search: sanitizedTag });
                
                if (fileData && fileData.length > 0) {
                  const { data: urlData } = supabase.storage
                    .from('make-4789f4af-kkup-assets')
                    .getPublicUrl(`team_logos/${fileData[0].name}`);
                  foundLogoUrl = urlData?.publicUrl || null;
                }
              }
            }
            
            if (foundLogoUrl && foundLogoUrl !== team.logo_url) {
              await supabase.from('kkup_teams').update({ logo_url: foundLogoUrl }).eq('id', team.id);
              teamsUpdated++;
            }
          } catch (teamError) {
            console.error(`Error syncing team ${team.team_tag}:`, teamError);
          }
        }
      }

      try { 
        await createAdminLog({ 
          type: 'data_sync', 
          action: `Synced names & logos: ${playersUpdated} players, ${teamsUpdated} teams, ${masterTeamsUpdated} master teams, ${usersUpdated} users updated`, 
          actor_name: 'Owner' 
        }); 
      } catch (_) {}

      return c.json({ 
        success: true, 
        playersUpdated, 
        teamsUpdated,
        masterTeamsUpdated,
        usersUpdated,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      console.error('Sync error:', error);
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  // Import single match from OpenDota data
  app.post(`${PREFIX}/kkup/import-opendota-match`, async (c) => {
    try {
      const body = await c.req.json();
      const matchData = body.opendota?.data || body;
      if (!matchData || !matchData.match_id) return c.json({ error: 'Invalid OpenDota match data' }, 400);

      const leagueId = matchData.leagueid || matchData.league?.leagueid;
      if (!leagueId) return c.json({ error: 'No league_id found in match data' }, 400);
      const tournamentName = matchData.league?.name || `League ${leagueId}`;

      const { data: existing } = await supabase.from('kkup_tournaments').select('*').eq('league_id', leagueId).single();
      let kkupId: string, isNew = false;

      if (existing) { kkupId = existing.id; }
      else {
        const matchDate = new Date(matchData.start_time * 1000);
        const { data: nt, error } = await supabase.from('kkup_tournaments').insert({
          name: tournamentName, league_id: leagueId, series_id: 0,
          verified_match_id: matchData.match_id, verified_team_id: matchData.radiant_team_id || 0, verified_player_id: matchData.players?.[0]?.account_id || 0,
          tournament_start_date: matchDate.toISOString().split('T')[0], tournament_end_date: matchDate.toISOString().split('T')[0],
          import_status: 'in_progress', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
        }).select().single();
        if (error || !nt) return c.json({ error: 'Failed to create tournament', details: error }, 500);
        kkupId = nt.id; isNew = true;
      }

      // Create/find teams
      const teamMap = new Map();
      for (const [valveId, name, logo] of [
        [matchData.radiant_team_id, matchData.radiant_name, matchData.radiant_logo],
        [matchData.dire_team_id, matchData.dire_name, matchData.dire_logo]
      ] as any[]) {
        if (!valveId) continue;
        const { data: et } = await supabase.from('kkup_teams').select('*').eq('tournament_id', kkupId).eq('valve_team_id', valveId).single();
        if (et) { teamMap.set(valveId, et); }
        else {
          const { data: nt } = await supabase.from('kkup_teams').insert({
            tournament_id: kkupId, team_name: name || `Team ${valveId}`, team_tag: (name || '').substring(0, 5).toUpperCase() || 'TEAM',
            valve_team_id: valveId, logo_url: logo ? `https://steamcdn-a.akamaihd.net/apps/dota2/images/team_logos/${logo}.png` : null,
            imported_at: new Date().toISOString()
          }).select().single();
          if (nt) teamMap.set(valveId, nt);
        }
      }

      // Create match if not exists
      const { data: existingMatch } = await supabase.from('kkup_matches').select('*').eq('valve_match_id', matchData.match_id).single();
      let matchCreated = false;
      if (!existingMatch) {
        const rt = teamMap.get(matchData.radiant_team_id);
        const dt = teamMap.get(matchData.dire_team_id);
        await supabase.from('kkup_matches').insert({
          tournament_id: kkupId, valve_match_id: matchData.match_id,
          match_date: new Date(matchData.start_time * 1000).toISOString(), duration_seconds: matchData.duration,
          radiant_team_id: rt?.id, dire_team_id: dt?.id,
          radiant_win: matchData.radiant_win, radiant_score: matchData.radiant_score || 0, dire_score: matchData.dire_score || 0,
          imported_at: new Date().toISOString()
        });
        matchCreated = true;
      }

      await supabase.from('kkup_tournaments').update({ import_status: 'completed', imported_at: new Date().toISOString() }).eq('id', kkupId);

      try { await createAdminLog({ type: 'match_imported', action: `Imported match ${matchData.match_id} into ${tournamentName}${isNew ? ' (new tournament)' : ''}`, actor_name: 'Owner' }); } catch (_) {}

      return c.json({ success: true, message: matchCreated ? 'Match imported' : 'Match already exists',
        tournament_id: kkupId, tournament_name: tournamentName, tournament_created: isNew,
        stats: { teams_processed: teamMap.size, match_created: matchCreated } });
    } catch (error: any) {
      console.error('OpenDota import error:', error);
      return c.json({ error: 'Import failed', details: error?.message || String(error) }, 500);
    }
  });

  // Fix hero names in player stats
  app.post(`${PREFIX}/kkup/fix-hero-names`, async (c) => {
    try {
      const { data: stats, error } = await supabase.from('kkup_player_match_stats').select('id, hero_id, hero').like('hero', 'Hero %');
      if (error) return c.json({ error: 'Failed to fetch player stats' }, 500);
      if (!stats || stats.length === 0) return c.json({ message: 'No hero names to fix!', updated: 0 });

      let updated = 0, failed = 0;
      for (const stat of stats) {
        const { error: ue } = await supabase.from('kkup_player_match_stats').update({ hero: getHeroName(stat.hero_id) }).eq('id', stat.id);
        if (ue) failed++; else updated++;
      }

      try { await createAdminLog({ type: 'data_fix', action: `Fixed ${updated} hero names (${failed} failed, ${stats.length} total)`, actor_name: 'Owner' }); } catch (_) {}

      return c.json({ message: `Updated ${updated} hero names!`, updated, failed, total: stats.length });
    } catch (error) {
      console.error('Fix hero names error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // Backfill hero_id from hero names (Owner only)
  app.post(`${PREFIX}/kkup/backfill-hero-ids`, async (c) => {
    try {
      if (!await requireOwner(c)) return c.json({ error: 'Owner access required' }, 403);

      // Get all stats that have a hero name but missing hero_id
      const { data: stats, error } = await supabase
        .from('kkup_player_match_stats')
        .select('id, hero, hero_id')
        .not('hero', 'is', null);

      if (error) return c.json({ error: 'Failed to fetch player stats: ' + error.message }, 500);
      if (!stats || stats.length === 0) return c.json({ message: 'No records to backfill!', updated: 0 });

      let updated = 0, skipped = 0, failed = 0;
      const errors: string[] = [];

      for (const stat of stats) {
        try {
          // Skip if hero_id already exists
          if (stat.hero_id && stat.hero_id > 0) {
            skipped++;
            continue;
          }

          // Convert hero name to ID
          const heroId = getHeroIdFromName(stat.hero);
          
          if (!heroId || heroId === 0) {
            failed++;
            errors.push(`Unknown hero name: "${stat.hero}" (stat ID: ${stat.id})`);
            continue;
          }

          // Update the record
          const { error: updateError } = await supabase
            .from('kkup_player_match_stats')
            .update({ hero_id: heroId })
            .eq('id', stat.id);

          if (updateError) {
            failed++;
            errors.push(`Failed to update stat ${stat.id}: ${updateError.message}`);
          } else {
            updated++;
          }
        } catch (rowError: any) {
          failed++;
          errors.push(`Error processing stat ${stat.id}: ${rowError.message}`);
        }
      }

      try {
        await createAdminLog({
          type: 'data_fix',
          action: `Backfilled hero IDs: ${updated} updated, ${skipped} skipped, ${failed} failed (${stats.length} total)`,
          actor_name: 'Owner',
        });
      } catch (_) {}

      return c.json({
        success: true,
        message: `Backfill complete: ${updated} hero IDs added!`,
        updated,
        skipped,
        failed,
        total: stats.length,
        errors: errors.length > 0 ? errors.slice(0, 20) : undefined, // Show first 20 errors
      });
    } catch (error: any) {
      console.error('Backfill hero IDs error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

  // Get all teams with tournament info
  app.get(`${PREFIX}/kkup/all-teams`, async (c) => {
    try {
      const { data: teams, error } = await supabase.from('kkup_teams').select('*').order('team_name', { ascending: true });
      if (error) return c.json({ error: 'Failed to fetch teams' }, 500);
      const { data: tournaments } = await supabase.from('kkup_tournaments').select('id, name');
      const tMap = new Map(tournaments?.map((t: any) => [t.id, t]) || []);
      const teamsWithTournaments = (teams || []).map((team: any) => ({ ...team, tournament: tMap.get(team.tournament_id) || null }));
      return c.json({ teams: teamsWithTournaments });
    } catch (error) {
      console.error('Get all teams error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // List files in KKup Assets storage
  app.get(`${PREFIX}/kkup/storage/list`, async (c) => {
    try {
      const path = c.req.query('path') || '';
      const { data: files, error } = await supabase.storage.from('make-4789f4af-kkup-assets').list(path, { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
      if (error) return c.json({ error: 'Failed to list files' }, 500);

      const filesWithUrls = files.map((file: any) => {
        const fullPath = path ? `${path}/${file.name}` : file.name;
        const { data: urlData } = supabase.storage.from('make-4789f4af-kkup-assets').getPublicUrl(fullPath);
        return { name: file.name, path: fullPath, url: urlData.publicUrl, isFolder: !file.id || !file.name.includes('.'), metadata: file.metadata };
      });
      return c.json({ files: filesWithUrls, path: path || '/' });
    } catch (error) {
      console.error('List storage error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // Bulk update team logos
  app.post(`${PREFIX}/kkup/teams/update-logos`, async (c) => {
    try {
      const { mappings = [] } = await c.req.json();
      let updated = 0, failed = 0;
      for (const mapping of mappings) {
        const { data: urlData } = supabase.storage.from('make-4789f4af-kkup-assets').getPublicUrl(mapping.logo_path);
        const { error } = await supabase.from('kkup_teams').update({ logo_url: urlData.publicUrl }).eq('id', mapping.team_id);
        if (error) failed++; else updated++;
      }

      try { await createAdminLog({ type: 'logo_update', action: `Bulk updated ${updated} team logos (${failed} failed)`, actor_name: 'Owner' }); } catch (_) {}

      return c.json({ message: `Updated ${updated} team logos!`, updated, failed, total: mappings.length });
    } catch (error) {
      console.error('Update logos error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // Link user to KKUP player profile (DEPRECATED — linking now uses steam_id automatically)
  app.post(`${PREFIX}/admin/link-user-kkup-profile`, async (c) => {
    return c.json({ error: 'This endpoint is deprecated. KKUP profiles are now automatically linked via steam_id. Connect your OpenDota/Steam account to link.' }, 410);
  });

  // Unlink user from KKUP player profile (DEPRECATED — linking now uses steam_id automatically)
  app.post(`${PREFIX}/admin/unlink-user-kkup-profile`, async (c) => {
    return c.json({ error: 'This endpoint is deprecated. KKUP profiles are now automatically linked via steam_id.' }, 410);
  });

  // Get user's KKUP stats
  app.get(`${PREFIX}/users/:user_id/kkup-stats`, async (c) => {
    try {
      const userId = c.req.param('user_id');
      const { data: user, error: ue } = await supabase.from('users').select('id, discord_username, steam_id').eq('id', userId).single();
      if (ue || !user) return c.json({ error: 'User not found' }, 404);
      if (!user.steam_id) return c.json({ linked: false, championships: { kernel_kup: 0, heaps_n_hooks: 0, total: 0 }, popd_kernels: 0, tournaments_played: 0, total_games: 0, wins: 0, losses: 0 });

      // Find the kkup_persons record by steam_id
      const { data: person, error: pe } = await supabase.from('kkup_persons').select('id, display_name, steam_id').eq('steam_id', user.steam_id).maybeSingle();
      if (pe || !person) return c.json({ linked: false, championships: { kernel_kup: 0, heaps_n_hooks: 0, total: 0 }, popd_kernels: 0, tournaments_played: 0, total_games: 0, wins: 0, losses: 0 });

      const personId = person.id;

      // Get team memberships
      const { data: teamMemberships } = await supabase.from('kkup_team_rosters').select('team_id').eq('person_id', personId);
      const teamIds = teamMemberships?.map((tm: any) => tm.team_id) || [];

      // Get all tournaments for championship & MVP lookups
      const { data: tournaments } = await supabase.from('kkup_tournaments').select('id, winning_team_id, tournament_type, popd_kernel_1_person_id, popd_kernel_2_person_id, name, status');

      // Count championships by type
      let kernelKupChampionships = 0, heapsNHooksChampionships = 0;
      if (teamIds.length > 0) {
        // Get winning team rosters for teams we're on
        const winningTournaments = (tournaments || []).filter((t: any) => t.winning_team_id && teamIds.includes(t.winning_team_id));
        for (const t of winningTournaments) {
          const tType = t.tournament_type || 'kernel_kup';
          if (tType === 'heaps_n_hooks') heapsNHooksChampionships++;
          else kernelKupChampionships++;
        }
      }

      // Count Pop'd Kernel awards
      let popdKernels = 0;
      (tournaments || []).forEach((t: any) => {
        if (t.popd_kernel_1_person_id === personId) popdKernels++;
        if (t.popd_kernel_2_person_id === personId) popdKernels++;
      });

      // Count unique tournaments played
      const { data: teamsPlayed } = await supabase.from('kkup_teams').select('tournament_id').in('id', teamIds.length > 0 ? teamIds : ['__none__']);
      const uniqueTournaments = new Set(teamsPlayed?.map((t: any) => t.tournament_id));

      // Get player match stats — is_winner is pre-computed on the row (backfilled for KK1-9, set at import for future)
      // Fall back to the join-based check for any rows where is_winner is null (edge case: pre-backfill imports)
      const { data: playerGames } = await supabase
        .from('kkup_player_match_stats')
        .select('id, team_id, kills, deaths, assists, hero, is_winner, match:kkup_matches!match_id(winning_team_id)')
        .eq('person_id', personId);

      const totalGames = playerGames?.length || 0;
      const wins = playerGames?.filter((g: any) => {
        // Prefer the pre-computed is_winner column; fall back to join-based check for null rows
        if (g.is_winner !== null && g.is_winner !== undefined) return g.is_winner === true;
        return g.match && g.team_id === g.match.winning_team_id;
      }).length || 0;
      const totalKills = playerGames?.reduce((s: number, g: any) => s + (g.kills || 0), 0) || 0;
      const totalDeaths = playerGames?.reduce((s: number, g: any) => s + (g.deaths || 0), 0) || 0;
      const totalAssists = playerGames?.reduce((s: number, g: any) => s + (g.assists || 0), 0) || 0;

      // Find most played hero across all KKup matches
      let mostPlayedHero: { name: string; games: number } | null = null;
      try {
        if (playerGames && playerGames.length > 0) {
          const heroCounts: Record<string, number> = {};
          for (const g of playerGames) {
            if (g.hero) {
              heroCounts[g.hero] = (heroCounts[g.hero] || 0) + 1;
            }
          }
          const sorted = Object.entries(heroCounts).sort((a, b) => b[1] - a[1]);
          if (sorted.length > 0) {
            mostPlayedHero = { name: sorted[0][0], games: sorted[0][1] };
          }
        }
      } catch (heroErr) {
        console.error('Non-critical: most played hero lookup failed:', heroErr);
      }

      // Check for current/active tournament registration
      let currentRegistration: { tournament_id: string; tournament_name: string; status: string } | null = null;
      try {
        // Find non-archived/completed tournaments where this person is on a roster
        const activeTournaments = (tournaments || []).filter((t: any) =>
          t.status && !['completed', 'archived'].includes(t.status)
        );
        if (activeTournaments.length > 0) {
          const activeTournamentIds = activeTournaments.map((t: any) => t.id);
          // Check if on any team in an active tournament
          const { data: activeTeams } = await supabase
            .from('kkup_teams')
            .select('id, tournament_id')
            .in('tournament_id', activeTournamentIds);
          const activeTeamIds = activeTeams?.map((t: any) => t.id) || [];
          const matchingTeamIds = teamIds.filter((tid: string) => activeTeamIds.includes(tid));
          if (matchingTeamIds.length > 0) {
            const matchedTeam = activeTeams?.find((t: any) => matchingTeamIds.includes(t.id));
            if (matchedTeam) {
              const matchedTournament = activeTournaments.find((t: any) => t.id === matchedTeam.tournament_id);
              if (matchedTournament) {
                currentRegistration = {
                  tournament_id: matchedTournament.id,
                  tournament_name: matchedTournament.name || 'Active Tournament',
                  status: matchedTournament.status,
                };
              }
            }
          }
        }
      } catch (regErr) {
        console.error('Non-critical: current registration lookup failed:', regErr);
      }

      return c.json({
        linked: true,
        profile: { name: person.display_name, steam_id: person.steam_id },
        championships: { kernel_kup: kernelKupChampionships, heaps_n_hooks: heapsNHooksChampionships, total: kernelKupChampionships + heapsNHooksChampionships },
        popd_kernels: popdKernels,
        tournaments_played: uniqueTournaments.size,
        total_games: totalGames,
        wins,
        losses: totalGames - wins,
        total_kills: totalKills,
        total_deaths: totalDeaths,
        total_assists: totalAssists,
        most_played_hero: mostPlayedHero,
        current_registration: currentRegistration,
      });
    } catch (error) {
      console.error('Get user KKUP stats error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // Search KKUP player profiles
  app.get(`${PREFIX}/kkup-player-profiles/search`, async (c) => {
    try {
      const query = c.req.query('q') || '';
      if (query.length < 2) return c.json({ profiles: [] });
      const { data: profiles, error } = await supabase.from('kkup_persons').select('id, display_name, steam_id').ilike('display_name', `%${query}%`).order('display_name').limit(20);
      if (error) return c.json({ error: 'Failed to search profiles' }, 500);
      return c.json({ profiles: (profiles || []).map((p: any) => ({ id: p.id, name: p.display_name, steam_id: p.steam_id })) });
    } catch (error) {
      console.error('Search KKUP profiles error:', error);
      return c.json({ error: 'Internal server error' }, 500);
    }
  });

  // Find duplicate player profiles
  app.get(`${PREFIX}/kkup/admin/find-duplicates`, async (c) => {
    try {
      const { data: allPlayers, error } = await supabase.from('kkup_persons').select('id, display_name, steam_id, created_at').order('display_name');
      if (error) return c.json({ error: 'Failed to fetch player profiles: ' + error.message }, 500);
      const players = allPlayers || [];

      const steamIdGroups: Record<string, any[]> = {};
      const nullSteamIdPlayers: any[] = [];
      for (const p of players) {
        if (!p.steam_id) nullSteamIdPlayers.push(p);
        else { const k = String(p.steam_id); if (!steamIdGroups[k]) steamIdGroups[k] = []; steamIdGroups[k].push(p); }
      }
      const steamIdDuplicates = Object.entries(steamIdGroups).filter(([_, g]) => g.length > 1).map(([sid, g]) => ({ steam_id: sid, count: g.length, profiles: g }));

      const nameGroups: Record<string, any[]> = {};
      for (const p of players) { const n = (p.display_name || '').toLowerCase().trim(); if (!n) continue; if (!nameGroups[n]) nameGroups[n] = []; nameGroups[n].push(p); }
      const nameDuplicates = Object.entries(nameGroups).filter(([_, g]) => g.length > 1).map(([name, g]) => ({ normalized_name: name, count: g.length, profiles: g }));

      const { data: teamPlayers } = await supabase.from('kkup_team_rosters').select('person_id, team_id');
      const profileIds = new Set(players.map((p: any) => p.id));
      const orphanedTeamAssignments = (teamPlayers || []).filter((tp: any) => !profileIds.has(tp.person_id));

      return c.json({
        total_profiles: players.length,
        steam_id_duplicates: { count: steamIdDuplicates.length, groups: steamIdDuplicates },
        name_duplicates: { count: nameDuplicates.length, groups: nameDuplicates },
        null_steam_id_players: { count: nullSteamIdPlayers.length, players: nullSteamIdPlayers },
        orphaned_team_assignments: { count: orphanedTeamAssignments.length, assignments: orphanedTeamAssignments },
      });
    } catch (error) {
      console.error('Find duplicates error:', error);
      return c.json({ error: 'Internal server error: ' + String(error) }, 500);
    }
  });

  // Sync player profile by ANY Steam ID format (Account ID, Steam64, or vanity URL)
  // Normalizes input to Account ID, fetches from Steam API, updates kkup_persons
  app.post(`${PREFIX}/kkup/sync-player-by-steam-id`, async (c) => {
    try {
      if (!await requireOwner(c)) return c.json({ error: 'Owner access required' }, 403);

      const { steam_id_input } = await c.req.json();
      if (!steam_id_input) {
        return c.json({ error: 'steam_id_input is required (can be Account ID, Steam64, or vanity URL)' }, 400);
      }

      console.log(`🔍 Normalizing Steam ID input: "${steam_id_input}"...`);

      // Normalize ANY format to Account ID
      const accountId = await normalizeToAccountId(steam_id_input);
      if (!accountId) {
        return c.json({ 
          error: `Could not resolve Steam ID: "${steam_id_input}". Please provide a valid Account ID, Steam64, or vanity URL.`,
          examples: {
            account_id: '51579950',
            steam64: '76561198011845678',
            vanity_url: 'permasnooze'
          }
        }, 400);
      }

      console.log(`✅ Normalized to Account ID: ${accountId}`);

      // Convert to Steam64 for API lookup
      const steam64 = steam32ToSteam64(accountId);

      // Fetch from Steam API
      const steamApiKey = Deno.env.get('STEAM_WEB_API_KEY');
      if (!steamApiKey) {
        return c.json({ error: 'STEAM_WEB_API_KEY not configured' }, 500);
      }

      const res = await fetch(
        `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${steamApiKey}&steamids=${steam64}`
      );

      if (!res.ok) {
        return c.json({ error: `Steam API returned ${res.status}` }, 500);
      }

      const data = await res.json();
      const steamPlayer = data.response?.players?.[0];

      if (!steamPlayer) {
        return c.json({ 
          error: `No Steam profile found for Account ID ${accountId} (Steam64: ${steam64})`,
          account_id: accountId,
          steam64: steam64
        }, 404);
      }

      // Check if player already exists
      const { data: existing } = await supabase
        .from('kkup_persons')
        .select('*')
        .eq('steam_id', String(accountId))
        .maybeSingle();

      let personRecord;
      const playerData = {
        steam_id: String(accountId),
        display_name: steamPlayer.personaname || `Player ${accountId}`,
        avatar_url: steamPlayer.avatarfull || steamPlayer.avatarmedium || steamPlayer.avatar || null,
        steam_name: steamPlayer.personaname,
        steam_avatar: steamPlayer.avatarfull || steamPlayer.avatarmedium || steamPlayer.avatar || null,
        dotabuff_url: getDotabuffUrl(accountId),
        opendota_url: getOpendotaUrl(accountId),
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        // Update existing record
        const { data: updated, error: updateError } = await supabase
          .from('kkup_persons')
          .update(playerData)
          .eq('id', existing.id)
          .select()
          .single();

        if (updateError) {
          return c.json({ error: `Failed to update player: ${updateError.message}` }, 500);
        }

        personRecord = updated;
        console.log(`✅ Updated existing player: ${personRecord.display_name} (${accountId})`);

        try {
          await createAdminLog({
            type: 'player_sync',
            action: `Synced player "${personRecord.display_name}" (${accountId}) from Steam`,
            actor_name: 'Owner',
          });
        } catch (_) {}

        return c.json({
          success: true,
          action: 'updated',
          player: {
            id: personRecord.id,
            steam_id: personRecord.steam_id,
            display_name: personRecord.display_name,
            avatar_url: personRecord.avatar_url,
            dotabuff_url: personRecord.dotabuff_url,
            opendota_url: personRecord.opendota_url,
            steam_profile_url: getSteamProfileUrl(accountId),
          },
          steam_data: {
            account_id: accountId,
            steam64: steam64,
            personaname: steamPlayer.personaname,
            profileurl: steamPlayer.profileurl,
          },
        });
      } else {
        // Create new record
        const { data: created, error: createError } = await supabase
          .from('kkup_persons')
          .insert(playerData)
          .select()
          .single();

        if (createError) {
          return c.json({ error: `Failed to create player: ${createError.message}` }, 500);
        }

        personRecord = created;
        console.log(`✅ Created new player: ${personRecord.display_name} (${accountId})`);

        try {
          await createAdminLog({
            type: 'player_sync',
            action: `Created new player "${personRecord.display_name}" (${accountId}) from Steam`,
            actor_name: 'Owner',
          });
        } catch (_) {}

        return c.json({
          success: true,
          action: 'created',
          player: {
            id: personRecord.id,
            steam_id: personRecord.steam_id,
            display_name: personRecord.display_name,
            avatar_url: personRecord.avatar_url,
            dotabuff_url: personRecord.dotabuff_url,
            opendota_url: personRecord.opendota_url,
            steam_profile_url: getSteamProfileUrl(accountId),
          },
          steam_data: {
            account_id: accountId,
            steam64: steam64,
            personaname: steamPlayer.personaname,
            profileurl: steamPlayer.profileurl,
          },
        });
      }
    } catch (error: any) {
      console.error('Sync player by Steam ID error:', error);
      return c.json({ error: 'Internal server error: ' + error.message }, 500);
    }
  });

}