# ⚠️ Important: OpenDota API Limitation for Amateur Leagues

## The Problem

**OpenDota API does not track amateur/community leagues automatically.** 

When you try to scrape data, you're getting 0 matches because OpenDota's API only returns match data for:
- Official Valve tournaments (The International, Majors, etc.)
- Professional leagues that Valve has verified
- Leagues that have been manually added to OpenDota's database

Your Kernel Kup tournaments are **amateur leagues** that Valve/OpenDota doesn't automatically track.

---

## Correct League IDs (from your Dotabuff links)

| Tournament | League ID | Dotabuff Link |
|-----------|-----------|---------------|
| **Kernel Kup (Season 2)** | `16223` | [Link](https://www.dotabuff.com/esports/leagues/16223-kernel-kup) |
| **Kernel Kup 5** | `16273` | [Link](https://www.dotabuff.com/esports/leagues/16273-kernel-kup-5) |
| **Kernel Kup 6** | `16444` | [Link](https://www.dotabuff.com/esports/leagues/16444-kernel-kup-6) |
| **Kernel Kup 7** | `16767` | [Link](https://www.dotabuff.com/esports/leagues/16767-kernel-kup-7) |
| **Kernel Kup 8** | `18252` | [Link](https://www.dotabuff.com/esports/leagues/18252-kernel-kup-8) |
| **Kernel Kup: Heaps n' Hooks** | `18401` | [Link](https://www.dotabuff.com/esports/leagues/18401-kernel-kup-heaps-n-hooks) |

---

## What We've Added

✅ **"View on Dotabuff" button** - Lets users click through to Dotabuff to see the league page
✅ **Better error messages** - Explains why OpenDota has no data
✅ **Cover photo scraping** - Still works! Grabs the tournament banner from Dotabuff

---

## Solutions (Pick One)

### Option 1: Manual Match ID Entry (Recommended for now)
Since OpenDota doesn't have the data, we can:
1. Build a simple UI for owners to manually enter match IDs
2. Scrape individual match data from OpenDota using match IDs
3. This way you can still use OpenDota's detailed match stats

**Match IDs look like:** `7971234567` (10-digit numbers)
**You can find them on Dotabuff** under each match

### Option 2: Scrape Dotabuff HTML Directly (Complex)
We could build a Dotabuff HTML scraper, but:
- ❌ More prone to breaking (if Dotabuff changes their HTML)
- ❌ Slower (need to parse HTML instead of using API)
- ❌ Less data (Dotabuff shows less detail than OpenDota API)
- ✅ Would work for amateur leagues

### Option 3: Submit Leagues to OpenDota (Long-term)
- Submit your league IDs to OpenDota for tracking
- They may add automated scraping for future tournaments
- Won't help with past tournaments

---

## What Works Now

✅ **View on Dotabuff button** - Click through to see matches manually  
✅ **Cover photo scraping** - Tournament banners import automatically  
✅ **Edit modal** - Manually update prize pool, description, cover  
✅ **Fleats branding** - Everything looks great  

---

## Recommendation

I recommend we build **Option 1: Manual Match ID Entry**. Here's why:

1. **Quick to build** - Simple form for entering match IDs
2. **Best data quality** - Uses OpenDota's detailed match API
3. **One-time effort** - Enter match IDs once, data stays forever
4. **Works retroactively** - Can add past tournament data

Would you like me to build this? It would look like:
- "Add Match" button for owners
- Modal with simple input field for match ID
- Scrapes that specific match from OpenDota
- Adds to tournament automatically

---

## Current Status

Right now:
- ✅ UI is fully built and looks amazing
- ✅ Dotabuff links work
- ❌ OpenDota API scraper won't work for amateur leagues
- ⏳ Need manual match entry OR Dotabuff scraper

Let me know which direction you want to go! 🌽
