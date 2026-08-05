# Supabase integration for faiskifo

Important: your Supabase database and tables already exist. This integration will NOT recreate tables. It only adds the Supabase client, example read functions, a magic-link login UI, and notes about policies and testing.

What I added in this branch:
- src/supabase/client.ts — Supabase client initializer (uses env vars)
- src/supabase/reads.ts — Example read helpers to fetch categories, tasks and steps
- src/components/MagicLinkLogin.tsx — Minimal UI for magic-link sign-in
- sql/NOTES_supabase_integration.sql — Notes and optional policy snippets (commented) — DO NOT run any CREATE TABLE statements
- README_SUPABASE_INTEGRATION.md — Steps to configure env vars and test the integration

After merging you should:
1. Set your ANON/public key and Supabase URL in environment variables (see README).
2. Test the magic link login and read functions.

Security reminder:
- NEVER commit your service_role key. Use only the ANON/public key in the client.
