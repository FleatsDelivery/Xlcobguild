# Discord Webhook Integration Setup

## Overview
This integration allows MVP requests submitted on the XLCOB website to automatically post to Discord's #gamer-tv channel, then EDIT the same message when approved/denied (just like the Discord bot does).

## ✅ What's Already Done:

1. **Secret Created**: `DISCORD_WEBHOOK_GAMER_TV` environment variable
2. **Webhook Posting Code**: Added to `/supabase/functions/server/index.tsx` (lines 806-886)
3. **Webhook Editing Function**: `updateWebhookMVPMessage()` added (lines 1581-1690)
4. **Approval/Denial Integration**: Both endpoints now call the webhook update function

## 🔧 Required Database Changes:

You need to add these columns to the `rank_up_requests` table:

```sql
ALTER TABLE rank_up_requests 
ADD COLUMN IF NOT EXISTS webhook_id TEXT,
ADD COLUMN IF NOT EXISTS webhook_token TEXT;
```

These columns store the webhook ID and token extracted from the webhook URL, which are needed to edit messages later using the Discord Webhook API (webhooks can edit their own messages without needing bot permissions).

## 📝 Setup Instructions:

### Step 1: Create Discord Webhook

1. Open Discord → Go to The Corn Field server
2. Right-click **#gamer-tv** channel → **Edit Channel**
3. Click **Integrations** → **Webhooks** → **Create Webhook**
4. Name it: **"XLCOB Bot"** or **"XLCOB Notifications"**
5. (Optional) Set avatar to corn emoji or XLCOB logo
6. Click **Copy Webhook URL**

### Step 2: Add Webhook URL to Environment

The webhook URL looks like:
```
https://discord.com/api/webhooks/1234567890/AbCdEf...
```

Paste this URL into the `DISCORD_WEBHOOK_GAMER_TV` secret that was already created.

### Step 3: Add Database Columns

Run this SQL in your Supabase SQL Editor:

```sql
ALTER TABLE rank_up_requests 
ADD COLUMN IF NOT EXISTS webhook_id TEXT,
ADD COLUMN IF NOT EXISTS webhook_token TEXT;
```

## 🎨 How It Works:

### When MVP Request is Submitted on Website:

**Initial Message** (Yellow/Pending):
```
⬆️ MVP Request - Rank Up
<@123456> has submitted an MVP screenshot for Rank Up!

👤 Submitter: @Dr_Clayton
Private Maize (Prestige 0)

🎯 Target Player: @Dr_Clayton  
Private Maize (Prestige 0)

⚡ Action: ⬆️ Rank Up

📊 Status: ⏳ PENDING - Awaiting officer review

[Screenshot embedded below]

🌽 Submitted via XLCOB Website
```

### When Officer Approves in Admin Panel:

**Same Message Edited** (Green/Approved):
```
✅ MVP Request - Rank Up
<@123456> has submitted an MVP screenshot for Rank Up!

👤 Submitter: @Dr_Clayton
Private Maize (Prestige 0)

🎯 Target Player: @Dr_Clayton  
Specialist Ingredient (Prestige 0)  ← UPDATED RANK

⚡ Action: ⬆️ Rank Up

📊 Status: ✅ APPROVED by Tate

[Screenshot embedded below]

🌽 Submitted via XLCOB Website
```

### When Officer Denies:

**Same Message Edited** (Red/Denied):
```
❌ MVP Request - Rank Up
<@123456> has submitted an MVP screenshot for Rank Up!

👤 Submitter: @Dr_Clayton
Private Maize (Prestige 0)

🎯 Target Player: @Dr_Clayton  
Private Maize (Prestige 0)

⚡ Action: ⬆️ Rank Up

📊 Status: ❌ DENIED by Tate

[Screenshot embedded below]

🌽 Submitted via XLCOB Website
```

## 🔥 Benefits:

1. ✅ **Two-way Integration**: Website → Discord (this feature) + Discord → Website (existing)
2. ✅ **Same Format**: Matches Discord bot `/mvp` command format exactly
3. ✅ **Message Editing**: Updates the same message instead of spamming new ones
4. ✅ **User Mentions**: Tags Discord users so they get notified
5. ✅ **Color Coded**: Yellow=Pending, Green=Approved, Red=Denied
6. ✅ **Screenshot Preview**: Full MVP screenshot embedded in message
7. ✅ **Match ID Support**: Shows Dota match ID if provided

## 🚀 Future Enhancements:

You can extend this to other events:
- 🎉 New membership requests → #applications channel
- 🏆 Kernel Kup tournament updates → #gamer-tv channel  
- 👋 Welcome messages when users join XLCOB
- 📊 Weekly leaderboard snapshots

Just create more webhooks for different channels and add similar logic!

## 🐛 Troubleshooting:

**Message not posting?**
- Check that webhook URL is set correctly in environment
- Check server logs for errors
- Verify webhook hasn't been deleted in Discord

**Message posting but not updating?**
- Ensure database columns `webhook_id` and `webhook_token` exist
- Check that message ID is being stored in database
- Verify webhook URL format is correct

**Discord IDs not working?**
- Ensure users have `discord_id` column populated
- Check that Discord OAuth is capturing user IDs correctly

