# ADR 0004 — Player is Not User in V1
Status: Accepted

## Decision
Players are child domain entities managed by guardians/staff. V1 does not require child authentication.

## Consequence
Future supervised player login must link an Auth User to an existing Player rather than redefine Player identity.
