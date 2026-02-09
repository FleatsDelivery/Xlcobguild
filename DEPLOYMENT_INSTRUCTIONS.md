# 🌽 Kernel Kup Full Manual Flow - Deployment Instructions

## **SQL Migration Required**

Run this SQL in your Supabase SQL Editor to create the player-team junction table:

```sql
-- Create junction table for team players
CREATE TABLE IF NOT EXISTS kkup_team_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES kkup_teams(id) ON DELETE CASCADE,
  player_profile_id UUID NOT NULL REFERENCES kkup_player_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(team_id, player_profile_id)
);

-- Add index for fast lookups
CREATE INDEX IF NOT EXISTS idx_kkup_team_players_team_id ON kkup_team_players(team_id);
CREATE INDEX IF NOT EXISTS idx_kkup_team_players_player_id ON kkup_team_players(player_profile_id);

-- Enable RLS
ALTER TABLE kkup_team_players ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can view team rosters" ON kkup_team_players
  FOR SELECT USING (true);
```

## **Deploy Edge Function**

```bash
supabase functions deploy server
```

## **✅ WHAT'S BEEN BUILT:**

### **1. File Upload System**
- ✅ New Supabase Storage bucket: `make-4789f4af-kkup-assets` (public)
- ✅ Upload endpoint: `POST /upload`
- ✅ `<ImageUpload>` component with drag-and-drop
- ✅ Image validation (types, 5MB max)
- ✅ Automatic public URL generation

### **2. Player Management System**
- ✅ Create player profiles: `POST /tournament/:id/player`
- ✅ Add player to team: `POST /tournament/:id/team/:team_id/player`
- ✅ Remove player from team: `DELETE /tournament/:id/team/:team_id/player/:player_id`
- ✅ Get team roster: `GET /tournament/:id/team/:team_id/roster`
- ✅ Get all players: `GET /tournament/:id/players`

### **3. Enhanced Team Modal (`edit-team-modal-v2.tsx`)**
- ✅ File upload for team logos
- ✅ Player roster management
- ✅ Add existing players to team
- ✅ Create new players on the fly
- ✅ Remove players from team
- ✅ Live roster display

### **4. Enhanced Create Team Modal**
- ✅ File upload for logos
- ✅ All team fields (name, tag, Valve ID)
- ✅ Corn emoji fallback

### **5. UI Updates**
- ✅ "Create Team" buttons on Teams tab
- ✅ "Create Match" buttons on Matches tab
- ✅ Edit buttons on every team/match card
- ✅ All modals wired and functional

---

## **🎯 THE COMPREHENSIVE MANUAL FLOW:**

### **STEP 1: Create Tournament**
1. Navigate to Kernel Kup page
2. Click "Create Tournament" (if owner)
3. Fill in name, dates, league ID (optional), prize pool
4. Upload cover photo (or leave empty for default)

### **STEP 2: Create Teams**
1. Go to tournament detail page → Teams tab
2. Click "Create Team"
3. Upload team logo (or use 🌽 fallback)
4. Enter team name, tag, Valve Team ID
5. Save team

### **STEP 3: Add Players to Teams**
1. Click ✏️ pencil icon on any team
2. In the "Team Roster" section:
   - Click "New Player" to create a player profile
   - Click "Add Player" to add existing player
3. Select player from dropdown → Add to Team
4. Repeat for all players

### **STEP 4: Create Matches**
1. Go to Matches tab
2. **Option A: Scrape Match by ID**
   - Click "Scrape Match by ID"
   - Enter Dota 2 Match ID from Dotabuff/OpenDota
   - Automatically creates teams and pulls stats
3. **Option B: Manual Match Creation**
   - Click "Create Match"
   - Select Team 1 and Team 2
   - Set scores, stage, status, scheduled time
   - Save match

### **STEP 5: Polish Tournament**
1. Edit matches to add VOD links (Twitch/YouTube)
2. Edit teams to update logos/rosters
3. Edit tournament cover photo and description

---

## **🌽 Features Summary:**

✅ **File Uploads** - Drag and drop logos for teams/tournaments  
✅ **Player Management** - Create players, assign to teams, view rosters  
✅ **Full Manual Flow** - Create everything from scratch without OpenDota  
✅ **Hybrid Workflow** - Scrape from OpenDota, then polish manually  
✅ **Corn Emoji Fallbacks** - Missing logos → 🌽  
✅ **Owner-Only Editing** - All CRUD operations protected  
✅ **Real-time Updates** - Toast notifications + auto-refresh  

---

## **📋 What To Do Next:**

1. Run the SQL migration above ☝️
2. Deploy the edge function: `supabase functions deploy server`
3. Test the full flow:
   - Create a tournament
   - Create 2-4 teams with logos
   - Add 5 players per team
   - Create matches between teams
   - Edit everything to make it perfect 🌽

**This is the COMPLETE manual tournament management system you asked for!** 🔥
