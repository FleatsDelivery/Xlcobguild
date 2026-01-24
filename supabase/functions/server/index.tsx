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
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-4789f4af/health", (c) => {
  return c.json({ status: "ok", version: "3.0-DEPLOYED", timestamp: Date.now() });
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

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(accessToken);
    
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

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(accessToken);
    
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

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(accessToken);
    
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

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(accessToken);
    
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

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(accessToken);
    
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

    return c.json({ user: updatedUser });
  } catch (error) {
    console.error('Update user role error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

Deno.serve(app.fetch);