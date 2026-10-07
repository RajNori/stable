export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      announcement_acknowledgements: {
        Row: {
          acknowledged_at: string;
          announcement_id: string;
          user_id: string;
        };
        Insert: {
          acknowledged_at?: string;
          announcement_id: string;
          user_id: string;
        };
        Update: {
          acknowledged_at?: string;
          announcement_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcement_acknowledgements_announcement_id_fkey";
            columns: ["announcement_id"];
            isOneToOne: false;
            referencedRelation: "announcements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "announcement_acknowledgements_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      announcement_reads: {
        Row: {
          announcement_id: string;
          read_at: string;
          user_id: string;
        };
        Insert: {
          announcement_id: string;
          read_at?: string;
          user_id: string;
        };
        Update: {
          announcement_id?: string;
          read_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey";
            columns: ["announcement_id"];
            isOneToOne: false;
            referencedRelation: "announcements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "announcement_reads_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      announcements: {
        Row: {
          acknowledgement_required: boolean;
          archived_at: string | null;
          author_user_id: string;
          body: string;
          category: string;
          club_id: string;
          id: string;
          importance: string;
          published_at: string;
          team_id: string;
          title: string;
        };
        Insert: {
          acknowledgement_required: boolean;
          archived_at?: string | null;
          author_user_id: string;
          body: string;
          category: string;
          club_id: string;
          id?: string;
          importance: string;
          published_at?: string;
          team_id: string;
          title: string;
        };
        Update: {
          acknowledgement_required?: boolean;
          archived_at?: string | null;
          author_user_id?: string;
          body?: string;
          category?: string;
          club_id?: string;
          id?: string;
          importance?: string;
          published_at?: string;
          team_id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "announcements_author_fkey";
            columns: ["author_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "announcements_team_club_fkey";
            columns: ["team_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id", "club_id"];
          },
        ];
      };
      attendance_responses: {
        Row: {
          absence_category: string | null;
          club_id: string;
          event_id: string;
          id: string;
          player_id: string;
          private_note: string | null;
          responded_by_user_id: string;
          status: string;
          team_id: string;
          updated_at: string;
        };
        Insert: {
          absence_category?: string | null;
          club_id: string;
          event_id: string;
          id?: string;
          player_id: string;
          private_note?: string | null;
          responded_by_user_id: string;
          status: string;
          team_id: string;
          updated_at?: string;
        };
        Update: {
          absence_category?: string | null;
          club_id?: string;
          event_id?: string;
          id?: string;
          player_id?: string;
          private_note?: string | null;
          responded_by_user_id?: string;
          status?: string;
          team_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_responses_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_responses_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_responses_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_responses_team_same_club";
            columns: ["team_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id", "club_id"];
          },
        ];
      };
      audit_events: {
        Row: {
          action: string;
          actor_user_id: string;
          club_id: string;
          created_at: string;
          id: string;
          target_id: string;
        };
        Insert: {
          action: string;
          actor_user_id: string;
          club_id: string;
          created_at?: string;
          id?: string;
          target_id: string;
        };
        Update: {
          action?: string;
          actor_user_id?: string;
          club_id?: string;
          created_at?: string;
          id?: string;
          target_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_events_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      club_memberships: {
        Row: {
          active: boolean;
          club_id: string;
          created_at: string;
          id: string;
          role: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          club_id: string;
          created_at?: string;
          id?: string;
          role: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          active?: boolean;
          club_id?: string;
          created_at?: string;
          id?: string;
          role?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "club_memberships_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      clubs: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          name: string;
          slug: string;
          theme_key: string;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          slug: string;
          theme_key: string;
          timezone: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          slug?: string;
          theme_key?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      competitions: {
        Row: {
          active: boolean;
          club_id: string;
          created_at: string;
          id: string;
          name: string;
          season_id: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          club_id: string;
          created_at?: string;
          id?: string;
          name: string;
          season_id: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          club_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          season_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "competitions_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "competitions_season_same_club";
            columns: ["season_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id", "club_id"];
          },
        ];
      };
      device_endpoints: {
        Row: {
          active: boolean;
          expo_push_token: string;
          id: string;
          last_seen_at: string;
          platform: string;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          expo_push_token: string;
          id?: string;
          last_seen_at?: string;
          platform: string;
          user_id: string;
        };
        Update: {
          active?: boolean;
          expo_push_token?: string;
          id?: string;
          last_seen_at?: string;
          platform?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "device_endpoints_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      drills: {
        Row: {
          active: boolean;
          club_id: string;
          created_at: string;
          default_duration_minutes: number | null;
          id: string;
          instructions: string;
          name: string;
          team_id: string;
        };
        Insert: {
          active?: boolean;
          club_id: string;
          created_at?: string;
          default_duration_minutes?: number | null;
          id?: string;
          instructions?: string;
          name: string;
          team_id: string;
        };
        Update: {
          active?: boolean;
          club_id?: string;
          created_at?: string;
          default_duration_minutes?: number | null;
          id?: string;
          instructions?: string;
          name?: string;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "drills_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "drills_team_club_fkey";
            columns: ["team_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id", "club_id"];
          },
        ];
      };
      duties: {
        Row: {
          club_id: string;
          created_at: string;
          duty_type: string;
          event_id: string;
          id: string;
          label: string;
          team_id: string;
        };
        Insert: {
          club_id: string;
          created_at?: string;
          duty_type: string;
          event_id: string;
          id?: string;
          label: string;
          team_id: string;
        };
        Update: {
          club_id?: string;
          created_at?: string;
          duty_type?: string;
          event_id?: string;
          id?: string;
          label?: string;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "duties_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "duties_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "duties_team_same_club";
            columns: ["team_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id", "club_id"];
          },
        ];
      };
      duty_assignments: {
        Row: {
          acknowledged_at: string | null;
          assigned_by: string;
          assigned_user_id: string;
          created_at: string;
          duty_id: string;
          id: string;
          status: string;
        };
        Insert: {
          acknowledged_at?: string | null;
          assigned_by: string;
          assigned_user_id: string;
          created_at?: string;
          duty_id: string;
          id?: string;
          status?: string;
        };
        Update: {
          acknowledged_at?: string | null;
          assigned_by?: string;
          assigned_user_id?: string;
          created_at?: string;
          duty_id?: string;
          id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "duty_assignments_duty_id_fkey";
            columns: ["duty_id"];
            isOneToOne: true;
            referencedRelation: "duties";
            referencedColumns: ["id"];
          },
        ];
      };
      duty_swap_requests: {
        Row: {
          assignment_id: string;
          club_id: string;
          created_at: string;
          id: string;
          requester_user_id: string;
          resolved_at: string | null;
          status: string;
          target_user_id: string | null;
          team_id: string;
        };
        Insert: {
          assignment_id: string;
          club_id: string;
          created_at?: string;
          id?: string;
          requester_user_id: string;
          resolved_at?: string | null;
          status?: string;
          target_user_id?: string | null;
          team_id: string;
        };
        Update: {
          assignment_id?: string;
          club_id?: string;
          created_at?: string;
          id?: string;
          requester_user_id?: string;
          resolved_at?: string | null;
          status?: string;
          target_user_id?: string | null;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "duty_swap_requests_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "duty_assignments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "duty_swap_requests_requester_user_id_fkey";
            columns: ["requester_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "duty_swap_requests_target_user_id_fkey";
            columns: ["target_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "duty_swap_requests_team_club_fkey";
            columns: ["team_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id", "club_id"];
          },
        ];
      };
      events: {
        Row: {
          club_id: string;
          court_label: string | null;
          created_at: string;
          ends_at: string | null;
          event_type: string;
          id: string;
          recurrence_series_id: string | null;
          starts_at: string;
          status: string;
          team_id: string;
          updated_at: string;
          venue_id: string | null;
        };
        Insert: {
          club_id: string;
          court_label?: string | null;
          created_at?: string;
          ends_at?: string | null;
          event_type: string;
          id?: string;
          recurrence_series_id?: string | null;
          starts_at: string;
          status?: string;
          team_id: string;
          updated_at?: string;
          venue_id?: string | null;
        };
        Update: {
          club_id?: string;
          court_label?: string | null;
          created_at?: string;
          ends_at?: string | null;
          event_type?: string;
          id?: string;
          recurrence_series_id?: string | null;
          starts_at?: string;
          status?: string;
          team_id?: string;
          updated_at?: string;
          venue_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "events_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_recurrence_series_same_team";
            columns: ["recurrence_series_id", "team_id"];
            isOneToOne: false;
            referencedRelation: "recurrence_series";
            referencedColumns: ["id", "team_id"];
          },
          {
            foreignKeyName: "events_team_same_club";
            columns: ["team_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id", "club_id"];
          },
          {
            foreignKeyName: "events_venue_same_club";
            columns: ["venue_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id", "club_id"];
          },
        ];
      };
      fill_in_confirmations: {
        Row: {
          confirmed_by: string;
          created_at: string;
          event_id: string;
          id: string;
          player_id: string;
          request_id: string;
        };
        Insert: {
          confirmed_by: string;
          created_at?: string;
          event_id: string;
          id?: string;
          player_id: string;
          request_id: string;
        };
        Update: {
          confirmed_by?: string;
          created_at?: string;
          event_id?: string;
          id?: string;
          player_id?: string;
          request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fill_in_confirmations_confirmed_by_fkey";
            columns: ["confirmed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "fill_in_confirmations_event_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fill_in_confirmations_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fill_in_confirmations_request_event_fkey";
            columns: ["request_id", "event_id"];
            isOneToOne: false;
            referencedRelation: "fill_in_requests";
            referencedColumns: ["id", "event_id"];
          },
          {
            foreignKeyName: "fill_in_confirmations_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: true;
            referencedRelation: "fill_in_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      fill_in_requests: {
        Row: {
          club_id: string;
          created_at: string;
          event_id: string;
          id: string;
          requested_by: string;
          status: string;
          team_id: string;
        };
        Insert: {
          club_id: string;
          created_at?: string;
          event_id: string;
          id?: string;
          requested_by: string;
          status?: string;
          team_id: string;
        };
        Update: {
          club_id?: string;
          created_at?: string;
          event_id?: string;
          id?: string;
          requested_by?: string;
          status?: string;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fill_in_requests_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fill_in_requests_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "fill_in_requests_team_club_fkey";
            columns: ["team_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id", "club_id"];
          },
        ];
      };
      fill_in_responses: {
        Row: {
          created_at: string;
          guardian_user_id: string;
          id: string;
          player_id: string;
          request_id: string;
        };
        Insert: {
          created_at?: string;
          guardian_user_id: string;
          id?: string;
          player_id: string;
          request_id: string;
        };
        Update: {
          created_at?: string;
          guardian_user_id?: string;
          id?: string;
          player_id?: string;
          request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "fill_in_responses_guardian_user_id_fkey";
            columns: ["guardian_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "fill_in_responses_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fill_in_responses_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "fill_in_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      game_player_stat_revisions: {
        Row: {
          actor_user_id: string;
          after_approximate_minutes: number;
          after_assists: number;
          after_fouls: number;
          after_points: number;
          after_rebounds: number;
          after_steals: number;
          before_approximate_minutes: number;
          before_assists: number;
          before_fouls: number;
          before_points: number;
          before_rebounds: number;
          before_steals: number;
          created_at: string;
          game_event_id: string;
          id: string;
          player_id: string;
        };
        Insert: {
          actor_user_id: string;
          after_approximate_minutes: number;
          after_assists: number;
          after_fouls: number;
          after_points: number;
          after_rebounds: number;
          after_steals: number;
          before_approximate_minutes: number;
          before_assists: number;
          before_fouls: number;
          before_points: number;
          before_rebounds: number;
          before_steals: number;
          created_at?: string;
          game_event_id: string;
          id?: string;
          player_id: string;
        };
        Update: {
          actor_user_id?: string;
          after_approximate_minutes?: number;
          after_assists?: number;
          after_fouls?: number;
          after_points?: number;
          after_rebounds?: number;
          after_steals?: number;
          before_approximate_minutes?: number;
          before_assists?: number;
          before_fouls?: number;
          before_points?: number;
          before_rebounds?: number;
          before_steals?: number;
          created_at?: string;
          game_event_id?: string;
          id?: string;
          player_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "game_player_stat_revisions_game_fkey";
            columns: ["game_event_id", "player_id"];
            isOneToOne: false;
            referencedRelation: "game_player_stats";
            referencedColumns: ["game_event_id", "player_id"];
          },
        ];
      };
      game_player_stats: {
        Row: {
          approximate_minutes: number;
          assists: number;
          club_id: string;
          created_at: string;
          fouls: number;
          game_event_id: string;
          player_id: string;
          points: number;
          rebounds: number;
          recorded_by: string;
          steals: number;
          team_id: string;
          updated_at: string;
          updated_by: string;
        };
        Insert: {
          approximate_minutes?: number;
          assists?: number;
          club_id: string;
          created_at?: string;
          fouls?: number;
          game_event_id: string;
          player_id: string;
          points?: number;
          rebounds?: number;
          recorded_by: string;
          steals?: number;
          team_id: string;
          updated_at?: string;
          updated_by: string;
        };
        Update: {
          approximate_minutes?: number;
          assists?: number;
          club_id?: string;
          created_at?: string;
          fouls?: number;
          game_event_id?: string;
          player_id?: string;
          points?: number;
          rebounds?: number;
          recorded_by?: string;
          steals?: number;
          team_id?: string;
          updated_at?: string;
          updated_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "game_player_stats_game_team_club_fkey";
            columns: ["game_event_id", "team_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id", "team_id", "club_id"];
          },
          {
            foreignKeyName: "game_player_stats_player_club_fkey";
            columns: ["player_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id", "club_id"];
          },
        ];
      };
      game_team_overlay: {
        Row: {
          arrival_at: string | null;
          coach_focus: string | null;
          created_at: string;
          game_event_id: string;
          team_note: string | null;
          uniform_note: string | null;
          updated_at: string;
        };
        Insert: {
          arrival_at?: string | null;
          coach_focus?: string | null;
          created_at?: string;
          game_event_id: string;
          team_note?: string | null;
          uniform_note?: string | null;
          updated_at?: string;
        };
        Update: {
          arrival_at?: string | null;
          coach_focus?: string | null;
          created_at?: string;
          game_event_id?: string;
          team_note?: string | null;
          uniform_note?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "game_team_overlay_game_event_id_fkey";
            columns: ["game_event_id"];
            isOneToOne: true;
            referencedRelation: "games";
            referencedColumns: ["event_id"];
          },
        ];
      };
      games: {
        Row: {
          club_id: string;
          competition_id: string | null;
          created_at: string;
          event_id: string;
          external_id: string | null;
          fixture_status: string;
          home_away: string | null;
          last_external_sync_at: string | null;
          official_court_label: string | null;
          official_start_at: string;
          official_venue_text: string | null;
          opponent_name: string;
          opponent_score: number | null;
          result_status: string | null;
          round_label: string | null;
          source: string;
          team_score: number | null;
          updated_at: string;
        };
        Insert: {
          club_id: string;
          competition_id?: string | null;
          created_at?: string;
          event_id: string;
          external_id?: string | null;
          fixture_status: string;
          home_away?: string | null;
          last_external_sync_at?: string | null;
          official_court_label?: string | null;
          official_start_at: string;
          official_venue_text?: string | null;
          opponent_name: string;
          opponent_score?: number | null;
          result_status?: string | null;
          round_label?: string | null;
          source: string;
          team_score?: number | null;
          updated_at?: string;
        };
        Update: {
          club_id?: string;
          competition_id?: string | null;
          created_at?: string;
          event_id?: string;
          external_id?: string | null;
          fixture_status?: string;
          home_away?: string | null;
          last_external_sync_at?: string | null;
          official_court_label?: string | null;
          official_start_at?: string;
          official_venue_text?: string | null;
          opponent_name?: string;
          opponent_score?: number | null;
          result_status?: string | null;
          round_label?: string | null;
          source?: string;
          team_score?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "games_competition_same_club";
            columns: ["competition_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "competitions";
            referencedColumns: ["id", "club_id"];
          },
          {
            foreignKeyName: "games_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: true;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "games_event_same_club";
            columns: ["event_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id", "club_id"];
          },
        ];
      };
      guardian_relationships: {
        Row: {
          active: boolean;
          club_id: string;
          created_at: string;
          id: string;
          player_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          club_id: string;
          created_at?: string;
          id?: string;
          player_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          active?: boolean;
          club_id?: string;
          created_at?: string;
          id?: string;
          player_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "guardian_relationships_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guardian_relationships_player_same_club";
            columns: ["player_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id", "club_id"];
          },
        ];
      };
      invitations: {
        Row: {
          club_id: string;
          consumed_at: string | null;
          created_at: string;
          created_by: string;
          expires_at: string;
          id: string;
          intended_email: string | null;
          intended_phone: string | null;
          invite_type: string;
          player_id: string | null;
          revoked_at: string | null;
          team_id: string | null;
          token_hash: string;
          updated_at: string;
        };
        Insert: {
          club_id: string;
          consumed_at?: string | null;
          created_at?: string;
          created_by: string;
          expires_at: string;
          id?: string;
          intended_email?: string | null;
          intended_phone?: string | null;
          invite_type: string;
          player_id?: string | null;
          revoked_at?: string | null;
          team_id?: string | null;
          token_hash: string;
          updated_at?: string;
        };
        Update: {
          club_id?: string;
          consumed_at?: string | null;
          created_at?: string;
          created_by?: string;
          expires_at?: string;
          id?: string;
          intended_email?: string | null;
          intended_phone?: string | null;
          invite_type?: string;
          player_id?: string | null;
          revoked_at?: string | null;
          team_id?: string | null;
          token_hash?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invitations_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_player_same_club";
            columns: ["player_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id", "club_id"];
          },
          {
            foreignKeyName: "invitations_team_same_club";
            columns: ["team_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id", "club_id"];
          },
        ];
      };
      notification_deliveries: {
        Row: {
          attempt_count: number;
          event_key: string;
          id: string;
          last_error_code: string | null;
          notification_type: string;
          provider_message_id: string | null;
          request_id: string;
          sent_at: string | null;
          status: string;
          user_id: string;
        };
        Insert: {
          attempt_count?: number;
          event_key: string;
          id?: string;
          last_error_code?: string | null;
          notification_type: string;
          provider_message_id?: string | null;
          request_id: string;
          sent_at?: string | null;
          status: string;
          user_id: string;
        };
        Update: {
          attempt_count?: number;
          event_key?: string;
          id?: string;
          last_error_code?: string | null;
          notification_type?: string;
          provider_message_id?: string | null;
          request_id?: string;
          sent_at?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: true;
            referencedRelation: "notification_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_deliveries_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      notification_preferences: {
        Row: {
          category: string;
          push_enabled: boolean;
          user_id: string;
        };
        Insert: {
          category: string;
          push_enabled: boolean;
          user_id: string;
        };
        Update: {
          category?: string;
          push_enabled?: boolean;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
        ];
      };
      notification_requests: {
        Row: {
          club_id: string;
          created_at: string;
          id: string;
          notification_type: string;
          payload: NonNullable<Json>;
          recipient_user_id: string;
          source_id: string;
          status: string;
          team_id: string;
        };
        Insert: {
          club_id: string;
          created_at?: string;
          id?: string;
          notification_type: string;
          payload: NonNullable<Json>;
          recipient_user_id: string;
          source_id: string;
          status?: string;
          team_id: string;
        };
        Update: {
          club_id?: string;
          created_at?: string;
          id?: string;
          notification_type?: string;
          payload?: NonNullable<Json>;
          recipient_user_id?: string;
          source_id?: string;
          status?: string;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_requests_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_requests_recipient_user_id_fkey";
            columns: ["recipient_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "notification_requests_team_club_fkey";
            columns: ["team_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id", "club_id"];
          },
        ];
      };
      player_game_recognitions: {
        Row: {
          category: string;
          club_id: string;
          created_at: string;
          created_by: string;
          game_event_id: string;
          id: string;
          note: string | null;
          player_id: string;
          team_id: string;
          updated_at: string;
          updated_by: string;
        };
        Insert: {
          category: string;
          club_id: string;
          created_at?: string;
          created_by: string;
          game_event_id: string;
          id?: string;
          note?: string | null;
          player_id: string;
          team_id: string;
          updated_at?: string;
          updated_by: string;
        };
        Update: {
          category?: string;
          club_id?: string;
          created_at?: string;
          created_by?: string;
          game_event_id?: string;
          id?: string;
          note?: string | null;
          player_id?: string;
          team_id?: string;
          updated_at?: string;
          updated_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_game_recognitions_game_team_club_fkey";
            columns: ["game_event_id", "team_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id", "team_id", "club_id"];
          },
          {
            foreignKeyName: "player_game_recognitions_player_club_fkey";
            columns: ["player_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id", "club_id"];
          },
        ];
      };
      player_source_identities: {
        Row: {
          club_id: string;
          created_at: string;
          id: string;
          player_id: string;
          source: string;
          source_player_id: string;
        };
        Insert: {
          club_id: string;
          created_at?: string;
          id?: string;
          player_id: string;
          source: string;
          source_player_id: string;
        };
        Update: {
          club_id?: string;
          created_at?: string;
          id?: string;
          player_id?: string;
          source?: string;
          source_player_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_source_identities_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_source_identities_player_same_club";
            columns: ["player_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id", "club_id"];
          },
        ];
      };
      player_team_registrations: {
        Row: {
          active: boolean;
          club_id: string;
          created_at: string;
          id: string;
          player_id: string;
          team_id: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          club_id: string;
          created_at?: string;
          id?: string;
          player_id: string;
          team_id: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          club_id?: string;
          created_at?: string;
          id?: string;
          player_id?: string;
          team_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_team_registrations_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_team_registrations_player_same_club";
            columns: ["player_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id", "club_id"];
          },
          {
            foreignKeyName: "player_team_registrations_team_same_club";
            columns: ["team_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id", "club_id"];
          },
        ];
      };
      players: {
        Row: {
          active: boolean;
          club_id: string;
          created_at: string;
          first_name: string;
          id: string;
          last_name: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          club_id: string;
          created_at?: string;
          first_name: string;
          id?: string;
          last_name: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          club_id?: string;
          created_at?: string;
          first_name?: string;
          id?: string;
          last_name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "players_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      playhq_mappings: {
        Row: {
          club_id: string;
          created_at: string;
          external_id: string;
          external_parent_id: string | null;
          id: string;
          internal_id: string;
          internal_type: string;
        };
        Insert: {
          club_id: string;
          created_at?: string;
          external_id: string;
          external_parent_id?: string | null;
          id?: string;
          internal_id: string;
          internal_type: string;
        };
        Update: {
          club_id?: string;
          created_at?: string;
          external_id?: string;
          external_parent_id?: string | null;
          id?: string;
          internal_id?: string;
          internal_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "playhq_mappings_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      post_game_review_focus: {
        Row: {
          created_at: string;
          focus_code: string;
          review_id: string;
        };
        Insert: {
          created_at?: string;
          focus_code: string;
          review_id: string;
        };
        Update: {
          created_at?: string;
          focus_code?: string;
          review_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_game_review_focus_review_id_fkey";
            columns: ["review_id"];
            isOneToOne: false;
            referencedRelation: "post_game_reviews";
            referencedColumns: ["id"];
          },
        ];
      };
      post_game_reviews: {
        Row: {
          club_id: string;
          completed_at: string | null;
          completed_by: string | null;
          created_at: string;
          game_event_id: string;
          id: string;
          needs_improvement: string;
          team_id: string;
          updated_at: string;
          what_worked: string;
        };
        Insert: {
          club_id: string;
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string;
          game_event_id: string;
          id?: string;
          needs_improvement?: string;
          team_id: string;
          updated_at?: string;
          what_worked?: string;
        };
        Update: {
          club_id?: string;
          completed_at?: string | null;
          completed_by?: string | null;
          created_at?: string;
          game_event_id?: string;
          id?: string;
          needs_improvement?: string;
          team_id?: string;
          updated_at?: string;
          what_worked?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_game_reviews_event_team_club_fkey";
            columns: ["game_event_id", "team_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id", "team_id", "club_id"];
          },
        ];
      };
      practice_blocks: {
        Row: {
          club_id: string;
          drill_id: string | null;
          duration_minutes: number;
          id: string;
          instructions: string;
          practice_plan_id: string;
          sort_order: number;
          team_id: string;
          title: string | null;
        };
        Insert: {
          club_id: string;
          drill_id?: string | null;
          duration_minutes: number;
          id?: string;
          instructions?: string;
          practice_plan_id: string;
          sort_order: number;
          team_id: string;
          title?: string | null;
        };
        Update: {
          club_id?: string;
          drill_id?: string | null;
          duration_minutes?: number;
          id?: string;
          instructions?: string;
          practice_plan_id?: string;
          sort_order?: number;
          team_id?: string;
          title?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "practice_blocks_drill_fkey";
            columns: ["drill_id", "team_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "drills";
            referencedColumns: ["id", "team_id", "club_id"];
          },
          {
            foreignKeyName: "practice_blocks_plan_fkey";
            columns: ["practice_plan_id", "team_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "practice_plans";
            referencedColumns: ["id", "team_id", "club_id"];
          },
        ];
      };
      practice_plan_focus: {
        Row: {
          club_id: string;
          created_at: string;
          focus_code: string;
          practice_plan_id: string;
          source_event_id: string;
          source_review_id: string;
          team_id: string;
        };
        Insert: {
          club_id: string;
          created_at?: string;
          focus_code: string;
          practice_plan_id: string;
          source_event_id: string;
          source_review_id: string;
          team_id: string;
        };
        Update: {
          club_id?: string;
          created_at?: string;
          focus_code?: string;
          practice_plan_id?: string;
          source_event_id?: string;
          source_review_id?: string;
          team_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "practice_plan_focus_event_fkey";
            columns: ["source_event_id", "team_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id", "team_id", "club_id"];
          },
          {
            foreignKeyName: "practice_plan_focus_plan_fkey";
            columns: ["practice_plan_id", "team_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "practice_plans";
            referencedColumns: ["id", "team_id", "club_id"];
          },
          {
            foreignKeyName: "practice_plan_focus_review_fkey";
            columns: ["source_review_id"];
            isOneToOne: false;
            referencedRelation: "post_game_reviews";
            referencedColumns: ["id"];
          },
        ];
      };
      practice_plans: {
        Row: {
          club_id: string;
          created_at: string;
          created_by: string;
          id: string;
          is_template: boolean;
          notes: string;
          team_id: string;
          title: string;
          training_event_id: string | null;
          updated_at: string;
          updated_by: string;
        };
        Insert: {
          club_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          is_template: boolean;
          notes?: string;
          team_id: string;
          title: string;
          training_event_id?: string | null;
          updated_at?: string;
          updated_by: string;
        };
        Update: {
          club_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          is_template?: boolean;
          notes?: string;
          team_id?: string;
          title?: string;
          training_event_id?: string | null;
          updated_at?: string;
          updated_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "practice_plans_event_fkey";
            columns: ["training_event_id", "team_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id", "team_id", "club_id"];
          },
          {
            foreignKeyName: "practice_plans_team_club_fkey";
            columns: ["team_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id", "club_id"];
          },
        ];
      };
      private_player_game_notes: {
        Row: {
          author_user_id: string;
          club_id: string;
          created_at: string;
          game_event_id: string;
          note: string;
          player_id: string;
          team_id: string;
          updated_at: string;
          updated_by: string;
          visibility: string;
        };
        Insert: {
          author_user_id: string;
          club_id: string;
          created_at?: string;
          game_event_id: string;
          note: string;
          player_id: string;
          team_id: string;
          updated_at?: string;
          updated_by: string;
          visibility?: string;
        };
        Update: {
          author_user_id?: string;
          club_id?: string;
          created_at?: string;
          game_event_id?: string;
          note?: string;
          player_id?: string;
          team_id?: string;
          updated_at?: string;
          updated_by?: string;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "private_player_game_notes_game_team_club_fkey";
            columns: ["game_event_id", "team_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id", "team_id", "club_id"];
          },
          {
            foreignKeyName: "private_player_game_notes_player_club_fkey";
            columns: ["player_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "players";
            referencedColumns: ["id", "club_id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          email: string | null;
          first_name: string;
          last_name: string;
          locale: string;
          phone_e164: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          display_name: string;
          email?: string | null;
          first_name: string;
          last_name: string;
          locale?: string;
          phone_e164?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          display_name?: string;
          email?: string | null;
          first_name?: string;
          last_name?: string;
          locale?: string;
          phone_e164?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      recurrence_series: {
        Row: {
          club_id: string;
          court_label: string | null;
          created_at: string;
          ends_on: string | null;
          id: string;
          lead_coach_user_id: string | null;
          local_time: string;
          starts_on: string;
          team_id: string;
          timezone: string;
          weekday: number;
        };
        Insert: {
          club_id: string;
          court_label?: string | null;
          created_at?: string;
          ends_on?: string | null;
          id?: string;
          lead_coach_user_id?: string | null;
          local_time: string;
          starts_on: string;
          team_id: string;
          timezone: string;
          weekday: number;
        };
        Update: {
          club_id?: string;
          court_label?: string | null;
          created_at?: string;
          ends_on?: string | null;
          id?: string;
          lead_coach_user_id?: string | null;
          local_time?: string;
          starts_on?: string;
          team_id?: string;
          timezone?: string;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: "recurrence_series_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurrence_series_team_same_club";
            columns: ["team_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id", "club_id"];
          },
        ];
      };
      seasons: {
        Row: {
          active: boolean;
          club_id: string;
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          club_id: string;
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          club_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "seasons_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
      team_memberships: {
        Row: {
          active: boolean;
          club_id: string;
          created_at: string;
          id: string;
          role: string;
          team_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          active?: boolean;
          club_id: string;
          created_at?: string;
          id?: string;
          role: string;
          team_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          active?: boolean;
          club_id?: string;
          created_at?: string;
          id?: string;
          role?: string;
          team_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "team_memberships_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "team_memberships_team_same_club";
            columns: ["team_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id", "club_id"];
          },
        ];
      };
      teams: {
        Row: {
          active: boolean;
          club_id: string;
          competition_id: string | null;
          created_at: string;
          id: string;
          name: string;
          season_id: string;
          updated_at: string;
          venue_id: string | null;
        };
        Insert: {
          active?: boolean;
          club_id: string;
          competition_id?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          season_id: string;
          updated_at?: string;
          venue_id?: string | null;
        };
        Update: {
          active?: boolean;
          club_id?: string;
          competition_id?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          season_id?: string;
          updated_at?: string;
          venue_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "teams_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teams_competition_same_club";
            columns: ["competition_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "competitions";
            referencedColumns: ["id", "club_id"];
          },
          {
            foreignKeyName: "teams_season_same_club";
            columns: ["season_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "seasons";
            referencedColumns: ["id", "club_id"];
          },
          {
            foreignKeyName: "teams_venue_same_club";
            columns: ["venue_id", "club_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id", "club_id"];
          },
        ];
      };
      training_sessions: {
        Row: {
          checked_in_at: string | null;
          checked_in_by: string | null;
          event_id: string;
          lead_coach_user_id: string | null;
        };
        Insert: {
          checked_in_at?: string | null;
          checked_in_by?: string | null;
          event_id: string;
          lead_coach_user_id?: string | null;
        };
        Update: {
          checked_in_at?: string | null;
          checked_in_by?: string | null;
          event_id?: string;
          lead_coach_user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "training_sessions_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: true;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      venues: {
        Row: {
          active: boolean;
          club_id: string;
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          club_id: string;
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          club_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "venues_club_id_fkey";
            columns: ["club_id"];
            isOneToOne: false;
            referencedRelation: "clubs";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_duty_swap: { Args: { p_request_id: string }; Returns: string };
      accept_invitation: {
        Args: { p_token: string };
        Returns: {
          club_id: string;
          invitation_id: string;
          invite_type: string;
          player_id: string;
          team_id: string;
        }[];
      };
      acknowledge_announcement: {
        Args: { p_announcement_id: string };
        Returns: undefined;
      };
      acknowledge_own_game_duty: {
        Args: { p_event_id: string };
        Returns: number;
      };
      apply_notification_provider_result: {
        Args: { p_request_id: string; p_result: string; p_token: string };
        Returns: string;
      };
      archive_announcement: {
        Args: { p_announcement_id: string };
        Returns: string;
      };
      assert_announcement_team: {
        Args: { p_mode: string; p_team_id: string };
        Returns: {
          active: boolean;
          club_id: string;
          competition_id: string | null;
          created_at: string;
          id: string;
          name: string;
          season_id: string;
          updated_at: string;
          venue_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "teams";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      assert_club_structure_admin: {
        Args: { p_club_id: string };
        Returns: string;
      };
      assert_coaching_stats_team: {
        Args: { p_team_id: string };
        Returns: {
          active: boolean;
          club_id: string;
          competition_id: string | null;
          created_at: string;
          id: string;
          name: string;
          season_id: string;
          updated_at: string;
          venue_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "teams";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      assert_fill_in_confirmation_history: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      assert_fill_in_manage: {
        Args: { p_team_id: string };
        Returns: {
          active: boolean;
          club_id: string;
          competition_id: string | null;
          created_at: string;
          id: string;
          name: string;
          season_id: string;
          updated_at: string;
          venue_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "teams";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      assert_fixture_team: {
        Args: { p_mode: string; p_team_id: string };
        Returns: {
          active: boolean;
          club_id: string;
          competition_id: string | null;
          created_at: string;
          id: string;
          name: string;
          season_id: string;
          updated_at: string;
          venue_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "teams";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      assert_lead_coach: {
        Args: { p_team_id: string; p_user_id: string };
        Returns: undefined;
      };
      assert_post_game_review_actor: {
        Args: { p_private_note?: boolean; p_team_id: string };
        Returns: undefined;
      };
      assert_practice_plan_actor: {
        Args: { p_team_id: string };
        Returns: undefined;
      };
      assert_team_roster_reader: {
        Args: { p_full: boolean; p_team_id: string };
        Returns: string;
      };
      assert_training_coach: {
        Args: { p_team_id: string };
        Returns: undefined;
      };
      assert_training_manage: {
        Args: { p_team_id: string };
        Returns: undefined;
      };
      assert_training_timezone: {
        Args: { p_timezone: string };
        Returns: undefined;
      };
      assign_game_duty: {
        Args: {
          p_assigned_user_id: string;
          p_duty_type: string;
          p_event_id: string;
          p_label: string;
        };
        Returns: string;
      };
      assign_team_role: {
        Args: { p_role: string; p_team_id: string; p_user_id: string };
        Returns: {
          active: boolean;
          club_id: string;
          created_at: string;
          id: string;
          role: string;
          team_id: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "team_memberships";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      caller_can_take_duty: {
        Args: { p_club_id: string; p_team_id: string; p_user_id: string };
        Returns: boolean;
      };
      caller_guards_player: { Args: { p_player_id: string }; Returns: boolean };
      caller_is_club_admin: { Args: { p_club_id: string }; Returns: boolean };
      caller_manages_player: {
        Args: { p_club_id: string; p_player_id: string; p_team_id: string };
        Returns: boolean;
      };
      caller_manages_team: { Args: { p_team_id: string }; Returns: boolean };
      cancel_duty_swap: { Args: { p_request_id: string }; Returns: undefined };
      check_in_training: { Args: { p_event_id: string }; Returns: undefined };
      commit_duty_allocation: {
        Args: { p_event_id: string; p_fingerprint: string };
        Returns: undefined;
      };
      confirm_fill_in: {
        Args: { p_player_id: string; p_request_id: string };
        Returns: string;
      };
      copy_practice_plan: {
        Args: {
          p_as_template: boolean;
          p_source_plan_id: string;
          p_team_id: string;
          p_training_event_id: string;
        };
        Returns: string;
      };
      create_club_competition: {
        Args: { p_club_id: string; p_name: string; p_season_id: string };
        Returns: {
          active: boolean;
          club_id: string;
          created_at: string;
          id: string;
          name: string;
          season_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "competitions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_club_season: {
        Args: { p_club_id: string; p_name: string };
        Returns: {
          active: boolean;
          club_id: string;
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "seasons";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_club_season_and_team: {
        Args: { p_club_id: string; p_season_name: string; p_team_name: string };
        Returns: {
          season_id: string;
          team_id: string;
        }[];
      };
      create_club_team: {
        Args: {
          p_club_id: string;
          p_competition_id: string;
          p_name: string;
          p_season_id: string;
          p_venue_id: string;
        };
        Returns: {
          active: boolean;
          club_id: string;
          competition_id: string | null;
          created_at: string;
          id: string;
          name: string;
          season_id: string;
          updated_at: string;
          venue_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "teams";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_club_venue: {
        Args: { p_club_id: string; p_name: string };
        Returns: {
          active: boolean;
          club_id: string;
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "venues";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_invitation: {
        Args: {
          p_club_id: string;
          p_intended_email: string;
          p_intended_phone: string;
          p_invite_type: string;
          p_player_id: string;
          p_team_id: string;
        };
        Returns: {
          expires_at: string;
          id: string;
          token: string;
        }[];
      };
      create_manual_fixture: {
        Args: {
          p_club_id: string;
          p_competition_id: string;
          p_court_label: string;
          p_ends_at: string;
          p_home_away: string;
          p_official_court_label: string;
          p_official_start_at: string;
          p_official_venue_text: string;
          p_opponent_name: string;
          p_round_label: string;
          p_starts_at: string;
          p_team_id: string;
          p_venue_id: string;
        };
        Returns: string;
      };
      create_open_game_duty: {
        Args: { p_duty_type: string; p_event_id: string; p_label: string };
        Returns: string;
      };
      create_player: {
        Args: { p_club_id: string; p_first_name: string; p_last_name: string };
        Returns: {
          active: boolean;
          club_id: string;
          created_at: string;
          first_name: string;
          id: string;
          last_name: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "players";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_training_series: {
        Args: {
          p_club_id: string;
          p_court_label: string;
          p_ends_on: string;
          p_lead_coach_user_id: string;
          p_local_time: string;
          p_starts_on: string;
          p_team_id: string;
          p_timezone: string;
          p_weekday: number;
        };
        Returns: string;
      };
      create_training_session: {
        Args: {
          p_club_id: string;
          p_court_label: string;
          p_ends_at: string;
          p_lead_coach_user_id: string;
          p_starts_at: string;
          p_team_id: string;
        };
        Returns: string;
      };
      deactivate_device_endpoint: {
        Args: { p_token: string };
        Returns: undefined;
      };
      deactivate_player: {
        Args: { p_player_id: string };
        Returns: {
          active: boolean;
          club_id: string;
          created_at: string;
          first_name: string;
          id: string;
          last_name: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "players";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      duty_allocation_candidates: {
        Args: { p_event_id: string };
        Returns: Json;
      };
      duty_allocation_fingerprint: {
        Args: { p_event_id: string };
        Returns: string;
      };
      edit_announcement: {
        Args: {
          p_acknowledgement_required: boolean;
          p_announcement_id: string;
          p_body: string;
          p_category: string;
          p_importance: string;
          p_title: string;
        };
        Returns: string;
      };
      edit_training_following: {
        Args: {
          p_ends_on: string;
          p_event_id: string;
          p_local_time: string;
          p_timezone: string;
          p_weekday: number;
        };
        Returns: string;
      };
      edit_training_occurrence: {
        Args: {
          p_court_label: string;
          p_ends_at: string;
          p_event_id: string;
          p_lead_coach_user_id: string;
          p_starts_at: string;
        };
        Returns: string;
      };
      edit_training_series: {
        Args: {
          p_ends_on: string;
          p_local_time: string;
          p_series_id: string;
          p_timezone: string;
          p_weekday: number;
        };
        Returns: string;
      };
      enqueue_announcement_published: {
        Args: { p_announcement_id: string };
        Returns: number;
      };
      enqueue_duty_notification: {
        Args: {
          p_club_id: string;
          p_notification_type: string;
          p_payload: Json;
          p_recipient_user_id: string;
          p_source_id: string;
          p_team_id: string;
        };
        Returns: undefined;
      };
      enqueue_duty_swap_accepted: {
        Args: { p_request_id: string };
        Returns: number;
      };
      enqueue_fill_in_confirmed: {
        Args: { p_request_id: string };
        Returns: number;
      };
      enqueue_fill_in_requested: {
        Args: { p_request_id: string };
        Returns: number;
      };
      fixture_projection: {
        Args: { p_event_id: string };
        Returns: {
          arrival_at: string;
          club_id: string;
          coach_focus: string;
          competition_id: string;
          court_label: string;
          ends_at: string;
          event_id: string;
          event_status: string;
          external_id: string;
          fixture_status: string;
          home_away: string;
          last_external_sync_at: string;
          official_court_label: string;
          official_start_at: string;
          official_venue_text: string;
          opponent_name: string;
          opponent_score: number;
          result_status: string;
          round_label: string;
          source: string;
          starts_at: string;
          team_id: string;
          team_note: string;
          team_score: number;
          uniform_note: string;
          venue_id: string;
        }[];
      };
      fixture_text: {
        Args: { p_max: number; p_required: boolean; p_value: string };
        Returns: string;
      };
      import_fixture: {
        Args: {
          p_club_id: string;
          p_competition_id: string;
          p_court_label: string;
          p_ends_at: string;
          p_external_id: string;
          p_home_away: string;
          p_official_court_label: string;
          p_official_start_at: string;
          p_official_venue_text: string;
          p_opponent_name: string;
          p_round_label: string;
          p_starts_at: string;
          p_team_id: string;
          p_venue_id: string;
        };
        Returns: string;
      };
      import_players: {
        Args: { p_club_id: string; p_rows: Json };
        Returns: Json;
      };
      insert_official_fixture: {
        Args: {
          p_club_id: string;
          p_competition_id: string;
          p_court_label: string;
          p_ends_at: string;
          p_external_id: string;
          p_home_away: string;
          p_official_court_label: string;
          p_official_start_at: string;
          p_official_venue_text: string;
          p_opponent_name: string;
          p_round_label: string;
          p_source: string;
          p_starts_at: string;
          p_team_id: string;
          p_venue_id: string;
        };
        Returns: string;
      };
      insert_training_event: {
        Args: {
          p_club_id: string;
          p_court_label: string;
          p_ends_at: string;
          p_lead_coach_user_id: string;
          p_series_id: string;
          p_starts_at: string;
          p_team_id: string;
        };
        Returns: string;
      };
      link_player_guardian: {
        Args: { p_guardian_user_id: string; p_player_id: string };
        Returns: {
          active: boolean;
          club_id: string;
          created_at: string;
          id: string;
          player_id: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "guardian_relationships";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      list_announcement_acknowledgements: {
        Args: { p_announcement_id: string };
        Returns: {
          acknowledged_at: string;
          user_id: string;
        }[];
      };
      list_club_adults: {
        Args: { p_club_id: string };
        Returns: {
          display_name: string;
          user_id: string;
        }[];
      };
      list_club_invitations: {
        Args: { p_club_id: string };
        Returns: {
          club_id: string;
          consumed_at: string;
          created_at: string;
          expires_at: string;
          id: string;
          intended_email: string;
          intended_phone: string;
          invite_type: string;
          player_id: string;
          revoked_at: string;
          status: string;
          team_id: string;
        }[];
      };
      list_duty_allocation_inputs: {
        Args: { p_event_id: string };
        Returns: Json;
      };
      list_event_fill_in: {
        Args: { p_event_id: string };
        Returns: {
          id: string;
          status: string;
        }[];
      };
      list_fill_in_candidates: {
        Args: { p_team_id: string };
        Returns: {
          display_name: string;
          player_id: string;
        }[];
      };
      list_fill_in_responses: {
        Args: { p_request_id: string };
        Returns: {
          display_name: string;
          player_id: string;
        }[];
      };
      list_guardian_fill_in_players: {
        Args: { p_team_id: string };
        Returns: {
          display_name: string;
          player_id: string;
        }[];
      };
      list_notification_preferences: {
        Args: Record<PropertyKey, never>;
        Returns: {
          category: string;
          push_enabled: boolean;
        }[];
      };
      list_open_duty_swaps: {
        Args: { p_event_id: string };
        Returns: {
          id: string;
          label: string;
          requester_user_id: string;
          target_user_id: string;
        }[];
      };
      list_private_player_game_notes: {
        Args: { p_event_id: string };
        Returns: {
          note: string;
          player_id: string;
        }[];
      };
      list_team_announcements: {
        Args: { p_include_archived: boolean; p_team_id: string };
        Returns: {
          acknowledged_at: string;
          acknowledgement_required: boolean;
          archived_at: string;
          author_user_id: string;
          body: string;
          category: string;
          club_id: string;
          id: string;
          importance: string;
          published_at: string;
          read_at: string;
          team_id: string;
          title: string;
        }[];
      };
      list_team_attendance: {
        Args: { p_event_id: string };
        Returns: {
          absence_category: string;
          player_id: string;
          private_note: string;
          status: string;
        }[];
      };
      list_team_fixtures: {
        Args: { p_team_id: string };
        Returns: {
          arrival_at: string;
          club_id: string;
          coach_focus: string;
          competition_id: string;
          court_label: string;
          ends_at: string;
          event_id: string;
          event_status: string;
          external_id: string;
          fixture_status: string;
          home_away: string;
          last_external_sync_at: string;
          official_court_label: string;
          official_start_at: string;
          official_venue_text: string;
          opponent_name: string;
          opponent_score: number;
          result_status: string;
          round_label: string;
          source: string;
          starts_at: string;
          team_id: string;
          team_note: string;
          team_score: number;
          uniform_note: string;
          venue_id: string;
        }[];
      };
      list_team_roster_full: {
        Args: { p_team_id: string };
        Returns: {
          player_id: string;
          registered_name: string;
          team_id: string;
        }[];
      };
      list_team_roster_masked: {
        Args: { p_team_id: string };
        Returns: {
          display_name: string;
          player_id: string;
          team_id: string;
        }[];
      };
      list_team_schedule: {
        Args: {
          p_event_type: string;
          p_range_end: string;
          p_range_start: string;
          p_team_id: string;
        };
        Returns: {
          club_id: string;
          court_label: string;
          ends_at: string;
          event_id: string;
          event_status: string;
          event_type: string;
          opponent_name: string;
          round_label: string;
          starts_at: string;
          team_id: string;
        }[];
      };
      lock_administered_player: {
        Args: { p_player_id: string };
        Returns: {
          active: boolean;
          club_id: string;
          created_at: string;
          first_name: string;
          id: string;
          last_name: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "players";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      mark_announcement_read: {
        Args: { p_announcement_id: string };
        Returns: undefined;
      };
      masked_player_name: { Args: { p_player_id: string }; Returns: string };
      materialize_training_series: {
        Args: { p_series_id: string };
        Returns: number;
      };
      normalize_official_fixture: {
        Args: {
          p_club_id: string;
          p_competition_id: string;
          p_court_label: string;
          p_ends_at: string;
          p_fixture_status: string;
          p_home_away: string;
          p_official_court_label: string;
          p_official_start_at: string;
          p_official_venue_text: string;
          p_opponent_name: string;
          p_opponent_score: number;
          p_result_status: string;
          p_round_label: string;
          p_starts_at: string;
          p_team_score: number;
          p_venue_id: string;
        };
        Returns: {
          court_label: string;
          official_court_label: string;
          official_venue_text: string;
          opponent_name: string;
          round_label: string;
        }[];
      };
      player_is_active: { Args: { p_player_id: string }; Returns: boolean };
      player_is_fill_in_candidate: {
        Args: { p_player_id: string; p_team_id: string };
        Returns: boolean;
      };
      player_text: { Args: { p_value: string }; Returns: string };
      practice_plan_json: { Args: { p_plan_id: string }; Returns: Json };
      publish_announcement: {
        Args: {
          p_acknowledgement_required: boolean;
          p_body: string;
          p_category: string;
          p_club_id: string;
          p_importance: string;
          p_team_id: string;
          p_title: string;
        };
        Returns: string;
      };
      reactivate_player: {
        Args: { p_player_id: string };
        Returns: {
          active: boolean;
          club_id: string;
          created_at: string;
          first_name: string;
          id: string;
          last_name: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "players";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      reactivate_team_role: {
        Args: { p_role: string; p_team_id: string; p_user_id: string };
        Returns: {
          active: boolean;
          club_id: string;
          created_at: string;
          id: string;
          role: string;
          team_id: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "team_memberships";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      read_fixture: {
        Args: { p_event_id: string };
        Returns: {
          arrival_at: string;
          club_id: string;
          coach_focus: string;
          competition_id: string;
          court_label: string;
          ends_at: string;
          event_id: string;
          event_status: string;
          external_id: string;
          fixture_status: string;
          home_away: string;
          last_external_sync_at: string;
          official_court_label: string;
          official_start_at: string;
          official_venue_text: string;
          opponent_name: string;
          opponent_score: number;
          result_status: string;
          round_label: string;
          source: string;
          starts_at: string;
          team_id: string;
          team_note: string;
          team_score: number;
          uniform_note: string;
          venue_id: string;
        }[];
      };
      read_game_coaching_stats: {
        Args: { p_event_id: string };
        Returns: {
          active_registration: boolean;
          approximate_minutes: number;
          assists: number;
          club_id: string;
          event_id: string;
          fouls: number;
          opponent_score: number;
          player_display_name: string;
          player_id: string;
          points: number;
          rebounds: number;
          result_status: string;
          scheduled_minutes: number;
          source: string;
          steals: number;
          team_id: string;
          team_score: number;
        }[];
      };
      read_game_day: {
        Args: { p_event_id: string };
        Returns: {
          arrival_at: string;
          attending_count: number;
          club_id: string;
          coach_focus: string;
          court_label: string;
          event_id: string;
          fill_in_label: string;
          official_start_at: string;
          opponent_name: string;
          own_duty_label: string;
          own_duty_status: string;
          own_rsvp: string;
          round_label: string;
          team_id: string;
          unanswered_count: number;
          unavailable_count: number;
          uniform_note: string;
          unsure_count: number;
          venue_text: string;
        }[];
      };
      read_game_player_stat_history: {
        Args: { p_event_id: string };
        Returns: {
          actor_user_id: string;
          after_approximate_minutes: number;
          after_assists: number;
          after_fouls: number;
          after_points: number;
          after_rebounds: number;
          after_steals: number;
          before_approximate_minutes: number;
          before_assists: number;
          before_fouls: number;
          before_points: number;
          before_rebounds: number;
          before_steals: number;
          event_id: string;
          occurred_at: string;
          player_id: string;
        }[];
      };
      read_post_game_review: {
        Args: { p_event_id: string };
        Returns: {
          club_id: string;
          completed_at: string;
          completed_by: string;
          event_id: string;
          focus_codes: string[];
          needs_improvement: string;
          recognitions: Json;
          team_id: string;
          what_worked: string;
        }[];
      };
      read_practice_planner: { Args: { p_team_id: string }; Returns: Json };
      read_private_player_game_note: {
        Args: { p_event_id: string; p_player_id: string };
        Returns: string;
      };
      record_attendance: {
        Args: {
          p_absence_category: string;
          p_event_id: string;
          p_player_id: string;
          p_private_note: string;
          p_status: string;
        };
        Returns: string;
      };
      register_device_endpoint: {
        Args: { p_platform: string; p_token: string };
        Returns: string;
      };
      register_player_on_team: {
        Args: { p_player_id: string; p_team_id: string };
        Returns: {
          active: boolean;
          club_id: string;
          created_at: string;
          id: string;
          player_id: string;
          team_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "player_team_registrations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      remove_player_game_recognition: {
        Args: { p_category: string; p_event_id: string; p_player_id: string };
        Returns: undefined;
      };
      request_duty_swap: {
        Args: { p_event_id: string; p_target_user_id: string };
        Returns: string;
      };
      request_fill_in: { Args: { p_event_id: string }; Returns: string };
      reschedule_attached_training: {
        Args: {
          p_ends_on: string;
          p_from: string;
          p_local_time: string;
          p_series_id: string;
          p_timezone: string;
          p_weekday: number;
        };
        Returns: undefined;
      };
      respond_fill_in: {
        Args: { p_player_id: string; p_request_id: string };
        Returns: string;
      };
      restore_fill_in_open_request_invariant: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      revoke_invitation: { Args: { p_invitation_id: string }; Returns: string };
      revoke_team_role: {
        Args: { p_role: string; p_team_id: string; p_user_id: string };
        Returns: {
          active: boolean;
          club_id: string;
          created_at: string;
          id: string;
          role: string;
          team_id: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "team_memberships";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_game_player_stat: {
        Args: {
          p_approximate_minutes: number;
          p_assists: number;
          p_event_id: string;
          p_fouls: number;
          p_player_id: string;
          p_points: number;
          p_rebounds: number;
          p_steals: number;
        };
        Returns: undefined;
      };
      save_manual_game_result: {
        Args: {
          p_event_id: string;
          p_opponent_score: number;
          p_team_score: number;
        };
        Returns: undefined;
      };
      save_player_game_recognition: {
        Args: {
          p_category: string;
          p_event_id: string;
          p_note: string;
          p_player_id: string;
        };
        Returns: string;
      };
      save_post_game_review: {
        Args: {
          p_complete: boolean;
          p_event_id: string;
          p_focus_codes: Json;
          p_needs_improvement: string;
          p_what_worked: string;
        };
        Returns: string;
      };
      save_practice_drill: {
        Args: {
          p_default_duration_minutes: number;
          p_instructions: string;
          p_name: string;
          p_team_id: string;
        };
        Returns: string;
      };
      save_practice_plan: {
        Args: {
          p_blocks: Json;
          p_focus: Json;
          p_notes: string;
          p_plan_id: string;
          p_team_id: string;
          p_title: string;
          p_training_event_id: string;
        };
        Returns: string;
      };
      save_private_player_game_note: {
        Args: { p_event_id: string; p_note: string; p_player_id: string };
        Returns: undefined;
      };
      set_notification_preference: {
        Args: { p_category: string; p_push_enabled: boolean };
        Returns: undefined;
      };
      structure_name: { Args: { p_name: string }; Returns: string };
      team_is_active: { Args: { p_team_id: string }; Returns: boolean };
      unlink_player_guardian: {
        Args: { p_guardian_user_id: string; p_player_id: string };
        Returns: {
          active: boolean;
          club_id: string;
          created_at: string;
          id: string;
          player_id: string;
          updated_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "guardian_relationships";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      unregister_player_from_team: {
        Args: { p_player_id: string };
        Returns: {
          active: boolean;
          club_id: string;
          created_at: string;
          id: string;
          player_id: string;
          team_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "player_team_registrations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_club_competition: {
        Args: { p_active: boolean; p_competition_id: string; p_name: string };
        Returns: {
          active: boolean;
          club_id: string;
          created_at: string;
          id: string;
          name: string;
          season_id: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "competitions";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_club_season: {
        Args: { p_active: boolean; p_name: string; p_season_id: string };
        Returns: {
          active: boolean;
          club_id: string;
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "seasons";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_club_team: {
        Args: { p_active: boolean; p_name: string; p_team_id: string };
        Returns: {
          active: boolean;
          club_id: string;
          competition_id: string | null;
          created_at: string;
          id: string;
          name: string;
          season_id: string;
          updated_at: string;
          venue_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "teams";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_club_venue: {
        Args: { p_active: boolean; p_name: string; p_venue_id: string };
        Returns: {
          active: boolean;
          club_id: string;
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "venues";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_fixture_overlay: {
        Args: {
          p_arrival_at: string;
          p_coach_focus: string;
          p_event_id: string;
          p_team_note: string;
          p_uniform_note: string;
        };
        Returns: undefined;
      };
      update_official_fixture: {
        Args: {
          p_club_id: string;
          p_competition_id: string;
          p_court_label: string;
          p_ends_at: string;
          p_event_id: string;
          p_fixture_status: string;
          p_home_away: string;
          p_official_court_label: string;
          p_official_start_at: string;
          p_official_venue_text: string;
          p_opponent_name: string;
          p_opponent_score: number;
          p_result_status: string;
          p_round_label: string;
          p_starts_at: string;
          p_team_id: string;
          p_team_score: number;
          p_venue_id: string;
        };
        Returns: undefined;
      };
      update_player_identity: {
        Args: {
          p_first_name: string;
          p_last_name: string;
          p_player_id: string;
        };
        Returns: {
          active: boolean;
          club_id: string;
          created_at: string;
          first_name: string;
          id: string;
          last_name: string;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "players";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      user_can_read_team_announcements: {
        Args: { p_team_id: string; p_user_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
