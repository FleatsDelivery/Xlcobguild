# ✅ Updated Messaging: `/signup` → `/joinguild`

## What Changed

All references to `/signup` have been updated to `/joinguild` to reflect the correct Discord bot command and avoid confusion with the `/register` command used for tournament registration.

---

## Updated Locations

### **1. Discord Embed Title**
- ❌ **Old:** `⚠️ MVP Request - Awaiting Registration`
- ✅ **New:** `⚠️ MVP Request - Awaiting Guild Join`

### **2. Discord Embed Description**
- ❌ **Old:** `<@user> is not registered in XLCOB yet! **Action Required:** Please use the /signup command to create your account...`
- ✅ **New:** `<@user> is not in The Corn Field guild yet! **Action Required:** Please use the /joinguild command to join XLCOB...`

### **3. Discord Embed Status Field**
- ❌ **Old:** `⏳ Pending - Waiting for <@user> to register`
- ✅ **New:** `⏳ Pending - Waiting for <@user> to join the guild`

### **4. Discord Message Content**
- ❌ **Old:** `<@user> Please use /signup to register!`
- ✅ **New:** `<@user> Please use /joinguild to join the guild!`

### **5. API Error Response**
- ❌ **Old:** `Target user is not registered in XLCOB. A Discord message has been sent prompting them to sign up with /signup.`
- ✅ **New:** `Target user is not in The Corn Field guild. A Discord message has been sent prompting them to join with /joinguild.`

### **6. API Response Field**
- ❌ **Old:** `requiresSignup: true`
- ✅ **New:** `requiresGuildJoin: true`

### **7. Console Logs**
- ❌ **Old:** `Successfully sent Discord registration warning...`
- ✅ **New:** `Successfully sent Discord guild join warning...`

### **8. Function Comment**
- ❌ **Old:** `Helper function to send Discord warning when approval is blocked due to unregistered target`
- ✅ **New:** `Helper function to send Discord warning when approval is blocked due to target not in guild`

---

## Why This Matters

### **Clarity**
- Users understand they need to **join the guild** (via `/joinguild`)
- No confusion with tournament **registration** (via `/register`)

### **Accuracy**
- Reflects the actual Discord bot command: `/joinguild`
- Previous `/signup` command no longer exists or was renamed

### **Better UX**
- Clear call-to-action: "Join the guild"
- Consistent messaging across Discord embeds and error responses

---

## What Happens Now

When an officer tries to approve an MVP request for someone who hasn't joined the guild:

1. ✅ **Discord Embed Updates** with orange warning color
2. ✅ **Title:** "⚠️ MVP Request - Awaiting Guild Join"
3. ✅ **Description:** Clear instructions to use `/joinguild`
4. ✅ **Status:** "⏳ Pending - Waiting for user to join the guild"
5. ✅ **Ping Message:** "@user Please use `/joinguild` to join the guild!"
6. ✅ **API Response:** Returns `requiresGuildJoin: true` error

---

## Testing Checklist

1. ✅ Try to approve MVP for user not in guild
2. ✅ Verify Discord message shows: "Awaiting Guild Join"
3. ✅ Verify description mentions `/joinguild` (not `/signup`)
4. ✅ Verify status says "join the guild" (not "register")
5. ✅ Verify ping message says "join the guild" (not "register")
6. ✅ Verify console logs say "guild join warning"

---

## Files Modified

- `/supabase/functions/server/index.tsx` - Updated MVP approval blocking logic

---

All done! The messaging is now clear, accurate, and won't confuse users with tournament registration commands! 🌽
