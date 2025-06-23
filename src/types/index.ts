// src/types/index.ts
export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  has_completed_onboarding: boolean;
}

export interface UserData {
  userId: number;
  orgId: number;
  role: 'owner' | 'admin' | 'office_worker' | 'site_worker';
  name: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  has_completed_onboarding: boolean;
}

export interface Organization {
  id: number;
  name: string;
  trading_name?: string;
  company_number?: string;
  vat_number?: string;
  email?: string;
  phone?: string;
  website?: string;
  registered_address_line1?: string;
  registered_address_line2?: string;
  registered_city?: string;
  registered_county?: string;
  registered_postcode?: string;
  trading_address_line1?: string;
  trading_address_line2?: string;
  trading_city?: string;
  trading_county?: string;
  trading_postcode?: string;
  description?: string;
  invite_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  owner: number;
}

export interface Location {
  id: number;
  organization: number;
  building_name?: string;
  name?: string;
  street_number: string;
  street_name: string;
  address_2?: string;
  town_or_city: string;
  county?: string;
  postcode: string;
  is_active: boolean;
  created_by?: number;
  created_at: string;
  updated_at: string;
}

export interface Device {
  id: number;
  identifier: string;
  description: string;
  image?: string;
  organization?: number;
  make: string;
  model: string;
  device_type: 'Battery' | 'Charger' | 'Adapter' | 'Cable' | 'Drill' | 'Saw' | 'Other';
  serial_number?: string;
  maintenance_interval?: number;
  next_maintenance_date?: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  status: 'available' | 'assigned' | 'damaged' | 'stolen' | 'maintenance' | 'lost';
  location?: number;
}

export interface DeviceAssignment {
  id: number;
  device: Device;
  device_id: number;
  previous_assignment?: number;
  user?: number;
  location?: number;
  assigned_date: string;
  returned_date?: string;
  created_at: string;
  updated_at: string;
  assigned_by: number;
}

export interface Report {
  id: number;
  device: Device;
  device_id: number;
  report_date: string;
  type: 'DAMAGED' | 'STOLEN' | 'LOST' | 'MALFUNCTIONING' | 'MAINTENANCE' | 'OTHER';
  status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'CANCELLED' | 'ESCALATED';
  resolved: boolean;
  resolved_date?: string;
  description: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
}

export interface DevicePhotos {
  id: number;
  device: number;
  image: string;
  created_by?: number;
  report?: number;
  reportable: boolean;
  expiry?: string;
  created_at: string;
  updated_at: string;
}

// Form interfaces
export interface PasswordChangeForm {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  email: string;
  password: string;
  password2: string;
  first_name: string;
  last_name: string;
  organization_invite_code?: string;
  phone_number?: string;
}

export interface ProfileForm {
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
}

export interface OrganizationForm {
  name: string;
  trading_name?: string;
  email?: string;
  phone?: string;
  website?: string;
  registered_address_line1: string;
  registered_address_line2?: string;
  registered_city: string;
  registered_county?: string;
  registered_postcode: string;
  trading_address_line1?: string;
  trading_address_line2?: string;
  trading_city?: string;
  trading_county?: string;
  trading_postcode?: string;
}

export interface LocationForm {
  name?: string;
  building_name?: string;
  street_number: string;
  street_name: string;
  address_2?: string;
  town_or_city: string;
  county?: string;
  postcode: string;
  organization: number;
}

export interface DeviceForm {
  description: string;
  make: string;
  model: string;
  device_type: Device['device_type'];
  serial_number?: string;
  maintenance_interval?: number;
  next_maintenance_date?: string;
  location?: number;
}

export interface ReportForm {
  device_id: number;
  report_date: string;
  type: Report['type'];
  description: string;
}

// Validation interfaces
export interface ValidationRule {
  type: 'required' | 'email' | 'phone' | 'minLength' | 'maxLength' | 'custom' | 'ukPostcode' | 'url';
  value?: number;
  message?: string;
  validator?: (value: any) => boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'url';
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  secureTextEntry?: boolean;
  editable?: boolean;
}

// NFC interfaces
export interface NFCTagData {
  [key: string]: any;
  id?: string;
}

export interface NFCOperationResult {
  success: boolean;
  data?: NFCTagData;
  error?: string;
}

// API Response interfaces
export interface ApiResponse<T> {
  data: T;
  message?: string;
  success?: boolean;
}

export interface PaginatedResponse<T> {
  results: T[];
  count: number;
  next?: string;
  previous?: string;
}

// Navigation types
export interface NavigationProp {
  navigate: (screen: string, params?: any) => void;
  goBack: () => void;
  replace: (screen: string, params?: any) => void;
  canGoBack: () => boolean;
  setOptions: (options: any) => void;
}

export interface RouteProp<T = any> {
  params: T;
}

// Dropdown/Picker types
export interface DropdownOption {
  label: string;
  value: string;
  key: string;
}

// Billing interfaces
export interface BillingData {
  devices: {
    total: number;
    active: number;
    inactive: number;
    free_quota: number;
    billable: number;
  };
  tier: {
    name: string;
    price_per_device: {
      monthly: number;
      annual: number;
    };
  };
  billing: {
    status: 'active' | 'cancelled' | 'past_due' | 'inactive';
    cycle: 'monthly' | 'annual';
    free_quota: number;
    next_billing_date: number;
    price_per_device: number;
    total_monthly_cost: number;
  };
}

export interface Invoice {
  id: string;
  amount_paid: number;
  currency: string;
  status: 'paid' | 'unpaid' | 'pending';
  created: number;
  period_start: number;
  period_end: number;
}

// Error types
export interface ApiError {
  response?: {
    data?: {
      detail?: string;
      message?: string;
      [key: string]: any;
    };
    status?: number;
  };
  request?: any;
  message?: string;
}