# Codebase Research Summary

> **Research completed:** Tournament system architecture, data models, API routes, CSV structure, and live polling implementation.

---

## 📊 Key Findings

### **1. Bracket Table Schema**

**`kkup_bracket_series`** (7 rows per tournament):
- Stores each matchup (QF1-4, SF1-2, GF)
- Links series via `next_series_id` + `next_series_slot` for winner advancement
- Supports byes: `status='bye'`, `dire_team_id=null`, winner auto-set
- Best-of formats configurable per round: `best_of` (1, 3, or 5)

**`kkup_bracket_matches`** (individual games within series):
- Multiple rows per series (e.g., 3 rows for BO3)
- Tracks OpenDota match IDs for live data polling
- Stores scores (kills), duration, winner
- Status: `pending` | `live` | `completed` | `forfeit`

**`kkup_teams.seeding`** (new column added):
- Populated when entering roster lock phase
- Calculated from average team rank (all player ranks + coach rank)

**`kkup_tournament_staff.stream_assignment`** (new column added):
- `text[]` array of stream names (e.g., `["KKUPTV1", "KKUPTV2"]`)
- Grants RPB access to assigned staff members

---

### **2. CSV Data Structure (KK1-9 Archives)**

**6 files per tournament:**
1. `{kup}_overview.csv` — Tournament metadata
2. `{kup}_teams.csv` — Team roster (id, name, tag, captain, coach)
3. `{kup}_players.csv` — Player list with ranks
4. `{kup}_matches.csv` — Match results (series_id, match_id, teams, scores, winner)
5. `{kup}_player_match_stats.csv` — Per-player stats (kills, deaths, assists, gpm, xpm)
6. `{kup}_staff.csv` — Staff/volunteer list

**Match CSV columns:**
```
series_id, match_id (OpenDota), game_mode, radiant_team_id, radiant_team_name, radiant_team_score,
dire_team_id, dire_team_name, dire_team_score, match_length, match_time, match_date,
winning_team_id, winning_team_name
```

**Usage:**
- CSV is **required** for Completed → Archived transition
- System compares DB vs CSV, flags mismatches
- Owner reviews discrepancies, submits final archival

---

### **3. API Routes (Bracket System)**

**From `/supabase/functions/server/routes-bracket.ts`:**

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/kkup/tournaments/:id/bracket/generate` | POST | Owner | Generate bracket at roster lock |
| `/kkup/tournaments/:id/bracket` | GET | Public | Fetch full bracket (series + matches) |
| `/kkup/tournaments/:id/bracket` | DELETE | Owner | Delete bracket for re-generation |
| `/kkup/tournaments/:id/bracket/series/:seriesId/result` | POST | Officer+ | Record series winner |
| `/kkup/voice-channels/reset` | POST | Owner | Reset Discord voice channels |

**Bracket generation logic:**
1. Validates all rostered players have ranks (blocks if unranked)
2. Calculates average team rank for seeding
3. Creates 7 series rows (4 QF + 2 SF + 1 GF) with proper seeding
4. Handles byes (top seeds auto-advance if <8 teams)
5. Pre-creates match rows for QF series (game 1 of each)
6. Updates Discord voice channels with seeding

**Series advancement logic:**
1. Officer records winner via API
2. Series marked completed, winner_team_id set
3. Winner advances to `next_series_id` in `next_series_slot` (radiant/dire)
4. If next series now has both teams → auto-create game 1 match
5. Discord webhook + admin log

---

### **4. Live Polling Implementation**

**From `/src/app/components/practice-tournament-page.tsx`:**

**Polling intervals:**
```tsx
const pollInterval = getPollInterval(user); // 30s default, 10s for TCF+
```

**Pattern:**
```tsx
useEffect(() => {
  fetchData();
  
  const interval = setInterval(fetchData, pollInterval);
  return () => clearInterval(interval);
}, [pollInterval]);
```

**What updates:**
- Match status (`pending` → `live` → `completed`)
- Radiant/Dire kill scores
- Match duration
- Live minimap data
- Player stats (kills, deaths, assists, net worth, etc.)

**UI indicators:**
- "Live Now" pill badge
- Pulsing border animation
- Real-time score updates

**Config location:** `/src/lib/live-polling-config.ts`

---

### **5. Existing Tournament Components**

**Practice Tournament Builder:**
- Location: `/src/app/components/practice-tournament-page.tsx`
- Features: Live match panel, match cards with heroes, team logos, real-time polling
- Reusable components:
  - `<LiveMatchPanel />` — Full match view with minimap, stats, scoreboard
  - `<MatchCardWithHeroes />` — Compact match display
  - `<TeamLogo />` — Team logo with fallback

**Tournament Hub (Current):**
- Location: `/src/app/components/tournament-hub-page.tsx`
- Already has context: `/src/app/contexts/tournament-context.tsx`
- Tabs already exist (upcoming phase only): `/src/app/components/tabs/tournament-*-tab-upcoming.tsx`

**Shared Components:**
- `<TeamLogo />` — `/src/app/components/team-logo.tsx`
- `<MatchCardWithHeroes />` — `/src/app/components/match-card-with-heroes.tsx`
- `<LiveMatchPanel />` — `/src/app/components/live-match-panel.tsx`
- `<LiveMatchMinimap />` — `/src/app/components/live-match-minimap.tsx`
- `<LiveMatchStats />` — `/src/app/components/live-match-stats.tsx`

---

### **6. Stream Assignment (To Be Built)**

**Current state:** Column exists in DB (`kkup_tournament_staff.stream_assignment`), no UI yet

**Requirements:**
- Staff tab → owner-only section
- Each staff member has "Assign Stream" button
- Dropdown: KKUPTV1, KKUPTV2, KKUPTV3, KKUPTV4
- Multi-select allowed (one person can handle multiple streams)
- On assignment → create notification for staff member

**API endpoint needed:**
```
POST /kkup/tournaments/:id/staff/:staffId/assign-stream
Body: { streams: ["KKUPTV1", "KKUPTV2"] }
```

**Notification:**
```
type: 'stream_assignment'
title: 'Stream Assignment'
description: 'You have been assigned to KKUPTV1, KKUPTV2. You now have access to the Remote Production Booth (RPB).'
```

---

### **7. Notification System**

**From `/supabase/functions/server/routes-notifications.ts`:**

**Three systems:**
1. **Notifications** — `notification:{user_id}:{sortable_id}` (target user sees it)
2. **User Activity** — `user_activity:{user_id}:{sortable_id}` (actor's audit trail)
3. **Admin Log** — `admin_log:{sortable_id}` (officer-visible actions)

**Functions:**
- `createNotification()` — Send to target user
- `createUserActivity()` — Log to actor's activity feed
- `createAdminLog()` — Log to officer inbox

**Pattern for new types:**
1. Add type to `/src/app/components/inbox-activity-config.ts`
2. Add display config (label, icon, color)
3. UI auto-picks it up (no component changes needed)

**For stream assignments:**
```tsx
await createNotification({
  user_id: staffMember.user_id,
  type: 'stream_assignment',
  title: 'Stream Assignment',
  description: `You have been assigned to ${streams.join(', ')}. You now have access to the RPB.`,
  related_url: `#tournament-hub/${tournamentId}`,
});
```

---

### **8. Tournament Assets**

**From `/src/lib/tournament-assets.ts`:**

**Available utilities:**
- `getTournamentBanner(name)` — Hero banner URL
- `getTournamentLargeIcon(name)` — Card icon URL
- `getTeamLogoUrl(teamTag)` — Master team logo
- `getTournamentTeamLogoUrl(name, teamTag)` — Gallery copy

**Storage convention:**
```
kernel-kup-{N}/league_banner.png
kernel-kup-{N}/league_large_icon.png
team_logos/{team-tag}.png
```

**Always use these utilities** — never hardcode asset URLs.

---

### **9. Dark Mode System**

**From `/src/app/components/theme-provider.tsx`:**

**Modes:** `light` | `dark` | `system`

**Semantic tokens (must use these for dark mode compatibility):**

| Class | Light | Dark | Use for |
|---|---|---|---|
| `bg-background` | silk | soil | Page backgrounds |
| `bg-card` | surface | dark-husk | Cards, elevated surfaces |
| `text-foreground` | field-dark | silk | Primary text |
| `text-muted-foreground` | muted gray | muted tan | Secondary text |
| `border-border` | field-dark/10 | silk/10 | Borders |

**Brand colors (stay same in both modes):**
- `bg-harvest`, `text-harvest` — Primary accent
- `bg-husk`, `text-husk` — Secondary accent (green)
- `bg-kernel-gold` — Awards, rankings

**Rule:** Never use `bg-white`, `text-field-dark`, `border-field-dark/10` in new components.

---

### **10. File Naming Conventions**

**From `/guidelines/Guidelines.md`:**

**Components:** `kebab-case.tsx`
- Pages: `{name}-page.tsx`
- Tabs: `{parent-page}-{tab-name}.tsx`
- Modals: `{action}-{noun}-modal.tsx`
- Shared UI: descriptive name, no suffix (e.g., `team-logo.tsx`)

**Server routes:** `routes-{domain}.ts`
- Each exports `register{Domain}Routes(app, supabase, anonSupabase)`

**Utilities:** `/src/lib/{name}.ts`
- Pure functions, constants, types
- Examples: `slugify.ts`, `dota-heroes.ts`, `date-utils.ts`

---

## ✅ What We Have (Ready to Use)

**Data:**
- ✅ All bracket tables exist and are populated (kkup_bracket_series, kkup_bracket_matches)
- ✅ CSV archive data for KK1-9 (reference for completed phase design)
- ✅ Team seeding column added
- ✅ Stream assignment column added

**APIs:**
- ✅ Bracket generation endpoint (fully functional)
- ✅ Bracket fetch endpoint (returns series + matches)
- ✅ Series winner recording endpoint
- ✅ Bracket deletion endpoint

**Components:**
- ✅ LiveMatchPanel (practice tournament builder)
- ✅ MatchCardWithHeroes (practice tournament builder)
- ✅ TeamLogo (shared)
- ✅ Tournament context (tournament-context.tsx)
- ✅ Notification system (routes-notifications.ts)

**Utilities:**
- ✅ Tournament asset URL generators (tournament-assets.ts)
- ✅ Date formatting (date-utils.ts)
- ✅ Rank display (rank-utils.ts)
- ✅ Live polling config (live-polling-config.ts)

---

## ❌ What We Need to Build

**Components:**
- ❌ BracketViewer (main bracket display)
- ❌ BracketSeriesSlot (individual QF/SF/GF slot)
- ❌ BracketConnectorLines (SVG lines)
- ❌ BracketInfoPanel (left sidebar metadata)
- ❌ BracketSchedulePanel (right sidebar schedule)
- ❌ TeamCard (team roster display)
- ❌ PlayerAvatarRow (player list with avatars)
- ❌ PodiumDisplay (top 3 teams visual)

**Tabs:**
- ❌ matches-tab.tsx (phase-aware: empty vs bracket viewer)
- ❌ standings-tab.tsx (phase-aware: empty vs podium + rankings)
- ❌ teams-tab.tsx (phase-aware: empty vs team grid vs live standings)
- ❌ overview-tab.tsx (phase-aware: varies a lot per phase)
- ❌ staff-tab.tsx (static list + stream assignment UI)
- ❌ my-tournament-tab.tsx (complex: register/team/results views)

**Features:**
- ❌ Stream assignment UI (Staff tab, owner-only)
- ❌ CSV upload & validation flow (Completed → Archived)
- ❌ Officer "Record Winner" UI (bracket viewer during live phase)
- ❌ "Generate Bracket" button (hero header during roster lock)

**Hooks:**
- ❌ useBracketData (fetch + poll bracket)
- ❌ useTournamentTeams (fetch teams for teams tab)
- ❌ useTournamentStandings (fetch standings for standings tab)

---

## 🚀 Recommended Build Order

**Week 1: Completed/Archived Foundation**
1. Extract `<BracketViewer />` from practice builder (or build from scratch using guidelines)
2. Build `<PodiumDisplay />` for standings tab
3. Build `<TeamCard />` for teams tab
4. Build `standings-tab.tsx` (completed phase)
5. Build `teams-tab.tsx` (completed phase)
6. Build `matches-tab.tsx` (completed phase — just bracket viewer)

**Week 2: Pre-Tournament Phases**
7. Add upcoming state to all tabs
8. Build `my-tournament-tab.tsx` (registration flow)
9. Add registration open/closed states

**Week 3: Active Tournament Phases**
10. Add roster lock state (bracket shell visible)
11. Build live phase polling logic
12. Build officer "Record Winner" UI
13. Add live match indicators to bracket viewer

**Week 4: Polish & Edge Cases**
14. Stream assignment UI
15. CSV upload & validation
16. Dark mode pass
17. Mobile responsive audit
18. Loading states, error states, empty states

---

## 📝 Documentation Status

**Completed:**
- ✅ BRACKET_DESIGN_GUIDELINES.md (comprehensive bracket spec)
- ✅ CODEBASE_RESEARCH_SUMMARY.md (this doc)

**Existing:**
- ✅ Guidelines.md (project guidelines)
- ✅ TOURNAMENT_PAGES_ARCHITECTURE.md (phase system overview)
- ✅ TOURNAMENT_PHASE_1_UPCOMING.md (upcoming phase spec)

**To be created:**
- ❌ TOURNAMENT_SHARED_COMPONENTS.md (reusable component specs)
- ❌ CSV_VALIDATION_FLOW.md (archival process spec)

---

## 🤔 Outstanding Questions (Answered)

**1. Data Fetching Strategy**
- **Answer:** Tournament context fetches metadata, tab components fetch their specific data
- **Reason:** Keeps context lean, allows tabs to refresh independently

**2. Completed vs Archived - Same UI?**
- **Answer:** Visually identical, just a DB status filter
- **Difference:** Archived requires CSV upload, is immutable

**3. Shared Components Folder?**
- **Answer:** Yes, create `/src/app/components/tournament-hub/shared/`
- **Contents:** bracket-viewer, team-card, player-avatar-row, bracket-info-panel, etc.

**4. Practice Tournament Builder - Audit First?**
- **Answer:** Extract `<BracketViewer />` components as-needed during build
- **Reason:** Don't over-extract upfront, extract when reuse is confirmed

**5. Officer Actions - Where?**
- **Answer:** Inline with conditional rendering (e.g., "Record Winner" button appears on series slots for officers during live phase)
- **Reason:** Keeps actions contextual, avoids separate admin panels

**6. My Tournament Tab - Tackle Last?**
- **Answer:** Yes, build last after other tabs are stable
- **Reason:** Most complex (registration flow, team management, match scheduling)

**7. Real-Time Updates (Live Phase)**
- **Answer:** Polling at 30s (10s for TCF+), no websockets needed
- **Reason:** Proven pattern from practice builder, simpler infra

---

## ✅ Ready to Build

All research complete. Data models understood. API routes documented. Shared components identified. Guidelines written.

**Next step:** Build the first component — recommend starting with `<BracketViewer />` since it's the most complex shared component and validates the entire bracket data pipeline.

Let's ship it. 🌽
