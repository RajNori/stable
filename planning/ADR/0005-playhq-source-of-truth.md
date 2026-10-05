# ADR 0005 — PlayHQ Official Source of Truth
Status: Accepted with staged activation

## Decision
Before API access, official fixture data may be manual/imported. Once integrated, PlayHQ is authoritative for official fixture/result/ladder fields.

The Stable always owns team overlay data.

## Consequence
External sync cannot overwrite arrival time, RSVP, duties, notes or practice data.
