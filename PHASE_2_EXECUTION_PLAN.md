# PHASE 2: ARCHITECTURAL SURGERY - EXECUTION PLAN

## Strategy Overview

We're consolidating the dual-branch system into ONE unified tab architecture. Each tab will intelligently render based on tournament phase/status.

## File Operations

### FILES TO CREATE (3 new unified tabs)
1. `/src/app/components/tournament-hub-matches.tsx` - Merge from kkup-detail-matches.tsx
2. `/src/app/components/tournament-hub-gallery.tsx` - Merge from kkup-detail-gallery.tsx  
3. `/src/app/components/tournament-hub-prizes.tsx` - Merge from kkup-detail-prizes.tsx

### FILES TO REFACTOR (4 existing tabs + orchestrator)
4. `/src/app/components/tournament-hub-overview.tsx` - Add finished state logic from kkup-detail-overview.tsx
5. `/src/app/components/tournament-hub-players.tsx` - Add stats leaderboard from kkup-detail-player-stats.tsx
6. `/src/app/components/tournament-hub-teams.tsx` - Add finished state from kkup-detail-teams.tsx
7. `/src/app/components/tournament-hub-staff.tsx` - Add finished state from kkup-detail-staff.tsx
8. `/src/app/components/tournament-hub-page.tsx` - Remove TournamentHubHistory delegation, use unified tabs

### FILES TO DELETE (8 files)
9. `/src/app/components/tournament-hub-history.tsx` - DELETE (entire component)
10. `/src/app/components/kkup-detail-overview.tsx` - DELETE
11. `/src/app/components/kkup-detail-player-stats.tsx` - DELETE
12. `/src/app/components/kkup-detail-teams.tsx` - DELETE
13. `/src/app/components/kkup-detail-staff.tsx` - DELETE
14. `/src/app/components/kkup-detail-matches.tsx` - DELETE
15. `/src/app/components/kkup-detail-gallery.tsx` - DELETE
16. `/src/app/components/kkup-detail-prizes.tsx` - DELETE

## Tab-by-Tab Merge Strategy

### Tab 1: Overview
**Active State:** Countdown, registration CTA, progress cards, recent signups
**Finished State:** Winner banner, final standings, Pop'd Kernel winners, top players, hero stats, KKup movie
**Merge Logic:** Add `isFinished` prop, conditionally render finished vs active sections

### Tab 2: Players  
**Active State:** All players, free agents, coaches (current behavior)
**Finished State:** Stats leaderboard (KDA, GPM, XPM, etc.) + coaches section
**Merge Logic:** When `isFinished`, switch from roster view to stats table

### Tab 3: Teams
**Active State:** Team cards with approval status, roster management
**Finished State:** Final standings with match records
**Merge Logic:** Add finished styling, show final records instead of approval badges

### Tab 4: Staff
**Active State:** Staff applications, apply CTA
**Finished State:** Credits roll, staff roster
**Merge Logic:** Hide application form when finished, show roster only

### Tab 5: Matches (NEW)
**Active State:** "Matches will be scheduled soon" or live match list
**Finished State:** Full match history with hero picks, scores
**Create From:** kkup-detail-matches.tsx as base, add active state placeholder

### Tab 6: Gallery (NEW)
**Active State:** "Photos will be added during/after the event"
**Finished State:** Gallery grid with lightbox
**Create From:** kkup-detail-gallery.tsx as base, add empty state for active

### Tab 7: Prizes (NEW)
**Active State:** Prize pool breakdown (motivator)
**Finished State:** Prize pool + award recipients
**Create From:** kkup-detail-prizes.tsx as base (already handles both)

## Data Flow Changes

### BEFORE (Dual Branch)
```
tournament-hub-page.tsx
├── if (isFinished) → TournamentHubHistory
│   ├── fetchHistoricalData() → one big API call
│   └── KKupDetail* components (statically imported)
└── else → Individual tab components
    ├── fetchTournament()
    ├── fetchTeams()
    ├── fetchMyInvites()
    └── etc. (multiple API calls)
```

### AFTER (Unified)
```
tournament-hub-page.tsx (orchestrator)
├── if (isFinished) → fetch historical snapshot
│   └── Pass data to unified tabs
└── else → fetch active data
    └── Pass data to unified tabs

Unified tabs always render, decide content based on:
- tournament.status (upcoming, live, completed, archived)
- isFinished flag
- data presence
```

## Execution Order

### Step 1: Create New Tab Files
Create Matches, Gallery, Prizes tabs that handle both states

### Step 2: Refactor Existing Tabs  
Add finished state logic to Overview, Players, Teams, Staff

### Step 3: Refactor Orchestrator
Update tournament-hub-page.tsx to:
- Remove TournamentHubHistory delegation
- Consolidate data fetching (finished vs active)
- Use unified tabs for ALL phases
- Add lazy loading for new tabs

### Step 4: Cleanup
Delete TournamentHubHistory and all KKupDetail* files

### Step 5: Test
Verify all phases work correctly

## Key Props Each Tab Needs

All tabs should accept:
```tsx
interface UnifiedTabProps {
  tournament: Tournament;
  teams: Team[];
  isFinished: boolean;
  isOwner: boolean;
  accessToken: string;
  // Tab-specific props...
}
```

## Success Criteria

✅ All tabs render in all phases
✅ TournamentHubHistory deleted
✅ All KKupDetail* files deleted  
✅ Single data flow from orchestrator → tabs
✅ No duplicate code between active/finished rendering
✅ No TDZ errors
✅ Lazy loading still works
