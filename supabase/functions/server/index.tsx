import { Hono } from "npm:hono";
import { cors} from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";
import * as steamResearch from "./steam-api-research.tsx";
import { fetchMatchWithFallback, normalizeMatchData } from "./match-fetcher.tsx";
import { seedKernelKup1 } from "./seed-kkup1.tsx";
import { seedKernelKup2 } from "./seed-kkup2.tsx";
import { seedKernelKup3 } from "./seed-kkup3.tsx";
import { seedKernelKup8 } from "./seed-kkup8.tsx";
import { seedKKup9 } from "./seed-kkup9.tsx";
import { findOrCreatePlayer, findOrCreateTeam } from "./kkup-helpers.tsx";
import { buildPendingMVPEmbed, buildResolvedMVPEmbed } from "./discord-embeds.tsx";

// Helper function to convert Steam logo ID to URL
const getSteamLogoUrl = (logoId: number | string | null): string | null => {
  if (!logoId) return null;
  return `https://steamcdn-a.akamaihd.net/apps/dota2/images/team_logos/${logoId}.png`;
};

// Helper function to convert Steam32 ID to Steam64 ID
const steam32ToSteam64 = (steam32: number): string => {
  return (BigInt(steam32) + BigInt('76561197960265728')).toString();
};

// Helper function to get Steam avatar URL
const getSteamAvatarUrl = (avatarHash: string | null): string | null => {
  if (!avatarHash) return null;
  return `https://avatars.steamstatic.com/${avatarHash}_full.jpg`;
};

// Helper function to get hero name from hero ID
const getHeroName = (heroId: number): string => {
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
    135: 'Dawnbreaker', 136: 'Marci', 137: 'Primal Beast', 138: 'Muerta',
  };
  return heroMap[heroId] || `Hero ${heroId}`;
};

const app = new Hono();

// Create Supabase client with service role for server-side operations
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// Create anon client for user auth verification
const anonSupabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? '',
);

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Create storage bucket on startup
(async () => {
  const bucketName = 'make-4789f4af-mvp-screenshots';
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    if (!bucketExists) {
      await supabase.storage.createBucket(bucketName, { public: false });
      console.log(`✅ Created storage bucket: ${bucketName}`);
    } else {
      console.log(`✅ Storage bucket already exists: ${bucketName}`);
    }
  } catch (error) {
    console.error(`❌ Error creating storage bucket:`, error);
  }

  // Create Kernel Kup assets bucket (public for logos)
  const kkupBucketName = 'make-4789f4af-kkup-assets';
  try {
    const { data: buckets2 } = await supabase.storage.listBuckets();
    const kkupBucketExists = buckets2?.some(bucket => bucket.name === kkupBucketName);
    if (!kkupBucketExists) {
      await supabase.storage.createBucket(kkupBucketName, { public: true });
      console.log(`✅ Created storage bucket: ${kkupBucketName}`);
    } else {
      console.log(`✅ Storage bucket already exists: ${kkupBucketName}`);
    }
  } catch (error) {
    console.error(`❌ Error creating Kernel Kup assets bucket:`, error);
  }
})();

// Health check endpoint
app.get("/make-server-4789f4af/health", (c) => {
  return c.json({ status: "ok", version: "4.0-FIXED-AUTH", timestamp: Date.now() });
});

// TEST ENDPOINT - Does the new code work?
app.get("/make-server-4789f4af/test", (c) => {
  console.log('🚀 TEST ENDPOINT HIT - NEW CODE IS DEPLOYED!');
  return c.json({ message: "New code is working!", emoji: "🌽" });
});

// 🌽 WEBHOOK REDEPLOY - Version 1.1 - Testing Discord webhook integration
// This comment triggers a redeploy to pick up the new DISCORD_WEBHOOK_GAMER_TV environment variable

// Create or get user after Discord OAuth
app.post("/make-server-4789f4af/auth/discord-callback", async (c) => {
  try {
    const body = await c.req.json();
    const { user } = body;

    if (!user) {
      console.error('❌ No user object provided in callback');
      return c.json({ error: "User object required" }, 400);
    }

    // Extract the actual Discord user ID from identities array
    const discordIdentity = user.identities?.find((i: any) => i.provider === 'discord');
    const discordUserId = discordIdentity?.id || discordIdentity?.provider_id;

    if (!discordUserId) {
      console.error('❌ No Discord identity found for user:', user.id);
      return c.json({ error: 'Discord identity not found. Please sign in with Discord.' }, 400);
    }

    const supabaseUserId = user.id; // UUID from auth.users
    const discord_username = user.user_metadata?.custom_claims?.global_name 
      || user.user_metadata?.full_name 
      || user.user_metadata?.name 
      || user.email?.split('@')[0] 
      || 'Unknown';
    const discord_avatar = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;
    const discord_email = user.email || null;

    console.log('🌽 Discord callback - Discord ID:', discordUserId, 'Supabase ID:', supabaseUserId, 'Username:', discord_username, 'Email:', discord_email);

    // Check if user exists by discord_id (the actual Discord user ID)
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('discord_id', discordUserId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching user:', fetchError);
      return c.json({ error: 'Failed to fetch user' }, 500);
    }

    if (existingUser) {
      // Check if this user should be owner
      let updateData: any = {
        supabase_id: supabaseUserId, // Update in case it changed
        discord_username,
        discord_avatar,
        email: discord_email,
        updated_at: new Date().toISOString(),
      };

      // If email matches owner email and user is not already owner, upgrade them
      if (discord_email === 'tmull_23@hotmail.com' && existingUser.role !== 'owner') {
        updateData.role = 'owner';
        console.log('🌽 EXISTING USER UPGRADED TO OWNER');
      }

      // Update existing user info
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('discord_id', discordUserId)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating user:', updateError);
        return c.json({ error: 'Failed to update user' }, 500);
      }

      console.log('✅ Updated existing user');
      return c.json({ user: updatedUser });
    }

    // Determine role based on email - check if this is the owner
    let role = 'guest';
    if (discord_email === 'tmull_23@hotmail.com') {
      role = 'owner';
      console.log('🌽 OWNER ACCOUNT DETECTED - Setting role to owner');
    }

    // Create new user with guest role (or owner if matched) and rank 1 (Earwig)
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        supabase_id: supabaseUserId,  // UUID from auth.users for JWT verification
        discord_id: discordUserId,     // Actual Discord user ID string
        discord_username,
        discord_avatar,
        email: discord_email,
        rank_id: 1, // Earwig
        prestige_level: 0,
        role: role,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating user:', createError);
      return c.json({ error: 'Failed to create user' }, 500);
    }

    console.log('✅ Created new user with role:', role);
    return c.json({ user: newUser });
  } catch (error) {
    console.error('Discord callback error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get current user info
app.get("/make-server-4789f4af/auth/me", async (c) => {
  console.log('🌽🌽🌽 /auth/me endpoint HIT - Version 2.0');
  
  try {
    const authHeader = c.req.header('Authorization');
    console.log('🔍 Authorization header exists?', !!authHeader);
    
    if (!authHeader) {
      console.error('❌ No Authorization header in /auth/me');
      return c.json({ error: 'No access token provided' }, 401);
    }

    const accessToken = authHeader.replace('Bearer ', '');
    console.log('🔍 Token received, length:', accessToken?.length);

    // Use anon client to verify the token
    console.log('⏳ Calling anonSupabase.auth.getUser...');
    const { data, error } = await anonSupabase.auth.getUser(accessToken);
    
    if (error) {
      console.error('❌ Token verification failed:', error.message);
      return c.json({ error: 'Unauthorized - Invalid token: ' + error.message }, 401);
    }
    
    if (!data.user) {
      console.error('❌ No user in token data');
      return c.json({ error: 'Unauthorized - No user found' }, 401);
    }
    
    console.log('✅ Verified user with anon client:', data.user.id);
    
    // Get user from database - query by supabase_id (UUID from auth.users)
    console.log('⏳ Querying database for user by supabase_id:', data.user.id);
    const { data: dbUser, error: dbError } = await supabase
      .from('users')
      .select(`
        *,
        ranks (
          id,
          name,
          display_order,
          description
        )
      `)
      .eq('supabase_id', data.user.id)
      .single();

    if (dbError) {
      console.error('❌ Database query error:', dbError.message, dbError.code);
      return c.json({ error: 'User not found in database: ' + dbError.message }, 404);
    }

    if (!dbUser) {
      console.error('❌ No user found in database for ID:', data.user.id);
      return c.json({ error: 'User not found in database' }, 404);
    }

    console.log('✅ SUCCESS! Found user:', dbUser.discord_username, 'Role:', dbUser.role);

    // Auto-refresh OpenDota data if needed (non-blocking background sync)
    if (dbUser.opendota_id) {
      const lastSynced = dbUser.opendota_last_synced ? new Date(dbUser.opendota_last_synced) : null;
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      if (!lastSynced || lastSynced < twoHoursAgo) {
        console.log('🔄 Auto-refreshing OpenDota data for user:', dbUser.discord_username);
        
        // Trigger background sync (non-blocking - don't await)
        fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/make-server-4789f4af/users/me/opendota/sync`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }).catch(err => {
          console.error('❌ Background OpenDota sync failed:', err);
        });

        console.log('✅ Background OpenDota sync triggered');
      }
    }
    
    return c.json({ user: dbUser });
  } catch (error) {
    console.error('❌ Unexpected error in /auth/me:', error);
    return c.json({ error: 'Internal server error: ' + error.message }, 500);
  }
});

// Check if user has a pending membership request
app.get("/make-server-4789f4af/requests/membership/check", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user from database - query by supabase_id
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('supabase_id', authUser.id)
      .single();

    if (userError || !dbUser) {
      return c.json({ hasPendingRequest: false });
    }

    // Check if user has a pending request
    const { data: existingRequest } = await supabase
      .from('membership_requests')
      .select('id')
      .eq('user_id', dbUser.id)
      .eq('status', 'pending')
      .maybeSingle();

    return c.json({ hasPendingRequest: !!existingRequest });
  } catch (error) {
    console.error('Error checking membership request:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Submit membership request
app.post("/make-server-4789f4af/requests/membership", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user from database - query by supabase_id
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('supabase_id', authUser.id)
      .single();

    if (userError || !dbUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Check if user is already a member
    if (dbUser.role !== 'guest') {
      return c.json({ error: 'Only guests can submit membership requests' }, 400);
    }

    // Check if user already has a pending request
    const { data: existingRequest, error: checkError } = await supabase
      .from('membership_requests')
      .select('*')
      .eq('user_id', dbUser.id)
      .eq('status', 'pending')
      .single();

    if (existingRequest) {
      return c.json({ error: 'You already have a pending membership request' }, 400);
    }

    // Create membership request
    const { data: request, error: createError } = await supabase
      .from('membership_requests')
      .insert({
        user_id: dbUser.id,
        status: 'pending',
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating membership request:', createError);
      return c.json({ error: 'Failed to create membership request' }, 500);
    }

    return c.json({ request });
  } catch (error) {
    console.error('Submit membership request error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get user's membership request
app.get("/make-server-4789f4af/requests/membership", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user from database - query by supabase_id
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('supabase_id', authUser.id)
      .single();

    if (userError || !dbUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Get user's membership request
    const { data: request, error: requestError } = await supabase
      .from('membership_requests')
      .select('*')
      .eq('user_id', dbUser.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (requestError && requestError.code !== 'PGRST116') {
      console.error('Error fetching membership request:', requestError);
      return c.json({ error: 'Failed to fetch membership request' }, 500);
    }

    return c.json({ request: request || null });
  } catch (error) {
    console.error('Get membership request error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Cancel membership request
app.delete("/make-server-4789f4af/requests/membership/:id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user from database - query by supabase_id
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('supabase_id', authUser.id)
      .single();

    if (userError || !dbUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    const requestId = c.req.param('id');

    // Delete the request (ensure it belongs to the user)
    const { error: deleteError } = await supabase
      .from('membership_requests')
      .delete()
      .eq('id', requestId)
      .eq('user_id', dbUser.id);

    if (deleteError) {
      console.error('Error deleting membership request:', deleteError);
      return c.json({ error: 'Failed to cancel membership request' }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Cancel membership request error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get all users (Owner only)
app.get("/make-server-4789f4af/admin/users", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user from database and check if owner - query by supabase_id
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (userError || !dbUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (dbUser.role !== 'owner') {
      return c.json({ error: 'Only owners can access this endpoint' }, 403);
    }

    // Get all users with rank info
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select(`
        *,
        ranks (
          id,
          name,
          display_order,
          description
        )
      `)
      .order('created_at', { ascending: false });

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return c.json({ error: 'Failed to fetch users' }, 500);
    }

    return c.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update user role (Owner only)
app.patch("/make-server-4789f4af/admin/users/:userId/role", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user from database and check if owner - query by supabase_id
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (userError || !dbUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (dbUser.role !== 'owner') {
      return c.json({ error: 'Only owners can update user roles' }, 403);
    }

    const userId = c.req.param('userId');
    const { role } = await c.req.json();

    if (!['guest', 'member', 'admin', 'queen_of_hog', 'owner'].includes(role)) {
      return c.json({ error: 'Invalid role' }, 400);
    }

    // Update user role
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating user role:', updateError);
      return c.json({ error: 'Failed to update user role' }, 500);
    }

    // If promoting a guest to member, auto-approve any pending membership requests
    if (role === 'member') {
      const { error: requestError } = await supabase
        .from('membership_requests')
        .update({ 
          status: 'approved', 
          reviewed_by: authUser.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('status', 'pending');

      if (requestError) {
        console.error('Error auto-approving membership request:', requestError);
        // Don't fail the whole operation, just log it
      } else {
        console.log(`✅ Auto-approved pending membership request for user ${userId} (promoted via User Management)`);
      }
    }

    return c.json({ user: updatedUser });
  } catch (error) {
    console.error('Update user role error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Submit MVP screenshot for rank-up (Members only)
app.post("/make-server-4789f4af/requests/mvp", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get submitting user from database - query by supabase_id
    const { data: submittingUser, error: userError } = await supabase
      .from('users')
      .select('id, role, rank_id, prestige_level')
      .eq('supabase_id', authUser.id)
      .single();

    if (userError || !submittingUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Only members can submit MVP requests
    if (submittingUser.role === 'guest') {
      return c.json({ error: 'Only members can submit MVP screenshots' }, 403);
    }

    const { screenshot_url, match_id, user_id, action, notify_discord } = await c.req.json();

    if (!screenshot_url) {
      return c.json({ error: 'Screenshot URL is required' }, 400);
    }

    if (!user_id) {
      return c.json({ error: 'User ID is required' }, 400);
    }

    if (!action || !['rank_up', 'rank_down', 'prestige'].includes(action)) {
      return c.json({ error: 'Valid action is required (rank_up, rank_down, or prestige)' }, 400);
    }

    // Get target user
    const { data: targetUser, error: targetError } = await supabase
      .from('users')
      .select('id, rank_id, prestige_level, role')
      .eq('id', user_id)
      .single();

    if (targetError || !targetUser) {
      return c.json({ error: 'Target user not found' }, 404);
    }

    // Validate action permissions
    const isSelf = submittingUser.id === targetUser.id;
    const submitterIsRank10 = submittingUser.prestige_level === 5 
      ? submittingUser.rank_id >= 11 
      : submittingUser.rank_id >= 10;

    const targetMaxRank = targetUser.prestige_level === 5 ? 11 : 10;
    const targetIsAtMaxRank = targetUser.rank_id >= targetMaxRank;
    const targetCanPrestige = targetUser.prestige_level < 5 && targetIsAtMaxRank;

    // Validate rank_up
    if (action === 'rank_up') {
      if (targetIsAtMaxRank && !targetCanPrestige) {
        return c.json({ error: 'User is already at maximum rank and prestige level' }, 400);
      }
      if (targetIsAtMaxRank && targetCanPrestige) {
        return c.json({ error: 'User is at max rank - use Prestige action instead' }, 400);
      }
    }

    // Validate rank_down
    if (action === 'rank_down') {
      if (isSelf) {
        return c.json({ error: 'You cannot rank yourself down' }, 403);
      }
      if (!submitterIsRank10) {
        return c.json({ error: 'Only Rank 10 players can rank down others' }, 403);
      }
      if (targetUser.rank_id <= 1) {
        return c.json({ error: 'User is already at minimum rank' }, 400);
      }
    }

    // Validate prestige
    if (action === 'prestige') {
      if (!submitterIsRank10) {
        return c.json({ error: 'Only Rank 10 players can prestige others' }, 403);
      }
      if (targetUser.prestige_level >= 5) {
        return c.json({ error: 'User is already at maximum prestige level' }, 400);
      }
      if (!targetIsAtMaxRank) {
        return c.json({ error: 'User must be at maximum rank to prestige' }, 400);
      }
    }

    // Check for duplicate submissions (same screenshot URL or match ID)
    const { data: duplicates, error: dupError } = await supabase
      .from('rank_up_requests')
      .select('*')
      .eq('user_id', submittingUser.id)
      .or(`screenshot_url.eq.${screenshot_url}${match_id ? `,match_id.eq.${match_id}` : ''}`);

    if (duplicates && duplicates.length > 0) {
      return c.json({ error: 'You have already submitted this screenshot or match' }, 400);
    }

    // Insert new MVP request
    const { data: request, error: insertError } = await supabase
      .from('rank_up_requests')
      .insert({
        user_id: submittingUser.id,
        target_user_id: user_id,
        action: action,
        type: 'mvp',
        screenshot_url,
        match_id: match_id || null,
        current_rank_id: targetUser.rank_id,
        current_prestige_level: targetUser.prestige_level,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating MVP request:', insertError);
      return c.json({ error: 'Failed to create MVP request' }, 500);
    }

    // Send Discord notification to #gamer-tv (skip if notify_discord is explicitly false)
    if (notify_discord !== false) {
    console.log('🔵 [WEBHOOK DEBUG] Starting Discord notification process...');
    try {
      const webhookUrl = Deno.env.get('DISCORD_WEBHOOK_GAMER_TV');
      console.log('🔵 [WEBHOOK DEBUG] Webhook URL exists?', !!webhookUrl);
      console.log('🔵 [WEBHOOK DEBUG] Webhook URL length:', webhookUrl?.length || 0);
      console.log('🔵 [WEBHOOK DEBUG] Webhook URL starts with:', webhookUrl?.substring(0, 40) || 'N/A');
      
      if (webhookUrl) {
        console.log('🔵 [WEBHOOK DEBUG] Fetching user details...');
        // Get full user details for the Discord message
        const { data: submitterDetails } = await supabase
          .from('users')
          .select('discord_username, discord_avatar, discord_id, ranks!inner(name), rank_id, prestige_level')
          .eq('id', submittingUser.id)
          .single();

        const { data: targetDetails } = await supabase
          .from('users')
          .select('discord_username, discord_id, ranks!inner(name), rank_id, prestige_level')
          .eq('id', user_id)
          .single();

        console.log('🔵 [WEBHOOK DEBUG] Submitter:', submitterDetails?.discord_username);
        console.log('🔵 [WEBHOOK DEBUG] Target:', targetDetails?.discord_username);
        console.log('🔵 [WEBHOOK DEBUG] Action:', action);
        console.log('🔵 [WEBHOOK DEBUG] Screenshot URL:', screenshot_url);

        // Generate a signed URL for the screenshot to use in Discord
        const { data: signedUrlData } = await supabase
          .storage
          .from('make-4789f4af-mvp-screenshots')
          .createSignedUrl(screenshot_url, 60 * 60 * 24 * 7); // 7 day expiry
        
        const fullScreenshotUrl = signedUrlData?.signedUrl || screenshot_url;
        console.log('🔵 [WEBHOOK DEBUG] Full screenshot URL:', fullScreenshotUrl);

        // Use unified embed builder for consistent Discord message format
        const { embed } = buildPendingMVPEmbed(
          submitterDetails?.discord_id || null,
          submitterDetails?.discord_username || 'Unknown User',
          targetDetails?.discord_id || null,
          targetDetails?.discord_username || 'Unknown User',
          action,
          match_id || null,
          fullScreenshotUrl,
        );

        console.log('🔵 [WEBHOOK DEBUG] Sending webhook request...');
        console.log('🔵 [WEBHOOK DEBUG] Embed object:', JSON.stringify(embed, null, 2));
        
        const webhookResponse = await fetch(webhookUrl + '?wait=true', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            embeds: [embed],
          }),
        });

        // END_MARKER_WEBHOOK_SEND
        console.log('🔵 [WEBHOOK DEBUG] Webhook response status:', webhookResponse.status);
        console.log('🔵 [WEBHOOK DEBUG] Webhook response ok?', webhookResponse.ok);
        
        const responseText = await webhookResponse.text();
        console.log('🔵 [WEBHOOK DEBUG] Webhook response body:', responseText);

        if (!webhookResponse.ok) {
          console.error('❌ [WEBHOOK ERROR] Discord webhook failed with status:', webhookResponse.status);
          console.error('❌ [WEBHOOK ERROR] Response:', responseText);
        } else {
          console.log('✅ Discord notification sent to #gamer-tv');
          
          // Parse the Discord message response to get the message ID (only if we have content)
          if (responseText && responseText.trim().length > 0) {
            try {
              const discordMessage = JSON.parse(responseText);
              if (discordMessage.id) {
                // Store the Discord message ID in the request record
                // (webhook URL comes from DISCORD_WEBHOOK_GAMER_TV env var, no need to store per-request)
                await supabase
                  .from('rank_up_requests')
                  .update({
                    discord_message_id: discordMessage.id,
                  })
                  .eq('id', request.id);
                console.log('✅ Stored Discord message ID:', discordMessage.id);
              }
            } catch (parseError) {
              console.error('⚠️ Failed to parse Discord response:', parseError);
            }
          } else {
            console.log('⚠️ Discord returned empty response (no message ID available)');
          }
        }
      } else {
        console.log('⚠️ DISCORD_WEBHOOK_GAMER_TV not configured - skipping Discord notification');
      }
    } catch (webhookError) {
      console.error('❌ Failed to send Discord notification:', webhookError);
      console.error('❌ [WEBHOOK ERROR] Error details:', webhookError.message);
      console.error('❌ [WEBHOOK ERROR] Error stack:', webhookError.stack);
      // Don't fail the request if Discord notification fails
    }
    } else {
      console.log('🔕 Discord notification skipped (notify_discord=false)');
    }

    return c.json({ request });
  } catch (error) {
    console.error('Submit MVP request error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update user rank (Owner only)
app.patch("/make-server-4789f4af/admin/users/:userId/rank", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user from database and check if owner - query by supabase_id
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('supabase_id', authUser.id)
      .single();

    if (userError || !dbUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (dbUser.role !== 'owner') {
      return c.json({ error: 'Only owners can update user ranks' }, 403);
    }

    const userId = c.req.param('userId');
    const { action } = await c.req.json();

    if (!['rank_up', 'rank_down', 'prestige', 'rank_to_max', 'rank_to_min', 'reset_prestige'].includes(action)) {
      return c.json({ error: 'Invalid action' }, 400);
    }

    // Get target user's current rank and prestige
    const { data: targetUser, error: targetError } = await supabase
      .from('users')
      .select('rank_id, prestige_level')
      .eq('id', userId)
      .single();

    if (targetError || !targetUser) {
      return c.json({ error: 'Target user not found' }, 404);
    }

    let newRankId = targetUser.rank_id;
    let newPrestigeLevel = targetUser.prestige_level;
    const oldRankId = targetUser.rank_id;
    const oldPrestigeLevel = targetUser.prestige_level;

    if (action === 'rank_up') {
      // Max rank depends on prestige level
      const maxRank = newPrestigeLevel === 5 ? 11 : 10;
      if (newRankId >= maxRank) {
        return c.json({ error: `User is already at max rank for prestige level ${newPrestigeLevel}` }, 400);
      }
      newRankId = newRankId + 1;
    } else if (action === 'rank_down') {
      if (newRankId <= 1) {
        return c.json({ error: 'User is already at minimum rank' }, 400);
      }
      newRankId = newRankId - 1;
    } else if (action === 'prestige') {
      if (newPrestigeLevel >= 5) {
        return c.json({ error: 'User is already at max prestige level' }, 400);
      }
      const maxRank = newPrestigeLevel === 4 ? 10 : 10; // Current max rank before prestiging
      if (newRankId < maxRank) {
        return c.json({ error: 'User must be at max rank to prestige' }, 400);
      }
      newPrestigeLevel = newPrestigeLevel + 1;
      newRankId = 1; // Reset to rank 1
    } else if (action === 'rank_to_max') {
      // Set to max rank for current prestige level
      newRankId = newPrestigeLevel === 5 ? 11 : 10;
    } else if (action === 'rank_to_min') {
      // Set to rank 1 (Earwig)
      newRankId = 1;
    } else if (action === 'reset_prestige') {
      // Reset prestige to 0 and rank to 1
      newPrestigeLevel = 0;
      newRankId = 1;
    }

    // Update user rank/prestige
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ 
        rank_id: newRankId, 
        prestige_level: newPrestigeLevel,
        updated_at: new Date().toISOString() 
      })
      .eq('id', userId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating user rank:', updateError);
      return c.json({ error: 'Failed to update user rank' }, 500);
    }

    // Log the rank action to KV store for activity history
    try {
      const actionId = `rank_action:${userId}:${Date.now()}`;
      await kv.set(actionId, {
        action: action,
        performed_by_user_id: dbUser.id,
        target_user_id: userId,
        old_rank_id: oldRankId,
        new_rank_id: newRankId,
        old_prestige_level: oldPrestigeLevel,
        new_prestige_level: newPrestigeLevel,
        timestamp: new Date().toISOString()
      });
      console.log('🌽 Logged rank action:', actionId);
    } catch (historyError) {
      console.error('Error logging rank action history:', historyError);
      // Don't fail the request if history logging fails
    }

    return c.json({ user: updatedUser });
  } catch (error) {
    console.error('Update user rank error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get all membership requests (Owner/Admin only)
app.get("/make-server-4789f4af/admin/membership-requests", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user from database and check if owner/admin - query by supabase_id
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (userError || !dbUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (dbUser.role !== 'owner' && dbUser.role !== 'admin' && dbUser.role !== 'queen_of_hog') {
      return c.json({ error: 'Only owners and admins can access this endpoint' }, 403);
    }

    // Get all membership requests with user info
    const { data: requests, error: requestsError } = await supabase
      .from('membership_requests')
      .select(`
        *,
        users!membership_requests_user_id_fkey (
          id,
          discord_username,
          discord_avatar,
          email
        ),
        reviewed_by_user:users!membership_requests_reviewed_by_fkey (
          id,
          discord_username,
          discord_avatar
        )
      `)
      .order('created_at', { ascending: false });

    if (requestsError) {
      console.error('❌ [Supabase] Error fetching membership requests:', requestsError);
      return c.json({ error: 'Failed to fetch membership requests' }, 500);
    }

    return c.json({ requests });
  } catch (error) {
    console.error('Get membership requests error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Approve membership request (Owner/Admin only)
app.post("/make-server-4789f4af/admin/membership-requests/:requestId/approve", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user from database and check if owner/admin - query by supabase_id
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (userError || !dbUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (dbUser.role !== 'owner' && dbUser.role !== 'admin' && dbUser.role !== 'queen_of_hog') {
      return c.json({ error: 'Only owners and admins can approve requests' }, 403);
    }

    const requestId = c.req.param('requestId');

    // Get the request to find the user and Discord info
    const { data: request, error: fetchError } = await supabase
      .from('membership_requests')
      .select('user_id, status, discord_message_id, discord_channel_id')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      console.error('Error fetching request:', fetchError);
      return c.json({ error: 'Request not found' }, 404);
    }

    if (request.status !== 'pending') {
      return c.json({ error: 'Request has already been processed' }, 400);
    }

    // Get user info for Discord message
    const { data: user, error: requestUserError } = await supabase
      .from('users')
      .select('discord_id, discord_username')
      .eq('id', request.user_id)
      .single();

    if (requestUserError || !user) {
      console.error('Error fetching user:', requestUserError);
      return c.json({ error: 'User not found' }, 404);
    }

    // Update the request status
    const { error: updateRequestError } = await supabase
      .from('membership_requests')
      .update({ 
        status: 'approved',
        reviewed_by: dbUser.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (updateRequestError) {
      console.error('❌ [Supabase] Error updating request:', updateRequestError);
      return c.json({ error: 'Failed to approve request' }, 500);
    }

    // Update the user's role to member
    const { error: updateUserError } = await supabase
      .from('users')
      .update({ 
        role: 'member',
        updated_at: new Date().toISOString()
      })
      .eq('id', request.user_id);

    if (updateUserError) {
      console.error('Error updating user role:', updateUserError);
      return c.json({ error: 'Failed to update user role' }, 500);
    }

    // Send Discord approval message if we have Discord info
    if (request.discord_channel_id && user.discord_id) {
      const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
      
      if (botToken) {
        try {
          // Send public approval message to the same channel
          await fetch(
            `https://discord.com/api/v10/channels/${request.discord_channel_id}/messages`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bot ${botToken}`,
              },
              body: JSON.stringify({
                content: `🌽 <@${user.discord_id}> has been accepted to <@&1157795286584926309>!\nWelcome to the guild! You can now use \`/mvp\` to submit rank requests.`,
              }),
            }
          );
          
          console.log('✅ Sent Discord approval message for:', user.discord_username);
        } catch (error) {
          console.error('Failed to send Discord approval message:', error);
          // Don't fail the request if Discord message fails
        }
      }
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Approve membership request error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Deny membership request (Owner/Admin only)
app.post("/make-server-4789f4af/admin/membership-requests/:requestId/deny", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user from database and check if owner/admin - query by supabase_id
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (userError || !dbUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (dbUser.role !== 'owner' && dbUser.role !== 'admin' && dbUser.role !== 'queen_of_hog') {
      return c.json({ error: 'Only owners and admins can deny requests' }, 403);
    }

    const requestId = c.req.param('requestId');

    // Get the request to check status
    const { data: request, error: fetchError } = await supabase
      .from('membership_requests')
      .select('status')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      console.error('Error fetching request:', fetchError);
      return c.json({ error: 'Request not found' }, 404);
    }

    if (request.status !== 'pending') {
      return c.json({ error: 'Request has already been processed' }, 400);
    }

    // Update the request status
    const { error: updateError } = await supabase
      .from('membership_requests')
      .update({ 
        status: 'denied',
        reviewed_by: dbUser.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('❌ [Supabase] Error denying request:', updateError);
      return c.json({ error: 'Failed to deny request' }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Deny membership request error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Hard-delete (dismiss) a membership request - deletes DB record entirely (Admin/Owner only)
app.delete("/make-server-4789f4af/admin/membership-requests/:requestId", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('supabase_id', authUser.id)
      .single();

    if (userError || !dbUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (dbUser.role !== 'owner' && dbUser.role !== 'admin' && dbUser.role !== 'queen_of_hog') {
      return c.json({ error: 'Only owners and admins can dismiss requests' }, 403);
    }

    const requestId = c.req.param('requestId');

    // Hard-delete the membership request
    const { error: deleteError } = await supabase
      .from('membership_requests')
      .delete()
      .eq('id', requestId);

    if (deleteError) {
      console.error('❌ [Supabase] Error dismissing membership request:', deleteError);
      return c.json({ error: 'Failed to dismiss membership request' }, 500);
    }

    console.log(`✅ Membership request ${requestId} dismissed (hard-deleted) by ${dbUser.id}`);
    return c.json({ success: true });
  } catch (error) {
    console.error('Dismiss membership request error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get user's MVP requests
app.get("/make-server-4789f4af/requests/mvp/my", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user from database - query by supabase_id
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('supabase_id', authUser.id)
      .single();

    if (userError || !dbUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Get all MVP requests for this user (no server-side pagination — guild-scale data)
    const { data: requests, error: requestsError } = await supabase
      .from('rank_up_requests')
      .select(`
        *,
        users!rank_up_requests_user_id_fkey (
          id,
          discord_username,
          discord_avatar,
          email,
          rank_id,
          prestige_level
        ),
        target_user:users!rank_up_requests_target_user_id_fkey (
          id,
          discord_username,
          discord_avatar,
          email,
          rank_id,
          prestige_level
        ),
        reviewed_by_user:users!rank_up_requests_reviewed_by_fkey (
          id,
          discord_username,
          discord_avatar
        )
      `)
      .eq('user_id', dbUser.id)
      .order('created_at', { ascending: false });

    if (requestsError) {
      console.error('Error fetching MVP requests:', requestsError);
      return c.json({ error: 'Failed to fetch MVP requests' }, 500);
    }

    // Generate signed URLs for screenshots
    const requestsWithSignedUrls = await Promise.all((requests || []).map(async (request) => {
      if (request.screenshot_url && !request.screenshot_url.startsWith('http')) {
        // It's a file path, generate signed URL
        const { data: urlData } = await supabase.storage
          .from('make-4789f4af-mvp-screenshots')
          .createSignedUrl(request.screenshot_url, 60 * 60 * 24); // 24 hours

        return {
          ...request,
          screenshot_url: urlData?.signedUrl || request.screenshot_url,
        };
      }
      return request;
    }));

    return c.json({ requests: requestsWithSignedUrls });
  } catch (error) {
    console.error('Get MVP requests error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get all MVP requests (Admin/Owner only)
app.get("/make-server-4789f4af/admin/mvp-requests", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user from database and check if owner/admin - query by supabase_id
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (userError || !dbUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (dbUser.role !== 'owner' && dbUser.role !== 'admin' && dbUser.role !== 'queen_of_hog') {
      return c.json({ error: 'Only owners and admins can access this endpoint' }, 403);
    }

    // Get all MVP requests with user info and target_user info (no server-side pagination — guild-scale data)
    const { data: requests, error: requestsError } = await supabase
      .from('rank_up_requests')
      .select(`
        *,
        users!rank_up_requests_user_id_fkey (
          id,
          discord_username,
          discord_avatar,
          email,
          rank_id,
          prestige_level
        ),
        target_user:users!rank_up_requests_target_user_id_fkey (
          id,
          discord_username,
          discord_avatar,
          email,
          rank_id,
          prestige_level
        ),
        reviewed_by_user:users!rank_up_requests_reviewed_by_fkey (
          id,
          discord_username,
          discord_avatar
        )
      `)
      .order('created_at', { ascending: false });

    if (requestsError) {
      console.error('Error fetching MVP requests:', requestsError);
      return c.json({ error: 'Failed to fetch MVP requests' }, 500);
    }

    // Generate signed URLs for screenshots
    const requestsWithSignedUrls = await Promise.all((requests || []).map(async (request) => {
      if (request.screenshot_url && !request.screenshot_url.startsWith('http')) {
        // It's a file path, generate signed URL
        const { data: urlData } = await supabase.storage
          .from('make-4789f4af-mvp-screenshots')
          .createSignedUrl(request.screenshot_url, 60 * 60 * 24); // 24 hours

        return {
          ...request,
          screenshot_url: urlData?.signedUrl || request.screenshot_url,
        };
      }
      return request;
    }));

    return c.json({ requests: requestsWithSignedUrls });
  } catch (error) {
    console.error('Get MVP requests error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Helper function to update Discord message when MVP request status changes
async function updateDiscordMVPMessage(
  requestId: string,
  status: 'approved' | 'denied',
  reviewerUsername: string
) {
  try {
    // Get the request with Discord message info
    const { data: request, error: requestError } = await supabase
      .from('rank_up_requests')
      .select(`
        discord_message_id,
        discord_channel_id,
        action,
        match_id,
        screenshot_url,
        users!rank_up_requests_user_id_fkey(discord_id, discord_username, rank_id, prestige_level),
        target_user:users!rank_up_requests_target_user_id_fkey(discord_id, discord_username, rank_id, prestige_level)
      `)
      .eq('id', requestId)
      .single();

    if (requestError || !request) {
      console.log('Request not found or missing Discord info:', requestError);
      return;
    }

    // If no Discord message ID, skip updating
    if (!request.discord_message_id || !request.discord_channel_id) {
      console.log('No Discord message info found for request:', requestId);
      return;
    }

    const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
    if (!botToken) {
      console.error('DISCORD_BOT_TOKEN not found');
      return;
    }

    const submitter = request.users;
    const targetUser = request.target_user || request.users;

    // Generate signed URL for the screenshot
    let imageUrl = '';
    if (request.screenshot_url) {
      const { data: signedUrlData } = await supabase.storage
        .from('make-4789f4af-mvp-screenshots')
        .createSignedUrl(request.screenshot_url, 60 * 60 * 24 * 7); // 7 days
      imageUrl = signedUrlData?.signedUrl || '';
    }

    // Use unified embed builder for consistent Discord message format
    const { embed: updatedEmbed } = buildResolvedMVPEmbed(
      submitter?.discord_id || null,
      submitter?.discord_username || 'Unknown User',
      targetUser?.discord_id || null,
      targetUser?.discord_username || 'Unknown User',
      request.action || 'rank_up',
      request.match_id || null,
      imageUrl,
      status,
      reviewerUsername,
    );

    // Update the Discord message via Bot API
    const response = await fetch(
      `https://discord.com/api/v10/channels/${request.discord_channel_id}/messages/${request.discord_message_id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bot ${botToken}`,
        },
        body: JSON.stringify({
          embeds: [updatedEmbed],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to update Discord message:', errorText);
    } else {
      console.log(`✅ Successfully updated Discord message for request ${requestId}`);
    }
  } catch (error) {
    console.error('Error updating Discord message:', error);
    // Don't fail the request if Discord update fails
  }
}

// Helper function to update webhook message when MVP request status changes (for website-submitted requests)
async function updateWebhookMVPMessage(
  requestId: string,
  status: 'approved' | 'denied',
  reviewerUsername: string
) {
  try {
    // Get the request with webhook info
    const { data: request, error: requestError } = await supabase
      .from('rank_up_requests')
      .select(`
        discord_message_id,
        action,
        match_id,
        screenshot_url,
        users!rank_up_requests_user_id_fkey(discord_id, discord_username, discord_avatar, ranks!inner(name), rank_id, prestige_level),
        target_user:users!rank_up_requests_target_user_id_fkey(discord_id, discord_username, discord_avatar, ranks!inner(name), rank_id, prestige_level)
      `)
      .eq('id', requestId)
      .single();

    if (requestError || !request) {
      console.log('Request not found for webhook update:', requestError);
      return;
    }

    // Get webhook URL from env var (it's always the same, no need to store per-request)
    const webhookUrl = Deno.env.get('DISCORD_WEBHOOK_GAMER_TV');

    // If no webhook URL or message ID, skip updating
    if (!webhookUrl || !request.discord_message_id) {
      console.log('No webhook info found for request:', requestId, '| webhookUrl:', !!webhookUrl, '| messageId:', request.discord_message_id);
      return;
    }

    const submittingUser = request.users;
    const targetUser = request.target_user;
    
    // Generate signed URL for screenshot
    const { data: signedUrlData } = await supabase
      .storage
      .from('make-4789f4af-mvp-screenshots')
      .createSignedUrl(request.screenshot_url, 60 * 60 * 24 * 7); // 7 day expiry
    
    const fullScreenshotUrl = signedUrlData?.signedUrl || request.screenshot_url;

    // Use unified embed builder for consistent Discord message format
    const { embed: updatedEmbed } = buildResolvedMVPEmbed(
      submittingUser?.discord_id || null,
      submittingUser?.discord_username || 'Unknown User',
      targetUser?.discord_id || null,
      targetUser?.discord_username || 'Unknown User',
      request.action || 'rank_up',
      request.match_id || null,
      fullScreenshotUrl,
      status,
      reviewerUsername,
    );

    // Update the webhook message using webhook API
    const response = await fetch(
      `${webhookUrl}/messages/${request.discord_message_id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          embeds: [updatedEmbed],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to update webhook message:', errorText);
    } else {
      console.log(`✅ Successfully updated webhook message for request ${requestId}`);
    }
  } catch (error) {
    console.error('Error updating webhook message:', error);
    // Don't fail the request if Discord update fails
  }
}

// Helper function to send Discord warning when approval is blocked due to target not in guild
async function updateDiscordMVPMessageBlocked(
  messageId: string,
  channelId: string,
  targetDiscordId: string,
  targetUsername: string,
  reviewerUsername: string
) {
  try {
    const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
    if (!botToken) {
      console.error('DISCORD_BOT_TOKEN not found');
      return;
    }

    // Updated embed with warning
    const warningEmbed = {
      title: `⚠️ MVP Request - Awaiting Guild Join`,
      color: 0xF97316, // Orange (warning)
      description: `<@${targetDiscordId}> is not in The Corn Field guild yet!\n\n **Action Required:** Please use the \`/joinguild\` command to join XLCOB before this request can be approved.`,
      fields: [
        {
          name: '📊 Status',
          value: `⏳ Pending - Waiting for <@${targetDiscordId}> to join the guild`,
          inline: false,
        },
        {
          name: '👤 Attempted Reviewer',
          value: reviewerUsername,
          inline: true,
        },
      ],
      timestamp: new Date().toISOString(),
    };

    // Update the Discord message
    const response = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bot ${botToken}`,
        },
        body: JSON.stringify({
          embeds: [warningEmbed],
          content: `<@${targetDiscordId}> Please use \`/joinguild\` to join the guild!`,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to update Discord message with warning:', errorText);
    } else {
      console.log(`✅ Successfully sent Discord guild join warning for target ${targetUsername}`);
    }
  } catch (error) {
    console.error('Error sending Discord guild join warning:', error);
  }
}

// Approve MVP request and rank up user (Admin/Owner only)
app.post("/make-server-4789f4af/admin/mvp-requests/:requestId/approve", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user from database and check if owner/admin - query by supabase_id
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('id, role, discord_username')
      .eq('supabase_id', authUser.id)
      .single();

    if (userError || !dbUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (dbUser.role !== 'owner' && dbUser.role !== 'admin' && dbUser.role !== 'queen_of_hog') {
      return c.json({ error: 'Only owners and admins can approve requests' }, 403);
    }

    const requestId = c.req.param('requestId');

    // Get the request with Discord metadata
    const { data: request, error: fetchError } = await supabase
      .from('rank_up_requests')
      .select('user_id, target_user_id, action, status, current_rank_id, current_prestige_level, target_discord_id, target_discord_username, discord_message_id, discord_channel_id')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      console.error('Error fetching request:', fetchError);
      return c.json({ error: 'Request not found' }, 404);
    }

    if (request.status !== 'pending') {
      return c.json({ error: 'Request has already been processed' }, 400);
    }

    // CHECK: If target user doesn't exist in database, block approval and send Discord warning
    // This happens when someone submits an MVP for an unregistered Discord user
    if (!request.target_user_id) {
      console.log('⚠️ Target user not registered in XLCOB. Blocking approval.');
      
      // Send Discord warning message to the target
      if (request.discord_message_id && request.discord_channel_id && request.target_discord_id) {
        updateDiscordMVPMessageBlocked(
          request.discord_message_id,
          request.discord_channel_id,
          request.target_discord_id,
          request.target_discord_username || 'Unknown',
          dbUser.discord_username || 'Unknown'
        );
      }

      return c.json({ 
        error: 'Target user is not in The Corn Field guild. A Discord message has been sent prompting them to join with /joinguild.',
        requiresGuildJoin: true 
      }, 400);
    }

    // Use target_user_id to rank up (we've already verified it exists above)
    const userToRankUp = request.target_user_id;
    const action = request.action || 'rank_up';

    // Get the user's current rank
    const { data: targetUser, error: targetError } = await supabase
      .from('users')
      .select('rank_id, prestige_level')
      .eq('id', userToRankUp)
      .single();

    if (targetError || !targetUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Calculate new rank based on action
    const maxRank = targetUser.prestige_level === 5 ? 11 : 10;
    let newRankId = targetUser.rank_id;
    let newPrestigeLevel = targetUser.prestige_level;

    if (action === 'rank_up') {
      if (targetUser.rank_id < maxRank) {
        newRankId = targetUser.rank_id + 1;
      } else {
        return c.json({ error: 'User is already at max rank for their prestige level' }, 400);
      }
    } else if (action === 'rank_down') {
      if (targetUser.rank_id > 1) {
        newRankId = targetUser.rank_id - 1;
      } else {
        return c.json({ error: 'User is already at minimum rank' }, 400);
      }
    } else if (action === 'prestige') {
      if (targetUser.prestige_level < 5) {
        newRankId = 1;
        newPrestigeLevel = targetUser.prestige_level + 1;
      } else {
        return c.json({ error: 'User is already at max prestige level' }, 400);
      }
    }

    // Update the request status to approved
    const { error: updateRequestError } = await supabase
      .from('rank_up_requests')
      .update({ 
        status: 'approved',
        reviewed_by: dbUser.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (updateRequestError) {
      console.error('❌ [Supabase] Error updating request:', updateRequestError);
      return c.json({ error: 'Failed to approve request' }, 500);
    }

    // Update the user with new rank/prestige
    const { error: updateUserError } = await supabase
      .from('users')
      .update({ 
        rank_id: newRankId,
        prestige_level: newPrestigeLevel,
        updated_at: new Date().toISOString()
      })
      .eq('id', userToRankUp);

    if (updateUserError) {
      console.error('Error ranking up user:', updateUserError);
      return c.json({ error: 'Failed to rank up user' }, 500);
    }

    // Log rank action history
    try {
      const actionKey = `rank_action:${userToRankUp}:${Date.now()}`;
      await kv.set(actionKey, {
        target_user_id: userToRankUp,
        performed_by_user_id: request.user_id,
        action: action,
        old_rank_id: targetUser.rank_id,
        new_rank_id: newRankId,
        old_prestige_level: targetUser.prestige_level,
        new_prestige_level: newPrestigeLevel,
        timestamp: new Date().toISOString()
      });
    } catch (historyError) {
      console.error('Error logging rank action history:', historyError);
      // Don't fail the request if history logging fails
    }

    // Update Discord message (don't await - let it run async)
    updateDiscordMVPMessage(requestId, 'approved', dbUser.discord_username || 'Unknown');
    
    // Also update webhook message if it was submitted via website
    updateWebhookMVPMessage(requestId, 'approved', dbUser.discord_username || 'Unknown');

    return c.json({ success: true, new_rank_id: newRankId });
  } catch (error) {
    console.error('Approve MVP request error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Deny MVP request (Admin/Owner only)
app.post("/make-server-4789f4af/admin/mvp-requests/:requestId/deny", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user from database and check if owner/admin - query by supabase_id
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('id, role, discord_username')
      .eq('supabase_id', authUser.id)
      .single();

    if (userError || !dbUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (dbUser.role !== 'owner' && dbUser.role !== 'admin' && dbUser.role !== 'queen_of_hog') {
      return c.json({ error: 'Only owners and admins can deny requests' }, 403);
    }

    const requestId = c.req.param('requestId');

    // Get the request to check status
    const { data: request, error: fetchError } = await supabase
      .from('rank_up_requests')
      .select('status')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      console.error('Error fetching request:', fetchError);
      return c.json({ error: 'Request not found' }, 404);
    }

    if (request.status !== 'pending') {
      return c.json({ error: 'Request has already been processed' }, 400);
    }

    // Update the request status to denied (keep it in the user's history)
    const { error: updateError } = await supabase
      .from('rank_up_requests')
      .update({ 
        status: 'denied',
        reviewed_by: dbUser.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('❌ [Supabase] Error denying request:', updateError);
      return c.json({ error: 'Failed to deny request' }, 500);
    }

    // Update Discord message (don't await - let it run async)
    updateDiscordMVPMessage(requestId, 'denied', dbUser.discord_username || 'Unknown');
    
    // Also update webhook message if it was submitted via website
    updateWebhookMVPMessage(requestId, 'denied', dbUser.discord_username || 'Unknown');

    return c.json({ success: true });
  } catch (error) {
    console.error('Deny MVP request error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Hard-delete (dismiss) an MVP request - deletes DB record, storage image, and Discord message
app.delete("/make-server-4789f4af/admin/mvp-requests/:requestId", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('id, role, discord_username')
      .eq('supabase_id', authUser.id)
      .single();

    if (userError || !dbUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    const isAdminRole = dbUser.role === 'owner' || dbUser.role === 'admin' || dbUser.role === 'queen_of_hog';

    const requestId = c.req.param('requestId');

    // 1. Fetch the request to get screenshot path and Discord message info
    const { data: request, error: fetchError } = await supabase
      .from('rank_up_requests')
      .select('screenshot_url, discord_message_id, discord_channel_id, user_id')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      console.error('Error fetching request for deletion:', fetchError);
      return c.json({ error: 'Request not found' }, 404);
    }

    // Check authorization: must be admin OR the request owner
    if (!isAdminRole && request.user_id !== dbUser.id) {
      return c.json({ error: 'Only admins or the request owner can delete requests' }, 403);
    }

    // 2. Delete the screenshot from Supabase Storage
    if (request.screenshot_url && !request.screenshot_url.startsWith('http')) {
      const { error: storageError } = await supabase.storage
        .from('make-4789f4af-mvp-screenshots')
        .remove([request.screenshot_url]);

      if (storageError) {
        console.error('⚠️ Failed to delete screenshot from storage:', storageError);
        // Continue anyway - don't block deletion over a storage cleanup failure
      } else {
        console.log('✅ Deleted screenshot from storage:', request.screenshot_url);
      }
    }

    // 3. Delete the Discord message (Bot API for bot-submitted, Webhook API for web-submitted)
    if (request.discord_message_id) {
      // Try Bot API first (for bot-submitted messages)
      if (request.discord_channel_id) {
        const botToken = Deno.env.get('DISCORD_BOT_TOKEN');
        if (botToken) {
          try {
            const discordResponse = await fetch(
              `https://discord.com/api/v10/channels/${request.discord_channel_id}/messages/${request.discord_message_id}`,
              {
                method: 'DELETE',
                headers: { 'Authorization': `Bot ${botToken}` },
              }
            );
            if (discordResponse.ok || discordResponse.status === 204) {
              console.log('✅ Deleted Discord message via Bot API:', request.discord_message_id);
            } else if (discordResponse.status === 404) {
              console.log('⚠️ Discord message already deleted (404)');
            } else {
              console.error('⚠️ Failed to delete Discord message via Bot API:', discordResponse.status);
            }
          } catch (e) {
            console.error('⚠️ Error deleting Discord message via Bot API:', e);
          }
        }
      }

      // Also try webhook API (for web-submitted messages)
      const webhookUrl = Deno.env.get('DISCORD_WEBHOOK_GAMER_TV');
      if (webhookUrl) {
        try {
          const webhookResponse = await fetch(
            `${webhookUrl}/messages/${request.discord_message_id}`,
            { method: 'DELETE' }
          );
          if (webhookResponse.ok || webhookResponse.status === 204) {
            console.log('✅ Deleted Discord message via Webhook API:', request.discord_message_id);
          } else if (webhookResponse.status === 404) {
            console.log('⚠️ Webhook message already deleted or not found (404)');
          } else {
            console.error('⚠️ Failed to delete Discord message via Webhook API:', webhookResponse.status);
          }
        } catch (e) {
          console.error('⚠️ Error deleting Discord message via Webhook API:', e);
        }
      }
    }

    // 4. Delete the request record from the database
    const { error: deleteError } = await supabase
      .from('rank_up_requests')
      .delete()
      .eq('id', requestId);

    if (deleteError) {
      console.error('❌ Error deleting request record:', deleteError);
      return c.json({ error: 'Failed to delete request record' }, 500);
    }

    console.log(`✅ Request ${requestId} fully deleted (DB + Storage + Discord) by ${dbUser.discord_username}`);
    return c.json({ success: true });
  } catch (error) {
    console.error('Delete MVP request error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get leaderboard (Members only)
app.get("/make-server-4789f4af/leaderboard", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user from database - query by supabase_id
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (userError || !dbUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Only members and up can access leaderboard
    if (dbUser.role === 'guest') {
      return c.json({ error: 'Only members can view the leaderboard' }, 403);
    }

    // Get all members (not guests) sorted by prestige and rank
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select(`
        id,
        discord_username,
        discord_avatar,
        rank_id,
        prestige_level,
        role,
        created_at,
        opendota_id,
        opendota_data,
        ranks (
          id,
          name,
          display_order,
          description
        )
      `)
      .neq('role', 'guest')
      .order('prestige_level', { ascending: false })
      .order('rank_id', { ascending: false })
      .order('created_at', { ascending: true }); // Earlier join date wins ties

    if (usersError) {
      console.error('Error fetching leaderboard:', usersError);
      return c.json({ error: 'Failed to fetch leaderboard' }, 500);
    }

    return c.json({ users });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ===========================
// OPENDOTA API ENDPOINTS
// ===========================

// Connect OpenDota account
app.post("/make-server-4789f4af/users/me/opendota", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json();
    const { opendota_id } = body;

    if (!opendota_id) {
      return c.json({ error: 'OpenDota ID is required' }, 400);
    }

    // Validate that it's a valid Steam32 ID (numeric)
    if (!/^\d+$/.test(opendota_id)) {
      return c.json({ error: 'Invalid OpenDota ID format. Please enter a numeric Steam32 ID.' }, 400);
    }

    // Test the OpenDota API to make sure the account exists
    const testResponse = await fetch(`https://api.opendota.com/api/players/${opendota_id}`);
    if (!testResponse.ok) {
      return c.json({ error: 'Failed to verify OpenDota account. Please check the ID and try again.' }, 400);
    }

    const playerData = await testResponse.json();
    if (!playerData || playerData.profile === null) {
      return c.json({ error: 'OpenDota account not found. Please check the ID and try again.' }, 400);
    }

    // Get user from database
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('supabase_id', authUser.id)
      .single();

    if (userError || !dbUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Update user with OpenDota ID
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        opendota_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', dbUser.id);

    if (updateError) {
      console.error('Error connecting OpenDota account:', updateError);
      return c.json({ error: 'Failed to connect OpenDota account' }, 500);
    }

    console.log(`✅ Connected OpenDota account ${opendota_id} for user ${dbUser.id}`);
    return c.json({ success: true });
  } catch (error) {
    console.error('Connect OpenDota error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Sync OpenDota data for current user
app.post("/make-server-4789f4af/users/me/opendota/sync", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user from database
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('id, opendota_id')
      .eq('supabase_id', authUser.id)
      .single();

    if (userError || !dbUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (!dbUser.opendota_id) {
      return c.json({ error: 'No OpenDota account connected' }, 400);
    }

    // Fetch data from OpenDota API
    const openDotaData = await fetchOpenDotaData(dbUser.opendota_id);

    if (!openDotaData) {
      return c.json({ error: 'Failed to fetch OpenDota data' }, 500);
    }

    // Update user's OpenDota data in database
    const { error: updateError } = await supabase
      .from('users')
      .update({
        opendota_data: openDotaData,
        opendota_last_synced: new Date().toISOString(),
      })
      .eq('id', dbUser.id);

    if (updateError) {
      console.error('Error updating OpenDota data:', updateError);
      return c.json({ error: 'Failed to update OpenDota data' }, 500);
    }

    console.log(`✅ Synced OpenDota data for user ${dbUser.id}`);
    return c.json({ success: true, data: openDotaData });
  } catch (error) {
    console.error('Sync OpenDota error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Manual refresh all OpenDota accounts (Owner only)
app.post("/make-server-4789f4af/admin/opendota/refresh-all", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Check if user is owner
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (userError || !dbUser || dbUser.role !== 'owner') {
      return c.json({ error: 'Unauthorized - Owner only' }, 403);
    }

    // Get all users with OpenDota accounts
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, opendota_id')
      .not('opendota_id', 'is', null);

    if (usersError) {
      console.error('Error fetching users with OpenDota accounts:', usersError);
      return c.json({ error: 'Failed to fetch users' }, 500);
    }

    let successCount = 0;
    let failCount = 0;

    // Refresh each user's OpenDota data
    for (const user of users || []) {
      try {
        const opendotaData = await fetchOpenDotaData(user.opendota_id);
        
        if (opendotaData) {
          await supabase
            .from('users')
            .update({ 
              opendota_data: opendotaData,
              opendota_last_synced: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id);
          
          successCount++;
          console.log(`✅ Refreshed OpenDota data for user ${user.id}`);
        } else {
          failCount++;
          console.error(`❌ Failed to refresh OpenDota data for user ${user.id}`);
        }
      } catch (err) {
        failCount++;
        console.error(`❌ Error refreshing user ${user.id}:`, err);
      }
    }

    console.log(`✅ Manual refresh complete: ${successCount} successful, ${failCount} failed`);
    return c.json({ 
      success: true, 
      refreshed: successCount,
      failed: failCount,
      total: (users || []).length
    });
  } catch (error) {
    console.error('Manual refresh error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update user account details (Twitch, Chess.com, etc.)
app.patch("/make-server-4789f4af/users/me/account", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user from database
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('supabase_id', authUser.id)
      .single();

    if (userError || !dbUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Get the update fields from request body
    const body = await c.req.json();
    const allowedFields = ['twitch_username', 'chesscom_username'];
    const updateData: any = {};

    // Only allow updating specific fields
    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return c.json({ error: 'No valid fields to update' }, 400);
    }

    // Update user in database
    const { error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', dbUser.id);

    if (updateError) {
      console.error('Error updating user account:', updateError);
      return c.json({ error: 'Failed to update account' }, 500);
    }

    console.log(`✅ Updated account details for user ${dbUser.id}:`, updateData);
    return c.json({ success: true });
  } catch (error) {
    console.error('Update account error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Helper function to fetch and parse OpenDota data
async function fetchOpenDotaData(opendotaId: string) {
  try {
    // Fetch player profile, heroes, and win/loss
    const [profileRes, heroesRes, wlRes] = await Promise.all([
      fetch(`https://api.opendota.com/api/players/${opendotaId}`),
      fetch(`https://api.opendota.com/api/players/${opendotaId}/heroes`),
      fetch(`https://api.opendota.com/api/players/${opendotaId}/wl`)
    ]);

    if (!profileRes.ok || !heroesRes.ok || !wlRes.ok) {
      console.error('Failed to fetch OpenDota data');
      return null;
    }

    const profile = await profileRes.json();
    const heroes = await heroesRes.json();
    const wl = await wlRes.json();

    // Get top 3 most played heroes
    const top3Heroes = heroes
      .sort((a: any, b: any) => b.games - a.games)
      .slice(0, 3)
      .map((hero: any) => ({
        hero_id: hero.hero_id,
        games: hero.games,
        win: hero.win,
        with_games: hero.with_games,
        with_win: hero.with_win
      }));

    // Extract badge rank (rank_tier)
    // rank_tier is a number like 80 = Herald[0], 81 = Herald[1], ..., 10 = Guardian[0], etc.
    const rankTier = profile.rank_tier || 0;
    const leaderboardRank = profile.leaderboard_rank || null;

    // Parse rank tier into medal and stars
    let medal = 'Unranked';
    let stars = 0;
    if (rankTier > 0) {
      const majorRank = Math.floor(rankTier / 10);
      stars = rankTier % 10;
      
      const medals = ['', 'Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal'];
      medal = medals[majorRank] || 'Unknown';
    }

    // Get primary role (most played position)
    // OpenDota doesn't have a direct "role" field, so we'll infer from lane_role
    // For now, we'll leave it as null or use a placeholder
    const primaryRole = null; // We can enhance this later

    return {
      badge_rank: {
        medal,
        stars,
        rank_tier: rankTier,
        leaderboard_rank: leaderboardRank
      },
      top_3_heroes: top3Heroes,
      primary_role: primaryRole,
      profile: {
        personaname: profile.profile?.personaname || 'Unknown',
        avatarfull: profile.profile?.avatarfull || null
      }
    };
  } catch (error) {
    console.error('Error fetching OpenDota data:', error);
    return null;
  }
}

// Get recent rank actions for a user (actions performed by them OR done to them)
app.get("/make-server-4789f4af/rank-actions/:userId", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const userId = c.req.param('userId');

    // Get ALL rank actions from KV store
    const allActions = await kv.getByPrefix(`rank_action:`);
    
    console.log('🌽 Total rank actions in system:', allActions?.length || 0);
    
    if (!allActions || allActions.length === 0) {
      return c.json({ actions: [] });
    }

    // Filter to only actions where user is either the performer OR the recipient
    const userActions = allActions.filter(action => 
      action && 
      action.timestamp && 
      (action.performed_by_user_id === userId || action.target_user_id === userId)
    );

    console.log('🌽 User-related rank actions:', userActions?.length || 0);

    if (userActions.length === 0) {
      return c.json({ actions: [] });
    }

    // Sort by timestamp (newest first) and limit to 20
    const sortedActions = userActions
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20);

    // Fetch user info for each action (both performer and recipient)
    const actionsWithUserInfo = await Promise.all(
      sortedActions.map(async (action) => {
        // Get performer's info
        const { data: performer, error: perfError } = await supabase
          .from('users')
          .select('id, discord_username, discord_avatar')
          .eq('id', action.performed_by_user_id)
          .maybeSingle();

        if (perfError) {
          console.error('Error fetching performer info:', perfError);
        }

        // Get recipient's info
        const { data: recipient, error: recError } = await supabase
          .from('users')
          .select('id, discord_username, discord_avatar')
          .eq('id', action.target_user_id)
          .maybeSingle();

        if (recError) {
          console.error('Error fetching recipient info:', recError);
        }

        return {
          ...action,
          performer: performer || null,
          recipient: recipient || null,
        };
      })
    );

    return c.json({ actions: actionsWithUserInfo });
  } catch (error) {
    console.error('Get rank actions error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get all tournaments (public endpoint)
app.get("/make-server-4789f4af/tournaments", async (c) => {
  try {
    console.log('🏆 GET /tournaments endpoint hit');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Fetch all tournaments ordered by tournament_start_date descending (newest first)
    const { data: rawTournaments, error } = await supabase
      .from('kernel_kups')
      .select('*')
      .order('tournament_start_date', { ascending: false });

    if (error) {
      console.error('Error fetching tournaments:', error);
      return c.json({ error: 'Failed to fetch tournaments', details: error }, 500);
    }

    // Fetch winning teams for all tournaments (placement = 1)
    const tournamentIds = (rawTournaments || []).map((t: any) => t.id);
    const { data: winningTeams } = await supabase
      .from('kkup_teams')
      .select('id, name, tag, tournament_id, placement')
      .in('tournament_id', tournamentIds)
      .eq('placement', 1);

    // Create a map of tournament_id -> winning team
    const winningTeamMap = new Map();
    (winningTeams || []).forEach((team: any) => {
      winningTeamMap.set(team.tournament_id, team);
    });

    // Map database columns to frontend expected format
    const tournaments = (rawTournaments || []).map((t: any) => {
      const winningTeam = winningTeamMap.get(t.id);
      return {
        id: t.id,
        name: t.name || 'Kernel Kup',
        description: t.description || '',
        start_date: t.tournament_start_date,
        end_date: t.tournament_end_date,
        status: t.status || 'completed',
        max_teams: t.max_teams || 8,
        registration_deadline: t.registration_closes_at || t.tournament_start_date,
        prize_pool: t.prize_pool || 'TBA',
        format: t.format || 'Single Elimination',
        rules: t.rules || '',
        league_id: t.league_id,
        twitch_channel: t.twitch_channel,
        tournament_start_date: t.tournament_start_date,
        created_at: t.created_at,
        updated_at: t.updated_at,
        winning_team: winningTeam ? {
          id: winningTeam.id,
          name: winningTeam.name,
          tag: winningTeam.tag
        } : null
      };
    });

    console.log(`✅ Fetched and mapped ${tournaments.length} tournaments`);
    return c.json({ tournaments });
  } catch (error) {
    console.error('Get tournaments error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// =====================================================
// KERNEL KUP OPENDOTA SCRAPER ENDPOINTS
// =====================================================

// ❌ DEPRECATED - Removed in favor of Tournament Builder
// Use /make-server-4789f4af/admin/tournament-builder instead
/* OLD SCRAPE ENDPOINT - COMMENTED OUT
app.post("/make-server-4789f4af/kkup/scrape/:kkup_id", async (c) => {
  try {
    console.log('🌽 Scraping Kernel Kup tournament data from OpenDota');
    
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user from database and check if owner
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (userError || !dbUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (dbUser.role !== 'owner') {
      return c.json({ error: 'Only owners can scrape tournament data' }, 403);
    }

    const kkupId = c.req.param('kkup_id');
    // Get tournament info including league_id
    const { data: tournament, error: tournamentError } = await supabase
      .from('kernel_kups')
      .select('*')
      .eq('id', kkupId)
      .single();

    if (tournamentError || !tournament) {
      console.error('Tournament not found:', tournamentError);
      return c.json({ error: 'Tournament not found' }, 404);
    }

    if (!tournament.league_id) {
      return c.json({ error: 'Tournament does not have a league_id - cannot scrape data' }, 400);
    }

    console.log(`📊 Scraping league ${tournament.league_id} for ${tournament.name}`);

    // Get API key first
    const apiKey = Deno.env.get('OPENDOTA_API_KEY');

    // First, verify the league exists in OpenDota
    const leagueInfoUrl = `https://api.opendota.com/api/leagues/${tournament.league_id}?api_key=${apiKey}`;
    console.log(`🔍 Verifying league exists in OpenDota...`);
    const leagueInfoResponse = await fetch(leagueInfoUrl);
    
    if (leagueInfoResponse.ok) {
      const leagueInfo = await leagueInfoResponse.json();
      console.log(`✅ League found in OpenDota:`, leagueInfo);
    } else {
      console.log(`⚠️ League ${tournament.league_id} not found in OpenDota's database (Status: ${leagueInfoResponse.status})`);
    }

    // Try to scrape cover photo from Dotabuff if we don't have one
    if (!tournament.cover_photo_url) {
      try {
        console.log('🖼️ Attempting to scrape cover photo from Dotabuff...');
        const dotabuffUrl = `https://www.dotabuff.com/esports/leagues/${tournament.league_id}`;
        const dotabuffResponse = await fetch(dotabuffUrl);
        
        if (dotabuffResponse.ok) {
          const html = await dotabuffResponse.text();
          
          // Look for the league image - Dotabuff uses specific patterns
          const imageMatch = html.match(/<img[^>]*class="[^"]*image-league[^"]*"[^>]*src="([^"]+)"/i) ||
                            html.match(/<img[^>]*src="([^"]+)"[^>]*class="[^"]*image-league[^"]*"/i) ||
                            html.match(/<meta property="og:image" content="([^"]+)"/i);
          
          if (imageMatch && imageMatch[1]) {
            const coverUrl = imageMatch[1].startsWith('http') ? imageMatch[1] : `https://www.dotabuff.com${imageMatch[1]}`;
            console.log(`✅ Found cover photo: ${coverUrl}`);
            
            // Update tournament with cover photo
            await supabase
              .from('kernel_kups')
              .update({ cover_photo_url: coverUrl })
              .eq('id', kkupId);
          }
        }
      } catch (coverError) {
        console.log('⚠️ Could not scrape cover photo, continuing anyway:', coverError.message);
      }
    }

    // Fetch matches from OpenDota API
    const leagueUrl = `https://api.opendota.com/api/leagues/${tournament.league_id}/matches?api_key=${apiKey}`;
    
    console.log('🔍 Fetching matches from OpenDota...');
    console.log(`📡 OpenDota URL: ${leagueUrl.replace(apiKey, 'API_KEY_HIDDEN')}`);
    const matchesResponse = await fetch(leagueUrl);
    
    if (!matchesResponse.ok) {
      console.error('OpenDota API error:', matchesResponse.status, matchesResponse.statusText);
      const errorText = await matchesResponse.text();
      console.error('OpenDota API error body:', errorText);
      return c.json({ 
        error: 'Failed to fetch matches from OpenDota', 
        status: matchesResponse.status,
        details: errorText
      }, 500);
    }

    const matches = await matchesResponse.json();
    console.log(`✅ OpenDota API returned ${matches.length} matches for league ${tournament.league_id}`);

    if (!matches || matches.length === 0) {
      console.log(`⚠️ OpenDota has no match data for league ${tournament.league_id}. This usually means it's an amateur league not tracked by OpenDota's automated systems.`);
      return c.json({ 
        error: 'OpenDota API has no match data for this league. Amateur leagues need to be manually added to OpenDota, or you can upload match IDs manually.',
        matches_scraped: 0,
        suggestion: 'Try visiting Dotabuff to see if match data exists there, then manually add match IDs to the database.'
      }, 404);
    }

    let matchesScraped = 0;
    let playersCreated = 0;
    let statsCreated = 0;

    // Process each match
    for (const match of matches) {
      try {
        console.log(`🎮 Processing match ${match.match_id}...`);
        
        // Fetch detailed match data
        const matchDetailUrl = `https://api.opendota.com/api/matches/${match.match_id}?api_key=${apiKey}`;
        const matchDetailResponse = await fetch(matchDetailUrl);
        
        if (!matchDetailResponse.ok) {
          console.error(`Failed to fetch match ${match.match_id}`);
          continue;
        }

        const matchDetail = await matchDetailResponse.json();

        // Create or find teams
        let radiantTeam = null;
        let direTeam = null;

        console.log(`📋 Match ${match.match_id} - radiant_team: ${!!matchDetail.radiant_team}, dire_team: ${!!matchDetail.dire_team}`);

        if (matchDetail.radiant_team) {
          const { data: existingRadiant } = await supabase
            .from('kkup_teams')
            .select('*')
            .eq('kernel_kup_id', kkupId)
            .eq('valve_team_id', matchDetail.radiant_team.team_id)
            .maybeSingle();

          if (existingRadiant) {
            radiantTeam = existingRadiant;
          } else {
            const { data: newRadiant } = await supabase
              .from('kkup_teams')
              .insert({
                kernel_kup_id: kkupId,
                name: matchDetail.radiant_team.name || 'Radiant Team',
                tag: matchDetail.radiant_team.tag,
                valve_team_id: matchDetail.radiant_team.team_id,
                logo_url: matchDetail.radiant_team.logo_url,
              })
              .select()
              .single();
            radiantTeam = newRadiant;
          }
        }

        if (matchDetail.dire_team) {
          const { data: existingDire } = await supabase
            .from('kkup_teams')
            .select('*')
            .eq('kernel_kup_id', kkupId)
            .eq('valve_team_id', matchDetail.dire_team.team_id)
            .maybeSingle();

          if (existingDire) {
            direTeam = existingDire;
          } else {
            const { data: newDire } = await supabase
              .from('kkup_teams')
              .insert({
                kernel_kup_id: kkupId,
                name: matchDetail.dire_team.name || 'Dire Team',
                tag: matchDetail.dire_team.tag,
                valve_team_id: matchDetail.dire_team.team_id,
                logo_url: matchDetail.dire_team.logo_url,
              })
              .select()
              .single();
            direTeam = newDire;
          }
        }

        // For amateur/lobby matches without team data, create placeholder teams
        if (!radiantTeam || !direTeam) {
          console.log('⚠️ Match does not have official team data - creating placeholder teams for lobby match');
          
          // Get player names for team naming
          const radiantPlayers = matchDetail.players.filter(p => p.player_slot < 128);
          const direPlayers = matchDetail.players.filter(p => p.player_slot >= 128);
          
          const radiantCaptain = radiantPlayers[0]?.personaname || 'Radiant Captain';
          const direCaptain = direPlayers[0]?.personaname || 'Dire Captain';
          
          // Create Radiant team if doesn't exist
          if (!radiantTeam) {
            const radiantTeamName = `Team ${radiantCaptain}`;
            
            // Check if we already created this placeholder team
            const { data: existingRadiantPlaceholder } = await supabase
              .from('kkup_teams')
              .select('*')
              .eq('kernel_kup_id', kkupId)
              .eq('name', radiantTeamName)
              .maybeSingle();
            
            if (existingRadiantPlaceholder) {
              radiantTeam = existingRadiantPlaceholder;
            } else {
              const { data: newRadiant, error: radiantInsertError } = await supabase
                .from('kkup_teams')
                .insert({
                  kernel_kup_id: kkupId,
                  name: radiantTeamName,
                  tag: radiantCaptain.substring(0, 4).toUpperCase(),
                  valve_team_id: null,
                  logo_url: null,
                  wins: 0,
                  losses: 0,
                })
                .select()
                .single();
              
              if (radiantInsertError) {
                console.error(`❌ Failed to create Radiant team for match ${match.match_id}:`, radiantInsertError);
                continue;
              }
              
              radiantTeam = newRadiant;
              console.log(`✅ Created placeholder Radiant team: ${radiantTeamName}`);
            }
          }
          
          // Create Dire team if doesn't exist
          if (!direTeam) {
            const direTeamName = `Team ${direCaptain}`;
            
            // Check if we already created this placeholder team
            const { data: existingDirePlaceholder } = await supabase
              .from('kkup_teams')
              .select('*')
              .eq('kernel_kup_id', kkupId)
              .eq('name', direTeamName)
              .maybeSingle();
            
            if (existingDirePlaceholder) {
              direTeam = existingDirePlaceholder;
            } else {
              const { data: newDire, error: direInsertError } = await supabase
                .from('kkup_teams')
                .insert({
                  kernel_kup_id: kkupId,
                  name: direTeamName,
                  tag: direCaptain.substring(0, 4).toUpperCase(),
                  valve_team_id: null,
                  logo_url: null,
                  wins: 0,
                  losses: 0,
                })
                .select()
                .single();
              
              if (direInsertError) {
                console.error(`❌ Failed to create Dire team for match ${match.match_id}:`, direInsertError);
                continue;
              }
              
              direTeam = newDire;
              console.log(`✅ Created placeholder Dire team: ${direTeamName}`);
            }
          }
        }

        // Verify we have both teams before proceeding
        if (!radiantTeam || !direTeam) {
          console.error(`❌ Skipping match ${match.match_id} - failed to create teams. Radiant:`, !!radiantTeam, 'Dire:', !!direTeam);
          continue;
        }

        // Create match record
        const { data: dbMatch, error: matchInsertError } = await supabase
          .from('kkup_matches')
          .insert({
            kernel_kup_id: kkupId,
            stage: 'playoffs', // Default - can be updated manually
            team1_id: radiantTeam?.id,
            team2_id: direTeam?.id,
            status: 'completed',
            team1_score: matchDetail.radiant_win ? 1 : 0,
            team2_score: matchDetail.radiant_win ? 0 : 1,
            winner_team_id: matchDetail.radiant_win ? radiantTeam?.id : direTeam?.id,
            match_id: match.match_id,
            series_id: match.series_id || null, // Store series_id from OpenDota if available
            dotabuff_url: `https://www.dotabuff.com/matches/${match.match_id}`,
            scheduled_time: new Date(match.start_time * 1000).toISOString(),
          })
          .select()
          .single();

        if (matchInsertError) {
          console.error('Error inserting match:', matchInsertError);
          continue;
        }

        matchesScraped++;

        // Process players
        if (matchDetail.players && Array.isArray(matchDetail.players)) {
          for (const player of matchDetail.players) {
            try {
              // Find or create player profile
              let playerProfile = null;

              if (player.account_id) {
                const { data: existingProfile } = await supabase
                  .from('kkup_player_profiles')
                  .select('*')
                  .eq('steam_id', String(player.account_id))
                  .maybeSingle();

                if (existingProfile) {
                  playerProfile = existingProfile;
                } else {
                  const { data: newProfile } = await supabase
                    .from('kkup_player_profiles')
                    .insert({
                      player_name: player.personaname || player.name || `Player ${player.account_id}`,
                      steam_id: String(player.account_id),
                      dotabuff_url: `https://www.dotabuff.com/players/${player.account_id}`,
                      opendota_url: `https://www.opendota.com/players/${player.account_id}`,
                    })
                    .select()
                    .single();
                  
                  if (newProfile) {
                    playerProfile = newProfile;
                    playersCreated++;
                  }
                }
              }

              if (!playerProfile) continue;

              // Determine team
              const isRadiant = player.player_slot < 128;
              const teamId = isRadiant ? radiantTeam?.id : direTeam?.id;

              // Insert player stats
              const { error: statsError } = await supabase
                .from('kkup_match_player_stats')
                .insert({
                  match_id: dbMatch.id,
                  player_profile_id: playerProfile.id,
                  team_id: teamId,
                  player_name: player.personaname || player.name || `Player ${player.account_id}`,
                  steam_id: player.account_id,
                  hero_id: player.hero_id,
                  hero_name: getHeroName(player.hero_id),
                  position_played: player.lane_role || null,
                  is_winner: matchDetail.radiant_win ? isRadiant : !isRadiant,
                  kills: player.kills || 0,
                  deaths: player.deaths || 0,
                  assists: player.assists || 0,
                  last_hits: player.last_hits || 0,
                  denies: player.denies || 0,
                  gpm: player.gold_per_min || 0,
                  xpm: player.xp_per_min || 0,
                  hero_damage: player.hero_damage || 0,
                  tower_damage: player.tower_damage || 0,
                  hero_healing: player.hero_healing || 0,
                  level: player.level || 0,
                  gold: player.total_gold || 0,
                  net_worth: player.net_worth || 0,
                  observer_uses: player.observer_uses || 0,
                  sentry_uses: player.sentry_uses || 0,
                  item_0: player.item_0 || null,
                  item_1: player.item_1 || null,
                  item_2: player.item_2 || null,
                  item_3: player.item_3 || null,
                  item_4: player.item_4 || null,
                  item_5: player.item_5 || null,
                  game_duration_seconds: matchDetail.duration,
                  dotabuff_match_id: match.match_id,
                });

              if (!statsError) {
                statsCreated++;
              }
            } catch (playerError) {
              console.error('Error processing player:', playerError);
            }
          }
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (matchError) {
        console.error(`Error processing match ${match.match_id}:`, matchError);
      }
    }

    // After processing all matches, update team win/loss records
    console.log('📊 Updating team standings...');
    const { data: teamsToUpdate } = await supabase
      .from('kkup_teams')
      .select('id')
      .eq('kernel_kup_id', kkupId);

    for (const team of (teamsToUpdate || [])) {
      // Count wins
      const { count: winCount } = await supabase
        .from('kkup_matches')
        .select('*', { count: 'exact', head: true })
        .eq('kernel_kup_id', kkupId)
        .eq('winner_team_id', team.id);

      // Count total matches (both as team1 and team2)
      const { data: teamMatches } = await supabase
        .from('kkup_matches')
        .select('id')
        .eq('kernel_kup_id', kkupId)
        .or(`team1_id.eq.${team.id},team2_id.eq.${team.id}`);

      const totalMatches = teamMatches?.length || 0;
      const wins = winCount || 0;
      const losses = totalMatches - wins;

      await supabase
        .from('kkup_teams')
        .update({ wins, losses })
        .eq('id', team.id);
    }

    console.log(`✅ Scrape complete! Matches: ${matchesScraped}, Players: ${playersCreated}, Stats: ${statsCreated}`);

    return c.json({ 
      success: true,
      matches_scraped: matchesScraped,
      players_created: playersCreated,
      stats_created: statsCreated,
      message: `Successfully scraped ${matchesScraped} matches with ${statsCreated} player stats. Team standings updated!`
    });

  } catch (error) {
    console.error('Scrape tournament error:', error);
    return c.json({ error: 'Internal server error: ' + error.message }, 500);
  }
});
END OF DEPRECATED SCRAPE ENDPOINT */

// ❌ DEPRECATED - Removed in favor of Tournament Builder
// Match adding is now integrated into the tournament builder workflow
/* OLD ADD-MATCH ENDPOINT - COMMENTED OUT
app.post("/make-server-4789f4af/kkup/:kkup_id/add-match", async (c) => {
  try {
    console.log('🌽 Manually adding match to Kernel Kup');
    
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user from database and check if owner
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (userError || !dbUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (dbUser.role !== 'owner') {
      return c.json({ error: 'Only owners can add matches' }, 403);
    }

    const kkupId = c.req.param('kkup_id');
    const { match_id, series_id } = await c.req.json();

    if (!match_id) {
      return c.json({ error: 'match_id is required' }, 400);
    }

    console.log(`🎮 Fetching match ${match_id} from OpenDota...`);

    // Fetch match data from OpenDota
    const apiKey = Deno.env.get('OPENDOTA_API_KEY');
    const matchDetailUrl = `https://api.opendota.com/api/matches/${match_id}?api_key=${apiKey}`;
    const matchDetailResponse = await fetch(matchDetailUrl);
    
    if (!matchDetailResponse.ok) {
      console.error(`Failed to fetch match ${match_id}:`, matchDetailResponse.status);
      return c.json({ 
        error: `Failed to fetch match ${match_id} from OpenDota`,
        status: matchDetailResponse.status
      }, 400);
    }

    const matchDetail = await matchDetailResponse.json();

    if (!matchDetail || matchDetail.error) {
      return c.json({ error: 'Match not found on OpenDota' }, 404);
    }

    console.log(`✅ Match ${match_id} fetched successfully`);
    console.log(`📋 Match has radiant_team: ${!!matchDetail.radiant_team}, dire_team: ${!!matchDetail.dire_team}`);

    // Create or find teams (same logic as scraper)
    let radiantTeam = null;
    let direTeam = null;

    if (matchDetail.radiant_team) {
      const { data: existingRadiant } = await supabase
        .from('kkup_teams')
        .select('*')
        .eq('kernel_kup_id', kkupId)
        .eq('valve_team_id', matchDetail.radiant_team.team_id)
        .maybeSingle();

      if (existingRadiant) {
        radiantTeam = existingRadiant;
      } else {
        const { data: newRadiant } = await supabase
          .from('kkup_teams')
          .insert({
            kernel_kup_id: kkupId,
            name: matchDetail.radiant_team.name || 'Radiant Team',
            tag: matchDetail.radiant_team.tag,
            valve_team_id: matchDetail.radiant_team.team_id,
            logo_url: matchDetail.radiant_team.logo_url,
          })
          .select()
          .single();
        radiantTeam = newRadiant;
      }
    }

    if (matchDetail.dire_team) {
      const { data: existingDire } = await supabase
        .from('kkup_teams')
        .select('*')
        .eq('kernel_kup_id', kkupId)
        .eq('valve_team_id', matchDetail.dire_team.team_id)
        .maybeSingle();

      if (existingDire) {
        direTeam = existingDire;
      } else {
        const { data: newDire } = await supabase
          .from('kkup_teams')
          .insert({
            kernel_kup_id: kkupId,
            name: matchDetail.dire_team.name || 'Dire Team',
            tag: matchDetail.dire_team.tag,
            valve_team_id: matchDetail.dire_team.team_id,
            logo_url: matchDetail.dire_team.logo_url,
          })
          .select()
          .single();
        direTeam = newDire;
      }
    }

    // For amateur/lobby matches without team data, create placeholder teams
    if (!radiantTeam || !direTeam) {
      console.log('⚠️ Match does not have official team data - creating placeholder teams for lobby match');
      
      // Get player names for team naming
      const radiantPlayers = matchDetail.players.filter(p => p.player_slot < 128);
      const direPlayers = matchDetail.players.filter(p => p.player_slot >= 128);
      
      const radiantCaptain = radiantPlayers[0]?.personaname || 'Radiant Captain';
      const direCaptain = direPlayers[0]?.personaname || 'Dire Captain';
      
      // Create Radiant team if doesn't exist
      if (!radiantTeam) {
        const radiantTeamName = `Team ${radiantCaptain}`;
        
        // Check if we already created this placeholder team
        const { data: existingRadiantPlaceholder } = await supabase
          .from('kkup_teams')
          .select('*')
          .eq('kernel_kup_id', kkupId)
          .eq('name', radiantTeamName)
          .maybeSingle();
        
        if (existingRadiantPlaceholder) {
          radiantTeam = existingRadiantPlaceholder;
        } else {
          const { data: newRadiant, error: radiantInsertError } = await supabase
            .from('kkup_teams')
            .insert({
              kernel_kup_id: kkupId,
              name: radiantTeamName,
              tag: radiantCaptain.substring(0, 4).toUpperCase(),
              valve_team_id: null,
              logo_url: null,
              wins: 0,
              losses: 0,
            })
            .select()
            .single();
          
          if (radiantInsertError) {
            console.error('❌ Failed to create Radiant team:', radiantInsertError);
            return c.json({ error: `Failed to create Radiant team: ${radiantInsertError.message}` }, 500);
          }
          
          radiantTeam = newRadiant;
          console.log(`✅ Created placeholder Radiant team: ${radiantTeamName}`, radiantTeam);
        }
      }
      
      // Create Dire team if doesn't exist
      if (!direTeam) {
        const direTeamName = `Team ${direCaptain}`;
        
        // Check if we already created this placeholder team
        const { data: existingDirePlaceholder } = await supabase
          .from('kkup_teams')
          .select('*')
          .eq('kernel_kup_id', kkupId)
          .eq('name', direTeamName)
          .maybeSingle();
        
        if (existingDirePlaceholder) {
          direTeam = existingDirePlaceholder;
        } else {
          const { data: newDire, error: direInsertError } = await supabase
            .from('kkup_teams')
            .insert({
              kernel_kup_id: kkupId,
              name: direTeamName,
              tag: direCaptain.substring(0, 4).toUpperCase(),
              valve_team_id: null,
              logo_url: null,
              wins: 0,
              losses: 0,
            })
            .select()
            .single();
          
          if (direInsertError) {
            console.error('❌ Failed to create Dire team:', direInsertError);
            return c.json({ error: `Failed to create Dire team: ${direInsertError.message}` }, 500);
          }
          
          direTeam = newDire;
          console.log(`✅ Created placeholder Dire team: ${direTeamName}`, direTeam);
        }
      }
    }

    // Verify we have both teams before proceeding
    if (!radiantTeam || !direTeam) {
      console.error('❌ Failed to create teams. Radiant:', !!radiantTeam, 'Dire:', !!direTeam);
      return c.json({ error: 'Failed to create or find both teams for this match' }, 500);
    }

    console.log(`✅ Teams ready - Radiant: ${radiantTeam.name} (${radiantTeam.id}), Dire: ${direTeam.name} (${direTeam.id})`);

    // Create or update match record
    const { data: existingMatch } = await supabase
      .from('kkup_matches')
      .select('*')
      .eq('match_id', match_id)
      .maybeSingle();

    let matchRecord;
    if (existingMatch) {
      console.log(`⚠️ Match ${match_id} already exists, updating...`);
      const { data: updated } = await supabase
        .from('kkup_matches')
        .update({
          team1_id: radiantTeam.id,
          team2_id: direTeam.id,
          winner_team_id: matchDetail.radiant_win ? radiantTeam.id : direTeam.id,
          team1_score: matchDetail.radiant_score,
          team2_score: matchDetail.dire_score,
          duration: matchDetail.duration,
          scheduled_time: new Date(matchDetail.start_time * 1000).toISOString(),
          series_id: series_id || existingMatch.series_id || null, // Preserve existing series_id if not provided
        })
        .eq('id', existingMatch.id)
        .select()
        .single();
      matchRecord = updated;
    } else {
      const { data: inserted } = await supabase
        .from('kkup_matches')
        .insert({
          kernel_kup_id: kkupId,
          match_id: match_id,
          team1_id: radiantTeam.id,
          team2_id: direTeam.id,
          winner_team_id: matchDetail.radiant_win ? radiantTeam.id : direTeam.id,
          team1_score: matchDetail.radiant_score,
          team2_score: matchDetail.dire_score,
          duration: matchDetail.duration,
          scheduled_time: new Date(matchDetail.start_time * 1000).toISOString(),
          series_id: series_id || null, // Store series_id from request if provided
        })
        .select()
        .single();
      matchRecord = inserted;
    }

    // Update team stats
    const winnerTeam = matchDetail.radiant_win ? radiantTeam : direTeam;
    await supabase
      .from('kkup_teams')
      .update({ wins: (winnerTeam.wins || 0) + 1 })
      .eq('id', winnerTeam.id);

    const loserTeam = matchDetail.radiant_win ? direTeam : radiantTeam;
    await supabase
      .from('kkup_teams')
      .update({ losses: (loserTeam.losses || 0) + 1 })
      .eq('id', loserTeam.id);

    // Process player stats
    let statsCreated = 0;
    for (const player of matchDetail.players) {
      // Create or find player profile
      let playerProfile = null;
      
      if (player.account_id) {
        const { data: existingPlayer } = await supabase
          .from('kkup_player_profiles')
          .select('*')
          .eq('steam_id', String(player.account_id))
          .maybeSingle();

        if (existingPlayer) {
          playerProfile = existingPlayer;
        } else {
          const { data: newPlayer } = await supabase
            .from('kkup_player_profiles')
            .insert({
              steam_id: String(player.account_id),
              player_name: player.personaname || `Player ${player.account_id}`,
              avatar_url: player.avatarfull,
              dotabuff_url: `https://www.dotabuff.com/players/${player.account_id}`,
              opendota_url: `https://www.opendota.com/players/${player.account_id}`,
            })
            .select()
            .single();
          playerProfile = newPlayer;
        }
      }

      // Determine team
      const teamId = player.player_slot < 128 ? radiantTeam.id : direTeam.id;

      // Create or update player stats
      const { data: existingStats } = await supabase
        .from('kkup_match_player_stats')
        .select('*')
        .eq('match_id', matchRecord.id)
        .eq('account_id', player.account_id)
        .maybeSingle();

      if (!existingStats) {
        await supabase
          .from('kkup_match_player_stats')
          .insert({
            match_id: matchRecord.id,
            player_profile_id: playerProfile?.id,
            account_id: player.account_id,
            team_id: teamId,
            hero_id: player.hero_id,
            kills: player.kills,
            deaths: player.deaths,
            assists: player.assists,
            last_hits: player.last_hits,
            denies: player.denies,
            gpm: player.gold_per_min,
            xpm: player.xp_per_min,
            hero_damage: player.hero_damage,
            tower_damage: player.tower_damage,
            hero_healing: player.hero_healing,
            level: player.level,
            gold: player.total_gold || 0,
            net_worth: player.net_worth || 0,
            observer_uses: player.observer_uses || 0,
            sentry_uses: player.sentry_uses || 0,
            item_0: player.item_0 || null,
            item_1: player.item_1 || null,
            item_2: player.item_2 || null,
            item_3: player.item_3 || null,
            item_4: player.item_4 || null,
            item_5: player.item_5 || null,
          });
        statsCreated++;
      }
    }

    console.log(`✅ Match ${match_id} added successfully with ${statsCreated} player stats`);

    return c.json({
      success: true,
      match_id: match_id,
      stats_created: statsCreated,
      message: `Successfully added match ${match_id}`
    });

  } catch (error) {
    console.error('Add match error:', error);
    return c.json({ error: 'Internal server error: ' + error.message }, 500);
  }
});
END OF DEPRECATED ADD-MATCH ENDPOINT */

/**
 * 🏆 GET ALL KERNEL KUPS - Get list of all Kernel Kup tournaments
 * GET /kkup
 * Returns: Array of all Kernel Kup tournaments
 */
app.get("/make-server-4789f4af/kkup", async (c) => {
  console.log('🏆 Get all Kernel Kups endpoint HIT');
  try {
    const { data: tournaments, error } = await supabase
      .from('kernel_kups')
      .select('*')
      .order('tournament_start_date', { ascending: true });

    if (error) {
      console.error('Fetch Kernel Kups error:', error);
      return c.json({ error: 'Failed to fetch Kernel Kups' }, 500);
    }

    console.log(`✅ Found ${tournaments?.length || 0} Kernel Kups`);
    return c.json({ tournaments: tournaments || [] });

  } catch (error) {
    console.error('Get Kernel Kups error:', error);
    return c.json({ error: 'Internal server error: ' + error.message }, 500);
  }
});

/**
 * 🎮 GET PLAYERS FOR A KERNEL KUP - Get all players who participated in a specific tournament
 * GET /kkup/:kkup_id/players
 * Returns: Array of player profiles with their stats for that tournament
 * 
 * ⚠️ NOTE: hall-of-fame routes should be defined BEFORE this route to avoid conflicts
 */
app.get("/make-server-4789f4af/kkup/:kkup_id/players", async (c, next) => {
  const kkupId = c.req.param('kkup_id');
  
  // Skip if this is actually the hall-of-fame route - pass to next handler
  if (kkupId === 'hall-of-fame') {
    return await next();
  }
  
  console.log('🎮 Get Kernel Kup players endpoint HIT');
  try {
    
    if (!kkupId) {
      return c.json({ error: 'Kernel Kup ID is required' }, 400);
    }

    // Get all teams in this tournament
    const { data: teams, error: teamsError } = await supabase
      .from('kkup_teams')
      .select('id')
      .eq('kernel_kup_id', kkupId);

    if (teamsError) {
      console.error('Fetch teams error:', teamsError);
      return c.json({ error: 'Failed to fetch teams' }, 500);
    }

    const teamIds = teams?.map(t => t.id) || [];

    if (teamIds.length === 0) {
      return c.json({ players: [] });
    }

    // Get all players on these teams
    const { data: teamPlayers, error: teamPlayersError } = await supabase
      .from('kkup_team_players')
      .select(`
        player_profile_id,
        player_profile:kkup_player_profiles(*)
      `)
      .in('team_id', teamIds);

    if (teamPlayersError) {
      console.error('Fetch team players error:', teamPlayersError);
      return c.json({ error: 'Failed to fetch players' }, 500);
    }

    // Extract unique players
    const uniquePlayers = new Map();
    teamPlayers?.forEach(tp => {
      if (tp.player_profile && !uniquePlayers.has(tp.player_profile.id)) {
        uniquePlayers.set(tp.player_profile.id, tp.player_profile);
      }
    });

    const players = Array.from(uniquePlayers.values()).sort((a, b) => 
      a.name.localeCompare(b.name)
    );

    console.log(`✅ Found ${players.length} players for Kernel Kup ${kkupId}`);
    return c.json({ players });

  } catch (error) {
    console.error('Get Kernel Kup players error:', error);
    return c.json({ error: 'Internal server error: ' + error.message }, 500);
  }
});

/**
 * 🏅 GET CURRENT AWARDS - Get current championship and Pop'd Kernel awards for a Kernel Kup
 * GET /kkup/:kernel_kup_id/awards
 * Returns current champion team and Pop'd Kernel winners
 */
app.get("/make-server-4789f4af/kkup/:kernel_kup_id/awards", async (c, next) => {
  const kkupId = c.req.param('kernel_kup_id');
  
  // Skip if this is actually the hall-of-fame route - pass to next handler
  if (kkupId === 'hall-of-fame') {
    return await next();
  }
  
  console.log('🏅 Get current awards endpoint HIT');
  try {
    console.log('Fetching awards for Kernel Kup:', kkupId);

    // Get current championship
    const championshipKey = `kkup_championship:${kkupId}`;
    const championship = await kv.get(championshipKey);

    let currentChampion = null;
    if (championship && championship.team_id) {
      // Fetch team details
      const { data: team } = await supabase
        .from('kkup_teams')
        .select('id, name, logo_url')
        .eq('id', championship.team_id)
        .single();
      
      if (team) {
        currentChampion = {
          team_id: team.id,
          team_name: team.name,
          team_logo: team.logo_url,
          awarded_at: championship.awarded_at
        };
      }
    }

    // Get current Pop'd Kernel winners (support up to 2)
    const popdKernelPrefix = `kkup_popdkernel:${kkupId}`;
    const popdKernelKeys = await kv.getByPrefix(popdKernelPrefix);
    
    const currentPopdKernelWinners = [];
    for (const pkData of popdKernelKeys) {
      if (pkData && pkData.player_id) {
        // Fetch player details
        const { data: player } = await supabase
          .from('kkup_player_profiles')
          .select('id, name, avatar_url, steam_id')
          .eq('id', pkData.player_id)
          .single();
        
        if (player) {
          currentPopdKernelWinners.push({
            player_id: player.id,
            player_name: player.name,
            player_avatar: player.avatar_url,
            player_steam_id: player.steam_id,
            awarded_at: pkData.awarded_at
          });
        }
      }
    }

    console.log(`✅ Found awards - Champion: ${currentChampion?.team_name || 'None'}, Pop'd Kernel: ${currentPopdKernelWinners.length} winner(s)`);
    
    return c.json({
      championship: currentChampion,
      popdKernelWinners: currentPopdKernelWinners
    });

  } catch (error) {
    console.error('Get current awards error:', error);
    return c.json({ error: 'Internal server error: ' + error.message }, 500);
  }
});

/**
 * 🏆 AWARD CHAMPIONSHIP - Award championship to a team for a Kernel Kup
 * POST /kkup/award-championship
 * Body: { kernel_kup_id, team_id }
 * Auth: Required (owner/queen_of_hog only)
 */
app.post("/make-server-4789f4af/kkup/award-championship", async (c) => {
  console.log('🏆 Award championship endpoint HIT');
  try {
    // Verify authorization
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.substring(7);
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !authUser) {
      console.error('Auth error:', authError);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Check if user is owner or queen_of_hog
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (!user || (user.role !== 'owner' && user.role !== 'queen_of_hog')) {
      return c.json({ error: 'Forbidden: Only owner and queen_of_hog can award championships' }, 403);
    }

    const { kernel_kup_id, team_id } = await c.req.json();

    if (!kernel_kup_id || !team_id) {
      return c.json({ error: 'kernel_kup_id and team_id are required' }, 400);
    }

    // Verify the tournament exists
    const { data: tournament, error: tournamentError } = await supabase
      .from('kernel_kups')
      .select('id, name, tournament_start_date')
      .eq('id', kernel_kup_id)
      .single();

    if (tournamentError || !tournament) {
      return c.json({ error: 'Tournament not found' }, 404);
    }

    // Verify the team exists and belongs to this tournament
    const { data: team, error: teamError } = await supabase
      .from('kkup_teams')
      .select('id, name, kernel_kup_id')
      .eq('id', team_id)
      .eq('kernel_kup_id', kernel_kup_id)
      .single();

    if (teamError || !team) {
      return c.json({ error: 'Team not found in this tournament' }, 404);
    }

    // Check if championship already exists for this tournament
    const existingKey = `kkup_championship:${kernel_kup_id}`;
    const existing = await kv.get(existingKey);
    
    if (existing && existing.team_id !== team_id) {
      // Different team already won - we're changing the winner
      console.log(`⚠️ Changing championship winner for ${tournament.name} from ${existing.team_id} to ${team_id}`);
    }

    // Store the championship
    await kv.set(existingKey, {
      kernel_kup_id,
      team_id,
      team_name: team.name,
      tournament_name: tournament.name,
      tournament_start_date: tournament.tournament_start_date,
      awarded_at: new Date().toISOString(),
      awarded_by: authUser.id
    });

    console.log(`✅ Championship awarded: ${team.name} won ${tournament.name}`);
    
    return c.json({
      success: true,
      message: `🏆 ${team.name} has been awarded the championship for ${tournament.name}!`
    });

  } catch (error) {
    console.error('Award championship error:', error);
    return c.json({ error: 'Internal server error: ' + error.message }, 500);
  }
});

/**
 * 👑 AWARD POP'D KERNEL - Award Pop'd Kernel MVP to player(s) for a Kernel Kup
 * POST /kkup/award-popd-kernel
 * Body: { kernel_kup_id, player_ids: [player_id1, player_id2] } (max 2 players)
 * Auth: Required (owner/queen_of_hog only)
 */
app.post("/make-server-4789f4af/kkup/award-popd-kernel", async (c) => {
  console.log('👑 Award Pop\'d Kernel endpoint HIT');
  try {
    // Verify authorization
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.substring(7);
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !authUser) {
      console.error('Auth error:', authError);
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Check if user is owner or queen_of_hog
    const { data: user } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (!user || (user.role !== 'owner' && user.role !== 'queen_of_hog')) {
      return c.json({ error: 'Forbidden: Only owner and queen_of_hog can award Pop\'d Kernel' }, 403);
    }

    const { kernel_kup_id, player_ids } = await c.req.json();

    if (!kernel_kup_id || !player_ids || !Array.isArray(player_ids)) {
      return c.json({ error: 'kernel_kup_id and player_ids (array) are required' }, 400);
    }

    // Filter out empty strings and validate max 2 players
    const validPlayerIds = player_ids.filter(id => id && id.trim());
    
    if (validPlayerIds.length === 0) {
      return c.json({ error: 'At least one player_id is required' }, 400);
    }

    if (validPlayerIds.length > 2) {
      return c.json({ error: 'Maximum of 2 Pop\'d Kernel winners allowed per tournament' }, 400);
    }

    // Verify the tournament exists
    const { data: tournament, error: tournamentError } = await supabase
      .from('kernel_kups')
      .select('id, name, tournament_start_date')
      .eq('id', kernel_kup_id)
      .single();

    if (tournamentError || !tournament) {
      return c.json({ error: 'Tournament not found' }, 404);
    }

    // Verify all players exist and participated in the tournament
    const { data: teams } = await supabase
      .from('kkup_teams')
      .select('id')
      .eq('kernel_kup_id', kernel_kup_id);

    const teamIds = teams?.map(t => t.id) || [];

    const awardedPlayers = [];
    
    for (const playerId of validPlayerIds) {
      // Verify player exists
      const { data: player, error: playerError } = await supabase
        .from('kkup_player_profiles')
        .select('id, name, steam_id')
        .eq('id', playerId)
        .single();

      if (playerError || !player) {
        return c.json({ error: `Player ${playerId} not found` }, 404);
      }

      // Verify player participated in this tournament
      const { data: participation } = await supabase
        .from('kkup_team_players')
        .select('id')
        .eq('player_profile_id', playerId)
        .in('team_id', teamIds)
        .limit(1);

      if (!participation || participation.length === 0) {
        return c.json({ error: `Player ${player.name} did not participate in this tournament` }, 400);
      }

      awardedPlayers.push(player);
    }

    // Clear all existing Pop'd Kernel awards for this tournament first
    const existingPrefix = `kkup_popdkernel:${kernel_kup_id}`;
    const existingKeys = await kv.getByPrefix(existingPrefix);
    
    // Delete all existing awards
    for (const existing of existingKeys) {
      if (existing && existing.player_id) {
        await kv.del(`kkup_popdkernel:${kernel_kup_id}:${existing.player_id}`);
      }
    }
    // Also delete the old single-key format if it exists
    await kv.del(`kkup_popdkernel:${kernel_kup_id}`);

    // Store each Pop'd Kernel award with unique keys
    for (let i = 0; i < awardedPlayers.length; i++) {
      const player = awardedPlayers[i];
      const awardKey = `kkup_popdkernel:${kernel_kup_id}:${player.id}`;
      
      await kv.set(awardKey, {
        kernel_kup_id,
        player_id: player.id,
        player_name: player.name,
        player_steam_id: player.steam_id,
        tournament_name: tournament.name,
        tournament_start_date: tournament.tournament_start_date,
        awarded_at: new Date().toISOString(),
        awarded_by: authUser.id,
        award_index: i
      });

      console.log(`✅ Pop'd Kernel awarded: ${player.name} won Pop'd Kernel for ${tournament.name}`);
    }
    
    const playerNames = awardedPlayers.map(p => p.name).join(' and ');
    return c.json({
      success: true,
      message: `👑 ${playerNames} ${awardedPlayers.length > 1 ? 'have' : 'has'} been awarded Pop'd Kernel for ${tournament.name}!`
    });

  } catch (error) {
    console.error('Award Pop\'d Kernel error:', error);
    return c.json({ error: 'Internal server error: ' + error.message }, 500);
  }
});

/**
 * 🏛️ GET /kkup/hall-of-fame/players - Fetch Hall of Fame PLAYER stats with caching
 * Returns player statistics split by tournament type
 * Uses KV store caching for performance (5 minute TTL)
 */
app.get("/make-server-4789f4af/kkup/hall-of-fame/players", async (c) => {
  console.log('🏛️ Hall of Fame PLAYERS endpoint HIT');
  try {
    // Check cache first
    const cacheKey = 'hall_of_fame_players_cache';
    const cachedData = await kv.get(cacheKey);
    
    if (cachedData) {
      console.log('✅ Returning cached player data');
      return c.json(cachedData);
    }

    console.log('⏳ Cache miss - calculating player stats...');
    
    // Import helper functions
    const { calculatePlayerStats } = await import('./hall-of-fame-helpers.tsx');

    // Fetch all tournaments to get their types
    const { data: allTournaments, error: tournamentsError } = await supabase
      .from('kernel_kups')
      .select('id, name, description');
    
    if (tournamentsError) {
      console.error('Fetch tournaments error:', tournamentsError);
      return c.json({ error: 'Failed to fetch tournaments' }, 500);
    }

    // Separate tournaments by type - filter out any invalid IDs
    const kernelKupTournaments = allTournaments?.filter(t => 
      !t.name?.toLowerCase().includes('heaps') && 
      !t.description?.toLowerCase().includes('heaps')
    ).map(t => t.id).filter(id => id && typeof id === 'string') || [];
    
    const heapsNHooksTournaments = allTournaments?.filter(t => 
      t.name?.toLowerCase().includes('heaps') || 
      t.description?.toLowerCase().includes('heaps')
    ).map(t => t.id).filter(id => id && typeof id === 'string') || [];

    console.log(`🏆 [PLAYERS] Found ${kernelKupTournaments.length} Kernel Kup tournaments:`, kernelKupTournaments);
    console.log(`🎣 [PLAYERS] Found ${heapsNHooksTournaments.length} Heaps n' Hooks tournaments:`, heapsNHooksTournaments);

    // Fetch all player profiles
    const { data: players, error: playersError } = await supabase
      .from('kkup_player_profiles')
      .select(`
        *,
        user:users(id, discord_username, discord_avatar, rank_id, prestige_level, role)
      `)
      .order('name');

    if (playersError) {
      console.error('Fetch players error:', playersError);
      return c.json({ error: 'Failed to fetch players' }, 500);
    }

    // Fetch awards
    const championshipAwards = await kv.getByPrefix('kkup_championship:');
    const popdKernelAwards = await kv.getByPrefix('kkup_popdkernel:');

    // Calculate stats for all players
    const allTournamentIds = [...kernelKupTournaments, ...heapsNHooksTournaments];
    
    const playersWithStats = await Promise.all(players.map(async (player) => {
      const kernelKupStats = kernelKupTournaments.length > 0 
        ? await calculatePlayerStats(player, kernelKupTournaments, championshipAwards, popdKernelAwards)
        : null;
      
      const heapsNHooksStats = heapsNHooksTournaments.length > 0
        ? await calculatePlayerStats(player, heapsNHooksTournaments, championshipAwards, popdKernelAwards)
        : null;

      const combinedStats = await calculatePlayerStats(player, allTournamentIds, championshipAwards, popdKernelAwards);

      return {
        ...player,
        stats: combinedStats,
        kernelKupStats,
        heapsNHooksStats,
      };
    }));

    playersWithStats.sort((a, b) => (b.stats?.totalTournaments || 0) - (a.stats?.totalTournaments || 0));

    // Calculate overall stats
    const { data: allMatches } = await supabase
      .from('kkup_matches')
      .select('id');
    
    const { data: allHeroStats } = await supabase
      .from('kkup_match_player_stats')
      .select('hero_id');
    
    const uniqueHeroes = new Set(allHeroStats?.map(stat => stat.hero_id) || []);
    
    const overallStats = {
      totalUniquePlayers: playersWithStats.filter(p => p.stats).length,
      totalUniqueMatches: allMatches?.length || 0,
      totalChampions: playersWithStats.filter(p => p.stats && p.stats.championships > 0).length,
      totalUniqueHeroes: uniqueHeroes.size
    };

    const responseData = { 
      players: playersWithStats,
      overallStats 
    };

    // Cache for 5 minutes (300 seconds)
    await kv.set(cacheKey, responseData);
    console.log('💾 Player data cached for 5 minutes');

    return c.json(responseData);
  } catch (error) {
    console.error('Hall of Fame players error:', error);
    return c.json({ error: 'Failed to fetch Hall of Fame player data' }, 500);
  }
});

/**
 * 🏆 GET /kkup/hall-of-fame/teams - Fetch Hall of Fame TEAM stats with caching
 * Returns team statistics split by tournament type
 * Uses KV store caching for performance (5 minute TTL)
 */
app.get("/make-server-4789f4af/kkup/hall-of-fame/teams", async (c) => {
  console.log('🏛️ Hall of Fame TEAMS endpoint HIT');
  try {
    // Check cache first
    const cacheKey = 'hall_of_fame_teams_cache';
    const cachedData = await kv.get(cacheKey);
    
    if (cachedData) {
      console.log('✅ Returning cached team data');
      return c.json(cachedData);
    }

    console.log('⏳ Cache miss - calculating team stats...');
    
    // Import helper functions
    const { calculateTeamStats } = await import('./hall-of-fame-helpers.tsx');

    // Fetch all tournaments to get their types
    const { data: allTournaments, error: tournamentsError } = await supabase
      .from('kernel_kups')
      .select('id, name, description');
    
    if (tournamentsError) {
      console.error('Fetch tournaments error:', tournamentsError);
      return c.json({ error: 'Failed to fetch tournaments' }, 500);
    }

    // Separate tournaments by type - filter out any invalid IDs
    const kernelKupTournaments = allTournaments?.filter(t => 
      !t.name?.toLowerCase().includes('heaps') && 
      !t.description?.toLowerCase().includes('heaps')
    ).map(t => t.id).filter(id => id && typeof id === 'string') || [];
    
    const heapsNHooksTournaments = allTournaments?.filter(t => 
      t.name?.toLowerCase().includes('heaps') || 
      t.description?.toLowerCase().includes('heaps')
    ).map(t => t.id).filter(id => id && typeof id === 'string') || [];

    console.log(`🏆 [TEAMS] Found ${kernelKupTournaments.length} Kernel Kup tournaments:`, kernelKupTournaments);
    console.log(`🎣 [TEAMS] Found ${heapsNHooksTournaments.length} Heaps n' Hooks tournaments:`, heapsNHooksTournaments);

    // Fetch awards
    const championshipAwards = await kv.getByPrefix('kkup_championship:');
    const popdKernelAwards = await kv.getByPrefix('kkup_popdkernel:');

    // Calculate team stats
    const allTournamentIds = [...kernelKupTournaments, ...heapsNHooksTournaments];
    
    const kernelKupTeamStats = kernelKupTournaments.length > 0 
      ? await calculateTeamStats(kernelKupTournaments, championshipAwards, popdKernelAwards)
      : [];
    
    const heapsNHooksTeamStats = heapsNHooksTournaments.length > 0
      ? await calculateTeamStats(heapsNHooksTournaments, championshipAwards, popdKernelAwards)
      : [];

    const combinedTeamStats = await calculateTeamStats(allTournamentIds, championshipAwards, popdKernelAwards);

    const responseData = {
      teamStats: combinedTeamStats,
      kernelKupTeamStats,
      heapsNHooksTeamStats,
    };

    // Cache for 5 minutes
    await kv.set(cacheKey, responseData);
    console.log('💾 Team data cached for 5 minutes');

    return c.json(responseData);
  } catch (error) {
    console.error('Hall of Fame teams error:', error);
    return c.json({ error: 'Failed to fetch Hall of Fame team data' }, 500);
  }
});

/**
 * 🏛️ KERNEL KUP HALL OF FAME - Get all-time player stats across all tournaments
 * GET /kkup/hall-of-fame
 * Returns: players with total tournaments, championships, MVPs, and aggregate stats (split by tournament type)
 * Also returns team stats aggregated across all tournament types
 * 
 * ⚠️ IMPORTANT: This route MUST come before /kkup/:kkup_id to avoid conflicts
 */
app.get("/make-server-4789f4af/kkup/hall-of-fame", async (c) => {
  console.log('🏛️ Hall of Fame endpoint HIT');
  try {
    // Import helper functions
    const { calculatePlayerStats, calculateTeamStats } = await import('./hall-of-fame-helpers.tsx');

    // Fetch all tournaments to get their types
    const { data: allTournaments, error: tournamentsError } = await supabase
      .from('kernel_kups')
      .select('id, name, description');
    
    if (tournamentsError) {
      console.error('Fetch tournaments error:', tournamentsError);
      return c.json({ error: 'Failed to fetch tournaments' }, 500);
    }

    // Separate tournaments by type - use name/description to identify Heaps n' Hooks - filter out any invalid IDs
    const kernelKupTournaments = allTournaments?.filter(t => 
      !t.name?.toLowerCase().includes('heaps') && 
      !t.description?.toLowerCase().includes('heaps')
    ).map(t => t.id).filter(id => id && typeof id === 'string') || [];
    
    const heapsNHooksTournaments = allTournaments?.filter(t => 
      t.name?.toLowerCase().includes('heaps') || 
      t.description?.toLowerCase().includes('heaps')
    ).map(t => t.id).filter(id => id && typeof id === 'string') || [];
    
    console.log(`🏆 [LEGACY] Found ${kernelKupTournaments.length} Kernel Kup tournaments and ${heapsNHooksTournaments.length} Heaps n' Hooks tournaments`);

    // Fetch all player profiles with their linked XLCOB user data
    const { data: players, error: playersError } = await supabase
      .from('kkup_player_profiles')
      .select(`
        *,
        user:users(id, discord_username, discord_avatar, rank_id, prestige_level, role)
      `)
      .order('name');

    if (playersError) {
      console.error('Fetch players error:', playersError);
      return c.json({ error: 'Failed to fetch players' }, 500);
    }

    // Fetch all championships from KV store
    const championshipAwards = await kv.getByPrefix('kkup_championship:');
    console.log(`🏆 Found ${championshipAwards.length} championship awards`);

    // Fetch all Pop'd Kernel awards from KV store
    const popdKernelAwards = await kv.getByPrefix('kkup_popdkernel:');
    console.log(`👑 Found ${popdKernelAwards.length} Pop'd Kernel awards`);

    // Calculate stats for all players (both formats separately)
    const allTournamentIds = [...kernelKupTournaments, ...heapsNHooksTournaments];
    
    const playersWithStats = await Promise.all(players.map(async (player) => {
      // Calculate stats for each tournament type
      const kernelKupStats = kernelKupTournaments.length > 0 
        ? await calculatePlayerStats(player, kernelKupTournaments, championshipAwards, popdKernelAwards)
        : null;
      
      const heapsNHooksStats = heapsNHooksTournaments.length > 0
        ? await calculatePlayerStats(player, heapsNHooksTournaments, championshipAwards, popdKernelAwards)
        : null;

      // Combined stats for top 3 legends and overall stats
      const combinedStats = await calculatePlayerStats(player, allTournamentIds, championshipAwards, popdKernelAwards);

      return {
        ...player,
        stats: combinedStats, // Default stats for top 3 legends (combined)
        kernelKupStats,
        heapsNHooksStats,
      };
    }));

    // Sort by total tournaments participated (most active first)
    playersWithStats.sort((a, b) => (b.stats?.totalTournaments || 0) - (a.stats?.totalTournaments || 0));

    // 🏆 TEAM STATS - Calculate stats for each tournament type (like player stats)
    const kernelKupTeamStats = kernelKupTournaments.length > 0 
      ? await calculateTeamStats(kernelKupTournaments, championshipAwards, popdKernelAwards)
      : [];
    
    const heapsNHooksTeamStats = heapsNHooksTournaments.length > 0
      ? await calculateTeamStats(heapsNHooksTournaments, championshipAwards, popdKernelAwards)
      : [];

    // Combined team stats for overall display
    const combinedTeamStats = await calculateTeamStats(allTournamentIds, championshipAwards, popdKernelAwards);

    // Calculate overall stats - total UNIQUE matches and heroes across all tournaments
    const { data: allMatches } = await supabase
      .from('kkup_matches')
      .select('id');
    
    // Get all unique heroes picked across all tournaments
    const { data: allHeroStats } = await supabase
      .from('kkup_match_player_stats')
      .select('hero_id');
    
    const uniqueHeroes = new Set(allHeroStats?.map(stat => stat.hero_id) || []);
    
    const overallStats = {
      totalUniquePlayers: playersWithStats.filter(p => p.stats).length,
      totalUniqueMatches: allMatches?.length || 0,
      totalChampions: playersWithStats.filter(p => p.stats && p.stats.championships > 0).length,
      totalUniqueHeroes: uniqueHeroes.size
    };

    return c.json({ 
      players: playersWithStats,
      teamStats: combinedTeamStats, // Combined stats for backward compat
      kernelKupTeamStats,
      heapsNHooksTeamStats,
      overallStats 
    });

  } catch (error) {
    console.error('🔴 Hall of Fame error:', error);
    console.error('🔴 Error details:', JSON.stringify(error, null, 2));
    return c.json({ error: 'Internal server error', details: String(error) }, 500);
  }
});

// Get tournament details with all related data (public endpoint)
app.get("/make-server-4789f4af/kkup/:kkup_id", async (c, next) => {
  const kkupId = c.req.param('kkup_id');
  
  // Skip if this is actually the hall-of-fame route - pass to next handler
  if (kkupId === 'hall-of-fame') {
    return await next();
  }
  
  try {
    const startTime = Date.now();

    // Get tournament info
    const { data: tournament, error: tournamentError } = await supabase
      .from('kernel_kups')
      .select('*')
      .eq('id', kkupId)
      .single();

    if (tournamentError || !tournament) {
      return c.json({ error: 'Tournament not found' }, 404);
    }

    // Get teams
    const { data: teams } = await supabase
      .from('kkup_teams')
      .select('*')
      .eq('kernel_kup_id', kkupId)
      .order('wins', { ascending: false });

    // Get matches with team info
    const { data: matches } = await supabase
      .from('kkup_matches')
      .select(`
        *,
        team1:kkup_teams!kkup_matches_team1_id_fkey(id, name, tag, logo_url),
        team2:kkup_teams!kkup_matches_team2_id_fkey(id, name, tag, logo_url),
        winner:kkup_teams!kkup_matches_winner_team_id_fkey(id, name, tag, logo_url)
      `)
      .eq('kernel_kup_id', kkupId)
      .order('scheduled_time', { ascending: false });
    
    // Infer series_id for matches that don't have one (group consecutive matches between same teams)
    if (matches && matches.length > 0) {
      let inferredSeriesCounter = 1000000; // Start with high number to avoid conflicts
      const seriesMap = new Map(); // Key: "team1_id-team2_id", Value: inferred series ID
      
      // Sort by scheduled_time ascending for proper grouping
      const sortedMatches = [...matches].sort((a, b) => 
        new Date(a.scheduled_time).getTime() - new Date(b.scheduled_time).getTime()
      );
      
      for (const match of sortedMatches) {
        if (!match.series_id) {
          // Create a key that works regardless of team order
          const teams = [match.team1_id, match.team2_id].sort();
          const seriesKey = `${teams[0]}-${teams[1]}`;
          
          if (!seriesMap.has(seriesKey)) {
            seriesMap.set(seriesKey, inferredSeriesCounter++);
          }
          
          // Assign inferred series_id
          match.series_id = seriesMap.get(seriesKey);
        }
      }
      
      console.log(`📺 Inferred series IDs for matches without series_id`);
    }
    
    // Calculate series, game records, and total kills for each team
    const teamRecords = new Map();
    if (teams) {
      teams.forEach(team => {
        teamRecords.set(team.id, {
          series_wins: 0,
          series_losses: 0,
          game_wins: 0,
          game_losses: 0,
          total_kills: 0
        });
      });
    }
    
    // Calculate game wins from matches (each match = 1 game)
    if (matches) {
      matches.forEach(match => {
        // Game wins (count of individual matches/games won)
        if (match.winner_team_id) {
          if (match.team1_id === match.winner_team_id) {
            const record = teamRecords.get(match.team1_id);
            if (record) record.game_wins++;
            const oppRecord = teamRecords.get(match.team2_id);
            if (oppRecord) oppRecord.game_losses++;
          } else if (match.team2_id === match.winner_team_id) {
            const record = teamRecords.get(match.team2_id);
            if (record) record.game_wins++;
            const oppRecord = teamRecords.get(match.team1_id);
            if (oppRecord) oppRecord.game_losses++;
          }
        }
      });
    }
    
    // Calculate series wins by grouping matches by series_id
    if (matches) {
      const seriesMap = new Map();
      
      matches.forEach(match => {
        if (!match.series_id) return; // Skip matches without series_id
        
        if (!seriesMap.has(match.series_id)) {
          seriesMap.set(match.series_id, {
            team1_id: match.team1_id,
            team2_id: match.team2_id,
            team1_wins: 0,
            team2_wins: 0
          });
        }
        
        const series = seriesMap.get(match.series_id);
        if (match.winner_team_id === series.team1_id) {
          series.team1_wins++;
        } else if (match.winner_team_id === series.team2_id) {
          series.team2_wins++;
        }
      });
      
      // Count series wins
      seriesMap.forEach(series => {
        if (series.team1_wins > series.team2_wins) {
          const record = teamRecords.get(series.team1_id);
          if (record) record.series_wins++;
          const oppRecord = teamRecords.get(series.team2_id);
          if (oppRecord) oppRecord.series_losses++;
        } else if (series.team2_wins > series.team1_wins) {
          const record = teamRecords.get(series.team2_id);
          if (record) record.series_wins++;
          const oppRecord = teamRecords.get(series.team1_id);
          if (oppRecord) oppRecord.series_losses++;
        }
      });
    }
    
    // Add records to teams (kills will be added after we fetch player stats)
    if (teams) {
      teams.forEach(team => {
        const record = teamRecords.get(team.id);
        if (record) {
          team.series_wins = record.series_wins;
          team.series_losses = record.series_losses;
          team.game_wins = record.game_wins;
          team.game_losses = record.game_losses;
          team.total_kills = 0; // Will be calculated from player stats
        }
      });
      
      // Sort by series wins first, then game wins
      teams.sort((a, b) => {
        if (b.series_wins !== a.series_wins) {
          return b.series_wins - a.series_wins;
        }
        return b.game_wins - a.game_wins;
      });
    }

    // Get player stats with player profiles
    // Use a subquery to join through matches to get all stats for this tournament
    let playerStatsQuery = supabase
      .from('kkup_match_player_stats')
      .select(`
        *,
        player:kkup_player_profiles!player_profile_id(steam_id, name, avatar_url, dotabuff_url, opendota_url),
        team:kkup_teams(id, name, tag, logo_url),
        match:kkup_matches!match_id(kernel_kup_id)
      `);
    
    // Only filter by match IDs if we have matches
    if (matches && matches.length > 0) {
      playerStatsQuery = playerStatsQuery.in('match_id', matches.map(m => m.id));
    }
    
    const { data: playerStats, error: statsError } = await playerStatsQuery
      .order('match_id', { ascending: false })
      .order('team_id', { ascending: true });

    if (statsError) {
      console.error('❌ Error fetching player stats:', statsError);
    }
    
    console.log(`📊 Fetched ${(playerStats || []).length} player stats for ${(matches || []).length} matches`);

    // Enrich hero names if they're missing or in "Hero XX" format
    if (playerStats) {
      playerStats.forEach(stat => {
        if (!stat.hero_name || stat.hero_name.startsWith('Hero ')) {
          stat.hero_name = getHeroName(stat.hero_id);
        }
      });
    }

    // Calculate total kills for each team from player stats
    if (playerStats) {
      playerStats.forEach(stat => {
        if (stat.team_id) {
          const record = teamRecords.get(stat.team_id);
          if (record) {
            record.total_kills += stat.kills || 0;
          }
        }
      });
      
      // Update teams with total kills
      if (teams) {
        teams.forEach(team => {
          const record = teamRecords.get(team.id);
          if (record) {
            team.total_kills = record.total_kills;
          }
        });
      }
    }

    // Group player stats by match_id for easier frontend consumption
    const statsByMatch = (playerStats || []).reduce((acc, stat) => {
      if (!acc[stat.match_id]) {
        acc[stat.match_id] = [];
      }
      acc[stat.match_id].push(stat);
      return acc;
    }, {});

    // Aggregate hero bans from matches' pick_bans_data
    const heroBans: Record<number, number> = {};
    if (matches) {
      matches.forEach(match => {
        if (match.pick_bans_data && Array.isArray(match.pick_bans_data)) {
          // Filter for bans only (is_pick === false)
          const bans = match.pick_bans_data.filter((pb: any) => pb.is_pick === false);
          bans.forEach((ban: any) => {
            if (ban.hero_id) {
              heroBans[ban.hero_id] = (heroBans[ban.hero_id] || 0) + 1;
            }
          });
        }
      });
    }
    console.log(`🚫 Aggregated ${Object.keys(heroBans).length} unique hero bans`);

    const responseTime = Date.now() - startTime;
    console.log(`⚡ Tournament ${kkupId} loaded in ${responseTime}ms (${(playerStats || []).length} stats, ${(matches || []).length} matches, ${(teams || []).length} teams)`);
    
    return c.json({ 
      tournament,
      teams: teams || [],
      matches: matches || [],
      player_stats: playerStats || [],
      stats_by_match: statsByMatch,
      hero_bans: heroBans
    });

  } catch (error) {
    console.error('Get tournament details error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * �� ENRICH MATCHES - Fetch OpenDota data for all matches in a tournament
 * POST /kkup/:kkup_id/enrich-matches
 * Fetches detailed match data (scores, winners, player stats) from OpenDota for existing matches
 */
app.post("/make-server-4789f4af/kkup/:kkup_id/enrich-matches", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user from database and check if owner
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (userError || !dbUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (dbUser.role !== 'owner') {
      return c.json({ error: 'Only owners can enrich matches' }, 403);
    }

    const kkupId = c.req.param('kkup_id');

    console.log(`🎮 Enriching matches for tournament ${kkupId}...`);

    // Get all matches for this tournament
    const { data: matches, error: matchesError } = await supabase
      .from('kkup_matches')
      .select('*')
      .eq('kernel_kup_id', kkupId)
      .order('scheduled_time', { ascending: true });

    if (matchesError) {
      console.error('Error fetching matches:', matchesError);
      return c.json({ error: 'Failed to fetch matches' }, 500);
    }

    if (!matches || matches.length === 0) {
      return c.json({ error: 'No matches found for this tournament' }, 404);
    }

    console.log(`📋 Found ${matches.length} matches to enrich`);

    const apiKey = Deno.env.get('OPENDOTA_API_KEY');
    let enrichedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const match of matches) {
      try {
        if (!match.match_id) {
          console.log(`⏭️  Skipping match ${match.id} - no match_id`);
          skippedCount++;
          continue;
        }

        console.log(`🔍 Fetching match ${match.match_id}...`);

        // Fetch match data from OpenDota
        const matchDetailUrl = `https://api.opendota.com/api/matches/${match.match_id}?api_key=${apiKey}`;
        const matchDetailResponse = await fetch(matchDetailUrl);
        
        if (!matchDetailResponse.ok) {
          console.error(`❌ Failed to fetch match ${match.match_id}:`, matchDetailResponse.status);
          errorCount++;
          errors.push({ match_id: match.match_id, error: `HTTP ${matchDetailResponse.status}` });
          continue;
        }

        const matchDetail = await matchDetailResponse.json();

        if (!matchDetail || matchDetail.error) {
          console.error(`❌ Match ${match.match_id} not found on OpenDota`);
          errorCount++;
          errors.push({ match_id: match.match_id, error: 'Not found on OpenDota' });
          continue;
        }

        console.log(`✅ Match ${match.match_id} fetched successfully`);

        // Find or create teams
        let radiantTeam = null;
        let direTeam = null;

        if (matchDetail.radiant_team) {
          const { data: existingRadiant } = await supabase
            .from('kkup_teams')
            .select('*')
            .eq('kernel_kup_id', kkupId)
            .eq('valve_team_id', matchDetail.radiant_team.team_id)
            .maybeSingle();

          if (existingRadiant) {
            radiantTeam = existingRadiant;
          } else {
            const { data: newRadiant } = await supabase
              .from('kkup_teams')
              .insert({
                kernel_kup_id: kkupId,
                name: matchDetail.radiant_team.name || 'Radiant Team',
                tag: matchDetail.radiant_team.tag,
                valve_team_id: matchDetail.radiant_team.team_id,
                logo_url: matchDetail.radiant_team.logo_url,
              })
              .select()
              .single();
            radiantTeam = newRadiant;
          }
        }

        if (matchDetail.dire_team) {
          const { data: existingDire } = await supabase
            .from('kkup_teams')
            .select('*')
            .eq('kernel_kup_id', kkupId)
            .eq('valve_team_id', matchDetail.dire_team.team_id)
            .maybeSingle();

          if (existingDire) {
            direTeam = existingDire;
          } else {
            const { data: newDire } = await supabase
              .from('kkup_teams')
              .insert({
                kernel_kup_id: kkupId,
                name: matchDetail.dire_team.name || 'Dire Team',
                tag: matchDetail.dire_team.tag,
                valve_team_id: matchDetail.dire_team.team_id,
                logo_url: matchDetail.dire_team.logo_url,
              })
              .select()
              .single();
            direTeam = newDire;
          }
        }

        // Calculate scores (total kills per team)
        const radiantKills = matchDetail.radiant_score || 0;
        const direKills = matchDetail.dire_score || 0;

        // Determine winner
        const winnerTeam = matchDetail.radiant_win ? radiantTeam : direTeam;

        // Map teams to match teams (team1 vs team2)
        const team1Score = match.team1_id === radiantTeam?.id ? radiantKills : direKills;
        const team2Score = match.team2_id === radiantTeam?.id ? radiantKills : direKills;

        // Update match with scores, winner, and pick/ban data
        await supabase
          .from('kkup_matches')
          .update({
            team1_score: team1Score,
            team2_score: team2Score,
            winner_team_id: winnerTeam?.id,
            radiant_win: matchDetail.radiant_win,
            duration: matchDetail.duration || 0,
            pick_bans_data: matchDetail.picks_bans || null,
            opendota_fetched: true,
            opendota_fetched_at: new Date().toISOString(),
          })
          .eq('id', match.id);

        // Update team win/loss records (only once per team)
        const processedTeams = new Set();
        
        if (winnerTeam && !processedTeams.has(winnerTeam.id)) {
          await supabase
            .from('kkup_teams')
            .update({ wins: (winnerTeam.wins || 0) + 1 })
            .eq('id', winnerTeam.id);
          processedTeams.add(winnerTeam.id);
        }

        const loserTeam = matchDetail.radiant_win ? direTeam : radiantTeam;
        if (loserTeam && !processedTeams.has(loserTeam.id)) {
          await supabase
            .from('kkup_teams')
            .update({ losses: (loserTeam.losses || 0) + 1 })
            .eq('id', loserTeam.id);
          processedTeams.add(loserTeam.id);
        }

        // Process player stats
        for (const player of matchDetail.players) {
          // Create or find player profile
          let playerProfile = null;
          
          if (player.account_id) {
            const { data: existingPlayer } = await supabase
              .from('kkup_player_profiles')
              .select('*')
              .eq('steam_id', String(player.account_id))
              .maybeSingle();

            if (existingPlayer) {
              playerProfile = existingPlayer;
            } else {
              const { data: newPlayer } = await supabase
                .from('kkup_player_profiles')
                .insert({
                  steam_id: String(player.account_id),
                  player_name: player.personaname || `Player ${player.account_id}`,
                  avatar_url: player.avatarfull,
                  dotabuff_url: `https://www.dotabuff.com/players/${player.account_id}`,
                  opendota_url: `https://www.opendota.com/players/${player.account_id}`,
                })
                .select()
                .single();
              playerProfile = newPlayer;
            }
          }

          // Determine team
          const isRadiant = player.player_slot < 128;
          const teamId = isRadiant ? radiantTeam?.id : direTeam?.id;

          if (!teamId) continue;

          // Create or update player stats
          const { data: existingStats } = await supabase
            .from('kkup_match_player_stats')
            .select('*')
            .eq('match_id', match.id)
            .eq('account_id', playerProfile?.id || null)
            .maybeSingle();

          const statData = {
            match_id: match.id,
            team_id: teamId,
            account_id: playerProfile?.id || null,
            player_name: player.personaname || `Player ${player.account_id || 'Unknown'}`,
            hero_id: player.hero_id || 0,
            hero_name: getHeroName(player.hero_id || 0),
            kills: player.kills || 0,
            deaths: player.deaths || 0,
            assists: player.assists || 0,
            last_hits: player.last_hits || 0,
            denies: player.denies || 0,
            gpm: player.gold_per_min || 0,
            xpm: player.xp_per_min || 0,
            hero_damage: player.hero_damage || 0,
            tower_damage: player.tower_damage || 0,
            hero_healing: player.hero_healing || 0,
            level: player.level || 0,
            net_worth: player.net_worth || player.total_gold || 0,
            item_0: player.item_0 || null,
            item_1: player.item_1 || null,
            item_2: player.item_2 || null,
            item_3: player.item_3 || null,
            item_4: player.item_4 || null,
            item_5: player.item_5 || null,
            observer_uses: player.observer_uses || player.purchase_observer || 0,
            sentry_uses: player.sentry_uses || player.purchase_sentry || 0,
            is_winner: matchDetail.radiant_win === isRadiant,
          };

          if (existingStats) {
            await supabase
              .from('kkup_match_player_stats')
              .update(statData)
              .eq('id', existingStats.id);
          } else {
            await supabase
              .from('kkup_match_player_stats')
              .insert(statData);
          }
        }

        enrichedCount++;
        console.log(`✅ Enriched match ${match.match_id} (${enrichedCount}/${matches.length})`);

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (matchError) {
        console.error(`❌ Error enriching match ${match.match_id}:`, matchError);
        errorCount++;
        errors.push({ match_id: match.match_id, error: matchError.message });
      }
    }

    console.log(`🎉 Enrichment complete!`);
    console.log(`   - Enriched: ${enrichedCount}`);
    console.log(`   - Skipped: ${skippedCount}`);
    console.log(`   - Errors: ${errorCount}`);

    return c.json({
      success: true,
      enriched: enrichedCount,
      skipped: skippedCount,
      errors: errorCount,
      error_details: errors,
      message: `Enriched ${enrichedCount} out of ${matches.length} matches`
    });

  } catch (error) {
    console.error('Enrich matches error:', error);
    return c.json({ error: 'Internal server error: ' + error.message }, 500);
  }
});

// Update tournament (Owner only)
app.patch("/make-server-4789f4af/kkup/:kkup_id/update", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user from database and check if owner
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (userError || !dbUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (dbUser.role !== 'owner') {
      return c.json({ error: 'Only owners can update tournaments' }, 403);
    }

    const kkupId = c.req.param('kkup_id');
    const body = await c.req.json();

    // Update tournament
    const { data: tournament, error: updateError } = await supabase
      .from('kernel_kups')
      .update({
        cover_photo_url: body.cover_photo_url,
        prize_pool: body.prize_pool,
        description: body.description,
        updated_at: new Date().toISOString(),
      })
      .eq('id', kkupId)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return c.json({ error: 'Failed to update tournament' }, 500);
    }

    return c.json({ 
      success: true,
      tournament,
      message: 'Tournament updated successfully'
    });

  } catch (error) {
    console.error('Update tournament error:', error);
    return c.json({ error: 'Internal server error: ' + error.message }, 500);
  }
});

// ========================================
// TEAM CRUD OPERATIONS
// ========================================

// Create team manually (Owner only)
app.post("/make-server-4789f4af/tournament/:kkup_id/team", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const anonSupabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
    );
    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: dbUser } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (!dbUser || dbUser.role !== 'owner') {
      return c.json({ error: 'Only owners can create teams' }, 403);
    }

    const kkupId = c.req.param('kkup_id');
    const body = await c.req.json();

    const { data: team, error: insertError } = await supabase
      .from('kkup_teams')
      .insert({
        kernel_kup_id: kkupId,
        name: body.name,
        tag: body.tag || body.name.substring(0, 4).toUpperCase(),
        logo_url: body.logo_url || null,
        valve_team_id: body.valve_team_id || null,
        wins: 0,
        losses: 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Create team error:', insertError);
      return c.json({ error: 'Failed to create team: ' + insertError.message }, 500);
    }

    return c.json({ success: true, team });

  } catch (error) {
    console.error('Create team error:', error);
    return c.json({ error: 'Internal server error: ' + error.message }, 500);
  }
});

// Update team (Owner only)
app.put("/make-server-4789f4af/tournament/:kkup_id/team/:team_id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const anonSupabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
    );
    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: dbUser } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (!dbUser || dbUser.role !== 'owner') {
      return c.json({ error: 'Only owners can update teams' }, 403);
    }

    const teamId = c.req.param('team_id');
    const body = await c.req.json();

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.tag !== undefined) updateData.tag = body.tag;
    if (body.logo_url !== undefined) updateData.logo_url = body.logo_url;
    if (body.valve_team_id !== undefined) updateData.valve_team_id = body.valve_team_id;

    const { data: team, error: updateError } = await supabase
      .from('kkup_teams')
      .update(updateData)
      .eq('id', teamId)
      .select()
      .single();

    if (updateError) {
      console.error('Update team error:', updateError);
      return c.json({ error: 'Failed to update team: ' + updateError.message }, 500);
    }

    return c.json({ success: true, team });

  } catch (error) {
    console.error('Update team error:', error);
    return c.json({ error: 'Internal server error: ' + error.message }, 500);
  }
});

// Delete team (Owner only)
app.delete("/make-server-4789f4af/tournament/:kkup_id/team/:team_id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const anonSupabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
    );
    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: dbUser } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (!dbUser || dbUser.role !== 'owner') {
      return c.json({ error: 'Only owners can delete teams' }, 403);
    }

    const teamId = c.req.param('team_id');

    const { error: deleteError } = await supabase
      .from('kkup_teams')
      .delete()
      .eq('id', teamId);

    if (deleteError) {
      console.error('Delete team error:', deleteError);
      return c.json({ error: 'Failed to delete team: ' + deleteError.message }, 500);
    }

    return c.json({ success: true, message: 'Team deleted successfully' });

  } catch (error) {
    console.error('Delete team error:', error);
    return c.json({ error: 'Internal server error: ' + error.message }, 500);
  }
});

// ========================================
// MATCH CRUD OPERATIONS
// ========================================

// Update match (Owner only)
app.put("/make-server-4789f4af/tournament/:kkup_id/match/:match_id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const anonSupabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
    );
    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: dbUser } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (!dbUser || dbUser.role !== 'owner') {
      return c.json({ error: 'Only owners can update matches' }, 403);
    }

    const matchId = c.req.param('match_id');
    const body = await c.req.json();

    const updateData: any = {};
    if (body.team1_id !== undefined) updateData.team1_id = body.team1_id;
    if (body.team2_id !== undefined) updateData.team2_id = body.team2_id;
    if (body.team1_score !== undefined) updateData.team1_score = body.team1_score;
    if (body.team2_score !== undefined) updateData.team2_score = body.team2_score;
    if (body.winner_team_id !== undefined) updateData.winner_team_id = body.winner_team_id;
    if (body.stage !== undefined) updateData.stage = body.stage;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.scheduled_time !== undefined) updateData.scheduled_time = body.scheduled_time;
    if (body.twitch_vod_url !== undefined) updateData.twitch_vod_url = body.twitch_vod_url;
    if (body.youtube_vod_url !== undefined) updateData.youtube_vod_url = body.youtube_vod_url;

    const { data: match, error: updateError } = await supabase
      .from('kkup_matches')
      .update(updateData)
      .eq('id', matchId)
      .select()
      .single();

    if (updateError) {
      console.error('Update match error:', updateError);
      return c.json({ error: 'Failed to update match: ' + updateError.message }, 500);
    }

    return c.json({ success: true, match });

  } catch (error) {
    console.error('Update match error:', error);
    return c.json({ error: 'Internal server error: ' + error.message }, 500);
  }
});

// Create match manually (Owner only)
app.post("/make-server-4789f4af/tournament/:kkup_id/match", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const anonSupabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
    );
    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: dbUser } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (!dbUser || dbUser.role !== 'owner') {
      return c.json({ error: 'Only owners can create matches' }, 403);
    }

    const kkupId = c.req.param('kkup_id');
    const body = await c.req.json();

    const { data: match, error: insertError } = await supabase
      .from('kkup_matches')
      .insert({
        kernel_kup_id: kkupId,
        team1_id: body.team1_id,
        team2_id: body.team2_id,
        team1_score: body.team1_score || 0,
        team2_score: body.team2_score || 0,
        stage: body.stage || 'group_stage',
        status: body.status || 'scheduled',
        scheduled_time: body.scheduled_time || new Date().toISOString(),
        match_id: body.match_id || null,
        dotabuff_url: body.dotabuff_url || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Create match error:', insertError);
      return c.json({ error: 'Failed to create match: ' + insertError.message }, 500);
    }

    return c.json({ success: true, match });

  } catch (error) {
    console.error('Create match error:', error);
    return c.json({ error: 'Internal server error: ' + error.message }, 500);
  }
});

// Delete match (Owner only)
app.delete("/make-server-4789f4af/tournament/:kkup_id/match/:match_id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const anonSupabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
    );
    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: dbUser } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (!dbUser || dbUser.role !== 'owner') {
      return c.json({ error: 'Only owners can delete matches' }, 403);
    }

    const matchId = c.req.param('match_id');

    const { error: deleteError } = await supabase
      .from('kkup_matches')
      .delete()
      .eq('id', matchId);

    if (deleteError) {
      console.error('Delete match error:', deleteError);
      return c.json({ error: 'Failed to delete match: ' + deleteError.message }, 500);
    }

    return c.json({ success: true, message: 'Match deleted successfully' });

  } catch (error) {
    console.error('Delete match error:', error);
    return c.json({ error: 'Internal server error: ' + error.message }, 500);
  }
});

// ========================================
// FILE UPLOAD ENDPOINT
// ========================================

// Upload logo/asset (Owner only)
app.post("/make-server-4789f4af/upload", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const anonSupabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
    );
    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: dbUser } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (!dbUser || dbUser.role !== 'owner') {
      return c.json({ error: 'Only owners can upload files' }, 403);
    }

    // Parse form data
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    // Validate file type (images only)
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return c.json({ error: 'Invalid file type. Only images (JPEG, PNG, GIF, WebP) are allowed.' }, 400);
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return c.json({ error: 'File too large. Maximum size is 5MB.' }, 400);
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const extension = file.name.split('.').pop();
    const filename = `${timestamp}-${randomStr}.${extension}`;

    // Convert File to ArrayBuffer then Uint8Array
    const arrayBuffer = await file.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { data, error: uploadError } = await supabase.storage
      .from('make-4789f4af-kkup-assets')
      .upload(filename, fileData, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return c.json({ error: 'Failed to upload file: ' + uploadError.message }, 500);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('make-4789f4af-kkup-assets')
      .getPublicUrl(filename);

    console.log(`✅ File uploaded: ${filename}`);

    return c.json({ 
      success: true, 
      url: urlData.publicUrl,
      filename: filename
    });

  } catch (error) {
    console.error('File upload error:', error);
    return c.json({ error: 'Internal server error: ' + error.message }, 500);
  }
});

// ========================================
// PLAYER PROFILE MANAGEMENT
// ========================================

// Get all player profiles for a tournament (public)
app.get("/make-server-4789f4af/tournament/:kkup_id/players", async (c) => {
  try {
    const kkupId = c.req.param('kkup_id');

    // Get all player profiles associated with this tournament
    const { data: players, error } = await supabase
      .from('kkup_player_profiles')
      .select(`
        *,
        team_assignments:kkup_team_players(
          team_id,
          team:kkup_teams(id, name, tag, logo_url)
        )
      `)
      .order('name', { ascending: true });

    if (error) {
      console.error('Get players error:', error);
      return c.json({ error: 'Failed to fetch players' }, 500);
    }

    return c.json({ players: players || [] });

  } catch (error) {
    console.error('Get players error:', error);
    return c.json({ error: 'Internal server error: ' + error.message }, 500);
  }
});

// Create player profile (Owner only)
app.post("/make-server-4789f4af/tournament/:kkup_id/player", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const anonSupabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
    );
    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: dbUser } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (!dbUser || dbUser.role !== 'owner') {
      return c.json({ error: 'Only owners can create player profiles' }, 403);
    }

    const body = await c.req.json();

    const { data: player, error: insertError } = await supabase
      .from('kkup_player_profiles')
      .insert({
        player_name: body.player_name,
        steam_id: body.steam_id || (body.opendota_id ? String(body.opendota_id) : null),
        dotabuff_url: body.dotabuff_url || null,
        opendota_url: body.opendota_id ? `https://www.opendota.com/players/${body.opendota_id}` : null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Create player error:', insertError);
      return c.json({ error: 'Failed to create player: ' + insertError.message }, 500);
    }

    return c.json({ success: true, player });

  } catch (error) {
    console.error('Create player error:', error);
    return c.json({ error: 'Internal server error: ' + error.message }, 500);
  }
});

// Add player to team (Owner only)
app.post("/make-server-4789f4af/tournament/:kkup_id/team/:team_id/player", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const anonSupabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
    );
    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: dbUser } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (!dbUser || dbUser.role !== 'owner') {
      return c.json({ error: 'Only owners can add players to teams' }, 403);
    }

    const teamId = c.req.param('team_id');
    const body = await c.req.json();

    // Check if player is already on this team
    const { data: existing } = await supabase
      .from('kkup_team_players')
      .select('*')
      .eq('team_id', teamId)
      .eq('player_profile_id', body.player_profile_id)
      .maybeSingle();

    if (existing) {
      return c.json({ error: 'Player is already on this team' }, 400);
    }

    const { data: assignment, error: insertError } = await supabase
      .from('kkup_team_players')
      .insert({
        team_id: teamId,
        player_profile_id: body.player_profile_id,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Add player to team error:', insertError);
      return c.json({ error: 'Failed to add player to team: ' + insertError.message }, 500);
    }

    return c.json({ success: true, assignment });

  } catch (error) {
    console.error('Add player to team error:', error);
    return c.json({ error: 'Internal server error: ' + error.message }, 500);
  }
});

// Remove player from team (Owner only)
app.delete("/make-server-4789f4af/tournament/:kkup_id/team/:team_id/player/:player_id", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const anonSupabase = createClient(
      Deno.env.get('SUPABASE_URL'),
      Deno.env.get('SUPABASE_ANON_KEY'),
    );
    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { data: dbUser } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (!dbUser || dbUser.role !== 'owner') {
      return c.json({ error: 'Only owners can remove players from teams' }, 403);
    }

    const teamId = c.req.param('team_id');
    const playerId = c.req.param('player_id');

    const { error: deleteError } = await supabase
      .from('kkup_team_players')
      .delete()
      .eq('team_id', teamId)
      .eq('player_profile_id', playerId);

    if (deleteError) {
      console.error('Remove player from team error:', deleteError);
      return c.json({ error: 'Failed to remove player from team: ' + deleteError.message }, 500);
    }

    return c.json({ success: true, message: 'Player removed from team' });

  } catch (error) {
    console.error('Remove player from team error:', error);
    return c.json({ error: 'Internal server error: ' + error.message }, 500);
  }
});

// Get team roster with top 3 heroes (public)
app.get("/make-server-4789f4af/tournament/:kkup_id/team/:team_id/roster", async (c) => {
  try {
    const teamId = c.req.param('team_id');
    const kkupId = c.req.param('kkup_id');

    const { data: roster, error } = await supabase
      .from('kkup_team_players')
      .select(`
        *,
        player:kkup_player_profiles(*)
      `)
      .eq('team_id', teamId);

    if (error) {
      console.error('Get roster error:', error);
      return c.json({ error: 'Failed to fetch roster' }, 500);
    }

    // For each player, fetch their top 3 heroes in this tournament
    const rosterWithHeroes = await Promise.all((roster || []).map(async (entry) => {
      const playerId = entry.player.id;

      // Get all matches for this player in this tournament
      const { data: playerStats } = await supabase
        .from('kkup_match_player_stats')
        .select('hero_id, hero_name, is_winner')
        .eq('player_profile_id', playerId)
        .eq('team_id', teamId);

      // Count hero plays
      const heroCount = new Map<number, { name: string; count: number; wins: number }>();
      (playerStats || []).forEach((stat) => {
        const key = stat.hero_id;
        if (!heroCount.has(key)) {
          heroCount.set(key, { name: stat.hero_name, count: 0, wins: 0 });
        }
        const hero = heroCount.get(key)!;
        hero.count++;
        if (stat.is_winner) hero.wins++;
      });

      // Get top 3 heroes by play count
      const topHeroes = Array.from(heroCount.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .map(h => ({
          name: h.name,
          count: h.count,
          wins: h.wins,
          winRate: h.count > 0 ? ((h.wins / h.count) * 100).toFixed(0) : "0"
        }));

      return {
        ...entry,
        topHeroes
      };
    }));

    return c.json({ roster: rosterWithHeroes });

  } catch (error) {
    console.error('Get roster error:', error);
    return c.json({ error: 'Internal server error: ' + error.message }, 500);
  }
});

// ============================================================================
// STEAM API RESEARCH ENDPOINTS
// ============================================================================

/**
 * 🔬 RESEARCH: Test all Steam API endpoints with Kernel Kup 5 data
 * GET /steam-research/test-all
 */
app.get("/make-server-4789f4af/steam-research/test-all", async (c) => {
  console.log('🔬 Testing all Steam API endpoints...');
  
  const results = await steamResearch.testAllSteamEndpoints({
    leagueId: 16273,      // Kernel Kup 5
    seriesId: 2520166,    // C.DAWGS vs FOOP
    matchId: 7616356796,  // C.DAWGS victory
    teamId: 9359693,      // FOOP
    playerId: 108977424   // Sneetch
  });

  return c.json({
    message: 'Steam API Research Complete',
    timestamp: new Date().toISOString(),
    results
  });
});

/**
 * 🔬 RESEARCH: Get comprehensive league data
 * GET /steam-research/league/:leagueId
 */
app.get("/make-server-4789f4af/steam-research/league/:leagueId", async (c) => {
  const leagueId = parseInt(c.req.param('leagueId'));
  console.log(`🔬 Getting comprehensive data for League ${leagueId}...`);
  
  const data = await steamResearch.getLeagueComprehensiveData(leagueId);
  
  return c.json({
    message: `League ${leagueId} Research`,
    timestamp: new Date().toISOString(),
    data
  });
});

/**
 * 🔬 RESEARCH: Compare OpenDota vs Steam API for a league
 * GET /steam-research/compare/:leagueId
 */
app.get("/make-server-4789f4af/steam-research/compare/:leagueId", async (c) => {
  const leagueId = parseInt(c.req.param('leagueId'));
  console.log(`🔬 Comparing OpenDota vs Steam for League ${leagueId}...`);
  
  const [steamData, openDotaData] = await Promise.all([
    steamResearch.getLeagueComprehensiveData(leagueId),
    steamResearch.checkOpenDotaLeagueData(leagueId)
  ]);
  
  return c.json({
    message: `League ${leagueId} Comparison`,
    timestamp: new Date().toISOString(),
    steam: steamData,
    openDota: openDotaData,
    recommendation: 'Check which API provides better data for your use case'
  });
});

/**
 * 🔬 RESEARCH: Compare Steam vs OpenDota for a specific match
 * GET /steam-research/compare-match/:matchId
 */
app.get("/make-server-4789f4af/steam-research/compare-match/:matchId", async (c) => {
  const matchId = parseInt(c.req.param('matchId'));
  console.log(`🔬 Comparing Steam vs OpenDota for Match ${matchId}...`);
  
  const comparison = await steamResearch.compareSteamVsOpenDota(matchId);
  
  return c.json(comparison);
});

// ============================================================================
// TOURNAMENT BUILDER - Master Fetch Endpoint
// ============================================================================

/**
 * 🏗️ TOURNAMENT BUILDER: Fetch Complete Tournament Data
 * POST /kkup/fetch-tournament-builder
 * 
 * This endpoint combines all Steam Lab tests into one comprehensive fetch.
 * It does NOT save to database - just returns data for preview.
 * 
 * Body: {
 *   league_id: number,
 *   series_id?: number,
 *   match_id?: number,
 *   team_id?: number,
 *   player_id?: number
 * }
 */
app.post("/make-server-4789f4af/kkup/fetch-tournament-builder", async (c) => {
  console.log('🏗️ ============================================');
  console.log('🏗️ TOURNAMENT BUILDER: Starting fetch process');
  console.log('🏗️ ============================================');
  
  try {
    // Owner-only check
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      console.error('❌ AUTH ERROR: No access token provided');
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      console.error('❌ AUTH ERROR: Invalid token -', authError?.message);
      return c.json({ error: 'Unauthorized - Invalid token' }, 401);
    }

    console.log(`✅ Authenticated user: ${authUser.id}`);

    // Get user role - owner only
    const { data: dbUser } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (!dbUser || dbUser.role !== 'owner') {
      console.error('❌ AUTHORIZATION ERROR: User is not owner');
      return c.json({ error: 'Owner access required' }, 403);
    }

    console.log(`✅ Authorization confirmed: User is owner`);

    // Parse request body
    const body = await c.req.json();
    const { league_id, series_id, match_id, team_id, player_id } = body;

    console.log('📥 Request inputs:', {
      league_id,
      series_id: series_id || 'not provided',
      match_id: match_id || 'not provided',
      team_id: team_id || 'not provided',
      player_id: player_id || 'not provided'
    });

    if (!league_id) {
      console.error('❌ VALIDATION ERROR: league_id is required');
      return c.json({ error: 'league_id is required' }, 400);
    }

    const results: any = {
      timestamp: new Date().toISOString(),
      inputs: { league_id, series_id, match_id, team_id, player_id },
      league: { status: 'pending', data: null, error: null },
      teams: { status: 'pending', data: null, error: null },
      matches: { status: 'pending', data: null, error: null },
      players: { status: 'pending', data: null, error: null },
      comparison: { status: 'pending', data: null, error: null },
      summary: {
        totalTeams: 0,
        totalMatches: 0,
        totalPlayers: 0,
        dataQuality: 'unknown'
      },
      recommendations: []
    };

    // ============================================
    // Stage 1: Fetch League Data (OpenDota)
    // ============================================
    console.log('');
    console.log('📊 ============================================');
    console.log('📊 STAGE 1: Fetching League Data from OpenDota');
    console.log('📊 ============================================');
    console.log(`📊 URL: https://api.opendota.com/api/leagues/${league_id}`);
    results.league.status = 'fetching';
    
    try {
      const leagueResponse = await fetch(`https://api.opendota.com/api/leagues/${league_id}`);
      const leagueData = await leagueResponse.json();
      
      if (leagueResponse.ok && !leagueData.error) {
        results.league.status = 'success';
        results.league.data = leagueData;
        console.log(`✅ LEAGUE SUCCESS: "${leagueData.name}"`)
        console.log(`   - League ID: ${leagueData.leagueid}`)
        console.log(`   - Tier: ${leagueData.tier || 'Unknown'}`);
      } else {
        results.league.status = 'error';
        results.league.error = leagueData.error || 'League not found';
        console.error(`❌ LEAGUE ERROR: ${results.league.error}`);
      }
    } catch (error) {
      results.league.status = 'error';
      results.league.error = String(error);
      console.error('❌ LEAGUE EXCEPTION:', error);
    }
    console.log('📊 Stage 1 Complete');

    // ============================================
    // Stage 2: Fetch Series Data (OpenDota)
    // ============================================
    console.log('');
    console.log('📺 ============================================');
    console.log('📺 STAGE 2: Fetching Series Data from OpenDota');
    console.log('📺 ============================================');
    results.series = { status: 'fetching', data: null, error: null };
    
    if (series_id) {
      console.log(`📺 Series ID provided: ${series_id}`);
      try {
        const seriesResponse = await fetch(`https://api.opendota.com/api/series/${series_id}`);
        const seriesData = await seriesResponse.json();
        
        if (seriesResponse.ok && !seriesData.error) {
          results.series.status = 'success';
          results.series.data = seriesData;
          console.log(`✅ SERIES SUCCESS: Found series data`);
          console.log(`   - Series ID: ${seriesData.series_id || series_id}`);
          console.log(`   - Series Type: ${seriesData.series_type || 'Unknown'}`);
          console.log(`   - Matches in series: ${seriesData.matches?.length || 0}`);
        } else {
          results.series.status = 'error';
          results.series.error = seriesData.error || 'Series not found';
          console.error(`❌ SERIES ERROR: ${results.series.error}`);
        }
      } catch (error) {
        results.series.status = 'error';
        results.series.error = String(error);
        console.error('❌ SERIES EXCEPTION:', error);
      }
    } else {
      results.series.status = 'skipped';
      results.series.error = 'No series_id provided';
      console.log('⏭️  SERIES SKIPPED: No series_id provided');
    }
    console.log('📺 Stage 2 Complete');

    // ============================================
    // Stage 3: Fetch Matches Data (Steam API)
    // ============================================
    console.log('');
    console.log('🎮 ============================================');
    console.log('🎮 STAGE 3: Fetching Matches from Steam API');
    console.log('🎮 ============================================');
    results.matches.status = 'fetching';
    
    try {
      // Use Steam GetMatchHistory with league filter
      const STEAM_API_KEY = Deno.env.get('STEAM_WEB_API_KEY') ?? '';
      const DOTA2_APP_ID = 570;
      const historyUrl = `https://api.steampowered.com/IDOTA2Match_${DOTA2_APP_ID}/GetMatchHistory/v1/?key=${STEAM_API_KEY}&league_id=${league_id}&matches_requested=100`;
      
      console.log(`🎮 Requesting matches for league_id: ${league_id}`);
      console.log(`🎮 Matches requested: 100`);
      
      const historyResponse = await fetch(historyUrl);
      const historyData = await historyResponse.json();
      
      if (historyData?.result?.matches && Array.isArray(historyData.result.matches)) {
        results.matches.status = 'success';
        results.matches.data = historyData.result.matches;
        results.summary.totalMatches = historyData.result.matches.length;
        console.log(`✅ MATCHES SUCCESS: Found ${results.summary.totalMatches} matches`);
        console.log(`   - First match ID: ${historyData.result.matches[0]?.match_id || 'N/A'}`);
        console.log(`   - Last match ID: ${historyData.result.matches[historyData.result.matches.length - 1]?.match_id || 'N/A'}`);
      } else {
        results.matches.status = 'error';
        results.matches.error = 'No matches found in Steam API response';
        console.error(`❌ MATCHES ERROR: No matches in response`);
        console.error(`   - Response status: ${historyResponse.status}`);
        console.error(`   - Response data:`, historyData);
      }
    } catch (error) {
      results.matches.status = 'error';
      results.matches.error = String(error);
      console.error('❌ MATCHES EXCEPTION:', error);
    }
    console.log('🎮 Stage 3 Complete');

    // ============================================
    // Stage 4: Extract Teams from Matches and Enrich with Real Data (Steam API Primary, OpenDota Backup)
    // ============================================
    console.log('');
    console.log('🏆 ============================================');
    console.log('🏆 STAGE 4: Extracting & Enriching Teams');
    console.log('🏆 ============================================');
    results.teams.status = 'processing';
    
    try {
      if (results.matches.data && Array.isArray(results.matches.data)) {
        const uniqueTeamIds = new Set();
        const teamDetails: any[] = [];
        
        // Extract unique team IDs from matches
        results.matches.data.forEach((match: any) => {
          if (match.radiant_team_id) {
            uniqueTeamIds.add(match.radiant_team_id);
          }
          if (match.dire_team_id) {
            uniqueTeamIds.add(match.dire_team_id);
          }
        });

        console.log(`🏆 Found ${uniqueTeamIds.size} unique teams in matches`);
        console.log(`🏆 Team IDs:`, Array.from(uniqueTeamIds));
        console.log(`🏆 Starting team enrichment (Steam API → OpenDota backup)...`);

        // Fetch real team data for each team
        let steamSuccesses = 0;
        let openDotaSuccesses = 0;
        let failures = 0;
        
        for (const teamId of Array.from(uniqueTeamIds)) {
          try {
            // Try Steam API first (PRIMARY)
            const STEAM_API_KEY = Deno.env.get('STEAM_WEB_API_KEY') ?? '';
            const steamTeamUrl = `https://api.steampowered.com/IDOTA2Match_570/GetTeamInfoByTeamID/v1/?key=${STEAM_API_KEY}&start_at_team_id=${teamId}&teams_requested=1`;
            
            const steamResponse = await fetch(steamTeamUrl);
            const steamData = await steamResponse.json();
            
            let teamInfo: any = {
              team_id: teamId,
              team_name: `Team ${teamId}`,
              tag: `T${String(teamId).slice(-4)}`,
              logo_url: null,
              wins: 0,
              losses: 0
            };

            // Check if Steam API returned team data
            if (steamData?.result?.teams?.[0]) {
              const steamTeam = steamData.result.teams[0];
              teamInfo.team_name = steamTeam.name || teamInfo.team_name;
              teamInfo.tag = steamTeam.tag || teamInfo.tag;
              // Convert logo ID to actual URL if we have a logo
              if (steamTeam.logo || steamTeam.url_logo) {
                teamInfo.logo_url = getSteamLogoUrl(steamTeam.logo || steamTeam.url_logo);
              }
              console.log(`  ✅ [${++steamSuccesses}/${uniqueTeamIds.size}] Steam: ${teamInfo.team_name} (${teamInfo.tag})`);
            } else {
              // Fallback to OpenDota API
              console.log(`  ⚠️ Steam failed for team ${teamId}, trying OpenDota...`);
              const odotaTeamUrl = `https://api.opendota.com/api/teams/${teamId}`;
              const odotaResponse = await fetch(odotaTeamUrl);
              
              if (odotaResponse.ok) {
                const odotaTeam = await odotaResponse.json();
                if (odotaTeam && odotaTeam.name) {
                  teamInfo.team_name = odotaTeam.name;
                  teamInfo.tag = odotaTeam.tag || teamInfo.tag;
                  teamInfo.logo_url = odotaTeam.logo_url || null;
                  teamInfo.wins = odotaTeam.wins || 0;
                  teamInfo.losses = odotaTeam.losses || 0;
                  console.log(`  ✅ OpenDota: ${teamInfo.team_name} (${teamInfo.tag})`);
                  openDotaSuccesses++;
                } else {
                  console.log(`  ⚠️ OpenDota returned no data for team ${teamId}`);
                  failures++;
                }
              } else {
                console.log(`  ❌ Both APIs failed for team ${teamId}`);
                failures++;
              }
            }

            teamDetails.push(teamInfo);

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (teamError) {
            console.error(`  ❌ Error enriching team ${teamId}:`, teamError);
            // Add basic team info as fallback
            teamDetails.push({
              team_id: teamId,
              team_name: `Team ${teamId}`,
              tag: `T${String(teamId).slice(-4)}`,
              logo_url: null,
              wins: 0,
              losses: 0
            });
          }
        }

        // Calculate W/L records from matches
        console.log(`🏆 Calculating W/L records from ${results.matches.data.length} matches...`);
        const teamWinLossMap = new Map();
        teamDetails.forEach(team => {
          teamWinLossMap.set(team.team_id, { wins: 0, losses: 0 });
        });

        results.matches.data.forEach((match: any) => {
          if (match.radiant_team_id && match.dire_team_id) {
            const radiantStats = teamWinLossMap.get(match.radiant_team_id);
            const direStats = teamWinLossMap.get(match.dire_team_id);
            
            if (match.radiant_win) {
              if (radiantStats) radiantStats.wins++;
              if (direStats) direStats.losses++;
            } else {
              if (direStats) direStats.wins++;
              if (radiantStats) radiantStats.losses++;
            }
          }
        });

        // Update team records
        teamDetails.forEach(team => {
          const stats = teamWinLossMap.get(team.team_id);
          if (stats) {
            team.wins = stats.wins;
            team.losses = stats.losses;
          }
        });

        results.teams.status = 'success';
        results.teams.data = teamDetails;
        results.summary.totalTeams = teamDetails.length;
        console.log(`✅ TEAMS SUCCESS: Enriched ${results.summary.totalTeams} teams with W/L records`);
        console.log(`   - Steam API successes: ${steamSuccesses}`);
        console.log(`   - OpenDota successes: ${openDotaSuccesses}`);
        console.log(`   - Failures (using fallback): ${failures}`);
      } else {
        results.teams.status = 'error';
        results.teams.error = 'No match data to extract teams from';
        console.error(`❌ TEAMS ERROR: No match data available`);
      }
    } catch (error) {
      results.teams.status = 'error';
      results.teams.error = String(error);
      console.error('❌ TEAMS EXCEPTION:', error);
    }
    console.log('🏆 Stage 4 Complete');

    // ============================================
    // Stage 5: Extract Players from Matches and Enrich with Real Data (OpenDota Primary, Steam Backup)
    // ============================================
    console.log('');
    console.log('👥 ============================================');
    console.log('👥 STAGE 5: Extracting & Enriching Players');
    console.log('👥 ============================================');
    results.players.status = 'processing';
    
    try {
      if (results.matches.data && Array.isArray(results.matches.data)) {
        const uniquePlayers = new Set();
        const playerDetails: any[] = [];
        
        // Extract unique player IDs from matches
        results.matches.data.forEach((match: any) => {
          if (match.players && Array.isArray(match.players)) {
            match.players.forEach((player: any) => {
              if (player.account_id) {
                uniquePlayers.add(player.account_id);
              }
            });
          }
        });

        console.log(`👥 Found ${uniquePlayers.size} unique players in matches`);
        console.log(`👥 Starting player enrichment (OpenDota → Steam backup)...`);

        // Fetch real player data for each player
        let openDotaPlayerSuccesses = 0;
        let steamPlayerSuccesses = 0;
        let playerFailures = 0;
        
        for (const accountId of Array.from(uniquePlayers)) {
          try {
            // Try OpenDota first for player profiles (it has better player data)
            const steam32Id = accountId;
            const steam64Id = BigInt(steam32Id) + BigInt('76561197960265728');
            
            let playerInfo: any = {
              account_id: steam32Id,
              steam_id: steam64Id.toString(),
              name: `Player ${steam32Id}`,
              avatar_url: null,
              dotabuff_url: `https://www.dotabuff.com/players/${steam32Id}`,
              opendota_url: `https://www.opendota.com/players/${steam32Id}`
            };

            // Try OpenDota API first (PRIMARY for player data)
            const odotaPlayerUrl = `https://api.opendota.com/api/players/${steam32Id}`;
            const odotaResponse = await fetch(odotaPlayerUrl);
            
            if (odotaResponse.ok) {
              const odotaPlayer = await odotaResponse.json();
              if (odotaPlayer && odotaPlayer.profile) {
                playerInfo.name = odotaPlayer.profile?.personaname || odotaPlayer.profile?.name || playerInfo.name;
                playerInfo.avatar_url = odotaPlayer.profile?.avatarfull || odotaPlayer.profile?.avatar || null;
                openDotaPlayerSuccesses++;
                if (openDotaPlayerSuccesses % 10 === 0 || openDotaPlayerSuccesses <= 3) {
                  console.log(`  ✅ [${openDotaPlayerSuccesses}/${uniquePlayers.size}] OpenDota: ${playerInfo.name}`);
                }
              } else {
                playerFailures++;
              }
            } else {
              // Fallback to Steam API
              const STEAM_API_KEY = Deno.env.get('STEAM_WEB_API_KEY') ?? '';
              const steamPlayerUrl = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${STEAM_API_KEY}&steamids=${steam64Id}`;
              
              const steamResponse = await fetch(steamPlayerUrl);
              if (steamResponse.ok) {
                const steamData = await steamResponse.json();
                if (steamData?.response?.players?.[0]) {
                  const steamPlayer = steamData.response.players[0];
                  playerInfo.name = steamPlayer.personaname || playerInfo.name;
                  playerInfo.avatar_url = steamPlayer.avatarfull || steamPlayer.avatar || null;
                  steamPlayerSuccesses++;
                  if (steamPlayerSuccesses <= 3) {
                    console.log(`  ✅ Steam: ${playerInfo.name}`);
                  }
                } else {
                  playerFailures++;
                }
              } else {
                playerFailures++;
              }
            }

            playerDetails.push(playerInfo);

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (playerError) {
            console.error(`  ❌ Error enriching player ${accountId}:`, playerError);
            // Add basic player info as fallback
            const steam32Id = accountId;
            const steam64Id = BigInt(steam32Id) + BigInt('76561197960265728');
            playerDetails.push({
              account_id: steam32Id,
              steam_id: steam64Id.toString(),
              name: `Player ${steam32Id}`,
              avatar_url: null,
              dotabuff_url: `https://www.dotabuff.com/players/${steam32Id}`,
              opendota_url: `https://www.opendota.com/players/${steam32Id}`
            });
          }
        }

        results.players.status = 'success';
        results.players.data = playerDetails;
        results.summary.totalPlayers = uniquePlayers.size;
        console.log(`✅ PLAYERS SUCCESS: Enriched ${results.summary.totalPlayers} players`);
        console.log(`   - OpenDota API successes: ${openDotaPlayerSuccesses}`);
        console.log(`   - Steam API successes: ${steamPlayerSuccesses}`);
        console.log(`   - Failures (using fallback): ${playerFailures}`);
      } else {
        results.players.status = 'error';
        results.players.error = 'No match data to extract players from';
        console.error(`❌ PLAYERS ERROR: No match data available`);
      }
    } catch (error) {
      results.players.status = 'error';
      results.players.error = String(error);
      console.error('❌ PLAYERS EXCEPTION:', error);
    }
    console.log('👥 Stage 5 Complete');

    // ============================================
    // Stage 6: Data Comparison (if match_id provided)
    // ============================================
    if (match_id) {
      console.log('');
      console.log('🔍 ============================================');
      console.log('🔍 STAGE 6: Steam vs OpenDota Comparison');
      console.log('🔍 ============================================');
      console.log(`🔍 Comparing match_id: ${match_id}`);
      results.comparison.status = 'fetching';
      
      try {
        const comparisonData = await steamResearch.compareSteamVsOpenDota(match_id);
        results.comparison.status = 'success';
        results.comparison.data = comparisonData;
        console.log(`✅ COMPARISON SUCCESS: Data validated`);
      } catch (error) {
        results.comparison.status = 'error';
        results.comparison.error = String(error);
        console.error('❌ COMPARISON ERROR:', error);
      }
      console.log('🔍 Stage 6 Complete');
    } else {
      results.comparison.status = 'skipped';
      results.comparison.error = 'No match_id provided for comparison';
      console.log('🔍 Stage 5 skipped (no match_id provided)');
    }

    // ============================================
    // Generate Recommendations
    // ============================================
    const successCount = [
      results.league.status === 'success',
      results.teams.status === 'success',
      results.matches.status === 'success',
      results.players.status === 'success'
    ].filter(Boolean).length;

    if (successCount === 4) {
      results.summary.dataQuality = 'excellent';
      results.recommendations.push('✅ All data fetched successfully! Ready to create tournament.');
      results.recommendations.push(`🏆 Found ${results.summary.totalTeams} teams, ${results.summary.totalMatches} matches, ${results.summary.totalPlayers} players`);
      
      if (results.league.data) {
        results.recommendations.push(`📋 League: "${results.league.data.name}"`);
      }
    } else if (successCount >= 2) {
      results.summary.dataQuality = 'partial';
      results.recommendations.push('⚠️ Some data missing, but tournament can still be created');
      
      if (results.league.status !== 'success') {
        results.recommendations.push('❌ League data missing - verify league_id is correct');
      }
      if (results.teams.status !== 'success') {
        results.recommendations.push('⚠️ Teams data missing - may need to add teams manually');
      }
      if (results.matches.status !== 'success') {
        results.recommendations.push('⚠️ Matches data missing - may need to add matches manually');
      }
    } else {
      results.summary.dataQuality = 'poor';
      results.recommendations.push('❌ Most data failed to fetch - check league_id and try again');
      results.recommendations.push('💡 Make sure the league exists on OpenDota');
    }

    console.log('');
    console.log('🏗️ ============================================');
    console.log('🏗️ TOURNAMENT BUILDER: Fetch Complete');
    console.log('🏗️ ============================================');
    console.log(`🏗️ Data Quality: ${results.summary.dataQuality.toUpperCase()}`);
    console.log(`🏗️ Teams Found: ${results.summary.totalTeams}`);
    console.log(`🏗️ Matches Found: ${results.summary.totalMatches}`);
    console.log(`🏗️ Players Found: ${results.summary.totalPlayers}`);
    console.log(`🏗️ Recommendations: ${results.recommendations.length}`);
    console.log('🏗️ ============================================');
    
    return c.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('❌ Tournament Builder error:', error);
    return c.json({
      success: false,
      error: String(error)
    }, 500);
  }
});

/**
 * 🏗️ TOURNAMENT BUILDER: Import Tournament from Builder Data
 * POST /kkup/import-tournament-builder
 * 
 * Takes the results from fetch-tournament-builder and creates tournament + teams + matches
 * 
 * Body: {
 *   tournament_name: string,
 *   league_data: object (from fetch results),
 *   teams_data: array (from fetch results),
 *   matches_data: array (from fetch results),
 *   metadata: { youtube_playlist_url?, twitch_channel?, etc }
 * }
 */
app.post("/make-server-4789f4af/kkup/import-tournament-builder", async (c) => {
  console.log('');
  console.log('💾 ============================================');
  console.log('💾 TOURNAMENT BUILDER: Starting Import Process');
  console.log('💾 ============================================');
  
  try {
    // Owner-only check
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized - Invalid token' }, 401);
    }

    // Get user role - owner only
    const { data: dbUser } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (!dbUser || dbUser.role !== 'owner') {
      return c.json({ error: 'Owner access required' }, 403);
    }

    console.log(`✅ Authenticated user: ${authUser.id} (owner)`);

    // Parse request body
    const body = await c.req.json();
    const { tournament_name, league_data, teams_data, matches_data, metadata = {} } = body;

    if (!tournament_name || !league_data) {
      console.error('❌ VALIDATION ERROR: Missing required fields');
      return c.json({ error: 'tournament_name and league_data are required' }, 400);
    }

    console.log(`💾 Tournament Name: "${tournament_name}"`);
    console.log(`💾 League ID: ${league_data.leagueid || league_data.league_id}`);
    console.log(`💾 Teams to import: ${teams_data?.length || 0}`);
    console.log(`💾 Matches to import: ${matches_data?.length || 0}`);

    // ============================================
    // Step 1: Create Tournament Record
    // ============================================
    console.log('');
    console.log('📝 Step 1: Creating Tournament Record...');
    const leagueId = league_data.leagueid || league_data.league_id;
    const tournamentStartDate = league_data.start_date 
      ? new Date(league_data.start_date * 1000).toISOString()
      : new Date().toISOString();
    const tournamentEndDate = league_data.end_date
      ? new Date(league_data.end_date * 1000).toISOString()
      : new Date().toISOString();

    // Check if tournament already exists
    const { data: existingTournament } = await supabase
      .from('kernel_kups')
      .select('*')
      .eq('league_id', leagueId)
      .maybeSingle();

    let tournament;
    let kkupId;

    if (existingTournament) {
      console.log(`⚠️ TOURNAMENT EXISTS: league_id ${leagueId} (ID: ${existingTournament.id})`);
      console.log(`   Updating existing tournament instead of creating new one`);
      tournament = existingTournament;
      kkupId = existingTournament.id;
      
      await supabase
        .from('kernel_kups')
        .update({
          name: tournament_name,
          import_status: 'in_progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', kkupId);
    } else {
      const { data: newTournament, error: tournamentError } = await supabase
        .from('kernel_kups')
        .insert({
          name: tournament_name,
          league_id: leagueId,
          series_id: metadata.series_id || 0,
          verified_match_id: metadata.verified_match_id || 0,
          tournament_start_date: tournamentStartDate,
          tournament_end_date: tournamentEndDate,
          prize_pool: metadata.prize_pool || 'TBD',
          status: metadata.status || 'completed',
          description: metadata.description || league_data.name || tournament_name,
          twitch_channel: metadata.twitch_channel || '',
          youtube_playlist_url: metadata.youtube_playlist_url || '',
          cover_photo_url: league_data.banner || null,
          import_status: 'in_progress',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (tournamentError) {
        console.error('Tournament creation error:', tournamentError);
        return c.json({ error: 'Failed to create tournament', details: tournamentError.message }, 500);
      }

      tournament = newTournament;
      kkupId = newTournament.id;
      console.log(`✅ TOURNAMENT CREATED: ID ${kkupId}`);
    }

    // ============================================
    // Step 2: Create Teams
    // ============================================
    console.log('');
    console.log('🏆 Step 2: Creating Teams...');
    const teamIdMap = new Map(); // Map OpenDota team_id to database team id
    let teamsCreated = 0;

    if (teams_data && Array.isArray(teams_data) && teams_data.length > 0) {
      console.log(`🏆 Processing ${teams_data.length} teams...`);
      
      for (const team of teams_data) {
        try {
          const { data: dbTeam, error: teamError } = await supabase
            .from('kkup_teams')
            .insert({
              kernel_kup_id: kkupId,
              valve_team_id: team.team_id,
              name: team.team_name || team.name || `Team ${team.team_id}`,
              tag: team.tag || team.team_name?.substring(0, 5).toUpperCase() || 'TEAM',
              logo_url: team.logo_url || null,
              wins: team.wins || 0,
              losses: team.losses || 0,
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (!teamError && dbTeam) {
            teamIdMap.set(team.team_id, dbTeam.id);
            teamsCreated++;
            if (teamsCreated <= 5 || teamsCreated % 5 === 0) {
              console.log(`  ✅ [${teamsCreated}/${teams_data.length}] ${dbTeam.name}`);
            }
          } else {
            console.error(`  ❌ Failed to create team ${team.team_id}:`, teamError?.message);
          }
        } catch (error) {
          console.error(`  ❌ Exception creating team ${team.team_id}:`, error);
        }
      }
      
      console.log(`✅ TEAMS COMPLETE: Created ${teamsCreated}/${teams_data.length} teams`);
    }

    // ============================================
    // Step 3: Create Player Profiles & Team Rosters
    // ============================================
    console.log('');
    console.log('👥 Step 3: Creating Player Profiles & Team Rosters...');
    const playerProfileMap = new Map(); // Map account_id to player_profile id
    let playersCreated = 0;
    let rosterLinksCreated = 0;

    // Extract all unique players from matches
    const playersByTeam = new Map<number, Set<number>>(); // Map team_id to Set of account_ids
    const playerDataMap = new Map(); // Map account_id to player data

    if (matches_data && Array.isArray(matches_data)) {
      for (const match of matches_data) {
        if (match.players && Array.isArray(match.players)) {
          for (const player of match.players) {
            if (player.account_id) {
              // Store player data
              if (!playerDataMap.has(player.account_id)) {
                playerDataMap.set(player.account_id, player);
              }

              // Map players to teams
              const teamId = player.player_slot < 128 ? match.radiant_team_id : match.dire_team_id;
              if (!playersByTeam.has(teamId)) {
                playersByTeam.set(teamId, new Set());
              }
              playersByTeam.get(teamId)?.add(player.account_id);
            }
          }
        }
      }
    }

    console.log(`👥 Found ${playerDataMap.size} unique players across all matches`);

    // Create player profiles
    for (const [accountId, playerData] of playerDataMap.entries()) {
      try {
        const steam32Id = accountId;
        const steam64Id = BigInt(steam32Id) + BigInt('76561197960265728');
        
        // Try to get player name from OpenDota/Steam (we should have this from tournament builder)
        let playerName = `Player ${steam32Id}`;
        let avatarUrl = null;

        // Quick fetch from OpenDota for player info
        try {
          const odotaPlayerUrl = `https://api.opendota.com/api/players/${steam32Id}`;
          const odotaResponse = await fetch(odotaPlayerUrl);
          
          if (odotaResponse.ok) {
            const odotaPlayer = await odotaResponse.json();
            if (odotaPlayer?.profile) {
              playerName = odotaPlayer.profile.personaname || odotaPlayer.profile.name || playerName;
              avatarUrl = odotaPlayer.profile.avatarfull || odotaPlayer.profile.avatar || null;
            }
          }
        } catch (apiError) {
          console.log(`⚠️ Could not fetch player data for ${steam32Id}, using defaults`);
        }

        // Check if player profile already exists
        const { data: existingProfile } = await supabase
          .from('kkup_player_profiles')
          .select('id')
          .eq('steam_id', steam64Id.toString())
          .maybeSingle();

        if (existingProfile) {
          playerProfileMap.set(accountId, existingProfile.id);
          console.log(`  ℹ️  [Supabase]   Player already exists: ${playerName} (${steam32Id})`);
        } else {
          // Create new player profile
          const { data: newProfile, error: profileError } = await supabase
            .from('kkup_player_profiles')
            .insert({
              steam_id: steam64Id.toString(),
              name: playerName,
              avatar_url: avatarUrl,
              opendota_id: String(steam32Id),
              opendota_url: `https://www.opendota.com/players/${steam32Id}`,
              created_at: new Date().toISOString()
            })
            .select()
            .single();

          if (!profileError && newProfile) {
            playerProfileMap.set(accountId, newProfile.id);
            playersCreated++;
            if (playersCreated <= 5 || playersCreated % 10 === 0) {
              console.log(`  ✅ [${playersCreated}/${playerDataMap.size}] ${playerName}`);
            }
          } else {
            console.error(`  ❌ [Supabase]   ❌ Failed to create player ${steam32Id}:`, profileError);
          }
        }

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 50));
      } catch (error) {
        console.error(`Error creating player profile for ${accountId}:`, error);
      }
    }

    console.log(`✅ Created ${playersCreated} new player profiles`);

    // Create team roster relationships
    for (const [teamId, playerIds] of playersByTeam.entries()) {
      const dbTeamId = teamIdMap.get(teamId);
      if (!dbTeamId) continue;

      for (const accountId of playerIds) {
        try {
          const playerProfileId = playerProfileMap.get(accountId);
          if (!playerProfileId) continue;

          // Check if relationship already exists
          const { data: existingLink } = await supabase
            .from('kkup_team_players')
            .select('id')
            .eq('team_id', dbTeamId)
            .eq('player_profile_id', playerProfileId)
            .maybeSingle();

          if (!existingLink) {
            const { error: rosterError } = await supabase
              .from('kkup_team_players')
              .insert({
                team_id: dbTeamId,
                player_profile_id: playerProfileId,
                created_at: new Date().toISOString()
              });

            if (!rosterError) {
              rosterLinksCreated++;
            } else {
              console.error(`Failed to create roster link:`, rosterError);
            }
          }
        } catch (error) {
          console.error(`Error creating roster link:`, error);
        }
      }
    }

    console.log(`✅ Created ${rosterLinksCreated} team roster relationships`);

    // ============================================
    // Step 4: Create Matches with Full OpenDota Data
    // ============================================
    let matchesCreated = 0;
    let playerStatsCreated = 0;
    const apiKey = Deno.env.get('OPENDOTA_API_KEY');

    if (matches_data && Array.isArray(matches_data) && matches_data.length > 0) {
      console.log('');
      console.log(`🎮 Step 4: Creating ${matches_data.length} matches with FULL data from OpenDota...`);
      
      for (let i = 0; i < matches_data.length; i++) {
        const match = matches_data[i];
        try {
          console.log(`🎮 [${i + 1}/${matches_data.length}] Fetching match ${match.match_id} from OpenDota...`);

          // 🔥 FETCH DETAILED MATCH DATA FROM OPENDOTA
          const matchDetailUrl = `https://api.opendota.com/api/matches/${match.match_id}?api_key=${apiKey}`;
          const matchDetailResponse = await fetch(matchDetailUrl);
          
          if (!matchDetailResponse.ok) {
            console.error(`   ❌ Failed to fetch match ${match.match_id} from OpenDota (HTTP ${matchDetailResponse.status})`);
            continue;
          }

          const matchDetail = await matchDetailResponse.json();

          if (!matchDetail || matchDetail.error) {
            console.error(`   ❌ Match ${match.match_id} returned error from OpenDota:`, matchDetail?.error);
            continue;
          }

          console.log(`   ✅ Fetched match details: ${matchDetail.radiant_score} - ${matchDetail.dire_score}`);

          // Get database team IDs
          const dbTeam1Id = teamIdMap.get(match.radiant_team_id || matchDetail.radiant_team_id);
          const dbTeam2Id = teamIdMap.get(match.dire_team_id || matchDetail.dire_team_id);

          if (!dbTeam1Id || !dbTeam2Id) {
            console.log(`   ⚠️ Skipping match ${match.match_id} - teams not found in database`);
            continue;
          }

          // Determine winner from OpenDota data
          const winnerTeamId = matchDetail.radiant_win ? dbTeam1Id : dbTeam2Id;

          // Use REAL SCORES from OpenDota (radiant_score/dire_score = total kills)
          const team1Score = matchDetail.radiant_score || 0;
          const team2Score = matchDetail.dire_score || 0;

          // Check if match already exists
          const { data: existingMatch } = await supabase
            .from('kkup_matches')
            .select('id')
            .eq('match_id', match.match_id)
            .maybeSingle();

          let dbMatch;
          if (existingMatch) {
            console.log(`   ⚠️ Match ${match.match_id} already exists, skipping...`);
            dbMatch = existingMatch;
          } else {
            const { data: newMatch, error: matchError } = await supabase
              .from('kkup_matches')
              .insert({
                kernel_kup_id: kkupId,
                match_id: match.match_id,
                series_id: match.series_id || matchDetail.series_id || null,
                team1_id: dbTeam1Id,
                team2_id: dbTeam2Id,
                winner_team_id: winnerTeamId,
                team1_score: team1Score,
                team2_score: team2Score,
                stage: 'playoffs',
                status: 'completed',
                scheduled_time: matchDetail.start_time ? new Date(matchDetail.start_time * 1000).toISOString() : new Date().toISOString(),
                dotabuff_url: `https://www.dotabuff.com/matches/${match.match_id}`,
                duration: matchDetail.duration || 0,
                best_of: match.best_of || 1,
                created_at: new Date().toISOString()
              })
              .select()
              .single();

            if (matchError) {
              console.error(`   ❌ [Supabase]    ❌ Failed to create match ${match.match_id}:`, matchError);
              continue;
            }
            
            dbMatch = newMatch;
            matchesCreated++;
            console.log(`   ✅ Match created in database`);
          }

          // Create player stats for this match using FULL OpenDota data
          if (dbMatch) {
            if (matchDetail.players && Array.isArray(matchDetail.players)) {
              console.log(`   📊 Creating stats for ${matchDetail.players.length} players...`);
              
              for (const player of matchDetail.players) {
                try {
                  // Determine which team this player was on
                  const isRadiant = player.player_slot < 128;
                  const playerTeamId = isRadiant ? dbTeam1Id : dbTeam2Id;
                  const isWinner = matchDetail.radiant_win === isRadiant;

                  // Get player profile ID
                  const playerProfileId = playerProfileMap.get(player.account_id);

                  // Skip if no player profile (shouldn't happen, but safety check)
                  if (!playerProfileId) {
                    console.log(`   ⚠️ Skipping player ${player.account_id} - no profile found`);
                    continue;
                  }

                  await supabase
                    .from('kkup_match_player_stats')
                    .insert({
                      match_id: dbMatch.id,
                      team_id: playerTeamId,
                      player_profile_id: playerProfileId,  // Correct field name
                      steam_id: player.account_id || null,  // Steam32 ID (bigint)
                      player_name: player.personaname || `Player ${player.account_id || 'Unknown'}`,
                      hero_id: player.hero_id || 0,
                      hero_name: getHeroName(player.hero_id || 0),
                      kills: player.kills || 0,
                      deaths: player.deaths || 0,
                      assists: player.assists || 0,
                      last_hits: player.last_hits || 0,
                      denies: player.denies || 0,
                      gpm: player.gold_per_min || 0,
                      xpm: player.xp_per_min || 0,
                      hero_damage: player.hero_damage || 0,
                      tower_damage: player.tower_damage || 0,
                      hero_healing: player.hero_healing || 0,
                      level: player.level || 0,
                      net_worth: player.net_worth || player.total_gold || 0,
                      item_0: player.item_0 || null,
                      item_1: player.item_1 || null,
                      item_2: player.item_2 || null,
                      item_3: player.item_3 || null,
                      item_4: player.item_4 || null,
                      item_5: player.item_5 || null,
                      observer_uses: player.observer_uses || player.purchase_observer || 0,
                      sentry_uses: player.sentry_uses || player.purchase_sentry || 0,
                      is_winner: isWinner
                    });
                  
                  playerStatsCreated++;
                } catch (playerError) {
                  console.error(`   ❌ Error creating player stat:`, playerError);
                }
              }
              
              console.log(`   ✅ Created stats for ${matchDetail.players.length} players`);
            }
          }

          // Small delay to avoid rate limiting OpenDota
          await new Promise(resolve => setTimeout(resolve, 250));

        } catch (error) {
          console.error(`❌ Error processing match ${match.match_id}:`, error);
        }
      }
      
      console.log('');
      console.log(`✅ MATCHES COMPLETE: Created ${matchesCreated}/${matches_data.length} matches`);
      console.log(`✅ PLAYER STATS: Created ${playerStatsCreated} player stat records`);
    }

    // ============================================
    // Step 5: Mark Tournament as Complete
    // ============================================
    await supabase
      .from('kernel_kups')
      .update({
        import_status: 'completed',
        imported_at: new Date().toISOString()
      })
      .eq('id', kkupId);

    console.log('');
    console.log('💾 ============================================');
    console.log('💾 TOURNAMENT IMPORT: Complete!');
    console.log('💾 ============================================');
    console.log(`💾 Tournament ID: ${kkupId}`);
    console.log(`💾 Teams Created: ${teamsCreated}`);
    console.log(`💾 Matches Created: ${matchesCreated} (with full OpenDota data)`);
    console.log(`💾 Player Stats Created: ${playerStatsCreated}`);
    console.log(`💾 Player Profiles Created: ${playersCreated}`);
    console.log(`💾 Roster Links: ${rosterLinksCreated}`);
    console.log('💾 ============================================');

    return c.json({
      success: true,
      tournament_id: kkupId,
      stats: {
        teams_created: teamsCreated,
        matches_created: matchesCreated,
        player_stats_created: playerStatsCreated,
        players_created: playersCreated,
        roster_links_created: rosterLinksCreated
      }
    });

  } catch (error) {
    console.error('❌ Tournament import error:', error);
    return c.json({
      success: false,
      error: String(error)
    }, 500);
  }
});

// ============================================================================
// NON-LEAGUE TOURNAMENT BUILDER - Search & Build
// ============================================================================

import { normalizePlayerId, searchMatchViaPlayerHistory } from './non-league-builder.tsx';

/**
 * 🔧 NON-LEAGUE TOURNAMENT BUILDER: Search for Matches
 * POST /kkup/build-non-league
 * 
 * This endpoint searches for matches without a league ID using available data:
 * - Match IDs (direct fetch when available)
 * - Player IDs + Team IDs + Date Range (search player histories)
 * 
 * Returns found/uncertain/missing matches with confidence scores
 */
app.post("/make-server-4789f4af/kkup/build-non-league", async (c) => {
  console.log('🔧 ============================================');
  console.log('🔧 NON-LEAGUE BUILDER: Starting search');
  console.log('🔧 ============================================');
  
  try {
    // Owner-only check
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      console.error('❌ AUTH ERROR: No access token provided');
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      console.error('❌ AUTH ERROR: Invalid token -', authError?.message);
      return c.json({ error: 'Unauthorized - Invalid token' }, 401);
    }

    // Get user role - owner only
    const { data: dbUser } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (!dbUser || dbUser.role !== 'owner') {
      console.error('❌ AUTHORIZATION ERROR: User is not owner');
      return c.json({ error: 'Owner access required' }, 403);
    }

    console.log(`✅ Authorization confirmed: User is owner`);

    // Parse request body
    const body = await c.req.json();
    const { tournamentName, tournamentDate, teams, matches } = body;

    console.log('📥 Request inputs:', {
      tournamentName,
      tournamentDate,
      numTeams: teams?.length || 0,
      numMatches: matches?.length || 0
    });

    if (!tournamentName || !tournamentDate) {
      return c.json({ error: 'Tournament name and date are required' }, 400);
    }

    // Calculate date range (±2 days)
    const baseDate = new Date(tournamentDate);
    const startDate = new Date(baseDate);
    startDate.setDate(startDate.getDate() - 2);
    const endDate = new Date(baseDate);
    endDate.setDate(endDate.getDate() + 2);
    
    const startTimestamp = Math.floor(startDate.getTime() / 1000);
    const endTimestamp = Math.floor(endDate.getTime() / 1000);

    console.log(`📅 Search window: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    const results = {
      found: [] as any[],
      uncertain: [] as any[],
      missing: [] as any[]
    };

    // Process each match
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      console.log('');
      console.log(`🎮 ============================================`);
      console.log(`🎮 Processing Match ${i + 1}/${matches.length}`);
      console.log(`🎮 ============================================`);

      const team1 = teams.find((t: any) => t.id === match.team1Id);
      const team2 = teams.find((t: any) => t.id === match.team2Id);

      if (!team1 || !team2) {
        console.log(`⚠️  Skipping - teams not properly configured`);
        results.missing.push({
          matchIndex: i,
          searchCriteria: 'Teams not configured',
          dateRange: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
        });
        continue;
      }

      // STRATEGY 1: If match ID is provided, fetch it with cascading fallback
      if (match.matchId && match.matchId.trim()) {
        const fetchResult = await fetchMatchWithFallback(match.matchId);
        
        if (fetchResult.success && fetchResult.matchData) {
          // Normalize the match data
          const normalizedMatch = normalizeMatchData(
            fetchResult.matchData,
            fetchResult.source!,
            team1.name,
            team2.name
          );
          
          // Calculate confidence based on player matching
          const allPlayerIds = [...team1.playerIds, ...team2.playerIds]
            .filter((id: string) => id && id.trim())
            .map((id: string) => normalizePlayerId(id).steam32);
          
          const matchPlayerIds = normalizedMatch.players?.map((p: any) => 
            p.account_id?.toString() || ''
          ).filter((id: string) => id && id !== '4294967295') || [];
          
          const matchingPlayers = allPlayerIds.filter((id: string) => 
            matchPlayerIds.includes(id)
          );
          
          const confidence = allPlayerIds.length > 0 
            ? Math.round((matchingPlayers.length / allPlayerIds.length) * 100)
            : 100; // If no player IDs provided, assume match ID is correct
          
          console.log(`   ✅ Match retrieved! Confidence: ${confidence}%`);
          console.log(`   - Matching players: ${matchingPlayers.length}/${allPlayerIds.length}`);
          console.log(`   - Source: ${fetchResult.source}`);
          
          results.found.push({
            matchId: match.matchId,
            matchData: normalizedMatch,
            radiantName: normalizedMatch.radiant_name || team1.name || 'Radiant',
            direName: normalizedMatch.dire_name || team2.name || 'Dire',
            confidence,
            source: `Match ID fetch via ${fetchResult.source}`,
            matchIndex: i
          });
          
          continue;
        } else {
          console.log(`   ❌ Failed to fetch match: ${fetchResult.error || 'Unknown error'}`);
        }
      }

      // STRATEGY 2: Search using player histories + team IDs + date range
      console.log(`🔍 Searching via player histories...`);
      console.log(`   Team 1: ${team1.name} (${team1.playerIds.length} players)`);
      console.log(`   Team 2: ${team2.name} (${team2.playerIds.length} players)`);
      
      const allTeamPlayerIds = [...team1.playerIds, ...team2.playerIds]
        .filter((id: string) => id && id.trim())
        .map((id: string) => normalizePlayerId(id));

      const searchResult = await searchMatchViaPlayerHistory(
        allTeamPlayerIds,
        team1,
        team2,
        startTimestamp,
        endTimestamp,
        baseDate,
        startDate,
        endDate
      );

      if (searchResult.type === 'found') {
        results.found.push({
          ...searchResult.data,
          matchIndex: i
        });
      } else if (searchResult.type === 'uncertain') {
        results.uncertain.push({
          ...searchResult.data,
          matchIndex: i
        });
      } else {
        results.missing.push({
          ...searchResult.data,
          matchIndex: i
        });
      }
      
      // Small delay between matches
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log('');
    console.log('✅ ============================================');
    console.log('✅ SEARCH COMPLETE');
    console.log('✅ ============================================');
    console.log(`✅ Found: ${results.found.length}`);
    console.log(`⚠️  Uncertain: ${results.uncertain.length}`);
    console.log(`❌ Missing: ${results.missing.length}`);

    return c.json(results);

  } catch (error) {
    console.error('❌ Non-league builder error:', error);
    return c.json({
      error: String(error),
      found: [],
      uncertain: [],
      missing: []
    }, 500);
  }
});

// ============================================================================
// NON-LEAGUE TOURNAMENT BUILDER - Phase 1: Request Parse Jobs
// ============================================================================

/**
 * Phase 1: Request parsing for all matches
 * - Submits match IDs to OpenDota for parsing
 * - Stores job IDs in KV store
 * - Returns request ID immediately (< 10 seconds)
 */
app.post("/make-server-4789f4af/kkup/request-non-league-parse", async (c) => {
  console.log('🌽 ============================================');
  console.log('🌽 PHASE 1: Requesting Parse Jobs');
  console.log('🌽 ============================================');
  
  try {
    // Owner-only check
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      console.error('❌ AUTH ERROR: No access token provided');
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      console.error('❌ AUTH ERROR: Invalid token -', authError?.message);
      return c.json({ error: 'Unauthorized - Invalid token' }, 401);
    }

    // Get user role - owner only
    const { data: dbUser } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (!dbUser || dbUser.role !== 'owner') {
      console.error('❌ AUTHORIZATION ERROR: User is not owner');
      return c.json({ error: 'Owner access required' }, 403);
    }

    console.log(`✅ Authorization confirmed: User is owner`);

    // Parse request body
    const body = await c.req.json();
    const { tournamentName, tournamentDate, teams, matches } = body;

    console.log('📥 Request inputs:', {
      tournamentName,
      tournamentDate,
      numTeams: teams?.length || 0,
      numMatches: matches?.length || 0
    });

    if (!tournamentName || !tournamentDate) {
      return c.json({ error: 'Tournament name and date are required' }, 400);
    }

    // Generate unique request ID
    const requestId = `parse-request-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Calculate date range (±2 days)
    const baseDate = new Date(tournamentDate);
    const startDate = new Date(baseDate);
    startDate.setDate(startDate.getDate() - 2);
    const endDate = new Date(baseDate);
    endDate.setDate(endDate.getDate() + 2);
    
    const startTimestamp = Math.floor(startDate.getTime() / 1000);
    const endTimestamp = Math.floor(endDate.getTime() / 1000);

    console.log(`📅 Search window: ${startDate.toISOString()} to ${endDate.toISOString()}`);
    
    const parseJobs = [];

    // Process each match and request parse if needed
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const team1 = teams.find((t: any) => t.id === match.team1Id);
      const team2 = teams.find((t: any) => t.id === match.team2Id);

      if (!team1 || !team2) {
        console.log(`⚠️  Match ${i + 1}: Skipping - teams not configured`);
        parseJobs.push({
          matchIndex: i,
          status: 'missing',
          error: 'Teams not configured',
          team1Name: 'Unknown',
          team2Name: 'Unknown'
        });
        continue;
      }

      console.log(`🎮 Match ${i + 1}/${matches.length}: ${team1.name} vs ${team2.name}`);

      // If match ID provided, request parse from OpenDota
      if (match.matchId && match.matchId.trim()) {
        console.log(`   📡 Requesting parse for match ${match.matchId}...`);
        
        try {
          // Request parse from OpenDota
          const parseResponse = await fetch(`https://api.opendota.com/api/request/${match.matchId}`, {
            method: 'POST'
          });
          
          if (parseResponse.ok) {
            const parseData = await parseResponse.json();
            console.log(`   ✅ Parse requested. Job ID: ${parseData?.job?.jobId || 'N/A'}`);
            
            parseJobs.push({
              matchIndex: i,
              matchId: match.matchId,
              jobId: parseData?.job?.jobId,
              status: 'parsing',
              team1Name: team1.name,
              team2Name: team2.name,
              team1PlayerIds: team1.playerIds,
              team2PlayerIds: team2.playerIds,
              requestedAt: Date.now()
            });
          } else {
            console.log(`   ⚠️  Parse request failed: ${parseResponse.status}`);
            parseJobs.push({
              matchIndex: i,
              matchId: match.matchId,
              status: 'error',
              error: `Parse request failed: ${parseResponse.status}`,
              team1Name: team1.name,
              team2Name: team2.name
            });
          }
        } catch (error) {
          console.error(`   ❌ Error requesting parse:`, error);
          parseJobs.push({
            matchIndex: i,
            matchId: match.matchId,
            status: 'error',
            error: String(error),
            team1Name: team1.name,
            team2Name: team2.name
          });
        }
      } else {
        // No match ID - need to search via player history
        console.log(`   🔍 No match ID - will search via player history`);
        parseJobs.push({
          matchIndex: i,
          status: 'search-required',
          team1Name: team1.name,
          team2Name: team2.name,
          team1: team1,
          team2: team2,
          startTimestamp,
          endTimestamp,
          baseDate: baseDate.toISOString(),
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        });
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Store the parse request in KV
    await kv.set(`non-league-parse-${requestId}`, {
      requestId,
      tournamentName,
      tournamentDate,
      teams,
      matches,
      parseJobs,
      createdAt: Date.now(),
      status: 'pending'
    });

    console.log(`✅ Parse request stored: ${requestId}`);
    console.log(`✅ ${parseJobs.length} jobs created`);

    return c.json({
      requestId,
      totalMatches: matches.length,
      parseJobs: parseJobs.map(job => ({
        matchIndex: job.matchIndex,
        matchId: job.matchId,
        status: job.status,
        team1Name: job.team1Name,
        team2Name: job.team2Name
      })),
      message: 'Parse jobs submitted. Check status in 2-3 minutes.'
    });

  } catch (error) {
    console.error('❌ Phase 1 error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ============================================================================
// NON-LEAGUE TOURNAMENT BUILDER - Phase 2: Check Status
// ============================================================================

/**
 * Phase 2: Check status of parse jobs
 * - Checks if OpenDota has finished parsing
 * - Fetches match data for completed parses
 * - Returns results (< 5 seconds per check)
 */
app.get("/make-server-4789f4af/kkup/check-non-league-status/:requestId", async (c) => {
  console.log('🔍 ============================================');
  console.log('🔍 PHASE 2: Checking Parse Status');
  console.log('🔍 ============================================');
  
  try {
    // Owner-only check
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized - Invalid token' }, 401);
    }

    const { data: dbUser } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (!dbUser || dbUser.role !== 'owner') {
      return c.json({ error: 'Owner access required' }, 403);
    }

    const requestId = c.req.param('requestId');
    console.log(`🔍 Checking status for request: ${requestId}`);

    // Retrieve parse request from KV
    const parseRequest = await kv.get(`non-league-parse-${requestId}`);
    
    if (!parseRequest) {
      return c.json({ error: 'Parse request not found' }, 404);
    }

    console.log(`✅ Found parse request with ${parseRequest.parseJobs.length} jobs`);

    const results = {
      found: [] as any[],
      uncertain: [] as any[],
      missing: [] as any[],
      pending: [] as any[]
    };

    // Check status of each job
    for (const job of parseRequest.parseJobs) {
      console.log(`\n🎮 Checking Match ${job.matchIndex + 1}: ${job.team1Name} vs ${job.team2Name}`);

      if (job.status === 'missing' || job.status === 'error') {
        console.log(`   ⏭️  Skipping - already marked as ${job.status}`);
        results.missing.push({
          matchIndex: job.matchIndex,
          searchCriteria: `${job.team1Name} vs ${job.team2Name}`,
          error: job.error || 'No match ID provided'
        });
        continue;
      }

      if (job.status === 'search-required') {
        console.log(`   🔍 Searching via player history...`);
        
        // Perform player history search
        const allTeamPlayerIds = [...job.team1.playerIds, ...job.team2.playerIds]
          .filter((id: string) => id && id.trim())
          .map((id: string) => normalizePlayerId(id));

        const searchResult = await searchMatchViaPlayerHistory(
          allTeamPlayerIds,
          job.team1,
          job.team2,
          job.startTimestamp,
          job.endTimestamp,
          new Date(job.baseDate),
          new Date(job.startDate),
          new Date(job.endDate)
        );

        if (searchResult.type === 'found') {
          results.found.push({
            ...searchResult.data,
            matchIndex: job.matchIndex
          });
        } else if (searchResult.type === 'uncertain') {
          results.uncertain.push({
            ...searchResult.data,
            matchIndex: job.matchIndex
          });
        } else {
          results.missing.push({
            ...searchResult.data,
            matchIndex: job.matchIndex
          });
        }
        
        continue;
      }

      // Try to fetch the match from OpenDota
      if (job.matchId) {
        console.log(`   📡 Checking match ${job.matchId}...`);
        
        try {
          const matchResponse = await fetch(`https://api.opendota.com/api/matches/${job.matchId}`);
          
          if (matchResponse.ok) {
            const matchData = await matchResponse.json();
            
            if (matchData && !matchData.error && matchData.match_id) {
              console.log(`   ✅ Match data available!`);
              
              // Normalize and calculate confidence
              const normalizedMatch = normalizeMatchData(
                matchData,
                'OpenDota (parsed)',
                job.team1Name,
                job.team2Name
              );
              
              const allPlayerIds = [...job.team1PlayerIds, ...job.team2PlayerIds]
                .filter((id: string) => id && id.trim())
                .map((id: string) => normalizePlayerId(id).steam32);
              
              const matchPlayerIds = normalizedMatch.players?.map((p: any) => 
                p.account_id?.toString() || ''
              ).filter((id: string) => id && id !== '4294967295') || [];
              
              const matchingPlayers = allPlayerIds.filter((id: string) => 
                matchPlayerIds.includes(id)
              );
              
              const confidence = allPlayerIds.length > 0 
                ? Math.round((matchingPlayers.length / allPlayerIds.length) * 100)
                : 100;
              
              console.log(`   📊 Confidence: ${confidence}% (${matchingPlayers.length}/${allPlayerIds.length} players)`);
              
              results.found.push({
                matchId: job.matchId,
                matchData: normalizedMatch,
                radiantName: normalizedMatch.radiant_name || job.team1Name || 'Radiant',
                direName: normalizedMatch.dire_name || job.team2Name || 'Dire',
                confidence,
                source: 'Match ID fetch via OpenDota (parsed)',
                matchIndex: job.matchIndex
              });
            } else {
              console.log(`   ⏳ Still parsing...`);
              results.pending.push({
                matchIndex: job.matchIndex,
                matchId: job.matchId,
                team1Name: job.team1Name,
                team2Name: job.team2Name,
                status: 'parsing',
                requestedAt: job.requestedAt
              });
            }
          } else {
            console.log(`   ⚠️  Match not ready yet (${matchResponse.status})`);
            results.pending.push({
              matchIndex: job.matchIndex,
              matchId: job.matchId,
              team1Name: job.team1Name,
              team2Name: job.team2Name,
              status: 'parsing',
              requestedAt: job.requestedAt
            });
          }
        } catch (error) {
          console.error(`   ❌ Error fetching match:`, error);
          results.pending.push({
            matchIndex: job.matchIndex,
            matchId: job.matchId,
            team1Name: job.team1Name,
            team2Name: job.team2Name,
            status: 'error',
            error: String(error)
          });
        }
      }

      // Small delay between checks
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n✅ ============================================');
    console.log('✅ STATUS CHECK COMPLETE');
    console.log('✅ ============================================');
    console.log(`✅ Found: ${results.found.length}`);
    console.log(`⚠️  Uncertain: ${results.uncertain.length}`);
    console.log(`❌ Missing: ${results.missing.length}`);
    console.log(`⏳ Pending: ${results.pending.length}`);

    return c.json(results);

  } catch (error) {
    console.error('❌ Phase 2 error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * 🔧 NON-LEAGUE TOURNAMENT BUILDER: Import Tournament
 * POST /kkup/import-non-league
 * 
 * Creates a tournament from the search results
 */
app.post("/make-server-4789f4af/kkup/import-non-league", async (c) => {
  console.log('💾 ============================================');
  console.log('💾 NON-LEAGUE IMPORT: Starting');
  console.log('💾 ============================================');
  
  try {
    // Owner-only check
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized - Invalid token' }, 401);
    }

    const { data: dbUser } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (!dbUser || dbUser.role !== 'owner') {
      return c.json({ error: 'Owner access required' }, 403);
    }

    const body = await c.req.json();
    const { tournamentName, tournamentDate, searchResults } = body;

    if (!tournamentName || !searchResults) {
      return c.json({ error: 'Tournament name and search results are required' }, 400);
    }

    // Create tournament record (without league_id for non-league tournaments)
    const tournamentStartDate = new Date(tournamentDate).toISOString();
    const tournamentEndDate = new Date(tournamentDate).toISOString();

    console.log(`📝 Creating tournament: ${tournamentName}`);

    const { data: newTournament, error: tournamentError } = await supabase
      .from('kernel_kups')
      .insert({
        name: tournamentName,
        league_id: null,
        series_id: null,
        verified_match_id: null,
        tournament_start_date: tournamentStartDate,
        tournament_end_date: tournamentEndDate,
        prize_pool: 'TBD',
        status: 'completed',
        description: `${tournamentName} - In-house tournament`,
        twitch_channel: '',
        youtube_playlist_url: '',
        cover_photo_url: null,
        import_status: 'in_progress'
      })
      .select()
      .single();

    if (tournamentError || !newTournament) {
      throw new Error(`Failed to create tournament: ${tournamentError?.message}`);
    }

    const kkupId = newTournament.id;
    console.log(`✅ Tournament created with ID: ${kkupId}`);

    // Import only the "found" matches (high confidence)
    const matchesToImport = searchResults.found || [];
    
    console.log(`📥 Importing ${matchesToImport.length} matches...`);

    let teamsCreated = 0;
    let matchesCreated = 0;
    let playerStatsCreated = 0;
    let playersCreated = 0;

    const teamMap = new Map();
    const playerMap = new Map();

    for (const result of matchesToImport) {
      const matchData = result.matchData;
      
      console.log(`📦 Processing match ${matchData.match_id}...`);

      // Create/get teams
      const radiantTeamId = matchData.radiant_team_id || null;
      const direTeamId = matchData.dire_team_id || null;

      let radiantDbTeamId = null;
      let direDbTeamId = null;

      // Radiant team
      if (radiantTeamId && teamMap.has(radiantTeamId)) {
        radiantDbTeamId = teamMap.get(radiantTeamId);
      } else {
        const { data: team } = await supabase
          .from('kkup_teams')
          .insert({
            kkup_id: kkupId,
            team_id: radiantTeamId,
            name: result.radiantName || matchData.radiant_name || 'Radiant',
            tag: null,
            logo_url: null
          })
          .select()
          .single();

        if (team) {
          radiantDbTeamId = team.id;
          if (radiantTeamId) teamMap.set(radiantTeamId, team.id);
          teamsCreated++;
        }
      }

      // Dire team
      if (direTeamId && teamMap.has(direTeamId)) {
        direDbTeamId = teamMap.get(direTeamId);
      } else {
        const { data: team } = await supabase
          .from('kkup_teams')
          .insert({
            kkup_id: kkupId,
            team_id: direTeamId,
            name: result.direName || matchData.dire_name || 'Dire',
            tag: null,
            logo_url: null
          })
          .select()
          .single();

        if (team) {
          direDbTeamId = team.id;
          if (direTeamId) teamMap.set(direTeamId, team.id);
          teamsCreated++;
        }
      }

      // Create match
      const { data: match } = await supabase
        .from('kkup_matches')
        .insert({
          kkup_id: kkupId,
          match_id: matchData.match_id,
          series_id: null,
          series_type: 0,
          radiant_team_id: radiantDbTeamId,
          dire_team_id: direDbTeamId,
          radiant_score: matchData.radiant_score || 0,
          dire_score: matchData.dire_score || 0,
          radiant_win: matchData.radiant_win || false,
          duration: matchData.duration || 0,
          start_time: matchData.start_time ? new Date(matchData.start_time * 1000).toISOString() : new Date().toISOString(),
          game_mode: matchData.game_mode || 0,
          lobby_type: matchData.lobby_type || 0,
          replay_url: matchData.replay_url || null
        })
        .select()
        .single();

      if (!match) continue;

      matchesCreated++;

      // Create player stats
      if (matchData.players && Array.isArray(matchData.players)) {
        for (const player of matchData.players) {
          const accountId = player.account_id;
          
          if (!accountId) continue;

          let playerProfileId = null;
          
          if (playerMap.has(accountId)) {
            playerProfileId = playerMap.get(accountId);
          } else {
            const { data: existingPlayer } = await supabase
              .from('kkup_players')
              .select('*')
              .eq('account_id', accountId)
              .maybeSingle();

            if (existingPlayer) {
              playerProfileId = existingPlayer.id;
              playerMap.set(accountId, existingPlayer.id);
            } else {
              // Fetch player name from OpenDota if not provided by Steam
              let playerName = player.personaname || `Player ${accountId}`;
              let avatarUrl = player.avatarfull || null;
              
              if (!player.personaname) {
                try {
                  const odotaResponse = await fetch(`https://api.opendota.com/api/players/${accountId}`);
                  if (odotaResponse.ok) {
                    const odotaData = await odotaResponse.json();
                    if (odotaData && !odotaData.error) {
                      playerName = odotaData.profile?.personaname || odotaData.profile?.name || playerName;
                      avatarUrl = odotaData.profile?.avatarfull || odotaData.profile?.avatar || avatarUrl;
                    }
                  }
                  // Small delay to avoid rate limiting
                  await new Promise(resolve => setTimeout(resolve, 100));
                } catch (error) {
                  console.error(`   Failed to fetch player ${accountId} from OpenDota:`, error);
                }
              }
              
              const { data: newPlayer } = await supabase
                .from('kkup_players')
                .insert({
                  account_id: accountId,
                  name: playerName,
                  avatar_url: avatarUrl
                })
                .select()
                .single();

              if (newPlayer) {
                playerProfileId = newPlayer.id;
                playerMap.set(accountId, newPlayer.id);
                playersCreated++;
              }
            }
          }

          if (!playerProfileId) continue;

          const playerTeamId = player.isRadiant ? radiantDbTeamId : direDbTeamId;
          const isWinner = player.isRadiant ? matchData.radiant_win : !matchData.radiant_win;

          await supabase
            .from('kkup_match_player_stats')
            .insert({
              match_id: match.id,
              player_profile_id: playerProfileId,
              team_id: playerTeamId,
              player_name: player.name || player.personaname || 'Unknown',
              steam_id: player.account_id || null,
              hero_id: player.hero_id || 0,
              hero_name: player.hero_name || 'Unknown',
              kills: player.kills || 0,
              deaths: player.deaths || 0,
              assists: player.assists || 0,
              last_hits: player.last_hits || 0,
              denies: player.denies || 0,
              gpm: player.gold_per_min || 0,
              xpm: player.xp_per_min || 0,
              level: player.level || 0,
              hero_damage: player.hero_damage || 0,
              tower_damage: player.tower_damage || 0,
              hero_healing: player.hero_healing || 0,
              gold: player.gold || player.total_gold || 0,
              item_0: player.item_0 || null,
              item_1: player.item_1 || null,
              item_2: player.item_2 || null,
              item_3: player.item_3 || null,
              item_4: player.item_4 || null,
              item_5: player.item_5 || null,
              observer_uses: player.observer_uses || player.purchase_observer || 0,
              sentry_uses: player.sentry_uses || player.purchase_sentry || 0,
              is_winner: isWinner
            });

          playerStatsCreated++;
        }
      }
    }

    // Mark tournament as complete
    await supabase
      .from('kernel_kups')
      .update({
        import_status: 'completed',
        imported_at: new Date().toISOString()
      })
      .eq('id', kkupId);

    console.log('');
    console.log('✅ ============================================');
    console.log('✅ NON-LEAGUE IMPORT COMPLETE');
    console.log('✅ ============================================');
    console.log(`✅ Tournament ID: ${kkupId}`);
    console.log(`✅ Teams: ${teamsCreated}`);
    console.log(`✅ Matches: ${matchesCreated}`);
    console.log(`✅ Player Stats: ${playerStatsCreated}`);
    console.log(`✅ Players: ${playersCreated}`);

    return c.json({
      success: true,
      tournamentId: kkupId,
      stats: {
        teams_created: teamsCreated,
        matches_created: matchesCreated,
        player_stats_created: playerStatsCreated,
        players_created: playersCreated
      }
    });

  } catch (error) {
    console.error('❌ Non-league import error:', error);
    return c.json({
      success: false,
      error: String(error)
    }, 500);
  }
});

// ============================================================================
// MANUAL TOURNAMENT BUILDER
// ============================================================================

/**
 * 📝 Create Manual Tournament
 * POST /kkup/create-manual-tournament
 * 
 * Manually create a tournament with full stats
 */
app.post("/make-server-4789f4af/kkup/create-manual-tournament", async (c) => {
  console.log('📝 ============================================');
  console.log('📝 MANUAL TOURNAMENT BUILDER: Creating tournament');
  console.log('📝 ============================================');
  
  try {
    // Owner-only check
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      console.error('❌ AUTH ERROR: No access token provided');
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      console.error('❌ AUTH ERROR: Invalid token -', authError?.message);
      return c.json({ error: 'Unauthorized - Invalid token' }, 401);
    }

    // Get user role - owner only
    const { data: dbUser } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (!dbUser || dbUser.role !== 'owner') {
      console.error('❌ AUTHORIZATION ERROR: User is not owner');
      return c.json({ error: 'Owner access required' }, 403);
    }

    console.log(`✅ Authorization confirmed: User is owner`);

    // Parse request body
    const body = await c.req.json();
    const { tournamentName, tournamentDate, description, matches } = body;

    console.log('📥 Request inputs:', {
      tournamentName,
      tournamentDate,
      numMatches: matches?.length || 0
    });

    if (!tournamentName || !tournamentName.trim()) {
      return c.json({ error: 'Tournament name is required' }, 400);
    }

    if (!matches || matches.length === 0) {
      return c.json({ error: 'At least one match is required' }, 400);
    }

    // Create the tournament
    const { data: tournament, error: tournamentError } = await supabase
      .from('kernel_kups')
      .insert({
        name: tournamentName.trim(),
        league_id: null,
        series_id: null,
        tournament_start_date: tournamentDate || null,
        tournament_end_date: tournamentDate || null,
        description: description || null,
        is_manual: true,
      })
      .select()
      .single();

    if (tournamentError || !tournament) {
      console.error('❌ Failed to create tournament:', tournamentError);
      throw new Error('Failed to create tournament: ' + tournamentError?.message);
    }

    console.log(`✅ Tournament created: ${tournament.name} (ID: ${tournament.id})`);

    const kkupId = tournament.id;
    let matchesCreated = 0;
    let playerStatsCreated = 0;
    let playersCreated = 0;
    let teamsCreated = 0;

    // Keep track of player IDs we've already created
    const playerMap = new Map<string, string>(); // Steam ID -> player profile ID

    // Process each match
    for (const matchInput of matches) {
      console.log(`\n🎮 Processing Match ${matchInput.matchNumber}...`);

      // Create Radiant team if it has a name
      let radiantTeamId = null;
      if (matchInput.radiantTeamName && matchInput.radiantTeamName.trim()) {
        const { data: radiantTeam } = await supabase
          .from('kkup_teams')
          .insert({
            kkup_id: kkupId,
            name: matchInput.radiantTeamName.trim(),
            team_id: null
          })
          .select()
          .single();

        if (radiantTeam) {
          radiantTeamId = radiantTeam.id;
          teamsCreated++;
        }
      }

      // Create Dire team if it has a name
      let direTeamId = null;
      if (matchInput.direTeamName && matchInput.direTeamName.trim()) {
        const { data: direTeam } = await supabase
          .from('kkup_teams')
          .insert({
            kkup_id: kkupId,
            name: matchInput.direTeamName.trim(),
            team_id: null
          })
          .select()
          .single();

        if (direTeam) {
          direTeamId = direTeam.id;
          teamsCreated++;
        }
      }

      // Create the match
      const { data: match, error: matchError } = await supabase
        .from('kkup_matches')
        .insert({
          kkup_id: kkupId,
          match_id: null,
          radiant_name: matchInput.radiantTeamName || 'Radiant',
          dire_name: matchInput.direTeamName || 'Dire',
          radiant_score: matchInput.radiantScore || 0,
          dire_score: matchInput.direScore || 0,
          radiant_win: matchInput.winner === 'radiant',
          duration: matchInput.duration || 0,
          start_time: matchInput.matchDate ? Math.floor(new Date(matchInput.matchDate).getTime() / 1000) : null,
          radiant_team_id: radiantTeamId,
          dire_team_id: direTeamId,
          playoff_round: matchInput.playoffRound || null,
        })
        .select()
        .single();

      if (matchError || !match) {
        console.error('❌ Failed to create match:', matchError);
        continue;
      }

      matchesCreated++;
      console.log(`   ✅ Match created (ID: ${match.id})`);

      // Process all players (Radiant + Dire)
      const allPlayers = [
        ...(matchInput.radiantPlayers || []).map((p: any) => ({ ...p, isRadiant: true })),
        ...(matchInput.direPlayers || []).map((p: any) => ({ ...p, isRadiant: false })),
      ];

      for (const playerInput of allPlayers) {
        if (!playerInput.playerName || !playerInput.playerName.trim()) {
          continue; // Skip empty players
        }

        let playerProfileId = null;
        let xlcobMemberId = null;

        // If Steam ID is provided, try to find or create player
        if (playerInput.steamId && playerInput.steamId.trim()) {
          const steamId = playerInput.steamId.trim();
          const normalized = normalizePlayerId(steamId);
          const accountId = normalized.steam32;

          // Check if we've already created this player
          if (playerMap.has(accountId)) {
            playerProfileId = playerMap.get(accountId)!;
          } else {
            // Check if player exists
            const { data: existingPlayer } = await supabase
              .from('kkup_players')
              .select('id')
              .eq('account_id', accountId)
              .single();

            if (existingPlayer) {
              playerProfileId = existingPlayer.id;
              playerMap.set(accountId, existingPlayer.id);
            } else {
              // Create new player
              const { data: newPlayer } = await supabase
                .from('kkup_players')
                .insert({
                  account_id: accountId,
                  name: playerInput.playerName.trim(),
                  avatar_url: null
                })
                .select()
                .single();

              if (newPlayer) {
                playerProfileId = newPlayer.id;
                playerMap.set(accountId, newPlayer.id);
                playersCreated++;
              }
            }

            // Try to link to XLCOB member by Steam ID
            const { data: xlcobMember } = await supabase
              .from('users')
              .select('id')
              .eq('opendota_id', accountId)
              .single();

            if (xlcobMember) {
              xlcobMemberId = xlcobMember.id;
              console.log(`   🔗 Linked player to XLCOB member: ${playerInput.playerName}`);
            }
          }
        }

        // If no player profile ID (no Steam ID or failed to create), create anonymous player
        if (!playerProfileId) {
          const anonymousKey = `anonymous-${playerInput.playerName.trim()}-${Date.now()}`;
          
          if (!playerMap.has(anonymousKey)) {
            const { data: anonPlayer } = await supabase
              .from('kkup_players')
              .insert({
                account_id: null,
                name: playerInput.playerName.trim(),
                avatar_url: null
              })
              .select()
              .single();

            if (anonPlayer) {
              playerProfileId = anonPlayer.id;
              playerMap.set(anonymousKey, anonPlayer.id);
              playersCreated++;
            }
          } else {
            playerProfileId = playerMap.get(anonymousKey)!;
          }
        }

        if (!playerProfileId) continue;

        const teamId = playerInput.isRadiant ? radiantTeamId : direTeamId;
        const isWinner = playerInput.isRadiant ? (matchInput.winner === 'radiant') : (matchInput.winner === 'dire');

        // Create match player stats
        await supabase
          .from('kkup_match_player_stats')
          .insert({
            match_id: match.id,
            player_profile_id: playerProfileId,
            team_id: teamId,
            player_name: playerInput.playerName || 'Unknown',
            steam_id: playerInput.steamId || null,
            hero_id: null, // We don't have hero IDs for manual entry
            hero_name: playerInput.heroName || 'Unknown',
            kills: playerInput.kills || 0,
            deaths: playerInput.deaths || 0,
            assists: playerInput.assists || 0,
            last_hits: playerInput.lastHits || 0,
            denies: playerInput.denies || 0,
            gpm: playerInput.gpm || 0,
            xpm: playerInput.xpm || 0,
            level: playerInput.level || 1,
            net_worth: playerInput.networth || 0,
            hero_damage: playerInput.heroDamage || 0,
            tower_damage: playerInput.towerDamage || 0,
            hero_healing: playerInput.heroHealing || 0,
            item_0: null, // We could map these to item IDs later
            item_1: null,
            item_2: null,
            item_3: null,
            item_4: null,
            item_5: null,
            is_winner: isWinner,
          });

        playerStatsCreated++;
      }

      console.log(`   ✅ ${allPlayers.length} player stats created`);
    }

    console.log('');
    console.log('✅ ============================================');
    console.log('✅ MANUAL TOURNAMENT CREATED SUCCESSFULLY');
    console.log('✅ ============================================');
    console.log(`✅ Tournament: ${tournament.name}`);
    console.log(`✅ Teams created: ${teamsCreated}`);
    console.log(`✅ Matches created: ${matchesCreated}`);
    console.log(`✅ Player stats created: ${playerStatsCreated}`);
    console.log(`✅ New players created: ${playersCreated}`);

    return c.json({
      success: true,
      tournamentId: kkupId,
      stats: {
        teams_created: teamsCreated,
        matches_created: matchesCreated,
        player_stats_created: playerStatsCreated,
        players_created: playersCreated
      }
    });

  } catch (error) {
    console.error('❌ Manual tournament creation error:', error);
    return c.json({
      success: false,
      error: String(error)
    }, 500);
  }
});

/**
 * 📝 Create Manual Tournament V2 (With Teams & Rosters)
 * POST /kkup/create-manual-tournament-v2
 * 
 * Manually create a tournament with teams, rosters, and full match stats
 */
app.post("/make-server-4789f4af/kkup/create-manual-tournament-v2", async (c) => {
  console.log('📝 ============================================');
  console.log('📝 MANUAL TOURNAMENT BUILDER V2: Creating tournament');
  console.log('📝 ============================================');
  
  try {
    // Owner-only check
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      console.error('❌ AUTH ERROR: No access token provided');
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      console.error('❌ AUTH ERROR: Invalid token -', authError?.message);
      return c.json({ error: 'Unauthorized - Invalid token' }, 401);
    }

    // Get user role - owner only
    const { data: dbUser } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (!dbUser || dbUser.role !== 'owner') {
      console.error('❌ AUTHORIZATION ERROR: User is not owner');
      return c.json({ error: 'Owner access required' }, 403);
    }

    console.log(`✅ Authorization confirmed: User is owner`);

    // Parse request body
    const body = await c.req.json();
    const { 
      tournamentName, 
      tournamentStartDate, 
      tournamentEndDate, 
      description,
      youtubeUrl,
      prizePool,
      teams: teamsInput, 
      matches: matchesInput 
    } = body;

    console.log('📥 Request inputs:', {
      tournamentName,
      numTeams: teamsInput?.length || 0,
      numMatches: matchesInput?.length || 0
    });

    if (!tournamentName || !tournamentName.trim()) {
      return c.json({ error: 'Tournament name is required' }, 400);
    }

    if (!teamsInput || teamsInput.length === 0) {
      return c.json({ error: 'At least one team is required' }, 400);
    }

    if (!matchesInput || matchesInput.length === 0) {
      return c.json({ error: 'At least one match is required' }, 400);
    }

    // Create the tournament
    const { data: tournament, error: tournamentError } = await supabase
      .from('kernel_kups')
      .insert({
        name: tournamentName.trim(),
        league_id: null,
        series_id: null,
        tournament_start_date: tournamentStartDate || null,
        tournament_end_date: tournamentEndDate || null,
        description: description || null,
        youtube_playlist_url: youtubeUrl || null,
        prize_pool: prizePool || null,
        is_manual: true,
      })
      .select()
      .single();

    if (tournamentError || !tournament) {
      console.error('❌ Failed to create tournament:', tournamentError);
      throw new Error('Failed to create tournament: ' + tournamentError?.message);
    }

    console.log(`✅ Tournament created: ${tournament.name} (ID: ${tournament.id})`);

    const kkupId = tournament.id;
    let matchesCreated = 0;
    let playerStatsCreated = 0;
    let playersCreated = 0;
    let teamsCreated = 0;

    // Keep track of player IDs we've created
    const playerMap = new Map<string, string>(); // Steam ID or name -> kkup_players.id
    const teamMap = new Map<string, string>(); // Team name -> kkup_teams.id

    // Step 1: Create all teams
    console.log('\n🏆 Creating teams...');
    for (const teamInput of teamsInput) {
      const { data: team } = await supabase
        .from('kkup_teams')
        .insert({
          kkup_id: kkupId,
          name: teamInput.name.trim(),
          team_id: teamInput.teamId || null,
          tag: teamInput.tag || null,
          logo_url: teamInput.logo || null,
        })
        .select()
        .single();

      if (team) {
        teamMap.set(teamInput.name.trim(), team.id);
        teamsCreated++;
        console.log(`   ✅ Created team: ${teamInput.name}`);
      }
    }

    // Step 2: Create all players from rosters
    console.log('\n👥 Creating players...');
    for (const teamInput of teamsInput) {
      for (const playerInput of teamInput.roster) {
        if (!playerInput.name || !playerInput.name.trim()) continue;

        const playerName = playerInput.name.trim();
        let playerProfileId = null;
        let accountId = null;

        // If Steam ID provided, normalize it
        if (playerInput.steamId && playerInput.steamId.trim()) {
          const steamId = playerInput.steamId.trim();
          const normalized = normalizePlayerId(steamId);
          accountId = normalized.steam32;

          // Check if we already created this player
          if (playerMap.has(accountId)) {
            continue;
          }

          // Check if player exists in database
          const { data: existingPlayer } = await supabase
            .from('kkup_players')
            .select('id')
            .eq('account_id', accountId)
            .single();

          if (existingPlayer) {
            playerMap.set(accountId, existingPlayer.id);
            continue;
          }

          // Create new player with Steam ID
          const { data: newPlayer } = await supabase
            .from('kkup_players')
            .insert({
              account_id: accountId,
              name: playerName,
              avatar_url: null
            })
            .select()
            .single();

          if (newPlayer) {
            playerMap.set(accountId, newPlayer.id);
            playersCreated++;
            console.log(`   ✅ Created player: ${playerName} (Steam: ${accountId})`);
          }
        } else {
          // No Steam ID - check if we already created this anonymous player
          if (playerMap.has(playerName)) {
            continue;
          }

          // Create anonymous player
          const { data: anonPlayer } = await supabase
            .from('kkup_players')
            .insert({
              account_id: null,
              name: playerName,
              avatar_url: null
            })
            .select()
            .single();

          if (anonPlayer) {
            playerMap.set(playerName, anonPlayer.id);
            playersCreated++;
            console.log(`   ✅ Created anonymous player: ${playerName}`);
          }
        }
      }
    }

    // Step 3: Create matches and player stats
    console.log('\n🎮 Creating matches...');
    for (const matchInput of matchesInput) {
      const radiantTeamId = teamMap.get(matchInput.team1Name);
      const direTeamId = teamMap.get(matchInput.team2Name);

      if (!radiantTeamId || !direTeamId) {
        console.error(`   ❌ Team not found for match ${matchInput.matchNumber}`);
        continue;
      }

      // Create the match
      const { data: match, error: matchError } = await supabase
        .from('kkup_matches')
        .insert({
          kkup_id: kkupId,
          match_id: matchInput.matchId ? parseInt(matchInput.matchId) : null,
          radiant_name: matchInput.team1Name,
          dire_name: matchInput.team2Name,
          radiant_score: 0,
          dire_score: 0,
          radiant_win: matchInput.winner === 'radiant',
          duration: matchInput.duration || 0,
          start_time: matchInput.matchDate ? Math.floor(new Date(matchInput.matchDate).getTime() / 1000) : null,
          radiant_team_id: radiantTeamId,
          dire_team_id: direTeamId,
          playoff_round: matchInput.playoffRound || null,
        })
        .select()
        .single();

      if (matchError || !match) {
        console.error('❌ Failed to create match:', matchError);
        continue;
      }

      matchesCreated++;
      console.log(`   ✅ Match ${matchInput.matchNumber} created (ID: ${match.id})`);

      // Process players for this match
      const allPlayers = [
        ...matchInput.team1Players.map((p: any) => ({ ...p, isRadiant: true, teamId: radiantTeamId })),
        ...matchInput.team2Players.map((p: any) => ({ ...p, isRadiant: false, teamId: direTeamId })),
      ];

      for (const playerInput of allPlayers) {
        if (!playerInput.name || !playerInput.name.trim()) continue;

        const playerName = playerInput.name.trim();
        let playerProfileId = null;
        let xlcobMemberId = null;
        let accountId = null;

        // Find the player in our map
        if (playerInput.steamId && playerInput.steamId.trim()) {
          const normalized = normalizePlayerId(playerInput.steamId.trim());
          accountId = normalized.steam32;
          playerProfileId = playerMap.get(accountId);

          // Try to link to XLCOB member
          const { data: xlcobMember } = await supabase
            .from('users')
            .select('id')
            .eq('opendota_id', accountId)
            .single();

          if (xlcobMember) {
            xlcobMemberId = xlcobMember.id;
          }
        } else {
          playerProfileId = playerMap.get(playerName);
        }

        if (!playerProfileId) {
          console.error(`   ⚠️ Player not found: ${playerName}`);
          continue;
        }

        const isWinner = playerInput.isRadiant ? (matchInput.winner === 'radiant') : (matchInput.winner === 'dire');

        // Create player stats
        await supabase
          .from('kkup_match_player_stats')
          .insert({
            match_id: match.id,
            player_profile_id: playerProfileId,
            team_id: playerInput.teamId,
            player_name: playerInput.playerName || 'Unknown',
            steam_id: playerInput.steamId || null,
            hero_id: playerInput.heroId || null,
            hero_name: playerInput.heroName || 'Unknown',
            kills: playerInput.kills || 0,
            deaths: playerInput.deaths || 0,
            assists: playerInput.assists || 0,
            last_hits: playerInput.lastHits || 0,
            denies: playerInput.denies || 0,
            gpm: playerInput.gpm || 0,
            xpm: playerInput.xpm || 0,
            level: playerInput.level || 1,
            net_worth: playerInput.netWorth || 0,
            hero_damage: playerInput.heroDamage || 0,
            tower_damage: playerInput.towerDamage || 0,
            hero_healing: playerInput.heroHealing || 0,
            gold: playerInput.gold || 0,
            item_0: playerInput.item0 || null,
            item_1: playerInput.item1 || null,
            item_2: playerInput.item2 || null,
            item_3: playerInput.item3 || null,
            item_4: playerInput.item4 || null,
            item_5: playerInput.item5 || null,
            observer_uses: playerInput.observerUses || 0,
            sentry_uses: playerInput.sentryUses || 0,
            is_winner: isWinner,
          });

        playerStatsCreated++;
      }
    }

    console.log('');
    console.log('✅ ============================================');
    console.log('✅ MANUAL TOURNAMENT V2 CREATED SUCCESSFULLY');
    console.log('✅ ============================================');
    console.log(`✅ Tournament: ${tournament.name}`);
    console.log(`✅ Teams created: ${teamsCreated}`);
    console.log(`✅ Matches created: ${matchesCreated}`);
    console.log(`✅ Player stats created: ${playerStatsCreated}`);
    console.log(`✅ New players created: ${playersCreated}`);

    return c.json({
      success: true,
      tournamentId: kkupId,
      stats: {
        teams_created: teamsCreated,
        matches_created: matchesCreated,
        player_stats_created: playerStatsCreated,
        players_created: playersCreated
      }
    });

  } catch (error) {
    console.error('❌ Manual tournament V2 creation error:', error);
    return c.json({
      success: false,
      error: String(error)
    }, 500);
  }
});

/**
 * 🌽 SEED KERNEL KUP 1 DATA
 * POST /kkup/seed-kernel-kup-1
 * 
 * One-time seeding of Kernel Kup 1 historical data
 */
app.post("/make-server-4789f4af/kkup/seed-kernel-kup-1", async (c) => {
  try {
    // Owner-only check
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized - Invalid token' }, 401);
    }

    const { data: dbUser } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (!dbUser || dbUser.role !== 'owner') {
      return c.json({ error: 'Owner access required' }, 403);
    }

    const result = await seedKernelKup1(supabase, anonSupabase, authUser);
    return c.json(result);

  } catch (error) {
    console.error('❌ Kernel Kup 1 seeding error:', error);
    return c.json({
      success: false,
      error: String(error)
    }, 500);
  }
});

/**
 * 🌽 SEED KERNEL KUP 2 DATA
 * POST /kkup/seed-kernel-kup-2
 * 
 * One-time seeding of Kernel Kup 2 historical data
 */
app.post("/make-server-4789f4af/kkup/seed-kernel-kup-2", async (c) => {
  try {
    // Owner-only check
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized - Invalid token' }, 401);
    }

    const { data: dbUser } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (!dbUser || dbUser.role !== 'owner') {
      return c.json({ error: 'Owner access required' }, 403);
    }

    const result = await seedKernelKup2(supabase, anonSupabase, authUser);
    return c.json(result);

  } catch (error) {
    console.error('❌ Kernel Kup 2 seeding error:', error);
    return c.json({
      success: false,
      error: String(error)
    }, 500);
  }
});

/**
 * 🌽 SEED KERNEL KUP (UNIVERSAL ROUTER)
 * POST /kkup/seed-kernel-kup
 * 
 * Routes to the appropriate seeder based on kup_id parameter
 */
app.post("/make-server-4789f4af/kkup/seed-kernel-kup", async (c) => {
  try {
    // Owner-only check
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized - Invalid token' }, 401);
    }

    const { data: dbUser } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (!dbUser || dbUser.role !== 'owner') {
      return c.json({ error: 'Owner access required' }, 403);
    }

    // Get kup_id from request body
    const body = await c.req.json();
    const kupId = body.kup_id;

    if (!kupId) {
      return c.json({ error: 'kup_id is required' }, 400);
    }

    // Route to appropriate seeder
    let result;
    switch (kupId) {
      case 1:
        result = await seedKernelKup1(supabase, anonSupabase, authUser);
        break;
      case 2:
        result = await seedKernelKup2(supabase, anonSupabase, authUser);
        break;
      case 3:
        result = await seedKernelKup3(supabase, anonSupabase, authUser);
        break;
      case 8:
        result = await seedKernelKup8(supabase, anonSupabase, authUser);
        break;
      case 9:
        result = await seedKKup9(supabase, anonSupabase, authUser);
        break;
      default:
        return c.json({ error: `Invalid kup_id: ${kupId}. Must be 1, 2, 3, 8, or 9.` }, 400);
    }

    return c.json(result);

  } catch (error) {
    console.error('❌ Kernel Kup seeding error:', error);
    return c.json({
      success: false,
      error: String(error)
    }, 500);
  }
});

/**
 * 🔧 BACKFILL TEAM ROSTERS FROM MATCH STATS
 * POST /kkup/:kkup_id/backfill-rosters
 * 
 * Creates kkup_team_players entries by extracting player-team relationships from kkup_match_player_stats
 * Useful for historical tournaments where rosters weren't explicitly set
 */
app.post("/make-server-4789f4af/kkup/:kkup_id/backfill-rosters", async (c) => {
  console.log('🔧 ============================================');
  console.log('🔧 BACKFILLING TEAM ROSTERS FROM MATCH STATS');
  console.log('🔧 ============================================');

  try {
    // Owner-only check
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized - Invalid token' }, 401);
    }

    const { data: dbUser } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (!dbUser || dbUser.role !== 'owner') {
      return c.json({ error: 'Owner access required' }, 403);
    }

    const kkupId = c.req.param('kkup_id');

    // Get all matches for this tournament
    const { data: tournamentMatches } = await supabase
      .from('kkup_matches')
      .select('id')
      .eq('kernel_kup_id', kkupId);
    
    if (!tournamentMatches || tournamentMatches.length === 0) {
      return c.json({ 
        success: false,
        error: 'No matches found for this tournament' 
      });
    }

    const matchIds = tournamentMatches.map((m: any) => m.id);
    
    // Fetch all player stats for these matches
    const { data: allPlayerStats } = await supabase
      .from('kkup_match_player_stats')
      .select('player_profile_id, team_id')
      .in('match_id', matchIds);
    
    if (!allPlayerStats || allPlayerStats.length === 0) {
      return c.json({ 
        success: false,
        error: 'No player stats found for matches in this tournament' 
      });
    }

    // Create unique player-team combinations
    const uniqueCombos = new Map<string, { player_profile_id: string, team_id: string }>();
    
    allPlayerStats.forEach((stat: any) => {
      const key = `${stat.player_profile_id}_${stat.team_id}`;
      if (!uniqueCombos.has(key)) {
        uniqueCombos.set(key, {
          player_profile_id: stat.player_profile_id,
          team_id: stat.team_id
        });
      }
    });

    console.log(`📊 Found ${uniqueCombos.size} unique player-team combinations`);

    // Insert into kkup_team_players
    let rostersCreated = 0;
    let rostersSkipped = 0;

    for (const combo of uniqueCombos.values()) {
      // Check if already exists
      const { data: existing } = await supabase
        .from('kkup_team_players')
        .select('id')
        .eq('player_profile_id', combo.player_profile_id)
        .eq('team_id', combo.team_id)
        .maybeSingle();

      if (!existing) {
        const { error: insertError } = await supabase
          .from('kkup_team_players')
          .insert({
            player_profile_id: combo.player_profile_id,
            team_id: combo.team_id
          });

        if (!insertError) {
          rostersCreated++;
        } else {
          console.error(`⚠️  Failed to insert roster entry:`, insertError);
        }
      } else {
        rostersSkipped++;
      }
    }

    console.log(`✅ Created ${rostersCreated} new roster entries`);
    console.log(`⏭️  Skipped ${rostersSkipped} existing roster entries`);
    console.log('✅ ============================================');
    console.log('✅ ROSTER BACKFILL COMPLETE');
    console.log('✅ ============================================');

    return c.json({
      success: true,
      rostersCreated,
      rostersSkipped,
      totalUniqueCombos: uniqueCombos.size,
      message: `Successfully backfilled rosters: ${rostersCreated} created, ${rostersSkipped} already existed`
    });

  } catch (error) {
    console.error('❌ Roster backfill error:', error);
    return c.json({
      success: false,
      error: String(error)
    }, 500);
  }
});

/**
 * 🔄 SYNC PLAYER NAMES & TEAM LOGOS FROM STEAM/STORAGE
 * POST /kkup/sync-names-logos
 * 
 * Updates all player names/avatars from Steam API
 * Updates all team logos from kkupassets bucket
 */
app.post("/make-server-4789f4af/kkup/sync-names-logos", async (c) => {
  try {
    // Owner-only check
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized - Invalid token' }, 401);
    }

    const { data: dbUser } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (!dbUser || dbUser.role !== 'owner') {
      return c.json({ error: 'Owner access required' }, 403);
    }

    console.log('🔄 Starting sync of player names & team logos...');

    let playersUpdated = 0;
    let teamsUpdated = 0;

    // 1. Sync Player Names & Avatars from Steam
    const { data: players } = await supabase
      .from('kkup_player_profiles')
      .select('id, steam_id, name')
      .not('steam_id', 'is', null);

    if (players && players.length > 0) {
      console.log(`📊 Found ${players.length} players with steam_id`);
      
      for (const player of players) {
        try {
          // Fetch from Steam API via OpenDota
          const response = await fetch(`https://api.opendota.com/api/players/${player.steam_id}`);
          if (response.ok) {
            const steamData = await response.json();
            
            const updates: any = {};
            if (steamData.profile?.personaname) {
              updates.name = steamData.profile.personaname;
            }
            if (steamData.profile?.avatarfull) {
              updates.avatar_url = steamData.profile.avatarfull;
            }

            if (Object.keys(updates).length > 0) {
              await supabase
                .from('kkup_player_profiles')
                .update(updates)
                .eq('id', player.id);
              
              playersUpdated++;
              console.log(`   ✅ Updated ${player.name} → ${updates.name || player.name}`);
            }
          }
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`   ⚠️ Failed to update player ${player.steam_id}:`, error);
        }
      }
    }

    // 2. Sync Team Logos from kkupassets bucket
    const { data: teams } = await supabase
      .from('kkup_teams')
      .select('id, name, kernel_kup_id');

    if (teams && teams.length > 0) {
      console.log(`🏆 Found ${teams.length} teams`);

      // Get tournament names to map to folders
      const { data: tournaments } = await supabase
        .from('kernel_kups')
        .select('id, name');

      const tournamentMap = new Map(tournaments?.map(t => [t.id, t.name]) || []);

      for (const team of teams) {
        try {
          const tournamentName = tournamentMap.get(team.kernel_kup_id);
          if (!tournamentName) continue;

          // Determine folder name (e.g., "kkup1", "kkup2")
          const folderMatch = tournamentName.match(/Kernel\s*Kup\s*(\d+)/i);
          if (!folderMatch) continue;

          const folderName = `kkup${folderMatch[1]}`;
          
          // Try to find team logo in storage
          const sanitizedTeamName = team.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
          const possiblePaths = [
            `${folderName}/${sanitizedTeamName}.png`,
            `${folderName}/${sanitizedTeamName}.jpg`,
            `${folderName}/${team.name}.png`,
            `${folderName}/${team.name}.jpg`,
          ];

          for (const path of possiblePaths) {
            const { data: fileData, error: fileError } = await supabase.storage
              .from('kkupassets')
              .list(folderName, {
                search: sanitizedTeamName
              });

            if (fileData && fileData.length > 0) {
              const { data: urlData } = supabase.storage
                .from('kkupassets')
                .getPublicUrl(`${folderName}/${fileData[0].name}`);

              if (urlData?.publicUrl) {
                await supabase
                  .from('kkup_teams')
                  .update({ logo_url: urlData.publicUrl })
                  .eq('id', team.id);
                
                teamsUpdated++;
                console.log(`   ✅ Updated logo for ${team.name}`);
                break;
              }
            }
          }
        } catch (error) {
          console.error(`   ⚠️ Failed to update team logo for ${team.name}:`, error);
        }
      }
    }

    console.log(`✅ Sync complete: ${playersUpdated} players, ${teamsUpdated} teams`);

    return c.json({
      success: true,
      playersUpdated,
      teamsUpdated
    });

  } catch (error) {
    console.error('❌ Sync error:', error);
    return c.json({
      success: false,
      error: String(error)
    }, 500);
  }
});

/**
 * 🔍 Fetch Team Data by Valve Team ID
 * GET /dota/team/:teamId
 */
app.get("/make-server-4789f4af/dota/team/:teamId", async (c) => {
  try {
    const teamId = c.req.param('teamId');
    const steamKey = Deno.env.get('STEAM_WEB_API_KEY');
    
    // Try Steam API first
    if (steamKey) {
      try {
        const url = `https://api.steampowered.com/IDOTA2Match_570/GetTeamInfoByTeamID/v1/?key=${steamKey}&start_at_team_id=${teamId}&teams_requested=1`;
        const response = await fetch(url);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.result?.teams && data.result.teams.length > 0) {
            const teamData = data.result.teams[0];
            
            return c.json({
              name: teamData.name || 'Unknown Team',
              tag: teamData.tag || null,
              logo_url: teamData.logo || teamData.url_logo || null,
              team_id: teamData.team_id || parseInt(teamId),
              source: 'steam'
            });
          }
        }
        
        console.log('⚠️ Steam API failed, falling back to OpenDota');
      } catch (steamError) {
        console.log('⚠️ Steam API error, falling back to OpenDota:', steamError);
      }
    }
    
    // Fallback to OpenDota
    console.log('📡 Fetching team from OpenDota...');
    const odResponse = await fetch(`https://api.opendota.com/api/teams/${teamId}`);
    
    if (!odResponse.ok) {
      return c.json({ error: 'Team not found in Steam or OpenDota' }, 404);
    }

    const text = await odResponse.text();
    if (!text) {
      return c.json({ error: 'Empty response from OpenDota' }, 404);
    }

    const teamData = JSON.parse(text);
    
    return c.json({
      name: teamData.name || 'Unknown Team',
      tag: teamData.tag || null,
      logo_url: teamData.logo_url || null,
      team_id: parseInt(teamId),
      source: 'opendota'
    });
  } catch (error) {
    console.error('❌ Failed to fetch team:', error);
    return c.json({ error: `Failed to fetch team data: ${error.message}` }, 500);
  }
});

/**
 * 🔍 Fetch Player Data by Steam ID
 * GET /dota/player/:steamId
 */
app.get("/make-server-4789f4af/dota/player/:steamId", async (c) => {
  try {
    const steamId = c.req.param('steamId');
    const steamKey = Deno.env.get('STEAM_WEB_API_KEY');
    
    // Normalize Steam ID
    const normalized = normalizePlayerId(steamId);
    const steam64 = normalized.steam64;
    const accountId = normalized.steam32;
    
    // Try Steam API first
    if (steamKey) {
      try {
        const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${steamKey}&steamids=${steam64}`;
        const response = await fetch(url);
        
        if (response.ok) {
          const data = await response.json();
          
          if (data.response?.players && data.response.players.length > 0) {
            const playerData = data.response.players[0];
            
            return c.json({
              accountId: accountId,
              name: playerData.personaname || 'Unknown Player',
              avatar: playerData.avatarfull || playerData.avatarmedium || playerData.avatar || null,
              source: 'steam'
            });
          }
        }
        
        console.log('⚠️ Steam API failed, falling back to OpenDota');
      } catch (steamError) {
        console.log('⚠️ Steam API error, falling back to OpenDota:', steamError);
      }
    }
    
    // Fallback to OpenDota
    console.log('📡 Fetching player from OpenDota...');
    const odResponse = await fetch(`https://api.opendota.com/api/players/${accountId}`);
    
    if (!odResponse.ok) {
      return c.json({ error: 'Player not found in Steam or OpenDota' }, 404);
    }

    const text = await odResponse.text();
    if (!text) {
      return c.json({ error: 'Empty response from OpenDota' }, 404);
    }

    const playerData = JSON.parse(text);
    
    return c.json({
      accountId: accountId,
      name: playerData.profile?.personaname || 'Unknown Player',
      avatar: playerData.profile?.avatarfull || playerData.profile?.avatar || null,
      source: 'opendota'
    });
  } catch (error) {
    console.error('❌ Failed to fetch player:', error);
    return c.json({ error: `Failed to fetch player data: ${error.message}` }, 500);
  }
});

/**
 * 🌽 ADMIN: Import Tournament with 5-ID Verification
 * POST /admin/import-tournament
 * 
 * Body: {
 *   name: string,
 *   league_id: number,
 *   series_id: number,
 *   match_id: number,
 *   team_id: number,
 *   player_id: number,
 *   tournament_start_date: string (ISO),
 *   tournament_end_date: string (ISO)
 * }
 */
app.post("/make-server-4789f4af/admin/import-tournament", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    // Verify user is admin/owner
    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized - Invalid token' }, 401);
    }

    // Get user role from members table
    const { data: member } = await supabase
      .from('members')
      .select('role')
      .eq('supabase_user_id', authUser.id)
      .single();

    console.log('🔍 Auth Check:', {
      supabase_user_id: authUser.id,
      member_data: member,
      member_role: member?.role
    });

    // Allow admin, queen of hog, and owner roles
    const allowedRoles = ['admin', 'queen of hog', 'owner'];
    if (!member || !allowedRoles.includes(member.role)) {
      console.log('❌ Access denied. Member:', member, 'Allowed roles:', allowedRoles);
      return c.json({ error: 'Unauthorized - Admin access required' }, 403);
    }

    console.log('✅ Access granted for role:', member.role);

    // Parse request body
    const body = await c.req.json();
    const { 
      league_id, 
      series_id, 
      match_id, 
      team_id, 
      player_id
    } = body;

    console.log(`🌽 Starting tournament import...`);
    console.log(`📋 5-ID Verification: League=${league_id}, Series=${series_id}, Match=${match_id}, Team=${team_id}, Player=${player_id}`);

    // ============================================
    // STEP 1: Verify the 5 IDs
    // ============================================
    const STEAM_API_KEY = Deno.env.get('STEAM_WEB_API_KEY') ?? '';
    const STEAM_API_BASE = 'https://api.steampowered.com';
    const DOTA2_APP_ID = 570;

    const errors: string[] = [];

    // 1A. Verify League ID exists and get league name
    console.log('✅ Step 1A: Verifying League ID and fetching league name...');
    const leagueResponse = await fetch(
      `${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetLeagueListing/v1/?key=${STEAM_API_KEY}`
    );
    const leagueData = await leagueResponse.json();
    const leagueInfo = leagueData.result?.leagues?.find((l: any) => l.leagueid === league_id);
    
    if (!leagueInfo) {
      errors.push(`League ID ${league_id} not found in Steam API`);
    }

    // Extract tournament name from league data
    const tournamentName = leagueInfo?.name || `Tournament ${league_id}`;

    // 1B. Verify Match ID belongs to League ID
    console.log('✅ Step 1B: Verifying Match ID belongs to League...');
    const matchDetailResponse = await fetch(
      `${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetMatchDetails/v1/?key=${STEAM_API_KEY}&match_id=${match_id}`
    );
    const matchDetailData = await matchDetailResponse.json();
    
    if (!matchDetailData.result || matchDetailData.result.error) {
      errors.push(`Match ID ${match_id} not found in Steam API`);
    } else if (matchDetailData.result.leagueid !== league_id) {
      errors.push(`Match ID ${match_id} does not belong to League ID ${league_id}`);
    }

    // 1C. Verify Team ID exists in match
    console.log('✅ Step 1C: Verifying Team ID exists in match...');
    const radiantTeamId = matchDetailData.result?.radiant_team_id;
    const direTeamId = matchDetailData.result?.dire_team_id;
    
    if (radiantTeamId !== team_id && direTeamId !== team_id) {
      errors.push(`Team ID ${team_id} not found in Match ID ${match_id}`);
    }

    // 1D. Verify Player ID exists in match
    console.log('✅ Step 1D: Verifying Player ID exists in match...');
    const playerExists = matchDetailData.result?.players?.some((p: any) => p.account_id === player_id);
    
    if (!playerExists) {
      errors.push(`Player ID ${player_id} not found in Match ID ${match_id}`);
    }

    // 1E. Verify Series ID (best effort - may not be in all APIs)
    console.log('✅ Step 1E: Verifying Series ID...');
    if (matchDetailData.result?.series_id && matchDetailData.result.series_id !== series_id) {
      errors.push(`Series ID ${series_id} does not match match data (expected ${matchDetailData.result.series_id})`);
    }

    // If any verification failed, return errors
    if (errors.length > 0) {
      console.error('❌ Verification failed:', errors);
      return c.json({ 
        error: 'Verification failed', 
        details: errors,
        field_errors: {
          league_id: errors.find(e => e.includes('League ID')),
          match_id: errors.find(e => e.includes('Match ID')),
          team_id: errors.find(e => e.includes('Team ID')),
          player_id: errors.find(e => e.includes('Player ID')),
          series_id: errors.find(e => e.includes('Series ID'))
        }
      }, 400);
    }

    console.log('✅ All 5 IDs verified successfully!');

    // ============================================
    // STEP 2: Fetch ALL League Matches to Calculate Dates
    // ============================================
    console.log('🎮 Step 2: Fetching ALL matches from Steam API...');
    
    const matchHistoryResponse = await fetch(
      `${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetMatchHistory/v1/?key=${STEAM_API_KEY}&league_id=${league_id}&matches_requested=100`
    );
    const matchHistoryData = await matchHistoryResponse.json();
    const allMatches = matchHistoryData.result?.matches || [];

    console.log(`📊 Found ${allMatches.length} matches in league`);

    // Calculate tournament start/end dates from match timestamps
    let earliestMatchTime = Infinity;
    let latestMatchTime = 0;

    for (const match of allMatches) {
      if (match.start_time) {
        if (match.start_time < earliestMatchTime) earliestMatchTime = match.start_time;
        if (match.start_time > latestMatchTime) latestMatchTime = match.start_time;
      }
    }

    const tournamentStartDate = earliestMatchTime !== Infinity 
      ? new Date(earliestMatchTime * 1000).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    
    const tournamentEndDate = latestMatchTime > 0
      ? new Date(latestMatchTime * 1000).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    console.log(`📅 Calculated dates: ${tournamentStartDate} to ${tournamentEndDate}`);

    // ============================================
    // STEP 3: Create Tournament Record
    // ============================================
    console.log('📝 Step 3: Creating tournament record...');
    
    const { data: tournament, error: tournamentError } = await supabase
      .from('kernel_kups')
      .insert({
        name: tournamentName,
        league_id,
        series_id,
        verified_match_id: match_id,
        verified_team_id: team_id,
        verified_player_id: player_id,
        tournament_start_date: tournamentStartDate,
        tournament_end_date: tournamentEndDate,
        import_status: 'in_progress',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (tournamentError || !tournament) {
      console.error('❌ Error creating tournament:', tournamentError);
      return c.json({ error: 'Failed to create tournament', details: tournamentError }, 500);
    }

    console.log(`✅ Tournament "${tournamentName}" created with ID: ${tournament.id}`);
    const kkupId = tournament.id;

    // ============================================
    // STEP 4: Process Teams & Matches
    // ============================================
    console.log('🔨 Step 4: Processing teams and matches...');
    const teamMap = new Map(); // valve_team_id -> db team record
    let teamsCreated = 0;
    let matchesCreated = 0;

    for (const match of allMatches) {
      try {
        // Fetch full match details
        const matchDetailResp = await fetch(
          `${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetMatchDetails/v1/?key=${STEAM_API_KEY}&match_id=${match.match_id}`
        );
        const matchDetail = await matchDetailResp.json();
        const result = matchDetail.result;

        if (!result || result.error) {
          console.warn(`⚠️ Skipping match ${match.match_id} - no details`);
          continue;
        }

        // Process Radiant Team
        let radiantDbTeam = null;
        if (result.radiant_team_id) {
          if (teamMap.has(result.radiant_team_id)) {
            radiantDbTeam = teamMap.get(result.radiant_team_id);
          } else {
            // Fetch team info from Steam
            const teamInfoResp = await fetch(
              `${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetTeamInfoByTeamID/v1/?key=${STEAM_API_KEY}&start_at_team_id=${result.radiant_team_id}&teams_requested=1`
            );
            const teamInfo = await teamInfoResp.json();
            const teamData = teamInfo.result?.teams?.[0];

            const { data: newTeam } = await supabase
              .from('kkup_teams')
              .insert({
                kernel_kup_id: kkupId,
                name: teamData?.name || result.radiant_name || 'Radiant Team',
                tag: teamData?.tag || result.radiant_name?.substring(0, 4).toUpperCase() || 'RAD',
                valve_team_id: result.radiant_team_id,
                logo_url: teamData?.logo_url || teamData?.logo,
                imported_at: new Date().toISOString()
              })
              .select()
              .single();

            if (newTeam) {
              teamMap.set(result.radiant_team_id, newTeam);
              radiantDbTeam = newTeam;
              teamsCreated++;
            }
          }
        }

        // Process Dire Team
        let direDbTeam = null;
        if (result.dire_team_id) {
          if (teamMap.has(result.dire_team_id)) {
            direDbTeam = teamMap.get(result.dire_team_id);
          } else {
            const teamInfoResp = await fetch(
              `${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetTeamInfoByTeamID/v1/?key=${STEAM_API_KEY}&start_at_team_id=${result.dire_team_id}&teams_requested=1`
            );
            const teamInfo = await teamInfoResp.json();
            const teamData = teamInfo.result?.teams?.[0];

            const { data: newTeam } = await supabase
              .from('kkup_teams')
              .insert({
                kernel_kup_id: kkupId,
                name: teamData?.name || result.dire_name || 'Dire Team',
                tag: teamData?.tag || result.dire_name?.substring(0, 4).toUpperCase() || 'DIR',
                valve_team_id: result.dire_team_id,
                logo_url: teamData?.logo_url || teamData?.logo,
                imported_at: new Date().toISOString()
              })
              .select()
              .single();

            if (newTeam) {
              teamMap.set(result.dire_team_id, newTeam);
              direDbTeam = newTeam;
              teamsCreated++;
            }
          }
        }

        // Create match record
        const { data: dbMatch } = await supabase
          .from('kkup_matches')
          .insert({
            kernel_kup_id: kkupId,
            match_id: match.match_id,
            series_id: result.series_id || null,
            series_type: result.series_type || null,
            team1_id: radiantDbTeam?.id,
            team2_id: direDbTeam?.id,
            radiant_team_id: result.radiant_team_id,
            dire_team_id: result.dire_team_id,
            winner_team_id: result.radiant_win ? radiantDbTeam?.id : direDbTeam?.id,
            team1_score: result.radiant_win ? 1 : 0,
            team2_score: result.radiant_win ? 0 : 1,
            radiant_win: result.radiant_win,
            duration: result.duration,
            status: 'completed',
            stage: 'playoffs', // Default, can be updated manually
            dotabuff_url: `https://www.dotabuff.com/matches/${match.match_id}`,
            scheduled_time: new Date(match.start_time * 1000).toISOString(),
            opendota_fetched: false
          })
          .select()
          .single();

        if (dbMatch) {
          matchesCreated++;

          // ============================================
          // Process Players (basic info from Steam)
          // ============================================
          if (result.players && Array.isArray(result.players)) {
            for (const player of result.players) {
              if (!player.account_id) continue;

              // Find or create player profile
              let playerProfile = null;
              const { data: existingProfile } = await supabase
                .from('kkup_player_profiles')
                .select('*')
                .eq('steam_id', String(player.account_id))
                .maybeSingle();

              if (existingProfile) {
                playerProfile = existingProfile;
              } else {
                const { data: newProfile } = await supabase
                  .from('kkup_player_profiles')
                  .insert({
                    player_name: player.personaname || `Player ${player.account_id}`,
                    steam_id: String(player.account_id),
                    dotabuff_url: `https://www.dotabuff.com/players/${player.account_id}`,
                    opendota_url: `https://www.opendota.com/players/${player.account_id}`,
                  })
                  .select()
                  .single();
                
                playerProfile = newProfile;
              }

              if (!playerProfile) continue;

              // Determine team
              const isRadiant = player.player_slot < 128;
              const teamId = isRadiant ? radiantDbTeam?.id : direDbTeam?.id;

              // Insert basic player stats (Steam API has limited stats)
              await supabase
                .from('kkup_match_player_stats')
                .insert({
                  match_id: dbMatch.id,
                  player_profile_id: playerProfile.id,
                  team_id: teamId,
                  player_name: player.personaname || `Player ${player.account_id}`,
                  steam_id: player.account_id,
                  hero_id: player.hero_id || 0,
                  hero_name: getHeroName(player.hero_id || 0),
                  is_winner: result.radiant_win ? isRadiant : !isRadiant,
                  kills: player.kills || 0,
                  deaths: player.deaths || 0,
                  assists: player.assists || 0,
                  last_hits: player.last_hits || 0,
                  denies: player.denies || 0,
                  gpm: player.gold_per_min || 0,
                  xpm: player.xp_per_min || 0,
                  level: player.level || 0,
                  game_duration_seconds: result.duration || 0
                });
            }
          }
        }

        console.log(`✅ Processed match ${match.match_id}`);

      } catch (matchError) {
        console.error(`❌ Error processing match ${match.match_id}:`, matchError);
      }
    }

    // ============================================
    // STEP 5: Mark Tournament as Imported
    // ============================================
    await supabase
      .from('kernel_kups')
      .update({
        import_status: 'completed',
        imported_at: new Date().toISOString()
      })
      .eq('id', kkupId);

    console.log(`🎉 Tournament import complete!`);
    console.log(`📊 Summary: ${teamsCreated} teams, ${matchesCreated} matches`);

    return c.json({
      success: true,
      message: 'Tournament imported successfully',
      tournament_id: kkupId,
      stats: {
        teams_created: teamsCreated,
        matches_created: matchesCreated,
        next_step: 'Run OpenDota enrichment to fetch detailed player stats'
      }
    });

  } catch (error) {
    console.error('❌ Tournament import error:', error);
    return c.json({ 
      error: 'Internal server error during import', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

/**
 * 🔬 TEST: Fetch tournament data without importing (preview mode)
 * POST /admin/test-tournament-import
 * Returns all the data that WOULD be imported
 */
app.post("/make-server-4789f4af/admin/test-tournament-import", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    // Verify user is admin/owner/queen of hog
    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized - Invalid token' }, 401);
    }

    const { data: member } = await supabase
      .from('members')
      .select('role')
      .eq('supabase_user_id', authUser.id)
      .single();

    const allowedRoles = ['admin', 'queen of hog', 'owner'];
    if (!member || !allowedRoles.includes(member.role)) {
      return c.json({ error: 'Unauthorized - Admin access required' }, 403);
    }

    // Parse request body
    const body = await c.req.json();
    const { league_id, series_id, match_id, team_id, player_id } = body;

    console.log(`🔬 TEST MODE: Fetching tournament data...`);

    // Use same verification logic but DON'T save to database
    const STEAM_API_KEY = Deno.env.get('STEAM_WEB_API_KEY') ?? '';
    const STEAM_API_BASE = 'https://api.steampowered.com';
    const DOTA2_APP_ID = 570;

    const errors: string[] = [];
    const testResults = {
      verified: false,
      tournament: null as any,
      teams: [] as any[],
      matches: [] as any[],
      errors: []
    };

    // Verify League ID and get name
    const leagueResponse = await fetch(
      `${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetLeagueListing/v1/?key=${STEAM_API_KEY}`
    );
    const leagueData = await leagueResponse.json();
    const leagueInfo = leagueData.result?.leagues?.find((l: any) => l.leagueid === league_id);
    
    if (!leagueInfo) {
      errors.push(`League ID ${league_id} not found in Steam API`);
    }

    const tournamentName = leagueInfo?.name || `Tournament ${league_id}`;

    // Verify Match
    const matchDetailResponse = await fetch(
      `${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetMatchDetails/v1/?key=${STEAM_API_KEY}&match_id=${match_id}`
    );
    const matchDetailData = await matchDetailResponse.json();
    
    if (!matchDetailData.result || matchDetailData.result.error) {
      errors.push(`Match ID ${match_id} not found`);
    } else if (matchDetailData.result.leagueid !== league_id) {
      errors.push(`Match does not belong to league`);
    }

    // Verify Team
    const radiantTeamId = matchDetailData.result?.radiant_team_id;
    const direTeamId = matchDetailData.result?.dire_team_id;
    
    if (radiantTeamId !== team_id && direTeamId !== team_id) {
      errors.push(`Team ID ${team_id} not found in match`);
    }

    // Verify Player
    const playerExists = matchDetailData.result?.players?.some((p: any) => p.account_id === player_id);
    if (!playerExists) {
      errors.push(`Player ID ${player_id} not found in match`);
    }

    // Verify Series
    if (matchDetailData.result?.series_id && matchDetailData.result.series_id !== series_id) {
      errors.push(`Series ID mismatch`);
    }

    if (errors.length > 0) {
      return c.json({ 
        verified: false, 
        errors,
        field_errors: {
          league_id: errors.find(e => e.includes('League')),
          match_id: errors.find(e => e.includes('Match')),
          team_id: errors.find(e => e.includes('Team')),
          player_id: errors.find(e => e.includes('Player')),
          series_id: errors.find(e => e.includes('Series'))
        }
      }, 400);
    }

    // Fetch all matches
    const matchHistoryResponse = await fetch(
      `${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetMatchHistory/v1/?key=${STEAM_API_KEY}&league_id=${league_id}&matches_requested=100`
    );
    const matchHistoryData = await matchHistoryResponse.json();
    const allMatches = matchHistoryData.result?.matches || [];

    // Calculate dates
    let earliestMatchTime = Infinity;
    let latestMatchTime = 0;

    for (const match of allMatches) {
      if (match.start_time) {
        if (match.start_time < earliestMatchTime) earliestMatchTime = match.start_time;
        if (match.start_time > latestMatchTime) latestMatchTime = match.start_time;
      }
    }

    const tournamentStartDate = earliestMatchTime !== Infinity 
      ? new Date(earliestMatchTime * 1000).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    
    const tournamentEndDate = latestMatchTime > 0
      ? new Date(latestMatchTime * 1000).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    // Build tournament object
    testResults.tournament = {
      name: tournamentName,
      league_id,
      series_id,
      verified_match_id: match_id,
      verified_team_id: team_id,
      verified_player_id: player_id,
      tournament_start_date: tournamentStartDate,
      tournament_end_date: tournamentEndDate
    };

    // Process teams and matches (ENRICHED for beautiful preview)
    const teamsMap = new Map();
    const playersMap = new Map();
    const teamWinsLosses = new Map();
    
    // Process ALL matches to get complete team W/L records and player list
    for (const match of allMatches) {
      try {
        const matchDetailResp = await fetch(
          `${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetMatchDetails/v1/?key=${STEAM_API_KEY}&match_id=${match.match_id}`
        );
        const matchDetail = await matchDetailResp.json();
        const result = matchDetail.result;

        if (!result || result.error) continue;

        // Collect team data
        if (result.radiant_team_id && !teamsMap.has(result.radiant_team_id)) {
          const teamInfoResp = await fetch(
            `${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetTeamInfoByTeamID/v1/?key=${STEAM_API_KEY}&start_at_team_id=${result.radiant_team_id}&teams_requested=1`
          );
          const teamInfo = await teamInfoResp.json();
          const teamData = teamInfo.result?.teams?.[0];

          teamsMap.set(result.radiant_team_id, {
            team_id: result.radiant_team_id,
            team_name: teamData?.name || result.radiant_name || 'Radiant Team',
            tag: teamData?.tag || 'RAD',
            logo_url: getSteamLogoUrl(teamData?.logo_url || teamData?.logo),
            wins: 0,
            losses: 0
          });
          teamWinsLosses.set(result.radiant_team_id, { wins: 0, losses: 0 });
        }

        if (result.dire_team_id && !teamsMap.has(result.dire_team_id)) {
          const teamInfoResp = await fetch(
            `${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetTeamInfoByTeamID/v1/?key=${STEAM_API_KEY}&start_at_team_id=${result.dire_team_id}&teams_requested=1`
          );
          const teamInfo = await teamInfoResp.json();
          const teamData = teamInfo.result?.teams?.[0];

          teamsMap.set(result.dire_team_id, {
            team_id: result.dire_team_id,
            team_name: teamData?.name || result.dire_name || 'Dire Team',
            tag: teamData?.tag || 'DIRE',
            logo_url: getSteamLogoUrl(teamData?.logo_url || teamData?.logo),
            wins: 0,
            losses: 0
          });
          teamWinsLosses.set(result.dire_team_id, { wins: 0, losses: 0 });
        }

        // Count W/L
        if (result.radiant_win) {
          const radiantRecord = teamWinsLosses.get(result.radiant_team_id);
          if (radiantRecord) radiantRecord.wins++;
          const direRecord = teamWinsLosses.get(result.dire_team_id);
          if (direRecord) direRecord.losses++;
        } else {
          const direRecord = teamWinsLosses.get(result.dire_team_id);
          if (direRecord) direRecord.wins++;
          const radiantRecord = teamWinsLosses.get(result.radiant_team_id);
          if (radiantRecord) radiantRecord.losses++;
        }

        // Collect player data from ALL matches
        if (result.players) {
          for (const player of result.players) {
            if (player.account_id && !playersMap.has(player.account_id)) {
              playersMap.set(player.account_id, {
                account_id: player.account_id,
                steam_id: steam32ToSteam64(player.account_id),
                name: player.personaname || `Player ${player.account_id}`,
                dotabuff_url: `https://www.dotabuff.com/players/${player.account_id}`,
                opendota_url: `https://www.opendota.com/players/${player.account_id}`
              });
            }
          }
        }

      } catch (error) {
        console.error(`Error processing match ${match.match_id}:`, error);
      }
    }

    // Update team W/L records
    for (const [teamId, team] of teamsMap.entries()) {
      const record = teamWinsLosses.get(teamId);
      if (record) {
        team.wins = record.wins;
        team.losses = record.losses;
      }
    }

    // Now enrich FIRST 8 matches for preview with full details
    const enrichedMatches = [];
    for (const match of allMatches.slice(0, 8)) {
      try {
        const matchDetailResp = await fetch(
          `${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetMatchDetails/v1/?key=${STEAM_API_KEY}&match_id=${match.match_id}`
        );
        const matchDetail = await matchDetailResp.json();
        const result = matchDetail.result;

        if (!result || result.error) continue;

        const radiantTeam = teamsMap.get(result.radiant_team_id);
        const direTeam = teamsMap.get(result.dire_team_id);
        const winner = result.radiant_win ? radiantTeam : direTeam;

        enrichedMatches.push({
          match_id: match.match_id,
          series_id: result.series_id || null,
          series_type: result.series_type || 0,
          match_date: new Date(result.start_time * 1000).toISOString(),
          duration_seconds: result.duration,
          duration_formatted: `${Math.floor(result.duration / 60)}:${String(result.duration % 60).padStart(2, '0')}`,
          radiant_team: {
            team_id: result.radiant_team_id,
            name: radiantTeam?.team_name || 'Radiant',
            tag: radiantTeam?.tag || 'RAD',
            logo_url: radiantTeam?.logo_url
          },
          dire_team: {
            team_id: result.dire_team_id,
            name: direTeam?.team_name || 'Dire',
            tag: direTeam?.tag || 'DIRE',
            logo_url: direTeam?.logo_url
          },
          winner: {
            team_id: winner?.team_id,
            name: winner?.team_name || 'Unknown',
            tag: winner?.tag || '???'
          },
          radiant_win: result.radiant_win,
          radiant_score: result.radiant_score || 0,
          dire_score: result.dire_score || 0,
          radiant_players: (result.players || [])
            .filter(p => p.player_slot < 128)
            .map(p => ({
              account_id: p.account_id,
              name: playersMap.get(p.account_id)?.name || `Player ${p.account_id}`,
              hero_id: p.hero_id
            })),
          dire_players: (result.players || [])
            .filter(p => p.player_slot >= 128)
            .map(p => ({
              account_id: p.account_id,
              name: playersMap.get(p.account_id)?.name || `Player ${p.account_id}`,
              hero_id: p.hero_id
            }))
        });

      } catch (error) {
        console.error(`Error enriching match ${match.match_id}:`, error);
      }
    }

    testResults.teams = Array.from(teamsMap.values());
    testResults.matches = enrichedMatches;
    testResults.players = Array.from(playersMap.values());
    testResults.verified = true;

    console.log(`✅ TEST MODE: Found ${testResults.teams.length} teams, ${allMatches.length} total matches, ${testResults.players.length} players`);

    return c.json({
      verified: true,
      message: `Found tournament data for "${tournamentName}"`,
      data: testResults,
      league: {
        leagueid: league_id,
        name: tournamentName,
        tier: leagueInfo?.tier || 'unknown'
      },
      stats: {
        total_matches: allMatches.length,
        total_teams: testResults.teams.length,
        total_players: testResults.players.length,
        matches_preview: testResults.matches.length
      }
    });

  } catch (error) {
    console.error('❌ Test error:', error);
    return c.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

/**
 * 💾 IMPORT: Save pre-verified tournament data
 * POST /admin/import-tournament-from-test
 * Accepts the JSON output from the test endpoint
 */
app.post("/make-server-4789f4af/admin/import-tournament-from-test", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    // Verify user
    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized - Invalid token' }, 401);
    }

    const { data: member } = await supabase
      .from('members')
      .select('role')
      .eq('supabase_user_id', authUser.id)
      .single();

    const allowedRoles = ['admin', 'queen of hog', 'owner'];
    if (!member || !allowedRoles.includes(member.role)) {
      return c.json({ error: 'Unauthorized - Admin access required' }, 403);
    }

    // Parse the pre-verified data
    const body = await c.req.json();
    const { tournament, teams, league_id } = body;

    if (!tournament || !teams) {
      return c.json({ error: 'Invalid data format - missing tournament or teams' }, 400);
    }

    console.log(`💾 Importing tournament: ${tournament.name}`);

    // Create tournament
    const { data: dbTournament, error: tournamentError } = await supabase
      .from('kernel_kups')
      .insert({
        name: tournament.name,
        league_id: tournament.league_id,
        series_id: tournament.series_id,
        verified_match_id: tournament.verified_match_id,
        verified_team_id: tournament.verified_team_id,
        verified_player_id: tournament.verified_player_id,
        tournament_start_date: tournament.tournament_start_date,
        tournament_end_date: tournament.tournament_end_date,
        import_status: 'in_progress',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (tournamentError || !dbTournament) {
      return c.json({ error: 'Failed to create tournament', details: tournamentError }, 500);
    }

    const kkupId = dbTournament.id;

    // Create teams
    const teamMap = new Map();
    for (const team of teams) {
      const { data: dbTeam } = await supabase
        .from('kkup_teams')
        .insert({
          kernel_kup_id: kkupId,
          name: team.name,
          tag: team.tag,
          valve_team_id: team.valve_team_id,
          logo_url: team.logo_url,
          imported_at: new Date().toISOString()
        })
        .select()
        .single();

      if (dbTeam) {
        teamMap.set(team.valve_team_id, dbTeam);
      }
    }

    // Now fetch ALL matches and create them
    const STEAM_API_KEY = Deno.env.get('STEAM_WEB_API_KEY') ?? '';
    const STEAM_API_BASE = 'https://api.steampowered.com';
    const DOTA2_APP_ID = 570;

    const matchHistoryResponse = await fetch(
      `${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetMatchHistory/v1/?key=${STEAM_API_KEY}&league_id=${league_id}&matches_requested=100`
    );
    const matchHistoryData = await matchHistoryResponse.json();
    const allMatches = matchHistoryData.result?.matches || [];

    let matchesCreated = 0;

    for (const match of allMatches) {
      try {
        const matchDetailResp = await fetch(
          `${STEAM_API_BASE}/IDOTA2Match_${DOTA2_APP_ID}/GetMatchDetails/v1/?key=${STEAM_API_KEY}&match_id=${match.match_id}`
        );
        const matchDetail = await matchDetailResp.json();
        const result = matchDetail.result;

        if (!result || result.error) continue;

        const radiantDbTeam = teamMap.get(result.radiant_team_id);
        const direDbTeam = teamMap.get(result.dire_team_id);
        
        // Determine winner
        const winnerTeamId = result.radiant_win ? radiantDbTeam?.id : direDbTeam?.id;

        const { data: dbMatch } = await supabase
          .from('kkup_matches')
          .insert({
            kernel_kup_id: kkupId,
            valve_match_id: match.match_id,
            match_date: new Date(result.start_time * 1000).toISOString(),
            duration_seconds: result.duration || 0,
            scheduled_time: new Date(result.start_time * 1000).toISOString(),
            radiant_team_id: radiantDbTeam?.id,
            dire_team_id: direDbTeam?.id,
            team1_id: radiantDbTeam?.id,
            team2_id: direDbTeam?.id,
            winner_team_id: winnerTeamId,
            radiant_win: result.radiant_win || false,
            radiant_score: result.radiant_score || 0,
            dire_score: result.dire_score || 0,
            team1_score: result.radiant_score || 0,
            team2_score: result.dire_score || 0,
            stage: 'tournament',
            status: 'completed',
            imported_at: new Date().toISOString()
          })
          .select()
          .single();

        if (dbMatch) matchesCreated++;

        // Create player stats (basic from Steam)
        if (dbMatch && result.players) {
          for (const player of result.players) {
            if (!player.account_id) continue;

            // Get or create player profile
            let playerProfile = null;
            const { data: existingProfile } = await supabase
              .from('kkup_player_profiles')
              .select('*')
              .eq('steam_id', String(player.account_id))
              .maybeSingle();

            if (existingProfile) {
              playerProfile = existingProfile;
            } else {
              const { data: newProfile, error: profileError } = await supabase
                .from('kkup_player_profiles')
                .insert({
                  steam_id: String(player.account_id),
                  player_name: player.personaname || `Player ${player.account_id}`,
                  dotabuff_url: `https://www.dotabuff.com/players/${player.account_id}`,
                  opendota_url: `https://www.opendota.com/players/${player.account_id}`,
                })
                .select()
                .single();
              
              if (profileError) {
                console.error(`  ❌ Failed to create player ${player.account_id}:`, profileError);
                continue;
              }
              
              playerProfile = newProfile;
            }

            if (!playerProfile) continue;

            const isRadiant = player.player_slot < 128;
            const teamId = isRadiant ? radiantDbTeam?.id : direDbTeam?.id;

            await supabase
              .from('kkup_match_player_stats')
              .insert({
                match_id: dbMatch.id,
                player_profile_id: playerProfile.id,
                team_id: teamId,
                player_name: player.personaname || `Player ${player.account_id}`,
                steam_id: player.account_id,
                hero_id: player.hero_id || 0,
                hero_name: getHeroName(player.hero_id || 0),
                is_winner: result.radiant_win ? isRadiant : !isRadiant,
                kills: player.kills || 0,
                deaths: player.deaths || 0,
                assists: player.assists || 0,
                last_hits: player.last_hits || 0,
                denies: player.denies || 0,
                gpm: player.gold_per_min || 0,
                xpm: player.xp_per_min || 0,
                level: player.level || 0,
                game_duration_seconds: result.duration || 0
              });
          }
        }

      } catch (error) {
        console.error(`Error processing match:`, error);
      }
    }

    // Calculate team W/L records based on matches
    console.log('📊 Calculating team W/L records...');
    const teamRecords = new Map();
    
    // Fetch all matches for this tournament to calculate records
    const { data: allTournamentMatches } = await supabase
      .from('kkup_matches')
      .select('*')
      .eq('kernel_kup_id', kkupId);
    
    // Initialize records for all teams
    for (const [valveTeamId, dbTeam] of teamMap.entries()) {
      teamRecords.set(dbTeam.id, { wins: 0, losses: 0 });
    }
    
    // Count wins/losses from all matches
    for (const match of (allTournamentMatches || [])) {
      if (match.radiant_team_id && match.dire_team_id) {
        if (match.radiant_win) {
          const record = teamRecords.get(match.radiant_team_id);
          if (record) record.wins++;
          const direRecord = teamRecords.get(match.dire_team_id);
          if (direRecord) direRecord.losses++;
        } else {
          const record = teamRecords.get(match.dire_team_id);
          if (record) record.wins++;
          const radiantRecord = teamRecords.get(match.radiant_team_id);
          if (radiantRecord) radiantRecord.losses++;
        }
      }
    }
    
    // Update team records in database
    for (const [teamId, record] of teamRecords.entries()) {
      await supabase
        .from('kkup_teams')
        .update({ wins: record.wins, losses: record.losses })
        .eq('id', teamId);
    }
    
    console.log(`✅ Updated W/L records for ${teamRecords.size} teams`);

    // Mark complete
    await supabase
      .from('kernel_kups')
      .update({
        import_status: 'completed',
        imported_at: new Date().toISOString()
      })
      .eq('id', kkupId);

    console.log(`🎉 Import complete: ${teamMap.size} teams, ${matchesCreated} matches`);

    return c.json({
      success: true,
      message: 'Tournament imported successfully',
      tournament_id: kkupId,
      stats: {
        teams_created: teamMap.size,
        matches_created: matchesCreated
      }
    });

  } catch (error) {
    console.error('❌ Import error:', error);
    return c.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

/**
 * ❌ DEPRECATED - Removed in favor of Tournament Builder
 * Use /make-server-4789f4af/admin/tournament-builder instead
 */
/* OLD RAW-IMPORT ENDPOINT - COMMENTED OUT
app.post("/make-server-4789f4af/kkup/raw-import", async (c) => {
  try {
    const body = await c.req.json();
    const { tournament, teams, matches, league_id } = body;

    console.log(`🌽 RAW IMPORT: Creating ${tournament?.name || 'tournament'}...`);

    // 1. Create tournament
    const { data: dbTournament, error: tournamentError } = await supabase
      .from('kernel_kups')
      .insert({
        name: tournament.name,
        league_id: tournament.league_id || league_id,
        series_id: tournament.series_id || 0,
        verified_match_id: tournament.verified_match_id || 0,
        verified_team_id: tournament.verified_team_id || 0,
        verified_player_id: tournament.verified_player_id || 0,
        tournament_start_date: tournament.tournament_start_date || new Date().toISOString().split('T')[0],
        tournament_end_date: tournament.tournament_end_date || new Date().toISOString().split('T')[0],
        import_status: 'in_progress',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (tournamentError || !dbTournament) {
      return c.json({ error: 'Failed to create tournament', details: tournamentError }, 500);
    }

    const kkupId = dbTournament.id;
    console.log(`✅ Created tournament ID: ${kkupId}`);

    // 2. Create teams
    const teamMap = new Map();
    if (teams && Array.isArray(teams)) {
      for (const team of teams) {
        const { data: dbTeam } = await supabase
          .from('kkup_teams')
          .insert({
            kernel_kup_id: kkupId,
            name: team.name,
            tag: team.tag,
            valve_team_id: team.valve_team_id,
            logo_url: team.logo_url || null,
            imported_at: new Date().toISOString()
          })
          .select()
          .single();

        if (dbTeam) {
          teamMap.set(team.valve_team_id, dbTeam);
        }
      }
      console.log(`✅ Created ${teamMap.size} teams`);
    }

    // 3. Create matches if provided
    let matchesCreated = 0;
    if (matches && Array.isArray(matches)) {
      for (const match of matches) {
        const radiantTeam = teamMap.get(match.radiant_team_valve_id);
        const direTeam = teamMap.get(match.dire_team_valve_id);

        await supabase
          .from('kkup_matches')
          .insert({
            kernel_kup_id: kkupId,
            valve_match_id: match.valve_match_id,
            match_date: match.match_date,
            duration_seconds: match.duration_seconds || 0,
            radiant_team_id: radiantTeam?.id,
            dire_team_id: direTeam?.id,
            radiant_win: match.radiant_win || false,
            radiant_score: match.radiant_score || 0,
            dire_score: match.dire_score || 0,
            imported_at: new Date().toISOString()
          });

        matchesCreated++;
      }
      console.log(`✅ Created ${matchesCreated} matches`);
    }

    // 4. Mark complete
    await supabase
      .from('kernel_kups')
      .update({
        import_status: 'completed',
        imported_at: new Date().toISOString()
      })
      .eq('id', kkupId);

    console.log(`🎉 RAW IMPORT COMPLETE!`);

    return c.json({
      success: true,
      message: 'Tournament imported successfully',
      tournament_id: kkupId,
      stats: {
        teams_created: teamMap.size,
        matches_created: matchesCreated
      }
    });

  } catch (error) {
    console.error('❌ Raw import error:', error);
    return c.json({ 
      error: 'Import failed', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});
END OF DEPRECATED RAW-IMPORT ENDPOINT */

/**
 * 🌽 OPENDOTA MATCH IMPORT - Paste OpenDota match response
 * POST /kkup/import-opendota-match
 * Accepts raw OpenDota API response and extracts tournament/team/match data
 */
app.post("/make-server-4789f4af/kkup/import-opendota-match", async (c) => {
  try {
    const body = await c.req.json();
    
    // Handle both direct OpenDota response and wrapped response
    const matchData = body.opendota?.data || body;
    
    if (!matchData || !matchData.match_id) {
      return c.json({ error: 'Invalid OpenDota match data' }, 400);
    }

    console.log(`🌽 OPENDOTA IMPORT: Match ${matchData.match_id}`);

    const leagueId = matchData.leagueid || matchData.league?.leagueid;
    const tournamentName = matchData.league?.name || `League ${leagueId}`;

    if (!leagueId) {
      return c.json({ error: 'No league_id found in match data' }, 400);
    }

    // Check if tournament already exists
    const { data: existingTournament } = await supabase
      .from('kernel_kups')
      .select('*')
      .eq('league_id', leagueId)
      .single();

    let kkupId;
    let isNew = false;

    if (existingTournament) {
      kkupId = existingTournament.id;
      console.log(`✅ Using existing tournament ID: ${kkupId}`);
    } else {
      // Create new tournament
      const matchDate = new Date(matchData.start_time * 1000);
      const { data: newTournament, error: tournamentError } = await supabase
        .from('kernel_kups')
        .insert({
          name: tournamentName,
          league_id: leagueId,
          series_id: 0,
          verified_match_id: matchData.match_id,
          verified_team_id: matchData.radiant_team_id || 0,
          verified_player_id: matchData.players?.[0]?.account_id || 0,
          tournament_start_date: matchDate.toISOString().split('T')[0],
          tournament_end_date: matchDate.toISOString().split('T')[0],
          import_status: 'in_progress',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (tournamentError || !newTournament) {
        return c.json({ error: 'Failed to create tournament', details: tournamentError }, 500);
      }

      kkupId = newTournament.id;
      isNew = true;
      console.log(`✅ Created new tournament ID: ${kkupId}`);
    }

    // Extract and create/update teams
    const teamMap = new Map();
    
    if (matchData.radiant_team_id) {
      const { data: existingTeam } = await supabase
        .from('kkup_teams')
        .select('*')
        .eq('kernel_kup_id', kkupId)
        .eq('valve_team_id', matchData.radiant_team_id)
        .single();

      if (existingTeam) {
        teamMap.set(matchData.radiant_team_id, existingTeam);
      } else {
        const { data: newTeam } = await supabase
          .from('kkup_teams')
          .insert({
            kernel_kup_id: kkupId,
            name: matchData.radiant_name || `Team ${matchData.radiant_team_id}`,
            tag: matchData.radiant_name?.substring(0, 5).toUpperCase() || 'RAD',
            valve_team_id: matchData.radiant_team_id,
            logo_url: matchData.radiant_logo ? `https://steamcdn-a.akamaihd.net/apps/dota2/images/team_logos/${matchData.radiant_logo}.png` : null,
            imported_at: new Date().toISOString()
          })
          .select()
          .single();

        if (newTeam) teamMap.set(matchData.radiant_team_id, newTeam);
      }
    }

    if (matchData.dire_team_id) {
      const { data: existingTeam } = await supabase
        .from('kkup_teams')
        .select('*')
        .eq('kernel_kup_id', kkupId)
        .eq('valve_team_id', matchData.dire_team_id)
        .single();

      if (existingTeam) {
        teamMap.set(matchData.dire_team_id, existingTeam);
      } else {
        const { data: newTeam } = await supabase
          .from('kkup_teams')
          .insert({
            kernel_kup_id: kkupId,
            name: matchData.dire_name || `Team ${matchData.dire_team_id}`,
            tag: matchData.dire_name?.substring(0, 5).toUpperCase() || 'DIRE',
            valve_team_id: matchData.dire_team_id,
            logo_url: matchData.dire_logo ? `https://steamcdn-a.akamaihd.net/apps/dota2/images/team_logos/${matchData.dire_logo}.png` : null,
            imported_at: new Date().toISOString()
          })
          .select()
          .single();

        if (newTeam) teamMap.set(matchData.dire_team_id, newTeam);
      }
    }

    console.log(`✅ Processed ${teamMap.size} teams`);

    // Check if match already exists
    const { data: existingMatch } = await supabase
      .from('kkup_matches')
      .select('*')
      .eq('valve_match_id', matchData.match_id)
      .single();

    let matchCreated = false;
    if (!existingMatch) {
      const radiantTeam = teamMap.get(matchData.radiant_team_id);
      const direTeam = teamMap.get(matchData.dire_team_id);
      const matchDate = new Date(matchData.start_time * 1000);

      await supabase
        .from('kkup_matches')
        .insert({
          kernel_kup_id: kkupId,
          valve_match_id: matchData.match_id,
          match_date: matchDate.toISOString(),
          duration_seconds: matchData.duration,
          radiant_team_id: radiantTeam?.id,
          dire_team_id: direTeam?.id,
          radiant_win: matchData.radiant_win,
          radiant_score: matchData.radiant_score || 0,
          dire_score: matchData.dire_score || 0,
          imported_at: new Date().toISOString()
        });

      matchCreated = true;
      console.log(`✅ Created match ${matchData.match_id}`);
    } else {
      console.log(`⚠️ Match ${matchData.match_id} already exists`);
    }

    // Mark complete
    await supabase
      .from('kernel_kups')
      .update({
        import_status: 'completed',
        imported_at: new Date().toISOString()
      })
      .eq('id', kkupId);

    console.log(`🎉 OPENDOTA IMPORT COMPLETE!`);

    return c.json({
      success: true,
      message: matchCreated ? 'Match imported successfully' : 'Match already exists',
      tournament_id: kkupId,
      tournament_name: tournamentName,
      tournament_created: isNew,
      stats: {
        teams_processed: teamMap.size,
        match_created: matchCreated
      }
    });

  } catch (error) {
    console.error('❌ OpenDota import error:', error);
    return c.json({ 
      error: 'Import failed', 
      details: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

/**
 * 🏆 KERNEL KUP ACHIEVEMENTS - Get all achievements for a user
 * GET /kkup/user/:user_id/achievements
 */
app.get("/make-server-4789f4af/kkup/user/:user_id/achievements", async (c) => {
  try {
    const userId = c.req.param('user_id');

    const { data: achievements, error } = await supabase
      .from('user_kkup_achievements')
      .select(`
        *,
        kernel_kup:kernel_kups(id, name)
      `)
      .eq('user_id', userId)
      .order('awarded_at', { ascending: false });

    if (error) {
      console.error('❌ [Supabase] Fetch achievements error:', error);
      return c.json({ error: 'Failed to fetch achievements' }, 500);
    }

    return c.json({ achievements: achievements || [] });

  } catch (error) {
    console.error('Get achievements error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * 🏆 AWARD ACHIEVEMENT - Manually award an achievement to a user (Owner only)
 * POST /kkup/achievements/award
 * Body: { user_id, achievement_type, kernel_kup_id, metadata? }
 */
app.post("/make-server-4789f4af/kkup/achievements/award", async (c) => {
  try {
    // Verify authentication
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Missing access token' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    if (authError || !authUser) {
      return c.json({ error: 'Invalid access token' }, 401);
    }

    // Verify user is owner
    const { data: dbUser } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (!dbUser || dbUser.role !== 'owner') {
      return c.json({ error: 'Only owners can award achievements' }, 403);
    }

    const body = await c.req.json();
    const { user_id, achievement_type, kernel_kup_id, metadata } = body;

    // Validate required fields
    if (!user_id || !achievement_type || !kernel_kup_id) {
      return c.json({ error: 'Missing required fields: user_id, achievement_type, kernel_kup_id' }, 400);
    }

    // Check if achievement already exists
    const { data: existing } = await supabase
      .from('user_kkup_achievements')
      .select('*')
      .eq('user_id', user_id)
      .eq('achievement_type', achievement_type)
      .eq('kernel_kup_id', kernel_kup_id)
      .maybeSingle();

    if (existing) {
      return c.json({ error: 'This achievement has already been awarded to this user for this tournament' }, 400);
    }

    // Award achievement
    const { data: achievement, error: insertError } = await supabase
      .from('user_kkup_achievements')
      .insert({
        user_id,
        achievement_type,
        kernel_kup_id,
        metadata: metadata || {},
        awarded_by: authUser.id,
        awarded_at: new Date().toISOString(),
      })
      .select(`
        *,
        kernel_kup:kernel_kups(id, name, year)
      `)
      .single();

    if (insertError) {
      console.error('Award achievement error:', insertError);
      return c.json({ error: 'Failed to award achievement: ' + insertError.message }, 500);
    }

    return c.json({ success: true, achievement });

  } catch (error) {
    console.error('Award achievement error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * 🗑️ REVOKE ACHIEVEMENT - Remove an achievement from a user (Owner only)
 * DELETE /kkup/achievements/:achievement_id
 */
app.delete("/make-server-4789f4af/kkup/achievements/:achievement_id", async (c) => {
  try {
    // Verify authentication
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return c.json({ error: 'Missing access token' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await anonSupabase.auth.getUser(accessToken);
    if (authError || !authUser) {
      return c.json({ error: 'Invalid access token' }, 401);
    }

    // Verify user is owner
    const { data: dbUser } = await supabase
      .from('users')
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (!dbUser || dbUser.role !== 'owner') {
      return c.json({ error: 'Only owners can revoke achievements' }, 403);
    }

    const achievementId = c.req.param('achievement_id');

    const { error: deleteError } = await supabase
      .from('user_kkup_achievements')
      .delete()
      .eq('id', achievementId);

    if (deleteError) {
      console.error('Revoke achievement error:', deleteError);
      return c.json({ error: 'Failed to revoke achievement: ' + deleteError.message }, 500);
    }

    return c.json({ success: true, message: 'Achievement revoked' });

  } catch (error) {
    console.error('Revoke achievement error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * 📋 GET ALL ACHIEVEMENTS - Get all achievements for a Kernel Kup (Owner only)
 * GET /kkup/:kkup_id/achievements
 */
app.get("/make-server-4789f4af/kkup/:kkup_id/achievements", async (c) => {
  try {
    const kkupId = c.req.param('kkup_id');

    const { data: achievements, error } = await supabase
      .from('user_kkup_achievements')
      .select(`
        *,
        recipient:users!user_kkup_achievements_user_id_fkey(id, username, display_name, avatar_url),
        awarder:users!user_kkup_achievements_awarded_by_fkey(id, discord_username),
        kernel_kup:kernel_kups(id, name, year)
      `)
      .eq('kernel_kup_id', kkupId)
      .order('awarded_at', { ascending: false });

    if (error) {
      console.error('Fetch tournament achievements error:', error);
      return c.json({ error: 'Failed to fetch achievements' }, 500);
    }

    return c.json({ achievements: achievements || [] });

  } catch (error) {
    console.error('Get tournament achievements error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Fix Hero Names - Updates all hero_name columns from "Hero [id]" to proper names
app.post('/make-server-4789f4af/kkup/fix-hero-names', async (c) => {
  try {
    console.log('🔧 Starting hero name fix...');

    // Fetch all player stats with hero names that need fixing
    const { data: stats, error: fetchError } = await supabase
      .from('kkup_match_player_stats')
      .select('id, hero_id, hero_name')
      .like('hero_name', 'Hero %');

    if (fetchError) {
      console.error('Error fetching stats:', fetchError);
      return c.json({ error: 'Failed to fetch player stats' }, 500);
    }

    if (!stats || stats.length === 0) {
      return c.json({ message: 'No hero names to fix!', updated: 0 });
    }

    console.log(`📊 Found ${stats.length} player stats to update`);

    let updated = 0;
    let failed = 0;

    // Update each stat with the correct hero name
    for (const stat of stats) {
      const correctHeroName = getHeroName(stat.hero_id);
      
      const { error: updateError } = await supabase
        .from('kkup_match_player_stats')
        .update({ hero_name: correctHeroName })
        .eq('id', stat.id);

      if (updateError) {
        console.error(`Failed to update stat ${stat.id}:`, updateError);
        failed++;
      } else {
        updated++;
      }
    }

    console.log(`✅ Updated ${updated} hero names (${failed} failed)`);

    return c.json({
      message: `Successfully updated ${updated} hero names!`,
      updated,
      failed,
      total: stats.length,
    });
  } catch (error: any) {
    console.error('Fix hero names error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get all teams with tournament info
app.get('/make-server-4789f4af/kkup/all-teams', async (c) => {
  try {
    console.log('📋 Fetching all teams with tournament info...');

    // First get all teams
    const { data: teams, error: teamsError } = await supabase
      .from('kkup_teams')
      .select('*')
      .order('name', { ascending: true });

    if (teamsError) {
      console.error('Error fetching teams:', teamsError);
      return c.json({ error: 'Failed to fetch teams' }, 500);
    }

    // Then get all tournaments
    const { data: tournaments, error: tournamentsError } = await supabase
      .from('kernel_kup')
      .select('id, name');

    if (tournamentsError) {
      console.error('Error fetching tournaments:', tournamentsError);
      return c.json({ error: 'Failed to fetch tournaments' }, 500);
    }

    // Create a map for quick tournament lookup
    const tournamentMap = new Map(tournaments?.map(t => [t.id, t]) || []);

    // Attach tournament info to each team
    const teamsWithTournaments = (teams || []).map(team => ({
      ...team,
      tournament: tournamentMap.get(team.kernel_kup_id) || null
    }));

    console.log(`✅ Fetched ${teamsWithTournaments.length} teams`);
    return c.json({ teams: teamsWithTournaments });
  } catch (error: any) {
    console.error('Get all teams error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// List files in KKup Assets storage bucket
app.get('/make-server-4789f4af/kkup/storage/list', async (c) => {
  try {
    const path = c.req.query('path') || '';
    console.log(`📂 Listing files in bucket path: ${path || '/'}`);

    const { data: files, error } = await supabase.storage
      .from('make-4789f4af-kkup-assets')
      .list(path, {
        limit: 1000,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (error) {
      console.error('Error listing files:', error);
      return c.json({ error: 'Failed to list files' }, 500);
    }

    // Generate public URLs for each file
    const filesWithUrls = files.map(file => {
      const fullPath = path ? `${path}/${file.name}` : file.name;
      const { data: urlData } = supabase.storage
        .from('make-4789f4af-kkup-assets')
        .getPublicUrl(fullPath);

      // Check if it's a folder - Supabase storage doesn't have file.id for folders
      const isFolder = !file.id || !file.name.includes('.');

      return {
        name: file.name,
        path: fullPath,
        url: urlData.publicUrl,
        isFolder: isFolder,
        metadata: file.metadata
      };
    });

    return c.json({ files: filesWithUrls, path: path || '/' });
  } catch (error: any) {
    console.error('List storage error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Bulk update team logos from storage
app.post('/make-server-4789f4af/kkup/teams/update-logos', async (c) => {
  try {
    // Expecting: { mappings: [{ team_id: "uuid", logo_path: "kkup4/team.png" }] }
    const body = await c.req.json();
    const mappings = body.mappings || [];

    console.log(`🎨 Updating logos for ${mappings.length} teams...`);

    let updated = 0;
    let failed = 0;

    for (const mapping of mappings) {
      // Generate public URL
      const { data: urlData } = supabase.storage
        .from('make-4789f4af-kkup-assets')
        .getPublicUrl(mapping.logo_path);

      // Update team
      const { error: updateError } = await supabase
        .from('kkup_teams')
        .update({ logo_url: urlData.publicUrl })
        .eq('id', mapping.team_id);

      if (updateError) {
        console.error(`Failed to update team ${mapping.team_id}:`, updateError);
        failed++;
      } else {
        console.log(`✅ Updated team ${mapping.team_id} with logo: ${urlData.publicUrl}`);
        updated++;
      }
    }

    return c.json({
      message: `Successfully updated ${updated} team logos!`,
      updated,
      failed,
      total: mappings.length,
    });
  } catch (error: any) {
    console.error('Update logos error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// 🔗 LINK USER TO KKUP PLAYER PROFILE
app.post('/make-server-4789f4af/admin/link-user-kkup-profile', async (c) => {
  try {
    console.log('🔗 Link user to KKUP profile endpoint hit');
    const body = await c.req.json();
    const { user_id, kkup_player_profile_id } = body;
    if (!user_id || !kkup_player_profile_id) {
      return c.json({ error: 'Missing user_id or kkup_player_profile_id' }, 400);
    }
    const { data: playerProfile, error: profileError } = await supabase
      .from('kkup_player_profiles')
      .select('id, name, steam_id')
      .eq('id', kkup_player_profile_id)
      .single();
    if (profileError || !playerProfile) {
      return c.json({ error: 'KKUP player profile not found' }, 404);
    }
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ kkup_player_profile_id })
      .eq('id', user_id)
      .select()
      .single();
    if (updateError) {
      console.error('Error linking user to KKUP profile:', updateError);
      return c.json({ error: 'Failed to link user to KKUP profile' }, 500);
    }
    console.log(`✅ Linked user ${user_id} to KKUP profile ${playerProfile.name} (${playerProfile.steam_id})`);
    return c.json({ success: true, user: updatedUser, player_profile: playerProfile });
  } catch (error) {
    console.error('Link user to KKUP profile error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// 🔓 UNLINK USER FROM KKUP PLAYER PROFILE
app.post('/make-server-4789f4af/admin/unlink-user-kkup-profile', async (c) => {
  try {
    console.log('🔓 Unlink user from KKUP profile endpoint hit');
    const body = await c.req.json();
    const { user_id } = body;
    if (!user_id) {
      return c.json({ error: 'Missing user_id' }, 400);
    }
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ kkup_player_profile_id: null })
      .eq('id', user_id)
      .select()
      .single();
    if (updateError) {
      console.error('Error unlinking user from KKUP profile:', updateError);
      return c.json({ error: 'Failed to unlink user from KKUP profile' }, 500);
    }
    console.log(`✅ Unlinked user ${user_id} from KKUP profile`);
    return c.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Unlink user from KKUP profile error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// 📊 GET USER'S KKUP STATS
app.get('/make-server-4789f4af/users/:user_id/kkup-stats', async (c) => {
  try {
    const userId = c.req.param('user_id');
    console.log(`📊 Fetching KKUP stats for user ${userId}`);
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, discord_username, kkup_player_profile_id')
      .eq('id', userId)
      .single();
    if (userError || !user) {
      return c.json({ error: 'User not found' }, 404);
    }
    if (!user.kkup_player_profile_id) {
      return c.json({ linked: false, championships: { kernel_kup: 0, heaps_n_hooks: 0, total: 0 }, popd_kernels: 0, tournaments_played: 0, total_games: 0, wins: 0, losses: 0 });
    }
    const profileId = user.kkup_player_profile_id;
    const { data: profile } = await supabase.from('kkup_player_profiles').select('name, steam_id, avatar_url, dotabuff_url, opendota_url').eq('id', profileId).single();
    const { data: teamMemberships } = await supabase.from('kkup_team_players').select('team_id').eq('player_profile_id', profileId);
    const teamIds = teamMemberships?.map(tm => tm.team_id) || [];
    // Fetch championship awards from KV store (where admin tools actually write them)
    const championshipAwards = await kv.getByPrefix('kkup_championship:');
    let kernelKupChampionships = 0;
    let heapsNHooksChampionships = 0;
    for (const award of championshipAwards) {
      // Check if this user was on the winning team
      if (!teamIds.includes(award.team_id)) continue;
      const { data: teamPlayers } = await supabase
        .from('kkup_team_players')
        .select('player_profile_id')
        .eq('team_id', award.team_id);
      if (teamPlayers?.some((tp: any) => tp.player_profile_id === profileId)) {
        // Determine tournament type from KV key (format: kkup_championship:{kernel_kup_id})
        const awardKKupId = award.key?.split(':')[1];
        if (awardKKupId) {
          const { data: tournament } = await supabase
            .from('kernel_kups')
            .select('series_id')
            .eq('id', awardKKupId)
            .single();
          if (tournament?.series_id === 3) {
            heapsNHooksChampionships++;
          } else {
            kernelKupChampionships++;
          }
        } else {
          kernelKupChampionships++;
        }
      }
    }
    // Fetch Pop'd Kernel awards from KV store (where admin tools actually write them)
    const popdKernelAwards = await kv.getByPrefix('kkup_popdkernel:');
    // Deduplicate by kernel_kup_id + player_id (old single-key and new multi-key format may both exist)
    const seenPopdKeys = new Set<string>();
    let popdKernels = 0;
    for (const award of popdKernelAwards) {
      if (!award.player_id || !award.kernel_kup_id) continue;
      const dedupeKey = `${award.kernel_kup_id}:${award.player_id}`;
      if (award.player_id === profileId && !seenPopdKeys.has(dedupeKey)) {
        seenPopdKeys.add(dedupeKey);
        popdKernels++;
      }
    }
    const { data: tournamentsPlayed } = await supabase.from('kkup_teams').select('kernel_kup_id').in('id', teamIds);
    const uniqueTournaments = new Set(tournamentsPlayed?.map(t => t.kernel_kup_id));
    const { data: playerGames } = await supabase.from('kkup_match_player_stats').select('id, is_winner, kills, deaths, assists').eq('player_profile_id', profileId);
    const totalGames = playerGames?.length || 0;
    const wins = playerGames?.filter(g => g.is_winner).length || 0;
    const losses = totalGames - wins;
    const totalKills = playerGames?.reduce((sum: number, g: any) => sum + (g.kills || 0), 0) || 0;
    const totalDeaths = playerGames?.reduce((sum: number, g: any) => sum + (g.deaths || 0), 0) || 0;
    const totalAssists = playerGames?.reduce((sum: number, g: any) => sum + (g.assists || 0), 0) || 0;
    return c.json({ linked: true, profile: profile || null, championships: { kernel_kup: kernelKupChampionships, heaps_n_hooks: heapsNHooksChampionships, total: kernelKupChampionships + heapsNHooksChampionships }, popd_kernels: popdKernels || 0, tournaments_played: uniqueTournaments.size, total_games: totalGames, wins, losses, total_kills: totalKills, total_deaths: totalDeaths, total_assists: totalAssists });
  } catch (error) {
    console.error('Get user KKUP stats error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// 🔍 SEARCH KKUP PLAYER PROFILES
app.get('/make-server-4789f4af/kkup-player-profiles/search', async (c) => {
  try {
    const query = c.req.query('q') || '';
    console.log(`🔍 Searching KKUP player profiles for: "${query}"`);
    if (query.length < 2) {
      return c.json({ profiles: [] });
    }
    // Search by player name only (steam_id is bigint and can't be searched with ilike in PostgREST)
    const { data: profiles, error } = await supabase.from('kkup_player_profiles').select('id, name, steam_id, avatar_url').ilike('name', `%${query}%`).order('name').limit(20);
    if (error) {
      console.error('Search error:', error);
      return c.json({ error: 'Failed to search profiles' }, 500);
    }
    return c.json({ profiles: profiles || [] });
  } catch (error) {
    console.error('Search KKUP profiles error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /kkup/admin/find-duplicates
 * 
 * Finds duplicate player profiles by:
 * 1. Same steam_id (exact duplicates - same person, multiple rows)
 * 2. Same normalized name (possible duplicates - same name, maybe different steam_ids)
 * Also shows players with null steam_ids and orphaned team assignments
 */
app.get('/make-server-4789f4af/kkup/admin/find-duplicates', async (c) => {
  try {
    console.log('🔍 Finding duplicate player profiles...');

    // Fetch ALL player profiles
    const { data: allPlayers, error } = await supabase
      .from('kkup_player_profiles')
      .select('id, name, steam_id, avatar_url, created_at')
      .order('name');

    if (error) {
      console.error('Error fetching players:', error);
      return c.json({ error: 'Failed to fetch player profiles: ' + error.message }, 500);
    }

    const players = allPlayers || [];
    console.log(`📊 Total player profiles: ${players.length}`);

    // 1. Group by steam_id to find exact duplicates
    const steamIdGroups: Record<string, typeof players> = {};
    const nullSteamIdPlayers: typeof players = [];

    for (const p of players) {
      if (!p.steam_id) {
        nullSteamIdPlayers.push(p);
      } else {
        const key = String(p.steam_id);
        if (!steamIdGroups[key]) steamIdGroups[key] = [];
        steamIdGroups[key].push(p);
      }
    }

    const steamIdDuplicates = Object.entries(steamIdGroups)
      .filter(([_, group]) => group.length > 1)
      .map(([steamId, group]) => ({
        steam_id: steamId,
        count: group.length,
        profiles: group,
      }));

    // 2. Group by normalized name (lowercase, trimmed) to find name duplicates
    const nameGroups: Record<string, typeof players> = {};
    for (const p of players) {
      const normalizedName = (p.name || '').toLowerCase().trim();
      if (!normalizedName) continue;
      if (!nameGroups[normalizedName]) nameGroups[normalizedName] = [];
      nameGroups[normalizedName].push(p);
    }

    const nameDuplicates = Object.entries(nameGroups)
      .filter(([_, group]) => group.length > 1)
      .map(([name, group]) => ({
        normalized_name: name,
        count: group.length,
        profiles: group,
      }));

    // 3. Check kkup_team_players for orphaned references
    const { data: teamPlayers } = await supabase
      .from('kkup_team_players')
      .select('player_profile_id, team_id');

    const playerIdsInProfiles = new Set(players.map(p => p.id));

    // Team assignments pointing to non-existent profiles
    const orphanedTeamAssignments = (teamPlayers || []).filter(
      tp => !playerIdsInProfiles.has(tp.player_profile_id)
    );

    console.log(`🔍 Results: ${steamIdDuplicates.length} steam_id dupes, ${nameDuplicates.length} name dupes, ${nullSteamIdPlayers.length} null steam_ids, ${orphanedTeamAssignments.length} orphaned team assignments`);

    return c.json({
      total_profiles: players.length,
      steam_id_duplicates: {
        count: steamIdDuplicates.length,
        groups: steamIdDuplicates,
      },
      name_duplicates: {
        count: nameDuplicates.length,
        groups: nameDuplicates,
      },
      null_steam_id_players: {
        count: nullSteamIdPlayers.length,
        players: nullSteamIdPlayers,
      },
      orphaned_team_assignments: {
        count: orphanedTeamAssignments.length,
        assignments: orphanedTeamAssignments,
      },
    });
  } catch (error) {
    console.error('Find duplicates error:', error);
    return c.json({ error: 'Internal server error: ' + String(error) }, 500);
  }
});

Deno.serve(app.fetch);