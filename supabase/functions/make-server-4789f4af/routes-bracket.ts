/**
 * Bracket Routes — Generation, reading, and management of tournament brackets.
 *
 * Routes:
 *   POST   /kkup/tournaments/:id/bracket/generate  — Generate bracket at roster lock (owner only)
 *   GET    /kkup/tournaments/:id/bracket            — Get full bracket (series + matches) (public)
 *   DELETE /kkup/tournaments/:id/bracket            — Delete bracket (owner only, for re-generation)
 *   POST   /kkup/tournaments/:id/bracket/series/:seriesId/result — Record series winner (officer+)
 *   POST   /kkup/voice-channels/reset               — Reset Discord voice channels to defaults (owner only)
 *
 * Tables used: kkup_bracket_series, kkup_bracket_matches, kkup_teams, kkup_team_rosters, users
 *
 * The bracket generation logic:
 *   1. Validates all rostered players have Dota ranks
 *   2. Calculates average team rank for seeding
 *   3. Creates 7 series rows (4 QF + 2 SF + 1 GF) with proper seeding & advancement links
 *   4. Handles byes (6-7 teams) — top seeds auto-advance
 *   5. Pre-creates match rows for QF series (game 1 of each)
 *
 * The series advancement logic:
 *   1. Owner/officer records a series winner
 *   2. Series is marked completed, winner_team_id set
 *   3. Winner advances to next_series_id in next_series_slot
 *   4. Loser's voice channel renamed to "Xth Seed: Eliminated"
 *   5. If GF winner, champion channel renamed to "🌽 CHAMPION: TAG"
 *   6. If next series now has both teams, pre-create game 1 match
 *   7. Discord webhook + admin log
 */

import { Hono } from "npm:hono";
import { PREFIX, requireAuth as sharedRequireAuth, requireOwner as sharedRequireOwner } from "./helpers.ts";
import { resolveUserRank, rankToNumeric } from "./rank-utils.ts";
import { createAdminLog } from "./routes-notifications.ts";
import { isOfficer } from "./roles.ts";
import { renameTeamVoiceChannels, resetTeamVoiceChannels, renameDiscordChannel, ordinal, DISCORD_TEAM_VOICE_CHANNELS, DISCORD_WEBHOOKS } from "./discord-config.ts";
import { sendWebhookEmbed } from "./discord-embeds.tsx";

// ── Seeding map: Tate's official bracket ──
// QF1: Seed 1 vs Seed 8 → SF1 radiant
// QF2: Seed 3 vs Seed 6 → SF1 dire
// QF3: Seed 2 vs Seed 7 → SF2 radiant
// QF4: Seed 4 vs Seed 5 → SF2 dire
const BRACKET_TEMPLATE = {
  QF: [
    { position: 1, seedRadiant: 1, seedDire: 8, nextRound: 'SF', nextPosition: 1, nextSlot: 'radiant' },
    { position: 2, seedRadiant: 3, seedDire: 6, nextRound: 'SF', nextPosition: 1, nextSlot: 'dire' },
    { position: 3, seedRadiant: 2, seedDire: 7, nextRound: 'SF', nextPosition: 2, nextSlot: 'radiant' },
    { position: 4, seedRadiant: 4, seedDire: 5, nextRound: 'SF', nextPosition: 2, nextSlot: 'dire' },
  ],
  SF: [
    { position: 1, nextRound: 'GF', nextPosition: 1, nextSlot: 'radiant' },
    { position: 2, nextRound: 'GF', nextPosition: 1, nextSlot: 'dire' },
  ],
  GF: [
    { position: 1 },
  ],
} as const;

/**
 * Calculate the average numeric rank for a team's roster.
 * Returns { avgRank, playerCount, unrankedPlayers[] }.
 */
async function calculateTeamSeedRank(
  supabase: any,
  teamId: string,
  tournamentType: string,
): Promise<{
  avgRank: number;
  playerCount: number;
  unrankedPlayers: { name: string; userId: string | null }[];
}> {
  // Get roster members with their linked user data
  const { data: roster, error } = await supabase
    .from('kkup_team_rosters')
    .select(`
      id,
      person:kkup_persons!person_id (
        id, display_name, user_id
      )
    `)
    .eq('team_id', teamId);

  if (error || !roster?.length) {
    return { avgRank: 0, playerCount: 0, unrankedPlayers: [] };
  }

  const unrankedPlayers: { name: string; userId: string | null }[] = [];
  let totalRank = 0;
  let rankedCount = 0;

  for (const member of roster) {
    const person = member.person;
    if (!person?.user_id) {
      unrankedPlayers.push({ name: person?.display_name || 'Unknown', userId: null });
      continue;
    }

    // Fetch the user's rank data
    const { data: user } = await supabase
      .from('users')
      .select('id, discord_username, opendota_data')
      .eq('id', person.user_id)
      .single();

    const rank = resolveUserRank(user);
    if (!rank) {
      unrankedPlayers.push({ name: person.display_name || user?.discord_username || 'Unknown', userId: person.user_id });
      continue;
    }

    totalRank += rankToNumeric(rank.medal, rank.stars);
    rankedCount++;
  }

  return {
    avgRank: rankedCount > 0 ? totalRank / rankedCount : 0,
    playerCount: roster.length,
    unrankedPlayers,
  };
}


export function registerBracketRoutes(app: Hono, supabase: any, anonSupabase: any) {

  const requireOwner = (c: any) => sharedRequireOwner(c, supabase, anonSupabase);
  const requireAuth = (c: any) => sharedRequireAuth(c, supabase, anonSupabase);


  // ═══════════════════════════════════════════════════════
  // 1. GENERATE BRACKET (Owner only)
  // ═══════════════════════════════════════════════════════

  app.post(`${PREFIX}/kkup/tournaments/:id/bracket/generate`, async (c) => {
    try {
      const auth = await requireOwner(c);
      if (!auth.ok) return auth.response;

      const tournamentId = c.req.param('id');

      // Fetch tournament
      const { data: tournament, error: tErr } = await supabase
        .from('kkup_tournaments')
        .select('*')
        .eq('id', tournamentId)
        .single();

      if (tErr || !tournament) {
        return c.json({ error: `Tournament not found: ${tErr?.message || 'no data'}` }, 404);
      }

      // Must be in roster_lock or registration_closed to generate bracket
      if (!['roster_lock', 'registration_closed'].includes(tournament.status)) {
        const msg = `Cannot generate bracket in "${tournament.status}" phase. Tournament must be in "registration_closed" or "roster_lock".`;
        console.log(`Bracket generation blocked: ${msg}`);
        return c.json({
          error: msg,
        }, 400);
      }

      // Check if bracket already exists
      const { data: existingSeries } = await supabase
        .from('kkup_bracket_series')
        .select('id')
        .eq('tournament_id', tournamentId)
        .limit(1);

      if (existingSeries?.length > 0) {
        return c.json({
          error: 'Bracket already exists for this tournament. Delete it first if you need to re-generate.',
        }, 409);
      }

      // Get approved teams
      const { data: teams, error: teamsErr } = await supabase
        .from('kkup_teams')
        .select('id, team_name, team_tag, logo_url, approval_status')
        .eq('tournament_id', tournamentId)
        .eq('approval_status', 'approved');

      if (teamsErr) {
        return c.json({ error: `Failed to fetch teams: ${teamsErr.message}` }, 500);
      }

      const teamCount = teams?.length || 0;

      // Use tournament's configured min_teams, or default to 2 (absolute minimum for any bracket)
      const minTeamsRequired = tournament.min_teams || 2;

      if (teamCount < minTeamsRequired) {
        const msg = `Need at least ${minTeamsRequired} approved teams to generate a bracket. Currently have ${teamCount}.`;
        console.log(`Bracket generation blocked: ${msg}`);
        return c.json({
          error: msg,
        }, 400);
      }

      if (teamCount > 8) {
        const msg = `Maximum 8 teams for single elimination bracket. Currently have ${teamCount} approved teams. Deny some before generating.`;
        console.log(`Bracket generation blocked: ${msg}`);
        return c.json({
          error: msg,
        }, 400);
      }

      // ── Calculate seeding for all teams ──
      const allUnrankedPlayers: { teamName: string; name: string; userId: string | null }[] = [];
      const teamSeeds: { teamId: string; teamName: string; avgRank: number; playerCount: number }[] = [];

      for (const team of teams) {
        const seedData = await calculateTeamSeedRank(supabase, team.id, tournament.tournament_type);

        if (seedData.unrankedPlayers.length > 0) {
          for (const p of seedData.unrankedPlayers) {
            allUnrankedPlayers.push({ teamName: team.team_name, ...p });
          }
        }

        teamSeeds.push({
          teamId: team.id,
          teamName: team.team_name,
          avgRank: seedData.avgRank,
          playerCount: seedData.playerCount,
        });
      }

      // Block if any players are unranked
      if (allUnrankedPlayers.length > 0) {
        const msg = `Cannot generate bracket — ${allUnrankedPlayers.length} player(s) have no rank set.`;
        console.log(`Bracket generation blocked: ${msg}`, allUnrankedPlayers.map(p => `${p.teamName}: ${p.name}`));
        return c.json({
          error: 'Cannot generate bracket — some players have no rank set.',
          unrankedPlayers: allUnrankedPlayers,
          message: `${allUnrankedPlayers.length} player(s) need ranks before roster lock. Use the officer rank override tool to set them.`,
        }, 400);
      }

      // Sort by avgRank descending (highest rank = seed 1)
      teamSeeds.sort((a, b) => b.avgRank - a.avgRank);

      // Assign seed numbers 1-N
      const seededTeams: Map<number, { teamId: string; teamName: string; avgRank: number }> = new Map();
      teamSeeds.forEach((t, i) => {
        seededTeams.set(i + 1, t);
      });

      console.log(`Bracket seeding for "${tournament.name}":`, teamSeeds.map((t, i) => `Seed ${i + 1}: ${t.teamName} (avg ${t.avgRank.toFixed(1)})`));

      // Determine best-of for each round from tournament config or defaults
      const bestOfQF = tournament.bracket_config?.best_of_qf || 1;
      const bestOfSF = tournament.bracket_config?.best_of_sf || 3;
      const bestOfGF = tournament.bracket_config?.best_of_gf || 5;

      const bestOfByRound: Record<string, number> = {
        QF: bestOfQF,
        SF: bestOfSF,
        GF: bestOfGF,
      };

      // ── Create series rows (bottom-up: GF first, then SF, then QF) ──
      // We need GF/SF IDs first so QF rows can reference them via next_series_id

      // Step 1: Create GF series
      const gfTemplate = BRACKET_TEMPLATE.GF[0];
      const { data: gfSeries, error: gfErr } = await supabase
        .from('kkup_bracket_series')
        .insert({
          tournament_id: tournamentId,
          round: 'GF',
          position: gfTemplate.position,
          best_of: bestOfByRound.GF,
          status: 'pending',
        })
        .select()
        .single();

      if (gfErr) {
        return c.json({ error: `Failed to create GF series: ${gfErr.message}` }, 500);
      }

      // Step 2: Create SF series (linking to GF)
      const sfSeriesMap: Record<number, string> = {}; // position -> series ID

      for (const sfTemplate of BRACKET_TEMPLATE.SF) {
        const { data: sfSeries, error: sfErr } = await supabase
          .from('kkup_bracket_series')
          .insert({
            tournament_id: tournamentId,
            round: 'SF',
            position: sfTemplate.position,
            best_of: bestOfByRound.SF,
            status: 'pending',
            next_series_id: gfSeries.id,
            next_series_slot: sfTemplate.nextSlot,
          })
          .select()
          .single();

        if (sfErr) {
          // Cleanup GF on failure
          await supabase.from('kkup_bracket_series').delete().eq('tournament_id', tournamentId);
          return c.json({ error: `Failed to create SF series: ${sfErr.message}` }, 500);
        }

        sfSeriesMap[sfTemplate.position] = sfSeries.id;
      }

      // Step 3: Create QF series (linking to SF, with teams assigned)
      const qfResults: any[] = [];

      for (const qfTemplate of BRACKET_TEMPLATE.QF) {
        const radiantTeam = seededTeams.get(qfTemplate.seedRadiant);
        const direTeam = seededTeams.get(qfTemplate.seedDire);

        // Determine the target SF series
        const nextSeriesId = sfSeriesMap[qfTemplate.nextPosition];

        // Determine if this is a bye (dire seed doesn't exist because < 8 teams)
        const isBye = !direTeam;

        const { data: qfSeries, error: qfErr } = await supabase
          .from('kkup_bracket_series')
          .insert({
            tournament_id: tournamentId,
            round: 'QF',
            position: qfTemplate.position,
            seed_radiant: qfTemplate.seedRadiant,
            seed_dire: isBye ? null : qfTemplate.seedDire,
            radiant_team_id: radiantTeam?.teamId || null,
            dire_team_id: isBye ? null : (direTeam?.teamId || null),
            best_of: bestOfByRound.QF,
            status: isBye ? 'bye' : 'pending',
            winner_team_id: isBye ? (radiantTeam?.teamId || null) : null,
            next_series_id: nextSeriesId,
            next_series_slot: qfTemplate.nextSlot,
            completed_at: isBye ? new Date().toISOString() : null,
          })
          .select()
          .single();

        if (qfErr) {
          await supabase.from('kkup_bracket_series').delete().eq('tournament_id', tournamentId);
          return c.json({ error: `Failed to create QF${qfTemplate.position} series: ${qfErr.message}` }, 500);
        }

        qfResults.push({ ...qfSeries, isBye });

        // If bye, auto-advance the winner to the SF
        if (isBye && radiantTeam) {
          const slotColumn = qfTemplate.nextSlot === 'radiant' ? 'radiant_team_id' : 'dire_team_id';
          const seedColumn = qfTemplate.nextSlot === 'radiant' ? 'seed_radiant' : 'seed_dire';

          await supabase
            .from('kkup_bracket_series')
            .update({
              [slotColumn]: radiantTeam.teamId,
              [seedColumn]: qfTemplate.seedRadiant,
            })
            .eq('id', nextSeriesId);
        }
      }

      // Step 4: Pre-create game 1 match rows for non-bye QF series
      for (const qf of qfResults) {
        if (qf.isBye) continue;

        const { error: matchErr } = await supabase
          .from('kkup_bracket_matches')
          .insert({
            series_id: qf.id,
            game_number: 1,
            radiant_team_id: qf.radiant_team_id,
            dire_team_id: qf.dire_team_id,
            status: 'pending',
          });

        if (matchErr) {
          console.error(`Non-critical: Failed to pre-create match for QF${qf.position}: ${matchErr.message}`);
        }
      }

      // Log admin action (non-critical)
      try {
        const byeCount = qfResults.filter(q => q.isBye).length;
        const seedingSummary = teamSeeds.map((t, i) => `${i + 1}. ${t.teamName}`).join(', ');
        await createAdminLog({
          type: 'bracket_generated',
          action: `Generated ${teamCount}-team bracket for "${tournament.name}"${byeCount > 0 ? ` (${byeCount} bye${byeCount > 1 ? 's' : ''})` : ''}. Seeding: ${seedingSummary}`,
          actor_id: auth.dbUser.id,
          actor_name: auth.dbUser.discord_username,
          details: {
            tournament_id: tournamentId,
            team_count: teamCount,
            bye_count: byeCount,
            seeding: teamSeeds.map((t, i) => ({ seed: i + 1, team: t.teamName, avgRank: t.avgRank })),
          },
        });
      } catch (_) { /* non-critical */ }

      // Rename Discord team voice channels to show seeding (non-critical)
      // Maps seed 1 → channel[0] "1st Seed: CDGS", seed 2 → channel[1] "2nd Seed: FTHOG", etc.
      try {
        const teamLookup = new Map(teams.map((t: any) => [t.id, t]));
        const seededTeamsForDiscord = teamSeeds.map((t, i) => ({
          seed: i + 1,
          teamTag: teamLookup.get(t.teamId)?.team_tag || t.teamName.substring(0, 4),
        }));
        const result = await renameTeamVoiceChannels(seededTeamsForDiscord);
        console.log(`Discord voice channel rename: ${result.renamed} renamed, ${result.failed} failed`);
      } catch (vcErr) {
        console.error('Non-critical: Discord voice channel rename failed:', vcErr);
      }

      // Send bracket generated webhook to #kkup-updates (non-critical)
      try {
        const byeCount = qfResults.filter(q => q.isBye).length;
        const seedingLines = teamSeeds.map((t, i) => `**${i + 1}.** ${t.teamName}`).join('\n');
        await sendWebhookEmbed(DISCORD_WEBHOOKS.BRACKET_UPDATE, {
          title: `🌽 Bracket Generated — ${tournament.name}`,
          description: `${teamCount}-team single elimination bracket is live!${byeCount > 0 ? ` (${byeCount} bye${byeCount > 1 ? 's' : ''})` : ''}\n\n**Seeding:**\n${seedingLines}`,
          color: 0xD6A615, // harvest gold
          footer: { text: 'Voice channels have been renamed to match seedings.' },
        });
      } catch (_) { /* non-critical */ }

      return c.json({
        success: true,
        message: `Bracket generated for "${tournament.name}" with ${teamCount} teams.`,
        teamCount,
        byeCount: qfResults.filter(q => q.isBye).length,
        seeding: teamSeeds.map((t, i) => ({
          seed: i + 1,
          teamId: t.teamId,
          teamName: t.teamName,
          avgRank: Math.round(t.avgRank * 10) / 10,
        })),
      });

    } catch (error: any) {
      console.error('Bracket generation error:', error);
      return c.json({ error: `Internal server error during bracket generation: ${error.message}` }, 500);
    }
  });


  // ═══════════════════════════════════════════════════════
  // 2. GET BRACKET (Public)
  // ═══════════════════════════════════════════════════════

  app.get(`${PREFIX}/kkup/tournaments/:id/bracket`, async (c) => {
    try {
      const tournamentId = c.req.param('id');

      // Fetch all series for this tournament
      const { data: series, error: sErr } = await supabase
        .from('kkup_bracket_series')
        .select(`
          *,
          radiant_team:kkup_teams!radiant_team_id ( id, team_name, team_tag, logo_url ),
          dire_team:kkup_teams!dire_team_id ( id, team_name, team_tag, logo_url ),
          winner_team:kkup_teams!winner_team_id ( id, team_name, team_tag, logo_url )
        `)
        .eq('tournament_id', tournamentId)
        .order('round')
        .order('position');

      if (sErr) {
        return c.json({ error: `Failed to fetch bracket: ${sErr.message}` }, 500);
      }

      if (!series || series.length === 0) {
        return c.json({ bracket: null, message: 'No bracket generated yet.' });
      }

      // Fetch all matches for these series
      const seriesIds = series.map((s: any) => s.id);
      const { data: matches, error: mErr } = await supabase
        .from('kkup_bracket_matches')
        .select(`
          *,
          radiant_team:kkup_teams!radiant_team_id ( id, team_name, team_tag, logo_url ),
          dire_team:kkup_teams!dire_team_id ( id, team_name, team_tag, logo_url ),
          winner_team:kkup_teams!winner_team_id ( id, team_name, team_tag, logo_url )
        `)
        .in('series_id', seriesIds)
        .order('game_number');

      if (mErr) {
        console.error('Failed to fetch bracket matches:', mErr);
      }

      // Group matches by series
      const matchesBySeries: Record<string, any[]> = {};
      for (const match of (matches || [])) {
        if (!matchesBySeries[match.series_id]) {
          matchesBySeries[match.series_id] = [];
        }
        matchesBySeries[match.series_id].push(match);
      }

      // Attach matches to series
      const enrichedSeries = series.map((s: any) => ({
        ...s,
        matches: matchesBySeries[s.id] || [],
      }));

      // Organize by round for easy frontend consumption
      const bracket = {
        QF: enrichedSeries.filter((s: any) => s.round === 'QF').sort((a: any, b: any) => a.position - b.position),
        SF: enrichedSeries.filter((s: any) => s.round === 'SF').sort((a: any, b: any) => a.position - b.position),
        GF: enrichedSeries.filter((s: any) => s.round === 'GF'),
      };

      return c.json({ bracket });

    } catch (error: any) {
      console.error('Fetch bracket error:', error);
      return c.json({ error: `Internal server error fetching bracket: ${error.message}` }, 500);
    }
  });


  // ═══════════════════════════════════════════════════════
  // 3. DELETE BRACKET (Owner only — for re-generation)
  // ═══════════════════════════════════════════════════════

  app.delete(`${PREFIX}/kkup/tournaments/:id/bracket`, async (c) => {
    try {
      const auth = await requireOwner(c);
      if (!auth.ok) return auth.response;

      const tournamentId = c.req.param('id');

      // Fetch tournament to validate
      const { data: tournament } = await supabase
        .from('kkup_tournaments')
        .select('id, name, status')
        .eq('id', tournamentId)
        .single();

      if (!tournament) {
        return c.json({ error: 'Tournament not found' }, 404);
      }

      // Don't allow deletion if tournament is live or completed (safety valve)
      if (['live', 'completed'].includes(tournament.status)) {
        return c.json({
          error: `Cannot delete bracket while tournament is "${tournament.status}". Change status first.`,
        }, 400);
      }

      // Delete all matches first (FK cascade should handle this, but be explicit)
      const { data: series } = await supabase
        .from('kkup_bracket_series')
        .select('id')
        .eq('tournament_id', tournamentId);

      if (series?.length > 0) {
        const seriesIds = series.map((s: any) => s.id);
        await supabase
          .from('kkup_bracket_matches')
          .delete()
          .in('series_id', seriesIds);
      }

      // Delete all series
      const { error: delErr } = await supabase
        .from('kkup_bracket_series')
        .delete()
        .eq('tournament_id', tournamentId);

      if (delErr) {
        return c.json({ error: `Failed to delete bracket: ${delErr.message}` }, 500);
      }

      // Admin log (non-critical)
      try {
        await createAdminLog({
          type: 'bracket_deleted',
          action: `Deleted bracket for "${tournament.name}"`,
          actor_id: auth.dbUser.id,
          actor_name: auth.dbUser.discord_username,
          details: { tournament_id: tournamentId },
        });
      } catch (_) { /* non-critical */ }

      // Reset Discord team voice channels back to "Team 1", "Team 2", etc. (non-critical)
      try {
        await resetTeamVoiceChannels();
        console.log('Discord voice channels reset to defaults');
      } catch (vcErr) {
        console.error('Non-critical: Discord voice channel reset failed:', vcErr);
      }

      return c.json({
        success: true,
        message: `Bracket deleted for "${tournament.name}". You can now re-generate.`,
      });

    } catch (error: any) {
      console.error('Delete bracket error:', error);
      return c.json({ error: `Internal server error deleting bracket: ${error.message}` }, 500);
    }
  });


  // ═══════════════════════════════════════════════════════
  // 4. RECORD SERIES WINNER (Officer+)
  // ═══════════════════════════════════════════════════════

  app.post(`${PREFIX}/kkup/tournaments/:id/bracket/series/:seriesId/result`, async (c) => {
    try {
      const auth = await requireAuth(c);
      if (!auth.ok) return auth.response;

      const tournamentId = c.req.param('id');
      const seriesId = c.req.param('seriesId');
      const { winner_team_id: winnerTeamId } = await c.req.json();

      if (!winnerTeamId) {
        return c.json({ error: 'Missing winner_team_id in request body' }, 400);
      }

      // Fetch tournament
      const { data: tournament } = await supabase
        .from('kkup_tournaments')
        .select('id, name, status')
        .eq('id', tournamentId)
        .single();

      if (!tournament) {
        return c.json({ error: 'Tournament not found' }, 404);
      }

      if (tournament.status !== 'live') {
        return c.json({
          error: `Cannot record series results while tournament is "${tournament.status}". Tournament must be "live".`,
        }, 400);
      }

      // Fetch series with joined team data (we need team_tag for Discord channels)
      const { data: series } = await supabase
        .from('kkup_bracket_series')
        .select(`
          *,
          radiant_team:kkup_teams!radiant_team_id ( id, team_name, team_tag ),
          dire_team:kkup_teams!dire_team_id ( id, team_name, team_tag )
        `)
        .eq('id', seriesId)
        .single();

      if (!series) {
        return c.json({ error: 'Series not found' }, 404);
      }

      if (series.tournament_id !== tournamentId) {
        return c.json({ error: 'Series does not belong to this tournament' }, 400);
      }

      if (series.status === 'completed') {
        return c.json({ error: 'Series already has a recorded result' }, 409);
      }

      // Validate winner is one of the two teams
      const winnerIsRadiant = winnerTeamId === series.radiant_team_id;
      const winnerIsDire = winnerTeamId === series.dire_team_id;
      if (!winnerIsRadiant && !winnerIsDire) {
        return c.json({ error: `Team ${winnerTeamId} is not part of this series.` }, 400);
      }

      // Determine winner/loser data
      const winnerTeam = winnerIsRadiant ? series.radiant_team : series.dire_team;
      const loserTeam = winnerIsRadiant ? series.dire_team : series.radiant_team;
      const winnerSeed = winnerIsRadiant ? series.seed_radiant : series.seed_dire;
      const loserSeed = winnerIsRadiant ? series.seed_dire : series.seed_radiant;

      // ── Mark series completed ──
      const { error: updateErr } = await supabase
        .from('kkup_bracket_series')
        .update({
          winner_team_id: winnerTeamId,
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', seriesId);

      if (updateErr) {
        return c.json({ error: `Failed to update series: ${updateErr.message}` }, 500);
      }

      // ── Advance winner to next series ──
      const isGrandFinal = series.round === 'GF';

      if (series.next_series_id && !isGrandFinal) {
        const slotColumn = series.next_series_slot === 'radiant' ? 'radiant_team_id' : 'dire_team_id';
        const seedColumn = series.next_series_slot === 'radiant' ? 'seed_radiant' : 'seed_dire';

        const { data: nextSeries, error: advErr } = await supabase
          .from('kkup_bracket_series')
          .update({
            [slotColumn]: winnerTeamId,
            [seedColumn]: winnerSeed,
          })
          .eq('id', series.next_series_id)
          .select()
          .single();

        if (advErr) {
          console.error(`Failed to advance winner to next series: ${advErr.message}`);
          // Don't fail the whole request — series is already marked completed
        }

        // If next series now has both teams, pre-create game 1 match
        if (nextSeries?.radiant_team_id && nextSeries?.dire_team_id) {
          try {
            await supabase
              .from('kkup_bracket_matches')
              .insert({
                series_id: nextSeries.id,
                game_number: 1,
                radiant_team_id: nextSeries.radiant_team_id,
                dire_team_id: nextSeries.dire_team_id,
                status: 'pending',
              });
          } catch (matchErr) {
            console.error('Non-critical: Failed to pre-create match for next series:', matchErr);
          }
        }
      }

      // ── Discord voice channel updates (non-critical) ──

      // Rename loser's channel to "Xth Seed: Eliminated"
      try {
        if (loserSeed && loserSeed >= 1 && loserSeed <= DISCORD_TEAM_VOICE_CHANNELS.length) {
          const channelId = DISCORD_TEAM_VOICE_CHANNELS[loserSeed - 1];
          await renameDiscordChannel(channelId, `${ordinal(loserSeed)} Seed: Eliminated`);
        }
      } catch (vcErr) {
        console.error('Non-critical: loser channel rename failed:', vcErr);
      }

      // If GF, also rename champion's channel and loser's (runner-up)
      if (isGrandFinal) {
        try {
          if (winnerSeed && winnerSeed >= 1 && winnerSeed <= DISCORD_TEAM_VOICE_CHANNELS.length) {
            const channelId = DISCORD_TEAM_VOICE_CHANNELS[winnerSeed - 1];
            const tag = winnerTeam?.team_tag?.toUpperCase() || winnerTeam?.team_name?.substring(0, 4).toUpperCase() || 'CHAMP';
            await renameDiscordChannel(channelId, `🌽 CHAMPION: ${tag}`);
          }
        } catch (vcErr) {
          console.error('Non-critical: champion channel rename failed:', vcErr);
        }
      }

      // ── Webhook to #kkup-updates (non-critical) ──
      try {
        const ROUND_LABELS: Record<string, string> = { QF: 'Quarterfinal', SF: 'Semifinal', GF: 'Grand Final' };
        const roundLabel = ROUND_LABELS[series.round] || series.round;
        const winnerName = winnerTeam?.team_name || 'Unknown';
        const loserName = loserTeam?.team_name || 'Unknown';

        if (isGrandFinal) {
          // Special champion embed
          await sendWebhookEmbed(DISCORD_WEBHOOKS.BRACKET_UPDATE, {
            title: `🌽👑 CHAMPION — ${tournament.name}`,
            description: `**${winnerName}** has won the ${tournament.name}!\n\nDefeated **${loserName}** in the Grand Final.`,
            color: 0xF1C60F, // kernel gold
          });
        } else {
          await sendWebhookEmbed(DISCORD_WEBHOOKS.BRACKET_UPDATE, {
            title: `⚔️ ${roundLabel} Result — ${tournament.name}`,
            description: `**${winnerName}** defeated **${loserName}** and advances!`,
            color: 0xD6A615,
          });
        }
      } catch (_) { /* non-critical */ }

      // ── Admin log (non-critical) ──
      try {
        await createAdminLog({
          type: 'series_result_recorded',
          action: `Recorded ${series.round}${series.position} result for "${tournament.name}": ${winnerTeam?.team_name || 'Unknown'} defeats ${loserTeam?.team_name || 'Unknown'}${isGrandFinal ? ' — TOURNAMENT CHAMPION!' : ''}`,
          actor_id: auth.dbUser.id,
          actor_name: auth.dbUser.discord_username,
          details: {
            tournament_id: tournamentId,
            series_id: seriesId,
            round: series.round,
            position: series.position,
            winner_team_id: winnerTeamId,
            winner_name: winnerTeam?.team_name,
            loser_name: loserTeam?.team_name,
            is_grand_final: isGrandFinal,
          },
        });
      } catch (_) { /* non-critical */ }

      return c.json({
        success: true,
        message: isGrandFinal
          ? `🌽 ${winnerTeam?.team_name} wins ${tournament.name}!`
          : `${winnerTeam?.team_name} advances from ${series.round}${series.position}.`,
        is_grand_final: isGrandFinal,
        winner: { id: winnerTeamId, name: winnerTeam?.team_name, seed: winnerSeed },
        loser: { id: loserTeam?.id, name: loserTeam?.team_name, seed: loserSeed },
      });

    } catch (error: any) {
      console.error('Record series result error:', error);
      return c.json({ error: `Internal server error recording series result: ${error.message}` }, 500);
    }
  });


  // ═══════════════════════════════════════════════════════
  // 5. RESET DISCORD VOICE CHANNELS (Owner only)
  // ═══════════════════════════════════════════════════════

  app.post(`${PREFIX}/kkup/voice-channels/reset`, async (c) => {
    try {
      const auth = await requireOwner(c);
      if (!auth.ok) return auth.response;

      // Reset Discord team voice channels back to "Team 1", "Team 2", etc. (non-critical)
      try {
        await resetTeamVoiceChannels();
        console.log('Discord voice channels reset to defaults');
      } catch (vcErr) {
        console.error('Non-critical: Discord voice channel reset failed:', vcErr);
      }

      return c.json({
        success: true,
        message: 'Discord voice channels reset to defaults.',
      });

    } catch (error: any) {
      console.error('Reset voice channels error:', error);
      return c.json({ error: `Internal server error resetting voice channels: ${error.message}` }, 500);
    }
  });

}