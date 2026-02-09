# Kernel Kup Setup & Testing Guide 🌽

## What We Just Built

### 1. **Cover Photo Scraping** ✅
- Auto-scrapes cover photos from Dotabuff league pages during "Scrape OpenDota"  
- Tries multiple image patterns (og:image, image-league class, etc.)
- Falls back gracefully if image not found

### 2. **Owner Edit Modal** ✅
- Owners can manually set/update:
  - Cover Photo URL
  - Prize Pool
  - Description
- Live image preview
- Clean Fleats-branded modal design

### 3. **Fleats Branding** ✅
- Detail pages use proper Fleats colors:
  - BG Cream (#fdf5e9) backgrounds
  - Fleats Orange (#f97316) for primary actions
  - Dark Slate (#0f172a) for text
  - Rounded outline icons (Lucide)
  - Clean spacing and borders

### 4. **Tournament Names** ✅
- Fixed server endpoint to use correct database columns (`name` not `tournament_name`)
- Tournament cards now show actual names from database

### 5. **Scraper UX** ✅
- Added loading toast when scraping starts
- Shows success message with stats (matches, players, stats created)
- Auto-refreshes page after 1 second to show new data
- Clear feedback throughout the process

### 6. **Data Display** ✅
- Complete Dotabuff-style layout with tabs:
  - **Overview**: Final standings, tournament info
  - **Teams**: Team records and stats  
  - **Matches**: Match results with Dotabuff links
  - **Player Stats**: Full performance table (K/D/A, GPM, XPM, hero damage, etc.)

---

## Database Migrations to Run

Run this in **Supabase Dashboard → SQL Editor**:

```sql
-- Add prize_pool and cover_photo_url columns
ALTER TABLE kernel_kups ADD COLUMN IF NOT EXISTS prize_pool TEXT DEFAULT 'TBA';
ALTER TABLE kernel_kups ADD COLUMN IF NOT EXISTS cover_photo_url TEXT;

SELECT 'Added prize_pool and cover_photo_url columns! 🌽' AS message;
```

**Already run these:**
1. ✅ `001_kernel_kup_schema.sql` - Base tournament schema
2. ✅ `002_kernel_kup_player_stats_fixed.sql` - Player stats tables

---

## Testing the Scraper

### **Step 1: Run the Migration**
Copy and paste the SQL above into Supabase SQL Editor and run it.

### **Step 2: Navigate to a Tournament**
1. Go to `#kernel-kup` in your app
2. Click on any past tournament card (e.g., "KKUP 4" or "Heaps n' Hooks")
3. You'll be taken to `#kkup/{tournament-id}`

### **Step 3: Scrape Data (Owner Only)**
As an owner, you'll see a "Scrape OpenDota" button in the header.

1. Click **"Scrape OpenDota"**
2. You'll see a toast: "🌽 Starting scrape from OpenDota... This may take a minute!"
3. The button shows "Scraping..." with a loading spinner
4. Wait for completion (may take 30-60 seconds for tournaments with many matches)
5. Success toast shows: "✅ Successfully scraped X matches with Y player stats"
6. Page auto-refreshes and data appears!
7. **Cover photo is automatically scraped** from the Dotabuff league page!

### **What Gets Scraped:**
- ✅ **Cover photo** from Dotabuff league page (og:image meta tag)
- ✅ All matches from the league (using League ID)
- ✅ Teams (Radiant & Dire with logos, tags, Valve IDs)
- ✅ Match results (scores, winners, Dotabuff links)
- ✅ Player profiles (names, Steam IDs, Dotabuff URLs)
- ✅ Detailed stats per match:
  - K/D/A (kills, deaths, assists)
  - GPM/XPM (gold per minute, experience per minute)
  - Hero damage, tower damage, healing
  - Last hits, denies, level
  - Items, position played
  - Game duration

---

## Using the Edit Modal (Owner Only)

### **Step 1: Open Edit Modal**
On any tournament detail page, click the **"Edit"** button (owner only).

### **Step 2: Update Fields**
- **Cover Photo URL**: Paste a direct image URL (or let scraper auto-fill it)
- **Prize Pool**: e.g., "$500 + Discord Nitro"
- **Description**: Add tournament flavor text

### **Step 3: Preview & Save**
- Cover photo preview appears below URL input
- Click **"Save Changes"** to update
- Page refreshes with new data

---

## Corrected League IDs

Your correct League IDs (use these when testing):

| Tournament | League ID | Dotabuff Link |
|-----------|-----------|---------------|
| **KKUP 4** | `16233` ✅ | [Link](https://www.dotabuff.com/esports/leagues/16233) |
| **KKUP 5** | `16273` | [Link](https://www.dotabuff.com/esports/leagues/16273) |
| **KKUP 6** | `16444` | [Link](https://www.dotabuff.com/esports/leagues/16444) |
| **KKUP 7** | `16767` | [Link](https://www.dotabuff.com/esports/leagues/16767) |
| **KKUP 8** | `18252` | [Link](https://www.dotabuff.com/esports/leagues/18252) |
| **KKUP 9** (Heaps n' Hooks) | `18401` | [Link](https://www.dotabuff.com/esports/leagues/18401) |

---

## What to Test

### 1. **Tournament Listing Page** (`#kernel-kup`)
- ✅ Tournament names show correctly
- ✅ Descriptions show or fallback to default
- ✅ League IDs visible on cards
- ✅ Orange "View Details" buttons work
- ✅ Fleats branding (orange, cream, clean spacing)

### 2. **Tournament Detail Page** (`#kkup/{id}`)
- ✅ Tournament name in header (with Crown icon)
- ✅ Status badge (Completed, Live, etc.)
- ✅ Stats grid: Dates, Prize Pool, Teams, Matches
- ✅ Twitch/YouTube links (if applicable)
- ✅ Tab navigation works

### 3. **Scraping Flow**
- ✅ "Scrape OpenDota" button visible (owner only)
- ✅ Loading states work correctly
- ✅ Toast notifications appear
- ✅ Data refreshes after scrape
- ✅ Cover photo auto-scraped
- ✅ No infinite loading

### 4. **Edit Modal** (Owner Only)
- ✅ "Edit" button visible in header
- ✅ Modal opens with current values
- ✅ Cover photo preview works
- ✅ Save updates tournament
- ✅ Page refreshes after save
- ✅ Modal closes properly

### 5. **Data Tabs**
After scraping, check each tab:

#### **Overview Tab:**
- ✅ Final standings with team W-L records
- ✅ Win percentages calculated
- ✅ Champion highlighted in orange

#### **Teams Tab:**
- ✅ All teams listed
- ✅ Team names, tags shown
- ✅ Win-Loss records displayed

#### **Matches Tab:**
- ✅ All matches listed
- ✅ Match stage badges (playoffs, group_stage, grand_finals)
- ✅ Winner highlighted in green
- ✅ Dotabuff links work
- ✅ Match dates formatted correctly

#### **Player Stats Tab:**
- ✅ Full performance table
- ✅ Player names link to Dotabuff
- ✅ K/D/A color coded (green/red/blue)
- ✅ KDA calculated correctly
- ✅ Win/Loss badges
- ✅ Table scrollable on mobile

---

## Common Issues & Fixes

### **Issue: "Tournament Not Found"**
**Fix:** Make sure tournament ID in URL matches database ID

### **Issue: "No access token provided"**
**Fix:** You need to be logged in as an owner role

### **Issue: "Tournament does not have a league_id"**
**Fix:** Edit tournament in database to add League ID

### **Issue: Scraping takes forever**
**Expected:** Large tournaments (50+ matches) can take 1-2 minutes due to rate limiting (100ms delay between matches)

### **Issue: Some players show as "Player {account_id}"**
**Expected:** This happens when OpenDota doesn't have persona names. They'll still have Dotabuff links.

### **Issue: Cover photo not scraped**
**Possible causes:**
- Dotabuff changed their HTML structure (rare)
- League page doesn't have a cover image
- Network timeout
**Fix:** Use Edit modal to manually set cover photo URL

---

## Next Steps

Once scraping works, you can:

1. **Test with KKUP 4** (League ID 16233) - Start here!
2. **Scrape all past tournaments** to populate historical data
3. **Verify data accuracy** - spot check matches on Dotabuff
4. **Add prize pool info** via Edit modal for each tournament
5. **Update tournament descriptions** to be more specific
6. **Check cover photos** - manually update if auto-scrape missed any

---

## Technical Notes

### Cover Photo Scraping:
- Scrapes from `https://www.dotabuff.com/esports/leagues/{league_id}`
- Tries these patterns in order:
  1. `<img class="image-league" src="...">`
  2. `<meta property="og:image" content="...">`
- Automatically adds `https://www.dotabuff.com` prefix if needed
- Fails gracefully (logs warning, continues with match scraping)

### OpenDota API:
- **Endpoint:** `https://api.opendota.com/api/leagues/{league_id}/matches`
- **API Key:** `494e103d-e91c-4158-960d-1f866da3ea90`
- **Rate Limiting:** 100ms delay between match detail requests

### Database Tables:
- `kernel_kups` - Tournament metadata (includes `cover_photo_url` and `prize_pool`)
- `kkup_teams` - Teams per tournament
- `kkup_matches` - Match results
- `kkup_player_profiles` - Player profiles (shared across tournaments)
- `kkup_match_player_stats` - Individual match performance

### Server Endpoints:
- `GET /kkup/:id` - Get tournament details (public)
- `POST /kkup/scrape/:id` - Scrape OpenDota data (owner only)
- `PATCH /kkup/:id/update` - Update tournament (owner only)

### Features:
- ✅ Auto-creates teams if they don't exist
- ✅ Links players across tournaments via Steam ID
- ✅ Prevents duplicate matches (unique on match_id)
- ✅ Prevents duplicate player stats (unique on match_id + player_profile_id)
- ✅ Auto-scrapes cover photos from Dotabuff
- ✅ Owner can manually edit tournament details

---

## Ready to Test! 🚀

1. Run migration (add prize_pool and cover_photo_url)
2. Navigate to `#kernel-kup`
3. Click on KKUP 4 card
4. Click "Scrape OpenDota"
5. Watch the magic happen! ✨
6. Cover photo should appear automatically!
7. Try the Edit button to manually update fields

Let me know what happens! 🌽
