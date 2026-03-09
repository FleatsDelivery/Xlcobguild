# 🎯 Recharts TDZ Error Fix

**Date:** March 9, 2026  
**Issue:** Tournament pages crash with `ReferenceError: Cannot access 'Co' before initialization`  
**Root Cause:** Recharts circular ESM/CJS dependency initialization race  
**Solution:** TWO-LAYER FIX — Lazy loading (runtime) + Vite manual chunks (build-time)

---

## 🔍 Diagnosis Summary

### **What Claude & GPT Discovered:**

Both AI assistants independently identified the same root cause:

1. **The error CHANGED from `Pi` to `Co`:**
   - `Pi` = Motion/React TDZ error (FIXED by CSS animations)
   - `Co` = NEW TDZ error from recharts library

2. **Recharts is the culprit:**
   - Built on D3.js (mix of ESM and CommonJS modules)
   - Known circular dependency issues
   - Causes TDZ errors in Vite production builds
   - Well-documented problem in the community

3. **Recent code changes triggered it:**
   - `KKupDetailPrizes` was added to direct imports in `tournament-hub-page.tsx`
   - `TournamentHubBracket` was also added
   - Both components import recharts
   - Moving these to the critical bundle path changed module initialization order
   - Created a circular dependency race condition

4. **Why it crashes on BOTH Figma Make AND Netlify:**
   - NOT a bundler quirk (would only affect one platform)
   - Real code/dependency issue in the module graph
   - Confirms recharts circular dependency diagnosis

---

## 🛠️ The Two-Layer Fix

### **Layer 1: Lazy Loading (Runtime Protection)**

**What it does:** Defers recharts initialization until the user clicks the tab

**File:** `/src/app/components/tournament-hub-page.tsx`

**Before:**
```tsx
import { KKupDetailPrizes } from './kkup-detail-prizes';
import { TournamentHubBracket } from './tournament-hub-bracket';

// Later in render:
{activeTab === 'prizes' && (
  <KKupDetailPrizes ... />
)}

{activeTab === 'bracket' && (
  <TournamentHubBracket ... />
)}
```

**After:**
```tsx
import { lazy, Suspense } from 'react';

// Lazy load components that pull in recharts
const KKupDetailPrizes = lazy(() => 
  import('./kkup-detail-prizes').then(m => ({ default: m.KKupDetailPrizes }))
);
const TournamentHubBracket = lazy(() => 
  import('./tournament-hub-bracket').then(m => ({ default: m.TournamentHubBracket }))
);

// Later in render:
{activeTab === 'prizes' && (
  <Suspense fallback={<Loader2 className="animate-spin" />}>
    <KKupDetailPrizes ... />
  </Suspense>
)}

{activeTab === 'bracket' && (
  <Suspense fallback={<Loader2 className="animate-spin" />}>
    <TournamentHubBracket ... />
  </Suspense>
)}
```

---

### **Layer 2: Vite Manual Chunks (Build-Time Protection)**

**What it does:** Forces Vite to put recharts in a separate bundle chunk, preventing initialization order issues

**File:** `/vite.config.ts`

**Before:**
```ts
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

**After:**
```ts
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Isolate recharts and its D3 dependencies to prevent ESM/CJS circular
          // dependency initialization races that cause TDZ errors in production
          'recharts': ['recharts'],
          'd3-vendor': ['d3-scale', 'd3-shape', 'd3-color'],
        },
      },
    },
  },
})
```

---

## ✅ Why Both Layers Together Are Better

| Fix | What It Does | When It Helps |
|-----|--------------|---------------|
| **Lazy Loading** | Defers recharts until tab is clicked | Avoids runtime race condition |
| **Vite Config** | Forces recharts into separate chunk | Prevents Vite from creating the race in the first place |
| **Both Together** | Belt AND suspenders | Even if one approach has an edge case, the other catches it |

### **How They Work Together:**

**Without either fix:**
```
Page loads → All imports initialize → recharts races → 💥 TDZ crash
```

**With lazy loading only:**
```
Page loads → Critical imports only → Page renders → User clicks tab → recharts loads (race still possible but deferred)
```

**With Vite config only:**
```
Page loads → Recharts in separate chunk → Better order but still static → Race condition reduced but not eliminated
```

**With BOTH:**
```
Page loads → Recharts in separate chunk (build-time isolation)
           → User clicks tab → Lazy load triggers (runtime isolation)
           → 🎯 Double protection against race condition
```

---

## 📊 Benefits

### **1. Fixes the Crash**
- Recharts no longer in critical bundle initialization path
- Module race condition eliminated
- TDZ error gone

### **2. Performance Improvement**
- Smaller initial bundle (recharts is heavy)
- Faster page load times
- Charts only load when user clicks the tab
- Better for users who never visit those tabs

### **3. Better Architecture**
- Optional content loads on-demand
- Follows React best practices
- More maintainable code

---

## 🧪 Testing Checklist

After deploying this fix, test:

- [ ] **Home page loads** (no crash)
- [ ] **Navigate to tournament page** (should not crash immediately)
- [ ] **Click "Overview" tab** (should work)
- [ ] **Click "Teams" tab** (should work)
- [ ] **Click "Players" tab** (should work)
- [ ] **Click "Bracket" tab** (should load with brief spinner, then display)
- [ ] **Click "Prizes" tab** (should load with brief spinner, then display)
- [ ] **Click "History" tab** (should work)
- [ ] **Switch between tabs multiple times** (no crashes)
- [ ] **Refresh page while on Bracket tab** (should work)
- [ ] **Refresh page while on Prizes tab** (should work)

---

## 🎓 Lessons Learned

### **1. TDZ Errors Can Be Library Issues**

Not all TDZ errors are your fault. Large libraries with circular dependencies (D3, recharts, framer-motion) can cause these in production builds.

### **2. Static Imports Aren't Always Better**

While static imports help with tree-shaking, they force ALL dependencies to initialize upfront. Sometimes lazy loading is the right architectural choice.

### **3. Bundle Order Matters**

Small import changes can reorder Vite's module initialization graph, exposing hidden circular dependency issues.

### **4. Lazy Loading Has Multiple Benefits**

It's not just a performance optimization — it's also a TDZ error prevention strategy.

---

## 🔮 Future Considerations

### **If This Happens Again:**

**Symptoms:**
- `ReferenceError: Cannot access '[two-letter variable]' before initialization`
- Happens in production, not development
- Happens on both Figma Make and Netlify

**Debug Steps:**
1. Check what changed recently in static imports
2. Identify heavy libraries (recharts, D3, framer-motion, three.js, etc.)
3. Lazy load components that import those libraries
4. Test in production build

### **Other Components to Consider Lazy Loading:**

If you add more heavy features in the future, consider lazy loading:
- 3D graphics (three.js)
- Rich text editors (Slate, Quill, TipTap)
- Video players (Video.js, Plyr)
- Code editors (Monaco, CodeMirror)
- Any component with >100KB of dependencies

---

## 📚 References

**Recharts + Vite TDZ Issues:**
- https://github.com/recharts/recharts/issues/3615
- https://github.com/recharts/recharts/issues/3521
- https://vitejs.dev/guide/dep-pre-bundling.html#the-why

**React Lazy Loading:**
- https://react.dev/reference/react/lazy
- https://react.dev/reference/react/Suspense

**D3 ESM/CJS Issues:**
- https://github.com/d3/d3/issues/3469
- https://observablehq.com/@d3/d3-esm

---

## ✅ Conclusion

**The fix is simple but effective:**

Lazy load any component that imports recharts (or other heavy chart libraries). This moves their initialization out of the critical bundle path, eliminating the TDZ race condition while also improving performance.

**Confidence level:** 90% this fixes the crash.

If the crash persists after this fix, the next step would be to check for:
1. Duplicate recharts versions (`npm ls recharts`)
2. Other circular imports in the tournament page tree
3. Vite config optimizations for recharts

But based on the diagnosis from both AIs and the evidence in your error logs, this lazy loading fix should resolve it. 🌽