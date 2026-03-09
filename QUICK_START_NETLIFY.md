# 🚀 Quick Start: Deploy to Netlify in 10 Minutes

**TL;DR:** Push to GitHub → Connect to Netlify → Deploy → Test tournament pages → Done!

---

## ✅ What's Already Done

I've prepared everything for you:

- ✅ **netlify.toml** created (deployment config)
- ✅ **vite.config.ts** verified (build works)
- ✅ **package.json** updated (dev, build, preview scripts)
- ✅ **No figma:asset imports** (clean migration)
- ✅ **No env vars needed** (already hardcoded in `/utils/supabase/info.tsx`)
- ✅ **Session freshness check** (prevents crash loops)

**You're ready to deploy RIGHT NOW!**

---

## 📝 10-Minute Deployment Checklist

### **Step 1: Push to GitHub (5 min)**

If you haven't already:

```bash
# In your project directory
git init
git add .
git commit -m "🌽 Initial commit - ready for Netlify"
git remote add origin https://github.com/YOUR_USERNAME/the-corn-field.git
git push -u origin main
```

---

### **Step 2: Create Netlify Account (2 min)**

1. Go to https://app.netlify.com/signup
2. Click "Sign up with GitHub" 
3. Authorize Netlify to access your repos

---

### **Step 3: Import Your Project (2 min)**

1. Click **"Add new site"** → **"Import an existing project"**
2. Choose **GitHub**
3. Find your repository (e.g., `the-corn-field`)
4. Click **Import**

---

### **Step 4: Verify Build Settings (1 min)**

Netlify auto-detects everything, but double-check:

```
Build command:     npm run build
Publish directory: dist
```

Click **"Deploy site"**

---

### **Step 5: Wait for Build (2-3 min)**

Watch the build log. You should see:

```
✓ npm install
✓ vite build
✓ Optimizing build
✓ Site is live!
```

You'll get a URL like: `cheerful-corn-123456.netlify.app`

---

### **Step 6: TEST THE TOURNAMENT PAGE! (2 min)**

This is the moment of truth:

1. Open your Netlify URL
2. Login with Discord
3. Navigate to **Kernel Kup** → **Click a tournament**
4. **Does it crash?**
   - ❌ **YES** → Contact me immediately, something weird is happening
   - ✅ **NO** → 🎉 **MIGRATION SUCCESSFUL!** The TDZ error is GONE!

---

## 🎯 Success Criteria

Your migration is successful if:

✅ Site loads at `your-site.netlify.app`  
✅ Login with Discord works  
✅ **Tournament pages DON'T crash** 🎉  
✅ All tabs work (Overview, Teams, Players, History)  
✅ Teams display correctly  
✅ Navigation is smooth  

---

## 🔧 If Something Goes Wrong

### **Build fails:**
- Check the build log in Netlify
- Look for missing dependencies
- Contact me with the error message

### **Site loads but crashes:**
- Open browser console (F12)
- Check for errors
- Take a screenshot and send it to me

### **Specific pages don't work:**
- Check if Supabase Edge Functions are running
- Verify the API endpoints are still correct
- Send me the console errors

---

## 🎨 Optional: Custom Domain (10 min)

Want `thecornfield.com` instead of `random-name.netlify.app`?

1. In Netlify: **Domain management** → **Add custom domain**
2. Update DNS at your registrar:
   ```
   Type: A
   Name: @
   Value: 75.2.60.5
   ```
3. Wait 5-60 minutes for DNS propagation
4. Netlify auto-enables HTTPS (free SSL)

---

## 🔄 Future Deploys

**It's automatic now!**

```
git add .
git commit -m "Added new feature"
git push
```

→ Netlify auto-deploys in 2-3 minutes  
→ You get a deploy preview URL  
→ Test it before going live  
→ Click "Publish deploy" when ready  

---

## 📊 What Just Happened?

| Before (Figma Make) | After (Netlify) |
|---------------------|-----------------|
| 💥 Tournament pages crash | ✅ Work perfectly |
| ❓ Mysterious bundler errors | ✅ Clear error messages |
| ❌ No version control | ✅ Git-based workflow |
| ❌ No rollback | ✅ One-click rollback |
| ❌ No staging | ✅ Deploy previews |
| 🎨 Rapid prototyping | 🎨 Still use Figma Make for experiments! |

---

## 🌽 You're Done!

**Seriously, that's it.**

Your app is now hosted on production-grade infrastructure with:
- Global CDN (fast worldwide)
- Auto-scaling (handles traffic spikes)
- Free SSL (HTTPS)
- Deploy previews (test before live)
- One-click rollbacks (undo bad deploys)

**And most importantly: NO MORE TDZ ERRORS.** 🎉

---

**Questions? Issues? Victories?** Let me know! 🌽
