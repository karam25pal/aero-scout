

## Convert Backend Functions from TypeScript to JavaScript

The three edge functions will be converted from `.ts` to `.js`:

### Files to Change

| Current File | New File |
|---|---|
| `supabase/functions/search-flights/index.ts` | `supabase/functions/search-flights/index.js` (delete `.ts`, create `.js`) |
| `supabase/functions/send-booking-email/index.ts` | `supabase/functions/send-booking-email/index.js` (delete `.ts`, create `.js`) |
| `supabase/functions/search-airports/index.ts` | `supabase/functions/search-airports/index.js` (delete `.ts`, create `.js`) |

### What Changes in Each File
- Remove all TypeScript type annotations (`: string`, `: number`, `: any`, `Record<string, string>`, etc.)
- Remove type casts
- Keep all logic, variable names, and structure identical

No frontend changes needed. The edge functions will continue to work identically since Deno supports both `.ts` and `.js`.

