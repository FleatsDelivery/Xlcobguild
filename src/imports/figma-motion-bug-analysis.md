Short answer: yes, it could be a temporary bug in either the Motion library or Figma’s bundler, but based on the symptoms you described, you should not rely on it fixing itself. Let me explain why.

1️⃣ Why this could be a Figma bundler bug

You mentioned you’re importing from:

motion/react

That comes from Motion (Framer Motion successor), which is designed primarily for modern bundlers like:

Vite

Webpack

Next.js

But Figma’s site builder / export environment uses its own bundling system, which:

sometimes evaluates ES modules in a different order

sometimes aggressively tree-shakes

sometimes reorders internal imports

That combination can trigger a TDZ error like:

Cannot access 'Pi' before initialization

Which strongly suggests:

module A imports Pi from module B
module B imports something from module A
bundler evaluates A before B
→ Pi not initialized yet

That type of bug often appears suddenly after a platform update.

So yes — in theory:

Motion releases patch

Figma fixes bundler ordering

Issue disappears

This does happen.

2️⃣ Why I think that’s not what’s actually happening

Your investigation revealed something important:

Only pages that do deep nested Motion usage crash.

Specifically:

page
 ├ overview
 │  └ sections
 │     └ 11 motion.div
 ├ AnimatePresence
 └ stagger animations

That pattern strongly suggests:

Motion’s runtime is being exercised in a way the environment can't safely evaluate.

Not necessarily a bug — just unsupported complexity for that runtime.

Key smoking guns you listed:

AnimatePresence

stagger delays

key-based animation resets

countdown timer re-rendering every second

That combo hammers the animation scheduler.

3️⃣ Why other pages work

Your observation here is very good.

Pages that work:

simple motion

loaded at app init

few motion nodes

Tournament pages:

nested motion trees

runtime re-renders

stagger orchestration

This increases the chance the bundler loads multiple Motion internals simultaneously, which is exactly where TDZ errors appear.

4️⃣ The real question: will it magically fix itself?

Possible: 10-15%

Reasons it might:

Motion releases patch

Figma changes bundler

cache clears

dependency resolution changes

Reasons it probably won’t:

this is runtime architecture friction, not just a bug

your usage pattern is heavy for Motion

Figma isn’t optimized for that library

5️⃣ Your GPT’s proposed fix is actually pretty reasonable

And importantly:

It’s surgical.

Only these:

tournament-hub-page
tournament-hub-overview
tournament-hub-sections
tournament-hub-teams
tournament-hub-players
tournament-hub-staff
tournament-hub-player-info-modal

Not the entire site.

And replacing motion with CSS animations is extremely stable.

6️⃣ But before deleting Motion, I would test ONE thing

This is a 10 minute diagnostic that could confirm the theory.

Inside tournament-hub-sections.tsx:

Temporarily change:

import { motion } from "motion/react"

to:

import { motion } from "framer-motion"

Because **Framer Motion and Motion are not bundled the same way.

If the crash disappears:

👉 it's 100% a Motion runtime / bundler issue

If it stays:

👉 it's animation complexity itself

This test is very high signal.

7️⃣ My honest recommendation

I would do this order:

Step 1 — 10 min test

Swap:

motion/react → framer-motion

on one tournament file.

Step 2 — if crash persists

Remove Motion only from tournament pages.

Leave it everywhere else.

Step 3 — later

If everything stabilizes:

You can re-introduce lightweight animation.

8️⃣ One last important thought

Your GPT’s diagnosis that Hall of Fame was a red herring is exactly correct.

That means your debugging instincts are good.

You correctly identified:

navigation path
component tree
runtime trigger

That’s real software debugging, not guesswork.

✅ If you want, paste one of these files:

tournament-hub-sections.tsx

or

tournament-hub-page.tsx

and I can spot the exact motion pattern most likely triggering the crash.
There are 2 specific Motion features that commonly cause TDZ errors — I can confirm if you're using them.