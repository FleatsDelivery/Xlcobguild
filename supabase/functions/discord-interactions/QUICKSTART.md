# 🌽 XLCOB Discord Bot - Quick Start

## For Server Admins (One-Time Setup)

1. **Get Discord Tokens** (5 min)
   - Go to: https://discord.com/developers/applications
   - Create app, get: Application ID, Public Key, Bot Token
   - Paste into Figma Make when prompted

2. **Deploy Edge Function** (1 min)
   - Go to Supabase Dashboard
   - Deploy `discord-interactions` function
   - **DO NOT use Figma Make deploy button!**

3. **Set Interactions URL** (1 min)
   - In Discord Dev Portal → General Information
   - Set URL: `https://zizrvkkuqzwzxgwpuvxb.supabase.co/functions/v1/discord-interactions`

4. **Create Storage Bucket** (1 min)
   - Supabase Storage → Create bucket
   - Name: `mvp-screenshots`
   - Make it PUBLIC

5. **Register /mvp Command** (1 min)
   - Run: `deno run --allow-net --allow-env register-commands.ts`
   - Or use the curl command in README.md

6. **Invite Bot** (1 min)
   - Discord Dev Portal → OAuth2 → URL Generator
   - Scopes: `applications.commands`, `bot`
   - Open URL, add to server

---

## For XLCOB Members (Daily Usage)

### Using the /mvp Command

```
/mvp @username [screenshot] action:[Rank Up/Rank Down/Prestige] match_id:[optional]
```

**Examples:**

**Rank yourself up:**
```
/mvp @jeffwonderpouch [screenshot] action:Rank Up match_id:7234567890
```

**Rank someone else up (requires Corn Star or Pop'd Kernel):**
```
/mvp @othermember [screenshot] action:Rank Up
```

**Prestige a Corn Star (requires Corn Star or Pop'd Kernel):**
```
/mvp @cornstar [screenshot] action:Prestige
```

---

## Permission Rules

| Action | Who Can Do It | Requirements |
|--------|---------------|--------------|
| Rank Up (self) | Any member | Must be registered at xlcob.com |
| Rank Up (others) | Corn Star or Pop'd Kernel | Target must be registered |
| Rank Down | Corn Star or Pop'd Kernel | Target must be rank 2+ |
| Prestige | Corn Star or Pop'd Kernel | Target must be Corn Star or Pop'd Kernel |

---

## What Happens After You Submit?

1. ✅ Bot validates your permissions
2. ✅ Bot uploads screenshot to Supabase Storage
3. ✅ Bot creates request in database (status: `pending`)
4. ⏳ Officers review request at https://xlcob.com/requests
5. ✅ Officer approves → Rank changes automatically
6. 🎉 You get notified in the web app!

---

## Troubleshooting

**"You must be registered at xlcob.com first!"**
→ Sign in with Discord at https://xlcob.com to create your account

**"You must be Corn Star or Pop'd Kernel to rank other users!"**
→ You can only rank yourself until you reach Corn Star (rank 10)

**"Target user is not registered in XLCOB!"**
→ The person you're trying to rank must sign in at xlcob.com first

**"User is already at max rank!"**
→ Use `/mvp action:Prestige` instead for Pop'd Kernel users

**Command not showing up?**
→ Wait 5-10 minutes, or try kicking and re-inviting the bot

---

## 🌽 Need Help?

- Check logs: https://supabase.com/dashboard/project/zizrvkkuqzwzxgwpuvxb/functions/discord-interactions/logs
- Contact server admins
- Review full README.md for detailed troubleshooting
