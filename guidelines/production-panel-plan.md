# The Kernel Kup Remote Production Panel — Master Plan

> **Status:** Planning / Pin-in-it  
> **Priority:** Future (after core app stabilization)  
> **Author:** TCF Dev Session — Feb 24, 2026  
> **Depends on:** Phase E (auto-transitions), Phase F (Steam API live feed), stable tournament lifecycle

---

## Vision

A web-based production control panel that lets the Tournament Director and per-stream Producers manage every aspect of a Kernel Kup broadcast — overlays, scores, brackets, community commercials, stats, and announcements — without touching OBS directly. Casters just cast. Producers handle the information layer. The Director sees everything and can override any stream at any time.

The vibe: **pro-level production that feels corny, homey, and fun.** Inside jokes baked into the broadcast. Community commercials during breaks. A Corn Field aesthetic that's unmistakably ours.

---

## Architecture Overview

```
TOURNAMENT DIRECTOR (you)
│
├── Global Director Dashboard
│   ├── Multiview: see all streams at once
│   ├── Override any stream's overlay
│   ├── "ALL STREAMS TO BREAK" panic button
│   ├── Push announcements to all overlays
│   └── Schedule management (next match countdowns)
│
├── Per-Stream Producer Panels (one per caster team)
│   ├── Stream status (pre-show / live / on break / post-show)
│   ├── Score & series tracker (Team A 1-0 Team B)
│   ├── Overlay triggers (lower thirds, stat cards, draft overlays)
│   ├── "Go to break" → triggers break screen + community commercial
│   └── Steam API live data feed (auto-populated, producer chooses when to surface)
│
├── Output Targets
│   ├── Browser Source Overlay URLs (OBS displays these — one per stream)
│   ├── Website live tournament page (spectators see updates in real-time)
│   ├── Discord webhooks (match results, bracket updates, going-live alerts)
│   └── Optional: Twitch bot commands (!score, !bracket, !mvp)
│
└── Data Sources
    ├── Steam Web API (live game state, match results, player stats)
    ├── OpenDota API (detailed post-match stats, player histories)
    ├── Tournament DB (bracket, teams, rosters, standings)
    └── Pre-loaded assets (commercials, player cards, team logos, memes)
```

---

## How OBS Remote Control Works

### OBS WebSocket (built into OBS 28+)

OBS has a built-in WebSocket server (default port 4455). Any web app can connect and send commands:

- `SetCurrentProgramScene` — switch scenes (game view, break screen, pre-show, etc.)
- `SetSourceVisibility` — show/hide individual sources (overlay, webcam, chat)
- `TriggerMediaInput` — play a video file (community commercials!)
- `SetInputSettings` — change text, URLs, colors on sources
- `GetSceneList`, `GetCurrentProgramScene` — read current state

**npm package:** `obs-websocket-js`

### Remote Access Options

| Option | How it works | Complexity | Best for |
|--------|-------------|-----------|----------|
| **A: Browser Source Only** | No OBS control. OBS has a browser source URL that you control remotely via your web panel. You change what the URL shows, OBS just displays it. | Low | MVP / first tournament |
| **B: Tailscale VPN** | Free private network between all machines. Producer panel connects to each OBS instance over the VPN. | Medium | Full control, small team |
| **C: Cloud Relay** | Your server acts as middleman. Casters run a bridge app connecting their OBS → your server ← producer panel. | High | Scale, unreliable networks |

### Recommended Approach

**Start with Option A (browser source overlays).** Zero caster-side setup — they add one URL to OBS and never touch it. You control everything from the web panel. For actual scene switching (go to break, switch cameras), layer in Option B (Tailscale) for the next tournament.

---

## APIs & Technologies Involved

### Already Configured (secrets exist)
- **Steam Web API** (`STEAM_WEB_API_KEY`) — live game data, match results, player stats
  - `GetLiveLeagueGames` — real-time: draft, gold, XP, kills, towers
  - `GetMatchDetails` — post-game: full player stats, items, ability builds
  - `GetMatchHistory` — all matches for a league (bracket tracking)
  - `GetTournamentPlayerStats` — per-player tournament aggregates
- **Discord Webhook** (`DISCORD_WEBHOOK_GAMER_TV`) — push match results, brackets, alerts
- **Discord Bot** (`DISCORD_BOT_TOKEN`) — interactive commands, role management
- **OpenDota API** (`OPENDOTA_API_KEY`) — rich player data, match analysis

### New (would need setup)
- **obs-websocket-js** — npm package for OBS remote control
- **Tailscale / ZeroTier** — free VPN for remote OBS access (no API key needed)
- **Twitch API** — optional: update stream titles, run ads, chat bot (needs Twitch OAuth)

---

## Browser Source Overlay System

The core of the MVP. Each stream gets a unique overlay URL:

```
https://thecornfield.figma.site/overlay/stream-1
https://thecornfield.figma.site/overlay/stream-2
https://thecornfield.figma.site/overlay/stream-3
```

Each URL is a React page that:
1. Polls your backend for current overlay state (what to show, scores, stats)
2. Renders transparent overlays that OBS composites on top of the game feed
3. Animates in/out smoothly (Motion library)

### Overlay Components to Build
- **Scoreboard bar** — team names, logos, series score (e.g., "FTHOG 1 - 0 FOOP")
- **Lower third** — player name, team, hero, fun fact ("Sneetch: 47 Pudge games this month")
- **Draft overlay** — hero picks/bans as they happen (from `GetLiveLeagueGames`)
- **Gold/XP graph** — real-time advantage graph (from Steam API)
- **Break screen** — "We'll be right back" with countdown timer
- **Community commercial player** — plays pre-loaded video during breaks
- **Announcement banner** — scrolling text or pop-up for hype moments
- **MVP card** — post-game highlight card with stats
- **Bracket display** — current tournament bracket state

---

## Producer Panel UI Concept

### Per-Stream View (what each producer sees)

```
┌─────────────────────────────────────────────────┐
│ Stream 1: CasterA + CasterB                     │
│ Status: [PRE-SHOW] [LIVE] [BREAK] [POST-SHOW]   │
├─────────────────────────────────────────────────┤
│                                                  │
│  Current Match: FTHOG vs FOOP — Game 2 of 3     │
│  Series: FTHOG 1 - 0 FOOP                       │
│  [+1 FTHOG]  [+1 FOOP]  [Reset]                 │
│                                                  │
│  ┌──── Live Steam Data ────┐                     │
│  │ Gold Adv: +3.2k Radiant │                     │
│  │ Kills: 12 - 8           │                     │
│  │ Towers: 4 - 2           │                     │
│  │ Time: 23:41             │                     │
│  └─────────────────────────┘                     │
│                                                  │
│  Overlay Triggers:                               │
│  [Show Scoreboard] [Lower Third ▼] [Draft View]  │
│  [Show Stats Card] [Gold Graph] [Hide All]        │
│                                                  │
│  Break Controls:                                 │
│  [Go to Break] [Play Commercial ▼] [Countdown]   │
│  Commercial: "Membership Spotlight" ▼             │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Director View (what you see)

```
┌─────────────────────────────────────────────────────────┐
│ KERNEL KUP 11 — DIRECTOR DASHBOARD                      │
│ Tournament Status: LIVE — Day 1, Round 2                │
├────────────┬────────────┬────────────┬──────────────────┤
│ Stream 1   │ Stream 2   │ Stream 3   │ Schedule         │
│ 🟢 LIVE    │ 🟡 BREAK   │ ⚪ STANDBY │                  │
│ FTHOG v    │ Team3 v    │ Next:      │ 7:00 PM Opening  │
│ FOOP       │ Team4      │ Team5 v    │ 7:15 PM Round 1  │
│ Game 2     │ Commercial │ Team6      │ 8:30 PM Round 2  │
│ 1-0        │ playing... │ ~15 min    │ 9:45 PM Round 3  │
│ [Override] │ [Override] │ [Go Live]  │ 11:00 PM Finals  │
├────────────┴────────────┴────────────┴──────────────────┤
│ GLOBAL CONTROLS                                         │
│ [🚨 ALL BREAK] [📢 Announce All] [🔄 Refresh All Data] │
│ [Discord: Post Bracket Update] [Website: Update Live]   │
└─────────────────────────────────────────────────────────┘
```

---

## Community Commercials — Ideas & Concepts

The secret sauce. Pre-rendered 15-30 second videos that play during breaks.

### Types of Commercials
- **"Did You Know?"** — fun community stats ("Did you know Sneetch has played 2,847 hours of Pudge?")
- **Membership Spotlight** — casual breakdown of TCF membership tiers and perks
- **Custom Game Promos** — 30-sec clips of TCF custom games with community reactions
- **Player Spotlights** — "Meet [player]" mini-profiles with their rank journey and favorite hero
- **Running Gags** — a recurring bit that gets more absurd each break (this is the corn field way)
- **Community Clip Reels** — best plays, worst plays, funniest moments from past Kernel Kups
- **Sponsor-Style Parodies** — fake sponsor ads for in-jokes ("This break brought to you by PENIS clan")
- **Tournament Hype** — montage of previous KKup highlights set to music

### Technical Implementation
- Pre-rendered as MP4 files
- Stored in Supabase Storage (you already have the bucket system)
- Producer panel has a playlist/queue — pick which commercial plays next
- Triggered via browser source overlay (video element) or OBS Media Source (via WebSocket)
- Could also auto-rotate on a timer during extended breaks

---

## Event Program Planning (Think About This)

Before building the panel, nail down what a broadcast day looks like:

### Sample Kernel Kup Broadcast Day
```
6:00 PM  — Producers online, test overlays, check OBS
6:30 PM  — Pre-show countdown on all streams
6:45 PM  — Opening ceremony / welcome overlay
7:00 PM  — Round 1 matches begin (2-3 simultaneous streams)
          — Steam API auto-detects live games
          — Bracket auto-updates as games finish
~7:45 PM — Between-game breaks (community commercials rotate)
8:00 PM  — Round 1 Game 2s (if BO3)
~8:45 PM — Round 1 results → Discord webhook → bracket update
9:00 PM  — Round 2 begins
          — Producer switches lower thirds for new matchups
~10:00PM — Round 2 results
10:15 PM — Finals pre-show (hype video, player introductions)
10:30 PM — Grand Finals
~11:30PM — Winner announcement → WinnerBanner on website
          — Post-show: stats, MVPs, community reaction
12:00 AM — Wrap-up, VODs processing
```

### Questions to Answer
1. How many simultaneous streams? (Determines producer count)
2. BO1 or BO3 for each round? (Affects timing and break frequency)
3. Who are your caster pairs? (Need to plan assignments)
4. What's the break cadence? (Every game? Every round? Ad-hoc?)
5. What inside jokes MUST make it into the broadcast?
6. What's the pre-show and post-show format?

---

## Development Phases (Where This Fits in the Roadmap)

### Current: Core App Stabilization
- Fix registration bugs (cyclic JSON error, etc.)
- Test all tournament phases with real data
- Backward phase transitions for testing
- Polish existing UI/UX

### Phase E: Auto-Phase Transitions
- `computeEffectivePhase()` on frontend
- Lazy backend auto-transition on read
- Countdown timer triggers real phase changes
- **This is the foundation everything else builds on**

### Phase F: Steam API Live Integration
- Poll `GetLiveLeagueGames` for active matches
- Auto-detect live status
- Live scoreboard component on website
- Match result auto-detection
- Discord webhook: auto-post match results

### Phase G: Producer Panel MVP
- Multi-stream dashboard
- Per-stream score/series controls
- Browser source overlay system (transparent React pages)
- Basic overlay components: scoreboard, lower third, break screen, countdown
- Director global controls
- Community commercial playlist (upload MP4s, trigger playback)

### Phase H: Producer Panel Advanced
- Steam API data → overlay-ready stat cards
- Draft overlay (live picks/bans)
- Gold/XP graph overlay
- Player spotlight cards (auto-populated from DB)
- Pre-show / post-show sequences
- OBS WebSocket integration via Tailscale (direct scene control)

### Phase I: Membership & Early Access
- Paid tier system
- `registration_early_access_start` datetime
- Tier-gated registration logic
- Member-only website features

### Phase J: Bot Ecosystem
- Discord bot: live updates, bracket commands, !register
- Twitch bot: !score, !bracket, !mvp, !nextmatch
- Same data sources as producer panel and website

---

## Key Decisions to Make (Not Now, But Eventually)

- [ ] How many streams per tournament day?
- [ ] Caster pair assignments — fixed or rotating?
- [ ] Overlay aesthetic — corn theme? Clean esports? Deliberately janky?
- [ ] Break screen design — animated? Static? Video loop?
- [ ] Community commercial pipeline — who creates them? What tools?
- [ ] OBS profile standardization — same scenes/sources across all caster machines?
- [ ] Audio: intro music, break music, hype moments? (Royalty-free or custom?)
- [ ] Tailscale vs browser-source-only for V1?

---

## Resources & Links

- [OBS WebSocket Protocol Docs](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md)
- [obs-websocket-js npm](https://www.npmjs.com/package/obs-websocket-js)
- [Tailscale (Free VPN)](https://tailscale.com/)
- [Steam Web API Docs](https://developer.valvesoftware.com/wiki/Steam_Web_API)
- [GetLiveLeagueGames](https://wiki.teamfortress.com/wiki/WebAPI/GetLiveLeagueGames)
- [Twitch API Docs](https://dev.twitch.tv/docs/api/)

---

*Pin placed. Come back to this after core app is stable and Phase E/F are done. The tournament needs to work before the broadcast can be cool.* 🌽
