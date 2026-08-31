export type Role = 'admin' | 'approver' | 'purchaser';
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'ordered' | 'partially_received' | 'completed';

export interface User {
  id: number;
  username: string;
  role: Role;
  fullName: string;
  full_name?: string;
  slack_user_id?: string | null;
  created_at?: string;
}

export interface AuthState {
  authenticated: boolean;
  userId?: number;
  role?: Role;
  fullName?: string;
}

export interface Vendor {
  id: number;
  name: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  created_at?: string;
}

export interface Department {
  id: number;
  name: string;
  approver_id?: number | null;
  approver_name?: string | null;
  slack_approval_message?: string | null;
  created_at?: string;
}

export interface FundingSource {
  id: number;
  name: string;
  description?: string | null;
  is_active: number;
  created_at?: string;
}

export interface RequestItem {
  id?: number;
  product_name: string;
  description?: string;
  purchase_link?: string;
  quantity: number;
  unit_price: number;
  line_total?: number;
  quantity_received?: number;
  received_at?: string | null;
}

export interface PurchaseRequest {
  id: number;
  vendor_id?: number;
  department_id?: number;
  requester_id?: number;
  requester_name: string;
  order_name?: string | null;
  status: RequestStatus;
  subtotal: number;
  tax_amount: number;
  shipping_cost?: number;
  tariff_cost?: number;
  total: number;
  notes?: string | null;
  approved_by?: number | null;
  approver_name?: string | null;
  approved_at?: string | null;
  created_at: string;
  vendor_name?: string;
  department_name?: string | null;
  funding_source_name?: string | null;
  funding_source_id?: number | null;
  requires_multi_approval?: number;
  approval_count?: number;
  approval_history?: string | null;
  requested_arrival_date?: string | null;
  tracking_number?: string | null;
  estimated_delivery_date?: string | null;
  actual_amount_spent?: number | null;
  total_item_quantity?: number;
  received_item_quantity?: number;
  items?: RequestItem[];
  approvers?: Array<{approver_name: string; approved_at: string}>;
}

export interface RequestTotals {
  subtotal: number;
  taxAmount: number;
  shipping: number;
  tariff: number;
  total: number;
}

export interface Settings {
  multi_approval_threshold: number;
  required_approvals: number;
  base_url: string;
  slack_webhook_url: string;
  slack_new_request_message: string;
  slack_approved_message: string;
  slack_multi_approval_message: string;
  slack_ordered_message: string;
  slack_arrived_message: string;
  google_sheets_enabled: boolean;
  google_apps_script_webhook: string;
  google_sheets_auto_export: boolean;
  inventree_url: string;
  inventree_api_key: string;
}
