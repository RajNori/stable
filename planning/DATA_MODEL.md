# Data Model — Initial Relational Plan

This is a design contract, not a substitute for migrations. The Supabase/Data agent may refine names/indexes through an ADR if needed.

## Naming
- PostgreSQL snake_case.
- UUID primary keys.
- `created_at` / `updated_at` timestamptz.
- Store timestamps in UTC; display in club timezone.
- Club timezone defaults to `Australia/Melbourne` for Mentone.

## Candidate tables

### clubs
- id
- name
- slug
- timezone
- theme_key
- active

### seasons
- id
- club_id
- name
- starts_on
- ends_on
- active

### competitions
- id
- club_id
- season_id
- name
- external_source nullable
- external_id nullable

### teams
- id
- club_id
- season_id
- competition_id nullable
- name
- age_group
- gender_category
- active
- external_source nullable
- external_id nullable

### venues
- id
- club_id nullable if shared
- name
- address_text
- map_url nullable
- notes nullable

### profiles
- user_id
- display_name
- first_name
- last_name
- phone_e164 nullable
- email nullable
- locale

Do not rely on profile phone/email as authentication authority; Auth remains authoritative.

### players
- id
- club_id
- first_name
- last_name
- preferred_name nullable
- status
- date_of_birth only if actually required by eligibility rules; otherwise do not collect in MVP.

### guardian_relationships
- id
- club_id
- user_id
- player_id
- relationship_label nullable
- can_manage
- active

Unique active relationship as appropriate.

### club_memberships
- id
- club_id
- user_id
- role
- active

### team_memberships
- id
- club_id
- team_id
- user_id
- role
- active

### player_team_registrations
- id
- club_id
- team_id
- player_id
- jersey_number nullable
- position_label nullable
- active

### invitations
- id
- club_id
- team_id nullable
- invite_type
- intended_email nullable
- intended_phone nullable
- intended_role/relationship
- token_hash or provider-safe opaque identifier
- expires_at
- accepted_at nullable
- revoked_at nullable
- created_by

Never store raw reusable secret tokens.

### events
- id
- club_id
- team_id nullable
- event_type
- starts_at
- ends_at
- venue_id nullable
- court_label nullable
- status
- recurrence_series_id nullable

### recurrence_series
- id
- club_id
- team_id
- rule_json or normalized recurrence fields
- starts_on
- ends_on nullable
- timezone

Prefer explicit, testable recurrence semantics rather than arbitrary opaque text only.

### games
- event_id PK/FK
- competition_id nullable
- round_label nullable
- opponent_name
- source
- external_id nullable
- official_start_at
- official_venue_text nullable
- official_court_label nullable
- fixture_status
- home_away nullable
- team_score nullable
- opponent_score nullable
- result_status nullable
- last_external_sync_at nullable

### game_team_overlay
- game_event_id
- arrival_at nullable
- uniform_note nullable
- coach_focus nullable
- team_note nullable

Separate overlay prevents external sync overwriting team data.

### training_sessions
- event_id
- lead_coach_user_id nullable
- checked_in_at nullable
- checked_in_by nullable
- practice_plan_id nullable

### attendance_responses
- id
- club_id
- team_id
- event_id
- player_id
- status
- absence_category nullable
- private_note nullable
- responded_by_user_id
- updated_at

Unique event_id + player_id.

### duties
- id
- club_id
- team_id
- event_id
- duty_type
- label

### duty_assignments
- id
- duty_id
- assigned_user_id
- status
- assigned_by
- acknowledged_at nullable

### duty_swap_requests
- id
- assignment_id
- requested_by
- target_user_id nullable
- status
- accepted_by nullable
- resolved_at nullable
- version/locking field if required

### duty_allocation_runs
- id
- club_id
- team_id
- created_by
- mode
- preview_json
- committed_at nullable

### fill_in_requests
- id
- club_id
- team_id
- game_event_id
- count_needed
- note nullable
- status
- created_by

### fill_in_responses
- id
- request_id
- player_id
- responded_by_user_id
- response

### fill_in_confirmations
- id
- request_id
- player_id
- confirmed_by
- confirmed_at

### announcements
- id
- club_id
- team_id nullable
- author_user_id
- category
- title
- body
- acknowledgement_required
- published_at
- expires_at nullable

### announcement_acknowledgements
- announcement_id
- user_id
- acknowledged_at

### device_endpoints
- id
- user_id
- platform
- expo_push_token
- active
- last_seen_at

Protect tokens from broad reads.

### notification_preferences
- user_id
- category
- push_enabled

### notification_deliveries
- id
- user_id
- event_key
- notification_type
- status
- attempt_count
- provider_message_id nullable
- last_error_code nullable
- sent_at nullable

### game_player_stats
- id
- club_id
- team_id
- game_event_id
- player_id
- points
- rebounds
- assists
- steals
- fouls
- approximate_minutes
- recorded_by
- updated_at

Use non-negative checks and realistic limits where helpful without blocking corrections.

### post_game_reviews
- id
- club_id
- team_id
- game_event_id
- team_notes
- completed_by
- completed_at nullable

### player_game_notes
- id
- club_id
- team_id
- game_event_id
- player_id
- note
- author_user_id
- visibility = STAFF_PRIVATE in MVP

### recognitions
- id
- club_id
- team_id
- game_event_id
- player_id
- category
- note nullable
- created_by

### drills
- id
- club_id
- team_id nullable
- name
- instructions
- default_duration_minutes nullable
- active

### practice_plans
- id
- club_id
- team_id
- training_event_id nullable
- title
- notes nullable
- template_source_id nullable
- created_by

### practice_blocks
- id
- practice_plan_id
- sort_order
- drill_id nullable
- title
- duration_minutes
- instructions nullable

### audit_events
- id
- club_id
- team_id nullable
- actor_user_id nullable
- action
- target_type
- target_id
- request_id/correlation_id nullable
- safe_metadata_json
- occurred_at

### playhq_mappings
- id
- club_id
- internal_type
- internal_id
- external_id
- external_parent_id nullable

### playhq_sync_runs
- id
- club_id
- started_at
- finished_at nullable
- status
- counts_json
- error_summary nullable

## Index baseline
Index:
- all tenant FKs used in RLS;
- team_id + starts_at on events;
- player_id + event_id attendance uniqueness;
- external IDs;
- active memberships;
- notification undelivered queries;
- audit time/context queries.

Do not pre-index every column. Validate with actual query plans as data grows.
