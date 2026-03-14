# Tournament Pages Architecture Documentation

> **STATUS:** Pre-rebuild snapshot (March 13, 2026)
> 
> This document captures the architecture of the tournament pages BEFORE the nuclear rebuild.
> Use this as a reference for design patterns, features, and lessons learned.

---

## Overview

The Corn Field has TWO tournament page systems:

| System | Purpose | Data Source | Status |
|--------|---------|-------------|--------|
| **KKup Detail Page** | Historical archives (KK1-KK9) | `kkup_*` tables | Stable - keeping as-is |
| **Tournament Hub Page** | Live/active Season 3+ tournaments | `tournaments` table | REBUILDING - TDZ errors |

---

## 🚨 The Problem: TDZ (Temporal Dead Zone) Errors

### What We're Fixing
The current Tournament Hub Page suffers from **race condition crashes** during module initialization:
- Multiple lazy-loaded tab components import from lucide-react simultaneously
- Concurrent module initialization causes TDZ crashes ("Cannot access X before initialization")
- Static imports solved it but made the bundle massive
- Architecture became fragile and hard to maintain

### Root Cause
- Deep component tree with circular dependencies
- Heavy use of lazy loading without proper preloading
- Too many concurrent icon imports from barrel files
- Monolithic orchestrator file (1805 lines)

---

## Current Architecture (Pre-Rebuild)

### File Structure

```
Frontend Components (30 files):
├── tournament-hub-page.tsx           (1805 lines) — Main orchestrator
│
├── Tab Components (receive props from orchestrator):
│   ├── tournament-hub-overview.tsx    (51KB) — Overview tab
│   ├── tournament-hub-players.tsx     (9.3KB) — Players tab
│   ├── tournament-hub-teams.tsx       (40KB) — Teams tab
│   ├── tournament-hub-staff.tsx       (17KB) — Staff tab
│   ├── tournament-hub-matches.tsx     (4KB) — Matches tab
│   ├── tournament-hub-gallery.tsx     (3.7KB) — Gallery tab
│   ├── tournament-hub-bracket.tsx     (25KB) — Bracket tab
│   └── tournament-hub-prizes.tsx      (11KB) — Prizes tab
│
├── Section Components (used by overview tab):
│   ├── tournament-hub-sections.tsx    (20KB) — Section renderer
│   ├── tournament-hub-empty-state.tsx (678B) — Empty state
│   └── tournament-hub-ticket-meter.tsx (25KB) — TCF+ ticket progress
│
├── Modals:
│   ├── tournament-hub-create-team-modal.tsx (15KB)
│   ├── tournament-hub-invite-player-modal.tsx (12KB)
│   ├── tournament-hub-invite-coach-modal.tsx (9.6KB)
│   ├── tournament-hub-player-info-modal.tsx (13KB)
│   ├── tournament-hub-staff-modal.tsx (7.2KB)
│   └── tournament-hub-rank-modal.tsx (5.1KB)
│
├── Shared Components:
│   ├── tournament-card.tsx            — Card on kkup-page listing
│   ├── tournament-create-modal.tsx    — Create new tournament (officers)
│   ├── EditTournamentModal.tsx        — Edit tournament settings (officers)
│   ├── tournament-state-config.ts     — Phase config (KEEP THIS!)
│   ├── tournament-hero-stats.tsx      — Hero stats display
│   ├── tournament-hub-player-card.tsx (8.9KB)
│   └── tournament-hub-coaches.tsx     (14KB)
│
└── Other:
    ├── kkup-page.tsx                  (561 lines) — Listing page
    ├── kkup-detail-types.ts           — Type definitions for historical
    ├── csv-tournament-importer.tsx    — Import tool
    └── practice-tournament-page.tsx   — Practice tourney (separate)

Backend Routes (6 files):
├── routes-tournament-crud.ts          — Create/update/delete tournaments
├── routes-tournament-lifecycle.ts     — Registration, teams, status changes
├── routes-tournament-builder.ts       — Officer tools (brackets, awards)
├── routes-kkup-read.ts                — Read historical KK1-KK9 data
├── routes-kkup-write.ts               — Write historical data
└── routes-kkup-tools.ts               — Officer tools for historical
```

---

## Core Design Patterns

### 1. Phase-Driven UI (tournament-state-config.ts) ⭐ KEEP THIS

**Single source of truth for all tournament phase behavior.**

```typescript
export type TournamentPhase =
  | 'upcoming'
  | 'registration_open'
  | 'registration_closed'
  | 'roster_lock'
  | 'live'
  | 'completed'
  | 'archived';

export interface PhaseConfig {
  // Visual theme
  label: string;
  icon: string;
  tagline: string;
  headerGradient: string;
  accentColor: string;
  
  // Behavioral flags
  canRegister: boolean;
  canCreateTeam: boolean;
  canSendInvites: boolean;
  canWithdraw: boolean;
  canEditRoster: boolean;
  
  // UI sections
  overviewSections: OverviewSection[];
  availableTabs: TabKey[];
}
```

**What this achieved:**
- ✅ Zero hardcoded phase logic in JSX
- ✅ Adding a new phase = 1 config entry
- ✅ Cards and hub pages automatically adapt
- ✅ Consistent UX across all tournament states

**For rebuild:** KEEP this pattern. It's excellent.

---

### 2. Tab System Architecture

**Current approach:**
- Orchestrator (tournament-hub-page.tsx) owns ALL state
- Tab components receive props (no data fetching)
- Tabs always rendered conditionally based on phase
- "One Tab = One File" rule followed

**Tab visibility progression:**
```
upcoming/registration → Overview, Players, Staff only
roster_lock/live → Add Teams, Matches, Bracket
completed → All 7 tabs including Gallery, Prizes
```

**For rebuild:** This is clean. Keep the separation.

---

### 3. Section-Based Overview Tab

The overview tab dynamically renders sections based on phase:

```typescript
// Example: registration_open phase shows these sections in order
overviewSections: [
  'registration_hero_cta',  // Big CTA to register
  'your_status',            // User's registration status
  'progress_cards',         // Stats (X players, Y teams)
  'all_registrants',        // List of registered players
]
```

**Smart sections include:**
- Countdown timer (upcoming phase)
- Winner banner (completed phase)
- Urgency bar (registration closing soon)
- Live broadcast embed (live phase)
- Live matches panel (live phase)

**For rebuild:** Keep this concept. It's flexible and clean.

---

### 4. Team Creation & Roster Management

**Current flow:**
1. Player registers (creates registration record)
2. Player creates team (becomes captain)
3. Captain invites 4 other registered players
4. Invitees accept/decline invites
5. Once 5 players accept → team is "complete"
6. Optional: Invite a coach (6th member)

**Smart features:**
- Can't invite unregistered players
- Can't invite players already on a team
- Captain can kick players (before roster lock)
- Players can leave teams (before roster lock)
- Auto-withdrawal: leaving a team withdraws your registration

**For rebuild:** This logic is solid. Preserve it.

---

### 5. TCF+ Early Access System

**How it works:**
- `upcoming` phase: only TCF+ members can register
- `registration_open` phase: everyone can register
- Early registrants get a gold "⭐ Early Access" badge
- Tracks who used early access in `registrations` table

**For rebuild:** Keep this VIP perk.

---

### 6. Officer Tools

**In-page officer actions:**
- Edit tournament settings (prize pool, dates, status)
- Override player ranks
- Award prizes via Stripe Connect
- Generate brackets
- Add existing teams from historical data
- Mark tournament as live/completed

**For rebuild:** Keep these tools accessible.

---

## Feature Inventory

### What Works Well ✅

| Feature | Description | Keep? |
|---------|-------------|-------|
| **Phase config system** | Single source of truth for UI/behavior | ✅ YES |
| **Tab structure** | Orchestrator + prop-receiving tabs | ✅ YES |
| **Section-based overview** | Dynamic section rendering by phase | ✅ YES |
| **Team creation flow** | Invite system, roster management | ✅ YES |
| **TCF+ early access** | VIP registration phase | ✅ YES |
| **Progress cards** | X players, Y teams, Z staff | ✅ YES |
| **Live broadcast embed** | Twitch/YouTube embed in live phase | ✅ YES |
| **Gallery tab** | Upload images to Supabase storage | ✅ YES |
| **Prize distribution** | Stripe Connect integration | ✅ YES |
| **Bracket system** | Swiss/single-elim bracket generation | ✅ YES |
| **Historical data import** | CSV importer for past tournaments | ✅ YES |

### What Needs Improvement ⚠️

| Issue | Problem | Fix |
|-------|---------|-----|
| **TDZ race conditions** | Concurrent lucide imports crash | Static imports OR preload barrel |
| **Orchestrator bloat** | 1805 lines, too many concerns | Extract more logic to hooks/utils |
| **Prop drilling** | Passing 20+ props to tabs | Use context OR reduce state |
| **Re-fetching on tab switch** | Teams refetch every time | Cache fetched data properly |
| **Confusing team states** | "pending", "complete", "locked" overlap | Simplify state machine |
| **Invite flow complexity** | Too many edge cases | Reduce conditional paths |

### What's Missing 🚧

- **Real-time updates** — No live refresh when teams form
- **Match result submission** — Officers enter manually, no player self-report
- **Bracket auto-advance** — Officer must click "record result" for each match
- **Mobile UX polish** — Some modals too wide on mobile
- **Draft system** — No captain's mode hero draft tracking (future)

---

## Data Flow Patterns

### Current State Management

```typescript
// Orchestrator owns everything:
const [tournament, setTournament] = useState<any>(null);
const [registrations, setRegistrations] = useState<any>(null);
const [myRegistration, setMyRegistration] = useState<any>(null);
const [teams, setTeams] = useState<any[]>([]);
const [teamRosters, setTeamRosters] = useState<Record<string, any[]>>({});
const [teamCoachData, setTeamCoachData] = useState<Record<string, any>>({});
const [historicalTeams, setHistoricalTeams] = useState<any[]>([]);
const [historicalMatches, setHistoricalMatches] = useState<any[]>([]);
const [historicalPlayerStats, setHistoricalPlayerStats] = useState<any[]>([]);
const [loadingTeams, setLoadingTeams] = useState(false);
const [activeTab, setActiveTab] = useState<TabKey>('overview');
const [showEditModal, setShowEditModal] = useState(false);
const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
// ... 30+ more state variables
```

**Problem:** Everything lives in one component. Hard to reason about.

**For rebuild:** Consider:
- Custom hooks (`useTournamentData`, `useTeamManagement`, `useRegistration`)
- Context for deeply shared data (tournament, user registration)
- Smaller orchestrator (just routing + layout)

---

### Current Fetch Strategy

**On mount:**
1. Fetch tournament details
2. Fetch user's registration (if exists)
3. If finished → fetch historical teams/matches/stats
4. If live → fetch live matches

**On tab switch:**
1. If "Teams" tab → fetch all teams + rosters
2. If "Bracket" tab → fetch bracket data
3. If "Gallery" tab → fetch gallery images

**Problem:** Re-fetches on every tab switch. No caching.

**For rebuild:** Cache fetched data, use stale-while-revalidate pattern.

---

## Component Responsibilities

### Orchestrator (tournament-hub-page.tsx)
**Should do:**
- Load tournament + user registration
- Manage active tab state
- Pass data to tabs
- Handle top-level actions (edit tournament, create team)

**Should NOT do:**
- Render every section inline (delegates to sections.tsx)
- Manage team invite flows (modals own that)
- Compute derived stats (extract to utils)

### Tab Components
**Should do:**
- Receive props from orchestrator
- Render UI for their domain (players, teams, etc.)
- Handle tab-specific modals (invite modal, staff modal)
- Call parent callbacks for actions (onCreate, onUpdate)

**Should NOT do:**
- Fetch data directly (receive via props)
- Mutate parent state directly (use callbacks)

---

## Lessons Learned

### ✅ What Worked

1. **tournament-state-config.ts is a masterclass in config-driven UI**
   - Every phase is a data structure, not a code path
   - Adding KK11 with new rules? Just add a config entry
   - Zero JSX changes needed

2. **"One Tab = One File" rule kept complexity manageable**
   - Each tab is ~100-500 lines
   - Easy to find bugs
   - Easy to test in isolation

3. **Section-based overview tab is flexible**
   - Overview tab adapts perfectly to every phase
   - No "if upcoming show X, if live show Y" spaghetti
   - Just render the section array

4. **Team creation flow is intuitive**
   - Players understand: register → create team → invite friends
   - Captains have clear controls
   - Invites are persistent (tracked in DB)

### ❌ What Didn't Work

1. **TDZ crashes from concurrent lucide imports**
   - Lazy loading tabs caused race conditions
   - Static imports bloated the bundle
   - No good solution in current architecture

2. **Orchestrator became a God Object**
   - 1805 lines, 40+ state variables
   - Hard to refactor without breaking everything
   - Should've used custom hooks sooner

3. **Prop drilling hell**
   - Passing `tournament`, `user`, `accessToken`, `onRefresh` to every tab
   - Adding a new prop = update 8 tab components
   - Context would've been better

4. **Team state machine is confusing**
   - What's the difference between "pending" and "incomplete"?
   - When can a captain kick a player?
   - When does roster lock actually lock?
   - Needs a clearer state diagram

5. **Re-fetching on tab switch wastes bandwidth**
   - Teams tab refetches all teams every time you visit
   - Should cache for at least 30 seconds
   - No loading skeleton for re-fetches (flickers)

---

## Rebuild Strategy

### Goals for New Architecture

1. **Eliminate TDZ crashes** — Use static imports + preload, or single icon context
2. **Slim down orchestrator** — Extract hooks, use context, delegate more
3. **Improve caching** — Don't refetch data that's < 30s old
4. **Simplify team states** — Clear state machine diagram
5. **Better mobile UX** — All modals work on 375px screens
6. **Keep what works** — Phase config, tab structure, section system

### Proposed File Structure (Rebuild)

```
New Components:
├── tournament-hub-page.tsx           (< 500 lines) — Slim orchestrator
├── contexts/
│   └── tournament-context.tsx        — Shared tournament + registration state
├── hooks/
│   ├── use-tournament-data.ts        — Fetch + cache tournament
│   ├── use-team-management.ts        — Team CRUD operations
│   └── use-registration.ts           — Registration flow
├── tabs/
│   ├── tournament-overview-tab.tsx   — Overview (renamed for clarity)
│   ├── tournament-players-tab.tsx
│   ├── tournament-teams-tab.tsx
│   ├── tournament-staff-tab.tsx
│   ├── tournament-matches-tab.tsx
│   ├── tournament-gallery-tab.tsx
│   ├── tournament-bracket-tab.tsx
│   └── tournament-prizes-tab.tsx
└── sections/
    ├── countdown-section.tsx
    ├── winner-banner-section.tsx
    ├── registration-cta-section.tsx
    └── ... (all sections as separate files)
```

### Migration Checklist

**Phase 1: Safe Deletion**
- [ ] Remove all `tournament-hub-*` components (18 files)
- [ ] Remove `tournament-card.tsx` (rebuild from scratch)
- [ ] Remove `tournament-hub-page.tsx` orchestrator
- [ ] KEEP `tournament-state-config.ts` (unchanged)
- [ ] KEEP `EditTournamentModal.tsx` (reusable)
- [ ] KEEP `tournament-create-modal.tsx` (reusable)

**Phase 2: Rebuild Core**
- [ ] Create tournament context (shared state)
- [ ] Create custom hooks (data fetching)
- [ ] Build new slim orchestrator (< 500 lines)
- [ ] Build tab components (one at a time, starting with Overview)

**Phase 3: Restore Features**
- [ ] Registration flow
- [ ] Team creation flow
- [ ] Officer tools
- [ ] Prize distribution
- [ ] Bracket system
- [ ] Gallery uploads

**Phase 4: Polish**
- [ ] Mobile UX pass
- [ ] Loading states
- [ ] Error boundaries
- [ ] Real-time updates (future)

---

## Files to Delete

### Frontend (Safe to Delete — Rebuilding)
```
tournament-hub-page.tsx
tournament-hub-overview.tsx
tournament-hub-players.tsx
tournament-hub-teams.tsx
tournament-hub-staff.tsx
tournament-hub-matches.tsx
tournament-hub-gallery.tsx
tournament-hub-bracket.tsx
tournament-hub-prizes.tsx
tournament-hub-sections.tsx
tournament-hub-empty-state.tsx
tournament-hub-ticket-meter.tsx
tournament-hub-create-team-modal.tsx
tournament-hub-invite-player-modal.tsx
tournament-hub-invite-coach-modal.tsx
tournament-hub-player-info-modal.tsx
tournament-hub-staff-modal.tsx
tournament-hub-rank-modal.tsx
tournament-hub-player-card.tsx
tournament-hub-coaches.tsx
tournament-card.tsx
```

### Frontend (KEEP — Reusable)
```
tournament-state-config.ts           ⭐ Core config system
EditTournamentModal.tsx              ⭐ Officer edit modal
tournament-create-modal.tsx          ⭐ Officer create modal
tournament-hero-stats.tsx            ⭐ Shared hero stats
kkup-page.tsx                        ⭐ Listing page (minor edits)
kkup-detail-types.ts                 ⭐ Historical types
csv-tournament-importer.tsx          ⭐ Import tool
practice-tournament-page.tsx         ⭐ Separate system
```

### Backend (KEEP — All routes work)
```
routes-tournament-crud.ts
routes-tournament-lifecycle.ts
routes-tournament-builder.ts
routes-kkup-read.ts
routes-kkup-write.ts
routes-kkup-tools.ts
```

---

## Design Inspirations (Keep These Patterns)

### 1. Phase Progression Timeline
```
📅 Upcoming → 📝 Registration Open → 🔒 Reg Closed → 🔐 Roster Lock → 🔴 LIVE → 🏆 Completed
```
Visual timeline on overview tab shows current phase + progress.

### 2. Progress Cards
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ 🧑‍🌾 42      │  │ 🛡️ 8       │  │ 🛠️ 12      │
│ Registered  │  │ Teams       │  │ Staff       │
└─────────────┘  └─────────────┘  └─────────────┘
```
Simple stat cards that update in real-time.

### 3. Team Roster Display
```
┌───────────────────────────────────────┐
│ 🛡️ Corn Dawgs [CDWG]                │
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ │
│ 👑 PlayerOne (Captain)               │
│ 🎮 PlayerTwo                         │
│ 🎮 PlayerThree                       │
│ 🎮 PlayerFour                        │
│ 🎮 PlayerFive                        │
│ 📋 CoachName (Coach)                 │
└───────────────────────────────────────┘
```
Clear hierarchy: captain first, coach last.

### 4. Registration Hero CTA (early phase)
```
╔═══════════════════════════════════════╗
║  🌽 KERNEL KUP 10 REGISTRATION OPEN  ║
║                                       ║
║      [🎮 Register Now]                ║
║                                       ║
║  42 kernels already signed up!       ║
╚═══════════════════════════════════════╝
```
Big, colorful, can't miss it.

### 5. Winner Banner (completed phase)
```
┌───────────────────────────────────────┐
│  🏆 CHAMPIONS 🏆                      │
│                                       │
│  🛡️ Corn Dawgs [CDWG]                │
│                                       │
│  Congratulations to the KK10 champs! │
└───────────────────────────────────────┘
```
Full-width celebratory banner.

---

## API Endpoints Used

### Tournament CRUD
```
GET    /make-server-4789f4af/tournaments
GET    /make-server-4789f4af/tournaments/:id
POST   /make-server-4789f4af/tournaments
PATCH  /make-server-4789f4af/tournaments/:id
DELETE /make-server-4789f4af/tournaments/:id
```

### Registration
```
POST   /make-server-4789f4af/tournaments/:id/register
POST   /make-server-4789f4af/tournaments/:id/withdraw
GET    /make-server-4789f4af/tournaments/:id/registrations
```

### Teams
```
POST   /make-server-4789f4af/tournaments/:id/teams
GET    /make-server-4789f4af/tournaments/:id/teams
PATCH  /make-server-4789f4af/tournaments/:id/teams/:teamId
DELETE /make-server-4789f4af/tournaments/:id/teams/:teamId
POST   /make-server-4789f4af/tournaments/:id/teams/:teamId/invite
POST   /make-server-4789f4af/tournaments/:id/teams/:teamId/invites/:inviteId/accept
POST   /make-server-4789f4af/tournaments/:id/teams/:teamId/invites/:inviteId/decline
POST   /make-server-4789f4af/tournaments/:id/teams/:teamId/roster/:userId/remove
```

### Staff
```
POST   /make-server-4789f4af/tournaments/:id/staff/apply
GET    /make-server-4789f4af/tournaments/:id/staff
```

### Brackets
```
GET    /make-server-4789f4af/tournaments/:id/bracket
POST   /make-server-4789f4af/tournaments/:id/bracket/generate
POST   /make-server-4789f4af/tournaments/:id/bracket/series/:seriesId/result
```

### Gallery
```
GET    /make-server-4789f4af/tournaments/:id/gallery
POST   /make-server-4789f4af/tournaments/:id/gallery/upload
```

### Historical (KK1-KK9)
```
GET    /make-server-4789f4af/kkup/:slug
GET    /make-server-4789f4af/kkup/:slug/teams
GET    /make-server-4789f4af/kkup/:slug/matches
GET    /make-server-4789f4af/kkup/:slug/player-stats
```

---

## Closing Notes

This architecture **worked** for KK10 testing. The TDZ issue is the only blocker.

**What we learned:**
- Config-driven UI is powerful
- Tab structure is clean
- Orchestrator got too big
- Need better state management

**For the rebuild:**
- Keep the config system
- Keep the tab structure
- Split the orchestrator
- Use context + hooks
- Cache aggressively
- Test on mobile early

Good luck, future Tate. You got this. 🌽

---

**Last updated:** March 13, 2026 (pre-rebuild)
