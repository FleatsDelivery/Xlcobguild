# The Corn Field -- Project Guidelines

> These rules protect us from our future selves.
> Read this before building anything new. Update it when patterns evolve.

---

## 0. Engineering Philosophy

These principles guide every decision. When the rules below don't cover an edge case, fall back to these:

- **Predictable > clever.** Boring code that anyone can read beats elegant code that only you understand today.
- **Extract once, reuse everywhere.** The second time you copy something, stop and extract it.
- **Single source of truth.** Config, constants, types -- one canonical location, everything else imports.
- **Delete aggressively.** Dead code is not "kept for reference." That's what git history is for.
- **UI is driven by config, not conditionals.** If you're writing `if (status === 'live')` in JSX, it belongs in a config object.
- **Future Tate must thank present Tate.** Every shortcut is a bill. Pay it now or pay it with interest later.

---

## 1. File Size & Structure Rules

### Hard Limits
- **No single `.tsx` file over 800 lines.** If it's growing past that, it needs extraction.
- **Page orchestrators (the main page component) should stay under 500-600 lines.** They own state, data fetching, and layout assembly -- not rendering every detail.
- **Modals should stay under 400 lines.** If a modal form is getting complex, extract form sections into sub-components.

### The "One Tab = One File" Rule
Any page with tabs MUST split tab content into separate files:

```
my-page.tsx              -> Orchestrator: state, fetch, tab switching, layout
my-page-overview.tsx     -> Overview tab content (receives props)
my-page-teams.tsx        -> Teams tab content (receives props)
my-page-players.tsx      -> Players tab content (receives props)
```

The orchestrator imports tab components and passes props down. Tab files never own data-fetching state -- they receive everything they need.

### When to Extract a Component
Extract into its own file when ANY of these are true:
- It's used in 2+ places (even if small)
- It's over 100 lines of JSX
- It has its own local state or effects
- It's a modal, drawer, or overlay
- It represents a logical "card" or "section" that could be tested independently

### The Refactor Signal
> If you hesitate to open a file because it feels heavy, that's a refactor trigger. Architecture should reduce cognitive load -- if a file feels intimidating, it's violating something above.

---

## 2. File Naming Conventions

### Frontend Components (`/src/app/components/`)
- **kebab-case** for all files: `tournament-hub-page.tsx`, `edit-team-modal.tsx`
- **Page components:** `{name}-page.tsx` (e.g., `leaderboard-page.tsx`)
- **Tab sub-components:** `{parent-page}-{tab-name}.tsx` (e.g., `tournament-hub-overview.tsx`)
- **Modals:** `{action}-{noun}-modal.tsx` (e.g., `create-team-modal.tsx`, `edit-match-modal.tsx`)
- **Shared UI pieces:** descriptive name, no suffix (e.g., `team-logo.tsx`, `match-card-with-heroes.tsx`)
- **Config/constants:** `{domain}-{purpose}.ts` (e.g., `tournament-state-config.ts`)

### Shared Utilities (`/src/lib/`)
- Pure functions, constants, and type definitions that are used across multiple components
- Examples: `slugify.ts`, `dota-heroes.ts`, `roles.ts`, `date-utils.ts`

### Server Routes (`/supabase/functions/server/`)
- **Route files:** `routes-{domain}.ts` (e.g., `routes-kkup-read.ts`, `routes-tournament-crud.ts`)
- **Shared server utilities:** `{purpose}.ts` or `{purpose}.tsx` (e.g., `helpers.ts`, `roles.ts`, `discord-embeds.tsx`)
- Each route file exports a single `register{Domain}Routes(app, supabase, anonSupabase)` function

### No Version Suffixes
- Do NOT keep v1 and v2 files side by side. When upgrading a component:
  1. Rename the old file or delete it
  2. Name the new file with the original name
  3. Update all imports
- Stale `-v2` files become confusing orphans

---

## 3. Brand System & Design Tokens

### Color Palette (defined in `/src/styles/theme.css`)
Always use CSS custom properties or their Tailwind equivalents -- never hardcode hex values that duplicate the brand system.

| Token            | Value      | Use for                                |
|------------------|------------|----------------------------------------|
| `silk`           | `#f5f0e6`  | Page backgrounds, light surfaces       |
| `surface`        | `#fef8ed`  | Cards, elevated surfaces               |
| `field-dark`     | `#262d01`  | Primary text, dark elements            |
| `soil`           | `#2a1a0a`  | Dark mode backgrounds                  |
| `harvest`        | `#d6a615`  | Primary accent, CTAs, gold highlights  |
| `kernel-gold`    | `#f1c60f`  | Bright gold, awards, rankings          |
| `husk`           | `#7f9c00`  | Secondary accent, green elements       |
| `husk-bright`    | `#a4ca00`  | Bright green, positive states          |
| `discord`        | `#5865F2`  | Discord-related UI                     |
| `error`          | `#d94444`  | Destructive actions, errors            |

### Opacity Pattern
Use Tailwind's opacity modifiers on brand colors for backgrounds/borders:
- `bg-harvest/10` for subtle tinted backgrounds
- `border-field-dark/10` for subtle borders
- `text-field-dark/50` for secondary text

### Hardcoded Colors (Acceptable Exceptions)
These standard utility colors are OK to hardcode since they represent universal concepts, not brand identity:
- `#3b82f6` (blue) -- player/info indicators
- `#8b5cf6` (purple) -- team/group indicators
- `#10b981` (green) -- success/approved states
- `#ef4444` (red) -- error/denied states
- `#f59e0b` (amber) -- warning/pending states

### Typography
- Font: Inter (imported in `/src/styles/fonts.css`)
- Use `font-black` for hero numbers and headings
- Use `font-bold` for labels and subheadings
- Use `font-semibold` for secondary labels
- Use `text-field-dark/50` or `text-field-dark/60` for muted/secondary text

### Card Pattern
Standard card appearance used throughout the app:
```
className="bg-card rounded-2xl border-2 border-border p-6"
```
With hover: add `hover:border-harvest/50 transition-all`

### Dark Mode System

The app supports **light**, **dark**, and **system** (OS preference) themes.

**Architecture:**
- `ThemeProvider` (`/src/app/components/theme-provider.tsx`) — wraps the app, manages `dark` class on `<html>`
- `ThemeToggle` (`/src/app/components/theme-toggle.tsx`) — cycles light → dark → system (Sun / Moon / Monitor icons)
- Persisted to `localStorage('tcf_theme')`, defaults to `system`
- Tailwind v4 reads the `dark` class via `@custom-variant dark (&:is(.dark *))` in `theme.css`

**How it works:**
The `.dark` class on `<html>` swaps CSS custom properties. Semantic tokens like `--background`, `--foreground`, `--card`, `--border` automatically resolve to light or dark values. Components using these tokens get dark mode for free.

**Semantic Tokens — USE THESE for dark mode compatibility:**

| Tailwind Class         | Light Value             | Dark Value              | Use for                        |
|------------------------|-------------------------|-------------------------|--------------------------------|
| `bg-background`        | silk (`#f5f0e6`)        | soil (`#2a1a0a`)        | Page backgrounds               |
| `text-foreground`      | field-dark (`#262d01`)  | silk (`#f5f0e6`)        | Primary text                   |
| `bg-card`              | surface (`#fef8ed`)     | dark-husk (`#341208`)   | Cards, elevated surfaces       |
| `text-card-foreground` | field-dark              | silk                    | Text inside cards              |
| `border-border`        | field-dark/10           | silk/10                 | Borders                        |
| `bg-muted`             | `#e8e0d0`              | `#3d2a12`               | Muted backgrounds              |
| `text-muted-foreground`| `#6b6545`              | `#b8a882`               | Secondary/muted text           |
| `bg-input-background`  | surface                 | dark-husk               | Input field backgrounds        |
| `bg-popover`           | surface                 | dark-husk               | Popovers, dropdowns            |

**The Golden Rule for New Components:**
> Use semantic tokens for surfaces, text, and borders. Brand colors (harvest, husk, kernel-gold, etc.) stay the same in both modes — they're designed to work on both light and dark backgrounds.

| Instead of...                    | Use...                           | Why                                    |
|----------------------------------|----------------------------------|----------------------------------------|
| `bg-white`                       | `bg-card`                        | White is invisible on dark backgrounds |
| `bg-silk`                        | `bg-background`                  | Silk is the light-mode page bg         |
| `text-field-dark`                | `text-foreground`                | Field-dark is invisible on dark bg     |
| `text-field-dark/50`             | `text-muted-foreground`          | Semantic muted text for both modes     |
| `border-field-dark/10`           | `border-border`                  | Already defined as semantic border     |
| `bg-field-dark/5`                | `bg-muted`                       | Subtle background tint                 |

**What stays the same in both modes:**
- Brand accent colors: `bg-harvest`, `text-harvest`, `bg-husk`, `text-kernel-gold` — these are vibrant on both light and dark
- Status colors: `#ef4444` (red), `#10b981` (green), `#f59e0b` (amber), `#3b82f6` (blue)
- The navigation bar (already dark via `bg-soil`)
- Any element inside `bg-soil` containers (nav, sidebar, etc.)

**Existing pages retrofit status:**
Existing pages still use hardcoded light-mode classes (`bg-white`, `text-field-dark`, etc.). These will be migrated to semantic tokens in a final polish pass when the app is feature-complete. New pages and components should use semantic tokens from day one.

**Using the theme in components:**
```tsx
import { useTheme } from '@/app/components/theme-provider';

function MyComponent() {
  const { theme, resolvedTheme, setTheme, cycleTheme } = useTheme();
  // theme = 'light' | 'dark' | 'system' (user preference)
  // resolvedTheme = 'light' | 'dark' (what's actually active)
}
```

---

## 4. Shared Utilities -- "Extract Once, Import Everywhere"

### Current Shared Locations
| Path                      | Purpose                                           |
|---------------------------|---------------------------------------------------|
| `/src/lib/slugify.ts`     | `slugifyTournamentName()` for storage paths        |
| `/src/lib/dota-heroes.ts` | Hero image URLs, hero name lookups                 |
| `/src/lib/dota-items.ts`  | Item image URLs                                    |
| `/src/lib/roles.ts`       | Permission helpers: `isOfficer()`, `loadCustomRoles()` |
| `/src/lib/supabase.ts`    | Supabase client singleton + `initialHash`          |
| `/src/lib/date-utils.ts`  | `formatDate()`, `formatDateShort()`, `formatDateLong()`, `formatDateWithTime()`, `timeAgo()` |
| `/src/lib/rank-utils.ts`  | `RANK_MEDALS`, `getRankDisplay()` for Dota 2 ranks |
| `/src/lib/icons.tsx`       | `TwitchIcon` and other custom SVG icons            |

### Recently Extracted Utilities (completed)
These were previously duplicated across files and have been centralized:

| Utility                      | Extracted from                           | Now lives in            |
|------------------------------|------------------------------------------|-------------------------|
| `TwitchIcon`                 | tournament-hub-page, kkup-detail-page    | `/src/lib/icons.tsx`    |
| `formatDate()` / `formatDateShort()` / `timeAgo()` | tournament-hub-page, kkup-detail-page, match-card-with-heroes, user-profile-modal | `/src/lib/date-utils.ts` |
| `RANK_MEDALS` / `getRankDisplay()` | tournament-hub-page               | `/src/lib/rank-utils.ts` |
| `APPROVAL_STYLES`           | tournament-hub-page                      | `tournament-state-config.ts` |

### The Extraction Rule
> If a function, component, constant, or type appears in 2+ files, it MUST be extracted to `/src/lib/` (for utilities) or a shared component file.

---

## 5. Tournament System Architecture

### Tournament Phase System
- **Single source of truth:** `/src/app/components/tournament-state-config.ts`
- All phase-dependent UI (colors, labels, icons, section ordering) is driven by `getPhaseConfig(status)`
- Never hardcode status-specific styles inline -- add them to `PHASE_CONFIGS`
- To add a new phase: add to `TournamentPhase` type + add a `PhaseConfig` entry. Done.

### Tournament Pages (Two Systems)
| Page                   | Purpose                              | Data Source         |
|------------------------|--------------------------------------|---------------------|
| `kkup-detail-page.tsx` | Historical KKup archives (KK1-KK9)  | `kkup_*` DB tables  |
| `tournament-hub-page.tsx` | Live/active Season 3+ tournaments | `tournaments` table  |

Both share: `EditTournamentModal`, `TeamLogo`, `slugifyTournamentName()`, `tournament-state-config.ts`

### Storage Conventions
- Tournament assets bucket: `make-4789f4af-kkup-assets`
- Folder naming: `kernel-kup-#` (e.g., `kernel-kup-10`)
- Path generation: always use `slugifyTournamentName()` from `/src/lib/slugify.ts`
- Team logos: `{tournament-slug}/teams/{team-slug}.png`
- Gallery images: `{tournament-slug}/gallery/{filename}`

---

## 6. Server / API Conventions

### Route File Structure
Each `routes-{domain}.ts` file:
1. Imports `PREFIX` from `./helpers.ts`
2. Imports `isOfficer` (or other role checks) from `./roles.ts`
3. Exports a single `register{Domain}Routes(app, supabase, anonSupabase)` function
4. All routes use the prefix: `` `${PREFIX}/{path}` ``

### Auth Pattern
Protected routes must verify the user:
```ts
const accessToken = c.req.header('Authorization')?.split(' ')[1];
const { data: { user }, error } = await supabase.auth.getUser(accessToken);
if (!user?.id) return c.json({ error: 'Unauthorized' }, 401);
```

### Error Response Pattern
Always return structured errors with context:
```ts
return c.json({ error: `Failed to update team roster for tournament ${id}: ${error.message}` }, 500);
```

### Deprecated Endpoints
When deprecating an endpoint:
- Return `410 Gone` with a message explaining the replacement
- Add a comment: `// DEPRECATED -- {reason}`
- Remove entirely in the next cleanup pass (don't leave them forever)

---

## 6b. Database & Schema Conventions

### Prefer Real Tables Over KV

The KV store (`kv_store_4789f4af`) is appropriate for:
- Notifications, activity logs, admin logs (ephemeral, TTL-pruned data)
- Feature flags, user preferences, small config blobs

For **domain data** (teams, tickets, matches, rosters, etc.), always use **real Postgres tables** with proper columns, types, and foreign keys. Real tables give us JOINs, constraints, indexes, and transactional writes that KV cannot.

### How New Tables Get Created

The AI assistant **cannot run DDL or migrations** in this environment. When a new table is needed:

1. **Agree on the schema in conversation first** — column names, types, constraints, foreign keys
2. **AI provides the `CREATE TABLE` SQL in chat** (not written to any file)
3. **Tate copies the SQL into the Supabase SQL Editor** and runs it manually
4. **AI then builds the server routes and frontend** against the new table

Do NOT:
- Write `.sql` migration files into the codebase (unless explicitly asked)
- Use KV as a workaround for domain data that deserves a real table
- Assume a table exists until Tate confirms it's been created

### Existing Tables Reference

| Table                    | Purpose                                   |
|--------------------------|-------------------------------------------|
| `users`                  | Discord-authed user profiles, roles, rank |
| `kkup_persons`           | Steam identity (shared across tournaments)|
| `kkup_tournaments`       | Tournament definitions and settings       |
| `kkup_teams`             | Per-tournament team snapshots             |
| `kkup_master_teams`      | Canonical team identity across all time   |
| `kkup_team_rosters`      | Per-tournament roster membership          |
| `kkup_team_invites`      | Team invite records                       |
| `kkup_registrations`     | Player tournament registrations           |
| `kkup_staff_applications`| Staff/volunteer applications              |
| `kv_store_4789f4af`      | KV store for logs, notifications, config  |

*(Update this table when new tables are created.)*

---

## 7. Notification, Activity & Admin Log System

The app has three parallel logging systems. Every user-facing action that matters should touch at least one, and most should touch two.

### The Three Systems

| System              | Who sees it      | KV pattern                              | Server function         | Frontend page          |
|---------------------|------------------|-----------------------------------------|-------------------------|------------------------|
| **Notifications**   | Target user      | `notification:{user_id}:{sortable_id}`  | `createNotification()`  | Inbox → Inbox tab      |
| **User Activity**   | The acting user  | `user_activity:{user_id}:{sortable_id}` | `createUserActivity()`  | Inbox → Activity tab   |
| **Admin Log**       | Officers/owners  | `admin_log:{sortable_id}`               | `createAdminLog()`      | Officer Inbox → Admin Activity tab |

All three are exported from `/supabase/functions/server/routes-notifications.ts`.

### When to Use Each

**Notification** — something happened TO a user that they need to know about:
- They received a team invite
- Their team was approved/denied
- Their MVP was reviewed
- They won a giveaway prize

**User Activity** — something the user DID, or something done TO them for their personal audit trail:
- They registered for a tournament
- They created a team / sent an invite / accepted or declined an invite
- They entered or left a giveaway
- They submitted an MVP or staff application
- An admin changed their role or rank (logged to the *target* user's activity)

**Admin Log** — officer-visible record of administrative actions:
- Team approved/denied
- MVP approved/denied
- Giveaway drawn
- Role changes, tournament updates, data imports

### The Dual-Log Pattern

Most admin actions should create **two** log entries:
1. An **Admin Log** entry (so officers can see what happened in Officer Inbox)
2. A **User Activity** entry on the *target user* (so the affected user sees it in their Activity tab)

Example — approving a team:
```ts
// 1. Admin sees: "Approved team Corn Dawgs"
await createAdminLog({
  type: 'team_approved',
  action: `Approved team "${team.team_name}" for ${tournament.name}`,
  actor_id: officer.id,
  actor_name: officer.discord_username,
});

// 2. Captain sees in their activity: "Your team was approved"
await createUserActivity({
  user_id: captainUserId,
  type: 'admin_team_approved',
  title: `Team ${team.team_name} Approved`,
  description: `Your team was approved for ${tournament.name}.`,
  related_url: `#tournament-hub/${tournamentId}`,
  actor_name: officer.discord_username,
});
```

### Adding a New Activity/Notification Type

1. **Choose a type slug** — lowercase, snake_case, descriptive: `team_invite_accepted`, `giveaway_entered`, `staff_applied`
2. **Add the display config** to `/src/app/components/inbox-activity-config.ts`:
   - For notifications → add to `NOTIFICATION_TYPE_CONFIG`
   - For user activity → add to `ACTIVITY_TYPE_CONFIG`
   - Each entry: `{ label, icon (lucide name), color (hex) }`
3. **Add the server call** in the relevant route handler:
   - Wrap in `try/catch` — logging is **non-critical** and must never block the main action
   - Use the pattern: `try { await createUserActivity({...}); } catch (actErr) { console.error('Non-critical: ...', actErr); }`
4. **If it's an admin action**, also add the type to `ADMIN_TYPE_CONFIG` in `officer-inbox-activity.tsx`
5. **UI picks it up automatically** — no frontend code changes needed beyond the config entry

### Non-Critical Wrapper Pattern

Activity/notification logging must NEVER break the main action. Always wrap:
```ts
// ✅ Right — non-critical wrapper
try {
  await createUserActivity({ ... });
} catch (actErr) {
  console.error('Non-critical: activity log for [action] failed:', actErr);
}

// ❌ Wrong — unguarded await that could break the endpoint
await createUserActivity({ ... });
return c.json({ success: true });
```

### Auto-Cleanup System

User activity entries are auto-pruned by `createUserActivity()` itself:
- **90-day TTL** — non-frozen entries older than 90 days are deleted
- **500-item cap** — non-frozen entries beyond 500 are FIFO-deleted
- **Frozen entries** are exempt from both — users can freeze/unfreeze via the snowflake icon
- The cleanup runs on every `createUserActivity()` call (piggybacks, no separate cron)

### File Architecture

Follows the "One Tab = One File" rule:

**User Inbox** (`#inbox` / `#requests`):
```
inbox-page.tsx              → Orchestrator: state, fetch, actions
inbox-page-inbox.tsx        → Inbox tab (notifications TO user)
inbox-page-activity.tsx     → Activity tab (things user DID)
inbox-activity-config.ts    → Type display configs for both tabs
```

**Officer Inbox** (`#officer-inbox`):
```
officer-inbox-page.tsx      → Orchestrator: state, fetch, officer actions
officer-inbox-requests.tsx  → Requests tab (pending approvals, staff apps, MVPs)
officer-inbox-activity.tsx  → Admin Activity tab (admin_log entries)
```

### Checklist: "I'm Adding a New Feature — What Logs Do I Need?"

| Your feature does...                   | Create...                                           |
|----------------------------------------|-----------------------------------------------------|
| User takes a voluntary action          | `createUserActivity()` for the acting user           |
| Something happens TO a user            | `createNotification()` for the target user           |
| An officer approves/denies something   | `createAdminLog()` + `createUserActivity()` on target |
| A system event affects a user          | `createNotification()` (type: `system`)              |
| User dismisses an inbox notification   | Handled automatically by dismiss endpoint            |

---

## 8. Dead Code & Hygiene

### Before Every PR / Major Session
Ask: "Are there files nobody imports?" Common orphan patterns:
- `-v2` files where v1 is still in use (or vice versa)
- Modal components for features that got removed
- Route files that were un-registered from `index.tsx`

### shadcn/ui Policy
- **Only keep UI components that are actually imported.** Do not pre-install the full library.
- Currently used: `button.tsx`, `input.tsx`, `label.tsx`, `utils.ts`
- When you need a new shadcn component, add just that one file
- Periodically audit: `grep -r "components/ui/" src/` to see what's actually referenced

### Cleanup Checklist (run periodically)
1. Search for files not imported anywhere: orphan components, dead modals, unused route files
2. Search for `// DEPRECATED`, `// disabled`, `// TODO` comments -- resolve or remove
3. Check `/src/app/components/ui/` for unused shadcn files
4. Check server `routes-*.ts` files against `index.tsx` registrations
5. Look for duplicated utility functions across files

### Migration Discipline
> Any architectural shift (new routing pattern, new data layer, component system swap) must include a cleanup pass of the old pattern. Don't leave both systems running side by side indefinitely -- that's how you get two ways to do everything and confidence in neither.

---

## 9. Performance Guardrails

These aren't premature optimization -- they're habits that prevent regressions as data grows.

- **No data fetching inside tab components.** Orchestrators fetch; tabs receive props. This prevents re-fetching on tab switch and keeps data flow predictable.
- **Avoid inline object/array literals in JSX props.** `style={{color: 'red'}}` creates a new object every render. Extract to a constant or `useMemo`.
- **Memoize expensive derived data.** If you're filtering/sorting/transforming a large array on every render, wrap it in `useMemo`.
- **Virtualize long lists.** If a list can exceed ~100 items (player rosters, match history), consider virtualization rather than rendering all DOM nodes.
- **Images need dimensions.** Always set `width`/`height` or use `aspect-ratio` on images to prevent layout shift.

---

## 10. Responsive Design

The app is mobile-friendly by default. Every page and component should look usable on a 375px-wide phone without horizontal overflow.

### Breakpoint System

Tailwind v4 default breakpoints — use these consistently:

| Breakpoint | Min Width | Use for |
|---|---|---|
| *(base)* | 0px | Mobile-first default — all styles start here |
| `sm:` | 640px | Large phones / small tablets — bottom nav appears |
| `md:` | 768px | Tablets — multi-column grids kick in |
| `lg:` | 1024px | Laptops — full desktop layouts |
| `xl:` | 1280px | Wide desktops — 4-column grids, extra whitespace |

**The cardinal rule:** always design the base (mobile) layout first, then layer on `sm:` / `md:` / `lg:` enhancements. If you catch yourself writing desktop-first styles and then trying to "fix mobile" with overrides, reverse your approach.

### Navigation Architecture

| Element | Mobile (<640px) | Desktop (sm+) |
|---|---|---|
| Top bar | `h-12`, hamburger + logo + avatar | `h-14`, same but roomier |
| Bottom nav | Hidden (`hidden sm:block`) | Fixed bottom, 5 icons |
| Side menu | Full-height slide-out | Stops above bottom nav (`bottom-16`) |
| Content offset | `pt-14 pb-4` | `pt-16 pb-20` |

### Page Layout Standards

Every page wrapper should follow one of these patterns:

**Wide content pages** (tournaments, leaderboards, data-heavy):
```
className="px-3 sm:px-4 py-4 min-h-screen bg-background"
// Inner container:
className="max-w-7xl mx-auto space-y-6 sm:space-y-8"
```

**Focused content pages** (home, profile, forms):
```
className="p-3 sm:p-6 min-h-screen bg-background"
// Inner container:
className="max-w-4xl mx-auto space-y-4 sm:space-y-6"
```

**Narrow admin pages** (officer panel):
```
className="px-3 sm:px-4 py-6 sm:py-8 min-h-screen bg-background"
// Inner container:
className="max-w-2xl mx-auto"
```

### Card Padding Standards

| Card type | Padding | Example |
|---|---|---|
| Standard content card | `p-4 sm:p-6` | Team cards, stat blocks |
| Hero / feature banner | `p-6 sm:p-8` or `p-8 sm:p-12` | Tournament hero banner |
| Compact list item | `p-3 sm:p-4` | Notification rows, roster entries |
| Modal body | `p-4 sm:p-6` | All modals via BottomSheetModal |

### Section Headings

Scale headings across breakpoints:
```
// Page title (one per page)
className="text-2xl sm:text-3xl font-black text-foreground"

// Section heading
className="text-xl sm:text-2xl font-bold text-foreground"

// Sub-section / card heading
className="text-lg sm:text-xl font-bold text-foreground"
```

### Grid Patterns

Standard responsive grids used throughout:

| Content type | Grid classes |
|---|---|
| Tournament cards | `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` |
| Stat blocks (4 items) | `grid-cols-2 sm:grid-cols-4` |
| Player/roster cards | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` |
| Podium (3 items) | `grid-cols-1 md:grid-cols-3` |
| Hero images | `grid-cols-3` (always — small enough) |

### Mobile Overflow Prevention

These patterns MUST be followed to prevent horizontal scrolling:

1. **Flex rows with variable-width children must stack on mobile:**
   ```tsx
   // ✅ Right — stacks on mobile, row on desktop
   className="flex flex-col sm:flex-row items-start sm:items-center gap-3"

   // ❌ Wrong — forces horizontal layout at all sizes
   className="flex items-center gap-6"
   ```

2. **Long text must truncate or wrap:**
   ```tsx
   // Container needs min-w-0, text needs truncate
   <div className="flex-1 min-w-0">
     <p className="font-bold truncate">{longTeamName}</p>
   </div>
   ```

3. **Data tables must use horizontal scroll:**
   ```tsx
   <div className="overflow-x-auto">
     <table className="w-full min-w-max">...</table>
   </div>
   ```
   For sticky columns, match the row background using semantic tokens (`bg-card` / `bg-muted`), never `bg-white`.

4. **Large numbers and scores must scale:**
   ```tsx
   // ✅ Right — scales down on mobile
   className="text-3xl sm:text-5xl font-black"

   // ❌ Wrong — text-6xl on a 375px screen is too big in a flex row
   className="text-6xl font-black"
   ```

5. **Stat columns in headers must collapse on mobile:**
   When a row has a logo + name + 3+ stat columns, the stats MUST either:
   - Stack below the name on mobile (`flex-col sm:flex-row`)
   - Become a compact inline format (e.g., "3-1 | 2-1 | 47")
   - Hide less important columns (`hidden sm:block`)

### The "Phone Test" Rule

> Before calling a component done, mentally picture it at 375px wide. If any flex row has more than ~3 elements with fixed widths (logos, stat columns, buttons), it needs a mobile breakpoint. If you're not sure, it probably does.

### Common Mobile Patterns

**Show/hide content by breakpoint:**
```tsx
{/* Full label on desktop, abbreviation on mobile */}
<span className="hidden sm:inline">Championships</span>
<span className="sm:hidden">Champs</span>

{/* Hide secondary stats on mobile */}
<div className="hidden sm:flex items-center gap-4">
  <StatBlock label="GPM" value={stats.gpm} />
  <StatBlock label="XPM" value={stats.xpm} />
</div>
```

**Responsive text + padding combos:**
```tsx
// Card that breathes on desktop but stays compact on mobile
className="p-4 sm:p-6 rounded-xl sm:rounded-2xl"

// Text that scales appropriately
className="text-sm sm:text-base text-muted-foreground"
```

---

## 11. Navigation & Routing

### Hash-Based Routing
The app uses hash-based routing with a three-layer persistence fix in `App.tsx`:
1. `window.location.hash` (normal navigation)
2. `initialHash` module-level snapshot (survives Supabase clearing hash)
3. `localStorage.getItem('tcf_current_hash')` (survives iframe recreation)

### Adding a New Page
1. Add the page type to the `PageType` union in `App.tsx`
2. Add hash mapping in `hashToPage()`
3. Add navigation entry in `navigation.tsx`
4. Add conditional render in the main return block
5. Persist hash: ensure `localStorage.setItem('tcf_current_hash', hash)` fires
6. If the page is a child of an existing nav item, add a case to `getNavParent()` in `navigation.tsx`

### Hash Format
- Simple pages: `#page-name` (e.g., `#leaderboard`, `#profile`)
- Detail pages: `#prefix/id` (e.g., `#kkup/kk1`, `#tournament-hub/abc123`)

---

## 12. Import Conventions

### Path Aliases
- `@/app/components/*` -> `/src/app/components/*`
- `@/lib/*` -> `/src/lib/*`
- `@/utils/*` -> `/src/utils/*`
- `/utils/supabase/info` -> project ID and anon key (absolute path, no alias)

### Import Order (recommended)
```tsx
// 1. React
import { useState, useEffect } from 'react';

// 2. External packages
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { Crown, Users, Trophy } from 'lucide-react';

// 3. Internal UI components
import { Button } from '@/app/components/ui/button';

// 4. App components
import { TeamLogo } from '@/app/components/team-logo';
import { EditTournamentModal } from '@/app/components/EditTournamentModal';

// 5. Utilities and config
import { slugifyTournamentName } from '@/lib/slugify';
import { projectId, publicAnonKey } from '/utils/supabase/info';
```

---

## 13. Quick Reference -- "Am I Doing This Right?"

| Situation | Right | Wrong |
|---|---|---|
| File growing past 800 lines | Extract tabs/sections into sub-files | Keep adding to the monolith |
| Same function in 2 files | Extract to `/src/lib/` | Copy-paste and forget |
| New shadcn component needed | Add just that one file | Install all 40+ components |
| Replacing a component | Delete old, rename new to original name | Keep `foo.tsx` and `foo-v2.tsx` |
| Deprecating a server route | Return 410, mark for deletion | Comment it out and leave it |
| New tournament phase | Add to `tournament-state-config.ts` | Hardcode styles in the page |
| Need a brand color | Use CSS token: `text-harvest`, `bg-silk` | Hardcode `#d6a615` |
| Need an icon | Use lucide-react | Inline SVG (unless truly custom like TwitchIcon) |
| Need an image | Use `unsplash_tool` or Supabase storage | Hardcode a URL |
| Card background | `bg-card` | `bg-white` (breaks dark mode) |
| Page background | `bg-background` | `bg-silk` (light-only) |
| Primary text | `text-foreground` | `text-field-dark` (invisible in dark) |
| Muted text | `text-muted-foreground` | `text-field-dark/50` (invisible in dark) |
| Borders | `border-border` | `border-field-dark/10` (invisible in dark) |
| Adding a user-facing action | `createUserActivity()` in try/catch | Bare `await` that can break the endpoint |
| Admin approves/denies something | `createAdminLog()` + `createUserActivity()` on target | Only logging to admin log (user never finds out) |
| New notification/activity type | Add to `inbox-activity-config.ts`, UI auto-picks it up | Hardcode label/icon/color in the component |
| Need to notify a user | `createNotification()` for the target user | Toast-only (ephemeral, user misses it if offline) |
| Flex row with 3+ items | `flex flex-col sm:flex-row` — stack on mobile | `flex items-center gap-6` — overflows on phone |
| Page wrapper padding | `px-3 sm:px-4 py-4` — responsive | `px-4 py-4` — no mobile breathing room |
| Card padding | `p-4 sm:p-6` — compact on mobile | `p-6` or `p-8` — wastes mobile space |
| Section heading size | `text-2xl sm:text-3xl` — scales | `text-3xl` — too large on 375px |
| Big score number | `text-3xl sm:text-5xl` — readable at all sizes | `text-6xl` — overflows in flex rows |
| Wide data table | `overflow-x-auto` + `min-w-max` | Letting columns shrink and clip |
| Stat columns in a header | Stack or hide on mobile | 4+ columns forced into one row |