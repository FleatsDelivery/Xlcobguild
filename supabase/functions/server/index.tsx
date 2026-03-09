/**
 * The Corn Field Server — Thin Router
 * All route handlers live in routes-*.ts files.
 * This file wires up middleware, Supabase clients, storage buckets, and route registration.
 */
import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";

// ── Route modules ──
import { registerAuthRoutes } from "./routes-auth.ts";
// registerMembershipRoutes removed — membership request flow deprecated (guest role simplification)
import { registerAdminUsersRoutes } from "./routes-admin-users.ts";
import { registerMVPRoutes } from "./routes-mvp.ts";
import { registerLeaderboardRoutes } from "./routes-leaderboard.ts";
import { registerUserProfileRoutes } from "./routes-user-profile.ts";
import { registerDotaLookupRoutes } from "./routes-dota-lookup.ts";
import { registerSteamResearchRoutes } from "./routes-steam-research.ts";
import { registerWorkshopRoutes } from "./routes-workshop.ts";
import { registerStaffApplicationRoutes } from "./routes-staff-applications.ts";
import { registerKkupReadRoutes } from "./routes-kkup-read.ts";
import { registerKkupWriteRoutes } from "./routes-kkup-write.ts";
import { registerTournamentCrudRoutes } from "./routes-tournament-crud.ts";
import { registerTournamentBuilderRoutes } from "./routes-tournament-builder.ts";
import { registerAdminImportRoutes } from "./routes-admin-import.ts";
import { registerKkupToolsRoutes } from "./routes-kkup-tools.ts";
import { registerCsvImportRoutes } from "./routes-csv-import.ts";
import { registerAdminRolesRoutes } from "./routes-admin-roles.ts";
import { registerTournamentLifecycleRoutes } from "./routes-tournament-lifecycle.ts";
import { registerTeamFormationRoutes } from "./routes-team-formation.ts";
import { registerGiveawayRoutes } from "./routes-giveaway.ts";
import { registerGiveawayConfigRoutes } from "./routes-giveaway-config.ts";
import { registerNotificationRoutes } from "./routes-notifications.ts";
import { registerMasterTeamsRoutes } from "./routes-master-teams.ts";
import { registerPrintfulRoutes } from "./routes-printful.ts";
import { registerStripeRoutes } from "./routes-stripe.ts";
import { registerConnectRoutes } from "./routes-connect.ts";

import { registerPracticeTourneyRoutes } from "./routes-practice-tourney.ts";
import { registerCooksNCobsRoutes } from "./routes-cooks-n-cobs.ts";

import { registerDiscordCommandsRoute } from "./routes-discord-register.ts";
import { registerConfigRoutes } from "./routes-config.ts";

import { registerGuildRoutes } from "./routes-guilds.ts";
import { registerSeasonRoutes } from "./routes-seasons.ts";

import { registerBracketRoutes } from "./routes-bracket.ts";

import { PREFIX } from "./helpers.ts";

// ── Hono app ──
const app = new Hono();

// ── Supabase clients ──
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

const anonSupabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? '',
);

// ── Middleware ──
app.use('*', logger(console.log));
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

// ── Storage buckets (idempotent on startup) ──
(async () => {
  for (const [name, isPublic] of [
    ['make-4789f4af-mvp-screenshots', false],
    ['make-4789f4af-kkup-assets', true],
    ['make-4789f4af-recipe-images', false],
  ] as const) {
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      if (!buckets?.some(b => b.name === name)) {
        await supabase.storage.createBucket(name, { public: isPublic });
        console.log(`✅ Created storage bucket: ${name}`);
      }
    } catch (error) {
      console.error(`❌ Error creating bucket ${name}:`, error);
    }
  }
})();

// ── Health / test ──
app.get(`${PREFIX}/health`, (c) => {
  return c.json({ status: "ok", version: "5.0-MODULAR", timestamp: Date.now() });
});

app.get(`${PREFIX}/test`, (c) => {
  return c.json({ message: "Modular TCF server is running!", emoji: "🌽" });
});

// ── Register all route modules ──
// Order matters for some Hono path matching (hall-of-fame before :kkup_id)
registerAuthRoutes(app, supabase, anonSupabase);
// registerMembershipRoutes removed — membership request flow deprecated
registerAdminUsersRoutes(app, supabase, anonSupabase);
registerMVPRoutes(app, supabase, anonSupabase);
registerLeaderboardRoutes(app, supabase, anonSupabase);
registerUserProfileRoutes(app, supabase, anonSupabase);
registerDotaLookupRoutes(app, supabase, anonSupabase);
registerSteamResearchRoutes(app, supabase, anonSupabase);
registerWorkshopRoutes(app, supabase, anonSupabase);
registerStaffApplicationRoutes(app, supabase, anonSupabase);  // Must be before kkup-read so /kkup/requests wins over /kkup/:kkup_id
registerKkupReadRoutes(app, supabase, anonSupabase);       // hall-of-fame before :kkup_id
registerKkupWriteRoutes(app, supabase, anonSupabase);
registerTournamentCrudRoutes(app, supabase, anonSupabase);
registerTournamentBuilderRoutes(app, supabase, anonSupabase);
registerAdminImportRoutes(app, supabase, anonSupabase);
registerKkupToolsRoutes(app, supabase, anonSupabase);
registerCsvImportRoutes(app, supabase, anonSupabase);
registerAdminRolesRoutes(app, supabase, anonSupabase);
registerTournamentLifecycleRoutes(app, supabase, anonSupabase);
registerTeamFormationRoutes(app, supabase, anonSupabase);
registerGiveawayRoutes(app, supabase, anonSupabase);
registerGiveawayConfigRoutes(app, supabase, anonSupabase);
registerNotificationRoutes(app, supabase, anonSupabase);
registerMasterTeamsRoutes(app, supabase, anonSupabase);
registerPrintfulRoutes(app, supabase, anonSupabase);
registerStripeRoutes(app, supabase, anonSupabase);
registerConnectRoutes(app, supabase, anonSupabase);
registerPracticeTourneyRoutes(app, supabase, anonSupabase);
registerCooksNCobsRoutes(app, supabase, anonSupabase);
registerConfigRoutes(app, supabase, anonSupabase);
registerDiscordCommandsRoute(app);
registerGuildRoutes(app, supabase, anonSupabase);
registerSeasonRoutes(app, supabase, anonSupabase);
registerBracketRoutes(app, supabase, anonSupabase);

// ── Start server ──
Deno.serve(app.fetch);