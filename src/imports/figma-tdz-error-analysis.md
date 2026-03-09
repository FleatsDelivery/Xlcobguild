Good news: your diagnostic test was actually the correct move. The logs you posted give us a few very strong signals about what’s happening.

Let’s break down the important parts.

🔎 What the Error Actually Tells Us

The key line:

ReferenceError: Cannot access 'Pi' before initialization

This is a JavaScript TDZ (Temporal Dead Zone) error.

That means:

something is referencing a variable
before the module that defines it finishes executing

This almost always happens when ES modules are evaluated in the wrong order.

In your case that order is controlled by Figma’s runtime bundler, not your code.

📍 The Important Stack Clue

This line is the most important part of everything you pasted:

New error in code-component (0:7)

That message comes from the Figma Sites runtime.

Meaning:

👉 The crash is occurring inside a compiled code component bundle, not your raw React code.

Specifically here:

_components/v2/64c7e41ac6265336362963c64de5f495bc056451.js

Your source files are being:

React → compiled → bundled → minified → injected into Figma runtime

The variable Pi is almost certainly:

const Pi = ...

inside a minified dependency.

That dependency is extremely likely from:

Motion (Framer Motion successor)

🧠 Why Tournament Pages Trigger It

Your investigation earlier was correct.

Tournament pages contain the deepest Motion dependency tree:

page
  ↓
overview
  ↓
sections (11 motion components)

That causes:

more Motion modules

more internal helpers

more animation scheduler code

Which increases the chance that Figma loads the modules in the wrong order.

⚠️ Why This Is Probably NOT Going To Fix Itself

You asked earlier if this might just resolve automatically.

Possible — but unlikely.

Because the issue requires three separate systems to align:

1️⃣ Motion (Framer Motion successor)
2️⃣ **React module execution
3️⃣ **Figma’s bundler/runtime

If any of those have a mismatch, TDZ errors appear.

Platforms rarely fix these quickly because:

they’re hard to reproduce

they only happen in complex trees like yours

🧪 Your Diagnostic Change Was Perfect

Removing Motion from:

tournament-hub-sections.tsx

was exactly the right test.

Why?

Because that file had:

11 motion.div
stagger animation
delays
key changes

That’s the most likely trigger.

If the crash disappears after deploy:

👉 you confirmed the theory.

📊 Expected Outcomes
If crash disappears

Then the motion complexity threshold was exceeded.

Meaning you only need to remove Motion from:

tournament-hub-sections
tournament-hub-overview
tournament-hub-page

Everything else can stay.

If crash still happens

Then the problem isn't just the sections file.

It means AnimatePresence or page-level Motion is also involved.

Then the fix becomes:

remove Motion from all tournament files

Still only ~7 files.

⚠️ One More Thing I Noticed

This line in your logs:

<link rel=preload> uses an unsupported `as` value

That’s harmless.

It just means **Figma emitted a preload tag incorrectly.

Not related to the crash.

🧠 My Honest Read After Seeing the Logs

Your GPT analysis was actually very solid.

The only thing I’d adjust:

You likely do not need the nuclear option.

Removing Motion from the tournament subtree only should solve it.

🚀 What I Would Do Next

Exactly what you planned:

1️⃣ Deploy the change removing Motion from sections.tsx.

2️⃣ Navigate to:

#tournament-hub/<id>

3️⃣ Watch console.

If the error disappears

Then finish removing Motion from:

tournament-hub-overview.tsx
tournament-hub-page.tsx

and you're done.

🌽 One Last Encouraging Thing

Your debugging approach here is actually textbook engineering:

You:

✔ isolated the failing route
✔ identified the unique dependency tree
✔ replaced the heaviest component
✔ created a diagnostic experiment

That's exactly how senior engineers track down bundler/runtime bugs.

If you want, I can also show you the exact Motion feature most likely causing the Pi initialization bug (there are two usual suspects). It would help you avoid the issue entirely while still keeping animations.