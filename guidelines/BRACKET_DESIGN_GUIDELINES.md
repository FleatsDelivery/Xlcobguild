# Bracket Design Guidelines

> **The Corn Field Tournament Bracket System**  
> Single elimination, 8-team standard, seeded by team rank, with bye support.

---

## 0. Philosophy

Brackets are the **story of the tournament**. They show:
- Who earned their seed (rank-based seeding)
- Who advanced through skill (match results)
- Who claimed victory (championship path)

The bracket system is **predictable, fair, and automated**. Tournament directors control timing and stream assignments, but the bracket itself is mathematically generated from team ranks.

**Design principle:** Brackets are always visible once generated (roster lock phase), but their content evolves through phases:
- **Roster Lock:** Empty bracket shell with seeding (no scores)
- **Live:** Live score updates, match status indicators, "Live Now" pills
- **Completed:** Final results, winner highlighted, full match history

---

## 1. Data Model

### **Tables**

#### `kkup_bracket_series`
Stores each matchup in the bracket (QF1-4, SF1-2, GF).

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `tournament_id` | uuid | FK to kkup_tournaments |
| `round` | text | 'QF' \| 'SF' \| 'GF' |
| `position` | integer | 1-4 for QF, 1-2 for SF, 1 for GF |
| `seed_radiant` | integer | Seed number (1-8) for radiant team |
| `seed_dire` | integer | Seed number (1-8) for dire team (null if bye) |
| `radiant_team_id` | uuid | FK to kkup_teams |
| `dire_team_id` | uuid | FK to kkup_teams (null if bye) |
| `winner_team_id` | uuid | FK to kkup_teams (null until series completes) |
| `best_of` | integer | 1, 3, or 5 (from tournament.bracket_config) |
| `status` | text | 'pending' \| 'bye' \| 'live' \| 'completed' |
| `next_series_id` | uuid | FK to next round's series (null for GF) |
| `next_series_slot` | text | 'radiant' \| 'dire' (which side winner goes to) |
| `completed_at` | timestamptz | When series finished (null if pending) |
| `created_at` | timestamptz | Auto-generated |

**Key relationships:**
- A series with `status='bye'` has `dire_team_id=null`, `winner_team_id=radiant_team_id`, and auto-advances
- Winner of series X fills `radiant_team_id` or `dire_team_id` in series Y (via `next_series_id` + `next_series_slot`)

---

#### `kkup_bracket_matches`
Stores individual games within a series (Game 1, Game 2, Game 3 for BO3).

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `series_id` | uuid | FK to kkup_bracket_series |
| `game_number` | integer | 1, 2, 3, etc. |
| `radiant_team_id` | uuid | FK to kkup_teams |
| `dire_team_id` | uuid | FK to kkup_teams |
| `winner_team_id` | uuid | FK to kkup_teams (null until match completes) |
| `opendota_match_id` | bigint | OpenDota match ID for live data polling |
| `radiant_score` | integer | Kills (cosmetic, not win condition) |
| `dire_score` | integer | Kills (cosmetic, not win condition) |
| `match_duration` | integer | Seconds |
| `status` | text | 'pending' \| 'live' \| 'completed' \| 'forfeit' |
| `completed_at` | timestamptz | When match finished |
| `created_at` | timestamptz | Auto-generated |

**Note:** Dota 2 is won by destroying the enemy Ancient, **not by kills**. The score displayed is kills for entertainment value only.

---

#### `kkup_teams`
Teams now have a `seeding` column added when entering roster lock.

| Column | Type | Description |
|---|---|---|
| `seeding` | integer | Bracket seed (1-8), populated at roster lock |

**Seeding algorithm:**
1. Calculate average team rank = average of all rostered player ranks + coach rank
2. Sort teams by avgRank descending (highest rank = seed 1)
3. Assign seed numbers 1 → N

---

#### `kkup_tournament_staff`
Staff members can be assigned to streams for RPB access.

| Column | Type | Description |
|---|---|---|
| `stream_assignment` | text[] | Array of stream names (e.g., `["KKUPTV1", "KKUPTV2"]`) |

---

### **Bracket Template (8-Team Single Elim)**

Fixed structure, always the same:

```
Quarterfinals (QF):
  QF1: Seed 1 vs Seed 8 → advances to SF1 radiant
  QF2: Seed 3 vs Seed 6 → advances to SF1 dire
  QF3: Seed 2 vs Seed 7 → advances to SF2 radiant
  QF4: Seed 4 vs Seed 5 → advances to SF2 dire

Semifinals (SF):
  SF1: Winner QF1 vs Winner QF2 → advances to GF radiant
  SF2: Winner QF3 vs Winner QF4 → advances to GF dire

Grand Final (GF):
  GF: Winner SF1 vs Winner SF2 → CHAMPION
```

This template is hardcoded in `routes-bracket.ts` as `BRACKET_TEMPLATE`.

---

## 2. Tournament Lifecycle & Bracket Phases

### **Phase Timeline**

| Phase | Bracket State | What's Visible |
|---|---|---|
| **Upcoming** | Not generated | "Bracket publishes after roster lock" |
| **Registration Open** | Not generated | Same empty state |
| **Registration Closed** | Not generated | Same (optional: show empty bracket shell) |
| **Roster Lock** | **GENERATED** | Empty bracket with seeding, team logos, BO formats, schedule |
| **Live** | Active | Live scores, match status, "Live Now" indicators |
| **Completed** | Final | Final scores, winner highlighted, W/L badges |
| **Archived** | Frozen | Same as completed, but CSV-validated |

---

### **Roster Lock Phase Transition — Bracket Generation**

**Trigger:** Owner clicks "Generate Bracket" in roster lock phase (or auto-generated when entering roster lock via lifecycle API)

**Pre-flight checks:**
1. Tournament must be in `registration_closed` or `roster_lock` status
2. At least `tournament.min_teams` approved teams (usually 6, absolute min 2)
3. Maximum 8 teams
4. **All rostered players must have ranks** (Herald 1 - Divine 1 for players, any rank for coaches)
   - If unranked players exist, generation is **blocked** and returns error with list of unranked players
   - Officers must use rank override tool to set ranks before proceeding

**Generation steps:**
1. Calculate team rank for each approved team:
   ```
   team_rank = average(all_player_ranks + coach_rank)
   ```
2. Sort teams by `team_rank` descending (highest = seed 1)
3. Assign `seeding` column (1-8) in `kkup_teams` table
4. Create 7 series rows:
   - GF first (so QF/SF can reference it via `next_series_id`)
   - Then SF (linking to GF)
   - Then QF (linking to SF, with teams assigned)
5. Handle byes:
   - If <8 teams, top seeds get byes
   - Bye series: `status='bye'`, `dire_team_id=null`, `winner_team_id=radiant_team_id`, auto-advance to next round
6. Pre-create game 1 match rows for non-bye QF series
7. Update `kkup_teams.seeding` for all teams
8. Rename Discord voice channels to show seeding (e.g., "1st Seed: CDGS")
9. Send Discord webhook to #kkup-updates with bracket announcement

**API Endpoint:**
```
POST /kkup/tournaments/:id/bracket/generate
Auth: Owner only
Body: (none)
Returns: { success, teamCount, byeCount, seeding[] }
```

**Edge case: <6 teams**
- System allows generation but **warns** owner before proceeding
- Modal: "This tournament has only X teams (minimum 6 recommended). Proceed anyway?"

---

## 3. Best-Of Formats & Schedule

### **Format Configuration**

Stored in `tournament.bracket_config` JSONB column:
```json
{
  "best_of_qf": 1,
  "best_of_sf": 3,
  "best_of_gf": 5
}
```

**Defaults if not set:**
- QF: BO1 (1 game, fastest)
- SF: BO3 (first to 2 wins)
- GF: BO5 (first to 3 wins)

**Common variations:**
- **Kernel Kup 5v5:** BO3 → BO1 → BO5 (semis are BO1 for time constraints)
- **Heaps n' Hooks 1v1:** BO1 → BO1 → BO3 (faster format)

---

### **Schedule Outline**

Tournament directors manually set:
- Day breakdown (e.g., "Day 1: Quarters + Semis, Day 2: Finals")
- Time slots per round (e.g., "7:00p - 8:20p")
- Match duration estimates (lobby setup, in-game, post-game buffer)

**Schedule is displayed prominently in bracket viewer** (right side panel or always-visible section).

**Time zones:**
- All times stored as `timestamptz` (UTC internally)
- Display times in user's local timezone with label (e.g., "7:00 PM EST")

---

## 4. Stream Assignments

### **Manual Assignment (Owner Only)**

**UI Location:** Staff tab, owner-only section

**Interface:**
- Each staff member has an "Assign Stream" button
- Dropdown menu: KKUPTV1, KKUPTV2, KKUPTV3, KKUPTV4 (or custom streams from tournament config)
- Multi-select allowed (one person can handle multiple streams)
- Assignment stored in `kkup_tournament_staff.stream_assignment` as `text[]`

**Effect of assignment:**
1. Staff member receives notification: "You've been assigned to [stream names]. You now have access to the Remote Production Booth (RPB)."
2. RPB access granted (to be built later — production panel for managing that stream's matches)

**Stream priority:**
- **KKUPTV1** is the main channel (most followers) and **always hosts Grand Finals**
- Other streams (TV2-4) are flexible, but owner typically pre-assigns to avoid confusion

---

## 5. Match Score Tracking & Live Updates

### **Score Sources**

**Primary:** Auto-pulled from OpenDota/Steam APIs
- Match starts → system polls OpenDota for `opendota_match_id`
- Updates: kills, deaths, match status, duration
- Match ends → auto-record winner, final score

**Fallback:** Manual entry via CSV upload
- If match wasn't ticketed (ticket application forgotten), no OpenDota data exists
- Officer uploads CSV post-tournament with match results
- CSV format: `match_id, radiant_team_id, dire_team_id, winner_team_id, radiant_score, dire_score, match_duration`

**Forfeit/Bye:**
- Forfeit: One team doesn't show up → officer manually records winner via `/bracket/series/:seriesId/result` endpoint
- Bye: Handled automatically during bracket generation

---

### **Live Polling (During "Live" Phase)**

**Polling intervals:**
- Default: **30 seconds** (all users)
- TCF+ members: **10 seconds** (premium fast updates)

**What updates live:**
- Match status (`pending` → `live` → `completed`)
- Radiant/Dire kill scores
- Match phase (draft, in-game, post-game)
- Live minimap (if enabled)
- Player stats (kills, deaths, assists, net worth, etc.)

**UI indicators:**
- "Live Now" pill badge on active matches
- Pulsing animation or green border around live match slots
- Score updates in real-time within bracket slots

**Reference implementation:** Practice tournament page (`practice-tournament-page.tsx`) has full live polling logic

---

## 6. Series Advancement Logic

### **Recording a Series Result**

**Trigger:** Officer (or owner) clicks "Record Winner" after series completes

**API Endpoint:**
```
POST /kkup/tournaments/:id/bracket/series/:seriesId/result
Auth: Officer+
Body: { winner_team_id: "uuid" }
Returns: { success, is_grand_final, winner, loser }
```

**Backend actions:**
1. Validate winner is one of the two teams in series
2. Mark series `status='completed'`, set `winner_team_id`, record `completed_at`
3. Advance winner to next round:
   - Update `next_series_id` row: set `radiant_team_id` or `dire_team_id` (based on `next_series_slot`)
   - Copy winner's seed to next round
4. If next series now has both teams → auto-create game 1 match row
5. Discord voice channel updates:
   - Loser's channel renamed: "Xth Seed: Eliminated"
   - If GF, winner's channel: "🌽 CHAMPION: [TAG]"
6. Discord webhook to #kkup-updates with result announcement
7. Admin log entry

**Special case: Grand Final**
- `is_grand_final=true` in response
- Champion webhook with special embed (gold color, crown emoji)
- Tournament effectively over (but stays in "live" phase until officer transitions to "completed")

---

## 7. CSV Upload & Archival Flow

### **Why CSV Upload?**

Tournament directors manually verify all match data post-tournament for accuracy and posterity. The CSV serves as:
1. **Audit log** — human review catches data entry errors, missing matches
2. **Canonical record** — DB data can have bugs/glitches, CSV is director's ground truth
3. **Archive trigger** — Tournament cannot move to "archived" status without CSV upload

---

### **CSV Format**

**Files required (6 total):**
1. `{tournament}_overview.csv` — Tournament metadata
2. `{tournament}_teams.csv` — Team roster
3. `{tournament}_players.csv` — Player list with ranks
4. `{tournament}_matches.csv` — Match results
5. `{tournament}_player_match_stats.csv` — Per-player stats
6. `{tournament}_staff.csv` — Staff/volunteer list

**Example match CSV structure** (from KK1):
```csv
series_id,match_id,game_mode,radiant_team_id,radiant_team_name,radiant_team_score,dire_team_id,dire_team_name,dire_team_score,match_length,match_time,match_date,winning_team_id,winning_team_name
991,991,captains_mode,9400971,Mutha Shuckas,32,3212656,Big Dick LaNm,31,2454,null,10/06/2023,3212656,Big Dick LaNm
```

---

### **Validation Logic**

**Completed → Archived transition requires:**
1. CSV files uploaded for all 6 categories
2. **Auto-detect mismatches:**
   - DB says Team A won QF1, CSV says Team B → flag for review
   - DB has 7 matches, CSV has 6 → missing match detected
   - CSV has match 999, DB has no record → found extra match
3. **Case-by-case review UI:**
   - Modal shows discrepancies in table format
   - Officer can choose: "Use DB value" or "Use CSV value" or "Skip this match"
   - After resolving all conflicts, "Submit Archival" button activates
4. **Final submission:**
   - Apply CSV overrides to DB (if chosen)
   - Lock tournament as `status='archived'`
   - Generate immutable archival snapshot (optional: freeze JSON blob in KV store)

**Archival is REQUIRED blocker** — cannot archive without CSV upload and validation.

**Edge case:** If owner really needs to skip CSV, they can manually UPDATE the DB status (documented as "break glass" option).

---

## 8. Bracket Viewer Component — Design Specs

### **Visual Design**

#### **Bracket Slots**

**Dimensions:**
- Desktop: `width: 200px`, `height: 80px`
- Mobile: `width: 140px`, `height: 60px`, horizontally scrollable

**Styling:**
- Border: `2px solid border-border` (semantic token)
- Background: `bg-card` (dark mode compatible)
- Rounded corners: `rounded-xl` (16px)
- Team logos: `40px × 40px` (desktop), `32px × 32px` (mobile)
- Team tag: Bold, truncate with `...` if too long

**States:**
- **Pending:** Default border
- **Live:** Pulsing border animation, `border-harvest` glow
- **Completed:** Winner has `border-husk` green accent, loser has `border-border/30` muted

#### **Connector Lines**

**Color:** `#8B4513` (maroon/brown) — matches bracket screenshots
**Width:** `2px`
**Style:** Solid lines connecting winner slot to next round slot

**Layout:** Standard single-elim tree:
```
QF1 ─┐
     ├─ SF1 ─┐
QF2 ─┘       │
             ├─ GF ─→ WINNER
QF3 ─┐       │
     ├─ SF2 ─┘
QF4 ─┘
```

#### **Winner Slot**

**Position:** Centered below GF
**Styling:**
- Background: `bg-husk` (green)
- Border: `border-husk-bright` (bright green)
- Text: "WINNER!" in `font-black`, `text-silk` (light text on green)
- Team logo: Larger (60px × 60px)
- Team name: Displayed prominently

---

### **Content Layers**

#### **Seed Numbers**
- Position: Top-left corner of slot
- Font: `text-sm`, `text-muted-foreground`
- Format: "Seed 1", "Seed 8", etc.

#### **Team Logos**
- Primary display (not team names by default)
- Fallback: Team tag text if logo missing
- Layout: Logo on left, team tag on right (horizontal)

#### **Match Format Badges**
- Position: Above each round label
- Style: Pill badge (`bg-harvest/20`, `text-harvest`, `rounded-full`, `px-3 py-1`)
- Text: "BO1", "BO3", "BO5"

#### **Live Score Display**
- **During live phase:** Show kill score (e.g., "Team A 15 - 12 Team B")
- **After completion:** Show "W" on winner side, "L" on loser side (or just highlight winner)

#### **Stream Labels**
- Position: Above each QF/SF matchup
- Style: Small badge with stream name ("KKUPTV1", "KKUPTV2")
- Color-coded by stream (optional)

---

### **Info Panels**

#### **Left Panel: Tournament Metadata**
- Default bracket description
- Seeding method ("Ranked by team average")
- Game mode ("Captains Mode", "All Pick", etc.)
- Participant count (e.g., "8 teams, 4 streams, 3 rounds, 2 days")
- Day breakdown with BO formats
- Minimum required participants
- Bye rules

#### **Right Panel: Schedule Outline**
- Tournament timing overview
- Match duration breakdown:
  - Lobby setup: 15 min
  - Average game: 35-45 min
  - Post-game buffer: 10 min
- Registration agreement reminder
- Consequences for backing out (ticket forfeit, team disband, etc.)

**Visibility:**
- Always visible on desktop (side-by-side with bracket)
- Mobile: Collapsible accordion or separate tab

---

### **Responsive Design**

#### **Desktop (lg+)**
- Full bracket tree visible
- Side panels visible
- No horizontal scroll

#### **Tablet (md)**
- Bracket may require horizontal scroll
- Info panels below bracket (stacked)

#### **Mobile (<640px)**
- Bracket: Horizontal scroll required
- Connector lines simplified (or removed for clarity)
- Slots scaled down (140px width)
- Info panels: Accordion sections
- Text truncation aggressive (`max-w-20`, `truncate`)

---

### **Interactions**

#### **Clicking a Bracket Slot**

**Phase-dependent behavior:**

**Roster Lock / Registration Closed:**
- No interaction (bracket is read-only preview)

**Live:**
- Navigate to Matches tab (scroll to that series)
- Or: Open modal with live match details (minimap, player stats, scoreboard)

**Completed / Archived:**
- Navigate to Matches tab
- Or: Open modal with final match stats, VOD links

**Default (MVP):** Just navigate to Matches tab. No complex modals needed initially.

---

## 9. Bracket Data Fetching

### **API Endpoint**

```
GET /kkup/tournaments/:id/bracket
Auth: Public (no auth required)
Returns: { bracket: { QF: [...], SF: [...], GF: [...] } }
```

**Response structure:**
```typescript
{
  bracket: {
    QF: [
      {
        id: "uuid",
        round: "QF",
        position: 1,
        seed_radiant: 1,
        seed_dire: 8,
        radiant_team: { id, team_name, team_tag, logo_url },
        dire_team: { id, team_name, team_tag, logo_url },
        winner_team: null | { id, team_name, team_tag, logo_url },
        best_of: 1,
        status: "pending",
        next_series_id: "uuid",
        next_series_slot: "radiant",
        matches: [
          {
            id: "uuid",
            game_number: 1,
            radiant_team_id: "uuid",
            dire_team_id: "uuid",
            radiant_score: 32,
            dire_score: 28,
            winner_team_id: "uuid",
            status: "completed",
            opendota_match_id: 7369357917,
            match_duration: 2454,
            completed_at: "2023-10-06T21:34:00Z"
          }
        ]
      },
      // ... QF2, QF3, QF4
    ],
    SF: [ /* same structure */ ],
    GF: [ /* same structure */ ]
  }
}
```

**Null bracket:**
If bracket hasn't been generated yet:
```json
{ "bracket": null, "message": "No bracket generated yet." }
```

---

### **Frontend Hook**

```tsx
// hooks/use-bracket-data.ts
export function useBracketData(tournamentId: string, pollInterval?: number) {
  const [bracket, setBracket] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const fetchBracket = useCallback(async () => {
    const res = await fetch(`${API_BASE}/kkup/tournaments/${tournamentId}/bracket`);
    const data = await res.json();
    setBracket(data.bracket);
    setLoading(false);
  }, [tournamentId]);
  
  useEffect(() => {
    fetchBracket();
    
    // Poll if live phase
    if (pollInterval) {
      const interval = setInterval(fetchBracket, pollInterval);
      return () => clearInterval(interval);
    }
  }, [fetchBracket, pollInterval]);
  
  return { bracket, loading, refetch: fetchBracket };
}
```

**Usage:**
```tsx
// In matches tab
const { tournament } = useTournament();
const pollInterval = tournament.status === 'live' 
  ? (isTCFPlus ? 10000 : 30000) 
  : undefined;

const { bracket, loading } = useBracketData(tournament.id, pollInterval);
```

---

## 10. Officer Tools & Permissions

### **Who Can Do What**

| Action | Permission |
|---|---|
| Generate bracket | Owner only |
| Delete bracket | Owner only |
| Record series winner | Officer+ |
| Assign streams | Owner only |
| Edit match details | Officer+ |
| Upload CSV | Owner only |
| Approve archival | Owner only |

### **Officer UI Elements**

**Bracket page (officer-only):**
- "Generate Bracket" button (roster lock phase, owner only)
- "Delete & Regenerate" button (roster lock phase, owner only)
- "Record Winner" button on each completed series (officer+, live phase only)
- "Edit Match" button to manually enter scores (officer+)

**Staff tab (owner-only):**
- Stream assignment dropdown per staff member
- "Notify Staff" button to send assignment notifications

**Archival flow (owner-only):**
- "Upload Tournament CSV" button (completed phase)
- Discrepancy review table
- "Archive Tournament" button (after validation)

---

## 11. Edge Cases & Error Handling

### **Unranked Players**
- **Blocker:** Bracket generation fails if any rostered player has no rank
- **Resolution:** Officer uses rank override tool to set rank manually
- **UI:** Error modal lists all unranked players by team

### **<6 Teams**
- **Warning:** Bracket generation shows confirmation modal: "Only X teams (recommended: 6+). Proceed?"
- **Allow:** Generation continues if owner confirms
- **Byes:** Top seeds auto-advance

### **8+ Teams**
- **Blocker:** Bracket generation fails if >8 approved teams
- **Resolution:** Owner must deny some teams before generating
- **Future:** Support for 16-team double-elim (not in MVP)

### **Match Not Played (Missing Ticket)**
- **No OpenDota data:** Match won't auto-update
- **Fallback:** Officer manually records winner via API
- **CSV upload:** Catches missing matches during archival validation

### **Series Winner Recorded Incorrectly**
- **Can't undo:** Once recorded, series result is locked
- **Workaround:** Owner deletes entire bracket, regenerates, re-records results
- **Future:** Add "Undo Last Result" officer tool

### **Forfeit Mid-Tournament**
- **Team withdraws:** Captain can withdraw team, automatically records forfeit
- **Effect:** All future matches auto-won by opponent
- **Discord:** Voice channel renamed to "Eliminated - Forfeit"

---

## 12. Future Enhancements (Not MVP)

### **Double Elimination Support**
- Loser's bracket with 7 additional series
- Requires new table structure (upper/lower bracket tracking)

### **16-Team Brackets**
- Add Round of 16 before Quarterfinals
- Requires more voice channels, longer schedule

### **Swiss Format**
- Round-robin style with seeding after group stage
- Requires separate `kkup_swiss_rounds` table

### **Manual Bracket Editing**
- Drag-and-drop teams into slots
- Override seeding (for invitational tournaments)

### **VOD Links in Bracket**
- Each match slot shows Twitch VOD icon
- Click to watch replay

### **Predictions System**
- Users predict bracket results before tournament starts
- Leaderboard for most accurate predictions

### **Fantasy Brackets**
- Draft teams, earn points based on their performance
- Separate fantasy leaderboard

---

## 13. Quick Reference — Bracket Checklist

### **"I'm about to generate a bracket — am I ready?"**

✅ Tournament is in `registration_closed` or `roster_lock` status  
✅ At least 6 approved teams (or accepted <6 with warning)  
✅ Maximum 8 approved teams  
✅ All rostered players have ranks (Herald 1 - Divine 1 for players, any rank for coaches)  
✅ Best-of formats configured in `tournament.bracket_config` (or using defaults)  
✅ Stream assignments planned (KKUPTV1-4)  
✅ Discord voice channels ready to be renamed  

---

### **"Tournament is live — what updates happen?"**

✅ Bracket polls every 30s (10s for TCF+)  
✅ Match status updates (`pending` → `live` → `completed`)  
✅ Scores update in real-time (kills, not wins — cosmetic only)  
✅ "Live Now" pills appear on active matches  
✅ Officers record series winners manually via UI  
✅ Winners auto-advance to next round  
✅ Discord channels update on eliminations  

---

### **"Tournament ended — how do I archive it?"**

✅ Upload all 6 CSV files (overview, teams, players, matches, player_match_stats, staff)  
✅ System validates: compares DB vs CSV, flags mismatches  
✅ Review discrepancies case-by-case, choose DB or CSV values  
✅ Submit archival — tournament locks as `status='archived'`  
✅ Bracket becomes immutable historical record  

---

## 14. File Architecture (Frontend)

Following the phase-aware tabs pattern:

```
/src/app/components/tournament-hub/
  
  tabs/
    matches-tab.tsx                    → Switches on phase, delegates to bracket viewer
  
  shared/
    bracket-viewer.tsx                 → Main bracket component (~400 lines)
    bracket-series-slot.tsx            → Individual QF/SF/GF slot (~150 lines)
    bracket-connector-lines.tsx        → SVG lines connecting series (~100 lines)
    bracket-info-panel.tsx             → Tournament metadata panel (~120 lines)
    bracket-schedule-panel.tsx         → Schedule outline panel (~100 lines)
```

**Matches tab structure:**
```tsx
// tabs/matches-tab.tsx
export function MatchesTab() {
  const { tournament } = useTournament();
  
  // Empty state for pre-roster-lock phases
  if (['upcoming', 'registration_open', 'registration_closed'].includes(tournament.status)) {
    return (
      <div className="p-6 text-center">
        <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-lg">Bracket publishes after roster lock</p>
      </div>
    );
  }
  
  // Bracket viewer for all post-roster-lock phases
  const isLive = tournament.status === 'live';
  const pollInterval = isLive ? (isTCFPlus ? 10000 : 30000) : undefined;
  
  return <BracketViewer tournament={tournament} pollInterval={pollInterval} />;
}
```

---

## 15. Design Tokens & Colors

### **Bracket-Specific Colors**

Use semantic tokens for dark mode compatibility:

| Element | Light | Dark | Tailwind Class |
|---|---|---|---|
| Slot background | `surface` | `dark-husk` | `bg-card` |
| Slot border (default) | `field-dark/10` | `silk/10` | `border-border` |
| Slot border (live) | `harvest` | `harvest` | `border-harvest` |
| Slot border (winner) | `husk` | `husk-bright` | `border-husk` |
| Connector lines | `#8B4513` | `#8B4513` | Custom color (not semantic) |
| Winner slot bg | `husk` | `husk-bright` | `bg-husk` |
| "Live Now" pill | `harvest` bg | `harvest` bg | `bg-harvest text-soil` |
| BO format badge | `harvest/20` bg | `harvest/20` bg | `bg-harvest/20 text-harvest` |

**Typography:**
- Seed numbers: `text-sm text-muted-foreground`
- Team tags: `font-bold text-foreground`
- Match scores: `text-lg font-black text-harvest`
- Round labels: `text-xl font-bold text-foreground`

---

## 16. Testing Checklist

### **Bracket Generation**
- [ ] 8 teams, all ranked → bracket generates correctly
- [ ] 7 teams → 1 bye assigned to seed 1
- [ ] 6 teams → 2 byes assigned to seeds 1-2
- [ ] <6 teams → warning modal appears, generation allowed if confirmed
- [ ] >8 teams → error, must deny teams first
- [ ] Unranked player exists → error with player list, blocks generation
- [ ] Seeding order matches avgRank descending
- [ ] Discord voice channels renamed to seeding

### **Live Updates**
- [ ] Live match shows "Live Now" pill
- [ ] Scores update every 30s (or 10s for TCF+)
- [ ] Match status transitions: `pending` → `live` → `completed`
- [ ] Winner advances to next round automatically
- [ ] Both teams in next series → game 1 match auto-created

### **Series Winner Recording**
- [ ] Officer records winner → series marked completed
- [ ] Winner advances to correct slot (radiant/dire)
- [ ] Loser's voice channel renamed to "Eliminated"
- [ ] GF winner → champion voice channel, webhook sent
- [ ] Admin log created

### **CSV Upload & Archival**
- [ ] CSV uploaded → validation runs
- [ ] Mismatch detected → flagged in review UI
- [ ] All discrepancies resolved → "Archive" button activates
- [ ] Archive submitted → tournament status = 'archived'
- [ ] Archived bracket is read-only

---

## 17. Common Pitfalls & How to Avoid Them

### **❌ Don't:**
- Hardcode 8 teams everywhere (support byes dynamically)
- Use `bg-white` or `text-field-dark` (breaks dark mode — use semantic tokens)
- Assume match scores determine winners (Dota is won by Ancient destruction)
- Poll for updates during completed/archived phases (waste of requests)
- Allow bracket editing after tournament starts (integrity risk)

### **✅ Do:**
- Use `status='bye'` for empty slots (not `null` teams)
- Use semantic tokens (`bg-card`, `text-foreground`, `border-border`)
- Display scores for entertainment only, not as win condition
- Only poll during `live` phase
- Lock bracket once first match starts

---

## Closing Thoughts

The bracket system is **mathematically deterministic** (seeding + results = championship path) but **visually storytelling** (we see the journey, not just the outcome).

By following these guidelines, every bracket will:
- Be **fair** (rank-based seeding)
- Be **transparent** (all data visible, CSV-verified)
- Look **professional** (consistent design, dark mode support)
- Scale **easily** (add tournaments without redesigning)

Now let's build it. 🌽
