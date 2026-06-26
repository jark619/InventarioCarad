export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; tenant_id: string; role: Database['public']['Enums']['app_role']; full_name: string | null; created_at: string; first_name: string | null; last_name: string | null; employee_number: string | null; is_administrator: boolean };
        Insert: { id: string; tenant_id: string; role?: Database['public']['Enums']['app_role']; full_name?: string | null; created_at?: string; first_name?: string | null; last_name?: string | null; employee_number?: string | null; is_administrator?: boolean };
        Update: { id?: string; tenant_id?: string; role?: Database['public']['Enums']['app_role']; full_name?: string | null; created_at?: string; first_name?: string | null; last_name?: string | null; employee_number?: string | null; is_administrator?: boolean };
        Relationships: [{ foreignKeyName: 'profiles_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }];
      };
      tenants: {
        Row: { id: string; name: string; logo_url: string | null; created_at: string; plan: string; subscription_status: string; stripe_customer_id: string | null; stripe_subscription_id: string | null; store_limit: number };
        Insert: { id?: string; name: string; logo_url?: string | null; created_at?: string; plan?: string; subscription_status?: string; stripe_customer_id?: string | null; stripe_subscription_id?: string | null; store_limit?: number };
        Update: { id?: string; name?: string; logo_url?: string | null; created_at?: string; plan?: string; subscription_status?: string; stripe_customer_id?: string | null; stripe_subscription_id?: string | null; store_limit?: number };
        Relationships: [];
      };
      products: {
        Row: { id: string; tenant_id: string; name: string; barcode: string | null; quantity: number; category: string | null; image_url: string | null; price: number; low_stock_threshold: number; is_active: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; tenant_id?: string; name: string; barcode?: string | null; quantity?: number; category?: string | null; image_url?: string | null; price?: number; low_stock_threshold?: number; is_active?: boolean; created_at?: string; updated_at?: string };
        Update: { id?: string; tenant_id?: string; name?: string; barcode?: string | null; quantity?: number; category?: string | null; image_url?: string | null; price?: number; low_stock_threshold?: number; is_active?: boolean; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      sales: {
        Row: { id: string; tenant_id: string; cashier_id: string; total: number; created_at: string };
        Insert: { id?: string; tenant_id: string; cashier_id: string; total: number; created_at?: string };
        Update: { id?: string; tenant_id?: string; cashier_id?: string; total?: number; created_at?: string };
        Relationships: [];
      };
      sale_items: {
        Row: { id: string; sale_id: string; product_id: string; quantity: number; unit_price: number };
        Insert: { id?: string; sale_id: string; product_id: string; quantity: number; unit_price: number };
        Update: { id?: string; sale_id?: string; product_id?: string; quantity?: number; unit_price?: number };
        Relationships: [{ foreignKeyName: 'sale_items_product_id_fkey'; columns: ['product_id']; isOneToOne: false; referencedRelation: 'products'; referencedColumns: ['id'] }, { foreignKeyName: 'sale_items_sale_id_fkey'; columns: ['sale_id']; isOneToOne: false; referencedRelation: 'sales'; referencedColumns: ['id'] }];
      };
      stores: {
        Row: { id: string; tenant_id: string; name: string; created_at: string };
        Insert: { id?: string; tenant_id?: string; name: string; created_at?: string };
        Update: { id?: string; tenant_id?: string; name?: string; created_at?: string };
        Relationships: [{ foreignKeyName: 'stores_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }];
      };
      promotions: {
        Row: { id: string; tenant_id: string; store_id: string | null; name: string; code: string; discount_type: 'percent' | 'fixed'; discount_value: number; starts_at: string; ends_at: string | null; active: boolean; created_at: string };
        Insert: { id?: string; tenant_id?: string; store_id?: string | null; name: string; code: string; discount_type: 'percent' | 'fixed'; discount_value: number; starts_at?: string; ends_at?: string | null; active?: boolean; created_at?: string };
        Update: { id?: string; tenant_id?: string; store_id?: string | null; name?: string; code?: string; discount_type?: 'percent' | 'fixed'; discount_value?: number; starts_at?: string; ends_at?: string | null; active?: boolean; created_at?: string };
        Relationships: [{ foreignKeyName: 'promotions_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }, { foreignKeyName: 'promotions_store_id_fkey'; columns: ['store_id']; isOneToOne: false; referencedRelation: 'stores'; referencedColumns: ['id'] }];
      };
      collaborators: {
        Row: { id: string; tenant_id: string; store_id: string | null; first_name: string; last_name: string; employee_number: string; role: Database['public']['Enums']['app_role']; active: boolean; created_at: string; updated_at: string };
        Insert: { id?: string; tenant_id?: string; store_id?: string | null; first_name: string; last_name: string; employee_number: string; role?: Database['public']['Enums']['app_role']; active?: boolean; created_at?: string; updated_at?: string };
        Update: { id?: string; tenant_id?: string; store_id?: string | null; first_name?: string; last_name?: string; employee_number?: string; role?: Database['public']['Enums']['app_role']; active?: boolean; created_at?: string; updated_at?: string };
        Relationships: [{ foreignKeyName: 'collaborators_tenant_id_fkey'; columns: ['tenant_id']; isOneToOne: false; referencedRelation: 'tenants'; referencedColumns: ['id'] }, { foreignKeyName: 'collaborators_store_id_fkey'; columns: ['store_id']; isOneToOne: false; referencedRelation: 'stores'; referencedColumns: ['id'] }];
      };
    };
    Views: {
      sales_report: { Row: { tenant_id: string; id: string; name: string; quantity: number; low_stock_threshold: number; units_sold: number }; Relationships: [] };
    };
    Functions: {
      create_sale: { Args: { p_items: Json }; Returns: string };
      create_store: { Args: { p_name: string }; Returns: string };
      update_my_profile: { Args: { p_full_name: string }; Returns: undefined };
      admin_update_collaborator: { Args: { p_id: string; p_full_name: string; p_role: Database['public']['Enums']['app_role'] }; Returns: undefined };
    };
    Enums: { app_role: 'admin' | 'inventory' | 'cashier' };
    CompositeTypes: Record<string, never>;
  };
};
