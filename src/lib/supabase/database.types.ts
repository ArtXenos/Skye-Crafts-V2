export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      coupons: {
        Row: {
          code: string;
          created_at: string;
          discount_type: string;
          discount_value: number;
          ends_on: string;
          id: number;
          is_active: boolean;
          max_discount_cents: number;
          max_uses: number;
          min_order_cents: number;
          once_per_customer: boolean;
          starts_on: string;
          used_count: number;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          discount_type: string;
          discount_value: number;
          ends_on: string;
          id?: never;
          is_active?: boolean;
          max_discount_cents?: number;
          max_uses?: number;
          min_order_cents?: number;
          once_per_customer?: boolean;
          starts_on: string;
          used_count?: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          discount_type?: string;
          discount_value?: number;
          ends_on?: string;
          id?: never;
          is_active?: boolean;
          max_discount_cents?: number;
          max_uses?: number;
          min_order_cents?: number;
          once_per_customer?: boolean;
          starts_on?: string;
          used_count?: number;
        };
        Relationships: [];
      };
      custom_requests: {
        Row: {
          contact: string;
          created_at: string;
          details: string;
          id: number;
          name: string;
          occasion: string;
          quote_cents: number | null;
          shop_note: string;
          status: string;
          updated_at: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          contact: string;
          created_at?: string;
          details: string;
          id?: never;
          name: string;
          occasion?: string;
          quote_cents?: number | null;
          shop_note?: string;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          contact?: string;
          created_at?: string;
          details?: string;
          id?: never;
          name?: string;
          occasion?: string;
          quote_cents?: number | null;
          shop_note?: string;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "custom_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      newsletter_subscribers: {
        Row: {
          created_at: string;
          email: string;
          id: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          email: string;
          id?: never;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: never;
        };
        Relationships: [];
      };
      order_events: {
        Row: {
          actor: string;
          actor_id: string | null;
          created_at: string;
          id: number;
          note: string;
          order_id: number;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          actor: string;
          actor_id?: string | null;
          created_at?: string;
          id?: never;
          note?: string;
          order_id: number;
          status: string;
        };
        Update: {
          actor?: string;
          actor_id?: string | null;
          created_at?: string;
          id?: never;
          note?: string;
          order_id?: number;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          id: number;
          is_preorder: boolean;
          order_id: number;
          price_cents: number;
          product_id: number | null;
          quantity: number;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          id?: never;
          is_preorder?: boolean;
          order_id: number;
          price_cents: number;
          product_id?: number | null;
          quantity: number;
          title: string;
        };
        Update: {
          id?: never;
          is_preorder?: boolean;
          order_id?: number;
          price_cents?: number;
          product_id?: number | null;
          quantity?: number;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          address: string;
          buyer_email: string;
          buyer_id: string;
          cart_fingerprint: string;
          checkout_key: string | null;
          contact: string;
          coupon_code: string;
          coupon_id: number | null;
          created_at: string;
          discount_cents: number;
          expires_at: string | null;
          fulfillment: string;
          id: number;
          note: string;
          payment_method: string;
          receipt_path: string | null;
          recipient: string;
          status: string;
          status_note: string;
          subtotal_cents: number;
          total_cents: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address?: string;
          buyer_email?: string;
          buyer_id: string;
          cart_fingerprint?: string;
          checkout_key?: string | null;
          contact: string;
          coupon_code?: string;
          coupon_id?: number | null;
          created_at?: string;
          discount_cents?: number;
          expires_at?: string | null;
          fulfillment: string;
          id?: never;
          note?: string;
          payment_method: string;
          receipt_path?: string | null;
          recipient: string;
          status?: string;
          status_note?: string;
          subtotal_cents: number;
          total_cents: number;
          updated_at?: string;
        };
        Update: {
          address?: string;
          buyer_email?: string;
          buyer_id?: string;
          cart_fingerprint?: string;
          checkout_key?: string | null;
          contact?: string;
          coupon_code?: string;
          coupon_id?: number | null;
          created_at?: string;
          discount_cents?: number;
          expires_at?: string | null;
          fulfillment?: string;
          id?: never;
          note?: string;
          payment_method?: string;
          receipt_path?: string | null;
          recipient?: string;
          status?: string;
          status_note?: string;
          subtotal_cents?: number;
          total_cents?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey";
            columns: ["buyer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_coupon_id_fkey";
            columns: ["coupon_id"];
            isOneToOne: false;
            referencedRelation: "coupons";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          category: string;
          created_at: string;
          description: string;
          id: number;
          image_path: string | null;
          is_active: boolean;
          is_preorder: boolean;
          price_cents: number;
          stock: number;
          title: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          category: string;
          created_at?: string;
          description: string;
          id?: never;
          image_path?: string | null;
          is_active?: boolean;
          is_preorder?: boolean;
          price_cents: number;
          stock?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          description?: string;
          id?: never;
          image_path?: string | null;
          is_active?: boolean;
          is_preorder?: boolean;
          price_cents?: number;
          stock?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          id: string;
          is_admin: boolean;
          username: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id: string;
          is_admin?: boolean;
          username: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_admin?: boolean;
          username?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          body: string;
          created_at: string;
          id: number;
          product_id: number;
          rating: number;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          body?: string;
          created_at?: string;
          id?: never;
          product_id: number;
          rating: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: never;
          product_id?: number;
          rating?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      shop_settings: {
        Row: {
          is_private: boolean;
          key: string;
          updated_at: string;
          value: string;
        };
        ComputedFields: never;
        Insert: {
          is_private?: boolean;
          key: string;
          updated_at?: string;
          value: string;
        };
        Update: {
          is_private?: boolean;
          key?: string;
          updated_at?: string;
          value?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      product_ratings: {
        Row: {
          average: number | null;
          count: number | null;
          product_id: number;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      admin_order_events: {
        Args: { p_order_id: number };
        Returns: {
          actor: string;
          actor_name: string;
          created_at: string;
          id: number;
          note: string;
          status: string;
        }[];
      };
      admin_search_orders: {
        Args: { p_limit?: number; p_offset?: number; p_query?: string; p_status?: string };
        Returns: Json;
      };
      admin_set_order_status: {
        Args: { p_note?: string; p_order_id: number; p_status: string };
        Returns: undefined;
      };
      admin_summary: { Args: Record<PropertyKey, never>; Returns: Json };
      attach_receipt: { Args: { p_order_id: number; p_path: string }; Returns: undefined };
      can_review: { Args: { p_product_id: number }; Returns: boolean };
      cancel_order: { Args: { p_order_id: number }; Returns: undefined };
      confirm_receipt: { Args: { p_order_id: number }; Returns: undefined };
      expire_stale_orders: { Args: Record<PropertyKey, never>; Returns: number };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      order_private_details: { Args: { p_order_id: number }; Returns: Json };
      place_order: {
        Args: {
          p_address: string;
          p_checkout_key?: string;
          p_contact: string;
          p_coupon_code?: string;
          p_fulfillment: string;
          p_items: Json;
          p_note?: string;
          p_payment_method: string;
          p_recipient: string;
        };
        Returns: number;
      };
      quote_coupon: { Args: { p_code: string; p_items: Json }; Returns: Json };
      submit_custom_request: {
        Args: {
          p_client_hash: string;
          p_contact: string;
          p_details: string;
          p_name: string;
          p_occasion: string;
          p_user_id: string;
        };
        Returns: number;
      };
      submit_review: {
        Args: { p_body: string; p_product_id: number; p_rating: number };
        Returns: undefined;
      };
      subscribe_newsletter: {
        Args: { p_client_hash: string; p_email: string };
        Returns: undefined;
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

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
