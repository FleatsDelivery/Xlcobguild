# XLCOB Discord Bot Setup

This Discord bot enables XLCOB members to submit MVP rank-up requests directly from Discord using the `/mvp` slash command.

## 🎯 What This Does

- Members can submit MVP screenshots for rank ups/downs/prestige via Discord
- Bot validates permissions (Corn Star+ can rank others)
- Screenshots are uploaded to Supabase Storage
- Requests appear in the web app at https://xlcob.com/requests for officer review

---

## 📋 Setup Instructions

### Step 1: Create Discord Application (5 minutes)

1. **Go to Discord Developer Portal**
   - Visit: https://discord.com/developers/applications
   - Click "New Application"
   - Name it "XLCOB Bot" (or whatever you like)
   - Click "Create"

2. **Get Application ID**
   - You're now on the application page
   - Copy the **Application ID** under "Application Information"
   - **Paste this into Figma Make when prompted for `DISCORD_APPLICATION_ID`**

3. **Get Public Key**
   - Still on the same page
   - Copy the **Public Key** under "Application Information"
   - **Paste this into Figma Make when prompted for `DISCORD_PUBLIC_KEY`**

4. **Create Bot User**
   - Click "Bot" in the left sidebar
   - Click "Add Bot" → Confirm
   - **IMPORTANT:** Under "Privileged Gateway Intents", you don't need to enable anything (we're using HTTP interactions, not gateway)
   - Click "Reset Token" → Confirm
   - Copy the **Bot Token** (you'll only see this once!)
   - **Paste this into Figma Make when prompted for `DISCORD_BOT_TOKEN`**
   - ⚠️ **NEVER share this token publicly!**

---

### Step 2: Deploy Edge Function to Supabase

1. **In Figma Make**, the Edge Function has been created at:
   ```
   /supabase/functions/discord-interactions/index.ts
   ```

2. **Deploy it manually through Supabase Dashboard:**
   - Go to: https://supabase.com/dashboard/project/zizrvkkuqzwzxgwpuvxb/functions
   - Click on "discord-interactions" function
   - Click "Deploy" (do NOT use Figma Make's deploy button)

3. **Your Interactions Endpoint URL** will be:
   ```
   https://zizrvkkuqzwzxgwpuvxb.supabase.co/functions/v1/discord-interactions
   ```

---

### Step 3: Set Interactions Endpoint in Discord

1. **Go back to Discord Developer Portal**
   - https://discord.com/developers/applications
   - Select your "XLCOB Bot" application

2. **Click "General Information" in left sidebar**

3. **Set Interactions Endpoint URL:**
   - Paste this URL:
     ```
     https://zizrvkkuqzwzxgwpuvxb.supabase.co/functions/v1/discord-interactions
     ```
   - Click "Save Changes"
   - Discord will send a test request to verify it works
   - If it succeeds, you'll see a green checkmark ✅

   **If verification fails:**
   - Make sure the Edge Function is deployed
   - Make sure `DISCORD_PUBLIC_KEY` secret is set correctly
   - Check Edge Function logs in Supabase Dashboard

---

### Step 4: Create Supabase Storage Bucket

1. **Go to Supabase Storage**:
   - https://supabase.com/dashboard/project/zizrvkkuqzwzxgwpuvxb/storage/buckets

2. **Create new bucket**:
   - Name: `mvp-screenshots`
   - **Public bucket**: ✅ Yes (screenshots need to be viewable)
   - Click "Create bucket"

---

### Step 5: Register the /mvp Command

Now we need to tell Discord about the `/mvp` command.

**Option A: Use the registration script (easiest)**

1. In your terminal, navigate to the Edge Function folder:
   ```bash
   cd supabase/functions/discord-interactions
   ```

2. Set environment variables:
   ```bash
   export DISCORD_APPLICATION_ID="your-application-id"
   export DISCORD_BOT_TOKEN="your-bot-token"
   ```

3. Run the registration script:
   ```bash
   deno run --allow-net --allow-env register-commands.ts
   ```

4. You should see:
   ```
   ✅ Commands registered successfully!
   🎉 /mvp command is now available in your Discord server!
   ```

**Option B: Use curl (if you don't have Deno)**

```bash
curl -X PUT \
  -H "Content-Type: application/json" \
  -H "Authorization: Bot YOUR_BOT_TOKEN" \
  -d '{
    "name": "mvp",
    "description": "Submit an MVP request for rank up/down or prestige",
    "options": [
      {
        "name": "user",
        "description": "The user to rank up/down or prestige",
        "type": 6,
        "required": true
      },
      {
        "name": "screenshot",
        "description": "MVP screenshot from Dota 2",
        "type": 11,
        "required": true
      },
      {
        "name": "action",
        "description": "Action to perform",
        "type": 3,
        "required": true,
        "choices": [
          { "name": "Rank Up", "value": "rank_up" },
          { "name": "Rank Down", "value": "rank_down" },
          { "name": "Prestige", "value": "prestige" }
        ]
      },
      {
        "name": "match_id",
        "description": "Dota 2 Match ID (optional)",
        "type": 3,
        "required": false
      }
    ]
  }' \
  "https://discord.com/api/v10/applications/YOUR_APPLICATION_ID/commands"
```

---

### Step 6: Invite Bot to Your Server

1. **Go to Discord Developer Portal**
   - Select your application
   - Click "OAuth2" → "URL Generator" in left sidebar

2. **Select scopes:**
   - ✅ `applications.commands`
   - ✅ `bot`

3. **Select bot permissions:**
   - ✅ Send Messages
   - ✅ Attach Files
   - ✅ Use Slash Commands

4. **Copy the generated URL** at the bottom

5. **Open URL in browser** and add bot to your XLCOB Discord server

---

## 🎮 Usage

Once setup is complete, members can use the command in Discord:

```
/mvp
  user: @jeffwonderpouch
  screenshot: [attach MVP screenshot]
  action: Rank Up
  match_id: 7234567890 (optional)
```

### Permission Rules:

- ✅ **Any member** can rank up themselves
- ✅ **Corn Star (rank 10) or Pop'd Kernel (rank 11)** can rank up/down others
- ✅ **Corn Star or Pop'd Kernel** can prestige other Corn Stars/Pop'd Kernels
- ❌ Lower ranks cannot rank other users

---

## 🔍 Troubleshooting

### "Invalid request signature" error
- Make sure `DISCORD_PUBLIC_KEY` is set correctly in Supabase secrets
- Verify the public key matches exactly from Discord Developer Portal

### "/mvp command not showing up"
- Make sure you ran the command registration script (Step 5)
- Try kicking and re-inviting the bot
- Wait 5-10 minutes for Discord to sync commands

### "Failed to upload screenshot"
- Make sure `mvp-screenshots` bucket exists in Supabase Storage
- Make sure bucket is set to **public**
- Check Edge Function logs for detailed error

### "Target user not registered in XLCOB"
- The mentioned user must sign in at https://xlcob.com first
- Their Discord account must be linked

### Check Logs:
- Supabase Edge Function logs: https://supabase.com/dashboard/project/zizrvkkuqzwzxgwpuvxb/functions/discord-interactions/logs
- Look for console.log messages showing the full request flow

---

## 🌽 You're Done!

Your Discord bot is now live! Members can submit MVP requests directly from Discord, and officers can review them at https://xlcob.com/requests.

**Next Steps:**
- Test the `/mvp` command in your Discord server
- Check that requests appear in the web app
- Verify screenshot uploads work correctly
