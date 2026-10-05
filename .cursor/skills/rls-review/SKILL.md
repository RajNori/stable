---
name: rls-review
description: Review and test Supabase RLS policies for cross-team, guardian, staff and revoked-access safety.
---
# RLS Review
For each changed table:
1. Identify tenant ownership path.
2. Identify actors allowed to SELECT/INSERT/UPDATE/DELETE.
3. Write allow test.
4. Write unrelated-user deny test.
5. Write same-club wrong-team deny test.
6. Write revoked-membership deny test where relevant.
7. Inspect security-definer/helper functions.
8. Confirm service role is not required by client.
9. Run pgTAP via local Supabase.
10. Report gaps before merge.
