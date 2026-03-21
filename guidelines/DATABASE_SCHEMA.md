# The Corn Field - Database Schema Reference

> **Last Updated:** March 17, 2026  
> **Purpose:** Complete reference for all Supabase tables, columns, relationships, and usage patterns.

---

## Table of Contents

1. [User & Auth Tables](#user--auth-tables)
2. [Tournament Core Tables](#tournament-core-tables)
3. [Team & Roster Tables](#team--roster-tables)
4. [Match & Stats Tables](#match--stats-tables)
5. [Staff & Registrations Tables](#staff--registrations-tables)
6. [Key-Value Store](#key-value-store)
7. [Foreign Key Relationships](#foreign-key-relationships)
8. [Common Query Patterns](#common-query-patterns)

---

## User & Auth Tables

### `users`
Discord-authenticated user profiles with TCF roles and rank.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | NO | Primary key |
| `supabase_id` | uuid | YES | FK to Supabase auth.users |
| `discord_id` | text | NO | Discord user ID (unique) |
| `discord_username` | text | YES | Discord display name |
| `discord_avatar` | text | YES | Discord avatar URL |
| `steam_id` | text | YES | Steam ID (for linking to kkup_persons) |
| `role` | text | NO | 'owner', 'officer', 'member' (default: 'member') |
| `rank` | integer | YES | Dota 2 rank medal (0-80) |
| `tcf_plus_active` | boolean | NO | TCF+ subscription status (default: false) |
| `created_at` | timestamptz | NO | Account creation timestamp |
| `updated_at` | timestamptz | NO | Last update timestamp |

**Indexes:**
- `discord_id` (unique)
- `steam_id` (unique, nullable)

---

## Tournament Core Tables

### `kkup_tournaments`
Tournament definitions and metadata (Kernel Kups, Heaps n Hooks, etc.)

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | NO | Primary key |
| `name` | text | NO | Tournament name (e.g., "Kernel Kup 10") |
| `slug` | text | NO | URL-safe slug (e.g., "kernel-kup-10") |
| `description` | text | YES | Tournament description |
| `start_date` | date | YES | Tournament start date |
| `end_date` | date | YES | Tournament end date |
| `status` | text | NO | 'draft', 'registration_open', 'registration_closed', 'seeding', 'live', 'completed' |
| `league_id` | integer | YES | Valve/Steam league ID (for API integration) |
| `max_teams` | integer | YES | Maximum teams allowed (typically 8) |
| `banner_url` | text | YES | Hero banner image URL |
| `icon_url` | text | YES | Tournament icon/logo URL |
| `bracket_config` | jsonb | YES | Bracket settings (best_of values per round) |
| `created_at` | timestamptz | NO | Creation timestamp |
| `updated_at` | timestamptz | NO | Last update timestamp |

**Indexes:**
- `slug` (unique)
- `status`

---

### `kkup_persons`
Steam identity records (shared across all tournaments).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | integer | NO | Primary key (auto-increment) |
| `steam_id` | text | NO | **Account ID (Steam32)** - canonical 8-10 digit format from OpenDota/Steam match data (unique) |
| `steam_name` | text | YES | Display name from Steam |
| `steam_avatar` | text | YES | Avatar URL from Steam |
| `display_name` | text | YES | Preferred display name (override) |
| `avatar_url` | text | YES | Preferred avatar URL (override) |
| `created_at` | timestamptz | NO | Creation timestamp |
| `updated_at` | timestamptz | NO | Last update timestamp |

**Indexes:**
- `steam_id` (unique)

**Steam ID Format:**  
We store **Account ID (Steam32)** format in `steam_id` (e.g., `51579950`).  
Steam has multiple ID formats for the same account:
- Account ID (Steam32): `51579950` ← **stored in database**
- Steam64: `76561198011845678` ← profile lookups
- Vanity URL: `permasnooze` ← custom profile name

Use helpers in `/supabase/functions/server/steam-id-helpers.ts` to convert between formats or normalize any input.

**Purpose:**  
Canonical player identity across all tournaments. A person appears once here, but can play in many tournaments.

---

## Team & Roster Tables

### `kkup_master_teams`
Canonical team identity across all tournaments (e.g., "Corn Dawgs" exists once).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | NO | Primary key |
| `team_name` | text | NO | Official team name |
| `team_tag` | text | NO | 2-6 character team tag (unique) |
| `logo_url` | text | YES | Team logo URL (from team_logos/ bucket) |
| `created_at` | timestamptz | NO | Creation timestamp |

**Indexes:**
- `team_tag` (unique)

---

### `kkup_teams`
Per-tournament team snapshots (a team appears once per tournament).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | NO | Primary key |
| `tournament_id` | uuid | NO | FK to kkup_tournaments |
| `master_team_id` | uuid | YES | FK to kkup_master_teams (if linked) |
| `team_name` | text | NO | Team name (snapshot for this tournament) |
| `team_tag` | text | NO | Team tag (snapshot for this tournament) |
| `captain_person_id` | integer | YES | FK to kkup_persons (team captain) |
| `approval_status` | text | NO | 'pending', 'approved', 'denied' |
| `valve_team_id` | integer | YES | Valve/Steam team ID (for API matching) |
| `logo_url` | text | YES | Team logo URL (tournament-specific) |
| `created_at` | timestamptz | NO | Creation timestamp |
| `updated_at` | timestamptz | NO | Last update timestamp |

**Indexes:**
- `tournament_id`
- `master_team_id`
- `captain_person_id`

**Purpose:**  
Captures team state for a specific tournament. Roster can change between tournaments.

---

### `kkup_team_rosters`
Per-tournament roster membership (which players are on which team).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | NO | Primary key |
| `team_id` | uuid | NO | FK to kkup_teams |
| `person_id` | integer | NO | FK to kkup_persons |
| `joined_at` | timestamptz | NO | When player joined the roster |

**Indexes:**
- `team_id`
- `person_id`
- Unique constraint: `(team_id, person_id)` - a person can only appear once per team

**Purpose:**  
Many-to-many join table between teams and persons for a specific tournament.

---

### `kkup_team_invites`
Team invite records (pending/accepted/declined).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | NO | Primary key |
| `team_id` | uuid | NO | FK to kkup_teams |
| `inviter_person_id` | integer | NO | FK to kkup_persons (who sent invite) |
| `invitee_person_id` | integer | NO | FK to kkup_persons (who received invite) |
| `status` | text | NO | 'pending', 'accepted', 'declined', 'cancelled' |
| `created_at` | timestamptz | NO | Invite sent timestamp |
| `responded_at` | timestamptz | YES | Invite response timestamp |

**Indexes:**
- `team_id`
- `invitee_person_id`
- `status`

---

### `kkup_team_placements`
Final tournament placements (1st, 2nd, 3rd, etc.) for completed tournaments.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | NO | Primary key |
| `team_id` | uuid | NO | FK to kkup_teams (unique per tournament) |
| `placement` | integer | NO | Final placement (1 = champion, 2 = runner-up, etc.) |
| `created_at` | timestamptz | NO | Placement recorded timestamp |

**Indexes:**
- `team_id` (unique)

**Purpose:**  
Stores final standings after tournament completion. Used for podium displays.

---

## Match & Stats Tables

### `kkup_matches`
Match records (CSV uploads for completed tournaments, Steam API for live).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | NO | Primary key |
| `tournament_id` | uuid | NO | FK to kkup_tournaments |
| `radiant_team_id` | uuid | YES | FK to kkup_teams (Radiant side) |
| `dire_team_id` | uuid | YES | FK to kkup_teams (Dire side) |
| `winning_team_id` | uuid | YES | FK to kkup_teams (winner) |
| `radiant_team_score` | integer | YES | Radiant kills (cosmetic) |
| `dire_team_score` | integer | YES | Dire kills (cosmetic) |
| `radiant_win` | boolean | YES | True if Radiant won |
| `match_date` | date | YES | Match date |
| `match_time` | timestamptz | YES | Match timestamp |
| `game_mode` | text | YES | Game mode (e.g., "Captains Mode") |
| `series_id` | text | YES | Groups individual games into a best-of series |
| `phase` | text | YES | Tournament phase: `'group_stage'`, `'main_event'` etc. (renamed from `bracket_round`) |
| `phase_order` | integer | YES | Sort order of phases (1=Group Stage, 2=Main Event). Controls display ordering. |
| `match_group` | text | YES | Named bracket/group within a phase: `'Upper Bracket'`, `'Group A'`, `'Grand Finals'` etc. |
| `match_group_type` | text | YES | Format: `'round_robin'`, `'single_elim'`, `'double_elim'` |
| `match_group_order` | integer | YES | Sort order within a phase (Upper Bracket=1, Lower Bracket=2, GF=3). Renamed from `bracket_position`. |
| `matchup_type` | text | YES | Series format: `'bo1'`, `'bo2'`, `'bo3'`, `'bo5'` |
| `is_final_node_group` | boolean | YES | True for Grand Finals / championship match group |
| `game_number` | integer | YES | Game 1/2/3 within a series (BO3 game 2 = 2). Links to `series_id`. |
| `match_status` | text | NO | Persistent status: `'upcoming'`, `'live'`, `'completed'` (default: `'completed'`) |
| `opendota_match_id` | bigint | YES | OpenDota/Steam match ID |
| `radiant_person_ids` | integer[] | YES | Array of person_ids for Radiant team (CSV format) |
| `dire_person_ids` | integer[] | YES | Array of person_ids for Dire team (CSV format) |
| `radiant_kills` | integer[] | YES | Array of kill counts (CSV format) |
| `radiant_deaths` | integer[] | YES | Array of death counts (CSV format) |
| `radiant_assists` | integer[] | YES | Array of assist counts (CSV format) |
| `dire_kills` | integer[] | YES | Array of kill counts (CSV format) |
| `dire_deaths` | integer[] | YES | Array of death counts (CSV format) |
| `dire_assists` | integer[] | YES | Array of assist counts (CSV format) |
| `created_at` | timestamptz | NO | Creation timestamp |

**Indexes:**
- `tournament_id`
- `radiant_team_id`
- `dire_team_id`
- `series_id`

**match_status Values:**
- `upcoming` — scheduled, hasn't started. Frontend shows scheduled time.
- `live` — actively being played. Frontend polls `GetLiveLeagueGames` for real-time game_state (draft, in-progress, etc.) — this is NOT stored in the DB.
- `completed` — done, stats recorded. Default for all historical matches.

**phase / match_group Conventions:**
```
phase_order=1  phase='group_stage'   match_group='Group A'   match_group_type='round_robin'   match_group_order=1
phase_order=1  phase='group_stage'   match_group='Group B'   match_group_type='round_robin'   match_group_order=2
phase_order=2  phase='main_event'    match_group='Upper Bracket'  match_group_type='single_elim'  match_group_order=1
phase_order=2  phase='main_event'    match_group='Lower Bracket'  match_group_type='double_elim'  match_group_order=2
phase_order=2  phase='main_event'    match_group='Grand Finals'   match_group_type='single_elim'  match_group_order=3  is_final_node_group=true
```

**game_number + series_id Pattern:**
```
series_id='s1'  game_number=1  → Game 1 of BO3 between Team A vs Team B
series_id='s1'  game_number=2  → Game 2 of BO3 between Team A vs Team B
series_id='s1'  game_number=3  → Game 3 of BO3 (if series goes to 3)
```

**Purpose:**  
Primary match data source. Arrays store player stats for CSV-imported completed matches. New structural columns (`phase`, `match_group`, `matchup_type`, etc.) power the bracket tab display and live match tracking.

---

### `kkup_player_match_stats`
Per-player per-match statistics (normalized from CSV or Steam API).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | NO | Primary key |
| `match_id` | uuid | NO | FK to kkup_matches |
| `person_id` | integer | NO | FK to kkup_persons |
| `team_id` | uuid | NO | FK to kkup_teams |
| `hero` | text | YES | Hero name (legacy - use hero_id instead) |
| `hero_id` | integer | YES | Dota 2 hero ID (canonical identifier) |
| `kills` | integer | YES | Kills in this match |
| `deaths` | integer | YES | Deaths in this match |
| `assists` | integer | YES | Assists in this match |
| `gpm` | integer | YES | Gold per minute |
| `xpm` | integer | YES | Experience per minute |
| `last_hits` | integer | YES | Last hits (creep kills) |
| `denies` | integer | YES | Denies |
| `net_worth` | integer | YES | Net worth at end of match |
| `created_at` | timestamptz | NO | Creation timestamp |

**Indexes:**
- `match_id`
- `person_id`
- `team_id`
- `hero_id`

**Purpose:**  
Normalized player stats for aggregations, leaderboards, and detailed match views. Query by `match_id` to get all players in a match.

**IMPORTANT:**  
- **NO `tournament_id` column** - filter by `match_id` instead (join via `kkup_matches.tournament_id`)
- Use `hero_id` (integer) for hero portraits, not `hero` (text name)

---

## Staff & Registrations Tables

### `kkup_registrations`
Player registrations for tournaments (before teams are formed).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | NO | Primary key |
| `tournament_id` | uuid | NO | FK to kkup_tournaments |
| `person_id` | integer | NO | FK to kkup_persons |
| `registration_type` | text | NO | 'player', 'staff', 'observer' |
| `rank` | integer | YES | Dota 2 rank at time of registration |
| `created_at` | timestamptz | NO | Registration timestamp |

**Indexes:**
- `tournament_id`
- `person_id`
- Unique constraint: `(tournament_id, person_id)` - one registration per person per tournament

---

### `kkup_staff_applications`
Staff/volunteer applications (pending officer review).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | NO | Primary key |
| `tournament_id` | uuid | NO | FK to kkup_tournaments |
| `person_id` | integer | NO | FK to kkup_persons |
| `discord_username` | text | YES | Applicant's Discord name |
| `preferred_role` | text | YES | Preferred staff role |
| `experience` | text | YES | Past experience description |
| `status` | text | NO | 'pending', 'approved', 'denied' |
| `created_at` | timestamptz | NO | Application timestamp |
| `reviewed_at` | timestamptz | YES | Review timestamp |
| `reviewed_by` | uuid | YES | FK to users (officer who reviewed) |

**Indexes:**
- `tournament_id`
- `status`

**Purpose:**  
Pending applications show in Officer Inbox. After approval, staff is added to `kkup_tournament_staff`.

---

### `kkup_tournament_staff`
Approved staff members with roles and assignments.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | uuid | NO | Primary key |
| `tournament_id` | uuid | NO | FK to kkup_tournaments |
| `person_id` | integer | NO | FK to kkup_persons |
| `role` | text | NO | 'admin', 'lobby_host', 'caster', 'observer', 'producer' |
| `stream_assignment` | text | YES | 'A', 'B', 'C' (which stream they work) |
| `created_at` | timestamptz | NO | Assignment timestamp |

**Indexes:**
- `tournament_id`
- `person_id`

**Purpose:**  
Source of truth for "who actually staffed this tournament" - used for tournament roster displays.

---

## Key-Value Store

### `kv_store_4789f4af`
Key-value storage for ephemeral data (notifications, activity logs, admin logs).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `key` | text | NO | Primary key (e.g., `notification:user_id:timestamp`) |
| `value` | jsonb | NO | JSON blob |
| `created_at` | timestamptz | NO | Creation timestamp |

**Indexes:**
- `key` (primary key)
- `created_at` (for TTL cleanup)

**Key Patterns:**
- `notification:{user_id}:{sortable_id}` - User notifications
- `user_activity:{user_id}:{sortable_id}` - User activity log
- `admin_log:{sortable_id}` - Officer admin activity log

**Purpose:**  
Ephemeral data that doesn't need structured queries. Auto-pruned based on TTL and row count limits.

---

## Foreign Key Relationships

```
users
  ├─→ steam_id links to kkup_persons.steam_id (soft FK)
  └─→ supabase_id links to auth.users.id

kkup_tournaments
  ├─→ kkup_teams (tournament_id)
  ├─→ kkup_matches (tournament_id)
  ├─→ kkup_registrations (tournament_id)
  ├─→ kkup_staff_applications (tournament_id)
  └─→ kkup_tournament_staff (tournament_id)

kkup_master_teams
  └─→ kkup_teams (master_team_id)

kkup_teams
  ├─→ kkup_team_rosters (team_id)
  ├─→ kkup_team_invites (team_id)
  ├─→ kkup_team_placements (team_id)
  ├─→ kkup_matches (radiant_team_id / dire_team_id / winning_team_id)
  └─→ kkup_player_match_stats (team_id)

kkup_persons
  ├─→ kkup_teams (captain_person_id)
  ├─→ kkup_team_rosters (person_id)
  ├─→ kkup_team_invites (inviter_person_id / invitee_person_id)
  ├─→ kkup_registrations (person_id)
  ├─→ kkup_staff_applications (person_id)
  ├─→ kkup_tournament_staff (person_id)
  └─→ kkup_player_match_stats (person_id)

kkup_matches
  └─→ kkup_player_match_stats (match_id)
```

---

## Common Query Patterns

### Get all teams for a tournament
```sql
SELECT * FROM kkup_teams 
WHERE tournament_id = 'abc-123' 
ORDER BY created_at;
```

### Get roster for a team (with player details)
```sql
SELECT 
  r.team_id,
  r.person_id,
  p.steam_name,
  p.steam_avatar
FROM kkup_team_rosters r
JOIN kkup_persons p ON r.person_id = p.id
WHERE r.team_id = 'team-uuid';
```

### Get all matches for a tournament
```sql
SELECT * FROM kkup_matches 
WHERE tournament_id = 'abc-123' 
ORDER BY match_date, match_time;
```

### Get player stats for a specific match
```sql
SELECT 
  s.*,
  p.steam_name,
  p.steam_avatar
FROM kkup_player_match_stats s
JOIN kkup_persons p ON s.person_id = p.id
WHERE s.match_id = 'match-uuid';
```

### Get hero picks for a tournament (via matches)
```sql
-- Step 1: Get match IDs
SELECT id FROM kkup_matches WHERE tournament_id = 'abc-123';

-- Step 2: Get hero stats (requires match_id filter, NOT tournament_id)
SELECT hero_id, COUNT(*) as pick_count
FROM kkup_player_match_stats
WHERE match_id IN (SELECT id FROM kkup_matches WHERE tournament_id = 'abc-123')
  AND hero_id IS NOT NULL
GROUP BY hero_id
ORDER BY pick_count DESC;
```

### Get aggregated player stats for a tournament
```sql
SELECT 
  s.person_id,
  p.steam_name,
  COUNT(DISTINCT s.match_id) as total_matches,
  SUM(s.kills) as total_kills,
  SUM(s.deaths) as total_deaths,
  SUM(s.assists) as total_assists,
  AVG(s.gpm)::int as avg_gpm,
  AVG(s.xpm)::int as avg_xpm
FROM kkup_player_match_stats s
JOIN kkup_persons p ON s.person_id = p.id
WHERE s.match_id IN (SELECT id FROM kkup_matches WHERE tournament_id = 'abc-123')
GROUP BY s.person_id, p.steam_name
ORDER BY total_kills DESC;
```

### Get pending staff applications (for Officer Inbox)
```sql
SELECT COUNT(*) FROM kkup_staff_applications 
WHERE status = 'pending';
```

---

## Critical Notes

### ⚠️ `kkup_player_match_stats` Has NO `tournament_id`
Always filter by `match_id` using a subquery or join via `kkup_matches.tournament_id`.

**WRONG:**
```sql
SELECT * FROM kkup_player_match_stats WHERE tournament_id = 'abc-123'; -- ❌ Column doesn't exist
```

**RIGHT:**
```sql
SELECT * FROM kkup_player_match_stats 
WHERE match_id IN (SELECT id FROM kkup_matches WHERE tournament_id = 'abc-123'); -- ✅
```

### Use `hero_id` (integer), Not `hero` (text)
The `hero` column is legacy and may contain inconsistent names. Always use `hero_id` for hero portraits and filtering.

### CSV Data Is Source of Truth for Completed Tournaments
Completed tournaments (KK1-9) use CSV uploads as the primary data source. Steam API is only for enrichment or live tournaments.

---

## Adding New Tables

When adding a new table:
1. **Agree on schema in conversation** (column names, types, constraints, FKs)
2. **AI provides CREATE TABLE SQL** (not written to file)
3. **Tate runs SQL in Supabase SQL Editor**
4. **Update this document** with the new table definition

---

**End of Schema Reference**