// types.ts - Complete updated interfaces without any

// Type aliases for common patterns
export type WasteCategory = string | string[];
export type WasteClassification = string | string[];

// Specific types for dynamic properties
export interface Rating {
  clientId?: string;
  recyclerId?: string;
  rating: number;
  comment?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface Transaction {
  id: string;
  amount: number;
  type: 'credit' | 'debit';
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  createdAt: number;
  updatedAt?: number;
  description?: string;
  reference?: string;
  paymentMethod?: string;
}

export interface Price {
  category: string;
  pricePerKg: number;
  unit?: string;
  updatedAt: number;
  createdBy?: string;
  isActive?: boolean;
}

export interface WasteManagementInfo {
  CompanyName?: string;
  DirectorName?: string;
  WMSTYPE?: string;
  RecycleType?: string;
  WasteCategory?: WasteCategory;
  WasteClassification?: WasteClassification;
  detailsComp?: boolean;
  employees?: string;
  ghMobileNumber?: string;
  ghanaCardNumber?: string;
  gps?: string;
  landmark?: string;
  location?: string;
  compRegUrl?: string;
  logoUrl?: string;
  businessEmail?: string;
  businessWebsite?: string;
  businessImageUrl?: string;
  registrationImageUrl?: string;
  registrationNumber?: string;
  city?: string;
  district?: string;
  fullAddress?: string;
  nearestRoad?: string;
  postcode?: string;
  latitude?: number;
  longitude?: number;
  updatedAt?: number;
}

// NewWMS type instead of any
export interface NewWMS {
  wmsType?: string;
  wmsCategory?: string;
  companyName?: string;
  registrationNumber?: string;
  [key: string]: string | number | boolean | undefined;
}

// Extended properties interface for flexible data
export interface ExtendedProperties {
  metadata?: Record<string, string | number | boolean>;
  customFields?: Record<string, unknown>;
  settings?: Record<string, boolean | string | number>;
}

export interface Recycler {
  id: string;
  firstName?: string;
  LastName?: string;
  email?: string;
  phone?: string;
  phoneNumber?: string;
  Password?: string;
  WMSTYPE?: string;
  WMSCATEGORY?: string;
  wmsCategory?: string;
  wmsType?: string;
  detailsComp?: boolean;
  detailsCompleted?: boolean;
  riderImageUrl?: string;
  token?: string;
  balance?: number;
  status?: 'active' | 'inactive' | 'pending' | 'suspended';
  createdAt?: string | number;
  userId?: string;
  newWMS?: NewWMS;
  wasteManagementInfo?: WasteManagementInfo;
  ratings?: Record<string, Rating>;
  transactions?: Record<string, Transaction>;
  prices?: Record<string, Price>;
  location?: string;
  extendedProperties?: ExtendedProperties;
}

export interface Client {
  id: string;
  firstName?: string;
  LastName?: string;
  email?: string;
  phoneNumber?: string;
  location?: string;
  SettlementType?: 'urban' | 'rural' | 'peri-urban';
  detailsComp?: boolean;
  dateOfBirth?: string;
  ghCardNo?: string;
  gpsAddress?: string;
  city?: string;
  district?: string;
  fullAddress?: string;
  nearestRoad?: string;
  postcode?: string;
  latitude?: number;
  longitude?: number;
  isActive?: boolean;
  userId?: string;
  userType?: 'client' | 'premium' | 'business';
  createdAt?: number;
  updatedAt?: number;
  extendedProperties?: ExtendedProperties;
}

export interface WasteManagementRequest {
  id: string;
  client_name?: string;
  client_phone?: string;
  Client_id?: string;
  WMS_id?: string;
  WMS_name?: string;
  WMS_phone?: string;
  WMS_type?: string;
  category?: string;
  weight?: string;
  weight_kg?: number;
  calculated_price?: string;
  status?: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled' | 'rejected';
  created_at?: string;
  payment_method?: 'cash' | 'mobile_money' | 'card' | 'bank_transfer';
  payment_status?: 'pending' | 'paid' | 'failed' | 'refunded';
  Client_address?: string;
  finalClient_address?: string;
  location?: string;
  imageUrl?: string;
  fares?: string;
  scheduled_date?: string;
  completed_at?: string;
  notes?: string;
  rating?: number;
  extendedProperties?: ExtendedProperties;
}

// Utility type for database records that might have additional fields
export type DatabaseRecord<T> = T & {
  _id?: string;
  __v?: number;
  createdAt?: number;
  updatedAt?: number;
};

// Type guard functions
export function isRecycler(obj: unknown): obj is Recycler {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    typeof (obj as Recycler).id === 'string'
  );
}

export function isClient(obj: unknown): obj is Client {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    typeof (obj as Client).id === 'string' &&
    (obj as Client).userType === 'client'
  );
}

export function isWasteManagementRequest(obj: unknown): obj is WasteManagementRequest {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    typeof (obj as WasteManagementRequest).id === 'string' &&
    'status' in obj
  );
}

// Response types for API calls
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  statusCode?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Request parameter types
export interface RecyclerFilterParams {
  status?: Recycler['status'];
  wmsType?: string;
  location?: string;
  isActive?: boolean;
  searchTerm?: string;
}

export interface ClientFilterParams {
  userType?: Client['userType'];
  SettlementType?: Client['SettlementType'];
  isActive?: boolean;
  location?: string;
  searchTerm?: string;
}

export interface RequestFilterParams {
  status?: WasteManagementRequest['status'];
  payment_method?: WasteManagementRequest['payment_method'];
  dateRange?: {
    start: string;
    end: string;
  };
  clientId?: string;
  wmsId?: string;
}