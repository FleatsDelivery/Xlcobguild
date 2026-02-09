# 🌽 OpenDota Scraper Improvements & Manual Match Upload

## ✅ What Changed

### **1. Enhanced Debugging for Scraper**
Added better logging to understand why OpenDota isn't returning match data:
- Logs the full API URL (with API key hidden)
- Verifies if the league exists in OpenDota's database
- Logs detailed error responses from OpenDota API

### **2. Manual Match Upload Feature** ⭐
Created a new endpoint and UI for manually adding individual matches when OpenDota scraping doesn't work.

---

## 🎯 Why These Changes Matter

**The Problem:**
- Dotabuff shows ALL Dota 2 matches (they scrape everything)
- OpenDota only tracks **registered leagues** in their system
- Amateur leagues like "Kernel Kup" may not be in OpenDota's tracking system yet

**The Solution:**
- ✅ Better debugging shows why scraping fails
- ✅ Manual match upload allows you to add matches one-by-one using Match IDs
- ✅ Matches are fetched from OpenDota's Match API (which works even if the league isn't tracked)

---

## 🆕 New Backend Endpoint

### **POST** `/kkup/:kkup_id/add-match`
**Auth:** Owner only  
**Body:** `{ "match_id": "7891234567" }`

**What it does:**
1. Fetches match details from OpenDota Match API
2. Creates/updates teams automatically
3. Creates match record with scores and winner
4. Creates player stats for all 10 players
5. Updates team win/loss records

**Response:**
```json
{
  "success": true,
  "match_id": "7891234567",
  "stats_created": 10,
  "message": "Successfully added match 7891234567"
}
```

---

## 🎨 New UI Features

### **"Add Match Manually" Button**
- Located in the tournament header (owner only)
- Opens a modal to enter a Match ID
- Validates that the Match ID is a number
- Shows loading state while fetching from OpenDota

### **Modal Interface**
- Clean, simple input field
- Helpful description text
- Cancel and Add buttons
- Loading spinner during submission
- Toast notifications for success/errors

---

## 📊 Enhanced Scraper Logging

### **New Console Logs:**
```
🔍 Verifying league exists in OpenDota...
✅ League found in OpenDota: { name: "...", tier: "..." }
⚠️ League 12345 not found in OpenDota's database (Status: 404)
📡 OpenDota URL: https://api.opendota.com/api/leagues/12345/matches?api_key=***
```

### **Error Details:**
- Shows OpenDota API status codes
- Logs full error response body
- Helps diagnose if league is missing vs. API error

---

## 🔧 How to Use Manual Match Upload

### **Step 1: Get Match ID**
1. Go to Dotabuff:  
   `https://www.dotabuff.com/esports/leagues/YOUR_LEAGUE_ID`
2. Click on a match
3. Copy the Match ID from the URL or page

### **Step 2: Add Match**
1. Navigate to your tournament page
2. Click "Add Match Manually" (owner only)
3. Paste the Match ID
4. Click "Add Match"
5. Wait for confirmation toast
6. Match data appears automatically!

### **Example Match IDs:**
- `7891234567`
- `7891234568`
- `7891234569`

---

## ⚠️ Important Notes

### **Why OpenDota Might Not Have League Data:**
1. **Amateur League:** Not officially registered with OpenDota
2. **New League:** Just created, not indexed yet
3. **Private League:** Valve didn't share data with OpenDota

### **How Manual Upload Helps:**
- OpenDota's **Match API** works for ALL public Dota 2 matches
- Even if league isn't tracked, individual matches ARE available
- You can build your tournament stats match-by-match

### **What Gets Created:**
- ✅ Teams (auto-created from match data)
- ✅ Match record (winner, scores, timestamp)
- ✅ Player stats (K/D/A, GPM, XPM, etc.)
- ✅ Team standings (wins/losses updated)

---

## 🚀 Deployment Required

**Files Changed:**
- `/supabase/functions/server/index.tsx` - Backend endpoint & scraper logging
- `/src/app/components/kkup-detail-page.tsx` - Frontend UI & modal

**Deploy Command:**
```bash
supabase functions deploy server
```

---

## 📝 Testing Checklist

### **Scraper Improvements:**
- [ ] Try scraping with League ID
- [ ] Check console logs for verification messages
- [ ] See if league exists in OpenDota
- [ ] View detailed error messages if it fails

### **Manual Match Upload:**
- [ ] Click "Add Match Manually" as owner
- [ ] Enter valid Match ID
- [ ] See loading state
- [ ] Get success toast
- [ ] See match appear in tournament
- [ ] Verify teams were created
- [ ] Check player stats tab

### **Error Handling:**
- [ ] Try invalid Match ID (should show error)
- [ ] Try non-number input (should validate)
- [ ] Try match that doesn't exist (should show error from OpenDota)

---

## 💡 Next Steps

1. **Deploy the edge function:**  
   `supabase functions deploy server`

2. **Test the scraper:**  
   Click "Scrape OpenDota" and check console logs

3. **If scraping fails (no league data):**  
   Use "Add Match Manually" to add matches one-by-one

4. **Find Match IDs:**  
   Browse your league on Dotabuff and copy Match IDs

5. **Build your tournament:**  
   Add all matches manually until league gets indexed by OpenDota

---

## 🌽 What Happens Now

The scraper will tell you **WHY** it can't find data:
- ❌ "League not found in OpenDota's database"  
  → Use manual upload
- ❌ "No match data for this league"  
  → League exists but no matches indexed, use manual upload
- ✅ "Scraped X matches"  
  → Success! League is tracked

You now have a **fallback solution** when automated scraping doesn't work! 🎉
