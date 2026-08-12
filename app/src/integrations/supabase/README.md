# Supabase integration

The Supabase snippet provided by the Supabase dashboard is for a Next.js App Router project. Strikeglass is currently a static Cloudflare Worker/browser app, so `page.tsx`, `next/headers`, and Next middleware are not part of the runtime.

## What is wired now

- `.env.example` stores the public Supabase URL and publishable key for reference.
- `src/integrations/supabase/browser-client.js` exposes a lazy browser client as `window.StrikeglassSupabase`.
- The client loads `@supabase/supabase-js` from an ESM CDN only when needed, so the initial app load does not pay the cost.

## Browser usage

```js
const supabase = await window.StrikeglassSupabase.createClient()
const { data, error } = await supabase.from('reports').select('*')
```

## Security note

The publishable key is safe to expose to the browser, but Supabase Row Level Security must be enabled and correctly configured. Do not put service-role keys in this repository or in browser code.

## If Strikeglass moves to Next.js later

Then add the dashboard-generated files:

```text
utils/supabase/client.ts
utils/supabase/server.ts
utils/supabase/middleware.ts
middleware.ts
```

and install:

```bash
npm install @supabase/supabase-js @supabase/ssr
```

Until then, the Next.js SSR helper files would be dead code in this repository and would make the app look more advanced while doing absolutely nothing, which is a very human form of software decoration.
