-- ============================================================================
-- KERNEL KUP SCHEMA — PHASE 1: CREATE ALL 7 TABLES
-- ============================================================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- 
-- This script is idempotent-ish: it uses IF NOT EXISTS on table creation,
-- but will fail on duplicate constraints/indexes if run twice. To fully
-- re-run, drop the tables first (see bottom of file for DROP script).
--
-- Table creation order handles FK dependencies:
--   1. kkup_persons          (no FKs to other new tables)
--   2. kkup_tournaments      (FKs to kkup_persons only — no winning_team yet)
--   3. kkup_tournament_staff (FKs to tournaments + persons)
--   4. kkup_teams            (FKs to tournaments + persons)
--   5. kkup_team_rosters     (FKs to teams + persons)
--   6. kkup_matches          (FKs to tournaments + teams + persons)
--   7. kkup_player_match_stats (FKs to matches + persons + teams)
--   8. ALTER TABLE to add winning_team_id FK (circular ref resolved)
--   9. Performance indexes
-- ============================================================================


-- ============================================================================
-- 1. kkup_persons — ONE ROW PER UNIQUE HUMAN
-- ============================================================================
-- Keyed by steam_id (TEXT, not numeric — handles edge cases like "permasnooze")
-- A person can be a player, staff, captain, coach, or any combination across
-- tournaments. Roles are tracked on OTHER tables, not here.
-- tournaments_won and prize_money_won are the only stored aggregates (per design).
-- ============================================================================
CREATE TABLE IF NOT EXISTS kkup_persons (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    steam_id          TEXT NOT NULL UNIQUE,
    display_name      TEXT NOT NULL,
    avatar_url        TEXT,
    tournaments_won   INTEGER NOT NULL DEFAULT 0,
    prize_money_won   NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE kkup_persons IS 'One row per unique human in the KKUP system. steam_id is the bridge to the users table (users.steam_id = kkup_persons.steam_id).';
COMMENT ON COLUMN kkup_persons.steam_id IS 'Dota 2 Steam ID (account_id). TEXT because some staff have non-numeric IDs (e.g. "permasnooze").';
COMMENT ON COLUMN kkup_persons.tournaments_won IS 'Stored aggregate: total tournaments won as a player. Updated by uploader.';
COMMENT ON COLUMN kkup_persons.prize_money_won IS 'Stored aggregate: total prize money won. Updated by uploader.';


-- ============================================================================
-- 2. kkup_tournaments — ONE ROW PER TOURNAMENT (KK1–KK9)
-- ============================================================================
-- winning_team_id FK is added LATER via ALTER TABLE (circular dep with kkup_teams).
-- popd_kernel FKs point to kkup_persons.
-- Count columns (staff_count, team_count, etc.) are denormalized convenience
-- fields from the overview CSVs — nullable because summary CSV has nulls.
-- ============================================================================
CREATE TABLE IF NOT EXISTS kkup_tournaments (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id                   TEXT,
    name                        TEXT NOT NULL,
    tournament_type             TEXT NOT NULL
                                    CHECK (tournament_type IN ('kernel_kup', 'heaps_n_hooks')),
    status                      TEXT NOT NULL DEFAULT 'upcoming'
                                    CHECK (status IN ('upcoming', 'registration', 'active', 'completed', 'archived')),
    description                 TEXT,
    registration_start_date     DATE,
    registration_end_date       DATE,
    tournament_start_date       DATE,
    tournament_end_date         DATE,
    youtube_url                 TEXT,
    twitch_url_1                TEXT,
    twitch_url_2                TEXT,

    -- Circular FK — column created now, FK constraint added in step 8
    winning_team_id             UUID,
    winning_team_name           TEXT,

    -- P.O.P.D. Kernel awards (FK to kkup_persons)
    popd_kernel_1_person_id     UUID REFERENCES kkup_persons(id),
    popd_kernel_2_person_id     UUID REFERENCES kkup_persons(id),

    -- Denormalized counts from overview CSV (nullable — summary rows have nulls)
    staff_count                 INTEGER,
    team_count                  INTEGER,
    player_count                INTEGER,
    match_count                 INTEGER,
    player_match_stats_count    INTEGER,

    prize_pool                  NUMERIC(10, 2) NOT NULL DEFAULT 0,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE kkup_tournaments IS 'One row per Kernel Kup tournament (KK1–KK9). tournament_type distinguishes standard 5v5 (kernel_kup) from special formats like 1v1 Pudge (heaps_n_hooks).';
COMMENT ON COLUMN kkup_tournaments.league_id IS 'Valve league ID. NULL for KK1, KK2, KK3 (pre-ticketed era).';
COMMENT ON COLUMN kkup_tournaments.winning_team_name IS 'Denormalized for quick display. Canonical source is the winning_team_id FK.';


-- ============================================================================
-- 3. kkup_tournament_staff — WHO WORKED EACH TOURNAMENT
-- ============================================================================
-- Handles dual-role instances (e.g., Mavi as both Producer AND player) because
-- a person's staff role is separate from their player/captain/coach role.
-- The UNIQUE constraint allows the same person to have different roles in the
-- same tournament (e.g., Caster + Producer), but prevents duplicate entries.
-- ============================================================================
CREATE TABLE IF NOT EXISTS kkup_tournament_staff (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id   UUID NOT NULL REFERENCES kkup_tournaments(id) ON DELETE CASCADE,
    person_id       UUID NOT NULL REFERENCES kkup_persons(id) ON DELETE CASCADE,
    role            TEXT NOT NULL,

    UNIQUE(tournament_id, person_id, role)
);

COMMENT ON TABLE kkup_tournament_staff IS 'Staff assignments per tournament. Role is free-text (Caster, Producer, etc.). Same person can have multiple roles in one tournament.';


-- ============================================================================
-- 4. kkup_teams — ONE ROW PER TEAM PER TOURNAMENT
-- ============================================================================
-- This is NOT a "unique teams" table. "Eat A Frosted Donut" in KK3 and KK4
-- are two separate rows with different UUIDs, different rosters, potentially
-- different captains.
--
-- valve_team_id is nullable because some teams don't have Valve team IDs
-- (e.g., "Elliott Jewelers" in KK2, several KK9 1v1 teams).
-- Auto-generated UUIDs serve as the canonical identifier.
--
-- team_name is NOT unique within a tournament (per design decision).
-- ============================================================================
CREATE TABLE IF NOT EXISTS kkup_teams (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id       UUID NOT NULL REFERENCES kkup_tournaments(id) ON DELETE CASCADE,
    valve_team_id       TEXT,
    team_name           TEXT NOT NULL,
    team_tag            TEXT,
    captain_person_id   UUID REFERENCES kkup_persons(id),
    coach_person_id     UUID REFERENCES kkup_persons(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE kkup_teams IS 'One row per team per tournament. Same org across tournaments = separate rows. valve_team_id is the Valve/Dota team ID (nullable for teams without one).';
COMMENT ON COLUMN kkup_teams.valve_team_id IS 'Valve team ID from Dota 2. NULL for teams that were never registered in-client. TEXT to match steam_id convention.';
COMMENT ON COLUMN kkup_teams.coach_person_id IS 'Currently NULL across all KK1–KK9 data. Column exists for future tournaments.';


-- ============================================================================
-- 5. kkup_team_rosters — WHO PLAYED ON WHICH TEAM
-- ============================================================================
-- Purely "this person was on this team's roster."
-- Because kkup_teams is already per-tournament, this is inherently
-- per-team-per-tournament without needing a tournament_id column.
-- Captain/coach info lives on kkup_teams, not here.
-- ============================================================================
CREATE TABLE IF NOT EXISTS kkup_team_rosters (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id     UUID NOT NULL REFERENCES kkup_teams(id) ON DELETE CASCADE,
    person_id   UUID NOT NULL REFERENCES kkup_persons(id) ON DELETE CASCADE,

    UNIQUE(team_id, person_id)
);

COMMENT ON TABLE kkup_team_rosters IS 'Roster membership: which persons were on which team. Scoped per-tournament via team_id FK (kkup_teams is one-row-per-tournament).';


-- ============================================================================
-- 6. kkup_matches — UNIFIED MATCH TABLE (5v5 + 1v1)
-- ============================================================================
-- Handles both standard 5v5 (KK1–KK8) and 1v1 Pudge (KK9) formats.
--
-- external_match_id is TEXT because fake IDs exist (KK1: "991", KK2: "991",
-- KK3: "991"–"994", KK9: "991"–"910"). Real Dota match IDs coexist.
-- UNIQUE on (tournament_id, external_match_id) prevents dupes within a tournament.
--
-- radiant_person_id / dire_person_id are only populated for 1v1 format (KK9).
-- For 5v5, player info comes from kkup_player_match_stats.
-- ============================================================================
CREATE TABLE IF NOT EXISTS kkup_matches (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id           UUID NOT NULL REFERENCES kkup_tournaments(id) ON DELETE CASCADE,
    series_id               TEXT,
    external_match_id       TEXT NOT NULL,
    game_mode               TEXT,

    -- Team sides (always populated)
    radiant_team_id         UUID REFERENCES kkup_teams(id),
    radiant_team_score      INTEGER,
    dire_team_id            UUID REFERENCES kkup_teams(id),
    dire_team_score         INTEGER,

    -- 1v1 player sides (only populated for heaps_n_hooks / 1v1 format)
    radiant_person_id       UUID REFERENCES kkup_persons(id),
    dire_person_id          UUID REFERENCES kkup_persons(id),

    -- Match metadata
    match_length            INTEGER,
    match_time              TEXT,
    match_date              DATE,
    winning_team_id         UUID REFERENCES kkup_teams(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(tournament_id, external_match_id)
);

COMMENT ON TABLE kkup_matches IS 'One row per match across all tournaments. Unified schema handles both 5v5 and 1v1 formats.';
COMMENT ON COLUMN kkup_matches.external_match_id IS 'Dota 2 match ID or synthetic/fake ID. TEXT because fake IDs like "991" exist in KK1/KK2/KK3/KK9.';
COMMENT ON COLUMN kkup_matches.series_id IS 'Groups matches that belong to the same series (e.g., Bo3 grand finals in KK9).';
COMMENT ON COLUMN kkup_matches.match_length IS 'Duration in seconds.';
COMMENT ON COLUMN kkup_matches.match_time IS 'Time-of-day string from CSV (e.g., "9:34 PM"). NULL for some matches.';
COMMENT ON COLUMN kkup_matches.radiant_person_id IS 'Only populated for 1v1 formats (KK9 heaps_n_hooks). NULL for standard 5v5.';
COMMENT ON COLUMN kkup_matches.dire_person_id IS 'Only populated for 1v1 formats (KK9 heaps_n_hooks). NULL for standard 5v5.';


-- ============================================================================
-- 7. kkup_player_match_stats — PER-PLAYER PER-MATCH PERFORMANCE
-- ============================================================================
-- One row per player per match. For 5v5, that's ~10 rows per match.
-- For 1v1, that's 2 rows per match.
--
-- hero is stored as display name (e.g., "Phantom Assassin", "Pudge").
-- Nullable stat columns handle KK1 match 991 where only K/D/A/NW were recorded.
-- ============================================================================
CREATE TABLE IF NOT EXISTS kkup_player_match_stats (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id    UUID NOT NULL REFERENCES kkup_matches(id) ON DELETE CASCADE,
    person_id   UUID NOT NULL REFERENCES kkup_persons(id) ON DELETE CASCADE,
    team_id     UUID NOT NULL REFERENCES kkup_teams(id) ON DELETE CASCADE,
    hero        TEXT,
    kills       INTEGER NOT NULL DEFAULT 0,
    deaths      INTEGER NOT NULL DEFAULT 0,
    assists     INTEGER NOT NULL DEFAULT 0,
    net_worth   INTEGER,
    last_hits   INTEGER,
    denies      INTEGER,
    gpm         INTEGER,
    xpm         INTEGER,

    UNIQUE(match_id, person_id)
);

COMMENT ON TABLE kkup_player_match_stats IS 'Per-player per-match stats. ~810 total rows across KK1–KK9. Nullable columns handle incomplete data from early tournaments.';
COMMENT ON COLUMN kkup_player_match_stats.hero IS 'Hero display name (e.g., "Phantom Assassin"). Stored as-is from CSV.';


-- ============================================================================
-- 8. ADD CIRCULAR FK: kkup_tournaments.winning_team_id → kkup_teams
-- ============================================================================
-- Now that kkup_teams exists, we can add the FK constraint on the column
-- that was already created (but unconstrained) in step 2.
-- ============================================================================
ALTER TABLE kkup_tournaments
    ADD CONSTRAINT fk_tournaments_winning_team
    FOREIGN KEY (winning_team_id) REFERENCES kkup_teams(id);


-- ============================================================================
-- 9. PERFORMANCE INDEXES
-- ============================================================================
-- These cover the most common query patterns:
--   - Looking up a person by steam_id (already covered by UNIQUE)
--   - Filtering teams/staff/matches/stats by tournament
--   - Filtering stats/rosters by person
--   - Looking up matches by external ID
-- ============================================================================

-- kkup_persons: steam_id already has a unique index from the UNIQUE constraint

-- kkup_tournaments: lookup by type and status
CREATE INDEX idx_tournaments_type ON kkup_tournaments(tournament_type);
CREATE INDEX idx_tournaments_status ON kkup_tournaments(status);

-- kkup_tournament_staff: lookup by tournament and by person
CREATE INDEX idx_staff_tournament ON kkup_tournament_staff(tournament_id);
CREATE INDEX idx_staff_person ON kkup_tournament_staff(person_id);

-- kkup_teams: lookup by tournament, and by valve_team_id within tournament
CREATE INDEX idx_teams_tournament ON kkup_teams(tournament_id);
CREATE INDEX idx_teams_valve_id ON kkup_teams(valve_team_id) WHERE valve_team_id IS NOT NULL;

-- kkup_team_rosters: lookup by team and by person
CREATE INDEX idx_rosters_team ON kkup_team_rosters(team_id);
CREATE INDEX idx_rosters_person ON kkup_team_rosters(person_id);

-- kkup_matches: lookup by tournament, and by external match ID
CREATE INDEX idx_matches_tournament ON kkup_matches(tournament_id);
CREATE INDEX idx_matches_external_id ON kkup_matches(external_match_id);

-- kkup_player_match_stats: lookup by match, by person, and by team
CREATE INDEX idx_pms_match ON kkup_player_match_stats(match_id);
CREATE INDEX idx_pms_person ON kkup_player_match_stats(person_id);
CREATE INDEX idx_pms_team ON kkup_player_match_stats(team_id);


-- ============================================================================
-- VERIFICATION QUERY — Run after the script to confirm all 7 tables exist
-- ============================================================================
SELECT table_name, 
       (SELECT count(*) FROM information_schema.columns c 
        WHERE c.table_name = t.table_name AND c.table_schema = 'public') AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public' 
  AND table_name LIKE 'kkup_%'
ORDER BY table_name;


-- ============================================================================
-- DROP SCRIPT (only if you need to start over — DO NOT run unless intended!)
-- ============================================================================
-- Run these in this exact order (reverse dependency order):
--
-- DROP TABLE IF EXISTS kkup_player_match_stats CASCADE;
-- DROP TABLE IF EXISTS kkup_matches CASCADE;
-- DROP TABLE IF EXISTS kkup_team_rosters CASCADE;
-- DROP TABLE IF EXISTS kkup_teams CASCADE;
-- DROP TABLE IF EXISTS kkup_tournament_staff CASCADE;
-- DROP TABLE IF EXISTS kkup_tournaments CASCADE;
-- DROP TABLE IF EXISTS kkup_persons CASCADE;
-- ============================================================================
