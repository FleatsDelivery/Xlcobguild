# Tournament Phase Matrix - Redesign Tracker

> **Strategy:** Work row by row (phase by phase), left to right (tab by tab)  
> **Current Focus:** Row 6 (Completed Phase) - Building with real KK1-9 data  
> **Next Target:** 6C (Players tab for completed tournaments)

---

## Matrix Overview

| Phase \ Tab | A: T-card | B: Overview | C: Players | D: Teams | E: Matches | F: Bracket | G: Prizes | H: Gallery | I: Staff |
|-------------|-----------|-------------|------------|----------|------------|------------|-----------|------------|----------|
| **1. Upcoming**        | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ |
| **2. Reg_Open**        | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ |
| **3. Reg_Closed**      | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ |
| **4. Roster_Lock**     | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ |
| **5. Live**            | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ |
| **6. Completed**       | ✅ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ |
| **7. Archived**        | ✅ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ✅ | ⬜ |

**Progress:** 14 / 63 cells complete (22.2%) 🌽

---

## Completed Work

### ✅ Column A: Tournament Card (T-card)
- **A1-A4, A6-A7:** `ActiveTournamentCard` component
  - Beautiful banner images with gradient overlays
  - Player avatar bubbles with TCF+ rings
  - Registration counts, team counts
  - Phase-specific styling and CTAs
  - Backend enriched with `player_previews`, `registration_count`
- **Note:** A5 (Live phase) left unchecked for future tweaks

### ✅ Column H: Gallery Tab (H1-H7) - ALL PHASES COMPLETE!
- **Component:** `/src/app/components/tabs/tournament-gallery-tab.tsx`
- **Backend:** `GET /kkup/tournaments/:id/gallery` endpoint
- **Features:**
  - Responsive masonry grid (1-3 columns)
  - Shows ALL images from tournament folder (UI assets, logos, photos)
  - Click-to-open lightbox modal
  - Loading, error, and empty states
- **Phase-agnostic** - Same component works for all 7 phases!

### ✅ 6B: Overview Tab (Completed Phase)
- **Component:** `/src/app/components/tabs/tournament-overview-tab.tsx`
- **Backend:** `GET /kkup/tournaments/:id/overview` endpoint
- **Features:**
  - **Champion Hero Section** - Winning team spotlight with logo and gradient background
  - **Tournament Stats Grid** - Teams, Players, Matches, Duration (4-column responsive)
  - **Final Standings Podium** - Top 4 teams with placements (🥇🥈🥉4️⃣)
  - **Most Popular Heroes** - Top 5 heroes by pick count with hero avatars
  - **Top Players by KDA** - Top 10 players sorted by KDA (POPD Kernel criteria!)
    - Shows K/D/A breakdown, matches played, steam avatar
    - Gold/silver/bronze styling for top 3
  - **Tournament Description** - If provided
- **Backend stats calculation:**
  - Hero pick counts from match data
  - Player KDA rankings across all matches
  - Unique player counts
- **Status:** ✅ **READY TO TEST!**

---

## Gallery Tab - Universal Implementation

**Applies to ALL phases (H1-H7)** - Same component regardless of tournament status.

### Gallery Folder Naming Convention
- **ALL tournaments** use `kernel-kup-{N}/` folder structure
  - 5v5 Kernel Kups: `kernel-kup-10/`, `kernel-kup-11/`, etc.
  - 1v1 Heaps n Hooks: `kernel-kup-12/` (same naming, different branding)
- **Slug derivation:** Uses `slugifyTournamentName(tournament.name)`

### What Gallery Shows
- **Includes:** ALL images in the tournament folder:
  - UI assets (league_banner.png, league_large_icon.png, league_square_icon.png)
  - Team logos
  - Event photos, memories, highlights
- **Excludes:** Nothing! (Shows everything in the folder)

### Technical Implementation
- Backend endpoint: `GET /kkup/tournaments/:id/gallery`
- Supabase Storage `.list()` API to fetch folder contents
- Filters only by image file extensions (png, jpg, jpeg, gif, webp)
- Responsive masonry grid (`react-responsive-masonry`) - 1-3 columns
- Click-to-open lightbox modal with full-size viewer
- Loading, error, and empty states

**Status:** ✅ **IMPLEMENTED** (Ready to test!)

---

## Upcoming Phase (Row 1) - Planned Specs

### 1B: Overview Tab (Upcoming)
- Tournament description
- Event dates and times
- Format explanation (8-team SE, 1v1, etc.)
- Rules and guidelines
- Status: "Registration opens [date]"

### 1C: Players Tab (Upcoming)
- Empty state: "Registration opens [date]"
- OR: Early bird list if TCF+ early registration is open

### 1D: Teams Tab (Upcoming)
- Empty state: "No teams yet - registration not open"

### 1E: Matches Tab (Upcoming)
- Empty state: "No matches scheduled yet"

### 1F: Bracket Tab (Upcoming)
- Empty state: "Bracket will be generated when roster lock begins"

### 1G: Prizes Tab (Upcoming)
- Prize pool breakdown
- Donation widget (if enabled)
- Prize distribution rules

### 1H: Gallery Tab (Upcoming)
- Universal gallery component (see above)

### 1I: Staff Tab (Upcoming)
- Staff roster: Admins, Casters, Observers, Volunteers
- Role assignments

---

## Next Steps

1. ~~**Build Gallery Tab Component** → Marks off H1-H7 (7 cells at once!)~~ ✅ **DONE!**
2. ~~**Build Overview Tab (6B)** → Champion spotlight, stats, KDA leaderboard~~ ✅ **DONE!**
3. **Continue Row 6 (Completed):** 6C (Players) → 6D (Teams) → 6E (Matches) → 6F (Bracket) → 6G (Prizes) → 6I (Staff)
4. **Then adapt those components for other phases**

---

**Last Updated:** Current session  
**Current Sprint:** Row 6 (Completed Phase) - 6B ✅ DONE! → Next: 6C (Players Tab)