# The Stable — Approved V1 Design System

**Status:** APPROVED — V1 DESIGN CONTRACT  
**Visual reference:** `design/stable-v1-final.png`  
**Initial theme:** Mentone Mustangs  
**Applies to:** Expo mobile + Next.js Club Admin  
**Architecture rule:** Mustangs branding is a tenant theme, never hard-coded domain behaviour.

---

# 1. Design intent

The Stable should feel like a serious modern junior-sport product:

- athletic;
- calm;
- fast to scan;
- warm/community-oriented;
- usable outdoors;
- premium without feeling corporate;
- clearly connected to Mentone Mustangs.

The approved visual direction is:

> **Know what's next. Show up ready.**

The app is not:
- a generic SaaS dashboard;
- a school portal;
- an ESPN clone;
- a dark crypto/analytics terminal;
- a childish cartoon sports app.

The product must remain legible and actionable when a parent or coach is:
- standing courtside;
- outdoors;
- carrying gear;
- using one hand;
- checking information quickly.

---

# 2. Design authority

Implementation agents use:

1. this document for tokens, behaviour and responsive rules;
2. `design/stable-v1-final.png` for visual hierarchy and composition;
3. product documents for behaviour and permissions.

Do not infer exact spacing or typography from image pixels when this document already specifies the implementation contract.

---

# 3. Theme architecture

Components consume semantic tokens.

Never scatter raw Mentone colours across components.

Required semantic naming:

```text
color.brand.primary
color.brand.primaryStrong
color.brand.accent
color.brand.accentSoft

color.background.canvas
color.background.surface
color.background.surfaceAlt
color.background.inverse

color.text.primary
color.text.secondary
color.text.muted
color.text.inverse

color.border.default
color.border.strong

color.state.success
color.state.successSoft
color.state.warning
color.state.warningSoft
color.state.error
color.state.errorSoft
color.state.info
color.state.infoSoft
```

The Mentone Mustangs theme maps these semantic tokens to the palette below.

---

# 4. Approved Mustangs palette

These are the implementation tokens for V1.

## Brand

```text
mustangs.green.950  #04372C
mustangs.green.900  #063F32
mustangs.green.800  #07503E
mustangs.green.700  #086348
mustangs.green.600  #087757

mustangs.gold.500   #FFD91A
mustangs.gold.400   #FFE34D
mustangs.gold.200   #FFF09A
mustangs.gold.100   #FFF8CF
```

## Neutral

```text
neutral.950         #111613
neutral.900         #1A211D
neutral.800         #27312B
neutral.700         #38413C
neutral.600         #515D56
neutral.500         #69736D
neutral.400         #909A94
neutral.300         #B9C2BC
neutral.200         #DCE4DF
neutral.100         #EEF3F0
neutral.050         #F7F8F5
white               #FFFFFF
```

## Status

```text
success.600         #1D8A55
success.100         #E7F6EE

warning.600         #D78B08
warning.100         #FFF4D8

error.600           #C53D3D
error.100           #FCE9E9

info.600            #3178C6
info.100            #E9F2FC
```

## Semantic mapping

```text
color.brand.primary       -> mustangs.green.800
color.brand.primaryStrong -> mustangs.green.950
color.brand.accent        -> mustangs.gold.500
color.brand.accentSoft    -> mustangs.gold.100

color.background.canvas   -> neutral.050
color.background.surface  -> white
color.background.surfaceAlt -> neutral.100
color.background.inverse  -> mustangs.green.950

color.text.primary        -> neutral.950
color.text.secondary      -> neutral.700
color.text.muted          -> neutral.500
color.text.inverse        -> white

color.border.default      -> neutral.200
color.border.strong       -> neutral.300

color.state.success       -> success.600
color.state.successSoft   -> success.100
color.state.warning       -> warning.600
color.state.warningSoft   -> warning.100
color.state.error         -> error.600
color.state.errorSoft     -> error.100
color.state.info          -> info.600
color.state.infoSoft      -> info.100
```

---

# 5. Colour usage rules

## Green
Green carries identity and structural emphasis.

Use for:
- navigation;
- Game Day hero;
- strong headings/brand surfaces;
- selected states where appropriate;
- coach/staff action surfaces where the design calls for it.

## Gold
Gold is deliberately scarce.

Use for:
- primary CTA;
- action-required emphasis;
- active sports energy;
- selected/important badges;
- limited Game Day accents.

Do not:
- fill most cards with yellow;
- use gold for long-form text;
- use it decoratively everywhere.

Its effectiveness depends on rarity.

## Status colours
Status meaning must never rely on colour alone.
Always pair with:
- label;
- icon;
- shape;
- or text.

---

# 6. Typography

## Font
Primary:
- `Geist` where bundled/available for cross-platform consistency.

Fallback:
- iOS native system;
- Android system sans;
- web system sans.

Do not block app rendering on custom-font loading.

## Scale

```text
display.lg      44 / 48 / 800
display.md      36 / 40 / 800

heading.xl      32 / 36 / 750
heading.lg      28 / 32 / 750
heading.md      24 / 28 / 700
heading.sm      20 / 24 / 700

title.lg        18 / 24 / 700
title.md        16 / 22 / 700
title.sm        15 / 20 / 650

body.lg         17 / 24 / 450
body.md         16 / 23 / 450
body.sm         14 / 20 / 450

label.lg        15 / 20 / 650
label.md        14 / 18 / 650
label.sm        13 / 17 / 650

caption         13 / 17 / 500
micro           12 / 16 / 600
```

Format: `font-size / line-height / weight`.

## Practical minimums

Normal body copy:
- prefer 15–16 pt minimum.

Secondary/meta copy:
- prefer 13–14 pt.

`micro` 12 pt:
- only for short non-critical metadata;
- never for required instructions or important state.

## Athletic emphasis
Uppercase is allowed selectively for:
- GAME DAY
- ROUND
- COURT
- small category labels.

Do not uppercase paragraphs or normal navigation labels.

## Numeric emphasis
Use strong tabular numerals where available for:
- game time;
- score;
- court number;
- stats;
- attendance totals.

---

# 7. Spacing

4-point base system.

```text
space.0   0
space.1   4
space.2   8
space.3   12
space.4   16
space.5   20
space.6   24
space.8   32
space.10  40
space.12  48
space.16  64
```

Default mobile screen horizontal padding:
- 16 px on compact devices;
- 20 px where width permits.

Default desktop content gaps:
- 20–24 px.

Avoid arbitrary values unless a platform primitive requires one.

---

# 8. Radii

```text
radius.sm       8
radius.md       12
radius.lg       16
radius.xl       20
radius.hero     24
radius.pill     999
```

Do not make every surface pill-shaped.

Use larger rounding for:
- hero cards;
- bottom sheets;
- major grouped surfaces.

---

# 9. Elevation and borders

The design relies primarily on:
- whitespace;
- contrast;
- borders;
- surface tone;
- typography.

Shadows are restrained.

Suggested tokens:

```text
shadow.none
shadow.sm
shadow.md
```

Mobile default cards:
- 1 px subtle border or tonal separation;
- little/no shadow.

Hero/raised modal:
- `shadow.md` where platform-appropriate.

No heavy floating dashboard shadows.

---

# 10. Iconography

Use one icon family consistently.

Preferred:
- Lucide-compatible icon set.

Rules:
- 20–24 px normal UI icon;
- 16 px compact metadata icon;
- 24–28 px primary navigation/action icon.

Do not mix icon families.
Do not use icon-only controls when meaning is ambiguous.

---

# 11. Touch targets

Minimum:
- 44 × 44 pt.

Preferred for primary Game Day/RSVP actions:
- 48+ pt height.

Buttons must remain usable under larger accessibility text.

---

# 12. Buttons

## Primary
Visual:
- gold fill;
- near-black/green text;
- high prominence.

Use for:
- singular primary action;
- confirmation;
- Game Day;
- Save/Continue where appropriate.

## Secondary
Visual:
- surface or light background;
- green border/text.

## Tertiary
Text/low-chrome action.

## Destructive
Error surface/border/text, never gold.

## Height

```text
button.sm   40
button.md   44
button.lg   48
```

Primary mobile actions should usually use 44–48.

## States
Every button implementation must support:
- default;
- pressed;
- focused where applicable;
- disabled;
- loading;
- destructive where relevant.

Loading state preserves width to avoid layout shift.

---

# 13. Inputs

Required states:
- default;
- focused;
- filled;
- error;
- disabled;
- read-only where required.

Input height:
- ~48 px normal.

Error messages:
- 13–14 pt;
- explicit text;
- never colour-only.

Phone input:
- Australian-friendly entry;
- normalized to E.164 in application boundary.

OTP:
- large, spaced code cells;
- accessible as one logical code input where implementation allows.

---

# 14. Cards

Cards are information hierarchy, not decoration.

## Standard card
- surface background;
- radius.lg;
- 16 px padding mobile;
- subtle border.

## Action-required card
- stronger status/brand treatment;
- concise;
- one obvious next action.

## Game card
- stronger team identity;
- time/opponent are highest hierarchy.

## Training card
- visually distinct from Game card through label/icon/layout;
- never rely on colour alone.

## Coach/staff card
Coach-specific tools may use subtle staff labels/tags, but should remain part of the same product.

Do not create a visually separate "coach application".

---

# 15. Navigation

## Mobile primary navigation

Approved destinations:

```text
Home
Schedule
Team
Updates
Profile
```

Game Day and Training are contextual destinations, not permanent bottom tabs.

A user with additional coach/manager capabilities receives contextual controls inside existing screens.

Do not create separate accounts or duplicate navigation for multi-role adults.

## Admin web

Primary navigation:

```text
Overview
Teams
People
Schedule
Training
Announcements
Coaches
Settings
```

Navigation remains operational and compact.

---

# 16. Parent Home

Hierarchy:

1. next important event;
2. action required;
3. training;
4. latest important update;
5. short upcoming list.

Do not turn Home into an infinite dashboard.

The user should understand the next basketball obligation/action in under 5 seconds.

---

# 17. Game Day

Game Day is the visual hero of the product.

Highest hierarchy:
- tip-off time;
- opponent;
- arrival time;
- venue/court;
- own child's availability;
- own duty.

Secondary:
- coach focus;
- team availability summary for staff;
- uniform;
- directions.

Use:
- deep green hero;
- restrained gold;
- bold numeric type;
- very clear CTA hierarchy.

No unnecessary charts or stats on pre-game parent Game Day.

---

# 18. RSVP

Approved choices:

```text
Going
Unsure
Can't make it
```

This control must be extremely fast.

Rules:
- large targets;
- immediate state feedback;
- optional absence reason;
- absence reason private to authorized staff;
- no public explanation to other families.

---

# 19. Schedule

Default:
- agenda/list.

Optional month/calendar view may exist.

Filters:
- All
- Games
- Training
- Club

Event type must be identifiable without colour alone.

---

# 20. Training

Parent view:
- time;
- venue/court;
- attendance state;
- coach;
- note;
- directions.

Coach view augments with:
- attendance list;
- check-in;
- practice plan;
- edit controls.

Recurring-series edit actions must clearly distinguish:
- this session;
- this and future;
- entire series.

---

# 21. Duties

Guardian:
- assigned duty;
- acknowledgement;
- request swap.

Manager:
- manual assignment;
- automatic allocation preview;
- fairness context;
- commit.

Automatic allocation preview should expose a concise reason/fairness cue when practical, e.g.:

```text
Raj — 1 duty this season
Sarah — 2 duties
```

The algorithm is domain logic; UI only explains outcome.

---

# 22. Announcements

No chat in MVP.

Announcement cards show:
- category;
- author;
- timestamp;
- concise body;
- acknowledgement action if required.

Manager sees acknowledgement progress.

Important announcements may receive stronger emphasis, but not full-screen alarm styling by default.

---

# 23. Coaching statistics

MVP staff-only workflow includes:
- team final score;
- points;
- rebounds;
- assists;
- steals;
- fouls;
- approximate minutes.

Mobile stat entry must not be a miniature desktop spreadsheet.

Use:
- player row/card;
- tap into fast stat-entry controls;
- clear save/complete state;
- correction/edit capability.

Team summary table/grid is appropriate for web or wider layouts.

Stats remain staff-facing in MVP.

---

# 24. Post-game review

Post-game workflow:

```text
Game result
→ player stats
→ team review
→ private player notes
→ recognition
→ next training focus
```

## Team review
Capture:
- what worked;
- what needs improvement;
- focus tags.

## Private player notes
Must show a subtle but explicit privacy cue:
- `Private to coaching staff`
- lock icon where appropriate.

Do not use frightening warning styling.

## Recognition
Milestone 4 categories are exactly:
- MVP / Player of the Game (one recipient per game);
- Hustle;
- Defence;
- Teamwork.

A player may receive each non-MVP category at most once per game. Recognition is not a public leaderboard.

Milestone 4 development focus codes are bounded to Shooting, Ball Handling, Passing, Rebounding, Defence, Communication, Teamwork and Transition. A review may carry up to five unique focus codes. A coach explicitly selects focus into a same-team practice plan; that selection remains a snapshot if the source review later changes.

---

# 25. Practice planner

MVP planner supports:
- timed blocks;
- reorder;
- add drill;
- notes;
- duplicate previous;
- reusable template;
- review-derived focus.

Practice blocks should be easily scannable with:
- title;
- duration;
- small category/focus cue.

The planner must feel faster than using Notes.

No AI-generated sessions in MVP.

---

# 26. Offline Game Day

Offline is a normal state, not an error page.

Display:

```text
Offline · Last updated 8:42 AM
```

Keep the same information hierarchy.

Cached read-only essentials remain visible.

Network-required actions must:
- explain unavailable/pending state clearly;
- never silently pretend success.

---

# 27. Loading

Prefer content-shaped skeletons.

Avoid full-screen spinner unless the whole application truly cannot proceed.

Skeleton must resemble final layout enough to reduce shift.

---

# 28. Empty states

Tone:
- concise;
- warm;
- operational.

Examples:

```text
No game scheduled yet.
We'll show it here when the fixture is added.
```

```text
Nothing new from the team.
```

```text
You're duty-free this round.
```

Subtle personality is acceptable; no gimmicks.

---

# 29. Error states

Required patterns:
- network unavailable;
- permission denied;
- stale fixture;
- expired invitation;
- OTP failure;
- upstream PlayHQ unavailable;
- failed action/retry.

Every error must tell the user what they can do next where applicable.

---

# 30. Coach/staff capability treatment

A guardian may also be coach/manager.

Do not switch them into a totally different application.

Instead:
- add staff controls contextually;
- show small role/capability cues;
- keep bottom navigation consistent;
- expose staff operations only where relevant.

Coach-only/private surfaces can use a subtle `Coach` / `Staff` label.

---

# 31. Admin web

The Club Admin is a real desktop product.

Do not simply stretch mobile cards.

## 1024
- compact sidebar/navigation;
- one/two-column content;
- tables may simplify.

## 1280
- fuller operational tables;
- wider Needs Attention/work queues.

## 1440
- use available horizontal space intentionally;
- avoid leaving the interface stranded in the upper-left;
- allow side-by-side operational panels where useful.

Admin overview prioritizes:
- teams;
- players;
- weekend games;
- outstanding RSVPs;
- open fill-ins;
- Needs Attention.

No vanity charts unless they drive action.

---

# 32. Responsive mobile rules

Validate at:
- 360;
- 393;
- 430 px.

## 360
- stack secondary actions;
- avoid 3-column controls unless each remains >=44 px;
- wrap metadata;
- preserve time/opponent hierarchy;
- never horizontally clip primary content.

## 393
Reference target.

## 430
May increase spacing or use compact two-column sections where approved, but do not turn phone UI into tablet UI.

All components must tolerate:
- text expansion;
- long team/opponent names;
- long venue names.

---

# 33. Accessibility

Minimum expectations:
- WCAG AA contrast where applicable;
- dynamic text tolerance;
- VoiceOver/TalkBack labels;
- no colour-only meaning;
- logical focus order;
- 44 pt targets;
- clear disabled state;
- reduce-motion support;
- accessible errors and validation.

Accessibility may override literal visual replication from the PNG.

---

# 34. Motion

Allowed:
- subtle screen/card entrance;
- bottom sheet transition;
- RSVP confirmation;
- acknowledgement confirmation;
- stat increment feedback;
- lightweight completion state.

Avoid:
- bouncing;
- autoplay decorative motion;
- heavy parallax;
- sports-broadcast theatrics.

Respect `prefers-reduced-motion` / platform reduce motion.

---

# 35. Component inventory

Implementation should provide reusable primitives for at least:

```text
AppHeader
BottomNavigation
ClubSwitcher
TeamSwitcher

GameHero
GameCard
TrainingCard
EventCard
ActionRequiredCard

PlayerRow
AttendanceSummary
RSVPControl

AnnouncementCard
AcknowledgementStatus

DutyCard
DutyStatus
SwapRequestCard

FillInCard

CoachNote
PrivateNote
RecognitionCard
StatEntryControl
StatsSummary

PracticeBlock
PracticeTimeline

Metric
StatusBadge
RoleBadge

PrimaryButton
SecondaryButton
TertiaryButton
DestructiveButton

TextInput
PhoneInput
OTPInput
Select
DatePicker
TimePicker
Toggle
Checkbox

BottomSheet
Modal
Toast
Banner
OfflineBanner

EmptyState
ErrorState
SkeletonState
```

Do not build every component in advance. Create them as vertical slices need them, but keep the system consistent.

---

# 36. Component states

Every interactive component must define relevant states from:

```text
default
pressed
focused
selected
disabled
loading
error
success
offline
stale
pending
completed
```

Do not invent ad hoc colours for states.

---

# 37. Implementation constraints

## Mobile
- Expo / React Native;
- platform-appropriate safe areas;
- keyboard avoidance;
- no fixed pixel heights that break Dynamic Type;
- semantic tokens from shared design package.

## Web
- Next.js;
- CSS/tokens aligned with semantic design system;
- real responsive layout, not desktop-only assumptions.

## Shared
Share tokens and contracts.
Do not force-share React Native and web UI components.

---

# 38. Design QA

Before a screen is accepted, verify:

### Scanability
Can the primary information/action be understood in 3–5 seconds?

### Accessibility
Does text remain readable at real device scale?

### Responsiveness
Does it work at required target widths?

### Brand discipline
Is green carrying identity and gold remaining scarce?

### Role clarity
Does a parent+coach still understand the screen?

### Privacy
Is child/private information unnecessarily exposed?

### Consistency
Are existing tokens/components reused?

### Fidelity
Does composition match the approved board without sacrificing accessibility?

---

# 39. Final implementation principle

The PNG establishes the product's visual character.

This document establishes the engineering contract.

Agents should reproduce the approved experience faithfully, not redesign it.
