# 🌽 MVP Request Two-Way Sync - Implementation Plan

## Current State Analysis

### Discord → Web Flow (`/mvp` command)
**Location:** `/supabase/functions/discord-interactions/index.ts`

**How it works:**
1. User runs `/mvp` command in Discord
2. Command creates database record
3. Command responds with **orange embed** (0xF97316)
4. Shows "⏳ Pending officer review" status
5. Has "View on Web App" button

**Message Format:**
```javascript
{
  title: "🌽 New MVP Request Submitted!",
  color: 0xF97316, // Orange
  fields: [
    { name: '👤 Requested By', value: '<@discord_id>', inline: true },
    { name: '🎯 Target Player', value: '<@discord_id>', inline: true },
    { name: '⚡ Action', value: '⬆️ Rank Up', inline: true },
    { name: '📊 Status', value: '⏳ Pending officer review', inline: true }
  ],
  image: { url: screenshot_url },
  timestamp: ISO string
}
```

---

### Web → Discord Flow (webhook)
**Location:** `/supabase/functions/server/index.tsx` lines 812-955

**How it works:**
1. User submits MVP on website
2. Creates database record
3. Sends webhook to `#gamer-tv` channel
4. Stores `discord_message_id` and `discord_webhook_url` in database

**Current Message Format (DIFFERENT!):**
```javascript
{
  title: "⬆️ New Rank Up Request", // Green/red/yellow based on action
  color: 0x10b981 or 0xef4444 or 0xfbbf24, // NOT ORANGE
  description: "User wants to rank up...",
  fields: [
    { name: '👤 Submitter', value: 'Username\nRank Name', inline: true },
    { name: '🎯 Target', value: 'Username\nRank Name', inline: true },
    { name: '⚡ Action', value: '⬆️ Rank Up', inline: true }
    // NO STATUS FIELD!
  ],
  image: { url: screenshot_url },
  footer: { text: '🌽 XLCOB • Review this request...' }
}
```

---

## The Problem 🐛

1. **Different Colors:**
   - Discord→Web: Orange (0xF97316) ✅
   - Web→Discord: Green/Red/Yellow ❌

2. **Missing Status Field:**
   - Discord→Web: Has "📊 Status: ⏳ Pending officer review" ✅
   - Web→Discord: No status field ❌

3. **Different Titles:**
   - Discord→Web: "🌽 New MVP Request Submitted!" ✅
   - Web→Discord: "⬆️ New Rank Up Request" ❌

4. **Field Names:**
   - Discord→Web: "👤 Requested By" and "🎯 Target Player" ✅
   - Web→Discord: "👤 Submitter" and "🎯 Target" ❌

---

## The Fix 🔧

### Phase 1: Make Web→Discord Match Discord→Web (Pending State)

**Update:** `/supabase/functions/server/index.tsx` lines 846-889

**Changes needed:**
```javascript
// OLD
color: actionColor, // Green/red/yellow
title: requestTitle, // Dynamic based on action

// NEW
color: 0xF97316, // Always ORANGE for pending
title: "🌽 New MVP Request Submitted!", // Always the same

// ADD Status field
fields: [
  { name: '👤 Requested By', value: '...', inline: true },
  { name: '🎯 Target Player', value: '...', inline: true },
  { name: '⚡ Action', value: '...', inline: true },
  { name: '📊 Status', value: '⏳ Pending officer review', inline: true } // NEW!
]
```

---

### Phase 2: Update Status Changes (Approved/Denied)

**Update:** `/supabase/functions/server/index.tsx` lines 1686-1743

**Changes needed:**
```javascript
// When APPROVED
color: 0x10b981, // Green
fields: [
  ...existing fields,
  { name: '📊 Status', value: '✅ Approved by ReviewerName', inline: false }
]

// When DENIED  
color: 0xef4444, // Red
fields: [
  ...existing fields,
  { name: '📊 Status', value: '❌ Denied by ReviewerName', inline: false }
]
```

---

### Phase 3: Two-Way Sync (Future Enhancement)

**Current gaps:**
- Discord reactions/buttons don't update the website ❌
- Website approval/denial DOES update Discord ✅

**To implement full two-way sync, we need:**
1. Discord Interactions endpoint to handle button clicks
2. Update database when officers click "Approve/Deny" in Discord
3. Listen to message component interactions
4. Call the same `/admin/mvp-requests/:id/approve` or `/deny` endpoints

---

## Files to Modify

1. **`/supabase/functions/server/index.tsx`**
   - Lines 846-889: Initial webhook embed (pending state)
   - Lines 1686-1743: Updated webhook embed (approved/denied state)

2. **Test both flows:**
   - Submit MVP from website → Check Discord message format
   - Approve/Deny from website → Check Discord updates correctly

---

## Success Criteria ✅

- [ ] Web→Discord pending messages are ORANGE (0xF97316)
- [ ] Web→Discord messages have "📊 Status: ⏳ Pending officer review" field
- [ ] Web→Discord titles say "🌽 New MVP Request Submitted!"
- [ ] Web→Discord field names: "👤 Requested By", "🎯 Target Player", "⚡ Action"
- [ ] Approved messages turn GREEN with "✅ Approved by X"
- [ ] Denied messages turn RED with "❌ Denied by X"
- [ ] Message format is identical whether submitted from Discord or Web

---

## Questions for Implementation

1. **Should we keep the avatar thumbnail?**
   - Discord→Web: No thumbnail
   - Web→Discord: Shows submitter's Discord avatar

2. **Should we keep the footer text?**
   - Discord→Web: No footer
   - Web→Discord: "🌽 XLCOB • Review this request..."

3. **Match ID display:**
   - Discord→Web: Shows in Action field if present
   - Web→Discord: Not shown

**Recommendation:** Match Discord→Web format exactly (no thumbnail, no footer, include match ID)
