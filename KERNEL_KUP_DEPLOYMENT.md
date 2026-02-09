# 🌽 KERNEL KUP INTEGRATION - DEPLOYMENT CHECKLIST

## 📋 **STEP-BY-STEP DEPLOYMENT GUIDE**

### **STEP 1: Database Schema Migration**
**✅ Action:** Run SQL in Supabase Dashboard → SQL Editor

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Copy contents of `/database-migrations/001_kernel_kup_schema.sql`
3. Paste and click **Run**
4. Verify success message: `"Kernel Kup database schema created successfully! 🌽"`

**✅ What this does:**
- Creates 5 new tables: `kernel_kups`, `kkup_teams`, `kkup_registrations`, `kkup_team_members`, `kkup_matches`
- Adds indexes for performance
- Inserts historical Kernel Kup data (KK4-KK8, Heaps n' Hooks, KK10)

---

### **STEP 2: Update Discord Bot Commands**
**✅ Action:** Register new Discord slash commands

1. Navigate to `/supabase/functions/discord-interactions/`
2. Run the new command registration script:
   ```bash
   deno run --allow-net --allow-env register-all-commands.ts
   ```
3. Verify all 4 commands registered:
   - `/mvp` - Submit MVP requests (existing)
   - `/joinguild` - Join the guild (renamed from `/signup`)
   - `/leaderboard` - View leaderboard (existing)
   - `/register` - Register for Kernel Kup (NEW!)

**⚠️ IMPORTANT:** The bot handler already supports both `/signup` AND `/joinguild` for backward compatibility. Tell your community about the rename!

---

### **STEP 3: Deploy Updated Discord Bot**
**✅ Action:** Deploy `discord-interactions/index.ts` to Supabase

1. Go to **Supabase Dashboard** → **Edge Functions** → **discord-interactions**
2. Copy entire contents of `/supabase/functions/discord-interactions/index.ts`
3. Paste and click **Deploy**
4. Wait for deployment confirmation

**✅ What changed:**
- Added `/joinguild` command handler (with `/signup` fallback)
- Updated text to say "guild registration" instead of "registration"

---

### **STEP 4: Test Discord Commands**
**✅ Action:** Test in your Discord server

1. Type `/joinguild` → Should show guild registration modal
2. Type `/signup` → Should still work (backward compatibility)
3. Type `/register` → Should show role selection (player, coach, caster, spectator)

**✅ Expected:**
- `/joinguild` and `/signup` work the same way
- `/register` shows "Coming soon!" ephemeral message (will implement handler next)

---

### **STEP 5: Web App is Ready!**
**✅ Already Done:** 
- KKUP page exists at `/src/app/components/kkup-page.tsx`
- Navigation updated with Crown icon
- Both mobile menu and desktop nav have KKUP link

**🎉 You're ready for Phase 1!**

---

## 🚀 **WHAT'S NEXT - PHASE 1 BUILD**

Now that the foundation is in place, we'll build:

### **Phase 1A: KKUP Landing Page**
- Current tournament info (Kernel Kup 10)
- Registration status (Open/Closed)
- Countdown to tournament start
- "Register Now" button
- Team cards (placeholder)
- Past Kernel Kups history teaser

### **Phase 1B: Registration Flow**
- Modal with role selection
- Steam/OpenDota ID input for players
- Server endpoint: `POST /make-server-4789f4af/kkup/register`
- Success confirmation

### **Phase 1C: Discord `/register` Command Handler**
- Connect to registration endpoint
- Ephemeral response with registration status
- Link to web app for full registration

---

## 📊 **DATABASE SCHEMA OVERVIEW**

### **kernel_kups** (Tournament Instances)
- Stores each Kernel Kup (KK4, KK5, etc.)
- Tracks league_id (Valve tournament ID)
- Tournament status (registration_open, in_progress, completed)
- Dates: registration, start, end

### **kkup_registrations** (Individual Registrations)
- Links users to tournaments
- Role: player, coach, caster, spectator
- Steam/OpenDota IDs for players

### **kkup_teams** (Team Records)
- Team name, tag, Valve team ID
- Created by (coach)
- Win/loss record

### **kkup_team_members** (Team Rosters)
- Links users to teams
- Status: invited, accepted, declined
- Steam/OpenDota IDs

### **kkup_matches** (Match Schedule & Results)
- Stage: group_stage, playoffs, grand_finals
- Game mode: turbo, captains_mode
- Best-of: 1 or 3
- Results, winner, Dotabuff/YouTube links

---

## ❓ **QUESTIONS TO ANSWER BEFORE PHASE 1B**

1. **Historical Data**: Can you export your past Kernel Kup data (teams, rosters, Steam IDs) to a Google Sheet or CSV?
2. **Registration Flow**: Should registration require existing guild membership, or can anyone register?
3. **Team Creation**: Should coaches be able to create teams immediately, or only after registration?
4. **Validation**: Do you want real-time Valve/Steam ID validation, or just format checking?

---

## 🎯 **YOUR ACTION ITEMS NOW**

1. ✅ **Run the database migration** (Step 1)
2. ✅ **Register new Discord commands** (Step 2) 
3. ✅ **Deploy Discord bot update** (Step 3)
4. ✅ **Test commands in Discord** (Step 4)
5. ✅ **Tell me when Steps 1-4 are done** so I can start building Phase 1A!

---

**🌽 READY TO BUILD? Just say "database deployed, let's build Phase 1A!" and I'll start! 🌽**
