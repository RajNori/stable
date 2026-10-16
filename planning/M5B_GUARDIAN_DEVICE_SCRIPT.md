# M5B Guardian physical-device acceptance script

Covers acceptance stories **Guardian (sign in → schedule → RSVP → announcement)**, **Guardian (duty / fill-in)** and **Mobile (real phone)**. Gates PG-AUTH-01, PG-HOME-01, PG-SCHEDULE-01, PG-RSVP-01, PG-DUTY-01/02/03, PG-FILL-01, PG-OFF-01 and M5B-G07.

Time: about 25 minutes. Use synthetic data only and never real child data.

## Preconditions (staff, before handing over the phone)

1. Use an EAS **preview** build pointed at **staging** (not a local Metro build) on a physical iPhone. Record the build SHA here: `________`.
2. Staging has been reseeded with `scripts/staging/seed-pilot.ts --confirm-staging` (needs human approval per run). That gives one club, two teams, and a guardian with children on both teams.
3. The hosted Supabase phone provider (SMS) is configured for staging. If it isn't, run steps 3–4 with **Continue with email** and mark PG-AUTH-01 as *email only*.
4. A Team Manager has a web session open on staging for the same team. You'll need it for steps 8, 11 and 12.
5. In the guardian's team (web, as Manager), create:
   - a fixture 3+ days out;
   - an announcement with **Acknowledgement required**;
   - an open duty, then **Commit allocation**.
   Also open a fill-in request on the *other* team's game.

## Steps

| # | Actor | Action | Pass when |
|---|---|---|---|
| 1 | Manager (web) | Create a guardian invitation for the seeded child and copy the link | Invitation link appears |
| 2 | Guardian | Open the link on the iPhone | The app opens (not Safari) on the invitation |
| 3 | Guardian | **Continue with mobile** → enter the AU mobile → **Continue** | SMS arrives within 60 s |
| 4 | Guardian | Enter the code in **6-digit code** | Lands on **Club home** with no error and no second sign-in |
| 5 | Guardian | Look at **Home** | **Next up** shows the fixture from precondition 5 with arrival/venue and **Response requested** |
| 6 | Guardian | Tap **Open schedule** | Games and training are in time order and show only this child's team |
| 7 | Guardian | **Open Game Day** → **Respond to game** → **Attending** | The RSVP shows Attending, and it persists after you kill and relaunch the app |
| 8 | Manager (web) | Reload Game Day | `Attending 1, …` and the count changed |
| 9 | Guardian | **Open team updates** → **Acknowledge** on the required announcement | The button disappears |
| 10 | Guardian | Game Day → **Your game duty** → **Acknowledge duty** | Shows **Duty acknowledged.** (only if the duty was allocated to this guardian; otherwise reassign in web and repeat) |
| 11 | Guardian | **Request a swap** | Shows **Open swap request sent.** The Manager's web Game Day shows **Open swap …** |
| 12 | Second eligible adult | On their device or web: **Accept swap** | Shows **Swap accepted.** Accepting again fails, so the swap happened only once |
| 13 | Guardian | Switch team (team selector) to the child's other team | Home, Schedule, Team and Updates refresh, with no stale data from team 1 |
| 14 | Guardian | Open the fill-in request → **Respond for <child>** | Response recorded. The Manager sees the response on web |
| 15 | Guardian | **Team** tab | Teammates show as first name + surname initial only |
| 16 | Guardian | Turn on Airplane mode → open Game Day | The last loaded Game Day is readable and shows an offline/stale label. RSVP/ack buttons are disabled or queued, not silently lost |
| 17 | Guardian | Turn Airplane mode off → **Profile** → **Sign out** | Returns to sign-in. Relaunching the app does not restore the session |

## Accessibility pass (M5B-G07)

- VoiceOver on: you can complete steps 5, 7 and 10 using only swipe and double-tap.
- Dynamic Type at the largest accessibility size: no truncated buttons on Home or Game Day.
- Touch targets are at least 44 pt on RSVP, Acknowledge and Request a swap.

## Record

| Step | Pass/Fail | Notes / screenshot (no child names) |
|---|---|---|
| 1–17 | | |

Verdict: Guardian story A ___ · Guardian story B ___ · Mobile story ___ · Tester ___ · Date ___
