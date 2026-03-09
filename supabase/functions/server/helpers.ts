/**
 * Shared helper functions for The Corn Field server
 * Used across multiple route modules
 */

// Convert Steam logo ID to URL
export const getSteamLogoUrl = (logoId: number | string | null): string | null => {
  if (!logoId) return null;
  return `https://steamcdn-a.akamaihd.net/apps/dota2/images/team_logos/${logoId}.png`;
};

// Convert Steam32 ID to Steam64 ID
export const steam32ToSteam64 = (steam32: number): string => {
  return (BigInt(steam32) + BigInt('76561197960265728')).toString();
};

// Normalize Steam IDs between various formats
export const normalizePlayerId = (input: string): { steam32: string; steam64: string; original: string } => {
  const cleaned = input.trim();
  const STEAM_64_OFFSET = BigInt('76561197960265728');
  
  // If it looks like a Steam64 ID (17 digits, starts with 7656)
  if (/^\d{17}$/.test(cleaned) && cleaned.startsWith('7656')) {
    const steam32 = (BigInt(cleaned) - STEAM_64_OFFSET).toString();
    return { steam32, steam64: cleaned, original: cleaned };
  }
  
  // If it's a regular number (Steam32 account ID)
  if (/^\d+$/.test(cleaned)) {
    const steam64 = (BigInt(cleaned) + STEAM_64_OFFSET).toString();
    return { steam32: cleaned, steam64, original: cleaned };
  }
  
  // If it's a Steam profile URL
  const profileMatch = cleaned.match(/steamcommunity\.com\/profiles\/(\d+)/);
  if (profileMatch) {
    const id = profileMatch[1];
    if (id.length === 17 && id.startsWith('7656')) {
      const steam32 = (BigInt(id) - STEAM_64_OFFSET).toString();
      return { steam32, steam64: id, original: cleaned };
    }
    return { steam32: id, steam64: (BigInt(id) + STEAM_64_OFFSET).toString(), original: cleaned };
  }
  
  // Fallback -- treat as Steam32
  return { steam32: cleaned, steam64: '', original: cleaned };
};

// Get Steam avatar URL from hash
export const getSteamAvatarUrl = (avatarHash: string | null): string | null => {
  if (!avatarHash) return null;
  return `https://avatars.steamstatic.com/${avatarHash}_full.jpg`;
};

// Hero ID ↔ Name mapping (shared across routes)
const heroMap: Record<number, string> = {
    1: 'Anti-Mage', 2: 'Axe', 3: 'Bane', 4: 'Bloodseeker', 5: 'Crystal Maiden',
    6: 'Drow Ranger', 7: 'Earthshaker', 8: 'Juggernaut', 9: 'Mirana', 10: 'Morphling',
    11: 'Shadow Fiend', 12: 'Phantom Lancer', 13: 'Puck', 14: 'Pudge', 15: 'Razor',
    16: 'Sand King', 17: 'Storm Spirit', 18: 'Sven', 19: 'Tiny', 20: 'Vengeful Spirit',
    21: 'Windranger', 22: 'Zeus', 23: 'Kunkka', 25: 'Lina', 26: 'Lion',
    27: 'Shadow Shaman', 28: 'Slardar', 29: 'Tidehunter', 30: 'Witch Doctor', 31: 'Lich',
    32: 'Riki', 33: 'Enigma', 34: 'Tinker', 35: 'Sniper', 36: 'Necrophos',
    37: 'Warlock', 38: 'Beastmaster', 39: 'Queen of Pain', 40: 'Venomancer', 41: 'Faceless Void',
    42: 'Wraith King', 43: 'Death Prophet', 44: 'Phantom Assassin', 45: 'Pugna', 46: 'Templar Assassin',
    47: 'Viper', 48: 'Luna', 49: 'Dragon Knight', 50: 'Dazzle', 51: 'Clockwerk',
    52: 'Leshrac', 53: "Nature's Prophet", 54: 'Lifestealer', 55: 'Dark Seer', 56: 'Clinkz',
    57: 'Omniknight', 58: 'Enchantress', 59: 'Huskar', 60: 'Night Stalker', 61: 'Broodmother',
    62: 'Bounty Hunter', 63: 'Weaver', 64: 'Jakiro', 65: 'Batrider', 66: 'Chen',
    67: 'Spectre', 68: 'Ancient Apparition', 69: 'Doom', 70: 'Ursa', 71: 'Spirit Breaker',
    72: 'Gyrocopter', 73: 'Alchemist', 74: 'Invoker', 75: 'Silencer', 76: 'Outworld Destroyer',
    77: 'Lycan', 78: 'Brewmaster', 79: 'Shadow Demon', 80: 'Lone Druid', 81: 'Chaos Knight',
    82: 'Meepo', 83: 'Treant Protector', 84: 'Ogre Magi', 85: 'Undying', 86: 'Rubick',
    87: 'Disruptor', 88: 'Nyx Assassin', 89: 'Naga Siren', 90: 'Keeper of the Light', 91: 'Io',
    92: 'Visage', 93: 'Slark', 94: 'Medusa', 95: 'Troll Warlord', 96: 'Centaur Warrunner',
    97: 'Magnus', 98: 'Timbersaw', 99: 'Bristleback', 100: 'Tusk', 101: 'Skywrath Mage',
    102: 'Abaddon', 103: 'Elder Titan', 104: 'Legion Commander', 105: 'Techies', 106: 'Ember Spirit',
    107: 'Earth Spirit', 108: 'Underlord', 109: 'Terrorblade', 110: 'Phoenix', 111: 'Oracle',
    112: 'Winter Wyvern', 113: 'Arc Warden', 114: 'Monkey King', 119: 'Dark Willow', 120: 'Pangolier',
    121: 'Grimstroke', 123: 'Hoodwink', 126: 'Void Spirit', 128: 'Snapfire', 129: 'Mars',
    135: 'Dawnbreaker', 136: 'Marci', 137: 'Primal Beast', 138: 'Muerta', 145: 'Ringmaster', 146: 'Kez',
};

// Reverse mapping: hero display name → hero ID (case-insensitive)
const heroNameToId: Record<string, number> = {};
for (const [id, name] of Object.entries(heroMap)) {
  heroNameToId[name.toLowerCase()] = Number(id);
}
// Also add common alternate spellings
heroNameToId['outworld devourer'] = 76;
heroNameToId['skeleton king'] = 42;
heroNameToId['windrunner'] = 21;
heroNameToId["nature's prophet"] = 53;
heroNameToId['necrolyte'] = 36;

// Get hero name from hero ID
export const getHeroName = (heroId: number): string => {
  return heroMap[heroId] || `Hero ${heroId}`;
};

// Get hero ID from display name (case-insensitive) — returns 0 if not found
export const getHeroIdFromName = (heroName: string | null | undefined): number => {
  if (!heroName) return 0;
  return heroNameToId[heroName.toLowerCase()] || 0;
};

// Route prefix constant
export const PREFIX = '/make-server-4789f4af';

// ══════════════════════════════════════════════════════
// AUTH HELPERS — shared across route modules
// ══════════════════════════════════════════════════════

type AuthResult =
  | { ok: true; authUser: any; dbUser: any }
  | { ok: false; response: any };

/**
 * Verify token + return user (any authenticated role).
 * Used by routes that require login but not a specific role.
 */
export async function requireAuth(c: any, supabase: any, anonSupabase: any): Promise<AuthResult> {
  const accessToken = c.req.header('Authorization')?.split(' ')[1];
  if (!accessToken) return { ok: false, response: c.json({ error: 'No access token provided' }, 401) };
  const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
  if (authError || !authUser) return { ok: false, response: c.json({ error: 'Unauthorized — invalid or expired token' }, 401) };
  const { data: dbUser } = await supabase.from('users').select('*').eq('supabase_id', authUser.id).single();
  if (!dbUser) return { ok: false, response: c.json({ error: 'User not found in database' }, 404) };
  return { ok: true, authUser, dbUser };
}

/**
 * Verify token + require owner role.
 * Used by tournament CRUD routes restricted to the site owner.
 */
export async function requireOwner(c: any, supabase: any, anonSupabase: any): Promise<AuthResult> {
  const accessToken = c.req.header('Authorization')?.split(' ')[1];
  if (!accessToken) return { ok: false, response: c.json({ error: 'No access token provided' }, 401) };
  const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
  if (authError || !authUser) return { ok: false, response: c.json({ error: 'Unauthorized — invalid or expired token' }, 401) };
  const { data: dbUser } = await supabase.from('users').select('*').eq('supabase_id', authUser.id).single();
  if (!dbUser || dbUser.role !== 'owner') return { ok: false, response: c.json({ error: 'Forbidden — only the owner can perform this action' }, 403) };
  return { ok: true, authUser, dbUser };
}

// ══════════════════════════════════════════════════════
// PERSON RESOLUTION — shared across route modules
// ══════════════════════════════════════════════════════

/**
 * Resolve a users row → kkup_persons row via steam_id.
 *   1. Steam ID lookup: kkup_persons.steam_id = users.steam_id
 *   2. Create new: insert a kkup_persons record
 *
 * Returns { person, created: boolean } or { error: string }
 */
export async function resolvePersonForUser(
  supabase: any,
  dbUser: any,
): Promise<{ person: any; created: boolean } | { error: string }> {
  // 1. Steam ID lookup (primary method — steam_id is the join key)
  if (dbUser.steam_id) {
    const { data: steamMatch } = await supabase
      .from('kkup_persons')
      .select('*')
      .eq('steam_id', dbUser.steam_id)
      .maybeSingle();

    if (steamMatch) return { person: steamMatch, created: false };
  }

  // 2. Create new kkup_persons record
  const displayName = dbUser.discord_username || dbUser.email || 'Unknown Player';
  const steamId = dbUser.steam_id || `tcf_user_${dbUser.id}`;

  const { data: newPerson, error: insertError } = await supabase
    .from('kkup_persons')
    .insert({
      steam_id: steamId,
      display_name: displayName,
      avatar_url: dbUser.discord_avatar || null,
    })
    .select()
    .single();

  if (insertError) {
    console.error('Failed to create kkup_persons record:', insertError);
    return { error: `Failed to create player profile: ${insertError.message}` };
  }

  return { person: newPerson, created: true };
}

// ═════════════════════════════════════════════════════
// COACH ASSIGNMENT DUAL-WRITE — shared across route modules
// ══════════════════════════════════════════════════════
// During migration, writes go to BOTH kkup_teams.coach_person_id (legacy column)
// and kkup_coach_assignments (new table). Reads will migrate gradually.
// Once reads are fully on the new table, the legacy column can be dropped.

/**
 * Set a coach for a team — dual-writes to both kkup_coach_assignments and kkup_teams.coach_person_id.
 * Uses UPSERT on team_id (one coach per team). Non-throwing: returns { ok, error? }.
 *
 * @param tournamentId — required by kkup_coach_assignments.tournament_id (NOT NULL).
 *   If not provided, falls back to looking up the team's tournament_id from kkup_teams.
 */
export async function setCoachAssignment(
  supabase: any,
  teamId: string,
  personId: string,
  tournamentId?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    // Resolve tournament_id if not provided
    let resolvedTournamentId = tournamentId;
    if (!resolvedTournamentId) {
      const { data: teamRow } = await supabase
        .from('kkup_teams').select('tournament_id').eq('id', teamId).single();
      resolvedTournamentId = teamRow?.tournament_id;
      if (!resolvedTournamentId) {
        console.error(`setCoachAssignment: could not resolve tournament_id for team ${teamId}`);
        return { ok: false, error: 'Could not resolve tournament_id for team' };
      }
    }

    // 1. Delete any existing assignment for this team, then insert the new one.
    // (The table may lack a unique constraint on team_id, so upsert won't work.)
    await supabase.from('kkup_coach_assignments').delete().eq('team_id', teamId);
    const { error: assignError } = await supabase
      .from('kkup_coach_assignments')
      .insert({ team_id: teamId, person_id: personId, tournament_id: resolvedTournamentId, assigned_at: new Date().toISOString() });
    if (assignError) {
      console.error(`Coach assignment insert failed for team ${teamId}:`, assignError);
      return { ok: false, error: assignError.message };
    }

    // 2. Legacy column update (kkup_teams.coach_person_id) — kept in sync during migration
    const { error: legacyError } = await supabase
      .from('kkup_teams')
      .update({ coach_person_id: personId })
      .eq('id', teamId);
    if (legacyError) {
      console.error(`Legacy coach_person_id update failed for team ${teamId}:`, legacyError);
      // Non-fatal: new table has the correct data, legacy is best-effort during migration
    }

    return { ok: true };
  } catch (err: any) {
    console.error(`setCoachAssignment unexpected error for team ${teamId}:`, err);
    return { ok: false, error: err.message };
  }
}

/**
 * Clear the coach assignment for a team — removes from kkup_coach_assignments and nulls kkup_teams.coach_person_id.
 * Non-throwing: returns { ok, error? }.
 */
export async function clearCoachAssignment(
  supabase: any,
  teamId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    // 1. Delete from kkup_coach_assignments (new table)
    const { error: deleteError } = await supabase
      .from('kkup_coach_assignments')
      .delete()
      .eq('team_id', teamId);
    if (deleteError) {
      console.error(`Coach assignment delete failed for team ${teamId}:`, deleteError);
      return { ok: false, error: deleteError.message };
    }

    // 2. Legacy column null (kkup_teams.coach_person_id)
    const { error: legacyError } = await supabase
      .from('kkup_teams')
      .update({ coach_person_id: null })
      .eq('id', teamId);
    if (legacyError) {
      console.error(`Legacy coach_person_id null failed for team ${teamId}:`, legacyError);
      // Non-fatal: new table is already correct
    }

    return { ok: true };
  } catch (err: any) {
    console.error(`clearCoachAssignment unexpected error for team ${teamId}:`, err);
    return { ok: false, error: err.message };
  }
}

/**
 * Disband a team when its captain withdraws from the tournament.
 *
 * This is the shared "captain withdrawal = team disband" logic used by both:
 *   - DELETE /register (player withdrawal)
 *   - DELETE /apply-staff (TD step-down with plans_to_play)
 *
 * Steps:
 *   1. Reset displaced roster members' registrations to free_agent
 *   2. Delete all roster entries
 *   3. Clear coach assignment (if any)
 *   4. Expire all pending invites
 *   5. Hard-delete the team
 *   6. Notify displaced teammates, coach, and admin log
 *
 * Returns the list of displaced person IDs (for the caller to use if needed).
 */
export async function disbandCaptainTeam(
  supabase: any,
  opts: {
    team: { id: string; team_name: string; coach_person_id?: string | null; approval_status?: string };
    tournamentId: string;
    tournamentName: string;
    captainPerson: { id: string; display_name: string; steam_id?: string };
    authDbUserId: string;
    /** Import these from routes-notifications.ts — passed in to avoid circular deps */
    createNotification: (opts: any) => Promise<void>;
    createUserActivity: (opts: any) => Promise<void>;
    createAdminLog: (opts: any) => Promise<void>;
  },
): Promise<{ ok: boolean; displacedPersonIds: string[]; error?: string }> {
  const { team, tournamentId, tournamentName, captainPerson } = opts;

  try {
    // 1. Get all roster members (excluding the withdrawing captain)
    const { data: rosterMembers } = await supabase
      .from('kkup_team_rosters')
      .select('person_id')
      .eq('team_id', team.id);

    const displacedPersonIds = (rosterMembers || [])
      .map((r: any) => r.person_id)
      .filter((pid: string) => pid !== captainPerson.id);

    // 2. Reset displaced players' registrations to free_agent
    if (displacedPersonIds.length > 0) {
      const { error: revertError } = await supabase
        .from('kkup_registrations')
        .update({ status: 'free_agent' })
        .eq('tournament_id', tournamentId)
        .in('person_id', displacedPersonIds)
        .eq('status', 'on_team');

      if (revertError) {
        console.error('Roster player revert during captain withdrawal error:', revertError);
      }
    }

    // 3. Delete ALL roster entries for this team (captain included)
    const { error: rosterDeleteError } = await supabase
      .from('kkup_team_rosters')
      .delete()
      .eq('team_id', team.id);

    if (rosterDeleteError) {
      console.error('Roster delete during captain withdrawal error:', rosterDeleteError);
    }

    // 4. Clear coach assignment if team has one
    if (team.coach_person_id) {
      try { await clearCoachAssignment(supabase, team.id); }
      catch (coachErr) { console.error('Non-critical: coach assignment clear during captain withdrawal failed:', coachErr); }
    }

    // 5. Expire all pending invites for this team
    await supabase
      .from('kkup_team_invites')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('team_id', team.id)
      .eq('status', 'pending');

    // 6. Hard-delete the team
    const { error: teamDeleteError } = await supabase
      .from('kkup_teams')
      .delete()
      .eq('id', team.id);

    if (teamDeleteError) {
      console.error('Team delete during captain withdrawal error:', teamDeleteError);
    }

    console.log(`Team "${team.team_name}" disbanded (deleted) — captain ${captainPerson.display_name} withdrew from tournament ${tournamentId}`);

    // 7. Notifications (non-critical — wrapped in try/catch)
    try {
      // Notify each displaced roster player
      for (const displacedPid of displacedPersonIds) {
        const { data: displacedPerson } = await supabase
          .from('kkup_persons').select('steam_id, display_name').eq('id', displacedPid).maybeSingle();
        if (displacedPerson?.steam_id) {
          const { data: displacedUser } = await supabase
            .from('users').select('id').eq('steam_id', displacedPerson.steam_id).maybeSingle();
          if (displacedUser?.id) {
            await opts.createNotification({
              user_id: displacedUser.id,
              type: 'team_disbanded',
              title: `Team ${team.team_name} Disbanded`,
              body: `The captain of "${team.team_name}" withdrew from "${tournamentName}". The team has been disbanded and you are now a free agent.`,
              related_id: team.id,
              action_url: `#tournament-hub/${tournamentId}`,
              actor_name: captainPerson.display_name,
            });
            await opts.createUserActivity({
              user_id: displacedUser.id,
              type: 'team_disbanded',
              title: `Team ${team.team_name} Disbanded`,
              description: `The captain withdrew from "${tournamentName}" and your team was disbanded. You are now a free agent.`,
              related_id: team.id,
              related_url: `#tournament-hub/${tournamentId}`,
              actor_name: captainPerson.display_name,
            });
          }
        }
      }

      // Notify the coach if they're a different person from the captain
      if (team.coach_person_id && team.coach_person_id !== captainPerson.id) {
        const { data: coachPerson } = await supabase
          .from('kkup_persons').select('steam_id, display_name').eq('id', team.coach_person_id).maybeSingle();
        if (coachPerson?.steam_id) {
          const { data: coachUser } = await supabase
            .from('users').select('id').eq('steam_id', coachPerson.steam_id).maybeSingle();
          if (coachUser?.id) {
            await opts.createNotification({
              user_id: coachUser.id,
              type: 'team_disbanded',
              title: `Team ${team.team_name} Disbanded`,
              body: `The captain of "${team.team_name}" withdrew from "${tournamentName}". The team has been disbanded and you are no longer assigned as coach.`,
              related_id: team.id,
              action_url: `#tournament-hub/${tournamentId}`,
              actor_name: captainPerson.display_name,
            });
            await opts.createUserActivity({
              user_id: coachUser.id,
              type: 'team_disbanded',
              title: `Team ${team.team_name} Disbanded`,
              description: `The captain withdrew from "${tournamentName}" and the team was disbanded. You are no longer assigned as coach.`,
              related_id: team.id,
              related_url: `#tournament-hub/${tournamentId}`,
              actor_name: captainPerson.display_name,
            });
          }
        }
      }

      // Admin log
      await opts.createAdminLog({
        type: 'team_disbanded',
        action: `Team "${team.team_name}" disbanded — captain ${captainPerson.display_name} withdrew from "${tournamentName}" (${displacedPersonIds.length} player(s) returned to free agency)`,
        actor_id: opts.authDbUserId,
        actor_name: captainPerson.display_name,
        details: {
          team_id: team.id,
          team_name: team.team_name,
          displaced_count: displacedPersonIds.length,
          had_coach: !!(team.coach_person_id && team.coach_person_id !== captainPerson.id),
        },
      });
    } catch (notifyErr) {
      console.error('Non-critical: team disband notifications failed:', notifyErr);
    }

    return { ok: true, displacedPersonIds };
  } catch (err: any) {
    console.error(`disbandCaptainTeam unexpected error for team ${team.id}:`, err);
    return { ok: false, displacedPersonIds: [], error: err.message };
  }
}