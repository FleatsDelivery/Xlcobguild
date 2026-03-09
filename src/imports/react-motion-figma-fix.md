Your GPT’s reasoning is mostly correct, but there are two subtle architectural details about React, Motion (Framer Motion successor), and **Figma Sites that change how I’d approach the fix.

I’ll walk you through the real situation and the safest plan.

🧠 First — What We Learned From Your Test

You removed Motion from:

tournament-hub-sections.tsx

and the crash still happened.

That tells us something extremely important:

The crash occurs before React even renders sections.tsx

So the culprit must exist higher in the import graph.

Your GPT correctly identified the two files at the top:

tournament-hub-page.tsx
tournament-hub-overview.tsx

These are the critical path files.

🚨 The Real Mechanism Causing the Crash

The error:

ReferenceError: Cannot access 'Pi' before initialization

means the JS engine encountered something like:

import { Pi } from "./math"

const animation = createSpring(Pi)

before the module defining Pi finished initializing.

This is a classic ESM initialization order issue.

Normally bundlers like:

Vite

Webpack

Next.js

handle this safely.

But **Figma Sites does something different:

It flattens modules into a single runtime chunk and reorders them.

That breaks libraries relying on strict initialization order.

Motion unfortunately relies on that order.

🔎 Why Removing Only Sections Didn’t Fix It

Your GPT nailed this part:

page.tsx imports AnimatePresence
overview.tsx imports motion

Even if sections.tsx is clean, the bundler still sees:

import { motion } from "motion/react"

and includes the Motion runtime.

That runtime is where Pi exists.

So the crash happens during module initialization, not during rendering.

That’s why React never even reaches your section component.

⚠️ The Part I Disagree With

Your GPT suggests:

Phase 1 – remove Motion from overview + page
Phase 2 – remove from tabs later

This may still fail.

Why?

Because Figma bundling is static.

If any file in the page tree imports Motion, the runtime still loads.

Meaning these still count:

tournament-hub-teams.tsx
tournament-hub-staff.tsx
tournament-hub-player-info-modal.tsx

Even if they render later.

So Option A could waste another debugging cycle.

🎯 My Recommendation (More Reliable)

Instead of incremental removal:

Remove Motion from the entire tournament subtree in one pass.

That means removing imports from exactly these five files:

tournament-hub-page.tsx
tournament-hub-overview.tsx
tournament-hub-teams.tsx
tournament-hub-staff.tsx
tournament-hub-player-info-modal.tsx

You already removed:

tournament-hub-sections.tsx

So that makes 6 total files.

Once those imports are gone:

import { motion } from 'motion/react'
import { AnimatePresence } from 'motion/react'

then the Motion runtime won't be bundled into the page at all.

Which eliminates the TDZ bug.

📊 Time Reality

This is actually not as bad as it sounds.

Typical changes per file:

motion.div → div
motion.span → span
AnimatePresence → remove wrapper
initial/animate/exit → CSS classes

Usually:

10–20 minutes per file

Total:

~1 hour

And then the problem is permanently solved.

🧠 One Important Insight

Your debugging actually exposed something valuable:

Motion + Figma Sites is unstable at scale.

It works fine for:

navbars
small cards
simple transitions

But complex pages like your tournament hub can break it.

Your CSS animation replacement is the right architecture for this platform.

🚀 My Plan If I Were Shipping This

Step 1 — finish the purge

Remove Motion from:

page
overview
teams
staff
modal

Step 2 — redeploy

Step 3 — verify:

#tournament-hub/<id>

loads without the Pi error.

Step 4 — leave Motion for the rest of the site.

Your navigation, inbox, etc can keep it.

🌽 One More Thing (Encouraging)

Your system is actually very well designed.

The fact you could isolate the issue down to:

tournament page subtree

means your component architecture is clean.

A messy codebase would make this impossible.

🧪 If You Want One Last 30-Second Confirmation Test

Before deleting everything:

Temporarily change one file:

import { motion } from "motion/react"

to

const motion = { div: "div" }

If the crash disappears immediately:

→ Motion runtime confirmed as the cause.

✅ My final verdict

Your GPT is 90% correct.

But instead of incremental steps, I’d go straight to removing Motion from the full tournament subtree to avoid another failed deploy cycle.

If you want, paste tournament-hub-page.tsx and I can show you the 3 lines most likely triggering the bundler crash.