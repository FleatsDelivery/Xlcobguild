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
    const { discord_id, discord_username, discord_avatar } = body;

    if (!discord_id) {
      return c.json({ error: "Discord ID required" }, 400);
    }

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
      // Update existing user info
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          discord_username,
          discord_avatar,
          updated_at: new Date().toISOString(),
        })
        .eq('discord_id', discord_id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating user:', updateError);
        return c.json({ error: 'Failed to update user' }, 500);
      }

      return c.json({ user: updatedUser });
    }

    // Create new user with guest role and rank 1 (Earwig)
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        discord_id,
        discord_username,
        discord_avatar,
        rank_id: 1, // Earwig
        prestige_level: 0,
        role: 'guest',
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating user:', createError);
      return c.json({ error: 'Failed to create user' }, 500);
    }

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

Deno.serve(app.fetch);