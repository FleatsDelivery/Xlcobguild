okayyyyyyyyyyyy i took a small break and thought things over. We know this tdz issue only happens on the Tournament Pages. Not the Kernel Kup page, not the Hall of Fame page. which is a little surprising given they all deal with the same data (kinda) so that obviously leads me to believe that the Tournament Pages are the problem. in the past we have thought it was Motion/react. Well we have removed all motion from the t-pages and the navigation and app. I'm sure theres motion left in the app somewhere but I can say with some level of confidence that its not the motion stuff thats causing problems. I really think its gotta be with how we are loading the tournament pages...I wrote out on my whiteboard the following:
Tournament Page <-- what appears when you click on a t-card
* Phases
   * upcoming
   * registration_open
   * registration_closed
   * roster_lock
   * live
   * completed
   * archived
* Roles
* Componenets
* Tabs
   * Overview
   * players
   * teams
   * matches
   * bracket
   * prizes
   * gallery
   * staff
   * (do we have any more than that? removing duplicates would be a good place to start or unused tabs)
* Lets have all tabs appear in phases, but what each tab displays can/might change for each phase. we want to lazy load all tabs besides overview. motion IS okay we believe but we will implement later. we still need to figure out what exactly this bug is but more than likely its just an unmet promise in our code or some circular loading or we did let instead of var or const. or whatever. I am ignorant to this level of software development so im just hands on deck trying to feed you the info to help me fix it. Do you mind going thru the github codebase and seeing the order in which we load things on the tournament pages and get back to me on that as well as your thoughts on what ive said hereShow more1:35 PM2 / 2Diagnosed loading architecture and validated lazy-load strategy approachDiagnosed loading architecture and validated lazy-load strategy approachGood. Your whiteboard thinking is correct and it helped me focus the investigation. Here's what I found after going through the full loading order.

What's actually happening when a tournament page loads
Step 1 — Static imports execute (before any React code runs)
This is the problem area. tournament-hub-page.tsx statically imports every single tab component upfront:
TournamentHubOverview      ← statically imported
TournamentHubPlayers       ← statically imported
TournamentHubTeams         ← statically imported
TournamentHubStaff         ← statically imported
TournamentHubHistory       ← statically imported (and THIS one imports
                              KKupDetailOverview, KKupDetailMatches,
                              KKupDetailPlayerStats, KKupDetailTeams,
                              KKupDetailStaff, KKupDetailGallery,
                              KKupDetailPrizes ← recharts lives here)
TournamentHubBracket       ← statically imported
KKupDetailPrizes           ← ALSO directly imported again
Plus 7 modals, all statically imported
The bundler has to evaluate all of these simultaneously before React renders anything. That's where the TDZ race happens — too many modules with internal dependencies all initializing at the same time.
Step 2 — On mount, 5 API calls fire simultaneously
jsfetchTournament()
fetchTeams()
fetchMyInvites()
fetchStaffApps()
fetchBracket()  ← bracket fires even if user never clicks bracket tab
Bracket and staff data load unconditionally regardless of what phase the tournament is in or what tab is active.
Step 3 — Re-renders cascade
The auth hook is re-running 3-4 times (visible in every console log), which re-renders the page component before it's even finished initializing. Each re-render hits the TDZ window again.

Your instinct is correct
The fix is exactly what you wrote on the whiteboard — lazy load everything except Overview. Here's the specific plan:
In tournament-hub-page.tsx, change all tab imports to lazy:
tsximport { lazy, Suspense } from 'react';

// Keep these static (always needed):
import { TournamentHubOverview } from './tournament-hub-overview';

// Lazy load everything else:
const TournamentHubPlayers = lazy(() => import('./tournament-hub-players').then(m => ({ default: m.TournamentHubPlayers })));
const TournamentHubTeams = lazy(() => import('./tournament-hub-teams').then(m => ({ default: m.TournamentHubTeams })));
const TournamentHubStaff = lazy(() => import('./tournament-hub-staff').then(m => ({ default: m.TournamentHubStaff })));
const TournamentHubHistory = lazy(() => import('./tournament-hub-history').then(m => ({ default: m.TournamentHubHistory })));
const TournamentHubBracket = lazy(() => import('./tournament-hub-bracket').then(m => ({ default: m.TournamentHubBracket })));
const KKupDetailPrizes = lazy(() => import('./kkup-detail-prizes').then(m => ({ default: m.KKupDetailPrizes })));
Wrap the entire tab content area in one <Suspense>:
tsx<Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="animate-spin text-harvest w-8 h-8" /></div>}>
  {/* existing tab rendering logic */}
</Suspense>
Also gate the API calls by relevance:
tsx// Only fetch bracket if tournament is in a bracket-relevant phase
useEffect(() => {
  fetchTournament();
  fetchTeams();
  fetchMyInvites();
  fetchStaffApps();
  // DON'T fetch bracket on mount — fetch it when bracket tab is clicked
}, []);

// Fetch bracket lazily when tab is activated
useEffect(() => {
  if (activeTab === 'bracket' && !bracketData && !bracketLoading) {
    fetchBracket();
  }
}, [activeTab]);

On the Figma situation specifically
The bundle hash on Figma is still e6c781ed8ea7c47250e5dbd20d40905b40c7bead — it has not changed once across your last several deploys. Figma is genuinely not syncing from your repo. Before doing any more code changes, you need to resolve that disconnect, otherwise you're flying blind on Figma testing. Check in Figma Make settings what branch/repo it's actually watching.
Netlify is responding to your pushes correctly — focus testing there first. Once the lazy loading is in and Netlify confirms clean, then sort out the Figma sync.Yeah i feel like we got way too caught up on motion and recharts for no reason. I literally have one pie chart in each tournament page and thats it. its crazy how much work we did for such little nothing. what is the current flow of tournament pages, tabs, and phases right now? its gotta be pretty complex and we could solve it by having all tabs available on all phases but just show different things or "not available in this phase" type text. right? we may need to rebuild some of the tournament pages too idk. might be worth looking into each tournament code page to see if were referencing things that dont quite exist yet1:39 PMSynthesized tournament architecture to clarify structural complexitySynthesized tournament architecture to clarify structural complexityOkay, here's the full picture after reading through everything. You're right that it's gotten complex. Let me map it out plainly.

Current flow (what actually exists right now)
The tab rendering in tournament-hub-page.tsx has three completely separate branches:
Branch 1 — Bracket tab (always handled directly, any phase)
→ TournamentHubBracket
Branch 2 — isFinished is true (completed/archived)
→ Entire page delegates to TournamentHubHistory, which then internally renders its own versions of every tab using the KKupDetail* sub-components
Branch 3 — Everything else (upcoming through live)
→ Individually renders: TournamentHubOverview, TournamentHubPlayers, TournamentHubTeams, TournamentHubStaff
So you have two entirely different rendering systems for "the same page" depending on whether a tournament is finished or not. That's the core architectural problem. The finished path has its own data fetcher (fetchHistoricalData), its own state, its own sub-components. The live path has a completely different set. They share almost nothing.

What tabs exist per phase right now
PhaseTabs shownupcomingOverview, Players, Teams, Staffregistration_openOverview, Players, Teams, Staffregistration_closedOverview, Players, Teams, Staffroster_lockOverview, Players, Teams, StaffliveOverview, Players, Teams, Staff + Bracket (if bracket exists)completedOverview, Bracket, Teams, Players, Matches, Prizes, Staff, GalleryarchivedOverview, Bracket, Teams, Players, Matches, Prizes, Staff, Gallery
Notice that Matches, Prizes, and Gallery tabs don't exist at all for active tournaments — they only appear once isFinished is true. And the availableTabs array in tournament-state-config.ts never includes bracket, matches, prizes, or gallery in the pre-finished phases — those are hardcoded directly in tournament-hub-page.tsx instead of being driven by the config.

What's probably causing reference errors
TournamentHubHistory imports ALL the KKupDetail* components statically. Those components are the ones that were pulling in recharts. And TournamentHubHistory itself is a static import in tournament-hub-page.tsx. So even for an upcoming tournament, that entire finished-tournament component tree is bundled and initialized at load time — even though it'll never render.

Your instinct is exactly right
One set of tabs, always visible, content changes per phase. The simplest version of this looks like:

Overview — always shows something, content varies by phase (countdown, winner banner, registration CTA, etc.) — already works this way
Players — shows registered players if any exist, "registration hasn't opened yet" if upcoming
Teams — shows teams if any exist, empty state if none
Matches — shows "No matches yet" for pre-live phases, actual match data for live/finished
Bracket — shows "Bracket will be generated once rosters are locked" for early phases, actual bracket when it exists
Prizes — always shows the prize pool config (which you already have), awards section only shows for finished
Staff — always shows, content varies
Gallery — always shows, empty state if nothing uploaded

This collapses the two-branch system into one. TournamentHubHistory goes away entirely. The KKupDetail* sub-components either get merged into the tab files or replaced.

Before touching anything — do you want me to
Map out exactly which files need to be changed, what gets deleted, and what the new import structure looks like? That way you have a clear surgical plan rather than opening files and realizing mid-way how tangled things are.well lets brainstorm out the flow a little bit before we start hacking away. like whats a good smart and fun approach to these tournament pages, tabs, and phases given what we want to display? for example i think the bracket should always show if that makes sense like in the upcoming and registration phases it will just show the bracket with empty teams and seed numbers instead cause we want these tournaments to be stories and communicate things not just be a way to register, go play, done. like when you click on a tournament page, its current state should tell you everything you need to know about that tournament in its current state. is this tournament over with and archived and set in stone? is this one currently have live games that are going on? this one is upcoming? etc? what would the user want to see in all those cases? i hope that makes it more clear.1:45 PMRecognized design-focused brainstorm about tournament page architecture and information hierarchyRecognized design-focused brainstorm about tournament page architecture and information hierarchyThis is the right way to think about it. The tournament page isn't a form — it's a living document. Let me think through each phase from the perspective of "what does a user feel when they land here."

The Core Philosophy
Every phase has one dominant emotion you want to create:

Upcoming → Anticipation. "Something is coming. I want in."
Registration Open → Urgency. "I need to act now before I miss it."
Registration Closed → Tension. "The field is set. Who's going to win this?"
Roster Lock → Hype. "It's almost time. This is really happening."
Live → Excitement. "Games are happening RIGHT NOW."
Completed → Satisfaction/Drama. "This is how it ended. What a run."
Archived → Legacy. "This is history. This happened."

Every tab and every piece of content should serve that emotion.

The Bracket Idea — You're Absolutely Right
An empty bracket in the upcoming phase is actually a great storytelling device. You're saying "here are the 8 slots that will be filled." It creates a sense of destiny. Teams see their potential path. Players imagine where they'll end up. It's the same reason sports broadcast the bracket before the season starts.
So yes — bracket always visible, content just changes:

Upcoming/Registration → Empty bracket, seeded slots shown as "TBD", maybe greyed out team placeholders
Roster Lock → Bracket seeded with actual team names, no results yet
Live → Bracket with live results populating in real time
Completed/Archived → Bracket fully filled, winner highlighted


Tab-by-Tab Thinking
Overview — This is the "front page" of the tournament. Should always answer: what phase is this, what do I need to know right now, and what's my status in it. The countdown, winner banner, your registration status, live broadcast link — all phase-driven. This one you already have mostly right.
Bracket — As above. Always show it. Empty is fine. The story of the bracket developing over phases is the whole point.
Teams — Pre-registration: "No teams yet — be the first to register." Registration open: shows teams forming in real time, approval badges. Roster lock+: rosters are finalized, show full rosters. Live: show win/loss records next to each team. Completed: show final standings.
Players — Pre-registration: shows who's signed up as free agents, gives the "community is gathering" feel. Registration/roster lock: shows team rosters building. Live: maybe highlight top performers if you have live data. Completed: leaderboard, stats, awards.
Matches — This one actually tells the tournament's story better than anything. Pre-live: "Matches will be scheduled soon" with maybe a projected schedule placeholder. Live: live scores, ongoing series. Completed: full match history with results, series scores.
Prizes — The prize pool is a hook. Show it always. During registration it's a motivator to sign up. During live it's the stakes. During completed it shows what was won and who won it. This tab should never be hidden.
Staff — Always show. Pre-tournament: "We're looking for staff, apply here." During tournament: here's your crew. After: credits roll, acknowledge the people who ran it.
Gallery — Always show. Pre-tournament it's empty with a "Photos will be added during and after the tournament" message. During/after: photos from the event. Gives the tournament a scrapbook feel over time.

What This Means Architecturally
You collapse the two-branch system. One page, one set of tabs, each tab gets a phase prop and decides what to render. The tabs don't disappear — they just show different content. The phase config still drives the behavior flags (canRegister, isMutable, etc.) but it stops controlling which tabs are visible.
The TournamentHubHistory component and the separate KKupDetail* sub-component system probably fold into the main tab files. Instead of "here's the live version of Teams and here's the archive version of Teams in a completely separate component," you just have TournamentHubTeams that knows how to render for both cases.

One Thing Worth Deciding Before Code
The current setup has two different data sources depending on phase:

Pre-finished: multiple separate API calls on mount
Finished: one big /kkup/:id call that returns everything

You want to pick one strategy. The single bulk fetch for finished tournaments is actually cleaner and faster. Worth considering whether you want to move everything to that pattern — one fetch on mount that returns the full tournament snapshot, then tabs just read from that data. Simpler, fewer loading states, fewer race conditions.
What's your gut on that? And are there any tabs I described above where you'd want something different than what I outlined?oh and what about the stats tab? do we even have that still? if so i think that should be brought over to the players tab when the phase hits completed+you pretty much nailed the idea of it tho so great job on that. one note ill also add is that completed and archived are pretty much the same altho archived means that the data has been manually verified by me and i can confidently stamp this kernel kup into the history books. thats when we will send data to the hall of fame and update things there. cause we want a smooth and slick transition to the hall of fame as well with these t pages. im not sure how we write to the hall of fame right now but im sure we could tie it into this and keep whatever manual method we have for me. but yeah whats the vibe now? can you do some more research1:50 PMSynthesized stats tab integration and Hall of Fame archival workflowSynthesized stats tab integration and Hall of Fame archival workflowGood news and interesting news. Let me tell you what I found.

The Stats Tab
Yes it still exists — it's KKupDetailPlayerStats and it lives inside TournamentHubHistory, so it currently only appears for completed/archived tournaments. It shows aggregated per-player stats (KDA, GPM, XPM, hero damage, etc.) plus a coaches section. Your instinct to fold it into the Players tab is exactly right. Once a tournament hits completed+, the Players tab becomes a stats leaderboard. Pre-completed it's just the roster/free agent view. Same tab, same button, different content. Clean.

The Hall of Fame — This Is The Interesting Part
There is no "write to hall of fame" mechanism. The Hall of Fame is purely a read/aggregate system. It queries live from:

kkup_tournaments
kkup_matches
kkup_player_match_stats
kkup_team_rosters
kkup_master_teams
kkup_tournament_staff

...and aggregates everything on the fly. Every tournament in the database that has data shows up in the Hall of Fame automatically. There's no separate table, no "publish" button, no stamp.
So what archived currently means technically is nothing special to the HoF — it reads completed and archived the same way.

The Transition You're Describing
What you're envisioning is basically this:
Completed → Tournament is over, results are in, but data might still be getting cleaned up (scraping match data, fixing hero names, verifying scores). The HoF probably shouldn't show it yet or should show it with a "pending verification" flag.
Archived → You've personally verified everything. Data is clean. This is the official record. The HoF shows it in full, with all stats, all awards, everything.
Right now neither of those things is enforced. The HoF just shows everything regardless of status. So a tournament in completed with bad data would show up just as prominently as a clean archived one.
The fix is simple — add a filter to the HoF queries: only aggregate from tournaments where status = 'archived'. That makes your archive action genuinely meaningful. When you flip a tournament to archived, it appears in the Hall of Fame. Until then it doesn't. That's your stamp.

Full Revised Vision
Here's how I'd describe the complete flow now:
Tournament Page is the story of the tournament as it's happening. All tabs always visible. Content grows richer as phases progress. Stats fold into Players at completed+. Bracket always shows, fills in over time.
Completed phase is your working/verification period. Tournament is done, you're scraping and cleaning the data. The tournament page shows full results, but it's not in the Hall of Fame yet.
Archive action is you saying "this is canon." That single status change causes the tournament to appear in the Hall of Fame automatically, because the HoF only reads archived tournaments. No separate write needed — the filter does the work.
Hall of Fame is the permanent record. Only clean, verified, archived tournaments. The transition from the tournament page to seeing it there should feel significant — maybe even the tournament page itself shows a little "Now in the Hall of Fame 🏆" banner once archived.

Does that match what you're going for? If so the two things to actually build are: (1) the unified tournament page rebuild, and (2) add the status = 'archived' filter to the HoF queries. The second one is like a 10 minute backend change.yeah that sounds great. but back to the errors and that issue. how will restructuring our tournament pages and spending a few hours on that fix these errors potentially? Our tournament pages have been dead for 2 days now which is pretty annoying, although folks can still see the HOF so thats good but we can't take registrations right now cause folks cant click on the tournament cards and have the page properly load. So what is our final plan of attack on that and how does that fit into our guidelines document and what do we need to change in our guidelines document1:54 PMWeighed immediate lazy-loading fix against long-term restructuring strategyWeighed immediate lazy-loading fix against long-term restructuring strategyOkay let's be really clear and direct here because you've had dead tournament pages for 2 days and that needs to end today.

Why the restructure fixes the error
The TDZ crash happens because Figma's bundler takes tournament-hub-page.tsx and all of its static imports — every tab component, every modal, TournamentHubHistory and all its KKupDetail* children — and tries to initialize them all simultaneously in a single flat chunk. Some of those modules reference things from other modules before those things exist yet. That's the TDZ race. It's not a logic bug in your code, it's a module initialization order problem triggered by the sheer weight of what's being imported all at once.
The restructure fixes it because lazy loading means those components don't exist in the initial bundle at all. They're separate chunks fetched on demand. The initial load only has tournament-hub-page.tsx itself plus TournamentHubOverview. Everything else loads when needed. Zero initialization race possible.

The two-phase plan
Phase 1 — unblock registrations TODAY (30-60 minutes)
Don't restructure anything yet. Just add lazy loading to the existing tournament-hub-page.tsx. This is a surgical find-and-replace on the imports:
tsx// ADD at the top
import { lazy, Suspense } from 'react';

// CHANGE these from static to lazy:
const TournamentHubPlayers = lazy(() => import('./tournament-hub-players').then(m => ({ default: m.TournamentHubPlayers })));
const TournamentHubTeams = lazy(() => import('./tournament-hub-teams').then(m => ({ default: m.TournamentHubTeams })));
const TournamentHubStaff = lazy(() => import('./tournament-hub-staff').then(m => ({ default: m.TournamentHubStaff })));
const TournamentHubHistory = lazy(() => import('./tournament-hub-history').then(m => ({ default: m.TournamentHubHistory })));
const TournamentHubBracket = lazy(() => import('./tournament-hub-bracket').then(m => ({ default: m.TournamentHubBracket })));
const KKupDetailPrizes = lazy(() => import('./kkup-detail-prizes').then(m => ({ default: m.KKupDetailPrizes })));

// Keep these static (always needed on load):
// TournamentHubOverview — static, it's the default tab
// All the modals — static is fine, they're small
Then wrap the tab content area in a single Suspense:
tsx<Suspense fallback={
  <div className="flex justify-center py-20">
    <Loader2 className="w-8 h-8 animate-spin text-harvest" />
  </div>
}>
  {/* existing tab rendering logic unchanged */}
</Suspense>
```

That's it. No other changes. This should kill the TDZ on both Netlify and Figma (once Figma actually syncs — that's still a separate problem you need to resolve).

**Phase 2 — the real rebuild (this week)**

Once pages are live again, do the full restructure we discussed. Unified tabs, all phases, stats folded into players, `TournamentHubHistory` deleted, HoF filtered to archived only. That's the clean version that Future Tate won't hate.

---

## The Figma sync problem is still blocking you

Even after Phase 1, Figma won't show any improvement until it picks up your commits. The bundle hash has been `e6c781ed8ea7c47250e5dbd20d40905b40c7bead` across every single one of your recent deploys. Nothing has changed on Figma's end in days. You need to go into Figma Make settings right now and verify what branch it's watching and manually trigger a republish. That's a blocker independent of all code changes.

---

## Guidelines changes needed

The current guidelines have a gap — they describe the one-tab-one-file rule but say nothing about how to load those tab files. Add this:
```
## 3. Lazy Loading Rule for Tab-Heavy Pages

Any page orchestrator with 4+ tab components MUST lazy-load all tab 
components except the default/first tab. Use React.lazy() + Suspense.

Static imports are only acceptable for:
- The default visible tab on load
- Utility files (types, configs, helpers)
- Small shared UI components under ~50 lines

This is not optional on pages deployed to Figma Sites. Figma's bundler
flattens static imports into a single chunk and is sensitive to ESM 
initialization order. Lazy loading moves tabs into separate chunks and
eliminates that race condition entirely.

Pattern:
  const HeavyTab = lazy(() => import('./heavy-tab').then(m => ({ default: m.HeavyTab })));
  
  <Suspense fallback={<TabLoader />}>
    {activeTab === 'heavy' && <HeavyTab {...props} />}
  </Suspense>
Also worth adding a note about TournamentHubHistory being an anti-pattern — a component that secretly owns its own data fetching and duplicates the entire tab system — so nobody accidentally creates something like it again.
Want me to write out the exact diff for Phase 1 so you can apply it in one shot?