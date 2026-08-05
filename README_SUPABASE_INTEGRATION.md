# Supabase integration for faiskifo

Important: your Supabase database and tables already exist. This integration will NOT recreate tables. It only adds the Supabase client, example read functions, a magic-link login UI, and notes about policies and testing.

## Installation

Install the Supabase JS client in your project:

npm install @supabase/supabase-js

or

yarn add @supabase/supabase-js

## Environment variables

Set the following environment variables in your local .env (not committed) and in your hosting provider (Vercel/Netlify/Render/etc):

- NEXT_PUBLIC_SUPABASE_URL — your Supabase project URL (e.g. https://xyzproject.supabase.co)
- NEXT_PUBLIC_SUPABASE_ANON_KEY — your Supabase ANON/public key (starts with `pk_`)

Notes:
- Variables prefixed with `NEXT_PUBLIC_` (Next.js) or `REACT_APP_` (Create React App) are exposed to the browser — this is expected for the ANON key which is safe for client use.
- NEVER commit the `service_role` key or any secret key to the repository. Store service_role keys only in secure server-side environments if needed.

## Where to set env vars on common hosts

- Vercel: Project Settings → Environment Variables → add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
- Netlify: Site settings → Build & deploy → Environment → Environment variables
- Render: Dashboard → Environment → Add Key

## Quick test

1. Start the app locally after adding a local `.env` with the two variables above.
2. Add the `MagicLinkLogin` component somewhere in the app (e.g., a dev-only route) and open it.
3. Enter an email and request a magic link. Click the link in your email to authenticate.
4. In the console or a dev page call `fetchCategoriesWithTasks()` to confirm read access returns data.

Example (browser console or helper):

import { fetchCategoriesWithTasks } from './src/supabase/reads';
fetchCategoriesWithTasks().then(console.log).catch(console.error);

## Security reminder

- The ANON key is intended for client usage and is safe to be visible in the client. The `service_role` key is highly privileged and must NEVER be included in frontend code or committed to git.
- RLS (Row Level Security) and policies should remain configured in your Supabase project — this integration does not alter them.

## Files added by this integration

- src/supabase/client.ts
- src/supabase/reads.ts
- src/components/MagicLinkLogin.tsx
- README_SUPABASE_INTEGRATION.md
- sql/NOTES_supabase_integration.sql

## Next steps

- Verify the magic link and reading functions work with an authenticated user.
- If you want, I can add TypeScript interfaces for the DB entities and a small helper to expose the current user id.
