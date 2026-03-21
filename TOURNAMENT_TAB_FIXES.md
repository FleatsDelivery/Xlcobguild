# Tournament Tab System - Comprehensive Fixes

## Issues Found & Fixes Applied

### ✅ 1. Winner Not Showing on Tournament Cards (KKUP Page)
**Problem:** No endpoint existed at `/kkup/tournaments` to list tournaments with winner data.

**Fix Applied:**
- Created new endpoint `GET /kkup/tournaments` in `routes-kkup-read.ts`
- Fetches tournament list with winning_team_id
- Joins with kkup_teams to get winner team_name, team_tag, logo_url
- Returns enriched `winner` object for each tournament

---

### 2. Player Count Showing 0 in Hero Header
**Problem:** The `player_count` column in kkup_tournaments is probably null/0 for old tournaments.

**Solutions:**
A. **Update database manually** (Tate runs in Supabase SQL Editor):
```sql
UPDATE kkup_tournaments t
SET player_count = (
  SELECT COUNT(DISTINCT tr.person_id)
  FROM kkup_team_rosters tr
  JOIN kkup_teams teams ON teams.id = tr.team_id
  WHERE teams.tournament_id = t.id
)
WHERE player_count IS NULL OR player_count = 0;
```

B. **Or calculate dynamically in backend** (if manual update not preferred):
- Modify tournament detail endpoint to count distinct person_ids from rosters
- Add calculated `player_count` to response

---

### 3. Team Logos Not Displaying
**Problem:** Logo URLs in kkup_teams may be incorrect/broken paths.

**Investigation Needed:**
- Check what's in `kkup_teams.logo_url` column
- Are they using old Supabase storage paths?
- Do they need to use `getTeamLogoUrl()` from `/src/lib/tournament-assets.ts`?

**Temp Fix:**
- Frontend should fallback to placeholder if logo fails to load
- Backend should construct proper storage URLs using base path

---

### 4. Player Avatars Not Displaying
**Problem:** Avatar URLs in kkup_persons may be stale/broken.

**KV Cache System:**
- Historical tournaments use avatars cached in KV store as `kkup_avatar:{steam_id}`
- The detail endpoint already fetches these (see line 1157-1166 in routes-kkup-read.ts)

**Investigation:**
- Check if KV avatars exist for historical players
- May need to re-fetch avatars from Steam API and cache them

---

### 5. Staff Members Not Showing
**Problem:** Tab endpoints don't fetch staff.

**Fix Needed:**
Create new endpoint: `GET /kkup/tournaments/:id/staff`

```typescript
app.get(`${PREFIX}/kkup/tournaments/:id/staff`, async (c) => {
  const tournamentId = c.req.param('id');
  
  // Fetch from kkup_staff table (or kkup_staff_applications with approved status)
  const { data: staff, error } = await supabase
    .from('kkup_staff')
    .select(`
      id,
      person_id,
      role,
      person:kkup_persons!person_id(
        steam_id,
        display_name,
        avatar_url
      )
    `)
    .eq('tournament_id', tournamentId);
  
  // Format and return with avatars from KV if needed
  return c.json({ staff: staff || [] });
});
```

**Table Investigation:**
- Does `kkup_staff` table exist?
- Or is staff stored in `kkup_staff_applications` with `status='approved'`?
- Check schema to determine correct approach

---

### 6. Matches Need Enrichment (Player Stats, Hero Picks)
**Problem:** Current matches endpoint only shows team-level data.

**Enhancement Needed:**
Modify `GET /kkup/tournaments/:id/matches` to include:
- Player stats for each match
- Hero picks
- Winner indication
- MVP (highest KDA or kills)

```typescript
// After fetching matches, also fetch player stats
const matchIds = matches.map(m => m.id);
const { data: playerStats } = await supabase
  .from('kkup_player_match_stats')
  .select(`
    *,
    person:kkup_persons!person_id(steam_id, display_name)
  `)
  .in('match_id', matchIds);

// Group stats by match
const statsByMatch = new Map();
(playerStats || []).forEach(stat => {
  if (!statsByMatch.has(stat.match_id)) statsByMatch.set(stat.match_id, []);
  statsByMatch.get(stat.match_id).push(stat);
});

// Enrich each match
const enrichedMatches = matches.map(match => ({
  ...match,
  player_stats: statsByMatch.get(match.id) || [],
}));
```

---

### 7. Bracket Generation Incorrect (Series vs Games)
**Problem:** Bracket shows individual games, not series. KK7 has 3 games from same series scattered across bracket.

**Root Cause:**
- Matches have `series_id` column
- Bracket should group by series, not individual matches
- Current logic just splits matches sequentially into rounds

**Proper Fix:**
The `/kkup/tournaments/:id/bracket` endpoint needs to:
1. Fetch all matches for tournament
2. **Group by `series_id`**
3. Aggregate each series: 
   - team1/team2 from first match
   - Count wins per team (team1_wins, team2_wins)
   - Determine series winner
4. Infer bracket rounds from number of SERIES (not games)
5. Return series-based bracket structure

**Example:**
```typescript
// Group matches into series
const seriesMap = new Map();
matches.forEach(match => {
  const sid = match.series_id || match.id; // fallback to match_id if no series
  if (!seriesMap.has(sid)) {
    seriesMap.set(sid, {
      series_id: sid,
      team1_id: match.radiant_team_id,
      team2_id: match.dire_team_id,
      team1: match.team1,
      team2: match.team2,
      games: [],
      team1_wins: 0,
      team2_wins: 0,
    });
  }
  const series = seriesMap.get(sid);
  series.games.push(match);
  if (match.winning_team_id === series.team1_id) series.team1_wins++;
  if (match.winning_team_id === series.team2_id) series.team2_wins++;
});

// Determine series winner
const seriesList = Array.from(seriesMap.values()).map(s => ({
  ...s,
  winner_team_id: s.team1_wins > s.team2_wins ? s.team1_id : s.team2_wins > s.team1_wins ? s.team2_id : null,
}));

// NOW distribute SERIES (not games) into bracket rounds
const seriesCount = seriesList.length;
let roundSizes = seriesCount === 7 ? [4, 2, 1] : seriesCount === 3 ? [2, 1] : [seriesCount];
```

---

### 8. Gallery Not Pulling from Correct Folder
**Problem:** Gallery tab not showing images from tournament-specific folder.

**Current Storage Structure:**
```
make-4789f4af-kkup-assets/
  kernel-kup-1/
    *.png
    *.jpg
  kernel-kup-2/
    *.png
    *.jpg
```

**Fix:**
- Gallery tab needs to fetch list of files from correct folder
- Use `slugifyTournamentName()` to get folder name
- Query Supabase Storage API: `.from('make-4789f4af-kkup-assets').list('kernel-kup-1/')`
- Build image URLs using base storage URL + folder + filename

---

### 9. Match Cards Should Be Full Width
**Problem:** Matches tab showing small cards instead of full-width rows.

**UI Fix in Frontend:**
```tsx
// In tournament-matches-tab.tsx
<div className="space-y-4">
  {matches.map(match => (
    <div key={match.id} className="bg-card rounded-2xl border-2 border-border p-6">
      {/* Full-width match display with teams, scores, player stats */}
    </div>
  ))}
</div>
```

---

## Priority Order

1. ✅ **List tournaments endpoint** (DONE - winners will now show)
2. **Player count fix** (SQL update needed)
3. **Bracket series grouping** (critical UX fix)
4. **Match enrichment with player stats** (critical for matches tab)
5. **Staff endpoint** (need to identify correct table)
6. **Gallery storage listing** (need storage API integration)
7. **Logo/avatar investigation** (may just need URL fixes)
8. **Match card UI** (frontend styling)

---

## Next Steps

Tate, please confirm:
1. Should I run the player_count SQL update, or will you do it manually?
2. Does a `kkup_staff` table exist, or is staff in `kkup_staff_applications`?
3. Should I proceed with implementing the bracket series grouping fix?
4. Should I add player stats enrichment to the matches endpoint?

