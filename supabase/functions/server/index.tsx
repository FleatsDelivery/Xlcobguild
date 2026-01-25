import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

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

    if (!['guest', 'member', 'admin', 'owner'].includes(role)) {
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

    // Get user from database - query by supabase_id
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('id, role, rank_id, prestige_level')
      .eq('supabase_id', authUser.id)
      .single();

    if (userError || !dbUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Only members can submit MVP requests
    if (dbUser.role === 'guest') {
      return c.json({ error: 'Only members can submit MVP screenshots' }, 403);
    }

    const { screenshot_url, match_id, opendota_link } = await c.req.json();

    if (!screenshot_url) {
      return c.json({ error: 'Screenshot URL is required' }, 400);
    }

    // Check for duplicate submissions (same screenshot URL, match ID, or OpenDota link)
    const { data: duplicates, error: dupError } = await supabase
      .from('rank_up_requests')
      .select('*')
      .eq('user_id', dbUser.id)
      .or(`screenshot_url.eq.${screenshot_url}${match_id ? `,match_id.eq.${match_id}` : ''}${opendota_link ? `,opendota_link.eq.${opendota_link}` : ''}`);

    if (duplicates && duplicates.length > 0) {
      return c.json({ error: 'You have already submitted this screenshot or match' }, 400);
    }

    // Create MVP request
    const { data: request, error: createError } = await supabase
      .from('rank_up_requests')
      .insert({
        user_id: dbUser.id,
        type: 'mvp',
        screenshot_url,
        match_id: match_id || null,
        opendota_link: opendota_link || null,
        current_rank_id: dbUser.rank_id,
        current_prestige_level: dbUser.prestige_level,
        status: 'pending',
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating MVP request:', createError);
      return c.json({ error: 'Failed to create MVP request' }, 500);
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
      .select('role')
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

    if (!['rank_up', 'rank_down', 'prestige'].includes(action)) {
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

    if (dbUser.role !== 'owner' && dbUser.role !== 'admin') {
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

    if (dbUser.role !== 'owner' && dbUser.role !== 'admin') {
      return c.json({ error: 'Only owners and admins can approve requests' }, 403);
    }

    const requestId = c.req.param('requestId');

    // Get the request to find the user
    const { data: request, error: fetchError } = await supabase
      .from('membership_requests')
      .select('user_id, status')
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
    const { error: updateRequestError } = await supabase
      .from('membership_requests')
      .update({ 
        status: 'approved'
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

    if (dbUser.role !== 'owner' && dbUser.role !== 'admin') {
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
        status: 'denied'
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

    // Get pagination parameters from query string
    const limit = parseInt(c.req.query('limit') || '10', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    // Get total count first
    const { count: totalCount, error: countError } = await supabase
      .from('rank_up_requests')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', dbUser.id);

    if (countError) {
      console.error('Error counting MVP requests:', countError);
    }

    // Get MVP requests for this user with pagination
    const { data: requests, error: requestsError } = await supabase
      .from('rank_up_requests')
      .select('*')
      .eq('user_id', dbUser.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

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

    return c.json({ requests: requestsWithSignedUrls, totalCount });
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

    if (dbUser.role !== 'owner' && dbUser.role !== 'admin') {
      return c.json({ error: 'Only owners and admins can access this endpoint' }, 403);
    }

    // Get pagination parameters from query string
    const limit = parseInt(c.req.query('limit') || '10', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    // Get total count first
    const { count: totalCount, error: countError } = await supabase
      .from('rank_up_requests')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error counting MVP requests:', countError);
    }

    // Get all MVP requests with user info
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
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

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

    return c.json({ requests: requestsWithSignedUrls, totalCount });
  } catch (error) {
    console.error('Get MVP requests error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

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
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (userError || !dbUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (dbUser.role !== 'owner' && dbUser.role !== 'admin') {
      return c.json({ error: 'Only owners and admins can approve requests' }, 403);
    }

    const requestId = c.req.param('requestId');

    // Get the request
    const { data: request, error: fetchError } = await supabase
      .from('rank_up_requests')
      .select('user_id, status, current_rank_id, current_prestige_level')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      console.error('Error fetching request:', fetchError);
      return c.json({ error: 'Request not found' }, 404);
    }

    if (request.status !== 'pending') {
      return c.json({ error: 'Request has already been processed' }, 400);
    }

    // Get the user's current rank
    const { data: targetUser, error: targetError } = await supabase
      .from('users')
      .select('rank_id, prestige_level')
      .eq('id', request.user_id)
      .single();

    if (targetError || !targetUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Calculate new rank
    const maxRank = targetUser.prestige_level === 5 ? 11 : 10;
    let newRankId = targetUser.rank_id;

    if (targetUser.rank_id < maxRank) {
      newRankId = targetUser.rank_id + 1;
    } else {
      return c.json({ error: 'User is already at max rank for their prestige level' }, 400);
    }

    // Update the request status to approved
    const { error: updateRequestError } = await supabase
      .from('rank_up_requests')
      .update({ 
        status: 'approved'
      })
      .eq('id', requestId);

    if (updateRequestError) {
      console.error('❌ [Supabase] Error updating request:', updateRequestError);
      return c.json({ error: 'Failed to approve request' }, 500);
    }

    // Rank up the user
    const { error: updateUserError } = await supabase
      .from('users')
      .update({ 
        rank_id: newRankId,
        updated_at: new Date().toISOString()
      })
      .eq('id', request.user_id);

    if (updateUserError) {
      console.error('Error ranking up user:', updateUserError);
      return c.json({ error: 'Failed to rank up user' }, 500);
    }

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
      .select('role')
      .eq('supabase_id', authUser.id)
      .single();

    if (userError || !dbUser) {
      return c.json({ error: 'User not found' }, 404);
    }

    if (dbUser.role !== 'owner' && dbUser.role !== 'admin') {
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
        status: 'denied'
      })
      .eq('id', requestId);

    if (updateError) {
      console.error('❌ [Supabase] Error denying request:', updateError);
      return c.json({ error: 'Failed to deny request' }, 500);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Deny MVP request error:', error);
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
    const opendotaData = await fetchOpenDotaData(dbUser.opendota_id);

    if (!opendotaData) {
      return c.json({ error: 'Failed to fetch OpenDota data' }, 500);
    }

    // Update user with cached data
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        opendota_data: opendotaData,
        opendota_last_synced: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', dbUser.id);

    if (updateError) {
      console.error('Error syncing OpenDota data:', updateError);
      return c.json({ error: 'Failed to sync OpenDota data' }, 500);
    }

    console.log(`✅ Synced OpenDota data for user ${dbUser.id}`);
    return c.json({ success: true, data: opendotaData });
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

Deno.serve(app.fetch);