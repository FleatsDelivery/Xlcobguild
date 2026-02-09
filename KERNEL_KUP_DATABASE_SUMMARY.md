# Kernel Kup Database Schema Summary 🌽🏆

## Overview
This document tracks the current state of the Kernel Kup database schema, what data we're capturing, and what's planned for the future.

---

## Current Tables

### 1. `kernel_kups` (Tournaments)
Main tournament table with metadata about each Kernel Kup event.

**Fields:**
- `id` - UUID primary key
- `name` - Tournament name (e.g., "Kernel Kup 5")
- `year` - Year (e.g., 2024)
- `status` - 'upcoming' | 'ongoing' | 'completed'
- `league_id` - OpenDota/Valve league ID
- `prize_pool` - Total prize pool amount
- `cover_photo_url` - Hero image for tournament
- `created_at`, `updated_at` - Timestamps

---

### 2. `kkup_teams` (Teams per Tournament)
Teams are **tournament-specific**. Same players can be on different teams across different Kernel Kups.

**Fields:**
- `id` - UUID primary key
- `kernel_kup_id` - FK to `kernel_kups`
- `name` - Team name (e.g., "Team Secret", "Team Arteezy")
- `tag` - Team tag (e.g., "TS", "EG")
- `valve_team_id` - Valve's official team ID (if professional team)
- `logo_url` - Team logo
- `wins`, `losses` - Win/loss record for this tournament
- `created_at` - Timestamp

**Key Insight:** Teams are unique per tournament! Player rosters can change between Kernel Kups.

---

### 3. `kkup_player_profiles` (Global Player Registry)
**Master list** of ALL players who have EVER played in a Kernel Kup. Players appear once here, even if they've played in multiple tournaments.

**Fields:**
- `id` - UUID primary key
- `user_id` - FK to `users` (nullable) - Links XLCOB account to Kernel Kup profile
- `player_name` - In-game name
- `steam_id` - Steam account ID (unique)
- `opendota_id` - OpenDota account ID
- `dotabuff_url` - Dotabuff profile link
- `opendota_url` - OpenDota profile link
- `avatar_url` - Steam avatar
- **Aggregate Stats:**
  - `total_tournaments_played`
  - `total_matches_played`
  - `total_wins`, `total_losses`
  - `total_kills`, `total_deaths`, `total_assists`
- `created_at`, `updated_at` - Timestamps

**Key Insight:** This is our "Hall of Fame" table. One player = one profile, even across 10+ Kernel Kups!

---

### 4. `kkup_team_players` (Tournament-Specific Rosters)
Links players to teams **for a specific tournament**.

**Fields:**
- `id` - UUID primary key
- `team_id` - FK to `kkup_teams` (which is already tournament-specific)
- `player_profile_id` - FK to `kkup_player_profiles`
- `created_at` - Timestamp

**Example:**
- Kernel Kup 5: Player "Arteezy" on "Team Secret"
- Kernel Kup 6: Player "Arteezy" on "Team EG"
- Same player profile, different team assignments!

---

### 5. `kkup_matches` (Match Results)
Individual matches within a tournament (group stage, playoffs, finals, etc.)

**Fields:**
- `id` - UUID primary key
- `kernel_kup_id` - FK to `kernel_kups`
- `team1_id`, `team2_id` - FKs to `kkup_teams`
- `stage` - 'group_stage' | 'playoffs' | 'finals' | 'grandfinals'
- `status` - 'scheduled' | 'live' | 'completed'
- `team1_score`, `team2_score` - Final scores (typically 1-0 for single games)
- `winner_team_id` - FK to `kkup_teams` (nullable if not completed)
- `match_id` - Valve/Dotabuff match ID (for linking to external sites)
- `dotabuff_url` - Direct link to Dotabuff match
- `vod_url` - Twitch/YouTube VOD link
- `scheduled_time` - When match was played
- `created_at` - Timestamp

---

### 6. `kkup_match_player_stats` (Detailed Player Performance)
Individual player stats **per match** (kills, deaths, assists, hero picks, items, etc.)

**Fields:**
- `id` - UUID primary key
- `match_id` - FK to `kkup_matches`
- `player_profile_id` - FK to `kkup_player_profiles`
- `team_id` - FK to `kkup_teams` (nullable)
- `player_name` - In-game name (denormalized for quick access)
- `steam_id` - Steam ID (denormalized)

**Match Performance:**
- `hero_id`, `hero_name` - Hero played
- `position_played` - Lane role (1-5)
- `is_winner` - Boolean

**Core Stats:**
- `kills`, `deaths`, `assists` - KDA
- `last_hits`, `denies` - Farming stats
- `gpm` - Gold per minute
- `xpm` - Experience per minute

**Advanced Stats:**
- `hero_damage`, `tower_damage`, `hero_healing` - Combat stats
- `level` - Final level reached
- `gold`, `net_worth` - Economy
- `observer_uses`, `sentry_uses` - Support stats
- `item_0` through `item_5` - Final item build (item IDs)
- `backpack_0` through `backpack_2` - Backpack items
- `item_neutral` - Neutral item

**Match Details:**
- `game_duration_seconds` - Match length
- `dotabuff_match_id` - Valve match ID
- `created_at` - Timestamp

**Unique Constraint:** One player can only appear once per match.

---

### 7. `user_kkup_achievements` (Trophies & Awards) 🏆🍿
Tracks achievements, trophies, and awards earned by users across all Kernel Kups.

**Fields:**
- `id` - UUID primary key
- `user_id` - FK to `users` (REQUIRED - must be linked to XLCOB account)
- `achievement_type` - Type of achievement:
  - `'kernel_kup_champion'` - Won the tournament (winged Kernel Kup trophy)
  - `'popd_kernel_mvp'` - MVP award (golden popcorn trophy)
  - `'runner_up'` - Second place
  - `'most_kills'`, `'most_assists'`, etc. - Future stat-based awards
- `kernel_kup_id` - FK to `kernel_kups` (which Kernel Kup was this for?)
- `metadata` - JSONB for extensibility (e.g., `{ "hero_played": "Pudge", "kills": 25 }`)
- `awarded_at` - When trophy was given
- `awarded_by` - FK to `users` (nullable) - Admin who manually awarded it

**Unique Constraint:** User can't win the same achievement for the same tournament twice.

**Trophy Stacking:** Users can win multiple trophies across different Kernel Kups (Battle Cup style!)

---

## Tournament Builder: What Data We Capture

When you click **"Import from OpenDota"**, the system:

1. **Fetches matches** via OpenDota API `/api/leagues/{league_id}/matches`
2. **For each match**, fetches detailed data via `/api/matches/{match_id}`
3. **Creates/updates:**
   - Teams (with logos, tags, Valve IDs)
   - Player profiles (with Steam IDs, names, avatars)
   - Match records (scores, winners, timestamps)
   - **FULL player stats** (kills, deaths, assists, GPM, XPM, hero damage, items, etc.)

### What OpenDota Gives Us (That We Capture):
✅ Player KDA (kills, deaths, assists)
✅ Hero picks (hero_id, hero_name)
✅ Economy (GPM, XPM, net worth, gold)
✅ Combat stats (hero damage, tower damage, hero healing)
✅ Farming (last hits, denies)
✅ Items (all 6 items + backpack + neutral)
✅ Support stats (observer wards, sentry wards)
✅ Match duration
✅ Winner/loser status
✅ Team assignments (Radiant/Dire)

### What We DON'T Capture (Yet):
❌ Runes picked up
❌ Camps stacked
❌ Skill builds / ability upgrades
❌ Buyback status
❌ Specific timestamps (first blood, game events)

**Why?** We're capturing the essentials for tournament stats, leaderboards, and player profiles. Advanced analytics can be added later if needed!

---

## Upcoming Features

### 1. **Kernel Kup Hall of Fame** (All Participants Page)
- List ALL players across ALL Kernel Kups
- Show total tournaments played, championships won, lifetime KDA
- Most played heroes
- Click player → see their Kernel Kup history

### 2. **User Profile Integration**
- Link `kkup_player_profiles.user_id` → `users.id`
- Display Kernel Kup achievements on user cards
- Trophy badges (stacking style, Battle Cup vibe)
- "Participated in KKup 5, 6, 7" badges

### 3. **Admin Achievement Panel**
- Manually award `kernel_kup_champion` trophies
- Manually award `popd_kernel_mvp` golden popcorn
- For KKups 1-3, 8-9 where data is sparse
- For KKups 4-7, 10+ awards can be automated based on tournament results

### 4. **Tournament Result Finalization**
- After Tournament Builder import, review matches
- Click "Finalize Tournament" → auto-award `kernel_kup_champion` to winning team's players
- Admin can then manually award `popd_kernel_mvp` to MVP

---

## Migration Files

Run these in **Supabase Dashboard → SQL Editor** in order:

1. `001_kernel_kup_schema.sql` - Core tournament/team/match tables
2. `002_kernel_kup_player_stats_fixed.sql` - Player profiles & stats
3. `003_add_prize_pool_and_cover.sql` - Prize pool & cover photo
4. `004_user_kkup_achievements.sql` - Achievements/trophies system **← NEW!**
5. `005_add_advanced_player_stats.sql` - Additional player stat fields **← NEW!**

---

## Notes for Future KKup Imports

- **KKup 1, 2, 3, 8, 9:** Sparse data, manual trophy awards via admin panel
- **KKup 4, 5, 6, 7, 10+:** Full OpenDota import with automatic stats

**Current Focus:** Perfect the import flow for KKup 5 (has the most data), then replicate for 4, 6, 7, 8, 9.

Once all historical data is imported, we can:
- Build the Hall of Fame page
- Link Kernel Kup players → XLCOB users
- Award trophies retroactively
- Display achievements on user profiles

🌽 **Let's gooooo!** 🌽
