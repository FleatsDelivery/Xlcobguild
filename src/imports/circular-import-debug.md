Yep — this stack trace actually gives enough signal to narrow the problem down pretty confidently. Let’s break it down in a practical debugging order, not just theory.

1. The real crash: Cannot access 'Pi' before initialization

This is a JavaScript Temporal Dead Zone (TDZ) error.
It happens when a const or let variable is referenced before its module finished initializing.

In React apps this is almost always caused by a circular import.

Example:

// A.js
import { thing } from "./B"
export const componentA = () => thing()

// B.js
import { componentA } from "./A"
export const thing = () => componentA()

When the bundler loads this:

A -> loads B
B -> loads A
A isn't initialized yet
B tries to use A
💥 crash

That is exactly what "Cannot access X before initialization" means.

2. Where the crash is happening

From the stack:

ReferenceError: Cannot access 'Pi' before initialization
    at Roe (bundle.js:57481)

And React stack:

Roe
  -> main
  -> rd
  -> Sle

Important line:

New error in code-component (0:7)

This is Figma Sites telling you the error originated in your custom code component, not their runtime.

So the bug is 100% in your project code, not Supabase, not Discord auth.

3. Things that are NOT the problem

From your logs:

/auth/me response status: 200
Fetched user from database
Hall of Fame player data received: 52 players

Everything backend related is working fine.

The crash happens after data loads during render.

4. Your /auth/me firing 4 times

You noticed this already. Likely causes:

React Strict Mode

In dev builds React intentionally runs effects twice.

But 4 calls usually means two things combined:

• Strict mode double render
• component mounting twice

Example:

App render
AuthProvider mount
useEffect -> fetch

React strict rerender
AuthProvider mount
useEffect -> fetch

This is not the crash, just inefficiency.

You can fix later.

5. Where to look for the circular import

Based on your project structure from earlier discussions, the most likely culprits are:

Tournament config

Example bad pattern:

tournamentConfig.ts
   imports
useTournament.ts

useTournament.ts
   imports
tournamentConfig.ts
Shared lib utilities

Example:

lib/users.ts
  imports
lib/auth.ts

lib/auth.ts
  imports
lib/users.ts
React components referencing each other

Example:

HallOfFame.tsx
   imports
PlayerCard.tsx

PlayerCard.tsx
   imports
HallOfFame.tsx
6. Fast way to detect the circular dependency

Run this in your project:

npx madge --circular src

or

npm install madge
madge src --circular

It will output something like:

✖ Found 1 circular dependency

src/lib/auth.ts -> src/lib/users.ts

This saves hours of guessing.

7. Another common cause (especially with React)

Export order issue

Bad:

export const A = B + 1
export const B = 2

Good:

export const B = 2
export const A = B + 1

If a component references something declared later in the same module, the bundler can produce this error.

8. Why it only shows up in production

Minified builds reorder modules more aggressively.

So something that "works locally" breaks in production.

That's why your error shows:

Pi
Roe
Sle

Those are minified names.

9. One line in your logs is also interesting
<link rel=preload> uses an unsupported `as` value

This is harmless.

Ignore it.

10. The fastest fix strategy

Do this in order:

Step 1

Search for files that import each other.

CTRL + SHIFT + F

import .* from

Look for pairs like:

A imports B
B imports A
Step 2

Break the cycle by moving shared logic into a third file.

Example:

before:

A -> B
B -> A

after:

A -> shared
B -> shared
Step 3

If it's React components, move shared hooks into /hooks.

Example:

components/
   HallOfFame.tsx
   PlayerCard.tsx

hooks/
   useHallOfFame.ts
11. My guess (based on your logs)

If I had to bet money:

HallOfFame component importing something that imports HallOfFame again.

Because this log appears right before the crash:

Hall of Fame player data received: 52 players

Meaning render starts immediately after.

12. If you want, paste these 3 files and I can find it fast

Paste:

• App.tsx (or main component)
• HallOfFame.tsx
• any shared lib file used by both

Circular imports pop out immediately once I see the imports.

13. One more small improvement you should do

Your /auth/me call should run once.

Use:

useEffect(() => {
  fetchUser()
}, [])

and ensure fetchUser is not recreated each render.

Example:

const fetchUser = useCallback(async () => {
  ...
}, [])

✅ Summary

Your backend is fine.
Your crash is almost certainly:

Circular import between two modules.

Fix that and the site will load.

If you want, I can also show you a 30-second trick to locate the exact file causing the crash even in a minified Figma bundle. It's surprisingly effective.