# Permissions and Capability Matrix

Authorization is contextual. There is no single global user role.

## Roles

Club-level:
- CLUB_ADMIN

Team-level:
- HEAD_COACH
- ASSISTANT_COACH
- TEAM_MANAGER

Relationship:
- GUARDIAN of Player

PLAYER is not an authenticated role in V1.

## Capability philosophy

UI may hide unavailable actions, but authoritative enforcement must exist in application authorization and/or RLS.

### Club capabilities
- club.read
- club.manage
- teams.create
- teams.manage
- people.read
- people.manage
- staff.assign
- audit.read

### Team capabilities
- team.read
- team.manage
- roster.read_masked
- roster.read_full
- roster.manage
- fixture.read
- fixture.manage_manual
- fixture.overlay_manage
- attendance.read_team
- attendance.manage_managed_player
- training.manage
- coach_checkin
- announcement.publish
- announcement.read
- announcement.ack
- duty.manage
- duty.respond
- fillin.manage
- coaching_stats.read
- coaching_stats.write
- post_game_review.read
- post_game_review.write
- recognition.read
- recognition.write
- private_player_note.read
- private_player_note.write
- practice_plan.manage

## Baseline matrix

| Capability | Club Admin | Head Coach | Assistant Coach | Team Manager | Guardian |
|---|---:|---:|---:|---:|---:|
| club.read | yes | scoped | scoped | scoped | scoped |
| club.manage | yes | no | no | no | no |
| team.read | yes | yes | yes | yes | yes if child registered |
| team.manage | yes | limited/no by policy | no | operational | no |
| roster.read_masked | yes | yes | yes | yes | yes own team |
| roster.read_full | yes | yes | yes | yes | no by default |
| roster.manage | yes | no | no | yes | no |
| fixture.read | yes | yes | yes | yes | yes |
| fixture.manage_manual | yes | optional head coach | no | yes | no |
| fixture.overlay_manage | yes | yes | optional | yes | no |
| attendance.read_team | yes | yes | yes | yes | no |
| attendance.manage_managed_player | no unless guardian | no unless guardian | no unless guardian | no unless guardian | yes |
| training.manage | yes | yes | optional | yes | no |
| coach_checkin | no unless coach | yes | yes | no unless coach | no |
| announcement.publish | yes | yes | optional | yes | no |
| announcement.ack | yes if targeted | yes | yes | yes | yes |
| duty.manage | yes | optional | no | yes | no |
| duty.respond | yes if assigned | yes if assigned | yes if assigned | yes if assigned | yes if assigned |
| fillin.manage | yes | yes | optional | yes | no |
| coaching_stats.read | yes | yes | yes | no M4 | no M4 |
| coaching_stats.write | yes | yes | yes | no M4 | no M4 |
| post_game_review.read | yes | yes | yes | no M4 | no M4 |
| post_game_review.write | yes | yes | yes | no M4 | no M4 |
| recognition.read | yes | yes | yes | no M4 | no M4 |
| recognition.write | yes | yes | yes | no M4 | no M4 |
| private_player_note.read | only with active team coaching membership | yes | yes | no M4 | no M4 |
| private_player_note.write | only with active team coaching membership | yes | yes | no M4 | no M4 |
| practice_plan.manage | yes | yes | yes | no M4 | no M4 |

Any change to this table is a product/security change and should be reviewed.

### Frozen Milestone 4 authorization rules

- For M4 only, an active `ASSISTANT_COACH` membership has the same coaching capabilities as an active `HEAD_COACH` membership for that assigned team. No delegation mechanism is part of MVP.
- All M4 team capabilities are checked against current active team membership on every request; revocation immediately denies subsequent requests.
- `TEAM_MANAGER` receives no M4 coaching capabilities, including game score entry. Existing non-M4 fixture administration remains governed by `fixture.manage_manual`; that capability cannot be used to write or clear M4 scores.
- `CLUB_ADMIN` may manage M4 stats, team reviews, recognition and practice plans under the existing club-admin scope. Club-admin authority alone never grants access to `STAFF_PRIVATE` player notes. `private_player_note.read/write` requires an active Head or Assistant Coach membership for the exact game team. A user holding both roles is allowed only through the active team coaching membership.
- Guardians have no MVP access to M4 stats, reviews, recognition, private notes, or plans. A Guardian who is also an active Coach is authorized only through the applicable coaching membership.
- Score write RPCs require `coaching_stats.write`; legacy fixture metadata updates preserve scores and cannot mutate them. Imported/provider-owned official result fields remain provider-owned.

## Guardian derivation

Guardian access requires:
1. active auth User;
2. active GuardianRelationship;
3. Player actively registered to Team/Season;
4. requested resource belongs to that permitted context.

Never infer guardian permission from matching surname, phone or email alone.

## Full-name policy

Guardian team roster:
- first name + surname initial.

Staff roster:
- full name if required for team operation.

Club Admin:
- full name as required.

## RLS requirements

Each policy gets:
- intended allow test;
- same-club wrong-team deny test;
- unrelated-user deny test;
- revoked-membership deny test where relevant.

## Service role
Service role bypasses RLS and is server-only.

Any operation using service role must:
- authenticate caller independently;
- authorize capability explicitly;
- scope all queries explicitly;
- emit audit event where privileged;
- never accept tenant ID as sole authorization evidence.
