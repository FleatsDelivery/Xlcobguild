# 🌽 The Corn Field - Netlify Migration Guide

**Date:** March 9, 2026  
**Reason:** Figma Make bundler TDZ errors preventing tournament pages from loading  
**Expected Time:** 1 hour setup + testing

---

## ✅ Pre-Migration Checklist (Already Done!)

- [x] Vite config exists (`vite.config.ts`)
- [x] Build scripts in `package.json` 
- [x] No `figma:asset` imports found (all clear!)
- [x] Environment variables are in static file (`/utils/supabase/info.tsx`)
- [x] Netlify config created (`netlify.toml`)
- [x] Session freshness check implemented (prevents crash loops)

---

## 📋 Step-by-Step Migration

### **Phase 1: Netlify Account Setup (5 min)**

1. **Create Netlify Account**
   - Go to https://www.netlify.com
   - Sign up with GitHub (recommended for easy deploys)
   - Verify email

2. **Connect GitHub Repository**
   - Push your code to GitHub (if not already)
   - In Netlify dashboard: "Add new site" → "Import an existing project"
   - Select your GitHub repository

---

### **Phase 2: Configure Build Settings (5 min)**

Netlify will auto-detect Vite, but verify these settings:

**Build Settings:**
```
Base directory: (leave blank)
Build command: npm run build
Publish directory: dist
```

**Build Environment:**
- Node version: 20 (auto-detected from netlify.toml)

---

### **Phase 3: Environment Variables (10 min)**

⚠️ **CRITICAL**: These are already hardcoded in `/utils/supabase/info.tsx`, so you DON'T need to set them in Netlify!

**Already in your code:**
- ✅ `SUPABASE_URL` → hardcoded as `projectId` 
- ✅ `SUPABASE_ANON_KEY` → hardcoded as `publicAnonKey`

**These stay in Supabase Edge Functions (not Netlify):**
- `SUPABASE_SERVICE_ROLE_KEY` ← already configured in Supabase
- `SUPABASE_DB_URL` ← already configured in Supabase
- All other API keys (Discord, Stripe, Steam, etc.) ← already in Supabase

**So actually: NO environment variables needed in Netlify!** 🎉

---

### **Phase 4: First Deploy (5 min)**

1. **Trigger Deploy**
   - Click "Deploy site" in Netlify
   - Watch the build log (should take 2-3 minutes)

2. **Monitor Build**
   ```
   Expected output:
   ✓ installing dependencies
   ✓ building production bundle with Vite
   ✓ optimizing build
   ✓ site published
   ```

3. **Get Preview URL**
   - Netlify gives you: `random-name-123456.netlify.app`
   - This is your staging URL!

---

### **Phase 5: Testing Checklist (20 min)**

Test these BEFORE going live:

#### **Critical Paths:**
- [ ] Home page loads
- [ ] Login with Discord works
- [ ] Navigate to Profile → no crash
- [ ] Navigate to Leaderboard → no crash
- [ ] Navigate to Kernel Kup page → no crash
- [ ] **Navigate to a Tournament page** → **THIS SHOULD NOT CRASH** ✨
- [ ] Click through all tournament tabs (Overview, Teams, Players, History)
- [ ] Create a team (if registration open)
- [ ] Send a team invite
- [ ] Submit an MVP vote

#### **Navigation Tests:**
- [ ] All bottom nav buttons work (Home, Guild Wars, KKUP, Shop, Profile)
- [ ] Hamburger menu opens/closes
- [ ] Hash routing persists on refresh
- [ ] Session freshness check works (wait 60+ min or manually test)

#### **Data Integrity:**
- [ ] Teams display correctly
- [ ] Player stats load
- [ ] Giveaways show up
- [ ] Leaderboard rankings accurate

#### **Edge Functions:**
- [ ] Server endpoints still work (they're on Supabase, not Netlify)
- [ ] Check browser console for any 404s or CORS errors

---

### **Phase 6: Custom Domain (Optional, 10 min)**

If you want `thecornfield.com` instead of `random-name.netlify.app`:

1. **In Netlify Dashboard:**
   - Domain management → Add custom domain
   - Enter: `thecornfield.com`

2. **Update DNS (at your domain registrar):**
   ```
   Type: A
   Name: @
   Value: 75.2.60.5 (Netlify's load balancer)

   Type: CNAME
   Name: www
   Value: random-name-123456.netlify.app
   ```

3. **Enable HTTPS:**
   - Netlify auto-provisions Let's Encrypt SSL (takes ~1 min)

4. **Wait for DNS propagation** (5 min to 24 hours, usually <1 hour)

---

## 🔧 Build Configuration Details

### **What Gets Built:**

```
/dist
├── index.html         ← Entry point
├── assets/
│   ├── index-a1b2c3.js     ← Your React app (minified)
│   ├── index-d4e5f6.css    ← Tailwind styles
│   └── [images/fonts]      ← Static assets
└── ...
```

### **Build Process (what Netlify does):**

1. `npm install` → installs dependencies from `package.json`
2. `npm run build` → runs `vite build`
3. Vite compiles React + Tailwind → outputs to `/dist`
4. Netlify publishes `/dist` to their CDN
5. Your site is live! 🎉

---

## 🚨 Troubleshooting

### **Problem: Build fails with "Cannot find module"**

**Solution:**
- Check `package.json` — is the dependency listed?
- Run `npm install <missing-package>` locally
- Commit `package.json` changes
- Push to GitHub → auto-redeploy

---

### **Problem: Site loads but pages are blank**

**Solution:**
- Check browser console for errors
- Likely a missing environment variable or API endpoint issue
- Verify Supabase Edge Functions are still running

---

### **Problem: Tournament pages still crash**

**Solution:**
- Check the error message in browser console
- If it's STILL the `Pi` TDZ error → contact me, something very weird is happening
- If it's a NEW error → we can debug it (at least it's not a bundler mystery!)

---

### **Problem: Hash routing doesn't work**

**Solution:**
- Verify `netlify.toml` has the redirect rule:
  ```toml
  [[redirects]]
    from = "/*"
    to = "/index.html"
    status = 200
  ```
- This should already be in the file I created

---

## 🎯 Expected Results

### **What Should Happen:**

✅ **Build completes in 2-3 minutes**  
✅ **Site loads at `random-name.netlify.app`**  
✅ **Tournament pages DON'T crash** (the whole point!)  
✅ **All features work exactly like in Figma Make**  
✅ **You can rollback bad deploys with one click**  
✅ **Every Git push auto-deploys a preview**  

---

## 📊 Figma Make vs Netlify Comparison

| Feature | Figma Make | Netlify |
|---------|------------|---------|
| **Build time** | Instant | 2-3 min |
| **Debugging** | Minified errors | Clear error messages |
| **Rollback** | ❌ No | ✅ One-click |
| **Staging** | ❌ No | ✅ Auto deploy previews |
| **Custom bundler** | ✅ Yes (causes TDZ errors) | ❌ Standard Vite |
| **Tournament pages** | 💥 Crash | ✅ Should work |
| **Version control** | Manual sync | ✅ Git-based |
| **Cost** | Free | Free (for your usage) |

---

## 🔄 Hybrid Workflow (Recommended)

**Keep Figma Make for rapid prototyping:**

```
┌──────────────────┐
│  FIGMA MAKE      │  ← Experiment with new features
│  (Sandbox)       │    "Let me try this new modal..."
└────────┬─────────┘
         │ works great!
         ▼
┌──────────────────┐
│  GITHUB          │  ← Commit when feature is ready
│  (Source)        │    Proper version control
└────────┬─────────┘
         │ auto-deploy
         ▼
┌──────────────────┐
│  NETLIFY         │  ← Production for users
│  (Production)    │    thecornfield.com
└──────────────────┘
```

**Workflow:**
1. Build new features in Figma Make (fast iteration)
2. When working, copy code to local Git repo
3. Commit + push to GitHub
4. Netlify auto-deploys to production
5. If issues, rollback in Netlify (one click)

---

## 📞 Need Help?

If you hit ANY issues during migration:

1. **Check the build log** in Netlify (click the failed deploy)
2. **Check browser console** after deploying (F12 → Console tab)
3. **Ping me** with the error message and I'll help debug

---

## 🎓 Post-Migration Benefits

After successful migration, you'll have:

✅ **Stable tournament pages** (no more TDZ crashes)  
✅ **Professional deployment workflow** (Git → auto-deploy)  
✅ **Easy rollbacks** (if something breaks, one-click revert)  
✅ **Deploy previews** (test changes before going live)  
✅ **Better debugging** (real error messages, not minified mysteries)  
✅ **Custom domain** (thecornfield.com instead of figma.site)  
✅ **Production-grade hosting** (Netlify's global CDN)  

---

## 🌽 Final Notes

- **Supabase Edge Functions stay on Supabase** (no changes needed)
- **Database stays on Supabase** (no changes needed)
- **Auth stays on Supabase** (no changes needed)
- **Only the FRONTEND moves to Netlify** (where it should be!)

This migration is LOW RISK because:
- Your backend is already separate (Supabase)
- No database migrations needed
- No environment variable juggling (already hardcoded)
- Can always revert to Figma Make if needed

**But realistically: This should solve the TDZ error and make your life easier.** 🎉

---

**Good luck! You've built something awesome that's outgrown its first home. Time to graduate.** 🎓🌽
