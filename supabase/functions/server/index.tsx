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
  return c.json({ status: "ok" });
});

// Create or get user after Discord OAuth
app.post("/make-server-4789f4af/auth/discord-callback", async (c) => {
  try {
    const body = await c.req.json();
    const { discord_id, discord_username, discord_avatar, discord_email } = body;

    if (!discord_id) {
      return c.json({ error: "Discord ID required" }, 400);
    }

    console.log('Discord callback - ID:', discord_id, 'Username:', discord_username, 'Email:', discord_email);

    // Check if user exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('discord_id', discord_id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching user:', fetchError);
      return c.json({ error: 'Failed to fetch user' }, 500);
    }

    if (existingUser) {
      // Check if this user should be owner
      let updateData: any = {
        discord_username,
        discord_avatar,
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
        .eq('discord_id', discord_id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating user:', updateError);
        return c.json({ error: 'Failed to update user' }, 500);
      }

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
        discord_id,
        discord_username,
        discord_avatar,
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

    console.log('Created new user with role:', role);
    return c.json({ user: newUser });
  } catch (error) {
    console.error('Discord callback error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get current user info
app.get("/make-server-4789f4af/auth/me", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    
    if (!accessToken) {
      return c.json({ error: 'No access token provided' }, 401);
    }

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user from database
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
      .eq('discord_id', authUser.id)
      .single();

    if (dbError) {
      console.error('Error fetching user from database:', dbError);
      return c.json({ error: 'User not found in database' }, 404);
    }

    return c.json({ user: dbUser });
  } catch (error) {
    console.error('Get user error:', error);
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

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !authUser) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get user from database
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('discord_id', authUser.id)
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

    // Get user from database
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('discord_id', authUser.id)
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

    // Get user from database
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('discord_id', authUser.id)
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

    // Get user from database and check if owner
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('discord_id', authUser.id)
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

    // Get user from database and check if owner
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('discord_id', authUser.id)
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