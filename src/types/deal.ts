export interface Deal {
  id: string;
  title: string;
  description: string | null;
  airline_name: string | null;
  origin_airport: string | null;
  destination_airport: string | null;
  valid_from: string;
  valid_until: string;
  discount_type: 'fixed' | 'percentage';
  discount_value: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
