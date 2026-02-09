import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Finds or creates a player profile, ensuring no duplicates exist
 * Merges duplicates if found and updates to latest name
 * 
 * @param supabase - Supabase client
 * @param steamId - Player's Steam ID (account_id)
 * @param name - Player's current name
 * @returns Player profile ID
 */
export async function findOrCreatePlayer(
  supabase: any,
  steamId: number | string,
  name: string,
): Promise<string> {
  const steamIdNum = typeof steamId === 'string' ? parseInt(steamId) : steamId;

  // Step 1: Find all profiles with this steam_id or opendota_id
  const { data: existingProfiles } = await supabase
    .from('kkup_player_profiles')
    .select('id, name, steam_id, opendota_id, created_at')
    .or(`steam_id.eq.${steamIdNum},opendota_id.eq.${steamIdNum}`)
    .order('created_at', { ascending: true });

  if (!existingProfiles || existingProfiles.length === 0) {
    // No existing profile - create new one
    const { data: newPlayer, error } = await supabase
      .from('kkup_player_profiles')
      .insert({
        steam_id: steamIdNum,
        opendota_id: steamIdNum,
        name: name,
        avatar_url: null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create player ${name}: ${error.message}`);
    }

    console.log(`   ✅ Player created: ${name} (ID: ${newPlayer.id}, steam_id: ${steamIdNum})`);
    return newPlayer.id;
  }

  // Step 2: If only one profile exists, update it and return
  if (existingProfiles.length === 1) {
    const profile = existingProfiles[0];
    
    // Only ensure both IDs are set - DON'T update name
    const updates: any = {};
    if (!profile.steam_id) {
      updates.steam_id = steamIdNum;
    }
    if (!profile.opendota_id) {
      updates.opendota_id = steamIdNum;
    }

    if (Object.keys(updates).length > 0) {
      await supabase
        .from('kkup_player_profiles')
        .update(updates)
        .eq('id', profile.id);
      
      console.log(`   🔄 Player IDs updated: ${profile.name} (ID: ${profile.id})`);
    } else {
      console.log(`   ✅ Player exists: ${name} (ID: ${profile.id})`);
    }

    return profile.id;
  }

  // Step 3: Multiple profiles found - MERGE DUPLICATES
  console.log(`   🔀 Found ${existingProfiles.length} duplicate profiles for ${name}, merging...`);
  
  // Keep the oldest profile (first created)
  const keepProfile = existingProfiles[0];
  const duplicateIds = existingProfiles.slice(1).map(p => p.id);

  // Update all kkup_match_player_stats references to point to kept profile
  for (const dupId of duplicateIds) {
    const { error: updateStatsError } = await supabase
      .from('kkup_match_player_stats')
      .update({ player_profile_id: keepProfile.id })
      .eq('player_profile_id', dupId);

    if (updateStatsError) {
      console.error(`   ⚠️ Error updating match player stats for duplicate ${dupId}:`, updateStatsError);
    }
  }

  // Update all kkup_team_players references to point to kept profile
  for (const dupId of duplicateIds) {
    const { error: updateTeamError } = await supabase
      .from('kkup_team_players')
      .update({ player_profile_id: keepProfile.id })
      .eq('player_profile_id', dupId);

    if (updateTeamError) {
      console.error(`   ⚠️ Error updating team players for duplicate ${dupId}:`, updateTeamError);
    }
  }

  // Delete duplicate profiles
  const { error: deleteError } = await supabase
    .from('kkup_player_profiles')
    .delete()
    .in('id', duplicateIds);

  if (deleteError) {
    console.error(`   ⚠️ Error deleting duplicate profiles:`, deleteError);
  } else {
    console.log(`   ✅ Merged ${duplicateIds.length} duplicate(s) into profile ${keepProfile.id}`);
  }

  // Update kept profile with latest name and ensure IDs are set
  await supabase
    .from('kkup_player_profiles')
    .update({
      steam_id: steamIdNum,
      opendota_id: steamIdNum,
    })
    .eq('id', keepProfile.id);

  console.log(`   ✅ Using merged profile: ${keepProfile.name} (ID: ${keepProfile.id})`);
  return keepProfile.id;
}

/**
 * Finds or creates a team for a specific tournament
 * 
 * @param supabase - Supabase client
 * @param kernelKupId - Tournament ID
 * @param valveTeamId - Valve team ID
 * @param name - Team name
 * @param tag - Team tag (optional)
 * @param logoUrl - Team logo URL (optional)
 * @returns Team ID
 */
export async function findOrCreateTeam(
  supabase: any,
  kernelKupId: string,
  valveTeamId: number | null,
  name: string,
  tag: string | null = null,
  logoUrl: string | null = null,
): Promise<string> {
  // Teams are tournament-specific, but we check by valve_team_id within the tournament
  const { data: existingTeam } = await supabase
    .from('kkup_teams')
    .select('id, name, logo_url')
    .eq('kernel_kup_id', kernelKupId)
    .eq('valve_team_id', valveTeamId)
    .maybeSingle();

  if (existingTeam) {
    // Team exists - don't update name or logo (preserve existing data)
    console.log(`   ✅ Team exists: ${existingTeam.name} (ID: ${existingTeam.id})`);
    return existingTeam.id;
  }

  // Create new team
  const { data: newTeam, error } = await supabase
    .from('kkup_teams')
    .insert({
      kernel_kup_id: kernelKupId,
      valve_team_id: valveTeamId,
      name: name,
      tag: tag,
      logo_url: logoUrl,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create team ${name}: ${error.message}`);
  }

  console.log(`   ✅ Team created: ${name} (ID: ${newTeam.id})`);
  return newTeam.id;
}