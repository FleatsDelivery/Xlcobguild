/**
 * Routes: App Configuration
 *
 * KV-backed config values that officers can tweak at runtime.
 * Currently supports: max player rank for tournament eligibility.
 */
import type { Hono } from "npm:hono";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { PREFIX } from "./helpers.ts";
import { isOfficer } from "./roles.ts";
import * as kv from "./kv_store.tsx";

// ── Defaults ────────────────────────────────────────────────
// Numeric rank scale: Herald 1 = 1, Divine 1 = 31, Immortal = 36
export const DEFAULT_MAX_PLAYER_RANK = 31; // Divine 1
export const DEFAULT_MIN_PLAYER_RANK = 1;  // Herald 1

const CONFIG_KEY_MAX = "config:max_player_rank";
const CONFIG_KEY_MIN = "config:min_player_rank";

// ── Shared getters (used by other route modules) ─────────────
/**
 * Read the current max player rank from KV, falling back to the default.
 * Returns a numeric value on the 1–36 scale.
 */
export async function getMaxPlayerRank(): Promise<number> {
  try {
    const stored = await kv.get(CONFIG_KEY_MAX);
    if (stored !== null && stored !== undefined) {
      const parsed = typeof stored === "number" ? stored : Number(stored);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 36) return parsed;
    }
  } catch (err) {
    console.error("Non-critical: failed to read max_player_rank from KV:", err);
  }
  return DEFAULT_MAX_PLAYER_RANK;
}

/**
 * Read the current min player rank from KV, falling back to the default.
 * Returns a numeric value on the 1–36 scale.
 */
export async function getMinPlayerRank(): Promise<number> {
  try {
    const stored = await kv.get(CONFIG_KEY_MIN);
    if (stored !== null && stored !== undefined) {
      const parsed = typeof stored === "number" ? stored : Number(stored);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 36) return parsed;
    }
  } catch (err) {
    console.error("Non-critical: failed to read min_player_rank from KV:", err);
  }
  return DEFAULT_MIN_PLAYER_RANK;
}

// ── Medal helpers (server-side, mirrors frontend rank-utils) ─
const MEDAL_ORDER = [
  "Herald",
  "Guardian",
  "Crusader",
  "Archon",
  "Legend",
  "Ancient",
  "Divine",
  "Immortal",
] as const;

function numericToRank(value: number): { medal: string; stars: number } {
  if (value <= 0) return { medal: "Unranked", stars: 0 };
  if (value >= 36) return { medal: "Immortal", stars: 0 };
  const clamped = Math.max(1, Math.min(35, Math.round(value)));
  const tierIndex = Math.floor((clamped - 1) / 5);
  const stars = ((clamped - 1) % 5) + 1;
  return { medal: MEDAL_ORDER[tierIndex], stars };
}

function rankToNumeric(medal: string, stars: number): number {
  const tierIndex = MEDAL_ORDER.indexOf(medal as any);
  if (tierIndex === -1) return 0;
  if (medal === "Immortal") return 36;
  return tierIndex * 5 + Math.max(1, Math.min(5, stars));
}

// ── Route Registration ──────────────────────────────────────
export function registerConfigRoutes(
  app: Hono,
  supabase: SupabaseClient,
  _anonSupabase: SupabaseClient,
) {
  // GET /config/max-player-rank — public, no auth required
  app.get(`${PREFIX}/config/max-player-rank`, async (c) => {
    try {
      const numeric = await getMaxPlayerRank();
      const { medal, stars } = numericToRank(numeric);
      return c.json({
        numeric,
        medal,
        stars,
        display: medal === "Immortal" ? "Immortal" : `${medal} ${stars}`,
      });
    } catch (err) {
      console.error("Error reading max-player-rank config:", err);
      return c.json({ error: `Failed to read max player rank config: ${err}` }, 500);
    }
  });

  // PUT /config/max-player-rank — officer-protected
  app.put(`${PREFIX}/config/max-player-rank`, async (c) => {
    try {
      // Auth check
      const accessToken = c.req.header("Authorization")?.split(" ")[1];
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(accessToken);
      if (!user?.id || authError) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      // Role check
      const { data: dbUser } = await supabase
        .from("users")
        .select("role, discord_username")
        .eq("id", user.id)
        .single();
      if (!dbUser || !isOfficer(dbUser.role)) {
        return c.json({ error: "Forbidden: officer role required" }, 403);
      }

      const body = await c.req.json();

      // Accept either { numeric } or { medal, stars }
      let numeric: number;
      if (typeof body.numeric === "number") {
        numeric = body.numeric;
      } else if (body.medal && typeof body.stars === "number") {
        numeric = rankToNumeric(body.medal, body.stars);
      } else {
        return c.json(
          { error: "Provide either { numeric } (1-36) or { medal, stars }" },
          400,
        );
      }

      if (numeric < 1 || numeric > 36) {
        return c.json({ error: "Numeric rank must be between 1 (Herald 1) and 36 (Immortal)" }, 400);
      }

      await kv.set(CONFIG_KEY_MAX, numeric);

      const { medal, stars } = numericToRank(numeric);
      const display = medal === "Immortal" ? "Immortal" : `${medal} ${stars}`;

      console.log(
        `Config updated: max_player_rank set to ${display} (${numeric}) by ${dbUser.discord_username}`,
      );

      return c.json({
        numeric,
        medal,
        stars,
        display,
        updated_by: dbUser.discord_username,
      });
    } catch (err) {
      console.error("Error updating max-player-rank config:", err);
      return c.json({ error: `Failed to update max player rank config: ${err}` }, 500);
    }
  });

  // ── Combined rank eligibility endpoints (min + max) ──

  // GET /config/rank-eligibility — public, returns both min and max
  app.get(`${PREFIX}/config/rank-eligibility`, async (c) => {
    try {
      const [minNumeric, maxNumeric] = await Promise.all([
        getMinPlayerRank(),
        getMaxPlayerRank(),
      ]);
      const minRank = numericToRank(minNumeric);
      const maxRank = numericToRank(maxNumeric);
      return c.json({
        min: {
          numeric: minNumeric,
          medal: minRank.medal,
          stars: minRank.stars,
          display: minRank.medal === "Immortal" ? "Immortal" : `${minRank.medal} ${minRank.stars}`,
        },
        max: {
          numeric: maxNumeric,
          medal: maxRank.medal,
          stars: maxRank.stars,
          display: maxRank.medal === "Immortal" ? "Immortal" : `${maxRank.medal} ${maxRank.stars}`,
        },
      });
    } catch (err) {
      console.error("Error reading rank-eligibility config:", err);
      return c.json({ error: `Failed to read rank eligibility config: ${err}` }, 500);
    }
  });

  // PUT /config/rank-eligibility — officer-protected, updates both min and max
  app.put(`${PREFIX}/config/rank-eligibility`, async (c) => {
    try {
      const accessToken = c.req.header("Authorization")?.split(" ")[1];
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser(accessToken);
      if (!user?.id || authError) {
        return c.json({ error: "Unauthorized" }, 401);
      }

      const { data: dbUser } = await supabase
        .from("users")
        .select("role, discord_username")
        .eq("id", user.id)
        .single();
      if (!dbUser || !isOfficer(dbUser.role)) {
        return c.json({ error: "Forbidden: officer role required" }, 403);
      }

      const body = await c.req.json();
      const { min_numeric, max_numeric } = body;

      if (typeof min_numeric !== "number" || typeof max_numeric !== "number") {
        return c.json({ error: "Provide { min_numeric, max_numeric } (1-36)" }, 400);
      }
      if (min_numeric < 1 || min_numeric > 36 || max_numeric < 1 || max_numeric > 36) {
        return c.json({ error: "Numeric rank must be between 1 (Herald 1) and 36 (Immortal)" }, 400);
      }
      if (min_numeric > max_numeric) {
        return c.json({ error: "Minimum rank cannot be higher than maximum rank" }, 400);
      }

      await kv.set(CONFIG_KEY_MIN, min_numeric);
      await kv.set(CONFIG_KEY_MAX, max_numeric);

      const minRank = numericToRank(min_numeric);
      const maxRank = numericToRank(max_numeric);
      const minDisplay = minRank.medal === "Immortal" ? "Immortal" : `${minRank.medal} ${minRank.stars}`;
      const maxDisplay = maxRank.medal === "Immortal" ? "Immortal" : `${maxRank.medal} ${maxRank.stars}`;

      console.log(
        `Config updated: rank eligibility set to ${minDisplay} – ${maxDisplay} by ${dbUser.discord_username}`,
      );

      return c.json({
        min: { numeric: min_numeric, medal: minRank.medal, stars: minRank.stars, display: minDisplay },
        max: { numeric: max_numeric, medal: maxRank.medal, stars: maxRank.stars, display: maxDisplay },
        updated_by: dbUser.discord_username,
      });
    } catch (err) {
      console.error("Error updating rank-eligibility config:", err);
      return c.json({ error: `Failed to update rank eligibility config: ${err}` }, 500);
    }
  });
}