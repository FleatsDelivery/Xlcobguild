# Tournament Pages Rebuild Plan

> **MISSION:** Nuke the current tournament-hub system and rebuild it from scratch without TDZ errors.

---

## Phase 1: Safe Deletion ✂️

### Files to DELETE (20 files)

**Tab Components:**
```
✂️ tournament-hub-overview.tsx
✂️ tournament-hub-players.tsx
✂️ tournament-hub-teams.tsx
✂️ tournament-hub-staff.tsx
✂️ tournament-hub-matches.tsx
✂️ tournament-hub-gallery.tsx
✂️ tournament-hub-bracket.tsx
✂️ tournament-hub-prizes.tsx
```

**Section Components:**
```
✂️ tournament-hub-sections.tsx
✂️ tournament-hub-empty-state.tsx
✂️ tournament-hub-ticket-meter.tsx
```

**Modals:**
```
✂️ tournament-hub-create-team-modal.tsx
✂️ tournament-hub-invite-player-modal.tsx
✂️ tournament-hub-invite-coach-modal.tsx
✂️ tournament-hub-player-info-modal.tsx
✂️ tournament-hub-staff-modal.tsx
✂️ tournament-hub-rank-modal.tsx
```

**Shared Components:**
```
✂️ tournament-hub-player-card.tsx
✂️ tournament-hub-coaches.tsx
```

**Main Page:**
```
✂️ tournament-hub-page.tsx          (The big one - 1805 lines)
```

**Card Component:**
```
✂️ tournament-card.tsx              (Used on kkup-page listing)
```

**Total to delete:** 20 files, ~5,000 lines of code

---

### Files to KEEP ⭐

**Core Config (NEVER DELETE):**
```
✅ tournament-state-config.ts       — Phase config system (unchanged)
```

**Reusable Modals:**
```
✅ EditTournamentModal.tsx          — Officer edit tournament settings
✅ tournament-create-modal.tsx      — Officer create new tournament
```

**Shared Components:**
```
✅ tournament-hero-stats.tsx        — Hero stats display (reusable)
✅ team-logo.tsx                    — Team logo component (already exists)
```

**Other Tournament Files (Separate Systems):**
```
✅ kkup-page.tsx                    — Listing page (will need minor edits)
✅ kkup-detail-types.ts             — Historical tournament types
✅ csv-tournament-importer.tsx      — CSV import tool
✅ practice-tournament-page.tsx     — Practice tourney (separate)
✅ kkup-stinger.tsx                 — KKup intro animation
```

**All Backend Routes (KEEP ALL):**
```
✅ routes-tournament-crud.ts
✅ routes-tournament-lifecycle.ts
✅ routes-tournament-builder.ts
✅ routes-kkup-read.ts
✅ routes-kkup-write.ts
✅ routes-kkup-tools.ts
```

---

### Code Edits Required

#### 1. `/src/app/App.tsx`
**Remove import:**
```typescript
// DELETE THIS:
import { TournamentHubPage } from '@/app/components/tournament-hub-page';
```

**Remove render:**
```typescript
// DELETE THIS:
{currentPage === 'tournament-hub' && tournamentId && (
  <TournamentHubPage 
    tournamentId={tournamentId} 
    user={user} 
    accessToken={accessToken || ''} 
    onBack={() => { ... }} 
  />
)}
```

**Add temporary placeholder:**
```typescript
// ADD THIS (temporary):
{currentPage === 'tournament-hub' && (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center">
      <h1 className="text-3xl font-black text-foreground mb-4">🚧 Tournament Page Rebuild In Progress 🚧</h1>
      <p className="text-muted-foreground">Check back soon!</p>
      <button 
        onClick={() => window.location.hash = '#kkup'} 
        className="mt-6 px-4 py-2 bg-harvest text-soil rounded-lg"
      >
        ← Back to Kernel Kup
      </button>
    </div>
  </div>
)}
```

#### 2. `/src/app/components/kkup-page.tsx`
**Remove tournament-card import:**
```typescript
// DELETE THIS:
import { TournamentCard } from '@/app/components/tournament-card';
```

**Replace card rendering with simple list (temporary):**
```typescript
// REPLACE THIS:
<TournamentCard 
  tournament={t} 
  onClick={() => handleTournamentClick(t.id)} 
/>

// WITH THIS (temporary):
<div 
  key={t.id}
  onClick={() => handleTournamentClick(t.id)}
  className="p-6 bg-card border-2 border-border rounded-2xl cursor-pointer hover:border-harvest/50 transition-all"
>
  <h3 className="text-xl font-bold text-foreground">{t.name}</h3>
  <p className="text-sm text-muted-foreground mt-1">{t.status}</p>
  <p className="text-sm text-muted-foreground">{t.start_date}</p>
</div>
```

---

## Phase 2: Rebuild Foundation 🏗️

### Step 1: Create Tournament Context

**New file:** `/src/app/contexts/tournament-context.tsx`

```typescript
import { createContext, useContext, useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

interface TournamentContextValue {
  tournament: any;
  myRegistration: any;
  isOfficer: boolean;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const TournamentContext = createContext<TournamentContextValue | null>(null);

export function TournamentProvider({ 
  tournamentId, 
  user, 
  accessToken, 
  children 
}: { 
  tournamentId: string; 
  user: any; 
  accessToken: string; 
  children: React.ReactNode;
}) {
  const [tournament, setTournament] = useState<any>(null);
  const [myRegistration, setMyRegistration] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      // Fetch tournament + user registration
      // ... implementation
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tournamentId]);

  return (
    <TournamentContext.Provider value={{ 
      tournament, 
      myRegistration, 
      isOfficer: user?.role === 'officer' || user?.role === 'owner',
      loading, 
      error, 
      refetch: fetchData 
    }}>
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournament() {
  const ctx = useContext(TournamentContext);
  if (!ctx) throw new Error('useTournament must be used within TournamentProvider');
  return ctx;
}
```

---

### Step 2: Create Custom Hooks

**New file:** `/src/app/hooks/use-tournament-teams.ts`

```typescript
import { useState, useEffect } from 'react';

export function useTournamentTeams(tournamentId: string, accessToken: string) {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastFetch, setLastFetch] = useState<number>(0);

  const fetchTeams = async () => {
    // Only refetch if > 30s since last fetch
    if (Date.now() - lastFetch < 30000) return;
    
    setLoading(true);
    try {
      const response = await fetch(`...`);
      const data = await response.json();
      setTeams(data.teams);
      setLastFetch(Date.now());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, [tournamentId]);

  return { teams, loading, refetch: fetchTeams };
}
```

---

### Step 3: Build Slim Orchestrator

**New file:** `/src/app/components/tournament-hub-page.tsx` (< 300 lines)

```typescript
import { useState } from 'react';
import { TournamentProvider, useTournament } from '@/app/contexts/tournament-context';
import { getPhaseConfig, type TabKey } from './tournament-state-config';
import { TournamentOverviewTab } from './tabs/tournament-overview-tab';
import { TournamentPlayersTab } from './tabs/tournament-players-tab';
// ... other tabs

function TournamentHubContent({ onBack }: { onBack: () => void }) {
  const { tournament, loading, error } = useTournament();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState error={error} onBack={onBack} />;

  const phaseConfig = getPhaseConfig(tournament.status);
  const availableTabs = phaseConfig.availableTabs;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <TournamentHeader tournament={tournament} onBack={onBack} />
      
      {/* Tab Navigation */}
      <TabNav 
        tabs={availableTabs} 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
      />
      
      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {activeTab === 'overview' && <TournamentOverviewTab />}
        {activeTab === 'players' && <TournamentPlayersTab />}
        {activeTab === 'teams' && <TournamentTeamsTab />}
        {/* ... other tabs */}
      </div>
    </div>
  );
}

export function TournamentHubPage({ tournamentId, user, accessToken, onBack }) {
  return (
    <TournamentProvider tournamentId={tournamentId} user={user} accessToken={accessToken}>
      <TournamentHubContent onBack={onBack} />
    </TournamentProvider>
  );
}
```

**Key improvements:**
- ✅ Context provides shared state (no prop drilling)
- ✅ Hooks handle data fetching (no bloated orchestrator)
- ✅ Orchestrator just routes tabs (< 300 lines)
- ✅ Static imports (no lazy loading race conditions)

---

### Step 4: Build Tabs (One at a Time)

**New file:** `/src/app/components/tabs/tournament-overview-tab.tsx`

```typescript
import { useTournament } from '@/app/contexts/tournament-context';
import { getPhaseConfig } from '../tournament-state-config';
import { CountdownSection } from '../sections/countdown-section';
import { RegistrationCTASection } from '../sections/registration-cta-section';
// ... other sections

export function TournamentOverviewTab() {
  const { tournament, myRegistration } = useTournament();
  const phaseConfig = getPhaseConfig(tournament.status);

  return (
    <div className="space-y-8">
      {phaseConfig.overviewSections.map(section => {
        switch (section) {
          case 'countdown':
            return <CountdownSection key={section} tournament={tournament} />;
          case 'registration_cta':
            return <RegistrationCTASection key={section} tournament={tournament} />;
          case 'your_status':
            return <YourStatusSection key={section} registration={myRegistration} />;
          // ... other sections
          default:
            return null;
        }
      })}
    </div>
  );
}
```

---

## Phase 3: Restore Features ⚙️

### Priority 1: Core User Flow
1. ✅ View tournament overview
2. ✅ Register for tournament
3. ✅ Withdraw from tournament
4. ✅ View all registered players
5. ✅ Create a team
6. ✅ Invite players to team
7. ✅ Accept/decline team invites

### Priority 2: Officer Tools
1. ✅ Edit tournament settings
2. ✅ Change tournament status
3. ✅ Override player ranks
4. ✅ Generate brackets
5. ✅ Record match results

### Priority 3: Advanced Features
1. ✅ Live broadcast embed
2. ✅ Gallery uploads
3. ✅ Prize distribution
4. ✅ Staff applications
5. ✅ Historical stats

---

## Phase 4: Rebuild Tournament Card 🃏

**New file:** `/src/app/components/tournament-card.tsx`

```typescript
import { getPhaseConfig } from './tournament-state-config';

export function TournamentCard({ tournament, onClick }) {
  const phaseConfig = getPhaseConfig(tournament.status);
  
  return (
    <div 
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-2xl border-2 
        ${phaseConfig.cardBorderHover}
        cursor-pointer transition-all
        ${phaseConfig.cardHoverLift ? 'hover:-translate-y-1' : ''}
        bg-card
      `}
      style={{ boxShadow: phaseConfig.cardGlow }}
    >
      {/* Banner Image */}
      {tournament.banner_url && (
        <div className="h-48 overflow-hidden">
          <img 
            src={tournament.banner_url} 
            alt={tournament.name}
            className={`w-full h-full object-cover ${phaseConfig.bannerZoom ? 'hover:scale-105 transition-transform duration-300' : ''}`}
          />
        </div>
      )}
      
      {/* Content */}
      <div className="p-6">
        {/* Status Badge */}
        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold ${phaseConfig.statusPillBg} ${phaseConfig.statusPillText} ${phaseConfig.pulseStatus ? 'animate-pulse' : ''}`}>
          {phaseConfig.pingDot && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
            </span>
          )}
          {phaseConfig.icon} {phaseConfig.label}
        </div>
        
        {/* Title */}
        <h3 className="text-2xl font-black text-foreground mt-4">{tournament.name}</h3>
        <p className="text-muted-foreground mt-1">{phaseConfig.tagline}</p>
        
        {/* Stats */}
        <div className="flex gap-6 mt-4 text-sm">
          <div>
            <span className="text-muted-foreground">Players:</span>
            <span className="ml-2 font-bold text-foreground">{tournament.registration_count || 0}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Teams:</span>
            <span className="ml-2 font-bold text-foreground">{tournament.team_count || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Key features:**
- ✅ Uses phase config for all styling
- ✅ Animations from config (pulse, ping, hover lift)
- ✅ Clean, reusable, < 100 lines
- ✅ No hardcoded phase logic

---

## Testing Checklist ✅

### Per-Phase Tests

**Upcoming Phase:**
- [ ] Only TCF+ members can register
- [ ] Non-TCF+ see "Coming soon" message
- [ ] Countdown timer shows correctly
- [ ] Overview tab only

**Registration Open:**
- [ ] Anyone can register
- [ ] Early access badge shows for TCF+ who registered early
- [ ] Can withdraw registration
- [ ] Can create team after registering
- [ ] Players tab shows all registrants

**Registration Closed:**
- [ ] Cannot register
- [ ] Can still create teams (if registered)
- [ ] Can still send/accept invites
- [ ] Teams tab appears

**Roster Lock:**
- [ ] Cannot create teams
- [ ] Cannot send invites
- [ ] Cannot edit rosters
- [ ] Matches tab appears

**Live:**
- [ ] Live broadcast embed shows (if URL set)
- [ ] Live matches panel shows
- [ ] Bracket tab appears
- [ ] Cannot modify rosters

**Completed:**
- [ ] Winner banner shows
- [ ] All 7 tabs visible
- [ ] Gallery tab accessible
- [ ] Prizes tab shows awards

---

## Success Criteria 🎯

### Must Have (MVP)
- ✅ No TDZ errors (static imports, preloaded icons)
- ✅ All 8 tabs work
- ✅ Registration flow works
- ✅ Team creation works
- ✅ Officer can edit tournaments
- ✅ Phase config drives all UI

### Nice to Have
- ✅ Real-time updates (websockets)
- ✅ Better caching (30s TTL)
- ✅ Mobile polish
- ✅ Loading skeletons
- ✅ Error boundaries

### Metrics
- **Bundle size:** < 500KB (current is ~800KB with static imports)
- **First paint:** < 2s on 3G
- **Lighthouse score:** > 90
- **Zero console errors**

---

## Go/No-Go Decision

**PROCEED WITH DELETION IF:**
- ✅ Documentation is complete (this file + TOURNAMENT_PAGES_ARCHITECTURE.md)
- ✅ Backend routes are stable (no changes needed)
- ✅ tournament-state-config.ts is safe
- ✅ You have 4+ hours for rebuild

**ABORT IF:**
- ❌ Backend needs changes
- ❌ Not enough time
- ❌ Unsure about architecture

---

## Rollback Plan 🔄

If rebuild fails catastrophically:

1. **Restore from git history:**
   ```bash
   git checkout HEAD~1 -- src/app/components/tournament-hub-*
   git checkout HEAD~1 -- src/app/components/tournament-card.tsx
   ```

2. **Re-import deleted components in App.tsx**

3. **KK1-KK9 still work** (kkup-detail-page is untouched)

4. **Live tournaments disabled** until rebuild complete

---

## Timeline Estimate ⏱️

| Phase | Time | Tasks |
|-------|------|-------|
| **Phase 1: Deletion** | 30 min | Delete 20 files, edit App.tsx + kkup-page.tsx |
| **Phase 2: Foundation** | 2 hours | Context, hooks, slim orchestrator |
| **Phase 3: Overview Tab** | 3 hours | Rebuild all overview sections |
| **Phase 4: Other Tabs** | 4 hours | Players, Teams, Staff, Matches, Gallery, Bracket, Prizes |
| **Phase 5: Modals** | 3 hours | Team creation, invites, staff apply, player info |
| **Phase 6: Tournament Card** | 1 hour | New card component |
| **Phase 7: Testing** | 2 hours | Test all phases, all flows |
| **Phase 8: Polish** | 2 hours | Mobile, loading states, error handling |

**Total:** ~17 hours (2-3 work days)

---

## Ready to Proceed? 🚀

**Pre-flight checklist:**
- ✅ Documentation complete
- ✅ Understand what we're keeping vs deleting
- ✅ Backend routes won't change
- ✅ Have time to rebuild
- ✅ Git commit before deletion

**If all checked, you're CLEARED FOR LAUNCH.** 🌽

---

**Created:** March 13, 2026  
**Author:** Future Tate (with AI Claude's help)  
**Status:** Ready to execute
