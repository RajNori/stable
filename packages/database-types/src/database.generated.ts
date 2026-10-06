export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
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
      assert_club_structure_admin: {
        Args: { p_club_id: string };
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
      caller_guards_player: { Args: { p_player_id: string }; Returns: boolean };
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
      import_players: {
        Args: { p_club_id: string; p_rows: Json };
        Returns: Json;
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
      player_is_active: { Args: { p_player_id: string }; Returns: boolean };
      player_text: { Args: { p_value: string }; Returns: string };
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
