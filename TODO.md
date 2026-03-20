# PasseVite Ordonnance Feature TODO

## Progress: [6/8] ✓ Steps 1-6 Complete

1. [x] Create Supabase migration for `medications` and `prescriptions` tables + RLS.
2. [x] Install `react-to-print` dependency.
3. [x] Create `src/pages/Ordonnance.tsx` (form + print).
4. [x] Update `src/App.tsx` (add `/ordonnance` route).
5. [x] Update `src/pages/Manager.tsx` (add nav button).
6. [x] Update `src/integrations/supabase/types.ts` (add new types).
7. [ ] Run `supabase gen types typescript --local > src/integrations/supabase/types.ts`.
8. [ ] Test: Login manager -> Ordonnance -> create/print.

**Migration FIXED AGAIN (uuid/text JOIN fixed: subquery + casts, simplified RLS).**

**Next:** 1. `npx supabase db push` 2. `npx supabase gen types typescript --local > src/integrations/supabase/types.ts` 3. Test on localhost:8085/manager.

Dev server running on 8085.






